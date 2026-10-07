// The people's drawing (src/materials.js MODE_OUTFIT / MODE_EYE, src/eyes.js, src/creases.js,
// src/crowd-shader.js TRIM_GLSL): the printed outfit zones, the tunic's pattern, the face's ink
// (lids, bags, folds, the mouth with its expression, brow lines, freckles), the eyeballs with the
// iris following the gaze and the lids blinking, the traveller's suit creases, the glass helmet.
// Everything is measured in the body's bind pose (three space, metres, feet at 0, facing +z):
// `b` is the rest-pose position the exporter keeps in uv3 (mirrored back with toThree).
#ifndef MEMENTO_FIGURE_INCLUDED
#define MEMENTO_FIGURE_INCLUDED

#define MODE_OUTFIT 4
#define MODE_EYE 6

float4 _Outfit;     // bootTop, beltY, neckY, wristX (rest pose, metres)
float4 _Skin;
float4 _Glove;      // rgb, a = 1: gloved hands
float4 _Trim;       // rgb, w = the pattern (costumes.js TRIM_IDS; 0 none)
float4 _Face;       // eyeY, eyeX, noseY, chinY
float4 _Mood;       // smile, open, brow, squint (src/expression.js)
float4 _Mood2;      // x brow tilt
float4 _FaceKit;    // age lines, mouth width, freckles, lid weight
float4 _FaceKit2;   // x eye size
float4 _EyeC;       // eyeball centre (|x|, y, z), w iris radius
float4 _EyeR;       // eyeball radii: x, above, below, z
float4 _EyeLook;    // gaze (unit, bind space), w blink
float _Creases;
float4 _Limbs[16];  // bind pose limb segments: upper arm L/R, forearm L/R, thigh L/R, shin L/R (start, end)
float _Glass;
float4 _GlassCenter;

static const float3 EYE_INK = float3(0.10, 0.085, 0.09);

float segDist(float2 p, float2 a, float2 b)
{
  float2 ab = b - a;
  float t = saturate(dot(p - a, ab) / dot(ab, ab));
  return length(p - a - ab * t);
}

float4 eyeIris(float2 e, float px, float3 iris, float3 white)
{
  float rpx = 1.0 / max(px, 1e-4);
  float nearK = smoothstep(2.0, 4.5, rpx);
  float aa = clamp(px, 0.03, 0.6);
  float r = length(e);
  float cover = 1.0 - smoothstep(1.0 - aa, 1.0 + aa * 0.5, r);
  float3 c = lerp(lerp(iris, EYE_INK, 0.6), iris, nearK);
  c = lerp(c, c * 0.62, smoothstep(0.68, 0.96, r) * nearK);
  c = lerp(c, EYE_INK, (1.0 - smoothstep(0.44 - aa, 0.44 + aa, r)) * nearK);
  float hl = 1.0 - smoothstep(0.16 - aa, 0.16 + aa, length(e - float2(-0.28, 0.3)));
  c = lerp(c, white, hl * smoothstep(4.0, 7.0, rpx));
  return float4(c, cover);
}

// MODE_EYE: the point's direction on the round eye, in the frame of the gaze, places the iris;
// the lid comes down from the top as they blink
float3 eyeball(float3 b, float3 white, float3 iris, float3 skin)
{
  float side = b.x < 0.0 ? -1.0 : 1.0;
  float3 q = b - float3(side * _EyeC.x, _EyeC.y, _EyeC.z);
  float3 d = normalize(q / float3(_EyeR.x, q.y > 0.0 ? _EyeR.y : _EyeR.z, _EyeR.w));
  float3 g = normalize(_EyeLook.xyz);
  float3 gx = normalize(float3(g.z, 0.0, -g.x)), gy = cross(g, gx);
  float2 e = float2(dot(d, gx), dot(d, gy)) / _EyeC.w;
  float px = max(length(float2(ddx(e.x), ddy(e.x))), length(float2(ddx(e.y), ddy(e.y))));
  float4 ir = eyeIris(e, px, iris, white);
  float3 c = lerp(white, ir.rgb, ir.a * step(0.0, dot(d, g)));
  c = lerp(lerp(iris, EYE_INK, 0.7), c, smoothstep(0.8, 1.8, 1.0 / max(px, 1e-4)));
  float lid = lerp(0.18, -0.62, _EyeLook.w), dy = d.y - lid, fy = max(fwidth(d.y), 1e-4);
  c = lerp(c, skin, smoothstep(-fy * 0.5, fy * 0.5, dy));
  c = lerp(c, EYE_INK, (1.0 - smoothstep(fy * 0.7, fy * 1.7, abs(dy))) * step(0.02, _EyeLook.w));
  return c;
}

