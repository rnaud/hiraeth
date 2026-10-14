// The chime-pirates' rail shooter (docs/systems/minigames.md, "Pirates between worlds"): the rail, the rocks, the
// run played by the pilot at any frame rate, the charged shot's lock and burst, the roll, the repair rings, the
// captain breaking off, the controls; the game's definition and its shapes.
import test from 'node:test';
import fs, { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FLY, BOSS, SCRIPT, KINDS, POINTS, MISSILE_POINTS, CHIME_RATE, chimesFor, CHECKPOINTS, MERCY, BELTS, railX, railY, railPoint, courseRocks, seedOf, newRun, runStep, botInput, pirateInput, findLock, aimAt, aimTarget } from '../src/minigames/pirates-rules.js';
import pirates, { piratePitch, pirateShapes, rocksFor, LOOK_SIZE, buildGunship, GUNSHIP_COLORS, tallyHtml, pirateControls, BEATEN, HURT } from '../src/minigames/pirates.js';
import { checkGame } from '../src/minigames/index.js';
import { optionValue, optionOffered } from '../src/minigames/kit/flow.js';
import { WorldLabels } from '../src/minigames/kit/labels.js';
import { setMotion } from '../src/feel.js';

const play = (S, input, dt, until = 400) => { const ev = []; while (!S.done && S.t < until) ev.push(...runStep(S, typeof input === 'function' ? input(S) : input, dt)); return ev; };

test('the rail wanders gently: no turn sharper than a light bank', () => {
  for (let s = 0; s < 7000; s += 5) {
    const dx = (railX(s + 1) - railX(s)), dy = (railY(s + 1) - railY(s));
    assert.ok(Math.hypot(dx, dy) < 0.3, `a slope of ${Math.hypot(dx, dy).toFixed(2)} at ${s} m`);
  }
  const p = railPoint(100, 2, 3);
  assert.equal(p.z, -100);
  assert.ok(Math.abs(p.x - railX(100) - 2) < 1e-9 && Math.abs(p.y - railY(100) - 3) < 1e-9);
});

test('the rocks: one layout per destination, the same every time, sorted along the way, in the belts', () => {
  const a = courseRocks(seedOf('incal')), b = courseRocks(seedOf('incal')), c = courseRocks(seedOf('edena'));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.map((r) => r.s), c.map((r) => r.s));
  assert.deepEqual(rocksFor('incal'), a, 'the arena draws the rules\' own rocks');
  for (let i = 1; i < a.length; i++) assert.ok(a[i].s >= a[i - 1].s);
  const inBox = a.filter((r) => Math.abs(r.u) < FLY.boxU + r.r && Math.abs(r.v) < FLY.boxV + r.r);
  assert.ok(inBox.length > 35 && inBox.length < 140, `${inBox.length} rocks in the ship's way`);
  // never a wall: in every 60 m of a belt, most of the box is open
  for (let s = BELTS[0][0]; s < BELTS[BELTS.length - 1][1]; s += 60) {
    const here = inBox.filter((r) => r.s >= s && r.s < s + 60);
    const area = here.reduce((n, r) => n + Math.PI * r.r * r.r, 0);
    assert.ok(area < 0.45 * (2 * FLY.boxU) * (2 * FLY.boxV), `the rocks at ${s} m cover ${(area / (4 * FLY.boxU * FLY.boxV) * 100).toFixed(0)} % of the box`);
  }
});

test('the pilot wins at 120, 60, 30 and 20 fps, in about a minute and a half (30 % shorter than the 2 min 18 s before v1.45), the captain sunk', () => {
  for (const fps of [120, 60, 30, 20]) {
    const S = newRun({ seed: seedOf('incal') });
    const ev = play(S, botInput, 1 / fps);
    assert.equal(S.done, 'won', `${fps} fps: ${S.done} at ${S.t.toFixed(1)} s`);
    assert.ok(S.t > 80 && S.t < 0.75 * 138.5, `${fps} fps: ${S.t.toFixed(1)} s (the pilot took 138.5 s on average before)`);
    assert.ok(S.ship.hull > 0);
    assert.ok(ev.some((e) => e.kind === 'win' && e.sunk), 'the gunship downed');
    assert.ok(ev.filter((e) => e.kind === 'part').length === 3, 'two guns, then the bridge');
    assert.ok(S.kills > 32, `${S.kills} pirates downed`);
    const win = ev.find((e) => e.kind === 'win');
    assert.ok(win.chimes === chimesFor(S.score) && win.score === S.score, 'the win carries the points and the chimes they make');
    assert.ok(win.chimes > 70 && win.chimes < 90, `${win.chimes} chimes won (79 a run when each ship had its own, v1.45)`);
    for (const id of ['start', 'hauler', 'captain', 'open']) assert.ok(ev.some((e) => e.kind === 'say' && e.id === id), `the line ${id}`);
  }
});

