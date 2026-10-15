// Locked on, stepping left and right (src/player.js LOCK_MOVE, strafeSide, strafeStep; docs/systems/animation.md "Locked
// on"): a change of side fades one captured step out before the other comes in, a diagonal keeps its side, and neither
// the starts, stops and pivots nor the chest's lead play under the steps (v1.41: the author's "lock-on strafe animation
// artifacts when moving left and right").
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LOCK_MOVE, strafeSide, strafeStep } from '../src/player.js';
import { traveller, course, CAM_PLUS_Z, loadAssets } from './gait-sim.js';
import { sample } from '../scripts/motion-qc/sample.mjs';
import { jolts } from '../scripts/motion-qc/lib.mjs';

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
  const p = await traveller(scene, new THREE.Vector3(0, 0, -60), { moves: true, body: 'b3' });
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

// (v1.77, issue #360: "when fighting the mother snapper and straffing left and right I get a very choppy animation". Frame
// by frame, the strafes and the walk back carried their whole travel in the pelvis, 1.27-1.36 m a cycle, with their root
// held still: the body slid that far off where the controller had him and jumped back in one frame as the loop wrapped,
// three times a second at the lock's pace (the pelvis 1.22 m in a frame, a joint 66 cm off its path); and their last frame
// was up to 12° off their first at the feet, a foot's 10 cm jolt at every wrap. src/motion-match.js loopInPlace)
test('the captured loops (the lock-on’s steps among them) stay on the spot and close: the pelvis ends where it began, every bone as it began', async () => {
  const { lib } = await loadAssets();
  const loops = lib.motion.clips.filter((c) => c.userData?.loop);
  for (const id of ['left', 'right', 'back']) assert.ok(loops.some((c) => c.name === LOCK_MOVE[id].clip), `${LOCK_MOVE[id].clip} is a loop`);
  for (const c of loops) {
    for (const tr of c.tracks) {
      const n = tr.times.length, v = tr.values;
      if (tr.name === 'pelvis.position') {
        const d = Math.hypot(v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 1] - v[1], v[(n - 1) * 3 + 2] - v[2]);
        assert.ok(d < 1e-3, `${c.name}: the pelvis ends ${(d * 100).toFixed(1)} cm from where it began`);
        // (about its own middle: not set off a stride from the body for the whole of the loop)
        let x = 0, y = 0;
        for (let i = 0; i < n; i++) { x += v[i * 3] / n; y += v[i * 3 + 1] / n; }
        const span = Math.max(...Array.from({ length: n }, (_, i) => Math.hypot(v[i * 3] - x, v[i * 3 + 1] - y)));
        assert.ok(span < 0.3, `${c.name}: the pelvis sways ${(span * 100).toFixed(0)} cm from its middle at most`);
      } else if (tr.name.endsWith('.quaternion')) {
        const a = new THREE.Quaternion().fromArray(v, 0), b = new THREE.Quaternion().fromArray(v, (n - 1) * 4);
        assert.ok(a.angleTo(b) < 0.01, `${c.name} ${tr.name}: its last frame ${(a.angleTo(b) * 180 / Math.PI).toFixed(1)}° off its first`);
      }
    }
  }
});

test('locked on, strafing left and right at the lock’s pace: the body never jumps off the traveller, no joint leaves its path, the facing turns smoothly', async () => {
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, new THREE.Vector3(0, 0, -60), { moves: true, body: 'b3' });
  const foe = new THREE.Vector3(0, 0, -50), st = {}, S = [];
  const plan = [[1, null, 'stand'], [2, [1, 0], 'right'], [2, [-1, 0], 'left'], [2, [1, 0], 'right'], [2, [-1, 0], 'left'], [1, null, 'stand']];
  let t = 0;
  for (const [secs, stick, tag] of plan) for (let i = 0; i < secs * 60; i++) {
    p.lockOn = { dir: new THREE.Vector3(foe.x - p.pos.x, 0, foe.z - p.pos.z).normalize(), at: foe };
    p.update(dt, stick ? { stick: { x: stick[0], y: stick[1] } } : {}, CAM_PLUS_Z); t += dt;
    S.push(sample(p, st, { t, dt, tag, stick }));
  }
  assert.ok(Math.max(...S.map((s) => Math.hypot(s.vel[0], s.vel[2]))) > 3.5, 'at the lock’s pace');
  let pelvis = 0, turn = 0, turnAt = 0;
  for (let i = 1; i < S.length; i++) {
    const a = S[i].joints[0], b = S[i - 1].joints[0];
    pelvis = Math.max(pelvis, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
    const dh = Math.abs(Math.atan2(Math.sin(S[i].heading - S[i - 1].heading), Math.cos(S[i].heading - S[i - 1].heading)));
    if (dh > turn) { turn = dh; turnAt = i; }
  }
  const worst = Math.max(...jolts(S).per);
  if (process.env.SHOW) console.log('pelvis step', pelvis.toFixed(3), 'worst jolt', worst.toFixed(3), 'turn', turn.toFixed(4), turnAt);
  // (before: the pelvis 1.22 m off in a frame at every wrap, a joint 66 cm off its path; now 4.5 and 8 cm, the steps' own)
  assert.ok(pelvis < 0.1, `the pelvis moves ${(pelvis * 100).toFixed(1)} cm against the body in a frame (< 10)`);
  assert.ok(worst < 0.2, `the worst joint ${(worst * 100).toFixed(1)} cm off its path in a frame (< 20)`);
  assert.ok(turn < 0.05, `the facing turns ${turn.toFixed(3)} rad in a frame at most (frame ${turnAt})`);
});
