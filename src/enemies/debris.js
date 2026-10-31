import * as THREE from 'three';

// Pieces that follow physics (issues #753, #754; docs/systems/foes.md, "Pieces and plates"): what a defeat breaks a foe
// into (a machine's parts, a crawler's ceramic as it blows itself up) and the armour plates a blow knocks off fly as small
// rigid bodies: a box each (its own shape's bounds), thrown with the blast's or the blow's speed and a spin, falling under
// gravity, and landing on the ground under it (the world's height, its slope from two more reads): an impulse at the
// corner that hits (restitution, Coulomb friction, the box's own inertia), so a piece bounces, tumbles over onto a face,
// slides and comes to rest flat on the slope it fell on, then lies and fades. One integrator for both (Foes.updateDebris,
// Foes.updatePlates), deterministic (no clock, no Math.random: the caller gives the throw), cheap (three ground reads each
// time a piece has gone `reread` m across, none while it rocks or lies; a cap on how many fly at once).

export const DEBRIS = {
  gravity: 14,        // m/s² (the foes' falls: a little more than 9.8, the game's weight)
  sub: 1 / 120,       // the longest sub-step (s)
  bounce: 0.38,       // restitution of a hard landing...
  soft: 1.2,          // ...none below this closing speed (m/s): it settles instead of buzzing
  friction: 0.55,     // Coulomb's μ against the ground (holds a box on a slope to ~29°)
  drag: 0.12,         // air drag (1/s)
  spinDrag: 0.25,     // the spin's own drag in the air (1/s)
  rest: 2.5,          // touching the ground: what is left of the spin and the slide dies away at this rate (1/s), so it rocks to a stop
  sleepV: 0.12,       // slower than this (m/s)...
  sleepW: 0.5,        // ...and turning slower than this (rad/s)...
  sleepFor: 0.25,     // ...this long (s), touching the ground: asleep (no more reads)
  probe: 0.18,        // m either side for the ground's slope
  reread: 0.25,       // m across from where it last read the ground before it reads it again
  max: 48,            // pieces flying at once (the oldest put to sleep where it is past this)
};

// What each archetype's body is made of (issue #773, the author: "Only mechanical and rock enemies should split into
// chunks when dying. Not organic enemies"): a machine's or a stone body's parts fly apart when it is done (Foes.burst,
// breakApart); a body of flesh, a plant, a shell grown on a creature or a spirit never breaks apart: it goes down its own
// way (src/enemies/defeat.js DEFEATS) and lies, then goes up in its puff. Every archetype is here
// (tests/foe-debris.test.js). An old kind or a guardian with no archetype keeps its own `breaks` (src/foes.js FOES).
export const MATTER = {
  // machines: the makers' droids and engines
  tripod: 'machine', cart: 'machine', bell: 'machine', drone: 'machine', brute: 'machine', woodcutter: 'machine', fencer: 'machine',
  sentinel: 'machine', oracle: 'machine', crawler: 'machine',
  // creatures: flesh, chitin, shell and hide
  crab: 'flesh', skitter: 'flesh', centipede: 'flesh', toad: 'flesh', lizard: 'flesh', heron: 'flesh', roller: 'flesh',
  jelly: 'flesh', moth: 'flesh', ray: 'flesh', worm: 'flesh', grunt: 'flesh', hulk: 'flesh', prowler: 'flesh', warlord: 'flesh',
  rootknot: 'plant',
  // spirits: ink, smoke, cloth and ember, and the junk the mummers wear
  blot: 'spirit', shade: 'spirit', hound: 'spirit', marionette: 'spirit', wisp: 'spirit', mummer: 'spirit', dunemummer: 'spirit', mummerking: 'spirit',
};
/** The kinds of matter that break into pieces (a stone body: none of the archetypes yet). */
export const BREAKS = new Set(['machine', 'stone']);
/** Whether a foe breaks into pieces when it is done: by its archetype's matter, else its own `breaks`; blown up, always. */
export const breaksApart = (f) => !!f.blast || (MATTER[f.archetype] ? BREAKS.has(MATTER[f.archetype]) : !!f.def?.breaks);

