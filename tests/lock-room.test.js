// The lock camera with his back to a wall (issue #256, the combat review v1.61: in the Undertower's antechamber and the
// First Sign's Hall the traveller was off the screen 23-45 % of the time): the lock held the camera on the line to the
// foe, so the wall behind him crushed the arm to 0.1-0.4 m. Now the line yields (CameraRig.lockRoom, LOCK_ROOM): turned
// off it toward the side with room, the view turned toward the foe so the two stand in the frame together. And in the
// open, a thin thing between him and the lens is looked past (THIN_PAST, issue #259: desert-open's cactus). The real rig
// through the real collision, the lock's turn as main.js runs it (src/foes.js lockTurn).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { CameraRig, LOCK_ROOM, OPEN_DIST } from '../src/player.js';
import { lockTurn } from '../src/foes.js';

globalThis.window ??= { addEventListener() {} };
const dom = { addEventListener() {} };
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const dt = 1 / 60;

const scene = (...boxes) => {
  const s = new THREE.Scene();
  for (const [x, y, z, sx, sy, sz] of boxes) { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz)); m.position.set(x, y, z); s.add(m); }
  s.updateMatrixWorld(true);
  return new Physics(s);
};
/** A room `w` (x) by `d` (z) m, `h` high, walls 0.5 m thick, centred on the origin. */
const room = (w, d, h) => scene([0, -0.5, 0, w + 2, 1, d + 2], [0, h + 0.25, 0, w + 2, 0.5, d + 2],
  [w / 2 + 0.25, h / 2, 0, 0.5, h, d + 2], [-w / 2 - 0.25, h / 2, 0, 0.5, h, d + 2], [0, h / 2, d / 2 + 0.25, w + 2, h, 0.5], [0, h / 2, -d / 2 - 0.25, w + 2, h, 0.5]);

/**
 * Locked on to a foe at `foe` (its chest 0.5 m up), the traveller moved by `path(t)` for `T` s, the lock turning the camera
 * as main.js does (`yields`: the line yields, as now; else held on it, as before). The share of frames (after `from` s)
 * with his head or chest off the screen, with the foe off it, the shortest arm then, and the most the lens moved in a frame.
 */
function lockWalk(physics, foe, path, T, { yields = true, from = 1.5 } = {}) {
  const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000), rig = new CameraRig(cam, dom, physics);
  let p = path(0), vel = 0, lineP = null, turn = 0;
  rig.yaw = Math.atan2(p.x - foe.x, p.z - foe.z);
  rig.locked = yields; rig.lockAt = yields ? v(foe.x, 0.5, foe.z) : null;
  for (let i = 0; i < 30; i++) rig.update(p, dt);
  let out = 0, foeOut = 0, n = 0, arm = Infinity, step = 0;
  const off = (q) => { const a = q.clone().project(cam); return a.z > 1 || Math.abs(a.x) > 1 || Math.abs(a.y) > 1; };
  const prev = cam.position.clone();
  for (let t = 0; t < T; t += dt) {
    p = path(t);
    // (main.js: the line from the foe through him, how fast it turns, the lock's turn eased after it, LOCK_TURN)
    const base = Math.atan2(p.x - foe.x, p.z - foe.z);
    if (lineP != null) turn += (Math.atan2(Math.sin(base - lineP), Math.cos(base - lineP)) / dt - turn) * (1 - Math.exp(-4 * dt));
    lineP = base;
    const line = base + (yields ? rig.lockRoom(dt, base, Math.hypot(foe.x - p.x, foe.z - p.z), 0, 0.6, turn) : 0);
    const da = Math.atan2(Math.sin(line - rig.yaw), Math.cos(line - rig.yaw));
    vel = lockTurn(da, vel, 6, dt); rig.yaw += vel * dt;
    rig.update(p, dt);
    cam.updateMatrixWorld(true);
    if (t > from) {
      n++;
      if (off(p.clone().add(v(0, 1.6, 0))) || off(p.clone().add(v(0, 1.1, 0)))) out++;
      if (off(v(foe.x, 0.5, foe.z))) foeOut++;
      arm = Math.min(arm, rig._curDist);
      step = Math.max(step, cam.position.distanceTo(prev));
    }
    prev.copy(cam.position);
  }
  return { out: out / n, foeOut: foeOut / n, arm, step };
}
const still = (x, z) => () => v(x, 0, z);
const pct = (x) => `${(x * 100).toFixed(1)} %`;

