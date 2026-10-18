// A material's instanced meshes drawn by one draw a pass (src/instance-merge.js, issue #453): which meshes are merged,
// the instances copied in the order three would have drawn them, the sorted pass cut into runs, anything changed since
// drawn by itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { InstanceMerge, mergeCandidate } from '../src/instance-merge.js';

const geo = new THREE.BoxGeometry(1, 1, 1), geo2 = new THREE.SphereGeometry(1, 6, 4);
function inst(material, g, xs, colours = false) {
  const m = new THREE.InstancedMesh(g, material, xs.length);
  xs.forEach((x, i) => { m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0, -10)); if (colours) m.setColorAt(i, new THREE.Color(i / 10, 0, 0)); });
  m.computeBoundingSphere();
  return m;
}
function setup(list) {
  const scene = new THREE.Scene();
  for (const o of list) scene.add(o);
  scene.updateMatrixWorld(true);
  const objs = []; scene.traverse((o) => objs.push(o));
  const M = new InstanceMerge();
  M.build(objs, objs.length);
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const pm = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return { scene, M, cam, pm };
}
const xsOf = (mesh) => { const out = []; for (let i = 0; i < mesh.count; i++) out.push(mesh.instanceMatrix.array[i * 16 + 12]); return out; };

test('which instanced meshes may be merged: plain, opaque, culled, no hook, no children', () => {
  const m = new THREE.MeshBasicMaterial();
  assert.equal(mergeCandidate(inst(m, geo, [0])), true);
  assert.equal(mergeCandidate(new THREE.Mesh(geo, m)), false);
  const hook = inst(m, geo, [0]); hook.onBeforeRender = () => {};
  assert.equal(mergeCandidate(hook), false);
  const unculled = inst(m, geo, [0]); unculled.frustumCulled = false;
  assert.equal(mergeCandidate(unculled), false);
  assert.equal(mergeCandidate(inst(new THREE.MeshBasicMaterial({ transparent: true }), geo, [0])), false);
});

test('a material is merged only when nothing else draws it', () => {
  const a = new THREE.MeshBasicMaterial(), b = new THREE.MeshBasicMaterial();
  const { M } = setup([inst(a, geo, [0]), inst(a, geo, [2]), inst(b, geo, [0]), inst(b, geo, [2]), new THREE.Mesh(geo, b)]);
  assert.equal(M.groups.length, 1);
  assert.equal(M.groups[0].material, a);
});

test('an unsorted pass: the meshes of one shape drawn by one, their instances in the order handed', () => {
  const a = new THREE.MeshBasicMaterial();
  const p = inst(a, geo, [0, 1]), q = inst(a, geo2, [5]), r = inst(a, geo, [3], false), other = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  const { M, cam, pm } = setup([p, q, r, other]);
  const out = [p, other, q, r];
  M.apply(out, cam, pm, false);
  assert.equal(out.length, 3, 'p and r in one draw');
  const merged = out[0];
  assert.ok(merged.isInstancedMesh && merged.userData.merged && merged !== p);
  assert.equal(merged.geometry, geo); assert.equal(merged.material, a);
  assert.deepEqual(xsOf(merged), [0, 1, 3]);
  assert.deepEqual(out.slice(1), [other, q]);
  // (the same again: nothing copied)
  const copies = M.stats.copies;
  const again = [p, other, q, r];
  M.apply(again, cam, pm, false);
  assert.equal(again[0], merged); assert.equal(M.stats.copies, copies);
  // (an instance moved: copied again)
  r.setMatrixAt(0, new THREE.Matrix4().makeTranslation(4, 0, -10)); r.instanceMatrix.needsUpdate = true;
  M.apply([p, other, q, r], cam, pm, false);
  assert.deepEqual(xsOf(merged), [0, 1, 4]);
});

test('a sorted pass: three\'s order (screen depth, then id) kept, merged only in runs of one shape', () => {
  const a = new THREE.MeshBasicMaterial();
  // (one world matrix for a run: the meshes' depths from their own spheres, the nearer drawn first)
  const mk = (x) => { const o = inst(a, geo, [x]); return o; };
  const A = mk(-1), B = mk(-2), C = inst(a, geo2, [-3]), D = mk(-4), E = mk(-5);
  const { M, cam, pm } = setup([A, B, C, D, E]);
  for (const [o, z] of [[A, -10], [B, -11], [C, -12], [D, -13], [E, -14]]) { o.boundingSphere.center.set(0, 0, z); }
  const out = [E, C, A, D, B];
  M.apply(out, cam, pm, true);
  // (A, B by depth, then C alone, then D, E)
  assert.equal(out.length, 3);
  const merged = out.filter((o) => o.userData.merged);
  assert.equal(merged.length, 2);
  const xs = merged.map(xsOf).sort((p, q) => q[0] - p[0]);
  assert.deepEqual(xs, [[-1, -2], [-4, -5]]);
  assert.ok(out.includes(C));
  // (each run sorts where its first was)
  for (const m of merged) assert.ok(m.boundingSphere === A.boundingSphere || m.boundingSphere === D.boundingSphere);
});

test('changed since the groups were made, or holding nothing: drawn by itself', () => {
  const a = new THREE.MeshBasicMaterial();
  const p = inst(a, geo, [0]), q = inst(a, geo, [1]), r = inst(a, geo, [2]);
  const { M, cam, pm } = setup([p, q, r]);
  q.material = new THREE.MeshBasicMaterial();
  r.count = 0;
  const out = [p, q, r];
  M.apply(out, cam, pm, false);
  assert.deepEqual(out, [p, q, r]);
  M.on = false;
  q.material = a; r.count = 1;
  const off = [p, q, r];
  M.apply(off, cam, pm, false);
  assert.deepEqual(off, [p, q, r], 'off: nothing merged');
});

test('a tiles\' source (count 0, the tiles its children) does not keep its tiles from merging', () => {
  const a = new THREE.MeshBasicMaterial();
  const src = inst(a, geo, [0, 1]); src.count = 0;
  const t1 = inst(a, geo, [0]), t2 = inst(a, geo, [1]);
  src.add(t1, t2);
  const { M, cam, pm } = setup([src]);
  assert.equal(M.groups.length, 1);
  const out = [t1, t2];
  M.apply(out, cam, pm, false);
  assert.equal(out.length, 1);
  src.count = 2;   // (drawing again: a sorted pass leaves the group alone)
  const sorted = [t1, t2];
  M.apply(sorted, cam, pm, true);
  assert.deepEqual(sorted, [t1, t2]);
});

test('instance colours copied with the matrices', () => {
  const a = new THREE.MeshBasicMaterial();
  const p = inst(a, geo, [0, 1], true), q = inst(a, geo, [2], true);
  const { M, cam, pm } = setup([p, q]);
  const out = [p, q];
  M.apply(out, cam, pm, false);
  assert.deepEqual([...out[0].instanceColor.array.slice(0, 9)], [...p.instanceColor.array.slice(0, 6), ...q.instanceColor.array.slice(0, 3)]);
});
