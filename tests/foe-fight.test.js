import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foe, Foes, FOES } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { FIGHT, TIER, POISE, LAUNCH, RAGE, FOLLOW, ALERT, MOURN, tierScale, tierHp, poiseWear, quickWind, fightOf } from '../src/enemies/fight.js';
import { BUILT, ARCHETYPES } from '../src/enemies/archetypes.js';
import { REACT } from '../src/foe-react.js';

// The fight core (issue #722, docs/design/enemy-fun.md section A; docs/systems/foes.md "Poise, tiers and states"): poise
// instead of cancel, toughness by the route's stage, tempo (follow-ups, the weighted pick at every distance, waiting
// beats), defence answered, low-health changes, the alert beat and the pack's reactions, hits that land.

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const env = { ground: () => 0, seen: () => true };
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const player = (at = v(), o = {}) => ({ pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {}, ...o });
const runFor = (f, P, secs, e = env) => { const ev = []; for (let i = 0; i < secs / DT; i++) ev.push(...f.update(DT, P, e)); return ev; };
const world = (P, o = {}) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true, ...(o.world ? { world: o.world } : {}) } }, levelId: o.world ?? 'arena', physics: flat, player: P, settings: { enemies: o.gentle ? 'gentle' : 'normal' }, game: new GameState(null), rng: o.rng ?? Math.random, ...(o.tool ? { tool: o.tool } : {}) });
const FRONT = v(0, 0, 1);

test('every archetype has its fight data: a weight, a poise, a low-health change or the frailty of fodder, what it does alone', () => {
  for (const id of BUILT) {
    const F = FIGHT[id];
    assert.ok(F, `${id}: fight data`);
    assert.ok(F.mass > 0 && F.poise >= 1, `${id}: mass ${F.mass}, poise ${F.poise}`);
    assert.ok(F.fodder || F.low, `${id}: a low-health change (or fodder, frail everywhere)`);
    assert.ok(['flee', 'rage'].includes(F.alone), `${id}: alone it ${F.alone}`);
    const D = ARCHETYPES[id].def;
    if (F.follow) assert.ok(D.attacks.some((a) => a.id === F.follow.id && !a.chain), `${id}: its follow-up ${F.follow.id} is one of its moves`);
    if (F.backstep) assert.ok(D.attacks.some((a) => a.id === F.backstep), `${id}: its backstep move ${F.backstep}`);
    if (F.low?.kind === 'last') assert.ok(D.attacks.some((a) => a.id === F.low.attack && a.below >= F.low.below - 1e-9), `${id}: its last move ${F.low.attack} opens at its low share`);
  }
  assert.ok(FIGHT.blot.fodder && FIGHT.skitter.fodder && FIGHT.moth.fodder, 'the blot, skitters and moths stay fodder');
  assert.ok(FIGHT.brute.mass > FIGHT.lizard.mass && FIGHT.bell.mass > FIGHT.heron.mass, 'heavy ones weigh more');
  assert.deepEqual({ mass: fightOf('nothing', { heavy: true }).mass, fodder: fightOf('nothing', { light: true }).fodder }, { mass: 2.5, fodder: true }, 'an old kind: from its def');
});

test('toughness by stage: the first worlds teach (one combo), the last ones stand two or three; fodder never grows; Gentle half', () => {
  assert.deepEqual(tierScale(0), { hp: 1, poise: 1 });
  assert.deepEqual(tierScale(1), { hp: 1, poise: 1 });
  assert.ok(tierScale(4).hp > tierScale(3).hp && tierScale(3).hp > tierScale(2).hp && tierScale(2).hp > 1);
  assert.deepEqual(tierScale(4, { fodder: true }), { hp: 1, poise: 1 });
  assert.equal(tierScale(4, { gentle: true }).hp, 1 + (TIER.hp[4] - 1) * TIER.gentle);
  assert.equal(tierHp(3, 0), 3);
  assert.ok(tierHp(3, 4) >= 6 && tierHp(3, 4) <= 7, `a lizard in the Signal Market: ${tierHp(3, 4)} (two combos of 5)`);
  assert.equal(tierHp(8, 4), TIER.cap, 'never past the cap');
  // in the game: a world's own stage
  clearTargets();
  const P = player(v()), F = world(P, { world: 'bazaar' });
  F.waveRest = 1e9;
  const liz = F.add('lizard', v(0, 0, 8)), blot = F.add('blot', v(3, 0, 8));
  assert.equal(F.stageHere, 4);
  assert.equal(liz.hp, tierHp(FOES.lizard.hp, 4));
  assert.equal(liz.def.hp, liz.hp, 'its def is its own: low shares and mends read its health');
  assert.equal(FOES.lizard.hp, 3, 'the kind itself untouched');
  assert.equal(blot.hp, FOES.blot.hp, 'a blot stays a blot');
  assert.ok(liz.poiseMax > FIGHT.lizard.poise, 'its poise grows too');
  F.dispose(); clearTargets();
  const A = world(P); A.waveRest = 1e9;
  assert.equal(A.add('lizard', v(0, 0, 8)).hp, FOES.lizard.hp, 'the Arena (no world): as built');
  A.dispose(); clearTargets();
});