test('a ship that does nothing is lost before the captain comes', () => {
  const S = newRun({ seed: seedOf('incal') });
  const ev = play(S, {}, 1 / 60);
  assert.equal(S.done, 'dead');
  assert.ok(S.t < SCRIPT.find((e) => e.boss).t);
  assert.equal(ev.filter((e) => e.kind === 'hurt').length, FLY.hull);
  assert.ok(ev.some((e) => e.kind === 'dead'));
});

test('the Enemies setting\'s gentle and the later ambushes: fewer or more shots', () => {
  const shots = (o) => { const S = newRun({ seed: 3, ...o }); const ev = play(S, botInput, 1 / 60, 100); return ev.filter((e) => e.kind === 'enemyShot').length; };
  const normal = shots({}), gentle = shots({ gentle: true }), late = shots({ heat: 8 });
  assert.ok(gentle < normal * 0.75, `gentle ${gentle} vs ${normal}`);
  assert.ok(late > normal, `later ${late} vs ${normal}`);
});

/** A run with nothing in it but what the test puts there. */
function empty() { const S = newRun({ seed: 1 }); S.script = []; S.rocks = []; return S; }

test('hold to charge: it locks the pirate in the aim, and the shot let go homes in and bursts, several at once', () => {
  const S = empty();
  const add = (u, v, ds) => { const e = { id: S.nextId++, kind: 'raider', path: 'parked', hp: KINDS.raider.hp, r: KINDS.raider.r, ds, u, v, age: 0, flash: 0, fireT: 99 }; S.foes.push(e); return e; };
  const a = add(4, 1, 90), b = add(9, 1, 92), far = add(-12, -6, 95);
  const ev = [];
  for (let t = 0; t < FLY.charge.after + FLY.charge.full + 0.1; t += 1 / 60) ev.push(...runStep(S, { fire: true }, 1 / 60));
  assert.equal(S.ship.charge, 1, 'charged');
  assert.ok(ev.some((e) => e.kind === 'lock'));
  assert.equal(S.ship.lock?.foe, a, 'the nearest the aim');
  assert.equal(findLock(S)?.foe, a);
  ev.push(...runStep(S, { fire: false }, 1 / 60));
  assert.ok(ev.some((e) => e.kind === 'charged' && e.locked));
  for (let t = 0; t < 2 && !a.dead; t += 1 / 60) ev.push(...runStep(S, {}, 1 / 60));
  const blast = ev.find((e) => e.kind === 'blast');
  assert.ok(blast, 'it burst');
  assert.ok(a.dead && b.dead, 'the locked one and the one beside it');
  assert.ok(!far.dead, 'not the one far off');
  assert.equal(blast.n, 2);
  assert.equal(blast.bonus, 25);
});

test('a tap fires two bolts; RT held streams them, slower', () => {
  const S = empty();
  const ev = runStep(S, { fire: true }, 1 / 60);
  assert.equal(S.bolts.length, 2);
  assert.ok(ev.some((e) => e.kind === 'shot'));
  const T = empty();
  let n = 0;
  for (let t = 0; t < 2; t += 1 / 60) n += runStep(T, { auto: true }, 1 / 60).filter((e) => e.kind === 'shot').length;
  assert.ok(Math.abs(n - 2 / FLY.bolt.auto) <= 1.5, `${n} volleys in 2 s`);
});

test('the roll turns a shot aside; without it the shot costs a pip of hull', () => {
  for (const roll of [true, false]) {
    const S = empty();
    S.shots.push({ ds: 6, u: S.ship.u, v: S.ship.v, vds: -50, vu: 0, vv: 0, life: 2, r: 0.9 });
    const ev = [];
    for (let t = 0; t < 0.3; t += 1 / 60) ev.push(...runStep(S, { roll, x: 0 }, 1 / 60));
    if (roll) { assert.ok(ev.some((e) => e.kind === 'deflect')); assert.equal(S.ship.hull, FLY.hull); }
    else { assert.ok(ev.some((e) => e.kind === 'hurt')); assert.equal(S.ship.hull, FLY.hull - 1); }
  }
  // a roll waits for its cool-down, and shoves the ship aside
  const S = empty();
  runStep(S, { roll: true, x: 1 }, 1 / 60);
  assert.ok(S.ship.vu > 10);
  runStep(S, { roll: false }, 1 / 60);
  assert.equal(runStep(S, { roll: true }, 1 / 60).filter((e) => e.kind === 'roll').length, 0, 'not again at once');
});

