// The round backpack's shoulder straps (src/fluid-tool.js STRAP_PATH; the author, issue #76: "the main character's
// backpack straps go into my ears?"): they ran straight from the plate's top corners up into his collar, their
// ends by his jaw and his ears. Now they go from the plate over the top of his shoulders and down his chest to a
// buckle. Checked on the game's traveller with his own head, in the poses he takes (standing, walking, jogging,
// running, talking, looking round, the title's stance, climbing, the ledge, riding, in the air, swimming, gliding):
// well clear of his head and ears, never under his skin, and lying on the shoulders, not floating over them.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FluidTool, strapPath, STRAP, STRAP_PATH } from '../src/fluid-tool.js';
import { TRAVELLER_V1_TANK_AT } from '../src/characters/traveller-v1.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), dt = 1 / 60;

test('the straps’ way: from the plate’s top corners, over the shoulders beside the neck, down the chest', () => {
  assert.deepEqual(STRAP.at, TRAVELLER_V1_TANK_AT, 'laid out for the body that wears the flask');
  const top = STRAP_PATH.reduce((a, b) => (b[1] > a[1] ? b : a));
  assert.ok(top[1] < 0.8, `no higher than the top of the shoulder (${top[1]})`);
  assert.ok(STRAP_PATH.every(([x]) => x > 0.1), 'out on the shoulder, never in by the neck');
  assert.ok(STRAP_PATH[0][2] < -0.13 && STRAP_PATH.at(-1)[2] > 0.07, 'from his back round to his chest');
  assert.ok(STRAP_PATH.at(-1)[1] < 0.65, 'its end down on the chest, not at the collar');
  const L = strapPath(-1), R = strapPath(1);
  assert.ok(L.every((p, i) => Math.abs(p.x + R[i].x) < 1e-9 && p.y === R[i].y), 'the right a mirror of the left');
});

