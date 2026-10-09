import * as THREE from 'three';

// ---------------------------------------------------------------------------
// The water's look, compiled into the G-buffer surface shader (materials.js)
// for every MODE_WATER material (the WATER define). Like everything else it
// draws no final image: it writes a flat albedo, how lit it is and ink lines
// for post.js to print.
//
//   depth bands   the water column under each point, from a baked map of the
//                 bed (water.js bakes it from the collision world), drawn as
//                 three flat tones: pale shallows, the water's colour, a deeper
//                 saturated tone. post.js inks the boundaries like contour lines.
//   shallows      the bed shows through in the shallowest band (its colour,
//                 uWaterBed), crossed by faint wobbling caustic lines
//   shoreline     a pale foam band where the water meets anything (depth ~0),
//                 inked crisply by post.js, and a broken lapping line just
//                 off it that breathes in and out
//   ripples       short inked wave crests across the wind (uWind), drifting
//                 downwind, and rings spreading round whatever touches the
//                 water (uWaterRings: water.js adds them)
//   sky           at grazing angles the sky's colours (the horizon, then the
//                 zenith) in two flat steps
//   contact       little waves lapping round whatever stands in the water (rocks,
//                 piers, the ship, people wading): a pale band hugging it, small
//                 moving gaps, two broken inked wavelets breathing out and back,
//                 foam flecks; from the scene's depth behind the water
//                 (uSceneDepth: water.js renderGBuffer draws the water last)
//   sparkle       inked-paper dashes of sun on the water toward the sun
//   underneath    seen from below (diving), a pale bright ceiling with the
//                 ripples on it
// ---------------------------------------------------------------------------

/**
 * Water marks itself in the G-buffer by the length of its normal (others are unit length):
 * 1 + WATER_MARK.base, plus WATER_MARK.glint × the sun's sparkle there. post.js only uses
 * normals' directions, so nothing else notices; water.js reads it back for the sparkle.
 */
export const WATER_MARK = { base: 0.012, glint: 0.05 };

/**
 * The wave crests' ink: only in the patches the wind ruffles (paws: the edges of a slow drifting
 * noise), `calm` of it between them, and gone by `far` metres per pixel (a far lake is a flat tone).
 */
export const WATER_INK = { paws: [0.48, 0.66], calm: 0.15, far: [0.06, 0.2] };

/**
 * The contact foam: where anything meets the water, a pale band `band` m wide hugging it (never under
 * `minPx` device px × the pixel ratio on screen, so its outer contour never sits on the object's own outline
 * as a doubled line; at most `maxBand`), swelling by `breathe` of itself; its outer part broken by small
 * moving gaps and two broken inked wavelets `gap` m (at least `gapPx` px) off it, close up only (`detail`,
 * m per px); the whole of it gone by `far` m per px, where the object's outline marks the waterline alone.
 * Measured from the scene's depth behind the water fragment: the view ray's run through the water, over how fast
 * that grows across the water (`slope`, clamped): the distance to what stands in it, ~0 for a flat shallow bed.
 */
export const CONTACT = { band: 0.3, minPx: 6, maxBand: 1.2, breathe: 0.22, gap: 0.18, gapPx: 5, detail: [0.03, 0.07], far: [0.1, 0.2], slope: [0.4, 1] };

const glf = (v) => Number(v).toFixed(4);   // (a GLSL float)
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** The contact band's width (m) where a device pixel covers `px` m of water (the shader's twin). */
export function contactBand(px, ratio = 1) {
  return Math.min(CONTACT.maxBand, Math.max(CONTACT.band, CONTACT.minPx * Math.max(ratio, 1) * px));
}
/** How much of the contact foam is drawn (`all`) and of its detail (gaps, wavelets, flecks) at `px` m per px. */
export function contactFade(px) {
  return { all: 1 - smooth(CONTACT.far[0], CONTACT.far[1], px), detail: 1 - smooth(CONTACT.detail[0], CONTACT.detail[1], px) };
}

/** How many ripple rings the shader draws at once (water.js keeps a ring buffer). */
export const RINGS = 12;

