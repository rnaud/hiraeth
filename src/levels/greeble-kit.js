import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, mulberry32 } from '../noise.js';

// ---------------------------------------------------------------------------
// Small machinery at every scale, as the reference sheets dress every interior and underside (the Buried
// Machine's drum and trench, the City-Shaft's terraces seen from under, the Market's back alleys; for Vael II's
// overhangs, the rock's own knobs and ribs): pipes running along a face with their flanges and valves,
// conduits up it, boxes and panels, brackets, cable bundles. Their gaps against the face and between them are
// the shaded pockets the spot blacks (post.js uSpot) fill, so a face reads as the sheets' dense dark work.
//
//   const g = greebles(seed);
//   g.patch(origin, u, v, n, w, h, opts)   a rectangle on a face: origin its corner, u along it (w m), v up it (h m),
//                                          n out of it; or under a ceiling (n down)
//   g.merged()                             → { metal, dark, pale, rock: BufferGeometry | null }: one geometry per role,
//                                          positions and normals only (merge into a world's buckets or a kit's)
//   g.count                                how many pieces
// Pieces are a few dozen faces each (GREEBLE.faces), never collided: drawn on faces nobody stands on, or standing
// off a wall by less than a hand (the traveller brushes past them).
// ---------------------------------------------------------------------------

/** The kinds' base shapes (x along the face's u, y along v, z out of the face, sitting on z = 0). */
const unit = (g) => { g.deleteAttribute('uv'); const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; };
const BASE = {
  pipe: unit(new THREE.CylinderGeometry(1, 1, 1, 7, 1, true).rotateZ(Math.PI / 2)),          // axis x, r 1, length 1
  rod: unit(new THREE.CylinderGeometry(1, 1, 1, 5, 1, true)),                                // axis y (a conduit up the face)
  flange: unit(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateZ(Math.PI / 2)),
  valve: unit(mergeGeometries([new THREE.CylinderGeometry(1, 1, 0.25, 6, 1).rotateX(Math.PI / 2), new THREE.BoxGeometry(0.3, 0.3, 0.9).translate(0, 0, -0.45)].map((g) => { g.deleteAttribute('uv'); return g.toNonIndexed(); }))),   // a hand wheel on its stem
  box: unit(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5)),
  panel: unit(mergeGeometries([new THREE.BoxGeometry(1, 1, 0.25).translate(0, 0, 0.125), new THREE.BoxGeometry(0.7, 0.12, 0.2).translate(0, 0.2, 0.32)].map((g) => { g.deleteAttribute('uv'); return g.toNonIndexed(); }))),   // a plate with its louvre
  bracket: unit(new THREE.BoxGeometry(0.2, 0.2, 1).translate(0, 0.9, 0.5)),
  cable: unit(mergeGeometries([0, 1].map((k) => new THREE.CylinderGeometry(0.4, 0.4, 1, 4, 1, true).rotateZ(Math.PI / 2).translate(0, (k - 0.5) * 0.8, k * 0.4).toNonIndexed()))),
  knob: unit(new THREE.IcosahedronGeometry(1, 1).scale(1, 0.8, 0.6).translate(0, 0, 0.35)),
  fin: unit(new THREE.ConeGeometry(1, 1, 4).rotateX(-Math.PI / 2).scale(0.35, 1, 1).translate(0, 0, 0.5)),
};
/** Faces per piece of each kind, for budgets. */
export const GREEBLE = { faces: Object.fromEntries(Object.entries(BASE).map(([k, g]) => [k, g.attributes.position.count / 3])) };

const nK = createNoise2D(51529);
const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _s = new THREE.Matrix4(), _p = new THREE.Vector3();

