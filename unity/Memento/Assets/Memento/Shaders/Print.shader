// Footprints (src/life.js Footprints): a decal that darkens the G-buffer's albedo under it (a
// multiply), so a print always takes the colour of what it is pressed into; the light, the normal,
// the depth and the marks are left alone, so prints are not outlined. Instanced (Puffs buffer).
Shader "Memento/Print"
{
  SubShader
  {
    Tags { "RenderType" = "Opaque" "Queue" = "Geometry+50" "RenderPipeline" = "UniversalPipeline" }
    Pass
    {
      Name "MementoGBuffer"
      Tags { "LightMode" = "MementoGBuffer" }
      Blend 0 DstColor Zero, Zero One
      Blend 1 Zero One
      Blend 2 Zero One
      ZWrite Off
      ZTest LEqual
      Offset -2, -2
      Cull Off
      HLSLPROGRAM
      #pragma target 4.5
      #pragma vertex vert
      #pragma fragment frag
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      struct PuffInst { float4 at; float4 size; float4 col; };   // at.w yaw; col.a the fade
      StructuredBuffer<PuffInst> _Puffs;
      float _PrintDepth;
      struct A { float4 pos : POSITION; uint iid : SV_InstanceID; };
      struct V { float4 cs : SV_POSITION; float fade : TEXCOORD0; };
      V vert(A v)
      {
        PuffInst p = _Puffs[v.iid];
        float c = cos(p.at.w), s = sin(p.at.w);
        float3 lp = v.pos.xyz * p.size.xyz;
        float3 wp = p.at.xyz + float3(c * lp.x + s * lp.z, lp.y, -s * lp.x + c * lp.z);
        V o; o.cs = TransformWorldToHClip(wp); o.fade = p.col.a; return o;
      }
      struct G { float4 a : SV_Target0; float4 n : SV_Target1; float4 h : SV_Target2; };
      G frag(V i)
      {
        float k = lerp(1.0, _PrintDepth, i.fade);
        G o; o.a = float4(k, k, k, 1); o.n = 1; o.h = 1; return o;
      }
      ENDHLSL
    }
  }
}
