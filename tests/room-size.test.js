// Issue #195, the author: "Most of the temple rooms are too small and so is the ship and it's interior. I want rooms to
// feel bigger so the camera doesn't move and shake every time we are in a cramped space." The rooms' floors (the
// antechambers before the guardians, the ship's rooms) and the close camera in a small room: it settles, it doesn't shake.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { CameraRig, roomFit, ROOM_FIT, TIGHT_DIST } from '../src/player.js';
import { TempleKit, ANTE } from '../src/temples/kit.js';
import { CEIL, WALL_IN, HALF_W, LENGTH, HATCH } from '../src/ship/hull.js';
import { ROOMS, DOORWAY, FRAME_HALF, ALCOVE } from '../src/ship/interior.js';
import { Ship } from '../src/ship/ship.js';
import { walk } from '../scripts/camera-qc/sim.mjs';
import { analyse } from '../scripts/camera-qc/lib.mjs';

globalThis.window ??= { addEventListener() {} };
const dom = { addEventListener() {} };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const box = (w, h, d, x, y, z) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(x, y, z));

/** The room round a point: the narrowest and widest width across at chest height (16 rays), the ceiling over it. */
function measure(physics, p) {
  const chest = p.clone().add(V(0, 1.2, 0)), d = [];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; d.push(Math.min(60, physics.rayDistance(chest, V(Math.sin(a), 0, Math.cos(a)), 60))); }
  const w = [];
  for (let i = 0; i < 8; i++) w.push(d[i] + d[i + 8]);
  return { narrow: Math.min(...w), wide: Math.max(...w), ceil: physics.rayDistance(p.clone().add(V(0, 0.3, 0)), V(0, 1, 0), 60) + 0.3 };
}

test('the antechamber before a guardian (every house that has one): a vestibule nearly 9 m across, 7.4 m deep and 8.5 m high', () => {
  const scene = new THREE.Scene(), root = new THREE.Group();
  scene.add(root);
  const mat = new THREE.MeshBasicMaterial(), M = new Proxy({}, { get: () => mat });
  const K = new TempleKit(root, 'test vestibule', V(), 0, M);
  // (the hall before it, its end wall with the door; the round hall's wall after it)
  K.wall(-13, 0, 13, 0, 0, 14, { t: 1.2, holes: [{ at: 13, w: 5, h: 6.4 }] });
  const end = K.vestibule(0, 0);
  K.wall(-13, end + 0.6, 13, end + 0.6, 0, 14, { t: 1.2, holes: [{ at: 13, w: 5, h: 6 }] });
  K.flush();
  assert.equal(end, ANTE.len);
  const physics = new Physics(scene);
  const room = measure(physics, V(0, 0, end / 2));
  assert.ok(room.narrow > 2 * ANTE.half - 1.2 && room.narrow >= 7.4, `across: ${room.narrow.toFixed(2)} m (it was 5.6)`);
  assert.ok(room.ceil >= ANTE.h - 0.05, `its ceiling ${room.ceil.toFixed(2)} m (it was 7)`);
  assert.ok(ANTE.len >= 7 && ANTE.half >= 4.2 && ANTE.h >= 8, 'the size it was given');
  assert.ok(Math.abs(physics.groundAt(0, 2, end / 2, 4)) < 1e-4, 'its floor at the door\'s height');
});

test('the ship\'s rooms (issue #195): wider, higher and longer, its doorways wide, the hull grown round them', () => {
  assert.ok(CEIL >= 2.85, `the ceiling ${CEIL} m (2.35 before)`);
  assert.ok(WALL_IN * 2 >= 7.5 && HALF_W - WALL_IN >= 0.35, `the rooms ${WALL_IN * 2} m across (6.4 before), the hull round them`);
  assert.ok(DOORWAY.half * 2 >= 2 && DOORWAY.h >= 2.55, `the doorways ${DOORWAY.half * 2} x ${DOORWAY.h} m (1.6 x 2.28 before)`);
  assert.ok(FRAME_HALF * 2 >= 3.6 && HATCH.z1 - HATCH.z0 >= 1.5 && HATCH.y1 >= 2.5, 'the cockpit frame and the hatch');
  const depth = Object.fromEntries(Object.entries(ROOMS).map(([k, r]) => [k, r.z1 - r.z0]));
  assert.ok(depth.cockpit >= 2.9 && depth.main >= 10 && depth.cabin >= 4.7 && depth.hold >= 4.9, `the rooms' depths ${JSON.stringify(depth)}`);
  assert.ok(ALCOVE.top >= 2.3 && WALL_IN - ALCOVE.x >= 1.15, 'the bunk\'s alcove');
  assert.ok(LENGTH >= 25 && LENGTH <= 27, `the hull ${LENGTH} m long`);
  // measured in the built ship: the middle of each room, across and up
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: V(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } } }));
  const m = ship.parked;
  for (const [name, [x, z, across]] of Object.entries({ main: [-1.9, -0.2, 6], cabin: [0, 3.45, 5], hold: [0, 8.6, 6] })) {
    const r = measure(physics, ship.world(m, V(x, 0, z)));
    assert.ok(r.ceil >= 2.8, `${name}: the ceiling ${r.ceil.toFixed(2)} m`);
    assert.ok(r.narrow >= across - 1e-6 || r.wide >= across + 1, `${name}: ${r.narrow.toFixed(2)} x ${r.wide.toFixed(2)} m across`);
  }
});

