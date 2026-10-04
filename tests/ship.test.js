import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { GameState } from '../src/game-state.js';
import { Ship } from '../src/ship/ship.js';
import { DECK, R } from '../src/ship/hull.js';
import { polar } from '../src/ship/geo.js';
import { CONSOLE_R } from '../src/ship/interior.js';
import { findShipSite, siteAvoid, probeSite, SITE_OVERRIDES } from '../src/ship/sites.js';
import { consoleAction, mapEntries, StarMap } from '../src/ship/starmap.js';
import { pendingCall, callLines, completedWorlds, applyCall, CALL_COUNT, ILEN_CALL, PROLOGUE_CALL } from '../src/story/calls.js';
import { Prologue, PROLOGUE_STAGES } from '../src/ship/prologue.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** A flat test world: a ground plane, the ship parked at the origin, hatch facing +x. */
function flatWorld() {
  const scene = new THREE.Scene();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2));
  scene.add(ground);
  const physics = new Physics(scene);
  const level = { spawn: v(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } } }));
  return { scene, physics, level, ship };
}

test('the ship builds, with a walkable floor, a solid hull and a cockpit you can stand in', () => {
  const { physics, ship } = flatWorld();
  const m = ship.parked;
  const deckY = ship.world(m, v(0, DECK, 0)).y;
  assert.ok(deckY > 3 && deckY < 6, `the deck stands a few metres up on its legs: ${deckY.toFixed(2)}`);
  // every room has floor under it
  for (const [name, p] of Object.entries({ bunk: m.interior.points.bunkStand, cockpit: m.interior.points.cockpit, hatch: m.interior.points.hatchIn, corridor: polar(2.4, 1, DECK), galley: polar(6, Math.PI * 1.5 + 0.6, DECK) })) {
    const w = ship.world(m, p);
    const g = physics.groundAt(w.x, w.y + 1.5, w.z, 4);
    assert.ok(Math.abs(g - deckY) < 0.05, `floor under the ${name}: ${g.toFixed(2)} vs ${deckY.toFixed(2)}`);
  }
  // the cockpit: the console is solid, and the window is glass (you can't walk out of it)
  const stand = ship.world(m, m.interior.points.cockpit).add(v(0, 0.6, 0));
  const fwd = ship.world(m, polar(9, Math.PI, DECK + 0.6)).sub(stand).normalize();
  assert.ok(physics.rayDistance(stand, fwd, 6) < 1.6, 'the console is in front of the pilot');
  const high = ship.world(m, polar(8.6, Math.PI, DECK + 2.2));
  const out = ship.world(m, polar(14, Math.PI, DECK + 2.2)).sub(high).normalize();
  assert.ok(physics.rayDistance(high, out, 6) < 3, 'the cockpit window stops you');
  // the hull is closed except at the hatch: a ray outward from the bunk room hits it
  const bunk = ship.world(m, m.interior.points.bunkStand).add(v(0, 1.2, 0));
  const away = bunk.clone().sub(ship.world(m, v(0, DECK + 1.2, 0))).setY(0).normalize();
  assert.ok(physics.rayDistance(bunk, away, 12) < 4, 'the hull wall behind the bunk');
  // a walk at the wall: the traveller stays inside
  const P = new Player(physics);
  P.opts.climb = false;   // (the ship turns climbing off indoors)
  P.pos.copy(ship.world(m, polar(6, -0.2, DECK + 0.05)));
  for (let i = 0; i < 180; i++) P.update(1 / 60, { KeyW: true }, -0.2 + Math.PI);   // walk outward (heading -0.2), into the hull
  assert.ok(ship.isInside(m, P.pos), `still inside after walking into the wall: ${P.pos.toArray().map((n) => n.toFixed(2))}`);
  // (the hull curves up from the floor like a bowl, so you can lean a little way up it, never through it)
  assert.ok(P.pos.y > deckY - 0.1 && P.pos.y < deckY + 3, `on the floor or the foot of the wall: ${P.pos.y.toFixed(2)} vs ${deckY.toFixed(2)}`);
  assert.ok(Math.hypot(P.pos.x, P.pos.z) < R, 'within the hull');
});

