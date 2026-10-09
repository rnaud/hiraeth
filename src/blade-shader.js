import * as THREE from 'three';

// ---------------------------------------------------------------------------
// The fluid sword's living blade (src/fluid-sword.js, src/fluid-blade.js; docs/systems/foes.md "The look",
// "Alive"): compiled into the G-buffer surface shader (materials.js) for the material made with fluid 'blade'
// (the BLADE_FLUID define, on top of FLUID's kind 6). Like the rest it writes a flat albedo, how lit it is and
// its glow for post.js to print: no extra pass, no texture, no particles of its own.
//
// aFold on the blade's mesh: x across (-1 the trailing edge .. 1 the leading), y along (0 the cup .. 1 the
// point); the cup's bead has none (0, 0). What it draws:
//   currents     turquoise water with sand-cream currents and deep teal pools flowing up toward the point (the
//                sheet's), on a clock fluid-blade.js runs faster through a swing; smeared, they stretch back
//                across the blade
//   ripples      fine pale lines where a warped noise crosses its middle (caustics seen through the water),
//                a pen-width whatever the distance, gone where they would crowd under a pixel
//   motes        small bright bubbles rising up the blade toward the point, each column at its own pace
//   skin         the edges are a meniscus: the outermost few per cent of the width come and go with a slow
//                wobble (discarded, so the outline itself wobbles), the side the fluid trails fraying while it
//                smears; a thin bright line just inside it on the leading edge (gold on the trailing)
//   motion       the vertices: the outer blade bowed back along the swing (the lag, uBladeB.xy) and the trailing
//                half stretched out, a wave running up the edges while it smears; a ripple's ring bulges it
//   ripple       a hit or a parry sends a bright ring along the blade from where it struck (uBladeB.zw, uBladeC.x,
//                gold when uBladeC.y), with a flash of the whole blade (uBladeC.z)
//   light        a soft inner glow that breathes (uBlade.z its phase), brighter with the magic bar full
//                (uBlade.y) and after dark; a pale rim where the faces turn away, flecks of sunlight on the
//                ripples (none without a sun: then a softer glint off a light over your shoulder). The edge line,
//                the motes, the glints and a ripple's ring glow over the bloom threshold (a small printed halo);
//                at night the whole blade does, so it reads in the dark
// Ink: soft ink with a pen line (gHatch.a + 8, like the chimes and the makers' boxes): post.js draws its outline,
// half pen, half a darker shade of the water, and nothing inside it (no colour-edge, crease or shadow line across
// the currents, no hatching); its light term never drops under the toon threshold.
// The lite path (uBlade.w, BLADE_QUALITY: the handheld, Low and a desktop Auto that had to drop resolution) keeps the
// currents, the skin, the motion, the ripple and the light, and leaves out the ripples' lines, the motes and the
// second warp. Cost: ~70 ALU a pixel full, ~40 lite, on the few thousand pixels the blade covers.
// ---------------------------------------------------------------------------

/** The blade's tunables (shader and fluid-blade.js). */
export const BLADE_LOOK = {
  pen: 0.5,          // the outline: a pen line's share (the rest a darker shade of the water)
  glow: 0.5,         // the inner glow by day (under the bloom threshold 0.62)
  night: 0.16,       // added after dark: over the threshold, a halo round the blade
  breath: 0.07,      // how far the glow breathes, and its pace (rad/s: about 3 s a breath)
  breathRate: 2.1,
  idle: 0,           // in the fist between cuts: a share of the blade standing out of the cup (fluid-blade.js bladeIdle). Off: a
                     // ~9 cm tongue read as a small dagger in stills; between cuts only the bead breathes in the cup
  full: 0.04,        // added with the magic bar full
  smearAt: 30,       // m/s at the tip where the smear is whole
  lag: 0.0016,       // s: how far back the fluid trails (the tip's speed times this, m)
  lagMax: 0.07,      // m at most
  flow: 2.5,         // how much faster the currents run, smeared whole
  ripple: { hit: 1, heavy: 1.35, block: 0.8, parry: 1.5, charge: 0.9 },
};

const v4 = (...a) => new THREE.Vector4(...a);

/**
 * The graphics preset's say (main.js applyDetail, bladeLiteFor): `lite` leaves out the ripples' lines, the motes and the
 * second warp in the shader (uBlade.w), and fluid-blade.js the extra drops off the point and the splashes.
 */
