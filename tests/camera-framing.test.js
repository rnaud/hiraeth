// The follow camera's framing (v0.82, docs/systems/movement-and-camera.md): Ocarina of Time's in the
// open, Uncharted's over-the-shoulder close in (the shoulder with room, never swapping jumpily), a
// further-back arm in a hall, smooth blends between them, and the wider arms of the glide and the jets.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { CameraRig, hallness, OPEN_DIST, OPEN_LOOK, OPEN_PITCH, TIGHT_DIST, HALL_DIST, JET } from '../src/player.js';

globalThis.window ??= { addEventListener() {} };
const dom = { addEventListener() {} };
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const dt = 1 / 60;

const blockScene = (...boxes) => {
  const scene = new THREE.Scene();
  for (const [x, y, z, w, h, d] of boxes) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y, z); scene.add(m); }
  return new Physics(scene);
};
const rigIn = (physics, yaw = -Math.PI / 2) => {
  const rig = new CameraRig(new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000), dom, physics);
  rig.yaw = yaw;   // -π/2: behind a traveller walking +x (the camera's right is +z)
  return rig;
};
/** the traveller's height in the frame (0..1) and where his feet and head are (0 top .. 1 bottom) */
function framing(rig, p) {
  const cam = rig.camera;
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const a = p.clone().project(cam), b = p.clone().add(v(0, 1.8, 0)).project(cam);
  return { height: (b.y - a.y) / 2, feet: 0.5 - a.y / 2, head: 0.5 - b.y / 2, x: (a.x + b.x) / 4 + 0.5 };
}

test('open ground: the Ocarina framing (closer and lower than before, the traveller a quarter of the frame, in its lower middle)', () => {
  const rig = rigIn(blockScene([0, -0.5, 0, 400, 1, 400]));
  const p = v(0, 0, 0);
  for (let i = 0; i < 120; i++) rig.update(p, dt);
  assert.equal(rig.pitch, OPEN_PITCH);
  assert.equal(JET.level, OPEN_PITCH, 'the jets fly level at the default look');
  const c = rig.camera.position, f = framing(rig, p);
  assert.ok(Math.abs(c.distanceTo(rig._look) - OPEN_DIST) < 0.05);
  assert.ok(OPEN_DIST < 7.5, 'closer than the 9.5 m arm it had');
  assert.ok(c.y > 2.4 && c.y < 3.4, `the camera a little over the head (${c.y.toFixed(2)} m)`);
  assert.ok(Math.abs(rig._look.y - OPEN_LOOK) < 0.01);
  assert.ok(f.height > 0.22 && f.height < 0.3, `a quarter of the frame's height (${f.height.toFixed(3)})`);
  assert.ok(f.head > 0.5 && f.feet > 0.75 && f.feet < 0.9, `in the lower middle (head ${f.head.toFixed(2)}, feet ${f.feet.toFixed(2)})`);
  assert.ok(Math.abs(f.x - 0.5) < 0.01, 'centred');
  // the player's zoom still works, round the new default
  rig.zoom(2); assert.ok(Math.abs(rig.dist - 2 * OPEN_DIST) < 1e-9);
  rig.zoom(0.01); assert.equal(rig.dist, 3);
  rig.zoom(1e3); assert.equal(rig.dist, 60);
});

test('hallness: a corridor and a cabin are not halls; the giant\'s chest is', () => {
  const I = Infinity;
  assert.equal(hallness({ ceil: 1.6, ring: [I, 1.2, 1.3, 1.2, I, 1.2, 1.3, 1.2] }), 0, 'a corridor');
  assert.equal(hallness({ ceil: 2.8, ring: [15.6, 5.6, 2, 2.3, I, 2.3, 5.7, 5.6] }), 0, 'the ship');
  assert.equal(hallness({ ceil: 16, ring: [I, 3, 2.5, 3, I, 3, 2.5, 3] }), 0, 'a narrow cave passage, however high');
  assert.ok(hallness({ ceil: 16.7, ring: [25.9, 20, 8.6, 3.7, 2.9, 3.7, 8.6, 19.4] }) > 0.7, 'the giant\'s chest, a wall behind');
  assert.ok(hallness({ ceil: 18, ring: [30, 30, 30, 30, 30, 30, 30, 30] }) > 0.99, 'a great dome');
});

