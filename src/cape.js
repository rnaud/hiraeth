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
const _mi = new THREE.Matrix4(), ZERO = new THREE.Vector3();
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
 * The ground round a seated body: heights on a small grid (±0.96 m, 12 cm) in the body's frame, so
 * the cloth rests on the bench beside and behind the hips and falls over its edges to the ground
 * (a flat floor at the seat's height laid the cape out round them like a sheet). Probed once from
 * just above the seat (`groundAt(x, fromY, z, maxDrop)`, as Physics.groundAt); `at` is the hips
 * over the seat, `heading` the way they face. World up is +y. `sig` names its shape (to 5 cm), for
 * sharing a drape between people on the same kind of seat.
 */
export function groundField(groundAt, at, heading) {
  const { half, step, probe, drop } = FIELD, n = Math.round((half * 2) / step) + 1;
  const fx = Math.sin(heading), fz = Math.cos(heading), rx = fz, rz = -fx;
  const h = new Float32Array(n * n), top = at.y + probe;
  let sig = '';
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const u = -half + i * step, v = -half + j * step;
      const g = groundAt(at.x + rx * u + fx * v, top, at.z + rz * u + fz * v, probe + drop);
      const y = Number.isFinite(g) ? Math.max(g - at.y, -drop) : -drop;
      h[j * n + i] = y;
      sig += String.fromCharCode(48 + Math.max(0, Math.min(60, Math.round(-y / 0.05))));
    }
  return { ox: at.x, oy: at.y, oz: at.z, fx, fz, rx, rz, n, half, step, h, sig };
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
        P[i] += (du * F.rx + dv * F.fx) * F.step; P[i + 2] += (du * F.rz + dv * F.fz) * F.step;
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
  constructor(scene, anchor, { cols = 14, rows = 11, top = 0.19, bottom = 0.5, length = 1.5, y = 0.74, gap = 0.42, color = '#c8483a', color2 = null, heavy = true } = {}) {
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
    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1);
      const rad = top + (bottom - top) * Math.pow(t, 0.8);
      for (let c = 0; c < cols; c++) {
        const ang = gap + (c / (cols - 1)) * (Math.PI * 2 - gap * 2);   // 0 = front
        const i = (r * cols + c) * 3;
        this.local[i] = Math.sin(ang) * rad;
        this.local[i + 1] = y - t * length;
        this.local[i + 2] = Math.cos(ang) * rad;
      }
    }
    // constraints: [i, j, rest, stiffness]
    const cons = [], seated = [];
    const add = (r0, c0, r1, c1, k, bend = false) => {
      if (r1 >= rows || c1 >= cols || c1 < 0) return;
      const i = r0 * cols + c0, j = r1 * cols + c1;
      const dx = this.local[i * 3] - this.local[j * 3], dy = this.local[i * 3 + 1] - this.local[j * 3 + 1], dz = this.local[i * 3 + 2] - this.local[j * 3 + 2];
      cons.push(i, j, Math.hypot(dx, dy, dz), k);
      seated.push(bend ? 0 : k);
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
    // seated, the cloth has to fold where it meets the seat and the ground: no bends (stiff
    // downward, a seated cape stood out from the body like a plank, or heaped up on the seat)
    this.seatedK = new Float32Array(seated);

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
    scene.add(this.mesh);
    this.ready = false;
    this.capsules = [];
    this.time = 0;
  }

  /** Start the cloth over: on its drape if it has one (already settled), else the cut's cone. */
  reset() {
    this.unhang();
    this.anchor.updateWorldMatrix(true, false);
    const m = this.anchor.matrixWorld;
    const src = this.drape ?? this.local;
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
   * @param s.capsules [{a, b, r}] body capsules in world space
   * @param s.spread 0..1 open like wings (gliding), s.lift 0..1 updraft (jetpack)
   */
  update(dt, s) {
    if (this.hung) this.unhang();   // (and starts again from the drape: reset())
    this._ease = 0;
    this.anchor.updateWorldMatrix(true, false);
    const m = this.anchor.matrixWorld;
    _a.set(this.local[0], this.local[1], this.local[2]).applyMatrix4(m);
    if (!this.ready || Math.hypot(_a.x - this.p[0], _a.y - this.p[1], _a.z - this.p[2]) > 3) this.reset();
    this.time += dt;
    // more substeps when the body moves fast, so limbs can't tunnel through the cloth
    const fast = Math.hypot(s.vel.x, s.vel.y, s.vel.z);
    // (a bake only needs where the cloth comes to rest: see BAKE)
    const steps = s.quiet ? BAKE.steps : fast > 6 ? 5 : 3, h = Math.min(dt, 1 / 30) / steps;
    const damp = s.quiet ? BAKE.damp : this.damp;
    const { cols, rows } = this;
    const up = s.up;
    // relative air: ambient wind minus our own motion, plus an updraft for the jetpack
    const air = _d.copy(s.wind).multiplyScalar(this.windScale).sub(s.vel).addScaledVector(up, (s.lift ?? 0) * 9);
    const right = _r.set(1, 0, 0).transformDirection(m);
    for (let k = 0; k < steps; k++) {
      // pin the collar row to the anchor, the second row softly (shoulder shape)
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < 2; r++) {
          const i = (r * cols + c) * 3;
          _a.set(this.local[i], this.local[i + 1], this.local[i + 2]).applyMatrix4(m);
          const w = r === 0 ? 1 : 0.35;
          this.p[i] += (_a.x - this.p[i]) * w; this.p[i + 1] += (_a.y - this.p[i + 1]) * w; this.p[i + 2] += (_a.z - this.p[i + 2]) * w;
          if (r === 0) { this.q[i] = this.p[i]; this.q[i + 1] = this.p[i + 1]; this.q[i + 2] = this.p[i + 2]; }
        }
      }
      // integrate
      for (let r = 1; r < rows; r++) {
        const tr = r / (rows - 1);
        for (let c = 0; c < cols; c++) {
          const i = (r * cols + c) * 3;
          const vx = (this.p[i] - this.q[i]) * damp, vy = (this.p[i + 1] - this.q[i + 1]) * damp, vz = (this.p[i + 2] - this.q[i + 2]) * damp;
          this.q[i] = this.p[i]; this.q[i + 1] = this.p[i + 1]; this.q[i + 2] = this.p[i + 2];
          // drag towards the relative air velocity (per-particle velocity matters)
          const pv = 1 / h;
          const flutter = 1 + this.flutter * Math.sin(this.time * 6 + c * 1.7 + r * 0.9);
          const kd = this.drag * tr * flutter;
          let ax = -up.x * this.gravity + (air.x - vx * pv) * kd;
          let ay = -up.y * this.gravity + (air.y - vy * pv) * kd;
          let az = -up.z * this.gravity + (air.z - vz * pv) * kd;
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
        const C = this.cons, SK = s.field ? this.seatedK : null;
        for (let k2 = 0; k2 < C.length; k2 += 4) {
          const i = C[k2] * 3, j = C[k2 + 1] * 3, rest = C[k2 + 2], st = SK ? SK[k2 >> 2] : C[k2 + 3];
          const dx = this.p[j] - this.p[i], dy = this.p[j + 1] - this.p[i + 1], dz = this.p[j + 2] - this.p[i + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          const diff = ((d - rest) / d) * 0.5 * st;
          const pinI = i < cols * 3, pinJ = j < cols * 3;
          const wi = pinI ? 0 : pinJ ? 2 : 1, wj = pinJ ? 0 : pinI ? 2 : 1;
          this.p[i] += dx * diff * wi; this.p[i + 1] += dy * diff * wi; this.p[i + 2] += dz * diff * wi;
          this.p[j] -= dx * diff * wj; this.p[j + 1] -= dy * diff * wj; this.p[j + 2] -= dz * diff * wj;
        }
        if (!s.quiet || it === iters - 1) this.collide(s);   // (a bake: the colliders once a step)
      }
    }
    // the wearer standing still and the cloth at rest: that is its drape now (seated, leaning…)
    if (s.still) {
      this._still = (this._still ?? 0) + dt;
      if (this._still > 1.5 && this.restless() < 1e-3) { this.capture(); this._still = 0.5; }
    } else this._still = 0;
    if (s.quiet) return;   // (baking: no mesh to refresh until the end)
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }

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
    for (let i = 0; i < BAKE.n; i++) this.update(1 / 30, still);
    this.capture();
    if (k) { DRAPES.set(k, this.drape); this._ownDrape = false; }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
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
    return false;
  }

  /** Show the drape, carried by the anchor (its matrices move it; nothing to do per frame). */
  hang() {
    if (!this.drape) return false;
    if (this.hung) return true;
    this.hung = true;
    this._ease = 0;
    this.p.set(this.drape);
    this.anchor.add(this.mesh);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    return true;
  }

  /** Back to world space for the simulation (it starts again from the drape: reset()). */
  unhang() {
    this._ease = 0;
    if (!this.hung) return;
    this.hung = false;
    this.ready = false;
    this.scene.add(this.mesh);
  }

  collide(s) {
    const { cols, rows } = this, P = this.p, F = s.field ?? null;
    // the capsules as plain numbers once per pass (Vector3 calls in the inner loop were most of the cloth's cost)
    const caps = s.capsules, nc = caps.length;
    const K = (this._k && this._k.length >= nc * 8) ? this._k : (this._k = new Float64Array(nc * 8));
    for (let j = 0; j < nc; j++) {
      const c = caps[j], o = j * 8;
      const bx = c.b.x - c.a.x, by = c.b.y - c.a.y, bz = c.b.z - c.a.z;
      K[o] = c.a.x; K[o + 1] = c.a.y; K[o + 2] = c.a.z; K[o + 3] = bx; K[o + 4] = by; K[o + 5] = bz;
      K[o + 6] = 1 / Math.max(bx * bx + by * by + bz * bz, 1e-8); K[o + 7] = c.r;
    }
    const ux = s.up.x, uy = s.up.y, uz = s.up.z, fx = s.floor.x, fy = s.floor.y, fz = s.floor.z;
    for (let i = cols * 3, n = rows * cols * 3; i < n; i += 3) {
      let x = P[i], y = P[i + 1], z = P[i + 2];
      for (let o = 0; o < nc * 8; o += 8) {
        const bx = K[o + 3], by = K[o + 4], bz = K[o + 5];
        let t = ((x - K[o]) * bx + (y - K[o + 1]) * by + (z - K[o + 2]) * bz) * K[o + 6];
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = K[o] + bx * t, cy = K[o + 1] + by * t, cz = K[o + 2] + bz * t;
        const dx = x - cx, dy = y - cy, dz = z - cz, d = Math.sqrt(dx * dx + dy * dy + dz * dz), r = K[o + 7];
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
  }
}
