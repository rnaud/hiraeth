// The level's collision BVH swapped for a second one built behind it (src/physics.js Physics.refine, Physics.create
// o.later; issue #300: the City-Shaft loads on a CENTER BVH and queries an SAH one from about two seconds on).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH, SAH } from 'three-mesh-bvh';
import { Physics } from '../src/physics.js';

/** A small town: a ground, houses, a crooked tower, so the two BVHs split it differently. */
function town() {
  const scene = new THREE.Scene();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 8, 8)); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  for (let i = 0; i < 24; i++) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(3 + (i % 3), 2 + (i % 5), 4)); h.position.set(((i * 7) % 60) - 30, 1, ((i * 11) % 60) - 30); h.rotation.y = i * 0.37; scene.add(h);
  }
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1, 2, 20, 12)); tower.position.set(4, 10, -6); tower.rotation.z = 0.2; scene.add(tower);
  return scene;
}
/** A worker that builds on the main thread (node has none), as GenerateMeshBVHWorker does in a page. */
const inPlace = () => ({ generate: async (g, o) => new MeshBVH(g, o), dispose() { this.gone = true; } });
const copy = (g) => { const c = new THREE.BufferGeometry(); c.setAttribute('position', new THREE.BufferAttribute(g.attributes.position.array.slice(), 3)); return c; };
const probes = (p) => {
  const out = [];
  for (let x = -36; x <= 36; x += 4.5) for (let z = -36; z <= 36; z += 5.5) {
    out.push(+p.groundAt(x, 30, z).toFixed(5), p.embedded(new THREE.Vector3(x, 0.8, z)), +p.rayDistance(new THREE.Vector3(x, 1.5, z), new THREE.Vector3(1, 0, 0), 50).toFixed(5));
  }
  return out;
};

test('the refined BVH is swapped in and answers as the first did', async () => {
  const p = new Physics(town()), before = probes(p), first = p.bvh;
  assert.equal(await p.refine(copy(p.geometry), { strategy: SAH }, inPlace), true);
  assert.notEqual(p.bvh, first, 'a new BVH in use');
  assert.equal(p.geometry, p.bvh.geometry, 'with its own copy of the triangles');
  assert.deepEqual(probes(p), before, 'the same ground, the same solids, the same rays');
});

test('behind the colliders added later (the ship), the level\'s own BVH is the one swapped', async () => {
  const p = new Physics(town());
  const ship = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 10)); ship.position.set(30, 6, 30);
  p.addCollider(ship);
  const before = probes(p), composite = p.bvh;
  assert.equal(await p.refine(copy(p.geometry), { strategy: SAH }, inPlace), true);
  assert.equal(p.bvh, composite, 'the composite stays');
  assert.equal(p.levelBVH.geometry, p.geometry, 'the level\'s part is the new one');
  assert.deepEqual(probes(p), before);
  assert.ok(Math.abs(p.groundAt(30, 20, 30) - 7) < 1e-6, 'and the ship is still stood on');
});

test('a build that fails leaves the first BVH, and the worker is let go either way', async () => {
  const p = new Physics(town()), first = p.bvh;
  let w = null;
  const failing = () => (w = { generate: async () => { throw new Error('no worker'); }, dispose() { this.gone = true; } });
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(await p.refine(copy(p.geometry), { strategy: SAH }, failing), false); } finally { console.warn = warn; }
  assert.equal(p.bvh, first);
  assert.ok(w.gone, 'disposed');
});

test('the City-Shaft asks for it; with no Worker (node) create builds the one BVH as before', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/levels/incal.js', import.meta.url), 'utf8');
  assert.match(src, /collision: \{ later: 'SAH' \}/);
  const p = await Physics.create(town(), null, null, { later: 'SAH' });
  assert.equal(p.refined, undefined, 'nothing started without a Worker');
  assert.ok(p.bvh && p.groundAt(-36, 30, -36) > -0.01);
});

test('with no Worker (node) create builds its BVH on the triangles it baked: no failed worker, no second bake', async () => {
  const warned = [], warn = console.warn;
  console.warn = (...a) => warned.push(a.join(' '));
  try {
    const scene = town(), sync = new Physics(scene);
    const p = await Physics.create(scene);
    assert.deepEqual(warned.filter((w) => /BVH worker/.test(w)), [], 'no "BVH worker failed" warning');
    assert.equal(p.triangles, sync.triangles);
    assert.equal(p.bvh?.geometry, p.geometry, 'the BVH is over the baked geometry');
    assert.ok(Math.abs(p.groundAt(-36, 30, -36) - sync.groundAt(-36, 30, -36)) < 1e-6);
  } finally { console.warn = warn; }
});
