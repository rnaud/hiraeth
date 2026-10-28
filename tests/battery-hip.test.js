// The makers' battery at the traveller's hip (issue #728, references/Core Objects/Makers Battery/selected-2026-10-28/:
// the author's hip lantern, no tether): on his belt at the left hip, 60° round toward his back (TANK.at, the hip anchor:
// the chest's frame carried by the pelvis). Checked here on the game's traveller (B3, his body and his trousers): that it
// sits where it should, carried by his hips, and that neither his arms nor his legs nor his body come into it in any
// pose he takes: standing, walking, jogging, running, sprinting, talking, the title's stance, climbing, the ledge,
// riding, sitting on a bench, the jump, swimming, gliding and the dodge roll. Nothing of the battery on his back.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FluidTool, TANK, tankRadiusAt } from '../src/fluid-tool.js';
import { WING_ROOT } from '../src/fluid-kit.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { benchSitPose } from '../src/benches.js';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), dt = 1 / 60;
const RAIL_X = TANK.capR + 0.009, RAIL_R = 0.0042;

/** How far a point (the battery's frame) is outside the battery: its glass and caps (a body of revolution) and its rails. */
function gap(p) {
  const y = THREE.MathUtils.clamp(p.y, 0, TANK.height), r = Math.hypot(p.x, p.z), R = tankRadiusAt(y);
  let d = p.y >= 0 && p.y <= TANK.height ? r - R : Math.hypot(Math.max(0, r - R), p.y - y);
  for (const sx of [-1, 1]) d = Math.min(d, Math.hypot(p.x - sx * RAIL_X, p.z, Math.max(0, Math.abs(p.y - TANK.height / 2) - TANK.height / 2 + 0.03)) - RAIL_R);
  return d;
}

async function worn() {
  items.grant('backpack');
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, v(0, 0, -60), { body: 'b3' });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, -65); camera.lookAt(0, 1, -55); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  for (let i = 0; i < 5; i++) { p.update(dt, {}, CAM_PLUS_Z); tool.update(dt, {}); }
  return { p, tool };
}

test('at his left hip, a little behind it, on the belt line, carried by his pelvis; nothing on his back but the wings\' roots', async () => {
  const { p, tool } = await worn();
  const H = p.humanoid, g = tool.tank.group;
  assert.ok(g.parent === H.hipAnchor && H.hipAnchor !== H.chestAnchor, 'on the hip anchor, not the chest\'s');
  assert.equal(H.hipAnchor.parent.name, 'pelvis', 'carried by the pelvis');
  const feet = p.pos.y;
  g.updateWorldMatrix(true, false);
  const mid = g.localToWorld(v(0, TANK.center, 0)), local = p.object.worldToLocal(mid.clone());
  assert.ok(mid.y - feet > 0.9 && mid.y - feet < 1.05, `at his belt (${(mid.y - feet).toFixed(2)} m up)`);
  assert.ok(local.x > 0.07 && local.x < 0.16, `his left side (+x ${local.x.toFixed(3)})`);
  assert.ok(local.z < -0.12, `a little behind his hip (z ${local.z.toFixed(3)})`);
  const up = v(0, 1, 0).transformDirection(g.matrixWorld);
  assert.ok(up.y > 0.98, 'upright, as a lantern hangs');
  // no tank on his back: the only thing there is the wings' root, an empty frame until they open
  const back = tool.back;
  assert.ok(back.parent === H.chestAnchor && back.position.z === WING_ROOT.at[2]);
  let shown = 0; back.traverse((o) => { if (o.isMesh && o.visible) for (let w = o; w; w = w.parent) { if (!w.visible) break; if (w === back) { shown++; break; } } });
  assert.equal(shown, 0, 'nothing drawn on his back with the wings folded');
  tool.dispose();
});

