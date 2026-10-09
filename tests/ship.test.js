import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { GameState } from '../src/game-state.js';
import { Ship } from '../src/ship/ship.js';
import { DECK, R, LIFT, WINDOW } from '../src/ship/hull.js';
import { CONSOLE_R, inRooms } from '../src/ship/interior.js';
import { findShipSite, siteAvoid, probeSite, SITE_OVERRIDES } from '../src/ship/sites.js';
import { consoleAction, mapEntries, chartLayout, boxRect } from '../src/ship/starmap.js';
import { pendingCall, callLines, completedWorlds, applyCall, CALL_COUNT, ILEN_CALL, PROLOGUE_CALL, AGE, REEL, REEL_FROM, recordingLabel, recordingSpan, onHologram } from '../src/story/calls.js';
import { holoLayout, mouthOpen, HOLO, BUST, PEOPLE, holoLook } from '../src/ship/hologram.js';
import { makeMaterial, MODE_OUTFIT, MODE_EYE } from '../src/materials.js';
import { ENDING_WORLDS } from '../src/story/ending.js';
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
  assert.ok(Math.abs(deckY - LIFT) < 0.05, `the deck stands ${LIFT} m up on its legs: ${deckY.toFixed(2)}`);
  // every room has floor under it
  for (const [name, p] of Object.entries({ bunk: m.interior.points.bunkStand, cockpit: m.interior.points.cockpit, hatch: m.interior.points.hatchIn, table: v(1.4, DECK, -3.1), galley: v(-1.9, DECK, -4.4), cabin: v(0.4, DECK, 4.4), hold: v(0, DECK, 7.4) })) {
    const w = ship.world(m, p);
    const g = physics.groundAt(w.x, w.y + 1.5, w.z, 4);
    assert.ok(Math.abs(g - deckY) < 0.05, `floor under the ${name}: ${g.toFixed(2)} vs ${deckY.toFixed(2)}`);
  }
  // the cockpit: the console is solid, and the window is glass (you can't walk out of it)
  const stand = ship.world(m, m.interior.points.cockpit).add(v(0, 0.6, 0));
  const fwd = ship.world(m, m.interior.points.projector).setY(stand.y).sub(stand).normalize();
  assert.ok(physics.rayDistance(stand, fwd, 6) < 1.6, 'the console is in front of him');
  const high = ship.world(m, v(0.6, DECK + 2.1, -7.4));
  const out = ship.world(m, v(0.6, WINDOW.y1, WINDOW.z0)).sub(high).normalize();
  assert.ok(physics.rayDistance(high, out, 6) < 2.5, 'the cockpit window stops you');
  // the hull is closed except at the hatch: rays outward from the cabin hit it
  const bunk = ship.world(m, m.interior.points.bunkStand).add(v(0, 1.2, 0));
  for (const d of [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0)]) assert.ok(physics.rayDistance(bunk, d.applyQuaternion(m.group.quaternion), 12) < 4.5, 'the walls round the cabin');
  // a walk at the wall: the traveller stays inside
  const P = new Player(physics);
  P.opts.climb = false;   // (the ship turns climbing off indoors)
  P.pos.copy(ship.world(m, v(1.0, DECK + 0.05, 4.0)));
  const h = Math.atan2(1, 0) + m.group.rotation.y;   // starboard, into the hull
  for (let i = 0; i < 180; i++) P.update(1 / 60, { KeyW: true }, h + Math.PI);
  assert.ok(ship.isInside(m, P.pos), `still inside after walking into the wall: ${P.pos.toArray().map((n) => n.toFixed(2))}`);
  assert.ok(Math.abs(P.pos.y - deckY) < 0.05, `on the floor: ${P.pos.y.toFixed(2)} vs ${deckY.toFixed(2)}`);
  assert.ok(inRooms(ship.local(m, P.pos), { margin: 0 }), 'within the rooms');
});

