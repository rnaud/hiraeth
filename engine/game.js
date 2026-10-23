// The game for an engine (docs/systems/engine-bridge.md): a world built and played by the game's
// own modules, as src/main.js builds and plays it, without the page or the WebGL renderer. What it
// runs today: the level, its physics and water, the ship at its site, the flora, the people near
// the start, the traveller (his body, clips and cape) on the keyboard and pads, the camera rig,
// the time of day and the look's preset. Each frame the mirror (engine/mirror.js) tells the
// engine what changed, and the look (`look()`) the frame's sun, sky and ink.
//
//   const game = await createGame({ levelId: 'desert', backend });
//   game.key('KeyW', true); game.look(dx, dy);
//   game.frame(dt);            // → { ms: { update, mirror }, stats }
//
// Sound (createGame({ audio: { sampleRate } })): the game's own Sound (src/audio.js) on the Web Audio
// shim (engine/webaudio.js); `game.audio` is its context, which the engine renders PCM from.
// The menus (the title, the Start menu, the game menu): engine/menus.js, as plain state the engine draws; createGame({ menus })
// pauses the world while one is open and hands it the pad.
// The gadgets (src/gadgets/, issue #344): every one registered as an item first, as main.js does, then made per world.
// The trials and the games (engine/trials.js): a world's challenges, its games' signs and their hosts, and a run's
// runner; createGame({ game }) plays a game's own page (its arena, or the world it is played in), as ?game=<id>.
import { page, encodedPicture } from './boot.js';
import { ENCODED_TEXTURES } from './encoded-textures.js';
import '../src/gadgets/all.js';   // (first after the page's stand-ins: the gadgets become items before anything reads ITEMS)
import * as THREE from 'three';
import { levelById, LEVELS } from '../src/levels/index.js';
import { CONTENT, ERRANDS } from '../src/levels/content.js';
import { Physics, dropBuriedFloraSteps } from '../src/physics.js';
import { Waters, BreathMeter, breathShown, BED } from '../src/water.js';
import { waterShared } from '../src/water-shader.js';
import { Ship } from '../src/ship/ship.js';
import { CallScreen } from '../src/ship/portrait.js';
// (the console's round screen is drawn in the VM, engine/raster.js, and sent to the GPU each time: smaller and 10 times a second)
CallScreen.size = 256; CallScreen.fps = 10;
import { buildFlora, floraKeep, FLORA_WORLDS } from '../src/flora.js';
import { buildGrass } from '../src/flora-grass.js';
import { Player, CameraRig } from '../src/player.js';
import { Controller, mergeControls } from '../src/controller.js';
import { loadAnimationLibrary, Animator } from '../src/animator.js';
import { loadHuman, Humanoid } from '../src/humanoid.js';
import { loadPeople, usesMakeHuman } from '../src/makehuman/people.js';
import { loadTraveller, createTraveller } from '../src/characters/traveller.js';
import { CLOTH_HOST } from '../src/characters/tripo-cloth.js';
import { travellerSetting } from '../src/characters/traveller-v2.js';
import { holdGait, releaseGait } from './gait-hold.js';
import { CAPE_HOST } from '../src/cape.js';
import { updateHands } from '../src/hands.js';
import { spawnNPCs, pooledNPC, setCalmZones, shipCalmZones } from '../src/npc.js';
import { Crowd, CROWD_BUDGET, CROWD_DIST_CELL, buildPeople } from '../src/crowd.js';
import { pickBalloon, publishBalloons } from '../src/balloon-part.js';
import { talkAllowed } from '../src/ship/landing.js';
import { QUALITY_PRESETS, SmallCuller, tilesInstances, cullFar } from '../src/perf.js';
import { LodManager } from '../src/lod.js';
import { spawnAliens, alienSpots } from '../src/aliens/index.js';
import { createStory } from '../src/story/index.js';
import { game as gameState } from '../src/game-state.js';
import { helperRun } from '../src/temples/helper-encounter.js';
import { bootFlags } from '../src/save-migrate.js';
import { sharedUniforms } from '../src/materials.js';
import { createPost } from '../src/post.js';
import { applyTimeOfDay, colourScript } from '../src/timeofday.js';
import { EDGE_HINTS } from '../src/edge.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadPlayableCaravan } from '../src/ship/caravan-asset.js';
import { shipSetting, shipResume } from '../src/ship/selection.js';
import { SceneMirror } from './mirror.js';
import { Wildlife } from '../src/wildlife.js';
import { ReactiveWorld } from '../src/reactive-world.js';
import { plantClear, peopleStarts } from '../src/plant-ground.js';
import { Flammables, flammableSpots } from '../src/flammable.js';
import { runSteps } from '../src/load-steps.js';
import { DeferredWork, DEFER } from '../src/deferred.js';
import { queueLateCollision, WORKER_TRIS } from '../src/late-collision.js';
import { DRIFT_FITS } from '../src/sand-drifts.js';
import { Weather } from '../src/weather.js';
import { WindStreaks } from '../src/wind.js';
import { BrushTrail } from '../src/brush.js';
import { Shelter, addIndoors } from '../src/shelter.js';

// The traveller's ship is indoors for the weather, as main.js registers it (src/shelter.js): no rain, sand or wisps in
// its rooms (issue #348: the rain fell in the ship in Lorn in the Unity preview). One registration for the module,
// asking the game that runs now (a test may make several games one after another).
let brushTrail = null;   // (the traveller's last second of steps for the grass: src/brush.js, made at the first frame)
let shipIndoors = null;
addIndoors((p) => !!shipIndoors?.(p));
// A place reached by a page load on the web (src/story/night-train.js travel: the Signal Market's halt and the Overnight
// Train, `?level=<id>&from=<id>`, said first as 'travel:page'): the engine's `onPage({ level, from })` starts it again
// there, at that level's arrival from where you were (level.arrivals). The page's location is a stand-in in the engines,
// so the screen stayed black under the fade (issue #264). One listener for the module, asking the game that runs now.
let pageGo = null;
// (a flight refused for a gadget not yet had, the holo table's or the Worlds page's: the quest that leads to it started,
// as main.js does; the game that runs now's story)
let refusedGo = null;
gameState.on('travel:refused', (e = {}) => refusedGo?.(e));
gameState.on('travel:page', ({ href } = {}) => {
  const q = String(href ?? ''), to = /[?&]level=([\w-]+)/.exec(q)?.[1], from = /[?&]from=([\w-]+)/.exec(q)?.[1] ?? null;
  if (to && pageGo) setTimeout(() => pageGo?.({ level: to, from }), 900);
});
import { Flock, Motes, Footprints } from '../src/life.js';
import { HouseAir } from '../src/temples/air.js';
import { Scout, nextObjective, findText, HINT, FIND } from '../src/scout.js';
import { ObservatoryQuest } from '../src/observatory.js';
import { FirstSteps } from '../src/first-steps.js';
import { installScoutHint, scoutHintLine, SCOUT_HINT_SHOW, plumbHintDue, plumbHintLine } from '../src/scout-hint.js';
import { Companion, shown as droneShown } from '../src/companion.js';
import { registerInteractable, PRIORITY } from '../src/interact.js';
import { applyEclipse } from '../src/eclipse.js';
import { lanternSky, applyLanternSky } from '../src/story/lantern-sky.js';
import { completedWorlds } from '../src/story/calls.js';
import { FluidTool } from '../src/fluid-tool.js';
import { makeCombat } from './combat.js';
import { guardianHint, openHint, Struggle } from '../src/temples/hints.js';
import { guardianBar } from '../src/temples/boss.js';
import { setSkinColours } from '../src/characters/skin-colours.js';
import { HOLO } from '../src/ship/hologram.js';
import { feelDt, selfDt, shakeCamera, kick } from '../src/feel.js';
import { ToolHud, SaveGame, TEXT_SIZES } from '../src/ui.js';
import { screen } from '../src/platform.js';
import { quietKeys } from '../src/hint-level.js';
import { sceneHolds } from '../src/hud-shows.js';
import { hudButtons, hitHudButton, pressHudButton } from '../src/hud-buttons.js';
import { slots, slotStorage } from '../src/save-slots.js';
import { menuSources } from '../src/game-menu-data.js';
import { WorldMap, MAP, mapBounds, zoomBounds, mapMarks, scaleBar } from '../src/world-map.js';
import { houseHere, houseView } from '../src/house-map.js';
import { wireWardrobe, wardrobeShot, BACKDROP as WARDROBE_BACKDROP, chosenOutfit, OUTFIT_KEY } from '../src/wardrobe.js';
import { interiorAt } from '../src/interior-kit.js';
import { fillUnfound, portraitPaint } from './traveller-paint.js';
import { PORTRAIT_EYE_PAINT } from '../src/characters/portrait-head.js';
import { PixelCanvas } from './raster.js';
import { GIVERS_NOTE } from '../src/story/signature.js';
import { items as gear, ITEMS } from '../src/items.js';
import { callKind } from '../src/bike-worlds.js';
import { RIDER_CALL, RIDER_CALL_BEAT } from '../src/story/arzach-data.js';
import { chargeState } from '../src/story/charge.js';
import { ORDER, TITLES, partsOf } from '../src/levels/names.js';
import { fastTravel } from '../src/fast-travel.js';
import { cueText, Cue, PlaceName, staminaHud, keysHud, findSummary } from '../src/hud.js';
import { toastSeconds, Story, Relics } from '../src/quest.js';
import { EngineStarMap } from './starmap.js';
import { homecomingKind, HOME_ID, roadDone, ROAD } from '../src/story/ending.js';
import { routeChart, findableNote, SEARCH_LINE } from '../src/story/signature-search.js';
import { knownWorlds, newlyKnown } from '../src/story/route.js';
import { selfLitSkips } from '../src/shadows.js';
import { plainValue } from './ink-spec.js';
import { Sound } from '../src/audio.js';
import { createBoxes, migrateSave } from '../src/boxes/index.js';
import { installAudio } from './webaudio.js';
import { setView, inView } from '../src/motion-kit/view.js';
import { padFaces, setFaces, confirmKey, backKey, padLayout } from '../src/native-pad.js';
import { attachMotion, matchingSetting } from '../src/motion-match.js';
import { movesSetting } from '../src/loco-moves.js';
import { ShopPanel } from '../src/shop-panel.js';
import { resources } from '../src/resources.js';
import { Gadgets } from '../src/gadgets/index.js';
import { createItemEffects } from '../src/boxes/effects.js';
import { createFragments, chartMarks } from '../src/fragments.js';
import { t as tr } from '../src/i18n.js';
import { keyText } from '../src/prompt-keys.js';
import { carryHooks } from '../src/carry.js';
import { BodyFoley } from '../src/foley.js';
import { interactHooks } from '../src/interact.js';
import { wrapMenus, menusHeard } from '../src/ui-sound.js';
import { InputMode } from '../src/input-mode.js';
import { Passage, carryAcross, PASSAGE } from '../src/passage.js';
import { Thresholds, THRESHOLD } from '../src/thresholds.js';
import { DoorWalk } from '../src/door-walk.js';
import { Veils } from '../src/veil.js';
import { makeTrials, gameById } from './trials.js';
import { levelMetaFor } from '../src/minigames/kit/world.js';
import { lendTool } from '../src/minigames/kit/onfoot.js';
import { DevMenu } from '../src/dev-menu.js';
import { gatherPoints, questList, applyQuestJump, landingSpot, godLanding } from '../src/world-debug.js';
import { GAMES } from '../src/minigames/index.js';
import { DEBUG_SLOT } from '../src/save-slots.js';
import { wallOpenings } from '../src/wall-openings.js';
import { loadProgress } from '../src/load-page.js';
import { wireKit, wireDangers, wirePeople, wireChemistry, wireMount, wireVehicles, wireLessons, wireShip, wireCompanion, wireCamera, wireHero, heroCutFrame, cameraFollow, wireBenches, wireTrails, wireOpenings, wireEdge, wireSky, wirePotion, wireNudges, fragmentsLine, wireHealth, hurtReactions, wireAmbush, toolGauge, wireJumpShade } from '../src/host/game-host.js';

export { page };
export { readHref } from './trials.js';   // (the tests: a game page's address)
export { ITEMS, items } from '../src/items.js';   // (the tests: the bundle's items, the gadgets among them, against the web's)
export { GAMES };   // (the tests: every minigame, played on its own page: tests/bridge-gaps.test.js)
export { Raycaster } from 'three';   // (for the tests and the tools that probe the world in the VM)
export { GLTFLoader };   // (the tests: every model loaded as the engines load it, its pictures with them: tests/engine-gltf-pictures.test.js)
export { ENCODED_PICTURES, COLOURED_PICTURES } from './boot.js';
// (the sequences, the web against the engines beat by beat: engine/sequences.js, run by engine/sequence-run.mjs and -sequence)
export { SEQUENCES, sequenceById, SequenceRun, mapAtOnce, engineSetup, engineReady, engineGame, engineKey, probe } from './sequences.js';
export { ROUTES, routeById, STUTTER_RUNS } from './stutter-routes.js';   // (the stutter harness's play routes, issue #468)
export { EngineMenus } from './menus.js';
export { Settings } from '../src/ui.js';

/** The shop panel's element where there is no page: every call taken (its sheet is the menus', engine/menus.js). */
const SHOP_EL = { classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, setAttribute() {}, addEventListener() {}, querySelector: () => null, innerHTML: '' };
/** Sound where the engine has none: every call taken, nothing played. */
const SILENT = new Proxy({}, { get: (t, k) => (k === 'ctx' ? null : k === 'band' ? () => null : () => {}) });
/** The drifts' pieces at most this many triangles to test (src/sand-drifts.js DRIFT_FITS.most): the Buried Machine's
 * densest 8 m squares were 50 ms each to make in node, whole (issue #385). */
const DRIFT_PIECE = 100;
const CALM = { speed: 0, gust: 0, storm: 0, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0 };
// how far a tile of main.js's instanced sets reaches round its centre (perf.js tileScene's 110 m cells: half their diagonal)
const PROP_TILE_REACH = 110 * Math.SQRT1_2;

/**
 * The game's Sound on the shim (engine/webaudio.js), started: the engine has no autoplay rule to wait for. `title`: the
 * title screen's (src/title.js: no world's score, its own recording over the menu music; engine/unity/game.js).
 */
export function makeSound(levelId, { sampleRate = 48000, volume = 1, record = false, title = false, prepareOnly = false } = {}) {
  // (record: the graph rendered elsewhere, from what is done to it here: engine/webaudio.js, the Unity bridge's audio thread)
  installAudio(globalThis, { sampleRate, record });
  const s = quiet(() => (title ? new Sound('title', { score: false, titleTheme: true, autoStart: false, listen: false }) : new Sound(levelId, { autoStart: false, listen: false })));
  if (!prepareOnly) s.start();
  if (volume !== 1 && s.master) s.master.gain.value = 0.9 * volume;
  return s;
}

/**
 * The coral-shirt traveller's colours for an engine: his skin's texture is a JPEG no engine VM decodes, so its sampled
 * colours (colors.json, sRGB, in the mesh's vertex order) go on as vertex colours, linear as the cloth's are; and every
 * part is marked as carrying linear colour (tripo-material.js turns it to the game's display values in its shader:
 * the engines' ink surfaces do the same by userData.albedoLinear).
 */
function engineColours(ch, { gltf, colors, headColors }) {
  const parts = [ch.mesh, ch.head, ch.cloth?.garment, ch.cloth?.underlayer, ch.cloth?.innerShirt].filter(Boolean);
  let src = null;
  gltf?.scene?.traverse((o) => { if (o.isSkinnedMesh && !src) src = o.geometry.attributes.position; });
  if (!src || colors?.length !== src.count) return;
  // (the cloth rebuilt the skin's geometry and cut the overshirt from it, at rest still, its seams split: each vertex
  // finds its colour by its place)
  const key = (a, i) => `${Math.round(a.getX(i) * 1e4)},${Math.round(a.getY(i) * 1e4)},${Math.round(a.getZ(i) * 1e4)}`;
  const at = new Map();
  for (let i = 0; i < src.count; i++) at.set(key(src, i), i);
  const col = new THREE.Color();
  for (const part of [ch.mesh, ch.cloth?.garment]) {
    const P = part?.geometry?.attributes?.position;
    if (!P || part.geometry.attributes.color || part.material.uniforms?.uMap?.value?.image) continue;
    const c = new Float32Array(P.count * 3);
    let found = 0;
    for (let i = 0; i < P.count; i++) {
      const j = at.get(key(P, i));
      if (j === undefined) continue;
      found++;
      col.setRGB(colors[j][0] / 255, colors[j][1] / 255, colors[j][2] / 255).convertSRGBToLinear();
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    if (found < P.count * 0.8) continue;   // (not the same places: left as it is)
    // (the vertices the cloth made where it cut and hemmed the overshirt have no place in the skin: they were left black,
    // a dark band round his waist in Unity's close-ups, issue #264; each takes its found neighbours' colour instead)
    if (found < P.count) fillUnfound(part.geometry, c, (i) => at.has(key(P, i)));
    part.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
    part.material.vertexColors = true;
  }
  // The separate head preserves source vertex order, including through its fit.
  // Engine VMs cannot decode its JPEG either; keep its face/hair colours visible.
  const head = ch.head;
  if (head && !head.material.uniforms?.uMap?.value?.image && headColors?.length === head.geometry.attributes.position.count) {
    const c = new Float32Array(headColors.length * 3);
    headColors.forEach((rgb, i) => { col.setRGB(...rgb.map(v => v / 255)).convertSRGBToLinear(); col.toArray(c, i * 3); });
    head.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
    head.material.vertexColors = true;
    portraitPaint(head);
    // (and the fit its drawn blink and open mouth are measured in: port-format.js portraitFace, Unity's PortraitFace.hlsl)
    const F = head.userData.portraitHeadFit;
    if (F) head.material.userData.portraitFace = [...F.offset, F.scale, F.mouthY];
    // (and his painted eyes and brows at the texture's own detail, issue #473: a few vertices across an iris drew them
    // blurred; scripts/tripo/bake-eye-paint.mjs, Unity's PortraitFace.hlsl reads it by the head's fit as the page reads uMap)
    const EYES = 'characters/traveller-v1/head-v3/eye-paint.png';
    if (F && !ENCODED_TEXTURES.has(EYES)) { const t = encodedPicture(EYES); if (t) ENCODED_TEXTURES.set(EYES, t); }
    if (F && ENCODED_TEXTURES.has(EYES)) { head.material.userData.portraitEyePaint = EYES; head.material.userData.portraitEyeBox = PORTRAIT_EYE_PAINT.box.slice(); }
  }
  // the old collar lining tucked under the portrait's neck, in its skin (traveller-b3.js fitB3NeckMaterial: a display
  // colour over the paint by b3NeckSkin; without it a black patch at the foot of his neck in Unity's close-ups)
  const neck = ch.mesh?.geometry?.attributes?.b3NeckSkin, body = ch.mesh?.geometry?.attributes?.color;
  if (neck && body?.itemSize === 3) {
    const sk = new THREE.Color().setRGB(0.79, 0.525, 0.37, THREE.SRGBColorSpace);
    for (let i = 0; i < neck.count; i++) { const t = neck.getX(i); if (t > 0) body.setXYZ(i, body.getX(i) + (sk.r - body.getX(i)) * t, body.getY(i) + (sk.g - body.getY(i)) * t, body.getZ(i) + (sk.b - body.getZ(i)) * t); }
  }
  // the overshirt's lining on its back faces, the trousers' repaired band in their fabric (tripo-material.js, linear)
  const lin = (hex) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace).convertSRGBToLinear().toArray();
  if (ch.cloth?.garment?.material) ch.cloth.garment.material.userData.lining = lin(0xb46249);
  const fabric = lin(0xcbb897);
  for (const p of parts) {
    const R = p.geometry?.attributes?.trouserRepair, C = p.geometry?.attributes?.color;
    if (!R || !C || C.itemSize !== 3) continue;
    for (let i = 0; i < R.count; i++) { const t = R.getX(i); if (t > 0) for (let k = 0; k < 3; k++) C.array[i * 3 + k] += (fabric[k] - C.array[i * 3 + k]) * t; }
  }
  for (const p of parts) for (const m of Array.isArray(p.material) ? p.material : [p.material]) if (m) m.userData.albedoLinear = true;
}


/**
 * The v2 traveller's clothes and body in an engine (issue #493): their atlas goes to the engine encoded (engine/boot.js
 * ENCODED_PICTURES), which samples it decoded to linear; the ink material turns its albedo to display values
 * (tripo-material.js), as the engines' ink surfaces do by userData.albedoLinear. Every outfit's draws, as they are worn.
 */
