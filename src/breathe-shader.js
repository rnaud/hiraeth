import * as THREE from 'three';

// ---------------------------------------------------------------------------
// The Buried Machine's moving parts, moved on the GPU (issue #168, "the machine breathes"): an instanced mesh whose
// material is made with `breathe: true` (materials.js: the BREATHE define) reads each instance's aBreathe
//   x  its phase (s)        y  its period (s; a turn's sign is its way round)
//   z  its stroke (m)       w  its kind: 0 a slide out along its own +y and back (a piston's rod),
//                                        1 a turn about its own y (a gear),
//                                        2 a puff: swells, travels along its own +y and thins away (steam)
// and moves its vertices by the one clock all of them share (BREATHE_CLOCK, uBreathe):
//   x  the canyon's clock (s)                y  how far from the camera an instance holds still (m)
//   z  the clock it holds at                 w  the gear wall's clock (s): the gears run faster before their door opens
// The CPU writes four numbers a frame, nothing per instance; the puffs' and the rods' shapes are the JS functions
// below, the same curves (tests/buried-breath.test.js). Shadows are cast by the rest pose: the meshes cast none.
// ---------------------------------------------------------------------------

/** The shared clock (materials.js hands this object to every breathing material: one write a frame moves them all). */
export const BREATHE_CLOCK = { value: new THREE.Vector4(0, 1e9, 0, 0) };

/** m: on a low-detail preset (the Deck's, the handheld's: main.js applyDetail) the parts hold still past this from the camera. */
export const BREATHE_FAR = 140;
/** The preset's detail: low holds the far parts still. */
export function breatheDetail(low) { BREATHE_CLOCK.value.y = low ? BREATHE_FAR : 1e9; }

/** A slide's shares of its period: out, held out, back in (the rest held in). */
export const SLIDE = { out: 0.2, hold: 0.3, back: 0.2 };
/** A puff's life, its share of the period (the rest of the period: no puff). */
export const PUFF_LIFE = 0.6;

const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);

/** How far out a slide is (0 in .. 1 out) at u (0..1 of its period). */
export function slideOut(u, S = SLIDE) {
  u = fract(u);
  if (u < S.out) return smooth(u / S.out);
  if (u < S.out + S.hold) return 1;
  if (u < S.out + S.hold + S.back) return 1 - smooth((u - S.out - S.hold) / S.back);
  return 0;
}

/** A puff at u of its period: { scale (0..1 of its size), travel (0..1 of its stroke) }; nothing past its life. */
export function puffAt(u, life = PUFF_LIFE) {
  const k = fract(u) / life;
  if (k >= 1) return { scale: 0, travel: 1 };
  // (it swells as it rises, and thins away at the end)
  const scale = Math.min(1, k / 0.2) ** 0.6 * (0.45 + 0.95 * k) * (k < 0.65 ? 1 : 1 - ((k - 0.65) / 0.35) ** 2);
  return { scale, travel: 1 - (1 - k) * (1 - k) };
}

export const BREATHE_GLSL = /* glsl */ `
  in vec4 aBreathe;
  uniform vec4 uBreathe;
  float breatheSmooth(float t) { t = clamp(t, 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
  float breatheSlide(float u) {
    u = fract(u);
    if (u < ${SLIDE.out.toFixed(3)}) return breatheSmooth(u / ${SLIDE.out.toFixed(3)});
    if (u < ${(SLIDE.out + SLIDE.hold).toFixed(3)}) return 1.0;
    if (u < ${(SLIDE.out + SLIDE.hold + SLIDE.back).toFixed(3)}) return 1.0 - breatheSmooth((u - ${(SLIDE.out + SLIDE.hold).toFixed(3)}) / ${SLIDE.back.toFixed(3)});
    return 0.0;
  }
  #ifdef USE_INSTANCING
  void breatheMove(inout vec3 p, inout vec3 n) {
    vec3 at = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
    float still = step(uBreathe.y, distance(at, cameraPosition));   // (far off: held where the clock stood)
    float iS = max(length(instanceMatrix[0].xyz), 1e-4);            // (the stroke in metres, the shape in its own units)
    float kind = aBreathe.w, per = aBreathe.y;
    if (kind < 0.5) {
      float clock = mix(uBreathe.x, uBreathe.z, still);
      p.y += breatheSlide((clock + aBreathe.x) / per) * aBreathe.z / iS;
    } else if (kind < 1.5) {
      float clock = mix(uBreathe.w, uBreathe.z, still);
      float a = (clock + aBreathe.x) * 6.28318530718 / per, c = cos(a), s = sin(a);
      p.xz = mat2(c, -s, s, c) * p.xz;
      n.xz = mat2(c, -s, s, c) * n.xz;
    } else {
      float clock = mix(uBreathe.x, uBreathe.z, still);
      float k = fract((clock + aBreathe.x) / per) / ${PUFF_LIFE.toFixed(3)};
      float sc = k >= 1.0 ? 0.0 : pow(min(1.0, k / 0.2), 0.6) * (0.45 + 0.95 * k) * (k < 0.65 ? 1.0 : 1.0 - pow((k - 0.65) / 0.35, 2.0));
      p = p * sc + vec3(0.0, (1.0 - (1.0 - min(k, 1.0)) * (1.0 - min(k, 1.0))) * aBreathe.z / iS, 0.0);
    }
  }
  #endif
`;