test('walking straight from the corridor at the console gets you to it (the pilot seat stands in the way)', () => {
  const { physics, ship } = flatWorld();
  const m = ship.parked;
  ship.player = new Player(physics);
  const P = ship.player;
  P.opts.climb = false;
  P.pos.copy(ship.world(m, v(0.6, DECK + 0.05, -4.4)));   // (from the main room, by the holo table)
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

test('the holo table in the middle of the deck opens the galactic map; the dash is the voicemail', () => {
  const { physics, ship } = flatWorld();
  const m = ship.parked;
  ship.player = new Player(physics);
  ship.attach({ order: ORDER, levels: LEVELS, journal: { storyDone: () => false, seen: () => false }, titles: {} });
  ship.inside = true;
  const said = [];
  ship.cinema.say = (l) => said.push(l?.text ?? null);
  // beside the table: the map's prompt; E opens it (locked without power)
  ship.placePlayer(ship.world(m, m.interior.points.tableFoot.clone().add(v(1.1, 0, 0.3))), 0, true);
  assert.ok(ship.atTable() && !ship.atConsole());
  assert.match(ship.hud(), /^E galactic map/);
  ship.use();
  assert.ok(ship.map.open, 'the table opens the map');
  ship.map.toggle(false);
  // at the dash: the voicemail; with no message waiting it says so and opens nothing
  ship.placePlayer(ship.world(m, m.interior.points.cockpit), 0, true);
  assert.ok(ship.atConsole() && !ship.atTable());
  assert.equal(ship.hud(), 'E voicemail');
  ship.use();
  assert.ok(!ship.map.open, 'the dash no longer opens the map');
  assert.ok(said.includes('No new messages.'));
});

test('the ramp reaches the ground and the hatch is open to walk through', () => {
  const { physics, ship } = flatWorld();
  assert.ok(Math.abs(ship.rampFoot.y) < 0.2, `ramp foot on the ground: ${ship.rampFoot.y.toFixed(2)}`);
  // walk from the foot of the ramp, up, through the hatch, into the hall
  const P = new Player(physics);
  P.pos.copy(ship.rampFoot).add(v(0, 0.05, 0));
  const target = ship.world(ship.parked, ship.parked.interior.points.aboard);
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
  }
});

test('the site search does not hang on float noise (the browser and node found different Hangar spots)', () => {
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
  assert.ok(s.crash && s.crash.sink > 2 && s.crash.length > 30 && s.crash.length < 70, 'dug in at the end of a short skid: a forced landing on its belly, not a crash');
  assert.ok(Math.abs(s.crash.roll) < 0.01 && Math.abs(s.crash.pitch) < 0.01, 'upright: the deck inside is level, walking it never goes up and down');
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
  for (let d = -1.5; d <= 1.0; d += 0.05) for (let w = -0.5; w <= 0.5; w += 0.125) {
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

test('the consoles: the dash plays the waiting message; the holo table opens the galactic map, locked without power', () => {
  assert.equal(consoleAction({ at: 'table', powered: false, pendingCall: null }), 'locked');
  assert.equal(consoleAction({ at: 'table', powered: true, pendingCall: null }), 'map');
  assert.equal(consoleAction({ at: 'table', powered: true, pendingCall: 2 }), 'map', 'a waiting message never keeps the map shut');
  assert.equal(consoleAction({ at: 'dash', powered: true, pendingCall: 2 }), 'call');
  assert.equal(consoleAction({ at: 'dash', powered: false, pendingCall: 2 }), 'call', 'the voicemail plays without power');
  assert.equal(consoleAction({ at: 'dash', powered: true, pendingCall: null }), 'empty');
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

test('the galactic map spaces its worlds so no two discs or names overlap, in every chart size', () => {
  // the field beside the panel (or above it, upright): a desktop chart, a smaller window, a handheld, a phone
  // (measured in Chrome: 1600 x 900 and 1920 x 1080 give 900 x 720, 844 x 390 gives 591 x 351, 390 x 844 gives 374 x 544)
  const fields = { desktop: [900, 720], laptop: [880, 560], handheld: [591, 351], phone: [374, 544], 'small phone, sideways': [400, 320] };
  for (const [name, [W, H]] of Object.entries(fields)) {
    const L = chartLayout(ORDER.length, W, H);
    const rects = [...L.pts.map(([x, y]) => boxRect(x, y, L.box)), boxRect(L.home[0], L.home[1], L.homeBox)];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, `${name}: places ${i} and ${j} overlap`);
    }
    for (const r of rects) assert.ok(r.x0 >= 0 && r.x1 <= W && r.y0 >= 50 && r.y1 <= H + 0.5, `${name}: inside the field, under the title: ${JSON.stringify(r)}`);
    assert.ok(L.box.font >= 9.5, `${name}: names stay readable`);
  }
  const big = chartLayout(ORDER.length, ...fields.desktop);
  assert.equal(big.kind, 'ring', 'on a desktop the route rings round home');
  assert.ok(big.scale >= 0.9, `at (nearly) full size: ${big.scale}`);
  assert.equal(chartLayout(ORDER.length, ...fields.handheld).kind, 'snake', 'a handheld gets rows');
});

test('recordings: one per completed world, each heard once, the mother from the third', () => {
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
  assert.ok(callLines(1, { keepsake: { name: 'A gear tooth', kind: 'thing' } }).some((l) => l.who === 'you' && l.text.includes('a gear tooth')), 'he holds the keepsake up to them');
  assert.ok(callLines(2, { keepsake: { name: 'x', kind: 'song' } }).some((l) => /song/i.test(l.text)), 'he reacts to a song');
  assert.ok(callLines(3, { keepsake: { name: 'x', kind: 'person' } }).some((l) => l.who === 'mother' && /Who/.test(l.text)), 'she asks who you met');
  assert.ok(PROLOGUE_CALL.some((l) => l.text.replace(/\*/g, '').startsWith('My son, make us proud. Bring back something of value.')));
  // one call per world on the route; the mother's own call (Ilen) waits once he has been asked and the ship has flown on
  assert.equal(CALL_COUNT, ORDER.length);
  const flags = { 'calls.ilen.asked': true, 'calls.ilen.at': 'bazaar', 'ship.level': 'bazaar' };
  assert.equal(pendingCall({ flag: (k) => flags[k], completed: 0 }), null);
  flags['ship.level'] = 'edena';
  assert.equal(pendingCall({ flag: (k) => flags[k], completed: 0 }), ILEN_CALL);
  assert.ok(callLines(ILEN_CALL, { flag: (k) => flags[k] }).filter((l) => l.who === 'father' || l.who === 'mother').every((l) => l.who === 'mother'), 'her recording is hers alone');
  // what a call carries is set once it is heard
  const g2 = new GameState({ getItem: () => null, setItem: () => {} });
  applyCall(g2, callLines(6, { keepsake: { name: 'x', kind: 'song' }, flag: () => undefined }));
  assert.equal(g2.flag('calls.home'), true, 'the sixth call asks you home');
});

test('the recordings are old, and it shows a little more each time; they never answer him', () => {
  const flag = () => undefined;
  const at = (n) => callLines(n, { flag, completed: ['desert'], lastWorld: 'desert', keepsake: { id: 'x', name: 'A thing', kind: 'thing' } });
  // the first ones are just a new message: nobody says what they are ("don't tell me I'm playing a
  // recording of my dad"); once the third has given their age away, he asks the reel for the world's word
  for (let n = 1; n < ENDING_WORLDS; n++) {
    const L = at(n);
    if (n < REEL_FROM) {
      assert.ok(L.some((l) => l.who === 'ship' && /new message/i.test(l.text)), `${n}: a new message`);
      // (only the third's last word gives it away: "Recording logged nineteen years ago")
      assert.ok(!L.slice(0, -1).some((l) => (l.who === 'ship' || l.who === 'you') && /\b(reel|recording|recorded)\b/i.test(l.text)), `${n}: nobody says recording`);
    } else assert.ok(L.some((l) => l.who === 'you' && l.text.includes(`anything about ${REEL.desert.word}`)), `${n}: he asks the reel for water`);
    assert.ok(L.some((l) => l.who === 'father' && l.text === REEL.desert.find.replace(/^~\w+~ /, '')), `${n}: the line it finds`);
    assert.ok(recordingSpan(L), `${n}: the parents are on it`);
    assert.ok(!L.some((l) => /\bcall\b/i.test(l.text) && l.who === 'ship'), `${n}: nobody calls`);
  }
  // no date at first; then a worn stamp; then years
  assert.equal(recordingLabel(1), '');
  assert.match(recordingLabel(2), /WORN/);
  for (const n of [3, 4, 5]) assert.match(recordingLabel(n), /YEARS AGO/);
  assert.ok(!at(1).some((l) => /years ago/i.test(l.text)), 'the first says nothing about when');
  assert.ok(at(3).some((l) => l.who === 'scene' && /child’s voice/.test(l.text) && /your voice/.test(l.text)), 'his own voice behind them, a child');
  assert.ok(at(3).some((l) => l.who === 'ship' && /nineteen years ago/.test(l.text)), 'the ship logs the date');
  assert.ok(at(4).some((l) => /tape is worn/.test(l.text)), 'a worn tape');
  assert.ok(at(5).some((l) => l.who === 'mother' && /one day you will/.test(l.text)));
  const last = at(ENDING_WORLDS);
  assert.ok(last.some((l) => l.who === 'ship' && /last recording on the reel/.test(l.text) && /house went quiet/.test(l.text)), 'the last one, before the house went quiet');
  assert.equal(recordingLabel(ENDING_WORLDS), 'THE LAST RECORDING');
  // who stands on the hologram
  assert.equal(onHologram('prologue'), 'father');
  assert.equal(onHologram(1), 'father');
  assert.equal(onHologram(3), 'both');
  assert.equal(onHologram(ILEN_CALL), 'mother');
  assert.ok(Object.keys(AGE).length === ENDING_WORLDS - 1);
  // the prologue's is a message on the voicemail: nothing says it is a recording
  assert.ok(PROLOGUE_CALL[0].who === 'ship' && /new message/i.test(PROLOGUE_CALL[0].text));
  assert.ok(!PROLOGUE_CALL.some((l) => l.who === 'ship' && /reel|record/i.test(l.text)));
});

test('the hologram: who stands where, and a mouth that only moves while they speak', () => {
  assert.deepEqual(holoLayout('father').map((f) => f.id), ['father']);
  assert.deepEqual(holoLayout('both').map((f) => f.id), ['father', 'mother']);
  assert.deepEqual(holoLayout('three').map((f) => f.id), ['father', 'child', 'mother']);
  const both = holoLayout('both');
  assert.ok(both[0].x < 0 && both[1].x > 0, 'side by side');
  assert.equal(mouthOpen(1.3, false), 0);
  let open = 0;
  for (let t = 0; t < 3; t += 0.05) { const m = mouthOpen(t, true); assert.ok(m >= 0 && m <= 1); open = Math.max(open, m); }
  assert.ok(open > 0.6, 'it opens');
  assert.equal(HOLO.live(), false, 'nothing drawn until a recording plays');
});

test('the hologram: coloured busts of who they were, the father and the mother as their selected designs', () => {
  // busts: cut below the chest, the bottom edge just over the lens
  for (const k of ['m', 'f']) {
    const B = BUST[k];
    assert.ok(B.bottom < B.top && B.top < 1.4 && B.bottom > 1.05, 'the cut falls across the chest');
    assert.ok(B.head - B.bottom < 0.8, 'head, neck, shoulders and the top of the chest only');
  }
  for (const who of ['father', 'both', 'three']) for (const L of holoLayout(who)) assert.ok(L.y >= BUST.lift && L.y < 0.2, 'each bust sits just over the lens');
  // their own colours, not one tint: each mesh's ink material is read as it is
  // (references/Home/characters: the father clean-shaven, short grey hair; the mother's silver bun)
  assert.equal(PEOPLE.father.look.mask, 'none', 'the father is clean-shaven');
  assert.ok(!PEOPLE.father.moustache, 'no moustache');
  assert.ok(PEOPLE.father.family && PEOPLE.mother.family, 'both wear the family’s looks (src/characters/family.js)');
  assert.notEqual(PEOPLE.father.palette.cloth, PEOPLE.mother.palette.cloth, 'the two dress differently');
  assert.notEqual(PEOPLE.father.look.head, PEOPLE.mother.look.head, 'and wear their hair differently');
  const body = holoLook(makeMaterial({ color: '#b5473a', color2: '#2b2f45', mode: MODE_OUTFIT, skin: '#dba985' }));
  assert.equal(body.uKind.value, 2, 'the body: clothes by region');
  assert.equal(body.uColor.value.getHexString(), 'b5473a');
  assert.equal(body.uSkin.value.getHexString(), 'dba985');
  assert.equal(holoLook(makeMaterial({ color: '#ffffff', mode: MODE_EYE })).uKind.value, 3, 'the eyes');
  assert.equal(holoLook(makeMaterial({ color: '#ffffff', vertexColors: true }), true).uKind.value, 1, 'costumes: per vertex');
  assert.equal(holoLook(new THREE.MeshBasicMaterial({ color: '#5f3c27' })).uColor.value.getHexString(), '5f3c27', 'plain pieces: their colour');
});

test('a recording: the shot pushes in on the bust while it is up', async () => {
  const { callShot, CALL_FACE, HOLO_SCALE } = await import('../src/ship/cinematics.js');
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: v(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: 1.1 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } } }));
  const m = ship.parked;
  const proj = ship.world(m, m.interior.points.projector);
  const wide = callShot(ship, m, 0, 0), close = callShot(ship, m, 0, 1);
  assert.ok(close.pos.distanceTo(proj) < wide.pos.distanceTo(proj) - 0.3, 'closer to the hologram');
  assert.ok(close.fov < wide.fov, 'and tighter');
  assert.ok(Math.abs(close.look.y - (proj.y + CALL_FACE)) < 0.2, 'looking at the face of a bust, not over a whole body');
  assert.ok(CALL_FACE > 0.3 && CALL_FACE < 0.7 && HOLO_SCALE > 0.6, 'a bust near life size, its face near his');
});