test('poise, not cancel: a light cut never stops a wind-up once begun; worn through, or broken at once by a breaker, it goes down', () => {
  assert.equal(poiseWear('blade', { damage: 1 }), 1);
  assert.equal(poiseWear('blade', { damage: 3, combo: 2 }), 3);
  for (const b of [{ breaks: true, charged: true }, { riposte: true, breaks: true }, { dash: true }, { source: 'parry' }]) assert.equal(poiseWear('blade', b), Infinity);
  clearTargets();
  let riposte = 0;
  const P = player(v()), F = world(P, { tool: { blade: { openRiposte: () => riposte++ } } });
  F.waveRest = 1e9;
  const f = F.add('shade', v(0, 0, 2.5)); f.hp = 99; f.heading = Math.PI;
  f.state = 'wind'; f.atk = f.def.attacks.find((a) => a.id === 'cut'); f.k = 0.2; f.timer = 0.2;
  F.hurt(f, 'blade', FRONT, { damage: 1, combo: 0 });
  assert.equal(f.state, 'wind', 'cut early in its wind-up: it comes on through the cut');
  assert.ok(f.shrugged);
  assert.equal(f.poise, f.poiseMax - 1);
  F.hurt(f, 'blade', FRONT, { damage: 1, combo: 1 });
  F.hurt(f, 'blade', FRONT, { damage: 3, combo: 2 });
  assert.equal(f.reel, 'broken', 'worn through: its stance breaks');
  assert.equal(f.state, 'recover');
  assert.ok(f.downT > 0 && f.stunned >= f.downT - 1e-9, 'down, open');
  assert.equal(f.react.kind, 'down', 'its body knocked down');
  assert.equal(riposte, 1, 'the riposte’s window opens for you');
  const hp = f.hp;
  F.hurt(f, 'blade', FRONT, { damage: 1, combo: 0 });
  assert.equal(f.hp, hp - 2, 'a cut while it is down lands double');
  assert.ok(f.stunned > 0, 'and does not wake it');
  for (let i = 0; i < (POISE.down + 0.2) / DT; i++) F.update(DT);
  assert.equal(f.downT, 0);
  assert.equal(f.poise, f.poiseMax, 'up again, its poise whole');
  // a breaker at once
  f.state = 'chase'; f.stunned = 0;
  F.hurt(f, 'blade', v(1, 0, 0), { damage: 2, combo: 2, breaks: true, charged: true });
  assert.equal(f.reel, 'broken', 'the charged cut breaks it at once');
  F.dispose(); clearTargets();
});

test('worn poise comes back when it is left alone; a reel your blow sent it into does not restart its wait', () => {
  const f = new Foe('lizard', v(0, 0, 3), { rng: () => 0.5 }), P = player(v());
  f.state = 'chase'; f.provoked = true;
  f.hit('blade', FRONT, { damage: 1 }); f.hit('blade', FRONT, { damage: 1 });
  assert.equal(f.poise, f.poiseMax - 2);
  f.cool = 99;
  runFor(f, P, POISE.after + 2);
  assert.equal(f.poise, f.poiseMax, 'back to whole');
  // a flinchy blot cut as its turn comes: it reels, and strikes as soon as it is up (not a whole cool later)
  const b = new Foe('blot', v(0, 0, 1.5), { rng: () => 0.5 });
  b.state = 'chase'; b.provoked = true; b.cool = 0.25;
  b.hit('blade', FRONT, { damage: 1 });
  assert.equal(b.state, 'recover');
  const until = b.timer + 0.02;
  runFor(b, P, until);
  assert.equal(b.state, 'chase');
  assert.ok(b.cool <= 0.3 + 1e-9, `its wait went on: ${b.cool.toFixed(2)} s, not a fresh ${FOES.blot.cool[0]}+`);
});

