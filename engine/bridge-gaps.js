// What the web game uses that the Unity bridge doesn't carry, and what it does (issue #428, "loud gaps"): every
// material, shader, pass, page element and piece of main.js's wiring that scripts/bridge-gaps.mjs finds is named here,
// or tests/bridge-gaps.test.js fails. So a new one can't slip in silently, as the father's hologram (an overlay pass),
// the charge card (page HTML) and armTool (main.js only) did before #394.
//
// Each entry:
//   keys     what scripts/bridge-gaps.mjs finds (or `pattern`, a RegExp over them):
//              materials  shader:<its uniforms>  a shader the port has no shader for (drawn as a Surface)
//                         three:<type>           one of three's lit materials (Lambert, Standard…)
//                         define:<D>, uniform:<u>  a define or uniform of makeMaterial's surface the port never reads,
//                                                (engine/unity/port-format.js), so Unity never gets it
//                         patch:<kind>:<marks>   a surface whose shader text isn't makeMaterial's own (src/materials.js
//                                                surfacePatches: fragment, vertex, compile), by the marks in its userData
//              shaders    site:<file>:<kind>     a ShaderMaterial, an onBeforeCompile, a lit material made in that file
//              passes     <file>: <call>         a scene of its own, a renderer.render, an object's own render(renderer)
//              dom        <file>                 the page elements that file builds; part:<name> a screen part
//                                                (src/platform.js screen) the bridge never reads
//              host       import:<module>#<name> main.js imports it, nothing in engine/ does; shared:<group> a group of the
//                         one game setup (src/host/game-host.js) both hosts call; fn:<name> a function of
//                                                main.js's that engine/ never names (its convention: "as main.js armTool")
//   count    { key: n }: for the counted kinds (shaders, dom), how many sites that file has: one added or taken away
//            fails the test until it is looked at and the count moved
//   what     what it is, in a player's words where it is something they see
//   status   'handled' (where: the bridge's part that does it), 'web-only' (why), or 'gap' (issue: where it is to be fixed)
//   visible  for a gap: 3 seen at once, 2 seen in play, 1 barely, 0 not (the report's order)
//   note     anything else; "to check" where the gap is the code's reading, not yet seen in a Unity picture
//
// After changing it: node scripts/bridge-gaps.mjs (docs/systems/bridge-gaps.md), and the test.

export const STATUSES = ['handled', 'web-only', 'gap'];

/** Dev pages and tools: their own HTML pages, or tools a player never meets; left out of the static kinds. */
export const DEV_PAGES = [
  { path: 'src/studio/', why: 'the character studio page' },
  { path: 'src/audits-page/', why: 'the audits page' },
  { path: 'src/reference-lab/', why: 'the reference lab page' },
  { path: 'src/changelog-page/', why: 'the interactive changelog page (changelog.html)' },
  { path: 'src/references-page/', why: 'the references page' },
  { path: 'src/serendipity-page/', why: 'the serendipity page' },
  { path: 'src/temple-maps/', why: 'the temple maps debug page (#396)' },
  { path: 'src/enemies/page.js', why: 'the enemies page' },
  { path: 'src/cinematics-page/', why: 'the cinematics page' },
  { path: 'src/music-page/', why: 'the music page' },
  { path: 'src/motion/', why: 'the motion lab page' },
  { path: 'src/notes-page/', why: 'the notes page' },
  { path: 'src/makers-mark/page.js', why: 'the makers\' mark page' },
  { path: 'src/makers-mark/runtime.js', why: 'the makers\' mark page\'s driver of the game' },
  { path: 'src/outfits-gallery/', why: 'the outfits gallery (#549): every outfit on the v2 traveller side by side; a dev page, not in the game' },
  { path: 'src/characters/outfit-page.js', why: 'the outfits test page for the v2 traveller (#540): its panel and readout swap outfits in a world; a dev page, not in the game' },
  { path: 'src/items-page/', why: 'the items page' },
  { path: 'src/lore-page/', why: 'the lore page' },
  { path: 'src/trailer/', why: 'the trailer recorder' },
  { path: 'src/levels/reference-picker.js', why: 'the References world\'s picker (a dev world)' },
  { path: 'src/levels/references.js', why: 'the References world (a dev world of the reference pictures)' },
  { path: 'src/guardian-review.js', why: 'the guardians\' review tool' },
  { path: 'src/character-review.js', why: 'the characters\' review tool' },
  { path: 'src/dev-menu.js', why: 'the dev menu' },
  { path: 'src/foe-spawner.js', why: 'the dev foe spawner' },
  { path: 'src/hitbox-overlay.js', why: 'the fight\'s hitboxes overlay (dev)' },
  { path: 'src/input-display.js', why: 'the input display (a dev overlay)' },
  { path: 'src/pose-report.js', why: 'the pose report (F8, a dev overlay: issue #551)' },
  { path: 'src/debug-back.js', why: 'the debug pages\' back button' },
  { path: 'src/changelog-media.js', why: 'the changelog\'s pictures and how they are shot' },
  { path: 'src/gait-course.js', why: 'the gait harness\'s course (tests, the motion page)' },
];

const PAGE = 'the page\'s own drawing (G-buffer, composite, shadows, batching, warm-up): Unity draws with its own (BridgeRenderer, Composite.shader, BridgeShadowChunks)';

