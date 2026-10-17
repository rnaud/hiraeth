// The web's newer surface marks (src/materials.js, src/ground-ink.js), for Hiraeth/Surface: house fronts with
// lit windows at night and cracked corners (facade), weathering (grime streaks, chips with their lip's shadow,
// cracks with a shadow side: weatherInk), pen detail at every scale (built seams, joints, vents, plates, bolts;
// organic grain: detailLod), colour across a wall (wallPatch), plating (plateLines) and the print look's
// pebbles and stones on the sand (pebbleField). All in three's space (positions mirrored back: toThree), the
// constants the web's (WEATHER, DETAIL, PATCH, PEBBLES), so the port draws the same marks in the same places.
#ifndef HIRAETH_MARKS_INCLUDED
#define HIRAETH_MARKS_INCLUDED

#ifndef HIRAETH_PER_MATERIAL   // (in Surface.shader's UnityPerMaterial buffer there: the SRP Batcher's)
float _Weather;        // materials.js uWeather (0..1)
float4 _Detail;        // uDetail: kind (0 none, 1 built, 2 organic), density
float _Patch;          // uPatch: colour across a wall (0..1.5)
float _Plates;         // uPlates
float _Windows;        // uWindows: the share of a façade's cells with a window (0.78)
#endif
float _WearLite;       // the handheld's lighter weathering (global)
float _Night;          // (global: the composite's too)

// ---------------------------------------------------------------- house fronts (materials.js facade)
float facadeMarks(float3 wp, float3 n, float3 nv, inout float3 alb, out float emit)
{
  float vert = 1.0 - smoothstep(0.25, 0.4, abs(n.y));
  float2 dirH = normalize(float2(-nv.z, nv.x) + 1e-5);
  float2 q = float2(dot(wp.xz, dirH), wp.y) / float2(3.0, 3.3);
  float2 gq = max(float2(length(float2(ddx(q.x), ddy(q.x))), length(float2(ddx(q.y), ddy(q.y)))), float2(1e-5, 1e-5));
  float2 id = floor(q), f = frac(q);
  float h = hash(id + 3.7), h2 = hash(id + 9.1);
  float cellPx = 1.0 / max(gq.x, gq.y);
  float lodInk = smoothstep(10.0, 20.0, cellPx), lodFill = smoothstep(5.0, 12.0, cellPx);
  float ink = inkLine(abs(f.y - 0.03) / gq.y, 0.8) * 0.6 * smoothstep(5.0, 10.0, 1.0 / gq.y);
  float windows = _Windows > 0.0 ? _Windows : 0.78;
  float win = step(1.0 - windows, h);
  float2 c = f - float2(0.5, 0.48), hf = float2(0.17, 0.22);
  float2 d2 = abs(c) - hf;
  float boxPx = max(d2.x / gq.x, d2.y / gq.y);
  if (h2 > 0.5 && c.y > hf.y - hf.x)
  {
    float2 ca = c - float2(0.0, hf.y - hf.x);
    float L = max(length(ca), 1e-5);
    boxPx = (L - hf.x) / max(length(ca / L * gq), 1e-6);
  }
  float glassK = (1.0 - smoothstep(-0.5, 0.5, boxPx)) * win;
  float shutK = (1.0 - smoothstep(-0.5, 0.5, max((abs(abs(c.x) - hf.x - 0.075) - 0.065) / gq.x, (abs(c.y) - hf.y) / gq.y))) * win * step(0.55, h2) * step(h2, 0.88);
  const float3 glass = float3(0.36, 0.43, 0.56);
  float3 shutter = h > 0.6 ? float3(0.37, 0.55, 0.5) : float3(0.36, 0.47, 0.62);
  // at night some windows light up, one after another as it gets dark (warm lamplight: they glow)
  float h3 = hash(id + 13.7);
  float on = step(h3, 0.42) * smoothstep(0.15 + h3, 0.4 + h3, _Night);
  const float3 lamp = float3(1.0, 0.84, 0.5);
  float3 nearC = lerp(lerp(alb, lerp(glass, lamp, on), glassK), shutter, shutK);
  float wk = windows / 0.78;
  float3 farC = alb * (1.0 - 0.15 * wk) + (glass * 0.12 + float3(0.365, 0.51, 0.56) * 0.03) * wk;
  farC = lerp(farC, farC * 0.8 + lamp * 0.2, _Night * 0.6);
  alb = lerp(alb, lerp(farC, nearC, lodFill), vert);
  emit = glassK * on * lodFill * vert * (1.0 - shutK);
  ink = max(ink, inkLine(abs(boxPx), 1.0) * win * lodInk);
  if (_Weather > 0.0)
  {
    // weathered: a crack running out from a corner of the odd window, jagged, thinning
    float hc = hash(id + 21.7);
    if (hc < 0.38 * _Weather && lodInk > 0.0)
    {
      float2 sgn = float2(hc < 0.19 * _Weather ? 1.0 : -1.0, hash(id + 4.9) > 0.5 ? 1.0 : -1.0);
      float2 a = hf * sgn, b = a + float2(0.1 + 0.12 * hash(id + 6.1), 0.16 + 0.14 * hash(id + 7.3)) * sgn;
      float2 ab = b - a, pa = c - a;
      float tt = clamp(dot(pa, ab) / dot(ab, ab), 0.0, 1.0);
      float2 off = pa - ab * tt + float2(-ab.y, ab.x) / length(ab) * (vnoise(float2(tt * 9.0, hc * 40.0)) - 0.5) * 0.035;
      float dpx = length(off / gq);
      ink = max(ink, inkLine(dpx, lerp(0.9, 0.35, tt)) * win * lodInk * step(dot(pa, ab), dot(ab, ab)));
    }
  }
  if (abs(c.x) < hf.x + 0.05) ink = max(ink, inkLine(abs(c.y + hf.y + 0.03) / gq.y, 1.3) * win * lodInk);
  return ink * vert;
}

