// The fluid sword on the traveller's back (src/sword-sheath.js; the author: "hide the sword at rest, like move it
// back to your back?"): out of a fight the hilt sits in a leather frog on his right shoulder blade, the pommel up by
// the shoulder; drawn over the shoulder as a fight starts and put back after. Checked here: where it sits and how it
// lies (that it sits against him and clear of him in every pose: tests/sword-sheath-seat.test.js), the draw and the
// sheathe and their timing, and that a swing pressed with the sword on the back is not held up.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SHEATH, DRAW, SHEATHE, sheathFrame, hiltPoints, SheathState, frogGeometry } from '../src/sword-sheath.js';
import { HILT } from '../src/fluid-sword.js';
import { SWINGS, ATTACKS, STANCE, attackSample } from '../src/fluid-blade.js';
import { FluidTool } from '../src/fluid-tool.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { playerHands } from '../src/hands.js';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), dt = 1 / 60;

test('on his back: diagonal over the right shoulder blade, the pommel up by the shoulder, the cup down toward the spine, the flat to his back', () => {
  const F = sheathFrame();
  const along = v(0, 1, 0).applyQuaternion(F.quaternion), flat = v(0, 0, 1).applyQuaternion(F.quaternion);
  const pommel = v(0, HILT.pommel, 0).applyQuaternion(F.quaternion).add(F.position), cup = v(0, HILT.mouth, 0).applyQuaternion(F.quaternion).add(F.position);
  assert.ok(along.y < -0.8, `the cup down (${along.y.toFixed(2)})`);
  assert.ok(along.x > 0.35, 'diagonal: leaning in toward the spine as it goes down, the pommel out over the shoulder');
  assert.ok(along.z < -0.1, 'leaned with his back: the cup further back than the pommel');
  assert.ok(flat.z > 0.95, 'its flat to his back');
  assert.ok(F.position.x < -0.08 && F.position.x > -0.16 && F.position.z < -0.14 && F.position.z > -0.18, 'on his right shoulder blade (-x), just behind it (since #763: not where the flask stood)');
  assert.ok(pommel.y > 0.76 && pommel.y < 0.84, `the pommel up by the shoulder (${pommel.y.toFixed(3)} m up the chest frame; the collar 0.76)`);
  assert.ok(cup.y < 0.65 && cup.x > pommel.x + 0.07, 'the cup down on the shoulder blade, nearer the spine');
  // (an outfit with something on its back stands it off along its flat, away from him)
  const out = sheathFrame(undefined, 'gravity-ranger');
  assert.ok(out.position.distanceTo(F.position) > 0.02 && out.position.clone().sub(F.position).dot(flat) < 0, 'stood off his pack');
  assert.ok(sheathFrame(undefined, 'default').position.equals(F.position));
  // the frog: a strip between the hilt and his back, two loops round the grip
  const [strip, loops] = frogGeometry();
  strip.geometry.computeBoundingBox(); loops.geometry.computeBoundingBox();
  assert.ok(strip.geometry.boundingBox.min.z > HILT.radius, 'the strip on his back side of the grip');
  assert.ok(loops.geometry.boundingBox.max.x > HILT.radius + HILT.raise && loops.geometry.boundingBox.min.y > HILT.grip[0] && loops.geometry.boundingBox.max.y < HILT.grip[1], 'the loops round the grip');
  assert.ok(hiltPoints().length > 20);
});

