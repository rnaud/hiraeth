import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { sweepCapsule, unbury } from './physics.js';

// A Sable-like hoverbike. Controls when riding: W throttle, S brake/reverse,
// A/D steer, Shift boost, Space hop. It hovers on a spring above the dunes,
// banks into turns and pitches with the ground.

const HOVER = 1.15;
const MAX = 34;      // m/s
const BOOST = 54;
const RADIUS = 0.85;
const LIMIT = 1900;

const _c = new THREE.Vector3();

function part(geo, color, opts = {}) {
  return new THREE.Mesh(geo, makeMaterial({ color, ...opts }));
}

function buildBike() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // pitched / banked
  root.add(body);
  const orange = '#d9643a', cream = '#f2e6cc', teal = '#5fb7ad', dark = '#34405e';

  const chassis = part(new THREE.BoxGeometry(0.9, 0.42, 2.5), orange, { flat: true });
  const nose = part(new THREE.ConeGeometry(0.46, 1.1, 8), cream, { flat: true });
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.02, 1.8);
  const seat = part(new THREE.BoxGeometry(0.5, 0.18, 0.95), dark, { flat: true });
  seat.position.set(0, 0.3, -0.35);
  const stem = part(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), dark);
  stem.position.set(0, 0.42, 0.75);
  stem.rotation.x = -0.4;
  const bar = part(new THREE.CylinderGeometry(0.045, 0.045, 1.0, 6), dark);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.64, 0.65);
  const fin = part(new THREE.BoxGeometry(0.06, 0.6, 0.65), cream, { flat: true });
  fin.position.set(0, 0.45, -1.15);
  fin.rotation.x = -0.35;
  body.add(chassis, nose, seat, stem, bar, fin);
  for (const side of [-1, 1]) {
    const pod = part(new THREE.CylinderGeometry(0.27, 0.22, 1.7, 9), teal, { flat: true });
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * 0.66, -0.08, -0.25);
    const cap = part(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 9), cream);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(side * 0.66, -0.08, -1.12);
    body.add(pod, cap);
  }
  for (const z of [0.8, -0.9]) {
    const pad = part(new THREE.CylinderGeometry(0.34, 0.4, 0.09, 12), cream);
    pad.position.set(0, -0.27, z);
    body.add(pad);
  }
  // where the rider sits (character feet origin; hips land on the seat)
  const seatAnchor = new THREE.Group();
  seatAnchor.position.set(0, -0.56, -0.4);
  body.add(seatAnchor);
  return { root, body, seatAnchor };
}

export { buildBike };

export class Hoverbike {
  /**
   * @param {object} [opts]
   * @param {() => {root, body, seatAnchor}} [opts.build] mesh builder (default: the bike)
   * @param {number} [opts.floor] never hover below this height (e.g. a water surface)
   */
  constructor(physics, opts = {}) {
    this.physics = physics;
    this._push = new THREE.Vector3();
    this.kind = opts.kind ?? 'bike';
    this.floor = opts.floor ?? -Infinity;
    const b = (opts.build ?? buildBike)();
    this.object = b.root;
    this.body = b.body;
    this.seat = b.seatAnchor;
    this.pos = new THREE.Vector3(8, 0, 4);
    this.pos.y = this.groundAt(8, 1e4, 4) + HOVER;
    this.vel = new THREE.Vector3();
    this.heading = Math.PI;
    this.speed = 0;
    this.yawRate = 0;
    this.bank = 0;
    this.pitch = 0;
    this.time = 0;
    this.grounded = true;
  }

  groundAt(x, fromY, z) {
    return Math.max(this.physics.groundAt(x, fromY, z), this.floor);
  }

  get forward() {
    return [Math.sin(this.heading), Math.cos(this.heading)];
  }

  /** Put it right here (arriving in a new world already riding). */
  place(x, z, heading, near) {
    const from = near ? near.y + 4 : 1e4;
    this.pos.set(x, this.groundAt(x, from, z) + HOVER + 1, z);
    this.vel.set(0, 0, 0);
    this.speed = 0;
    this.heading = heading;
    this.auto = null;
  }

