import * as THREE from 'three';
import { makeMaterial } from './materials.js';

// The little puff of smoke a defeated foe goes out in (docs/systems/foes.md "Hit and defeat"; v1.39): about a second after
// its defeat has run (src/enemies/defeat.js, Foes.burst), the body shrinks away inside a small cloud of ink-outlined pastel
// blobs (cream, lavender, a pale tone of its own) that swell, rise and thin out, and the foe is removed. One instanced mesh
// for every puff in play (one draw call, SMOKE.max blobs, the oldest reused when it is full); nothing made per puff.
//
//   const P = new SmokePuffs(scene); P.add(at, size, tones); P.update(dt); P.dispose()

export const SMOKE = {
  linger: 1.0,                  // s a defeated foe lies after its defeat before it goes up in smoke
  fade: 0.35,                   // s the body shrinks away inside the cloud
  life: [0.7, 1.05],            // s a blob lasts
  blobs: 7,                     // blobs a puff (× its size, 5..11)
  max: 96,                      // blobs in play at most (the pool)
  rise: 0.9,                    // m/s up
  tones: ['#f7ecd2', '#d9cdee', '#cfe6e0', '#f2d7cf'],   // cream, lavender, a pale teal, a blush
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _p = new THREE.Vector3(), _w = new THREE.Color('#ffffff');

/** A blob's radius over its life (pure: tests): swells fast to its size, thins away at the end. */
export function blobScale(k) {
  if (k <= 0 || k >= 1) return 0;
  return Math.min(1, k / 0.25) ** 0.6 * (k < 0.6 ? 1 : 1 - ((k - 0.6) / 0.4) ** 2);
}

export class SmokePuffs {
  constructor(parent, max = SMOKE.max) {
    this.material = makeMaterial({ color: '#ffffff', key: 'smoke-puff' });
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this.material, max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.name = 'smoke puffs';
    this.mesh.userData.noCollide = true; this.mesh.userData.dynamic = true;
    parent?.add(this.mesh);
    this.max = max; this.list = [];
  }

  /** A puff at `at` (the body's middle), `size` m across (the foe's), its own `tones` lightened into the pastel ones. */
  add(at, size = 1, tones = null) {
    const n = THREE.MathUtils.clamp(Math.round(SMOKE.blobs * Math.sqrt(size)), 5, 11), r = Math.max(0.25, size * 0.45);
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6, d = r * (0.35 + Math.random() * 0.65);
      const own = tones?.length && i % 3 === 2 ? _c.set(tones[i % tones.length]).lerp(_w, 0.55).getHexString() : null;
      this.list.push({
        pos: new THREE.Vector3(at.x + Math.cos(a) * d, at.y + (Math.random() - 0.3) * r, at.z + Math.sin(a) * d),
        vel: new THREE.Vector3(Math.cos(a) * 0.7, SMOKE.rise * (0.6 + Math.random() * 0.8), Math.sin(a) * 0.7),
        size: r * (0.45 + Math.random() * 0.35), age: -i * 0.025, life: SMOKE.life[0] + Math.random() * (SMOKE.life[1] - SMOKE.life[0]),
        color: own ? `#${own}` : SMOKE.tones[i % SMOKE.tones.length], spin: Math.random() * Math.PI,
      });
    }
  }

  /** Per frame (the world's step). */
  update(dt) {
    if (!this.list.length && !this.mesh.count) return;
    this.list = this.list.filter((b) => (b.age += dt) < b.life);
    let i = 0;
    for (const b of this.list) {
      if (b.age < 0) continue;
      b.vel.multiplyScalar(Math.exp(-2.2 * dt));
      b.pos.addScaledVector(b.vel, dt);
      const s = b.size * blobScale(b.age / b.life);
      _q.setFromAxisAngle(_p.set(0, 1, 0), b.spin + b.age);
      _m.compose(b.pos, _q, _s.set(s, s * 0.85, s));
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, _c.set(b.color));
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  /** Blobs in play (tests). */
  get live() { return this.list.length; }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); }
}