/** Uniforms shared by every water material (water.js updates them in place). */
export const waterShared = {
  uWaterRings: { value: Array.from({ length: RINGS }, () => new THREE.Vector4(0, 0, -100, 0)) },
  uWaterSky: { value: [new THREE.Color('#8ccfd2'), new THREE.Color('#f7ecd2')] },   // zenith, horizon (post.js's sky)
  uWaterLite: { value: 0 },   // 1: the handheld's low detail (one scale of waves, no caustics, no sparkle; main.js applyDetail)
};

/** The scene's view depth before the water (water.js renderGBuffer); 1 × 1 of 0 (the sky: no contact) until then. */
const NO_DEPTH = new THREE.DataTexture(new Uint16Array([0]), 1, 1, THREE.RedFormat, THREE.HalfFloatType);
NO_DEPTH.needsUpdate = true;
waterShared.uSceneDepth = { value: NO_DEPTH };
waterShared.uWaterContact = { value: 0 };
waterShared.uSceneNearFar = { value: new THREE.Vector3() };
waterShared.uScenePrevVP = { value: new THREE.Matrix4() };    // the view-projection uSceneDepth was taken with (water.js: last frame's, reprojected)
waterShared.uScenePrevEye = { value: new THREE.Vector3() };   // and that camera's position   // near, far, 1: uSceneDepth is the depth buffer's (else a view depth)   // 1 only while water.js draws the water over the scene's copied depth

const SAND = new THREE.Color('#e9dcb4');
/** A bed map that says "unknown": the shader falls back to uWaterOpt.x of depth everywhere. */
const NO_BED = new THREE.DataTexture(new Uint16Array([0]), 1, 1, THREE.RedFormat, THREE.HalfFloatType);
NO_BED.needsUpdate = true;

/**
 * Turn a fresh makeMaterial() water material into the new water: the WATER
 * define and its uniforms. o.bed: the bed's colour seen through the shallows
 * (default: the shallows' own tone, sandier); o.waterDepth: how deep it looks until its bed is baked;
 * o.waterPrint: a flat printed shape lying on the water (the Garden's mirrored
 * shore), its own colour with the ripples, no depth.
 */
export function waterMaterial(mat, o = {}) {
  mat.defines = { ...mat.defines, WATER: 1 };
  Object.assign(mat.uniforms, waterShared, {
    uBed: { value: NO_BED },
    uBedBox: { value: new THREE.Vector4(0, 0, 0, 0) },        // x0, z0, 1 / width, 1 / depth (world)
    uBedRef: { value: new THREE.Vector2(0, 0) },              // the height the map is measured from, 1 once baked
    uWaterBed: { value: o.bed ? new THREE.Color(o.bed) : new THREE.Color(o.color2 ?? o.color).lerp(SAND, 0.55) },   // (by default: the shallows' tone, sandier)
    uWaterOpt: { value: new THREE.Vector4(o.waterDepth ?? 2.4, o.waterPrint ? 1 : 0, o.clarity ?? 1, o.sparkle ?? 1) },
    // its underside, seen from below: the shallows' tone lifted toward this colour (o.below: [colour, how much])
    uWaterBelow: { value: o.below ? (() => { const col = new THREE.Color(o.below[0]); return new THREE.Vector4(col.r, col.g, col.b, o.below[1]); })() : new THREE.Vector4(0.96, 0.98, 0.97, 0.45) },
  });
  return mat;
}

