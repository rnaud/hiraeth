// A way through's light (src/door-light.js, issue #391): a glow filling the opening, brightest round its frame in flat
// steps, the far side's colour faint in its middle, fading as the eye comes close; its sides a thin rim back into the
// frame, a pale pool on the floor before it. One mesh a door, its parts in its colours (r its part / 4: 0 the opening,
// 1 the floor, 3 the sides; g how far out; b its distance to the opening's edge / 4, m), laid over the finished picture
// after the ink composite and added to it (three's AdditiveBlending), its depth tested by hand against the G-buffer's
// (_GNormalTex.w), as the web's. _Door live (engine/mirror.js LIVE_VECTORS uDoor): x how strongly it shows (its fade,
// its breath, its flare), y the eye's distance (m).
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
    Pass
    {
      Tags { "LightMode" = "UniversalForward" }
      Blend SrcAlpha One
      ZWrite Off
      ZTest Always
      Cull Off
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      Texture2D _GNormalTex;
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
      float4 frag(V i) : SV_Target
      {
        // by hand against the scene's depth: under anything nearer, nothing (src/veil.js)
        float scene = _GNormalTex.Load(int3(i.cs.xy, 0)).w;
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
        a = saturate(a * _Door.x);
        // (a light adds in Unity's linear target, the web's in sRGB: brought down as the veil's is, Veil.shader)
        a = pow(a, 1.5);
        return float4(pow(saturate(col), 2.2), a);
      }
      ENDHLSL
    }
  }
}
