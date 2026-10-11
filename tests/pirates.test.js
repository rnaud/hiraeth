// The chime-pirates' rail shooter (docs/systems/minigames.md, "Pirates between worlds"): the rail, the rocks, the
// run played by the pilot at any frame rate, the charged shot's lock and burst, the roll, the repair rings, the
// captain breaking off, the controls; the game's definition and its shapes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FLY, BOSS, SCRIPT, KINDS, CHIMES_OF, CHECKPOINTS, MERCY, BELTS, railX, railY, railPoint, courseRocks, seedOf, newRun, runStep, botInput, pirateInput, findLock, aimAt } from '../src/minigames/pirates-rules.js';
import pirates, { pirateShapes, rocksFor, LOOK_SIZE } from '../src/minigames/pirates.js';
import { checkGame } from '../src/minigames/index.js';

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
    assert.ok(ev.some((e) => e.kind === 'win' && e.sunk), 'the galleon sunk');
    assert.ok(ev.filter((e) => e.kind === 'part').length === 3, 'two guns, then the bridge');
    assert.ok(S.kills > 32, `${S.kills} pirates downed`);
    assert.ok(S.chimes > 60 && ev.find((e) => e.kind === 'win').chimes === S.chimes, `${S.chimes} chimes won`);
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

test('the captain: the bridge armoured until both guns are down; left alone, the galleon breaks off and the run still ends', () => {
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

test('the controls: the stick as the jets fly, fire from A / ×, Space or the touch ✺, the roll from B, LB, X, Shift or ↶', () => {
  assert.equal(pirateInput({ y: 1 }).y, -1, 'forward dives');
  assert.equal(pirateInput({ y: 1 }, {}, { climb: true }).y, 1, 'or climbs, as chosen on the start card');
  const pitch = pirates.options.find((o) => o.id === 'pitch');
  assert.deepEqual(pitch.choices.map(([v]) => v), ['dive', 'climb']);
  assert.equal(pitch.default, 'dive', 'dives by default, as in Star Fox 64 and on the jets, and the card says so');
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

test('shot down, the pirates’ ships are worth chimes; mines and rams are not (issue #88)', () => {
  const S = empty();
  const add = (kind, ds) => { const e = { id: S.nextId++, kind, path: 'parked', hp: 1, r: KINDS[kind].r, ds, u: S.ship.u, v: S.ship.v - 0.1, age: 0, flash: 0, fireT: 99 }; S.foes.push(e); return e; };
  add('raider', 40);
  const ev = [];
  for (let t = 0; t < 0.6; t += 1 / 60) ev.push(...runStep(S, { auto: true }, 1 / 60));
  const kill = ev.find((e) => e.kind === 'kill');
  assert.equal(kill?.chimes, CHIMES_OF.raider);
  assert.equal(S.chimes, CHIMES_OF.raider);
  assert.equal(CHIMES_OF.mine, undefined, 'a mine is not a ship');
  for (const k of ['skiff', 'raider', 'hauler', 'gunL', 'gunR', 'core']) assert.ok(CHIMES_OF[k] > 0, k);
});

test('lost, the run starts again from the last checkpoint, kinder each time; from the third loss the hull holds: every fight can be won', () => {
  assert.deepEqual(CHECKPOINTS.slice(0, 1), [0]);
  assert.ok(CHECKPOINTS.length >= 3, 'the start, mid-way, before the captain');
  assert.ok(CHECKPOINTS[CHECKPOINTS.length - 1] < SCRIPT.find((e) => e.boss).t, 'the last before the captain');
  // an idle ship passes nothing and is lost; one flown by the pilot until a checkpoint, then idle, keeps it
  const S = newRun({ seed: seedOf('incal') });
  play(S, botInput, 1 / 60, CHECKPOINTS[1] + 1);
  assert.equal(S.checkpoint, CHECKPOINTS[1]);
  const kept = S.chimes;
  play(S, {}, 1 / 60);
  assert.equal(S.done, 'dead');
  assert.equal(S.chimesAt, kept, 'the chimes won before it are kept');
  // again from there: the waves before it gone by, the hull a pip stronger, the pirates firing less
  const T = newRun({ seed: seedOf('incal'), from: S.checkpoint, fails: 1, chimes: S.chimesAt });
  assert.equal(T.t, CHECKPOINTS[1]);
  assert.ok(T.script.slice(0, T.next).every((e) => e.t <= CHECKPOINTS[1]) && T.script.slice(T.next).every((e) => e.t > CHECKPOINTS[1]));
  assert.equal(T.ship.hull, FLY.hull + MERCY.hull);
  assert.ok(T.fireK < newRun({ seed: seedOf('incal') }).fireK);
  const ev = play(T, botInput, 1 / 60);
  assert.equal(T.done, 'won');
  assert.ok(ev.some((e) => e.kind === 'win') && T.chimes > kept);
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
  assert.deepEqual(pirates.touchButtons, ['fire', 'evade']);
  for (const [kind, parts] of Object.entries(pirateShapes())) {
    assert.ok(LOOK_SIZE[kind], `${kind} has a size`);
    for (const p of parts) {
      assert.ok([...p.geo.attributes.position.array].every(Number.isFinite), `${kind}: a sound shape`);
      assert.ok(p.geo.attributes.normal && p.geo.attributes.uv, `${kind}: normals and uvs (one program for all)`);
    }
  }
});
