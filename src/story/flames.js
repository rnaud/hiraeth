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
    this.mix = 0; this.snap = instant;   // instant: the next update lands on the new palette at once
  }

  update(dt, t) {
    if (this.mix < 1) {
      this.mix = this.snap ? 1 : Math.min(1, this.mix + dt / 3);
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
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), makeMaterial({ color, glow: 0.8, flat: true }), count);
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

// The burning tree's landmark smoke: pale, slightly warm greys by day; when the
// tree drinks, the pale cool tints of its new fire.
export const SMOKE_WARM = ['#f5efe3', '#ece4d5', '#e2d9c8', '#d8cebd'];
export const SMOKE_COOL = ['#f2f8f2', '#d9f1ee', '#cfe6ee', '#e3dcf5', '#f6e1ea', '#fff4e2'];

const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const RISE = 0.62;   // the share of the path that climbs; the rest is the drifting plume
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

/**
 * A landmark: a tall column of light smoke rising hundreds of metres from a
 * fire, bending gently downwind and flattening into a long thin drifting
 * plume at altitude, so the fire can be found from anywhere on the plain.
 *
 * One instanced mesh of inked puffs. Each puff runs along the column's path
 * (s = 0 at the fire, 1 at the end of the plume), swelling as it rises and
 * shrinking away at the end (the G-buffer has no transparency, so smoke fades
 * by size). The path is a function of the (smoothed) wind, so nothing is
 * rebuilt per frame: only the instance matrices (and, while the colours
 * change, the instance colours) are written.
 *
 * Far shading: the column's material writes a compressed view depth into the
 * G-buffer past `farNear` metres, so the distance fog and the line fade
 * (post.js) treat it as if it stood a few hundred metres away and it stays
 * readable from kilometres off. The real depth buffer is untouched, so it
 * still hides behind dunes and walls.
 */
