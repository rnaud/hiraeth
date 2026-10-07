import * as THREE from 'three';
import { makeMaterial } from './materials.js';

// A real cloth cape: a grid of particles hanging from the collar, integrated
// with Verlet in world space and kept in shape by distance constraints
// (structural, shear and bend). Gravity follows the character's "up", air
// drag against the character's motion makes it stream out behind when
// running, and it collides with capsules on the body and legs so the legs
// push it around as they swing, plus the ground under the feet. Seated, the ground is the seat
// and what lies round it (groundField: the bench top, its edges, the ground beyond), and the cloth
// gives up its bends so it folds down the back and over the edge instead of standing out.
//
// Far from the camera nobody simulates cloth, but a cape mustn't be left
// hanging in the air where it last was (or mid-swing): it *hangs* instead, its
// drape (the cloth at rest on that body, in the collar's own space) carried by
// the body like any other piece of costume, at no cost a frame. The drape is
// baked once by letting the cloth settle on the body (one bake at a time,
// shared between capes of the same cut on the same kind of body), and kept
// fresh from the simulation whenever the wearer stands still and the cloth
// has come to rest. The simulation starts from it again when you come close,
// so the cloth doesn't drop into place in front of you.

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3();
const _mi = new THREE.Matrix4(), _mc = new THREE.Matrix4(), _lag = new THREE.Vector3(), ZERO = new THREE.Vector3();
const KS = 10;   // numbers per collider (Cape.capsulesAt)
/**
 * The simulation's time steps for a carried cape (Cape.update s.carry: one updated every 2nd or 3rd
 * frame): steps at most hMax long, at most maxSteps of them, over at most maxDt (a longer hitch is
 * lived as maxDt). Uncarried (near, every frame), an update is three steps of at most 1/30 s.
 * lag (1/s): carried, how much the cloth is held back by its wearer's walk, as the near cloth is.
 */
export const CLOTH = { hMax: 1 / 30, maxSteps: 6, maxDt: 1 / 10, lag: 1 };
const DRAPES = new Map();          // drape key → Float32Array (anchor space), shared
const BAKE_GAP_MS = 12;            // at most one bake every ~frame
let lastBake = -1e9;
// a bake: the cloth's own steps, heavily damped so it comes to rest in a few (within ~2 cm of
// letting it fall for seconds), the colliders once a step: ~1 ms
const BAKE = { steps: 3, damp: 0.6, iters: 5, n: 7 };
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
/** Tests: forget the shared drapes and the bake budget. */
export function resetDrapes() { DRAPES.clear(); lastBake = -1e9; }

// what a seated cape falls onto: the seat's top under the hips, its edges, the ground beyond
const FIELD = { half: 0.96, step: 0.12, probe: 0.2, drop: 2.5, edge: 0.1 };
/**
 * Seated cloth (Cape: the people sitting on a bench, a stone, a crate, a kerb). `seat`: the seat itself,
 * round the hips in the body's frame (m: half its width, its front edge ahead of the hips, its back
 * behind them), always under the cloth even where the physics doesn't see it (a stool, a crate, a
 * stone drawn but not solid: the cloth fell through it to the ground). `bend`, `fold`: seated, the
 * bends only keep the cloth from creasing back on itself, pushing two points two rows (or columns)
 * apart when they come closer than `fold` of their rest, with that stiffness (with no bends it
 * crumpled into folded shards where it met the seat and the ground; with the standing bends, or any
 * bends holding it straight, it stood out from the back, over the bench and off a ledge in stiff
 * sheets). `hem`: the seated cut's hem, a share of the standing one's. `bake`, `bakeDamp`: a seated drape's
 * settling updates and their damping (BAKE's, standing: the cloth came only ~40 cm down from its
 * cone, and the drape far off kept it in sheets standing out round the sitter).
 */
export const SEATED = { seat: { half: 0.26, front: 0.12, back: 0.3 }, bend: 1, fold: 0.6, hem: 0.45, bake: 24, bakeDamp: 0.92 };

/**
 * The ground round a seated body: heights on a small grid (±0.96 m, 12 cm) in the body's frame, so
 * the cloth rests on the bench beside and behind the hips and falls over its edges to the ground
 * (a flat floor at the seat's height laid the cape out round them like a sheet). Probed once from
 * just above the seat (`groundAt(x, fromY, z, maxDrop)`, as Physics.groundAt); `at` is the hips
 * over the seat, `heading` the way they face. World up is +y. `sig` names its shape (to 5 cm), for
 * sharing a drape between people on the same kind of seat. `seat` (SEATED.seat): the seat round the
 * hips is there whatever the probes find.
 */