/** A small room: 4.2 x 5 m, 2.6 m under its ceiling, walled all round, a table in one corner. */
function cabin() {
  const scene = new THREE.Scene(), W = 4.2, D = 5, H = 2.6, t = 0.2;
  for (const m of [box(W + 2 * t, t, D + 2 * t, 0, -t / 2, 0), box(W + 2 * t, t, D + 2 * t, 0, H + t / 2, 0), box(t, H, D, -W / 2 - t / 2, H / 2, 0), box(t, H, D, W / 2 + t / 2, H / 2, 0),
    box(W, H, t, 0, H / 2, -D / 2 - t / 2), box(W, H, t, 0, H / 2, D / 2 + t / 2), box(0.9, 0.8, 0.9, 1.4, 0.4, 1.8)]) scene.add(m);
  return new Physics(scene);
}

test('a small room fits the close arm: shorter than the default where the walls are near most ways, the default in a hall', () => {
  // (ring: eight chest-height rays round him, ring[i] and ring[i + 4] opposite)
  const cab = roomFit([1.8, 1.9, 2.1, 1.7, 1.6, 2.0, 2.2, 1.9]);
  assert.ok(cab < TIGHT_DIST && cab > ROOM_FIT.min - 0.5, `a cabin 3.5 m across: ${cab.toFixed(2)} m`);
  assert.equal(roomFit([1.2, 3, 9, 10, 14, 10, 9, 3]), ROOM_FIT.far, 'by one wall of a big hall: not short');
  assert.equal(roomFit([1.4, 30, 40, 30, 1.4, 30, 40, 30]), ROOM_FIT.far, 'a corridor\'s length does not count as a small room');
  const room = [3, 2, 1.5, 2, 9, 9, 9, 9];   // (over 10 m across every way, a wall near on one side)
  assert.equal(roomFit(room), ROOM_FIT.far, 'a room over 10 m across is not small');
  assert.ok(roomFit(room, true) < TIGHT_DIST, 'but aboard (indoor) the near walls count');
});

test('turning round and walking about in a small room: the camera settles, it doesn\'t pump or shake (issue #195)', () => {
  const physics = cabin();
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 500);
  const rig = new CameraRig(camera, dom, physics);
  // a full turn by hand standing in the middle, then to each wall and back, then a turn by the table
  const path = [[0, 0, -0.4], { wait: 6 }, [0, -1.2], [-0.6, 0.8], [0.8, -1.4], [0, -0.4], { wait: 8 }];
  const S = walk(rig, physics, camera, path, { speed: 2.4, turns: [{ at: 0.5, for: 6, rate: 60 }, { at: 12, for: 2.5, rate: -90 }], yaw: 0 });
  const r = analyse(S), m = r.measures;
  assert.equal(m.pops, 0, `no pops (${JSON.stringify(m)})`);
  assert.ok(m.rms < 0.015, `the camera's path smooth: ${(m.rms * 100).toFixed(2)} cm rough`);
  assert.ok(m.clip <= 0.01, `the lens clear of the walls: ${(m.clip * 100).toFixed(1)} %`);
  assert.ok(m.out <= 0.01, `the traveller in the frame: ${(m.out * 100).toFixed(1)} %`);
  // (the arm's in-out frame to frame, ignoring the slow moves of a turn: a flip back and forth within a third of a second)
  let flips = 0;
  for (let i = 20; i < S.length; i++) {
    const a = S[i - 20].cur, b = S[i - 10].cur, c = S[i].cur;
    if (Math.abs(b - a) > 0.06 && Math.abs(c - b) > 0.06 && Math.sign(b - a) !== Math.sign(c - b)) flips++;
  }
  assert.ok(flips <= 2, `the arm doesn't flip in and out: ${flips} frames of a flip (8 before the room fit)`);
  // (how far the arm went in and out over the whole walk, summed: 3.7 m before issue #195, the arm pumping in at each wall
  // and out at each gap at its 1.9 m; 0.7 m fitted to the room)
  const travel = S.slice(1).reduce((t, s, i) => t + Math.abs(s.cur - S[i].cur), 0);
  assert.ok(travel < 1.6, `the arm settles: ${travel.toFixed(2)} m of in and out`);
  assert.ok(m.reversals <= 0.1, `no reversals to speak of: ${m.reversals}/s`);
  // standing still once it has come in, it holds: no creep in and out
  const still = S.slice(-60).map((s) => s.cur);
  assert.ok(Math.max(...still) - Math.min(...still) < 0.05, `held still, the arm is still (${Math.min(...still).toFixed(2)}..${Math.max(...still).toFixed(2)})`);
});

test('close in, an arm that has come in lets out only for a real gain (no in-out by a few centimetres)', () => {
  const physics = cabin();
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 500);
  const rig = new CameraRig(camera, dom, physics);
  const p = V(0, 0, 0.9);
  rig.yaw = 0; rig._lastP = null;
  for (let i = 0; i < 120; i++) rig.update(p, 1 / 60, null);
  const held = rig._curDist;
  assert.ok(held < TIGHT_DIST - 0.2, `against the wall behind him the arm is in (${held.toFixed(2)} m)`);
  // a step of 4 cm away from the wall: less than the gap, it stays where it is
  const q = p.clone().add(V(0, 0, -0.04));
  for (let i = 0; i < 90; i++) rig.update(q, 1 / 60, null);
  assert.ok(Math.abs(rig._curDist - held) < 0.06, `${held.toFixed(3)} → ${rig._curDist.toFixed(3)}`);
});