// ---------------------------------------------------------------- colour across a wall (materials.js PATCH)
static const float3 PATCH_LA = float3(17.3, 3.3, 17.3);
static const float3 PATCH_LB = float3(6.4, 3.3, 6.4);
static const float3 PATCH_O = float3(0.371, 0.173, 0.619);
float3 patchA(float3 p, float3 nv, float k)
{
  const float T = 0.13;
  float3 qa = p + PATCH_O * PATCH_LA;
  float2 bld = floor(qa.xz / PATCH_LA.xz);
  float4 fw = max(float4(nv.x, -nv.x, nv.z, -nv.z), 0.0);
  fw *= fw; fw *= fw;
  float hf = hash(bld + 1.13);
  float4 ft = frac(hf * float4(1.0, 7.31, 13.7, 29.3)) - 0.5;
  float3 m = (1.0 + dot(fw, ft) / max(dot(fw, float4(1, 1, 1, 1)), 1e-4) * 0.12).xxx;
  float row = floor(qa.y / PATCH_LA.y);
  float hb = frac(hash(float2(row * 3.7, 9.1) + hf * 61.0) + hf * 3.1);
  if (hb < 0.09 * k) m *= hb < 0.045 * k ? float3(1.0 + T * 0.6, 1.0 + T * 0.3, 1.0 - T * 0.2) : (1.0 - T * 0.7).xxx;
  return m;
}
float3 patchB(float3 p, float k)
{
  const float T = 0.13;
  float3 c = floor((p + PATCH_O * PATCH_LB) / PATCH_LB);
  float hc = hash(c.xz + 7.7);
  float span = 1.0 + floor(hc * 3.0);
  float cy = floor((c.y + floor(frac(hc * 7.3) * 3.0)) / span);
  float hp = hash(float2(c.x + cy * 31.7, c.z - cy * 17.3) + 0.53);
  if (hp >= 0.22 * k) return float3(1, 1, 1);
  float t = frac(hp * 97.31 / max(0.22 * k, 1e-3));
  return t < 0.3 ? (1.0 + T).xxx : t < 0.55 ? (1.0 - T).xxx : t < 0.8 ? float3(1.0 + T * 0.7, 1.0 + T * 0.1, 1.0 - T * 0.6) : float3(1.0 - T * 0.6, 1.0 - T * 0.05, 1.0 + T * 0.6);
}
float3 wallPatch(float3 p, float3 nv, float k, float3 pfw)
{
  float3 mA = patchA(p, nv, k), mB = patchB(p, k);
  float3 fa = frac((p + PATCH_O * PATCH_LA) / PATCH_LA), fb = frac((p + PATCH_O * PATCH_LB) / PATCH_LB);
  float3 ga = min(fa, 1.0 - fa) * PATCH_LA / max(pfw, 1e-6), gb = min(fb, 1.0 - fb) * PATCH_LB / max(pfw, 1e-6);
  float3 g = min(ga, gb);
  float dpx = min(g.x, min(g.y, g.z)), R = 1.8 * _PixelRatio;
  if (dpx < R)
  {
    float3 e = g.x <= dpx ? float3(1, 0, 0) : g.y <= dpx ? float3(0, 1, 0) : float3(0, 0, 1);
    bool coarse = dot(e, ga) <= dot(e, gb);
    float3 f = coarse ? fa : fb, L = coarse ? PATCH_LA : PATCH_LB;
    float fe = dot(e, f);
    float3 pn = p + e * (fe < 0.5 ? -1.0 : 1.0) * (min(fe, 1.0 - fe) + 0.5) * dot(e, L);
    float t = saturate(dpx / R);
    float3 mBn = patchB(pn, k);
    if (coarse) mA = lerp(0.5 * (mA + patchA(pn, nv, k)), mA, t);
    mB = lerp(0.5 * (mB + mBn), mB, t);
  }
  return mA * mB;
}

