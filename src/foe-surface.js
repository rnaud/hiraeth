import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Painted surfaces for the enemy roster (docs/systems/foes.md, "Procedural surfaces"): the patterns the design
// sheets paint on a creature (lichen stars, specks and mottling, scales and plates, segment bands, rust and
// verdigris, wood grain, a belly of another colour, a tip fading to another, ink drips, a glossy highlight, a glow
// from inside) drawn by the surface shader itself (materials.js, the FOE_SURFACE block) from a few numbers per
// material: no texture, no UVs, no extra draw. A material made with `foeSurface: { … }` compiles only the features
// it names (FS_* defines, as the S_* ones); src/enemies/surfaces.js says which each skin's parts wear.
//
// Every pattern is anchored to the part (vObjPos: object space with the scale baked in, so metres): it moves with
// the body and keeps its size on a big skin. 3D patterns (spots, stars, rings, noise) need no projection at all;
// the 2D ones (scales, plates) are triplanar on the object's normal, one projection on the handheld (uWearLite).
// Each fades to its mean colour once its cells are a few pixels on screen (no shimmer far off), and the colour
// steps are the post pass's to ink: a sharp edge (soft 0) draws a pen line round a spot, a soft one doesn't.
//
// Features (each { color, amount, … }; colours are sRGB strings; sizes in metres of the part):
//   fade     a colour coming in along an axis of the part (the crab's apricot claw tips): axis 0 x, 1 y, 2 z,
//            from → to (m), amount
//   belly    the underside (its normal turned down: object space, or world: true) another colour, with seams
//            across it every `seams` m (inked: ink 0..1), edge (normal y where it starts), soft
//   mottle   blotches of another colour, two octaves of noise: scale, amount (share covered), soft, detail
//   rust     two-tone patches (rust, color2 verdigris), denser low on the part (down 0..1): scale, amount,
//            amount2, pits (dark specks in them)
//   grain    wood grain: lines along the part's y axis, warped by noise: spacing, ink, warp, amount
//   bands    rings across an axis (segment bands; axis 3: round the y axis, as a dome's rings; axis 4: lines out from
//            the y axis, by angle, a unit half a radian: a bulb's ribs, a cap's gills): period, width
//            (share), ink (a pen line at each edge), offset
//   stripes  the same again (painted stripes over bands)
//   scales   scales (mode 0), staggered plates (1): size, ink (the outline), tone (each one's own shade), edge
//            (its lower edge darker, in color)
//   spots    round spots on the part: scale (the cell), share (of cells with one), size (of the cell, 0..1),
//            jitter, star (0 round … 1 a six-pointed lichen star), ring (0 filled … a ring's width share), soft
//            cluster: m (0 off): the spots gather in patches that size (a noise over the cells), clusterShare the
//            share of the part the patches cover (barnacle crusts, lichen colonies)
//   spots2   a second layer (specks over stars, eye-spots over mottling)
//   rivets   rows of round rivet heads ringed round an axis (axis 0 x, 1 y, 2 z): a row every `period` m along it
//            (offset in periods), `count` heads round each row, `size` m across; a pen line round each (ink) and a
//            lit top (shine)
//   drips    runs of another colour down the part from y `from` (m), `length` long, `width` m apart, with a bulb
//   glow     translucent: a light inside, brightest where you look straight through (core: its falloff), a
//            rim; or a lantern at `center` (object space) of `radius`; pulse (rad/s); emit (how far it blooms)
//   gloss    a crisp highlight (the blot's wet ink, enamel): the sun's and the sky's, size (of the sphere), sky
//            (the share from the sky, so it shows in shade too); streaks (0 off): the highlight broken into that many
//            curving strokes round the part's y axis (wet ink's streaked shine), streakWidth their share
//   cracks   a hull cracked like a dropped jar (the furnace brute's): a fine net of seams between cells `scale` m across
//            (3D Voronoi: the pen-thin `width` of the cell's size, in `ink`, each cell its own shade `tone`: glass
//            facets too), and over it a wider net of veins (`veins` m cells, `vein` width) glowing `color` (emit
//            `glow`); `open` (0..1, a uniform the body sets as it is hurt: Foe hp) widens the veins and brightens them
// Cost: per pixel of a foe only, each feature a handful of hashes (spots: 8 cells; noise: 8 a octave; scales: 1
// or 3 projections); a whole pack is a few thousand pixels. Nothing is drawn twice and nothing is downloaded.
// ---------------------------------------------------------------------------

