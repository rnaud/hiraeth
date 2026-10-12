// three's Skeleton.update (each bone's world matrix times its inverse bind, into boneMatrices) from the bones' and the
// inverses' element arrays kept on the skeleton: the same products in the same order, written into the same Float32Array
// (three multiplies into a Matrix4 and copies it in with toArray; one rounding to 32 bits either way: bit for bit,
// tests/engine-bridge.test.js and tests/skeleton-update.test.js). The walk to them through each bone (a bone's shape is
// one of many, every load a megamorphic one in V8) was most of its cost: on the Unity bridge 1 400 bones a frame took
// 2.4 ms that way and 0.24 ms so (engine/mirror.js, round 7); in the web game it is three's own call from each pass
// (WebGLObjects.update), ~3 ms a frame at the desert's camps on the Steam Deck (issue #111), so
// installSkeletonUpdate() puts it on Skeleton's prototype.
import * as THREE from 'three';
import { RENDER_FRAME } from './render-frame.js';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** One skeleton's bone matrices (the arrays looked up again every 32 frames f, or when the bones or inverses change). */
export function skeletonUpdate(sk, f) {
  const bones = sk.bones, inv = sk.boneInverses, out = sk.boneMatrices;
  let c = sk.__mirrorEls;
  if (!c || f - c.at >= 32 || c.n !== bones.length || c.of !== bones || c.inv !== inv) {
    const n = bones.length, A = new Array(n), Bm = new Array(n);
    for (let i = 0; i < n; i++) { A[i] = bones[i] ? bones[i].matrixWorld.elements : IDENTITY; Bm[i] = inv[i].elements; }
    c = sk.__mirrorEls = { at: f, n, of: bones, inv, A, B: Bm };
  }
  const A = c.A, Bm = c.B;
  for (let i = 0, n = c.n; i < n; i++) {
    const ae = A[i], be = Bm[i], o = i * 16;
    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];
    out[o] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    out[o + 4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    out[o + 8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    out[o + 12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
    out[o + 1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    out[o + 5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    out[o + 9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    out[o + 13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
    out[o + 2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    out[o + 6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    out[o + 10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    out[o + 14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
    out[o + 3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    out[o + 7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    out[o + 11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    out[o + 15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
  }
  if (sk.boneTexture) sk.boneTexture.needsUpdate = true;
}

let installed = false;
/** Once, at startup (main.js): every skeleton's update made this way, its frame the render frame's count. */
export function installSkeletonUpdate(proto = THREE.Skeleton.prototype) {
  if (installed && proto === THREE.Skeleton.prototype) return;
  proto.update = function update() { skeletonUpdate(this, RENDER_FRAME.n); };
  if (proto === THREE.Skeleton.prototype) installed = true;
}