export const GAPS = {
  // ------------------------------------------------------------------ materials (gathered by running every world and game)
  materials: [
    // known gaps, most seen first
    { keys: ['uniform:uPortraitHairAmount', 'uniform:uPortraitFaceAmount', 'uniform:uHeadView'],
      what: 'the traveller\'s portrait head: its pen lines and the hair\'s grey strokes (two pictures, face-ink.png and hair-ink.png), the nose\'s side line by the view',
      status: 'gap', issue: 264, visible: 1,
      note: 'his blink, smile, brows and open mouth cross (surfaces D: the morph targets as blend shapes, PortraitFace.hlsl); his eyes and brows are painted from their own picture at the texture\'s detail, the iris moved with his look (eye-paint.png, uHeadEye: issue #473); the rest of the paint is his vertex colours (engine/traveller-paint.js), whose darker marks stand for the pen lines' },
    { keys: ['uniform:uPortrait', 'uniform:uExpression', 'uniform:uGaze', 'uniform:uIris', 'uniform:uHeadBall'],
      what: 'face.js\'s portrait face (makeMaterial portrait, S_PORTRAIT: drawn eyes and lids, an iris colour, the head lit as a ball)', status: 'web-only',
      why: 'no material in the game is made with it (face.js FaceExpression is only in its test); every surface carries the uniforms, read by nothing. People\'s eyes are Figure.hlsl\'s (their iris colour the eye\'s uColor2), the traveller\'s his portrait head\'s' },
    // handled
    // (issue #264, the next round: patterns, so an entry stays once the port reads its keys and the run no longer finds them)
    { pattern: /^shader:uCore,uDark,uFar,uTint$/, what: 'the patch of shade under each chime crystal (src/chimes.js blobMaterial)', status: 'handled',
      where: 'port-format.js chimeshade → Hiraeth/ChimeShade (BridgeRenderer.cs): the page\'s G-buffer decal, the albedo blended toward its tint by its strength (the instance\'s, InstMats), the light term kept, faded by uFar; no discard' },
    { pattern: /^(define:S_THIN|uniform:uThinPx)$/, what: 'thin bars (masts\' struts, wires, vines) kept a pixel or two wide far off (src/thin.js)', status: 'handled',
      where: 'port-format.js thinPx; aThin in the form\'s slot (pack.js, backend.js); Surface.shader vert pushes the vertex out from its axis point by the web\'s least width (a perspective view only); never in a static batch (BridgeRenderer.NeedsOrigin)' },
    { pattern: /^define:S_VGLYPH$/, what: 'the banners\' glyph cells per vertex (life.js BannerSet: the City-Shaft\'s banners)', status: 'handled',
      where: 'port-format.js vglyph → _VGlyph: Surface.shader HIRAETH_VMAT reads each banner\'s glyph cells from its grid per vertex (vmGlyphs); seen in a picture since #538, the pale banner under the top ring (it drew black: backend.js geometryOf sent a waved banner again without its vertex material)' },
    { pattern: /^(define:LINE_FAR|uniform:uLineFar)$/, what: 'a lighter line from afar (the meadow\'s flowers, flora.js FAR_LINE)', status: 'handled',
      where: 'port-format.js lineFar → _LineFar: Surface.shader vert flags a whole plant by the web\'s hashed distance (its instance\'s place), frag takes its far step; never in a static batch (BridgeRenderer.NeedsOrigin)' },
    { pattern: /^uniform:uShellCenter$/, what: 'a temple landmark\'s shell pattern (src/temples/landmark-materials.js nacre: the Whale-House\'s nautilus)', status: 'handled',
      where: 'port-format.js shellCenter → _ShellCenter: Surface.shader frag, the web\'s sutures and chambers (a uniform branch, not on the plain variant: BridgeRenderer.Lean)' },
    // (issue #538: a surface whose shader text was rewritten after makeMaterial, or at compile, named by the marks its patch
    // left in its userData (engine/ink-spec.js `patched`): what it draws is in no define or uniform, so it is listed here)
    { keys: ['patch:fragment:landmarkStone'], what: 'a temple landmark\'s cut stone: staggered courses of blocks, a tone a block, worn veins (src/temples/landmark-materials.js stone(): the Rose House\'s red stone, the towers\' cream, ochre and slate)', status: 'handled',
      where: 'ink-spec.js stone → port-format.js stone → _Stone: Surface.shader frag, the web\'s joints, tones and veins (a uniform branch, not on the plain variant: BridgeRenderer.Lean)' },
    { keys: ['patch:fragment:nacre'], what: 'a temple landmark\'s shell, spliced into the surface\'s text (landmark-materials.js nacre)', status: 'handled', where: 'its uShellCenter, _ShellCenter (above)' },
    { pattern: /^patch:fragment:\w+Skin,skinPattern$/, what: 'the temple skins\' surfaces, spliced into the surface\'s text (src/temples/skins/skin-shader.js spliceSkin)', status: 'handled',
      where: 'skinPatternSpec: the pattern\'s number and uniforms as _SkinData; SkinPatterns.hlsl (scripts/skin-hlsl.mjs, the same GLSL in HLSL), Surface.shader HIRAETH_SKIN' },
    { keys: ['patch:fragment:farDepth'], what: 'the smoke column\'s far depth, spliced into the surface\'s text (src/story/flames.js)', status: 'handled', where: 'its uFarNear and uFarScale, _FarDepth (below)' },
    { keys: ['patch:fragment+vertex:splat'], what: 'the splats\' growth (src/splat-decal.js: the blob and its drops cut by their age)', status: 'handled', where: 'aSplat in the form\'s slot (pack.js), _SplatOn (surfaces B)' },
    { pattern: /^patch:fragment(\+vertex)?:(albedoLinear,)?(lining,|portraitEyeBox,portraitEyePaint,portraitFace,)?tripoInk$/,
      what: 'the generated characters\' ink (src/characters/tripo-material.js: their linear colours turned to display values, the trousers\' repaired band, the overshirt\'s lining; the traveller, the Keeper, the Elder)', status: 'handled',
      where: 'engine/game.js engineColours and the guardians\' sampled colours: vertex colours (display values, or linear with albedoLinear → toDisplay), the repaired band baked in, the lining (_Lining); his face PortraitFace.hlsl' },
    { pattern: /^uniform:uFar(Near|Scale)$/, what: 'the fires\' far depth (src/story/flames.js SmokeColumn: past uFarNear its depth written compressed)', status: 'handled',
      where: 'port-format.js farDepth → the Surface\'s _FarDepth (as Puffs.cs had for the port\'s own column)' },
    { keys: ['define:METAL_BRUSHED'], what: 'brushed metal: fine streaks along an axis, the sun\'s highlight stretched across them', status: 'handled',
      where: 'Surface.shader metalAlbedo takes it from _Metal.y (port-format.js metal: uMetal, its brushed flag) with the web\'s arithmetic; the define only trims the web\'s program (the lab\'s steel, brushed and chrome side by side, #264 surfaces D)' },
    { pattern: /^(define:FOE_SURFACE|define:FS_[A-Z0-9]+|uniform:uFs_?\w+)$/, what: 'the foes\' own surfaces: bellies, mottling, rust, grain, bands, scales, spots, rivets, drips, cracks, glow, gloss (src/foe-surface.js)', status: 'handled',
      where: 'engine/foe-pack.js packs them (bits and slots, port-format.js; again live when a brute\'s cracks open, engine/mirror.js); Surface.shader HIRAETH_FIGHT, FoeSurface.hlsl (scripts/unity-export/foe-hlsl.mjs: the web\'s GLSL in HLSL)' },
    { pattern: /^(define:BLADE_FLUID|define:BLADE_DISC|uniform:uBlade[BC]?)$/, what: 'the sword\'s blade and the shield: their currents, meniscus, bow along the swing, the ring a hit sends along it, their light (src/blade-shader.js)', status: 'handled',
      where: 'port-format.js blade, bladeA..C (live: engine/mirror.js LIVE_VECTORS), aFold with the bind (pack.js); Surface.shader HIRAETH_FIGHT, BladeSurface.hlsl (scripts/unity-export/blade-hlsl.mjs: the web\'s GLSL in HLSL)' },
    { pattern: /^(define:CHIME_CRYSTAL|uniform:uCrystal\w+)$/, what: 'the chimes\' crystals: their facets, core and seams (src/crystal-shader.js)', status: 'handled',
      where: 'port-format.js crystal (its uniforms packed: engine/foe-pack.js CRYSTAL_LAYOUT), aCrystal in the form\'s slot (pack.js); Surface.shader HIRAETH_FIGHT _CrystalOn, CrystalSurface.hlsl (scripts/unity-export/crystal-hlsl.mjs), on the GPU instances (HIRAETH_INSTMAT); each piece\'s tier glow (aChimeGlow) does not cross. Seen at rest in the foes sequence (chimes-rest), tiny at its distance; their shade Hiraeth/ChimeShade' },
    { pattern: /^(define:SEE_HOLE|uniform:uSeeK?)$/, what: 'the hole a wall opens round the traveller when it hides him (makeMaterial seeThrough: the fight temples)', status: 'handled',
      where: 'port-format.js seeOn, see, seeK (uSee, uSeeK live: engine/mirror.js LIVE_VECTORS); Surface.shader\'s cut with the glass\'s (the glass\'s lean variant on the Retroid)' },
    { pattern: /^(define:LAMP_TINT|uniform:uLampTint)$/, what: 'the lamps\' pools in their own colour (makeMaterial lampTint)', status: 'handled',
      where: 'port-format.js lampTint; Surface.shader _LampTint, the global _LampsOn (HiraethLook, uLampsOn)' },
    { keys: ['shader:uColor,uGlow'], what: 'a flat colour written to the G-buffer (src/ship/approach.js: the ship\'s and the worlds\' plain parts on approach)', status: 'handled',
      where: 'port-format.js\'s Surface plain takes its uColor and uGlow, which is all it has' },
    { keys: ['define:S_BIOMES', 'define:S_RIPPLES', 'define:S_SANDINK', 'define:S_TERRAIN', 'define:S_STRATA', 'define:S_GLYPHS', 'define:S_GRID', 'define:S_CRACKS',
      'define:S_SCRUB', 'define:S_WATERMODE', 'define:S_PLATES', 'define:S_DETAIL', 'define:S_PATCH', 'define:S_WEATHER', 'define:S_MAP', 'define:S_FIGURE', 'define:S_EYE',
      'define:S_FOLDS', 'define:S_TILES', 'define:S_LEAVES', 'define:S_FACADE', 'define:S_VEIL', 'define:S_GLASS', 'define:S_TICKS'],
    what: 'the surface\'s features, each compiled only where used (materials.js surfaceFeatures)', status: 'handled',
    where: 'Surface.shader takes each from its uniform (uMode, uGrid, uPattern, uGlass…), which port-format.js sends; the define only trims the web\'s program' },
    { keys: ['define:SURFACE_SPEC'], what: 'the web\'s surface compiled with only its features', status: 'web-only', why: 'a compile-time trim of the web\'s program; Surface.shader has its own variants' },
    { keys: ['uniform:uVertexColors', 'uniform:uPalette', 'uniform:uVeins'], what: 'vertex colours, the palette, a cap\'s veins', status: 'handled',
      where: 'port-format.js: vertexColors from the spec, the palette when uPaletteSize > 0, the veins with S_FORM (unread otherwise, as unused)' },
    { pattern: /^uniform:u(Sk|Lh|Wh|Ut|Fp|Sea)[A-Z_]|^uniform:uSkinO$/, what: 'the temple skins\' patterns (src/temples/skins/)', status: 'handled',
      where: 'skinPatternSpec packs them as _SkinData (engine/ink-spec.js; SkinPatterns.hlsl, Surface.shader HIRAETH_SKIN)' },
    { keys: ['define:CROWD'], what: 'the crowds\' figures', status: 'handled', where: 'pack.js crowdInstances, Crowd.hlsl' },
    { keys: ['define:FACE_KEYS', 'uniform:uKeyW', 'uniform:uKeyScale', 'uniform:uKeyWidth', 'define:FACE_PART'], what: 'the MakeHuman faces\' shape keys and parts', status: 'handled',
      where: 'blend shapes (engine/unity/backend.js FaceKeys, BridgeHost.FaceKeys); the parts by their uMode' },
    { keys: ['define:GARMENT', 'uniform:uGarmentRigid', 'uniform:uClothP', 'uniform:uClothG', 'uniform:uGarmentSim', 'uniform:uGarmentCapA', 'uniform:uGarmentCapB'],
      what: 'the traveller\'s overshirt cloth', status: 'handled', where: 'BridgeCloth.cs (the cloth offloaded: engine/cloth.js, backend clothOffload)' },
    { keys: ['define:SWAY'], what: 'the wind\'s sway', status: 'handled', where: 'uSway → Surface.shader _Sway' },
    { keys: ['uniform:uGrassView', 'uniform:uGrassLod', 'uniform:uGrassLook'], what: 'the grass patch\'s centre, detail and look', status: 'handled', where: 'Surface.shader _GrassView, _GrassLod, _GrassLook, set by the bridge each frame' },
  ],

  // ------------------------------------------------------------------ shaders (where src/ makes them)
  shaders: [
    { keys: ['site:src/materials.js:ShaderMaterial'], count: { 'site:src/materials.js:ShaderMaterial': 1 }, what: 'makeMaterial, the surface everything is drawn with', status: 'handled', where: 'Surface.shader (port-format.js portMaterial); its unread defines and uniforms are under materials' },
    { keys: ['site:src/life.js:ShaderMaterial'], count: { 'site:src/life.js:ShaderMaterial': 2 }, what: 'the dust motes and the footprints', status: 'handled', where: 'Hiraeth/Mote, Hiraeth/Print' },
    { keys: ['site:src/wind.js:ShaderMaterial'], count: { 'site:src/wind.js:ShaderMaterial': 1 }, what: 'the wind\'s wisps', status: 'handled', where: 'Hiraeth/Wisp' },
    { keys: ['site:src/pit-void.js:ShaderMaterial'], count: { 'site:src/pit-void.js:ShaderMaterial': 1 }, what: 'a deadly drop\'s dark', status: 'handled', where: 'Hiraeth/PitVoid' },
    { keys: ['site:src/door-light.js:ShaderMaterial'], count: { 'site:src/door-light.js:ShaderMaterial': 1 }, what: 'a way through\'s light', status: 'handled', issue: 502,
      where: 'Hiraeth/DoorLight, added as the web adds it to the page\'s sRGB values in two blends (LightAdd.hlsl: before #502 a^1.5 in the linear target, a temple\'s first room seen through its way in 5-9 ΔE dark)' },
    { keys: ['site:src/veil.js:ShaderMaterial'], count: { 'site:src/veil.js:ShaderMaterial': 1 }, what: 'the see-through surfaces\' wash', status: 'handled', where: 'Hiraeth/Veil (a light\'s wash added in two blends as the door\'s, LightAdd.hlsl, issue #502)' },
    { keys: ['site:src/story/flames.js:ShaderMaterial'], count: { 'site:src/story/flames.js:ShaderMaterial': 2 }, what: 'the fires', status: 'handled', where: 'Hiraeth/Flame (the far depth patch: materials uFarNear)' },
    { keys: ['site:src/ship/approach.js:ShaderMaterial'], count: { 'site:src/ship/approach.js:ShaderMaterial': 2 }, what: 'the planets on the galactic map and the approach, a flat colour', status: 'handled', where: 'Hiraeth/Planet; the flat colour as a Surface plain' },
    { keys: ['site:src/ship/hologram.js:ShaderMaterial'], count: { 'site:src/ship/hologram.js:ShaderMaterial': 3 }, what: 'the recordings\' figures in light, their beam, the overlay\'s blend', status: 'handled', where: 'Hiraeth/HoloFigure (\'holo\'), the beam \'hidden\', the figures hung in the mirrored scene (issue #394)' },
    { keys: ['site:src/post.js:ShaderMaterial'], count: { 'site:src/post.js:ShaderMaterial': 2 }, what: 'the composite (the Moebius look) and the bloom', status: 'handled', where: 'Composite.shader, Bloom.shader' },
    { keys: ['site:src/characters/traveller-b3.js:onBeforeCompile'], count: { 'site:src/characters/traveller-b3.js:onBeforeCompile': 1 }, what: 'the coral-shirt traveller\'s drawn face', status: 'handled', where: 'TripoFace.hlsl (port-format.js tripoFace, the live vectors uTfBrowA…)' },
    { keys: ['site:src/characters/tripo-cloth.js:ShaderMaterial', 'site:src/characters/tripo-cloth.js:onBeforeCompile', 'site:src/characters/tripo-cloth.js:MeshStandardMaterial',
      'site:src/characters/tripo-garment-geometry.js:onBeforeCompile', 'site:src/characters/tripo-garment-geometry.js:MeshStandardMaterial'],
    count: { 'site:src/characters/tripo-cloth.js:ShaderMaterial': 1, 'site:src/characters/tripo-cloth.js:onBeforeCompile': 1, 'site:src/characters/tripo-cloth.js:MeshStandardMaterial': 1, 'site:src/characters/tripo-garment-geometry.js:onBeforeCompile': 1, 'site:src/characters/tripo-garment-geometry.js:MeshStandardMaterial': 2 },
    what: 'the overshirt\'s cloth and the garments as loaded', status: 'handled', where: 'BridgeCloth.cs; the loaded garments\' lit materials are replaced by makeMaterial before they are drawn (none reaches the bridge in any world)' },
    { keys: ['site:src/chimes.js:ShaderMaterial'], count: { 'site:src/chimes.js:ShaderMaterial': 1 }, what: 'the patch of shade under the chimes', status: 'handled', where: 'Hiraeth/ChimeShade (port-format.js chimeshade, issue #264)' },
    { keys: ['site:src/crowd.js:ShaderMaterial'], count: { 'site:src/crowd.js:ShaderMaterial': 1 }, what: 'the crowd\'s shadow-only material', status: 'gap', issue: 264, visible: 0, note: 'materials shader:(none)' },
    { keys: ['site:src/splat-decal.js:ShaderMaterial'], count: { 'site:src/splat-decal.js:ShaderMaterial': 1 }, what: 'the splats on the ground', status: 'handled', issue: 264, where: 'a Surface with its shape and growth (Surface.shader _SplatOn; materials uniform:uSplatTime)' },
    { keys: ['site:src/jump-shadow.js:ShaderMaterial'], count: { 'site:src/jump-shadow.js:ShaderMaterial': 1 }, what: 'the patch of shade under the traveller in a jump', status: 'handled', where: 'Hiraeth/JumpShade (port-format.js jumpshade: the light term under it taken away, its colour by uDark)' },
    { keys: ['site:src/water.js:ShaderMaterial'], count: { 'site:src/water.js:ShaderMaterial': 3 }, what: 'the water\'s depth copy, its contact foam and the pass over it under water (tint, banded fog, the sun\'s sparkle)', status: 'handled', issue: 458,
      where: 'the surface as Surface WATER, its contact foam over HiraethFeature\'s copy of the scene\'s depth; the pass over the page as Hidden/Hiraeth/WaterOver (engine/game.js waterOver, BridgeRunner.Water); its bed map (the shallows, the bed through them, the deep band: src/water.js bakeStep) baked by engine/game.js as main.js does and sent as bytes (engine/water-bed.js, the mirror\'s _Bed with _BedBox, _BedRef live; issue #502: before, every body one flat tone, Lorn\'s lake without its shallows)' },
    { keys: ['site:src/pipeline.js:ShaderMaterial'], count: { 'site:src/pipeline.js:ShaderMaterial': 1 }, what: 'the page\'s blit to the screen', status: 'web-only', why: PAGE },
    { keys: ['site:src/static-batch.js:ShaderMaterial'], count: { 'site:src/static-batch.js:ShaderMaterial': 2 }, what: 'the web\'s batches of still meshes', status: 'web-only', why: 'the web\'s own draw-call batching; the bridge mirrors the meshes themselves' },
    { keys: ['site:src/face.js:onBeforeCompile'], count: { 'site:src/face.js:onBeforeCompile': 1 }, what: 'the face\'s ink on an unlit material', status: 'web-only', why: 'the inspection viewer\'s preview only (attachPortraitPreview)' },
  ],

  // ------------------------------------------------------------------ passes and scenes besides the main picture
  passes: [
    { keys: ['src/main.js: new Scene scene', 'src/main.js: render(post.scene)', 'src/main.js: render(blit.scene)', 'src/main.js: smaa.render(renderer)', 'src/main.js: bloom.render(renderer)',
      'src/post.js: new Scene scene', 'src/post.js: render(blur.scene)', 'src/post.js: render(extract.scene)'],
    what: 'the main scene, the composite, the bloom, the anti-aliasing, the blit', status: 'handled', where: 'the mirror walks the main scene; Composite.shader, Bloom.shader, SMAA.shader / FXAA.shader' },
    { keys: ['src/main.js: new Scene heroScene', 'src/main.js: render(heroScene)', 'src/main.js: render(o)', 'src/main.js: c.render(renderer)', 'src/shadows.js: render(scene)'],
      what: 'the sun\'s shadow maps and the traveller\'s own fine map', status: 'handled', where: 'Unity\'s own shadows (BridgeShadowChunks, the port\'s cascades)' },
    { keys: ['src/flat-pass.js: render(scene)'], what: 'each pass of the frame drawn from the scene\'s flat list (src/flat-pass.js: the stand-in scene three walks instead)', status: 'web-only',
      why: 'a shortcut in three.js\'s own walk of the scene; the engines have no three renderer, and the mirror walks the flat list already (engine/mirror.js)' },
    { keys: ['src/main.js: render(wind.scene)', 'src/wind.js: new Scene this.scene'], what: 'the wind\'s wisps, drawn over the ink', status: 'handled', where: 'engine/game.js hangs them in the mirrored scene (Hiraeth/Wisp)' },
    { keys: ['src/main.js: render(motes.scene)', 'src/life.js: new Scene this.scene'], what: 'the dust motes, drawn over the ink', status: 'handled', where: 'engine/game.js takes them into the mirrored scene (motePoints; Hiraeth/Mote)' },
    { keys: ['src/main.js: render(sc)'], what: 'a makers\' house\'s air (src/temples/air.js)', status: 'handled', where: 'engine/game.js makes HouseAir with the scene as its host' },
    { keys: ['src/main.js: level.veils.render(renderer)', 'src/veil.js: new Scene this.scene', 'src/veil.js: render(this.scene)'], what: 'the see-through surfaces\' wash', status: 'handled', where: 'Hiraeth/Veil, drawn in the scene over the ink' },
    { keys: ['src/main.js: HOLO.render(renderer)', 'src/ship/hologram.js: new Scene scene', 'src/ship/hologram.js: render(this.scene)', 'src/ship/hologram.js: render(overlay.scene)'],
      what: 'the recordings\' hologram (the father\'s message)', status: 'handled', where: 'engine/game.js hangs HOLO.scene in the mirrored scene (issue #394)' },
    { keys: ['src/water.js: render(scene)', 'src/water.js: render(b.mesh)', 'src/water.js: copy.render(renderer)', 'src/water.js: render(c.quad)', 'src/water.js: new Scene this.scene', 'src/water.js: render(this.scene)'],
      what: 'the water\'s passes: drawn last over the scene\'s depth (its contact foam), the depth copy, and over the finished picture (under water: the tint and banded fog; the sun\'s sparkle)', status: 'handled', issue: 458,
      where: 'HiraethFeature: the water in a G-buffer pass of its own after a copy of the scene\'s depth; WaterOver.shader after the composite, reading _GNormal (a sea\'s shafts and caustics, the glints Surface.shader marks in the normal\'s length)' },
    { keys: ['src/main.js: hitboxOverlay.render(renderer)'], what: 'the fight\'s hitboxes', status: 'web-only', why: 'a dev overlay' },
    { keys: ['src/passage.js: new Scene this.holder', 'src/passage.js: render(H)'], what: 'drawing a way through\'s far side ahead (WarmDraw)', status: 'web-only', why: 'warms the web\'s programs; the engine has every mesh uploaded already (engine/game.js)' },
    { keys: ['src/pipeline.js: new Scene scene', 'src/pipeline.js: pass.render(renderer)', 'src/static-batch.js: render(this.shadow)', 'src/warm-shaders.js: new Scene keyScene'], what: 'the page\'s pipeline, batches and shader warm-up', status: 'web-only', why: PAGE },
    { keys: ['src/title-world.js: new Scene scene', 'src/title-world.js: cascades.near.render(renderer)', 'src/title-world.js: cascades.far.render(renderer)', 'src/title-world.js: cascades.fine.render(renderer)',
      'src/title-world.js: render(o)', 'src/title-world.js: render(scene)', 'src/title-world.js: bloom.render(renderer)', 'src/title-world.js: render(post.scene)', 'src/title-world.js: render(blit.scene)'],
    what: 'the world behind the title', status: 'handled', where: 'the engines\' title stands over the world they run (engine/menus.js chooseShot)' },
    { keys: ['src/ship/arrival-view.js: new Scene proxy'], what: 'the arrival views\' sight lines', status: 'web-only', why: 'offline only (scripts/arrival-views.mjs, its test)' },
  ],

  // ------------------------------------------------------------------ page elements (HTML) the game builds
  dom: [
    // gaps
    // handled: drawn from the screen's parts, or the engines' own menus
    { keys: ['src/ship/homecoming.js'], count: { 'src/ship/homecoming.js': 15 }, parts: ['cargo', 'endCard', 'credits'], what: 'the homecoming\'s cargo check, end card and credits rolling up the screen', status: 'handled',
      where: 'the cargo, endCard and credits parts (src/ship/homecoming.js Credits, creditsPart), BridgeHud.Parts.cs and BridgeHud.Credits.cs (issues #430, #264: the credits were said as subtitles before)' },
    { keys: ['src/aliens/alien.js', 'src/npc.js', 'src/crowd.js'], count: { 'src/aliens/alien.js': 4, 'src/npc.js': 4, 'src/crowd.js': 4 }, parts: ['balloons'],
      what: 'the speech balloons over people as they pass (their barks)', status: 'handled', where: 'the balloons part (src/balloon-part.js: main.js and engine/game.js choose alike), BridgeHud.Parts.cs DrawBalloons (issue #430)' },
    { keys: ['src/ship/cinema.js'], count: { 'src/ship/cinema.js': 22 }, parts: ['cine', 'sub', 'objective'], what: 'a ship\'s scene: the letterbox, subtitles, hint, skip, and the homecoming\'s objective card (cinema.objective)', status: 'handled',
      where: 'the cine, sub, toast, warp and objective parts, BridgeHud.cs DrawCine and BridgeHud.Parts.cs DrawObjective (issue #430)' },
    { keys: ['src/water.js'], count: { 'src/water.js': 3 }, parts: ['breath'], what: 'the breath meter (bubbles under the health bar while holding your breath)', status: 'handled',
      where: 'the breath part (src/water.js breathShown: main.js and engine/game.js alike), BridgeHud.Parts.cs DrawBreath (issue #430)' },
    { keys: ['src/boxes/effects.js'], count: { 'src/boxes/effects.js': 4 }, parts: ['level'], what: 'the brass level (a bubble level at the screen\'s edge where down has turned)', status: 'handled', where: 'the level part, BridgeHud.Parts.cs DrawLevel (issue #430)' },
    { keys: ['src/levels/arcade-board.js'], count: { 'src/levels/arcade-board.js': 6 }, what: 'the Arcade\'s board of games', status: 'handled', where: 'engine/menus.js openArcade (its E, D-pad down, Tab), BridgeMenu.cs DrawArcade (issue #430)' },
    { keys: ['src/story/charge.js'], count: { 'src/story/charge.js': 6 }, parts: ['charge'], what: 'the charge card', status: 'handled', where: 'the screen\'s charge part, BridgeHud.cs DrawCharge (issue #394)' },
    { keys: ['src/story/dialogue.js'], count: { 'src/story/dialogue.js': 5 }, parts: ['dialogue'], what: 'the conversation', status: 'handled', where: 'the dialogue part, BridgeHud.cs' },
    { keys: ['src/story/index.js'], count: { 'src/story/index.js': 2 }, parts: ['prompt'], what: 'the floating prompt', status: 'handled', where: 'the prompt part, BridgeHud.cs' },
    { keys: ['src/hud.js'], count: { 'src/hud.js': 2 }, parts: ['cue'], what: 'the cue line', status: 'handled', where: 'the cue part, BridgeHud.cs' },
    { keys: ['src/main.js'], count: { 'src/main.js': 20 }, parts: ['health', 'keys', 'stamina', 'restart', 'photo'], what: 'the health, stamina, keys, knock-out card, photo hint, the tool\'s gauge, the loading screen, the picker',
      status: 'handled', where: 'the health, stamina, keys, restart and photo parts, BridgeHud.cs; the picker is the page\'s (host); the loading screen BridgeHud.Loading.cs (engine/game.js onStage, issue #424; from the title\'s choice too, BridgeHost.Loading, issue #510; its bar and why line, src/load-page.js, from engine/game.js onLoad through BridgeHost.LoadProgress, issue #527)' },
    { keys: ['src/boxes/card.js'], count: { 'src/boxes/card.js': 7 }, parts: ['boxCard'], what: 'a makers\' box\'s card', status: 'handled', where: 'the boxCard part, BridgeHud.cs' },
    { keys: ['src/gadgets/hud.js'], count: { 'src/gadgets/hud.js': 13 }, parts: ['gadget', 'gadgetMarks', 'gadgetWheel', 'reticle'], what: 'the gadgets\' chip, marks, wheel and reticle', status: 'handled', where: 'their parts, BridgeHud.cs' },
    { keys: ['src/minigames/kit/runner.js', 'src/minigames/kit/labels.js'], count: { 'src/minigames/kit/runner.js': 11, 'src/minigames/kit/labels.js': 7 }, parts: ['minigame', 'words'], what: 'a minigame\'s HUD, card, results and floating words', status: 'handled', where: 'the minigame and words parts, BridgeHud.Games.cs' },
    { keys: ['src/minigames/drums.js', 'src/minigames/fishing.js', 'src/minigames/pirates.js', 'src/minigames/sketchhunt.js'], count: { 'src/minigames/drums.js': 3, 'src/minigames/fishing.js': 7, 'src/minigames/pirates.js': 4, 'src/minigames/sketchhunt.js': 15 },
      parts: ['drums', 'fishing', 'pirates', 'hunt'], what: 'the four minigames\' own panels', status: 'handled', where: 'their parts, BridgeHud.Games.cs' },
    { keys: ['src/minigames/lens-vault.js'], count: { 'src/minigames/lens-vault.js': 2 }, parts: ['visor'], what: 'the Lens Vault\'s visor: hearts, ARM / LENS tab, reticle, lock brackets, lens marks and reading card (issue #382)', status: 'handled', where: 'the visor part, BridgeHud.Games.cs DrawVisor' },
    { keys: ['src/foes.js', 'src/lock-reticle.js', 'src/low-health.js', 'src/flurry.js'], count: { 'src/foes.js': 5, 'src/lock-reticle.js': 2, 'src/low-health.js': 1, 'src/flurry.js': 1 },
      parts: ['warn', 'lock', 'edges'], what: 'the foes\' warning chips, the blinding flash, the lock-on ring, the low-health and flurry edges', status: 'handled', where: 'the warn, lock and edges parts, BridgeHud.cs' },
    { keys: ['src/fight-temples/self-mark.js'], count: { 'src/fight-temples/self-mark.js': 2 }, parts: ['self'], what: 'the traveller\'s ring in a fight temple\'s crowd (issue #534)', status: 'handled', where: 'the self part, BridgeHud.Self.cs DrawSelf' },
    { keys: ['src/temples/runtime.js'], count: { 'src/temples/runtime.js': 5 }, parts: ['guardian'], what: 'the guardian\'s bar', status: 'handled', where: 'the guardian part, BridgeHud.cs DrawGuardian' },
    { keys: ['src/passage.js'], count: { 'src/passage.js': 3 }, parts: ['passage'], what: 'a way through\'s cover', status: 'handled', where: 'the passage part, BridgeHud.cs' },
    { keys: ['src/quest.js'], count: { 'src/quest.js': 2 }, what: 'the journal and the toast', status: 'handled', where: 'the toast part; the journal\'s Quests page in engine/menus.js' },
    { keys: ['src/game-menu.js', 'src/ui.js', 'src/title.js', 'src/shop-panel.js', 'src/changelog.js', 'src/ship/starmap.js'],
      count: { 'src/game-menu.js': 9, 'src/ui.js': 10, 'src/title.js': 6, 'src/shop-panel.js': 4, 'src/changelog.js': 5, 'src/ship/starmap.js': 10 },
      what: 'the game menu, the Start menu and settings, the title, the shops, What\'s new, the galactic map', status: 'handled', where: 'engine/menus.js and engine/starmap.js, BridgeMenu.cs and BridgeMenu.StarMap.cs' },
    { keys: ['src/platform.js'], count: { 'src/platform.js': 1 }, what: 'page.byId, the page\'s elements by id', status: 'handled', where: 'engine/platform.js stands in for the page' },
    { keys: ['part:carry'], what: 'what the traveller carries (src/carry.js)', status: 'handled', where: 'nothing to draw: the web draws nothing from the part either (the thing is in his hands, in the scene)' },
    // web only
    { keys: ['src/title-paint.js'], count: { 'src/title-paint.js': 5 }, what: 'the title\'s first paint', status: 'web-only', why: 'a drawing shown while the page loads its WebGL; the engines start on their own splash' },
    { keys: ['src/native-app.js', 'src/update-panel.js'], count: { 'src/native-app.js': 2, 'src/update-panel.js': 1 }, what: 'the Android app\'s shell and the web\'s update panel', status: 'web-only', why: 'the web build\'s (Capacitor); the Unity players update through BridgeUpdates and their Updates page' },
    { keys: ['src/pad-glyphs.js'], count: { 'src/pad-glyphs.js': 1 }, what: 'the pad glyphs\' style sheet', status: 'web-only', why: 'CSS for the page\'s glyphs; BridgeHud draws its own, BridgeMenu.Glyphs.cs the menus\' from padGlyphs\'s labels (issue #517)' },
    { keys: ['src/world-picker.js'], count: { 'src/world-picker.js': 12 }, what: 'the world picker (?level)', status: 'web-only', why: 'the page\'s list of worlds; the engines choose by -level and the Worlds page' },
  ],

  // ------------------------------------------------------------------ host wiring: main.js against engine/game.js (also #427's list)
  host: [
    // gaps
    { keys: ['import:src/motion-match.js#loadMotionLibrary'], what: 'the traveller\'s captured moves and the people\'s own walks; motion matching\'s database (only with matching switched on)', status: 'handled',
      where: 'engine/game.js loads walks.glb and moves.glb as main.js does (locoMoves by movesSetting), the database only with matchingSetting or -js-on matching, as the page (issue #427 round 4: docs/systems/engine-bridge.md "Motion matching in the engines": on the Deck the walks and moves ~90 ms of load and ~17 MB, the database ~330 ms and ~13 MB more for what no player has on)' },
    { keys: ['import:src/post.js#PRESETS'], what: 'the style presets\' list (main.js\'s GUI)', status: 'web-only', why: 'the page\'s lil-gui list of styles; the presets themselves are put on by src/host/game-host.js wireSky in both hosts' },
    { keys: ['import:src/weather.js#WEATHER_KINDS'], what: 'the weather\'s kinds (main.js\'s dev toggles)', status: 'handled', where: 'engine/game.js runs Weather itself; the list is for the page\'s toggles' },
    { keys: ['fn:placeToolGauge'], what: 'the fluid tool\'s notices by the traveller (a switch\'s mode name, the tank\'s "empty")', status: 'handled',
      where: 'the page\'s DOM placing of #tool alone; the place itself is src/host/game-host.js toolGauge\'s, both hosts\' (round 4)' },
    { keys: ['import:src/hint-level.js#quietOr'], what: 'the hints\' quiet line for the Android pad scheme\'s notice', status: 'web-only', why: 'the notice is the Android web app\'s own pad scheme (padSchemeNotice); the scout\'s rough distance was an import nothing used' },
    // the one game setup's groups, called by both hosts (src/host/game-host.js, #427: docs/systems/engine-bridge.md "One host")
    { keys: ['shared:wireKit'], what: 'the sword and the shield only once found, the kit\'s chosen colours (backpack, sword, shield), won in the fight temples', status: 'handled', where: 'src/host/game-host.js wireKit (main.js armTool and applyKitColours before)' },
    { keys: ['shared:wireDangers'], what: 'the fires burning whoever walks into them, a world\'s deadly void (the dark below its edge)', status: 'handled', where: 'src/host/game-host.js wireDangers (main.js registerHazard(fireHazard) and worldVoid before); the void drawn by Hiraeth/PitVoid' },
    { keys: ['shared:wirePeople'], what: 'the errands, the people\'s faces while they talk, the hum when words on the screen mention it', status: 'handled', where: 'src/host/game-host.js wirePeople (main.js Errands, talkFaces, HumCue before)' },
    { keys: ['shared:wireChemistry'], what: 'the world\'s chemistry (fire spreading on the wind, creatures fleeing it, foes catching it)', status: 'handled', where: 'src/host/game-host.js wireChemistry (main.js new Chemistry before)' },
    { keys: ['shared:wireMount', 'shared:wireVehicles'], what: 'the bird\'s promise and the hoverbike, the bike by the ramp where the bird is the mount, hover vehicles skimming water, no calls into the rooms off the map', status: 'handled', where: 'src/host/game-host.js wireMount, wireVehicles (both hosts\' own copies before; the engines had no parked bike and no skimming)' },
    { keys: ['shared:wireLessons'], what: 'what the save\'s events say and start: a gadget found and its line, a keepsake\'s theme, the trials\' upgrades, Plumb\'s clock and notes', status: 'handled', where: 'src/host/game-host.js wireLessons (both hosts\' own copies before)' },
    { keys: ['shared:wireCompanion'], what: 'Plumb each frame: its escort out of the prologue, the first person near, its hints when you look lost (where to go, a makers\' house\'s step, a guardian\'s weak point), its first word (issue #434); what matters at your shoulder with its mark, and its talk in the dialogue box on its button (issue #543)', status: 'handled', where: 'src/host/game-host.js wireCompanion (both hosts\' updatePlumb before)' },
    { keys: ['shared:wireCamera', 'shared:wireHero', 'shared:heroCutFrame'], what: 'the camera kept out of the cabs and carriers; the traveller\'s own surfaces (the gear hung on him later too); the lens inside him leaving him out of the view', status: 'handled', where: 'src/host/game-host.js wireCamera, wireHero, heroCutFrame (main.js before); the shared uHeroCut is set in the engines too, its cut drawn once the port reads it (#264)' },
    { keys: ['shared:cameraFollow'], what: 'the follow camera\'s shot: a ride\'s own, behind the jets\' nose and tipped with it, the wide arm, low when knocked down, rising in a hop', status: 'handled', where: 'src/host/game-host.js cameraFollow (main.js before; the engines followed his heading alone)' },
    { keys: ['shared:wireBenches'], what: 'the benches to sit on', status: 'handled', where: 'src/host/game-host.js wireBenches (main.js createBenches before; none in the engines)' },
    { keys: ['shared:wireTrails'], what: 'the hover vehicles\' trails on the ground', status: 'handled', where: 'src/host/game-host.js wireTrails (main.js before; none in the engines); Unity draws their ribbon (MODE_RIBBON) as its Surface\'s plain mode (#264)' },
    { keys: ['shared:wireOpenings', 'shared:wireEdge'], what: 'the walls\' openings kept clear of their cracks; the ink at the world\'s edge and the wind streaming in round you', status: 'handled', where: 'src/host/game-host.js wireOpenings, wireEdge (main.js before); the edge\'s ink on the wind\'s Hiraeth/Wisp; uOpenings set in the engines, read once the port has it (#264)' },
    { keys: ['shared:wireSky'], what: 'the style preset and the planets in the sky; a level\'s zones (the Hangar\'s styles, the Lab\'s biome rooms): their look, planets and hour', status: 'handled', where: 'src/host/game-host.js wireSky (main.js setPlanets and its zones before; the engines kept the level\'s first preset and planets)' },
    { keys: ['shared:wirePotion', 'shared:wireNudges'], what: 'the potion\'s glow and lesson; a world\'s own ping, a nudge, one that waits for the notices and the talk', status: 'handled', where: 'src/host/game-host.js wirePotion, wireNudges (main.js potionGlow, potionHint, pingWhenFree before; none in the engines)' },
    { keys: ['shared:wireHealth', 'shared:hurtReactions'], what: 'the hearts on the screen (shown while fighting, after a hurt or a chime, the wallet\'s count ticking up); a hurt\'s thud and cry, a knockdown\'s heavier thud, the fade up again', status: 'handled', where: 'src/host/game-host.js wireHealth, hurtReactions (issue #435: main.js updateHealth and the Player\'s callbacks before; the engines had no thud, no tick, the hearts on a lock or a foe near rather than a fight)' },
    { keys: ['shared:wireFight', 'fn:updateRestart'], what: 'the foes and their drops, the lock-on and its camera, the flurry, the potion, the low-health cue, the knock-out\'s card', status: 'handled', where: 'src/host/game-host.js wireFight (issue #435: main.js and engine/combat.js each wired it before; the engines\' hazards bit twice a frame); the card drawn by engine/combat.js (main.js updateRestart its DOM)' },
    { keys: ['shared:wireAmbush'], what: 'the ambushes on a flight to a new world (the chime-pirates\' page on the way)', status: 'handled', where: 'src/host/game-host.js wireAmbush (issue #435): engine/game.js the ship\'s go, engine/trials.js the page\'s ways out, engine/unity/game.js the reboots on to the world' },
    { keys: ['shared:fragmentsLine', 'fn:fragmentsHtml'], what: 'the Start menu\'s line of the fragments (found, to spend)', status: 'handled', where: 'src/host/game-host.js fragmentsLine (main.js before; its HTML span fragmentsHtml the page\'s); engine/unity/game.js saveLine' },
    { keys: ['shared:toolGauge'], what: 'the fluid tool\'s crosshair and mode while aiming (red and turned on a lock, dashed when empty, a hit\'s kick), its mode\'s name a moment on a switch, "empty" as the tank runs dry, by the traveller', status: 'handled',
      where: 'src/host/game-host.js toolGauge (issue #427, round 4): src/ui.js ToolHud\'s state to the screen\'s \'tool\' with its place, drawn by BridgeHud.Tool.cs (none in Unity before); the magic bar\'s look (its ticks, short of a shot hatched) in healthHud\'s state, drawn by BridgeHud DrawHealth' },
    { keys: ['shared:wireJumpShade'], what: 'the patch of shade under the traveller in a jump', status: 'handled',
      where: 'src/host/game-host.js wireJumpShade (issue #427, round 4; main.js made it alone before); Unity draws it with Hiraeth/JumpShade (port-format.js jumpshade)' },
    { keys: ['shared:wireShip'], what: 'the ship\'s place for quests, the scout and the Map\'s "Your ship" mark', status: 'handled', where: 'src/host/game-host.js wireShip (main.js level.ship before; the engines had none)' },
    // handled by the engines' own
    { keys: ['import:src/motion-kit/view.js#viewNow', 'import:src/motion-kit/view.js#inViewNow'], what: 'the people\'s offView from this frame\'s view (peopleLod, issue #450)', status: 'handled',
      where: 'engine/game.js: offView from inView, always (backend.peopleLod); its camera is placed after the people move, so the last frame\'s view is the one it has' },
    { keys: ['import:src/hud.js#heartsSvg', 'import:src/hud.js#KEY_SVG', 'import:src/hud.js#GREAT_KEY_SVG', 'fn:updateStamina', 'fn:restartNow', 'fn:showToast',
      'import:src/story/charge.js#chargeHud', 'import:src/story/charge.js#showChargeCard', 'import:src/story/charge.js#GIVEN', 'import:src/story/charge.js#CARD', 'import:src/passage.js#PassageCover', 'import:src/flurry.js#FlurryFx'],
    what: 'the HUD\'s page drawing (hearts, wallet, keys, stamina, knock-out, toast, charge, passage cover, flurry)', status: 'handled', where: 'the screen\'s parts the engines publish (engine/game.js, engine/combat.js), drawn by BridgeHud.cs' },
    { keys: ['import:src/quest.js#Journal', 'import:src/save-migrate.js#migrateJournal', 'import:src/levels/content.js#RELIC_BASE', 'fn:flushPlay'],
      what: 'the journal and the save\'s migrations', status: 'handled', where: 'engine/game.js engineJournal (the same key and fields); BridgeStore.cs' },
    { keys: ['import:src/changelog.js#Changelog', 'import:src/changelog.js#VERSION', 'import:src/ui.js#SettingsMenu', 'import:src/controller.js#menuNavigate', 'import:src/menu-pad.js#padConfirm',
      'fn:menuHeard', 'fn:uiSound', 'fn:pageUp', 'fn:menuRoot', 'fn:closeControllerMenu', 'fn:quitToTitle', 'fn:saveBeforeRestart', 'import:src/ui-sound.js#uiKind', 'import:src/levels/content.js#ORDER'],
    what: 'the page\'s menus, What\'s new, and their sounds', status: 'handled', where: 'engine/menus.js (BridgeMenu.cs)' },
    { keys: ['import:src/npc.js#spawnNPCsSteps', 'import:src/npc.js#registerNPCTargets', 'import:src/crowd.js#buildPeopleSteps'], what: 'the people, built a step at a time', status: 'handled', where: 'engine/game.js spawnNPCs and the crowd (all at once)' },
    { keys: ['import:src/item-icons.js#ItemIcons', 'import:src/boxes/model.js#buildItemModel', 'import:src/portrait-cache.js#PortraitCache', 'fn:pumpPortraits',
      'import:src/story/portrait-bg.js#isolate', 'import:src/story/portrait-bg.js#restore', 'import:src/story/portrait-bg.js#portraitPixelRatio'],
    what: 'the items\' pictures and the conversation\'s portraits, rendered by the page', status: 'handled', where: 'the bridge photographs its own (BridgeRunner.Portrait, engine/unity/backend.js portrait)' },
    { keys: ['fn:mapTemples'], what: 'the Map\'s ground and temples', status: 'handled', where: 'engine/game.js keeps the map\'s marks and ground (docs/systems/engine-bridge.md, "The Map\'s ground")' },
    { keys: ['import:src/gadgets/all.js#GADGETS'], what: 'every gadget', status: 'handled', where: 'engine/game.js makes the gadgets through src/gadgets (tests/engine-gadgets.test.js)' },
    { keys: ['import:src/music-store.js#startThemeDownload'], what: 'the recorded themes\' download', status: 'handled', where: 'BridgeMusic.cs downloads them into persistentDataPath (#264)' },
    { keys: ['fn:takeShot', 'fn:savePhoto'], what: 'photo mode\'s picture', status: 'handled', where: 'engine/unity/backend.js photo, BridgeHost.Photo' },
    { keys: ['fn:latchedInput'], what: 'the page\'s input latched between frames', status: 'handled', where: 'the engines send their keys each frame (g.key)' },
    // web only
    { keys: ['import:src/pipeline.js#createGBuffer', 'import:src/pipeline.js#createComposeTarget', 'import:src/pipeline.js#createBlit', 'import:src/pipeline.js#createSmaa', 'import:src/pipeline.js#aaOf',
      'import:src/pipeline.js#setSubject', 'import:src/post.js#createBloom', 'import:src/post.js#DEBUG_VIEWS', 'import:src/shadows.js#Cascade', 'import:src/shadows.js#FINE_CASCADE', 'import:src/shadows.js#NEAR_CASCADE',
      'import:src/shadows.js#ShadowCuller', 'import:src/shadows.js#shadowVariants', 'import:src/shadows.js#shadowDirection', 'import:src/shadows.js#farPassSkips', 'import:src/shadows.js#VIEW_SLACK',
      'import:src/shadows.js#viewOf', 'import:src/shadows.js#viewLeft', 'import:src/shadows.js#heroExtent', 'import:src/shadows.js#nearDue', 'import:src/shadows.js#farDue',
      'fn:shadowTexels', 'fn:heroPass', 'fn:shadowPass', 'fn:tinyShadowCasters', 'fn:glowCasters', 'fn:crowdShadowless', 'fn:crowdCaster', 'fn:crowdView', 'fn:shrinkInto', 'fn:blankCapture', 'import:src/static-batch.js#StaticBatches', 'import:src/static-batch.js#opaqueSort',
      'import:src/materials.js#setEnvGround', 'import:src/blade-shader.js#BLADE_QUALITY', 'import:src/blade-shader.js#bladeLiteFor', 'import:src/breathe-shader.js#breatheDetail'],
    what: 'the page\'s render pipeline and its shaders\' settings', status: 'web-only', why: PAGE },
    { keys: ['import:src/warm-shaders.js#warmShadersSliced', 'import:src/warm-shaders.js#firstUse', 'import:src/warm-shaders.js#settle', 'import:src/warm-shaders.js#programKind', 'import:src/warm-shaders.js#oneAtATime',
      'fn:warmShaders', 'fn:warmShadersSliced', 'fn:allDone', 'fn:setStep', 'import:src/passage.js#WarmDraw', 'import:src/passage.js#warmPasses', 'import:src/load-steps.js#slicer', 'import:src/load-steps.js#gatedSlicer',
      'import:src/load-steps.js#runStepsAsync', 'import:src/load-steps.js#gpuPacer', 'import:src/load-steps.js#nextFrame', 'import:src/load-steps.js#loadWatchdog', 'import:src/skeleton-update.js#installSkeletonUpdate', 'import:engine/scene-matrices.js#catchUpShown', 'import:src/empty-instances.js#EmptyInstances', 'import:src/flat-pass.js#flatPasses'],
    what: 'the page\'s loading in slices, its shader warm-up and its matrix shortcuts', status: 'web-only', why: 'the page\'s own loading and three.js shortcuts; the engines load in their VM and keep their own matrices (engine/scene-matrices.js)' },
    { keys: ['import:src/perf.js#tileSceneSteps', 'import:src/perf.js#fitBounds', 'import:src/perf.js#waterContactOn', 'import:src/perf.js#RoomCuller', 'import:src/perf.js#InteriorCuller', 'import:src/perf.js#resolveQuality',
      'import:src/perf.js#detectHandheld', 'import:src/perf.js#detectDeck', 'import:src/perf.js#phoneBrowser', 'import:src/perf.js#GpuTimer', 'import:src/perf.js#adaptScale', 'import:src/perf.js#engineLabel', 'import:src/perf.js#cacheUniformArrays',
      'import:src/perf.js#pinRenderFrame', 'import:src/frame-pace.js#FramePacer', 'import:src/lod.js#lodView', 'import:src/skinned-lod.js#skinnedLods', 'import:src/flora.js#buildFloraSteps',
      'import:src/characters/traveller-lod.js#buildTravellerLod',
      'fn:makeRoomCull', 'fn:makeLod', 'fn:movers', 'fn:applyQuality', 'fn:adaptQuality', 'fn:gpuName', 'fn:missedFrames', 'fn:frameReadout',
      'import:src/xbox.js#xboxReadout', 'import:src/ui.js#isTouch', 'import:src/ui.js#isNativeApp', 'import:src/ui.js#isDeckApp', 'import:src/ui.js#isXboxApp'],
    what: 'the page\'s performance: culling, detail, the frame\'s pace, the device\'s detection', status: 'web-only', why: 'the engines take their preset by -quality (engine/game.js QUALITY_PRESETS) and cull and pace with Unity\'s own' },
    { keys: ['import:src/native-pad.js#installNativePad', 'import:src/native-pad.js#watchLabels', 'import:src/native-app.js#installAppShell', 'import:src/native-app.js#markBooted',
      'import:src/bindings.js#PAD_SCHEME', 'import:src/bindings.js#PAD_SCHEME_KEY', 'fn:padSchemeNotice', 'import:src/ui.js#TouchControls', 'import:src/fluid-tool.js#bindToolMouse'],
    what: 'the Android web app\'s shell and pad names, touch controls, the mouse', status: 'web-only', why: 'the web build\'s inputs and app shell; the Unity players read their pads through Unity\'s Input System' },
    { keys: ['import:src/hitbox-overlay.js#HitboxOverlay', 'import:src/hitboxes.js#hitboxes', 'import:src/hitboxes.js#registerHitboxes', 'fn:toggleHitboxes', 'fn:toggleInputs',
      'fn:devToggles', 'fn:worldTeleport', 'fn:worldFilm', 'fn:showPicker', 'import:src/input-display.js#inputDisplay', 'import:src/world-picker.js#fillPicker', 'import:src/world-picker.js#pickHref', 'import:src/world-picker.js#buildInfo',
      'import:src/issue-draft.js#ShotDrafts', 'import:src/issue-draft.js#grabFrame', 'import:src/issue-draft.js#shotJpeg', 'import:src/issue-draft.js#shotContext', 'import:src/world-debug.js#cinematicsFor',
      'import:src/pose-report.js#installPoseReport'],
    what: 'the dev tools: hitboxes, inputs, teleports, films, the picker, the Notes screenshot, the pose report', status: 'web-only', why: 'developer tools on the page (the engines have their own command-line switches)' },
  ],
};

