import * as THREE from 'three';
import { surfacePoly, surfaceRibbon, blob, arcStroke } from './geo.js';

// The ship's outside: the angular exploration vessel of the selected reference
// (references/The Travellers Ship/Angular Exterior - Selected/reference-4.jpeg, docs/systems/ship.md).
// A long faceted box on four short legs: a wedge bow (the nose plate at sill height, the windshield
// sloping up and back from it, the chin down and back), worn cream enamel, one coral stripe at the
// windows' sill, muted lavender panels on the aft half, a khaki lower hull in two chamfers down to a
// dark belly, a side hatch with a telescoping ramp, a tall slot window aft of it, two slender pods
// raked up and back off the stern, and on the port flank the scorch the singing light left as it
// passed: three dots over an arc.
//
// Ship-local frame: x to starboard, y up, z aft; the origin on the deck, on the centre line, at the
// middle of the hatch (port side, -x). The bow points to -z. The hull is a loft of seven points a side
// through a few stations (STATIONS); the side walls of the main body are one vertical plane each,
// built as a grid of panels round their openings (the door, the windows, the portholes).
//
// The hull is drawn at its blockout's size (the design metres below, `D`) and built SHIP_SCALE times bigger
// (issue #338, the author: "my space ship and its interior should be 100% bigger, so it's more spacious inside"):
// every length of the hull and its openings doubled, so the rooms are twice as wide, long and high; what is the
// traveller's size (the furniture, the ramp, the door's handle) is built at its own size in src/ship/interior.js and
// model.js. Everything exported here is in real (scaled) metres; buildHull and its helpers work in the design's.

/** How many times the blockout's size the ship is built (issue #338: 2; 1 until v1.75). */
export const SHIP_SCALE = 2;
const K = SHIP_SCALE;

// ---- the design (the blockout's metres, before SHIP_SCALE)
const D = {};
D.DECK = 0;
D.CEIL = 2.9;           // the ceiling: 2.9 m clear in the design (2.35 until issue #195), 5.8 m built
D.LIFT = 2.0;           // the deck over the ground parked: the belly 0.4 design (0.8 m built) off it (2.6 m until #338)
D.HALF_W = 4.2;         // the side walls' plane (|x|) over the main body
D.WALL_IN = 3.8;        // the rooms' walls (|x|): 0.4 m of hull
D.NOSE_Z = -10.8; D.STERN_Z = 15.2;
D.CENTRE_Z = (D.NOSE_Z + D.STERN_Z) / 2;
D.R = 15.6;
D.BELLY = -1.6;
D.ROOF = 4.4;
// the hatch (issue #338: 1.6 x 1.8 design, 3.2 x 3.6 m built; at the doorways' 2.6 design, 5.2 m, it was a hangar's)
D.HATCH = { z0: -0.8, z1: 0.8, y0: 0, y1: 1.8 };
D.HINGE_R = D.HALF_W + 0.025;
D.LAV_Z = 2.9; D.LAV_END = 13.6;
D.STRIPE = { y0: 1.25, y1: 1.55 };
D.SHOULDER = 3.6;
D.LEGS = [{ x: -3.2, z: -5.6 }, { x: 3.2, z: -5.6 }, { x: -3.05, z: 11.0 }, { x: 3.05, z: 11.0 }];
D.BELLS = [[-1.2, -4.2], [1.2, -4.2], [-1.2, 8.0], [1.2, 8.0]].map(([x, z]) => new THREE.Vector3(x, D.BELLY - 0.5, z));
D.SCAR = { x: -D.HALF_W, y: 0.95, z: -3.75 };
D.OPENINGS = [
  { kind: 'door', side: -1, ...D.HATCH },
  { kind: 'slot', side: -1, z0: 1.25, z1: 1.55, y0: 0.55, y1: 2.8 },
  // the bunk's window (issue #338: inside the alcove's taller arch, src/ship/interior.js ALCOVE)
  { kind: 'window', side: 1, z0: -3.6, z1: -2.4, y0: 1.2, y1: 1.95 },
  { kind: 'port', side: -1, z: 5.25, y: 1.5, r: 0.3 },
  { kind: 'port', side: 1, z: 5.25, y: 1.5, r: 0.3 },
].map((o) => (o.kind === 'port' ? { ...o, z0: o.z - o.r - 0.1, z1: o.z + o.r + 0.1, y0: o.y - o.r - 0.1, y1: o.y + o.r + 0.1 } : o));
// The loft: at each station the seven points of the starboard side from the belly up (x, y), mirrored
// for port: belly, lower chamfer, chine, stripe bottom, stripe top, shoulder, roof edge.
D.MAIN = [[2.2, -1.6], [3.85, -0.95], [4.2, 0], [4.2, 1.25], [4.2, 1.55], [4.2, 3.6], [3.4, 4.4]];
D.STATIONS = [
  // (issue #338: the nose plate and the windshield's foot dropped, the stripe sweeping down to the nose: built twice
  // the size, the sill at 1.55 design stood 3.1 m over the deck and the seated pilot saw the sky alone over the dash;
  // now the panes start 1.3 m over it, just over the dash: the painted reference's long bow wedge and big panes)
  { z: D.NOSE_Z, v: [[0.92, -0.42], [1.27, -0.3], [1.55, -0.16], [1.61, -0.04], [1.61, 0.06], [1.44, 0.1], [1.09, 0.13]] },
  { z: -10.1, v: [[1.32, -0.7], [2.2, -0.48], [2.7, -0.22], [2.76, 0.04], [2.76, 0.14], [2.6, 0.19], [2.0, 0.24]] },
  { z: -8.1, v: [[2.1, -1.48], [3.7, -0.88], [4.05, 0], [4.08, 1.25], [4.08, 1.55], [4.05, 3.5], [3.35, 4.23]] },
  { z: -6.9, v: D.MAIN },
  { z: D.LAV_Z, v: D.MAIN },
  { z: 10.2, v: D.MAIN },
  { z: D.LAV_END, v: [[1.9, -1.25], [3.55, -0.7], [3.9, 0.1], [3.9, 1.25], [3.9, 1.55], [3.9, 3.45], [3.15, 4.15]] },
  { z: D.STERN_Z, v: [[1.5, -0.75], [2.85, -0.4], [3.25, 0.2], [3.25, 1.25], [3.25, 1.55], [3.2, 3.25], [2.6, 3.75]] },
];
D.BODY = { z0: -6.9, z1: 10.2 };
D.WINDOW = { z0: -10.1, z1: -8.1, y0: 0.24, y1: 4.15 };