export function groundField(groundAt, at, heading, seat = null) {
  const { half, step, probe, drop } = FIELD, n = Math.round((half * 2) / step) + 1;
  const fx = Math.sin(heading), fz = Math.cos(heading), rx = fz, rz = -fx;
  const h = new Float32Array(n * n), top = at.y + probe;
  let sig = '';
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const u = -half + i * step, v = -half + j * step;
      const g = groundAt(at.x + rx * u + fx * v, top, at.z + rz * u + fz * v, probe + drop);
      let y = Number.isFinite(g) ? Math.max(g - at.y, -drop) : -drop;
      // the seat under the hips, seen or not (to the cell's middle)
      if (seat && Math.abs(u) <= seat.half && v <= seat.front && v >= -seat.back) y = Math.max(y, -0.02);
      h[j * n + i] = y;
      sig += String.fromCharCode(48 + Math.max(0, Math.min(60, Math.round(-y / 0.05))));
    }
  return { ox: at.x, oy: at.y, oz: at.z, fx, fz, rx, rz, n, half, step, h, sig };
}

/**
 * A groundAt (as Physics.groundAt: x, fromY, z, maxDrop -> the highest surface under fromY, or
 * -Infinity) over a soup of drawn triangles (9 numbers each, world space): what a seat the physics
 * doesn't see is made of (NPC.seatField). Faces of any facing count (a crate's top, a stone's).
 */
export function trianglesGround(tris) {
  const n = (tris.length / 9) | 0, bb = new Float32Array(n * 4);
  for (let t = 0; t < n; t++) {
    const o = t * 9;
    bb[t * 4] = Math.min(tris[o], tris[o + 3], tris[o + 6]); bb[t * 4 + 1] = Math.max(tris[o], tris[o + 3], tris[o + 6]);
    bb[t * 4 + 2] = Math.min(tris[o + 2], tris[o + 5], tris[o + 8]); bb[t * 4 + 3] = Math.max(tris[o + 2], tris[o + 5], tris[o + 8]);
  }
  return (x, fromY, z, maxDrop = Infinity) => {
    let best = -Infinity;
    for (let t = 0; t < n; t++) {
      if (x < bb[t * 4] || x > bb[t * 4 + 1] || z < bb[t * 4 + 2] || z > bb[t * 4 + 3]) continue;
      const o = t * 9, ax = tris[o], az = tris[o + 2], bx = tris[o + 3] - ax, bz = tris[o + 5] - az, cx = tris[o + 6] - ax, cz = tris[o + 8] - az;
      const det = bx * cz - cx * bz;
      if (Math.abs(det) < 1e-9) continue;   // (a wall seen edge-on from above)
      const px = x - ax, pz = z - az, u = (px * cz - cx * pz) / det, v = (bx * pz - px * bz) / det;
      if (u < 0 || v < 0 || u + v > 1) continue;
      const y = tris[o + 1] + u * (tris[o + 4] - tris[o + 1]) + v * (tris[o + 7] - tris[o + 1]);
      if (y <= fromY && y >= fromY - maxDrop && y > best) best = y;
    }
    return best;
  };
}

/**
 * A cloth point against a groundField (P: positions, Q: previous positions, i its index). On
 * smooth ground it rests on the heights between the grid points; at a step (the seat's edge) the
 * grid is a set of columns, and a point inside one well under its top is beside it, not under it:
 * it goes out through the nearest side to a lower column (pushed up onto the seat instead, cloth
 * hanging down the side of a bench climbed up onto it).
 */
function onField(F, P, Q, i) {
  const n = F.n, H = F.h, lift = 0.03;
  const x = P[i], y = P[i + 1] - F.oy, z = P[i + 2], dx = x - F.ox, dz = z - F.oz;
  let u = (dx * F.rx + dz * F.rz + F.half) / F.step, v = (dx * F.fx + dz * F.fz + F.half) / F.step;
  u = u < 0 ? 0 : u > n - 1 ? n - 1 : u; v = v < 0 ? 0 : v > n - 1 ? n - 1 : v;
  const i0 = Math.min(u | 0, n - 2), j0 = Math.min(v | 0, n - 2), tu = u - i0, tv = v - j0;
  const a = H[j0 * n + i0], b = H[j0 * n + i0 + 1], c = H[(j0 + 1) * n + i0], d = H[(j0 + 1) * n + i0 + 1];
  let g;
  if (Math.max(a, b, c, d) - Math.min(a, b, c, d) < FIELD.edge) g = (a * (1 - tu) + b * tu) * (1 - tv) + (c * (1 - tu) + d * tu) * tv;
  else {
    const ci = Math.round(u), cj = Math.round(v);
    g = H[cj * n + ci];
    if (g - y > FIELD.edge) {
      // beside a step: out through the nearest side of this column to a lower one
      let best = Infinity, du = 0, dv = 0;
      for (let k = 0; k < 4; k++) {
        const su = k === 0 ? -1 : k === 1 ? 1 : 0, sv = k === 2 ? -1 : k === 3 ? 1 : 0, ni = ci + su, nj = cj + sv;
        if (ni < 0 || nj < 0 || ni >= n || nj >= n || H[nj * n + ni] > y) continue;
        const dist = su ? 0.5 - (u - ci) * su : 0.5 - (v - cj) * sv;
        if (dist < best) { best = dist; du = su * (dist + 0.02); dv = sv * (dist + 0.02); }
      }
      if (best < Infinity) {
        // (and its last place with it: pushed out without, it flew out sideways, the cloth standing out round the seat in sheets)
        const ox = (du * F.rx + dv * F.fx) * F.step, oz = (du * F.rz + dv * F.fz) * F.step;
        P[i] += ox; P[i + 2] += oz; Q[i] += ox; Q[i + 2] += oz;
        return;
      }
    }
  }
  if (y - g < lift) { P[i + 1] = Q[i + 1] = F.oy + g + lift; }   // (and no bounce)
}

