// Meshes of one surface shader merged into one draw, each keeping its own material values and object space
// (src/vertex-material.js, materials.js S_VMAT; docs/systems/performance.md): the City-Shaft's towers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { makeMaterial, surfaceDefines, SURFACE_FEATURES, MODE_STRATA } from '../src/materials.js';
import { mergeWithMaterials, restKey, VERTEX_UNIFORMS } from '../src/vertex-material.js';

const tower = (c, size, grid, flat) => makeMaterial({ color: c, color2: '#ead7b5', color3: '#f3ead8', mode: MODE_STRATA, strataSize: size, grid, flat });

test('the per-vertex material is its own feature, and only where asked', () => {
  assert.equal(surfaceDefines({ color: '#fff', mode: MODE_STRATA, grid: 3, perVertex: true }).S_VMAT, 1);
  assert.equal(surfaceDefines({ color: '#fff', mode: MODE_STRATA, grid: 3 }).S_VMAT, undefined);
  assert.ok(!SURFACE_FEATURES.includes('S_VMAT'), 'a shader made without SURFACE_SPEC never expects the attributes');
  const src = readFileSync(new URL('../src/materials.js', import.meta.url), 'utf8');
  for (const u of VERTEX_UNIFORMS) assert.match(src, new RegExp(`#define ${u} vMat`), `${u} read from the vertex`);
  assert.match(src, /flat out vec3 vMatC1;/);
  assert.match(src, /vObjPos = aObjP; vObjNormal = aObjN;/);
});

test('towers merged: each vertex carries its own colours, bands, grid, flat shading, object point and place', () => {
  const a = tower('#f1e6cf', 3.1, 2.8, true), b = tower('#dcc6a4', 4.4, 4.1, false);
  assert.equal(restKey(a), restKey(b), 'they differ only in what goes per vertex');
  assert.notEqual(restKey(a), restKey(makeMaterial({ color: '#f1e6cf', mode: MODE_STRATA, grid: 3, windows: 0.2 })));
  const ga = new THREE.CylinderGeometry(3, 4, 20, 6, 2).translate(0, 10, 0), gb = new THREE.BoxGeometry(4, 8, 4).translate(0, 4, 0);
  const g = mergeWithMaterials([{ geometry: ga, x: 100, y: -40, z: 30, rotY: 1.1, material: a }, { geometry: gb, x: -50, y: 0, z: 220, rotY: 4, material: b }]);
  const nA = ga.attributes.position.count;
  const at = (name, i) => Array.from(g.attributes[name].array.slice(i * g.attributes[name].itemSize, (i + 1) * g.attributes[name].itemSize));
  const near = (x, y) => x.every((v, k) => Math.abs(v - y[k]) < 1e-5);
  assert.ok(near(at('aMatC1', 0), new THREE.Color('#f1e6cf').toArray()) && near(at('aMatC1', nA), new THREE.Color('#dcc6a4').toArray()));
  assert.ok(near(at('aMatS', 0), [3.1, 2.8, 1]) && near(at('aMatS', nA), [4.4, 4.1, 0]));
  assert.ok(near(at('aObjM', nA + 3), [-50, 0, 220, 4]));
  // the object point is the tower's own; the drawn one is it placed as Object3D would place it
  const o = new THREE.Object3D(); o.position.set(100, -40, 30); o.rotation.y = 1.1; o.updateMatrixWorld();
  for (const i of [0, 5, nA - 1]) {
    assert.ok(near(at('aObjP', i), at('aObjP', i)) && near(at('aObjP', i), Array.from(ga.attributes.position.array.slice(i * 3, i * 3 + 3))));
    const w = new THREE.Vector3(...at('aObjP', i)).applyMatrix4(o.matrixWorld);
    assert.ok(near(at('position', i), w.toArray()), 'placed');
  }
  // the camera-relative point the shader takes facet normals from: the object's frame, as its own model matrix gave it
  const cam = new THREE.Vector3(7, 30, -12), [x, y, z, r] = at('aObjM', 0), c = Math.cos(r), s = Math.sin(r), d = cam.clone().sub(new THREE.Vector3(x, y, z));
  const local = new THREE.Vector3(c * d.x - s * d.z, d.y, s * d.x + c * d.z), want = cam.clone().applyMatrix4(o.matrixWorld.clone().invert());
  assert.ok(local.distanceTo(want) < 1e-4, `the camera in its frame (${local.distanceTo(want)})`);   // (its place and turn stored as 32-bit floats)
});

test('a shopfront\'s colour buckets merged (shop-kit.js build merge): fewer meshes, each piece its own colour and object point, solid and soft kept apart', async () => {
  const { buckets } = await import('../src/shop-kit.js');
  const { buildStyledFront, FRONT_STYLES } = await import('../src/shop-fronts.js');
  const B = buckets(), g = new THREE.Group();
  g.position.set(120, 4, -60); g.rotation.y = 0.7;
  B.add('#d9503f', new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
  B.add('#70e7df', new THREE.BoxGeometry(1, 2, 1).translate(2, 1, 0));
  B.add('#b07a45', new THREE.SphereGeometry(0.3, 8, 6), { soft: true });
  B.add('#f2c54b', new THREE.SphereGeometry(0.3, 8, 6).translate(1, 0, 0), { soft: true });
  B.add('#ffd9a0', new THREE.BoxGeometry(1, 1, 0.1), { soft: true, glow: 1 });
  const meshes = B.build(g, { merge: true });
  assert.equal(meshes.length, 3, 'the solid pair, the soft pair, the lit one');
  const solid = meshes.find((m) => !m.userData.noCollide);
  assert.ok(solid.material.defines?.S_VMAT !== undefined || JSON.stringify(solid.material.defines ?? {}).includes('S_VMAT'), 'a per-vertex material');
  const c = solid.geometry.attributes.aMatC1, p = solid.geometry.attributes.position, op = solid.geometry.attributes.aObjP;
  const cols = new Set(); for (let i = 0; i < c.count; i++) cols.add(new THREE.Color(c.getX(i), c.getY(i), c.getZ(i)).getHexString());
  assert.deepEqual([...cols].sort(), ['70e7df', 'd9503f'].map((h) => new THREE.Color(`#${h}`).getHexString()).sort());
  for (let i = 0; i < p.count; i++) assert.equal(p.getY(i), op.getY(i), 'drawn in the group\'s frame, its object point as before');
  const M = solid.geometry.attributes.aObjM;
  assert.ok(Math.abs(M.getX(0) - 120) < 1e-6 && Math.abs(M.getW(0) - 0.7) < 1e-6, 'the group\'s place and turn');
  // every route world's front in at most 10 meshes (a mesh a colour before)
  for (const style of FRONT_STYLES) {
    const scene = new THREE.Scene(), f = buildStyledFront(scene, { at: new THREE.Vector3(10, 0, 10), heading: 1.2, style });
    let n = 0; f.group.traverse((o) => { if (o.isMesh) n++; });
    assert.ok(n <= 10, `${style}: ${n} meshes`);
  }
});
