// The glow buffer (src/post.js createBloom): the glowing surfaces (flags in the G-buffer's hatch
// alpha) gathered at a quarter of the resolution, then blurred, and again wider at an eighth.
// The composite lays it on as a halo in flat rings round each light and a wash of its colour.
Shader "Hidden/Memento/Bloom"
{
  SubShader
  {
    Tags { "RenderPipeline" = "UniversalPipeline" }
    ZTest Always ZWrite Off Cull Off
    HLSLINCLUDE
    #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
    Texture2D _GAlbedo, _GHatch, _BloomSrc;
    SamplerState sampler_linear_clamp;
    float4 _BloomStep;   // one texel along the blur, times its spread (uv)
    struct V2F { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; };
    V2F vert(uint id : SV_VertexID)
    {
      V2F o; float2 uv = float2((id << 1) & 2, id & 2);
      o.pos = float4(uv * 2.0 - 1.0, 0.0, 1.0);
      #if UNITY_UV_STARTS_AT_TOP
        o.pos.y = -o.pos.y;
      #endif
      o.uv = uv; return o;
    }
    ENDHLSL
    Pass
    {
      Name "Extract"
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      float4 frag(V2F i) : SV_Target
      {
        uint w, h; _GHatch.GetDimensions(w, h);
        int2 base = int2(i.pos.xy) * 4, size = int2(w, h);
        float3 sum = 0, mx = 0;
        for (int y = 0; y < 4; y++)
          for (int x = 0; x < 4; x++)
          {
            int2 p = min(base + int2(x, y), size - 1);
            float a = fmod(_GHatch.Load(int3(p, 0)).a, 16.0);   // (+16 a face, +32 banked sand: post.js)
            a -= 8.0 * step(7.5, a); a -= 4.0 * step(3.5, a); a -= 2.0 * step(1.5, a);
            float e = smoothstep(0.62, 0.9, a);
            if (e > 0.0) { float3 c = _GAlbedo.Load(int3(p, 0)).rgb * e; sum += c; mx = max(mx, c); }
          }
        return float4(lerp(sum / 16.0, mx, 0.5), 1.0);
      }
      ENDHLSL
    }
    Pass
    {
      Name "Blur"
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      float4 frag(V2F i) : SV_Target
      {
        float2 uv = i.uv, s = _BloomStep.xy;
        float3 c = _BloomSrc.SampleLevel(sampler_linear_clamp, uv, 0).rgb * 0.19648;
        c += (_BloomSrc.SampleLevel(sampler_linear_clamp, uv + s * 1.41176, 0).rgb + _BloomSrc.SampleLevel(sampler_linear_clamp, uv - s * 1.41176, 0).rgb) * 0.29691;
        c += (_BloomSrc.SampleLevel(sampler_linear_clamp, uv + s * 3.29412, 0).rgb + _BloomSrc.SampleLevel(sampler_linear_clamp, uv - s * 3.29412, 0).rgb) * 0.09447;
        c += (_BloomSrc.SampleLevel(sampler_linear_clamp, uv + s * 5.17647, 0).rgb + _BloomSrc.SampleLevel(sampler_linear_clamp, uv - s * 5.17647, 0).rgb) * 0.01038;
        return float4(c, 1.0);
      }
      ENDHLSL
    }
    Pass
    {
      // (not the glow's: MementoFeature's copy of the scene's depth before the water is drawn, for its contact foam,
      // water-shader.js contactFoam) the G-buffer's depth as the opaques left it, as a view depth in metres; the sky 0
      Name "SceneDepth"
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      Texture2D<float> _GDepthSrc;
      float4 _SceneZParams;   // this camera's _ZBufferParams: view depth = 1 / (z * raw + w)
      float4 frag(V2F i) : SV_Target
      {
        float raw = _GDepthSrc.Load(int3(int2(i.pos.xy), 0));
        #if UNITY_REVERSED_Z
          bool sky = raw <= 0.0;
        #else
          bool sky = raw >= 1.0;
        #endif
        return sky ? 0.0 : 1.0 / (_SceneZParams.z * raw + _SceneZParams.w);
      }
      ENDHLSL
    }
  }
}
