import * as shipSfx from './ship/sfx.js';
import { homecomingKind } from './story/ending.js';
import { updateHazards } from './hazards.js';
import * as THREE from 'three';
import { installMatrixCache } from './matrix-cache.js';
import { ReactiveWorld } from './reactive-world.js';
import { Controller, mergeControls, menuNavigate } from './controller.js';
import { padConfirm } from './menu-pad.js';
import { PAD_SCHEME, PAD_SCHEME_KEY, PAD_SCHEME_NOTE } from './bindings.js';
import { installNativePad, watchLabels, setFaces, padFaces, confirmKey, backKey } from './native-pad.js';
import { installAppShell, markBooted } from './native-app.js';
import { startThemeDownload } from './music-store.js';
import { SOUNDTRACKS, THEME_FILES } from './soundtracks.js';
import { ObservatoryQuest } from './observatory.js';
import { Scout, nextObjective, findText, roughDistance, HINT } from './scout.js';
import { guardianHint, openHint, Struggle } from './temples/hints.js';
import { hintsFor, quietOr } from './hint-level.js';
import { cueText, Cue, PlaceName, Fader, healthHud, staminaHud, findSummary, heartsSvg, magicHud, walletTick } from './hud.js';
import { resources } from './resources.js';
import { ChimeField, ChimeView, dropPolicy, connectDrops } from './chimes.js';
import { screen } from './platform.js';
import { inputKind, keyText } from './prompt-keys.js';
import { FirstSteps } from './first-steps.js';
import { t as tr } from './i18n.js';
import { Wildlife } from './wildlife.js';
import { createGBuffer, createComposeTarget, createBlit, setSubject } from './pipeline.js';
import GUI from 'lil-gui';
import { sharedUniforms, markHero, keepHero, setEnvGround } from './materials.js';
import { BLADE_QUALITY, bladeLiteFor } from './blade-shader.js';
import { wallOpenings } from './wall-openings.js';
import { createPost, createBloom, DEBUG_VIEWS, PRESETS } from './post.js';
import { LEVELS, levelById } from './levels/index.js';
import { Player, CameraRig, jetCameraPitch } from './player.js';
import { cameraPhysics, keepLensOut } from './carriers.js';
import { applyTimeOfDay, colourScript } from './timeofday.js';
import { applyEclipse } from './eclipse.js';
import { WindStreaks } from './wind.js';
import { EDGE_HINTS, EdgeInk } from './edge.js';
import { HOLO } from './ship/hologram.js';
import { Physics, dropBuriedFloraSteps } from './physics.js';
import { tileSceneSteps, cullFar, fitBounds, waterContactOn, SmallCuller, RoomCuller, InteriorCuller, resolveQuality, detectHandheld, detectDeck, GpuTimer, adaptScale, engineLabel, cacheUniformArrays, pinRenderFrame } from './perf.js';
import { LodManager, lodView } from './lod.js';
import { skinnedLods } from './skinned-lod.js';
import { buildFloraSteps, floraKeep, FLORA_WORLDS } from './flora.js';
import { buildGrass } from './flora-grass.js';
import { BrushTrail } from './brush.js';
import { Cascade, FINE_CASCADE, ShadowCuller, shadowDirection, farPassSkips, selfLitSkips, VIEW_SLACK, viewOf, viewLeft } from './shadows.js';
import { Trail } from './trail.js';
import { Flock, Motes, Footprints } from './life.js';
import { JumpShadow } from './jump-shadow.js';
import { Sound } from './audio.js';
import { Weather, WEATHER_KINDS } from './weather.js';
import { Shelter, addIndoors } from './shelter.js';
import { spawnNPCsSteps, pooledNPC, registerNPCTargets } from './npc.js';
import { spawnAliens, alienSpots } from './aliens/index.js';
import { Crowd, CROWD_DIST_CELL, CROWD_BUDGET, buildPeopleSteps } from './crowd.js';
import { Journal, Relics, Story, Errands } from './quest.js';
import { CONTENT, ERRANDS, RELIC_BASE } from './levels/content.js';
import { migrateJournal } from './save-migrate.js';
import { loadAnimationLibrary, Animator } from './animator.js';
import { loadMotionLibrary, matchingSetting } from './motion-match.js';
import { movesSetting } from './loco-moves.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadHuman, Humanoid } from './humanoid.js';
import { loadPeople, usesMakeHuman } from './makehuman/people.js';
import { talkFaces, TALK_FACE } from './talk-face.js';
import { updateHands } from './hands.js';
import { loadTravellerV1, createTravellerV1 } from './characters/traveller-v1.js';
import { buildTravellerLod } from './characters/traveller-lod.js';
import { Changelog, VERSION } from './changelog.js';
import { Settings, SettingsMenu, TouchControls, SaveGame, isTouch, isNativeApp, isDeckApp, isXboxApp, ToolHud } from './ui.js';
import { xboxReadout } from './xbox.js';
import { InputMode } from './input-mode.js';
import { FluidTool, bindToolMouse } from './fluid-tool.js';
import { ORDER } from './levels/content.js';
import { createStory } from './story/index.js';
import { knownWorlds, newlyKnown } from './story/route.js';
import { routeChart, findableNote } from './story/signature-search.js';
import { registerInteractable, PRIORITY, interactHooks } from './interact.js';
import { Ship } from './ship/ship.js';
import { birdAnswers, promisedBird } from './bird.js';
import { RIDER_CALL, RIDER_CALL_BEAT } from './story/arzach-data.js';
import { game } from './game-state.js';
import { BodyFoley } from './foley.js';
import { items, ITEMS, HARNESS_WORLD } from './items.js';
import { menuSources } from './game-menu-data.js';
import { ItemIcons } from './item-icons.js';
import { PortraitCache } from './portrait-cache.js';
import { buildItemModel } from './boxes/model.js';
import { Flammables, flammableSpots } from './flammable.js';
import { Chemistry } from './chemistry.js';
import { createChallenges } from './trials/index.js';
import { syncUpgrades } from './trials/upgrades.js';
import { createBoxes, migrateSave } from './boxes/index.js';
import { createItemEffects } from './boxes/effects.js';
import { Foes } from './foes.js';
import { setView } from './motion-kit/view.js';
import { GADGETS } from './gadgets/all.js';   // (first: the gadgets become items before anything reads ITEMS)
import { Gadgets } from './gadgets/index.js';
import { feelDt, shakeCamera, kick, selfDt, flurry, endFlurry, flurryLeft } from './feel.js';
import { FLURRY, FlurryFx } from './flurry.js';
import { DevMenu } from './dev-menu.js';
import { HitboxOverlay } from './hitbox-overlay.js';
import { hitboxes, registerHitboxes } from './hitboxes.js';
import { inputDisplay } from './input-display.js';
import { fillPicker, pickHref } from './world-picker.js';
import { WorldDebugMenu, gatherPoints, debugSections, cinematicsFor, questList, applyQuestJump, landingSpot } from './world-debug.js';
import { isolate, restore, portraitPixelRatio } from './story/portrait-bg.js';
import { chargeState, chargeHud, showChargeCard, GIVEN as CHARGE_GIVEN, CARD as CHARGE_CARD } from './story/charge.js';
import { slots, formatPlaytime, DEBUG_SLOT } from './save-slots.js';
import { Waters, BreathMeter } from './water.js';
import { Passage, PassageCover, WarmDraw, warmPasses, carryAcross, PASSAGE } from './passage.js';
import { slicer, runStepsAsync, gpuPacer, nextFrame, loadWatchdog } from './load-steps.js';
import { warmShadersSliced as warmSliced, firstUse, settle } from './warm-shaders.js';
import { waterShared } from './water-shader.js';
import { gameById, GAMES } from './minigames/index.js';
import { placeGameMarker } from './minigames/kit/marker.js';
import { MinigameRunner } from './minigames/kit/runner.js';
import { levelMetaFor } from './minigames/kit/world.js';
import { lendTool } from './minigames/kit/onfoot.js';
import { arcadeLinks } from './minigames/kit/arcade.js';
import { talkAllowed } from './ship/landing.js';
import { HumCue } from './story/hum.js';
import { ShopPanel } from './shop-panel.js';
import { rumblePlay, setRumbleSettings } from './rumble.js';
import { interiorAt } from './interior-kit.js';

// Android: the handheld's controls come from the app (native-pad.js), and prompts use its button names
installNativePad();
watchLabels();
// the scene's matrices recomposed only where something moved (src/matrix-cache.js)
installMatrixCache();

// Loading: each stage updates the inked loading screen, then yields a frame
// so it can paint (its pen animation runs on the compositor meanwhile).
const loadMsg = document.querySelector('#loading .msg');
const tLoad = performance.now();
let tStage = tLoad, lastMsg = 'start', loadStep = '';
// (a stage that runs over 15 s says which step it is on: a stalled load says where)
const loadWatch = loadWatchdog(() => (loadStep ? `${lastMsg} / ${loadStep}` : lastMsg));
// Between stages, the build gives the main thread back every LOAD_BUDGET ms (src/load-steps.js:
// await slice() as often as you like; a world's own build yields from inside itself)
const slice = slicer();
// (a stage's steps timed too, logged as one line: the load's breakdown, docs/systems/performance.md "Where a load goes")
const loadSteps = [];
let tStep = 0;
const setStep = (name) => {
  const t = performance.now();
  if (loadStep) loadSteps.push(`${loadStep} ${(t - tStep).toFixed(0)}`);
  loadStep = name; tStep = t;
};
const stage = (msg) => {
  console.info(`load: ${lastMsg} ${(performance.now() - tStage).toFixed(0)} ms`);
  setStep('');
  if (loadSteps.length) console.info(`load steps: ${lastMsg} ${loadSteps.splice(0).join(' · ')}`);
  tStage = performance.now(); lastMsg = msg; loadStep = '';
  if (loadMsg) loadMsg.textContent = msg;
  // (a frame so the screen paints, or a moment if no frame comes: a window not shown may run none)
  return nextFrame().then(() => new Promise((r) => setTimeout(() => { slice.reset(); r(); }, 0)));
};

// We author every colour as a display value and output it untouched.
THREE.ColorManagement.enabled = false;

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
cacheUniformArrays(renderer.getContext());   // (the light list and the palettes not sent again unchanged at every material: perf.js)
const pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);
// (hidden under the loading screen until the first frame: nothing for the compositor to bring along with the pen)
renderer.domElement.style.visibility = 'hidden';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.3, 5000);

// G-buffer: [0] albedo + light, [1] normal + view depth, [2] surface hatching
const gbuffer = createGBuffer({ depthTexture: true });   // (src/pipeline.js: shared with the character studio; its depth read by the water's contact foam)

// Sun shadow maps: three orthographic cascades that follow the player (src/shadows.js).
// fine = crisp character shadows, near = the street around you, far = mesas shadowing distant dunes.
// Sizes come from the graphics preset (applyQuality); bias and normal offset are in texels.
const shadowOverride = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });
const SU = sharedUniforms;
const brushTrail = new BrushTrail(sharedUniforms);   // the plants and the grass feel the traveller pass (src/brush.js)
const cascades = {
  fine: new Cascade({ name: 'fine', ...FINE_CASCADE, depth: 1600, uniforms: { map: SU.uShadowMap0, matrix: SU.uShadowMatrix0, bias: SU.uShadowBias0, offset: SU.uShadowNormalOffset0, texel: [SU.uShadowTexel, 0] } }),
  near: new Cascade({ name: 'near', size: 4096, extent: 220, depth: 1600, bias: 2.3, offset: 3.2, uniforms: { map: SU.uShadowMap, matrix: SU.uShadowMatrix, bias: SU.uShadowBias, offset: SU.uShadowNormalOffset, texel: [SU.uShadowTexel, 1] } }),
  far: new Cascade({ name: 'far', size: 2048, extent: 1150, depth: 3200, bias: 2.2, offset: 2.4, uniforms: { map: SU.uShadowMap2, matrix: SU.uShadowMatrix2, bias: SU.uShadowBias2, offset: SU.uShadowNormalOffset2, texel: [SU.uShadowTexel, 2] } }),
};
const shadowTexels = () => SU.uShadowTexel.value.set(cascades.fine.texel, cascades.near.texel, cascades.far.texel);

const post = createPost();
post.uniforms.tAlbedo.value = gbuffer.textures[0];
post.uniforms.tNormal.value = gbuffer.textures[1];
post.uniforms.tHatch.value = gbuffer.textures[2];
// glowing surfaces: a quarter-resolution glow buffer the composite draws halos from (post.js)
const bloom = createBloom(gbuffer);
post.uniforms.tBloom.value = bloom.texture;
post.uniforms.tBloom2.value = bloom.wide;
post.uniforms.uBloom.value = 1;
const blades = { grass: null, key: null, grow: null };   // the grass blades (built with the flora; regrown when the preset changes)

// Render at the selected resolution, then smooth the final colour with FXAA.
// The G-buffer stays nearest-filtered so depth and surface boundaries stay exact.
const settings = new Settings();
setRumbleSettings(settings);   // (src/rumble.js: Settings > Rumble and its intensity)
// the graphics preset (perf.js QUALITY_PRESETS); Auto runs the handheld recipe on the Android app and mobile GPUs
const gpuName = (() => {
  const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
  try { return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? ''); } catch { return ''; }
})();
const handheld = detectHandheld({ native: isNativeApp, touch: isTouch, gpu: gpuName });
const deck = detectDeck({ app: isDeckApp, gpu: gpuName });   // (Auto runs the Steam Deck recipe there)
let preset = resolveQuality(settings.quality, { handheld, deck, xbox: isXboxApp, hiDPI: pixelRatio >= 2 });   // (the Xbox app: its own preset, src/xbox.js)
const quality = { renderScale: preset.scale };
const composeRT = createComposeTarget();
const blit = createBlit(composeRT.texture);

const overlays = { motes: null, trail: null };   // sprite overlays sized with the render targets

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const pr = pixelRatio * quality.renderScale;
  const rw = Math.floor(w * pr), rh = Math.floor(h * pr);
  gbuffer.setSize(rw, rh);
  bloom.setSize(rw, rh);
  composeRT.setSize(rw, rh);
  blit.material.uniforms.resolution.value.set(1 / rw, 1 / rh);
  post.uniforms.uRes.value.set(rw, rh);
  post.uniforms.uPixelRatio.value = pr;
  sharedUniforms.uPixelRatio.value = pr;
  sharedUniforms.uViewH.value = rh;   // (thin bars' least width, src/thin.js)
  wind?.uniforms.uRes.value.set(rw, rh);
  HOLO.uniforms.uRes.value.set(rw, rh);
  if (overlays.motes) { overlays.motes.uniforms.uRes.value.set(rw, rh); overlays.motes.uniforms.uPR.value = pr; }
}
window.addEventListener('resize', () => resize());
let wind = null;
resize();

// ------------------------------------------------------------------ world
const query = new URLSearchParams(location.search);
migrateSave();   // saves from before the items: whoever finished the prologue keeps the backpack (src/boxes/index.js)
// items (src/items.js), for development: ?items=all grants everything, ?items=none takes it all
// away, ?items=backpack,glider owns exactly those (the dev menu toggles them one by one)
{
  const want = query.get('items');
  if (want) {
    const ids = want === 'all' ? Object.keys(ITEMS) : want === 'none' ? [] : want.split(',');
    for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id);
  }
}
const levelParam = query.get('level');
const viaShip = query.get('via') === 'ship';
// from the title screen (no ?level): the world this save was left in (a new game: the desert's prologue)
const resumeId = !levelParam && game.flag('prologue.done') ? SaveGame.load()?.level ?? game.flag('ship.level') : null;
// a minigame's page (?game=<id>, src/minigames/): its own arena, or the world it is played in, is the level;
// the runner (src/minigames/kit/runner.js) takes the traveller and the camera over once all is built
const minigameDef = gameById(query.get('game'));
let minigame = null;
const meta = minigameDef ? levelMetaFor(minigameDef, levelById) : levelById(levelParam) ?? levelById(resumeId) ?? LEVELS[0];
const levelId = meta.id;
const content = CONTENT[levelId];
const animLib = loadAnimationLibrary().catch((e) => { console.warn('animation library failed to load', e); return null; });
const traveller = loadTravellerV1(import.meta.env.BASE_URL).catch(e => { console.warn('Traveller v1 unavailable; using the original explorer.', e); return null; });
const humans = Promise.all([loadHuman('m'), loadHuman('f')]).catch((e) => { console.warn('human models failed to load', e); return null; });
// the people on MakeHuman bodies (src/makehuman/people.js, docs/makehuman.md: the Desert's by default, ?mh=1
// any world's, ?mh=0 none): the body's one file asked for now, while the rest loads
const mhPeople = usesMakeHuman(levelId, query.get('mh')) ? loadPeople(import.meta.env.BASE_URL, levelId).catch((e) => { console.warn('MakeHuman bodies unavailable', e); return null; }) : null;
await stage(`sketching ${meta.title.toLowerCase()}…`);
const level = meta.build ? await runStepsAsync(meta.build(scene), slice) : meta.create(scene);
if (level.gadgets === 'all') for (const g of GADGETS) items.grant(g.id);   // (the Gadget Yard: every gadget, to try them: src/levels/gadget-yard.js)
const terrain = level.ground;
// where the old walls' cracks may not run: their windows, doors and what is fixed on them (src/wall-openings.js;
// the builders added their merged pieces as they laid them)
{ const t = performance.now(); wallOpenings.collectScene(scene).flush(sharedUniforms); console.info(`wall openings: ${wallOpenings.boxes} pieces in ${(performance.now() - t).toFixed(0)} ms`); }
// what the metals see below the horizon: the world's ground (materials.js)
setEnvGround(level.envGround ?? level.ground?.mesh?.material?.uniforms?.uColor?.value);
await slice();
await stage('inking the collisions…');
// Collision against the real level geometry (built before the player / vehicles join the scene).
const t0 = performance.now();
const physics = await Physics.create(scene, level.ground.heightAt ? level.ground : null, slice, level.collision ?? {});
console.info(`collision: ${physics.triangles.toLocaleString()} triangles in ${(performance.now() - t0).toFixed(0)} ms (BVH in a worker)`);
if (level.initSteps) await runStepsAsync(level.initSteps(physics), slice); else level.init?.(physics);
await slice();
// every body of water: its look (bed maps, ripples) and swimming in it (src/water.js, src/swim.js)
const waters = new Waters(scene, { physics });
await slice();
// trees and shrubs that landed inside a house or a rock are left out (src/physics.js; window.clipAudit lists the rest)
const buriedFlora = await runStepsAsync(dropBuriedFloraSteps(scene, physics), slice);
if (buriedFlora) console.info(`flora: ${buriedFlora} buried instances left out`);
await slice();
// the traveller's ship at this world's arrival point (src/ship/); a new game opens with the prologue
// (no ?level and prologue.done unset, or ?prologue=1 to replay it)
const playPrologue = levelId === 'desert' && !viaShip && !minigameDef && (query.get('prologue') === '1' || (!levelParam && !game.flag('prologue.done')));
// coming home by ship plays a homecoming (src/ship/homecoming.js, src/story/ending.js homecomingKind): the first
// (the stone, the light over the hill), then, with Ilen, the true ending; ?ending=1 replays the first, ?ending=2 the last
const playHomecoming = (levelId === 'home' && (query.get('ending') === '1' ? 'first' : query.get('ending') === '2' ? 'final' : viaShip ? homecomingKind((k) => game.flag(k)) : null)) || false;
const ship = new Ship({ scene, physics, level, levelId, content, prologue: playPrologue || playHomecoming });
level.ship ??= { pos: ship.rampFoot.clone() };
await slice();
const auditRoots = scene.children.slice();   // the level and the ship: what the clipping audit looks over (window.clipAudit)   // quests that say "return to the ship" point at its ramp
const reactiveWorld = await runStepsAsync(ReactiveWorld.make(scene, level, physics, content), slice);
window.addEventListener('pagehide', () => reactiveWorld.flush());
await slice();
// tile world-spanning meshes so each pass only draws what it can see
const tiled = await runStepsAsync(tileSceneSteps(scene), slice);
tiled.small.push(...(level.smallProps ?? []));
await slice();
await stage('waking the people…');
// the bird's promise: under open sky, in a world with no mount of its own, the whistle calls her down (src/bird.js)
if (birdAnswers(levelId, level, (k) => game.flag(k))) { level.mount = (p) => promisedBird(p, level.spawn); level.mountName = 'bird'; }
const player = new Player(physics, {
  mount: level.mount, jetpack: level.features.jetpack, climb: level.features.climb ?? true, harnessWorld: levelId === HARNESS_WORLD,   // (the Warden's harness fires here only: src/items.js)
  killY: level.killY, limit: level.limit ?? 1900, edgeHint: level.edgeHint ?? EDGE_HINTS[levelId] ?? EDGE_HINTS.default, spawn: level.spawn, spawnHeading: level.spawnHeading,
  gravityAt: level.gravityAt, unsafe: level.unsafe, dynamic: level.dynamic, water: waters,
  // a hurt: a thud; knocked over (a hard landing: the ragdoll, src/ragdoll.js): a heavier one;
  // knocked out: the screen dims and asks to restart (updateRestart below)
  // (k: hearts, in quarters: a quarter is a tap, a heart and a half and more the heaviest)
  onHurt: (h, why) => { const k = Math.min(1, h / 1.5); shipSfx.rumble(sound, 0.35 + k * 0.4, 0.25 + k * 0.5); sound.hurt(h, why); hpShown = 3; if (why === 'foe') kick(0.45 + k * 0.5); potionHint(); if (why !== 'fall') rumblePlay('hurt', { h }); },   // (a fall rumbles as its landing: onKnockdown)
  onDrink: (got) => { sound.potion('heal'); hpShown = 3; potionGlow(got); rumblePlay('potion'); },
  onKnockdown: (dead, why) => { shipSfx.rumble(sound, dead ? 0.95 : 0.6, dead ? 0.9 : 0.45); hpShown = 3; rumblePlay(why === 'fall' && !dead ? 'land' : 'knockdown', { dead, speed: player?.lastLanding }); },
  onKnockout: (why) => { knockedOut = why; },
  onWhistle: (kind) => (kind === 'mount' && level.mountName === 'bird' ? sound.tune(RIDER_CALL, RIDER_CALL_BEAT) : sound.whistle(kind)),   // calling the bike, the bird (the rider's call, on the flute) or a taxi
  onRestart: () => { ship.cinema?.fade(1, true, 0.05); setTimeout(() => ship.cinema?.fade(0, true, 0.9), 120); },
});
// the hearts, the magic bar and the potion (index.html #health): while a heart is missing, the bar spends or
// refills, or a fight is on, and a moment after (src/hud.js healthHud, heartsSvg, magicHud; src/resources.js)
const hpEl = document.getElementById('health');
const hpHearts = hpEl?.querySelector?.('.hearts'), hpMagic = hpEl?.querySelector?.('.magic'), hpMagicFill = hpMagic?.firstElementChild;
const hpPotion = hpEl?.querySelector?.('.potion'), hpPotionN = hpPotion?.querySelector?.('b');
let hpShown = 0, hpKey = '', hpMagicKey = '', hpPotionKey = '';
// the chimes beside the potion (src/chimes.js): the count ticks up to the wallet's, the block shows a moment on a change
const hpChimes = hpEl?.querySelector?.('.chimes'), hpChimesN = hpChimes?.querySelector?.('b');
let walletShown = resources.chimes, walletDrawn = -1;
game.on('wallet', () => { hpShown = 3; if (hpChimes) { hpChimes.classList.remove('got'); void hpChimes.offsetWidth; hpChimes.classList.add('got'); } });
const hpFade = new Fader(3);   // (src/hud.js: while hurt, spending or fighting, and 3 s after)
player.setMaxHearts(resources.maxHearts);
/**
 * The potion button (KEYS.potion C, D-pad ← on a pad, the flask beside the hearts on a touch screen): the drink
 * starts (src/player.js drinkPotion: the hearts come back half-way through it), the stock gives one (infinite
 * until the shops), or a word says why not.
 */
