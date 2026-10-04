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
  ripple: { period: 1.6, half: 0.03 },
  wind: { period: 9.0, half: 0.08 },
  grains: { cell: 0.12, r0: 0.005, r1: 0.01 },
  cracks: { big: 5.5, bigHalf: 0.035, small: 1.6, smallHalf: 0.012, edgePerArea: 2.0 },
};

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
    float patchMask = smoothstep(0.55, 0.7, patchN);
    float broken = smoothstep(0.35, 0.55, vnoise(vec2(along * 0.35, floor(u) * 7.1)));
    float rip = lineField(u, gu, ${(GROUND.ripple.half / GROUND.ripple.period).toFixed(5)}, broken, 0.5) * patchMask
              * (1.0 - smoothstep(0.1, 0.25, slope));
    // long wind lines, a few of them, sweeping with the dunes
    float w = dot(p, across) / ${GROUND.wind.period.toFixed(1)} + (vnoise(p * 0.018 + 5.0) - 0.5) * 3.0;
    float gw = gradLen(w);
    float id = floor(w);
    float keep = step(0.55, hash(vec2(id, 4.7))) * smoothstep(0.3, 0.5, vnoise(vec2(along * 0.025, id * 3.1)));
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
  // Dried-mud cracks on the salt flats: big polygons, small crust cracks inside them near.
  float mudCracks(vec2 p, vec2 q1, vec4 j1, vec2 q2, vec4 j2) {
    float gaps = smoothstep(0.25, 0.45, vnoise(p * 0.35 + 20.0));
    float big = crackNet(q1, j1, ${(GROUND.cracks.bigHalf / GROUND.cracks.big).toFixed(5)}, gaps, 0.6, 6.0);
    float small = crackNet(q2, j2, ${(GROUND.cracks.smallHalf / GROUND.cracks.small).toFixed(5)}, smoothstep(0.4, 0.6, vnoise(p * 0.9 + 3.0)), 0.5, 12.0);   // only close by
    return max(big, small * 0.7);
  }
`;
