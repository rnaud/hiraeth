import * as THREE from 'three';
import { makeMaterial } from '../materials.js';

// Little bursts of flat-coloured blobs: chimney smoke, sand pouring off a
// wheel, petals, the rings round a listening sphere. One instanced mesh per
// colour; only live puffs are drawn (mesh.count), so an idle system costs a
// draw of nothing.
//
//   const smoke = new Puffs(scene, { color: '#efe6d6', max: 64 });
//   smoke.burst(at, { n: 4, rise: 2.5, size: 1.4, spread: 0.6, life: 3 });
//   smoke.update(dt, wind?)

export class Puffs {
  constructor(parent, { color = '#efe6d6', max = 64, glow = 0.8, detail = 1, flat = true } = {}) {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, detail), makeMaterial({ color, glow, flat }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.userData.noCollide = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;   // nothing to draw until the first burst
    parent.add(this.mesh);
    this.items = [];
    this.max = max;
    this.dummy = new THREE.Object3D();
  }
  /** n puffs at `at`, drifting up (rise m/s) and out (spread m/s), growing to `size`. */
  burst(at, { n = 3, rise = 2, size = 1, spread = 0.5, life = 3, dir = null, gravity = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      if (this.items.length >= this.max) this.items.shift();
      const v = new THREE.Vector3((Math.random() - 0.5) * 2 * spread, rise * (0.7 + Math.random() * 0.6), (Math.random() - 0.5) * 2 * spread);
      if (dir) v.addScaledVector(dir, 1);
      this.items.push({ p: at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.3, (Math.random() - 0.5) * 0.4)), v, age: -i * 0.12, life: life * (0.8 + Math.random() * 0.4), size: size * (0.7 + Math.random() * 0.6), ph: Math.random() * 6, gravity });
    }
  }
  get active() { return this.items.length > 0; }
  update(dt, wind = null) {
    if (!this.items.length) { this.mesh.count = 0; this.mesh.visible = false; return; }
    const d = this.dummy;
    let n = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      if (it.age > it.life) { this.items.splice(i, 1); continue; }
      if (it.age < 0) continue;
      it.v.y -= it.gravity * dt;
      it.p.addScaledVector(it.v, dt);
      if (wind) { it.p.x += wind.x * dt * 0.3; it.p.z += wind.z * dt * 0.3; }
      it.v.multiplyScalar(1 - dt * 0.25);
      const k = it.age / it.life, s = it.size * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (0.5 + k);
      d.position.copy(it.p);
      d.rotation.set(it.ph, it.ph + it.age * 0.3, 0);
      d.scale.set(s * 1.2, s * 0.85, s);
      d.updateMatrix();
      this.mesh.setMatrixAt(n++, d.matrix);
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** A material of its own (so one object can glow or recolour without touching the shared, cached one). */
export function ownMaterial(o) {
  const base = makeMaterial(o);
  const m = base.clone();
  m.uniforms = { ...base.uniforms, uColor: { value: new THREE.Color(o.color) }, uGlow: { value: o.glow ?? 0 } };
  return m;
}
