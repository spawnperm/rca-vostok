import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Compass,
  GitBranch,
  GraduationCap,
  MinusCircle,
  RotateCcw,
} from 'lucide-react';
import {
  GUIDE_COMPLEXITIES,
  GUIDE_DISCIPLINES,
  GUIDE_ENTRY_LEVELS,
  buildGuideLearningRoadmapGraph,
  type GraphNodeVisualState,
  type GuideComplexityId,
  type GuideDisciplineId,
  type GuideEntryLevelId,
  type RoadmapGraphNode,
  type RoadmapNodeActionLink,
  type RoadmapNodeId,
} from '../utils/guideLearningRoadmapGraph';
import type { SiteTabId } from '../utils/seo';
import { tracker } from '../utils/tracker';

export interface GuideLearningRoadmapGraphProps {
  onOpenExam?: () => void;
  onOpenLibrary?: () => void;
  onNavigateTab?: (tab: SiteTabId) => void;
}

const STORAGE_KEY = 'rca_vostok_learning_graph_v1';

interface StoredGraphPrefs {
  entryLevel: GuideEntryLevelId;
  discipline: GuideDisciplineId;
  complexity: GuideComplexityId;
  completedNodeIds: RoadmapNodeId[];
  completedTaskIds: string[];
}

function loadStoredPrefs(): Partial<StoredGraphPrefs> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<StoredGraphPrefs>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredPrefs(prefs: StoredGraphPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage may be unavailable in private iframes
  }
}

function getSvgNodeColors(
  state: GraphNodeVisualState,
  isSelected: boolean,
  isHovered: boolean
): {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  codeFill: string;
  stateFill: string;
  titleFill: string;
  metaFill: string;
  opacity: number;
} {
  if (state === 'optional') {
    return {
      fill: isSelected ? '#F1F5F9' : '#F8FAFC',
      stroke: isSelected ? '#475569' : isHovered ? '#64748B' : '#CBD5E1',
      strokeWidth: isSelected ? 2.2 : 1.3,
      strokeDasharray: '5 4',
      codeFill: '#64748B',
      stateFill: '#64748B',
      titleFill: '#475569',
      metaFill: '#64748B',
      opacity: isSelected || isHovered ? 0.96 : 0.72,
    };
  }

  if (state === 'completed') {
    return {
      fill: isSelected ? '#ECFDF5' : '#F0FDF4',
      stroke: isSelected ? '#047857' : isHovered ? '#059669' : '#34D399',
      strokeWidth: isSelected ? 2.5 : 1.6,
      codeFill: '#047857',
      stateFill: '#047857',
      titleFill: '#0F172A',
      metaFill: '#065F46',
      opacity: 1,
    };
  }

  if (state === 'active') {
    return {
      fill: isSelected ? '#F0FDFA' : '#FFFFFF',
      stroke: isSelected ? '#0F766E' : '#0D9488',
      strokeWidth: isSelected ? 2.6 : 2.1,
      codeFill: '#0F766E',
      stateFill: '#0F766E',
      titleFill: '#0F172A',
      metaFill: '#115E59',
      opacity: 1,
    };
  }

  return {
    fill: isSelected ? '#F8FAFC' : '#FFFFFF',
    stroke: isSelected ? '#0F766E' : isHovered ? '#64748B' : '#CBD5E1',
    strokeWidth: isSelected ? 2.4 : 1.4,
    codeFill: '#475569',
    stateFill: '#64748B',
    titleFill: '#0F172A',
    metaFill: '#475569',
    opacity: 1,
  };
}

function getStateInspectorBadge(state: GraphNodeVisualState): {
  textClass: string;
  surfaceClass: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (state) {
    case 'completed':
      return {
        textClass: 'text-emerald-800',
        surfaceClass: 'bg-emerald-50 border-emerald-200',
        label: 'Этап пройден',
        Icon: CheckCircle2,
      };
    case 'active':
      return {
        textClass: 'text-teal-900',
        surfaceClass: 'bg-teal-50 border-teal-200',
        label: 'Текущий фокус',
        Icon: Compass,
      };
    case 'optional':
      return {
        textClass: 'text-slate-600',
        surfaceClass: 'bg-slate-100 border-slate-200',
        label: 'Альтернативная ветка',
        Icon: MinusCircle,
      };
    case 'upcoming':
    default:
      return {
        textClass: 'text-slate-700',
        surfaceClass: 'bg-slate-50 border-slate-200',
        label: 'Запланировано в треке',
        Icon: Circle,
      };
  }
}

