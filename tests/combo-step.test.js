// The combo's step-in (issue #780, the author: "The triple attack combo still feels bad. Check how botw handles it, I think
// every move should move you toward" the foe). Each of the three cuts carries the traveller toward its target (the locked
// foe, else the nearest in the stick's cone, else on along the stick), closes the gap to striking distance and stops
// there, never steps off a ledge, and the stick re-aims each cut (src/fluid-blade.js COMBO_STEP; scripts/combo-step.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { COMBO_STEP, MAGNET, stepLength, stepProfile, profileAt, stepTo, stepTarget } from '../src/fluid-blade.js';
import { reachRig } from '../scripts/combat-reach.mjs';
import { comboAt } from '../scripts/combo-step.mjs';
import { clearTargets } from '../src/targets.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), UP = v(0, 1, 0);

test('each cut closes the gap to striking distance and no further; none at all with no foe is a short step on', () => {
  assert.ok(COMBO_STEP.ideal > 0.5 && COMBO_STEP.ideal <= MAGNET.ideal, 'stands under the blade, no further off than the pull stood him');
  for (const n of [0, 1, 2]) {
    assert.equal(stepLength(n, 0.4), 0, `cut ${n + 1}: in reach, no step into it`);
    assert.ok(Math.abs(stepLength(n, COMBO_STEP.ideal + 0.3) - 0.3) < 1e-9, `cut ${n + 1}: 0.3 m out, 0.3 m in`);
    assert.equal(stepLength(n, 9), COMBO_STEP.max[n], `cut ${n + 1}: a far foe, at most max`);
    assert.equal(stepLength(n, null), COMBO_STEP.free[n], `cut ${n + 1}: no foe, a step on`);
    assert.ok(COMBO_STEP.free[n] > 0.25 && COMBO_STEP.free[n] <= 0.6, 'a step, not a lunge');
  }
});

test('the step is eased in and out and goes most while a foot is up', () => {
  const W = stepProfile(0.3, (e) => (e > 0.1 && e < 0.2 ? 1 : 0));
  assert.equal(W[0], 0); assert.ok(Math.abs(W[W.length - 1] - 1) < 1e-6);
  for (let i = 1; i < W.length; i++) assert.ok(W[i] >= W[i - 1], 'never back');
  assert.ok(profileAt(W, 0.05) < 0.01 && profileAt(W, 0.95) > 0.99, 'starts and ends slow');
  assert.ok(profileAt(W, 2 / 3) - profileAt(W, 1 / 3) > 0.6, 'most of it while the foot is up');
  const plain = stepProfile(0.3);
  assert.ok(Math.abs(profileAt(plain, 0.5) - 0.5) < 0.02, 'without the clip: symmetric');
});

test('a step stops short of a ledge, goes on over flat ground, and up a low step', () => {
  // ground at 0 for z < 1, then a drop of 3 m (a ledge 1 m ahead)
  const ledge = { heightAbove: (p) => (p.z < 1 ? p.y : p.y + 3) };
  const got = stepTo(ledge, v(0, 0, 0), v(0, 0, 1), 1.5, UP);
  assert.ok(got <= 1 - COMBO_STEP.ahead + 0.26 && got < 1, `stops ${got.toFixed(2)} m on, short of the edge 1 m ahead`);
  assert.equal(stepTo({ heightAbove: (p) => p.y }, v(), v(0, 0, 1), 1.2, UP), 1.2, 'flat: all of it');
  assert.equal(stepTo({ heightAbove: (p) => (p.z < 0.5 ? p.y : p.y - 0.2) }, v(), v(0, 0, 1), 1.2, UP), 1.2, 'a rise: all of it');
  assert.equal(stepTo({ heightAbove: () => Infinity }, v(), v(0, 0, 1), 0.5, UP), 0, 'nothing under him: none');
  assert.equal(stepTo(null, v(), v(0, 0, 1), 0.5, UP), 0.5, 'no ground test: as asked');
});

