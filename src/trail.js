import * as THREE from 'three';
import { makeMaterial, MODE_RIBBON } from './materials.js';

// A hover-jet trail: a glowing colourful tube streaming out of a jet along
// the path it took. Ring 0 is always the live jet position (no stepping);
// older rings come from recorded samples. It swells a little, then
// dissolves into print dots towards the tail. Real geometry in the inked
// G-buffer, self-lit; colour bands are fixed along the path.

const RINGS = 120;
const SIDES = 10;

export class Trail {
  constructor(scene, { radius = 0.55, life = 3.4, offset = 0 } = {}) {
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

  /** @param jet world position of the jet nozzle, or null when not laying a trail */
  update(dt, jet) {
    this.time += dt;
    const S = this.samples;
    if (jet) {
      const last = S[S.length - 1];
      const step = last ? last.p.distanceTo(jet) : 0;
      if (!last || step > 0.45) {
        this.dist += step;
        S.push({ p: jet.clone(), t: this.time, d: this.dist });
        if (S.length > RINGS - 1) S.shift();
      }
    }
    while (S.length && this.time - S[0].t > this.life) S.shift();
    // ring 0 = the live jet (or the newest sample when stopped), then samples newest -> oldest
    const pts = [];
    const live = jet ?? S[S.length - 1]?.p;
    if (live) pts.push({ p: live, age: 0, d: this.dist + (S.length ? S[S.length - 1].p.distanceTo(live) : 0) });
    for (let i = S.length - 1; i >= 0; i--) pts.push({ p: S[i].p, age: Math.min((this.time - S[i].t) / this.life, 1), d: S[i].d });
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
      const c = q ? q.p : this._c.set(0, -1e4, 0);
      for (let k = 0; k < SIDES; k++) {
        const th = (k / SIDES) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
        const j = (r * SIDES + k) * 3;
        const nx = N.x * cs + B.x * sn, ny = N.y * cs + B.y * sn, nz = N.z * cs + B.z * sn;
        this.pos[j] = c.x + nx * radius; this.pos[j + 1] = c.y + ny * radius; this.pos[j + 2] = c.z + nz * radius;
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
