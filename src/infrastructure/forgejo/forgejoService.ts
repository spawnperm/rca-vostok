import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client.ts';
import { forgejoCommits, forgejoRepos } from '../db/schema.ts';
import { natsBus } from '../nats/eventBus.ts';

export function getForgejoServerConfig() {
  return {
    baseUrl: process.env.FORGEJO_BASE_URL || 'https://git.platform.local',
    lfsStorage: 'Garage S3',
    externalSyncEnabled: Boolean(process.env.FORGEJO_BASE_URL && process.env.FORGEJO_TOKEN),
  };
}

export async function listForgejoInventory(tenantId: string) {
  const db = await getDb();
  const [repos, commits] = await Promise.all([
    db
      .select()
      .from(forgejoRepos)
      .where(eq(forgejoRepos.tenantId, tenantId))
      .orderBy(desc(forgejoRepos.createdAt)),
    db
      .select()
      .from(forgejoCommits)
      .where(eq(forgejoCommits.tenantId, tenantId))
      .orderBy(desc(forgejoCommits.createdAt))
      .limit(30),
  ]);
  return {
    server: getForgejoServerConfig(),
    repos,
    commits,
  };
}

export async function createForgejoRepository(params: {
  tenantId: string;
  tenantSubdomain: string;
  actorId: string;
  name: string;
  description: string;
  visibility: 'private' | 'internal';
}) {
  const db = await getDb();
  const cfg = getForgejoServerConfig();
  const fullName = `${params.tenantSubdomain}/${params.name}`;

  const [existing] = await db
    .select()
    .from(forgejoRepos)
    .where(and(eq(forgejoRepos.tenantId, params.tenantId), eq(forgejoRepos.name, params.name)));
  if (existing) {
    throw new Error(`Репозиторий ${fullName} уже существует в Forgejo`);
  }

  const lfsBucket = `nexus-${params.tenantSubdomain}-forgejo-lfs`;
  const [repo] = await db
    .insert(forgejoRepos)
    .values({
      id: `fj_${crypto.randomUUID().slice(0, 10)}`,
      tenantId: params.tenantId,
      ownerSlug: params.tenantSubdomain,
      name: params.name,
      fullName,
      defaultBranch: 'main',
      cloneUrl: `${cfg.baseUrl.replace(/\/$/, '')}/${fullName}.git`,
      visibility: params.visibility,
      lfsBucket,
      description: params.description,
      starsCount: 1,
    })
    .returning();

  await natsBus.publish(params.tenantId, `forgejo.${params.tenantSubdomain}.repo.created`, params.actorId, {
    repoId: repo.id,
    fullName: repo.fullName,
    lfsBucket,
  });

  return repo;
}

export async function recordForgejoCommit(params: {
  tenantId: string;
  tenantSubdomain: string;
  repoId: string;
  branch?: string;
  message: string;
  actorId: string;
  authorName: string;
  authorEmail: string;
  s3ObjectKey?: string | null;
  documentId?: string;
}) {
  const db = await getDb();
  const [repo] = await db
    .select()
    .from(forgejoRepos)
    .where(and(eq(forgejoRepos.id, params.repoId), eq(forgejoRepos.tenantId, params.tenantId)));
  if (!repo) {
    throw new Error('Репозиторий Forgejo не найден');
  }

  const commitSha = crypto
    .createHash('sha1')
    .update(`${params.repoId}:${params.message}:${Date.now()}:${crypto.randomUUID()}`)
    .digest('hex')
    .slice(0, 12);

  const [commit] = await db
    .insert(forgejoCommits)
    .values({
      id: `fjc_${crypto.randomUUID().slice(0, 10)}`,
      tenantId: params.tenantId,
      repoId: repo.id,
      branch: params.branch || repo.defaultBranch || 'main',
      commitSha,
      message: params.message,
      authorName: params.authorName,
      authorEmail: params.authorEmail,
      filesChanged: 1,
      s3ObjectKey: params.s3ObjectKey ?? null,
    })
    .returning();

  await natsBus.publish(params.tenantId, `forgejo.${params.tenantSubdomain}.repo.pushed`, params.actorId, {
    repoId: repo.id,
    fullName: repo.fullName,
    branch: commit.branch,
    commitSha: commit.commitSha,
    message: commit.message,
    s3ObjectKey: params.s3ObjectKey ?? null,
    documentId: params.documentId ?? null,
  });

  return { repo, commit };
}