test('walking straight from the corridor at the console gets you to it (the pilot seat stands in the way)', () => {
  const { physics, ship } = flatWorld();
  const m = ship.parked;
  ship.player = new Player(physics);
  const P = ship.player;
  P.opts.climb = false;
  P.pos.copy(ship.world(m, polar(2.4, Math.PI - 0.3, DECK + 0.05)));
  const target = ship.world(m, m.interior.points.cockpit);
  for (let i = 0; i < 60 * 8 && !ship.atConsole(); i++) {
    const h = Math.atan2(target.x - P.pos.x, target.z - P.pos.z);
    P.update(1 / 60, { KeyW: true }, h + Math.PI);
  }
  assert.ok(ship.atConsole(), `at the console: ${ship.local(m, P.pos).toArray().map((n) => n.toFixed(2))}`);
  // and with room to spare: keep walking into the seat, and you are well inside the reach
  for (let i = 0; i < 120; i++) { const h = Math.atan2(target.x - P.pos.x, target.z - P.pos.z); P.update(1 / 60, { KeyW: true }, h + Math.PI); }
  const l = ship.local(m, P.pos), c = m.interior.points.cockpit;
  assert.ok(Math.hypot(l.x - c.x, l.z - c.z) < CONSOLE_R - 0.3, `stopped ${Math.hypot(l.x - c.x, l.z - c.z).toFixed(2)} m from the cockpit point`);
});

test('at the foot of the ramp E goes aboard on foot, but gets you off a vehicle first', () => {
  const { physics, ship } = flatWorld();
  ship.player = new Player(physics);
  ship.player.pos.copy(ship.rampFoot);
  ship.player.ride = { kind: 'bike', pos: ship.rampFoot.clone() };
  assert.equal(ship.hud(), null, 'no "go aboard" while riding');
  const out = ship.input({ KeyE: true });
  assert.ok(out.KeyE && !ship.auto, 'E passes through to the player (dismount)');
  ship.input({});
  ship.player.ride = null;
  assert.equal(ship.hud(), 'E go aboard');
  const out2 = ship.input({ KeyE: true });
  assert.ok(!out2.KeyE && ship.auto, 'on foot, E walks you aboard');
});

test('the ramp reaches the ground and the hatch is open to walk through', () => {
  const { physics, ship } = flatWorld();
  assert.ok(Math.abs(ship.rampFoot.y) < 0.2, `ramp foot on the ground: ${ship.rampFoot.y.toFixed(2)}`);
  // walk from the foot of the ramp, up, through the hatch, into the hall
  const P = new Player(physics);
  P.pos.copy(ship.rampFoot).add(v(0, 0.05, 0));
  const target = ship.world(ship.parked, polar(5.5, Math.PI / 2, DECK));
  for (let i = 0; i < 60 * 8 && P.pos.distanceTo(target) > 0.8; i++) {
    const h = Math.atan2(target.x - P.pos.x, target.z - P.pos.z);
    P.update(1 / 60, { KeyW: true }, h + Math.PI);
  }
  assert.ok(ship.isInside(ship.parked, P.pos), `walked aboard: ${P.pos.toArray().map((n) => n.toFixed(2))}`);
});

