import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { SIDE } from '../src/levels/names.js';
import { mapEntries } from '../src/ship/starmap.js';
import { TR } from '../src/levels/overnight-train-kit.js';
import { RUN, CYCLE, runAt, stationOffset, bandShift } from '../src/levels/overnight-train-run.js';
import { createOvernightTrain, TRAIN_CONTENT, CARS, car, SHIP_SITE, FLOOR, WALK, NOSE_X, STATION, START_T, unsafe, placeName, MOONS } from '../src/levels/overnight-train.js';

// ------------------------------------------------------------------ the world (src/levels/overnight-train.js)
let world = null;
const built = () => world ??= (() => {
  const scene = new THREE.Scene(), w = console.warn; console.warn = () => {};
  try { const level = createOvernightTrain(scene); return { scene, level, physics: new Physics(scene, level.ground) }; } finally { console.warn = w; }
})();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** Whether the traveller's own body (player.js: 0.45 m round, from 0.6 m over the feet to 2.2) fits there. */
const fits = (physics, x, y, z) => physics.pushCapsule(V(x, y, z), 0.45, 0.6, 2.2) === null;
const at = (physics, x, y, z) => { const h = physics.groundAt(x, y + 1.5, z, 4); return { h, ok: Math.abs(h - y) < 0.35 && fits(physics, x, h, z) }; };
const along = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);

test('the Overnight Train: off the route, on the map from the start, reached by ?level=overnighttrain', () => {
  const L = LEVELS.find((l) => l.id === 'overnighttrain');
  assert.ok(L && L.hidden && !L.dev, 'a world, not on the route');
  assert.ok(SIDE.includes('overnighttrain') && !ORDER.includes('overnighttrain'));
  assert.equal(SIDE.at(-1), 'overnighttrain', 'at the end of the side worlds');
  assert.equal(CONTENT.overnighttrain, TRAIN_CONTENT);
  assert.ok(TRAIN_CONTENT.story.manual, 'no story to follow: no beacon');
  const entries = mapEntries({ order: ORDER, levels: LEVELS, side: SIDE, journal: { seen: () => false, storyDone: () => false }, current: 'desert', flag: () => undefined, home: () => true });
  const e = entries.find((x) => x.id === 'overnighttrain');
  assert.ok(e && e.known && e.side, 'charted, off the dotted line');
  assert.ok(entries.at(-1).home, 'home still last');
});

test('the run: halts at a station, pulls out, runs at speed, brakes into the next; the land runs past by it', () => {
  let last = runAt(0), seen = new Set();
  assert.equal(last.phase, 'halt');
  assert.equal(stationOffset(last.s), 0, 'halted beside its station');
  for (let t = 0.5; t < CYCLE.T * 2.2; t += 0.5) {
    const r = runAt(t);
    assert.ok(r.s >= last.s - 1e-9, `the land only runs one way (t ${t})`);
    assert.ok(r.v >= 0 && r.v <= RUN.V + 1e-9);
    assert.ok(Math.abs((r.s - last.s) / 0.5 - (r.v + last.v) / 2) < 0.5, 'its speed is how fast it goes');
    seen.add(r.phase);
    if (r.phase === 'halt') assert.ok(Math.abs(stationOffset(r.s)) < 1e-6, 'every halt beside a station');
    last = r;
  }
  assert.deepEqual([...seen].sort(), ['braking', 'halt', 'leaving', 'running']);
  assert.ok(Math.abs(runAt(CYCLE.T).s - CYCLE.D) < 1e-6, 'one cycle, one station to the next');
  for (const s of [0, 0.3, 17, 1234.5, CYCLE.D * 3 + 1]) for (const P of [0.9, 50, 300]) { const d = bandShift(s, P); assert.ok(d <= 0 && d > -P - 1e-9); }
  assert.ok(START_T < RUN.halt, 'the ship comes down while the train waits at a station');
});