export const FOE_SURFACE_FEATURES = ['fade', 'belly', 'mottle', 'rust', 'grain', 'bands', 'stripes', 'scales', 'spots', 'spots2', 'rivets', 'drips', 'cracks', 'glow', 'gloss'];
/** The fade-out: a pattern's cells under this many pixels go to its mean colour (from `far[1]` to `far[0]` px). */
export const FOE_SURFACE = { far: [2.5, 6] };

const DEFAULTS = {
  fade: { color: '#e9a07a', amount: 1, axis: 2, from: 0, to: 0.3 },
  belly: { color: '#efe1c3', amount: 1, edge: -0.15, soft: 0.2, seams: 0, ink: 0.5, world: false },
  mottle: { color: '#000000', amount: 0.4, scale: 0.25, soft: 0.12, detail: 0.35, strength: 1 },
  rust: { color: '#b0583a', color2: '#5fa59a', amount: 0.3, amount2: 0.15, scale: 0.2, down: 0.5, pits: 0.4 },
  grain: { color: '#8a7a64', amount: 0.5, spacing: 0.05, ink: 0.5, warp: 0.6 },
  bands: { color: '#000000', amount: 1, axis: 1, period: 0.2, width: 0.3, ink: 0, offset: 0 },
  stripes: { color: '#000000', amount: 1, axis: 1, period: 0.2, width: 0.3, ink: 0, offset: 0 },
  scales: { color: '#000000', amount: 0.3, size: 0.06, ink: 0.4, tone: 0.08, mode: 0 },
  spots: { color: '#ffffff', amount: 1, scale: 0.12, share: 0.6, size: 0.7, jitter: 1, star: 0, ring: 0, soft: 0, cluster: 0, clusterShare: 0.4 },
  spots2: { color: '#000000', amount: 1, scale: 0.05, share: 0.4, size: 0.4, jitter: 1, star: 0, ring: 0, soft: 0, cluster: 0, clusterShare: 0.4 },
  rivets: { color: '#d8d2c0', amount: 1, axis: 2, period: 0.2, offset: 0, count: 12, size: 0.04, ink: 0.6, shine: 0.3 },
  drips: { color: '#000000', amount: 1, width: 0.12, from: 0, length: 0.3, bulb: 0.4 },
  cracks: { color: '#b07aff', amount: 1, ink: '#2a2235', inkAmount: 0.8, scale: 0.09, width: 0.06, tone: 0.06, veins: 0.42, vein: 0.07, glow: 0.8, open: 0 },
  glow: { color: '#ffd27a', amount: 0.6, rim: 0.3, core: 2, pulse: 0, emit: 0.6, center: null, radius: 0 },
  gloss: { color: '#ffffff', amount: 1, size: 0.06, sky: 0.5, sharp: 1, streaks: 0, streakWidth: 0.35 },
};
const col = (c) => new THREE.Color(c ?? '#000000');
const v4 = (...a) => new THREE.Vector4(...a.map((x) => +x || 0));
const cv = (c, a) => { const k = col(c); return v4(k.r, k.g, k.b, a); };

/** A surface's features with their defaults filled in (unknown ones dropped). */
export function foeSurfaceOf(fs = {}) {
  const out = {};
  for (const k of FOE_SURFACE_FEATURES) if (fs[k]) out[k] = { ...DEFAULTS[k], ...(fs[k] === true ? {} : fs[k]) };
  return out;
}

/** The defines a foe surface compiles: FOE_SURFACE and one FS_* per feature it uses. */
export function foeSurfaceDefines(fs) {
  const d = { FOE_SURFACE: 1 };
  for (const k of Object.keys(foeSurfaceOf(fs))) d[`FS_${k.toUpperCase()}`] = 1;
  return d;
}