test('a recording at the console: the traveller faces the projector, the camera behind him', async () => {
  const { CallDirector, callShot } = await import('../src/ship/cinematics.js');
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: v(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: 1.1 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } } }));
  ship.player = new Player(physics);
  ship.sound = {};
  ship.rig = { yaw: 0, pitch: 0.2, indoor: false, indoorK: 0, target: v() };
  ship.player.heading = 2.5;   // looking anywhere else
  ship.holo = { show() {}, hide() {}, speak() {}, clear() {}, glitch() {} };   // (no hologram renderer in node)
  const lines = callLines(3, { flag: () => undefined, completed: ['desert'], lastWorld: 'desert' });
  const dir = new CallDirector(ship, { n: 3, lines, label: recordingLabel(3) });
  ship.cinematic = dir;
  dir.start();
  dir.update(1 / 30, false);
  const m = ship.parked, P = ship.player;
  const proj = ship.world(m, m.interior.points.projector);
  const toProj = Math.atan2(proj.x - P.pos.x, proj.z - P.pos.z);
  const off = Math.atan2(Math.sin(P.heading - toProj), Math.cos(P.heading - toProj));
  assert.ok(Math.abs(off) < 0.25, `he faces the recording (${off.toFixed(2)} rad off)`);
  const shot = callShot(ship, m, 0);
  const camToHim = P.pos.clone().sub(shot.pos).setY(0).normalize(), facing = v(Math.sin(P.heading), 0, Math.cos(P.heading));
  assert.ok(camToHim.dot(facing) > 0.5, 'the camera is behind him, looking the way he looks');
  assert.ok(shot.pos.distanceTo(proj) > P.pos.distanceTo(proj), 'he stands between the camera and the hologram');
  // the holo table stands beyond the busts from where he is: its planet folds away while they are up, and comes back
  assert.ok(m.holoTable, 'a holo table');
  for (let i = 0; i < 30 * 20 && !(dir.rec.close > 0.95); i++) dir.update(1 / 30, false);
  assert.ok(dir.rec.close > 0.95 && m.holoTable.group.scale.x < 0.1, `the planet folded away while the busts are up (${m.holoTable.group.scale.x.toFixed(2)})`);
  dir.finish(true);
  assert.equal(m.holoTable.group.scale.x, 1, 'and back once the recording ends');
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

