// src/flat-pass.js: each pass drawn from the scene's flat list draws what three's walk of the scene draws, in its order.
// three's projectObject (WebGLRenderer) is copied below as the walk (what it pushes to the render list, with its group
// order), and run over the scene and over the pass's stand-in: the same draws, pass for pass, through hides, layers,
// moves, cameras turning, a level of detail's swapped geometry, a hook, a group's render order, a mesh cut into tiles.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installMatrixCache } from '../src/matrix-cache.js';
import { updateSceneMatrices, watchSceneEdits } from '../engine/scene-matrices.js';
import { FlatPass } from '../src/flat-pass.js';

installMatrixCache();
watchSceneEdits();

/** three's projectObject (r186), what it pushes: [object id, group order], in order (a mesh drawing nothing left out). */
function walk(scene, camera) {
  const out = [], fr = new THREE.Frustum(), pm = new THREE.Matrix4();
  if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
  pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  fr.setFromProjectionMatrix(pm, THREE.WebGLCoordinateSystem, camera.reversedDepth);
  const project = (o, groupOrder) => {
    if (o.visible === false) return;
    if (o.layers.test(camera.layers)) {
      if (o.isGroup) groupOrder = o.renderOrder;
      else if (o.isMesh || o.isLine || o.isPoints) {
        if (!o.frustumCulled || o.intersectsFrustum(fr)) {
          const nothing = o.isInstancedMesh ? o.count === 0 : o.geometry.drawRange.count === 0;
          if (o.material.visible && !nothing) out.push(`${o.id}:${groupOrder}`);
        }
      }
    }
    for (const c of o.children) project(c, groupOrder);
  };
  project(scene, 0);
  return out;
}

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function world(seed) {
  const r = rng(seed), scene = new THREE.Scene(), meshes = [], groups = [];
  const box = new THREE.BoxGeometry(1, 1, 1), mat = new THREE.MeshBasicMaterial();
  const put = (o, parent) => { o.position.set(r() * 80 - 40, r() * 6 - 3, r() * 80 - 40); o.rotation.set(r(), r() * 6, r()); o.scale.setScalar(0.5 + r() * 2); parent.add(o); return o; };
  for (let g = 0; g < 12; g++) {
    const grp = put(new THREE.Group(), scene); groups.push(grp);
    const sub = put(new THREE.Object3D(), grp);
    for (let k = 0; k < 14; k++) {
      const m = put(new THREE.Mesh(box, mat), k % 3 ? grp : sub); meshes.push(m);
      if (k === 5) meshes.push(put(new THREE.Mesh(box, mat), m));   // (a mesh under a mesh)
    }
    // a rig: bones only (nothing drawn), and a skinned mesh beside it
    let b = put(new THREE.Bone(), grp); for (let i = 0; i < 4; i++) b = put(new THREE.Bone(), b);
    const sk = put(new THREE.SkinnedMesh(box, mat), grp); sk.frustumCulled = false; meshes.push(sk);
  }
  // instanced, with and without its own bounds; one holding nothing
  const inst = put(new THREE.InstancedMesh(box, mat, 4), scene); for (let i = 0; i < 4; i++) inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * 3, 0, 0)); inst.computeBoundingSphere(); meshes.push(inst);
  const instNull = put(new THREE.InstancedMesh(box, mat, 2), scene); meshes.push(instNull);
  // a mesh cut into tiles (perf.js tileSceneSteps): itself drawing nothing, its tiles its children
  const tiled = put(new THREE.Mesh(box.clone(), mat), scene); tiled.geometry.setDrawRange(0, 0);
  for (let t = 0; t < 20; t++) meshes.push(put(new THREE.Mesh(box, mat), tiled));
  // unculled, hooked, a group with a render order, a mesh in another layer
  const big = put(new THREE.Mesh(box, mat), scene); big.frustumCulled = false; meshes.push(big);
  const hooked = put(new THREE.Mesh(box, mat), scene); hooked.onBeforeRender = () => {}; meshes.push(hooked);
  const ordered = put(new THREE.Group(), scene); ordered.renderOrder = 3; for (let k = 0; k < 4; k++) meshes.push(put(new THREE.Mesh(box, mat), ordered));
  const other = put(new THREE.Mesh(box, mat), scene); other.layers.set(2); meshes.push(other);
  put(new THREE.Mesh(box, mat), other);   // (its child is still walked: the layers stop only the mesh itself)
  return { r, scene, meshes, groups, tiled, ordered, inst };
}

const persp = () => { const c = new THREE.PerspectiveCamera(50, 1.5, 0.1, 60); return c; };
const ortho = () => new THREE.OrthographicCamera(-15, 15, 15, -15, -50, 50);

test('each pass from the flat list draws what the walk draws, in its order', () => {
  for (const seed of [1, 2, 3, 7]) {
    const w = world(seed), { r, scene, meshes, groups } = w;
    const flat = new FlatPass(scene);
    const cams = [persp(), ortho()];
    for (let f = 0; f < 40; f++) {
      // the frame's changes: moves, hides, a geometry swapped, layers, a render order turned on and off
      for (const m of meshes) if (r() < 0.15) m.position.x += r() * 4 - 2;
      for (const m of meshes) if (r() < 0.1) m.visible = !m.visible;
      for (const g of groups) if (r() < 0.08) g.visible = !g.visible;
      if (r() < 0.2) w.ordered.renderOrder = w.ordered.renderOrder ? 0 : 3;
      if (r() < 0.3) { const m = meshes[(r() * meshes.length) | 0]; if (!m.isInstancedMesh && !m.isSkinnedMesh) m.geometry = new THREE.BoxGeometry(1 + r(), 1, 1); }
      if (r() < 0.2) w.inst.count = w.inst.count ? 0 : 4;
      if (r() < 0.1) w.tiled.visible = !w.tiled.visible;
      for (const c of cams) { c.position.set(r() * 40 - 20, r() * 10, r() * 40 - 20); c.lookAt(r() * 40 - 20, 0, r() * 40 - 20); c.layers.mask = r() < 0.2 ? 5 : 1; }
      scene.matrixWorldAutoUpdate = true;
      updateSceneMatrices(scene);
      scene.matrixWorldAutoUpdate = false;
      flat.begin();
      assert.ok(flat.active, 'the list is the frame\'s');
      for (const c of cams) {
        // (between passes, as the shadow passes do: some hidden for one pass only)
        const off = meshes.filter(() => r() < 0.1).filter((m) => m.visible);
        for (const m of off) m.visible = false;
        const proxy = flat.sceneFor(c);
        assert.notEqual(proxy, scene);
        assert.deepEqual(walk(proxy, c), walk(scene, c), `seed ${seed}, frame ${f}, ${c.type}`);
        for (const m of off) m.visible = true;
      }
      flat.end();
    }
    assert.ok(flat.stats.dropped > 0, 'some meshes culled from the list');
  }
});

test('a scene edited since the matrices is drawn by the walk', () => {
  const w = world(5), flat = new FlatPass(w.scene);
  updateSceneMatrices(w.scene);
  updateSceneMatrices(w.scene);
  w.scene.matrixWorldAutoUpdate = false;
  flat.begin();
  assert.ok(flat.active);
  w.scene.add(new THREE.Mesh());
  assert.equal(flat.sceneFor(persp()), w.scene);
  flat.end();
  flat.on = false;
  updateSceneMatrices(w.scene); updateSceneMatrices(w.scene);
  flat.begin();
  assert.equal(flat.sceneFor(persp()), w.scene, 'off: the scene itself');
});
