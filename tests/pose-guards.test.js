// Issue #551 (the traveller once stood leaning far back, a hand on his hip, looking at the ceiling, after a walk in the
// ship's hold; no run reproduced it): the guards on the two layers that can hold such a pose, and the pose report.
//  - a conversation's gestures (src/talk-gesture.js): torn down mid-gesture, however (no talk driven any more), or the body
//    moving on its own (the stick pushed), every layer is gone within GESTURE.cut;
//  - the air's pose (src/animator.js AIR_GUARD, src/air-moves.js AIR.stuck): standing with it left in the blend, he is
//    back on his feet within a few frames, a stopped clock too; a real landing eases out as it always did;
//  - the pose report (src/pose-report.js, F8) says which layers pose him.
import test from 'node:test';
import assert from 'node:assert/strict';
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };
const { GESTURE, TalkGesture, talkGestures } = await import('../src/talk-gesture.js');
const { Animator, AIR_GUARD } = await import('../src/animator.js');
const { AirMoves, AIR } = await import('../src/air-moves.js');
const { buildCharacter } = await import('../src/player.js');
const { loadAssets } = await import('./gait-sim.js');
const { poseReport, POSE_REPORT_KEY } = await import('../src/pose-report.js');
const { RESERVED_KEYS } = await import('../src/remap.js').catch(() => ({}));

const dt = 1 / 60;
const S = (o = {}) => ({ speed: 0, onGround: true, mode: 'ground', walkAt: 1, jogAt: 2, sprintAt: 3, strideScale: 1, ...o });
const COCKY = { speaking: true, key: 'n1:0', tone: 'playful', text: 'Scenic route, then.' };
/** An Animator whose gestures pick the same clips every run (A._gestureSeed: talkGestures.drive's), Excited's 0.8 allowed for. */
const animator = (lib) => Object.assign(new Animator(lib, buildCharacter()), { _gestureSeed: 551 });
const FULL = 0.75;

test('a conversation torn down mid-gesture leaves no gesture weight within GESTURE.cut', async () => {
  assert.ok(GESTURE.cut <= 0.3 && GESTURE.cut < GESTURE.out, 'the talk gone: quicker than a crossfade');
  const { lib } = await loadAssets();
  const A = animator(lib);
  for (let i = 0; i < 60; i++) { talkGestures.drive(A, COCKY); A.update(dt, S()); }
  assert.ok(A.talkW > FULL, `standing in the talk: a gesture at full weight (${A.talkW})`);
  // torn down: nothing drives it any more (closed, skipped, a scene, a load, a teleport, the debug menu: no drive() call)
  const frames = Math.ceil(GESTURE.cut / dt) + 1;
  for (let i = 0; i < frames; i++) A.update(dt, S());
  assert.equal(A.talkW, 0, 'no gesture weight left');
  assert.equal(A.talkGesture, null, 'and the layer is dropped');
  // the same with drive(null) (the story's conversation closed)
  for (let i = 0; i < 60; i++) { talkGestures.drive(A, { ...COCKY, key: 'n2:0' }); A.update(dt, S()); }
  for (let i = 0; i < frames; i++) { talkGestures.drive(A, null); A.update(dt, S()); }
  assert.equal(A.talkW, 0);
});

test('the stick pushed, the gesture lets go at once, standing or not', async () => {
  const { lib } = await loadAssets();
  const A = animator(lib);
  for (let i = 0; i < 60; i++) { talkGestures.drive(A, COCKY); A.update(dt, S()); }
  assert.ok(A.talkW > FULL, `a gesture at full weight (${A.talkW})`);
  // (a talk still driven, the speed still under a walk's: the stick alone lets it go)
  for (let i = 0; i < Math.ceil(GESTURE.cut / dt) + 1; i++) { talkGestures.drive(A, COCKY); A.update(dt, S({ steering: true })); }
  assert.equal(A.talkW, 0);
});