test('a teal ring patches the hull; flown through at full hull it scores', () => {
  const S = empty();
  S.ship.hull = 3;
  S.rings.push({ s: S.s + 10, u: S.ship.u, v: S.ship.v, r: 3.4 });
  let ev = [];
  for (let t = 0; t < 0.5; t += 1 / 60) ev.push(...runStep(S, {}, 1 / 60));
  assert.ok(ev.some((e) => e.kind === 'repair'));
  assert.equal(S.ship.hull, 4);
  const F = empty();
  F.rings.push({ s: F.s + 10, u: F.ship.u + 9, v: F.ship.v, r: 3.4 });
  ev = [];
  for (let t = 0; t < 0.5; t += 1 / 60) ev.push(...runStep(F, {}, 1 / 60));
  assert.ok(!ev.some((e) => e.kind === 'repair'), 'missed');
});

test('a rock in the way knocks the ship off it and costs hull, once', () => {
  const S = empty();
  S.rocks = [{ s: 30, u: S.ship.u + 0.5, v: S.ship.v, r: 2, hp: Infinity, hit: false }];
  const ev = [];
  for (let t = 0; t < 1.5; t += 1 / 60) ev.push(...runStep(S, {}, 1 / 60));
  assert.equal(ev.filter((e) => e.kind === 'hurt').length, 1);
  assert.ok(S.ship.u < 0, 'pushed away from its middle');
});

test('the captain: the bridge armoured until both guns are down; left alone, the gunship breaks off and the run still ends', () => {
  const S = empty();
  S.script = [{ t: 0, boss: true }];
  runStep(S, {}, 1 / 60);
  assert.ok(S.boss);
  const ev = [];
  // invulnerable, doing nothing: it fights its time out, then leaves
  while (!S.done && S.t < 200) { S.ship.iframe = 1; ev.push(...runStep(S, {}, 1 / 60)); }
  assert.equal(S.done, 'won');
  const win = ev.find((e) => e.kind === 'win');
  assert.equal(win.sunk, false, 'got away');
  assert.ok(S.t > BOSS.enter + BOSS.stay);
  // the bridge clanks while a gun stands
  const T = empty();
  T.script = [{ t: 0, boss: true }];
  while (T.t < BOSS.enter + 1) runStep(T, {}, 1 / 60);
  const core = T.boss.parts.find((p) => p.id === 'core'), at = { ds: T.boss.ds, u: T.boss.u + core.u, v: T.boss.v + core.v };
  T.ship.u = at.u; T.ship.v = at.v; T.ship.vu = T.ship.vv = 0;
  T.bolts.push({ ds: at.ds - 4, u: at.u, v: at.v, vu: 0, vv: 0, vds: 170, life: 1, charged: false });
  const ev2 = runStep(T, {}, 1 / 60);
  assert.ok(ev2.some((e) => e.kind === 'clank'));
  assert.equal(core.hp, core.hp0);
});

test('the controls: the stick as the jets fly, fire from A / ×, Space or the touch ✺, the roll from B, LB, X, Shift or ↶, a missile from LT, F or the touch ◇', () => {
  assert.equal(pirateInput({ y: 1 }).y, -1, 'forward dives');
  assert.equal(pirateInput({ y: 1 }, {}, { climb: true }).y, 1, 'or climbs, as chosen in Settings once beaten');
  assert.equal(pirates.options, undefined, 'no start card (issue #224): no choice on it');
  for (const raw of [{ PadAim: true }, { KeyF: true }, { TouchGuard: true }]) assert.equal(pirateInput({}, raw).missile, true);
  assert.equal(pirateInput({}).missile, false);
  assert.equal(pirateInput({ jump: true }).fire, true);
  assert.equal(pirateInput({}, { TouchFire: true }).fire, true);
  assert.equal(pirateInput({ trigger: 1 }).auto, true);
  for (const raw of [{ PadEvade: true }, { PadGuard: true }, { TouchEvade: true }]) assert.equal(pirateInput({}, raw).roll, true);
  assert.equal(pirateInput({ action: true }).roll, true);
  assert.equal(pirateInput({ boost: true }).roll, true);
  assert.equal(pirateInput({}).roll, false);
});

