// Memento surface: the port of the web game's one G-buffer material (src/materials.js).
// It does no stylisation. It writes the ingredients the ink composite needs:
//   SV_Target0  rgb = flat albedo (sand patches, strata, façades…), a = light term (half-lambert x cast shadow)
//   SV_Target1  rgb = world normal (three space), a = linear view depth (0 = sky)
//   SV_Target2  r = single hatch / stipple, g = cross hatch, b = drawn detail lines, a = glow + 2 hero + 4 figure
// The LightMode "MementoGBuffer" pass is drawn by MementoFeature (a URP renderer feature).
Shader "Memento/Surface"
{
  Properties
  {
    _Color ("Color", Vector) = (1, 1, 1, 1)
    _Color2 ("Color 2", Vector) = (1, 1, 1, 1)
    _Color3 ("Color 3", Vector) = (1, 1, 1, 1)
    _Mode ("Mode (0 plain, 1 terrain, 2 strata, 3 water)", Float) = 0
    _Flat ("Faceted", Float) = 0
    _StrataSize ("Strata size", Float) = 4
    _Grid ("Grid spacing", Float) = 0
    _Glyphs ("Glyphs", Float) = 0
    _Biomes ("Biomes", Float) = 0
    _Ripples ("Ripples", Float) = 0
    _SandInk ("Sand ink", Float) = 0
    _Ticks ("Grass ticks", Float) = 0
    _Glow ("Glow", Float) = 0
    _Folds ("Folds", Float) = 0
    _Scrub ("Scrub", Float) = 0
    _Pattern ("Pattern (1 facade, 2 tiles, 3 leaves, 4 cracks)", Float) = 0
    _Figure ("Figure", Float) = 0
    _Hero ("Hero", Float) = 0
    _Sway ("Sway", Float) = 0
    _StrataObject ("Strata in object space", Float) = 0
    _PaletteSize ("Palette size", Float) = 0
    _Cull ("Cull", Float) = 2
  }
  SubShader
  {
    Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" }

    HLSLINCLUDE
    #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
    #include "MementoCommon.hlsl"
    #include "Figure.hlsl"

    float4 _Color, _Color2, _Color3;
    float _Mode, _Flat, _StrataSize, _Grid, _Glyphs, _Biomes, _Ripples, _SandInk, _Ticks, _Glow, _Folds, _Scrub, _Pattern, _Figure, _Hero, _Sway, _StrataObject, _PaletteSize;
    float4 _Palette[12];
    float _NoVertexColor;
    float _Bind;           // people (Figures.cs): the rest pose in uv3 / uv4, so their drawing rides on the body

    struct Attributes
    {
      float4 positionOS : POSITION;
      float3 normalOS : NORMAL;
      float4 color : COLOR;
      float2 uv : TEXCOORD0;
      float2 fold : TEXCOORD1;
      float4 sway : TEXCOORD2;   // plants: anchor x, z (Unity world), bend per metre of wind, brush lean
      float3 bind : TEXCOORD3;   // people: the rest-pose position (outfit zones, face, eyes: Figures.cs)
      float3 bindN : TEXCOORD4;  // and its normal
    };

    // the wind bend of an instanced plant (materials.js SWAY), as a world displacement (Unity space)
    float3 swayOffset(float4 sw)
    {
      if (_Sway <= 0.0 || (sw.z == 0.0 && sw.w == 0.0)) return 0;
      float2 at = float2(-sw.x, sw.y);   // three space
      float2 wd = _Wind.xy;
      float str = _Wind.z, along = dot(at, wd);
      float wave = 0.5 + 0.5 * sin(_MTime * 1.7 - along * 0.09);
      float push = str * (0.35 + 0.65 * _Wind.w * wave);
      float flutter = (0.45 + 0.55 * str) * sin(_MTime * (1.3 + 0.9 * str) + at.x * 0.37 + at.y * 0.21);
      float2 side = float2(-wd.y, wd.x);
      float2 bend = wd * (push * 3.0 + flutter * 1.2) + side * sin(_MTime * 1.05 + at.y * 0.41 - at.x * 0.13) * 0.6 * (0.5 + 0.5 * str);
      float2 away = at - _Brush.xz;
      float dB = length(away);
      float brush = (1.0 - smoothstep(0.4, 1.8, dB)) * (0.6 + 0.25 * min(_Brush.w, 6.0));
      float2 shove = (dB > 1e-3 ? away / dB : float2(0, 0)) * brush;
      float2 d3 = bend * sw.z + shove * sw.w;
      return float3(-d3.x, 0.0, d3.y);
    }
    ENDHLSL

    Pass
    {
      Name "MementoGBuffer"
      Tags { "LightMode" = "MementoGBuffer" }
      Cull [_Cull]
      ZWrite On
      ZTest LEqual

      HLSLPROGRAM
      #pragma target 4.5
      #pragma vertex vert
      #pragma fragment frag
      #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
      #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"

      struct Varyings
      {
        float4 positionCS : SV_POSITION;
        float3 worldPos : TEXCOORD0;    // three space
        float3 normal : TEXCOORD1;      // three space, world
        float3 instColor : TEXCOORD2;
        float viewDepth : TEXCOORD3;
        float3 objPos : TEXCOORD4;      // three space, object frame x scale (static chunks: the world)
        float3 objNormal : TEXCOORD5;
        float3 objRel : TEXCOORD6;      // objPos measured from the camera (facet normals stay exact far out)
        float2 fold : TEXCOORD7;
        float3 posWS : TEXCOORD8;       // Unity space (shadows)
        float3 bind : TEXCOORD9;
      };

      Varyings vert(Attributes v)
      {
        Varyings o;
        float3 posWS = TransformObjectToWorld(v.positionOS.xyz) + swayOffset(v.sway);
        float3 nWS = TransformObjectToWorldNormal(v.normalOS);
        float3 scl = float3(length(UNITY_MATRIX_M._m00_m10_m20), length(UNITY_MATRIX_M._m01_m11_m21), length(UNITY_MATRIX_M._m02_m12_m22));
        o.positionCS = TransformWorldToHClip(posWS);
        o.posWS = posWS;
        o.worldPos = toThree(posWS);
        o.normal = toThree(nWS);
        o.instColor = _NoVertexColor > 0.5 ? float3(1, 1, 1) : v.color.rgb;   // (a mesh without colours may read black)
        o.viewDepth = -TransformWorldToView(posWS).z;
        o.objPos = toThree(v.positionOS.xyz * scl);
        o.objNormal = toThree(v.normalOS / scl);
        if (_Bind > 0.5) { o.objPos = toThree(v.bind * scl); o.objNormal = toThree(v.bindN / scl); }   // (three: the unskinned position)
        float3 camOS = mul(UNITY_MATRIX_I_M, float4(_WorldSpaceCameraPos, 1.0)).xyz;
        o.objRel = o.objPos - toThree(camOS * scl);
        o.fold = v.fold;
        o.bind = toThree(v.bind);
        return o;
      }

      float3 strataBand(float band)
      {
        float t = frac(sin(band * 12.9898) * 43758.5453);
        return t < 0.4 ? _Color.rgb : (t < 0.75 ? _Color2.rgb : _Color3.rgb);
      }
      float3 strata(float3 wp)
      {
        float t = (wp.y + (vnoise(wp.xz * 0.04) - 0.5) * _StrataSize * 0.9) / _StrataSize;
        float gt = max(length(float2(ddx(t), ddy(t))), 1e-6);
        float3 c = strataBand(floor(t));
        float3 mean = _Color.rgb * 0.4 + _Color2.rgb * 0.35 + _Color3.rgb * 0.25;
        return lerp(mean, c, smoothstep(2.5, 5.0, 1.0 / gt));
      }
      float2 strokeCoord(float3 objPos, float3 w, float2 dir)
      {
        float2 perp = float2(-dir.y, dir.x);
        float2 a = objPos.zy, b = objPos.xz, c = objPos.xy;
        return w.x * float2(dot(a, dir), dot(a, perp)) + w.y * float2(dot(b, dir), dot(b, perp)) + w.z * float2(dot(c, dir), dot(c, perp));
      }

      struct GBufferOut
      {
        float4 albedoLight : SV_Target0;
        float4 normalDepth : SV_Target1;
        float4 hatch : SV_Target2;
      };

      GBufferOut frag(Varyings i, bool frontFace : SV_IsFrontFace)
      {
        int mode = (int)(_Mode + 0.5);
        // glass (the bubble helmet): see-through except at the grazing rim and a curved highlight
        if (_Glass > 0.0)
        {
          float3 Vg = normalize(toThree(_WorldSpaceCameraPos) - i.worldPos);
          float fr = 1.0 - abs(dot(normalize(i.normal), Vg));
          float3 od = normalize(i.objPos - _GlassCenter.xyz);
          float streak = step(abs(atan2(od.y, od.x) - 2.2), 0.09) * step(0.25, od.z) * step(od.z, 0.75);
          if (fr < 0.72 && streak < 0.5) discard;
        }
        float fwBind = max(fwidth(i.bind.y), fwidth(i.bind.x));
        // stroke coordinates + derivatives first, in uniform control flow
        float3 facetO = cross(ddx(i.objRel), ddy(i.objRel));
        float3 on = _Flat > 0.5 ? facetO : i.objNormal;
        float3 tw = pow(abs(normalize(on)), 3.0);
        tw /= (tw.x + tw.y + tw.z);
        if (_Flat > 0.5) {
          float3 a = abs(on);
          tw = a.x > a.y && a.x > a.z ? float3(1, 0, 0) : (a.y > a.z ? float3(0, 1, 0) : float3(0, 0, 1));
        }
        if (mode == MODE_TERRAIN) tw = float3(0, 1, 0);
        float2 ce1 = strokeCoord(i.objPos, tw, float2(0.766, 0.643));
        float2 ce2 = strokeCoord(i.objPos, tw, float2(0.83, -0.56));
        float fw1 = fwidth(ce1.x), fw2 = fwidth(ce2.x);
        float2 ceY = float2(i.objPos.y, dot(i.objPos.xz, float2(0.7071, 0.7071)));
        float fwY = fwidth(i.objPos.y);
        float2 fwd = float2(fw1, fwidth(ce1.y));
        float3 gq = i.objPos / max(_Grid, 1e-3);
        float3 gfw = fwidth(gq);
        float3 gw = 0;
        if (_Grid > 0.0 || _Glyphs > 0.0) { gw = pow(abs(normalize(on)), 6.0); gw /= (gw.x + gw.y + gw.z); }
        float2 fwp = fwidth(i.worldPos.xz);
        float foldU = i.fold.x * _Folds;
        float foldFw = fwidth(foldU);
        float faceX = abs(on.x) > abs(on.z) ? i.objPos.z : i.objPos.x;
        float fissFw = fwidth(faceX) / 9.0;
        float2 glyphUV = gw.x > max(gw.y, gw.z) ? gq.zy : (gw.y > gw.z ? gq.xz : gq.xy);
        float2 glyphFw = gw.x > max(gw.y, gw.z) ? gfw.zy : (gw.y > gw.z ? gfw.xz : gfw.xy);

        float3 n = normalize(i.normal);
        float3 viewT = toThree(_WorldSpaceCameraPos) - i.worldPos;
        if (_Flat > 0.5) {
          float3 rel = i.worldPos - toThree(_WorldSpaceCameraPos);
          n = normalize(cross(ddx(rel), ddy(rel)));
          if (dot(n, viewT) < 0.0) n = -n;
        } else if (!frontFace && (_Bind > 0.5 || (_Figure < 0.5 && _Hero < 0.5))) n = -n;   // (glTFast's skinned bodies read as back faces; the exported people do not)

        float3 albedo = _Color.rgb;
        float3 instColor = i.instColor;
        if (_PaletteSize > 0.5) {
          float best = 1e9;
          for (int k = 0; k < 12; k++) {
            if (k >= (int)_PaletteSize) break;
            float3 d = i.instColor - _Palette[k].rgb;
            if (dot(d, d) < best) { best = dot(d, d); instColor = _Palette[k].rgb; }
          }
        }
        float2 bw = 0;
        float slope = 1.0 - n.y;
        float3 strataC = strata(_StrataObject > 0.5 ? i.objPos : i.worldPos);
        if (mode == MODE_TERRAIN) {
          float3 c1 = _Color.rgb, c2 = _Color2.rgb, c3 = _Color3.rgb;
          if (_Biomes > 0.5) { bw = biomeWeights(i.worldPos.xz); biomeGround(bw, c1, c2, c3); }
          float patches = vnoise(i.worldPos.xz * 0.011) * 0.65 + vnoise(i.worldPos.xz * 0.045) * 0.35;
          albedo = patches > 0.6 ? c2 : c1;
          if (slope > 0.42) albedo = c3;
          else if (slope > 0.30 && patches < 0.45) albedo = lerp(c1, c3, 0.5);
          float b = max(blobs(i.worldPos.xz, fwp, 2.2, 0.28, 0.45, 0.0), max(blobs(i.worldPos.xz, fwp, 11.0, 1.3, 0.35, 41.0), blobs(i.worldPos.xz, fwp, 34.0, 3.2, 0.22, 97.0)));
          if (_SandInk < 0.5) albedo *= lerp(float3(1, 1, 1), float3(0.945, 0.935, 0.965), b);
        } else if (mode == MODE_STRATA) {
          albedo = strataC;
        } else if (mode == MODE_WATER) {
          float w = vnoise(i.worldPos.xz * 0.012 + _MTime * 0.01);
          albedo = w > 0.55 ? _Color2.rgb : _Color.rgb;
        } else if (mode == MODE_OUTFIT) {
          // a person's printed outfit (materials.js MODE_OUTFIT): boots, trousers, belt, tunic, skin at the neck and hands
          albedo = outfitAlbedo(i.bind, _Color.rgb, _Color2.rgb, _Color3.rgb);
        } else if (mode == MODE_EYE) {
          albedo = eyeball(i.bind, _Color.rgb, _Color2.rgb, _Skin.rgb);
        }
        float patInk = 0.0;
        int pattern = (int)(_Pattern + 0.5);
        // (the material's options are uniform over a draw: derivatives inside these branches are safe)
        UNITY_BRANCH if (pattern == 1) patInk = facade(i.worldPos, n, normalize(i.normal), albedo);
        else if (pattern == 2) patInk = roofTiles(i.worldPos);
        else if (pattern == 3) patInk = leaves(i.objPos);
        else if (pattern == 4) patInk = rockCracks(i.objPos);
        albedo *= instColor;
        if (_Folds > 0.0) albedo = (i.fold.y < 0.62 ? _Color.rgb : _Color2.rgb) * i.instColor;

        float ndl = dot(n, _SunDir);
        float lambert = ndl * 0.5 + 0.5;
        float sh = 1.0;
        if (ndl > 0.0) {
          float4 sc = TransformWorldToShadowCoord(i.posWS);
          sh = MainLightRealtimeShadow(sc);
          sh = lerp(sh, 1.0, GetMainLightShadowFade(i.posWS));
          sh *= cloudShadow(i.worldPos);
        }
        float L = lerp(min(lambert, 0.38), lambert, sh);
        L = lerp(L, 1.0, _Glow);
        float local = 0.0;
        for (int li = 0; li < 8; li++) {
          float3 dl = _MLights[li].xyz - i.worldPos;
          float d = length(dl);
          if (d < _MLights[li].w) {
            float att = pow(1.0 - d / _MLights[li].w, 2.0);
            local = max(local, att * (0.35 + 0.65 * max(dot(n, dl / d), 0.0)));
          }
        }
        L = max(L, lerp(L, 0.97, smoothstep(0.15, 0.5, local)));

        GBufferOut o;
        o.albedoLight = float4(albedo, L);
        o.normalDepth = float4(n, i.viewDepth);
        o.hatch = 0;

        // drawn detail (gHatch.b)
        float detail = 0.0;
        if (_Grid > 0.0) detail = gridLines(gq, gfw, gw);
        if (_Glyphs > 0.0) detail = max(detail, glyphs(glyphUV, glyphFw));
        float2 gp = i.worldPos.xz;
        UNITY_BRANCH if (mode == MODE_TERRAIN) {
          float gm = max(length(ddx(gp)), length(ddy(gp)));
          float2 q1 = crackCoord(gp, 5.5), q2 = crackCoord(gp + 31.0, 1.6);
          float4 j1 = float4(ddx(q1), ddy(q1)), j2 = float4(ddx(q2), ddy(q2));
          float ripples = sandRipples(gp, slope);
          float scuffs = sandScuffs(gp);
          float ticks = grassTicks(gp, fwp);
          float sandK = 1.0 - bw.y;
          if (_Ripples > 0.5) {
            detail = max(detail, ripples * sandK);
            float grains = sandGrains(gp, gm, 0.25, 0.12, 0.005, 0.01, 71.0) * 0.55;
            if (_Dots > 0.0) grains = max(grains, sandGrains(gp, gm, 0.4 * _Dots, 0.55, 0.03, 0.06, 13.0) * 0.8);
            detail = max(detail, grains * sandK * (1.0 - smoothstep(0.35, 0.6, slope)));
          }
          if (_Biomes > 0.5) {
            float k = smoothstep(0.3, 0.8, bw.y) * (1.0 - smoothstep(0.14, 0.22, slope));
            if (k > 0.0) detail = max(detail, mudCracks(gp, q1, j1, q2, j2) * k);
          }
          if (_Ticks > 0.5 && slope < 0.35) detail = max(detail, ticks * 0.8);
          if (_SandInk > 0.5) detail = max(detail, scuffs * (1.0 - bw.y));
        } else if (mode == MODE_WATER) {
          detail = max(detail, waterLines(gp, _MTime) * 0.7);
        } else if (mode == MODE_STRATA && abs(normalize(on).y) < 0.6) {
          detail = max(detail, fissures(float2(faceX, i.objPos.y), fissFw) * 0.85);
        }
        UNITY_BRANCH if (_Scrub > 0.0) {
          float dashN = smoothstep(0.42, 0.6, vnoise(float2(ce1.x * 2.5, ce1.y * 9.0)));
          float dk0 = clamp((_Toon - L) / _Toon, 0.0, 1.0);
          detail = max(detail, strokes(ce1, fw1, lerp(6.0, 3.5, dk0), lerp(0.8, 1.3, dk0)) * dashN * (0.6 + 0.4 * dk0));
        }
        if (_Folds > 0.0) {
          float colI = floor(foldU + 0.5);
          float d = abs(foldU - colI) / max(foldFw, 1e-5);
          float h1 = hash(float2(colI, 3.1)), h2 = hash(float2(colI, 8.7));
          float run = smoothstep(0.08 + h1 * 0.25, 0.14 + h1 * 0.25, i.fold.y) * (1.0 - smoothstep(0.75 + h2 * 0.25, 0.8 + h2 * 0.25, i.fold.y));
          detail = max(detail, inkLine(d, lerp(1.3, 0.7, i.fold.y)) * run * step(0.25, h2 + 0.3));
        }
        // the people: the suit's creases (creases.js) and the face (materials.js faceInk)
        if (_Creases > 0.0) detail = max(detail, outfitCreases(i.bind, normalize(i.objNormal), clamp((_Toon - L) / _Toon, 0.0, 1.0)));
        if (mode == MODE_OUTFIT && i.bind.y > _Outfit.z && abs(i.bind.x) < 0.16)
        {
          float frontal = smoothstep(0.15, 0.45, normalize(i.objNormal).z);
          detail = max(detail, faceInk(float2(abs(i.bind.x), i.bind.y - _Face.x), fwBind, frontal, i.bind.x));
        }
        detail = max(detail, patInk);
        o.hatch.b = detail;
        o.hatch.a = max(_Glow, smoothstep(0.15, 0.6, local) * 0.6) + 2.0 * _Hero + 4.0 * _Figure;

        // hatching in the shade (finer close to the camera, coarser far away)
        float dark = clamp((_Toon - L) / _Toon, 0.0, 1.0);
        float hsp = _HatchSpacing * lerp(0.78, 1.4, smoothstep(6.0, 260.0, i.viewDepth));
        float h1s = strokes(ce1, fw1, hsp, lerp(0.9, 2.2, dark)) * smoothstep(0.02, 0.12, dark);
        float hcs = strokes(ceY, fwY, hsp, lerp(0.9, 2.2, dark)) * smoothstep(0.02, 0.12, dark);
        bool rings = _FormHatch > 0.0 && _Flat < 0.5 && mode != MODE_TERRAIN;
        float h2s = (rings ? strokes(ceY, fwY, hsp * 1.2, lerp(0.6, 1.7, dark)) : strokes(ce2, fw2, hsp * 1.2, lerp(0.6, 1.7, dark))) * smoothstep(0.5, 0.65, dark);
        float st = stipple(ce1, fwd, hsp * 1.15, dark) * smoothstep(0.02, 0.15, dark);
        if (dark > 0.0 && _HatchOn > 0.0 && _ShadeStyle > 0.5) {
          o.hatch.r = st;
        } else if (dark > 0.0 && _HatchOn > 0.0) {
          float h1 = h1s;
          if (_FormHatch > 0.0 && mode == MODE_TERRAIN) h1 = lerp(h1, hcs, smoothstep(0.1, 0.3, slope) * _FormHatch);
          o.hatch.rg = float2(h1, dark > 0.5 ? h2s : 0.0);
        }
        return o;
      }
      ENDHLSL
    }

    Pass
    {
      Name "ShadowCaster"
      Tags { "LightMode" = "ShadowCaster" }
      ZWrite On
      ZTest LEqual
      ColorMask 0
      Cull Off

      HLSLPROGRAM
      #pragma vertex shadowVert
      #pragma fragment shadowFrag
      #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
      float3 _LightDirection;
      float3 _LightPosition;
      float4 shadowVert(Attributes v) : SV_POSITION
      {
        float3 posWS = TransformObjectToWorld(v.positionOS.xyz) + swayOffset(v.sway);
        float3 nWS = TransformObjectToWorldNormal(v.normalOS);
        float4 positionCS = TransformWorldToHClip(ApplyShadowBias(posWS, nWS, _LightDirection));
        #if UNITY_REVERSED_Z
          positionCS.z = min(positionCS.z, UNITY_NEAR_CLIP_VALUE);
        #else
          positionCS.z = max(positionCS.z, UNITY_NEAR_CLIP_VALUE);
        #endif
        return positionCS;
      }
      half4 shadowFrag() : SV_Target { return 0; }
      ENDHLSL
    }
  }
}
