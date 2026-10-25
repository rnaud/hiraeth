import * as THREE from 'three';
import { makeMaterial } from './materials.js';

// Foes come out of a cloud of darkness (issue #664, docs/systems/foes.md "Entrances"): a foe called in (the Arena's
// waves and practice, a pack in the wilds, a relic's guards) arrives inside a swirl of ink-outlined dark blobs that
// gather round its spot, the body grows up out of them, and the cloud thins away outward. Until it has thinned
// (ENTRANCE.hold) its mind waits (Foe.update) and it can't be locked or cut; its first wind-up needs its usual cool
// after that, so the earliest telegraph starts once the cloud is gone (ENTRANCE.clear ≤ hold + the foe's first cool).
// One instanced mesh for every cloud (one draw call, ENTRANCE.max blobs, the oldest reused when it is full).
//
//   const C = new FoeClouds(parent); C.add(at, size); C.update(dt); C.dispose()
//   arrival(t) → { body, cloud }   the body's share grown and the cloud's size, t s after the call-in (pure)

export const ENTRANCE = {
  gather: 0.35,     // s the cloud swirls in before the body shows
  grow: 0.55,       // s the body grows up out of it
  clear: 1.5,       // s from the call-in until the cloud is gone
  hold: 1.1,        // s its mind waits (no chase, no wind-up, no lock, no hurt)
  blobs: 14,        // blobs a cloud (× √size)
  max: 160,         // blobs in play at most (the pool)
  swirl: 3.2,       // rad/s round its spot
  tones: ['#14101a', '#231b2e', '#2f2440', '#1b1622'],
};

/** The cloud's size (0..1) t s after the call-in (pure): swells over `gather`, holds while the body grows, thins to 0 by `clear`. */
export function cloudSize(t, E = ENTRANCE) {
  if (t <= 0 || t >= E.clear) return 0;
  if (t < E.gather) return Math.sin((t / E.gather) * Math.PI * 0.5);
  const fadeFrom = E.gather + E.grow * 0.6;
  if (t < fadeFrom) return 1;
  return (1 - (t - fadeFrom) / (E.clear - fadeFrom)) ** 1.4;
}
/** The body's share grown (0..1) t s after the call-in (pure): nothing while the cloud gathers, eased up over `grow`. */
export function bodyGrown(t, E = ENTRANCE) {
  const k = THREE.MathUtils.clamp((t - E.gather) / E.grow, 0, 1);
  return 1 - (1 - k) ** 3;
}
export const arrival = (t, E = ENTRANCE) => ({ body: bodyGrown(t, E), cloud: cloudSize(t, E) });

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), _y = new THREE.Vector3(0, 1, 0);

export class FoeClouds {
  constructor(parent, max = ENTRANCE.max) {
    this.material = makeMaterial({ color: '#ffffff', key: 'foe-entrance-cloud' });
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this.material, max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.name = 'foe entrance clouds';
    this.mesh.userData.noCollide = true; this.mesh.userData.dynamic = true; this.mesh.userData.castShadow = false;
    parent?.add(this.mesh);
    this.max = max; this.list = [];
  }

  /** A cloud at `at` (the foe's feet), `size` m across (the foe's), `height` m tall. */
  add(at, size = 1, height = 1.2) {
    const n = THREE.MathUtils.clamp(Math.round(ENTRANCE.blobs * Math.sqrt(size)), 8, 24), R = Math.max(0.5, size * 0.6);
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) this.list.shift();
      this.list.push({
        at: at.clone(), a: (i / n) * Math.PI * 2 + Math.random() * 0.5, r: R * (0.55 + Math.random() * 0.6),
        y: height * (0.1 + 0.8 * (i % 5) / 4) * (0.8 + Math.random() * 0.3), size: R * (0.35 + Math.random() * 0.3),
        t: -(i % 4) * 0.03, spin: (i % 2 ? 1 : -1) * ENTRANCE.swirl * (0.8 + Math.random() * 0.4), color: ENTRANCE.tones[i % ENTRANCE.tones.length],
      });
    }
  }

  update(dt) {
    if (!this.list.length && !this.mesh.count) return;
    this.list = this.list.filter((b) => (b.t += dt) < ENTRANCE.clear);
    let i = 0;
    for (const b of this.list) {
      if (b.t < 0) continue;
      const k = cloudSize(b.t), out = Math.max(0, b.t - ENTRANCE.gather - ENTRANCE.grow * 0.6);
      // (swirling round its spot: drawn in as it gathers, out and up as it thins)
      const a = b.a + b.spin * b.t, r = b.r * (b.t < ENTRANCE.gather ? 1.5 - 0.5 * k : 1 + out * 1.6);
      _p.set(b.at.x + Math.cos(a) * r, b.at.y + b.y + out * 1.1, b.at.z + Math.sin(a) * r);
      const s = b.size * k;
      _q.setFromAxisAngle(_y, a);
      _m.compose(_p, _q, _s.set(s * 1.3, s, s));
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
