// Lorn II's shapes (src/levels/wood-kit.js; docs/systems/references.md, "Lorn II's sheets"): roots as tangles,
// cave mouths framed in roots, bank bushes of leaf clumps, the nest in the great cap; the roots' and bushes'
// dense hatching; the world's nest, cave frame and collision budget (tests/perdide2.test.js holds the budget).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { braid, caveFrame, bankBush, nest } from '../src/levels/wood-kit.js';
import { HATCH_DENSE } from '../src/materials.js';
import { ROOT_INK, BUSH_INK } from '../src/levels/perdide2.js';
import { LORN_VIEWS } from '../src/levels/reference-lorn.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const box = (list) => { const b = new THREE.Box3(); for (const g of list) { g.computeBoundingBox(); b.union(g.boundingBox); } return b; };

test('a root is a tangle of strands that keep to its course', () => {
  const pts = [V(0, 0, 0), V(10, 6, 0), V(20, 0, 0)], strands = braid(pts, 1, { n: 5, seed: 2 });
  assert.equal(strands.length, 5);
  const b = box(strands);
  assert.ok(b.min.x > -3 && b.max.x < 23 && b.max.y < 8.5 && b.max.z < 3 && b.min.z > -3, JSON.stringify(b));
});

test('a cave mouth is framed in roots over a dark hollow, open at its mouth', () => {
  const F = caveFrame({ r: 5, glow: true, seed: 1 });
  assert.ok(F.roots.length > 20 && F.hang.length === 14 && F.dark.length === 1 && F.glow.length === 1 && F.face);
  // nothing of the frame stands in the mouth itself (the hanging roots excepted): a clear way in at the traveller's height
  const ray = new THREE.Raycaster(V(0, 1.6, 12), V(0, 0, -1));
  const hits = ray.intersectObjects(F.roots.map((g) => new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))));
  assert.ok(!hits.length || hits[0].point.z < -5, hits[0]?.point && JSON.stringify(hits[0].point));
  // the hollow is a half-tunnel above the ground, its faces looking in
  const t = F.dark[0]; t.computeBoundingBox();
  assert.ok(t.boundingBox.min.y > -0.01 && t.boundingBox.max.y > 6 && t.boundingBox.max.z <= 0.01);
});

test('a bank bush is a low mass of leaf clumps; the nest is a bowl of eggs under its ribs', () => {
  const b = bankBush(3); b.computeBoundingBox();
  assert.ok(b.index && b.boundingBox.max.y < 0.9 && b.boundingBox.max.x > 0.8);
  const N = nest(4, { eggs: 20 });
  assert.equal(N.eggs.length, 20);
  for (const [x, , z] of N.eggs) assert.ok(Math.hypot(x, z) < 4 * 0.75);
  assert.ok(N.bowl.length >= 5 && N.ribs.length >= 8);
});

test('roots and bushes are drawn as dense hatched masses (a hatch over 1), never spot black', () => {
  assert.ok(ROOT_INK.hatch > 1 && BUSH_INK.hatch > 1 && ROOT_INK.spot === 0 && BUSH_INK.spot === 0);
  assert.ok(HATCH_DENSE.closer > 1 && HATCH_DENSE.closer < 1.6, 'never finer than a pen can draw');
});

test('the nest view sits its nest in the great cap', () => {
  const v = LORN_VIEWS.find((x) => x.id === '3797-nest-shroom');
  assert.ok(v && /nestParts/.test(String(v.build)));
});
