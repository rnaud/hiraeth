// Hiraeth ink composite: the port of the web game's Moebius pass (src/post.js).
// Reads the G-buffer written by Hiraeth/Surface and draws the page:
//   1. ink lines from depth (Laplacian of 1/z), normal creases, albedo and shadow boundaries,
//      with a hand-inked wobble, thinner with distance
//   2. two-tone cel shading (albedo in light, albedo x the lavender shadow tint in shade)
//   3. the surface-anchored hatching in shade, drawn detail lines
//   4. crease shading, aerial perspective and banded fog
//   5. the printed sky: flat colour, dots, the cumulus bank, the sun disc, flat inked clouds
//   (nothing fixed to the screen: no paper grain or vignette; the lines' noise is on the view's direction, post.js LINE_NOISE)
// Colours are the game's display values; the result is converted to linear at the end
// (the project renders in linear space and the camera target encodes sRGB).
Shader "Hidden/Hiraeth/Composite"
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
      // the look's optional passes, compiled in only where a look asks for them (post.js inkFeatures; HiraethLook sets
      // them): cast shadows darkened, haze by depth and height, cast shadows lifted, cast shadows printed as ink
      #pragma multi_compile _ HIRAETH_INK_SPOT
      #pragma multi_compile _ HIRAETH_INK_HAZE
      #pragma multi_compile _ HIRAETH_INK_CAST
      #pragma multi_compile _ HIRAETH_INK_SHADOW
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
      // the sky's own (post.js, the bridge's look; uniform branches, no variants): the eclipse (src/eclipse.js: x the cover,
      // y the discs' radius, z the corona's reach, w its style; the corona's colour and a its stars; the horizon band's colour
      // and a its height; where the eclipsed sun stands if not at the sun's place), the Lantern's light (xyz its direction,
      // w how bright: src/story/lantern-sky.js), space all round (x on, y the stars' density, z their teal share, w the
      // nebula; its tone, a the stars' size; a space world's own sun for its planets and their night side)
      float4 _Eclipse, _Corona, _EclipseGlow, _Lantern, _Space, _SpaceTone, _SpaceSun, _SpaceNight;
      float3 _EclipseDir;
      float _Debug;
      float _NoInkFar;      // 1: the far lines' fade (1c) off, a test (the bridge's -no-ink-far; issue #218)
      float _CineRed, _CineLids, _CineBars, _CineFade; float4 _CineFadeColor;   // the cinema (Cinema.cs)
      float4 _Backdrop;     // rgb, a = 1: one flat colour instead of the sky (a conversation's portrait, post.js uBackdrop)
      float _TargetFlip;   // 1: writing the back buffer itself (HiraethFeature)
      float _Rain, _RainNear, _Rays;   // weather: ink rain 0..1 and the dry radius under a roof; sun rays at a low sun (post.js uRain, uRainNear, uRays)
      // the web's newer look (post.js): each surface's shade, cast shadows darkened, lifted or inked, haze by depth and height
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
        // (a back buffer the display rotates (Vulkan's swap-chain pre-transform, the AYN Odin 3's portrait panel): the
        // triangle turned with it, as URP's own blit does (issues #716, #725); 0 into a texture and on other screens)
        #ifdef UNITY_PRETRANSFORM_TO_DISPLAY_ORIENTATION
          o.pos = ApplyPretransformRotation(o.pos);
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
        c = lerp(c, lerp(_SkyHorizon, _SkyTop, lerp(0.45, 1.0, smoothstep(0.0, 0.03, h))), _SkyFlat);
        float sd = max(dot(rd, _SunDisc), 0.0);
        c = lerp(c, _SkyHorizon * float3(1.03, 1.0, 0.96), pow(sd, 8.0) * 0.5 * (1.0 - h) * (1.0 - _Night) * (1.0 - step(1e-5, _Eclipse.y) * _Eclipse.x) * (1.0 - _Space.x));
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
      // (a white line, makeMaterial({ lineWhite }), is stored in the sign bit: −(1 + L + 2 × step); issue #264, surfaces D)
      float lightOf(float a) { a = a < 0.0 ? -a - 1.0 : a; return a - 2.0 * floor(a * 0.5); }
      // (the same as post.js reads, src/relief.js RELIEF_READ_GLSL: tests/relief.test.js holds them together)
      // ---------------------------------------------------------------- painted relief, read back (src/relief.js, issue 700)
      float reliefOf(float len) { return len > 0.955 && len < 0.995 ? clamp((0.975 - len) / 0.015, -1.0, 1.0) : 0.0; }
      float3 reliefNormal(float3 n) { float l = length(n); return l > 0.955 && l < 0.995 ? n / l : n; }
      float3 reliefApply(float3 alb, float k) {
        if (k > 0.0) return max(alb, min(alb + min(alb * 0.16, ((float3)(0.065))) * k, ((float3)(0.9))));
        return alb + min(alb * 0.16, ((float3)(0.065))) * k;
      }
      // gSliver (set by each inkLines, read by 1a on inked pixels only: post.js, issue #538): how far this pixel differs from
      // its neighbours on BOTH sides across: x the nearer neighbour's depth across (the sky far), y its own depth, z the
      // smaller normal difference across, w the smaller colour difference. Nearer than both, or a crease or a colour edge on
      // both sides: a feature a kernel or two wide (a stem, a far petal, a lit circuit), which its line keeps off (INK_SIZE)
      static float4 gSliver;
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
        float4 nf = lerp((float4)1e7, float4(n1.w, n2.w, n3.w, n4.w), step(1e-6, float4(n1.w, n2.w, n3.w, n4.w)));
        gSliver = float4(max(min(nf.x, nf.y), min(nf.z, nf.w)), c.w, 0.0, 0.0);
        float nEdge = 0.0;
        if (c.w > 0.0 && interior) {
          // (a normal carrying the painted relief in its length, back to unit length: src/relief.js)
          float3 cN = reliefNormal(c.xyz);
          float d1 = n1.w > 0.0 ? 1.0 - dot(cN, reliefNormal(n1.xyz)) : 0.0;
          float d2 = n2.w > 0.0 ? 1.0 - dot(cN, reliefNormal(n2.xyz)) : 0.0;
          float d3 = n3.w > 0.0 ? 1.0 - dot(cN, reliefNormal(n3.xyz)) : 0.0;
          float d4 = n4.w > 0.0 ? 1.0 - dot(cN, reliefNormal(n4.xyz)) : 0.0;
          nEdge = smoothstep(_NormalThresh, _NormalThresh * 1.5, max(max(d1, d2), max(d3, d4)));
          gSliver.z = max(min(d1, d2), min(d3, d4));
        }
        float aEdge = 0.0, sEdge = 0.0;
        if (c.w > 0.0 && interior && (_AlbedoEdges > 0.0 || _ShadowEdges > 0.0)) {
          float4 a = tA(uv), a1 = tA(uv + float2(px.x, 0)), a2 = tA(uv - float2(px.x, 0)), a3 = tA(uv + float2(0, px.y)), a4 = tA(uv - float2(0, px.y));
          float4 dq = float4(length(a.rgb - a1.rgb), length(a.rgb - a2.rgb), length(a.rgb - a3.rgb), length(a.rgb - a4.rgb));
          float da = max(max(dq.x, dq.y), max(dq.z, dq.w));
          aEdge = smoothstep(0.08, 0.14, da) * _AlbedoEdges;
          gSliver.w = max(min(dq.x, dq.y), min(dq.z, dq.w)) * step(1e-3, _AlbedoEdges);
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
      // the crease shading (post.js creaseAO, CREASE, CREASE_TAPS): one golden-angle spiral of 48 taps shared out over the
      // 2 x 2 quad (12 each, lane = x + 2y in the quad), the same for every quad (no random turn: that drew a grey speckle
      // crawling in every room, issue #322), each weighing 1 - 0.6 r^2 by how far out it lies; frag averages the four
      // lanes over the quad (quadMean), so the shading falls off smoothly from a corner
      // (self: this point on a mover, a foe or the drone, +64 in gHatch.a: its own pockets its own; a tap on another one is
      // seen past like a person's, post.js notStanding; issue #264, surfaces D)
      float creaseAO(float2 uv, float3 nW, float d, float self, int lane)
      {
        float3 P = viewPos(uv, d);
        float3 nV = normalize(mul(transpose((float3x3)_CamWorld), nW));
        float R = 1.3;
        float rpx = clamp(R * _Proj11 * 0.5 * _Res.y / d, 3.0, 48.0);
        float ao = 0.0, seen = 0.0;
        for (int i = 0; i < 12; i++) {
          float k = float(i * 4 + lane);
          float a = 0.4 + k * 2.39996;
          float rn = sqrt((k + 0.5) / 48.0), w = 1.0 - 0.6 * rn * rn;
          float2 suv = uv + float2(cos(a), sin(a)) * rn * rpx * _Res.zw;
          float sd = tN(suv).w;
          if (sd <= 0.0) { seen += w; continue; }   // (the sky: open)
          float3 v = viewPos(suv, sd) - P;
          float dist = length(v);
          float cc = max(dot(nV, v / max(dist, 1e-4)) - 0.2, 0.0) * (1.0 - smoothstep(R * 0.6, R * 1.6, dist));
          // (grass blades close nothing in; a tap on a person isn't counted at all, open or closed: post.js notPerson)
          float ha = tH(suv).a, t = fmod(ha, 16.0), np = step(fmod(t, 8.0), 1.5) * max(step(ha, 63.5), self);
          ao += cc * step(t, 7.5) * np * w; seen += np * w;
        }
        return saturate(ao / max(seen, 0.6) * 2.2);
      }
      // the mean of v over the pixel's 2 x 2 quad, from its derivatives (post.js quadMean): uniform control flow only
      float quadMean(float v, float2 pos)
      {
        float2 q = fmod(floor(pos), 2.0);
        float h = v + 0.5 * (q.x < 0.5 ? 1.0 : -1.0) * ddx(v);
        return h + 0.5 * (q.y < 0.5 ? 1.0 : -1.0) * ddy(h);
      }
      // (the spot blacks' enclosure that was here is gone, as in post.js: issue #322)
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
          float3 Lp = _SpaceSun.w > 0.5 ? normalize(_SpaceSun.xyz) : _SunDisc;   // (a space world's planets lit by their own sun)
          float lit = smoothstep(-0.02, 0.02, dot(nrm, Lp));
          float3 pc = lerp(lerp(C.rgb * _ShadowTint * 0.9, _SpaceNight.rgb, _SpaceNight.a), C.rgb * lerp(float3(1, 1, 1), _LightTint, 0.3), lit);
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

      // the Lantern's light low in the sky (post.js drawLantern): a small inked disc, four needle rays, two flat gold washes
      // with a dotted ink ring, larger and brighter (Lt.w) as the end nears
      void drawLantern(float3 rd, float4 Lt, inout float3 col, inout float ink)
      {
        float3 dir = normalize(Lt.xyz + float3(0, 1e-5, 0));
        float3 e1 = normalize(cross(dir, float3(0.0, 1.0, 0.0)) + 1e-6);
        float3 e2 = cross(e1, dir);
        float2 q = float2(dot(rd, e1), dot(rd, e2));
        float pw = max(max(fwidth(q.x), fwidth(q.y)), 1e-6);
        if (Lt.w <= 0.0 || dot(rd, dir) <= 0.0) return;
        float s = saturate(Lt.w), px = _PixelRatio;
        float u = lerp(0.0072, 0.0125, s), r = length(q);
        float breathe = 1.0 + 0.05 * sin(_MTime * 1.3);
        float3 gold = float3(0.98, 0.8, 0.42), pale = float3(1.0, 0.97, 0.86);
        float h2 = u * lerp(4.2, 7.5, s) * breathe, h1 = u * lerp(2.3, 3.4, s) * breathe;
        float w2 = 1.0 - smoothstep(h2 - pw, h2 + pw, r), w1 = 1.0 - smoothstep(h1 - pw, h1 + pw, r);
        col = lerp(col, lerp(col, gold, 0.6), w2 * lerp(0.22, 0.42, s));
        col = lerp(col, lerp(col, pale, 0.75), w1 * lerp(0.4, 0.62, s));
        float dots = step(0.45, frac(atan2(q.y, q.x) * 3.0 + _MTime * 0.05));
        ink = max(ink, (1.0 - smoothstep(0.0, pw * 1.1 * px, abs(r - h1))) * dots * lerp(0.35, 0.6, s));
        float2 a = abs(q);
        float lv = u * lerp(6.5, 14.0, s), lh = u * lerp(3.5, 8.0, s);
        float tv = u * 0.4 * saturate(1.0 - a.y / lv) + pw * 0.35, th = u * 0.4 * saturate(1.0 - a.x / lh) + pw * 0.35;
        float ray = max((1.0 - smoothstep(tv - pw * 0.5, tv + pw * 0.5, a.x)) * step(a.y, lv), (1.0 - smoothstep(th - pw * 0.5, th + pw * 0.5, a.y)) * step(a.x, lh));
        col = lerp(col, pale, ray * lerp(0.75, 1.0, s));
        col = lerp(col, pale, 1.0 - smoothstep(u - pw, u + pw, r));
        ink = max(ink, 1.0 - smoothstep(0.0, pw * 1.2 * px, abs(r - u)));
      }

      // the eclipse (post.js drawEclipse): the moon's black disc over the sun, its bright limb, the corona's fine rays
      // and / or stipple and two flat halo bands in totality; out of it only the moon's bite out of the sun
      void drawEclipse(float3 rd, float3 sun, float ang, float aa, float sunR, inout float3 col, inout float ink)
      {
        float R = _Eclipse.y, cover = _Eclipse.x, px = _PixelRatio;
        float3 s1 = normalize(cross(sun, float3(0.0, 1.0, 0.0)) + 1e-5), s2 = cross(s1, sun);
        float3 md = normalize(sun + (s1 * 0.8 - s2 * 0.6) * (1.0 - cover) * 2.05 * R);
        float ma = acos(clamp(dot(rd, md), -1.0, 1.0));
        float total = smoothstep(0.93, 1.0, cover);
        float u = ang / R;
        if (total > 0.0 && u < 2.0 + _Eclipse.z) {
          float2 q = float2(dot(rd, s1), dot(rd, s2)) / R;
          float b1 = 1.0 - smoothstep(1.0 + _Eclipse.z * 0.3 - aa / R, 1.0 + _Eclipse.z * 0.3 + aa / R, u);
          float b2 = 1.0 - smoothstep(1.0 + _Eclipse.z * 0.7 - aa / R, 1.0 + _Eclipse.z * 0.7 + aa / R, u);
          col = lerp(col, lerp(col, _Corona.rgb, 0.18), (b1 * 0.6 + b2 * 0.4) * total);
          float N = 260.0, phi = atan2(q.y, q.x), k = phi / 6.2832 * N, id = floor(k), f = frac(k);
          float cellPx = ang * 6.2832 / N / max(aa, 1e-7);
          float hl = hash(float2(id, 7.3)), len = 1.0 + _Eclipse.z * (0.2 + 0.8 * hl * hl);
          float jit = (hash(float2(id, 3.1)) - 0.5) * 0.5;
          float wpx = lerp(0.55, 1.1, hash(float2(id, 5.7))) * px;
          float ray = (1.0 - smoothstep(wpx * 0.5, wpx * 0.5 + 0.9, abs(f - 0.5 - jit * 0.6) * cellPx)) * step(1.0, u)
            * (1.0 - smoothstep(lerp(1.0, len, 0.55), len, u)) * step(hash(float2(id, 2.1)), 0.82) * smoothstep(1.3, 2.6, cellPx);
          float pxQ = aa / R, lvl = log2(max(pxQ * 3.2 * px, 1e-7)), cell = exp2(floor(lvl));
          float2 g = q / cell, cid = floor(g), o = float2(hash(cid + 1.3), hash(cid + 7.1)) * 0.8 + 0.1;
          float dens = exp(-(u - 1.0) / max(_Eclipse.z * 0.38, 1e-3)) * 0.95;
          float size = lerp(0.35, 0.8, hash(cid + 2.9)) * px;
          float dots = (1.0 - smoothstep(size, size + 0.6, length(frac(g) - o) * cell / pxQ)) * step(hash(cid + 4.4), dens) * step(1.0, u);
          float cor = max(ray * saturate(1.6 - 1.6 * _Eclipse.w), dots * saturate(1.6 * _Eclipse.w));
          col = lerp(col, _Corona.rgb, cor * total);
        }
        float rw = max(R * 0.035, aa * 1.2 * px);
        float ring = (1.0 - smoothstep(rw - aa, rw + aa, abs(ma - R - rw))) * total;
        col = lerp(col, lerp(_Corona.rgb, float3(1.0, 0.98, 0.94), 0.6), ring);
        float inSun = 1.0 - smoothstep(sunR - aa, sunR + aa, ang);
        float mdisc = (1.0 - smoothstep(R - aa, R + aa, ma)) * max(inSun, total) * step(0.001, cover);
        col = lerp(col, float3(0.012, 0.012, 0.03), mdisc);
        ink = max(ink, (1.0 - smoothstep(0.0, aa * 1.2 * px, abs(ma - R))) * inSun * step(0.001, cover) * (1.0 - total));
      }

      // space all round (post.js drawSpace): a nebula in two flat steps of its tone, and stars on both caps
      void drawSpace(float3 rd, inout float3 col)
      {
        float px = _PixelRatio;
        float2 sp = rd.xz / (1.0 + abs(rd.y));
        float2 hemi = rd.y < 0.0 ? float2(37.1, 11.3) : float2(0.0, 0.0);
        if (_Space.w > 0.0) {
          float band = 1.0 - smoothstep(0.0, 0.55, abs(dot(rd, normalize(float3(0.35, 0.22, -0.91)))));
          float f = fbm(sp * 2.6 + 5.0) * 0.75 + band * 0.45;
          float fw = fwidth(f) * 1.2 + 1e-4;
          float n1 = smoothstep(0.62 - fw, 0.62 + fw, f), n2 = smoothstep(0.76 - fw, 0.76 + fw, f);
          col = lerp(col, lerp(col, _SpaceTone.rgb, 0.55), n1 * _Space.w);
          col = lerp(col, _SpaceTone.rgb, n2 * _Space.w);
        }
        float2 g = sp * 300.0 + hemi;
        float2 cell = floor(g);
        float hs = hash(cell), kind = hash(cell + 9.1);
        float2 o = float2(hash(cell + 3.3), hash(cell + 7.7)) * 0.6 + 0.2;
        float cw = max(max(fwidth(sp.x), fwidth(sp.y)) * 300.0, 1e-5);
        float dpx = length(frac(g) - o) / cw;
        float on = step(1.0 - lerp(0.004, 0.05, _Space.y), hs);
        float big = step(0.93, kind), size = lerp(0.45, 0.9, hash(cell + 2.2)) * (1.0 + big * 0.9) * max(_SpaceTone.a, 0.3) * px;
        float star = on * (1.0 - smoothstep(size, size + 0.9, dpx));
        float2 d = abs(frac(g) - o) / cw;
        float crossK = big * on * (1.0 - smoothstep(0.3, 0.9, min(d.x, d.y))) * (1.0 - smoothstep(size * 2.0, size * 3.6, max(d.x, d.y)));
        float3 sc = hash(cell + 5.5) < _Space.z ? float3(0.3, 0.84, 0.86) : float3(1.0, 0.97, 0.9);
        col = lerp(col, sc, saturate(max(star, crossK * 0.8)));
      }

      float3 renderSky(float3 rd, out float ink)
      {
        float3 col = skyBase(rd);
        ink = 0.0;
        float px = _PixelRatio;
        float ang = acos(clamp(dot(rd, _SunDisc), -1.0, 1.0));
        float aa = fwidth(ang);
        float r = 0.05;
        // (an eclipse world: the rose light low all round the horizon, and the sun the moon's own size: post.js)
        float eclipse = step(1e-5, _Eclipse.y), eCover = eclipse * _Eclipse.x;
        float3 sunAt = _SunDisc;
        if (eclipse > 0.0) {
          if (dot(_EclipseDir, _EclipseDir) > 0.25) { sunAt = normalize(_EclipseDir); ang = acos(clamp(dot(rd, sunAt), -1.0, 1.0)); aa = fwidth(ang); }
          float eh = rd.y, ew = fwidth(eh) * 1.2, top = _EclipseGlow.a;
          float band = (1.0 - smoothstep(top * 0.45 - ew, top * 0.45 + ew, eh)) * 0.55 + (1.0 - smoothstep(top - ew, top + ew, eh)) * 0.45;
          col = lerp(col, _EclipseGlow.rgb, band * step(-0.02, eh) * smoothstep(0.6, 1.0, eCover));
          r = _Eclipse.y * 0.985;
        }
        col = lerp(col, _SunColor, (1.0 - smoothstep(r - aa, r + aa, ang)) * (1.0 - smoothstep(0.93, 1.0, eCover)));
        ink = max(ink, (1.0 - smoothstep(0.0, aa * 1.2 * px, abs(ang - r))) * (1.0 - eCover));
        ink = max(ink, 0.5 * (1.0 - _Night) * (1.0 - smoothstep(0.0, aa * 0.7 * px, abs(ang - r * 1.6))) * (1.0 - eclipse) * (1.0 - _Space.x));
        if (eclipse > 0.0) drawEclipse(rd, sunAt, ang, aa, r, col, ink);
        // sun rays: pale wedges fanning from a low sun (post.js)
        if (_Rays > 0.0 && _SunDisc.y > -0.05) {
          float low = (1.0 - smoothstep(0.08, 0.45, _SunDisc.y)) * (1.0 - _Night) * (1.0 - eCover) * (1.0 - _Space.x);
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
        if (_Space.x > 0.0) drawSpace(rd, col);
        drawPlanet(rd, _Planet0, _PlanetColor0, _PlanetCraters.x, col, ink);
        drawPlanet(rd, _Planet1, _PlanetColor1, _PlanetCraters.y, col, ink);
        drawPlanet(rd, _Planet2, _PlanetColor2, _PlanetCraters.z, col, ink);
        if (_Lantern.w > 0.0) drawLantern(rd, _Lantern, col, ink);

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

        // stars: sparse dots at night (and in an eclipse's totality, off the moon's disc; space draws its own)
        float starsK = max(_Night, _Corona.a * eclipse * step(_Eclipse.y * 1.02, ang)) * (1.0 - _Space.x);
        if (starsK > 0.0 && rd.y > 0.0)
        {
          float2 st = rd.xz / (rd.y + 1.0) * 260.0;
          float2 sc = floor(st);
          float hs = hash(sc);
          float2 so = float2(hash(sc + 3.3), hash(sc + 7.7)) * 0.6 + 0.2;
          float sd2 = length(frac(st) - so) / max(fwidth(st.x), 1e-5);
          float star = step(0.985, hs) * (1.0 - smoothstep(0.4, 1.2 + 1.2 * step(0.996, hs), sd2 / px));
          col = lerp(col, float3(1.0, 0.97, 0.88), star * starsK * smoothstep(0.02, 0.2, rd.y));
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
        #ifdef UNITY_PRETRANSFORM_TO_DISPLAY_ORIENTATION
          // (the weather's streaks are laid out in the picture's own pixels: on a rotated back buffer SV_Position is the
          // panel's, turned a quarter, so the pixel the picture would have had is worked out from uv (issue #725))
          if (UNITY_DISPLAY_ORIENTATION_PRETRANSFORM != UNITY_DISPLAY_ORIENTATION_PRETRANSFORM_0)
            fc = float2(uv.x, _TargetFlip > 0.5 ? 1.0 - uv.y : uv.y) * _Res.xy / _PixelRatio;
        #endif
        float4 A = tA(uv);
        A.a = lightOf(A.a);   // (the line step over it: 1b)
        float4 N = tN(uv);
        // the painted relief (src/relief.js, post.js): drawn into the flat colour here, after the colour-edge test read that (issue #700)
        float reliefK = reliefOf(length(N.xyz));
        if (reliefK != 0.0) { A.rgb = reliefApply(A.rgb, reliefK); N.xyz = normalize(N.xyz); }
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
        // gHatch.a: glow + 2 hero + 4 figure + 8 soft ink (grass) + 16 a face + 32 banked sand + 64 a mover (materials.js MOVER)
        float mover = step(63.5, surface.a);
        surface.a -= 64.0 * mover;
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
        // the crease shading's occlusion (3b), here where the control flow is uniform: its quad's mean takes derivatives
        float creaseOcc = 0.0;
        if (_AO > 0.0)
        {
          float2 lq = fmod(floor(i.pos.xy), 2.0);
          if (!isSky && depth < 260.0 && hero < 0.5 && soft < 0.5 && face < 0.5) creaseOcc = creaseAO(uv, N.xyz, depth, mover, int(lq.x + 2.0 * lq.y));
          creaseOcc = quadMean(creaseOcc, i.pos.xy);
        }
        float3 rd = viewRay(uv);
        float3 camZ = _CamWorld._m02_m12_m22;
        float toRange = 1.0 / max(dot(rd, -camZ), 0.2);
        // cast shadows by world (post.js CAST): lifted toward the light (_Cast) or printed as a flat ink mass (_InkShadow)
        float castPot = 0.0, inkPot = 0.0;
        if (!isSky)
        {
          float facing = smoothstep(0.02, 0.08, dot(N.xyz, _SunDir)), ground = smoothstep(0.55, 0.8, N.y), person = 1.0 - max(max(face, figure), hero);
          #if defined(HIRAETH_INK_CAST)
          castPot = facing * lerp(_Cast.y, _Cast.x, ground) * person;
          #endif
          #if defined(HIRAETH_INK_SHADOW)
          inkPot = facing * lerp(_InkShadow.y, _InkShadow.x, ground) * person * spotMat * (1.0 - soft);
          #endif
        }

        int dbg = (int)(_Debug + 0.5);
        if (dbg == 11)
        {
          // (what the G-buffer holds where the composite sees sky: red a depth under 0, green a normal with a depth of 0, blue
          // nothing written (the clear); grey a surface)
          if (N.w > 0.0) return float4(0.5, 0.5, 0.5, 1);
          if (N.w < 0.0) return float4(1, 0, 0, 1);
          return any(N.xyz != 0.0) ? float4(0, 1, 0, 1) : float4(0, 0, 0.6, 1);
        }
        if (dbg == 10)
        {
          // (a NaN in the G-buffer, read by its bits (the compiler may take x != x for false): red the depth's (or none, the
          // sky: dark red), green the normal's, blue the albedo's; grey a surface with none)
          uint4 nb = asuint(N) & 0x7fffffffu, ab = asuint(A) & 0x7fffffffu;
          bool nanW = nb.w > 0x7f800000u, nanN = any(nb.xyz > 0x7f800000u), nanA = any(ab.rgb > 0x7f800000u);
          if (!nanW && !nanN && !nanA) return float4(isSky ? float3(0.25, 0, 0) : float3(0.5, 0.5, 0.5), 1);
          return float4(nanW ? 1 : 0, nanN ? 1 : 0, nanA ? 1 : 0, 1);
        }
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
        // (not the web's frameK, post.js INK_SIZE.frame, the lines thinned on a frame under 900 CSS px tall: measured at 1280 x
        // 720 against the web it gained nothing (twelve views' mean SSIM 0.9228 with it, 0.9238 without) and would thin every
        // line on the handhelds; issue #538)
        silW = lerp(silW, 0.65, heroNear);
        euv = lerp(euv, uv, heroNear);
        float nearD2;
        float3 ownK, ownK2;
        float4 eS, eI;
        float4 slS, slI;   // (gSliver of each kernel)
        if (_PostLite > 0.5) { eI = inkLines(euv, lerp(silW, inW, 0.5) * _PixelRatio, true, nearD2, ownK); eS = eI; nearD = nearD2; slS = gSliver; slI = gSliver; }
        else { eS = inkLines(euv, silW * _PixelRatio, false, nearD, ownK); slS = gSliver; eI = inkLines(euv, inW * _PixelRatio, true, nearD2, ownK2); slI = gSliver; }
        nearD = min(nearD, nearD2);
        float3 wpL = _CamWorld._m03_m13_m23 + rd * min(probeD, 5000.0) / max(dot(rd, -camZ), 0.2);
        float gapN = vnoise(float2(wpL.x + wpL.y * 0.7, wpL.z - wpL.y * 0.4) * 0.9);
        float broken = lerp(1.0, smoothstep(0.22, 0.34, gapN), _LineVary * (1.0 - subj) * smoothstep(3.0, 12.0, probeD));
        float ink = saturate(max(max(eS.x, eI.y * broken), max(eI.z * 0.85 * broken, eI.w * 0.8 * (1.0 - face) * (1.0 - castPot))));

        // ---- 1a. lines by the size of what they draw (post.js INK_SIZE; rendering.md "Ink lines by size on screen"; never
        // ported before issue #538: the Rose House's lit circuits were eaten by their own line). On a sliver (this pixel
        // differs from both sides: a stem, a petal, a lit line a kernel or two wide) the line keeps off and its colour shows;
        // beside a depth edge, where the shape in front is no thicker than one or three kernels, the line is lighter
        if (ink > 0.02 && hero < 0.5 && !isSky) {
          // (a kernel under a render pixel is drawn a pixel wide: it carries its coverage instead, down to minAlpha)
          ink *= clamp(_PixelRatio * 1.60, 0.70, 1.0);
          float sD = slS.y > 0.0 ? smoothstep(0.040, 0.100, (slS.x - slS.y) / slS.y) : 0.0;
          float sI = max(slI.y > 0.0 ? smoothstep(0.040, 0.100, (slI.x - slI.y) / slI.y) : 0.0,
            max(smoothstep(_NormalThresh, _NormalThresh * 1.5, slI.z), smoothstep(0.08, 0.14, slI.w)));
          ink *= lerp(1.0, 0.30, max(sD * eS.x, sI * max(eI.y, eI.z)) / max(ink, 1e-3));
          if (ownK.z > 0.5 * _DepthThresh && eS.x > 0.02) {
            float2 dk = ownK.xy - euv;
            float da = tN(ownK.xy + dk).w, db = tN(ownK.xy + 3.0 * dk).w;
            float2 back = smoothstep(0.040, 0.100, (lerp((float2)1e7, float2(da, db), step(1e-6, float2(da, db))) - nearD) / max(nearD, 1e-3));
            ink *= lerp(1.0, 0.45, max(back.x, 0.5 * back.y));
          }
        }

        // ---- 1c. lines on detail under a pixel (post.js INK_FAR; rendering.md "Far lines that would alias", issues #225, #218):
        // where the worlds' finest drawn detail (0.25 m) is a pixel or two across, its lines are drawn lighter (silhouettes
        // less so), so they no longer flip whole pixels from paper to black as the camera moves. By the size on screen
        if (ink > 0.02 && hero < 0.5 && _NoInkFar < 0.5) {
          float detailPx = 0.250 * _Proj11 * 0.5 * _Res.y / max(nearD, 1e-3);
          float sil = smoothstep(0.0, 0.25, eS.x - max(max(eI.y, eI.z * 0.85), eI.w * 0.8));
          ink *= 1.0 - (1.0 - smoothstep(1.20, 3.00, detailPx)) * (1.0 - lerp(0.350, 0.600, sil));
        }

        // people far away: lines redrawn by the figure's height on screen
        float innerK = figure > 0.5 && hero < 0.5 ? smoothstep(70.0, 260.0, 1.8 * _Res.y * 0.5 * _Proj11 / max(depth, 0.1)) : 1.0;
        float softNear = soft, driftNear = drift;
        float2 grassNear = grassInk;
        if (ink > 0.02 && hero < 0.5 && !isSky) {
          float2 fo = max(silW * _PixelRatio, 1.0) * _Res.zw;
          float4 t1 = tH(euv + float2(fo.x, 0)), t2 = tH(euv - float2(fo.x, 0)), t3 = tH(euv + float2(0, fo.y)), t4 = tH(euv - float2(0, fo.y));
          float4 fa = fmod(float4(t1.a, t2.a, t3.a, t4.a), 64.0);   // (+64, a mover: nothing to the lines)
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
          float lq = floor((Ao.a < 0.0 ? -Ao.a - 1.0 : Ao.a) * 0.5);
          if (lq > 0.5) {
            float wq = lq - 4.0 * floor(lq * 0.25), tq = floor(lq * 0.25);
            float4 pick = float4(wq == 0.0, wq == 1.0, wq == 2.0, wq == 3.0);
            ink *= dot(pick, float4(1.0, 0.82, 0.66, 0.5)) * (own ? 1.0 : dot(pick, float4(1.0, 0.45, 0.0, 0.0)));
            lineC = lerp(_Ink, Ao.rgb * _ShadowTint * 0.62, tq / 3.0);
          }
          // inverted ink (the shade, src/shade.js; a struck foe's first frames: RT0.a's sign bit): its lines in the paper's white
          if (Ao.a < 0.0) lineC = float3(0.97, 0.95, 0.9);
        }
        float heroInk = max(heroBoundary * 0.82, max(eI.y, eI.z) * 0.22 * heroDetail * hero);
        ink = lerp(ink, heroInk, heroNear);
        float fogLine = 1.0 - exp(-max(nearD * toRange - _FogStart, 0.0) * _FogDensity * _FogMul * 1.4);
        ink *= 1.0 - fogLine;
        float2 hz = 0;
        #if defined(HIRAETH_INK_HAZE)
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
            float ao = creaseOcc * (1.0 - smoothstep(80.0, 260.0, depth)) * _AO * (1.0 - emitHere);
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
            // (a probe on a person looks on down past them, to the ground at their feet: post.js DUST_PAST)
            float onPerson = 1.0 - step(fmod(tH(puv).a, 8.0), 1.5);
            for (int k = 0; k < 8 && onPerson > 0.5; k++) { puv.y -= max(dyPx, 0.04 * _Res.y) * _Res.w; onPerson = 1.0 - step(fmod(tH(puv).a, 8.0), 1.5); }
            float4 Np = tN(puv);
            if (Np.w > 0.0 && Np.y > 0.7 && onPerson < 0.5) {
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
          // ---- 3c. cast shadows toward the world's darkest tone (post.js 3c; the spot blacks' pockets are gone: issue #322)
          #if defined(HIRAETH_INK_SPOT)
          if (_Spot.x > 0.0 && _Spot.w > 0.0 && lit < 0.99 && spotMat > 0.0 && depth < 600.0 && face + figure + hero + soft < 0.5 && emitHere < 0.5) {
            float3 spotC = _SpotTone.rgb * lerp(float3(1, 1, 1), clamp(albedo * 2.2, 0.0, 1.6), _SpotTone.a);
            float k = _Spot.x * spotMat * (1.0 - _Night * 0.5) * (1.0 - smoothstep(350.0, 600.0, depth)) * (1.0 - _Flatten) * (1.0 - lit);
            float castK = smoothstep(0.05, 0.2, dot(N.xyz, _SunDir)) * (1.0 - shadeLift) * _Spot.w;
            col = lerp(col, spotC, castK * k);
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
