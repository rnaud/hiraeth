import * as THREE from 'three';

// Limp legs (issue #750, the kit's equivalent of the humanoid foes' ragdoll: docs/systems/procedural-animation.md, "Limp
// legs"): a foe on the locomotion kit struck down lets its feet go. Each foot is a point with a speed (the blow's shove
// at first), falling under gravity onto the ground under it (one read a frame while it moves; it slides to a stop on the
// ground), and held within its leg's reach of its hip as the body goes over (the defeat's recipe still tips, rolls or
// flips the body: src/enemies/defeat.js): pulled along, dragged over the ground, hanging off a body rolled onto its
// back. The rig's IK then bends each leg between its hip and that point, as it does a planted foot (Rig.write).
// Deterministic (no clock, no random); asleep (no reads) once every foot lies still on the ground.

export const LIMP = {
  gravity: 14,     // m/s²
  drag: 0.6,       // in the air (1/s)
  slide: 7,        // on the ground: sliding dies away at this rate (1/s)...
  grip: 2.5,       // ...and loses at least this much speed (m/s²): a slow drag stops
  reach: 0.98,     // of the leg's full length: as far as a foot hangs from its hip
  still: 0.05,     // m/s: slower than this...
  stillFor: 0.3,   // ...this long, every foot on the ground: asleep
};

const _d = new THREE.Vector3();

export class LimpLegs {
  /** feet: each foot's spot now (world); vel: the speed they start with (a Vector3, or one per foot). */
  constructor(feet, vel) {
    this.x = feet.map((p) => p.clone());
    this.v = feet.map((_, i) => (Array.isArray(vel) ? vel[i] : vel ?? new THREE.Vector3()).clone());
    this.on = feet.map(() => false);
    this.floor = Math.min(...feet.map((p) => p.y));   // (no ground to read: where they stood)
    this.stillT = 0; this.asleep = false; this.reads = 0;
  }

  /** One frame: gravity, drag, the ground under each foot (ground(x, fromY, z) → its height or null). */
  step(dt, ground = null) {
    if (this.asleep || !(dt > 0)) return;
    let fastest = 0;
    for (let i = 0; i < this.x.length; i++) {
      const x = this.x[i], v = this.v[i];
      v.y -= LIMP.gravity * dt;
      v.multiplyScalar(Math.exp(-LIMP.drag * dt));
      x.addScaledVector(v, dt);
      const g = ground ? ground(x.x, x.y + 1, x.z) : null;
      if (ground) this.reads++;
      const floor = g ?? this.floor;
      this.on[i] = x.y <= floor + 1e-3;
      if (this.on[i]) {
        x.y = floor;
        if (v.y < 0) v.y = 0;
        const s = Math.hypot(v.x, v.z), lose = Math.max(s * (1 - Math.exp(-LIMP.slide * dt)), LIMP.grip * dt);
        const k = s > lose ? (s - lose) / s : 0;
        v.x *= k; v.z *= k;
      }
      fastest = Math.max(fastest, v.length());
    }
    this.stillT = fastest < LIMP.still && this.on.every(Boolean) ? this.stillT + dt : 0;
    if (this.stillT >= LIMP.stillFor) this.asleep = true;
  }

  /**
   * Foot i held within `len` of its hip (world): pulled in along the line to it, what it was moving away at taken off
   * its speed; a foot moved wakes them all (the body still going over).
   */
  hold(i, hip, len) {
    const x = this.x[i], d = _d.subVectors(x, hip), L = d.length(), most = len * LIMP.reach;
    if (L <= most || L < 1e-6) return false;
    d.divideScalar(L);
    x.copy(hip).addScaledVector(d, most);
    const out = this.v[i].dot(d);
    if (out > 0) this.v[i].addScaledVector(d, -out);
    if (L - most > 0.01) { this.asleep = false; this.stillT = 0; }
    return true;
  }
}
