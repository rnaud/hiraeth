import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { mulberry32 } from './noise.js';

// The Moon Foundry's steam and smoke (issue #731: the foundry closed in, "with more mood and steam"; docs/systems/worlds.md
// "The Moon Foundry, closed in"). Vents low on the walls and by the furnaces breathe steam, the wall furnaces' hoods and the
// last furnace's mouth roll smoke, valves on the pillars and the dock's walls hiss out a puff now and then, and the
// cooling moulds and the night pour's runnels steam. Every blob is one instance of ONE pooled mesh (one draw call, STEAM.max
// blobs at most), ink-outlined pastel puffs as a defeated foe's (src/smoke-puff.js), coloured by what breathes them: the
// steam a pale warm grey, the smoke a darker umber, both warmed from under by the furnace light.
//
// Cheap on purpose: only the STEAM.active vents nearest the camera breathe (chosen again every STEAM.choose s), a full
// pool skips a puff rather than stealing a live blob (nothing pops), and no rng runs per frame (each vent its own seeded
// sequence). The Handheld runs the same pool: 360 blobs of 80 triangles.
//
//   const S = new FoundrySteam(scene, VENTS); S.update(dt, t, eye); S.live; S.dispose()

export const STEAM = {
  max: 360,           // blobs in play at most (the pool)
  active: 12,         // vents breathing at once (the nearest)
  reach: 150,         // m: a vent further from the camera than this is still
  choose: 0.5,        // s between choosing the nearest vents
};

/** The kinds of breath: blobs a second, blob size (m), life (s), rise (m/s), spread (m/s sideways), tones. */
export const BREATHS = {
  vent: { rate: 7, size: [0.25, 0.5], life: [3.5, 5.5], rise: 2.8, spread: 0.25, tones: ['#efe7da', '#e0d6c6', '#f7efe2'] },
  smoke: { rate: 5, size: [0.4, 0.75], life: [6, 9], rise: 3.2, spread: 0.25, tones: ['#8e7a6c', '#a28c7e', '#7a685e'] },
  hiss: { rate: 0, burst: 9, every: [4, 9], size: [0.25, 0.5], life: [1.2, 2], rise: 0.8, spread: 2.8, tones: ['#fbf5ea', '#ece4d6'] },
  mould: { rate: 2.5, size: [0.3, 0.55], life: [2.5, 4], rise: 1.1, spread: 0.2, tones: ['#f2eadc', '#e2d8c8'] },
};

/** A blob's scale over its life (pure: tests): it swells as it rises and thins away at the end. */
export function steamScale(k) {
  if (k <= 0 || k >= 1) return 0;
  const grow = 0.45 + 0.55 * Math.min(1, k / 0.5) ** 0.7;
  return grow * (k < 0.7 ? 1 : 1 - ((k - 0.7) / 0.3) ** 2);
}

/**
 * The nearest `n` vents to `eye` within `reach` (pure: tests): their indices, nearest first.
 * @param {{ x: number, y: number, z: number }[]} vents
 */