// ---------------------------------------------------------------- the makers' inscriptions (src/glyphs.js GLYPH_GLSL)
// Laid out like an inscription: each row of the wall's grid a frieze between two incised border lines, a row of signs with
// the makers' mark opening every sixth; on odd rows a cell now and then a seal (a framed panel with the mark, big). Carved,
// not drawn: each stroke a groove, the rim on the light's side shading into it. Only while a groove is ~1.5 px wide.
float glyphHash(float a) { a = gmod(a, 89.0); return gmod(a * a * 13.0 + a * 7.0 + 3.0, 61.0) / 61.0; }
float gSeg(float2 p, float2 a, float2 b) { float2 pa = p - a, ba = b - a; float h = saturate(dot(pa, ba) / max(dot(ba, ba), 1e-8)); return length(pa - ba * h); }
float gRing(float2 q, float2 c, float r) { return abs(length(q - c) - r); }
float gArc(float2 q, float2 c, float r) { float2 d = q - c; return d.y >= 0.0 ? abs(length(d) - r) : length(float2(abs(d.x) - r, d.y)); }
float gDot(float2 q, float2 c, float r) { return max(length(q - c) - r, 0.0); }
float gDiamond(float2 q, float a, float b) { float2 p = abs(q); return (p.x / a + p.y / b - 1.0) / sqrt(1.0 / (a * a) + 1.0 / (b * b)); }
float glyphSignD(float2 q, float k)
{
  if (k < 0.5) return min(gSeg(q, float2(-0.12, -0.29), float2(-0.12, 0.29)), min(gSeg(q, float2(-0.12, 0.29), float2(0.15, 0.29)), gSeg(q, float2(0.13, -0.29), float2(0.13, 0.02))));
  if (k < 1.5) return min(gRing(q, 0.0, 0.25), gDot(q, 0.0, 0.05));
  if (k < 2.5) return min(gRing(q, float2(-0.1, 0.0), 0.19), gRing(q, float2(0.1, 0.0), 0.19));
  if (k < 3.5) return abs(min(gDiamond(q, 0.1, 0.36), gDiamond(q, 0.36, 0.1)));
  if (k < 4.5) return min(gSeg(q, float2(0.0, -0.32), float2(0.0, 0.1)), gArc(q, float2(0.0, 0.1), 0.17));
  if (k < 5.5) return min(gSeg(q, float2(-0.26, -0.16), float2(0.26, -0.16)), min(gDot(q, float2(-0.19, 0.12), 0.05), min(gDot(q, float2(0.0, 0.12), 0.05), gDot(q, float2(0.19, 0.12), 0.05))));
  if (k < 6.5) return min(gArc(q, float2(0.0, -0.3), 0.3), gArc(q, float2(0.0, -0.3), 0.15));
  return min(min(gRing(q, float2(0.0, 0.15), 0.12), gSeg(q, float2(-0.24, -0.28), float2(0.24, -0.28))), gSeg(q, float2(0.0, 0.03), float2(0.0, -0.28)));
}
float inscriptionD(float2 g, out float unit)
{
  float r = floor(g.y), fy = frac(g.y), c = floor(g.x);
  unit = 0.36;
  if (gmod(r, 2.0) < 0.5 || glyphHash(c * 3.0 + r * 11.0 + 5.0) > 0.16)
  {
    float by = (fy - 0.5) / unit;
    float border = min(abs(by - 0.62), abs(by + 0.62));
    float bx = g.x / (unit * 0.82), j = floor(bx);
    float2 q = float2((frac(bx) - 0.5) * 0.82, by);
    float k = gmod(j, 6.0) < 0.5 ? 0.0 : 1.0 + floor(glyphHash(j + r * 31.0) * 7.0);
    return min(abs(by) < 0.5 ? glyphSignD(q, k) : 1e3, border);
  }
  unit = 0.7;
  float2 q = (frac(g) - 0.5) / unit;
  return min(glyphSignD(q, 0.0), abs(max(abs(q.x), abs(q.y)) - 0.6));
}
// x the groove, y the part of it in the rim's shadow, z a fine outline round the cut; fw the cells' screen footprint
float3 glyphCarve(float2 g, float2 fw)
{
  float px = 1.0 / max(max(fw.x, fw.y), 1e-6);
  float unit;
  float d = inscriptionD(g, unit);
  float upx = unit * px;
  const float w = 0.066;
  float vis = smoothstep(1.1, 2.2, 2.0 * w * upx / max(_PixelRatio, 1.0));
  if (vis <= 0.0 || d > w * 4.0) return 0.0;
  float aa = 0.7 / upx;
  float groove = 1.0 - smoothstep(w - aa, w + aa, d);
  float u2;
  float dl = inscriptionD(g + float2(-0.45, 1.0) * (w * 1.3 * unit), u2);
  float shade = groove * smoothstep(w - aa, w + aa, dl);
  float edge = inkLine(abs(d - w) * upx, 0.75) * (1.0 - shade);
  return float3(groove, shade, edge) * vis;
}