test('the target: the lock first, else the nearest in the stick\'s cone, else none with the stick pushed (nearest anywhere without)', () => {
  const T = (x, z) => ({ lock: true, enabled: () => true, position: () => v(x, 0, z) });
  const ahead = T(0, 3), right = T(2, 0), behind = T(0, -1.5);
  const all = [ahead, right, behind];
  assert.equal(stepTarget(v(), v(0, 0, 1), { targets: all, locked: right }), right, 'locked on: that one');
  assert.equal(stepTarget(v(), v(0, 0, 1), { targets: all, stick: true }), ahead, 'pushed ahead: the one ahead, not the nearer one behind');
  assert.equal(stepTarget(v(), v(1, 0, 0), { targets: all, stick: true }), right, 're-aimed right: the one on the right');
  assert.equal(stepTarget(v(), v(-1, 0, 0), { targets: all, stick: true }), null, 'pushed where none is: none, a step along the stick');
  assert.equal(stepTarget(v(), v(-1, 0, 0), { targets: all, stick: false }), behind, 'the stick let go: the nearest anywhere (the soft lock)');
  assert.equal(stepTarget(v(), v(0, 0, 1), { targets: [T(0, 9)], stick: true }), null, 'out of BLADE.lock: none');
});

test('in the game: every cut carries him in to a foe out of reach, stops at striking distance, never into it; all three land', async () => {
  const rig = await reachRig();
  try {
    for (const locked of [false, true]) {
      const far = await comboAt(rig, 'grunt', { gap: 2.5, locked });
      assert.ok(far.steps[0] > 1.2, `${locked ? 'locked' : 'free'}: the first cut closes ${far.steps[0].toFixed(2)} m of 2.5`);
      assert.ok(far.steps[1] > 0.2, `the second goes on in (${far.steps[1].toFixed(2)} m)`);
      assert.equal(far.hits, '111', 'all three land');
      assert.ok(far.closest > COMBO_STEP.ideal - 0.2, `never closer than striking distance (${far.closest.toFixed(2)} m off its body)`);
      assert.ok(Math.abs(far.end - COMBO_STEP.ideal) < 0.1, `ends at striking distance (${far.end.toFixed(2)} m)`);
      const close = await comboAt(rig, 'grunt', { gap: 0.3, locked });
      assert.ok(close.closest > 0.25, `in reach already: not a step into it (${close.closest.toFixed(2)} m)`);
      assert.ok(close.steps.every((s) => Math.abs(s) < 0.05), `in reach already: no steps (${close.steps.map((s) => s.toFixed(2)).join(' / ')})`);
      assert.equal(close.hits, '111');
    }
  } finally { rig.tool.dispose(); clearTargets(); }
});

test('in the game: with nothing near, each cut is a step on, the way the stick points as it starts; never off a ledge', async () => {
  const rig = await reachRig();
  try {
    const on = await comboAt(rig, null);
    on.steps.forEach((s, n) => assert.ok(Math.abs(s - COMBO_STEP.free[n]) < 0.05, `cut ${n + 1}: ${s.toFixed(2)} m on (${COMBO_STEP.free[n]})`));
    // the stick held to a side (the camera's right): each cut goes that way (re-aimed), not the way he faced
    const right = await comboAt(rig, null, { stick: { x: 1, y: 0 } });
    const P = right.path, x = P[P.length - 1].x - rig.home.x, z = P[P.length - 1].z - rig.home.z;
    assert.ok(Math.abs(x) > 1.2 && Math.abs(x) > 3 * Math.abs(z), `went the stick's way: ${x.toFixed(2)} m across, ${z.toFixed(2)} m on`);
    // a ledge 0.6 m ahead: he stops short of it, cut after cut
    const phys = rig.p.physics, was = phys.heightAbove;
    const edge = rig.home.z + 0.6;
    phys.heightAbove = function (p, U, s) { return p.z > edge ? Infinity : was.call(this, p, U, s); };
    try {
      const at = await comboAt(rig, null);
      const far = Math.max(...at.path.map((q) => q.z - rig.home.z));
      assert.ok(far < 0.6 - 0.1, `stopped ${far.toFixed(2)} m on, short of the edge 0.6 m ahead`);
    } finally { phys.heightAbove = was; }
  } finally { rig.tool.dispose(); clearTargets(); }
});