float3 outfitTrim(float3 base, float3 trim, float kind, float3 b)
{
  int k = (int)(kind + 0.5);
  float ax = abs(b.x);
  bool on = false;
  if (k == 1) on = frac(b.y / 0.09) < 0.32;
  else if (k == 2) on = abs((b.y - 1.2) + b.x * 0.95) < 0.035;
  else if (k == 3) on = b.y > 1.31 || (ax < 0.012 && b.z > 0.0);
  else if (k == 4) on = (b.y < 1.27 && ax < 0.11 && b.z > 0.0) || (abs(ax - 0.075) < 0.018 && b.y > 1.26);
  else if (k == 5) on = fmod(floor(b.x * 14.0 + b.y * 14.0) + floor(b.x * 14.0 - b.y * 14.0) + 200.0, 2.0) < 0.5;
  else if (k == 6) on = frac(sin(dot(floor(float2(b.x * 7.0 + b.z * 3.0, b.y * 7.0)), float2(12.9898, 78.233))) * 43758.5453) > 0.74;
  else if (k == 7) on = length(frac(float2(b.x + b.z * 0.5, b.y) * 9.0) - 0.5) < 0.2;
  else if (k == 8) on = abs(b.y - 1.03) < 0.022 || b.y > 1.4;
  return on ? trim : base;
}

float3 outfitAlbedo(float3 b, float3 c1, float3 c2, float3 c3)
{
  float ax = abs(b.x);
  if (ax > _Outfit.w && _Glove.a > 0.5) return _Glove.rgb;
  if ((b.y > _Outfit.z && ax < 0.16) || ax > _Outfit.w) return _Skin.rgb;
  if (b.y < _Outfit.x) return c3;
  if (abs(b.y - _Outfit.y) < 0.03 && ax < 0.25) return c2 * 0.6 + float3(0.33, 0.24, 0.1);
  if (b.y < _Outfit.y) return c2;
  if (ax > _Outfit.w - 0.05) return c1 * 0.75;
  return _Trim.w > 0.5 ? outfitTrim(c1, _Trim.rgb, _Trim.w, b) : c1;
}

