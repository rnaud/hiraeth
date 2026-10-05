// Dust motes in the air (src/life.js Motes): small round dots with a thin inked rim, a few pixels
// across whatever their distance, drifting on the wind round the camera, hidden behind the scene
// (_GNormalTex.w) and fading out past ~30 m. Camera-facing quads; uv holds the corner.
Shader "Memento/Mote"
{
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
      Texture2D _GNormalTex;
      float3 _Ink; float4 _MoteColor;
      struct A { float4 pos : POSITION; float2 uv : TEXCOORD0; };
      struct V { float4 cs : SV_POSITION; float2 uv : TEXCOORD0; float d : TEXCOORD1; };
      V vert(A v)
      {
        V o; float3 wp = TransformObjectToWorld(v.pos.xyz);
        o.cs = TransformWorldToHClip(wp); o.uv = v.uv; o.d = -TransformWorldToView(wp).z; return o;
      }
      float4 frag(V i) : SV_Target
      {
        float scene = _GNormalTex.Load(int3(i.cs.xy, 0)).w;
        if (scene > 0.0 && i.d > scene + 0.2) discard;
        float r = length(i.uv - 0.5);
        if (r > 0.5) discard;
        float rim = smoothstep(0.3, 0.42, r);
        float3 col = lerp(_MoteColor.rgb, _Ink, rim * 0.7);
        float core = 1.0 - smoothstep(0.42, 0.5, r);
        float far = 1.0 - smoothstep(22.0, 38.0, i.d);
        return float4(pow(saturate(col), 2.2), core * far);
      }
      ENDHLSL
    }
  }
}