function drinkPotion() {
  try { if (busy() || photo.on || ship.playing || !player.object?.visible) return false; } catch { return false; }   // (still loading: busy and the rest come later)
  const why = player.cantDrink();
  if (why === 'full') { sound.potion('no'); showToast(tr('potion.full')); hpShown = 3; return false; }
  if (why) return false;
  if (!resources.takePotion()) { sound.potion('no'); showToast(tr('potion.none')); return false; }
  player.drinkPotion();
  sound.potion('open'); hpShown = 3;
  hpEl?.classList.remove('drink'); void hpEl?.offsetWidth; hpEl?.classList.add('drink');
  return true;
}
/** The hearts coming back: a warm glow rising round the traveller. */
function potionGlow(got) {
  if (!(got > 0) || !player.object?.visible) return;
  const U = player.frame.up;
  for (let i = 0; i < 26; i++) tool.glow?.add({ pos: _potP.copy(player.pos).addScaledVector(U, 0.3 + Math.random() * 1.2).add(_potV.randomDirection().multiplyScalar(0.45)), vel: _potV.copy(U).multiplyScalar(0.8 + Math.random() * 1.4), drag: 1.5, size: 0.05 + Math.random() * 0.04, life: 0.7 + Math.random() * 0.5, color: i % 3 ? '#e8643c' : '#f6c84e', grow: true });
}
const _potP = new THREE.Vector3(), _potV = new THREE.Vector3();
/** Once per save, the first time a hurt leaves you short: how to drink. */
function potionHint() {
  // (a genuinely new verb with nothing on the screen to find it by: taught once, hints subtle or full: src/hint-level.js)
  if (game.flag('hint.potion') || player.hearts > player.maxHearts - 1 || player.dead || !hintsFor('teach')) return;
  game.set('hint.potion', true);
  setTimeout(() => showToast(keyText(tr('potion.hint'), { teach: true })), 900);
}
// The progression's new verbs (v1.38: the lift valve's double jump, the fluid gun, the jets on jump held), each
// taught once when its chest opens, after the card; and the choosing, once a second gadget is carried
// (a genuinely new verb: hints subtle or full, src/hint-level.js)
const TEACH_ON_FIND = { doublejump: 'hint.lift', gun: 'hint.gun', harness: 'hint.jets' };
game.on('box:opened', ({ item } = {}) => {
  const key = TEACH_ON_FIND[item] ?? (gadgets?.owned?.().length >= 2 && gadgets.owned().includes(item) ? 'hint.pick' : null);
  if (!key || game.flag(`${key}.taught`) || !hintsFor('teach')) return;
  game.set(`${key}.taught`, true);
  setTimeout(() => showToast(keyText(tr(key), { teach: true })), 4200);
});
window.addEventListener('keydown', (e) => { if (e.code === 'KeyC' && !e.repeat && !e.ctrlKey && !e.metaKey) drinkPotion(); });   // (KEYS.potion: src/remap.js sends a moved key on as C)
hpPotion?.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); drinkPotion(); });   // (the touch screen's flask)
// Knocked out (a fatal fall, or the bar run out): you lie there a moment, then the screen
// dims and a small panel asks to restart, from where you last stood safely. Its button is
// the one thing in focus: Enter (or Space, E), A / × on a pad (the panel counts as a menu:
// busy()), a click or a tap.
const restartEl = document.getElementById('restart');
let restartOpen = false, knockedOut = null, deadFor = 0;
function updateRestart(dt) {
  deadFor = player.dead ? deadFor + dt : 0;
  const want = player.dead && deadFor > 1.4 && !ship.playing;
  if (want === restartOpen || !restartEl) return;
  restartOpen = want;
  restartEl.classList.toggle('open', want);
  if (want) {
    restartEl.querySelector('p').textContent = tr(knockedOut === 'fall' ? 'restart.fall' : 'restart.out');
    if (document.pointerLockElement) document.exitPointerLock?.();
    restartEl.querySelector('button').focus({ preventScroll: true });
  }
}
function restartNow() {
  if (!player.dead) return;
  restartOpen = false; deadFor = 0; knockedOut = null;
  restartEl?.classList.remove('open');
  document.activeElement?.blur?.();
  player.restart();
  rig.target.copy(player.pos);
}
restartEl?.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); restartNow(); });
window.addEventListener('keydown', (e) => {
  if (!restartOpen || !['Enter', 'NumpadEnter', 'Space', 'KeyE'].includes(e.code)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  restartNow();
}, true);
// the stamina wheel (index.html #stamina, src/stamina.js): beside the traveller, on the screen,
// while it isn't full and a moment after; red while winded
const stEl = document.getElementById('stamina'), stArc = stEl?.querySelector('.arc');
let stShown = 0, stLast = -1;
const _stP = new THREE.Vector3(), _stR = new THREE.Vector3();
function updateStamina(dt) {
  if (!stEl) return;
  const k = THREE.MathUtils.clamp(player.stamina ?? 1, 0, 1);
  stShown = k < 0.995 || player.winded ? 0.9 : Math.max(0, stShown - dt);
  const st = staminaHud({ stamina: k, winded: player.winded, quiet: ship.playing || photo.on || !!player.ride || !!player.down || busy() }, stShown);
  const on = !!st;
  stEl.classList.toggle('on', on);
  stEl.classList.toggle('winded', !!player.winded);
  if (Math.abs(k - stLast) > 0.002) { stArc.setAttribute('stroke-dasharray', `${(k * 100).toFixed(1)} 100`); stLast = k; }
  if (!on) screen.set('stamina', null);
  if (!on && stShown <= 0) return;
  // a little up and to the right of the shoulders, as the camera sees them (platform.js screen.stamina: where, in the world)
  _stR.setFromMatrixColumn(camera.matrixWorld, 0);
  _stP.copy(player.object?.position ?? player.pos).addScaledVector(player.frame.up, 1.75).addScaledVector(_stR, 0.62);
  if (st) screen.set('stamina', { ...st, at: _stP.toArray().map((v) => +v.toFixed(2)) });
  _stP.project(camera);
  if (_stP.z > 1) return;
  const x = (_stP.x * 0.5 + 0.5) * innerWidth, y = (-_stP.y * 0.5 + 0.5) * innerHeight;
  stEl.style.transform = `translate(${(x - 17).toFixed(1)}px, ${(y - 17).toFixed(1)}px)`;
}
function updateHealth(dt) {
  updateRestart(dt);
  updateStamina(dt);
  if (!hpEl) return;
  player.setMaxHearts(resources.maxHearts);
  const h = player.health ?? 1, R = tool.owned && !tool.dry ? tool.reserve : null, pot = resources.potions;
  // (a hurt, a knockdown, a potion: at once; the state goes to platform.js screen.health as it is drawn)
  const wallet = resources.chimes, ticking = walletShown !== wallet;
  walletShown = walletTick(walletShown, wallet, dt);
  const hp = healthHud({ health: h, hearts: player.hearts, max: player.maxHearts, magic: R ? R.level : null, magicMax: R?.max ?? 3, potions: pot.count, infinite: pot.infinite,
    chimes: wallet, wallet: ticking,
    combat: document.body.classList.contains('combat'), down: player.down, hurt: hpShown > 0, quiet: ship.playing || photo.on }, hpFade, dt);
  hpShown = 0;
  screen.set('health', hp);
  hpEl.classList.toggle('on', !!hp);
  if (!hp) return;
  const key = `${hp.hearts}|${hp.max}|${hp.low}`;
  if (key !== hpKey) { hpKey = key; hpHearts.innerHTML = heartsSvg(hp.hearts, hp.max, { low: hp.low }); }
  const M = magicHud(R?.level, R?.max), mk = R ? `${M.units}|${M.short}` : 'none';
  if (mk !== hpMagicKey) { hpMagicKey = mk; hpMagic.classList.toggle('none', !R); hpMagic.classList.toggle('short', M.short); hpMagic.style.setProperty('--units', M.units); }
  if (R) hpMagicFill.style.width = `${(M.fill * 100).toFixed(1)}%`;
  const pk = `${pot.infinite}|${pot.count}`;
  if (pk !== hpPotionKey) { hpPotionKey = pk; hpPotionN.textContent = pot.infinite ? '∞' : `${pot.count}`; hpPotion.classList.toggle('none', !pot.infinite && pot.count <= 0); }
  const wn = Math.round(walletShown);
  if (hpChimes && wn !== walletDrawn) { walletDrawn = wn; hpChimesN.textContent = `${wn}`; hpChimes.classList.toggle('none', wn <= 0 && wallet <= 0); }
  hpChimes?.classList.toggle('tick', walletShown !== wallet);
}
player.vehicles.push(...(level.vehicles ?? []));
// rooms off the map, reached through doorways (the desert's chambers and the cave in the
// giant's chest, ~1 km up): no whistling the mount or hailing a taxi into them; it would
// come to the same x, z on the dunes far below and wait there
const offMapRooms = (level.portals ?? []).filter((p) => p.to && !p.toUp && p.to.y - (terrain.heightAt?.(p.to.x, p.to.z) ?? p.to.y) > 200).map((p) => p.to);
const inOffMapRoom = () => offMapRooms.some((r) => r.distanceToSquared(player.pos) < 90 * 90);
player.opts.canSummon = () => !inOffMapRoom() && !ship?.inside;   // (nor from inside the ship)
await slice();
const lib = await animLib;
if (lib) {
  player.animator = player._animator = new Animator(lib, player.char);
  console.info('clip ground speeds (m/s):', Object.fromEntries(Object.entries(lib.native).map(([k, v]) => [k, +v.toFixed(2)])));
  // captured motion (src/motion-match.js, not waited for): the people's own walks always; the
  // traveller's motion matching only when it is switched on (the dev menu, ?mm=1)
  const matching = matchingSetting.get();
  loadMotionLibrary(lib, { matching }).then(() => { if (player.animator) player.animator.matching = matching && !!lib.motion?.db; });
  player.locoMoves = movesSetting.get();
}
const humanT = await humans;
// the people on MakeHuman bodies (each by their age, build and world); the traveller stays on his own body
// (docs/makehuman.md). Without the file, the Quaternius ones.
const peopleT = humanT && mhPeople ? ((await mhPeople)?.humans() ?? humanT) : humanT;
const generatedTraveller = await traveller;
if (generatedTraveller) {
  player.character = createTravellerV1(player.char, generatedTraveller);
  player.humanoid = player.character.humanoid;
  // his levels of detail when the camera is far enough (characters/traveller-lod.js: built in a worker,
  // the full meshes until then and up close), picked each frame with the people's (skinnedLods)
  buildTravellerLod(player.character).then((lod) => { if (lod) player.character.lod = skinnedLods.add(lod); });
} else if (humanT) {
  const travellerTemplate = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}anim/traveller.glb`).then(g => g.scene).catch(() => null);
  if (travellerTemplate) {
    player.humanoid = new Humanoid(humanT[0], player.char, 'm', { outfit: travellerTemplate });
  } else {
    player.humanoid = new Humanoid(humanT[0], player.char, 'm', { skin: '#e9b9a0', gloves: player.char.colors.gloves, suit: true });
    player.humanoid.setHeadwear('short', { hair: '#8a5638' });
  }
}
player.attach(scene);
await slice();
const heroMaterials = keepHero(player.char.root);   // (and the gear hung on him later: materials.js keepHero)
markHero(player.cape?.mesh, heroMaterials);
if (player.mount) scene.add(player.mount.object);
await slice();

// ambient life
const lifeCfg = level.life ?? {};
const flocks = (lifeCfg.flocks ?? []).map((f) => new Flock(scene, f));
const motes = lifeCfg.motes ? new Motes(scene, lifeCfg.motes) : null;
if (motes) motes.uniforms.tNormal.value = gbuffer.textures[1];
overlays.motes = motes;
// the hoverbike / skiff trail
// two trails, one per hover jet
const trailGround = (x, y, z) => (player.mount.groundAt ? player.mount.groundAt(x, y, z) : physics.groundAt(x, y, z));   // never under the ground (or the skiff's water)
const trails = player.mount && player.mount.kind !== 'bird' ? [new Trail(scene, { offset: 0, physics, ground: trailGround }), new Trail(scene, { offset: 2.5, physics, ground: trailGround })] : null;
const JETS = player.mount?.jets ?? [new THREE.Vector3(0.66, -0.08, -1.18), new THREE.Vector3(-0.66, -0.08, -1.18)];   // the jets' rear caps (the vehicle's own, if it says)
const footprints = new Footprints(scene);   // prints take the colour of whatever they land on
const jumpShadow = new JumpShadow(scene);    // off the ground: a patch of shade straight under you (src/jump-shadow.js)
(level.noShadow ??= []).push(jumpShadow.mesh);
resize();
if (footprints) player.onStep = (p, heading, up) => footprints.add(p, heading, up);

// local lights: the 8 nearest to the player go to the shader each frame
const levelLights = level.lights ?? (level.lights = []);
const jetLight = new THREE.Vector4();
const jetShotK = { pitch: 0, keepTight: true, yawRate: 4 };   // (the follow camera behind the jets' nose: rig.follow's shot)
function updateLights() {
  const L = sharedUniforms.uLights.value;
  const p = player.pos;
  const ranked = levelLights
    .map((l) => [l, (l.x - p.x) ** 2 + (l.y - p.y) ** 2 + (l.z - p.z) ** 2])
    .filter(([l, d]) => d < (l.w + 250) ** 2)
    .sort((a, b) => a[1] - b[1]);
  let n = 0;
  if (player.jetPower > 0) {
    jetLight.set(p.x, p.y + 0.6, p.z, (4 + 3 * player.jetPower) + Math.random() * 1.5);   // the flame flickers on nearby walls
    L[n++].copy(jetLight);
  }
  for (const [l] of ranked) { if (n >= 8) break; L[n++].copy(l); }
  sharedUniforms.uLightCount.value = n;   // (the shader looks at these only)
  for (; n < 8; n++) L[n].set(0, -1e5, 0, 0);
}
wind = new WindStreaks();
if (level.windAngle != null) wind.fixedAngle = level.windAngle;   // (a world whose wind has a way of its own: the train's, from the nose)
wind.uniforms.tNormal.value = gbuffer.textures[1];
wind.uniforms.uRes.value.copy(post.uniforms.uRes.value);
wind.uniforms.uInk.value = post.uniforms.uInk.value;
// the ink where you lean on the world's edge (src/edge.js), drawn with the wisps
const edgeInk = new EdgeInk(wind.mesh.material);
wind.scene.add(edgeInk.mesh);
// the recordings' hologram (src/ship/hologram.js): light drawn over the composite, hidden behind what the G-buffer holds
HOLO.uniforms.tNormal.value = gbuffer.textures[1];
// (the camera's view of the collision: the level's, and the cabs as drawn, never the one you ride: src/carriers.js)
const rig = new CameraRig(camera, renderer.domElement, cameraPhysics(physics, () => player.vehicles, () => player.ride));
rig.yaw = level.camYaw;
rig.pitch = level.camPitch ?? rig.pitch;
rig.constrain = (cam) => { level.constrainCamera?.(cam); keepLensOut(cam, () => player.vehicles, () => player.ride); };   // (and out of the cabs: src/carriers.js)
await slice();

// ------------------------------------------------------------------ sound, weather, people, story
// Review playback must be silent before audio initialization or any input starts
// a context; startReview runs after world loading and is too late for this.
const sound = new Sound(levelId, { muted: query.has('cinematicReview') ? true : undefined });
// the body heard: jumps, landings, the climb, the wings, the roll, falling and getting up (src/foley.js)
const foley = new BodyFoley(sound);
interactHooks.onUse = () => sound.pickup({ pos: player.pos });   // (picking something up, taking it)
waters.sound = sound;
player.onSwim = (kind, info) => waters.event(kind, info);   // splashes, strokes, a gasp
// hoverbikes and skiffs skim over any water (bike.js groundAt)
for (const v of player.vehicles) if (v.groundAt && !v.surface) v.surface = (x, y, z) => waters.floorAt(x, y, z);
const breathMeter = new BreathMeter();
// the magic-fluid backpack: shoot, boost and push on three shared charges (fluid-tool.js)
const tool = new FluidTool({ scene, player, physics, camera, rig, sound, level, hud: new ToolHud(), noShadow: (level.noShadow ??= []) });
if (level.lendTool) lendTool(tool, level.lendTool);   // (the Arena: the backpack, the blade and the shield lent for the visit, whatever the save: src/minigames/kit/onfoot.js)
await slice();
tool.powerTrails(trails);   // the hover trails run in the fluid's tones
// what an ember glob sets alight: the camp fires, the market's lamps, dry brambles (flammable.js)
const flammables = new Flammables(scene, flammableSpots(level), { lights: levelLights, sound });
const weather = new Weather(content.weather);
const shelter = new Shelter(physics);   // the weather stays outdoors: rooms, the ship, under roofs (src/shelter.js)
addIndoors((p) => !!ship.modelOf(p));   // the traveller's own ship
{
  const stormColor = { desert: '#e3c58f', arzach: '#e8dfcb' }[levelId];
  if (stormColor) post.uniforms.uStormColor.value.set(stormColor);
}
const npcs = await runStepsAsync(spawnNPCsSteps(scene, physics, content.npcs, { lib, humans: peopleT }), slice);
await slice();
// city crowds: hundreds of GPU-animated people, the nearest few promoted to full NPCs (crowd.js)
const crowdSpots = level.crowdSpots ? { lines: level.crowdLines, ...level.crowdSpots() } : null;
const crowdClear = [...content.npcs.map((s) => ({ x: s.at[0], y: s.y, z: s.at[1], r: 3 })), ...alienSpots(levelId)];   // (and the aliens' places: src/aliens/)
const crowdT0 = performance.now();
const crowdBuilt = crowdSpots ? await runStepsAsync(buildPeopleSteps(physics, crowdSpots, { seed: 11, clear: crowdClear }), slice) : null;
// (the near tier's bodies one at a time: each is a person built and dressed)
const crowdPool = [];
if (crowdSpots) for (let i = 0; i < CROWD_BUDGET.pool; i++) { crowdPool.push(pooledNPC(scene, physics, { kind: i % 2 ? 'f' : 'm', lib, humans: peopleT })); await slice(); }
const crowd = level.crowdSpots ? new Crowd(scene, physics, {
  spots: crowdSpots, built: crowdBuilt, pooled: crowdPool,
  clear: crowdClear,
  makeNPC: (kind) => pooledNPC(scene, physics, { kind, lib, humans: peopleT }),
}) : null;
if (crowd && mhPeople) mhPeople.then((p) => p?.warm());   // (the crowd's MakeHuman bodies made ahead, while idle)
if (crowd) { npcs.push(...crowd.npcs); console.info(`crowd: ${crowd.people.length} people in ${crowd.groups.length} groups, placed in ${(performance.now() - crowdT0).toFixed(0)} ms`); }
registerNPCTargets(npcs);   // the fluid tool can splash or shove anyone
npcs.push(...spawnAliens(scene, physics, levelId));   // the world's non-humanoid people (src/aliens/: their own targets, talkable by their def.talk)
await slice();
const journal = new Journal(LEVELS.map((l) => ({ id: l.id, title: l.title, hidden: l.hidden, relicNames: CONTENT[l.id].relics.names, storyTitle: CONTENT[l.id].story.title })));
// (a merged world's parts kept their relics apart before: they join its list, src/save-migrate.js)
if (migrateJournal(journal.data, RELIC_BASE)) journal.save();
const errands = new Errands({ levelId, defs: ERRANDS, npcs, journal, toast: (t, o) => showToast(t, o), titles: Object.fromEntries(LEVELS.map((l) => [l.id, l.title])), capture: (e, l, w, h) => captureView(e, l, w, h), sound });
const capture = (eye, look, w, h) => captureView(eye, look, w, h);
const relics = new Relics(scene, physics, { levelId, spots: content.relics.spots, names: content.relics.names, journal, sound, capture, lights: levelLights });
await slice();
// the route: the worlds you know of (src/story/route.js); finishing this one names the next on the ship's map
const worldDone = (id) => !!(game.flag(`world.${id}.done`) || journal.storyDone(id));
// (a world the route opens is found on the ship's map by the signature search before it is named anywhere: src/story/signature-search.js)
const chart = () => routeChart({ order: ORDER, done: worldDone, visited: (id) => journal.seen(id), current: levelId, flag: (k) => game.flag(k) });
const known = () => chart().charted;
let knownBefore = knownWorlds({ order: ORDER, done: worldDone, visited: (id) => journal.seen(id), current: levelId });
const revealed = () => {
  const c = chart(), fresh = newlyKnown(knownBefore, c.known).filter((id) => c.findable.includes(id));
  knownBefore = c.known;
  return findableNote(fresh.length);   // "The ship reads the singing light's signature somewhere new. Search for it on the galactic map."
};
journal.known = (id) => !ORDER.includes(id) || known().includes(id);   // the sketchbook leaves out worlds you don't know yet
const story = new Story(scene, { levelId, def: { ...content.story, next: revealed }, journal, sound, capture, player, physics, ground: level.ground.heightAt ? level.ground : null, say: (t) => showToast(t) });
const expedition = level.observatory ? new ObservatoryQuest({ model: level.observatory, journal, traveler: npcs[5], story, capture, sound }) : null;
await slice();
// ---- story: conversations, quests, the world's people and places (src/story/, src/interact.js)
// (a line that was only a control to press, at a hint level that doesn't name them, has nothing left to say: src/hint-level.js)
const showToast = (text, o) => { if (!text || (typeof text === 'string' && !keyText(text).trim())) return; ship.cinema.toast(text, o); };   // (o.kind 'quest': a quest's start, its own look)   // queued, and held while a scene has the screen dark (src/ship/cinema.js)
// the hum, when words on the screen speak of it: a toast, a subtitle, a line of a conversation, a balloon (src/story/hum.js)
const humCue = new HumCue();
let lastBalloon = null;
const hearWords = (text) => { if (humCue.hear(text, performance.now() / 1000)) sound.makersHum?.({ vol: 0.7 }); };
ship.cinema.onWords = hearWords;
game.on('words', ({ text }) => hearWords(text));
player.onNotice = showToast;   // "It needs power." (a vehicle without the backpack)
const preStory = new Set(scene.children);
const storyRt = createStory({ levelId, scene, physics, level, player, npcs, crowd, sound, journal, story, lib, humans: peopleT, toast: showToast, tool,
  traces: content.traces ?? [],   // (a detour world's trace of the light: src/story/sightings-detours.js)
  isNight: () => sky.hour < 6.4 || sky.hour > 19.3,
  ship, drone: (out) => (scout && scout.phase !== 'docked' ? out.copy(scout.object.position) : null),   // (home: the scenes wait for the ship's; the dog barks at the drone)
  cue: (text, secs) => scoutSays(text, secs),   // (a line under the view at once, not a toast in the queue: the desert's way calls out what is ahead)
  capture: (e, l, w, h, o) => captureView(e, l, w, h, o) });
for (const c of scene.children) if (!preStory.has(c)) auditRoots.push(c);   // (and what the world's story placed)
story.waitFor = () => storyRt.dialogue.open;   // a story page never opens over a conversation: it waits for its end
// the shops (src/shop.js, src/shop-panel.js, src/story/shops.js): talking to a keeper ("Show me what you have") or E at
// their counter opens the panel; a heart container fills the hearts too, and the HUD shows the wallet and the hearts
const shopPanel = new ShopPanel({ game, resources, sound,
  onBought: ({ ware }) => { if (ware === 'heart') { player.setMaxHearts(resources.maxHearts); player.restore(player.maxHearts); } hpShown = 3; },
  onClose: () => { document.body.classList.remove('shopping'); },
  covered: () => menu.open || journal.open || changelog.open || restartOpen });
game.on('shop:open', ({ shop } = {}) => {
  const e = storyRt.shops?.byId(shop);
  // (after the conversation that asked for it has closed)
  if (e) setTimeout(() => { if (!shopPanel.isOpen && !storyRt.dialogue.open) { document.body.classList.add('shopping'); shopPanel.open(e); } }, 60);
});
await slice();
// E: boarding a vehicle and turning a lens share the interact button with talking (nearest wins)
// (as far as the vehicle lets you board from: a cab hovering beside a terrace is further off than a bike)
registerInteractable({ id: 'vehicle', priority: PRIORITY.vehicle, range: 9, at: () => player.nearestVehicle()?.pos,
  prompt: () => { const v = player.nearestVehicle(); return v?.kind === 'taxi' ? 'get in the cab' : v?.powered && !items.has('backpack') ? `ride the ${level.mountName ?? v?.kind} (it needs power)` : `ride the ${level.mountName ?? v?.kind ?? 'mount'}`; },
  // (measured to its side, not its middle: a cab is four metres long, and a passer-by at your shoulder was nearer than its centre)
  distance: (p) => { const v = p.nearestVehicle(); const d = v && !p.boarding && !p.unboarding ? v.pos.distanceTo(p.pos) : Infinity; return d <= (v?.boardDistance ?? 6) ? Math.max(0.2, d - (v.halfWidth ?? 0)) : Infinity; }, use: () => player.interact() });
if (expedition) registerInteractable({ id: 'lens', priority: PRIORITY.use, range: 1, prompt: 'turn the lens', distance: (p) => (expedition.nearby(p) >= 0 ? 0 : Infinity), use: () => {} });
// the scout finds the objective (Q, R3 with no foe in reach, the touch "ping"; src/scout.js): the cue names it and
// how far, at once (a toast would wait its turn), and the quest marker over it shows for a while
// (src/story/quests.js QuestMarker.reveal)
const scoutSaid = { text: '', until: 0, kind: '' };
const scoutSays = (text, secs, kind = '') => { scoutSaid.text = text; scoutSaid.kind = kind; scoutSaid.until = performance.now() + secs * 1000; };
// what the find is for: the quest's overall goal (src/story/quest-goals.js), the observatory's, the world's story
const findGoal = (target) => {
  const id = String(target?.id ?? '').replace(/^portal-\d+-/, '');   // (through a doorway first: the same find)
  const q = /^(quest|opener)-/.test(id) ? storyRt.quests.objective()?.quest : null;
  if (q) return storyRt.quests.goal(q);
  if (/^(ledge|lens|observatory|traveler)/.test(id)) return 'Wake the sleeping observatory';
  if (id === 'story') return content.story.title ?? '';
  if (id === 'ship') return 'On to the next world';
  return '';
};
const scout = new Scout({ scene, player, physics, sound,
  getTarget: () => nextObjective({ player, expedition, story, ship: level.ship, level, quest: () => storyRt.objective() }),
  onFind: (target, d) => { scoutSays(findSummary({ goal: findGoal(target), step: findText(target, d) }), 6, 'quest'); storyRt.marker.reveal(); },
  onShrug: () => scoutSays(guardianHint(level.temple) ? '◇ …' : 'Nothing to find here', 2.5),   // (in a fight, no hint open yet: it only watches with you)
  // in a guardian's fight the ping is a hint: the lens on the weak point, the line on the cue (src/temples/hints.js);
  // the hint level lets its lines out (subtle: none at first, then one by one as the struggle goes on: openHint)
  getHint: () => openHint(guardianHint(level.temple), struggle.t),
  onHint: (line) => scoutSays(`◇ ${line}`, HINT.say),
});
const struggle = new Struggle();   // (the seconds in the guardian's phase: ticked in the loop)
// a world that wants to show you the way at once (the City-Shaft's jets, just found: up through the ceiling): a nudge, hints full only
game.on('scout:ping', (e) => { if (e?.why && !hintsFor('nudge')) return; if (!ship.playing && !storyRt.dialogue.open) scout.ping(); });
// ---- item boxes (src/boxes/): they notice you; E opens one (a Zelda-style scene on the ship's cinematic camera)
const boxes = createBoxes({ levelId, scene, physics, level, player, sound, quests: storyRt.quests, toast: showToast,
  anchor: () => ship.arrivalSpot(),
  quiet: () => ship.playing || storyRt.dialogue.open,   // box quests wait for the landing, the recordings and talk to be over
  cam: { shot: (s) => ship.shot(s), release: (b) => ship.release(b), hud: (on) => ship.cinema.hud(on), bars: (on) => ship.cinema.bars(on) } });
const itemFx = createItemEffects({ player, tool, level, sound, camera, toast: showToast, isNight: () => sky.hour < 6.4 || sky.hour > 19.3 });
await slice();
// the father's charge (src/story/charge.js): the journey's own quest, pinned above everything
const charge = () => chargeState({ flag: (f) => game.flag(f), keepsakes: game.keepsakes(), completed: ship.completed().length,
  failed: Object.entries(game.data.flags).filter(([k, v]) => k.startsWith('failed.') && v).map(([, v]) => v) });   // (quests that went wrong: src/story/quests.js)
// the game menu (View / Select, J: src/game-menu.js): what fills its four panels (src/game-menu-data.js),
// and the items' pictures, drawn one a frame while it is open (src/item-icons.js)
// (drawn in the late-morning light whatever the hour, so a picture made at night is not a dark one for the session)
let gadgets = null;   // (src/gadgets/: made after the foes, below)
const itemIcons = new ItemIcons({ scene, build: buildItemModel,
  capture: (...a) => { const h = sky.hour; sky.hour = 10.5; updateSky(); try { return captureView(...a); } finally { sky.hour = h; updateSky(); } },
  place: () => ({ at: player.pos.clone().addScaledVector(player.frame.up, 140), up: player.frame.up.clone() }),
  onReady: (id, url) => journal.menu.iconReady(id, url) });
// the People page's portraits (src/portrait-cache.js): each conversation's portrait of the person, kept small;
// and how many times you have talked to each (talks.<id>: the page's "between you")
const portraits = new PortraitCache();
portraits.onChange = (id, shot) => journal.menu.portraitReady(id, shot);
game.on('dialogue:start', ({ id }) => {
  if (!id) return;
  game.set(`talks.${id}`, (+game.flag(`talks.${id}`) || 0) + 1);
  // (the conversation takes its portrait just after it says it started)
  queueMicrotask(() => { const d = storyRt.dialogue; if (d.person?.id === id && d.shot) portraits.put(id, d.shot); });
});
// someone met before the portraits were kept, here in this world: drawn while the People page is open, one a frame
const portraitTried = new Set();
function pumpPortraits() {
  if (journal.menu.panel !== 'people') return;
  for (const n of npcs) {
    const id = n.def?.id;
    if (!id || portraitTried.has(id) || portraits.has(id) || !game.flag(`met.${id}`)) continue;
    portraitTried.add(id);
    // (near enough to be drawn in full, and shown)
    if (!n.object?.visible || n.pos.distanceTo(player.pos) > 60) continue;
    let shot = null;
    try { shot = storyRt.portrait(n, n.def); } catch { shot = null; }
    if (shot) portraits.put(id, shot);
    return;
  }
}
window.portraits = portraits;   // (the console, the shot scripts)
Object.assign(journal.menu, {
  sources: menuSources({ items, wallet: () => resources.chimes, quests: storyRt.quests, charge, keepsakes: () => game.keepsakes(), journal, current: levelId, order: ORDER, known: (id) => journal.known(id), game, portrait: (id) => portraits.get(id),
    levels: LEVELS.map((l) => ({ id: l.id, title: l.title, hidden: l.hidden, blurb: l.blurb, relicNames: CONTENT[l.id]?.relics.names, storyTitle: CONTENT[l.id]?.story.title })),
    mode: () => ({ mode: tool.owned ? tool.mode : null, modes: tool.owned ? tool.modes : [], gadget: gadgets?.equipped ?? null, gadgets: gadgets?.owned() ?? [] }), boxes: () => boxes.counts(), errandDefs: ERRANDS, done: worldDone,
    icon: (id) => itemIcons.get(id) }),
  onTrack: (id) => storyRt.quests.choose(id),
  // an item that is a gun mode: take it (the fluid tool's D-pad / X switch, from the menu)
  onUse: (id) => { const m = { backpack: 'shoot', stun: 'stun', fire: 'fire', bloom: 'bloom' }[id]; if (m && tool.modes.includes(m)) tool.setMode(m); else gadgets?.equip(id); },   // (or a gadget taken in hand: src/gadgets/)
});
// a keepsake just earned: a toast says what the father's charge gained
game.on('keepsake', () => sound.musicCue('moment', { delay: 1 }));   // (the recorded theme comes back: src/music-moments.js)
game.on('keepsake', (k) => { const line = chargeHud(charge(), { kept: k.name }); if (line) showToast(line); });
// a save from before the charge had its card: letter it once, at the first quiet moment
if (game.flag('prologue.done') && !game.flag(CHARGE_CARD) && !playPrologue && !playHomecoming && !minigameDef) {   // (not over a game: the next world's first quiet moment)
  game.set(CHARGE_GIVEN, true);
  const wait = setInterval(() => {
    if (busy() || ship.playing || ship.busy() || document.hidden) return;
    clearInterval(wait);
    game.set(CHARGE_CARD, true);
    showChargeCard({ sound });
  }, 4000);
}
const devMenu = new DevMenu({ levelId, levels: LEVELS, boxes, quests: storyRt.quests, story,
  // (motion matching for the traveller: src/motion-match.js; its database loads the first time it is switched on)
  matching: lib && {
    get: () => !!player.animator?.matching,
    set: (on) => { matchingSetting.set(on); loadMotionLibrary(lib, { matching: on }).then(() => { if (player.animator) player.animator.matching = on && !!lib.motion?.db; devMenu.render(); }); },
  },
  // (the captured starts, stops and turns over the loops: src/loco-moves.js)
  moves: { get: () => player.locoMoves !== false, set: (on) => { movesSetting.set(on); player.locoMoves = on; devMenu.render(); } },
  hitboxes: { get: () => hitboxes.on, set: (on) => hitboxes.set(on) },   // (src/hitboxes.js)
  inputs: { get: () => inputDisplay.on, set: (on) => inputDisplay.set(on) } });   // (the input display: src/input-display.js)
window.addEventListener('keydown', (e) => {
  if (!boxes.busy() || e.repeat) return;
  if (e.code === 'Escape') boxes.skip();
  else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') boxes.dismiss();
});
// flora: the world's own plants in clumps, clear of the people, the boxes, the relics, the ship and
// the story's places (src/flora.js); the large ones are solid
await slice();
const flora = await runStepsAsync(buildFloraSteps({ scene, level, levelId, physics, density: preset.floraDensity ?? 1, keep: floraKeep({ level, content, ship, npcs, crowd, boxes, reactiveWorld }) }), slice);
if (flora) {
  tiled.small.push(...flora.small);
  (level.noShadow ??= []).push(...flora.noShadow);
  if (flora.collider) physics.addCollider(flora.collider);
  console.info(`flora: ${flora.count} plants (${flora.largeCount} large) of ${flora.sets.length} species, ${flora.buildMs.toFixed(0)} ms`);
}
await slice();
// grass blades round the camera on the grassy grounds (src/flora-grass.js), by the graphics preset
blades.grow = () => {
  if (blades.key === preset.key) return;
  blades.key = preset.key;
  if (blades.grass) { const gone = blades.grass.meshes; blades.grass.dispose(); level.noShadow = level.noShadow.filter((o) => !gone.includes(o)); }
  blades.grass = buildGrass({ scene, level, physics, presetKey: preset.key, water: FLORA_WORLDS[levelId]?.water,
    keep: [ship.site && { x: ship.site.x, z: ship.site.z, r: 9 }, ship.rampFoot && { x: ship.rampFoot.x, z: ship.rampFoot.z, r: 3 }] });   // (not through the ship's floor and ramp)
  if (blades.grass) (level.noShadow ??= []).push(...blades.grass.meshes);
};
blades.grow();
await slice();
// wildlife: two or three small species per world, each with a surprise (src/wildlife.js)
const wildlife = new Wildlife(scene, level, physics, { content, sound, defs: level.wildlife });   // (a level may bring its own list: the Lab's rooms)
// the ink blots in the wilds and the makers' machines in the temple (src/foes.js; the Enemies setting)
// the desert's first steps: the camera and the jump, each said once if you haven't used it yet (src/first-steps.js)
const firstSteps = levelId === 'desert' && !minigameDef && !game.flag('item.backpack') ? new FirstSteps(game) : null;
const firstStepsAt = new THREE.Vector3(NaN, 0, 0); let firstStepsT = 0;
const foes = new Foes({ scene, level, levelId, content, physics, player, tool, sound, npcs, settings, camera, lib, humans: humanT, waters, notice: (t) => showToast(t) });
// chimes, the currency (src/chimes.js): a foe cut down scatters a few (by its weight), a guardian a purse once;
// walked over or drawn in, they ring into the wallet (src/resources.js); none from a game's own foes (Ink tide)
const chimePolicy = dropPolicy(level);
const chimes = new ChimeField({
  groundAt: (x, y, z) => physics.groundAt(x, y + 2, z, 8),
  onTake: (p) => { resources.addChimes(p.value, { source: 'pickup', training: p.training }); sound.chimePickup?.(p.value); rumblePlay('chime'); },
});
const chimeView = new ChimeView(scene);
/** A guardian's purse: scattered on the floor between it and you (a floating guardian's body is out of reach). */
const purseAt = (pos) => {
  const P = player.pos, at = P.clone();
  if (pos) { const dx = pos.x - P.x, dz = pos.z - P.z, d = Math.hypot(dx, dz); if (d > 0.1) at.set(P.x + (dx / d) * Math.min(3.4, d), P.y, P.z + (dz / d) * Math.min(3.4, d)); }
  return at;
};
connectDrops(game, chimes, { policy: chimePolicy, purseAt, sound });
let trialsRt = null;   // this world's mastery trial (src/trials/), made once the world is up (below)
const chemistry = new Chemistry({ flammables, wildlife, tool, game, wind: player.wind });   // fire spreads on the wind, creatures flee it, foes catch it (src/chemistry.js)
tool.lockOn = () => foes.lockTarget();   // (the blade and its guard turn to the locked foe)
// Locked on, the back flip and the side hop (src/jump.js HOP, Player.hop): their dodge frames (FluidBlade.hop), and begun
// just before a blow lands, a perfect dodge: the flurry, the world slowed round you a few seconds (src/flurry.js)
const flurryFx = new FlurryFx();
let flurryAgainAt = 0;
function startFlurry() {
  const now = performance.now() / 1000;
  if (flurryLeft() > 0 || now < flurryAgainAt) return;
  flurry(FLURRY.time, FLURRY.rate, FLURRY.ease);
  flurryAgainAt = now + FLURRY.time + FLURRY.again;
  sound.flurry?.(true); kick(0.1); rumblePlay('flurry');
  if (!game.flag('hint.flurry') && hintsFor('tip')) { game.set('hint.flurry', true); showToast(tr('hint.flurry')); }   // (said after the fact, hints full)
}
player.onHop = (kind, win) => { tool.blade?.hop(win); if (foes.perfectDodge()) startFlurry(); };
if (tool.blade) tool.blade.onHopDodge = () => startFlurry();
player.untouchable = () => flurryLeft() > 0;   // (a guardian's blows and rings pass you by: src/temples/boss.js)
{ // locked on, the look's sideways motion is the lock's: a quick flick (the right stick, the mouse, a drag) switches to the next foe that way (src/foes.js FLICK)
  const look = rig.look.bind(rig);
  rig.look = (dx, dy) => { if (dx || dy) firstSteps?.looked(); if (foes.lock && !busy() && foes.flickLook(dx)) dx = 0; look(dx, dy); };
}
if (level.foes?.waves && !minigameDef) {   // (the Arena's FOES list, its guardians' ring: src/foe-spawner.js, the level's quick menu)
  const attach = { foes, player, physics, sound, scene, notice: (t) => showToast(t), kind: query.get('foe') };
  if (level.quickMenu?.attach) level.quickMenu.attach(attach);
  else import('./foe-spawner.js').then((m) => m.mountFoeSpawner(attach));
}
await slice();
ship.attach({ player, rig, camera, sound, journal, post, story, wind, npcs, lib, humans: peopleT, levels: LEVELS, order: ORDER, titles: Object.fromEntries(LEVELS.map((l) => [l.id, l.title])) });
if (viaShip) {
  const a = ship.arrivalSpot();
  player.respawn(a.pos);
  player.heading = a.heading;
  rig.yaw = a.heading + Math.PI;
  history.replaceState(null, '', `?level=${levelId}${query.has('cinematicReview') ? `&cinematicReview=${encodeURIComponent(query.get('cinematicReview'))}` : ''}`);
}
// arriving by another place's way through (?from=<world>: the night train's step down onto the market's halt, the
// halt's bell onto the train's porch: level.arrivals[from], src/story/night-train.js); the address loses its from, so a
// reload continues from the save
const arrival = !viaShip && !minigameDef ? level.arrivals?.[query.get('from')] : null;
if (arrival) {
  player.respawn(arrival.pos.clone());
  player.heading = arrival.heading;
  rig.yaw = arrival.heading + Math.PI;
  history.replaceState(null, '', `?level=${levelId}`);
}
// continue where you left off (same world, not arriving by ship)
const saved = SaveGame.load();
if (!viaShip && !arrival && !playPrologue && saved?.level === levelId && saved.pos && !level.keepSpawn) {   // (keepSpawn: the Arcade, back in front of a game's sign)
  const p = new THREE.Vector3(...saved.pos);
  player.respawn(p);
  if (saved.up) player.frame.set(new THREE.Vector3(...saved.up), new THREE.Vector3(...saved.fwd));
  player.heading = saved.heading ?? player.heading;
  rig.yaw = saved.yaw ?? rig.yaw;
}
let resetting = false;   // (a save being started over: nothing more is written to it)
const writeSave = () => !resetting && !minigameDef && SaveGame.write({   // (a game's page keeps the place you left the world at)
  level: levelId, pos: player.pos.toArray(), heading: player.heading, yaw: rig.yaw, hour: sky.hour,
  up: player.frame.up.toArray(), fwd: player.frame.fwd.toArray(),
});
// time played, for the save selector (counted while the game runs, not while paused: src/save-slots.js)
let playClock = 0;
const flushPlay = () => { if (resetting) return; slots.touch(slots.active, { addSeconds: playClock }); playClock = 0; };
setInterval(() => { if (!player.riding && player.onGround && !ship.playing) writeSave(); flushPlay(); }, 5000);
window.addEventListener('beforeunload', () => { if (!player.riding && !ship.playing) writeSave(); flushPlay(); });

// footsteps: prints in the sand + a sound
const onStepPrint = player.onStep;
player.onStep = (p, heading, up, i) => {
  if (waters.step(p)) return;   // in the water: a splash, no print
  onStepPrint?.(p, heading, up, i);
  sound.step(Math.hypot(player.vel.x, player.vel.z));
};

// Every press is seen for at least one frame: a quick tap (keydown and keyup between two
// frames, easy at 20 fps or with a touch button) used to vanish, and E did nothing.
const tapped = new Set();
const input = new Proxy({}, { set(o, k, v) { if (v) tapped.add(k); o[k] = v; return true; } });
const latchedInput = () => { const o = { ...input }; for (const k of tapped) o[k] = true; tapped.clear(); return o; };
window.addEventListener('keydown', (e) => {
  input[e.code] = true;
  if (e.code === 'KeyQ' && !e.repeat && !busy() && !photo.on && !ship.playing) scout.ping();
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => (input[e.code] = false));
// The E that closes a story page, a conversation or the ending (their own keydown handlers,
// which run first) must not also act in the world: it walked you up the ship's ramp or
// whistled the mount. E pressed while something was open is ignored until it is released.
let eBlocked = false, wasBusy = false;
window.addEventListener('keydown', (e) => { if (e.code === 'KeyE' && (wasBusy || busy())) eBlocked = true; });
bindToolMouse(renderer.domElement, input);   // right button aims, left shoots, middle pushes
renderer.domElement.addEventListener('mousedown', (e) => { if (e.button === 1) input.MouseMiddle = true; });   // the middle button: the gadget in hand (src/gadgets/)
// the gadgets (src/gadgets/: the fluid gun, the grappling hook, the ink bombs…): LT / L2 aims and RT / R2 uses the one in hand (R and T, G), D-pad ↑ or B changes it, D-pad → or X its mode; Y / △ (V) the bell-note whistle
// the trials' rewards, upgrades to the gadgets' tuning while owned (src/trials/upgrades.js): before the gadgets are made
syncUpgrades((id) => items.has(id));
items.on(() => syncUpgrades((id) => items.has(id)));
gadgets = new Gadgets({ scene, physics, player, camera, rig, sound, tool, level, foes, wind, input, relics, flammables, post: post.uniforms, boxes, notice: (t) => showToast(t), touch: isTouch, ring: () => itemFx.ring(),
  icon: (id) => itemIcons.get(id), drawIcon: (id) => itemIcons.pump(id) });   // (the chip shows the gadget's own model, drawn once)
// the hitbox overlay (src/hitboxes.js): F4, the world debug menu (L3 + R3, F2), the dev menu, the Arena's board, ?hitboxes=1 (this session only)
const hitboxOverlay = new HitboxOverlay({ player, tool, foes, gadgets: () => gadgets });
registerHitboxes((out) => foes.hitShapes(out));   // (the foes' shockwaves, slag, holds and volleys: src/foes.js)
hitboxes.set(query.has('hitboxes') ? query.get('hitboxes') !== '0' : !!settings.hitboxes);
hitboxes.listen((on) => { if (!query.has('hitboxes')) settings.set('hitboxes', on); devMenu.render(); });
const toggleHitboxes = () => showToast(tr(hitboxes.toggle() ? 'toast.hitboxesOn' : 'toast.hitboxesOff'));
window.addEventListener('keydown', (e) => { if (e.code === 'F4' && !e.repeat) { e.preventDefault(); toggleHitboxes(); } });
window.addEventListener('blur', () => Object.keys(input).forEach((k) => (input[k] = false)));

// ------------------------------------------------------------------ time of day
const savedEarly = SaveGame.load();
const sky = { hour: !viaShip && savedEarly?.level === levelId && savedEarly.hour !== undefined ? savedEarly.hour : level.defaults.hour, speed: 0 }; // speed in in-game hours per real minute
let atmo = level.atmo(player.pos.x, player.pos.z, player.pos.y);
const script = level.sky?.script ? colourScript(level.sky.script) : undefined;
// (a level with rooms of its own sky, the Lab's biome rooms, hands its colour script over with atmo)
// (an eclipse world's sun on its own path, the moon over it by the hour: src/eclipse.js)
const updateSky = () => { applyTimeOfDay(sky.hour, sharedUniforms.uSunDir.value, post.uniforms, atmo, atmo?.script ?? script); if (level.sky?.eclipse) applyEclipse(sky.hour, level.sky.eclipse, post.uniforms, sharedUniforms.uSunDir.value); if (level.sky?.moon === false) post.uniforms.uMoonVis.value = 0; };   // (moon: false, a world with moons of its own: the Overnight Train)
// planets hanging in this level's sky (a zone may bring its own: the Lab's biome rooms)
function setPlanets(list = []) {
  for (let i = 0; i < 3; i++) {
    const p = list[i];
    if (!p) { post.uniforms.uPlanet.value[i].set(0, -1, 0, 0); continue; }
    const el = THREE.MathUtils.degToRad(p.el), az = THREE.MathUtils.degToRad(p.az);
    post.uniforms.uPlanet.value[i].set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az), THREE.MathUtils.degToRad(p.size));
    const c = new THREE.Color(p.color);
    post.uniforms.uPlanetColor.value[i].set(c.r, c.g, c.b, p.ring ?? 0);
    post.uniforms.uPlanetCraters.value.setComponent(i, p.craters === false ? 0 : 1);
  }
}
if (level.sky?.planets?.length) setPlanets(level.sky.planets);
updateSky();

// ------------------------------------------------------------------ GUI
const U = post.uniforms;
level.veils?.bind({ tNormal: gbuffer.textures[1], uniforms: U });   // (the see-through surfaces' wash reads the scene's depth and the ink pass's light and haze: src/veil.js)
const params = {
  preset: level.defaults.preset ?? 'Moebius print',
  debug: 0,
  ink: '#2b211f',
};
const gui = new GUI({ title: 'Hiraeth shader' });
gui.add(params, 'preset', Object.keys(PRESETS)).name('style preset').onChange(applyPreset);
gui.add({ level: levelId }, 'level', Object.fromEntries(LEVELS.map((l) => [l.title, l.id])))
  .name('level').onChange((v) => { location.search = '?level=' + v; });
gui.add(params, 'debug', DEBUG_VIEWS).name('view');

const fLines = gui.addFolder('Ink lines');
fLines.add(U.uLineWidth, 'value', 0.5, 4, 0.1).name('line weight (near)');
fLines.add(U.uDepthThresh, 'value', 0.01, 0.4, 0.005).name('depth threshold');
fLines.add(U.uNormalThresh, 'value', 0.02, 1, 0.01).name('crease threshold');
fLines.add(U.uAlbedoEdges, 'value', 0, 1, 0.05).name('colour boundaries');
fLines.add(U.uShadowEdges, 'value', 0, 1, 0.05).name('shadow boundaries');
fLines.add(U.uWobble, 'value', 0, 4, 0.05).name('hand wobble');
fLines.add(U.uBoil, 'value', 0, 1, 1).name('line boil');

const fShade = gui.addFolder('Shading');
fShade.add(U.uToon, 'value', 0.2, 0.8, 0.01).name('toon threshold');
fShade.add(U.uShadeStyle, 'value', { hatching: 0, 'stipple (Sable dotting)': 1 }).name('shadow marks');
fShade.add(U.uHatch, 'value', 0, 1, 0.05).name('marks amount');
fShade.add(U.uHatchSpacing, 'value', 2.5, 12, 0.1).name('mark spacing');
fShade.add(U.uHatchScreen, 'value', { 'on surfaces': 0, 'screen space': 1 }).name('hatch anchoring');
fShade.add(U.uHighlight, 'value', 0, 0.3, 0.01).name('highlight');
fShade.addColor(params, 'ink').name('ink').onChange((v) => U.uInk.value.set(v));

sharedUniforms.uCloudShadows.value = level.defaults.cloudShadows ?? 1;
const fAtmo = gui.addFolder('Atmosphere');
fAtmo.add(U.uFogDensity, 'value', 0, 0.004, 0.0001).name('haze');
fAtmo.add(U.uClouds, 'value', 0, 1, 0.01).name('clouds');
fAtmo.add(sharedUniforms.uCloudShadows, 'value', 0, 1, 0.05).name('cloud shadows');
fAtmo.close();

const fTime = gui.addFolder('Time of day');
fTime.add(sky, 'hour', 0, 24, 0.05).name('hour').listen().onChange(updateSky);
fTime.add(sky, 'speed', 0, 120, 1).name('hours / minute');
fTime.add(player, 'stopMotion').name('stop-motion anim');
const animCfg = { mocap: true };
fTime.add(animCfg, 'mocap').name('mocap animation').onChange((v) => { player.animator = v ? player._animator : null; });

const world = { wind: level.features.wind };

const fBeauty = gui.addFolder('Beauty');
fBeauty.add(quality, 'renderScale', { '1× (fast)': 1, '1.5× (smooth)': 1.5, '2× (print)': 2 }).name('antialiasing').onChange(() => resize());
fBeauty.add(U.uLineVary, 'value', 0, 1, 0.05).name('line weight variation');
fBeauty.add(U.uAO, 'value', 0, 1, 0.05).name('crease shading');
fBeauty.add(sharedUniforms.uFormHatch, 'value', 0, 1, 1).name('hatching follows form');
fBeauty.add(U.uSkyBands, 'value', 0, 1, 0.05).name('sky bands');
fBeauty.add(U.uHazeBands, 'value', 0, 1, 0.05).name('haze layers');
fBeauty.add(U.uRays, 'value', 0, 1, 0.05).name('sun rays');
fBeauty.close();
const fWorld = gui.addFolder('World');
fWorld.add(world, 'wind').name('wind-blown sand');
fWorld.add(weather, 'mode', ['auto', ...WEATHER_KINDS]).name('weather');
fWorld.close();
const audioCfg = { music: 0.8, effects: 1, mute: sound.muted };
const fSound = gui.addFolder('Sound');
fSound.add(audioCfg, 'music', 0, 1, 0.05).onChange(() => sound.setVolumes(audioCfg.music, audioCfg.effects));
fSound.add(audioCfg, 'effects', 0, 1, 0.05).onChange(() => sound.setVolumes(audioCfg.music, audioCfg.effects));
fSound.add(audioCfg, 'mute').name('mute (M)').listen().onChange((v) => { if (v !== sound.muted) sound.toggleMute(); });
fSound.close();

function applyPreset(name) {
  const p = PRESETS[name];
  for (const [k, v] of Object.entries(p)) if (U[k]) U[k].value = v;
  // the world's own touches on its default look (line weight, hatching, dots…)
  if (name === (level.defaults.preset ?? 'Moebius print')) for (const [k, v] of Object.entries(level.defaults.look ?? {})) if (U[k]) U[k].value = v;
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
}
applyPreset(params.preset);
gui.close();   // collapsed by default; click the title to open

// ------------------------------------------------------------------ settings, touch
// The graphics preset (perf.js QUALITY_PRESETS, resolveQuality): render scale and dynamic
// resolution, shadow map sizes and refresh rates, PCF taps, crease shading, cloud shadows,
// NPC detail and crowd range, how far small props are drawn, the lighter ink pass.
let lastQuality = settings.quality;
const baseAO = U.uAO.value, baseCloudSh = sharedUniforms.uCloudShadows.value;
const crowdRange = crowd ? { ...crowd.range } : null;
const adapt = { slow: 0, fast: 0, hold: 0, dropped: false };
// low detail: the preset's, or a desktop Auto once it has had to drop resolution
const lowDetail = () => preset.lowDetail || ((preset.key === 'auto' || preset.key === 'xbox') && adapt.dropped);
function applyDetail() {
  const low = lowDetail();
  U.uAO.value = preset.ao && !low ? baseAO : 0;
  sharedUniforms.uCloudShadows.value = preset.cloudShadows && !low ? baseCloudSh : 0;
  sharedUniforms.uShadowTaps.value = preset.taps;
  U.uPostLite.value = preset.postLite ? 1 : 0;
  sharedUniforms.uWearLite.value = low || preset.postLite ? 1 : 0;   // (lighter weathering: materials.js WEATHER)
  waterShared.uWaterLite.value = low || preset.postLite ? 1 : 0;   // (src/water-shader.js)
  BLADE_QUALITY.lite = bladeLiteFor(preset, low);   // (the fluid sword's lighter look: src/blade-shader.js)
  waters.contact = waterContactOn(preset);   // the little waves round what stands in the water (src/water.js renderGBuffer)
  for (const n of npcs) { n.lowDetail = low; n.clothFar = preset.clothFar ?? null; }
  if (crowd) {
    const mid = preset.crowdMid ?? crowdRange.midIn;
    Object.assign(crowd.range, { far: Math.min(preset.crowdFar ?? Infinity, crowdRange.far), midIn: Math.min(mid, crowdRange.midIn), midOut: Math.min(mid + 7, crowdRange.midOut),
      shadow: preset.crowdMid ? Math.min(crowdRange.shadow, mid * 0.5) : crowdRange.shadow });
  }
}
function applyQuality() {
  preset = resolveQuality(settings.quality, { handheld, deck, xbox: isXboxApp, hiDPI: pixelRatio >= 2 });
  quality.renderScale = preset.scale;
  adapt.slow = adapt.fast = adapt.hold = adapt.noProbe = 0; adapt.probe = null; adapt.dropped = false;
  const S = preset.shadow;
  cascades.fine.configure(S.fine || 256, cascades.fine.extent);
  if (!S.fine) cascades.fine.disable();
  cascades.near.configure(S.near, preset.nearExtent);
  cascades.far.configure(S.far, cascades.far.extent);
  for (const c of Object.values(cascades)) c.prime(renderer);
  shadowTexels();
  resize();
  applyDetail();
  blades.grow?.();
}
/** Dynamic resolution: the render scale follows the frame rate, inside the preset's range (Auto, Handheld; perf.js adaptScale). */
function adaptQuality(fps, missed, cpu, period) {
  const D = preset.dynamic;
  if (!D || document.hidden || busy() || photo.on) return;
  const { scale, dropped } = adaptScale(adapt, { fps, missed, cpu, period }, D, quality.renderScale);
  if (scale === quality.renderScale) return;
  quality.renderScale = scale;
  if (dropped && !adapt.dropped) { adapt.dropped = true; applyDetail(); }
  resize();
}
if (query.get('fps') === '1') settings.showFps = true;   // (the frame readout for this session, not saved: measuring on a handheld)
settings.on((k) => {
  rig.sensitivity = settings.sensitivity;
  rig.invertY = settings.invertY;
  player.invertFlight = settings.invertFlight;   // (the jets' pitch: push forward to climb)
  sound.setVolumes(settings.music, settings.effects);
  sound.setMusicMode(settings.musicMode);
  gui.domElement.style.display = settings.devPanel ? '' : 'none';
  document.body.classList.toggle('nofps', !settings.showFps);
  if (settings.quality !== lastQuality || k === null) { lastQuality = settings.quality; applyQuality(); }
  else applyDetail();
});
const changelog = new Changelog();
const menu = new SettingsMenu(settings, {
  sound,
  onNews: () => changelog.toggle(true),
  onDev: () => devMenu.toggle(true),
  onBook: (panel) => journal.toggle(true, panel),   // (its Items and Quests: the game menu, on that panel)
  onPhoto: () => setPhoto(true),   // (photo mode from the menu: the only way on a touch screen; View + D-pad ↑ on a pad, P)
  onDebug: () => showPicker(true),
  onQuit: () => quitToTitle(),
  // an update restarts the game (at the title, in the new build): the position and the time played first
  onBeforeRestart: () => { if (!player.riding && !ship.playing) writeSave(); flushPlay(); reactiveWorld.flush(); },
  // where you are, at the top of the Start menu
  where: () => `<b>${slots.active === DEBUG_SLOT ? 'Debug save' : `Save ${slots.active}`}</b>${meta.title} · ${formatPlaytime((slots.meta().playtime ?? 0) + playClock)} played`,
  // (Esc during the ship's scenes is "hold to skip", even in the parts you walk through)
  isBusy: () => shopPanel.isOpen || story.pageOpen || journal.open || changelog.open || picker.classList.contains('open') || worldDebug.open || photo.on || storyRt.busy() || ship.busy() || ship.playing || boxes.busy(),
  // this save only (the other slots stay): forget it and start again with the prologue
  onResetProgress: () => {
    reactiveWorld.clear(); game.reset();
    resetting = true; slots.remove(slots.active);
    location.href = `${location.pathname}?start`;
  },
});
/** Back to the title screen (the position and the time played are saved first). */
function quitToTitle() {
  if (!player.riding && !ship.playing) writeSave();
  flushPlay(); reactiveWorld.flush();
  location.href = location.pathname;
}
// The full-screen menus (Start: settings; View / Select: the game menu, src/game-menu.js; what's new) pause
// the game: frame() skips the world while one is open, and the menu music plays over the
// hushed world (src/audio.js menuMusic).
const paused = () => !!window.cinematicReview?.paused || menu.open || journal.open || changelog.open || !!minigame?.paused;
// one panel at a time: J over the open settings drew the sketchbook's quest log under the
// settings card (and O over the sketchbook the other way round)
{
  const panels = [menu, journal, changelog];
  for (const p of panels) {
    const toggle = p.toggle.bind(p);
    p.toggle = (on = !p.open, ...rest) => {
      if (on) for (const q of panels) if (q !== p && q.open) q.toggle(false);
      const r = toggle(on, ...rest);
      sound.menuMusic(paused());
      return r;
    };
  }
}
// what is in hand (src/input-mode.js), remembered from the world before: the touch buttons stay hidden
// while a controller or the keyboard is in use, from the first frame of a new world
const inputMode = new InputMode({ touchDevice: isTouch });
inputMode.apply(document.body.classList);
if (isTouch) new TouchControls(input, rig);
// where the controller's printed letters are (settings), and the Android app: build label, update toast, pause/resume
settings.on((k) => { if (!k || k === 'padFaces') { setFaces(settings.padFaces); menu.syncControls?.(); } });
installAppShell({ sound, toast: showToast });   // (queued with the rest, src/ship/cinema.js)

// ------------------------------------------------------------------ level picker
const picker = document.getElementById('picker');
const completed = () => !!journal.data.completed;
const cont = SaveGame.load();
// only the worlds you know of (src/story/route.js): the rest open as you go. ?level=<id> and the dev menu go anywhere.
const pickable = LEVELS;   // the worlds list (L) is a debug tool: every world, open, whatever you've found (play travels by the ship's map)
const debugMenu = fillPicker(picker, { levels: pickable, current: levelId, cont: levelById(cont?.level) ?? null, state: game });
function showPicker(on) {
  if (on) for (const q of [menu, journal, changelog]) if (q.open) q.toggle(false);
  picker.classList.toggle('open', on);
  if (on) { document.exitPointerLock?.(); const h = picker.querySelector('header .hint'); if (h) h.textContent = inputKind() === 'keys' ? 'type to filter · a number opens · L closes' : ''; }   // (a pad's back button: in the close button, src/pad-glyphs.js)
  if (!on && document.activeElement === debugMenu.search) debugMenu.search.blur();
}
showPicker(query.get('worlds') === '1');   // (?level=<id>&worlds=1: a world with the list up; the title's Debug entry shows the list alone, src/world-picker.js) L is a developer shortcut; in play, worlds are chosen on the ship's galactic map (and saves on the title screen)
picker.querySelector('.close').addEventListener('click', () => showPicker(false));
window.addEventListener('keydown', (e) => {
  if (e.target === debugMenu.search) return;   // (the Debug menu's filter: its keys are its own, src/world-picker.js)
  const open = picker.classList.contains('open');
  // (L opens it; open, L closes it unless a filter is being typed: a letter starts the filter)
  if (e.code === 'KeyL' && (!open || !debugMenu.search.value)) { showPicker(!open); return; }
  if (!open) return;
  if (e.code === 'Escape') { if (debugMenu.search.value) debugMenu.filter(debugMenu.search.value = ''); else showPicker(false); return; }
  if (e.code === 'PageDown' || e.code === 'PageUp') { e.preventDefault(); debugMenu.jump(e.code === 'PageDown' ? 1 : -1); return; }
  const n = Number(e.key), list = debugMenu.numbered;   // (the worlds as the menu numbers them)
  if (e.key !== ' ' && n >= 1 && n <= Math.min(9, list.length) && (!list[n - 1].hidden || completed())) location.search = pickHref(list[n - 1].id);
});
// a letter typed on the open Debug menu starts its filter, before the game's own keys see it (C, P, Q…)
window.addEventListener('keydown', (e) => {
  if (!picker.classList.contains('open') || e.target === debugMenu.search || (e.code === 'KeyL' && !debugMenu.search.value)) return;
  if (debugMenu.typeKey(e)) e.stopPropagation();
}, { capture: true });

// ------------------------------------------------------------------ the world debug menu
// L3 + R3 (both sticks) or F2, in any world (src/world-debug.js, docs/systems/dev-tools.md "The world debug menu"):
// teleport to this world's points of interest, play its cinematics, set a quest's stage, the debug toggles
const worldToggles = () => ({ hitboxes: hitboxes.on, inputs: inputDisplay.on, god: player.opts.health === false, potions: !!resources.potions.infinite, clock: sky.speed > 0, jets: items.has('jetpack') });
/** Put the traveller at a point of interest: on the ground near it (or on its spot in a room), under the passage's paper, out of the doorways. */
function worldTeleport(point) {
  const spot = landingSpot(physics, point, { portals: level.portals ?? [], killY: level.killY ?? -Infinity });
  if (!spot.ok) { showToast(`Nothing to stand on near ${point.label}.`); return false; }
  if (player.ride) player.dismount(true);
  if (player.dead) player.restart?.();
  const to = new THREE.Vector3(...spot.pos), heading = spot.heading ?? player.heading;
  const up = level.gravityAt?.(to)?.clone?.() ?? new THREE.Vector3(0, 1, 0);
  const land = () => { portalCool = 2; player.vel.set(0, 0, 0); player.lastSafe?.copy(to); };   // (no doorway takes you on at once)
  portalCool = 3;
  if (!passage.go({ to, heading, up, speed: 0, onMove: land })) { player.teleport(to, up, new THREE.Vector3(0, 0, 1)); player.heading = heading; land(); }
  sound.page?.();
  showToast(`To ${point.label}.`);
  return true;
}
/** Play a cinematic of this world (src/cinematics-page/runtime.js stageCinematic), then back where you stood. */
function worldFilm(entry) {
  if (entry.how === 'reload') { location.search = `?level=${levelId}&via=ship`; return; }
  if (entry.how === 'page') { location.href = `cinematics.html#${encodeURIComponent(entry.id)}`; return; }
  const back = { pos: player.pos.clone(), up: player.frame.up.clone(), fwd: player.frame.fwd.clone(), heading: player.heading, yaw: rig.yaw };
  const playing = () => storyRt.moments.playing || ship.playing || boxes.busy();
  // back where you stood once it is over (or if it never began), watched from when it is staged
  const watch = () => {
    let seen = false, waited = 0;
    const wait = setInterval(() => {
      waited += 0.25; seen ||= playing();
      if ((seen && !playing()) || (!seen && waited > 4) || waited > 600) {
        clearInterval(wait);
        if (player.ride) player.dismount(true);
        player.teleport(back.pos, back.up, back.fwd); player.heading = back.heading; rig.yaw = back.yaw; portalCool = 2;
      }
    }, 250);
  };
  // (promises, not awaits: main.js's load guard reads every await in it, tests/load-awaits.test.js)
  import('./cinematics-page/runtime.js').then(({ stageCinematic }) => stageCinematic(window, entry))
    .then((ok) => { if (ok === false) throw new Error('it refused to start'); })
    .catch((err) => { showToast(`Could not play ${entry.title}: ${err.message}`); console.error(err); })
    .finally(watch);
}
const worldDebug = new WorldDebugMenu({
  fill: fillPicker,
  title: () => meta.title,
  build: () => debugSections({
    points: gatherPoints({ levelId, level, quests: storyRt.quests, npcs, boxes, relics, ship, content }),
    films: cinematicsFor(levelId, { ship: !!ship.parked }),
    quests: questList(storyRt.quests, levelId),
    toggles: worldToggles(),
    save: slots.active === DEBUG_SLOT ? 'the debug save' : `save ${slots.active}`,
  }),
  onToggle: (on) => {
    if (on) { for (const q of [menu, journal, changelog]) if (q.open) q.toggle(false); showPicker(false); document.exitPointerLock?.(); }
  },
  act: (a) => {
    if (a.do === 'tp') { worldDebug.toggle(false); worldTeleport(a.point); }
    else if (a.do === 'film') { worldDebug.toggle(false); worldFilm(a.entry); }
    else if (a.do === 'quest') {
      try { applyQuestJump(storyRt.quests, game, a.id, a.stage); showToast(`${storyRt.quests.def(a.id)?.title ?? a.id}: set to ${a.stage}.`); } catch (err) { showToast(`Could not set it: ${err.message}`); }
      worldDebug.toggle(false); worldDebug.toggle(true);   // (drawn again: the stage marked "now")
      [...worldDebug.el.querySelectorAll('#dbg-quests a[data-wd]')].find((el) => el.querySelector('.hint')?.textContent === `${a.id} → ${a.stage}`)?.focus();
    }
    else if (a.do === 'reload') location.reload();
    else if (a.do === 'toggle') {
      if (a.key === 'hitboxes') toggleHitboxes();
      else if (a.key === 'inputs') toggleInputs();
      else if (a.key === 'god') { player.opts.health = player.opts.health === false ? undefined : false; showToast(player.opts.health === false ? 'God mode: nothing hurts you.' : 'God mode off.'); }
      else if (a.key === 'potions') resources.setPotionsInfinite(!resources.potions.infinite);
      else if (a.key === 'clock') sky.speed = sky.speed > 0 ? 0 : 1;
      // the jets anywhere: a debug item since v1.38 (too strong for the worlds), given and taken here only (and the dev menu)
      else if (a.key === 'jets') { if (items.has('jetpack')) items.revoke('jetpack'); else { if (!items.has('backpack')) items.grant('backpack'); items.grant('jetpack'); } showToast(items.has('jetpack') ? 'The fluid jets (debug): hold jump in the air.' : 'The fluid jets put away.'); }
      worldDebug.states(worldToggles());
    }
    else if (a.do === 'heal') { player.restore(player.maxHearts); showToast('Every heart back.'); }
    else if (a.do === 'hour') { sky.hour = a.h; updateSky(); }
    else if (a.do === 'picker') { worldDebug.toggle(false); showPicker(true); }
  },
});

