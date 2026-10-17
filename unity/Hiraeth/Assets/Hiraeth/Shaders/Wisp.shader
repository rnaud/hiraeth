// Wind-blown sand (src/wind.js WindStreaks): short inked wisps skimming the ground in gusts,
// camera-facing ribbons rebuilt each frame, drawn over the page in ink; each tests itself against
// the G-buffer's depth (_GNormalTex.w), so it hides behind dunes and rocks.
Shader "Hiraeth/Wisp"
{
  SubShader
  {
    Tags { "RenderType" = "Transparent" "Queue" = "Transparent+50" "RenderPipeline" = "UniversalPipeline" }
    Pass
    {
      Tags { "LightMode" = "UniversalForward" }
      Blend SrcAlpha OneMinusSrcAlpha
      ZWrite Off
      ZTest Always
      Cull Off
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      Texture2D _GNormalTex;
      // (HiraethFeature _GFlip: drawn straight into a player's back buffer, which is the other way up from the G-buffer's
      // texture, its row read from the bottom; issue #420 / #425)
      float _GFlip;
      float4 GAt(float4 cs) { int2 p = int2(cs.xy); if (_GFlip > 0.5) { uint gw, gh; _GNormalTex.GetDimensions(gw, gh); p.y = (int)gh - 1 - p.y; } return _GNormalTex.Load(int3(p, 0)); }
      float3 _Ink;
      struct A { float4 pos : POSITION; float4 col : COLOR; };
      struct V { float4 cs : SV_POSITION; float a : TEXCOORD0; float d : TEXCOORD1; };
      V vert(A v)
      {
        V o; float3 wp = TransformObjectToWorld(v.pos.xyz);
        o.cs = TransformWorldToHClip(wp); o.a = v.col.a; o.d = -TransformWorldToView(wp).z; return o;
      }
      float4 frag(V i) : SV_Target
      {
        float scene = GAt(i.cs).w;
        if (scene > 0.0 && i.d > scene + 0.25) discard;
        return float4(pow(saturate(_Ink), 2.2), i.a);
      }
      ENDHLSL
    }
  }
}
