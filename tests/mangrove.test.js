import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { whiteTree, podHouse, walkway, limb, glowSpots, MANGROVE_LOOK, MANGROVE_DAY } from '../src/levels/mangrove-kit.js';
import { Physics } from '../src/physics.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { SIDE } from '../src/levels/names.js';
import { mapEntries } from '../src/ship/starmap.js';
import { createMangrove, walkCourses, DECKED, ISLAND, MANGROVE_CONTENT } from '../src/levels/mangrove.js';

// ------------------------------------------------------------------ the world (src/levels/mangrove.js)
let world = null;
const built = () => world ??= (() => {
  const scene = new THREE.Scene(), w = console.warn; console.warn = () => {};
  try { const level = createMangrove(scene); return { scene, level, physics: new Physics(scene, level.ground) }; } finally { console.warn = w; }
})();

test('the White Mangrove: off the route, on the map from the start, reached by ?level=mangrove', () => {
  const L = LEVELS.find((l) => l.id === 'mangrove');
  assert.ok(L && L.hidden && !L.dev, 'a world, not on the route');
  assert.ok(SIDE.includes('mangrove') && !ORDER.includes('mangrove'));
  assert.equal(CONTENT.mangrove, MANGROVE_CONTENT);
  assert.ok(MANGROVE_CONTENT.story.manual, 'no story to follow: no beacon, and never in the way home');
  const entries = mapEntries({ order: ORDER, levels: LEVELS, side: SIDE, journal: { seen: () => false, storyDone: () => false }, current: 'desert', flag: () => undefined, home: () => true });
  const i = entries.findIndex((e) => e.id === 'mangrove');
  assert.equal(i, ORDER.length, 'after the route\'s worlds');
  assert.ok(entries[i].known && entries[i].side, 'charted, off the dotted line');
  assert.ok(entries.at(-1).home, 'home still last');
  assert.equal(mapEntries({ order: ORDER, levels: LEVELS, journal: null, current: 'desert', flag: () => undefined, home: () => false }).length, ORDER.length, 'no side worlds unless asked');
});

test('the White Mangrove builds: the island, the ship\'s site on dry ground, people from three worlds', () => {
  const { level } = built();
  assert.equal(level.id, 'mangrove');
  const g = (x, z) => level.ground.heightAt(x, z);
  assert.ok(g(level.shipSite.x, level.shipSite.z) > 0.5, 'the ship lands on the island, out of the water');
  assert.ok(Math.abs(level.spawn.y - g(level.spawn.x, level.spawn.z)) < 0.2 && level.spawn.y > 0.3, 'the traveller starts on the island');
  assert.ok(g(0, -40) < -2, 'the lake is deep enough to swim');
  assert.ok(level.lights.length > 100, 'lanterns along the walks and decks');
  assert.ok(level.spots.count > 5000, 'the lake\'s creatures');
  const named = MANGROVE_CONTENT.npcs.filter((p) => p.id).map((p) => p.id);
  assert.deepEqual(named.sort(), ['bram', 'fen', 'oyo'], 'Oyo of the market, Fen and Bram of the Deep Wood');
  for (const p of MANGROVE_CONTENT.npcs.filter((q) => q.talk)) assert.ok(p.talk.listen?.length >= 3 && !p.talk.nodes, `${p.id}: only words for the lake, no errands`);
});

test('the White Mangrove\'s walks, decks and stairs are flat, solid and clear of the roots', () => {
  const { physics } = built();
  let n = 0;
  for (const c of walkCourses()) {
    const curve = new THREE.CatmullRomCurve3(c.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal'), L = curve.getLength();
    for (let i = 0; i <= L; i += 0.7) {
      const p = curve.getPointAt(i / L).add(new THREE.Vector3(0.13, 0, 0.07)); n++;
      assert.ok(Math.abs(physics.groundAt(p.x, 4, p.z, 10) - 1.2) < 0.1, `a plank under the walk at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
      assert.equal(physics.pushCapsule(new THREE.Vector3(p.x, 1.25, p.z), 0.4, 0.6, 2.0), null, `nothing in the way at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
    }
  }
  for (const D of DECKED) {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, r = (D.inner + D.outer) / 2;
      assert.ok(Math.abs(physics.groundAt(D.x + Math.cos(a) * r + 0.07, D.deckY + 3, D.z + Math.sin(a) * r + 0.05, 10) - D.deckY) < 0.15, 'the deck round the trunk');
    }
    // up the stair: each step a little higher, from the platform to the deck
    let last = 1.2;
    for (let t = 0.05; t < 0.95; t += 0.05) {
      const d = D.outer + D.run * (1 - t), x = D.x + Math.cos(D.face) * d + 0.07, z = D.z + Math.sin(D.face) * d + 0.05, y = physics.groundAt(x, D.deckY + 2, z, D.deckY + 6);
      assert.ok(y >= last - 0.05 && y - last < 0.05 * D.run * 0.62 + 0.3, `the stair of the tree at ${D.x.toFixed(0)}, ${D.z.toFixed(0)} climbs (${y.toFixed(2)} after ${last.toFixed(2)} at ${t.toFixed(2)})`);
      last = y;
    }
  }
  assert.ok(n > 400);
  assert.ok(ISLAND.r > 20);
});

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
