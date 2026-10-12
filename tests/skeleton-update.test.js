// src/skeleton-update.js: three's Skeleton.update made from the bones' element arrays gives three's own bone matrices,
// bit for bit, on the prototype as the web game installs it (issue #111).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installSkeletonUpdate } from '../src/skeleton-update.js';
import { RENDER_FRAME } from '../src/render-frame.js';

const threeUpdate = THREE.Skeleton.prototype.update;

function rig(n) {
  const bones = [new THREE.Bone()];
  for (let i = 1; i < n; i++) { const b = new THREE.Bone(); b.position.set(0.07 * i, 0.31, -0.04 * i); b.rotation.set(0.17 * i, -0.09 * i, 0.03); bones[i - 1].add(b); bones.push(b); }
  bones[0].position.set(2.5, 1.25, -3.75);
  bones[0].updateMatrixWorld(true);
  return bones;
}

test('the installed Skeleton.update gives three\'s own bone matrices as the bones move, a frame after another', () => {
  const bones = rig(24);
  const ours = new THREE.Skeleton(bones), ref = new THREE.Skeleton(bones);
  installSkeletonUpdate(ours);   // (on this one skeleton: the prototype left as three's for the reference)
  for (let f = 0; f < 80; f++) {
    RENDER_FRAME.n++;
    for (let i = 0; i < bones.length; i++) bones[i].rotation.z = Math.sin(f * 0.21 + i) * 0.8;
    bones[3].scale.setScalar(1 + 0.1 * Math.sin(f));
    bones[0].updateMatrixWorld(true);
    ours.update(); threeUpdate.call(ref);
    assert.deepEqual(Array.from(ours.boneMatrices), Array.from(ref.boneMatrices), `frame ${f}`);
  }
});

test('a missing bone is the identity, as three has it; a new bones array is taken at once', () => {
  const bones = rig(6);
  const ours = new THREE.Skeleton(bones), ref = new THREE.Skeleton(bones);
  installSkeletonUpdate(ours);
  const holes = [...bones]; holes[2] = undefined;
  ours.bones = holes; ref.bones = holes;
  RENDER_FRAME.n++;
  ours.update(); threeUpdate.call(ref);
  assert.deepEqual(Array.from(ours.boneMatrices), Array.from(ref.boneMatrices));
  ours.bones = ref.bones = bones;
  ours.update(); threeUpdate.call(ref);
  assert.deepEqual(Array.from(ours.boneMatrices), Array.from(ref.boneMatrices));
});

test('a skinned mesh drawn through the prototype gets three\'s matrices, and its bone texture is flagged', () => {
  installSkeletonUpdate();
  assert.notEqual(THREE.Skeleton.prototype.update, threeUpdate);
  const bones = rig(8), sk = new THREE.Skeleton(bones), ref = new THREE.Skeleton(bones);
  sk.computeBoneTexture();
  const v = sk.boneTexture.version;
  RENDER_FRAME.n++;
  sk.update(); threeUpdate.call(ref);
  // (the texture's array is padded to its square: the bones' part compared)
  assert.deepEqual(Array.from(sk.boneMatrices.subarray(0, 8 * 16)), Array.from(ref.boneMatrices));
  assert.ok(sk.boneTexture.version > v, 'the bone texture marked for upload');
});