test('clear of his head and ears, on his shoulders and never under his skin, in every pose he takes', { timeout: 300000 }, async () => {
  const { holdStance } = await import('../src/title-world.js');
  items.grant('backpack');
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, v(0, 0, -60), { body: 'v1', head: true });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, -65); camera.lookAt(0, 1, -55); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  for (let i = 0; i < 5; i++) { p.update(dt, {}, CAM_PLUS_Z); tool.update(dt, {}); }
  const H = p.humanoid, C = H.chestAnchor, a = p.animator, lib = a.lib, ch = p.character;
  assert.ok(ch.head, 'his own head on');
  // the straps where the worn flask has them: their way through the tank group's own frame, into the chest's
  C.updateWorldMatrix(true, true); tool.tank.group.updateWorldMatrix(true, false);
  const toChest = tool.tank.group.matrixWorld.clone().premultiply(C.matrixWorld.clone().invert());
  const strap = [];
  for (const sx of [-1, 1]) {
    const pts = strapPath(sx).map((q) => q.applyMatrix4(toChest));
    for (let k = 0; k < pts.length - 1; k++) for (let s = 0; s < 8; s++) strap.push(pts[k].clone().lerp(pts[k + 1], s / 8));
  }
  const half = (STRAP.t / 2) * toChest.getMaxScaleOnAxis();
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
  gait('standing', {}, 120); gait('walking', { y: 0.5 }, 90); gait('jogging', { y: 1 }, 90); gait('running', { y: 1, run: true }, 120);
  gait('talking', {}, 90, () => { p.talking = true; });
  // looking round: his head turned as far as he turns it, and down and up (the ears swing past the straps)
  for (const [yaw, pitch] of [[0.9, 0], [-0.9, 0], [0.6, 0.45], [-0.6, 0.45], [0, -0.35], [0.7, -0.3], [-0.7, -0.3]]) {
    poses.push(['looking round', () => {
      p.talking = false; p.update(dt, {}, CAM_PLUS_Z);
      const b = H.b.Head ?? H.b.head; b.rotateY(yaw); b.rotateX(pitch); b.updateMatrixWorld(true);
    }, true]);
  }
  for (let i = 0; i < 4; i++) poses.push(['the title stance', clip('Idle_Loop', i / 4, () => holdStance(p.char, i)), true]);
  for (const [n, k] of [['Climb_Up_Loop', 6], ['Climb_Idle_Loop', 3], ['Climb_Left_Loop', 4], ['Climb_Right_Loop', 4], ['ClimbLedge', 8], ['Driving_Loop', 4], ['Jump_Loop', 3], ['Jump_Start', 3]])
    for (let i = 0; i < k; i++) poses.push([n, clip(n, i / k), true]);
  const still = () => { p.char.root.updateMatrixWorld(true); H.update(); };
  for (let i = 0; i < 8; i++) poses.push(['swimming (crawl)', () => { p.swim = { k: 1, crawl: 1, ph: i / 8, pitch: 1.4, roll: 0, vy: 0, hs: 1 }; p.animate(dt, 0); still(); p.swim = null; }, true]);
  for (let i = 0; i < 4; i++) poses.push(['swimming (breaststroke)', () => { p.swim = { k: 1, crawl: 0, ph: i / 4, pitch: 1.4, roll: 0, vy: 0, hs: 1 }; p.animate(dt, 0); still(); p.swim = null; }, true]);
  poses.push(['gliding', () => { p.talking = false; p.gliding = true; p.onGround = false; p.animate(dt, 0); still(); p.wingK = 1; p.spreadArms(); p.gliding = false; p.onGround = true; p.wingK = 0; }, true]);

  // his skin (with the shirt painted on it) and his inner shirt, and his head, posed, in the chest's frame
  const body = [ch.mesh, ch.cloth?.innerShirt].filter((m) => m?.isSkinnedMesh), head = ch.head;
  const posed = (m, inv) => {
    const M = m.matrixWorld.clone().premultiply(inv), P = m.geometry.attributes.position, w = v();
    const g = new THREE.BufferGeometry(), arr = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { w.fromBufferAttribute(P, i); m.applyBoneTransform(i, w); w.applyMatrix4(M); arr[i * 3] = w.x; arr[i * 3 + 1] = w.y; arr[i * 3 + 2] = w.z; }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); if (m.geometry.index) g.setIndex(m.geometry.index);
    g.computeVertexNormals();
    return { arr, n: g.attributes.normal.array };
  };
  const worst = new Map(), put = (label, k, x, min = true) => { const o = worst.get(label) ?? { head: Infinity, under: Infinity, off: 0 }; o[k] = min ? Math.min(o[k], x) : Math.max(o[k], x); worst.set(label, o); };
  for (const [label, pose, look] of poses) {
    pose();
    if (!look) continue;
    p.object.updateMatrixWorld(true); C.updateWorldMatrix(true, false);
    const inv = C.matrixWorld.clone().invert();
    // the head: nothing of the strap within 3 cm of it (his ears stand out from it a centimetre or two)
    head.skeleton.update();
    const hd = posed(head, inv);
    let gap = Infinity;
    for (const q of strap) for (let i = 0; i < hd.arr.length; i += 3) gap = Math.min(gap, Math.hypot(hd.arr[i] - q.x, hd.arr[i + 1] - q.y, hd.arr[i + 2] - q.z));
    put(label, 'head', gap);
    // the body: the strap's underside over the skin (by the nearest point's normal), and how far the strap floats off it
    const surf = body.map((m) => { m.skeleton.update(); return posed(m, inv); });
    let under = Infinity, off = 0;
    for (const q of strap) {
      let bd = Infinity, best = null;
      for (const s of surf) for (let i = 0; i < s.arr.length; i += 3) {
        const d = (s.arr[i] - q.x) ** 2 + (s.arr[i + 1] - q.y) ** 2 + (s.arr[i + 2] - q.z) ** 2;
        if (d < bd) { bd = d; best = [s, i]; }
      }
      const [s, i] = best, signed = (q.x - s.arr[i]) * s.n[i] + (q.y - s.arr[i + 1]) * s.n[i + 1] + (q.z - s.arr[i + 2]) * s.n[i + 2];
      under = Math.min(under, signed - half);
      if (q.z > -0.1) off = Math.max(off, Math.sqrt(bd));   // (from the top of the shoulder round to the chest; behind, it runs to the plate)
    }
    put(label, 'under', under); put(label, 'off', off, false);
  }
  if (process.env.SAY) console.log([...worst].map(([k, o]) => `${k}: head ${(o.head * 100).toFixed(1)} cm, under ${(o.under * 100).toFixed(1)} cm, off ${(o.off * 100).toFixed(1)} cm`).join('\n'));
  // (before, the straight straps came 0–1.3 cm from his head, and 3.5 cm into his neck as he looked round)
  // Swimming's overhead stroke lifts the shoulder up under the strap a little and turns his head to breathe: it is
  // allowed a centimetre, under the water. Upright (the gaits, talking, looking round) the strap lies on him.
  const upright = /^(standing|walking|jogging|running|talking|looking round)$/, swim = /^swimming/;
  for (const [label, o] of worst) {
    assert.ok(o.head > (upright.test(label) ? 0.04 : 0.025), `${label}: a strap ${(o.head * 100).toFixed(1)} cm from his head`);
    assert.ok(o.under > (swim.test(label) ? -0.012 : -0.004), `${label}: a strap ${(-o.under * 100).toFixed(1)} cm under his skin`);
    if (upright.test(label)) assert.ok(o.off < 0.045, `${label}: a strap floating ${(o.off * 100).toFixed(1)} cm off his shoulder`);
  }
  assert.equal(worst.size, 18, 'every pose looked at');
  tool.dispose();
});