// ---------------------------------------------------------------- weathering (materials.js weatherInk, WEATHER)
// Old walls, lived in: in cells of the wall anchored in the world, the odd hairline crack, jagged, thinning to its ends,
// a branch or two, a faint pen line with a shaded lip away from the sun and a lit one toward it (the web's since v1.73:
// the grime streaks and plaster chips that were here drew dark drips down Vael's walls, issue #264). A crack is drawn
// whole or not at all: none whose points land in a facade's window (wallOpenAt; the web also keeps them off the pieces
// fixed on a wall, src/wall-openings.js, a table the bridge doesn't carry yet). q: (along the wall, up) in metres, fq:
// metres per px of each; wp the pixel (world), alongW the world step for a metre of q.x along the wall, nv the normal.
bool wallOpenAt(float3 p, float3 nv, bool facade, float windows)
{
  if (!facade) return false;
  float2 dirH = normalize(float2(-nv.z, nv.x) + 1e-5);
  float2 fc = float2(dot(p.xz, dirH), p.y) / float2(3.0, 3.3);
  float2 c = frac(fc) - float2(0.5, 0.48);
  return hash(floor(fc) + 3.7) >= 1.0 - windows && abs(c.x) < 0.31 + 0.25 / 3.0 && abs(c.y) < 0.25 + 0.25 / 3.3;
}
// a crack's line s metres along it: its offset along the wall and its slope (two polylines over a lean: jagged, not wavy)
float2 crackLine(float s, float lean, float sd)
{
  float u = s / 0.19, i = floor(u), f = u - i;
  float a = hash(float2(i, sd)) - 0.5, b = hash(float2(i + 1.0, sd)) - 0.5;
  float U = s / 0.75, I = floor(U), F = U - I;
  float A = hash(float2(I, sd + 17.0)) - 0.5, B = hash(float2(I + 1.0, sd + 17.0)) - 0.5;
  return float2(lean * s + lerp(a, b, f) * 0.05 + lerp(A, B, F) * 0.26, lean + (b - a) * 0.05 / 0.19 + (B - A) * 0.26 / 0.75);
}
float weatherInk(float2 q, float2 fq, float2 sun2, float litK, float seed, float k, float3 wp, float3 alongW, float3 nv, bool facade, float windows, inout float3 alb)
{
  float fm = max(fq.x, fq.y);
  float resolved = 1.0 - smoothstep(0.03, 0.075, fm);
  if (resolved <= 0.0 || k <= 0.0) return 0.0;
  const float2 cellS = float2(3.7, 3.1);
  float2 cell = floor(q / cellS), id = cell + seed;
  if (hash(id + 41.0) > 0.45 * k) return 0.0;
  float len = cellS.y * (0.3 + 0.45 * hash(id + 8.8));
  float yb = cell.y * cellS.y + (cellS.y - len) * hash(id + 2.2);
  bool down = hash(id + 6.4) > 0.45;
  float sAlong = down ? yb + len - q.y : q.y - yb, t = sAlong / len;
  if (t < 0.0 || t > 1.0) return 0.0;
  float x0 = (cell.x + 0.3 + 0.4 * hash(id + 3.3)) * cellS.x;
  float lean = (hash(id + 5.1) - 0.5) * 0.5, sd = id.x * 7.0 + id.y * 13.0;
  float2 L = crackLine(sAlong, lean, sd);
  float px = _PixelRatio;
  float wPx = lerp(1.1, 0.4, t) * smoothstep(0.0, 0.06, t);
  float dPx = (q.x - x0 - L.x) / length(float2(fq.x, L.y * fq.y));
  float fade = 1.0 - smoothstep(0.75, 1.0, t);
  float tb = 0.22 + 0.25 * hash(id + 9.4), bLen = len * (0.18 + 0.2 * hash(id + 4.6)), side = hash(id + 6.6) > 0.5 ? 1.0 : -1.0;
  float dB = 1e3, wB = 0.0, fB = 0.0;
  float2 bEnd = 0.0, b2End = 0.0;
  bool hasB = hash(id + 1.9) < 0.6, hasB2 = hasB && hash(id + 7.7) < 0.3;
  if (hasB)
  {
    float2 Lb = crackLine(tb * len, lean, sd);
    float sb = sAlong - tb * len, bs = side * (0.55 + 0.4 * hash(id + 2.9));
    bEnd = float2(x0 + Lb.x + bs * bLen, down ? yb + len - tb * len - bLen : yb + tb * len + bLen);
    if (sb > 0.0 && sb < bLen)
    {
      float2 Bl = crackLine(sb, bs, sd + 31.0);
      dB = (q.x - x0 - Lb.x - Bl.x) / length(float2(fq.x, Bl.y * fq.y));
      wB = lerp(0.65, 0.25, sb / bLen); fB = 1.0 - smoothstep(0.6, 1.0, sb / bLen);
    }
    if (hasB2)
    {
      float tb2 = tb + 0.3, sb2 = sAlong - tb2 * len, bs2 = -bs * 0.8, bLen2 = bLen * 0.7;
      float2 Lb2 = crackLine(tb2 * len, lean, sd);
      b2End = float2(x0 + Lb2.x + bs2 * bLen2, down ? yb + len - tb2 * len - bLen2 : yb + tb2 * len + bLen2);
      if (sb2 > 0.0 && sb2 < bLen2 && abs(dB) > 1e2)
      {
        float2 Bl2 = crackLine(sb2, bs2, sd + 47.0);
        dB = (q.x - x0 - Lb2.x - Bl2.x) / length(float2(fq.x, Bl2.y * fq.y));
        wB = lerp(0.55, 0.22, sb2 / bLen2); fB = 1.0 - smoothstep(0.6, 1.0, sb2 / bLen2);
      }
    }
  }
  if (min(abs(dPx), abs(dB)) > 3.5 * px) return 0.0;
  // whole or not at all: its points along it, its branches' ends and this pixel, clear of every window
  if (facade)
  {
    [unroll] for (int j = 0; j < 5; j++)
    {
      float s = len * (float)j / 4.0;
      float2 Ls = crackLine(s, lean, sd);
      if (wallOpenAt(wp + alongW * (x0 + Ls.x - q.x) + float3(0.0, (down ? yb + len - s : yb + s) - q.y, 0.0), nv, facade, windows)) return 0.0;
    }
    if (hasB && wallOpenAt(wp + alongW * (bEnd.x - q.x) + float3(0.0, bEnd.y - q.y, 0.0), nv, facade, windows)) return 0.0;
    if (hasB2 && wallOpenAt(wp + alongW * (b2End.x - q.x) + float3(0.0, b2End.y - q.y, 0.0), nv, facade, windows)) return 0.0;
    if (wallOpenAt(wp, nv, facade, windows)) return 0.0;
  }
  float ink = max(inkLine(abs(dPx), wPx) * fade, inkLine(abs(dB), wB) * fB);
  if (_WearLite < 0.5 && litK > 0.0)
  {
    float sunS = -sign(sun2.x + 1e-4), sA = dPx * sunS, hw = wPx * 0.5 * px;
    float lipK = fade * litK * smoothstep(0.25, 0.6, wPx);
    float aL = max(length(alb), 0.1);
    float dk = smoothstep(hw - 0.5, hw + 0.5, sA) * (1.0 - smoothstep(hw + 0.9 * px, hw + 1.9 * px, sA)) * min(0.12, 0.06 / aL);
    float lt = smoothstep(hw - 0.5, hw + 0.5, -sA) * (1.0 - smoothstep(hw + 0.7 * px, hw + 1.5 * px, -sA)) * min(0.06, 0.06 / aL);
    alb *= 1.0 + (lt - dk) * lipK * resolved;
  }
  return ink * resolved * 0.8;
}

