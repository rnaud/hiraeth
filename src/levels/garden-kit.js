import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createNoise2D, mulberry32 } from '../noise.js';

// ---------------------------------------------------------------------------
// The Garden of Spheres' shapes, shared by the world (spheres.js) and its reference views
// (reference-spheres.js), after the sheets (references/The Garden of Spheres/IMG_3793 … 3796):
//   leafCrown     foliage as a cluster of small leaf masses (each its own outline), not one smooth lump
//   crescentSphere a sphere printed in two flat tones, its crescent of pale blue fixed whatever the sun
//   pillowRock    the white hill's sculpted rock: rounded pillows of stone, a flattened top to stand on
//   arcade        a white wall pierced by round arches (the ruins' galleries)
//   robotParts    the white robot statue of the android wood, its parts (rounded blocks) and its dark slots
//   hedge         a clipped hedge with its fruit
//   paintPaving   the plaza's paving: each ring's slabs a hair apart in tone, so the ink draws their joints
// Each works in its own frame (y up, standing on y = 0); the callers place them.
// ---------------------------------------------------------------------------

const nA = createNoise2D(41117), nB = createNoise2D(41118);
const _c = new THREE.Color();

/** Push each vertex out along its direction from the centre by noise (a lumpy ball). */
function lump(g, amt, freq, seed) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + amt * (nA(x * freq + seed, y * freq - z * freq * 0.7) * 0.7 + nB(z * freq * 2.1 - seed, y * freq * 2.1 + x) * 0.3);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  return g;
}
/** Welded, with smooth normals (three's polyhedra come unindexed: they would shade faceted). */
export function welded(g) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  return m;
}

/**
 * Foliage the way the sheets draw it: a crown of small inked leaf masses, a core and `lobes` smaller
 * balls bulging from its top and sides, each a welded lumpy ball whose own outline the ink draws. About
 * a unit round (x and z −1 … 1), its foot at y ≈ −flat; `detail` the balls' subdivision (1: 80 faces each).
 */
export function leafCrown(seed, { lobes = 7, detail = 1, core = 0.72, flat = 0.85, size = [0.3, 0.46] } = {}) {
  const rng = mulberry32(Math.floor(seed * 7919) + 13), parts = [];
  const ball = (r, x, y, z, d, s) => { parts.push(welded(lump(new THREE.IcosahedronGeometry(r, d), 0.13, 1.7 / r, s)).translate(x, y, z)); };
  ball(core, 0, 0, 0, detail, seed);
  for (let i = 0; i < lobes; i++) {
    const a = i * 2.39996 + rng() * 0.6, el = -0.25 + (i / Math.max(lobes - 1, 1)) * 1.15 + (rng() - 0.5) * 0.3;
    const r = size[0] + rng() * (size[1] - size[0]), d = core * 0.78 + r * 0.25;
    ball(r, Math.cos(el) * Math.cos(a) * d, Math.sin(el) * d * 0.9, Math.cos(el) * Math.sin(a) * d, detail, seed + i * 3.1);
  }
  return mergeGeometries(parts).scale(1, flat, 1);
}

/**
 * A sphere in two flat tones, its poles along `dir` (the side it is printed lit on), so the line between
 * them is one ring of vertices: a clean round edge. Non-indexed, per-face colours (vertexColors, with the
 * two tones as the material's palette: makeMaterial({ vertexColors, palette: [lit, shade], glow })).
 */
