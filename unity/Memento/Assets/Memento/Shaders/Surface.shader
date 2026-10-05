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
    _Metal ("Metal (kind, brushed, reflectivity, highlight; w 0: not a metal)", Vector) = (0, 0, 0, 0)
    _BrushAxis ("Brush axis (three, object)", Vector) = (0, 1, 0, 0)
    _WaterOpt ("Water (fallback depth, printed, clarity, sparkle; x 0: the old water)", Vector) = (0, 0, 1, 1)
    _WaterBed ("Water's bed colour", Vector) = (0.9, 0.86, 0.7, 1)
    _Bed ("Bed heights (three-space map, R: height)", 2D) = "black" {}
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
    float4 _Metal; float4 _BrushAxis;
    float3 _SkyTop, _SkyHorizon;   // (the composite's: what the metals see)
    float3 _EnvGround;             // what lies below the horizon here (materials.js uEnvGround: the world's ground)
    float4 _WaterOpt, _WaterBed;
    float4 _BedBox;                // x0, z0 (three space), 1 / width, 1 / depth: where the bed map lies (Waters.cs bakes it)
    float4 _BedRef;                // x: the height the map is measured from, y: 1 once baked
    TEXTURE2D(_Bed); SAMPLER(sampler_Bed);
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
      uint iid : SV_InstanceID;  // the crowd's instanced figures (MEMENTO_CROWD)
    };

    // the flora's plants (WorldDetail.cs, flora.js): each instance three rows of a 3x4 matrix (Unity's frame) and a tint
    struct FloraInst { float4 r0, r1, r2, col; };
    StructuredBuffer<FloraInst> _Flora;

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
    // a plant placed by its instance, as the export merged it before (statics.mjs append): the world position,
    // the sway anchored at the plant's origin (its bend by height, its lean), the normal by the inverse transpose
    void floraPlace(FloraInst fi, float3 q, float3 n, out float3 world, out float3 swayed, out float3 nW)
    {
      float3 c0 = float3(fi.r0.x, fi.r1.x, fi.r2.x), c1 = float3(fi.r0.y, fi.r1.y, fi.r2.y), c2 = float3(fi.r0.z, fi.r1.z, fi.r2.z);
      float det = dot(c0, cross(c1, c2));
      float s = pow(max(abs(det), 1e-12), 1.0 / 3.0);
      world = float3(dot(fi.r0.xyz, q) + fi.r0.w, dot(fi.r1.xyz, q) + fi.r1.w, dot(fi.r2.xyz, q) + fi.r2.w);
      float y = max(q.y, 0.0);
      float4 sw = float4(fi.r0.w, fi.r2.w, _Sway * y * y / s, 0.45 * min(y * s, 1.4) / s);
      swayed = world + swayOffset(sw);
      nW = normalize((cross(c1, c2) * n.x + cross(c2, c0) * n.y + cross(c0, c1) * n.z) * sign(det));
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
      #pragma multi_compile_local _ MEMENTO_CROWD MEMENTO_PUFFS MEMENTO_INSTMAT MEMENTO_GRASS MEMENTO_FLORA
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
      #include "Crowd.hlsl"
      // the sun's shadow maps (MementoShadows.cs, materials.js getShadow): fine, near, far; each its matrix
      // into [0, 1] texture space, its bias (depth units), normal offset (m), texel (m), on; 4 or 9 taps
      TEXTURE2D_SHADOW(_MShadowMap0); TEXTURE2D_SHADOW(_MShadowMap1); TEXTURE2D_SHADOW(_MShadowMap2);
      float4x4 _MShadowMat0, _MShadowMat1, _MShadowMat2;
      float4 _MShadowParams0, _MShadowParams1, _MShadowParams2, _MShadowSize;
      float _MShadowTaps, _MShadowOn;
      // sampleShadow: the point pushed out along the normal (more towards grazing light), faded out at the map's
      // edges; where a texel is smaller than the pixel the taps spread to the pixel's footprint
      float mSampleShadow(TEXTURE2D_SHADOW_PARAM(map, smp), float4x4 m, float4 prm, float inv, float3 wp, float3 nU, float sinL, float spread, out float inside)
      {
        inside = 0.0;
        if (prm.w <= 0.0) return 1.0;
        float3 p = mul(m, float4(wp + nU * (prm.y * (0.35 + 0.65 * sinL)), 1.0)).xyz;
        float2 e = smoothstep(0.0, 0.06, p.xy) * (1.0 - smoothstep(0.94, 1.0, p.xy));
        #if UNITY_REVERSED_Z
          inside = p.z < 0.0 ? 0.0 : e.x * e.y;
          float z = p.z + prm.x;
        #else
          inside = p.z > 1.0 ? 0.0 : e.x * e.y;
          float z = p.z - prm.x;
        #endif
        if (inside <= 0.0) return 1.0;
        float2 tx = spread * inv;
        if (_MShadowTaps < 5.0) {
          float2 o = tx * 0.5;
          return 0.25 * (SAMPLE_TEXTURE2D_SHADOW(map, smp, float3(p.xy + float2(-o.x, -o.y), z)) + SAMPLE_TEXTURE2D_SHADOW(map, smp, float3(p.xy + float2(o.x, -o.y), z))
                       + SAMPLE_TEXTURE2D_SHADOW(map, smp, float3(p.xy + float2(-o.x, o.y), z)) + SAMPLE_TEXTURE2D_SHADOW(map, smp, float3(p.xy + float2(o.x, o.y), z)));
        }
        float sum = 0.0;
        UNITY_UNROLL for (int x = -1; x <= 1; x++)
          UNITY_UNROLL for (int y = -1; y <= 1; y++)
            sum += SAMPLE_TEXTURE2D_SHADOW(map, smp, float3(p.xy + float2(x, y) * tx, z));
        return sum / 9.0;
      }
      // ndl: light facing (> 0); px: the pixel's footprint in metres; wp, nU in Unity space
      float getShadow(float3 wp, float3 nU, float ndl, float px)
      {
        if (_MShadowOn <= 0.0) return 1.0;
        float iF, i0, i1;
        float sinL = sqrt(max(1.0 - ndl * ndl, 0.0));
        float3 spread = clamp(px / max(float3(_MShadowParams0.z, _MShadowParams1.z, _MShadowParams2.z), 1e-6), 1.0, 2.5);
        float sF = mSampleShadow(TEXTURE2D_SHADOW_ARGS(_MShadowMap0, sampler_LinearClampCompare), _MShadowMat0, _MShadowParams0, _MShadowSize.x, wp, nU, sinL, spread.x, iF);
        if (iF >= 1.0) return sF;
        float s0 = mSampleShadow(TEXTURE2D_SHADOW_ARGS(_MShadowMap1, sampler_LinearClampCompare), _MShadowMat1, _MShadowParams1, _MShadowSize.y, wp, nU, sinL, spread.y, i0);
        if (i0 < 1.0) {
          float s1 = mSampleShadow(TEXTURE2D_SHADOW_ARGS(_MShadowMap2, sampler_LinearClampCompare), _MShadowMat2, _MShadowParams2, _MShadowSize.z, wp, nU, sinL, spread.z, i1);
          s0 = lerp(lerp(1.0, s1, i1), s0, i0);
        }
        return lerp(s0, sF, iF);
      }
      // instanced puffs (smoke, embers, dust, footprints: Puffs.cs): where, how big, which way, what colour
      struct PuffInst { float4 at; float4 size; float4 col; };   // at.w yaw, size.w pitch, col.w roll (rad, Unity)
      StructuredBuffer<PuffInst> _Puffs;
      float4 _FarDepth;
      // instanced parts with a whole transform each (the wildlife: InstMats in Puffs.cs): three rows of a 3x4 matrix and a tint
      struct MatInst { float4 r0, r1, r2, col; };
      StructuredBuffer<MatInst> _Mats;   // x: from this view depth on, y: the depth grows this much slower (smoke-column far shading); 0 off
      // the grass tufts round the camera (Grass.cs, flora-grass.js): root xyz (Unity), height; turn, tint, lean, rank
      struct GrassInst { float4 at; float4 b; };
      StructuredBuffer<GrassInst> _GrassInst;
      float4 _GrassView;   // camera x, z (three space), the fade's start and end (m)
      float3 rotXYZ(float3 v, float3 e)
      {
        float cx = cos(e.x), sx = sin(e.x), cy = cos(e.y), sy = sin(e.y), cz = cos(e.z), sz = sin(e.z);
        v = float3(cz * v.x - sz * v.y, sz * v.x + cz * v.y, v.z);       // roll
        v = float3(v.x, cx * v.y - sx * v.z, sx * v.y + cx * v.z);       // pitch
        return float3(cy * v.x + sy * v.z, v.y, -sy * v.x + cy * v.z);  // yaw
      }

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
        float4 crowdTrim : TEXCOORD10;  // the crowd figures: the tunic's printed pattern (accent, id)
        nointerpolation float grassSoft : TEXCOORD11;   // a grass blade's soft ink
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
        o.crowdTrim = 0;
        #if defined(MEMENTO_CROWD)
          // an instanced crowd figure (crowd-shader.js): posed in figure space (three's), then mirrored and placed
          CrowdInst ci = _CrowdInst[v.iid];
          float3 cp = v.positionOS.xyz, cn = v.normalOS, ccol; float4 ctrim;
          crowdAnimate(ci, v.sway, cp, cn, ccol, ctrim);
          float cs = ci.scale.x, cc = cos(ci.at.w), sn = sin(ci.at.w);
          float3 pu = toThree(cp) * cs, nu = toThree(cn);
          posWS = ci.at.xyz + float3(cc * pu.x + sn * pu.z, pu.y, -sn * pu.x + cc * pu.z);
          nWS = normalize(float3(cc * nu.x + sn * nu.z, nu.y, -sn * nu.x + cc * nu.z));
          o.positionCS = TransformWorldToHClip(posWS);
          o.posWS = posWS;
          o.worldPos = toThree(posWS);
          o.normal = toThree(nWS);
          o.instColor = ccol;
          o.viewDepth = -TransformWorldToView(posWS).z;
          o.objPos = cp * cs; o.objNormal = cn / cs; o.objRel = o.objPos - toThree(_WorldSpaceCameraPos);
          o.bind = v.positionOS.xyz;
          o.crowdTrim = ctrim;
        #endif
        o.grassSoft = 0;
        #if defined(MEMENTO_GRASS)
          // a tuft of blades (grass-shader.js grassPlace), all in three space: thinned and sunk with distance, bent by the
          // wind and parted round the traveller's feet, the tip lowered so the blade keeps its length
          GrassInst gi = _GrassInst[v.iid];
          float3 root = toThree(gi.at.xyz);
          float gd = length(root.xz - _GrassView.xy);
          float keepG = step(gi.b.w, lerp(1.0, 0.3, smoothstep(_GrassView.z * 0.5, _GrassView.w, gd)));
          float gfade = (1.0 - smoothstep(_GrassView.z, _GrassView.w, gd)) * keepG;
          float gh = gi.at.w * gfade;
          float3 gp = v.positionOS.xyz;
          float gt = gp.y;
          float gc = cos(gi.b.x), gs = sin(gi.b.x);
          float2 gxz = float2(gc * gp.x + gs * gp.z, -gs * gp.x + gc * gp.z);
          float2 wd = _Wind.xy; float str = _Wind.z;
          float wave = 0.5 + 0.5 * sin(_MTime * 1.7 - dot(root.xz, wd) * 0.09);
          float push = str * (0.35 + 0.65 * _Wind.w * wave);
          float flutter = (0.4 + 0.6 * str) * sin(_MTime * (2.3 + 1.1 * str) + root.x * 0.53 + root.z * 0.31 + gi.b.w * 6.28);
          float2 bend = wd * (push * 0.32 + flutter * 0.1) + float2(gc, gs) * gi.b.z;
          float2 away = root.xz - _Brush.xz; float dB = length(away);
          float brush = (1.0 - smoothstep(0.2, 1.0, dB)) * (0.9 + 0.12 * min(_Brush.w, 5.0));
          bend += (dB > 1e-3 ? away / dB : float2(0, 0)) * brush * 1.3;
          float bl = length(bend);
          float2 off = bend * gt * gt * gh;
          float rise = gt * gh / sqrt(1.0 + bl * bl * gt * gt);
          float3 wpT = float3(root.x + gxz.x + off.x, root.y - 0.04 + rise, root.z + gxz.y + off.y);
          float3 gn = normalize(float3(bend.x * 0.25, 1.0, bend.y * 0.25));
          posWS = toThree(wpT); nWS = toThree(gn);
          o.positionCS = TransformWorldToHClip(posWS);
          o.posWS = posWS; o.worldPos = wpT; o.normal = gn;
          o.instColor = lerp(float3(1, 1, 1), _Color2.rgb / max(_Color.rgb, 0.02), gi.b.y) * lerp(0.8, 1.06, frac(gi.b.w * 13.7)) * lerp(0.94, 1.08, gt);
          o.viewDepth = -TransformWorldToView(posWS).z;
          o.objPos = wpT; o.objNormal = gn; o.objRel = wpT - toThree(_WorldSpaceCameraPos);
          o.bind = 0;
          o.grassSoft = step(0.12, frac(gi.b.w * 7.31));
        #endif
        #if defined(MEMENTO_PUFFS)
          PuffInst pi = _Puffs[v.iid];
          float3 e3 = float3(pi.size.w, pi.at.w, pi.col.w);
          float3 lp = v.positionOS.xyz * pi.size.xyz;
          posWS = pi.at.xyz + rotXYZ(lp, e3);
          nWS = normalize(rotXYZ(v.normalOS / max(pi.size.xyz, 1e-4), e3));
          o.positionCS = TransformWorldToHClip(posWS);
          o.posWS = posWS; o.worldPos = toThree(posWS); o.normal = toThree(nWS);
          o.instColor = pi.col.rgb * v.color.rgb;
          o.viewDepth = -TransformWorldToView(posWS).z;
          o.objPos = toThree(lp); o.objNormal = toThree(v.normalOS); o.objRel = o.objPos - toThree(_WorldSpaceCameraPos - pi.at.xyz);
          o.bind = 0;
        #endif
        #if defined(MEMENTO_INSTMAT)
          MatInst mi = _Mats[v.iid];
          float3 q = v.positionOS.xyz;
          posWS = float3(dot(mi.r0.xyz, q) + mi.r0.w, dot(mi.r1.xyz, q) + mi.r1.w, dot(mi.r2.xyz, q) + mi.r2.w);
          nWS = normalize(float3(dot(mi.r0.xyz, v.normalOS), dot(mi.r1.xyz, v.normalOS), dot(mi.r2.xyz, v.normalOS)));
          o.positionCS = TransformWorldToHClip(posWS);
          o.posWS = posWS; o.worldPos = toThree(posWS); o.normal = toThree(nWS);
          o.instColor = mi.col.rgb * v.color.rgb;
          o.viewDepth = -TransformWorldToView(posWS).z;
          float ms = length(mi.r0.xyz);
          o.objPos = toThree(q * ms); o.objNormal = toThree(v.normalOS); o.objRel = o.objPos - toThree((_WorldSpaceCameraPos - float3(mi.r0.w, mi.r1.w, mi.r2.w)));
          o.bind = 0;
        #endif
        #if defined(MEMENTO_FLORA)
          {
            float3 fw, fs, fn;
            floraPlace(_Flora[v.iid], v.positionOS.xyz, v.normalOS, fw, fs, fn);
            posWS = fs; nWS = fn;
            o.positionCS = TransformWorldToHClip(posWS);
            o.posWS = posWS; o.worldPos = toThree(posWS); o.normal = toThree(nWS);
            o.instColor = (_NoVertexColor > 0.5 ? float3(1, 1, 1) : v.color.rgb) * _Flora[v.iid].col.rgb;
            o.viewDepth = -TransformWorldToView(posWS).z;
            // (patterns anchored in the world, as on the merged chunks the flora was drawn as)
            o.objPos = toThree(fw); o.objNormal = toThree(fn); o.objRel = o.objPos - toThree(_WorldSpaceCameraPos);
            o.bind = 0;
          }
        #endif
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

      float lum3(float3 c) { return dot(c, float3(0.3, 0.55, 0.15)); }
      // the metals (materials.js METAL_GLSL): flat tones of what the reflection sees (the sky, the bright horizon,
      // the ground), chrome's dark band under the horizon, brushed streaks along an axis, one crisp sun highlight
      float3 metalAlbedo(float3 base, float3 n, float sunLit, float3 wp, float3 objPos, float3 objN, float3 metalT, out float ink)
      {
        ink = 0.0;
        float3 V = normalize(toThree(_WorldSpaceCameraPos) - wp);
        float3 R = reflect(-V, n);
        float kind = _Metal.x, refl = _Metal.z;
        float ry = R.y + (vnoise(R.xz * 2.6 + float2(kind * 3.1, kind * 3.1)) - 0.5) * 0.09;
        float fy = max(fwidth(ry), 1e-4) * 0.75;
        float up = smoothstep(0.32 - fy, 0.32 + fy, ry);
        float down = 1.0 - smoothstep(-0.04 - fy, -0.04 + fy, ry);
        float3 skyC = lerp(_SkyHorizon, _SkyTop, 0.85);
        float3 env = lerp(lerp(_SkyHorizon, skyC, up), _EnvGround, down);
        float3 c;
        if (kind > 1.5 && kind < 2.5) {
          float band = down * smoothstep(-0.24 - fy, -0.24 + fy, ry);
          env = lerp(env, _EnvGround * 0.78, down);
          env = lerp(env, lerp(_EnvGround, float3(0.16, 0.15, 0.21), 0.72), band);
          c = lerp(base, env * lerp(float3(1, 1, 1), base / max(lum3(base), 0.05), 0.12), refl);
        } else {
          bool warm = kind > 2.5 && kind < 4.5;
          float m = lerp(lerp(warm ? 1.3 : 1.22, warm ? 1.08 : 1.04, up), warm ? 0.66 : 0.74, down);
          float3 tone = base * m;
          float3 seen = env * lum3(base) / max(lum3(env), 0.05) * m;
          c = lerp(base, lerp(tone, seen, warm ? 0.14 : 0.42), refl);
        }
        float brushed = _Metal.y;
        float3 Bo = cross(_BrushAxis.xyz, normalize(objN));
        float u = dot(objPos, normalize(Bo + 1e-5)) * 70.0, along = dot(objPos, _BrushAxis.xyz);
        float fu = max(fwidth(u), 1e-4);
        float st = vnoise(float2(u, along * 3.0)) * 0.6 + vnoise(float2(u * 0.31 + 5.0, along * 0.8)) * 0.4;
        c *= 1.0 + (st - 0.5) * 0.16 * brushed * (1.0 - smoothstep(0.3, 0.9, fu));
        float k = u / 9.0, id = floor(k + 0.5);
        float hair = inkLine(abs(k - id) / max(fu / 9.0, 1e-5), 0.6) * step(0.82, hash(float2(id, 3.3)))
                   * smoothstep(0.35, 0.6, vnoise(float2(id * 1.7, along * 2.5))) * (1.0 - smoothstep(0.06, 0.16, fu / 9.0));
        ink = hair * 0.3 * brushed;
        float s = dot(R, _SunDir), c0 = cos(_Metal.w);
        float fs = max(fwidth(s), 1e-4);
        float spot = smoothstep(c0 - fs, c0 + fs, s);
        float c1 = cos(_Metal.w * 2.3), sheen = smoothstep(c1 - fs, c1 + fs, s) * (1.0 - brushed) * sunLit;
        float3 H = normalize(_SunDir + V);
        float th = dot(metalT, H), fth = max(fwidth(th), 1e-4), wb = _Metal.w * 0.45;
        float streak = (1.0 - smoothstep(wb - fth, wb + fth, abs(th))) * smoothstep(0.25, 0.4, dot(n, H));
        float hl = lerp(spot, streak, brushed) * sunLit;
        float3 hc = lerp(float3(1.0, 0.99, 0.95), base, kind > 2.5 && kind < 4.5 ? 0.22 : 0.06);
        c = lerp(c, lerp(c, hc, 0.38), sheen);
        return lerp(c, hc, hl);
      }

      // the water's look (water-shader.js waterLook): depth bands from the baked bed (pale shallows, the water, deep),
      // the bed through the shallows with caustics, the sky's colours at grazing angles in two steps, a pale foam band
      // where it meets the shore and a lapping line off it, inked wave crests drifting downwind
      float waterDepth(float3 p, out float known)
      {
        float2 uv = (p.xz - _BedBox.xy) * _BedBox.zw;
        float2 e = smoothstep(0.0, 0.03, uv) * (1.0 - smoothstep(0.97, 1.0, uv));
        known = _BedRef.y * e.x * e.y;
        float bed = SAMPLE_TEXTURE2D_LOD(_Bed, sampler_Bed, saturate(uv), 0).r + _BedRef.x;
        return lerp(_WaterOpt.x, p.y - bed, known);
      }
      float waveInk(float2 p, float t, float str, float2 wd, float scale, float seed)
      {
        float2 q = float2(dot(p, wd), dot(p, float2(-wd.y, wd.x))) / scale;
        float warp = vnoise(q * float2(0.09, 0.05) + seed + t * 0.02) * 3.0 + vnoise(q * 0.31 - t * 0.05) * 0.6;
        float v = q.x * 0.5 - t * (0.18 + 0.12 * str) / scale + warp;
        float fw = max(fwidth(v), 1e-5);
        float d = abs(frac(v + 0.5) - 0.5) / fw;
        float lane = floor(v + 0.5);
        float dash = smoothstep(0.6, 0.66, vnoise(float2(q.y * 1.3, lane * 3.7 + seed) + float2(t * 0.05, 0.0)) + 0.08 * min(str, 2.0));
        return inkLine(d, 0.95) * dash * (1.0 - smoothstep(0.12, 0.3, fw));
      }
      float3 waterLook(float3 p, bool front, out float ink, out float lit)
      {
        float t = _MTime;
        float2 wd = length(_Wind.xy) > 1e-4 ? normalize(_Wind.xy) : float2(1, 0);
        float str = clamp(_Wind.z, 0.15, 3.0);
        float known;
        float depth = waterDepth(p, known);
        float px = max(length(ddx(p.xz)), length(ddy(p.xz)));
        float fd = max(fwidth(depth), 1e-4);
        float wob = (vnoise(p.xz * 0.35 + t * float2(0.21, 0.13) * (0.5 + str * 0.3)) - 0.5) * 0.22;
        float dB = depth + wob * known;
        float3 V = normalize(toThree(_WorldSpaceCameraPos) - p);
        float3 shallow = _Color2.rgb, mid = _Color.rgb;
        float3 deep = mid * float3(0.78, 0.86, 0.9) + float3(0.0, 0.0, 0.03);
        float clarity = _WaterOpt.z;
        ink = waveInk(p.xz, t, str, wd, 1.0, 0.0);
        ink = max(ink, waveInk(p.xz, t, str, wd, 3.2, 17.0) * 0.7);
        ink *= 0.75;
        lit = 0;
        if (!front) { ink *= 0.75; lit = 1; return lerp(shallow, float3(0.96, 0.98, 0.97), 0.45); }
        if (_WaterOpt.y > 0.5) { ink *= 0.6; return _Color.rgb; }
        float3 col = dB < 1.15 ? shallow : (dB < 3.4 ? mid : deep);
        if (dB < 0.42 * clarity && known > 0.5) col = lerp(shallow, _WaterBed.rgb, 0.5);
        float causK = (1.0 - smoothstep(0.15, 0.7, dB)) * known * (1.0 - smoothstep(0.012, 0.03, px)) * clarity;
        UNITY_BRANCH if (causK > 0.0)
        {
          float cv = voronoiBorder(p.xz * 1.6 + float2(sin(t * 0.7 + p.z * 0.9), cos(t * 0.6 + p.x * 0.8)) * 0.3);
          ink = max(ink, inkLine(cv / max(px * 1.6, 1e-4), 0.7) * causK * 0.3);
        }
        float fres = pow(1.0 - saturate(V.y), 4.0);
        float sk = fres + (vnoise(p.xz * 0.05 + t * 0.03) - 0.5) * 0.12;
        float3 skyC = lerp(_SkyHorizon, _SkyTop, smoothstep(0.0, 0.5, V.y));
        float steps = sk > 0.62 ? 0.62 : (sk > 0.36 ? 0.3 : 0.0);
        col = lerp(col, lerp(col, skyC, 0.85), steps);
        float slopeW = max(fd / max(px, 1e-4), 0.004);
        float shore = depth / slopeW;
        float foamM = 0.28 + 0.1 * sin(t * 0.9 + p.x * 0.7 + p.z * 0.4);
        float foam = (1.0 - smoothstep(foamM, foamM + px * 1.2, shore)) * step(-0.05, depth) * known;
        foam = max(foam, (1.0 - smoothstep(1.3 * fd, 2.3 * fd, depth)) * known);
        float lap = 0.0;
        UNITY_BRANCH if (shore < 1.6 && known > 0.0 && px < 0.2)
        {
          float lapAt = 0.95 + 0.35 * sin(t * 1.15 + vnoise(p.xz * 0.25) * 6.2832);
          lap = inkLine(abs(shore - lapAt) / max(px, 1e-4), 0.9) * step(0.42, vnoise(p.xz * 0.8 + 3.0 + t * 0.1)) * known * (1.0 - smoothstep(0.06, 0.2, px));
        }
        ink = max(ink * (1.0 - foam), lap * 0.85);
        col = lerp(col, lerp(float3(0.97, 0.98, 0.95), shallow, 0.18), foam);
        lit = foam * 0.6;
        return col;
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
        // a makers' box coming apart (boxes/scene.js): eaten from the top down, the edge burning bright
        float dEdge = 0.0;
        if (_Dissolve.x > 0.0)
        {
          float dh = saturate((i.worldPos.y - _Dissolve.z) / max(_Dissolve.w - _Dissolve.z, 1e-3));
          float dn = vnoise(i.worldPos.xz * 6.0 + i.worldPos.y * 2.3) * 0.42 + vnoise(i.worldPos.zy * 15.0 + 3.1) * 0.18 + (1.0 - dh) * 0.4;
          float dth = _Dissolve.x * 1.15 - 0.08;
          if (dn < dth) discard;
          dEdge = 1.0 - smoothstep(0.0, _Dissolve.y, dn - dth);
        }
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
        }
        #if !defined(MEMENTO_GRASS)
        else if (!frontFace && (_Bind > 0.5 || (_Figure < 0.5 && _Hero < 0.5))) n = -n;
        #endif   // (glTFast's skinned bodies read as back faces; the exported people do not)

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
        } else if (mode == MODE_WATER && _WaterOpt.x <= 0.0) {
          float w = vnoise(i.worldPos.xz * 0.012 + _MTime * 0.01);
          albedo = w > 0.55 ? _Color2.rgb : _Color.rgb;
        }
        float waterInk = 0.0, waterLit = 0.0;
        UNITY_BRANCH if (mode == MODE_WATER && _WaterOpt.x > 0.0) albedo = waterLook(i.worldPos, frontFace, waterInk, waterLit); else if (mode == MODE_OUTFIT) {
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
        if (_Fluid > 0.5) albedo = fluidAlbedo(albedo, i.bind, i.fold);
        albedo *= instColor;
        if (i.crowdTrim.w > 0.5) albedo = outfitTrim(albedo, i.crowdTrim.rgb, i.crowdTrim.w, i.bind);
        if (_Folds > 0.0) albedo = (i.fold.y < 0.62 ? _Color.rgb : _Color2.rgb) * i.instColor;

        float ndl = dot(n, _SunDir);
        float lambert = ndl * 0.5 + 0.5;
        float sh = 1.0;
        float shadowPx = max(length(ddx(i.posWS)), length(ddy(i.posWS)));   // (outside the branch: derivatives)
        if (ndl > 0.0) sh = getShadow(i.posWS, toThree(n), ndl, shadowPx) * cloudShadow(i.worldPos);
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
        if (mode == MODE_WATER && _WaterOpt.x > 0.0) L = lerp(L, max(L, 0.8), waterLit);
        float metalInk = 0.0;
        UNITY_BRANCH if (_Metal.w > 0.0)
        {
          float3 metalT = normalize(toThree(TransformObjectToWorldDir(toThree(_BrushAxis.xyz))));
          albedo = metalAlbedo(albedo, n, ndl > 0.0 ? smoothstep(0.4, 0.6, sh) : 0.0, i.worldPos, i.objPos, i.objNormal, metalT, metalInk);
        }

        albedo = lerp(albedo, _DissolveColor.rgb, dEdge);
        L = lerp(L, 1.0, dEdge);
        GBufferOut o;
        o.albedoLight = float4(albedo, L);
        o.normalDepth = float4(n, _FarDepth.x > 0 && i.viewDepth > _FarDepth.x ? _FarDepth.x + (i.viewDepth - _FarDepth.x) * _FarDepth.y : i.viewDepth);
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
          detail = max(detail, _WaterOpt.x > 0.0 ? waterInk : waterLines(gp, _MTime) * 0.7);
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
        detail = max(detail, metalInk);
        o.hatch.b = detail;
        o.hatch.a = max(max(_Glow, smoothstep(0.15, 0.6, local) * 0.6), dEdge) + 2.0 * _Hero + 4.0 * _Figure;
        #if defined(MEMENTO_GRASS)
          o.hatch.rgb = 0; o.hatch.a += 8.0 * i.grassSoft;   // blades: no hatching, no drawn detail; soft ink
          return o;
        #endif

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
      #pragma multi_compile_local _ MEMENTO_CROWD MEMENTO_FLORA
      #pragma target 4.5
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
      #include "Crowd.hlsl"
      float3 _LightDirection;
      float3 _LightPosition;
      float4 shadowVert(Attributes v) : SV_POSITION
      {
        float3 posWS = TransformObjectToWorld(v.positionOS.xyz) + swayOffset(v.sway);
        float3 nWS = TransformObjectToWorldNormal(v.normalOS);
        #if defined(MEMENTO_CROWD)
          // the crowd's mid-distance figures cast their shadows too, posed as in the G-buffer pass
          CrowdInst ci = _CrowdInst[v.iid];
          float3 cp = v.positionOS.xyz, cn = v.normalOS, ccol; float4 ctrim;
          crowdAnimate(ci, v.sway, cp, cn, ccol, ctrim);
          float cs = ci.scale.x, cc = cos(ci.at.w), sn = sin(ci.at.w);
          float3 pu = toThree(cp) * cs, nu = toThree(cn);
          posWS = ci.at.xyz + float3(cc * pu.x + sn * pu.z, pu.y, -sn * pu.x + cc * pu.z);
          nWS = normalize(float3(cc * nu.x + sn * nu.z, nu.y, -sn * nu.x + cc * nu.z));
        #endif
        #if defined(MEMENTO_FLORA)
          { float3 fw, fs, fn; floraPlace(_Flora[v.iid], v.positionOS.xyz, v.normalOS, fw, fs, fn); posWS = fs; nWS = fn; }
        #endif
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