  /**
   * Whistled for: it drives over to you from wherever it is (if it's very far
   * or lost, it comes in from a way off), then pulls up beside you.
   * `near` is the live player position; the bike keeps the same offset from it.
   */
  summon(x, z, heading, near, { camFwd = null } = {}) {
    const ref = near ?? new THREE.Vector3(x, 0, z);
    if (![this.pos.x, this.pos.y, this.pos.z].every(Number.isFinite) || this.pos.distanceTo(ref) > 80) {
      // come in from the side of the view, so you see it arrive
      const a = Math.atan2(camFwd?.x ?? Math.sin(heading), camFwd?.z ?? Math.cos(heading)) + (Math.random() < 0.5 ? 1.5 : -1.5);
      const sx = ref.x + Math.sin(a) * 20, sz = ref.z + Math.cos(a) * 20;
      this.pos.set(sx, this.groundAt(sx, 1e4, sz) + HOVER, sz);
      this.vel.set(0, 0, 0);
      this.heading = Math.atan2(ref.x - sx, ref.z - sz);
    }
    this.auto = { near: ref, dx: x - ref.x, dz: z - ref.z, heading, elapsed: 0, stalled: 0 };
  }

  /** Find a clear, boardable spot beside the caller before teleporting. */
  recallNear(A) {
    for (const radius of [3, 4.5]) for (let i = 0; i < 12; i++) {
      const angle = A.heading + i * Math.PI / 6;
      const p = new THREE.Vector3(A.near.x + Math.sin(angle) * radius, 0, A.near.z + Math.cos(angle) * radius);
      const ground = this.groundAt(p.x, A.near.y + 2, p.z);
      if (!Number.isFinite(ground) || Math.abs(ground - A.near.y) > 2.5) continue;
      p.y = ground + HOVER;
      const probe = p.clone();
      if (this.physics.pushCapsule(probe, RADIUS, -0.35, 1.0, this._push)) continue;
      const origin = A.near.clone().add(new THREE.Vector3(0, 1, 0)), delta = p.clone().sub(origin);
      if (this.physics.rayDistance?.(origin, delta.clone().normalize(), delta.length()) < delta.length() - 0.5) continue;
      this.pos.copy(p); this.vel.set(0, 0, 0); this.speed = this.yawRate = 0;
      this.heading = A.heading; this.auto = null;
      this.object.position.copy(p); this.object.rotation.y = this.heading;
      return true;
    }
    return false;
  }

  /** Where the rider sits (world space). */
  seatTransform(pos, quat) {
    this.seat.getWorldPosition(pos);
    this.seat.getWorldQuaternion(quat);
  }

