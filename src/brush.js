import * as THREE from 'three';

// The traveller brushing past plants and through grass (docs/systems/living-world.md, "Brushing past plants").
//
// A plant touched as you pass leans a little away from you and springs back with a light,
// damped wobble. Each plant is a damped spring driven by the touch: x'' + 2ζω x' + ω² x = ω² F(t),
// F the push away from the traveller's feet, stronger the closer and the faster they pass. Its lean
// now is the touch over the last second convolved with the spring's impulse response,
//   x(t) = Σ_k F(t - τ_k) g(τ_k) Δ,   g(τ) = ω² / ω_d · e^(-ζωτ) · sin(ω_d τ),
// so no plant needs a state of its own: the traveller's recent path is kept here (a sample every
// BRUSH.dt, the newest first), each sample carrying the pace and the kernel weight g(τ_k) Δ of its
// age, and the vertex shader (BRUSH_GLSL) sums the touch of each sample on the plant. The weights
// are normalised so a steady touch gives exactly the steady lean (no flicker as the samples age).

export const BRUSH = {
  samples: 14,      // the path's samples
  dt: 0.065,        // s between them (0.9 s of memory: the wobble has died down by then)
  freq: 2.3,        // Hz, a plant's spring
  damping: 0.4,     // ζ: one small overshoot, a second you barely see
  still: 0.03,      // m, the steady lean standing in a plant (the tip of a plant 1.3 m tall)
  perSpeed: 0.018,  // m per m/s of pace on top (walking 3.8 m/s: ~0.1 m in all; running 7.2 m/s: ~0.16 m)
  maxSpeed: 7.5,    // m/s: faster (a jet, a fall) pushes no harder
};

const W = 2 * Math.PI * BRUSH.freq, WD = W * Math.sqrt(1 - BRUSH.damping ** 2);
const END = BRUSH.samples * BRUSH.dt;

/** The spring's impulse response at age τ (s): the lean a unit push lasting dτ leaves τ later, per dτ. */
export function brushKernel(tau) {
  if (tau <= 0 || tau >= END) return 0;
  const fade = 1 - THREE.MathUtils.smoothstep(tau, END * 0.75, END);   // (the oldest sample leaves without a step)
  return (W * W / WD) * Math.exp(-BRUSH.damping * W * tau) * Math.sin(WD * tau) * fade;
}

/** The steady lean (m, at the tip of a plant 1.3 m tall) a pace of v m/s pushes. */
export const brushPace = (v) => BRUSH.still + BRUSH.perSpeed * Math.min(Math.max(v, 0), BRUSH.maxSpeed);

/** How much a plant at distance d (m) from the feet is touched: 1 inside r0, nothing past r1. */
export const brushTouch = (d, r0, r1) => 1 - THREE.MathUtils.smoothstep(d, r0, r1);

/** The traveller's recent path for the shader: uBrushTrail[k] = (x, y, z, pace · weight), uBrushBound. */
export class BrushTrail {
  constructor(uniforms = null) {
    const N = BRUSH.samples;
    this.trail = uniforms?.uBrushTrail?.value ?? Array.from({ length: N }, () => new THREE.Vector4(0, -1e4, 0, 0));
    this.bound = uniforms?.uBrushBound?.value ?? new THREE.Vector4(0, 0, 0, 0);
    this.pos = Array.from({ length: N }, () => new THREE.Vector3(0, -1e4, 0));
    this.pace = new Float32Array(N);
    this.phase = 0;            // s since the newest sample was taken
    this.started = false;
  }