test('the feel, as Star Fox: weight on the stick, a soft edge, a hard bank, the nose and the bolts where it goes (issue #88)', () => {
  // the stick's speed taken up with an easing: brisk at first, settling, never past it
  const S = empty();
  const vu = [];
  for (let i = 0; i < 40; i++) { runStep(S, { x: 1 }, 1 / 60); vu.push(S.ship.vu); }
  assert.ok(vu[11] > 0.55 * FLY.steer && vu[11] < 0.75 * FLY.steer, `a fifth of a second in: ${vu[11].toFixed(1)} m/s`);
  assert.ok(vu[1] - vu[0] > vu[30] - vu[29], 'eases in: quick at first, then settling');
  assert.ok(vu.every((v) => v <= FLY.steer + 1e-9));
  // banked hard into the turn, the nose turned the same way
  assert.ok(S.ship.bank < -0.6, `banked ${S.ship.bank.toFixed(2)} rad`);
  assert.ok(S.ship.aimU > 0.8 * FLY.aim);
  // the bolts go where the nose points: the reticle leads the ship, more the further out
  const a22 = aimAt(S.ship, 22), a55 = aimAt(S.ship, 55);
  assert.ok(a22.u > S.ship.u + 1.5 && a55.u > a22.u + 2, `reticle at ${(a22.u - S.ship.u).toFixed(1)} and ${(a55.u - S.ship.u).toFixed(1)} m ahead of the ship`);
  S.bolts.length = 0; S.ship.boltT = 0;
  runStep(S, { x: 1, fire: true }, 1 / 60);
  const b = S.bolts[S.bolts.length - 1];
  let t = 0; while (b.ds < 55 && t < 1) { b.ds += b.vds / 600; b.u += b.vu / 600; t += 1 / 600; }
  assert.ok(Math.abs(b.u - FLY.bolt.spread - aimAt(S.ship, 55).u) < 1.2, 'a bolt reaches the reticle');
  // the edge of the box: slowed to a stop, no wall to bounce off
  const E = empty();
  let back = false;
  for (let i = 0; i < 240; i++) { const was = E.ship.u; runStep(E, { x: 1 }, 1 / 60); if (E.ship.u < was - 1e-6) back = true; }
  assert.ok(E.ship.u <= FLY.boxU + 1e-9 && E.ship.u > FLY.boxU * 0.95, `at the edge: ${E.ship.u.toFixed(2)}`);
  assert.ok(!back, 'never thrown back off it');
  assert.ok(Math.abs(E.ship.vu) < 0.5, 'stopped there');
  // the roll: a quick whole turn
  assert.ok(FLY.roll.dur <= 0.5 && FLY.roll.cool <= 0.6);
});

// ------------------------------------------------------------------ issue #206: points then chimes, the hit, the reticle, the controls, the gunship
/** The arena, built once (as the page does), and a session on it with a recording host. */
let arena = null;
function session({ flags = {}, to = null, sound = null, settings = {} } = {}) {
  if (!arena) { const scene = new THREE.Scene(); const gen = pirates.build(scene); let r; while (!(r = gen.next()).done); arena = { scene, level: r.value }; }
  const { scene, level } = arena;
  level.pirates.to = to; level.pirates.resume = null;
  const calls = [], kept = { ...flags };
  const state = { data: { flags: kept }, flag: (k) => kept[k], set: (k, v) => { kept[k] = v; } };
  const ctx = {
    camera: new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 5000), level, scene, player: { object: {} }, sound, state, settings,
    sfx: { hurt: () => calls.push('sfx.hurt'), whoosh() {}, checkpoint() {} },
    setLives: (n) => calls.push(`lives ${n}`), setScore() {}, setFov() {}, flash: (t) => calls.push(`flash ${t}`), kick: () => calls.push('kick'),
    finish: (r) => calls.push({ finish: r }), speed() {}, option: (id) => optionValue(pirates, state, id),
  };
  const sess = pirates.start(ctx);
  const step = (n = 1, inp = {}) => { for (let i = 0; i < n; i++) sess.update(1 / 60, inp, { live: true, phase: 'play', raw: {} }); };
  return { sess, S: sess.state, calls, kept, step };
}
/** A sound that records what it plays (none is heard: the tests are mute). */
const recordingSound = () => { const played = []; return { played, ctx: { currentTime: 0 }, muted: false, fx: {}, sweep: (...a) => played.push(['sweep', ...a]), burst: (...a) => played.push(['burst', ...a]), pluck: (...a) => played.push(['pluck', ...a]) }; };