test('the draw: the arm out to the back, the hilt to the fist in DRAW.time; the sheathe the same way back; flown back at once when the arms are busy', () => {
  const S = new SheathState();
  assert.equal(S.state, 'back'); assert.equal(S.held, 0);
  for (let i = 0; i < 10; i++) assert.equal(S.update(dt, false), null, 'out of a fight it stays on the back');
  assert.equal(S.held, 0); assert.equal(S.reach, 0);
  assert.equal(S.update(dt, true), 'draw', 'a fight: the draw starts at once');
  let t = dt, peak = 0, inHandAt = null, reachAtTake = null;
  while (S.state !== 'hand' && t < 1) {
    peak = Math.max(peak, S.reach);
    if (S.held > 0 && reachAtTake === null) reachAtTake = S.reach;
    if (S.held >= 1 && inHandAt === null) inHandAt = t;
    assert.equal(S.update(dt, true), null); t += dt;
  }
  assert.ok(Math.abs(t - DRAW.time) <= dt + 1e-9, `drawn in ${t.toFixed(3)} s`);
  assert.ok(DRAW.time >= 0.3 && DRAW.time <= 0.4, 'a short draw (0.3–0.4 s)');
  assert.ok(peak > 0.99, 'the hand reaches all the way back');
  assert.ok(reachAtTake > 0.9, `the hand is at the hilt as it leaves the frog (${reachAtTake.toFixed(2)})`);
  assert.ok(inHandAt <= DRAW.take[1] * DRAW.time + dt, 'in the fist by the end of the take');
  for (let i = 0; i < 12; i++) S.update(dt, true);
  assert.ok(S.held === 1 && S.reach === 0, 'held, the arm its own again');
  // the fight over: the sheathe
  assert.equal(S.update(dt, false), 'sheathe');
  t = dt; peak = 0; let heldAtPeak = null;
  while (S.state !== 'back' && t < 1) { if (S.reach > peak) { peak = S.reach; heldAtPeak = S.held; } S.update(dt, false); t += dt; }
  assert.ok(Math.abs(t - SHEATHE.time) <= dt + 1e-9, `put back in ${t.toFixed(3)} s`);
  assert.ok(peak > 0.99 && heldAtPeak > 0.5, 'the hand takes it back over the shoulder');
  for (let i = 0; i < 12; i++) S.update(dt, false);
  assert.ok(S.held === 0 && S.reach === 0);
  // drawn, then the arms busy (climbing, swimming, aiming, a scene): flown back to the frog in SHEATHE.away, no reach
  S.set(true);
  t = 0;
  while (S.held > 0 && t < 1) { S.update(dt, true, { ok: false }); assert.equal(S.reach, 0, 'no reach'); t += dt; }
  assert.ok(t <= SHEATHE.away + dt + 1e-9, `back in ${t.toFixed(3)} s`);
  // put back half-way, a fight again: it comes back out from where it is (no jump)
  S.set(true); S.update(dt, false);
  let prev = S.held;
  for (let i = 0; i < 10; i++) { S.update(dt, false); prev = S.held; }
  assert.ok(prev < 1 && prev > 0, 'half-way to the frog');
  S.update(dt, true);
  assert.ok(Math.abs(S.held - prev) < 0.2, 'no jump'); assert.equal(S.state, 'drawing');
  for (let i = 0; i < 30; i++) S.update(dt, true);
  assert.equal(S.held, 1);
});

test('a swing pressed with the sword on the back: the hilt in the fist in DRAW.quick, before any cut opens', () => {
  const S = new SheathState();
  S.update(dt, true, { quick: true });
  let t = dt;
  while (S.held < 1 && t < 1) { S.update(dt, true, { quick: true }); t += dt; }
  assert.ok(t <= DRAW.quick + dt + 1e-9, `in the fist ${t.toFixed(3)} s after the press`);
  // every attack's cut opens later than that (its wind-up; not the charged cut's: it is let go from a swing held 0.2 s)
  const winds = Object.entries(ATTACKS).filter(([k]) => k !== 'charge').map(([k, s]) => [k, attackSample(s, 0).wind]);
  for (const [k, wind] of winds) assert.ok(t <= wind + 1e-9, `in the fist (${t.toFixed(3)} s) before the ${k}'s cut opens (${wind.toFixed(2)} s)`);
  assert.ok(Math.min(...SWINGS.map((s) => s.wind)) - t >= 0.08, 'a first swing: most of its wind-up to spare');
  // pressed while a slow draw is on its way: it hurries
  const Q = new SheathState();
  Q.update(dt, true);
  for (let i = 0; i < 3; i++) Q.update(dt, true);
  t = 0;
  while (Q.held < 1 && t < 1) { Q.update(dt, true, { quick: true }); t += dt; }
  assert.ok(t <= DRAW.quick + dt, `hurried: in the fist ${t.toFixed(3)} s later`);
});

// ------------------------------------------------------------------ on the traveller
async function armed() {
  items.grant('backpack');
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, v(0, 0, -60), { body: 'b3' });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, -65); camera.lookAt(0, 1, -55); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const tick = (input = {}) => { p.update(dt, input, CAM_PLUS_Z); tool.update(dt, input); p.humanoid.hands.update(dt, playerHands(p)); };
  return { p, tool, tick };
}