// ---------------------------------------------------------------- pen detail (materials.js DETAIL)
float boxEdge(float2 p, float2 h) { float2 d = abs(p) - h; return abs(length(max(d, 0.0)) + min(max(d.x, d.y), 0.0)); }
float builtDetail(float2 q, float2 fq, float k, float seed)
{
  float fm = max(fq.x, fq.y);
  float rA = 1.0 - smoothstep(0.03, 0.07, fm);
  if (rA <= 0.0) return 0.0;
  const float2 cA = float2(2.6, 1.9);
  float ink = 0.0;
  float row = floor(q.y / cA.y);
  float yLine = (row + 0.35 * (hash(float2(row, seed)) - 0.5)) * cA.y;
  float rowB = q.y < yLine ? row - 1.0 : row;
  float yB = (rowB + 0.35 * (hash(float2(rowB, seed)) - 0.5)) * cA.y;
  float yT = (rowB + 1.0 + 0.35 * (hash(float2(rowB + 1.0, seed)) - 0.5)) * cA.y;
  float seamOn = step(hash(float2(rowB, seed + 3.1)), 0.72 * k) * smoothstep(0.3, 0.42, vnoise(float2(q.x * 0.45, rowB * 7.0 + seed)));
  ink = max(ink, inkLine(abs(q.y - yB) / max(fq.y, 1e-5), 1.0) * seamOn);
  float off = hash(float2(rowB, seed + 5.7));
  float col = floor(q.x / cA.x + off);
  float xJ = (col - off) * cA.x, xJ2 = xJ + cA.x;
  float jOn = step(hash(float2(col, rowB + seed)), 0.55 * k);
  ink = max(ink, inkLine(abs(q.x - xJ) / max(fq.x, 1e-5), 0.9) * jOn);
  float2 id = float2(col, rowB) + seed;
  float hr = hash(id + 0.31);
  if (hr < 0.48 * k)
  {
    float2 c = float2(lerp(xJ, xJ2, 0.25 + 0.5 * hash(id + 1.7)), lerp(yB, yT, 0.3 + 0.4 * hash(id + 2.3)));
    float2 hsz = float2(cA.x * (0.08 + 0.17 * hash(id + 3.9)), (yT - yB) * (0.07 + 0.16 * hash(id + 4.4)));
    float2 p = q - c;
    ink = max(ink, inkLine(boxEdge(p, hsz) / max(fm, 1e-5), 1.0));
    if (hash(id + 6.2) < 0.45 && all(abs(p) < hsz))
    {
      float sl = 0.09, d = abs(frac(p.y / sl + 0.5) - 0.5) * sl;
      ink = max(ink, inkLine(d / max(fq.y, 1e-5), 0.6) * (1.0 - smoothstep(0.012, 0.025, fq.y)));
    }
  }
  ink *= rA;
  float rF = 1.0 - smoothstep(0.008, 0.018, fm);
  if (rF > 0.0 && _WearLite < 0.5)
  {
    const float2 cF = float2(0.75, 0.55);
    float2 fid = floor(q / cF) + seed * 1.7;
    if (hash(fid + 9.1) < 0.35 * k)
    {
      float2 fc = (floor(q / cF) + float2(0.2 + 0.6 * hash(fid + 2.0), 0.25 + 0.5 * hash(fid + 4.0))) * cF;
      float2 fh = cF * float2(0.08 + 0.18 * hash(fid + 5.0), 0.06 + 0.14 * hash(fid + 6.0));
      ink = max(ink, inkLine(boxEdge(q - fc, fh) / max(fm, 1e-5), 0.6) * rF);
    }
    float2 bp = float2(q.x - xJ, q.y - yB - 0.12);
    float bolt = (1.0 - smoothstep(0.025, 0.035, length(float2(abs(bp.x) - 0.12, bp.y)))) * jOn * seamOn;
    ink = max(ink, bolt * rF);
  }
  return ink;
}
float grainLevel(float2 q, float2 fq, float2 cell, float share, float k, float seed, float w)
{
  float2 id = float2(floor(q.x / cell.x), 0.0);
  float off = hash(float2(id.x, seed + 1.3));
  id.y = floor(q.y / cell.y + off);
  float2 cid = id + seed;
  if (hash(cid + 0.9) > share * k) return 0.0;
  float y0 = (id.y - off) * cell.y, len = cell.y * (0.45 + 0.5 * hash(cid + 2.1));
  float t = (q.y - y0 - cell.y * 0.1) / len;
  if (t < 0.0 || t > 1.0) return 0.0;
  float x = (id.x + 0.2 + 0.6 * hash(cid + 3.3)) * cell.x + (hash(cid + 4.7) - 0.5) * 0.25 * (q.y - y0) + (vnoise(float2(q.y * 2.0, cid.x)) - 0.5) * cell.x * 0.25;
  return inkLine(abs(q.x - x) / max(fq.x, 1e-5), w * sin(3.14159 * t));
}
float grainDetail(float2 q, float2 fq, float k, float seed)
{
  return grainLevel(q, fq, float2(0.1, 0.26), 0.55 * (_WearLite > 0.5 ? 0.5 : 1.0), k, seed, 0.9);
}
float detailLod(float2 q, float2 fq, float k, float seed, bool organic)
{
  float fm = max(max(fq.x, fq.y), 1e-6);
  float lv = max(log2(fm / (organic ? 0.006 : 0.015)), 0.0);
  float li = floor(lv), a = smoothstep(0.5, 1.0, lv - li);
  float keep = 1.0 - smoothstep(3.0, 4.0, lv);
  if (keep <= 0.0) return 0.0;
  float L = exp2(li);
  float ink = (organic ? grainDetail(q / L, fq / L, k, seed + li * 7.0) : builtDetail(q / L, fq / L, k, seed + li * 7.0)) * (1.0 - a);
  if (a > 0.0) ink = max(ink, (organic ? grainDetail(q / (2.0 * L), fq / (2.0 * L), k, seed + li * 7.0 + 7.0) : builtDetail(q / (2.0 * L), fq / (2.0 * L), k, seed + li * 7.0 + 7.0)) * a);
  return ink * keep;
}