test('the prologue never walks you: you stand in the bunk room for minutes, then press the voicemail button at the console', async () => {
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
  ship.cinematic = prologue;
  prologue.start();
  const dt = 1 / 30, P = ship.player;
  const tick = (keys = {}) => { const ctl = ship.input(keys); P.update(dt, ctl, 0); prologue.update(dt); };
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
  // no lights on the floor lead the way: the voicemail button blinks on the dash
  const m = ship.spaceCopy.model;
  assert.equal(m.interior.guide, undefined, 'no guide on the floor');
  assert.equal(ship.messageWaiting(), m, 'the voicemail button blinks');
  assert.equal(ship.hud(), null, 'no prompt away from the console');
  ship.blinkVoicemail(m, ship.messageWaiting() === m, 0.4);
  assert.ok(m.vmailLight && m.vmailLight.w > 0, 'it lights the dash round it');
  // you get there yourself: the prompt says what E does, and E plays the message
  ship.placePlayer(ship.world(m, m.interior.points.cockpit), 0, true);
  for (let i = 0; i < 5; i++) tick();
  assert.equal(prologue.stage, 'walk', 'standing at the console is not enough');
  assert.equal(ship.hud(), 'E voicemail');
  tick({ KeyE: true }); tick({ KeyE: true }); tick();
  assert.equal(prologue.stage, 'call', 'the voicemail button starts the message');
  assert.equal(ship.messageWaiting(), null, 'and it stops blinking');
  assert.equal(autopilots, 0);
});