test('on the traveller: in its frog on his back at rest, the hands free; drawn by the guard; back on the frog after the fight', async () => {
  const { p, tool, tick } = await armed();
  const blade = tool.blade, H = p.humanoid, C = H.chestAnchor;
  for (let i = 0; i < 10; i++) tick({});
  assert.equal(blade.group.parent, C, 'carried by the chest'); assert.ok(blade.group.visible && blade.frog.visible && blade.frog.parent === C);
  assert.ok(!blade.bladeGroup.visible, 'the blade withdrawn'); assert.equal(p.swordGrip, 0, 'the hands free');
  const F = sheathFrame(), at = v().setFromMatrixPosition(blade.group.matrixWorld), want = F.position.clone().applyMatrix4(C.matrixWorld);
  assert.ok(at.distanceTo(want) < 1e-3, 'where the frog holds it');
  // the guard: drawn over the shoulder, the right hand at the frog as it changes hands
  let reached = 0, handToHilt = Infinity;
  for (let i = 0; i < Math.ceil(DRAW.time / dt) + 4; i++) {
    tick({ KeyZ: true });
    if (p.sheathReach.k > 0.95) {
      reached++;
      // (the grip point of the fist, this frame's pose, near the hilt in the frog)
      const g = blade.fist().position.clone().applyMatrix4(H.b.hand_r.matrixWorld);
      handToHilt = Math.min(handToHilt, g.distanceTo(F.position.clone().applyMatrix4(C.matrixWorld)));
    }
  }
  assert.ok(reached > 0, 'the arm reached back');
  assert.ok(handToHilt < 0.08, `the fist at the hilt (${handToHilt.toFixed(3)} m)`);
  assert.equal(blade.group.parent, H.b.hand_r, 'then in the fist'); assert.equal(p.swordGrip, 1);
  // the fight over (STANCE.linger with nothing done): put back
  for (let i = 0; i < (STANCE.linger + SHEATHE.time + 0.5) / dt; i++) tick({});
  assert.equal(blade.group.parent, C, 'back in the frog'); assert.equal(p.swordGrip, 0);
  tool.dispose();
});

test('a swing pressed with the sword on the back starts that frame and cuts on time: no later than with it drawn', async () => {
  const timeline = async (drawnFirst) => {
    const { p, tool, tick } = await armed();
    const blade = tool.blade;
    for (let i = 0; i < 10; i++) tick({});
    if (drawnFirst) { for (let i = 0; i < 40; i++) tick({ KeyZ: true }); for (let i = 0; i < 10; i++) tick({}); }
    assert.equal(blade.sheath.held, drawnFirst ? 1 : 0);
    tick({ KeyF: true });
    const started = blade.swinging;
    let f = 0, inHand = null, cut = null;
    while (f++ < 60) {
      if (blade.sheath.held >= 1 && inHand === null) inHand = f;
      if (blade.cutting && cut === null) { cut = f; assert.equal(blade.sheath.held, 1, 'the hilt in the fist as it cuts'); assert.ok(blade.bladeGroup.visible, 'the blade out'); }
      tick({});
    }
    tool.dispose();
    return { started, inHand, cut };
  };
  const drawn = await timeline(true), back = await timeline(false);
  assert.ok(back.started && drawn.started, 'the swing starts on the press');
  assert.equal(back.cut, drawn.cut, `the cut on the same frame (${back.cut} / ${drawn.cut})`);
  assert.ok(back.inHand * dt <= DRAW.quick + 2 * dt, `in the fist ${(back.inHand * dt).toFixed(3)} s after the press`);
  assert.ok(back.inHand < back.cut, 'before the cut');
});

// (clear of his body and seated on his back in every pose, on B3, v2 and every outfit: tests/sword-sheath-seat.test.js)

test('selected blade formation follows the real draw edge, never held guard or repeated swings', async () => {
  const { tool, tick } = await armed(); let forms=0;
  tool.sound={bladeForm(){forms++;}};
  try {
    for(let i=0;i<10;i++)tick({});assert.equal(forms,0,'initial rig/load stays quiet');
    for(let i=0;i<60;i++)tick({KeyZ:true});assert.equal(forms,1,'held guard draws once');
    for(let i=0;i<120;i++)tick(i%50===0?{KeyF:true}:{});
    assert.equal(forms,1,'swing sounds do not reform the already drawn blade');
    for(let i=0;i<(STANCE.linger+SHEATHE.time+1)/dt;i++)tick({});
    for(let i=0;i<30;i++)tick({KeyZ:true});assert.equal(forms,2,'a later genuine draw has a new cue');
  } finally {tool.dispose();}
});
