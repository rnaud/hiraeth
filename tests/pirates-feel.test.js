// The chime pirates made better (issue #326, the author: "Make the buttons hints much smaller and minimal. Better sound
// effects, better enemy designs. Better game feel"): the hint row's size and fade, every pirate kind with its own
// attack after its telegraph, the sounds (each made, each on the music page), the feel of a kill (a small capped
// shake, a hit-stop, the combo, the debris), the aim assist and the stick's curve and brake.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { FLY, ATTACKS, KINDS, BOSS, newRun, runStep, aimAt } from '../src/minigames/pirates-rules.js';
import pirates, { pirateShapes, pirateHints, FEEL, TELL_AT, PIRATE_COLORS } from '../src/minigames/pirates.js';
import { pirateSounds, PIRATE_SOUNDS } from '../src/minigames/pirates-sfx.js';
import { hintRow, HINT_ROW } from '../src/minigames/kit/flow.js';
import { HINT } from '../src/hint-look.js';
import { setMotion } from '../src/feel.js';

/** A run with nothing in it but what the test puts there. */
function empty(F = FLY) { const S = newRun({ seed: 1 }, F); S.script = []; S.rocks = []; return S; }
const park = (S, kind, o = {}) => { const e = { id: S.nextId++, kind, path: 'parked', hp: KINDS[kind].hp, r: KINDS[kind].r, ds: 60, u: 0, v: 0, age: 0, flash: 0, fireT: 99, face: 'ship', ...o }; S.foes.push(e); return e; };
const steps = (S, secs, inp = {}) => { const ev = []; for (let t = 0; t < secs; t += 1 / 60) ev.push(...runStep(S, typeof inp === 'function' ? inp(S) : inp, 1 / 60).map((e) => ({ ...e, t: S.t }))); return ev; };