export const BLADE_QUALITY = { lite: false };
/**
 * Is the blade lite for this preset (perf.js QUALITY_PRESETS) with low detail `low` (its own, or a desktop Auto that had
 * to drop resolution)? The handheld (its lighter ink pass) and Low: yes; the Deck keeps the whole look (its GPU pays a
 * tenth of a millisecond for it close up).
 */
export const bladeLiteFor = (preset, low = !!preset?.lowDetail) => !!preset?.postLite || (low && preset?.key !== 'deck');

/** Turn a fresh makeMaterial() fluid material into the living blade (o.fluid === 'blade'). */
export function bladeMaterial(mat) {
  mat.defines = { ...mat.defines, BLADE_FLUID: 1 };
  Object.assign(mat.uniforms, {
    uBlade: { value: v4(0, 1, 0, 0) },        // x the smear 0..1, y the energy (magic) 0..1, z the breath's phase (rad), w lite (BLADE_QUALITY)
    uBladeB: { value: v4(0, 0, 99, 0.75) },   // xy the lag (object space x, z at the point), z the ripple's age (s), w where it started (v)
    uBladeC: { value: v4(0, 0, 0, BLADE_LOOK.pen) },   // x the ripple's strength, y its gold 0..1, z the flash 0..1, w the pen share
  });
  return mat;
}

// the ripple's ring at v (0..1 along): bright where the front is, fading as it goes
const RING = /* glsl */ `
  float bladeRing(float v) {
    float age = uBladeB.z;
    float d = abs(v - uBladeB.w) - age * 2.4;
    return age > 1.2 ? 0.0 : exp(-d * d / 0.006) * exp(-age * 3.2) * uBladeC.x;
  }
`;

export const BLADE_VERT_PARS = /* glsl */ `
  #ifdef BLADE_FLUID
    uniform vec4 uBlade;
    uniform vec4 uBladeB;
    uniform vec4 uBladeC;
    uniform vec4 uFluidA;
    ${RING}
  #endif
`;

export const BLADE_VERT = /* glsl */ `
  #ifdef BLADE_FLUID
  if (aFold.y > 0.0) {   // (the blade: the bead in the cup has no fold)
    float bu = aFold.x, bv = aFold.y, bs = uBlade.x;
    // the fluid lags the swing: the outer blade bowed back, the side it trails stretched out
    float bow = pow(bv, 1.6), trail = max(0.0, bu * sign(uBladeB.x)) * smoothstep(0.05, 0.4, bv);
    transformed.x += uBladeB.x * (bow + 0.45 * trail);
    transformed.z += uBladeB.y * bow;
    // a wave running up the edges while it smears, and the ripple's ring bulging it
    transformed.x += (sin(bv * 22.0 - uFluidA.z * 9.0) * 0.004 * bs + 0.01 * bladeRing(bv)) * bu;
  }
  #endif
`;

/**
 * The blade's colour (materials.js fluidAlbedo, kind 6): replaces the FLUID block's bladeFluid(t). Without
 * BLADE_FLUID (a FLUID material of another kind compiles the branch too) the plain currents.
 */
