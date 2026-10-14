// Issue #195, the author: "Most of the temple rooms are too small and so is the ship and it's interior. I want rooms to
// feel bigger so the camera doesn't move and shake every time we are in a cramped space." The rooms' floors (the
// antechambers before the guardians, the ship's rooms) and the close camera in a small room: it settles, it doesn't shake.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { CameraRig, roomFit, ROOM_FIT, TIGHT_DIST, CLIMB, BODY_CLEAR, bodyGap, heroCut } from '../src/player.js';
import { TempleKit, ANTE } from '../src/temples/kit.js';
import { CEIL, WALL_IN, HALF_W, LENGTH, HATCH, SHIP_SCALE } from '../src/ship/hull.js';
import { ROOMS, DOORWAY, FRAME_HALF, ALCOVE, TABLE, CONSOLE } from '../src/ship/interior.js';
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

test('the ship\'s rooms (issues #195, #338): twice the blockout\'s size, wide and high, its doorways wide, the hull grown round them, the furniture at its own size', () => {
  // (issue #338, the author: "My space ship and its interior should be 100% bigger. So it's more spacious inside")
  assert.equal(SHIP_SCALE, 2);
  assert.ok(CEIL >= 5.7, `the ceiling ${CEIL} m (2.9 before #338, 2.35 before #195)`);
  assert.ok(WALL_IN * 2 >= 15 && HALF_W - WALL_IN >= 0.7, `the rooms ${WALL_IN * 2} m across (7.6 before #338), the hull round them`);
  assert.ok(DOORWAY.half * 2 >= 4.1 && DOORWAY.h >= 3.5, `the doorways ${DOORWAY.half * 2} x ${DOORWAY.h} m (2.1 x 2.6 before #338)`);
  assert.ok(FRAME_HALF * 2 >= 7.5 && HATCH.z1 - HATCH.z0 >= 3.1 && HATCH.y1 >= 3.5, 'the cockpit frame and the hatch');
  const depth = Object.fromEntries(Object.entries(ROOMS).map(([k, r]) => [k, r.z1 - r.z0]));
  assert.ok(depth.cockpit >= 5.7 && depth.main >= 20 && depth.cabin >= 9.5 && depth.hold >= 9.9, `the rooms' depths ${JSON.stringify(depth)}`);
  assert.ok(ALCOVE.top >= 4 && WALL_IN - ALCOVE.x >= 1.15 && ALCOVE.z1 - ALCOVE.z0 < 3, 'the bunk\'s alcove: tall round its window, a bed long');
  assert.ok(LENGTH >= 51 && LENGTH <= 53, `the hull ${LENGTH} m long`);
  // the furniture keeps the traveller's size: the console, the holo table, the bunk, the seats
  assert.ok(TABLE.r < 0.7 && TABLE.h < 1 && CONSOLE.h < 1, 'the table and the console waist high');
  // measured in the built ship: the middle of each room, across and up
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: V(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } } }));
  const m = ship.parked;
  for (const [name, [x, z, across]] of Object.entries({ main: [-3.8, -0.4, 12], cabin: [0, 6.9 * 2, 10], hold: [0, 17.2 * 1.06, 12] })) {
    const r = measure(physics, ship.world(m, V(x, 0, z)));
    assert.ok(r.ceil >= 5.6, `${name}: the ceiling ${r.ceil.toFixed(2)} m`);
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

// Issue #234: the ship's tight spots, where #195 left the close arm under a metre a tenth of the time turning round a
// metre from a wall (the cockpit between the seats, by the hatch, by the bunk). Aboard, the camera climbs over the
// shoulder there (CLIMB) instead of crushing in, and the hatch's and the bunk's points stand further into the room.
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
function shipRig() {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: V(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } } }));
  return { physics, ship, m: ship.parked };
}
const aboardRig = (physics) => {
  const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.3, 500);
  const rig = new CameraRig(camera, dom, physics);
  rig.indoor = true; rig.indoorK = 1;
  return { camera, rig };
};
/** A full turn by hand (60°/s) and four walks out and back from `l` (ship-local), the real rig aboard: its arms and pull-ins. */
function probeSpot({ physics, ship, m }, l) {
  const p = ship.world(m, l.clone().setY(0)), yaw0 = ship.worldHeading(m, Math.PI) + Math.PI;
  const runs = [[[p.x, p.y, p.z], { wait: 6.5 }]];
  for (let k = 0; k < 4; k++) {
    const a = yaw0 + Math.PI + k * Math.PI / 2, d = V(Math.sin(a), 0, Math.cos(a));
    let L = Infinity;   // (out till 2.6 m short of a wall, or short of anything the body would bump)
    for (const h of [0.4, 1.2]) L = Math.min(L, physics.rayDistance(p.clone().add(V(0, h, 0)), d, 30));
    for (const s of [-0.4, 0.4]) L = Math.min(L, physics.rayDistance(p.clone().add(V(d.z * s, 0.6, -d.x * s)), d, 30));
    let go = Math.max(0, Math.min(L - 2.6 > 0.5 ? L - 2.6 : L - 0.6, 6));
    while (go > 0 && !ship.isInside(m, p.clone().addScaledVector(d, go + 0.6))) go -= 0.1;   // (aboard: not out of the hatch)
    const q = p.clone().addScaledVector(d, go);
    runs.push([[p.x, p.y, p.z], [q.x, q.y, q.z], { wait: 0.5 }, [p.x, p.y, p.z]]);
  }
  const arms = [], pulls = [];
  let pops = 0, clip = 0, frames = 0;
  runs.forEach((path, i) => {
    const { camera, rig } = aboardRig(physics);
    const up = rig.update.bind(rig), pull = [];
    rig.update = (...a) => { up(...a); pull.push(rig.armLength() - rig._curDist); };
    const S = walk(rig, physics, camera, path, i ? { speed: 2.4, yaw: yaw0, floor: p.y } : { turns: [{ at: 0.3, for: 6, rate: 60 }], yaw: yaw0, floor: p.y });
    const r = analyse(S).measures;
    arms.push(...S.map((s) => s.cur)); pulls.push(...pull.slice(-S.length));
    pops += r.pops; clip += r.clip * S.length; frames += S.length;
  });
  return { arm: pct(arms, 0.1), pull: pct(pulls, 0.9), pops, clip: clip / frames };
}

