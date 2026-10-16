import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { circumcentre, gripLine, fistGrip, forearmMount, FOREARM, STRAP } from '../src/blade-grip.js';
import { ShieldState, SHIELD, shieldArc, blobRadius, braceShift } from '../src/shield.js';
import { SWINGS, WHIRL, GUARD, STANCE, FIGHT, attackSample, bladeDrawn, bladeLitWant, foeEngaged, inGuard } from '../src/fluid-blade.js';
import { registerTarget } from '../src/targets.js';
import { DRAW, SHEATHE } from '../src/sword-sheath.js';
import { FluidTool } from '../src/fluid-tool.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { playerHands } from '../src/hands.js';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';
import { strapSkin } from './strap-skin.js';

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

test('the fluid is a blob, not a disc: its edge never round, rippling with time, more as it spills and is struck', () => {
  const at = (t, w = 1) => Array.from({ length: 90 }, (_, i) => blobRadius((i / 90) * Math.PI * 2, t, w));
  const r = at(0), spread = Math.max(...r) - Math.min(...r);
  assert.ok(spread > 0.12 && Math.max(...r) < 1.2 && Math.min(...r) > 0.8, `its edge between ${Math.min(...r).toFixed(2)} and ${Math.max(...r).toFixed(2)}`);
  assert.ok(at(0.5).some((x, i) => Math.abs(x - r[i]) > 0.03), 'it moves');
  assert.ok(at(0, 0).every((x) => x === 1), 'no wobble: a circle');
  const S = new ShieldState(); S.k = 1; const rest = S.wobble; S.hit('block');
  assert.ok(S.wobble > rest, 'struck, it ripples more'); S.k = 0.5; S.flare = 0;
  assert.ok(S.wobble > rest, 'spilling out, more');
  // the arc of a shape reaching further one way than the other
  const up = v(0, 1, 0), lop = shieldArc(v(), v(0, 0, 0.4), v(0, 0, 1), { plus: 0.45, minus: 0.25 }, up);
  assert.ok(lop.dir.x > 0.05, 'it reaches further to the left (up × facing): its arc leans left');
  const even = shieldArc(v(), v(0, 0, 0.4), v(0, 0, 1), { plus: 0.35, minus: 0.35 }, up);
  assert.ok(Math.abs(even.half - shieldArc(v(), v(0, 0, 0.4), v(0, 0, 1), 0.35, up).half) < 1e-12, 'even: a disc');
});