test('the layer alone: a cut talk fades in GESTURE.cut, a said line still in GESTURE.out', () => {
  const A = { moveClip: (n) => ({ name: n, duration: 3, userData: {} }) };
  const G = new TalkGesture(5);
  for (let t = 0; t < 1; t += dt) G.update(dt, { speaking: true, tone: 'playful', key: 'k', text: '' }, A);
  let out = [];
  for (let t = 0; t < GESTURE.cut + dt; t += dt) out = G.update(dt, null, A);
  assert.equal(out.length, 0);
  assert.ok(G.idle);
});

test('standing with the air pose left in the blend: back on his feet within a few frames, a stopped clock too', async () => {
  const { lib } = await loadAssets();
  const A = new Animator(lib, buildCharacter());
  for (let i = 0; i < 60; i++) A.update(dt, S({ onGround: false }));
  assert.ok(A.w.air > 0.9, `in the air: the air loop (${A.w.air})`);
  // the ground under him, the clock stopped (dt 0: a hit-stop, a frozen frame): the blend would never move
  const N = Math.ceil(AIR_GUARD.secs / AIR_GUARD.frame) + 2;
  for (let i = 0; i < N; i++) A.update(0, S());
  assert.ok(A.w.air + A.w.jumpStart < 0.01, `the air pose gone within ${N} frames (${A.w.air})`);
  assert.ok(A.w.idle > 0.99, 'standing');
  // a real landing at any rate eases out as before: the guard never cuts it
  for (const hz of [30, 60, 144, 240]) {
    const B = new Animator(lib, buildCharacter());
    for (let i = 0; i < hz; i++) B.update(1 / hz, S({ onGround: false }));
    for (let i = 0; i < hz; i++) B.update(1 / hz, S());
    assert.equal(B.airGuarded ?? 0, 0, `${hz} Hz: a landing eased out by itself`);
  }
});

test('an air move held on the ground is dropped after AIR.stuck; a real one plays out', () => {
  const air = (frames, step, ground) => {
    const M = new AirMoves();
    for (let i = 0; i < 30; i++) M.update(dt, { onGround: false, airT: 0.3 + i * dt, tLand: 0.2, speed: 0 });
    assert.equal(M.state()?.kind, 'drop', 'a drop before the ground');
    let gone = -1;
    for (let i = 0; i < frames; i++) { M.update(step, { onGround: ground, airT: 0, tLand: Infinity, speed: 0 }); if (gone < 0 && !M.cur) gone = i; }
    return gone;
  };
  // the clock stopped on the ground: the drop would hold its last frame for ever
  const N = Math.ceil(AIR.stuck / AIR.frame) + 2;
  assert.ok(air(N, 0, true) >= 0, 'dropped');
  // landed at 60 Hz: it plays out (0.6 s) and blends out, well before the guard
  const t = air(120, dt, true);
  assert.ok(t > 0.5 / dt && t * dt < AIR.stuck, `played out in ${(t * dt).toFixed(2)} s`);
});

test('the pose report names the layers that pose him, on a key nothing else takes', () => {
  assert.equal(POSE_REPORT_KEY, 'F8');
  if (RESERVED_KEYS) assert.ok(RESERVED_KEYS.test(POSE_REPORT_KEY), 'an F key: no verb can be moved onto it');
  const P = {
    pos: { x: 1, y: 2, z: 3 }, vel: { x: 0, y: 0, z: 0 }, heading: 0.5, onGround: true,
    animator: { w: { idle: 1, air: 0.3 }, idleT: 4, move: { clip: { name: 'mixamo_stop_walking' }, t: 1.2, legs: false }, moveW: 0.5, talkW: 0.8,
      talkGesture: { layers: [{ id: 'being_cocky', w: 0.8, out: true, cut: true }] } },
    airMoves: { state: () => ({ kind: 'drop', t: 1.2, w: 1 }) }, edge: { k: 0 }, aim: null,
  };
  const text = poseReport(P, { ship: { inside: true }, dialogue: { open: false } }).join('\n');
  for (const s of ['ground true', 'ship inside true', 'idle 1.00', 'air 0.30', 'mixamo_stop_walking', 'being_cocky w 0.80 out cut', 'air move drop', 'edge lean 0.00']) assert.ok(text.includes(s), `${s} in:\n${text}`);
  assert.deepEqual(poseReport(null), ['pose report: no traveller']);
});
