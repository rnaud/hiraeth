// The Arena's run (issue #743, docs/systems/foes.md "The Arena"): every enemy in the game once (each built archetype in
// each of its skins, and the kinds that are no archetype's skin), one at a time in a shuffled order, the next when the
// last falls, a fresh shuffle after all; the battle music held between foes, one continuous fight.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES, WAVES, ARENA_FOES, ARENA_RUN, oneFoe, shuffled } from '../src/foes.js';
import { BUILT, ARCHETYPES, archetypeOfKind, parseKind } from '../src/enemies/archetypes.js';
import { HOME_SKIN } from '../src/enemies/skins.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
function player(at = v()) { return { pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: 0, knocks: 0, hurt() { this.hurts++; }, knockDown() { this.knocks++; return true; }, flinch() {} }; }
const arena = (P, { notes = [], rng = seeded(7), combat = [], foes: F = { waves: true } } = {}) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: F }, levelId: 'arena', physics: flat, player: P,
  settings: { enemies: 'normal' }, game: new GameState(null), notice: (t) => notes.push(t), rng, sound: { combat: (on) => combat.push(on), foeHurt() {}, foeBurst() {}, foeWarn() {}, whoosh() {} } });
const alive = (foes) => foes.list.filter((f) => f.alive);
const fell = (foes) => { for (const f of alive(foes)) foes.burst(f); };
const rest = (foes, s = ARENA_RUN.rest + 0.2) => { for (let t = 0; t < s; t += DT) foes.updateWaves(DT); };

test('the run’s list: every built archetype in its one look (#748) and every other kind, once each; one body (a flock its heap, a support its escort)', () => {
  const ids = ARENA_FOES.map((x) => x[0]);
  assert.equal(new Set(ids).size, ids.length, 'each once');
  for (const a of BUILT) assert.equal(ids.filter((id) => parseKind(id).kind === ARCHETYPES[a].kind).length, 1, `${a}: once`);
  for (const a of BUILT) assert.ok(ids.includes(`${ARCHETYPES[a].kind}@${HOME_SKIN[a]}`), `${a} in its one look`);
  // the kinds no skin covers (the makers' machine), every kind in the old waves there in some form
  for (const k of new Set(WAVES.flat())) assert.ok(ids.some((id) => parseKind(id).kind === k), k);
  assert.ok(ids.includes('machine'));
  assert.equal(ARENA_FOES.length, BUILT.length + Object.keys(FOES).filter((k) => !BUILT.includes(archetypeOfKind(k)) && !FOES[k].noWild).length);
  for (const x of ARENA_FOES) {
    const D = FOES[parseKind(x[0]).kind];
    assert.equal(x.length, (D.flock ? ARENA_RUN.flock : 1) + (D.escort ? 1 : 0), `${x[0]}: one enemy`);
    if (D.escort) assert.equal(parseKind(x.at(-1)).kind, D.escort);
  }
  assert.deepEqual(oneFoe('grunt', 'desert'), ['grunt@desert']);
  assert.deepEqual(oneFoe('lizard', 'bazaar'), ['lizard@bazaar'], 'a pair kind alone here');
});

test('two seeds give two orders, each all of the list', () => {
  const a = shuffled(ARENA_FOES, seeded(3)), b = shuffled(ARENA_FOES, seeded(11));
  assert.notDeepEqual(a.map((x) => x[0]), b.map((x) => x[0]));
  assert.deepEqual(a.map((x) => x[0]).sort(), ARENA_FOES.map((x) => x[0]).sort());
  assert.deepEqual(shuffled(ARENA_FOES, seeded(3)), a, 'the same seed the same order');
  const P = player(), f1 = arena(P, { rng: seeded(3) }), f2 = arena(P, { rng: seeded(11) });
  rest(f1, 3.5); rest(f2, 3.5);
  assert.notDeepEqual(f1.run.order.map((x) => x[0]), f2.run.order.map((x) => x[0]), 'two Arenas, two orders');
  f1.dispose(); f2.dispose(); clearTargets();
});

