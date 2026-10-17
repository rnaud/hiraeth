// A see-through surface's body (src/veil.js Veils, issue #263): the City-Shaft's air pillars, Lorn II's mushrooms, the
// Glass Dunes' lenses and panes, the shafts of light. The surface's rim is drawn in the G-buffer (Surface.shader _Veil:
// where it faces the eye more squarely than the cut it is discarded); its body is this, a pale wash laid over the
// finished picture after the ink composite: the surface again, flat-lit between the world's shade and light tints,
// softly glowing if it glows, hazed by distance as the ink pass hazes the world, at _WashAlpha a layer. Its depth is
// tested by hand against the G-buffer's (_GNormalTex.w), as the web's: hidden by anything in front of it and not laid
// over its own rim. _WashNear (m): it fades out within twice that of the eye (riding inside an air pillar).
// The bridge's live material value (op 15's glow) moves _WashAlpha: LightShaft.fade.
// A light's wash (the chest's light, src/boxes/light.js; the ways through's, src/thresholds.js) adds to the picture
// (_DstBlend One, three's AdditiveBlending) and is streaked into slow rays round it (_WashRays: strength, clock, how many
// round, the soft edge; the clock live, engine/mirror.js LIVE_VECTORS), stepped into flat bands as the web's veil.js.
Shader "Hiraeth/Veil"
{
  Properties
  {
    _Color ("Wash colour", Vector) = (1, 1, 1, 1)
    _WashAlpha ("Alpha a layer", Float) = 0.3
    _WashGlow ("Glow", Float) = 0
    _WashNear ("Fades out within twice this of the eye (m; 0 never)", Float) = 0
    _Cull ("Cull", Float) = 0
    _DstBlend ("Destination blend", Float) = 10
    _WashRays ("Rays: strength, clock, count, soft", Vector) = (0, 0, 0, 0.5)
  }
  SubShader
  {
    Tags { "RenderType" = "Transparent" "Queue" = "Transparent+30" "RenderPipeline" = "UniversalPipeline" }
    Pass
    {
      Tags { "LightMode" = "UniversalForward" }
      Blend SrcAlpha [_DstBlend]
      ZWrite Off
      ZTest Always
      Cull [_Cull]
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      Texture2D _GNormalTex;
      // (HiraethFeature _GFlip: drawn straight into a player's back buffer, which is the other way up from the G-buffer's
      // texture, its row read from the bottom; issue #420 / #425)
      float _GFlip;
      float4 GAt(float4 cs) { int2 p = int2(cs.xy); if (_GFlip > 0.5) { uint gw, gh; _GNormalTex.GetDimensions(gw, gh); p.y = (int)gh - 1 - p.y; } return _GNormalTex.Load(int3(p, 0)); }
      CBUFFER_START(UnityPerMaterial)
      float4 _Color;
      float _WashAlpha, _WashGlow, _WashNear, _Cull, _DstBlend;
      float4 _WashRays;
      CBUFFER_END
      // the look's globals (HiraethLook.cs), as the composite reads them; _SunDir in three space
      float3 _LightTint, _ShadowTint, _SunDir, _SkyHorizon;
      float _Night, _FogDensity, _FogStart, _FogMul;
      float4 _Haze, _HazeLayers, _HazeTone, _HeightFog, _HeightFogTone;
      struct A { float4 pos : POSITION; float3 n : NORMAL; float2 uv : TEXCOORD0; };
      struct V { float4 cs : SV_POSITION; float3 wp : TEXCOORD0; float3 n : TEXCOORD1; float d : TEXCOORD2; float2 uv : TEXCOORD3; };
      V vert(A v)
      {
        V o; float3 wp = TransformObjectToWorld(v.pos.xyz);
        o.cs = TransformWorldToHClip(wp); o.wp = wp; o.n = TransformObjectToWorldNormal(v.n); o.d = -TransformWorldToView(wp).z; o.uv = v.uv;
        return o;
      }
      float4 frag(V i, bool front : SV_IsFrontFace) : SV_Target
      {
        // by hand against the scene's depth: under something nearer, or on its own rim (drawn in the G-buffer), nothing
        float scene = GAt(i.cs).w;
        if (scene > 0.0 && scene < i.d + 0.08) discard;
        float3 n = normalize(i.n) * (front ? 1.0 : -1.0);
        float faceOn = abs(dot(n, normalize(_WorldSpaceCameraPos - i.wp)));   // (Unity's space, before n goes to three's)
        n.x = -n.x;   // (three space, as _SunDir)
        float lit = smoothstep(0.0, 0.6, dot(n, normalize(_SunDir)) * 0.5 + 0.5) * (1.0 - _Night * 0.6);
        float glow = _WashGlow;
        float3 col = _Color.rgb * lerp(_ShadowTint, lerp(_LightTint, float3(1.12, 1.12, 1.12), glow), max(lerp(0.35, 1.0, lit), glow));
        // hazed as the ink pass hazes the world (post.js 4, 4b; Composite.shader hazeAt): its layers by distance, the far fog, the low mist
        float3 rd = i.wp - _WorldSpaceCameraPos;
        float d = length(rd); rd /= max(d, 1e-4);
        float3 skyC = _Haze.a > 0.0 ? lerp(_SkyHorizon, _Haze.rgb, _Haze.a * (1.0 - _Night)) : _SkyHorizon;
        float fog = 1.0 - exp(-max(d - _FogStart, 0.0) * _FogDensity * _FogMul);
        float3 hazeC = lerp(skyC, _HazeTone.rgb, _HazeTone.a * (1.0 - 0.7 * _Night));
        if (_HazeLayers.w > 0.0)
        {
          float t = log2(max(d, 1.0) / _HazeLayers.x) / log2(_HazeLayers.y);
          float L = clamp(floor(t) + 1.0 + smoothstep(0.82, 1.0, frac(t)), 0.0, _HazeLayers.w);
          col = lerp(col, hazeC, (1.0 - pow(1.0 - _HazeLayers.z, L)) * (1.0 - 0.6 * _Night));
        }
        col = lerp(col, skyC, fog);
        if (_HeightFog.w > 0.0)
        {
          float b = 1.0 / _HeightFog.y;
          float base = exp(min(-(_WorldSpaceCameraPos.y - _HeightFog.x) * b, 30.0));
          float x = max(rd.y * d * b, -30.0);
          float k = abs(x) > 1e-3 ? (1.0 - exp(-x)) / x : 1.0;
          col = lerp(col, lerp(hazeC, _HeightFogTone.rgb, _HeightFogTone.a * (1.0 - 0.7 * _Night)), (1.0 - exp(-_HeightFog.z * d * base * k)) * _HeightFog.w);
        }
        float a = _WashAlpha * (_WashNear > 0.0 ? smoothstep(_WashNear, _WashNear * 2.0, i.d) : 1.0);
        if (_WashRays.x > 0.0)
        {
          // light out of a chest or a way through (a cone, uv.y 0 at its mouth): soft where it is seen edge-on, gone at
          // its far end, streaked into slow rays round it, then stepped into flat bands (src/veil.js)
          float face = smoothstep(0.0, _WashRays.w, faceOn);
          float fade = 1.0 - smoothstep(0.08, 1.0, i.uv.y);
          float u = i.uv.x * 6.2832, c = _WashRays.y;
          float rays = 0.5 + 0.5 * sin(u * _WashRays.z + 1.3 * sin(u * 2.0 + c * 0.7) + c * 0.35) * sin(u * (0.5 * _WashRays.z + 1.0) - c * 0.25 + 2.1);
          float k = face * fade * lerp(1.0, 0.15 + 1.1 * rays, _WashRays.x);
          a *= floor(saturate(k) * 3.0 + 0.5) / 3.0;
        }
        // (a light adds in Unity's linear target, the web's in sRGB: over dark walls the same alpha came out far brighter
        // (a temple's first room washed out), over a lit floor about the same; its alpha brought down between the two,
        // measured against the web at the Rose House's, the Moon Foundry's and the Buried Machine's first rooms)
        if (_DstBlend < 1.5) a = pow(saturate(a), 1.5);
        // (a wash laid over, likewise: three blends it in the page's sRGB, Unity in its linear target, where a pale wash
        // over a dark wall comes out far lighter: the skull cave's shafts of light read as white slabs, issue #420. Its alpha
        // brought down toward the web's over the cave's walls and floor)
        else a = pow(saturate(a), 1.15);
        return float4(pow(saturate(col), 2.2), a);
      }
      ENDHLSL
    }
  }
}
