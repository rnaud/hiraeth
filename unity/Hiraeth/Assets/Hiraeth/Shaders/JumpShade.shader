// The jump's shade (src/jump-shadow.js JumpShadow): a round patch straight under the traveller while he is off the
// ground, drawn as this game draws a shadow: the G-buffer's light term under it taken away (the composite shades,
// hatches and inks it as any shadow) and the surface's colour multiplied by _Dark, so it reads on ground already in
// shade; normals, depth and the marks left alone. One plain mesh, no keywords: one variant on every platform.
Shader "Hiraeth/JumpShade"
{
  Properties { _Dark ("Dark", Float) = 0.75 }
  SubShader
  {
    Tags { "RenderType" = "Opaque" "Queue" = "Geometry+51" "RenderPipeline" = "UniversalPipeline" }
    Pass
    {
      Name "HiraethGBuffer"
      Tags { "LightMode" = "HiraethGBuffer" }
      Blend 0 DstColor Zero, Zero Zero
      Blend 1 Zero One
      Blend 2 Zero One
      ZWrite Off
      ZTest LEqual
      Offset -3, -3
      Cull Off
      HLSLPROGRAM
      #pragma target 4.5
      #pragma vertex vert
      #pragma fragment frag
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      CBUFFER_START(UnityPerMaterial)
      float _Dark;
      CBUFFER_END
      struct A { float4 pos : POSITION; };
      struct V { float4 cs : SV_POSITION; };
      V vert(A v) { V o; o.cs = TransformObjectToHClip(v.pos.xyz); return o; }
      struct G { float4 a : SV_Target0; float4 n : SV_Target1; float4 h : SV_Target2; };
      G frag(V i)
      {
        G o; o.a = float4(_Dark, _Dark, _Dark, 0); o.n = 1; o.h = 1; return o;
      }
      ENDHLSL
    }
  }
}
