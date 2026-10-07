// Ground ink by distance: dry sand and cracked salt flats (materials.js, MODE_TERRAIN).
//
// Every mark here is drawn with a real width on the ground (metres), not a
// width in pixels. Close up it is a crisp pen line (at least ~1 px, at most
// ~1.7 px wide, anti-aliased from its screen-space gradient, so it holds at
// grazing angles). Once the real line is thinner than a pixel it is drawn
// lighter instead of thinner: the ink a patch of ground holds stays the same at
// every distance. And once a pattern is too dense to draw (a few pixels per
// period) it hands over to exactly that average tone. So nothing switches on
// or off with distance: walking or driving, marks fade in and out smoothly,
// and the far ground turns into an even tone instead of shimmering.
//
// The bands of detail, near to far:
//   sand   grains (a few metres) -> wind ripples (tens of metres) -> long
//          wind lines sweeping over the dunes (hundreds of metres) -> flat tone
//   salt   small crust cracks (near) -> the big dried-mud polygons -> flat tone
//
// The functions below mirror the GLSL for the tests (tests/ground-ink.test.js).

export const GROUND = {
  minHalfPx: 0.55,          // the thinnest line drawn, half width in render px
  maxHalfPx: 0.85,          // the widest (times the pixel ratio, CSS px)
  resolved: [2.5, 5.0],     // px per period: below the first, only the average tone
  ripple: { period: 1.6, half: 0.03, patch: [0.66, 0.78] },   // patch: where the ripple patches are (of a 0..1 noise)
  wind: { period: 9.0, half: 0.08, keep: 0.62 },                // keep: the share of wind lines left out
  // the print look's coarse pen dots on sand: how many cells hold one, and only in patches
  // (no longer drawn on sand with ripples: the pebbles below took their place; kept for the other ground)
  dots: { density: 0.1, patch: [0.55, 0.75] },
  // cracks in bare rock ground (terrain with pattern 'cracks'): long fissures, a finer net near
  fissures: { big: 7.5, bigHalf: 0.04, small: 2.4, smallHalf: 0.014 },
  grains: { cell: 0.12, r0: 0.005, r1: 0.01 },
  cracks: { big: 5.5, bigHalf: 0.035, small: 1.6, smallHalf: 0.012, edgePerArea: 2.0 },
};

/**
 * Pebbles and stones on the sand (the print look, uDots): what Moebius's spots on sand are, small cast shadows
 * of pebbles and rocks, not dots. Each is a little flattened disc with its side away from the light inked and
 * the shadow it casts on the sand (only where the sand is lit) running away from the light, as long as the
 * light is low (`cast` radii over the sun's tangent, `len` the bounds). Three scales: grit near (in place of
 * the grains' dots), pebbles in patches and a few stones that still read far off. Close up the lit side keeps the sand's colour inside a fine rim; thinner
 * than `minPx` radius it is drawn that wide and lighter (the ink it holds kept); a few px per cell and it hands
 * over to that average tone (resolved, as the grains). cell (m), density (share of cells, at the patches' full),
 * r (m): the radius' range (most near the small end), squash: across the light over along it.
 */
export const PEBBLES = {
  grit: { cell: 0.32, density: 0.22, r: [0.009, 0.024], seed: 71.0 },   // (in place of the grains' dots, in the print look)
  pebble: { cell: 0.9, density: 0.32, r: [0.022, 0.07], seed: 13.0 },
  stone: { cell: 6.0, density: 0.16, r: [0.12, 0.42], seed: 57.0 },
  patch: [0.35, 0.7],      // where the pebbles lie (of a 0..1 noise; the stones everywhere)
  cast: 1.1, len: [0.6, 3.0],
  squash: 0.72,
  side: 1.15, shadow: 1.0, rim: 0.75,   // ink: the side away from the light, the cast shadow, the lit side's rim (post.js: over 1 is darker)
  minPx: 1.0,              // the smallest radius drawn (px); smaller, lighter instead
  rimPx: [3.0, 6.0],       // the rim drawn once the radius is this many px
  resolved: [3.0, 6.0],    // px per cell: below the first, only the average tone
};

