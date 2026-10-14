import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { forearmMount, forearmFrame, forearmWrap, wrapFrame, wrapLift, carry, fitScale, FOREARM, STRAP } from './blade-grip.js';
import { SWORD_TONES } from './fluid-sword.js';
import { BLADE_LOOK, BLADE_QUALITY } from './blade-shader.js';

// The shield (issue #284; references/Core Objects/Fluid Shield/shield-turnaround, guard-poses): a makers' brass hub
// on a leather bracer strapped round the traveller's left forearm (src/blade-grip.js forearmMount), always there
// with the backpack, folded small: six brass petals closed round the hub. Raise the guard (LB / L1) and it opens in a
// blink: the petals spin out inside a riveted brass ring, the hub stands off the bracer on its short knuckled arm,
// and the tank's fluid floods out round them into a living disc of the sword's own water (src/blade-shader.js,
// BLADE_DISC: the currents wound in a slow swirl round the hub, the pen round them, ripples, motes, the breathing
// glow), its edge never quite round, rippling, a bright pale lemon rim. The arm that wears it raises it: the guard
// clip's, braced a little across so the hub stands before the chest (brace), the face turned on its knuckle to the
// guard's way. Seen from behind him (the camera) its back sheet is see-through but for the rim, the swirl's strokes
// and a print screen of the water. A block sends a ring running out to the rim, a perfect parry bursts bright rings
// off it, a blow it cannot take (the tank empty) cracks it and it flickers; let go and the fluid drains back into
// the hub and the petals fold away.
//
//   new ShieldState()            the pure state machine: update(dt, want) -> 'open' | 'close' | null,
//                                hit('block' | 'perfect' | 'broken'); open, fill, ribs(i), flare, flash, crack
//   blobRadius(theta, t, wobble) the fluid's edge (unit radius about 1): never a circle, rippling with time
//   shieldArc(chest, centre, normal, radius, up)   the bearing a shape covers round the chest (the guard's arc);
//                                radius a number (a disc) or { plus, minus } (its reach either side, measured)
//   braceShift(hub, chest, dir, up, w)   how far the raised arm is brought across so the hub stands before the chest
//   dishZ(s)                     the disc's face (m, out of the hub's plane) at s of the way to the rim: a shallow dish
//   shieldMaterial(key)          the disc's water: the sword's blade material, spread (BLADE_DISC)
//   new ShieldDevice(tool)       the drawn device: update(dt, { want, dir, up, chest }) after the pose, arc() for the guard
//   buildShieldFace(key)         the open face alone (the box's reveal, the menu's picture)

export const SHIELD = {
  radius: 0.35,       // m, open (the blob's mean reach; the traveller stays in sight behind it)
  petal: 0.1,         // m, the brass petals' reach round the hub
  hub: 0.034,         // m, the folded disc
  ribs: 6,
  open: 0.16,         // s to open (the guard is up at half of it: GUARD in src/fluid-blade.js)
  close: 0.14,        // s to fold away
  stand: 0.05,        // m the open hub stands off the bracer on its knuckled arm (folded: `folded`)
  folded: 0.008,       // m the folded hub's face stands over the plate (its drum's foot down on the plate: bendDisc)
  slack: 0.15,        // m round the rim a blow still meets it (the foe's swing is not a line)
  // raised, the arm is brought across (brace) so the bracer stands `middle` m to the left of the chest's middle line,
  // by `brace` m at most
  middle: 0.05, brace: 0.3,
  swivel: 1.3,        // rad its face turns on the knuckle off the forearm's outside, at most
  wobble: 1,          // the edge's ripple at rest (1: the blob's own); spilling out and struck it ripples more
  flare: 0.25, flash: 0.4, crack: 0.7,   // s each hit's look lasts
};

const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Open or folded and how far between, and what the last blow did to it. Pure: no three.js. */
export class ShieldState {
  constructor() { this.k = 0; this.state = 'folded'; this.flare = 0; this.flash = 0; this.crack = 0; this.t = 0; this.spin = 0; }

  /** A frame: `want` the guard is held. Returns 'open' as it starts to open, 'close' as it starts to fold, else null. */
  update(dt, want) {
    dt = Math.max(0, dt);
    this.t += dt;
    let said = null;
    if (want && (this.state === 'folded' || this.state === 'closing')) { this.state = 'opening'; said = 'open'; }
    else if (!want && (this.state === 'open' || this.state === 'opening' || this.state === 'broken')) { this.state = 'closing'; said = 'close'; }
    if (this.state === 'opening') { this.k = Math.min(1, this.k + dt / SHIELD.open); if (this.k >= 1) this.state = 'open'; }
    else if (this.state === 'closing') { this.k = Math.max(0, this.k - dt / SHIELD.close); if (this.k <= 0) this.state = 'folded'; }
    this.flare = Math.max(0, this.flare - dt / SHIELD.flare);
    this.flash = Math.max(0, this.flash - dt / SHIELD.flash);
    this.crack = Math.max(0, this.crack - dt / SHIELD.crack);
    if (this.state === 'broken' && this.crack === 0) this.state = this.k >= 1 ? 'open' : 'opening';
    this.spin += dt * (this.state === 'opening' ? 9 : this.state === 'closing' ? -9 : 0.25);
    return said;
  }

