// The starts, stops and turns from motion capture over the loops (src/loco-moves.js): which move
// a moment picks, how its clip is played by the body's own motion, and that none of it moves the
// body or the feet: the controller and the planted feet are as they were with the loops alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { course, traveller, drive } from './gait-sim.js';
import { RUNS } from '../src/gait-course.js';
import { LocoMoves, MOVES, moveShape } from '../src/loco-moves.js';

const W = { KeyW: true }, S = { KeyS: true }, R = { KeyW: true, ShiftLeft: true }, SR = { KeyS: true, ShiftLeft: true }, D = { KeyD: true }, A = { KeyA: true }, none = {};

/** Drive a script; each frame, what the moves are doing. */
async function watch(script, o = {}) {
  const p = await traveller(course(), new THREE.Vector3(0, 0, -60), { moves: true, ...o });
  const seen = [];
  const up = p.update.bind(p);
  let t = 0;
  p.update = (dt, input, cam) => { up(dt, input, cam); t += dt; seen.push({ t, s: p.moves?.state(), pos: p.pos.clone(), heading: p.heading, speed: Math.hypot(p.vel.x, p.vel.z) }); };
  const r = drive(p, script);
  return { p, r, seen };
}
const kinds = (seen) => [...new Set(seen.filter((f) => f.s).map((f) => `${f.s.kind}:${f.s.name.replace(/^mixamo_/, '')}`))];

test('each moment its move: a start from standing, a stop on letting go, a turn on the spot by its angle and side, the pivot at a run', async () => {
  const start = await watch([[1, none], [1.5, W], [1.5, none]]);
  assert.deepEqual(kinds(start.seen).map((k) => k.split(':')[0]), ['start', 'stop'], `a start, then a stop (${kinds(start.seen)})`);
  // a quarter turn on the spot each way: the 90° clip, mirrored for the right
  const left = await watch([[1, none], [0.1, A], [1.5, none]]);
  const right = await watch([[1, none], [0.1, D], [1.5, none]]);
  assert.ok(kinds(left.seen).includes('turn:left_turn_90'), `left: the 90° turn (${kinds(left.seen)})`);
  assert.ok(kinds(right.seen).includes('turn:left_turn_90_m'), `right: the 90° turn in a mirror (${kinds(right.seen)})`);
  const back = await watch([[1, none], [0.12, S], [2, none]]);
  assert.ok(kinds(back.seen).includes('turn:left_turn_180') || kinds(back.seen).includes('turn:left_turn_180_m'), `round: the 180° turn (${kinds(back.seen)})`);
  const pivot = await watch([[1, none], [2, R], [1, SR], [1, none]]);
  assert.ok(kinds(pivot.seen).some((k) => k.startsWith('pivot:running_turn_180')), `at a run, back: the pivot (${kinds(pivot.seen)})`);
  assert.ok(kinds(pivot.seen).includes('stop:run_to_stop') || kinds(pivot.seen).includes('stop:run_to_stop_m'), `stopping from a run: the run's stop (${kinds(pivot.seen)})`);
});

test('a start is played by the distance walked, a turn by the angle turned: never stalled, never racing', async () => {
  const { seen } = await watch([[1, none], [1.2, { stick: { x: 0, y: 0.4 } }], [1, none]]);
  const st = seen.filter((f) => f.s?.kind === 'start');
  assert.ok(st.length > 5, 'a slow start plays a while');
  for (let i = 1; i < st.length; i++) {
    const dt = st[i].t - st[i - 1].t, dtClip = st[i].s.t - st[i - 1].s.t;
    assert.ok(dtClip >= dt * MOVES.start.minRate - 1e-6 && dtClip <= dt * MOVES.start.maxRate + 1e-6, `its clock between ${MOVES.start.minRate}x and ${MOVES.start.maxRate}x real time (${(dtClip / dt).toFixed(2)})`);
  }
  // the clip's own walked distance at the frame played, against the body's (in the clip's metres)
  const p = (await traveller(course(), new THREE.Vector3(), { moves: true })).animator;
  const clip = p.moveClip(st[0].s.name), sh = moveShape(clip);
  const i = Math.floor(st.length * 0.6), f = st[i], walked = f.pos.distanceTo(st[0].pos) / p.legRatio;
  const k = Math.min(Math.round(f.s.t * sh.fps), sh.n - 1);
  assert.ok(Math.abs(sh.d[k] - walked) < 0.25, `the clip ${sh.d[k].toFixed(2)} m on, the body ${walked.toFixed(2)} m`);
});

test('the moves never change where you go, how fast you turn, or how the feet are planted', async () => {
  for (const name of ['walk → run → 180° turn → stop', 'turn round on the spot', 'slow walk (half stick), stop']) {
    const run = RUNS[name];
    const a = drive(await traveller(course(), new THREE.Vector3(...run.at), { moves: false }), run.script);
    const b = drive(await traveller(course(), new THREE.Vector3(...run.at), { moves: true }), run.script);
    const last = (r) => r.frames[r.frames.length - 1];
    assert.ok(last(a).pos.distanceTo(last(b).pos) < 1e-6 && Math.abs(last(a).heading - last(b).heading) < 1e-6, `${name}: the same path`);
    assert.ok(b.maxSlide <= a.maxSlide + 0.01 && b.meanSlide <= a.meanSlide + 0.005, `${name}: the feet slide no more (${b.maxSlide.toFixed(3)} / ${b.meanSlide.toFixed(3)} against ${a.maxSlide.toFixed(3)} / ${a.meanSlide.toFixed(3)})`);
    assert.ok(b.maxTurn <= a.maxTurn + 0.05, `${name}: no bone jumps (${b.maxTurn.toFixed(2)} against ${a.maxTurn.toFixed(2)} rad a frame)`);
    assert.ok(b.jitterHead <= a.jitterHead * 1.35 + 0.1, `${name}: the head no jerkier than a third more (${b.jitterHead.toFixed(2)} against ${a.jitterHead.toFixed(2)})`);
  }
});

test('off (the loops alone), and nothing while aiming, riding, climbing or with motion matching on', async () => {
  const off = await watch([[1, none], [1, W], [1, none]], { moves: false });
  assert.equal(kinds(off.seen).length, 0, 'none with the moves off');
  const mm = await watch([[1, none], [1, W], [1, none]], { matching: true });
  assert.equal(kinds(mm.seen).length, 0, 'none under motion matching');
  const L = new LocoMoves(mm.p.animator);
  L.update(1 / 60, { speed: 0, steering: false, heading: 0, ground: false });
  L.update(1 / 60, { speed: 0.5, steering: true, heading: 0, want: 0, ground: false });
  assert.equal(L.busy, false, 'not off the ground (or not free: aiming, riding, climbing)');
});