test('the ship\'s cockpit, hatch and bunk (issue #234): turning round and walking about, the arm stays over a metre', () => {
  const W = shipRig(), P = W.m.interior.points;
  // (before: the cockpit 0.76 / 1.04 m, by the hatch 0.88 / 1.02, by the bunk 0.67 / 0.88: arm p10 / pull-in p90)
  for (const [name, l] of Object.entries({ cockpit: V(0, 0, -8.1), hatch: P.hatchIn, bunk: P.bunkStand })) {
    const r = probeSpot(W, l), say = `${name}: arm p10 ${r.arm.toFixed(2)} m, pull-in p90 ${r.pull.toFixed(2)} m, ${r.pops} pops, clip ${(r.clip * 100).toFixed(1)} %`;
    assert.ok(r.arm >= 1, say);
    assert.ok(r.pull < 0.8, say);
    assert.equal(r.pops, 0, say);
    assert.ok(r.clip <= 0.01, say);
  }
});

// Issue #324, the author: "walking in my ship the camera keeps tilting up and clipping through my character". With his back
// a metre from the bunk's alcove and the camera held toward it, the climb went to its steepest (1.2 rad), the lens over his
// head looking straight down, and the arm crushed into him there. Now a climb only counts where it keeps the lens out of
// his body (BODY_CLEAR), never steeper than CLIMB.max (0.95 rad), and where the lens must be in him he is left out of the view.
test('aboard, a wall a metre behind him: the camera stays behind him at shoulder height, never over his head nor seen from inside him (CLIMB, issue #324)', () => {
  const { physics, ship, m } = shipRig();
  // by the bunk's alcove (where he stood up until issue #234), his back to it, the camera turned toward it by hand and held
  const p = ship.world(m, V(ALCOVE.x - 0.62, 0, ALCOVE.z1 + 0.2));   // ((1.98, -1.7) in the blockout's room, before issue #338)
  const { camera, rig } = aboardRig(physics);
  m.group.updateMatrixWorld(true);
  const arm = V(Math.sin(Math.PI / 2 + 0.3), 0, Math.cos(Math.PI / 2 + 0.3)).transformDirection(m.group.matrixWorld);   // (ship-local: toward the alcove)
  rig.yaw = Math.atan2(arm.x, arm.z); rig.target.copy(p); rig.snapTight(p);
  let steepest = 0, high = -Infinity, cut = false, seen = Infinity;
  for (let i = 0; i < 180; i++) {
    rig._lastMouse = rig._now; rig.update(p, 1 / 60);
    steepest = Math.max(steepest, rig.pitch + rig._climb);
    high = Math.max(high, ship.local(m, camera.position.clone()).y);
    cut = heroCut(cut, camera.position, p);
    if (!cut) seen = Math.min(seen, bodyGap(camera.position, p));
  }
  assert.ok(steepest <= CLIMB.max + 1e-6, `never steeper than ${CLIMB.max} rad: ${steepest.toFixed(2)} (1.2 + before)`);
  assert.ok(high < 2.5, `the lens at a sensible height, not up under the ceiling over his head: ${high.toFixed(2)} m`);
  assert.ok(seen >= 0.5, `drawn, he is never seen from inside: the lens ${seen.toFixed(2)} m from his axis at the nearest`);
  console.log(`  (the bunk's alcove: steepest ${steepest.toFixed(2)} rad, lens up to ${high.toFixed(2)} m, arm ${rig._curDist.toFixed(2)} m, gap ${bodyGap(camera.position, p).toFixed(2)} m, cut ${cut})`);
  // and turned to the room, where the arm has its room: level again, the whole arm, drawn
  rig.yaw += Math.PI;
  for (let i = 0; i < 240; i++) { rig._lastMouse = rig._now; rig.update(p, 1 / 60); }
  assert.ok(rig._climb < 0.05, `level again with room behind him: ${rig._climb.toFixed(2)}`);
  assert.ok(bodyGap(camera.position, p) >= BODY_CLEAR && !heroCut(false, camera.position, p), 'out of his body, and he is drawn');
});