// Moebius face ink in rest-pose face coordinates (q.x = |x|, q.y = y - eyeY); fwq = metres per pixel
float faceInk(float2 q, float fwq, float frontal, float bindX)
{
  float e = _Face.y, ny = _Face.z - _Face.x, cy = _Face.w - _Face.x;
  float smile = _Mood.x, gape = _Mood.y, brow = _Mood.z, squint = _Mood.w, tilt = _Mood2.x;
  float lines = _FaceKit.x, es = _FaceKit2.x, fs = max(smile, 0.0);
  float fine = 1.0 - smoothstep(0.0004, 0.0009, fwq);
  float2 lid = (q - float2(e, 0.004 * es - 0.0035 * squint + 0.0012 * max(brow, 0.0))) / (float2(0.017, 0.008 * (1.0 - 0.35 * squint)) * es);
  float m = 0.0;
  float dLid = abs(length(lid) - 1.0) * 0.008 * es;
  m = max(m, inkLine(dLid / fwq, _FaceKit.w) * step(0.0, lid.y + 0.25) * step(abs(lid.x), 1.1));
  float lift = 0.0025 * fs + 0.002 * squint;
  float2 bag = (q - float2(e + 0.002, -0.006 * es + lift)) / (float2(0.014, 0.006) * es);
  m = max(m, inkLine(abs(length(bag) - 1.0) * 0.006 * es / fwq, 0.7) * step(bag.y, -0.35) * min(0.45 * lines + 0.35 * fs + 0.3 * squint, 1.0));
  m = max(m, inkLine(segDist(q, float2(0.02 + 0.002 * fs, ny - 0.002), float2(0.034 + 0.006 * fs, ny - 0.04 + 0.006 * fs)) / fwq, 0.8) * min(0.7 * lines + 0.4 * fs, 1.0));
  m = max(m, inkLine(segDist(q, float2(0.042, -0.018), float2(0.064, -0.036)) / fwq, 1.0) * min(0.8 * lines, 1.0));
  float my = ny + (cy - ny) * 0.42;
  float hw = 0.019 * _FaceKit.y * (1.0 + 0.1 * smile);
  float mu = min(q.x / hw, 1.0), bend = smile * 0.0075;
  float mSlope = (0.002 + 2.0 * bend * mu) / hw;
  float2 mEnd = float2(hw, my + 0.002 + bend);
  float dMouth = q.x < hw ? abs(q.y - (my + 0.002 * mu + bend * mu * mu)) / sqrt(1.0 + mSlope * mSlope) : length(q - mEnd);
  m = max(m, inkLine(dMouth / fwq, 1.0 + 0.5 * abs(smile)));
  if (gape > 0.001)
  {
    float oh = gape * 0.0085;
    float2 o = (q - float2(0.0, my + smile * 0.0012 - oh * 0.85)) / float2(hw * (0.78 - 0.18 * gape), oh);
    m = max(m, 1.0 - smoothstep(1.0 - fwq / oh, 1.0 + fwq / oh, length(o)));
    m = max(m, inkLine(segDist(q, float2(0.0, my - oh * 2.2 - 0.002), float2(hw * 0.4, my - oh * 2.1 - 0.0015)) / fwq, 0.8) * 0.6 * fine);
  }
  m = max(m, inkLine(segDist(q, float2(0.0, cy + 0.012), float2(0.008, cy + 0.011)) / fwq, 1.0) * 0.6);
  float fur = max(-brow, 0.0) + max(-tilt, 0.0) * 0.5;
  m = max(m, inkLine(segDist(q, float2(0.0065, 0.013), float2(0.0045, 0.029)) / fwq, 0.8) * min(fur * 1.2, 1.0) * fine);
  float up = max(brow, 0.0) + max(tilt, 0.0) * 0.6;
  for (int i = 0; i < 3; i++)
  {
    float w = 0.034 - float(i) * 0.005 - max(tilt, 0.0) * 0.012;
    float u = q.x / w, y0 = 0.045 + float(i) * 0.0075 - 0.003 * u * u;
    m = max(m, inkLine(abs(q.y - y0) / fwq, 0.7) * (1.0 - smoothstep(0.6, 1.0, u)) * min(up * (1.2 - float(i) * 0.3), 1.0) * fine * 0.8);
  }
  if (_FaceKit.z > 0.0)
  {
    float2 fc = float2(bindX, q.y) / 0.0042, id = floor(fc), f = frac(fc) - 0.5;
    float h = frac(sin(dot(id, float2(12.9898, 78.233))) * 43758.5453);
    float2 jit = float2(frac(h * 17.0), frac(h * 31.0)) - 0.5;
    float region = exp(-pow((q.x - 0.043) / 0.022, 2.0) - pow((q.y + 0.017) / 0.012, 2.0)) + 0.7 * exp(-pow(q.x / 0.01, 2.0) - pow((q.y + 0.014) / 0.01, 2.0));
    float dotK = 1.0 - smoothstep(0.1, 0.1 + max(fwq / 0.0042, 0.05), length(f - jit * 0.5));
    m = max(m, dotK * step(1.0 - _FaceKit.z * min(region, 1.0) * 0.8, h) * fine * 0.6);
  }
  return m * frontal;
}

