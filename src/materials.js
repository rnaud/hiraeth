import * as THREE from 'three';
import { PORTRAIT_GLSL } from './face.js';
import { FACE_INK_GLSL, FACE_FLAT_GLSL, FACE_ROUND_GLSL } from './face-ink.js';
import { EYE_TILT } from './eyes.js';
import { CREASE_GLSL } from './creases.js';
import { BIOME_GLSL } from './biome.js';
import { CROWD_GLSL, TRIM_GLSL } from './crowd-shader.js';
import { GROUND_GLSL, GROUND, PEBBLES } from './ground-ink.js';
import { GLYPH_GLSL } from './glyphs.js';
import { GRASS_VERT_PARS, grassUniforms } from './grass-shader.js';
import { BRUSH_GLSL, brushUniforms } from './brush.js';
import { WATER_GLSL, WATER_MARK, waterMaterial } from './water-shader.js';

// ---------------------------------------------------------------------------
// G-buffer surface material.
//
// Every object in the world uses this material. It does NOT produce the final
// image: it writes the raw ingredients the Moebius post-process needs into two
// render targets (MRT):
//
//   location 0 : rgb = flat albedo (with procedural strata / sand patches)
//                a   = light term (half-lambert * cast shadow), 0..1
//   location 1 : rgb = world normal, a = linear view depth (0 = sky)
//   location 2 : r = single hatch / stipple, g = cross hatch,
//                b = drawn detail lines: grids, glyphs, sand ripples, cracks,
//                    fissures (all anchored to surfaces)
//
// All the stylisation (toon bands, hatching, ink lines, fog, sky, paper)
// happens in post.js, which keeps the look consistent across all objects.
// ---------------------------------------------------------------------------

export const MODE_PLAIN = 0;
export const MODE_TERRAIN = 1;
export const MODE_STRATA = 2;
export const MODE_WATER = 3;
export const MODE_OUTFIT = 4;
export const MODE_RIBBON = 5;   // hover trail: flat colour bands along aFold.x   // skinned people: clothes by body region (rest pose)
export const MODE_EYE = 6;      // a person's eyeballs: white, iris (uColor2) and pupil following uEyeLook, lids (uSkin) blinking (eyes.js)

export const sharedUniforms = {
  uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.3).normalize() },
  uShadowMap: { value: null },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowBias: { value: 0.0002 },
  uShadowNormalOffset: { value: 0.35 },
  // finest cascade, a few metres around the player: crisp character shadows
  // that don't crawl across a coarse texel grid while you move
  uShadowMap0: { value: null },
  uShadowMatrix0: { value: new THREE.Matrix4() },
  uShadowBias0: { value: 0.00005 },
  uShadowNormalOffset0: { value: 0.03 },
  // second, wider shadow range (cascade) for distant terrain and mesas
  uShadowMap2: { value: null },
  uShadowMatrix2: { value: new THREE.Matrix4() },
  uShadowBias2: { value: 0.0005 },
  uShadowNormalOffset2: { value: 2.0 },
  // each cascade's texel in metres (fine, near, far): the filter widens to the pixel's
  // footprint where a texel is smaller than a pixel, instead of aliasing
  uShadowTexel: { value: new THREE.Vector3(0.0117, 0.107, 1.12) },
  uShadowTaps: { value: 9 },      // PCF taps: 9 (a sliding 5x5-texel tent) or 4 (3x3, the handheld preset): shadows.js tentTaps
  uTime: { value: 0 },
  // the world's wind for the plants (flora.js sway): x, z downwind direction, strength (0 still,
  // 1 a fresh breeze, up to ~3 in a storm), gust 0..1 (main.js sets it from wind.js every frame)
  uWind: { value: new THREE.Vector4(1, 0, 0.6, 0.4) },
  // the traveller brushing past the plants and through the grass: their recent steps, each weighted
  // by the plants' spring (brush.js BrushTrail, updated by main.js every frame)
  ...brushUniforms(),
  // Shared with the post pass (same uniform objects).
  uToon: { value: 0.5 },
  uHatch: { value: 1 },
  uHatchSpacing: { value: 5.5 },
  uPixelRatio: { value: 1 },
  uShadeStyle: { value: 0 }, // 0 = hatching, 1 = stipple (Sable-style dotting)
  uClouds: { value: 0.6 },       // cloud cover, shared with the sky in post.js
  // local lights (glowing crystals, eggs, portals, the jetpack flame): xyz + radius
  uLights: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, -1e5, 0, 0)) },
  uLightCount: { value: 0 },   // how many of uLights are lit (packed first)
  uFormHatch: { value: 1 },      // strokes follow slopes / wrap round objects
  uDots: { value: 0 },           // pen dotting on the ground (print style)
  uCloudShadows: { value: 1 },
  // the sky, shared with post.js (timeofday.js writes them every frame): metals reflect it,
  // windows light up at night
  uSkyTop: { value: new THREE.Color('#8ccfd2') },
  uSkyHorizon: { value: new THREE.Color('#f7ecd2') },
  uNight: { value: 0 },
  // what a metal sees below the horizon: the world's ground colour (setEnvGround, per level)
  uEnvGround: { value: new THREE.Color('#b9a98c') },
  // the shade's tones (the ink presets set them, post.js PRESETS; SHADE below): how far a form
  // turned from the sun is lifted toward its lit colour (the half-tone between light and cast
  // shadow), how far faces turned down are lifted by the light the ground throws back, and how
  // much of its own hue a shaded surface keeps instead of the world's shadow tint's
  uHalftone: { value: 0 },
  uBounce: { value: 0 },
  uShadeKeep: { value: 0 },
  // weathering at low detail (the handheld): the grime and the chips' tone only, no cracks or lip shadows
  uWearLite: { value: 0 },
};

// ---------------------------------------------------------------------------
// The shade's tone, per pixel (docs/systems/materials.md, "Shade and hatching by surface"). post.js used to shade every
// surface with albedo × the world's one shadow tint. A material now says how its shade differs
// (makeMaterial({ shade, shadeHue, hatch })) and the surface shader adds the light's geometry:
//   lift   0..1, how far the shade is lifted toward the lit colour: the material's own (bone, a
//          sail's cloth, a dish), the half-tone of a form turned from the sun but under no cast
//          shadow (uHalftone; less on the far side of the form, past SHADE.band), and the light
//          the ground throws back up onto faces turned down (uBounce: a cap's underside)
//   hue    0..1, how much of its own hue the shade keeps: 0 the world's tint, 1 the tint's
//          darkness only, a little warm (sand, bone and metal stay themselves in shadow)
// They travel to post.js packed in the hatch channels (gHatch.r += 2 × (1 + hue step), gHatch.g
// += 2 × lift step: the strokes themselves stay in 0..1); a pixel with nothing packed (other
// shaders, grass) takes the world's defaults. Hatching thins as the shade is lifted.
//   flat   0..1, a shade printed flat in the world's shadow colour at the surface's value, whatever
//          its hue (post.js uShadowFlat, the world's; makeMaterial({ shadeFlat }) a material's own:
//          Vael II's cream, peach and rose rock all go one grey-blue in shade, its flowers don't).
//          Packed in the hue's steps past the hues (hue steps 1 + hues + 1 … + flats: a material
//          says its flat print or its hue, not both)
// ---------------------------------------------------------------------------
/**
 * Spot blacks (post.js uSpot, uSpotTone): a material may say how much of the world's spot-black tier
 * it takes (makeMaterial({ spot }), 0..1 in `steps` steps; unsaid: the world's). Packed over its drawn
 * detail: gHatch.b += 4 × (1 + step) (the detail stays under 2, the half-float holds it). A cloud says 0.
 */
export const SPOT = { steps: 2 };
/** The step packed for a material's spot amount (0: the world's). */
export const spotStep = (spot) => (spot === undefined || spot === null || spot < 0 ? 0 : 1 + Math.round(Math.min(spot, 1) * SPOT.steps));
/** A flat (faceted) surface this close to edge-on to the sun (|n·l|) is shaded whole: no lit specks on the toon threshold. */
export const FACET_EDGE = 0.03;
/** n·l over which a smooth surface's own shadow map is faded in from its terminator (no teeth along it: "Stable in motion"). */
export const TERMINATOR = 0.08;
/** ...only on forms large on screen: the normal's turn per pixel (length of fwidth(n)) over which it is let go. */
export const TERMINATOR_TURN = [0.02, 0.06];
/**
 * Strokes near the pixel grid's own frequency alias: a family of hatch lines under ~4 px apart crawls and
 * flickers as it slides under the pixels (a shaded wall seen at 40 m). Over these periods per pixel (4 px →
 * 2.2 px apart) a level of strokes fades to its mean tone instead: the same darkness, no pattern to alias
 * ("Shimmer", rendering.md).
 */
export const HATCH_AA = [0.25, 0.45];
/**
 * The shadow map's lit fraction steepened about a half (x3, clamped) before it shades: the toon threshold
 * then cuts a cast shadow near its true edge (the filter's 0.5) whatever the surface's facing. Unsteepened,
 * a sunny face cut it at 0.24, so a shadow shrank by most of the filter's width (and grew on a face turned
 * half away); the filter couldn't widen to smooth the edge without eating small shadows away.
 */
export const SHADOW_CUT = 3;
/** The steepening, as the shader does it (getShadow). */
export const shadowCut = (s) => Math.min(1, Math.max(0, (s - 0.5) * SHADOW_CUT + 0.5));
export const SHADE = { lifts: 15, hues: 8, flats: 5, band: 0.42, warm: [1.06, 0.98, 0.9], slip: [0.16, 0.36] };   // slip: the ground's slope (1 - n.y) over which sand hatches fully
/**
 * Line weight and colour by material (post.js 1b; docs/systems/rendering.md, "The G-buffer's layout"): the sheets draw
 * soft things (clouds, reeds, foliage, glass, painted signs) in thin, lighter lines in a dark shade of their own
 * colour, solid things in black. makeMaterial({ line, lineTint }): `line` the weight (1 the world's ink … 0.25 a
 * hairline, the nearest of `weights`), `lineTint` 0..1 (0 the ink, 1 a dark shade of its own colour: its albedo in the
 * world's shadow tint, darker; `tints` steps). Packed over the light term: gAlbedoLight.a = L + 2 × step, step =
 * weight step + 4 × tint step (0: the world's ink, as every material says by default), under 32 in the half float.
 * In post.js a weight is the line's opacity (`alpha`) and how much of it is drawn past the material's own edge
 * (`far`: a thin line stays on its own side of a silhouette, half as wide).
 */
export const LINE = { weights: [1, 0.7, 0.45, 0.25], alpha: [1, 0.82, 0.66, 0.5], far: [1, 0.45, 0, 0], tints: 4 };
/** The step packed for a material's line (0: the world's ink). */
export function lineStep(o) {
  // (glass a thin line in its own colour, foliage a lighter one in its dark green, unless they say)
  const leaves = o.pattern === 'leaves';
  const w = o.line ?? (o.glass ? 0.45 : leaves ? 0.7 : 1), t = o.lineTint ?? (o.glass ? 0.7 : leaves ? 0.67 : 0);
  let wi = 0;
  LINE.weights.forEach((v, i) => { if (Math.abs(v - w) < Math.abs(LINE.weights[wi] - w)) wi = i; });
  return wi + 4 * Math.round(Math.min(Math.max(t, 0), 1) * (LINE.tints - 1));
}
/** The light term with a line step over it (mirrors the GLSL): L in 0..1. */
export const packLight = (L, step) => Math.min(Math.max(L, 0), 1) + 2 * step;
/** post.js' unpacking: [L, weight, tint (0..1)]. */
export function unpackLight(a) {
  const q = Math.floor(a * 0.5);
  return [a - 2 * q, LINE.weights[q % 4], Math.floor(q / 4) / (LINE.tints - 1)];
}
/**
 * A material's shade: [lift, hue (-1: the world's), hatch amount, strata strokes]. Metal keeps its own
 * tones and few strokes; sand (terrain with ripples or wind strokes) is shaded in fewer strokes; rock
 * in strata is hatched along its beds, lit or not (strataHatch: how many of them).
 */
export function shadeOf(o) {
  const metal = !!o.metal, sand = (o.mode ?? MODE_PLAIN) === MODE_TERRAIN && (o.ripples || o.sandInk);
  const strata = (o.mode ?? MODE_PLAIN) === MODE_STRATA;
  // (the second: the hue kept, 0..1, -1 the world's; or 2 + its own flat print, 0..1)
  const hue = o.shadeFlat !== undefined ? 2 + Math.min(Math.max(o.shadeFlat, 0), 1) : o.shadeHue ?? (metal ? 0.5 : sand ? 0.55 : -1);
  return [o.shade ?? 0, hue, o.hatch ?? (metal ? 0.35 : sand ? 0.55 : 1), o.strataHatch ?? (strata ? 0.5 : 0)];
}
/** The hue step packed (mirrors the GLSL): 0 the world's, 1 … hues + 1 a hue kept, then the flat prints. */
const hueStep = (hue) => (hue < 0 ? 0 : hue >= 2 ? SHADE.hues + 2 + Math.round(Math.min(hue - 2, 1) * SHADE.flats) : 1 + Math.round(Math.min(hue, 1) * SHADE.hues));
/** The packing (mirrors the GLSL): strokes h1, h2 in 0..1 with a lift and a hue (-1, or 2 + a flat print) → gHatch.r, g. */
export function packShade(h1, h2, lift, hue) {
  const lq = Math.round(Math.min(Math.max(lift, 0), 1) * SHADE.lifts);
  return [h1 + 2 * hueStep(hue), h2 + 2 * lq];
}
/** post.js' unpacking: [h1, h2, lift, hue (-1: the world's), flat print (-1: the world's)]. */
export function unpackShade(r, g) {
  const hq = Math.floor(r * 0.5), lq = Math.floor(g * 0.5), flat = hq > SHADE.hues + 1;
  return [r - 2 * hq, g - 2 * lq, lq / SHADE.lifts, hq > 0 && !flat ? (hq - 1) / SHADE.hues : -1, flat ? (hq - SHADE.hues - 2) / SHADE.flats : -1];
}

// ---------------------------------------------------------------------------
// Metals (makeMaterial({ metal })): ligne-claire metal, drawn as flat shapes.
//  - the reflection: the view reflected off the surface looks at the sky, the bright horizon
//    or the ground, and each is one flat tone (chrome also has the dark band just under the
//    horizon that makes a chrome bumper read as chrome)
//  - coloured metals (brass, copper) tint every tone with their own colour
//  - the sun's highlight is one crisp shape, near white; post.js inks its edge like any colour edge
//  - brushed metal: fine streaks along an axis, and the highlight stretched across them
// kind: the shader's branch; refl: how much of the world it shows; hl: the highlight's size (rad).
// ---------------------------------------------------------------------------
export const METALS = {
  painted: { kind: 0, color: '#c8553d', refl: 0.1, hl: 0.16 },
  steel:   { kind: 1, color: '#9aa6b2', refl: 0.5, hl: 0.22 },
  chrome:  { kind: 2, color: '#d8dee6', refl: 0.92, hl: 0.12 },
  brass:   { kind: 3, color: '#d0a442', refl: 0.75, hl: 0.2 },
  copper:  { kind: 4, color: '#c47548', refl: 0.7, hl: 0.2 },
  iron:    { kind: 5, color: '#5f6168', refl: 0.22, hl: 0.14 },
};
const BRUSH_AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

const METAL_GLSL = /* glsl */ `
  uniform vec4 uMetal;   // kind (METALS), brushed 0/1, reflectivity, highlight size (rad)
  uniform vec3 uBrushAxis;
  in vec3 vMetalT;
  float lum3(vec3 c) { return dot(c, vec3(0.3, 0.55, 0.15)); }
  // The metal's flat tones. sunLit: the sun reaches this point (1) or not (0).
  // ink: the brushed hairlines (drawn detail). Call in uniform control flow (derivatives).
  vec3 metalAlbedo(vec3 base, vec3 n, float sunLit, out float ink) {
    ink = 0.0;
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 R = reflect(-V, n);
    float kind = uMetal.x, refl = uMetal.z;
    // what the reflection sees: the sky, the bright horizon or the ground, a little wavy
    float ry = R.y + (vnoise(R.xz * 2.6 + vec2(kind * 3.1)) - 0.5) * 0.09;
    float fy = max(fwidth(ry), 1e-4) * 0.75;
    float up = smoothstep(0.32 - fy, 0.32 + fy, ry);
    float down = 1.0 - smoothstep(-0.04 - fy, -0.04 + fy, ry);
    vec3 skyC = mix(uSkyHorizon, uSkyTop, 0.85);
    vec3 env = mix(mix(uSkyHorizon, skyC, up), uEnvGround, down);
    vec3 c;
    if (kind > 1.5 && kind < 2.5) {
      // chrome: the world itself, and the dark band just under the horizon
      float band = down * smoothstep(-0.24 - fy, -0.24 + fy, ry);
      env = mix(env, uEnvGround * 0.78, down);
      env = mix(env, mix(uEnvGround, vec3(0.16, 0.15, 0.21), 0.72), band);
      c = mix(base, env * mix(vec3(1.0), base / max(lum3(base), 0.05), 0.12), refl);
    } else {
      // the metal's own colour in three tones: bright at the horizon, a little less in the sky, dark below
      bool warm = kind > 2.5 && kind < 4.5;
      float m = mix(mix(warm ? 1.3 : 1.22, warm ? 1.08 : 1.04, up), warm ? 0.66 : 0.74, down);
      vec3 tone = base * m;
      vec3 seen = env * lum3(base) / max(lum3(env), 0.05) * m;    // the world's colour at the metal's value
      c = mix(base, mix(tone, seen, warm ? 0.14 : 0.42), refl);
    }
    // brushed: fine streaks along the axis (object space: they ride with the object). Compiled
    // only for brushed metal (METAL_BRUSHED): on the others it multiplied by zero, five noise taps a pixel
    #ifdef METAL_BRUSHED
    float brushed = uMetal.y;
    vec3 Bo = cross(uBrushAxis, normalize(vObjNormal));
    float u = dot(vObjPos, normalize(Bo + 1e-5)) * 70.0, along = dot(vObjPos, uBrushAxis);
    float fu = max(fwidth(u), 1e-4);
    float st = vnoise(vec2(u, along * 3.0)) * 0.6 + vnoise(vec2(u * 0.31 + 5.0, along * 0.8)) * 0.4;
    c *= 1.0 + (st - 0.5) * 0.16 * brushed * (1.0 - smoothstep(0.3, 0.9, fu));
    float k = u / 9.0, id = floor(k + 0.5);
    float hair = inkLine(abs(k - id) / max(fu / 9.0, 1e-5), 0.6) * step(0.82, hash(vec2(id, 3.3)))
               * smoothstep(0.35, 0.6, vnoise(vec2(id * 1.7, along * 2.5))) * (1.0 - smoothstep(0.06, 0.16, fu / 9.0));
    ink = hair * 0.3 * brushed;
    #else
    const float brushed = 0.0;
    #endif
    // the sun's highlight: one crisp shape (stretched across the streaks when brushed)
    float s = dot(R, uSunDir), c0 = cos(uMetal.w);
    float fs = max(fwidth(s), 1e-4);
    float spot = smoothstep(c0 - fs, c0 + fs, s);
    float c1 = cos(uMetal.w * 2.3), sheen = smoothstep(c1 - fs, c1 + fs, s) * (1.0 - brushed) * sunLit;   // a paler ring round it
    #ifdef METAL_BRUSHED
    vec3 H = normalize(uSunDir + V);
    float th = dot(vMetalT, H), fth = max(fwidth(th), 1e-4), wb = uMetal.w * 0.45;
    float streak = (1.0 - smoothstep(wb - fth, wb + fth, abs(th))) * smoothstep(0.25, 0.4, dot(n, H));
    float hl = mix(spot, streak, brushed) * sunLit;
    #else
    float hl = spot * sunLit;
    #endif
    vec3 hc = mix(vec3(1.0, 0.99, 0.95), base, kind > 2.5 && kind < 4.5 ? 0.22 : 0.06);
    c = mix(c, mix(c, hc, 0.38), sheen);
    return mix(c, hc, hl);
  }
`;

/** The metals' ground reflection: the colour of what lies below the horizon here. */
export function setEnvGround(color) {
  if (color) sharedUniforms.uEnvGround.value.set(color);
}

// ---------------------------------------------------------------------------
// One surface shader, compiled per material with only the features it uses (surfaceDefines):
// a uniform branch that is never taken still costs, since the GPU reserves registers for the
// heaviest path (the faces' ink, the desert's ground) in every program. Each S_* define
// guards the code of one feature; its uniform still decides inside, as before. Without
// SURFACE_SPEC (a shader made some other way) everything is compiled, as it always was.
// The features set this way never change after makeMaterial (their uniforms are only read).
// ---------------------------------------------------------------------------
export const SURFACE_FEATURES = ['S_FIGURE', 'S_EYE', 'S_PORTRAIT', 'S_CREASES', 'S_TERRAIN', 'S_BIOMES', 'S_RIPPLES', 'S_TICKS', 'S_SANDINK',
  'S_STRATA', 'S_RIBBON', 'S_WATERMODE', 'S_FACADE', 'S_TILES', 'S_LEAVES', 'S_CRACKS', 'S_GLYPHS', 'S_GRID', 'S_PLATES', 'S_WEATHER', 'S_DETAIL', 'S_FORM', 'S_PATCH', 'S_FOLDS', 'S_SCRUB', 'S_GLASS', 'S_MAP'];
const SURFACE_ALL = /* glsl */ `
  #ifndef SURFACE_SPEC
  ${SURFACE_FEATURES.map((f) => `#define ${f}`).join('\n  ')}
  #define METAL_BRUSHED
  #endif
