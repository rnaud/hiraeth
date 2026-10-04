import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Words on screens and signs (the City-Shaft and the Signal Market speak to
// you once their stories have moved), and the recurring glyph as geometry.
//
//   textGeometry('YOU ARE NOT ALONE', { width: 12 })   one merged block-letter geometry in the XY plane,
//                                                       facing +z, centred; lines split on '\n'
//   glyphGeometry(size)                                 three dots over an arc, facing +z, centred

// 3 × 5 block letters (rows top to bottom)
const FONT = {
  A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['111', '100', '100', '100', '111'],
  D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
  G: ['111', '100', '101', '101', '111'], H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '111'], K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'], N: ['110', '101', '101', '101', '101'], O: ['111', '101', '101', '101', '111'],
  P: ['111', '101', '111', '100', '100'], Q: ['111', '101', '101', '111', '001'], R: ['110', '101', '110', '101', '101'],
  S: ['111', '100', '111', '001', '111'], T: ['111', '010', '010', '010', '010'], U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'], W: ['101', '101', '111', '111', '101'], X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'], Z: ['111', '001', '010', '100', '111'],
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '011', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '001', '001', '001'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  '.': ['000', '000', '000', '000', '010'], '?': ['111', '001', '011', '000', '010'], '!': ['010', '010', '010', '000', '010'],
  '-': ['000', '000', '111', '000', '000'], ',': ['000', '000', '000', '010', '100'], "'": ['010', '010', '000', '000', '000'],
};

/** Block letters as one geometry (XY plane, facing +z, centred). Unknown characters are spaces. */
export function textGeometry(text, { width = 10, depth = 0.04, gap = 0.82 } = {}) {
  const lines = String(text).toUpperCase().split('\n');
  const cols = Math.max(...lines.map((l) => l.length)) * 4 - 1;
  const step = width / cols, rows = lines.length * 6 - 1;
  const parts = [];
  lines.forEach((line, li) => [...line].forEach((c, i) => (FONT[c] ?? []).forEach((row, y) => [...row].forEach((v, x) => {
    if (v !== '1') return;
    const cx = -width / 2 + (i * 4 + x + 0.5) * step, cy = (rows / 2 - (li * 6 + y + 0.5)) * step;
    parts.push(new THREE.BoxGeometry(step * gap, step * gap, depth).translate(cx, cy, 0));
  }))));
  if (!parts.length) return new THREE.BufferGeometry();
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  g.userData.height = rows * step;
  return g;
}

/** The glyph: three dots over an arc (XY plane, facing +z), `size` wide. */
export function glyphGeometry(size = 1, depth = 0.06) {
  const s = size / 2.4, parts = [];
  for (const [x, y] of [[-0.75, 0.52], [0, 0.72], [0.75, 0.52]]) parts.push(new THREE.CylinderGeometry(0.2 * s, 0.2 * s, depth, 10).rotateX(Math.PI / 2).translate(x * s, y * s, 0));
  // the arc: a flattened half ring under the dots
  parts.push(new THREE.TorusGeometry(1.0 * s, 0.11 * s, 4, 18, Math.PI * 0.8).rotateZ(Math.PI * 0.1).scale(1.1, 0.55, depth / (0.22 * s)).translate(0, -0.42 * s, 0));
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  parts.forEach((p) => p.dispose());
  return g;
}