test('hits that land: the charged cut and the riposte throw a light walker off its feet; a heavy one goes down where it stands and slides less', () => {
  const liz = new Foe('lizard', v(), { rng: () => 0.5 }), brute = new Foe('brute', v(), { rng: () => 0.5 });
  for (const f of [liz, brute]) { f.state = 'chase'; f.provoked = true; f.hp = 99; }
  liz.hit('blade', FRONT, { damage: 2, combo: 2, breaks: true, charged: true });
  assert.ok(liz.air && liz.air.vy === LAUNCH.up && liz.air.knocked, 'launched, along the blow (off a ledge, into water: KNOCK)');
  assert.ok(liz.vel.z > 0);
  brute.hit('blade', FRONT, { damage: 2, combo: 2, breaks: true, charged: true });
  assert.ok(!brute.air && brute.downT > 0, 'the brute is knocked down where it stands');
  const a = new Foe('lizard', v(), { rng: () => 0.5 }), b = new Foe('brute', v(), { rng: () => 0.5 });
  for (const f of [a, b]) { f.state = 'chase'; f.hp = 99; f.hit('blade', FRONT, { damage: 1 }); }
  assert.ok(a.vel.length() > 2.5 * b.vel.length(), `a plain cut: ${a.vel.length().toFixed(2)} m/s against ${b.vel.length().toFixed(2)}`);
  // the launched one lands and lies a moment
  const P = player(v(0, 0, -6));
  let landed = false;
  for (let i = 0; i < 90 && !landed; i++) landed = liz.update(DT, P, env).some((e) => e?.type === 'landed');
  assert.ok(landed && !liz.air, 'it lands');
  assert.ok(liz.downT > 0, 'down still');
});

test('the pearl roller’s last roll is seen: the combo no longer skips it (a blow that would end it leaves a sliver)', () => {
  const f = new Foe('roller', v(0, 0, 4), { rng: () => 0.5 }), P = player(v());
  f.state = 'chase'; f.provoked = true;
  for (const d of [1, 1, 3]) f.hit('blade', FRONT, { damage: d });
  assert.ok(f.alive && f.hp > 0 && f.hp <= 0.25 + 1e-9, `a sliver left: ${f.hp}`);
  assert.ok(f.lowDone && f.plan?.a.id === 'last', 'its last roll next');
  f.stunned = 0; f.downT = 0;
  let wound = null;
  for (let i = 0; i < 6 / DT && !wound; i++) { f.update(DT, P, env); if (f.state === 'wind') wound = f.atk.id; }
  assert.equal(wound, 'last');
});

test('low-health changes: enraged it winds up faster (never under the floor) and waits less; fleeing it runs to its packmate', () => {
  assert.equal(quickWind(1.2, RAGE.wind, RAGE.min), 1.2 * RAGE.wind);
  assert.equal(quickWind(0.55, RAGE.wind, RAGE.min), RAGE.min);
  assert.equal(quickWind(0.4, RAGE.wind, RAGE.min), 0.4, 'never longer than it was');
  const f = new Foe('lizard', v(0, 0, 3), { rng: () => 0.5 });
  f.state = 'chase'; f.provoked = true; f.hp = f.def.hp;
  const bite = f.def.attacks.find((a) => a.id === 'bite');
  const before = f.windFor(bite);
  f.hit('blade', v(1, 0, 0), { damage: f.def.hp * 0.65 });
  assert.equal(f.rage, true);
  assert.ok(f.windFor(bite) < before && f.windFor(bite) >= RAGE.min);
  assert.ok(f.speedNow > f.def.speed);
  // the crab: it cries out and runs to the nearest of its pack, waking it
  clearTargets();
  const P = player(v()), F = world(P);
  F.waveRest = 1e9;
  const crab = F.add('crab', v(0, 0, 3), { calm: true }), mate = F.add('heron', v(10, 0, 3), { calm: true });
  crab.state = 'chase'; crab.provoked = true; crab.hp = 3;
  F.hurt(crab, 'blade', v(1, 0, 0), { damage: 2.2 });
  assert.ok(crab.fleeT > 0 && crab.fleeTo === mate, 'fleeing to its packmate');
  assert.ok(mate.provoked, 'its call wakes it');
  crab.stunned = 0; crab.downT = 0; crab.state = 'chase';
  const d0 = crab.pos.distanceTo(mate.pos);
  for (let i = 0; i < 1 / DT; i++) F.update(DT);
  assert.ok(crab.pos.distanceTo(mate.pos) < d0 - 1, 'it ran to it');
  for (let i = 0; i < 4 / DT; i++) F.update(DT);
  assert.ok(crab.fleeT === 0 && crab.rage, 'then, at its side, it comes on enraged');
  F.dispose(); clearTargets();
});

