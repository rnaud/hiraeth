import * as THREE from 'three';
import { makeMaterial, MODE_RIBBON } from './materials.js';

// A hover-jet trail: a glowing colourful tube streaming out of a jet along
// the path it took. Ring 0 is always the live jet position (no stepping);
// older rings come from recorded samples. It swells a little, then
// dissolves into print dots towards the tail. Real geometry in the inked
// G-buffer, self-lit; colour bands are fixed along the path.
//
// It never dips into the ground: each sample remembers the ground under it
// (its height and the slope out to each side, from a few cheap ground
// queries when it is laid down), the ring centre is kept above it, and the
// part of the tube that would sink is flattened onto the surface instead.
// Given the level's collision, the centreline also keeps a radius clear of
// the walls and rocks it brushes past.

const RINGS = 120;
const SIDES = 10;
const LIFT = 0.06;     // gap kept between the tube and the ground
const SLOPE = 0.6;     // spacing of the slope probes (m)

export class Trail {
  /**
   * @param physics optional level collision: the tube's centreline is kept
   *                out of walls and rocks it brushes past (pushCapsule), and
   *                it is the default ground query
   * @param ground  optional (x, fromY, z) -> height of the first surface below
   *                (e.g. a vehicle's own groundAt, with its water floor)
   */
  constructor(scene, { radius = 0.55, life = 3.4, offset = 0, physics = null, ground = null } = {}) {
    this.physics = physics?.pushCapsule ? physics : null;
    this.ground = ground ?? (physics ? (x, y, z) => physics.groundAt(x, y, z) : null);
    this._jet = new THREE.Vector3(); this._push = new THREE.Vector3();
    this.samples = [];          // { p, t, d }
    this.time = 0;
    this.dist = 0;
    this.life = life;
    this.radius = radius;
    this.offset = offset;       // colour band offset (so the two jets differ a little)
    const nV = RINGS * SIDES;
    this.pos = new Float32Array(nV * 3);
    this.nrm = new Float32Array(nV * 3);
    this.fold = new Float32Array(nV * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aFold', new THREE.BufferAttribute(this.fold, 2).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.setIndex(false);
    this.mesh = new THREE.Mesh(g, makeMaterial({ color: '#ffffff', mode: MODE_RIBBON, glow: 1 }));
    this.mesh.frustumCulled = false;
    this.mesh.userData.noCollide = true;
    scene.add(this.mesh);
    this.windingChecked = false;
    this._t = new THREE.Vector3(); this._n = new THREE.Vector3(); this._b = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0); this._c = new THREE.Vector3();
    this._live = {};
  }

  setIndex(flip) {
    const idx = [];
    for (let r = 0; r < RINGS - 1; r++)
      for (let k = 0; k < SIDES; k++) {
        const a = r * SIDES + k, b = r * SIDES + ((k + 1) % SIDES), c = a + SIDES, d = b + SIDES;
        if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
      }
    this.geo.setIndex(idx);
  }

  /**
   * The ground under a point as a little tent { x, z, h, s, m }: the height
   * below it, the slope out to each side (s: +x, -x, +z, -z) and a margin
   * for creases between them, or null with no
   * ground query. Looked for from a metre above the jet (still under the
   * vehicle's own collision top), so a jet that dipped into a roof still
   * finds that roof, while a bridge overhead isn't mistaken for the ground.
   */
  groundPlane(p, out = {}, like = null) {
    if (!this.ground) return null;
    const from = p.y + 1, e = SLOPE;
    const fin = (h) => (Number.isFinite(h) ? h : -Infinity);
    const h = fin(this.ground(p.x, from, p.z));
    out.x = p.x; out.z = p.z; out.h = h;
    if (like) { out.s = like.s; out.m = like.m; return out; }   // the live ring: one query, the last sample's slopes
    // a slope on each side (+x, -x, +z, -z), so crests and V-shaped dips are
    // followed too; a probe off an edge counts as level, and a ledge is
    // clamped so it can't tilt it wildly
    const slope = (dx, dz) => {
      const a = fin(this.ground(p.x + dx, from, p.z + dz));
      return Number.isFinite(a) && Number.isFinite(h) ? THREE.MathUtils.clamp((a - h) / e, -1.5, 1.5) : 0;
    };
    const sl = out.s = [slope(e, 0), slope(-e, 0), slope(0, e), slope(0, -e)];
    // and on the diagonals, where a crease of the terrain mesh can run between
    // the probes: whatever the tent misses there is added as a margin
    out.m = 0;
    const k = e * Math.SQRT1_2;
    if (Number.isFinite(h)) for (const [dx, dz] of [[k, k], [k, -k], [-k, k], [-k, -k]]) {
      const a = fin(this.ground(p.x + dx, from, p.z + dz));
      const tent = h + k * sl[dx > 0 ? 0 : 1] + k * sl[dz > 0 ? 2 : 3];
      if (Number.isFinite(a) && a - tent < 0.6) out.m = Math.max(out.m, a - tent);
    }
    return out;
  }

