// The minigames (docs/systems/minigames.md): the registry, the scores and the best kept in the save,
// the controls, and the pure bodies of the two first games: the skier (carving, the tuck, the lips) and
// the platformer's (coyote time, the jump buffer, the jump's height, the course played through).
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectGames, checkGame, gameById, gameHref } from '../src/minigames/index.js';
import { formatTime, formatScore, better, recordScore, bestScore, bestKey, playsKey } from '../src/minigames/kit/scores.js';
import { readInput, NO_INPUT } from '../src/minigames/kit/input.js';
import { COUNT, countNumeral, controlsFor, quitHref } from '../src/minigames/kit/flow.js';
import { levelMetaFor } from '../src/minigames/kit/world.js';
import { GameState } from '../src/game-state.js';
import { gamesRow } from '../src/world-picker.js';
import { opensTitle } from '../src/save-slots.js';
import ski, { skiStep, newSkier, SKI, courseHeight, courseGates, crossGate, COURSE as SKI_COURSE, centerX } from '../src/minigames/ski.js';
import platformer, { platStep, newBody, PLAT, PlatWorld, COURSE as PLAT_COURSE, botInput, CRUMBLE, timeBonus } from '../src/minigames/platformer.js';

const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const MODULES = { './ski.js': { default: ski }, './platformer.js': { default: platformer } };

// ------------------------------------------------------------------ the registry
test('the registry finds the games among modules, checked, one per id, in their order', () => {
  const warns = [];
  const games = collectGames({
    ...MODULES,
    './kit-helper.js': { helper: () => 1 },                                          // (not a game: skipped quietly)
    './broken.js': { default: { id: 'Bad Id', name: 'x', start() {} } },             // (broken: left out, with a warning)
    './again.js': { default: { ...ski, name: 'Ski again' } },                         // (an id taken)
  }, (m) => warns.push(m));
  assert.deepEqual(games.map((g) => g.id), ['ski', 'platformer']);
  assert.equal(warns.length, 2);
  assert.match(warns.join('\n'), /broken\.js.*lower-case/);
  assert.match(warns.join('\n'), /again\.js.*taken/);
  assert.equal(gameById('platformer', games), platformer);
  assert.equal(gameById('nothing', games), null);
  assert.equal(gameHref('ski'), '?game=ski');
  assert.equal(gameHref('ski', 'desert'), '?game=ski&from=desert');
});

test('every game in the folder is a complete definition', () => {
  for (const g of [ski, platformer]) {
    assert.deepEqual(checkGame(g), [], g.id);
    assert.ok(g.controls.pad.length && g.controls.keys.length, `${g.id}: controls for the pad and the keys`);
    // prompts in the Xbox / PlayStation form (src/native-pad.js rewrites them for the handhelds)
    for (const [k] of g.controls.pad) assert.doesNotMatch(k, /\b(Space|Shift|Esc|Enter)\b/, `${g.id}: "${k}" is a key, not a pad button`);
    assert.ok(g.controls.pad.some(([k]) => /A \/ ×|RT \/ R2|Left stick|Menu/.test(k)));
  }
  assert.deepEqual(checkGame({ id: 'x', name: 'X', blurb: 'b', rules: 'r', start() {} }), ['neither a world (a level id) nor a build (its own arena)']);
  assert.deepEqual(checkGame({ id: 'x', name: 'X', blurb: 'b', rules: 'r', start() {}, world: 'desert', score: { kind: 'laps' } }), ['score.kind "laps" is not time or points']);
});

test('a game page skips the title, and the worlds list has a row of games', () => {
  assert.equal(opensTitle('?game=ski'), false);
  const row = gamesRow([ski, platformer]);
  assert.match(row, /Games/);
  assert.match(row, /href="\?game=ski"/);
  assert.match(row, /href="\?game=platformer"/);
  assert.equal(gamesRow([]), '');
});

test('a game runs in its own arena under its host\'s id, or in the world it names', () => {
  const levels = { arena: { id: 'arena', title: 'The Arena', build: null }, desert: { id: 'desert', title: 'Desert' } };
  const byId = (id) => levels[id];
  const m = levelMetaFor(ski, byId);
  assert.equal(m.id, 'arena');
  assert.equal(m.title, ski.name);
  assert.equal(typeof m.build, 'function');
  assert.equal(levelMetaFor({ ...ski, world: 'desert' }, byId), levels.desert);
});

