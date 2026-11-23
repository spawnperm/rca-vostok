import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDfoD3MapLayout,
  createDfoD3ColorScale,
  createDfoD3RadiusScale,
  formatDfoSubjectMetricLabel,
  getDfoSubjectMetricValue,
} from '../src/utils/dfoD3MapData.ts';

test('buildDfoD3MapLayout projects all DFO subjects with valid SVG paths and centroids inside bounds', () => {
  const layout = buildDfoD3MapLayout(760, 480);

  assert.equal(layout.subjects.length, 7);
  assert.ok(layout.graticulePath.length > 20);
  assert.ok(layout.totalRegistry > 500);
  assert.ok(layout.totalDemand > layout.totalRegistry);

  for (const subject of layout.subjects) {
    assert.ok(subject.pathData.startsWith('M'), `Expected valid SVG path for ${subject.id}`);
    assert.ok(subject.pathData.length > 20);
    assert.ok(Number.isFinite(subject.centroid[0]) && subject.centroid[0] >= 0 && subject.centroid[0] <= 760);
    assert.ok(Number.isFinite(subject.centroid[1]) && subject.centroid[1] >= 0 && subject.centroid[1] <= 480);
    assert.ok(subject.deficit >= 0);
    assert.ok(subject.coveragePct > 0 && subject.coveragePct <= 100);
  }
});

test('D3 color and radius scales map metrics consistently across modes', () => {
  const layout = buildDfoD3MapLayout(760, 480);

  for (const mode of ['registry', 'deficit', 'coveragePct'] as const) {
    const colorScale = createDfoD3ColorScale(layout.subjects, mode);
    const radiusScale = createDfoD3RadiusScale(layout.subjects, mode);

    for (const s of layout.subjects) {
      const v = getDfoSubjectMetricValue(s, mode);
      const c = colorScale(v);
      const r = radiusScale(v);
      assert.ok(typeof c === 'string' && c.length > 3);
      assert.ok(Number.isFinite(r) && r >= 10 && r <= 26.5);
      assert.ok(formatDfoSubjectMetricLabel(s, mode).length > 0);
    }
  }
});
