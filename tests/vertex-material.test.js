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
