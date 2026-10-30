// The Arena's run (issue #743, docs/systems/foes.md "The Arena"): every kind of foe once (since #797 the main game's
// kinds and the Arena's own, each in a skin it wears on the route drawn as it comes, not every archetype in each of its
// skins), one at a time in a shuffled order, the next when the last falls, a fresh shuffle after all, never one kind twice
// running; the battle music held between foes, one continuous fight.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES, ARENA_FOES, ARENA_KINDS, ARENA_RUN, oneFoe, shuffled, arenaOrder } from '../src/foes.js';
import { WORLDS, OUT_OF_PLAY, worldArchetypes } from '../src/foe-worlds.js';
import { ORDER, PARTS, DISCARDED } from '../src/levels/names.js';
import { BUILT, ARCHETYPES, archetypeOfKind, parseKind } from '../src/enemies/archetypes.js';
import { skinFor } from '../src/enemies/skins.js';
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

test('the run’s list (#797): each kind of foe once, the main game’s and the Arena’s own; each in skins the route gives it; one body (a flock its heap, a support its escort)', () => {
  const kinds = ARENA_KINDS.map((e) => e.kind);
  assert.equal(new Set(kinds).size, kinds.length, 'each kind once');
  assert.ok(kinds.length >= 25 && kinds.length <= 40, `a kind each, not a skin each (${kinds.length})`);
  const route = ORDER.flatMap((w) => PARTS[w] ?? [w]).filter((w) => WORLDS[w]);
  const fielded = new Set(route.flatMap((w) => worldArchetypes(w)));
  // every kind a route world fields is in it, in the skins those worlds give it, and nothing the author took out
  for (const a of fielded) if (!OUT_OF_PLAY.includes(a)) {
    const e = ARENA_KINDS.find((x) => x.kind === ARCHETYPES[a].kind);
    assert.ok(e, `${a} is in the run`);
    for (const s of e.skins) assert.ok(route.some((w) => worldArchetypes(w).includes(a) && skinFor(a, w) === s), `${a}@${s}: a route world’s skin`);
  }
  for (const a of OUT_OF_PLAY) assert.ok(!kinds.includes(ARCHETYPES[a].kind), `${a} is out of play`);
  for (const e of ARENA_KINDS) for (const s of e.skins) assert.ok(!DISCARDED.includes(s), `${e.kind}@${s}: no discarded world’s skin`);
  // the Arena's own (built, no world fields them yet: the v4 family), and the makers' machine of the temples
  for (const k of ['grunt', 'hulk', 'warlord', 'sentinel', 'machine']) assert.ok(kinds.includes(k), k);
  assert.ok(kinds.every((k) => FOES[k] && !FOES[k].noWild));
  for (const x of ARENA_FOES) {
    const D = FOES[parseKind(x[0]).kind];
    assert.equal(x.length, (D.flock ? ARENA_RUN.flock : 1) + (D.escort ? 1 : 0), `${x[0]}: one enemy`);
    if (D.escort) assert.equal(parseKind(x.at(-1)).kind, D.escort);
  }
  assert.equal(ARENA_FOES.length, ARENA_KINDS.length);
  assert.deepEqual(oneFoe('grunt', 'desert'), ['grunt@desert']);
  assert.deepEqual(oneFoe('lizard', 'bazaar'), ['lizard@bazaar'], 'a pair kind alone here');
});