test('the alert beat: it rears and calls before it comes on, and its call wakes the pack, any kind', () => {
  clearTargets();
  const P = player(v()), gestures = [];
  const F = world(P);
  F.waveRest = 1e9;
  const og = F.gesture.bind(F); F.gesture = (f, k) => { gestures.push([f.kind, k]); og(f, k); };
  const liz = F.add('lizard', v(0, 0, 5), { calm: true }), heron = F.add('heron', v(4, 0, 8), { calm: true }), far = F.add('heron', v(60, 0, 60), { calm: true });
  liz.heading = Math.PI;
  for (let i = 0; i < 0.2 / DT; i++) F.update(DT);
  assert.equal(liz.state, 'chase', 'it noticed you (inside its provoke)');
  assert.ok(liz.alertT > 0, 'its alert beat');
  assert.ok(gestures.some(([k, g]) => k === 'lizard' && g === 'alert'));
  assert.ok(heron.provoked && heron.alertT > 0, 'a heron near it, another kind, wakes too, with its own beat');
  assert.ok(!far.provoked, 'one far off sleeps on');
  assert.equal(liz.react.kind, 'rear', 'its body rears');
  let warned = false;
  for (let i = 0; i < (ALERT.time - 0.25) / DT; i++) { F.update(DT); warned ||= liz.state === 'wind'; }
  assert.ok(!warned, 'no blow inside the beat');
  F.dispose(); clearTargets();
});

test('a packmate falls: those near it rear and call; the last one alone flees (wildlife) or comes on enraged', () => {
  clearTargets();
  const P = player(v()), F = world(P);
  F.waveRest = 1e9;
  const a = F.add('crab', v(0, 0, 4)), b = F.add('crab', v(2, 0, 4)), c = F.add('crab', v(-2, 0, 4));
  for (const f of [a, b, c]) { f.state = 'chase'; f.provoked = true; f.wilds = true; }
  F.hurt(a, 'blade', v(1, 0, 0), { damage: 99 });
  assert.ok(b.alertT >= MOURN.time - 1e-9 && c.alertT >= MOURN.time - 1e-9, 'both rear and call');
  assert.ok(!b.fleeT && !c.fleeT, 'two left: they fight on');
  F.hurt(b, 'blade', v(1, 0, 0), { damage: 99 });
  assert.ok(c.fleeT > 0, 'the last crab alone flees');
  F.dispose(); clearTargets();
  const G = world(P); G.waveRest = 1e9;
  const s1 = G.add('shade', v(0, 0, 4)), s2 = G.add('shade', v(2, 0, 4));
  for (const f of [s1, s2]) { f.state = 'chase'; f.provoked = true; }
  G.hurt(s1, 'blade', v(1, 0, 0), { damage: 99 });
  assert.ok(s2.rage && !s2.fleeT, 'the last shade comes on enraged');
  G.dispose(); clearTargets();
});

test('tempo: a missed blow is followed by the same blow, quicker (its tell played faster); one in a row', () => {
  const f = new Foe('heron', v(0, 0, 4), { rng: () => 0.1 }), P = player(v(5, 0, 0));
  f.state = 'chase'; f.provoked = true;
  const spear = f.def.attacks.find((a) => a.id === 'spear');
  f.heading = Math.PI; f.beginWind(spear, P);
  let follow = false;
  for (let i = 0; i < 3 / DT && !follow; i++) { f.update(DT, P, env); follow = f.state === 'wind' && f.chained === 1; }
  assert.ok(follow, 'it spears again');
  assert.equal(f.atk.id, 'spear');
  assert.equal(f.windFor(spear), Math.max(FOLLOW.min, spear.wind * FOLLOW.wind));
  assert.ok(f.windFor(spear) >= FOLLOW.min);
  assert.equal(f.tryFollow('whiff', spear, P), false, 'one in a row');
});

