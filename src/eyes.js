import * as THREE from 'three';

// Eyes drawn the ligne-claire way: a cream white inside the lids, an iris in the
// person's own colour with a darker rim, a round dark pupil and a small highlight.
// The iris follows the gaze and the lids close over it to blink. Detail goes with
// the size on screen: a few pixels across, the iris is one dark dot on the white;
// smaller still, the whole eye is a single dark mark (what reads as an eye at a
// distance), so faces never turn into blank stares.
//
//   full NPCs    the eyeballs of the human model, shaded by MODE_EYE (materials.js):
//                the gaze and the blink come from EyeLook, per person (Humanoid.updateEyes)
//   crowd        a small almond on the figure's head (crowd.js), iris colour per instance
//                (aBody.w), a blink on the shader's own clock (crowd-shader.js)
//   traveller    the portrait face (face.js): the same iris inside its drawn lids

/** The white of the eye (warm, like the paper). */
export const EYE_WHITE = '#f4ecdc';

/** Iris colours, weighted toward browns: dark brown to amber, hazels, greens, greys, blues. */
export const IRIS = [
  ['#4a2e20', 3], ['#5e3a24', 3], ['#714a2c', 2.5], ['#8a5c2e', 1.5],   // browns
  ['#7d6a35', 1.5], ['#6b6c3a', 1],                                     // hazels
  ['#557346', 1], ['#4f6e5c', 0.7],                                     // greens
  ['#6d7a80', 0.9], ['#5d6c78', 0.6],                                   // greys
  ['#4f7398', 1], ['#7096b8', 0.6],                                     // blues
];
const IRIS_SUM = IRIS.reduce((s, [, w]) => s + w, 0);

/** A seeded iris colour ('#rrggbb'). */
export function irisFor(rng = Math.random) {
  let t = rng() * IRIS_SUM;
  for (const [c, w] of IRIS) if ((t -= w) <= 0) return c;
  return IRIS[IRIS.length - 1][0];
}

/** The traveller's own eyes: a slate blue, like the suit. */
export const TRAVELLER_IRIS = '#4f7896';

/**
 * Shared GLSL. eyeIris(e, px, iris, white): the coloured part of an eye at e, measured from the
 * iris centre in iris radii (px: iris radii per pixel); returns (colour, coverage).
 */
export const EYE_GLSL = /* glsl */ `
  const vec3 EYE_INK = vec3(0.10, 0.085, 0.09);
  vec4 eyeIris(vec2 e, float px, vec3 iris, vec3 white) {
    float rpx = 1.0 / max(px, 1e-4);          // the iris radius on screen, pixels
    float near = smoothstep(2.0, 4.5, rpx);   // big enough for a pupil and a rim
    float aa = clamp(px, 0.03, 0.6);
    float r = length(e);
    float cover = 1.0 - smoothstep(1.0 - aa, 1.0 + aa * 0.5, r);
    // small: one dot, darker than the iris; close: the iris colour, its rim darker
    vec3 c = mix(mix(iris, EYE_INK, 0.6), iris, near);
    // a flat colour ringed by a crisp darker line (a pen circle), as Moebius draws an iris
    c = mix(c, mix(iris, EYE_INK, 0.72), smoothstep(0.8 - aa, 0.8 + aa, r) * near);
    // the pupil, a round dot, and a small highlight on its upper edge (toward the viewer's left)
    c = mix(c, EYE_INK, (1.0 - smoothstep(0.4 - aa, 0.4 + aa, r)) * near);
    float hl = 1.0 - smoothstep(0.12 - aa, 0.12 + aa, length(e - vec2(-0.27, 0.3)));
    c = mix(c, white, hl * smoothstep(4.0, 7.0, rpx));
    return vec4(c, cover);
  }
`;

/**
 * The human model's eyes open on the lower part of the eyeball: looking straight ahead, the iris
 * sits this far (rad) below the eyeball's +z (Humanoid.updateEyes turns the gaze down by it).
 */
export const EYE_TILT = 0.2;
/** How far the eyes turn from straight ahead (rad): sideways, up, down. */
export const EYE_REACH = { yaw: 0.42, up: 0.2, down: 0.26 };
/** Seconds between blinks, and a blink's close / open time. */
export const BLINK = { min: 2.2, max: 6, close: 0.06, open: 0.1 };

