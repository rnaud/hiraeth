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
  { path: 'src/debug-back.js', why: 'the debug pages\' back button' },
  { path: 'src/changelog-media.js', why: 'the changelog\'s pictures and how they are shot' },
  { path: 'src/gait-course.js', why: 'the gait harness\'s course (tests, the motion page)' },
];

const PAGE = 'the page\'s own drawing (G-buffer, composite, shadows, batching, warm-up): Unity draws with its own (BridgeRenderer, Composite.shader, BridgeShadowChunks)';

export const GAPS = {
  // ------------------------------------------------------------------ materials (gathered by running every world and game)
  materials: [
    // known gaps, most seen first
    { keys: ['define:FOE_SURFACE', 'define:FS_BELLY', 'define:FS_RUST', 'define:FS_BANDS', 'define:FS_GLOSS', 'define:FS_MOTTLE',
      'uniform:uFsBelly', 'uniform:uFsBellyC', 'uniform:uFsBellyW', 'uniform:uFsRust', 'uniform:uFsRustC', 'uniform:uFsRustC2', 'uniform:uFs_bands',
      'uniform:uFs_bandsC', 'uniform:uFs_bandsO', 'uniform:uFsGloss', 'uniform:uFsGlossC', 'uniform:uFsGlossW', 'uniform:uFsMottle', 'uniform:uFsMottleC'],
    what: 'the foes\' own surfaces: bellies, mottling, rust, bands, gloss (src/foe-surface.js)', status: 'gap', issue: 264, visible: 3,
    note: 'nothing of it reaches Surface.shader: the foes are their plain colours in Unity' },
    { keys: ['define:SEE_HOLE', 'uniform:uSee', 'uniform:uSeeK'], what: 'the hole a wall opens round the traveller when it hides him (makeMaterial seeThrough: the fight temples)', status: 'gap', issue: 264, visible: 3 },
    { keys: ['define:BLADE_FLUID', 'define:BLADE_DISC', 'uniform:uBlade', 'uniform:uBladeB', 'uniform:uBladeC'], what: 'the sword\'s blade: its bow along the swing, the ring a hit sends along it (src/blade-shader.js)', status: 'gap', issue: 264, visible: 2,
      note: 'the blade crosses as the fluid tool\'s surface only' },
    { keys: ['define:FALL', 'uniform:uFallA', 'uniform:uFallB'], what: 'the waterfalls\' falling water (src/waterfall-shader.js)', status: 'gap', issue: 264, visible: 2, note: '#264\'s "the waterfall a flat sheet"' },
    { keys: ['define:CHIME_CRYSTAL', 'uniform:uCrystalCore', 'uniform:uCrystalEdge', 'uniform:uCrystalDeep', 'uniform:uCrystalA', 'uniform:uCrystalB', 'uniform:uCrystalSeam', 'uniform:uCrystalC'],
      what: 'the chimes\' crystals: their facets, core and seams (src/crystal-shader.js)', status: 'gap', issue: 264, visible: 2, note: 'drawn in their plain colour' },
    { keys: ['shader:uCore,uDark,uFar,uTint'], what: 'the patch of shade under each chime crystal (src/chimes.js blobMaterial)', status: 'gap', issue: 264, visible: 2,
      note: 'a shader multiplied into the G-buffer, with no port: falls back to a Surface (to check: an unlit disc, or nothing)' },
    { keys: ['define:LAMP_TINT', 'uniform:uLampTint'], what: 'the lamps\' pools in their own colour (makeMaterial lampTint)', status: 'gap', issue: 264, visible: 2 },
    { keys: ['define:MIRROR'], what: 'reflections in still water from wherever the eye is (makeMaterial mirror: the Spheres\' lake)', status: 'gap', issue: 264, visible: 2 },
    { keys: ['define:WATER_VEINS'], what: 'Lorn\'s lake veins (src/lorn-veins.js, water-shader.js)', status: 'gap', issue: 264, visible: 2 },
    { keys: ['define:NIGHT_PAINT'], what: 'the Signal Market\'s billboards turning into night screens (makeMaterial nightPaint)', status: 'gap', issue: 264, visible: 2 },
    { keys: ['define:BREATHE', 'uniform:uBreathe'], what: 'the Buried Machine\'s moving parts (src/breathe-shader.js)', status: 'gap', issue: 264, visible: 2, note: 'held still in Unity (to check)' },
    { keys: ['define:S_THIN', 'uniform:uThinPx'], what: 'thin bars (masts\' struts, wires, vines) kept a pixel or two wide far off (src/thin.js)', status: 'gap', issue: 264, visible: 2, note: 'they break up into dashes far off (to check)' },
    { keys: ['uniform:uLineWhite'], what: 'white lines round a black shape (the shade\'s inverted ink)', status: 'gap', issue: 264, visible: 1 },
    { keys: ['uniform:uSwayPlant'], what: 'the plants\' own sway (beside the wind\'s uSway, which crosses)', status: 'gap', issue: 264, visible: 1, note: 'to check' },
    { keys: ['define:S_VGLYPH'], what: 'the banners\' glyph cells per vertex (life.js BannerSet: the City-Shaft\'s banners)', status: 'gap', issue: 264, visible: 1 },
    { keys: ['define:LINE_FAR', 'uniform:uLineFar'], what: 'a lighter line from afar (the meadow\'s flowers, flora.js FAR_LINE)', status: 'gap', issue: 264, visible: 1 },
    { keys: ['uniform:uSplatTime'], what: 'the splats\' growth on the ground (src/splat-decal.js)', status: 'gap', issue: 264, visible: 1, note: 'to check: shown whole or not at all' },
    { keys: ['uniform:uShellCenter'], what: 'a temple landmark\'s shell pattern (src/temples/landmark-materials.js)', status: 'gap', issue: 264, visible: 1 },
    { keys: ['uniform:uCutMe'], what: 'the traveller left out of the view when the lens is inside him (materials.js uHeroCut)', status: 'gap', issue: 264, visible: 1, note: 'to check' },
    { keys: ['uniform:uPortrait', 'uniform:uExpression', 'uniform:uGaze', 'uniform:uIris', 'uniform:uHeadBall', 'uniform:uPortraitHairAmount', 'uniform:uPortraitFaceAmount',
      'uniform:uPortraitBlink', 'uniform:uHeadSpeech', 'uniform:uHeadEye', 'uniform:uHeadView'],
    what: 'the faces\' numbers: expression, gaze, the iris\'s colour, the portrait\'s head-ball shading', status: 'gap', issue: 264, visible: 1,
    note: 'Figure.hlsl and TripoFace.hlsl draw eyes and mouths from uMood, uEyeLook and the traveller\'s live vectors; these never cross (to check: each person\'s iris colour)' },
    { keys: ['uniform:uHatchPx'], what: 'a room always in shade keeping its strokes clear (the ship\'s rooms)', status: 'gap', issue: 264, visible: 1 },
    { keys: ['uniform:uFarNear', 'uniform:uFarScale'], what: 'the fires\' far depth (src/story/flames.js: what is past a fire drawn as far)', status: 'gap', issue: 264, visible: 0 },
    { keys: ['define:METAL_BRUSHED'], what: 'brushed metal (the port sends a brush axis with every metal, brushed or not)', status: 'gap', issue: 264, visible: 1, note: 'to check' },
    { keys: ['uniform:uMover'], what: 'a moving thing\'s flag in the G-buffer (the web\'s ink kept steady on it)', status: 'gap', issue: 264, visible: 0, note: 'to check' },
    { keys: ['shader:(none)'], what: 'the crowd\'s shadow-only material (src/crowd.js crowdDepthMaterial: no colour written)', status: 'gap', issue: 264, visible: 0,
      note: 'to check that Unity draws nothing with it (it has no port: a Surface)' },
    // handled
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
    { keys: ['site:src/door-light.js:ShaderMaterial'], count: { 'site:src/door-light.js:ShaderMaterial': 1 }, what: 'a way through\'s light', status: 'handled', where: 'Hiraeth/DoorLight' },
    { keys: ['site:src/veil.js:ShaderMaterial'], count: { 'site:src/veil.js:ShaderMaterial': 1 }, what: 'the see-through surfaces\' wash', status: 'handled', where: 'Hiraeth/Veil' },
    { keys: ['site:src/story/flames.js:ShaderMaterial'], count: { 'site:src/story/flames.js:ShaderMaterial': 2 }, what: 'the fires', status: 'handled', where: 'Hiraeth/Flame (the far depth patch: materials uFarNear)' },
    { keys: ['site:src/ship/approach.js:ShaderMaterial'], count: { 'site:src/ship/approach.js:ShaderMaterial': 2 }, what: 'the planets on the galactic map and the approach, a flat colour', status: 'handled', where: 'Hiraeth/Planet; the flat colour as a Surface plain' },
    { keys: ['site:src/ship/hologram.js:ShaderMaterial'], count: { 'site:src/ship/hologram.js:ShaderMaterial': 3 }, what: 'the recordings\' figures in light, their beam, the overlay\'s blend', status: 'handled', where: 'Hiraeth/HoloFigure (\'holo\'), the beam \'hidden\', the figures hung in the mirrored scene (issue #394)' },
    { keys: ['site:src/post.js:ShaderMaterial'], count: { 'site:src/post.js:ShaderMaterial': 2 }, what: 'the composite (the Moebius look) and the bloom', status: 'handled', where: 'Composite.shader, Bloom.shader' },
    { keys: ['site:src/characters/traveller-b3.js:onBeforeCompile'], count: { 'site:src/characters/traveller-b3.js:onBeforeCompile': 1 }, what: 'the coral-shirt traveller\'s drawn face', status: 'handled', where: 'TripoFace.hlsl (port-format.js tripoFace, the live vectors uTfBrowA…)' },
    { keys: ['site:src/characters/tripo-cloth.js:ShaderMaterial', 'site:src/characters/tripo-cloth.js:onBeforeCompile', 'site:src/characters/tripo-cloth.js:MeshStandardMaterial',
      'site:src/characters/tripo-garment-geometry.js:onBeforeCompile', 'site:src/characters/tripo-garment-geometry.js:MeshStandardMaterial'],
    count: { 'site:src/characters/tripo-cloth.js:ShaderMaterial': 1, 'site:src/characters/tripo-cloth.js:onBeforeCompile': 1, 'site:src/characters/tripo-cloth.js:MeshStandardMaterial': 1, 'site:src/characters/tripo-garment-geometry.js:onBeforeCompile': 1, 'site:src/characters/tripo-garment-geometry.js:MeshStandardMaterial': 2 },
    what: 'the overshirt\'s cloth and the garments as loaded', status: 'handled', where: 'BridgeCloth.cs; the loaded garments\' lit materials are replaced by makeMaterial before they are drawn (none reaches the bridge in any world)' },
    { keys: ['site:src/chimes.js:ShaderMaterial'], count: { 'site:src/chimes.js:ShaderMaterial': 1 }, what: 'the patch of shade under the chimes', status: 'gap', issue: 264, visible: 2, note: 'materials shader:uCore,uDark,uFar,uTint' },
    { keys: ['site:src/crowd.js:ShaderMaterial'], count: { 'site:src/crowd.js:ShaderMaterial': 1 }, what: 'the crowd\'s shadow-only material', status: 'gap', issue: 264, visible: 0, note: 'materials shader:(none)' },
    { keys: ['site:src/splat-decal.js:ShaderMaterial'], count: { 'site:src/splat-decal.js:ShaderMaterial': 1 }, what: 'the splats on the ground', status: 'gap', issue: 264, visible: 1, note: 'a Surface, without its growth (materials uniform:uSplatTime)' },
    { keys: ['site:src/jump-shadow.js:ShaderMaterial'], count: { 'site:src/jump-shadow.js:ShaderMaterial': 1 }, what: 'the patch of shade under the traveller in a jump', status: 'gap', issue: 264, visible: 2, note: 'engine/game.js makes no JumpShadow (host import:src/jump-shadow.js#JumpShadow)' },
    { keys: ['site:src/water.js:ShaderMaterial'], count: { 'site:src/water.js:ShaderMaterial': 3 }, what: 'the water\'s depth copy, its contact foam and the pass over it under water (tint, banded fog, the sun\'s sparkle)', status: 'gap', issue: 264, visible: 2,
      note: 'the water\'s surface crosses (Surface WATER); the pass over it doesn\'t (passes src/main.js and src/water.js)' },
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
    { keys: ['src/main.js: render(wind.scene)', 'src/wind.js: new Scene this.scene'], what: 'the wind\'s wisps, drawn over the ink', status: 'handled', where: 'engine/game.js hangs them in the mirrored scene (Hiraeth/Wisp)' },
    { keys: ['src/main.js: render(motes.scene)', 'src/life.js: new Scene this.scene'], what: 'the dust motes, drawn over the ink', status: 'handled', where: 'engine/game.js takes them into the mirrored scene (motePoints; Hiraeth/Mote)' },
    { keys: ['src/main.js: render(sc)'], what: 'a makers\' house\'s air (src/temples/air.js)', status: 'handled', where: 'engine/game.js makes HouseAir with the scene as its host' },
    { keys: ['src/main.js: level.veils.render(renderer)', 'src/veil.js: new Scene this.scene', 'src/veil.js: render(this.scene)'], what: 'the see-through surfaces\' wash', status: 'handled', where: 'Hiraeth/Veil, drawn in the scene over the ink' },
    { keys: ['src/main.js: HOLO.render(renderer)', 'src/ship/hologram.js: new Scene scene', 'src/ship/hologram.js: render(this.scene)', 'src/ship/hologram.js: render(overlay.scene)'],
      what: 'the recordings\' hologram (the father\'s message)', status: 'handled', where: 'engine/game.js hangs HOLO.scene in the mirrored scene (issue #394)' },
    { keys: ['src/water.js: render(scene)', 'src/water.js: render(b.mesh)', 'src/water.js: copy.render(renderer)', 'src/water.js: render(c.quad)', 'src/water.js: new Scene this.scene', 'src/water.js: render(this.scene)'],
      what: 'the water\'s passes: drawn last over the scene\'s depth (its contact foam), the depth copy, and over the finished picture (under water: the tint and banded fog; the sun\'s sparkle)', status: 'gap', issue: 264, visible: 2,
      note: 'the surface crosses; the pass over the picture has no Unity side (to check: #264\'s streak in the Underwater City)' },
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
    { keys: ['src/ship/homecoming.js'], count: { 'src/ship/homecoming.js': 15 }, parts: ['cargo', 'endCard'], what: 'the homecoming\'s credits rolling up the screen', status: 'gap', issue: 430, visible: 1,
      note: 'the cargo check and the end card are drawn (the cargo and endCard parts, BridgeHud.Parts.cs); the credits\' page is said as subtitles, a line at a time (tests/engine-finishable.test.js)' },
    // handled: drawn from the screen's parts, or the engines' own menus
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
      status: 'handled', where: 'the health, stamina, keys, restart and photo parts, BridgeHud.cs; the picker and loading screen are the page\'s (host)' },
    { keys: ['src/boxes/card.js'], count: { 'src/boxes/card.js': 6 }, parts: ['boxCard'], what: 'a makers\' box\'s card', status: 'handled', where: 'the boxCard part, BridgeHud.cs' },
    { keys: ['src/gadgets/hud.js'], count: { 'src/gadgets/hud.js': 13 }, parts: ['gadget', 'gadgetMarks', 'gadgetWheel', 'reticle'], what: 'the gadgets\' chip, marks, wheel and reticle', status: 'handled', where: 'their parts, BridgeHud.cs' },
    { keys: ['src/minigames/kit/runner.js', 'src/minigames/kit/labels.js'], count: { 'src/minigames/kit/runner.js': 10, 'src/minigames/kit/labels.js': 7 }, parts: ['minigame', 'words'], what: 'a minigame\'s HUD, card, results and floating words', status: 'handled', where: 'the minigame and words parts, BridgeHud.Games.cs' },
    { keys: ['src/minigames/drums.js', 'src/minigames/fishing.js', 'src/minigames/pirates.js', 'src/minigames/sketchhunt.js'], count: { 'src/minigames/drums.js': 3, 'src/minigames/fishing.js': 7, 'src/minigames/pirates.js': 4, 'src/minigames/sketchhunt.js': 15 },
      parts: ['drums', 'fishing', 'pirates', 'hunt'], what: 'the four minigames\' own panels', status: 'handled', where: 'their parts, BridgeHud.Games.cs' },
    { keys: ['src/minigames/lens-vault.js'], count: { 'src/minigames/lens-vault.js': 2 }, parts: ['visor'], what: 'the Lens Vault\'s visor: hearts, ARM / LENS tab, reticle, lock brackets, lens marks and reading card (issue #382)', status: 'handled', where: 'the visor part, BridgeHud.Games.cs DrawVisor' },
    { keys: ['src/foes.js', 'src/lock-reticle.js', 'src/low-health.js', 'src/flurry.js'], count: { 'src/foes.js': 5, 'src/lock-reticle.js': 2, 'src/low-health.js': 1, 'src/flurry.js': 1 },
      parts: ['warn', 'lock', 'edges'], what: 'the foes\' warning chips, the blinding flash, the lock-on ring, the low-health and flurry edges', status: 'handled', where: 'the warn, lock and edges parts, BridgeHud.cs' },
    { keys: ['src/temples/runtime.js'], count: { 'src/temples/runtime.js': 5 }, parts: ['guardian'], what: 'the guardian\'s bar', status: 'handled', where: 'the guardian part, BridgeHud.cs DrawGuardian' },
    { keys: ['src/passage.js'], count: { 'src/passage.js': 3 }, parts: ['passage'], what: 'a way through\'s cover', status: 'handled', where: 'the passage part, BridgeHud.cs' },
    { keys: ['src/quest.js'], count: { 'src/quest.js': 2 }, what: 'the journal and the toast', status: 'handled', where: 'the toast part; the journal\'s Quests page in engine/menus.js' },
    { keys: ['src/game-menu.js', 'src/ui.js', 'src/title.js', 'src/shop-panel.js', 'src/changelog.js', 'src/ship/starmap.js'],
      count: { 'src/game-menu.js': 8, 'src/ui.js': 12, 'src/title.js': 6, 'src/shop-panel.js': 4, 'src/changelog.js': 5, 'src/ship/starmap.js': 10 },
      what: 'the game menu, the Start menu and settings, the title, the shops, What\'s new, the galactic map', status: 'handled', where: 'engine/menus.js and engine/starmap.js, BridgeMenu.cs and BridgeMenu.StarMap.cs' },
    { keys: ['src/platform.js'], count: { 'src/platform.js': 1 }, what: 'page.byId, the page\'s elements by id', status: 'handled', where: 'engine/platform.js stands in for the page' },
    { keys: ['part:carry'], what: 'what the traveller carries (src/carry.js)', status: 'handled', where: 'nothing to draw: the web draws nothing from the part either (the thing is in his hands, in the scene)' },
    // web only
    { keys: ['src/title-paint.js'], count: { 'src/title-paint.js': 5 }, what: 'the title\'s first paint', status: 'web-only', why: 'a drawing shown while the page loads its WebGL; the engines start on their own splash' },
    { keys: ['src/native-app.js', 'src/update-panel.js'], count: { 'src/native-app.js': 2, 'src/update-panel.js': 1 }, what: 'the Android app\'s shell and the web\'s update panel', status: 'web-only', why: 'the web build\'s (Capacitor); the Unity players update through BridgeUpdates and their Updates page' },
    { keys: ['src/pad-glyphs.js'], count: { 'src/pad-glyphs.js': 1 }, what: 'the pad glyphs\' style sheet', status: 'web-only', why: 'CSS for the page\'s glyphs; BridgeHud draws its own' },
    { keys: ['src/world-picker.js'], count: { 'src/world-picker.js': 12 }, what: 'the world picker (?level)', status: 'web-only', why: 'the page\'s list of worlds; the engines choose by -level and the Worlds page' },
  ],

  // ------------------------------------------------------------------ host wiring: main.js against engine/game.js (also #427's list)
  host: [
    // gaps
    { keys: ['import:src/jump-shadow.js#JumpShadow'], what: 'the patch of shade under the traveller in a jump', status: 'gap', issue: 427, visible: 2 },
    { keys: ['import:src/hazards.js#registerHazard', 'import:src/story/flames.js#fireHazard'], what: 'the fires burning whoever walks into them', status: 'gap', issue: 427, visible: 2, note: 'engine/game.js updates the hazards but registers no fire\'s (to check)' },
    { keys: ['import:src/carriers.js#cameraPhysics', 'import:src/carriers.js#keepLensOut'], what: 'the camera kept out of the cabs and carriers', status: 'gap', issue: 427, visible: 2 },
    { keys: ['import:src/player.js#heroCut', 'import:src/materials.js#keepHero'], what: 'the traveller left out of the view when the lens is inside him', status: 'gap', issue: 427, visible: 1 },
    { keys: ['import:src/benches.js#createBenches'], what: 'the benches to sit on', status: 'gap', issue: 427, visible: 2, note: '#264: "benches aren\'t in the engine yet"' },
    { keys: ['import:src/pit-void.js#worldVoid'], what: 'a world\'s void (the dark below its edge)', status: 'gap', issue: 427, visible: 2, note: 'to check: the temples\' pits cross (pitvoid)' },
    { keys: ['import:src/trail.js#Trail', 'import:src/bike-worlds.js#trailVehicles', 'import:src/bike-worlds.js#trailVehicle', 'fn:trailGround'], what: 'the hoverbike\'s trail on the ground', status: 'gap', issue: 427, visible: 2 },
    { keys: ['import:src/brush.js#BrushTrail'], what: 'the grass parting along the traveller\'s recent path', status: 'gap', issue: 427, visible: 1, note: 'the engine parts it round his feet only' },
    { keys: ['import:src/edge.js#EdgeInk'], what: 'the ink at the world\'s edges', status: 'gap', issue: 427, visible: 1, note: 'to check' },
    { keys: ['import:src/talk-face.js#talkFaces', 'import:src/talk-face.js#TALK_FACE'], what: 'the people\'s faces while they talk', status: 'gap', issue: 427, visible: 2, note: 'to check' },
    { keys: ['import:src/motion-match.js#loadMotionLibrary', 'import:src/motion-match.js#matchingSetting', 'import:src/loco-moves.js#movesSetting'], what: 'the traveller\'s motion matching and captured moves', status: 'gap', issue: 427, visible: 2,
      note: 'left out of the engines so far (engine/game.js: only the talk gestures are loaded)' },
    { keys: ['import:src/ambush.js#ambushDue', 'import:src/ambush.js#ambushHref', 'import:src/ambush.js#ambushKey', 'import:src/ambush.js#transitLinks'], what: 'the ambushes on a flight to a new world', status: 'gap', issue: 427, visible: 2 },
    { keys: ['import:src/chemistry.js#Chemistry'], what: 'the world\'s chemistry (what burns, melts, grows)', status: 'gap', issue: 427, visible: 2, note: 'to check' },
    { keys: ['import:src/wall-openings.js#wallOpenings'], what: 'the walls\' openings, flushed once a world is up', status: 'gap', issue: 427, visible: 1, note: 'to check' },
    { keys: ['import:src/quest.js#Errands', 'import:src/levels/content.js#ERRANDS'], what: 'the errands', status: 'gap', issue: 427, visible: 2, note: 'to check: the journal keeps them (engineJournal)' },
    { keys: ['import:src/story/hum.js#HumCue'], what: 'the hum when words on the screen mention it', status: 'gap', issue: 427, visible: 1 },
    { keys: ['import:src/interior-kit.js#interiorAt', 'fn:inOffMapRoom'], what: 'which room the traveller is in (the map, the rooms\' culling)', status: 'gap', issue: 427, visible: 1, note: 'to check' },
    { keys: ['import:src/fragment-shop.js#fragmentPurse', 'fn:fragmentsLine'], what: 'the fragments\' purse line', status: 'gap', issue: 427, visible: 1, note: 'to check' },
    { keys: ['import:src/hud.js#magicHud'], what: 'the magic bar', status: 'gap', issue: 427, visible: 1, note: 'to check: the health part carries magic' },
    { keys: ['import:src/minigames/kit/arcade.js#arcadeLinks'], what: 'a game reached from the Arcade going back to it, its cards\' previous and next', status: 'gap', issue: 427, visible: 1 },
    { keys: ['import:src/player.js#jetCameraPitch', 'import:src/player.js#WIDE'], what: 'the camera\'s pitch behind the jets, the wide lens', status: 'gap', issue: 427, visible: 1, note: 'to check' },
    { keys: ['import:src/weather.js#WEATHER_KINDS'], what: 'the weather\'s kinds (main.js\'s dev toggles)', status: 'handled', where: 'engine/game.js runs Weather itself; the list is for the page\'s toggles' },
    { keys: ['fn:potionGlow', 'fn:potionHint'], what: 'the potion\'s glow and hint', status: 'gap', issue: 427, visible: 1, note: 'to check' },
    { keys: ['fn:hearWords', 'fn:pingWhenFree'], what: 'a line heard once free (the page\'s timing of words and pings)', status: 'gap', issue: 427, visible: 1, note: 'to check' },
    { keys: ['fn:setPlanets'], what: 'the planets in the sky', status: 'gap', issue: 427, visible: 1, note: 'to check' },
    { keys: ['fn:placeToolGauge'], what: 'the fluid tool\'s gauge by the traveller', status: 'gap', issue: 427, visible: 1, note: 'to check' },
    { keys: ['import:src/scout.js#roughDistance', 'import:src/hint-level.js#quietOr'], what: 'the scout\'s find said with a rough distance, the hints\' quiet line', status: 'gap', issue: 427, visible: 1, note: 'to check: engine/game.js says the find its own way' },
    // the one game setup's groups, called by both hosts (src/host/game-host.js, #427: docs/systems/engine-bridge.md "One host")
    { keys: ['shared:wireKit'], what: 'the sword and the shield only once found, the kit\'s chosen colours (backpack, sword, shield), won in the fight temples', status: 'handled', where: 'src/host/game-host.js wireKit (main.js armTool and applyKitColours before)' },
    // handled by the engines' own
    { keys: ['import:src/hud.js#heartsSvg', 'import:src/hud.js#walletTick', 'import:src/hud.js#KEY_SVG', 'import:src/hud.js#GREAT_KEY_SVG', 'fn:updateStamina', 'fn:restartNow', 'fn:showToast',
      'import:src/story/charge.js#chargeHud', 'import:src/story/charge.js#showChargeCard', 'import:src/story/charge.js#GIVEN', 'import:src/story/charge.js#CARD', 'import:src/passage.js#PassageCover', 'import:src/flurry.js#FlurryFx'],
    what: 'the HUD\'s page drawing (hearts, wallet, keys, stamina, knock-out, toast, charge, passage cover, flurry)', status: 'handled', where: 'the screen\'s parts the engines publish (engine/game.js, engine/combat.js), drawn by BridgeHud.cs' },
    { keys: ['import:src/quest.js#Journal', 'import:src/save-migrate.js#migrateJournal', 'import:src/boxes/index.js#migrateSave', 'import:src/levels/content.js#RELIC_BASE', 'fn:flushPlay'],
      what: 'the journal and the save\'s migrations', status: 'handled', where: 'engine/game.js engineJournal (the same key and fields); BridgeStore.cs' },
    { keys: ['import:src/changelog.js#Changelog', 'import:src/changelog.js#VERSION', 'import:src/ui.js#SettingsMenu', 'import:src/controller.js#menuNavigate', 'import:src/menu-pad.js#padConfirm',
      'fn:menuHeard', 'fn:uiSound', 'fn:pageUp', 'fn:menuRoot', 'fn:closeControllerMenu', 'fn:quitToTitle', 'fn:saveBeforeRestart', 'import:src/ui-sound.js#uiKind', 'import:src/levels/content.js#ORDER'],
    what: 'the page\'s menus, What\'s new, and their sounds', status: 'handled', where: 'engine/menus.js (BridgeMenu.cs)' },
    { keys: ['import:src/npc.js#spawnNPCsSteps', 'import:src/npc.js#registerNPCTargets', 'import:src/crowd.js#buildPeopleSteps'], what: 'the people, built a step at a time', status: 'handled', where: 'engine/game.js spawnNPCs and the crowd (all at once)' },
    { keys: ['import:src/item-icons.js#ItemIcons', 'import:src/boxes/model.js#buildItemModel', 'import:src/portrait-cache.js#PortraitCache', 'fn:pumpPortraits',
      'import:src/story/portrait-bg.js#isolate', 'import:src/story/portrait-bg.js#restore', 'import:src/story/portrait-bg.js#portraitPixelRatio'],
    what: 'the items\' pictures and the conversation\'s portraits, rendered by the page', status: 'handled', where: 'the bridge photographs its own (BridgeRunner.Portrait, engine/unity/backend.js portrait)' },
    { keys: ['fn:mapAt', 'fn:mapTemples'], what: 'the Map\'s ground and temples', status: 'handled', where: 'engine/game.js keeps the map\'s marks and ground (docs/systems/engine-bridge.md, "The Map\'s ground")' },
    { keys: ['import:src/gadgets/all.js#GADGETS'], what: 'every gadget', status: 'handled', where: 'engine/game.js makes the gadgets through src/gadgets (tests/engine-gadgets.test.js)' },
    { keys: ['import:src/music-store.js#startThemeDownload'], what: 'the recorded themes\' download', status: 'handled', where: 'BridgeMusic.cs downloads them into persistentDataPath (#264)' },
    { keys: ['fn:takeShot', 'fn:savePhoto'], what: 'photo mode\'s picture', status: 'handled', where: 'engine/unity/backend.js photo, BridgeHost.Photo' },
    { keys: ['fn:latchedInput'], what: 'the page\'s input latched between frames', status: 'handled', where: 'the engines send their keys each frame (g.key)' },
    // web only
    { keys: ['import:src/pipeline.js#createGBuffer', 'import:src/pipeline.js#createComposeTarget', 'import:src/pipeline.js#createBlit', 'import:src/pipeline.js#createSmaa', 'import:src/pipeline.js#aaOf',
      'import:src/pipeline.js#setSubject', 'import:src/post.js#createBloom', 'import:src/post.js#DEBUG_VIEWS', 'import:src/shadows.js#Cascade', 'import:src/shadows.js#FINE_CASCADE', 'import:src/shadows.js#NEAR_CASCADE',
      'import:src/shadows.js#ShadowCuller', 'import:src/shadows.js#shadowVariants', 'import:src/shadows.js#shadowDirection', 'import:src/shadows.js#farPassSkips', 'import:src/shadows.js#VIEW_SLACK',
      'import:src/shadows.js#viewOf', 'import:src/shadows.js#viewLeft', 'import:src/shadows.js#heroExtent', 'import:src/shadows.js#nearDue', 'import:src/shadows.js#farDue', 'import:src/shadows.js#nearEveryNow',
      'fn:shadowTexels', 'fn:heroPass', 'fn:shadowPass', 'fn:tinyShadowCasters', 'fn:glowCasters', 'fn:shrinkInto', 'fn:blankCapture', 'import:src/static-batch.js#StaticBatches', 'import:src/static-batch.js#opaqueSort',
      'import:src/materials.js#setEnvGround', 'import:src/water-shader.js#waterShared', 'import:src/blade-shader.js#BLADE_QUALITY', 'import:src/blade-shader.js#bladeLiteFor', 'import:src/breathe-shader.js#breatheDetail'],
    what: 'the page\'s render pipeline and its shaders\' settings', status: 'web-only', why: PAGE },
    { keys: ['import:src/warm-shaders.js#warmShadersSliced', 'import:src/warm-shaders.js#firstUse', 'import:src/warm-shaders.js#settle', 'import:src/warm-shaders.js#programKind', 'import:src/warm-shaders.js#oneAtATime',
      'fn:warmShaders', 'fn:warmShadersSliced', 'fn:allDone', 'fn:setStep', 'import:src/passage.js#WarmDraw', 'import:src/passage.js#warmPasses', 'import:src/load-steps.js#slicer', 'import:src/load-steps.js#gatedSlicer',
      'import:src/load-steps.js#runStepsAsync', 'import:src/load-steps.js#gpuPacer', 'import:src/load-steps.js#nextFrame', 'import:src/load-steps.js#loadWatchdog', 'import:src/skeleton-update.js#installSkeletonUpdate', 'import:engine/scene-matrices.js#catchUpShown', 'import:src/empty-instances.js#EmptyInstances'],
    what: 'the page\'s loading in slices, its shader warm-up and its matrix shortcuts', status: 'web-only', why: 'the page\'s own loading and three.js shortcuts; the engines load in their VM and keep their own matrices (engine/scene-matrices.js)' },
    { keys: ['import:src/perf.js#tileSceneSteps', 'import:src/perf.js#fitBounds', 'import:src/perf.js#waterContactOn', 'import:src/perf.js#RoomCuller', 'import:src/perf.js#InteriorCuller', 'import:src/perf.js#resolveQuality',
      'import:src/perf.js#detectHandheld', 'import:src/perf.js#detectDeck', 'import:src/perf.js#GpuTimer', 'import:src/perf.js#adaptScale', 'import:src/perf.js#engineLabel', 'import:src/perf.js#cacheUniformArrays',
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
      'import:src/issue-draft.js#ShotDrafts', 'import:src/issue-draft.js#grabFrame', 'import:src/issue-draft.js#shotJpeg', 'import:src/issue-draft.js#shotContext', 'import:src/world-debug.js#cinematicsFor'],
    what: 'the dev tools: hitboxes, inputs, teleports, films, the picker, the Notes screenshot', status: 'web-only', why: 'developer tools on the page (the engines have their own command-line switches)' },
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
  { seq: 'moment-*', keys: ['obj-:pitvoid'], what: 'a world\'s deadly void (src/pit-void.js worldVoid: the dark wash under its kill height) is never made by engine/game.js', status: 'gap', issue: 427 },
  { seq: 'menus', keys: ['obj-:pitvoid'], what: 'the Signal Market\'s void under its avenue (worldVoid), not made by engine/game.js', status: 'gap', issue: 427 },
  { seq: 'menus', beat: 'map', keys: ['menu.rows'], what: 'the Map has no "Your ship" mark in the engines (engine/game.js mapSource: level.ship is the page\'s)', status: 'gap', issue: 427 },
  { seq: 'menus', beat: 'items', keys: ['menu.rows'], what: 'the Items page lists the gadgets among the gear in the engines, after the gear on the page (another order of the same things owned)', status: 'gap', issue: 430 },
  { seq: 'menus', beat: 'start|settings', keys: ['menu.rows'], what: 'the Settings page: the page has Language, the jets\' pitch and longer labels, the engines Music, Effects, Voices, Mute, Hints first (engine/menus.js SETTINGS_ROWS against src/ui.js SettingsMenu)', status: 'gap', issue: 430 },
  { seq: 'fight-temple', beat: 'card', keys: ['part-:minigame', 'cam'], what: 'a fight temple\'s start card: on the page the hall seen from above with its HUD up; in the engines the traveller\'s own camera until Start', status: 'gap', issue: 264 },
  { seq: 'game-*', beat: 'run|pause', keys: ['cam.fov'], what: 'a flying minigame\'s camera: the engines widen it (74 and 65 degrees against the page\'s 60 and 58)', status: 'gap', issue: 264 },
  // ---- web only
  { seq: 'menus|house-map', beat: 'start|settings|map', keys: ['menu.side'], what: 'the Start menu\'s "Debug: worlds"', status: 'web-only', why: 'a developer\'s entry on the page (the worlds picker); the engines\' debug saves are on the title' },
  // ---- handled
  { seq: '*', keys: ['obj-:planet'], what: 'the sky\'s planets', status: 'handled', where: 'sent as the look\'s data, not meshes (engine/game.js fullLook planets; Unity draws them in its sky)' },
  { seq: 'opening', beat: 'hatch|stepout', keys: ['part-:sub', 'part+:charge'], what: 'the ship\'s line over the hatch ends sooner in node, so the charge card comes back up', status: 'handled', where: 'a subtitle lasts as long as its recording is heard; the node VM has no sound, Unity plays it and shows the line as the page does (unity.json)' },
];

