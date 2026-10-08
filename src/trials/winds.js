import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerWorking } from '../workings.js';

// A column of rising air out in a world (a mastery trial's: src/trials/data.js `winds`), the temples' Updraft
// (src/temples/pieces.js) on the open ground: pale rings drift up it, a ring of the makers' stone marks its
// foot. Open wings in it and you are lifted toward its middle, slowed, and let go near its top. It is a
// working (src/workings.js), so a foe knocked or flying into it is thrown up too (src/foes.js).
//
//   const w = new WindColumn(scene, { foot: Vector3, r, h, lift })
//   w.update(dt, t, player)      per frame
//   w.dispose()

let mats = null;
const windMats = () => (mats ??= {
  ring: makeMaterial({ color: '#f4f8f6', glow: 0.35, flat: true }),
  stone: makeMaterial({ color: '#d9cba9', color2: '#c9b892', color3: '#b5a17a' }),
  blue: makeMaterial({ color: '#3d6fa8', flat: true }),
});

/** How fast open wings rise in a column at height y (0 above its top, `lift` low down): pure. */
export function windLift(lift, foot, h, y) {
  const top = foot + h;
  return lift * THREE.MathUtils.clamp((top - y) / 3, 0, 1);
}

export class WindColumn {
  constructor(scene, { foot, r = 6, h = 40, lift = 8 }) {
    this.foot = foot.clone(); this.r = r; this.h = h; this.lift = lift;
    this.top = this.foot.y + h;
    const M = windMats();
    this.root = new THREE.Group();
    this.root.name = 'Wind column';
    const N = Math.max(6, Math.round(h / 3));
    const g = new THREE.TorusGeometry(r * 0.75, 0.08, 4, 32).rotateX(Math.PI / 2);
    this.rings = [];
    for (let i = 0; i < N; i++) { const m = new THREE.Mesh(g, M.ring); this.root.add(m); this.rings.push({ m, s: i / N, w: 0.6 + (i % 3) * 0.2 }); }
    const base = new THREE.Mesh(new THREE.TorusGeometry(r + 0.1, 0.35, 6, 40).rotateX(Math.PI / 2), M.stone);
    base.position.copy(this.foot).add(new THREE.Vector3(0, 0.12, 0));
    const band = new THREE.Mesh(new THREE.TorusGeometry(r + 0.1, 0.12, 4, 40).rotateX(Math.PI / 2), M.blue);
    band.position.copy(base.position).add(new THREE.Vector3(0, 0.3, 0));
    this.root.add(base, band);
    this.root.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
    scene?.add(this.root);
    this.off = registerWorking({ kind: 'updraft', foot: this.foot, r, top: this.top, lift, contains: (p) => this.contains(p) });
  }
  /** Is p (feet) in the column? */
  contains(p) { return Math.hypot(p.x - this.foot.x, p.z - this.foot.z) < this.r && p.y > this.foot.y - 1 && p.y < this.top; }
  update(dt, t, P) {
    for (const r of this.rings) {
      r.s = (r.s + dt * 0.09) % 1;
      r.m.position.set(this.foot.x, this.foot.y + 0.5 + r.s * this.h, this.foot.z);
      const fade = Math.min(1, r.s * 8, (1 - r.s) * 6);
      r.m.scale.setScalar(Math.max(0.01, fade * (r.w + 0.08 * Math.sin(t * 2 + r.s * 20))));
      r.m.rotation.y = t * 0.4 + r.s * 3;
    }
    if (!P || P.dead || P.down || P.ride || !P.gliding || !this.contains(P.pos)) return false;
    // the wings catch it: up, toward its middle, slowly; near its top it eases and lets you go
    const want = windLift(this.lift, this.foot.y, this.h, P.pos.y);
    P.vel.y = Math.max(P.vel.y, want * 0.5) + (want - P.vel.y) * Math.min(1, dt * 3);
    if (want > this.lift * 0.5) {
      P.glideSpeed = Math.min(P.glideSpeed ?? 7, 7);
      const c = Math.min(1, dt * 1.2);
      P.pos.x += (this.foot.x - P.pos.x) * c; P.pos.z += (this.foot.z - P.pos.z) * c;
    }
    return true;
  }
  dispose() { this.off?.(); this.root.removeFromParent(); }
}
