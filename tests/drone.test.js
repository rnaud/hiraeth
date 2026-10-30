import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Drone, DroneFold, FOLD, DRONE, DRONE_BELLY } from '../src/drone.js';
import { Scout } from '../src/scout.js';
import { TANK } from '../src/fluid-tool.js';
import { Humanoid, prepareHuman } from '../src/humanoid.js';
import { buildCharacter } from '../src/player.js';
import { Gear } from '../src/gear.js';

// The scout drone folds (src/drone.js): a round pod whose four shell petals close over its rotors
// into a compact egg, and bloom into vanes when it flies. It is not carried on him (issue #294): it
// comes out of a small light when it is needed.

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
  // awake but shut: the first moment out of its light
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

// ---- off the traveller
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

/** The traveller with the gear and the tank on his back. */
function wearer() {
  const char = buildCharacter(), h = new Humanoid(human, char, 'm', { outfit: template });
  const gear = new Gear(new THREE.Scene(), h, char);
  // (the battery in its bracer on his right forearm, issue #799: fluid-tool.js seats it there)
  const group = new THREE.Group(); group.position.set(0.045, 0.14, -0.02); group.scale.setScalar(TANK.scale); h.b.lowerarm_r.add(group);
  h.update(true); h.model.updateMatrixWorld(true);
  return { char, h, gear, tank: group };
}

// Issue #294: the drone is not carried on him (it sat by his face in every close-up): it comes when it is needed.
test('off him (issue #294): idle, no drone on the traveller; pinged, it grows out of a light by his shoulder, blooms once grown, does its job and winks out', () => {
  const w = wearer(), scene = new THREE.Scene();
  scene.add(w.char.root);
  const player = { pos: V(), vel: V(), frame: { up: V(0, 1) }, gear: w.gear, humanoid: w.h, char: w.char };
  const scout = new Scout({ scene, player, physics: { rayDistance: () => Infinity }, getTarget: () => ({ id: 't', label: 'T', position: V(100, 2) }) });
  const onHim = () => { let o = scout.drone.object; while (o) { if (o === w.char.root) return true; o = o.parent; } return false; };
  assert.ok(!onHim(), 'the drone is no part of him');
  // idle: nothing drawn, anywhere (play, a talk, a portrait, a menu all film him without it)
  for (let i = 0; i < 180; i++) { scout.update(1 / 60); assert.equal(scout.object.visible, false, 'idle, not drawn'); }
  assert.equal(scout.light.visible, false);
  // the ping: out of a small light over his left shoulder, a little behind him
  scout.ping();
  assert.equal(scout.phase, 'appear'); assert.equal(scout.object.visible, true);
  let bloomedSmall = false, lit = 0, last = 0, shrank = false;
  while (scout.phase === 'appear') {
    scout.update(1 / 60);
    const s = scout.object.scale.x, p = scout.object.position;
    if (s < last - 1e-6) shrank = true; last = s;
    if (scout.fold.petals > 0 && s < 0.4) bloomedSmall = true;
    lit = Math.max(lit, scout.lightK);
    if (scout.phase !== 'appear') break;
    assert.ok(Math.hypot(p.x, p.z) > 0.45 && p.y > 1.7 && p.y < 2.4, `over his shoulder, clear of him: ${p.toArray().map((x) => x.toFixed(2))}`);
    assert.ok(V(1, 0, 0).dot(p) > 0.3, 'on his left');
  }
  assert.ok(!shrank && lit > 0.9, `it grows out of its light (${lit.toFixed(2)})`);
  assert.ok(!bloomedSmall, 'the petals open once it has grown');
  assert.equal(scout.phase, 'seek'); assert.equal(scout.object.scale.x, 1);
  // its job, then gone: rises, folds, winks out into its light, and nothing is left on him or in the air
  const seen = new Set();
  for (let i = 0; i < 60 * 14 && !(seen.has('leave') && scout.phase === 'away'); i++) { scout.update(1 / 60); seen.add(scout.phase); }
  assert.ok(seen.has('point') && seen.has('leave'));
  assert.equal(scout.phase, 'away'); assert.equal(scout.object.visible, false); assert.equal(scout.light.visible, false);
  // a talk or a filmed scene while it is out: it is gone at once
  scout.ping(); for (let i = 0; i < 40; i++) scout.update(1 / 60);
  assert.ok(scout.object.visible);
  scout.update(1 / 60, true, true);
  assert.equal(scout.phase, 'away'); assert.equal(scout.object.visible, false);
  assert.ok(!onHim());
});
