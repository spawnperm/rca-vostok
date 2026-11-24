import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Compass,
  Maximize2,
  Network,
  RotateCcw,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  COMPETENCY_CLUSTERS,
  COMPETENCY_CLUSTER_MAP,
  COMPETENCY_EDGES,
  COMPETENCY_NODES,
  COMPETENCY_PROFILES,
  COMPETENCY_RELATION_META,
  buildInstructorCompetencyGraphModel,
  getCompetencyConnections,
  type CompetencyClusterId,
  type CompetencyProfileId,
  type CompetencyRelationType,
  type ComputedCompetencyEdge,
  type ComputedCompetencyNode,
} from '../utils/instructorCompetencyGraph';
import { tracker } from '../utils/tracker';

export interface InstructorCompetencyGraphD3Props {
  onOpenExam?: () => void;
  onOpenGlossary?: () => void;
  onOpenLibrary?: () => void;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  cluster: CompetencyClusterId;
  radius: number;
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  source: string | SimNode;
  target: string | SimNode;
  type: CompetencyRelationType;
  strength: 1 | 2 | 3;
  label: string;
}

const CANVAS_WIDTH = 820;
const CANVAS_HEIGHT = 540;

const ALL_CLUSTERS: CompetencyClusterId[] = ['law', 'navigation', 'safety', 'specialization'];
const ALL_RELATIONS: CompetencyRelationType[] = ['prerequisite', 'synergy', 'attestation'];

function resolveLinkEndpoints(
  link: SimLink,
  nodeMap: Map<string, SimNode>
): { sourceNode: SimNode; targetNode: SimNode } | null {
  const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
  const targetId = typeof link.target === 'string' ? link.target : link.target.id;
  const sourceNode = nodeMap.get(sourceId);
  const targetNode = nodeMap.get(targetId);
  if (!sourceNode || !targetNode) return null;
  return { sourceNode, targetNode };
}

function computeCurvedLinkPath(source: SimNode, target: SimNode, type: CompetencyRelationType): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;

  const startOffset = source.radius + 3;
  const endOffset = target.radius + (type === 'prerequisite' ? 9 : 4);

  const sx = source.x + ux * startOffset;
  const sy = source.y + uy * startOffset;
  const tx = target.x - ux * endOffset;
  const ty = target.y - uy * endOffset;

  const curveFactor = type === 'prerequisite' ? 0.08 : type === 'synergy' ? -0.07 : 0.14;
  const mx = (sx + tx) / 2 - uy * dist * curveFactor;
  const my = (sy + ty) / 2 + ux * dist * curveFactor;

  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
}

