import crypto from 'crypto';
import type { IncomingMessage, Server as HttpServer } from 'http';
import { and, eq } from 'drizzle-orm';
import { WebSocket, WebSocketServer } from 'ws';
import { PolicyEvaluator } from '../../domain/iam/rbac.ts';
import { getDb } from '../db/client.ts';
import { mmChannelMembers, mmChannels, rolePermissions, roles, tenants, users } from '../db/schema.ts';
import { extractSubdomain, verifySessionToken } from '../../application/middleware/tenantAndAuth.ts';

interface ClientSocketContext {
  ws: WebSocket;
  connectionId: string;
  authenticated: boolean;
  userId: string;
  tenantId: string;
  subdomain: string;
  fullName: string;
  serverSeq: number;
  activeChannelId: string;
  authTimer: ReturnType<typeof setTimeout> | null;
}

export interface MattermostBroadcastOptions {
  event: string;
  tenantId: string;
  channelId?: string;
  teamId?: string;
  userId?: string;
  omitUsers?: Record<string, boolean> | null;
  allowedUserIds?: Set<string> | null;
  data: Record<string, unknown>;
}

class MattermostWebSocketHub {
  private wss: WebSocketServer | null = null;
  private clients = new Set<ClientSocketContext>();
  private attachedServers = new WeakSet<HttpServer>();