export function greebles(seed = 1) {
  const rng = mulberry32(Math.floor(seed * 7741) + 3);
  const R = (a, b) => a + rng() * (b - a);
  const parts = { metal: [], dark: [], pale: [], rock: [] };
  let count = 0;
  /** A piece of `kind`, `role`, at (a, b) on the face (m along u, v), sx × sy × sz, stood off the face by `off`. */
  const piece = (F, kind, role, a, b, sx, sy, sz, off = 0, spin = 0) => {
    _p.copy(F.o).addScaledVector(F.u, a).addScaledVector(F.v, b).addScaledVector(F.n, off);
    _b.makeBasis(F.u, F.v, F.n).setPosition(_p);
    if (spin) _b.multiply(_m.makeRotationZ(spin));
    const g = BASE[kind].clone().applyMatrix4(_s.makeScale(sx, sy, sz)).applyMatrix4(_b);
    parts[role].push(g);
    count++;
  };
  const api = {
    get count() { return count; },
    /**
     * Dress a rectangle of a face. opts: density (0..2: how packed), scale (the pieces' size, 1 a room's), kinds:
     * 'machine' (pipes, conduits, boxes, panels, valves, brackets, cables) or 'rock' (knobs and ribs), depth (the most
     * a piece stands off the face, m), hang (under a ceiling: pipes drop from it on brackets).
     */
    patch(o, u, v, n, w, h, { density = 1, scale = 1, kinds = 'machine', depth = 0.8 * scale, hang = false } = {}) {
      const F = { o: o.clone(), u: u.clone().normalize(), v: v.clone().normalize(), n: n.clone().normalize() };
      // (a right-handed frame, so the pieces are not drawn inside out: u turned round, the rectangle kept)
      if (new THREE.Vector3().crossVectors(F.u, F.v).dot(F.n) < 0) { F.o.addScaledVector(F.u, w); F.u.negate(); }
      const s = scale;
      if (kinds === 'rock') {
        for (let i = 0, N = Math.round(w * h * 0.09 * density / (s * s)); i < N; i++) {
          const a = R(0, w), b = R(0, h), r = R(0.4, 1.2) * s * (1 + 0.6 * Math.max(0, nK(a * 0.05 + seed, b * 0.05)));
          if (rng() < 0.65) piece(F, 'knob', 'rock', a, b, r * R(1, 1.8), r, Math.min(r, depth), -r * 0.2, R(0, 6));
          else piece(F, 'fin', 'rock', a, b, r * 0.8, r * R(1.5, 3), Math.min(r * 0.9, depth), 0, R(-0.4, 0.4));
        }
        return api;
      }
      // pipe runs along u, in bands up the face, a few in a bundle, standing off on brackets
      const runs = Math.max(1, Math.round(h * 0.35 * density / s));
      for (let i = 0; i < runs; i++) {
        const b0 = R(0.1, 0.9) * h, nb = 1 + Math.floor(rng() * 3.2), r0 = R(0.07, 0.22) * s;
        const a0 = R(0, w * 0.3), a1 = w - R(0, w * 0.3), len = a1 - a0;
        if (len < 1) continue;
        for (let k = 0; k < nb; k++) {
          const r = r0 * R(0.7, 1.3), b = b0 + k * r0 * 2.6, off = Math.min(depth, r * R(1.4, 2.6));
          if (b > h) break;
          piece(F, 'pipe', k % 3 === 2 ? 'pale' : 'metal', (a0 + a1) / 2, b, len, r, r, off);
          for (let a = a0 + R(0.5, 2) * s; a < a1; a += R(3, 6) * s) piece(F, 'flange', 'dark', a, b, r * 0.5, r * 1.5, r * 1.5, off);
          if (rng() < 0.35 * density) piece(F, 'valve', 'dark', R(a0, a1), b, r * 2.2, r * 2.2, r * 2.2, off + r * 1.6);
        }
        for (let a = a0 + 0.5 * s; a < a1; a += R(2.2, 4.5) * s) piece(F, 'bracket', 'dark', a, b0 - r0 * 1.5, s * 0.9, r0 * 4, Math.min(depth, r0 * 2.6), 0);
      }
      // conduits up the face, and cable bundles along it
      for (let i = 0, N = Math.round(w * 0.12 * density / s); i < N; i++) piece(F, 'rod', rng() < 0.5 ? 'metal' : 'dark', R(0, w), h / 2 * R(0.6, 1), s * R(0.04, 0.1), h * R(0.4, 1), s * R(0.04, 0.1), s * 0.12);
      for (let i = 0, N = Math.round(h * 0.12 * density / s); i < N; i++) { const len = w * R(0.3, 0.9); piece(F, 'cable', 'dark', R(len / 2, w - len / 2), R(0, h), len, s * 0.09, s * 0.09, s * 0.06); }
      // boxes and panels: casings, junctions, louvred plates, some deep enough to shade the face beside them
      for (let i = 0, N = Math.round(w * h * 0.06 * density / (s * s)); i < N; i++) {
        const bw = R(0.4, 1.8) * s, bh = R(0.3, 1.4) * s, bd = Math.min(depth, R(0.15, 0.7) * s);
        const kind = rng() < 0.4 ? 'panel' : 'box';
        piece(F, kind, rng() < 0.6 ? 'dark' : 'metal', R(bw / 2, Math.max(bw / 2, w - bw / 2)), R(bh / 2, Math.max(bh / 2, h - bh / 2)), bw, bh, kind === 'panel' ? Math.min(depth, bd * 2.5) : bd, 0);
      }
      if (hang) for (let i = 0, N = Math.round(w * h * 0.02 * density / (s * s)); i < N; i++) {
        // a drop: a pipe hanging on its rod from the ceiling (u along, n down)
        const a = R(1, w - 1), b = R(0, h), d = R(0.6, 2) * s;
        piece(F, 'rod', 'dark', a, b, s * 0.05, s * 0.05, d * 0.5, d * 0.25, 0);
        const len = R(2, 8) * s;
        piece(F, 'pipe', 'metal', a, b, len, s * 0.18, s * 0.18, d);
      }
      return api;
    },
    merged() {
      const out = {};
      for (const [k, list] of Object.entries(parts)) out[k] = list.length ? mergeGeometries(list) : null;
      return out;
    },
  };
  return api;
}

