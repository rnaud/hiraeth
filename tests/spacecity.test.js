// The City Floating in Space: its shapes (src/levels/space-city-kit.js), its space sky (post.js drawSpace) and its
// four References views (src/levels/reference-spacecity.js; docs/systems/references.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { spaceMats, island, bridge, quarter, heap, railing, pipeStack, outline, inPoly, SPACE_LOOK, SPACE_DAY, SPACE_SKY } from '../src/levels/space-city-kit.js';
import { sheetAt, sheetDir } from '../src/levels/reference-spacecity.js';
import { RoomKit } from '../src/levels/lab-kit.js';
import { PRESETS } from '../src/post.js';
import { mulberry32 } from '../src/noise.js';

const finite = (g) => { const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) return false; return true; };
const kitOf = () => new RoomKit({ group: new THREE.Group(), centre: new THREE.Vector3(), seed: 5 });

test('the City Floating in Space\'s pictures: four views, one per picture, in the References', async () => {
  const k = worldIndex('spacecity');
  assert.ok(k >= 0, 'a References world');
  assert.equal(k, worldIndex('underside') + 1, 'after the Underside (the views before it keep their numbers; newer worlds come after it)');
  assert.equal(REFERENCE_WORLDS[k].name, 'The City Floating in Space');
  const w = await loadWorld(k);
  assert.equal(w.views.length, 4);
  assert.deepEqual(w.views.map((v) => v.sheet), ['spacecity-1', 'spacecity-2', 'spacecity-3', 'spacecity-4']);
  assert.equal(new Set(w.views.map((v) => v.id)).size, 4);
  for (const v of w.views) {
    const S = w.sheets[v.sheet];
    assert.ok(S.name.startsWith('The City Floating in Space / '), 'the quick menu groups it under the world');
    assert.deepEqual(S.size, [1456, 816]);
    assert.deepEqual(v.crop, [0, 0, 1456, 816], 'the whole picture');
    assert.ok(v.ground.hidden, 'over the void: no ground drawn');
    assert.ok(v.ground.height(0, 50) < -500, 'nothing to stand on out in the void');
    // the planet where the picture has it: one, big, plain; its own light
    assert.equal(v.planets.length, 1);
    assert.ok(v.planets[0].size > 8 && v.planets[0].size < 80, `${v.id}: a great disc (${v.planets[0].size.toFixed(1)}°)`);
    assert.equal(v.planets[0].craters, false);
    assert.equal(v.look.uSpace[0], 1, 'space all round');
    assert.equal(v.look.uSpaceSun[3], 1, 'the planet lit by its own sun');
    assert.ok(Math.abs(Math.hypot(...v.look.uSpaceSun.slice(0, 3)) - 1) < 1e-6);
  }
});

test('the views are placed off the pictures\' pixels: the middle of the picture straight ahead', () => {
  const cam = { eye: [0, 1.8, 0], fov: 55, horizon: 0.5 };
  const p = sheetAt(cam, 728, 408, 30);
  assert.ok(Math.abs(p[0]) < 1e-9 && Math.abs(p[1] - 1.8) < 1e-9 && Math.abs(p[2] + 30) < 1e-9);
  const d = sheetDir(cam, 728, 0);
  assert.ok(Math.abs(Math.asin(d.y) * 180 / Math.PI - 27.5) < 1e-6, 'the top of the picture half the field of view up');
});

test('space all round: every preset turns it off, the city\'s look turns it on with a flat black sky', () => {
  for (const [name, p] of Object.entries(PRESETS)) {
    assert.deepEqual(p.uSpace, [0, 0, 0, 0], name);
    assert.deepEqual(p.uSpaceSun, [0, 1, 0, 0], name);
  }
  assert.equal(SPACE_LOOK.uSpace[0], 1);
  assert.equal(SPACE_LOOK.uSkyFlat, 1);
  assert.equal(SPACE_LOOK.uClouds + SPACE_LOOK.uCumulus + SPACE_LOOK.uSkyDots + SPACE_LOOK.uRays, 0, 'no clouds, no dots, no sun rays in space');
  assert.deepEqual(SPACE_SKY.uSpace, SPACE_LOOK.uSpace);
  assert.equal(SPACE_DAY.length, 5);
  const top = new THREE.Color(SPACE_DAY[0]), hor = new THREE.Color(SPACE_DAY[1]);
  assert.ok(top.getHSL({}).l < 0.05 && hor.getHSL({}).l < 0.05, 'black above and below');
});