test('points through the run, no chimes popped; won on the way to a world, a tally turns them into chimes at 20 points a chime (issue #206)', () => {
  assert.equal(CHIME_RATE, 20);
  assert.equal(chimesFor(1650), 82, 'a typical run (the pilot\'s 1,580 to 1,670): about 82, the 79 it was');
  assert.equal(chimesFor(19), 0);
  assert.equal(chimesFor(-5), 0);
  // the rules: kills and parts carry points only
  const R = newRun({ seed: seedOf('incal') });
  const rev = play(R, botInput, 1 / 60);
  for (const e of rev.filter((x) => x.kind === 'kill' || x.kind === 'part')) assert.equal(e.chimes, undefined, `a ${e.kind} carries no chimes`);
  // the page: the words that pop over what is shot down are points, never chimes
  const words = [], pop = WorldLabels.prototype.pop;
  WorldLabels.prototype.pop = function (_at, text) { words.push(text); };
  globalThis.__piratesBot = true;
  try {
    const { S, calls, kept, step } = session({ to: 'incal' });
    for (let i = 0; i < 8000 && !S.done; i++) step();
    assert.equal(S.done, 'won');
    assert.ok(words.length > 30, `${words.length} pops`);
    assert.ok(words.every((w) => /^\+\d+$|^×\d+$/.test(w)), `only points (and a chain's ×n, issue #326): ${[...new Set(words)].join(' ')}`);
    assert.ok(!words.some((w) => /chime/i.test(w)));
    const fin = calls.find((c) => c.finish)?.finish;
    assert.equal(fin.score, S.score);
    assert.equal(fin.chimes, chimesFor(S.score), 'the host banks the tally\'s chimes');
    assert.match(fin.html, new RegExp(`data-points="${S.score}" data-chimes="${chimesFor(S.score)}"`));
    assert.match(fin.html, /20 points make a chime/);
    assert.ok(!fin.lines.some((l) => /chime/i.test(l)), 'the lines are the run\'s; the tally says the chimes');
    assert.equal(kept[BEATEN], true, 'beaten: the start card offers the pitch from now on');
  } finally { WorldLabels.prototype.pop = pop; delete globalThis.__piratesBot; }
  assert.match(tallyHtml(1650), /1,650/);
  // the Arcade's game (no destination) only scores
  globalThis.__piratesBot = true;
  try {
    const { S, calls, step } = session();
    for (let i = 0; i < 8000 && !S.done; i++) step();
    const fin = calls.find((c) => c.finish)?.finish;
    assert.equal(fin.chimes, 0); assert.equal(fin.html, null);
  } finally { delete globalThis.__piratesBot; }
});

test('a pip of hull lost is unmistakable: the edge flares, the view shakes, the pips show under the ship, the corner\'s pops, a crunch (issue #206)', () => {
  const sound = recordingSound();
  const { sess, S, calls, step } = session({ sound });
  S.script = []; S.rocks = [];
  S.shots.push({ ds: 5, u: S.ship.u, v: S.ship.v, vds: -50, vu: 0, vv: 0, life: 2, r: 0.9 });
  const before = sound.played.length;
  for (let i = 0; i < 12 && S.ship.hull === FLY.hull; i++) step();
  assert.equal(S.ship.hull, FLY.hull - 1);
  const F = sess.feedback;
  assert.ok(F.redT > 0.5 * HURT.flash, 'the edge flash');
  assert.ok(F.shake > 0, 'the shake');
  assert.ok(F.pipT > 0 && F.lostI === S.ship.hull && F.lostT > 0, 'the pips under the ship, the lost one bursting');
  assert.ok(calls.includes('sfx.hurt') && calls.includes('kick') && calls.includes(`lives ${FLY.hull - 1}`));
  assert.ok(sound.played.slice(before).some(([k]) => k === 'burst'), 'a crunch over the bolts');
  assert.ok(S.ship.iframe > 0, 'and it blinks, untouchable a moment');
  // it fades: the flash and the shake gone in a second, the pips soon after
  step(70);
  assert.equal(F.redT, 0); assert.equal(F.shake, 0);
  step(80);
  assert.equal(F.pipT, 0);
});

test('the reticle: one line of fire; it tightens on what that line runs through and marks a hit (issue #206)', () => {
  const S = empty();
  const add = (u, v, ds, hp = 6) => { const e = { id: S.nextId++, kind: 'raider', path: 'parked', hp, r: KINDS.raider.r, ds, u, v, age: 0, flash: 0, fireT: 99 }; S.foes.push(e); return e; };
  const a = aimAt(S.ship, 80);
  const on = add(a.u, a.v, 80);
  assert.equal(aimTarget(S)?.foe, on);
  on.u += 12;
  assert.equal(aimTarget(S), null, 'off the line: nothing');
  // a bolt that tells without a kill is a hit
  on.u -= 12; on.hp = 6;
  const ev = [];
  for (let t = 0; t < 0.7; t += 1 / 60) ev.push(...runStep(S, { auto: true }, 1 / 60));
  assert.ok(ev.some((e) => e.kind === 'hit' && e.by === 'bolt' && e.foe === 'raider'));
  // the page: the ring tightens on it and the mark flashes
  const { sess, S: T, step } = session();
  T.script = []; T.rocks = [];
  const b = aimAt(T.ship, 60);
  T.foes.push({ id: 99, kind: 'raider', path: 'parked', hp: 40, r: KINDS.raider.r, ds: 60, u: b.u, v: b.v, age: 0, flash: 0, fireT: 99 });
  step(20);
  assert.ok(sess.feedback.aimK > 0.9, `tightened ${sess.feedback.aimK.toFixed(2)}`);
  T.bolts.push({ ds: 55, u: b.u, v: b.v, vu: 0, vv: 0, vds: 170, life: 1, charged: false });
  step(2);
  assert.ok(sess.feedback.hitT > 0, 'the hit mark');
});

