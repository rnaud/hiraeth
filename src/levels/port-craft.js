import * as THREE from 'three';
import { T, painted, spindle } from '../vehicle-kit.js';
import { thinBar, keepThin } from '../thin.js';

// ---------------------------------------------------------------------------
// The space ports' craft (issue #441, docs/systems/worlds.md "Space ports"): the small craft of every city's port,
// drawn after the picked sheets (references/space-ports/<id>/sheet-1.jpg), each a list of painted parts (vehicle-kit.js:
// one flat colour a part, the ink outlining where the colours meet). Parked, a craft is baked into its port's merged
// meshes (no draw call of its own); flying, it is two meshes (its paint, its lamps: Parts.meshes).
//
//   CRAFT[model](colors) → Parts    nose along +z, its keel or its feet on y = 0, in metres
//
// The models: skyboat (the City in Space's moorers' boats), pod (the Underwater City's bathyscaphes), dart (a winged
// courier: the Signal Market, the Waterfall), buggy (the Signal Market's walker), hauler (a box freighter on legs),
// skiff (the Glass Dunes' glass-hulled boat), sledge (a float-sledge on runners, its glass floats), junk (the
// Eclipse city's lantern-sailed boat), sandskiff (Salt Harbour's sail on runners), hopper (a round craft on four legs),
// orecart (the Buried Machine's ore hopper).
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** A copy moved by m (a cable's axis points with it: thin.js keepThin is not carried by clone()). */
export function moved(g, m) {
  const c = g.clone();
  if (c.attributes.aThin) { c.userData.thinKept = false; keepThin(c); }
  return c.applyMatrix4(m);
}

/** Painted parts in five kinds: matte paint, painted metal, lamps (glow), marks on the ground (cast no shadow), cables (thin bars). */
export const KINDS = ['matte', 'metal', 'glow', 'mark', 'cable'];
export class Parts {
  constructor() { this.matte = []; this.metal = []; this.glow = []; this.mark = []; this.cable = []; this.lights = []; }
  /** Matte paint (stone, canvas, wood, limewash). */
  add(geo, color) { this.matte.push(painted(geo, color)); return this; }
  /** Painted metal (hulls, frames, cranes). */
  plate(geo, color) { this.metal.push(painted(geo, color)); return this; }
  /** Paint on the ground: a line, a ring (no shadow). */
  paint(geo, color) { this.mark.push(painted(geo, color)); return this; }
  /** A lamp, a lit window: glows at night. */
  lit(geo, color) { this.glow.push(painted(geo, color)); return this; }
  /** A cable or rope from a to b (stays a line however far: thin.js). */
  rope(a, b, color = '#1e2226', r = 0.035) {
    const d = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
    const g = new THREE.CylinderGeometry(r, r, L, 4, 1, true).translate(0, L / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize())).translate(...a);
    this.cable.push(thinBar(painted(g, color), V(...a), V(...b)));
    return this;
  }
  /** A light (x, y, z, radius) for the level's local lights. */
  light(x, y, z, r) { this.lights.push([x, y, z, r]); return this; }
  /** Every part moved by a matrix (copies when `copy`): a craft placed in its port. */
  apply(m, into = this) {
    const q = new THREE.Vector3();
    for (const k of KINDS) for (const g of this[k]) into[k].push(moved(g, m));
    for (const [x, y, z, r] of this.lights) { q.set(x, y, z).applyMatrix4(m); into.lights.push([q.x, q.y, q.z, r]); }
    return into;
  }
}

// ---- small shapes
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const ball = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const half = (r, w = 16, h = 8) => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);   // (the lower half)
const torus = (R, r, arc = Math.PI * 2, t = 18) => new THREE.TorusGeometry(R, r, 5, t, arc);

/** Four splayed legs with round feet, at ±x, ±z, from height y down to the ground. */
function legs(P, x, z, y, color) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    P.plate(T(cyl(0.09, 0.11, y * 1.08, 6), [sx * (x + 0.2), y / 2, sz * z], [sz * 0.18, 0, -sx * 0.2]), color);
    P.plate(T(cyl(0.3, 0.34, 0.12, 8), [sx * (x + 0.38), 0.06, sz * (z + 0.1)]), color);
  }
}

