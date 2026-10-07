import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { whiteTree, podHouse, walkway, limb, glowSpots, MANGROVE_LOOK, MANGROVE_DAY } from '../src/levels/mangrove-kit.js';

const finite = (g) => { const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) return false; return true; };

test('the White Mangrove\'s pictures: four views, one per sheet, in the References', async () => {
  const k = worldIndex('mangrove');
  assert.ok(k >= 0, 'a References world');
  assert.equal(REFERENCE_WORLDS[k].name, 'The White Mangrove');
  const w = await loadWorld(k);
  assert.equal(w.views.length, 4);
  assert.deepEqual(w.views.map((v) => v.sheet), ['mangrove-1', 'mangrove-2', 'mangrove-3', 'mangrove-4']);
  for (const v of w.views) {
    const S = w.sheets[v.sheet];
    assert.ok(S.name.startsWith('The White Mangrove / '), 'the quick menu groups it under the world');
    assert.deepEqual(S.size, [1456, 816]);
    assert.deepEqual(v.crop, [0, 0, 1456, 816], 'the whole picture');
    assert.match(S.url, /The%20White%20Mangrove\/reference-\d\.jpeg$|The White Mangrove\/reference-\d\.jpeg$/);
  }
  assert.equal(MANGROVE_DAY.length, 5);
  assert.equal(MANGROVE_LOOK.uClouds, 0);
});

test('the mangrove kit: a white tree, its roots in the water, a house, a walk', () => {
  const T = whiteTree({ seed: 3, h: 20, r: 2.5, crown: 8, reach: 10 });
  const all = [...T.trunk, ...T.roots, ...T.limbs];
  assert.ok(T.roots.length >= 12 * 2, 'a dozen great roots and their fingers, and the feet between');
  assert.ok(all.every(finite));
  // every root reaches down into the water (y = 0) and out from the trunk
  const box = new THREE.Box3();
  for (const g of T.roots) { g.computeBoundingBox(); box.union(g.boundingBox); }
  assert.ok(box.min.y < -0.5 && box.max.x > 8 && box.min.x < -8, 'the roots spread round and stand in the water');
  assert.ok(T.forks.length >= 3 && T.forks.every((f) => f.y > 15), 'forks for houses up the tree');
  // a limb's shade strokes wrap round its own course, and its seam's two copies of a vertex share a normal
  const L = limb([new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 3, 0), new THREE.Vector3(10, 0, 0)], 1, 0.5, 20, 10);
  assert.ok(L.attributes.aFormC && L.attributes.aFormA);
  const N = L.attributes.normal;
  for (let i = 0; i <= 20; i++) { const a = i * 11, b = i * 11 + 10; assert.ok(Math.abs(N.getY(a) - N.getY(b)) < 1e-4 && Math.abs(N.getZ(a) - N.getZ(b)) < 1e-4, 'no crease along the seam'); }
  const H = podHouse({ R: 3 });
  assert.ok(H.shell.length && H.glow.length && H.wood.length && H.lamps.length === 1);
  const W = walkway([[0, 3, 0], [10, 3, -4], [20, 3, 0]], { lamp: 4 });
  assert.ok(W.planks.length > 30 && W.lamps.length >= 5 && W.planks.every(finite));
  const S = glowSpots(500, { x0: -10, x1: 10, z0: 0, z1: -40, tones: 3 });
  assert.equal(S.length, 3);
  assert.ok(S.flat().length > 400);
});
