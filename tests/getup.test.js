// Getting up after a knockdown with Mixamo's captured get-ups (src/ragdoll.js GET_UP, moves.glb):
// from the back or from the stomach as the body landed, placed so the clip's first frame lies where
// the ragdoll lies, and back on his feet in about the time the kneel took.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { course, traveller } from './gait-sim.js';
import { Ragdoll, J, lyingOn, GET_UP } from '../src/ragdoll.js';

const Y = new THREE.Vector3(0, 1, 0);

test('which get-up: face up from the back, face down from the stomach', () => {
  const r = new Ragdoll();
  const put = (pelvis, chest, hipL, hipR) => { r.x[J.pelvis].set(...pelvis); r.x[J.chest].set(...chest); r.x[J.hipL].set(...hipL); r.x[J.hipR].set(...hipR); };
  // lying along +z, head that way; on the back the left hip is at -x (seen from above, face up)
  put([0, 0.15, 0], [0, 0.15, 0.4], [-0.1, 0.15, 0], [0.1, 0.15, 0]);
  assert.equal(lyingOn(r, Y), 'back');
  put([0, 0.15, 0], [0, 0.15, 0.4], [0.1, 0.15, 0], [-0.1, 0.15, 0]);
  assert.equal(lyingOn(r, Y), 'stomach');
});

/** Knock the traveller over moving `vel` (world), then step until he stands: what he got up with, and how. */
async function knock(vel) {
  const p = await traveller(course(), new THREE.Vector3(0, 0, -60), { moves: true });
  for (let i = 0; i < 30; i++) p.update(1 / 60, {}, Math.PI);
  p.knockDown(vel);
  const out = { getUp: null, gap: null, riseT: 0, upT: null };
  let t = 0;
  for (; t < 12 && p.down; t += 1 / 60) {
    const before = p.down.phase;
    p.update(1 / 60, {}, Math.PI);
    if (p.down?.phase === 'rise') {
      if (before !== 'rise') {
        // the first frame of the rise: the drawn pelvis (blended from the ragdoll's) against the clip's alone
        out.getUp = p.down.getUp?.how ?? 'kneel';
        out.start = t;
      }
      out.riseT += 1 / 60;
      if (out.riseT > 0.35 && out.gap === null) {
        // past the blend: the body is the clip's; its pelvis still close to where the ragdoll lay
        out.gap = p.humanoid.b.pelvis.getWorldPosition(new THREE.Vector3()).setY(0).distanceTo(p.down.rag.x[J.pelvis].clone().setY(0));
      }
    }
  }
  out.up = !p.down;
  for (let i = 0; i < 40; i++) p.update(1 / 60, {}, Math.PI);   // (the clip eases out into the stand)
  out.pelvisY = p.humanoid.b.pelvis.getWorldPosition(new THREE.Vector3()).y;
  return out;
}

test('knocked down: up with the get-up for how he landed, from where he lies, standing in about two seconds', async () => {
  // (the heading is 0, facing +z: knocked forward he falls on his face, knocked back onto his back)
  const fwd = await knock(new THREE.Vector3(0, -2, 9));
  const back = await knock(new THREE.Vector3(0, -2, -9));
  assert.equal(fwd.getUp, 'stomach', 'falling forward: up from the stomach');
  assert.equal(back.getUp, 'back', 'falling back: up from the back');
  for (const [k, r] of [['forward', fwd], ['back', back]]) {
    assert.ok(r.up, `${k}: back on his feet`);
    const most = (GET_UP[r.getUp].to - GET_UP[r.getUp].from) / GET_UP.rate;
    assert.ok(r.riseT <= most + 0.05, `${k}: the rise ${r.riseT.toFixed(2)} s (at most ${most.toFixed(2)})`);
    assert.ok(r.gap < 0.45, `${k}: the clip's body lies where the ragdoll lay (the pelvis ${r.gap.toFixed(2)} m off)`);
    assert.ok(r.pelvisY > 0.8, `${k}: standing a moment later (pelvis ${r.pelvisY.toFixed(2)} m up)`);
  }
});
