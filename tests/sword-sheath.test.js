// The fluid sword on the traveller's back (src/sword-sheath.js; the author: "hide the sword at rest, like move it
// back to your back?"): out of a fight the hilt sits in a leather frog behind his right shoulder, beside the flask,
// the pommel over the shoulder; drawn over the shoulder as a fight starts and put back after. Checked here: where
// it sits and how it lies, that it touches neither the flask nor his body in the poses he takes (standing, walking,
// jogging, running, talking, the title's stance, climbing, the ledge, riding, in the air, swimming, gliding), the
// draw and the sheathe and their timing, and that a swing pressed with the sword on the back is not held up.
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

test('on his back: behind the right shoulder, the pommel over it, the cup down toward the spine, the flat to his back', () => {
  const F = sheathFrame();
  const along = v(0, 1, 0).applyQuaternion(F.quaternion), flat = v(0, 0, 1).applyQuaternion(F.quaternion);
  const pommel = v(0, HILT.pommel, 0).applyQuaternion(F.quaternion).add(F.position), cup = v(0, HILT.mouth, 0).applyQuaternion(F.quaternion).add(F.position);
  assert.ok(along.y < -0.95, `the cup down (${along.y.toFixed(2)})`);
  assert.ok(along.x > 0.1, 'leaning in toward the spine as it goes down: the pommel out over the shoulder');
  assert.ok(flat.z > 0.99, 'its flat to his back');
  assert.ok(F.position.x < -0.15 && F.position.z < -0.18, 'on his right (-x), behind him');
  assert.ok(pommel.y > 0.8 && pommel.y < 0.9, `the pommel just over the shoulder (${pommel.y.toFixed(3)} m up the chest frame; the collar 0.76)`);
  assert.ok(cup.y < 0.65 && cup.x > pommel.x, 'the cup down on the shoulder blade, nearer the spine');
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
  const p = await traveller(scene, v(0, 0, -60), { body: 'v1' });
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

// ------------------------------------------------------------------ clear of the flask and of him
test('clear of the flask and of his body in every pose he takes', { timeout: 300000 }, async () => {
  const { holdStance } = await import('../src/title-world.js');
  const { p, tool, tick } = await armed();
  for (let i = 0; i < 5; i++) tick({});
  const H = p.humanoid, C = H.chestAnchor, a = p.animator, lib = a.lib, mesh = p.character.mesh;
  C.updateWorldMatrix(true, false);
  const F = sheathFrame(), balls = hiltPoints().map(({ x, y, r }) => ({ c: v(x, y, 0).applyQuaternion(F.quaternion).add(F.position), r }));
  // the flask, its frame and uprights (the wings folded inside it left out): fixed in the chest's frame
  const toChest = C.matrixWorld.clone().invert();
  let tankGap = Infinity;
  tool.tank.group.updateWorldMatrix(true, true);
  tool.tank.group.traverse((o) => {
    for (let w = o; w && w !== tool.tank.group; w = w.parent) if (!w.visible || /wing/i.test(w.name)) return;
    if (!o.isMesh) return;
    const P = o.geometry.attributes.position, m = o.matrixWorld.clone().premultiply(toChest), q = v();
    for (let i = 0; i < P.count; i++) { q.fromBufferAttribute(P, i).applyMatrix4(m); for (const b of balls) tankGap = Math.min(tankGap, q.distanceTo(b.c) - b.r); }
  });
  assert.ok(tankGap > 0.012, `${(tankGap * 100).toFixed(1)} cm off the flask`);
  // the poses: the gaits as Player plays them (his relaxed arms), the title's stance, the library's climbing,
  // riding and air clips, the swim strokes and the glide's spread arms
  const poses = [];
  const gait = (label, input, frames, setup) => {
    poses.push([label, () => { p.pos.set(0, p.physics.groundAt(0, 5, -60), -60); p.vel.set(0, 0, 0); setup?.(); }, null]);
    for (let i = 0; i < frames; i++) poses.push([label, () => p.update(dt, input, CAM_PLUS_Z), i % 6 === 5]);
  };
  const clip = (name, u, after) => () => {
    const c = lib.all.find((k) => k.name === name);
    for (const act of Object.values(a.actions)) act.setEffectiveWeight(0);
    const act = a.mixer.clipAction(c); act.play(); act.enabled = true; act.setEffectiveWeight(1); act.time = u * c.duration;
    a.mixer.update(0); a.src.updateMatrixWorld(true); a.apply(p.char.root); act.setEffectiveWeight(0);
    after?.(); p.char.root.updateMatrixWorld(true); H.update();
  };
  gait('standing', {}, 180); gait('walking', { y: 0.5 }, 90); gait('jogging', { y: 1 }, 90); gait('running', { y: 1, run: true }, 120);
  gait('talking', {}, 90, () => { p.talking = true; });
  for (let i = 0; i < 4; i++) poses.push(['the title stance', clip('Idle_Loop', i / 4, () => holdStance(p.char, i)), true]);
  for (const [n, k] of [['Climb_Up_Loop', 6], ['Climb_Idle_Loop', 3], ['Climb_Left_Loop', 4], ['Climb_Right_Loop', 4], ['ClimbLedge', 8], ['Driving_Loop', 4], ['Jump_Loop', 3], ['Jump_Start', 3]])
    for (let i = 0; i < k; i++) poses.push([n, clip(n, i / k), true]);
  const still = () => { p.char.root.updateMatrixWorld(true); H.update(); };
  for (let i = 0; i < 8; i++) poses.push(['swimming (crawl)', () => { p.swim = { k: 1, crawl: 1, ph: i / 8, pitch: 1.4, roll: 0, vy: 0, hs: 1 }; p.animate(dt, 0); still(); p.swim = null; }, true]);
  for (let i = 0; i < 4; i++) poses.push(['swimming (breaststroke)', () => { p.swim = { k: 1, crawl: 0, ph: i / 4, pitch: 1.4, roll: 0, vy: 0, hs: 1 }; p.animate(dt, 0); still(); p.swim = null; }, true]);
  poses.push(['gliding', () => { p.talking = false; p.gliding = true; p.onGround = false; p.animate(dt, 0); still(); p.wingK = 1; p.spreadArms(); p.gliding = false; p.onGround = true; p.wingK = 0; }, true]);
  const worst = new Map();
  const P = mesh.geometry.attributes.position, w = v();
  for (const [label, pose, look] of poses) {
    pose();
    if (!look) continue;
    p.object.updateMatrixWorld(true); mesh.skeleton.update(); C.updateWorldMatrix(true, false);
    const M = mesh.matrixWorld.clone().premultiply(C.matrixWorld.clone().invert());
    let gap = Infinity;
    for (let i = 0; i < P.count; i++) {
      w.fromBufferAttribute(P, i); mesh.applyBoneTransform(i, w); w.applyMatrix4(M);
      if (w.z > 0 || w.x > 0.05 || w.y < 0.4) continue;   // (his back, his right shoulder and arm, his head)
      for (const b of balls) gap = Math.min(gap, w.distanceTo(b.c) - b.r);
    }
    worst.set(label, Math.min(worst.get(label) ?? Infinity, gap));
  }
  if (process.env.SAY) console.log([...worst].map(([k, g]) => `${k} ${(g * 100).toFixed(1)} cm`).join(', '));
  // (2 cm off his skin: the overshirt over his back and arm stands about 1–1.5 cm off it)
  for (const [label, gap] of worst) assert.ok(gap > 0.02, `${label}: the hilt ${(gap * 100).toFixed(1)} cm off him`);
  assert.equal(worst.size, 17, 'every pose looked at');
  tool.dispose();
});
