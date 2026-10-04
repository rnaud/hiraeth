import * as THREE from 'three';
import { makeMaterial } from '../materials.js';

// Stylised fire: tongues of flat colour bands that lick, sway and flicker.
// Each tongue is a little lathe whose vertices move every frame; their
// colour runs up a gradient (core → tip) that wavers, and the material
// snaps it to the palette's inks, so the bands stay crisp and flat like a
// printed flame. Ember motes drift up from the tips.

export const FIRE = ['#fff3c4', '#f9d36a', '#f0a04b', '#e0644a', '#b8433f'];
// the burning tree when it drinks: the fire turns cool and many-coloured
export const COOL_FIRE = ['#fff6dc', '#9ff0e6', '#62c3c9', '#a99be0', '#e88fa6'];

const _a = new THREE.Color(), _b = new THREE.Color(), _c = new THREE.Color();
const SEG = 10, RINGS = 9;

function gradient(palette, v, out) {
  const n = palette.length;
  v = Math.min(Math.max(v, 0), 0.9999) * (n - 1);
  const j = Math.floor(v);
  return out.copy(palette[j]).lerp(palette[Math.min(j + 1, n - 1)], v - j);
}

/**
 * A set of flame tongues in one mesh.
 * tongues: [{ at: Vector3 (base, local to `parent`), h, r, phase?, lean?: Vector3, core?: 0..1 }]
 */