/** Turn a fresh makeMaterial() material into a painted foe surface (o.foeSurface). */
export function foeSurfaceMaterial(mat, o) {
  const f = foeSurfaceOf(o.foeSurface);
  mat.defines = { ...mat.defines, ...foeSurfaceDefines(o.foeSurface) };
  const U = mat.uniforms, layer = (name, s) => {   // (bands and stripes, spots and spots2: one layout each)
    if (name === 'bands' || name === 'stripes') { U[`uFs_${name}C`] = { value: cv(s.color, s.amount) }; U[`uFs_${name}`] = { value: v4(s.axis, s.period, s.width, s.ink) }; U[`uFs_${name}O`] = { value: s.offset }; }
    else { U[`uFs_${name}C`] = { value: cv(s.color, s.amount) }; U[`uFs_${name}`] = { value: v4(s.scale, s.share, s.size, s.jitter) }; U[`uFs_${name}S`] = { value: v4(s.star, s.ring, s.soft, name === 'spots' ? 7.1 : 31.7) }; U[`uFs_${name}K`] = { value: new THREE.Vector2(+s.cluster || 0, +s.clusterShare || 0) }; }
  };
  if (f.fade) { U.uFsFadeC = { value: cv(f.fade.color, f.fade.amount) }; U.uFsFade = { value: v4(f.fade.axis, f.fade.from, f.fade.to, 0) }; }
  if (f.belly) { U.uFsBellyC = { value: cv(f.belly.color, f.belly.amount) }; U.uFsBelly = { value: v4(f.belly.edge, f.belly.soft, f.belly.seams, f.belly.ink) }; U.uFsBellyW = { value: f.belly.world ? 1 : 0 }; }
  if (f.mottle) { U.uFsMottleC = { value: cv(f.mottle.color, f.mottle.strength) }; U.uFsMottle = { value: v4(f.mottle.scale, f.mottle.amount, f.mottle.soft, f.mottle.detail) }; }
  if (f.rust) { U.uFsRustC = { value: cv(f.rust.color, f.rust.amount) }; U.uFsRustC2 = { value: cv(f.rust.color2, f.rust.amount2) }; U.uFsRust = { value: v4(f.rust.scale, f.rust.down, f.rust.pits, 0) }; }
  if (f.grain) { U.uFsGrainC = { value: cv(f.grain.color, f.grain.amount) }; U.uFsGrain = { value: v4(f.grain.spacing, f.grain.ink, f.grain.warp, 0) }; }
  if (f.bands) layer('bands', f.bands);
  if (f.stripes) layer('stripes', f.stripes);
  if (f.scales) { U.uFsScalesC = { value: cv(f.scales.color, f.scales.amount) }; U.uFsScales = { value: v4(f.scales.size, f.scales.ink, f.scales.tone, f.scales.mode) }; }
  if (f.spots) layer('spots', f.spots);
  if (f.spots2) layer('spots2', f.spots2);
  if (f.rivets) { const r = f.rivets; U.uFsRivetsC = { value: cv(r.color, r.amount) }; U.uFsRivets = { value: v4(r.axis, r.period, r.offset, r.count) }; U.uFsRivetsS = { value: v4(r.size, r.ink, r.shine, 0) }; }
  if (f.drips) { U.uFsDripsC = { value: cv(f.drips.color, f.drips.amount) }; U.uFsDrips = { value: v4(f.drips.width, f.drips.from, f.drips.length, f.drips.bulb) }; }
  if (f.cracks) {
    const c = f.cracks;
    U.uFsCracksC = { value: cv(c.color, c.amount) }; U.uFsCracksI = { value: cv(c.ink, c.inkAmount) };
    U.uFsCracks = { value: v4(c.scale, c.width, c.tone, c.glow) }; U.uFsCracksV = { value: v4(c.veins, c.vein, 0, 0) };
    U.uFsCracksO = { value: c.open };
  }
  if (f.glow) {
    U.uFsGlowC = { value: cv(f.glow.color, f.glow.amount) };
    U.uFsGlow = { value: v4(f.glow.rim, f.glow.core, f.glow.pulse, f.glow.emit) };
    U.uFsGlowP = { value: v4(...(f.glow.center ?? [0, 0, 0]), f.glow.center ? f.glow.radius || 0.3 : 0) };
  }
  if (f.gloss) { U.uFsGlossC = { value: cv(f.gloss.color, f.gloss.amount) }; U.uFsGloss = { value: v4(f.gloss.size, f.gloss.sky, f.gloss.sharp, f.gloss.streaks) }; U.uFsGlossW = { value: f.gloss.streakWidth }; }
  return mat;
}

