// The Underwater City (src/levels/underwater.js, docs/systems/worlds.md) and the sea it stands in (water.js SEA_LOOK,
// swim.js SEA): the bed walked under the water, the jump kicking you off swimming, sinking back down, the air in the
// cafés; the world builds, stands where it is drawn, is on the map off the route; its views are in the References.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { makeMaterial, MODE_WATER } from '../src/materials.js';
import { Waters, SEA_LOOK, SEA_SHAFTS, seaShafts, DEEP_UNDER } from '../src/water.js';
import { SEA, deepSea } from '../src/swim.js';
import { createUnderwater, SEA_Y, AVENUE, CANAL, TERRACE, PLAZA, SHIP_SITE, seabed, placeAt } from '../src/levels/underwater.js';
import { SEA_DAY, UNDERWATER_LOOK } from '../src/levels/underwater-kit.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { SIDE, TITLES } from '../src/levels/names.js';
import { mapEntries } from '../src/ship/starmap.js';
import { buildPeople } from '../src/crowd.js';
import { toneOf } from '../src/story/tone.js';

const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ a sea in a box
// The bed at y = 0 (x, z -60 … 60), a ledge 4 m up at x 20 … 30, the sea's surface at y = 30, and an air pocket (a dome
// 8 m round centred on (-30, 0, 0)).
function sea() {
  const scene = new THREE.Scene();
  const box = (x, y, z, w, h, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y, z); scene.add(m); return m; };
  box(0, -0.5, 0, 120, 1, 120);
  box(25, 2, 0, 10, 4, 10);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2).translate(0, 30, 0), makeMaterial({ color: '#2f8fb0', color2: '#2f86b4', mode: MODE_WATER }));
  water.userData.noCollide = true;
  water.userData.sea = { ...SEA_DAY, air: (x, y, z) => (x + 30) ** 2 + z ** 2 + y ** 2 < 64 };
  scene.add(water);
  const physics = new Physics(scene);
  const waters = new Waters(scene, { physics, drops: false });
  return { scene, physics, waters };
}
const S = sea();
const make = () => { const p = new Player(S.physics, { water: S.waters, climb: true }); const ev = []; p.onSwim = (k) => ev.push(k); p.events = ev; return p; };
const run = (p, secs, input = {}, yaw = 0) => { for (let i = 0; i < secs * 60; i++) p.update(1 / 60, input, yaw); };
const EAST = -Math.PI / 2;

test('a sea: its surface overhead everywhere, but none in its air pockets', () => {
  const W = S.waters;
  assert.equal(W.bodies.length, 1);
  assert.ok(W.bodies[0].sea, 'the body carries its sea');
  assert.equal(W.surfaceAt(10, 0, 1)?.y, 30, 'on the bed: the sea over you');
  assert.equal(W.surfaceAt(-30, 0, 1), null, 'in the dome: dry');
  assert.ok(deepSea(waterAt(10, 1, 0)) && !deepSea(waterAt(10, 29, 0)), 'deep under it, and not near its surface');
  assert.ok(DEEP_UNDER === SEA.deep, 'the splashes stop where the bed walk starts');
});
function waterAt(x, y, z) { const h = S.waters.surfaceAt(x, z, y); return h ? { over: h.y - y, body: h.body } : null; }

test('the bed is walked, a little slower; the jump kicks you off it swimming, letting go sinks you back to it', () => {
  const p = make();
  p.teleport(V(0, 0.05, 0), V(0, 1, 0), V(0, 0, 1));
  run(p, 0.5);
  assert.ok(!p.swim && p.onGround, 'standing on the bed, not floating up to the surface');
  const x0 = p.pos.x;
  run(p, 2, { KeyW: true }, EAST);
  assert.ok(!p.swim && p.pos.x - x0 > 3, `walked along the bed: ${(p.pos.x - x0).toFixed(1)} m`);
  assert.ok(p.wadeSlow < 1 && Math.abs(p.wadeSlow - SEA.walk) < 1e-6, 'a little slower than on land');
  // the jump: a kick up, swimming
  run(p, 1 / 60, { Space: true });
  assert.ok(p.swim && p.vel.y > 2, 'kicked off the bed, swimming');
  run(p, 1.5, { Space: true });
  assert.ok(p.pos.y > 4, `Space held rises: ${p.pos.y.toFixed(1)} m`);
  // let go: down again, and standing once the bed is under the feet
  run(p, 8);
  assert.ok(!p.swim && p.onGround && p.pos.y < 0.2, `sank back to the bed and stood: y ${p.pos.y.toFixed(2)}, swim ${!!p.swim}`);
  assert.equal(p.breath, 1, 'the pack gives air: the breath never ran out');
  assert.ok(!p.events.includes('gasp'), 'nothing to gasp for');
});

