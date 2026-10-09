// Memento ink composite: the port of the web game's Moebius pass (src/post.js).
// Reads the G-buffer written by Memento/Surface and draws the page:
//   1. ink lines from depth (Laplacian of 1/z), normal creases, albedo and shadow boundaries,
//      with a hand-inked wobble, thinner with distance
//   2. two-tone cel shading (albedo in light, albedo x the lavender shadow tint in shade)
//   3. the surface-anchored hatching in shade, drawn detail lines
//   4. crease shading, aerial perspective and banded fog
//   5. the printed sky: flat colour, dots, the cumulus bank, the sun disc, flat inked clouds
//   (nothing fixed to the screen: no paper grain or vignette; the lines' noise is on the view's direction, post.js LINE_NOISE)
// Colours are the game's display values; the result is converted to linear at the end
// (the project renders in linear space and the camera target encodes sRGB).
Shader "Hidden/Memento/Composite"
{
  SubShader
  {
    Tags { "RenderPipeline" = "UniversalPipeline" }
    ZTest Always ZWrite Off Cull Off
    Pass
    {
      Name "Composite"
      HLSLPROGRAM
      #pragma target 4.5
      #pragma vertex vert
      #pragma fragment frag
      // the look's optional passes, compiled in only where a look asks for them (post.js inkFeatures; MementoLook sets
      // them): spot blacks, haze by depth and height, cast shadows lifted, cast shadows printed as ink
      #pragma multi_compile _ MEMENTO_INK_SPOT
      #pragma multi_compile _ MEMENTO_INK_HAZE
      #pragma multi_compile _ MEMENTO_INK_CAST
      #pragma multi_compile _ MEMENTO_INK_SHADOW
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

      Texture2D _GAlbedo, _GNormal, _GHatch, _GBloom, _GBloom2;
      SamplerState sampler_linear_clamp;
      float _Bloom;                    // the glow's strength (post.js uBloom; 0 none)
      float _Storm; float3 _StormColor; // weather: a sandstorm 0..1 (post.js uStorm)

      float4 _Res;          // width, height, 1/width, 1/height
      float4x4 _InvProj;    // inverse GL projection (view space: three's)
      float4x4 _CamWorld;   // camera to world, three space
      float _MTime, _PixelRatio;
      float3 _SkyTop, _SkyHorizon, _Ink, _ShadowTint, _SunColor, _LightTint;
      float _Night, _MoonVis, _Flatten, _FogMul, _FogDensity, _FogStart;
      float3 _SunDisc, _MoonDisc;
      float _LineWidth, _DepthThresh, _NormalThresh, _AlbedoEdges, _ShadowEdges, _Wobble, _Boil;
      float _Toon, _HatchOn, _HatchSpacing, _Highlight, _Clouds, _Grain, _Proj11, _AO;
      float _SkyBands, _HazeBands, _Aerial, _LineVary, _SkyFlat, _SkyDots, _Cumulus;
      float4 _Subject;      // the player on screen: uv, view depth, radius
      float4 _Planet0, _PlanetColor0, _Planet1, _PlanetColor1, _Planet2, _PlanetColor2;
      float4 _PlanetCraters;   // per planet: 1 cratered, 0 a plain printed disc
      float _Debug;
      float _CineRed, _CineLids, _CineBars, _CineFade; float4 _CineFadeColor;   // the cinema (Cinema.cs)
      float4 _Backdrop;     // rgb, a = 1: one flat colour instead of the sky (a conversation's portrait, post.js uBackdrop)
      float _TargetFlip;   // 1: writing the back buffer itself (MementoFeature)
      float _Rain, _RainNear, _Rays;   // weather: ink rain 0..1 and the dry radius under a roof; sun rays at a low sun (post.js uRain, uRainNear, uRays)
      // the web's newer look (post.js): each surface's shade, spot blacks, cast shadows lifted or inked, haze by depth and height
      float3 _SunDir;
      float _ShadowFlat, _Crevice, _ShadeKeep, _PostLite;
      float4 _Haze, _Spot, _SpotTone, _HazeLayers, _HazeTone, _HeightFog, _HeightFogTone;
      float2 _Cast, _InkShadow;
      Texture2D _LineNoise; SamplerState sampler_linear_repeat;   // the lines' noise (post.js LINE_NOISE: 128² random texels)

      struct V2F { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; };
      V2F vert(uint id : SV_VertexID)
      {
        V2F o;
        float2 uv = float2((id << 1) & 2, id & 2);
        o.pos = float4(uv * 2.0 - 1.0, 0.0, 1.0);
        #if UNITY_UV_STARTS_AT_TOP
          o.pos.y = -o.pos.y;
        #endif
        if (_TargetFlip > 0.5) o.pos.y = -o.pos.y;   // (straight into a player's back buffer: the other way up)
        o.uv = uv;
        return o;
      }

      float hash(float2 p) { p = frac(p * float2(123.34, 456.21)); p += dot(p, p + 45.32); return frac(p.x * p.y); }
      float vnoise(float2 p)
      {
        float2 i = floor(p), f = frac(p);
        float2 u = f * f * (3.0 - 2.0 * f);
        return lerp(lerp(hash(i), hash(i + float2(1, 0)), u.x), lerp(hash(i + float2(0, 1)), hash(i + float2(1, 1)), u.x), u.y);
      }
      float fbm(float2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }

      // the game's colours are display values: to linear for the camera target (which encodes sRGB)
      float3 toLinear(float3 c) { return c <= 0.04045 ? c / 12.92 : pow(max((c + 0.055) / 1.055, 0.0), 2.4); }
      float3 toLinear(float c) { return toLinear(c.xxx); }

      float4 tA(float2 uv) { return _GAlbedo.SampleLevel(sampler_PointClamp, uv, 0); }
      float4 tN(float2 uv) { return _GNormal.SampleLevel(sampler_PointClamp, uv, 0); }
      float4 tH(float2 uv) { return _GHatch.SampleLevel(sampler_PointClamp, uv, 0); }

      float3 viewRay(float2 uv)
      {
        float4 p = mul(_InvProj, float4(uv * 2.0 - 1.0, 1.0, 1.0));
        return normalize(mul((float3x3)_CamWorld, p.xyz / p.w));
      }
      float3 skyBase(float3 rd)
      {
        float h = saturate(rd.y);
        float t = smoothstep(0.0, 0.6, h);
        float tb = (floor(t * 5.0) + smoothstep(0.46, 0.54, frac(t * 5.0))) / 5.0;
        float3 c = lerp(_SkyHorizon, _SkyTop, lerp(t, tb, _SkyBands));
        c = lerp(c, lerp(_SkyHorizon, _SkyTop, lerp(0.45, 1.0, smoothstep(0.0, 0.03, h))), _SkyFlat);
        float sd = max(dot(rd, _SunDisc), 0.0);
        c = lerp(c, _SkyHorizon * float3(1.03, 1.0, 0.96), pow(sd, 8.0) * 0.5 * (1.0 - h) * (1.0 - _Night));
        return c;
      }
      float strokeAt(float v, float f, float widthPx)
      {
        float d = abs(frac(v + 0.5) - 0.5);
        float hw = 0.5 * widthPx * _PixelRatio * f;
        return 1.0 - smoothstep(hw - 0.6 * f, hw + 0.6 * f, d);
      }
      float anchoredStrokes(float c, float fw, float spacingPx, float widthPx)
      {
        float lvl = log2(max(fw * spacingPx * _PixelRatio, 1e-7));
        float s0 = exp2(floor(lvl));
        return lerp(strokeAt(c / s0, fw / s0, widthPx), strokeAt(c / (2.0 * s0), fw / (2.0 * s0), widthPx), frac(lvl));
      }
      float invDepth(float d) { return d > 0.0 ? 1.0 / d : 0.0; }

      // the light term under a material's line step (materials.js LINE: gAlbedoLight.a = L + 2 x step)
      float lightOf(float a) { return a - 2.0 * floor(a * 0.5); }
      // x depth edge, y crease, z colour edge, w shadow edge; minDepth the nearest surface in the kernel, near.xy where it
      // is, near.z the signed Laplacian of 1/z (over 0: a depth edge's far side, whose line is the surface's in front)
      float4 inkLines(float2 uv, float w, bool interior, out float minDepth, out float3 near)
      {
        float2 px = max(w, 1.0) * _Res.zw;
        float4 c = tN(uv), n1 = tN(uv + float2(px.x, 0)), n2 = tN(uv - float2(px.x, 0)), n3 = tN(uv + float2(0, px.y)), n4 = tN(uv - float2(0, px.y));
        minDepth = c.w > 0.0 ? c.w : 1e7;
        near.xy = uv;
        if (n1.w > 0.0 && n1.w < minDepth) { minDepth = n1.w; near.xy = uv + float2(px.x, 0); }
        if (n2.w > 0.0 && n2.w < minDepth) { minDepth = n2.w; near.xy = uv - float2(px.x, 0); }
        if (n3.w > 0.0 && n3.w < minDepth) { minDepth = n3.w; near.xy = uv + float2(0, px.y); }
        if (n4.w > 0.0 && n4.w < minDepth) { minDepth = n4.w; near.xy = uv - float2(0, px.y); }
        float ic = invDepth(c.w), i1 = invDepth(n1.w), i2 = invDepth(n2.w), i3 = invDepth(n3.w), i4 = invDepth(n4.w);
        float mx = max(max(max(ic, i1), max(i2, i3)), i4);
        float lap = abs(i1 + i2 - 2.0 * ic) + abs(i3 + i4 - 2.0 * ic);
        float dEdge = smoothstep(_DepthThresh, _DepthThresh * 1.6, lap / max(mx, 1e-7));
        near.z = (i1 + i2 + i3 + i4 - 4.0 * ic) / max(mx, 1e-7);
        float nEdge = 0.0;
        if (c.w > 0.0 && interior) {
          float d1 = n1.w > 0.0 ? 1.0 - dot(c.xyz, n1.xyz) : 0.0;
          float d2 = n2.w > 0.0 ? 1.0 - dot(c.xyz, n2.xyz) : 0.0;
          float d3 = n3.w > 0.0 ? 1.0 - dot(c.xyz, n3.xyz) : 0.0;
          float d4 = n4.w > 0.0 ? 1.0 - dot(c.xyz, n4.xyz) : 0.0;
          nEdge = smoothstep(_NormalThresh, _NormalThresh * 1.5, max(max(d1, d2), max(d3, d4)));
        }
        float aEdge = 0.0, sEdge = 0.0;
        if (c.w > 0.0 && interior && (_AlbedoEdges > 0.0 || _ShadowEdges > 0.0)) {
          float4 a = tA(uv), a1 = tA(uv + float2(px.x, 0)), a2 = tA(uv - float2(px.x, 0)), a3 = tA(uv + float2(0, px.y)), a4 = tA(uv - float2(0, px.y));
          float da = max(max(length(a.rgb - a1.rgb), length(a.rgb - a2.rgb)), max(length(a.rgb - a3.rgb), length(a.rgb - a4.rgb)));
          aEdge = smoothstep(0.08, 0.14, da) * _AlbedoEdges;
          float s = step(_Toon, lightOf(a.a));
          float ds = max(max(abs(s - step(_Toon, lightOf(a1.a))), abs(s - step(_Toon, lightOf(a2.a)))), max(abs(s - step(_Toon, lightOf(a3.a))), abs(s - step(_Toon, lightOf(a4.a)))));
          sEdge = ds * _ShadowEdges * (1.0 - _Flatten);
        }
        return float4(dEdge, nEdge, aEdge, sEdge);
      }

      // the lines' wobble, pressure and inner weight on the view's direction (post.js lineNoise): it turns with the world
      float4 lineTap(float2 p)
      {
        float2 i = floor(p), f = frac(p);
        f = f * f * (3.0 - 2.0 * f);
        return _LineNoise.SampleLevel(sampler_linear_repeat, (i + f + 0.5) / 128.0, 0);
      }
      float4 lineNoise(float3 d, float boilT)
      {
        float s = 0.06 * 0.5 * _Res.y * _Proj11 / _PixelRatio;
        float3 w = pow(abs(d), 4.0);
        w /= w.x + w.y + w.z;
        float2 b = (boilT * float2(17.3, 11.1)) % 128.0;
        float4 n = lineTap(d.yz * s + b) * w.x + lineTap(d.zx * s + b + 37.0) * w.y + lineTap(d.xy * s + b + 71.0) * w.z;
        return saturate((n - 0.5) * rsqrt(dot(w, w)) + 0.5);
      }

      float3 viewPos(float2 uv, float d)
      {
        float4 p = mul(_InvProj, float4(uv * 2.0 - 1.0, 1.0, 1.0));
        float3 r = p.xyz / p.w;
        return r / -r.z * d;
      }
      float creaseAO(float2 uv, float3 nW, float d, float2 fc)
      {
        float3 P = viewPos(uv, d);
        float3 nV = normalize(mul(transpose((float3x3)_CamWorld), nW));
        float R = 1.3;
        float rpx = clamp(R * _Proj11 * 0.5 * _Res.y / d, 3.0, 48.0);
        float a0 = hash(fc) * 6.2832;
        float ao = 0.0, seen = 0.0;
        for (int i = 0; i < 8; i++) {
          float a = a0 + float(i) * 2.39996;
          float rr = rpx * sqrt((float(i) + 0.5) / 8.0);
          float2 suv = uv + float2(cos(a), sin(a)) * rr * _Res.zw;
          float sd = tN(suv).w;
          if (sd <= 0.0) { seen += 1.0; continue; }   // (the sky: open)
          float3 v = viewPos(suv, sd) - P;
          float dist = length(v);
          float cc = max(dot(nV, v / max(dist, 1e-4)) - 0.2, 0.0) * (1.0 - smoothstep(R * 0.6, R * 1.6, dist));
          // (grass blades close nothing in; a tap on a person isn't counted at all, open or closed: post.js notPerson)
          float t = fmod(tH(suv).a, 16.0), np = step(fmod(t, 8.0), 1.5);
          ao += cc * step(t, 7.5) * np; seen += np;
        }
        return saturate(ao / max(seen, 1.0) * 2.2);
      }

      // spot blacks: how enclosed a point is at the scale of a pocket (post.js enclosure: fixed directions, no jitter)
      float enclosure(float2 uv, float3 nW, float d, float R, int taps)
      {
        float3 P = viewPos(uv, d);
        float3 nV = normalize(mul(transpose((float3x3)_CamWorld), nW));
        float2 s = clamp(R * _Proj11 * 0.5 * _Res.y / d, 4.0, 96.0) * _Res.zw;
        float r1 = R * 1.5, r2 = R * 3.0, occ = 0.0, seen = 0.0;
        int n = taps == 8 ? 8 : 4;
        for (int i = 0; i < n; i++)
        {
          float a = 0.39 + i * 6.2832 / n, rr = (i % 2) ? 0.55 : 1.0;
          float2 suv = uv + float2(cos(a), sin(a)) * rr * s;
          float sd = tN(suv).w;
          if (sd <= 0.0) { seen += 1.0; continue; }   // (the sky: open)
          // (a tap on a person is left out, neither open nor closed: post.js notPerson / occlusionShare)
          float np = step(fmod(tH(suv).a, 8.0), 1.5);
          float3 v = viewPos(suv, sd) - P;
          float dist = length(v);
          occ += np * smoothstep(0.12, 0.5, dot(nV, v) / max(dist, 1e-4)) * (1.0 - smoothstep(r1, r2, dist));
          seen += np;
        }
        return occ / max(seen, 1.0);
      }
      // the haze in layers by distance (x) and the fog by height along the ray (y): post.js hazeAt
      float2 hazeAt(float d, float3 rd)
      {
        float2 h = 0;
        if (_HazeLayers.w > 0.0)
        {
          float t = log2(max(d, 1.0) / _HazeLayers.x) / log2(_HazeLayers.y);
          float L = clamp(floor(t) + 1.0 + smoothstep(0.82, 1.0, frac(t)), 0.0, _HazeLayers.w);
          h.x = (1.0 - pow(1.0 - _HazeLayers.z, L)) * (1.0 - 0.6 * _Night);
        }
        if (_HeightFog.w > 0.0 && _HeightFog.z > 0.0)
        {
          float b = 1.0 / _HeightFog.y;
          float base = exp(min(-(_CamWorld._m13 - _HeightFog.x) * b, 30.0));
          float x = max(rd.y * d * b, -30.0);
          float k = abs(x) > 1e-3 ? (1.0 - exp(-x)) / x : 1.0;
          h.y = (1.0 - exp(-_HeightFog.z * d * base * k)) * _HeightFog.w;
        }
        return h;
      }

      // a flat printed planet low in the sky (post.js drawPlanet, without rings)
      // big flat bodies hanging in the sky (post.js drawPlanet): toon-lit by the sun, hatched on the night side,
      // a few craters, an optional ring (C.a: its tilt), all inked
      void drawPlanet(float3 rd, float4 P, float4 C, float craters, inout float3 col, inout float ink)
      {
        if (P.w <= 0.0) return;
        float3 dir = normalize(P.xyz);
        float3 e1 = normalize(cross(dir, float3(0, 1, 0)));
        float3 e2 = cross(e1, dir);
        float2 q = float2(dot(rd, e1), dot(rd, e2)) / tan(P.w);
        float r = length(q);
        float fw = min(fwidth(r), 0.5);
        float2 rq0 = float2(q.x, q.y / max(C.a, 1e-3));
        float ringFw = min(fwidth(length(rq0)), 0.5);
        if (dot(rd, dir) < 0.0) return;
        float px = _PixelRatio;
        bool hasRing = C.a > 0.0;
        float ringR = 0.0, ringMask = 0.0;
        if (hasRing) {
          float2 rq = float2(q.x, q.y / C.a);
          ringR = length(rq);
          ringMask = smoothstep(1.45, 1.45 + ringFw * 2.0, ringR) - smoothstep(2.1 - ringFw * 2.0, 2.1, ringR);
        }
        bool front = q.y < 0.0;
        if (hasRing && !front && r < 1.0) ringMask = 0.0;
        if (r < 1.0 + fw) {
          float3 nrm = normalize(q.x * e1 + q.y * e2 - sqrt(max(1.0 - r * r, 0.0)) * dir);
          float lit = smoothstep(-0.02, 0.02, dot(nrm, _SunDisc));
          float3 pc = lerp(C.rgb * _ShadowTint * 0.9, C.rgb * lerp(float3(1, 1, 1), _LightTint, 0.3), lit);
          float2 cq = q * 4.0;
          float2 cid = floor(cq);
          float ch = hash(cid + 3.1);
          float cr = length(frac(cq) - 0.5 - (float2(hash(cid), hash(cid + 1.7)) - 0.5) * 0.4);
          float crater = step(0.7, ch) * (1.0 - smoothstep(0.18, 0.2, cr)) * craters;
          pc = lerp(pc, pc * 0.86, crater);
          float disc = 1.0 - smoothstep(1.0 - fw, 1.0 + fw, r);
          col = lerp(col, pc, disc);
          float hc = dot(q, float2(0.8, 0.6)) * 22.0;
          float hl = 1.0 - smoothstep(0.0, fwidth(hc) * 1.2 * px, abs(frac(hc) - 0.5) * 2.0 - 0.6);
          col = lerp(col, _Ink, hl * (1.0 - lit) * disc * 0.35 * _HatchOn);
          ink = max(ink, (1.0 - smoothstep(0.0, fw * 1.4 * px, abs(r - 1.0))) * 0.95);
          ink = max(ink, (1.0 - smoothstep(0.0, fwidth(cr) * 1.2 * px, abs(cr - 0.19))) * step(0.7, ch) * disc * 0.5 * craters);
        }
        if (hasRing && ringMask > 0.0) {
          float3 rc = lerp(C.rgb * 1.15, float3(0.97, 0.94, 0.86), 0.5);
          col = lerp(col, rc, ringMask);
          ink = max(ink, (1.0 - smoothstep(0.0, ringFw * 1.3 * px, min(abs(ringR - 1.45), abs(ringR - 2.1)))) * 0.85);
        }
      }

      float3 renderSky(float3 rd, out float ink)
      {
        float3 col = skyBase(rd);
        ink = 0.0;
        float px = _PixelRatio;
        float ang = acos(clamp(dot(rd, _SunDisc), -1.0, 1.0));
        float aa = fwidth(ang);
        float r = 0.05;
        col = lerp(col, _SunColor, 1.0 - smoothstep(r - aa, r + aa, ang));
        ink = max(ink, 1.0 - smoothstep(0.0, aa * 1.2 * px, abs(ang - r)));
        ink = max(ink, 0.5 * (1.0 - _Night) * (1.0 - smoothstep(0.0, aa * 0.7 * px, abs(ang - r * 1.6))));
        // sun rays: pale wedges fanning from a low sun (post.js)
        if (_Rays > 0.0 && _SunDisc.y > -0.05) {
          float low = (1.0 - smoothstep(0.08, 0.45, _SunDisc.y)) * (1.0 - _Night);
          float3 s1 = normalize(cross(_SunDisc, float3(0.0, 1.0, 0.0)) + 1e-5);
          float3 s2 = cross(s1, _SunDisc);
          float phi = atan2(dot(rd, s2), dot(rd, s1));
          float wedge = smoothstep(0.55, 0.62, vnoise(float2(phi * 9.0 + _MTime * 0.01, 3.0)));
          float nearSun = (1.0 - smoothstep(0.08, 0.9, ang)) * step(r * 1.7, ang);
          col = lerp(col, lerp(col, _SunColor, 0.6), wedge * nearSun * low * _Rays);
        }
        if (_MoonVis > 0.0) {
          float ma = acos(clamp(dot(rd, _MoonDisc), -1.0, 1.0));
          float mw = fwidth(ma);
          float mr = 0.035;
          float3 side = normalize(cross(_MoonDisc, float3(0, 1, 0)) + 1e-5);
          float ca = acos(clamp(dot(rd, normalize(_MoonDisc + side * 0.022)), -1.0, 1.0));
          float disc = 1.0 - smoothstep(mr - mw, mr + mw, ma);
          float crescent = disc * (1.0 - smoothstep(mr - mw, mr + mw, ca));
          col = lerp(col, lerp(float3(0.96, 0.94, 0.88), _SkyTop * 1.2, crescent * 0.85), disc * _MoonVis);
          ink = max(ink, _MoonVis * (1.0 - smoothstep(0.0, mw * 1.2 * px, abs(ma - mr))));
        }
        drawPlanet(rd, _Planet0, _PlanetColor0, _PlanetCraters.x, col, ink);
        drawPlanet(rd, _Planet1, _PlanetColor1, _PlanetCraters.y, col, ink);
        drawPlanet(rd, _Planet2, _PlanetColor2, _PlanetCraters.z, col, ink);

        // the printed sky's dots, on the dome (azimuth / elevation; a projected cap overhead)
        float el = asin(clamp(rd.y, -1.0, 1.0));
        bool cap = rd.y > 0.82;
        float2 sp = cap ? rd.xz / rd.y + 40.0 : float2(atan2(rd.x, rd.z) * cos(el), el);
        float2 jx = ddx(sp), jy = ddy(sp);
        float det = abs(jx.x * jy.y - jy.x * jx.y);
        if (_SkyDots > 0.0 && rd.y > 0.0) {
          float pxA = clamp(sqrt(det), 1e-6, 0.02);
          float lvl = log2(pxA * 5.0 * _PixelRatio);
          float dots = 0.0;
          float drift = smoothstep(0.25, 0.75, vnoise(sp * 9.0 + 3.0));
          for (int L = 0; L < 2; L++) {
            float cell = exp2(floor(lvl) + float(L));
            float2 g = sp / cell, id = floor(g);
            float2 o = float2(hash(id + 1.3), hash(id + 7.1)) * 0.9 + 0.05;
            float present = step(hash(id + 4.4), lerp(0.16, 0.38, drift));
            float size = lerp(0.3, 0.75, hash(id + 2.9));
            float2 w = (frac(g) - o) * cell;
            // the mapping's inverse Jacobian: sky units back to screen pixels (round dots)
            float dd = jx.x * jy.y - jy.x * jx.y;
            float2 s = abs(dd) > 1e-12 ? float2(jy.y * w.x - jy.x * w.y, -jx.y * w.x + jx.x * w.y) / dd : float2(1e6, 1e6);
            float d = (1.0 - smoothstep(size * _PixelRatio, size * _PixelRatio + 0.5, length(s))) * present * lerp(0.55, 1.0, hash(id + 6.2));
            dots += d * (L == 0 ? 1.0 - frac(lvl) : frac(lvl));
          }
          col = lerp(col, _SkyTop * 0.72, saturate(dots) * smoothstep(0.65, 1.6, _PixelRatio) * _SkyDots * (1.0 - _Night * 0.5));
        }

        // the cumulus bank on the horizon
        float az = atan2(rd.x, rd.z);
        float e = rd.y;
        float fwe = max(fwidth(e), 1e-5);
        if (_Cumulus > 0.0 && rd.y > -0.02) {
          float hgt = 0.0, inner = 1.0;
          for (int k = 0; k < 3; k++) {
            float n = 7.0 + float(k) * 5.0;
            float f = az * n / 6.2832 * 6.2832 + float(k) * 1.7;
            float cell = floor(f), u = frac(f) * 2.0 - 1.0;
            float bigC = hash(float2(cell, float(k) + 2.0));
            float mass = smoothstep(0.25, 0.65, vnoise(float2(az * 1.3 + float(k) * 3.0, 4.0)));
            float rr = (0.012 + 0.03 * bigC) * mass * (1.0 - float(k) * 0.22);
            float top = (0.03 + 0.03 * mass) * step(0.01, mass) + rr * 1.6 * sqrt(max(1.0 - u * u, 0.0));
            hgt = max(hgt, top);
            inner = min(inner, abs(e - top) / fwe);
          }
          float cloud = (1.0 - smoothstep(hgt - fwe, hgt + fwe, e)) * step(0.0, hgt - 0.001) * _Cumulus;
          float shade = smoothstep(hgt * 0.45, 0.0, e);
          float3 cc = lerp(float3(0.98, 0.95, 0.86) * _LightTint, _SkyHorizon * _ShadowTint * 1.12, shade * 0.6);
          col = lerp(col, cc, cloud);
          ink = max(ink, (1.0 - smoothstep(0.0, 1.3 * _PixelRatio, abs(e - hgt) / fwe)) * step(0.001, hgt) * _Cumulus);
          ink = max(ink, (1.0 - smoothstep(0.0, 0.9 * _PixelRatio, inner)) * cloud * 0.55);
        }

        // stars: sparse dots at night
        if (_Night > 0.0 && rd.y > 0.0)
        {
          float2 st = rd.xz / (rd.y + 1.0) * 260.0;
          float2 sc = floor(st);
          float hs = hash(sc);
          float2 so = float2(hash(sc + 3.3), hash(sc + 7.7)) * 0.6 + 0.2;
          float sd2 = length(frac(st) - so) / max(fwidth(st.x), 1e-5);
          float star = step(0.985, hs) * (1.0 - smoothstep(0.4, 1.2 + 1.2 * step(0.996, hs), sd2 / px));
          col = lerp(col, float3(1.0, 0.97, 0.88), star * _Night * smoothstep(0.02, 0.2, rd.y));
        }

        // flat inked clouds on a virtual plane
        float2 p = rd.xz / (rd.y + 0.15);
        p = float2(p.x * 0.55, p.y * 1.4) + float2(_MTime * 0.006, 0.0);
        float th = lerp(0.75, 0.52, _Clouds);
        float f = fbm(p * 1.3);
        float fw = fwidth(f);
        float cc2 = dot(p, float2(0.98, 0.2));
        float fwc = fwidth(cc2);
        if (rd.y > 0.0 && _Clouds > 0.0) {
          float fade = smoothstep(0.07, 0.3, rd.y);
          float m = smoothstep(th - fw, th + fw, f) * fade;
          float2 outward = normalize(rd.xz + 1e-5) * float2(0.55, 1.4);
          float f2 = fbm((p + outward * 0.12) * 1.3);
          float under = (1.0 - smoothstep(th - fw, th + fw, f2)) * m;
          float3 cloudCol = lerp(float3(1.0, 0.985, 0.95) * _LightTint, _SkyHorizon * _ShadowTint * 1.1, under);
          col = lerp(col, cloudCol, m);
          float hs = anchoredStrokes(cc2, fwc, _HatchSpacing * 0.9, 1.0) * under * _HatchOn;
          col = lerp(col, _Ink, hs * 0.45);
          ink = max(ink, (1.0 - smoothstep(0.0, fw * 1.3 * _LineWidth, abs(f - th))) * fade * 0.9);
        }
        return col;
      }

      float4 frag(V2F i) : SV_Target
      {
        float2 uv = i.uv;
        float2 fc = i.pos.xy / _PixelRatio;
        float4 A = tA(uv);
        A.a = lightOf(A.a);   // (the line step over it: 1b)
        float4 N = tN(uv);
        bool isSky = N.w <= 0.0;
        float4 surface = tH(uv);
        // the shade's tone packed over the strokes (materials.js SHADE): r += 2 (1 + hue step), g += 2 lift step
        float2 shadeQ = floor(surface.rg * 0.5);
        surface.rg -= 2.0 * shadeQ;
        // a weathered wall (b += 16): the dust splashed up its foot; the material's spot step (b += 4 x step)
        float wearW = step(15.5, surface.b);
        surface.b -= 16.0 * wearW;
        float spotQ = floor(surface.b * 0.25);
        surface.b -= 4.0 * spotQ;
        float spotMat = spotQ > 0.5 ? (spotQ - 1.0) / 2.0 : 1.0;
        float shadeLift = shadeQ.y / 15.0;
        bool ownFlat = shadeQ.x > 9.5;
        float shadeHue = shadeQ.x > 0.5 && !ownFlat ? (shadeQ.x - 1.0) / 8.0 : _ShadeKeep;
        float shadowFlat = ownFlat ? (shadeQ.x - 10.0) / 5.0 : _ShadowFlat;
        // gHatch.a: glow + 2 hero + 4 figure + 8 soft ink (grass) + 16 a face + 32 banked sand
        float drift = step(31.5, surface.a);
        surface.a -= 32.0 * drift;
        float face = step(15.5, surface.a);
        surface.a -= 16.0 * face;
        float soft = step(7.5, surface.a);
        surface.a -= 8.0 * soft;
        float2 grassInk = surface.rg * soft;   // (a blade: r its pen line's share, g its outline's fade)
        surface.rgb *= 1.0 - soft;
        float figure = step(3.5, surface.a);
        surface.a -= 4.0 * figure;
        float hero = step(1.5, surface.a);
        float emitHere = isSky ? 0.0 : smoothstep(0.62, 0.9, surface.a - 2.0 * hero);
        float heroHeight = max(0.0, _Subject.w) * 2.0 * _Res.y / _PixelRatio;
        float heroDetail = smoothstep(70.0, 180.0, heroHeight);
        float2 hp = max(1.0, 0.65 * _PixelRatio) * _Res.zw;
        float4 hm = float4(tH(uv + float2(hp.x, 0)).a, tH(uv - float2(hp.x, 0)).a, tH(uv + float2(0, hp.y)).a, tH(uv - float2(0, hp.y)).a);
        hm = fmod(hm, 16.0);
        hm -= 8.0 * step(7.5, hm);
        hm = step(1.5, hm - 4.0 * step(3.5, hm));
        float heroNear = max(hero, max(max(hm.x, hm.y), max(hm.z, hm.w)));
        float heroBoundary = heroNear - min(hero, min(min(hm.x, hm.y), min(hm.z, hm.w)));
        float depth = isSky ? 1e7 : N.w;
        float3 rd = viewRay(uv);
        float3 camZ = _CamWorld._m02_m12_m22;
        float toRange = 1.0 / max(dot(rd, -camZ), 0.2);
        // cast shadows by world (post.js CAST): lifted toward the light (_Cast) or printed as a flat ink mass (_InkShadow)
        float castPot = 0.0, inkPot = 0.0;
        if (!isSky)
        {
          float facing = smoothstep(0.02, 0.08, dot(N.xyz, _SunDir)), ground = smoothstep(0.55, 0.8, N.y), person = 1.0 - max(max(face, figure), hero);
          #if defined(MEMENTO_INK_CAST)
          castPot = facing * lerp(_Cast.y, _Cast.x, ground) * person;
          #endif
          #if defined(MEMENTO_INK_SHADOW)
          inkPot = facing * lerp(_InkShadow.y, _InkShadow.x, ground) * person * spotMat * (1.0 - soft);
          #endif
        }

        int dbg = (int)(_Debug + 0.5);
        if (dbg == 2) return float4(toLinear(isSky ? skyBase(rd) : A.rgb), 1);
        if (dbg == 3) return float4(toLinear(isSky ? 0 : N.rgb * 0.5 + 0.5), 1);
        if (dbg == 4) return float4(toLinear((isSky ? 1.0 : pow(depth / 3000.0, 0.4)).xxx), 1);
        if (dbg == 5) return float4(toLinear((isSky ? 1.0 : A.a).xxx), 1);
        if (dbg == 9) return float4(toLinear(saturate(_GBloom.SampleLevel(sampler_linear_clamp, uv, 0).rgb * 3.0 + _GBloom2.SampleLevel(sampler_linear_clamp, uv, 0).rgb * 3.0)), 1);   // (the glow buffer)
        if (dbg == 8) return float4(toLinear((isSky ? 1.0 : 1.0 - surface.b).xxx), 1);
        if (dbg == 7) { float3 H0 = isSky ? 0 : surface.rgb; return float4(toLinear((1.0 - max(max(H0.r, H0.g), H0.b)).xxx), 1); }

        // ---- 1. ink lines with a hand-drawn wobble, its noise on the view's direction (it turns with the world)
        float boilT = floor(_MTime * 8.0) * _Boil;
        float4 sn = lineNoise(rd, boilT);
        float2 wob = sn.xy - 0.5;
        float2 euv = uv + wob * _Wobble * 2.0 * _PixelRatio * _Res.zw;
        float nearD;
        float probeD = depth;
        if (isSky) {
          float2 o = 2.0 * _PixelRatio * _Res.zw;
          float4 s = float4(tN(uv + float2(o.x, 0)).w, tN(uv - float2(o.x, 0)).w, tN(uv + float2(0, o.y)).w, tN(uv - float2(0, o.y)).w);
          s = lerp(1e7, s, step(1e-6, s));
          probeD = min(min(s.x, s.y), min(s.z, s.w));
        }
        float weight = lerp(_LineWidth, _LineWidth * 0.6, smoothstep(15.0, 400.0, probeD));
        float press = lerp(1.0, 0.65 + 0.7 * sn.z, _LineVary);
        float silW = weight * lerp(1.0, 1.35, _LineVary) * press;
        float inW = weight * lerp(1.0, 0.75, _LineVary) * lerp(1.0, 0.85 + 0.3 * sn.w, _LineVary);
        float2 sd = (uv - _Subject.xy) * float2(_Res.x / _Res.y, 1.0);
        float subj = (1.0 - smoothstep(_Subject.w * 0.7, _Subject.w, length(sd))) * (1.0 - smoothstep(1.5, 4.0, abs(probeD - _Subject.z)));
        silW = lerp(silW, 0.65, heroNear);
        euv = lerp(euv, uv, heroNear);
        float nearD2;
        float3 ownK, ownK2;
        float4 eS, eI;
        if (_PostLite > 0.5) { eI = inkLines(euv, lerp(silW, inW, 0.5) * _PixelRatio, true, nearD2, ownK); eS = eI; nearD = nearD2; }
        else { eS = inkLines(euv, silW * _PixelRatio, false, nearD, ownK); eI = inkLines(euv, inW * _PixelRatio, true, nearD2, ownK2); }
        nearD = min(nearD, nearD2);
        float3 wpL = _CamWorld._m03_m13_m23 + rd * min(probeD, 5000.0) / max(dot(rd, -camZ), 0.2);
        float gapN = vnoise(float2(wpL.x + wpL.y * 0.7, wpL.z - wpL.y * 0.4) * 0.9);
        float broken = lerp(1.0, smoothstep(0.22, 0.34, gapN), _LineVary * (1.0 - subj) * smoothstep(3.0, 12.0, probeD));
        float ink = saturate(max(max(eS.x, eI.y * broken), max(eI.z * 0.85 * broken, eI.w * 0.8 * (1.0 - face) * (1.0 - castPot))));

        // people far away: lines redrawn by the figure's height on screen
        float innerK = figure > 0.5 && hero < 0.5 ? smoothstep(70.0, 260.0, 1.8 * _Res.y * 0.5 * _Proj11 / max(depth, 0.1)) : 1.0;
        float softNear = soft, driftNear = drift;
        float2 grassNear = grassInk;
        if (ink > 0.02 && hero < 0.5 && !isSky) {
          float2 fo = max(silW * _PixelRatio, 1.0) * _Res.zw;
          float4 t1 = tH(euv + float2(fo.x, 0)), t2 = tH(euv - float2(fo.x, 0)), t3 = tH(euv + float2(0, fo.y)), t4 = tH(euv - float2(0, fo.y));
          float4 fa = float4(t1.a, t2.a, t3.a, t4.a);
          driftNear = max(drift, max(max(step(31.5, fa.x), step(31.5, fa.y)), max(step(31.5, fa.z), step(31.5, fa.w))));
          fa = fmod(fa, 16.0);
          float4 faSoft = step(7.5, fa);
          fa -= 8.0 * faSoft;
          softNear = max(soft, max(max(faSoft.x, faSoft.y), max(faSoft.z, faSoft.w)));
          if (soft < 0.5 && softNear > 0.5) {
            float4 pens = float4(t1.r, t2.r, t3.r, t4.r) * faSoft, fades = lerp(1.0, float4(t1.g, t2.g, t3.g, t4.g), faSoft);
            grassNear = float2(max(max(pens.x, pens.y), max(pens.z, pens.w)), min(min(fades.x, fades.y), min(fades.z, fades.w)));
          }
          float figHit = max(figure, max(max(step(3.5, fa.x), step(3.5, fa.y)), max(step(3.5, fa.z), step(3.5, fa.w))));
          if (figHit > 0.5) {
            float figPx = 1.8 * _Res.y * 0.5 * _Proj11 / max(nearD, 0.1);
            float k = smoothstep(40.0, 260.0, figPx);
            float innerF = smoothstep(70.0, 260.0, figPx);
            float alpha = lerp(0.5, 1.0, smoothstep(20.0, 140.0, figPx));
            float nd; float3 nk;
            float4 fS = inkLines(euv, lerp(1.0, silW * _PixelRatio, k), false, nd, nk);
            float4 fI = _PostLite > 0.5 ? fS : inkLines(euv, lerp(1.0, inW * _PixelRatio, k), true, nd, nk);
            float outline = fS.x * alpha * lerp(1.0 - figure, 1.0, k);
            ink = saturate(max(outline, max(max(fI.y, fI.z * 0.85) * broken, fI.w * 0.8 * (1.0 - face)) * lerp(innerF, 1.0, 1.0 - figure)));
          }
        }

        // ---- 1b. line weight and colour by material (materials.js LINE): its owner's, this surface or the shape in front
        float3 lineC = _Ink;
        if (ink > 0.02 && hero < 0.5) {
          bool own = !isSky && ownK.z < 0.5 * _DepthThresh;
          float4 Ao = tA(own ? euv : ownK.xy);
          float lq = floor(Ao.a * 0.5);
          if (lq > 0.5) {
            float wq = lq - 4.0 * floor(lq * 0.25), tq = floor(lq * 0.25);
            float4 pick = float4(wq == 0.0, wq == 1.0, wq == 2.0, wq == 3.0);
            ink *= dot(pick, float4(1.0, 0.82, 0.66, 0.5)) * (own ? 1.0 : dot(pick, float4(1.0, 0.45, 0.0, 0.0)));
            lineC = lerp(_Ink, Ao.rgb * _ShadowTint * 0.62, tq / 3.0);
          }
        }
        float heroInk = max(heroBoundary * 0.82, max(eI.y, eI.z) * 0.22 * heroDetail * hero);
        ink = lerp(ink, heroInk, heroNear);
        float fogLine = 1.0 - exp(-max(nearD * toRange - _FogStart, 0.0) * _FogDensity * _FogMul * 1.4);
        ink *= 1.0 - fogLine;
        float2 hz = 0;
        #if defined(MEMENTO_INK_HAZE)
        {
          hz = hazeAt((isSky ? nearD : depth) * toRange, rd);
          ink *= (1.0 - hz.x * 0.85) * (1.0 - hz.y);
        }
        #endif

        float3 col;
        if (isSky) {
          float skyInk;
          col = renderSky(rd, skyInk);
          ink = max(ink, skyInk * (1.0 - _Backdrop.a));
          col = lerp(col, _Backdrop.rgb, _Backdrop.a);
        } else {
          // ---- 2. two-tone cel shading, each surface its own shade (materials.js SHADE)
          float3 albedo = A.rgb;
          float L = A.a;
          float lit = smoothstep(_Toon - 0.01, _Toon + 0.01, L);
          float castLift = castPot * (1.0 - lit) * smoothstep(0.08, 0.2, L);
          lit = max(lit, castLift);
          float inkMass = inkPot * (1.0 - lit) * smoothstep(0.08, 0.2, L) * (1.0 - emitHere) * (1.0 - _Flatten) * (1.0 - _Night * 0.5);
          float3 shadowTint = _ShadowTint;
          float tintV = dot(_ShadowTint, float3(0.3, 0.55, 0.15));
          shadowTint = lerp(shadowTint, tintV * float3(1.06, 0.98, 0.9), shadeHue * (1.0 - 0.6 * _Night));
          if (face > 0.5) shadowTint = lerp(_ShadowTint, tintV * float3(1.13, 0.93, 0.8), 0.72 * (1.0 - 0.6 * _Night));
          float3 shadeC = albedo * shadowTint;
          float flatHere = ownFlat ? shadowFlat : shadowFlat * (1.0 - max(figure, hero));
          if (flatHere > 0.0 && face < 0.5) shadeC = lerp(shadeC, shadowTint * (0.45 + 0.7 * dot(albedo, float3(0.3, 0.55, 0.15))), flatHere);
          shadeC = lerp(shadeC, albedo * _LightTint, face > 0.5 ? 0.0 : shadeLift);
          float3 shade = lerp(shadeC, albedo * _LightTint, _Flatten);
          float glow = surface.a - 2.0 * hero;
          col = lerp(shade, albedo * lerp(_LightTint, float3(1.12, 1.12, 1.12), glow), lit);
          col = lerp(col, lerp(albedo * 1.1, float3(1, 1, 1), 0.3), emitHere);   // a light: a bright flat core
          col = lerp(col, lerp(col, albedo * _LightTint, 0.3), hero);
          col *= 1.0 + _Highlight * smoothstep(0.9, 0.92, L);
          // ---- 3. hatching in shadow; drawn detail (over 1: a pen line, darker)
          float hFade = (1.0 - smoothstep(150.0, 700.0, depth)) * _HatchOn * (1.0 - _Flatten);
          hFade *= lerp(1.0, 0.12 * heroDetail, hero) * (1.0 - castLift) * (1.0 - inkMass);
          float3 H = surface.rgb;
          H.b *= lerp(1.0, heroDetail, hero) * innerK;
          hFade *= innerK;
          float drawnK = lerp(lerp(0.6, 0.86, 1.0 - lit), 0.88, hero);
          col = lerp(col, _Ink, (saturate(H.b) * drawnK + saturate(H.b - 1.0) * (0.92 - drawnK)) * (1.0 - smoothstep(120.0, 600.0, depth)));
          if (hFade > 0.0) col = lerp(col, _Ink, saturate(max(H.r, H.g)) * hFade * 0.55);
          // ---- 3b. crease shading (not between grass blades, nor on a face)
          if (_AO > 0.0 && depth < 260.0 && hero < 0.5 && soft < 0.5 && face < 0.5) {
            float ao = creaseAO(uv, N.xyz, depth, fc) * (1.0 - smoothstep(80.0, 260.0, depth)) * _AO * (1.0 - emitHere);
            col = lerp(col, col * _ShadowTint * 0.85, smoothstep(0.15, 0.7, ao) * 0.55);
            ink = max(ink, smoothstep(0.6, 0.9, ao) * 0.45 * innerK);
            col = lerp(col, _Ink * 1.15, smoothstep(0.72, 0.97, ao) * _Crevice * (1.0 - L * 0.5) * innerK);
          }
          // ---- 3b'. weathered walls: the dust splashed up the foot of the wall (one probe down to the ground)
          if (wearW > 0.5 && depth < 220.0 && abs(N.y) < 0.5) {
            const float bandH = 0.62;
            float3 wpP = _CamWorld._m03_m13_m23 + rd * depth / max(dot(rd, -camZ), 0.2);
            float dyPx = clamp(bandH * 1.6 * _Proj11 * 0.5 * _Res.y / depth, 1.0, 120.0);
            float2 puv = uv - float2(0.0, dyPx * _Res.w);
            float4 Np = tN(puv);
            if (Np.w > 0.0 && Np.y > 0.7) {
              float3 rp = viewRay(puv);
              float3 wpG = _CamWorld._m03_m13_m23 + rp * Np.w / max(dot(rp, -camZ), 0.2);
              float hUp = wpP.y - wpG.y;
              float rag = (vnoise(float2(wpP.x + wpP.z, 0.0) * 1.7) - 0.5) * 0.22;
              float band = (1.0 - smoothstep(bandH - 0.02 + rag, bandH + 0.02 + rag, hUp)) * step(-0.3, hUp) * (1.0 - smoothstep(150.0, 220.0, depth));
              col = lerp(col, col * float3(0.82, 0.78, 0.73), band * 0.88);
            }
          }
          // ...and where sand banks against a weathered wall that band is buried: the dust drawn on the bank's top
          // edge instead (drift pixels, a probe up the screen that lands on a weathered wall just behind)
          if (drift > 0.5 && depth < 220.0) {
            float3 wpD = _CamWorld._m03_m13_m23 + rd * depth / max(dot(rd, -camZ), 0.2);
            float rag = 0.75 + 0.5 * vnoise(float2(wpD.x + wpD.z, wpD.y) * 1.7);
            float dyPx = clamp(0.62 * 0.6 * rag * _Proj11 * 0.5 * _Res.y / depth, 1.0, 90.0);
            float2 puv = uv + float2(0.0, dyPx * _Res.w);
            float4 Np = tN(puv);
            if (Np.w > depth - 0.5 && Np.w < depth + 3.0 && abs(Np.y) < 0.5) {
              float wearP = step(15.5, tH(puv).b);
              col = lerp(col, col * float3(0.82, 0.78, 0.73), wearP * 0.88 * (1.0 - smoothstep(150.0, 220.0, depth)));
            }
          }
          // ---- 3c. spot blacks: a shaded pocket filled with the world's darkest tone; cast shadows toward it
          #if defined(MEMENTO_INK_SPOT)
          if (_Spot.x > 0.0 && lit < 0.99 && spotMat > 0.0 && depth < 600.0 && face + figure + hero + soft < 0.5 && emitHere < 0.5) {
            float3 spotC = _SpotTone.rgb * lerp(float3(1, 1, 1), clamp(albedo * 2.2, 0.0, 1.6), _SpotTone.a);
            float k = _Spot.x * spotMat * (1.0 - _Night * 0.5) * (1.0 - smoothstep(350.0, 600.0, depth)) * (1.0 - _Flatten) * (1.0 - lit);
            float encl = enclosure(uv, N.xyz, depth, _Spot.y, _PostLite > 0.5 ? 4 : 8);
            float spot = smoothstep(_Spot.z - 0.03, _Spot.z + 0.03, encl) * (1.0 - shadeLift);
            float castK = smoothstep(0.05, 0.2, dot(N.xyz, _SunDir)) * (1.0 - shadeLift) * _Spot.w;
            col = lerp(col, spotC, castK * k);
            col = lerp(col, spotC, spot * k);
          }
          // ---- 3d. ink shadows: a cast shadow printed as one flat mass of the spot tone (post.js uInkShadow)
          #endif
          if (inkMass > 0.0) col = lerp(col, _SpotTone.rgb * lerp(float3(1, 1, 1), clamp(albedo * 2.2, 0.0, 1.6), _SpotTone.a), inkMass);
          // ---- 4. atmospheric perspective in flat layers, by distance
          float fog = 1.0 - exp(-max(depth * toRange - _FogStart, 0.0) * _FogDensity * _FogMul);
          float fb = fog * 4.0;
          float fogQ = (floor(fb) + smoothstep(0.42, 0.58, frac(fb))) / 4.0;
          fog = lerp(fog, fogQ, _HazeBands);
          float3 skyC = skyBase(rd);
          if (_Haze.a > 0.0) skyC = lerp(skyC, _Haze.rgb, _Haze.a * (1.0 - _Night));
          float aer = smoothstep(0.0, 0.55, fog) * _Aerial;
          float luma = dot(col, float3(0.3, 0.55, 0.15));
          col = lerp(col, lerp(luma.xxx, skyC, 0.35) * 1.04, aer * 0.4);
          // ---- 4b. haze in layers by depth, the far fog over them, the fog by height
          float3 hazeC = lerp(skyC, _HazeTone.rgb, _HazeTone.a * (1.0 - 0.7 * _Night));
          col = lerp(col, hazeC, hz.x);
          col = lerp(col, skyC, fog);
          col = lerp(col, lerp(hazeC, _HeightFogTone.rgb, _HeightFogTone.a * (1.0 - 0.7 * _Night)), hz.y);
        }
        if (dbg == 6) col = float3(0.97, 0.94, 0.86);
        // no ink eats a light; grass edges in a darker green on the blade's own side; banked sand's soft meeting line
        ink *= 1.0 - emitHere * 0.7;
        float3 inkC = lerp(lineC, _Ink, heroNear);
        if (softNear > 0.5 && !isSky) {
          inkC = lerp(lerp(_Ink, col * 0.62, 0.85), _Ink, grassNear.x);
          ink = (soft > 0.5 ? min(ink, eS.x) * lerp(0.75, 1.0, grassNear.x) : ink * lerp(0.22, 1.0, grassNear.x)) * (1.0 - grassNear.y);
        }
        if (driftNear > 0.5 && softNear < 0.5) { inkC = lerp(_Ink, col * 0.6, 0.55); ink *= 0.45; }
        col = lerp(col, inkC, ink);

        // ---- 4b. light: a halo round glowing things in flat rings, a wash of their colour on what is near
        if (_Bloom > 0.0)
        {
          float3 b = _GBloom.SampleLevel(sampler_linear_clamp, uv, 0).rgb, w = _GBloom2.SampleLevel(sampler_linear_clamp, uv, 0).rgb;
          float bl = max(b.r, max(b.g, b.b)), wl = max(w.r, max(w.g, w.b));
          if (wl > 0.003 || bl > 0.003)
          {
            float k = _Bloom * lerp(0.6, 1.0, _Night);
            float3 light = lerp((b + w) / max(bl + wl, 1e-4), 1.0, 0.45);
            float r1 = smoothstep(0.14, 0.16, bl), r2 = max(r1, smoothstep(0.05, 0.058, wl));
            float out1 = 1.0 - emitHere;
            col = lerp(col, light, (r1 * 0.5 + (r2 - r1) * 0.22) * k * out1);
            col += w * (0.4 + 0.6 * _Night) * _Bloom * out1;
          }
        }
        // ---- 5. weather, drawn on the page like the rest: a sandstorm's haze and its streaks of blown sand
        if (_Storm > 0.0)
        {
          float nearK = isSky ? 1.0 : smoothstep(4.0, 90.0, depth);
          col = lerp(col, _StormColor, _Storm * (0.25 + 0.55 * nearK));
          float2 sp = float2(fc.x * 0.6 - _MTime * 900.0, fc.y);
          float row = floor(sp.y / 6.0);
          float hr = hash(float2(row, 3.7));
          float dash = smoothstep(0.82, 0.86, frac(sp.x / (180.0 + hr * 260.0) + hr * 7.0)) * step(0.55, hr);
          float thin = 1.0 - smoothstep(0.6, 1.2, abs(frac(sp.y / 6.0) - 0.5) * 6.0);
          col = lerp(col, _Ink * 0.6 + _StormColor * 0.4, dash * thin * _Storm * 0.45);
        }
        if (_Rain > 0.0)
        {
          col *= 1.0 - 0.1 * _Rain;
          float2 rp = float2(fc.x + fc.y * 0.22, fc.y + _MTime * 1100.0);
          float colId = floor(rp.x / 11.0);
          float h1 = hash(float2(colId, 1.3)), h2 = hash(float2(colId, 8.1));
          float len = 26.0 + h1 * 40.0;
          float v = frac((rp.y + h2 * 900.0) / (len * 6.0));
          float stroke = (1.0 - smoothstep(0.0, 0.16, v)) * step(0.35, h1);
          float w = 1.0 - smoothstep(0.35, 0.9, abs(frac(rp.x / 11.0) - 0.5) * 11.0);
          float wet = _RainNear > 0.0 ? smoothstep(_RainNear * 0.7, _RainNear, depth) : 1.0;
          col = lerp(col, _Ink, stroke * w * _Rain * 0.5 * wet);
        }
        // (no paper grain or vignette: nothing fixed to the screen)
        // ---- 7. the cinema (src/ship/cinema.js): the alarm's red, eyelids, the letterbox, a fade
        col = lerp(col, col * float3(1.0, 0.42, 0.38) + float3(0.16, 0.0, 0.0), _CineRed);
        float lid = _CineLids * 0.5;
        float lidY = abs(uv.y - 0.5) - (0.5 - lid) + 0.04 * sin(uv.x * 3.14159) * lid;
        col = lerp(col, float3(0.03, 0.025, 0.03), smoothstep(-0.004, 0.004, lidY) * step(0.001, _CineLids));
        col = lerp(col, float3(0.11, 0.09, 0.09), step(abs(uv.y - 0.5), 0.5) * step(0.5 - _CineBars * 0.11, abs(uv.y - 0.5)));
        col = lerp(col, _CineFadeColor.rgb, _CineFade);
        return float4(toLinear(saturate(col)), 1.0);
      }
      ENDHLSL
    }
  }
}
