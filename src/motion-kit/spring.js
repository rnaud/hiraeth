// Springs for procedural motion (docs/systems/procedural-animation.md, "Secondary motion" and "The kit").
//
// SecondOrder: t3ssel8r's second-order dynamics ("Giving Personality to Procedural Animations using Math"). One
// filter makes a value follow its target with character, set by three numbers:
//   f  how fast it responds (Hz)
//   z  the damping ζ: 0 wobbles for ever, below 1 overshoots, 1 is critical, above 1 is sluggish
//   r  the initial response: above 1 it overshoots at the start, below 0 it first goes the wrong way (anticipation)
// k2 is clamped every step (k2s) so it stays stable at any frame rate (10 to 240 fps in the tests).
// Pure numbers: no three.js, tested in tests/motion-kit.test.js.

/** Coefficients of a second-order filter from f / ζ / r. */
export function coefficients(f, z, r) {
  const w = 2 * Math.PI * Math.max(1e-4, f);
  return { k1: z / (Math.PI * Math.max(1e-4, f)), k2: 1 / (w * w), k3: (r * z) / w };
}

/**
 * A scalar that follows its target with the character f / ζ / r.
 *   const s = new SecondOrder(3, 0.6, 0, x0); y = s.update(dt, target[, targetVelocity])
 */
export class SecondOrder {
  constructor(f = 2, z = 1, r = 0, x0 = 0) {
    this.set(f, z, r);
    this.reset(x0);
  }
  /** New character (keeps the state: no jump). */
  set(f, z, r) {
    const c = coefficients(f, z, r);
    this.k1 = c.k1; this.k2 = c.k2; this.k3 = c.k3; this.f = f; this.z = z; this.r = r;
    return this;
  }
  /** Jump to x, at rest. */
  reset(x = 0) { this.xp = x; this.y = x; this.yd = 0; return this; }
  /** One step of T seconds towards x (xd: the target's velocity; estimated from the last target when omitted). */
  update(T, x, xd) {
    if (!(T > 0)) return this.y;
    if (xd === undefined) xd = (x - this.xp) / T;
    this.xp = x;
    const k2s = Math.max(this.k2, (T * T) / 2 + (T * this.k1) / 2, T * this.k1);
    this.y += T * this.yd;
    this.yd += (T * (x + this.k3 * xd - this.y - this.k1 * this.yd)) / k2s;
    return this.y;
  }
}

/** A SecondOrder on an angle (rad): the target is unwrapped next to the value, so it turns the short way round. */
export class SecondOrderAngle extends SecondOrder {
  update(T, x, xd) {
    const d = Math.atan2(Math.sin(x - this.xp), Math.cos(x - this.xp));
    return super.update(T, this.xp + d, xd);
  }
}

/** A SecondOrder on each of x, y, z of a vector-like ({x, y, z}); writes the result into `out` (or its own). */
export class SecondOrder3 {
  constructor(f = 2, z = 1, r = 0, x0 = { x: 0, y: 0, z: 0 }) {
    this.c = [new SecondOrder(f, z, r, x0.x), new SecondOrder(f, z, r, x0.y), new SecondOrder(f, z, r, x0.z)];
    this.value = { x: x0.x, y: x0.y, z: x0.z };
  }
  set(f, z, r) { for (const c of this.c) c.set(f, z, r); return this; }
  reset(p) { this.c[0].reset(p.x); this.c[1].reset(p.y); this.c[2].reset(p.z); this.value.x = p.x; this.value.y = p.y; this.value.z = p.z; return this; }
  update(T, p, out = this.value) {
    out.x = this.c[0].update(T, p.x); out.y = this.c[1].update(T, p.y); out.z = this.c[2].update(T, p.z);
    if (out !== this.value) { this.value.x = out.x; this.value.y = out.y; this.value.z = out.z; }
    return out;
  }
}

/** An exponential approach (a servo, a pneumatic arm): `k` per second, frame-rate independent. */
export const expDamp = (value, target, k, dt) => target + (value - target) * Math.exp(-k * dt);

/** Snap to ticks of `step` (a stepper motor's notches). */
export const quantise = (x, step) => (step > 0 ? Math.round(x / step) * step : x);

/** Hold the last output until the input moves more than `band` from it (a servo's deadband). */
export const deadband = (held, x, band) => (Math.abs(x - held) > band ? x : held);
