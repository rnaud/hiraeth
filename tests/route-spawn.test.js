// Issue #254: loading ?level=desert with the prologue done put the traveller under the ship's ramp (the desert's start,
// 8 m out of the hull's centre, under the ramp since the landing moved closer to Qanat on 2026-10-10, 9f55e63f, and
// more so once the ship grew to 26 m, #195): boxed in under a roof, the camera pressed 0.7 m over his head, no way to
// walk. Every route world's start, a direct load (?level=<id>, a debug save's start, the Unity bridge's bench plans:
// tests/bench-start.test.js) and an arrival by ship (the foot of the ramp), is on open ground: out of the ship and from
// under it, free to walk 5 m, the camera behind him with its arm out (the real Player and CameraRig through the real
// collision, as tests/room-size.test.js probes the ship's rooms). Issue #265: and every bench view and path that places
// the traveller (scripts/bench/viewpoints.json, viewpoints-worlds.json: the web's and the bridge's -views) places him
// clear of the ship, the camera out of its hull.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player, CameraRig } from '../src/player.js';
import { Ship, SPAWN_HEADROOM } from '../src/ship/ship.js';
import { buildableById } from '../src/levels/buildable.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { readFileSync } from 'node:fs';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

globalThis.window ??= { addEventListener() {} };
const dom = { addEventListener() {} };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };
const fmt = (p) => p.toArray().map((n) => n.toFixed(1)).join(', ');

const built = new Map();
const world = (id) => { if (!built.has(id)) built.set(id, build(id)); return built.get(id); };
async function build(id) {
  const meta = buildableById(id), scene = new THREE.Scene();
  return quiet(async () => {
    const level = await meta.create(scene);
    const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
    level.init?.(physics);
    const ship = new Ship({ scene, physics, level, levelId: id, content: CONTENT[id] });
    return { level, physics, ship, scene };
  });
}

/** The farthest the traveller gets in 4 s from `p`, walking each of eight ways (m, flat). */
function walkable(physics, level, p) {
  let best = 0;
  for (let k = 0; k < 8; k++) {
    const P = new Player(physics, { gravityAt: level.gravityAt });
    P.respawn(p.clone().add(V(0, 0.05, 0)));
    const h = (k / 8) * Math.PI * 2;
    for (let i = 0; i < 240; i++) P.update(1 / 60, { KeyW: true }, h + Math.PI);
    best = Math.max(best, Math.hypot(P.pos.x - p.x, P.pos.z - p.z));
    if (best >= 5) break;
  }
  return best;
}

/** The camera settled behind him: its arm (m from his head) and how far it looks his way (1: straight along his heading). */
function camera(physics, p, yaw, heading) {
  const cam = new THREE.PerspectiveCamera(65, 16 / 9, 0.3, 2000);
  const rig = new CameraRig(cam, dom, physics);
  rig.yaw = yaw; rig._lastP = null;
  for (let i = 0; i < 120; i++) rig.update(p, 1 / 60, null);
  cam.updateMatrixWorld(true);
  const f = cam.getWorldDirection(V()).setY(0).normalize();
  return { arm: cam.position.distanceTo(p.clone().add(V(0, 1.6, 0))), over: cam.position.y - p.y - 1.6, along: f.x * Math.sin(heading) + f.z * Math.cos(heading) };
}

/** Out of the ship and from under its hull or ramp (Ship.covers). */
function clearOfShip(name, { ship }, p) {
  assert.ok(!ship.isInside(ship.parked, p), `${name}: not inside the ship (${fmt(p)})`);
  assert.ok(!ship.covers(p), `${name}: not under the ship's hull or ramp (${fmt(p)})`);
}

function check(name, { level, physics, ship }, p, heading, yaw) {
  clearOfShip(name, { ship }, p);
  const roof = physics.rayDistance(p.clone().add(V(0, 0.3, 0)), V(0, 1, 0), SPAWN_HEADROOM);
  assert.ok(!(roof < SPAWN_HEADROOM), `${name}: nothing ${(roof + 0.3).toFixed(2)} m over his head (${fmt(p)})`);
  const far = walkable(physics, level, p);
  assert.ok(far >= 5, `${name}: he walks 5 m some way (${far.toFixed(2)} m at most, from ${fmt(p)})`);
  const c = camera(physics, p, yaw, heading);
  assert.ok(c.arm > 1.5, `${name}: the camera's arm out (${c.arm.toFixed(2)} m from his head)`);
  assert.ok(c.along > 0.5, `${name}: the camera behind him, looking his way (${c.along.toFixed(2)})`);
}

