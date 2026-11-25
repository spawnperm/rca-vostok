import React, { useMemo } from 'react';
import {
  Bot,
  CheckSquare,
  ClipboardCheck,
  Database,
  FileText,
  GitBranch,
  Play,
  Radio,
  SlidersHorizontal,
  Webhook,
  Zap,
} from 'lucide-react';
import {
  extractConditionFromN8nIfNode,
  getN8nNodeDisplayMeta,
  isN8nTriggerType,
  type N8nNode,
  type N8nWorkflowDefinition,
} from '../../domain/n8n/workflowDefinition.ts';

interface N8nWorkflowCanvasProps {
  definition: N8nWorkflowDefinition;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  compact?: boolean;
}

const NODE_W = 216;
const NODE_H = 86;

function getNodeIcon(type: string) {
  if (type === 'n8n-nodes-base.webhook') return Webhook;
  if (type === 'n8n-nodes-base.manualTrigger') return Play;
  if (isN8nTriggerType(type)) return Zap;
  if (type === 'n8n-nodes-base.if') return GitBranch;
  if (type === 'n8n-nodes-base.set') return SlidersHorizontal;
  if (type === 'n8n-nodes-crm.createTask') return CheckSquare;
  if (type === 'n8n-nodes-crm.timelineNote') return FileText;
  if (type === 'n8n-nodes-nocobase.createApproval') return ClipboardCheck;
  if (type === 'n8n-nodes-nocobase.updateRecord') return Database;
  if (type === 'n8n-nodes-deepseek.harnessAnalyze') return Bot;
  if (type === 'n8n-nodes-nats.publish') return Radio;
  return Zap;
}

function summarizeNodeParams(node: N8nNode): string {
  const p = (node.parameters || {}) as Record<string, unknown>;
  if (node.type === 'n8n-nodes-base.if') {
    const cond = extractConditionFromN8nIfNode(node);
    if (cond) return `${cond.field} ${cond.operator} ${cond.value}`;
    return 'Условие ветвления';
  }
  if (node.type === 'n8n-nodes-nats.publish') {
    return typeof p.subject === 'string' && p.subject ? p.subject : 'workflows.n8n.executed';
  }
  if (node.type === 'n8n-nodes-crm.createTask') {
    return typeof p.taskTitle === 'string' && p.taskTitle ? p.taskTitle : 'Задача CRM';
  }
  if (node.type === 'n8n-nodes-nocobase.createApproval') {
    return typeof p.approverRoleCode === 'string'
      ? `Роль: ${p.approverRoleCode}`
      : 'Запрос согласования';
  }
  if (node.type === 'n8n-nodes-crm.timelineNote') {
    return typeof p.body === 'string' && p.body ? p.body : 'Заметка в таймлайн';
  }
  if (node.type === 'n8n-nodes-nocobase.updateRecord') {
    return p.field ? `${String(p.field)} = ${String(p.value ?? '')}` : 'Обновление поля';
  }
  if (node.type === 'n8n-nodes-base.set') {
    const keys = Object.entries(p)
      .filter(([, v]) => typeof v !== 'object')
      .map(([k, v]) => `${k}=${String(v)}`);
    return keys.length ? keys.join(', ') : 'Переменные контекста';
  }
  if (isN8nTriggerType(node.type)) {
    const ev = typeof p.event === 'string' ? p.event : '';
    const col = typeof p.collectionKey === 'string' ? ` (${p.collectionKey})` : '';
    return ev ? `${ev}${col}` : 'Входящий триггер';
  }
  return node.type;
}