test('one foe at a time, the next when it falls, a notice each; after the last, all beaten and a new order', () => {
  clearTargets();
  const notes = [], P = player(), foes = arena(P, { notes });
  rest(foes, 3.5);
  const R = foes.run, N = ARENA_FOES.length;
  assert.equal(R.n, 1);
  assert.deepEqual(alive(foes).map((f) => (f.skin ? `${f.kind}@${f.skin}` : f.kind)), R.order[0]);
  assert.match(notes.at(-1), new RegExp(`^Foe 1 of ${N}( · [^:]+)?: `));
  rest(foes, 10);
  assert.equal(R.n, 1, 'no second while the first stands');
  fell(foes); rest(foes);
  assert.equal(R.n, 2, 'the next after it falls');
  assert.match(notes.at(-1), new RegExp(`^Foe 2 of ${N}`));
  // through to the last
  while (R.n < N) { for (const f of foes.list.slice()) foes.remove(f); rest(foes); }
  fell(foes);
  const first = R.order.map((x) => x[0]);
  rest(foes, 1);
  assert.equal(notes.at(-1), `All ${N} foes beaten. Again, in a new order.`);
  rest(foes, ARENA_RUN.rest * 2);
  assert.notEqual(foes.run, R, 'a fresh shuffle');
  assert.equal(foes.run.n, 1);
  assert.notDeepEqual(foes.run.order.map((x) => x[0]), first);
  assert.match(notes.at(-1), new RegExp(`^Foe 1 of ${N}`));
  foes.dispose(); clearTargets();
});

test('the field cleared for practice: the run’s foe taken away unbeaten comes again with “Waves again”', () => {
  clearTargets();
  const P = player(), foes = arena(P);
  rest(foes, 3.5);
  const one = foes.run.order[0];
  foes.setPractice('crab');
  for (let t = 0; t < 1; t += DT) foes.update(DT);
  foes.startWaves(null);
  for (const f of foes.list.slice()) foes.remove(f);
  rest(foes, 3.5);
  assert.equal(foes.run.n, 1);
  assert.deepEqual(alive(foes).map((f) => (f.skin ? `${f.kind}@${f.skin}` : f.kind)), one);
  foes.dispose(); clearTargets();
});

test('the battle music held between the run’s foes (never let go and started again); paused, knocked out or practising, as before', () => {
  clearTargets();
  const combat = [], P = player(), foes = arena(P, { combat });
  foes.update(DT);
  assert.equal(combat.at(-1), false, 'quiet before the first comes in');
  for (let t = 0; t < 3.5; t += DT) foes.update(DT);
  assert.ok(foes.run?.n === 1);
  const from = combat.length;
  for (let k = 0; k < 3; k++) {
    fell(foes);
    for (let t = 0; t < ARENA_RUN.rest + 1; t += DT) foes.update(DT);
  }
  assert.ok(foes.run.n >= 3, `three came (${foes.run.n})`);
  assert.ok(combat.slice(from).every((on) => on === true), 'on all through, between foes too');
  assert.ok(foes.fighting);
  foes.update(DT, true); assert.equal(combat.at(-1), false, 'paused');
  P.dead = true; foes.update(DT); assert.equal(combat.at(-1), false, 'knocked out');
  P.dead = false; foes.update(DT); assert.equal(combat.at(-1), true, 'up again: the fight goes on');
  foes.setPractice(''); foes.update(DT); assert.equal(combat.at(-1), false, 'the field cleared, no practice foe: quiet');
  foes.dispose(); clearTargets();
});

test('the Arena’s other ways stay: ?enemy= one kind again and again, ?enemyWorld= its waves, “Waves from here” the old cycle', () => {
  clearTargets();
  const notes = [], P = player(), one = arena(P, { notes, foes: { waves: true, kind: 'crab@saltharbour' } });
  one.waveRest = 0; one.updateWaves(DT);
  assert.deepEqual(alive(one).map((f) => `${f.kind}@${f.skin}`), ['crab@arzach2'], 'in its one look (#748)');
  assert.deepEqual(alive(one)[0].moves, ['burrow'], 'with the Salt Harbour’s burrow');
  assert.match(notes.at(-1), /^Wave 1 · /);
  assert.equal(one.run, undefined, 'no run');
  one.dispose();
  const w = arena(P, { notes, foes: { waves: true, world: 'incal' } });
  w.waveRest = 0; w.updateWaves(DT);
  assert.ok(alive(w).every((f) => f.skin === HOME_SKIN[f.archetype]), 'each in its one look');
  w.dispose();
  const c = arena(P, { notes });
  c.startWaves('mangrove'); c.waveRest = 0; c.updateWaves(DT);
  assert.match(notes.at(-1), /^Wave \d+ · /);
  c.dispose(); clearTargets();
});