test('a flat, clear spot is found near the spawn in real levels', () => {
  for (const id of ['spheres', 'edena', 'bazaar', 'buried', 'garage']) {
    const meta = LEVELS.find((l) => l.id === id);
    const scene = new THREE.Scene();
    const level = quiet(() => meta.create(scene));
    const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
    level.init?.(physics);
    const avoid = siteAvoid({ level, content: CONTENT[id] });
    const site = findShipSite({ level, physics, levelId: id, avoid });
    assert.ok(site, `${id}: a site`);
    const d = Math.hypot(site.x - level.spawn.x, site.z - level.spawn.z);
    assert.ok(d < 160, `${id}: near the spawn (${d.toFixed(0)} m)`);
    const probe = probeSite(physics, site.x, site.z, site.heading, { refY: level.spawn.y });
    assert.ok(probe && probe.spread < 2.6, `${id}: flat (${probe?.spread.toFixed(2)} m)`);
    for (const a of avoid) assert.ok(Math.hypot(site.x - a.x, site.z - a.z) > a.r + R - 0.01, `${id}: clear of ${JSON.stringify(a)}`);
    const g = CONTENT[id].gate.at;
    assert.ok(Math.hypot(site.x - g[0], site.z - g[1]) > 24 + R - 0.01, `${id}: away from the gate`);
  }
});