export class Cape {
  /**
   * @param anchor  Object3D the cape is pinned to (the torso)
   * @param o.top / o.bottom  radius at the collar / hem, o.length, o.y (collar height in anchor space)
   * @param o.gap   half-angle of the opening at the front
   */
  constructor(scene, anchor, { cols = 14, rows = 11, top = 0.19, bottom = 0.5, length = 1.5, y = 0.74, gap = 0.42, color = '#c8483a', color2 = null, heavy = true, bells = 0, bellColor = BELLS.color } = {}) {
    this.anchor = anchor;
    this.scene = scene;
    this.cut = [cols, rows, top, bottom, length, y, gap, heavy].map((v) => (typeof v === 'number' ? v.toFixed(3) : v)).join('/');
    this.drape = null;      // the cloth at rest on the body, in anchor space (see bake())
    this.hung = false;      // shown as the drape, carried by the anchor (not simulated)
    // heavy wool: falls in long vertical folds, swings slowly, barely flutters
    this.damp = heavy ? 0.95 : 0.985;
    this.gravity = heavy ? 18 : 9.8;
    this.drag = heavy ? 0.2 : 0.42;
    this.flutter = heavy ? 0.04 : 0.35;
    this.windScale = heavy ? 0.3 : 1;   // the ambient wind barely lifts it; your own motion still does
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows;
    this.p = new Float32Array(n * 3);      // positions
    this.q = new Float32Array(n * 3);      // previous positions
    this.local = new Float32Array(n * 3);  // rest shape in anchor space
    // seated, its cut gathered in: the hem narrower (SEATED.hem), so it hangs down the back and pools
    // behind the seat (its whole width spread out over a long bench beside the sitter in sheets)
    this.localSeat = new Float32Array(n * 3);
    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1);
      const rad = top + (bottom - top) * Math.pow(t, 0.8), radS = top + (Math.max(top, bottom * SEATED.hem) - top) * Math.pow(t, 0.8);
      for (let c = 0; c < cols; c++) {
        const ang = gap + (c / (cols - 1)) * (Math.PI * 2 - gap * 2);   // 0 = front
        const i = (r * cols + c) * 3;
        this.local[i] = Math.sin(ang) * rad;
        this.local[i + 1] = y - t * length;
        this.local[i + 2] = Math.cos(ang) * rad;
        this.localSeat[i] = Math.sin(ang) * radS; this.localSeat[i + 1] = y - t * length; this.localSeat[i + 2] = Math.cos(ang) * radS;
      }
    }
    // constraints: [i, j, rest, stiffness]; seated: their stiffness and rest length on the seated cut
    const cons = [], seated = [], seatRest = [];
    const add = (r0, c0, r1, c1, k, bend = false) => {
      if (r1 >= rows || c1 >= cols || c1 < 0) return;
      const i = r0 * cols + c0, j = r1 * cols + c1;
      const L = this.local, S = this.localSeat;
      cons.push(i, j, Math.hypot(L[i * 3] - L[j * 3], L[i * 3 + 1] - L[j * 3 + 1], L[i * 3 + 2] - L[j * 3 + 2]), k);
      seated.push(bend ? -SEATED.bend : k);   // (negative: one-sided, see update)
      seatRest.push(Math.hypot(S[i * 3] - S[j * 3], S[i * 3 + 1] - S[j * 3 + 1], S[i * 3 + 2] - S[j * 3 + 2]));
    };
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        add(r, c, r, c + 1, 1);            // around
        add(r, c, r + 1, c, 1);            // down
        add(r, c, r + 1, c + 1, 0.5);      // shear
        add(r, c, r + 1, c - 1, 0.5);
        add(r, c, r + 2, c, heavy ? 0.55 : 0.25, true);   // bend: stiff downward, so folds stay long
        add(r, c, r, c + 2, 0.15, true);
      }
    this.cons = new Float32Array(cons);
    // seated, the cloth has to fold where it meets the seat and the ground: soft bends (stiff
    // downward, a seated cape stood out from the body like a plank, or heaped up on the seat; with
    // none it crumpled into folded shards: SEATED.bend)
    this.seatedK = new Float32Array(seated);
    this.seatRest = new Float32Array(seatRest);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    const fold = new Float32Array(n * 2);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { fold[(r * cols + c) * 2] = c / (cols - 1); fold[(r * cols + c) * 2 + 1] = r / (rows - 1); }
    geo.setAttribute('aFold', new THREE.BufferAttribute(fold, 2));
    const idx = [];
    for (let r = 0; r < rows - 1; r++)
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    geo.setIndex(idx);
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, makeMaterial({ color, color2: color2 ?? color, side: THREE.DoubleSide, folds: cols * 0.9 }));
    this.mesh.frustumCulled = false;
    this.mesh.userData.noCollide = true;
    this.mesh.userData.cape = true;   // (not a seat for anyone's cloth: NPC.seatField)
    scene.add(this.mesh);
    this.bells = bells > 0 ? hemBells(this, bells, bellColor) : null;
    this.ready = false;
    this.capsules = [];
    this.time = 0;
  }

  /** Start the cloth over: on its drape if it has one (already settled), else the cut's cone (seated: its gathered cut). */
  reset(seated = false) {
    this.unhang();
    this.anchor.updateWorldMatrix(true, false);
    const m = this.anchor.matrixWorld;
    const src = this.drape ?? (seated ? this.localSeat : this.local);
    for (let i = 0; i < this.p.length; i += 3) {
      _a.set(src[i], src[i + 1], src[i + 2]).applyMatrix4(m);
      this.p[i] = this.q[i] = _a.x; this.p[i + 1] = this.q[i + 1] = _a.y; this.p[i + 2] = this.q[i + 2] = _a.z;
    }
    this.ready = true;
  }

  /**
   * @param s.up     world up (against gravity)
   * @param s.vel    character velocity (world), for air drag
   * @param s.wind   ambient wind (world)
   * @param s.floor  world point on the ground under the character
   * @param s.capsules [{a, b, r}] body capsules in world space ({a, b, r, rb}: a cone, r at a to rb at b, open-ended)
   * @param s.carry  0..1: the cloth carried along with the anchor since the last update (an update
   *                 every 2nd or 3rd frame: follow() between), its own sway simulated on top
   * @param s.spread 0..1 open like wings (gliding), s.lift 0..1 updraft (jetpack)
   */
  update(dt, s) {
    if (this.hung) this.unhang();   // (and starts again from the drape: reset())
    this._ease = 0;
    this.unfollow();
    this.anchor.updateWorldMatrix(true, false);
    const m = this.anchor.matrixWorld;
    _a.set(this.local[0], this.local[1], this.local[2]).applyMatrix4(m);
    const fresh = !this.ready || Math.hypot(_a.x - this.p[0], _a.y - this.p[1], _a.z - this.p[2]) > 3;
    if (fresh) this.reset(!!s.field);
    this.time += dt;
    // more substeps when the body moves fast, so limbs can't tunnel through the cloth
    const fast = Math.hypot(s.vel.x, s.vel.y, s.vel.z);
    const { cols, rows } = this;
    const up = s.up;
    // relative air: ambient wind minus our own motion, plus an updraft for the jetpack
    const air = _d.copy(s.wind).multiplyScalar(this.windScale).sub(s.vel).addScaledVector(up, (s.lift ?? 0) * 9);
    const right = _r.set(1, 0, 0).transformDirection(m);
    // where the collar and the colliders were at the last update: each step pins and collides
    // with them on their way from there to here (all at the end of the update, they jumped a
    // frame or three at once, and a leg swinging 20 cm went through the cloth instead of pushing it)
    const carry = !fresh && !s.quiet && this._mPrev ? (s.carry ?? 0) : 0;
    // (a bake only needs where the cloth comes to rest: see BAKE). Carried, a cape simulated every
    // 2nd or 3rd frame (further off, or on a 30 fps handheld) lives all the time since its last
    // update (steps of at most CLOTH.hMax), not 1/30 s of it: in slow motion while the body walked
    // on at full speed, the cloth flew out behind and the legs passed through it
    const span = Math.min(dt, carry > 0 ? CLOTH.maxDt : 1 / 30);
    const steps = s.quiet ? BAKE.steps : Math.max(fast > 6 ? 5 : 3, Math.min(CLOTH.maxSteps, Math.ceil(span / CLOTH.hMax - 1e-6))), h = span / steps;
    // damping per step; carried, the same per second whatever the step (as tuned, at 1/180 s steps:
    // the near cloth's damping slows it against the world, which held a cloth of longer steps back)
    const damp = s.quiet ? (s.field ? SEATED.bakeDamp : BAKE.damp) : carry > 0 ? Math.pow(this.damp, h * 180) : this.damp;
    const caps = s.capsules, nc = caps.length;
    if (!this._mPrev) this._mPrev = new THREE.Matrix4().copy(m);
    if (fresh || s.quiet) this._mPrev.copy(m);
    if (carry > 0) {
      // the cloth carried along with the body since the last update (s.carry: further off, the
      // body's own motion isn't simulated through the cloth, only the cloth's sway on it)
      _mc.multiplyMatrices(m, _mi.copy(this._mPrev).invert());
      const P = this.p, Q = this.q;
      for (let i = 0; i < P.length; i += 3) {
        _a.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(_mc); _b.set(Q[i], Q[i + 1], Q[i + 2]).applyMatrix4(_mc);
        P[i] += (_a.x - P[i]) * carry; P[i + 1] += (_a.y - P[i + 1]) * carry; P[i + 2] += (_a.z - P[i + 2]) * carry;
        Q[i] += (_b.x - Q[i]) * carry; Q[i + 1] += (_b.y - Q[i + 1]) * carry; Q[i + 2] += (_b.z - Q[i + 2]) * carry;
      }
      // (the air: as the tuned near cloth felt it, whose particles move with the body too)
      air.addScaledVector(s.vel, -carry);
    }
    // carried, the pull back the near cloth's damping gives it (that damping slows it against the
    // world, so it lags a little behind a walking body: CLOTH.lag); carried, it damps against the body
    const lag = _lag.copy(s.vel).multiplyScalar(carry * CLOTH.lag);
    // the pins from (the last update's, carried) to (this one's)
    const pin = this._pin && this._pin.length === cols * 12 ? this._pin : (this._pin = new Float32Array(cols * 12));
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < 2; r++) {
        const i = (r * cols + c) * 3, o = (r * cols + c) * 6;
        _a.set(this.local[i], this.local[i + 1], this.local[i + 2]);
        _b.copy(_a).applyMatrix4(this._mPrev);
        if (carry > 0) _b.lerp(_c.copy(_a).applyMatrix4(m), carry);
        _a.applyMatrix4(m);
        pin[o] = _b.x; pin[o + 1] = _b.y; pin[o + 2] = _b.z; pin[o + 3] = _a.x - _b.x; pin[o + 4] = _a.y - _b.y; pin[o + 5] = _a.z - _b.z;
      }
    // the colliders likewise (only when they are the same ones as last time)
    const KP = this._kp, lerpCaps = !fresh && !s.quiet && KP && this._kpN === nc;
    if (lerpCaps && carry > 0) {
      for (let j = 0; j < nc; j++) {
        const o = j * 6;
        _a.set(KP[o], KP[o + 1], KP[o + 2]).applyMatrix4(_mc); _b.set(KP[o + 3], KP[o + 4], KP[o + 5]).applyMatrix4(_mc);
        KP[o] += (_a.x - KP[o]) * carry; KP[o + 1] += (_a.y - KP[o + 1]) * carry; KP[o + 2] += (_a.z - KP[o + 2]) * carry;
        KP[o + 3] += (_b.x - KP[o + 3]) * carry; KP[o + 4] += (_b.y - KP[o + 4]) * carry; KP[o + 5] += (_b.z - KP[o + 5]) * carry;
      }
    }
    for (let k = 0; k < steps; k++) {
      const f = (k + 1) / steps;
      this.capsulesAt(caps, lerpCaps ? KP : null, f);
      // pin the collar row to the anchor, the second row softly (shoulder shape)
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < 2; r++) {
          const i = (r * cols + c) * 3, o = (r * cols + c) * 6;
          const x = pin[o] + pin[o + 3] * f, y = pin[o + 1] + pin[o + 4] * f, z = pin[o + 2] + pin[o + 5] * f;
          const w = r === 0 ? 1 : 0.35;
          this.p[i] += (x - this.p[i]) * w; this.p[i + 1] += (y - this.p[i + 1]) * w; this.p[i + 2] += (z - this.p[i + 2]) * w;
          if (r === 0) { this.q[i] = this.p[i]; this.q[i + 1] = this.p[i + 1]; this.q[i + 2] = this.p[i + 2]; }
        }
      }
      // integrate (the first step after a longer or shorter one: its velocity as a step of this length)
      const kv = damp * (k === 0 && this._h && !fresh && !s.quiet ? Math.min(4, Math.max(0.25, h / this._h)) : 1);
      for (let r = 1; r < rows; r++) {
        const tr = r / (rows - 1);
        for (let c = 0; c < cols; c++) {
          const i = (r * cols + c) * 3;
          const vx = (this.p[i] - this.q[i]) * kv, vy = (this.p[i + 1] - this.q[i + 1]) * kv, vz = (this.p[i + 2] - this.q[i + 2]) * kv;
          this.q[i] = this.p[i]; this.q[i + 1] = this.p[i + 1]; this.q[i + 2] = this.p[i + 2];
          // drag towards the relative air velocity (per-particle velocity matters)
          const pv = 1 / h;
          const flutter = 1 + this.flutter * Math.sin(this.time * 6 + c * 1.7 + r * 0.9);
          const kd = this.drag * tr * flutter;
          let ax = -up.x * this.gravity + (air.x - vx * pv) * kd - lag.x;
          let ay = -up.y * this.gravity + (air.y - vy * pv) * kd - lag.y;
          let az = -up.z * this.gravity + (air.z - vz * pv) * kd - lag.z;
          if (s.spread) {   // gliding: push the sides out like wings
            const side = Math.sign(this.local[i]) || 0;
            ax += right.x * side * 14 * s.spread * tr; ay += right.y * side * 14 * s.spread * tr; az += right.z * side * 14 * s.spread * tr;
          }
          this.p[i] += vx + ax * h * h; this.p[i + 1] += vy + ay * h * h; this.p[i + 2] += vz + az * h * h;
        }
      }
      // constraints, then collisions
      const iters = s.quiet ? BAKE.iters : 5;
      for (let it = 0; it < iters; it++) {
        const C = this.cons, SK = s.field ? this.seatedK : null, SR = this.seatRest;
        for (let k2 = 0; k2 < C.length; k2 += 4) {
          const i = C[k2] * 3, j = C[k2 + 1] * 3;
          let rest = SK ? SR[k2 >> 2] : C[k2 + 2], st = SK ? SK[k2 >> 2] : C[k2 + 3];
          const dx = this.p[j] - this.p[i], dy = this.p[j + 1] - this.p[i + 1], dz = this.p[j + 2] - this.p[i + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          // seated, a bend only keeps the cloth from folding back on itself (SEATED.fold): it bends freely short of that
          if (st < 0) { rest *= SEATED.fold; if (d >= rest) continue; st = -st; }
          const diff = ((d - rest) / d) * 0.5 * st;
          const pinI = i < cols * 3, pinJ = j < cols * 3;
          const wi = pinI ? 0 : pinJ ? 2 : 1, wj = pinJ ? 0 : pinI ? 2 : 1;
          this.p[i] += dx * diff * wi; this.p[i + 1] += dy * diff * wi; this.p[i + 2] += dz * diff * wi;
          this.p[j] -= dx * diff * wj; this.p[j + 1] -= dy * diff * wj; this.p[j + 2] -= dz * diff * wj;
        }
        if (!s.quiet || it === iters - 1) this.collide(s);   // (a bake: the colliders once a step)
      }
    }
    // this update's collar and colliders, for the next one to start from
    this._mPrev.copy(m);
    const kp = this._kp && this._kp.length >= nc * 6 ? this._kp : (this._kp = new Float64Array(Math.max(nc, 16) * 6));
    for (let j = 0; j < nc; j++) {
      const c = caps[j], o = j * 6;
      kp[o] = c.a.x; kp[o + 1] = c.a.y; kp[o + 2] = c.a.z; kp[o + 3] = c.b.x; kp[o + 4] = c.b.y; kp[o + 5] = c.b.z;
    }
    this._kpN = nc;
    this._h = h;
    // the wearer standing still and the cloth at rest: that is its drape now (seated, leaning…)
    if (s.still) {
      this._still = (this._still ?? 0) + dt;
      if (this._still > 1.5 && this.restless() < 1e-3) { this.capture(); this._still = 0.5; }
    } else this._still = 0;
    if (s.quiet) return;   // (baking: no mesh to refresh until the end)
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    this.ringBells();
  }

  /** The hem's bells (if it has any) where the hem is now. */
  ringBells() { if (this.bells) placeBells(this); }

  /** How far the cloth moved in the last step (m, the most of any particle): ~0 at rest. */
  restless() {
    let mx = 0;
    for (let i = this.cols * 3; i < this.p.length; i++) mx = Math.max(mx, Math.abs(this.p[i] - this.q[i]));
    return mx;
  }

  /** Keep the simulated cloth, as it is now, as this cape's drape (in anchor space). */
  capture() {
    if (!this.ready || this.hung) return;
    if (!this._ownDrape || !this.drape) { this.drape = new Float32Array(this.p.length); this._ownDrape = true; }
    this.anchor.updateWorldMatrix(true, false);
    _mi.copy(this.anchor.matrixWorld).invert();
    for (let i = 0; i < this.p.length; i += 3) {
      _a.set(this.p[i], this.p[i + 1], this.p[i + 2]).applyMatrix4(_mi);
      this.drape[i] = _a.x; this.drape[i + 1] = _a.y; this.drape[i + 2] = _a.z;
    }
  }

  /**
   * Give the cape its drape: the shared one for this cut on this kind of body (`key`), or let the
   * cloth settle on the body as it stands now (s as for update(): capsules, floor, up). Only one
   * bake every ~frame (returns false when it has to wait, unless `force`).
   */
  bake(s, { key = null, force = false } = {}) {
    const k = key === null ? null : `${this.cut}|${key}`;
    if (k && DRAPES.has(k)) { this.drape = DRAPES.get(k); this._ownDrape = false; return true; }
    const t = now();
    if (!force && t - lastBake < BAKE_GAP_MS) return false;
    lastBake = t;
    const still = { up: s.up, floor: s.floor, field: s.field ?? null, capsules: s.capsules, vel: ZERO, wind: ZERO, quiet: true };
    this.drape = null; this._ownDrape = false;
    this.ready = false;
    for (let i = 0, n = s.field ? SEATED.bake : BAKE.n; i < n; i++) this.update(1 / 30, still);
    this.capture();
    if (k) { DRAPES.set(k, this.drape); this._ownDrape = false; }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.ringBells();
    return true;
  }

  /**
   * Out of the cloth range: ease the cloth onto its drape over ~half a second (no simulation, so
   * a cape that was swinging doesn't freeze mid-swing), then hang it from the anchor.
   * Returns true once it hangs (false: no drape yet, bake() first).
   */
  rest(dt) {
    if (this.hung) return true;
    if (!this.drape) return false;
    this.unfollow();
    if (!this.ready) return this.hang();
    this._ease = (this._ease ?? 0) + dt;
    if (this._ease >= 0.5) return this.hang();
    this.anchor.updateWorldMatrix(true, false);
    const m = this.anchor.matrixWorld, k = 1 - Math.exp(-9 * dt);
    for (let i = 0; i < this.p.length; i += 3) {
      _a.set(this.drape[i], this.drape[i + 1], this.drape[i + 2]).applyMatrix4(m);
      this.p[i] += (_a.x - this.p[i]) * k; this.p[i + 1] += (_a.y - this.p[i + 1]) * k; this.p[i + 2] += (_a.z - this.p[i + 2]) * k;
    }
    this.q.set(this.p);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.ringBells();
    return false;
  }

  /** Show the drape, carried by the anchor (its matrices move it; nothing to do per frame). */
  hang() {
    if (!this.drape) return false;
    if (this.hung) return true;
    this.unfollow();
    this.hung = true;
    this._ease = 0;
    this.p.set(this.drape);
    this.anchor.add(this.mesh);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    this.ringBells();
    return true;
  }

  /** Back to world space for the simulation (it starts again from the drape: reset()). */
  unhang() {
    this._ease = 0;
    this.unfollow();
    if (!this.hung) return;
    this.hung = false;
    this.ready = false;
    this.scene.add(this.mesh);
  }

  /**
   * A frame between two updates (a cape simulated every 2nd or 3rd frame): the cloth as it was
   * simulated, carried along with the body since (by the mesh's own matrix, nothing recomputed),
   * so the body doesn't walk into its own cape for a frame or two before the cloth catches up.
   */
  follow() {
    if (this.hung || !this.ready || !this._mPrev) return;
    this.anchor.updateWorldMatrix(true, false);
    _mc.multiplyMatrices(this.anchor.matrixWorld, _mi.copy(this._mPrev).invert());
    _mc.decompose(this.mesh.position, this.mesh.quaternion, this.mesh.scale);
    this._followed = true;
  }

  /** The mesh back where its points say (world space while simulated, the anchor's while hung). */
  unfollow() {
    if (!this._followed) return;
    this._followed = false;
    this.mesh.position.set(0, 0, 0); this.mesh.quaternion.identity(); this.mesh.scale.set(1, 1, 1);
  }

  /**
   * The colliders for a step, as plain numbers (Vector3 calls in the inner loop were most of the
   * cloth's cost): `f` of the way from where they were at the last update (`from`: a, b of each,
   * 6 numbers) to where they are now; from null: where they are now.
   */
  capsulesAt(caps, from, f) {
    const nc = caps.length;
    const K = (this._k && this._k.length >= nc * KS) ? this._k : (this._k = new Float64Array(Math.max(nc, 16) * KS));
    for (let j = 0; j < nc; j++) {
      const c = caps[j], o = j * KS;
      let ax = c.a.x, ay = c.a.y, az = c.a.z, ex = c.b.x, ey = c.b.y, ez = c.b.z;
      if (from) {
        const q = j * 6;
        ax = from[q] + (ax - from[q]) * f; ay = from[q + 1] + (ay - from[q + 1]) * f; az = from[q + 2] + (az - from[q + 2]) * f;
        ex = from[q + 3] + (ex - from[q + 3]) * f; ey = from[q + 4] + (ey - from[q + 4]) * f; ez = from[q + 5] + (ez - from[q + 5]) * f;
      }
      const bx = ex - ax, by = ey - ay, bz = ez - az;
      K[o] = ax; K[o + 1] = ay; K[o + 2] = az; K[o + 3] = bx; K[o + 4] = by; K[o + 5] = bz;
      K[o + 6] = 1 / Math.max(bx * bx + by * by + bz * bz, 1e-8); K[o + 7] = c.r;
      // (a cone: its radius from r at a to rb at b, open at both ends: a robe's bell round the legs)
      K[o + 8] = c.rb === undefined ? 0 : c.rb - c.r; K[o + 9] = c.rb === undefined ? 0 : 1;
    }
    this._nc = nc;
  }

  collide(s) {
    const { cols, rows } = this, P = this.p, F = s.field ?? null;
    const K = this._k, nc = this._nc;
    const ux = s.up.x, uy = s.up.y, uz = s.up.z, fx = s.floor.x, fy = s.floor.y, fz = s.floor.z;
    for (let i = cols * 3, n = rows * cols * 3; i < n; i += 3) {
      let x = P[i], y = P[i + 1], z = P[i + 2];
      for (let o = 0; o < nc * KS; o += KS) {
        const bx = K[o + 3], by = K[o + 4], bz = K[o + 5];
        let t = ((x - K[o]) * bx + (y - K[o + 1]) * by + (z - K[o + 2]) * bz) * K[o + 6];
        if (K[o + 9]) { if (t < 0 || t > 1) continue; }   // (past a cone's open ends: nothing)
        else t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = K[o] + bx * t, cy = K[o + 1] + by * t, cz = K[o + 2] + bz * t;
        const dx = x - cx, dy = y - cy, dz = z - cz, d = Math.sqrt(dx * dx + dy * dy + dz * dz), r = K[o + 7] + K[o + 8] * t;
        if (d < r && d > 1e-5) { const k = r / d; x = cx + dx * k; y = cy + dy * k; z = cz + dz * k; }
      }
      if (F) { P[i] = x; P[i + 1] = y; P[i + 2] = z; onField(F, P, this.q, i); continue; }
      // the ground under the feet
      const above = (x - fx) * ux + (y - fy) * uy + (z - fz) * uz;
      if (above < 0.03) { const k = 0.03 - above; x += ux * k; y += uy * k; z += uz * k; }
      P[i] = x; P[i + 1] = y; P[i + 2] = z;
    }
  }

  dispose(scene) {
    this.mesh.removeFromParent();
    scene.remove(this.mesh);
    this.geo.dispose();
    this.bells?.geometry.dispose();
  }
}