/**
 * Where a pair of eyes looks and when it blinks. update(dt, dir): dir is the direction to what
 * they look at, in the eyes' own frame (+z straight ahead, +y up), or null to look around.
 * `look` (a unit vector, same frame) and `blink` (0 open .. 1 shut) go to the shader.
 */
export class EyeLook {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.look = new THREE.Vector3(0, 0, 1);
    this.want = new THREE.Vector3(0, 0, 1);
    this.blink = 0;
    this.t = 0;
    this.nextBlink = BLINK.min * rng();
    this.blinkAt = -1;
    this.nextGlance = 0;
    this.glance = new THREE.Vector2();
  }

  /** The aim for a direction (clamped to the eyes' reach), or null when it is out of reach. */
  static aim(dir, out = new THREE.Vector3()) {
    if (!dir || dir.lengthSq() < 1e-8) return null;
    const yaw = Math.atan2(dir.x, dir.z), pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    if (Math.abs(yaw) > 1.4 || Math.abs(pitch) > 1.1) return null;   // behind or far above: not with the eyes alone
    return EyeLook.fromAngles(THREE.MathUtils.clamp(yaw, -EYE_REACH.yaw, EYE_REACH.yaw), THREE.MathUtils.clamp(pitch, -EYE_REACH.down, EYE_REACH.up), out);
  }
  static fromAngles(yaw, pitch, out = new THREE.Vector3()) {
    return out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  }

  update(dt, dir = null) {
    dt = Math.max(0, Math.min(dt, 0.25));
    this.t += dt;
    if (!EyeLook.aim(dir, this.want)) {
      // nothing to look at: small glances around, held a second or two
      if (this.t >= this.nextGlance) {
        const r = this.rng;
        this.glance.set((r() - 0.5) * 0.5, (r() - 0.5) * 0.22);
        if (r() < 0.35) this.glance.set(0, 0);
        this.nextGlance = this.t + 0.8 + r() * 2;
      }
      EyeLook.fromAngles(this.glance.x, this.glance.y, this.want);
    }
    // eyes jump to what they look at (a saccade), they don't drift
    this.look.lerp(this.want, 1 - Math.exp(-28 * dt)).normalize();
    // blinking: a quick close, a slower open
    if (this.blinkAt < 0 && this.t >= this.nextBlink) this.blinkAt = this.t;
    if (this.blinkAt >= 0) {
      const u = this.t - this.blinkAt;
      if (u < BLINK.close) this.blink = THREE.MathUtils.smoothstep(u, 0, BLINK.close);
      else if (u < BLINK.close + BLINK.open) this.blink = 1 - THREE.MathUtils.smoothstep(u - BLINK.close, 0, BLINK.open);
      else {
        this.blink = 0;
        this.blinkAt = -1;
        // now and then a double blink
        this.nextBlink = this.t + (this.rng() < 0.15 ? 0.12 : BLINK.min + (BLINK.max - BLINK.min) * this.rng());
      }
    }
    return this;
  }
}

/**
 * The eyeballs of a (reshaped) human model in bind space, for MODE_EYE: centre (|x|, y, z) and the
 * radii (x, above the centre, below it, z). The reshape narrows the face and stretches it below the
 * eyes (humanoid.js reshape), so each eyeball is a sphere narrowed in x and longer underneath: the
 * shader divides by these to find the point's direction on the round eye.
 */
export function eyeballOf(geometry, pivotY) {
  const P = geometry.attributes.position;
  const b = new THREE.Box3(), v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) if (P.getX(i) > 0) b.expandByPoint(v.fromBufferAttribute(P, i));
  const cy = THREE.MathUtils.clamp(pivotY, b.min.y + 1e-4, b.max.y - 1e-4);
  return {
    center: [(b.min.x + b.max.x) / 2, cy, (b.min.z + b.max.z) / 2],
    radii: [(b.max.x - b.min.x) / 2, b.max.y - cy, cy - b.min.y, (b.max.z - b.min.z) / 2],
  };
}
