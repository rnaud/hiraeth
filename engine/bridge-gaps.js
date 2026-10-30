import { MATERIAL_GAPS } from './bridge-material-gaps.js';
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
  { path: 'src/sound-effects-page/', why: 'the web-only sound-effects catalogue and explicit preview controls; shared game sound routing remains native' },
  { path: 'src/motion/', why: 'the motion lab page' },
  { path: 'src/notes-page/', why: 'the notes page' },
  { path: 'src/makers-mark/page.js', why: 'the makers\' mark page' },
  { path: 'src/makers-mark/runtime.js', why: 'the makers\' mark page\'s driver of the game' },
  { path: 'src/outfits-gallery/', why: 'the outfits gallery (#549): every outfit on the v2 traveller side by side; a dev page, not in the game' },
  { path: 'src/characters/outfit-page.js', why: 'the outfits test page for the v2 traveller (#540): its panel and readout swap outfits in a world; a dev page, not in the game' },
  { path: 'src/items-page/', why: 'the items page' },
  { path: 'src/lore-page/', why: 'the lore page' },
  { path: 'src/walkthrough-page/', why: 'the walkthrough page (#777): a page of the site, the steps the daily play-through plays' },
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
  materials: MATERIAL_GAPS,

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
    { keys: ['src/analytics-page/main.js', 'src/admin/main.js'], count: { 'src/analytics-page/main.js': 17, 'src/admin/main.js': 2 }, what: 'private administration and analytics reporting', status: 'web-only', why: 'site-only author tools; native players send to the same dataset but do not render admin pages' },
    { keys: ['src/effect-loading.js'], count: { 'src/effect-loading.js': 6 }, what: 'recoverable sound recording load failure and Retry / Back controls', status: 'handled', where: 'engine/unity/game.js catches SoundEffectsLoadError; EngineMenus.showSoundLoadFailure supplies the native title-menu Retry and Back actions before gameplay is ready' },
    { keys: ['src/sfx-trace.js'], count: { 'src/sfx-trace.js': 2 }, what: 'optional sound-effect source panel', status: 'handled', where: 'shared screen.sfxTrace state, BridgeHud.SoundSources.cs; actual muted Editor recording, procedural, loop, stop and mute views checked for #619' },
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
    { keys: ['src/hud.js', 'src/hud-view.js'], count: { 'src/hud.js': 1, 'src/hud-view.js': 1 }, parts: ['cue'], what: 'the cue line', status: 'handled', where: 'hud-state.js publishes the cue part for both hosts; BridgeHud.cs draws it in Unity' },
    { keys: ['src/main.js'], count: { 'src/main.js': 21 }, parts: ['health', 'keys', 'stamina', 'restart', 'photo'], what: 'the health, stamina, keys, knock-out card, photo hint, the tool\'s gauge, the loading screen, the picker',
      status: 'handled', where: 'the health, stamina (the ring built from src/hud-look.js STAMINA_RING, BridgeHud.cs StaminaRing, issue #710), keys, restart and photo parts, BridgeHud.cs; the picker is the page\'s (host); the loading screen BridgeHud.Loading.cs (engine/game.js onStage, issue #424; from the title\'s choice too, BridgeHost.Loading, issue #510; its bar and why line, src/load-page.js, from engine/game.js onLoad through BridgeHost.LoadProgress, issue #527)' },
    { keys: ['src/boxes/card.js'], count: { 'src/boxes/card.js': 7 }, parts: ['boxCard'], what: 'a makers\' box\'s card', status: 'handled', where: 'the boxCard part, BridgeHud.cs' },
    { keys: ['src/gadgets/hud.js'], count: { 'src/gadgets/hud.js': 13 }, parts: ['gadget', 'gadgetMarks', 'gadgetWheel', 'reticle'], what: 'the gadgets\' chip, marks, wheel and reticle', status: 'handled', where: 'their parts, BridgeHud.cs' },
    { keys: ['src/spells/hud.js'], count: { 'src/spells/hud.js': 7 }, parts: ['spell'], what: 'the spell\'s chip (ready, working, the seconds of its recovery) and the touch ✺ button', status: 'handled', where: 'the spell part, BridgeHud.cs DrawSpell (issue #667); the touch button is the page\'s (the engines have no touch cluster)' },
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
    { keys: ['src/world-scope.js', 'src/world-travel.js'], count: { 'src/world-scope.js': 2, 'src/world-travel.js': 1 }, what: 'a world swapped in place in the page (issue #790): index.html\'s elements put back, the loading page\'s look, world links caught', status: 'web-only', why: 'the page\'s own elements between worlds; the Unity bridge restarts its engine and reloads its scene for another world (BridgeRunner.RebootNow), with no page to keep' },
  ],

  // ------------------------------------------------------------------ host wiring: main.js against engine/game.js (also #427's list)
  host: [
    { keys: ['import:src/world-travel.js#startWorlds', 'import:src/world-travel.js#worldReady', 'import:src/world-travel.js#takeCarriedSound', 'import:src/world-travel.js#travel', 'import:src/world-travel.js#travelSearch', 'import:src/world-scope.js#scopeDispatcher', 'fn:runWorld', 'fn:seedDebugWorld'],
      what: 'another world swapped in place, the sound\'s context carried over (issue #790, docs/systems/world-swap.md)', status: 'web-only',
      why: 'a browser keeps a new page silent until a press, which the swap avoids; the Unity bridge has no page and no such rule: its flights restart the script engine and reload the scene (engine/unity/game.js flyTo, BridgeRunner.RebootNow), its sound starting by itself' },
    { keys: ['import:src/analytics/start-web.js#startWebAnalytics'], what: 'optional gameplay statistics', status: 'handled', where: 'engine/unity/game.js uses the same trackSession/event vocabulary through BridgeAnalytics and the shared Hiraeth HTTPS collector; older players omit collection safely' },
    { keys: ['import:src/effect-loading.js#prepareSoundWithRetry'], what: 'strict recording preparation and recoverable loading failure', status: 'handled', where: 'engine/game.js awaits Sound.prepareEffects before building the world; engine/unity/game.js presents EngineMenus.showSoundLoadFailure and retries the complete load with retryEffects' },
    // gaps
    { keys: ['import:src/motion-match.js#loadMotionLibrary'], what: 'the traveller\'s captured moves and the people\'s own walks; motion matching\'s database (only with matching switched on)', status: 'handled',
      where: 'engine/game.js loads walks.glb and moves.glb as main.js does (locoMoves by movesSetting), the database only with matchingSetting or -js-on matching, as the page (issue #427 round 4: docs/systems/engine-bridge.md "Motion matching in the engines": on the Deck the walks and moves ~90 ms of load and ~17 MB, the database ~330 ms and ~13 MB more for what no player has on)' },
    { keys: ['import:src/mark-switch.js#marksList', 'import:src/mark-switch.js#setMarksOff'], what: 'the surface patterns off and on again in the page (window.__marks, issue #694)', status: 'web-only', why: 'a measuring switch for the web\'s A/B frame timing (docs/audits/perf-materials-v2.31.md); no player ever sets it, and the port has no ?marks' },
    { keys: ['import:src/post.js#PRESETS'], what: 'the style presets\' list (main.js\'s GUI)', status: 'web-only', why: 'the page\'s lil-gui list of styles; the presets themselves are put on by src/host/game-host.js wireSky in both hosts' },
    { keys: ['import:src/weather.js#WEATHER_KINDS'], what: 'the weather\'s kinds (main.js\'s dev toggles)', status: 'handled', where: 'engine/game.js runs Weather itself; the list is for the page\'s toggles' },
    { keys: ['fn:placeToolGauge'], what: 'the fluid tool\'s notices by the traveller (a switch\'s mode name, the tank\'s "empty")', status: 'handled',
      where: 'the page\'s DOM placing of #tool alone; the place itself is src/host/game-host.js toolGauge\'s, both hosts\' (round 4)' },
    { keys: ['import:src/hint-level.js#quietOr'], what: 'the hints\' quiet line for the Android pad scheme\'s notice', status: 'web-only', why: 'the notice is the Android web app\'s own pad scheme (padSchemeNotice); the scout\'s rough distance was an import nothing used' },
    // the one game setup's groups, called by both hosts (src/host/game-host.js, #427: docs/systems/engine-bridge.md "One host")
    { keys: ['shared:wireKit'], what: 'the sword and the shield only once found, the kit\'s chosen colours (battery, sword, shield), won in the fight temples', status: 'handled', where: 'src/host/game-host.js wireKit (main.js armTool and applyKitColours before)' },
    { keys: ['shared:wireDangers'], what: 'the fires burning whoever walks into them, a world\'s deadly void (the dark below its edge)', status: 'handled', where: 'src/host/game-host.js wireDangers (main.js registerHazard(fireHazard) and worldVoid before); the void drawn by Hiraeth/PitVoid' },
    { keys: ['shared:wirePeople'], what: 'the errands, the people\'s faces while they talk, the hum when words on the screen mention it', status: 'handled', where: 'src/host/game-host.js wirePeople (main.js Errands, talkFaces, HumCue before)' },
    { keys: ['shared:wireChemistry'], what: 'the world\'s chemistry (fire spreading on the wind, creatures fleeing it, foes catching it)', status: 'handled', where: 'src/host/game-host.js wireChemistry (main.js new Chemistry before)' },
    { keys: ['shared:wireMount', 'shared:wireVehicles'], what: 'the bird\'s promise and the hoverbike, the bike by the ramp where the bird is the mount, hover vehicles skimming water, no calls into the rooms off the map', status: 'handled', where: 'src/host/game-host.js wireMount, wireVehicles (both hosts\' own copies before; the engines had no parked bike and no skimming)' },
    { keys: ['shared:wireLessons'], what: 'what the save\'s events say and start: a gadget found and its line, a keepsake\'s theme, the trials\' upgrades, Plumb\'s clock and notes', status: 'handled', where: 'src/host/game-host.js wireLessons (both hosts\' own copies before)' },
    { keys: ['shared:wireCompanion'], what: 'Plumb each frame: its escort out of the prologue, the first person near, its hints when you look lost (where to go, a makers\' house\'s step, a guardian\'s weak point), its first word (issue #434); what matters at your shoulder with its mark, and its talk in the dialogue box on its button (issue #543)', status: 'handled', where: 'src/host/game-host.js wireCompanion (both hosts\' updatePlumb before)' },
    { keys: ['shared:wireCamera', 'shared:wireHero', 'shared:heroCutFrame'], what: 'the camera kept out of the cabs and carriers; the traveller\'s own surfaces (the gear hung on him later too); the lens inside him leaving him out of the view', status: 'handled', where: 'src/host/game-host.js wireCamera, wireHero, heroCutFrame (main.js before); the shared uHeroCut is set in the engines too, its cut drawn once the port reads it (#264)' },
    { keys: ['shared:cameraFollow'], what: 'the follow camera\'s shot: a ride\'s own, behind the jets\' nose and tipped with it, the wide arm, low when knocked down, rising in a hop', status: 'handled', where: 'src/host/game-host.js cameraFollow (main.js before; the engines followed his heading alone)' },
    { keys: ['shared:wireBenches'], what: 'the benches to sit on', status: 'handled', where: 'src/host/game-host.js wireBenches (main.js createBenches before; none in the engines)' },
    { keys: ['shared:wireTrails'], what: 'the hover vehicles\' trails on the ground', status: 'handled', where: 'src/host/game-host.js wireTrails (main.js before; none in the engines); Unity draws their ribbon (MODE_RIBBON) with Surface.shader\'s own branch: the five bands along aFold.x (packed with the bind: engine/unity/backend.js), the fluid\'s tones when the backpack powers it, the tail dithered out by aFold.y, on the full variant (BridgeRenderer.Lean "ribbon"; issue #568)' },
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
    { keys: ['import:src/hud.js#Cue', 'import:src/hud-look.js#staminaSvg', 'import:src/hud-view.js#heartsSvg', 'import:src/hud-view.js#KEY_SVG', 'import:src/hud-view.js#GREAT_KEY_SVG', 'fn:updateStamina', 'fn:restartNow', 'fn:showToast',
      'import:src/story/charge.js#chargeHud', 'import:src/story/charge.js#showChargeCard', 'import:src/story/charge.js#GIVEN', 'import:src/story/charge.js#CARD', 'import:src/passage.js#PassageCover', 'import:src/flurry.js#FlurryFx'],
    what: 'the HUD\'s page drawing (hearts, wallet, keys, stamina, knock-out, toast, charge, passage cover, flurry)', status: 'handled', where: 'the screen\'s parts the engines publish (engine/game.js, engine/combat.js), drawn by BridgeHud.cs' },
    { keys: ['import:src/quest.js#Journal', 'import:src/save-migrate.js#migrateJournal', 'import:src/levels/content.js#NPC_BASE', 'fn:flushPlay'],
      what: 'the journal and the save\'s migrations', status: 'handled', where: 'engine/game.js engineJournal (the same key and fields); BridgeStore.cs' },
    { keys: ['import:src/changelog.js#Changelog', 'import:src/changelog.js#VERSION', 'import:src/ui.js#SettingsMenu', 'import:src/controller.js#menuNavigate', 'import:src/menu-pad.js#padConfirm',
      'fn:menuHeard', 'fn:uiSound', 'fn:pageUp', 'fn:menuRoot', 'fn:closeControllerMenu', 'fn:quitToTitle', 'fn:saveBeforeRestart', 'import:src/ui-sound.js#uiKind', 'import:src/levels/content.js#ORDER'],
    what: 'the page\'s menus, What\'s new, and their sounds', status: 'handled', where: 'engine/menus.js (BridgeMenu.cs)' },
    { keys: ['import:src/npc.js#spawnNPCsSteps', 'import:src/npc.js#registerNPCTargets', 'import:src/crowd.js#buildPeopleSteps'], what: 'the people, built a step at a time', status: 'handled', where: 'engine/game.js spawnNPCs and the crowd (all at once)' },
    { keys: ['import:src/item-icons.js#ItemIcons', 'import:src/boxes/model.js#buildItemModel', 'import:src/portrait-cache.js#PortraitCache', 'fn:pumpPortraits',
      'import:src/story/portrait-bg.js#isolate', 'import:src/story/portrait-bg.js#restore', 'import:src/story/portrait-bg.js#portraitPixelRatio'],
    what: 'the items\' pictures and the conversation\'s portraits, rendered by the page', status: 'handled', where: 'the bridge photographs its own (BridgeRunner.Portrait, engine/unity/backend.js portrait)' },
    { keys: ['fn:ownShadowPass'], what: 'the Wardrobe preview lit by the sun with only its own shadows', status: 'handled', where: 'BridgeRunner.Wardrobe and HiraethShadows.PrepareOwn/EndOwn draw its own casters and disable world and cloud shadows (#578)' },
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
    { keys: ['import:src/warm-shaders.js#warmShadersSliced', 'import:src/warm-shaders.js#firstUse', 'import:src/warm-shaders.js#settle', 'import:src/warm-shaders.js#programKind', 'import:src/warm-shaders.js#oneAtATime', 'import:src/warm-shaders.js#lateMeshes',
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
      'import:src/pose-report.js#installPoseReport',
      'import:src/characters/traveller-v2.js#outfitList', 'fn:devTraveller', 'fn:setTraveller'],
    what: 'the dev tools: hitboxes, inputs, teleports, films, the picker, the Notes screenshot, the pose report, the v2 traveller\'s Traveller tab (issue #493: the engines dress him by the same switch through loadTraveller, engine/game.js, or -traveller v2 -outfit <id>)', status: 'web-only', why: 'developer tools on the page (the engines have their own command-line switches)' },
  ],
};

// Compatibility exports; sequence consumers import the narrow contract directly.
export { STATUSES, STREAM_DIFFS, PICTURE_DIFFS } from './bridge-stream-gaps.js';