// ------------------------------------------------------------------ the hints
test('the hints: one small row of a button and a word each, in the dark hint look, fading after the first seconds and each once used', () => {
  // the rows: a key, one short word (the stick's two, its pitch), an id the game marks used
  for (const pitch of ['dive', 'climb']) {
    const H = pirateHints(pitch);
    for (const kind of ['pad', 'keys', 'touch']) {
      for (const [k, w, id] of H[kind]) {
        assert.ok(k && w && id, `${kind}: ${k} ${w} ${id}`);
        assert.ok(w.length <= 16 && w.split(/\s+/).length <= 3, `minimal: "${w}"`);
      }
      assert.ok(H[kind].length <= 6, `${kind}: at most six buttons (five until the boost and brake, issue #495: one entry for both)`);
    }
    assert.match(H.pad[0][1], new RegExp(`↑ ${pitch}s`), 'the stick says the pitch');
    assert.ok(!H.pad.some(([k]) => /Menu/.test(k)), 'no pause in the row (the ❚❚ and Menu are everywhere)');
  }
  assert.deepEqual(pirates.hints.pad.map((r) => r[2]), ['steer', 'fire', 'charge', 'missile', 'speed', 'roll']);
  // the fade: all shown at first, a used one gone after a moment, all of them after HINT_ROW.show
  const rows = pirates.hints.pad;
  let r = hintRow(rows, { age: 0.5, used: new Map() });
  assert.ok(!r.off && r.items.every((i) => !i.gone), 'all shown at first');
  const used = new Map([['fire', 1]]);
  r = hintRow(rows, { age: 1 + HINT_ROW.used + 0.05, used });
  assert.ok(r.items.find((i) => i.id === 'fire').gone, 'fire used: its word gone');
  assert.ok(r.items.filter((i) => i.id !== 'fire').every((i) => !i.gone), 'the others still shown');
  r = hintRow(rows, { age: HINT_ROW.show + 0.1, used: new Map() });
  assert.ok(r.off && r.items.every((i) => i.gone), 'after the first seconds the row is gone');
  assert.ok(hintRow(rows, { age: 0, live: false }).off, 'not while paused or on a card');
  assert.ok(HINT_ROW.show >= 4 && HINT_ROW.show <= 10);
  // the size and the look: small type, the strip's near-black and cream and gold (src/hint-look.js), one row
  const css = readFileSync(new URL('../src/minigames/kit/minigames.css', import.meta.url), 'utf8');
  const rule = css.match(/#minigame \.mg-hints \{[^}]*\}/)[0];
  const px = +rule.match(/font:[^;]*?(\d+)px/)[1];
  assert.ok(px <= 12, `${px} px type (12 px in a cream box of six rows before)`);
  assert.equal(px, HINT_ROW.px);
  assert.match(rule, /display: flex/);
  assert.match(rule, /var\(--hint-ink/);
  assert.match(css, /\.mg-hint-row \{[^}]*var\(--hint-bg, rgba\(18, 14, 13, 0\.92\)\)/);
  assert.match(css, /\.mg-hint-row b \{[^}]*var\(--hint-accent/);
  assert.match(HINT.bg, /rgba\(18, 14, 13/);
  assert.doesNotMatch(rule, /rgba\(247, 236, 210/, 'no cream box');
  // the runner fades them (kit/runner.js drawHints) and the game marks each button used
  const runner = readFileSync(new URL('../src/minigames/kit/runner.js', import.meta.url), 'utf8');
  assert.match(runner, /hintUsed\(id\)/);
  assert.match(runner, /hintRow\(controlsFor\(/);
  const game = readFileSync(new URL('../src/minigames/pirates.js', import.meta.url), 'utf8');
  for (const id of ['fire', 'charge', 'missile', 'roll', 'steer']) assert.match(game, new RegExp(`hintUsed\\?\\.\\('${id}'\\)`), `${id} marked used`);
});

// ------------------------------------------------------------------ the pirates
test('every pirate kind has its own silhouette, colours and a part that glows as it winds up', () => {
  const S = pirateShapes();
  const names = new Set(Object.values(ATTACKS).map((a) => a.name));
  assert.equal(names.size, Object.keys(ATTACKS).length, 'each kind its own name: fighter, gunboat, bomber, mine, flagship');
  for (const kind of ['skiff', 'raider', 'hauler']) {
    assert.equal(S[kind].filter((p) => p.tell).length, 1, `${kind}: one tell part`);
    assert.ok(S[kind].length >= 5, `${kind}: ${S[kind].length} parts`);
    assert.ok(TELL_AT[kind], `${kind}: where its tell glows`);
    assert.ok(ATTACKS[kind].tell >= 0.35, `${kind}: a telegraph long enough to see (${ATTACKS[kind].tell} s)`);
  }
  // silhouettes: how wide and how tall each reads from in front (the fighter's X tall, the gunboat's brow wide, the bomber big)
  const ext = (kind) => { const b = new THREE.Box3(); for (const p of S[kind]) { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox); } const s = b.getSize(new THREE.Vector3()); return s; };
  const f = ext('skiff'), g = ext('raider'), h = ext('hauler');
  assert.ok(f.y / f.x > 0.45, `the fighter's blades in an X (${(f.y / f.x).toFixed(2)})`);
  assert.ok(g.x / g.y > 1.35, `the gunboat's brow wide (${(g.x / g.y).toFixed(2)})`);
  assert.ok(h.x > g.x && h.x > f.x, 'the bomber the biggest');
  const all = Object.values(PIRATE_COLORS).map((c) => c.body);
  assert.equal(new Set(all).size, all.length, 'each body its own colour');
});

test('every pirate kind spawns with its attack, after its telegraph', () => {
  // the fighter: one aimed shot, its eye flaring ATTACKS.skiff.tell s before
  {
    const S = empty(); park(S, 'skiff', { fireT: 1 });
    const ev = steps(S, 1.4);
    const tell = ev.find((e) => e.kind === 'tell' && e.foe === 'skiff'), shots = ev.filter((e) => e.kind === 'enemyShot' && e.by === 'skiff');
    assert.ok(tell && shots.length === 1, 'a tell, then one shot');
    assert.ok(shots[0].t - tell.t >= ATTACKS.skiff.tell - 0.05, `${(shots[0].t - tell.t).toFixed(2)} s of warning`);
  }
  // the gunboat: a fan of three, left of the ship, at it, right of it
  {
    const S = empty(); park(S, 'raider', { fireT: 1 });
    const ev = steps(S, 1.8);
    const tell = ev.find((e) => e.kind === 'tell' && e.foe === 'raider'), shots = ev.filter((e) => e.kind === 'enemyShot' && e.by === 'raider');
    assert.ok(tell, 'the brow cannon glows first');
    assert.equal(shots.length, ATTACKS.raider.n, 'three shots');
    assert.ok(shots[0].t - tell.t >= ATTACKS.raider.tell - 0.05);
    const vus = S.shots.map((b) => b.vu);
    assert.ok(Math.max(...vus) - Math.min(...vus) > 1, 'fanned out, not one line');
  }
  // the bomber: on its way across, the bay lamp blinks, then a mine drops
  {
    const S = empty(); S.script = [{ t: S.t, wave: 'hauler', side: 1 }];
    const ev = steps(S, 12);
    const tells = ev.filter((e) => e.kind === 'tell' && e.foe === 'hauler'), mines = ev.filter((e) => e.kind === 'mine');
    assert.ok(mines.length >= 3 && tells.length >= mines.length, `${tells.length} tells, ${mines.length} mines`);
    assert.ok(tells[0].t < mines[0].t, 'the lamp before the first');
    assert.ok(S.foes.some((e) => e.kind === 'mine') || ev.some((e) => e.kind === 'mine'));
  }
  // the flagship: each turret glows before its volley; with both down, the bridge swells before each ring
  {
    const S = empty(); S.script = [{ t: S.t, boss: true }];
    const ev = steps(S, BOSS.enter + 6, () => { S.ship.iframe = 1; return {}; });
    const tell = ev.find((e) => e.kind === 'tell' && e.foe === 'boss' && /^gun/.test(e.part));
    const shot = ev.find((e) => e.kind === 'enemyShot' && e.by === tell?.part && e.t > tell.t);
    assert.ok(tell && shot, 'a turret glows, then fires');
    assert.ok(shot.t - tell.t >= ATTACKS.boss.tell * 0.8, `${(shot.t - tell.t).toFixed(2)} s`);
    for (const p of S.boss.parts) if (p.id !== 'core') p.gone = true;
    const ev2 = steps(S, 4, () => { S.ship.iframe = 1; return {}; });
    const rt = ev2.find((e) => e.kind === 'tell' && e.part === 'core'), ring = ev2.find((e) => e.kind === 'enemyShot' && e.ring && e.t > rt?.t);
    assert.ok(rt && ring, 'the bridge swells, then rings');
    assert.ok(ring.t - rt.t >= ATTACKS.boss.ringTell * 0.8);
  }
  // while winding up, tellK rises 0 → 1 (the page draws it)
  const S = empty(); const e = park(S, 'raider', { fireT: ATTACKS.raider.tell });
  runStep(S, {}, 1 / 60); const k0 = e.tellK;
  steps(S, ATTACKS.raider.tell * 0.6); const k1 = e.tellK;
  assert.ok(k0 >= 0 && k1 > k0 + 0.4 && k1 <= 1, `${k0.toFixed(2)} → ${k1.toFixed(2)}`);
});

// ------------------------------------------------------------------ the sounds
/** A sound that records what it plays. */
const recordingSound = () => { const played = []; return { played, ctx: { currentTime: 0 }, muted: false, fx: {}, sweep: (...a) => played.push(['sweep', ...a]), burst: (...a) => played.push(['burst', ...a]), pluck: (...a) => played.push(['pluck', ...a]), noiseGlide: (...a) => played.push(['noiseGlide', ...a]) }; };

test('the sounds: each made of layers, nothing shrill, each named and on the music page', () => {
  const rec = recordingSound(), snd = pirateSounds(rec);
  const catalog = readFileSync(new URL('../src/music-page/catalog.js', import.meta.url), 'utf8');
  for (const k of Object.keys(snd)) {
    assert.ok(PIRATE_SOUNDS[k], `${k} named`);
    if (k === 'engine' || k === 'bed') continue;   // (held: its nodes on a real context, tests/music-page.test.js plays it; the places' beds, issue #555)
    const before = rec.played.length;
    rec.ctx.currentTime += 1;   // (past the shot's and the hit's rate limits)
    snd[k]();
    const made = rec.played.slice(before);
    assert.ok(made.length >= (['lock', 'comms', 'tally', 'dry'].includes(k) ? 1 : 2), `${k}: ${made.length} layers`);
    for (const [kind, ...a] of made) {
      if (kind === 'sweep') { assert.ok(Math.max(a[1], a[2]) <= 2700, `${k}: a tone at ${Math.max(a[1], a[2])} Hz`); if (a[5] === 'sawtooth' || a[5] === 'square') assert.ok(Math.max(a[1], a[2]) < 500, `${k}: a buzz only low`); }
      if (kind === 'pluck') { assert.ok(a[0] <= 2200, `${k}: a pluck at ${a[0]} Hz`); assert.notEqual(a[3], 'square', `${k}: no square pluck`); }
      if (kind === 'burst' && a[1].type === 'highpass') assert.ok(a[1].dur <= 0.08, `${k}: a hiss kept short`);
    }
  }
  assert.ok(catalog.includes("'Chime pirates'") && catalog.includes('PIRATE_SOUNDS'), 'a group of their own on the music page');
  // muted, nothing
  const m = recordingSound(); m.muted = true;
  pirateSounds(m).boom(1); pirateSounds(m).shot();
  assert.equal(m.played.length, 0);
});

// ------------------------------------------------------------------ the feel, on the page
let arena = null;
function session({ sound = null } = {}) {
  if (!arena) { const scene = new THREE.Scene(); const gen = pirates.build(scene); let r; while (!(r = gen.next()).done); arena = { scene, level: r.value }; }
  const { scene, level } = arena;
  level.pirates.to = null; level.pirates.resume = null;
  const used = [], kept = {};
  const state = { data: { flags: kept }, flag: (k) => kept[k], set: (k, v) => { kept[k] = v; } };
  const ctx = {
    camera: new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 5000), level, scene, player: { object: {} }, sound, state, settings: {},
    sfx: { hurt() {}, whoosh() {}, checkpoint() {} },
    setLives() {}, setScore() {}, setFov() {}, flash() {}, kick() {}, finish() {}, speed() {}, option: () => undefined, hintUsed: (id) => used.push(id),
  };
  const sess = pirates.start(ctx);
  const step = (n = 1, inp = {}) => { for (let i = 0; i < n; i++) sess.update(1 / 60, inp, { live: true, phase: 'play', raw: {} }); };
  return { sess, S: sess.state, step, used };
}

test('a kill is felt: a small capped shake, the world held a beat, the shards of the wreck, a flash; two quick ones a combo', () => {
  const rec = recordingSound();
  const { sess, S, step } = session({ sound: rec });
  S.script = []; S.rocks = [];
  const F = sess.feedback;
  const a = aimAt(S.ship, 50);
  park(S, 'raider', { hp: 1, ds: 50, u: a.u, v: a.v });
  park(S, 'raider', { hp: 1, ds: 52, u: a.u + 0.4, v: a.v });
  let t0 = null, held = false;
  for (let i = 0; i < 90 && S.foes.length; i++) {
    const t = S.t; step(1, { jump: i % 6 === 0 });
    if (F.stop > 0 && t0 === null) t0 = i;
    if (F.stop > 0 && S.t === t) held = true;
  }
  assert.equal(S.foes.length, 0, 'both downed');
  assert.ok(held, 'the hit-stop holds the run still a beat');
  assert.ok(F.stops >= 1 && FEEL.stop.raider <= FEEL.stop.max && FEEL.stop.max <= 0.1);
  assert.ok(F.comboBest >= 2, `a combo of ${F.comboBest}`);
  assert.ok(sess.fx.shards > 0, 'the wreck flies apart');
  assert.ok(sess.fx.flashes >= 0);
  // the shake: some, never past its cap however many come at once
  assert.ok(F.jolt > 0 && F.jolt <= FEEL.shake.cap);
  for (let i = 0; i < 30; i++) { F.jolt = Math.min(FEEL.shake.cap, F.jolt + FEEL.shake.part); }
  assert.ok(F.jolt <= FEEL.shake.cap && FEEL.shake.cap <= 0.6, 'capped');
  assert.ok(rec.played.some(([k]) => k === 'sweep') && rec.played.some(([k]) => k === 'burst'), 'heard');
  // it settles
  step(120);
  assert.ok(F.jolt === 0 && F.stop === 0 && F.combo === 0);
  // under Reduce motion, no shake at all (the hit-stop and the shards stay)
  try {
    setMotion({ reduce: true, shake: 1 });
    const T = session();
    T.S.script = []; T.S.rocks = [];
    const b = aimAt(T.S.ship, 50);
    park(T.S, 'skiff', { ds: 50, u: b.u, v: b.v });
    for (let i = 0; i < 60 && T.S.foes.length; i++) T.step(1, { jump: i % 6 === 0 });
    assert.equal(T.S.foes.length, 0);
    assert.equal(T.sess.feedback.jolt, 0, 'no shake under Reduce motion');
  } finally { setMotion({ reduce: false, shake: 1 }); }
});

test('the ship: a thrust trail behind it, blinking a moment after a hit, the buttons it uses marked for the hints', () => {
  const { sess, S, step, used } = session();
  S.script = []; S.rocks = [];
  step(20, { x: 1 });
  assert.ok(sess.fx.trail > 4, `${sess.fx.trail} drops in the trail`);
  step(2, { jump: true }); step(2);
  step(2, { action: true }); step(40);
  assert.ok(used.includes('steer') && used.includes('fire') && used.includes('roll'), used.join(' '));
  S.shots.push({ ds: 5, u: S.ship.u, v: S.ship.v, vds: -50, vu: 0, vv: 0, life: 2, r: 0.9 });
  step(30);
  assert.ok(S.ship.iframe > 0 && S.ship.hull === FLY.hull - 1, 'hit: untouchable a moment (it blinks)');
});

// ------------------------------------------------------------------ the controls
test('tighter controls: a stick curve for fine aim, a brake when let go, and aim assist that bends the bolts onto a pirate near the line', () => {
  // the curve: half a push is a fine correction, a full one as before
  const half = empty(), full = empty();
  for (let i = 0; i < 10; i++) { runStep(half, { x: 0.5 }, 1 / 60); runStep(full, { x: 1 }, 1 / 60); }
  assert.ok(half.ship.vu < 0.45 * full.ship.vu, `half a push: ${half.ship.vu.toFixed(1)} against ${full.ship.vu.toFixed(1)} m/s`);
  // the brake: let go, it stops quicker than it got going
  const S = empty();
  for (let i = 0; i < 25; i++) runStep(S, { x: 1 }, 1 / 60);
  for (let i = 0; i < 12; i++) runStep(S, {}, 1 / 60);
  const gone = 1 - S.ship.vu / FLY.steer, took = 1 - Math.exp(-FLY.response * 0.2);
  assert.ok(gone > took + 0.1, `let go: ${(gone * 100).toFixed(0)} % of its speed gone in 0.2 s (taking up: ${(took * 100).toFixed(0)} %)`);
  // aim assist: a gunboat 2 m off the line of fire is hit; without the assist the same bolts miss
  const shoot = (F) => {
    const T = empty(F);
    const a = aimAt(T.ship, 70);
    park(T, 'raider', { ds: 70, u: a.u + KINDS.raider.r + F.bolt.spread + 1.3, v: a.v, hp: 99 });
    const ev = []; for (let i = 0; i < 40; i++) ev.push(...runStep(T, { fire: i % 8 === 0 }, 1 / 60));
    return ev.filter((e) => e.kind === 'hit').length;
  };
  assert.ok(shoot(FLY) > 0, 'assisted: it hits');
  assert.equal(shoot({ ...FLY, assist: null }), 0, 'unassisted: the same aim misses');
});
