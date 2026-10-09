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

export const DECK = 0;              // the deck (ship-local y)
export const CEIL = DECK + 2.35;    // the ceiling: 2.35 m clear, over the traveller's 2.2 m capsule
export const LIFT = 2.3;            // the deck's height over the ground when parked on its legs
export const HALF_W = 3.6;          // the side walls' plane (|x|) over the main body
export const WALL_IN = 3.2;         // the rooms' walls (|x|): 0.4 m of hull
export const NOSE_Z = -10, STERN_Z = 12.2;
export const LENGTH = STERN_Z - NOSE_Z;
/** The footprint's middle along the ship (ship-local z): the hatch is a little forward of it. */
export const CENTRE_Z = (NOSE_Z + STERN_Z) / 2;
/** The hull's reach from the ship's origin (m, horizontally): what keeps clear of it must be further. */
export const R = 12.6;
export const BELLY = -1.25;         // the belly (ship-local y)
export const ROOF = 3.35;           // the roof
export const HATCH_A = -Math.PI / 2;   // the hatch faces local -x (a heading: polar(r, HATCH_A, y) is r metres out through it)
export const HATCH = { z0: -0.65, z1: 0.65, y0: DECK, y1: DECK + 2.25 };
/** The ramp's hinge: its distance from the centre line, out through the hatch. */
export const HINGE_R = HALF_W + 0.05;
/** Where the lavender starts (ship-local z) and where the cream stern section begins. */
export const LAV_Z = 2.3, LAV_END = 10.6;
export const STRIPE = { y0: 1.25, y1: 1.55 };
/** The four legs (ship-local x, z of their hips' line). */
export const LEGS = [{ x: -2.75, z: -4.8 }, { x: 2.75, z: -4.8 }, { x: -2.6, z: 8.6 }, { x: 2.6, z: 8.6 }];
/** Where a leg's foot stands (x, z): out from its hip. */
export const footOf = (l) => ({ x: Math.sign(l.x) * 3.55, z: l.z });
/** The lift jets' mouths under the belly (ship-local). */
export const BELLS = [[-1.0, -3.6], [1.0, -3.6], [-1.0, 6.4], [1.0, 6.4]].map(([x, z]) => new THREE.Vector3(x, BELLY - 0.5, z));
/** The scorch on the port flank, forward of the hatch: its centre on the wall (the wall's normal is -x). */
export const SCAR = { x: -HALF_W, y: 0.95, z: -3.75 };
/** The cockpit's windshield: its sill and head (ship-local), for what must not cover it. */
export const WINDOW = { z0: -9.3, z1: -7.3, y0: 1.55, y1: 3.22 };

/**
 * The side openings of the main body: [{ side (-1 port, 1 starboard), z0, z1, y0, y1, kind }]; portholes are round
 * ({ z, y, r }), the rest rectangles. The door is the hatch.
 */
export const OPENINGS = [
  { kind: 'door', side: -1, ...HATCH },
  { kind: 'slot', side: -1, z0: 1.05, z1: 1.35, y0: 0.55, y1: 2.55 },
  { kind: 'window', side: 1, z0: -3.7, z1: -2.3, y0: 1.2, y1: 1.95 },
  { kind: 'port', side: -1, z: 4.65, y: 1.5, r: 0.3 },
  { kind: 'port', side: 1, z: 4.65, y: 1.5, r: 0.3 },
].map((o) => (o.kind === 'port' ? { ...o, z0: o.z - o.r - 0.1, z1: o.z + o.r + 0.1, y0: o.y - o.r - 0.1, y1: o.y + o.r + 0.1 } : o));

// The loft: at each station the seven points of the starboard side from the belly up (x, y), mirrored
// for port: belly, lower chamfer, chine, stripe bottom, stripe top, shoulder, roof edge.
const MAIN = [[1.8, -1.25], [3.2, -0.75], [3.6, 0], [3.6, 1.25], [3.6, 1.55], [3.6, 2.75], [2.9, 3.35]];
export const STATIONS = [
  { z: NOSE_Z, v: [[0.8, 0.05], [1.1, 0.2], [1.35, 0.5], [1.4, 0.95], [1.4, 1.22], [1.25, 1.28], [0.95, 1.32]] },
  { z: -9.3, v: [[1.15, -0.45], [1.9, -0.2], [2.35, 0.25], [2.4, 1.05], [2.4, 1.35], [2.25, 1.45], [1.75, 1.55]] },
  { z: -7.3, v: [[1.7, -1.15], [3.05, -0.7], [3.45, 0], [3.48, 1.25], [3.48, 1.55], [3.45, 2.65], [2.85, 3.22]] },
  { z: -6.1, v: MAIN },
  { z: LAV_Z, v: MAIN },
  { z: 7.9, v: MAIN },
  { z: LAV_END, v: [[1.5, -0.95], [2.9, -0.55], [3.3, 0.1], [3.3, 1.25], [3.3, 1.55], [3.3, 2.6], [2.65, 3.15]] },
  { z: STERN_Z, v: [[1.2, -0.55], [2.4, -0.3], [2.75, 0.2], [2.75, 1.25], [2.75, 1.55], [2.7, 2.45], [2.2, 2.85]] },
];
/** The main body (constant section, flat side walls) runs between these stations' z. */
export const BODY = { z0: -6.1, z1: 7.9 };

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const lerp = THREE.MathUtils.lerp;