// ------------------------------------------------------------------ scores and the best
test('times read as minutes, seconds and hundredths; points with their unit', () => {
  assert.equal(formatTime(83.456), '1:23.45');
  assert.equal(formatTime(9.5), '9.50');
  assert.equal(formatTime(60), '1:00.00');
  assert.equal(formatTime(NaN), '—');
  assert.equal(formatScore(ski, 41.2), '41.20');
  assert.equal(formatScore(platformer, 412.4), '412 pts');
  assert.ok(better(ski.score, 40, 41) && !better(ski.score, 42, 41));
  assert.ok(better(platformer.score, 420, 410) && !better(platformer.score, 400, 410));
  assert.ok(better(ski.score, 50, NaN) && !better(ski.score, NaN, 50));
});

test('the best score is kept in the save, per game, only when beaten', () => {
  const state = new GameState(memStorage());
  assert.equal(bestScore(state, ski), null);
  let r = recordScore(state, ski, 52.3);
  assert.deepEqual([r.isNew, r.first, r.best, r.previous, r.plays], [false, true, 52.3, null, 1], 'the first score kept: nothing beaten, no stamp');
  r = recordScore(state, ski, 55);
  assert.deepEqual([r.isNew, r.best, r.plays], [false, 52.3, 2]);
  r = recordScore(state, ski, 48.9);
  assert.deepEqual([r.isNew, r.best, r.previous], [true, 48.9, 52.3]);
  recordScore(state, platformer, 300);
  recordScore(state, platformer, 280);
  assert.equal(bestScore(state, platformer), 300);
  // kept in the save, as the save's flags
  const again = new GameState(state.storage);
  assert.equal(again.flag(bestKey('ski')), 48.9);
  assert.equal(again.flag(playsKey('ski')), 3);
  assert.equal(again.flag(bestKey('platformer')), 300);
});

test('a run that scored nothing is counted but keeps no best and stamps nothing', () => {
  const state = new GameState(memStorage());
  let r = recordScore(state, platformer, 0);
  assert.deepEqual([r.isNew, r.first, r.best, r.plays], [false, false, null, 1]);
  assert.equal(bestScore(state, platformer), null, '0 points: no best');
  r = recordScore(state, platformer, 120);
  assert.deepEqual([r.isNew, r.first, r.best], [false, true, 120], 'the first real score: kept, not stamped');
  r = recordScore(state, platformer, 120);
  assert.equal(r.isNew, false, 'a tie is no new best');
  r = recordScore(state, platformer, 0);
  assert.equal(r.isNew, false);
  r = recordScore(state, platformer, 121);
  assert.equal(r.isNew, true, 'beating a kept best: stamped');
  assert.equal(recordScore(state, platformer, -50).isNew, false, 'a negative score (the gallery\'s friends) is never kept');
});

// ------------------------------------------------------------------ the controls and the cards
test('the controls read the same from the keys, a stick and a pad', () => {
  let i = readInput({ KeyD: true, Space: true });
  assert.deepEqual([i.x, i.jump, i.jumpPressed], [1, true, true]);
  i = readInput({ KeyD: true, Space: true }, i);
  assert.equal(i.jumpPressed, false, 'a held button is pressed once');
  i = readInput({}, i);
  assert.equal(i.jumpReleased, true);
  i = readInput({ stick: { x: -0.4, y: 0.2 }, PadThrust: 0.7 });
  assert.deepEqual([i.x, i.y, i.tuck], [-0.4, 0.2, 0.7]);
  assert.equal(readInput({ KeyS: true }).brake, 1, 'the stick pulled back brakes');
  assert.equal(readInput({ PadAim: true }).brake, 1, 'LT brakes');
  assert.equal(readInput({ ShiftLeft: true }).tuck, 1);
  assert.deepEqual(readInput(undefined), { ...NO_INPUT });
  assert.deepEqual(controlsFor(ski, 'pad'), ski.controls.pad);
  assert.deepEqual(controlsFor(ski, 'keys'), ski.controls.keys);
  assert.deepEqual(controlsFor({ controls: { pad: [['A', 'b']] } }, 'touch'), [['A', 'b']]);
});

