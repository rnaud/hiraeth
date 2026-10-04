import * as THREE from 'three';
import { makeMaterial } from '../materials.js';

// Puffs: smoke, dust and flame as inked balls that swell and shrink away
// (the G-buffer has no transparency, so they fade by size). One instanced
// mesh per kind, a fixed pool, recycled oldest first.

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();

export class Puffs {
  constructor(scene, { count = 96, glow = 0, tag = 'puffs', detail = 2, noShadow } = {}) {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, detail), makeMaterial({ color: '#ffffff', glow, tag }), count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.userData.noCollide = true;
    this.mesh.userData.dynamic = true;
    this.mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, _c.set('#ffffff'));
    this.items = Array.from({ length: count }, () => ({ life: 0, age: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: 1, spin: 0, rot: new THREE.Euler() }));
    this.next = 0;
    this.live = 0;
    this.drag = 0.6;
    this.lift = 0;
    this.hideAll();
    scene.add(this.mesh);
    noShadow?.push(this.mesh);
  }

  hideAll() {
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < this.items.length; i++) { this.mesh.setMatrixAt(i, _m); this.items[i].age = this.items[i].life = 0; }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  emit(pos, vel, size, life, color) {
    const i = this.next;
    this.next = (this.next + 1) % this.items.length;
    const p = this.items[i];
    p.pos.copy(pos); p.vel.copy(vel); p.size = size; p.life = life; p.age = 0;
    p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    p.spin = (Math.random() - 0.5) * 1.5;
    this.mesh.setColorAt(i, _c.set(color));
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i];
      if (p.age >= p.life) continue;
      p.age += dt;
      const k = Math.min(p.age / p.life, 1);
      p.vel.multiplyScalar(Math.exp(-this.drag * dt));
      p.vel.y += this.lift * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += p.spin * dt;
      // swell quickly, linger, then shrink to nothing
      const s = k >= 1 ? 0 : p.size * Math.min(1, k * 6 + 0.25) * (1 + k * 1.4) * (1 - Math.pow(k, 3));
      _m.compose(p.pos, _q.setFromEuler(p.rot), _s.set(s, s * 0.85, s));
      this.mesh.setMatrixAt(i, _m);
      any = true;
    }
    if (any || this._wasAny) this.mesh.instanceMatrix.needsUpdate = true;
    this._wasAny = any;
  }

  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); }
}
