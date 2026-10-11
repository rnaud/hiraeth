import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// The desert's sky: the plates' clean horizon (no cumulus bank, v0.63) with a few of the print's
// flat inked clouds drifting over it again, far apart; the reference views keep the plates' clear sky.

globalThis.document ??= { createElement: () => ({ getContext: () => null, style: {} }), body: {}, getElementById: () => null, querySelector: () => null };
const { createDesert } = await import('../src/levels/desert.js');
const { DESERT_LOOK, DESERT_WORLD_LOOK, DESERT_CLOUDS } = await import('../src/desert-sites.js');
const { PRESETS } = await import('../src/post.js');
const { WORLD_LOOKS } = await import('../src/levels/references.js');

test('the desert has a few clouds again, sparse, and still no cloud bank on the horizon', () => {
  const level = createDesert(new THREE.Scene());
  const look = level.defaults.look;
  assert.equal(level.defaults.preset, 'Moebius print');
  assert.equal(look, DESERT_WORLD_LOOK);
  assert.ok(look.uClouds > 0, 'clouds over the dunes');
  assert.ok(look.uClouds === DESERT_CLOUDS && DESERT_CLOUDS <= 0.35 && DESERT_CLOUDS < PRESETS['Moebius print'].uClouds, 'a few, far apart: fewer than the print preset’s cover');
  assert.equal(look.uCumulus, 0, 'no bank of cumulus on the horizon, as the plates');
  for (const k of Object.keys(DESERT_LOOK)) if (k !== 'uClouds') assert.deepEqual(look[k], DESERT_LOOK[k], `${k} as the plates’ look`);
});

test('the desert’s clouds cast no shadow on the sand: no blue band with no cast shadow in it (issue #66)', () => {
  const level = createDesert(new THREE.Scene());
  assert.equal(level.defaults.cloudShadows, 0, 'main.js sets uCloudShadows from it: 0, the cloud shadows off');
});

test('the desert\'s reference views keep their plates\' clean sky', () => {
  assert.equal(DESERT_LOOK.uClouds, 0);
  assert.equal(WORLD_LOOKS.desert.look.uClouds, 0);
});