test('a recording cuts between angles at its lines, its words and timing untouched (the QC pass: one push-in for 25–77 s)', async () => {
  const { callCuts, cutAt, callAngle, callShot, CALL_CUTS } = await import('../src/ship/cinematics.js');
  const { callTimeline } = await import('../src/ship/prologue.js');
  const ctx = { flag: () => undefined, completed: ['desert', 'incal', 'arzach', 'arzach2', 'garage', 'buried'], lastWorld: 'buried' };
  for (const n of [1, 3, 6, ILEN_CALL]) {
    const lines = callLines(n, ctx), tl = callTimeline(lines), span = recordingSpan(lines);
    const cuts = callCuts(tl, span);
    assert.equal(cuts[0].angle, 'over', `${n}: it opens on the push-in`);
    const fold = tl.lines[span[1]].t1 + 0.15;
    assert.equal(cutAt(cuts, fold + 0.01).angle, 'over', `${n}: and folds back into it`);
    for (let i = 1; i < cuts.length; i++) {
      assert.notEqual(cuts[i].angle, cuts[i - 1].angle, `${n}: never the same angle twice running`);
      const gap = cuts[i].t - cuts[i - 1].t;
      const atFold = Math.abs(cuts[i].t - fold) < 1e-9;
      if (!atFold) assert.ok(gap >= CALL_CUTS.min - 1e-6, `${n}: each held ${CALL_CUTS.min} s at least (${gap.toFixed(1)})`);
      if (!atFold) assert.ok(tl.lines.some((l) => Math.abs(l.t0 - cuts[i].t) < 1e-9), `${n}: a cut on a line's start, or the fold`);
    }
    const kinds = new Set(cuts.map((c) => c.angle));
    if (tl.total > 30) assert.ok(kinds.size >= 3, `${n}: a long one (${tl.total.toFixed(0)} s) has three angles or more (${[...kinds]})`);
    assert.equal(cutAt(cuts, 0).angle, 'over');
  }
  assert.deepEqual(callCuts({ lines: [{ line: { who: 'ship' }, t0: 0.9, t1: 3 }], total: 3 }, null), [{ t: 0, angle: 'over' }], 'no busts: one angle');
  // the angles themselves: inside the main room, clear of the console and the lockers, him or the busts in frame
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: v(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: 1.1 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } } }));
  const m = ship.parked;
  const head = ship.world(m, m.interior.points.cockpit).add(v(0, 1.55, 0));
  const face = ship.world(m, m.interior.points.projector).add(v(0, 0.5, 0));
  for (const a of ['bust', 'listen', 'window']) {
    const s = callAngle(ship, m, a, 0), s2 = callAngle(ship, m, a, 6);
    assert.ok(s && s2.pos.distanceTo(s.pos) < 0.45, `${a}: a slow push, no jump`);
    const subject = a === 'bust' ? face : head;
    const to = subject.clone().sub(s.pos), d = to.length();
    assert.ok(physics.rayDistance(s.pos, to.clone().normalize(), d) >= d - 0.35, `${a}: nothing between the lens and what it frames`);
    const look = s.look.clone().sub(s.pos).normalize();
    assert.ok(look.angleTo(to.normalize()) < THREE.MathUtils.degToRad(s.fov * 0.6), `${a}: in frame`);
    assert.ok(s.pos.distanceTo(callShot(ship, m, 0, 1).pos) > 0.6, `${a}: a different place from the push-in`);
  }
  assert.equal(callAngle(ship, m, 'over', 0), null);
});
