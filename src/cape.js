import * as THREE from 'three';
import { makeMaterial } from './materials.js';

// A real cloth cape: a grid of particles hanging from the collar, integrated
// with Verlet in world space and kept in shape by distance constraints
// (structural, shear and bend). Gravity follows the character's "up", air
// drag against the character's motion makes it stream out behind when
// running, and it collides with capsules on the body and legs so the legs
// push it around as they swing, plus the ground under the feet.

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3();

export class Cape {
  /**
   * @param anchor  Object3D the cape is pinned to (the torso)
   * @param o.top / o.bottom  radius at the collar / hem, o.length, o.y (collar height in anchor space)
   * @param o.gap   half-angle of the opening at the front
   */
  constructor(scene, anchor, { cols = 14, rows = 11, top = 0.19, bottom = 0.5, length = 1.5, y = 0.74, gap = 0.42, color = '#c8483a', color2 = null, heavy = true } = {}) {
    this.anchor = anchor;
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
    const cons = [];
    const add = (r0, c0, r1, c1, k) => {
      if (r1 >= rows || c1 >= cols || c1 < 0) return;
      const i = r0 * cols + c0, j = r1 * cols + c1;
      const dx = this.local[i * 3] - this.local[j * 3], dy = this.local[i * 3 + 1] - this.local[j * 3 + 1], dz = this.local[i * 3 + 2] - this.local[j * 3 + 2];
      cons.push(i, j, Math.hypot(dx, dy, dz), k);
    };
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        add(r, c, r, c + 1, 1);            // around
        add(r, c, r + 1, c, 1);            // down
        add(r, c, r + 1, c + 1, 0.5);      // shear
        add(r, c, r + 1, c - 1, 0.5);
        add(r, c, r + 2, c, heavy ? 0.55 : 0.25);   // bend: stiff downward, so folds stay long
        add(r, c, r, c + 2, 0.15);
      }
    this.cons = new Float32Array(cons);

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

  reset() {
    this.anchor.updateWorldMatrix(true, false);
    const m = this.anchor.matrixWorld;
    for (let i = 0; i < this.p.length; i += 3) {
      _a.set(this.local[i], this.local[i + 1], this.local[i + 2]).applyMatrix4(m);
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
    this.anchor.updateWorldMatrix(true, false);
    const m = this.anchor.matrixWorld;
    _a.set(this.local[0], this.local[1], this.local[2]).applyMatrix4(m);
    if (!this.ready || Math.hypot(_a.x - this.p[0], _a.y - this.p[1], _a.z - this.p[2]) > 3) this.reset();
    this.time += dt;
    // more substeps when the body moves fast, so limbs can't tunnel through the cloth
    const fast = Math.hypot(s.vel.x, s.vel.y, s.vel.z);
    const steps = fast > 6 ? 5 : 3, h = Math.min(dt, 1 / 30) / steps;
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
          const vx = (this.p[i] - this.q[i]) * this.damp, vy = (this.p[i + 1] - this.q[i + 1]) * this.damp, vz = (this.p[i + 2] - this.q[i + 2]) * this.damp;
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
      for (let it = 0; it < 5; it++) {
        const C = this.cons;
        for (let k2 = 0; k2 < C.length; k2 += 4) {
          const i = C[k2] * 3, j = C[k2 + 1] * 3, rest = C[k2 + 2], st = C[k2 + 3];
          const dx = this.p[j] - this.p[i], dy = this.p[j + 1] - this.p[i + 1], dz = this.p[j + 2] - this.p[i + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          const diff = ((d - rest) / d) * 0.5 * st;
          const pinI = i < cols * 3, pinJ = j < cols * 3;
          const wi = pinI ? 0 : pinJ ? 2 : 1, wj = pinJ ? 0 : pinI ? 2 : 1;
          this.p[i] += dx * diff * wi; this.p[i + 1] += dy * diff * wi; this.p[i + 2] += dz * diff * wi;
          this.p[j] -= dx * diff * wj; this.p[j + 1] -= dy * diff * wj; this.p[j + 2] -= dz * diff * wj;
        }
        this.collide(s);
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }

  collide(s) {
    const { cols, rows } = this;
    for (let r = 1; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 3;
        _a.set(this.p[i], this.p[i + 1], this.p[i + 2]);
        for (const cap of s.capsules) {
          _b.subVectors(cap.b, cap.a);
          const t = Math.max(0, Math.min(1, _c.subVectors(_a, cap.a).dot(_b) / Math.max(_b.lengthSq(), 1e-8)));
          _c.copy(cap.a).addScaledVector(_b, t);
          _b.subVectors(_a, _c);
          const d = _b.length();
          if (d < cap.r && d > 1e-5) _a.copy(_c).addScaledVector(_b, cap.r / d);
        }
        // the ground under the feet
        const above = _b.subVectors(_a, s.floor).dot(s.up);
        if (above < 0.03) _a.addScaledVector(s.up, 0.03 - above);
        this.p[i] = _a.x; this.p[i + 1] = _a.y; this.p[i + 2] = _a.z;
      }
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.geo.dispose();
  }
}