// src/creases.js: rings round a limb bent into chevrons and broken into arcs
float foldRings(float t, float c, float s, float centre, float reach, float spacing, float bend, float seed, float dark, float widthPx)
{
  float u = (t - centre) / spacing + bend * abs(s) + 0.3 * c;
  float fu = max(fwidth(u), 1e-4);
  float k = floor(u + 0.5);
  float arc = vnoise(float2(k * 3.7 + seed, c * 1.7 + s * 2.3 + seed * 1.3));
  float keep = smoothstep(0.5 - 0.22 * dark, 0.58 - 0.22 * dark, arc);
  float nearK = 1.0 - smoothstep(0.45, 1.0, abs(t - centre) / reach);
  return inkLine(abs(u - k) / fu, widthPx) * keep * nearK * (1.0 - smoothstep(0.22, 0.45, fu));
}
float cuffPleats(float t, float c, float s, float centre, float reach, float count, float seed)
{
  float u = atan2(s, c) / 6.2832 * count;
  float fu = max(fwidth(u), 1e-4);
  float k = floor(u + 0.5);
  float len = reach * (0.45 + 0.55 * hash(float2(k, seed)));
  float on = 1.0 - smoothstep(len * 0.8, len, abs(t - centre));
  return inkLine(abs(u - k) / fu, 0.75) * on * step(0.35, hash(float2(k, seed + 4.0))) * (1.0 - smoothstep(0.2, 0.4, fu));
}
float outfitCreases(float3 p, float3 n, float dark)
{
  float ink = 0.0;
  for (int i = 0; i < 8; i++)
  {
    float3 a = _Limbs[i * 2].xyz, b = _Limbs[i * 2 + 1].xyz;
    float len = length(b - a);
    float3 d = (b - a) / len;
    float t = dot(p - a, d);
    float3 r = p - a - d * t;
    float3 e1 = normalize(float3(0.0, 0.0, 1.0) - d * d.z);
    float rl = max(length(r), 1e-4);
    float c = dot(r, e1) / rl, s = dot(r, cross(d, e1)) / rl;
    bool leg = i >= 4, lower = (i % 4) >= 2;
    float inside = step(rl, leg ? 0.23 : 0.16) * step(-0.04, t) * step(t, len + 0.04);
    float seed = float(i) * 11.3, f;
    if (!lower)
    {
      f = foldRings(t, c, s, len, leg ? 0.17 : 0.13, leg ? 0.042 : 0.03, leg ? 0.9 : 0.7, seed, dark, 1.0);
      if (leg) f = max(f, foldRings(t, c, s, 0.06, 0.09, 0.045, 1.4, seed + 5.0, dark, 0.9) * step(-0.2, c));
    }
    else
    {
      f = foldRings(t, c, s, 0.0, leg ? 0.11 : 0.1, leg ? 0.036 : 0.028, leg ? 0.8 : 0.7, seed, dark, 0.95);
      float cuff = len - (leg ? 0.1 : 0.085);
      f = max(f, foldRings(t, c, s, cuff, 0.045, 0.013, 0.12, seed + 2.0, dark * 0.5 + 0.5, 0.8));
      f = max(f, cuffPleats(t, c, s, cuff, 0.03, leg ? 26.0 : 18.0, seed));
    }
    ink = max(ink, f * inside);
  }
  float front = smoothstep(0.3, 0.65, n.z);
  float x = abs(p.x), fx = max(fwidth(p.x), 1e-5);
  ink = max(ink, inkLine(x / fx, 0.9) * step(0.86, p.y) * step(p.y, 1.53) * front);
  ink = max(ink, inkLine(segDist(float2(p.x, p.y), float2(-0.008, 1.5), float2(0.008, 1.5)) / fx, 1.1) * front);
  float2 q = float2(x, p.y);
  ink = max(ink, inkLine(segDist(q, float2(0.03, 0.86), float2(0.13, 0.97)) / fx, 0.9) * front * 0.9);
  ink = max(ink, inkLine(segDist(q, float2(0.05, 0.84), float2(0.17, 0.9)) / fx, 0.8) * front * 0.7 * step(0.3, dark + 0.3));
  ink = max(ink, inkLine(segDist(q, float2(0.19, 1.37), float2(0.12, 1.27)) / fx, 0.85) * smoothstep(0.1, 0.4, n.z) * 0.8);
  return ink * (1.0 - smoothstep(0.0035, 0.007, fx));
}