export const InstructorCompetencyGraphD3: React.FC<InstructorCompetencyGraphD3Props> = ({
  onOpenExam,
  onOpenGlossary,
  onOpenLibrary,
}) => {
  const [profile, setProfile] = useState<CompetencyProfileId>('all');
  const [activeClusters, setActiveClusters] = useState<CompetencyClusterId[]>(ALL_CLUSTERS);
  const [activeRelations, setActiveRelations] = useState<CompetencyRelationType[]>(ALL_RELATIONS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('npa_efrta');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [layoutNonce, setLayoutNonce] = useState<number>(0);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomLayerRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);

  const model = useMemo(
    () =>
      buildInstructorCompetencyGraphModel({
        profile,
        clusters: activeClusters,
        relations: activeRelations,
        searchQuery,
      }),
    [profile, activeClusters, activeRelations, searchQuery]
  );

  const radiusScale = useMemo(() => {
    const maxScore = d3.max(model.nodes, (n) => n.totalDegree + n.examWeightPct * 0.25) ?? 10;
    return d3.scaleSqrt().domain([2, Math.max(maxScore, 8)]).range([18, 29]).clamp(true);
  }, [model.nodes]);

  const clusterColorScale = useMemo(
    () =>
      d3
        .scaleOrdinal<CompetencyClusterId, string>()
        .domain(ALL_CLUSTERS)
        .range(ALL_CLUSTERS.map((id) => COMPETENCY_CLUSTER_MAP[id].color)),
    []
  );

  const modelNodeMap = useMemo(() => {
    const map = new Map<string, ComputedCompetencyNode>();
    for (const node of model.nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [model.nodes]);

  const modelEdgeMap = useMemo(() => {
    const map = new Map<string, ComputedCompetencyEdge>();
    for (const edge of model.edges) {
      map.set(edge.id, edge);
    }
    return map;
  }, [model.edges]);

  const focusNodeId = hoveredNodeId ?? selectedNodeId;

  const connectedNodeIds = useMemo(() => {
    const set = new Set<string>([focusNodeId]);
    for (const edge of model.edges) {
      if (!edge.matchesFilter) continue;
      if (edge.source === focusNodeId) set.add(edge.target);
      if (edge.target === focusNodeId) set.add(edge.source);
    }
    return set;
  }, [focusNodeId, model.edges]);

  const selectedConnections = useMemo(
    () => getCompetencyConnections(selectedNodeId),
    [selectedNodeId]
  );

  const hoveredEdge = hoveredEdgeId ? modelEdgeMap.get(hoveredEdgeId) ?? null : null;
  const hoveredNode = hoveredNodeId ? modelNodeMap.get(hoveredNodeId) ?? null : null;

  // Keep selectedNodeId aligned when filtering leaves it inactive
  useEffect(() => {
    const current = modelNodeMap.get(selectedNodeId);
    if (current && current.matchesFilter) return;
    const firstActive = model.nodes.find((n) => n.matchesFilter);
    if (firstActive) {
      setSelectedNodeId(firstActive.id);
    }
  }, [model.nodes, modelNodeMap, selectedNodeId]);

  const updateDomPositions = useCallback(() => {
    if (!zoomLayerRef.current) return;
    const layer = d3.select(zoomLayerRef.current);
    const nodeById = new Map(simNodesRef.current.map((n) => [n.id, n]));

    layer
      .selectAll<SVGPathElement, SimLink>('path[data-competency-edge]')
      .attr('d', (d) => {
        const pair = resolveLinkEndpoints(d, nodeById);
        if (!pair) return '';
        return computeCurvedLinkPath(pair.sourceNode, pair.targetNode, d.type);
      });

    layer
      .selectAll<SVGGElement, SimNode>('g[data-competency-node]')
      .attr('transform', (d) => `translate(${d.x.toFixed(1)}, ${d.y.toFixed(1)})`);
  }, []);

  // Build & run D3 force simulation + bind drag & zoom behaviors
  useEffect(() => {
    const svgEl = svgRef.current;
    const layerEl = zoomLayerRef.current;
    if (!svgEl || !layerEl) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const simNodes: SimNode[] = COMPETENCY_NODES.map((node, index) => {
      const clusterMeta = COMPETENCY_CLUSTER_MAP[node.cluster];
      const computed = modelNodeMap.get(node.id);
      const radius = radiusScale(
        (computed?.totalDegree ?? 3) + node.examWeightPct * 0.25
      );
      const angle = (index / COMPETENCY_NODES.length) * Math.PI * 2;
      return {
        id: node.id,
        cluster: node.cluster,
        radius,
        x: clusterMeta.anchorXRatio * CANVAS_WIDTH + Math.cos(angle) * 48,
        y: clusterMeta.anchorYRatio * CANVAS_HEIGHT + Math.sin(angle) * 48,
      };
    });

    const simLinks: SimLink[] = COMPETENCY_EDGES.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      strength: edge.strength,
      label: edge.label,
    }));

    simNodesRef.current = simNodes;
    simLinksRef.current = simLinks;

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((d) => (d.type === 'prerequisite' ? 128 : d.type === 'synergy' ? 142 : 162))
          .strength((d) => (d.strength === 3 ? 0.36 : 0.22))
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-360))
      .force(
        'x',
        d3
          .forceX<SimNode>(
            (d) => COMPETENCY_CLUSTER_MAP[d.cluster].anchorXRatio * CANVAS_WIDTH
          )
          .strength(0.28)
      )
      .force(
        'y',
        d3
          .forceY<SimNode>(
            (d) => COMPETENCY_CLUSTER_MAP[d.cluster].anchorYRatio * CANVAS_HEIGHT
          )
          .strength(0.28)
      )
      .force(
        'collide',
        d3.forceCollide<SimNode>((d) => d.radius + 32).iterations(3)
      )
      .force('center', d3.forceCenter(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2).strength(0.06));

    // Pre-warm synchronously for instant stable positioning without scatter
    simulation.stop();
    for (let i = 0; i < 220; i += 1) {
      simulation.tick();
      for (const n of simNodes) {
        n.x = Math.max(68, Math.min(CANVAS_WIDTH - 68, n.x));
        n.y = Math.max(48, Math.min(CANVAS_HEIGHT - 56, n.y));
      }
    }

    simulationRef.current = simulation;

    const layer = d3.select(layerEl);

    layer
      .selectAll<SVGPathElement, SimLink>('path[data-competency-edge]')
      .data(simLinks, (d) => d.id);

    const nodeGroups = layer
      .selectAll<SVGGElement, SimNode>('g[data-competency-node]')
      .data(simNodes, (d) => d.id);

    updateDomPositions();

    const dragBehavior = d3
      .drag<SVGGElement, SimNode>()
      .clickDistance(4)
      .on('start', (event, d) => {
        if (!event.active && !prefersReducedMotion) {
          simulation.alphaTarget(0.22).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = Math.max(54, Math.min(CANVAS_WIDTH - 54, event.x));
        d.fy = Math.max(42, Math.min(CANVAS_HEIGHT - 48, event.y));
        if (prefersReducedMotion) {
          d.x = d.fx;
          d.y = d.fy;
          updateDomPositions();
        }
      })
      .on('end', (event, d) => {
        if (!event.active && !prefersReducedMotion) {
          simulation.alphaTarget(0);
        }
        d.fx = d.x;
        d.fy = d.y;
      });

    nodeGroups.call(dragBehavior);

    simulation.on('tick', () => {
      for (const n of simNodes) {
        n.x = Math.max(60, Math.min(CANVAS_WIDTH - 60, n.x));
        n.y = Math.max(44, Math.min(CANVAS_HEIGHT - 52, n.y));
      }
      updateDomPositions();
    });

    // D3 zoom & pan on canvas
    const svgSelection = d3.select(svgEl);
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.68, 2.2])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        layer.attr('transform', event.transform.toString());
        setZoomScale(Number(event.transform.k.toFixed(2)));
      });

    zoomBehaviorRef.current = zoomBehavior;
    svgSelection.call(zoomBehavior).on('dblclick.zoom', null);

    return () => {
      simulation.stop();
      svgSelection.on('.zoom', null);
    };
  }, [layoutNonce, radiusScale, updateDomPositions]);

  // Smoothly animate emphasis/dimming via D3 transitions on filter or focus change
  useEffect(() => {
    if (!zoomLayerRef.current) return;
    const layer = d3.select(zoomLayerRef.current);
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const duration = prefersReducedMotion ? 0 : 150;

    layer
      .selectAll<SVGPathElement, SimLink>('path[data-competency-edge]')
      .transition()
      .duration(duration)
      .attr('stroke-opacity', function () {
        const edgeId = this.getAttribute('data-competency-edge') ?? '';
        const edge = modelEdgeMap.get(edgeId);
        if (!edge || !edge.matchesFilter) return 0.08;
        const isConnected =
          edge.source === focusNodeId || edge.target === focusNodeId;
        if (hoveredEdgeId === edgeId) return 1;
        return isConnected ? 0.92 : 0.24;
      })
      .attr('stroke-width', function () {
        const edgeId = this.getAttribute('data-competency-edge') ?? '';
        const edge = modelEdgeMap.get(edgeId);
        if (!edge) return 1.2;
        const isConnected =
          edge.source === focusNodeId || edge.target === focusNodeId;
        if (hoveredEdgeId === edgeId) return 3.2;
        if (isConnected) return edge.strength === 3 ? 2.6 : 2.1;
        return edge.strength === 3 ? 1.6 : 1.2;
      });

    layer
      .selectAll<SVGGElement, SimNode>('g[data-competency-node]')
      .transition()
      .duration(duration)
      .attr('opacity', function () {
        const nodeId = this.getAttribute('data-competency-node') ?? '';
        const node = modelNodeMap.get(nodeId);
        if (!node || !node.matchesFilter) return 0.16;
        if (connectedNodeIds.has(nodeId)) return 1;
        return 0.42;
      });
  }, [connectedNodeIds, focusNodeId, hoveredEdgeId, modelEdgeMap, modelNodeMap]);

  const handleToggleCluster = (clusterId: CompetencyClusterId) => {
    setActiveClusters((prev) => {
      if (prev.includes(clusterId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== clusterId);
      }
      return [...prev, clusterId];
    });
    tracker.trackCustomInteraction(
      `Граф компетенций D3 · блок ${COMPETENCY_CLUSTER_MAP[clusterId].shortLabel}`,
      'learning'
    );
  };

  const handleToggleRelation = (relationId: CompetencyRelationType) => {
    setActiveRelations((prev) => {
      if (prev.includes(relationId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== relationId);
      }
      return [...prev, relationId];
    });
    tracker.trackCustomInteraction(
      `Граф компетенций D3 · связь ${COMPETENCY_RELATION_META[relationId].shortLabel}`,
      'learning'
    );
  };

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    const node = modelNodeMap.get(nodeId);
    if (node) {
      tracker.trackCustomInteraction(`Граф компетенций D3 · узел ${node.code}`, node.title);
    }
  };

  const handleUnpinNode = (nodeId: string) => {
    const simNode = simNodesRef.current.find((n) => n.id === nodeId);
    if (simNode) {
      simNode.fx = null;
      simNode.fy = null;
      simulationRef.current?.alpha(0.3).restart();
    }
  };

  const handleZoomBy = (factor: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(180)
      .call(zoomBehaviorRef.current.scaleBy, factor);
  };

  const handleResetView = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(200)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }
    setLayoutNonce((n) => n + 1);
  };

  const handleResetAllFilters = () => {
    setProfile('all');
    setActiveClusters(ALL_CLUSTERS);
    setActiveRelations(ALL_RELATIONS);
    setSearchQuery('');
    handleResetView();
  };

  const activeProfileMeta =
    COMPETENCY_PROFILES.find((p) => p.id === profile) ?? COMPETENCY_PROFILES[0];

  return (
    <section
      id="instructor-competency-graph-d3"
      aria-labelledby="competency-graph-d3-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 scroll-mt-24"
    >
      {/* Header + Profile Selector */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
            <Network className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Граф связей компетенций на D3.js · Программа ДПО ВВГУ и стандарт ФСТР</span>
          </div>
          <h3
            id="competency-graph-d3-heading"
            className="text-xl font-bold text-slate-900 text-balance"
          >
            Карта связей компетенций инструкторов-проводников
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Исследуйте, как правовые требования, навигация, полевая безопасность (WFA и ПСР) и
            профильные навыки 1–4 КС опираются друг на друга. Выберите узел, перетащите его на
            схеме или отфильтруйте по специализации.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Специализация инструктора-проводника"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start xl:self-auto"
        >
          {COMPETENCY_PROFILES.map((item) => {
            const active = profile === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setProfile(item.id);
                  tracker.trackCustomInteraction(
                    `Граф компетенций D3 · профиль ${item.shortLabel}`,
                    'learning'
                  );
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Cluster filter buttons */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Блоки компетенций">
            {COMPETENCY_CLUSTERS.map((cluster) => {
              const active = activeClusters.includes(cluster.id);
              const count = model.clusterCounts[cluster.id];
              return (
                <button
                  key={cluster.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleToggleCluster(cluster.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white border-slate-300 text-slate-900 shadow-2xs'
                      : 'bg-slate-100/80 border-slate-200 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: active ? cluster.color : '#94A3B8',
                    }}
                    aria-hidden="true"
                  />
                  <span>{cluster.shortLabel}</span>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search input */}
          <div className="relative w-full lg:w-72 shrink-0">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск компетенции, НПА или навыка..."
              aria-label="Поиск компетенции в графе"
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 text-xs">
          {/* Relation type toggles */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Типы связей между компетенциями">
            <span className="text-slate-500 font-medium">Типы связей:</span>
            {ALL_RELATIONS.map((relId) => {
              const meta = COMPETENCY_RELATION_META[relId];
              const active = activeRelations.includes(relId);
              return (
                <button
                  key={relId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleToggleRelation(relId)}
                  className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white border-slate-300 text-slate-800'
                      : 'bg-transparent border-slate-200 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden="true">
                    <line
                      x1="1"
                      y1="4"
                      x2="17"
                      y2="4"
                      stroke={active ? meta.stroke : '#94A3B8'}
                      strokeWidth="2"
                      strokeDasharray={meta.dashArray}
                    />
                  </svg>
                  <span>{meta.shortLabel}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-slate-600 font-mono tabular-nums text-[11px]">
            <span>
              Активных узлов: <strong className="text-slate-900">{model.activeNodeCount}</strong> /{' '}
              {COMPETENCY_NODES.length}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Связей: <strong className="text-slate-900">{model.activeEdgeCount}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Объём блока: <strong className="text-teal-800">{model.totalDpoHours} ч</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Zone Split: D3 Graph Stage (8 cols) + Competency Inspector (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Interactive D3 Force Graph */}
        <div className="lg:col-span-8 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3">
          {/* Canvas toolbar & live edge/node hover status */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="text-xs text-slate-600 min-w-0 truncate">
              {hoveredEdge ? (
                <span className="text-slate-900 font-medium">
                  {COMPETENCY_RELATION_META[hoveredEdge.type].shortLabel}: {hoveredEdge.label}
                </span>
              ) : hoveredNode ? (
                <span className="text-slate-900 font-medium">
                  {hoveredNode.code} · {hoveredNode.title} ({hoveredNode.totalDegree} связей)
                </span>
              ) : (
                <span>{activeProfileMeta.description}</span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleZoomBy(1.2)}
                aria-label="Увеличить масштаб графа"
                title="Приблизить"
                className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-700 hover:border-teal-600 hover:text-teal-800 transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => handleZoomBy(0.84)}
                aria-label="Уменьшить масштаб графа"
                title="Отдалить"
                className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-700 hover:border-teal-600 hover:text-teal-800 transition-colors cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                aria-label="Сбросить масштаб и перестроить раскладку графа"
                title="Сбросить вид"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-[11px] font-semibold text-slate-700 hover:border-teal-600 hover:text-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Maximize2 className="w-3 h-3" aria-hidden="true" />
                <span>Сброс ({Math.round(zoomScale * 100)}%)</span>
              </button>
            </div>
          </div>

          {/* D3 SVG Interactive Canvas */}
          <div className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              className="w-full h-auto block select-none cursor-grab active:cursor-grabbing"
              role="img"
              aria-label="Интерактивный граф связей компетенций инструкторов-проводников на D3.js"
            >
              <defs>
                <marker
                  id="comp-arrow-prereq"
                  viewBox="0 -5 10 10"
                  refX="8"
                  refY="0"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto"
                >
                  <path d="M0,-4.5L9,0L0,4.5Z" fill="#0F766E" />
                </marker>
                <marker
                  id="comp-arrow-prereq-muted"
                  viewBox="0 -5 10 10"
                  refX="8"
                  refY="0"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M0,-4.5L9,0L0,4.5Z" fill="#94A3B8" />
                </marker>
                <pattern
                  id="comp-grid-dots"
                  width="24"
                  height="24"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1.5" cy="1.5" r="0.9" fill="#E2E8F0" />
                </pattern>
              </defs>

              {/* Subtle dot grid background */}
              <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#comp-grid-dots)" />

              {/* Zoomable & Pannable D3 Layer */}
              <g ref={zoomLayerRef}>
                {/* Subtle cluster quadrant labels */}
                <g className="pointer-events-none">
                  {COMPETENCY_CLUSTERS.map((cluster) => (
                    <text
                      key={`quad-${cluster.id}`}
                      x={cluster.anchorXRatio * CANVAS_WIDTH}
                      y={cluster.anchorYRatio < 0.5 ? 24 : CANVAS_HEIGHT - 14}
                      textAnchor="middle"
                      className="text-[11px] font-semibold"
                      fill={cluster.color}
                      fillOpacity={activeClusters.includes(cluster.id) ? 0.72 : 0.28}
                    >
                      {cluster.label}
                    </text>
                  ))}
                </g>

                {/* Competency Relationship Edges */}
                <g>
                  {model.edges.map((edge) => {
                    const relMeta = COMPETENCY_RELATION_META[edge.type];
                    const isFocused =
                      edge.matchesFilter &&
                      (edge.source === focusNodeId || edge.target === focusNodeId);
                    const strokeColor =
                      !edge.matchesFilter
                        ? '#CBD5E1'
                        : isFocused || hoveredEdgeId === edge.id
                          ? relMeta.stroke
                          : '#64748B';

                    return (
                      <path
                        key={edge.id}
                        data-competency-edge={edge.id}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={edge.strength === 3 ? 2.2 : 1.5}
                        strokeDasharray={relMeta.dashArray}
                        strokeLinecap="round"
                        markerEnd={
                          edge.type === 'prerequisite'
                            ? isFocused
                              ? 'url(#comp-arrow-prereq)'
                              : 'url(#comp-arrow-prereq-muted)'
                            : undefined
                        }
                        onMouseEnter={() => setHoveredEdgeId(edge.id)}
                        onMouseLeave={() => setHoveredEdgeId(null)}
                        className="cursor-pointer"
                      >
                        <title>
                          {relMeta.label}: {edge.label}
                        </title>
                      </path>
                    );
                  })}
                </g>

                {/* Competency Nodes */}
                <g>
                  {model.nodes.map((node) => {
                    const radius = radiusScale(node.totalDegree + node.examWeightPct * 0.25);
                    const clusterColor = clusterColorScale(node.cluster);
                    const isSelected = selectedNodeId === node.id;
                    const isHovered = hoveredNodeId === node.id;
                    const isNeighbor = connectedNodeIds.has(node.id);
                    const clusterMeta = COMPETENCY_CLUSTER_MAP[node.cluster];

                    return (
                      <g
                        key={node.id}
                        data-competency-node={node.id}
                        tabIndex={0}
                        role="button"
                        aria-pressed={isSelected}
                        aria-label={`${node.code} ${node.title}. Связей: ${node.totalDegree}, часов ДПО: ${node.dpoHours}`}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        onFocus={() => setHoveredNodeId(node.id)}
                        onBlur={() => setHoveredNodeId(null)}
                        onClick={() => handleSelectNode(node.id)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleUnpinNode(node.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectNode(node.id);
                          }
                        }}
                        className="cursor-pointer focus:outline-none"
                      >
                        {(isSelected || isHovered) && (
                          <circle
                            r={radius + 6}
                            fill="none"
                            stroke={clusterColor}
                            strokeWidth={isSelected ? 2.4 : 1.6}
                            strokeDasharray={isSelected ? undefined : '3 2'}
                            strokeOpacity={0.85}
                          />
                        )}

                        <circle
                          r={radius}
                          fill={isSelected ? clusterColor : clusterMeta.softBg}
                          stroke={clusterColor}
                          strokeWidth={isSelected ? 2.6 : isNeighbor ? 2 : 1.4}
                        />

                        {/* Node code inside circle */}
                        <text
                          y={-2}
                          textAnchor="middle"
                          className="text-[10px] font-mono font-bold pointer-events-none"
                          fill={isSelected ? '#FFFFFF' : clusterMeta.textColor}
                        >
                          {node.code}
                        </text>

                        {/* Degree badge inside bottom of circle */}
                        <text
                          y={11}
                          textAnchor="middle"
                          className="text-[9px] font-mono pointer-events-none"
                          fill={isSelected ? '#E2E8F0' : '#475569'}
                        >
                          {node.totalDegree} св.
                        </text>

                        {/* Readable label below node */}
                        <text
                          y={radius + 14}
                          textAnchor="middle"
                          className={`text-[11px] pointer-events-none ${
                            isSelected || isHovered
                              ? 'fill-slate-950 font-bold'
                              : 'fill-slate-800 font-semibold'
                          }`}
                          style={{
                            paintOrder: 'stroke',
                            stroke: 'rgba(255, 255, 255, 0.94)',
                            strokeWidth: 4,
                            strokeLinejoin: 'round',
                          }}
                        >
                          {node.shortLabel}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </g>
            </svg>

            {model.activeNodeCount === 0 && (
              <div className="absolute inset-0 bg-white/92 flex flex-col items-center justify-center p-6 text-center gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  По заданным фильтрам компетенции не найдены
                </p>
                <p className="text-xs text-slate-600 max-w-sm">
                  Ослабьте поисковый запрос или включите дополнительные блоки и профили подготовки.
                </p>
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Сбросить фильтры</span>
                </button>
              </div>
            )}
          </div>

          {/* Graph Mechanics Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              Раскладка D3.js: <code className="font-mono">d3.forceSimulation</code>,{' '}
              <code className="font-mono">d3.scaleSqrt</code> (радиус по числу связей и весу в
              экзамене), <code className="font-mono">d3.drag</code> и{' '}
              <code className="font-mono">d3.zoom</code>.
            </span>
            <span>Перетащите узел для фиксации · двойной клик открепляет</span>
          </div>
        </div>

        {/* Right Live Competency Inspector (4 cols) */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-5">
          {selectedConnections ? (
            <div className="space-y-4">
              {/* Unboxed editorial metadata + title */}
              <div className="space-y-1.5 border-b border-slate-200 pb-3.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span
                    className="font-semibold"
                    style={{ color: selectedConnections.cluster.color }}
                  >
                    {selectedConnections.cluster.shortLabel}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{selectedConnections.node.code}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {selectedConnections.totalConnections} связей
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900 leading-snug">
                  {selectedConnections.node.title}
                </h4>
                <p className="text-xs text-slate-500">{selectedConnections.node.legalRef}</p>
              </div>

              {/* Quantitative Rigor Metrics */}
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <dt className="text-[11px] text-slate-500">Часы ДПО</dt>
                  <dd className="mt-0.5 text-sm font-bold font-mono text-slate-900 tabular-nums">
                    {selectedConnections.node.dpoHours} ч
                  </dd>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <dt className="text-[11px] text-slate-500">Вес в билете</dt>
                  <dd className="mt-0.5 text-sm font-bold font-mono text-teal-800 tabular-nums">
                    {selectedConnections.node.examWeightPct}%
                  </dd>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <dt className="text-[11px] text-slate-500">Контур связей</dt>
                  <dd className="mt-0.5 text-sm font-bold font-mono text-slate-900 tabular-nums">
                    {selectedConnections.neighborhoodHours} ч
                  </dd>
                </div>
              </dl>

              <p className="text-xs text-slate-700 leading-relaxed">
                {selectedConnections.node.summary}
              </p>

              {/* Key Practical Skills */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-900">Проверяемые навыки:</p>
                <ul className="space-y-1">
                  {selectedConnections.node.skills.map((skill) => (
                    <li
                      key={skill}
                      className="text-xs text-slate-600 leading-relaxed flex items-start gap-2"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: selectedConnections.cluster.color }}
                        aria-hidden="true"
                      />
                      <span>{skill}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Connected Competencies Navigation */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                {selectedConnections.prerequisites.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-teal-800">
                      Опирается на ({selectedConnections.prerequisites.length}):
                    </p>
                    <div className="space-y-1">
                      {selectedConnections.prerequisites.map((item) => (
                        <button
                          key={item.edgeId}
                          type="button"
                          onClick={() => handleSelectNode(item.node.id)}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-900">
                            <span className="truncate">{item.node.shortLabel}</span>
                            <span className="font-mono text-[10px] text-slate-500 shrink-0">
                              {item.node.code}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{item.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedConnections.unlocks.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-teal-800">
                      Открывает и обосновывает ({selectedConnections.unlocks.length}):
                    </p>
                    <div className="space-y-1">
                      {selectedConnections.unlocks.map((item) => (
                        <button
                          key={item.edgeId}
                          type="button"
                          onClick={() => handleSelectNode(item.node.id)}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-900">
                            <span className="truncate">{item.node.shortLabel}</span>
                            <span className="font-mono text-[10px] text-slate-500 shrink-0">
                              {item.node.code}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{item.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedConnections.synergies.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-sky-800">
                      Связка на маршруте ({selectedConnections.synergies.length}):
                    </p>
                    <div className="space-y-1">
                      {selectedConnections.synergies.map((item) => (
                        <button
                          key={item.edgeId}
                          type="button"
                          onClick={() => handleSelectNode(item.node.id)}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-900">
                            <span className="truncate">{item.node.shortLabel}</span>
                            <span className="font-mono text-[10px] text-slate-500 shrink-0">
                              {item.node.code}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{item.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedConnections.attestationLinks.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-amber-800">
                      Совместная проверка РЦА ({selectedConnections.attestationLinks.length}):
                    </p>
                    <div className="space-y-1">
                      {selectedConnections.attestationLinks.map((item) => (
                        <button
                          key={item.edgeId}
                          type="button"
                          onClick={() => handleSelectNode(item.node.id)}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-900">
                            <span className="truncate">{item.node.shortLabel}</span>
                            <span className="font-mono text-[10px] text-slate-500 shrink-0">
                              {item.node.code}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{item.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Action Bridges into Learning Section Subtabs */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
            {onOpenExam && (
              <button
                type="button"
                onClick={onOpenExam}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BookOpenCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Тренажёр ФСТР</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
            {onOpenGlossary && (
              <button
                type="button"
                onClick={onOpenGlossary}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:border-teal-600 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>Глоссарий</span>
              </button>
            )}
            {onOpenLibrary && (
              <button
                type="button"
                onClick={onOpenLibrary}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:border-teal-600 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>Литература</span>
              </button>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};