// ---- built (real metres): what the rest of the game reads
const k3 = (v) => new THREE.Vector3(v.x * K, v.y * K, v.z * K);
const kr = (o) => Object.fromEntries(Object.entries(o).map(([key, v]) => [key, typeof v === 'number' && key !== 'side' ? v * K : v]));
export const DECK = D.DECK;         // the deck (ship-local y)
export const CEIL = DECK + D.CEIL * K;   // the ceiling: 5.8 m clear (2.9 until issue #338, 2.35 until #195)
export const LIFT = D.LIFT * K;     // the deck's height over the ground when parked on its legs (4 m; 2.6 until #338)
export const HALF_W = D.HALF_W * K; // the side walls' plane (|x|) over the main body (8.4 m; 4.2 until #338, 3.6 until #195)
export const WALL_IN = D.WALL_IN * K;   // the rooms' walls (|x|): 0.8 m of hull (7.6 m; 3.8 until #338)
export const NOSE_Z = D.NOSE_Z * K, STERN_Z = D.STERN_Z * K;   // (-10.8, 15.2 until #338; -10, 12.2 until #195)
export const LENGTH = STERN_Z - NOSE_Z;
/** The footprint's middle along the ship (ship-local z): the hatch is a little forward of it. */
export const CENTRE_Z = D.CENTRE_Z * K;
/** The hull's reach from the ship's origin (m, horizontally): what keeps clear of it must be further. */
export const R = D.R * K;
export const BELLY = D.BELLY * K;   // the belly (ship-local y)
export const ROOF = D.ROOF * K;     // the roof (3 m of structure over the ceiling: the reference's tall, chunky hull)
export const HATCH_A = -Math.PI / 2;   // the hatch faces local -x (a heading: polar(r, HATCH_A, y) is r metres out through it)
export const HATCH = kr(D.HATCH);   // 3.2 m wide, 3.6 high (1.6 x 2.6 until #338)
/** The ramp's hinge: its distance from the centre line, out through the hatch. */
export const HINGE_R = D.HINGE_R * K;
/** Where the lavender starts (ship-local z) and where the cream stern section begins. */
export const LAV_Z = D.LAV_Z * K, LAV_END = D.LAV_END * K;
export const STRIPE = kr(D.STRIPE);
/** The main body's shoulder: the top of its flat side walls. */
export const SHOULDER = D.SHOULDER * K;
/** The four legs (ship-local x, z of their hips' line). */
export const LEGS = D.LEGS.map(kr);

/** Where a leg's foot stands (x, z): out from its hip. */
export const footOf = (l) => ({ x: Math.sign(l.x) * (HALF_W - 0.05 * K), z: l.z });
/** The lift jets' mouths under the belly (ship-local). */
export const BELLS = D.BELLS.map(k3);
/** The scorch on the port flank, forward of the hatch: its centre on the wall (the wall's normal is -x). */
export const SCAR = kr(D.SCAR);
/** The cockpit's windshield: its sill and head (ship-local), for what must not cover it. */
export const WINDOW = kr(D.WINDOW);

/**
 * The side openings of the main body: [{ side (-1 port, 1 starboard), z0, z1, y0, y1, kind }]; portholes are round
 * ({ z, y, r }), the rest rectangles. The door is the hatch.
 */