/** The section at any z (the stations' points, interpolated): [[x, y] x 7]. */
export function sectionAt(z) {
  const S = STATIONS;
  if (z <= S[0].z) return S[0].v.map((p) => [...p]);
  for (let i = 0; i < S.length - 1; i++) {
    if (z <= S[i + 1].z) {
      const t = (z - S[i].z) / (S[i + 1].z - S[i].z);
      return S[i].v.map((p, j) => [lerp(p[0], S[i + 1].v[j][0], t), lerp(p[1], S[i + 1].v[j][1], t)]);
    }
  }
  return S.at(-1).v.map((p) => [...p]);
}
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
/** The underside's height at (x, z), ship-local: the belly and its chamfers (null outside the hull's plan). */
export function undersideAt(x, z) {
  if (z < NOSE_Z || z > STERN_Z) return null;
  const s = sectionAt(z), ax = Math.abs(x);
  if (ax <= s[0][0]) return s[0][1];
  for (let j = 0; j < 2; j++) {
    const [x0, y0] = s[j], [x1, y1] = s[j + 1];
    if (ax <= x1) return lerp(y0, y1, (ax - x0) / (x1 - x0));
  }
  return null;
}

/**
 * How far the hull's side is from the middle of its plan (0, CENTRE_Z), going out along local heading `a`
 * (0 = +z, aft; PI/2 = +x, starboard) at height y over the deck (clamped into the hull's height). For what
 * hugs the hull from outside: the crash site's heaped sand.
 */
