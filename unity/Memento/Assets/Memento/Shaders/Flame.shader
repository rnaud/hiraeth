// The burning tree's fire (src/story/flames.js FlameBody): lathe shells whose bands of flat
// colour run from a pale heart out to a deep red rim, licked upward by a scrolling noise field
// and torn open near the top. Self-lit in the G-buffer (it keeps its colour in shade and at
// night); the composite inks its silhouette and band edges like every other surface.
Shader "Memento/Flame"
{
  Properties
  {
    _Shell ("Shell (0 outside .. 2 heart)", Float) = 0
    _Seed ("Seed", Float) = 0
  }
  SubShader
  {
    Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" }
    Pass
    {
      Name "MementoGBuffer"
      Tags { "LightMode" = "MementoGBuffer" }
      Cull Off
      HLSLPROGRAM
      #pragma target 4.5
      #pragma vertex vert
      #pragma fragment frag
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      #include "MementoCommon.hlsl"
      float _Shell, _Seed, _FlameTime, _FlameK;
      float4 _FlamePal[5];
      struct A { float4 positionOS : POSITION; float2 uv : TEXCOORD0; };
      struct V { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; float viewDepth : TEXCOORD1; float3 nrm : TEXCOORD2; };
      V vert(A v)
      {
        V o;
        float y = v.uv.y, a = v.uv.x * 6.2831853;
        float t = _FlameTime;
        float3 p = v.positionOS.xyz;
        // the tongues lick: the shell breathes out and in, more toward the tip, and sways
        float lick = 1.0 + 0.16 * sin(t * 3.1 + a * 3.0 + y * 7.0 + _Seed) * y + 0.06 * sin(t * 6.7 - a * 5.0 + _Seed);
        p.xz *= lick;
        p.x += (sin(t * 1.1 + _Seed) * 0.05 + sin(t * 2.3 + _Seed * 1.7) * 0.025) * y * y;
        p.z += (cos(t * 0.9 + _Seed * 1.3) * 0.05) * y * y;
        float3 ws = TransformObjectToWorld(p);
        o.positionCS = TransformWorldToHClip(ws);
        o.viewDepth = -TransformWorldToView(ws).z;
        o.nrm = toThree(normalize(_WorldSpaceCameraPos - ws));
        o.uv = v.uv;
        return o;
      }
      struct G { float4 a : SV_Target0; float4 n : SV_Target1; float4 h : SV_Target2; };
      G frag(V i)
      {
        float y = i.uv.y, a = i.uv.x * 6.2831853, t = _FlameTime;
        float2 q = float2(a * 1.6, y * 3.0 - t * (0.6 + 0.3 * _FlameK));
        float n = vnoise(q + _Seed) * 0.6 + vnoise(q * 2.3 + 7.1 + _Seed) * 0.4;
        // torn open near the top: the outside more than the heart
        float torn = smoothstep(0.55, 1.0, y) * (1.1 - 0.35 * _Shell);
        if (n < torn * 0.9 - 0.05) discard;
        float g = (1.0 - y) * 0.7 + (n - 0.5) * 0.5 + _Shell * 0.22 + 0.08 * (_FlameK - 1.0);
        int k = g > 0.78 ? 0 : g > 0.6 ? 1 : g > 0.42 ? 2 : g > 0.25 ? 3 : 4;
        G o;
        o.a = float4(_FlamePal[k].rgb, 1.0);
        o.n = float4(i.nrm, i.viewDepth);
        o.h = float4(0, 0, 0, 1);   // self-lit
        return o;
      }
      ENDHLSL
    }
  }
}
