import * as THREE from 'three';
import { makeMaterial, MODE_RIBBON } from './materials.js';

// The hover trail: a big colourful tube streaming out of the back of the
// vehicle along the path it took. It swells as it leaves the exhaust, then
// tapers to nothing at the tail. Real geometry in the inked G-buffer, so it
// gets outlines and shading; flat colour bands are fixed along the path.

const RINGS = 140;      // path samples
const SIDES = 12;

export class Trail {
  constructor(scene) {
    this.samples = [];          // { p, t, d }
    this.time = 0;
    this.acc = 0;
    this.dist = 0;
    this.life = 3.6;
    const nV = RINGS * SIDES;
    this.pos = new Float32Array(nV * 3);
    this.nrm = new Float32Array(nV * 3);
    this.fold = new Float32Array(nV * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aFold', new THREE.BufferAttribute(this.fold, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let r = 0; r < RINGS - 1; r++)
      for (let k = 0; k < SIDES; k++) {
        const a = r * SIDES + k, b = r * SIDES + ((k + 1) % SIDES), c = a + SIDES, d = b + SIDES;
        idx.push(a, c, b, b, c, d);
      }
    g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, makeMaterial({ color: '#ffffff', mode: MODE_RIBBON, glow: 0.35 }));
    this.mesh.frustumCulled = false;
    this.mesh.userData.noCollide = true;
    scene.add(this.mesh);
    this._t = new THREE.Vector3(); this._n = new THREE.Vector3(); this._b = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }

  /** @param exhaust world point at the back of the vehicle, or null when not laying a trail */
  update(dt, exhaust) {
    this.time += dt;
    this.acc += dt;
    if (exhaust && this.acc > 0.025) {
      const last = this.samples[this.samples.length - 1];
      const step = last ? last.p.distanceTo(exhaust) : 1;
      if (step > 0.35) {
        this.dist += last ? step : 0;
        this.samples.push({ p: exhaust.clone(), t: this.time, d: this.dist });
        if (this.samples.length > RINGS) this.samples.shift();
      }
      this.acc = 0;
    }
    while (this.samples.length && this.time - this.samples[0].t > this.life) this.samples.shift();
    // newest sample first, so ring 0 sits at the exhaust
    const S = this.samples, n = S.length;
    const T = this._t, N = this._n, B = this._b;
    for (let r = 0; r < RINGS; r++) {
      const i = n - 1 - Math.min(r, n - 1);
      const s = S[i];
      let radius = 0;
      if (s && r < n) {
        const age = Math.min((this.time - s.t) / this.life, 1);
        // swells out of the exhaust, tapers at the tail; a gentle pulse along it
        radius = (0.38 + 1.25 * Math.sqrt(Math.min(age * 2.2, 1))) * (1 - THREE.MathUtils.smoothstep(age, 0.55, 1)) *
          (1 + 0.12 * Math.sin(s.d * 0.35 - this.time * 3));
        if (r === n - 1 || r === 0) radius *= r === 0 ? 0.6 : 0;
      }
      // tangent from neighbours
      const a = S[Math.min(i + 1, n - 1)] ?? s, b = S[Math.max(i - 1, 0)] ?? s;
      if (s) T.subVectors(a.p, b.p); else T.set(0, 0, 1);
      if (T.lengthSq() < 1e-8) T.set(0, 0, 1);
      T.normalize();
      N.crossVectors(T, this._up); if (N.lengthSq() < 1e-6) N.set(1, 0, 0); N.normalize();
      B.crossVectors(N, T).normalize();
      const c = s ? s.p : (S[n - 1]?.p ?? T.set(0, -1e4, 0));
      for (let k = 0; k < SIDES; k++) {
        const th = (k / SIDES) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
        const j = (r * SIDES + k) * 3;
        const nx = N.x * cs + B.x * sn, ny = N.y * cs + B.y * sn, nz = N.z * cs + B.z * sn;
        this.pos[j] = c.x + nx * radius; this.pos[j + 1] = c.y + ny * radius; this.pos[j + 2] = c.z + nz * radius;
        this.nrm[j] = nx; this.nrm[j + 1] = ny; this.nrm[j + 2] = nz;
        const f = (r * SIDES + k) * 2;
        this.fold[f] = s ? s.d / 7.0 : 0;     // a colour band every 7 m of path
        this.fold[f + 1] = k / SIDES;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.attributes.aFold.needsUpdate = true;
    this.geo.computeBoundingSphere();
    this.mesh.visible = n > 2;
  }
}