  /**
   * Once a frame. at: the feet (null: not touching anything, riding or flying); speed: m/s across the ground.
   * The newest sample follows the feet until the next is taken, so the touch starts at once.
   */
  update(dt, at, speed) {
    const N = BRUSH.samples, { pos, pace } = this;
    const y = at ? at.y : -1e4, p = at ? brushPace(speed) : 0;
    if (!this.started) { for (let k = 0; k < N; k++) { pos[k].set(at?.x ?? 0, y, at?.z ?? 0); pace[k] = 0; } this.started = true; }
    this.phase += Math.max(dt, 0);
    while (this.phase >= BRUSH.dt) {
      this.phase -= BRUSH.dt;
      for (let k = N - 1; k > 0; k--) { pos[k].copy(pos[k - 1]); pace[k] = pace[k - 1]; }
    }
    pos[0].set(at?.x ?? 0, y, at?.z ?? 0); pace[0] = p;
    // the kernel's weights over the stretch of the past each sample stands for (the newest: the
    // last `phase` seconds; sample k: from phase + (k - 1) dt on), normalised so that a steady
    // touch is the steady lean. Continuous as the samples shift: the newest's weight goes to 0.
    let sum = 0;
    const w = this._w ??= new Float64Array(N), f = this.phase;
    w[0] = brushKernel(f * 0.5) * f;
    for (let k = 1; k < N; k++) w[k] = brushKernel(f + (k - 0.5) * BRUSH.dt) * BRUSH.dt;
    for (let k = 0; k < N; k++) sum += w[k];
    sum = Math.max(sum, 1e-6);
    let cx = 0, cz = 0, n = 0;
    for (let k = 0; k < N; k++) {
      this.trail[k].set(pos[k].x, pos[k].y, pos[k].z, pace[k] * w[k] / sum);
      if (pace[k] > 0) { cx += pos[k].x; cz += pos[k].z; n++; }
    }
    // the circle the path lies in (a plant further than this plus its reach is skipped by the shader)
    if (n) {
      cx /= n; cz /= n;
      let r = 0;
      for (let k = 0; k < N; k++) if (pace[k] > 0) r = Math.max(r, Math.hypot(pos[k].x - cx, pos[k].z - cz));
      this.bound.set(cx, cz, r, 1);
    } else this.bound.set(0, 0, -1e4, 0);
    return this;
  }

  /**
   * The lean (x, z in m, the tip of a plant 1.3 m tall) of a plant at p, as the shader sums it (BRUSH_GLSL);
   * r0, r1: the touch's reach, dy: how far above or below the feet it still reaches.
   */
  leanAt(p, r0 = 0.3, r1 = 1, dy = 2.5) {
    let x = 0, z = 0;
    if (Math.hypot(p.x - this.bound.x, p.z - this.bound.y) > this.bound.z + r1) return { x, z };
    for (const s of this.trail) {
      const ax = p.x - s.x, az = p.z - s.z, d = Math.hypot(ax, az);
      if (d < 1e-4 || Math.abs(p.y - s.y) > dy) continue;
      const k = brushTouch(d, r0, r1) * s.w / d;
      x += ax * k; z += az * k;
    }
    return { x, z };
  }
}

/** The shared uniforms (materials.js sharedUniforms): the path, and the circle it lies in. */
export function brushUniforms() {
  return {
    uBrushTrail: { value: Array.from({ length: BRUSH.samples }, () => new THREE.Vector4(0, -1e4, 0, 0)) },
    uBrushBound: { value: new THREE.Vector4(0, 0, -1e4, 0) },
  };
}

/** The vertex stage's sum (instanced plants: materials.js SWAY; grass blades: grass-shader.js). */
export const BRUSH_GLSL = /* glsl */ `
  uniform vec4 uBrushTrail[${BRUSH.samples}];
  uniform vec4 uBrushBound;
  // the lean (x, z, m at the tip of a 1.3 m plant) of what stands at p: touched within r0..r1 of the
  // traveller's recent steps, each weighted by the spring's response to its age (brush.js)
  vec2 brushLean(vec3 p, float r0, float r1, float dy) {
    vec2 lean = vec2(0.0);
    if (length(p.xz - uBrushBound.xy) > uBrushBound.z + r1) return lean;
    for (int k = 0; k < ${BRUSH.samples}; k++) {
      vec4 s = uBrushTrail[k];
      vec2 away = p.xz - s.xz;
      float d = length(away);
      if (d < 1e-4 || abs(p.y - s.y) > dy) continue;
      lean += away * ((1.0 - smoothstep(r0, r1, d)) * s.w / d);
    }
    return lean;
  }
`;