export class Flames {
  constructor(parent, tongues, { palette = FIRE, seed = 0 } = {}) {
    this.tongues = tongues.map((t, i) => ({ phase: i * 1.7 + seed, lean: new THREE.Vector3(), core: 0, ...t }));
    const per = (SEG + 1) * (RINGS + 1);
    const n = this.tongues.length * per;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const idx = [];
    this.tongues.forEach((tg, k) => {
      const o = k * per;
      for (let j = 0; j < RINGS; j++) for (let i = 0; i < SEG; i++) {
        const a = o + j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    this.geo = g;
    this.palA = palette.map((c) => new THREE.Color(c));
    this.palB = this.palA.map((c) => c.clone());
    this.pal = this.palA.map((c) => c.clone());
    this.mix = 0;
    this.material = makeMaterial({ color: '#ffffff', glow: 1, flat: true, vertexColors: true, palette, side: THREE.DoubleSide, flames: seed });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.userData.noCollide = true;
    parent.add(this.mesh);
    this.intensity = 1;
    this.update(0, 0);
    // the tongues sway a little: a generous bound once, so the mesh can still be culled
    g.computeBoundingSphere();
    g.boundingSphere.radius *= 1.4;
  }

  /** Move toward another palette over time (setPalette(COOL_FIRE)). */
  setPalette(p, instant = false) {
    this.palA = this.pal.map((c) => c.clone());
    this.palB = p.map((c) => new THREE.Color(c));
    this.mix = instant ? 1 : 0;
  }

  update(dt, t) {
    if (this.mix < 1) {
      this.mix = Math.min(1, this.mix + dt / 3);
      const P = this.material.uniforms.uPalette.value;
      for (let i = 0; i < this.pal.length; i++) { this.pal[i].copy(this.palA[i]).lerp(this.palB[i], this.mix); P[i].copy(this.pal[i]); }
      this.material.uniforms.uPaletteSize.value = this.pal.length;
    }
    const P = this.geo.attributes.position.array, N = this.geo.attributes.normal.array, C = this.geo.attributes.color.array;
    const K = this.intensity;
    let v = 0;
    for (const tg of this.tongues) {
      const ph = tg.phase, R = tg.r * (0.85 + 0.15 * K), H = tg.h * (0.8 + 0.2 * K) * (1 + 0.07 * Math.sin(t * 1.7 + ph) + 0.04 * Math.sin(t * 4.3 + ph * 2));
      const sx = (Math.sin(t * 1.1 + ph) * 0.3 + Math.sin(t * 2.3 + ph * 1.7) * 0.14) * R + tg.lean.x;
      const sz = (Math.cos(t * 0.9 + ph * 1.3) * 0.3 + Math.sin(t * 2.9 + ph * 0.6) * 0.12) * R + tg.lean.z;
      for (let j = 0; j <= RINGS; j++) {
        const s = j / RINGS;
        const prof = s < 0.22 ? Math.sqrt(s / 0.22) : 1 - Math.pow((s - 0.22) / 0.78, 1.25);
        const bend = Math.pow(s, 1.6);
        for (let i = 0; i <= SEG; i++, v++) {
          const a = (i / SEG) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          const lick = 1 + 0.2 * Math.sin(t * 3.1 + a * 2 + s * 7 + ph) * s + 0.08 * Math.sin(t * 6.7 - a * 3 + ph);
          const r = R * prof * lick;
          const o = v * 3;
          P[o] = tg.at.x + ca * r + sx * bend;
          P[o + 1] = tg.at.y + s * H;
          P[o + 2] = tg.at.z + sa * r + sz * bend;
          N[o] = ca; N[o + 1] = 0.3; N[o + 2] = sa;
          // colour: up the gradient, wavering; the inner tongues stay in the hot core
          const w = s * (1 - tg.core * 0.55) + 0.13 * Math.sin(t * 2.4 + a * 3 + ph) + 0.09 * Math.sin(t * 4.1 - s * 9 + ph) - 0.06;
          gradient(this.pal, w, _c);
          C[o] = _c.r; C[o + 1] = _c.g; C[o + 2] = _c.b;
        }
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

/** Glowing motes drifting up from points (the tree's crown, a camp fire). */
export class Embers {
  constructor(parent, sources, { count = 120, color = '#f9d36a', rise = 2.2, life = 5, spread = 1.5, size = 0.12 } = {}) {
    this.sources = sources;
    this.rise = rise; this.life = life; this.spread = spread;
    this.mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(size, 0), makeMaterial({ color, glow: 1, flat: true }), count);
    this.mesh.userData.noCollide = true;
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    this.items = Array.from({ length: count }, (_, i) => this.spawn({ age: Math.random() * life }, i));
    this.dummy = new THREE.Object3D();
    this.rate = 1;
  }
  spawn(it, i) {
    const s = this.sources[i % this.sources.length];
    it.pos = (it.pos ?? new THREE.Vector3()).copy(s).add(new THREE.Vector3((Math.random() - 0.5) * this.spread * 2, Math.random() * this.spread, (Math.random() - 0.5) * this.spread * 2));
    it.vel = (it.vel ?? new THREE.Vector3()).set((Math.random() - 0.5) * 0.6, this.rise * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * 0.6);
    it.age = it.age ?? 0;
    it.max = this.life * (0.6 + Math.random() * 0.8);
    it.ph = Math.random() * 10;
    return it;
  }
  update(dt, t, wind = null) {
    const d = this.dummy;
    this.items.forEach((it, i) => {
      it.age += dt * this.rate;
      if (it.age > it.max) { it.age = 0; this.spawn(it, i); }
      it.pos.addScaledVector(it.vel, dt * this.rate);
      it.pos.x += Math.sin(t * 1.3 + it.ph) * dt * 0.8 + (wind ? wind.x * dt * 0.25 : 0);
      it.pos.z += Math.cos(t * 1.1 + it.ph) * dt * 0.8 + (wind ? wind.z * dt * 0.25 : 0);
      const k = it.age / it.max, s = Math.sin(Math.PI * Math.min(k, 1)) * (0.6 + 0.4 * Math.sin(t * 9 + it.ph));
      d.position.copy(it.pos);
      d.rotation.set(t + it.ph, t * 1.3, 0);
      d.scale.setScalar(Math.max(s, 0.001));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** A thin column of smoke: small pale puffs drifting up and leaning with the wind, thinning as they rise. */
export class Smoke {
  constructor(parent, at, { count = 34, height = 16, size = 0.75, color = '#efe6d6', lean = new THREE.Vector3(1, 0, 0.4) } = {}) {
    this.at = at.clone(); this.height = height; this.size = size; this.lean = lean.clone().normalize();
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), makeMaterial({ color, glow: 0.65, flat: true }), count);
    this.mesh.userData.noCollide = true;
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    this.items = Array.from({ length: count }, (_, i) => ({ u: i / count, ph: Math.random() * 10, s: 0.6 + Math.random() * 0.8, o: (Math.random() - 0.5) * 0.8 }));
    this.dummy = new THREE.Object3D();
    this.update(0, 0);
  }
  update(dt, t, wind = null) {
    const d = this.dummy, H = this.height;
    const lx = wind ? wind.x * 0.4 + this.lean.x : this.lean.x, lz = wind ? wind.z * 0.4 + this.lean.z : this.lean.z;
    this.items.forEach((it, i) => {
      it.u += dt / 11;
      if (it.u > 1) it.u -= 1;
      const u = it.u, y = u * H;
      const sway = Math.sin(t * 0.5 + u * 4 + it.ph * 0.2) * 1.3 * u + it.o * u;
      d.position.set(this.at.x + lx * u * u * H * 0.45 + sway, this.at.y + y, this.at.z + lz * u * u * H * 0.45 + Math.cos(t * 0.45 + u * 3) * 0.9 * u + it.o * u);
      d.scale.set(1.25, 0.8, 1.1).multiplyScalar(this.size * it.s * (0.35 + u * 1.5) * Math.sin(Math.PI * Math.min(u * 1.1, 1)) + 0.001);
      d.rotation.set(it.ph, t * 0.1 + it.ph, 0);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
