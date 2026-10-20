// Hiraeth surface: the port of the web game's one G-buffer material (src/materials.js).
// It does no stylisation. It writes the ingredients the ink composite needs:
//   SV_Target0  rgb = flat albedo (sand patches, strata, façades…), a = light term (half-lambert x cast shadow)
//   SV_Target1  rgb = world normal (three space), a = linear view depth (0 = sky)
//   SV_Target2  r = single hatch / stipple, g = cross hatch, b = drawn detail lines, a = glow + 2 hero + 4 figure
// The LightMode "HiraethGBuffer" pass is drawn by HiraethFeature (a URP renderer feature).
Shader "Hiraeth/Surface"
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
    _Room ("A room in a hull: its key's direction (three, object), strength; w 0: not a room", Vector) = (0, 0, 0, 0)
    _WaterOpt ("Water (fallback depth, printed, clarity, sparkle; x 0: the old water)", Vector) = (0, 0, 1, 1)
    _WaterBed ("Water's bed colour", Vector) = (0.9, 0.86, 0.7, 1)
    _Bed ("Bed heights (three-space map, R: height)", 2D) = "black" {}
    _Weather ("Weathered (0..1)", Float) = 0
    _Detail ("Pen detail (kind, density)", Vector) = (0, 0, 0, 0)
    _Patch ("Colour across a wall", Float) = 0
    _Map ("A picture over the colour (the game's canvas: BridgeRenderer.Texture)", 2D) = "white" {}
    _MapOn ("Has a picture", Float) = 0
    _Plates ("Plating", Float) = 0
    _Windows ("Window share", Float) = 0.78
    _Drift ("Banked sand", Float) = 0
    _Shade ("Shade (lift, hue, hatch, strata strokes)", Vector) = (0, -1, 1, 0)
    _SpotStep ("Spot step", Float) = 0
    _LineStep ("Line step", Float) = 0
    _ToDisplay ("Linear colours to display values", Float) = 0
    _FormOn ("Hatching that follows the form", Float) = 0
    _Veins ("A dark cap's veins", Float) = 0
    _Lining ("Back faces' colour (rgb, a 1: on)", Vector) = (0, 0, 0, 0)
    _BoxOn ("A makers' box", Float) = 0
    _TripoFace ("The coral-shirt traveller's drawn face (2: the portrait head's, PortraitFace.hlsl)", Float) = 0
    // (issue #264, surfaces D: the portrait head's fit, mouth and blink; the hatch's least spacing; the traveller cut; a white line)
    _PhFit ("Portrait head: offset, scale", Vector) = (0, 0, 0, 1)
    _PhFit2 ("Portrait head: the mouth's height", Vector) = (0, 0, 0, 0)
    _PhSpeech ("Portrait head: mouth (live)", Vector) = (0, 0, 0, 0)
    _PhBlink ("Portrait head: blink (live)", Vector) = (0, 0, 0, 0)
    _PhEyeBox ("Portrait head: the eye paint's box (x0, y0, x1, y1; 0: none)", Vector) = (0, 0, 0, 0)
    _PhEye ("Portrait head: the iris's offset with his look (live)", Vector) = (0, 0, 0, 0)
    _EyePaint ("Portrait head: his painted eyes and brows (eye-paint.png)", 2D) = "black" {}
    _SurfD ("Hatch least spacing (px), plant height, large plant, mover", Vector) = (0, 0, 0, 0)
    _CutMe ("The traveller's own: cut while the lens is in him (live)", Vector) = (0, 0, 0, 0)
    _LineWhite ("Its lines drawn white (live)", Vector) = (0, 0, 0, 0)
    _ThinPx ("Thin bars kept this many pixels wide (materials.js S_THIN; their axis points in the form's slot)", Float) = 0
    _ShellCenter ("A temple landmark's shell: its centre (three, world); w 1 on (landmark-materials.js nacre)", Vector) = (0, 0, 0, 0)
    _Stone ("A temple landmark's cut stone: course, block width (m), wear; w 1 on (landmark-materials.js stone)", Vector) = (0, 0, 0, 0)
    _VGlyph ("A merged mesh's glyph cells per vertex, the grid's (materials.js S_VGLYPH: the banners)", Float) = 0
    _LineFar ("A lighter line from afar: its step, from, to (m); w 1 on (materials.js LINE_FAR)", Vector) = (0, 0, 0, 0)
    _BoxA ("Box: ray, glow, star reach, clock", Vector) = (0.6, 0.35, 0.4, 0)
    _BoxB ("Box: half size, centre height", Vector) = (0.5, 0.5, 0.5, 0.5)
    _BoxMark ("Box: the marks", Vector) = (0.86, 0.93, 0.95, 1)
    _BoxLight ("Box: the ray", Vector) = (1, 0.98, 0.92, 1)
    _SkinBody ("A temple skin's pattern (SkinPatterns.hlsl; 0 none)", Float) = 0
    _NightOn ("Night paint in the form's slot (NIGHT_PAINT)", Float) = 0
    _SplatOn ("A splat of the fluid (splat-decal.js)", Float) = 0
    _OffsetFactor ("Polygon offset, factor (three's polygonOffset: the splats, issue #459)", Float) = 0
    _OffsetUnits ("Polygon offset, units", Float) = 0
    _Breathe ("The Buried Machine's clock (BridgeRenderer.Breathe)", Vector) = (0, 1000000000, 0, 0)
    _MirrorOn ("A reflection in still water (MIRROR)", Float) = 0
    _VeinOn ("Lorn's veins under the water (WATER_VEINS)", Float) = 0
    _Mirror ("Mirror: the water's height, lift, reach, shimmer", Vector) = (0, 0, 500, 1)
    _MirrorLake ("Mirror: the lake's ellipse (x, z, rx, rz)", Vector) = (0, 0, 100000, 100000)
    _VeinBox ("Veins: the map's x0, z0, 1 / width, 1 / depth", Vector) = (0, 0, 0, 0)
    _SplatClock ("A splat's clock (x)", Vector) = (0, 0, 0, 0)
    _VeinMap ("Lorn's vein map (lorn-veins.js)", 2D) = "black" {}
    _FoeBits ("A foe's painted features (FoeSurface.hlsl, HIRAETH_FIGHT; 0 none)", Float) = 0
    _BladeOn ("The fluid sword's blade (1) or the shield (2) (BladeSurface.hlsl, HIRAETH_FIGHT; 0 none)", Float) = 0
    _CrystalOn ("The chimes' crystal (CrystalSurface.hlsl, HIRAETH_FIGHT)", Float) = 0
    _Blade ("Blade: smear, energy, breath, lite", Vector) = (0, 1, 0, 0)
    _BladeB ("Blade: the lag (x, z), the ripple's age, where it started", Vector) = (0, 0, 99, 0.75)
    _BladeC ("Blade: the ripple's strength, its gold, the flash, the pen's share", Vector) = (0, 0, 0, 0.5)
    _SeeOn ("Opens round the traveller when it hides him (materials.js SEE_HOLE)", Float) = 0
    _See ("The hole's point (three, world) and radius there (m)", Vector) = (0, -10000, 0, 3.4)
    _SeeK ("This one's share of the hole (x: 0 solid .. 1 open)", Vector) = (0, 0, 0, 0)
    _LampTint ("A lamp's own colour in its pool (rgb, a its share; materials.js LAMP_TINT)", Vector) = (0, 0, 0, 0)
    // (every other value of UnityPerMaterial, 0 unless a material sets it: each material its own, as the SRP Batcher wants
    // them. The arrays (_Palette, _Limbs, _FluidTones) go by a value here.)
    _NoVertexColor ("NoVertexColor", Float) = 0
    _Bind ("Bind", Float) = 0
    _Cracks ("Cracks", Float) = 0
    _Creases ("Creases", Float) = 0
    _Glass ("Glass", Float) = 0
    _Veil ("Veil (see-through but for its rim: |n·v| over it discarded)", Float) = 0
    _Fluid ("Fluid", Float) = 0
    _CrowdTime ("CrowdTime", Float) = 0
    _GrassMirrored ("GrassMirrored", Float) = 0
    _BedBox ("BedBox", Vector) = (0, 0, 0, 0)
    _BedRef ("BedRef", Vector) = (0, 0, 0, 0)
    _Outfit ("Outfit", Vector) = (0, 0, 0, 0)
    _Skin ("Skin", Vector) = (0, 0, 0, 0)
    _Glove ("Glove", Vector) = (0, 0, 0, 0)
    _Trim ("Trim", Vector) = (0, 0, 0, 0)
    _Face ("Face", Vector) = (0, 0, 0, 0)
    _Mood ("Mood", Vector) = (0, 0, 0, 0)
    _Mood2 ("Mood2", Vector) = (0, 0, 0, 0)
    _FaceKit ("FaceKit", Vector) = (0, 0, 0, 0)
    _FaceKit2 ("FaceKit2", Vector) = (0, 0, 0, 0)
    _EyeC ("EyeC", Vector) = (0, 0, 0, 0)
    _EyeR ("EyeR", Vector) = (0, 0, 0, 0)
    _EyeLook ("EyeLook", Vector) = (0, 0, 0, 0)
    _GlassCenter ("GlassCenter", Vector) = (0, 0, 0, 0)
    _FluidA ("FluidA", Vector) = (0, 0, 0, 0)
    _FluidB ("FluidB", Vector) = (0, 0, 0, 0)
    _FluidBox ("FluidBox", Vector) = (0, 0, 0, 0)
    _FluidBase ("FluidBase", Vector) = (0, 0, 0, 0)
    _FluidDome ("FluidDome", Vector) = (0, 0, 0, 0)
    _FluidDomeK ("FluidDomeK", Float) = 1
    _DuneOn ("Dune glass (1) or the sand under it (2)", Float) = 0
    _DuneMint ("DuneMint", Vector) = (0, 0, 0, 0)
    _DuneLime ("DuneLime", Vector) = (0, 0, 0, 0)
    _DuneSil ("DuneSil", Vector) = (0, 0, 0, 0)
    _DuneK ("DuneK", Vector) = (0, 0, 0, 0)
    _FallOn ("A falling sheet of water (waterfall-shader.js FALL)", Float) = 0
    _FallA ("FallA", Vector) = (0, 0, 0, 0)
    _FallB ("FallB", Vector) = (0, 0, 0, 0)
    _Dissolve ("Dissolve", Vector) = (0, 0, 0, 0)
    _DissolveColor ("DissolveColor", Vector) = (0, 0, 0, 0)
    _TfBrowA ("TfBrowA", Vector) = (0, 0, 0, 0)
    _TfBrowB ("TfBrowB", Vector) = (0, 0, 0, 0)
    _TfEye ("TfEye", Vector) = (0, 0, 0, 0)
    _TfMouth ("TfMouth", Vector) = (0, 0, 0, 0)
    _FarDepth ("FarDepth", Vector) = (0, 0, 0, 0)
    _GrassView ("GrassView", Vector) = (0, 0, 0, 0)
    _GrassLod ("GrassLod", Vector) = (0, 0, 0, 0)
    _GrassLook ("GrassLook", Vector) = (0, 0, 0, 0)
    _Cull ("Cull", Float) = 2
    _Sides ("One cull mode (issue #536, BridgeSided): 0 as the GPU says, 1 back faces only, 2 both faces, 3 both, its normals against the winding", Float) = 0
    _MZTest ("ZTest (4: LEqual; 8: Always, the bridge's -ztest-always test)", Float) = 4
    _ZWrite ("ZWrite (0: the water, drawn last over the scene's depth)", Float) = 1
  }
  SubShader
  {
    Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" }

    HLSLINCLUDE
    // (the bind, fold and form interpolators, read and written through these: the slim lean variants have none, below)
    #define O_BIND o.bind
    #define O_FOLD o.fold
    #define O_FORM o.form
    #define I_BIND i.bind
    #define I_FOLD i.fold
    #define I_FORM i.form
    #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
    #include "HiraethCommon.hlsl"

    // every value a material sets, in one UnityPerMaterial buffer, the same in every pass: what the SRP Batcher needs to
    // draw the scene's ~1 300 renderers on its fast path (Figure.hlsl, Marks.hlsl, TripoFace.hlsl and Crowd.hlsl leave
    // theirs to it: HIRAETH_PER_MATERIAL). The globals (the look's, the light's, the shadow maps') stay outside.
    #define HIRAETH_PER_MATERIAL
    CBUFFER_START(UnityPerMaterial)
    float4 _Color, _Color2, _Color3;
    float _Mode, _Flat, _StrataSize, _Grid, _Glyphs, _Biomes, _Ripples, _SandInk, _Ticks, _Glow, _Folds, _Scrub, _Pattern, _Figure, _Hero, _Sway, _StrataObject, _PaletteSize;
    float4 _Palette[12];
    float _NoVertexColor;
    float4 _Metal; float4 _BrushAxis;
    float4 _Room;          // a room in a hull (materials.js ROOM_LIGHT, the ship's rooms): its key's direction (three, object), w its strength
    float4 _WaterOpt, _WaterBed;
    float4 _BedBox;                // x0, z0 (three space), 1 / width, 1 / depth: where the bed map lies (Waters.cs bakes it)
    float4 _BedRef;                // x: the height the map is measured from, y: 1 once baked, z: 1 the bridge's bytes (engine/water-bed.js)
    float _Drift, _SpotStep, _LineStep, _ToDisplay, _FormOn, _Veins, _BoxOn, _TripoFace;
    float _SkinBody;       // a temple skin's pattern (src/temples/skins/skin-shader.js: its number; its uniforms in _SkinData, HIRAETH_SKIN)
    float _FoeBits;        // a foe's painted features (src/foe-surface.js: FS_* as bits; its uniforms in _SkinData, HIRAETH_FIGHT)
    float _BladeOn;        // the fluid sword's living blade (1) or the guard's shield (2) (src/blade-shader.js, HIRAETH_FIGHT)
    float _CrystalOn;      // the chimes' crystal (src/crystal-shader.js, HIRAETH_FIGHT; its uniforms in _SkinData)
    float4 _Blade, _BladeB, _BladeC;   // its live numbers (blade-shader.js uBlade, uBladeB, uBladeC: LiveVectors)
    float _SeeOn;          // a fight temple's wall or pillar that opens round him when it hides him (materials.js SEE_HOLE)
    float4 _See, _SeeK;    // his chest (three, world) and the hole's radius there; this one's share in x (both live: LiveVectors)
    float4 _LampTint;      // a lamp's pool in its own colour (materials.js LAMP_TINT): rgb, a its share
    float4 _Lining, _BoxA, _BoxB, _BoxMark, _BoxLight;
    float4 _Shade;         // materials.js uShade: lift, hue (-1 the world's; 2 + a flat print), hatch, strata strokes
    float _Bind;           // people (Figures.cs): the rest pose in uv3 / uv4, so their drawing rides on the body
    float _Sides;          // one cull mode (issue #536): the face a two-sided or back-sided material shows, told here (BridgeSided)
    float _Cracks;         // strata rock: dense cracks and strokes down its faces (materials.js uCracks; 0: the sparse fissures only)
    // (Figure.hlsl's: the people's outfit, face, mood, limbs, the flask's fluid, a makers' box dissolving)
    float4 _Outfit, _Skin, _Glove, _Trim, _Face, _Mood, _Mood2, _FaceKit, _FaceKit2, _EyeC, _EyeR, _EyeLook;
    float _Creases;
    float4 _Limbs[16];
    float _Glass;
    float4 _GlassCenter;
    float _Veil;           // see-through but for its rim (materials.js S_VEIL, uVeil): its body is the bridge's Hiraeth/Veil wash
    float _Fluid;
    float4 _FluidA, _FluidB, _FluidBox;
    float4 _FluidTones[6];
    float4 _FluidBase;
    float4 _FluidDome;     // the round backpack's dome (Figure.hlsl flaskNebula)
    float _FluidDomeK;
    float _DuneOn;         // the Glass Dunes (src/dune-glass-shader.js): 1 the glass, 2 the sand its light falls on; aGlass in the form's slot
    float4 _DuneMint, _DuneLime, _DuneSil, _DuneK;
    float4 _Dissolve, _DissolveColor;
    // (Marks.hlsl's: the surface marks)
    float _Weather; float4 _Detail; float _Patch, _Plates, _Windows;
    // (TripoFace.hlsl's: the coral-shirt traveller's drawn face)
    float4 _TfBrowA, _TfBrowB, _TfEye, _TfMouth;
    // (PortraitFace.hlsl's: the traveller's portrait head; and surfaces D's: the hatch's least spacing, the traveller cut, a white line)
    float4 _PhFit, _PhFit2, _PhSpeech, _PhBlink, _SurfD, _CutMe, _LineWhite;
    float4 _ShellCenter;   // a temple landmark's shell (src/temples/landmark-materials.js nacre, uShellCenter): its centre, w 1 on
    float4 _Stone;         // a temple landmark's cut stone (landmark-materials.js stone(), no uniform on the web): course, width, wear, w 1 on
    float _VGlyph;         // the banners' glyph cells per vertex, the grid's (materials.js S_VGLYPH, life.js BannerSet; HIRAETH_VMAT)
    float _ThinPx;         // thin bars (src/thin.js, S_THIN): the least width they are drawn, in pixels; each vertex's axis point in formC
    float4 _LineFar;       // a lighter line from afar (materials.js LINE_FAR, the meadow's flowers): step, from, to (m), w 1 on
    float4 _PhEyeBox, _PhEye;   // (the portrait head's eye paint, issue #473)
    // (the passes' own that a material sets: the crowd's clock, the puffs' far fade, the grass's view)
    float _CrowdTime;
    float _MapOn;          // a picture over the colour (materials.js uMap: the game's canvases, BridgeRenderer.Texture), its uv in form.xy
    float4 _FarDepth;
    float4 _GrassView, _GrassLod, _GrassLook;
    float _GrassMirrored;
    // (issue #264, surfaces B: a billboard's night paint in the form's slot, NIGHT_PAINT; a reflection in still water, MIRROR:
    // the water's height, the lift, its reach, the shimmer, and the lake's ellipse; Lorn's veins under the water, WATER_VEINS:
    // their map's box; a splat's shape and its clock, splat-decal.js)
    float _NightOn, _MirrorOn, _VeinOn, _SplatOn;
    float4 _Mirror, _MirrorLake, _VeinBox, _SplatClock;
    float4 _Breathe;       // (read by BridgeRenderer.Breathe, not the shader: the Buried Machine's parts moved a matrix an instance)
    float _FallOn; float4 _FallA, _FallB;   // a falling sheet of water (Fall.hlsl, waterfall-shader.js): speed, column, gaps, mist; ink, lip, height, seed
    CBUFFER_END

    float3 _SkyTop, _SkyHorizon;   // (the composite's: what the metals see)
    float3 _EnvGround;             // what lies below the horizon here (materials.js uEnvGround: the world's ground)
    float _Halftone, _Bounce;   // the look's shade tones (globals)
    float _LampsOn;             // how far the lamps' own colour shows (global: materials.js uLampsOn, src/eclipse.js dims it by day)
    TEXTURE2D(_Bed); SAMPLER(sampler_Bed);
    TEXTURE2D(_Map); SAMPLER(sampler_Map);
    TEXTURE2D(_VeinMap); SAMPLER(sampler_VeinMap);   // Lorn's crystal roots under the water (lorn-veins.js, WATER_VEINS)
    #define HIRAETH_EYE_PAINT_DECLARED
    TEXTURE2D(_EyePaint); SAMPLER(sampler_EyePaint);   // the portrait head's painted eyes and brows (PortraitFace.hlsl, issue #473)
    #include "Figure.hlsl"
    #include "Marks.hlsl"
    #include "TripoFace.hlsl"
    #include "Fall.hlsl"
    #include "PortraitFace.hlsl"
    float _HeroCut;   // the lens inside the traveller (materials.js uHeroCut, a shared one: HiraethLook)
    #if defined(HIRAETH_VMAT)
      // a merged mesh's material values per vertex (materials.js S_VMAT): every read below takes the vertex's, set in frag
      static float4 vmColor, vmColor2, vmColor3;
      static float vmStrataSize, vmGrid, vmFlat;
      #define _Color vmColor
      #define _Color2 vmColor2
      #define _Color3 vmColor3
      #define _StrataSize vmStrataSize
      #define _Grid vmGrid
      #define _Flat vmFlat
      static float vmGlyphs;   // (the glyphs' cells: the material's, or the grid's per vertex, S_VGLYPH)
      #define _Glyphs vmGlyphs
    #endif

    struct Attributes
    {
      float4 positionOS : POSITION;
      float3 normalOS : NORMAL;
      float4 color : COLOR;
      float2 uv : TEXCOORD0;
    #if defined(HIRAETH_VMAT)
      // a merged mesh (BridgeRenderer: S_VMAT): the colours with the band size, grid and flat; its object point and turn,
      // normal, place (three's frame)
      float4 vm1 : TEXCOORD1; float4 vm2 : TEXCOORD2; float4 vm3 : TEXCOORD3;
      float4 vmP : TEXCOORD4; float4 vmN : TEXCOORD5; float4 vmM : TEXCOORD6;
    #else
      float2 fold : TEXCOORD1;
      float4 sway : TEXCOORD2;   // plants: anchor x, z (Unity world), bend per metre of wind, brush lean
      float3 bind : TEXCOORD3;   // people: the rest-pose position (outfit zones, face, eyes: Figures.cs)
      float3 bindN : TEXCOORD4;  // and its normal
      float4 formC : TEXCOORD5;  // hatching that follows the form (src/form.js): a point on the part's axis (three's object space), w its kind
      float3 formA : TEXCOORD6;  // and the axis' direction
    #endif
      uint iid : SV_InstanceID;  // the crowd's instanced figures (HIRAETH_CROWD)
    };

    // instanced parts with a whole transform each (the wildlife: InstMats in Wildlife.cs): three rows of a 3x4 matrix and a tint
    struct MatInst { float4 r0, r1, r2, col; };
    StructuredBuffer<MatInst> _Mats;
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
      // the traveller brushing past along his path (brush.js, the bridge's trail), each plant by its own height and kind
      // (materials.js SWAY's uSwayPlant: _SurfD.y its height, z 1 a large plant, which parts only its low leaves round his legs)
      float3 lean3 = 0;
      if (_BrushTrailOn > 0.5 && _SurfD.y > 0.0)
      {
        sw.w = 0.0;
        float plantH = _SurfD.y * s, reach = clamp(0.3 + 0.35 * plantH, 0.45, 1.1);
        float2 lean = brushLean(toThree(float3(fi.r0.w, fi.r1.w, fi.r2.w)), reach * 0.35, reach, 2.5);
        float wy = y * s, rel = saturate(q.y / max(_SurfD.y, 1e-3));
        float prof = _SurfD.z > 0.5 ? 0.6 * min(wy, 1.3) / 1.3 * (1.0 - smoothstep(1.3, 2.2, wy)) : rel * rel * clamp(plantH / 1.3, 0.3, 1.2);
        lean3 = float3(-lean.x, 0.0, lean.y) * prof;
      }
      swayed = world + swayOffset(sw) + lean3;
      nW = SafeNormalize((cross(c1, c2) * n.x + cross(c2, c0) * n.y + cross(c0, c1) * n.z) * (det < 0.0 ? -1.0 : 1.0));   // (not sign(det): a plant flat in one axis, det 0, kept its normal, issue #462)
    }
    // a reflection in still water, from wherever the eye is (materials.js MIRROR: the Garden's mirror lake), three space: the
    // point mirrored in the water's plane, laid on the plane where the eye's ray to that image crosses it, lifted toward the
    // eye by a share of its distance (the nearer image covers the farther); the eye under the water: none
    // a splat's scale at age t (s) of a life (s): pops out with a little overshoot, holds, shrinks away (splat-decal.js splatGrowth)
    float splatGrowth(float t, float life)
    {
      float grow = t < 0.14 ? sin(t / 0.14 * 3.14159265 * 0.62) / sin(3.14159265 * 0.62) * 1.12 : 1.12 - 0.12 * min(1.0, (t - 0.14) / 0.2);
      return max(0.0, grow * (1.0 - smoothstep(life - 1.1, life, t)));
    }
    float3 mirrorWorld(float3 w)
    {
      float3 C = toThree(_WorldSpaceCameraPos);
      float wy = _Mirror.x, h = C.y - wy;
      float3 m = float3(w.x, min(2.0 * wy - w.y, wy - 0.01), w.z);
      if (h <= 0.02) return C - float3(0, 1e4, 0);
      float3 p = C + (m - C) * (h / (C.y - m.y));
      float k = _Mirror.y * saturate(1.0 - length(m - C) / _Mirror.z);
      return C + (p - C) * (1.0 - k);
    }
    ENDHLSL

    Pass
    {
      Name "HiraethGBuffer"
      Tags { "LightMode" = "HiraethGBuffer" }
      Cull [_Cull]
      ZWrite [_ZWrite]
      ZTest [_MZTest]
      // (pulled in front in depth as three's polygon offset does: a splat lies exactly on the ground, which hid it, or not,
      // frame by frame; 0 for everything else)
      Offset [_OffsetFactor], [_OffsetUnits]

      HLSLPROGRAM
      #pragma target 4.5
      #pragma vertex vertEntry
      #pragma fragment fragEntry
      #pragma multi_compile_local _ HIRAETH_CROWD HIRAETH_PUFFS HIRAETH_INSTMAT HIRAETH_GRASS HIRAETH_FLORA HIRAETH_VMAT HIRAETH_SKIN
      #pragma multi_compile_local _ HIRAETH_FIGHT
      // HIRAETH_FIGHT: the fight's own surfaces, the web's GLSL in HLSL (generated). A foe's painted surface (src/foe-surface.js:
      // bellies, mottling, rust, grain, bands, scales, spots, rivets, drips, cracks, glow, gloss; FoeSurface.hlsl), each feature a
      // branch on the material's _FoeBits, its uniforms in _SkinData; the fluid sword's living blade and the guard's shield
      // (src/blade-shader.js; BladeSurface.hlsl, _BladeOn): their currents, meniscus, bow along the swing, a hit's ring, light. Lean
      // as a skin is (none of the full variant's rare paths, the ground's or the water's: WorldLoader gives it only to a foe that
      // uses none, and to the blade, whose fluid is its own), never with a LEAN or PLAIN keyword (BridgeShaderStrip leaves those
      // out), alone or with the GPU instances' HIRAETH_INSTMAT (a foe's repeated parts), never with the other kinds: four programs
      // more, prepass or not, on every platform. Foes and the blade are a few thousand pixels of a frame.
      // HIRAETH_SKIN: a temple skin's surface (issue #342, src/temples/skins/skin-shader.js): its pattern, by number (_SkinBody), one
      // of the generated SkinPatterns.hlsl's bodies (each the web's own GLSL in HLSL), its uniforms the material's _SkinData. One
      // variant for every skin (lean: none of the rare paths, the ground's, the water's or a wall's marks), with the pattern only
      // without the LEAN and PLAIN keywords (BridgeRenderer.Lean gives a skin none): two programs more, prepass or not (#16).
      // HIRAETH_PREPASS (global, HiraethFeature's depth prepass, -prepass): the same pass drawing depth alone first, its
      // vertex the G-buffer's own position (the rest of vert left to the compiler to drop), no fragment work but the
      // glass's, the dissolve's and a veil's (they write no depth there: drawn in full by the G-buffer pass after); the G-buffer pass
      // then shades each pixel once. Off, the pass is as before.
      #pragma multi_compile _ HIRAETH_PREPASS
      // HIRAETH_LEAN: a material that is no water, terrain, glass, fluid, makers' box, scrub, veins, drawn face or dissolve
      // (BridgeRenderer.Lean, the Unity bridge's Linux player) on a variant without those paths (LEANK false: the compiler
      // drops them). The full pass is ~25 000 instructions and 168 VGPRs on the Deck's RADV (6 waves a SIMD), the lean
      // one about half and 128 (8): the City-Shaft's GPU 3-4 ms quicker, the same picture (docs/systems/performance.md,
      // "The Steam Deck, round 6")
      // HIRAETH_LEAN_TERRAIN and HIRAETH_LEAN_WATER: the lean variant with the ground's path (or the water's) kept, for the
      // terrain and banked sand (or the water) that use none of the other rare paths: the Xbox's GPU 13.1 ms at the 1440p
      // spawn against 17.9 on the full variant (docs/systems/xbox.md, "The see-through picture").
      // HIRAETH_LEAN_SLIM: HIRAETH_LEAN for a material that is no person (no outfit or eye, creases or folds), has no picture
      // and no hatching that follows its form, and keeps a wall's marks (BridgeRenderer.Lean: never with HIRAETH_PLAIN, nor on
      // the instances' and grass's copies, which stall or fault the Adreno): its vertices pass on 19 floats, not 28, without the
      // bind, fold and form interpolators; the same picture. The Retroid's GPU up to 1 ms less (issue #262;
      // docs/systems/performance.md, "Unity on the Retroid, round 7"). In Android's Vulkan builds only (BridgeShaderStrip).
      // HIRAETH_LEAN_SCRUB and HIRAETH_LEAN_GLASS: the lean variant with one rare path kept, the scrub's strokes (the City-Shaft's
      // trees, the desert's scrub) or the glass's cut (Underwater's domes and tubes), for a material that uses no other: drawn
      // on the full variant before, ~25 000 instructions, and the scrub's in the prepass with the glass's discard in it (no early
      // depth); the same picture. In Android's Vulkan builds only, as the slim ones (BridgeShaderStrip, BridgeRenderer.leanRare;
      // docs/systems/performance.md, "Unity on the Retroid, round 11").
      #pragma multi_compile_local _ HIRAETH_LEAN HIRAETH_LEAN_TERRAIN HIRAETH_LEAN_WATER HIRAETH_LEAN_SLIM HIRAETH_LEAN_SCRUB HIRAETH_LEAN_GLASS
      #if defined(HIRAETH_LEAN_SLIM)
        #define HIRAETH_LEAN 1
        #define SLIMV 1
      #endif
      #if defined(SLIMV)
        static float3 _slimBind; static float2 _slimFold; static float4 _slimForm;
        #undef O_BIND
        #undef O_FOLD
        #undef O_FORM
        #undef I_BIND
        #undef I_FOLD
        #undef I_FORM
        #define O_BIND _slimBind
        #define O_FOLD _slimFold
        #define O_FORM _slimForm
        #define I_BIND float3(0, 0, 0)
        #define I_FOLD float2(0, 0)
        #define I_FORM float4(0, 0, 0, 0)
      #endif
      #if defined(HIRAETH_LEAN_SCRUB) || defined(HIRAETH_LEAN_GLASS)
        #define LEAN_ONE 1
      #endif
      #if defined(HIRAETH_LEAN) || defined(HIRAETH_LEAN_TERRAIN) || defined(HIRAETH_LEAN_WATER) || defined(HIRAETH_SKIN) || defined(HIRAETH_FIGHT) || defined(LEAN_ONE)
        #define LEANK false
      #else
        #define LEANK true
      #endif
      #if defined(HIRAETH_LEAN) || defined(HIRAETH_LEAN_WATER) || defined(HIRAETH_SKIN) || defined(HIRAETH_FIGHT) || defined(LEAN_ONE)
        #define TERRAINK false
      #else
        #define TERRAINK true
      #endif
      #if defined(HIRAETH_LEAN) || defined(HIRAETH_LEAN_TERRAIN) || defined(HIRAETH_SKIN) || defined(HIRAETH_FIGHT) || defined(LEAN_ONE)
        #define WATERK false
      #else
        #define WATERK true
      #endif
      #if defined(HIRAETH_LEAN_SCRUB)
        #define SCRUBK true
      #else
        #define SCRUBK LEANK
      #endif
      #if defined(HIRAETH_LEAN_GLASS)
        #define GLASSK true
      #else
        #define GLASSK LEANK
      #endif
      // HIRAETH_PLAIN (fragment only): a lean material with none of a wall's marks (no pattern, weathering, pen detail or
      // colour patches: BridgeRenderer.Lean), on a variant without their code. Never drawn there, they still cost every
      // pixel of the ground, the people and the props the registers of the walls' heaviest paths, and the GPU its waves
      // in flight: 0.7-1.4 ms of the Retroid's GPU a frame (issue #262). The same picture. Given on Android (-plain elsewhere).
      #pragma multi_compile_local_fragment _ HIRAETH_PLAIN
      // (the primitive's number in the fragment stage, for a two-sided material's face: everywhere but Android and OpenGL ES,
      // issue #536; BridgeSided.ById says the same on the C# side)
      #if !defined(SHADER_API_MOBILE) && !defined(SHADER_API_GLES3) && !defined(SHADER_API_GLES)
        #define SIDES_BY_ID 1
      #endif
      #if defined(HIRAETH_PLAIN) || defined(HIRAETH_SKIN)
        #define WALLK false
      #else
        #define WALLK true
      #endif
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
      #include "Crowd.hlsl"
      #if defined(HIRAETH_SKIN) && !defined(HIRAETH_LEAN) && !defined(HIRAETH_LEAN_TERRAIN) && !defined(HIRAETH_LEAN_WATER) && !defined(LEAN_ONE) && !defined(HIRAETH_PLAIN) && !defined(HIRAETH_PREPASS)
        #define SKINK 1
        #include "SkinPatterns.hlsl"
      #endif
      #if defined(HIRAETH_FIGHT) && !defined(HIRAETH_PREPASS)
        #define FOEK 1
        #include "FoeSurface.hlsl"
        #include "BladeSurface.hlsl"
        #include "CrystalSurface.hlsl"
      #endif
      // the sun's shadow maps (HiraethShadows.cs, materials.js getShadow): fine, near, far; each its matrix
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
      // A face turned from the sun: is it also inside another's cast shadow? (materials.js castBeyond: one tap of the
      // middle map HALFTONE_REACH = 16 m toward the sun, past the form's own body; wpU in Unity space)
      float castBeyond(float3 wpU)
      {
        if (_MShadowOn <= 0.0 || _MShadowParams1.w <= 0.0) return 0.0;
        float3 p = mul(_MShadowMat1, float4(wpU + toThree(_SunDir) * 16.0, 1.0)).xyz;
        if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) return 0.0;
        #if UNITY_REVERSED_Z
          if (p.z < 0.0) return 0.0;
          float z = p.z + _MShadowParams1.x * 4.0;
        #else
          if (p.z > 1.0) return 0.0;
          float z = p.z - _MShadowParams1.x * 4.0;
        #endif
        return 1.0 - SAMPLE_TEXTURE2D_SHADOW(_MShadowMap1, sampler_LinearClampCompare, float3(p.xy, z));
      }
      // instanced puffs (smoke, embers, dust, footprints: Puffs.cs): where, how big, which way, what colour
      struct PuffInst { float4 at; float4 size; float4 col; };   // at.w yaw, size.w pitch, col.w roll (rad, Unity)
      StructuredBuffer<PuffInst> _Puffs;
      // the grass tufts round the camera (Grass.cs, flora-grass.js): root xyz (Unity), height; turn, tint, lean, rank
      struct GrassInst { float4 at; float4 b; };
      StructuredBuffer<GrassInst> _GrassInst;
      // grass-shader.js: the patch's centre x, z (three space) and its edge fade's start and end (m); the thinning (start, end,
      // share kept, w 1: grows in, the far layer); the blend into the ground (start, end, height left, the pen-lined share)
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
      #if !defined(SLIMV)
        float2 fold : TEXCOORD7;
      #endif
        // (no posWS: Unity's space is three's with x turned back, toThree(worldPos) in the fragment: three floats fewer
        // a vertex to pass on, issue #262)
      #if !defined(SLIMV)
        float3 bind : TEXCOORD9;
      #endif
        // (the crowd's and the grass's own, only in their variants: seven floats fewer a vertex to pass on elsewhere, #262)
      #if defined(HIRAETH_CROWD)
        float4 crowdTrim : TEXCOORD10;  // the crowd figures: the tunic's printed pattern (accent, id)
      #endif
      #if defined(HIRAETH_GRASS)
        nointerpolation float3 grassLook : TEXCOORD11;   // a grass blade: its pen line, its outline's fade, its blend into the ground
      #endif
      #if !defined(SLIMV)
        float4 form : TEXCOORD12;       // the point about its part's axis (materials.js vForm): across it xy, along it z, w the kind
      #endif
      #if defined(HIRAETH_SKIN)
        float2 skinUV : TEXCOORD13;     // a temple skin's uv (materials.js vTextureUV: the Lamp-House's plates; HIRAETH_VMAT's slot, never both)
      #endif
      #if defined(HIRAETH_VMAT)
        nointerpolation float4 vm1 : TEXCOORD13; nointerpolation float4 vm2 : TEXCOORD14; nointerpolation float4 vm3 : TEXCOORD15;
      #endif
      };

      float _MSurfaceDebug;   // (global: BridgeRunner -surface-debug)
      float _MSurfaceSkip;    // (global: BridgeRunner -surface-skip N, a test of what each part costs the GPU (issue #262), the
                              // parts left out by bit: 1 patterns, 2 weathering, 4 pen detail, 8 colour patches, 16 hatching,
                              // 32 the sun's shadow, 64 the local lights, 128 the ground's marks, 256 the shade's tone)

      Varyings vert(Attributes v)
      {
        // (-surface-debug 12: the vertex stage's plain transform and nothing else, the fragment's plain values (9): what the
        // GPU spends on the vertices' own work, a test of issue #262; the instanced kinds then all stand at their mesh's origin)
        UNITY_BRANCH if (_MSurfaceDebug > 11.5)
        {
          Varyings q = (Varyings)0;
          float3 pw = TransformObjectToWorld(v.positionOS.xyz);
          q.positionCS = TransformWorldToHClip(pw);
          q.normal = toThree(TransformObjectToWorldNormal(v.normalOS));
          q.viewDepth = -TransformWorldToView(pw).z;
          return q;
        }
        Varyings o;
        #if defined(FOEK)
          // the fluid sword's blade bowed back along the swing, a wave up its edges; the shield's face bulged by a blow's ring
          // (blade-shader.js BLADE_VERT, in three's object space)
          UNITY_BRANCH if (_BladeOn > 1.5) v.positionOS.xyz = toThree(bladeBendDisc(toThree(v.positionOS.xyz), v.fold));
          else if (_BladeOn > 0.5) v.positionOS.xyz = toThree(bladeBendBlade(toThree(v.positionOS.xyz), v.fold));
        #endif
        #if !defined(HIRAETH_VMAT)
          // a thin bar (a mast's strut, a wire, a vine: src/thin.js, materials.js S_THIN) kept at least _ThinPx pixels wide
          // however far off: pushed out from its axis point (formC, three's object frame) where it would be thinner, so it never
          // breaks into pixels that come and go as it slides under them; a perspective view only (a shadow map's draws it as
          // it is). A uniform branch, no interpolator (issue #264)
          UNITY_BRANCH if (_ThinPx > 0.0 && v.formC.w > 0.5 && abs(UNITY_MATRIX_P._m32) > 0.5)
          {
            float3 axO = toThree(v.formC.xyz);
            #if defined(HIRAETH_INSTMAT)
              MatInst ti = _Mats[v.iid];
              float3 axW = float3(dot(ti.r0.xyz, axO) + ti.r0.w, dot(ti.r1.xyz, axO) + ti.r1.w, dot(ti.r2.xyz, axO) + ti.r2.w);
            #else
              float3 axW = TransformObjectToWorld(axO);
            #endif
            float tr = length(v.positionOS.xyz - axO);
            float want = _ThinPx * length(axW - _WorldSpaceCameraPos) / max(abs(UNITY_MATRIX_P._m11) * _ScreenParams.y, 1e-4);
            if (tr > 1e-5 && want > tr) v.positionOS.xyz = axO + (v.positionOS.xyz - axO) * (want / tr);
          }
        #endif
        #if defined(HIRAETH_VMAT)
          float3 posWS = TransformObjectToWorld(v.positionOS.xyz);
        #else
          float3 posWS = TransformObjectToWorld(v.positionOS.xyz) + swayOffset(v.sway);
          if (_MirrorOn > 0.5) posWS = toThree(mirrorWorld(toThree(posWS)));   // (a reflection in still water: materials.js MIRROR)
        #endif
        float3 nWS = TransformObjectToWorldNormal(v.normalOS);
        float3 scl = float3(length(UNITY_MATRIX_M._m00_m10_m20), length(UNITY_MATRIX_M._m01_m11_m21), length(UNITY_MATRIX_M._m02_m12_m22));
        o.positionCS = TransformWorldToHClip(posWS);
        o.worldPos = toThree(posWS);
        o.normal = toThree(nWS);
        o.instColor = _NoVertexColor > 0.5 ? float3(1, 1, 1) : v.color.rgb;   // (a mesh without colours may read black)
        #if defined(HIRAETH_SKIN)
        o.skinUV = v.uv;
        #endif
        o.viewDepth = -TransformWorldToView(posWS).z;
        o.objPos = toThree(v.positionOS.xyz * scl);
        o.objNormal = toThree(v.normalOS / scl);
        float3 camOS = mul(UNITY_MATRIX_I_M, float4(_WorldSpaceCameraPos, 1.0)).xyz;
        O_FORM = 0;
        // (a picture's uv where the form's point would be: a material with a map has no S_FORM; w 0 keeps the form's hatching off)
        if (_MapOn > 0.5 || _FallOn > 0.5) O_FORM = float4(v.uv, 0, 0);   // (a fall's uv in metres too: Fall.hlsl)
        #if defined(HIRAETH_VMAT)
          // (each merged object's own frame: materials.js S_VMAT; the camera in its frame, its turn about y undone)
          o.vm1 = v.vm1; o.vm2 = v.vm2; o.vm3 = v.vm3;
          o.objPos = v.vmP.xyz; o.objNormal = v.vmN.xyz;
          float vc = cos(v.vmP.w), vs = sin(v.vmP.w);
          float3 vd = toThree(_WorldSpaceCameraPos) - v.vmM.xyz;
          o.objRel = v.vmP.xyz - float3(vc * vd.x - vs * vd.z, vd.y, vs * vd.x + vc * vd.z);
          O_FOLD = 0; O_BIND = 0;
        #else
        if (_Bind > 0.5) { o.objPos = toThree(v.bind * scl); o.objNormal = toThree(v.bindN / scl); }   // (three: the unskinned position)
        o.objRel = o.objPos - toThree(camOS * scl);
        O_FOLD = v.fold;
        O_BIND = toThree(v.bind);
        if (_DuneOn > 0.5 || _CrystalOn > 0.5) O_FORM = v.formC;   // (the Glass Dunes' aGlass: the silhouettes, the thin glass, the lobes; the pools; a chime crystal's aCrystal)
        // (a billboard's aNight in the form's slot: its night colour, its glow then (NIGHT_PAINT); a splat's aSplat there, its
        // inner tone in the bind's, its phase in the fold's (splat-decal.js): pack.js unityGeometry)
        if (_NightOn > 0.5 || _SplatOn > 0.5) O_FORM = v.formC;
        if (_SplatOn > 0.5) { O_BIND = v.formA; O_FOLD = float2(v.uv.x, 0); }
        if (_FormOn > 0.5 && v.formC.w > 0.5)
        {
          // (in three's object frame, metric: materials.js S_FORM; the position mirrored back)
          float3 fa = v.formA * scl;
          float fl = length(fa);
          fa = fl > 1e-6 ? fa / fl : float3(0, 1, 0);
          float3 fu = normalize(cross(fa, abs(fa.y) < 0.9 ? float3(0, 1, 0) : float3(1, 0, 0))), fv = cross(fa, fu);
          float3 fr = (toThree(v.positionOS.xyz) - v.formC.xyz) * scl;
          O_FORM = float4(dot(fr, fu), dot(fr, fv), dot(fr, fa), v.formC.w);
        }
        #endif
        #if defined(HIRAETH_CROWD)
          // an instanced crowd figure (crowd-shader.js): posed in figure space (three's), then mirrored and placed
          CrowdInst ci = _CrowdInst[v.iid];
          float3 cp = v.positionOS.xyz, cn = v.normalOS, ccol; float4 ctrim;
          crowdAnimate(ci, v.sway, cp, cn, ccol, ctrim);
          float cs = ci.scale.x, cc = cos(ci.at.w), sn = sin(ci.at.w);
          float3 pu = toThree(cp) * cs, nu = toThree(cn);
          posWS = ci.at.xyz + float3(cc * pu.x + sn * pu.z, pu.y, -sn * pu.x + cc * pu.z);
          nWS = normalize(float3(cc * nu.x + sn * nu.z, nu.y, -sn * nu.x + cc * nu.z));
          o.positionCS = TransformWorldToHClip(posWS);
          o.worldPos = toThree(posWS);
          o.normal = toThree(nWS);
          o.instColor = ccol;
          o.viewDepth = -TransformWorldToView(posWS).z;
          o.objPos = cp * cs; o.objNormal = cn / cs; o.objRel = o.objPos - toThree(_WorldSpaceCameraPos);
          O_BIND = v.positionOS.xyz;
          o.crowdTrim = ctrim;
        #endif
        #if defined(HIRAETH_GRASS)
          // a tuft of blades (grass-shader.js grassPlace), all in three space: thinned by rank with distance, shorter and in the
          // ground's colour further off, sunk at the patch's edge, bent by the wind and parted round the traveller's feet
          GrassInst gi = _GrassInst[v.iid];
          float3 root = toThree(gi.at.xyz);
          float rank = gi.b.w;
          float3 camT = toThree(_WorldSpaceCameraPos);
          float de = length(root.xz - _GrassView.xy);
          float dc = length(float3(root.xz - camT.xz, 0.35 * (root.y - camT.y)));
          float lodT = smoothstep(_GrassLod.x, _GrassLod.y, dc);
          float share = _GrassLod.w > 0.5 ? lodT : lerp(1.0, _GrassLod.z, lodT);
          float life = saturate((share * 1.25 - rank) / 0.25);
          float edge = 1.0 - smoothstep(_GrassView.z, _GrassView.w, de);
          float look = smoothstep(_GrassLook.x, _GrassLook.y, dc);
          float gh = gi.at.w * edge * life * lerp(1.0, _GrassLook.z, look);
          float3 gp = v.positionOS.xyz;
          if (_GrassMirrored > 0.5) gp.x = -gp.x;
          float gt = gp.y;
          float pen = step(frac(rank * 7.31), _GrassLook.w) * (1.0 - smoothstep(_GrassLook.x * 0.6, _GrassLook.x * 1.4, dc));
          float gc = cos(gi.b.x), gs = sin(gi.b.x);
          float2 gxz = float2(gc * gp.x - gs * gp.z, gs * gp.x + gc * gp.z) * lerp(1.0, 0.8, look);
          float2 wd = _Wind.xy; float str = _Wind.z;
          float wave = 0.5 + 0.5 * sin(_MTime * 1.7 - dot(root.xz, wd) * 0.09);
          float push = str * (0.35 + 0.65 * _Wind.w * wave);
          float flutter = (0.4 + 0.6 * str) * sin(_MTime * (2.3 + 1.1 * str) + root.x * 0.53 + root.z * 0.31 + rank * 6.28);
          float2 bend = wd * (push * 0.32 + flutter * 0.1) + float2(gc, gs) * gi.b.z;
          // (the traveller walking through: the blades part round his last second of steps and spring back, grass-shader.js
          // brushLean x GRASS_BRUSH; the port's own world, without the path: round his feet)
          if (_BrushTrailOn > 0.5) bend += brushLean(root, 0.12, 0.75, 1.6) * 8.0;
          else
          {
            float2 away = root.xz - _Brush.xz; float dB = length(away);
            float brush = (1.0 - smoothstep(0.2, 1.0, dB)) * (0.9 + 0.12 * min(_Brush.w, 5.0));
            bend += (dB > 1e-3 ? away / dB : float2(0, 0)) * brush * 1.3;
          }
          float bl = length(bend);
          float2 off = bend * gt * gt * gh;
          float rise = gt * gh / sqrt(1.0 + bl * bl * gt * gt);
          float3 wpT = float3(root.x + gxz.x + off.x, root.y - 0.04 + rise, root.z + gxz.y + off.y);
          float3 gn = normalize(float3(bend.x * 0.25 * (1.0 - look), 1.0, bend.y * 0.25 * (1.0 - look)));
          posWS = toThree(wpT); nWS = toThree(gn);
          o.positionCS = TransformWorldToHClip(posWS);
          o.worldPos = wpT; o.normal = gn;
          o.instColor = lerp(float3(1, 1, 1), _Color2.rgb / max(_Color.rgb, 0.02), gi.b.y) * lerp(0.8, 1.06, frac(rank * 13.7)) * lerp(0.94, 1.08, gt);
          o.viewDepth = -TransformWorldToView(posWS).z;
          o.objPos = wpT; o.objNormal = gn; o.objRel = wpT - camT;
          O_BIND = 0;
          o.grassLook = float3(pen, look, look);
        #endif
        #if defined(HIRAETH_PUFFS)
          PuffInst pi = _Puffs[v.iid];
          float3 e3 = float3(pi.size.w, pi.at.w, pi.col.w);
          float3 lp = v.positionOS.xyz * pi.size.xyz;
          posWS = pi.at.xyz + rotXYZ(lp, e3);
          nWS = normalize(rotXYZ(v.normalOS / max(pi.size.xyz, 1e-4), e3));
          o.positionCS = TransformWorldToHClip(posWS);
          o.worldPos = toThree(posWS); o.normal = toThree(nWS);
          o.instColor = pi.col.rgb * v.color.rgb;
          o.viewDepth = -TransformWorldToView(posWS).z;
          o.objPos = toThree(lp); o.objNormal = toThree(v.normalOS); o.objRel = o.objPos - toThree(_WorldSpaceCameraPos - pi.at.xyz);
          O_BIND = 0;
        #endif
        #if defined(HIRAETH_INSTMAT)
          MatInst mi = _Mats[v.iid];
          float3 q = v.positionOS.xyz;
          posWS = float3(dot(mi.r0.xyz, q) + mi.r0.w, dot(mi.r1.xyz, q) + mi.r1.w, dot(mi.r2.xyz, q) + mi.r2.w);
          nWS = SafeNormalize(float3(dot(mi.r0.xyz, v.normalOS), dot(mi.r1.xyz, v.normalOS), dot(mi.r2.xyz, v.normalOS)));
          o.positionCS = TransformWorldToHClip(posWS);
          o.worldPos = toThree(posWS); o.normal = toThree(nWS);
          o.instColor = mi.col.rgb * v.color.rgb;
          o.viewDepth = -TransformWorldToView(posWS).z;
          float ms = length(mi.r0.xyz);
          o.objPos = toThree(q * ms); o.objNormal = toThree(v.normalOS); o.objRel = o.objPos - toThree((_WorldSpaceCameraPos - float3(mi.r0.w, mi.r1.w, mi.r2.w)));
          O_BIND = 0;
        #endif
        #if defined(HIRAETH_FLORA)
          {
            float3 fw, fs, fn;
            floraPlace(_Flora[v.iid], v.positionOS.xyz, v.normalOS, fw, fs, fn);
            posWS = fs; nWS = fn;
            o.positionCS = TransformWorldToHClip(posWS);
            o.worldPos = toThree(posWS); o.normal = toThree(nWS);
            o.instColor = (_NoVertexColor > 0.5 ? float3(1, 1, 1) : v.color.rgb) * _Flora[v.iid].col.rgb;
            o.viewDepth = -TransformWorldToView(posWS).z;
            // (patterns anchored in the world, as on the merged chunks the flora was drawn as)
            o.objPos = toThree(fw); o.objNormal = toThree(fn); o.objRel = o.objPos - toThree(_WorldSpaceCameraPos);
            O_BIND = 0;
          }
        #endif
        // (-surface-debug 10 and 11: the position, normal and depth from the object's own transform alone, none of the above:
        // whether a surface missing on the Xbox goes in the vertex stage; 10 with the fragment's plain values, 11 with all of it)
        #if defined(FOEK)
          // a chime crystal's own beat (crystal-shader.js CRYSTAL_VERT: from its place, an instance's origin), in the fold's slot
          UNITY_BRANCH if (_CrystalOn > 0.5)
          {
            #if defined(HIRAETH_INSTMAT)
              MatInst cm = _Mats[v.iid]; float3 cc = toThree(float3(cm.r0.w, cm.r1.w, cm.r2.w));
            #else
              float3 cc = toThree(TransformObjectToWorld(float3(0, 0, 0)));
            #endif
            O_FOLD = float2(frac(sin(dot(floor(cc.xz * 7.0), float2(12.9898, 78.233))) * 43758.5453) * 6.2832, 0.0);
          }
        #endif
        // a lighter line from afar (materials.js LINE_FAR, the meadow's flowers): a whole plant at a time, each at its own
        // distance between _LineFar.y and .z (a hash of where it stands, the web's, in three's frame), so a meadow turns over
        // plant by plant; the flag rides the instance tint's red (+4: a tint is never over 2), taken off in frag. A uniform
        // branch, no interpolator more (issue #264)
        UNITY_BRANCH if (_LineFar.w > 0.5)
        {
          #if defined(HIRAETH_INSTMAT)
            float3 lfAt = float3(_Mats[v.iid].r0.w, _Mats[v.iid].r1.w, _Mats[v.iid].r2.w);
          #elif defined(HIRAETH_FLORA)
            float3 lfAt = float3(_Flora[v.iid].r0.w, _Flora[v.iid].r1.w, _Flora[v.iid].r2.w);
          #else
            float3 lfAt = TransformObjectToWorld(float3(0, 0, 0));
          #endif
          float lfK = frac(sin(dot(floor(toThree(lfAt).xz * 4.0), float2(12.9898, 78.233))) * 43758.5453);
          if (distance(lfAt, _WorldSpaceCameraPos) >= lerp(_LineFar.y, _LineFar.z, lfK)) o.instColor.r += 4.0;
        }
        UNITY_BRANCH if (_MSurfaceDebug > 9.5)
        {
          float3 pw = TransformObjectToWorld(v.positionOS.xyz);
          o.positionCS = TransformWorldToHClip(pw);
          o.worldPos = toThree(pw);
          o.normal = toThree(TransformObjectToWorldNormal(v.normalOS));
          o.viewDepth = -TransformWorldToView(pw).z;
        }
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
      // the strokes' triplanar weights: sharp on a faceted surface, straight down on the ground
      float3 strokeWeights(float3 on, int mode)
      {
        float3 tw = pow(abs(SafeNormalize(on)), 3.0);
        tw /= max(tw.x + tw.y + tw.z, 1e-6);
        if (_Flat > 0.5) {
          float3 a = abs(on);
          tw = a.x > a.y && a.x > a.z ? float3(1, 0, 0) : (a.y > a.z ? float3(0, 1, 0) : float3(0, 0, 1));
        }
        if (mode == MODE_TERRAIN) tw = float3(0, 1, 0);
        return tw;
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
        float3 Bo = cross(_BrushAxis.xyz, SafeNormalize(objN));
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
        // (the bridge's map is bytes, z 1: the depth under the surface on a square-root scale, engine/water-bed.js BED_RANGE
        // 16 m; Waters.cs's a float height over _BedRef.x, z 0. Two ALU ops, no branch: issue #502)
        float r = SAMPLE_TEXTURE2D_LOD(_Bed, sampler_Bed, saturate(uv), 0).r;
        float bed = _BedRef.x + lerp(r, -16.0 * r * r, _BedRef.z);
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
      // The contact foam (water-shader.js contactFoam, CONTACT; docs/systems/water.md "Contact foam"): little waves round
      // whatever stands in the water. Foam where the view ray's run through the water to what is behind it is short (the
      // scene's view depth there, _HiraethSceneDepth: HiraethFeature copies it before drawing the water, which writes no
      // depth), over how fast that run grows across the water (fwidth, held in CONTACT.slope): the distance to the contact
      // in metres. Raises `foam`, returns the wavelets' ink. All its noise is on p.xz (three space): anchored in the world.
      Texture2D<float> _HiraethSceneDepth;
      float _HiraethContact;   // 1 while the water is drawn over this frame's copy
      float contactFoam(float3 p, float t, float px, float2 wd, float2 pix, float vd, inout float foam)
      {
        if (_HiraethContact < 0.5) return 0.0;   // (a uniform branch)
        uint sw, sh; _HiraethSceneDepth.GetDimensions(sw, sh);
        float sd = _HiraethSceneDepth.Load(int3(clamp(int2(pix), int2(0, 0), int2(sw, sh) - 1), 0));
        float run = sd - vd;
        // the sky, or something in front of the water here (under water, seen from below): nothing to meet
        bool none = vd <= 1e-3 || sd <= 0.0 || run < -(0.3 + 0.01 * vd);
        float ray = none ? 64.0 : min(max(run, 0.0) * length(p - toThree(_WorldSpaceCameraPos)) / max(vd, 1e-3), 64.0);
        float dist = ray / clamp(fwidth(ray) / max(px, 1e-4), 0.4, 1.0);   // (CONTACT.slope)
        float pr = max(_PixelRatio, 1.0);
        float bw = clamp(max(0.3, 6.0 * pr * px), 0.3, 1.2);              // (CONTACT.band, minPx, maxBand)
        float g = max(0.18, 5.0 * pr * px);                                // (CONTACT.gap, gapPx)
        float keep = 1.0 - smoothstep(0.1, 0.2, px);                       // (CONTACT.far)
        if (keep <= 0.0 || dist > bw * (1.0 + 0.22) + g * 4.0) return 0.0;   // (CONTACT.breathe)
        float near = 1.0 - smoothstep(0.03, 0.07, px);                     // (CONTACT.detail: close up only)
        // each stretch of the band breathes in its own time: out, and back
        float ph = vnoise(p.xz * 0.45) * 6.2832;
        float edge = bw * (1.0 + 0.22 * sin(t * 1.3 + ph));
        float body = 1.0 - smoothstep(edge - px, edge + px, dist);
        float inner = 1.0 - smoothstep(edge * 0.45 - px, edge * 0.45 + px, dist);
        // small gaps in its outer part, drifting with the wind (only where the band is thick enough on screen)
        float gaps = smoothstep(0.3, 0.38, vnoise(p.xz * 2.4 + wd * t * 0.3 + float2(0.0, t * 0.08)));
        float c = max(inner, body * lerp(1.0, gaps, near * smoothstep(9.0, 14.0, bw / max(px, 1e-4))));
        // foam flecks just off the band: world-fixed cells, each a speck that comes and goes
        float cs = 0.22;
        float2 id = floor(p.xz / cs), f = (frac(p.xz / cs) - 0.5 - (hash2(id + 4.1) - 0.5) * 0.4) * cs;
        float h = hash(id + floor(t * 0.7 + hash(id + 2.3) * 9.0) * 0.173);
        float r = 0.022 + 0.02 * hash(id + 7.7);
        float zone = step(edge, dist) * (1.0 - smoothstep(edge + g * 2.0, edge + g * 2.6, dist));
        float fleck = (1.0 - smoothstep(r - px, r + px, length(f))) * step(0.7, h) * zone * near * smoothstep(2.5, 4.0, r / px);
        foam = max(foam, max(c, fleck) * keep);
        // two broken inked wavelets off the band, swelling out after it and back
        float at1 = edge + g * (1.0 + 0.5 * sin(t * 1.3 + ph - 0.9));
        float at2 = at1 + g * (1.5 + 0.6 * sin(t * 1.3 + ph - 2.0));
        float d1 = step(0.36, vnoise(p.xz * 1.3 + 5.0 - wd * t * 0.2));
        float d2 = step(0.5, vnoise(p.xz * 1.1 + 11.0 + wd * t * 0.15));
        float wl = max(inkLine(abs(dist - at1) / max(px, 1e-4), 1.3) * d1, inkLine(abs(dist - at2) / max(px, 1e-4), 1.1) * d2 * 0.8);
        return wl * near * keep * (1.0 - fleck);
      }
      // Lorn's crystal roots under the water (water-shader.js waterVeins, WATER_VEINS: lorn-veins.js bakes _VeinMap over the
      // basin: r how much of a vein, g, b where along it the light's bands are, a how deep it lies, of 3 m): crystal seen
      // through the surface, faceted in violet, lavender and teal cells, finely inked, its heart lit, a teal halo, bands of
      // light running in to the Crystal, breathing. Returns how lit it is (self-lit: the water's lit and glow).
      float waterVeins(float3 p, float t, float px, float fres, inout float3 col, inout float ink)
      {
        float2 wob = (float2(vnoise(p.xz * 0.21 + t * float2(0.17, 0.11)), vnoise(p.xz * 0.23 - t * float2(0.13, 0.19))) - 0.5) * 0.9;
        float2 uv = (p.xz + wob - _VeinBox.xy) * _VeinBox.zw;
        float4 vm = SAMPLE_TEXTURE2D(_VeinMap, sampler_VeinMap, saturate(uv));
        float body = vm.r * step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        float fb = fwidth(body);   // (derivatives first: uniform control flow)
        if (body < 0.004) return 0.0;
        float under = vm.a * 3.0, seen = exp(-under * 0.45) * (1.0 - 0.35 * fres);
        float cell = lerp(1.3, 0.55, saturate(under * 0.6));
        float2 q = p.xz / cell + wob * 0.5;
        float2 n = floor(q), f = frac(q), id = n, mr = float2(0, 0);
        float md = 8.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++)
        {
          float2 g = float2(i, j), r = g + hash2(n + g) - f;
          float d = dot(r, r);
          if (d < md) { md = d; id = n + g; mr = r; }
        }
        float tone = hash(id + 3.7);
        float3 cc = tone < 0.42 ? float3(0.53, 0.49, 0.9) : (tone < 0.78 ? float3(0.7, 0.64, 0.95) : float3(0.52, 0.86, 0.8));
        float facet = 0.9 + 0.22 * dot(mr, normalize(hash2(id + 9.1) - 0.5 + 1e-3));
        float wave = (vm.g * 2.0 - 1.0) * cos(t * 1.5) + (vm.b * 2.0 - 1.0) * sin(t * 1.5);
        float pulse = pow(saturate(0.5 + 0.5 * wave), 6.0);
        float breathe = 0.84 + 0.16 * sin(t * 0.75 + p.x * 0.008 - p.z * 0.006);
        float k = smoothstep(0.04, 0.55, body) * seen;
        col = lerp(col, cc * facet * (breathe + 0.35 * pulse), k * 0.9);
        float far = smoothstep(0.04, 0.2, px / cell);
        float core = max(smoothstep(0.72, 0.97, body), far * 0.55);
        col = lerp(col, float3(0.82, 0.99, 0.95), core * seen * (0.35 + 0.45 * pulse));
        float halo = smoothstep(0.0, 0.15, body) * (1.0 - smoothstep(0.15, 0.5, body));
        col = lerp(col, float3(0.6, 0.93, 0.87), halo * seen * (0.3 + 0.35 * pulse));
        float cpx = max(px / cell * 1.6, 1e-4);
        float nearK = 1.0 - smoothstep(0.03, 0.1, px / cell);
        UNITY_BRANCH if (nearK > 0.0)
        {
          float cb = voronoiBorder(q);
          ink = max(ink, inkLine(cb / cpx, 0.55) * k * 0.32 * nearK);
        }
        float edge = inkLine(abs(body - 0.3) / max(fb, 1e-4), 0.8) * step(0.45, vnoise(p.xz * 0.6 + 7.0));
        ink = max(ink * (1.0 - k * 0.6), edge * seen * 0.4 * (1.0 - smoothstep(0.05, 0.2, px)));
        return k * (0.85 + 0.15 * pulse);
      }
      // the sun's sparkle (water-shader.js): a glint's share at this pixel, sent in the normal's length (frag, WATER_MARK) for
      // the pass over the page to paint white (WaterOver.shader); not here, where the composite would ink round it
      static float waterGlint = 0.0;
      float _WaterLite;   // (global: the preset's low detail, no sparkle; BridgeRunner.Water, main.js applyDetail)
      float3 waterLook(float3 p, bool front, float2 pix, float vd, out float ink, out float lit, out float glow)
      {
        glow = 0;
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
        if (_WaterOpt.y > 0.5)
        {
          ink *= 0.6;
          UNITY_BRANCH if (_MirrorOn > 0.5)
          {
            // a reflection (materials.js MIRROR): only on the lake, and broken across the line of sight by thin drifting gaps
            // where the water shows between, wider apart further off (the image's shimmer); lit as the thing is, a little lighter
            float2 e = (p.xz - _MirrorLake.xy) / _MirrorLake.zw;
            if (dot(e, e) > 1.0) discard;
            float3 C = toThree(_WorldSpaceCameraPos);
            float dist = length(p.xz - C.xz);
            float2 look = (p.xz - C.xz) / max(dist, 1e-3);
            float lane = dist / (0.35 + dist * 0.022);
            float across = dot(p.xz, float2(-look.y, look.x));
            float gap = step(0.91, frac(lane + 0.25 * sin(across * 0.21 + t * 0.6))) * step(0.55, vnoise(float2(floor(lane) * 1.7, across * 0.12 + t * 0.15)));
            if (gap * _Mirror.w > 0.5) discard;
            lit = 0.3;
          }
          return _Color.rgb;
        }
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
        float veinGlow = 0.0;
        UNITY_BRANCH if (_VeinOn > 0.5) veinGlow = waterVeins(p, t, px, fres, col, ink);   // (their light through the sky's steps)
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
        // contact: little waves lapping round whatever stands in the water, from the scene's depth behind it (rocks and
        // walls the bed map has too, and what it doesn't: the ship, piers, people)
        float wavelets = contactFoam(p, t, px, wd, pix, vd, foam);
        ink = max(max(ink * (1.0 - foam), lap * 0.85), wavelets * 0.85);
        col = lerp(col, lerp(float3(0.97, 0.98, 0.95), shallow, 0.18), foam);
        lit = max(foam * 0.6, veinGlow);
        glow = veinGlow;
        // the sparkle: dashes of sun toward the sun (horizontal on the page), twinkling, in world-fixed cells (a power of two
        // metres, ~16 px along the view), a dash in each lying across the view
        UNITY_BRANCH if (_SunDir.y > 0.02 && _WaterOpt.w > 0.0 && _WaterLite < 0.5)
        {
          float path = smoothstep(0.88, 0.995, dot(float3(-V.x, V.y, -V.z), _SunDir));
          float3 cf = toThree(-UNITY_MATRIX_V[2].xyz);
          float2 side = normalize(float2(-cf.z, cf.x) + 1e-5), along = float2(side.y, -side.x);
          float cs = exp2(floor(log2(max(px * 16.0, 0.05))));
          float2 gq = p.xz / cs, id = floor(gq), f = frac(gq) - 0.5 - (hash2(id + 1.3) - 0.5) * 0.3;
          float2 fl = float2(dot(f, side), dot(f, along));
          float h = hash(id + floor(t * 2.3 + hash(id + 3.1) * 7.0) * 0.137);
          float len = 0.14 + 0.22 * hash(id + 9.7);
          waterGlint = step(abs(fl.y), 0.08) * step(abs(fl.x), len) * step(1.0 - path * 0.55 * _WaterOpt.w, h) * (1.0 - foam);
        }
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
        // (one cull mode, issue #536: a material three draws from behind (BackSide) or from both sides (DoubleSide) is drawn
        // culling back faces as every other, on a mesh whose triangles come again reversed (BridgeSided), so its pipelines are
        // the same; the face the GPU would have called front is told here: never for one shown from behind. For both sides,
        // each triangle is followed by itself reversed, so the one drawn is the original where its primitive's number is even:
        // the GPU's own answer (fragEntry, SIDES_BY_ID). Where the fragment stage has no primitive number (Android, whose
        // Mali GPUs lack it, and OpenGL ES), the vertex normal on the eye's side of the triangle's plane, which is the GPU's
        // answer where the normals agree with the winding (BridgeSided gives that only to such meshes; 3: every one against it))
        if (_Sides > 0.5)
        {
          #if !defined(SIDES_BY_ID)
            float3 sRel = i.worldPos - toThree(_WorldSpaceCameraPos);
            float3 sF = cross(ddx(sRel), ddy(sRel));
            bool sEye = dot(sF, i.normal) * dot(sF, sRel) <= 0.0;
            frontFace = _Sides < 2.5 ? sEye : !sEye;
          #endif
          if (_Sides < 1.5) frontFace = false;
        }
        // (a lighter line from afar: the vertex stage's flag, +4 on the tint's red; materials.js LINE_FAR)
        float lineStepHere = _LineStep;
        UNITY_BRANCH if (_LineFar.w > 0.5 && i.instColor.r > 3.0) { i.instColor.r -= 4.0; lineStepHere = _LineFar.x; }
        #if defined(HIRAETH_VMAT)
          vmColor = float4(i.vm1.xyz, 1); vmColor2 = float4(i.vm2.xyz, 1); vmColor3 = float4(i.vm3.xyz, 1);
          vmStrataSize = i.vm1.w; vmGrid = i.vm2.w; vmFlat = i.vm3.w;
          // (the banners: each one's glyph cells its own grid, per vertex, materials.js S_VGLYPH; else the material's)
          #undef _Glyphs
          vmGlyphs = _VGlyph > 0.5 ? i.vm2.w : _Glyphs;
          #define _Glyphs vmGlyphs
        #endif
        float3 posWS = toThree(i.worldPos);   // (Unity's space, for the shadow maps: the same numbers as the varying it was)
        // (-surface-debug 9: nothing of the shader but its plain colour, normal and view depth, at once: whether a surface that
        // goes missing on the Xbox is drawn at all)
        UNITY_BRANCH if ((_MSurfaceDebug > 8.5 && _MSurfaceDebug < 10.5) || _MSurfaceDebug > 11.5)
        {
          GBufferOut d;
          d.albedoLight = float4(_Color.rgb, 1); d.normalDepth = float4(SafeNormalize(i.normal), i.viewDepth); d.hatch = 0;
          return d;
        }
        int mode = (int)(_Mode + 0.5);
        // glass (the bubble helmet): see-through except at the grazing rim and a curved highlight
        if (GLASSK && _Glass > 0.0 && _MSurfaceDebug < 3.5)
        {
          float3 Vg = normalize(toThree(_WorldSpaceCameraPos) - i.worldPos);
          float fr = 1.0 - abs(dot(normalize(i.normal), Vg));
          float3 od = normalize(i.objPos - _GlassCenter.xyz);
          float streak = step(abs(atan2(od.y, od.x) - 2.2), 0.09) * step(0.25, od.z) * step(od.z, 0.75);
          if (fr < 0.72 && streak < 0.5) discard;
        }
        // a fight temple's wall opening round him when it hides him (materials.js SEE_HOLE): a cone from the eye to his chest, so
        // the hole is a circle on the screen, only what is nearer the eye than he is, its foot kept (SEE_LOOK.foot), its edge a
        // little uneven (SEE_LOOK.wobble). A cut as the glass's: in the full variant and the glass's lean one (BridgeRenderer.Lean)
        UNITY_BRANCH if (GLASSK && _SeeOn > 0.5 && _SeeK.x > 0.001 && _MSurfaceDebug < 3.5)
        {
          float3 sEye = toThree(_WorldSpaceCameraPos), sAx = _See.xyz - sEye, sRel = i.worldPos - sEye;
          float sL = length(sAx), sS = dot(sRel, sAx) / max(sL, 1e-4);
          if (sS > 0.0 && sS < sL - 0.35 && i.worldPos.y > _See.y - 0.80)
          {
            float sR = _See.w * _SeeK.x * sS / sL;
            float sE = length(sRel - sAx * (sS / max(sL, 1e-4))) / max(sR, 1e-4);
            if (sE < 1.0 - 0.08 * vnoise(i.worldPos.xz * 1.7 + i.worldPos.y * 1.3)) discard;
          }
        }
        // the blade's meniscus, its edge wobbling; the shield's, and its back sheet seen through (blade-shader.js BLADE_DISCARD)
        #if defined(FOEK)
          UNITY_BRANCH if (_BladeOn > 0.5)
          {
            bdFold = I_FOLD; bdBind = I_BIND; bdFragCoord = i.positionCS;
            if (_BladeOn > 1.5) bladeCutDisc(); else bladeCutBlade();
          }
        #endif
        // see-through but for its rim (makeMaterial({ veil }): the City-Shaft's air pillars, Lorn II's mushrooms, the Glass
        // Dunes' lenses): where it faces the eye more squarely than the cut, nothing; its body is a wash laid over the
        // finished picture (Hiraeth/Veil). Not in the lean variants (BridgeRenderer.Lean gives a veiled material the full
        // one, as the glass): a discard there, even one never taken, costs every lean surface the GPU's early depth test,
        // the City-Shaft's rim 21 ms of GPU a frame on the Xbox against 14 (issue #263)
        UNITY_BRANCH if (LEANK && _Veil > 0.0 && _MSurfaceDebug < 3.5 && abs(dot(normalize(i.normal), normalize(toThree(_WorldSpaceCameraPos) - i.worldPos))) > _Veil) discard;
        // a makers' box coming apart (boxes/scene.js): eaten from the top down, the edge burning bright
        float dEdge = 0.0;
        if (LEANK && _Dissolve.x > 0.0 && _MSurfaceDebug < 3.5)
        {
          float dh = saturate((i.worldPos.y - _Dissolve.z) / max(_Dissolve.w - _Dissolve.z, 1e-3));
          float dn = vnoise(i.worldPos.xz * 6.0 + i.worldPos.y * 2.3) * 0.42 + vnoise(i.worldPos.zy * 15.0 + 3.1) * 0.18 + (1.0 - dh) * 0.4;
          float dth = _Dissolve.x * 1.15 - 0.08;
          if (dn < dth) discard;
          dEdge = 1.0 - smoothstep(0.0, _Dissolve.y, dn - dth);
        }
        // a splat of the fluid (splat-decal.js splatMaterial): its lumpy blob and drops in its own plane (the form's slot: x, y,
        // born, life; its phase in the fold's), grown and shrunk by its age on the splats' clock; the inner blob in its second
        // tone (the bind's slot). Not in the lean variants (BridgeRenderer.Lean: a splat's material is on the full one)
        float splatInner = 0.0;
        UNITY_BRANCH if (LEANK && _SplatOn > 0.5)
        {
          static const float3 SPLAT_DROPS[5] = { float3(1.42758, 0.00021, 0.15202), float3(-1.08066, 1.06783, 0.19883), float3(0.80030, 0.98156, 0.12455),
            float3(0.43918, -1.24239, 0.18699), float3(-1.29538, 0.05786, 0.13925) };   // (splat-decal.js SPLAT_DROPS; tests/unity-surfaces-b.test.js)
          float2 sp = I_FORM.xy;
          float sAge = _SplatClock.x - I_FORM.z, sK = splatGrowth(sAge, I_FORM.w), sKi = splatGrowth(sAge, I_FORM.w * 0.85);
          float sR = length(sp), sA = sR > 1e-6 ? atan2(sp.y, sp.x) : 0.0, ph = I_FOLD.x;   // (atan2(0, 0) at the very middle: NaN on Metal, and the bloom spreads it over the whole picture, black)
          float sB = 1.0 + 0.32 * (0.5 * sin(sA * 3.0 + ph) + 0.3 * sin(sA * 5.0 + ph * 2.0) + 0.14 * sin(sA * 7.0 + ph * 3.1));
          splatInner = sR < 0.5 * sKi * sB ? 1.0 : 0.0;
          bool sIn = sR < sK * sB;
          for (int si = 0; si < 5; si++) sIn = sIn || length(sp - SPLAT_DROPS[si].xy * sK) < SPLAT_DROPS[si].z * sK * (1.0 + 0.15 * sin(sA * 4.0 + ph));
          if (!sIn && splatInner < 0.5) discard;
        }
        // a falling sheet of water (Fall.hlsl): its slits see-through. Not in the lean variants (BridgeRenderer.Lean "fall")
        FallLook fall = (FallLook)0;
        UNITY_BRANCH if (LEANK && _FallOn > 0.5) { fall = fallLook(I_FORM.xy); if (fall.gap > 0.5) discard; }
        // (each part's coordinates and derivatives are worked out next to it, in uniform control flow, not all at the top:
        // held from there through the colour, the shadow's taps and the lights, they cost every pixel of every surface its
        // registers, and the GPU its waves in flight; the same numbers, issue #262)
        float3 facetO = cross(ddx(i.objRel), ddy(i.objRel));
        float3 on = _Flat > 0.5 ? facetO : i.objNormal;

        // (SafeNormalize: a normal of no length, a mesh's zero normal or a facet's derivatives gone to 0 on a sliver, is 0, not
        // NaN, in the G-buffer; issue #462)
        float3 n = SafeNormalize(i.normal);
        float3 viewT = toThree(_WorldSpaceCameraPos) - i.worldPos;
        if (_Flat > 0.5) {
          float3 rel = i.worldPos - toThree(_WorldSpaceCameraPos);
          n = SafeNormalize(cross(ddx(rel), ddy(rel)));
          if (dot(n, viewT) < 0.0) n = -n;
        }
        #if !defined(HIRAETH_GRASS)
        else if (!frontFace && (_Bind > 0.5 || (_Figure < 0.5 && _Hero < 0.5))) n = -n;
        #endif   // (glTFast's skinned bodies read as back faces; the exported people do not)

        float3 albedo = _Color.rgb;
        // a temple landmark's shell (landmark-materials.js nacre: the Underwater City's nautilus): fine sutures in a log spiral
        // round its centre and the chambers' seams across them, a little darker and in the pen's detail; not on the plain
        // variant (BridgeRenderer.Lean keeps such a material off it). A uniform branch (issue #264)
        float shellInk = 0.0;
        UNITY_BRANCH if (WALLK && _ShellCenter.w > 0.5)
        {
          float2 shellP = (i.worldPos.xy - _ShellCenter.xy) / float2(20.0, 25.0);
          float shellR = length(shellP), shellA = atan2(shellP.y, shellP.x);
          float shellTurn = (shellA + 4.5 * log(max(shellR, 0.045))) / 6.283185;
          float shellCell = (shellA + shellR * 0.8) * 24.0 / 6.283185;
          float shellFw = max(fwidth(shellTurn), 0.0001), cellFw = max(fwidth(shellCell), 0.0001);
          float shellSeam = 1.0 - smoothstep(0.001, 0.001 + shellFw, abs(frac(shellTurn) - 0.5));
          float shellChamber = (1.0 - smoothstep(0.003, 0.003 + cellFw, abs(frac(shellCell) - 0.5))) * smoothstep(0.2, 0.35, shellR);
          shellInk = max(shellSeam, shellChamber * 0.48) * smoothstep(0.04, 0.09, shellR);
          albedo *= 1.0 - shellInk * 0.17;
        }
        // a temple landmark's cut stone (landmark-materials.js stone(): the Rose House's red stone, the towers' cream and ochre):
        // staggered courses of blocks in world metres, a tone a block, a grain and worn veins, the joints a little darker and in
        // the pen's detail, filtered by the pixel's size. The web splices it into its shader's text (no uniform: issue #538);
        // the same arithmetic, a uniform branch, not on the plain variant (BridgeRenderer.Lean)
        float stoneInk = 0.0;
        UNITY_BRANCH if (WALLK && _Stone.w > 0.5)
        {
          float3 stoneN = abs(SafeNormalize(i.normal));
          float2 stoneP = stoneN.y > 0.7 ? i.worldPos.xz : float2(stoneN.x > stoneN.z ? i.worldPos.z : i.worldPos.x, i.worldPos.y);
          float stoneRow = floor(stoneP.y / _Stone.x);
          float stoneOffset = hash(float2(stoneRow, 19.3)) * 0.65;
          float2 stoneQ = stoneP / _Stone.yx + float2(stoneOffset, 0.0);
          float2 stoneCell = floor(stoneQ), stoneF = frac(stoneQ);
          float2 stoneFW = max(fwidth(stoneQ), 0.0001);
          float2 stoneEdge = min(stoneF, 1.0 - stoneF);
          float stoneJoints = max(1.0 - smoothstep(0.006, 0.006 + stoneFW.y, stoneEdge.y), 1.0 - smoothstep(0.004, 0.004 + stoneFW.x, stoneEdge.x));
          stoneJoints *= 1.0 - smoothstep(0.3, 0.8, max(stoneFW.x, stoneFW.y));
          float stoneGrain = vnoise(stoneP * 1.7) - 0.5;
          float stoneTone = (hash(stoneCell + 23.8) - 0.5) * 0.065 + stoneGrain * _Stone.z * 0.08;
          float stoneVein = (1.0 - smoothstep(0.0, 0.035, abs(vnoise(stoneP * 0.23) - 0.48))) * _Stone.z;
          albedo = _Color.rgb * (1.0 + stoneTone - stoneJoints * 0.055 - stoneVein * 0.08);
          stoneInk = stoneJoints * 0.075 + stoneVein * 0.045;
        }
        if (_MapOn > 0.5) albedo *= SAMPLE_TEXTURE2D(_Map, sampler_Map, I_FORM.xy).rgb;   // (materials.js: uColor × the map, as the web's)
        // a temple skin's pattern (HIRAETH_SKIN): where the web's body replaces vec3 albedo = uColor; its pen lines start the
        // surface's detail, its glow its emit (skin-shader.js spliceSkin)
        float skinInk = 0.0, skinEmit = 0.0;
        #if defined(SKINK)
        UNITY_BRANCH if (_SkinBody > 0.5)
        {
          // (a facet's normal from its object's frame, as precise as the web's from vWorldRel: the one from the world's position
          // a few kilometres up wobbles by a thousandth, and the patterns' coordinates along a wall, dot(p, the wall's way), with
          // it: their pixel's size, fwidth, twice the web's, every thin lit line half as bright)
          float3 skinN = n;
          if (_Flat > 0.5) { skinN = SafeNormalize(toThree(TransformObjectToWorldNormal(toThree(facetO)))); if (dot(skinN, viewT) < 0.0) skinN = -skinN; }
          albedo = skinSurface((int)(_SkinBody + 0.5), i.worldPos, i.objPos, i.objNormal, i.skinUV, i.positionCS, skinN, _Color.rgb, skinInk, skinEmit);
        }
        #endif
        float3 instColor = i.instColor;
        if (_PaletteSize > 0.5) {
          float best = 1e9;
          for (int k = 0; k < 12; k++) {
            if (k >= (int)_PaletteSize) break;
            float3 d = i.instColor - _Palette[k].rgb;
            if (dot(d, d) < best) { best = dot(d, d); instColor = _Palette[k].rgb; }
          }
        }
        if (_NightOn > 0.5) instColor = lerp(instColor, I_FORM.rgb, _Night);
        if (_SplatOn > 0.5) instColor = lerp(instColor, I_BIND, splatInner);   // (a splat's inner blob, its second tone)   // (by night its own colour: a billboard lit as a screen)
        float2 bw = 0;
        float slope = 1.0 - n.y;
        if (mode == MODE_TERRAIN) {
          float3 c1 = _Color.rgb, c2 = _Color2.rgb, c3 = _Color3.rgb;
          if (_Biomes > 0.5) { bw = biomeWeights(i.worldPos.xz); biomeGround(bw, c1, c2, c3); }
          float patches = vnoise(i.worldPos.xz * 0.011) * 0.65 + vnoise(i.worldPos.xz * 0.045) * 0.35;
          albedo = patches > 0.6 ? c2 : c1;
          if (slope > 0.42) albedo = c3;
          else if (slope > 0.30 && patches < 0.45) albedo = lerp(c1, c3, 0.5);
          if (_SandInk < 0.5)
          {
            float2 fwp = fwidth(i.worldPos.xz);
            float b = max(blobs(i.worldPos.xz, fwp, 2.2, 0.28, 0.45, 0.0), max(blobs(i.worldPos.xz, fwp, 11.0, 1.3, 0.35, 41.0), blobs(i.worldPos.xz, fwp, 34.0, 3.2, 0.22, 97.0)));
            albedo *= lerp(float3(1, 1, 1), float3(0.945, 0.935, 0.965), b);
          }
        } else if (mode == MODE_STRATA) {
          albedo = strata(_StrataObject > 0.5 ? i.objPos : i.worldPos);   // (in its uniform branch: strata() takes derivatives)
        } else if (mode == MODE_WATER && _WaterOpt.x <= 0.0) {
          float w = vnoise(i.worldPos.xz * 0.012 + _MTime * 0.01);
          albedo = w > 0.55 ? _Color2.rgb : _Color.rgb;
        }
        float waterInk = 0.0, waterLit = 0.0, waterGlow = 0.0;
        UNITY_BRANCH if (WATERK && mode == MODE_WATER && _WaterOpt.x > 0.0) albedo = waterLook(i.worldPos, frontFace, i.positionCS.xy, i.viewDepth, waterInk, waterLit, waterGlow); else if (mode == MODE_OUTFIT) {
          // a person's printed outfit (materials.js MODE_OUTFIT): boots, trousers, belt, tunic, skin at the neck and hands
          albedo = outfitAlbedo(I_BIND, _Color.rgb, _Color2.rgb, _Color3.rgb);
        } else if (mode == MODE_EYE) {
          albedo = eyeball(I_BIND, _Color.rgb, _Color2.rgb, _Skin.rgb);
        }
        // the wall's own frame for weathering, pen detail and colour patches (materials.js): along it and up, world-anchored
        float2 wqA = float2(i.worldPos.x, i.worldPos.y), wqB = float2(i.worldPos.z, i.worldPos.y);
        float wfy = length(float2(ddx(i.worldPos.y), ddy(i.worldPos.y)));
        float2 wfqA = float2(length(float2(ddx(i.worldPos.x), ddy(i.worldPos.x))), wfy), wfqB = float2(length(float2(ddx(i.worldPos.z), ddy(i.worldPos.z))), wfy);
        // colour across a wall (materials.js PATCH): big flat patches, each building its own; none far off
        int skip = (int)(_MSurfaceSkip + 0.5);
        UNITY_BRANCH if (WALLK && _Patch > 0.0 && i.viewDepth < 380.0 && (skip & 8) == 0)
        {
          float pk = 1.0 - smoothstep(260.0, 380.0, i.viewDepth);
          float3 dP = albedo * (wallPatch(i.worldPos, SafeNormalize(i.normal), _Patch, float3(wfqA.x, wfy, wfqB.x)) - 1.0);
          albedo += dP * min(1.0, 0.15 / max(length(dP), 1e-5)) * pk;
        }
        float patInk = 0.0;
        float emit = max(skinEmit, waterGlow);   // lit windows at night (facade); a skin's glow; what glows in the water (Lorn's veins)
        if (_NightOn > 0.5) emit = I_FORM.w * _Night;   // (a billboard glowing, as far as it says, after dark: NIGHT_PAINT)
        int pattern = (int)(_Pattern + 0.5);
        // (the material's options are uniform over a draw: derivatives inside these branches are safe)
        if ((skip & 1) != 0 || !WALLK) pattern = 0;
        UNITY_BRANCH if (pattern == 1) patInk = facadeMarks(i.worldPos, n, SafeNormalize(i.normal), albedo, emit);
        else if (pattern == 2) patInk = roofTiles(i.worldPos);
        else if (pattern == 3) patInk = leaves(i.objPos);
        else if (pattern == 4) patInk = rockCracks(i.objPos);
        // weathering (materials.js weatherInk): the odd hairline crack on upright faces
        UNITY_BRANCH if (WALLK && _Weather > 0.0 && abs(n.y) < 0.55 && (skip & 2) == 0)
        {
          float2 wCell = floor(i.worldPos.xz / 9.0);
          float wSeed = floor(hash(wCell + 7.0) * 61.0), wK = _Weather * (0.6 + 0.8 * hash(wCell + 3.0)) * step(hash(wCell + 19.0), 0.8);   // (some buildings none: WEATHER.walls)
          float wUp = 1.0 - smoothstep(0.35, 0.55, abs(n.y));
          float ax = abs(n.x), az = abs(n.z), wb = smoothstep(0.36, 0.64, ax / max(ax + az, 1e-4));
          float litK = smoothstep(0.02, 0.15, dot(n, _SunDir));
          float wi = 0.0;
          // (the world's step for a metre along the wall in each frame, held off edge-on; a facade's windows kept clear)
          float3 wT = normalize(float3(-n.z, 0.0, n.x) + float3(1e-5, 0.0, 0.0)), wNv = SafeNormalize(i.normal);
          bool wFacade = pattern == 1;
          if (wb < 0.999)
          {
            float3 aA = albedo;
            wi = weatherInk(wqA, wfqA, float2(_SunDir.x, _SunDir.y), litK, wSeed, wK, i.worldPos, wT / (abs(wT.x) < 0.3 ? 0.3 * sign(wT.x + 1e-6) : wT.x), wNv, wFacade, _Windows, aA) * (1.0 - wb);
            albedo = lerp(albedo, aA, (1.0 - wb) * wUp);
          }
          if (wb > 0.001)
          {
            float3 aB = albedo;
            wi = max(wi, weatherInk(wqB, wfqB, float2(_SunDir.z, _SunDir.y), litK, wSeed + 13.0, wK, i.worldPos, wT / (abs(wT.z) < 0.3 ? 0.3 * sign(wT.z + 1e-6) : wT.z), wNv, wFacade, _Windows, aB) * wb);
            albedo = lerp(albedo, aB, wb * wUp);
          }
          patInk = max(patInk, wi * wUp);
        }
        // pen detail at every scale (materials.js DETAIL): built seams, joints, vents, bolts; organic grain
        float dFar = _Detail.x > 1.5 ? 130.0 : 260.0;
        UNITY_BRANCH if (WALLK && _Detail.x > 0.5 && abs(n.y) < 0.75 && i.viewDepth < dFar && (skip & 4) == 0)
        {
          float dUp = (1.0 - smoothstep(0.55, 0.75, abs(n.y))) * (1.0 - smoothstep(dFar * 0.7, dFar, i.viewDepth));
          bool facingX = abs(n.x) > abs(n.z);
          float dSeed = floor(hash(floor(i.worldPos.xz / 9.0) + 11.0) * 53.0) + (facingX ? 29.0 : 0.0);
          float di = detailLod(facingX ? wqB : wqA, facingX ? wfqB : wfqA, _Detail.y, dSeed, _Detail.x > 1.5);
          patInk = max(patInk, di * dUp * 1.35);
        }
        if (LEANK && _Fluid > 0.5) albedo = fluidAlbedo(albedo, I_BIND, I_FOLD, SafeNormalize(i.normal), normalize(toThree(_WorldSpaceCameraPos) - i.worldPos), i.worldPos, _Glow);
        // the fluid sword's living blade, the guard's shield: their currents (blade-shader.js bladeFluid, fluid kind 6)
        #if defined(FOEK)
          UNITY_BRANCH if (_BladeOn > 0.5)
          {
            bdFold = I_FOLD; bdBind = I_BIND;
            if (_BladeOn > 1.5) albedo = bladeFluidDisc(_FluidA.z); else albedo = bladeFluidBlade(_FluidA.z);
          }
        #endif
        albedo *= instColor;
        // a foe's painted patterns and its glow (HIRAETH_FIGHT: foe-surface.js foeSurface, where the web calls it)
        #if defined(FOEK)
          fsObjPos = i.objPos; fsObjNormal = i.objNormal; fsWorldPos = i.worldPos; fsNormal = i.normal; fsFront = frontFace;
          patInk = max(patInk, foeSurface(albedo, emit, n));
        #endif
        // (linear colours, the coral-shirt traveller's: to the game's display values, as tripo-material.js does)
        if (_Lining.w > 0.5 && !frontFace) albedo = _Lining.rgb;   // (the overshirt's lining: tripo-material.js)
        if (_ToDisplay > 0.5) albedo = lerp(albedo * 12.92, 1.055 * pow(max(albedo, 0.0), 1.0 / 2.4) - 0.055, step(0.0031308, albedo));
        // the coral-shirt traveller's drawn face (tripo-face.js, generated: TripoFace.hlsl), after his colours are display values
        UNITY_BRANCH if (LEANK && _TripoFace > 0.5)
        {
          float tfAA = max(fwidth(I_BIND.x) + fwidth(I_BIND.y), 1e-6) * 0.75;   // (the drawn face's pixel, in its bind space)
          // (2: the portrait head's blink and mouth, PortraitFace.hlsl)
          albedo = _TripoFace > 1.5 ? portraitFace(albedo, I_BIND) : tripoFace(albedo, I_BIND, tfAA);
        }
        #if defined(HIRAETH_GRASS)
          // further off, the ground's own tone under the tuft (its patches, as the terrain draws them)
          if (i.grassLook.z > 0.0)
          {
            float gpat = vnoise(i.worldPos.xz * 0.011) * 0.65 + vnoise(i.worldPos.xz * 0.045) * 0.35;
            albedo = lerp(albedo, gpat > 0.6 ? _Color2.rgb : _Color.rgb, i.grassLook.z);
          }
        #endif
        // a dark cap's underside: its veins drawn lighter, radiating from the stalk, as branches (materials.js FORM.veins)
        UNITY_BRANCH if (LEANK && _Veins > 0.0 && _FormHatch > 0.0)
        {
          float3 formDx = ddx(I_FORM.xyz), formDy = ddy(I_FORM.xyz);
          if (I_FORM.w > 0.5 && I_FORM.w < 1.5)
          {
          const float K = 162.9747;
          float r2 = max(dot(I_FORM.xy, I_FORM.xy), 1e-8);
          float fwT = (abs(I_FORM.x * formDx.y - I_FORM.y * formDx.x) + abs(I_FORM.x * formDy.y - I_FORM.y * formDy.x)) / r2 * K;
          float vein = veinLines(atan2(I_FORM.y, I_FORM.x) * K, fwT, _HatchSpacing * 2.2, 1.5, float2(sqrt(r2) * 0.5, 9.0), i.viewDepth);
          albedo += min(albedo * 1.2, 0.15) * vein * _Veins;
          }
        }
        // a makers' chest: the star painted on, a ray of light travelling across it, a vertex colour over 1 a light (materials.js MAKERS_BOX)
        UNITY_BRANCH if (LEANK && _BoxOn > 0.5)
        {
          float3 bp = i.objPos - float3(0.0, _BoxB.w, 0.0);
          float mark = boxMarks(i.objPos, i.objNormal, _BoxA);
          float3 ray = boxRay(bp, _BoxA, _BoxB);
          albedo *= lerp(0.72, 1.1, smoothstep(-0.7, 0.85, i.objNormal.y / max(length(i.objNormal), 1e-4)));
          float over = max(max(i.instColor.r, i.instColor.g), i.instColor.b) - 1.0;
          if (over > 0.0) { albedo /= 1.0 + over; emit = max(emit, min(over, 1.0) * (0.4 + 0.6 * _BoxA.y)); }
          albedo = lerp(albedo, _BoxMark.rgb, mark);
          albedo = lerp(albedo, _BoxLight.rgb, saturate(ray.x + 0.45 * ray.y + 0.25 * ray.z));
          emit = max(emit, mark * _BoxA.y);
          emit = max(emit, max(ray.x * 0.97, max(ray.y * 0.75, ray.z * 0.4)));
        }
        float plateInk = 0.0;
        UNITY_BRANCH if (_Plates > 0.5 && _Grid > 0.0)
        {
          float plateTone;
          float3 pq = i.objPos / max(_Grid, 1e-3), pfw = fwidth(pq), pw = pow(abs(SafeNormalize(on)), 6.0); pw /= max(pw.x + pw.y + pw.z, 1e-6);
          plateInk = plateLines(pq, pfw, pw, plateTone);
          albedo *= 1.0 + 0.09 * plateTone;
        }
        #if defined(HIRAETH_CROWD)
        if (i.crowdTrim.w > 0.5) albedo = outfitTrim(albedo, i.crowdTrim.rgb, i.crowdTrim.w, I_BIND);
        #endif
        if (_Folds > 0.0) albedo = (I_FOLD.y < 0.62 ? _Color.rgb : _Color2.rgb) * i.instColor;

        float ndl = dot(n, _SunDir);
        // a flat facet edge-on to the sun goes to shade, whole (materials.js FACET_EDGE)
        if (_Flat > 0.5 && ndl < 0.03) ndl = min(ndl, -0.03);
        float lambert = ndl * 0.5 + 0.5;
        float sh = 1.0;
        float shadowPx = max(length(ddx(posWS)), length(ddy(posWS)));   // (outside the branch: derivatives)
        float nTurn = length(fwidth(n));
        // (the lit fraction steepened about its half, materials.js SHADOW_CUT: the toon threshold cuts at the shadow's true edge)
        if (ndl > 0.0 && (skip & 32) == 0) sh = saturate((getShadow(posWS, toThree(n), ndl, shadowPx) - 0.5) * 3.0 + 0.5) * cloudShadow(i.worldPos);
        // a big curved surface turning from the sun: its terminator is the light's own (TERMINATOR, TERMINATOR_TURN)
        if (mode != MODE_TERRAIN && _Flat < 0.5)
          sh = lerp(sh, lerp(1.0, sh, smoothstep(0.0, 0.08, ndl)), 1.0 - smoothstep(0.02, 0.06, nTurn));
        float L = lerp(min(lambert, 0.38), lambert, sh);
        // a room in a hull (materials.js ROOM_LIGHT, issue #338): its own soft key from the windows in place of the sun, the
        // key-lit faces a little of the sky's colour (the web's numbers; the web also lowers the key at night)
        UNITY_BRANCH if (_Room.w > 0.0)
        {
          float roomKey = smoothstep(-0.1, 0.6, dot(normalize(i.objNormal), _Room.xyz));
          L = lerp(L, lerp(0.28, 0.74, roomKey), _Room.w);
          albedo *= lerp(float3(1, 1, 1), 0.72 + 0.4 * lerp(_SkyHorizon, _SkyTop, 0.35), 0.22 * roomKey * _Room.w);
        }
        L = lerp(L, 1.0, max(_Glow, emit));
        // the Glass Dunes' glass as the plates print it, and the light come through it pooled on the sand (src/dune-glass-shader.js)
        UNITY_BRANCH if (_DuneOn > 0.5)
        {
          float4 G = I_FORM;
          float dSun = smoothstep(-0.02, 0.1, _SunDir.y) * (1.0 - _Night);
          if (_DuneOn < 1.5)
          {
            float3 dv = normalize(toThree(_WorldSpaceCameraPos) - i.worldPos);
            float rim = 1.0 - abs(dot(n, dv));
            rim *= rim * step(G.w, 1.5);
            float back = saturate(dot(-dv, _SunDir) * 0.5 + 0.5);
            float shadeD = 1.0 - step(_Toon, L);
            float fwx = max(fwidth(G.x), 1e-4);
            float sil = 1.0 - smoothstep(-fwx, fwx, G.x);
            float through = (G.y * (0.6 + 0.55 * back) + rim * _DuneMint.a * (0.25 + 0.95 * back)) * dSun * (0.55 + 0.6 * shadeD);
            through = max(through, G.y * _DuneLime.a * _Night);
            through *= 1.0 - sil;
            float fwt = max(fwidth(through), 1e-4), fwz = max(fwidth(G.z), 1e-4), fwn = max(fwidth(ndl), 1e-4);
            float b1 = smoothstep(_DuneK.x - fwt, _DuneK.x + fwt, through), b2 = smoothstep(_DuneK.y - fwt, _DuneK.y + fwt, through);
            float deep = max(smoothstep(0.38 - fwn, 0.38 + fwn, -ndl), smoothstep(G.z - fwz, G.z + fwz, 0.22)) * shadeD * (1.0 - b1);
            albedo *= lerp(1.0, _DuneK.z, deep);
            albedo = lerp(albedo, _DuneSil.rgb * (0.85 + 0.3 * min(G.w, 1.0)), sil);
            float streak = smoothstep(0.9 - fwz, 0.9 + fwz, G.z) * (1.0 - sil) * (1.0 - b1) * smoothstep(0.1, 0.5, G.w) * step(G.w, 1.5);
            albedo = lerp(albedo, lerp(albedo, _DuneMint.rgb, 0.6) * 1.12, streak * (0.55 + 0.45 * shadeD));
            albedo = lerp(albedo, lerp(albedo, _DuneMint.rgb, 0.75), b1);
            albedo = lerp(albedo, _DuneLime.rgb, b2);
            L = lerp(L, max(L, _Toon + 0.08), b1);
            L = lerp(L, max(L, 0.92), b2);
            emit = max(emit, 0.3 * b1 + 0.2 * b2);
          }
          else
          {
            float2 to = G.yz, s2 = _SunDir.xz / max(length(_SunDir.xz), 1e-3);
            float behind = smoothstep(-0.15, 0.55, dot(to, s2) / max(length(to), 1e-3));
            float low = 1.0 - 0.45 * smoothstep(0.3, 0.9, _SunDir.y);
            float pool = G.x * (behind * low + (1.0 - behind) * _DuneMint.a) * dSun;
            float fwp = max(fwidth(pool), 1e-4);
            float b1 = smoothstep(_DuneK.x - fwp, _DuneK.x + fwp, pool), b2 = smoothstep(_DuneK.y - fwp, _DuneK.y + fwp, pool);
            albedo = lerp(albedo, _DuneMint.rgb, b1 * 0.7);
            albedo = lerp(albedo, _DuneLime.rgb, b2 * 0.85);
            L = lerp(L, max(L, _Toon + 0.06), b2);
            L = lerp(L, max(L, _Toon - 0.04), b1 * (1.0 - b2));
          }
        }
        if (LEANK && _Fluid > 0.5 && _FluidA.w < 0.5) L = max(L, 0.92);   // (the round backpack's nebula is lit from within: no shade side on it)
        #if defined(FOEK)
          // (crystal-shader.js chimeCrystal: the chimes' facets by the live sun, their seam, edges, inner glow and lines, rim, sparkle)
          UNITY_BRANCH if (_CrystalOn > 0.5)
          {
            crCrystal = I_FORM; crBeat = I_FOLD.x; crGlow = 0.0; crWorldRel = i.worldPos - toThree(_WorldSpaceCameraPos);
            crObjRel = i.objRel; crObjPos = i.objPos; crObjNormal = i.objNormal;
            chimeCrystal(albedo, L, emit, n);
          }
          foeGloss(albedo, L, n);   // (foe-surface.js: a foe's crisp highlight, once the light is known)
          // (blade-shader.js bladeLight: the blade's rim, the sun's flecks on its ripples, its breathing glow, always lit)
          UNITY_BRANCH if (_BladeOn > 0.5) { bdWorldRel = i.worldPos - toThree(_WorldSpaceCameraPos); bladeLight(albedo, L, emit, n); }
        #endif
        float local = 0.0;
        // (the lights come nearest first, the unused after them with no radius (HiraethLook): the loop stops at the first of
        // those, a uniform branch, instead of measuring all eight from every pixel, issue #262)
        for (int li = 0; li < ((skip & 64) != 0 ? 0 : 8); li++) {
          UNITY_BRANCH if (_MLights[li].w <= 0.0) break;
          float3 dl = _MLights[li].xyz - i.worldPos;
          float d = length(dl);
          if (d < _MLights[li].w) {
            float att = pow(1.0 - d / _MLights[li].w, 2.0);
            // (a room's lamps hang in shades, ROOM_LIGHT: what is under them and faces them)
            local = max(local, att * (_Room.w > 0.0 ? smoothstep(0.25, 0.75, dl.y / d) * (0.12 + 0.88 * max(dot(n, dl / d), 0.0)) : 0.35 + 0.65 * max(dot(n, dl / d), 0.0)));
          }
        }
        // the makers' carved inscriptions (src/glyphs.js, materials.js carve): on upright faces in cells of _Glyphs metres, the
        // groove's shadowed side dropped into the shadow tone, its lit lip a shade lighter, a fine outline round the cut
        float3 carve = 0.0;
        UNITY_BRANCH if (_Glyphs > 0.0)
        {
          float3 gg = i.objPos / max(_Glyphs, 1e-3), ggfw = fwidth(gg), cw = pow(abs(SafeNormalize(on)), 6.0); cw /= max(cw.x + cw.y + cw.z, 1e-6);
          if (cw.y < 0.5) carve = glyphCarve(cw.x > cw.z ? gg.zy : gg.xy, cw.x > cw.z ? ggfw.zy : ggfw.xy);
          L = lerp(L, min(L, _Toon - 0.14), carve.y);
          albedo *= 1.0 + 0.05 * (carve.x - carve.y);
        }
        L = max(L, _Room.w > 0.0 ? lerp(L, 0.95, smoothstep(0.06, 0.6, local)) : lerp(L, 0.97, smoothstep(0.15, 0.5, local)));
        // a lamp's pool in its own colour (materials.js LAMP_TINT: the lamp-lit worlds' street lamps, its share dimmed by day)
        albedo = lerp(albedo, _LampTint.rgb * lerp(0.55, 1.0, dot(albedo, float3(0.3, 0.55, 0.15))), _LampTint.a * _LampsOn * smoothstep(0.08, 0.55, local));
        if (mode == MODE_WATER && _WaterOpt.x > 0.0) L = lerp(L, max(L, 0.8), waterLit);
        float metalInk = 0.0;
        UNITY_BRANCH if (_Metal.w > 0.0)
        {
          float3 metalT = normalize(toThree(TransformObjectToWorldDir(toThree(_BrushAxis.xyz))));
          albedo = metalAlbedo(albedo, n, ndl > 0.0 ? smoothstep(0.4, 0.6, sh) : 0.0, i.worldPos, i.objPos, i.objNormal, metalT, metalInk);
        }

        albedo = lerp(albedo, _DissolveColor.rgb, dEdge);
        L = lerp(L, 1.0, dEdge);
        if (LEANK && _FallOn > 0.5) { albedo = fall.albedo; L = 1.0; }   // (the sheet is its own light: materials.js FALL)
        GBufferOut o;
        o.albedoLight = float4(albedo, saturate(L) + 2.0 * lineStepHere);   // (the line's weight and colour over it: materials.js LINE, LINE_FAR)
        if (_LineWhite.x > 0.5) o.albedoLight.a = -1.0 - o.albedoLight.a;   // (a white line, uLineWhite: the sign bit, Composite 1b)
        o.normalDepth = float4(n, _FarDepth.x > 0 && i.viewDepth > _FarDepth.x ? _FarDepth.x + (i.viewDepth - _FarDepth.x) * _FarDepth.y : i.viewDepth);
        o.hatch = 0;
        // (the water marks itself by its normal's length, its glints on top: water-shader.js WATER_MARK, read by WaterOver.shader)
        if (WATERK && mode == MODE_WATER && _WaterOpt.x > 0.0 && frontFace && _WaterOpt.y < 0.5) o.normalDepth.xyz *= 1.012 + 0.05 * waterGlint;

        // drawn detail (gHatch.b)
        float detail = max(max(skinInk, shellInk * 0.13), stoneInk);
        // (the grid's and the glyphs' coordinates only on a material that draws either: a uniform branch, its derivatives
        // fine there, issue #262)
        UNITY_BRANCH if (_Grid > 0.0)
        {
          float3 gq = i.objPos / max(_Grid, 1e-3), gfw = fwidth(gq), gw = pow(abs(SafeNormalize(on)), 6.0); gw /= max(gw.x + gw.y + gw.z, 1e-6);
          if (_Grid > 0.0) detail = _Plates > 0.5 ? plateInk : gridLines(gq, gfw, gw);
        }
        detail = max(detail, carve.z * 0.62);   // (the carved inscriptions' outline: above)
        float2 gp = i.worldPos.xz;
        UNITY_BRANCH if (TERRAINK && mode == MODE_TERRAIN && (skip & 128) == 0) {
          float gm = max(length(ddx(gp)), length(ddy(gp)));
          float sandK = 1.0 - bw.y;
          // (each mark worked out only where the ground draws it, in its material's uniform branch (derivatives fine
          // there), as the web compiles S_RIPPLES, S_BIOMES, S_TICKS and S_SANDINK: before, every ground pixel paid for
          // all four, #262)
          UNITY_BRANCH if (_Ripples > 0.5) {
            detail = max(detail, sandRipples(gp, slope) * sandK);
            // grains close up; in the print look its pebbles and stones instead (ground-ink.js PEBBLES): a dark side, a cast shadow
            float grains = _Dots > 0.0 ? 0.0 : sandGrains(gp, gm, 0.25, 0.12, 0.005, 0.01, 71.0) * 0.55;
            detail = max(detail, grains * sandK * (1.0 - smoothstep(0.35, 0.6, slope)));
            if (_Dots > 0.0)
            {
              float2 s2 = _SunDir.xz / max(length(_SunDir.xz), 1e-3);
              float len = pebbleShadow(_SunDir.y), castK = smoothstep(_Toon - 0.02, _Toon + 0.12, L);
              float pk = smoothstep(0.35, 0.7, vnoise(gp * 0.04 + 23.0));
              float peb = max(max(pebbleField(gp, gm, s2, len, castK, 0.32, 0.22, float2(0.009, 0.024), 71.0),
                                  pebbleField(gp, gm, s2, len, castK, 0.9, 0.32 * pk, float2(0.022, 0.07), 13.0)),
                                  pebbleField(gp, gm, s2, len, castK, 6.0, 0.16, float2(0.12, 0.42), 57.0));
              detail = max(detail, peb * _Dots * sandK * (1.0 - smoothstep(0.35, 0.6, slope)));
            }
          }
          UNITY_BRANCH if (_Biomes > 0.5) {
            float2 q1 = crackCoord(gp, 5.5), q2 = crackCoord(gp + 31.0, 1.6);
            float4 j1 = float4(ddx(q1), ddy(q1)), j2 = float4(ddx(q2), ddy(q2));
            float k = smoothstep(0.3, 0.8, bw.y) * (1.0 - smoothstep(0.14, 0.22, slope));
            if (k > 0.0) detail = max(detail, mudCracks(gp, q1, j1, q2, j2) * k);
          }
          float2 fwp = fwidth(gp);
          if (_Ticks > 0.5 && slope < 0.35) detail = max(detail, grassTicks(gp, fwp) * 0.8);
          UNITY_BRANCH if (_SandInk > 0.5) detail = max(detail, sandScuffs(gp) * (1.0 - bw.y));
        } else if (mode == MODE_WATER) {
          detail = max(detail, _WaterOpt.x > 0.0 ? waterInk : waterLines(gp, _MTime) * 0.7);
        } else if (mode == MODE_STRATA) {
          float faceX = abs(on.x) > abs(on.z) ? i.objPos.z : i.objPos.x;
          float fissFw = fwidth(faceX) / 9.0;
          if (abs(SafeNormalize(on).y) < 0.6)
          {
            detail = max(detail, fissures(float2(faceX, i.objPos.y), fissFw) * 0.85);
            if (_Cracks > 0.0) detail = max(detail, faceCracks(float2(faceX, i.objPos.y), fissFw * 9.0, _Cracks) * 1.7);   // (over 1: a pen line)
          }
        }
        UNITY_BRANCH if (SCRUBK && _Scrub > 0.0) {
          float2 sc = strokeCoord(i.objPos, strokeWeights(on, mode), float2(0.766, 0.643));
          float sfw = fwidth(sc.x);
          float dashN = smoothstep(0.42, 0.6, vnoise(float2(sc.x * 2.5, sc.y * 9.0)));
          float dk0 = clamp((_Toon - L) / _Toon, 0.0, 1.0);
          detail = max(detail, strokes(sc, sfw, lerp(6.0, 3.5, dk0), lerp(0.8, 1.3, dk0)) * dashN * (0.6 + 0.4 * dk0));
        }
        if (_Folds > 0.0) {
          float foldU = I_FOLD.x * _Folds;
          float foldFw = fwidth(foldU);
          float colI = floor(foldU + 0.5);
          float d = abs(foldU - colI) / max(foldFw, 1e-5);
          float h1 = hash(float2(colI, 3.1)), h2 = hash(float2(colI, 8.7));
          float run = smoothstep(0.08 + h1 * 0.25, 0.14 + h1 * 0.25, I_FOLD.y) * (1.0 - smoothstep(0.75 + h2 * 0.25, 0.8 + h2 * 0.25, I_FOLD.y));
          detail = max(detail, inkLine(d, lerp(1.3, 0.7, I_FOLD.y)) * run * step(0.25, h2 + 0.3));
        }
        // the people: the suit's creases (creases.js) and the face (materials.js faceInk)
        if (_Creases > 0.0) detail = max(detail, outfitCreases(I_BIND, SafeNormalize(i.objNormal), clamp((_Toon - L) / _Toon, 0.0, 1.0)));
        if (mode == MODE_OUTFIT)
        {
          float fwBind = max(fwidth(I_BIND.y), fwidth(I_BIND.x));
          if (I_BIND.y > _Outfit.z && abs(I_BIND.x) < 0.16)
          {
            float frontal = smoothstep(0.15, 0.45, SafeNormalize(i.objNormal).z);
            detail = max(detail, 2.0 * faceInk(float2(abs(I_BIND.x), I_BIND.y - _Face.x), fwBind, frontal, I_BIND.x));   // (over 1: a pen line, darker)
          }
        }
        detail = max(detail, patInk);
        detail = max(detail, metalInk);
        detail = max(detail, fall.ink);   // (a fall's pen streaks)
        // (packed over the detail: the material's spot-black step x4, weathered +16; materials.js SPOT, WEATHER)
        o.hatch.b = detail + 4.0 * _SpotStep + (_Weather > 0.0 ? 16.0 : 0.0);
        bool facePart = mode == MODE_EYE || (mode == MODE_OUTFIT && I_BIND.y > _Outfit.z && abs(I_BIND.x) < 0.16);
        // gHatch.a: glow + 2 hero + 4 figure (+ 8 soft ink) + 16 a face + 32 banked sand (post.js)
        o.hatch.a = max(max(max(_Glow, emit), smoothstep(0.15, 0.6, local) * 0.6), dEdge) + 2.0 * _Hero + 4.0 * _Figure + (facePart ? 16.0 : 0.0) + 32.0 * _Drift + 64.0 * _SurfD.w;   // (+64 a mover, uMover: Composite's crease shading sees past it)
        #if defined(FOEK)
          if (_BladeOn > 0.5) { o.hatch.rgb = float3(_BladeC.w, 0, 0); o.hatch.a += 8.0; return o; }   // (the blade, the shield: its outline only, half pen)
          if (_CrystalOn > 0.5) { o.hatch.rgb = float3(_SkinData[2].a, 0, 0); o.hatch.a += 8.0; return o; }   // (a crystal: its outline only, no line between its facets)
        #endif
        if (_BoxOn > 0.5) { o.hatch.rgb = float3(1, 0, 0); o.hatch.a += 8.0; return o; }   // (a box with no edges: its outline only)
        if (LEANK && _Fluid > 0.5 && _FluidA.w < 0.5) { o.hatch.rgb = float3(1, 0, 0); o.hatch.a += 8.0; return o; }   // (the round backpack's glass: its outline only, a full pen line, no hatching)
        #if defined(HIRAETH_GRASS)
          // blades: no hatching, no drawn detail; soft ink (r its pen line's share, g its outline's fade with distance)
          o.hatch.rgb = float3(i.grassLook.x, i.grassLook.y, 0.0); o.hatch.a += 8.0;
          return o;
        #endif

        // the strokes' coordinates and footprints, worked out here where the hatching draws them (uniform control flow)
        float3 tw = strokeWeights(on, mode);
        float2 ce1 = strokeCoord(i.objPos, tw, float2(0.766, 0.643));
        float2 ce2 = strokeCoord(i.objPos, tw, float2(0.83, -0.56));
        float fw1 = fwidth(ce1.x), fw2 = fwidth(ce2.x);
        float2 ceY = float2(i.objPos.y, dot(i.objPos.xz, float2(0.7071, 0.7071)));
        float fwY = fwidth(i.objPos.y);
        float2 fwd = float2(fw1, fwidth(ce1.y));
        float3 formDx = ddx(I_FORM.xyz), formDy = ddy(I_FORM.xyz);
        // hatching in the shade (finer close to the camera, coarser far away)
        float dark0 = clamp((_Toon - L) / _Toon, 0.0, 1.0);
        // (a hatch over 1 is a denser one, a hatched mass: closer strokes, heavier; materials.js HATCH_DENSE)
        float hDense = max(_Shade.z, 1.0);
        float hsp0 = _HatchSpacing * lerp(0.78, 1.4, smoothstep(6.0, 260.0, i.viewDepth));
        float hsp = max(max(hsp0 / min(hDense, 1.3), min(hsp0, 4.5)), _SurfD.x);   // (never closer than a pen can draw: HATCH_DENSE.minPx; a room's least, uHatchPx)
        float dark = min(dark0 * (1.0 + (hDense - 1.0) * 0.9), 1.0);
        // (each pen's strokes worked out in the branch that draws them, as the web does: strokes() and stipple() take no
        // derivatives (their footprints come in from above), so a pixel in the light, or one stippled, pays for none of
        // the others' noise, #262)
        if ((skip & 16) != 0) {
        } else if (dark > 0.0 && _HatchOn > 0.0 && _ShadeStyle > 0.5) {
          o.hatch.r = stipple(ce1, fwd, hsp * 1.15, dark) * smoothstep(0.02, 0.15, dark);
        } else if (dark > 0.0 && _HatchOn > 0.0 && I_FORM.w > 0.5 && _FormHatch > 0.0) {
          o.hatch.rg = formHatch(I_FORM, formDx, formDy, hsp, dark, i.viewDepth);   // strokes radiating from its axis or wrapping round it
        } else if (dark > 0.0 && _HatchOn > 0.0) {
          float h1 = strokes(ce1, fw1, hsp, lerp(0.9, 2.2, dark)) * smoothstep(0.02, 0.12, dark);
          if (_FormHatch > 0.0 && mode == MODE_TERRAIN) h1 = lerp(h1, strokes(ceY, fwY, hsp, lerp(0.9, 2.2, dark)) * smoothstep(0.02, 0.12, dark), smoothstep(0.1, 0.3, slope) * _FormHatch);
          float h2 = 0.0;
          if (dark > 0.5)
          {
            bool rings = _FormHatch > 0.0 && _Flat < 0.5 && mode != MODE_TERRAIN;
            h2 = (rings ? strokes(ceY, fwY, hsp * 1.2, lerp(0.6, 1.7, dark)) : strokes(ce2, fw2, hsp * 1.2, lerp(0.6, 1.7, dark))) * smoothstep(0.5, 0.65, dark);
          }
          o.hatch.rg = float2(h1, h2);
        }
        // rock in light keeps runs of strokes along its beds (materials.js strataHatch)
        // (strokes along the beds of rock, the strata's wavy horizontals: only strata rock reads them, worked out in its own
        // uniform branch (its derivatives fine there), as the web compiles them under S_STRATA alone, #262)
        UNITY_BRANCH if (mode == MODE_STRATA && _Shade.w > 0.0)
        {
          float faceX = abs(on.x) > abs(on.z) ? i.objPos.z : i.objPos.x;
          float3 strataP = _StrataObject > 0.5 ? i.objPos : i.worldPos;
          float2 strataCo = float2(strataP.y + (vnoise(strataP.xz * 0.04) - 0.5) * _StrataSize * 0.9 + (vnoise(float2(faceX * 0.05, strataP.y * 0.1)) - 0.5) * 1.6, faceX);
          float strataFw = fwidth(strataCo.x);
          if (L >= _Toon && i.viewDepth < 700.0 && abs(SafeNormalize(on).y) < 0.7)
          {
          float upright = 1.0 - smoothstep(0.45, 0.7, abs(SafeNormalize(on).y));
          float runs = smoothstep(0.42, 0.66, vnoise(float2(strataCo.y * 0.09, strataCo.x * 0.55)));
          o.hatch.r = max(o.hatch.r, strokes(strataCo, strataFw, hsp * 1.25, 0.85) * runs * upright * _Shade.w);
          }
        }
        if (facePart) o.hatch.rg = 0;
        // the shade's tone (materials.js SHADE), packed over the strokes: the material's lift, the half-tone of a form
        // turned from the sun, the ground's light on faces turned down; the hue it keeps or its own flat print
        if (L < _Toon && (skip & 256) == 0)
        {
          float turned = ndl < 0.0 ? (ndl > -0.42 ? 1.0 : 0.6) : 0.0;
          // (no half-tone inside another's cast shadow; built walls only: a cliff's own body would read as another's)
          if (turned > 0.0 && _Halftone > 0.0 && _SunDir.y > 0.0 && mode != MODE_STRATA && mode != MODE_TERRAIN && abs(n.y) < 0.5) turned *= 1.0 - castBeyond(posWS);
          float lift = 1.0 - (1.0 - _Shade.x) * (1.0 - _Halftone * turned) * (1.0 - _Bounce * smoothstep(-0.1, -0.7, n.y));
          float hatchK = mode == MODE_TERRAIN ? lerp(min(_Shade.z, 1.0), 1.0, smoothstep(0.16, 0.36, slope)) : min(_Shade.z, 1.0);
          float liftK = lift;
          if (I_FORM.w > 0.5) liftK *= 1.0 - (I_FORM.w > 1.5 ? 0.2 : 0.45);   // (a cap's fan stays dense under a lifted shade)
          liftK /= hDense * hDense;
          o.hatch.rg *= hatchK * float2(1.0 - 0.8 * liftK, max(1.0 - 2.5 * liftK, 0.0));
          float hq = _Shade.y < 0.0 ? 0.0 : _Shade.y >= 2.0 ? 10.0 + floor((_Shade.y - 2.0) * 5.0 + 0.5) : 1.0 + floor(_Shade.y * 8.0 + 0.5);
          o.hatch.rg = min(o.hatch.rg, float2(1, 1)) + 2.0 * float2(hq, floor(saturate(lift) * 15.0 + 0.5));
        }
        // (a test for the Xbox's see-through picture, BridgeRunner -surface-debug N: 1 the material's plain colour, no strokes;
        // 2 every normal up; 3 both; from 4 the glass and the dissolve never discard, and the albedo shows what the GPU reads
        // of the rare paths' values: 4 (glass, dissolve, fluid), 5 (veins, box, scrub), 6 (drawn face, mode / 4, water); 7 a temple
        // skin's glow, pen lines and pattern (its number / 128))
        if (_MSurfaceDebug > 0.5 && _MSurfaceDebug < 8.5)
        {
          int sd = (int)(_MSurfaceDebug + 0.5);
          if (sd < 4)
          {
            if (sd & 1) { o.albedoLight = float4(_Color.rgb, 1); o.hatch = 0; }
            if (sd & 2) o.normalDepth.xyz = float3(0, 1, 0);
          }
          else
          {
            float3 v = sd == 4 ? float3(_Glass, _Dissolve.x, _Fluid) : sd == 5 ? float3(_Veins, _BoxOn, _Scrub) : sd == 7 ? float3(skinEmit, skinInk, _SkinBody / 128.0) : float3(_TripoFace, _Mode * 0.25, _WaterOpt.x);
            o.albedoLight = float4(saturate(v), 1); o.hatch = 0;
          }
        }
        // (-surface-debug -1, issue #462's test: a NaN, made at run time so no compiler folds it, in the colour and the normal
        // of one pixel in every 64 x 64, each a glowing one (-2: its glow flag a NaN too); the glow and the composite must keep
        // the rest of the picture)
        // (the switch alone in the branch, the pixel's test inside it: a branch on a uniform, issue #469)
        UNITY_BRANCH if (_MSurfaceDebug < -0.5)
        {
          if (all(fmod(floor(i.positionCS.xy), 64.0) == 32.0))
          {
            float nan = asfloat(asuint(_MSurfaceDebug) | 0x7fc00000u);
            o.albedoLight.rgb = nan; o.normalDepth.xyz = nan; o.hatch.a = _MSurfaceDebug < -1.5 ? nan : 1.0;
          }
        }
        return o;
      }

      #if defined(HIRAETH_PREPASS)
        struct DepthVaryings { float4 positionCS : SV_POSITION; };
        DepthVaryings vertEntry(Attributes v) { DepthVaryings d; d.positionCS = vert(v).positionCS; if (_HeroCut * _CutMe.x > 0.5) d.positionCS = float4(2, 2, 2, 1); return d; }
        // (the lean variants have no glass, dissolve nor veil (BridgeRenderer.Lean): no discard there at all, so the depth
        // they write is known before the fragment runs (early depth, a tiled GPU's low-resolution depth), issue #262)
        // (a reflection in still water and a splat cut their shapes in the G-buffer pass: they write no depth here; both are
        // kept on the full variant (BridgeRenderer.Lean: "mirror", "splat", "fall"), so no lean prepass carries a discard; a wall
        // seen through round him while its hole is open (SEE_HOLE) with the glass's cut, GLASSK: the full variant or the glass's
        // lean one, BridgeRenderer.Lean "see")
        // (the blade and the shield, HIRAETH_FIGHT's own variant: their meniscus is cut, and their vertices bowed, in the
        // G-buffer pass alone)
        #if defined(HIRAETH_FIGHT)
          #define BLADEPP (_BladeOn > 0.5)
        #else
          #define BLADEPP false
        #endif
        void fragEntry(DepthVaryings i) { if ((GLASSK && (_Glass > 0.0 || (_SeeOn > 0.5 && _SeeK.x > 0.001))) || (LEANK && (_Dissolve.x > 0.0 || _Veil > 0.0 || _SplatOn > 0.5 || _MirrorOn > 0.5 || _FallOn > 0.5)) || BLADEPP) discard; }
      #else
        // (the traveller's own surfaces while the lens is in his body, materials.js uHeroCut × uCutMe: past the clip volume, so
        // none of him is drawn; his shadow is the ShadowCaster's, kept)
        Varyings vertEntry(Attributes v) { Varyings o = vert(v); if (_HeroCut * _CutMe.x > 0.5) o.positionCS = float4(2, 2, 2, 1); return o; }
        #if defined(SIDES_BY_ID)
          // (a two-sided material's mesh, BridgeSided: each triangle then itself reversed, so an even primitive is the original)
          GBufferOut fragEntry(Varyings i, uint primId : SV_PrimitiveID, bool frontFace : SV_IsFrontFace) { if (_Sides > 1.5) frontFace = (primId & 1u) == 0u; return frag(i, frontFace); }
        #else
          GBufferOut fragEntry(Varyings i, bool frontFace : SV_IsFrontFace) { return frag(i, frontFace); }
        #endif
      #endif
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
      #pragma multi_compile_local _ HIRAETH_CROWD HIRAETH_FLORA HIRAETH_INSTMAT
      #pragma target 4.5
      #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
      #include "Crowd.hlsl"
      float3 _LightDirection;
      float _ShadowPancake;   // (1: casters beyond the near plane pressed onto it, URP's way; 0 the web's: HiraethShadows.Pancake)
      float3 _LightPosition;
      float4 shadowVert(Attributes v) : SV_POSITION
      {
        float3 posWS = TransformObjectToWorld(v.positionOS.xyz) + swayOffset(v.sway);
        float3 nWS = TransformObjectToWorldNormal(v.normalOS);
        #if defined(HIRAETH_CROWD)
          // the crowd's mid-distance figures cast their shadows too, posed as in the G-buffer pass
          CrowdInst ci = _CrowdInst[v.iid];
          float3 cp = v.positionOS.xyz, cn = v.normalOS, ccol; float4 ctrim;
          crowdAnimate(ci, v.sway, cp, cn, ccol, ctrim);
          float cs = ci.scale.x, cc = cos(ci.at.w), sn = sin(ci.at.w);
          float3 pu = toThree(cp) * cs, nu = toThree(cn);
          posWS = ci.at.xyz + float3(cc * pu.x + sn * pu.z, pu.y, -sn * pu.x + cc * pu.z);
          nWS = normalize(float3(cc * nu.x + sn * nu.z, nu.y, -sn * nu.x + cc * nu.z));
        #endif
        #if defined(HIRAETH_FLORA)
          { float3 fw, fs, fn; floraPlace(_Flora[v.iid], v.positionOS.xyz, v.normalOS, fw, fs, fn); posWS = fs; nWS = fn; }
        #endif
        #if defined(HIRAETH_INSTMAT)
          {
            MatInst mi = _Mats[v.iid]; float3 q = v.positionOS.xyz;
            posWS = float3(dot(mi.r0.xyz, q) + mi.r0.w, dot(mi.r1.xyz, q) + mi.r1.w, dot(mi.r2.xyz, q) + mi.r2.w);
            nWS = SafeNormalize(float3(dot(mi.r0.xyz, v.normalOS), dot(mi.r1.xyz, v.normalOS), dot(mi.r2.xyz, v.normalOS)));
          }
        #endif
        float4 positionCS = TransformWorldToHClip(ApplyShadowBias(posWS, nWS, _LightDirection));
        // (no pancaking, as the web's maps: what lies beyond a map's near plane, half its depth toward the light from the
        // traveller, is clipped, not pressed onto it; pressed, a far ridge 1.4 km off cast its shadow over the whole of
        // Viridel under a low moon. -shadow-pancake: as before, scripts/unity-compare/)
        if (_ShadowPancake > 0.5)
        {
        #if UNITY_REVERSED_Z
          positionCS.z = min(positionCS.z, UNITY_NEAR_CLIP_VALUE);
        #else
          positionCS.z = max(positionCS.z, UNITY_NEAR_CLIP_VALUE);
        #endif
        }
        return positionCS;
      }
      void shadowFrag() { }   // (depth alone, no colour output: a tiled GPU's depth-only path)
      ENDHLSL
    }
  }
}