// a corridor along x (from x = 20 to 120): 4 m wide, a 3 m roof
const corridor = (...extra) => blockScene(
  [0, -0.5, 0, 400, 1, 400],
  [70, 1.5, 2.2, 100, 3, 0.4], [70, 1.5, -2.2, 100, 3, 0.4], [70, 3.2, 0, 100, 0.4, 4.8],
  ...extra,
);

test('close in: over the shoulder on the side with room, ~2 m back at shoulder height; the shoulder holds along a corridor', () => {
  for (const [z, side] of [[1.1, -1], [-1.1, 1], [0, 1]]) {   // beside the +z wall (the camera's right), the -z wall, the middle
    const rig = rigIn(corridor());
    const p = v(60, 0, z);
    rig.update(p, dt);   // (the first frame is a jump: placed in the corridor)
    for (let i = 0; i < 180; i++) rig.update(p, dt);
    assert.ok(rig.tightK > 0.95, 'tight in the corridor');
    assert.equal(rig.shoulder, side, `walking ${z > 0 ? 'beside the right wall' : z < 0 ? 'beside the left wall' : 'down the middle'}: over the ${side > 0 ? 'right' : 'left'} shoulder`);
    const c = rig.camera.position;
    assert.ok(Math.abs(c.distanceTo(rig._look) - TIGHT_DIST) < 0.15, `about ${TIGHT_DIST} m back (${c.distanceTo(rig._look).toFixed(2)})`);
    assert.ok(c.y > 1.4 && c.y < 2.1, `at the shoulders' height (${c.y.toFixed(2)} m)`);
    assert.ok(Math.abs(c.z) < 2.0 - 0.3, `inside the corridor (${c.z.toFixed(2)})`);
    const f = framing(rig, p);
    assert.ok(f.height > 0.6, `big in the frame (${f.height.toFixed(2)})`);
    if (side) assert.ok((f.x - 0.5) * -side > 0.05, `to one side of the frame, away from the camera's shoulder (${f.x.toFixed(2)})`);
  }
  // walk the corridor beside the right wall, weaving a little: the shoulder never swaps
  const rig = rigIn(corridor());
  const p = v(25, 0, 1.1);
  rig.update(p, dt);
  let swaps = 0, last = rig.shoulder;
  for (let i = 0; i < 20 * 60; i++) {
    p.x += 4 * dt; p.z = 1.1 - 0.35 * (1 + Math.sin(i * dt * 1.3));
    rig.update(p, dt);
    if (rig.shoulder !== last) { swaps++; last = rig.shoulder; }
  }
  assert.equal(swaps, 0, 'no swaps walking down the corridor');
});

test('the shoulder swaps only for good reason, and slides across without a jump', () => {
  // walking down the middle, the right shoulder; then a wall closes in on the right (a pillar row): it swaps once, smoothly
  const rig = rigIn(corridor([90, 1.5, 0.45, 30, 3, 0.4]));   // from x = 75 to 105, a wall 0.65 m right of the traveller
  const p = v(40, 0, -0.4);
  rig.update(p, dt);
  for (let i = 0; i < 60; i++) rig.update(p, dt);
  assert.equal(rig.shoulder, 1);
  let swaps = 0, last = rig.shoulder, jump = 0;
  const prev = rig._look.clone(), prevCam = rig.camera.position.clone();
  for (let i = 0; i < 18 * 60; i++) {
    p.x += 4 * dt;
    rig.update(p, dt);
    if (rig.shoulder !== last) { swaps++; last = rig.shoulder; }
    // how far the look point and the camera moved beyond the traveller's own step
    jump = Math.max(jump, rig._look.distanceTo(prev) - 4 * dt, rig.camera.position.distanceTo(prevCam) - 4 * dt);
    prev.copy(rig._look); prevCam.copy(rig.camera.position);
    if (p.x > 78 && p.x < 104) assert.ok(rig.camera.position.z < 0.25 - 0.2, `never past the wall (${rig.camera.position.z.toFixed(2)})`);
  }
  assert.ok(swaps <= 2, `swapped ${swaps} times (to the left past the wall, and back after it at most)`);
  assert.ok(swaps >= 1, 'it did go over the other shoulder by the wall');
  assert.ok(jump < 0.12, `no jump in the view (${jump.toFixed(3)} m beyond the step in a frame)`);
});

