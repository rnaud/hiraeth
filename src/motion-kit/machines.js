import { SecondOrder } from './spring.js';

// The machines' own motion (docs/systems/procedural-animation.md, plans 17 and 19; the kit: "src/motion-kit/"):
//
//   TrackDrive  tracks and road wheels locked to the ground (plan 17, the crucible cart): each side's belt moves by the
//               distance that side covered, the body's travel along its heading plus or minus its turn times half the
//               gauge, so it never slips and a turn on the spot runs the two belts opposite ways; the chassis pitches
//               and rolls on springs over the ground under its four corners (two rays every other frame)
//   Pendulum    a weight on a rod hung from a moving pivot (plan 19: the bell on its yoke, the clapper inside it, a
//               winch's hook): two small angles (pitch about x, roll about z) driven by the pivot's acceleration in its
//               own frame, with damping, and a push to drive it higher (the toll's three swings)
//
// Pure numbers over plain {x, y, z} (no three.js): tested in tests/motion-kit.test.js.

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class TrackDrive {
  /** gauge: m between the belts' middles; length: m of belt on the ground; wheel: a road wheel's radius (m). */
  constructor({ gauge = 1.5, length = 1.9, wheel = 0.17, spring = { f: 2.4, z: 0.38, r: 0 }, tilt = 0.25 } = {}) {
    this.gauge = gauge; this.length = length; this.wheel = wheel; this.tilt = tilt;
    this.left = 0; this.right = 0;              // m each belt has run (+ forward); left: the body's +x side
    this.prev = null; this.heading = 0;
    this.sp = new SecondOrder(spring.f, spring.z, spring.r);
    this.sr = new SecondOrder(spring.f, spring.z, spring.r);
    this.sy = new SecondOrder(spring.f * 1.2, spring.z, spring.r);
    this.out = { pitch: 0, roll: 0, y: 0, dl: 0, dr: 0, speed: 0 };
    this.frame = 0; this.ground = { pitch: 0, roll: 0, y: 0 };
  }
  /** A road wheel's angle on a side (rad): the belt's run over the wheel's radius. */
  wheelAngle(side) { return (side > 0 ? this.left : this.right) / this.wheel; }
  /**
   * One frame. pos: its ground spot; heading (rad); ground(x, fromY, z) → y or null (sampled every other frame, at
   * the four corners of the belts). Returns { dl, dr (m each belt ran this frame), pitch, roll, y (the chassis'
   * offsets, + pitch tips its nose down), speed }.
   */
  update(dt, pos, heading, ground = null) {
    const o = this.out;
    if (!this.prev) { this.prev = { x: pos.x, y: pos.y, z: pos.z }; this.heading = heading; }
    const dx = pos.x - this.prev.x, dz = pos.z - this.prev.z;
    const jump = Math.hypot(dx, dz) > 3;   // (a teleport: no run)
    const fwd = jump ? 0 : dx * Math.sin(heading) + dz * Math.cos(heading);
    const dh = jump ? 0 : Math.atan2(Math.sin(heading - this.heading), Math.cos(heading - this.heading));
    // (a turn toward +x (dh > 0) slows the +x belt: it is the inner one)
    o.dl = fwd - dh * this.gauge / 2; o.dr = fwd + dh * this.gauge / 2;
    this.left += o.dl; this.right += o.dr;
    o.speed = dt > 0 ? fwd / dt : 0;
    this.prev.x = pos.x; this.prev.y = pos.y; this.prev.z = pos.z; this.heading = heading;
    if (ground && (this.frame++ % 2 === 0)) {
      const s = Math.sin(heading), c = Math.cos(heading), hl = this.length / 2, hg = this.gauge / 2;
      const at = (ax, az) => { const y = ground(pos.x + ax * c + az * s, pos.y + 1.2, pos.z - ax * s + az * c); return Number.isFinite(y) ? y - pos.y : 0; };
      const fl = at(hg, hl), fr = at(-hg, hl), bl = at(hg, -hl), br = at(-hg, -hl);
      this.ground.pitch = clamp(Math.atan2(((bl + br) - (fl + fr)) / 2, this.length), -this.tilt, this.tilt);
      this.ground.roll = clamp(Math.atan2(((fl + bl) - (fr + br)) / 2, this.gauge), -this.tilt, this.tilt);
      this.ground.y = Math.max(fl, fr, bl, br, 0) * 0.5;
    }
    if (dt > 0) {
      o.pitch = this.sp.update(dt, this.ground.pitch);
      o.roll = this.sr.update(dt, this.ground.roll);
      o.y = this.sy.update(dt, this.ground.y);
    }
    return o;
  }
}

export class Pendulum {
  /** length: m of rod; damping: per second; drive: how hard the pivot's acceleration swings it (0..1). */
  constructor({ length = 1, damping = 0.5, drive = 1, gravity = 9.8, max = 1.3 } = {}) {
    Object.assign(this, { length, damping, drive, gravity, max });
    this.a = 0; this.b = 0; this.va = 0; this.vb = 0;   // (a about the pivot's x: fore-aft; b about its z: sideways)
    this.prev = null; this.pv = null;
  }
  /** Give it a push (rad/s on each axis): a toll's swing, a blow. */
  kick(va, vb = 0) { this.va += va; this.vb += vb; }
  /**
   * One frame. pivot: its world spot; heading: the frame its angles are in. Returns { a, b }: + a swings its weight
   * forward (ahead of the pivot), + b toward the frame's +x.
   */
  update(dt, pivot, heading = 0) {
    if (!(dt > 0)) return this;
    let ax = 0, az = 0;
    if (this.prev && this.pv) {
      const vx = (pivot.x - this.prev.x) / dt, vz = (pivot.z - this.prev.z) / dt;
      const gx = (vx - this.pv.x) / dt, gz = (vz - this.pv.z) / dt;
      const s = Math.sin(heading), c = Math.cos(heading);
      ax = clamp(gx * s + gz * c, -30, 30); az = clamp(gx * c - gz * s, -30, 30);
      this.pv.x = vx; this.pv.z = vz;
    } else if (this.prev) this.pv = { x: (pivot.x - this.prev.x) / dt, z: (pivot.z - this.prev.z) / dt };
    this.prev ??= { x: 0, z: 0 };
    this.prev.x = pivot.x; this.prev.z = pivot.z;
    // (the pivot accelerating ahead leaves the weight behind: it swings back)
    const w2 = this.gravity / this.length, step = Math.min(dt, 1 / 30);
    for (let t = 0; t < dt - 1e-9; t += step) {
      const h = Math.min(step, dt - t);
      this.va += (-w2 * Math.sin(this.a) - (this.drive * ax / this.length) * Math.cos(this.a) - this.damping * this.va) * h;
      this.vb += (-w2 * Math.sin(this.b) - (this.drive * az / this.length) * Math.cos(this.b) - this.damping * this.vb) * h;
      this.a = clamp(this.a + this.va * h, -this.max, this.max);
      this.b = clamp(this.b + this.vb * h, -this.max, this.max);
    }
    return this;
  }
}