for (const id of ORDER) {
  test(`${id}: the start of a direct load and an arrival by ship are on open ground, free to walk, the camera behind (issue #254)`, async () => {
    const W = await world(id), { level, ship } = W;
    // ?level=<id> with the prologue done (and a debug save's start): the level's spawn, its camera's yaw (main.js)
    check(`${id} direct`, W, level.spawn, level.spawnHeading ?? 0, level.camYaw ?? 0);
    // ?via=ship: the foot of the ramp, facing out, the camera behind (main.js)
    const a = ship.arrivalSpot();
    check(`${id} by ship`, W, a.pos, a.heading, a.heading + Math.PI);
  });
}

// the benches' fixed views and paths (the web benches', and the Unity bridge's -views): the desert's are viewpoints.json's,
// every other world's viewpoints-worlds.json's; a view or a path may pass under an awning or a gate, not under the ship
const bench = (f) => JSON.parse(readFileSync(new URL(`../scripts/bench/${f}`, import.meta.url), 'utf8'));
const DESERT = bench('viewpoints.json'), BENCH = { ...bench('viewpoints-worlds.json').worlds, desert: DESERT };
for (const [id, { views = [], paths = [] }] of Object.entries(BENCH)) {
  if (!buildableById(id)) continue;
  test(`${id}: the benches' views and paths place the traveller clear of the ship, the camera out of its hull (issue #265)`, async () => {
    const W = await world(id), { ship } = W;
    for (const v of views) {
      const eye = V(...v.eye);
      assert.ok(!ship.isInside(ship.parked, eye), `${id} ${v.name}: the camera out of the ship (${fmt(eye)})`);
      if (v.player) clearOfShip(`${id} ${v.name}`, W, V(...v.player));
      // (in the world as it is now: Vael's views stood in its own frame after v1.39 moved it by its part offset, 60-110 m
      // over a ravine, and every bench and the visual audit looked at a cliff; visual-v1.66)
      const p = V(...(v.player ?? v.eye)), g = W.physics.groundAt(p.x, p.y + 3, p.z, 300);
      assert.ok(g != null && p.y - g < 10, `${id} ${v.name}: the view's traveller stands on the world (${g == null ? 'no ground under' : `${(p.y - g).toFixed(1)} m over the ground`} at ${fmt(p)})`);
    }
    for (const path of paths) for (const q of path.points ?? []) clearOfShip(`${id} path ${path.name}`, W, V(...q.p));
  });
  test(`${id}: the benches' views look at the world, not at a column or a trunk at the camera (issue #301)`, async () => {
    viewsClear(id, await world(id), views);
  });
}