export function crescentSphere(R, w, h, lit, shade, dir) {
  const d = new THREE.Vector3(...(dir.isVector3 ? dir.toArray() : dir)).normalize();
  const g = new THREE.SphereGeometry(R, w, h % 2 ? h + 1 : h).toNonIndexed()
    .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d));
  return paintTris(g, (c) => (c.dot(d) > 0 ? lit : shade));
}
/** Per-triangle colours (non-indexed): fn(centroid, faceNormal, triIndex) → colour. */
export function paintTris(geo, fn) {
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cen = new THREE.Vector3(), nn = new THREE.Vector3(), e = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    cen.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    nn.subVectors(b, a).cross(e.subVectors(c, a)).normalize();
    _c.set(fn(cen, nn, i / 3));
    for (let k = 0; k < 3; k++) col.set([_c.r, _c.g, _c.b], (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/**
 * A pillow of sculpted white rock (the white hill's): a rounded mass sx × sy × sz, bulging, its top
 * flattened (y over `top` × sy pressed down) so it reads as a carved terrace edge and stands under the feet.
 * Welded and smooth; its foot at y = 0.
 */
export function pillowRock(seed, sx, sy, sz, { top = 0.55, detail = 2 } = {}) {
  const g = lump(new THREE.IcosahedronGeometry(1, detail), 0.16, 0.9, seed);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i);
    if (y > top) y = top + (y - top) * 0.25;
    if (y < -0.4) y = -0.4 + (y + 0.4) * 0.3;   // (a flat foot, sunk a little)
    p.setY(i, y);
  }
  return welded(g).scale(sx, sy, sz).translate(0, 0.4 * sy, 0);
}

/**
 * An arcade: a wall `bays` round arches long (each `span` wide between pier centres, the piers `pier` wide),
 * h high, `depth` thick, the arches springing at `spring` × h. Its broken top (`ruin` 0..1) steps down
 * over some bays, as the ruins' galleries do. Centred on x = 0, on y = 0, its faces toward ±z.
 */
export function arcade({ bays = 4, span = 6, h = 9, depth = 1.6, pier = 1.4, spring = 0.55, ruin = 0, seed = 1 }) {
  const rng = mulberry32(Math.floor(seed * 104729) + 5), W = bays * span + pier, x0 = -W / 2;
  const s = new THREE.Shape();
  s.moveTo(x0, 0); s.lineTo(x0 + W, 0);
  // the top: level, or broken down bay by bay
  const tops = Array.from({ length: bays }, () => h * (1 - ruin * rng() * 0.45));
  s.lineTo(x0 + W, tops[bays - 1]);
  for (let i = bays - 1; i >= 0; i--) { const xl = x0 + i * span; s.lineTo(xl + span * 0.5 + pier * 0.5, tops[i]); s.lineTo(xl, tops[i] - (ruin ? rng() * h * 0.08 : 0)); }
  s.lineTo(x0, 0);
  const open = span - pier, rad = open / 2, sy = Math.min(h * spring, h - rad - 0.6);
  for (let i = 0; i < bays; i++) {
    const cx = x0 + pier + i * span + open / 2, hole = new THREE.Path();
    hole.moveTo(cx - rad, 0); hole.lineTo(cx + rad, 0); hole.lineTo(cx + rad, sy);
    hole.absarc(cx, sy, rad, 0, Math.PI, false);
    hole.lineTo(cx - rad, 0);
    s.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -depth / 2);
  g.deleteAttribute('uv');
  return g;
}

/**
 * The white robot statue: legs, hips, a chest with its plate, shoulder pads, arms down to hands, a neck and
 * a domed head, ~26 m tall on y = 0, facing +z. { parts: rounded blocks (white), slots: the visor and the
 * chest's vents (dark) }.
 */
export function robotParts() {
  const B = (w, h, d, x, y, z, r = 0.25) => new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * r).translate(x, y, z);
  const parts = [], slots = [];
  for (const s of [-1, 1]) {
    parts.push(B(3.4, 1.4, 4.6, s * 2.4, 0.7, 0.5, 0.3));          // a foot
    parts.push(B(2.6, 5.6, 2.8, s * 2.4, 4.2, 0));                 // the shin
    parts.push(B(3.1, 1.6, 3.2, s * 2.4, 7.4, 0.2, 0.4));          // the knee
    parts.push(B(2.8, 4.4, 3.0, s * 2.35, 10.2, 0));               // the thigh
    parts.push(B(3.4, 2.6, 4.6, s * 6.6, 22.1, 0, 0.4));           // the shoulder pad
    parts.push(B(2.4, 5.2, 2.6, s * 7.0, 18.6, 0.1));              // the upper arm
    parts.push(B(2.7, 1.4, 2.8, s * 7.1, 15.6, 0.2, 0.4));         // the elbow
    parts.push(B(2.3, 4.8, 2.5, s * 7.2, 12.6, 0.6));              // the forearm
    parts.push(B(2.0, 2.2, 1.6, s * 7.3, 9.4, 0.8, 0.35));         // the hand
  }
  parts.push(B(7.6, 2.6, 4.2, 0, 13.4, 0));                        // the hips
  parts.push(B(6.0, 2.4, 3.8, 0, 15.6, 0));                        // the waist
  parts.push(B(9.4, 6.8, 5.4, 0, 19.8, 0));                        // the chest
  parts.push(B(6.0, 3.6, 0.8, 0, 20.4, 2.9, 0.2));                 // the chest plate
  parts.push(B(2.2, 1.8, 2.2, 0, 24.0, 0, 0.4));                   // the neck
  parts.push(B(4.8, 4.2, 4.6, 0, 26.6, 0, 0.45));                  // the head
  parts.push(new THREE.SphereGeometry(2.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 28.4, 0));   // its dome
  parts.push(new THREE.CylinderGeometry(0.12, 0.18, 3.2, 6).translate(1.3, 30.8, -0.4));                     // an antenna
  slots.push(new THREE.BoxGeometry(3.6, 0.8, 0.4).translate(0, 26.9, 2.25));                                 // the visor
  for (const y of [19.4, 20.4, 21.4]) slots.push(new THREE.BoxGeometry(3.6, 0.3, 0.3).translate(0, y, 3.32));   // the plate's vents
  return { parts, slots };
}

