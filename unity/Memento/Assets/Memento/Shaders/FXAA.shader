// FXAA (the web game's last pass, three's FXAAShader): the inked page's edges smoothed by their
// local contrast, along the edge's direction. Reads the composite, writes the camera target.
Shader "Hidden/Memento/FXAA"
{
  SubShader
  {
    Tags { "RenderPipeline" = "UniversalPipeline" }
    ZTest Always ZWrite Off Cull Off
    Pass
    {
      Name "FXAA"
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      Texture2D _FxaaSrc;
      SamplerState sampler_linear_clamp;
      float4 _FxaaTexel;   // 1/w, 1/h
      float _TargetFlip;   // 1: writing the back buffer itself (MementoFeature)
      struct V2F { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; };
      V2F vert(uint id : SV_VertexID)
      {
        V2F o; float2 uv = float2((id << 1) & 2, id & 2);
        o.pos = float4(uv * 2.0 - 1.0, 0.0, 1.0);
        #if UNITY_UV_STARTS_AT_TOP
          o.pos.y = -o.pos.y;
        #endif
        if (_TargetFlip > 0.5) o.pos.y = -o.pos.y;   // (straight into a player's back buffer: the other way up)
        o.uv = uv; return o;
      }
      float3 S(float2 uv) { return _FxaaSrc.SampleLevel(sampler_linear_clamp, uv, 0).rgb; }
      float Luma(float3 c) { return dot(sqrt(saturate(c)), float3(0.299, 0.587, 0.114)); }   // (on display values)
      float4 frag(V2F i) : SV_Target
      {
        const float REDUCE_MIN = 1.0 / 128.0, REDUCE_MUL = 1.0 / 8.0, SPAN_MAX = 8.0;
        float2 t = _FxaaTexel.xy, uv = i.uv;
        float3 rgbM = S(uv);
        float lNW = Luma(S(uv + float2(-1, -1) * t)), lNE = Luma(S(uv + float2(1, -1) * t));
        float lSW = Luma(S(uv + float2(-1, 1) * t)), lSE = Luma(S(uv + float2(1, 1) * t)), lM = Luma(rgbM);
        float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
        float2 dir = float2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
        float reduce = max((lNW + lNE + lSW + lSE) * 0.25 * REDUCE_MUL, REDUCE_MIN);
        float rcpMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
        dir = clamp(dir * rcpMin, -SPAN_MAX, SPAN_MAX) * t;
        float3 a = 0.5 * (S(uv + dir * (1.0 / 3.0 - 0.5)) + S(uv + dir * (2.0 / 3.0 - 0.5)));
        float3 b = a * 0.5 + 0.25 * (S(uv + dir * -0.5) + S(uv + dir * 0.5));
        float lB = Luma(b);
        return float4((lB < lMin || lB > lMax) ? a : b, 1.0);
      }
      ENDHLSL
    }
  }
}