const TIER_COLUMNS: readonly { tier: number; x: number; label: string }[] = [
  { tier: 1, x: 16, label: '1. Старт' },
  { tier: 2, x: 214, label: '2. База / стаж' },
  { tier: 3, x: 412, label: '3. Модули подготовки' },
  { tier: 4, x: 610, label: '4. Допуск' },
  { tier: 5, x: 808, label: '5. Экзамен РЦА' },
  { tier: 6, x: 1004, label: '6. Реестр' },
];

export const GuideLearningRoadmapGraph: React.FC<GuideLearningRoadmapGraphProps> = ({
  onOpenExam,
  onOpenLibrary,
  onNavigateTab,
}) => {
  const initialPrefs = useMemo(() => loadStoredPrefs(), []);

  const [entryLevel, setEntryLevel] = useState<GuideEntryLevelId>(
    initialPrefs.entryLevel ?? 'novice'
  );
  const [discipline, setDiscipline] = useState<GuideDisciplineId>(
    initialPrefs.discipline ?? 'hiking'
  );
  const [complexity, setComplexity] = useState<GuideComplexityId>(
    initialPrefs.complexity ?? '2_ks'
  );
  const [completedNodeIds, setCompletedNodeIds] = useState<RoadmapNodeId[]>(
    Array.isArray(initialPrefs.completedNodeIds) ? initialPrefs.completedNodeIds : []
  );
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(
    Array.isArray(initialPrefs.completedTaskIds) ? initialPrefs.completedTaskIds : []
  );
  const [selectedNodeId, setSelectedNodeId] = useState<RoadmapNodeId | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<RoadmapNodeId | null>(null);
  const [viewMode, setViewMode] = useState<'full' | 'track_only'>('full');

  useEffect(() => {
    saveStoredPrefs({
      entryLevel,
      discipline,
      complexity,
      completedNodeIds,
      completedTaskIds,
    });
  }, [entryLevel, discipline, complexity, completedNodeIds, completedTaskIds]);

  const model = useMemo(
    () =>
      buildGuideLearningRoadmapGraph({
        entryLevel,
        discipline,
        complexity,
        completedNodeIds,
        completedTaskIds,
        selectedNodeId,
      }),
    [entryLevel, discipline, complexity, completedNodeIds, completedTaskIds, selectedNodeId]
  );

  const nodeById = useMemo(() => {
    const map = new Map<RoadmapNodeId, RoadmapGraphNode>();
    for (const node of model.nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [model.nodes]);

  const selectedNode = nodeById.get(model.selectedNodeId) ?? model.nodes[0];
  const focusNodeId = hoveredNodeId ?? selectedNode.id;

  const visibleNodes = useMemo(
    () =>
      viewMode === 'track_only'
        ? model.nodes.filter((n) => n.includedInTrack)
        : model.nodes,
    [model.nodes, viewMode]
  );

  const visibleEdges = useMemo(() => {
    const base =
      viewMode === 'track_only'
        ? model.edges.filter((e) => e.activeInTrack)
        : model.edges;
    // Render active/highlighted edges last so they sit cleanly above inactive strokes
    return [...base].sort((a, b) => {
      const aHot = a.from === focusNodeId || a.to === focusNodeId ? 2 : a.activeInTrack ? 1 : 0;
      const bHot = b.from === focusNodeId || b.to === focusNodeId ? 2 : b.activeInTrack ? 1 : 0;
      return aHot - bHot;
    });
  }, [model.edges, viewMode, focusNodeId]);

  const selectedTrackIndex = model.orderedTrackNodeIds.indexOf(selectedNode.id);
  const prevTrackNodeId =
    selectedTrackIndex > 0 ? model.orderedTrackNodeIds[selectedTrackIndex - 1] : null;
  const nextTrackNodeId =
    selectedTrackIndex >= 0 && selectedTrackIndex < model.orderedTrackNodeIds.length - 1
      ? model.orderedTrackNodeIds[selectedTrackIndex + 1]
      : null;

  const handleSelectNode = (nodeId: RoadmapNodeId) => {
    setSelectedNodeId(nodeId);
    const target = nodeById.get(nodeId);
    if (target) {
      tracker.trackCustomInteraction(`Граф обучения · ${target.code} ${target.shortTitle}`, 'learning');
    }
  };

  const handleToggleNodeComplete = (node: RoadmapGraphNode) => {
    if (!node.includedInTrack) return;
    const isAlreadyCompleted = node.state === 'completed';

    if (isAlreadyCompleted) {
      setCompletedNodeIds((prev) => prev.filter((id) => id !== node.id));
      const nodeTaskIds = new Set(node.tasks.map((t) => t.id));
      setCompletedTaskIds((prev) => prev.filter((id) => !nodeTaskIds.has(id)));
    } else {
      setCompletedNodeIds((prev) => (prev.includes(node.id) ? prev : [...prev, node.id]));
      setCompletedTaskIds((prev) => {
        const next = new Set(prev);
        for (const t of node.tasks) {
          next.add(t.id);
        }
        return Array.from(next);
      });
    }
    tracker.trackCustomInteraction(
      `Граф обучения · ${isAlreadyCompleted ? 'Снята отметка' : 'Этап пройден'}: ${node.shortTitle}`,
      'learning'
    );
  };

  const handleToggleTask = (node: RoadmapGraphNode, taskId: string) => {
    if (!node.includedInTrack) return;
    const isChecked = completedTaskIds.includes(taskId);
    const nextTaskIds = isChecked
      ? completedTaskIds.filter((id) => id !== taskId)
      : [...completedTaskIds, taskId];
    setCompletedTaskIds(nextTaskIds);

    const nextTaskSet = new Set(nextTaskIds);
    const allTasksDone = node.tasks.every((t) => nextTaskSet.has(t.id));
    if (allTasksDone) {
      setCompletedNodeIds((prev) => (prev.includes(node.id) ? prev : [...prev, node.id]));
    } else {
      setCompletedNodeIds((prev) => prev.filter((id) => id !== node.id));
    }
  };

  const handleResetProgress = () => {
    setCompletedNodeIds([]);
    setCompletedTaskIds([]);
    setSelectedNodeId('start_profile');
    tracker.trackCustomInteraction('Граф обучения · Сброс прогресса', 'learning');
  };

  const handleActionLink = (action: RoadmapNodeActionLink) => {
    tracker.trackCustomInteraction(`Граф обучения · Переход: ${action.label}`, 'learning');
    if (action.kind === 'exam') {
      if (onOpenExam) {
        onOpenExam();
        return;
      }
      onNavigateTab?.('preparation');
      return;
    }
    if (action.kind === 'library') {
      if (onOpenLibrary) {
        onOpenLibrary();
        return;
      }
      onNavigateTab?.('learning');
      return;
    }
    if (action.kind === 'certification') {
      if (onNavigateTab) {
        onNavigateTab('certification');
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'certification');
      window.history.pushState({ tab: 'certification' }, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const inspectorBadge = getStateInspectorBadge(selectedNode.state);
  const InspectorIcon = inspectorBadge.Icon;
  const hasAnyProgress = completedNodeIds.length > 0 || completedTaskIds.length > 0;

  return (
    <section
      aria-labelledby="guide-learning-roadmap-graph-heading"
      className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5"
    >
      {/* Header & View Mode Controls */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-700">
            <GitBranch className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Дорожная карта обучения проводника</span>
          </div>
          <h3
            id="guide-learning-roadmap-graph-heading"
            className="text-lg sm:text-xl font-bold text-slate-900 text-balance"
          >
            Интерактивный граф подготовки от новичка до аттестованного специалиста
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Выберите стартовый уровень, профиль туризма и целевую категорию — граф перестроит
            обязательные и альтернативные ветки обучения, сроки и чек-лист допуска к реестру ЕФРТА.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
          <div
            role="group"
            aria-label="Режим отображения графа"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setViewMode('full')}
              aria-pressed={viewMode === 'full'}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'full'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Полный граф
            </button>
            <button
              type="button"
              onClick={() => setViewMode('track_only')}
              aria-pressed={viewMode === 'track_only'}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'track_only'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Только мой трек
            </button>
          </div>

          {hasAnyProgress && (
            <button
              type="button"
              onClick={handleResetProgress}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span>Сбросить прогресс</span>
            </button>
          )}
        </div>
      </div>

      {/* Scenario Filter Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
        <div className="lg:col-span-5 space-y-1.5">
          <p className="text-xs font-semibold text-slate-700">Исходный уровень</p>
          <div
            role="group"
            aria-label="Исходный уровень подготовки"
            className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {GUIDE_ENTRY_LEVELS.map((lvl) => {
              const active = entryLevel === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setEntryLevel(lvl.id);
                    setSelectedNodeId(null);
                    tracker.trackCustomInteraction(`Граф обучения · Уровень: ${lvl.shortLabel}`, 'learning');
                  }}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors truncate cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lvl.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-1.5">
          <p className="text-xs font-semibold text-slate-700">Направление туризма</p>
          <div
            role="group"
            aria-label="Направление туризма"
            className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {GUIDE_DISCIPLINES.map((disc) => {
              const active = discipline === disc.id;
              return (
                <button
                  key={disc.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setDiscipline(disc.id);
                    tracker.trackCustomInteraction(`Граф обучения · Профиль: ${disc.shortLabel}`, 'learning');
                  }}
                  className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors truncate cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {disc.id === 'hiking'
                    ? 'Пешеходный'
                    : disc.id === 'water'
                      ? 'Водный'
                      : 'Экспедиции'}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-1.5">
          <p className="text-xs font-semibold text-slate-700">Целевая категория</p>
          <div
            role="group"
            aria-label="Целевая категория сложности"
            className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {GUIDE_COMPLEXITIES.map((comp) => {
              const active = complexity === comp.id;
              return (
                <button
                  key={comp.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setComplexity(comp.id);
                    tracker.trackCustomInteraction(`Граф обучения · Категория: ${comp.code}`, 'learning');
                  }}
                  className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {comp.code}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary Metrics Strip */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <dt className="text-[11px] font-medium text-slate-500">Трек подготовки</dt>
          <dd className="mt-0.5 text-sm font-bold text-slate-900">{model.levelMeta.contourCode}</dd>
          <p className="mt-0.5 text-[11px] text-slate-600 truncate">
            {model.levelMeta.contourTitle}
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <dt className="text-[11px] font-medium text-slate-500">Узлов в маршруте</dt>
          <dd className="mt-0.5 text-sm font-bold font-mono text-slate-900 tabular-nums">
            {model.totalTrackNodes} этапов
          </dd>
          <p className="mt-0.5 text-[11px] text-slate-600 truncate">
            {model.disciplineMeta.shortLabel} · {model.complexityMeta.code}
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <dt className="text-[11px] font-medium text-slate-500">Объём и ориентир срока</dt>
          <dd className="mt-0.5 text-sm font-bold font-mono text-teal-800 tabular-nums">
            ~{model.totalHours} ч · {model.estimatedWeeks} нед.
          </dd>
          <p className="mt-0.5 text-[11px] text-slate-600 tabular-nums">
            {model.totalDays} календарных дней с экзаменом
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <dt className="text-[11px] font-medium text-slate-500">Пройдено по графу</dt>
          <dd className="mt-0.5 flex items-baseline justify-between gap-2 text-sm font-bold font-mono text-slate-900 tabular-nums">
            <span>
              {model.completedTrackNodes} / {model.totalTrackNodes}
            </span>
            <span className="text-teal-800">{model.progressPercent}%</span>
          </dd>
          <div className="mt-1.5 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-700 transition-all duration-200 motion-reduce:transition-none"
              style={{ width: `${model.progressPercent}%` }}
            />
          </div>
        </div>
      </dl>

      {/* Two-Zone Sandbox: Graph Canvas + Node Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left Zone: Interactive Directed Graph */}
        <div className="xl:col-span-8 bg-slate-50/70 border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3">
          {/* Legend + Step Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                <span>Пройден</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>Текущий фокус</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Circle className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span>В маршруте</span>
              </span>
              {viewMode === 'full' && (
                <span className="inline-flex items-center gap-1.5">
                  <MinusCircle className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span>Альтернатива / зачёт</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={!prevTrackNodeId}
                onClick={() => prevTrackNodeId && handleSelectNode(prevTrackNodeId)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Предыдущий</span>
              </button>
              <button
                type="button"
                disabled={!nextTrackNodeId}
                onClick={() => nextTrackNodeId && handleSelectNode(nextTrackNodeId)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                <span>Следующий</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Responsive SVG Graph */}
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[840px]">
              <svg
                viewBox={`0 0 ${model.canvasWidth} ${model.canvasHeight}`}
                role="img"
                aria-label="Интерактивный граф этапов подготовки инструктора-проводника"
                className="w-full h-auto block select-none"
              >
                <defs>
                  <pattern
                    id="learning-roadmap-dot-grid"
                    width="24"
                    height="24"
                    patternUnits="userSpaceOnUse"
                  >
                    <circle cx="1.5" cy="1.5" r="1" fill="#CBD5E1" opacity="0.6" />
                  </pattern>

                  <marker
                    id="arrow-active"
                    viewBox="0 0 10 10"
                    refX="8.5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#0F766E" />
                  </marker>

                  <marker
                    id="arrow-traversed"
                    viewBox="0 0 10 10"
                    refX="8.5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#059669" />
                  </marker>

                  <marker
                    id="arrow-track"
                    viewBox="0 0 10 10"
                    refX="8.5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#64748B" />
                  </marker>

                  <marker
                    id="arrow-optional"
                    viewBox="0 0 10 10"
                    refX="8.5"
                    refY="5"
                    markerWidth="5.5"
                    markerHeight="5.5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#CBD5E1" />
                  </marker>
                </defs>

                {/* Background grid */}
                <rect
                  x="0"
                  y="0"
                  width={model.canvasWidth}
                  height={model.canvasHeight}
                  rx="8"
                  fill="url(#learning-roadmap-dot-grid)"
                />

                {/* Tier Column Labels */}
                {TIER_COLUMNS.map((col) => (
                  <text
                    key={col.tier}
                    x={col.x}
                    y={18}
                    fontSize="11"
                    fontWeight="600"
                    fill="#64748B"
                    fontFamily="'Plus Jakarta Sans', sans-serif"
                  >
                    {col.label}
                  </text>
                ))}

                {/* Directed Bezier Edges */}
                {visibleEdges.map((edge) => {
                  const isConnectedToFocus =
                    edge.from === focusNodeId || edge.to === focusNodeId;

                  let stroke = '#CBD5E1';
                  let strokeWidth = 1.4;
                  let dash: string | undefined = '5 4';
                  let markerEnd = 'url(#arrow-optional)';
                  let opacity = 0.65;

                  if (edge.activeInTrack) {
                    dash = undefined;
                    opacity = 1;
                    if (isConnectedToFocus) {
                      stroke = '#0F766E';
                      strokeWidth = 2.6;
                      markerEnd = 'url(#arrow-active)';
                    } else if (edge.traversed) {
                      stroke = '#059669';
                      strokeWidth = 2.1;
                      markerEnd = 'url(#arrow-traversed)';
                    } else {
                      stroke = '#64748B';
                      strokeWidth = 1.8;
                      markerEnd = 'url(#arrow-track)';
                    }
                  } else if (isConnectedToFocus) {
                    stroke = '#64748B';
                    strokeWidth = 1.8;
                    opacity = 0.9;
                  }

                  const fromNode = nodeById.get(edge.from);
                  const toNode = nodeById.get(edge.to);
                  const midX =
                    fromNode && toNode
                      ? (fromNode.x + fromNode.width + toNode.x) / 2
                      : 0;
                  const midY =
                    fromNode && toNode
                      ? (fromNode.y + fromNode.height / 2 + toNode.y + toNode.height / 2) / 2
                      : 0;

                  return (
                    <g key={edge.id} opacity={opacity}>
                      <path
                        d={edge.pathD}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeDasharray={dash}
                        markerEnd={markerEnd}
                        className="transition-all duration-200 motion-reduce:transition-none"
                      />
                      {edge.label && fromNode && toNode && (
                        <text
                          x={midX}
                          y={midY - 6}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="600"
                          fill={edge.activeInTrack ? '#0F766E' : '#94A3B8'}
                          stroke="#F8FAFC"
                          strokeWidth="4"
                          paintOrder="stroke"
                          fontFamily="'Plus Jakarta Sans', sans-serif"
                        >
                          {edge.label}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Interactive Stage Nodes */}
                {visibleNodes.map((node) => {
                  const isSelected = node.id === selectedNode.id;
                  const isHovered = node.id === hoveredNodeId;
                  const colors = getSvgNodeColors(node.state, isSelected, isHovered);

                  const metaLine =
                    node.includedInTrack
                      ? `${node.studyHours} ч · ${node.durationDays} дн.`
                      : node.stateLabel;

                  const statusGlyph =
                    node.state === 'completed'
                      ? '✓ Пройден'
                      : node.state === 'active'
                        ? '● Фокус'
                        : node.state === 'optional'
                          ? '— Зачтён'
                          : '○ Далее';

                  return (
                    <g
                      key={node.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`${node.code}. ${node.fullTitle} — ${node.stateLabel}`}
                      onClick={() => handleSelectNode(node.id)}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId((prev) => (prev === node.id ? null : prev))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectNode(node.id);
                        }
                      }}
                      className="cursor-pointer focus:outline-none"
                      opacity={colors.opacity}
                    >
                      {/* Outer focus/selected ring */}
                      {isSelected && (
                        <rect
                          x={node.x - 3}
                          y={node.y - 3}
                          width={node.width + 6}
                          height={node.height + 6}
                          rx="14"
                          fill="none"
                          stroke="#0F766E"
                          strokeOpacity="0.22"
                          strokeWidth="3"
                        />
                      )}

                      <rect
                        x={node.x}
                        y={node.y}
                        width={node.width}
                        height={node.height}
                        rx="11"
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth={colors.strokeWidth}
                        strokeDasharray={colors.strokeDasharray}
                      />

                      {/* Code & Status Row */}
                      <text
                        x={node.x + 12}
                        y={node.y + 20}
                        fontSize="11"
                        fontWeight="700"
                        fill={colors.codeFill}
                        fontFamily="'JetBrains Mono', monospace"
                      >
                        {node.code}
                      </text>
                      <text
                        x={node.x + node.width - 12}
                        y={node.y + 20}
                        textAnchor="end"
                        fontSize="10"
                        fontWeight="600"
                        fill={colors.stateFill}
                        fontFamily="'Plus Jakarta Sans', sans-serif"
                      >
                        {statusGlyph}
                      </text>

                      {/* 2-line Node Title */}
                      <text
                        x={node.x + 12}
                        y={node.y + 40}
                        fontSize="12"
                        fontWeight="700"
                        fill={colors.titleFill}
                        fontFamily="'Plus Jakarta Sans', sans-serif"
                      >
                        {node.titleLines[0]}
                      </text>
                      <text
                        x={node.x + 12}
                        y={node.y + 56}
                        fontSize="11.5"
                        fontWeight="500"
                        fill={colors.titleFill}
                        fontFamily="'Plus Jakarta Sans', sans-serif"
                      >
                        {node.titleLines[1]}
                      </text>

                      {/* Footer Meta Row */}
                      <text
                        x={node.x + 12}
                        y={node.y + 74}
                        fontSize="10.5"
                        fontWeight="600"
                        fill={colors.metaFill}
                        fontFamily="'JetBrains Mono', monospace"
                      >
                        {metaLine}
                      </text>

                      {node.includedInTrack && node.tasks.length > 0 && (
                        <text
                          x={node.x + node.width - 12}
                          y={node.y + 74}
                          textAnchor="end"
                          fontSize="10.5"
                          fontWeight="500"
                          fill="#64748B"
                          fontFamily="'JetBrains Mono', monospace"
                        >
                          {node.completedTasksCount}/{node.tasks.length}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Нажмите на любой узел графа, чтобы просмотреть требования, отметить выполненные пункты и
            отследить зависимости до аттестации в ЕФРТА.
          </p>
        </div>

        {/* Right Zone: Stage Inspector & Interactive Checklist */}
        <aside
          aria-label="Детали выбранного этапа графа"
          className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
        >
          <div className="space-y-4">
            {/* Inspector Header */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-mono text-slate-500 tabular-nums">
                  {selectedNode.code} · {selectedNode.trackRelationLabel}
                </p>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-md border ${inspectorBadge.surfaceClass} ${inspectorBadge.textClass}`}
                >
                  <InspectorIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{inspectorBadge.label}</span>
                </span>
              </div>

              <h4 className="text-base font-bold text-slate-900 leading-snug">
                {selectedNode.fullTitle}
              </h4>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 font-mono tabular-nums">
                <span>{selectedNode.roleTag}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {selectedNode.includedInTrack
                    ? `${selectedNode.studyHours} ч / ${selectedNode.durationDays} дн.`
                    : 'Не требуется в текущем треке'}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {selectedNode.summary}
            </p>

            {/* Deliverable */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Итог этапа
              </p>
              <p className="text-xs font-medium text-slate-900 leading-relaxed">
                {selectedNode.deliverable}
              </p>
            </div>

            {/* Interactive Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900">Задачи этапа</span>
                {selectedNode.includedInTrack && (
                  <span className="font-mono text-slate-500 tabular-nums">
                    {selectedNode.completedTasksCount} из {selectedNode.tasks.length}
                  </span>
                )}
              </div>

              <ul className="space-y-2">
                {selectedNode.tasks.map((task) => {
                  const checked = completedTaskIds.includes(task.id);
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        disabled={!selectedNode.includedInTrack}
                        onClick={() => handleToggleTask(selectedNode, task.id)}
                        className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors ${
                          !selectedNode.includedInTrack
                            ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                            : checked
                              ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300 cursor-pointer'
                              : 'bg-white border-slate-200 hover:border-teal-300 cursor-pointer'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            checked
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-slate-300 text-transparent'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                        </span>
                        <span className="min-w-0 space-y-0.5">
                          <span
                            className={`block text-xs font-medium leading-snug ${
                              checked ? 'text-slate-600 line-through' : 'text-slate-900'
                            }`}
                          >
                            {task.label}
                          </span>
                          <span className="block text-[11px] text-slate-500 leading-snug">
                            {task.hint}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Graph Connections (Prerequisites & Next Steps) */}
            <div className="pt-1 space-y-2 border-t border-slate-100">
              {selectedNode.prerequisites.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-slate-500">Зависит от этапов:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNode.prerequisites.map((preId) => {
                      const pre = nodeById.get(preId);
                      if (!pre) return null;
                      return (
                        <button
                          key={pre.id}
                          type="button"
                          onClick={() => handleSelectNode(pre.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                        >
                          <span className="font-mono text-slate-500">{pre.code}</span>
                          <span>{pre.shortTitle}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedNode.nextNodes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-slate-500">Открывает переход к:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNode.nextNodes.map((nextId) => {
                      const nxt = nodeById.get(nextId);
                      if (!nxt) return null;
                      return (
                        <button
                          key={nxt.id}
                          type="button"
                          onClick={() => handleSelectNode(nxt.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-teal-50 hover:bg-teal-100 text-teal-900 rounded-md transition-colors cursor-pointer"
                        >
                          <span className="font-mono text-teal-700">{nxt.code}</span>
                          <span>{nxt.shortTitle}</span>
                          <ChevronRight className="w-3 h-3 text-teal-700" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Primary Actions */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            {selectedNode.includedInTrack && (
              <button
                type="button"
                onClick={() => handleToggleNodeComplete(selectedNode)}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedNode.state === 'completed'
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                    : 'bg-teal-700 hover:bg-teal-800 text-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {selectedNode.state === 'completed'
                    ? 'Снять отметку о прохождении'
                    : 'Отметить этап пройденным'}
                </span>
              </button>
            )}

            {selectedNode.actionLink && (
              <button
                type="button"
                onClick={() => handleActionLink(selectedNode.actionLink!)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-white border border-slate-300 hover:border-teal-500 text-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                {selectedNode.actionLink.kind === 'exam' && (
                  <GraduationCap className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                )}
                {selectedNode.actionLink.kind === 'library' && (
                  <BookOpen className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                )}
                {selectedNode.actionLink.kind === 'certification' && (
                  <CalendarDays className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                )}
                <span>{selectedNode.actionLink.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
              </button>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};
