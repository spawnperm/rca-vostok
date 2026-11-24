import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGuideLearningRoadmapGraph,
  getOrderedTrackNodeIds,
  GUIDE_COMPLEXITIES,
  type RoadmapNodeId,
} from '../src/utils/guideLearningRoadmapGraph.ts';

describe('guideLearningRoadmapGraph engine', () => {
  it('routes novice through ДПО (Контур Б), specialist through Стаж МКК (Контур А), and experienced through both', () => {
    const novice = buildGuideLearningRoadmapGraph({
      entryLevel: 'novice',
      discipline: 'hiking',
      complexity: '2_ks',
    });
    const experienced = buildGuideLearningRoadmapGraph({
      entryLevel: 'experienced',
      discipline: 'hiking',
      complexity: '2_ks',
    });
    const specialist = buildGuideLearningRoadmapGraph({
      entryLevel: 'specialist',
      discipline: 'hiking',
      complexity: '2_ks',
    });

    const noviceDpo = novice.nodes.find((n) => n.id === 'track_dpo')!;
    const noviceStazh = novice.nodes.find((n) => n.id === 'track_stazh')!;
    assert.equal(noviceDpo.includedInTrack, true);
    assert.equal(noviceStazh.includedInTrack, false);
    assert.equal(noviceStazh.state, 'optional');

    const specDpo = specialist.nodes.find((n) => n.id === 'track_dpo')!;
    const specStazh = specialist.nodes.find((n) => n.id === 'track_stazh')!;
    assert.equal(specDpo.includedInTrack, false);
    assert.equal(specDpo.state, 'optional');
    assert.equal(specStazh.includedInTrack, true);

    const expDpo = experienced.nodes.find((n) => n.id === 'track_dpo')!;
    const expStazh = experienced.nodes.find((n) => n.id === 'track_stazh')!;
    assert.equal(expDpo.includedInTrack, true);
    assert.equal(expStazh.includedInTrack, true);

    assert.ok(specialist.totalHours < novice.totalHours);
    assert.ok(specialist.totalDays < novice.totalDays);
  });

  it('scales study hours and duration across 1 КС -> 4 КС and disciplines', () => {
    const graphs = GUIDE_COMPLEXITIES.map((c) =>
      buildGuideLearningRoadmapGraph({
        entryLevel: 'novice',
        discipline: 'hiking',
        complexity: c.id,
      })
    );

    for (let i = 1; i < graphs.length; i++) {
      assert.ok(graphs[i].totalHours > graphs[i - 1].totalHours);
      assert.ok(graphs[i].totalDays >= graphs[i - 1].totalDays);
    }

    const hiking = graphs[1];
    const water = buildGuideLearningRoadmapGraph({
      entryLevel: 'novice',
      discipline: 'water',
      complexity: '2_ks',
    });
    const expedition = buildGuideLearningRoadmapGraph({
      entryLevel: 'novice',
      discipline: 'expedition',
      complexity: '2_ks',
    });

    assert.ok(water.totalHours > hiking.totalHours);
    assert.ok(expedition.totalHours > water.totalHours);
  });

  it('places all 10 nodes within canvas bounds with non-overlapping rectangles and valid Bezier edges', () => {
    const model = buildGuideLearningRoadmapGraph({
      entryLevel: 'experienced',
      discipline: 'expedition',
      complexity: '3_ks',
    });

    assert.equal(model.nodes.length, 10);
    assert.equal(model.edges.length, 15);

    for (let i = 0; i < model.nodes.length; i++) {
      const a = model.nodes[i];
      assert.ok(a.x >= 0 && a.x + a.width <= model.canvasWidth);
      assert.ok(a.y >= 0 && a.y + a.height <= model.canvasHeight);

      for (let j = i + 1; j < model.nodes.length; j++) {
        const b = model.nodes[j];
        const overlapsX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapsY = a.y < b.y + b.height && a.y + a.height > b.y;
        assert.equal(
          overlapsX && overlapsY,
          false,
          `Nodes ${a.id} and ${b.id} must not overlap`
        );
      }
    }

    for (const edge of model.edges) {
      assert.match(edge.pathD, /^M \d+ (\d+|\d+\.\d+) C /);
      const fromNode = model.nodes.find((n) => n.id === edge.from)!;
      const toNode = model.nodes.find((n) => n.id === edge.to)!;
      assert.ok(fromNode.tier < toNode.tier, `Edge ${edge.id} must advance left-to-right`);
    }
  });

  it('advances active node, marks traversed edges, and supports task-based completion', () => {
    const startTasks = buildGuideLearningRoadmapGraph({
      entryLevel: 'novice',
      discipline: 'hiking',
      complexity: '1_ks',
    })
      .nodes.find((n) => n.id === 'start_profile')!
      .tasks.map((t) => t.id);

    const model = buildGuideLearningRoadmapGraph({
      entryLevel: 'novice',
      discipline: 'hiking',
      complexity: '1_ks',
      completedTaskIds: startTasks,
    });

    const startNode = model.nodes.find((n) => n.id === 'start_profile')!;
    const dpoNode = model.nodes.find((n) => n.id === 'track_dpo')!;
    assert.equal(startNode.state, 'completed');
    assert.equal(model.activeNodeId, 'track_dpo');
    assert.equal(dpoNode.state, 'active');

    const startToDpoEdge = model.edges.find((e) => e.id === 'start_profile->track_dpo')!;
    assert.equal(startToDpoEdge.activeInTrack, true);
    assert.equal(startToDpoEdge.traversed, true);

    const ordered = getOrderedTrackNodeIds('novice') as RoadmapNodeId[];
    const allCompleted = buildGuideLearningRoadmapGraph({
      entryLevel: 'novice',
      discipline: 'hiking',
      complexity: '1_ks',
      completedNodeIds: ordered,
    });
    assert.equal(allCompleted.progressPercent, 100);
    assert.equal(allCompleted.completedTrackNodes, ordered.length);
  });
});