export const OPENINGS = D.OPENINGS.map(kr);
export const STATIONS = D.STATIONS.map((st) => ({ z: st.z * K, v: st.v.map(([x, y]) => [x * K, y * K]) }));
/** The main body (constant section, flat side walls) runs between these stations' z. */
export const BODY = kr(D.BODY);

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const lerp = THREE.MathUtils.lerp;

/** The section at any z, in the design's metres (the stations' points, interpolated): [[x, y] x 7]. */
function dSection(z) {
  const S = D.STATIONS;
  if (z <= S[0].z) return S[0].v.map((p) => [...p]);
  for (let i = 0; i < S.length - 1; i++) {
    if (z <= S[i + 1].z) {
      const t = (z - S[i].z) / (S[i + 1].z - S[i].z);
      return S[i].v.map((p, j) => [lerp(p[0], S[i + 1].v[j][0], t), lerp(p[1], S[i + 1].v[j][1], t)]);
    }
  }
  return S.at(-1).v.map((p) => [...p]);
}
/** The section at any z (the stations' points, interpolated): [[x, y] x 7]. */
export const sectionAt = (z) => dSection(z / K).map(([x, y]) => [x * K, y * K]);
/** The hull's half width at height y over the deck, at z (m; 0 outside its length or height). */
export function halfWidthAt(z, y) {
  if (z < NOSE_Z || z > STERN_Z) return 0;
  const s = sectionAt(z);
  if (y < s[0][1] || y > s[6][1]) return 0;
  for (let j = 0; j < 6; j++) {
    const [x0, y0] = s[j], [x1, y1] = s[j + 1];
    if (y >= y0 && y <= y1) return y1 > y0 ? lerp(x0, x1, (y - y0) / (y1 - y0)) : Math.max(x0, x1);
  }
  return s[6][0];
}
/** The underside's height at (x, z), in the design's metres (null outside the hull's plan). */
function dUnderside(x, z) {
  if (z < D.NOSE_Z || z > D.STERN_Z) return null;
  const s = dSection(z), ax = Math.abs(x);
  if (ax <= s[0][0]) return s[0][1];
  for (let j = 0; j < 2; j++) {
    const [x0, y0] = s[j], [x1, y1] = s[j + 1];
    if (ax <= x1) return lerp(y0, y1, (ax - x0) / (x1 - x0));
  }
  return null;
}
/** The underside's height at (x, z), ship-local: the belly and its chamfers (null outside the hull's plan). */
export function undersideAt(x, z) {
  const u = dUnderside(x / K, z / K);
  return u === null ? null : u * K;
}

/**
 * How far the hull's side is from the middle of its plan (0, CENTRE_Z), going out along local heading `a`
 * (0 = +z, aft; PI/2 = +x, starboard) at height y over the deck (clamped into the hull's height). For what
 * hugs the hull from outside: the crash site's heaped sand.
 */
export function reachAt(a, y) {
  const yy = THREE.MathUtils.clamp(y, BELLY + 0.05, ROOF - 0.1), dx = Math.sin(a), dz = Math.cos(a);
  const inside = (t) => { const z = CENTRE_Z + dz * t; return Math.abs(dx * t) < halfWidthAt(z, yy); };
  let lo = 0, hi = 17 * K;
  if (!inside(0)) return 0;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (inside(m)) lo = m; else hi = m; }
  return lo;
}

/** A cylinder between two points. */
export function strut(p, q, r0, r1 = r0, seg = 7) {
  const d = new THREE.Vector3().subVectors(q, p);
  const g = new THREE.CylinderGeometry(r1, r0, d.length(), seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.clone().normalize()));
  g.translate((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
  return g;
}

/** Flat quads into one geometry, each wound so its face looks along `hint`. */
export class Quads {
  constructor() { this.pos = []; }
  quad(a, b, c, d, hint) {
    const n = _n.crossVectors(_e1.subVectors(b, a), _e2.subVectors(c, a));
    const tri = n.dot(hint) >= 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
    for (const p of tri) this.pos.push(p.x, p.y, p.z);
    return this;
  }
  tri(a, b, c, hint) {
    const n = _n.crossVectors(_e1.subVectors(b, a), _e2.subVectors(c, a));
    const t = n.dot(hint) >= 0 ? [a, b, c] : [a, c, b];
    for (const p of t) this.pos.push(p.x, p.y, p.z);
    return this;
  }
  get empty() { return this.pos.length === 0; }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.computeVertexNormals();
    return g;
  }
}
const _n = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();

/** A point of a bilinear patch P00 P10 P11 P01 at (u, v). */
const bil = (P, u, v) => P[0].clone().multiplyScalar((1 - u) * (1 - v)).addScaledVector(P[1], u * (1 - v)).addScaledVector(P[2], u * v).addScaledVector(P[3], (1 - u) * v);
/**
 * A patch with a rectangular hole (u0..u1, v0..v1 of it): the eight quads round the hole into `q`. Returns the hole's rim.
 */