export function reachAt(a, y) {
  const yy = THREE.MathUtils.clamp(y, BELLY + 0.05, ROOF - 0.1), dx = Math.sin(a), dz = Math.cos(a);
  const inside = (t) => { const z = CENTRE_Z + dz * t; return Math.abs(dx * t) < halfWidthAt(z, yy); };
  let lo = 0, hi = 14;
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
const sideKey = (z, y) => (z > LAV_Z && z < LAV_END ? 'lav' : y >= STRIPE.y0 && y <= STRIPE.y1 && z < LAV_Z ? 'stripe' : 'hull');
const BAND_KEY = ['skirtDark', 'skirt', null, null, null, null, 'hull', 'belly'];
const MID_Y = { 2: 0.6, 3: 1.4, 4: 2.1, 5: 3 };

/**
 * Build the exterior into `batch` (materials: hull, lav, stripe, skirt, skirtDark, belly, glass, dark, trim, teal, seam,
 * glowRed, glowTeal, thrust, scorch, soot, ink). Returns the leg feet (ship-local).
 * @param o { legs: 'down' | 'up', footY(leg) -> ship-local foot height }
 */
export function buildHull(batch, o = {}) {
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
      const hint = mid.clone().sub(V(0, 1.0, THREE.MathUtils.clamp(mid.z, -6, 8)));
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
    const root = V(s * 2.3, ROOF - 0.05, 8.7);
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
  batch.add('dark', strut(V(0.9, ROOF, 3.4), V(0.9, ROOF + 2.1, 3.4), 0.07, 0.035));
  batch.add('dark', strut(V(0.9, ROOF + 1.5, 3.4), V(1.6, ROOF + 1.9, 3.6), 0.025));
  batch.add('glowRed', new THREE.SphereGeometry(0.1, 8, 6).translate(0.9, ROOF + 2.15, 3.4));
  {
    const dish = new THREE.SphereGeometry(0.55, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.6);
    dish.rotateX(Math.PI * 0.7).translate(-1.2, ROOF + 0.75, 5.6);
    batch.add('teal', dish);
    batch.add('dark', strut(V(-1.2, ROOF, 5.6), V(-1.2, ROOF + 0.55, 5.55), 0.06));
  }
  batch.add('trim', new THREE.BoxGeometry(1.1, 0.12, 1.1).translate(0, ROOF + 0.06, -1.6));     // the roof hatch
  batch.add('dark', new THREE.BoxGeometry(0.5, 0.05, 0.5).translate(0, ROOF + 0.14, -1.6));
  for (const z of [-4.4, -3.9, 0.9, 1.4]) batch.add('dark', new THREE.BoxGeometry(1.6, 0.08, 0.16).translate(z < 0 ? -1.1 : 1.1, ROOF + 0.04, z));
  for (let k = 0; k < 3; k++) batch.add('glowTeal', new THREE.SphereGeometry(0.08, 8, 6).translate(-1.9 + k * 0.25, ROOF + 0.08, 9.6));

  // ---- under the belly: the four lift jets (bells), a keel strake
  for (const b of BELLS) {
    batch.add('dark', new THREE.CylinderGeometry(0.42, 0.56, 0.48, 12, 1, true).translate(b.x, b.y + 0.26, b.z));
    batch.add('dark', new THREE.CylinderGeometry(0.62, 0.62, 0.06, 12).translate(b.x, BELLY - 0.02, b.z));
    batch.add('thrust', new THREE.CircleGeometry(0.4, 12).rotateX(Math.PI / 2).translate(b.x, b.y + 0.1, b.z));
  }
  batch.add('dark', new THREE.BoxGeometry(0.4, 0.2, 9).translate(0, BELLY - 0.08, 1.4));

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
  for (const l of LEGS) {
    const s = Math.sign(l.x);
    if (legs === 'up') {
      batch.add('dark', new THREE.BoxGeometry(0.6, 0.35, 1.0).translate(s * 2.7, -0.95, l.z));   // stowed: the housings
      continue;
    }
    const f = footOf(l);
    const fy = o.footY ? o.footY(l) : -LIFT;
    const hip = V(s * 2.85, -0.62, l.z), knee = V(s * 3.45, -1.15, l.z - 0.35 * Math.sign(l.z - 2));
    const foot = V(f.x, fy + 0.32, f.z);
    batch.add('trim', new THREE.BoxGeometry(0.7, 0.45, 0.9).translate(s * 2.75, -0.62, l.z));   // the hip housing
    batch.add('dark', strut(hip, knee, 0.2, 0.18));
    batch.add('dark', new THREE.SphereGeometry(0.24, 10, 8).translate(knee.x, knee.y, knee.z));
    batch.add('dark', strut(knee, foot, 0.15, 0.13));
    batch.add('trim', strut(V(s * 2.6, -0.95, l.z), knee.clone().lerp(foot, 0.45), 0.07));      // the piston
    batch.add('dark', new THREE.CylinderGeometry(0.5, 0.6, 0.22, 12).translate(foot.x, fy + 0.11, foot.z));
    feet.push(new THREE.Vector3(foot.x, fy, foot.z));
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
  const x = side * HALF_W, n = V(side, 0, 0);
  const ops = OPENINGS.filter((o) => o.side === side);
  const zs = new Set([BODY.z0, LAV_Z, BODY.z1]), ys = new Set([0, STRIPE.y0, STRIPE.y1, 2.75]);
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
  const q = (Q.seam ??= new Quads()), w = 0.028, lift = 0.012;
  const vline = (side, z, y0, y1) => {
    const x = side * (HALF_W + lift);
    if (OPENINGS.some((o) => o.side === side && z > o.z0 - 0.12 && z < o.z1 + 0.12 && y1 > o.y0 && y0 < o.y1)) return;
    q.quad(V(x, y0, z - w), V(x, y0, z + w), V(x, y1, z + w), V(x, y1, z - w), V(side, 0, 0));
  };
  const hline = (side, y, z0, z1) => { const x = side * (HALF_W + lift); q.quad(V(x, y - w, z0), V(x, y - w, z1), V(x, y + w, z1), V(x, y + w, z0), V(side, 0, 0)); };
  for (const side of [-1, 1]) {
    for (const z of [-4.6, -2.0, 2.3, 3.6, 4.95, 6.3]) vline(side, z, 0.02, 2.73);
    for (const z of [-5.3, -1.0, 1.8]) vline(side, z, 0.02, STRIPE.y0 - 0.02);
    hline(side, 0.03, BODY.z0, BODY.z1);
    hline(side, 2.72, BODY.z0, BODY.z1);
    hline(side, 1.45, LAV_Z, BODY.z1);
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
export function rampGeometry(L, W = 1.25) {
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