// ------------------------------------------------------------------ photo mode
// P: free camera (WASD / Q E, mouse look, SHIFT faster), HUD hidden,
// H toggles the panel, ENTER saves a PNG of the frame.
const photo = { on: false, capture: false, pos: new THREE.Vector3() };
const photoHint = document.getElementById('photo');
function setPhoto(on) {
  photo.on = on;
  if (on) photo.pos.copy(camera.position);
  gui.domElement.style.display = on ? 'none' : '';
  photoHint.classList.toggle('open', on);
}
const _pf = new THREE.Vector3(), _pr = new THREE.Vector3();
function photoUpdate(dt, input) {
  const up = camera.up;
  const cp = Math.cos(rig.pitch);
  // the rig's yaw/pitch (driven by the mouse) aim the free camera
  _pf.copy(player.frame.right).multiplyScalar(-Math.sin(rig.yaw) * cp)
    .addScaledVector(player.frame.up, -Math.sin(rig.pitch))
    .addScaledVector(player.frame.fwd, -Math.cos(rig.yaw) * cp).normalize();
  _pr.crossVectors(_pf, up).normalize();
  const sp = (input.ShiftLeft || input.ShiftRight ? 60 : 14) * dt;
  const f = (input.KeyW ? 1 : 0) - (input.KeyS ? 1 : 0), s = (input.KeyD ? 1 : 0) - (input.KeyA ? 1 : 0);
  const v = (input.KeyE ? 1 : 0) - (input.KeyQ ? 1 : 0);
  photo.pos.addScaledVector(_pf, f * sp).addScaledVector(_pr, s * sp).addScaledVector(up, v * sp);
  camera.position.copy(photo.pos);
  camera.lookAt(_pr.copy(photo.pos).add(_pf));
}
function savePhoto() {
  photo.capture = false;
  renderer.domElement.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `moebius-${levelId}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') setPhoto(!photo.on);
  if (photo.on && e.code === 'KeyH') gui.domElement.style.display = gui.domElement.style.display === 'none' ? '' : 'none';
  if (photo.on && e.code === 'Enter') photo.capture = true;
});

// ------------------------------------------------------------------ loop
const timer = new THREE.Timer();
let frameNo = 0;

// Nothing on the screen at rest (src/hud.js): no status box. The cue says what the use button does
// right here when it has nothing to float over (the ship's hatch and console, a lens) and a region's
// name as you cross into it; no button hints as you get into a vehicle (src/hud.js cueText).
const cue = new Cue(), placeName = new PlaceName();
function updateHud() {
  const now = performance.now();
  const quiet = busy() || photo.on || player.dead;
  const lens = !player.ride && expedition?.state.started && !expedition.state.done && expedition.nearby(player) >= 0 ? expedition.hud(player) : null;
  const text = cueText({ quiet, ride: player.ride?.kind ?? null, aiming: tool.aiming, shipHint: ship.hud(), shipPlaying: ship.playing,
    prompt: storyRt.prompt, promptAt: storyRt.promptAt, lens, boarding: player.boarding, controller: controllerActive });
  const indoors = interiorAt(player.pos);
  // (inside a shop: its name as you step in; back out, the street's name is not news)
  const place = quiet || ship.playing || ship.inside ? '' : placeName.update(indoors?.label ?? atmo?.name, now, { quiet: !indoors && placeName.wasIndoors });
  placeName.wasIndoors = !!indoors;
  const found = !quiet && now < scoutSaid.until ? scoutSaid.text : '';   // (what the scout found, a moment)
  let teach = '';
  if (firstSteps) {
    if (player._jumped) firstSteps.jumped();
    const moved = Number.isFinite(firstStepsAt.x) ? Math.hypot(player.pos.x - firstStepsAt.x, player.pos.z - firstStepsAt.z) : 0;
    firstStepsAt.copy(player.pos);
    const open = !quiet && !ship.playing && !ship.inside && !player.ride && !tool.aiming && !found && !text && game.flag('prologue.done') && !game.flag('item.backpack');
    const fdt = firstStepsT ? Math.min(0.1, (now - firstStepsT) / 1000) : 0; firstStepsT = now;
    teach = firstSteps.update(fdt, { active: open, moved: moved < 5 ? moved : 0 });   // (a teleport is no walk)
    if (quiet || ship.playing) teach = '';
  }
  cue.set(found || text || teach || place, found ? scoutSaid.kind : text || teach ? '' : 'place');
  // (the tank's gauge, when it shows without the crosshair, sits beside the traveller: left of the shoulders)
  placeToolGauge();
  audioCfg.mute = sound.muted;
}
const toolEl = document.getElementById('tool'), _tgP = new THREE.Vector3(), _tgR = new THREE.Vector3();
function placeToolGauge() {
  if (!toolEl) return;
  const b = document.body.classList, free = !b.contains('aiming') && (b.contains('tool-gauge') || b.contains('modeflash'));
  if (!free) { if (toolEl.style.left) toolEl.style.left = toolEl.style.top = ''; return; }
  _tgR.setFromMatrixColumn(camera.matrixWorld, 0);
  _tgP.copy(player.object?.position ?? player.pos).addScaledVector(player.frame.up, 1.45).addScaledVector(_tgR, -0.75).project(camera);
  if (_tgP.z > 1) return;
  toolEl.style.left = `${((_tgP.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px`;
  toolEl.style.top = `${((-_tgP.y * 0.5 + 0.5) * innerHeight - 40).toFixed(1)}px`;
}


const busy = () => restartOpen || shopPanel.isOpen || story.pageOpen || journal.open || changelog.open || picker.classList.contains('open') || worldDebug.open || menu.open || endingOpen || storyRt.busy() || ship.busy() || boxes.busy() || !!level.quickMenu?.open || !!minigame?.busy();
// a level's own quick menu (the References' list of views: src/levels/reference-picker.js): a menu like the others for the pad
const quickMenu = level.quickMenu ?? null;
if (quickMenu) quickMenu.blocked = () => busy() || photo.on;
const noInput = {};
let controllerActive = inputMode.controller;
// The controller's layout changed in v0.93 (src/bindings.js): a player with a save from before is told once,
// the first time a pad is used (the flag is the device's, like the settings)
const padSchemeNotice = () => {
  if (padSchemeNotice.done) return;
  padSchemeNotice.done = true;
  try {
    if (localStorage.getItem(PAD_SCHEME_KEY) === String(PAD_SCHEME)) return;
    localStorage.setItem(PAD_SCHEME_KEY, String(PAD_SCHEME));
  } catch { return; }
  if (savedEarly) setTimeout(() => showToast(quietOr('The controller layout changed. Menu, then Controls, lists every button.', PAD_SCHEME_NOTE)), 600);   // (the list itself: hints full)
};
const hintShown = { text: '', at: -1e9, active: false };
const controllerHint = document.createElement('div');
controllerHint.id = 'controller-hint';
document.body.appendChild(controllerHint);
// what a controller press goes to: the topmost thing open (a story page sits over a conversation)
const pageEl = document.getElementById('page');
const pageUp = () => pageEl.classList.contains('open');
// (in the order they stack on the screen: what's new, the Start menu, the sketchbook over a box's card, the
// worlds, a story page, a conversation; B / ○ closes the one on top, so the sketchbook opened over a
// conversation or a moment closes first)
const menuRoot = () => minigame?.cardEl() ?? (restartOpen ? restartEl : changelog.open ? changelog.el : menu.open ? menu.el : quickMenu?.open ? quickMenu.el : journal.open ? journal.el : shopPanel.isOpen ? shopPanel.root : boxes.busy() && boxes.card.el ? boxes.card.el : worldDebug.open ? worldDebug.el : picker.classList.contains('open') ? picker : pageUp() ? pageEl : storyRt.dialogue.open ? storyRt.dialogue.el : pageEl);
const closeControllerMenu = () => {
  if (restartOpen) return;   // (only confirm restarts: there is nothing to go back to)
  if (changelog.open) changelog.toggle(false);
  else if (menu.open) menu.back();
  else if (quickMenu?.open) quickMenu.toggle(false);
  else if (journal.open) { if (!journal.menu.back()) journal.toggle(false); }   // (a person's page, a sketch held up: back first)
  else if (shopPanel.isOpen) shopPanel.back();   // (out of a purchase's question first, then out of the shop)
  else if (storyRt.moments.playing) storyRt.moments.skip();   // B / ○ skips a moment (src/story/moment.js)
  else if (boxes.busy()) boxes.skip();
  else if (worldDebug.open) { if (document.activeElement === worldDebug.menu?.search) worldDebug.menu.search.blur(); else worldDebug.toggle(false); }
  else if (picker.classList.contains('open')) { if (document.activeElement === debugMenu.search) debugMenu.search.blur(); else showPicker(false); }
  else if (pageUp()) pageEl.click();
  else if (storyRt.dialogue.open) storyRt.dialogue.close();
  else pageEl.click();
};
// the input display (src/input-display.js): the pad drawn, every press with its raw index and what it does. Off by
// default everywhere (it covered the view on a small screen in the Arena); F6 anywhere, View + D-pad ← in the Arena
// (a free chord, src/bindings.js), the dev menu, ?inputs=1
inputDisplay.set(query.has('inputs') && query.get('inputs') !== '0');
inputDisplay.listen(() => devMenu.render());
const toggleInputs = () => showToast(inputDisplay.toggle() ? 'Controller inputs shown (F6).' : 'Controller inputs hidden.');
window.addEventListener('keydown', (e) => { if (e.code === 'F6' && !e.repeat) { e.preventDefault(); toggleInputs(); } });
window.addEventListener('padchord', (e) => { if (levelId === 'arena' && e.detail?.name === 'viewLeft') toggleInputs(); });
const controller = new Controller({
  context: () => busy() ? (menuRoot() === storyRt.dialogue.el ? 'talk' : 'menu') : photo.on ? 'photo' : player.ride ? 'ride' : 'game',
  faces: () => padFaces(),
  combat: () => foes.near(20),   // (a foe near: LB blocks, the right stick only looks)
  look: (x, y) => { if (x || y) rig.look(x, y); },
  activity: () => { inputMode.pad(); controllerActive = true; sound.start(); padSchemeNotice(); },   // (where a pad press may start sound: the Android app)
  navigate: (x, y, fresh) => { if (changelog.pad('navigate', x, y)) return; const root = menuRoot(); if (quickMenu && root === quickMenu.el) quickMenu.navigate(x, y); else if (root === journal.el) journal.menu.navigate(x, y); else menuNavigate(root, x, y, fresh); },
  scroll: amount => { if (changelog.pad('scroll', amount)) return; const root = menuRoot(); (root.querySelector('.list, .panel:not([hidden]), .sheet') ?? root).scrollTop += amount; },
  action: (name, dt) => {
    if (changelog.pad(name)) return;   // (the interactive changelog over the game takes the controller: src/changelog.js)
    if (minigame && !menu.open && !journal.open && minigame.padAction(name)) return;   // (a game's cards, its pause: src/minigames/kit/runner.js)
    if (name === 'zoomOut' || name === 'zoomIn') rig.zoom(Math.exp((name === 'zoomOut' ? 1 : -1) * dt));
    if (name === 'back') closeControllerMenu();
    // (in a menu, a conversation or a scene: Start toggles the Start menu, Select the sketchbook)
    if (name === 'start') { if (storyRt.moments.playing && !menu.open) storyRt.moments.skip(); else menu.toggle(!menu.open); }   // (Menu skips a moment too)
    if (name === 'select') journal.toggle(!journal.open);
    // LB / L1, RB / R1 in the game menu: the panel before, the one after
    if ((name === 'tabPrev' || name === 'tabNext') && menuRoot() === journal.el) journal.menu.turn(name === 'tabPrev' ? -1 : 1);
    if ((name === 'tabPrev' || name === 'tabNext') && quickMenu && menuRoot() === quickMenu.el) quickMenu.turn?.(name === 'tabPrev' ? -1 : 1);   // (the References' list: the world before / after)
    if ((name === 'tabPrev' || name === 'tabNext') && menuRoot() === picker) debugMenu.jump(name === 'tabPrev' ? -1 : 1);   // (the Debug menu: the section before / after)
    if (name === 'y' && menuRoot() === picker) debugMenu.focusSearch();   // (and Y its filter)
    if ((name === 'tabPrev' || name === 'tabNext') && worldDebug.open && menuRoot() === worldDebug.el) worldDebug.menu.jump(name === 'tabPrev' ? -1 : 1);   // (the world debug menu: the same)
    if (name === 'y' && worldDebug.open && menuRoot() === worldDebug.el) worldDebug.menu.focusSearch();
    if (name === 'confirm') {
      const root = menuRoot();
      if (root.id === 'dialogue') { const f = document.activeElement; if (f?.dataset?.i !== undefined && root.contains(f) && storyRt.dialogue.revealed >= storyRt.dialogue.runner.text.length) f.click(); else storyRt.dialogue.next(); }
      else if (root.id === 'page') root.click();
      else if (root === journal.el) journal.menu.confirm();
      else if (root.contains(document.activeElement)) {
        const el = document.activeElement;
        if (!padConfirm(el)) el.click();   // (a dropdown opens, then keeps the choice shown: src/menu-pad.js)
      }
      else menuNavigate(root, 0, 1);
    }
    if (name === 'settings') menu.toggle(true);
    if (name === 'journal' && level.compare) level.compare();   // (the references: View compares the render with its panel)
    else if (name === 'journal') journal.toggle(true);
    if (name === 'worlds') showPicker(true);
    if (name === 'photo') setPhoto(!photo.on);   // (View + D-pad ↑ from play; back, View or Menu in it)
    if (name === 'capture') photo.capture = true;
    if (name === 'potion') drinkPotion();   // D-pad ←: drink a healing potion
    if (name === 'call' && quickMenu) quickMenu.toggle(true);   // (the Arena's foes, the Arcade's board, the References' views: D-pad ↓ opens the level's list; there is no mount to call there)
    else if (name === 'call' && !ship.playing) player.callMount();   // D-pad ↓: whistle for the mount or hail a taxi (the keyboard's E still falls back to it)
    if (name === 'lock' && level.jump) level.jump(1);   // in the Lab, R3 / L3 hop to the next / previous world's room
    else if (name === 'lock' && !ship.playing) {
      // R3: lock on to a foe, then the next, then let go (Tab: src/foes.js); with no foe in reach, the scout
      // finds the objective (Q; src/scout.js), as a scan does in other games
      const had = foes.lock;
      if (!foes.cycleLock() && !had && !minigame) scout.ping();
      else if (foes.lock && !had && !game.flag('hint.hop.taught') && hintsFor('teach')) { game.set('hint.hop.taught', true); showToast(keyText(tr('hint.hop'), { teach: true })); }   // (locked on, a new verb: the hops, taught once)
    }
    if (name === 'l3' && level.jump) level.jump(-1);
    if (name === 'worldDebug' && (worldDebug.open || !busy() || menuRoot() === picker)) worldDebug.toggle();   // L3 + R3: the world debug menu (F2; the hitbox overlay is in it, and F4)
    // the free View + D-pad chords (src/bindings.js FREE): a 'padchord' event any system may listen for
    if (name === 'viewDown' || name === 'viewLeft' || name === 'viewRight') window.dispatchEvent(new CustomEvent('padchord', { detail: { name } }));
  },
});
inputDisplay.bind({ context: () => controller.lastContext ?? 'game', index: () => controller.index });
// The keyboard, the mouse or a finger takes over from the controller (and back on its next use). A pad
// that is connected (the Retroid's own controls) counts as in use until the screen or keys are touched,
// so a handheld shows no touch buttons from the start (src/input-mode.js).
for (const event of ['keydown', 'pointerdown', 'touchstart']) window.addEventListener(event, (e) => { inputMode.event(e); controllerActive = inputMode.controller; inputMode.apply(document.body.classList); }, { capture: true, passive: true });


// People's eyes, brows and small gear (under 7 cm) cast no visible shadow but cost a draw call
// in each of the three shadow passes (~60 a frame by a camp fire): they skip the shadow passes.
let tinyCache = null;
function tinyShadowCasters() {
  if (tinyCache && tinyCache.n === npcs.length) return tinyCache.list;
  const list = [], s = new THREE.Vector3();
  for (const root of [player.object, ...npcs.map((n) => n.object)]) {
    root?.updateMatrixWorld(true);
    root?.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const r = (o.geometry.boundingSphere?.radius ?? 1) * o.getWorldScale(s).x;
      if (r < 0.07) list.push(o);
    });
  }
  tinyCache = { n: npcs.length, list };
  return list;
}

// Self-lit things (flames, embers, smoke, lamps: glow >= 0.8) give light; they don't block it.
// Their shadows were the ones crawling over Qanat's walls: the burning tree's smoke column and
// flames, animated every frame, swept moving shadows across the city. (A glowing solid opts back in
// with userData.castShadow = true, and anything can opt out with false: shadows.js selfLitSkips.)
let glowCache = null;
function glowCasters() {
  if (glowCache && glowCache.n === scene.children.length) return glowCache.list;
  const list = [];
  scene.traverse((o) => { if (o.isMesh && selfLitSkips(o)) list.push(o); });
  glowCache = { n: scene.children.length, list };
  return list;
}

// What each pass draws (perf.js, shadows.js): beyond the camera's frustum culling, small props
// under a pixel or two, rooms off the map you aren't in, and in the shadow passes the casters
// whose shadow can't reach the view or that are smaller than about a texel of that cascade.
const shadowCull = new ShadowCuller(scene);
const smallCull = new SmallCuller(scene);
let roomCull = null;
const makeRoomCull = () => new RoomCuller(scene, offMapRooms, { keep: [player.object, player.mount?.object, ...player.vehicles.map((v) => v.object ?? v.mesh), ...npcs.map((n) => n.object)] });
// and the other way round: inside one of those rooms, the whole map outside it (perf.js InteriorCuller)
const interiorCull = new InteriorCuller(scene, offMapRooms, { ground: (x, z) => terrain.heightAt?.(x, z) ?? 0 });
// levels of detail (lod.js): distant static meshes drawn coarser, by no more than the preset's
// lodPx pixels; never the terrain (dug into at runtime) or anything that moves with a person
let lod = null;
const makeLod = () => new LodManager(scene, { keep: [...movers(), terrain?.mesh] });
const movers = () => [player.object, player.mount?.object, ...player.vehicles.map((v) => v.object ?? v.mesh), ...npcs.map((n) => n.object), ...(crowd?.pool ?? []).map((e) => e.npc?.object)];
const shadowDir = new THREE.Vector3();
const frameStats = { calls: 0, tris: 0, n: 0, culled: 0 };
renderer.info.autoReset = false;   // one frame's draw calls over all its passes (the F readout)

/** One shadow pass: place the cascade, hide what it doesn't need, render, show it again. A map kept over
 *  several frames (kept) holds the casters of every view within VIEW_SLACK of this one (shadows.js). */
function shadowPass(c, reach, hide = [], kept = false) {
  c.place(player.pos);
  const off = shadowCull.hide(reach, c.texel, c.depth, 0.75, hide, kept ? VIEW_SLACK : null);
  c.view = viewOf(camera, c.view);
  c.render(renderer, scene);
  // (a mesh whose shape its own material makes, drawn with that material: the traveller's overshirt, tripo-cloth.js)
  if (player.object.visible) for (const o of player.character?.shadowCasters ?? []) renderer.render(o, c.cam);
  frameStats.culled += off.length;
  for (const o of off) o.visible = true;
}

/** The whole pipeline for one view: shadows, G-buffer, composite, overlays. */
const _subjUp = new THREE.Vector3(0, 1, 0);
const framePin = pinRenderFrame(renderer);   // (the passes of a frame update the skeletons once: perf.js)
function renderFrame() {
  renderer.info.reset();
  framePin.begin();
  // the scene graph's matrices once per frame, not once per pass: renderer.render() walks the
  // whole scene to update them every call, and a frame makes four or five calls (~1 ms of CPU)
  scene.matrixWorldAutoUpdate = true;
  scene.updateMatrixWorld();
  scene.matrixWorldAutoUpdate = false;
  // hidden in every pass of this frame (then shown again): far pebbles and shrubs, props under
  // a pixel or two on screen, rooms off the map while the camera is elsewhere
  camera.updateMatrixWorld();
  const frameHidden = [];
  const pxPerRad = gbuffer.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  flora?.update(camera, preset.floraFar ?? 1, { pxPerRad, px: preset.lodPx ?? 0 });   // each species draws the plants in view near enough (the far ones coarser)
  blades.grass?.update(camera);
  cullFar(tiled.small, camera, preset.propFar, frameHidden);
  smallCull.hide(camera, pxPerRad, preset.propPx, frameHidden);
  (roomCull ??= makeRoomCull()).hide(camera, frameHidden);
  interiorCull.hide(camera, frameHidden);
  lodView.pxPerRad = pxPerRad; lodView.px = preset.lodPx ?? 0;
  skinnedLods.update(camera, pxPerRad, preset.lodPx ?? 0);   // the people far off: simpler bodies (skinned-lod.js)
  (lod ??= makeLod()).update(camera, pxPerRad, preset.lodPx ?? 0);
  if (crowd) crowd.range.dist = preset.lodPx ? (CROWD_DIST_CELL * pxPerRad) / preset.lodPx : Infinity;   // the crowd's distant figure, by the same rule

  // 1. shadow maps. The light direction is quantised (a moving sun turns the maps in rare tiny
  // steps); when it turns, every cascade refreshes together so their hand-over stays seamless.
  // Otherwise the near map refreshes every nearEvery-th frame, the wide one every farEvery-th.
  shadowDirection(sharedUniforms.uSunDir.value, shadowDir);
  let turned = false;
  for (const c of Object.values(cascades)) turned = c.aim(shadowDir) || turned;
  scene.overrideMaterial = shadowOverride;
  const shadowHidden = [];
  for (const list of [level.noShadow ?? [], player.gear?.noShadow ?? [], tinyShadowCasters(), glowCasters()])
    for (const o of list) if (o.visible) { o.visible = false; shadowHidden.push(o); }
  shadowCull.begin(camera, shadowDir, { vertical: !level.gravityAt });
  const camToPlayer = camera.position.distanceTo(player.pos);
  if (cascades.fine.enabled) shadowPass(cascades.fine, camToPlayer + cascades.fine.extent * 1.8);
  // (and drawn again as soon as the view has turned or moved out of what the last one was culled for)
  const nearKept = preset.nearEvery > 1;
  if (turned || frameNo % preset.nearEvery === 0 || (nearKept && viewLeft(cascades.near.view, camera))) shadowPass(cascades.near, camToPlayer + cascades.near.extent * 1.8, [], nearKept);
  if (turned || frameNo % preset.farEvery === (preset.nearEvery > 1 ? 1 : 0) || viewLeft(cascades.far.view, camera)) {
    // pebbles and bushes don't need km-wide shadows (but a tile of boulders, globes or pillars does)
    const small = farPassSkips(tiled.small, cascades.far.texel);
    for (const o of small) o.visible = false;
    if (preset.lodPx) lod.shadowPass(cascades.far.texel);   // nor detail finer than a texel of it
    shadowPass(cascades.far, camera.far, [], true);
    lod.viewPass();
    for (const o of small) o.visible = true;
  }
  frameNo++;
  scene.overrideMaterial = null;
  for (const o of shadowHidden) o.visible = true;

  // 2. G-buffer (clearing to 0 marks sky pixels with depth 0)
  camera.updateMatrixWorld();
  renderer.setRenderTarget(gbuffer);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  waters.renderGBuffer(renderer, scene, camera, gbuffer);   // (the water drawn last over the scene's depth: its contact foam, src/water.js)
  bloom.render(renderer);   // the glowing surfaces, for the halos

  // 3. Moebius composite
  U.uInvProj.value.copy(camera.projectionMatrixInverse);
  U.uCamWorld.value.copy(camera.matrixWorld);
  U.uProj11.value = camera.projectionMatrix.elements[5];
  // Projected player size controls how much fine ink detail remains visible.
  setSubject(U, camera, player.pos, player.frame?.up ?? _subjUp, player.hidden);
  renderer.setRenderTarget(composeRT);
  renderer.clear();
  renderer.render(post.scene, post.camera);
  waters.renderOver(renderer, camera, { tNormal: gbuffer.textures[1], tAlbedo: gbuffer.textures[0], target: composeRT, toon: U.uToon.value });   // the sun's sparkle; under water, the tint and haze

  // 4. wind-blown sand and drifting motes, drawn on top (depth-tested against the G-buffer)
  // (not in a portrait shot: just the person against a flat colour)
  if (!portraitShot) {
    level.veils?.render(renderer, camera, composeRT);   // the see-through surfaces' bodies, a pale wash (src/veil.js: Lorn II's mushrooms)
    renderer.render(wind.scene, camera);
    if (motes) renderer.render(motes.scene, camera);
    if (HOLO.live()) HOLO.render(renderer, camera, composeRT);   // the recordings' hologram: light, not ink
    if (hitboxes.on) hitboxOverlay.render(renderer, camera, composeRT);   // the fight's hitboxes, on top (src/hitbox-overlay.js)
  }

  // 5. smooth edges and scale the completed frame to the display
  renderer.setRenderTarget(null);
  renderer.render(blit.scene, post.camera);
  for (const o of frameHidden) o.visible = true;
  framePin.end();
  frameStats.calls += renderer.info.render.calls; frameStats.tris += renderer.info.render.triangles; frameStats.n++;
  scene.matrixWorldAutoUpdate = true;   // (anything else that renders the scene keeps the usual behaviour)
}

/** Render the scene from another viewpoint and grab it as an image (comic panels, sketches). */
const grabCanvas = document.createElement('canvas');
const _cp = new THREE.Vector3(), _cq = new THREE.Quaternion(), _cu = new THREE.Vector3();
// o.keep: draw only these objects (a conversation's portrait), with o.backdrop ('#hex') in place of the sky
// o.css: the size (CSS px) the image is shown at (the portrait's circle). The frame is then drawn as if
// it were that small (lines, hatching and grain in its pixels: uPixelRatio), at the full render's
// resolution, and shrunk down by halves: supersampled, so thin ink stays whole instead of breaking
// into jagged dots, and kept as a PNG (no JPEG ringing round the lines).
let portraitShot = false;
const shrinkCanvas = [document.createElement('canvas'), document.createElement('canvas')];
/** Shrink the source rectangle into `out` (w × h) by halves (each a 2 × 2 average), then the last step. */
function shrinkInto(src, sx, sy, sw, sh, out, w, h) {
  let cur = src, cx = sx, cy = sy, cw = sw, ch = sh, k = 0;
  while (cw >= w * 2 && ch >= h * 2) {
    const c = shrinkCanvas[k++ % 2], nw = Math.ceil(cw / 2), nh = Math.ceil(ch / 2);
    if (c.width < nw || c.height < nh) { c.width = Math.max(c.width, nw); c.height = Math.max(c.height, nh); }
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.clearRect(0, 0, nw, nh);
    g.drawImage(cur, cx, cy, cw, ch, 0, 0, nw, nh);
    cur = c; cx = 0; cy = 0; cw = nw; ch = nh;
  }
  out.width = w; out.height = h;
  const g = out.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(cur, cx, cy, cw, ch, 0, 0, w, h);
}
function captureView(eye, look, w, h, { keep = null, backdrop = null, fov = null, css = null } = {}) {
  _cp.copy(camera.position); _cq.copy(camera.quaternion); _cu.copy(camera.up);
  camera.position.copy(eye);
  camera.up.copy(player.frame.up);
  camera.lookAt(look);
  const fov0 = camera.fov;
  if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const hidden = keep ? isolate(keep, scene) : [];
  const weather = [U.uRain.value, U.uStorm.value], pr = [U.uPixelRatio.value, SU.uPixelRatio.value];
  if (keep) {
    portraitShot = true;
    U.uRain.value = U.uStorm.value = 0;
    if (backdrop) { const c = new THREE.Color(backdrop); U.uBackdrop.value.set(c.r, c.g, c.b, 1); }
  }
  // drawn at the size it is shown: the crop (the frame's height, a square) is css CSS px across
  if (css) U.uPixelRatio.value = SU.uPixelRatio.value = portraitPixelRatio(gbuffer.height, css, pr[0]);
  try { renderFrame(); } finally {
    restore(hidden);
    portraitShot = false;
    [U.uRain.value, U.uStorm.value] = weather;
    [U.uPixelRatio.value, SU.uPixelRatio.value] = pr;
    U.uBackdrop.value.w = 0;
    if (fov) { camera.fov = fov0; camera.updateProjectionMatrix(); }
  }
  const src = renderer.domElement;
  const aspect = w / h, sw = src.width, sh = src.height;
  let cw = sw, ch = sw / aspect;
  if (ch > sh) { ch = sh; cw = sh * aspect; }
  if (css) shrinkInto(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, grabCanvas, w, h);
  else {
    grabCanvas.width = w; grabCanvas.height = h;
    grabCanvas.getContext('2d').drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
  }
  camera.position.copy(_cp); camera.quaternion.copy(_cq); camera.up.copy(_cu);
  camera.updateMatrixWorld();
  // A capture reads the WebGL canvas with drawImage, which some drivers hand back empty. An empty
  // portrait is worse than none: the circle would show a flat disc of the world's backdrop with the
  // person missing (the Retroid, TODO.md). Say so instead, and the panel falls back to the initial.
  // (Portraits only: a comic panel of open sky is legitimately one colour.)
  if (css && blankCapture(grabCanvas)) return null;
  return css ? grabCanvas.toDataURL('image/png') : grabCanvas.toDataURL('image/jpeg', 0.82);
}
/** Did the capture come back empty: every pixel clear, or every pixel the same colour? */
function blankCapture(c) {
  let d;
  try { d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; } catch { return false; }   // (its own context, already made above)
  const r0 = d[0], g0 = d[1], b0 = d[2];
  let clear = true, flat = true;
  for (let i = 0; i < d.length; i += 4 * 7) {   // (every seventh pixel: enough to tell a picture from a blank)
    if (d[i + 3] > 8) clear = false;
    if (Math.abs(d[i] - r0) > 4 || Math.abs(d[i + 1] - g0) > 4 || Math.abs(d[i + 2] - b0) > 4) flat = false;
    if (!clear && !flat) return false;
  }
  return true;
}

// F: frame rate, frame time (and the CPU's and, where the browser can time it, the GPU's share),
// render scale, draw calls and triangles per frame over all passes, and the running preset:
// one line to screenshot when something is slow.
const fpsEl = document.getElementById('fps');
const gpuTimer = new GpuTimer(renderer.getContext());
let fpsN = 0, fpsT = performance.now(), cpuMs = 0, lastFrameT = 0;
const gaps = [];   // this window's frame intervals (ms): the missed refreshes, for dynamic resolution
/** Frames in this window that missed a refresh: over 1.5x the window's quickest interval. */
function missedFrames() {
  let quick = Infinity, n = 0;
  for (const g of gaps) quick = Math.min(quick, g);
  for (const g of gaps) if (g > quick * 1.5) n++;
  return n;
}
window.addEventListener('keydown', (e) => { if (e.code === 'F3' && !photo.on) { e.preventDefault(); settings.set('showFps', !settings.showFps); } });   // (F is the fluid blade)
window.addEventListener('keydown', (e) => { if (e.code === 'Tab' && !e.repeat && !busy() && !photo.on) { e.preventDefault(); foes.cycleLock(); } });   // lock on (R3 on a pad: src/foes.js)
// (first the engine, and a benchmark's label when it sets one: window.__benchLabel, e.g. "camps r2/3")
const ENGINE = window.__fpsEngine = engineLabel(navigator.userAgent, location.search, window.Capacitor);
function frameReadout(fps) {
  const n = Math.max(frameStats.n, 1), gpu = gpuTimer.take();
  return `${ENGINE}${window.__benchLabel ? ` ${window.__benchLabel}` : ''} · ${Math.round(fps)} fps · ${(1000 / fps).toFixed(1)} ms (cpu ${(cpuMs / fpsN).toFixed(1)}${gpu !== null ? ` gpu ${gpu.toFixed(1)}` : ''})`
    + ` · ${quality.renderScale}× · ${Math.round(frameStats.calls / n)} calls · ${Math.round(frameStats.tris / n / 1000)}k tris · ${preset.key}`
    + xboxReadout();   // (the Xbox app only: whether the JIT is on, the JS heap; '' elsewhere)
}
function frame(ts) {
  const tFrame = performance.now();
  // the missed refreshes from the animation frame's timestamp (when the frame is shown), not from when its
  // callback starts: GeckoView starts a late frame's callback late and evenly (19-22 ms apart while the
  // screen shows 17 and 33), which hid every missed refresh from dynamic resolution (docs/systems/performance.md)
  const tShown = Number.isFinite(ts) ? ts : tFrame;
  if (lastFrameT && gaps.length < 200) gaps.push(tShown - lastFrameT);
  lastFrameT = tShown;
  if (++fpsN, tFrame - fpsT > 500) {
    const fps = (fpsN * 1000) / (tFrame - fpsT);
    if (settings.showFps) fpsEl.textContent = frameReadout(fps);
    adaptQuality(fps, missedFrames(), cpuMs / fpsN, Math.min(...gaps, 1000 / 60));   // (the main thread's time a frame, the refresh)
    fpsN = 0; fpsT = tFrame; cpuMs = 0; gaps.length = 0;
    frameStats.calls = frameStats.tris = frameStats.n = frameStats.culled = 0;
  }
  gpuTimer.enabled = settings.showFps;
  timer.update();
  const rawDt = timer.getDelta();
  const realDt = Math.min(rawDt, 1 / 20);
  const dt = feelDt(realDt);   // (a hit-stop slows the world for a few hundredths of a second: src/feel.js)
  const pdt = selfDt();   // (the traveller's own step: a perfect dodge's flurry slows the world round him, not him: src/flurry.js)
  const padInput = controller.update(pdt, !document.hidden && document.hasFocus());
  inputDisplay.update();   // (off: nothing)
  inputMode.frame(controller.index !== null);
  controllerActive = inputMode.controller;
  inputMode.apply(document.body.classList);
  // No button list on the screen while playing, talking or in menus (the settings list the controls);
  // only photo mode, a tool few find by chance, keeps its own. Set only when it changes (the label rewrite watches the page).
  const hintText = photo.on ? `Left stick fly · right stick look · LB/RB down/up · ${confirmKey()} save · ${backKey()} exit` : '';
  if (hintText !== hintShown.text) { controllerHint.textContent = hintText; hintShown.text = hintText; hintShown.at = simT; }
  document.body.classList.toggle('controller-hint', controllerActive && photo.on);
  if (paused()) { pausedFrame(); requestAnimationFrame(frame); return; }
  simT += dt;
  const t = simT;   // the world's clock: it stops while a menu is open
  playClock += Math.min(rawDt, 1);
  const mergedInput = mergeControls(latchedInput(), padInput);
  wasBusy = busy();
  if (wasBusy && mergedInput.KeyE) eBlocked = true;
  if (!mergedInput.KeyE) eBlocked = false;
  if (eBlocked) mergedInput.KeyE = false;
  const ctl = wasBusy ? noInput : ship.input(mergedInput);   // the ship's E and its autopilot

  if (sky.speed > 0) sky.hour = (sky.hour + (sky.speed / 60) * dt) % 24;
  // region fog / horizon follow the player smoothly (the field itself is smooth)
  // (inside a building, the air and light of the street at its door, not of the slot far overhead: src/interior-kit.js)
  const indoorAt = interiorAt(player.pos)?.door.at;
  atmo = indoorAt ? level.atmo(indoorAt.x, indoorAt.z, indoorAt.y) : level.atmo(player.pos.x, player.pos.z, player.pos.y);
  updateSky();
  level.lightAt?.(player.pos, sharedUniforms.uSunDir.value);

  physics.syncMovers(dt);   // the moving colliders (the great wheel) to where they were drawn last frame, before anyone moves
  for (const v of player.vehicles) if (v !== player.ride) v.update(dt, null, t);
  // E goes to the nearest person / thing / vehicle first (src/interact.js); only then to the player's whistle
  const ePressed = !!ctl.KeyE && !eWasDown && !photo.on && !player.down; eWasDown = !!ctl.KeyE;   // (no talking while knocked down)
  const interacted = storyRt.update(dt, t, { camera, ePressed, paused: busy() || photo.on || ship.playing }).handled;
  passage.update(dt);   // a hand-over under way: the move happens here, before the traveller and the camera do
  if (photo.on) {
    if (!busy()) photoUpdate(dt, mergedInput);
  } else if (minigame?.drives) {
    minigame.update(dt, busy() ? noInput : ctl);   // the game moves the traveller and the camera (src/minigames/)
    shakeCamera(camera, realDt);
  } else {
    player.camFwd = camera.getWorldDirection(player.camFwd ?? new THREE.Vector3());   // whistled mounts arrive into view
    const usingLens = expedition?.update(dt, player, ctl, busy());
    if (usingLens && ctl.KeyE) player._eHeld = true; // the same press must not whistle after the last turn
    if (interacted) player._eHeld = true;
    gadgets.control(pdt, busy() ? noInput : ctl, busy() || ship.playing || (!!minigame && !minigame.def.trial));   // (a trial in the world keeps the gadgets: the fan in the skiff's sail)   // (before the traveller moves: the hook's reel sets his velocity; a game takes the buttons)
    player.update(pdt, busy() ? noInput : ctl, rig.yaw);
    // (a wider arm for what needs to see ahead and below: gliding, the jets the more the faster; a little for climbing and swimming)
    const jets = player.onJets, jetSpeed = jets ? player.vel.length() : 0;
    const wide = player.riding ? null : player.gliding ? 7 : jets || player.jetHold ? 3.5 + Math.min(jetSpeed, 30) * 0.12 : player.climbing ? 1.5 : player.swim ? 0.8 : 0;
    // flying on the jets the camera comes round behind the nose and tips with it, as a ride's does (the right stick or the mouse take it for a moment)
    const jetShot = jets ? (jetShotK.pitch = jetCameraPitch(player.jetFlight.pitch), jetShotK) : null;
    rig.follow(player.ride?.heading ?? player.heading, pdt, player.riding || player.gliding || jets, player.ride?.shot ?? jetShot, wide);
    rig.down = !!player.down;   // knocked down: the camera follows the body on the ground, lower and softer
    rig.air = !player.onGround && !player.climbing && !player.swim && !player.riding;   // a hop close in: the view rises with it softly (CameraRig.update)
    rig.update(player.pos, pdt, player.frame);
    storyRt.frameCamera(camera);   // the two-shot while talking
    if (minigame) minigame.update(dt, busy() ? noInput : ctl);   // a game played on foot (drives: false): its clock, targets, waves; after the rig, so it may take the camera (src/minigames/)
    shakeCamera(camera, realDt);   // a blow's jolt (src/feel.js)
  }
  boxes.update(dt, t, { camera });   // (after the player: it poses the kneel; before the ship, which places its camera)
  itemFx.update(dt, t);
  ship.update(dt, t, mergedInput, { photo: photo.on });   // inside / outside, its scenes and their camera
  tool.update(pdt, ctl, busy() || photo.on || !!minigame?.drives);   // (a game on foot keeps the blade and the gun)
  gadgets.update(pdt, busy() || photo.on || ship.playing || (!!minigame && !minigame.def.trial));   // (after the tool: an aiming gadget's camera and pose win)
  flammables.update(dt, t, player.pos);
  chemistry.update(dt, player.pos);
  trialsRt?.update(dt, t);   // the trials' wind columns and signs (src/trials/)
  scout.flare.eye = camera.position;
  scout.update(dt, busy() || photo.on);
  if (level.temple) struggle.tick(guardianHint(level.temple)?.id, busy() ? 0 : dt);   // (how long this phase of a guardian's fight has gone on: the drone's hints open after a struggle)
  // flocks circle the player (also in photo mode, so you can fly up to them)
  // (none in orbit: the prologue's ship and a homecoming's are high above the map, and birds would circle it there)
  const orbit = !!ship.spaceCopy && player.pos.y > (level.ground.heightAt?.(player.pos.x, player.pos.z) ?? 0) + 1000;
  for (const f of flocks) { for (const m of [...f.wings, f.bodies]) m.visible = !orbit; if (!orbit) f.update(dt, t, player.pos, camera.position); }
  motes?.update(dt, t, camera.position);
  footprints?.update(dt);
  jumpShadow.update(player, physics);
  updateLights();
  // weather: wind, haze, rain and storm feed the shader, the cloth and the sound
  // (none of it indoors, and no rain drawn under a roof with you: src/shelter.js)
  const W = weather.update(dt);
  const Wx = shelter.update(dt, camera.position, camera.up, [player.pos]).apply(W);
  U.uRain.value = Wx.rain;
  U.uRainNear.value = Wx.dryNear;
  U.uStorm.value = Wx.storm;
  U.uFogMul.value *= 1 + W.fog * 2.6 + Wx.storm * 2.2 + Wx.rain * 0.6;
  wind.boost = Wx.storm;
  {
    const [wx, wz] = wind.windDir;
    const k = (level.features.wind ? 2.5 : 1.2) * (1 + Wx.storm * 3.5 + Wx.rain * 0.6) * (1 - 0.8 * shelter.indoor);
    player.wind.set(wx * k, 0, wz * k);
    // the plants feel the same wind: its direction, its strength (storms bend them hard), its gusts
    // and the traveller brushing past them: their last second of steps (src/brush.js)
    brushTrail.update(dt, player.riding ? null : player.pos, Math.hypot(player.vel.x, player.vel.z));
    sharedUniforms.uWind.value.set(wx, wz, (level.features.wind ? 1 : 0.55) * (1 + Wx.storm * 2 + Wx.rain * 0.4), wind.gust());
  }
  // doorways into interiors (and back out): the hand-over (src/passage.js): its destination drawn
  // ahead as you come near, then the paper sweeps across, you walk on out of the far side
  portalCool = Math.max(portalCool - dt, 0);
  if (!portalCool && !passage.active && !player.riding && !player.dead && level.portals) {
    for (const pt of level.portals) {
      const d = player.pos.distanceTo(pt.at);
      if (d < pt.r + PASSAGE.near) passage.prepare(pt.to);
      if (d < pt.r) {
        passage.go({ to: pt.to, heading: pt.heading });
        sound.page();
        portalCool = 1.2 + PASSAGE.cover + PASSAGE.reveal;
        break;
      }
    }
  }
  if (crowd && level.crowdAway) crowd.away = level.crowdAway();   // (a world's night thins its street: bazaar.js)
  if (crowd) crowd.hush = !talkAllowed({ shipPlaying: ship.playing });   // (no shouts over the crash or a landing: src/ship/landing.js)
  crowd?.update(dt, t, player, camera);
  for (const n of npcs) n.update(dt, player, camera);
  errands.update();
  // only the nearest talking villager shows a balloon
  {
    camera.updateMatrixWorld();   // project with this frame's camera, not last frame's
    let best = null, bd = Infinity;
    // (while a moment is filmed only a shout the moment asked for: an idle bark over a panel reads as a caption, src/story/moment.js)
    const filming = storyRt.moments.playing;
    // (and nobody at all until the player has the controls: the crash, a landing, a recording: src/ship/landing.js)
    const talk = talkAllowed({ shipPlaying: ship.playing }) && !shopPanel.isOpen;   // (nor over the shop panel: the keeper speaks in it)
    if (talk) for (const n of npcs) if (n.talking && (!filming || (n.shout && n.time < n.shout.until))) { const d = n.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = n; } }
    const prompted = storyRt.prompt && storyRt.promptEntry?.npc;
    for (const n of npcs) n.placeBalloon(camera, n === best, n === prompted ? 30 : 0);
    // a balloon that speaks of humming: the hum, softly (src/story/hum.js)
    if (best?._balloonLine && best._balloonLine !== lastBalloon) { lastBalloon = best._balloonLine; hearWords(best._balloonLine); }
    // the one who talks near you says it with their face too (src/talk-face.js; a conversation drives its own)
    if (best?.humanoid && !best.talkTo && best.object.visible && camera.position.distanceTo(best.pos) < TALK_FACE.near) talkFaces.drive(best.humanoid, best.balloonFace());
    talkFaces.update(dt);
    updateHands(dt, { player, npcs, camera });   // the fingers: relaxed, gripping, gesturing with the line (src/hands.js)
    player.character?.updateHands();
    if (!busy() && !photo.on && talk) storyRt.placePrompt(camera, controllerActive); else storyRt.placePrompt(camera, false);
  }
  relics.update(dt, t, player);
  if (!minigameDef) story.update(dt, t, camera);   // (a game's page tells no story: its host's goal is not reached by standing in the game)
  const rideK = player.ride?.kind;
  if (rideK === 'bird' && (ctl.Space || ctl.Throttle > 0.3) && (flapT -= dt) <= 0) { sound.flap(); flapT = 0.5; }
  foley.update(player, dt);
  sound.update({
    speed: player.riding ? 0 : Math.hypot(player.vel.x, player.vel.z), gust: wind.gust(), storm: Wx.storm, rain: Wx.rainOut, rainRoof: Wx.rainRoof,
    thrusting: player.thrusting || player.jetHold, jetPower: player.jetPower, riding: player.riding, rideKind: rideK, rideSpeed: player.ride?.speed ?? 0,
    altitude: interiorAt(player.pos) ? 0 : player.pos.y - (terrain.heightAt ? terrain.heightAt(player.pos.x, player.pos.z) : player.pos.y),   // (a shop's room is high over the map: on the ground, for the wind)
    flying: player.gliding || !!player.jetFlight, indoor: shelter.indoor, night: sky.hour < 6.4 || sky.hour > 19.3,
    roar: level.roar?.(player.pos) ?? 0,   // (a waterfall near: src/levels/waterfall.js)
    hum: level.hum?.(player.pos) ?? 0,   // (masts and a receiver near: src/levels/antennas.js)
    rails: level.rails?.(player.pos) ?? null,   // (a train's wheels under you: src/levels/overnight-train.js)
    footing: player.footing,   // (the world's ground or something built on it: the footsteps' surface)
  });

  // sand: ambient gusts + dust behind the bike
  const pxScale = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / window.innerHeight;
  const b = player.mount;
  if (b && player.ride === b && b.grounded && Math.abs(b.speed) > 10 && world.wind) {
    const [fx, fz] = b.forward;
    for (let i = 0; i < Math.abs(b.speed) / 12; i++)
      wind.emit(b.pos.x - fx * 1.8, b.pos.z - fz * 1.8, b.vel.x * 0.25 - fz * (Math.random() - 0.5) * 6, b.vel.z * 0.25 + fx * (Math.random() - 0.5) * 6);
  }
  // leaning into the world's edge: the wind that holds you back streams in round you (src/edge.js)
  if (player.edge?.k > 0.03 && !player.ride) wind.edgeGust(dt, player.edge.at, player.edge.n, player.edge.k);
  edgeInk.update(dt, player.ride ? null : player.edge, player.frame.up, camera, pxScale);   // and the ink shimmers where you touch it
  wind.update(dt, player.pos, camera, terrain, pxScale, world.wind);
  if (trails) {
    const m = player.mount, moving = Math.hypot(m.vel.x, m.vel.z) > 3;
    m.body.updateMatrixWorld(true);
    trails.forEach((tr, i) => tr.update(dt, moving ? m.body.localToWorld(JETS[i].clone()) : null));
  }
  updateHud();
  if (!busy() && !ship.playing) updateHazards(dt, player, { notice: (t) => { if (hintsFor('tip')) showToast(t); } });   // ("It burns!": the hurt says it; the line, hints full)   // fire and spines (src/hazards.js)
  updateHealth(dt);
  level.update(dt, t, { player, rig, camera, passage, fade: (k, secs) => ship.cinema?.fade(k, true, secs) });
  reactiveWorld.update(dt, t, player, camera, busy() || photo.on);
  wildlife.update(dt, t, player, camera, busy() || photo.on);
  foes.update(dt, busy() || photo.on || ship.playing);
  if (flurryLeft() > 0 && !foes.anyFighting()) endFlurry();   // (nothing left to cut: the world comes back to speed)
  flurryFx.update();
  if (!(busy() || photo.on || ship.playing)) chimes.update(dt, player.dead ? null : player.pos);   // (src/chimes.js: picked up walking over them, or drawn in)
  chimeView.update(chimes, camera);
  // locked on (R3 / Tab): the camera turns to keep the foe ahead (src/foes.js)
  // and the traveller faces it, strafing round it (player.lockOn: src/player.js LOCK_MOVE)
  player.lockOn = foes.lock && !busy() ? Object.assign(player._lockOn ??= { dir: new THREE.Vector3() }, {}) : null;
  if (player.lockOn) player.lockOn.dir.set(foes.lock.pos.x - player.pos.x, 0, foes.lock.pos.z - player.pos.z).normalize();
  if (foes.lock && !busy() && !photo.on) {
    const f = foes.lock, F = player.frame, dx = f.pos.x - player.pos.x, dz = f.pos.z - player.pos.z;
    const r = dx * F.right.x + dz * F.right.z, a = dx * F.fwd.x + dz * F.fwd.z;
    const want = Math.atan2(-r, -a), da = Math.atan2(Math.sin(want - rig.yaw), Math.cos(want - rig.yaw));
    rig.yaw += da * (1 - Math.exp(-6 * realDt));
  }
  // levels with zones (the Hangar) switch ink style as you cross between them
  if (level.zoneAt) {
    const zone = level.zoneAt(player.pos);
    if (zone.preset !== params.preset) { params.preset = zone.preset; applyPreset(zone.preset); }
    // a zone may also carry its world's own look, planets and hour (the Lab's biome rooms)
    if (zone !== lastZone) {
      // (from the preset afresh: a zone's touches never carry over into the next zone's)
      if (zone.look) { if (lastZone?.look) applyPreset(params.preset); for (const [k, v] of Object.entries(zone.look)) if (U[k]) U[k].value = v; gui.controllersRecursive().forEach((c) => c.updateDisplay()); }
      else if (lastZone?.look) applyPreset(params.preset);
      if (zone.planets || lastZone?.planets) setPlanets(zone.planets ?? level.sky?.planets ?? []);
      if (zone.hour !== undefined && lastZone) sky.hour = zone.hour;
      lastZone = zone;
    }
  }

  sharedUniforms.uTime.value = t;
  U.uTime.value = t;
  U.uDebug.value = params.debug;
  // the water: its rings and splashes, its bed maps; the camera kept off its surface
  waters.update(dt, t, { player, vehicles: player.vehicles, things: wildlife.creatures, globs: tool.globs, sky: U });
  waters.keepCamera(camera, player.swim?.under ? 'under' : 'over');
  breathMeter.update(player.breath, !!player.swim && ((player.swim.under && !player.swim.sea) || player.breath < 0.999) && !busy());   // (deep in a sea the pack gives air: swim.js SEA)

  gpuTimer.begin();
  renderFrame();
  gpuTimer.end();
  setView(camera);   // (what the camera saw: the locomotion kit's detail tiers next frame, src/motion-kit/view.js)
  if (photo.capture) savePhoto();
  cpuMs += performance.now() - tFrame;

  requestAnimationFrame(frame);
}
/**
 * A frame under a full-screen menu: nothing in the world moves (the player, people, wildlife,
 * vehicles, the ship's scenes, the clock), nothing is drawn (the menu covers the screen), and
 * presses made in the menu don't reach the game when it resumes.
 */
function pausedFrame() {
  tapped.clear();
  if (journal.open) itemIcons.pump();
  if (journal.open) pumpPortraits();
  wasBusy = true;
  sound.update(CALM);
}
const CALM = { speed: 0, gust: 0, storm: 0, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0 };
let simT = 0;
let flapT = 0;
let portalCool = 0;
let lastZone = null;
let eWasDown = false;

// ------------------------------------------------------------------ the ending
// Every world's story page and every relic found: a closing page. (It used to point at the Atelier, a last page
// opened in the picker: the Atelier was dismissed in October 2026, src/levels/names.js DISMISSED.)
let endingOpen = false;
const allDone = () => ORDER.every((id) => journal.storyDone(id) && journal.relicCount(id) >= CONTENT[id].relics.names.length);
setInterval(() => {
  if (journal.data.completed || story.pageOpen || story.pending || storyRt.busy() || journal.open || !allDone()) return;
  journal.data.completed = Date.now();
  journal.save();
  const up = player.frame.up, p = player.pos;
  const shots = [
    [p.clone().addScaledVector(up, 60).add(new THREE.Vector3(40, 0, 40)), p],
    [p.clone().add(new THREE.Vector3(2.4, 1.9, 2.4)), p.clone().addScaledVector(up, 1.7)],
    [p.clone().addScaledVector(up, 2), p.clone().addScaledVector(up, 200).add(new THREE.Vector3(0, 0, -150))],
  ];
  const imgs = shots.map(([e, l], i) => captureView(e, l, i === 0 ? 900 : 440, i === 0 ? 380 : 300));
  const page = document.getElementById('page');
  page.innerHTML = `<div class="sheet">
    <div class="p p1"><img src="${imgs[0]}" alt=""><div class="cap"><b>THE END OF THE ROAD</b><br>Every world, ${ORDER.reduce((n, id) => n + CONTENT[id].relics.names.length, 0)} small things kept.</div></div>
    <div class="p p2"><img src="${imgs[1]}" alt=""></div>
    <div class="p p3"><img src="${imgs[2]}" alt=""><div class="cap">The sketchbook is full.<br>Home is on the ship’s map, whenever you are ready.</div></div>
    <div class="hint" aria-label="continue">▸</div></div>`;
  page.classList.add('open');
  endingOpen = true;
  sound.chime();
  const close = () => { page.classList.remove('open'); endingOpen = false; window.removeEventListener('keydown', key); };
  const key = (e) => { if (e.code === 'Enter' || e.code === 'KeyE' || e.code === 'Escape') close(); };
  page.addEventListener('click', close, { once: true });
  window.addEventListener('keydown', key);
}, 1000);

// compile every shader before the first frame, so it doesn't hitch
await stage('mixing the inks…');
// Some WebGL drivers never signal completion of parallel shader warmup.
// The first render can finish compilation normally, so don't strand the loading screen.
// Compiled with the render target each pass really draws into bound: a program's key includes the
// output colour space, which is linear in a render target and sRGB on the canvas, so a warm-up
// with no target compiled programs nothing used and every surface compiled again on first sight
// (a hitch of 20-200 ms walking into a room or turning towards something new). compile() visits
// hidden objects too (the Lab's rooms, rooms off the map).
async function warmShaders(targetScene, targetCamera, target = null) {
  let timer;
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  await Promise.race([
    renderer.compileAsync(targetScene, targetCamera).catch(() => {}),
    new Promise((resolve) => { timer = setTimeout(resolve, 2000); }),
  ]);
  renderer.setRenderTarget(prev);
  clearTimeout(timer);
}
// The world's own surfaces, a slice at a time (src/warm-shaders.js: one object for each kind of program,
// compiled between yields, then the wait for the driver, polled; a combination missed compiles at first sight)
// (a GPU whose fences never signal, the Steam Deck's ANGLE on GL: remembered, so its next loads don't wait to find out)
const pacerKey = `moebius.pacerOff.${gpuName}`;
const gpuPace = gpuPacer(renderer.getContext(), { memory: { get: () => { try { return localStorage.getItem(pacerKey) === '1'; } catch { return false; } }, set: () => { try { localStorage.setItem(pacerKey, '1'); } catch { /* private mode */ } } } });
const warmShadersSliced = (targetScene, targetCamera, target = null, { wear = null } = {}) =>
  warmSliced(renderer, targetScene, targetCamera, { target, wear, slice, pace: gpuPace });
// instanced props left unculled (rocks, flowers, story props) get real bounds, so every pass can cull them
console.info(`bounds: ${fitBounds(scene)} instanced meshes made cullable`);
await slice();
{
  const t0 = performance.now();
  setStep('surfaces');
  const n = await warmShadersSliced(scene, camera, gbuffer);
  console.info(`shaders: ${n} kinds of surface, ${renderer.info.programs.length} programs, ${(performance.now() - t0).toFixed(0)} ms`);
}
setStep('post');
post.sync();   // (the ink pass's parts by the world's look, planets set in place included: post.js inkFeatures)
await warmShaders(post.scene, post.camera, composeRT);
await slice();
setStep('water');
{ const wp = waters.warmPass?.(); if (wp) await warmShaders(wp.scene, wp.camera, composeRT); }   // the water's sparkle pass
if (level.veils) await warmShaders(level.veils.scene, camera, composeRT);   // the see-through surfaces' wash (src/veil.js)
await slice();
// the shadow passes draw everything with one depth-only material, a program per kind of mesh
// (instanced, skinned, which attributes): compiled now too, each kind wearing it for the moment
// (a person or a plant first seen in a shadow had stalled a frame on its compile)
setStep('shadows');
await warmShadersSliced(scene, camera, Object.values(cascades).find((c) => c.enabled && c.rt)?.rt ?? null, { wear: shadowOverride });
// each program's first use, once the driver says it is linked (src/warm-shaders.js firstUse): the warm draws below
// asked for each one's uniforms at once, and the page froze till it was (the Xbox: 1-4 s a program)
setStep('first use');
await firstUse(renderer, slice);
// The ways through, drawn once ahead (src/passage.js): every room, cave and hall a door or a portal
// leads to, and the ship's rooms, with their geometry and textures on the GPU and the driver's
// pipelines built before the first frame (they used to arrive with the first sight of them); and
// what the first frame will see, so its uploads are spread over the load, a slice at a time,
// instead of all landing in the first frame.
const warmDraw = new WarmDraw(renderer, scene, { passes: warmPasses({ makeGBuffer: createGBuffer, shadowOverride }), lodFull: (o) => lod?.fullOf?.(o) });
{
  const t0 = performance.now();
  setStep('passage');
  scene.updateMatrixWorld();
  rig.update(player.pos, 0, player.frame);   // (the first frame's camera)
  camera.updateMatrixWorld();
  const dests = [...(level.portals ?? []), ...(level.navigationPortals ?? [])].map((p) => p.to).filter(Boolean);
  const view = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const inView = (o) => { try { return !o.frustumCulled || view.intersectsObject(o); } catch { return false; } };
  const seen = warmDraw.meshes().filter((o) => o.visible !== false && (!o.isInstancedMesh || o.count > 0) && inView(o));
  // (what the first frame sees first, then round the traveller, the ship, the ways through: a GPU that can't keep up
  // (the Xbox as an App, its graphics memory full: 159 s) stops at PASSAGE.loadBudget, and the rest is drawn ahead
  // as you come near a door, as it is for anything new)
  const todo = [...seen, ...warmDraw.near([player.pos], 120), ...warmDraw.of(...(ship.parked?.indoor ?? [])), ...warmDraw.near(dests)];
  let n = 0, i = 0;
  for (; i < todo.length; i += 8) {   // (8 at a time: a batch's uploads are one piece of the GPU's work)
    if (performance.now() - t0 > PASSAGE.loadBudget) break;
    const batch = todo.slice(i, i + 8);
    await settle(renderer, warmDraw.compile(batch), PASSAGE.loadBudget);   // (its programs linked before the draw asks: no blocking)
    n += warmDraw.draw(batch); await slice(); await gpuPace();
  }
  if (i < todo.length) console.warn(`passage warm-up: stopped after ${PASSAGE.loadBudget} ms, ${todo.length - i} meshes left to draw as you come near them`);
  // what the first frame would set up for itself: the rooms off the map, the levels of detail
  roomCull ??= makeRoomCull();
  await slice();
  (lod ??= makeLod()).collect();
  await slice();
  // the grass round the first view, placed a few milliseconds at a time (at once, it was a 60-80 ms first frame)
  if (blades.grass) { blades.grass.placedOnce = true; if (blades.grass.far) blades.grass.far.placedOnce = true; for (let i = 0; i < 400; i++) { blades.grass.update(camera); await slice(); if (!blades.grass.placing) break; } }
  // (a program's first use asks the GPU process for its uniforms and log, a wait on everything queued: done now)
  for (const p of renderer.info.programs) { p.getUniforms?.(); await slice(); }
  console.info(`passage warm-up: ${n} meshes in ${(performance.now() - t0).toFixed(0)} ms`);
}
// the games' arcade signs in this world (a game's `markers`: [{ level, at: [x, y|null, z], heading }]; y null: on the ground)
if (!minigameDef) for (const g of GAMES) for (const m of g.markers ?? []) {
  if (m.level !== levelId) continue;
  const [x, y, z] = m.at, gy = y ?? physics.groundAt(x, 1e4, z);
  try { placeGameMarker({ scene, levelId, lights: levelLights }, g.id, new THREE.Vector3(x, Number.isFinite(gy) ? gy : 0, z), { heading: m.heading ?? 0 }); } catch (e) { console.warn(e); }
}
// a minigame's page: the runner takes over, the start card up (src/minigames/kit/runner.js)
if (minigameDef) {
  minigame = new MinigameRunner(minigameDef, { scene, camera, player, physics, level, sound, wind, ship, state: game, kick, from: query.get('from'), tool, foes, rig, settings,
    capture: captureView, npcs, crowd, wildlife, flora, people: { lib, humans: peopleT },   // (what a game played in a world, or with people of its own, may use)
    othersOpen: () => menu.open || journal.open || changelog.open || picker.classList.contains('open') || worldDebug.open,
    navigate: (href) => { flushPlay(); location.href = href; },
    links: arcadeLinks(query.get('from'), minigameDef.id) });   // (started from the Arcade: the game before / after, back to its sign)
  window.minigame = minigame;
  story.beacon?.removeFromParent();   // (the host world's story beacon: not in a game)
  if (story) story.done = true;   // (nor its goal: the Arena's ring would end its story under a game played by it)
}
// this world's mastery trial (src/trials/): a sign in the world opens its start card, played here on foot
// (the runner as a game page's, but Quit leaves you where the run did: nothing reloads)
trialsRt = minigameDef ? null : createChallenges({ levelId, scene, physics, level, player, items, game, foes, npcs, sound, notice: (t) => showToast(t),
  surfaceAt: (x, z, y, below) => waters.surfaceAt(x, z, y, below),
  open: (def) => {
    if (minigame) return false;
    minigame = new MinigameRunner(def, { scene, camera, player, physics, level, sound, wind, ship: null, state: game, kick, from: null, tool, foes, rig, settings,
      capture: captureView, npcs, crowd, wildlife, flora, people: { lib, humans: peopleT },
      othersOpen: () => menu.open || journal.open || changelog.open || picker.classList.contains('open') || worldDebug.open,
      navigate: () => { minigame = null; window.minigame = null; } });
    window.minigame = minigame;
    return true;
  } });
window.trials = trialsRt;
const passage = new Passage({ cover: new PassageCover(), warm: warmDraw, carry: (c) => carryAcross(player, rig, camera, c), busy: () => !!blades.grass?.placing });
loadWatch.stop();
stage('ready'); console.info(`load: total ${(performance.now() - tLoad).toFixed(0)} ms (after module load)`);
requestAnimationFrame((t) => {
  renderer.domElement.style.visibility = '';
  frame(t);
  markBooted();   // the heartbeat: the Android app keeps a downloaded web build only once it gets here (native-app.js)
  startThemeDownload(THEME_FILES, { first: SOUNDTRACKS[levelId] });   // on a device: the themes it hasn't got, in the background once settled (src/music-store.js)
  const ld = document.getElementById('loading');
  ld?.classList.add('done');
  setTimeout(() => ld?.remove(), 900);
  ship.start({ via: viaShip ? 'ship' : null, prologue: playPrologue, homecoming: playHomecoming, onReady: () => { if (minigame) return; if (playHomecoming) journal.markSeen(levelId); else story.start(); } });   // the homecoming is its own page
  if (changelog.fresh && !minigameDef) { changelog.markSeen(); setTimeout(() => showToast(`Updated to v${VERSION} · what's new is in the settings`), 4000); }   // after an update: point at what changed, once (not again on the next world; no key: a handheld has none)
});

// handy for debugging from the console
/** Dev: what sinks, floats or stands in a wall in this world (src/clip-audit.js); prints a report. */
window.clipAudit = async (o = {}) => {
  const { auditClipping, formatAudit } = await import('./clip-audit.js');
  const { allInteractables } = await import('./interact.js');
  const things = allInteractables().filter((e) => !/^(talk\.|box\.)/.test(e.id) && !['vehicle', 'lens'].includes(e.id));
  const exclude = [player.object, ...npcs.flatMap((n) => [n.object, n.cape?.mesh]), ...player.vehicles.map((v) => v.object), ...relics.items.map((r) => r.grp), ...boxes.list.map((b) => b.parts?.root), ship.parked?.group];
  const r = auditClipping({ physics, scene, roots: auditRoots, npcs, crowd, relics, boxes, things, exclude, ...o });
  if (o.print !== false) console.log(formatAudit(r));
  return r;
};
/** Dev: where the drawn surfaces you stand on and climb part from the collision (src/contact-audit.js); prints a report. */
window.contactAudit = async (o = {}) => {
  const { auditContact, formatContact } = await import('./contact-audit.js');
  const exclude = [player.object, ...npcs.flatMap((n) => [n.object, n.cape?.mesh]), ...player.vehicles.map((v) => v.object), ...relics.items.map((r) => r.grp), ...boxes.list.map((b) => b.parts?.root), ship.parked?.group];
  const region = level.unsafe ? (p) => !level.unsafe(p) : null;
  const r = auditContact({ physics, scene, solids: level.dynamic?.() ?? [], exclude, region, ...o });
  if (o.print !== false) console.log(formatContact(r));
  return r;
};
Object.assign(window, { waters, flora, blades, bloom, shelter, items, flammables, THREE, renderer, scene, camera, player, rig, post, sky, updateSky, terrain, params, wind, input, level, physics, photo, setPhoto, quality, resize, flocks, npcs, relics, story, journal, errands, expedition, scout, weather, sound, captureView, settings, menu, trails, reactiveWorld, tool, crowd, wildlife, foes, chimes, resources, itemIcons, gadgets,
  storyRt, quests: storyRt.quests, dialogue: storyRt.dialogue, ship, game, passage, warmDraw, boxes, devMenu, slots, paused, quitToTitle, clock: () => simT, sharedUniforms, cascades, shadowCull, applyQuality, preset: () => preset, frameStats, renderFrame, lod: () => lod, skinnedLods, interiorCull });