/** A pebble's cast shadow, in radii, for a light this high (y: the sine of its height over the horizon). */
export function pebbleShadow(y) {
  const s = Math.max(y, 0.05);
  return clamp(PEBBLES.cast * Math.sqrt(Math.max(1 - s * s, 0)) / s, PEBBLES.len[0], PEBBLES.len[1]);
}

/**
 * One pebble's ink (mirrors the GLSL): d (m, from its centre, [toward the light, across]), r its radius (m),
 * len its shadow (radii), gm metres per px, castK how lit the sand is there (0..1).
 */
export function pebbleInk([dx, dy], r, len, gm, castK) {
  const k = Math.max(1, PEBBLES.minPx * gm / r), rD = r * k, amt = 1 / (k * k);
  const sq = PEBBLES.squash, ss = (a, b, v) => smoothstep(a, b, v);
  const aa = gm / rD;
  const bodyR = Math.hypot(dx, dy / sq) / rD;
  const inBody = 1 - ss(1 - aa, 1 + aa, bodyR);
  const darkSide = inBody * (1 - ss(-0.35, 0.25, dx / rD));
  const L = len * rD;
  const sl = Math.hypot((dx + 0.5 * L) / (0.5 * L + 0.6 * rD), dy / (0.8 * rD * sq));
  const aaS = gm / (0.8 * rD * sq);
  const inShadow = (1 - ss(1 - aaS, 1 + aaS, sl)) * (1 - inBody) * castK;
  const rimK = ss(PEBBLES.rimPx[0], PEBBLES.rimPx[1], r / gm);
  const rim = rimK * (1 - ss(0.5, 1.2, Math.abs(bodyR - 1) * rD / gm)) * ss(-0.2, 0.2, dx / rD);
  return Math.max(darkSide * PEBBLES.side, inShadow * PEBBLES.shadow, rim * PEBBLES.rim) * amt;
}

/** The average ink a cell holds (what the far ground hands over to): a pebble of radius r, its shadow len radii. */
export function pebbleMean(r2mean, len, cell, density, castK) {
  const sq = PEBBLES.squash;
  const area = Math.PI * r2mean * (0.5 * sq * PEBBLES.side + (0.5 * len + 0.6) * 0.8 * sq * PEBBLES.shadow * castK);
  return density * area / (cell * cell);
}

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** A pen line `dist` from its centre (pattern units), `g` units per px, true half width `hw` (units). */
export function penLine(dist, g, hw, pixelRatio = 1) {
  const hwPx = hw / Math.max(g, 1e-6);
  const hwD = clamp(hwPx, GROUND.minHalfPx, GROUND.maxHalfPx * Math.max(pixelRatio, 1));
  return (1 - smoothstep(hwD - 0.6, hwD + 0.6, dist / Math.max(g, 1e-6))) * Math.min(hwPx / hwD, 1);
}

/** Parallel lines one period apart (u in periods), mask 0..1 per line, maskMean its average. */
export function lineField(u, g, hw, mask = 1, maskMean = 1, pixelRatio = 1) {
  const res = smoothstep(GROUND.resolved[0], GROUND.resolved[1], 1 / Math.max(g, 1e-6));
  const f = u + 0.5 - Math.floor(u + 0.5);
  const lines = res > 0 ? penLine(Math.abs(f - 0.5), g, hw, pixelRatio) * mask : 0;
  return 2 * hw * maskMean * (1 - res) + lines * res;
}