  /** @param jet world position of the jet nozzle, or null when not laying a trail */
  update(dt, jet) {
    this.time += dt;
    const S = this.samples;
    // a jet brushing a wall or a rock: lay the tube a radius clear of it
    if (jet && this.physics) {
      jet = this._jet.copy(jet);
      const r = this.radius * 1.1;
      this.physics.pushCapsule(jet, r, -r, r, this._push);
    }
    if (jet) {
      const last = S[S.length - 1];
      const step = last ? last.p.distanceTo(jet) : 0;
      if (!last || step > 0.45) {
        this.dist += step;
        S.push({ p: jet.clone(), t: this.time, d: this.dist, g: this.groundPlane(jet) });
        if (S.length > RINGS - 1) S.shift();
      }
    }
    while (S.length && this.time - S[0].t > this.life) S.shift();
    // ring 0 = the live jet (or the newest sample when stopped), then samples newest -> oldest
    const pts = [];
    const live = jet ?? S[S.length - 1]?.p;
    if (live) pts.push({ p: live, age: 0, d: this.dist + (S.length ? S[S.length - 1].p.distanceTo(live) : 0), g: jet ? this.groundPlane(jet, this._live, S[S.length - 1]?.g) : S[S.length - 1].g });
    for (let i = S.length - 1; i >= 0; i--) pts.push({ p: S[i].p, age: Math.min((this.time - S[i].t) / this.life, 1), d: S[i].d, g: S[i].g });
    const n = pts.length;
    const T = this._t, N = this._n, B = this._b;
    for (let r = 0; r < RINGS; r++) {
      const q = pts[Math.min(r, n - 1)];
      let radius = 0;
      if (q && r < n) {
        // a narrow nozzle, swelling within the first metres, a soft pulse along it
        const grow = THREE.MathUtils.smoothstep(this.dist - q.d, 0, 6);
        radius = this.radius * (0.35 + 0.65 * grow) * (1 + 0.1 * Math.sin(q.d * 0.4 - this.time * 4)) * (1 - 0.35 * q.age);
        if (r === n - 1) radius *= 0.2;
      }
      const a = pts[Math.max(r - 1, 0)] ?? q, b = pts[Math.min(r + 1, n - 1)] ?? q;
      if (q) T.subVectors(a.p, b.p); else T.set(0, 0, 1);
      if (T.lengthSq() < 1e-8) T.set(0, 0, 1);
      T.normalize();
      N.crossVectors(T, this._up); if (N.lengthSq() < 1e-6) N.set(1, 0, 0); N.normalize();
      B.crossVectors(N, T).normalize();
      let c = q ? q.p : this._c.set(0, -1e4, 0);
      const G = q && r < n ? q.g : null;
      if (G) {
        // keep the centre clear of the ground (a flattened tube rather than a buried one)
        const floor = G.h + LIFT + radius * 0.3;
        if (c.y < floor) c = this._c.set(c.x, floor, c.z);
      }
      for (let k = 0; k < SIDES; k++) {
        const th = (k / SIDES) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
        const j = (r * SIDES + k) * 3;
        const nx = N.x * cs + B.x * sn, ny = N.y * cs + B.y * sn, nz = N.z * cs + B.z * sn;
        const px = c.x + nx * radius, pz = c.z + nz * radius;
        let py = c.y + ny * radius;
        if (G) {
          // squash: the underside rests on the ground, never below it
          const dx = px - G.x, dz = pz - G.z, sl = G.s;
          const floor = G.h + Math.abs(dx) * sl[dx > 0 ? 0 : 1] + Math.abs(dz) * sl[dz > 0 ? 2 : 3] + G.m + LIFT;
          if (py < floor) py = floor;
        }
        this.pos[j] = px; this.pos[j + 1] = py; this.pos[j + 2] = pz;
        this.nrm[j] = nx; this.nrm[j + 1] = ny; this.nrm[j + 2] = nz;
        const f = (r * SIDES + k) * 2;
        this.fold[f] = q ? q.d / 6.0 + this.offset : 0;     // a colour band every 6 m of path
        this.fold[f + 1] = q ? q.age : 1;                    // age: drives the dissolve
      }
    }
    // the faces must point outward: check the winding once against the normals
    if (!this.windingChecked && n > 4) {
      const p = this.pos, A = new THREE.Vector3(p[3 * SIDES * 2], p[3 * SIDES * 2 + 1], p[3 * SIDES * 2 + 2]);
      const Bv = new THREE.Vector3(p[3 * (SIDES * 2 + 1)], p[3 * (SIDES * 2 + 1) + 1], p[3 * (SIDES * 2 + 1) + 2]);
      const C = new THREE.Vector3(p[3 * SIDES * 3], p[3 * SIDES * 3 + 1], p[3 * SIDES * 3 + 2]);
      const face = new THREE.Vector3().crossVectors(C.clone().sub(A), Bv.clone().sub(A));   // triangle (a, c, b)
      const nrm = new THREE.Vector3(this.nrm[3 * SIDES * 2], this.nrm[3 * SIDES * 2 + 1], this.nrm[3 * SIDES * 2 + 2]);
      if (face.lengthSq() > 1e-10) { if (face.dot(nrm) < 0) this.setIndex(true); this.windingChecked = true; }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.attributes.aFold.needsUpdate = true;
    this.geo.computeBoundingSphere();
    this.mesh.visible = n > 2;
  }
}
