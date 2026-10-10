// Locked on, stepping left and right (src/player.js LOCK_MOVE, strafeSide, strafeStep; docs/systems/animation.md "Locked
// on"): a change of side fades one captured step out before the other comes in, a diagonal keeps its side, and neither
// the starts, stops and pivots nor the chest's lead play under the steps (v1.41: the author's "lock-on strafe animation
// artifacts when moving left and right").
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LOCK_MOVE, strafeSide, strafeStep } from '../src/player.js';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';

const dt = 1 / 60;

test('the side wanted: kept through a diagonal near the line, a new side only clearly wanted', () => {
  assert.equal(strafeSide(0, 3), 'right'); assert.equal(strafeSide(0, -3), 'left');
  assert.equal(strafeSide(-2, 0.2), 'back'); assert.equal(strafeSide(3, 0.2), null);
  // a diagonal a little more forward than sideways: a new side is not taken, the one playing is kept
  assert.equal(strafeSide(2.4, 2.0, null), null);
  assert.equal(strafeSide(2.4, 2.0, 'right'), 'right');
  // and noise about the line never flips it frame to frame
  let side = 'right', flips = 0;
  for (let i = 0; i < 200; i++) { const a = Math.PI / 4 + Math.sin(i * 1.7) * 0.15, s = strafeSide(3 * Math.cos(a), 3 * Math.sin(a), side); if (s !== side) flips++; side = s; }
  assert.equal(flips, 0);
});

test('a change of side fades the old step out before the new one comes in: never one swapped for the other at weight', () => {
  const S = { w: 0, t: 0, side: null };
  for (let i = 0; i < 60; i++) strafeStep(S, 'left', dt);
  assert.equal(S.side, 'left'); assert.ok(S.w > 0.95);
  let shown = [], worst = 0, last = S.w;
  for (let i = 0; i < 90; i++) {
    const side = strafeStep(S, 'right', dt);
    if (side === 'right' && !shown.includes('right')) assert.ok(last < 0.05, `the new side began at weight ${last.toFixed(2)}`);
    shown.push(side);
    worst = Math.max(worst, Math.abs(S.w - last)); last = S.w;
  }
  assert.equal(S.side, 'right'); assert.ok(S.w > 0.95, 'and the new step is in');
  assert.ok(shown.includes('left') && shown.includes('right'), 'out, then in');
  assert.ok(worst < 0.3, `no step of weight bigger than ${worst.toFixed(2)} in a frame`);
  for (let i = 0; i < 60; i++) strafeStep(S, null, dt);
  assert.equal(S.side, null); assert.equal(S.w, 0);
  assert.ok(LOCK_MOVE.swap > LOCK_MOVE.in, 'out quicker than in');
});

test('locked on, stepping left and right in turn: no bone jumps in a frame, no start, stop or pivot under the steps', async () => {
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, new THREE.Vector3(0, 0, -60), { moves: true, body: 'v1' });
  const A = p.animator, foe = new THREE.Vector3(0, 0, -54);
  const bones = ['pelvis', 'spine_02', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'upperarm_l', 'upperarm_r'].filter((b) => A.bone(b));
  let prev = null, worst = 0, worstAt = '', moves = 0;
  for (let i = 0; i < 60 * 6; i++) {
    p.lockOn = { dir: new THREE.Vector3(foe.x - p.pos.x, 0, foe.z - p.pos.z).normalize() };
    const phase = Math.floor(i / 50) % 3;   // left, right, still, …
    p.update(dt, phase === 0 ? { KeyA: true } : phase === 1 ? { KeyD: true } : {}, CAM_PLUS_Z);
    if (p.moves?.cur) moves++;
    const now = bones.map((b) => A.bone(b).quaternion.clone());
    if (prev && i > 30) now.forEach((q, k) => { const a = q.angleTo(prev[k]); if (a > worst) { worst = a; worstAt = `${bones[k]} at frame ${i}`; } });
    prev = now;
  }
  assert.ok(bones.length >= 6, `the bones measured (${bones.join(', ')})`);
  assert.equal(moves, 0, 'no start, stop, turn or pivot clip played while locked on');
  if (process.env.SHOW) console.log('worst turn in a frame', worst.toFixed(3), worstAt);
  // (v1.40, before the fix: 1.64 rad, the thighs, as a forward start or a run's pivot cut in at each change of side; now
  // the steps' own fastest frames, ~0.4)
  assert.ok(worst < 0.6, `the largest turn of a bone in a frame ${worst.toFixed(2)} rad (${worstAt})`);
});