test('swimming up onto a ledge, landing on it; and a long fall in the sea breaks nothing', () => {
  const p = make();
  p.teleport(V(25, 9, 0), V(0, 1, 0), V(0, 0, 1));
  p.vel.set(0, -1, 0); p.onGround = false;
  run(p, 6);
  assert.ok(!p.swim && p.onGround && Math.abs(p.pos.y - 4) < 0.2, `landed on the ledge: y ${p.pos.y.toFixed(2)}`);
  const q = make();
  q.teleport(V(-5, 26, 10), V(0, 1, 0), V(0, 0, 1));
  q.onGround = false;
  const h0 = q.health ?? 1;
  run(q, 25);
  assert.ok(q.onGround && q.pos.y < 0.3 && (q.health ?? 1) === h0, 'down from near the surface: no hurt');
});

test('into an air pocket: out of the water, an ordinary walk', () => {
  const p = make();
  p.teleport(V(-30, 0.05, 0), V(0, 1, 0), V(0, 0, 1));
  run(p, 0.5);
  assert.ok(!p.swim && p.wadeSlow === 1 && p.inWater === null, 'dry inside the dome');
});

test('the sea\'s look: shafts world-anchored on their lattice, the generic water untouched', () => {
  assert.equal(SEA_LOOK.density, 0.085, 'the generic under-water look as it was');
  const a = seaShafts(SEA_DAY.shafts, 10, 10), b = seaShafts(SEA_DAY.shafts, 14, 12);
  assert.equal(a.length, SEA_SHAFTS * 4);
  // the same cells round both points: the same shafts in the same places
  const set = (v) => new Set(Array.from({ length: SEA_SHAFTS }, (_, i) => `${v[i * 4].toFixed(3)},${v[i * 4 + 1].toFixed(3)},${v[i * 4 + 3].toFixed(3)}`));
  const A = set(a), B = set(b);
  assert.ok([...A].every((k) => B.has(k)), 'moving within a cell, nothing moves');
  const lit = Array.from({ length: SEA_SHAFTS }, (_, i) => a[i * 4 + 3]).filter((w) => w > 0).length;
  assert.ok(lit > 6 && lit < SEA_SHAFTS, `a share of the cells carry a shaft: ${lit}`);
  assert.ok(UNDERWATER_LOOK.uCumulus === 0 && UNDERWATER_LOOK.uClouds === 0, 'no clouds: the sky is the sea');
});

// ------------------------------------------------------------------ the world
const scene = new THREE.Scene();
const level = quiet(() => createUnderwater(scene));
const physics = new Physics(scene, level.ground);
const waters = new Waters(scene, { physics, drops: false });

test('the world is registered off the route: in the worlds list, on the galactic map from the start, never counted', () => {
  const meta = LEVELS.find((l) => l.id === 'underwater');
  assert.ok(meta && !meta.dev);
  assert.equal(meta.title, TITLES.underwater);
  assert.ok(SIDE.includes('underwater') && !ORDER.includes('underwater'), 'off the route');
  assert.equal(CONTENT.underwater.relics.names.length, 0);
  assert.equal(CONTENT.underwater.story.manual, true, 'no page closes by walking somewhere');
  const entries = mapEntries({ order: ORDER, levels: LEVELS, flag: () => false, journal: null, current: 'desert', home: false, side: SIDE });
  const e = entries.find((x) => x.id === 'underwater');
  assert.ok(e && e.known && e.side, 'charted from the first world on');
});

test('the whole city is under the sea; the cafés are dry inside', () => {
  assert.equal(waters.bodies.filter((b) => b.sea).length, 1, 'one sea');
  assert.equal(waters.surfaceAt(0, 40, 1)?.y, SEA_Y, 'the avenue');
  assert.equal(waters.surfaceAt(SHIP_SITE.x, SHIP_SITE.z, seabed(SHIP_SITE.x, SHIP_SITE.z) + 1)?.y, SEA_Y, 'the landing');
  assert.ok(level.domes.length >= 6, `cafés: ${level.domes.length}`);
  for (const d of level.domes) {
    assert.equal(waters.surfaceAt(d.x, d.z, d.y + 1.2), null, `dry in the café at ${d.x}, ${d.z}`);
    assert.ok(physics.groundAt(d.x, d.y + 2, d.z) > d.y - 0.15, 'its floor solid');
    const [dx, dz] = d.door, ox = dx + Math.sin(d.doorYaw) * 1.5, oz = dz + Math.cos(d.doorYaw) * 1.5;
    assert.ok(waters.surfaceAt(ox, oz, d.y + 1.2), 'the sea just out of its door');
    // the door is open: a ray in through it at chest height meets nothing until the far side
    const into = V(-Math.sin(d.doorYaw), 0, -Math.cos(d.doorYaw));
    const hit = physics.rayHit(V(ox, d.y + 1.4, oz), into, d.r);
    assert.ok(!hit || hit.distance > 2.5, `the door of the café at ${d.x}, ${d.z} is open`);
  }
});