/**
 * A clipped hedge w × h × d with its fruit: { hedge: a rounded block of leaf masses, fruit: [[x, y, z]…] on its
 * top and its two long faces (n of them), in its own frame (on y = 0, long along x) }.
 */
export function hedge(seed, w, h, d, n = 18) {
  const rng = mulberry32(Math.floor(seed * 6151) + 3);
  const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(h, d) * 0.3);
  lump(g, 0.06, 1.1, seed);
  const fruit = [];
  for (let i = 0; i < n; i++) {
    const side = rng(), x = (rng() - 0.5) * w * 0.9;
    if (side < 0.3) fruit.push([x, h * 0.5 + 0.08, (rng() - 0.5) * d * 0.8]);
    else fruit.push([x, (rng() - 0.35) * h * 0.8, (side < 0.65 ? 1 : -1) * (d * 0.5 + 0.06)]);
  }
  return { hedge: welded(g).translate(0, h / 2, 0), fruit: fruit.map(([x, y, z]) => [x, y + h / 2, z]) };
}

/**
 * The plaza's paving on a ring's geometry (non-indexed): each slab its own tone, a hair apart (just past
 * post.js's colour-edge threshold), so the ink draws the joints between them: radial joints every `slab`
 * metres round a ring R wide about (cx, cz) (`ring`: its index, which turns its joints from its neighbours');
 * faces that don't look up keep `side`. The ring's segments should divide into its slabs (a joint on an edge).
 */
export function paintPaving(geo, cx, cz, R, ring = 0, { tones = ['#f1e7d1', '#e2d6bd'], side = '#e9dfca', slab = 3.2 } = {}) {
  const nSlab = Math.max(6, Math.round((2 * Math.PI * R) / slab));
  return paintTris(geo, (c, n) => {
    if (n.y < 0.7) return side;
    const a = (Math.atan2(c.z - cz, c.x - cx) / (2 * Math.PI) + 1) % 1;
    return tones[(Math.floor(a * nSlab) + ring) % 2];
  });
}
/** The radial segments a ring R wide needs so each of its slabs (`slab` m round) ends on an edge. */
export const pavingSegments = (R, slab = 3.2, per = 2) => Math.max(6, Math.round((2 * Math.PI * R) / slab)) * per;
