// The patch of shade under each chime crystal (src/chimes.js blobMaterial, issue #264): a soft round patch on the ground,
// the surface's colour blended toward a dusky violet by its strength, full in the middle, nothing at its rim, as the page's
// G-buffer decal: the albedo blended by its alpha (the light term in alpha kept), normals, depth and the marks left alone.
// One instanced disc for the whole field (the bridge's InstMats: the instance's strength in its tint's red), faded out from
// 0.6 _Far to _Far from the eye. No discard (a pixel outside the disc blends by 0): it draws in the G-buffer pass only, after
// the ground (Geometry+52), never in the depth prepass or the shadow maps. Two programs (with and without the instances).
Shader "Hiraeth/ChimeShade"
{
  Properties
  {
    _Tint ("Tint", Vector) = (0.195, 0.133, 0.392, 1)
    _Dark ("Strength", Float) = 0.6
    _Core ("Core (full inside this radius)", Float) = 0.55
    _Far ("Faded out by (m)", Float) = 45
  }
  SubShader
  {
    Tags { "RenderType" = "Opaque" "Queue" = "Geometry+52" "RenderPipeline" = "UniversalPipeline" }
    Pass
    {
      Name "HiraethGBuffer"
      Tags { "LightMode" = "HiraethGBuffer" }
      Blend 0 SrcAlpha OneMinusSrcAlpha, Zero One
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
      #pragma multi_compile_local _ HIRAETH_INSTMAT
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      CBUFFER_START(UnityPerMaterial)
      float4 _Tint;
      float _Dark, _Core, _Far;
      CBUFFER_END
      // (the bridge's GPU instances: three rows of a 3x4 matrix and a tint, Wildlife.cs InstMats, as Surface.shader's)
      struct MatInst { float4 r0, r1, r2, col; };
      StructuredBuffer<MatInst> _Mats;
      struct A { float4 pos : POSITION; uint iid : SV_InstanceID; };
      struct V { float4 cs : SV_POSITION; float3 spot : TEXCOORD0; };   // (the disc's x, z; its strength)
      V vert(A v)
      {
        V o;
        float k = 1.0;
        #if defined(HIRAETH_INSTMAT)
          MatInst mi = _Mats[v.iid]; float3 q = v.pos.xyz;
          float3 w = float3(dot(mi.r0.xyz, q) + mi.r0.w, dot(mi.r1.xyz, q) + mi.r1.w, dot(mi.r2.xyz, q) + mi.r2.w);
          k = mi.col.r;
        #else
          float3 w = TransformObjectToWorld(v.pos.xyz);
        #endif
        o.cs = TransformWorldToHClip(w);
        k *= 1.0 - smoothstep(_Far * 0.6, _Far, -TransformWorldToView(w).z);
        o.spot = float3(v.pos.x, v.pos.z, k);
        return o;
      }
      struct G { float4 a : SV_Target0; float4 n : SV_Target1; float4 h : SV_Target2; };
      G frag(V i)
      {
        float r = length(i.spot.xy);
        // (a soft-edged patch: full in the middle, nothing at the rim; outside it, or faded out, an alpha of 0 leaves all as it was)
        float s = r >= 1.0 || i.spot.z <= 0.0 ? 0.0 : (1.0 - smoothstep(_Core, 1.0, r)) * i.spot.z * _Dark;
        G o; o.a = float4(_Tint.rgb, s); o.n = 0; o.h = 0; return o;
      }
      ENDHLSL
    }
  }
}
