// The light that goes down (issue #169: src/shaft-mirrors.js, src/story/light-down.js): the great mirror on the rim throws
// the sun across the City-Shaft to a chain of mirrors down the bell quarter, three of them knocked round. Each stands on
// a deck you walk out onto from its terrace; the chain is solvable by cranking, every crank of a wrong notch throws the
// light somewhere else, and the reward (the makers' chest on its rise on the bottom terrace) is reachable, shut until
// the light is down and open after.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setHintLevel } from '../src/hint-level.js';

setHintLevel('full');
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };

const { createIncal } = await import('../src/levels/incal.js');
const { Physics } = await import('../src/physics.js');
const { createStory } = await import('../src/story/index.js');
const { game, GameState } = await import('../src/game-state.js');
const { bestInteractable } = await import('../src/interact.js');
const { PLACEMENTS } = await import('../src/boxes/placements.js');
const { resolvePlacement } = await import('../src/boxes/index.js');
const { MIRRORS, NOTCHES, RISE, chainOf, clearBetween, mirrorRailGaps } = await import('../src/shaft-mirrors.js');

const quiet = (f) => { const w = console.warn, l = console.log; console.warn = console.log = () => {}; try { return f(); } finally { console.warn = w; console.log = l; } };
game.reset();
const scene = new THREE.Scene();
const level = quiet(() => createIncal(scene));
const physics = new Physics(scene, null);
level.init(physics);
const S = level.shaft, M = S.mirrors, places = M.places, end = M.end;
const shape = { R: S.R, TOP: S.TOP, BOTTOM: S.BOTTOM, terraces: S.terraces, bridges: S.bridges, viaducts: S.viaducts, SPIRE_R: S.SPIRE_R, SPIRE_RING: S.SPIRE_RING, LEVELS: S.LEVELS };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ground = (x, y, z) => physics.groundAt(x, y + 1.5, z, 4);
const starts = () => Object.fromEntries(places.map((m) => [m.id, m.start]));

test('the chain: the great mirror on the rim and four on the bell quarter’s terraces, each throwing the light lower', () => {
  assert.equal(places.length, MIRRORS.length, 'every mirror stands (each on a terrace sector at its angle)');
  assert.ok(places[0].great && !places[0].turnable, 'the rim’s follows the sun by itself');
  for (let i = 1; i < places.length; i++) assert.ok(places[i].y < places[i - 1].y, `${places[i].id} is lower than ${places[i - 1].id}`);
  assert.ok(end && end.y === S.BOTTOM + 90, 'the lit square is on the bottom terrace');
  const knocked = places.filter((m) => m.turnable && m.start !== 0);
  assert.equal(knocked.length, 3, 'three of them knocked round');
});

test('the level design audit counts every mirror’s deck as a place to stop (issue #174)', () => {
  const sights = (typeof level.sights === 'function' ? level.sights() : level.sights) ?? [];
  for (const m of places) assert.ok(sights.some((s) => s.at.distanceTo(m.deck) < 0.5), `${m.id}’s deck is a sight`);
});

test('every true line of the chain is clear of the city: the spire, its rings and bridges, the viaducts, the terraces', () => {
  const pts = [...places.map((m) => m.glass), end.target];
  for (let i = 0; i < pts.length - 1; i++) assert.ok(clearBetween(pts[i], pts[i + 1], shape), `${places[i].id} → ${places[i + 1]?.id ?? 'the square'} is blocked`);
});

test('each mirror’s deck is reached on foot from its terrace: ground on the gangway and the deck, a gap in the railing', () => {
  for (const m of places.filter((p) => p.turnable)) {
    const t = S.terraces.find((s) => s.y === m.y && mirrorRailGaps(s).length);
    assert.ok(t, `${m.id}: its terrace leaves a gap in the railing`);
    // from the promenade out along the gangway to the crank and the deck's middle: ground all the way, level with the terrace
    const a = m.a, out = V(-Math.cos(a), 0, -Math.sin(a));
    for (let d = -3; d <= m.r0 - m.deck.length() + 0.01 + 3; d += 0.5) {
      const p = V(Math.cos(a) * (m.r0 + 3), m.y, Math.sin(a) * (m.r0 + 3)).addScaledVector(out, d);
      if (Math.hypot(p.x, p.z) < m.deck.length() - 0.5) break;
      const g = ground(p.x, m.y, p.z);
      assert.ok(Number.isFinite(g) && Math.abs(g - m.y) < 0.45, `${m.id}: ground ${d.toFixed(1)} m in from the promenade (${g})`);
    }
    // nothing in the way at knee height from the promenade to the crank (the railing has its gap)
    const from = V(Math.cos(a) * (m.r0 + 3), m.y + 0.7, Math.sin(a) * (m.r0 + 3)), to = m.crank.clone().setY(m.y + 0.7);
    assert.ok(physics.rayDistance(from, to.clone().sub(from).normalize(), from.distanceTo(to)) >= from.distanceTo(to) - 0.05, `${m.id}: the way out to the crank is open`);
  }
});

test('the light starts stopped at the first knocked mirror, throwing a stray beam at the city', () => {
  const c = chainOf(places, end, starts(), shape);
  assert.equal(c.done, false);
  const first = places.findIndex((m) => m.turnable && m.start !== 0);
  assert.equal(c.stop, first, 'stopped at the first knocked-round mirror');
  const stray = c.segs.at(-1);
  assert.ok(stray.stray && stray.hit, `the stray beam lands somewhere (${stray.hit})`);
});

