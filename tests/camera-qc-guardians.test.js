// Issue #359 (the author: "During guardian encounters when locked in I should be able to always see the guardian, myself
// in full body and the floor. Right now with the mother snapper I cut off after the torso"): every temple's guardian in
// its own arena, the traveller locked on to it at points round it, the real rig and the lock camera as main.js turns them
// (scripts/camera-qc/sim-guardians.mjs). Locked on a guardian the rig frames the two boxes (src/lock-frame.js, CameraRig
// .fitFrame): his whole body, his feet and the floor between you are on the screen everywhere, and the guardian's middle
// and foot nearly everywhere (its top too where the room behind allows it); circling it, the camera stays smooth.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GUARDIAN_ARENAS, guardianArena, aroundGuardian, lockedAt, circleGuardian } from '../scripts/camera-qc/sim-guardians.mjs';
import { LOCK_FRAME, framePoints, frameAim, solveFrame } from '../src/lock-frame.js';
import { LIMITS } from '../scripts/camera-qc/lib.mjs';

const pct = (x) => `${(x * 100).toFixed(0)} %`;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

test('the framing\'s solve: a guardian 12 m tall 6 m off, in the open, framed whole with the floor; a wall behind, his feet kept', () => {
  const feet = V(0, 0, 0), box = { min: V(-3, 0, -12), max: V(3, 12, -6) }, U = V(0, 1, 0), back = V(0, 0, 1);
  const tanV = Math.tan((55 / 2) * Math.PI / 180), look = V(0, 1.7 + LOCK_FRAME.lift, 0);
  const pts = framePoints(feet, box);
  assert.equal(pts.length, 16, 'his eight corners, its seven points, the floor between');
  const s = solveFrame(look, back, U, pts, tanV, 16 / 9, 4.8, null);
  assert.ok(s.fill <= 1 - LOCK_FRAME.margin && s.arm <= LOCK_FRAME.arm[1], `fits: ${s.arm} m at ${s.pitch} rad (fill ${s.fill.toFixed(2)})`);
  const cam = look.clone().addScaledVector(back.clone().multiplyScalar(Math.cos(s.pitch)).addScaledVector(U, Math.sin(s.pitch)), s.arm);
  const { dir, fill } = frameAim(cam, pts, back.clone().negate(), U, tanV, 16 / 9);
  assert.ok(fill <= 1 - LOCK_FRAME.margin + 1e-6 && dir.z < 0, 'from there, looking toward it, all of it inside the margin');
  // a wall 3 m behind him at every height: nothing fits; his feet (the lowest) stay in, its top is what is lost
  const t = solveFrame(look, back, U, pts, tanV, 16 / 9, 4.8, LOCK_FRAME.pitches.map(() => 3));
  assert.ok(t.arm <= 3 + 1e-6 && t.fill > 1);
  const cam2 = look.clone().addScaledVector(back.clone().multiplyScalar(Math.cos(t.pitch)).addScaledVector(U, Math.sin(t.pitch)), t.arm);
  const c = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 100); c.position.copy(cam2); c.lookAt(cam2.clone().add(frameAim(cam2, pts, back.clone().negate(), U, tanV, 16 / 9).dir)); c.updateMatrixWorld(true);
  const p = V(0, 0.02, 0).project(c);
  assert.ok(Math.abs(p.x) < 1 && p.y > -1 && p.y < -0.5, `his feet at the frame's foot (${p.y.toFixed(2)})`);
  const top = V(0, 12, -9).project(c);
  assert.ok(top.y > 1, 'its top is what goes');
});

test('every guardian in its arena, locked on from points round it: he whole, his feet, the floor and it on the screen', () => {
  // (before the framing, the same points: his feet off the screen at 0 of 12 round the Mother Snapper's, he and it framed
  // at 0 of 12 round the First Sign's, 0 of 11 round the Lampless's)
  const lines = [];
  for (const [w, id] of GUARDIAN_ARENAS) {
    const G = guardianArena(w, id), at = aroundGuardian(G);
    assert.ok(at.length >= 4, `${id}: ${at.length} points round it`);
    let low = 0, whole = 0, mid = 0;
    for (const p of at) {
      const r = lockedAt(G, p);
      const where = `${id} at ${p.toArray().map((x) => x.toFixed(1)).join(', ')}`;
      assert.equal(r.him, 1, `${where}: he is ${pct(r.him)} on the screen`);
      assert.equal(r.feet, 1, `${where}: his feet off the screen`);
      assert.equal(r.floor, 1, `${where}: the floor between you off the screen`);
      if (r.foeMid === 1) mid++;
      if (r.foeLow === 1) low++;
      if (r.foe === 1) whole++;
    }
    lines.push(`${id} ${low}/${at.length} (whole ${whole})`);
    // (with his back near its wall the room behind is short of what frames a 12-16 m guardian: the lens a little wider
    // there, his feet and the floor kept first, its top what is lost)
    assert.equal(mid, at.length, `${id}: its middle on the screen at ${mid} of ${at.length} points`);
    assert.ok(low / at.length >= 0.9, `${id}: its foot and middle on the screen at ${low} of ${at.length} points`);
  }
  console.log(`  its foot and middle framed: ${lines.join(' · ')}`);
});

test('the Mother Snapper before the framing: his feet off the screen (the issue), after: on it', () => {
  const G = guardianArena('perdide', 'perdide'), at = aroundGuardian(G);
  const before = at.map((p) => lockedAt(G, p, { fit: false })), after = at.map((p) => lockedAt(G, p));
  assert.ok(before.filter((r) => r.feet < 1 || r.him < 1).length >= at.length / 2, 'before: cut off at most points');
  assert.ok(after.every((r) => r.feet === 1 && r.him === 1));
  assert.ok(Math.min(...after.map((r) => r.arm)) > Math.max(...before.map((r) => r.arm)), 'further back than the close-in framing it had');
});

test('circling every guardian locked on: no pops to speak of, smooth, he never off the screen', () => {
  const rough = [];
  for (const [w, id] of GUARDIAN_ARENAS) {
    const G = guardianArena(w, id), c = circleGuardian(G), m = c.measures;
    // (the browser's own walk round the Mother Snapper and the First Sign, the camera QC's snapper-lock and guardian-lock,
    // is green: no pops; here, the Warden's Well's drum walked in node, two)
    assert.ok(m.pops <= 2, `${id}: ${m.pops} pops`);
    assert.ok(m.spins <= 1, `${id}: ${m.spins} spins`);
    assert.ok(m.rms <= 0.04, `${id}: roughness ${(m.rms * 100).toFixed(2)} cm`);
    rough.push(m.rms);
    assert.ok(c.outHim <= 0.03, `${id}: he off the screen ${pct(c.outHim)} of the walk`);
    // (before the framing: the Lampless and the First Sign off the screen all the walk, the Cloud-Mother 97 %; now the
    // Cloud-Mother, 15 m across and 6 m up, is the worst: 10-20 % of the walk, by its arena's wall)
    assert.ok(c.outMid <= 0.25, `${id}: its middle off the screen ${pct(c.outMid)} of the walk`);
    assert.ok(c.outFoe <= 0.3, `${id}: its foot and middle off the screen ${pct(c.outFoe)} of the walk`);
  }
  rough.sort((a, b) => a - b);
  assert.ok(rough[rough.length >> 1] <= LIMITS.rms, `the middle guardian's roughness ${(rough[rough.length >> 1] * 100).toFixed(2)} cm`);
});