// The shader: declared in the surface's fragment (materials.js) inside FOE_SURFACE; foeSurface() runs in the albedo
// stage (after the material's own colour), foeGloss() once the light term is known.
export const FOE_SURFACE_GLSL = /* glsl */ `
#ifdef FOE_SURFACE
  // four random numbers for a cell (pcg4d, Jarzynski & Olano 2020, on the float's bits: no structure between
  // neighbouring cells, which a fract-of-product hash has at small coordinates, clumping the spots)
  vec4 fsHash4(vec3 p) {
    uvec4 v = uvec4(floatBitsToUint(p + 0.0), 0x9e3779b9u) * 1664525u + 1013904223u;
    v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
    v ^= v >> 16u;
    v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
    return vec4(v >> 8u) * (1.0 / 16777216.0);
  }
  float fsNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = fsHash4(i).x, b = fsHash4(i + vec3(1.0, 0.0, 0.0)).x, c = fsHash4(i + vec3(0.0, 1.0, 0.0)).x, d = fsHash4(i + vec3(1.0, 1.0, 0.0)).x;
    float e = fsHash4(i + vec3(0.0, 0.0, 1.0)).x, g = fsHash4(i + vec3(1.0, 0.0, 1.0)).x, h = fsHash4(i + vec3(0.0, 1.0, 1.0)).x, k = fsHash4(i + vec3(1.0, 1.0, 1.0)).x;
    return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
  }
  // how much of a pattern of cells this many metres across still shows (1 near, 0 once a cell is a few pixels)
  float fsNear(float cell, float px) { return 1.0 - smoothstep(${(1 / FOE_SURFACE.far[1]).toFixed(4)}, ${(1 / FOE_SURFACE.far[0]).toFixed(4)}, px / max(cell, 1e-4)); }
  float fsAxis(vec3 p, float a) { return a < 0.5 ? p.x : a < 1.5 ? p.y : a < 2.5 ? p.z : a < 3.5 ? length(p.xz) : atan(p.z, p.x) * 0.5; }   // (4: the angle round y, half a radian a unit: ribs, gills)
  // a band across an axis: x its coverage (0..1, soft over aa), y the ink at its edges
  vec2 fsBand(vec3 p, vec4 b, float off, float px) {
    float u = fsAxis(p, b.x) / max(b.y, 1e-4) + off, f = fract(u);
    float aa = px / max(b.y, 1e-4);
    float w = clamp(b.z, 0.0, 1.0);
    float cov = smoothstep(0.0, aa, f) * (1.0 - smoothstep(w - aa, w, f));
    float e = min(min(f, 1.0 - f), abs(f - w)) / max(aa, 1e-5);   // (pixels to the nearest edge)
    float near = fsNear(b.y, px);
    return vec2(mix(w, cov, near), b.w * inkLine(e, 1.0) * near);
  }
  // round spots on the part (3D: no seam, no projection): the 8 cells round the point, each with a spot or not
  float fsSpots(vec3 p, vec3 nO, vec4 s, vec4 t, vec2 k2, float px) {
    vec3 q = p / max(s.x, 1e-4), b = floor(q - 0.5);
    float aa = max(px / max(s.x, 1e-4), t.z * 0.25);
    float cov = 0.0;
    vec3 t1 = normalize(abs(nO.y) < 0.9 ? cross(nO, vec3(0.0, 1.0, 0.0)) : cross(nO, vec3(1.0, 0.0, 0.0))), t2 = cross(nO, t1);
    for (int i = 0; i < 8; i++) {
      vec3 c = b + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
      vec4 h = fsHash4(c + t.w);
      if (h.x > s.y) continue;
      // (clustered: only the cells inside a patch of the noise, k2.x m across, covering k2.y of the part; the same
      // patches for both layers, so the specks crowd round the rosettes)
      if (k2.x > 0.0 && fsNoise((c + 0.5) * s.x / k2.x + 3.3) < 1.0 - k2.y) continue;
      // (a spot is at most half a cell across with its jitter: size 1 a quarter-cell radius, jittered; up to 2, still)
      float rMax = clamp(s.z, 0.0, 2.0) * 0.25;
      vec3 v = q - (c + 0.5 + (h.yzw - 0.5) * 2.0 * min(0.25 * s.w, 0.5 - rMax));
      float r = rMax * (0.65 + 0.35 * h.y);
      // (on the surface: the spot's centre seen along the normal, so every cell the surface crosses shows its spot,
      // not only the few whose centre the surface happens to pass near)
      float vn = dot(v, nO);
      if (abs(vn) > 0.5) continue;
      v -= vn * nO;
      if (t.x > 0.0) { float a = atan(dot(v, t2), dot(v, t1)); r *= 1.0 - t.x * 0.62 * (0.5 - 0.5 * cos(6.0 * a + h.z * 6.283)); }
      float d = length(v);
      float k = 1.0 - smoothstep(r - aa, r + aa, d);
      if (t.y > 0.0) k *= smoothstep(r * (1.0 - t.y) - aa, r * (1.0 - t.y) + aa, d);
      cov = max(cov, k);
    }
    float mean = s.y * (t.y > 0.0 ? 0.1 : 0.2) * s.z * s.z * (1.0 - t.x * 0.5) * (k2.x > 0.0 ? k2.y : 1.0);   // (the share a far patch is covered)
    return mix(mean, cov, fsNear(s.x * s.z * 0.5, px));
  }
  // scales (mode 0) or staggered plates (1) on one plane: x the scale's own tone (-1..1), y its edge (0 at the line),
  // z the lower-edge shade (0..1)
  vec3 fsScales2(vec2 q, float mode) {
    float row = floor(q.y), off = 0.5 * mod(row, 2.0);
    vec2 cell = vec2(floor(q.x + off), row), f = vec2(fract(q.x + off), fract(q.y));
    float tone = fsHash4(vec3(cell, 3.7)).x * 2.0 - 1.0;
    if (mode < 0.5) {
      float x = 2.0 * f.x - 1.0, yb = 0.5 - 0.5 * sqrt(max(0.0, 1.0 - x * x));
      return vec3(tone, abs(f.y - yb), 1.0 - smoothstep(0.0, 0.45, f.y - yb));
    }
    float e = min(min(f.x, 1.0 - f.x) * 1.6, min(f.y, 1.0 - f.y));
    return vec3(tone, e, 1.0 - smoothstep(0.0, 0.3, f.y));
  }

  float foeSurface(inout vec3 albedo, inout float emit, vec3 n) {
    vec3 p = vObjPos;
    vec3 nO = normalize(vObjNormal);
    float px = max(length(dFdx(vObjPos)), length(dFdy(vObjPos)));   // metres a pixel (uniform flow: here, first)
    float ink = 0.0;
    float lite = uWearLite;
    #ifdef FS_FADE
    {
      float u = fsAxis(p, uFsFade.x);
      albedo = mix(albedo, uFsFadeC.rgb, uFsFadeC.a * smoothstep(uFsFade.y, uFsFade.z, u));
    }
    #endif
    #ifdef FS_BELLY
    {
      float ny = uFsBellyW > 0.5 ? n.y : nO.y;
      float k = 1.0 - smoothstep(uFsBelly.x - uFsBelly.y, uFsBelly.x + uFsBelly.y, ny);
      albedo = mix(albedo, uFsBellyC.rgb, uFsBellyC.a * k);
      if (uFsBelly.z > 0.0) ink = max(ink, fsBand(p, vec4(2.0, uFsBelly.z, 0.0, uFsBelly.w), 0.0, px).y * step(0.5, k));
    }
    #endif
    #ifdef FS_MOTTLE
    {
      vec3 q = p / max(uFsMottle.x, 1e-4);
      float v = fsNoise(q);
      if (lite < 0.5 && uFsMottle.w > 0.0) v = mix(v, fsNoise(q * 2.7 + 5.3), uFsMottle.w);
      float th = mix(0.78, 0.22, clamp(uFsMottle.y, 0.0, 1.0));
      float k = smoothstep(th - uFsMottle.z, th + uFsMottle.z, v);
      k = mix(uFsMottle.y, k, fsNear(uFsMottle.x * 0.6, px));
      albedo = mix(albedo, uFsMottleC.rgb, k * uFsMottleC.a);
    }
    #endif
    #ifdef FS_RUST
    {
      vec3 q = p / max(uFsRust.x, 1e-4);
      float low = clamp(0.5 - nO.y * 0.5, 0.0, 1.0) * uFsRust.y;
      float v = fsNoise(q) * 0.7 + fsNoise(q * 3.1 + 9.1) * 0.3 + low * 0.35;
      float near = fsNear(uFsRust.x * 0.5, px);
      float r = mix(uFsRustC.a, smoothstep(1.0 - uFsRustC.a - 0.04, 1.0 - uFsRustC.a + 0.04, v), near);
      float g = mix(uFsRustC2.a, smoothstep(1.0 - uFsRustC2.a - 0.04, 1.0 - uFsRustC2.a + 0.04, fsNoise(q * 1.3 + 17.0) + low * 0.25), near);
      albedo = mix(albedo, uFsRustC2.rgb, g);
      albedo = mix(albedo, uFsRustC.rgb, r);
      if (uFsRust.z > 0.0) albedo *= 1.0 - 0.45 * r * uFsRust.z * step(0.82, fsNoise(q * 9.0)) * near;   // (pits)
    }
    #endif
    #ifdef FS_GRAIN
    {
      float w = fsNoise(p * vec3(6.0, 0.8, 6.0) / max(uFsGrain.x * 8.0, 1e-3)) * uFsGrain.z * 4.0;
      float u = (p.x * 0.8 + p.z * 0.6) / max(uFsGrain.x, 1e-4) + w;
      float f = fract(u), e = min(f, 1.0 - f) * uFsGrain.x / max(px, 1e-6);
      float near = fsNear(uFsGrain.x, px);
      albedo = mix(albedo, uFsGrainC.rgb, uFsGrainC.a * mix(0.5, smoothstep(0.2, 0.8, abs(f - 0.5) * 2.0), near));
      ink = max(ink, uFsGrain.y * inkLine(e, 1.0) * near * step(0.45, fsNoise(p * vec3(2.0, 0.35, 2.0) / max(uFsGrain.x * 4.0, 1e-3))));
    }
    #endif
    #ifdef FS_BANDS
    {
      vec2 b = fsBand(p, uFs_bands, uFs_bandsO, px);
      albedo = mix(albedo, uFs_bandsC.rgb, uFs_bandsC.a * b.x);
      ink = max(ink, b.y);
    }
    #endif
    #ifdef FS_STRIPES
    {
      vec2 b = fsBand(p, uFs_stripes, uFs_stripesO, px);
      albedo = mix(albedo, uFs_stripesC.rgb, uFs_stripesC.a * b.x);
      ink = max(ink, b.y);
    }
    #endif
    #ifdef FS_SCALES
    {
      vec3 w = pow(abs(nO), vec3(4.0)); w /= w.x + w.y + w.z;
      if (lite > 0.5) w = w.x > w.y && w.x > w.z ? vec3(1.0, 0.0, 0.0) : (w.y > w.z ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
      vec3 q = p / max(uFsScales.x, 1e-4);
      vec3 acc = vec3(0.0);
      if (w.x > 0.02) acc += fsScales2(q.zy, uFsScales.w) * w.x;
      if (w.y > 0.02) acc += fsScales2(q.xz, uFsScales.w) * w.y;
      if (w.z > 0.02) acc += fsScales2(q.xy, uFsScales.w) * w.z;
      float near = fsNear(uFsScales.x, px);
      albedo *= 1.0 + uFsScales.z * acc.x * near;
      albedo = mix(albedo, uFsScalesC.rgb, uFsScalesC.a * acc.z * near);
      ink = max(ink, uFsScales.y * inkLine(acc.y * uFsScales.x / max(px, 1e-6), 1.0) * near);
    }
    #endif
    #ifdef FS_SPOTS
    albedo = mix(albedo, uFs_spotsC.rgb, uFs_spotsC.a * fsSpots(p, nO, uFs_spots, uFs_spotsS, uFs_spotsK, px));
    #endif
    #ifdef FS_SPOTS2
    if (lite < 0.5 || uFs_spots2.x > 0.08) albedo = mix(albedo, uFs_spots2C.rgb, uFs_spots2C.a * fsSpots(p, nO, uFs_spots2, uFs_spots2S, uFs_spots2K, px));
    #endif
    #ifdef FS_RIVETS
    {
      // (the nearest head: its row along the axis, its place round the row; distances in metres on the part)
      float ax = uFsRivets.x;
      vec3 q = ax < 0.5 ? p.yzx : ax < 1.5 ? p.zxy : p;   // (q.z along the axis, q.xy round it)
      float u = q.z / max(uFsRivets.y, 1e-4) - uFsRivets.z, dz = (fract(u + 0.5) - 0.5) * uFsRivets.y;
      float rad = length(q.xy), cnt = max(uFsRivets.w, 1.0), w = atan(q.y, q.x) / 6.2832 * cnt;
      float da = (fract(w + 0.5) - 0.5) * 6.2832 * rad / cnt;
      float d = length(vec2(dz, da)), r = uFsRivetsS.x * 0.5, aa = px;
      float near = fsNear(uFsRivetsS.x * 2.0, px);
      float head = 1.0 - smoothstep(r - aa, r + aa, d);
      albedo = mix(albedo, uFsRivetsC.rgb * (1.0 + uFsRivetsS.z * clamp(nO.y + 0.3, 0.0, 1.0)), uFsRivetsC.a * mix(0.0, head, near));
      ink = max(ink, uFsRivetsS.y * inkLine(abs(d - r) / max(px, 1e-6), 1.0) * near);
    }
    #endif
    #ifdef FS_DRIPS
    {
      float ang = atan(p.z, p.x), rad = length(p.xz);
      float cols = max(floor(6.283 * max(rad, 0.05) / max(uFsDrips.x, 1e-3)), 3.0);
      float u = ang / 6.283 * cols, c = floor(u), fx = fract(u) - 0.5;
      vec4 h = fsHash4(vec3(c, 1.3, 7.7));
      float len = uFsDrips.z * (0.35 + 0.65 * h.x);
      float y = uFsDrips.y - p.y;                     // (how far below the drips' start)
      float wide = 0.18 + 0.12 * h.y, end = len - wide * uFsDrips.x;
      float aa = px / max(uFsDrips.x, 1e-4);
      float body = (1.0 - smoothstep(wide - aa, wide + aa, abs(fx))) * step(0.0, y) * (1.0 - step(end, y));
      float bulb = 1.0 - smoothstep(wide * (1.0 + uFsDrips.w) - aa, wide * (1.0 + uFsDrips.w) + aa, length(vec2(fx, (y - end) / max(uFsDrips.x, 1e-4))));
      float k = max(body, bulb * step(0.0, y)) * step(0.3, h.z);
      albedo = mix(albedo, uFsDripsC.rgb, uFsDripsC.a * k * fsNear(uFsDrips.x, px));
    }
    #endif
    #ifdef FS_CRACKS
    {
      // (3D Voronoi over the 8 cells round the point, as the spots: the nearest two sites, the seam where they tie)
      float aaF = px / max(uFsCracks.x, 1e-4), aaV = px / max(uFsCracksV.x, 1e-4);
      for (int layer = 0; layer < 2; layer++) {
        float sc = layer == 0 ? uFsCracks.x : uFsCracksV.x;
        if (lite > 0.5 && layer == 0 && sc < 0.08) continue;   // (the handheld: the fine net only where it reads)
        vec3 q = p / max(sc, 1e-4) + float(layer) * 17.3, b = floor(q - 0.5), c1 = vec3(0.0);
        float d1 = 9.0, d2 = 9.0;
        for (int i = 0; i < 8; i++) {
          vec3 c = b + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
          vec3 o = c + 0.5 + (fsHash4(c + 13.1).xyz - 0.5) * 0.7;
          float d = length(q - o);
          if (d < d1) { d2 = d1; d1 = d; c1 = c; } else if (d < d2) d2 = d;
        }
        float e = d2 - d1;
        if (layer == 0) {
          float near = fsNear(uFsCracks.x * 0.5, px), w = uFsCracks.y;
          float seam = 1.0 - smoothstep(w - aaF, w + aaF, e);
          albedo *= 1.0 + (fsHash4(c1 + 5.7).x * 2.0 - 1.0) * uFsCracks.z * near;
          albedo = mix(albedo, uFsCracksI.rgb, uFsCracksI.a * mix(w, seam, near));
        } else {
          float near = fsNear(uFsCracksV.x * 0.4, px), w = uFsCracksV.y * (1.0 + 1.6 * uFsCracksO);
          float tar = 1.0 - smoothstep(w - aaV, w + aaV, e), core = 1.0 - smoothstep(w * 0.5 - aaV, w * 0.5 + aaV, e);
          albedo = mix(albedo, uFsCracksI.rgb, uFsCracksI.a * mix(w * 0.5, tar, near));
          float gl = mix(w * 0.3, core, near) * (0.55 + 0.45 * uFsCracksO);
          albedo = mix(albedo, uFsCracksC.rgb, uFsCracksC.a * gl);
          emit = max(emit, gl * uFsCracks.w);
        }
      }
    }
    #endif
    #ifdef FS_GLOW
    {
      vec3 Vw = normalize(cameraPosition - vWorldPos);
      float facing = abs(dot(n, Vw));
      float pulse = uFsGlow.z > 0.0 ? 0.82 + 0.18 * sin(uTime * uFsGlow.z + dot(vWorldPos, vec3(0.7, 0.3, 0.5))) : 1.0;
      float core = pow(facing, max(uFsGlow.y, 0.1));
      if (uFsGlowP.w > 0.0) core *= 1.0 - smoothstep(0.0, uFsGlowP.w, length(p - uFsGlowP.xyz));
      float rim = pow(1.0 - facing, 2.0) * uFsGlow.x;
      float k = clamp(core * uFsGlowC.a * pulse, 0.0, 1.0);
      albedo = mix(albedo, uFsGlowC.rgb, k);
      albedo = mix(albedo, mix(uFsGlowC.rgb, vec3(1.0), 0.4), clamp(rim, 0.0, 1.0) * 0.6);
      emit = max(emit, k * uFsGlow.w);
    }
    #endif
    return ink;
  }

  // the gloss: once the light is known, a crisp highlight where the sun (and the sky above you) mirrors in it
  void foeGloss(inout vec3 albedo, inout float L, vec3 n) {
    #ifdef FS_GLOSS
    vec3 Vw = normalize(cameraPosition - vWorldPos);
    // (the smooth normal, not a flat facet's: a faceted body's highlight is a crisp spot, not a whole lit facet)
    vec3 ns = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 R = reflect(-Vw, ns);
    float sun = dot(R, normalize(uSunDir)), sky = dot(R, normalize(vec3(0.0, 1.0, 0.0) + Vw * 0.35));
    float fs = fwidth(sun) + 1e-4, fk = fwidth(sky) + 1e-4;
    float th = 1.0 - uFsGloss.x;
    float aaS = mix(fs * 4.0, fs, clamp(uFsGloss.z, 0.0, 1.0)), aaK = mix(fk * 4.0, fk, clamp(uFsGloss.z, 0.0, 1.0));
    float hl = max(smoothstep(th - aaS, th + aaS, sun) * step(0.0, uSunDir.y), smoothstep(th - aaK, th + aaK, sky) * uFsGloss.y);
    if (uFsGloss.w > 0.0) {
      // (streaks: strokes round the y axis, wavering as they run down, the highlight only where one passes)
      float u = atan(vObjPos.z, vObjPos.x) / 6.2832 * uFsGloss.w + sin(vObjPos.y * 9.0) * 0.18 + fsNoise(vObjPos * 6.0) * 0.3;
      float d = abs(fract(u) - 0.5) * 2.0, aa = fwidth(u) * 2.0 + 1e-4;
      hl *= 1.0 - smoothstep(uFsGlossW - aa, uFsGlossW + aa, d);
    }
    hl *= uFsGlossC.a;
    albedo = mix(albedo, uFsGlossC.rgb, hl);
    L = mix(L, 1.0, hl);
    #endif
  }
#endif
`;

