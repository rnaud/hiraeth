// The recordings' hologram (src/ship/hologram.js): the parents as busts of light over the projector.
// They keep their own colours (skin, hair, clothes, read from each piece's material), shaded in two
// flat tones, with a bright edge line, scanlines climbing them, a flicker, a slice now and then
// sliding sideways (the glitch), the face's ink lines and a mouth that opens as they talk; below the
// chest they fall apart into grains, and they build from the lens up as they rise. Light, not ink:
// drawn after the composite (URP's transparent pass), premultiplied, front-most only.
Shader "Memento/Hologram"
{
  Properties
  {
    _Color ("Color", Vector) = (1, 1, 1, 1)
    _Color2 ("Color 2", Vector) = (1, 1, 1, 1)
    _Color3 ("Color 3", Vector) = (1, 1, 1, 1)
    _Kind ("Kind (0 colour, 1 vertex, 2 outfit, 3 eyes)", Float) = 0
  }
  SubShader
  {
    Tags { "RenderType" = "Transparent" "Queue" = "Transparent+100" "RenderPipeline" = "UniversalPipeline" }
    Pass
    {
      Tags { "LightMode" = "UniversalForward" }
      Blend One OneMinusSrcAlpha
      ZWrite On
      ZTest LEqual
      Cull Back
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      float4 _Color, _Color2, _Color3, _Skin, _Outfit, _Glove, _Face, _EyeC, _Tint;
      float _Kind, _Alpha, _Glitch, _Seed, _Talk, _HoloTime;
      float4 _Span;   // world y of the lens, of the picture's top
      float4 _Cut;    // the bust: gone below x, whole above y (the body's metres)
      float4 _Root;   // the figure's feet (world) and 1 / its scale: the posed body in its own metres
      struct A { float4 pos : POSITION; float3 nrm : NORMAL; float4 col : COLOR; float3 bind : TEXCOORD3; };
      struct V { float4 cs : SV_POSITION; float3 w : TEXCOORD0; float3 n : TEXCOORD1; float3 b : TEXCOORD2; float3 c : TEXCOORD3; float3 l : TEXCOORD4; };
      V vert(A v)
      {
        V o;
        float3 wp = TransformObjectToWorld(v.pos.xyz);
        // the glitch: now and then a thin slice slides sideways (more when torn up)
        float band = floor(wp.y * 16.0) + floor(_HoloTime * 7.0) * 13.0;
        float r = frac(sin(band * 12.9898 + _Seed * 7.13) * 43758.5453);
        float slide = step(0.93 - _Glitch * 0.45, r) * (r - 0.5) * (0.035 + _Glitch * 0.3);
        wp += UNITY_MATRIX_V[0].xyz * slide;
        o.l = (TransformObjectToWorld(v.pos.xyz) - _Root.xyz) * _Root.w;
        o.w = wp; o.n = TransformObjectToWorldNormal(v.nrm);
        o.b = float3(-v.bind.x, v.bind.y, v.bind.z);
        o.c = v.col.rgb;
        o.cs = TransformWorldToHClip(wp);
        return o;
      }
      float hash3(float3 p) { return frac(sin(dot(p, float3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float segDist(float2 p, float2 a, float2 b) { float2 pa = p - a, ba = b - a; return length(pa - ba * saturate(dot(pa, ba) / dot(ba, ba))); }
      float inkLine(float d, float w) { return 1.0 - smoothstep(w * 0.5, w, d); }
      float4 frag(V i) : SV_Target
      {
        const float3 INK = float3(0.13, 0.1, 0.11);
        float h = saturate((i.w.y - _Span.x) / max(_Span.y - _Span.x, 0.01));
        float reveal = smoothstep(h - 0.05, h + 0.05, _Alpha * 1.15 - 0.075);
        if (reveal <= 0.001) discard;
        float3 vb = i.b;
        float cut = smoothstep(_Cut.x, _Cut.y, i.l.y);
        float grain = hash3(floor(i.l * 110.0) + floor(_HoloTime * 2.0) * 0.37);
        if (cut < grain * 0.55 + 0.01) discard;
        float3 alb = _Color.rgb;
        int kind = (int)(_Kind + 0.5);
        if (kind == 1) alb = i.c * _Color.rgb;
        else if (kind == 2)
        {
          float ax = abs(vb.x);
          if (ax > _Outfit.w && _Glove.a > 0.5) alb = _Glove.rgb;
          else if ((vb.y > _Outfit.z && ax < 0.16) || ax > _Outfit.w) alb = _Skin.rgb;
          else if (vb.y < _Outfit.x) alb = _Color3.rgb;
          else if (vb.y < _Outfit.y) alb = _Color2.rgb;
          else alb = _Color.rgb;
        }
        else if (kind == 3)
        {
          float side = vb.x < 0.0 ? -1.0 : 1.0;
          float3 d = normalize(vb - float3(side * _EyeC.x, _EyeC.y, _EyeC.z));
          float f = dot(d, normalize(float3(0.0, -0.2, 1.0)));
          alb = lerp(_Color.rgb, lerp(_Color2.rgb, INK, 0.25), smoothstep(0.86, 0.9, f));
          alb = lerp(alb, INK, smoothstep(0.955, 0.97, f));
        }
        float3 N = normalize(i.n), Vw = normalize(_WorldSpaceCameraPos - i.w);
        float ndv = abs(dot(N, Vw));
        float3 key = normalize(Vw + float3(0.0, 1.1, 0.0));
        float lit = lerp(0.82, 1.1, smoothstep(0.12, 0.3, dot(N, key)));
        float3 col = alb * lit;
        col = lerp(col, _Tint.rgb * dot(col, float3(0.3, 0.59, 0.11)) * 1.25, 0.08) + _Tint.rgb * 0.04;
        float ink = 0.0;
        if (kind == 2 && _Face.x > 0.0 && vb.y > _Outfit.z && abs(vb.x) < 0.16 && vb.z > 0.03)
        {
          float2 q = float2(abs(vb.x), vb.y - _Face.x);
          float fw = max(fwidth(q.y), 1e-4) * 1.3;
          float e = _Face.y, ny = _Face.z - _Face.x, cy = _Face.w - _Face.x;
          float2 lid = (q - float2(e, 0.004)) / float2(0.017, 0.008);
          ink = max(ink, inkLine(abs(length(lid) - 1.0) * 0.008 / fw, 1.0) * step(0.0, lid.y + 0.25) * step(abs(lid.x), 1.1));
          ink = max(ink, inkLine(segDist(q, float2(0.02, ny - 0.002), float2(0.034, ny - 0.04)) / fw, 0.8) * 0.6);
          float my = ny + (cy - ny) * 0.42;
          float2 m = float2(q.x / 0.02, (q.y - my) / (0.0025 + 0.011 * _Talk));
          ink = max(ink, 1.0 - smoothstep(0.7, 1.0, length(m)));
        }
        float scan = 1.0 - 0.16 * smoothstep(0.55, 1.0, sin(i.l.y * 380.0 - _HoloTime * 6.0));
        float roll = 1.0 + 0.15 * smoothstep(0.9, 1.0, 1.0 - abs(frac(i.l.y * 0.8 - _HoloTime * 0.26) - 0.5) * 2.0);
        float flicker = 0.92 + 0.08 * sin(_HoloTime * 61.0 + _Seed) * sin(_HoloTime * 7.3 + _Seed * 3.0) - _Glitch * 0.35 * step(0.6, frac(_HoloTime * 11.0 + _Seed));
        col *= scan * roll * flicker;
        float edge = smoothstep(0.72, 0.95, 1.0 - ndv);
        col = lerp(col, lerp(alb, 1.0, 0.5) * 1.1 + _Tint.rgb * 0.3, edge * 0.8);
        float fray = smoothstep(0.0, 0.25, cut) * (1.0 - smoothstep(0.3, 0.8, cut));
        float seam = smoothstep(0.04, 0.0, abs(h - (_Alpha * 1.15 - 0.075))) * step(_Alpha, 0.999);
        col += (_Tint.rgb * 0.22 + alb * 0.12) * fray + float3(0.8, 1.0, 1.0) * seam * 0.8;
        col = lerp(col, INK, ink * 0.85);
        float a = (0.8 + 0.14 * edge + 0.1 * scan - 0.08) * smoothstep(0.0, 0.9, cut);
        a = max(a, ink * 0.9) * reveal;
        // (display values, as the game's: to the linear target)
        return float4(pow(saturate(col), 2.2) * a, a);
      }
      ENDHLSL
    }
  }
}