/**
 * The sequences' differences (issue #429, engine/sequences.js): what a beat's state shows on the web and not in the
 * engines' bundle, or the other way, that is known. Each { seq, beat (globs, default '*'), keys (globs of compareBeat's
 * keys: 'part-:lock', 'obj+:ink', 'menu.rows'…), status (STATUSES), and its issue (a gap), why (web only) or where
 * (handled) }. tests/sequences.test.js fails on a difference none of them names, and on an entry that names nothing.
 */
export const STREAM_DIFFS = [
  // ---- known gaps (the first run, 2026-10-16: scripts/unity-compare/sequences.mjs)
  { seq: 'menus', beat: 'start|settings', keys: ['menu.rows'], what: 'the Settings page\'s Language row; and the page\'s rows it hides until they apply (the jets\' and the pirates\' pitch, the developer panel), which its probe reads all the same', status: 'web-only', why: 'no localisation for now: the engines are in English only; the rest is the page\'s rows in its groups and order, the hidden ones shown as there once they apply (engine/menus.js SETTINGS_ROWS `when`, issue #264)' },
  // ---- web only
  { seq: 'menus|house-map|start-pages', beat: 'start|settings|map|controls', keys: ['menu.side'], what: 'the Start menu\'s "Debug: worlds"', status: 'web-only', why: 'a developer\'s entry on the page (the worlds picker); the engines\' debug saves are on the title' },
  { seq: 'start-pages', beat: 'controls', keys: ['menu.rows'], what: 'the Controls page\'s list for a touch screen (Move · look, Jump · use…), and its headings, Reset rows and the Run / Guard choices, which the page draws as headings and buttons its probe does not read as rows', status: 'web-only', why: 'the engines are played with a pad or keys, never a touch screen; the rest is the probe\'s reading: the engines\' page has the same sections (engine/menus.js startPageRows controls, issue #264)' },
  { seq: 'start-pages', beat: 'news', keys: ['menu.rows'], what: 'What\'s new\'s prompts in its lines: the page writes the letters of the pad it last saw ("press A"), the node VM the house form ("A / ×")', status: 'handled', where: 'the same lines; each side rewrites their prompts for its pad (src/native-pad.js promptText; Unity: setEnginePad, Xbox letters on the Xbox and the Deck, the Retroid\'s own)' },
  // ---- handled
  { seq: '*', keys: ['obj-:planet'], what: 'the sky\'s planets', status: 'handled', where: 'sent as the look\'s data, not meshes (engine/game.js fullLook planets; Unity draws them in its sky)' },
];

