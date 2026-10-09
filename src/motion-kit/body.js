import { SecondOrder } from './spring.js';

// The body rides on its feet (docs/systems/procedural-animation.md, "Body from feet"): its height is the
// average height of the feet on the ground, its pitch and roll the plane through them (front minus back, left
// minus right), it dips a little while a group is up, sways over the feet that carry it, and leans into
// acceleration and into turns. Every channel goes through a second-order spring (src/motion-kit/spring.js), so
// a heavy brute dips and overshoots and a light skitterer twitches. Pure logic (tests/motion-kit.test.js).
//
// The output is an offset from the model's rest body, in the body's frame (+z ahead, +x to its left):
//   y      up (m)          pitch  rotation.x (+ tips the nose down)    roll  rotation.z (+ lifts the left side)
//   x      sideways sway (m)

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class BodyFromFeet {
  /**
   * bob: the dip while feet are up (m, at all feet up); lean: rad per m/s² of forward acceleration; bank: rad
   * per (rad/s × m/s) of turning; sway: share of the planted feet's sideways offset the body shifts by; tilt: the
   * most it pitches or rolls (rad); spring { f, z, r } for the tilts, height { f, z, r } for the height.
   */
  constructor({ bob = 0.03, lean = 0.02, bank = 0.03, sway = 0.15, tilt = 0.3, spring = { f: 3, z: 0.7, r: 0 }, height = null } = {}) {
    this.o = { bob, lean, bank, sway, tilt };
    const h = height ?? spring;
    this.sy = new SecondOrder(h.f, h.z, h.r);
    this.sp = new SecondOrder(spring.f, spring.z, spring.r);
    this.sr = new SecondOrder(spring.f, spring.z, spring.r);
    this.sx = new SecondOrder(spring.f, spring.z, spring.r);
    this.sa = new SecondOrder(2, 1, 0);   // (forward acceleration, smoothed)
    this.out = { y: 0, pitch: 0, roll: 0, x: 0 };
    this.prevSpeed = null; this.prevHeading = null;
    this.target = { y: 0, pitch: 0, roll: 0, x: 0 };
  }

  /** One frame from the planner's feet. root: the body's ground spot; vel {x, z}. */
  update(dt, planner, root, heading, vel) {
    const s = Math.sin(heading), c = Math.cos(heading);
    let n = 0, mh = 0, mx = 0, mz = 0, homeX = 0, up = 0;
    const pts = this._pts ??= planner.feet.map(() => ({ x: 0, z: 0, h: 0 }));
    planner.feet.forEach((f, i) => {
      // a foot in the air counts at the height of the ground under its step (not its lift)
      const gy = f.planted ? f.pos.y : f.from.y + (f.to.y - f.from.y) * Math.min(1, Math.max(0, f.t));
      const dx = f.pos.x - root.x, dz = f.pos.z - root.z;
      const p = pts[i];
      p.x = dx * c - dz * s; p.z = dx * s + dz * c; p.h = gy - root.y - f.home.y;
      if (!f.planted) up += Math.sin(Math.PI * Math.min(1, Math.max(0, f.t)));   // (deepest mid-swing)
      mh += p.h; mx += p.x; mz += p.z; homeX += f.home.x * planner.spread; n++;
    });
    if (!n) return this.out;
    mh /= n; mx /= n; mz /= n; homeX /= n;
    // the plane through the feet: slopes fore-aft and sideways (centred regressions)
    let szz = 0, szh = 0, sxx = 0, sxh = 0, px = 0, pn = 0;
    planner.feet.forEach((f, i) => {
      const p = pts[i], dz = p.z - mz, dx = p.x - mx, dh = p.h - mh;
      szz += dz * dz; szh += dz * dh; sxx += dx * dx; sxh += dx * dh;
      if (f.planted) { px += p.x; pn++; }
    });
    const slopeZ = szz > 1e-6 ? szh / szz : 0, slopeX = sxx > 1e-6 ? sxh / sxx : 0;
    // motion: forward acceleration and turning
    const speed = Math.hypot(vel.x, vel.z);
    const acc = this.prevSpeed == null || !(dt > 0) ? 0 : (speed - this.prevSpeed) / dt;
    const turn = this.prevHeading == null || !(dt > 0) ? 0 : Math.atan2(Math.sin(heading - this.prevHeading), Math.cos(heading - this.prevHeading)) / dt;
    this.prevSpeed = speed; this.prevHeading = heading;
    const a = this.sa.update(dt, clamp(acc, -20, 20));
    const o = this.o, T = this.target;
    T.y = mh - o.bob * Math.min(1, up / Math.max(1, n / Math.max(1, planner.groups.length)));   // (a group up: the full dip)
    T.pitch = clamp(-Math.atan(slopeZ) + o.lean * a, -o.tilt, o.tilt);
    T.roll = clamp(Math.atan(slopeX) - o.bank * clamp(turn, -6, 6) * speed, -o.tilt, o.tilt);
    T.x = pn ? o.sway * (px / pn - homeX) : 0;
    if (!(dt > 0)) return this.out;
    this.out.y = this.sy.update(dt, T.y);
    this.out.pitch = this.sp.update(dt, T.pitch);
    this.out.roll = this.sr.update(dt, T.roll);
    this.out.x = this.sx.update(dt, T.x);
    return this.out;
  }

  /** Settle at once (a new foe, a teleport). */
  reset() { this.sy.reset(0); this.sp.reset(0); this.sr.reset(0); this.sx.reset(0); this.prevSpeed = null; this.prevHeading = null; Object.assign(this.out, { y: 0, pitch: 0, roll: 0, x: 0 }); }
}