export const CRAFT = {
  /** The moorers' sky-boat (the City in Space): a long round capsule, its top and its belly each their own colour (the
   *  sheet's two-tone boats), a long low cabin forward with a lit band of windows, portholes, two lamps in its blunt nose,
   *  a keel under it, a fin, stabilisers and a screw at its tail, a mast. About 9 m long, 2.2 m wide, 2.4 m deep in the
   *  hull (issue #447: the v1.84 first boat was a 7.5 × 2.6 m lens, squat beside the sheet's boats). */
  skyboat({ hull = '#f2dcc4', belly = '#e0786a', trim = '#3e6e7a', lamp = '#ffd48c' } = {}) {
    const P = new Parts();
    const prof = [[0.22, -4.3], [0.7, -3.85], [0.98, -3.0], [1.1, -1.6], [1.12, 0.6], [1.06, 2.3], [0.88, 3.4], [0.55, 4.1], [0.06, 4.35]];
    const Y = 1.62, SY = 1.06;   // (the hull's middle over the ground, its depth against its width)
    // (two half-lathes of one profile: the top in the hull's colour, the belly in its own; lathe angle 0 is straight down
    //  once laid along z, so -PI/2 .. PI/2 is the lower half)
    const halfHull = (start) => {
      const g = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 18, start, Math.PI);
      return g.rotateX(Math.PI / 2).scale(1, SY, 1).translate(0, Y, 0);
    };
    P.plate(halfHull(Math.PI / 2), hull);
    P.plate(halfHull(-Math.PI / 2), belly);
    P.plate(T(box(0.14, 0.42, 3.8), [0, Y - 1.12 * SY - 0.02, -0.3]), trim);   // (the keel it sits on)
    for (const z of [-1.9, 1.3]) P.plate(T(box(0.9, 0.24, 0.3), [0, 0.12, z]), trim);   // (and its two skids)
    // the cabin: long and low, forward of the middle, a lit band of windows under its roof
    P.plate(T(cyl(0.66, 0.74, 0.42, 14), [0, Y + 1.12, 0.9], [0, 0, 0], [1, 1, 2.1]), hull);
    P.lit(T(cyl(0.67, 0.67, 0.24, 14), [0, Y + 1.43, 0.9], [0, 0, 0], [1, 1, 2.1]), lamp);
    P.plate(T(half(0.68, 14, 5), [0, Y + 1.55, 0.9], [Math.PI, 0, 0], [1, 0.5, 2.1]), trim);
    // portholes down each side, two lamps in the nose
    for (const s of [-1, 1]) {
      for (const z of [-1.4, -0.4, 0.6]) P.lit(T(cyl(0.16, 0.16, 0.08, 10), [s * 1.09, Y + 0.25, z], [0, 0, Math.PI / 2]), lamp);
      P.lit(T(cyl(0.2, 0.2, 0.08, 10), [s * 0.42, Y - 0.05, 4.15], [Math.PI / 2 - 0.45, 0, s * 0.35]), lamp);
    }
    // the tail: a fin, two stabilisers, the screw's hub and blades
    P.plate(T(box(0.12, 1.0, 1.1), [0, Y + 1.05, -3.55], [0.45, 0, 0]), trim);
    for (const s of [-1, 1]) P.plate(T(box(1.1, 0.08, 0.75), [s * 1.0, Y + 0.05, -3.55], [0, 0, s * 0.12]), trim);
    P.plate(T(cyl(0.18, 0.3, 0.55, 10), [0, Y, -4.45], [Math.PI / 2, 0, 0]), trim);
    for (const r of [0, Math.PI / 2]) P.plate(T(box(1.1, 0.14, 0.05), [0, Y, -4.75], [0, 0, r]), trim);
    // a mast behind the cabin with its yard
    P.plate(T(cyl(0.04, 0.05, 1.7, 4), [0, Y + 1.9, -0.9]), trim);
    P.plate(T(cyl(0.025, 0.025, 0.8, 4), [0, Y + 2.45, -0.9], [0, 0, Math.PI / 2]), trim);
    return P;
  },
  /** The Underwater City's pod: a riveted sphere, a brass band and porthole rings, a great front window. */
  pod({ hull = '#e88a7a', brass = '#c8a050', glass = '#9fd6cc' } = {}) {
    const P = new Parts();
    P.plate(T(ball(1.5, 18, 12), [0, 1.7, 0]), hull);
    P.plate(T(torus(1.52, 0.09, Math.PI * 2, 24), [0, 1.7, 0], [Math.PI / 2, 0, 0]), brass);
    P.plate(T(torus(0.95, 0.12, Math.PI * 2, 18), [0, 1.75, 1.2]), brass);
    P.lit(T(cyl(0.92, 0.92, 0.1, 18), [0, 1.75, 1.18], [Math.PI / 2, 0, 0]), glass);
    P.plate(T(cyl(0.45, 0.5, 0.35, 12), [0, 3.25, 0]), brass);
    for (const s of [-1, 1]) P.plate(T(torus(0.22, 0.06), [s * 1.4, 2.0, 0.2], [0, Math.PI / 2, 0]), brass);
    P.plate(T(cyl(1.0, 1.25, 0.35, 14), [0, 0.18, 0]), brass);   // (its skid ring)
    P.plate(T(cyl(0.12, 0.22, 0.6, 8), [0, 1.6, -1.65], [Math.PI / 2, 0, 0]), brass);
    return P;
  },
  /** A winged courier: a long fuselage, a glass canopy, swept wings, a fin, two engines (the Waterfall's, the Market's). */
  dart({ hull = '#ece4d2', stripe = '#d8843c', glass = '#7fb0c0', fin = '#3a6a9a' } = {}) {
    const P = new Parts();
    P.plate(spindle([[0.15, -3.4], [0.75, -2.6], [0.85, -0.4], [0.7, 1.6], [0.35, 3.0], [0.05, 3.5]], { seg: 12, sx: 1, sy: 0.75 }).translate(0, 1.2, 0), hull);
    P.plate(T(box(1.72, 0.12, 4.0), [0, 1.05, -0.4]), stripe);
    P.lit(T(ball(0.6, 12, 8), [0, 1.6, 0.9], [0, 0, 0], [0.9, 0.7, 1.9]), glass);
    for (const s of [-1, 1]) {
      P.plate(T(box(3.2, 0.12, 1.6), [s * 2.1, 1.05, -1.4], [0, s * 0.45, 0]), hull);
      P.plate(T(box(0.9, 0.13, 0.5), [s * 3.2, 1.06, -1.9], [0, s * 0.45, 0]), stripe);
      P.plate(T(cyl(0.32, 0.3, 1.8, 10), [s * 0.95, 1.25, -2.4], [Math.PI / 2, 0, 0]), hull);
      P.lit(T(cyl(0.22, 0.22, 0.06, 10), [s * 0.95, 1.25, -3.32], [Math.PI / 2, 0, 0]), '#ffd08a');
      P.plate(T(cyl(0.05, 0.05, 0.9, 4), [s * 0.4, 1.0, 3.2], [Math.PI / 2, 0, 0]), fin);
    }
    P.plate(T(box(0.12, 1.5, 1.4), [0, 2.1, -2.8], [-0.35, 0, 0]), fin);
    P.plate(T(box(0.13, 0.3, 0.5), [0, 2.55, -3.05], [-0.35, 0, 0]), stripe);
    return P;
  },
  /** The Signal Market's walker: a yellow cab on four bent legs, a wide windscreen. */
  buggy({ hull = '#e2b84a', dark = '#6a5a3a', glass = '#9cc8d0' } = {}) {
    const P = new Parts();
    P.plate(T(box(1.9, 1.1, 2.8), [0, 1.3, 0]), hull);
    P.plate(T(box(1.7, 0.7, 1.4), [0, 2.1, 0.1], [0.12, 0, 0]), hull);
    P.lit(T(box(1.5, 0.5, 0.08), [0, 2.1, 0.82], [0.5, 0, 0]), glass);
    P.plate(T(box(2.0, 0.18, 2.9), [0, 0.78, 0]), dark);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      P.plate(T(box(0.18, 0.9, 0.18), [sx * 1.25, 0.55, sz * 1.1], [0, 0, sx * 0.5]), dark);
      P.plate(T(cyl(0.22, 0.25, 0.12, 8), [sx * 1.5, 0.06, sz * 1.1]), dark);
    }
    P.lit(T(cyl(0.16, 0.16, 0.06, 8), [0.55, 1.4, 1.42], [Math.PI / 2, 0, 0]), '#fff0b0');
    P.lit(T(cyl(0.16, 0.16, 0.06, 8), [-0.55, 1.4, 1.42], [Math.PI / 2, 0, 0]), '#fff0b0');
    return P;
  },
  /** A box freighter on legs: a panelled body, a round intake in its blunt nose, a fin (the Market's, the Buried Machine's). */
  hauler({ hull = '#a8aab0', trim = '#6a7078', glass = '#2a3238', fin = '#8a9098' } = {}) {
    const P = new Parts();
    P.plate(T(box(2.6, 2.0, 5.4), [0, 2.0, 0]), hull);
    P.plate(T(box(2.2, 1.6, 0.6), [0, 2.1, 2.9], [0.15, 0, 0]), trim);
    P.lit(T(box(1.6, 0.45, 0.08), [0, 2.55, 3.25], [0.3, 0, 0]), glass);
    P.plate(T(torus(0.5, 0.12), [0, 1.65, 3.2]), trim);
    P.plate(T(box(2.75, 0.3, 4.6), [0, 1.0, -0.2]), trim);
    for (const s of [-1, 1]) P.plate(T(box(0.4, 1.0, 1.8), [s * 1.45, 2.2, -1.4]), trim);
    P.plate(T(box(0.15, 1.2, 1.3), [0, 3.4, -2.2], [-0.3, 0, 0]), fin);
    legs(P, 1.1, 1.9, 1.0, trim);
    return P;
  },
  /** The Glass Dunes' skiff: a long hull of bottle-green glass, a pale rim, a seat. */
  skiff({ glass = '#4e9a6e', rim = '#e8dcc0', seat = '#8a6a48' } = {}) {
    const P = new Parts();
    P.plate(T(half(1, 16, 6), [0, 0.75, 0], [0, 0, 0], [1.0, 0.75, 3.1]), glass);
    P.plate(T(torus(1, 0.07, Math.PI * 2, 28), [0, 0.75, 0], [Math.PI / 2, 0, 0], [1.0, 3.1, 1]), rim);
    P.add(T(box(0.8, 0.35, 0.6), [0, 0.65, -0.6]), seat);
    P.add(T(box(0.8, 0.5, 0.15), [0, 0.95, -0.95]), seat);
    P.plate(T(cyl(0.03, 0.03, 1.2, 4), [0.6, 1.3, -2.2]), rim);
    return P;
  },
  /** A float-sledge: a slatted bed on curled runners, its glass floats lashed on, a canvas over them when `canopy`. */
  sledge({ wood = '#9a7a52', runner = '#c8b48a', float = '#3e8a68', canvas = '#d89a48', canopy = false } = {}) {
    const P = new Parts();
    P.add(T(box(1.8, 0.18, 3.6), [0, 0.6, 0]), wood);
    for (const s of [-1, 1]) {
      P.add(T(box(0.12, 0.12, 3.8), [s * 0.95, 0.12, 0]), runner);
      P.add(T(torus(0.35, 0.06, Math.PI, 8), [s * 0.95, 0.45, 1.9], [0, Math.PI / 2, -Math.PI / 2]), runner);
      for (const z of [-1.2, 0, 1.2]) P.add(T(box(0.08, 0.5, 0.08), [s * 0.9, 0.36, z]), runner);
      P.add(T(box(0.08, 0.4, 3.6), [s * 0.88, 0.85, 0]), wood);
    }
    for (const [x, z] of [[-0.45, -1.1], [0.45, -1.1], [-0.45, 0], [0.45, 0], [-0.45, 1.1], [0.45, 1.1]]) P.plate(T(ball(0.42, 12, 8), [x, 1.12, z]), float);
    P.rope([-0.9, 1.0, -1.6], [0.9, 1.0, 1.6], '#4a3a28', 0.02);
    if (canopy) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add(T(cyl(0.04, 0.04, 2.4, 4), [sx * 0.95, 1.8, sz * 1.7]), runner);
      P.add(T(box(2.3, 0.05, 4.0), [0, 3.0, 0], [0, 0, 0.06]), canvas);
    }
    return P;
  },
  /** The Eclipse city's junk: a pale boat, a batten sail on a mast, a lantern at the bow. */
  junk({ hull = '#ece2d0', sail = '#e6d8b8', batten = '#8a7a62', lamp = '#ffd27a' } = {}) {
    const P = new Parts();
    P.plate(spindle([[0.2, -3.2], [1.1, -2.4], [1.25, 0], [1.0, 2.2], [0.15, 3.4]], { seg: 14, sx: 1, sy: 0.6 }).translate(0, 1.0, 0), hull);
    P.plate(T(box(2.0, 0.12, 5.2), [0, 1.35, 0]), batten);
    P.plate(T(cyl(0.07, 0.09, 6.5, 6), [0, 4.4, 0.3]), batten);
    P.add(T(box(0.06, 4.4, 3.4), [0, 4.3, -0.9], [0.08, 0, 0]), sail);
    for (let i = 0; i < 6; i++) P.plate(T(box(0.1, 0.06, 3.5), [0, 2.3 + i * 0.8, -0.9 + i * 0.07], [0.08, 0, 0]), batten);
    P.add(T(box(1.2, 0.7, 1.0), [0, 1.7, -1.8]), '#b89a72');
    P.plate(T(cyl(0.04, 0.04, 1.6, 4), [0, 2.0, 3.0]), batten);
    P.lit(T(cyl(0.18, 0.22, 0.42, 6), [0, 2.95, 3.0]), lamp);
    P.light(0, 2.95, 3.0, 6);
    return P;
  },
  /** Salt Harbour's sand-skiff: a boat's body on long runners, a sail, an engine at the stern. */
  sandskiff({ hull = '#d8c49a', sail = '#ece0c4', runner = '#7a6a52', seat = '#a8603a' } = {}) {
    const P = new Parts();
    P.plate(spindle([[0.15, -2.6], [0.8, -2.0], [0.9, 0], [0.55, 2.2], [0.05, 2.9]], { seg: 12, sx: 1.1, sy: 0.55 }).translate(0, 1.0, 0), hull);
    P.add(T(box(0.7, 0.4, 0.7), [0, 1.35, -0.3]), seat);
    P.plate(T(cyl(0.35, 0.35, 1.6, 10), [0, 1.25, -2.0], [Math.PI / 2, 0, 0]), runner);
    for (const s of [-1, 1]) {
      P.plate(T(box(0.1, 0.08, 6.4), [s * 1.1, 0.06, 0]), runner);
      for (const z of [-1.8, 1.4]) P.plate(T(box(0.08, 0.95, 0.08), [s * 0.85, 0.5, z], [0, 0, s * 0.35]), runner);
    }
    P.plate(T(cyl(0.05, 0.06, 4.2, 5), [0, 3.1, 0.8]), runner);
    P.add(T(box(0.05, 3.2, 2.2), [0, 3.0, -0.4], [0.1, 0, 0]), sail);
    return P;
  },
  /** A round hopper on four legs: a blue-and-orange shell, a glass dome, side pods (Salt Harbour's). */
  hopper({ hull = '#6a8ab8', patch = '#d8784a', glass = '#a8c8d0', leg = '#6a6258' } = {}) {
    const P = new Parts();
    P.plate(T(ball(1, 16, 10), [0, 1.9, 0], [0, 0, 0], [1.5, 1.0, 2.0]), hull);
    P.plate(T(ball(1, 12, 8), [0, 1.85, 1.2], [0, 0, 0], [1.2, 0.8, 1.0]), patch);
    P.lit(T(ball(0.9, 12, 8), [0, 2.65, 0.1], [0, 0, 0], [0.9, 0.6, 1.2]), glass);
    for (const s of [-1, 1]) P.plate(T(spindle([[0.1, -1.4], [0.45, -0.8], [0.45, 0.7], [0.1, 1.3]], { seg: 8 }), [s * 1.75, 1.8, -0.2]), patch);
    legs(P, 1.0, 1.3, 1.2, leg);
    return P;
  },
  /** The Buried Machine's ore hopper: a tapered bucket heaped with coal on short legs, a round engine at its back. */
  orecart({ bucket = '#b8783a', coal = '#2e2c2c', leg = '#6a5040' } = {}) {
    const P = new Parts();
    P.plate(T(cyl(1.6, 1.1, 1.5, 4), [0, 1.6, 0], [0, Math.PI / 4, 0], [1, 1, 1.3]), bucket);
    P.add(T(cyl(0.2, 1.35, 0.7, 7), [0, 2.6, 0], [0, 0, 0], [1, 1, 1.25]), coal);
    P.plate(T(cyl(0.55, 0.55, 0.8, 12), [0, 1.4, -1.9], [Math.PI / 2, 0, 0]), leg);
    P.lit(T(cyl(0.3, 0.3, 0.05, 10), [0, 1.4, -2.32], [Math.PI / 2, 0, 0]), '#ffb060');
    legs(P, 0.7, 0.9, 0.85, leg);
    return P;
  },
};

/** Every part of a built model (an Object3D of meshes: the City-Shaft's cab, taxi.js) as painted parts, its glow apart. */
export function partsOf(obj) {
  const P = new Parts();
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld), u = o.material.uniforms;
    const glow = (u?.uGlow?.value ?? 0) > 0.5;
    if (o.material.vertexColors && g.attributes.color) {
      const n = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
      (glow ? P.glow : P.metal).push(n);
    } else {
      const c = u?.uColor?.value ?? o.material.color ?? new THREE.Color('#888888');
      (glow ? P.glow : P.metal).push(painted(g, `#${c.getHexString()}`));
    }
  });
  return P;
}