const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3(), _c = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m3 = new THREE.Matrix3(), _q = new THREE.Quaternion(), _w = new THREE.Vector3();
const _box = new THREE.Box3(), _bb = new THREE.Box3(), _mw = new THREE.Matrix4(), _mm = new THREE.Matrix4(), _td = new THREE.Vector3();

// (a skinned body's parts, per geometry and bone: the box of the points that bone moves most, in the bone's own frame at
// the bind, worked out once: the droids' and the monsters' joints are one skinned mesh, src/enemies/plans/kit.js skinBy)
const BONE_BOXES = new WeakMap();
function boneBox(mesh, b) {
  const g = mesh.geometry;
  let per = BONE_BOXES.get(g);
  if (!per) {
    per = new Map();
    const P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, inv = mesh.skeleton.boneInverses;
    const m = new THREE.Matrix4(), v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      let bi = SI.getX(i), w = SW.getX(i);
      for (let k = 1; k < 4; k++) { const wk = SW.getComponent(i, k); if (wk > w) { w = wk; bi = SI.getComponent(i, k); } }
      let box = per.get(bi);
      if (!box) { box = new THREE.Box3(); per.set(bi, box); }
      v.fromBufferAttribute(P, i).applyMatrix4(mesh.bindMatrix).applyMatrix4(m.copy(inv[bi]));
      box.expandByPoint(v);
    }
    BONE_BOXES.set(g, per);
  }
  return per.get(b) ?? null;
}

/**
 * A piece's box: the half extents (world metres) and the centre (in the object's own frame) of what is drawn of it: its
 * meshes (in its frame), and the points a skinned mesh of its model binds to it as a bone, or to any of `bones` (`skinned`:
 * the model's skinned meshes, gathered before its parts were taken off it). From the geometry's bounds: a plate's thin slab, a shell's dome.
 */
export function boxOf(o, skinned = [], bones = [o]) {
  _box.makeEmpty();
  o.updateWorldMatrix(true, true);
  _mw.copy(o.matrixWorld).invert();
  o.traverse((m) => {
    if (!m.isMesh || m.isSkinnedMesh || !m.geometry) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    _box.union(_bb.copy(m.geometry.boundingBox).applyMatrix4(_mm.multiplyMatrices(_mw, m.matrixWorld)));
  });
  for (const S of skinned) for (const bone of bones) {
    const b = S.skeleton?.bones.indexOf(bone) ?? -1;
    if (b < 0) continue;
    const bb = boneBox(S, b);
    if (bb && !bb.isEmpty()) _box.union(_bb.copy(bb).applyMatrix4(_mm.multiplyMatrices(_mw, bone.matrixWorld)));
  }
  if (_box.isEmpty()) _box.set(_a.set(-0.05, -0.05, -0.05), _b.set(0.05, 0.05, 0.05));
  const s = o.getWorldScale(_a);
  const half = _box.getSize(new THREE.Vector3()).multiplyScalar(0.5).multiply(s);
  // (a sliver of nothing would spin forever: at least 1.5 cm each way)
  half.set(Math.max(half.x, 0.015), Math.max(half.y, 0.015), Math.max(half.z, 0.015));
  return { half, centre: _box.getCenter(new THREE.Vector3()) };
}

/**
 * A rigid piece: its centre of mass `pos` (world), `vel`, its turn `q` and spin `w` (world rad/s), a box of half extents
 * `half` about the centre. Mass 1 (only the ratios matter: the ground does not move); the box's inertia.
 */
export class Piece {
  constructor({ pos, q, half, vel, spin }) {
    this.pos = pos.clone(); this.q = q.clone(); this.vel = vel.clone(); this.w = spin.clone();
    this.half = half.clone();
    const { x, y, z } = this.half, k = 1 / 3;   // (a solid box: I = m/3 (b² + c²) with half extents)
    this.Ib = new THREE.Vector3(k * (y * y + z * z), k * (x * x + z * z), k * (x * x + y * y));
    this.asleep = false; this.still = 0; this.touching = false; this.hits = 0; this.t = 0;
    this.lastHit = 0;   // the closing speed of the last hard landing (m/s), for a clatter
  }

  /** The world-space inverse inertia applied to v (I⁻¹ v), into out. */
  invI(v, out) {
    const qi = _q.copy(this.q).invert();
    out.copy(v).applyQuaternion(qi);
    out.set(out.x / this.Ib.x, out.y / this.Ib.y, out.z / this.Ib.z);
    return out.applyQuaternion(this.q);
  }