test('a wrong notch never throws the light onto the next mirror; cranking each round solves the chain', () => {
  for (let i = 1; i < places.length; i++) {
    const m = places[i], next = places[i + 1]?.glass ?? end.target;
    for (let n = 1; n < NOTCHES; n++) {
      const c = chainOf(places, end, { ...Object.fromEntries(places.map((p) => [p.id, 0])), [m.id]: n }, shape);
      assert.equal(c.stop, i, `${m.id} at notch ${n}: the light stops there`);
      assert.ok(c.segs.at(-1).to.distanceTo(next) > 4, `${m.id} at notch ${n}: its stray beam misses the next mirror`);
    }
  }
  // crank by crank, as a player would (one way round, a notch at a time), top down
  const notches = starts();
  let cranks = 0, c = chainOf(places, end, notches, shape);
  while (!c.done && cranks < 40) {
    const m = places[c.stop];
    notches[m.id] = (notches[m.id] + 1) % NOTCHES; cranks++;
    const next = chainOf(places, end, notches, shape);
    assert.ok(next.stop >= c.stop || next.done, 'the light never goes back up');
    c = next;
  }
  assert.ok(c.done, `solved in ${cranks} cranks`);
  assert.ok(cranks <= 3 * (NOTCHES - 1), 'at most a turn round for each');
  assert.equal(c.segs.length, places.length, 'one beam from each mirror, the last onto the square');
  assert.ok(c.segs.at(-1).to.distanceTo(end.target) < 0.01);
});

test('the reward: the makers’ chest on a smooth rise on the lit square, reachable from the Upward Shrine, shut until the light is down', () => {
  const p = PLACEMENTS.incal.find((x) => x.id === 'incal.sunglass');
  assert.ok(p, 'its placement');
  const at = resolvePlacement(p, { physics, level });
  assert.ok(at && Math.abs(at.pos.y - (end.y + RISE.h)) < 0.05, 'on top of the rise');
  // the rise: a smooth slope all round, no step (issue #162)
  for (let k = 0; k < 8; k++) {
    const b = (k / 8) * Math.PI * 2;
    let last = null;
    for (let r = RISE.foot + 0.8; r >= 0; r -= 0.2) {
      const x = end.at.x + Math.cos(b) * r, z = end.at.z + Math.sin(b) * r, g = ground(x, end.y + 1, z);
      assert.ok(Number.isFinite(g), 'ground on the rise');
      if (last !== null) assert.ok(Math.abs(g - last) < 0.2 * 0.4 + 0.01, `a smooth slope (the chests' mound, src/boxes/mound.js), no step (${(g - last).toFixed(2)} m in 0.2 m)`);
      last = g;
    }
  }
  // on foot from the shrine round the bottom terrace's promenade to the square
  const sh = S.places.shrine, a0 = Math.atan2(sh.z, sh.x), a1 = Math.atan2(end.at.z, end.at.x), r = end.r0 + 6;
  for (let u = 0; u <= 1; u += 0.02) {
    const a = a0 + (a1 - a0) * u, g = ground(Math.cos(a) * r, end.y, Math.sin(a) * r);
    assert.ok(Number.isFinite(g) && Math.abs(g - end.y) < 1, `the promenade carries on to the square (${(u * 100).toFixed(0)} %)`);
  }
  const g = new GameState();
  assert.equal(!!p.ready(g), false, 'shut in the shade');
  g.set('incal.beam.lit', true);
  assert.equal(!!p.ready(g), true, 'open once the light is down');
});

test('played: near a mirror the errand starts; its crank turns it a notch; the light reaches the square; standing in it ends the errand', () => {
  game.reset();
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const player = { pos: level.spawn.clone(), vel: V3(), heading: 0, riding: false, vehicles: [...level.vehicles], frame: { up: V3(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, critter() {} };
  const toasts = [], camera = new THREE.PerspectiveCamera();
  const rt = createStory({ levelId: 'incal', scene, physics, level, player, npcs: [], crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
  const { quests } = rt;
  let clock = 0;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { clock += 1 / 30; camera.position.copy(player.pos).add(V3(0, 2, 4)); rt.update(1 / 30, clock, { camera }); } };
  assert.equal(quests.isStarted('incal.beam'), false);
  for (const m of places.filter((x) => x.turnable)) {
    player.pos.copy(m.crank); step(2);
    assert.equal(quests.isStarted('incal.beam'), true, 'started on the deck');
    let n = 0;
    while (M.notch(m.id) !== 0 && n++ < NOTCHES) {
      const e = bestInteractable(player);
      assert.equal(e?.entry.id, `incal.beam.${m.id}`, `${m.id}: its crank is what E does on the deck`);
      e.entry.use();
    }
    assert.equal(M.notch(m.id), 0, `${m.id}: aligned`);
    if (m.start !== 0) assert.equal(game.flag(`incal.beam.${m.id}`), 0, 'its notch kept in the save');
  }
  assert.equal(game.flag('incal.beam.lit'), true, 'the light reaches the square');
  assert.ok(M.lit() && M.life.visible && M.pool.visible, 'stalls come out into the light');
  assert.ok(toasts.some((t) => /bottom terrace/.test(t)), 'one line says so');
  step(2);
  assert.equal(quests.stage('incal.beam'), 'square');
  player.pos.copy(end.at).add(V3(2, 0, 0)); step(3);
  assert.equal(quests.isDone('incal.beam'), true, 'reaching the lit square ends it');
  // a reload: the notches come back from the save, the light still down
  M.set(starts());
  assert.equal(M.lit(), false);
  M.set(Object.fromEntries(places.filter((x) => x.turnable).map((x) => [x.id, rt.world.lightDown.notch(x)])));
  assert.equal(M.lit(), true, 'the saved notches lay the light all the way down again');
});