test('the train builds: the ship on the landing wagon, people in the carriages, the moons ahead', () => {
  const { level, physics } = built();
  assert.equal(level.id, 'overnighttrain');
  const LW = car('landing');
  assert.ok(SHIP_SITE.x > LW.x0 + 13 && SHIP_SITE.x < LW.x1 - 13, 'the ship on the wagon\'s deck');
  for (const [dx, dz] of [[0, 0], [-10, 0], [10, 0], [0, -12], [0, 12]]) assert.ok(Math.abs(physics.groundAt(SHIP_SITE.x + dx, FLOOR + 20, SHIP_SITE.z + dz, 40) - FLOOR) < 0.05, 'the deck is flat round it');
  assert.ok(at(physics, level.spawn.x, FLOOR, level.spawn.z).ok, 'nothing in the way where he starts');
  const named = TRAIN_CONTENT.npcs.filter((p) => p.id).map((p) => p.id);
  assert.deepEqual(named.sort(), ['oia', 'saba', 'sol']);
  for (const p of TRAIN_CONTENT.npcs.filter((q) => q.talk)) assert.ok(p.talk.listen?.length >= 3 && !p.talk.nodes && !p.talk.entry, `${p.id}: only words for the train, no errands`);
  for (const p of TRAIN_CONTENT.npcs) {
    const y = p.y ?? FLOOR, h = physics.groundAt(p.at[0], y + 1.5, p.at[1], 4);
    assert.ok(Number.isFinite(h) && Math.abs(h - y) < 0.6, `someone at ${p.at} stands on the floor (${h} vs ${y})`);
  }
  assert.ok(level.lights.length > 40, `lamps in every carriage (${level.lights.length})`);
  assert.equal(level.sky.moon, false, 'the sky\'s own moon gives way to the two');
  assert.equal(MOONS.length, 2);
  assert.ok(MOONS.every((m) => m.az > 45 && m.az < 135), 'ahead of the train');
  assert.equal(level.defaults.hour, 22, 'night by default');
});

test('walking the train: every carriage you can enter, its doors, the porches between, the balcony', () => {
  const { physics } = built();
  const walk = (name, a, b, n, y = FLOOR) => { for (const [x, z] of along(a, b, n)) { const r = at(physics, x, y, z); assert.ok(r.ok, `${name} at ${x.toFixed(1)}, ${z.toFixed(1)} (${r.h})`); } };
  // from the landing wagon forward to the balcony, along each carriage's way through (the sleepers' corridor along -z)
  const way = { prow: 0, dining: 0, sleeper: -2.1, dome: -0.5 };
  for (const c of CARS.filter((q) => way[q.kind] !== undefined)) walk(`the ${c.kind} (${c.i})`, [c.x0 + 1, way[c.kind]], [c.x1 - 1, way[c.kind]], Math.round(c.L));
  // through every door at a carriage's end, from the porch outside to its way through inside
  for (const c of CARS.filter((q) => way[q.kind] !== undefined)) {
    walk(`in at the back of the ${c.kind}`, [c.x0 - 1.6, 0], [c.x0 + 1.2, 0], 14);
    walk(`the back of the ${c.kind} to its way through`, [c.x0 + 1.2, 0], [c.x0 + 1.2, way[c.kind]], 8);
    if (c.kind !== 'prow') { walk(`out at the front of the ${c.kind}`, [c.x1 - 1.2, 0], [c.x1 + 1.6, 0], 14); walk(`the front of the ${c.kind} to its way through`, [c.x1 - 1.2, 0], [c.x1 - 1.2, way[c.kind]], 8); }
  }
  walk('onto the balcony', [NOSE_X - 2, 0], [NOSE_X + 3.2, 0], 12);
  walk('the landing wagon', [car('landing').x0 + 1, 10], [car('landing').x1 - 1, 10], 30);
  // and railed where it drops away: the balcony's front, a porch's side, the deck's edge
  for (const [x, z, dx, dz] of [[NOSE_X + 2, 0, 1, 0], [car('dining').x0 - 1.2, 0, 0, 1], [car('landing').xc, 8, 0, 1], [car('landing').xc, -8, 0, -1]]) {
    let hit = false;
    for (let s = 0; s < 12 && !hit; s += 0.2) hit = !fits(physics, x + dx * s, FLOOR, z + dz * s);
    assert.ok(hit, `a rail beyond ${x.toFixed(1)}, ${z}`);
  }
  // the closed carriages of the tail keep their doors shut
  const tail = CARS.filter((c) => c.kind === 'coach');
  assert.ok(!fits(physics, tail[0].x1 - 0.5, FLOOR, 0) || physics.groundAt(tail[0].xc, FLOOR + 1, 0, 3) < FLOOR - 1, 'no way into the tail');
});

