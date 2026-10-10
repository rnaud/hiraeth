// The locomotion kit's detail tiers and its stepped clock (kit phase 7: docs/systems/procedural-animation.md, "Phase 7,
// LOD and style"; src/motion-kit/rig.js, src/motion-kit/view.js): out of view nothing is solved or drawn and coming back
// into view is at once; far, the body's springs and the legs' IK take turns (one frame in TIERS.farEvery); the machines'
// stepped clock holds the drawn root, body and legs between its ticks (their feet stay planted), and a strike runs on ones.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Rig, TierHold, jointedLeg, TIERS, LOD } from '../src/motion-kit/rig.js';
import { PLANS, poleFor } from '../src/motion-kit/plans.js';
import { setView, clearView, inView } from '../src/motion-kit/view.js';
import { foeSystem, foeSubject, kitLegs, DT } from '../scripts/motion-audit/walk.mjs';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function hexRig(extra = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); body.position.y = 0.55; g.add(body);
  const mat = new THREE.MeshBasicMaterial(), plan = { ...PLANS.walker, ...extra.plan };
  const legs = [-1, 1].flatMap((s) => [0.3, 0, -0.3].map((z) => ({ x: s * 0.3, z }))).map((h, i) => {
    const foot = { x: h.x * 1.9, z: h.z * 1.3 }, d = Math.hypot(foot.x - h.x, 0.5, foot.z - h.z);
    return jointedLeg({ group: g, body, hip: { x: h.x, y: -0.05, z: h.z }, foot, lenA: d * plan.knee.lenA, lenB: d * plan.knee.lenB, pole: poleFor('out-up', foot), mats: { joint: mat }, name: `leg ${i}` });
  });
  return { g, body, rig: new Rig({ plan, group: g, body, legs, seed: 5, stepped: extra.stepped ?? 0 }) };
}
/** One frame as a model draws it: the root where the mind is, the body on the kit's offsets, the legs last. */
function step(R, f, ctx) {
  const o = R.rig.update(f, DT, { ground: () => 0, ...ctx });
  R.g.position.copy(f.pos); R.g.rotation.set(0, f.heading, 0);
  R.body.position.set(o.x, 0.55 + o.y, o.z); R.body.rotation.set(o.pitch, o.yaw, o.roll);
  R.rig.write(); R.g.updateMatrixWorld(true);
}

test('the view: a camera looking one way sees what is in front of it; unset, everything is in view', () => {
  clearView();
  assert.ok(inView(v(0, 0, -50), 1), 'unset: in view');
  const c = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 500); c.position.set(0, 2, 0); c.lookAt(0, 2, 10);
  setView(c);
  assert.ok(inView(v(0, 0, 20), 1), 'in front');
  assert.ok(!inView(v(0, 0, -20), 1), 'behind');
  assert.ok(inView(v(0, 0, -1.5), 3), 'just behind, but its shadow (padding) reaches into view');
  clearView();
});

test('tiers: out of view is held like any change, but coming back into view is at once', () => {
  const t = new TierHold();
  for (let i = 0; i < TIERS.hold - 1; i++) assert.equal(t.update(10, false), 'near', `held at ${i}`);
  assert.equal(t.update(10, false), 'off');
  assert.equal(t.update(10, true), 'near', 'seen again: at once');
  for (let i = 0; i < TIERS.hold; i++) t.update(80, false);
  assert.equal(t.tier, 'off');
  assert.equal(t.update(80, true), 'far');
});