export const N8nWorkflowCanvas: React.FC<N8nWorkflowCanvasProps> = ({
  definition,
  selectedNodeId,
  onSelectNode,
  compact = false,
}) => {
  const layout = useMemo(() => {
    const nodes = definition.nodes || [];
    const byName = new Map<string, N8nNode>();
    nodes.forEach((n) => byName.set(n.name, n));

    // Normalize positions so graphs always stay cleanly inside the canvas bounds
    const rawCoords = nodes.map((n, idx) => ({
      id: n.id,
      x: Array.isArray(n.position) && Number.isFinite(n.position[0]) ? n.position[0] : 80 + idx * 270,
      y: Array.isArray(n.position) && Number.isFinite(n.position[1]) ? n.position[1] : 120,
    }));

    const minX = rawCoords.length ? Math.min(...rawCoords.map((c) => c.x)) : 0;
    const minY = rawCoords.length ? Math.min(...rawCoords.map((c) => c.y)) : 0;
    const padX = 24;
    const padY = 24;

    const coords = new Map<string, { x: number; y: number }>();
    rawCoords.forEach((c) => {
      coords.set(c.id, {
        x: c.x - minX + padX,
        y: c.y - minY + padY,
      });
    });

    const edges: Array<{
      id: string;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      branchIndex: number;
      isIfSource: boolean;
    }> = [];

    for (const src of nodes) {
      const srcPos = coords.get(src.id);
      if (!srcPos) continue;
      const mainPorts = definition.connections?.[src.name]?.main || [];
      const isIf = src.type === 'n8n-nodes-base.if';

      mainPorts.forEach((targets, portIdx) => {
        (targets || []).forEach((target, targetIdx) => {
          const dst = byName.get(target.node);
          if (!dst) return;
          const dstPos = coords.get(dst.id);
          if (!dstPos) return;

          const portOffsetY = isIf
            ? portIdx === 0
              ? NODE_H * 0.34
              : NODE_H * 0.72
            : NODE_H * 0.5;

          edges.push({
            id: `${src.id}->${dst.id}:${portIdx}:${targetIdx}`,
            fromX: srcPos.x + NODE_W,
            fromY: srcPos.y + portOffsetY,
            toX: dstPos.x,
            toY: dstPos.y + NODE_H * 0.5,
            branchIndex: portIdx,
            isIfSource: isIf,
          });
        });
      });
    }

    const maxX = rawCoords.length
      ? Math.max(...Array.from(coords.values()).map((c) => c.x + NODE_W)) + padX
      : 420;
    const maxY = rawCoords.length
      ? Math.max(...Array.from(coords.values()).map((c) => c.y + NODE_H)) + padY
      : 160;

    return {
      nodes,
      coords,
      edges,
      width: Math.max(compact ? 560 : 680, maxX),
      height: Math.max(compact ? 140 : 240, maxY),
    };
  }, [definition, compact]);

  return (
    <div
      className={`relative overflow-x-auto rounded-xl border border-slate-200 ${
        compact ? 'bg-slate-50/70' : 'bg-[#F8FAFC]'
      }`}
      style={{
        backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <div
        className="relative"
        style={{
          width: `${layout.width}px`,
          height: `${layout.height}px`,
        }}
      >
        {/* SVG Connections */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          width={layout.width}
          height={layout.height}
        >
          <defs>
            <marker
              id="n8n-arrow-default"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path d="M0,0 L7,3.5 L0,7 z" fill="#94A3B8" />
            </marker>
            <marker
              id="n8n-arrow-true"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path d="M0,0 L7,3.5 L0,7 z" fill="#10B981" />
            </marker>
            <marker
              id="n8n-arrow-false"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path d="M0,0 L7,3.5 L0,7 z" fill="#F59E0B" />
            </marker>
          </defs>

          {layout.edges.map((edge) => {
            const dx = Math.max(48, Math.abs(edge.toX - edge.fromX) * 0.5);
            const path = `M ${edge.fromX} ${edge.fromY} C ${edge.fromX + dx} ${edge.fromY}, ${
              edge.toX - dx
            } ${edge.toY}, ${edge.toX - 4} ${edge.toY}`;
            const stroke = edge.isIfSource
              ? edge.branchIndex === 0
                ? '#10B981'
                : '#F59E0B'
              : '#94A3B8';
            const marker = edge.isIfSource
              ? edge.branchIndex === 0
                ? 'url(#n8n-arrow-true)'
                : 'url(#n8n-arrow-false)'
              : 'url(#n8n-arrow-default)';

            const midX = (edge.fromX + edge.toX) / 2;
            const midY = (edge.fromY + edge.toY) / 2;

            return (
              <g key={edge.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={2}
                  markerEnd={marker}
                />
                {edge.isIfSource && (
                  <g transform={`translate(${midX - 18}, ${midY - 9})`}>
                    <rect
                      width="36"
                      height="18"
                      rx="4"
                      fill={edge.branchIndex === 0 ? '#ECFDF5' : '#FFFBEB'}
                      stroke={edge.branchIndex === 0 ? '#6EE7B7' : '#FCD34D'}
                    />
                    <text
                      x="18"
                      y="12"
                      textAnchor="middle"
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="600"
                      fill={edge.branchIndex === 0 ? '#047857' : '#B45309'}
                    >
                      {edge.branchIndex === 0 ? 'TRUE' : 'FALSE'}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* n8n Nodes */}
        {layout.nodes.map((node) => {
          const pos = layout.coords.get(node.id) || { x: 24, y: 24 };
          const meta = getN8nNodeDisplayMeta(node.type);
          const Icon = getNodeIcon(node.type);
          const isSelected = selectedNodeId === node.id;
          const summary = summarizeNodeParams(node);
          const clickable = Boolean(onSelectNode);

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectNode?.(node.id)}
              disabled={!clickable}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${NODE_W}px`,
                height: `${NODE_H}px`,
              }}
              className={`absolute flex flex-col justify-between overflow-hidden rounded-xl border bg-white text-left shadow-xs transition-all ${
                clickable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
              } ${
                isSelected
                  ? 'border-[#0077FF] ring-2 ring-[#0077FF]/25'
                  : 'border-slate-200 hover:border-slate-300'
              } ${node.disabled ? 'opacity-55' : ''}`}
            >
              {/* Top color bar */}
              <div
                className="h-1 w-full shrink-0"
                style={{ backgroundColor: meta.accentHex }}
              />

              <div className="flex flex-1 flex-col justify-between px-3 py-2 min-h-0">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white"
                      style={{ backgroundColor: meta.accentHex }}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {meta.shortLabel}
                    </span>
                  </div>
                  <span className="truncate font-mono text-[9px] text-slate-400">
                    v{node.typeVersion || 1}
                  </span>
                </div>

                <div className="truncate text-xs font-semibold text-slate-900">{node.name}</div>

                <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                  <span className="truncate font-mono">{summary}</span>
                  {node.disabled && (
                    <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] text-slate-500">
                      off
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