test('the prologue\'s waking by the bunk: he stands a step out from the alcove, the camera has its room behind him', () => {
  const { physics, ship, m } = shipRig(), P = m.interior.points;
  assert.ok(ALCOVE.x - P.bunkStand.x >= 1.2, `a step out from the alcove: ${(ALCOVE.x - P.bunkStand.x).toFixed(2)} m (0.62 before)`);
  assert.ok(Math.hypot(P.bunkStand.x - P.tableFoot.x, P.bunkStand.z - P.tableFoot.z) > 1.7, 'out of the holo table\'s reach');
  assert.ok(Math.hypot(P.bunkStand.x - P.cockpit.x, P.bunkStand.z - P.cockpit.z) > 1.9, 'and of the console\'s');
  assert.ok(WALL_IN + P.hatchIn.x >= 1.3, `by the hatch, 1.4 m in from the wall (0.9 before): ${(WALL_IN + P.hatchIn.x).toFixed(2)}`);
  // the rise (src/ship/cinematics.js): the camera behind him where it is clearest, at 2.5 m, then the rig
  const { camera, rig } = aboardRig(physics);
  const p = ship.world(m, P.bunkStand), heading = ship.worldHeading(m, P.bunkStandHeading);
  rig.pitch = 0.1; rig._wasIndoor = true;
  rig.yaw = rig.clearYaw(p, heading + Math.PI, { want: 3 });
  rig.target.copy(p); rig.snapTight(p); rig._curDist = 2.5;
  for (let i = 0; i < 120; i++) rig.update(p, 1 / 60);
  assert.ok(rig._curDist >= 1.4, `the arm ${rig._curDist.toFixed(2)} m (he filled the right third of the frame before)`);
  camera.updateMatrixWorld(true);
  const head = p.clone().add(V(0, 1.6, 0)).project(camera), feet = p.clone().project(camera);
  assert.ok(Math.abs(head.x) < 0.6, `his head toward the middle of the frame: ${head.x.toFixed(2)}`);
  assert.ok(head.y - feet.y < 1.6, `his body under the frame's height: ${((head.y - feet.y) / 2).toFixed(2)} of it`);
});