test('the 3-2-1, and where Quit goes', () => {
  assert.equal(countNumeral(COUNT.step * COUNT.from), 3);
  assert.equal(countNumeral(COUNT.step * 1.5), 2);
  assert.equal(countNumeral(0.01), 1);
  assert.equal(countNumeral(0), 0);
  assert.equal(quitHref('desert'), '?level=desert');
  assert.equal(quitHref(null), '?worlds=1');
});

// ------------------------------------------------------------------ the skier
const plane = (k = 0.25) => (x, z) => k * z;   // a uniform slope falling toward -z

test('a skier left alone runs down the fall line and gathers speed', () => {
  const g = plane(), S = newSkier(0, 0, Math.PI, g);
  for (let i = 0; i < 120; i++) skiStep(S, {}, 1 / 60, g);
  assert.ok(S.vz < -5, `downhill (${S.vz.toFixed(1)})`);
  assert.ok(Math.abs(S.vx) < 0.01);
  assert.ok(Math.abs(S.y - g(S.x, S.z)) < 1e-6, 'on the snow… the sand');
});

test('carving: the stick turns the skis and the speed follows them round, a carve keeping more than a skid', () => {
  const g = plane();
  const run = (inp, secs = 1.2) => {
    const S = newSkier(0, 0, Math.PI, g);
    S.vz = -18; S.speed = 18;
    for (let i = 0; i < secs * 60; i++) skiStep(S, inp, 1 / 60, g);
    return S;
  };
  const right = run({ x: 1 });
  assert.ok(right.x > 1.5, `a right carve goes right (x ${right.x.toFixed(2)})`);
  assert.ok(right.heading < Math.PI - 0.5 && right.heading > 0, 'the skis turned toward +x');
  const dir = Math.atan2(right.vx, right.vz);
  assert.ok(Math.abs(Math.atan2(Math.sin(dir - right.heading), Math.cos(dir - right.heading))) < 0.35, 'the speed goes where the skis point');
  assert.ok(right.lean > 0.1, 'leaning into the turn');
  const left = run({ x: -1 });
  assert.ok(left.x < -1.5);
  const skid = run({ x: 1, brake: 1 });
  assert.ok(skid.speed < right.speed - 3, `a skid brakes (${skid.speed.toFixed(1)} vs ${right.speed.toFixed(1)})`);
});

test('a tuck goes faster than standing up', () => {
  const g = plane(0.22);
  const top = (inp) => { const S = newSkier(0, 0, Math.PI, g); for (let i = 0; i < 60 * 25; i++) skiStep(S, inp, 1 / 60, g); return S.speed; };
  const stand = top({}), tuck = top({ tuck: 1 });
  assert.ok(tuck > stand * 1.2, `tuck ${tuck.toFixed(1)} vs ${stand.toFixed(1)} m/s`);
  assert.ok(tuck <= SKI.maxSpeed);
});

test('off a lip into the air, a pop on demand, and landings clean or not', () => {
  // the course's own lip: at speed, the ground falls away from under the skis
  const L = SKI_COURSE.lips[1], z0 = L + 40, cx = centerX(z0);
  const S = newSkier(cx, z0, Math.PI, courseHeight);
  S.vz = -24;
  let air = false;
  for (let i = 0; i < 240 && !air; i++) air = skiStep(S, {}, 1 / 60, courseHeight).some((e) => e.kind === 'air');
  assert.ok(air, 'flew off the lip');
  assert.ok(Math.abs(S.z - L) < 4, `at the lip (${S.z.toFixed(1)} vs ${L})`);
  let land = null;
  for (let i = 0; i < 300 && !land; i++) land = skiStep(S, {}, 1 / 60, courseHeight).find((e) => e.kind === 'land');
  assert.ok(land?.clean, 'a straight landing is clean');
  // a pop, then the skis spun a quarter round in the air: a sloppy landing loses the speed
  const g = plane(), P = newSkier(0, 0, Math.PI, g);
  P.vz = -15;
  assert.ok(skiStep(P, { jumpPressed: true }, 1 / 60, g).some((e) => e.kind === 'pop'));
  let l2 = null;
  for (let i = 0; i < 200 && !l2; i++) l2 = skiStep(P, { x: i < 14 ? 1 : 0 }, 1 / 60, g).find((e) => e.kind === 'land');
  assert.equal(l2?.clean, false);
  assert.ok(P.speed < 8);
});