/**
 * What the sequences' pictures show differently in Unity (issue #429: scripts/unity-compare/sequences.mjs, its sheets),
 * the most visible first; what the state stream can't see (a shader's look, the sky, a pass). Each { seq, beat, what,
 * issue, visible (3 seen at once … 1 barely) }. Written by hand from the sheets; docs/systems/bridge-gaps.md lists them.
 */
export const PICTURE_DIFFS = [
  { seq: 'moment-bazaar.broadcast', beat: 'mid|late', what: 'the broadcast\'s moment turned black in Unity from four seconds in (a starry black void where the towers and the traveller\'s close-up are); on the first run, not on the second: intermittent, to check', issue: 264, visible: 3 },
  { seq: 'menus', beat: 'map', what: 'the Map page\'s drawn ground is not there in Unity a second and a half after opening (its marks on a plain sheet; the page\'s streets and walls drawn at once)', issue: 264, visible: 3 },
  { seq: 'fight', beat: 'cut|hit|death|chimes', what: 'the blade\'s cut is a thin grey sword and a white flare in Unity, not the page\'s blue fluid arcs; a foe\'s death a white flash, not its ink burst; a chime a white ball', issue: 264, visible: 3 },
  { seq: 'takeoff', beat: 'away', what: 'the take-off\'s warp disc opens see-through grey in Unity with the ship behind it and no world\'s name; on the page an opaque night disc with THE DESERT', issue: 264, visible: 2 },
  { seq: 'moment-perdide.crystal', what: 'the hearts and wallet show over the crystal\'s moment in Unity (the screen\'s health part up; none on the page or in node)', issue: 264, visible: 2 },
  { seq: 'moment-arzach2.bell|moment-perdide2.pools', beat: 'late', what: 'his face close up: dark ink blotches on the chin and neck and a darker skin in Unity; behind him in Vael dark drip shapes down the wall', issue: 264, visible: 2 },
  { seq: 'moment-edena.terraces', beat: 'start', what: 'the builders\' wall without its carved glyphs in Unity (plain panels), the far white tower drawn dark grey', issue: 264, visible: 2 },
  { seq: 'box', what: 'a dark band across the back of his shirt at the waist in Unity, close up', issue: 264, visible: 1 },
  { seq: 'fight-temple|game-*', beat: 'count', what: 'the count\'s numeral larger and a duller gold in Unity', issue: 264, visible: 1 },
  { seq: 'temple', what: 'the key counter a "KEY ×0" box in Unity, the page\'s a key glyph', issue: 264, visible: 1 },
];