test('a round: every kind once in a shuffled order, each in one of its skins, seeded; two rounds never the same kind twice running', () => {
  const a = arenaOrder(seeded(3)), b = arenaOrder(seeded(11));
  const kindsOf = (o) => o.map((x) => parseKind(x[0]).kind);
  assert.notDeepEqual(kindsOf(a), kindsOf(b));
  assert.deepEqual(kindsOf(a).sort(), ARENA_KINDS.map((e) => e.kind).sort(), 'all of them');
  assert.deepEqual(arenaOrder(seeded(3)), a, 'the same seed the same round');
  for (const o of [a, b]) for (const x of o) {
    const p = parseKind(x[0]), e = ARENA_KINDS.find((k) => k.kind === p.kind);
    assert.ok(e.skins.length ? e.skins.includes(p.skin) : !p.skin, `${x[0]}: one of its skins`);
  }
  // the skins vary from round to round (a kind with several)
  const crabs = new Set(Array.from({ length: 12 }, (_, i) => arenaOrder(seeded(i + 1)).find((x) => parseKind(x[0]).kind === 'crab')[0]));
  assert.ok(crabs.size > 1, `the crab in more than one skin over 12 rounds (${[...crabs]})`);
  // never the same kind twice running: across rounds too
  for (let s = 1; s < 40; s++) { const r = seeded(s), first = arenaOrder(r), next = arenaOrder(r, kindsOf(first).at(-1)); assert.notEqual(kindsOf(next)[0], kindsOf(first).at(-1)); }
  assert.ok(shuffled([1, 2, 3], seeded(2)).length === 3);
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
  assert.deepEqual(alive(one).map((f) => `${f.kind}@${f.skin}`), ['crab@saltharbour']);
  assert.match(notes.at(-1), /^Wave 1 · /);
  assert.equal(one.run, undefined, 'no run');
  one.dispose();
  const w = arena(P, { notes, foes: { waves: true, world: 'incal' } });
  w.waveRest = 0; w.updateWaves(DT);
  assert.ok(alive(w).every((f) => f.skin === 'incal'));
  w.dispose();
  const c = arena(P, { notes });
  c.startWaves('mangrove'); c.waveRest = 0; c.updateWaves(DT);
  assert.match(notes.at(-1), /^Wave \d+ · /);
  c.dispose(); clearTargets();
});

test('no body built as a foe comes in (#797): the next one’s built while this one is fought, or kept from the load’s warm', () => {
  clearTargets();
  const P = player(), foes = arena(P);
  let built = 0;
  const build = foes.buildBody.bind(foes);
  foes.buildBody = (k) => { built++; return build(k); };
  rest(foes, 3.5);
  const R = foes.run, next = R.order[1];
  assert.ok(foes.ahead, 'the next one is to be built');
  for (let t = 0; t < ARENA_RUN.ahead + 0.2; t += DT) foes.updateWaves(DT);
  assert.ok(foes.spares.has(foes.spareKey(next[0])), `${next[0]} built ahead, while the first is fought`);
  assert.equal(foes.spares.get(foes.spareKey(next[0])).length, next.filter((k) => k === next[0]).length, 'one for each that comes (a swarm’s three)');
  const spare = foes.spares.get(foes.spareKey(next[0]))[0].model;
  fell(foes);
  const before = built;
  rest(foes);
  assert.equal(R.n, 2);
  assert.equal(built, before, 'nothing built as it came in');
  assert.equal(alive(foes)[0].model, spare, 'it wears the body built ahead');
  // the last of a round: the next round's first built ahead too
  while (R.n < R.order.length) { for (const f of foes.list.slice()) foes.remove(f); rest(foes); }
  for (let t = 0; t < ARENA_RUN.ahead + 0.2; t += DT) foes.updateWaves(DT);
  assert.ok(R.after && foes.spares.has(foes.spareKey(R.after[0][0])), 'the next round’s first built ahead');
  assert.notEqual(parseKind(R.after[0][0]).kind, parseKind(R.order.at(-1)[0]).kind, 'not the kind just fought');
  // the load's warm, kept (main.js, the engines): every kind in every skin of the run, a body each for its first arrival
  const kept = arena(P), warm = kept.warmModels();
  warm.dispose({ keep: true });
  for (const e of ARENA_KINDS) for (const s of e.skins) assert.ok(kept.spares.has(kept.spareKey(`${e.kind}@${s}`)), `${e.kind}@${s} kept`);
  kept.dispose(); foes.dispose(); clearTargets();
});
