// Issue #564: for seven seconds after the desert loaded, the game ran at 26-37 fps on the Mac. The water's bed maps
// (src/water.js bakeStep, a few texels a frame from the nearest body out) raycast each sloping body with three's
// brute-force Mesh.raycast, and looked at the clock only after a whole row of up to 256 texels: the salt lagoons' sheet
// (#553's lagoonSheet, ~1900 triangles, a 256 x 256 map) was 25-35 ms a row, every frame. Now a body's surface is read
// through a BVH of its mesh and the clock is read every BED.block texels. These run on the desert's real water.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadWorld } from './playthrough-agent.js';
import { Waters, BED } from '../src/water.js';

const W = loadWorld('desert');
const waters = () => new Waters(W.scene, { physics: W.physics, drops: false });
const at = W.level.spawn.clone();
const mapped = (ws) => ws.bodies.filter((b) => b.mat && !b.sea);
const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const done = (ws) => !ws.bodies.some((b) => b.bake) && mapped(ws).every((b) => b.baked);

test('the desert has sloping water to bake (the lagoons, the gorge\'s stream, the pan\'s flood)', () => {
  const ws = waters();
  const sloping = mapped(ws).filter((b) => !b.flat);
  assert.ok(sloping.length >= 3, `${sloping.length} sloping bodies`);
  assert.ok(sloping.some((b) => /lagoon/i.test(b.mesh.name)), 'the salt lagoons among them');
});

test('a body\'s surface through its BVH is where three\'s Mesh.raycast finds it, every body, the flood shown', () => {
  const flood = W.level.water.flood, was = flood.visible;
  W.level.water.setFlood(1);
  W.scene.updateMatrixWorld(true);
  const ws = waters(), ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), hits = [];
  let n = 0;
  for (const b of ws.bodies) {
    if ((b.flat && b.huge) || !shown(b.mesh)) continue;   // (a hidden body has no surface: surfaceOf's null)
    ws.refresh(b);
    for (let k = 0; k < 400; k++) {
      const x = THREE.MathUtils.lerp(b.box.min.x, b.box.max.x, ((k * 0.618034) % 1)), z = THREE.MathUtils.lerp(b.box.min.z, b.box.max.z, ((k * 0.414214 + 0.1) % 1));
      ray.set(new THREE.Vector3(x, b.top + 1, z), down); ray.far = b.box.max.y - b.box.min.y + 2;
      hits.length = 0; b.mesh.raycast(ray, hits);
      const want = hits.length ? Math.max(...hits.map((h) => h.point.y)) : null, got = ws.surfaceOf(b, x, z);
      if (want === null) assert.equal(got, null, `${b.mesh.name} at ${x.toFixed(1)}, ${z.toFixed(1)}`);
      else { assert.ok(Math.abs(got - want) < 1e-5, `${b.mesh.name} at ${x.toFixed(1)}, ${z.toFixed(1)}: ${got} against ${want}`); n++; }
    }
  }
  assert.ok(n > 400, `${n} hits compared`);
  W.level.water.setFlood(was ? 1 : 0);
  W.scene.updateMatrixWorld(true);
});

test('a frame of baking stops within BED.block texels of its budget, and a body\'s BVH is a frame of its own', () => {
  const ws = waters();
  let texels = 0;
  const bedAt = ws.bedAt.bind(ws);
  ws.bedAt = (...a) => { texels++; return bedAt(...a); };
  let frames = 0, most = 0, total = 0;
  for (; frames < 100000 && !done(ws); frames++) {
    texels = 0;
    ws.bakeStep(at, 0);   // (no budget: one block a frame)
    most = Math.max(most, texels); total += texels;
  }
  assert.ok(done(ws), 'every map made');
  assert.equal(most, BED.block, `at most ${BED.block} texels a frame (a row was up to ${BED.maxSize})`);
  const want = mapped(ws).reduce((s, b) => s + b.baked.nx * b.baked.nz, 0);
  assert.equal(total, want, 'every texel once');
});

test('the bake on a slow clock: no frame past its budget by more than a block, done in the frames the work needs', () => {
  // a fake clock: each texel costs `cost` ms (a handheld 10 times slower than the Mac's ~2 µs a texel), a BVH 1 ms
  const ws = waters(), cost = 0.02, budget = BED.budget / 2;
  let clock = 0;
  const bedAt = ws.bedAt.bind(ws), bvhOf = ws.bvhOf.bind(ws);
  ws.bedAt = (...a) => { clock += cost; return bedAt(...a); };
  ws.bvhOf = (b) => { if (b.bvh?.geometry !== b.mesh.geometry) clock += 1; return bvhOf(b); };
  const now = performance.now;
  performance.now = () => clock;
  let frames = 0, worst = 0;
  try {
    for (; frames < 100000 && !done(ws); frames++) {
      const t = clock;
      ws.bakeStep(at, budget);
      worst = Math.max(worst, clock - t);
    }
  } finally { performance.now = now; }
  assert.ok(done(ws));
  assert.ok(worst <= budget + BED.block * cost + 1e-9, `the longest frame ${worst.toFixed(2)} ms against ${budget} ms`);
  const texels = mapped(ws).reduce((s, b) => s + b.baked.nx * b.baked.nz, 0);
  const need = Math.ceil(texels * cost / budget);
  assert.ok(frames <= need * 1.1 + 3 * mapped(ws).length, `${frames} frames, ${need} of work`);
});

test('the real cost: the lagoons\' map in well under a second, a few µs a texel (it was ~58 µs, 3.8 s)', () => {
  const ws = waters();
  const lagoons = ws.bodies.find((b) => /lagoon/i.test(b.mesh.name));
  ws.bvhOf(lagoons);   // (its BVH apart: a frame of its own)
  ws.beginBake(lagoons, at);
  const t = performance.now();
  ws.bakeRows(lagoons, Infinity);
  const ms = performance.now() - t, per = ms * 1000 / (lagoons.baked.nx * lagoons.baked.nz);
  assert.ok(per < 15, `${per.toFixed(1)} µs a texel (${ms.toFixed(0)} ms)`);
  const b = performance.now();
  lagoons.bvh = null; ws.bvhOf(lagoons);
  assert.ok(performance.now() - b < 20, 'its BVH in a few ms');
});