// ---------------------------------------------------------------- plating (materials.js plateLines)
float plates2(float2 q, float2 fq, float seed, out float tone)
{
  float row = floor(q.y), hr = hash(float2(row, seed));
  float k = 0.55 + 0.9 * hr;
  float u = q.x * k + hr * 13.0, col = floor(u);
  tone = hash(float2(col, row + seed * 3.1)) - 0.5;
  float du = abs(frac(u + 0.5) - 0.5) / max(fq.x * k, 1e-6), dv = abs(frac(q.y + 0.5) - 0.5) / max(fq.y, 1e-6);
  float w = 0.4 * _PixelRatio;
  float joint = (1.0 - smoothstep(w, w + 1.0, du)) * step(0.2, hash(float2(floor(u + 0.5), row) + 5.3));
  float seam = (1.0 - smoothstep(w, w + 1.0, dv)) * step(0.25, hash(float2(floor(u * 0.5), floor(q.y + 0.5)) + 9.1));
  float res = 1.0 - smoothstep(0.07, 0.15, max(fq.x, fq.y));
  return lerp(0.08, max(joint, seam), res);
}
float plateLines(float3 q, float3 fq, float3 w, out float tone)
{
  float tx = 0.0, ty = 0.0, tz = 0.0, l = 0.0;
  if (w.x > 0.05) l = max(l, w.x * plates2(q.zy, fq.zy, 1.0, tx));
  if (w.y > 0.05) l = max(l, w.y * plates2(q.xz, fq.xz, 2.0, ty));
  if (w.z > 0.05) l = max(l, w.z * plates2(q.xy, fq.xy, 3.0, tz));
  tone = w.x * tx + w.y * ty + w.z * tz;
  return l;
}

