import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPETENCY_EDGES,
  COMPETENCY_NODES,
  buildInstructorCompetencyGraphModel,
  getCompetencyConnections,
  getCompetencyNodeById,
} from '../src/utils/instructorCompetencyGraph.ts';

describe('instructorCompetencyGraph engine', () => {
  it('ensures every edge connects valid distinct nodes and every node has skills', () => {
    const ids = new Set(COMPETENCY_NODES.map((n) => n.id));
    assert.equal(ids.size, COMPETENCY_NODES.length);

    for (const node of COMPETENCY_NODES) {
      assert.ok(node.skills.length >= 3, `${node.id} should define at least 3 skills`);
      assert.ok(node.dpoHours > 0, `${node.id} should define positive dpoHours`);
      assert.ok(node.examWeightPct > 0, `${node.id} should define positive examWeightPct`);
    }

    for (const edge of COMPETENCY_EDGES) {
      assert.ok(ids.has(edge.source), `Missing source node ${edge.source}`);
      assert.ok(ids.has(edge.target), `Missing target node ${edge.target}`);
      assert.notEqual(edge.source, edge.target, `Self-loop on ${edge.id}`);
    }
  });

  it('filters competencies accurately by specialist profile (hiking vs water vs expedition)', () => {
    const allModel = buildInstructorCompetencyGraphModel({
      profile: 'all',
      clusters: ['law', 'navigation', 'safety', 'specialization'],
      relations: ['prerequisite', 'synergy', 'attestation'],
    });
    assert.equal(allModel.activeNodeCount, COMPETENCY_NODES.length);
    assert.equal(allModel.activeEdgeCount, COMPETENCY_EDGES.length);

    const waterModel = buildInstructorCompetencyGraphModel({
      profile: 'water',
      clusters: ['law', 'navigation', 'safety', 'specialization'],
      relations: ['prerequisite', 'synergy', 'attestation'],
    });

    const waterTech = waterModel.nodes.find((n) => n.id === 'water_tech')!;
    const hikingTech = waterModel.nodes.find((n) => n.id === 'hiking_tech')!;
    const riverCrossing = waterModel.nodes.find((n) => n.id === 'river_crossing')!;

    assert.equal(waterTech.matchesFilter, true);
    assert.equal(riverCrossing.matchesFilter, true);
    assert.equal(hikingTech.matchesFilter, false);
    assert.ok(waterModel.activeNodeCount < allModel.activeNodeCount);
    assert.ok(waterModel.activeEdgeCount < allModel.activeEdgeCount);
  });

  it('filters by clusters, relation types, and search query', () => {
    const wfaSearch = buildInstructorCompetencyGraphModel({
      profile: 'all',
      clusters: ['law', 'navigation', 'safety', 'specialization'],
      relations: ['prerequisite', 'synergy', 'attestation'],
      searchQuery: 'гипотерм',
    });
    const matched = wfaSearch.nodes.filter((n) => n.matchesFilter);
    assert.equal(matched.length, 1);
    assert.equal(matched[0].id, 'wfa_first_aid');

    const prereqOnly = buildInstructorCompetencyGraphModel({
      profile: 'all',
      clusters: ['law', 'navigation', 'safety', 'specialization'],
      relations: ['prerequisite'],
    });
    assert.ok(
      prereqOnly.edges
        .filter((e) => e.matchesFilter)
        .every((e) => e.type === 'prerequisite')
    );
  });

  it('computes directional prerequisites, unlocks, synergies, and attestation links for a node', () => {
    const passport = getCompetencyConnections('route_passport');
    assert.ok(passport);
    assert.equal(passport.node.id, 'route_passport');
    assert.ok(passport.prerequisites.some((p) => p.node.id === 'npa_efrta'));
    assert.ok(passport.unlocks.some((u) => u.node.id === 'mchs_ksr'));
    assert.ok(passport.attestationLinks.some((a) => a.node.id === 'hiking_tech'));
    assert.ok(passport.neighborhoodHours > passport.node.dpoHours);
    assert.equal(getCompetencyConnections('unknown_node'), null);
    assert.equal(getCompetencyNodeById('wfa_first_aid')?.code, 'БЕЗ-01');
  });
});
