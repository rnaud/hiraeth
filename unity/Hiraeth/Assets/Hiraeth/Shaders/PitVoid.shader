// A deadly drop's dark (src/pit-void.js, issue #312): every temple pit that puts you back at a mark (the Clock-House's,
// the Footprint's pools), and a world's void under its kill height. A wash laid over the finished picture after the ink
// composite, as the web's: the pit's box drawn by its inside faces (Cull Front: the bridge's mirror flips the winding,
// so these are three's BackSide), each pixel finding where its ray meets the scene inside the box (the G-buffer's view
// depth, _GNormalTex.w) and darkening it by how far under the box's top that is, in flat steps; what lies flat down
// there (a floor, water) all dark, with slow pale rings turning on it. The same GLSL, worked in three's space (x
// mirrored back): _Inv takes three's world into the box's frame (a temple's kit frame).
Shader "Hiraeth/PitVoid"
{
  Properties
  {
    _Color ("The dark", Vector) = (0.07, 0.043, 0.094, 1)
    _Ring ("The rings", Vector) = (0.27, 0.32, 0.35, 1)
    _BoxMin ("Box min (frame)", Vector) = (0, 0, 0, 0)
    _BoxMax ("Box max (frame)", Vector) = (1, 1, 1, 0)
    _Look ("fade m, dark, steps", Vector) = (7, 0.94, 4, 0)
    _Rings ("apart m, turn rad/s, line", Vector) = (3.2, 0.45, 0.32, 0)
    _Mid ("rings' middle (frame x, z)", Vector) = (0, 0, 0, 0)
  }
  SubShader
  {
    Tags { "RenderType" = "Transparent" "Queue" = "Transparent+20" "RenderPipeline" = "UniversalPipeline" }
    Pass
    {
      Tags { "LightMode" = "UniversalForward" }
      Blend SrcAlpha OneMinusSrcAlpha
      ZWrite Off
      ZTest Always
      Cull Front
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      #include "GAt.hlsl"
      CBUFFER_START(UnityPerMaterial)
      float4 _Color, _Ring, _BoxMin, _BoxMax, _Look, _Rings, _Mid;
      float4x4 _Inv;
      CBUFFER_END
      float _MTime;   // the look's clock (HiraethLook): the rings turn by it
      struct A { float4 pos : POSITION; };
      struct V { float4 cs : SV_POSITION; float3 wp : TEXCOORD0; };
      V vert(A v)
      {
        V o; float3 wp = TransformObjectToWorld(v.pos.xyz);
        o.cs = TransformWorldToHClip(wp); o.wp = wp;
        return o;
      }
      float4 frag(V i) : SV_Target
      {
        float3 camU = _WorldSpaceCameraPos;
        float3 rdU = normalize(i.wp - camU);
        // (three's space: x mirrored back)
        float3 rdW = float3(-rdU.x, rdU.y, rdU.z), cam3 = float3(-camU.x, camU.y, camU.z);
        float3 ro = mul(_Inv, float4(cam3, 1.0)).xyz, rd = normalize(mul((float3x3)_Inv, rdW));
        float3 uMin = _BoxMin.xyz, uMax = _BoxMax.xyz;
        // the ray through the box (its slabs)
        float3 inv = float3(rd.x < 0.0 ? -1.0 : 1.0, rd.y < 0.0 ? -1.0 : 1.0, rd.z < 0.0 ? -1.0 : 1.0) / max(abs(rd), 1e-5);
        float3 a = (uMin - ro) * inv, b = (uMax - ro) * inv;
        float3 lo = min(a, b), hi = max(a, b);
        float t0 = max(max(max(lo.x, lo.y), lo.z), 0.0), t1 = min(min(hi.x, hi.y), hi.z);
        if (t1 <= t0) discard;
        // where it meets the scene (the G-buffer's view depth; 0: nothing, the sky, as deep as the box goes)
        float4 g = GAt(i.cs);
        float s = g.w;
        float3 fwd = -UNITY_MATRIX_V[2].xyz;   // (the camera's forward, Unity's world: the dot is the same in either)
        float ts = s > 0.0 ? s / max(dot(rdU, fwd), 1e-4) : 1e9;
        if (ts < t0) discard;   // (in front of the box: a ledge, the traveller on the lip)
        float3 q = ro + rd * min(ts, t1);
        float depth = uMax.y - q.y;
        bool none = ts >= t1;
        float side = min(min(q.x - uMin.x, uMax.x - q.x), min(q.z - uMin.z, uMax.z - q.z));
        float lies = none ? step(q.y, uMin.y + 0.05) : smoothstep(0.6, 0.9, normalize(mul((float3x3)_Inv, g.xyz)).y) * smoothstep(0.0, 0.3, depth);
        float k = max(smoothstep(0.0, _Look.x, depth), lies);
        // flat steps, as the pictures shade (softened a touch at each step's edge)
        float st = k * _Look.z, f = frac(st);
        k = (floor(st) + smoothstep(0.82, 1.0, f)) / _Look.z;
        // the slow rings on what lies down there, round their middle
        float2 c = q.xz - _Mid.xy;
        float r = length(c), ang = atan2(c.y, c.x), T = _MTime;
        float band = sin(6.2832 * r / _Rings.x - T * _Rings.y * 2.0 + ang * 2.0 + 0.8 * sin(T * 0.31 + r * 0.21));
        float ln = smoothstep(0.9, 0.985, band) * lies * _Rings.z;
        float alpha = max(k * _Look.y, ln) * (none ? smoothstep(0.0, 8.0, side) : 1.0);
        float3 col = lerp(_Color.rgb, _Ring.rgb, ln);
        // (the page lays it over the picture in display values; here the blend is in linear ones, which lifts a dark wash
        // over a bright floor: the alpha raised so a near-black wash darkens what is under it as much as the page's does)
        return float4(pow(saturate(col), 2.2), 1.0 - pow(1.0 - saturate(alpha), 2.2));
      }
      ENDHLSL
    }
  }
}