// ---------------------------------------------------------------- the print look's pebbles (ground-ink.js PEBBLES)
float pebbleShadow(float y)
{
  float s = max(y, 0.05);
  return clamp(1.1 * sqrt(max(1.0 - s * s, 0.0)) / s, 0.6, 3.0);
}
float pebbleInk(float2 d, float r, float len, float gm, float castK)
{
  float k = max(1.0, 1.0 * gm / r), rD = r * k, amt = 1.0 / (k * k);
  float aa = gm / rD;
  float bodyR = length(float2(d.x, d.y / 0.72)) / rD;
  float inBody = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, bodyR);
  float darkSide = inBody * (1.0 - smoothstep(-0.35, 0.25, d.x / rD));
  float L = len * rD;
  float sl = length(float2((d.x + 0.5 * L) / (0.5 * L + 0.6 * rD), d.y / (0.8 * rD * 0.72)));
  float aaS = gm / (0.8 * rD * 0.72);
  float inShadow = (1.0 - smoothstep(1.0 - aaS, 1.0 + aaS, sl)) * (1.0 - inBody) * castK;
  float rimK = smoothstep(3.0, 6.0, r / gm);
  float rim = rimK * (1.0 - smoothstep(0.5, 1.2, abs(bodyR - 1.0) * rD / gm)) * smoothstep(-0.2, 0.2, d.x / rD);
  return max(max(darkSide * 1.15, inShadow * 1.0), rim * 0.75) * amt;
}
float pebbleField(float2 p, float gm, float2 s2, float len, float castK, float cell, float density, float2 rr, float seed)
{
  float res = smoothstep(3.0, 6.0, cell / gm);
  float dr = rr.y - rr.x, r2m = rr.x * rr.x + 2.0 * rr.x * dr / 3.0 + dr * dr / 5.0;
  float sq = 0.72;
  float tone = density * 3.14159 * r2m * (0.5 * sq * 1.15 + (0.5 * len + 0.6) * 0.8 * sq * 1.0 * castK) / (cell * cell);
  float ink = 0.0;
  if (res > 0.0)
  {
    float2 id = floor(p / cell), h = hash2(id + seed);
    if (hash(id + seed + 5.3) < density)
    {
      float r = lerp(rr.x, rr.y, h.y * h.y);
      float2 perp = float2(-s2.y, s2.x);
      float ext = 0.5 * len * r + 1.6 * r, room = max(0.5 * cell - ext, 0.0);
      float2 c = (id + 0.5) * cell + s2 * (0.5 * len * r) + (float2(hash(id + seed + 2.1), hash(id + seed + 8.3)) - 0.5) * 2.0 * room;
      float2 d = p - c;
      ink = pebbleInk(float2(dot(d, s2), dot(d, perp)), r, len, gm, castK);
    }
  }
  return lerp(tone, ink, res);
}