// Issue #301 (visual audit v1.66, finding 6): the views must look at their world, not at a column or a trunk the camera
// stands against. The Underwater City's crowd2 had a flat cyan face over half its frame 2-4 m off; the City-Shaft's looked
// through the plaza's cypresses at its traveller (Viridel's through a trunk too: that trunk is not in a node-built world,
// its view was re-picked by eye). Each view's frame cast at 16 × 9 rays against the world's opaque meshes: nothing within
// VIEW_NEAR.m over a third of the frame, nothing nearer than VIEW_NEAR.before of the way to the view's traveller over a
// third of it, and the line to his chest clear (but on a wide view, where he is a speck). Glass (transparent) doesn't count.
const VIEW_NEAR = { m: 2, before: 0.7, share: 1 / 3 };
const BY_DESIGN = {   // (views left out, and why)
  'glassdunes sinkhole': 'looks in through the glass that holds the stopped minute, by design',
  'garage crowd2': 'a 16 m mound of the node-built hangar stands at its camera where the game draws open sand (checked in the game)',
};
function viewsClear(id, { scene }, views) {
  scene.updateMatrixWorld(true);
  const solid = [];
  scene.traverse((o) => { const m = [].concat(o.material ?? []); if ((o.isMesh || o.isInstancedMesh) && o.visible !== false && !m.some((x) => x.transparent || x.opacity < 1)) solid.push(o); });
  // (each mesh's rays through a BVH, the same hits: through three.js's own raycast every triangle was tried, 40-80 s a world;
  // instanced and skinned meshes keep theirs)
  for (const o of solid) if (!o.isInstancedMesh && !o.isSkinnedMesh && o.geometry.attributes.position && !Object.keys(o.geometry.morphAttributes).length) { o.geometry.boundsTree ??= new MeshBVH(o.geometry); o.raycast = acceleratedRaycast; }
  const ray = new THREE.Raycaster();
  for (const v of views) {
    if (!v.eye || !v.target || BY_DESIGN[`${id} ${v.name}`]) continue;
    const eye = V(...v.eye), cam = new THREE.PerspectiveCamera(v.fov ?? 55, 16 / 9, 0.1, 500);
    cam.position.copy(eye); cam.lookAt(...v.target); cam.updateMatrixWorld(true);
    const him = v.player ? V(...v.player).add(V(0, 1.2, 0)) : null, D = him ? him.distanceTo(eye) : 0;
    let n = 0, near = 0, before = 0;
    for (let y = 0; y < 9; y++) for (let x = 0; x < 16; x++) {
      ray.setFromCamera(new THREE.Vector2(((x + 0.5) / 16) * 2 - 1, ((y + 0.5) / 9) * 2 - 1), cam); n++;
      const h = ray.intersectObjects(solid, false)[0];
      if (h && h.distance < VIEW_NEAR.m) near++;
      if (h && him && h.distance < VIEW_NEAR.before * D) before++;
    }
    assert.ok(near / n < VIEW_NEAR.share, `${id} ${v.name}: ${(near / n * 100).toFixed(0)} % of the frame within ${VIEW_NEAR.m} m of the camera`);
    if (!him) continue;
    assert.ok(before / n < VIEW_NEAR.share, `${id} ${v.name}: ${(before / n * 100).toFixed(0)} % of the frame stands before the traveller`);
    if (v.name === 'wide') continue;
    const block = new THREE.Raycaster(eye, him.clone().sub(eye).normalize(), 0.1, D - 0.6).intersectObjects(solid, false)[0];
    assert.ok(!block, `${id} ${v.name}: the camera sees its traveller (something ${block?.distance.toFixed(1)} m off in the way)`);
  }
}

test('a spawn under the ship goes to the foot of its ramp, facing out (the desert\'s, issue #254)', async () => {
  const { level, ship } = await world('desert');
  const { LANDING } = await import('../src/levels/desert.js');
  assert.ok(Math.hypot(level.spawn.x - LANDING.x, level.spawn.z - LANDING.z) > 3, 'moved off the spot under the ramp');
  assert.ok(level.spawn.distanceTo(ship.rampFoot) < 0.01, 'to the foot of the ramp');
  assert.equal(level.spawnHeading, ship.site.heading);
});

// Issue #259: the camera QC's desert-open (a run from the desert's start: straight, then turning the camera, jumping)
// had the traveller off the screen 36 % of the run, from that start under the ramp (before #254). The real Player and
// CameraRig through the desert's collision from the start as it is now: he stays on the screen (the scenario's limit, 1 %).
test('desert: the camera QC\'s desert-open run from the start keeps the traveller on the screen (issue #259)', async () => {
  const { level, physics } = await world('desert');
  const P = new Player(physics, { gravityAt: level.gravityAt });
  P.respawn(level.spawn.clone().add(V(0, 0.05, 0)));
  const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 2000), rig = new CameraRig(cam, dom, physics);
  rig.yaw = level.camYaw ?? 0; rig._lastP = null;
  const dt = 1 / 60, off = (q) => { const a = q.clone().project(cam); return a.z > 1 || Math.abs(a.x) > 1 || Math.abs(a.y) > 1; };
  let out = 0, n = 0;
  for (let i = 0; i < 60 * 18; i++) {
    const t = i * dt;
    if (t > 8 && t < 12) rig.yaw += (70 * Math.PI / 180) * dt;   // (the scenario's turn while running)
    const jump = t > 12 && (t - 12) % 1.3 < 0.15;
    P.update(dt, { KeyW: true, ShiftLeft: true, Space: jump }, rig.yaw);
    rig.update(P.pos, dt, P.frame);
    cam.updateMatrixWorld(true);
    if (t < 1) continue;
    n++;
    if (off(P.pos.clone().add(V(0, 1.6, 0))) || off(P.pos.clone().add(V(0, 1.1, 0)))) out++;
  }
  assert.ok(n > 900 && out / n <= 0.01, `off the screen ${((out / n) * 100).toFixed(1)} % of the run (from ${fmt(level.spawn)})`);
});