test('an island: its deck solid, a parapet open at its gaps, the machinery under it drawn only', () => {
  const kit = kitOf(), M = spaceMats(kit), rng = mulberry32(3);
  const I = island(kit, M, rng, { x: 10, y: -8, z: -40, yaw: 0.4, w: 30, d: 24, gaps: [[15, 0, 4]], deep: 20 });
  assert.ok(I.inside(10, -40) && I.inside(10, -40, 6), 'its middle is on the deck');
  assert.ok(!I.inside(10, -80), 'off the island');
  // world ↔ local round trip
  const [wx, wz] = I.W(3, -2), [lx, lz] = I.toLocal(wx, wz);
  assert.ok(Math.abs(lx - 3) < 1e-9 && Math.abs(lz + 2) < 1e-9);
  let solid = 0, loose = 0;
  for (const b of kit.buckets.values()) for (const g of b.list) { assert.ok(finite(g)); if (b.solid) solid++; else loose++; }
  assert.ok(solid > 10 && loose > 10, 'deck and parapets solid; tanks, pipes and cables drawn only');
  assert.ok(kit.lights.length >= 1, 'lamps under it');
  // the outline: closed round its centre, inside it
  const pts = outline(20, 12, { cr: 4 });
  assert.ok(inPoly(pts, 0, 0) && inPoly(pts, 8, 3) && !inPoly(pts, 11, 0) && !inPoly(pts, 0, 7));
});

test('a bridge: its deck runs from end to end over the arch, its parapets along it', () => {
  const kit = kitOf(), M = spaceMats(kit);
  const B = bridge(kit, M, [0, -8, 0], [0, -8, -30], { hump: 0.6 });
  const a = B.at(0), m = B.at(0.5), b = B.at(1);
  assert.ok(Math.abs(a[1] + 8) < 1e-9 && Math.abs(b[1] + 8) < 1e-9 && Math.abs(m[1] + 7.4) < 1e-9, 'the deck rises to its hump');
  assert.ok(Math.abs(b[2] + 30) < 1e-9 && Math.abs(B.L - 30) < 1e-9);
  const solids = [...kit.buckets.values()].filter((x) => x.solid);
  assert.ok(solids.length >= 2 && solids.every((x) => x.list.every(finite)));
});

test('a heaped quarter: houses on the deck, storeys stacked toward the mound, none off the edge', () => {
  const kit = kitOf(), M = spaceMats(kit), rng = mulberry32(9);
  const I = island(kit, M, rng, { x: 0, y: 0, z: 0, w: 40, d: 30, deep: 10, cables: 2 });
  const before = [...kit.buckets.values()].reduce((n, b) => n + b.list.length, 0);
  heap(kit, M, rng, I, { peak: 4, q: { n: 16, gap: 0 } });
  const after = [...kit.buckets.values()].reduce((n, b) => n + b.list.length, 0);
  assert.ok(after > before + 100, 'houses and their storeys');
  const placed = quarter(kit, M, rng, { x0: -20, x1: 20, z0: -15, z1: 15, n: 12, inside: (x, z, m) => I.inside(x, z, m) });
  assert.ok(placed.length >= 4);
  for (const h of placed) assert.ok(I.inside(h.x, h.z), 'on the deck');
  railing(kit, M, [[0, 0, 0], [5, 0, -2]]);
  railing(kit, M, [[0, 0, 0], [5, 0, -2]], { solidWall: true });
  pipeStack(kit, M, rng, 0, -10, 0, 20);
  for (const b of kit.buckets.values()) for (const g of b.list) assert.ok(finite(g));
});