function engineV2(ch) {
  const W = ch.v2?.wardrobe;
  if (!W || W.engineMarked) return;
  W.engineMarked = true;
  const mark = () => { for (const m of W.meshes ?? []) for (const x of Array.isArray(m.material) ? m.material : [m.material]) if (x) x.userData.albedoLinear = true; };
  mark();
  const wear = W.wear.bind(W);
  W.wear = (...a) => { const r = wear(...a); mark(); return r; };
}

/**
 * A guardian's generated skin (the Keeper's, the Elder's) in an engine: its texture is a JPEG no engine VM decodes, so
 * its colours sampled at each vertex (colors.json beside it, scripts/tripo/sample-colors.mjs) go on as vertex colours,
 * display values as the texture shows them (src/characters/skin-colours.js; it was white in the Unity build, issue #264).
 */
setSkinColours(async (gltf, folder) => {
  let mesh = null;
  gltf?.scene?.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  const P = mesh?.geometry?.attributes?.position;
  if (!P || mesh.geometry.attributes.color || mesh.material?.map?.image) return;
  const r = await fetch(`${folder}colors.json`);
  if (!r.ok) return;
  const colors = await r.json();
  if (colors?.length !== P.count) return;
  const c = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { const k = colors[i]; c[i * 3] = k[0] / 255; c[i * 3 + 1] = k[1] / 255; c[i * 3 + 2] = k[2] / 255; }
  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
  for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (m) m.vertexColors = true;
});

/**
 * The journal's record without its page (src/quest.js Journal: the same key in the save slot, the same fields): the worlds
 * seen, the stories told, the relics and the errands; the page's parts (its sections, its element) stand-ins. `write`
 * false keeps it from the save (a bench's fixed views).
 */
export function engineJournal({ storage = slotStorage, write = true } = {}) {
  const KEY = 'hiraeth.journal.v1';
  let data = {};
  try { data = JSON.parse(storage.getItem(KEY)) ?? {}; } catch { data = {}; }
  data.relics ??= {}; data.stories ??= {}; data.seen ??= {};
  const save = () => { if (write) try { storage.setItem(KEY, JSON.stringify(data)); } catch { /* full */ } };
  return {
    data, sections: [], el: { addEventListener() {} }, render() {}, toggle() {}, open: false, save,
    seen: (level) => !!data.seen[level], markSeen: (level) => { if (!data.seen[level]) { data.seen[level] = 1; save(); } },
    known: (level) => !!data.seen[level],
    storyDone: (level) => !!data.stories[level], addStory: (level, entry) => { data.stories[level] = entry; save(); },
    hasRelic: (level, i) => !!data.relics[level]?.[i], addRelic: (level, i, entry) => { (data.relics[level] ??= {})[i] = entry; save(); },
    relicCount: (level) => Object.keys(data.relics[level] ?? {}).length,
    errand: (id) => data.errands?.[id], setErrand: (id, v) => { (data.errands ??= {})[id] = v; save(); },
  };
}

/** A system the engine can do without: built if it can be, said once if not. */
function optional(name, make) { try { return quiet(make); } catch (e) { console.warn(`[game] ${name} left out: ${e?.message ?? e}`); return null; } }

const quiet = (fn) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; console.info = i; } };

/** The look the engines draw with, from post.js's uniforms and the shared ones: plain numbers. */
export const LOOK_KEYS = ['uSkyTop', 'uSkyHorizon', 'uInk', 'uShadowTint', 'uLightTint', 'uToon', 'uHatch', 'uHatchSpacing', 'uFogDensity', 'uFogStart', 'uFogMul',
  'uLineWidth', 'uLineVary', 'uDepthThresh', 'uNormalThresh', 'uAlbedoEdges', 'uShadowEdges', 'uWobble', 'uHaze', 'uAerial', 'uSkyFlat', 'uSkyBands', 'uHazeBands',
  'uHalftone', 'uBounce', 'uShadeKeep', 'uFlatten', 'uNight', 'uSunDisc', 'uPaper', 'uGrain', 'uSkyDots', 'uCrevice', 'uAO', 'uEnvGround',
  'uSunColor', 'uMoonDisc', 'uMoonVis'];
/** The look's vectors the engines take with the numbers (post.js: spot blacks, haze by depth and height, cast shadows). */
export const LOOK_VECTORS = new Set(['uWind', 'uHaze', 'uSpot', 'uSpotTone', 'uHazeLayers', 'uHazeTone', 'uHeightFog', 'uHeightFogTone', 'uCast', 'uInkShadow',
  // (the sky's own: the eclipse, src/eclipse.js; the Lantern's light, src/story/lantern-sky.js; space, src/levels/space-city-kit.js)
  'uEclipse', 'uCorona', 'uEclipseGlow', 'uEclipseDir', 'uLantern', 'uSpace', 'uSpaceTone', 'uSpaceSun', 'uSpaceNight']);