export function holedPatch(q, P, [u0, u1, v0, v1], hint) {
  const us = [0, u0, u1, 1], vs = [0, v0, v1, 1];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    if (i === 1 && j === 1) continue;
    q.quad(bil(P, us[i], vs[j]), bil(P, us[i + 1], vs[j]), bil(P, us[i + 1], vs[j + 1]), bil(P, us[i], vs[j + 1]), hint);
  }
  return [bil(P, u0, v0), bil(P, u1, v0), bil(P, u1, v1), bil(P, u0, v1)];
}
/** The faces lining an opening between two rims (outer, inner: four corners each, in the same order). */
export function reveal(q, A, B, { skip = -1 } = {}) {
  const c = A.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(0.25);
  for (let i = 0; i < 4; i++) {
    if (i === skip) continue;
    const a = A[i], b = A[(i + 1) % 4], m = a.clone().add(b).multiplyScalar(0.5);
    q.quad(a, b, B[(i + 1) % 4], B[i], c.clone().sub(m));   // facing into the opening
  }
}

/** The ring of a station's fourteen points (starboard belly up to the roof, then port roof down to the belly). */
const ring = (st) => [...st.v.map(([x, y]) => V(x, y, st.z)), ...st.v.slice().reverse().map(([x, y]) => V(-x, y, st.z))];
/** Which band an edge of the ring is: 0 belly chamfer .. 5 shoulder, 6 roof, 7 belly; and its side. */
const bandOf = (e) => (e <= 5 ? e : e === 6 ? 6 : e <= 12 ? 12 - e : 7);
const sideOf = (e) => (e <= 5 ? 1 : e >= 7 && e <= 12 ? -1 : 0);

/** The side panels' colour at z: cream forward, lavender aft, cream again at the stern. */
const sideKey = (z, y) => (z > D.LAV_Z && z < D.LAV_END ? 'lav' : y >= D.STRIPE.y0 && y <= D.STRIPE.y1 && z < D.LAV_Z ? 'stripe' : 'hull');   // (design metres)
const BAND_KEY = ['skirtDark', 'skirt', null, null, null, null, 'hull', 'belly'];
const MID_Y = { 2: 0.6, 3: 1.4, 4: 2.5, 5: 4.0 };

/**
 * Build the exterior into `batch` (materials: hull, lav, stripe, skirt, skirtDark, belly, glass, dark, trim, teal, seam,
 * glowRed, glowTeal, thrust, scorch, soot, ink). Returns the leg feet (ship-local).
 * @param o { legs: 'down' | 'up', footY(leg) -> ship-local foot height }
 */
