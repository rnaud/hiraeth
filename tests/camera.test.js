import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { CameraRig, tightness, OPEN_DIST, TIGHT_DIST } from '../src/player.js';
import { buildRoom, inTightRoom } from '../src/interiors.js';

// the rig listens to the mouse and the wheel: inert stand-ins in node
globalThis.window ??= { addEventListener() {} };
const dom = { addEventListener() {} };
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const blockScene = (...boxes) => {
  const scene = new THREE.Scene();
  for (const [x, y, z, w, h, d] of boxes) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y, z); scene.add(m); }
  return { scene, physics: new Physics(scene) };
};

// open ground round the origin; a low, narrow tunnel from x = 30 to x = 70 (2.6 m wide, 3 m high)
const world = () => blockScene(
  [0, -0.5, 0, 400, 1, 400],
  [50, 1.5, 1.6, 40, 3, 0.4], [50, 1.5, -1.6, 40, 3, 0.4],   // walls
  [50, 3.2, 0, 40, 0.4, 3.6],                                 // roof
);

function rigIn(physics) {
  const camera = new THREE.PerspectiveCamera(55, 1.5, 0.3, 5000);
  const rig = new CameraRig(camera, dom, physics);
  rig.yaw = -Math.PI / 2;   // the camera behind a traveller walking +x
  return rig;
}
/** The arm: from the look point to the camera. */
const arm = (rig) => rig.camera.position.distanceTo(rig._look);

test('tightness: open ground, a lone wall, an alley, a low ceiling, a room, a dome', () => {
  const I = Infinity, ring = (...d) => d;
  assert.equal(tightness({ ceil: I, ring: ring(I, I, I, I, I, I, I, I), up: [I, I, I, I] }), 0, 'open ground');
  assert.ok(tightness({ ceil: I, ring: ring(1, 1.4, I, I, I, I, I, 1.4), up: [I, I, I, I] }) < 0.05, 'beside one wall is still open');
  assert.ok(tightness({ ceil: I, ring: ring(I, 2.1, 1.5, 2.1, I, 2.1, 1.5, 2.1), up: [I, I, I, I] }) >= 0.75, 'an alley under the sky');
  assert.ok(tightness({ ceil: 8, ring: ring(I, 9, 7.5, 9, I, 9, 7.5, 9), up: [I, I, I, I] }) < 0.2, 'a wide street with an arch high over it');
  assert.ok(tightness({ ceil: 1.4, ring: ring(I, I, I, I, I, I, I, I), up: [I, I, I, I] }) > 0.7, 'under a low ceiling');
  assert.equal(tightness({ ceil: 2.5, ring: ring(4, 4.6, 3.5, 4.6, 4, 4.6, 3.5, 4.6), up: [6, 6, 6, 6] }), 1, 'a small room');
  assert.equal(tightness({ ceil: 18, ring: ring(30, 30, 30, 30, 30, 30, 30, 30), up: [32, 32, 32, 32] }), 1, 'inside a big dome (the giant\'s chest)');
  // (measured in the desert's cave: its way in, and gaps round the pool, let three rays out)
  assert.equal(tightness({ ceil: 11.8, ring: ring(17.9, 10.8, 20.8, I, I, I, 20.8, 10.8), up: [8.4, 14.4, 25, 14.4] }), 1, 'the cave, with its way in open');
  assert.ok(tightness({ ceil: 14, ring: ring(20, 30, 25, I, 18, 30, 25, 33), up: [I, 40, I, I] }) < 0.05, 'a forest: trunks round about, gaps in the canopy');
});

