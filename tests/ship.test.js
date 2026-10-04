import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { GameState } from '../src/game-state.js';
import { Ship } from '../src/ship/ship.js';
import { DECK, R } from '../src/ship/hull.js';
import { polar } from '../src/ship/geo.js';
import { findShipSite, siteAvoid, probeSite, SITE_OVERRIDES } from '../src/ship/sites.js';
import { consoleAction, mapEntries } from '../src/ship/starmap.js';
import { pendingCall, callLines, completedWorlds, CALL_COUNT, PROLOGUE_CALL } from '../src/story/calls.js';
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

test('the desert crash site is on open sand 40-80 m from the spawn, dug in and tilted', () => {
  const s = SITE_OVERRIDES.desert;
  const d = Math.hypot(s.x, s.z);
  assert.ok(d >= 40 && d <= 80, `${d.toFixed(0)} m from the desert spawn`);
  assert.ok(s.crash && Math.abs(s.crash.roll) + Math.abs(s.crash.pitch) > 0.05 && s.crash.length > 60);
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