  /** @param input key state, or null when nobody rides it */
  update(dt, input) {
    this.time += dt;
    const ridden = !!input;
    let [fx, fz] = this.forward;

    let throttle = 0, steer = 0, boost = false;
    if (ridden) this.auto = null;
    if (!ridden && this.auto) {
      // autopilot: steer at the spot beside the player, ease off as it arrives
      const A = this.auto, tx = A.near.x + A.dx, tz = A.near.z + A.dz;
      const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
      A.elapsed += dt;
      if ((A.elapsed >= 4 || A.stalled > 0.8) && A.elapsed >= (A.nextRecall ?? 0)) {
        A.nextRecall = A.elapsed + 0.5;
        if (this.recallNear(A)) return;
      }
      if (d < 1.2) {
        this.speed = 0; this.vel.x = this.vel.z = 0;
        this.heading = A.heading; this.yawRate = 0; this.auto = null;
      } else {
        let dh = Math.atan2(dx, dz) - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        this.heading += dh * (1 - Math.exp(-10 * dt)); this.yawRate = 0;
        [fx, fz] = this.forward;
        const want = Math.min(BOOST, d * 3.5) * Math.max(0.25, Math.cos(dh));
        this.speed += (want - this.speed) * (1 - Math.exp(-5 * dt));
      }
    }
    if (ridden) {
      throttle = (input.KeyW || input.ArrowUp ? 1 : 0) - (input.KeyS || input.ArrowDown ? 1 : 0);
      steer = (input.KeyD || input.ArrowRight ? 1 : 0) - (input.KeyA || input.ArrowLeft ? 1 : 0);
      boost = input.ShiftLeft || input.ShiftRight;
    }
    const recalling = !ridden && !!this.auto;
    const oldPos = this.pos.clone();
    const max = boost ? BOOST : MAX;
    if (throttle > 0) this.speed += (max - this.speed) * (1 - Math.exp(-(boost ? 0.9 : 0.6) * dt));
    else if (throttle < 0) this.speed = Math.max(this.speed - 40 * dt, -8);
    else if (!recalling) this.speed *= Math.exp(-0.5 * dt);

    // steering: right = decreasing heading; tighter at low speed
    const grip = THREE.MathUtils.clamp(Math.abs(this.speed) / 14, 0.35, 1);
    const targetRate = -steer * 1.9 * grip * Math.sign(this.speed || 1);
    this.yawRate += (targetRate - this.yawRate) * (1 - Math.exp(-6 * dt));
    this.heading += this.yawRate * dt;

    // horizontal velocity slides toward the facing direction (a bit of drift)
    const a = 1 - Math.exp(-(recalling ? 12 : this.grounded ? 3.5 : 0.8) * dt);
    this.vel.x += (fx * this.speed - this.vel.x) * a;
    this.vel.z += (fz * this.speed - this.vel.z) * a;

    // hover spring + gravity
    // hover over whatever is below (terrain, rocks, mesa tops...)
    const probe = this.pos.y - 0.2;
    const g = this.groundAt(this.pos.x, probe, this.pos.z);
    const gAhead = this.groundAt(this.pos.x + fx * 2.5, probe, this.pos.z + fz * 2.5);
    const target = Math.max(g, gAhead - 0.3) + HOVER + Math.sin(this.time * 2.3) * 0.06;
    if (this.pos.y < target + 0.6) {
      this.vel.y += ((target - this.pos.y) * 45 - this.vel.y * 7) * dt;
      this.grounded = true;
    } else {
      this.vel.y -= 26 * dt;
      this.grounded = false;
    }
    if (ridden && input.Space && this.grounded && !this._hopHeld) this.vel.y = 11;
    this._hopHeld = ridden && !!input.Space;

    this.pos.addScaledVector(this.vel, dt);
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -LIMIT, LIMIT);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -LIMIT, LIMIT);

    // swept, so a boosted bike (or a slow frame) can't jump through a wall
    if (sweepCapsule(this.physics, this.pos, oldPos, RADIUS, -0.35, 1.0, this._push)) this.speed *= 0.6;
    // the ground where it is now, looked for from where it came from: a long
    // drop can't skip through a roof
    const gNow = this.groundAt(this.pos.x, Math.max(oldPos.y, this.pos.y) + 0.3, this.pos.z);
    if (this.pos.y < gNow + 0.4) { this.pos.y = gNow + 0.4; this.vel.y = Math.max(this.vel.y, 0); }
    // still buried in something solid: back to where it was free
    if (this.physics.embedded?.(_c.copy(this.pos).setY(this.pos.y + 0.3))) unbury(this, oldPos, RADIUS);

    if (this.auto) {
      const progress = Math.hypot(this.pos.x - oldPos.x, this.pos.z - oldPos.z);
      this.auto.stalled = progress < Math.max(0.02, Math.abs(this.speed) * dt * 0.2) ? this.auto.stalled + dt : 0;
    }

    // pose: pitch with the ground, bank into turns
    const hBack = this.groundAt(this.pos.x - fx * 1.5, probe, this.pos.z - fz * 1.5);
    const hFront = this.groundAt(this.pos.x + fx * 1.5, probe, this.pos.z + fz * 1.5);
    const targetPitch = this.grounded ? -Math.atan2(hFront - hBack, 3) : -this.vel.y * 0.02;
    // the bike's right side is local -x, so leaning right is a positive roll
    const targetBank = THREE.MathUtils.clamp(-this.yawRate * Math.abs(this.speed) * 0.025, -0.55, 0.55);
    const k = 1 - Math.exp(-6 * dt);
    this.pitch += (targetPitch - this.pitch) * k;
    this.bank += (targetBank - this.bank) * k;

    this.object.position.copy(this.pos);
    this.object.rotation.y = this.heading;
    this.body.rotation.set(this.pitch, 0, this.bank);
  }
}