test('in and out of a closed space the blend is smooth: no snap of the camera, in or out', () => {
  const rig = rigIn(corridor());
  const p = v(0, 0, 0);
  for (let i = 0; i < 120; i++) rig.update(p, dt);
  const prev = rig.camera.position.clone();
  let jump = 0;
  const walk = (vx, frames) => {
    for (let i = 0; i < frames; i++) {
      p.x += vx * dt; rig.update(p, dt);
      jump = Math.max(jump, rig.camera.position.distanceTo(prev) - Math.abs(vx) * dt);
      prev.copy(rig.camera.position);
    }
  };
  walk(4, 15 * 60);    // in, to x = 60
  assert.ok(rig.tightK > 0.95);
  rig.yaw = Math.PI / 2;
  rig.update(p, dt); prev.copy(rig.camera.position);
  walk(-4, 15 * 60);   // and out into the open
  assert.ok(rig.tightK < 0.05);
  // (going in, the arm comes in front of the mouth's lintel as it passes: the line-of-sight snap, kept small by the eased blend)
  assert.ok(jump < 0.35, `the camera never leaps (${jump.toFixed(3)} m beyond the step in a frame)`);
});

test('a hall: the close arm stands further back', () => {
  // a dome-like hall 40 m across, 16 m high
  const physics = blockScene([0, -0.5, 0, 400, 1, 400], [0, 8, 20, 40, 16, 0.5], [0, 8, -20, 40, 16, 0.5], [20, 8, 0, 0.5, 16, 40], [-20, 8, 0, 0.5, 16, 40], [0, 16.2, 0, 40, 0.4, 40]);
  const rig = rigIn(physics);
  const p = v(0, 0, 0);
  rig.target.copy(p);
  rig.update(p, dt);
  for (let i = 0; i < 6 * 60; i++) rig.update(p, dt);
  assert.ok(rig.tightK > 0.95, 'enclosed');
  assert.ok(rig.hallK > 0.9, `a hall (${rig.hallK.toFixed(2)})`);
  assert.ok(Math.abs(rig.armLength() - HALL_DIST) < 0.1, `the arm ${rig.armLength().toFixed(2)} m`);
});

test('aiming close in is over the right shoulder; the glide and the jets stand the camera back', () => {
  const rig = rigIn(corridor());
  const p = v(60, 0, 1.1);   // beside the right wall: the left shoulder
  rig.update(p, dt);
  for (let i = 0; i < 60; i++) rig.update(p, dt);
  assert.equal(rig.shoulder, -1);
  rig.aimK = 1;
  for (let i = 0; i < 90; i++) rig.update(p, dt);
  assert.equal(rig.shoulder, 1, 'aiming: the right');
  assert.ok(rig.camera.position.z < 2 - 0.25 && rig.camera.position.z > -2 + 0.25, 'and inside the corridor still');
  // in the open: the jets and the glide want a longer arm, eased; a tap of the jets doesn't pump it
  const open = rigIn(blockScene([0, -0.5, 0, 400, 1, 400]));
  const q = v(0, 0, 0);
  for (let i = 0; i < 60; i++) { open.follow(0, dt, false, null, 0); open.update(q, dt); }
  const base = open.armLength();
  for (let i = 0; i < 4 * 60; i++) { open.follow(0, dt, false, null, i % 40 < 20 ? 3.5 : 0); open.update(q, dt); }
  assert.ok(open.armLength() > base + 3, `the jets: further back (${open.armLength().toFixed(2)})`);
  let last = open.armLength(), step = 0;
  for (let i = 0; i < 4 * 60; i++) { open.follow(0, dt, true, null, 7); open.update(q, dt); step = Math.max(step, Math.abs(open.armLength() - last)); last = open.armLength(); }
  assert.ok(open.armLength() > OPEN_DIST + 6, `gliding: further still (${open.armLength().toFixed(2)})`);
  assert.ok(step < 0.25, 'eased');
});
