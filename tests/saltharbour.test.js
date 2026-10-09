import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { hull, portholes, houseStack, superstructure, cloth, curtain, gangway, rope, stall, archDoor, figure, SALT_LOOK, SALT_DAY } from '../src/levels/salt-harbour-kit.js';

const finite = (g) => { const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) return false; return true; };
const box = (list) => { const b = new THREE.Box3(); for (const g of list) { g.computeBoundingBox(); b.union(g.boundingBox); } return b; };

test('the Salt Harbour\'s pictures: four views, one per picture, in the References', async () => {
  const k = worldIndex('saltharbour');
  assert.ok(k >= 0, 'a References world');
  assert.equal(REFERENCE_WORLDS[k].name, 'The Salt Harbour');
  const w = await loadWorld(k);
  assert.equal(w.views.length, 4);
  assert.deepEqual(w.views.map((v) => v.sheet), ['saltharbour-1', 'saltharbour-2', 'saltharbour-3', 'saltharbour-4']);
  for (const v of w.views) {
    const S = w.sheets[v.sheet];
    assert.ok(S.name.startsWith('The Salt Harbour / '), 'the quick menu groups it under the world');
    assert.deepEqual(S.size, [1456, 816]);
    assert.deepEqual(v.crop, [0, 0, 1456, 816], 'the whole picture');
    assert.match(S.url, /The%20Salt%20Harbour\/environment\/reference-\d\.jpeg$|The Salt Harbour\/environment\/reference-\d\.jpeg$/);
  }
  assert.equal(SALT_DAY.length, 5);
  assert.equal(SALT_LOOK.uClouds, 0);
});

test('the harbour kit: a hull on its keel, white over terracotta, its side found where asked', () => {
  const H = hull({ L: 100, B: 30, D: 40, band: 10, top: 6, tumble: 0.2 });
  assert.ok(H.white.length >= 2 && H.red.length >= 4 && H.deck.length === 1, 'both sides, the bottom and the top band, the deck');
  assert.ok([...H.white, ...H.red, ...H.deck].every(finite));
  const b = box([...H.white, ...H.red]);
  assert.ok(Math.abs(b.min.y) < 0.01 && Math.abs(b.max.y - 40) < 0.01, 'from the keel to the gunwale');
  assert.ok(b.max.z > 49 && b.min.z < -49 && b.max.x > 14 && b.max.x < 17, 'as long and as wide as asked');
  // the red bottom stays under its line, the white above it
  assert.ok(box(H.red.slice(0, 1)).max.y <= 10.01 || box(H.red).max.y > 33, 'the band painted under 10 m');
  // a point of the side at a height: on the starboard side, its normal outward
  const { p, n } = H.at(0.5, 20);
  assert.ok(Math.abs(p.y - 20) < 0.05 && p.x > 10 && n.x > 0.7, 'the side at mid-length, 20 m up, facing out');
  // tumblehome: the side is widest under the gunwale
  assert.ok(H.at(0.5, 39.5).p.x < H.at(0.5, 22).p.x, 'drawn in again toward the gunwale');
  const U = hull({ L: 80, B: 20, D: 16, upright: true });
  const ub = box(U.white);
  assert.ok(ub.max.y > 79 && Math.abs(ub.min.y) < 0.01, 'stood on its stern: as tall as it is long');
  const P = portholes(H, { rows: [20, 30], step: 8 });
  assert.ok(P.dark.length + P.glow.length > 20 && P.rim.length === P.dark.length + P.glow.length);
});

test('the harbour kit: houses, upper works, sailcloth, gangways, ropes, shops, people', () => {
  const S = houseStack({ x0: -8, x1: 8, floors: 4, seed: 3 });
  assert.ok(S.wood.length > 20 && S.dark.length + S.glow.length > 8, 'cabins with doors and windows');
  assert.ok(S.decks.length > 0 && S.decks.every((d) => d.z > 1), 'balconies out in front');
  const U = superstructure({ tiers: 3 });
  assert.ok(U.white.length + U.red.length === 3 && U.rail.length > 8);
  const C = cloth([0, 10, 0], [10, 10, 0], [10, 10, 8], [0, 10, 8], { sag: 2 });
  assert.ok(finite(C));
  C.computeBoundingBox();
  assert.ok(C.boundingBox.min.y < 8.5 && C.boundingBox.max.y <= 10.6, 'it sags');
  const K = curtain([0, 20, 0], [10, 20, 0], 12);
  K.computeBoundingBox();
  assert.ok(finite(K) && K.boundingBox.min.y < 9, 'it hangs');
  const G = gangway([0, 30, 0], [20, 32, -5]);
  assert.ok(G.deck.length >= 6 && G.wood.length > 10 && G.dark.length > 10 && [...G.deck, ...G.wood, ...G.dark].every(finite));
  assert.ok(finite(rope([0, 20, 0], [5, 0, 5])));
  const T = stall({ w: 4 });
  assert.ok(T.wood.length && T.cloth.length === 1 && T.goods.flat().length > 4);
  const D = archDoor(0, 0, 0, new THREE.Vector3(0, 0, 1));
  assert.ok(D.dark.length === 1 && D.wood.length >= 3);
  const F = figure(0, 0, 0, { bundle: true });
  assert.ok(F.cloak.length >= 2 && F.bundle.length === 1);
});
