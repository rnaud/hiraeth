import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Footprints } from '../src/life.js';
import { fitBounds } from '../src/perf.js';

// The prints left in the sand vanished as the camera turned: fitBounds (run once the world is
// built) gave the footprints' instanced mesh fixed bounds round its empty pool, a 1 m sphere at the
// origin, so they were frustum-culled whenever the camera turned that spot out of view.

const drawn = (mesh, camera) => {
  if (!mesh.visible) return false;
  if (!mesh.frustumCulled) return true;
  camera.updateMatrixWorld(true);
  const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  return f.intersectsObject(mesh);
};

test('the footprints are drawn wherever they are, whichever way the camera looks, after the bounds are fitted', () => {
  const scene = new THREE.Scene();
  const prints = new Footprints(scene);
  scene.updateMatrixWorld(true);
  fitBounds(scene);   // as main.js, after the world is built: nothing walked yet
  assert.equal(prints.mesh.frustumCulled, false, 'never given fixed bounds');
  // a walk 60 m from the origin, the camera behind, looking along it, the origin far behind it
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 12; i++) prints.add(new THREE.Vector3(60 + i * 0.7, 0, (i % 2) * 0.2), Math.PI / 2, up);
  prints.update(1 / 60);
  for (const yaw of [0, 0.6, -0.6, 1.2]) {
    const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 2000);
    cam.position.set(56, 3, 0);
    cam.lookAt(56 + 10 * Math.cos(yaw), 0, 10 * Math.sin(yaw));
    assert.ok(drawn(prints.mesh, cam), `drawn with the camera turned ${yaw} rad`);
  }
  assert.equal(prints.mesh.instanceMatrix.usage, THREE.DynamicDrawUsage, 'rewritten every frame');
});

test('fitBounds leaves an instanced pool with nothing placed yet unculled, and still fits a placed one', () => {
  const scene = new THREE.Scene();
  const geo = new THREE.BoxGeometry(1, 1, 1), mat = new THREE.MeshBasicMaterial();
  const pool = new THREE.InstancedMesh(geo, mat, 8);
  const placed = new THREE.InstancedMesh(geo, mat, 8);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 8; i++) { pool.setMatrixAt(i, m.makeScale(0, 0, 0)); placed.setMatrixAt(i, m.makeTranslation(i * 3, 0, 40)); }
  for (const o of [pool, placed]) { o.frustumCulled = false; scene.add(o); }
  scene.updateMatrixWorld(true);
  assert.equal(fitBounds(scene), 1);
  assert.equal(pool.frustumCulled, false, 'the empty pool: no point-sized bounds at the origin');
  assert.equal(placed.frustumCulled, true, 'the placed set is culled by its real bounds');
  assert.ok(placed.boundingSphere.center.z > 30);
});