export async function createGame({ levelId = 'desert', backend, width = 1280, height = 720, people = true, view = null, audio = null, flags = null, grassPreset = 'high', quality = null, log = () => {}, menus = null, start = null, arrive = false, hullSpawn = false, settings = null, gestures = true, moves = true, matching = null, via = null, prologue = false, onTravel = null, aboard = null, scenes = false, fight = false, game: gameId = null, stage: gameStage = null, from = null, to: transitTo = null, encounter = null, onGame = null, onLeave = null, trials: withTrials = false, onPage = null, arrival = null, back = null, saves = true, defer = true, far: farOn = true, lod: lodOn = false, skies = true, waterBed = true, onStage = null, onLoad = null, traveller = null } = {}) {
  const T = {};
  // Prepare all assigned recordings before constructing a playable world. The native host keeps
  // polling decode completions while this promise is pending; explicit no-audio tools skip it.
  const sound = audio ? makeSound(levelId, { ...audio, prepareOnly: true }) : SILENT;
  if (audio) {
    try { await sound.prepareEffects({ retry: !!audio.retryEffects, onProgress: ({ completed, total }) => onStage?.(`Loading sound effects ${completed}/${total}`) }); }
    catch (error) { sound.dispose(); throw error; }
  }
  // (the fight, engine/combat.js, made once the traveller and his tool are)
  let combat = null;
  // the graphics preset's detail (src/perf.js QUALITY_PRESETS: the Unity bridge's -quality, the Deck's on its Linux player),
  // as main.js applies it: the plants' share and distance, the grass patch, the crowd's ranges, the props under a few
  // pixels hidden, the people's low detail; none (everything, as the bench's High) without one
  const Q = quality && quality !== 'high' && QUALITY_PRESETS[quality] ? { ...QUALITY_PRESETS[quality], key: quality } : null;
  if (Q) grassPreset = Q.key;
  const t0 = performance.now();
  // the save's flags to start from (the side-by-sides: the web bench's, scripts/bench/web-page.mjs prepareStorage), migrated
  // as the page migrates the save it boots (src/save-migrate.js bootFlags, issue #565)
  if (flags) Object.assign(gameState.data.flags, bootFlags(flags, gameState.data.keepsakes));
  // saves from before the items, as main.js's start migrates them (src/boxes/index.js); and the engines' own saves,
  // which never were until v1.83 and so had the desert's hoverbike given them at the prologue's end (issue #421)
  migrateSave(gameState);
  const stamp = (k) => { T[k] = Math.round(performance.now() - t0); };
  // a game's page (?game=<id>, src/minigames/): its own arena under its host's id, or the world it is played in, is the
  // level (src/minigames/kit/world.js levelMetaFor, as main.js builds it); `from` the world its Quit goes back to
  const gameDef = gameId ? gameById(gameId) : null;
  if (gameId && !gameDef) throw new Error(`no game ${gameId}`);
  const meta = gameDef ? levelMetaFor(gameDef, levelById) : levelById(levelId);
  if (!meta) throw new Error(`no level ${levelId}`);
  if (gameDef) levelId = meta.id;
  // the loading screen's line as the build goes, main.js's stages (issue #424: BridgeHud's loading screen says it)
  // (and with it, as the page's, why this part takes the time and how far the load is: src/load-page.js, issue #506;
  //  onLoad({ line, why, p }) at each stage and at the steps between, `step`; onStage once a stage, as before)
  const progress = loadProgress();
  const tell = (o) => { try { onLoad?.(o); } catch { /* a host without one */ } };
  const stage = (text) => { try { onStage?.(text); } catch { /* a host without one */ } tell(progress.stage(text)); };
  const step = (name) => tell(progress.step(name));
  stage(`sketching ${String(meta.title ?? 'the world').toLowerCase()}…`); step('world');
  const content = CONTENT[levelId];
  // start the loads the way main.js does: the clips, the traveller, the bodies
  const animLib = loadAnimationLibrary().catch((e) => { log('animation library failed', e); return null; });
  // the captured motion, as main.js loads it (src/motion-match.js loadMotionLibrary): the conversations' gestures (issue
  // #197: public/anim/gestures.glb, src/talk-gesture.js; `gestures` false, -js-off gestures, without them), the people's
  // own walks and the traveller's captured moves (walks.glb, moves.glb: his jumps, idles, starts and stops, src/player.js
  // locoMoves; `moves` false, -js-off moves, without them), and the matching database only with matching switched on
  // (locomotion.glb: off unless asked for, the dev menu's switch, matchingSetting, or `matching`, -js-on matching), as on
  // the web, where no player has it on (issue #427, round 4: docs/systems/engine-bridge.md "Motion matching in the engines")
  const matchOn = matching ?? matchingSetting.get();
  const motionFiles = [...(gestures ? ['anim/gestures.glb'] : []), ...(moves ? ['anim/walks.glb', 'anim/moves.glb'] : []), ...(matchOn ? ['anim/locomotion.glb'] : [])];
  const motionP = Promise.all(motionFiles.map((f) => new GLTFLoader().loadAsync(f).then((g) => [f, g]).catch((e) => { log(`${f} unavailable`, e?.message ?? e); return [f, null]; })));
  // the traveller as main.js has him: the coral-shirt traveller (src/characters/traveller.js), his overshirt's cloth
  // stepped on this thread (no workers in the engines' VMs: tripo-cloth.js falls back); the old suit if he can't load
  // (B3 or the Blender rebuild and its outfit, issue #493: `traveller` ({ on, outfit }: the bridge's -traveller v2 -outfit
  // <id>), else the game's own switch as this device keeps it (travellerSetting, without an address), as the page's
  // loadTraveller reads it; v2's models fetched beside B3's, createTraveller dressing him; a v2 that fails stays B3)
  // (and the outfit chosen in the Wardrobe, issue #571, unless the host names one: main.js's rule)
  const ask = traveller ?? travellerSetting.get('');
  const v2Ask = { on: !!ask.on, outfit: traveller?.outfit ?? (gameState.flag(OUTFIT_KEY) ? chosenOutfit(gameState) : ask.outfit ?? 'default') };
  const travellerP = loadTraveller('', { v2: v2Ask }).catch((e) => { log('traveller B3 unavailable', e?.message ?? e); return null; });
  const humansP = Promise.all([loadHuman('m'), loadHuman('f')]).catch((e) => { log('human models failed', e); return null; });
  // the people on MakeHuman bodies (src/makehuman/people.js, docs/makehuman.md), each world's as main.js has them
  const mhP = people && usesMakeHuman(levelId) ? loadPeople('', levelId).catch((e) => { log('MakeHuman bodies unavailable', e?.message ?? e); return null; }) : null;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.3, 5000);
  // distant detail finished after the first frame, as main.js does (src/deferred.js): the City-Shaft's check for trees a
  // clump put inside a house is thousands of rays through the collision, 7.6 s of the Xbox's load on the script's thread
  // before (issue #16); what is near the first view is done before it, the rest a share a frame, nearest first. Not for a
  // bench's fixed views (`view`), whose camera stands anywhere; `defer` false (the bridge's -js-off defer): all now
  const deferred = defer && !view ? new DeferredWork() : null;
  // (with it, the sand drifts' collision cut into pieces made after the world is built, as main.js: src/late-collision.js,
  // issue #385)
  DRIFT_FITS.pending.length = 0;
  DRIFT_FITS.later = !!deferred;
  DRIFT_FITS.most = DRIFT_PIECE;   // (a piece's triangles tested at most: each made on the frame's thread here)
  wallOpenings.reset();   // (one world at a time in a VM: the last one's pieces let go before the builders lay theirs)
  const caravan = await loadPlayableCaravan('', { variant: shipSetting.get('') });
  let level;
  // (back from a game started from the Arcade, ?level=arcade&back=<id> on the page: in front of that game's sign, as the
  // level reads it from the address, src/levels/arcade.js; engine/unity/game.js carries it through the reboot)
  // (a game's own page reads its address too, as the page's ?game=<id>&to=<world>&stage=<level>: the chime pirates' level
  // and the destination's planet by where the flight goes, issue #555; until then an engine's flight drew a level at random)
  const gameQuery = gameDef ? `?game=${encodeURIComponent(gameId)}${transitTo ? `&to=${encodeURIComponent(transitTo)}` : ''}${gameStage ? `&stage=${encodeURIComponent(gameStage)}` : ''}${encounter ? `&encounter=${encodeURIComponent(encounter)}` : ''}` : null;
  const loc = (back || gameQuery) && globalThis.location ? globalThis.location : null, search = loc?.search;
  if (loc) loc.search = back ? `?back=${encodeURIComponent(back)}` : gameQuery;
  try { level = quiet(() => (meta.create ? meta.create(scene, { caravan }) : runSteps(meta.build(scene, { caravan })))); } finally { DRIFT_FITS.later = false; DRIFT_FITS.most = Infinity; if (loc) loc.search = search; }
  level.id ??= levelId;
  // where the old walls' cracks may not run: their windows and doors, as the page (src/host/game-host.js wireOpenings)
  quiet(() => wireOpenings({ scene }));
  stamp('level'); stage('inking the collisions…'); step('bake');
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  physics.noClimbZones = level.noClimb ?? null;   // (walls not to be climbed, ladders climbed for free: main.js)
  physics.ladders = level.ladders ?? null;
  // (every cape and robe made from here on simulated by the engine where it can: Unity's Burst jobs; src/cape.js CAPE_HOST)
  CAPE_HOST.offload = backend?.capeOffload?.() ?? null;
  // the drifts' collision, a piece at each 8 m square of sand, made when its turn comes or a query comes near it (its
  // parts merged only while small: no worker here, a merge is built in the frame)
  { const n = deferred ? queueLateCollision(physics, deferred, DRIFT_FITS.pending.splice(0), { mergeMax: WORKER_TRIS }) : 0; if (n) log(`collision: ${n} pieces of the drifts' to make later`); }
  quiet(() => (level.initSteps ? runSteps(level.initSteps(physics, { defer: deferred })) : level.init?.(physics)));
  stamp('physics'); step('ship');
  const waters = quiet(() => new Waters(scene, { physics }));
  // trees and shrubs that landed inside a house or a rock left out, as main.js: near the first view before it, the rest
  // after (src/physics.js dropBuriedFloraSteps; the engines never ran it before issue #385). In a queue of their own,
  // run once the drifts' collision is all made: a check's long rays make every piece of sand they cross, on the frame's
  // thread here (the Buried Machine's first frames had one of 200 ms on the Deck); the guard still does the near ones
  const floraLater = deferred && physics.late ? new DeferredWork() : deferred;
  quiet(() => runSteps(dropBuriedFloraSteps(scene, physics, { defer: floraLater })));
  const queues = [...new Set([deferred, floraLater])].filter(Boolean);
  // the opening on a new save (main.js playPrologue: the desert, no save's place, not arriving by ship): the ship in
  // orbit too (its space copy), its scenes played by the engine (issue #264)
  const playPrologue = !!(prologue && menus && levelId === 'desert' && !start?.pos && via !== 'ship' && !flags && !view && !gameDef);
  // coming home by ship plays a homecoming (main.js playHomecoming, src/story/ending.js homecomingKind): the first (the
  // stone, the light over the hill), then, with Ilen, the true ending and its credits; its ship in orbit too
  const playHomecoming = !!(menus && levelId === HOME_ID && via === 'ship' && !flags && !view && !gameDef) && homecomingKind((k) => gameState.flag(k));
  const ship = quiet(() => new Ship({ caravan, scene, physics, level, levelId, content, prologue: playPrologue || !!playHomecoming }));
  // the ship's place for the quests that say "return to the ship", the scout and the Map's "Your ship" mark, as the page
  // (src/host/game-host.js wireShip: the engines' Map had no ship, #429's sequences)
  wireShip({ level, ship });
  stamp('ship'); step('reactive');
  // the bird's promise and the hoverbike in the worlds after the desert (src/host/game-host.js wireMount, as the page)
  const { bikeHere } = wireMount({ levelId, level, flag: (k) => gameState.flag(k) });
  // the potion's glow as the hearts come back, its lesson the first time a hurt leaves you short, as the page
  // (src/host/game-host.js wirePotion: neither in the engines before)
  const potion = wirePotion({ game: gameState, toast: (t, o) => toast(t, o) });
  // the hearts on the screen: shown a while after a hurt, a drink, a chime, the wallet's count ticking up (src/host/game-host.js
  // wireHealth, as the page: the engines' showed the wallet at once and the hearts on a lock or a foe near, not a fight)
  const health = wireHealth({ game: gameState, tool: () => tool });
  const player = new Player(physics, {
    // (calling the mount: the bird with the rider's call on the flute, the bike from your pack, its tank's rings blinking;
    // a taxi, a whistle: main.js onWhistle)
    onWhistle: (kind) => { const how = callKind(kind, level.mountName, gear.has('backpack')); if (how === 'rider') sound?.tune?.(RIDER_CALL, RIDER_CALL_BEAT); else if (how === 'pack') { sound?.packCall?.(); tool?.signal?.(); } else if (how) sound?.whistle?.(kind); },
    mount: level.mount, mountAt: level.mountAt, jetpack: level.features.jetpack, climb: level.features.climb ?? true,
    killY: level.killY, limit: level.limit ?? 1900, edgeHint: level.edgeHint ?? EDGE_HINTS[levelId] ?? EDGE_HINTS.default, spawn: level.spawn, spawnHeading: level.spawnHeading,
    gravityAt: level.gravityAt, unsafe: level.unsafe, dynamic: level.dynamic, water: waters,
    // how a hurt is answered, as the page (src/host/game-host.js hurtReactions, issue #435): a thud under the hit and its
    // cry, the pad's rumble (src/rumble.js, issue #346), the hearts shown, the potion's lesson; the drink's glow; a
    // knockdown's heavier thud (the engines had no thud); up again after a knock-out, the ship's cinema's quick fade
    ...hurtReactions({ player: () => player, sound: () => sound, potion, tool: () => tool, health, fade: (k, secs) => { if (shipOn) ship.cinema?.fade?.(k, true, secs); } }),
    onKnockout: (why) => combat?.knockout(why),
  });
  const lib = await animLib;
  const motion = await motionP;
  if (lib) for (const [f, g] of motion) if (g) { attachMotion(lib, g); stamp(f.replace(/^anim\/|\.glb$/g, '')); }
  if (lib) player.animator = player._animator = new Animator(lib, player.char);
  // (his captured moves as main.js has them, the save's own switch, movesSetting; without moves.glb, -js-off moves, his loops
  // stay the library's: lib.motion holds the gestures alone; the matching once the database is in, main.js's)
  player.locoMoves = moves && movesSetting.get();
  if (player.animator) player.animator.matching = !!(matchOn && lib?.motion?.db);
  const humans0 = await humansP;
  // (the people's templates: MakeHuman's man and woman where the world has them, else the Quaternius pair; the traveller
  // keeps his own body)
  const humans = humans0 && mhP ? ((await mhP)?.humans() ?? humans0) : humans0;
  const generated = await travellerP;
  if (generated) {
    try {
      // (his overshirt done by the engine where it can: Unity's Burst job, not this thread; tripo-cloth.js CLOTH_HOST)
      CLOTH_HOST.offload = backend?.clothOffload?.() ?? null;
      try { player.character = createTraveller(player.char, generated); } finally { CLOTH_HOST.offload = null; }
      player.humanoid = player.character.humanoid;
      engineColours(player.character, generated);
    } catch (e) { log('traveller B3 failed', e?.message ?? e); player.character = null; }
  }
  // (v2's materials marked for the engine: its atlas decoded to linear in Unity, the ink's display values; engineV2)
  if (player.character?.v2) engineV2(player.character);
  if (!player.humanoid && humans0) {
    const travellerTemplate = await new GLTFLoader().loadAsync('anim/traveller.glb').then((g) => g.scene).catch(() => null);
    if (travellerTemplate) player.humanoid = new Humanoid(humans0[0], player.char, 'm', { outfit: travellerTemplate });
  }
  player.attach(scene);
  wireHero({ player });   // (his own surfaces, the gear hung on him later too, as the page: src/host/game-host.js)
  if (player.mount) scene.add(player.mount.object);
  // the world's vehicles (the self-driving cabs: src/taxi.js), as main.js gives them to the traveller
  player.vehicles.push(...(level.vehicles ?? []));
  // the bike by the ramp where the bird is the mount (Viridel, #376: the engines had none), the hover vehicles skimming
  // water (they sank in the engines), no calls into the rooms off the map nor from inside the ship (wireVehicles)
  wireVehicles({ bikeHere, player, physics, level, scene, waters, ship, items: gear });
  // every fire drawn in the world burns while you stand in it, and a world's deadly void under its kill height, as the
  // page (src/host/game-host.js wireDangers: the engines registered no fire's and drew no void before, #427); the void's
  // wash hangs in level.veils, drawn by the port's Hiraeth/PitVoid
  const dangers = wireDangers({ scene, level });
  stamp('traveller'); stage('waking the people…'); step('sound, tool');
  // the world's answering plants, fans and screens (reactive-world.js: what a shot of the fluid wakes), as main.js before
  // the people (whose walks keep out of them: src/plant-ground.js plantClear, issue #496) and the flora (which keeps clear of them)
  const reactiveWorld = optional('the responsive world', () => runSteps(ReactiveWorld.make(scene, level, physics, content)));
  const plantsClear = plantClear(reactiveWorld);
  const npcs = [];
  if (people && content?.npcs?.length && humans && lib) {
    const near = quiet(() => spawnNPCs(scene, physics, content.npcs, { lib, humans, clear: plantsClear }));
    near.forEach((n, i) => { n.def ??= content.npcs[i]; npcs.push(n); });
  }
  // the crowd (crowd.js: GPU-animated figures, the nearest few promoted to full people from a pool)
  let crowd = null;
  // (no strollers round the ship's hull and ramp, whoever stands there idling slower: main.js, src/npc.js SHIP_CALM; set
  // for every world, the last one's gone)
  const calm = shipCalmZones(ship?.restPos, ship?.rampFoot);
  setCalmZones(calm);
  if (people && level.crowdSpots && humans && lib) {
    const spots = { lines: level.crowdLines, ...level.crowdSpots() };
    const clear = [...content.npcs.map((s) => ({ x: s.at[0], y: s.y, z: s.at[1], r: 3 })), ...alienSpots(levelId), ...plantsClear];
    // (the walks worked out after the first frame with distant detail, nearest first: crowd.js buildPeopleSteps, #385)
    quiet(() => {
      const built = buildPeople(physics, spots, { seed: 11, clear, calm, defer: deferred });
      const pooled = Array.from({ length: CROWD_BUDGET.pool }, (_, i) => pooledNPC(scene, physics, { kind: i % 2 ? 'f' : 'm', lib, humans }));
      crowd = new Crowd(scene, physics, { spots, built, pooled, clear, makeNPC: (kind) => pooledNPC(scene, physics, { kind, lib, humans }) });
    });
    if (crowd) { npcs.push(...crowd.npcs); if (crowd.pending) log(`crowd: ${crowd.people.length} people placed; ${crowd.pending} walks of strollers worked out later, nearest first`); }
  }
  if (crowd && Q?.crowdMid) {   // (main.js applyDetail)
    const R = crowd.range, mid = Q.crowdMid;
    Object.assign(R, { far: Math.min(Q.crowdFar ?? Infinity, R.far), midIn: Math.min(mid, R.midIn), midOut: Math.min(mid + 7, R.midOut), shadow: Math.min(R.shadow, mid * 0.5) });
  }
  // the world's non-humanoid people (src/aliens/), as main.js puts them among the npcs
  if (people) { const aliens = optional('the aliens', () => spawnAliens(scene, physics, levelId)); if (aliens) npcs.push(...aliens); }
  // the story's people and places (story/index.js), as the exporter builds it (build-world.mjs): its
  // conversations and pages are the page's, so they are left out; its people stand and move
  // the toasts, one at a time for their reading time (as ship/cinema.js shows them on the page)
  const toasts = { queue: [], left: 0 };
  let roadT = 1;
  let folk = null;   // (the errands, the hum, the faces of whoever talks: wirePeople, below once the journal is)
  // (a toast's words heard for the hum, as the page's cinema hears its own: src/story/hum.js)
  const toast = (text, options = null) => { if (options?.kind === 'hint') return; text = quietKeys(text); if (text && toasts.queue.at(-1) !== text) { toasts.queue.push(String(text)); folk?.hear(String(text)); } };
  const noticeBusy = () => toasts.left > 0 || toasts.queue.length > 0;   // (a notice up or waiting: main.js ship.cinema.noticeBusy)
  carryHooks.notice = (t) => toast(t, { kind: 'hint' });   // (carrying, src/carry.js: the first time, how to put it down and throw it)
  player.onNotice = toast;
  // the sound: the game's own (src/audio.js) where the engine plays it, else a stand-in that takes every call
  if (audio) { sound.start(); if (audio.volume !== undefined && sound.master) sound.master.gain.value = 0.9 * audio.volume; }
  // the body heard, as main.js (src/foley.js: jumps, landings, the climb, the wings, the roll, falling and getting up),
  // a pick-up, a thing carried set down or thrown, the water's splashes and strokes, the menus (src/ui-sound.js): the
  // engines played none of them before issue #379 (the sound QC, .claude/skills/sound-qc)
  const foley = sound !== SILENT ? new BodyFoley(sound) : null;
  if (sound !== SILENT) {
    interactHooks.onUse = () => sound.pickup?.({ pos: player.pos });
    carryHooks.sound = (t) => sound.land?.({ speed: 2.5, pos: t?.pos ?? player.pos });
    carryHooks.toss = () => sound.toss?.();
    waters.sound = sound;
    player.onSwim = (kind, info) => waters.event?.(kind, info);
    wrapMenus(menus, (k) => sound.ui?.(k));
  }
  // the journal's record (src/quest.js Journal: the worlds seen, the stories told, the relics, the errands), read from
  // the save as the page keeps it, without its page (the game menu draws from it: engine/menus.js)
  const journal = engineJournal({ write: !flags });
  // the errands (a parcel from one world's person to another's), the hum when words on the screen speak of it, the face of
  // whoever talks near you, as the page (src/host/game-host.js wirePeople: the engines had none of them before, #427)
  folk = optional('the people\'s errands and faces', () => wirePeople({ levelId, npcs, journal, toast: (t) => toast(t), titles: Object.fromEntries(LEVELS.map((l) => [l.id, l.title])),
    sound, ship, game: gameState }));
  // the world's story page (src/quest.js Story, as main.js makes it): its quest's last step calls story.complete(), which
  // keeps the world in the journal as told (journal.storyDone: a world done for the route, the ship's map, the recordings
  // and home), says its closing words and names what the route opened. (It was a stand-in that kept nothing: no world
  // was ever done in the engines, so the route never opened past the first two and home never came: issue #264.)
  const worldDone = (id) => !!(gameState.flag(`world.${id}.done`) || journal.storyDone(id));
  let knownBefore = knownWorlds({ order: ORDER, done: worldDone, visited: (id) => journal.seen(id), current: levelId });
  const revealed = () => {
    const c = routeChart({ order: ORDER, done: worldDone, visited: (id) => journal.seen(id), current: levelId, flag: (k) => gameState.flag(k) });
    const fresh = newlyKnown(knownBefore, c.known).filter((id) => c.findable.includes(id));
    knownBefore = c.known;
    return findableNote(fresh.length);
  };
  const storyPage = content?.story && !gameDef ? optional('the story page', () => new Story(scene, { levelId, def: { ...content.story, next: revealed }, journal, sound, capture: () => null, player, physics,
    ground: level.ground?.heightAt ? level.ground : null, say: (t) => toast(t) })) : null;
  // the five small things kept in each world (src/quest.js Relics, as main.js places them), into the journal
  const relics = content?.relics?.spots?.length && !flags && !view && !gameDef ? optional('the relics', () => new Relics(scene, physics, { levelId, spots: content.relics.spots, names: content.relics.names, journal, sound,
    capture: () => null, lights: (level.lights ??= []), say: (t) => toast(t) })) : null;
  // the fluid tool before the story, as main.js makes it, which the story reads as it is set up (the desert's push on the
  // drum and the hearth's hints, its tank's moment: src/story/desert.js toolHasPush)
  const tool = optional('the fluid tool', () => new FluidTool({ scene, player, physics, camera, rig: null, sound, level, hud: new ToolHud(), noShadow: (level.noShadow ??= []) }));
  if (tool && level.lendTool) lendTool(tool, level.lendTool);   // (the Arena's: the backpack, the blade and the shield lent for the visit, main.js)
  // the hover vehicles' trails in the fluid's tones, as the page (src/host/game-host.js wireTrails: none in the engines)
  const hoverTrails = optional('the hover trails', () => wireTrails({ scene, player, physics, tool }));
  // the sword and the shield only once found, the kit in the colours chosen (src/host/game-host.js wireKit, as the page:
  // unset, the sword hung on his back from the opening on in Unity, and cut, before the Rose House gave it, issue #394;
  // and the kit's colours won in the fight temples were the page's alone, #264). A fight's bench (-fight): armed, as the
  // Arena lends them
  const kit = optional('the kit', () => wireKit({ tool, game: gameState, armed: fight }));
  // the game menu's Wardrobe (src/wardrobe.js, issue #571): the blade's colours, and the outfits on the v2 traveller when
  // he is drawn as v2 (issue #493: player.character.v2, as main.js's travellerV2.dress)
  const wardrobe = optional('the wardrobe', () => wireWardrobe({ game: gameState, kit, tool, player, dress: () => player.character?.v2 ?? null }));
  let story = null;
  if (people && humans && lib) {
    try {
      if (!playPrologue) gameState.data.flags['prologue.done'] = true;
      story = quiet(() => createStory({ playGame: (href) => onGame?.(href), levelId, scene, physics, level, player, npcs, crowd, sound, journal, story: storyPage ?? { complete() {}, start() {}, done: false, waitFor: null },
        capture: backend.portrait ? (eye, look, w, h, o) => portraitCapture(eye, look, w, h, o) : null, lib, humans, toast, tool, isNight: () => { try { return sky.hour < 6.4 || sky.hour > 19.3; } catch { return false; } }, ship, drone: () => null }));
    } catch (e) { log('the story failed to start', e?.message ?? e); }
  }
  stamp('people'); step('story');
  // the shops (main.js: talking to a keeper, "Show me what you have", or E at their counter; Anselm's aboard): the web's
  // ShopPanel keeps their logic, its sheet is the menus' 'shop' (engine/menus.js openShop; BridgeMenu.cs DrawShop),
  // opened once the conversation that asked for it has closed (issue #264)
  let shopWaiting = null;
  const shopPanel = menus?.openShop ? new ShopPanel({ el: SHOP_EL, doc: null, game: gameState, resources, sound, covered: () => true,
    onBought: ({ ware }) => { if (ware === 'heart') { player.setMaxHearts?.(resources.maxHearts); player.restore?.(player.maxHearts); } } }) : null;
  if (shopPanel) gameState.on('shop:open', ({ shop } = {}) => { shopWaiting = (shop === 'thrum' ? story?.scientist?.shopEntry?.() : story?.shops?.byId?.(shop)) ?? null; });
  if (storyPage) storyPage.waitFor = () => !!story?.dialogue?.open || !!story?.moments?.playing;   // (a world's words never over a conversation or a moment: main.js)
  journal.markSeen(levelId);   // (after the story read its first visit, as main.js marks it)
  if (Q) for (const n of npcs) { n.lowDetail = !!Q.lowDetail; n.clothFar = Q.clothFar ?? null; }
  // the makers' boxes (src/boxes/): each with its beacon, the pale pillar of light over a box that must be found
  // (its opening filmed by the ship's cinema where the ship is attached, as main.js: the shots, the letterbox, the HUD hidden;
  // its card the screen's 'boxCard', src/boxes/card.js, drawn by the engine: issue #345)
  const boxes = optional('the boxes', () => createBoxes({ levelId, scene, physics, level, player, sound, quests: story?.quests ?? null, toast,
    anchor: () => ship?.arrivalSpot?.() ?? null, quiet: () => !!story?.dialogue?.open,
    cam: { shot: (s) => { if (shipOn) ship.shot(s); }, release: (b) => { if (shipOn) ship.release(b); }, hud: (on) => { if (shipOn) ship.cinema.hud(on); }, bars: (on) => { if (shipOn) ship.cinema.bars(on); } } }));
  reactiveWorld?.keepOff?.(peopleStarts(npcs, crowd));   // (no one placed by the story starts in the middle of a flower, as main.js: issue #496)
  const flora = quiet(() => buildFlora({ scene, level, levelId, physics, density: Q?.floraDensity ?? 1, keep: floraKeep({ level, content, ship, npcs, crowd, boxes, reactiveWorld }) }));
  if (flora?.collider) physics.addCollider(flora.collider);   // (the large plants solid, as main.js)
  // the small props past the preset's propFar left out of every pass, as main.js's cullFar does (issue #262): the level's
  // small props and the flora's each frame (below), and the big instanced sets main.js cuts into tiles (perf.js
  // tilesInstances) instance by instance where they are drawn (the mirror's `far`: Unity's InstMats.far), whole, past
  // propFar and a tile's reach (main.js leaves out a tile whose centre is past propFar by more than its radius)
  const small = farOn ? [...(level.smallProps ?? []), ...(flora?.small ?? [])] : [];
  // (the levels of detail, lod.js as main.js: a test, -js-on lod; its levels built on the script's thread)
  let lodLevels = null;
  const lodKeep = () => [player.object, player.mount?.object, ...player.vehicles.map((v) => v.object ?? v.mesh), ...npcs.map((n) => n.object), ...(crowd?.pool ?? []).map((e) => e.npc?.object), level.ground?.mesh];
  if (farOn && Q?.propFar) scene.traverse((o) => { if (tilesInstances(o)) o.userData.instancesFar = (o.userData.drawFar ?? Q.propFar) + PROP_TILE_REACH; });
  if (flora?.noShadow) (level.noShadow ??= []).push(...flora.noShadow);
  // grass blades round the camera on the grassy grounds (flora-grass.js), by the graphics preset (the bench's: High), as main.js grows them
  const grass = optional('the grass blades', () => buildGrass({ scene, level, physics, presetKey: grassPreset, water: FLORA_WORLDS[levelId]?.water,
    keep: [ship?.site && { x: ship.site.x, z: ship.site.z, r: 9 }, ship?.rampFoot && { x: ship.rampFoot.x, z: ship.rampFoot.z, r: 3 }] }));
  if (grass) (level.noShadow ??= []).push(...grass.meshes);
  // the world's life and weather, the fluid tool and the drone, as main.js builds them
  // what burns (flammable.js: the brambles, the dry stands, the lamps a flame lights)
  const flammables = optional('what burns', () => new Flammables(scene, flammableSpots(level), { lights: (level.lights ??= []), sound }));
  const lifeCfg = level.life ?? {};
  const flocks = quiet(() => (lifeCfg.flocks ?? []).map((f) => new Flock(scene, f)));
  const motes = lifeCfg.motes ? quiet(() => new Motes(scene, lifeCfg.motes)) : null;
  // (the page draws the motes over the ink from a scene of their own; the engines take them from this one)
  const motePoints = motes?.scene ? [...motes.scene.children] : [];
  for (const c of motePoints) scene.add(c);
  // the makers' houses' air (src/temples/air.js, issue #372): their motes in the scene the bridge mirrors, the world's
  // own hidden while the traveller is inside one; their lights' pulse and their sound's bed, as main.js
  const houseAir = level.temples?.length ? quiet(() => new HouseAir(level, { lowDetail: !!Q?.lowDetail, host: scene, worldMotes: { scene: { children: motePoints } } })) : null;
  const footprints = quiet(() => new Footprints(scene));
  // off the ground, a patch of shade straight under him (src/jump-shadow.js, as main.js: wireJumpShade; Hiraeth/JumpShade)
  const jumpShade = optional('the jump\'s shade', () => wireJumpShade({ scene, level }));
  // the tool's crosshair and mode while aiming, its notices by him (src/ui.js ToolHud, as main.js: toolGauge; BridgeHud.Tool.cs)
  const toolHud = toolGauge({ tool: () => tool, player, camera });
  const onStep = player.onStep;
  player.onStep = (p, heading, up, i) => {
    if (sound !== SILENT && waters.step?.(p)) return;   // (in the water: a splash, no print, as main.js)
    onStep?.(p, heading, up, i); footprints.add?.(p, heading, up, i); sound.step(Math.hypot(player.vel.x, player.vel.z));
  };
  // (never on the ship, its ramp or in it, as main.js: issue #246)
  const wildlife = optional('wildlife', () => new Wildlife(scene, level, physics, { content, sound, defs: level.wildlife, keepOff: (p) => !!ship?.keepsOff?.(p) }));
  // fire spreads on the wind, creatures flee it, foes catch it, as the page (src/host/game-host.js wireChemistry: the
  // engines' brambles burnt alone before, #427)
  const chemistry = optional('the chemistry', () => wireChemistry({ flammables, wildlife, tool, game: gameState, player }));
  // (its pace, and the desert's first arrival clear until its flag, issue #139, as main.js's)
  const weather = optional('weather', () => new Weather(content.weather, { ...content.weatherPace, calm: content.calmUntil ? () => !gameState.flag(content.calmUntil) : null }));
  // (on the page's window as main.js puts it, where the story reads it: rain on Lorn's Great Crystal makes it sing,
  // src/story/perdide.js; one game at a time, so the newest world's)
  globalThis.weather = weather ?? null;
  const shelter = optional('shelter', () => new Shelter(physics));
  // the wind (wind.js): its direction and gusts for the traveller, the plants and the grass, and its wisps of blown sand
  // (on the page a screen overlay of their own; here a mesh in the mirrored scene, on the port's Hiraeth/Wisp)
  const wind = optional('the wind', () => new WindStreaks());
  if (wind) {
    wind.uniforms.uInk.value = new THREE.Color('#2b211f');
    wind.uniforms.uRes.value.set(width, height);   // (the frame its strokes are measured on: wind.js WISP)
    scene.add(wind.mesh);
    (level.noShadow ??= []).push(wind.mesh);
  }
  // the ink where you lean on the world's edge and the wind streaming in round you, as the page (src/host/game-host.js
  // wireEdge: the engines had neither)
  const edge = wind ? optional('the edge', () => wireEdge({ wind, player, parent: scene })) : null;
  if (edge) (level.noShadow ??= []).push(edge.ink.mesh);
  // (in a guardian's fight the ping is a hint, as main.js's: the lens on the weak point, its line once the struggle has
  // gone on a while, src/temples/hints.js; the line a toast here, the page's drone bubble)
  const struggle = new Struggle();
  // the desert's sleeping observatory (src/observatory.js, as main.js: Naji the sketcher, the six ledges, the three lenses
  // turned by E beside each or a glob of the fluid, the roof unfolding; its words said through the story page)
  const expedition = level.observatory && npcs[5] && !gameDef ? optional('the observatory', () => new ObservatoryQuest({ model: level.observatory, journal, traveler: npcs[5],
    story: storyPage ?? { say: (t) => toast(t) }, capture: () => null, sound })) : null;
  const _lensAt = new THREE.Vector3();
  if (expedition) registerInteractable({ id: 'lens', priority: PRIORITY.use, range: 1, prompt: () => expedition.hud(player).replace(/^E \(X \/ □\) /, ''),
    at: () => { const i = expedition.nearby(player); return i >= 0 ? expedition.model.dials[i].getWorldPosition(_lensAt).add(player.frame.up) : null; },
    distance: (p) => (expedition.nearby(p) >= 0 ? 0 : Infinity), use: () => {} });
  // the scout finds the objective (Q, D-pad →): the cue names it and how far at once, as main.js (scoutSays); a guardian's hint
  // the same way, after a struggle (src/temples/hints.js)
  const scoutSaid = { text: '', until: 0, kind: '' };
  const scoutSays = (text, secs, kind = '') => { scoutSaid.text = text; scoutSaid.kind = kind; scoutSaid.until = performance.now() + secs * 1000; };
  const findGoal = (target) => {
    const id = String(target?.id ?? '').replace(/^portal-\d+-/, '');
    const q = /^(quest|opener|giver)-/.test(id) ? story?.quests?.objective?.()?.quest : null;
    if (q) return story.quests.goal?.(q) ?? '';
    if (/^(ledge|lens|observatory|traveler)/.test(id)) return 'Wake the sleeping observatory';
    if (id === 'story') return content?.story?.title ?? '';
    if (id === 'ship') return 'On to the next world';
    return '';
  };
  const _fl = new THREE.Vector3();
  const findLine = (found) => () => {
    const t = scout?.target?.id === found.id ? scout.target : found;
    const rise = _fl.subVectors(t.position, player.pos).dot(player.frame.up);
    return findSummary({ goal: findGoal(t), step: findText({ ...t, rise }, player.pos.distanceTo(t.position)) });
  };
  const objectiveNow = () => nextObjective({ player, expedition, story: storyPage, ship: level.ship, level, quest: () => story?.objective?.() });
  const scout = optional('the drone', () => new Scout({ scene, player, physics, sound, getTarget: objectiveNow,
    onPing: (target) => { scoutSays(findLine(target), FIND.say + FIND.seek, 'quest'); plumb?.progress(); },
    onFind: (target) => { scoutSays(findLine(target), FIND.say, 'quest'); story?.marker?.reveal?.(); },
    onShrug: () => scoutSays(guardianHint(level.temple) ? '◇ …' : 'Nothing to find here', 2.5),
    getHint: () => openHint(guardianHint(level.temple), struggle.t), onHint: (line) => scoutSays(droneShown(line), HINT.say) }));
  // the onboarding, as main.js: Plumb's own lines (src/companion.js: the opening's, once a save, and when you look lost, its
  // ping toward the goal), the scout's button taught once after the first conversation (src/scout-hint.js), the desert's
  // first steps (src/first-steps.js: the camera and the jump); all on the cue at the bottom
  const help = !flags && !view && !gameDef;
  const plumb = help ? new Companion({ state: gameState, setting: () => settings?.droneHints ?? 'on' }) : null;
  const droneSaid = { text: '', until: 0 };
  // (Plumb each frame, as the page: src/host/game-host.js wireCompanion, issue #434)
  // (something critical: at your shoulder with its mark, the button opens its talk in the dialogue box; issue #543)
  const plumbStep = wireCompanion({ game: gameState, plumb, scout, level, player, npcs, struggle, sound: sound !== SILENT ? sound : null, dialogue: () => story?.dialogue ?? null,
    teach: () => { if (plumbHintDue(gameState)) { scoutTeach.line = plumbHintLine; scoutTeach.left = SCOUT_HINT_SHOW; } } });
  // what the save's events say and start: a gadget found and its line after its card, a keepsake's theme, the trials'
  // upgrades to the gadgets' tuning (before the gadgets are made), Plumb's clock and notes (src/host/game-host.js
  // wireLessons, as the page)
  wireLessons({ game: gameState, items: gear, levelId, gadgets: () => gadgets, sound: sound !== SILENT ? sound : null, toast: (t, o) => toast(t, o), plumb });
  const scoutTeach = { left: 0, at: 0, line: scoutHintLine };   // (the scout's line, or Plumb's talk's: issue #543)
  const scoutHint = help ? installScoutHint({ game: gameState, show: () => { scoutTeach.line = scoutHintLine; scoutTeach.left = SCOUT_HINT_SHOW; },
    usable: () => !(shipOn && (ship.inside || ship.playing)) && !trials?.running && gameState.flag('prologue.done') && !!scout?.getTarget?.() }) : null;
  const firstSteps = help && levelId === 'desert' && !gameState.flag('item.backpack') ? new FirstSteps(gameState) : null;
  const firstStepsAt = new THREE.Vector3(NaN, 0, 0);
  // a world's own ping (the City-Shaft's jets: the way up), a nudge, one that waits for the notices and the talk, as the
  // page (src/host/game-host.js wireNudges: the engines heard no 'scout:ping' before)
  const nudges = optional('the nudges', () => wireNudges({ game: gameState, scout, quiet: () => !!ship?.playing || !!story?.dialogue?.open, noticeBusy }));
  stamp('life');
  stamp('flora'); step('wildlife, foes');

  // the camera rig, on the page's stand-in canvas
  // (its view of the world: the cabs as drawn, the lens kept out of them, as the page: src/host/game-host.js wireCamera;
  // the engines' camera went through the cabs before, #427)
  const cam = wireCamera({ physics, level, player });
  const rig = new CameraRig(camera, document.createElement('canvas'), cam.physics);
  rig.yaw = level.camYaw ?? (player.heading + Math.PI);
  rig.pitch = level.camPitch ?? rig.pitch;
  rig.constrain = cam.constrain;
  // (the follow shot each frame as the page: a ride's own, behind the jets' nose, the wide arm gliding; the engines
  // followed his heading alone before, #427)
  const follow = cameraFollow({ rig, player });
  // the benches to sit on, as the page (src/host/game-host.js wireBenches; #264: "benches aren't in the engine yet")
  const benches = optional('the benches', () => wireBenches({ levelId, scene, physics, level, player, sound, rig }));
  if (tool) tool.rig = rig;

  // the look: the preset and the hour, as main.js applies them
  const post = createPost();
  const U = post.uniforms;
  // (the world's style preset and planets, a level's zones: src/host/game-host.js wireSky, as the page)
  const look = wireSky({ level, U });
  const applyPreset = () => look.setPreset(look.at.preset);
  applyPreset();
  // the world's own cloud shadows (main.js: level.defaults.cloudShadows, most worlds none: Viridel's far tower and Lorn were
  // in a cloud's shade in Unity, lit on the page, issue #264)
  sharedUniforms.uCloudShadows.value = level.defaults?.cloudShadows ?? 1;
  // the graphics preset's look (main.js applyDetail): the lighter weathering, no cloud shadows or crease shading where it
  // says, its shadow filter's taps
  if (Q) {
    sharedUniforms.uWearLite.value = Q.lowDetail || Q.postLite ? 1 : 0;
    waterShared.uWaterLite.value = Q.lowDetail || Q.postLite ? 1 : 0;   // (no sun's sparkle on the water there: main.js applyDetail)
    if (!Q.cloudShadows) sharedUniforms.uCloudShadows.value = 0;
    if (!Q.ao && U.uAO) U.uAO.value = 0;
    if (U.uPostLite) U.uPostLite.value = Q.postLite ? 1 : 0;
    if (Q.taps) sharedUniforms.uShadowTaps.value = Q.taps;
  }
  const sky ={ hour: level.defaults?.hour ?? 10 };
  const script = level.sky?.script ? colourScript(level.sky.script) : undefined;
  let atmo = level.atmo(player.pos.x, player.pos.z, player.pos.y);
  // (as main.js updateSky: an eclipse world's sun on its own path and the moon over it by the hour, src/eclipse.js; a
  // world with moons of its own has none of ours)
  const updateSky = () => {
    applyTimeOfDay(sky.hour, sharedUniforms.uSunDir.value, U, atmo, atmo?.script ?? script);
    if (level.sky?.eclipse && skies) applyEclipse(sky.hour, level.sky.eclipse, U, sharedUniforms.uSunDir.value);
    if (level.sky?.moon === false && U.uMoonVis) U.uMoonVis.value = 0;
  };
  updateSky();
  // the Lantern's light low in the sky from the seventh world on, brighter as the end nears (src/story/lantern-sky.js, as
  // main.js setLanternSky); again when a world is done or the story moves
  const setLanternSky = () => { if (U.uLantern && skies) applyLanternSky(U.uLantern.value, lanternSky({ level: levelId, completed: completedWorlds(ORDER, { flag: (k) => gameState.flag(k), storyDone: (id) => journal.storyDone(id) }), flag: (k) => gameState.flag(k) })); };
  setLanternSky();
  gameState.on('flag', ({ name } = {}) => { if (/^world\..+\.done$|^ending\.|^finale\.met$|^clue\.bazaar\.home$|^bazaar\.broadcast\.on$/.test(name)) setLanternSky(); });

  // what the boxes' special items do (src/boxes/effects.js: the bell's note on V / Y, the lantern after dusk, the star on his
  // lapel, the tank's upgrades…), as main.js makes them
  const itemFx = optional('the items\' effects', () => createItemEffects({ player, tool, level, sound, camera, toast, isNight: () => sky.hour < 6.4 || sky.hour > 19.3 }));
  // the fragments of the singing light (src/fragments.js, as main.js makes them; the Unity-default plan's D3): hidden out of
  // the way, they sing faintly near and are taken by walking into them; the first brings Anselm, who sells for them aboard
  const fragments = optional('the fragments', () => createFragments({ levelId, scene, physics, level, player, sound, game: gameState, items: gear, toast, lights: (level.lights ??= []) }));
  // the gadgets (src/gadgets/, issue #344), made as main.js makes them, after the trials' upgrades to their tuning: the one in
  // hand on LT / RT (R, and G or T), D-pad ↑ or B held the wheel (the gadgets and the glove's modes, the game waiting; a tap
  // the last pick back), X the next mode, Y / △ (V) the
  // whistle; a gadget found is in hand at once (#330). Their chip, wheel, reticle and marks are the screen's state
  // (src/gadgets/hud.js; BridgeHud.cs draws them), and what they do to a foe (the fight's foes, above).
  // the foes and the fight (engine/combat.js: src/foes.js as main.js wires it, the lock-on and its camera, the drops, the
  // potion, the knock-out's card; the guardians are the temples' own), when the engine is played (with its menus) or a
  // plan asks for them (`fight`: the bridge's -fight); not in a bench's plan, whose numbers stay comparable with before
  combat = (menus || fight) && !flags ? optional('the foes', () => makeCombat({ scene, level, levelId, content, physics, player, tool, sound, npcs, settings, camera, rig, lib, humans, waters, screen,
    health, toast: (t) => toast(t), teach: (t) => toast(t, { kind: 'hint' }) })) : null;
  if (combat) stamp('foes');
  // the bodies of the foes this world can field, built in the load and drawn (out of the world) by its first frames, as
  // main.js builds them for its warm passes: their shapes are then the ones every foe of the kind shares
  // (src/foe-shapes.js), so a foe's spawn makes no meshes in the host (issue #468: a brute and its skitters were 14 MB of
  // geometry and 100 ms of Unity's main thread on the Mac). Taken out after two frames, each body kept for the first foe of
  // its kind (Foes.add), so that foe is not built in its spawn's frame either; the shapes stay for the rest.
  let foeWarm = combat?.foes?.on ? optional('the foes\' bodies', () => combat.foes.warmModels()) : null;
  if (foeWarm) { foeWarm.group.position.set(0, -1e4, 0); foeWarm.group.updateMatrixWorld(true); scene.add(foeWarm.group); foeWarm.frames = 0; }
  // the Arena's list of foes (src/foe-spawner.js FoeList, the level's quick menu: every foe there is to fight, a world's
  // waves, a guardian's ring), attached to the fight's foes as main.js does; its page is the menus' 'foes' (engine/menus.js
  // openFoes, BridgeMenu.cs DrawFoes), D-pad ↓ or K opens it; the tab on the left edge saying so is the screen's 'foeTab'
  const foeList = combat && menus?.openFoes && level.foes?.waves && level.quickMenu?.shown ? level.quickMenu : null;
  if (foeList) {
    foeList.win?.removeEventListener?.('keydown', foeList.onKey, true);   // (its K is the engine's own: game.key)
    optional('the list of foes', () => foeList.attach({ foes: combat.foes, player, physics, sound, scene, notice: (t) => toast(t), kind: level.foes.kind ?? null }));
  }
  // the Arcade's board of games (src/levels/arcade-board.js, the level's quick menu): its sheet is the menus' 'arcade' page
  // (engine/menus.js openArcade, BridgeMenu.cs DrawArcade, issue #430), opened as the page's is: the board by the way in
  // (its E), D-pad ↓, Tab; a game chosen goes to its page as a sign's does (onGame)
  const arcadeBoard = menus?.openArcade && level.quickMenu?.games && level.quickMenu.choose && !flags && !view ? level.quickMenu : null;
  if (arcadeBoard) {
    arcadeBoard.win?.removeEventListener?.('keydown', arcadeBoard.onKey, true);   // (its Tab is the engine's own: game.key)
    arcadeBoard.go = (href) => onGame?.(href);
    arcadeBoard.toggle = (on = !arcadeBoard.open) => { if (on) return menus.openArcade(arcadeBoard); if (menus.mode === 'arcade') menus.close(); arcadeBoard.open = false; return false; };
  }
  const gadgets = optional('the gadgets', () => new Gadgets({ scene, physics, player, camera, rig, sound, tool, level, foes: combat?.foes ?? null, wind, input: null, relics: null, flammables, post: U, boxes,
    notice: (t, o) => toast(t, o), ring: () => itemFx?.ring?.() }));

  // the ship attached, as main.js attaches it, when the engine is played (its menus; not a bench's plan): walking up the
  // ramp takes you aboard, E at the console plays the voicemail (CallDirector), at the holo table the galactic map (the
  // menus' own here, engine/starmap.js), and its scenes play: the prologue, the take-off, the arrival (issue #264). Its
  // cinema draws nothing of its own (no page): its letterbox, fades and subtitles are the screen's 'cine' and 'sub'
  // (src/platform.js), which the engine's HUD draws (BridgeHud.cs). Travel ends in `onTravel(to)`: the engine
  // starts again at that world's landing (the page goes to ?level=<to>&via=ship).
  // (`scenes`: a plan that wants them without the menus: the bridge's -aboard, the rooms photographed as the web's ?aboard=)
  const shipOn = !!((menus || scenes) && ship && story && !flags && !view && !gameDef);   // (not on a game's page: the runner keeps the ship out of the picture)
  pageGo = menus && !flags && !view && !gameDef ? onPage : null;
  refusedGo = ({ quest } = {}) => { const q = story?.quests; if (quest && q && !q.isStarted(quest)) q.start(quest); };
  shipIndoors = shipOn ? (p) => !!ship.parked && !!ship.modelOf(p) : null;
  const ambush = wireAmbush({ game: gameState, levelId, seen: (id) => journal.seen(id), settings, titles: Object.fromEntries(LEVELS.map((l) => [l.id, l.title])) });
  if (shipOn) {
    ship.cinema.dom = false;
    quiet(() => ship.attach({ player, rig, camera, sound, journal, post, story, wind, npcs, lib, humans, levels: LEVELS, order: ORDER,
      titles: Object.fromEntries(LEVELS.map((l) => [l.id, l.title])),
      // (the first flight to a world never visited by way of the chime-pirates' page, as the page's departure:
      // src/host/game-host.js wireAmbush, issue #435; the engine starts again on it, then at the world, arriving)
      go: (to) => { const href = onGame ? ambush.departure(to) : null; if (href) onGame(href); else onTravel?.(to); } }));
    // the recordings' hologram (src/ship/hologram.js): on the page a scene of its own drawn over the finished picture
    // (HOLO.render); here that scene hangs in the mirrored one, its figures drawn by the engine in light over its ink
    // (Unity: Hiraeth/HoloFigure, port-format.js 'holo'), as the veils' washes are (issue #394: the father's message showed
    // nothing in Unity)
    if (ship.holo) scene.add(HOLO.scene);
  }
  // the holo table's galactic map (engine/starmap.js: the page's StarMap and its signature search), drawn by the menus
  // (BridgeMenu.StarMap.cs) from the options the ship gave its own StarMap in attach
  const starMap = shipOn && menus && ship.map?.o ? new EngineStarMap({ o: ship.map.o, screen: () => menus.screen?.() ?? { w: 1280, h: 720 },
    pad: () => !!globalThis.document?.body?.classList?.contains?.('controller') }) : null;
  const openStarMap = () => {
    if (!starMap || !menus?.openStarMap?.(starMap)) return false;
    if (gameState.flag('ship.powered')) sound.nextAction?.('ship-confirm', { gap: .3, ui: true });
    // (the first time there is a world to find: how the search works, as the ship's useTable says it once the page drew it)
    if (starMap.targets?.length && gameState.flag('ship.powered') && !gameState.flag('signature.search.told')) {
      gameState.set('signature.search.told', true);
      ship.cinema?.say(SEARCH_LINE, { secs: 7, queue: true });
    }
    return true;
  };

  // the ways through to another space (src/passage.js; issue #264): a doorway into a room built off the map, a cave mouth,
  // a temple's door, a hatch, each a level's `portals` entry, walked into as main.js walks them: its light flares
  // (src/thresholds.js, the veils the engine draws), the paper sweeps across (the screen's 'passage', which BridgeHud.cs
  // draws as the page's #passage), the traveller is carried across mid-stride (carryAcross) and the paper goes on off the
  // far side. No drawing ahead (WarmDraw): the engine has every mesh uploaded already.
  const passCover = {
    n: 0, k: 0, lightK: 0, state: null,
    send(o) { this.state = { ...(this.state ?? {}), ...o, n: ++this.n }; screen.set('passage', this.state); },
    light(k, secs) { this.lightK = k; this.send({ light: k, lightSecs: secs, phase: null }); },
    cover(secs = PASSAGE.cover) { this.k = 1; this.send({ phase: 'cover', secs }); },
    reveal(secs = PASSAGE.reveal) { this.k = 0; this.lightK = 0; this.send({ phase: 'reveal', secs, light: 0, lightSecs: secs }); },
    clear() { if (this.state) { this.state = null; screen.set('passage', null); } },
  };
  // walked on through a doorway, and in off it on the far side (issue #389, src/door-walk.js), as main.js
  const doorWalk = new DoorWalk({ player, physics, rig });
  const passage = new Passage({ cover: passCover, warm: null, carry: (c) => { if (c.to) for (const q of queues) q.need(c.to, DEFER.near); carryAcross(player, rig, camera, c); } });
  // (and a fight temple's gatehouse door, which opens its game's page: issue #384, kit/marker.js)
  const doorSigns = GAMES.some((g) => g.marker?.door && g.markers?.some((m) => partsOf(levelId).includes(m.level)));
  const thresholds = level.portals?.length || doorSigns ? optional('the doorways\' light', () => new Thresholds({ veils: (level.veils ??= new Veils()), parent: scene, portals: level.portals, physics })) : null;
  let portalCool = 0;
  const throughPortals = (dt, simT) => {
    portalCool = Math.max(portalCool - dt, 0);
    if (portalCool || passage.active || player.riding || player.dead || player.god || !level.portals) return;
    for (const pt of level.portals) {
      const d = player.pos.distanceTo(pt.at);
      // (a doorway that won't take you yet, `when`: its `refuse` said once as you walk into it)
      if (pt.when && !pt.when()) { if (d < pt.r) { if (!pt._refused && pt.refuse) toast(pt.refuse); pt._refused = true; } else if (d > pt.r + 3) pt._refused = false; continue; }
      if (d < doorWalk.reach(pt)) {   // (its radius; sooner, going into it, when the room beyond is too shallow for his pace: src/door-walk.js)
        const lit = thresholds?.flare(pt);
        const { lead, cover } = doorWalk.enter(pt, { lead: lit ? THRESHOLD.lead : 0, cover: PASSAGE.cover });
        if (!passage.go({ to: pt.to, heading: pt.heading, lead, cover, onMove: (c) => { thresholds?.arrive(c.to); doorWalk.arrive(); } })) doorWalk.end();
        sound.doorway?.();
        sound.page?.();
        portalCool = 1.2 + THRESHOLD.lead + PASSAGE.cover + PASSAGE.reveal;
        break;
      }
    }
  };

  // the trials and the games (engine/trials.js): this world's challenges, its games' signs and their hosts, when the
  // engine is played (its menus draw the runner's card) or a plan asks for them (`trials`: the bridge's -trial, -game);
  // not in a bench's plan, whose numbers stay comparable with before. On a game's page, its runner at once.
  const trials = gameDef || withTrials || (menus && !flags && !view) ? optional('the trials', () => makeTrials({ levelId, scene, physics, level, player, camera, rig, sound, wind, tool, foes: combat?.foes ?? null, chimes: combat?.chimes ?? null,
    npcs, crowd, wildlife, flora, people: lib && humans ? { lib, humans } : null, story, menus, items: gear, game: gameState, toast, waters, settings, ship, kick, def: gameDef, from, onGame, onLeave, thresholds,
    transit: gameDef ? ambush.transit(transitTo) : null, helper: gameDef ? helperRun(gameState, gameDef.id, encounter) : null,
    log: (t) => log(t) })) : null;
  if (trials) stamp('trials');
  // input: the keys by KeyboardEvent.code, as the page's listeners keep them (main.js), and the pads
  // What is in hand, as the page's InputMode keeps it (src/input-mode.js): a pad connected or pressed is, until a key is
  // pressed; the prompts, the cue, a box's card and every {key:verb} name its buttons (the body's 'controller' class,
  // src/prompt-keys.js inputKind), in Xbox / PlayStation form, which the bridge prints as the pad in hand does (issue #345).
  // (Esc does not count: a handheld's back button may arrive as it)
  // (on a handheld, the Retroid, a tap leaves its pad in hand: the prompts keep its buttons' names, the HUD's pointer
  // buttons come back for the finger: src/input-mode.js touchKeepsPad, issue #574; a click on a computer is the mouse in hand)
  const inputMode = new InputMode({ touchDevice: false, storage: { get: () => null, set() {} }, touchKeepsPad: () => padLayout() === 'android' });
  let padKind = null;
  const padInHand = () => inputMode.controller;
  function inputFrame() {
    inputMode.frame(controller.index !== null);
    inputMode.apply(document.body?.classList);
    if (padKind !== inputMode.kind) { padKind = inputMode.kind; boxes?.card?.refresh?.(); }
    // (the HUD's own buttons for a pointer, as the page's: the minigames' pause, gone with a pad in hand; issue #570)
    const buttons = hudButtons(screen.state, { kind: inputMode.pointerKind, ts: TEXT_SIZES[settings?.textSize] ?? 1, under: !!menus?.open });
    screen.set('buttons', buttons.length ? buttons : null);
  }
  const keys = {};
  const tapped = new Set();
  const latched = () => { const o = { ...keys }; for (const k of tapped) o[k] = true; tapped.clear(); return o; };
  // a conversation's answer picked with the pad (the page focuses a button; here: an index, screen.choice)
  const talk = { sel: 0 };
  const dialogue = () => story?.dialogue ?? null;
  const talking = () => !!dialogue()?.open;
  // photo mode (main.js setPhoto, photoUpdate; issue #264): the world held still under a free camera, flown from where
  // the view was (the left stick, LB / RB down and up, RT faster; the right stick turns it), the HUD gone but for its
  // keys at the top; A / × saves the picture (the engine's own shot: the Unity bridge's BridgeHost.Photo, into the app's
  // photos folder), B / ○, View or Menu leaves it. From the Start menu's Photo mode, View + D-pad ↑, or P.
  const photo = { on: false, capture: 0, saved: 0, pos: new THREE.Vector3() };
  const photoHint = () => (padInHand()
    ? `Left stick fly · right stick look · LB/RB down/up · ${confirmKey()} save · ${backKey()} exit`
    // (the keys' line as the page's #photo, hint.photo: but its H panel, the page's developer panel, none here; issue #264)
    : 'PHOTO MODE · WASD + Q/E fly · mouse look · SHIFT fast · ENTER save PNG · P exit');
  function setPhoto(on) {
    if (on && (pinned || talking() || (shipOn && ship.playing) || player.dead || !backend?.photo)) return;
    photo.on = !!on; photo.capture = 0;
    if (on) photo.pos.copy(camera.position);
    for (const k of ['cue', 'prompt', 'stamina', 'tool', 'health', 'keys', 'toast', 'gadget', 'gadgetWheel', 'reticle', 'gadgetMarks']) screen.set(k, null);
    screen.set('photo', on ? { hint: photoHint() } : null);
  }
  const _pf = new THREE.Vector3(), _pr = new THREE.Vector3();
  function photoFly(dt, input) {
    const up = camera.up, cp = Math.cos(rig.pitch);
    _pf.copy(player.frame.right).multiplyScalar(-Math.sin(rig.yaw) * cp)
      .addScaledVector(player.frame.up, -Math.sin(rig.pitch))
      .addScaledVector(player.frame.fwd, -Math.cos(rig.yaw) * cp).normalize();
    _pr.crossVectors(_pf, up).normalize();
    const sp = (input.ShiftLeft || input.ShiftRight ? 60 : 14) * dt;
    const f = (input.KeyW ? 1 : 0) - (input.KeyS ? 1 : 0), s = (input.KeyD ? 1 : 0) - (input.KeyA ? 1 : 0), v = (input.KeyE ? 1 : 0) - (input.KeyQ ? 1 : 0);
    photo.pos.addScaledVector(_pf, f * sp).addScaledVector(_pr, s * sp).addScaledVector(up, v * sp);
    camera.position.copy(photo.pos);
    camera.lookAt(_pr.copy(photo.pos).add(_pf));
  }
  const controller = new Controller({
    pads: () => navigator.getGamepads?.() ?? [],
    // (a menu open, engine/menus.js: the pad's menu context, its actions and directions the menu's)
    // (a box opening: the menus' buttons, A / × on its card goes on, B / ○ skips; main.js busy())
    // (knocked out, its card: A / × gets him up, as the page's focused button)
    context: () => (menus?.open ? 'menu' : photo.on ? 'photo' : talking() ? 'talk' : boxes?.busy?.() || combat?.restartOpen ? 'menu' : player.ride ? 'ride' : 'game'),
    look: (x, y) => { if (x || y) rig.look(x, y); },
    action: (name, dt) => {
      if (menus?.open) { menus.action(name); return; }
      if (trials?.padAction(name)) return;   // (a run's own: Menu pauses it, the rest not in a game; src/minigames/kit/runner.js)
      // (the gadget wheel open, the game waiting: no lock, Plumb, potion or call meanwhile, as main.js WHEEL_HOLDS)
      if (gadgets?.wheelOn && (name === 'lock' || name === 'scout' || name === 'potion' || name === 'call' || name === 'l3' || name === 'zoomIn' || name === 'zoomOut')) return;
      if (name === 'worldDebug') { openDev(); return; }   // L3 + R3: the dev menu (src/dev-menu.js; engine/menus.js draws it)
      if (name === 'photo') { setPhoto(!photo.on); return; }
      if (name === 'capture') { if (photo.on && !photo.capture) photo.capture = 1; return; }
      if (photo.on) return;
      if (boxes?.busy?.()) { if (name === 'confirm') { boxes.dismiss(); return; } if (name === 'back') { boxes.skip(); return; } }
      if (combat?.restartOpen) { if (name === 'confirm') combat.restart(); return; }
      // R3: lock on to a foe, then the next, then let go, and nothing else; with none in reach the camera turns behind you
      // (main.js, issue #512)
      if ((name === 'lock' || name === 'l3') && level.jump && !pinned) { level.jump(name === 'lock' ? 1 : -1); return; }   // (the Lab: R3 / L3 hop to the next / previous world's room, as main.js)
      if (name === 'lock' && !pinned && !(shipOn && ship.playing)) { if (!combat?.lock() && !trials?.running) { rig.recentre?.(player.heading); combat?.recentred?.(); } return; }
      // D-pad →: Plumb finds the objective, on foot and riding (a guardian's fight, a makers' house: a hint), as main.js and Q
      if (name === 'scout' && !pinned && !talking() && !(shipOn && ship.playing) && scout && !trials?.running) { scoutHint?.pinged(); if (!plumbStep.press()) scout.ping?.(); return; }   // (Plumb's talk first: issue #543)
      if (name === 'potion' && combat && !pinned && !talking() && !(shipOn && ship.playing)) { combat.drink(); return; }
      // D-pad ↓ (the mount's call: there is none in the Arena): its list of foes, as main.js's quickMenu
      if (name === 'call' && foeList && !pinned && !talking()) { menus.openFoes(foeList); return; }
      if (name === 'call' && arcadeBoard && !pinned && !talking()) { arcadeBoard.toggle(true); return; }   // (the Arcade's board, the same)
      // D-pad ↓ everywhere else: call the mount (Lorn's skiff, the bike from your pack, the bird) or hail a taxi, as
      // main.js does (issue #515: the engines never routed it, so the pad could not call the boat in Unity)
      if (name === 'call' && !pinned && !talking() && !(shipOn && ship.playing)) { player.callMount(); return; }
      // Menu / Start: the Start menu; View / Select: the game menu (main.js: settingsMenu, journal), from play or a conversation
      if (menus && !pinned && (name === 'settings' || name === 'start')) { game.save(); menus.show('start'); return; }
      if (menus && !pinned && (name === 'journal' || name === 'select')) { menus.show('game'); return; }
      if (name === 'zoomOut' || name === 'zoomIn') rig.dist = THREE.MathUtils.clamp(rig.dist * Math.exp((name === 'zoomOut' ? 1 : -1) * dt), 4, 60);
      const d = dialogue();
      if (!d?.open) return;
      if (name === 'back') d.close();
      if (name === 'confirm') {
        const c = screen.state.dialogue?.choices ?? [];
        if (c.length && screen.state.dialogue.done) d.choose(c[Math.min(talk.sel, c.length - 1)].index); else d.next();
        talk.sel = 0;
      }
    },
    navigate: (x, y) => {
      if (menus?.open) { menus.navigate(x, y); return; }
      const n = screen.state.dialogue?.choices?.length ?? 0; if (n) talk.sel = Math.max(0, Math.min(n - 1, talk.sel + y));
    },
    scroll: () => {},
    activity: () => inputMode.pad(),
    // (the gadget wheel open: the right stick chooses, the camera holds; src/gadgets/index.js wheelStick)
    stickTaken: () => !!gadgets?.wheelOn,
    // (where the printed letters are: a Retroid's Nintendo letters, reported by letter, moved to positions; native-pad.js)
    faces: () => padFaces(),
    // (the game menu's Map reads the left stick and the triggers itself: its cursor and zoom, engine/menus.js analog)
    menuAnalog: (a, dt) => !!menus?.open && !!menus.analog?.(a, dt),
    // (a foe near: LB blocks rather than zooms, the right stick only looks)
    combat: () => !!combat?.near(20),
  });
  if (combat) combat.padLook = () => controller.held?.lookStick ?? null;
  // (any look counts as the camera learnt: the first steps' line never said then, main.js's rig.look)
  if (firstSteps) { const look0 = rig.look.bind(rig); rig.look = (dx, dy) => { if (dx || dy) firstSteps.looked(); look0(dx, dy); }; }
  /** Plumb, each frame after the scout (main.js updatePlumb): the first person near, the lost watch, its line and ping. */
  function updatePlumb(dt, busy) {
    const now = performance.now();
    const canSpeak = !busy && !photo.on && !(shipOn && (ship.playing || ship.inside)) && !player.dead && !cue.text && !noticeBusy() && now >= scoutSaid.until && now >= droneSaid.until;
    const fight = !!combat?.foes?.lock || !!guardianHint(level.temple) || !!trials?.running;
    const said = plumbStep(dt, { canSpeak, fight });
    if (!said) return;
    droneSaid.text = said; droneSaid.until = now + 3200;
    sound.drone?.('go');
  }

  const noInput = {};
  let eWasDown = false, qWasDown = false;
  // the HUD's state, as main.js draws it (src/platform.js screen): the cue line, the floating prompt,
  // the toasts, the health bar and the stamina wheel
  const cue = new Cue(), placeName = new PlaceName();
  const breath = new BreathMeter(null);   // (the screen's 'breath' part only: BridgeHud.cs DrawBreath, issue #430)
  const rideHint = { kind: null, at: 0 };
  let stShown = 0;
  const _w = new THREE.Vector3();
  function hud(dt, busy) {
    const nowMs = performance.now();
    if (player.ride) { if (rideHint.kind !== player.ride.kind) { rideHint.kind = player.ride.kind; rideHint.at = nowMs; } } else rideHint.kind = null;
    const pad = padInHand();
    const quiet = busy || player.dead || !!pinned;
    // the breath meter, under the same rule as main.js's (src/water.js breathShown)
    breath.update(player.breath ?? 1, !pinned && breathShown(player, level, busy));
    const text = cueText({ quiet, ride: player.ride?.kind ?? null, rideFor: nowMs - rideHint.at, prompt: story?.prompt, promptAt: story?.promptAt, boarding: player.boarding, controller: pad,
      shipHint: shipOn && !ship.promptTag() ? ship.hud() : null, shipPlaying: shipOn && ship.playing });
    const place = quiet || (shipOn && ship.playing) ? '' : placeName.update(atmo?.name, nowMs);
    // (Plumb's line, then what the scout found, then a lesson: the first steps' and the scout's button's, as main.js updateHud)
    const said = !quiet && nowMs < droneSaid.until ? droneSaid.text : '';
    const found = said || (!quiet && nowMs < scoutSaid.until ? (typeof scoutSaid.text === 'function' ? scoutSaid.text() : scoutSaid.text) : '');
    let teach = '';
    const scenePlaying = shipOn && (ship.playing || ship.inside);
    if (firstSteps) {
      if (player._jumped) firstSteps.jumped();
      const moved = Number.isFinite(firstStepsAt.x) ? Math.hypot(player.pos.x - firstStepsAt.x, player.pos.z - firstStepsAt.z) : 0;
      firstStepsAt.copy(player.pos);
      const open = !quiet && !scenePlaying && !player.ride && !tool?.aiming && !found && !text && !place && !noticeBusy() && gameState.flag('prologue.done') && !gameState.flag('item.backpack');
      teach = firstSteps.update(Math.min(0.1, dt), { active: open, moved: moved < 5 ? moved : 0 });
      if (quiet || (shipOn && ship.playing)) teach = '';
    }
    if (scoutTeach.left > 0 && !teach && !found && !text && !place && !quiet && !(shipOn && ship.playing)) { teach = scoutTeach.line(); scoutTeach.left -= Math.min(0.1, dt); }
    cue.set(ship?.cinema.hasSpeech() || toasts.left > 0 ? '' : found || text || place, said ? '' : found ? scoutSaid.kind : text || !place ? '' : 'place');
    // (aboard, the ship's E floats by what it is for, the prologue's voicemail button too: src/ship/ship.js promptTag, issue #350)
    const sceneTag = story && shipOn && ship.playing && !pinned ? ship.promptTag() : null;
    if (sceneTag) { story.prompt = sceneTag.text; story.promptAt = sceneTag.at; story.promptEntry = null; story.placePrompt?.(camera, pad); }
    else if (story && !busy && !pinned && !(shipOn && ship.playing)) story.placePrompt?.(camera, pad); else screen.set('prompt', null);
    // toasts: the next once the last has been read
    toasts.left -= dt;
    // the end of the road (main.js's closing page): every world's story told and every small thing kept, its words said
    // as lines here, once (the journal's `completed`), when nothing else is on
    if ((roadT -= dt) <= 0) {
      roadT = 1;
      if (!flags && !view && !gameDef && !journal.data.completed && !busy && !(shipOn && ship.playing)
        && roadDone({ order: ORDER, storyDone: (id) => journal.storyDone(id), relicCount: (id) => journal.relicCount(id), relics: (id) => CONTENT[id]?.relics?.names?.length ?? 0 })) {
        journal.data.completed = Date.now(); journal.save();
        sound.chime?.();
        const n = ORDER.reduce((k, id) => k + (CONTENT[id]?.relics?.names?.length ?? 0), 0);
        toast(`${ROAD.title} · ${ROAD.kept(n)}`); toast(`${ROAD.full} ${ROAD.home}`);
      }
    }
    // (a fixed view's picture has no notices over it, as the web's side-by-sides hide the page's: scripts/unity-compare/)
    if (screen.state.dialogue && toasts.left > 0) {
      if (screen.state.toast?.text) toasts.queue.unshift(screen.state.toast.text);
      toasts.left = 0; screen.set('toast', null);
    }
    if (pinned) screen.set('toast', null);
    else if (toasts.left <= 0 && toasts.queue.length && !busy && !screen.state.sub && !screen.state.cue && !screen.state.dialogue) { const t = toasts.queue.shift(), secs = toastSeconds(t); screen.toast(t, secs); toasts.left = secs; }
    if (toasts.left <= 0) screen.set('toast', null);
    if (ship?.cinema) ship.cinema._externalToast = toasts.left > 0;
    // (the hearts, the potions and the wallet, as main.js updateHealth: src/host/game-host.js wireHealth; shown while
    // fighting, a while after a hurt, a drink or a chime, the wallet's count ticking up)
    screen.set('health', health.frame(dt, { player, fighting: !!combat?.foes.fighting, quiet: !!pinned || (shipOn && ship.playing) }).hp);
    // the key counter while in a temple (issue #274: as main.js updateKeys; BridgeHud.cs draws it)
    const keyT = (level.temples ?? (level.temple ? [level.temple] : [])).find((t) => t.keyCount && Object.values(t.def?.logic?.elements ?? {}).some((e) => e.type === 'key') && t.inside(player.pos));
    const keyN = keyT?.keyCount();
    screen.set('keys', keysHud({ inside: !!keyT, small: keyN?.small ?? 0, big: keyN?.big ?? false, quiet: !!pinned || busy || sceneHolds(screen.state) }));   // (under a scene's letterbox: issue #501)
    // the guardian's bar while it is awake and you are in its temple (src/temples/runtime.js meterHud, a page's element on the
    // web: its name, its health or unrest, full at the start; BridgeHud.cs DrawGuardian), not while talking
    const gT = (level.temples ?? []).find((t) => t.guardian?.awake && t.inside?.(player.pos));
    const gBar = gT && !pinned && !player.dead && !talking() ? guardianBar(gT.guardian.def, gT.guardian.meter) : null;
    screen.set('guardian', gBar && { ...gBar, fill: Math.round(gBar.fill * 100) / 100 });
    const k = Math.min(Math.max(player.stamina ?? 1, 0), 1);
    stShown = k < 0.995 || player.winded ? 0.9 : Math.max(0, stShown - dt);
    const st = staminaHud({ stamina: k, winded: player.winded, quiet: quiet || !!player.ride || !!player.down }, stShown);
    _w.setFromMatrixColumn(camera.matrixWorld, 0);
    screen.set('stamina', st && { ...st, at: _w.multiplyScalar(0.62).add(player.object?.position ?? player.pos).addScaledVector(player.frame.up, 1.75).toArray().map((v) => +v.toFixed(2)) });
    screen.set('choice', talking() ? talk.sel : null);
    // the Arena's FOES tab on the left edge, saying how to open its list (src/foe-spawner.js addTab)
    screen.set('foeTab', foeList && !quiet ? { text: 'FOES ▸', key: pad ? 'D-pad ↓' : 'K' } : null);
  }
  // who casts a shadow (main.js renderFrame, shadows.js): everything but the level's noShadow list, the
  // traveller's gear's, and what lights itself
  const noShadow = new Set();
  for (const r of [...(level.noShadow ?? []), ...(player.gear?.noShadow ?? [])]) r?.traverse?.((o) => noShadow.add(o));
  const castsShadow = (o) => !noShadow.has(o) && !selfLitSkips(o);
  // the see-through surfaces' bodies (src/veil.js: the City-Shaft's air pillars, Lorn II's mushrooms, the shafts of
  // light): on the page a scene of washes laid over the finished picture; here that scene hangs in the mirrored one (the
  // washes' matrices are world ones, its own the identity), each wash shown while its mesh is, as Veils.render does, and
  // drawn by the engine over its ink (Unity: Hiraeth/Veil, port-format.js). (level.veils may come later: a temple's, the
  // buried city's.)
  const veilsFrame = () => {
    const V = level.veils;
    if (!V?.scene) return;
    if (V.scene.parent !== scene) scene.add(V.scene);
    V.show();
  };
  const mirror = new SceneMirror(backend, { castsShadow, quietWalk: !!backend.quietWalk, listMatrices: !!backend.listMatrices, stillMatrices: !!backend.stillMatrices, skipHidden: !!backend.skipHidden, noticed: !!backend.noticed });
  // a conversation's portrait (src/story/index.js portrait, main.js captureView with keep): the engine draws the kept
  // objects alone against the backdrop, from eye toward look; the panel shows it by the name returned
  let portraits = 0;
  function portraitCapture(eye, look, w, h, o = {}) {
    if (!o.keep) return null;
    const ids = [];
    for (const k of o.keep) k?.traverse?.((x) => { if (x.visible !== false) { const id = mirror.idOf(x); if (id) ids.push(id); } });
    if (!ids.length) return null;
    const n = ++portraits;
    // (css: the chip as BridgeHud draws it, 84 px of its 1280 × 720 canvas; the page's own size means nothing here)
    backend.portrait(n, { eye: eye.toArray(), look: look.toArray(), up: player.frame.up.toArray(), fov: o.fov ?? 36, ids, backdrop: o.backdrop ?? null, size: w, css: 84 });
    return `engine:portrait:${n}`;
  }
  // the Wardrobe's traveller (src/wardrobe.js, main.js wardrobeFrame): him and the sword beside him alone against the
  // paper, from the turntable's angle, drawn by the engine into the page's picture each frame the page shows
  function wardrobeCapture(shot) {
    const ids = [];
    for (const k of wardrobe.keep()) k?.traverse?.((x) => { if (x.visible !== false) { const id = mirror.idOf(x); if (id) ids.push(id); } });
    if (ids.length) backend.wardrobe?.({ eye: shot.eye.toArray(), look: shot.look.toArray(), up: player.frame.up.toArray(), fov: shot.fov, ids, backdrop: WARDROBE_BACKDROP });
  }
  let simT = 0, frames = 0, saveIn = 10;
  // the game menu's Map (main.js mapSource, src/world-map.js): the marks over the world's rectangle (as wide as the
  // engine's sheet for it, issue #272), and its ground drawn as the web draws it, the world's collision sampled straight
  // down a few milliseconds a frame while the Map is open (WorldMap.pump), then drawn by drawTerrain into a picture of its
  // own (engine/raster.js PixelCanvas, MAP.size its short side, smoothed as the page's canvas is), which the engine shows
  // (game.mapPicture(key): the Unity bridge's BridgeHost.MapImage); zoomed in, a part of it drawn again sharper (detail)
  let mapWhole = null, mapPics = 0;
  const pictures = new Map();   // key → the drawn ground (those WorldMap still keeps)
  const worldMap = new WorldMap({
    size: MAP.size,
    canvas: () => { const c = new PixelCanvas(1); c.key = `map${++mapPics}`; pictures.set(c.key, c); return c; },
    sample: (x, z) => {
      const h = physics.groundAt(x, mapWhole.top, z, MAP.drop);
      const w = Number.isFinite(h) ? waters?.surfaceAt?.(x, z, h, 1) : null;
      return { h, water: w && !w.body?.sea && w.y > h + 0.15 ? w.y : null };
    },
  });
  worldMap.onReady = () => {
    // (the pictures WorldMap has let go of let go here too: a zoom's part each, a few MB apiece)
    const kept = new Set([...worldMap.maps.values()].map((m) => m.canvas?.key).filter(Boolean));
    for (const k of pictures.keys()) if (!kept.has(k)) pictures.delete(k);
    menus?.changed?.();
  };
  // (inside a shop's or a temple's room, built far from the ground: at its door on the map, as main.js mapAt. Without it
  // the people and boxes in those rooms framed the map kilometres wide and lifted its rays over the ground: the Signal
  // Market's Map was a plain sheet in Unity, issue #264)
  const mapAt = (p) => {
    const room = interiorAt(p);
    if (room?.door?.at) return room.door.at;
    for (const t of level.temples ?? []) {
      const a = t.arrival?.pos, d = t.outside?.door?.at;
      if (a && d && Math.abs(a.y - d.y) > 300 && Math.abs(p.y - a.y) < 300) return d;
    }
    return p;
  };
  const temples = () => (level.temples ?? []).filter((t) => t.outside?.door?.at).map((t) => ({ id: t.id, name: t.def?.name, x: t.outside.door.at.x, z: t.outside.door.at.z, y: t.outside.door.at.y }));
  const xz = (p) => ({ x: p.x, z: p.z });
  function mapSource({ zoom = null, detail = null, aspect = 1 } = {}) {
    if (!mapWhole || mapWhole.aspect !== aspect) {
      const pts = mapWhole?.pts ?? [level.spawn, level.ship?.pos, ...temples(), ...npcs.map((n) => n.pos && mapAt(n.pos)), ...(boxes?.list ?? []).map((b) => b.pos && mapAt(b.pos)), mapAt(player.pos)].filter(Boolean).map((p) => ({ x: p.x, y: p.y, z: p.z }));
      mapWhole = { bounds: mapBounds(pts, { limit: level.limit ?? Infinity, aspect }), pts, aspect, top: mapWhole?.top ?? Math.max(...pts.map((p) => p.y ?? 0).filter(Number.isFinite)) + MAP.up };
    }
    const dir = player.frame.dir(player.heading, new THREE.Vector3());
    const goal = nextObjective({ player, story: null, ship: level.ship, level: { navigationPortals: [] }, quest: () => story?.objective?.() });
    // (the people with a quest waiting for their talk: issue #273, as main.js mapSource)
    const givers = (story?.quests?.giverMarks?.() ?? []).map((g) => ({ id: g.person, name: npcs.find((n) => n.def?.id === g.person)?.def?.name ?? null, label: g.label, ...xz(mapAt(g.position)) }));
    const you = mapAt(player.pos);
    const raw = {
      you: { x: you.x, z: you.z, dx: dir.x, dz: dir.z },
      ship: level.ship?.pos && levelId !== 'home' ? mapAt(level.ship.pos) : null,
      goal: goal?.position ? { ...xz(mapAt(goal.position)), label: goal.label } : null,
      // (the other quests under way, at their steps: issue #244, the marks of kind 'quest')
      quests: (story?.quests?.objectives?.() ?? []).filter((q) => !q.tracked && q.position).map((q) => ({ id: q.quest, title: q.title, label: q.label, ...xz(mapAt(q.position)) })),
      givers,
      temples: temples(),
      people: npcs.filter((n) => n.def?.id && n.pos && gameState.flag(`met.${n.def.id}`) && !givers.some((g) => g.id === n.def.id)).map((n) => ({ id: n.def.id, name: n.def.name ?? n.def.id, ...xz(mapAt(n.pos)) })),
      boxes: (boxes?.list ?? []).filter((b) => b.opened?.()).map((b) => ({ id: b.id, name: ITEMS[b.item]?.name ? `${ITEMS[b.item].name}’s box` : null, ...xz(mapAt(b.pos)) })),
      // (the rumours told and not found yet, as main.js mapSource: issue #340)
      rumours: story?.rumours?.marks?.() ?? [],
      // (Anselm's chart, bought: every fragment still to find here, as main.js mapSource: issue #520)
      fragments: chartMarks(fragments, gameState),
    };
    const whole = mapWhole.bounds;
    // (a mark zoomed on: a third of the whole map round it, its own ground drawn, as main.js mapSource)
    const focus = zoom && mapMarks({ ...raw, bounds: whole }).find((m) => m.id === zoom);
    const bounds = focus ? zoomBounds(whole, { x: whole.x0 + focus.u * whole.w, z: whole.z0 + focus.v * whole.h }) : whole;
    const v = worldMap.view(bounds, focus ? MAP.zoomCells : MAP.cells);
    // (the Map zoomed in round its cursor: a part of it drawn again sharper once the whole is in, { u0, v0, s } of the whole)
    let part = null;
    if (detail && v.done && !focus) {
      const d = worldMap.view({ x0: whole.x0 + detail.u0 * whole.w, z0: whole.z0 + detail.v0 * whole.h, w: detail.s * whole.w, h: detail.s * whole.h }, MAP.zoomCells);
      part = { ...detail, canvas: d.canvas, done: d.done, progress: d.progress };
    }
    // (the note: the givers', and the fragments found here once the first is found, as main.js mapSource; issue #264)
    const frag = fragments?.counts?.(), here = frag?.worlds?.[levelId];
    return { world: TITLES[levelId] ?? level.title ?? '', marks: mapMarks({ ...raw, bounds }), canvas: v.canvas, progress: v.progress, zoom: focus ? zoom : null,
      scale: scaleBar(bounds.w), span: bounds.w, aspect: bounds.w / bounds.h, detail: part,
      note: [givers.length ? GIVERS_NOTE : '', frag?.found && here?.total ? tr('gm.fragHereLong', { n: here.found }) : ''].filter(Boolean).join(' · ') };
  }
  /** The Map's ground being drawn: its rays for `ms` this frame (the Map open), as main.js pausedFrame does. */
  function pumpMap(ms = MAP.budget) {
    const gm = physics.groundMover, gk = physics.groundKind;
    try { worldMap.pump(ms); } finally { physics.groundMover = gm; physics.groundKind = gk; }
    return !!worldMap.want && !worldMap.want.drawn;
  }
  let mapTick = 0;
  // a fixed view (the side-by-sides and the benchmark's viewpoints): the camera pinned there
  let pinned = view ? pin(view) : null;
  if (view && waterBed) bakeAround();
  let smallCull = null;
  function pin(v) {
    const eye = new THREE.Vector3(...v.eye), target = new THREE.Vector3(...v.target);
    // the traveller where the view says (scripts/bench/web-page.mjs __benchPlace does the same on the web)
    if (v.player) { player.teleport(new THREE.Vector3(...v.player), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); player.heading = v.heading ?? player.heading; }
    // (a view's hour and weather pinned, as the web's side does: scripts/bench/web-page.mjs conditions, scripts/unity-compare/)
    if (Number.isFinite(v.hour)) sky.hour = v.hour;
    if (v.weather && weather) { weather.mode = v.weather; if (v.weather === 'clear') weather.intensity = 0; }
    // (a view's `gait`: the traveller held in that gait at that phase, as the web's side holds him: engine/gait-hold.js)
    if (v.gait) holdGait(player, v.gait); else releaseGait(player);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, target, new THREE.Vector3(0, 1, 0)));
    // (a view with no place for the traveller leaves him out of the picture, as web-shots.mjs does)
    return { eye, q, fov: v.fov ?? 55, hidePlayer: v.hidePlayer ?? !v.player };
  }
  // a fixed view's water beds baked at once (the web's side bakes them in the seconds it waits before its picture; a
  // batch's settle is a few quick frames): every map round the traveller that is stale, nearest first (issue #502)
  function bakeAround() {
    for (let k = 0; k <= waters.bodies.length && waters.bakeStep(player.pos, Infinity); k++);
  }
  start = shipResume(start, ship);
  // where the traveller starts when the engine plays (not a bench's views): the save's place in this world (main.js
  // "continue where you left off"), else at the foot of the ship's ramp, as arriving by ship (ship.arrivalSpot). A
  // plan (-idle, -tour, -walk, -play) starts at the level's spawn, as the web's ?level= does: the ship has already moved
  // a spawn it covers to the foot of its ramp (Ship.clearSpawn, issue #254: the desert's), so no plan starts under or
  // inside it (tests/bench-start.test.js). `hullSpawn` (the bridge's -hull-spawn) puts him back on the spot the ship
  // covers, as the plans started before #254, to compare with numbers taken then (issue #265).
  if (hullSpawn && level.coveredSpawn) {
    const c = level.coveredSpawn;
    player.respawn(c.pos.clone());
    player.heading = c.heading;
    rig.yaw = c.camYaw ?? c.heading + Math.PI;
  } else if (arrival && level.arrivals?.[arrival] && via !== 'ship' && !gameDef) {
    // (come by a page load's way, the night train's: at the level's arrival from that place, as main.js's ?from=)
    const a = level.arrivals[arrival];
    player.respawn(a.pos.clone());
    player.heading = a.heading;
    rig.yaw = a.heading + Math.PI;
  } else if (start?.pos && start.level === levelId && !level.keepSpawn) {
    const p = new THREE.Vector3(...start.pos);
    { const moved = level.settleSaved?.(p, physics); if (moved) p.copy(moved); }
    player.respawn(p);
    if (start.up && start.fwd) player.frame.set(new THREE.Vector3(...start.up), new THREE.Vector3(...start.fwd));
    player.heading = start.heading ?? player.heading;
    rig.yaw = start.yaw ?? player.heading + Math.PI;
    // (issue #375, as main.js) a save left inside a temple, past a gadget gate it can't cross back: the house sees to it
    // on its first frame (src/temples/runtime.js unstrand)
    for (const rt of [...(level.temples ?? []), level.temple].filter(Boolean)) rt.loaded = true;
  } else if (arrive && ship?.arrivalSpot) {
    const a = ship.arrivalSpot();
    player.respawn(a.pos);
    player.heading = a.heading;
    rig.yaw = a.heading + Math.PI;
  }
  // (`aboard`: in that room of the parked ship, as the web's ?aboard=cockpit | main | cabin | hold, main.js; the bridge's
  // -aboard: a picture of each room beside the web's)
  // ('console': at the voicemail behind the console's tail, as the ship's own walk to it puts him)
  const goAboard = (room) => {
    const m = ship?.parked, P = m?.interior?.points;
    const spot = via === 'ship' ? null : room === 'console' && P?.cockpit ? { pos: ship.world(m, P.cockpit), heading: ship.worldHeading(m, P.cockpitHeading) } : ship?.roomSpot?.(room);
    if (!spot) return false;
    player.respawn(spot.pos); player.heading = spot.heading; rig.yaw = spot.heading + Math.PI;
    return true;
  };
  if (aboard) goAboard(aboard);
  // the distant detail near where the first frame looks from, the ship and the ways through: now (main.js "near detail")
  if (queues.some((q) => q.pending)) {
    const t = performance.now();
    const ways = [...(level.portals ?? []), ...(level.navigationPortals ?? [])].map((p) => p.to).filter(Boolean);
    let n = 0;
    for (const q of queues) n += runSteps(q.needSteps([player.pos, ship?.rampFoot, ...ways].filter(Boolean), DEFER.near));
    const L = physics.late;
    log(`distant detail: ${n} jobs done near in ${Math.round(performance.now() - t)} ms, ${queues.reduce((s, q) => s + q.pending, 0)} after the first frame${L ? ` (the drifts' collision: ${L.made} pieces made, ${L.forced} by a query, in ${Math.round(L.ms)} ms; ${L.pending} after)` : ''}${crowd?.pending ? `; ${crowd.pending} walks still to come` : ''}`);
  }
  stamp('near detail'); stage('mixing the inks…'); step('batches');
  // the first frame's camera (a game that drives: its own, which its session set as it was made; main.js never runs the
  // rig for it, so the start card shows the game's view: the cistern court from above, not the traveller's follow camera)
  if (!trials?.drives) rig.update(player.pos, 0, player.frame);

  // the dev menu (src/dev-menu.js, issue #387): its tabs and acts are the page's, engine/menus.js draws them (BridgeMenu's
  // game sheet); here what its world rows do: a teleport, god mode, the frame readout, the potions, the hearts, the jets,
  // a quest's stage, the hour. (The page's own rows are left out: films, the Notes screenshot, the hitbox overlay, the
  // input display, the Debug menu, the Motion page, a reload, the sky's clock, which the engines' sky does not run.)
  const devTeleport = (point) => {
    const spot = landingSpot(physics, point, { portals: level.portals ?? [], killY: level.killY ?? -Infinity });
    if (!spot.ok) { toast(`Nothing to stand on near ${point.label}.`); return false; }
    if (player.ride) player.dismount(true);
    if (player.dead) player.restart?.();
    const to = new THREE.Vector3(...spot.pos), heading = spot.heading ?? player.heading;
    const up = level.gravityAt?.(to)?.clone?.() ?? new THREE.Vector3(0, 1, 0);
    const land = () => { portalCool = 2; player.vel.set(0, 0, 0); player.lastSafe?.copy(to); };   // (no doorway takes you on at once)
    portalCool = 3;
    if (!passage.go({ to, heading, up, speed: 0, onMove: land })) { player.teleport(to, up, new THREE.Vector3(0, 0, 1)); player.heading = heading; land(); }
    sound.page?.();
    toast(`To ${point.label}.`);
    return true;
  };
  /** God mode on or off (src/player.js GOD); off, set down on the ground under you (src/world-debug.js godLanding), as main.js. */
  const setGod = (on) => {
    if (on) { if (player.ride) player.dismount(true); player.setGod(true); toast('God mode: the stick flies, RT / R2 up, LT / L2 down, L3 boost. Nothing hurts.'); return; }
    player.setGod(false);
    const s = godLanding(physics, player.pos, { portals: level.portals ?? [], killY: level.killY ?? -Infinity });
    const to = s.ok ? new THREE.Vector3(...s.pos) : player.lastSafe.clone(), heading = player.heading;
    player.teleport(to, player.frame.up.clone(), player.frame.fwd.clone());
    player.heading = heading; portalCool = 2;
    toast(s.ok ? 'God mode off: on the ground below.' : 'God mode off: back where you last stood.');
  };
  const devAct = (a) => {
    if (a.do === 'tp') { menus.close(); devTeleport(a.point); }
    else if (a.do === 'toggle') {
      if (a.key === 'soundSources') void sound.sfxTrace?.enable?.(!sound.sfxTrace.enabled);
      else if (a.key === 'fps') { settings?.set?.('showFps', !settings.showFps); menus.onSetting?.('showFps'); }
      else if (a.key === 'god') setGod(!player.god);
      else if (a.key === 'potions') resources.setPotionsInfinite(!resources.potions.infinite);
      else if (a.key === 'jets') { if (gear.has('jetpack')) gear.revoke('jetpack'); else { if (!gear.has('backpack')) gear.grant('backpack'); gear.grant('jetpack'); } }
    }
    else if (a.do === 'heal') { player.restore(player.maxHearts); toast('Every heart back.'); }
    else if (a.do === 'hour') { sky.hour = a.h; updateSky(); }
    else if (a.do === 'quest' && story?.quests) {
      try { applyQuestJump(story.quests, gameState, a.id, a.stage); toast(`${story.quests.def(a.id)?.title ?? a.id}: set to ${a.stage}.`); } catch (err) { toast(`Could not set it: ${err.message}`); }
    }
  };
  const devMenu = menus?.openDev && !flags && !view && !gameDef ? new DevMenu({ levelId, levels: LEVELS, boxes, quests: story?.quests ?? null, story, game: gameState, doc: null,
    caps: new Set(['quest']),
    onTravel: (id) => { menus.close(); onTravel?.(id); },
    world: () => ({
      world: meta.title,
      ship: { active: caravan ? 'caravan' : 'original', selected: shipSetting.get('') },
      points: gatherPoints({ levelId, level, quests: story?.quests ?? null, npcs, boxes, relics, ship, content, games: GAMES }),
      quests: story?.quests ? questList(story.quests, levelId) : [],
      toggles: { soundSources: !!sound.sfxTrace?.enabled, fps: !!settings?.showFps, god: !!player.god, potions: !!resources.potions.infinite, jets: gear.has('jetpack') },
      save: slots.active === DEBUG_SLOT ? 'the debug save' : `save ${slots.active}`,
    }),
    onAct: (a) => devAct(a),
    onToggle: (on) => { if (!on && menus.mode === 'dev') menus.close(); } }) : null;
  /** L3 + R3, F2 or `: the dev menu over the world (not in a conversation, a ship's scene or a run). */
  function openDev() {
    if (!devMenu || menus.open || pinned || talking() || (shipOn && ship.playing) || trials?.running) return false;
    if (photo.on) setPhoto(false);
    return menus.openDev(devMenu);
  }

  const lookOut = {};
  const SEC = { ms: {}, frames: 0 };
  const game = {
    scene, camera, player, rig, level, physics, deferred, floraLater, npcs, crowd, story, storyPage, relics, ship, mirror, folk, kit, dangers, chemistry, benches, hoverTrails, edge, boxes, fragments, gadgets, itemFx, grass, wind, sky, post, T, wildlife, weather, shelter, tool, scout, sound, expedition, plumb, firstSteps, setLanternSky, flora, reactiveWorld, flammables,
    /** The sound's AudioContext (engine/webaudio.js): ctx.render(frames) → the next stereo PCM, or null without sound. */
    get audio() { return sound.ctx ?? null; },
    /** The Start menu's line of the fragments of the singing light (src/host/game-host.js fragmentsLine), as the page's. */
    fragmentsLine: () => fragmentsLine({ fragments, game: gameState, items: gear, levelId }),
    /** The wallet's chimes (src/resources.js), as the health HUD shows them while it is up. */
    get chimes() { return resources.chimes; },
    key(code, down) {
      if (down) tapped.add(code);
      const was = keys[code];
      keys[code] = down;
      if (down && !was && code !== 'Escape') inputMode.event({ type: 'keydown', code, isTrusted: true });
      // (a box opening, as main.js's keys: Esc skips, E, Enter or Space on the card goes on)
      if (down && !was && !menus?.open && boxes?.busy?.()) {
        if (code === 'Escape') boxes.skip();
        else if (code === 'KeyE' || code === 'Enter' || code === 'NumpadEnter' || code === 'Space') boxes.dismiss();
      }
      // (knocked out: Enter, Space or E gets him up; Tab locks on, as the page's keys)
      if (down && !was && !menus?.open && !photo.on && combat) {
        if (combat.restartOpen && (code === 'Enter' || code === 'NumpadEnter' || code === 'Space' || code === 'KeyE')) { combat.restart(); return; }
        if (code === 'Tab' && !pinned && !boxes?.busy?.() && !(shipOn && ship.playing)) combat.lock();
        // (K: the Arena's list of foes, as its page's key)
        if (code === 'KeyK' && foeList && !pinned && !talking() && !boxes?.busy?.()) menus.openFoes(foeList);
      }
      // (Tab: the Arcade's board, as its page's key)
      if (down && !was && !menus?.open && code === 'Tab' && arcadeBoard && !pinned && !talking() && !boxes?.busy?.()) arcadeBoard.toggle(true);
      // (the dev menu: F2 or `, as the page's; the menu's own keys close it again, engine/menus.js)
      if (down && !was && !menus?.open && (code === 'F2' || code === 'Backquote')) openDev();
      // (photo mode from the keyboard, as the page's: P in and out, Enter saves, Esc leaves)
      if (down && !was && !menus?.open && !trials?.running) {
        if (code === 'KeyP') setPhoto(!photo.on);
        else if (photo.on && (code === 'Enter' || code === 'NumpadEnter') && !photo.capture) photo.capture = 1;
        else if (photo.on && code === 'Escape') setPhoto(false);
      }
      // and as the page's events, for the modules that listen to the window (a conversation's E, Space, 1–9, Escape)
      if (down !== was) page.dispatch(down ? 'keydown' : 'keyup', { code, key: /^Digit\d$/.test(code) ? code.slice(5) : code === 'Space' ? ' ' : code, repeat: false });
    },
    /** What the screen shows (src/platform.js screen): the engine draws it when `version` moves. */
    screen: () => screen,
    /** A pointer delta (pixels), as the mouse turns the camera on the page. */
    look(dx, dy) { rig.look(dx, dy); },
    /**
     * A pointer pressed (issue #570; the Unity bridge's mouse or finger, BridgeHost.Pointer): { kind: 'mouse' | 'touch', x, y
     * (the HUD's px from its top left), w (the HUD's width), button (0 the main one) }. What is in hand follows it, as the
     * page's pointerdown (src/input-mode.js); a main press on one of the HUD's own buttons as drawn (the screen's 'buttons',
     * src/hud-buttons.js; not over a menu, which takes no pointer) does what the page's click does. True when a button took
     * it; anywhere else it is left alone (the camera's right button, the world).
     */
    pointer({ kind = 'mouse', x, y, w, button = 0 } = {}) {
      const hit = button === 0 && !menus?.open ? hitHudButton(screen.state.buttons, x, y, w) : null;
      inputMode.event({ type: 'pointerdown', pointerType: kind === 'touch' ? 'touch' : 'mouse' });
      return hit ? pressHudButton(hit, { trials }) : false;
    },
    // (a pinned view holds a makers' house's lights at their reach as built, as the web's capture does: their flicker's phase
    // is each side's own clock, and moved a room's pool of light a size either side, issue #264)
    pin(v) { pinned = v ? pin(v) : null; if (v && waterBed) bakeAround(); if (houseAir) houseAir.still = !!v; },
    /** The water's pass over the page this frame (src/water.js Waters.overState: the tint and haze under water, the sun's
     * sparkle above it), plain numbers in three's space; under -1 when it draws nothing; lite: the preset has no sparkle. */
    waterOver() { const s = waters.overState(camera), lite = waterShared.uWaterLite.value; return s ? { ...s, lite } : { under: -1, lite }; },
    /** The frame's look: the sun and the preset's uniforms (LOOK_KEYS) as plain numbers. */
    lookParams() {
      for (const k of LOOK_KEYS) { const u = U[k] ?? sharedUniforms[k]; if (u) lookOut[k] = plainValue(u.value); }
      lookOut.uSunDir = sharedUniforms.uSunDir.value.toArray();
      lookOut.hour = sky.hour;
      return lookOut;
    },
    /** The look with every number of the preset and the shared uniforms (the C# port's look format: unity/port-format.js portLook). */
    fullLook() {
      // (numbers, and the look's few vectors: the spot blacks, the haze by depth and height, the cast shadows lifted or inked)
      const nums = (o) => { const out = {}; for (const [k, x] of Object.entries(o)) { if (typeof x?.value === 'number') out[k] = x.value; else if (LOOK_VECTORS.has(k)) { const v = plainValue(x?.value); if (v) out[k] = v; } } return out; };
      const post = nums(U);
      // (-js-off skies: the sky's own left out, the look as the bridge sent it before them, a before-and-after on one build)
      if (!skies) for (const k of ['uEclipse', 'uCorona', 'uEclipseGlow', 'uEclipseDir', 'uLantern', 'uSpace', 'uSpaceTone', 'uSpaceSun', 'uSpaceNight']) delete post[k];
      return { ...this.lookParams(), post, shared: nums(sharedUniforms), preset: look.at.preset, planets: look.at.planets };
    },
    /**
     * The local lights the surfaces take this frame (main.js updateLights: the level's lamps, fires, eggs, pools and
     * doors, the 8 nearest the traveller within their reach + 250 m, and the jet's flame while thrusting): [x, y, z, reach].
     */
    localLights() {
      const p = player.pos, out = [];
      if (player.thrusting) out.push([p.x, p.y + 0.6, p.z, 7.5]);
      const ranked = [];
      for (const l of level.lights ?? []) {
        if (l.y < -1e4 || !(l.w > 0)) continue;
        const d = (l.x - p.x) ** 2 + (l.y - p.y) ** 2 + (l.z - p.z) ** 2;
        if (d < (l.w + 250) ** 2) ranked.push([l, d]);
      }
      ranked.sort((a, b) => a[1] - b[1]);
      for (const [l] of ranked) { if (out.length >= 8) break; out.push([l.x, l.y, l.z, l.w]); }
      return out;
    },
    /** The update's parts, ms a frame since the last call (with game.sectionsOn: the bench's -split). */
    sections() {
      const out = {}, n = Math.max(SEC.frames, 1);
      for (const [k, v] of Object.entries(SEC.ms)) out[k] = +(v / n).toFixed(3);
      SEC.ms = {}; SEC.frames = 0;
      return out;
    },
    sectionsOn: false,
    journal,
    /** A shop opened by its id ('thrum': Anselm's aboard; else a keeper's), as talking to its keeper does (-shop, a test). */
    /** The dev menu (src/dev-menu.js; null without the menus) and opening it (the bridge's -devmenu plan, L3 + R3, F2, `). */
    devMenu, openDev: () => openDev(),
    /** The Arena's list of foes opened (the bridge's -foes plan; D-pad ↓ or K in play): false where there is none. */
    openFoes() { return !!(foeList && menus?.openFoes(foeList)); },
    foeList,
    openShop(id) { if (shopPanel) shopWaiting = (id === 'thrum' ? story?.scientist?.shopEntry?.() : story?.shops?.byId?.(id)) ?? null; return !!shopWaiting; },
    /** In that room of the parked ship (cockpit, main, cabin, hold; or at the console), the camera behind him, as ?aboard= on the web; false: no such room. */
    goAboard(room) { const ok = goAboard(room); if (ok) rig.update(player.pos, 0, player.frame); return ok; },
    /** The fight (engine/combat.js), and its foes (src/foes.js), when the engine plays them. */
    combat, foes: combat?.foes ?? null,
    /** The fluid tool (src/fluid-tool.js): the gun and the blade (its sheath, its light). */
    tool,
    /** The ship attached and its scenes played (the engine played with its menus). */
    shipScenes: shipOn,
    /** The ways through to another space (src/passage.js): `active` while one carries the traveller across. */
    passage,
    /** Walked through a doorway (src/door-walk.js): `active` while the door has the controls. */
    doorWalk,
    /** A makers' box opening (Esc skips it, to its card or past it). */
    get boxPlaying() { return !!boxes?.busy?.(); },
    /** What is in hand: 'pad' or 'keys' (src/input-mode.js), which the prompts name the buttons of. */
    get inputKind() { return inputMode.kind; },
    /** This world's trials and games, and the run under way (engine/trials.js). */
    trials,
    /** A run (a trial, a game) under way: Esc and the Menu button are its pause, not the Start menu. */
    get minigameOn() { return !!trials?.running; },
    /**
     * A thing used from the game menu's Items (main.js onUse): the fragment finder on or off, a gun mode taken, a gadget
     * taken in hand.
     */
    useItem(id) {
      if (id === 'finder') { gameState.set('frag.finder.off', !gameState.flag('frag.finder.off')); return; }
      const m = { backpack: 'shoot', stun: 'stun', fire: 'fire', bloom: 'bloom' }[id];
      if (m && tool?.modes?.includes(m)) tool.setMode(m); else gadgets?.equip(id);
    },
    /** A ship's scene playing that is not his to walk through (Esc held skips it). */
    get scenePlaying() { return shipOn && ship.playing && !ship.cinematic?.interactive?.(); },
    /** Photo mode on, and turned on or off (from the Start menu's Photo mode). */
    get photoOn() { return photo.on; },
    setPhoto(on) { setPhoto(on); },
    /** Where you stand, into the active save slot (main.js writeSave); not from a bench's fixed views. */
    save() {
      // (not while a ship's scene plays: the opening's traveller stands in the ship in orbit, a take-off's in the air)
      if (!saves || flags || pinned || player.dead || player.god || (shipOn && ship.playing) || gameDef) return;   // (god mode: never saved, you would load in the air)   // (a game's page keeps the place you left the world at)
      SaveGame.write({ level: levelId, pos: player.pos.toArray(), heading: player.heading, yaw: rig.yaw, hour: sky.hour, up: player.frame.up.toArray(), fwd: player.frame.fwd.toArray(), shipModel: caravan ? 'caravan' : 'original', aboardShip: !!ship.inside });
    },
    /**
     * The game menu's panels (src/game-menu-data.js menuSources, as main.js wires them, with what the engine carries:
     * the items' pictures by id, the Map's ground drawn by its WorldMap). `travel(id)`: the Worlds page's Travel here.
     */
    menuSources({ travel = null } = {}) {
      const charge = () => chargeState({ flag: (f) => gameState.flag(f), keepsakes: gameState.keepsakes(), completed: ship?.completed?.().length ?? 0,
        failed: Object.entries(gameState.data.flags).filter(([k, v]) => k.startsWith('failed.') && v).map(([, v]) => v) });
      const seen = (w) => journal.seen(w), flag = (k) => gameState.flag(k);
      // (the wallet: the chimes, src/resources.js; the finder a switch, src/fragments.js finderOn; the gadgets owned and in hand)
      return menuSources({ items: { owned: () => Object.keys(ITEMS).filter((id) => gear.has(id)) }, wallet: () => resources.chimes,
        toggles: () => ({ finder: gear.has('finder') && !gameState.flag('frag.finder.off') }),
        quests: story?.quests ?? null, charge, keepsakes: () => gameState.keepsakes(), journal, current: levelId, game: gameState,
        levels: LEVELS.map((l) => ({ id: l.id, title: l.title, hidden: l.hidden, blurb: l.blurb, relicNames: CONTENT[l.id]?.relics?.names })),
        mode: () => ({ mode: tool?.owned ? tool.mode : null, modes: tool?.owned ? tool.modes : [], gadget: gadgets?.equipped ?? null, gadgets: gadgets?.owned?.() ?? [] }), boxes: () => boxes?.counts?.() ?? {},
        fragments: () => fragments?.counts?.() ?? null,
        errandDefs: ERRANDS, done: worldDone,   // (the Quests panel's errands under way, the Worlds page's worlds told, as main.js)
        colours: () => kit?.colours() ?? null,   // (the Items panel's Colours row: src/host/game-host.js wireKit)
        wardrobe: () => wardrobe?.data() ?? null,   // (the Wardrobe's lists: src/wardrobe.js)
        map: (o) => mapSource(o), travel: (id) => !!travel && fastTravel.can({ to: id, from: levelId, seen, flag }), order: ORDER, known: (id) => journal.seen(id) });
    },
    /** The Map's drawn ground by its key (the view's map.ground): a PixelCanvas (width, height, data: RGBA, rows top down). */
    mapPicture: (key) => pictures.get(key) ?? null,
    /** Inside a makers' house: its map's view (src/house-map.js, the Start menu's House map, issue #405); else null. */
    houseView: () => { const rt = houseHere(level, player); return rt ? houseView(rt, { game: gameState, player }) : null; },
    /** Fill and draw the Map's ground now (a test's, a tool's), `ms` at most. */
    drawMap(ms = 1e5) { if (!mapWhole) mapSource(); worldMap.view(mapWhole.bounds, MAP.cells); pumpMap(ms); return worldMap.want?.canvas ?? null; },
    /** Why the ship won't take you to `id` (null: it will; src/fast-travel.js). */
    travelRefusal(id) { return fastTravel.refusal({ to: id, from: levelId, seen: (w) => journal.seen(w), flag: (k) => gameState.flag(k) })?.text ?? null; },
    /**
     * The Worlds page's Travel here (main.js onTravel): fast travel to a world visited, the ship's take-off (its own way,
     * src/ship/ship.js travel), or the line why not (a gate's missing gadget starts its quest). → null, or the line.
     * A world never visited is reached from the holo table's galactic map (engine/starmap.js), found by its signature.
     */
    travel(id) {
      const no = fastTravel.refusal({ to: id, from: levelId, seen: (w) => journal.seen(w), flag: (k) => gameState.flag(k) });
      if (no) { if (no.missing) gameState.emit('travel:refused', { to: id, missing: no.missing, quest: no.quest }); return no.text; }
      if (shipOn) ship.travel(id); else onTravel?.(id);
      return null;
    },
    /** The holo table's galactic map (engine/starmap.js; null off the ship's scenes): its state, a run's or a test's. */
    get starMap() { return starMap; },
    /** The game menu's Wardrobe (src/wardrobe.js wireWardrobe: preview, wear, leave; engine/menus.js wardrobe). */
    get wardrobe() { return wardrobe; },
    /** Open the galactic map as the holo table does (a run's, a test's): true when it opened. */
    openStarMap() { return openStarMap(); },
    /** The player's settings (src/ui.js Settings) on the camera and the sound, as main.js applies them. */
    applySettings(s = settings) {
      if (!s) return;
      setFaces(s.padFaces);
      rig.sensitivity = s.sensitivity ?? 1; rig.invertY = !!s.invertY;
      player.invertFlight = !!s.invertFlight;   // (the jets' pitch: push forward to climb, as main.js)
      if (sound === SILENT) return;
      sound.setVolumes?.(s.music, s.effects); sound.setVoices?.(s.voices, s.alienVoices); sound.setMusicMode?.(s.musicMode);
      if (!!s.mute !== !!sound.muted) sound.toggleMute?.();
    },
    frame(dtRaw) {
      const tA = performance.now();
      if (foeWarm && ++foeWarm.frames > 2) { foeWarm.dispose({ keep: true }); foeWarm = null; }   // (sent: each warm body kept for the first foe of its kind)
      const on = game.sectionsOn; let tL = tA;
      // (a lap: the time since the last, to `name`; only when asked, a clock read each)
      const lap = on ? (name) => { const t = performance.now(); SEC.ms[name] = (SEC.ms[name] ?? 0) + t - tL; tL = t; } : null;
      if (on) SEC.frames++;
      const realDt = Math.min(dtRaw, 1 / 20);
      let dt = realDt;
      page.tick(tA);
      // (a run's card, the menus' 'card', open while the runner has one up: before the menus hold the world)
      try { trials?.sync(); } catch (e) { if (!game._trialsFailed) { game._trialsFailed = true; console.warn('[game] the trials failed', e?.stack ?? e); } }
      // a menu open (engine/menus.js): the world holds still under it, as the web's menus pause the game; the pad
      // goes to the menu (the controller's menu context), the scene is still drawn
      sound._shipAudio?.pause?.(!!(gadgets?.wheelOn && !talking() && !boxes?.busy?.()) || !!photo.on || !!(menus?.open && !(menus.mode === 'card' && trials?.running && !trials.runner?.paused)));
      sound.pauseActionAudio?.(!!(gadgets?.wheelOn && !talking() && !boxes?.busy?.()) || !!photo.on || !!(menus?.open && !(menus.mode === 'card' && trials?.running && !trials.runner?.paused)), !!story?.busy?.() || !!(shipOn && ship.busy()) || !!boxes?.busy?.() || !!trials?.busy());
      if (menus?.open) {
        controller.update(dt, true);
        inputFrame();
        // (a game goes on under its own start or results card, its camera with it, as main.js runs the runner under its card
        // with no input, a game that drives and one played on foot alike: a fight temple's hall seen from above behind its
        // card, not the traveller's own shot; its pause holds it, as the page's `paused`)
        if (menus.mode === 'card' && trials?.running && !trials.runner?.paused) { try { trials.update(dt, noInput); } catch (e) { if (!game._runFailed) { game._runFailed = true; console.warn('[game] the game failed in its update', e?.stack ?? e); } } }
        // (whatever a gadget was doing lets go, its wheel closes: main.js gadgets.control paused under a menu)
        try { gadgets?.control(dt, noInput, true); } catch { /* said in play */ }
        // (the galactic map open: its search, the scanner moved by the stick the controller just handed it, W A S D held)
        menus.starFrame?.(realDt);
        // (the Map open: its ground drawn on, the menu told how far every few frames for its "Drawing the map… n %")
        if (menus.mode === 'game' && menus.state?.panel?.id === 'map' && pumpMap() && ++mapTick % 8 === 0) menus.changed();
        screen.set('prompt', null); screen.set('stamina', null);
        const tB0 = performance.now();
        mirror.time = simT;
        veilsFrame();
        level.beforeDraw?.(camera);   // (the frame's camera final: what a level lays out only where it is seen, main.js renderFrame)
        const onWardrobe = !!wardrobe && menus.mode === 'game' && !menus.full && menus.state?.panel?.id === 'wardrobe';
        const wardrobeAt = onWardrobe ? wardrobeShot(player, menus.turntable.yaw, backend.wardrobeAspect?.() ?? 0.9) : null;
        if (onWardrobe) { menus.turntable.tick(realDt); wardrobe.tick(realDt); wardrobe.place(wardrobeAt); }
        const stats = mirror.sync(scene, camera);
        if (onWardrobe) wardrobeCapture(wardrobeAt);
        return { ms: { update: tB0 - tA, mirror: performance.now() - tB0 }, stats, frames };
      }
      if (photo.on) {
        // photo mode: the world held, the camera flown; a picture asked for is taken once its keys are off the screen
        photoFly(dt, mergeControls(latched(), controller.update(dt, true)));
        if (photo.capture && ++photo.capture === 2) screen.set('photo', { hint: '' });
        else if (photo.capture >= 4) {
          photo.capture = 0;
          const name = `hiraeth-${levelId}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
          backend.photo(name);
          sound.shutter?.();
          photo.saved = 2.5;
          screen.set('photo', { hint: `Photo saved · ${photoHint()}` });
        }
        if (photo.saved > 0 && (photo.saved -= dt) <= 0 && !photo.capture) screen.set('photo', { hint: photoHint() });
        const tB0 = performance.now();
        mirror.time = simT;
        veilsFrame();
        level.beforeDraw?.(camera);   // (the frame's camera final: what a level lays out only where it is seen, main.js renderFrame)
        const stats = mirror.sync(scene, camera);
        return { ms: { update: tB0 - tA, mirror: performance.now() - tB0 }, stats, frames };
      }
      // the gadget wheel open (held D-pad ↑ or B): the game waits while you choose, as main.js wheelFrame (issue #524); only
      // the wheel reads the input, the scene is still drawn as it stands
      if (gadgets?.wheelOn && !talking() && !boxes?.busy?.()) {
        const pad = controller.update(realDt, true);
        inputFrame();
        try { gadgets.wheel(realDt, mergeControls(latched(), pad)); } catch (e) { if (!game._gadgetsFailed) { game._gadgetsFailed = true; console.warn('[game] the gadgets failed', e?.stack ?? e); } gadgets.wheelOn = false; }
        const tB0 = performance.now();
        mirror.time = simT;
        veilsFrame();
        level.beforeDraw?.(camera);
        const stats = mirror.sync(scene, camera);
        return { ms: { update: tB0 - tA, mirror: performance.now() - tB0 }, stats, frames };
      }
      // (the fight's feel, main.js: a hit-stop freezes the world a few hundredths of a second, the flurry slows it round
      // the traveller, whose own step (pdt: his body, his blade, the camera) is not slowed by it; src/feel.js)
      let pdt = dt;
      if (combat) { dt = feelDt(realDt); pdt = selfDt(); }
      simT += dt; frames++;
      saveIn -= realDt;
      // (the engine playing with its menus: where you stand saved every 10 s, and the save's playtime, as main.js does)
      if (menus && saveIn <= 0) { saveIn = 10; if (!flags && !pinned && saves) { game.save(); slots.touch(slots.active, { addSeconds: 10 }); } }
      const pad = controller.update(pdt, true);
      inputFrame();
      const ctl = mergeControls(latched(), pad);
      atmo = level.atmo(player.pos.x, player.pos.z, player.pos.y);
      updateSky();
      look.zones(player.pos, sky);   // (a level's zones: their style, look, planets and hour, as the page)
      lap?.('sky');
      // weather into the look (main.js: rain, storm and the haze; the wind on the traveller and the plants)
      let Wx = null;
      if (weather) {
        const W = weather.update(dt);
        Wx = shelter ? shelter.update(dt, camera.position, camera.up, [player.pos]).apply(W) : { rain: W.rain ?? 0, dryNear: 0, storm: W.storm ?? 0 };
        if (U.uRain) U.uRain.value = Wx.rain ?? 0;
        if (U.uRainNear) U.uRainNear.value = Wx.dryNear ?? 0;
        if (U.uStorm) U.uStorm.value = Wx.storm ?? 0;
        if (U.uFogMul) U.uFogMul.value *= 1 + (W.fog ?? 0) * 2.6 + (Wx.storm ?? 0) * 2.2 + (Wx.rain ?? 0) * 0.6;
      }
      if (wind) {
        // (main.js: the wind on the traveller, and the plants' and the grass's uWind)
        wind.boost = Wx?.storm ?? 0;
        const [wx, wz] = wind.windDir, st = Wx?.storm ?? 0, rn = Wx?.rain ?? 0;
        const k = (level.features.wind ? 2.5 : 1.2) * (1 + st * 3.5 + rn * 0.6) * (1 - 0.8 * (shelter?.indoor ?? 0));
        player.wind?.set(wx * k, 0, wz * k);
        sharedUniforms.uWind.value.set(wx, wz, (level.features.wind ? 1 : 0.55) * (1 + st * 2 + rn * 0.4), wind.gust());
        if (post.uniforms.uInk) wind.uniforms.uInk.value = post.uniforms.uInk.value;
      }
      level.lightAt?.(player.pos, sharedUniforms.uSunDir.value);
      // As on the web, follow the moving geometry drawn last frame before characters move
      // (#610). Otherwise a crane's deck moves visually while its collision stays at the dock.
      // A held render frame must not consume the next live step's transform delta.
      if (dt > 0) physics.syncMovers(dt);
      lap?.('weather');
      sharedUniforms.uTime.value = simT;
      if (crowd) crowd.hush = !talkAllowed({ shipPlaying: shipOn && ship.playing }) || !!pinned;   // (no shouts over a ship's scene: main.js)
      crowd?.update(dt, simT, player, camera);
      lap?.('crowd');
      if (deferred?.pending) { deferred.run(player.pos); if (!deferred.pending) log(`distant detail: all done, ${deferred.done} jobs in ${Math.round(deferred.ms)} ms`); }   // (a share a frame, nearest first)
      // (the flora's checks: only the guard's while the drifts' pieces are still being made, then a share a frame)
      if (floraLater !== deferred && floraLater.pending) { floraLater.run(player.pos, physics.late.pending ? 0 : DEFER.budget); if (!floraLater.pending) log(`the flora's checks: all done, ${floraLater.done} in ${Math.round(floraLater.ms)} ms`); }
      lap?.('distant detail');   // (the load's queued work, DEFER.budget ms a frame until it is done: not the people's)
      // (the backend's peopleLod, the Unity bridge's: a person past 30 m out of the last frame's view, with room round them
      // for their shadow and the camera's turn, is moved a quarter of the frames as past 110 m, src/npc.js offView)
      const lod = !!backend?.peopleLod;
      for (const n of npcs) {
        if (lod && !n.pooled) n.offView = !inView(n.pos, 3 * (n.object?.scale?.y ?? 1) + 6);
        n.update(dt, player, camera);
      }
      folk?.errands.update();
      lap?.('people');
      // the ship's E aboard and its autopilot (the ramp's walk in and out), as main.js filters the input before the rest
      const busy0 = !!story?.busy?.() || (shipOn && ship.busy()) || !!boxes?.busy?.() || !!trials?.busy();
      const ctlS = shipOn && !pinned ? (busy0 ? noInput : ship.input(ctl)) : ctl;
      // E goes to the nearest person or thing first (story/index.js, interact.js), as main.js does
      const ePressed = !!ctlS.KeyE && !eWasDown && !pinned; eWasDown = !!ctlS.KeyE;
      let handled = false;
      if (story && !gameDef) { try { handled = story.update(dt, simT, { camera, ePressed, paused: busy0 || (shipOn && ship.playing) }).handled; } catch (e) { if (!story.failed) log('story update failed', e?.message ?? e); story.failed = true; } }
      if (handled) player._eHeld = true;
      if (shopWaiting && !talking()) { const e = shopWaiting; shopWaiting = null; menus.openShop(shopPanel, e); }
      lap?.('story');
      const busy = !!story?.busy?.() || (shipOn && ship.busy()) || !!boxes?.busy?.() || !!trials?.busy();
      benches?.update(dt, busy || pinned ? noInput : ctlS, ePressed && !handled);   // (sat on a bench: a move, a jump, B or E stands him up)
      player.camFwd = camera.getWorldDirection(player.camFwd ?? new THREE.Vector3());
      // (a run on foot's own buttons, before the traveller and the gadget in hand read them: main.js filterInput)
      if (!busy && !pinned) trials?.filterInput(ctlS);
      // a game that drives moves the traveller and the camera itself (main.js: instead of the usual play)
      const drives = !!trials?.drives && !pinned;
      // the gadgets' buttons before the traveller moves (the hook's reel sets his velocity), as main.js (a game takes them;
      // a trial in the world keeps them: the fan into the skiff's sail)
      const gadgetsPaused = busy || !!pinned || (shipOn && ship.playing) || player.god || !(trials?.keepsGadgets ?? true);   // (god mode: the triggers fly)
      // a way through under way: the move happens here, before the traveller and the camera do (main.js)
      if (passage.update(dt) === 'done') passCover.clear();
      if (drives) { try { trials.update(dt, busy ? noInput : ctlS); } catch (e) { if (!game._runFailed) { game._runFailed = true; console.warn('[game] the game failed in its update', e?.stack ?? e); } } }
      else {
        if (gadgets) { try { gadgets.control(pdt, gadgetsPaused ? noInput : ctlS, gadgetsPaused); } catch (e) { if (!game._gadgetsFailed) { game._gadgetsFailed = true; console.warn('[game] the gadgets failed', e?.stack ?? e); } } }
        // (the observatory's lens beside him takes E before he whistles: main.js)
        if (expedition) { try { if (expedition.update(dt, player, pinned ? noInput : ctlS, busy || !!pinned) && ctlS.KeyE) player._eHeld = true; } catch (e) { if (!game._obsFailed) { game._obsFailed = true; console.warn('[game] the observatory failed', e?.stack ?? e); } } }
        player.update(pdt, doorWalk.input(pinned || busy ? noInput : benches ? benches.inputFor(ctlS) : ctlS, pdt, rig.yaw), rig.yaw - (rig.locked ? rig.lockOff ?? 0 : 0), rig.pitch);
      }
      // the vehicles no one rides go about (the cabs on their lanes; main.js)
      lap?.('traveller');
      for (const v of player.vehicles) if (v !== player.ride) { try { v.update(dt, null, simT); } catch (e) { if (!game._vehiclesFailed) { game._vehiclesFailed = true; console.warn('[game] a vehicle failed', e?.stack ?? e); } } }
      if (pinned) {
        // a fixed view: the traveller stands (idle), the camera is pinned to the eye
        camera.position.copy(pinned.eye); camera.quaternion.copy(pinned.q);
        if (camera.fov !== pinned.fov) { camera.fov = pinned.fov; camera.updateProjectionMatrix(); }
        player.object.visible = !pinned.hidePlayer;
      } else if (!drives) {
        follow(pdt);   // (a ride's own shot, behind the jets, the wide arm, a hop: cameraFollow, as the page)
        rig.update(player.pos, pdt, player.frame);
        story?.frameCamera?.(camera);   // the two-shot while talking
        benches?.frameCamera(camera);   // (sat on a bench: behind and above him, looking out)
        // locked on: the camera keeps the foe ahead, a guardian framed with him; then a blow's jolt (main.js renderFrame)
        if (combat) { try { combat.frame(realDt, busy || (shipOn && ship.playing)); } catch (e) { if (!game._lockFailed) { game._lockFailed = true; console.warn('[game] the lock-on failed', e?.stack ?? e); } } shakeCamera(camera, realDt); }
        // a game played on foot (a trial, the Sunken Hall): its clock, gates and waves, after the rig, so it may take the camera
        if (trials?.running) { try { trials.update(dt, busy ? noInput : ctlS); } catch (e) { if (!game._runFailed) { game._runFailed = true; console.warn('[game] the run failed in its update', e?.stack ?? e); } } }
      }
      lap?.('vehicles, camera');
      try { boxes?.update(dt, simT, { camera }); itemFx?.update(dt, simT); } catch (e) { if (!game._boxesFailed) { game._boxesFailed = true; console.warn('[game] the boxes failed in their update', e?.stack ?? e); } }
      // the fragments' song, the finder's beep and one walked into; the world's hazards (fire, spines, a temple's spike rows:
      // src/hazards.js, registered by the levels as they build) biting while you touch them (main.js; the plan's D3)
      try {
        if (!(shipOn && ship.playing)) fragments?.update(dt, simT, { quiet: busy || !!pinned });
        // (the world's words waiting for a conversation's end; a relic walked into, as main.js)
        storyPage?.update(dt, simT, camera);
        if (!busy && !pinned && !(shipOn && ship.playing)) relics?.update(dt, simT, player);
        dangers.update(dt, player, { quiet: busy || !!pinned || (shipOn && ship.playing), say: (t) => toast(t) });
      } catch (e) { if (!game._fragmentsFailed) { game._fragmentsFailed = true; console.warn('[game] the fragments or hazards failed', e?.stack ?? e); } }
      if (shipOn && !pinned) {
        // inside or out, its scenes and their camera (after the rig, as main.js: a scene's shot replaces the rig's)
        try { ship.update(dt, simT, ctl); } catch (e) { if (!game._shipFailed) { game._shipFailed = true; console.warn('[game] the ship failed in its update', e?.stack ?? e); } }
        // the holo table's galactic map, the page's StarMap: here the menus' own (engine/starmap.js, BridgeMenu.StarMap.cs),
        // with its signature search; dark under NO POWER without power, as the page shows it
        if (ship.map?.open) { ship.map.toggle(false); openStarMap(); }
      }
      // (the lens inside the traveller: his own surfaces left out of the view, as the page: heroCutFrame)
      heroCutFrame({ camera, player, off: (shipOn && ship.playing) || !!trials?.drives || !!pinned });
      // the fingers (hands.js: relaxed, gripping, gesturing), the coral-shirt traveller's own hands after (main.js)
      try { updateHands(dt, { player, npcs, camera }); player.character?.updateHands?.(); } catch (e) { if (!game._handsFailed) { game._handsFailed = true; console.warn('[game] the hands failed', e?.stack ?? e); } }
      lap?.('boxes, hands');
      hud(dt, busy);
      // the balloons over people, chosen and published as main.js does (src/balloon-part.js; BridgeHud.cs DrawBalloons,
      // issue #430): the nearest who talks; none over a ship's scene, a shop or a box's card, nor in a fixed view's picture
      // (the web's side-by-sides hide the page); a greeting waits while a notice is up or waiting, a shout still comes
      try {
        camera.updateMatrixWorld();
        const talkOk = talkAllowed({ shipPlaying: shipOn && ship.playing }) && menus?.mode !== 'shop' && !boxes?.busy?.() && !pinned;
        const best = pickBalloon(npcs, { player, talk: talkOk, filming: !!story?.moments?.playing, greet: !noticeBusy() });
        const prompted = story?.prompt && story?.promptEntry?.npc;
        for (const n of npcs) n.placeBalloon?.(camera, n === best, n === prompted ? 30 : 0);
        publishBalloons([...npcs, crowd]);
        folk?.talk(dt, best, camera);   // (a balloon that speaks of humming: the hum; the one who talks near says it with their face)
      } catch (e) { if (!game._balloonsFailed) { game._balloonsFailed = true; console.warn('[game] the balloons failed', e?.stack ?? e); } }
      lap?.('hud');
      // (the ways through's light every frame, a fixed view's too: the web's bench draws them, scripts/unity-compare/)
      thresholds?.update(dt, simT, camera.position);
      if (!pinned) throughPortals(dt, simT);
      level.update?.(dt, simT, { player, rig, camera, passage, fade: () => {}, drawLater: true });   // (drawLater: level.beforeDraw is called)
      dangers.voidFrame(simT);   // (the void's rings' clock)
      lap?.('level');
      // the foes, the drops, the knock-out's card and what the page draws over the picture for them (engine/combat.js)
      if (level.temple) struggle.tick(guardianHint(level.temple)?.id, busy ? 0 : dt);   // (how long this phase of a guardian's fight has gone on)
      if (combat) { try { combat.update(dt, realDt, { busy: busy || !!pinned, paused: shipOn && ship.playing }); } catch (e) { if (!game._foesFailed) { game._foesFailed = true; console.warn('[game] the foes failed in their update', e?.stack ?? e); } } }
      lap?.('foes');
      // the world's life, the tool and the drone (main.js's order)
      try {
        kit?.arm();   // (the sword and the shield only once found: wireKit)
        tool?.update(pdt, pinned || busy ? noInput : ctl, busy || !!pinned || drives || player.god);   // (a game on foot keeps the blade and the gun)
        gadgets?.update(pdt, gadgetsPaused);   // (after the tool: an aiming gadget's camera and pose win)
        scout?.update(dt, busy || !!pinned);
        if (plumb && !pinned) updatePlumb(dt, busy);
        if (!pinned) nudges?.frame(busy);
        for (const f of flocks) f.update(dt, simT, player.pos, camera.position);
        motes?.update(dt, simT, camera.position);
        houseAir?.update(dt, simT, camera, player.pos);
        footprints?.update(dt);
        jumpShade?.update(player, physics);
        toolHud.frame();
        // (not paused at a fixed view, as main.js doesn't pause them for the bench's: the answering plants wake as the
        // traveller stands by them, the animals go about)
        wildlife?.update(dt, simT, player, camera, busy);
        reactiveWorld?.update(dt, simT, player, camera, busy);
        flammables?.update(dt, simT, player.pos);
        chemistry?.update(dt, player.pos);
        trials?.world(dt, simT);   // the trials' wind columns, the makers' runs' moving pieces, the signs (src/trials/)
      } catch (e) { if (!game._lifeFailed) { game._lifeFailed = true; console.warn('[game] a system failed in its update', e?.stack ?? e); } }
      lap?.('life');
      if (ctl.KeyQ && !qWasDown && scout && !busy && !trials?.running) { scoutHint?.pinged(); if (!plumbStep.press()) scout.ping?.(); }
      qWasDown = !!ctl.KeyQ;
      // the sound's wind, rain and steps (main.js: sound.update; the gust as wind.js's)
      if (sound !== SILENT) {
        try {
          const gust = wind ? wind.gust() : Math.max(Math.min(Math.max(0.35 + 0.45 * Math.sin(simT * 0.21) + 0.3 * Math.sin(simT * 0.53 + 1.7), 0), 1), Wx?.storm ?? 0);
          const ground = level.ground?.heightAt ? level.ground.heightAt(player.pos.x, player.pos.z) : player.pos.y;
          foley?.update(player, dt);
          menusHeard(menus);
          sound.update(pinned || busy ? CALM : {
            speed: player.riding ? 0 : Math.hypot(player.vel.x, player.vel.z), gust, storm: Wx?.storm ?? 0, rain: Wx?.rainOut ?? 0, rainRoof: Wx?.rainRoof ?? 0,
            thrusting: !!(player.thrusting || player.jetHold), jetPower: player.jetPower, riding: !!player.riding, rideKind: player.ride?.kind ?? null, rideSpeed: player.ride?.speed ?? 0,
            altitude: Number.isFinite(ground) ? player.pos.y - ground : 0, flying: !!(player.gliding || player.thrusting), indoor: shelter?.indoor ?? 0, night: sky.hour < 6.4 || sky.hour > 19.3,
            house: houseAir?.sound ?? null,   // (inside a makers' house: its bed, src/temples/air.js)
            footing: player.footing,   // (the world's ground or something built on it: the footsteps' surface, as main.js)
          });
        } catch (e) { if (!game._soundFailed) { game._soundFailed = true; console.warn('[game] the sound failed in its update', e?.stack ?? e); } }
      }
      lap?.('sound');
      // (the ship stands at its site: its scenes, inside and its console want the story's journal and the page: ship.attach)
      // the plants in view within their distance (main.js renderFrame: flora.update, before the frame is drawn)
      camera.updateMatrixWorld();
      const pxPerRad = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      flora?.update?.(camera, Q?.floraFar ?? 1, Q?.lodPx ? { pxPerRad, px: Q.lodPx } : null);
      if (crowd && Q?.lodPx) crowd.range.dist = (CROWD_DIST_CELL * pxPerRad) / Q.lodPx;   // (the crowd's distant figure, as main.js)
      // the grass round the camera: the tufts that wrapped placed again (flora-grass.js; the patch placed whole on its first frame)
      lap?.('flora');
      grass?.update(camera);
      lap?.('grass');
      // the wind's wisps round the traveller (their ribbons turned to the camera, a pixel's width from its field of view)
      // (none aboard the ship: its rooms, in orbit in the opening or parked, have no wind; the ribbons are drawn over
      // the walls, issue #264; and none in any interior, nor while you are in one: wind.js hush, issue #348)
      const aboard = shipOn && ship.inside;
      if (wind) { wind.mesh.visible = !aboard; wind.hush = shelter?.indoor ?? 0; }
      if (wind && !aboard) edge?.update(dt, camera, (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / height);
      if (edge) edge.ink.mesh.visible &&= !aboard;
      if (wind && !aboard && level.ground?.heightAt) wind.update(dt, player.pos, camera, level.ground, (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / height, !!level.features.wind);
      try { hoverTrails?.update(dt); } catch (e) { if (!game._trailsFailed) { game._trailsFailed = true; console.warn('[game] the trails failed', e?.stack ?? e); } }
      // the traveller's feet for the plants and the grass to part round (the engine's own, a frame's worth: brush.js on the web)
      backend?.brush?.(player.pos, Math.hypot(player.vel.x, player.vel.z));
      // and his last second of steps, for the grass to part along (brush.js, as main.js: the bridge's op 28, issue #264)
      if (backend?.brushTrail) backend.brushTrail((brushTrail ??= new BrushTrail()).update(dt, player.riding ? null : player.pos, Math.hypot(player.vel.x, player.vel.z)).trail, brushTrail.bound);
      lap?.('wind');
      // the bed under the water, a few rows a frame (src/water.js bakeStep, main.js's through waters.update): the shader's
      // pale shallows, the bed through them and the deep band need it, else every body is one flat tone (issue #502;
      // -js-off waterbed: without it). A handheld bakes in half the time a frame (uWaterLite: Handheld, the Retroid)
      if (waterBed) waters.bakeStep(player.pos, waterShared.uWaterLite.value > 0.5 ? BED.budget / 2 : BED.budget);
      // the camera kept off the water's surface, under it or over it (main.js; what the pass over the page draws: waterOver)
      waters.keepCamera(camera, player.swim?.under ? 'under' : 'over');
      // (the frame's camera final: what a level lays out only where it is seen, the Underwater City's bubbles; main.js renderFrame)
      level.beforeDraw?.(camera);
      lap?.('level');
      const tB = performance.now();
      mirror.time = simT;
      // (the props under the preset's pixels on screen hidden for this frame's mirror, shown again after: main.js renderFrame)
      const hidden = Q?.propPx ? (smallCull ??= new SmallCuller(scene)).hide(camera, pxPerRad, Q.propPx, []) : [];
      // (and the small props' tiles past the preset's propFar: main.js renderFrame's cullFar)
      if (Q?.propFar && small.length) cullFar(small, camera, Q.propFar, hidden);
      if (lodOn && Q?.lodPx) (lodLevels ??= new LodManager(scene, { keep: lodKeep(), budget: 1 })).update(camera, pxPerRad, Q.lodPx);
      veilsFrame();
      const stats = mirror.sync(scene, camera);
      for (const o of hidden) o.visible = true;
      // what the camera saw, as main.js after drawing: the next frame's fires and machines skip what is out of it
      // (src/motion-kit/view.js: the kit's detail tiers, the flames' tongues)
      setView(camera);
      const tC = performance.now();
      return { ms: { update: tB - tA, mirror: tC - tB }, stats, frames };
    },
  };
  game.applySettings();
  // the ship's first scene (main.js ship.start): a new save's opening, the arrival after a flight, else nothing
  // (then the world's opening words on a first visit, as main.js's onReady; a homecoming is its own page)
  const ready = () => { if (!playHomecoming) storyPage?.start({ quiet: !!playPrologue }); };
  if (shipOn) quiet(() => ship.start({ via: via === 'ship' ? 'ship' : null, prologue: playPrologue, homecoming: playHomecoming || null, onReady: ready }));
  else if (!flags && !view && !gameDef) ready();
  stamp('ready');
  log(`built ${levelId}: ${JSON.stringify(T)} ms`);
  return game;
}