export const WATER_GLSL = /* glsl */ `
  uniform sampler2D uBed;
  uniform vec4 uBedBox;
  uniform vec2 uBedRef;
  uniform vec3 uWaterBed;
  uniform vec4 uWaterOpt;        // fallback depth · printed shape · clarity · sparkle
  uniform vec4 uWaterBelow;      // the underside: lifted toward rgb by a
  uniform vec4 uWaterRings[${RINGS}];   // x, z, start time, strength
  uniform vec3 uWaterSky[2];
  uniform float uWaterLite;
  uniform vec4 uWind;
  uniform highp sampler2D uSceneDepth;   // the scene's view depth without the water (water.js renderGBuffer)
  uniform float uWaterContact;     // 1: uSceneDepth is this frame's (the contact foam is drawn)
  uniform vec3 uSceneNearFar;      // near, far, 1: uSceneDepth holds the depth buffer's values (0..1), else view depths
  uniform mat4 uScenePrevVP;       // the camera uSceneDepth was taken with (usually last frame's)
  uniform vec3 uScenePrevEye;

  struct WaterLook { vec3 albedo; float ink; float lit; float glint; };

  // the water column under p (m), and how sure the bed map is of it (0 outside it / not baked)
  float waterDepth(vec3 p, out float known) {
    vec2 uv = (p.xz - uBedBox.xy) * uBedBox.zw;
    vec2 e = smoothstep(0.0, 0.03, uv) * (1.0 - smoothstep(0.97, 1.0, uv));
    known = uBedRef.y * e.x * e.y;
    float bed = texture(uBed, clamp(uv, 0.0, 1.0)).r + uBedRef.x;
    return mix(uWaterOpt.x, p.y - bed, known);
  }

  // wave crests across the wind, drifting downwind, broken into short pen dashes
  float waveInk(vec2 p, float t, float str, vec2 wd, float scale, float seed) {
    vec2 q = vec2(dot(p, wd), dot(p, vec2(-wd.y, wd.x))) / scale;
    float warp = vnoise(q * vec2(0.09, 0.05) + seed + t * 0.02) * 3.0 + vnoise(q * 0.31 - t * 0.05) * 0.6;
    float v = q.x * 0.5 - t * (0.18 + 0.12 * str) / scale + warp;
    float fw = max(fwidth(v), 1e-5);
    float d = abs(fract(v + 0.5) - 0.5) / fw;                       // device px from the crest
    float lane = floor(v + 0.5);
    float dash = smoothstep(0.6, 0.66, vnoise(vec2(q.y * 1.3, lane * 3.7 + seed) + vec2(t * 0.05, 0.0)) + 0.08 * min(str, 2.0));
    return inkLine(d, 0.95) * dash * (1.0 - smoothstep(0.12, 0.3, fw));
  }

  // The contact foam (CONTACT): raises foam where the view ray's run through the water to what is behind
  // it is short, returns the wavelets' ink. The noise is all on p.xz: anchored in the world.
  float contactFoam(vec3 p, float t, float px, vec2 wd, inout float foam) {
    if (uWaterContact < 0.5) return 0.0;   // (a uniform branch)
    // this point seen by the camera the scene's depth was taken with (last frame's: reprojected), the scene's
    // depth there, and the ray's run through the water to it (the view depth over the ray's share of it)
    vec4 pc = uScenePrevVP * vec4(p, 1.0);
    vec2 uv = pc.xy / pc.w * 0.5 + 0.5;
    ivec2 sz = textureSize(uSceneDepth, 0);
    float sd = texelFetch(uSceneDepth, clamp(ivec2(uv * vec2(sz)), ivec2(0), sz - 1), 0).r;
    if (uSceneNearFar.z > 0.5) sd = sd >= 1.0 ? 0.0 : uSceneNearFar.x * uSceneNearFar.y / (uSceneNearFar.y - sd * (uSceneNearFar.y - uSceneNearFar.x));   // (the view depth; the sky 0)
    float run = sd - pc.w;
    // the sky, off its edge, or something in front of this point then (it has moved off since): nothing to meet
    bool none = pc.w <= 1e-3 || sd <= 0.0 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0))) || run < -(0.3 + 0.01 * pc.w);
    float ray = none ? 64.0 : min(max(run, 0.0) * length(p - uScenePrevEye) / max(pc.w, 1e-3), 64.0);
    // the distance to the contact (m): the run over how fast it grows across the water, held between
    // CONTACT.slope (a face standing in the water grows it ~1 m a metre; a flat shallow bed hardly at all, so
    // 25 cm of water over sand is no contact)
    float dist = ray / clamp(fwidth(ray) / max(px, 1e-4), ${glf(CONTACT.slope[0])}, ${glf(CONTACT.slope[1])});
    float pr = max(uPixelRatio, 1.0);
    float bw = clamp(max(${glf(CONTACT.band)}, ${glf(CONTACT.minPx)} * pr * px), ${glf(CONTACT.band)}, ${glf(CONTACT.maxBand)});
    float g = max(${glf(CONTACT.gap)}, ${glf(CONTACT.gapPx)} * pr * px);
    float keep = 1.0 - smoothstep(${glf(CONTACT.far[0])}, ${glf(CONTACT.far[1])}, px);
    if (keep <= 0.0 || dist > bw * (1.0 + ${glf(CONTACT.breathe)}) + g * 4.0) return 0.0;
    float near = 1.0 - smoothstep(${glf(CONTACT.detail[0])}, ${glf(CONTACT.detail[1])}, px);   // the detail: close up only
    // each stretch of the band breathes in its own time: out, and back
    float ph = vnoise(p.xz * 0.45) * 6.2832;
    float edge = bw * (1.0 + ${glf(CONTACT.breathe)} * sin(t * 1.3 + ph));
    float body = 1.0 - smoothstep(edge - px, edge + px, dist);
    float inner = 1.0 - smoothstep(edge * 0.45 - px, edge * 0.45 + px, dist);
    // small gaps in its outer part, drifting with the wind (the waves breaking unevenly)
    float gaps = smoothstep(0.3, 0.38, vnoise(p.xz * 2.4 + wd * t * 0.3 + vec2(0.0, t * 0.08)));
    // (only where the band is thick enough on screen: a gap in a band a few px thick is a speck post.js inks)
    float c = max(inner, body * mix(1.0, gaps, near * smoothstep(9.0, 14.0, bw / max(px, 1e-4))));
    // foam flecks just off the band: world-fixed cells, each a speck that comes and goes
    float cs = 0.22;
    vec2 id = floor(p.xz / cs), f = (fract(p.xz / cs) - 0.5 - (hash2(id + 4.1) - 0.5) * 0.4) * cs;
    float h = hash(id + floor(t * 0.7 + hash(id + 2.3) * 9.0) * 0.173);
    float r = 0.022 + 0.02 * hash(id + 7.7);
    float zone = step(edge, dist) * (1.0 - smoothstep(edge + g * 2.0, edge + g * 2.6, dist));
    float fleck = (1.0 - smoothstep(r - px, r + px, length(f))) * step(0.7, h) * zone * near * smoothstep(2.5, 4.0, r / px);
    foam = max(foam, max(c, fleck) * keep);
    // two broken inked wavelets off the band, swelling out after it and back
    float at1 = edge + g * (1.0 + 0.5 * sin(t * 1.3 + ph - 0.9));
    float at2 = at1 + g * (1.5 + 0.6 * sin(t * 1.3 + ph - 2.0));
    float d1 = step(0.36, vnoise(p.xz * 1.3 + 5.0 - wd * t * 0.2));
    float d2 = step(0.5, vnoise(p.xz * 1.1 + 11.0 + wd * t * 0.15));
    float wl = max(inkLine(abs(dist - at1) / max(px, 1e-4), 1.3) * d1, inkLine(abs(dist - at2) / max(px, 1e-4), 1.1) * d2 * 0.8);
    return wl * near * keep * (1.0 - fleck);
  }

  WaterLook waterLook(vec3 p, bool front) {
    WaterLook W;
    float t = uTime;
    vec2 wd = length(uWind.xy) > 1e-4 ? normalize(uWind.xy) : vec2(1.0, 0.0);
    float str = clamp(uWind.z, 0.15, 3.0);
    float known;
    float depth = waterDepth(p, known);
    // (derivatives first: uniform control flow)
    float px = max(length(dFdx(p.xz)), length(dFdy(p.xz)));          // metres per device px
    float fd = max(fwidth(depth), 1e-4);
    // a slow wobble of the band edges: the bed seen through moving water
    float wob = (vnoise(p.xz * 0.35 + t * vec2(0.21, 0.13) * (0.5 + str * 0.3)) - 0.5) * 0.22;
    float dB = depth + wob * known;
    vec3 V = normalize(cameraPosition - p);
    vec3 shallow = uColor2, mid = uColor;
    vec3 deep = mid * vec3(0.78, 0.86, 0.9) + vec3(0.0, 0.0, 0.03);
    float clarity = uWaterOpt.z;

    // ---- ink: wave crests (two scales: the coarse one carries further), rings
    float ink = waveInk(p.xz, t, str, wd, 1.0, 0.0);
    if (uWaterLite < 0.5) ink = max(ink, waveInk(p.xz, t, str, wd, 3.2, 17.0) * 0.7);   // (a uniform branch: derivatives are fine)
    // the crests come in patches the wind ruffles (cat's paws drifting downwind), the rest of the
    // water left flat; and they thin out with distance, where an inker leaves the water a flat tone
    float paws = smoothstep(${WATER_INK.paws[0]}, ${WATER_INK.paws[1]}, vnoise(p.xz * 0.018 - wd * t * 0.05) * 0.7 + vnoise(p.xz * 0.05 + 9.0) * 0.3);
    ink *= 0.75 * mix(${WATER_INK.calm}, 1.0, paws) * (1.0 - smoothstep(${WATER_INK.far[0]}, ${WATER_INK.far[1]}, px));
    float rings = 0.0;
    for (int i = 0; i < ${RINGS}; i++) {
      vec4 r = uWaterRings[i];
      float age = t - r.z;
      float life = 1.3 + 1.2 * min(r.w, 1.5);
      if (age < 0.0 || age > life || r.w <= 0.0) continue;
      vec2 o = p.xz - r.xy;
      float dist = length(o);
      float R = 0.18 + age * (1.1 + 0.5 * min(r.w, 2.0));
      float w = max(px * 1.6, 0.03);
      if (dist > R + w || dist < R * 0.62 - w) continue;   // (only pixels on or between the two rings pay for the rest)
      float fade = (1.0 - age / life) * min(r.w, 1.0);
      float brk = uWaterLite > 0.5 ? 1.0 : step(0.32, vnoise(vec2(atan(o.y, o.x) * 2.5 + r.z * 7.0, R * 0.7)));
      rings = max(rings, (1.0 - smoothstep(w * 0.4, w, abs(dist - R))) * fade * brk);
      float R2 = R * 0.62;
      rings = max(rings, (1.0 - smoothstep(w * 0.4, w, abs(dist - R2))) * fade * 0.7 * step(0.25, age) * brk);
    }
    ink = max(ink, rings);

    if (!front) {
      // the underside, seen while diving: a pale bright ceiling with its ripples
      W.albedo = mix(shallow, uWaterBelow.rgb, uWaterBelow.a);
      W.ink = ink * 0.75;
      W.lit = 1.0;
      W.glint = 0.0;
      return W;
    }
    if (uWaterOpt.y > 0.5) {
      // a printed shape lying on the water (the mirrored shore): its own flat colour, the ripples over it
      W.albedo = uColor;
      W.ink = ink * 0.6;
      W.lit = 0.0;
      W.glint = 0.0;
      return W;
    }

    // ---- depth bands: pale shallows (the bed showing through), the water, deep water
    vec3 col = dB < 1.15 ? shallow : (dB < 3.4 ? mid : deep);
    if (dB < 0.42 * clarity && known > 0.5) col = mix(shallow, uWaterBed, 0.5);
    // caustics over the shallow bed: a fine wobbling net, close up only, fading with depth
    float causK = (1.0 - smoothstep(0.15, 0.7, dB)) * known * (1.0 - smoothstep(0.012, 0.03, px)) * clarity * (1.0 - uWaterLite);
    if (causK > 0.0) {   // (the cell search only where it shows)
      float cpx = max(px * 1.6, 1e-4);   // cells per px; the 0.7 px line is nothing past 0.35 px * ratio + 0.6 px
      float cv = voronoiBorder(p.xz * 1.6 + vec2(sin(t * 0.7 + p.z * 0.9), cos(t * 0.6 + p.x * 0.8)) * 0.3, (0.35 * uPixelRatio + 0.6) * cpx * 1.01);
      ink = max(ink, inkLine(cv / cpx, 0.7) * causK * 0.3);
    }

    // ---- the sky at grazing angles: two flat steps toward the horizon's colour
    float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
    float sk = fres + (vnoise(p.xz * 0.05 + t * 0.03) - 0.5) * 0.12;
    vec3 skyC = mix(uWaterSky[1], uWaterSky[0], smoothstep(0.0, 0.5, V.y));
    float steps = sk > 0.62 ? 0.62 : (sk > 0.36 ? 0.3 : 0.0);
    col = mix(col, mix(col, skyC, 0.85), steps);

    // ---- shoreline: a pale foam band where the water meets anything, a lapping line off it
    // (the distance to the shore in metres: the depth over its slope)
    float slopeW = max(fd / max(px, 1e-4), 0.004);
    float shore = depth / slopeW;
    float foamM = 0.28 + 0.1 * sin(t * 0.9 + p.x * 0.7 + p.z * 0.4);
    float foam = (1.0 - smoothstep(foamM, foamM + px * 1.2, shore)) * step(-0.05, depth) * known;
    foam = max(foam, (1.0 - smoothstep(1.3 * fd, 2.3 * fd, depth)) * known);           // at least a line, however steep
    float lap = 0.0;
    if (shore < 1.6 && known > 0.0 && px < 0.2) {   // (only near the shore)
      float lapAt = 0.95 + 0.35 * sin(t * 1.15 + vnoise(p.xz * 0.25) * 6.2832);
      lap = inkLine(abs(shore - lapAt) / max(px, 1e-4), 0.9) * step(0.42, vnoise(p.xz * 0.8 + 3.0 + t * 0.1)) * known * (1.0 - smoothstep(0.06, 0.2, px));
    }
    // ---- contact: little waves lapping round whatever stands in the water, from the scene's depth
    // behind it (rocks and walls the bed map has too, and what it doesn't: the ship, piers, people)
    float wavelets = contactFoam(p, t, px, wd, foam);
    ink = max(max(ink * (1.0 - foam), lap * 0.85), wavelets * 0.85);
    col = mix(col, mix(vec3(0.97, 0.98, 0.95), shallow, 0.18), foam);

    // ---- sparkle: dashes of sun toward the sun (horizontal on the page), twinkling. They are
    // not drawn here (post.js would ink round them, black specks): the glint goes out in the
    // normal's length (WATER_MARK) and water.js paints it white over the finished page
    float glint = 0.0;
    if (uSunDir.y > 0.02 && uWaterOpt.w > 0.0 && uWaterLite < 0.5) {
      vec3 R = vec3(-V.x, V.y, -V.z);
      float path = smoothstep(0.88, 0.995, dot(R, uSunDir));
      // world-fixed cells (a power of two metres, ~16 px along the view), a dash in each lying
      // across the view (horizontal on the page)
      vec3 cf = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
      vec2 side = normalize(vec2(-cf.z, cf.x) + 1e-5), along = vec2(side.y, -side.x);
      float cs = exp2(floor(log2(max(px * 16.0, 0.05))));
      vec2 gq = p.xz / cs, id = floor(gq), f = fract(gq) - 0.5 - (hash2(id + 1.3) - 0.5) * 0.3;
      vec2 fl = vec2(dot(f, side), dot(f, along));
      float h = hash(id + floor(t * 2.3 + hash(id + 3.1) * 7.0) * 0.137);
      float len = 0.14 + 0.22 * hash(id + 9.7);
      glint = step(abs(fl.y), 0.08) * step(abs(fl.x), len) * step(1.0 - path * 0.55 * uWaterOpt.w, h) * (1.0 - foam);
    }

    W.albedo = col;
    W.ink = ink;
    W.lit = foam * 0.6;
    W.glint = glint;
    return W;
  }
`;
