import * as THREE from 'three';
import { makeMaterial } from './materials.js';

// Cloth that hangs from something: washing on a line, flags on a string, a
// curtain on its rod, a scarf on a peg (home uses all four: src/levels/home.js).
// The same kind of cloth as the capes (src/cape.js): a grid of particles,
// Verlet-integrated in world space and held in shape by distance constraints
// (structural, shear, bend). Here the top edge is pinned in the world instead
// of to a body: every point of the top row (a rod, a sheet folded over a line)
// or only some (pegs; the rest of the edge sags between them).
//
// The wind pushes on the cloth's face (the force goes along each point's normal,
// so a sheet edge-on to the wind barely moves and one face-on billows), with a
// flutter that runs across it, and gusts. It collides with capsules (the
// traveller's body: Humanoid.capsules) and with a floor. Far from the camera it
// sleeps where it is (sleep()), and wakes up when you come near.

const _a = new THREE.Vector3(), _w = new THREE.Vector3();

export class HangingCloth {
  /**
   * @param o.a, o.b     the two ends of the top edge (world)
   * @param o.length     how far it hangs (m)
   * @param o.cols/rows  grid (cols along the top edge)
   * @param o.pins       'all' (the whole top row), the top row's columns that are pinned (pegs), or
   *                     (row, col) => pinned (a flag on its pole: col === 0)
   * @param o.floor      the height of the ground under it (world y), o.wind (how much it feels the wind)
   * @param o.taper      0..1: the bottom edge this much narrower (a pennant), o.droop: sag between pins (m)
   */
  constructor(scene, { a, b, length = 1.6, cols = 9, rows = 10, color = '#5fd0c6', color2 = null, pins = 'all', floor = -Infinity,
    wind = 1, damp = 0.985, gravity = 9.8, taper = 0, droop = 0, name = 'cloth' } = {}) {
    this.cols = cols; this.rows = rows;
    this.floor = floor; this.windK = wind; this.damp = damp; this.gravity = gravity;
    const n = cols * rows;
    this.p = new Float32Array(n * 3);
    this.q = new Float32Array(n * 3);
    this.rest = new Float32Array(n * 3);   // the cloth hanging straight down, untouched
    this.pinned = new Uint8Array(n);
    const pinCols = pins === 'all' || typeof pins === 'function' ? null : new Set(pins);
    const pinAt = typeof pins === 'function' ? pins : (r, c) => r === 0 && (!pinCols || pinCols.has(c));
    const mid = (cols - 1) / 2;
    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1);
      for (let c = 0; c < cols; c++) {
        // (a pennant narrows to its tip: the columns draw together toward the bottom)
        const u = mid + (c - mid) * (1 - taper * t);
        _a.lerpVectors(a, b, cols > 1 ? u / (cols - 1) : 0.5);
        const pinnedHere = !!pinAt(r, c);
        if (r === 0 && !pinnedHere && droop) _a.y -= droop * Math.sin(Math.PI * (c / (cols - 1)));
        const i = (r * cols + c) * 3;
        this.rest[i] = _a.x; this.rest[i + 1] = _a.y - t * length; this.rest[i + 2] = _a.z;
        if (pinnedHere) this.pinned[r * cols + c] = 1;
      }
    }
    this.p.set(this.rest); this.q.set(this.rest);
    // constraints: [i, j, rest length, stiffness]
    const cons = [];
    const link = (r0, c0, r1, c1, k) => {
      if (r1 < 0 || r1 >= rows || c1 < 0 || c1 >= cols) return;
      const i = r0 * cols + c0, j = r1 * cols + c1;
      if (this.pinned[i] && this.pinned[j]) return;
      const R = this.rest;
      cons.push(i, j, Math.hypot(R[i * 3] - R[j * 3], R[i * 3 + 1] - R[j * 3 + 1], R[i * 3 + 2] - R[j * 3 + 2]), k);
    };
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        link(r, c, r, c + 1, 1); link(r, c, r + 1, c, 1);
        link(r, c, r + 1, c + 1, 0.5); link(r, c, r + 1, c - 1, 0.5);
        link(r, c, r + 2, c, 0.3); link(r, c, r, c + 2, 0.2);
      }
    this.cons = new Float32Array(cons);
    this.structural = cons.filter((_, k) => k % 4 === 3).map((s, k) => (s === 1 ? k : -1)).filter((k) => k >= 0);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    const fold = new Float32Array(n * 2);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { fold[(r * cols + c) * 2] = c / (cols - 1); fold[(r * cols + c) * 2 + 1] = r / (rows - 1); }
    geo.setAttribute('aFold', new THREE.BufferAttribute(fold, 2));
    const idx = [];
    for (let r = 0; r < rows - 1; r++)
      for (let c = 0; c < cols - 1; c++) { const i = r * cols + c; idx.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1); }
    geo.setIndex(idx);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, makeMaterial({ color, color2: color2 ?? color, side: THREE.DoubleSide, folds: cols * 0.6 }));
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.userData.noCollide = true;
    this.mesh.userData.dynamic = true;
    scene?.add(this.mesh);
    this.time = Math.random() * 10;
    this.centre = new THREE.Vector3().lerpVectors(a, b, 0.5).addScaledVector(THREE.Object3D.DEFAULT_UP, -length / 2);
    this.radius = a.distanceTo(b) / 2 + length;
    this.asleep = false;
  }

  /**
   * One frame.
   * @param s.wind      the wind (world, m/s; y ignored), s.gust 0..1
   * @param s.capsules  [{ a, b, r }] world-space colliders (the traveller), or none
   */
  update(dt, { wind = null, gust = 0, capsules = null } = {}) {
    this.asleep = false;
    dt = Math.min(dt, 1 / 30);
    this.time += dt;
    const steps = 2, h = dt / steps, P = this.p, Q = this.q, N = this.geo.attributes.normal.array;
    const { cols, rows } = this;
    const wx = (wind?.x ?? 0) * this.windK * (1 + gust * 0.8), wz = (wind?.z ?? 0) * this.windK * (1 + gust * 0.8);
    for (let s = 0; s < steps; s++) {
      for (let i = 0, n = cols * rows; i < n; i++) {
        const k = i * 3;
        if (this.pinned[i]) { P[k] = Q[k] = this.rest[k]; P[k + 1] = Q[k + 1] = this.rest[k + 1]; P[k + 2] = Q[k + 2] = this.rest[k + 2]; continue; }
        const vx = (P[k] - Q[k]) * this.damp, vy = (P[k + 1] - Q[k + 1]) * this.damp, vz = (P[k + 2] - Q[k + 2]) * this.damp;
        Q[k] = P[k]; Q[k + 1] = P[k + 1]; Q[k + 2] = P[k + 2];
        // the air against the cloth: along its normal (face-on billows, edge-on barely stirs), a
        // flutter running across it, and a little drag toward the wind's own speed
        const c = i % cols, r = (i / cols) | 0;
        const flutter = 0.65 + 0.35 * Math.sin(this.time * 5.3 - c * 0.9 + r * 0.6) + 0.25 * Math.sin(this.time * 11.7 + r * 1.3);
        const rx = wx - vx / h, rz = wz - vz / h, ry = -vy / h;
        const nx = N[k], ny = N[k + 1], nz = N[k + 2];
        const push = (rx * nx + ry * ny + rz * nz) * 1.1 * flutter;
        const ax = nx * push + rx * 0.08, ay = ny * push + ry * 0.08 - this.gravity, az = nz * push + rz * 0.08;
        P[k] += vx + ax * h * h; P[k + 1] += vy + ay * h * h; P[k + 2] += vz + az * h * h;
      }
      const C = this.cons, pin = this.pinned;
      for (let it = 0; it < 4; it++) {
        for (let k2 = 0; k2 < C.length; k2 += 4) {
          const ii = C[k2], jj = C[k2 + 1], i = ii * 3, j = jj * 3, rest = C[k2 + 2], st = C[k2 + 3];
          const dx = P[j] - P[i], dy = P[j + 1] - P[i + 1], dz = P[j + 2] - P[i + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          const diff = ((d - rest) / d) * 0.5 * st;
          const wi = pin[ii] ? 0 : pin[jj] ? 2 : 1, wj = pin[jj] ? 0 : pin[ii] ? 2 : 1;
          P[i] += dx * diff * wi; P[i + 1] += dy * diff * wi; P[i + 2] += dz * diff * wi;
          P[j] -= dx * diff * wj; P[j + 1] -= dy * diff * wj; P[j + 2] -= dz * diff * wj;
        }
      }
      this.collide(capsules);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }

  collide(capsules) {
    const P = this.p, n = this.cols * this.rows, fl = this.floor + 0.03;
    for (let i = 0; i < n; i++) {
      if (this.pinned[i]) continue;
      const k = i * 3;
      let x = P[k], y = P[k + 1], z = P[k + 2];
      if (capsules) for (const c of capsules) {
        const bx = c.b.x - c.a.x, by = c.b.y - c.a.y, bz = c.b.z - c.a.z;
        let t = ((x - c.a.x) * bx + (y - c.a.y) * by + (z - c.a.z) * bz) / Math.max(bx * bx + by * by + bz * bz, 1e-8);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = c.a.x + bx * t, cy = c.a.y + by * t, cz = c.a.z + bz * t;
        const dx = x - cx, dy = y - cy, dz = z - cz, d = Math.sqrt(dx * dx + dy * dy + dz * dz), r = c.r + 0.02;
        if (d < r && d > 1e-5) { const s = r / d; x = cx + dx * s; y = cy + dy * s; z = cz + dz * s; }
      }
      if (y < fl) y = fl;
      P[k] = x; P[k + 1] = y; P[k + 2] = z;
    }
  }

  /** Is a world point near enough to touch it (m of margin)? */
  near(p, margin = 1) { return p.distanceTo(this.centre) < this.radius + margin; }

  /** Far away: stop simulating, and stop moving (the cloth stays where it was). */
  sleep() { if (!this.asleep) { this.q.set(this.p); this.asleep = true; } }

  /** The furthest any structural link is stretched beyond its length (1 = at rest), for the tests. */
  stretch() {
    let mx = 0;
    for (const k of this.structural) {
      const o = k * 4, i = this.cons[o] * 3, j = this.cons[o + 1] * 3;
      const d = Math.hypot(this.p[i] - this.p[j], this.p[i + 1] - this.p[j + 1], this.p[i + 2] - this.p[j + 2]);
      mx = Math.max(mx, d / this.cons[o + 2]);
    }
    return mx;
  }

  dispose() { this.mesh.removeFromParent(); this.geo.dispose(); }
}

/**
 * Many cloths, simulated near the camera only (a few at a time), with the traveller as collider.
 * @param o.near  m from the camera within which a cloth moves
 */
export class Cloths {
  constructor({ near = 55 } = {}) { this.list = []; this.nearR = near; this._w = new THREE.Vector3(); }
  add(c) { this.list.push(c); return c; }
  /**
   * @param s.camera  where you see from · s.player (pos, wind, humanoid.capsules()) · s.gust 0..1
   * @param s.windAt  (cloth) => wind multiplier (indoors: hardly any)
   */
  update(dt, { camera = null, player = null, gust = 0, windAt = null } = {}) {
    const eye = camera?.position ?? player?.pos;
    let caps = null;
    for (const c of this.list) {
      if (eye && c.centre.distanceTo(eye) > this.nearR + c.radius) { c.sleep(); continue; }
      const touching = player && c.near(player.pos, 1.6);
      if (touching && !caps) caps = player.humanoid?.capsules?.() ?? null;
      const k = windAt ? windAt(c) : 1;
      this._w.copy(player?.wind ?? _w.set(1.2, 0, 0.5)).multiplyScalar(k);
      c.update(dt, { wind: this._w, gust: gust * k, capsules: touching ? caps : null });
    }
  }
}
