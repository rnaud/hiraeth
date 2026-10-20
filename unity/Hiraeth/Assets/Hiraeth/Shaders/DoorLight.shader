// A way through's light (src/door-light.js, issue #391): a glow filling the opening, brightest round its frame in flat
// steps, the far side's colour faint in its middle, fading as the eye comes close; its sides a thin rim back into the
// frame, a pale pool on the floor before it. One mesh a door, its parts in its colours (r its part / 4: 0 the opening,
// 1 the floor, 3 the sides; g how far out; b its distance to the opening's edge / 4, m), laid over the finished picture
// after the ink composite and added to it (three's AdditiveBlending), its depth tested by hand against the G-buffer's
// (_GNormalTex.w), as the web's. _Door live (engine/mirror.js LIVE_VECTORS uDoor): x how strongly it shows (its fade,
// its breath, its flare), y the eye's distance (m). Added as the web adds it, to the page's sRGB values: in two blends
// (LightAdd.hlsl, issue #502), the first its SRPDefaultUnlit pass.
Shader "Hiraeth/DoorLight"
{
  Properties
  {
    _Color ("Light", Vector) = (1, 0.89, 0.65, 1)
    _Pool ("The pool's", Vector) = (1, 0.945, 0.784, 1)
    _Far ("The far side's", Vector) = (1, 0.81, 0.56, 1)
    _Door ("Strength, the eye's distance", Vector) = (0, 10, 0, 0)
  }
  SubShader
  {
    Tags { "RenderType" = "Transparent" "Queue" = "Transparent+30" "RenderPipeline" = "UniversalPipeline" }
    HLSLINCLUDE
    #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
    #include "LightAdd.hlsl"
    #include "GAt.hlsl"
    CBUFFER_START(UnityPerMaterial)
    float4 _Color, _Pool, _Far, _Door;
    CBUFFER_END
    float _Night;   // (the look's, HiraethLook.cs)
    struct A { float4 pos : POSITION; float4 col : COLOR; };
    struct V { float4 cs : SV_POSITION; float4 part : TEXCOORD0; float d : TEXCOORD1; };
    V vert(A v)
    {
      V o; float3 wp = TransformObjectToWorld(v.pos.xyz);
      o.cs = TransformWorldToHClip(wp); o.part = v.col; o.d = -TransformWorldToView(wp).z;
      return o;
    }
    float bands(float x, float n) { return floor(saturate(x) * n + 0.5) / n; }
    // the light this pixel adds, in display values: its colour times its alpha (the web's AdditiveBlending source)
    float3 doorLight(V i)
    {
      // by hand against the scene's depth: under anything nearer, nothing (src/veil.js)
      float scene = GAt(i.cs).w;
      if (scene > 0.0 && scene < i.d + 0.06) discard;
      float part = i.part.x * 4.0, along = i.part.y, edge = i.part.z * 4.0;
      float near = smoothstep(1.0, 4.5, _Door.y);
      float3 col = _Color.rgb; float a;
      if (part < 0.5)
      {
        // the opening: brightest at its frame (0.8 m in), in four flat steps; the far side's colour faint in its middle
        float k = bands(pow(1.0 - saturate(edge / 0.8), 1.6), 4.0);
        col = lerp(_Far.rgb, _Color.rgb, k);
        a = lerp(0.22 * near, 0.85, k) * lerp(0.55, 1.0, near);
      }
      else if (part < 1.5) { a = 0.3 * bands(1.0 - along, 3.0); col = _Pool.rgb; }
      else a = 0.35 * bands(1.0 - along, 2.0) * lerp(0.5, 1.0, near);
      col *= 1.0 + 0.4 * _Night;
      return col * saturate(a * _Door.x);
    }
    // the first blend (the picture's linear value times M) and the second (plus A): LightAdd.hlsl
    float4 fragMul(V i) : SV_Target { return float4(LightAddMul(doorLight(i)), 1.0); }
    float4 fragAdd(V i) : SV_Target { return float4(LightAddConst(doorLight(i)), 1.0); }
    ENDHLSL
    Pass
    {
      Tags { "LightMode" = "SRPDefaultUnlit" }
      Blend DstColor One
      ColorMask RGB
      ZWrite Off
      ZTest Always
      Cull Off
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment fragMul
      ENDHLSL
    }
    Pass
    {
      Tags { "LightMode" = "UniversalForward" }
      Blend One One
      ColorMask RGB
      ZWrite Off
      ZTest Always
      Cull Off
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment fragAdd
      ENDHLSL
    }
  }
}