export function nearestVents(vents, eye, n = STEAM.active, reach = STEAM.reach) {
  const r2 = reach * reach, out = [];
  for (let i = 0; i < vents.length; i++) {
    const v = vents[i], d = (v.x - eye.x) ** 2 + (v.y - eye.y) ** 2 + (v.z - eye.z) ** 2;
    if (d < r2) out.push([i, d]);
  }
  return out.sort((a, b) => a[1] - b[1]).slice(0, n).map(([i]) => i);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _y = new THREE.Vector3(0, 1, 0);

export class FoundrySteam {
  /**
   * @param parent  the scene
   * @param vents   [{ x, y, z, kind: 'vent' | 'smoke' | 'hiss' | 'mould', dir?: [x, y, z] (the way it blows; up if not given), k?: its rate × }]
   */
  constructor(parent, vents, { max = STEAM.max } = {}) {
    this.vents = vents.map((v, i) => ({ ...v, b: BREATHS[v.kind] ?? BREATHS.vent, rng: mulberry32(7310 + i), acc: 0, next: 0,
      dir: new THREE.Vector3(...(v.dir ?? [0, 1, 0])).normalize() }));
    for (const v of this.vents) v.next = v.b.every ? v.b.every[0] + v.rng() * (v.b.every[1] - v.b.every[0]) : 0;
    this.material = makeMaterial({ color: '#ffffff', key: 'foundry-steam', flat: true, glow: 0.65 });
    const geo = new THREE.IcosahedronGeometry(1, 1);
    geo.deleteAttribute('uv');
    this.mesh = new THREE.InstancedMesh(geo, this.material, max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.name = 'the foundry’s steam';
    this.mesh.userData.noCollide = true; this.mesh.userData.dynamic = true;
    parent?.add(this.mesh);
    this.max = max; this.list = []; this.on = []; this._chooseT = 0;
  }

  /** One vent's blob (its own rng: the same vent breathes the same way every time). */
  _emit(v, n = 1) {
    const b = v.b, r = v.rng;
    for (let i = 0; i < n && this.list.length < this.max; i++) {
      const side = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.3, r() - 0.5).multiplyScalar(2 * b.spread);
      this.list.push({
        pos: new THREE.Vector3(v.x + (r() - 0.5) * 0.4, v.y, v.z + (r() - 0.5) * 0.4),
        vel: v.dir.clone().multiplyScalar(b.rise * (0.7 + 0.6 * r()) * (v.kind === 'hiss' ? 2.4 : 1)).add(side),
        size: (b.size[0] + r() * (b.size[1] - b.size[0])) * (v.size ?? 1),
        age: 0, life: b.life[0] + r() * (b.life[1] - b.life[0]), spin: r() * Math.PI * 2,
        color: b.tones[Math.floor(r() * b.tones.length)],
      });
    }
  }

  /**
   * Per frame. `eye`: the camera's position (the nearest vents breathe). Returns the blobs in play.
   * @param {number} dt
   * @param {number} t
   * @param {THREE.Vector3} eye
   */
  update(dt, t, eye) {
    dt = Math.min(dt, 0.1);
    if ((this._chooseT -= dt) <= 0 && eye) { this._chooseT = STEAM.choose; this.on = nearestVents(this.vents, eye); }
    for (const i of this.on) {
      const v = this.vents[i], b = v.b;
      if (b.rate) {
        v.acc += dt * b.rate * (v.k ?? 1);
        const n = Math.floor(v.acc); v.acc -= n;
        if (n) this._emit(v, n);
      }
      if (b.every && (v.next -= dt) <= 0) { this._emit(v, b.burst); v.next = b.every[0] + v.rng() * (b.every[1] - b.every[0]); }
    }
    let w = 0;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if ((p.age += dt) >= p.life) continue;
      this.list[w++] = p;
      // (the breath slows as it spreads, the rise kept a little longer: it climbs and stalls, as warm air under a roof)
      p.vel.x *= Math.exp(-1.6 * dt); p.vel.z *= Math.exp(-1.6 * dt); p.vel.y *= Math.exp(-0.5 * dt);
      p.pos.addScaledVector(p.vel, dt);
      p.pos.x += Math.sin(t * 0.3 + p.spin) * 0.12 * dt;   // (a slow drift through the hall)
    }
    this.list.length = w;
    let k = 0;
    for (const p of this.list) {
      const s = p.size * steamScale(p.age / p.life) * (1 + p.age * 0.55);
      _q.setFromAxisAngle(_y, p.spin + p.age * 0.2);
      _m.compose(p.pos, _q, _s.set(s, s * 0.8, s));
      this.mesh.setMatrixAt(k, _m);
      this.mesh.setColorAt(k, _c.set(p.color));
      k++;
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    return k;
  }

  /** Blobs in play (tests). */
  get live() { return this.list.length; }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); }
}