/**
 * Bells sewn along a cape's hem (Sefa's sheet: small brass bells all round the cloak's edge). One small
 * mesh, a child of the cape's, so it is in the cape's own space whatever that is (the world while the
 * cloth is simulated, the anchor's while it hangs, carried by follow()); each bell hangs from a point of
 * the hem's row, along the cloth's own fall there (the hem less the row above it), redone whenever the
 * cloth's points are: `n` bells over the hem's points, `size` their mouth's radius (m).
 */
export const BELLS = { color: '#d9a94e', size: 0.022, drop: 0.004 };
const BELL = (() => {
  // a bell: a short flared cup, its loop at the top (origin), hanging down -y
  const g = new THREE.CylinderGeometry(BELLS.size * 0.42, BELLS.size, BELLS.size * 1.5, 7, 1, false).translate(0, -BELLS.size * 0.75 - BELLS.drop, 0);
  const s = new THREE.SphereGeometry(BELLS.size * 0.32, 5, 3).translate(0, -BELLS.size * 1.6 - BELLS.drop, 0);   // the clapper, below the mouth
  const parts = [g.toNonIndexed(), s.toNonIndexed()];
  const pos = new Float32Array(parts.reduce((n, p) => n + p.attributes.position.array.length, 0)), nor = new Float32Array(pos.length);
  let o = 0;
  for (const p of parts) { pos.set(p.attributes.position.array, o); nor.set(p.attributes.normal.array, o); o += p.attributes.position.array.length; }
  return { pos, nor };
})();
function hemBells(cape, n, color) {
  const { cols, rows } = cape, k = Math.max(1, Math.min(n, cols));
  const at = Array.from({ length: k }, (_, i) => (rows - 1) * cols + Math.round((k === 1 ? 0.5 : i / (k - 1)) * (cols - 1)));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BELL.pos.length * k), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(BELL.nor.length * k), 3));
  const mesh = new THREE.Mesh(geo, makeMaterial({ color, figure: true }));
  mesh.frustumCulled = false;
  mesh.userData.noCollide = true;
  mesh.userData.at = at;
  cape.mesh.add(mesh);
  return mesh;
}
const _bq = new THREE.Quaternion(), _down = new THREE.Vector3(0, -1, 0);
function placeBells(cape) {
  const { p, cols } = cape, mesh = cape.bells, at = mesh.userData.at;
  const P = mesh.geometry.attributes.position.array, N = mesh.geometry.attributes.normal.array, m = BELL.pos.length;
  at.forEach((i, b) => {
    const j = i - cols;
    _a.set(p[i * 3] - p[j * 3], p[i * 3 + 1] - p[j * 3 + 1], p[i * 3 + 2] - p[j * 3 + 2]);
    if (_a.lengthSq() < 1e-10) _a.copy(_down); else _a.normalize();
    _bq.setFromUnitVectors(_down, _a);
    for (let v = 0; v < m; v += 3) {
      _b.set(BELL.pos[v], BELL.pos[v + 1], BELL.pos[v + 2]).applyQuaternion(_bq);
      P[b * m + v] = p[i * 3] + _b.x; P[b * m + v + 1] = p[i * 3 + 1] + _b.y; P[b * m + v + 2] = p[i * 3 + 2] + _b.z;
      _b.set(BELL.nor[v], BELL.nor[v + 1], BELL.nor[v + 2]).applyQuaternion(_bq);
      N[b * m + v] = _b.x; N[b * m + v + 1] = _b.y; N[b * m + v + 2] = _b.z;
    }
  });
  mesh.geometry.attributes.position.needsUpdate = true;
  mesh.geometry.attributes.normal.needsUpdate = true;
}