/**
 * Knobs and ribs of rock grown out of a curved surface at the given points ([{ p, n, s }…]: where, the way out, how
 * big): an overhang's underside, which the sheets draw lumpy and pocketed, never smooth. One geometry.
 */
export function rockKnobs(spots, seed = 1, { flat = true } = {}) {
  const rng = mulberry32(Math.floor(seed * 3313) + 9), out = [], up = new THREE.Vector3(0, 0, 1), q = new THREE.Quaternion();
  for (const { p, n, s } of spots) {
    q.setFromUnitVectors(up, n);
    const g = (rng() < 0.7 ? BASE.knob : BASE.fin).clone().applyMatrix4(_s.makeScale(s * (1 + rng() * 0.8), s * (0.8 + rng() * 0.6), s * (0.7 + rng() * 0.5)));
    g.applyMatrix4(_m.makeRotationZ(rng() * 6)).applyQuaternion(q).translate(p.x - n.x * s * 0.15, p.y - n.y * s * 0.15, p.z - n.z * s * 0.15);
    // (shaded as the surface they grow from: the underside's one dark tone, not lit islands; the ink draws their
    //  outlines and the crease shading their pockets)
    if (flat) { const N = g.attributes.normal; for (let i = 0; i < N.count; i++) N.setXYZ(i, n.x, n.y, n.z); }
    out.push(g);
  }
  return out.length ? mergeGeometries(out) : null;
}

/** A face's frame from its corner and two edges: { o, u, v, n } (n = u × v, unit). */
export function faceFrame(o, along, up) {
  const u = along.clone().normalize(), v = up.clone().normalize();
  return { o, u, v, n: new THREE.Vector3().crossVectors(u, v).normalize() };
}
