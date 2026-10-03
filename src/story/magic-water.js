import * as THREE from 'three';
import { makeMaterial } from '../materials.js';

// The desert's magical water: shifting blobs of colour, like the backpack's
// lava-lamp fluid. Kept in this one place so it can be swapped for the
// tool's own fluid shader once both are merged (same palette, same feel).
//
// It is a vertex-coloured, self-lit surface: every frame the colour of each
// vertex is read from a slowly drifting noise field, and the material snaps
// the blend to the nearest ink of the palette, so the blobs stay flat
// printed colour with crisp edges that drift and merge.

export const MAGIC_PALETTE = ['#62c3c9', '#70e7df', '#a99be0', '#8a6fb8', '#e88fa6', '#f2c54b'];
export const DIM_PALETTE = ['#3f6f7a', '#4f8c8a', '#5f5a86', '#4a4466', '#7a5a6a', '#8a7a52'];

const _c = new THREE.Color(), _a = new THREE.Color(), _b = new THREE.Color();

/** A material for one magic surface (its own palette, so it can dim and brighten on its own). */
export function magicMaterial(seed = 0, palette = MAGIC_PALETTE) {
  const m = makeMaterial({ color: '#ffffff', glow: 1, flat: true, vertexColors: true, palette, magic: seed });
  return m;
}

/** Fade a magic material between two palettes (k = 0 → a, 1 → b). */
export function setMagicPalette(mat, a, b = a, k = 0) {
  const P = mat.uniforms.uPalette.value;
  for (let i = 0; i < a.length; i++) P[i].copy(_a.set(a[i])).lerp(_b.set(b[i] ?? a[i]), k);
  mat.uniforms.uPaletteSize.value = a.length;
}

/** A flat disc of rings × segments (the pool's surface), with a colour attribute. */
export function magicDisc(radius, rings = 10, segs = 48) {
  const pos = [], idx = [];
  pos.push(0, 0, 0);
  for (let r = 1; r <= rings; r++) for (let s = 0; s < segs; s++) {
    const a = (s / segs) * Math.PI * 2, rr = (r / rings) * radius;
    pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr);
  }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
  for (let r = 1; r < rings; r++) for (let s = 0; s < segs; s++) {
    const a = 1 + (r - 1) * segs + s, b = 1 + (r - 1) * segs + ((s + 1) % segs), c = a + segs, d = b + segs;
    idx.push(a, d, c, a, b, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  g.setIndex(idx);
  return g;
}

/** Add a colour attribute to any geometry (so it can be animated). */
export function withColor(g) {
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
  return g;
}

/**
 * Recolour the vertices from the drifting field. `palette` is the gradient
 * the field runs through (the material snaps to its inks); `scale` is the
 * blob size in metres, `flow` an optional drift direction (a stream).
 */
export function animateMagic(geo, t, { palette = MAGIC_PALETTE, scale = 4, speed = 1, flow = null, seed = 0 } = {}) {
  const p = geo.attributes.position.array, c = geo.attributes.color.array, n = palette.length;
  const k = 1 / scale, T = t * 0.35 * speed;
  const fx = flow ? flow.x * t * speed : 0, fz = flow ? flow.z * t * speed : 0;
  for (let i = 0; i < p.length; i += 3) {
    const x = (p[i] - fx) * k + seed, z = (p[i + 2] - fz) * k - seed;
    // two slow interfering waves bend a third: soft blobs that drift and fold into each other
    const w = Math.sin(x * 1.3 + Math.sin(z * 0.9 + T) * 1.6 + T * 0.7) + Math.sin(z * 1.1 - Math.sin(x * 0.8 - T * 1.3) * 1.4 - T * 0.5)
      + 0.6 * Math.sin((x + z) * 0.7 + T * 1.9);
    let v = (w / 2.6) * 0.5 + 0.5;
    v = Math.min(Math.max(v, 0), 0.9999) * (n - 1);
    const j = Math.floor(v);
    _c.set(palette[j]).lerp(_a.set(palette[Math.min(j + 1, n - 1)]), v - j);
    c[i] = _c.r; c[i + 1] = _c.g; c[i + 2] = _c.b;
  }
  geo.attributes.color.needsUpdate = true;
}