// ------------------------------------------------------------------ the magic fluid (materials.js FLUID)
// a lava lamp in flat print tones: three bands of one tone each, metaball blobs of the others
// rising, sinking and merging through them; the tank shows its fill (three charges = three bands),
// sloshing, empty glass above, a highlight streak; a glob churns; a wing is a pale soap film
float _Fluid;
float4 _FluidA;    // fill · tones in the blend · time · kind (0 tank, 1 hose, 2 glob, 3 wing)
float4 _FluidB;    // flash · refill · hose pulse head · slosh
float4 _FluidBox;  // object space: glass bottom y, top y, radius, highlight angle
float4 _FluidTones[6];
float4 _FluidBase;   // the flask's own fluid, the colour the tones stream through (materials.js uFluidBase)
float3 fluidTone(int i) { return _FluidTones[i - 6 * (i / 6)].rgb; }
float fmod2(float x, float y) { return x - y * floor(x / y); }
float3 fluidLava(float a, float h, float aspect, float t, int n, bool banded)
{
  float F[6] = { 0, 0, 0, 0, 0, 0 };
  float wa = a + 0.16 * sin(h * 8.0 + t * 0.7);
  float wh = h + 0.03 * sin(a * 3.0 - t * 0.9);
  [unroll] for (int i = 0; i < 12; i++)
  {
    float fi = float(i);
    float ph = 6.2831 * (0.06 + 0.05 * frac(fi * 0.618)) * t + fi * 2.13;
    float cy = 0.5 + 0.56 * sin(ph);
    float ca = fi * 2.39996 + 0.9 * sin(t * 0.13 + fi * 1.7);
    float r = 0.115 + 0.045 * sin(t * 0.43 + fi * 1.31);
    float da = abs(fmod2(wa - ca + 3.14159, 6.28318) - 3.14159) * aspect;
    float dy = (wh - cy) / (1.0 + 0.6 * abs(cos(ph)));
    F[i - n * (i / n)] += r * r / max(da * da + dy * dy, 1e-5);
  }
  float hb = h + 0.035 * sin(a * 2.0 + t * 0.6) + 0.02 * sin(a * 5.0 - t * 1.4);
  int base = banded ? (int)clamp(floor(hb * 3.0), 0.0, 2.0) : (int)step(0.5 + 0.25 * sin(a * 2.0 + t * 0.5), h);
  base -= n * (base / n);
  int pick = base; float best = 1.0;
  [unroll] for (int c = 0; c < 6; c++) { if (c < n && c != base && F[c] > best) { best = F[c]; pick = c; } }
  return fluidTone(pick);
}
// the flask's living fluid (materials.js flaskFluid): a green body with the blend's tones turning through it in slow
// warped streams, dark veins where they meet the green; p on the glass in glass heights, continuous all round
float3 flaskFluid(float2 p, float t, int n)
{
  p *= 4.2;
  float2 q = float2(vnoise(p + float2(0.0, t * 0.23)), vnoise(p + float2(5.2, 1.3) - float2(t * 0.19, 0.0)));
  float2 r = float2(vnoise(p * 1.3 + 2.8 * q + float2(1.7, 9.2) + t * 0.09), vnoise(p * 1.3 + 2.8 * q + float2(8.3, 2.8) - t * 0.11));
  float f = vnoise(p * 0.9 + 2.6 * r);
  float3 col = _FluidBase.rgb;
  const float EDGE = 0.45, CORE = 0.63;
  int nn = max(n, 1), k = (int)floor(frac(r.y * 1.7 + q.x * 0.8) * (float)nn);
  if (f > EDGE) col = fluidTone(k);
  if (f > CORE) col = fluidTone(k + 1 - nn * ((k + 1) / nn));
  float fw = max(fwidth(f), 1e-4);
  col = lerp(col, float3(0.08, 0.19, 0.14), 0.85 * (1.0 - smoothstep(0.6, 1.4, abs(f - EDGE) / fw)));
  col = lerp(col, float3(0.1, 0.12, 0.16), 0.6 * (1.0 - smoothstep(0.4, 1.0, abs(f - CORE) / fw)));
  return col;
}
float3 fluidAlbedo(float3 base, float3 b, float2 fold, float3 nrm, float3 toEye)
{
  float t = _FluidA.z, kind = _FluidA.w;
  int n = max(1, (int)(_FluidA.y + 0.5));
  if (kind > 3.5) return base;
  if (kind > 2.5)
  {
    float y = b.y, wy = max(0.5 * pow(sin(3.14159 * min(1.0, pow(max(y, 0.0), 0.8) * 0.97 + 0.03)), 0.85), 0.02);
    float u = b.x / wy;
    float3 col = fluidLava(b.x * 5.0 + 0.6 * y, y, 0.4, t * 0.8, n, false);
    col = lerp(col, 1.0, 0.3 + 0.22 * y + _FluidB.x * 0.3);
    float vein = min(abs(u), min(abs(u - 0.55 * (1.0 - y * 0.3)), abs(u + 0.55 * (1.0 - y * 0.3))));
    if (vein < 0.03 * (1.2 - y) && y < 0.9) col = lerp(col, float3(0.17, 0.13, 0.12), 0.55);
    if (abs(u) > 0.88) col = lerp(col, 1.0, 0.6);
    return col;
  }
  if (kind > 0.5 && kind < 1.5)
  {
    float u = fold.x, head = _FluidB.z;
    if (u < head && u > head - 0.3) return fluidTone((int)fmod2(floor(u * 7.0 - t * 3.0), float(n)));
    return base;
  }
  float H = _FluidBox.y - _FluidBox.x;
  float h = (b.y - _FluidBox.x) / H;
  float a = atan2(b.z, b.x);
  if (kind > 1.5) return fluidLava(a, h, _FluidBox.z / H, t * 4.0, n, false);   // a glob in flight
  // the flask: its living fluid at the fill level, sloshing; empty glass above (buildFlask)
  float3 col = flaskFluid(float2(b.x + 0.8 * b.z, b.y - _FluidBox.x) / H, t, n);
  float fill = _FluidA.x;
  float surf = max(fill, 0.07) + (0.012 + 0.05 * _FluidB.w) * sin(a + t * 6.0) * min(1.0, fill * 8.0);
  float w = _FluidB.y;
  if (w > 0.0 && h < surf)
  {
    float2 g = float2(a * _FluidBox.z / H * 10.0, h * 10.0 - t * 5.0);
    float2 c = frac(g) - 0.5;
    if (hash(floor(g)) > 0.55 && dot(c, c) < 0.07) col = lerp(col, 1.0, 0.75 * w);
  }
  if (h > surf) col = kind < 0.5 ? float3(0.8, 0.9, 0.88) : float3(0.855, 0.925, 0.945);   // (the flask's glass a little green)
  else if (h > surf - 0.04) col = lerp(col, 1.0, 0.35 + 0.4 * w);
  if (kind < 0.5)
  {
    // the glass's edge, pale where it turns away from the eye; its thick green foot; an etched mark at each third
    float fr = 1.0 - abs(dot(nrm, toEye));
    col = lerp(col, float3(0.84, 0.94, 0.91), 0.8 * smoothstep(0.78, 0.86, fr));
  }
  if (h < 0.045) col = lerp(col, float3(0.2, 0.46, 0.36), 0.75);
  float da = abs(a + 0.42);
  if (da < 0.16 && (abs(h - 0.3333) < 0.008 || abs(h - 0.6667) < 0.008)) col = lerp(col, float3(0.12, 0.2, 0.17), 0.8);
  col = lerp(col, 1.0, _FluidB.x * 0.45);
  float dh = abs(fmod2(a - _FluidBox.w + 3.14159, 6.28318) - 3.14159);
  if (dh < (kind < 0.5 ? 0.07 : 0.14) && h > 0.16 && h < 0.8) col = lerp(col, 1.0, h > surf ? 0.9 : 0.5);
  return col;
}

// ------------------------------------------------------------------ a makers' box coming apart (materials.js DISSOLVE)
float4 _Dissolve;        // amount 0..1 · edge width · bottom y · top y (world, three space)
float4 _DissolveColor;   // the burning edge
#endif
