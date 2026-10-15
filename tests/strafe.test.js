// Locked on, stepping left and right (src/player.js LOCK_MOVE, strafeSide, strafeStep; docs/systems/animation.md "Locked
// on"): a change of side fades one captured step out before the other comes in, a diagonal keeps its side, and neither
// the starts, stops and pivots nor the chest's lead play under the steps (v1.41: the author's "lock-on strafe animation
// artifacts when moving left and right").
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LOCK_MOVE, strafeSide, strafeStep, strafeRate } from '../src/player.js';
import { traveller, course, CAM_PLUS_Z, loadAssets } from './gait-sim.js';
import { sample } from '../scripts/motion-qc/sample.mjs';
import { jolts, pops, steps } from '../scripts/motion-qc/lib.mjs';
import { metaOf } from '../scripts/motion-qc/sample.mjs';

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
  // (the drawn skeleton's bones, as shown: sideways the steps are now the loops' run under a turned body, issue #47, and the
  // animator's own calf there is the run loop's, 0.63 rad in a frame at its push-off as it is running anywhere, which
  // feet.js's soft IK takes out of what is drawn)
  const A = p.animator, H = p.humanoid, foe = new THREE.Vector3(0, 0, -54);
  const bones = ['pelvis', 'spine_02', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'upperarm_l', 'upperarm_r'].filter((b) => H.b[b]);
  let prev = null, worst = 0, worstAt = '', moves = 0;
  for (let i = 0; i < 60 * 6; i++) {
    p.lockOn = { dir: new THREE.Vector3(foe.x - p.pos.x, 0, foe.z - p.pos.z).normalize() };
    const phase = Math.floor(i / 50) % 3;   // left, right, still, …
    p.update(dt, phase === 0 ? { KeyA: true } : phase === 1 ? { KeyD: true } : {}, CAM_PLUS_Z);
    if (p.moves?.cur) moves++;
    const now = bones.map((b) => H.b[b].quaternion.clone());
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

// (issue #47, 2026-10-15: after #360 the strafes still popped the calves, 41 times in this 10 s run. Frame by frame, the pack's
// "strafes" step forward and back, not sideways: with the body facing the foe, the planted foot swept 46 cm along the facing
// while the body went 3.8 m/s across it, so every held foot was dragged sideways off its hold (7.9 cm) and let go at full
// stretch, at 3.7 times the clip's own cadence. Sideways the steps are now the loops' run with the hips and legs turned the
// way he goes and the back turned round again to the foe (LOCK_MOVE.sideRun, Player.sideRunTurn / sideRunTwist).)
async function strafeRun(plan) {
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, new THREE.Vector3(0, 0, -60), { moves: true, body: 'b3' });
  const foe = new THREE.Vector3(0, 0, -50), st = {}, S = [], chest = [];
  let t = 0;
  for (const [secs, stick, tag] of plan) for (let i = 0; i < secs * 60; i++) {
    p.lockOn = { dir: new THREE.Vector3(foe.x - p.pos.x, 0, foe.z - p.pos.z).normalize(), at: foe };
    p.update(dt, stick ? { stick: { x: stick[0], y: stick[1] } } : {}, CAM_PLUS_Z); t += dt;
    S.push(sample(p, st, { t, dt, tag, stick }));
    // the chest's way (spine_03's), flat, against the way to the foe
    const c = p.humanoid.b.spine_03.getWorldPosition(new THREE.Vector3()), l = p.humanoid.b.upperarm_l.getWorldPosition(new THREE.Vector3()), r = p.humanoid.b.upperarm_r.getWorldPosition(new THREE.Vector3());
    const across = l.sub(r).setY(0).normalize(), faces = across.clone().cross(new THREE.Vector3(0, 1, 0)), to = foe.clone().sub(c).setY(0).normalize();
    chest.push({ tag, off: Math.acos(THREE.MathUtils.clamp(faces.dot(to), -1, 1)), yaw: p._strafe?.yaw ?? 0 });
  }
  return { p, S, chest, meta: metaOf(p) };
}

