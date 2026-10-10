import test from 'node:test';
import { LANTERN_AT } from '../src/boxes/effects.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Drone, DroneFold, FOLD, DRONE, DRONE_BELLY, DOCK_ON_SIDE } from '../src/drone.js';
import { Scout, DOCKING } from '../src/scout.js';
import { FluidTool, TANK, TANK_RAIL, SCOUT_DOCK_Y, tankRadiusAt } from '../src/fluid-tool.js';
import { Humanoid, prepareHuman } from '../src/humanoid.js';
import { buildCharacter } from '../src/player.js';
import { Gear } from '../src/gear.js';
import { Animator } from '../src/animator.js';

// The scout drone folds (src/drone.js): a round pod whose four shell petals close over its rotors
// into a compact egg on your back, and bloom into vanes when it flies.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const run = (f, dt, n, open, awake) => { for (let i = 0; i < n; i++) f.update(dt, open, awake); return f; };

test('the fold: the eye wakes, the petals bloom, then the rotors spin; closing, they stop along the petals before the petals shut', () => {
  const f = new DroneFold();
  assert.equal(f.state, 'folded'); assert.equal(f.petals, 0); assert.equal(f.eye, 0);
  // opening, step by step: nothing out of order
  let eyeFirst = true, spunShut = false;
  for (let i = 0; i < 120 && f.state !== 'open'; i++) {
    f.update(1 / 60, true);
    if (f.petals > 0 && f.eye <= 0.5) eyeFirst = false;
    if (f.rate > 0 && f.petals < FOLD.spinAt) spunShut = true;
  }
  assert.ok(eyeFirst, 'the eye opens before the petals move');
  assert.ok(!spunShut, 'the rotors only turn once the vanes are out');
  assert.equal(f.state, 'open'); assert.equal(f.petals, 1); assert.equal(f.rate, FOLD.rpm);
  // closing: the petals hold until the rotors have parked with their blades along them
  let early = false, steps = 0;
  while (f.state !== 'folded' && steps++ < 300) {
    f.update(1 / 60, false);
    if (f.petals < 1 && !f.parked) early = true;
    if (f.petals < 1) assert.ok(f.aligned, `blades along the petal while it closes (spin ${f.spin.toFixed(3)})`);
    if (f.eye < 1) assert.ok(f.petals < 0.35, 'the eye shuts last');
  }
  assert.ok(!early, 'no petal moves while a rotor still turns');
  assert.equal(f.state, 'folded'); assert.equal(f.rate, 0); assert.ok(f.aligned);
  assert.ok(steps < 70, `folds in about a second (${steps} frames)`);
  // it can turn back half way, both ways
  run(f, 1 / 60, 20, true); assert.equal(f.state, 'unfolding');
  run(f, 1 / 60, 15, false); assert.equal(f.state, 'folding');
  run(f, 1 / 60, 80, true); assert.equal(f.state, 'open');
  // awake but shut: the first hop off the dock
  f.snap(false); run(f, 1 / 60, 20, false, true);
  assert.equal(f.petals, 0); assert.equal(f.eye, 1);
  f.snap(true); assert.equal(f.state, 'open'); f.snap(false); assert.equal(f.state, 'folded');
});

