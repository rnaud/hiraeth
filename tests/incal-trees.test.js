import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createIncal } from '../src/levels/incal.js';
import { cullFar } from '../src/perf.js';

const quiet = (fn) => { const w = console.warn, i = console.info; console.warn = console.info = () => {}; try { return fn(); } finally { console.warn = w; console.info = i; } };

test("the City-Shaft's trees come in pieces the view and the shadow maps can leave out", () => {
  const scene = new THREE.Scene();
  const level = quiet(() => createIncal(scene));
  const trees = [];
  scene.traverse((o) => { if (o.isInstancedMesh && o.material?.uniforms?.uPattern?.value === 3) trees.push(o); });
  assert.ok(trees.length > 30, `${trees.length} tree meshes`);
  let n = 0;
  for (const t of trees) {
    t.computeBoundingSphere();
    // a whole terrace's ring of trees in one mesh measured ~300-400 m across: never culled
    assert.ok(t.boundingSphere.radius < 200, `tree mesh radius ${t.boundingSphere.radius.toFixed(0)} m`);
    assert.equal(t.userData.drawFar, Infinity, 'still drawn right across the shaft');
    assert.ok(level.smallProps.includes(t), 'kept out of the far shadow map with the small props');
    n += t.count;
  }
  assert.ok(n > 5000, `${n} trees`);
});

test('cullFar: a tile with its own drawFar keeps it', () => {
  const geo = new THREE.BoxGeometry(1, 1, 1), mat = new THREE.MeshBasicMaterial();
  geo.computeBoundingSphere();
  const near = new THREE.Mesh(geo, mat), far = new THREE.Mesh(geo, mat), kept = new THREE.Mesh(geo, mat);
  near.position.set(0, 0, 100); far.position.set(0, 0, 900); kept.position.set(0, 0, 900);
  kept.userData.drawFar = Infinity;
  for (const m of [near, far, kept]) m.updateMatrixWorld();
  const camera = new THREE.PerspectiveCamera();
  const hidden = cullFar([near, far, kept], camera, 320);
  assert.deepEqual(hidden, [far]);
  assert.equal(kept.visible, true);
});
