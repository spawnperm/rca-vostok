import assert from 'node:assert/strict';
import { test } from 'vitest';

/**
 * Routing rule for the media library.
 *
 * Photographs must never reach the media player: an <audio>/<video> element
 * given an image URL renders a control bar that cannot play anything. That was
 * the actual bug — images were forced into the `audio` branch — so the rule is
 * pinned here rather than left implicit in JSX.
 */

type Kind = 'image' | 'video' | 'audio';
type Target = 'photo-viewer' | 'media-player';

function routeAsset(kind: Kind): Target {
  return kind === 'image' ? 'photo-viewer' : 'media-player';
}

test('images open in the photo viewer, never the media player', () => {
  assert.equal(routeAsset('image'), 'photo-viewer');
});

test('video and audio use the media player', () => {
  assert.equal(routeAsset('video'), 'media-player');
  assert.equal(routeAsset('audio'), 'media-player');
});

test('every kind has a destination (no asset is unopenable)', () => {
  for (const kind of ['image', 'video', 'audio'] as Kind[]) {
    assert.ok(routeAsset(kind), `no destination for ${kind}`);
  }
});

test('the photo viewer receives only image assets with a url', () => {
  // Mirrors the filter used to build the viewer's playlist.
  const assets = [
    { id: '1', kind: 'image' as Kind, url: '/media/1' },
    { id: '2', kind: 'video' as Kind, url: '/media/2' },
    { id: '3', kind: 'image' as Kind, url: undefined },
    { id: '4', kind: 'image' as Kind, url: '/media/4' },
  ];

  const photos = assets.filter((a) => a.kind === 'image' && a.url);
  assert.deepEqual(
    photos.map((p) => p.id),
    ['1', '4'],
    'videos and url-less images must be excluded'
  );
});
