// Memento: shared shader code, ported from the web game's GLSL (src/materials.js,
// src/ground-ink.js, src/biome.js). Every procedural pattern is evaluated in the
// web game's own frame ("three space": Unity's world with x mirrored back), so
// dunes, strata, ripples and cracks land where they do in the browser.
#ifndef MEMENTO_COMMON_INCLUDED
#define MEMENTO_COMMON_INCLUDED

#define MODE_PLAIN 0
#define MODE_TERRAIN 1
#define MODE_STRATA 2
#define MODE_WATER 3

// the shared uniforms (materials.js sharedUniforms), set every frame by MementoLook.cs
float3 _SunDir;          // three space, towards the light
float _Toon;             // 0.5: the two-tone threshold
float _HatchOn;          // uHatch
float _HatchSpacing;     // px
float _PixelRatio;
float _ShadeStyle;       // 0 hatching, 1 stipple
float _Clouds;
float _CloudShadows;
float _FormHatch;
float _Dots;
float _MTime;
float4 _Wind;            // x, z downwind (three space), strength, gust
float4 _Brush;           // the traveller's feet (three space) and speed
float4 _MLights[8];      // local lights: xyz (three space), radius

inline float3 toThree(float3 p) { return float3(-p.x, p.y, p.z); }

float hash(float2 p) {
  p = frac(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return frac(p.x * p.y);
}
float2 hash2(float2 p) { return float2(hash(p), hash(p + 17.31)); }
float vnoise(float2 p) {
  float2 i = floor(p), f = frac(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return lerp(lerp(hash(i), hash(i + float2(1, 0)), u.x), lerp(hash(i + float2(0, 1)), hash(i + float2(1, 1)), u.x), u.y);
}
inline float gmod(float x, float y) { return x - y * floor(x / y); }
inline float2 gmod(float2 x, float y) { return x - y * floor(x / y); }

// ---------------------------------------------------------------- regions (biome.js)
float biomeField(float2 p) { return sin(p.x * 0.0021) * cos(p.y * 0.0017 - 0.7) + 0.5 * sin((p.x + p.y) * 0.0011); }
float2 biomeWeights(float2 p) { float f = biomeField(p); return float2(smoothstep(0.3, 0.6, f), smoothstep(-0.3, -0.6, f)); }
void biomeGround(float2 w, out float3 c1, out float3 c2, out float3 c3) {
  c1 = lerp(lerp(float3(0.937255, 0.823529, 0.607843), float3(0.917647, 0.717647, 0.619608), w.x), float3(0.921569, 0.901961, 0.847059), w.y);
  c2 = lerp(lerp(float3(0.960784, 0.882353, 0.713725), float3(0.952941, 0.803922, 0.721569), w.x), float3(0.964706, 0.949020, 0.909804), w.y);
  c3 = lerp(lerp(float3(0.862745, 0.647059, 0.478431), float3(0.788235, 0.513725, 0.435294), w.x), float3(0.725490, 0.713725, 0.776471), w.y);
}

// ---------------------------------------------------------------- strokes (materials.js)
float strokesLevel(float c, float fw, float s, float wob, float widthPx) {
  float v = c / s + wob;
  float f = fw / s;
  float d = abs(frac(v + 0.5) - 0.5);
  float hw = 0.5 * widthPx * f;
  return 1.0 - smoothstep(hw - 0.6 * f, hw + 0.6 * f, d);
}
float strokes(float2 ce, float fw, float spacingPx, float widthPx) {
  float lvl = log2(max(fw * spacingPx * _PixelRatio, 1e-5));
  float s0 = exp2(floor(lvl));
  float t = frac(lvl);
  float s1 = s0 * 2.0;
  widthPx *= _PixelRatio;
  float2 q = ce / s1;
  float wob = (vnoise(q * float2(0.3, 0.12)) - 0.5) * 0.3;
  float press = 0.75 + 0.5 * vnoise(q * float2(0.5, 0.6) + 31.0);
  float a = strokesLevel(ce.x, fw, s0, wob * 2.0, widthPx * press);
  float b = strokesLevel(ce.x, fw, s1, wob, widthPx * press);
  return lerp(a, b, t);
}
float blobs(float2 p, float2 fwp, float cell, float radius, float density, float seed) {
  float2 g = p / cell;
  float2 id = floor(g);
  float2 h = hash2(id + seed);
  float r = radius / cell * (0.55 + 0.9 * h.y);
  float2 c = 0.5 + (h - 0.5) * (0.9 - 2.0 * r);
  float2 d2 = (frac(g) - c) * float2(1.0, 1.0 + 0.8 * h.x);
  float d = length(d2) + (vnoise(p / radius * 1.4 + seed) - 0.5) * r * 0.9;
  float aa = max(fwp.x, fwp.y) / cell;
  float m = 1.0 - smoothstep(r - aa, r + aa, d);
  float present = step(hash(id + seed + 3.1), density);
  float vis = smoothstep(1.2, 2.5, radius / max(max(fwp.x, fwp.y), 1e-6) / _PixelRatio);
  return m * present * vis;
}
float stippleLevel(float2 ce, float2 fw, float s, float dark) {
  float2 g = ce / s;
  float2 cell = floor(g);
  float2 h = hash2(cell);
  float2 centre = 0.5 + (h - 0.5) * 0.55;
  float2 dpx = (frac(g) - centre) * s / max(fw, float2(1e-6, 1e-6));
  float r = lerp(0.7, 1.5, dark) * _PixelRatio * (0.7 + 0.6 * h.y);
  float present = step(hash(cell + 5.7), lerp(0.35, 1.0, dark));
  return (1.0 - smoothstep(r - 0.7, r + 0.7, length(dpx))) * present;
}
float stipple(float2 ce, float2 fw, float spacingPx, float dark) {
  float lvl = log2(max(max(fw.x, fw.y) * spacingPx * _PixelRatio, 1e-5));
  float s0 = exp2(floor(lvl));
  return lerp(stippleLevel(ce, fw, s0, dark), stippleLevel(ce, fw, s0 * 2.0, dark), frac(lvl));
}
float gridLines(float3 q, float3 fq, float3 w) {
  float3 d = abs(frac(q + 0.5) - 0.5) / max(fq, float3(1e-6, 1e-6, 1e-6));
  float3 res = 1.0 - smoothstep(0.07, 0.15, fq);
  float3 l = lerp(float3(0.1, 0.1, 0.1), 1.0 - smoothstep(0.4 * _PixelRatio, 0.4 * _PixelRatio + 1.0, d), res);
  return max(w.x * max(l.y, l.z), max(w.y * max(l.x, l.z), w.z * max(l.x, l.y)));
}
float inkLine(float distPx, float widthPx) {
  float w = widthPx * _PixelRatio * 0.5;
  return 1.0 - smoothstep(w - 0.6, w + 0.6, distPx);
}
float voronoiBorder(float2 x) {
  float2 n = floor(x), f = frac(x), mg = float2(0, 0), mr = float2(0, 0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      float2 g = float2(i, j);
      float2 r = g + hash2(n + g) - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
  md = 8.0;
  for (int j2 = -2; j2 <= 2; j2++)
    for (int i2 = -2; i2 <= 2; i2++) {
      float2 g = mg + float2(i2, j2);
      float2 r = g + hash2(n + g) - f;
      if (dot(mr - r, mr - r) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
    }
  return md;
}

float facade(float3 wp, float3 n, float3 nv, inout float3 alb) {
  float vert = 1.0 - smoothstep(0.25, 0.4, abs(n.y));
  float2 dirH = normalize(float2(-nv.z, nv.x) + 1e-5);
  float2 q = float2(dot(wp.xz, dirH), wp.y) / float2(3.0, 3.3);
  float2 gq = max(float2(length(float2(ddx(q.x), ddy(q.x))), length(float2(ddx(q.y), ddy(q.y)))), float2(1e-5, 1e-5));
  float2 id = floor(q), f = frac(q);
  float h = hash(id + 3.7), h2 = hash(id + 9.1);
  float cellPx = 1.0 / max(gq.x, gq.y);
  float lodInk = smoothstep(10.0, 20.0, cellPx), lodFill = smoothstep(5.0, 12.0, cellPx);
  float ink = inkLine(abs(f.y - 0.03) / gq.y, 0.8) * 0.6 * smoothstep(5.0, 10.0, 1.0 / gq.y);
  float win = step(0.22, h);
  float2 c = f - float2(0.5, 0.48), hf = float2(0.17, 0.22);
  float2 d2 = abs(c) - hf;
  float boxPx = max(d2.x / gq.x, d2.y / gq.y);
  if (h2 > 0.5 && c.y > hf.y - hf.x) {
    float2 ca = c - float2(0.0, hf.y - hf.x);
    float L = max(length(ca), 1e-5);
    boxPx = (L - hf.x) / max(length(ca / L * gq), 1e-6);
  }
  float glassK = (1.0 - smoothstep(-0.5, 0.5, boxPx)) * win;
  float shutK = (1.0 - smoothstep(-0.5, 0.5, max((abs(abs(c.x) - hf.x - 0.075) - 0.065) / gq.x, (abs(c.y) - hf.y) / gq.y))) * win * step(0.55, h2) * step(h2, 0.88);
  const float3 glass = float3(0.36, 0.43, 0.56);
  float3 shutter = h > 0.6 ? float3(0.37, 0.55, 0.5) : float3(0.36, 0.47, 0.62);
  float3 nearC = lerp(lerp(alb, glass, glassK), shutter, shutK);
  float3 farC = alb * 0.85 + glass * 0.12 + float3(0.365, 0.51, 0.56) * 0.03;
  alb = lerp(alb, lerp(farC, nearC, lodFill), vert);
  ink = max(ink, inkLine(abs(boxPx), 1.0) * win * lodInk);
  if (abs(c.x) < hf.x + 0.05) ink = max(ink, inkLine(abs(c.y + hf.y + 0.03) / gq.y, 1.3) * win * lodInk);
  return ink * vert;
}
float roofTiles(float3 wp) {
  float v = wp.y * 4.5, u = dot(wp.xz, float2(0.707, 0.707)) * 3.5;
  float fv = max(fwidth(v), 1e-5), fu = max(fwidth(u), 1e-5);
  float row = abs(frac(v + 0.5) - 0.5) / fv;
  float joint = abs(frac(u + floor(v) * 0.5 + 0.5) - 0.5) / fu;
  float res = 1.0 - smoothstep(0.1, 0.2, max(fv, fu));
  return lerp(0.12, max(inkLine(row, 0.8), inkLine(joint, 0.7) * 0.7), res);
}
float leaves(float3 op) {
  float2 q = float2(op.x + op.z * 0.6, op.y) * 2.6;
  float2 fq = max(fwidth(q), float2(1e-5, 1e-5));
  float2 id = floor(q), f = frac(q);
  float2 o = float2(hash(id), hash(id + 2.3)) * 0.3 - 0.15;
  float2 c = f - float2(0.5, 0.3) - o;
  float d = abs(length(c) - 0.3);
  return inkLine(d / max(fq.x, fq.y), 0.9) * step(0.0, c.y) * step(0.35, hash(id + 5.0)) * (1.0 - smoothstep(0.12, 0.3, max(fq.x, fq.y)));
}
float rockCracks(float3 op) {
  float2 q = (op.xy + op.zx * 0.6) * 0.9;
  float fwq = max(max(fwidth(q.x), fwidth(q.y)), 1e-5);
  float d = voronoiBorder(q) / fwq;
  float gaps = smoothstep(0.35, 0.55, vnoise(q * 2.3 + 11.0));
  return inkLine(d, 0.9) * gaps * (1.0 - smoothstep(0.08, 0.2, fwq));
}
float fissures(float2 q, float fwq) {
  float u = q.x / 9.0 + (vnoise(float2(q.y * 0.06, q.x * 0.05)) - 0.5) * 0.5;
  float d = abs(frac(u + 0.5) - 0.5) / max(fwq, 1e-6);
  float runs = smoothstep(0.5, 0.65, vnoise(float2(floor(u) * 3.7, q.y * 0.035)));
  return inkLine(d, 1.0) * runs * (1.0 - smoothstep(0.08, 0.2, fwq));
}
float glyphs(float2 g, float2 fw) {
  float2 cell = floor(g), f = frac(g) - 0.5;
  float h = hash(cell * 1.37 + 4.1);
  if (h > 0.45) return 0.0;
  float px = 1.0 / max(max(fw.x, fw.y), 1e-6);
  if (px < 14.0 * _PixelRatio) return 0.0;
  float bits = floor(hash(cell + 9.3) * 16.0);
  float m = 0.0;
  if (gmod(bits, 2.0) >= 1.0) m = max(m, inkLine(abs(length(f) - 0.26) * px, 1.2));
  if (gmod(floor(bits / 2.0), 2.0) >= 1.0) m = max(m, inkLine(max(abs(f.x), abs(f.y) - 0.34) * px, 1.2));
  if (gmod(floor(bits / 4.0), 2.0) >= 1.0) m = max(m, inkLine(max(abs(f.y - 0.12), abs(f.x) - 0.3) * px, 1.2));
  if (gmod(floor(bits / 8.0), 2.0) >= 1.0 || bits < 1.0) m = max(m, 1.0 - smoothstep(0.05 * px, 0.05 * px + 1.0, length(f - float2(0.0, -0.22)) * px));
  return m;
}
float grassTicks(float2 p, float2 fwp) {
  float cell = 1.4;
  float2 g = p / cell, id = floor(g);
  float2 h = hash2(id + 7.7);
  if (h.x > 0.42) return 0.0;
  float2 c = 0.25 + h * 0.5;
  float2 dir = normalize(float2(0.35 + 0.3 * h.y, 1.0));
  float2 q = frac(g) - c;
  float along = clamp(dot(q, dir), -0.13, 0.13);
  float d = length(q - dir * along) * cell / max(max(fwp.x, fwp.y), 1e-6);
  float vis = 1.0 - smoothstep(0.03, 0.08, max(fwp.x, fwp.y) / cell);
  return inkLine(d, 1.0) * vis;
}
float waterLines(float2 p, float t) {
  float2 q = p * 0.045 + float2(t * 0.03, t * 0.017);
  float f = vnoise(q) * 0.6 + vnoise(q * 2.3 - t * 0.04) * 0.4;
  float v = f * 9.0;
  float fw = fwidth(v);
  float d = abs(frac(v + 0.5) - 0.5) / max(fw, 1e-6);
  float broken = smoothstep(0.3, 0.55, vnoise(p * 0.08 + 31.0));
  return inkLine(d, 1.0) * broken * (1.0 - smoothstep(0.25, 0.5, fw));
}
float sandScuffs(float2 p) {
  float2 q = mul(p, float2x2(0.82, -0.57, 0.57, 0.82)) / 22.0;   // (GLSL mat2(a, b, c, d) * p)
  float2 cell = floor(q), local = frac(q) - (0.25 + hash2(cell + 11.0) * 0.5);
  float seed = hash(cell + 37.0);
  float halfLength = lerp(0.055, 0.18, hash(cell + 19.0));
  float bend = local.y - local.x * local.x * 0.5;
  float aa = max(fwidth(bend), 1e-5);
  float stroke = inkLine(abs(bend) / aa, 0.65);
  stroke *= 1.0 - smoothstep(halfLength * 0.6, halfLength, abs(local.x));
  float resolved = smoothstep(3.0, 7.0, halfLength * 2.0 / max(fwidth(q.x), 1e-5));
  float scuffPatch = smoothstep(0.40, 0.70, vnoise(p * 0.045 + 13.0));
  return stroke * step(0.65, seed) * scuffPatch * resolved * 0.55;
}

// ---------------------------------------------------------------- ground ink by distance (ground-ink.js)
float penLine(float dist, float g, float hw) {
  g = max(g, 1e-6);
  float hwPx = hw / g;
  float hwD = clamp(hwPx, 0.55, 0.85 * max(_PixelRatio, 1.0));
  return (1.0 - smoothstep(hwD - 0.6, hwD + 0.6, dist / g)) * min(hwPx / hwD, 1.0);
}
float resolvedAt(float pxPerPeriod) { return smoothstep(2.5, 5.0, pxPerPeriod); }
float lineField(float u, float g, float hw, float mask, float maskMean) {
  float res = resolvedAt(1.0 / max(g, 1e-6));
  float lines = res > 0.0 ? penLine(abs(frac(u + 0.5) - 0.5), g, hw) * mask : 0.0;
  return lerp(2.0 * hw * maskMean, lines, res);
}
float gradLen(float v) { return length(float2(ddx(v), ddy(v))); }
float sandRipples(float2 p, float slope) {
  const float2 across = float2(0.82, 0.57);
  float2 alongDir = float2(-across.y, across.x);
  float along = dot(p, alongDir);
  float u = dot(p, across) / 1.6 + (vnoise(p * 0.11) - 0.5) * 2.4 + (vnoise(p * 0.5) - 0.5) * 0.25;
  float gu = gradLen(u);
  float patchN = vnoise(p * 0.025 + 3.0);
  float patchMask = smoothstep(0.55, 0.7, patchN);
  float broken = smoothstep(0.35, 0.55, vnoise(float2(along * 0.35, floor(u) * 7.1)));
  float rip = lineField(u, gu, 0.01875, broken, 0.5) * patchMask * (1.0 - smoothstep(0.1, 0.25, slope));
  float w = dot(p, across) / 9.0 + (vnoise(p * 0.018 + 5.0) - 0.5) * 3.0;
  float gw = gradLen(w);
  float id = floor(w);
  float keep = step(0.55, hash(float2(id, 4.7))) * smoothstep(0.3, 0.5, vnoise(float2(along * 0.025, id * 3.1)));
  float wind = lineField(w, gw, 0.00889, keep, 0.25) * (1.0 - smoothstep(0.2, 0.38, slope)) * (1.0 - smoothstep(0.6, 0.8, patchN));
  return max(rip, wind * 0.85);
}
float sandGrains(float2 p, float gm, float density, float cell, float r0, float r1, float seed) {
  float2 g = p / cell, id = floor(g), h = hash2(id + seed);
  float r = r0 + (r1 - r0) * h.y;
  float d = length((frac(g) - (0.2 + 0.6 * h)) * cell);
  float rPx = r / gm, rD = max(rPx, 0.6);
  float res = smoothstep(3.0, 6.0, cell / gm);
  float dots = res > 0.0 ? (1.0 - smoothstep(rD - 0.5, rD + 0.5, d / gm)) * min(rPx * rPx / (rD * rD), 1.0) * step(hash(id + seed + 5.3), density) : 0.0;
  float meanR2 = (r0 * r0 + r0 * r1 + r1 * r1) / 3.0;
  return lerp(density * 3.14159 * meanR2 / (cell * cell), dots, res);
}
float voronoiEdge(float2 x, out float2 nb) {
  float2 n = floor(x), f = frac(x), mg = float2(0, 0), mr = float2(0, 0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      float2 g = float2(i, j);
      float2 r = g + hash2(n + g) - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
  md = 8.0; nb = float2(1.0, 0.0);
  for (int j2 = -2; j2 <= 2; j2++)
    for (int i2 = -2; i2 <= 2; i2++) {
      float2 g = mg + float2(i2, j2);
      float2 r = g + hash2(n + g) - f;
      if (dot(mr - r, mr - r) > 1e-5) {
        float2 e = normalize(r - mr);
        float d = dot(0.5 * (mr + r), e);
        if (d < md) { md = d; nb = e; }
      }
    }
  return md;
}
float2 crackCoord(float2 p, float cell) {
  return p / cell + (float2(vnoise(p * 0.7 * 5.5 / cell), vnoise(p * 0.7 * 5.5 / cell + 9.0)) - 0.5) * 0.12;
}
float crackNet(float2 q, float4 j, float hw, float gaps, float gapsMean, float fromPx) {
  float res = smoothstep(fromPx, fromPx * 2.0, 1.0 / max(max(length(j.xy), length(j.zw)), 1e-6));
  float lines = 0.0;
  if (res > 0.0) {
    float2 nb;
    float d = voronoiEdge(q, nb);
    float g = length(float2(dot(nb, j.xy), dot(nb, j.zw)));
    lines = penLine(d, g, hw) * gaps;
  }
  return lerp(2.0 * 2.0 * hw * gapsMean, lines, res);
}
float mudCracks(float2 p, float2 q1, float4 j1, float2 q2, float4 j2) {
  float gaps = smoothstep(0.25, 0.45, vnoise(p * 0.35 + 20.0));
  float big = crackNet(q1, j1, 0.00636, gaps, 0.6, 6.0);
  float small = crackNet(q2, j2, 0.0075, smoothstep(0.4, 0.6, vnoise(p * 0.9 + 3.0)), 0.5, 12.0);
  return max(big, small * 0.7);
}

// ---------------------------------------------------------------- cloud shadows
float cloudShadow(float3 wp) {
  if (_CloudShadows <= 0.0 || _Clouds <= 0.0) return 1.0;
  if (wp.y > 900.0) return 1.0;
  float2 onLayer = wp.xz + _SunDir.xz / max(_SunDir.y, 0.15) * (300.0 - wp.y);
  float2 q = onLayer / 260.0 + float2(_MTime * 0.012, _MTime * 0.003);
  float f = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { f += a * vnoise(q); q = q * 2.03 + 17.1; a *= 0.5; }
  float th = lerp(0.75, 0.52, _Clouds);
  return 1.0 - smoothstep(th - 0.015, th + 0.015, f) * _CloudShadows;
}
#endif
