// A world drawn as the approach from space and the galactic map draw it (src/ship/approach.js
// planetMaterial): its body colour, its own mark (dune stripes, cloud bands, craters, continents
// with inked coasts, lit windows), a flat shadow crescent hatched in ink, the cream highlight arc
// by the lit limb. A prop that faces the camera (its +z), its markings turning about its axis.
// Self-lit in the G-buffer: it keeps its colours whatever the sun does; the composite inks its
// outline like everything else. _Kind 0 is a flat self-lit colour (the rims, rings and moons).
Shader "Memento/Planet"
{
  Properties
  {
    _Body ("Body (display values)", Vector) = (0.91, 0.72, 0.39, 1)
    _Shade ("Shade", Vector) = (0.77, 0.53, 0.29, 1)
    _Mark ("Mark", Vector) = (0.96, 0.84, 0.57, 1)
    _Kind ("Mark kind (0 flat, 1 dunes, 2 bands, 3 craters, 4 lands, 5 lights, 6 ring, 7 moon)", Float) = 1
    _Spin ("Spin", Float) = 0
    _InkK ("Ink", Float) = 1
    _Freq ("Frequency", Float) = 1
    _Light ("Light (planet-local, three space)", Vector) = (-0.55, 0.5, 0.68, 0)
  }
  SubShader
  {
    Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" }
    Pass
    {
      Name "MementoGBuffer"
      Tags { "LightMode" = "MementoGBuffer" }
      Cull Off
      HLSLPROGRAM
      #pragma target 4.5
      #pragma vertex vert
      #pragma fragment frag
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
      #include "MementoCommon.hlsl"
      float4 _Body, _Shade, _Mark, _Light;
      float _Kind, _Spin, _InkK, _Freq;
      struct A { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
      struct V { float4 positionCS : SV_POSITION; float3 obj : TEXCOORD0; float3 nrm : TEXCOORD1; float viewDepth : TEXCOORD2; };
      V vert(A v)
      {
        V o;
        float3 ws = TransformObjectToWorld(v.positionOS.xyz);
        o.positionCS = TransformWorldToHClip(ws);
        o.viewDepth = -TransformWorldToView(ws).z;
        // (object space mirrored back into three's: the patterns land as the web draws them)
        o.obj = float3(-v.positionOS.x, v.positionOS.y, v.positionOS.z);
        o.nrm = toThree(normalize(TransformObjectToWorldNormal(v.normalOS)));
        return o;
      }
      float h3(float3 p) { return frac(sin(dot(p, float3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float vn3(float3 p)
      {
        float3 i = floor(p), f = frac(p); f = f * f * (3.0 - 2.0 * f);
        float a = lerp(lerp(h3(i), h3(i + float3(1, 0, 0)), f.x), lerp(h3(i + float3(0, 1, 0)), h3(i + float3(1, 1, 0)), f.x), f.y);
        float b = lerp(lerp(h3(i + float3(0, 0, 1)), h3(i + float3(1, 0, 1)), f.x), lerp(h3(i + float3(0, 1, 1)), h3(i + float3(1, 1, 1)), f.x), f.y);
        return lerp(a, b, f.z);
      }
      float fbm3(float3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn3(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
      float cut(float f, float th) { float w = fwidth(f) * 0.75 + 1e-4; return smoothstep(th - w, th + w, f); }
      float line1(float f, float th, float px) { float w = fwidth(f) + 1e-4; return 1.0 - smoothstep(px * 0.5 * w, (px * 0.5 + 1.0) * w, abs(f - th)); }

      struct G { float4 a : SV_Target0; float4 n : SV_Target1; float4 h : SV_Target2; };
      G frag(V i)
      {
        G o;
        o.n = float4(normalize(i.nrm), i.viewDepth);
        o.h = float4(0, 0, 0, 1);   // self-lit
        int kind = (int)(_Kind + 0.5);
        if (kind == 0) { o.a = float4(_Body.rgb, 1.0); return o; }
        float3 n = normalize(i.obj);
        float c = cos(_Spin), s = sin(_Spin);
        float3 q = float3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);
        float3 col = _Body.rgb;
        float ink = 0.0;
        if (kind == 1)
        {
          float lon = atan2(q.z, q.x);
          float v = q.y * 5.5 * _Freq + 0.22 * sin(lon * 5.0 + q.y * 4.0) + 0.1 * sin(lon * 11.0);
          float st = frac(v);
          col = lerp(col, _Mark.rgb, cut(st, 0.62) * (1.0 - cut(st, 0.86)));
          ink = max(ink, line1(st, 0.62, 1.2) * 0.6);
        }
        else if (kind == 2)
        {
          float v = q.y + 0.05 * sin(atan2(q.z, q.x) * 3.0 + q.y * 9.0) + (fbm3(q * 3.0) - 0.5) * 0.08;
          float b = cut(v, -0.52) * (1.0 - cut(v, -0.34)) + cut(v, -0.06) * (1.0 - cut(v, 0.04)) + cut(v, 0.28) * (1.0 - cut(v, 0.5));
          col = lerp(col, _Mark.rgb, saturate(b));
        }
        else if (kind == 3 || kind == 7)
        {
          for (int k = 0; k < 9; k++)
          {
            float fk = (float)k;
            float3 cdir = normalize(float3(h3(float3(fk, 1, 2)), h3(float3(fk, 3, 5)), h3(float3(fk, 7, 11))) * 2.0 - 1.0);
            float r = 0.12 + 0.16 * h3(float3(fk, 13, 17));
            float d = acos(clamp(dot(q, cdir), -1.0, 1.0));
            col = lerp(col, _Mark.rgb, 1.0 - cut(d, r));
            ink = max(ink, line1(d, r, 1.6));
          }
        }
        else if (kind == 4)
        {
          float f = fbm3(q * 2.1 + 3.0);
          col = lerp(col, _Mark.rgb, cut(f, 0.53));
          ink = max(ink, line1(f, 0.53, 1.6));
        }
        else if (kind == 5)
        {
          float3 g = q * 9.0 * _Freq, cell = floor(g), fr = frac(g) - 0.5;
          float on = step(0.72, h3(cell));
          float sq = (1.0 - cut(max(abs(fr.x), max(abs(fr.y), abs(fr.z))), 0.16)) * on;
          col = lerp(col, _Mark.rgb, sq);
        }
        // the crescent in shadow, flat, hatched across the disc
        float lit = dot(n, normalize(_Light.xyz));
        float shadow = 1.0 - cut(lit, 0.1);
        col = lerp(col, _Shade.rgb * lerp(float3(1, 1, 1), col / max(_Body.rgb, float3(0.05, 0.05, 0.05)), 0.35), shadow);
        float hv = (n.x - n.y) * 34.0 * _Freq;
        float hatch = line1(frac(hv), 0.5, 1.1) * cut(-lit, 0.08);
        ink = max(ink, hatch * 0.8);
        // the highlight arc near the lit limb (as the map draws it)
        float rim = length(n.xy), ang = atan2(n.y, n.x);
        float hl = cut(rim, 0.78) * (1.0 - cut(rim, 0.84)) * cut(ang, 1.75) * (1.0 - cut(ang, 2.55));
        col = lerp(col, float3(0.969, 0.925, 0.824), hl * 0.9);
        col = lerp(col, float3(0.169, 0.129, 0.122), saturate(ink * _InkK));
        o.a = float4(col, 1.0);
        return o;
      }
      ENDHLSL
    }
  }
}