  attach(server: HttpServer) {
    if (this.attachedServers.has(server)) return;
    this.attachedServers.add(server);

    if (!this.wss) {
      this.wss = new WebSocketServer({ noServer: true });
      this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        this.handleConnection(ws, req);
      });
    }

    server.on('upgrade', (req, socket, head) => {
      const reqUrl = req.url || '';
      if (!reqUrl.startsWith('/api/v4/websocket')) {
        return;
      }
      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        this.wss!.emit('connection', ws, req);
      });
    });
  }

  private sendSeqEvent(
    ctx: ClientSocketContext,
    event: string,
    data: Record<string, unknown>,
    broadcast: {
      omit_users?: Record<string, boolean> | null;
      user_id?: string;
      channel_id?: string;
      team_id?: string;
    } = {}
  ) {
    if (ctx.ws.readyState !== WebSocket.OPEN) return;
    const seq = ctx.serverSeq++;
    ctx.ws.send(
      JSON.stringify({
        event,
        data,
        broadcast: {
          omit_users: broadcast.omit_users ?? null,
          user_id: broadcast.user_id ?? '',
          channel_id: broadcast.channel_id ?? '',
          team_id: broadcast.team_id ?? '',
        },
        seq,
      })
    );
  }

  private sendReply(
    ctx: ClientSocketContext,
    seqReply: number,
    data: Record<string, unknown> = {},
    error?: { id: string; message: string; status_code: number }
  ) {
    if (ctx.ws.readyState !== WebSocket.OPEN) return;
    ctx.ws.send(
      JSON.stringify(
        error
          ? { status: 'FAIL', seq_reply: seqReply, error }
          : { status: 'OK', seq_reply: seqReply, data }
      )
    );
  }

  private async authenticateSocket(
    ctx: ClientSocketContext,
    token: string,
    requestedSubdomain?: string
  ): Promise<boolean> {
    const payload = verifySessionToken(token);
    if (!payload) return false;

    const db = await getDb();
    const [userRow] = await db.select().from(users).where(eq(users.id, payload.userId));
    if (!userRow || !userRow.isActive) return false;

    const [roleRow] = await db.select().from(roles).where(eq(roles.id, userRow.roleId));
    const permRows = roleRow
      ? await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleRow.id))
      : [];
    const permissions = permRows.map((p) => p.permission);
    if (!PolicyEvaluator.hasPermission(permissions, 'social:read')) {
      return false;
    }

    const sub = requestedSubdomain || 'acme';
    const [tenantRow] = await db.select().from(tenants).where(eq(tenants.subdomain, sub));
    const effectiveTenantId = tenantRow?.id || userRow.tenantId;
    const isPortalSuperAdmin = permissions.includes('tenants:admin');
    if (userRow.tenantId !== effectiveTenantId && !isPortalSuperAdmin) {
      return false;
    }

    ctx.authenticated = true;
    ctx.userId = userRow.id;
    ctx.tenantId = effectiveTenantId;
    ctx.subdomain = tenantRow?.subdomain || sub;
    ctx.fullName = userRow.fullName;

    if (ctx.authTimer) {
      clearTimeout(ctx.authTimer);
      ctx.authTimer = null;
    }

    // Mattermost hello frame must arrive with seq: 0 right after auth
    this.sendSeqEvent(
      ctx,
      'hello',
      {
        connection_id: ctx.connectionId,
        server_hostname: `${ctx.subdomain}.platform.local`,
        server_version: '11.9.0-nexus',
      },
      { user_id: ctx.userId }
    );

    // Notify tenant peers of online presence
    this.broadcastEvent({
      event: 'status_change',
      tenantId: ctx.tenantId,
      data: {
        status: 'online',
        user_id: ctx.userId,
      },
    });

    return true;
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const reqUrl = new URL(req.url || '/api/v4/websocket', 'http://localhost');
    const pathSubMatch = /^\/api\/v4\/websocket\/([a-z0-9-]+)\/?$/i.exec(reqUrl.pathname);
    const rawQuerySub = reqUrl.searchParams.get('subdomain')?.split('?')[0];
    const headerSub =
      pathSubMatch?.[1]?.toLowerCase() ||
      rawQuerySub ||
      extractSubdomain(req as unknown as Parameters<typeof extractSubdomain>[0]);

    const ctx: ClientSocketContext = {
      ws,
      connectionId: `mmconn_${crypto.randomUUID().slice(0, 12)}`,
      authenticated: false,
      userId: '',
      tenantId: '',
      subdomain: headerSub,
      fullName: '',
      serverSeq: 0,
      activeChannelId: '',
      authTimer: setTimeout(() => {
        if (!ctx.authenticated && ws.readyState === WebSocket.OPEN) {
          ws.close(4003, 'Authentication timeout');
        }
      }, 10000),
    };

    this.clients.add(ctx);

    // Allow optional Bearer header auth immediately on upgrade
    const authHeader = req.headers.authorization;
    const bearerMatch = typeof authHeader === 'string' ? /^bearer\s+(.+)$/i.exec(authHeader.trim()) : null;
    if (bearerMatch) {
      void this.authenticateSocket(ctx, bearerMatch[1].trim(), headerSub);
    }

    ws.on('message', (raw) => {
      void (async () => {
        try {
          const parsed = JSON.parse(raw.toString()) as {
            seq?: number;
            action?: string;
            data?: Record<string, unknown>;
          };
          const seq = typeof parsed.seq === 'number' ? parsed.seq : 1;
          const action = parsed.action || '';
          const data = parsed.data || {};

          if (action === 'authentication_challenge') {
            const token = typeof data.token === 'string' ? data.token : '';
            const ok = await this.authenticateSocket(ctx, token, headerSub);
            if (!ok) {
              this.sendReply(ctx, seq, {}, {
                id: 'api.context.session_expired.app_error',
                message: 'Invalid or expired session token',
                status_code: 401,
              });
              ws.close(4001, 'Unauthorized');
              return;
            }
            this.sendReply(ctx, seq, { authenticated: true, user_id: ctx.userId });
            return;
          }

          if (!ctx.authenticated) {
            this.sendReply(ctx, seq, {}, {
              id: 'api.context.not_authenticated',
              message: 'Authentication required',
              status_code: 401,
            });
            return;
          }

          if (action === 'ping') {
            this.sendReply(ctx, seq, {
              text: 'pong',
              version: '11.9.0-nexus',
              server_time: Date.now(),
            });
            return;
          }

          if (action === 'user_typing') {
            const channelId = typeof data.channel_id === 'string' ? data.channel_id : '';
            const parentId = typeof data.parent_id === 'string' ? data.parent_id : '';
            if (channelId) {
              const db = await getDb();
              const [ch] = await db
                .select()
                .from(mmChannels)
                .where(and(eq(mmChannels.id, channelId), eq(mmChannels.tenantId, ctx.tenantId)));
              if (ch) {
                let allowedUserIds: Set<string> | null = null;
                if (ch.type === 'P' || ch.type === 'D' || ch.type === 'G') {
                  const members = await db
                    .select({ userId: mmChannelMembers.userId })
                    .from(mmChannelMembers)
                    .where(
                      and(
                        eq(mmChannelMembers.tenantId, ctx.tenantId),
                        eq(mmChannelMembers.channelId, channelId)
                      )
                    );
                  allowedUserIds = new Set(members.map((m) => m.userId));
                  if (!allowedUserIds.has(ctx.userId)) {
                    this.sendReply(ctx, seq, {});
                    return;
                  }
                }
                this.broadcastEvent({
                  event: 'typing',
                  tenantId: ctx.tenantId,
                  channelId,
                  omitUsers: { [ctx.userId]: true },
                  allowedUserIds,
                  data: {
                    parent_id: parentId,
                    user_id: ctx.userId,
                  },
                });
              }
            }
            this.sendReply(ctx, seq, {});
            return;
          }

          if (action === 'presence') {
            if (typeof data.channel_id === 'string') {
              ctx.activeChannelId = data.channel_id;
            }
            this.sendReply(ctx, seq, {});
            return;
          }

          if (action === 'get_statuses' || action === 'get_statuses_by_ids') {
            const online = this.getOnlineUserIds(ctx.tenantId);
            const statuses: Record<string, string> = {};
            const requestedIds = Array.isArray(data.user_ids)
              ? (data.user_ids as string[])
              : Array.from(online);
            for (const uid of requestedIds) {
              statuses[uid] = online.has(uid) ? 'online' : 'offline';
            }
            this.sendReply(ctx, seq, statuses);
            return;
          }

          if (action === 'user_update_active_status') {
            const isActive = Boolean(data.user_is_active);
            this.broadcastEvent({
              event: 'status_change',
              tenantId: ctx.tenantId,
              data: {
                status: isActive ? 'online' : 'away',
                user_id: ctx.userId,
              },
            });
            this.sendReply(ctx, seq, {});
            return;
          }

          this.sendReply(ctx, seq, {});
        } catch {
          // Ignore malformed client frames
        }
      })();
    });

    ws.on('close', () => {
      if (ctx.authTimer) {
        clearTimeout(ctx.authTimer);
        ctx.authTimer = null;
      }
      this.clients.delete(ctx);
      if (ctx.authenticated && ctx.userId) {
        const stillOnline = this.getOnlineUserIds(ctx.tenantId).has(ctx.userId);
        if (!stillOnline) {
          this.broadcastEvent({
            event: 'status_change',
            tenantId: ctx.tenantId,
            data: {
              status: 'offline',
              user_id: ctx.userId,
            },
          });
        }
      }
    });
  }

  getOnlineUserIds(tenantId: string): Set<string> {
    const ids = new Set<string>();
    for (const c of this.clients) {
      if (c.authenticated && c.tenantId === tenantId && c.ws.readyState === WebSocket.OPEN) {
        ids.add(c.userId);
      }
    }
    return ids;
  }

  getClientCount(): number {
    let total = 0;
    for (const c of this.clients) {
      if (c.ws.readyState === WebSocket.OPEN) {
        total += 1;
      }
    }
    return total;
  }

  closeAll() {
    for (const c of this.clients) {
      if (c.authTimer) {
        clearTimeout(c.authTimer);
        c.authTimer = null;
      }
      try {
        c.ws.close(1001, 'Server shutting down');
      } catch {
        // ignore close errors
      }
    }
    this.clients.clear();
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  broadcastEvent(opts: MattermostBroadcastOptions) {
    for (const ctx of this.clients) {
      if (!ctx.authenticated || ctx.ws.readyState !== WebSocket.OPEN) continue;
      if (ctx.tenantId !== opts.tenantId) continue;
      if (opts.omitUsers && opts.omitUsers[ctx.userId]) continue;
      if (opts.allowedUserIds && !opts.allowedUserIds.has(ctx.userId)) continue;
      if (opts.userId && ctx.userId !== opts.userId) continue;

      this.sendSeqEvent(ctx, opts.event, opts.data, {
        omit_users: opts.omitUsers ?? null,
        user_id: opts.userId ?? '',
        channel_id: opts.channelId ?? '',
        team_id: opts.teamId ?? '',
      });
    }
  }
}

export const mattermostHub = new MattermostWebSocketHub();

export function attachMattermostWebSocketServer(server: HttpServer) {
  mattermostHub.attach(server);
}
