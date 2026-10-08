import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { circumcentre, gripLine, fistGrip, bracerMount } from '../src/blade-grip.js';
import { ShieldState, SHIELD, shieldArc } from '../src/shield.js';
import { SWINGS, WHIRL, GUARD, STANCE, attackSample, bladeDrawn, inGuard } from '../src/fluid-blade.js';
import { FluidTool } from '../src/fluid-tool.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { playerHands } from '../src/hands.js';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), dt = 1 / 60;

test('the grip line: a circle through three joints, four fingers make a line out on the index side', () => {
  const c = circumcentre(v(1, 0, 0), v(0, 1, 0), v(-1, 0, 0));
  assert.ok(c.length() < 1e-9, 'the unit circle round the origin');
  assert.equal(circumcentre(v(0, 0, 0), v(1, 0, 0), v(2, 0, 0)), null, 'three in a line make no circle');
  // four fingers curled round a grip along +z (radius 2 cm), the index at z = +0.03
  const joints = {};
  ['index', 'middle', 'ring', 'pinky'].forEach((f, i) => {
    const z = 0.03 - i * 0.02;
    joints[f] = [0, 1.6, 3].map((a) => v(0.02 * Math.cos(a), 0.05 + 0.02 * Math.sin(a), z));
  });
  const L = gripLine(joints);
  assert.ok(L.axis.distanceTo(v(0, 0, 1)) < 1e-6, 'along the grip, toward the index');
  assert.ok(L.centre.distanceTo(v(0, 0.05, 0)) < 1e-6 && L.radii.every((r) => Math.abs(r - 0.02) < 1e-6));
});

test('the shield opens in under a fifth of a second, holds, folds; a blow flares, a parry flashes, an empty tank cracks it', () => {
  const S = new ShieldState();
  assert.equal(S.update(dt, false), null); assert.equal(S.state, 'folded');
  assert.equal(S.update(dt, true), 'open', 'it says when it starts to open (the sound)');
  let t = dt;
  while (S.state !== 'open' && t < 1) { assert.equal(S.update(dt, true), null, 'once'); t += dt; }
  assert.ok(t >= SHIELD.open - 1e-9 && t <= 0.2 + dt, `open in ${t.toFixed(3)} s`);
  assert.ok(S.k === 1 && S.fill === 1 && S.rib(SHIELD.ribs - 1) === 1, 'all its ribs out, the fluid to the rim');
  S.hit('block'); assert.equal(S.flare, 1);
  S.hit('perfect'); assert.equal(S.flash, 1);
  for (let i = 0; i < 30; i++) S.update(dt, true);
  assert.ok(S.flash < 1 && S.flare === 0);
  S.hit('broken'); assert.equal(S.state, 'broken');
  const seen = Array.from({ length: 60 }, (_, i) => S.shown(i * 0.011));
  assert.ok(seen.includes(false) && seen.includes(true), 'cracked, it flickers');
  for (let i = 0; i < 60; i++) S.update(dt, true);
  assert.equal(S.state, 'open', 'held, it mends');
  assert.equal(S.update(dt, false), 'close');
  for (let i = 0; i < 20; i++) S.update(dt, false);
  assert.equal(S.state, 'folded'); assert.equal(S.k, 0);
  // the ribs come out one after another; the fluid floods after the ribs and drains before them
  S.k = 0.4; assert.ok(S.rib(0) > S.rib(SHIELD.ribs - 1)); assert.ok(S.fill < S.rib(0));
  const F = new ShieldState(); F.hit('broken'); assert.equal(F.state, 'folded', 'a folded shield takes no blow');
});

test("the guard's arc is the shield as drawn: a disc ahead covers its edges plus the slack, a disc to one side turns the arc", () => {
  const up = v(0, 1, 0), d = GUARD.reach, R = SHIELD.radius;
  const ahead = shieldArc(v(), v(0, 0, d), v(0, 0, 1), R, up);
  assert.ok(ahead.dir.distanceTo(v(0, 0, 1)) < 1e-9);
  assert.ok(Math.abs(ahead.half - Math.atan2(R + SHIELD.slack, d)) < 1e-9);
  assert.ok(Math.abs(GUARD.angle - ahead.half) < 1e-9, 'with no shield drawn, the arc of one held ahead');
  const left = shieldArc(v(), v(0.2, 0, d), v(0, 0, 1), R, up);
  assert.ok(left.dir.x > 0.05, 'held to the left, it covers more of the left');
  assert.ok(inGuard(v(), left.dir, v(-0.6, 0, 1.2), left.half), 'still the front right');
  assert.ok(!inGuard(v(), left.dir, v(0, 0, -1), left.half), 'never behind');
});

test('the blade is in the fist in a fight and a while after, put away out of it', () => {
  assert.ok(bladeDrawn({ swinging: true }) && bladeDrawn({ guarding: true }) && bladeDrawn({ evading: true }) && bladeDrawn({ locked: true }));
  assert.ok(bladeDrawn({ since: STANCE.linger - 0.1 }) && !bladeDrawn({ since: STANCE.linger + 0.1 }));
  assert.ok(!bladeDrawn({ ok: false, swinging: true }), 'climbing, swimming, a scene: away');
});

async function armed(body) {
  items.grant('backpack');
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, v(0, 0, -60), { moves: true, body });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, -65); camera.lookAt(0, 1, -55); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const tick = (input = {}, move = null) => {
    if (move) p.swingMove = move;
    p.update(dt, input, CAM_PLUS_Z); tool.update(dt, input);
    p.humanoid.hands.update(dt, playerHands(p));   // (main.js: the fingers after everything)
  };
  return { p, tool, tick, scene };
}