test('out of view: no IK, no body springs, nothing drawn moves; far: one frame in farEvery, with the time of all of them', () => {
  const R = hexRig(), f = { pos: v(), heading: 0, state: 'chase' };
  let solved = 0;
  const twoBoneWrites = () => { const p = R.rig.legs[0].root.position.clone(); return p; };
  for (let i = 0; i < 60; i++) { f.pos.z += 2 * DT; step(R, f, { eye: v(0, 0, -5), seen: true }); }
  // out of view (after the hold)
  for (let i = 0; i < TIERS.hold + 2; i++) { f.pos.z += 2 * DT; step(R, f, { eye: v(0, 0, -5), seen: false }); }
  assert.equal(R.rig.tier, 'off');
  const before = twoBoneWrites(), body = { ...R.rig.bodyFeet.out };
  for (let i = 0; i < 30; i++) { f.pos.z += 2 * DT; step(R, f, { eye: v(0, 0, -5), seen: false }); }
  assert.ok(twoBoneWrites().equals(before), 'the legs were not solved');
  assert.deepEqual({ ...R.rig.bodyFeet.out }, body, 'the body springs held');
  // seen again: solved that very frame
  f.pos.z += 2 * DT; step(R, f, { eye: v(0, 0, -5), seen: true });
  assert.equal(R.rig.tier, 'near');
  assert.ok(!twoBoneWrites().equals(before), 'solved the frame it is seen');
  // far: the legs solved one frame in farEvery
  const F = hexRig(), g = { pos: v(), heading: 0, state: 'chase' };
  for (let i = 0; i < TIERS.hold + 5; i++) { g.pos.z += 2 * DT; step(F, g, { eye: v(0, 0, -90), seen: true }); }
  assert.equal(F.rig.tier, 'far');
  for (let i = 0; i < 40; i++) {
    g.pos.z += 2 * DT;
    const p = F.rig.legs[0].root.position.clone();
    step(F, g, { eye: v(0, 0, -90), seen: true });
    if (!F.rig.legs[0].root.position.equals(p)) solved++;
  }
  assert.equal(solved, 40 / TIERS.farEvery);
  // and every frame with the far tier's saving switched off
  LOD.far = false; solved = 0;
  for (let i = 0; i < 20; i++) { g.pos.z += 2 * DT; const p = F.rig.legs[0].root.position.clone(); step(F, g, { eye: v(0, 0, -90), seen: true }); if (!F.rig.legs[0].root.position.equals(p)) solved++; }
  LOD.far = true;
  assert.equal(solved, 20);
});

test('the stepped clock: between ticks the drawn root and legs hold, the feet stay planted; a strike runs on ones', () => {
  const R = hexRig({ stepped: 12 }), f = { pos: v(), heading: 0, state: 'chase' };
  let ticks = 0, slid = 0, held = 0;
  const w = v(), prev = R.rig.legs.map(() => null);
  for (let i = 0; i < 240; i++) {
    f.pos.z += 2 * DT;
    const before = R.g.position.clone();
    step(R, f, {});
    if (R.rig.tick) ticks++;
    else { held++; assert.ok(R.g.position.equals(before) || i === 0, 'the root held where it was drawn'); }
    R.rig.legs.forEach((L, k) => {
      L.foot.getWorldPosition(w);
      const planted = R.rig.planner.feet[k].planted && R.rig.tick;
      if (i > 60 && planted && prev[k]?.planted) slid += Math.hypot(w.x - prev[k].p.x, w.z - prev[k].p.z);
      if (R.rig.tick) prev[k] = { p: w.clone(), planted: R.rig.planner.feet[k].planted };
    });
  }
  assert.ok(ticks >= 46 && ticks <= 50, `12 fps over 4 s: ${ticks}`);
  assert.ok(held > 180, 'most frames hold');
  assert.ok(slid / 6 < 0.05, `the drawn feet stay planted from tick to tick (${(slid / 6).toFixed(3)} m a leg)`);
  // a strike: every frame
  let strikeTicks = 0;
  for (let i = 0; i < 30; i++) { f.state = 'strike'; f.pos.z += 2 * DT; step(R, f, {}); if (R.rig.tick) strikeTicks++; }
  assert.equal(strikeTicks, 30);
});

test('the machines are drawn on twos and still walk on planted feet (the lamp tripod, the bell walker, the furnace brute)', () => {
  assert.equal(PLANS.machine.stepped, 12); assert.equal(PLANS.siege.stepped, 12); assert.equal(PLANS.brute.stepped, 12);
  const sys = foeSystem();
  for (const id of ['tripod', 'bell', 'brute']) {
    const r = foeSubject(sys, id, kitLegs);
    assert.ok(r.slidePerMetre < 0.05, `${id}: slide ${r.slidePerMetre.toFixed(3)} m/m`);
    assert.ok(r.liftShare >= 0.06, `${id}: lift`);
  }
  sys.dispose();
});
