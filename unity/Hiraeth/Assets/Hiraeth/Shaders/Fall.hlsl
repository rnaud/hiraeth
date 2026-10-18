// A falling sheet of water (src/waterfall-shader.js FALL_GLSL, line for line): the columns of four flat tones fixed
// across the sheet, their breaks streaming down at the fall's speed, the pen streaks in their lanes, the see-through
// slits where a column runs thin (the caller discards), the glassy lip under the top and the billowing mist at the foot.
// Its uv in metres (x across, y up from its foot: waterfall-kit.js fallSheet), sent in the form's slot (Surface.shader's
// vertex stage, _FallOn). Included by Surface.shader after HiraethCommon.hlsl (hash, vnoise, inkLine) and its own
// _Color, _Color2, _Color3, _MTime; on the full variant only (BridgeRenderer.Lean "fall": its discard).
#ifndef HIRAETH_FALL_INCLUDED
#define HIRAETH_FALL_INCLUDED

static const float3 FALL_TONES = float3(0.38, 0.53, 0.67);   // (waterfall-shader.js FALL_TONES: deep | water | pale | white)

struct FallLook { float3 albedo; float ink; float gap; };

FallLook fallLook(float2 q)
{
  FallLook F;
  float t = _MTime, sp = _FallA.x, cw = _FallA.y, seed = _FallB.w;
  float cx = q.x / cw;
  // the columns: a field across the sheet only (no time, no height: they never crawl sideways)
  float col = vnoise(float2(cx * 0.45 + seed, 1.7)) * 0.62 + vnoise(float2(cx * 1.7 + seed * 3.1, 5.3)) * 0.38;
  // the flow: breaks streaming down, long and thin
  float y = q.y + t * sp;
  float flow = vnoise(float2(cx * 2.6 + seed, y / (cw * 22.0))) * 0.6 + vnoise(float2(cx * 6.1 + 11.0 + seed, y / (cw * 9.0))) * 0.4;
  float lip = smoothstep(_FallB.z - _FallB.y * 1.6, _FallB.z - _FallB.y * 0.4, q.y);   // 1 at the lip: smooth glassy water
  float v = lerp(col * 0.72 + flow * 0.28, col, lip);
  float3 white = lerp(_Color2.rgb, float3(0.97, 1.0, 0.98), 0.75);
  float3 c = v < FALL_TONES.x ? _Color3.rgb : (v < FALL_TONES.y ? _Color.rgb : (v < FALL_TONES.z ? _Color2.rgb : white));
  // the mist at the foot: a pale band whose top billows (and drifts a little up)
  float mist = _FallA.w;
  float mTop = mist * (0.75 + 0.5 * vnoise(float2(cx * 0.35 + seed, t * 0.25))) + (vnoise(float2(cx * 1.4, t * 0.6 - q.y * 0.1)) - 0.5) * mist * 0.35;
  float inMist = step(q.y, mTop);
  c = inMist > 0.5 ? lerp(_Color2.rgb, white, step(q.y, mTop * 0.55)) : c;
  // see-through slits where a column runs thin (never in the mist or at the lip)
  float g = col + (flow - 0.5) * 0.12;
  F.gap = step(g, _FallA.z) * (1.0 - inMist) * step(lip, 0.5);
  // the pen streaks: one lane per 0.45 column, a line at its own place in it, broken into dashes falling a little
  // faster than the water
  float sx = cx * 2.2;
  float lane = floor(sx);
  float off = 0.2 + 0.6 * hash(float2(lane, 3.1 + seed));
  float dPx = abs(frac(sx) - off) / max(fwidth(sx), 1e-5);
  float dl = cw * (6.0 + 10.0 * hash(float2(lane, 9.7)));
  float dash = step(0.56, vnoise(float2(lane * 7.13 + seed, (q.y + t * sp * 1.25) / dl)));
  float far = 1.0 - smoothstep(0.15, 0.33, fwidth(sx));   // (a lane under ~3 px: no streaks, the tones alone)
  F.ink = inkLine(dPx, 0.8) * dash * _FallB.x * far * (1.0 - inMist) * (1.0 - lip * 0.8);
  F.albedo = c;
  return F;
}

#endif
