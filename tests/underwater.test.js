// The Underwater City (src/levels/underwater.js, docs/systems/worlds.md) and the sea it stands in (water.js SEA_LOOK,
// swim.js SEA): the sea's own rules in a box (the bed walked, the kick, the air pockets), and the city as it is since
// v1.40: sealed halls and tubes, dry wherever you can stand, the lift, the Dock; its views are in the References.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { makeMaterial, MODE_WATER } from '../src/materials.js';
import { Waters, SEA_LOOK, SEA_SHAFTS, seaShafts, DEEP_UNDER } from '../src/water.js';
import { SEA, deepSea } from '../src/swim.js';
import { createUnderwater, DOMES, SHIP_SITE, seabed, placeAt } from '../src/levels/underwater.js';
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

test('the world is on the route since v1.40, fifth, after Viridel: a page, five relics', () => {
  const meta = LEVELS.find((l) => l.id === 'underwater');
  assert.ok(meta && !meta.dev && !meta.hidden);
  assert.equal(meta.title, TITLES.underwater);
  assert.ok(!SIDE.includes('underwater') && ORDER.indexOf('underwater') === ORDER.indexOf('edena') + 1, 'after Viridel');
  assert.equal(CONTENT.underwater.relics.names.length, 5);
  assert.equal(CONTENT.underwater.story.manual, true, 'its page closes when the Whale-House is calmed (src/story/underwater.js)');
  const entries = mapEntries({ order: ORDER, levels: LEVELS, flag: () => false, journal: null, current: 'desert', home: false, side: SIDE });
  const e = entries.find((x) => x.id === 'underwater');
  assert.ok(e && !e.side, 'on the dotted line');
});

test('nobody swims: every hall and tube is dry, the sea is only on the other side of the glass', () => {
  assert.equal(waters.bodies.filter((b) => b.sea).length, 1, 'one sea');
  assert.ok(waters.bodies[0].sea.glass, 'seen through glass: its look on the view from inside');
  for (const [id, d] of Object.entries(DOMES)) {
    for (const [dx, dz] of [[0, 0], [0.5, 0.3], [-0.4, -0.5]]) {
      const x = d.x + dx * d.r, z = d.z + dz * d.r;
      assert.equal(waters.surfaceAt(x, z, d.y + 1.2), null, `${id}: dry at ${x.toFixed(0)}, ${z.toFixed(0)}`);
    }
    assert.ok(Math.abs(physics.groundAt(d.x + d.r * 0.3, d.y + 3, d.z - d.r * 0.3) - d.y) < 1.4, `${id}: its floor`);
  }
  for (const [id, t] of Object.entries(level.tubes)) for (const f of [0.05, 0.5, 0.95]) {
    const [x, y, z] = t.at(f);
    assert.equal(waters.surfaceAt(x, z, y + 1.2), null, `the ${id} tube: dry at ${f}`);
    assert.ok(Math.abs(physics.groundAt(x, y + 2, z) - y) < 0.3, `the ${id} tube: its floor at ${f}`);
    assert.ok(physics.rayDistance(V(x, y + 1.5, z), V(0, 1, 0), 10) < t.R, `the ${id} tube: glass over it`);
  }
  // outside the glass: the sea
  assert.ok(waters.surfaceAt(60, 60, seabed(60, 60) + 1), 'the sea outside');
  assert.ok(!level.air(60, seabed(60, 60) + 1, 60));
  assert.equal(placeAt({ x: 0, y: 0, z: DOMES.dock.z }), 'The Dock');
  assert.equal(placeAt({ x: DOMES.crown.x, y: DOMES.crown.y + 1, z: DOMES.crown.z }), 'The Crown');
});

test('sealed: from inside every hall, walking out in any direction meets glass before the sea', () => {
  for (const [id, d] of Object.entries(DOMES)) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const o = V(d.x, d.y + 1.4, d.z), dir = V(Math.sin(a), 0, Math.cos(a));
      let p = o.clone(), ok = false;
      // walk out until something stops you; a door leads into a tube, which is air too
      for (let s = 0; s < 120; s += 1) {
        p = o.clone().addScaledVector(dir, s);
        if (physics.rayDistance(o, dir, s + 0.5) < s + 0.5) { ok = true; break; }
        if (!level.air(p.x, p.y, p.z)) break;
      }
      assert.ok(ok || level.air(p.x, p.y, p.z), `${id}: out toward ${a.toFixed(2)} you reach the sea at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`);
    }
  }
});

test('the lift: up the column to the Crown and down again', () => {
  const up = level.portals.find((p) => /up to the Crown/.test(p.label)), down = level.portals.find((p) => /down to the Plaza/.test(p.label));
  assert.ok(up && down);
  assert.ok(Math.abs(physics.groundAt(up.to.x, up.to.y + 2, up.to.z) - DOMES.crown.y) < 0.3, 'out on the Crown’s floor');
  assert.ok(Math.abs(physics.groundAt(down.to.x, down.to.y + 2, down.to.z) - DOMES.plaza.y) < 0.6, 'out on the Plaza’s floor');
  assert.ok(up.to.distanceTo(down.at) > down.r + 1.5 && down.to.distanceTo(up.at) > up.r + 1.5, 'never straight back');
});

test('the ship stands on the Dock’s floor: flat, clear overhead under the dome', () => {
  const y0 = physics.groundAt(SHIP_SITE.x, 5, SHIP_SITE.z);
  for (let a = 0; a < 6.28; a += 0.5) for (const r of [0, 8, 13]) {
    const x = SHIP_SITE.x + Math.cos(a) * r, z = SHIP_SITE.z + Math.sin(a) * r, g = physics.groundAt(x, 5, z);
    assert.ok(Math.abs(g - y0) < 0.2, `the Dock at ${x.toFixed(1)}, ${z.toFixed(1)}: ${g.toFixed(2)} (${y0.toFixed(2)})`);
    assert.ok(physics.rayDistance(V(x, g + 0.5, z), V(0, 1, 0), 40) > 12, `room over ${x.toFixed(1)}, ${z.toFixed(1)}`);
  }
  assert.ok(Math.abs(physics.groundAt(level.spawn.x, level.spawn.y + 2, level.spawn.z) - level.spawn.y) < 0.3, 'the spawn stands on the floor');
});

test('the people walk where it is solid, every line toned; within the collision budget', () => {
  const { routes } = quiet(() => buildPeople(physics, level.crowdSpots()));
  assert.ok(routes.length >= 6, `walkable crowd routes: ${routes.length}`);
  for (const line of level.crowdLines) assert.ok(toneOf(line), `toned: ${line}`);
  for (const n of CONTENT.underwater.npcs) for (const line of n.lines) assert.ok(toneOf(line), `toned: ${line}`);
  assert.ok(physics.triangles < 260000, `static collision budget: ${physics.triangles}`);
  // the pod tower's decks inside the Avenue: you climb to them
  assert.ok(level.decks.length >= 2);
  for (const d of level.decks) assert.ok(Math.abs(physics.groundAt(d.x, d.y + 2, d.z) - d.y) < 0.6, `a deck at ${d.x.toFixed(1)}, ${d.y.toFixed(1)}, ${d.z.toFixed(1)}`);
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