export const BLADE_FLUID_GLSL = /* glsl */ `
  #ifdef BLADE_FLUID
  uniform vec4 uBlade;
  uniform vec4 uBladeB;
  uniform vec4 uBladeC;
  ${RING}
  float bladeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // what the colour leaves the light (bladeLight): the glowing bits, the ripples' field
  float bladeSpark, bladeWave;
  // the meniscus: how far in from the edge (share of the half-width) the fluid's skin stands, wobbling;
  // the side it trails (uBladeB.x's sign) frays while it smears; a ripple's ring pushes it out
  float bladeSkin(float u, float v, float t) {
    float side = u > 0.0 ? 1.0 : -1.0;
    float w = 0.035 + 0.035 * vnoise(vec2(v * 11.0 - t * 1.7, side * 3.1)) + 0.015 * sin(v * 37.0 - t * 5.0 + side);
    float fray = clamp(side * uBladeB.x / 0.03, 0.0, 1.0) * uBlade.x;
    w += 0.1 * fray * smoothstep(0.3, 0.8, vnoise(vec2(v * 7.0 - t * 4.0, side * 5.0 + 7.0)));
    w -= 0.04 * bladeRing(v);
    return max(w, 0.0) * smoothstep(0.03, 0.12, v) * (1.0 - smoothstep(0.93, 0.99, v));
  }
  #endif
  vec3 bladeFluid(float t) {
    float u = vFold.x, v = vFold.y;
    #ifdef BLADE_FLUID
    float s = uBlade.x;
    bool lite = uBlade.w > 0.5;
    // (stretched up the blade: the currents run along it as streaks; smeared, back across it)
    vec2 p = vec2(u * 1.7 * (1.0 - 0.2 * s) + (0.8 + 0.7 * s) * v, v * 3.6 - t * 0.6);
    #else
    vec2 p = vec2(u * 1.7 + 0.8 * v, v * 3.6 - t * 0.6);
    #endif
    vec2 q = vec2(vnoise(p * vec2(1.0, 2.0) + vec2(0.0, t * 0.3)), vnoise(p * vec2(1.3, 2.4) + vec2(5.2, 1.3) - vec2(t * 0.2, 0.0)));
    float f = vnoise(p + 1.7 * q + vec2(1.7, 9.2));
    float g = vnoise(p * vec2(1.6, 2.6) + 1.3 * q.yx + vec2(4.1, 2.7));
    float cream = f - 0.18 * u - 0.15 * smoothstep(0.7, 1.0, v) - 0.2 * (1.0 - smoothstep(0.05, 0.3, v));   // (the currents lie toward the trailing edge, from a quarter of the way up)
    // soft where they meet (as water mixes)
    vec3 col = mix(uFluidBase, fluidTone(1), 0.85 * smoothstep(0.36, 0.22, g - 0.1 * (1.0 - v)));   // deep pools, more by the hilt
    col = mix(col, fluidTone(0), smoothstep(0.7, 0.77, cream));
    col = mix(col, fluidTone(2), 0.5 * smoothstep(0.55, 0.62, g) * (1.0 - smoothstep(0.62, 0.7, g)));   // pale glints between them
    #ifdef BLADE_FLUID
    // the pen round the currents: a fine line in a darker teal where they meet the water (soft ink: post.js draws none inside it)
    float cfw = max(fwidth(cream), 1e-4);
    col = mix(col, fluidTone(1) * 0.72, 0.75 * (1.0 - smoothstep(0.4, 1.2, abs(cream - 0.735) / cfw)) * (1.0 - smoothstep(0.05, 0.12, cfw)) * step(0.001, v));
    #endif
    float ridge = (1.0 - smoothstep(0.03, 0.08, abs(u - 0.12 * v))) * smoothstep(0.12, 0.3, v) * (1.0 - smoothstep(0.86, 0.97, v));
    #ifdef BLADE_FLUID
    col = mix(col, fluidTone(5), 0.55 * ridge);
    bladeSpark = 0.0; bladeWave = g;
    float body = step(0.001, v);   // (the bead has no fold: none of the blade's marks on it)
    if (!lite) {
      // the ripples: fine pale lines where a second warped field crosses its middle, a pen-width at any distance
      float cn = vnoise(p * vec2(2.2, 3.1) + 2.2 * q + vec2(t * 0.35, -t * 0.5));
      float cw = max(fwidth(cn), 1e-4);
      float caus = (1.0 - smoothstep(0.5, 1.5, abs(cn - 0.5) / cw)) * (1.0 - smoothstep(0.06, 0.16, cw)) * smoothstep(0.08, 0.3, v);
      col = mix(col, mix(fluidTone(2), fluidTone(5), 0.4), 0.6 * caus * body);
      bladeWave = cn;
      // the motes: small bubbles rising toward the point, a column of cells (about 2.5 cm) each at its own pace
      vec2 m = vec2(u * 0.055, v * 0.85) / 0.025;
      float col0 = floor(m.x), pace = 0.12 + 0.22 * bladeHash(vec2(col0, 3.7));
      m.y -= t * pace / 0.025;
      vec2 cell = floor(m), fc = fract(m) - 0.5;
      float h = bladeHash(cell + vec2(1.3, 7.1));
      vec2 c = (vec2(bladeHash(cell + 4.1), bladeHash(cell + 9.3)) - 0.5) * 0.5 + vec2(0.08 * sin(t * 3.0 + h * 6.3), 0.0);
      float r = 0.13 + 0.1 * fract(h * 13.7), d = length(fc - c), mw = max(fwidth(m.y), 1e-4);
      float inside = step(0.8, h) * smoothstep(0.1, 0.25, v) * (1.0 - smoothstep(0.85, 0.95, v)) * body;
      // (a bubble: a pale ring with a bright glint up one side)
      float ringB = (1.0 - smoothstep(0.0, 1.6 * mw, abs(d - r) - 0.25 * mw)) * inside;
      float glint = (1.0 - smoothstep(0.0, 1.2 * mw, length(fc - c - vec2(0.35, 0.4) * r) - 0.3 * r)) * inside;
      col = mix(col, mix(fluidTone(2), fluidTone(5), 0.5), 0.8 * ringB);
      col = mix(col, vec3(1.0), glint);
      bladeSpark = max(bladeSpark, max(0.6 * ringB, 0.9 * glint));
    }
    // the skin's line: thin and bright on the leading edge, gold on the trailing (a pixel and a half at least)
    float skin = bladeSkin(u, v, t), fu = max(fwidth(u), 1e-4);
    float edge = (1.0 - smoothstep(0.0, max(0.07, 2.2 * fu), 1.0 - abs(u) - skin)) * smoothstep(0.02, 0.08, v);
    col = mix(col, u > 0.0 ? mix(fluidTone(5), vec3(1.0), 0.3) : fluidTone(3), edge * body);
    bladeSpark = max(bladeSpark, (u > 0.0 ? 1.0 : 0.6) * edge * body);
    // a hit's or a parry's ring running along it, and the flash
    float ring = bladeRing(v) * body;
    col = mix(col, mix(mix(fluidTone(5), vec3(1.0), 0.25), fluidTone(3), uBladeC.y), clamp(ring, 0.0, 1.0) * 0.85);
    col = mix(col, fluidTone(5), uBladeC.z * 0.45);
    bladeSpark = max(bladeSpark, min(ring, 1.0));
    #else
    col = mix(col, fluidTone(5), 0.75 * ridge);
    col = mix(col, u > 0.0 ? fluidTone(2) : fluidTone(3), smoothstep(0.84, 0.95, abs(u)));
    #endif
    return col;
  }
  #ifdef BLADE_FLUID
  // its light (after the light term, as the chimes' crystal): the rim, the sun's flecks, the breathing inner glow
  void bladeLight(inout vec3 albedo, inout float L, inout float emit, vec3 n) {
    vec3 V = normalize(-vWorldRel);
    float ndv = abs(dot(n, V));
    float sun = smoothstep(-0.04, 0.12, uSunDir.y) * (1.0 - 0.8 * uNight);
    float dark = max(uNight, 1.0 - sun);
    // a pale rim where the faces turn away (the water's thickness seen edge-on)
    float rim = pow(1.0 - ndv, 3.0);
    albedo = mix(albedo, fluidTone(5), 0.45 * rim);
    // flecks of sunlight on the ripples (the face's mirror ray near the sun, broken up by the ripples' field);
    // no sun: a softer glint off a light over your shoulder
    vec3 refl = reflect(-V, n);
    float wob = (bladeWave - 0.5) * 0.06;
    float fleck = smoothstep(0.955, 0.975, dot(refl, uSunDir) + wob) * sun;
    fleck = max(fleck, smoothstep(0.975, 0.99, dot(refl, normalize(V + vec3(0.0, 0.55, 0.0))) + wob) * (1.0 - sun) * 0.7);
    albedo = mix(albedo, vec3(1.0), fleck);
    // the inner glow: breathing, fuller with the magic bar full, over the bloom threshold after dark
    float breath = 0.5 + 0.5 * sin(uBlade.z);
    float glow = ${BLADE_LOOK.glow.toFixed(2)} + ${BLADE_LOOK.night.toFixed(2)} * dark + ${BLADE_LOOK.breath.toFixed(2)} * breath + ${BLADE_LOOK.full.toFixed(2)} * smoothstep(0.85, 1.0, uBlade.y) + 0.35 * uBladeC.z;
    albedo = mix(albedo, mix(albedo, fluidTone(5), 0.35), 0.2 * dark);   // (paler at night: lit from within)
    // lit, always (its shade is its own tones): no shadow line across it
    L = max(L, uToon + 0.1 + 0.2 * ndv);
    emit = max(emit, max(glow, max(0.95 * bladeSpark, 0.95 * fleck)));
  }
  #endif
`;

/** In main(), with the other fluids' discards: the meniscus (the skin's wobbling edge). */
export const BLADE_DISCARD = /* glsl */ `
  #ifdef BLADE_FLUID
  if (vFold.y > 0.0 && abs(vFold.x) > 1.0 - bladeSkin(vFold.x, vFold.y, uFluidA.z)) discard;
  #endif
`;

/** In main(), with the chimes' crystal: soft ink with a pen line (its outline only). */
export const BLADE_INK = /* glsl */ `
  #ifdef BLADE_FLUID
    gHatch.rgb = vec3(uBladeC.w, 0.0, 0.0);
    gHatch.a += 8.0;
  #endif
`;