/** The uniforms each feature reads (declared before FOE_SURFACE_GLSL in the surface's fragment). */
export const FOE_SURFACE_PARS = /* glsl */ `
#ifdef FOE_SURFACE
  #ifdef FS_FADE
  uniform vec4 uFsFadeC; uniform vec4 uFsFade;
  #endif
  #ifdef FS_BELLY
  uniform vec4 uFsBellyC; uniform vec4 uFsBelly; uniform float uFsBellyW;
  #endif
  #ifdef FS_MOTTLE
  uniform vec4 uFsMottleC; uniform vec4 uFsMottle;
  #endif
  #ifdef FS_RUST
  uniform vec4 uFsRustC; uniform vec4 uFsRustC2; uniform vec4 uFsRust;
  #endif
  #ifdef FS_GRAIN
  uniform vec4 uFsGrainC; uniform vec4 uFsGrain;
  #endif
  #ifdef FS_BANDS
  uniform vec4 uFs_bandsC; uniform vec4 uFs_bands; uniform float uFs_bandsO;
  #endif
  #ifdef FS_STRIPES
  uniform vec4 uFs_stripesC; uniform vec4 uFs_stripes; uniform float uFs_stripesO;
  #endif
  #ifdef FS_SCALES
  uniform vec4 uFsScalesC; uniform vec4 uFsScales;
  #endif
  #ifdef FS_SPOTS
  uniform vec4 uFs_spotsC; uniform vec4 uFs_spots; uniform vec4 uFs_spotsS; uniform vec2 uFs_spotsK;
  #endif
  #ifdef FS_SPOTS2
  uniform vec4 uFs_spots2C; uniform vec4 uFs_spots2; uniform vec4 uFs_spots2S; uniform vec2 uFs_spots2K;
  #endif
  #ifdef FS_RIVETS
  uniform vec4 uFsRivetsC; uniform vec4 uFsRivets; uniform vec4 uFsRivetsS;
  #endif
  #ifdef FS_DRIPS
  uniform vec4 uFsDripsC; uniform vec4 uFsDrips;
  #endif
  #ifdef FS_CRACKS
  uniform vec4 uFsCracksC; uniform vec4 uFsCracksI; uniform vec4 uFsCracks; uniform vec4 uFsCracksV; uniform float uFsCracksO;
  #endif
  #ifdef FS_GLOW
  uniform vec4 uFsGlowC; uniform vec4 uFsGlow; uniform vec4 uFsGlowP;
  #endif
  #ifdef FS_GLOSS
  uniform vec4 uFsGlossC; uniform vec4 uFsGloss; uniform float uFsGlossW;
  #endif
#endif
`;
