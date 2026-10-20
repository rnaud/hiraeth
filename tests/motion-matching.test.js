import test from 'node:test';
import assert from 'node:assert/strict';
import { MotionMatcher } from '../src/motion-match.js';
import { loadAssets } from './gait-sim.js';

test('a loop tail builds its pose query from the same clip, never the next packed segment', async () => {
  const { lib } = await loadAssets();
  const db = lib.motion.db, mm = new MotionMatcher(db);
  const seg = db.segments.find((s) => s.loop && s.end < db.n);
  mm.cur = seg.end - 0.1;
  mm.sample = () => {};
  mm.jump = () => {};
  mm.update(0, { vel: { x: 0, z: 1 }, want: { x: 0, z: 1 } }, 1, { force: true });
  for (let d = 0; d < 15; d++) assert.ok(Math.abs(mm.query[d] - db.feat[(seg.end - 1) * db.F + d]) < 1e-5);
});


// A fresh match (in from the loops, or the first frame) has no clip's pose to go on. It took the database's
// average for the whole pose, velocities too (1.1 m/s ahead): a body standing still was taken for one on the
// move, matched a jog's stop (leaning back, his face 35° up) and every search after went on from it (the
// Motion page, 2026-10-09). Now the feet and the hips move as the body does.
test('a fresh match moves as the body does: standing, a standing frame; walking, a walking one', async () => {
  const { lib } = await loadAssets();
  const db = lib.motion.db, F = db.F;
  const pick = (vz, want) => {
    const mm = new MotionMatcher(db);
    mm.sample = () => {};
    let to = -1;
    mm.jump = (f) => { to = f; };
    mm.update(0, { vel: { x: 0, z: vz }, want: { x: 0, z: want }, k: 8, face: null }, 1, { force: true });
    return { hip: Math.hypot(db.rawFeat[to * F + 12], db.rawFeat[to * F + 14]), name: db.segments[db.segOf[to]].desc, q: Array.from(mm.query.slice(12, 15)) };
  };
  const still = pick(0, 0), walking = pick(1.4, 1.4);
  assert.ok(still.hip < 0.3, `standing still, a still frame (${still.name}: its hips at ${still.hip.toFixed(2)} m/s)`);
  assert.ok(Math.abs(walking.hip - 1.4) < 0.5, `walking at 1.4 m/s, a frame near that (${walking.name}: ${walking.hip.toFixed(2)} m/s)`);
});

// Matching coming in from the loops starts on the database's copy of the loops (src/motion-match.js gameLoops,
// Animator.gameLoopFrame): the same pose at the same phase, so the hand-in has no seam; and on a game loop the loops'
// phase is kept with it, so a hand-back goes on in step (the motion QC: .claude/skills/motion-qc).
test('matching takes over from the loops on their own copy in the database, in step', async () => {
  const THREE = await import('three');
  const { course, traveller, drive } = await import('./gait-sim.js');
  const p = await traveller(course(), new THREE.Vector3(0, 0, -60), { matching: false, body: 'b3' });
  drive(p, [[1, {}], [1.5, { KeyW: true }]]);
  const A = p.animator, db = A.lib.motion.db, f = A.gameLoopFrame(db), seg = db.segments[db.segOf[f]];
  assert.match(seg.name, /^game:(jog|jog-walk)$/, `jogging at the game's walk: the jog's copy (${seg.name})`);
  assert.ok(Math.abs((f - seg.start) / seg.n - A.phase) < 1.5 / seg.n, 'at the loops\' phase');
  A.matching = true;
  drive(p, [[1 / 60, { KeyW: true }]]);
  assert.match(db.segments[db.segOf[Math.floor(A.mm.cur)]].name, /^game:/, 'and the matcher starts there');
});

// #597: speed warping could stop a moving capture's clock while its pose query
// kept selecting the same frame. Idle weight1 was hidden under matching weight1.
test('repeated short walks settle out of frozen matched strides and start matching again', async () => {
  const { course, traveller, drive } = await import('./gait-sim.js');
  for (const fps of [30, 60, 120]) {
    const p = await traveller(course(), undefined, { matching: true, moves: true });
    for (const duration of [0.2, 0.7, 1.4]) {
      drive(p, [[duration, { KeyW: true }], [2, {}]], { fps });
      const A = p.animator;
      assert.ok(A.mmW < 0.001, `${fps}fps/${duration}s: stopped matching weight ${A.mmW}`);
      assert.ok(A.gaitW < 0.01, `a frozen stride must not keep the feet in gait (${A.gaitW})`);
      // The actual sampled bones, not just the idle label, must be standing.
      const saved = ['thigh_l', 'calf_l', 'thigh_r', 'calf_r', 'upperarm_l', 'upperarm_r'].map(n => [n,A.bone(n).quaternion.clone()]);
      A.matching = false; drive(p, [[1/fps, {}]], { fps });
      for (const [n,q] of saved) assert.ok(q.angleTo(A.bone(n).quaternion) < 0.05, `${n} still overridden after settling`);
      A.matching = true;
      drive(p, [[0.8, { KeyW: true }]], { fps });
      assert.ok(A.mmW > 0.1, 'movement can resume matching after standing');
    }
  }
});

test('matching rest detection respects held movement intent and continuing planar motion', async () => {
  const { course, traveller, drive } = await import('./gait-sim.js');
  const p = await traveller(course(), undefined, { matching: true });
  drive(p, [[0.7, { KeyW: true }]]);
  const A = p.animator;
  for (const [speed, steering, want] of [[0, true, 3], [0, false, 3], [0.6, false, 0]]) {
    for (let i = 0; i < 90; i++) A.match(1/60, { speed, steering, onGround: true, mode: 'ground', mm: {vel:{x:0,z:speed},want:{x:0,z:want},k:8,face:null} }, false, A.legRatio);
    assert.equal(A._mmStill, 0, 'held input against a wall or continuing motion is not settled idle');
  }
});