test('the weighted pick reaches for moves out of range: at one distance a foe still varies its moves, backing off for a lunge', () => {
  const picks = new Set();
  let s = 7;
  const f = new Foe('heron', v(), { rng: () => ((s = (s * 9301 + 49297) % 233280) / 233280) });
  for (let i = 0; i < 200; i++) picks.add(f.chooseAttack(1.6, 0, true)?.id);
  assert.ok(picks.has('sweep') && picks.has('spear'), `at 1.6 m: ${[...picks]}`);
  assert.deepEqual([...new Set(Array.from({ length: 50 }, () => f.chooseAttack(1.6, 0)?.id))], ['sweep'], 'without reaching: only the sweep (before #722)');
  // it steps back to spear, then winds it up
  const P = player(v()), h = new Foe('heron', v(0, 0, 1.4), { rng: () => 0.5 });
  h.state = 'chase'; h.provoked = true; h.cool = 0; h.plan = { a: h.def.attacks.find((a) => a.id === 'spear'), t: 2 };
  let wound = null;
  for (let i = 0; i < 2 / DT && !wound; i++) { h.update(DT, P, env); if (h.state === 'wind') wound = h.atk.id; }
  assert.equal(wound, 'spear');
  assert.ok(h.pos.distanceTo(P.pos) >= 2.2 - 0.05, `backed off to ${h.pos.distanceTo(P.pos).toFixed(2)} m first`);
});

test('waiting its turn: it circles, feints and taunts rather than side-stepping in place', () => {
  const kinds = new Set();
  let s = 3;
  const f = new Foe('lizard', v(0, 0, 4), { rng: () => ((s = (s * 9301 + 49297) % 233280) / 233280) }), P = player(v());
  f.state = 'chase'; f.provoked = true; f.cool = 0;
  const e = { ...env, mayStrike: () => false };
  const ev = runFor(f, P, 14, e);
  for (const x of ev) if (x?.type === 'gesture') kinds.add(x.kind);
  assert.ok(kinds.has('feint') && kinds.has('taunt'), `${[...kinds]}`);
  assert.notEqual(f.state, 'wind', 'and never strikes out of turn');
});

test('defence: it hops back out of your swing now and then (the lizard), so a feint or a dash cut is needed', () => {
  const f = new Foe('lizard', v(0, 0, 2.2), { rng: () => 0.1 }), P = player(v(), { heading: 0 });
  f.state = 'chase'; f.provoked = true; f.cool = 5; f.heading = Math.PI;
  const e = { ...env, swing: () => true };
  const d0 = f.pos.distanceTo(P.pos);
  const ev = runFor(f, P, 0.5, e);
  assert.ok(ev.some((x) => x?.type === 'gesture' && x.kind === 'hop'), 'it hops');
  assert.ok(f.pos.distanceTo(P.pos) > d0 + 1.5, `out of reach: ${f.pos.distanceTo(P.pos).toFixed(2)} m`);
  assert.ok(f.evadeCool > 0, 'not again at once');
  const g = new Foe('lizard', v(0, 0, 2.2), { rng: () => 0.1 }), Q = player(v(), { heading: Math.PI });
  g.state = 'chase'; g.provoked = true; g.cool = 5;
  assert.ok(!runFor(g, Q, 0.5, e).some((x) => x?.type === 'gesture' && x.kind === 'hop'), 'a swing the other way: nothing to hop from');
});

test('a guarded blow makes it stumble and wears its poise; a perfect parry breaks it (down)', () => {
  clearTargets();
  let guard = true;
  const P = player(v(), { guard: () => guard }), F = world(P);
  F.waveRest = 1e9;
  const f = F.add('lizard', v(0, 0, 1.5)); f.state = 'strike'; f.atk = f.def.attacks.find((a) => a.id === 'blare'); f.heading = Math.PI; f.hp = 99;
  f.rng = () => 0.99;   // (no follow-up)
  F.strike(f, f.atk);
  assert.equal(f.state, 'recover'); assert.equal(f.reel, 'blocked');
  assert.equal(f.poise, f.poiseMax - 1.5);
  f.state = 'strike'; guard = 'perfect';
  F.strike(f, f.atk);
  assert.equal(f.reel, 'broken');
  assert.ok(f.downT > 0);
  F.dispose(); clearTargets();
});

test('the body’s new words exist: down, rear, lean, cower (src/foe-react.js)', () => {
  for (const k of ['down', 'rear', 'lean', 'cower']) assert.ok(REACT[k]?.lean > 0, k);
  assert.ok(REACT.rear.squash < 0, 'rearing stretches it tall');
  assert.ok(REACT.down.lean > REACT.stagger.lean, 'down is past a stagger');
});
