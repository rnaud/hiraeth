// The jump's shade (src/jump-shadow.js JumpShadow): a round patch straight under the traveller while he is off the
// ground, drawn as this game draws a shadow: the G-buffer's light term under it taken away (the composite shades,
// hatches and inks it as any shadow) and the surface's colour multiplied by _Dark, so it reads on ground already in
// shade, and by _Ink in a ring of _Ring (a share of its radius) round its edge: its ink (issue #666); normals, depth
// and the marks left alone. One plain mesh, no keywords: one variant on every platform.
Shader "Hiraeth/JumpShade"
{
  Properties { _Dark ("Dark", Float) = 0.75 _Ink ("Ink", Float) = 0.75 _Ring ("Ring", Float) = 0 }
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
      float _Ink;
      float _Ring;
      CBUFFER_END
      struct A { float4 pos : POSITION; };
      // r: the unit circle's point (the mesh's own x and z, its rim at 1; the bridge mirrors x, a length keeps)
      struct V { float4 cs : SV_POSITION; float2 r : TEXCOORD0; };
      V vert(A v) { V o; o.cs = TransformObjectToHClip(v.pos.xyz); o.r = v.pos.xz; return o; }
      struct G { float4 a : SV_Target0; float4 n : SV_Target1; float4 h : SV_Target2; };
      G frag(V i)
      {
        float d = length(i.r), w = fwidth(d);
        float k = lerp(_Dark, _Ink, smoothstep(1 - _Ring - w, 1 - _Ring, d));
        G o; o.a = float4(k, k, k, 0); o.n = 1; o.h = 1; return o;
      }
      ENDHLSL
    }
  }
}