test('clear of his arms, his legs and his body in every pose he takes', { timeout: 300000 }, async () => {
  const { holdStance } = await import('../src/title-world.js');
  const { p, tool } = await worn();
  const H = p.humanoid, a = p.animator, lib = a.lib, model = p.character, g = tool.tank.group;
  const meshes = [model.mesh, model.cloth?.underlayer].filter((m) => m?.isSkinnedMesh);
  assert.ok(meshes.length === 2, 'his body and his trousers');
  const poses = [];
  const gait = (label, input, frames, setup) => {
    poses.push([label, () => { p.pos.set(0, p.physics.groundAt(0, 5, -60), -60); p.vel.set(0, 0, 0); setup?.(); }, false]);
    for (let i = 0; i < frames; i++) poses.push([label, () => p.update(dt, input, CAM_PLUS_Z), i % 5 === 4]);
  };
  const clip = (name, u, after) => () => {
    const c = lib.all.find((k) => k.name === name);
    for (const act of Object.values(a.actions)) act.setEffectiveWeight(0);
    const act = a.mixer.clipAction(c); act.play(); act.enabled = true; act.setEffectiveWeight(1); act.time = u * c.duration;
    a.mixer.update(0); a.src.updateMatrixWorld(true); a.apply(p.char.root); act.setEffectiveWeight(0);
    after?.(); p.char.root.updateMatrixWorld(true); H.update();
  };
  const still = () => { p.char.root.updateMatrixWorld(true); H.update(); };
  gait('standing', {}, 120); gait('walking', { y: 0.5 }, 90); gait('jogging', { y: 1 }, 90); gait('running', { y: 1, run: true }, 120);
  gait('sprinting', { y: 1, run: true, ShiftLeft: true }, 120);
  gait('talking', {}, 90, () => { p.talking = true; });
  for (let i = 0; i < 4; i++) poses.push(['the title stance', clip('Idle_Loop', i / 4, () => { p.talking = false; holdStance(p.char, i); }), true]);
  for (const [n, k] of [['Climb_Up_Loop', 6], ['Climb_Idle_Loop', 3], ['Climb_Left_Loop', 4], ['Climb_Right_Loop', 4], ['Climb_Down_Loop', 4], ['ClimbLedge', 8], ['Driving_Loop', 4], ['Jump_Loop', 3], ['Jump_Start', 3], ['Jump_Land', 3]])
    for (let i = 0; i < k; i++) poses.push([n, clip(n, i / k), true]);
  for (const k of [0.5, 1]) poses.push(['sitting on a bench', clip('Idle_Loop', 0, () => benchSitPose(p.char, k)), true]);
  for (let i = 0; i < 8; i++) poses.push(['swimming (crawl)', () => { p.swim = { k: 1, crawl: 1, ph: i / 8, pitch: 1.4, roll: 0, vy: 0, hs: 1 }; p.animate(dt, 0); still(); p.swim = null; }, true]);
  for (let i = 0; i < 4; i++) poses.push(['swimming (breaststroke)', () => { p.swim = { k: 1, crawl: 0, ph: i / 4, pitch: 1.4, roll: 0, vy: 0, hs: 1 }; p.animate(dt, 0); still(); p.swim = null; }, true]);
  poses.push(['gliding', () => { p.gliding = true; p.onGround = false; p.animate(dt, 0); still(); p.wingK = 1; p.spreadArms?.(); p.gliding = false; p.onGround = true; p.wingK = 0; }, true]);
  for (let i = 1; i < 8; i++) poses.push(['the dodge roll', () => { p.combatMotion = { dir: v(0, 0, 1), speed: 0, scale: 0, evade: i / 8, roll: i / 8 }; p.onGround = true; p.animate(dt, 0); still(); p.combatMotion = null; }, true]);
  const worst = new Map(), w = v(), inv = new THREE.Matrix4();
  for (const [label, pose, look] of poses) {
    pose();
    if (!look) continue;
    p.object.updateMatrixWorld(true); g.updateWorldMatrix(true, false); inv.copy(g.matrixWorld).invert();
    let least = Infinity;
    for (const m of meshes) {
      m.skeleton.update();
      const P = m.geometry.attributes.position, M = m.matrixWorld.clone().premultiply(inv);
      for (let i = 0; i < P.count; i++) {
        w.fromBufferAttribute(P, i); m.applyBoneTransform(i, w); w.applyMatrix4(M);
        if (Math.abs(w.x) > 0.2 || Math.abs(w.z) > 0.2 || w.y < -0.1 || w.y > TANK.height + 0.1) continue;   // (far from it)
        least = Math.min(least, gap(w));
      }
    }
    worst.set(label, Math.min(worst.get(label) ?? Infinity, least));
  }
  if (process.env.SAY) console.log([...worst].map(([k, d]) => `${k} ${(d * 100).toFixed(1)} cm`).join(', '));
  // (the glass, its caps and rails: none of him in them; measured on B3 at its place: 2.2 cm at rest (his belt, behind
  // the clip), the closest 0.6–1.0 cm: the dodge roll's tuck, the sprint's arm swing, the climb's raised thigh)
  for (const [label, d] of worst) assert.ok(d > 0.002, `${label}: ${(d * 100).toFixed(1)} cm (into the battery)`);
  assert.equal(worst.size, 22, 'every pose looked at');
  tool.dispose();
});