test('the site search does not hang on float noise (the browser and node found different Garage spots)', () => {
  const meta = LEVELS.find((l) => l.id === 'garage');
  const scene = new THREE.Scene();
  const level = quiet(() => meta.create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const avoid = siteAvoid({ level, content: CONTENT.garage });
  const a = findShipSite({ level, physics, levelId: 'garage', avoid });
  // the same collision, give or take 1e-12 m of noise
  const g = physics.groundAt.bind(physics);
  let seed = 1;
  physics.groundAt = (...args) => g(...args) + (((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5) * 2e-12;
  const b = findShipSite({ level, physics, levelId: 'garage', avoid });
  assert.deepEqual([b.x, b.z, b.heading], [a.x, a.z, a.heading]);
});

test('the desert crash site faces Qanat, and the city shows on the horizon from the ramp', async () => {
  const { desertHeight } = await import('../src/desert-landmarks.js');
  const s = SITE_OVERRIDES.desert, city = { x: 230, z: 400 };
  assert.ok(Math.hypot(s.x, s.z) < 160, 'near the old camp');
  assert.ok(s.crash && Math.abs(s.crash.roll) + Math.abs(s.crash.pitch) > 0.05 && s.crash.length > 60, 'dug in and tilted');
  const toCity = Math.atan2(city.x - s.x, city.z - s.z);
  assert.ok(Math.abs(Math.atan2(Math.sin(toCity - s.heading), Math.cos(toCity - s.heading))) < 0.2, 'the hatch faces the city');
  // from eye height at the foot of the ramp, nothing in the dunes rises above the line to the city walls
  const dx = Math.sin(s.heading), dz = Math.cos(s.heading), fx = s.x + dx * 18, fz = s.z + dz * 18;
  const eye = desertHeight(fx, fz) + 1.7, wall = desertHeight(city.x, city.z) + 10, D = Math.hypot(city.x - fx, city.z - fz);
  for (let t = 8; t < D - 40; t += 4) {
    const k = t / D, x = fx + (city.x - fx) * k, z = fz + (city.z - fz) * k;
    assert.ok(eye + (wall - eye) * k > desertHeight(x, z), `a dune hides the city ${t.toFixed(0)} m out`);
  }
});

test('the floor is continuous from the entry hall over the threshold onto the ramp: no gap to fall through', () => {
  const { physics, ship } = flatWorld();
  const h = ship.hinge, out = ship.rampFoot.clone().sub(h).setY(0).normalize(), side = v(-out.z, 0, out.x);
  const run = ship.rampFoot.clone().sub(h).setY(0).length(), slope = (h.y - ship.rampFoot.y) / run;
  // from 1.5 m inside the hinge to 1 m down the ramp, across the doorway's width
  for (let d = -1.5; d <= 1.0; d += 0.05) for (let w = -0.8; w <= 0.8; w += 0.2) {
    const p = h.clone().addScaledVector(out, d).addScaledVector(side, w);
    const g = physics.groundAt(p.x, h.y + 1, p.z, 30);
    const want = h.y - Math.max(0, d) * slope;   // the deck and threshold are level; the ramp descends from the hinge
    assert.ok(Math.abs(g - want) < 0.25, `floor at ${d.toFixed(2)} m from the hinge, ${w.toFixed(1)} m across: ${(g - want).toFixed(2)}`);
  }
  // and the traveller walks out over it without dropping
  const P = new Player(physics);
  P.opts.climb = false;
  P.pos.copy(h).addScaledVector(out, -1.5).add(v(0, 0.05, 0));
  const heading = Math.atan2(out.x, out.z);
  let lowest = Infinity;
  for (let i = 0; i < 90 && P.pos.clone().sub(h).dot(out) < 0.6; i++) {
    P.update(1 / 60, { KeyW: true }, heading + Math.PI);
    if (P.pos.clone().sub(h).dot(out) < 0.2) lowest = Math.min(lowest, P.pos.y);   // over the deck and the threshold
  }
  assert.ok(P.pos.clone().sub(h).dot(out) >= 0.6, 'out past the hinge onto the ramp');
  assert.ok(lowest > h.y - 0.3, `no fall at the threshold: lowest ${(lowest - h.y).toFixed(2)} m`);
});

test('the console: a waiting call first; the galactic map is locked without power', () => {
  assert.equal(consoleAction({ powered: false, pendingCall: null }), 'locked');
  assert.equal(consoleAction({ powered: true, pendingCall: null }), 'map');
  assert.equal(consoleAction({ powered: true, pendingCall: 2 }), 'call');
  const flags = { 'world.incal.done': true };
  const journal = { storyDone: (id) => id === 'desert', seen: (id) => id === 'arzach' };
  const list = mapEntries({ order: ORDER, levels: LEVELS, flag: (k) => flags[k], journal, current: 'incal' });
  assert.equal(list.length, ORDER.length);
  const by = Object.fromEntries(list.map((e) => [e.id, e]));
  assert.ok(by.desert.done && by.desert.visited, 'desert story page counts as done');
  assert.ok(by.incal.done && by.incal.current, 'world.<id>.done counts as done');
  assert.ok(by.arzach.visited && !by.arzach.done);
  assert.ok(!by.bazaar.visited);
  assert.equal(by.incal.title, LEVELS.find((l) => l.id === 'incal').title);
});

test('the galactic map spaces its worlds so no two discs or names overlap, clear of the info panel', () => {
  const pts = new StarMap({}).layout(ORDER.length);
  const W = 1100, H = 680;   // the chart at its full size
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const dx = ((pts[i][0] - pts[j][0]) / 100) * W, dy = ((pts[i][1] - pts[j][1]) / 100) * H;
    assert.ok(Math.abs(dx) > 92 || Math.abs(dy) > 105, `worlds ${i} and ${j} overlap (${dx.toFixed(0)}, ${dy.toFixed(0)} px)`);
  }
  for (const [x, y] of pts) assert.ok(x > 5 && x < 64 && y > 12 && y < 88, `on the chart, left of the panel: ${x.toFixed(0)}%, ${y.toFixed(0)}%`);
  // a phone held upright: a 353 x 700 px chart, the panel along its bottom fifth
  const P = new StarMap({}).layout(ORDER.length, { portrait: true });
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const dx = ((P[i][0] - P[j][0]) / 100) * 353, dy = ((P[i][1] - P[j][1]) / 100) * 700;
    assert.ok(Math.abs(dx) > 98 || Math.abs(dy) > 100, `portrait: worlds ${i} and ${j} overlap (${dx.toFixed(0)}, ${dy.toFixed(0)} px)`);
  }
  for (const [x, y] of P) assert.ok(x > 10 && x < 90 && y > 10 && y < 64, `portrait: above the panel: ${x.toFixed(0)}%, ${y.toFixed(0)}%`);
});

test('calls home: one per completed world, each heard once, the mother from the third', () => {
  const store = new Map();
  const game = new GameState({ getItem: (k) => store.get(k) ?? null, setItem: (k, val) => store.set(k, val) });
  const flag = (k) => game.flag(k);
  const done = new Set();
  const completed = () => completedWorlds(ORDER, { flag, storyDone: (id) => done.has(id) }).length;
  assert.equal(pendingCall({ flag, completed: completed() }), null, 'nothing to hear before any world is done');
  done.add('desert');
  assert.equal(pendingCall({ flag, completed: completed() }), 1);
  game.set('calls.1', true);
  assert.equal(pendingCall({ flag, completed: completed() }), null, 'call 1 is heard once');
  game.set('world.incal.done', true);
  game.set('world.arzach.done', true);
  assert.equal(pendingCall({ flag, completed: completed() }), 2);
  game.set('calls.2', true);
  assert.equal(pendingCall({ flag, completed: completed() }), 3);
  game.set('calls.3', true);
  assert.equal(pendingCall({ flag, completed: completed() }), null);
  // persisted: a new state from the same storage remembers what was heard
  const again = new GameState({ getItem: (k) => store.get(k) ?? null, setItem: () => {} });
  assert.equal(pendingCall({ flag: (k) => again.flag(k), completed: 3 }), null);
  // who speaks, and what they react to
  for (let n = 1; n <= CALL_COUNT; n++) {
    const lines = callLines(n, { keepsake: { name: 'The bell note', kind: 'song' }, keepsakes: [{ kind: 'song' }] });
    assert.ok(lines.length >= 3, `call ${n} has lines`);
    assert.equal(lines.some((l) => l.who === 'mother'), n >= 3, `call ${n}: the mother ${n >= 3 ? 'joins' : 'is silent'}`);
  }
  assert.ok(callLines(1, { keepsake: { name: 'A gear tooth', kind: 'thing' } }).some((l) => l.text.includes('A gear tooth')), 'the keepsake is named');
  assert.ok(callLines(2, { keepsake: { name: 'x', kind: 'song' } }).some((l) => /song/i.test(l.text)), 'he reacts to a song');
  assert.ok(callLines(3, { keepsake: { name: 'x', kind: 'person' } }).some((l) => l.who === 'mother' && /Who/.test(l.text)), 'she asks who you met');
  assert.ok(PROLOGUE_CALL.some((l) => l.text === 'My son, make us proud. Bring back something of value.'));
  // one call per world on the route; the mother's own call (Ilen) waits once he has been asked and the ship has flown on
  assert.equal(CALL_COUNT, ORDER.length);
  const flags = { 'calls.ilen.asked': true, 'calls.ilen.at': 'bazaar', 'ship.level': 'bazaar' };
  assert.equal(pendingCall({ flag: (k) => flags[k], completed: 0 }), null);
  flags['ship.level'] = 'edena';
  assert.equal(pendingCall({ flag: (k) => flags[k], completed: 0 }), ILEN_CALL);
  assert.ok(callLines(ILEN_CALL, { flag: (k) => flags[k] }).every((l) => l.who === 'mother'), 'her call is hers alone');
  // what a call carries is set once it is heard
  const g2 = new GameState({ getItem: () => null, setItem: () => {} });
  applyCall(g2, callLines(6, { keepsake: { name: 'x', kind: 'song' }, flag: () => undefined }));
  assert.equal(g2.flag('calls.home'), true, 'the sixth call asks you home');
});

test('the prologue plays through to the end and sets prologue.done', () => {
  const store = new Map();
  const game = new GameState({ getItem: (k) => store.get(k) ?? null, setItem: (k, val) => store.set(k, val) });
  const seen = [];
  let walked = 0;
  const director = {
    enter: (id) => seen.push(id),
    frame: () => {},
    ready: (id, t) => (id === 'walk' ? (walked = t) > 5 : id === 'stepout' ? t > 2 : true),
    finish: (skipped) => seen.push(skipped ? 'skipped' : 'finished'),
  };
  const p = new Prologue({ director, game });
  p.start();
  let t = 0;
  while (!p.done && t < 400) { p.update(0.1); t += 0.1; }
  assert.ok(p.done, 'reached the end');
  assert.deepEqual(seen, [...PROLOGUE_STAGES.map((s) => s.id), 'finished']);
  assert.equal(game.flag('prologue.done'), true);
  assert.ok(t > 50 && t < 140, `about a minute and a half long (${t.toFixed(1)} s)`);
  // skipping: hold the button and it ends at once
  const g2 = new GameState({ getItem: () => null, setItem: () => {} });
  const seen2 = [];
  const p2 = new Prologue({ director: { ...director, enter: (id) => seen2.push(id), finish: (s) => seen2.push(s ? 'skipped' : 'finished') }, game: g2 });
  p2.start();
  for (let i = 0; i < 30; i++) p2.update(0.1, i > 5);
  assert.ok(p2.done && p2.skipped);
  assert.equal(seen2.at(-1), 'skipped');
  assert.equal(g2.flag('prologue.done'), true);
});

test('the walk to the cockpit waits as long as you like: no time limit', () => {
  // the state machine: a director that never says "ready" keeps it in the walk
  const g = new GameState({ getItem: () => null, setItem: () => {} });
  const p = new Prologue({ director: { enter() {}, frame() {}, ready: () => false, finish() {} }, game: g });
  p.start();
  for (let i = 0; i < 6000; i++) p.update(0.1);
  assert.equal(p.stage, 'walk', `still walking after ten minutes (${p.stage})`);
  assert.ok(p.interactive(), 'and the player has control');
});

test('the prologue never walks you: you stand in the bunk room for minutes, then the call starts at the console', async () => {
  const { PrologueDirector } = await import('../src/ship/cinematics.js');
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: v(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } }, prologue: true }));
  ship.site.crash ??= { travel: 0, length: 60 };
  ship.player = new Player(physics);
  ship.sound = {};   // silent (no audio context in node)
  ship.rig = { yaw: 0, pitch: 0.2, indoor: false, indoorK: 0, target: v(), clearYaw: (p, yaw) => yaw, snapTight() {} };
  let autopilots = 0;
  const auto = ship.autopilot.bind(ship);
  ship.autopilot = (...a) => { autopilots++; auto(...a); };
  const g = new GameState({ getItem: () => null, setItem: () => {} });
  const prologue = new Prologue({ director: new PrologueDirector(ship), game: g });
  prologue.start();
  const dt = 1 / 30, P = ship.player;
  const tick = () => { const ctl = ship.input({}); P.update(dt, ctl, 0); prologue.update(dt); };
  let t = 0;
  while (prologue.stage !== 'walk' && t < 30) { tick(); t += dt; }
  assert.equal(prologue.stage, 'walk');
  for (let i = 0; i < 30; i++) tick();   // settle on the floor
  const start = P.pos.clone();
  for (let i = 0; i < 180 / dt; i++) tick();   // three minutes, hands off the controls
  assert.equal(prologue.stage, 'walk', 'still waiting for you');
  assert.equal(autopilots, 0, 'the ship never took over');
  assert.equal(ship.auto, null);
  assert.ok(P.pos.distanceTo(start) < 0.3, `you stayed where you stood (${P.pos.distanceTo(start).toFixed(2)} m)`);
  // you get there yourself: the call starts
  const m = ship.spaceCopy.model;
  ship.placePlayer(ship.world(m, m.interior.points.cockpit), 0, true);
  for (let i = 0; i < 5; i++) tick();
  assert.equal(prologue.stage, 'call', 'at the console the call starts');
  assert.equal(autopilots, 0);
});
