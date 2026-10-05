// Memento ink composite: the port of the web game's Moebius pass (src/post.js).
// Reads the G-buffer written by Memento/Surface and draws the page:
//   1. ink lines from depth (Laplacian of 1/z), normal creases, albedo and shadow boundaries,
//      with a hand-inked wobble, thinner with distance
//   2. two-tone cel shading (albedo in light, albedo x the lavender shadow tint in shade)
//   3. the surface-anchored hatching in shade, drawn detail lines
//   4. crease shading, aerial perspective and banded fog
//   5. the printed sky: flat colour, dots, the cumulus bank, the sun disc, flat inked clouds
//   6. paper fibre and the vignette
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
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

      Texture2D _GAlbedo, _GNormal, _GHatch;

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
      float4 _Planet0, _PlanetColor0;
      float _Debug;

      struct V2F { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; };
      V2F vert(uint id : SV_VertexID)
      {
        V2F o;
        float2 uv = float2((id << 1) & 2, id & 2);
        o.pos = float4(uv * 2.0 - 1.0, 0.0, 1.0);
        #if UNITY_UV_STARTS_AT_TOP
          o.pos.y = -o.pos.y;
        #endif
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
        c = lerp(c, lerp(_SkyHorizon, _SkyTop, smoothstep(0.0, 0.07, h)), _SkyFlat);
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

      float4 inkLines(float2 uv, float w, bool interior, out float minDepth)
      {
        float2 px = max(w, 1.0) * _Res.zw;
        float4 c = tN(uv), n1 = tN(uv + float2(px.x, 0)), n2 = tN(uv - float2(px.x, 0)), n3 = tN(uv + float2(0, px.y)), n4 = tN(uv - float2(0, px.y));
        float big = 1e7;
        minDepth = min(min(c.w > 0.0 ? c.w : big, min(n1.w > 0.0 ? n1.w : big, n2.w > 0.0 ? n2.w : big)), min(n3.w > 0.0 ? n3.w : big, n4.w > 0.0 ? n4.w : big));
        float ic = invDepth(c.w), i1 = invDepth(n1.w), i2 = invDepth(n2.w), i3 = invDepth(n3.w), i4 = invDepth(n4.w);
        float mx = max(max(max(ic, i1), max(i2, i3)), i4);
        float lap = abs(i1 + i2 - 2.0 * ic) + abs(i3 + i4 - 2.0 * ic);
        float dEdge = smoothstep(_DepthThresh, _DepthThresh * 1.6, lap / max(mx, 1e-7));
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
          float s = step(_Toon, a.a);
          float ds = max(max(abs(s - step(_Toon, a1.a)), abs(s - step(_Toon, a2.a))), max(abs(s - step(_Toon, a3.a)), abs(s - step(_Toon, a4.a))));
          sEdge = ds * _ShadowEdges * (1.0 - _Flatten);
        }
        return float4(dEdge, nEdge, aEdge, sEdge);
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
        float ao = 0.0;
        for (int i = 0; i < 8; i++) {
          float a = a0 + float(i) * 2.39996;
          float rr = rpx * sqrt((float(i) + 0.5) / 8.0);
          float2 suv = uv + float2(cos(a), sin(a)) * rr * _Res.zw;
          float sd = tN(suv).w;
          if (sd <= 0.0) continue;
          float3 v = viewPos(suv, sd) - P;
          float dist = length(v);
          ao += max(dot(nV, v / max(dist, 1e-4)) - 0.2, 0.0) * (1.0 - smoothstep(R * 0.6, R * 1.6, dist));
        }
        return saturate(ao / 8.0 * 2.2);
      }

      // a flat printed planet low in the sky (post.js drawPlanet, without rings)
      void drawPlanet(float3 rd, float4 P, float4 C, inout float3 col, inout float ink)
      {
        if (P.w <= 0.0) return;
        float3 dir = normalize(P.xyz);
        float3 e1 = normalize(cross(dir, float3(0, 1, 0)));
        float3 e2 = cross(e1, dir);
        float2 q = float2(dot(rd, e1), dot(rd, e2)) / tan(P.w);
        float r = length(q);
        float fw = min(fwidth(r), 0.5);
        if (dot(rd, dir) < 0.0) return;
        if (r < 1.0 + fw) {
          float3 nrm = normalize(q.x * e1 + q.y * e2 - sqrt(max(1.0 - r * r, 0.0)) * dir);
          float lit = smoothstep(-0.02, 0.02, dot(nrm, _SunDisc));
          float3 pc = lerp(C.rgb * _ShadowTint * 0.9, C.rgb * lerp(float3(1, 1, 1), _LightTint, 0.3), lit);
          float disc = 1.0 - smoothstep(1.0 - fw, 1.0 + fw, r);
          col = lerp(col, pc, disc);
          ink = max(ink, (1.0 - smoothstep(0.0, fw * 1.4 * _PixelRatio, abs(r - 1.0))) * 0.95);
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
        drawPlanet(rd, _Planet0, _PlanetColor0, col, ink);

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
          for (int L = 0; L < 2; L++) {
            float cell = exp2(floor(lvl) + float(L));
            float2 g = sp / cell, id = floor(g);
            float2 o = float2(hash(id + 1.3), hash(id + 7.1)) * 0.6 + 0.2;
            float present = step(hash(id + 4.4), lerp(0.18, 0.42, smoothstep(0.05, 0.6, rd.y)));
            float2 w = (frac(g) - o) * cell;
            // the mapping's inverse Jacobian: sky units back to screen pixels (round dots)
            float dd = jx.x * jy.y - jy.x * jx.y;
            float2 s = abs(dd) > 1e-12 ? float2(jy.y * w.x - jy.x * w.y, -jx.y * w.x + jx.x * w.y) / dd : float2(1e6, 1e6);
            float d = (1.0 - smoothstep(0.5 * _PixelRatio, 0.5 * _PixelRatio + 0.5, length(s))) * present;
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
        float4 N = tN(uv);
        bool isSky = N.w <= 0.0;
        float4 surface = tH(uv);
        float figure = step(3.5, surface.a);
        surface.a -= 4.0 * figure;
        float hero = step(1.5, surface.a);
        float heroHeight = max(0.0, _Subject.w) * 2.0 * _Res.y / _PixelRatio;
        float heroDetail = smoothstep(70.0, 180.0, heroHeight);
        float2 hp = max(1.0, 0.65 * _PixelRatio) * _Res.zw;
        float4 hm = float4(tH(uv + float2(hp.x, 0)).a, tH(uv - float2(hp.x, 0)).a, tH(uv + float2(0, hp.y)).a, tH(uv - float2(0, hp.y)).a);
        hm = step(1.5, hm - 4.0 * step(3.5, hm));
        float heroNear = max(hero, max(max(hm.x, hm.y), max(hm.z, hm.w)));
        float heroBoundary = heroNear - min(hero, min(min(hm.x, hm.y), min(hm.z, hm.w)));
        float depth = isSky ? 1e7 : N.w;
        float3 rd = viewRay(uv);

        int dbg = (int)(_Debug + 0.5);
        if (dbg == 2) return float4(toLinear(isSky ? skyBase(rd) : A.rgb), 1);
        if (dbg == 3) return float4(toLinear(isSky ? 0 : N.rgb * 0.5 + 0.5), 1);
        if (dbg == 4) return float4(toLinear((isSky ? 1.0 : pow(depth / 3000.0, 0.4)).xxx), 1);
        if (dbg == 5) return float4(toLinear((isSky ? 1.0 : A.a).xxx), 1);
        if (dbg == 7) { float3 H = tH(uv).rgb; return float4(toLinear((1.0 - max(max(H.r, H.g), H.b)).xxx), 1); }

        // ---- 1. ink lines with a hand-drawn wobble
        float boilT = floor(_MTime * 8.0) * _Boil;
        float2 wob = float2(vnoise(fc * 0.06 + boilT * 17.3), vnoise(fc * 0.06 + 31.7 + boilT * 11.1)) - 0.5;
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
        float press = lerp(1.0, 0.65 + 0.7 * vnoise(fc * 0.045 + boilT * 3.1), _LineVary);
        float silW = weight * lerp(1.0, 1.35, _LineVary) * press;
        float inW = weight * lerp(1.0, 0.75, _LineVary) * lerp(1.0, 0.85 + 0.3 * vnoise(fc * 0.06 + 9.0), _LineVary);
        float2 sd = (uv - _Subject.xy) * float2(_Res.x / _Res.y, 1.0);
        float subj = (1.0 - smoothstep(_Subject.w * 0.7, _Subject.w, length(sd))) * (1.0 - smoothstep(1.5, 4.0, abs(probeD - _Subject.z)));
        silW = lerp(silW, 0.65, heroNear);
        euv = lerp(euv, uv, heroNear);
        float nearD2;
        float4 eS = inkLines(euv, silW * _PixelRatio, false, nearD);
        float4 eI = inkLines(euv, inW * _PixelRatio, true, nearD2);
        nearD = min(nearD, nearD2);
        float3 wpL = _CamWorld._m03_m13_m23 + rd * min(probeD, 5000.0) / max(dot(rd, -_CamWorld._m02_m12_m22), 0.2);
        float gapN = vnoise(float2(wpL.x + wpL.y * 0.7, wpL.z - wpL.y * 0.4) * 0.9);
        float broken = lerp(1.0, smoothstep(0.22, 0.34, gapN), _LineVary * (1.0 - subj) * smoothstep(3.0, 12.0, probeD));
        float ink = saturate(max(max(eS.x, eI.y * broken), max(eI.z * 0.85 * broken, eI.w * 0.8)));

        // people far away: lines redrawn by the figure's height on screen
        float innerK = figure > 0.5 && hero < 0.5 ? smoothstep(70.0, 260.0, 1.8 * _Res.y * 0.5 * _Proj11 / max(depth, 0.1)) : 1.0;
        if (ink > 0.02 && hero < 0.5 && !isSky) {
          float2 fo = max(silW * _PixelRatio, 1.0) * _Res.zw;
          float4 fa = float4(tH(euv + float2(fo.x, 0)).a, tH(euv - float2(fo.x, 0)).a, tH(euv + float2(0, fo.y)).a, tH(euv - float2(0, fo.y)).a);
          float figHit = max(figure, max(max(step(3.5, fa.x), step(3.5, fa.y)), max(step(3.5, fa.z), step(3.5, fa.w))));
          if (figHit > 0.5) {
            float figPx = 1.8 * _Res.y * 0.5 * _Proj11 / max(nearD, 0.1);
            float k = smoothstep(40.0, 260.0, figPx);
            float innerF = smoothstep(70.0, 260.0, figPx);
            float alpha = lerp(0.5, 1.0, smoothstep(20.0, 140.0, figPx));
            float nd;
            float4 fS = inkLines(euv, lerp(1.0, silW * _PixelRatio, k), false, nd);
            float4 fI = inkLines(euv, lerp(1.0, inW * _PixelRatio, k), true, nd);
            float outline = fS.x * alpha * lerp(1.0 - figure, 1.0, k);
            ink = saturate(max(outline, max(max(fI.y, fI.z * 0.85) * broken, fI.w * 0.8) * lerp(innerF, 1.0, 1.0 - figure)));
          }
        }
        float heroInk = max(heroBoundary * 0.82, max(eI.y, eI.z) * 0.22 * heroDetail * hero);
        ink = lerp(ink, heroInk, heroNear);
        float fogLine = 1.0 - exp(-max(nearD - _FogStart, 0.0) * _FogDensity * _FogMul * 1.4);
        ink *= 1.0 - fogLine;

        float3 col;
        if (isSky) {
          float skyInk;
          col = renderSky(rd, skyInk);
          ink = max(ink, skyInk);
        } else {
          // ---- 2. two-tone cel shading
          float3 albedo = A.rgb;
          float L = A.a;
          float lit = smoothstep(_Toon - 0.01, _Toon + 0.01, L);
          float3 shade = lerp(albedo * _ShadowTint, albedo * _LightTint, _Flatten);
          float glow = surface.a - 2.0 * hero;
          col = lerp(shade, albedo * lerp(_LightTint, float3(1.12, 1.12, 1.12), glow), lit);
          col = lerp(col, lerp(col, albedo * _LightTint, 0.3), hero);
          col *= 1.0 + _Highlight * smoothstep(0.9, 0.92, L);
          // ---- 3. hatching in shadow
          float hFade = (1.0 - smoothstep(150.0, 700.0, depth)) * _HatchOn * (1.0 - _Flatten);
          hFade *= lerp(1.0, 0.12 * heroDetail, hero);
          float3 H = surface.rgb;
          H.b *= lerp(1.0, heroDetail, hero) * innerK;
          hFade *= innerK;
          col = lerp(col, _Ink, saturate(H.b) * lerp(0.6, 0.88, hero) * (1.0 - smoothstep(120.0, 600.0, depth)));
          if (hFade > 0.0) col = lerp(col, _Ink, saturate(max(H.r, H.g)) * hFade * 0.55);
          // ---- 3b. crease shading
          if (_AO > 0.0 && depth < 260.0 && hero < 0.5) {
            float ao = creaseAO(uv, N.xyz, depth, fc) * (1.0 - smoothstep(80.0, 260.0, depth)) * _AO;
            col = lerp(col, col * _ShadowTint * 0.85, smoothstep(0.15, 0.7, ao) * 0.55);
            ink = max(ink, smoothstep(0.6, 0.9, ao) * 0.45 * innerK);
          }
          // ---- 4. atmospheric perspective in flat layers
          float fog = 1.0 - exp(-max(depth - _FogStart, 0.0) * _FogDensity * _FogMul);
          float fb = fog * 4.0;
          float fogQ = (floor(fb) + smoothstep(0.42, 0.58, frac(fb))) / 4.0;
          fog = lerp(fog, fogQ, _HazeBands);
          float3 skyC = skyBase(rd);
          float aer = smoothstep(0.0, 0.55, fog) * _Aerial;
          float luma = dot(col, float3(0.3, 0.55, 0.15));
          col = lerp(col, lerp(luma.xxx, skyC, 0.35) * 1.04, aer * 0.4);
          col = lerp(col, skyC, fog);
        }
        if (dbg == 6) col = float3(0.97, 0.94, 0.86);
        col = lerp(col, _Ink, ink);

        // ---- 6. paper
        float fibre = vnoise(fc * 0.55) * 0.5 + vnoise(fc * 0.21 + 7.0) * 0.5;
        col *= 1.0 + _Grain * ((fibre - 0.5) * 0.6);
        float2 q = uv - 0.5;
        col *= 1.0 - 0.28 * pow(length(q) * 1.25, 3.0);
        return float4(toLinear(saturate(col)), 1.0);
      }
      ENDHLSL
    }
  }
}