test('locked on, strafing left and right: the hips and legs run the way he goes, the chest stays on the foe, the feet planted (issue #47)', async () => {
  const { S, chest, meta } = await strafeRun([[1, null, 'stand'], [2, [1, 0], 'right'], [2, [-1, 0], 'left'], [2, [1, 0], 'right'], [2, [-1, 0], 'left'], [1, null, 'stand']]);
  const P = pops(S), side = S.filter((s) => s.tag !== 'stand');
  const st = steps(side, meta), slid = st.steps.map((x) => x.slide).sort((a, b) => a - b), held = Math.max(0, ...st.holds.map((h) => h.slide));
  // (before: 41 pops, 46 jolts, a held foot dragged 7.9 cm, the steps sliding 19 cm at the median)
  assert.ok(P.length <= 5, `${P.length} pops in 10 s of strafing (41 before; ${P.map((x) => `${x.bone} ${x.size.toFixed(0)}`).join(', ')})`);
  assert.ok(jolts(S).events.length <= 4, `${jolts(S).events.length} jolts (46 before)`);
  assert.ok(held < 0.02, `a held foot moves ${(held * 100).toFixed(1)} cm over its hold (7.9 before)`);
  assert.ok(slid[Math.floor(slid.length / 2)] < 0.03, `the steps slide ${(slid[Math.floor(slid.length / 2)] * 100).toFixed(1)} cm at the median (19 before)`);
  // running across: the hips turned near a right angle, the chest within 25° of the foe all the while
  const across = chest.filter((c) => c.tag !== 'stand' && Math.abs(c.yaw) > 1.4);
  assert.ok(across.length > 300, `the hips turned the way he runs for most of the strafing (${across.length} frames)`);
  const worst = Math.max(...across.map((c) => c.off));
  assert.ok(worst < 25 * Math.PI / 180, `the chest ${(worst * 180 / Math.PI).toFixed(0)}° off the foe at most while running across`);
  // and standing again, straight
  assert.ok(Math.abs(chest[chest.length - 1].yaw) < 0.01, 'standing, the hips face the foe again');
});

test('the walk back keeps up with the body at the lock\'s pace: at most LOCK_MOVE.rateMax its own cadence, the rest in a longer step', () => {
  // (the walk back's clip is a slow walk, ~1.1 m/s: at the lock's 3.8 m/s it played 3.5 times its own pace)
  assert.deepEqual(strafeRate(1, 1.08), { rate: 1 / 1.08, reach: 1 });
  const r = strafeRate(3.8, 1.08);
  assert.ok(Math.abs(r.rate - LOCK_MOVE.rateMax) < 1e-9 && Math.abs(r.rate * r.reach * 1.08 - 3.8) < 1e-9, `${r.rate.toFixed(2)}x, the step ${r.reach.toFixed(2)}x as long`);
  const fast = strafeRate(20, 1.08);
  assert.equal(fast.reach, LOCK_MOVE.reachMax, 'the step lengthened no more than reachMax');
});

// (todo, issue #47: the walk back is still the pack's slow walk, played at most LOCK_MOVE.rateMax its pace with a longer
// step: at the lock's 3.8 m/s, 9 pops and 10 jolts in 6 s (31 and 37 before), a held foot 1.6 cm (9.0), but its steps
// still slide 16 cm at the median, 61 at the 95th (17 and 48 before): its feet sweep 3.3 m/s at most)
test('locked on, walking back at the lock\'s pace: the feet planted', { todo: 'issue #47: the walk back slides 16 cm at the median, 9 pops in 6 s' }, async () => {
  const { S, meta } = await strafeRun([[1, null, 'stand'], [3, [0, -1], 'back'], [1, null, 'stand'], [3, [0.6, -0.8], 'backdiag'], [1, null, 'stand']]);
  const st = steps(S.filter((s) => s.tag !== 'stand'), meta), slid = st.steps.map((x) => x.slide).sort((a, b) => a - b);
  assert.ok(pops(S).length <= 3, `${pops(S).length} pops`);
  assert.ok(slid[Math.floor(slid.length / 2)] < 0.03, `the steps slide ${(slid[Math.floor(slid.length / 2)] * 100).toFixed(1)} cm at the median`);
});