export const GROUND_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- ground ink by distance
  // (src/ground-ink.js) Marks with a real width on the ground: crisp pen lines near,
  // lighter rather than thinner once under a pixel, then their average tone.
  // g: the pattern coordinate's screen gradient (units per render px), hw: true half width (units).
  float penLine(float dist, float g, float hw) {
    g = max(g, 1e-6);
    float hwPx = hw / g;
    float hwD = clamp(hwPx, ${GROUND.minHalfPx.toFixed(2)}, ${GROUND.maxHalfPx.toFixed(2)} * max(uPixelRatio, 1.0));
    return (1.0 - smoothstep(hwD - 0.6, hwD + 0.6, dist / g)) * min(hwPx / hwD, 1.0);
  }
  float resolvedAt(float pxPerPeriod) { return smoothstep(${GROUND.resolved[0].toFixed(1)}, ${GROUND.resolved[1].toFixed(1)}, pxPerPeriod); }
  // parallel lines one period apart, u in periods; mask per line, maskMean its average
  float lineField(float u, float g, float hw, float mask, float maskMean) {
    float res = resolvedAt(1.0 / max(g, 1e-6));
    float lines = res > 0.0 ? penLine(abs(fract(u + 0.5) - 0.5), g, hw) * mask : 0.0;
    return mix(2.0 * hw * maskMean, lines, res);
  }
  float gradLen(float v) { return length(vec2(dFdx(v), dFdy(v))); }

  // Wind ripples (1.6 m, in patches, broken) and the long wind lines over the dunes (9 m, sparse).
  // Call in uniform control flow (screen derivatives).
  float sandRipples(vec2 p, float slope) {
    const vec2 across = vec2(0.82, 0.57);
    vec2 alongDir = vec2(-across.y, across.x);
    float along = dot(p, alongDir);
    // ripples
    float u = dot(p, across) / ${GROUND.ripple.period.toFixed(1)} + (vnoise(p * 0.11) - 0.5) * 2.4 + (vnoise(p * 0.5) - 0.5) * 0.25;
    float gu = gradLen(u);
    float patchN = vnoise(p * 0.025 + 3.0);
    // (rare patches, well broken: most sand is flat colour, as an inker leaves it)
    float patchMask = smoothstep(${GROUND.ripple.patch[0].toFixed(2)}, ${GROUND.ripple.patch[1].toFixed(2)}, patchN);
    float broken = smoothstep(0.42, 0.62, vnoise(vec2(along * 0.35, floor(u) * 7.1)));
    float rip = lineField(u, gu, ${(GROUND.ripple.half / GROUND.ripple.period).toFixed(5)}, broken, 0.5) * patchMask
              * (1.0 - smoothstep(0.1, 0.25, slope));
    // long wind lines, a few of them, sweeping with the dunes
    float w = dot(p, across) / ${GROUND.wind.period.toFixed(1)} + (vnoise(p * 0.018 + 5.0) - 0.5) * 3.0;
    float gw = gradLen(w);
    float id = floor(w);
    float keep = step(${GROUND.wind.keep.toFixed(2)}, hash(vec2(id, 4.7))) * smoothstep(0.3, 0.5, vnoise(vec2(along * 0.025, id * 3.1)));
    float wind = lineField(w, gw, ${(GROUND.wind.half / GROUND.wind.period).toFixed(5)}, keep, 0.25)
               * (1.0 - smoothstep(0.2, 0.38, slope)) * (1.0 - smoothstep(0.6, 0.8, patchN));   // not over the ripple patches
    return max(rip, wind * 0.85);
  }

  // Sand grains: tiny dots on a jittered grid, gm = metres per px (the longer footprint).
  float sandGrains(vec2 p, float gm, float density, float cell, float r0, float r1, float seed) {
    vec2 g = p / cell, id = floor(g), h = hash2(id + seed);
    float r = r0 + (r1 - r0) * h.y;
    float d = length((fract(g) - (0.2 + 0.6 * h)) * cell);
    float rPx = r / gm, rD = max(rPx, 0.6);
    float res = smoothstep(3.0, 6.0, cell / gm);
    float dots = res > 0.0 ? (1.0 - smoothstep(rD - 0.5, rD + 0.5, d / gm)) * min(rPx * rPx / (rD * rD), 1.0) * step(hash(id + seed + 5.3), density) : 0.0;
    float meanR2 = (r0 * r0 + r0 * r1 + r1 * r1) / 3.0;
    return mix(density * 3.14159 * meanR2 / (cell * cell), dots, res);
  }

  // Pebbles and stones on the sand (PEBBLES): small cast shadows of pebbles and rocks, not dots. One per cell at
  // most, centred so that it and its shadow stay inside the cell (one lookup a pixel); s2 the light's way on the
  // ground (unit), len its shadow in radii, castK how lit the sand is here, gm metres per px.
  float pebbleShadow(float y) {
    float s = max(y, 0.05);
    return clamp(${PEBBLES.cast.toFixed(2)} * sqrt(max(1.0 - s * s, 0.0)) / s, ${PEBBLES.len[0].toFixed(2)}, ${PEBBLES.len[1].toFixed(2)});
  }
  float pebbleInk(vec2 d, float r, float len, float gm, float castK) {
    float k = max(1.0, ${PEBBLES.minPx.toFixed(2)} * gm / r), rD = r * k, amt = 1.0 / (k * k);
    float aa = gm / rD;
    float bodyR = length(vec2(d.x, d.y / ${PEBBLES.squash.toFixed(2)})) / rD;
    float inBody = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, bodyR);
    float darkSide = inBody * (1.0 - smoothstep(-0.35, 0.25, d.x / rD));
    float L = len * rD;
    float sl = length(vec2((d.x + 0.5 * L) / (0.5 * L + 0.6 * rD), d.y / (0.8 * rD * ${PEBBLES.squash.toFixed(2)})));
    float aaS = gm / (0.8 * rD * ${PEBBLES.squash.toFixed(2)});
    float inShadow = (1.0 - smoothstep(1.0 - aaS, 1.0 + aaS, sl)) * (1.0 - inBody) * castK;
    float rimK = smoothstep(${PEBBLES.rimPx[0].toFixed(1)}, ${PEBBLES.rimPx[1].toFixed(1)}, r / gm);
    float rim = rimK * (1.0 - smoothstep(0.5, 1.2, abs(bodyR - 1.0) * rD / gm)) * smoothstep(-0.2, 0.2, d.x / rD);
    return max(max(darkSide * ${PEBBLES.side.toFixed(2)}, inShadow * ${PEBBLES.shadow.toFixed(2)}), rim * ${PEBBLES.rim.toFixed(2)}) * amt;
  }
  float pebbleField(vec2 p, float gm, vec2 s2, float len, float castK, float cell, float density, vec2 rr, float seed) {
    float res = smoothstep(${PEBBLES.resolved[0].toFixed(1)}, ${PEBBLES.resolved[1].toFixed(1)}, cell / gm);
    float dr = rr.y - rr.x, r2m = rr.x * rr.x + 2.0 * rr.x * dr / 3.0 + dr * dr / 5.0;   // (the mean of r² for r = mix(r0, r1, h²))
    float sq = ${PEBBLES.squash.toFixed(2)};
    float tone = density * 3.14159 * r2m * (0.5 * sq * ${PEBBLES.side.toFixed(2)} + (0.5 * len + 0.6) * 0.8 * sq * ${PEBBLES.shadow.toFixed(2)} * castK) / (cell * cell);
    float ink = 0.0;
    if (res > 0.0) {
      vec2 id = floor(p / cell), h = hash2(id + seed);
      if (hash(id + seed + 5.3) < density) {
        float r = mix(rr.x, rr.y, h.y * h.y);
        vec2 perp = vec2(-s2.y, s2.x);
        // (the pebble and its shadow centred in the cell, then jittered within what is left of it)
        float ext = 0.5 * len * r + 1.6 * r, room = max(0.5 * cell - ext, 0.0);
        vec2 c = (id + 0.5) * cell + s2 * (0.5 * len * r) + (vec2(hash(id + seed + 2.1), hash(id + seed + 8.3)) - 0.5) * 2.0 * room;
        vec2 d = p - c;
        ink = pebbleInk(vec2(dot(d, s2), dot(d, perp)), r, len, gm, castK);
      }
    }
    return mix(tone, ink, res);
  }

  // Voronoi border distance (cell units, Inigo Quilez) and the border's normal.
  float voronoiEdge(vec2 x, out vec2 nb) {
    vec2 n = floor(x), f = fract(x), mg = vec2(0.0), mr = vec2(0.0);
    float md = 8.0;
    for (int j = -1; j <= 1; j++)
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 r = g + hash2(n + g) - f;
        float d = dot(r, r);
        if (d < md) { md = d; mr = r; mg = g; }
      }
    md = 8.0; nb = vec2(1.0, 0.0);
    for (int j = -2; j <= 2; j++)
      for (int i = -2; i <= 2; i++) {
        vec2 g = mg + vec2(float(i), float(j));
        vec2 r = g + hash2(n + g) - f;
        if (dot(mr - r, mr - r) > 1e-5) {
          vec2 e = normalize(r - mr);
          float d = dot(0.5 * (mr + r), e);
          if (d < md) { md = d; nb = e; }
        }
      }
    return md;
  }
  vec2 crackCoord(vec2 p, float cell) {
    return p / cell + (vec2(vnoise(p * 0.7 * 5.5 / cell), vnoise(p * 0.7 * 5.5 / cell + 9.0)) - 0.5) * 0.12;
  }
  // one crack network: q in cells, j = (dFdx(q), dFdy(q)), hw the crack's half width in cells
  // (handed over to the tone while the cells are still 6-12 px: by then a crack is a faint
  //  sub-pixel line whose ink already equals that tone, so this costs nothing to the eye and
  //  skips the Voronoi search over most of the far ground)
  float crackNet(vec2 q, vec4 j, float hw, float gaps, float gapsMean, float fromPx) {
    float res = smoothstep(fromPx, fromPx * 2.0, 1.0 / max(max(length(j.xy), length(j.zw)), 1e-6));
    float lines = 0.0;
    if (res > 0.0) {
      vec2 nb;
      float d = voronoiEdge(q, nb);
      float g = length(vec2(dot(nb, j.xy), dot(nb, j.zw)));   // cells per px across the crack
      lines = penLine(d, g, hw) * gaps;
    }
    return mix(${GROUND.cracks.edgePerArea.toFixed(1)} * 2.0 * hw * gapsMean, lines, res);
  }
  // Cracks in bare rock: long fissures (most of a big network's edges left out, so they run and
  // stop), a finer broken net close by. The same pen lines and hand-over to a tone as the mud's.
  float rockFissures(vec2 p, vec2 q1, vec4 j1, vec2 q2, vec4 j2) {
    float runs = smoothstep(0.45, 0.6, vnoise(p * 0.09 + 4.0));
    float big = crackNet(q1, j1, ${(GROUND.fissures.bigHalf / GROUND.fissures.big).toFixed(5)}, runs, 0.35, 6.0);
    float small = crackNet(q2, j2, ${(GROUND.fissures.smallHalf / GROUND.fissures.small).toFixed(5)}, smoothstep(0.55, 0.7, vnoise(p * 0.5 + 9.0)), 0.3, 12.0);
    return max(big, small * 0.6);
  }
  // Dried-mud cracks on the salt flats: big polygons, small crust cracks inside them near.
  float mudCracks(vec2 p, vec2 q1, vec4 j1, vec2 q2, vec4 j2) {
    float gaps = smoothstep(0.25, 0.45, vnoise(p * 0.35 + 20.0));
    float big = crackNet(q1, j1, ${(GROUND.cracks.bigHalf / GROUND.cracks.big).toFixed(5)}, gaps, 0.6, 6.0);
    float small = crackNet(q2, j2, ${(GROUND.cracks.smallHalf / GROUND.cracks.small).toFixed(5)}, smoothstep(0.4, 0.6, vnoise(p * 0.9 + 3.0)), 0.5, 12.0);   // only close by
    return max(big, small * 0.7);
  }
`;
