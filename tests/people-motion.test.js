import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadAssets } from './gait-sim.js';

// The people near you (src/npc.js with src/feet.js, src/locomotion.js) and far off (the animation
// by distance, src/skinned-lod.js): they turn toward you with steps, walk their own way, are posed
// less often further off, and draw a simpler body far away that still bends on its own skeleton.

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { NPC, NPC_DETAIL } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');
const { Humanoid } = await import('../src/humanoid.js');
const { buildCharacter } = await import('../src/player.js');
const { SkinnedLod, SKIN_LOD } = await import('../src/skinned-lod.js');
const { triCount } = await import('../src/lod.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function flat() {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  scene.updateMatrixWorld(true);
  return { scene, physics: new Physics(scene) };
}
const playerAt = (pos) => ({ pos, vel: V(0, 0, 0), frame: { up: V(0, 1, 0) }, wind: V(0, 0, 0), riding: false, bodyCapsules: () => [] });

test('a person turning to face you steps round instead of spinning on the spot', async () => {
  const { lib, human } = await loadAssets();
  const { scene, physics } = flat();
  const npc = new NPC(scene, physics, { route: [V(0, 0, 0)], cape: 0, lines: ['~neutral~ Hello.'], lib, human: human.m, kind: 'm' });
  npc.heading = 0;
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(4, 2, 4);
  const far = playerAt(V(0, 0, 40));
  for (let i = 0; i < 90; i++) npc.update(1 / 60, far, camera);   // settle, standing
  const H = npc.humanoid, B = H.b;
  assert.ok(H._feet?.l.locked && H._feet?.r.locked, 'both feet planted, standing');
  // you come up behind them: they turn round to you
  const you = playerAt(V(0, 0, -4));
  let steps = 0, both = 0, held = 0;
  const prev = { l: null, r: null };
  for (let i = 0; i < 150; i++) {
    const was = { l: !!H._feet.l.step, r: !!H._feet.r.step };
    npc.update(1 / 60, you, camera);
    for (const s of ['l', 'r']) {
      const F = H._feet[s], ball = B[`ball_${s}`].getWorldPosition(new THREE.Vector3());
      if (F.step && !was[s]) steps++;
      if (F.locked && F.w > 0.99 && prev[s]) held = Math.max(held, ball.distanceTo(prev[s]));
      prev[s] = F.locked && F.w > 0.99 ? ball : null;
    }
    if (H._feet.l.step && H._feet.r.step) both++;
  }
  const facing = Math.abs(Math.atan2(Math.sin(npc.heading - Math.PI), Math.cos(npc.heading - Math.PI)));
  assert.ok(facing < 0.25, `turned round to face you (${facing.toFixed(2)} rad off)`);
  console.log(`  turn: ${steps} steps, facing ${facing.toFixed(2)}, held ${held.toFixed(4)}`);
  assert.ok(steps >= 2, `with steps (${steps})`);
  assert.equal(both, 0, 'one foot at a time');
  assert.ok(held < 0.004, `a planted foot holds still between steps (${held.toFixed(4)} m a frame)`);
});

test('animation by distance: every frame and planted feet near, every 2nd / 3rd frame further off, no feet', async () => {
  const { lib, human } = await loadAssets();
  const { scene, physics } = flat();
  const npc = new NPC(scene, physics, { route: [V(0, 0, 0), V(0, 0, 30)], cape: 0, lines: ['~neutral~ Hello.'], lib, human: human.m, kind: 'f' });
  npc.pause = 0;
  const camera = new THREE.PerspectiveCamera();
  const you = playerAt(V(60, 0, 0));
  let poses = 0, plants = 0;
  const pose = npc.animator.update.bind(npc.animator), plant = npc.humanoid.plantFeet.bind(npc.humanoid);
  npc.animator.update = (...a) => { poses++; return pose(...a); };
  npc.humanoid.plantFeet = (...a) => { plants++; return plant(...a); };
  const run = (d) => {
    poses = plants = 0;
    for (let i = 0; i < 60; i++) { camera.position.set(npc.pos.x + d, 2, npc.pos.z); npc.update(1 / 60, you, camera); }
    return { poses, plants };
  };
  const near = run(6), mid = run((NPC_DETAIL.every2 + NPC_DETAIL.every3) / 2), farther = run((NPC_DETAIL.every3 + NPC_DETAIL.quarter) / 2);
  assert.equal(near.poses, 60, 'near: posed every frame');
  assert.equal(near.plants, 60, 'near: feet planted every frame');
  assert.ok(Math.abs(mid.poses - 30) <= 1, `further: every 2nd frame (${mid.poses})`);
  assert.equal(mid.plants, 0, 'further: no foot planting');
  assert.ok(Math.abs(farther.poses - 20) <= 1, `further still: every 3rd frame (${farther.poses})`);
  // still walking smoothly: the body moves every frame
  const z0 = npc.pos.z;
  camera.position.set(npc.pos.x + 80, 2, npc.pos.z);
  npc.update(1 / 60, you, camera);
  assert.ok(npc.pos.z !== z0 && npc.object.position.z === npc.pos.z, 'the body moves every frame');
});