  /** A blow on it: 'block' flares it, 'perfect' flashes it, 'broken' cracks it (it flickers while held). */
  hit(kind) {
    if (this.k <= 0) return;
    if (kind === 'perfect') { this.flash = 1; this.flare = 1; }
    else if (kind === 'broken') { this.crack = 1; this.state = 'broken'; }
    else this.flare = 1;
  }

  get up() { return this.state !== 'folded'; }
  /** The fluid between the ribs, 0 at the hub .. 1 to the rim (it floods once the ribs are mostly out, drains first). */
  get fill() { return smooth(this.k, 0.35, 1); }
  /** Rib i of n: 0 folded in the disc .. 1 out at its place (each a little after the last). */
  rib(i, n = SHIELD.ribs) { const d = (i / n) * 0.3; return smooth(this.k, d, d + 0.6); }
  /** How much its edge ripples now: spilling out, struck, cracked it ripples more. */
  get wobble() { return SHIELD.wobble * (1 + 1.4 * (1 - this.fill) + 1.2 * this.flare + 0.8 * this.crack); }
  /** Seen at all this frame (a cracked one flickers out now and then). */
  shown(t = this.t) { return !(this.crack > 0.15 && Math.sin(t * 91 + Math.sin(t * 37) * 3) > 0.35); }
}

/**
 * The fluid's edge at bearing `theta` round the hub (unit: about 1, between ~0.86 and ~1.1), at time `t`:
 * three waves of different counts running round at different speeds, so it is never a circle and never
 * the same twice; `wobble` scales them (0: a circle). Pure.
 */
export function blobRadius(theta, t = 0, wobble = 1) {
  const w = 0.06 * Math.sin(3 * theta + 1.3 * t) + 0.04 * Math.sin(5 * theta - 2.1 * t + 1) + 0.025 * Math.sin(8 * theta + 3.4 * t + 2);
  return 1 + Math.min(2.5, wobble) * w;
}

/**
 * The guard's arc from the shield as drawn: the bearings round `chest` (flat, about `up`) between
 * the shape's two edges (its reach either side of `centre` across its facing `normal`, + SHIELD.slack).
 * `radius` is a number (a disc: the same reach both ways) or { plus, minus }: its reach toward
 * up × normal and away from it, measured off the drawn edge (ShieldDevice.arc).
 * Returns { dir (flat unit, the arc's middle), half (rad) } for inGuard (src/fluid-blade.js).
 */
export function shieldArc(chest, centre, normal, radius, up = new THREE.Vector3(0, 1, 0), slack = SHIELD.slack) {
  const flat = (v) => v.addScaledVector(up, -v.dot(up));
  const n = flat(normal.clone());
  if (n.lengthSq() < 1e-8) n.copy(flat(new THREE.Vector3().subVectors(centre, chest)));
  n.normalize();
  const plus = typeof radius === 'number' ? radius : radius.plus, minus = typeof radius === 'number' ? radius : radius.minus;
  const side = new THREE.Vector3().crossVectors(up, n).normalize();
  const a = flat(new THREE.Vector3().subVectors(centre, chest).addScaledVector(side, plus + slack)).normalize();
  const b = flat(new THREE.Vector3().subVectors(centre, chest).addScaledVector(side, -(minus + slack))).normalize();
  const dir = new THREE.Vector3().addVectors(a, b);
  if (dir.lengthSq() < 1e-8) dir.copy(n); else dir.normalize();
  return { dir, half: Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) / 2 };
}

/**
 * How far to bring the raised arm across (world, flat, toward his right): the bracer at `hub` (world) stands
 * SHIELD.middle to the left of the chest's middle line (`chest`, the guard's flat way `dir`, `up`), moved
 * SHIELD.brace at most, never out to the left; `w` (0..1) how raised. Pure but for the vectors; writes `out`.
 */
export function braceShift(hub, chest, dir, up, w = 1, out = new THREE.Vector3(), { middle = SHIELD.middle, brace = SHIELD.brace } = {}) {
  const left = new THREE.Vector3().crossVectors(up, dir).normalize();
  const across = new THREE.Vector3().subVectors(hub, chest).dot(left);
  return out.copy(left).multiplyScalar(-THREE.MathUtils.clamp(across - middle, 0, brace) * w);
}

