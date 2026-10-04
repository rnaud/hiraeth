import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { FLUID_TONES } from '../fluid-tool.js';

// The desert's magical water is the backpack's fluid: the same FLUID shader
// (materials.js, makeMaterial({ fluid })) and the same tones (fluid-tool.js),
// so the pool, the stream and the well visibly match the tank.
//
// The shader paints a surface from its object-space shape (an angle round
// +y, and a height): the pool is built as a cone in object space (height =
// distance from the centre) and squashed flat by its mesh, so the fluid's
// blobs drift round and across the pool; a stream is a half-cylinder
// (height = along the channel), squashed into a strip.

export const MAGIC_TONES = FLUID_TONES;
const DIM = new THREE.Color('#4a4f63');
const _c = new THREE.Color();

/** A material for one magic surface (its own uniforms, so it can dim and brighten on its own). */
export function magicMaterial(seed = 0, { aspect = 0.6 } = {}) {
  const m = makeMaterial({ color: '#ffffff', fluid: 'glob', glow: 1, flat: true, fluidBox: [0, 1, aspect, 0], magic: seed, side: THREE.DoubleSide });
  setMagic(m, 0, { bright: 1 });
  return m;
}

/**
 * Drive a magic surface: `t` its own clock (slow is calm), `bright` 0 (dull,
 * waiting) … 1 (alive), `tones` how many of the fluid's tones are in it.
 */
export function setMagic(mat, t, { bright = 1, tones = 6, speed = 0.25 } = {}) {
  const U = mat.uniforms;
  U.uFluidA.value.set(1, tones, t * speed, 2);
  U.uFluidTones.value.forEach((c, i) => c.copy(_c.set(MAGIC_TONES[i % MAGIC_TONES.length])).lerp(DIM, (1 - bright) * 0.7));
}

/** A flat pool of `radius` (a mesh: lay it where the water stands). */
export function magicPool(radius, mat, { rings = 10, segs = 48 } = {}) {
  const pos = [], idx = [];
  pos.push(0, 0, 0);
  for (let r = 1; r <= rings; r++) for (let s = 0; s < segs; s++) {
    const a = (s / segs) * Math.PI * 2, k = r / rings;
    pos.push(Math.cos(a) * k, k, Math.sin(a) * k);   // object space: height = distance from the centre
  }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
  for (let r = 1; r < rings; r++) for (let s = 0; s < segs; s++) {
    const a = 1 + (r - 1) * segs + s, b = 1 + (r - 1) * segs + ((s + 1) % segs), c = a + segs, d = b + segs;
    idx.push(a, d, c, a, b, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, mat);
  mesh.scale.set(radius, 1e-3, radius);   // squashed flat in the world
  mesh.userData.noCollide = true;
  return mesh;
}

/** A stream `width` wide from `a` to `b` (world points), on its own surface normal `up`. */
export function magicStream(a, b, width, mat, { up = new THREE.Vector3(0, 1, 0), segs = 24 } = {}) {
  const pos = [], idx = [], n = 8;
  for (let j = 0; j <= segs; j++) for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI;
    pos.push(Math.cos(th), j / segs, Math.sin(th));   // object space: a half pipe, height = along the stream
  }
  for (let j = 0; j < segs; j++) for (let i = 0; i < n; i++) {
    const p = j * (n + 1) + i, q = p + n + 1;
    idx.push(p, q, p + 1, p + 1, q, q + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mat);
  const along = b.clone().sub(a), across = new THREE.Vector3().crossVectors(along, up).normalize().multiplyScalar(width / 2);
  const lift = new THREE.Vector3().crossVectors(across, along).normalize().multiplyScalar(0.01);
  mesh.matrixAutoUpdate = false;
  mesh.matrix.makeBasis(across, along, lift).setPosition(a);
  mesh.userData.noCollide = true;
  return mesh;
}