export class SmokeColumn {
  constructor(parent, at, { count = 230, height = 430, drift = 520, base = 3, top = 22, period = 170, palette = SMOKE_WARM, tint = FIRE[1], farNear = 260, farScale = 0.2, glow = 0.36 } = {}) {
    this.at = at.clone();
    this.height = height; this.drift = drift; this.base = base; this.top = top; this.period = period;
    const mat = makeMaterial({ color: '#ffffff', glow, tag: 'smoke-column' });
    if (!mat.uniforms.uFarScale) {
      const fs = mat.fragmentShader;
      const patched = fs.replace('void main() {', 'uniform float uFarNear;\n  uniform float uFarScale;\n  void main() {')
        .replace('gNormalDepth = vec4(n, vViewDepth);', 'gNormalDepth = vec4(n, vViewDepth < uFarNear ? vViewDepth : uFarNear + (vViewDepth - uFarNear) * uFarScale);');
      mat.userData.farDepth = patched.includes('(vViewDepth - uFarNear) * uFarScale') && patched.includes('uniform float uFarScale;');
      if (mat.userData.farDepth) mat.fragmentShader = patched;
      else console.warn('SmokeColumn: the far-shading patch no longer matches materials.js; the column will fog like the rest');
      mat.uniforms.uFarNear = { value: farNear };
      mat.uniforms.uFarScale = { value: farScale };
    }
    this.material = mat;
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), mat, count);
    this.mesh.name = 'Smoke column';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.userData.noCollide = true;
    this.mesh.userData.dynamic = true;
    this.mesh.frustumCulled = false;   // it spans half a kilometre; desert-city.js skips its update when it's out of view
    this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    parent.add(this.mesh);
    // u: how far along the path (0..1, advancing with time); tone: which smoke colour; oa/ob/oc: scatter round the path
    // The fire breathes the smoke out in billows of PER puffs (one big, the rest smaller and further out):
    // near the fire they rise apart with sky between them, aloft they swell and merge into one line.
    const PER = 5, billows = Math.ceil(count / PER);
    this.items = Array.from({ length: count }, (_, i) => {
      const b = Math.floor(i / PER), k = i % PER;
      return {
        u: (b + Math.random() * 0.3) / billows + k * 0.0025, tone: Math.random(),
        size: k === 0 ? 1.05 + Math.random() * 0.3 : 0.45 + Math.random() * 0.5, spread: k === 0 ? 0.35 : 1.25,
        oa: (Math.random() - 0.5) * 2, ob: (Math.random() - 0.5) * 2, oc: (Math.random() - 0.5) * 2, ph: Math.random() * 10,
      };
    });
    // the wind: a direction on the ground and a gentle strength, eased slowly so the column swings like a real one
    this.wind = new THREE.Vector3(0.83, 0, 0.56);
    this.windK = 1;
    this.palA = palette.map((c) => new THREE.Color(c));
    this.palB = this.palA;
    this.mixT = Infinity;
    // the fire lights the smoke just above it (and, at night, that is the part that glows)
    this.tint = new THREE.Color(tint);
    for (const it of this.items) it.c = new THREE.Color();
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, _a.copy(this.palA[0]));
    this.colour();
    this.update(0, 0);
  }

  /** The column's centre line at s (0 = the fire, 1 = the end of the plume), into out. */
  pathAt(s, out, t = 0) {
    const wx = this.wind.x, wz = this.wind.z, H = this.height, k = this.windK;
    let y, d;
    if (s < RISE) {
      // the column: straight up, leaning a little downwind as it goes
      const q = s / RISE;
      y = H * 0.9 * q * (1 - 0.12 * q) / 0.88;
      d = H * 0.14 * k * q * q;
    } else {
      // the plume: it meets the still air aloft, levels off and drifts away downwind in a long thin line
      const r = (s - RISE) / (1 - RISE);
      y = H * (0.9 + 0.1 * (1 - Math.pow(1 - r, 3)));
      d = H * 0.14 * k + this.drift * k * (0.35 * r + 0.65 * r * r) + H * 0.05 * Math.sin(Math.min(r * 4, 1) * Math.PI / 2);
    }
    // a slow meander across the wind, growing with height
    const m = (Math.sin(s * 5.5 + t * 0.03) * 9 + Math.sin(s * 13 + t * 0.05 + 1.3) * 3) * s;
    return out.set(this.at.x + wx * d - wz * m, this.at.y + y, this.at.z + wz * d + wx * m);
  }

  /**
   * Move toward another set of smoke colours and fire tint (setPalette(SMOKE_COOL, false, COOL_FIRE[1]));
   * the change rises up the column from the fire.
   */
  setPalette(p, instant = false, tint = null) {
    this.palA = this.palB;
    this.palB = p.map((c) => new THREE.Color(c));
    this.tintA = this.tint.clone();
    this.tintB = new THREE.Color(tint ?? this.tint);
    this.mixT = instant ? Infinity : 0;
    if (instant) { this.palA = this.palB; this.tint.copy(this.tintB); }
    this.colour();
  }

  /** Each puff's own smoke colour (only while the colours change). */
  colour() {
    const A = this.palA, B = this.palB;
    for (const it of this.items) {
      gradient(A, it.tone, it.c);
      // the smoke nearest the fire changes first, the plume aloft last
      if (A !== B) it.c.lerp(gradient(B, it.tone, _b), smooth(0, 1, (this.mixT - it.u * 24) / 5));
    }
    if (this.tintB && A !== B) this.tint.copy(this.tintA).lerp(this.tintB, smooth(0, 4, this.mixT));
  }

  update(dt, t, wind = null) {
    if (wind && (wind.x || wind.z)) {
      const l = Math.hypot(wind.x, wind.z), e = 1 - Math.exp(-dt / 25);
      this.wind.lerp(_p.set(wind.x / l, 0, wind.z / l), e).normalize();
      this.windK += (Math.min(Math.max(0.55 + 0.45 * l / 2.5, 0.5), 1.5) - this.windK) * e;
    }
    if (this.mixT < 30) {
      this.mixT += dt;
      if (this.mixT >= 30) this.palA = this.palB;
      this.colour();
    }
    const yaw = Math.atan2(this.wind.x, this.wind.z), cy = Math.cos(yaw), sy = Math.sin(yaw);
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      it.u += dt / this.period;
      if (it.u >= 1) { it.u -= Math.floor(it.u); it.oa = (Math.random() - 0.5) * 2; it.ob = (Math.random() - 0.5) * 2; }
      const s = 1 - Math.pow(1 - it.u, 1.35);   // quick off the fire, slowing aloft
      this.pathAt(s, _p, t);
      // the column widens as it rises; the plume flattens and stretches along the wind, then thins away
      const pr = s < RISE ? 0 : (s - RISE) / (1 - RISE), pl = smooth(0, 0.3, pr);
      const r = it.size * smooth(0, 0.02, s) * (s < RISE ? this.base + (this.top - this.base) * Math.pow(s / RISE, 1.1) : this.top * (1 - 0.6 * pr)) * (1 - smooth(0.72, 1, pr));
      // scatter round the centre line: little near the fire, more aloft (the column frays), widest in the plume
      const sc = r * (0.5 + 0.5 * Math.min(s / RISE, 1) + 0.6 * pl), sw = Math.sin(t * 0.21 + it.ph + s * 9) * r * 0.25;
      const across = it.oa * sc * it.spread + sw, along = it.ob * sc * it.spread * 0.6;
      _p.x += across * cy + along * sy;
      _p.z += -across * sy + along * cy;
      _p.y += it.oc * sc * it.spread * (0.45 - 0.35 * pl);
      _s.set(r * (1 - 0.1 * pl), r * (0.85 - 0.5 * pl), r * (1 + 1.6 * pl));
      _q.setFromEuler(_e.set(it.ph * 0.3 * (1 - pl), yaw + it.oc * 0.25, it.ob * 0.2));
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      this.mesh.setColorAt(i, _a.copy(it.c).lerp(this.tint, 0.5 * (1 - smooth(0.01, 0.13, s))));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}