/** The disc's face at `s` (0 the hub .. 1 the rim), m out of the hub's plane: a shallow dish, its rim a little forward. */
export const dishZ = (s) => -0.011 + 0.028 * s * s;
/** The lens's thickness at `s` (m): thickest at the hub (the sheet's side view). */
const lens = (s) => 0.002 + 0.01 * (1 - s * s);

/**
 * A petal: a brass paddle, narrow at the hub and round at its end (the sheet's flower), y 0..1 along it (scaled to
 * its length as it spins out), x across in metres, a few millimetres thick.
 */
function petalGeometry() {
  const P = new THREE.Shape(), w = 0.024, n = 0.006;
  P.moveTo(-n, 0.05); P.bezierCurveTo(-n * 1.5, 0.3, -w, 0.45, -w, 0.68);
  P.bezierCurveTo(-w, 0.98, w, 0.98, w, 0.68); P.bezierCurveTo(w, 0.45, n * 1.5, 0.3, n, 0.05); P.closePath();
  return new THREE.ExtrudeGeometry(P, { depth: 0.004, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, 0.002);
}

/** The disc's water: the sword's living blade material (src/fluid-sword.js swordMaterial's tones), spread (BLADE_DISC). */
export function shieldMaterial(key = 'fluid-shield') {
  const T = SWORD_TONES;
  return makeMaterial({ color: '#ffffff', fluid: 'blade', disc: true, glow: 0.5, fluidBase: T.base, fluidTones: [T.cream, T.deep, T.pale, T.gold, T.base, T.light], key });
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _Z = new THREE.Vector3(0, 0, 1), _Y = new THREE.Vector3(0, 1, 0);
const BEND = { n: 10, step: 0.004 };   // the plate's drop across the arm, sampled every 4 mm out to 4 cm each side (bendDisc)

/**
 * The bracer's leather (issue #303): for each of STRAP.bands a band round the forearm, its rows of STRAP.sectors points
 * (the inside on the skin at its first edge, the outside at each of its rows, the inside again at its last edge),
 * laid each frame on the skin by ShieldDevice.wrapStrap. Until it is (no skin to read), a plain round strap.
 */
function strapGeometry(n = STRAP.sectors) {
  const pos = [], uv = [], index = [];
  let base = 0;
  for (const band of STRAP.bands) {
    const rows = [[band[0], 0.039], ...band.map((y) => [y, 0.042]), [band[band.length - 1], 0.039]];
    rows.forEach(([y, r], j) => {
      for (let k = 0; k < n; k++) {
        const th = (k / n) * Math.PI * 2;
        pos.push(Math.sin(th) * r, y, Math.cos(th) * r - FOREARM.lift);
        uv.push(k / n, j / (rows.length - 1));
      }
    });
    for (let j = 0; j + 1 < rows.length; j++) for (let k = 0; k < n; k++) {
      const a = base + j * n + k, b = base + j * n + ((k + 1) % n), c = a + n, d = b + n;
      index.push(a, b, c, b, d, c);
    }
    base += rows.length * n;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * A flat stroke in the shield's plane, rebuilt as it flows: a line of points with a width at each,
 * both faces drawn (it is seen from the front and over the shoulder alike).
 */
class Stroke {
  constructor(n, material, closed = false, z = 0) {
    this.n = n; this.closed = closed; this.z = z;
    const pos = new Float32Array(n * 2 * 3), nor = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n * 2; i++) nor[i * 3 + 2] = 1;
    const idx = [], segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = ((i + 1) % n) * 2;
      idx.push(a, a + 1, b, a + 1, b + 1, b, a, b, a + 1, a + 1, b, b + 1);   // (and the back)
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, material);
    this.pts = Array.from({ length: n }, () => [0, 0, 0]);   // x, y, half-width
  }
  /** Rebuild from this.pts (filled by the caller). */
  build() {
    const P = this.pts, n = this.n, pos = this.geo.attributes.position.array;
    for (let i = 0; i < n; i++) {
      const p = P[i], a = P[this.closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[this.closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const w = p[2];
      pos.set([p[0] - ty * w, p[1] + tx * w, this.z, p[0] + ty * w, p[1] - tx * w, this.z], i * 6);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}

/**
 * The fluid's disc: a lens of two sheets (the face, +z, aFold.y 1; the back, aFold.y 0.5), RINGS rings of SEGS points
 * round a centre; x, y in units of its reach (the mesh is scaled by it), z in metres (dishZ, lens). Rebuilt each frame
 * to the edge's ripple (blobRadius); aFold.x the share of the way out (0 the hub .. 1 the edge).
 */
const RINGS = 9, SEGS = 72;
class Disc {
  constructor(material) {
    const per = 1 + RINGS * SEGS, n = per * 2;
    const pos = new Float32Array(n * 3), fold = new Float32Array(n * 2);
    const idx = [];
    for (let sheet = 0; sheet < 2; sheet++) {
      const o = sheet * per, back = sheet === 1;
      for (let r = 0; r < RINGS; r++) for (let i = 0; i < SEGS; i++) {
        const j = (i + 1) % SEGS, a = o + 1 + r * SEGS + i, b = o + 1 + r * SEGS + j;
        if (r === 0) { if (back) idx.push(o, b, a); else idx.push(o, a, b); continue; }
        const c = a - SEGS, d = b - SEGS;
        if (back) idx.push(c, b, a, c, d, b); else idx.push(c, a, b, c, b, d);
      }
      for (let v = 0; v < per; v++) {
        const s = v === 0 ? 0 : (1 + Math.floor((v - 1) / SEGS)) / RINGS;
        fold[(o + v) * 2] = s; fold[(o + v) * 2 + 1] = back ? 0.5 : 1;
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('aFold', new THREE.BufferAttribute(fold, 2));
    this.geo.setIndex(idx);
    this.per = per;
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.name = 'shield fluid';
  }
  /** Its edge at time t with `wobble` (blobRadius), its reach R (m). */
  build(R, t, wobble) {
    const pos = this.geo.attributes.position.array, per = this.per;
    for (let sheet = 0; sheet < 2; sheet++) {
      const o = sheet * per;
      pos.set([0, 0, dishZ(0) - (sheet ? lens(0) : 0)], o * 3);
      for (let i = 0; i < SEGS; i++) {
        const th = (i / SEGS) * Math.PI * 2, e = blobRadius(th, t, wobble), cx = Math.cos(th) * e, cy = Math.sin(th) * e;
        for (let r = 0; r < RINGS; r++) {
          const s = (r + 1) / RINGS, k = (o + 1 + r * SEGS + i) * 3;
          pos[k] = cx * s; pos[k + 1] = cy * s; pos[k + 2] = dishZ(s) - (sheet ? lens(s) : 0);
        }
      }
    }
    this.mesh.scale.set(R, R, 1);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}

/** The device on the left forearm, drawn: the bracer and its folded hub, the knuckled arm, the petals, the fluid, the cracks. */
export class ShieldDevice {
  constructor(tool, { key = 'fluid-shield' } = {}) {
    this.tool = tool;
    this.s = new ShieldState();
    const brass = makeMaterial({ color: '#c99a46', metal: 'brass', key: 'fluid-blade-brass' });
    const dark = makeMaterial({ color: '#5b4326', metal: 'brass', key: 'shield-brass-dark' });
    const leather = makeMaterial({ color: '#7a4a2c', key: 'shield-strap' });
    const edge = makeMaterial({ color: '#fffbea', flat: true, glow: 1, key: 'fluid-blade-edge' });
    const ink = makeMaterial({ color: '#2b211f', flat: true, key: 'shield-crack' });
    this.fluid = shieldMaterial(key);
    this.root = new THREE.Group();
    this.root.name = 'shield bracer';
    // the bracer: a worn leather strap round the forearm, wrapped on its skin (issue #303: wrapStrap, each frame, the
    // forearm's own skin under it: blade-grip.js forearmWrap), a brass plate riveted on its outside, bent to the arm;
    // on the plate the folded hub: a brass drum with a raised rim, its foot down on the plate however the arm curves
    // under it, the petals' ends drawn on its face like the leaves of a closed iris, a bead of the fluid at its middle.
    // One mesh a material (worn in every view; issue #111)
    this.strap = new THREE.Mesh(strapGeometry(), leather);
    this.strap.userData.ring = true;
    const plate = new THREE.BoxGeometry(0.05, 0.062, 0.006, 10, 1, 1).translate(0, -0.006, -0.001);
    const drum = new THREE.CylinderGeometry(SHIELD.hub, SHIELD.hub * 0.78, 0.007 + SHIELD.folded, 18).rotateX(Math.PI / 2).translate(0, 0, (0.007 + SHIELD.folded) / 2);
    const disc = new THREE.Group();
    const darkParts = [new THREE.TorusGeometry(SHIELD.hub * 0.92, 0.0035, 5, 20).translate(0, 0, 0.0085 + SHIELD.folded)];
    for (let i = 0; i < SHIELD.ribs; i++) {
      const a = (i / SHIELD.ribs) * Math.PI * 2;
      darkParts.push(new THREE.BoxGeometry(0.0025, SHIELD.hub * 0.5, 0.002).translate(0, SHIELD.hub * 0.5, 0.0078 + SHIELD.folded).rotateZ(a + 0.35));
    }
    const rivets = [[-0.019, 0.022], [0.019, 0.022], [-0.019, -0.034], [0.019, -0.034]].map(([x, y]) => new THREE.SphereGeometry(0.0035, 6, 4).translate(x, y, 0.002));   // (the plate's rivets)
    const brassDisc = new THREE.Mesh(mergeGeometries([plate, drum]), brass), darkDisc = new THREE.Mesh(mergeGeometries([...darkParts, ...rivets]), dark);
    // (what bends to the arm under it: the plate and its rivets all through, the drum at its foot; bendDisc)
    const plateN = plate.attributes.position.count, darkN = darkParts.reduce((n, g) => n + g.attributes.position.count, 0);
    this.bend = [[brassDisc, (i, z) => i < plateN || z < 0.0005], [darkDisc, (i) => i >= darkN]].map(([mesh, bends]) => {
      const P = mesh.geometry.attributes.position, base = Float32Array.from(P.array), which = [];
      for (let i = 0; i < P.count; i++) if (bends(i, P.getZ(i))) which.push(i);
      return { mesh, base, which };
    });
    disc.add(brassDisc, darkDisc);
    this.bead = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8).scale(1, 1, 0.5).translate(0, 0, 0.008 + SHIELD.folded), this.fluid);
    disc.add(this.bead);
    this.disc = disc;
    this.root.add(this.strap, disc);
    // the arm: a short brass link from a knuckle on the plate to the hub's back, swung out as it opens
    this.arm = new THREE.Group();
    this.rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 1, 8).translate(0, 0.5, 0), brass);
    this.knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), dark);
    this.knuckle.position.set(0, 0, 0.006);
    this.arm.add(this.rod, this.knuckle);
    this.root.add(this.arm);
    // the shield: on the arm's end, turned on its knuckle to face the guard's way (face). Round the hub six brass
    // petals inside a riveted brass ring (the solid part, before the water); round them the disc of fluid
    this.face = new THREE.Group();
    this.root.add(this.face);
    this.ribs = [];
    for (let i = 0; i < SHIELD.ribs; i++) {
      const pivot = new THREE.Group(), tilt = new THREE.Group();
      const petal = new THREE.Mesh(petalGeometry(), brass);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 5), dark);
      tilt.add(petal, tip); pivot.add(tilt);
      this.face.add(pivot);
      this.ribs.push({ pivot, tilt, rib: petal, tip, home: (i / SHIELD.ribs) * Math.PI * 2 });
    }
    const ringParts = [new THREE.TorusGeometry(SHIELD.petal * 1.02, 0.008, 6, 40), new THREE.CylinderGeometry(SHIELD.hub * 0.55, SHIELD.hub * 0.6, 0.016, 14).rotateX(Math.PI / 2).translate(0, 0, 0.008)];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ringParts.push(new THREE.SphereGeometry(0.0042, 6, 4).translate(Math.cos(a) * SHIELD.petal * 1.02, Math.sin(a) * SHIELD.petal * 1.02, 0.007)); }
    this.collar = new THREE.Mesh(mergeGeometries(ringParts.map((g) => g.index ? g.toNonIndexed() : g)), brass);
    // the fluid (the disc, rebuilt each frame at the shield's size) and a parry's bright rings bursting off its rim
    this.field = new THREE.Group();
    this.water = new Disc(this.fluid);
    this.bursts = [new Stroke(56, edge, true, 0.022), new Stroke(56, edge, true, 0.022)];
    this.field.add(this.water.mesh, ...this.bursts.map((s) => s.mesh));
    // the cracks: a zigzag of ink lines across the fluid from near the hub (x, y in its reach: scaled to it), on its face
    this.cracks = new THREE.Group();
    const zig = [[0.3, 0.1], [0.45, 0.22], [0.6, 0.12], [0.78, 0.3], [0.97, 0.2]];
    for (const turn of [0.3, 2.2, 4.1]) for (let i = 0; i < zig.length - 1; i++) {
      const [r0, a0] = zig[i], [r1, a1] = zig[i + 1];
      const p0 = new THREE.Vector2(Math.cos(turn + a0) * r0, Math.sin(turn + a0) * r0), p1 = new THREE.Vector2(Math.cos(turn + a1) * r1, Math.sin(turn + a1) * r1);
      const len = p0.distanceTo(p1), seg = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.004), ink);
      seg.position.set((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, dishZ((r0 + r1) / 2) + 0.003);
      seg.rotation.z = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      this.cracks.add(seg);
    }
    this.face.add(this.collar, this.field, this.cracks);
    this.root.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; o.frustumCulled = false; });
    this.root.visible = false;
    this.mount = null;
    this.centre = new THREE.Vector3(); this.normal = new THREE.Vector3(0, 0, 1);
    this.reach = 0;   // the blob's reach now (m, its mean radius as drawn)
    this.outline = Array.from({ length: 36 }, () => new THREE.Vector3());   // its edge in the world, for the arc
  }

  /** On the left forearm once there is a body with arms (else nowhere: no shield drawn, the guard's own arc). */
  attach() {
    const H = this.tool.player?.humanoid;
    if (H && this.mount?.bone && this.mount.humanoid === H && this.root.parent === this.mount.bone) {
      forearmFrame(this.mount);
      carry(this.root, this.mount);
      this.wrapStrap();
      return true;
    }
    const m = H?.b?.lowerarm_l && H.b.hand_l ? forearmMount(H) : null;
    if (!m) { this.root.removeFromParent(); this.mount = null; this.wrap = null; return false; }
    this.mount = Object.assign(m, { humanoid: H });
    // (the skin it is strapped on, read once a body: blade-grip.js forearmWrap)
    this.wrap = forearmWrap(H, this.mount);
    carry(this.root, this.mount);
    this.wrapStrap();
    return true;
  }

  /**
   * The strap wrapped on the forearm's skin as it is this frame (issue #303): the bracer stood on the skin the
   * strap's outside way (wrapLift), the leather laid on the skin's own points round the arm (wrapFrame), the plate
   * and the drum's foot bent to the strap under them. After the pose (and again after brace moves the arm).
   */
  wrapStrap() {
    const W = this.wrap, M = this.mount;
    if (!W || !M) return false;
    wrapFrame(W);
    const lift = wrapLift(W, M);
    if (lift <= 0) return false;
    M.position.copy(M.along).multiplyScalar(M.len * FOREARM.along).addScaledVector(M.out, lift + (STRAP.leather + STRAP.plate) * W.unit);
    this.root.position.copy(M.position);
    this.root.updateMatrix();
    _m.copy(this.root.matrix).invert();
    // the leather: each band's rows of skin points (forearm frame) into the bracer's, the inside on the skin, the
    // outside a leather's thickness off it, away from the bone line
    const P = this.strap.geometry.attributes.position, n = W.n;
    const centre = _c.copy(M.along).multiplyScalar(M.len * FOREARM.along).applyMatrix4(_m), axis = _d.copy(M.along).transformDirection(_m);
    const outer = this.outer ??= W.rows.map((r) => r.points.map(() => new THREE.Vector3()));
    let v = 0;
    for (const band of STRAP.bands.keys()) {
      const rows = W.rows.filter((r) => r.band === band), rings = [];
      for (const r of rows) {
        const o = outer[W.rows.indexOf(r)], inner = [];
        for (let k = 0; k < n; k++) {
          const p = _a.copy(r.points[k]).applyMatrix4(_m), rad = _b.subVectors(p, centre);
          rad.addScaledVector(axis, -rad.dot(axis)).normalize();
          inner.push(p.clone().addScaledVector(rad, 0.0005));
          o[k].copy(p).addScaledVector(rad, STRAP.leather);
        }
        rings.push({ inner, outer: o });
      }
      for (const ring of [rings[0].inner, ...rings.map((r) => r.outer), rings[rings.length - 1].inner]) for (let k = 0; k < n; k++) P.setXYZ(v++, ring[k].x, ring[k].y, ring[k].z);
    }
    P.needsUpdate = true;
    this.strap.geometry.computeVertexNormals();
    this.strap.geometry.computeBoundingSphere();
    this.bendDisc(outer.filter((_, i) => W.rows[i].band === 0), centre.z);
    return true;
  }

  /** The plate and its rivets laid on the strap's outside across the arm, the drum's foot down to it (wrapStrap). */
  bendDisc(rings, axisZ) {
    // the strap's outside across the arm, its upper side: the highest of the wide strap's rows at x
    const top = (x) => {
      let best = -Infinity;
      for (const ring of rings) for (let k = 0; k < ring.length; k++) {
        const a = ring[k], b = ring[(k + 1) % ring.length];
        if (a.z < axisZ || b.z < axisZ || (a.x - x) * (b.x - x) > 0 || a.x === b.x) continue;
        best = Math.max(best, a.z + ((x - a.x) / (b.x - a.x)) * (b.z - a.z));
      }
      return best;
    };
    // (sampled across the plate and the drum's foot, each side out from the middle: past the arm's edge, as its edge)
    const D = this.drop ??= new Float32Array(2 * BEND.n + 1), at0 = top(0);
    if (!Number.isFinite(at0)) return;
    D[BEND.n] = 0;
    for (const s of [-1, 1]) for (let j = 1, last = 0; j <= BEND.n; j++) {
      const z = top(s * j * BEND.step);
      D[BEND.n + s * j] = last = Number.isFinite(z) ? Math.min(last, z - at0) : last;
    }
    for (const { mesh, base, which } of this.bend) {
      const P = mesh.geometry.attributes.position;
      for (const i of which) {
        const f = THREE.MathUtils.clamp(base[i * 3] / BEND.step + BEND.n, 0, 2 * BEND.n), j = Math.min(Math.floor(f), 2 * BEND.n - 1);
        P.setZ(i, base[i * 3 + 2] + THREE.MathUtils.lerp(D[j], D[j + 1], f - j));
      }
      P.needsUpdate = true;
      mesh.geometry.computeBoundingSphere();
    }
  }

  /**
   * Raised, the arm that wears it is brought across before the chest (braceShift), as much as it is open: after the
   * pose (the guard clip's), before update. chest, dir (flat, the guard's way), up: as update's.
   */
  brace({ chest = null, dir = null, up = null } = {}) {
    const H = this.tool.player?.humanoid, B = H?.b, k = smooth(this.s.k, 0, 0.6);
    if (!chest || !dir || !up || k <= 0 || !B?.upperarm_l || !B.lowerarm_l || !B.hand_l || !H.solveTwoBone || !this.mount || this.root.parent !== this.mount.bone) return false;
    this.root.updateWorldMatrix(true, false);
    const hub = _a.setFromMatrixPosition(this.root.matrixWorld), shift = braceShift(hub, chest, dir, up, k, _b);
    if (shift.lengthSq() < 1e-8) return false;
    const target = B.hand_l.getWorldPosition(_c).add(shift), pole = B.lowerarm_l.getWorldPosition(_d).addScaledVector(up, -0.1);
    H.solveTwoBone(B.upperarm_l, B.lowerarm_l, B.hand_l, target, pole, 1);
    return true;
  }

  /** The fluid drawn for this frame: R the blob's reach (m), f how far it has flooded, at time t. */
  drawFluid(R, f, t, S) {
    this.water.build(R, t, S.wobble);
    // its water's clock and light (src/blade-shader.js: the sword's, spread): the breath, a blow's ring, a parry's flash
    const U = this.fluid.uniforms;
    U.uFluidA.value.z = t;
    U.uBlade.value.set(0, 1, t * BLADE_LOOK.breathRate, BLADE_QUALITY.lite ? 1 : 0);
    const age = (1 - S.flare) * SHIELD.flare;
    U.uBladeB.value.set(0, 0, S.flare > 0 ? age : 99, 0.3);
    U.uBladeC.value.x = S.flash > 0 ? BLADE_LOOK.ripple.parry : BLADE_LOOK.ripple.block;
    U.uBladeC.value.y = S.flash > 0 ? 0.6 : 0;
    U.uBladeC.value.z = 0.6 * S.flash;
    // a perfect parry: bright rings bursting off it
    const TAU = Math.PI * 2;
    for (let i = 0; i < this.bursts.length; i++) {
      const b = this.bursts[i];
      b.mesh.visible = S.flash > 0.02;
      if (!b.mesh.visible) continue;
      const scale = (i ? 0.78 : 1.04) + 0.5 * (1 - S.flash), w = 0.008 * S.flash;
      for (let j = 0; j < b.n; j++) {
        const th = (j / b.n) * TAU, r = R * scale * blobRadius(th, t + 1.5 + i, S.wobble), p = b.pts[j];
        p[0] = Math.cos(th) * r; p[1] = Math.sin(th) * r; p[2] = w;
      }
      b.build();
    }
  }

  /**
   * Per frame, after the pose (src/fluid-blade.js update): want (the guard held), worn (shown at
   * all), dir (flat, the guard's way), up, chest (the chest's middle). Returns what the state machine
   * said ('open' | 'close' | null).
   */
  update(dt, { want = false, worn = true, dir = null, up = null, chest = null, time = 0 } = {}) {
    const S = this.s, said = S.update(dt, want && worn);
    const on = worn && this.attach() && this.tool.player?.object?.visible !== false;
    this.root.visible = on;
    if (!on) return said;
    if (chest && dir && up && this.brace({ chest, dir, up })) this.wrapStrap();   // (the arm moved: the skin under it again)
    fitScale(this.root);
    const k = S.k;
    this.face.visible = k > 0.002;
    this.disc.visible = k < 0.5;   // (the folded hub opens into the face)
    this.arm.visible = false;
    if (this.face.visible) {
      this.root.updateWorldMatrix(true, false);
      this.root.matrixWorld.decompose(_a, _q, _b);
      // off the bracer on its knuckled arm, out as it opens
      const stand = THREE.MathUtils.lerp(SHIELD.folded, SHIELD.stand, smooth(k, 0, 0.6));
      this.face.position.set(0, 0, stand);
      this.arm.visible = k > 0.15;
      if (this.arm.visible) { this.rod.position.set(0, 0, 0.006); this.rod.quaternion.setFromUnitVectors(_Y, _Z); this.rod.scale.set(1, Math.max(0.001, stand - 0.012), 1); }
      // turned on its knuckle toward the guard's way, as much as it is open (folded it lies on the bracer)
      if (dir && up) {
        const z = _a.copy(dir).normalize(), x = _b.crossVectors(up, z).normalize(), y = _c.crossVectors(z, x);
        _q2.setFromRotationMatrix(_m.makeBasis(x, y, z));
        // (the knuckle turns it SHIELD.swivel at most off the forearm's outside: a strapped shield never faces back)
        const off = _d.copy(_Z).applyQuaternion(_q).angleTo(z);
        const turn = smooth(k, 0, 0.7) * Math.min(1, SHIELD.swivel / Math.max(off, 1e-6));
        this.face.quaternion.copy(_q).invert().multiply(_q.clone().slerp(_q2, turn));
      } else this.face.quaternion.identity();
      this.poseFace(time);
    } else this.reach = 0;
    // where it is, for the guard's arc (src/fluid-blade.js block) and the block's splash: its hub, its facing, its edge
    this.face.updateWorldMatrix(true, false);
    this.centre.setFromMatrixPosition(this.face.matrixWorld);
    this.normal.copy(_Z).transformDirection(this.face.matrixWorld);
    const n = this.outline.length;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2, r = this.reach * blobRadius(th, time, S.wobble);
      this.outline[i].set(Math.cos(th) * r, Math.sin(th) * r, 0).applyMatrix4(this.face.matrixWorld);
    }
    return said;
  }

  /** The face as open as the state says at `time`: the petals, the brass ring, the fluid and its cracks (update; the box's model). */
  poseFace(time) {
    const S = this.s, k = S.k, R = SHIELD.radius;
    // the petals spin out of the hub and spread round it, flat inside the brass ring closing round them
    const shake = S.crack > 0 ? S.crack * 0.08 * Math.sin(time * 70) : 0;
    for (let i = 0; i < this.ribs.length; i++) {
      const r = this.ribs[i], u = S.rib(i, this.ribs.length);
      r.pivot.rotation.z = THREE.MathUtils.lerp(-Math.PI * 0.5 + i * 0.08, r.home, u) + S.spin * 0.04 * (1 - u) + shake * (i % 2 ? 1 : -1);
      r.tilt.rotation.x = 0;
      const len = THREE.MathUtils.lerp(SHIELD.hub * 0.9, SHIELD.petal * 0.92, u);
      r.rib.scale.set(1, len, 1); r.tip.position.set(0, len, 0.004);
    }
    this.collar.visible = k > 0.5;
    this.collar.scale.setScalar(smooth(k, 0.5, 1));
    // the fluid floods out of the hub, swells with a blow
    const f = S.fill, shown = S.shown(time);
    this.reach = Math.max(0.01, R * f * (1 + 0.012 * Math.sin(time * 9) + 0.12 * S.flare));
    this.field.visible = f > 0.01 && shown;
    if (this.field.visible) this.drawFluid(this.reach, f, time, S);
    this.cracks.visible = S.crack > 0.02 && f > 0.3;
    this.cracks.scale.set(this.reach, this.reach, 1);
  }

  /**
   * The guard's arc round `chest` from the shield as drawn now, or null (not drawn, or not open enough to
   * tell): its reach either side measured off the drawn edge (open, never less than SHIELD.radius's share
   * as it floods: the guard is up from half open).
   */
  arc(chest, up) {
    if (!this.root.visible || !this.root.parent || this.s.k < 0.3) return null;
    const n = _a.copy(this.normal).addScaledVector(up, -this.normal.dot(up));
    if (n.lengthSq() < 1e-8) return shieldArc(chest, this.centre, this.normal, SHIELD.radius, up);
    n.normalize();
    const side = _b.crossVectors(up, n).normalize();
    let plus = 0, minus = 0;
    for (const p of this.outline) { const s = _c.subVectors(p, this.centre).dot(side); plus = Math.max(plus, s); minus = Math.max(minus, -s); }
    // (opening, the guard is up before the fluid is all out: it covers at least what a disc of its size would)
    const least = SHIELD.radius * 0.9;
    return shieldArc(chest, this.centre, this.normal, { plus: Math.max(plus, least), minus: Math.max(minus, least) }, up);
  }

  dispose() { this.root.removeFromParent(); }
}

/**
 * The guard as an object (the box's hovering item, the menu's picture: src/boxes/model.js, issues #242, #284): the
 * held device's own face (ShieldDevice: the brass petals and the riveted ring, the disc of living fluid with its
 * bright rim), open, in a shield material of its own (`key`: the box winds its clock). Unscaled (about 0.75 m across,
 * the blob's reach); `userData.tick(time)` keeps its fluid flowing.
 */
export function buildShieldFace(key = 'box.item.shield') {
  const d = new ShieldDevice({}, { key });
  d.s.k = 1; d.s.state = 'open';
  const face = d.face;
  face.removeFromParent();
  face.position.set(0, 0, 0); face.quaternion.identity();
  face.traverse((o) => { o.frustumCulled = false; o.userData.noCollide = true; });
  face.userData.tick = (time) => d.poseFace(time);
  d.poseFace(0.8);
  return face;
}