export function buildHull(batch, o = {}) {
  // (drawn in the design's metres, every piece scaled SHIP_SCALE on its way into the batch)
  const { STATIONS, BODY, NOSE_Z, ROOF, BELLS, BELLY, SCAR, LIFT, HINGE_R, WALL_IN, HATCH, DECK } = D;
  const undersideAt = dUnderside, footOf = (l) => ({ x: Math.sign(l.x) * (D.HALF_W - 0.05), z: l.z });
  const into = batch;
  batch = { add: (k, g) => into.add(k, g.scale(K, K, K)) };
  const legs = o.legs ?? 'down';
  const Q = {};
  const q = (k) => (Q[k] ??= new Quads());
  const S = STATIONS, rings = S.map(ring);

  // ---- the loft: every band between every pair of stations, but the windows and the main body's flat walls
  for (let i = 0; i < S.length - 1; i++) {
    const A = rings[i], B = rings[i + 1], zm = (S[i].z + S[i + 1].z) / 2;
    const body = S[i].z >= BODY.z0 - 1e-6 && S[i + 1].z <= BODY.z1 + 1e-6;
    for (let e = 0; e < 14; e++) {
      const b = bandOf(e), side = sideOf(e);
      if (body && b >= 2 && b <= 4) continue;                       // (the flat walls, below)
      const P = [A[e], A[(e + 1) % 14], B[(e + 1) % 14], B[e]];
      const mid = P.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(0.25);
      const hint = mid.clone().sub(V(0, 1.0, THREE.MathUtils.clamp(mid.z, -6.8, 10.2)));
      // the windshield: two big panes either side of the centre frame on the front slope
      if (b === 6 && i === 1) {
        for (const s of [1, -1]) {
          const c0 = V(0, A[e].y, A[e].z), c1 = V(0, B[e].y, B[e].z);
          const edge0 = s > 0 ? A[e] : A[(e + 1) % 14], edge1 = s > 0 ? B[e] : B[(e + 1) % 14];
          const H = [c0, edge0, edge1, c1];
          const rim = holedPatch(q('hull'), H, [0.07, 0.9, 0.08, 0.92], hint);
          windowPane(Q, rim, hint);
        }
        continue;
      }
      // the side panes, behind the windshield over the stripe
      if (b === 4 && i === 2) {
        const rim = holedPatch(q('hull'), P, [0.08, 0.9, 0.1, 0.86], hint);
        windowPane(Q, rim, hint);
        continue;
      }
      const key = b >= 2 && b <= 5 ? sideKey(zm, MID_Y[b]) : BAND_KEY[b];
      q(key).quad(...P, hint);
      void side;
    }
  }
  // the nose plate and the stern plate
  capPlate(q('hull'), rings[0], V(0, 0, -1));
  capPlate(q('hull'), rings.at(-1), V(0, 0, 1));
  // the stripe and the dark lip round the nose plate (the stripe starts at the very tip)
  {
    const n = S[0];
    const [x3, y3] = n.v[3], [x4, y4] = n.v[4];
    q('stripe').quad(V(-x3, y3, NOSE_Z - 0.01), V(x3, y3, NOSE_Z - 0.01), V(x4, y4, NOSE_Z - 0.01), V(-x4, y4, NOSE_Z - 0.01), V(0, 0, -1));
    const [x1, y1] = n.v[1];
    q('dark').quad(V(-x1, y1 + 0.05, NOSE_Z - 0.012), V(x1, y1 + 0.05, NOSE_Z - 0.012), V(x1, y1 + 0.17, NOSE_Z - 0.012), V(-x1, y1 + 0.17, NOSE_Z - 0.012), V(0, 0, -1));
  }

  // ---- the main body's flat walls, both sides, round their openings
  for (const s of [-1, 1]) sideWall(Q, s);

  // ---- panel seams: inked lines where the plates meet
  seams(Q);

  // ---- the pods: two slender pods raked up and back off the stern's top corners, on short pylons
  const dir = V(0, Math.sin(THREE.MathUtils.degToRad(50)), Math.cos(THREE.MathUtils.degToRad(50)));
  for (const s of [-1, 1]) {
    const root = V(s * 2.75, ROOF - 0.05, 11.1);
    const base = root.clone().add(V(s * 0.15, 0.35, 0.2));
    batch.add('trim', strut(root, base, 0.28, 0.24, 6));                                   // the pylon
    const pod = new THREE.CylinderGeometry(0.13, 0.42, 4.4, 6, 1);
    pod.scale(0.75, 1, 1);
    pod.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir));
    const c = base.clone().addScaledVector(dir, 2.2);
    batch.add('hull', pod.translate(c.x, c.y, c.z));
    const ringG = new THREE.CylinderGeometry(0.33, 0.35, 0.18, 6, 1).scale(0.75, 1, 1);
    ringG.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir));
    const r0 = base.clone().addScaledVector(dir, 1.1);
    batch.add('stripe', ringG.translate(r0.x, r0.y, r0.z));                                 // a coral band round each
    const tip = base.clone().addScaledVector(dir, 4.45);
    batch.add(s < 0 ? 'glowRed' : 'glowTeal', new THREE.SphereGeometry(0.12, 8, 6).translate(tip.x, tip.y, tip.z));   // the running lights
    const noz = base.clone().addScaledVector(dir, 0.15);
    batch.add('dark', new THREE.CylinderGeometry(0.3, 0.36, 0.3, 8, 1, true).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir)).translate(noz.x, noz.y, noz.z));
  }

  // ---- the roof: a mast with a bent whip, a small dish, a hatch, vents and a light
  batch.add('dark', strut(V(1.05, ROOF, 4.0), V(1.05, ROOF + 2.1, 4.0), 0.07, 0.035));
  batch.add('dark', strut(V(1.05, ROOF + 1.5, 4.0), V(1.75, ROOF + 1.9, 4.2), 0.025));
  batch.add('glowRed', new THREE.SphereGeometry(0.1, 8, 6).translate(1.05, ROOF + 2.15, 4.0));
  {
    const dish = new THREE.SphereGeometry(0.55, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.6);
    dish.rotateX(Math.PI * 0.7).translate(-1.4, ROOF + 0.75, 6.6);
    batch.add('teal', dish);
    batch.add('dark', strut(V(-1.4, ROOF, 6.6), V(-1.4, ROOF + 0.55, 6.55), 0.06));
  }
  batch.add('trim', new THREE.BoxGeometry(1.1, 0.12, 1.1).translate(0, ROOF + 0.06, -1.6));     // the roof hatch
  batch.add('dark', new THREE.BoxGeometry(0.5, 0.05, 0.5).translate(0, ROOF + 0.14, -1.6));
  for (const z of [-5.0, -4.5, 1.1, 1.6]) batch.add('dark', new THREE.BoxGeometry(1.8, 0.08, 0.16).translate(z < 0 ? -1.3 : 1.3, ROOF + 0.04, z));
  for (let k = 0; k < 3; k++) batch.add('glowTeal', new THREE.SphereGeometry(0.08, 8, 6).translate(-2.2 + k * 0.25, ROOF + 0.08, 12.1));

  // ---- under the belly: the four lift jets (bells), a keel strake
  for (const b of BELLS) {
    batch.add('dark', new THREE.CylinderGeometry(0.42, 0.56, 0.48, 12, 1, true).translate(b.x, b.y + 0.26, b.z));
    batch.add('dark', new THREE.CylinderGeometry(0.62, 0.62, 0.06, 12).translate(b.x, BELLY - 0.02, b.z));
    batch.add('thrust', new THREE.CircleGeometry(0.4, 12).rotateX(Math.PI / 2).translate(b.x, b.y + 0.1, b.z));
  }
  batch.add('dark', new THREE.BoxGeometry(0.4, 0.2, 10.6).translate(0, BELLY - 0.08, 1.7));

  // ---- the scar: a scorched halo, three dots over an arc (the glyph), soot streaks, on the port flank
  {
    const T = (du, dv, lift = 0, out = new THREE.Vector3()) => out.set(SCAR.x - lift, SCAR.y + dv, SCAR.z + du);
    const k = 0.27, sc = (pts) => pts.map(([u, v]) => [u * k, v * k]);
    batch.add('scorch', surfacePoly(T, sc(blob(4.2, 3.1, 28, 0.32, 2.1)), 0.03));
    batch.add('soot', surfacePoly(T, sc(blob(3.1, 2.3, 24, 0.28, 4.7)), 0.04));
    for (const [u, v] of [[-1.25, 1.0], [0, 1.45], [1.25, 1.0]]) batch.add('ink', surfacePoly(T, sc(blob(0.42, 0.42, 14, 0.12, u * 3 + 1)).map(([a, b]) => [a + u * k, b + v * k]), 0.05));
    // the arc bows up under the dots (∩), as the glyph is drawn everywhere else, not a smile
    const [outer, inner] = arcStroke(0, -1.6 * k, 2.1 * k, Math.PI * 0.18, Math.PI * 0.82, 0.5 * k, 24);
    batch.add('ink', surfaceRibbon(T, outer, inner, 0.05));
    for (const [u, len, w] of [[-2.6, 2.4, 0.18], [2.4, 1.8, 0.14], [-0.6, 1.6, 0.12]]) {
      const o2 = sc([[u - w, -0.8], [u - w * 0.4, -0.8 - len]]), i2 = sc([[u + w, -0.8], [u + w * 0.4, -0.8 - len]]);
      batch.add('soot', surfaceRibbon(T, o2, i2, 0.045));
    }
  }

  // ---- landing legs: a strut out and down from the lower chamfer, a knee, a leg to a round pad
  const feet = [];
  for (const [i, l] of D.LEGS.entries()) {
    const s = Math.sign(l.x);
    if (legs === 'up') {
      batch.add('dark', new THREE.BoxGeometry(0.6, 0.35, 1.0).translate(s * 3.15, undersideAt(s * 3.15, l.z), l.z));   // stowed: the housings
      continue;
    }
    const f = footOf(l);
    const fy = o.footY ? o.footY(LEGS[i]) / K : -LIFT;   // (the ship's own question, in built metres)
    const uy = undersideAt(s * 3.3, l.z);   // (the hip on the lower chamfer)
    const hip = V(s * 3.3, uy - 0.05, l.z), knee = V(s * 3.95, uy - 0.6, l.z - 0.35 * Math.sign(l.z - 2));
    const foot = V(f.x, fy + 0.32, f.z);
    batch.add('trim', new THREE.BoxGeometry(0.7, 0.45, 0.9).translate(s * 3.2, uy, l.z));   // the hip housing
    batch.add('dark', strut(hip, knee, 0.2, 0.18));
    batch.add('dark', new THREE.SphereGeometry(0.24, 10, 8).translate(knee.x, knee.y, knee.z));
    batch.add('dark', strut(knee, foot, 0.15, 0.13));
    batch.add('trim', strut(V(s * 3.05, uy - 0.1, l.z), knee.clone().lerp(foot, 0.45), 0.07));      // the piston
    batch.add('dark', new THREE.CylinderGeometry(0.5, 0.6, 0.22, 12).translate(foot.x, fy + 0.11, foot.z));
    feet.push(new THREE.Vector3(foot.x * K, fy * K, foot.z * K));
  }

  // threshold under the hatch: from the room's wall out to the hinge, the deck carried through the hull's thickness
  batch.add('floorDark', new THREE.BoxGeometry(HINGE_R - WALL_IN, 0.3, HATCH.z1 - HATCH.z0).translate(-(WALL_IN + HINGE_R) / 2, DECK - 0.15, (HATCH.z0 + HATCH.z1) / 2));

  for (const [k, g] of Object.entries(Q)) if (!g.empty) batch.add(k, g.geo());
  return { feet };
}