// the Undertower's antechamber's size (8.8 m across): a blot 2.6 m off, his back flat to the wall behind (0.6 m from his
// axis: as in the camera QC's ante-lock, where it starts)
const ante = () => room(8.8, 6.4, 8.5);

test('his back flat to a wall, the line held (before #256): the arm crushed to his back', () => {
  const r = lockWalk(ante(), v(0, 0, 0), still(0, 2.6), 4, { yields: false });
  assert.ok(r.arm < 0.5, `the arm crushed (${r.arm.toFixed(2)} m)`);
});

test('his back flat to a wall, the line yields: the camera off to the side with room, he and the blot both on the screen', () => {
  const r = lockWalk(ante(), v(0, 0, 0), still(0, 2.6), 4);
  assert.equal(r.out, 0, `the traveller on the screen (${pct(r.out)} off)`);
  assert.equal(r.foeOut, 0, `the blot on the screen (${pct(r.foeOut)} off)`);
  assert.ok(r.arm >= LOCK_ROOM.min - 0.05, `the arm has room (${r.arm.toFixed(2)} m)`);
});

test('his back flat to a hall\'s wall, a guardian 19 m off: the camera along the wall, him on the screen, the arm long', () => {
  const r = lockWalk(room(40, 39.2, 20), v(0, 0, 0), still(0, 19), 4);
  assert.equal(r.out, 0, `the traveller on the screen (${pct(r.out)} off)`);
  assert.ok(r.arm > 1.5, `the arm has room (${r.arm.toFixed(2)} m)`);
});

test('strafing round a blot in a small room into its wall, locked on: he stays on the screen, the camera never jumps', () => {
  // (round the blot at 2.6 m, the room's wall cutting the circle: he slides along it, as the camera QC's ante-lock)
  const circle = (t) => { const a = -0.6 + (0.6 * 1.6 / 2.6) * t; return v(Math.max(-2.65, Math.min(2.65, Math.sin(a) * 2.6)), 0, Math.cos(a) * 2.6); };
  const held = lockWalk(room(6.2, 12, 8.5), v(0, 0, 0), circle, 8, { yields: false, from: 0.5 });
  const r = lockWalk(room(6.2, 12, 8.5), v(0, 0, 0), circle, 8, { from: 0.5 });
  assert.ok(held.out > 0.05, `before, off the screen at the wall (${pct(held.out)})`);
  assert.equal(r.out, 0, `the traveller on the screen (${pct(r.out)} off)`);
  assert.ok(r.arm > 1, `the arm never crushed (${r.arm.toFixed(2)} m)`);
  assert.ok(r.step < 0.15, `no jump (${r.step.toFixed(3)} m in a frame at most)`);
});

test('locked on in the open the line does not yield: the camera stays on it', () => {
  const r = lockWalk(room(80, 80, 30), v(0, 0, 0), still(0, 6), 3);
  const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000), rig = new CameraRig(cam, dom, room(80, 80, 30));
  rig.locked = true; rig.yaw = 0;
  for (let i = 0; i < 120; i++) { rig.lockRoom(dt, 0, 6); rig.update(v(0, 0, 6), dt); }
  assert.equal(rig.lockOff, 0);
  assert.equal(r.out + r.foeOut, 0);
});

test('in the open a thin thing between him and the lens is looked past; a wall still brings the arm in (#259)', () => {
  // (running past a cactus's trunk turning the camera: it cut the arm 4.8 -> 1.5 m in a frame, desert-open)
  const at = (physics) => {
    const rig = new CameraRig(new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000), dom, physics);
    rig.yaw = 0;   // (the camera toward +z of him)
    for (let i = 0; i < 90; i++) rig.update(v(0, 0, 0), dt);
    return rig._curDist;
  };
  const ground = [0, -0.5, 0, 200, 1, 200];
  assert.ok(Math.abs(at(scene(ground)) - OPEN_DIST) < 0.05, 'the open arm');
  assert.ok(Math.abs(at(scene(ground, [0, 2, 2.2, 0.8, 4, 0.8])) - OPEN_DIST) < 0.05, 'past a trunk 0.8 m thick, 2.2 m behind him');
  assert.ok(at(scene(ground, [0, 3, 2.6, 12, 6, 2.5])) < 2.6, 'a wall 2.5 m thick behind him still cuts it');
});