test('the roofs: a ladder on the porches, the walk along the crowns, the planks over the gaps, the terrace', () => {
  const { physics, level } = built();
  const enter = CARS.filter((c) => c.kind !== 'landing');
  for (const c of enter) for (const x of c.kind === 'dome' ? [c.x0 + 2, c.x1 - 2] : [c.x0 + 2, c.xc, c.x1 - 2]) {   // (the sky lounge stands on the dome's middle)
    const h = physics.groundAt(x, WALK + 3, 0, 5);
    assert.ok(Math.abs(h - WALK) < 0.12 || (c.kind === 'dome' && h > WALK - 0.1 && h < WALK + 0.3), `the roof walk over the ${c.kind} at ${x.toFixed(1)} (${h})`);
  }
  for (let i = 0; i < enter.length - 1; i++) {
    const a = enter[i], b = enter[i + 1];
    if (Math.abs(a.x0 - b.x1 - TR.gap) > 1e-6) continue;   // (the landing wagon between: no roof)
    const h = physics.groundAt(a.x0 - TR.gap / 2, WALK + 3, 0, 5);
    assert.ok(Math.abs(h - WALK) < 0.15, `a plank over the gap behind the ${a.kind} (${h})`);
  }
  const D = car('dome');
  assert.ok(Math.abs(physics.groundAt(D.x0 + 2, WALK + 3, 1.6, 5) - (WALK + 0.02)) < 0.5, 'the terrace');
  assert.equal(placeName(D.xc + 1, 0, WALK + 1), 'The sky lounge');
  assert.equal(placeName(car('dining').xc, 0, FLOOR), 'The dining car');
  assert.ok(unsafe(V(0, 0.5, 30)) && !unsafe(V(car('dining').xc, FLOOR, 0)), 'off the train is the running land; aboard is safe');
  assert.ok(level.rails(V(car('dining').xc, WALK, 0)).roof === 1 && level.rails(V(car('dining').xc, FLOOR, 0)).out === 0, 'the rails louder outside');
});

test('the land runs past: the bands, the station, the dust and the wheels move with the run; the build stays in budget', () => {
  const { level, scene } = built();
  const band = (name) => scene.getObjectByName(name);
  level.setRunTime(0);
  const station = band('The station');
  assert.ok(Math.abs(station.position.x) < 1e-6 && station.visible, 'at a halt the station stands beside the train');
  const x0 = band('The telegraph').position.x;
  level.setRunTime(RUN.halt + RUN.accel + 10);
  assert.equal(level.run.phase, 'running');
  assert.ok(Math.abs(band('The telegraph').position.x - x0) > 1, 'the poles have moved');
  assert.ok(station.position.x < -STATION.half, 'the station left behind');
  let tris = 0, solid = 0, meshes = 0;
  scene.traverse((o) => { if (!o.isMesh) return; meshes++; const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); tris += n; if (!o.userData.noCollide) solid += n; });
  assert.ok(meshes < 140, `merged by material (${meshes} meshes)`);
  assert.ok(tris < 600_000, `triangles (${Math.round(tris / 1000)} k)`);
  assert.ok(solid < 60_000, `collision triangles (${Math.round(solid / 1000)} k)`);
});
