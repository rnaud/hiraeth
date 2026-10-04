import * as THREE from 'three';
import { makeMaterial, MODE_TERRAIN } from '../materials.js';
import { R } from './hull.js';

// The desert crash site: sand heaped up against the hull (more at the bow,
// never over the hatch or the cockpit window), the furrow it ploughed
// (two ridges of thrown-up sand with scorched sand between, revealed as the
// ship slides in), and a few pieces of it scattered along the way.

const adiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const smooth = (t) => t * t * (3 - 2 * t);
const hash = (x) => { const s = Math.sin(x * 127.1) * 43758.5453; return s - Math.floor(s); };

function gridMesh(rows, cols, at, mat) {
  // rows x cols vertices from at(i, j) -> Vector3; triangles row by row (so drawRange reveals rows in order).
  // Indexed, so the normals are shared and the sand shades smoothly (one normal per
  // triangle drew the heaps as a mosaic of flat, separately lit and inked facets).
  const pos = new Float32Array(rows * cols * 3);
  const P = [];
  for (let i = 0; i < rows; i++) { P.push([]); for (let j = 0; j < cols; j++) { const p = at(i, j); P[i].push(p); pos.set([p.x, p.y, p.z], (i * cols + j) * 3); } }
  const idx = [];
  const _ab = new THREE.Vector3(), _ad = new THREE.Vector3(), _n = new THREE.Vector3();
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols + 1, d = a + cols;
    _n.crossVectors(_ab.subVectors(P[i][j + 1], P[i][j]), _ad.subVectors(P[i + 1][j], P[i][j]));
    if (_n.y >= 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.userData.trisPerRow = (cols - 1) * 2;
  return m;
}

/**
 * @param o { heightAt(x, z), centre: Vector3 (hull centre at rest), travel: heading it moved along,
 *            length, sandMat (the terrain's own material), protect: [{ a, y, w }] azimuth / height / half-width
 *            to keep clear (hatch, window), rampA (azimuth of the ramp) }
 */
export function buildCrashSite(o) {
  const { heightAt: H, centre: C, travel, length } = o;
  const T = new THREE.Vector3(Math.sin(travel), 0, Math.cos(travel));
  const N = new THREE.Vector3(T.z, 0, -T.x);
  const group = new THREE.Group();
  group.name = 'crash-site';
  const sand = o.sandMat;
  const scorched = makeMaterial({ color: '#e2be86', color2: '#d8b27c', color3: '#c99f6c', mode: MODE_TERRAIN, sandInk: true });

  // ---- the berm heaped round the hull
  const AZ = 96, RAD = 16;
  const tops = [];
  const allowed = (a) => {
    // openings (hatch, window, the ramp) get a V-shaped notch with sloping sides
    let y = Infinity;
    for (const p of o.protect ?? []) y = Math.min(y, p.y + Math.max(0, adiff(a, p.a) - p.w) * 5);
    return y;
  };
  for (let i = 0; i < AZ; i++) {
    const a = (i / AZ) * Math.PI * 2;
    const front = Math.pow((1 + Math.cos(a - travel)) / 2, 1.6);
    const top = C.y + THREE.MathUtils.lerp(-8.6, -3.4, front) + (hash(i * 3.1) - 0.5) * 0.8;
    tops.push({ a, top: Math.min(top, allowed(a)), span: THREE.MathUtils.lerp(8, 18, front) });
  }
  // soften the profile round the hull, then make sure the openings stay clear
  for (let pass = 0; pass < 4; pass++) {
    const prev = tops.map((t) => t.top);
    for (let i = 0; i < AZ; i++) tops[i].top = (prev[(i + AZ - 1) % AZ] + prev[i] * 2 + prev[(i + 1) % AZ]) / 4;
  }
  for (const t of tops) t.top = Math.min(t.top, allowed(t.a));
  const bermAt = (i, j) => {
    const { a, top, span } = tops[i % AZ];
    const dy = THREE.MathUtils.clamp(top - C.y, -R + 0.05, R - 0.05);
    const r0 = Math.sqrt(R * R - dy * dy) + 0.06;
    const k = j / (RAD - 1);
    const r = r0 + span * k;
    const x = C.x + Math.sin(a) * r, z = C.z + Math.cos(a) * r;
    const ground = H(x, z);
    const lump = Math.sin(a * 5 + k * 4) * 0.35 * (1 - k) + Math.sin(a * 13 + 1.7) * 0.2 * (1 - k);
    // a heap: full height at the hull, a soft shoulder, then easing into the dune; edge tucked under the sand
    const prof = 1 - smooth(Math.pow(k, 0.8));
    const y = k >= 1 ? ground - 0.35 : Math.max(ground - 0.35, ground - 0.35 + (top - ground + 0.35) * prof + lump);
    return new THREE.Vector3(x, y, z);
  };
  const berm = gridMesh(AZ + 1, RAD, bermAt, sand);
  group.add(berm);

  // ---- the furrow behind it
  const ROWS = 90, COLS = 21;
  const sStart = R * 0.55;
  const fAt = (i, j) => {
    const s = 1 - i / (ROWS - 1);                 // row 0 = touchdown (far end), last row = at the ship
    const d = sStart + (length - sStart) * s;
    const w = THREE.MathUtils.lerp(17, 3.5, Math.pow(s, 0.8));
    const hr = THREE.MathUtils.lerp(3.4, 0.6, s) * (0.85 + 0.15 * Math.sin(d * 0.35)) * smooth(THREE.MathUtils.clamp((d - sStart) / 9, 0, 1));
    const u = (j / (COLS - 1) - 0.5) * 2 * (w / 2 + 3.2);
    const wob = Math.sin(d * 0.09) * 1.2 * s;
    const x = C.x - T.x * d + N.x * (u + wob), z = C.z - T.z * d + N.z * (u + wob);
    const ground = H(x, z);
    const edge = Math.abs(j / (COLS - 1) - 0.5) * 2;
    const ridge = hr * Math.exp(-(((Math.abs(u) - w / 2) / (0.9 + w * 0.07)) ** 2));
    const y = edge > 0.97 ? ground - 0.3 : ground + Math.max(ridge, 0.05) - (Math.abs(u) < w / 2 ? 0 : 0.0);
    return new THREE.Vector3(x, y, z);
  };
  const furrow = gridMesh(ROWS, COLS, fAt, sand);
  const trough = gridMesh(ROWS, 7, (i, j) => {
    const s = 1 - i / (ROWS - 1);
    const d = sStart + (length - sStart) * s;
    const w = THREE.MathUtils.lerp(17, 3.5, Math.pow(s, 0.8)) * 0.62;
    const u = (j / 6 - 0.5) * w;
    const wob = Math.sin(d * 0.09) * 1.2 * s;
    const x = C.x - T.x * d + N.x * (u + wob), z = C.z - T.z * d + N.z * (u + wob);
    const edge = Math.abs(j / 6 - 0.5) * 2;
    return new THREE.Vector3(x, H(x, z) + (edge > 0.9 ? 0.02 : 0.09), z);
  }, scorched);
  group.add(furrow, trough);
  // scrape marks: a few long dark strokes along the trough, like pen lines
  const scrapeMat = makeMaterial({ color: '#b48a5e', flat: true });
  const scrapes = [];
  for (const [u0, len, w0] of [[-0.3, 0.95, 0.35], [0.05, 0.8, 0.28], [0.32, 0.9, 0.3], [-0.12, 0.55, 0.22], [0.2, 0.45, 0.2]]) {
    const m = gridMesh(ROWS, 2, (i, j) => {
      const s = 1 - i / (ROWS - 1);
      const d = sStart + (length - sStart) * Math.min(s, len);
      const w = THREE.MathUtils.lerp(17, 3.5, Math.pow(Math.min(s, len), 0.8)) * 0.62;
      const wob = Math.sin(d * 0.09) * 1.2 * Math.min(s, len);
      const u = u0 * w + (j - 0.5) * w0 * (1 - Math.min(s, len) * 0.6);
      const x = C.x - T.x * d + N.x * (u + wob), z = C.z - T.z * d + N.z * (u + wob);
      return new THREE.Vector3(x, H(x, z) + 0.13, z);
    }, scrapeMat);
    scrapes.push(m);
    group.add(m);
  }

  // ---- pieces of the ship along the way
  const debris = new THREE.Group();
  const hullMat = makeMaterial({ color: '#f1e8d4', flat: true }), bandMat = makeMaterial({ color: '#d9643a', flat: true }), dark = makeMaterial({ color: '#34405e', flat: true });
  const bits = [[0.25, 6, hullMat, [2.4, 0.18, 1.6]], [0.35, -7, bandMat, [1.6, 0.3, 0.9]], [0.5, 9.5, hullMat, [1.5, 0.16, 1.1]], [0.62, -4, dark, [0.5, 0.5, 3.6]], [0.78, 3, hullMat, [1.0, 0.14, 0.8]], [0.9, -3, bandMat, [0.7, 0.2, 0.5]]];
  for (const [s, u, mat, [w, h, d]] of bits) {
    const dd = sStart + (length - sStart) * s;
    const x = C.x - T.x * dd + N.x * u, z = C.z - T.z * dd + N.z * u;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, H(x, z) + h * 0.2, z);
    m.rotation.set((hash(s * 9) - 0.5) * 0.9, hash(s * 13) * 6, (hash(s * 17) - 0.5) * 0.7);
    m.userData.s = s;
    debris.add(m);
  }
  // one landing leg, torn off, half in the sand
  {
    const dd = sStart + (length - sStart) * 0.45, x = C.x - T.x * dd - N.x * 9, z = C.z - T.z * dd - N.z * 9;
    const leg = new THREE.Group();
    leg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 4.2, 7).rotateZ(Math.PI / 2).translate(1.6, 0, 0), dark));
    leg.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bandMat));
    leg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 3.4, 7).rotateZ(1.0).translate(-1.3, 0.9, 0), dark));
    leg.add(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.35, 12).rotateZ(1.0).translate(-2.7, 1.8, 0), dark));
    leg.position.set(x, H(x, z) + 0.1, z);
    leg.rotation.set(0.2, 0.7, 0.15);
    leg.userData.s = 0.45;
    debris.add(leg);
  }
  group.add(debris);

  return {
    group, berm, furrow, trough, debris, T, N,
    /** Show the furrow up to fraction k of its length from the touchdown point (0 = none, 1 = all). */
    reveal(k) {
      for (const m of [furrow, trough, ...scrapes]) {
        const rows = Math.round(k * (ROWS - 1));
        m.geometry.setDrawRange(0, rows * m.userData.trisPerRow * 3);
        m.visible = rows > 0;
      }
      for (const d of debris.children) d.visible = k >= 1 - d.userData.s;
    },
  };
}
