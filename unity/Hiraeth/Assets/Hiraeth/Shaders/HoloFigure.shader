// A recording's figure in light, for the bridge (src/ship/hologram.js, issue #394): the father's message over the dash,
// the parents over the reel at home. The page draws them after its ink composite into a target of their own, each tested
// by hand against the G-buffer's depth, and lays that over the frame; here they are drawn over the finished picture
// (Transparent+40, premultiplied: Blend One OneMinusSrcAlpha), tested against _GNormalTex.w the same way, writing depth
// so a face hides the back of its own head. The fragment is the page's: its kinds (0 a colour, 1 per vertex, 2 the clothes
// by region, 3 the eyes, 4 its own picture: the father's generated body, _Map), two flat tones, the edge line, the
// scanlines, the flicker, the grains below the bust, the slices sliding sideways when torn up, the mouth as it talks.
// What moves comes in three vectors (engine/mirror.js LIVE_VECTORS): _HoloA rising, torn, the mouth, the seed; _HoloB the
// lens's and the picture's top's world y, the bust's cut (the body's metres); _HoloC the figure's feet (three's world) and
// 1 / its scale. The bind pose rides in uv3 (engine/unity/pack.js), x mirrored like every point.
Shader "Hiraeth/HoloFigure"
{
  Properties
  {
    _Color ("Color", Vector) = (1, 1, 1, 1)
    _Color2 ("Color 2", Vector) = (1, 1, 1, 1)
    _Color3 ("Color 3", Vector) = (1, 1, 1, 1)
    _Skin ("Skin", Vector) = (0.91, 0.78, 0.66, 1)
    _Tint ("The projector's light", Vector) = (0.56, 0.95, 0.9, 1)
    _Outfit ("bootTop, beltY, neckY, wristX", Vector) = (0.13, 0.97, 1.47, 0.64)
    _Glove ("Glove", Vector) = (0, 0, 0, 0)
    _Face ("eyeY, eyeX, noseY, chinY", Vector) = (-1, 0, 0, 0)
    _EyeC ("The eyes' centre", Vector) = (0.034, 1.7, 0.066, 0.44)
    _GenFace ("The generated face: mouth y, half width, -, front z", Vector) = (0, 0.023, 0, 0)
    _Kind ("Kind", Float) = 0
    _VertexColors ("Vertex colours", Float) = 0
    _HoloA ("Rising, torn, mouth, seed", Vector) = (0, 0, 0, 0)
    _HoloB ("Lens y, top y, cut bottom, cut top", Vector) = (0, 1, 0, 0)
    _HoloC ("Feet (three), 1 / scale", Vector) = (0, 0, 0, 1)
    _Map ("Picture", 2D) = "white" {}
    _Cull ("Cull", Float) = 2
  }
  SubShader
  {
    Tags { "RenderType" = "Transparent" "Queue" = "Transparent+40" "RenderPipeline" = "UniversalPipeline" }
    Pass
    {
      Tags { "LightMode" = "UniversalForward" }
      Blend One OneMinusSrcAlpha
      ZWrite On
      ZTest LEqual
      Cull [_Cull]
      HLSLPROGRAM
      #pragma vertex vert
      #pragma fragment frag
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      #include "GAt.hlsl"
      TEXTURE2D(_Map); SAMPLER(sampler_Map);
      CBUFFER_START(UnityPerMaterial)
      float4 _Color, _Color2, _Color3, _Skin, _Tint, _Outfit, _Glove, _Face, _EyeC, _GenFace, _HoloA, _HoloB, _HoloC, _Map_ST;
      float _Kind, _VertexColors, _Cull;
      CBUFFER_END
      struct A { float4 pos : POSITION; float3 nrm : NORMAL; float2 uv : TEXCOORD0; float4 col : COLOR; float3 bind : TEXCOORD3; };
      struct V { float4 cs : SV_POSITION; float3 w : TEXCOORD0; float3 n : TEXCOORD1; float3 b : TEXCOORD2; float3 c : TEXCOORD3; float3 l : TEXCOORD4; float2 uv : TEXCOORD5; float d : TEXCOORD6; };
      V vert(A v)
      {
        V o;
        float3 wp = TransformObjectToWorld(v.pos.xyz);
        float t = _Time.y, g = _HoloA.y, seed = _HoloA.w;
        // the glitch: now and then a thin slice of the picture slides sideways (more when torn up)
        float band = floor(wp.y * 16.0) + floor(t * 7.0) * 13.0;
        float r = frac(sin(band * 12.9898 + seed * 7.13) * 43758.5453);
        float slide = step(0.93 - g * 0.45, r) * (r - 0.5) * (0.035 + g * 0.3);
        float3 tw = float3(-wp.x, wp.y, wp.z);   // (three's frame: x mirrored back)
        o.l = (tw - _HoloC.xyz) * _HoloC.w;       // (the figure's own metres, its feet at 0)
        wp += UNITY_MATRIX_V[0].xyz * slide;
        o.w = wp; o.n = TransformObjectToWorldNormal(v.nrm);
        o.b = float3(-v.bind.x, v.bind.y, v.bind.z);
        o.c = _VertexColors > 0.5 ? v.col.rgb : float3(1, 1, 1);
        o.uv = v.uv;
        o.d = -TransformWorldToView(wp).z;
        o.cs = TransformWorldToHClip(wp);
        return o;
      }
      float hash3(float3 p) { return frac(sin(dot(p, float3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float segDist(float2 p, float2 a, float2 b) { float2 pa = p - a, ba = b - a; return length(pa - ba * saturate(dot(pa, ba) / dot(ba, ba))); }
      float inkLine(float d, float w) { return 1.0 - smoothstep(w * 0.5, w, d); }
      float4 frag(V i) : SV_Target
      {
        const float3 INK = float3(0.13, 0.1, 0.11);
        // behind the traveller, the dash: hidden (the page's test against its G-buffer)
        float scene = GAt(i.cs).w;
        if (scene > 0.0 && i.d > scene + 0.04) discard;
        float t = _Time.y, alpha = _HoloA.x, g = _HoloA.y, talk = _HoloA.z, seed = _HoloA.w;
        float h = saturate((i.w.y - _HoloB.x) / max(_HoloB.y - _HoloB.x, 0.01));
        float reveal = smoothstep(h - 0.05, h + 0.05, alpha * 1.15 - 0.075);
        if (reveal <= 0.001) discard;
        float cut = smoothstep(_HoloB.z, _HoloB.w, i.l.y);
        float grain = hash3(floor(i.l * 110.0) + floor(t * 2.0) * 0.37);
        if (cut < grain * 0.55 + 0.01) discard;
        float3 vb = i.b, alb = _Color.rgb;
        int kind = (int)(_Kind + 0.5);
        if (kind == 4)
        {
          alb = SAMPLE_TEXTURE2D(_Map, sampler_Map, i.uv).rgb;   // (decoded to linear: back to display values, as the page's)
          alb = lerp(alb * 12.92, 1.055 * pow(max(alb, 0.0), 1.0 / 2.4) - 0.055, step(0.0031308, alb));
        }
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
          float3 dd = normalize(vb - float3(side * _EyeC.x, _EyeC.y, _EyeC.z));
          float f = dot(dd, normalize(float3(0.0, -0.2, 1.0)));
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
        if (kind == 4 && vb.z > _GenFace.w && talk > 0.01)
        {
          float2 mouth = float2(vb.x / _GenFace.y, (vb.y - _GenFace.x + talk * 0.004) / (0.001 + talk * 0.006));
          ink = (1.0 - smoothstep(0.7, 1.0, length(mouth))) * talk;
        }
        if (kind == 2 && _Face.x > 0.0 && vb.y > _Outfit.z && abs(vb.x) < 0.16 && vb.z > 0.03)
        {
          float2 q = float2(abs(vb.x), vb.y - _Face.x);
          float fw = max(fwidth(q.y), 1e-4) * 1.3;
          float e = _Face.y, ny = _Face.z - _Face.x, cy = _Face.w - _Face.x;
          float2 lid = (q - float2(e, 0.004)) / float2(0.017, 0.008);
          ink = max(ink, inkLine(abs(length(lid) - 1.0) * 0.008 / fw, 0.7) * step(0.0, lid.y + 0.25) * step(abs(lid.x), 1.1) * 0.7);
          ink = max(ink, inkLine(segDist(q, float2(0.021, ny - 0.003), float2(0.03, ny - 0.03)) / fw, 0.7) * 0.35);
          float my = ny + (cy - ny) * 0.42;
          float2 m = float2(q.x / 0.02, (q.y - my - 0.003 * min(q.x * q.x / 0.0004, 1.0)) / (0.0025 + 0.011 * talk));
          ink = max(ink, 1.0 - smoothstep(0.7, 1.0, length(m)));
        }
        float scan = 1.0 - 0.16 * smoothstep(0.55, 1.0, sin(i.l.y * 380.0 - t * 6.0));
        float roll = 1.0 + 0.15 * smoothstep(0.9, 1.0, 1.0 - abs(frac(i.l.y * 0.8 - t * 0.26) - 0.5) * 2.0);
        float flicker = 0.92 + 0.08 * sin(t * 61.0 + seed) * sin(t * 7.3 + seed * 3.0) - g * 0.35 * step(0.6, frac(t * 11.0 + seed));
        col *= scan * roll * flicker;
        float edge = smoothstep(0.72, 0.95, 1.0 - ndv);
        col = lerp(col, lerp(alb, 1.0, 0.5) * 1.1 + _Tint.rgb * 0.3, edge * 0.8);
        float fray = smoothstep(0.0, 0.25, cut) * (1.0 - smoothstep(0.3, 0.8, cut));
        float seam = smoothstep(0.04, 0.0, abs(h - (alpha * 1.15 - 0.075))) * step(alpha, 0.999);
        col += (_Tint.rgb * 0.22 + alb * 0.12) * fray + float3(0.8, 1.0, 1.0) * seam * 0.8;
        col = lerp(col, INK, ink * 0.85);
        float a = (0.8 + 0.14 * edge + 0.1 * scan - 0.08) * smoothstep(0.0, 0.9, cut);
        a = max(a, ink * 0.9) * reveal;
        // (display values, as the page's: to the linear target; premultiplied)
        return float4(pow(saturate(col), 2.2) * a, a);
      }
      ENDHLSL
    }
  }
}