test('the gates: down the course on alternate sides, none on a lip, passed between the poles', () => {
  const gates = courseGates();
  assert.ok(gates.length >= 12);
  for (let i = 1; i < gates.length; i++) { assert.ok(gates[i].z < gates[i - 1].z); assert.equal(gates[i].side, -gates[i - 1].side); }
  for (const g of gates) for (const L of SKI_COURSE.lips) assert.ok(Math.abs(g.z - L) >= 20, `gate at ${g.z} clear of the lip at ${L}`);
  const g = gates[0];
  assert.equal(crossGate(g, g.x, g.z + 1, g.x + 1, g.z - 1), 'pass');
  assert.equal(crossGate(g, g.x + 9, g.z + 1, g.x + 9, g.z - 1), 'miss');
  assert.equal(crossGate(g, g.x, g.z + 3, g.x, g.z + 1), null, 'not there yet');
  // the course falls the whole way from the start to the finish
  assert.ok(courseHeight(centerX(SKI_COURSE.startZ), SKI_COURSE.startZ) - courseHeight(centerX(SKI_COURSE.finishZ), SKI_COURSE.finishZ) > 180);
});

// ------------------------------------------------------------------ the platformer
const floor = (x0, x1, top, o = {}) => ({ x0, x1, y1: top, y0: top - 1, oneWay: false, vx: 0, vy: 0, ...o });
const stepN = (B, inp, n, solids, dt = 1 / 60) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...platStep(B, typeof inp === 'function' ? inp(i) : inp, dt, solids)); return ev; };

test('coyote time: a jump a moment after running off an edge still counts; later, it does not', () => {
  const solids = [floor(-10, 0, 0)];
  const offEdge = () => {
    const B = newBody(-1, 0);
    stepN(B, { x: 1 }, 1, solids);
    stepN(B, { x: 1 }, 40, solids);
    return B;
  };
  // run off, find the first frame in the air
  const B = newBody(-2, 0); B.vx = PLAT.run;
  let n = 0;
  while (B.onGround && n < 100) { platStep(B, { x: 1 }, 1 / 60, solids); n++; }
  assert.ok(!B.onGround && B.coyoteT > 0, 'just off the edge, the coyote time running');
  const late = { ...B };
  const ev = platStep(B, { x: 1, jump: true, jumpPressed: true }, 1 / 60, solids);
  assert.ok(ev.some((e) => e.kind === 'coyote') && B.vy > 10, 'jumped in the coyote time');
  stepN(late, { x: 1 }, Math.ceil((PLAT.coyote + 0.05) * 60), solids);
  const ev2 = platStep(late, { x: 1, jump: true, jumpPressed: true }, 1 / 60, solids);
  assert.ok(!ev2.some((e) => e.kind === 'jump') && late.vy < 0, 'too late: falling');
  assert.ok(offEdge().y < 0);
});

test('a jump pressed just before landing goes off as you land (the buffer)', () => {
  const solids = [floor(-10, 10, 0)];
  const B = newBody(0, 3); B.onGround = false; B.vy = -6;
  let jumped = false, landedAt = -1;
  for (let i = 0; i < 60 && !jumped; i++) {
    const h = B.y;   // press a few frames before the ground
    const ev = platStep(B, { x: 0, jump: h < 0.9, jumpPressed: h < 0.9 && h > 0.5 }, 1 / 60, solids);
    if (ev.some((e) => e.kind === 'land')) landedAt = i;
    if (ev.some((e) => e.kind === 'jump')) jumped = true;
  }
  assert.ok(landedAt >= 0 && jumped, 'landed and went straight up again');
  assert.ok(B.vy > 10);
});

test('the jump is as high as the button is held', () => {
  const solids = [floor(-10, 10, 0)];
  const peak = (holdFrames) => {
    const B = newBody(0, 0);
    platStep(B, { x: 0, jump: true, jumpPressed: true }, 1 / 60, solids);
    let top = 0;
    for (let i = 0; i < 90; i++) { platStep(B, { x: 0, jump: i < holdFrames }, 1 / 60, solids); top = Math.max(top, B.y); }
    return top;
  };
  const tap = peak(2), held = peak(60);
  assert.ok(held > 2.4 && held < 3.4, `a full jump ${held.toFixed(2)} m`);
  assert.ok(tap < held * 0.55, `a tap ${tap.toFixed(2)} m`);
});