/**
 * What the sequences' pictures show differently in Unity (issue #429: scripts/unity-compare/sequences.mjs, its sheets),
 * the most visible first; what the state stream can't see (a shader's look, the sky, a pass). Each { seq, beat, what,
 * issue, visible (3 seen at once … 1 barely), status 'handled' + where once fixed }. Written by hand from the sheets;
 * docs/systems/bridge-gaps.md lists them.
 */
export const PICTURE_DIFFS = [
  // ---- known gaps
  { seq: 'fight', beat: 'cut|hit', what: 'the blade is a thin grey sword in Unity, not the page\'s blue fluid blade (src/blade-shader.js: materials\' BLADE_FLUID)', issue: 264, visible: 3,
    status: 'handled', where: 'Surface.shader HIRAETH_FIGHT, BladeSurface.hlsl (scripts/unity-export/blade-hlsl.mjs): its turquoise currents, cream streaks and edge, smeared through a cut as the page\'s' },
  { seq: 'fight|foes', beat: 'chimes*', what: 'a dropped chime\'s shade a white disc in Unity, the page\'s a soft violet patch (chimes.js blobMaterial); the crystal itself not yet seen in a Unity picture', issue: 264,
    status: 'handled', where: 'Hiraeth/ChimeShade (port-format.js chimeshade, issue #264 surfaces E); the foes sequence\'s chimes-rest beat shows the crystals at rest and their shade as the page\'s (CrystalSurface.hlsl)' },
  { seq: 'talk|moment-arzach2.bell|moment-edena.terraces', beat: 'beside|start|mid', what: 'people\'s barks, the speech balloons over their heads ("A visitor! On a bird!", "Shut it! Shut it!"), not drawn in Unity', issue: 264, visible: 2 },
  { seq: 'moment-perdide.crystal', what: 'the hearts and wallet show over the crystal\'s moment in Unity (the screen\'s health part up; none on the page or in node)', issue: 264,
    status: 'handled', where: 'src/foes.js: held still by a scene, nothing is fighting you (Foes.update kept `fighting` at its last value: a toad chasing as the moment began kept the hearts up); now gone from the mid beat on, the first beat still fading (wireHealth\'s 3 s)' },
  { seq: 'moment-perdide.crystal', what: 'a bellows toad and a walker in Unity\'s shot of the cave, hiding him; none in the page\'s. Not the wilds\' pack (#538: the staging begins a few frames after the world, packRest 8 s): the guards of the relic 2.6 m from where the staging puts him (foes.perdide.r0), risen in the staging\'s two frames; the page and the bundle in node read that spot as tame (a person within the wilds\' distance), Unity\'s run as wild. Not the people\'s LOD (-js-off people: the same)', issue: 538, visible: 2 },
  // ---- handled (#264, 2026-10-17: scripts/unity-compare/sequences.mjs, before and after sheets on the issue)
  { seq: 'moment-edena.terraces', beat: 'start', what: 'the far white tower and the slope before it in a cloud\'s shadow in Unity, lit on the page', issue: 264, status: 'handled',
    where: 'engine/game.js takes the world\'s own cloud shadows (level.defaults.cloudShadows, as main.js): most worlds have none, Unity drew them everywhere (Lorn all in shade)' },
  { seq: 'moment-bazaar.broadcast', beat: 'mid|late', what: 'the broadcast\'s moment turned black in Unity from four seconds in', issue: 264, status: 'handled',
    where: 'Bloom.shader Extract leaves out a pixel that is not a number: one on the white signs (glow 0.8) spread over the whole glow buffer' },
  { seq: 'menus|house-map', beat: 'map', what: 'the Map page\'s drawn ground missing in Unity (its marks on a plain sheet)', issue: 264, status: 'handled',
    where: 'engine/game.js mapSource puts what is in a shop\'s or a temple\'s room at its door (main.js mapAt): those rooms framed the map kilometres wide and lifted its rays over the ground' },
  { seq: 'fight', beat: 'hit|death', what: 'a struck foe stayed white and glowing in Unity (its death a white flash, not its ink burst)', issue: 264, status: 'handled',
    where: 'engine/mirror.js calls an object\'s onAfterRender after reading its material: a foe\'s flash (foe-react.js installFlash) is given back' },
  { seq: 'takeoff', beat: 'away', what: 'the take-off\'s warp disc see-through grey with no world\'s name in Unity, opaque with THE DESERT on the page', issue: 264, status: 'handled',
    where: 'the page\'s picture was ahead: its CSS fades ran on the wall\'s clock in slow headless Chrome; sequences.mjs runs them on the game\'s, and both now show the disc opening' },
  { seq: 'moment-arzach2.bell|moment-perdide2.pools', beat: 'late', what: 'his face close up with ink blotches on the chin and neck, a darker skin; dark drips down Vael\'s walls', issue: 264, status: 'handled',
    where: 'engine/traveller-paint.js portraitPaint (the portrait head\'s paint as wearPortraitHeadFace leaves it) and the old collar in skin (b3NeckSkin); Marks.hlsl weatherInk the web\'s hairline cracks (the grime and chips were older)' },
  { seq: 'moment-edena.terraces', beat: 'start', what: 'the builders\' wall without its carved glyphs in Unity', issue: 264, status: 'handled', where: 'Marks.hlsl glyphCarve, the web\'s inscriptions (src/glyphs.js)' },
  { seq: 'box', what: 'a dark band round his shirt at the waist in Unity, close up', issue: 264, status: 'handled', where: 'engine/traveller-paint.js fillUnfound: the overshirt\'s cut vertices take their neighbours\' colour, not black' },
  { seq: 'fight-temple|game-*', beat: 'count', what: 'the count\'s numeral larger in Unity', issue: 264, status: 'handled', where: 'BridgeHud.cs the 3-2-1 at 84 (GO at 72): the condensed face stands taller than the page\'s Futura' },
  { seq: 'temple', what: 'the key counter a "KEY ×0" box in Unity, the page\'s a key glyph', issue: 264, status: 'handled', where: 'BridgeHud.cs KeyGlyph: the page\'s KEY_SVG and GREAT_KEY_SVG drawn, ×N beside them' },
  { seq: 'menus', what: 'the buttons\' names written as words in Unity\'s menus ("LB/RB turn · A choose · B close"), the page\'s glyphs in its buttons', issue: 517, status: 'handled',
    where: 'BridgeMenu.Glyphs.cs: the page\'s .glyph for the pad in hand (engine/menus.js glyphLabels, src/pad-glyphs.js padGlyphs), in the title\'s and the Start menu\'s entries, the side tabs, the strip, the way out, the shop, and the prompt line (hintParts)' },
  { seq: 'mark', what: 'a sign of Unity\'s own ("⁖⌒") where the page draws the makers\' mark in a line', issue: 513, status: 'handled',
    where: 'BridgeHud.Mark.cs: the shared mark filled from its contours (the dialogue\'s and a balloon\'s `mark`, src/makers-mark/shape.js) in a gap the words leave' },
];
