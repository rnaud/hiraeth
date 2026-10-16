// The finished picture from the render scale to the screen (HiraethFeature's UpscalePass, the bridge's -upscale; issue #392):
//   0 FSR 1's EASU (AMD FidelityFX Super Resolution 1, edge-adaptive spatial upsampling; MIT licence, its notice in
//     Packages/com.unity.render-pipelines.core/Runtime/PostProcessing/Shaders/ffx/ffx_fsr1.hlsl and ffx_a.hlsl, included
//     from there through the core package's FSRCommon.hlsl), the source read in gamma 2.0 as EASU wants, linear out
//   1 FSR 1's RCAS (robust contrast-adaptive sharpening) over EASU's full-size result
//   2 Snapdragon Game Super Resolution 1 (Qualcomm's one-pass spatial upscaler, SGSR1, BSD-3-Clause; its notice and
//     licence in SGSR1.hlsl beside this file), also in gamma 2.0
//   3 a plain bilinear copy (the same pass with no upscaler: what URP's own final blit does)
// Every pass works out its output pixel from the interpolated uv, so the back buffer the other way up (_TargetFlip) reads
// the same source pixels.
Shader "Hidden/Hiraeth/Upscale"
{
  SubShader
  {
    Tags { "RenderPipeline" = "UniversalPipeline" }
    ZTest Always ZWrite Off Cull Off

    HLSLINCLUDE
      #pragma target 4.5
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      TEXTURE2D_X(_UpSrc);
      float4 _UpOut;       // the output's width, height, 1/width, 1/height
      float _TargetFlip;   // 1: writing a player's back buffer itself (HiraethFeature)
      struct V2F { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; };
      V2F vert(uint id : SV_VertexID)
      {
        V2F o; float2 uv = float2((id << 1) & 2, id & 2);
        o.pos = float4(uv * 2.0 - 1.0, 0.0, 1.0);
        #if UNITY_UV_STARTS_AT_TOP
          o.pos.y = -o.pos.y;
        #endif
        if (_TargetFlip > 0.5) o.pos.y = -o.pos.y;
        o.uv = uv; return o;
      }
      uint2 OutPixel(float2 uv) { return (uint2)min(floor(uv * _UpOut.xy), _UpOut.xy - 1.0); }
    ENDHLSL

    Pass
    {
      Name "EASU"
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      // EASU wants its source in gamma 2.0: the page is an sRGB target (read back linear), so its gathers are taken to gamma
      // 2.0 where FSRCommon hands them over for HDR input (FsrEasuProcessInput), then squared back on the way out
      #define HDR_INPUT 1
      #define FSR_EASU_ONE_OVER_PAPER_WHITE 1.0
      #define FastTonemap(c) sqrt(max(c, 0.0))
      #define FSR_INPUT_TEXTURE _UpSrc
      #define FSR_INPUT_SAMPLER sampler_LinearClamp
      #include "Packages/com.unity.render-pipelines.core/Runtime/PostProcessing/Shaders/FSRCommon.hlsl"
      float4 frag(V2F i) : SV_Target
      {
        float3 c = ApplyEASU(OutPixel(i.uv));
        return float4(c * c, 1.0);
      }
      ENDHLSL
    }

    Pass
    {
      Name "RCAS"
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      #define FSR_INPUT_TEXTURE _UpSrc
      #define FSR_INPUT_SAMPLER sampler_LinearClamp
      #include "Packages/com.unity.render-pipelines.core/Runtime/PostProcessing/Shaders/FSRCommon.hlsl"
      float4 frag(V2F i) : SV_Target { return float4(ApplyRCAS(OutPixel(i.uv)), 1.0); }
      ENDHLSL
    }

    Pass
    {
      Name "SGSR"
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      float4 _SgsrViewport;   // the source's 1/width, 1/height, width, height (SGSR's ViewportInfo)
      #include "SGSR1.hlsl"
      float4 frag(V2F i) : SV_Target
      {
        half4 c = half4(0, 0, 0, 1);
        SgsrYuvH(c, i.uv, _SgsrViewport);
        return float4((float3)(c.rgb * c.rgb), 1.0);
      }
      ENDHLSL
    }

    Pass
    {
      Name "Linear"
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      float4 frag(V2F i) : SV_Target { return float4(SAMPLE_TEXTURE2D_X_LOD(_UpSrc, sampler_LinearClamp, i.uv, 0).rgb, 1.0); }
      ENDHLSL
    }
  }
}