/** Dark glass in a window's rim (recessed a little, facing out: from inside you see through it), and its frame. */
function windowPane(Q, rim, hint) {
  const n = hint.clone().normalize();
  const g = rim.map((p) => p.clone().addScaledVector(n, -0.06));
  (Q.glass ??= new Quads()).quad(...g, n);
  // the frame: a dark band just inside the rim
  const c = rim.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(0.25);
  const inner = rim.map((p) => p.clone().lerp(c, 0.06).addScaledVector(n, 0.012));
  const outer = rim.map((p) => p.clone().addScaledVector(n, 0.012));
  for (let i = 0; i < 4; i++) (Q.dark ??= new Quads()).quad(outer[i], outer[(i + 1) % 4], inner[(i + 1) % 4], inner[i], n);
}

/** A flat plate closing the loft at one end (a fan from the middle of the ring). */
function capPlate(q, R0, n) {
  const c = R0.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(1 / R0.length);
  for (let i = 0; i < R0.length; i++) q.tri(c, R0[i], R0[(i + 1) % R0.length], n);
}

/** Inside a rectangular or round opening of the side wall? */
const inOpening = (o, z, y) => z > o.z0 && z < o.z1 && y > o.y0 && y < o.y1;

/** One side of the main body (x = side * HALF_W): panels round the openings, their reveals to the rooms' wall, glass, portholes. */
function sideWall(Q, side) {
  const { HALF_W, OPENINGS, BODY, LAV_Z, STRIPE, SHOULDER, WALL_IN } = D;   // (design metres)
  const x = side * HALF_W, n = V(side, 0, 0);
  const ops = OPENINGS.filter((o) => o.side === side);
  const zs = new Set([BODY.z0, LAV_Z, BODY.z1]), ys = new Set([0, STRIPE.y0, STRIPE.y1, SHOULDER]);
  for (const o of ops) { zs.add(o.z0); zs.add(o.z1); ys.add(o.y0); ys.add(o.y1); }
  const Z = [...zs].sort((a, b) => a - b), Yv = [...ys].sort((a, b) => a - b);
  for (let i = 0; i < Z.length - 1; i++) for (let j = 0; j < Yv.length - 1; j++) {
    const zc = (Z[i] + Z[i + 1]) / 2, yc = (Yv[j] + Yv[j + 1]) / 2;
    if (ops.some((o) => inOpening(o, zc, yc))) continue;
    (Q[sideKey(zc, yc)] ??= new Quads()).quad(V(x, Yv[j], Z[i]), V(x, Yv[j], Z[i + 1]), V(x, Yv[j + 1], Z[i + 1]), V(x, Yv[j + 1], Z[i]), n);
  }
  for (const o of ops) {
    const key = sideKey((o.z0 + o.z1) / 2, 0.5) === 'lav' ? 'lav' : 'hull';
    if (o.kind === 'port') {
      // a plate with a round hole, a teal ring, dark glass and a short tube through the hull to the room
      porthole(Q, side, o, key);
      continue;
    }
    const xi = side * WALL_IN;
    const A = [V(x, o.y0, o.z0), V(x, o.y0, o.z1), V(x, o.y1, o.z1), V(x, o.y1, o.z0)];
    const B = A.map((p) => V(xi, p.y, p.z));
    reveal((Q.trim ??= new Quads()), A, B, { skip: o.kind === 'door' ? 0 : -1 });
    // the frame round it outside
    const f = 0.09, F = (Q.dark ??= new Quads());
    const out = A.map((p) => p.clone().add(V(side * 0.015, 0, 0)));
    const ex = [V(x + side * 0.015, o.y0 - (o.kind === 'door' ? 0 : f), o.z0 - f), V(x + side * 0.015, o.y0 - (o.kind === 'door' ? 0 : f), o.z1 + f), V(x + side * 0.015, o.y1 + f, o.z1 + f), V(x + side * 0.015, o.y1 + f, o.z0 - f)];
    for (let k = 0; k < 4; k++) {
      if (o.kind === 'door' && k === 0) continue;
      F.quad(ex[k], ex[(k + 1) % 4], out[(k + 1) % 4], out[k], n);
    }
    if (o.kind !== 'door') (Q.glass ??= new Quads()).quad(...A.map((p) => p.clone().add(V(-side * 0.08, 0, 0))), n);
  }
}