test('raised, the arm is brought across so the bracer stands just left of the chest\'s middle line, never further than SHIELD.brace', () => {
  const chest = v(0, 1.1, 0), dir = v(0, 0, 1), up = v(0, 1, 0);   // (up × dir: +x, his left)
  const s = braceShift(v(0.3, 1.38, 0.34), chest, dir, up, 1);
  assert.ok(Math.abs(s.x + (0.3 - SHIELD.middle)) < 1e-9 && s.y === 0 && s.z === 0, 'across to his right, flat');
  assert.ok(braceShift(v(0.3, 1.38, 0.34), chest, dir, up, 0).length() < 1e-12, 'lowered: where the clip has it');
  assert.ok(braceShift(v(-0.2, 1.38, 0.34), chest, dir, up, 1).length() < 1e-12, 'never pushed out to the left');
  assert.ok(Math.abs(braceShift(v(1.5, 1.38, 0.34), chest, dir, up, 1).length() - SHIELD.brace) < 1e-9, 'by SHIELD.brace at most');
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

for (const body of ['b3', 'plain']) {
  test(`${body} traveller: the hilt sits in the fist and the bracer on the left hand on every frame of every combat clip`, async () => {
    const { p, tool, tick } = await armed(body);
    const H = p.humanoid, B = H.b, blade = tool.blade, grip = fistGrip(H), mount = forearmMount(H);
    // (the guard draws the blade off his back: src/sword-sheath.js, in the fist after DRAW.time)
    for (let i = 0; i < Math.ceil(DRAW.time / dt) + 2; i++) tick({ KeyZ: true });
    for (let i = 0; i < 6; i++) tick({});
    const skin = strapSkin(H, blade.device);
    assert.equal(blade.group.parent, B.hand_r, 'carried by the right hand bone');
    assert.equal(blade.device.root.parent, B.lowerarm_l, 'the bracer strapped round the left forearm');
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
        // the bracer on this frame's forearm, FOREARM.along of the way from the elbow to the wrist, its face out of the
        // forearm the back of the hand's way (issue #284: strapped like a real shield, following the arm's bones)
        const el = B.lowerarm_l.getWorldPosition(v()), wr = B.hand_l.getWorldPosition(v()), at2 = v().setFromMatrixPosition(b.matrixWorld);
        const axis2 = wr.clone().sub(el).normalize(), along = at2.clone().sub(el).dot(axis2) / wr.distanceTo(el);
        assert.ok(Math.abs(along - FOREARM.along) < 0.02, `${S.clip}: along the forearm (${along.toFixed(2)})`);
        // the strap wrapped on this frame's skin all round, no gap and nothing sunk in, the plate on it (issue #303)
        const m = skin.measure();
        assert.ok(m.min > -1.5e-3 && m.max < 4.5e-3, `${S.clip} t ${s.t.toFixed(2)}: the strap ${(m.min * 1000).toFixed(1)}..${(m.max * 1000).toFixed(1)} mm off the skin`);
        assert.ok(m.plate > STRAP.leather + STRAP.plate - 1e-3 && m.plate < STRAP.leather + STRAP.plate + 5e-3, `${S.clip}: the plate on the strap (${(m.plate * 1000).toFixed(1)} mm off the skin)`);
        const out = v(0, 0, 1).transformDirection(b.matrixWorld), back = mount.outHand.clone().transformDirection(B.hand_l.matrixWorld);
        assert.ok(Math.abs(out.dot(axis2)) < 1e-3 && out.dot(back) > 0.7, `${S.clip}: facing out, the back of the hand's way (${out.dot(back).toFixed(2)})`);
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

for (const body of ['b3', 'plain']) {
  test(`${body} traveller: at rest the bracer's strap wraps the forearm's skin standing, walking, running and turning, the hub on its outside`, async () => {
    const { p, tool, tick } = await armed(body);
    const H = p.humanoid, B = H.b, D = tool.blade.device;
    for (let i = 0; i < 10; i++) tick({});
    assert.ok(D.wrap && D.wrap.rows.every((r) => r.samples.filter(Boolean).length >= STRAP.sectors - 2), 'the skin read all round the forearm');
    const skin = strapSkin(H, D);
    assert.ok(skin.triangles > 20, `the forearm's skin (${skin.triangles} triangles)`);
    let lo = Infinity, hi = -Infinity;
    for (const [what, input, secs] of [['standing', {}, 1], ['walking', { KeyW: true }, 1.5], ['running', { KeyW: true, ShiftLeft: true }, 1.5], ['turning', { KeyA: true, ShiftLeft: true }, 1], ['stopping', {}, 1]]) {
      for (let i = 0; i < secs / dt; i++) {
        tick(input);
        assert.equal(D.s.k, 0, 'folded');
        const m = skin.measure();
        lo = Math.min(lo, m.min); hi = Math.max(hi, m.max);
        assert.ok(m.min > -1.5e-3 && m.max < 4.5e-3, `${what}, frame ${i}: the strap ${(m.min * 1000).toFixed(1)}..${(m.max * 1000).toFixed(1)} mm off the skin`);
        assert.ok(m.plate > STRAP.leather + STRAP.plate - 1e-3 && m.plate < STRAP.leather + STRAP.plate + 5e-3, `${what}: the plate on the strap (${(m.plate * 1000).toFixed(1)} mm)`);
        // the folded hub on the outside of the forearm: its face the back of the hand's way, the forearm under it
        const out = v(0, 0, 1).transformDirection(D.root.matrixWorld), back = forearmMount(H).outHand.clone().transformDirection(B.hand_l.matrixWorld);
        const el = B.lowerarm_l.getWorldPosition(v()), at = v().setFromMatrixPosition(D.root.matrixWorld);
        assert.ok(out.dot(back) > 0.7 && at.sub(el).dot(out) > 0, `${what}: on the outside (${out.dot(back).toFixed(2)})`);
      }
    }
    console.log(`${body}: the strap ${(lo * 1000).toFixed(1)}..${(hi * 1000).toFixed(1)} mm off the skin`);
    tool.dispose();
  });
}

for (const body of ['b3', 'plain']) {
  test(`${body} traveller: in the block pose the shield covers both sides alike, 50–60° each way of facing, on its knuckle off the forearm`, async () => {
    const { p, tool, tick } = await armed(body);
    const blade = tool.blade, D = blade.device;
    for (let i = 0; i < 90; i++) tick({ KeyZ: true });
    const a = blade.guardArc, f = p.frame.dir(p.heading, v()), side = v().crossVectors(p.frame.up, f);
    const centre = Math.atan2(a.dir.dot(side), a.dir.dot(f)) * 180 / Math.PI, half = a.half * 180 / Math.PI;
    assert.ok(Math.abs(centre) <= 5, `centred ${centre.toFixed(1)}° from facing`);
    assert.ok(half >= 50 && half <= 60, `${half.toFixed(1)}° each side (left ${(half + centre).toFixed(0)}°, right ${(half - centre).toFixed(0)}°)`);
    const chest = p.pos.clone().addScaledVector(p.frame.up, 1.1), c = D.centre.clone().sub(chest);
    assert.ok(Math.abs(c.dot(side)) < 0.12 && c.dot(f) > 0.25 && c.dot(p.frame.up) > 0, `before the chest, the arm braced across (${c.dot(side).toFixed(2)} m left, ${c.dot(f).toFixed(2)} ahead, ${c.dot(p.frame.up).toFixed(2)} up)`);
    const bracer = v().setFromMatrixPosition(D.root.matrixWorld);
    assert.ok(D.root.parent === p.humanoid.b.lowerarm_l && Math.abs(D.centre.distanceTo(bracer) - SHIELD.stand) < 0.01, `on its knuckle off the forearm's bracer (${D.centre.distanceTo(bracer).toFixed(3)} m)`);
    // the arc is the drawn blob's: its reach either side off the edge as drawn
    const n = D.normal.clone().setY(0).normalize(), s2 = v().crossVectors(p.frame.up, n).normalize();
    const reach = Math.max(...D.outline.map((q) => q.clone().sub(D.centre).dot(s2)));
    assert.ok(reach > SHIELD.radius * 0.9 && reach < SHIELD.radius * 1.25, `its edge reaches ${reach.toFixed(2)} m`);
    tool.dispose();
  });
}

test('put away climbing, swimming, in a scene and knocked down; the bracer stays folded on the hand; the guard opens the shield', async () => {
  const { p, tool, tick } = await armed('b3');
  const blade = tool.blade;
  for (let i = 0; i < 20; i++) tick({ KeyZ: true });
  assert.ok(blade.device.s.k === 1 && blade.device.face.visible, 'held, the shield is open');
  assert.ok(blade.guardArc && blade.guardArc.half > 0.4, 'and its arc measured from where it is drawn');
  assert.ok(p.shieldGrip === 1 && p.swordGrip > 0.5, 'both hands close (src/hands.js)');
  for (const [k, val] of [['swim', true], ['climbing', true], ['down', true]]) {
    for (let i = 0; i < 30; i++) { p[k] = val; tool.update(dt, { KeyZ: true }); }
    assert.ok(blade.sheath.held === 0 && blade.group.parent === p.humanoid.chestAnchor && blade.group.visible, `${k}: the blade back on his back`);
    assert.ok(blade.device.root.visible && blade.device.s.k === 0, `${k}: the bracer folded on the forearm`);
    p[k] = k === 'swim' ? null : false;
  }
  for (let i = 0; i < 30; i++) tool.update(dt, { KeyZ: true }, true);   // (a scene: the tool paused)
  assert.ok(blade.sheath.held === 0 && blade.group.parent === p.humanoid.chestAnchor, 'in a scene: on his back');
  // out of a fight it is put away after a while
  for (let i = 0; i < 4; i++) tick({ KeyZ: true });
  for (let i = 0; i < (STANCE.linger + SHEATHE.time + 1) / dt; i++) tick({});
  assert.ok(blade.sheath.held === 0 && blade.group.parent === p.humanoid.chestAnchor && blade.frog.visible, 'the fight over: back in its frog');
  tool.dispose();
});

test('a fight (issue #390): a foe awake near keeps the blade drawn and lit between cuts; asleep, far or dead it does not', () => {
  const foe = (state, x) => ({ kind: 'foe', foe: { state }, enabled: () => state !== 'dead', position: () => v(x, 1, 0) });
  for (const s of ['chase', 'wind', 'strike', 'recover']) assert.ok(foeEngaged(v(), [foe(s, 4)]), `${s} near: a fight`);
  assert.ok(!foeEngaged(v(), [foe('idle', 4)]) && !foeEngaged(v(), [foe('home', 4)]) && !foeEngaged(v(), [foe('dead', 4)]), 'asleep, gone home or dead: none');
  assert.ok(!foeEngaged(v(), [foe('chase', FIGHT.near + 1)]), 'beyond FIGHT.near: none');
  assert.ok(!foeEngaged(v(), [{ kind: 'rope', enabled: () => true, position: () => v() }]), 'only foes');
  assert.ok(bladeDrawn({ fighting: true }), 'drawn in a fight with nothing pressed');
  assert.equal(bladeLitWant({ fighting: true, inHand: true }), FIGHT.lit, 'open between cuts in a fight');
  assert.ok(FIGHT.lit >= 0.9, 'open at (nearly) full length');
  assert.equal(bladeLitWant({ fighting: true, inHand: false }), 0, 'not lit on his back');
  assert.equal(bladeLitWant({ inHand: true }), 0, 'out of a fight, only the bead');
  assert.equal(bladeLitWant({ swinging: true }), 1);
});

test('in a fight the blade stays in the fist and open through the combo, the guard, the dash cut, the charged cut and the air cut, back after the gun; the fight over, it goes back on his back', async () => {
  const { p, tool, tick } = await armed('b3');
  const blade = tool.blade, state = { state: 'chase' };
  const off = registerTarget({ kind: 'foe', foe: state, lock: false, position: () => p.pos.clone().add(v(0, 1, 6)), enabled: () => state.state !== 'dead' });
  try {
    for (let i = 0; i < Math.ceil(DRAW.time / dt) + 30; i++) tick({});
    assert.ok(blade.sheath.held >= 1 && blade.group.parent === p.humanoid.b.hand_r, 'a foe awake near: drawn with nothing pressed');
    assert.ok(blade.shownLit(0, true) > 0.95 && blade.bladeGroup.visible, 'and open');
    let minLit = Infinity, minHeld = Infinity, since = Infinity;
    const watch = () => {
      // (the charge pulses on its own, CHARGE_LOOK, and its cut lights from there: a tenth of a second after it left out)
      since = blade.charging ? 0 : since + dt;
      if (since > 0.1) minLit = Math.min(minLit, blade.lit);
      minHeld = Math.min(minHeld, blade.sheath.held);
    };
    // the combo, three presses chained, then its recovery and a wait
    for (let k = 0; k < 3; k++) { tick({ KeyF: true }); watch(); for (let i = 0; i < 20; i++) { tick({}); watch(); } }
    for (let i = 0; i < 120; i++) { tick({}); watch(); }
    for (let i = 0; i < 40; i++) { tick({ KeyZ: true }); watch(); }   // (the guard)
    for (let i = 0; i < 60; i++) { tick({}); watch(); }
    // an evade with a press in it (the dash cut), then the charged cut (held), then a jump and a press (the air cut)
    tick({ AltLeft: true }); watch(); for (let i = 0; i < 6; i++) { tick({ KeyF: i < 2 }); watch(); }
    for (let i = 0; i < 90; i++) { tick({}); watch(); }
    for (let i = 0; i < 100; i++) { tick({ KeyF: true }); watch(); }
    for (let i = 0; i < 90; i++) { tick({}); watch(); }
    tick({ Space: true }); for (let i = 0; i < 12; i++) { tick({ KeyF: i === 8 }); watch(); }
    for (let i = 0; i < 120; i++) { tick({}); watch(); }
    assert.ok(minHeld >= 1, `never put away in the fight (held down to ${minHeld.toFixed(2)})`);
    assert.ok(minLit > 0.95, `never dark between cuts (lit down to ${minLit.toFixed(2)})`);
    // the gun: aimed, the blade is put away; the aim let go in the fight, it is drawn again and open
    items.grant('gun'); tool.forceGun = true;   // (the gun in hand, as a game on foot lends it)
    for (let i = 0; i < 40; i++) tick({ MouseRight: true });
    assert.ok(blade.sheath.held === 0, 'aiming the gun: on his back');
    for (let i = 0; i < Math.ceil(DRAW.time / dt) + 40; i++) tick({});
    assert.ok(blade.sheath.held >= 1 && blade.lit > 0.95, 'the aim let go in the fight: back in the fist, open');
    // the foe dead: a short while still drawn (FIGHT.after), then the sheathe
    state.state = 'dead';
    for (let i = 0; i < 1.5 / dt; i++) tick({});
    assert.ok(blade.sheath.held >= 1, 'not put away the moment the fight ends');
    for (let i = 0; i < (FIGHT.after + STANCE.linger + SHEATHE.time + 1) / dt; i++) tick({});
    assert.ok(blade.sheath.held === 0 && blade.group.parent === p.humanoid.chestAnchor && blade.lit < 0.05, 'the fight over: back in its frog, dark');
  } finally { off(); items.revoke('gun'); tool.dispose(); }
});