  /** The speed of the point at offset r (from the centre, world) into out. */
  pointVel(r, out) { return out.crossVectors(this.w, r).add(this.vel); }

  /** One impulse j along d at offset r. */
  push(r, d, j) {
    this.vel.addScaledVector(d, j);
    this.w.add(this.invI(_a.crossVectors(r, d), _b).multiplyScalar(j));
  }

  /** The effective inverse mass along d at offset r: 1 + d · ((I⁻¹ (r × d)) × r). */
  kOf(r, d) { return 1 + d.dot(_c.crossVectors(this.invI(_a.crossVectors(r, d), _b), r)); }
}

/**
 * The ground under (x, z) read from about y: its height and its normal (facing up) into n, from three reads of
 * ground(x, y, z) (a height or null). Returns the height, or -Infinity with nothing under it.
 */
export function groundPlane(ground, x, y, z, n, D = DEBRIS) {
  const h = ground(x, y, z);
  if (h == null || !Number.isFinite(h)) { n.set(0, 1, 0); return -Infinity; }
  const hx = ground(x + D.probe, y, z), hz = ground(x, y, z + D.probe);
  const dx = Number.isFinite(hx) && Math.abs(hx - h) < D.probe * 1.8 ? (hx - h) / D.probe : 0;
  const dz = Number.isFinite(hz) && Math.abs(hz - h) < D.probe * 1.8 ? (hz - h) / D.probe : 0;
  n.set(-dx, 1, -dz).normalize();
  return h;
}

const RS = Array.from({ length: 8 }, () => new THREE.Vector3()), HIT = new Int8Array(8);
const CORNERS = [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]];

/**
 * One frame of a piece (sub-stepped): gravity and drag, then the ground's plane under it (read once a frame, while it is
 * within reach of it), each corner below it pushed out along the normal and given an impulse: restitution above
 * `soft` m/s, friction up to μ of the normal impulse; touching, its slide and spin rock to a stop; asleep once still.
 * `ground(x, y, z)`: the ground's height under (x, z) read from about y (a function of the world). Returns the piece.
 */