test('the drone: one skinned mesh and the lens; folded, a compact egg with the rotors inside; open, upright rotors on spread vanes', () => {
  const d = new Drone(), f = new DroneFold();
  let meshes = 0; d.object.traverse((o) => { if (o.isMesh) meshes++; });
  assert.equal(meshes, 2, 'two draw calls');
  assert.ok(d.mesh.isSkinnedMesh);
  d.pose(f);
  const folded = new THREE.Box3().setFromPoints(d.hull(1));
  const size = folded.getSize(V());
  assert.ok(size.x < 0.22 && size.z < 0.22 && size.y < 0.22, `folded: ${size.toArray().map((x) => x.toFixed(3))}`);
  assert.ok(Math.abs(folded.min.y + DRONE_BELLY) < 0.002, 'its foot is the bottom');
  // the rotors and their blur rings are tucked inside the closed petals (bones 5-8, 11-14)
  const skin = d.mesh.geometry.attributes.skinIndex, inner = DRONE.R + DRONE.shell - DRONE.thick;
  const pts = d.hull(1);
  pts.forEach((p, i) => { const b = skin.getX(i); if ((b >= 5 && b <= 8) || b >= 11) assert.ok(p.length() < inner, `rotor part ${b} inside the shell: ${p.length().toFixed(3)}`); });
  // the petals cover the top: no ray up from inside escapes between them except at the apex
  run(f, 1 / 60, 90, true); d.pose(f);
  assert.equal(f.state, 'open');
  const open = new THREE.Box3().setFromPoints(d.hull(1)).getSize(V());
  assert.ok(open.x > size.x * 1.5 && open.z > size.z * 1.5, `spread: ${open.toArray().map((x) => x.toFixed(3))}`);
  d.mesh.updateMatrixWorld(true);
  for (const r of d.rotors) {
    const axis = V(0, 1, 0).applyQuaternion(r.bone.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(axis.y > 0.99, `rotor upright: ${axis.y.toFixed(3)}`);
    assert.ok(r.blur.scale.x > 0.99, 'the blur ring shows at speed');
  }
  // the lens: lit when awake, a dim slit asleep
  assert.ok(d.lens.scale.y > 0.9);
  f.snap(false); d.pose(f);
  assert.ok(d.lens.scale.y < 0.15);
});

// ---- docked on the traveller: the pack, the tank, and every clip's pose
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
async function glb(name) {
  const bytes = await readFile(new URL(`../public/anim/${name}`, import.meta.url));
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length));
  json.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + length).toString('base64')}`;
  return (await new GLTFLoader().parseAsync(JSON.stringify(json), '')).scene;
}
const template = await glb('traveller.glb');
const human = prepareHuman(await glb('human_m.glb'), 'm');
const motionBytes = await readFile(new URL('../public/anim/ual.glb', import.meta.url));
const motion = await new GLTFLoader().parseAsync(motionBytes.buffer.slice(motionBytes.byteOffset, motionBytes.byteOffset + motionBytes.byteLength), '');
const CLIPS = { idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop', jumpStart: 'Jump_Start', jumpLoop: 'Jump_Loop', jumpLand: 'Jump_Land',
  drive: 'Driving_Loop', talk: 'Idle_Talking_Loop', look: 'Idle_LookAround_Loop', ledge: 'ClimbLedge',
  climbIdle: 'Climb_Idle_Loop', climbUp: 'Climb_Up_Loop', climbDown: 'Climb_Down_Loop', climbLeft: 'Climb_Left_Loop', climbRight: 'Climb_Right_Loop' };
const lib = { scene: motion.scene, clips: Object.fromEntries(Object.entries(CLIPS).map(([k, n]) => [k, motion.animations.find((c) => c.name === n)])), native: { walk: 1, jog: 3, sprint: 6 } };

/** The traveller with the gear (the scout's dock on the pack) and, if `tank`, the dock moved onto the tank (the real hook). */
function wearer(tank) {
  const char = buildCharacter(), h = new Humanoid(human, char, 'm', { outfit: template });
  const gear = new Gear(new THREE.Scene(), h, char);
  let group = null;
  if (tank) {
    group = new THREE.Group(); group.position.set(...TANK.at); group.scale.setScalar(TANK.scale); h.chestAnchor.add(group);
    FluidTool.prototype.placeDock.call({ player: { gear }, tank: { group } }, true);
  }
  h.update(true); h.model.updateMatrixWorld(true);
  return { char, h, gear, tank: group, anim: new Animator(lib, char) };
}
const pose = (w, name, t) => {
  const a = w.anim;
  for (const [k, action] of Object.entries(a.actions)) { action.setEffectiveWeight(k === name ? 1 : 0); action.time = t * a.lib.clips[k].duration; }
  a.mixer.update(0); a.src.updateMatrixWorld(true); a.apply(w.char.root); w.h.update(); w.h.poseHands(a);
  w.h.model.updateMatrixWorld(true);
};
const folded = (() => { const d = new Drone(); d.pose(new DroneFold()); return d.hull(2); })();
/** The folded drone on its dock, in world space. */
const docked = (w) => { w.gear.scoutDock.updateWorldMatrix(true, false); const p = w.gear.scoutDock.getWorldPosition(V()), q = w.gear.scoutDock.getWorldQuaternion(new THREE.Quaternion()); return folded.map((v) => v.clone().applyQuaternion(q).add(p)); };
const inFrame = (pts, frame) => { frame.updateWorldMatrix(true, false); const inv = frame.matrixWorld.clone().invert(); return pts.map((p) => p.clone().applyMatrix4(inv)); };
function outfitBox(h, re, frame = null) {
  const out = new THREE.Box3(), inv = frame ? frame.matrixWorld.clone().invert() : null, v = V();
  for (const m of h.outfitMeshes) {
    m.skeleton.update();
    for (const [name, [first, count]] of Object.entries(m.userData.ranges)) {
      if (!re.test(name)) continue;
      for (let i = first; i < first + count; i++) { m.localToWorld(m.getVertexPosition(i, v)); if (inv) v.applyMatrix4(inv); out.expandByPoint(v); }
    }
  }
  return out;
}

test('docked on the rucksack: folded flat on its lid, foot down, inside the space over it, clear of the head', () => {
  const w = wearer(false), pts = inFrame(docked(w), w.h.chestAnchor);
  const lid = outfitBox(w.h, /^Rucksack_lid$/, w.h.chestAnchor);
  const box = new THREE.Box3().setFromPoints(pts);
  assert.ok(Math.abs(box.min.y - lid.max.y) < 0.012, `its foot on the lid (${(box.min.y - lid.max.y).toFixed(3)})`);
  // the clearance volume: over the lid, no wider than the rucksack, overhanging its outer face by no more than a hand
  const room = new THREE.Box3(V(lid.min.x, lid.max.y - 0.002, lid.min.z - 0.1), V(lid.max.x, lid.max.y + 0.23, lid.max.z + 0.01));
  for (const p of pts) assert.ok(room.containsPoint(p), `outside the space over the lid: ${p.toArray().map((x) => x.toFixed(3))}`);
  // the lens looks back (toward the camera behind you)
  const lens = V(0, 0, 1).applyQuaternion(w.gear.scoutDock.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(lens.z < -0.99, 'lens looking back');
  // clear of his hair (its own vertices: the tousled locks make its box much bigger than the hair)
  const m = w.h.outfitMeshes.find((o) => o.userData.pieces.includes('Traveller_hair')), hair = [];
  m.skeleton.update();
  for (let i = 0; i < m.geometry.attributes.position.count; i++) hair.push(m.localToWorld(m.getVertexPosition(i, V())));
  const near = Math.min(...docked(w).map((p) => Math.min(...hair.map((q) => q.distanceTo(p)))));
  assert.ok(near > 0.015, `clear of his hair (${near.toFixed(3)} m)`);
});

test('docked on the flask: clamped to the top of its left upright, off the glass, clear of the lantern and inside the space beside it', () => {
  const w = wearer(true);
  assert.equal(w.gear.scoutDock.parent, w.tank, 'it rides with the tank (into a vehicle\'s socket too)');
  const pts = inFrame(docked(w), w.tank);
  const rail = Math.min(...pts.map((p) => Math.hypot(p.x - TANK_RAIL.x, p.z - TANK_RAIL.z)));
  assert.ok(rail > TANK_RAIL.r - 0.003 && rail < TANK_RAIL.r + 0.01, `its foot on the rail (${(rail - TANK_RAIL.r).toFixed(3)})`);
  const room = new THREE.Box3(V(TANK_RAIL.x, TANK.height * 0.8, TANK_RAIL.z - 0.2 / TANK.scale), V(TANK_RAIL.x + TANK_RAIL.r + 0.23 / TANK.scale, TANK_RAIL.top + 0.16, TANK_RAIL.z + 0.2 / TANK.scale));
  for (const p of pts) {
    assert.ok(room.containsPoint(p), `outside the space beside the flask: ${p.toArray().map((x) => x.toFixed(3))}`);
    if (p.y >= 0 && p.y <= TANK.height) { const r = tankRadiusAt(p.y); assert.ok((p.x / (r * TANK.squash)) ** 2 + (p.z / (r * TANK.depth)) ** 2 > 1.05, 'in the glass'); }
    // the upright's brackets (fluid-tool.js buildTank: boxes 0.03 x 0.026 x 0.15 at the rail, z + 0.07) and its knob
    for (const y of TANK_RAIL.brackets) assert.ok(!new THREE.Box3(V(TANK_RAIL.x - 0.015, y - 0.013, TANK_RAIL.z - 0.005), V(TANK_RAIL.x + 0.015, y + 0.013, TANK_RAIL.z + 0.145)).containsPoint(p), 'in a bracket');
    assert.ok(Math.hypot(p.x - TANK_RAIL.x, p.y - TANK_RAIL.top, p.z - TANK_RAIL.z) > 0.018, 'in the knob');
  }
  // The lantern hangs below the dock; include the paper globe and its hook.
  const chest = inFrame(docked(w), w.h.chestAnchor);
  for (const p of chest) {
    const q = p.clone().sub(LANTERN_AT);
    assert.ok(Math.hypot(q.x, q.y / 1.25, q.z) > 0.06 && !(Math.hypot(q.x, q.z) < 0.01 && q.y < 0.15), `in the lantern: ${p.toArray().map((x) => x.toFixed(3))}`);
  }
  assert.ok(SCOUT_DOCK_Y > TANK_RAIL.brackets[1] + 0.06 && SCOUT_DOCK_Y < TANK_RAIL.top, 'above the top bracket, on the upright');
  // the lens looks back, its top out to the left
  const q = w.gear.scoutDock.getWorldQuaternion(new THREE.Quaternion()), cq = w.h.chestAnchor.getWorldQuaternion(new THREE.Quaternion()).invert();
  q.premultiply(cq);
  assert.ok(V(0, 0, 1).applyQuaternion(q).z < -0.99 && V(0, 1, 0).applyQuaternion(q).x > 0.99);
  assert.ok(DOCK_ON_SIDE.angleTo(w.gear.scoutDock.quaternion) < 1e-6);
});

/** Capsules round the limbs and head that could reach the back: [from, to, radius] in world space (radii round the suit and gloves). */
function capsules(h) {
  const B = h.b, at = (b) => b.getWorldPosition(V()), out = [];
  for (const s of ['l', 'r']) {
    out.push([at(B[`upperarm_${s}`]), at(B[`lowerarm_${s}`]), 0.07], [at(B[`lowerarm_${s}`]), at(B[`hand_${s}`]), 0.065], [at(B[`hand_${s}`]), at(B[`middle_01_${s}`]), 0.06]);
    out.push([at(B[`middle_01_${s}`]), at(B[`middle_01_${s}`]).add(at(B[`middle_01_${s}`]).sub(at(B[`hand_${s}`])).multiplyScalar(0.8)), 0.045]);
  }
  const hair = outfitBox(h, /^Traveller_hair$/), c = hair.getCenter(V()), half = hair.getSize(V()).multiplyScalar(0.5);
  out.push([c, c, Math.max(half.x, half.y, half.z) * 0.92]);   // head and hair, conservatively enclosed
  return out;
}
const segDist = (p, a, b) => { const ab = b.clone().sub(a), t = ab.lengthSq() ? THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1) : 0; return p.distanceTo(a.clone().addScaledVector(ab, t)); };

for (const where of ['pack', 'tank']) test(`docked on the ${where}: no arm, hand or the head passes through it in any clip (idle, walk, run, jump, drive, climb, ledge)`, () => {
  const w = wearer(where === 'tank');
  let worst = Infinity, at = '';
  for (const name of Object.keys(CLIPS)) {
    for (let k = 0; k < 24; k++) {
      pose(w, name, k / 24);
      const pts = docked(w), caps = capsules(w.h);
      for (const [a, b, r] of caps) for (const p of pts) {
        const gap = segDist(p, a, b) - r;
        if (gap < worst) { worst = gap; at = `${name} ${k}/24`; }
      }
    }
  }
  if (process.env.DRONE_DEBUG) console.log(where, worst.toFixed(3), at);
  assert.ok(worst > 0, `the drone on the ${where} touches the body in ${at} (${worst.toFixed(3)} m)`);
});

test('the scout hops off its dock folded along the dock line, blooms clear of you, and lands folded', () => {
  const dock = new THREE.Object3D(); dock.position.set(0, 2, 0); dock.quaternion.copy(DOCK_ON_SIDE); dock.updateMatrixWorld();
  const player = { pos: V(), vel: V(), frame: { up: V(0, 1) }, gear: { scoutDock: dock } };
  const scout = new Scout({ scene: new THREE.Scene(), player, physics: { rayDistance: () => Infinity }, getTarget: () => ({ id: 't', label: 'T', position: V(100, 2) }) });
  assert.equal(scout.fold.state, 'folded');
  scout.ping();
  const out = DOCKING.out.clone().applyQuaternion(DOCK_ON_SIDE), home = V(0, 2, 0);
  let bloomedNear = false;
  while (scout.popT < DOCKING.pop) {
    scout.update(1 / 60);
    const rel = scout.object.position.clone().sub(home), along = rel.dot(out);
    assert.ok(rel.clone().addScaledVector(out, -along).length() < 1e-6, 'straight out along the dock line');
    if (scout.fold.petals > 0 && along < DOCKING.hop * 0.3) bloomedNear = true;
    assert.equal(scout.trail.samples.length, 0, 'no trail on the hop');
  }
  assert.ok(!bloomedNear, 'the petals only open once clear of the dock');
  assert.ok(scout.fold.eye > 0.99, 'awake on the hop');
  for (let i = 0; i < 60; i++) scout.update(1 / 60);
  assert.equal(scout.phase, 'seek'); assert.equal(scout.fold.state, 'open');
  // home: folded before the glide in, docked shut and lined up with the dock
  scout.home();
  let glideOpen = false;
  for (let i = 0; i < 600 && scout.phase !== 'docked'; i++) { scout.update(1 / 60); if (scout.settleT != null && scout.fold.petals > 0.45) glideOpen = true; }
  assert.equal(scout.phase, 'docked');
  assert.ok(!glideOpen, 'shut before it glides onto the dock');
  for (let i = 0; i < 60; i++) scout.update(1 / 60);
  assert.equal(scout.fold.state, 'folded');
  assert.ok(scout.object.position.distanceTo(home) < 1e-6 && scout.object.quaternion.angleTo(DOCK_ON_SIDE) < 1e-6);
});

test('gliding: the scout hops off the rail onto the cap, out of the fluid wings, along an arc clear of the tank', async () => {
  const { FluidWings } = await import('../src/fluid-kit.js');
  const { scoutDockPose, SCOUT_CAP } = await import('../src/fluid-tool.js');
  const tank = new THREE.Group(), wings = new FluidWings(tank, ['#ffffff']);
  // the open wings' triangles over a few beats and turns (tank frame)
  const tris = [];
  for (const [t, turn] of [[0, 0], [0.6, 1], [1.3, -1], [2.1, 0.5]]) {
    wings.time = t; wings.update(1e-4, { open: 1, turn, wind: 6 }); tank.updateMatrixWorld(true);
    for (const L of wings.lobes) {
      const g = L.mesh.geometry, P = g.attributes.position, I = g.index.array, w = (i) => V().fromBufferAttribute(P, i).applyMatrix4(L.mesh.matrixWorld);
      for (let i = 0; i < I.length; i += 3) tris.push(new THREE.Triangle(w(I[i]), w(I[i + 1]), w(I[i + 2])));
    }
  }
  const hull = (() => { const d = new Drone(); d.pose(new DroneFold()); return d.hull(5); })();
  const placed = (k) => { const p = V(), q = new THREE.Quaternion(); scoutDockPose(k, p, q); const m = new THREE.Matrix4().compose(p, q, V(1, 1, 1).divideScalar(TANK.scale)); return hull.map((h) => h.clone().applyMatrix4(m)); };
  const gap = (pts) => { let best = Infinity; const c = V(); for (const t of tris) for (const p of pts) best = Math.min(best, t.closestPointToPoint(p, c).distanceTo(p)); return best; };
  assert.ok(gap(placed(0)) < 0.01, 'on the rail, the open wings would pass through it');
  assert.ok(gap(placed(1)) > 0.02, `on the cap, clear of the wings (${gap(placed(1)).toFixed(3)})`);
  // the hop: never in the glass, the cap or the rail's top
  for (let k = 0; k <= 1.0001; k += 0.1) for (const p of placed(k)) {
    if (p.y >= 0 && p.y <= TANK.height) { const r = tankRadiusAt(p.y); assert.ok((p.x / (r * TANK.squash)) ** 2 + (p.z / (r * TANK.depth)) ** 2 > 1.02, `in the glass at k ${k.toFixed(1)}`); }
    // (the neck, its cap and the lift valve's wheel on it: v1.38's round backpack)
    assert.ok(!(p.y < TANK.neck.y + TANK.neck.h + 0.065 && p.y > TANK.neck.y - 0.01 && Math.hypot(p.x / TANK.squash, p.z - TANK.neck.z) < TANK.neck.r * 1.25), `in the cap at k ${k.toFixed(1)}`);
  }
  // and on the cap, still clear of the arms and the head in every clip
  const w = wearer(true), dock = w.gear.scoutDock;
  scoutDockPose(1, dock.position, dock.quaternion);
  let worst = Infinity;
  for (const name of Object.keys(CLIPS)) for (let k = 0; k < 12; k++) {
    pose(w, name, k / 12);
    const pts = docked(w);
    for (const [a, b, r] of capsules(w.h)) for (const p of pts) worst = Math.min(worst, segDist(p, a, b) - r);
  }
  assert.ok(worst > 0, `on the cap it touches the body (${worst.toFixed(3)})`);
});

test('when the flask is found, the docked scout glides over from the rucksack\'s lid to the flask\'s upright, folded', () => {
  const w = wearer(false), scene = new THREE.Scene();
  const player = { pos: V(), vel: V(), frame: { up: V(0, 1) }, gear: w.gear, humanoid: w.h, char: w.char };
  const scout = new Scout({ scene, player, physics: { rayDistance: () => Infinity }, getTarget: () => null });
  scout.update(1 / 60);
  const onPack = scout.object.position.clone();
  // the backpack is found: the dock goes onto the tank's rail (the real hook)
  const tank = new THREE.Group(); tank.position.set(...TANK.at); tank.scale.setScalar(TANK.scale); w.h.chestAnchor.add(tank);
  FluidTool.prototype.placeDock.call({ player: { gear: w.gear }, tank: { group: tank } }, true);
  w.h.model.updateMatrixWorld(true);
  scout.update(1 / 60);
  assert.equal(scout.phase, 'return', 'on its way over');
  assert.ok(scout.object.position.distanceTo(onPack) < 0.05, 'from where it was');
  for (let i = 0; i < 40 && scout.phase !== 'docked'; i++) { scout.update(1 / 60); assert.equal(scout.fold.petals, 0, 'folded all the way'); }
  assert.equal(scout.phase, 'docked');
  assert.ok(scout.object.position.distanceTo(scout.anchor()) < 1e-6);
  scout.update(1 / 60); assert.equal(scout.phase, 'docked', 'and stays');
});