test('the streets, the bridge and the terrace are solid where they are drawn; the canal is deep', () => {
  for (let z = AVENUE.z1 - 2; z > AVENUE.z0 + 2; z -= 6) {
    const g = physics.groundAt(0, 3, z);
    if (Math.abs(z - CANAL.z) <= CANAL.half + 2.4) assert.ok(g > -0.1 && g < 1, `the bridge at z ${z}: ${g}`);
    else if (Math.hypot(z - PLAZA.z, 0) < 4) continue;   // (the great column)
    else assert.ok(Math.abs(g) < 0.1, `the avenue at z ${z}: ${g}`);
  }
  assert.ok(physics.groundAt(40, 2, CANAL.z) < CANAL.bed + 1, 'the canal\'s bed');
  assert.ok(Math.abs(physics.groundAt(-90, TERRACE.y + 3, 0) - TERRACE.y) < 0.1, 'the terrace');
  for (const [x, y, z] of level.terraceStairs) assert.ok(Math.abs(physics.groundAt(x + 0.2, y + 2, z) - y) < 0.35, `the stair's top at ${x.toFixed(1)}, ${z}`);
  // the pods' open decks: you land on them
  assert.ok(level.decks.length > 20, `decks: ${level.decks.length}`);
  for (const d of level.decks.slice(0, 12)) assert.ok(Math.abs(physics.groundAt(d.x, d.y + 2, d.z) - d.y) < 0.4, `a deck at ${d.x.toFixed(1)}, ${d.y.toFixed(1)}, ${d.z.toFixed(1)}`);
  assert.equal(placeAt({ x: 0, y: 0, z: 140 }), 'The landing');
  assert.equal(placeAt({ x: 0, y: 0, z: -20 }), 'The canal');
});

test('the ship lands in the sandy hollow: flat, clear, nothing over it', () => {
  const y0 = physics.groundAt(SHIP_SITE.x, 5, SHIP_SITE.z);
  for (let a = 0; a < 6.28; a += 0.5) for (const r of [0, 8, 15]) {
    const x = SHIP_SITE.x + Math.cos(a) * r, z = SHIP_SITE.z + Math.sin(a) * r, g = physics.groundAt(x, 5, z);
    assert.ok(Math.abs(g - y0) < 0.9, `the hollow at ${x.toFixed(1)}, ${z.toFixed(1)}: ${g.toFixed(2)} (${y0.toFixed(2)})`);
    assert.equal(physics.rayHit(V(x, g + 2, z), V(0, 1, 0), 200), null, `nothing over ${x.toFixed(1)}, ${z.toFixed(1)}`);
  }
  assert.ok(Math.abs(physics.groundAt(level.spawn.x, level.spawn.y + 2, level.spawn.z) - level.spawn.y) < 0.3, 'the spawn stands on the sand');
});

test('the people walk where it is solid, every line toned; within the collision budget', () => {
  level.init?.(physics);
  const { routes } = quiet(() => buildPeople(physics, level.crowdSpots()));
  assert.ok(routes.length >= 8, `walkable crowd routes: ${routes.length}`);
  for (const line of level.crowdLines) assert.ok(toneOf(line), `toned: ${line}`);
  for (const n of CONTENT.underwater.npcs) for (const line of n.lines) assert.ok(toneOf(line), `toned: ${line}`);
  assert.ok(physics.triangles < 220000, `static collision budget: ${physics.triangles}`);
});

test('the Underwater City\'s views: four plates, one view each, in the References', async () => {
  const { REFERENCE_WORLDS } = await import('../src/levels/reference-worlds.js');
  const w = REFERENCE_WORLDS.find((x) => x.id === 'underwater');
  assert.ok(w, 'a references world');
  const m = await w.load();
  assert.equal(m.VIEWS.length, w.count);
  assert.deepEqual(m.VIEWS.map((v) => v.sheet), ['underwater-1', 'underwater-2', 'underwater-3', 'underwater-4']);
  for (const v of m.VIEWS) {
    assert.ok(m.SHEETS[v.sheet].name.startsWith(`${w.name} / `));
    assert.deepEqual(v.crop, [0, 0, ...m.SHEETS[v.sheet].size]);
  }
});