function porthole(Q, side, o, key) {
  const { HALF_W, WALL_IN } = D;   // (design metres)
  const x = side * HALF_W;
  const sh = new THREE.Shape();
  sh.moveTo(o.z0, o.y0); sh.lineTo(o.z1, o.y0); sh.lineTo(o.z1, o.y1); sh.lineTo(o.z0, o.y1); sh.closePath();
  const hole = new THREE.Path();
  hole.absarc(o.z, o.y, o.r, 0, Math.PI * 2, true);
  sh.holes.push(hole);
  const plate = new THREE.ShapeGeometry(sh, 16);
  addShape(Q, key, plate, (u, v) => V(x, v, u), V(side, 0, 0));
  // the tube through the hull, the ring and the glass
  const seg = 16, P = (r, xx, t) => V(xx, o.y + Math.sin(t) * r, o.z + Math.cos(t) * r);
  for (let i = 0; i < seg; i++) {
    const t0 = (i / seg) * Math.PI * 2, t1 = ((i + 1) / seg) * Math.PI * 2;
    const tm = (t0 + t1) / 2;
    (Q.trim ??= new Quads()).quad(P(o.r, x, t0), P(o.r, x, t1), P(o.r, side * WALL_IN, t1), P(o.r, side * WALL_IN, t0), V(0, -Math.sin(tm), -Math.cos(tm)));
    (Q.teal ??= new Quads()).quad(P(o.r, x + side * 0.03, t0), P(o.r, x + side * 0.03, t1), P(o.r + 0.09, x + side * 0.03, t1), P(o.r + 0.09, x + side * 0.03, t0), V(side, 0, 0));
    (Q.glass ??= new Quads()).tri(V(x - side * 0.06, o.y, o.z), P(o.r, x - side * 0.06, t0), P(o.r, x - side * 0.06, t1), V(side, 0, 0));
  }
}