test('one-way stones are jumped up through and stood on; a spring throws you; a crumbling stone gives way', () => {
  const slab = floor(-2, 2, 2, { oneWay: true });
  const B = newBody(0, 0);
  const solids = [floor(-10, 10, 0), slab];
  stepN(B, (i) => ({ x: 0, jump: true, jumpPressed: i === 0 }), 80, solids);
  assert.ok(B.onGround && B.ground === slab && Math.abs(B.y - 2) < 1e-6, 'up through it, and onto it');
  // a spring
  const W = new PlatWorld();
  const spring = W.stones.find((s) => s.spring);
  const S = newBody((spring.x0 + spring.x1) / 2 - 1.5, spring.y1 - 0.15);
  let thrown = false;
  for (let i = 0; i < 40 && !thrown; i++) { W.update(1 / 60, S.onGround ? S.ground : null); thrown = platStep(S, { x: 1 }, 1 / 60, W.solids()).some((e) => e.kind === 'spring'); }
  assert.ok(thrown && S.vy > 20, 'walked onto the spring: thrown up');
  // a crumbling stone
  const c = W.stones.find((s) => s.crumble);
  const C = newBody((c.x0 + c.x1) / 2, c.y1);
  for (let i = 0; i < 60 * (CRUMBLE.shake + 0.5); i++) { W.update(1 / 60, C.onGround ? C.ground : null); platStep(C, { x: 0 }, 1 / 60, W.solids()); }
  assert.ok(c.gone && !C.onGround && C.vy < 0, 'it fell, and you with it');
  for (let i = 0; i < 60 * (CRUMBLE.back + 0.2); i++) W.update(1 / 60, null);
  assert.ok(!c.gone, 'and came back');
});

test('a drifting stone carries you', () => {
  const W = new PlatWorld();
  const m = W.stones.find((s) => s.move && s.move.dx);
  const B = newBody((m.x0 + m.x1) / 2, m.y1);
  const x0 = B.x - (m.x0 + m.x1) / 2;
  for (let i = 0; i < 50; i++) { W.update(1 / 60, B.onGround ? B.ground : null); platStep(B, { x: 0 }, 1 / 60, W.solids()); }
  assert.ok(B.onGround && B.ground === m);
  assert.ok(Math.abs(B.x - (m.x0 + m.x1) / 2 - x0) < 0.15, 'kept its place on the stone');
});

test('the course can be played through to the gate, at any frame rate, with no fall', () => {
  for (const dt of [1 / 120, 1 / 60, 1 / 30, 1 / 20]) {
    const W = new PlatWorld();
    let B = newBody(0, 0), check = 0, t = 0, falls = 0, coins = 0, prev = { jump: false }, done = false;
    const mem = {};
    while (t < 120 && !done) {
      W.update(dt, B.onGround ? B.ground : null);
      const inp = botInput(W, B, mem);
      inp.jumpPressed = inp.jump && !prev.jump;
      platStep(B, inp, dt, W.solids());
      prev = inp;
      coins += W.take(B).length;
      if (B.onGround) check = Math.max(check, W.checkpointAt(B.x));
      if (B.y < PLAT_COURSE.killY) { falls++; const sp = W.spawnAt(check); B = newBody(sp.x, sp.y); }
      done = B.x >= PLAT_COURSE.goal && B.onGround;
      t += dt;
    }
    assert.ok(done, `reached the gate at dt ${dt.toFixed(3)} (stopped at x ${B.x.toFixed(1)})`);
    assert.equal(falls, 0, `no fall at dt ${dt.toFixed(3)}`);
    assert.ok(coins >= 25, `picked up ${coins} glyphs on the way`);
    assert.ok(t < 45, `in ${t.toFixed(1)} s`);
  }
  assert.equal(PLAT_COURSE.coins.length, 40);
  assert.ok(timeBonus(30) > timeBonus(50) && timeBonus(200) === 0);
});