test('the controls: push up to dive by default; the switch is not offered at first, only once the pirates are beaten, in Settings (issue #206, #224)', () => {
  const fresh = { flag: (k) => ({ 'minigame.pirates.opt.pitch': 'climb' })[k] };
  assert.equal(piratePitch({ settings: { piratePitch: 'climb' }, state: fresh }), 'dive', 'not beaten: neither the setting nor a climb kept from before');
  const beaten = { flag: (k) => ({ [BEATEN]: true })[k] };
  assert.equal(piratePitch({ settings: { piratePitch: 'climb' }, state: beaten }), 'climb', 'beaten: Settings → Game, "Chime pirates: push the stick up to"');
  assert.equal(piratePitch({ settings: { piratePitch: 'auto', invertFlight: true }, state: beaten }), 'climb', '"as the jets\' setting"');
  assert.equal(piratePitch({ settings: { piratePitch: 'dive', invertFlight: true }, state: beaten }), 'dive');
  // the Settings row is there, hidden until beaten (src/ui.js data-pirates), with its words in English and French
  const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /set\.piratePitch'\), opts\('piratePitch', \['auto', 'dive', 'climb'\]\), ' data-pirates hidden'/);
  assert.match(ui, /\[data-pirates\]'\)\) r\.hidden = !this\.piratesBeaten\(\)/);
  for (const lang of ['en', 'fr']) {
    const L = readFileSync(new URL(`../src/i18n/${lang}.js`, import.meta.url), 'utf8');
    for (const k of ['set.piratePitch', 'set.piratePitch.auto', 'set.piratePitch.dive', 'set.piratePitch.climb']) assert.ok(L.includes(`'${k}'`), `${lang}: ${k}`);
  }
  // the card says it, in Xbox / PlayStation form (src/native-pad.js rewrites them on Android)
  const C = pirateControls('dive');
  assert.match(C.pad[0][1], /push up to dive, pull back to climb/);
  assert.match(C.keys[0][1], /W or ↑ to dive/);
  assert.match(C.touch[0][1], /push up to dive/);
  assert.match(pirateControls('climb').pad[0][1], /push up to climb/);
  assert.match(pirates.controls.pad[0][1], /push up to dive/, 'a fresh session lists the default');
  for (const [k] of C.pad) assert.doesNotMatch(k, /\b(Space|Shift|Esc|Enter|Up)\b/);
  // a session on a fresh save flies push-up-to-dive whatever was kept
  const { S, step } = session({ flags: { 'minigame.pirates.opt.pitch': 'climb' } });
  S.script = []; S.rocks = [];
  const v0 = S.ship.v;
  step(30, { y: 1 });
  assert.ok(S.ship.v < v0 - 2, 'pushed up, it dives');
});

test('the captain\'s boss is a gunship built for space, not a sailing ship: hull, engines, turrets, the bridge, pirate markings, few draw calls (issue #206)', () => {
  const scene = new THREE.Scene();
  const B = buildGunship(scene);
  const meshes = [];
  B.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const names = meshes.map((m) => m.name);
  for (const n of ['hull', 'armour', 'iron', 'engines', 'markings', 'stripes', 'gunL', 'gunR', 'core', 'shutter']) assert.ok(names.includes(n), `it has its ${n}`);
  assert.ok(!names.some((n) => /sail|mast/.test(n)), 'no masts, no sails');
  assert.ok(meshes.length <= 14, `${meshes.length} draw calls`);
  for (const m of meshes) assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite), `${m.name}: a sound shape`);
  // the turrets where the rules hit them; the engines' nozzles astern, their intakes facing the ship
  for (const p of BOSS.parts.filter((q) => q.id !== 'core')) {
    const pod = B.guns[p.id].pod;
    assert.ok(Math.abs(pod.position.x * B.group.scale.x - p.u) < 1e-6 && Math.abs(pod.position.y * B.group.scale.y - p.v) < 1e-6, `${p.id} at its place`);
  }
  const eng = meshes.find((m) => m.name === 'engines');
  eng.geometry.computeBoundingBox();
  assert.ok(eng.geometry.boundingBox.min.z < -10 && eng.geometry.boundingBox.max.z > 0, 'nozzles astern, intakes glowing toward the ship');
  assert.ok(Object.values(GUNSHIP_COLORS).every((c) => /^#[0-9a-f]{6}$/.test(c)));
  assert.equal(B.shutters.length, 2);
  assert.match(pirates.rules, /gunship/);
});


test('lost, the run starts again from the last checkpoint, kinder each time; from the third loss the hull holds: every fight can be won', () => {
  assert.deepEqual(CHECKPOINTS.slice(0, 1), [0]);
  assert.ok(CHECKPOINTS.length >= 3, 'the start, mid-way, before the captain');
  assert.ok(CHECKPOINTS[CHECKPOINTS.length - 1] < SCRIPT.find((e) => e.boss).t, 'the last before the captain');
  // an idle ship passes nothing and is lost; one flown by the pilot until a checkpoint, then idle, keeps it
  const S = newRun({ seed: seedOf('incal') });
  play(S, botInput, 1 / 60, CHECKPOINTS[1] + 1);
  assert.equal(S.checkpoint, CHECKPOINTS[1]);
  const kept = S.score;
  play(S, {}, 1 / 60);
  assert.equal(S.done, 'dead');
  assert.equal(S.scoreAt, kept, 'the points won before it are kept');
  // again from there: the waves before it gone by, the hull a pip stronger, the pirates firing less, the points kept
  const T = newRun({ seed: seedOf('incal'), from: S.checkpoint, fails: 1, score: S.scoreAt });
  assert.equal(T.score, kept);
  assert.equal(T.t, CHECKPOINTS[1]);
  assert.ok(T.script.slice(0, T.next).every((e) => e.t <= CHECKPOINTS[1]) && T.script.slice(T.next).every((e) => e.t > CHECKPOINTS[1]));
  assert.equal(T.ship.hull, FLY.hull + MERCY.hull);
  assert.ok(T.fireK < newRun({ seed: seedOf('incal') }).fireK);
  const ev = play(T, botInput, 1 / 60);
  assert.equal(T.done, 'won');
  assert.ok(ev.some((e) => e.kind === 'win') && T.score > kept);
  // lost three times: doing nothing at all, the ship still comes through (the captain breaks off in the end)
  const U = newRun({ seed: seedOf('incal'), fails: MERCY.safe });
  play(U, {}, 1 / 60);
  assert.equal(U.done, 'won');
  assert.equal(U.ship.hull, 1);
});

test('the game: a complete definition, its controls in Xbox / PlayStation form, its shapes sound', () => {
  assert.deepEqual(checkGame(pirates), []);
  assert.equal(pirates.id, 'pirates');
  for (const [k] of pirates.controls.pad) assert.doesNotMatch(k, /\b(Space|Shift|Esc|Enter)\b/);
  assert.deepEqual(pirates.touchButtons, ['fire', 'evade', 'guard'], 'the missile on the ◇');
  assert.deepEqual(pirates.touchShow, ['guard']);
  // no start card (issue #224): it counts in at once, its controls as short hints at the bottom right, Xbox / PlayStation form
  assert.equal(pirates.direct, true);
  assert.ok(pirates.hints.pad.some(([k, v]) => k === 'LT / L2' && /missile/.test(v)) && pirates.hints.keys.some(([k]) => k === 'F'));
  for (const [k] of pirates.hints.pad) assert.doesNotMatch(k, /\b(Space|Shift|Esc|Enter|F)\b/);
  for (const [, v] of [...pirates.hints.pad, ...pirates.hints.keys]) assert.ok(v.length <= 22, `short: ${v}`);
  for (const [kind, parts] of Object.entries(pirateShapes())) {
    assert.ok(LOOK_SIZE[kind], `${kind} has a size`);
    for (const p of parts) {
      assert.ok([...p.geo.attributes.position.array].every(Number.isFinite), `${kind}: a sound shape`);
      assert.ok(p.geo.attributes.normal && p.geo.attributes.uv, `${kind}: normals and uvs (one program for all)`);
    }
  }
});

test('the first flight follows the jets setting; Reduce motion or Camera shake at 0: a hit neither shakes the view nor flares the edge (issue #230)', () => {
  // the pitch: the game's own setting until the card offers it, then the card's choice (the setting again until one is made)
  assert.equal(piratePitch({ settings: { invertFlight: true }, state: { flag: () => undefined } }), 'climb', 'forward climbs on the jets: so here too');
  assert.equal(piratePitch({ settings: { invertFlight: false }, state: { flag: (k) => ({ 'minigame.pirates.opt.pitch': 'climb' })[k] } }), 'dive', 'a choice kept from before waits for the card');
  assert.equal(piratePitch({ settings: { invertFlight: true }, state: { flag: (k) => ({ [BEATEN]: true })[k] } }), 'climb', 'offered, none chosen yet: the setting');
  assert.equal(piratePitch({ settings: { invertFlight: true }, state: { flag: (k) => ({ [BEATEN]: true, 'minigame.pirates.opt.pitch': 'dive' })[k] } }), 'dive', 'the card\'s choice');
  {
    const { S, step } = session({ settings: { invertFlight: true } });
    S.script = []; S.rocks = [];
    const v0 = S.ship.v;
    step(30, { y: 1 });
    assert.ok(S.ship.v > v0 + 2, 'pushed up with the jets set to climb: it climbs, the first time too');
    assert.match(pirates.controls.pad[0][1], /push up to climb/, 'and the card says so');
  }
  // a hit with the motion turned down: the pips still show, nothing shakes or flares
  const hit = () => {
    const { sess, S, step } = session();
    S.script = []; S.rocks = [];
    S.shots.push({ ds: 5, u: S.ship.u, v: S.ship.v, vds: -50, vu: 0, vv: 0, life: 2, r: 0.9 });
    for (let i = 0; i < 12 && S.ship.hull === FLY.hull; i++) step();
    assert.equal(S.ship.hull, FLY.hull - 1);
    return sess.feedback;
  };
  try {
    for (const m of [{ reduce: true, shake: 1 }, { reduce: false, shake: 0 }]) {
      setMotion(m);
      const F = hit();
      assert.equal(F.shake, 0, `no shake: ${JSON.stringify(m)}`);
      assert.equal(F.redT, 0, `no flare: ${JSON.stringify(m)}`);
      assert.ok(F.pipT > 0 && F.lostT > 0, 'the pips still tell');
    }
    setMotion({ reduce: false, shake: 1 });
    const F = hit();
    assert.ok(F.shake > 0 && F.redT > 0, 'the motion on: both, as before');
  } finally { setMotion({ reduce: false, shake: 1 }); session(); }
  // the shake's size follows the slider
  assert.match(fs.readFileSync(new URL('../src/minigames/pirates.js', import.meta.url), 'utf8'), /const k = run\.shake \* run\.shake \* HURT\.amp \* shakeScale\(\);/);
});

// ------------------------------------------------------------------ the missiles (issue #224)
test('a missile locks the pirate nearest the aim, chases it and downs a raider in one; four a run, a click when none is left', () => {
  const S = empty();
  const add = (kind, u, v, ds) => { const e = { id: S.nextId++, kind, path: 'parked', hp: KINDS[kind].hp, r: KINDS[kind].r, ds, u, v, age: 0, flash: 0, fireT: 99 }; S.foes.push(e); return e; };
  const r = add('raider', 6, 2, 80);
  const ev = [];
  ev.push(...runStep(S, {}, 1 / 60));
  assert.equal(S.ship.aim?.foe, r, 'the missile\'s mark on it (a wider cone than the charge\'s)');
  ev.push(...runStep(S, { missile: true }, 1 / 60));
  assert.ok(ev.some((e) => e.kind === 'missile' && e.locked), 'loosed, locked');
  assert.equal(S.ship.missiles, FLY.missile.count - 1);
  for (let t = 0; t < 2.5 && !r.dead; t += 1 / 60) ev.push(...runStep(S, {}, 1 / 60));
  assert.ok(r.dead, 'it chases the raider down (6 hp: the bolts need six hits)');
  const kill = ev.find((e) => e.kind === 'kill');
  assert.equal(kill.by, 'missile');
  assert.equal(kill.pts, Math.round(POINTS.raider * MISSILE_POINTS), 'a missile\'s kill is worth less: the totals stay');
  assert.ok(ev.some((e) => e.kind === 'missileHit' && e.n === 1));
  // held, it looses one; it must be let go for the next, and they run out
  const T = empty();
  let n = 0, dry = 0;
  for (let i = 0; i < 40; i++) { for (const e of runStep(T, { missile: i % 2 === 0 }, 0.4)) { if (e.kind === 'missile') n++; if (e.kind === 'dry') dry++; } }
  assert.equal(n, FLY.missile.count, 'four a run');
  assert.ok(dry > 0, 'then a click: none left');
  // a teal ring gives one back
  T.rings.push({ s: T.s + 10, u: T.ship.u, v: T.ship.v, r: 3.4 });
  const rev = [];
  for (let t = 0; t < 0.5; t += 1 / 60) rev.push(...runStep(T, {}, 1 / 60));
  assert.ok(rev.some((e) => e.kind === 'rearm') && T.ship.missiles === 1, 'a ring: a missile back');
  // from a checkpoint, the rack is full again
  assert.equal(newRun({ from: CHECKPOINTS[1] }).ship.missiles, FLY.missile.count);
});

test('the missiles keep the totals: the pilot with them scores within a few percent of the bolts alone, the chimes in the same range', () => {
  const total = (missiles) => { let sum = 0, fired = 0; for (const to of ['incal', 'arzach', 'perdide', 'edena']) { const S = newRun({ seed: seedOf(to) }); while (!S.done && S.t < 200) fired += runStep(S, botInput(S, { missiles }), 1 / 60).filter((e) => e.kind === 'missile').length; assert.equal(S.done, 'won'); sum += S.score; } return { sum, fired }; };
  const a = total(false), b = total(true);
  assert.ok(b.fired >= 12, `the pilot looses its missiles (${b.fired})`);
  assert.ok(Math.abs(b.sum - a.sum) / a.sum < 0.04, `${b.sum} with the missiles against ${a.sum} without`);
  assert.ok(Math.abs(chimesFor(b.sum / 4) - chimesFor(a.sum / 4)) <= 3, 'the chimes a run within three');
});