export function stepPiece(P, dt, ground, D = DEBRIS) {
  if (P.asleep || !(dt > 0)) { P.t += dt; return P; }
  P.t += dt;
  dt = Math.min(dt, 1 / 20);   // (a hitch: no stride long enough to pass through the ground)
  const n = Math.min(8, Math.ceil(dt / D.sub)), h = dt / n;
  const reach = Math.hypot(P.half.x, P.half.y, P.half.z);
  // (the ground under it, from above its top: read again once it has gone `reread` m across from where it was read, or
  // dropped past it; a piece lying or rocking reads nothing)
  const G = (P.plane ??= { h: 0, n: new THREE.Vector3(0, 1, 0), x: Infinity, z: Infinity, y: -Infinity, ok: false });
  if (Math.hypot(P.pos.x - G.x, P.pos.z - G.z) > D.reread || P.pos.y < G.y - 1) {
    G.h = groundPlane(ground, P.pos.x, P.pos.y + reach + 0.5, P.pos.z, G.n, D); G.x = P.pos.x; G.z = P.pos.z; G.y = P.pos.y; G.ok = Number.isFinite(G.h);
    P.reads = (P.reads ?? 0) + 1;
  }
  let touched = false, hardest = 0;
  for (let s = 0; s < n; s++) {
    P.vel.y -= D.gravity * h;
    P.vel.multiplyScalar(Math.exp(-D.drag * h));
    P.w.multiplyScalar(Math.exp(-D.spinDrag * h));
    P.pos.addScaledVector(P.vel, h);
    // the turn: q += ½ ω q h
    const wl = P.w.length();
    if (wl > 1e-6) { _q.setFromAxisAngle(_w.copy(P.w).divideScalar(wl), wl * h); P.q.premultiply(_q).normalize(); }
    if (!G.ok) continue;
    // the plane through the ground point under it now (the frame's slope)
    const gy = G.h + (-(G.n.x / G.n.y)) * (P.pos.x - G.x) + (-(G.n.z / G.n.y)) * (P.pos.z - G.z);
    const base = _t.set(P.pos.x, gy, P.pos.z);
    if ((P.pos.y - gy) * G.n.y > reach + 0.02) continue;
    // its corners in the plane's reach: out of the ground by the deepest, then impulses at each touching corner, a few
    // rounds (sequential impulses: a face lying on the ground holds on its four corners without rocking)
    let deep = 0, nc = 0;
    for (let i = 0; i < 8; i++) {
      const C = CORNERS[i], r = RS[i].set(C[0] * P.half.x, C[1] * P.half.y, C[2] * P.half.z).applyQuaternion(P.q);
      const d = _v.copy(P.pos).add(r).sub(base).dot(G.n);
      if (d < 0.004) { HIT[nc++] = i; deep = Math.min(deep, d); }
    }
    if (!nc) continue;
    touched = true;
    P.pos.addScaledVector(G.n, -deep);   // (out of the ground)
    for (let it = 0; it < 4; it++) {
      for (let c = 0; c < nc; c++) {
        const r = RS[HIT[c]];
        const vn = P.pointVel(r, _v).dot(G.n);
        if (vn >= 0) continue;
        if (it === 0) hardest = Math.max(hardest, -vn);
        const e = it === 0 && -vn > D.soft ? D.bounce : 0;
        const jn = (-(1 + e) * vn) / P.kOf(r, G.n);
        P.push(r, G.n, jn);
        // friction: against the slide at that corner, at most μ·jn
        const vc2 = P.pointVel(r, _v), vt = _a.copy(vc2).addScaledVector(G.n, -vc2.dot(G.n)), st = vt.length();
        if (st > 1e-5) {
          const tdir = _td.copy(vt).divideScalar(st);
          const jt = Math.min(st / P.kOf(r, tdir), D.friction * jn);
          P.push(r, tdir, -jt);
        }
      }
    }
  }
  if (touched) {
    // (on the ground: what is left of its slide and spin rocks to a stop)
    const k = Math.exp(-D.rest * dt);
    P.w.multiplyScalar(k);
    const vn = P.vel.dot(G.n);
    _a.copy(P.vel).addScaledVector(G.n, -vn).multiplyScalar(k);
    P.vel.copy(_a).addScaledVector(G.n, vn);
    if (hardest > D.soft) { P.hits++; P.lastHit = hardest; }
  }
  P.touching = touched;
  const slow = P.vel.length() < D.sleepV && P.w.length() < D.sleepW;
  P.still = touched && slow ? P.still + dt : 0;
  if (P.still >= D.sleepFor) { P.asleep = true; P.vel.set(0, 0, 0); P.w.set(0, 0, 0); }
  return P;
}

/**
 * Lay a piece's state on its object: the object's origin is `centre` (its own frame) away from the centre of mass.
 * `parent` is the object's parent (its frame: the Foes' group, normally the world's).
 */
export function placePiece(P, o, centre) {
  o.quaternion.copy(P.q);
  o.position.copy(_a.copy(centre).multiply(o.scale).applyQuaternion(P.q).negate().add(P.pos));
  return o;
}

/**
 * The throw of a piece blown off a body (a blast at `from`, a blow along `dir`): out from the blast through the piece's
 * centre at `speed` (± `spread` of it), up by `up`, along the blow by `blow`, a spin of up to `spin` rad/s; `rng()` 0..1.
 */
export function throwFrom(at, from, { dir = null, speed = 4, spread = 0.35, up = 3, blow = 0, spin = 8, rng = Math.random } = {}) {
  const out = _v.subVectors(at, from); out.y = Math.max(0, out.y) * 0.5;
  if (out.lengthSq() < 1e-6) out.set(rng() - 0.5, 0, rng() - 0.5);
  out.normalize();
  const k = speed * (1 - spread + 2 * spread * rng());
  const vel = new THREE.Vector3().copy(out).multiplyScalar(k).add(new THREE.Vector3(0, up * (0.7 + 0.6 * rng()), 0));
  if (dir && blow) vel.addScaledVector(_a.set(dir.x, 0, dir.z).normalize(), blow);
  const r = () => (rng() * 2 - 1) * spin;
  return { vel, spin: new THREE.Vector3(r(), r(), r()) };
}
