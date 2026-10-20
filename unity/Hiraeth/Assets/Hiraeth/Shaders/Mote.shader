// Dust motes in the air (src/life.js Motes): small round dots with a thin inked rim, a few pixels
// across whatever their distance, drifting on the wind round the camera, hidden behind the scene
// (_GNormalTex.w) and fading out past ~30 m. Camera-facing quads; uv holds the corner. A glow (_Glow: fireflies, a
// temple's embers, src/temples/air.js) has no rim, a soft halo, is brighter and blinks as life.js's, each quad on a
// phase of its own (its vertex's index / 4); _Alpha: how solid they are (a temple's mist).
Shader "Hiraeth/Mote"
{
  Properties { _Glow ("Glow", Float) = 0  _Alpha ("Alpha", Float) = 1 }
  SubShader
  {
    Tags { "RenderType" = "Transparent" "Queue" = "Transparent+40" "RenderPipeline" = "UniversalPipeline" }
    Pass
    {
      Tags { "LightMode" = "UniversalForward" }
      Blend SrcAlpha OneMinusSrcAlpha
      ZWrite Off ZTest Always Cull Off
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      #include "GAt.hlsl"
      float3 _Ink; float4 _MoteColor; float _Glow, _Alpha;
      struct A { float4 pos : POSITION; float2 uv : TEXCOORD0; uint vid : SV_VertexID; };
      struct V { float4 cs : SV_POSITION; float2 uv : TEXCOORD0; float d : TEXCOORD1; float tw : TEXCOORD2; };
      V vert(A v)
      {
        V o; float3 wp = TransformObjectToWorld(v.pos.xyz);
        o.cs = TransformWorldToHClip(wp); o.uv = v.uv; o.d = -TransformWorldToView(wp).z;
        float phase = frac(sin((float)(v.vid / 4) * 12.9898) * 43758.5453) * 6.2832;
        o.tw = lerp(1.0, 0.35 + 0.65 * max(sin(_Time.y * 2.2 + phase * 3.0), 0.0), _Glow);
        return o;
      }
      float4 frag(V i) : SV_Target
      {
        float scene = GAt(i.cs).w;
        if (scene > 0.0 && i.d > scene + 0.2) discard;
        float r = length(i.uv - 0.5);
        if (r > 0.5) discard;
        float rim = smoothstep(0.3, 0.42, r) * (1.0 - _Glow);
        float3 col = lerp(_MoteColor.rgb, _Ink, rim * 0.7) * lerp(1.0, 1.25, _Glow);
        float core = 1.0 - smoothstep(0.42, 0.5, r);
        float halo = lerp(core, 1.0 - smoothstep(0.0, 0.5, r), _Glow);
        float far = 1.0 - smoothstep(22.0, 38.0, i.d);
        return float4(pow(saturate(col), 2.2), halo * far * i.tw * _Alpha);
      }
      ENDHLSL
    }
  }
}
