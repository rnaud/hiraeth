// The water's pass over the finished page (src/water.js WaterPass, line for line), after the ink composite and before
// FXAA / SMAA (HiraethFeature.CompositePass; issue #458). Under water: everything sinks into the water's colour in flat
// bands with distance, a little darker the deeper you look; a sea (water.js SEA_LOOK) has its own colours, its shafts of
// light down from the surface and its caustics on what faces up. Above water: white dashes of sun where the water's
// surface marked a glint in the length of its normal (Surface.shader's waterLook, water-shader.js WATER_MARK), only where
// the water is lit, fading with distance.
// A copy of the page with the web's layers laid over it in display values (the page itself holds linear ones: the
// composite's toLinear), so its haze is the web's, not a blend in linear light; only on the frames the engine says
// (engine/game.js waterOver: under water, or sparkling water in view by day on a preset with the sparkle).
// Its numbers are the bridge's globals (BridgeRunner.Water, three's space as the composite's _CamWorld).
Shader "Hidden/Hiraeth/WaterOver"
{
  SubShader
  {
    Tags { "RenderPipeline" = "UniversalPipeline" }
    ZTest Always ZWrite Off Cull Off
    Pass
    {
      Name "WaterOver"
      HLSLPROGRAM
      #pragma target 4.5
      #pragma vertex vert
      #pragma fragment frag
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

      Texture2D _GAlbedo, _GNormal, _WOPage;
      float4 _Res;          // width, height, 1/width, 1/height (HiraethLook.SetCameraUniforms)
      float4x4 _InvProj;    // inverse GL projection (view space: three's)
      float4x4 _CamWorld;   // camera to world, three space
      float _TargetFlip;    // 1: writing the back buffer itself (HiraethFeature)
      float _MTime, _Toon;  // (globals: the game's clock, the look's light step)
      // (the bridge's globals, BridgeRunner.Water: water.js underLook)
      float _WOUnder, _WOSurf, _WOFogStart;
      float3 _WOTint, _WODeep, _WOCausticTone;
      float4 _WOFog, _WOShaftDir, _WOShaftTone, _WOCaustic;
      float4 _WOShafts[25];   // (water.js SEA_SHAFTS) x, z, half width, strength
      #define SEA_SHAFTS 25
      #define MARK_BASE 1.012   // (1 + water-shader.js WATER_MARK.base)
      #define MARK_GLINT 0.05   // (WATER_MARK.glint)

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

      float3 toLinear(float3 c) { return c <= 0.04045 ? c / 12.92 : pow(max((c + 0.055) / 1.055, 0.0), 2.4); }
      float3 toDisplay(float3 c) { c = max(c, 0.0); return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055; }

      // premultiplied layers, each over the ones before
      void over(inout float4 acc, float3 c, float a) { acc.rgb = c * a + acc.rgb * (1.0 - a); acc.a = a + acc.a * (1.0 - a); }
      float2 hash2w(float2 p) { p = float2(dot(p, float2(127.1, 311.7)), dot(p, float2(269.5, 183.3))); return frac(sin(p) * 43758.5453); }
      // the caustic net: how far (in cells) from the border of two cells (F2 - F1 over the 3 x 3 round x), the cells'
      // points wandering slowly
      float net(float2 x)
      {
        float2 n = floor(x), f = frac(x);
        float d1 = 8.0, d2 = 8.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++)
        {
          float2 g = float2(i, j);
          float2 o = 0.5 + 0.42 * sin(_MTime * _WOCaustic.w + 6.2831 * hash2w(n + g));
          float2 r = g + o - f;
          float d = dot(r, r);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        return sqrt(d2) - sqrt(d1);
      }
      // the brightest shaft the ray crosses before what it meets (far): each a slanted cylinder down from the surface,
      // seen as a flat band (the nearest approach of the ray to its axis inside its half width)
      float shaftsAlong(float3 cam, float3 rd, float far)
      {
        float3 L = _WOShaftDir.xyz;
        float b = dot(rd, L), den = 1.0 - b * b;
        if (den < 1e-4) return 0.0;
        float best = 0.0;
        for (int i = 0; i < SEA_SHAFTS; i++)
        {
          float4 S = _WOShafts[i];
          if (S.w <= 0.0) continue;
          float3 w0 = cam - float3(S.x, _WOSurf, S.y);
          float d = dot(rd, w0), e = dot(L, w0);
          float t = (b * e - d) / den, s = (e - b * d) / den;
          if (t < 0.0 || t > far || s < 0.0) continue;
          float dist = length(w0 + rd * t - L * s);
          if (dist > S.z) continue;
          float across = 1.0 - smoothstep(S.z * 0.45, S.z, dist);
          float down = 1.0 - smoothstep(_WOShaftDir.w * 0.3, _WOShaftDir.w, s);
          best = max(best, across * down * S.w);
        }
        return best;
      }
      // the light term under a line step (materials.js LINE: post.js lightOf)
      float litOf(float2 uv)
      {
        float la = _GAlbedo.SampleLevel(sampler_PointClamp, uv, 0).a;
        la = la < 0.0 ? -la - 1.0 : la;
        return smoothstep(_Toon - 0.02, _Toon + 0.02, la - 2.0 * floor(la * 0.5));
      }

      // the layers over the page (water.js WaterPass's fragColor, premultiplied: rgb × a, a)
      float4 layers(float2 uv)
      {
        float4 N = _GNormal.SampleLevel(sampler_PointClamp, uv, 0);
        if (_WOUnder < 0.5)
        {
          // the sparkle: the water's mark in the normal's length
          float g = saturate((length(N.xyz) - MARK_BASE) / MARK_GLINT);
          if (N.w <= 0.0 || g < 0.35) return 0;
          float a = litOf(uv) * (1.0 - smoothstep(180.0, 520.0, N.w));
          return float4(float3(1.0, 0.99, 0.94) * a, a);
        }
        float4 pv = mul(_InvProj, float4(uv * 2.0 - 1.0, 1.0, 1.0));
        float3 rd = normalize(mul((float3x3)_CamWorld, pv.xyz / pv.w));
        float3 cam = float3(_CamWorld._m03, _CamWorld._m13, _CamWorld._m23);
        float3 fwdV = -float3(_CamWorld._m02, _CamWorld._m12, _CamWorld._m22);
        float fwdK = max(dot(rd, fwdV), 0.05);
        float dist = N.w > 0.0 ? N.w / fwdK : 400.0;
        float4 acc = 0;
        // ---- a sea's caustics: printed lines of light on what faces up, near, stronger in the light
        // (the net's coordinates and their derivatives taken by every pixel: fwidth wants them in uniform flow)
        float3 wp = cam + rd * dist;
        float2 q = wp.xz * _WOCaustic.x;
        q += 0.35 * float2(sin(q.y * 0.9 + _MTime * 0.5), cos(q.x * 0.8 + _MTime * 0.43));
        float fw = max(fwidth(q.x) + fwidth(q.y), 1e-4);
        UNITY_BRANCH if (_WOCaustic.z > 0.0 && N.w > 0.0 && N.y > 0.4 && dist < _WOCaustic.y)
        {
          float line = (1.0 - smoothstep(0.035, 0.035 + fw * 1.3, net(q))) * (1.0 - smoothstep(0.2, 0.5, fw));   // (gone once finer than a few px)
          // in drifting patches, as the light comes through the waves above (never one net over everything)
          float patchK = 0.5 + 0.5 * sin(wp.x * 0.43 + _MTime * 0.13) * sin(wp.z * 0.37 - _MTime * 0.09 + wp.x * 0.11);
          line *= smoothstep(0.55, 0.85, patchK);
          over(acc, _WOCausticTone, line * _WOCaustic.z * smoothstep(0.4, 0.8, N.y) * lerp(0.4, 1.0, litOf(uv)) * (1.0 - smoothstep(_WOCaustic.y * 0.5, _WOCaustic.y, dist)));
        }
        // ---- the way through the water: to the thing seen, or up to the surface
        float toSurf = rd.y > 1e-3 ? (_WOSurf - cam.y) / rd.y : 1e5;
        float path = min(dist, toSurf);
        float f = 1.0 - exp(-max(path - _WOFogStart, 0.0) * _WOFog.x);
        float fb = f * _WOFog.y;
        f = (floor(fb) + smoothstep(0.4, 0.6, frac(fb))) / _WOFog.y;          // flat bands, like a printed haze
        float down = saturate(-rd.y);
        float3 col = lerp(_WOTint, _WODeep, 0.35 + 0.5 * down);
        if (_WOShaftTone.a == 0.0)
        {
          // light from the surface: shafts drifting slowly, only looking up
          float shaft = smoothstep(0.55, 0.9, sin(rd.x * 9.0 + rd.z * 5.0 + _MTime * 0.25) * 0.5 + 0.5) * saturate(rd.y + 0.4) * 0.18;
          col = lerp(col, float3(0.92, 0.98, 0.96), shaft);
        }
        over(acc, col, lerp(_WOFog.z, _WOFog.w, f));
        // ---- a sea's shafts: flat pale bands down from the surface, in two printed steps
        float sh = _WOShaftTone.a > 0.0 ? shaftsAlong(cam, rd, path) : 0.0;
        float fs = max(fwidth(sh), 1e-3);
        if (_WOShaftTone.a > 0.0)
        {
          float qs = 0.5 * smoothstep(0.12 - fs, 0.12 + fs, sh) + 0.5 * smoothstep(0.55 - fs, 0.55 + fs, sh);
          over(acc, _WOShaftTone.rgb, qs * _WOShaftTone.a);
        }
        return acc.a <= 0.002 ? 0 : acc;
      }

      float4 frag(V2F i) : SV_Target
      {
        float4 page = _WOPage.SampleLevel(sampler_PointClamp, i.uv, 0);
        float4 L = layers(i.uv);
        // (three's normal blending over the page, in the web's display values: c · a + page · (1 − a))
        float3 c = L.rgb + toDisplay(page.rgb) * (1.0 - L.a);
        return float4(toLinear(saturate(c)), page.a);
      }
      ENDHLSL
    }
  }
}