for (const body of ['v1', 'plain']) {
  test(`${body} traveller: the hilt sits in the fist and the bracer on the left hand on every frame of every combat clip`, async () => {
    const { p, tool, tick } = await armed(body);
    const H = p.humanoid, B = H.b, blade = tool.blade, grip = fistGrip(H), mount = bracerMount(H);
    tick({ KeyZ: true });   // (the guard draws the blade)
    for (let i = 0; i < 6; i++) tick({});
    assert.equal(blade.group.parent, B.hand_r, 'carried by the right hand bone');
    assert.equal(blade.device.root.parent, B.hand_l, 'the bracer by the left');
    assert.ok(blade.group.visible, 'drawn');
    // the fingers of a fist wrap round the grip: each finger's middle joint a finger's thickness from its line
    H.hands.set('fist');
    const inv = B.hand_r.matrixWorld.clone().invert(), line = new THREE.Line3(grip.position.clone().addScaledVector(grip.axis, -0.1), grip.position.clone().addScaledVector(grip.axis, 0.1));
    for (const f of ['index', 'middle', 'ring', 'pinky']) {
      const j = B[`${f}_02_r`].getWorldPosition(v()).applyMatrix4(inv), d = line.closestPointToPoint(j, true, v()).distanceTo(j);
      assert.ok(d > 0.008 && d < 0.045, `${f} round the grip (${d.toFixed(3)} m)`);
    }
    const clips = [...SWINGS, WHIRL, { clip: GUARD.idle, from: 0, to: 1.2, wind: 0.4, active: 0.4, recover: 0.4 }, { clip: GUARD.parry, from: 0, to: 0.55, wind: 0.2, active: 0.15, recover: 0.2 },
      { clip: 'mixamo_ss_strafe_1', from: 0, to: 1, wind: 0.3, active: 0.4, recover: 0.3 }, { clip: 'mixamo_ss_impact_1', from: 0, to: 0.6, wind: 0.2, active: 0.2, recover: 0.2 }];
    for (const S of clips) {
      const d = attackSample(S, 0).duration;
      let lead = 0, n = 0, prevTip = null;
      for (let t = 0; t < d; t += dt) {
        const s = attackSample(S, t);
        tick({ KeyZ: true }, { clip: S.clip, t: s.t, w: 1, full: true, id: 'test' });
        blade.since = 0;
        const g = blade.group, hand = B.hand_r;
        g.updateWorldMatrix(true, false);
        // the hilt's grip at the hand's grip point, on this frame's pose (no lag): within a millimetre
        const want = grip.position.clone().applyMatrix4(hand.matrixWorld), at = v().setFromMatrixPosition(g.matrixWorld);
        assert.ok(at.distanceTo(want) < 1e-3, `${S.clip} t ${s.t.toFixed(2)}: grip ${at.distanceTo(want).toFixed(4)} m from the fist`);
        const axis = v(0, 1, 0).transformDirection(g.matrixWorld), wantAxis = grip.axis.clone().transformDirection(hand.matrixWorld);
        assert.ok(axis.dot(wantAxis) > 0.9999, `${S.clip}: the blade along the fist's grip`);
        const b = blade.device.root; b.updateWorldMatrix(true, false);
        assert.ok(v().setFromMatrixPosition(b.matrixWorld).distanceTo(mount.position.clone().applyMatrix4(B.hand_l.matrixWorld)) < 1e-3, `${S.clip}: the bracer on the hand`);
        // the swings cut edge first: the tip's motion across the blade along its edge
        if (SWINGS.includes(S) && s.phase === 'strike') {
          const tip = at.clone().addScaledVector(axis, 0.9);
          if (prevTip) { const m = tip.clone().sub(prevTip); m.addScaledVector(axis, -m.dot(axis)); if (m.length() > 1e-3) { lead += Math.abs(m.normalize().dot(v(1, 0, 0).transformDirection(g.matrixWorld))); n++; } }
          prevTip = tip;
        }
      }
      if (n) assert.ok(lead / n > 0.85, `${S.clip} cuts with its edge (${(lead / n).toFixed(2)})`);
    }
    tool.dispose();
  });
}

test('put away climbing, swimming, in a scene and knocked down; the bracer stays folded on the hand; the guard opens the shield', async () => {
  const { p, tool, tick } = await armed('v1');
  const blade = tool.blade;
  for (let i = 0; i < 20; i++) tick({ KeyZ: true });
  assert.ok(blade.device.s.k === 1 && blade.device.face.visible, 'held, the shield is open');
  assert.ok(blade.guardArc && blade.guardArc.half > 0.4, 'and its arc measured from where it is drawn');
  assert.ok(p.shieldGrip === 1 && p.swordGrip > 0.5, 'both hands close (src/hands.js)');
  for (const [k, val] of [['swim', true], ['climbing', true], ['down', true]]) {
    for (let i = 0; i < 30; i++) { p[k] = val; tool.update(dt, { KeyZ: true }); }
    assert.equal(blade.group.visible, false, `${k}: the blade put away`);
    assert.ok(blade.device.root.visible && blade.device.s.k === 0, `${k}: the bracer folded on the hand`);
    p[k] = k === 'swim' ? null : false;
  }
  for (let i = 0; i < 30; i++) tool.update(dt, { KeyZ: true }, true);   // (a scene: the tool paused)
  assert.equal(blade.group.visible, false, 'in a scene: away');
  // out of a fight it is put away after a while
  for (let i = 0; i < 4; i++) tick({ KeyZ: true });
  for (let i = 0; i < (STANCE.linger + 1.5) / dt; i++) tick({});
  assert.equal(blade.group.visible, false, 'the fight over: away');
  tool.dispose();
});