test('people side by side fall out of step: their own phase, stride and posture', async () => {
  const { lib, human } = await loadAssets();
  const { scene, physics } = flat();
  const a = new NPC(scene, physics, { route: [V(0, 0, 0), V(0, 0, 30)], cape: 0, lines: ['~neutral~ …'], lib, human: human.m, kind: 'm' });
  const b = new NPC(scene, physics, { route: [V(1, 0, 0), V(1, 0, 30)], cape: 0, lines: ['~neutral~ …'], lib, human: human.m, kind: 'm' });
  a.pause = b.pause = 0; a.speed = b.speed = 1.3;
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(10, 2, 0);
  const you = playerAt(V(60, 0, 0));
  for (let i = 0; i < 120; i++) { a.update(1 / 60, you, camera); b.update(1 / 60, you, camera); }
  const dp = Math.abs(a.animator.phase - b.animator.phase);
  assert.ok(Math.min(dp, 1 - dp) > 0.05, `not in step (${dp.toFixed(2)} of a cycle apart)`);
  assert.notEqual(a.gait.stride, b.gait.stride, 'their own stride');
  // the same person, the same gait
  const a2 = new NPC(scene, physics, { route: [V(0, 0, 0), V(0, 0, 30)], cape: 0, lines: ['~neutral~ …'], lib, human: human.m, kind: 'm' });
  assert.deepEqual(a2.gait, a.gait, 'seeded by who they are');
});

test('a far body draws a simpler skinned mesh: same skeleton, weights kept, it bends with the bones; up close the full one', async () => {
  const { human } = await loadAssets();
  const char = buildCharacter(), H = new Humanoid(human.m, char, 'm', { build: 'broad' });
  H.update();
  const lod = (H.lod = new SkinnedLod(H, { sync: true }));
  const body = H.body, full = body.geometry, skeleton = body.skeleton;
  const PX = 1000;   // pixels per radian (a 1600 x 900 view)
  assert.equal(lod.update(3, 1, PX, 1), -Infinity, 'close up: full detail');
  assert.equal(body.geometry, full);
  assert.ok(H.eyeMesh.visible && H.browMesh.visible, 'the eyes and brows shown');
  const j = lod.update(70, 1, PX, 1);
  assert.ok(j > -Infinity, `far: a level (${j})`);
  const g = body.geometry;
  assert.notEqual(g, full);
  assert.ok(triCount(g) < triCount(full) * 0.6, `fewer triangles (${triCount(full)} -> ${triCount(g)})`);
  assert.equal(body.skeleton, skeleton, 'the same skeleton');
  assert.ok(g.attributes.skinIndex && g.attributes.skinWeight, 'skin weights kept');
  const SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, nb = skeleton.bones.length;
  for (let i = 0; i < SI.count; i++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) { sum += SW.getComponent(i, k); assert.ok(SI.getComponent(i, k) < nb); }
    assert.ok(Math.abs(sum - 1) < 0.02, 'weights add up');
  }
  assert.ok(!H.eyeMesh.visible, 'the eyes, under half a pixel, hidden');
  // bend the body: the simplified skin follows the bones, close to the full skin everywhere
  char.legs[0].rotation.x = 0.9; char.knees[0].rotation.x = 1.1; char.arms[1].rotation.set(-1.2, 0, 0.4); char.elbows[1].rotation.x = -1.3; char.torso.rotation.set(0.3, 0.5, 0);
  H.update();
  body.skeleton.update();
  const cell = 2 ** j;
  const pts = (geo) => { const out = []; const m = body.geometry; body.geometry = geo; for (let i = 0; i < geo.attributes.position.count; i += 3) out.push(body.getVertexPosition(i, new THREE.Vector3())); body.geometry = m; return out; };
  const fine = pts(full), coarse = pts(g);
  let worst = 0;
  for (const p of coarse) { let d = Infinity; for (const q of fine) d = Math.min(d, p.distanceToSquared(q)); worst = Math.max(worst, Math.sqrt(d)); }
  console.log(`  lod: ${triCount(full)} -> ${triCount(g)} tris at cell ${cell}, worst ${worst.toFixed(3)} m`);
  assert.ok(worst < cell * 2.5, `posed, every vertex near the full skin (${worst.toFixed(3)} m, cell ${cell})`);
  // anything reshaping the body first puts the full meshes back; the build's shape is made from the original
  const base = body.userData.baseGeometry ?? full;
  H.setBuild('heavy');
  assert.equal(body.userData.baseGeometry ?? base, base, 'the build is shaped from the full mesh, not a level');
  assert.ok(H.eyeMesh.visible, 'the face back');
  lod.update(70, 1, PX, 1);
  assert.notEqual(body.geometry, H.body.userData.baseGeometry, 'and a level of the new shape far off');
  lod.reset();
  assert.ok(triCount(body.geometry) > triCount(g), 'reset: full again');
  assert.equal(SKIN_LOD.min < SKIN_LOD.max, true);
});
