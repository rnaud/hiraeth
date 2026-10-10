import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { SIDE, WIP, SUB, isSub } from '../src/levels/names.js';
import { mapEntries } from '../src/ship/starmap.js';
import { TR } from '../src/levels/overnight-train-kit.js';
import { RUN, CYCLE, BRAKE_D, runAt, planRun, stationOffset, bandShift } from '../src/levels/overnight-train-run.js';
import { createOvernightTrain, TRAIN_CONTENT, CARS, car, SHIP_SITE, FLOOR, WALK, NOSE_X, STATION, unsafe, placeName, MOONS, NIGHT_MAIL, PORCH_X, SWAY, swayAt, TAIL } from '../src/levels/overnight-train.js';

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

test('the Overnight Train: a sub-level of the Signal Market (its night halt), off the route and off the ship\'s map', () => {
  const L = LEVELS.find((l) => l.id === 'overnighttrain');
  assert.ok(L && L.hidden && !L.dev, 'a world, not on the route');
  assert.ok(!ORDER.includes('overnighttrain') && !SIDE.includes('overnighttrain') && !WIP.includes('overnighttrain'), 'neither the route, a detour, nor unfinished');
  assert.ok(isSub('overnighttrain') && SUB.overnighttrain === 'bazaar' && ORDER.includes(SUB.overnighttrain), 'reached from a route world: the Signal Market');
  assert.equal(CONTENT.overnighttrain, TRAIN_CONTENT);
  assert.ok(TRAIN_CONTENT.story.manual, 'no beacon of its own: the night mail leads there');
  const entries = mapEntries({ order: ORDER, levels: LEVELS, side: SIDE, journal: { seen: () => false, storyDone: () => false }, current: 'desert', flag: () => undefined, home: () => true });
  assert.ok(!entries.some((x) => x.id === 'overnighttrain'), 'not a place the ship flies to');
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
});

test('the plan: the train runs and never waits, until asked; then it brakes into a halt, waits, and runs on', () => {
  const p = planRun('running');
  assert.equal(p.at(0).phase, 'running');
  assert.equal(p.at(0).v, RUN.V, 'at speed from the start');
  for (const t of [10, 300, 3000]) assert.equal(p.at(t).phase, 'running', `still running at ${t} s: no station stops it`);
  assert.equal(p.haltS(), null);
  const t0 = 200, at = p.stop(t0, 4);
  assert.equal(at, t0 + 4 + RUN.brake, 'halted after the lead and the braking');
  assert.equal(p.stop(t0 + 1, 4), null, 'one stop at a time');
  assert.equal(p.at(t0 + 2).phase, 'running');
  assert.equal(p.at(t0 + 10).phase, 'braking');
  const h = p.at(at + 5);
  assert.equal(h.phase, 'halt'); assert.equal(h.v, 0); assert.equal(h.halts, 1);
  assert.ok(Math.abs(p.haltS() - (RUN.V * (t0 + 4) + BRAKE_D)) < 1e-6, 'the halt is where the braking ends');
  assert.ok(Math.abs(p.at(at + 5).s - p.haltS()) < 1e-6, 'standing at it');
  assert.equal(p.at(at + RUN.halt + 3).phase, 'leaving');
  assert.equal(p.at(at + RUN.halt + RUN.accel + 3).phase, 'running', 'and on again');
  let last = p.at(0);
  for (let t = 0.5; t < at + RUN.halt + RUN.accel + 60; t += 0.5) {
    const r = p.at(t);
    assert.ok(r.s >= last.s - 1e-9 && r.v >= 0 && r.v <= RUN.V + 1e-9);
    assert.ok(Math.abs((r.s - last.s) / 0.5 - (r.v + last.v) / 2) < 0.5, 'its speed is how fast it goes');
    last = r;
  }
  // boarded at the market's halt: pulling out of it
  const b = planRun('leaving');
  assert.equal(b.at(0).phase, 'leaving'); assert.equal(b.at(0).v, 0);
  assert.equal(b.at(RUN.accel + 1).phase, 'running');
  assert.ok(b.stop(5, 0) >= RUN.accel + RUN.brake, 'asked while still pulling out: it brakes once up to speed');
});

test('the ride: the land rocks round the rails and bobs at the joints, by the speed; still at a halt', () => {
  let maxRoll = 0, minBob = 0;
  for (let t = 0; t < 30; t += 0.05) { const w = swayAt(t, t * RUN.V, 1); maxRoll = Math.max(maxRoll, Math.abs(w.roll)); minBob = Math.min(minBob, w.bob); }
  assert.ok(maxRoll > 0.002 && maxRoll <= SWAY.roll[0] + SWAY.roll[1] + 1e-9, `a small roll (${maxRoll.toFixed(4)} rad)`);
  assert.ok(minBob < -0.005 && minBob >= -SWAY.bob - 1e-9, `a bob at the joints (${minBob.toFixed(3)} m)`);
  assert.deepEqual(swayAt(3.3, 999, 0), { roll: 0, bob: -0 }, 'nothing at a standstill');
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
  assert.equal(level.run.phase, 'running', 'moving from the start, not waiting at a station');
  assert.equal(level.from, null);
  const station = band('The station'), land = band('The land');
  assert.ok(land && station.parent === land && band('The telegraph').parent === land, 'everything off the train in the land, which rocks');
  const x0 = band('The telegraph').position.x;
  level.setRunTime(10);
  assert.ok(Math.abs(band('The telegraph').position.x - x0) > 1, 'the poles have moved');
  assert.ok(band('The gantries'), 'gantries over the line: shadows passing');
  // asked to stop: it brakes into a halt with the station beside the carriages
  const at = level.requestStop(2);
  assert.ok(at > 10);
  level.setRunTime(at + 3);
  assert.equal(level.run.phase, 'halt');
  assert.ok(Math.abs(station.position.x) < 1e-6 && station.visible, 'at the halt the station stands beside the train');
  assert.ok(Math.abs(land.rotation.x) < 1e-4, 'and nothing rocks');
  level.setRunTime(at + RUN.halt + RUN.accel + 30);
  assert.equal(level.run.phase, 'running');
  assert.ok(station.position.x < -STATION.half, 'the station left behind');
  let tris = 0, solid = 0, meshes = 0;
  scene.traverse((o) => { if (!o.isMesh) return; meshes++; const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); tris += n; if (!o.userData.noCollide) solid += n; });
  assert.ok(meshes < 140, `merged by material (${meshes} meshes)`);
  assert.ok(tris < 600_000, `triangles (${Math.round(tris / 1000)} k)`);
  assert.ok(solid < 60_000, `collision triangles (${Math.round(solid / 1000)} k)`);
});
