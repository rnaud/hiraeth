// engine/mirror.js walking the scene's flat list (engine/scene-matrices.js) tells the backend exactly what its walk
// down the scene does: the same calls, in the same order, through moves, hiding, a prop put in a hand and taken out,
// instances and bones.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installMatrixCache } from '../src/matrix-cache.js';
import { watchSceneEdits } from '../engine/scene-matrices.js';
import { SceneMirror } from '../engine/mirror.js';
import { makeMaterial } from '../src/materials.js';

installMatrixCache();
watchSceneEdits();

/** A backend writing down every call (arrays copied: the mirror hands its own). */
function recorder() {
  const log = [];
  const copy = (a) => (ArrayBuffer.isView(a) ? Array.from(a) : a && typeof a === 'object' && !a.isObject3D && !a.isBufferGeometry && !a.isMaterial ? JSON.parse(JSON.stringify(a, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v?.isObject3D || v?.isBufferGeometry || v?.isMaterial ? '[ref]' : v))) : a?.isObject3D || a?.isBufferGeometry || a?.isMaterial ? '[ref]' : a);
  const B = {};
  for (const name of ['geometry', 'material', 'create', 'transforms', 'visible', 'geometryOf', 'vertices', 'instances', 'materialLive', 'keyWeights', 'skeleton', 'remove', 'camera', 'frame']) {
    B[name] = (...args) => {
      if (name === 'transforms') { const [ids, mats, n] = args; log.push([name, Array.from(ids.subarray(0, n)), Array.from(mats.subarray(0, n * 16))]); return; }
      log.push([name, ...args.map(copy)]);
    };
  }
  B.quietWalk = true;
  return { B, log };
}

function world(seed) {
  let s = seed;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const scene = new THREE.Scene(), all = [];
  const mat = makeMaterial({ color: '#808080' });
  const put = (o, p) => { o.position.set(r() * 8, r() * 2, r() * 8); p.add(o); all.push(o); return o; };
  for (let g = 0; g < 4; g++) { const grp = put(new THREE.Group(), scene); for (let k = 0; k < 4; k++) put(new THREE.Mesh(new THREE.BoxGeometry(), mat), grp); }
  const hidden = put(new THREE.Group(), scene); put(new THREE.Mesh(new THREE.BoxGeometry(), mat), hidden); hidden.visible = false;
  const bones = [put(new THREE.Bone(), scene)];
  for (let i = 1; i < 10; i++) bones.push(put(new THREE.Bone(), bones[i - 1]));
  const skinned = put(new THREE.SkinnedMesh(new THREE.BoxGeometry(), mat), scene);
  scene.updateMatrixWorld(true);
  skinned.bind(new THREE.Skeleton(bones));
  const inst = put(new THREE.InstancedMesh(new THREE.BoxGeometry(), mat, 8), scene);
  return { scene, all, r, hidden, bones, inst, mat };
}

function step(w, f) {
  for (let k = 0; k < 4; k++) w.all[Math.floor(w.r() * w.all.length)].position.y += 0.1;
  w.bones[2].rotation.z = f * 0.1;
  if (f === 5) w.hidden.visible = true;
  if (f === 9) w.all[0].visible = false;
  if (f === 12) w.bones[6].add(new THREE.Mesh(new THREE.BoxGeometry(), w.mat));   // (a prop in a hand)
  if (f === 16) w.bones[6].remove(w.bones[6].children.find((c) => c.isMesh));
  if (f % 4 === 0) { w.inst.setMatrixAt(f % 8, new THREE.Matrix4().makeTranslation(f, 0, 0)); w.inst.instanceMatrix.needsUpdate = true; }
}

test('the mirror walking the scene\'s list tells the backend what its walk down the scene does, call for call', () => {
  const A = world(5), B = world(5);
  const a = recorder(), b = recorder();
  const mA = new SceneMirror(a.B, { quietWalk: true, listMatrices: true }), mB = new SceneMirror(b.B, { quietWalk: true, listMatrices: false });
  const cam = new THREE.PerspectiveCamera();
  for (let f = 1; f <= 24; f++) {
    step(A, f); step(B, f);
    mA.sync(A.scene, cam); mB.sync(B.scene, cam);
    assert.deepEqual(a.log.filter((x) => x[0] !== 'frame'), b.log.filter((x) => x[0] !== 'frame'), `frame ${f}`);
    assert.equal(mA.stats.visited, mB.stats.visited);
    a.log.length = 0; b.log.length = 0;
  }
});