/** A ShapeGeometry's triangles into quads-list `key`, mapped (u, v) -> point, facing `n`. */
export function addShape(Q, key, g, map, n) {
  const P = g.attributes.position, I = g.index;
  const q = (Q[key] ??= new Quads());
  const pt = (k) => map(P.getX(k), P.getY(k));
  const count = I ? I.count : P.count;
  for (let i = 0; i < count; i += 3) {
    const a = I ? I.getX(i) : i, b = I ? I.getX(i + 1) : i + 1, c = I ? I.getX(i + 2) : i + 2;
    q.tri(pt(a), pt(b), pt(c), n);
  }
}

/** The inked seams: the plates' joints on the flat walls, round the lavender panels, along the chine and shoulder. */
function seams(Q) {
  const { HALF_W, OPENINGS, BODY, LAV_Z, STRIPE, SHOULDER } = D;   // (design metres)
  const q = (Q.seam ??= new Quads()), w = 0.028, lift = 0.012;
  const vline = (side, z, y0, y1) => {
    const x = side * (HALF_W + lift);
    if (OPENINGS.some((o) => o.side === side && z > o.z0 - 0.12 && z < o.z1 + 0.12 && y1 > o.y0 && y0 < o.y1)) return;
    q.quad(V(x, y0, z - w), V(x, y0, z + w), V(x, y1, z + w), V(x, y1, z - w), V(side, 0, 0));
  };
  const hline = (side, y, z0, z1) => { const x = side * (HALF_W + lift); q.quad(V(x, y - w, z0), V(x, y - w, z1), V(x, y + w, z1), V(x, y + w, z0), V(side, 0, 0)); };
  for (const side of [-1, 1]) {
    for (const z of [-5.2, -2.0, 2.9, 4.4, 6.1, 7.8]) vline(side, z, 0.02, SHOULDER - 0.02);
    for (const z of [-6.0, -1.1, 2.0]) vline(side, z, 0.02, STRIPE.y0 - 0.02);
    hline(side, 0.03, BODY.z0, BODY.z1);
    hline(side, SHOULDER - 0.03, BODY.z0, BODY.z1);
    hline(side, 2.6, LAV_Z, BODY.z1);
  }
}
/** The ship's frame of reference, named, for the docs and tests. */
export const FRAME = { x: 'starboard', y: 'up', z: 'aft', origin: 'deck, centre line, middle of the hatch' };

/**
 * The hatch door: a panel just outside the wall over the doorway (outside and inside skins). It pops out (-x) and
 * slides forward (-z) along the hull (Ship.setDoor).
 */
export function doorGeometry() {
  const h = HATCH, w = h.z1 - h.z0 + 0.12, hh = h.y1 - h.y0 + 0.1;
  const out = new THREE.BoxGeometry(0.1, hh, w).translate(-HALF_W - 0.065, (h.y0 + h.y1) / 2 + 0.02, (h.z0 + h.z1) / 2);
  const inn = new THREE.PlaneGeometry(h.z1 - h.z0, h.y1 - h.y0).rotateY(Math.PI / 2).translate(-HALF_W - 0.012, (h.y0 + h.y1) / 2, (h.z0 + h.z1) / 2);
  return { out, inn };
}

/** The ramp: a plank with rails and treads, hinge at the origin, running out along +x, top at y = 0. */
export function rampGeometry(L, W = 1.55) {
  const plank = new THREE.BoxGeometry(L, 0.16, W).translate(L / 2, -0.08, 0);
  const rails = [];
  for (const s of [-1, 1]) {
    rails.push(new THREE.BoxGeometry(L, 0.07, 0.07).translate(L / 2, 0.92, s * (W / 2 - 0.04)));
    for (let k = 0; k <= Math.floor(L / 1.4); k++) rails.push(new THREE.BoxGeometry(0.06, 0.92, 0.06).translate(Math.min(0.2 + k * 1.4, L - 0.15), 0.46, s * (W / 2 - 0.04)));
  }
  const stripes = [];
  for (let x = 0.35; x < L - 0.2; x += 0.42) stripes.push(new THREE.BoxGeometry(0.07, 0.025, W * 0.86).translate(x, 0.012, 0));   // treads
  return { plank, rails, stripes };
}