// ---------------------------------------------------------------- hatching that follows the form (materials.js FORM)
float formLevel(float c, float fw, float s, float sRef, float period, float widthPx, float2 nq, float depth)
{
  float k = floor(c / s + 0.5), id = fmod(k * s, period);
  float h = hash(float2(id, 7.31));
  float wob = h - 0.5, wk = _WearLite > 0.5 ? 0.0 : 1.0 - smoothstep(67.5, 90.0, depth);
  if (wk > 0.0) wob = lerp(wob, vnoise(nq + float2(id * 0.37, h * 19.0)) - 0.5, wk);
  wob *= 0.22;
  float f = fw / s;
  float d = abs(c - k * s - wob * sRef) / s;
  float hw = 0.5 * widthPx * (0.75 + 0.5 * h) * f;
  float ln = 1.0 - smoothstep(hw - 0.6 * f, hw + 0.6 * f, d);
  return lerp(ln, min(2.0 * hw, 1.0), smoothstep(0.25, 0.45, f));
}
float formLines(float c, float fw, float period, float spacingPx, float widthPx, float2 nq, float depth)
{
  float lvl = log2(max(fw * spacingPx * _PixelRatio, 1e-6));
  float top = log2(period) - 1.0;
  float keep = 1.0 - smoothstep(top - 1.0, top, lvl);
  if (keep <= 0.0) return 0.0;
  float s0 = exp2(floor(lvl));
  widthPx *= _PixelRatio;
  float a = formLevel(c, fw, s0, s0, period, widthPx, nq, depth);
  float b = formLevel(c, fw, s0 * 2.0, s0, period, widthPx, nq, depth);
  return lerp(a, b, frac(lvl)) * keep;
}
float veinLevel(float c, float fw, float s, float sRef, float widthPx, float2 nq)
{
  float k = floor(c / s + 0.5), id = fmod(k * s, 1024.0);
  float h = hash(float2(id, 3.17)), rank = 0.0, kk = abs(k);
  [unroll] for (int i = 0; i < 3; i++) { if (fmod(kk, 2.0) > 0.5) break; rank += 1.0; kk *= 0.5; }
  float wob = (vnoise(nq + float2(id * 0.37, h * 19.0)) - 0.5) * 0.45;
  float f = fw / s;
  float d = abs(c - k * s - wob * sRef) / s;
  float hw = 0.5 * widthPx * (0.7 + 0.6 * h) * (1.0 + 0.7 * rank) * f;
  float ln = 1.0 - smoothstep(hw - 0.6 * f, hw + 0.6 * f, d);
  return lerp(ln, min(2.0 * hw, 1.0), smoothstep(0.25, 0.45, f));
}
float veinLines(float c, float fw, float spacingPx, float widthPx, float2 nq, float depth)
{
  float lvl = log2(max(fw * spacingPx * _PixelRatio, 1e-6));
  float top = log2(1024.0) - 1.0;
  float keep = 1.0 - smoothstep(top - 1.0, top, lvl);
  if (keep <= 0.0) return 0.0;
  float s0 = exp2(floor(lvl));
  widthPx *= _PixelRatio;
  return lerp(veinLevel(c, fw, s0, s0, widthPx, nq), veinLevel(c, fw, s0 * 2.0, s0, widthPx, nq), frac(lvl)) * keep;
}
// the shade's two families of strokes on a part with an axis: x the strokes, y the cross-hatch
float2 formHatch(float4 f, float3 fdx, float3 fdy, float hsp, float dark, float depth)
{
  const float T = 1024.0, K = 162.9747;
  float r2 = max(dot(f.xy, f.xy), 1e-8), r = sqrt(r2);
  float th = atan2(f.y, f.x) * K;
  float fwT = (abs(f.x * fdx.y - f.y * fdx.x) + abs(f.x * fdy.y - f.y * fdy.x)) / r2 * K;
  float fwH = abs(fdx.z) + abs(fdy.z);
  float fwR = (abs(f.x * fdx.x + f.y * fdx.y) + abs(f.x * fdy.x + f.y * fdy.y)) / r;
  float w1 = lerp(0.9, 2.2, dark), w2 = lerp(0.6, 1.7, dark);
  float in1 = smoothstep(0.02, 0.12, dark), in2 = smoothstep(0.5, 0.65, dark);
  float2 h = 0;
  float wrap = f.w > 1.5 ? smoothstep(0.3, 0.6, fwH / max(fwH + fwR, 1e-9)) : 0.0;
  if (wrap < 0.999)
  {
    float2 nqR = float2(r * 0.6, 3.0);
    h.x = formLines(th, fwT, T, hsp * 0.8, w1, nqR, depth) * in1;
    if (dark > 0.5) h.y = formLines(th, fwT, T, hsp * 0.5, w2, nqR, depth) * in2;
    h *= 1.0 - wrap;
  }
  if (wrap > 0.001)
  {
    float2 ring = float2(formLines(f.z, fwH, 65536.0, hsp * 1.0, w1, f.xy / r * 1.5, depth) * in1, 0.0);
    if (dark > 0.5) ring.y = formLines(th, fwT, T, hsp * 1.25, w2, float2(f.z * 0.6, 5.0), depth) * in2;
    h += ring * wrap;
  }
  return h;
}

// ---------------------------------------------------------------- a makers' box (materials.js MAKERS_BOX)
float boxAA(float v, float fw) { return 1.0 - smoothstep(-fw, fw, v); }
float boxStar(float2 q) { return pow(abs(q.x) + 1e-4, 0.6667) + pow(abs(q.y) + 1e-4, 0.6667) - 1.0; }
float boxMarks(float3 p, float3 on, float4 A)
{
  if (A.z <= 0.0) return 0.0;
  float l = max(length(on), 1e-4);
  float st = boxStar(p.xz / (A.z * float2(1.0, 0.62)));
  return boxAA(st, fwidth(st)) * smoothstep(0.55, 0.8, on.y / l);
}
float3 boxRay(float3 p, float4 A, float4 B)
{
  float c = A.w, pz = floor(c), u = frac(c);
  float ang = pz * 2.39996 + 0.7;
  float3 D = normalize(float3(cos(ang), 0.55 * sin(pz * 1.7 + 0.4), sin(ang)));
  float R = dot(abs(D), B.xyz);
  float s = dot(p, D) / R;
  float head = lerp(-1.05, 1.05, saturate(u / 0.8));
  float d = s - head;
  d += 0.01 * sin(dot(p, float3(9.0, 12.0, 7.0)) + pz * 1.3);
  float ln = exp(-d * d / 0.00035);
  float glow = exp(-d * d / 0.003);
  float trail = d < 0.0 ? exp(d * 9.0) * (1.0 - smoothstep(0.8, 1.0, u)) : 0.0;
  return float3(ln, glow, trail) * A.x;
}
#endif
