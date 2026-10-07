import * as THREE from 'three';
import { makeMaterial } from './materials.js';

// Weathering round a door (docs/systems/materials.md, "Stains round the doors"): the reference sheets stain
// the plaster darker round an opening, most over the lintel, soft at its edges. A door is a mesh of its own,
// so the wall's weathering cannot see it; each world lays this patch on the face round its doors instead.

/** The stained colour: the wall's own, k of the way toward a grime brown. */
export const GRIME = new THREE.Color('#8a6a50');
export const stainColor = (wall, k = 0.26) => new THREE.Color(wall).lerp(GRIME, k);

/**
 * The patch, in the door's frame: x across, y up from the door's foot, +z out of the face (it lies at z = 0;
 * lay it a hair in front of the wall). A fan from over the lintel out to a soft wavy outline, taller over the
 * lintel, down to the foot either side. w, h: the opening's width and height; R: the wall's radius when it
 * is curved (a drum, a dome's foot), its vertices laid round it; rng: its own numbers.
 */
export function doorStainGeometry(rng, w, h, R = 0) {
  const hw = w / 2 + 0.3 + rng() * 0.3, top = h + 0.5 + rng() * 0.5, c = [0, h * 0.7], n = 16, rim = [];
  const ph = rng() * 6, ph2 = rng() * 6, foot = 0.3 + rng() * 0.5;
  for (let i = 0; i <= n; i++) {   // from the right foot round over the top to the left foot
    const ang = Math.PI * (i / n), j = 1 + 0.08 * Math.sin(ang * 5 + ph) + 0.05 * Math.sin(ang * 11 + ph2);
    rim.push([Math.cos(ang) * hw * j, Math.abs(Math.cos(ang)) > 0.93 ? foot : c[1] + Math.sin(ang) * (top - c[1]) * j]);
  }
  // (a ring between the middle and the rim, so a curved wall keeps the patch on its face)
  const pos = [c[0], c[1], 0];
  for (const [x, y] of rim) pos.push((x + c[0]) / 2, (y + c[1]) / 2, 0, x, y, 0);
  const idx = [];
  for (let i = 0; i < n; i++) { const m0 = 1 + 2 * i, m1 = m0 + 2; idx.push(0, m0, m1, m0, m0 + 1, m1 + 1, m0, m1 + 1, m1); }
  if (R) for (let k = 0; k < pos.length; k += 3) { const t = pos[k] / R; pos[k] = Math.sin(t) * R; pos[k + 2] = (Math.cos(t) - 1) * R; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Its material: flat, drawn with a hairline of its own colour (not the ink round a door, as a smudge is). */
export const stainMaterial = (color, o = {}) => makeMaterial({ color, flat: true, line: 0.25, lineTint: 1, ...o });