`;
const PATTERNS = { facade: 1, tiles: 2, leaves: 3, cracks: 4 };
/**
 * Weathering (S_WEATHER, weatherInk): how worn a material's walls are, 0..1. Asked for with
 * o.weathered (true: 1), and on by default for house fronts (pattern 'facade'), never on metal,
 * glass, lights or the makers' work (their inscriptions: glyphs). Worn by time: grime streaks run
 * down from the tops of the wall's cells (storeys, sills), chips where the plaster has broken away
 * (the darker layer under it, an inked edge, the lip's cast shadow on the sun's side), cracks with a
 * shadow side, each building its own amount and pattern; post.js darkens the dust splashed up its
 * foot (gHatch.b +16 marks a weathered pixel). cell: a crack's cell along and up the wall (m);
 * cracks: the share of cells with one; patches: of the wall.
 */
export const WEATHER = {
  cell: [3.7, 3.1], cracks: 0.5, patches: 0.24,
  far: [0.03, 0.075],      // m per px over which the pen marks (cracks, the chips' edges) fade out
  farTone: [0.1, 0.28],    // and the tone marks (grime, the chips' exposed fill): larger shapes, kept further
  grime: { cell: [1.3, 2.4], share: 0.75, dark: 0.36, taper: 0.2, minPx: 2.25,   // streaks running down from the tops of the wall's cells (lighter by taper at the foot; none under minPx CSS px wide)
    soft: 2, crisp: [6, 14], faint: 0.065 },   // a small streak (its head under crisp CSS px): its sides ramp over soft px, its tone under post.js's colour edge (faint: rgb step), so no outline; drawn whole and outlined once its head is over crisp px
  chip: { lip: 0.1, dark: 0.42, minPx: [0.75, 1.75] },   // the plaster lip's shadow into a chip (m, how dark; faded out under minPx CSS px wide)
  foot: { height: 0.62, dark: 0.22 },                   // the dust splashed up the foot of a wall (post.js)
};
export function weatheredOf(o) {
  if (o.metal || o.glass || o.glyphs || o.glow || o.mode === MODE_TERRAIN || o.mode === MODE_WATER) return 0;
  const w = o.weathered ?? (o.pattern === 'facade' ? 1 : 0);
  return w === true ? 1 : +w || 0;
}
/**
 * Pen detail at every scale (S_DETAIL, builtDetail / grainDetail): the sheets draw fine marks inside every
 * surface, dense near and thinning with distance. 'built' (walls, hulls, machines): panel seams in rows of
 * uneven height with staggered joints, small rectangles (vents with their slats, hatches, plates), and,
 * near, bolts and small plates; 'organic' (bark, stalks, rock): short grain strokes along the fall of the
 * surface, a coarse and a fine level. On by default ('built') wherever a material is weathered; never on
 * figures, faces, glass, lights, ground or water. Each level fades out by its cell's size on screen
 * (m per px), the fine ones first; the handheld (uWearLite) keeps the coarse level only.
 * [kind (0 none, 1 built, 2 organic), density 0..2]
 */
export const DETAIL = {
  lods: 4,     // levels by distance: the marks drawn at 1, 2, 4, 8 × their size, then gone
  blend: 0.5,  // the share of each level over which the next is cross-faded in
  depth: 260,  // m: none past this (faded from 0.7 of it)
  depthOrganic: 130,
  ink: 1.35,   // how dark the marks are drawn (post.js draws drawn detail over 1 darker; packed under 2)
  built: { base: 0.015, cell: [2.6, 1.9], seams: 0.72, joints: 0.55, rects: 0.48, vents: 0.45, far: [0.03, 0.07], fine: { cell: [0.75, 0.55], share: 0.35, far: [0.008, 0.018] } },
  organic: { base: 0.006, cell: [0.1, 0.26], share: 0.55 },
};
export function detailOf(o) {
  if (o.figure || o.glass || o.glow || o.facePart || o.eye || (o.mode ?? MODE_PLAIN) === MODE_OUTFIT || o.mode === MODE_TERRAIN || o.mode === MODE_WATER) return [0, 0];
  const kind = o.detail === 'organic' ? 2 : o.detail === 'built' ? 1 : o.detail === undefined && weatheredOf(o) > 0 ? 1 : 0;
  return [kind, kind ? Math.min(Math.max(o.detailDensity ?? 1, 0), 2) : 0];
}
/**
 * Hatching that follows the form (S_FORM, formLines): merged geometry has no axis, so a builder gives each
 * part its own (src/form.js formAxis: a point on the axis and its direction, per vertex) and the material
 * says form: true. Kind 1, a cap (a mushroom, an umbrella tree's canopy, a table of rock): the shade's strokes
 * radiate from the axis (the cross-hatch: more of them, between), so a cap's underside is a fan of dense
 * strokes from the stalk and the stalk itself is hatched along its length. Kind 2, a cylinder (a tank, a
 * drum, a tower, a trunk): the strokes wrap round it (rings about the axis; the cross-hatch along it), and
 * its flat ends, where rings would be degenerate, radiate as a cap's. Strokes are isolines of an angle
 * about the axis (a turn is `turn` units: every power-of-two spacing up to it closes on itself, no seam)
 * or of the height along it, thinned by powers of two as the hatch is (every other one fades out).
 */
/** A hatch over 1 (makeMaterial({ hatch })): a hatched mass. Its strokes up to `closer` times closer (no finer:
 *  past ~4 px apart a pen's strokes only read as a tone), and its shade drawn as `heavier` × (hatch − 1) darker. */
export const HATCH_DENSE = { closer: 1.3, heavier: 0.9 };
export const FORM = {
  kinds: { cap: 1, wrap: 2 },
  turn: 1024,              // angle units a turn (2^10: the coarsest level is one stroke a turn)
  cap: { spacing: 0.8, dense: 0.5, keep: 0.45 },  // its strokes' spacing (× the hatch's), the cross-hatch's, how much of them a lifted shade keeps
  wrap: { spacing: 1.0, along: 1.25, keep: 0.2 },
  waver: 0.22,             // how far a stroke wanders, in its spacing
  waverFar: 90,            // m: past this (and on the handheld) no waver, a stroke's own offset only
  // a dark cap's veins (veins: 0..1): lighter lines radiating, lit or not (under the colour-edge threshold), drawn as
  // branches: a line that carries on to the coarser levels (toward the stalk) is a bough, thicker by `bough` a level
  // (up to `boughs` levels), and every line wanders `waver` of its spacing along its length
  veins: { spacing: 2.2, width: 1.5, lift: 0.15, bough: 0.7, boughs: 3, waver: 0.45 },
};
/**
 * Colour across a wall (S_PATCH, wallPatch): the sheets break a building's colour into a few big flat
 * patches, a repaint, a sunlit plane, one storey rendered differently. On by default wherever a material
 * has built pen detail (detailOf: weathered walls, the Market, the Buried Machine's rust and teal), or
 * patches: 0..1. All world-anchored (no seam on a round wall: the cells are boxes in the world, not in a
 * wall's frame), each building its own (the weathering's 9 m cells), a few percent of tone or hue, under
 * post.js's colour-edge threshold: a clean edge, no line of its own. None past far (m).
 * cell: a repaint's cell (m, along and up: it runs over one to three storeys); share: of the cells;
 * band: the share of a building's storeys in another render; tone: how far a patch's colour moves;
 * face: how far each face of a building differs (blended round a curve); building: the coarse lattice's box (m);
 * edge: the most the colour moves (the length of its change); ramp: the edge's width (px), so the step
 * between two neighbouring pixels stays under post.js's colour-edge threshold (0.08) and draws no line.
 */
export const PATCH = { cell: [6.4, 3.3], building: 17.3, share: 0.22, band: 0.09, tone: 0.13, face: 0.06, edge: 0.15, ramp: 1.8, far: [260, 380] };
export function patchesOf(o) {
  if (o.metal || o.glass || o.glow || o.glyphs || o.figure || o.facePart || o.eye) return 0;
  if (o.mode === MODE_TERRAIN || o.mode === MODE_WATER || o.mode === MODE_OUTFIT) return 0;
  const p = o.patches ?? (detailOf(o)[0] === 1 ? 1 : 0);
  return p === true ? 1 : Math.min(Math.max(+p || 0, 0), 1.5);
}
export const formOf = (o) => !!o.form && !o.figure && !o.facePart && !o.eye && !o.glass && (o.mode ?? MODE_PLAIN) !== MODE_TERRAIN && o.mode !== MODE_WATER && o.mode !== MODE_OUTFIT;
const PATTERN_DEFINES = { 1: 'S_FACADE', 2: 'S_TILES', 3: 'S_LEAVES', 4: 'S_CRACKS' };

/** The defines a material made with these options compiles: SURFACE_SPEC and the features it uses. */
export function surfaceDefines(o) {
  const mode = o.mode ?? MODE_PLAIN, d = { SURFACE_SPEC: 1 };
  const on = (k, v) => { if (v) d[k] = 1; };
  on('S_FIGURE', mode === MODE_OUTFIT);
  on('S_EYE', mode === MODE_EYE);
  on('S_PORTRAIT', o.portrait);
  on('S_CREASES', o.creases);
  on('S_TERRAIN', mode === MODE_TERRAIN);
  on('S_BIOMES', o.biomes);
  on('S_RIPPLES', o.ripples);
  on('S_TICKS', o.ticks);
  on('S_SANDINK', o.sandInk);
  on('S_STRATA', mode === MODE_STRATA);
  on('S_RIBBON', mode === MODE_RIBBON);
  on('S_WATERMODE', mode === MODE_WATER);
  on(PATTERN_DEFINES[PATTERNS[o.pattern]], true);
  on('S_GLYPHS', o.glyphs);
  on('S_GRID', o.grid || o.plates);
  on('S_PLATES', o.plates);
  on('S_WEATHER', weatheredOf(o) > 0);
  on('S_DETAIL', detailOf(o)[0] > 0);
  on('S_FORM', formOf(o));
  on('S_PATCH', patchesOf(o) > 0);
  on('S_FOLDS', o.folds);
  on('S_SCRUB', o.scrub);
  on('S_GLASS', o.glass);
  on('S_MAP', o.map);
  on('METAL_BRUSHED', o.metal && o.brushed);
  delete d.undefined;
  return d;
}

const vertexShader = /* glsl */ `
  ${SURFACE_ALL}
  out vec3 vWorldPos;
  out vec3 vWorldRel;   // the world position measured from the camera (small numbers: exact derivatives)
  out vec3 vNormal;
  out vec3 vInstColor;
  out float vViewDepth;
  out vec3 vObjPos;
  out vec3 vObjNormal;
  out vec3 vObjRel;
  out vec3 vBind;
  in vec2 aFold;          // cloth: (across, down) 0..1; (0,0) on everything else
  out vec2 vFold;
  #ifdef S_FORM
    in vec4 aFormC;       // the part's axis (src/form.js): a point on it (object space), w its kind (FORM: 0 none, 1 a cap, 2 a cylinder)
    in vec3 aFormA;       // and its direction
    out vec4 vForm;       // the point about the axis: across it (x, y), along it (z), w the kind
  #endif
  out vec2 vTextureUV;
  #include <skinning_pars_vertex>
  #include <morphtarget_pars_vertex>
  #ifdef FACE_KEYS
    // the MakeHuman faces' shape keys: one texture for every body (src/makehuman/body.js keyTexture),
    // each key a layer, each vertex a texel, scaled by this head (uKeyScale.xyz; w 0: a level of detail, no keys)
    uniform highp sampler2DArray uKeyTex;
    uniform float uKeyW[FACE_KEYS];
    uniform vec4 uKeyScale;
    uniform int uKeyWidth;
  #endif
  uniform vec4 uOutfit;
  uniform float uSuit;
  uniform float uPortrait;
  uniform vec4 uHeadBall;  // portrait: bind-pose head centre, how far its normals round off
  uniform int uMode;
  uniform vec4 uFace;
  ${FACE_ROUND_GLSL}
  #ifdef CROWD
    ${CROWD_GLSL}
  #endif
  #ifdef SWAY
    uniform float uTime;
    uniform float uSway;
    uniform vec4 uWind;
    uniform vec2 uSwayPlant;   // the plant's geometry height (its top), 1 for a large plant
  #endif
  #if defined(SWAY) || defined(GRASS)
    ${BRUSH_GLSL}
  #endif
  #ifdef METAL
    uniform vec3 uBrushAxis;
    out vec3 vMetalT;
  #endif
  #ifdef GRASS
    ${GRASS_VERT_PARS}
  #endif

  void main() {
    vec3 transformed = position;
    // a padded suit: the body swells along its normals (baggier on the legs), not the head or hands
    #ifdef S_FIGURE
    if (uSuit > 0.0 && position.y < uOutfit.z - 0.02 && abs(position.x) < uOutfit.w - 0.03)
      transformed += normal * (position.y < uOutfit.y ? 0.03 : 0.022) * smoothstep(uOutfit.x - 0.04, uOutfit.x + 0.04, position.y);
    #endif
    vec3 objectNormal = normal;
    // shape keys (only meshes that have them: the MakeHuman prototype's faces, src/makehuman/); vBind stays
    // the rest position, so the face ink rides the skin as it moves
    #include <morphnormal_vertex>
    #include <morphtarget_vertex>
    #ifdef FACE_KEYS
    if (uKeyScale.w > 0.5) {
      ivec2 keyAt = ivec2(gl_VertexID % uKeyWidth, gl_VertexID / uKeyWidth);
      for (int i = 0; i < FACE_KEYS; i++) if (uKeyW[i] != 0.0) transformed += texelFetch(uKeyTex, ivec3(keyAt, i), 0).xyz * uKeyScale.xyz * uKeyW[i];
    }
    #endif
    #ifdef S_PORTRAIT
    // Light the face as one rounded volume, so its shadow is a single clean shape.
    if (uPortrait > 0.5) objectNormal = normalize(mix(normal, normalize(position - uHeadBall.xyz), uHeadBall.w));
    #endif
    #ifdef S_FIGURE
    // a person's face lit as one rounded volume too, so its shade is one clean shape (face-ink.js)
    if (uMode == ${MODE_OUTFIT}) objectNormal = faceRound(position, objectNormal);
    #endif
    #ifdef CROWD
      vec3 crowdColor;
      crowdAnimate(transformed, objectNormal, crowdColor);   // instanced crowd: pose + colour zones per instance
    #endif
    #if defined(SWAY) && defined(USE_INSTANCING)
      // instanced plants (flora.js): the top bends with the world's wind, the base stays put. They
      // lean downwind as it blows, flutter with their own phase, and gusts roll across the field as
      // a wave travelling downwind (so a clump bows together, then the next one)
      vec3 swayAt = instanceMatrix[3].xyz;
      float swayK = uSway * max(position.y, 0.0) * max(position.y, 0.0);
      vec2 wd = uWind.xy;
      float str = uWind.z, along = dot(swayAt.xz, wd);
      float wave = 0.5 + 0.5 * sin(uTime * 1.7 - along * 0.09);                 // the gust front
      float push = str * (0.35 + 0.65 * uWind.w * wave);                         // the lean downwind
      float flutter = (0.45 + 0.55 * str) * sin(uTime * (1.3 + 0.9 * str) + swayAt.x * 0.37 + swayAt.z * 0.21);
      vec2 side = vec2(-wd.y, wd.x);
      vec2 bend = wd * (push * 3.0 + flutter * 1.2) + side * sin(uTime * 1.05 + swayAt.z * 0.41 - swayAt.x * 0.13) * 0.6 * (0.5 + 0.5 * str);
      // (in object space: turn the world bend by the instance's own rotation)
      mat3 iRot = mat3(instanceMatrix);
      float iS2 = max(dot(iRot[0], iRot[0]), 1e-4), iS = sqrt(iS2);
      vec3 b = transpose(iRot) * vec3(bend.x, 0.0, bend.y);
      transformed += b * swayK / iS2;   // (transpose / scale²: the inverse of a scaled rotation)
      // the traveller brushing past: a small, quick lean away from them that springs back with a
      // light wobble, more the closer and the faster they pass (brush.js). A small plant bends from
      // its foot, the tip most; a large one only parts its low leaves round your legs.
      float plantH = uSwayPlant.x * iS;   // (m)
      float reach = clamp(0.3 + 0.35 * plantH, 0.45, 1.1);
      vec2 lean = brushLean(swayAt, reach * 0.35, reach, 2.5);
      if (lean.x != 0.0 || lean.y != 0.0) {
        float wy = max(position.y, 0.0) * iS;   // (the height in metres)
        float rel = clamp(position.y / max(uSwayPlant.x, 1e-3), 0.0, 1.0);
        float prof = uSwayPlant.y > 0.5 ? 0.6 * min(wy, 1.3) / 1.3 * (1.0 - smoothstep(1.3, 2.2, wy))
                                        : rel * rel * clamp(plantH / 1.3, 0.3, 1.2);
        transformed += transpose(iRot) * vec3(lean.x, 0.0, lean.y) * prof / iS2;
      }
    #endif
    #ifdef GRASS
      grassPlace(transformed, objectNormal);   // a tuft of blades round the camera (grass-shader.js)
    #endif
    #ifdef USE_SKINNING
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <skinning_vertex>
    #endif
    vTextureUV = uv;
    vBind = position;
    vFold = aFold;
    vec4 pos = vec4(transformed, 1.0);
    vec3 nrm = objectNormal;
    #ifdef USE_INSTANCING
      pos = instanceMatrix * pos;
      nrm = mat3(instanceMatrix) * nrm;
    #endif
    vInstColor = vec3(1.0);
    #ifdef GRASS
      // between the ground's two tones, a shade darker at the root
      // tuft by tuft a shade darker or lighter than the ground, lighter towards the tip
      vInstColor = mix(vec3(1.0), uColor2 / max(uColor, vec3(0.02)), aGrass2.y) * mix(0.8, 1.06, fract(aGrass2.w * 13.7)) * mix(0.94, 1.08, grassT);
    #endif
    #ifdef USE_INSTANCING_COLOR
      vInstColor = instanceColor;
    #endif
    #ifdef CROWD
      vInstColor = crowdColor;
    #endif
    #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
      vInstColor *= color.rgb;   // flat printed colour zones
    #endif
    // Object-space position with the object's scale baked in: hatch strokes
    // are anchored to the object (they move/rotate with it) but keep a
    // metric size, so a 6x boulder gets the same stroke spacing as a pebble.
    mat4 M = modelMatrix;
    #ifdef USE_INSTANCING
      M = modelMatrix * instanceMatrix;
    #endif
    vec3 scl = vec3(length(M[0].xyz), length(M[1].xyz), length(M[2].xyz));
    vObjPos = position * scl;
    vObjNormal = normal / scl;
    #ifdef CROWD
      vObjPos = transformed * scl;     // strokes stay on the moving limbs
      vObjNormal = objectNormal / scl;
    #endif
    // The same point measured from the camera (in the object's frame): small numbers near
    // the camera. Facet normals come from the screen derivatives of this one, so they stay
    // exact on geometry merged far from the origin (a city 460 m out), where derivatives of
    // vObjPos lose their low bits and the hatching on flat walls broke up into noise.
    vec3 camL = cameraPosition - M[3].xyz;
    vObjRel = vObjPos - vec3(dot(M[0].xyz, camL) / scl.x, dot(M[1].xyz, camL) / scl.y, dot(M[2].xyz, camL) / scl.z);
    #ifdef GRASS
      vObjPos = transformed; vObjNormal = objectNormal; vObjRel = transformed - cameraPosition;   // (already in the world)
    #endif
    #ifdef S_FORM
    {
      // the point in the axis' frame, metric as vObjPos (its scale baked in); affine in the position, so it
      // interpolates exactly across a triangle (the angle and the radius are taken per pixel)
      vec3 fa = aFormA * scl;
      float fl = length(fa);
      fa = fl > 1e-6 ? fa / fl : vec3(0.0, 1.0, 0.0);
      vec3 fu = normalize(cross(fa, abs(fa.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), fv = cross(fa, fu);
      vec3 fr = (position - aFormC.xyz) * scl;
      vForm = vec4(dot(fr, fu), dot(fr, fv), dot(fr, fa), aFormC.w);
    }
    #endif

    vec4 world = modelMatrix * pos;
    vWorldPos = world.xyz;
    vWorldRel = world.xyz - cameraPosition;
    vNormal = normalize(mat3(modelMatrix) * nrm);
    #ifdef METAL
      vec3 brushAx = uBrushAxis;
      #ifdef USE_INSTANCING
        brushAx = mat3(instanceMatrix) * brushAx;
      #endif
      vMetalT = normalize(mat3(modelMatrix) * brushAx);
    #endif
    vec4 mv = viewMatrix * world;
    vViewDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  ${SURFACE_ALL}

  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform int uMode;
  uniform float uFlat;
  uniform float uStrataSize;
  uniform float uCracks;   // strata rock: dense cracks and strokes down its faces (0: the sparse fissures only)

  uniform vec3 uSunDir;
  uniform highp sampler2DShadow uShadowMap;
  uniform mat4 uShadowMatrix;
  uniform float uShadowBias;
  uniform float uShadowNormalOffset;
  uniform highp sampler2DShadow uShadowMap0;
  uniform mat4 uShadowMatrix0;
  uniform float uShadowBias0;
  uniform float uShadowNormalOffset0;
  uniform vec3 uShadowTexel;
  uniform float uShadowTaps;
  uniform highp sampler2DShadow uShadowMap2;
  uniform mat4 uShadowMatrix2;
  uniform float uShadowBias2;
  uniform float uShadowNormalOffset2;
  uniform float uGlyphs;
  uniform float uBiomes;    // terrain: desert regions decide the ground palette
  uniform float uSandInk;  // sparse desert wind strokes, no pebble-dot field
  uniform float uRipples;   // terrain: wind ripple marks
  uniform float uTicks;     // terrain: inked grass ticks
  uniform float uGlow;      // self-lit (crystals, eggs): ignores shadow, glows at night
  uniform float uClouds;
  uniform float uCloudShadows;
  uniform vec4 uLights[8];
  uniform int uLightCount;
  uniform float uFormHatch;
  uniform float uTime;
  uniform float uToon;
  uniform float uHatch;
  uniform float uHatchSpacing;
  uniform float uPixelRatio;
  uniform int uShadeStyle;
  uniform float uGrid;
  uniform float uPlates;   // the grid drawn as plating (plateLines)
  uniform float uWindows;  // façades: the share of cells with a window
  uniform float uWeather;  // weathering: grime, chips and cracks on old walls (weatherInk), 0..1
  uniform float uWearLite; // the handheld's lighter weathering (sharedUniforms)
  uniform vec2 uDetail;    // pen detail: kind (1 built, 2 organic), density (DETAIL)
  uniform float uVeins;    // a cap's veins (FORM.veins): lighter lines radiating from its stalk
  uniform float uPatch;    // colour across a wall (PATCH): how many patches, 0..1.5
  uniform float uDrift;    // 1: sand banked against something (sand-drifts.js)
  uniform vec3 uSkyTop;
  uniform vec3 uSkyHorizon;
  uniform vec3 uEnvGround;
  uniform float uNight;
  uniform float uSpotStep;  // its spot-black amount's step (SPOT: 0 the world's)
  uniform float uLineStep;  // its line's weight and colour (LINE: 0 the world's ink), packed over the light term
  uniform vec4 uShade;      // the material's shade: lift, hue (-1: the world's), hatch amount, strata strokes (SHADE, shadeOf)
  uniform float uHalftone;
  uniform float uBounce;

  in vec3 vWorldPos;
  in vec3 vWorldRel;
  in vec3 vNormal;
  in vec3 vInstColor;
  in float vViewDepth;
  in vec3 vObjPos;
  in vec3 vObjNormal;
  in vec3 vObjRel;
  in vec3 vBind;
  in vec2 vFold;
  in vec2 vTextureUV;
  #ifdef S_FORM
    in vec4 vForm;
  #endif
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uFolds;
  uniform float uScrub;
  uniform int uPattern;    // 1 facade, 2 roof tiles, 3 leaves, 4 rock cracks
  uniform float uDots;
  uniform vec3 uSkin;
  uniform vec4 uGlove;    // rgb, a = 1: gloved hands
  uniform float uHero;    // player-only flag, packed above the glow range in gHatch.a
  uniform float uFigure;  // a person (NPC, crowd, costume parts): +4 in gHatch.a, post.js thins their ink with projected size
  uniform float uSuit;    // puffy-suit crease lines at the joints
  uniform vec3 uGlassCenter;
  uniform float uGlass;   // glass: only the rim and a highlight streak are drawn
  uniform vec4 uOutfit;   // bootTop, beltY, neckY, wristX (rest pose, metres)
  uniform vec4 uTrim;     // outfit: the tunic's printed pattern (rgb, costumes.js TRIM_IDS; 0 none)
  #ifdef CROWD
    flat in vec4 vCrowdTrim;
  #endif
  #ifdef GRASS
    flat in vec3 vGrassLook;   // the pen line, the outline's fade, the blend into the ground (grass-shader.js)
  #endif
  ${TRIM_GLSL}
  uniform vec4 uFace;     // eyeY, eyeX, noseY, chinY (rest pose)
  uniform vec4 uMood;     // the face's expression (src/expression.js): smile -1..1, mouth open 0..1, brow -1 (furrow)..1 (raise), squint 0..1
  uniform vec4 uMood2;    // x: brow tilt -1 (inner ends down)..1 (up); y: the nose line's side (+1 the +x side: the shade's); zw spare
  uniform vec4 uFaceKit;  // the face's drawing (src/morph.js FACE_MORPHS): age lines, mouth width, freckles, lid line weight (neutral 1, 1, 0, 1)
  uniform vec4 uFaceKit2; // x: eye size (the lids' size, with the warped eyes), y: nose width, z: cheeks (-1 hollow .. 1 full), w: the ears' bind z
  uniform vec4 uEyeC;     // MODE_EYE: eyeball centre (|x|, y, z, bind space), w = the iris radius on the unit eye
  uniform vec4 uEyeR;     // MODE_EYE: eyeball radii: x, above the centre, below it, z
  uniform vec4 uEyeLook;  // MODE_EYE: where the eyes look (unit, bind space; +z ahead), w = blink (0 open, 1 shut)
  #ifdef CROWD
    flat in vec4 vCrowdEye;   // the crowd's almond eyes: iris colour, w = 1 (open) / 0 (not an eye)
  #endif
  uniform vec3 uPalette[12];
  uniform int uPaletteSize;

  layout(location = 0) out highp vec4 gAlbedoLight;
  layout(location = 1) out highp vec4 gNormalDepth;
  layout(location = 2) out highp vec4 gHatch;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  ${BIOME_GLSL}

  // Hand-rolled shadow map lookup over three cascades (fine, near, far; main.js
  // and shadows.js). "inside" fades out at each map's border so the hand-over
  // between cascades is a blend, not a seam.
  //  - the maps are depth textures with hardware comparison and linear
  //    filtering: every tap is a bilinear 2x2 PCF
  //  - the taps are weighted by a tent that slides with the point inside its
  //    texel (shadows.js tentTaps, Castano's filter from The Witness): 3x3
  //    texels in 4 taps (handheld), 5x5 in 9. The lit fraction is then a smooth
  //    function of the position, and the toon threshold cuts it along a smooth
  //    curve. (A plain box of bilinear taps has a kink at every texel border:
  //    the threshold drew the texel grid into every cast shadow's edge as steps,
  //    worse where the spot tier darkens the shadow and the edge line inks it.)
  //  - normal offset and bias are in texels of each cascade (main.js sets
  //    them from the map size); the offset grows towards grazing light,
  //    where acne starts, and stays small facing the sun (no peter-panning)
  //  - where a texel is smaller than the pixel (far walls in the near
  //    cascade, the handheld's low resolution) the tent spreads to the
  //    pixel's footprint: a filtered edge instead of shimmering texels
  // one tap, o texels from the corner base (texel units), its distance from the point uv scaled by spread
  // (about the point, on the map's own grid: a window moved by whole texels reads exactly the same)
  float shadowTap(highp sampler2DShadow map, vec2 uv, vec2 base, vec2 o, vec2 inv, float spread, float z) {
    return texture(map, vec3((uv + (base + o - uv) * spread) * inv, z));
  }
  float sampleShadow(highp sampler2DShadow map, mat4 m, vec3 wp, vec3 n, float sinL, float off, float bias, float spread, out float inside) {
    vec4 sc = m * vec4(wp + n * (off * (0.35 + 0.65 * sinL)), 1.0);
    vec3 p = sc.xyz / sc.w * 0.5 + 0.5;
    vec2 e = smoothstep(0.0, 0.06, p.xy) * (1.0 - smoothstep(0.94, 1.0, p.xy));
    inside = p.z > 1.0 ? 0.0 : e.x * e.y;
    if (inside <= 0.0) return 1.0;
    float z = p.z - bias;
    // the tent on the map's own texels (tentTaps): st, where the point lies past the nearest texel corner (0..1);
    // where a texel is under the pixel the taps spread about the point (spread), the grid unchanged
    vec2 inv = 1.0 / vec2(textureSize(map, 0));
    vec2 uv = p.xy / inv, base = floor(uv + 0.5), st = uv + 0.5 - base;
    base -= 0.5;
    if (uShadowTaps < 5.0) {
      vec2 w0 = 3.0 - 2.0 * st, w1 = 1.0 + 2.0 * st;
      vec2 o0 = (2.0 - st) / w0 - 1.0, o1 = st / w1 + 1.0;
      return (w0.y * (w0.x * shadowTap(map, uv, base, vec2(o0.x, o0.y), inv, spread, z) + w1.x * shadowTap(map, uv, base, vec2(o1.x, o0.y), inv, spread, z))
            + w1.y * (w0.x * shadowTap(map, uv, base, vec2(o0.x, o1.y), inv, spread, z) + w1.x * shadowTap(map, uv, base, vec2(o1.x, o1.y), inv, spread, z))) / 16.0;
    }
    vec2 w0 = 4.0 - 3.0 * st, w2 = 1.0 + 3.0 * st;
    vec2 o0 = (3.0 - 2.0 * st) / w0 - 2.0, o1 = (3.0 + st) / 7.0, o2 = st / w2 + 2.0;
    float s = w0.y * (w0.x * shadowTap(map, uv, base, vec2(o0.x, o0.y), inv, spread, z) + 7.0 * shadowTap(map, uv, base, vec2(o1.x, o0.y), inv, spread, z) + w2.x * shadowTap(map, uv, base, vec2(o2.x, o0.y), inv, spread, z));
    s += 7.0 * (w0.x * shadowTap(map, uv, base, vec2(o0.x, o1.y), inv, spread, z) + 7.0 * shadowTap(map, uv, base, vec2(o1.x, o1.y), inv, spread, z) + w2.x * shadowTap(map, uv, base, vec2(o2.x, o1.y), inv, spread, z));
    s += w2.y * (w0.x * shadowTap(map, uv, base, vec2(o0.x, o2.y), inv, spread, z) + 7.0 * shadowTap(map, uv, base, vec2(o1.x, o2.y), inv, spread, z) + w2.x * shadowTap(map, uv, base, vec2(o2.x, o2.y), inv, spread, z));
    return s / 144.0;
  }

  // ndl: light facing (> 0); px: the pixel's footprint in metres
  float shadowLit(vec3 wp, vec3 n, float ndl, float px) {
    float iF, i0, i1;
    float sinL = sqrt(max(1.0 - ndl * ndl, 0.0));
    vec3 spread = clamp(vec3(px) / uShadowTexel, 1.0, 2.5);
    float sF = sampleShadow(uShadowMap0, uShadowMatrix0, wp, n, sinL, uShadowNormalOffset0, uShadowBias0, spread.x, iF);
    if (iF >= 1.0) return sF;
    float s0 = sampleShadow(uShadowMap, uShadowMatrix, wp, n, sinL, uShadowNormalOffset, uShadowBias, spread.y, i0);
    if (i0 < 1.0) {
      float s1 = sampleShadow(uShadowMap2, uShadowMatrix2, wp, n, sinL, uShadowNormalOffset2, uShadowBias2, spread.z, i1);
      s0 = mix(mix(1.0, s1, i1), s0, i0);
    }
    return mix(s0, sF, iF);
  }
  // the lit fraction steepened about its half (SHADOW_CUT): the toon threshold cuts the shadow at its true edge
  float getShadow(vec3 wp, vec3 n, float ndl, float px) {
    return clamp((shadowLit(wp, n, ndl, px) - 0.5) * ${SHADOW_CUT.toFixed(1)} + 0.5, 0.0, 1.0);
  }

  // Cloud shadows: the ground point is projected along the light onto a cloud
  // layer ~300 m up, where a drifting fbm field (same threshold as the sky's
  // cloud cover) decides whether it is shaded.
  float cloudShadow(vec3 wp) {
    if (uCloudShadows <= 0.0 || uClouds <= 0.0) return 1.0;
    if (wp.y > 900.0) return 1.0;   // far above the cloud layer (the ship's scenes in orbit): no drifting shadows on the planet
    vec2 onLayer = wp.xz + uSunDir.xz / max(uSunDir.y, 0.15) * (300.0 - wp.y);
    vec2 q = onLayer / 260.0 + vec2(uTime * 0.012, uTime * 0.003);
    float f = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { f += a * vnoise(q); q = q * 2.03 + 17.1; a *= 0.5; }
    float th = mix(0.75, 0.52, uClouds);
    return 1.0 - smoothstep(th - 0.015, th + 0.015, f) * uCloudShadows;
  }

  vec3 strataBand(float band) {
    float t = fract(sin(band * 12.9898) * 43758.5453);
    return t < 0.4 ? uColor : (t < 0.75 ? uColor2 : uColor3);
  }
  vec3 strata(vec3 wp) {
    // Horizontal bands of colour, slightly wavy — the classic Moebius mesa.
    // Once the bands are thinner than a few pixels (a far tower's storeys) they give
    // way to their average colour: no stripes flickering in and out as the camera
    // moves. (The edges stay hard: post.js inks them as one solid line.) Uniform control flow.
    float t = (wp.y + (vnoise(wp.xz * 0.04) - 0.5) * uStrataSize * 0.9) / uStrataSize;
    float gt = max(length(vec2(dFdx(t), dFdy(t))), 1e-6);     // bands per px
    vec3 c = strataBand(floor(t));
    vec3 mean = uColor * 0.4 + uColor2 * 0.35 + uColor3 * 0.25;
    return mix(mean, c, smoothstep(2.5, 5.0, 1.0 / gt));
  }

  // ---------------------------------------------------------------- hatching
  // Pen strokes drawn on the surface itself. A stroke is an isoline of one
  // scalar "stroke coordinate" c(p), so strokes are continuous wherever c is.
  //  - Smooth objects: the three triplanar projections are blended at the
  //    *coordinate* level (not the stroke level), giving a single smooth field
  //    whose stroke angle turns gradually with the surface instead of two
  //    patterns ghosting over each other.
  //  - Terrain: one top-down projection, continuous across every dune crest.
  //  - Faceted objects: one projection per facet, as an inker would do.
  //  - LOD: the world spacing that gives the target on-screen spacing is
  //    measured from fwidth(c) (so foreshortening is accounted for) and
  //    quantised to powers of two. Lines at spacing 2s are a subset of lines
  //    at spacing s, so as you walk away every other line fades out instead
  //    of sliding.
  //  - Width is expressed in pixels (via derivatives), so strokes stay crisp.
  // Derivatives are taken in uniform control flow, so the darkness branch
  // below is safe.

  // Stroke coordinate for direction dir: x = across strokes, y = along strokes.
  vec2 strokeCoord(vec3 w, vec2 dir) {
    vec2 perp = vec2(-dir.y, dir.x);
    vec2 a = vObjPos.zy, b = vObjPos.xz, c = vObjPos.xy;
    return w.x * vec2(dot(a, dir), dot(a, perp))
         + w.y * vec2(dot(b, dir), dot(b, perp))
         + w.z * vec2(dot(c, dir), dot(c, perp));
  }

  float strokesLevel(float c, float fw, float s, float wob, float widthPx) {
    float v = c / s + wob;
    float f = fw / s;                          // periods per pixel
    float d = abs(fract(v + 0.5) - 0.5);       // distance to line (line at fract = 0)
    float hw = 0.5 * widthPx * f;
    float line = 1.0 - smoothstep(hw - 0.6 * f, hw + 0.6 * f, d);
    return mix(line, min(2.0 * hw, 1.0), smoothstep(${HATCH_AA[0].toFixed(3)}, ${HATCH_AA[1].toFixed(3)}, f));   // (too fine to draw: its tone, HATCH_AA)
  }

  // fw = fwidth(ce.x) in world units per device px; spacing / width in CSS px.
  float strokes(vec2 ce, float fw, float spacingPx, float widthPx) {
    float lvl = log2(max(fw * spacingPx * uPixelRatio, 1e-5));
    float s0 = exp2(floor(lvl));
    float t = fract(lvl);
    float s1 = s0 * 2.0;
    widthPx *= uPixelRatio;
    vec2 q = ce / s1;
    float wob = (vnoise(q * vec2(0.3, 0.12)) - 0.5) * 0.3;               // in s1 periods
    float press = 0.75 + 0.5 * vnoise(q * vec2(0.5, 0.6) + 31.0);
    float a = strokesLevel(ce.x, fw, s0, wob * 2.0, widthPx * press);
    float b = strokesLevel(ce.x, fw, s1, wob, widthPx * press);
    return mix(a, b, t);   // t -> 1 : odd lines fade out
  }

  vec2 hash2(vec2 p) {
    return vec2(hash(p), hash(p + 17.31));
  }

  // Sable-style sand blobs: small irregular darker spots scattered on the
  // ground. They give the eye a sense of scale and keep the flat colour from
  // feeling empty. Kept below the colour-boundary threshold so they don't get
  // inked outlines; they fade out once smaller than ~1.5 px to avoid shimmer.
  float blobs(vec2 p, vec2 fwp, float cell, float radius, float density, float seed) {
    vec2 g = p / cell;
    vec2 id = floor(g);
    vec2 h = hash2(id + seed);
    float r = radius / cell * (0.55 + 0.9 * h.y);                       // cell units
    vec2 c = 0.5 + (h - 0.5) * (0.9 - 2.0 * r);                         // stays inside the cell
    vec2 d2 = (fract(g) - c) * vec2(1.0, 1.0 + 0.8 * h.x);              // squashed
    float d = length(d2) + (vnoise(p / radius * 1.4 + seed) - 0.5) * r * 0.9;
    float aa = max(fwp.x, fwp.y) / cell;
    float m = 1.0 - smoothstep(r - aa, r + aa, d);
    float present = step(hash(id + seed + 3.1), density);
    float vis = smoothstep(1.2, 2.5, radius / max(max(fwp.x, fwp.y), 1e-6) / uPixelRatio);
    return m * present * vis;
  }

  // Stippling: jittered dots on a grid in the same surface frame as the
  // strokes. Dot radius and the fraction of cells that get a dot both grow
  // with darkness, like a hand-dotted shadow.
  float stippleLevel(vec2 ce, vec2 fw, float s, float dark) {
    vec2 g = ce / s;
    vec2 cell = floor(g);
    vec2 h = hash2(cell);
    vec2 centre = 0.5 + (h - 0.5) * 0.55;
    vec2 dpx = (fract(g) - centre) * s / max(fw, vec2(1e-6));   // device px
    float r = mix(0.7, 1.5, dark) * uPixelRatio * (0.7 + 0.6 * h.y);
    float present = step(hash(cell + 5.7), mix(0.35, 1.0, dark));
    return (1.0 - smoothstep(r - 0.7, r + 0.7, length(dpx))) * present;
  }

  float stipple(vec2 ce, vec2 fw, float spacingPx, float dark) {
    float lvl = log2(max(max(fw.x, fw.y) * spacingPx * uPixelRatio, 1e-5));
    float s0 = exp2(floor(lvl));
    return mix(stippleLevel(ce, fw, s0, dark), stippleLevel(ce, fw, s0 * 2.0, dark), fract(lvl));
  }

  #ifdef S_FORM
  // Strokes that follow the form (FORM): isolines of c (an angle about the part's axis, period units a turn,
  // or a height along it), at the spacing the screen asks for in powers of two, the two nearest levels
  // cross-faded as strokes() does. Each stroke wavers a little along its length (nq: a point that runs
  // along it with no seam) and has its own pressure, both from where it lies (the same stroke at either
  // level, and either side of the angle's seam). fw: c per device px.
  float formLevel(float c, float fw, float s, float sRef, float period, float widthPx, vec2 nq) {
    float k = floor(c / s + 0.5), id = mod(k * s, period);
    float h = hash(vec2(id, 7.31));
    // (far off, and on the handheld, a stroke keeps its own offset but no waver: one hash, no noise)
    float wob = h - 0.5, wk = uWearLite > 0.5 ? 0.0 : 1.0 - smoothstep(${(FORM.waverFar * 0.75).toFixed(1)}, ${FORM.waverFar}.0, vViewDepth);
    if (wk > 0.0) wob = mix(wob, vnoise(nq + vec2(id * 0.37, h * 19.0)) - 0.5, wk);
    wob *= ${FORM.waver.toFixed(4)};
    float f = fw / s;
    float d = abs(c - k * s - wob * sRef) / s;
    float hw = 0.5 * widthPx * (0.75 + 0.5 * h) * f;
    float line = 1.0 - smoothstep(hw - 0.6 * f, hw + 0.6 * f, d);
    return mix(line, min(2.0 * hw, 1.0), smoothstep(${HATCH_AA[0].toFixed(3)}, ${HATCH_AA[1].toFixed(3)}, f));   // (HATCH_AA)
  }
  float formLines(float c, float fw, float period, float spacingPx, float widthPx, vec2 nq) {
    float lvl = log2(max(fw * spacingPx * uPixelRatio, 1e-6));
    float top = log2(period) - 1.0;                      // (two strokes a turn at the coarsest; none past it)
    float keep = 1.0 - smoothstep(top - 1.0, top, lvl);
    if (keep <= 0.0) return 0.0;
    float s0 = exp2(floor(lvl));
    widthPx *= uPixelRatio;
    float a = formLevel(c, fw, s0, s0, period, widthPx, nq);
    float b = formLevel(c, fw, s0 * 2.0, s0, period, widthPx, nq);
    return mix(a, b, fract(lvl)) * keep;
  }
  // A dark cap's veins as branches (FORM.veins): formLines' strokes, but a stroke that carries on to the coarser
  // levels (its index divisible by two, four, …: it reaches further toward the stalk) is drawn thicker, a bough the
  // finer ones fork from; and each wanders further along its length.
  float veinLevel(float c, float fw, float s, float sRef, float widthPx, vec2 nq) {
    float k = floor(c / s + 0.5), id = mod(k * s, ${FORM.turn}.0);
    float h = hash(vec2(id, 3.17)), rank = 0.0, kk = abs(k);
    for (int i = 0; i < ${FORM.veins.boughs}; i++) { if (mod(kk, 2.0) > 0.5) break; rank += 1.0; kk *= 0.5; }
    float wob = (vnoise(nq + vec2(id * 0.37, h * 19.0)) - 0.5) * ${FORM.veins.waver.toFixed(4)};
    float f = fw / s;
    float d = abs(c - k * s - wob * sRef) / s;
    float hw = 0.5 * widthPx * (0.7 + 0.6 * h) * (1.0 + ${FORM.veins.bough.toFixed(4)} * rank) * f;
    float line = 1.0 - smoothstep(hw - 0.6 * f, hw + 0.6 * f, d);
    return mix(line, min(2.0 * hw, 1.0), smoothstep(${HATCH_AA[0].toFixed(3)}, ${HATCH_AA[1].toFixed(3)}, f));
  }
  float veinLines(float c, float fw, float spacingPx, float widthPx, vec2 nq) {
    float lvl = log2(max(fw * spacingPx * uPixelRatio, 1e-6));
    float top = log2(${FORM.turn}.0) - 1.0;
    float keep = 1.0 - smoothstep(top - 1.0, top, lvl);
    if (keep <= 0.0) return 0.0;
    float s0 = exp2(floor(lvl));
    widthPx *= uPixelRatio;
    return mix(veinLevel(c, fw, s0, s0, widthPx, nq), veinLevel(c, fw, s0 * 2.0, s0, widthPx, nq), fract(lvl)) * keep;
  }
  // The shade's two families of strokes on a part with an axis: x the strokes, y the cross-hatch (dark > 0.5).
  // f the point about the axis (vForm), fdx / fdy its screen derivatives (taken in uniform flow).
  vec2 formHatch(vec4 f, vec3 fdx, vec3 fdy, float hsp, float dark) {
    const float T = ${FORM.turn}.0, K = ${(FORM.turn / (2 * Math.PI)).toFixed(4)};
    float r2 = max(dot(f.xy, f.xy), 1e-8), r = sqrt(r2);
    // the angle and its derivatives (analytic: atan's seam has none of its own)
    float th = atan(f.y, f.x) * K;
    float fwT = (abs(f.x * fdx.y - f.y * fdx.x) + abs(f.x * fdy.y - f.y * fdy.x)) / r2 * K;
    float fwH = abs(fdx.z) + abs(fdy.z);
    float fwR = (abs(f.x * fdx.x + f.y * fdx.y) + abs(f.x * fdy.x + f.y * fdy.y)) / r;
    float w1 = mix(0.9, 2.2, dark), w2 = mix(0.6, 1.7, dark);
    float in1 = smoothstep(0.02, 0.12, dark), in2 = smoothstep(0.5, 0.65, dark);
    vec2 h = vec2(0.0);
    // a cylinder's strokes wrap round it, but on a face across its axis (its flat ends) the rings would be
    // degenerate: there it radiates as a cap does
    float wrap = f.w > 1.5 ? smoothstep(0.3, 0.6, fwH / max(fwH + fwR, 1e-9)) : 0.0;
    if (wrap < 0.999) {
      vec2 nqR = vec2(r * 0.6, 3.0);
      h.x = formLines(th, fwT, T, hsp * ${FORM.cap.spacing.toFixed(4)}, w1, nqR) * in1;
      if (dark > 0.5) h.y = formLines(th, fwT, T, hsp * ${FORM.cap.dense.toFixed(4)}, w2, nqR) * in2;
      h *= 1.0 - wrap;
    }
    if (wrap > 0.001) {
      vec2 ring = formLines(f.z, fwH, 65536.0, hsp * ${FORM.wrap.spacing.toFixed(4)}, w1, f.xy / r * 1.5) * in1 * vec2(1.0, 0.0);
      if (dark > 0.5) ring.y = formLines(th, fwT, T, hsp * ${FORM.wrap.along.toFixed(4)}, w2, vec2(f.z * 0.6, 5.0)) * in2;
      h += ring * wrap;
    }
    return h;
  }
  #endif

  // Drawn grid lines on architecture (Sable's "gridded lines"), ~1px pen,
  // fading out once the grid gets denser than a few pixels.
  // Once the cells shrink under ~14 px the lines hand over to their average tone (by
  // ~7 px they are only that tone): a far gridded tower keeps its value without moiré.
  float gridLines(vec3 q, vec3 fq, vec3 w) {
    vec3 d = abs(fract(q + 0.5) - 0.5) / max(fq, vec3(1e-6));      // px to nearest line
    vec3 res = 1.0 - smoothstep(0.07, 0.15, fq);
    vec3 l = mix(vec3(0.1), 1.0 - smoothstep(0.4 * uPixelRatio, 0.4 * uPixelRatio + 1.0, d), res);
    return max(w.x * max(l.y, l.z), max(w.y * max(l.x, l.z), w.z * max(l.x, l.y)));
  }

  #ifdef S_PLATES
  // Plating (makeMaterial({ plates })): rows of plates of uneven widths with staggered joints, the
  // odd joint or seam left out (two plates read as one), each plate a shade lighter or darker (under
  // the colour-edge threshold: no outline of its own). q in plates (the grid's cell), fq its px.
  float plates2(vec2 q, vec2 fq, float seed, out float tone) {
    float row = floor(q.y), hr = hash(vec2(row, seed));
    float k = 0.55 + 0.9 * hr;                          // this row's plates: narrow or wide
    float u = q.x * k + hr * 13.0, col = floor(u);
    tone = hash(vec2(col, row + seed * 3.1)) - 0.5;
    float du = abs(fract(u + 0.5) - 0.5) / max(fq.x * k, 1e-6), dv = abs(fract(q.y + 0.5) - 0.5) / max(fq.y, 1e-6);
    float w = 0.4 * uPixelRatio;
    float joint = (1.0 - smoothstep(w, w + 1.0, du)) * step(0.2, hash(vec2(floor(u + 0.5), row) + 5.3));
    float seam = (1.0 - smoothstep(w, w + 1.0, dv)) * step(0.25, hash(vec2(floor(u * 0.5), floor(q.y + 0.5)) + 9.1));
    float res = 1.0 - smoothstep(0.07, 0.15, max(fq.x, fq.y));
    return mix(0.08, max(joint, seam), res);
  }
  float plateLines(vec3 q, vec3 fq, vec3 w, out float tone) {
    float tx = 0.0, ty = 0.0, tz = 0.0, l = 0.0;
    if (w.x > 0.05) l = max(l, w.x * plates2(q.zy, fq.zy, 1.0, tx));
    if (w.y > 0.05) l = max(l, w.y * plates2(q.xz, fq.xz, 2.0, ty));
    if (w.z > 0.05) l = max(l, w.z * plates2(q.xy, fq.xy, 3.0, tz));
    tone = w.x * tx + w.y * ty + w.z * tz;
    return l;
  }
  #endif

  // ---------------------------------------------------------------- drawn details
  // Procedural "hand-drawn" marks, written as ~1px ink lines into gHatch.b.
  // Each fades out once its pattern gets denser than a few pixels.

  float inkLine(float distPx, float widthPx) {
    float w = widthPx * uPixelRatio * 0.5;
    return 1.0 - smoothstep(w - 0.6, w + 0.6, distPx);
  }

  // Exact distance to Voronoi cell borders (Inigo Quilez), in cell units.
  // reach: the caller draws nothing past this distance. The first pass also finds the second
  // nearest point (F2; any point outside the 3x3 is over a cell away), and no border is nearer
  // than (F2 - F1) / 2: where even that is past reach, the 25-cell second pass is skipped and
  // reach comes back (the same nothing drawn: exact, and most pixels of a cell are there).
  float voronoiBorder(vec2 x, float reach) {
    vec2 n = floor(x), f = fract(x), mg = vec2(0.0), mr = vec2(0.0);
    float md = 8.0, md2 = 8.0;
    for (int j = -1; j <= 1; j++)
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 r = g + hash2(n + g) - f;
        float d = dot(r, r);
        if (d < md) { md2 = md; md = d; mr = r; mg = g; }
        else if (d < md2) md2 = d;
      }
    if (0.5 * (min(sqrt(md2), 1.0) - sqrt(md)) > reach) return reach;
    md = 8.0;
    for (int j = -2; j <= 2; j++)
      for (int i = -2; i <= 2; i++) {
        vec2 g = mg + vec2(float(i), float(j));
        vec2 r = g + hash2(n + g) - f;
        if (dot(mr - r, mr - r) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
      }
    return md;
  }

  // ---------------------------------------------------------------- drawn patterns
  // Windows on a wall: frames (some arched), dark glass, sills, painted shutters,
  // a cornice line per storey. Coordinates run along the face, so they stick.
  //  - the wall's direction comes from the interpolated vertex normal (nv), not the
  //    facet normal from screen derivatives: those carry rounding noise that, times a
  //    coordinate hundreds of metres from the origin, made the windows jitter
  //  - glass and shutters are anti-aliased (edges in px from each axis' gradient), and
  //    once a window is only a few pixels they fade into the wall's average tint, so far
  //    façades stop sparkling (and stop growing flickering colour-edge ink in post.js)
  //  - frames and sills go before the windows get crowded
  float facade(vec3 wp, vec3 n, vec3 nv, inout vec3 alb, out float emit) {
    float vert = 1.0 - smoothstep(0.25, 0.4, abs(n.y));
    vec2 dirH = normalize(vec2(-nv.z, nv.x) + 1e-5);
    vec2 q = vec2(dot(wp.xz, dirH), wp.y) / vec2(3.0, 3.3);
    vec2 gq = max(vec2(length(vec2(dFdx(q.x), dFdy(q.x))), length(vec2(dFdx(q.y), dFdy(q.y)))), vec2(1e-5));   // cells per px
    vec2 id = floor(q), f = fract(q);
    float h = hash(id + 3.7), h2 = hash(id + 9.1);
    float cellPx = 1.0 / max(gq.x, gq.y);
    float lodInk = smoothstep(10.0, 20.0, cellPx), lodFill = smoothstep(5.0, 12.0, cellPx);
    float ink = inkLine(abs(f.y - 0.03) / gq.y, 0.8) * 0.6 * smoothstep(5.0, 10.0, 1.0 / gq.y);   // cornice
    float win = step(1.0 - uWindows, h);   // (the share of cells with a window: makeMaterial windows)
    vec2 c = f - vec2(0.5, 0.48), hf = vec2(0.17, 0.22);
    vec2 d2 = abs(c) - hf;
    float boxPx = max(d2.x / gq.x, d2.y / gq.y);                 // px outside the window (< 0 inside)
    if (h2 > 0.5 && c.y > hf.y - hf.x) {                         // arched top
      vec2 ca = c - vec2(0.0, hf.y - hf.x);
      float L = max(length(ca), 1e-5);
      boxPx = (L - hf.x) / max(length(ca / L * gq), 1e-6);
    }
    float glassK = (1.0 - smoothstep(-0.5, 0.5, boxPx)) * win;
    float shutK = (1.0 - smoothstep(-0.5, 0.5, max((abs(abs(c.x) - hf.x - 0.075) - 0.065) / gq.x, (abs(c.y) - hf.y) / gq.y)))
                * win * step(0.55, h2) * step(h2, 0.88);
    const vec3 glass = vec3(0.36, 0.43, 0.56);
    vec3 shutter = h > 0.6 ? vec3(0.37, 0.55, 0.5) : vec3(0.36, 0.47, 0.62);
    // at night some windows light up, one after another as it gets dark (warm lamplight: they glow)
    float h3 = hash(id + 13.7);
    float on = step(h3, 0.42) * smoothstep(0.15 + h3, 0.4 + h3, uNight);
    const vec3 lamp = vec3(1.0, 0.84, 0.5);
    vec3 nearC = mix(mix(alb, mix(glass, lamp, on), glassK), shutter, shutK);
    // the average: ~12 % of a façade is glass, ~3 % shutters
    float wk = uWindows / 0.78;
    vec3 farC = alb * (1.0 - 0.15 * wk) + (glass * 0.12 + vec3(0.365, 0.51, 0.56) * 0.03) * wk;
    farC = mix(farC, farC * 0.8 + lamp * 0.2, uNight * 0.6);
    alb = mix(alb, mix(farC, nearC, lodFill), vert);
    emit = glassK * on * lodFill * vert * (1.0 - shutK);
    ink = max(ink, inkLine(abs(boxPx), 1.0) * win * lodInk);
    #ifdef S_WEATHER
    if (uWeather > 0.0) {
      // weathered: a crack running out from a corner of the odd window, jagged, thinning
      float hc = hash(id + 21.7);
      if (hc < 0.38 * uWeather && lodInk > 0.0) {
        vec2 sgn = vec2(hc < 0.19 * uWeather ? 1.0 : -1.0, hash(id + 4.9) > 0.5 ? 1.0 : -1.0);
        vec2 a = hf * sgn, b = a + vec2(0.1 + 0.12 * hash(id + 6.1), 0.16 + 0.14 * hash(id + 7.3)) * sgn;
        vec2 ab = b - a, pa = c - a;
        float tt = clamp(dot(pa, ab) / dot(ab, ab), 0.0, 1.0);
        vec2 off = pa - ab * tt + vec2(-ab.y, ab.x) / length(ab) * (vnoise(vec2(tt * 9.0, hc * 40.0)) - 0.5) * 0.035;
        float dpx = length(off / gq);
        ink = max(ink, inkLine(dpx, mix(0.9, 0.35, tt)) * win * lodInk * step(dot(pa, ab), dot(ab, ab) * 1.0));
      }
    }
    #endif
    if (abs(c.x) < hf.x + 0.05) ink = max(ink, inkLine(abs(c.y + hf.y + 0.03) / gq.y, 1.3) * win * lodInk);   // sill
    return ink * vert;
  }

  #ifdef S_PATCH
  // Colour across a wall (PATCH): the albedo's factor at p (world), its smooth normal nv, k the amount.
  // Three layers, all constant over boxes of the world (so a round wall has no seam): each building
  // (a box of the coarse lattice, LA) its own tone on each face (a sunlit or a repainted plane, blended by
  // the normal so a curve turns smoothly) and the odd storey all round it in another render; and repaints
  // over the fine lattice's boxes (LB), one to three storeys tall. A handful of hashes, no loop.
  const vec3 PATCH_LA = vec3(${PATCH.building.toFixed(3)}, ${PATCH.cell[1].toFixed(3)}, ${PATCH.building.toFixed(3)});
  const vec3 PATCH_LB = vec3(${PATCH.cell[0].toFixed(3)}, ${PATCH.cell[1].toFixed(3)}, ${PATCH.cell[0].toFixed(3)});
  const vec3 PATCH_O = vec3(0.371, 0.173, 0.619);   // (the lattices off the round numbers buildings stand on)
  // the building's layer (LA): each face its own tone, the odd storey all round in another render
  vec3 patchA(vec3 p, vec3 nv, float k) {
    const float T = ${PATCH.tone.toFixed(4)};
    vec3 qa = p + PATCH_O * PATCH_LA;
    vec2 bld = floor(qa.xz / PATCH_LA.xz);
    vec4 fw = max(vec4(nv.x, -nv.x, nv.z, -nv.z), 0.0);   // (+x, -x, +z, -z)
    fw *= fw; fw *= fw;
    float hf = hash(bld + 1.13);
    vec4 ft = fract(hf * vec4(1.0, 7.31, 13.7, 29.3)) - 0.5;   // (one hash: four tones)
    vec3 m = vec3(1.0 + dot(fw, ft) / max(dot(fw, vec4(1.0)), 1e-4) * ${(2 * PATCH.face).toFixed(4)});
    float row = floor(qa.y / PATCH_LA.y);
    float hb = fract(hash(vec2(row * 3.7, 9.1) + hf * 61.0) + hf * 3.1);
    if (hb < ${PATCH.band} * k) m *= hb < ${(PATCH.band / 2).toFixed(4)} * k ? vec3(1.0 + T * 0.6, 1.0 + T * 0.3, 1.0 - T * 0.2) : vec3(1.0 - T * 0.7);
    return m;
  }
  // the repaints' layer (LB): a run of one to three storeys over a box, lighter, darker, warmer or cooler
  vec3 patchB(vec3 p, float k) {
    const float T = ${PATCH.tone.toFixed(4)};
    vec3 c = floor((p + PATCH_O * PATCH_LB) / PATCH_LB);
    float hc = hash(c.xz + 7.7);
    float span = 1.0 + floor(hc * 3.0);
    float cy = floor((c.y + floor(fract(hc * 7.3) * 3.0)) / span);
    float hp = hash(vec2(c.x + cy * 31.7, c.z - cy * 17.3) + 0.53);
    if (hp >= ${PATCH.share} * k) return vec3(1.0);
    float t = fract(hp * 97.31 / max(${PATCH.share} * k, 1e-3));
    return t < 0.3 ? vec3(1.0 + T) : t < 0.55 ? vec3(1.0 - T) : t < 0.8 ? vec3(1.0 + T * 0.7, 1.0 + T * 0.1, 1.0 - T * 0.6) : vec3(1.0 - T * 0.6, 1.0 - T * 0.05, 1.0 + T * 0.6);
  }
  // The patches with their edges drawn clean: a hard step would be inked by post.js's colour edges, so
  // within a few pixels of the nearest face of either lattice the colour ramps (linearly) to the mean of
  // both sides: crisp, but never a step its edge test sees. Only there is the neighbour looked up, and
  // only its layer (a repaint's edge: two hashes). pfw: metres per px along x, y, z.
  vec3 wallPatch(vec3 p, vec3 nv, float k, vec3 pfw) {
    vec3 mA = patchA(p, nv, k), mB = patchB(p, k);
    vec3 fa = fract((p + PATCH_O * PATCH_LA) / PATCH_LA), fb = fract((p + PATCH_O * PATCH_LB) / PATCH_LB);
    vec3 ga = min(fa, 1.0 - fa) * PATCH_LA / max(pfw, 1e-6), gb = min(fb, 1.0 - fb) * PATCH_LB / max(pfw, 1e-6);   // px to each face
    vec3 g = min(ga, gb);
    float dpx = min(g.x, min(g.y, g.z)), R = ${PATCH.ramp.toFixed(2)} * uPixelRatio;
    if (dpx < R) {
      vec3 e = g.x <= dpx ? vec3(1.0, 0.0, 0.0) : g.y <= dpx ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
      bool coarse = dot(e, ga) <= dot(e, gb);
      vec3 f = coarse ? fa : fb, L = coarse ? PATCH_LA : PATCH_LB;
      float fe = dot(e, f);
      vec3 pn = p + e * (fe < 0.5 ? -1.0 : 1.0) * (min(fe, 1.0 - fe) + 0.5) * dot(e, L);
      float t = clamp(dpx / R, 0.0, 1.0);   // (linear: the steepest step is half the change over R)
      vec3 mBn = patchB(pn, k);
      if (coarse) mA = mix(0.5 * (mA + patchA(pn, nv, k)), mA, t);
      mB = mix(0.5 * (mB + mBn), mB, t);
    }
    return mA * mB;
  }
  #endif

  #ifdef S_WEATHER
  // Weathering (makeMaterial({ weathered })): old walls, lived in. On upright faces, in cells of the
  // wall anchored in the world (so each building has its own), the odd crack runs down from a
  // storey's top or up from its foot, jagged and thinning, with a branch now and then; and a few
  // patches where the plaster has gone, their edge a broken pen line, a shade apart inside (under the
  // colour-edge threshold: the only line is the drawn one). q: (along the wall, up) in metres,
  // fq: metres per px of each (taken in uniform flow). Nothing is looked up once it is too small to
  // draw (most of a far city's walls, and the handheld's coarse pixels): the patches' noise and its
  // pixel gradient (estimated from fq: no derivative needed here) only near.
  float weatherInk(vec2 q, vec2 fq, vec2 sun2, float litK, float seed, float k, inout vec3 alb) {
    float ink = 0.0, dark = 0.0;
    const vec2 cellS = vec2(${WEATHER.cell[0]}, ${WEATHER.cell[1]});
    float fm = max(fq.x, fq.y);
    float rTone = 1.0 - smoothstep(${WEATHER.farTone[0]}, ${WEATHER.farTone[1]}, fm);
    if (rTone <= 0.0) return 0.0;
    float resolved = 1.0 - smoothstep(${WEATHER.far[0]}, ${WEATHER.far[1]}, fm);
    bool lite = uWearLite > 0.5;
    vec2 sunD = normalize(sun2 + vec2(1e-4, 0.0));
    // ---- grime: a streak running down from the top of its cell (a storey's top, a sill), flat tone,
    // narrowing as it goes, its edge a little ragged; one cell in two
    {
      const vec2 gc = vec2(${WEATHER.grime.cell[0]}, ${WEATHER.grime.cell[1]});
      vec2 id = floor(q / gc) + seed;
      if (hash(id + 0.7) < ${WEATHER.grime.share} * k) {
        float x0 = (floor(q.x / gc.x) + 0.3 + 0.4 * hash(id + 1.3)) * gc.x;
        float top = (floor(q.y / gc.y) + 1.0) * gc.y - 0.04 - 0.9 * hash(id + 4.4);   // (sources at uneven heights: no frieze)
        float len = gc.y * (0.35 + 0.6 * hash(id + 2.7)), t = (top - q.y) / len, ty = fq.y / len;
        if (t > -ty && t < 1.0 + ty) {
          float tc = clamp(t, 0.0, 1.0);
          float w0 = 0.1 + 0.34 * hash(id + 3.1) * hash(id + 5.9);
          float w = w0 * (1.0 - 0.65 * tc) + 0.05 * (vnoise(vec2(q.y * 3.0, id.x * 5.0)) - 0.5);
          float d = abs(q.x - x0 - 0.1 * (vnoise(vec2(q.y * 1.3, id.x)) - 0.5)) - w;
          // (its sides and ends antialiased over a pixel, its tone kept well over post.js's colour-edge threshold to
          // its foot, and a streak whose head is under minPx wide (a wall seen edge-on) left out: a thin or faint streak's outline
          // flickered as the camera moved; "Stable in motion", rendering.md)
          // (and a small one, its head under crisp px, soft-sided: post.js outlined it, and the outline of a streak a few pixels
          // wide was the old city's worst shimmer as the camera turned; "Shimmer", rendering.md)
          float headPx = 2.0 * w0 / max(fq.x, 1e-5), bigK = smoothstep(${WEATHER.grime.crisp[0].toFixed(1)}, ${WEATHER.grime.crisp[1].toFixed(1)}, headPx / uPixelRatio);
          float soft = mix(${WEATHER.grime.soft.toFixed(1)}, 1.0, bigK) * uPixelRatio;
          float gDark = mix(min(${WEATHER.grime.dark}, ${WEATHER.grime.faint} / max(length(alb), 0.1)), ${WEATHER.grime.dark}, bigK);
          float ends = smoothstep(-0.5 * soft, 0.5 * soft, t / ty) * (1.0 - smoothstep(-0.5 * soft, 0.5 * soft, (t - 1.0) / ty));
          float wide = step(${WEATHER.grime.minPx.toFixed(2)} * uPixelRatio, headPx);   // (by its head: whole or not at all)
          dark = max(dark, (1.0 - smoothstep(-0.5 * soft * fq.x, 0.5 * soft * fq.x, d)) * gDark * (1.0 - ${WEATHER.grime.taper} * tc) * ends * wide);
        }
      }
    }
    // ---- chips: patches where the plaster has broken away, the layer under it darker, the edge inked,
    // the lip's shadow falling into the chip on the sun's side (a step, not paint)
    float pn = vnoise(q * vec2(0.42, 0.55) + seed * 7.1) * 0.7 + vnoise(q * 1.9 + seed) * 0.3;
    float fpn = 0.9 * fm;   // (the field's gradient, about 1.05 a metre, times metres per px)
    float th = 1.0 - ${WEATHER.patches} * k;
    // (the fill's edge a pixel wide, not a step: still a hard edge to post.js, but a speck of a chip fades in and out
    // instead of blinking; the lip's shadow, a sliver, only while it is a few pixels wide)
    // (over two pixels: a step a pixel wide is still a colour edge to post.js, and its outline over the drawn
    //  one flickered on far walls; the pen line marks the edge)
    float inside = smoothstep(th - fpn, th + fpn, pn);
    alb = mix(alb, alb * vec3(0.74, 0.68, 0.62), inside * rTone);
    ink = max(ink, inkLine(abs(pn - th) / max(fpn, 1e-5), 0.9) * 0.85 * resolved);
    float lipK = smoothstep(${WEATHER.chip.minPx[0].toFixed(2)} * uPixelRatio, ${WEATHER.chip.minPx[1].toFixed(2)} * uPixelRatio, ${WEATHER.chip.lip} / max(fm, 1e-5));
    if (!lite && inside > 0.0 && litK > 0.0 && lipK > 0.0) {
      vec2 qs = q + sunD * ${WEATHER.chip.lip};
      float pl = vnoise(qs * vec2(0.42, 0.55) + seed * 7.1) * 0.7 + vnoise(qs * 1.9 + seed) * 0.3;
      dark = max(dark, (1.0 - smoothstep(th - 0.5 * fpn, th + 0.5 * fpn, pl)) * inside * ${WEATHER.chip.dark} * litK * resolved * lipK);
    }
    // ---- cracks: down from a storey's top or up from its foot, jagged, thinning, a branch now and
    // then; their shadow side a sliver darker (off the side away from the sun)
    if (!lite && resolved > 0.0) for (int dy = 0; dy < 2; dy++) {
      vec2 id = floor(q / cellS) - vec2(0.0, float(dy)) + seed;
      if (hash(id + 41.0) > ${WEATHER.cracks} * k) continue;                  // most cells: none
      bool down = hash(id + 2.2) > 0.45;
      float x0 = (floor(q.x / cellS.x) + 0.12 + 0.76 * hash(id + 3.3)) * cellS.x;
      float y0 = (floor(q.y / cellS.y) - float(dy) + (down ? 1.0 : 0.0)) * cellS.y;   // from the top down, or the foot up
      float len = cellS.y * (0.5 + 0.8 * hash(id + 8.8));
      float sAlong = down ? y0 - q.y : q.y - y0, t = sAlong / len;
      if (t < 0.0 || t > 1.0) continue;
      float lean = (hash(id + 5.1) - 0.5) * 1.1;
      float x = x0 + lean * sAlong + (vnoise(vec2(sAlong * 2.3, id.x * 7.0 + id.y)) - 0.5) * 0.32 + (vnoise(vec2(sAlong * 8.0, id.y * 3.0)) - 0.5) * 0.07;
      float wPx = mix(1.15, 0.4, t), dPx = (q.x - x) / max(fq.x, 1e-5);
      float fade = 1.0 - smoothstep(0.8, 1.0, t);
      ink = max(ink, inkLine(abs(dPx), wPx) * fade);
      float side = dPx * -sign(sunD.x);   // (the crack's far wall, from the sun)
      dark = max(dark, smoothstep(wPx * 0.5 - 0.5, wPx * 0.5 + 0.5, side) * (1.0 - smoothstep(wPx * 0.5 + 1.1, wPx * 0.5 + 2.1, side)) * 0.32 * fade * litK);   // (antialiased)
      float tb = 0.3 + 0.3 * hash(id + 9.4), sb = sAlong - tb * len;
      if (sb > 0.0 && sb < len * 0.35 && hash(id + 1.9) < 0.6) {
        float xb = x0 + lean * tb * len + (vnoise(vec2(tb * len * 2.3, id.x * 7.0 + id.y)) - 0.5) * 0.32 + sign(hash(id + 6.6) - 0.5) * sb * 0.9 + (vnoise(vec2(sb * 6.0, id.x)) - 0.5) * 0.06;
        ink = max(ink, inkLine(abs(q.x - xb) / max(fq.x, 1e-5), mix(0.75, 0.3, sb / (len * 0.35))) * (1.0 - smoothstep(0.7, 1.0, sb / (len * 0.35))));
      }
    }
    alb *= 1.0 - dark * rTone;
    return ink * resolved;
  }
  #endif

  #ifdef S_DETAIL
  // Pen detail (DETAIL): a box's outline distance, in metres.
  float boxEdge(vec2 p, vec2 h) { vec2 d = abs(p) - h; return abs(length(max(d, 0.0)) + min(max(d.x, d.y), 0.0)); }
  // Built surfaces: panel seams in rows of uneven height, staggered joints (some left out), small
  // rectangles in the odd panel (a vent with its slats, a hatch), and near, bolts and small plates.
  // q (along, up) m, fq m per px; k the density; seed the building's.
  float builtDetail(vec2 q, vec2 fq, float k, float seed) {
    float fm = max(fq.x, fq.y);
    float rA = 1.0 - smoothstep(${DETAIL.built.far[0]}, ${DETAIL.built.far[1]}, fm);
    if (rA <= 0.0) return 0.0;
    const vec2 cA = vec2(${DETAIL.built.cell[0]}, ${DETAIL.built.cell[1]});
    float ink = 0.0;
    // the seam at the row's foot (rows of uneven height: each row's line moved by a share of a row)
    float row = floor(q.y / cA.y);
    float yLine = (row + 0.35 * (hash(vec2(row, seed)) - 0.5)) * cA.y;
    float rowB = q.y < yLine ? row - 1.0 : row;
    float yB = (rowB + 0.35 * (hash(vec2(rowB, seed)) - 0.5)) * cA.y;
    float yT = (rowB + 1.0 + 0.35 * (hash(vec2(rowB + 1.0, seed)) - 0.5)) * cA.y;
    float seamOn = step(hash(vec2(rowB, seed + 3.1)), ${DETAIL.built.seams} * k) * smoothstep(0.3, 0.42, vnoise(vec2(q.x * 0.45, rowB * 7.0 + seed)));
    ink = max(ink, inkLine(abs(q.y - yB) / max(fq.y, 1e-5), 1.0) * seamOn);
    // the joints in this row, staggered
    float off = hash(vec2(rowB, seed + 5.7));
    float col = floor(q.x / cA.x + off);
    float xJ = (col - off) * cA.x, xJ2 = xJ + cA.x;
    float jOn = step(hash(vec2(col, rowB + seed)), ${DETAIL.built.joints} * k);
    ink = max(ink, inkLine(abs(q.x - xJ) / max(fq.x, 1e-5), 0.9) * jOn);
    // a small rectangle in the odd panel: a vent (slats), a hatch, a plate
    vec2 id = vec2(col, rowB) + seed;
    float hr = hash(id + 0.31);
    if (hr < ${DETAIL.built.rects} * k) {
      vec2 c = vec2(mix(xJ, xJ2, 0.25 + 0.5 * hash(id + 1.7)), mix(yB, yT, 0.3 + 0.4 * hash(id + 2.3)));
      vec2 hsz = vec2(cA.x * (0.08 + 0.17 * hash(id + 3.9)), (yT - yB) * (0.07 + 0.16 * hash(id + 4.4)));
      vec2 p = q - c;
      ink = max(ink, inkLine(boxEdge(p, hsz) / max(fm, 1e-5), 1.0));
      // a vent: slats across it (only while they are a few pixels apart)
      if (hash(id + 6.2) < ${DETAIL.built.vents} && all(lessThan(abs(p), hsz))) {
        float sl = 0.09, d = abs(fract(p.y / sl + 0.5) - 0.5) * sl;
        ink = max(ink, inkLine(d / max(fq.y, 1e-5), 0.6) * (1.0 - smoothstep(0.012, 0.025, fq.y)));
      }
    }
    ink *= rA;
    // near: bolts at the joints' feet and small plates in finer cells
    float rF = 1.0 - smoothstep(${DETAIL.built.fine.far[0]}, ${DETAIL.built.fine.far[1]}, fm);
    if (rF > 0.0 && uWearLite < 0.5) {
      const vec2 cF = vec2(${DETAIL.built.fine.cell[0]}, ${DETAIL.built.fine.cell[1]});
      vec2 fid = floor(q / cF) + seed * 1.7;
      if (hash(fid + 9.1) < ${DETAIL.built.fine.share} * k) {
        vec2 fc = (floor(q / cF) + vec2(0.2 + 0.6 * hash(fid + 2.0), 0.25 + 0.5 * hash(fid + 4.0))) * cF;
        vec2 fh = cF * vec2(0.08 + 0.18 * hash(fid + 5.0), 0.06 + 0.14 * hash(fid + 6.0));
        ink = max(ink, inkLine(boxEdge(q - fc, fh) / max(fm, 1e-5), 0.6) * rF);
      }
      // a bolt each side of the joint, at the seam
      vec2 bp = vec2(q.x - xJ, q.y - yB - 0.12);
      float bolt = (1.0 - smoothstep(0.025, 0.035, length(vec2(abs(bp.x) - 0.12, bp.y)))) * jOn * seamOn;
      ink = max(ink, bolt * rF);
    }
    return ink;
  }
  // Organic surfaces (bark, stalks, rock): short grain strokes along the fall of the surface, staggered,
  // leaning a little and tapering, a coarse level of longer ones and a fine level near.
  float grainLevel(vec2 q, vec2 fq, vec2 cell, float share, float k, float seed, float w) {
    vec2 id = vec2(floor(q.x / cell.x), 0.0);
    float off = hash(vec2(id.x, seed + 1.3));
    id.y = floor(q.y / cell.y + off);
    vec2 cid = id + seed;
    if (hash(cid + 0.9) > share * k) return 0.0;
    float y0 = (id.y - off) * cell.y, len = cell.y * (0.45 + 0.5 * hash(cid + 2.1));
    float t = (q.y - y0 - cell.y * 0.1) / len;
    if (t < 0.0 || t > 1.0) return 0.0;
    float x = (id.x + 0.2 + 0.6 * hash(cid + 3.3)) * cell.x + (hash(cid + 4.7) - 0.5) * 0.25 * (q.y - y0) + (vnoise(vec2(q.y * 2.0, cid.x)) - 0.5) * cell.x * 0.25;
    return inkLine(abs(q.x - x) / max(fq.x, 1e-5), w * sin(3.14159 * t));
  }
  float grainDetail(vec2 q, vec2 fq, float k, float seed) {
    // (one level: detailLod draws it coarser with distance; the handheld every other stroke)
    return grainLevel(q, fq, vec2(${DETAIL.organic.cell[0]}, ${DETAIL.organic.cell[1]}), ${DETAIL.organic.share} * (uWearLite > 0.5 ? 0.5 : 1.0), k, seed, 0.9);
  }
  // By distance: the same marks at a coarser scale (cells doubled, each level its own pattern) so they
  // keep about their size on screen, the two nearest levels cross-faded, gone past the last (DETAIL.lods).
  float detailLod(vec2 q, vec2 fq, float k, float seed, bool organic) {
    float fm = max(max(fq.x, fq.y), 1e-6);
    float lv = max(log2(fm / (organic ? ${DETAIL.organic.base} : ${DETAIL.built.base})), 0.0);
    // (the next level cross-faded in over the last half of a level: over a fifth, the pattern swapped in a few frames when
    // riding or flying past, a pop; half the pixels draw one level; "Stable in motion", rendering.md)
    float li = floor(lv), a = smoothstep(${(1 - DETAIL.blend).toFixed(2)}, 1.0, lv - li);
    float keep = 1.0 - smoothstep(${DETAIL.lods - 1}.0, ${DETAIL.lods}.0, lv);
    if (keep <= 0.0) return 0.0;
    float L = exp2(li);
    float ink = (organic ? grainDetail(q / L, fq / L, k, seed + li * 7.0) : builtDetail(q / L, fq / L, k, seed + li * 7.0)) * (1.0 - a);
    if (a > 0.0) ink = max(ink, (organic ? grainDetail(q / (2.0 * L), fq / (2.0 * L), k, seed + li * 7.0 + 7.0) : builtDetail(q / (2.0 * L), fq / (2.0 * L), k, seed + li * 7.0 + 7.0)) * a);
    return ink * keep;
  }
  #endif

  // Roof tiles: rows with staggered joints.
  float roofTiles(vec3 wp) {
    float v = wp.y * 4.5, u = dot(wp.xz, vec2(0.707)) * 3.5;
    float fv = max(fwidth(v), 1e-5), fu = max(fwidth(u), 1e-5);
    float row = abs(fract(v + 0.5) - 0.5) / fv;
    float joint = abs(fract(u + floor(v) * 0.5 + 0.5) - 0.5) / fu;
    float res = 1.0 - smoothstep(0.1, 0.2, max(fv, fu));
    return mix(0.12, max(inkLine(row, 0.8), inkLine(joint, 0.7) * 0.7), res);   // dense rows: their average tone
  }

  // Leaves: little scalloped arcs on the foliage, more of them in shade.
  float leaves(vec3 op) {
    vec2 q = vec2(op.x + op.z * 0.6, op.y) * 2.6;
    vec2 fq = max(fwidth(q), vec2(1e-5));
    vec2 id = floor(q), f = fract(q);
    vec2 o = vec2(hash(id), hash(id + 2.3)) * 0.3 - 0.15;
    vec2 c = f - vec2(0.5, 0.3) - o;
    float d = abs(length(c) - 0.3);
    return inkLine(d / max(fq.x, fq.y), 0.9) * step(0.0, c.y) * step(0.35, hash(id + 5.0)) * (1.0 - smoothstep(0.12, 0.3, max(fq.x, fq.y)));
  }

  // Rock cracks: a broken Voronoi network across the stone.
  float rockCracks(vec3 op) {
    vec2 q = (op.xy + op.zx * 0.6) * 0.9;
    float fwq = max(max(fwidth(q.x), fwidth(q.y)), 1e-5);
    float gaps = smoothstep(0.35, 0.55, vnoise(q * 2.3 + 11.0));
    float fade = 1.0 - smoothstep(0.08, 0.2, fwq);
    if (gaps * fade <= 0.0) return 0.0;   // (a gap in the cracks, or too far to draw: no cell search)
    // the line (inkLine, 0.9 px) is nothing past (0.45 px * ratio + 0.6 px) from a border
    float d = voronoiBorder(q, (0.45 * uPixelRatio + 0.6) * fwq * 1.01) / fwq;
    return inkLine(d, 0.9) * gaps * fade;
  }

  float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return length(p - a - ab * t);
  }

  // the people's faces (src/face-ink.js)
  ${FACE_INK_GLSL}
  ${FACE_FLAT_GLSL}

  ${PORTRAIT_GLSL}
  ${CREASE_GLSL}

  // A person's eyeball (MODE_EYE): the point's direction on the round eye, measured in the frame
  // of the gaze, places the iris; the lid comes down from the top as they blink.
  vec3 eyeball(vec3 b, vec3 white, vec3 iris, vec3 skin) {
    float side = b.x < 0.0 ? -1.0 : 1.0;
    vec3 q = b - vec3(side * uEyeC.x, uEyeC.y, uEyeC.z);
    vec3 d = normalize(q / vec3(uEyeR.x, q.y > 0.0 ? uEyeR.y : uEyeR.z, uEyeR.w));
    vec3 g = normalize(uEyeLook.xyz);
    vec3 gx = normalize(vec3(g.z, 0.0, -g.x)), gy = cross(g, gx);
    vec2 e = vec2(dot(d, gx), dot(d, gy)) / uEyeC.w;
    float px = max(length(vec2(dFdx(e.x), dFdy(e.x))), length(vec2(dFdx(e.y), dFdy(e.y))));
    vec4 ir = eyeIris(e, px, iris, white);
    vec3 c = mix(white, ir.rgb, ir.a * step(0.0, dot(d, g)));
    // a pixel or so across: the whole eye one dark mark
    c = mix(mix(iris, EYE_INK, 0.7), c, smoothstep(0.8, 1.8, 1.0 / max(px, 1e-4)));
    // blinking: the lid (skin) closes from the top, its edge inked
    // (the model's lids open on the lower part of the ball: from d.y 0.15 down to -0.55; the upper
    // rim lifted by humanoid.js UPPER_LID to about 0.27, more on big eyes: the lid at rest stays out of sight under it)
    float lid = mix(0.42, -0.62, uEyeLook.w), dy = d.y - lid, fy = max(fwidth(d.y), 1e-4);
    c = mix(c, skin, smoothstep(-fy * 0.5, fy * 0.5, dy));
    // the lash line: a crisp pen line along the lid's edge (Moebius' heavy upper lid), heavier
    // toward the outer corner, coming down with the lid as they blink
    float lash = fy * uPixelRatio * (1.15 + 0.5 * smoothstep(-0.6, 0.8, d.x * side)) * (1.0 - 0.35 * uMood2.z);   // (lighter on a young face)
    c = mix(c, EYE_INK, (1.0 - smoothstep(lash - fy * 0.6, lash + fy * 0.6, -dy)) * step(dy, fy * 0.5));
    return c;
  }
  #ifdef CROWD
  // The crowd's eyes: a small almond (figure space, mirrored: x = |x|), a dot of the iris on the white.
  vec3 crowdEye(vec2 l, float px, vec3 white, vec3 iris) {
    vec4 ir = eyeIris(l / 0.0058, px / 0.0058, iris, white);
    vec3 c = mix(white, ir.rgb, ir.a);
    return mix(mix(iris, EYE_INK, 0.7), c, smoothstep(0.7, 1.6, 0.0058 / max(px, 1e-5)));
  }
  #endif

  ${GROUND_GLSL}

  // Sparse, surface-anchored pen strokes. Their physical length stays fixed;
  // fade subpixel strokes away instead of enlarging them into screen-space dots.
  float sandScuffs(vec2 p) {
    vec2 q = mat2(0.82, -0.57, 0.57, 0.82) * p / 22.0;
    vec2 cell = floor(q), local = fract(q) - (0.25 + hash2(cell + 11.0) * 0.5);
    float seed = hash(cell + 37.0);
    float halfLength = mix(0.055, 0.18, hash(cell + 19.0));
    float bend = local.y - local.x * local.x * 0.5;
    float aa = max(fwidth(bend), 1e-5);
    float stroke = inkLine(abs(bend) / aa, 0.65);
    stroke *= 1.0 - smoothstep(halfLength * 0.6, halfLength, abs(local.x));
    float resolved = smoothstep(3.0, 7.0, halfLength * 2.0 / max(fwidth(q.x), 1e-5));
    float scuffPatch = smoothstep(0.40, 0.70, vnoise(p * 0.045 + 13.0));
    return stroke * step(0.65, seed) * scuffPatch * resolved * 0.55;
  }

  // Vertical fissures on rock: wavy lines down the faces, in short runs.
  float fissures(vec2 q, float fwq) {
    // q = (horizontal coordinate on the face, height), in metres
    float u = q.x / 9.0 + (vnoise(vec2(q.y * 0.06, q.x * 0.05)) - 0.5) * 0.5;
    float d = abs(fract(u + 0.5) - 0.5) / max(fwq, 1e-6);
    float runs = smoothstep(0.5, 0.65, vnoise(vec2(floor(u) * 3.7, q.y * 0.035)));
    return inkLine(d, 1.0) * runs * (1.0 - smoothstep(0.08, 0.2, fwq));
  }

  // Cracks down a cliff's face (the desert canyons' sheets, IMG_3772-3774): long near-vertical lines a
  // couple of metres apart, each its own length, wandering a little and thinning at its ends, with short
  // strokes between them; denser with k. q = (horizontal coordinate on the face, height) in metres, fwx
  // metres per pixel across the face.
  float faceCracks(vec2 q, float fwx, float k) {
    float ink = 0.0;
    for (int f = 0; f < 2; f++) {
      float sp = f == 0 ? mix(6.0, 2.0, k) : mix(3.0, 1.1, k);
      float wob = (vnoise(vec2(q.y * 0.11 + float(f) * 9.0, q.x * 0.03)) - 0.5) * 0.45;
      float u = q.x / sp + wob, id = floor(u + 0.5);
      float off = (hash(vec2(id, 3.1 + float(f))) - 0.5) * 0.5;
      float d = abs(fract(u + 0.5) - 0.5 - off) * sp / max(fwx, 1e-5);   // px
      float len = f == 0 ? mix(0.03, 0.09, hash(vec2(id, 7.7))) : mix(0.25, 0.5, hash(vec2(id, 5.3)));   // 1 / its length's scale
      float run = vnoise(vec2(id * 7.31 + float(f) * 13.0, q.y * len));
      float on = smoothstep(f == 0 ? 0.42 : 0.62, f == 0 ? 0.55 : 0.72, run);
      float w = (f == 0 ? 2.0 : 1.2) * mix(0.5, 1.0, smoothstep(0.42, 0.75, run));
      ink = max(ink, inkLine(d, w) * on * (1.0 - smoothstep(0.035, 0.11, fwx / sp)));
    }
    return ink;
  }

  ${GLYPH_GLSL}

  #ifdef METAL
  ${METAL_GLSL}
  #endif

  // Grass: short inked ticks scattered on a jittered grid, leaning with the wind.
  float grassTicks(vec2 p, vec2 fwp) {
    float cell = 1.4;
    vec2 g = p / cell, id = floor(g);
    vec2 h = hash2(id + 7.7);
    if (h.x > 0.42) return 0.0;
    vec2 c = 0.25 + h * 0.5;
    vec2 dir = normalize(vec2(0.35 + 0.3 * h.y, 1.0));
    vec2 q = fract(g) - c;
    float along = clamp(dot(q, dir), -0.13, 0.13);
    float d = length(q - dir * along) * cell / max(max(fwp.x, fwp.y), 1e-6);   // device px
    float vis = 1.0 - smoothstep(0.03, 0.08, max(fwp.x, fwp.y) / cell);
    return inkLine(d, 1.0) * vis;
  }

  // Water: drifting contour lines of a slow noise field, like inked ripples.
  float waterLines(vec2 p, float t) {
    vec2 q = p * 0.045 + vec2(t * 0.03, t * 0.017);
    float f = vnoise(q) * 0.6 + vnoise(q * 2.3 - t * 0.04) * 0.4;
    float v = f * 9.0;
    float fw = fwidth(v);
    float d = abs(fract(v + 0.5) - 0.5) / max(fw, 1e-6);
    float broken = smoothstep(0.3, 0.55, vnoise(p * 0.08 + 31.0));
    return inkLine(d, 1.0) * broken * (1.0 - smoothstep(0.25, 0.5, fw));
  }
  #ifdef WATER
  ${WATER_GLSL}
  #endif

  // ordered 4x4 dither threshold, for print-like dissolves
  float bayer4(vec2 p) {
    vec2 q = mod(floor(p), 4.0);
    int i = int(q.x) + int(q.y) * 4;
    int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
    return (float(m[i]) + 0.5) / 16.0;
  }

  #ifdef DISSOLVE
  // A makers' box coming apart (src/boxes/scene.js; makeMaterial({ dissolve })): noise in world
  // space, eaten from the top down as uDissolve.x goes 0 -> 1, the edge burning bright.
  uniform vec4 uDissolve;        // amount 0..1 · edge width · bottom y · top y (world)
  uniform vec3 uDissolveColor;   // the burning edge
  #endif

  #ifdef MAKERS_BOX
  // A makers' box (src/boxes/model.js; makeMaterial({ makersBox })): one smooth shell with no
  // edges, the pale four-point star painted on its top and a compass (a ring round a small star)
  // on each side, and a thin ray of light that travels across it, pass after pass, a short trail behind.
  // Inked by its outline only (the soft-ink flag, post.js): no lines inside it, no hatching.
  uniform vec4 uBoxA;    // x the ray's strength 0..1 · y the marks' glow 0..1 · z (unused) · w the ray's clock (in passes)
  uniform vec4 uBoxB;    // the shell's half size (m, as drawn) xyz · w the height of its centre over its foot (m)
  uniform vec3 uBoxMark; // the star and the compasses
  uniform vec3 uBoxLight;// the ray
  float boxAA(float v, float fw) { return 1.0 - smoothstep(-fw, fw, v); }
  /** A four-point star with concave sides (an astroid), its points along the axes: < 0 inside. */
  float boxStar(vec2 q) { return pow(abs(q.x) + 1e-4, 0.6667) + pow(abs(q.y) + 1e-4, 0.6667) - 1.0; }
  /**
   * The makers' marks: x the pale star on the top, y a compass on each side (a thin ring round a
   * small star, the reference drawing's medallion), painted on in a paler blue.
   */
  vec2 boxMarks(vec3 p, vec3 on) {
    vec3 a = abs(on);
    float l = max(length(on), 1e-4);
    vec2 sq = p.xz / (min(uBoxB.x, uBoxB.z) * 0.8);
    float st = boxStar(sq);
    float star = boxAA(st, fwidth(st)) * smoothstep(0.55, 0.8, on.y / l);
    vec2 uv = (a.z > a.x ? vec2(p.x, p.y - uBoxB.w) : vec2(p.z, p.y - uBoxB.w)) / (uBoxB.y * 0.5);
    float side = smoothstep(0.62, 0.85, max(a.x, a.z) / l);
    float fw = max(fwidth(uv.x), fwidth(uv.y)) * 1.2;
    float ring = abs(length(uv) - 1.0) - 0.035;
    float small = boxStar(uv / 0.78);
    float comp = max(boxAA(ring, fw), boxAA(small, fwidth(small)));
    return vec2(star, comp * side);
  }
  /** The ray: a thin bright line crossing the shell, a short trail fading behind it. x the line, y its glow, z the trail. */
  vec3 boxRay(vec3 p) {
    float c = uBoxA.w, pass = floor(c), u = fract(c);
    // each pass crosses another way (golden-angle turns), tilted up or down a little
    float ang = pass * 2.39996 + 0.7;
    vec3 D = normalize(vec3(cos(ang), 0.55 * sin(pass * 1.7 + 0.4), sin(ang)));
    float R = dot(abs(D), uBoxB.xyz);   // (how far the shell reaches that way: s is -1 .. 1 from corner to corner)
    float s = dot(p, D) / R;
    float head = mix(-1.05, 1.05, clamp(u / 0.8, 0.0, 1.0));   // (it crosses in the first 80% of a pass, then a rest)
    float d = s - head;
    // a wobble along it, so it reads as drawn light rather than a ruled line
    d += 0.01 * sin(dot(p, vec3(9.0, 12.0, 7.0)) + pass * 1.3);
    float line = exp(-d * d / 0.00035);
    float glow = exp(-d * d / 0.003);
    float trail = d < 0.0 ? exp(d * 9.0) * (1.0 - smoothstep(0.8, 1.0, u)) : 0.0;
    return vec3(line, glow, trail) * uBoxA.x;
  }
  #endif

  #ifdef FLUID
  // The traveller's magical fluid (fluid-tool.js; makeMaterial({ fluid })): a
  // lava lamp in flat print tones. Only materials made with o.fluid compile this.
  uniform vec4 uFluidA;    // fill 0..1 · tones in the blend (2..6) · time (s) · kind: 0 tank, 1 hose, 2 glob
  uniform vec4 uFluidB;    // flash 0..1 · refill 0..1 (0 = none) · hose pulse head (0 tank -> 1 hand) · slosh 0..1
  uniform vec4 uFluidBox;  // object space: glass bottom y, top y, radius, highlight angle (rad, about +y)
  uniform vec3 uFluidTones[6];   // the fluid's tones in the order they join the blend (fluid-tool.js sets them)
  vec3 fluidTone(int i) { return uFluidTones[i - 6 * (i / 6)]; }
  uniform vec3 uFluidBase;       // the flask's own fluid, the colour the tones stream through (green; a gun mode's tone)
  // The flask's living fluid (kind 0, fluid-tool.js buildFlask; the sheets' glass jar): a green body with
  // the blend's tones turning through it in slow warped streams, dark veins where they meet the green.
  // p: a point on the glass (object space, in glass heights), continuous all round (no seam at the back).
  vec3 flaskFluid(vec2 p, float t, int n) {
    p *= 4.2;
    vec2 q = vec2(vnoise(p + vec2(0.0, t * 0.23)), vnoise(p + vec2(5.2, 1.3) - vec2(t * 0.19, 0.0)));
    vec2 r = vec2(vnoise(p * 1.3 + 2.8 * q + vec2(1.7, 9.2) + t * 0.09), vnoise(p * 1.3 + 2.8 * q + vec2(8.3, 2.8) - t * 0.11));
    float f = vnoise(p * 0.9 + 2.6 * r);
    vec3 col = uFluidBase;
    // the streams: where the warped field rises, one tone of the blend each (the stretch of r it falls in),
    // and inside the widest of them a core of the next tone
    const float EDGE = 0.45, CORE = 0.63;
    int nn = max(n, 1), k = int(floor(fract(r.y * 1.7 + q.x * 0.8) * float(nn)));
    if (f > EDGE) col = fluidTone(k);
    if (f > CORE) col = fluidTone(k + 1 - nn * ((k + 1) / nn));
    // dark veins where the streams meet the green, finer round the cores: one pen-width
    float fw = max(fwidth(f), 1e-4);
    col = mix(col, vec3(0.08, 0.19, 0.14), 0.85 * (1.0 - smoothstep(0.6, 1.4, abs(f - EDGE) / fw)));
    col = mix(col, vec3(0.1, 0.12, 0.16), 0.6 * (1.0 - smoothstep(0.4, 1.0, abs(f - CORE) / fw)));
    return col;
  }
  // Round a vertical axis (angle a, height h 0..1, aspect = radius / height):
  // three stacked bands of one tone each, with metaball blobs of the other
  // tones rising, sinking and merging through them. Flat tones, so the post
  // pass inks every boundary.
  // (blob i joins tone i mod n. Summed tone by tone, blob by blob in the same order, rather than into
  // an array indexed by i mod n: a local array with a computed index lives in slow scratch memory
  // on mobile GPUs, and the pool and the stream fill much of the screen in the desert's cave)
  float fluidBlob(int i, float wa, float wh, float aspect, float t) {
    float fi = float(i);
    float ph = 6.2831 * (0.06 + 0.05 * fract(fi * 0.618)) * t + fi * 2.13;
    float cy = 0.5 + 0.56 * sin(ph);                       // a little past the ends: blobs pool and break away
    float ca = fi * 2.39996 + 0.9 * sin(t * 0.13 + fi * 1.7);
    float r = 0.115 + 0.045 * sin(t * 0.43 + fi * 1.31);
    float da = abs(mod(wa - ca + 3.14159, 6.28318) - 3.14159) * aspect;
    float dy = (wh - cy) / (1.0 + 0.6 * abs(cos(ph)));      // stretched while it rises or sinks
    return r * r / max(da * da + dy * dy, 1e-5);
  }
  vec3 fluidLava(float a, float h, float aspect, float t, int n, bool banded) {
    // a slow warp keeps every edge organic
    float wa = a + 0.16 * sin(h * 8.0 + t * 0.7);
    float wh = h + 0.03 * sin(a * 3.0 - t * 0.9);
    float hb = h + 0.035 * sin(a * 2.0 + t * 0.6) + 0.02 * sin(a * 5.0 - t * 1.4);
    int base = banded ? int(clamp(floor(hb * 3.0), 0.0, 2.0)) : int(step(0.5 + 0.25 * sin(a * 2.0 + t * 0.5), h));
    n = max(n, 1);
    base -= n * (base / n);
    int pick = base;
    float best = 1.0;
    for (int c = 0; c < 6; c++) {
      if (c >= n) break;
      float f = 0.0;
      for (int i = c; i < 12; i += n) f += fluidBlob(i, wa, wh, aspect, t);
      if (c != base && f > best) { best = f; pick = c; }
    }
    return fluidTone(pick);
  }
  vec3 fluidAlbedo(vec3 base) {
    float t = uFluidA.z, kind = uFluidA.w;
    int n = int(uFluidA.y + 0.5);
    if (kind > 3.5) return base;   // the hover trail: its bands are drawn in the ribbon branch
    if (kind > 2.5) {
      // a wing's membrane (fluid-kit.js): a lobe of length 1 along y, half-width WING_W(y) along x;
      // the lava flows across it in two zones, pale like a soap film, with inked veins along it
      float y = vBind.y, wy = max(0.5 * pow(sin(3.14159 * min(1.0, pow(max(y, 0.0), 0.8) * 0.97 + 0.03)), 0.85), 0.02);
      float u = vBind.x / wy;
      vec3 col = fluidLava(vBind.x * 5.0 + 0.6 * y, y, 0.4, t * 0.8, n, false);
      col = mix(col, vec3(1.0), 0.3 + 0.22 * y + uFluidB.x * 0.3);
      float vein = min(abs(u), min(abs(u - 0.55 * (1.0 - y * 0.3)), abs(u + 0.55 * (1.0 - y * 0.3))));
      if (vein < 0.03 * (1.2 - y) && y < 0.9) col = mix(col, vec3(0.17, 0.13, 0.12), 0.55);
      if (abs(u) > 0.88) col = mix(col, vec3(1.0), 0.6);    // a pale rim
      return col;
    }
    if (kind > 0.5 && kind < 1.5) {
      // the hose: rubber, with a slug of fluid running down it when the tool is used
      float u = vFold.x, head = uFluidB.z;
      if (u < head && u > head - 0.3) return fluidTone(int(mod(floor(u * 7.0 - t * 3.0), float(n))));
      return base;
    }
    float H = uFluidBox.y - uFluidBox.x;
    float h = (vBind.y - uFluidBox.x) / H;
    float a = atan(vBind.z, vBind.x);
    if (kind > 1.5) return fluidLava(a, h, uFluidBox.z / H, t * 4.0, n, false);   // a glob in flight: blobs churning, no bands
    // the flask: its living fluid stands at the fill level (a third of the glass a charge), sloshing; empty glass above
    vec3 col = flaskFluid(vec2(vBind.x + 0.8 * vBind.z, vBind.y - uFluidBox.x) / H, t, n);
    float fill = uFluidA.x;
    float surf = max(fill, 0.07) + (0.012 + 0.05 * uFluidB.w) * sin(a + t * 6.0) * min(1.0, fill * 8.0);
    float w = uFluidB.y;
    if (w > 0.0 && h < surf) {
      // refilling: bubbles stream up through it
      vec2 g = vec2(a * uFluidBox.z / H * 10.0, h * 10.0 - t * 5.0);
      vec2 c = fract(g) - 0.5;
      if (hash(floor(g)) > 0.55 && dot(c, c) < 0.07) col = mix(col, vec3(1.0), 0.75 * w);
    }
    if (h > surf) col = kind < 0.5 ? vec3(0.8, 0.9, 0.88) : vec3(0.855, 0.925, 0.945);   // (the flask's glass a little green)
    else if (h > surf - 0.04) col = mix(col, vec3(1.0), 0.35 + 0.4 * w);   // the meniscus
    // the glass's edge, pale where it turns away from the eye (its thickness, seen through)
    if (kind < 0.5) {
      float fr = 1.0 - abs(dot(normalize(vNormal), normalize(cameraPosition - vWorldPos)));
      col = mix(col, vec3(0.84, 0.94, 0.91), 0.8 * smoothstep(0.78, 0.86, fr));
    }
    // the glass's thick green foot, and a short etched mark at each third (the charges) on one side
    if (h < 0.045) col = mix(col, vec3(0.2, 0.46, 0.36), 0.75);
    float da = abs(a + 0.42);
    if (da < 0.16 && (abs(h - 0.3333) < 0.008 || abs(h - 0.6667) < 0.008)) col = mix(col, vec3(0.12, 0.2, 0.17), 0.8);
    col = mix(col, vec3(1.0), uFluidB.x * 0.45);
    // a highlight streak down the glass
    float dh = abs(mod(a - uFluidBox.w + 3.14159, 6.28318) - 3.14159);
    if (dh < (kind < 0.5 ? 0.07 : 0.14) && h > 0.16 && h < 0.8) col = mix(col, vec3(1.0), h > surf ? 0.9 : 0.5);
    return col;
  }
  #endif

  void main() {
    // the hover trail dissolves into dots over its last stretch
    // glass (the bubble helmet): see-through except at the grazing rim and a curved highlight
    #ifdef S_GLASS
    if (uGlass > 0.0) {
      vec3 Vg = normalize(cameraPosition - vWorldPos);
      float fr = 1.0 - abs(dot(normalize(vNormal), Vg));
      vec3 od = normalize(vObjPos - uGlassCenter);
      float streak = step(abs(atan(od.y, od.x) - 2.2), 0.09) * step(0.25, od.z) * step(od.z, 0.75);
      if (fr < 0.72 && streak < 0.5) discard;
    }
    #endif
    #ifdef S_RIBBON
    if (uMode == ${MODE_RIBBON} && bayer4(gl_FragCoord.xy / max(uPixelRatio, 1.0) * 0.5) < smoothstep(0.45, 0.95, vFold.y)) discard;
    #endif
    #ifdef DISSOLVE
    float dEdge = 0.0;
    if (uDissolve.x > 0.0) {
      float dh = clamp((vWorldPos.y - uDissolve.z) / max(uDissolve.w - uDissolve.z, 1e-3), 0.0, 1.0);
      float dn = vnoise(vWorldPos.xz * 6.0 + vWorldPos.y * 2.3) * 0.42 + vnoise(vWorldPos.zy * 15.0 + 3.1) * 0.18 + (1.0 - dh) * 0.4;
      float dth = uDissolve.x * 1.15 - 0.08;
      if (dn < dth) discard;
      dEdge = 1.0 - smoothstep(0.0, uDissolve.y, dn - dth);
    }
    #endif
    #ifdef FLUID
    // the wings' tips dissolve into print dots (more while they bloom or fold: uFluidB.y)
    if (uFluidA.w > 2.5 && uFluidA.w < 3.5 && bayer4(gl_FragCoord.xy / max(uPixelRatio, 1.0) * 0.5) < smoothstep(0.9, 1.02, vBind.y) * 0.5 + uFluidB.y * (0.3 + 0.7 * smoothstep(0.2, 1.0, vBind.y))) discard;
    #endif
    // stroke coordinates + derivatives first, in uniform control flow
    vec3 on = uFlat > 0.5 ? cross(dFdx(vObjRel), dFdy(vObjRel)) : vObjNormal;
    // (rock: sharper hand-overs between the projections, or a smooth underside's strokes curl into wood grain)
    vec3 tw = pow(abs(normalize(on)), vec3(uMode == ${MODE_STRATA} ? 8.0 : 3.0));
    tw /= (tw.x + tw.y + tw.z);
    if (uFlat > 0.5) {
      // a facet takes one projection, as an inker would do: blending them multiplies any
      // rounding in the weights by coordinates that can be hundreds of metres (noise)
      vec3 a = abs(on);
      tw = a.x > a.y && a.x > a.z ? vec3(1.0, 0.0, 0.0) : (a.y > a.z ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
    }
    if (uMode == ${MODE_TERRAIN}) tw = vec3(0.0, 1.0, 0.0);
    // rock in strata is hatched down its faces (a cliff's, a needle's strokes run with the fall of the
    // rock, as the reference sheets draw them); everything else on the diagonal
    vec2 ce1 = strokeCoord(tw, uMode == ${MODE_STRATA} ? vec2(0.99, 0.14) : vec2(0.766, 0.643));
    vec2 ce2 = strokeCoord(tw, vec2(0.83, -0.56));
    float fw1 = fwidth(ce1.x), fw2 = fwidth(ce2.x);
    // form-following strokes: height contours (terrain slopes) / rings round objects
    vec2 ceY = vec2(vObjPos.y, dot(vObjPos.xz, vec2(0.7071)));
    float fwY = fwidth(vObjPos.y);
    vec2 fwd = vec2(fw1, fwidth(ce1.y));
    #ifdef S_FORM
    vec3 formDx = dFdx(vForm.xyz), formDy = dFdy(vForm.xyz);   // (form-following strokes: their derivatives here)
    #endif
    vec3 gq = vObjPos / max(uGrid, 1e-3);
    vec3 gfw = fwidth(gq);
    vec3 gw = vec3(0.0);
    #if defined(S_GRID) || defined(S_GLYPHS)
    if (uGrid > 0.0 || uGlyphs > 0.0) { gw = pow(abs(normalize(on)), vec3(6.0)); gw /= (gw.x + gw.y + gw.z); }
    #endif
    vec2 fwp = fwidth(vWorldPos.xz);
    float foldU = vFold.x * uFolds;
    float foldFw = fwidth(foldU);
    float fwBind = max(fwidth(vBind.y), fwidth(vBind.x)) / max(uPixelRatio, 1e-3);
    #ifdef CROWD
      // the crowd's eye almond, in its own frame (crowd.js: tilted 0.18 rad up at the outer corner)
      vec2 crowdL = mat2(0.9838, -0.1790, 0.1790, 0.9838) * vec2(abs(vBind.x) - 0.031, vBind.y - 1.672);
      crowdL.x *= vBind.x < 0.0 ? -1.0 : 1.0;   // unmirrored: the highlight on the same side in both
      float crowdPx = max(fwidth(crowdL.x), fwidth(crowdL.y));
    #endif
    // drawn-detail coordinates + derivatives (uniform control flow)
    float faceX = abs(on.x) > abs(on.z) ? vObjPos.z : vObjPos.x;     // horizontal coord on a side face
    float fissFw = fwidth(faceX) / 9.0;
    #if defined(S_WEATHER) || defined(S_DETAIL)
    // the wall's own frame for weathering and pen detail: along it and up. Along is world x on walls facing z, world z
    // on walls facing x, blended between: the tangent of the interpolated normal (dot(p, t)) swept a
    // round wall far from the origin through hundreds of metres a turn (a thin column's marks became a
    // field of specks)
    vec2 wqA = vec2(vWorldPos.x, vWorldPos.y), wqB = vec2(vWorldPos.z, vWorldPos.y);
    float wfy = length(vec2(dFdx(vWorldPos.y), dFdy(vWorldPos.y)));
    vec2 wfqA = vec2(length(vec2(dFdx(vWorldPos.x), dFdy(vWorldPos.x))), wfy), wfqB = vec2(length(vec2(dFdx(vWorldPos.z), dFdy(vWorldPos.z))), wfy);
    // each building its own wear: an amount and a pattern from where it stands
    vec2 wCell = floor(vWorldPos.xz / 9.0);
    float wSeed = floor(hash(wCell + 7.0) * 61.0), wK = uWeather * (0.6 + 0.8 * hash(wCell + 3.0));
    #endif
    #ifdef S_STRATA
    // strokes along the beds of rock (the strata's own wavy horizontals), lit or not
    #ifdef STRATA_OBJECT
    vec3 strataP = vObjPos;
    #else
    vec3 strataP = vWorldPos;
    #endif
    vec2 strataC = vec2(strataP.y + (vnoise(strataP.xz * 0.04) - 0.5) * uStrataSize * 0.9 + (vnoise(vec2(faceX * 0.05, strataP.y * 0.1)) - 0.5) * 1.6, faceX);
    float strataFw = fwidth(strataC.x);
    #endif
    // the makers' inscriptions: on upright faces, in cells of uGlyphs metres (the grid's)
    vec3 gg = vObjPos / max(uGlyphs, 1e-3), ggfw = fwidth(gg);
    vec2 glyphUV = gw.x > gw.z ? gg.zy : gg.xy;
    vec2 glyphFw = gw.x > gw.z ? ggfw.zy : ggfw.xy;
    vec3 carve = vec3(0.0);
    #ifdef S_GLYPHS
    if (uGlyphs > 0.0 && gw.y < 0.5) carve = glyphs(glyphUV, glyphFw);
    #endif

    vec3 n = normalize(vNormal);
    if (uFlat > 0.5) {
      // Faceted look: derive the normal from screen-space derivatives, of the position measured from
      // the camera: those of vWorldPos lose their low bits kilometres out (the References' views, a
      // far city), the facet's normal wobbled by a percent from pixel to pixel, and a facet turned
      // edge-on to the sun broke into a field of lit and shaded specks, each inked by post.js
      n = normalize(cross(dFdx(vWorldRel), dFdy(vWorldRel)));
    }
    #ifndef GRASS
    else if (!gl_FrontFacing) n = -n;   // (grass blades: both sides lit like the ground)
    #endif

    #ifdef WATER
      WaterLook wl = waterLook(vWorldPos, gl_FrontFacing);   // (water-shader.js; derivatives here, in uniform flow)
    #endif
    vec3 albedo = uColor;
    #ifdef S_MAP
    if (uHasMap > 0.5) albedo *= texture(uMap, vTextureUV).rgb;
    #endif
    vec3 instColor = vInstColor;
    if (uPaletteSize > 0) {
      // printed zones: snap blended vertex colours to the nearest ink, so zone edges stay crisp
      float best = 1e9;
      for (int i = 0; i < 12; i++) {
        if (i >= uPaletteSize) break;
        vec3 d = vInstColor - uPalette[i];
        if (dot(d, d) < best) { best = dot(d, d); instColor = uPalette[i]; }
      }
    }
    vec2 bw = vec2(0.0);
    float slope = 1.0 - n.y;
    if (false) {
    }
    #ifdef S_TERRAIN
    else if (uMode == ${MODE_TERRAIN}) {
      // Sand with flat patches of a second tone, rock on steep slopes; the
      // three tones come from the region (golden dunes / rose canyons / salt flats).
      vec3 c1 = uColor, c2 = uColor2, c3 = uColor3;
      #ifdef S_BIOMES
      if (uBiomes > 0.5) {
        bw = biomeWeights(vWorldPos.xz);
        biomeGround(bw, c1, c2, c3);
      }
      #endif
      float patches = vnoise(vWorldPos.xz * 0.011) * 0.65 + vnoise(vWorldPos.xz * 0.045) * 0.35;
      // (hard tone edges on purpose: post.js inks them as one solid line; blended, the
      //  edge test would catch them only here and there, a dotted line that crawls)
      albedo = patches > 0.6 ? c2 : c1;
      if (slope > 0.42) albedo = c3;
      else if (slope > 0.30 && patches < 0.45) albedo = mix(c1, c3, 0.5);
      float b = max(blobs(vWorldPos.xz, fwp, 2.2, 0.28, 0.45, 0.0),
                max(blobs(vWorldPos.xz, fwp, 11.0, 1.3, 0.35, 41.0),
                    blobs(vWorldPos.xz, fwp, 34.0, 3.2, 0.22, 97.0)));
      if (uSandInk < 0.5) albedo *= mix(vec3(1.0), vec3(0.945, 0.935, 0.965), b);
    }
    #endif
    #ifdef S_STRATA
    else if (uMode == ${MODE_STRATA}) {
      #ifdef STRATA_OBJECT
      albedo = strata(vObjPos);     // bands fixed to the object (a planet seen turning past a window)
      #else
      albedo = strata(vWorldPos);
      #endif
    }
    #endif
    #ifdef S_RIBBON
    else if (uMode == ${MODE_RIBBON}) {
      // flat print bands of colour, fixed along the path so they don't crawl
      // colours blend smoothly from one band into the next
      vec3 P[5] = vec3[5](vec3(0.949, 0.773, 0.294), vec3(0.902, 0.529, 0.373), vec3(0.910, 0.561, 0.651),
                          vec3(0.663, 0.608, 0.878), vec3(0.384, 0.765, 0.788));
      int i0 = int(mod(floor(vFold.x), 5.0)), i1 = int(mod(floor(vFold.x) + 1.0, 5.0));
      albedo = mix(P[i0], P[i1], smoothstep(0.0, 1.0, fract(vFold.x)));
      #ifdef FLUID
        // powered by the backpack: the bands run in the fluid's tones (fluid-tool.js powerTrails)
        float nf = max(uFluidA.y, 1.0);
        albedo = mix(fluidTone(int(mod(floor(vFold.x), nf))), fluidTone(int(mod(floor(vFold.x) + 1.0, nf))), smoothstep(0.0, 1.0, fract(vFold.x)));
      #endif
    }
    #endif
    #ifdef S_FIGURE
    else if (uMode == ${MODE_OUTFIT}) {
      // boots / trousers / belt / tunic with sleeves / skin at the neck and hands
      vec3 b = vBind;
      float ax = abs(b.x);
      if (ax > uOutfit.w && uGlove.a > 0.5) albedo = uGlove.rgb;
      else if ((b.y > uOutfit.z && ax < 0.16) || ax > uOutfit.w) albedo = uSkin;
      else if (b.y < uOutfit.x) albedo = uColor3;
      else if (abs(b.y - uOutfit.y) < 0.03 && ax < 0.25) albedo = uColor2 * 0.6 + vec3(0.33, 0.24, 0.1);
      else if (b.y < uOutfit.y) albedo = uColor2;
      else if (ax > uOutfit.w - 0.05) albedo = uColor * 0.75;     // cuffs
      else albedo = uTrim.w > 0.5 ? outfitTrim(uColor, uTrim.rgb, uTrim.w, b) : uColor;
    }
    #endif
    #ifdef S_EYE
    else if (uMode == ${MODE_EYE}) {
      albedo = eyeball(vBind, uColor, uColor2, uSkin);
    }
    #endif
    #if defined(S_WATERMODE) || defined(WATER)
    else if (uMode == ${MODE_WATER}) {
      #ifdef WATER
        albedo = wl.albedo;
      #else
      // two flat tones drifting slowly
      float w = vnoise(vWorldPos.xz * 0.012 + uTime * 0.01);
      albedo = w > 0.55 ? uColor2 : uColor;
      #endif
    }
    #endif
    #ifdef FLUID
      albedo = fluidAlbedo(albedo);
    #endif
    #ifdef S_PATCH
    // colour across a wall (PATCH): big flat patches, each building its own; none far off (nothing paid)
    #if defined(S_WEATHER) || defined(S_DETAIL)
    vec3 patchFw = vec3(wfqA.x, wfy, wfqB.x);   // (the walls' frame's: metres per px along x, y, z)
    #else
    vec3 patchFw = fwidth(vWorldPos);   // (uniform flow)
    #endif
    if (uPatch > 0.0 && vViewDepth < ${PATCH.far[1]}.0) {
      float pk = 1.0 - smoothstep(${PATCH.far[0]}.0, ${PATCH.far[1]}.0, vViewDepth);
      vec3 dP = albedo * (wallPatch(vWorldPos, normalize(vNormal), uPatch, patchFw) - 1.0);
      albedo += dP * min(1.0, ${PATCH.edge} / max(length(dP), 1e-5)) * pk;   // (never past the colour-edge threshold)
    }
    #endif
    float patInk = 0.0;
    float emit = 0.0;   // lit windows at night (facade)
    #ifdef S_FACADE
    if (uPattern == 1) patInk = facade(vWorldPos, n, normalize(vNormal), albedo, emit);
    #endif
    #ifdef S_TILES
    if (uPattern == 2) patInk = roofTiles(vWorldPos);
    #endif
    #ifdef S_LEAVES
    if (uPattern == 3) patInk = leaves(vObjPos);
    #endif
    #ifdef S_CRACKS
    if (uPattern == 4 && uMode != ${MODE_TERRAIN}) patInk = rockCracks(vObjPos);   // (bare rock ground: rockFissures, below)
    #endif
    #ifdef S_WEATHER
    if (uWeather > 0.0 && abs(n.y) < 0.55) {
      float wUp = 1.0 - smoothstep(0.35, 0.55, abs(n.y));
      float ax = abs(n.x), az = abs(n.z), wb = smoothstep(0.36, 0.64, ax / max(ax + az, 1e-4));   // 0: facing z, 1: facing x
      float litK = smoothstep(0.02, 0.15, dot(n, uSunDir));
      float wi = 0.0;
      if (wb < 0.999) {
        vec3 aA = albedo;
        wi = weatherInk(wqA, wfqA, vec2(uSunDir.x, uSunDir.y), litK, wSeed, wK, aA) * (1.0 - wb);
        albedo = mix(albedo, aA, (1.0 - wb) * wUp);
      }
      if (wb > 0.001) {
        vec3 aB = albedo;
        wi = max(wi, weatherInk(wqB, wfqB, vec2(uSunDir.z, uSunDir.y), litK, wSeed + 13.0, wK, aB) * wb);
        albedo = mix(albedo, aB, wb * wUp);
      }
      patInk = max(patInk, wi * wUp);
    }
    #endif
    #ifdef S_DETAIL
    // (one projection, the wall's dominant axis: a round wall's pattern changes at its 45° lines; and none
    // past DETAIL.depth, where its marks would be under a pixel anyway: far pixels pay nothing)
    float dFar = uDetail.x > 1.5 ? ${DETAIL.depthOrganic}.0 : ${DETAIL.depth}.0;   // (grain: a forest's trunks fill the frame, cut nearer)
    if (uDetail.x > 0.5 && abs(n.y) < 0.75 && vViewDepth < dFar) {
      float dUp = (1.0 - smoothstep(0.55, 0.75, abs(n.y))) * (1.0 - smoothstep(dFar * 0.7, dFar, vViewDepth));
      bool facingX = abs(n.x) > abs(n.z);
      float dSeed = floor(hash(floor(vWorldPos.xz / 9.0) + 11.0) * 53.0) + (facingX ? 29.0 : 0.0);
      float di = detailLod(facingX ? wqB : wqA, facingX ? wfqB : wfqA, uDetail.y, dSeed, uDetail.x > 1.5);
      patInk = max(patInk, di * dUp * ${DETAIL.ink.toFixed(2)});   // (over 1: a darker pen line, post.js; under 2)
    }
    #endif
    albedo *= instColor;
    #ifdef S_FORM
    if (uVeins > 0.0 && uFormHatch > 0.0 && vForm.w > 0.5 && vForm.w < 1.5) {
      // a dark cap's underside (the Garden's umbrellas): its veins drawn lighter, radiating from the stalk, lit
      // or not (a shade under the colour-edge threshold: no outline of their own; ink would vanish on it)
      const float K = ${(FORM.turn / (2 * Math.PI)).toFixed(4)};
      float r2 = max(dot(vForm.xy, vForm.xy), 1e-8);
      float fwT = (abs(vForm.x * formDx.y - vForm.y * formDx.x) + abs(vForm.x * formDy.y - vForm.y * formDy.x)) / r2 * K;
      float vein = veinLines(atan(vForm.y, vForm.x) * K, fwT, uHatchSpacing * ${FORM.veins.spacing.toFixed(4)}, ${FORM.veins.width.toFixed(4)}, vec2(sqrt(r2) * 0.5, 9.0));
      albedo += min(albedo * 1.2, vec3(${FORM.veins.lift.toFixed(4)})) * vein * uVeins;
    }
    #endif
    #ifdef MAKERS_BOX
    {
      vec3 bp = vObjPos - vec3(0.0, uBoxB.w, 0.0);
      vec2 mark = boxMarks(vObjPos, vObjNormal);
      vec3 ray = boxRay(bp);
      // a tone of its own over the form (no hatching on it): paler where it turns up, deeper underneath
      albedo *= mix(0.72, 1.1, smoothstep(-0.7, 0.85, vObjNormal.y / max(length(vObjNormal), 1e-4)));
      albedo = mix(albedo, uBoxMark, mark.x);
      albedo = mix(albedo, mix(albedo, uBoxMark, 0.45 + 0.4 * uBoxA.y), mark.y);   // (the compasses paler than the star)
      albedo = mix(albedo, uBoxLight, clamp(ray.x + 0.45 * ray.y + 0.25 * ray.z, 0.0, 1.0));
      // (the star and the ray are lights: they keep their colour in shade, and bloom)
      emit = max(emit, max(mark.x * uBoxA.y, mark.y * uBoxA.y * 0.6));
      emit = max(emit, max(ray.x * 0.97, max(ray.y * 0.75, ray.z * 0.4)));
    }
    #endif
    #ifdef S_PLATES
    float plateInk = 0.0;
    if (uPlates > 0.5) {
      float plateTone;
      plateInk = plateLines(gq, gfw, gw, plateTone);
      albedo *= 1.0 + 0.09 * plateTone;
    }
    #endif
    #ifdef GRASS
    if (vGrassLook.z > 0.0) {
      // further off, the ground's own tone under the tuft (its patches, as the terrain draws them)
      float patches = vnoise(vWorldPos.xz * 0.011) * 0.65 + vnoise(vWorldPos.xz * 0.045) * 0.35;
      albedo = mix(albedo, patches > 0.6 ? uColor2 : uColor, vGrassLook.z);
    }
    #endif
    #ifdef CROWD
      if (vCrowdTrim.w > 0.5) albedo = outfitTrim(albedo, vCrowdTrim.rgb, vCrowdTrim.w, vBind);
      if (vCrowdEye.w > 0.5) albedo = crowdEye(crowdL, crowdPx, albedo, vCrowdEye.rgb);
    #endif
    // the traveller's drawn eyes: the white and the iris inside the lids (face.js)
    #ifdef S_PORTRAIT
    if (uPortrait > 0.5) albedo = portraitEyes(vBind, albedo);
    #endif
    // cloth: the colour runs from the collar (uColor) down to the hem (uColor2)
    // cloth in flat blocks of colour, like a printed plate: the body colour, then a hem band
    #ifdef S_FOLDS
    if (uFolds > 0.0) albedo = (vFold.y < 0.62 ? uColor : uColor2) * vInstColor;
    #endif

    float ndl = dot(n, uSunDir);
    // a flat facet edge-on to the sun (a wall in line with it) sat on the toon threshold, where the last bits of
    // its normal and the shadow map's grazing taps broke it into a field of lit specks: it goes to shade, whole
    // (FACET_EDGE; a smooth surface keeps its terminator's antialiasing)
    if (uFlat > 0.5 && ndl < ${FACET_EDGE}) ndl = min(ndl, -${FACET_EDGE});
    float lambert = ndl * 0.5 + 0.5;
    // the face takes cast shadows from outside its helmet only, keeping one clean shadow shape
    #ifdef S_PORTRAIT
    vec3 shadowAt = uPortrait > 0.5 ? vWorldPos + n * 0.22 : vWorldPos;
    #else
    vec3 shadowAt = vWorldPos;
    #endif
    // (a person's face is lit as one rounded volume, faceRound: the ink pass sees the same rounded
    // normals, so the low-poly face's facets draw no creases across it)
    float shadowPx = max(length(dFdx(vWorldPos)), length(dFdy(vWorldPos)));   // (outside the branch: derivatives)
    float nTurn = length(fwidth(n));   // how fast the normal turns from pixel to pixel (a big smooth form: little; a stalk: a lot)
    float sh = ndl > 0.0 ? getShadow(shadowAt, n, ndl, shadowPx) * cloudShadow(vWorldPos) : 1.0;
    // a big curved surface turning from the sun (a pipe, a tank, a trunk): within TERMINATOR of edge-on its own shadow
    // map's grazing taps cut the light/shade line into teeth that crawl as the camera moves; there the line is the
    // light's own (n·l), whole. Only where the form is large on screen (its normal turns slowly from pixel to pixel):
    // a stalk or a twig keeps the map's shade, which holds it still. (Not the ground: a low sun's cast shadows stay;
    // flat facets: FACET_EDGE.)
    if (uMode != ${MODE_TERRAIN} && uFlat < 0.5)
      sh = mix(sh, mix(1.0, sh, smoothstep(0.0, ${TERMINATOR}, ndl)), 1.0 - smoothstep(${TERMINATOR_TURN[0]}, ${TERMINATOR_TURN[1]}, nTurn));
    // Cast shadows clamp the light term below the toon threshold (0.5) but keep
    // some gradation so the post-process can choose single vs cross hatching.
    float L = mix(min(lambert, 0.38), lambert, sh);
    L = mix(L, 1.0, max(uGlow, emit));
    #ifdef METAL
      float metalInk;
      albedo = metalAlbedo(albedo, n, ndl > 0.0 ? smoothstep(0.4, 0.6, sh) : 0.0, metalInk);
    #endif
    // carved inscriptions: the shadowed side of each groove drops into the shadow tone, the lit lip a shade lighter
    L = mix(L, min(L, uToon - 0.14), carve.y);
    albedo *= 1.0 + 0.05 * (carve.x - carve.y);

    // local lights pool light on nearby surfaces, even inside shadow (main.js packs the lit
    // ones first and counts them: the rest are never looked at)
    float local = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= uLightCount) break;
      vec3 dl = uLights[i].xyz - vWorldPos;
      float d = length(dl);
      if (d < uLights[i].w) {
        float att = pow(1.0 - d / uLights[i].w, 2.0);
        local = max(local, att * (0.35 + 0.65 * max(dot(n, dl / d), 0.0)));
      }
    }
    L = max(L, mix(L, 0.97, smoothstep(0.15, 0.5, local)));
    #ifdef WATER
      L = mix(L, max(L, 0.8), wl.lit);
    #endif
    #ifdef DISSOLVE
    albedo = mix(albedo, uDissolveColor, dEdge);
    L = mix(L, 1.0, dEdge);
    #endif

    // (the line's weight and colour over the light term: LINE, post.js lightOf)
    gAlbedoLight = vec4(albedo, clamp(L, 0.0, 1.0) + 2.0 * uLineStep);
    gNormalDepth = vec4(n, vViewDepth);
    #ifdef WATER
      if (gl_FrontFacing && uWaterOpt.y < 0.5) gNormalDepth.xyz *= 1.0 + ${WATER_MARK.base} + ${WATER_MARK.glint} * wl.glint;   // (water.js: the sparkle)
    #endif

    gHatch = vec4(0.0);
    float detail = 0.0;
    #ifdef S_PORTRAIT
    if (uPortrait > 0.5) detail = portraitInk(vBind, clamp((uToon - L) / uToon, 0.0, 1.0));
    #endif
    #ifdef S_CREASES
    if (uCreases > 0.0) detail = max(detail, outfitCreases(vBind, normalize(vObjNormal), clamp((uToon - L) / uToon, 0.0, 1.0)));
    #endif
    #ifdef S_GRID
    if (uGrid > 0.0) {
      #ifdef S_PLATES
      if (uPlates > 0.5) detail = plateInk; else
      #endif
      detail = gridLines(gq, gfw, gw);
    }
    #endif
    detail = max(detail, carve.z * 0.62);
    #ifdef METAL
      detail = max(detail, metalInk);
    #endif
    if (false) {
    }
    #ifdef S_TERRAIN
    else if (uMode == ${MODE_TERRAIN}) {
      // ground ink by distance (src/ground-ink.js); derivatives first, in uniform control flow
      vec2 gp = vWorldPos.xz;
      float gm = max(length(dFdx(gp)), length(dFdy(gp)));        // metres per px, the longer footprint
      float sandK = 1.0 - bw.y;
      #ifdef S_RIPPLES
      if (uRipples > 0.5) {
        detail = max(detail, sandRipples(gp, slope) * sandK);
        // grains close up; in the dotted print style, coarser dots that last further out
        // (not in the print look: its pebbles' grit takes their place, below)
        float grains = uDots > 0.0 ? 0.0 : sandGrains(gp, gm, 0.25, 0.12, 0.005, 0.01, 71.0) * 0.55;
        detail = max(detail, grains * sandK * (1.0 - smoothstep(0.35, 0.6, slope)));
        // (the print's spots on the sand: pebbles and stones, each with its dark side and the shadow it casts away
        //  from the light, in patches; not dots. ground-ink.js PEBBLES)
        if (uDots > 0.0) {
          vec2 s2 = uSunDir.xz / max(length(uSunDir.xz), 1e-3);
          float len = pebbleShadow(uSunDir.y), castK = smoothstep(uToon - 0.02, uToon + 0.12, L);
          float pk = smoothstep(${PEBBLES.patch[0].toFixed(2)}, ${PEBBLES.patch[1].toFixed(2)}, vnoise(gp * 0.04 + 23.0));
          // (a high sun: more of them, a little bigger, as its shadows shrink: ground-ink.js pebbleNoon)
          float hk = smoothstep(${PEBBLES.noon.from.toFixed(2)}, ${PEBBLES.noon.to.toFixed(2)}, uSunDir.y), nc = 1.0 + ${PEBBLES.noon.count.toFixed(3)} * hk, ns = 1.0 + ${PEBBLES.noon.size.toFixed(3)} * hk;
          float peb = max(max(pebbleField(gp, gm, s2, len, castK, ${PEBBLES.grit.cell.toFixed(2)}, ${PEBBLES.grit.density.toFixed(3)} * nc, vec2(${PEBBLES.grit.r[0].toFixed(3)}, ${PEBBLES.grit.r[1].toFixed(3)}) * ns, ${PEBBLES.grit.seed.toFixed(1)}),
                          pebbleField(gp, gm, s2, len, castK, ${PEBBLES.pebble.cell.toFixed(2)}, ${PEBBLES.pebble.density.toFixed(3)} * pk * nc, vec2(${PEBBLES.pebble.r[0].toFixed(3)}, ${PEBBLES.pebble.r[1].toFixed(3)}) * ns, ${PEBBLES.pebble.seed.toFixed(1)})),
                          pebbleField(gp, gm, s2, len, castK, ${PEBBLES.stone.cell.toFixed(2)}, ${PEBBLES.stone.density.toFixed(3)} * nc, vec2(${PEBBLES.stone.r[0].toFixed(3)}, ${PEBBLES.stone.r[1].toFixed(3)}) * ns, ${PEBBLES.stone.seed.toFixed(1)}));
          detail = max(detail, peb * uDots * sandK * (1.0 - smoothstep(0.35, 0.6, slope)));
        }
      }
      #endif
      #ifdef S_BIOMES
      if (uBiomes > 0.5) {
        vec2 q1 = crackCoord(gp, 5.5), q2 = crackCoord(gp + 31.0, 1.6);
        vec4 j1 = vec4(dFdx(q1), dFdy(q1)), j2 = vec4(dFdx(q2), dFdy(q2));
        float k = smoothstep(0.3, 0.8, bw.y) * (1.0 - smoothstep(0.14, 0.22, slope));
        if (k > 0.0) detail = max(detail, mudCracks(gp, q1, j1, q2, j2) * k);
      }
      #endif
      #ifdef S_TICKS
      if (uTicks > 0.5 && slope < 0.35) detail = max(detail, grassTicks(vWorldPos.xz, fwp) * 0.8);
      #endif
      #ifdef S_SANDINK
      if (uSandInk > 0.5) detail = max(detail, sandScuffs(vWorldPos.xz) * (1.0 - bw.y));
      #endif
      float rocky = 0.0;
      #ifdef S_CRACKS
      if (uPattern == 4) {
        // bare rock ground: long fissures and a finer broken net near, few dots (a uniform branch:
        // its derivatives are fine)
        vec2 q1 = crackCoord(gp, ${GROUND.fissures.big.toFixed(1)}), q2 = crackCoord(gp + 17.0, ${GROUND.fissures.small.toFixed(1)});
        vec4 j1 = vec4(dFdx(q1), dFdy(q1)), j2 = vec4(dFdx(q2), dFdy(q2));
        detail = max(detail, rockFissures(gp, q1, j1, q2, j2) * (1.0 - smoothstep(0.55, 0.8, slope) * 0.5));
        rocky = 1.0;
      }
      #endif
      if (uDots > 0.0 && uSandInk < 0.5 && uRipples < 0.5) {
        // pen dotting: patchy, denser in hollows, a few bigger pebble dots (on cracked rock only the
        // pebbles, here and there)
        float patchy = (0.45 + 0.55 * smoothstep(0.3, 0.75, vnoise(vWorldPos.xz * 0.06 + 7.0))) * (1.0 - rocky);
        float dots = stipple(ce1, fwd, 8.5 * mix(0.7, 1.45, smoothstep(5.0, 220.0, vViewDepth)), 0.32);
        float pebbles = stipple(ce2 * 0.37, fwd * 0.37, 20.0, 0.75) * step(0.5, vnoise(vWorldPos.xz * 0.2)) * (1.0 - 0.7 * rocky);
        detail = max(detail, max(dots * patchy, pebbles) * uDots * 1.6);
      }
    }
    #endif
    #if defined(S_WATERMODE) || defined(WATER)
    else if (uMode == ${MODE_WATER}) {
      #ifdef WATER
        detail = max(detail, wl.ink);
      #else
        detail = max(detail, waterLines(vWorldPos.xz, uTime) * 0.7);
      #endif
    }
    #endif
    #ifdef S_STRATA
    else if (uMode == ${MODE_STRATA} && abs(normalize(on).y) < 0.6) {
      detail = max(detail, fissures(vec2(faceX, vObjPos.y), fissFw) * 0.85);
      if (uCracks > 0.0) detail = max(detail, faceCracks(vec2(faceX, vObjPos.y), fissFw * 9.0, uCracks) * 1.7);   // (over 1: a pen line, post.js drawnK)
    }
    #endif
    #ifdef S_SCRUB
    if (uScrub > 0.0) {
      // brush: short broken pen strokes over the lobes, denser in shade
      float dash = smoothstep(0.42, 0.6, vnoise(vec2(ce1.x * 2.5, ce1.y * 9.0)));
      float dk = clamp((uToon - L) / uToon, 0.0, 1.0);
      float strokesB = strokes(ce1, fw1, mix(6.0, 3.5, dk), mix(0.8, 1.3, dk));
      detail = max(detail, strokesB * dash * (0.6 + 0.4 * dk));
    }
    #endif
    #ifdef S_FOLDS
    if (uFolds > 0.0) {
      // drapery: fold lines down the cloth, each starting and ending at its own height
      float col = floor(foldU + 0.5);
      float d = abs(foldU - col) / max(foldFw, 1e-5);
      float h1 = hash(vec2(col, 3.1)), h2 = hash(vec2(col, 8.7));
      float run = smoothstep(0.08 + h1 * 0.25, 0.14 + h1 * 0.25, vFold.y) * (1.0 - smoothstep(0.75 + h2 * 0.25, 0.8 + h2 * 0.25, vFold.y));
      detail = max(detail, inkLine(d, mix(1.3, 0.7, vFold.y)) * run * step(0.25, h2 + 0.3));
    }
    #endif
    #ifdef S_FIGURE
    if (uMode == ${MODE_OUTFIT} && uSuit > 0.0) {
      // a padded suit: short curved creases bunch up at the elbows, knees, waist and shoulders
      vec3 b = vBind;
      float ax = abs(b.x);
      float wob = (vnoise(b.xz * 40.0 + b.y * 9.0) - 0.5) * 0.35;
      float arm = smoothstep(0.24, 0.3, ax) * (1.0 - smoothstep(uOutfit.w - 0.06, uOutfit.w - 0.02, ax));
      float elbow = 1.0 - smoothstep(0.03, 0.11, abs(ax - 0.42));
      float knee = (1.0 - smoothstep(0.04, 0.13, abs(b.y - 0.5))) * step(ax, 0.24);
      float waist = (1.0 - smoothstep(0.02, 0.08, abs(b.y - uOutfit.y + 0.06))) * step(ax, 0.24);
      float u = arm > 0.5 ? ax * 22.0 + wob : b.y * 22.0 + wob;
      float fu = max(fwidth(u), 1e-4);
      float creases = inkLine(abs(fract(u) - 0.5) / fu, 0.9) * step(0.45, vnoise(vec2(u * 0.7, b.z * 30.0 + b.x * 11.0)));
      detail = max(detail, creases * max(max(elbow * arm, knee), waist) * 0.85 * (1.0 - smoothstep(0.05, 0.2, fu)));
    }
    if (uMode == ${MODE_OUTFIT} && vBind.y > uOutfit.z && abs(vBind.x) < 0.16) {
      vec3 nb = normalize(vObjNormal);
      float frontal = smoothstep(0.15, 0.45, nb.z);
      // (over 1: a pen line, drawn darker than the other drawn detail by post.js)
      detail = max(detail, 2.0 * faceInk(vec2(abs(vBind.x), vBind.y - uFace.x), fwBind * uPixelRatio, frontal, clamp((uToon - L) / uToon, 0.0, 1.0), nb));
    }
    #endif
    detail = max(detail, patInk);
    gHatch.b = detail + 4.0 * uSpotStep;
    #ifdef S_WEATHER
    if (uWeather > 0.0) gHatch.b += 16.0;   // weathered: post.js darkens the dust splashed up its foot
    #endif
    gHatch.a = max(max(uGlow, emit), smoothstep(0.15, 0.6, local) * 0.6) + 2.0 * uHero + 4.0 * uFigure;
    // a face (its skin and its eyes, and the neck's skin under it): post.js shades it in a warm tone of
    // its own (FACE_SHADE) and leaves out the line round its shade and the crease shading
    bool facePart = false;
    #ifdef S_EYE
    facePart = facePart || uMode == ${MODE_EYE};
    #endif
    #ifdef S_FIGURE
    facePart = facePart || (uMode == ${MODE_OUTFIT} && vBind.y > uOutfit.z && abs(vBind.x) < 0.16);
    #endif
    #ifdef FACE_PART
      facePart = true;
    #endif
    if (facePart) gHatch.a += 16.0;
    gHatch.a += 32.0 * uDrift;   // sand banked against something (sand-drifts.js): post.js draws its meeting line softly
    #ifdef DISSOLVE
    gHatch.a = max(gHatch.a, dEdge);
    #endif
    float dark = clamp((uToon - L) / uToon, 0.0, 1.0);
    // detail by distance: finer marks close to the camera, coarser far away
    // (a hatch over 1 is a denser one, a hatched mass (Lorn II's roots and bushes): its strokes a little closer
    // (never finer than a pen can draw: past ~4 px they would only be a tone) and heavier, cross-hatched sooner)
    float hDense = max(uShade.z, 1.0);
    float hsp = uHatchSpacing * mix(0.78, 1.4, smoothstep(6.0, 260.0, vViewDepth)) / min(hDense, ${HATCH_DENSE.closer.toFixed(2)});
    float darkH = min(dark * (1.0 + (hDense - 1.0) * ${HATCH_DENSE.heavier.toFixed(2)}), 1.0);
    if (darkH > 0.0 && uHatch > 0.0 && uShadeStyle == 1) {
      gHatch.r = stipple(ce1, fwd, hsp * 1.15, darkH) * smoothstep(0.02, 0.15, darkH);
    }
    #ifdef S_FORM
    // a part with an axis (a cap, a cylinder: FORM): strokes radiating from it or wrapping round it
    else if (darkH > 0.0 && uHatch > 0.0 && vForm.w > 0.5 && uFormHatch > 0.0) {
      gHatch.rg = formHatch(vForm, formDx, formDy, hsp, darkH);
    }
    #endif
    else if (darkH > 0.0 && uHatch > 0.0) {
      float h1 = strokes(ce1, fw1, hsp, mix(0.9, 2.2, darkH)) * smoothstep(0.02, 0.12, darkH);
      if (uFormHatch > 0.0 && uMode == ${MODE_TERRAIN}) {
        // on slopes the strokes become height contours wrapping round the dunes
        float sm = smoothstep(0.1, 0.3, slope) * uFormHatch;
        float hc = strokes(ceY, fwY, hsp, mix(0.9, 2.2, darkH)) * smoothstep(0.02, 0.12, darkH);
        h1 = mix(h1, hc, sm);
      }
      float h2 = 0.0;
      if (darkH > 0.5) {
        // (on upright faces: under a cap or an overhang the height's contours wander into wood grain)
        bool rings = uFormHatch > 0.0 && uFlat < 0.5 && uMode != ${MODE_TERRAIN} && abs(n.y) < 0.6;
        // smooth objects: cross-hatch as rings round the form (trunks, ribs, domes)
        h2 = (rings ? strokes(ceY, fwY, hsp * 1.2, mix(0.6, 1.7, darkH))
                    : strokes(ce2, fw2, hsp * 1.2, mix(0.6, 1.7, darkH))) * smoothstep(0.5, 0.65, darkH);
      }
      gHatch.rg = vec2(h1, h2);
    }
    #ifdef S_STRATA
    // (lit, upright, and near enough for post.js to draw strokes at all: it fades them out by 700 m)
    if (uMode == ${MODE_STRATA} && uShade.w > 0.0 && L >= uToon && vViewDepth < 700.0 && abs(normalize(on).y) < 0.7) {
      // rock in light keeps a texture of strokes: runs of them along its beds (the strata's wavy
      // horizontals); in shade the hatching is the shading, as on everything
      float upright = 1.0 - smoothstep(0.45, 0.7, abs(normalize(on).y));
      float runs = smoothstep(0.42, 0.66, vnoise(vec2(strataC.y * 0.09, strataC.x * 0.55)));
      float beds = strokes(strataC, strataFw, hsp * 1.25, 0.85) * runs * upright * uShade.w * step(uToon, L);
      gHatch.r = max(gHatch.r, beds);
    }
    #endif
    // a face is flat colour and one shadow tone: its strokes are its own (faceInk)
    #ifdef S_FIGURE
    if (uMode == ${MODE_OUTFIT}) gHatch.rg *= 1.0 - faceFlat(vBind);
    #endif
    #ifdef S_EYE
    if (uMode == ${MODE_EYE}) gHatch.rg = vec2(0.0);
    #endif
    #ifdef FACE_PART
      gHatch.rg = vec2(0.0);
    #endif
    // the shade's tone (SHADE): the material's lift, the half-tone of a form turned from the sun
    // (no cast shadow on it: those keep the full shadow), the ground's light on faces turned down
    if (L < uToon) {
      float turned = ndl < 0.0 ? (ndl > -${SHADE.band} ? 1.0 : 0.6) : 0.0;
      float lift = 1.0 - (1.0 - uShade.x) * (1.0 - uHalftone * turned) * (1.0 - uBounce * smoothstep(-0.1, -0.7, n.y));
      // (a lifted shade is a half-tone: few strokes, and no cross-hatching over a whole wall)
      // a sand ground hatches little in shade on its flats, fully on a steep slip face (SHADE.slip)
      float hatchK = uMode == ${MODE_TERRAIN} ? mix(min(uShade.z, 1.0), 1.0, smoothstep(${SHADE.slip[0]}, ${SHADE.slip[1]}, slope)) : min(uShade.z, 1.0);
      float liftK = lift;
      #ifdef S_FORM
      // (a cap's fan of strokes stays dense under a lifted shade, as the sheets draw a pale cap's gills)
      if (vForm.w > 0.5) liftK *= 1.0 - (vForm.w > 1.5 ? ${FORM.wrap.keep.toFixed(4)} : ${FORM.cap.keep.toFixed(4)});
      #endif
      // (a dense hatch, over 1, keeps its strokes and cross-hatch under a half-tone: a hatched mass stays one)
      liftK /= max(uShade.z, 1.0) * max(uShade.z, 1.0);
      gHatch.rg *= hatchK * vec2(1.0 - 0.8 * liftK, max(1.0 - 2.5 * liftK, 0.0));
      float hq = uShade.y < 0.0 ? 0.0 : uShade.y >= 2.0 ? ${SHADE.hues + 2}.0 + floor((uShade.y - 2.0) * ${SHADE.flats}.0 + 0.5) : 1.0 + floor(uShade.y * ${SHADE.hues}.0 + 0.5);
      gHatch.rg = min(gHatch.rg, vec2(1.0)) + 2.0 * vec2(hq, floor(clamp(lift, 0.0, 1.0) * ${SHADE.lifts}.0 + 0.5));
    }
    #ifdef GRASS
      // blades: no hatching, no drawn detail; soft ink (post.js draws their edges as a darker green,
      // thin), r a pen line's share (a few tufts near by), g the outline's fade with distance
      gHatch.rgb = vec3(vGrassLook.x, vGrassLook.y, 0.0);
      gHatch.a += 8.0;
    #endif
    #ifdef MAKERS_BOX
      // a box with no edges: soft ink with a full pen line (post.js draws its outline only), no hatching
      gHatch.rgb = vec3(1.0, 0.0, 0.0);
      gHatch.a += 8.0;
    #endif
  }
`;

const cache = new Map();

/**
 * @param {object} o
 * @param {number|string} o.color
 * @param {number|string} [o.color2]
 * @param {number|string} [o.color3]
 * @param {number} [o.mode]
 * @param {boolean} [o.flat]
 * @param {number} [o.strataSize]
 * @param {boolean} [o.strataObject]  the bands fixed to the object, not the world (it moves)
 * @param {number} [o.grid] spacing of drawn grid lines (0 = none)
 * @param {boolean|number} [o.plates] the grid drawn as plating: rows of uneven plates, staggered joints, some left
 *                              out, each plate a shade apart (a number: the plate's size in metres, else the grid's)
 * @param {boolean} [o.drift]   ground banked against something (sand-drifts.js): +32 in gHatch.a, post.js draws
 *                              the line where it meets a wall softly
 * @param {boolean|number} [o.weathered] old walls: cracks from storeys' tops and feet and from window corners,
 *                              patches gone from the plaster (0..1; on for façades; never metal or the makers')
 * @param {number}  [o.shade]   0..1: this surface's shade lifted toward its lit colour (SHADE)
 * @param {number}  [o.shadeHue] 0..1: how much of its own hue its shade keeps (default: the world's, uShadeKeep)
 * @param {number}  [o.shadeFlat] 0..1: its shade printed flat in the world's shadow colour at its value (default:
 *                              the world's, uShadowFlat; a material saying it keeps the world's hue)
 * @param {number}  [o.spot]    0..1: how much of the world's spot blacks it takes (SPOT; default the world's)
 * @param {number}  [o.line]    its ink line's weight (LINE: 1 the world's ink … 0.25 a hairline; glass 0.45, leaves 0.7)
 * @param {number}  [o.lineTint] 0..1: its line drawn in a dark shade of its own colour instead of the ink (glass 0.7, leaves 0.67)
 * @param {number}  [o.hatch]   how many hatch strokes its shade gets (1 all, 0 none: a flat tone)
 * @param {number}  [o.strataHatch] strata rock: runs of strokes along its beds in the light (0..1)
 * @param {number}  [o.cracks]  strata rock: dense cracks and short strokes running down its faces, as the
 *                              desert's canyon sheets draw their walls (0..1; 0 the sparse fissures only)
 * @param {boolean} [o.form]    its shade's strokes follow the form of the parts that carry an axis (src/form.js
 *                              formAxis: a cap's radiate from it, a cylinder's wrap round it; FORM, S_FORM)
 * @param {number|boolean} [o.patches] colour across a wall: big flat patches of another tone (PATCH; 0..1.5; on
 *                              by default with built pen detail)
 * @param {number}  [o.veins]   with form: a dark cap's veins drawn lighter, radiating from its stalk (0..1)
 * @param {boolean|number} [o.glyphs] the makers' carved inscriptions (src/glyphs.js) on upright faces, in
 *                              cells of this many metres (true: the grid's spacing). For the makers' work only
 * @param {string}  [o.metal]   'painted' | 'steel' | 'chrome' | 'brass' | 'copper' | 'iron' (METALS): flat
 *                              reflection tones, a crisp highlight; o.color defaults to the metal's own
 * @param {boolean} [o.brushed] metal: brushed, streaks along o.brushAxis ('x' | 'y' | 'z', object space; 'y')
 * @param {number}  [o.refl]    metal: how much of the world it reflects (0..1, the kind's by default)
 * @param {number}  [o.highlight] metal: the sun highlight's size (rad)
 * @param {boolean} [o.grass]   grass blades placed round the camera (flora-grass.js; compiles the GRASS block)
 * @param {boolean} [o.biomes]  terrain: desert region palettes
 * @param {boolean} [o.sandInk] terrain: sparse contour strokes instead of dot fields
 * @param {boolean} [o.ripples] terrain: wind ripple marks
 * @param {boolean} [o.ticks]   terrain: inked grass ticks
 * @param {number}  [o.glow]    0..1 self-lit
 * @param {THREE.Side} [o.side]
 * @param {boolean} [o.figure]  part of a person: post.js draws its outline and inner ink by its size on screen
 * @param {number}  [o.faceKeys] how many face keys it reads (a MakeHuman body's shape keys: FACE_KEYS, src/makehuman/face-keys.js)
 * @param {boolean} [o.facePart] part of a face drawn as one stroke (the brows): flat, no surface hatching, the face flag
 * @param {object}  [o.eye]     MODE_EYE: the eyeballs (eyes.js eyeballOf: { center, radii }, iris: its radius on the unit eye)
 * @param {string}  [o.iris]    the traveller's portrait face: its iris colour (face.js)
 * @param {number}  [o.sway]    instanced plants: the tip moves this much (m) per metre² of height (the base stays put)
 * @param {number}  [o.swayH]   with sway: the geometry's height (its top), for the traveller's brush (brush.js)
 * @param {boolean} [o.swayLarge] with sway: a large plant (only its low leaves part as you brush past)
 * @param {boolean} [o.crowd]   instanced crowd figures: the vertex shader poses and colours each
 *                              instance from its attributes (crowd-shader.js); no other mode changes
 * @param {string}  [o.fluid]   'tank' | 'hose' | 'glob' | 'wing' | 'trail': the traveller's magical fluid (fluid-tool.js, fluid-kit.js).
 *                              Compiles the FLUID block (a lava-lamp albedo in flat tones) and adds
 *                              uFluidA / uFluidB / uFluidBox; materials without it are unchanged
 * @param {number[]} [o.fluidBox] [glass bottom y, top y, radius, highlight angle] in object space
 * @param {string[]} [o.fluidTones] the six tones (uFluidTones; the tool rewrites them as colours are added)
 * @param {string}  [o.fluidBase] the flask's own fluid colour (uFluidBase: green; the tool sets a gun mode's tone)
 * @param {object}  [o.makersBox] a makers' box's shell (src/boxes/model.js; compiles the MAKERS_BOX block): { half: [x, y, z]
 *                              (m, as drawn), center (m over its foot), mark, light (colours), ray, glow (0..1) }. The star and
 *                              the compasses painted on, a ray of light travelling across it (uBoxA.w its clock), outline-only ink
 * @param {boolean|string} [o.dissolve] compile the DISSOLVE block: uDissolve (amount, edge, bottom y, top y in
 *                              world space) eats the surface from the top down with a bright edge (o.dissolve: its colour)
 */
export function makeMaterial(o) {
  const key = JSON.stringify({ ...o, map: o.map?.uuid });
  if (cache.has(key)) return cache.get(key);
  const metal = o.metal ? METALS[o.metal] ?? METALS.steel : null;
  if (metal && o.color === undefined) o = { ...o, color: metal.color };
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    side: o.side ?? THREE.FrontSide,
    uniforms: {
      ...sharedUniforms,
      uColor: { value: new THREE.Color(o.color) },
      uColor2: { value: new THREE.Color(o.color2 ?? o.color) },
      uColor3: { value: new THREE.Color(o.color3 ?? o.color) },
      uMap: { value: o.map ?? null },
      uHasMap: { value: o.map ? 1 : 0 },
      uMode: { value: o.mode ?? MODE_PLAIN },
      uFlat: { value: o.flat ? 1 : 0 },
      uStrataSize: { value: o.strataSize ?? 4.0 },
      uCracks: { value: o.cracks ?? 0 },
      uPlates: { value: o.plates ? 1 : 0 },
      uWindows: { value: o.windows ?? 0.78 },
      uWeather: { value: weatheredOf(o) },
      uDetail: { value: new THREE.Vector2(...detailOf(o)) },
      uVeins: { value: formOf(o) ? o.veins ?? 0 : 0 },
      uPatch: { value: patchesOf(o) },
      uDrift: { value: o.drift ? 1 : 0 },
      uGrid: { value: o.grid ?? (typeof o.plates === 'number' ? o.plates : o.plates ? 3 : 0) },
      // the inscriptions' cell (m): a number, or the grid's spacing
      uGlyphs: { value: o.glyphs ? (typeof o.glyphs === 'number' ? o.glyphs : o.grid || 1.4) : 0 },
      uBiomes: { value: o.biomes ? 1 : 0 },
      uRipples: { value: o.ripples ? 1 : 0 },
      uSandInk: { value: o.sandInk ? 1 : 0 },
      uTicks: { value: o.ticks ? 1 : 0 },
      uGlow: { value: o.glow ?? 0 },
      uFolds: { value: o.folds ?? 0 },
      uScrub: { value: o.scrub ? 1 : 0 },
      uPattern: { value: { facade: 1, tiles: 2, leaves: 3, cracks: 4 }[o.pattern] ?? 0 },
      uSkin: { value: new THREE.Color(o.skin ?? '#e8c6a8') },
      uGlove: { value: o.gloves ? new THREE.Vector4(...new THREE.Color(o.gloves).toArray(), 1) : new THREE.Vector4(0, 0, 0, 0) },   // w = 1 means gloved: bare hands by default
      uHero: { value: 0 },
      uFigure: { value: o.figure || o.crowd || o.mode === MODE_OUTFIT ? 1 : 0 },
      uPortrait: { value: 0 },
      uExpression: { value: new THREE.Vector4() },
      uGaze: { value: new THREE.Vector2() },
      uIris: { value: new THREE.Color(o.iris ?? '#4f7896') },
      uEyeC: { value: new THREE.Vector4(...(o.eye?.center ?? [0.034, 1.7, 0.066]), o.eye?.iris ?? 0.44) },
      uEyeR: { value: new THREE.Vector4(...(o.eye?.radii ?? [0.015, 0.015, 0.015, 0.015])) },
      uEyeLook: { value: new THREE.Vector4(0, -Math.sin(EYE_TILT), Math.cos(EYE_TILT), 0) },
      uHeadBall: { value: new THREE.Vector4(...(o.headBall ?? [0, 0, 0, 0])) },
      uCreases: { value: o.creases ? 1 : 0 },
      uPalette: { value: Array.from({ length: 12 }, (_, i) => new THREE.Color(o.palette?.[i] ?? 0)) },
      uPaletteSize: { value: Math.min(o.palette?.length ?? 0, 12) },
      uLimbs: { value: o.creases ?? Array.from({ length: 16 }, () => new THREE.Vector3()) },
      uSuit: { value: o.suit ? 1 : 0 },
      uGlassCenter: { value: o.glassCenter ?? new THREE.Vector3() },
      uGlass: { value: o.glass ? 1 : 0 },
      uOutfit: { value: new THREE.Vector4(...(o.outfit ?? [0.13, 0.97, 1.47, 0.64])) },
      uTrim: { value: new THREE.Vector4(...(o.trim ?? [0, 0, 0, 0])) },
      uFace: { value: new THREE.Vector4(...(o.face ?? [1.7, 0.032, 1.657, 1.577]).filter((_, i) => i !== 3)) },
      uMood: { value: new THREE.Vector4(0, 0, 0, 0) },
      uMood2: { value: new THREE.Vector4(0, 1, 0, 0) },   // x brow tilt, y the side the nose line goes on (the shade's)
      uFaceKit: { value: new THREE.Vector4(1, 1, 0, 1) },
      uFaceKit2: { value: new THREE.Vector4(1, 1, 0, -0.03) },   // eye size, nose width, cheeks, the ears' z
      uShade: { value: new THREE.Vector4(...shadeOf(o)) },
      uSpotStep: { value: spotStep(o.spot ?? (o.glow > 0 || o.glass ? 0 : undefined)) },   // (a self-lit or glass surface never goes black)
      uLineStep: { value: lineStep(o) },   // (glass: a thin line in its own colour, unless it says)
    },
  });
  mat.vertexColors = !!o.vertexColors;
  mat.defaultAttributeValues = { ...mat.defaultAttributeValues, aFormC: [0, 0, 0, 0], aFormA: [0, 1, 0] };   // (a part with no axis: plain hatching)
  mat.defines = surfaceDefines(o);   // only the features this material uses are compiled
  if (o.crowd) mat.defines = { ...mat.defines, CROWD: 1 };
  if (o.facePart) mat.defines = { ...mat.defines, FACE_PART: 1 };
  // a MakeHuman body's face keys (src/makehuman/face-keys.js sets them before each draw)
  if (o.faceKeys > 0) {
    mat.defines = { ...mat.defines, FACE_KEYS: o.faceKeys };
    Object.assign(mat.uniforms, { uKeyTex: { value: null }, uKeyW: { value: new Array(o.faceKeys).fill(0) }, uKeyScale: { value: new THREE.Vector4(1, 1, 1, 0) }, uKeyWidth: { value: 1 } });
  }
  // strata bands in the object's own space, so they move with it (a moving or turning thing; mesas keep world bands)
  if (o.strataObject) mat.defines = { ...mat.defines, STRATA_OBJECT: 1 };
  if (o.sway) {
    mat.defines = { ...mat.defines, SWAY: 1 };
    mat.uniforms.uSway = { value: o.sway };
    mat.uniforms.uSwayPlant = { value: new THREE.Vector2(o.swayH ?? 1, o.swayLarge ? 1 : 0) };   // (the brush's profile)
  }
  if (metal) {
    mat.defines = { ...mat.defines, METAL: 1 };
    mat.uniforms.uMetal = { value: new THREE.Vector4(metal.kind, o.brushed ? 1 : 0, o.refl ?? metal.refl, o.highlight ?? metal.hl) };
    mat.uniforms.uBrushAxis = { value: new THREE.Vector3(...(BRUSH_AXES[o.brushAxis] ?? BRUSH_AXES.y)) };
  }
  if (o.grass) {
    mat.defines = { ...mat.defines, GRASS: 1 };
    Object.assign(mat.uniforms, grassUniforms());
  }
  if (o.fluid) {
    mat.defines = { ...mat.defines, FLUID: 1 };
    mat.uniforms.uFluidA = { value: new THREE.Vector4(1, 2, 0, { tank: 0, hose: 1, glob: 2, wing: 3, trail: 4 }[o.fluid] ?? 0) };
    mat.uniforms.uFluidB = { value: new THREE.Vector4() };
    mat.uniforms.uFluidBox = { value: new THREE.Vector4(...(o.fluidBox ?? [-1, 1, 1, 0])) };
    mat.uniforms.uFluidTones = { value: Array.from({ length: 6 }, (_, i) => new THREE.Color(o.fluidTones?.[i] ?? '#ffffff')) };
    mat.uniforms.uFluidBase = { value: new THREE.Color(o.fluidBase ?? '#5fb86a') };
  }
  if (o.mode === MODE_WATER) waterMaterial(mat, o);   // the water's own look (water-shader.js)
  if (o.makersBox) {
    const B = o.makersBox;
    mat.defines = { ...mat.defines, MAKERS_BOX: 1 };
    mat.uniforms.uBoxA = { value: new THREE.Vector4(B.ray ?? 0.6, B.glow ?? 0.35, 0, 0) };
    mat.uniforms.uBoxB = { value: new THREE.Vector4(...(B.half ?? [0.5, 0.5, 0.5]), B.center ?? 0.5) };
    mat.uniforms.uBoxMark = { value: new THREE.Color(B.mark ?? '#dcecf2') };
    mat.uniforms.uBoxLight = { value: new THREE.Color(B.light ?? '#fffbea') };
  }
  if (o.dissolve) {
    mat.defines = { ...mat.defines, DISSOLVE: 1 };
    mat.uniforms.uDissolve = { value: new THREE.Vector4(0, 0.08, 0, 1) };
    mat.uniforms.uDissolveColor = { value: new THREE.Color(o.dissolve === true ? '#fff4d6' : o.dissolve) };
  }
  cache.set(key, mat);
  return mat;
}


/** Tag only the player's materials, preserving live shared shader uniforms. */
export function markHero(root, copies = new Map()) {
  root?.traverse((o) => {
    if (!o.isMesh) return;
    const tagged = (material) => {
      if (!material.uniforms?.uHero) return material;
      if (!copies.has(material)) {
        const copy = material.clone();
        Object.assign(copy.uniforms, sharedUniforms);
        copy.uniforms.uHero.value = 1;
        if (material.uniforms.uPortrait.value) {
          for (const key of ['uPortrait', 'uExpression', 'uGaze', 'uIris']) copy.uniforms[key] = material.uniforms[key];
        }
        copies.set(material, copy);
      }
      return copies.get(material);
    };
    o.material = Array.isArray(o.material) ? o.material.map(tagged) : tagged(o.material);
  });
  return copies;
}