test('the rig comes in close in a tight tunnel, never clips its walls, and goes back out in the open', () => {
  const { physics } = world();
  const rig = rigIn(physics);
  const p = v(0, 0, 0), dt = 1 / 60;
  const step = (secs, vx = 0) => { for (let i = 0; i < secs * 60; i++) { p.x += vx * dt; rig.update(p, dt); } };
  step(2);
  assert.ok(Math.abs(arm(rig) - OPEN_DIST) < 0.3, `open: the full arm (${arm(rig).toFixed(2)} m)`);
  assert.ok(rig.tightK < 0.02, `open: not tight (${rig.tightK.toFixed(2)})`);
  // walk in at a jog and on to the middle of the tunnel
  let goals = 0, lastGoal = rig.tightGoal;
  for (let i = 0; i < 12 * 60; i++) {
    p.x = Math.min(50, p.x + 4 * dt);
    rig.update(p, dt);
    if (rig.tightGoal !== lastGoal) { goals++; lastGoal = rig.tightGoal; }
    if (p.x > 33) {
      const c = rig.camera.position;
      if (c.x > 30.2) assert.ok(Math.abs(c.z) < 1.4 - 0.2 && c.y < 3 - 0.2 && c.y > 0.2, `inside the tunnel and clear of its walls: ${c.toArray().map((n) => n.toFixed(2))}`);
    }
  }
  assert.ok(rig.tightK > 0.95, `tight in the tunnel (${rig.tightK.toFixed(2)})`);
  assert.ok(Math.abs(rig.armLength() - TIGHT_DIST) < 0.05, `the arm wants ${TIGHT_DIST} m (${rig.armLength().toFixed(2)})`);
  assert.ok(arm(rig) < TIGHT_DIST + 0.1 && arm(rig) > 1.2, `close over the shoulder (${arm(rig).toFixed(2)} m)`);
  assert.ok(goals <= 6, `the goal settles instead of flickering (${goals} changes)`);
  // off to the right of the traveller (over the right shoulder): the look point is beside the head
  const toLook = rig._look.clone().sub(p);
  assert.ok(Math.abs(toLook.z) > 0.2, `the look point sits off the shoulder (${toLook.z.toFixed(2)})`);
  // standing still in there: the goal holds (no jitter)
  goals = 0; lastGoal = rig.tightGoal;
  for (let i = 0; i < 5 * 60; i++) { rig.update(p, dt); if (rig.tightGoal !== lastGoal) { goals++; lastGoal = rig.tightGoal; } }
  assert.equal(goals, 0, 'standing still, the goal never moves');
  // walk back out, past the mouth, into the open
  rig.yaw = Math.PI / 2;
  const before = [];
  for (let i = 0; i < 14 * 60; i++) { p.x = Math.max(0, p.x - 4 * dt); rig.update(p, dt); before.push(arm(rig)); }
  step(4);
  assert.ok(rig.tightK < 0.05, `open again (${rig.tightK.toFixed(2)})`);
  assert.ok(Math.abs(arm(rig) - OPEN_DIST) < 0.3, `the full arm again (${arm(rig).toFixed(2)} m)`);
  // and it eased out: no frame-to-frame leap outward
  let leap = 0;
  for (let i = 1; i < before.length; i++) leap = Math.max(leap, before[i] - before[i - 1]);
  assert.ok(leap < 0.25, `eases back out (largest step ${leap.toFixed(3)} m per frame)`);
});

test('the ship flag and the interiors make it tight at once; a short gap between walls does not let go', () => {
  const { physics } = world();
  const rig = rigIn(physics);
  const p = v(0, 0, -60), dt = 1 / 60;
  for (let i = 0; i < 60; i++) rig.update(p, dt);
  rig.indoor = true;
  for (let i = 0; i < 90; i++) rig.update(p, dt);
  assert.ok(rig.tightK > 0.95, 'indoor (the ship sets it) is tight');
  rig.indoor = false;
  // a brief open patch (0.4 s) does not throw the camera back out
  for (let i = 0; i < 24; i++) rig.update(p, dt);
  assert.equal(rig.tightGoal, 1, 'held through a short gap');
  for (let i = 0; i < 4 * 60; i++) rig.update(p, dt);
  assert.ok(rig.tightK < 0.1, `then lets go (${rig.tightK.toFixed(2)})`);
  // a room from src/interiors.js is flagged tight, even standing where the probes might miss it
  const scene = new THREE.Scene();
  const room = buildRoom(scene, { pos: v(200, 50, 0), w: 14, d: 12, h: 6 });
  assert.equal(room.tight, true);
  assert.ok(inTightRoom(room.inside) && !inTightRoom(v(200, 50, 30)) && !inTightRoom(v(0, 0, 0)));
  // stepping through a portal (a jump) lands in the tight framing straight away
  p.copy(room.inside);
  rig.update(p, dt);
  assert.equal(rig.tightK, 1, 'a teleport into a room snaps to tight');
  scene.remove(room.group);
  assert.ok(!inTightRoom(room.inside), 'a room removed from its scene no longer counts');
});

test('riding wants room: the bike is never framed tight by the probes', () => {
  const { physics } = world();
  const rig = rigIn(physics);
  const p = v(50, 0, 0), dt = 1 / 60;
  for (let i = 0; i < 3 * 60; i++) { rig.follow(0, dt, true); rig.update(p, dt); }
  assert.ok(rig.tightK < 0.05, `riding in the tunnel: not tight (${rig.tightK.toFixed(2)})`);
});
