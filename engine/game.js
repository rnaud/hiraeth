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
import { page } from './boot.js';
import * as THREE from 'three';
import { levelById, LEVELS } from '../src/levels/index.js';
import { CONTENT } from '../src/levels/content.js';
import { Physics } from '../src/physics.js';
import { Waters } from '../src/water.js';
import { Ship } from '../src/ship/ship.js';
import { buildFlora, floraKeep, FLORA_WORLDS } from '../src/flora.js';
import { buildGrass } from '../src/flora-grass.js';
import { Player, CameraRig } from '../src/player.js';
import { Controller, mergeControls } from '../src/controller.js';
import { loadAnimationLibrary, Animator } from '../src/animator.js';
import { loadHuman, Humanoid } from '../src/humanoid.js';
import { loadPeople, usesMakeHuman } from '../src/makehuman/people.js';
import { loadTraveller, createTraveller } from '../src/characters/traveller.js';
import { CLOTH_HOST } from '../src/characters/tripo-cloth.js';
import { CAPE_HOST } from '../src/cape.js';
import { updateHands } from '../src/hands.js';
import { spawnNPCs, pooledNPC } from '../src/npc.js';
import { Crowd, CROWD_BUDGET, CROWD_DIST_CELL, buildPeople } from '../src/crowd.js';
import { QUALITY_PRESETS, SmallCuller } from '../src/perf.js';
import { spawnAliens, alienSpots } from '../src/aliens/index.js';
import { createStory } from '../src/story/index.js';
import { game as gameState } from '../src/game-state.js';
import { markHero, sharedUniforms } from '../src/materials.js';
import { createPost, PRESETS } from '../src/post.js';
import { applyTimeOfDay, colourScript } from '../src/timeofday.js';
import { EDGE_HINTS } from '../src/edge.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SceneMirror } from './mirror.js';
import { Wildlife } from '../src/wildlife.js';
import { ReactiveWorld } from '../src/reactive-world.js';
import { Flammables, flammableSpots } from '../src/flammable.js';
import { runSteps } from '../src/load-steps.js';
import { Weather } from '../src/weather.js';
import { WindStreaks } from '../src/wind.js';
import { Shelter, addIndoors } from '../src/shelter.js';

// The traveller's ship is indoors for the weather, as main.js registers it (src/shelter.js): no rain, sand or wisps in
// its rooms (issue #348: the rain fell in the ship in Lorn in the Unity preview). One registration for the module,
// asking the game that runs now (a test may make several games one after another).
let shipIndoors = null;
addIndoors((p) => !!shipIndoors?.(p));
import { Flock, Motes, Footprints } from '../src/life.js';
import { Scout, nextObjective } from '../src/scout.js';
import { FluidTool } from '../src/fluid-tool.js';
import { ToolHud, SaveGame } from '../src/ui.js';
import { screen } from '../src/platform.js';
import { slots, slotStorage } from '../src/save-slots.js';
import { menuSources } from '../src/game-menu-data.js';
import { WorldMap, MAP, mapBounds, zoomBounds, mapMarks, scaleBar } from '../src/world-map.js';
import { PixelCanvas } from './raster.js';
import { items as gear, ITEMS } from '../src/items.js';
import { chargeState } from '../src/story/charge.js';
import { ORDER, TITLES } from '../src/levels/names.js';
import { fastTravel } from '../src/fast-travel.js';
import { cueText, Cue, PlaceName, Fader, healthHud, staminaHud, keysHud } from '../src/hud.js';
import { toastSeconds } from '../src/quest.js';
import { selfLitSkips } from '../src/shadows.js';
import { plainValue } from './ink-spec.js';
import { Sound } from '../src/audio.js';
import { createBoxes } from '../src/boxes/index.js';
import { installAudio } from './webaudio.js';
import { setView, inView } from '../src/motion-kit/view.js';
import { padFaces, setFaces, confirmKey, backKey } from '../src/native-pad.js';
import { attachMotion } from '../src/motion-match.js';
import { ShopPanel } from '../src/shop-panel.js';
import { resources } from '../src/resources.js';

export { page };
export { Raycaster } from 'three';   // (for the tests and the tools that probe the world in the VM)

/** The shop panel's element where there is no page: every call taken (its sheet is the menus', engine/menus.js). */
const SHOP_EL = { classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, setAttribute() {}, addEventListener() {}, querySelector: () => null, innerHTML: '' };
/** Sound where the engine has none: every call taken, nothing played. */
const SILENT = new Proxy({}, { get: (t, k) => (k === 'ctx' ? null : k === 'band' ? () => null : () => {}) });
// the Map's drawn ground: its side in pixels (BridgeMenu shows it up to ~500 units of its 720-high canvas)
const MAP_PX = 512;
const CALM = { speed: 0, gust: 0, storm: 0, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0 };

/** The game's Sound on the shim (engine/webaudio.js), started: the engine has no autoplay rule to wait for. */
function makeSound(levelId, { sampleRate = 48000, volume = 1, record = false } = {}) {
  // (record: the graph rendered elsewhere, from what is done to it here: engine/webaudio.js, the Unity bridge's audio thread)
  installAudio(globalThis, { sampleRate, record });
  const s = quiet(() => new Sound(levelId));
  s.start();
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
export const LOOK_VECTORS = new Set(['uWind', 'uHaze', 'uSpot', 'uSpotTone', 'uHazeLayers', 'uHazeTone', 'uHeightFog', 'uHeightFogTone', 'uCast', 'uInkShadow']);

export async function createGame({ levelId = 'desert', backend, width = 1280, height = 720, people = true, view = null, audio = null, flags = null, grassPreset = 'high', quality = null, log = () => {}, menus = null, start = null, arrive = false, hullSpawn = false, settings = null, gestures = true, via = null, prologue = false, onTravel = null } = {}) {
  const T = {};
  // the graphics preset's detail (src/perf.js QUALITY_PRESETS: the Unity bridge's -quality, the Deck's on its Linux player),
  // as main.js applies it: the plants' share and distance, the grass patch, the crowd's ranges, the props under a few
  // pixels hidden, the people's low detail; none (everything, as the bench's High) without one
  const Q = quality && quality !== 'high' && QUALITY_PRESETS[quality] ? { ...QUALITY_PRESETS[quality], key: quality } : null;
  if (Q) grassPreset = Q.key;
  const t0 = performance.now();
  // the save's flags to start from (the side-by-sides: the web bench's, scripts/bench/web-page.mjs prepareStorage)
  if (flags) Object.assign(gameState.data.flags, flags);
  const stamp = (k) => { T[k] = Math.round(performance.now() - t0); };
  const meta = levelById(levelId);
  if (!meta) throw new Error(`no level ${levelId}`);
  const content = CONTENT[levelId];
  // start the loads the way main.js does: the clips, the traveller, the bodies
  const animLib = loadAnimationLibrary().catch((e) => { log('animation library failed', e); return null; });
  // the conversations' gestures (issue #197: public/anim/gestures.glb, src/talk-gesture.js), the only captured motion the
  // engines load (not the walks, the moves, nor the matching database); `gestures` false (-gestures 0) without them
  const gesturesP = gestures ? new GLTFLoader().loadAsync('anim/gestures.glb').catch((e) => { log('gestures unavailable', e?.message ?? e); return null; }) : null;
  // the traveller as main.js has him: the coral-shirt traveller (src/characters/traveller.js), his overshirt's cloth
  // stepped on this thread (no workers in the engines' VMs: tripo-cloth.js falls back); the old suit if he can't load
  const travellerP = loadTraveller('').catch((e) => { log('traveller B3 unavailable', e?.message ?? e); return null; });
  const humansP = Promise.all([loadHuman('m'), loadHuman('f')]).catch((e) => { log('human models failed', e); return null; });
  // the people on MakeHuman bodies (src/makehuman/people.js, docs/makehuman.md), each world's as main.js has them
  const mhP = people && usesMakeHuman(levelId) ? loadPeople('', levelId).catch((e) => { log('MakeHuman bodies unavailable', e?.message ?? e); return null; }) : null;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.3, 5000);
  const level = quiet(() => meta.create(scene));
  level.id ??= levelId;
  stamp('level');
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  // (every cape and robe made from here on simulated by the engine where it can: Unity's Burst jobs; src/cape.js CAPE_HOST)
  CAPE_HOST.offload = backend?.capeOffload?.() ?? null;
  quiet(() => level.init?.(physics));
  stamp('physics');
  const waters = quiet(() => new Waters(scene, { physics }));
  // the opening on a new save (main.js playPrologue: the desert, no save's place, not arriving by ship): the ship in
  // orbit too (its space copy), its scenes played by the engine (issue #264)
  const playPrologue = !!(prologue && menus && levelId === 'desert' && !start?.pos && via !== 'ship' && !flags && !view);
  const ship = quiet(() => new Ship({ scene, physics, level, levelId, content, prologue: playPrologue }));
  stamp('ship');
  const player = new Player(physics, {
    mount: level.mount, jetpack: level.features.jetpack, climb: level.features.climb ?? true,
    killY: level.killY, limit: level.limit ?? 1900, edgeHint: level.edgeHint ?? EDGE_HINTS[levelId] ?? EDGE_HINTS.default, spawn: level.spawn, spawnHeading: level.spawnHeading,
    gravityAt: level.gravityAt, unsafe: level.unsafe, dynamic: level.dynamic, water: waters,
  });
  const lib = await animLib;
  const gestureClips = await gesturesP;
  if (lib && gestureClips) { attachMotion(lib, gestureClips); stamp('gestures'); }
  if (lib) player.animator = player._animator = new Animator(lib, player.char);
  // (the traveller's captured jumps, idles, starts and stops are in moves.glb, which the engines don't load: with the
  // gestures in lib.motion his loops stay the library's, as before; src/player.js locoMoves)
  if (gestureClips) player.locoMoves = false;
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
  if (!player.humanoid && humans0) {
    const travellerTemplate = await new GLTFLoader().loadAsync('anim/traveller.glb').then((g) => g.scene).catch(() => null);
    if (travellerTemplate) player.humanoid = new Humanoid(humans0[0], player.char, 'm', { outfit: travellerTemplate });
  }
  player.attach(scene);
  const heroMaterials = markHero(player.char.root);
  markHero(player.gear?.device, heroMaterials);
  markHero(player.cape?.mesh, heroMaterials);
  if (player.mount) scene.add(player.mount.object);
  // the world's vehicles (the self-driving cabs: src/taxi.js), as main.js gives them to the traveller
  player.vehicles.push(...(level.vehicles ?? []));
  stamp('traveller');
  const npcs = [];
  if (people && content?.npcs?.length && humans && lib) {
    const near = quiet(() => spawnNPCs(scene, physics, content.npcs, { lib, humans }));
    near.forEach((n, i) => { n.def ??= content.npcs[i]; npcs.push(n); });
  }
  // the crowd (crowd.js: GPU-animated figures, the nearest few promoted to full people from a pool)
  let crowd = null;
  if (people && level.crowdSpots && humans && lib) {
    const spots = { lines: level.crowdLines, ...level.crowdSpots() };
    const clear = [...content.npcs.map((s) => ({ x: s.at[0], y: s.y, z: s.at[1], r: 3 })), ...alienSpots(levelId)];
    quiet(() => {
      const built = buildPeople(physics, spots, { seed: 11, clear });
      const pooled = Array.from({ length: CROWD_BUDGET.pool }, (_, i) => pooledNPC(scene, physics, { kind: i % 2 ? 'f' : 'm', lib, humans }));
      crowd = new Crowd(scene, physics, { spots, built, pooled, clear, makeNPC: (kind) => pooledNPC(scene, physics, { kind, lib, humans }) });
    });
    if (crowd) npcs.push(...crowd.npcs);
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
  const toast = (text) => { if (text && toasts.queue.at(-1) !== text) toasts.queue.push(String(text)); };
  player.onNotice = toast;
  // the sound: the game's own (src/audio.js) where the engine plays it, else a stand-in that takes every call
  const sound = audio ? makeSound(levelId, audio) : SILENT;
  // the journal's record (src/quest.js Journal: the worlds seen, the stories told, the relics, the errands), read from
  // the save as the page keeps it, without its page (the game menu draws from it: engine/menus.js)
  const journal = engineJournal({ write: !flags });
  let story = null;
  if (people && humans && lib) {
    try {
      if (!playPrologue) gameState.data.flags['prologue.done'] = true;
      story = quiet(() => createStory({ levelId, scene, physics, level, player, npcs, crowd, sound, journal, story: { complete() {}, start() {}, done: false, waitFor: null },
        capture: backend.portrait ? (eye, look, w, h, o) => portraitCapture(eye, look, w, h, o) : null, lib, humans, toast, tool: null, isNight: () => false, ship, drone: () => null }));
    } catch (e) { log('the story failed to start', e?.message ?? e); }
  }
  stamp('people');
  // the shops (main.js: talking to a keeper, "Show me what you have", or E at their counter; Anselm's aboard): the web's
  // ShopPanel keeps their logic, its sheet is the menus' 'shop' (engine/menus.js openShop; BridgeMenu.cs DrawShop),
  // opened once the conversation that asked for it has closed (issue #264)
  let shopWaiting = null;
  const shopPanel = menus?.openShop ? new ShopPanel({ el: SHOP_EL, doc: null, game: gameState, resources, sound, covered: () => true,
    onBought: ({ ware }) => { if (ware === 'heart') { player.setMaxHearts?.(resources.maxHearts); player.restore?.(player.maxHearts); } } }) : null;
  if (shopPanel) gameState.on('shop:open', ({ shop } = {}) => { shopWaiting = (shop === 'thrum' ? story?.scientist?.shopEntry?.() : story?.shops?.byId?.(shop)) ?? null; });
  journal.markSeen(levelId);   // (after the story read its first visit, as main.js marks it)
  if (Q) for (const n of npcs) { n.lowDetail = !!Q.lowDetail; n.clothFar = Q.clothFar ?? null; }
  // the makers' boxes (src/boxes/): each with its beacon, the pale pillar of light over a box that must be found
  const boxes = optional('the boxes', () => createBoxes({ levelId, scene, physics, level, player, sound, quests: story?.quests ?? null, toast,
    anchor: () => ship?.arrivalSpot?.() ?? null, quiet: () => !!story?.dialogue?.open, cam: null }));
  // the world's answering plants, fans and screens (reactive-world.js: what a shot of the fluid wakes), before the flora keeps clear of them
  const reactiveWorld = optional('the responsive world', () => runSteps(ReactiveWorld.make(scene, level, physics, content)));
  const flora = quiet(() => buildFlora({ scene, level, levelId, physics, density: Q?.floraDensity ?? 1, keep: floraKeep({ level, content, ship, npcs, crowd, boxes, reactiveWorld }) }));
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
  if (motes?.scene) for (const c of [...motes.scene.children]) scene.add(c);
  const footprints = quiet(() => new Footprints(scene));
  const onStep = player.onStep;
  player.onStep = (p, heading, up, i) => { onStep?.(p, heading, up, i); footprints.add?.(p, heading, up, i); sound.step(Math.hypot(player.vel.x, player.vel.z)); };
  const wildlife = optional('wildlife', () => new Wildlife(scene, level, physics, { content, sound, defs: level.wildlife }));
  const weather = optional('weather', () => new Weather(content.weather));
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
  const tool = optional('the fluid tool', () => new FluidTool({ scene, player, physics, camera, rig: null, sound, level, hud: new ToolHud(), noShadow: (level.noShadow ??= []) }));
  const scout = optional('the drone', () => new Scout({ scene, player, physics, sound, getTarget: () => nextObjective({ player, story: null, ship: level.ship, level, quest: () => story?.objective?.() }) }));
  stamp('life');
  stamp('flora');

  // the camera rig, on the page's stand-in canvas
  const rig = new CameraRig(camera, document.createElement('canvas'), physics);
  rig.yaw = level.camYaw ?? (player.heading + Math.PI);
  rig.pitch = level.camPitch ?? rig.pitch;
  rig.constrain = level.constrainCamera;
  if (tool) tool.rig = rig;

  // the look: the preset and the hour, as main.js applies them
  const post = createPost();
  const U = post.uniforms;
  const presetName = level.defaults?.preset ?? 'Moebius print';
  const applyPreset = () => {
    for (const [k, v] of Object.entries(PRESETS[presetName] ?? {})) if (U[k]) U[k].value = v;
    for (const [k, v] of Object.entries(level.defaults?.look ?? {})) if (U[k]) U[k].value = v;
  };
  applyPreset();
  // the graphics preset's look (main.js applyDetail): the lighter weathering, no cloud shadows or crease shading where it
  // says, its shadow filter's taps
  if (Q) {
    sharedUniforms.uWearLite.value = Q.lowDetail || Q.postLite ? 1 : 0;
    if (!Q.cloudShadows) sharedUniforms.uCloudShadows.value = 0;
    if (!Q.ao && U.uAO) U.uAO.value = 0;
    if (U.uPostLite) U.uPostLite.value = Q.postLite ? 1 : 0;
    if (Q.taps) sharedUniforms.uShadowTaps.value = Q.taps;
  }
  const sky ={ hour: level.defaults?.hour ?? 10 };
  const script = level.sky?.script ? colourScript(level.sky.script) : undefined;
  let atmo = level.atmo(player.pos.x, player.pos.z, player.pos.y);
  const updateSky = () => applyTimeOfDay(sky.hour, sharedUniforms.uSunDir.value, U, atmo, atmo?.script ?? script);
  updateSky();

  // the ship attached, as main.js attaches it, when the engine is played (its menus; not a bench's plan): walking up the
  // ramp takes you aboard, E at the console plays the voicemail (CallDirector), at the holo table the galactic map (the
  // game menu's Worlds page here), and its scenes play: the prologue, the take-off, the arrival (issue #264). Its
  // cinema draws nothing of its own (no page): its letterbox, fades and subtitles are the screen's 'cine' and 'sub'
  // (src/platform.js), which the engine's HUD draws (BridgeHud.cs). Travel ends in `onTravel(to)`: the engine
  // starts again at that world's landing (the page goes to ?level=<to>&via=ship).
  const shipOn = !!(menus && ship && story && !flags && !view);
  shipIndoors = shipOn ? (p) => !!ship.parked && !!ship.modelOf(p) : null;
  if (shipOn) {
    ship.cinema.dom = false;
    quiet(() => ship.attach({ player, rig, camera, sound, journal, post, story, wind, npcs, lib, humans, levels: LEVELS, order: ORDER,
      titles: Object.fromEntries(LEVELS.map((l) => [l.id, l.title])), go: (to) => onTravel?.(to) }));
  }

  // input: the keys by KeyboardEvent.code, as the page's listeners keep them (main.js), and the pads
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
  const photoHint = () => (controller.index !== null
    ? `Left stick fly · right stick look · LB / RB down / up · ${confirmKey()} save · ${backKey()} exit`
    : 'WASD fly · mouse look · Q / E down / up · Shift faster · Enter save · P exit');
  function setPhoto(on) {
    if (on && (pinned || talking() || (shipOn && ship.playing) || player.dead || !backend?.photo)) return;
    photo.on = !!on; photo.capture = 0;
    if (on) photo.pos.copy(camera.position);
    for (const k of ['cue', 'prompt', 'stamina', 'health', 'keys', 'toast']) screen.set(k, null);
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
    context: () => (menus?.open ? 'menu' : photo.on ? 'photo' : talking() ? 'talk' : player.ride ? 'ride' : 'game'),
    look: (x, y) => { if (x || y) rig.look(x, y); },
    action: (name, dt) => {
      if (menus?.open) { menus.action(name); return; }
      if (name === 'photo') { setPhoto(!photo.on); return; }
      if (name === 'capture') { if (photo.on && !photo.capture) photo.capture = 1; return; }
      if (photo.on) return;
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
    // (where the printed letters are: a Retroid's Nintendo letters, reported by letter, moved to positions; native-pad.js)
    faces: () => padFaces(),
  });

  const noInput = {};
  let eWasDown = false, qWasDown = false;
  // the HUD's state, as main.js draws it (src/platform.js screen): the cue line, the floating prompt,
  // the toasts, the health bar and the stamina wheel
  const cue = new Cue(), placeName = new PlaceName(), hpFade = new Fader(3);
  const rideHint = { kind: null, at: 0 };
  let stShown = 0;
  const _w = new THREE.Vector3();
  function hud(dt, busy) {
    const nowMs = performance.now();
    if (player.ride) { if (rideHint.kind !== player.ride.kind) { rideHint.kind = player.ride.kind; rideHint.at = nowMs; } } else rideHint.kind = null;
    const pad = controller.index !== null;
    const quiet = busy || player.dead || !!pinned;
    const text = cueText({ quiet, ride: player.ride?.kind ?? null, rideFor: nowMs - rideHint.at, prompt: story?.prompt, promptAt: story?.promptAt, boarding: player.boarding, controller: pad,
      shipHint: shipOn ? ship.hud() : null, shipPlaying: shipOn && ship.playing });
    const place = quiet || (shipOn && ship.playing) ? '' : placeName.update(atmo?.name, nowMs);
    cue.set(text || place, text ? '' : 'place');
    if (story && !busy && !pinned && !(shipOn && ship.playing)) story.placePrompt?.(camera, pad); else screen.set('prompt', null);
    // toasts: the next once the last has been read
    toasts.left -= dt;
    if (toasts.left <= 0 && toasts.queue.length && !busy) { const t = toasts.queue.shift(), secs = toastSeconds(t); screen.toast(t, secs); toasts.left = secs * 0.58; }
    if (toasts.left < -6) screen.set('toast', null);
    screen.set('health', healthHud({ health: player.health ?? 1, down: player.down, quiet: !!pinned }, hpFade, dt));
    // the key counter while in a temple (issue #274: as main.js updateKeys; BridgeHud.cs draws it)
    const keyT = (level.temples ?? (level.temple ? [level.temple] : [])).find((t) => t.keyCount && Object.values(t.def?.logic?.elements ?? {}).some((e) => e.type === 'key') && t.inside(player.pos));
    const keyN = keyT?.keyCount();
    screen.set('keys', keysHud({ inside: !!keyT, small: keyN?.small ?? 0, big: keyN?.big ?? false, quiet: !!pinned || busy }));
    const k = Math.min(Math.max(player.stamina ?? 1, 0), 1);
    stShown = k < 0.995 || player.winded ? 0.9 : Math.max(0, stShown - dt);
    const st = staminaHud({ stamina: k, winded: player.winded, quiet: quiet || !!player.ride || !!player.down }, stShown);
    _w.setFromMatrixColumn(camera.matrixWorld, 0);
    screen.set('stamina', st && { ...st, at: _w.multiplyScalar(0.62).add(player.object?.position ?? player.pos).addScaledVector(player.frame.up, 1.75).toArray().map((v) => +v.toFixed(2)) });
    screen.set('choice', talking() ? talk.sel : null);
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
  const mirror = new SceneMirror(backend, { castsShadow, quietWalk: !!backend.quietWalk, listMatrices: !!backend.listMatrices, stillMatrices: !!backend.stillMatrices, skipHidden: !!backend.skipHidden });
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
  let simT = 0, frames = 0, saveIn = 10;
  // the game menu's Map (main.js mapSource, src/world-map.js): the marks over the world's square, and its ground drawn
  // as the web draws it, the world's collision sampled straight down a few milliseconds a frame while the Map is open
  // (WorldMap.pump), then drawn by drawTerrain into a picture of its own (engine/raster.js PixelCanvas, MAP_PX square),
  // which the engine shows (game.mapPicture(key): the Unity bridge's BridgeHost.MapImage)
  let mapWhole = null, mapTop = 0, mapPics = 0;
  const pictures = new Map();   // key → the drawn ground
  const worldMap = new WorldMap({
    size: MAP_PX,
    canvas: () => { const c = new PixelCanvas(MAP_PX); c.key = `map${++mapPics}`; pictures.set(c.key, c); return c; },
    sample: (x, z) => {
      const h = physics.groundAt(x, mapTop, z, MAP.drop);
      const w = Number.isFinite(h) ? waters?.surfaceAt?.(x, z, h, 1) : null;
      return { h, water: w && !w.body?.sea && w.y > h + 0.15 ? w.y : null };
    },
  });
  worldMap.onReady = () => menus?.changed?.();
  const temples = () => (level.temples ?? []).filter((t) => t.outside?.door?.at).map((t) => ({ id: t.id, name: t.def?.name, x: t.outside.door.at.x, z: t.outside.door.at.z, y: t.outside.door.at.y }));
  function mapSource({ zoom = null } = {}) {
    if (!mapWhole) {
      const pts = [level.spawn, level.ship?.pos, ...temples(), ...npcs.map((n) => n.pos), ...(boxes?.list ?? []).map((b) => b.pos), player.pos].filter(Boolean);
      mapWhole = mapBounds(pts, { limit: level.limit ?? Infinity });
      mapTop = Math.max(...pts.map((p) => p.y ?? 0).filter(Number.isFinite)) + MAP.up;
    }
    const dir = player.frame.dir(player.heading, new THREE.Vector3());
    const goal = nextObjective({ player, story: null, ship: level.ship, level: { navigationPortals: [] }, quest: () => story?.objective?.() });
    const raw = {
      you: { x: player.pos.x, z: player.pos.z, dx: dir.x, dz: dir.z },
      ship: level.ship?.pos ?? null,
      goal: goal?.position ? { x: goal.position.x, z: goal.position.z, label: goal.label } : null,
      // (the people with a quest waiting for their talk: issue #273, as main.js mapSource)
      givers: (story?.quests?.giverMarks?.() ?? []).map((g) => ({ id: g.person, name: npcs.find((n) => n.def?.id === g.person)?.def?.name ?? null, label: g.label, x: g.position.x, z: g.position.z })),
      temples: temples(),
      people: npcs.filter((n) => n.def?.id && n.pos && gameState.flag(`met.${n.def.id}`)).map((n) => ({ id: n.def.id, name: n.def.name ?? n.def.id, x: n.pos.x, z: n.pos.z })),
      boxes: (boxes?.list ?? []).filter((b) => b.opened?.()).map((b) => ({ id: b.id, name: ITEMS[b.item]?.name ? `${ITEMS[b.item].name}’s box` : null, x: b.pos.x, z: b.pos.z })),
    };
    // (a mark zoomed on: a third of the whole map round it, its own ground drawn, as main.js mapSource)
    const focus = zoom && mapMarks({ ...raw, bounds: mapWhole }).find((m) => m.id === zoom);
    const bounds = focus ? zoomBounds(mapWhole, { x: mapWhole.x0 + focus.u * mapWhole.w, z: mapWhole.z0 + focus.v * mapWhole.h }) : mapWhole;
    const v = worldMap.view(bounds, focus ? MAP.zoomCells : MAP.cells);
    return { world: TITLES[levelId] ?? level.title ?? '', marks: mapMarks({ ...raw, bounds }), canvas: v.canvas, progress: v.progress, zoom: focus ? zoom : null, scale: scaleBar(bounds.w), note: '' };
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
  let smallCull = null;
  function pin(v) {
    const eye = new THREE.Vector3(...v.eye), target = new THREE.Vector3(...v.target);
    // the traveller where the view says (scripts/bench/web-page.mjs __benchPlace does the same on the web)
    if (v.player) { player.teleport(new THREE.Vector3(...v.player), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); player.heading = v.heading ?? player.heading; }
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, target, new THREE.Vector3(0, 1, 0)));
    // (a view with no place for the traveller leaves him out of the picture, as web-shots.mjs does)
    return { eye, q, fov: v.fov ?? 55, hidePlayer: v.hidePlayer ?? !v.player };
  }
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
  } else if (start?.pos && start.level === levelId && !level.keepSpawn) {
    const p = new THREE.Vector3(...start.pos);
    { const moved = level.settleSaved?.(p, physics); if (moved) p.copy(moved); }
    player.respawn(p);
    if (start.up && start.fwd) player.frame.set(new THREE.Vector3(...start.up), new THREE.Vector3(...start.fwd));
    player.heading = start.heading ?? player.heading;
    rig.yaw = start.yaw ?? player.heading + Math.PI;
  } else if (arrive && ship?.arrivalSpot) {
    const a = ship.arrivalSpot();
    player.respawn(a.pos);
    player.heading = a.heading;
    rig.yaw = a.heading + Math.PI;
  }
  // the first frame's camera
  rig.update(player.pos, 0, player.frame);

  const lookOut = {};
  const SEC = { ms: {}, frames: 0 };
  const game = {
    scene, camera, player, rig, level, physics, npcs, crowd, story, ship, mirror, boxes, grass, wind, sky, post, T, wildlife, weather, shelter, tool, scout, sound, flora, reactiveWorld, flammables,
    /** The sound's AudioContext (engine/webaudio.js): ctx.render(frames) → the next stereo PCM, or null without sound. */
    get audio() { return sound.ctx ?? null; },
    key(code, down) {
      if (down) tapped.add(code);
      const was = keys[code];
      keys[code] = down;
      // (photo mode from the keyboard, as the page's: P in and out, Enter saves, Esc leaves)
      if (down && !was && !menus?.open) {
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
    pin(v) { pinned = v ? pin(v) : null; },
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
      return { ...this.lookParams(), post: nums(U), shared: nums(sharedUniforms), preset: presetName, planets: level.sky?.planets ?? [] };
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
    openShop(id) { if (shopPanel) shopWaiting = (id === 'thrum' ? story?.scientist?.shopEntry?.() : story?.shops?.byId?.(id)) ?? null; return !!shopWaiting; },
    /** The ship attached and its scenes played (the engine played with its menus). */
    shipScenes: shipOn,
    /** A ship's scene playing that is not his to walk through (Esc held skips it). */
    get scenePlaying() { return shipOn && ship.playing && !ship.cinematic?.interactive?.(); },
    /** Photo mode on, and turned on or off (from the Start menu's Photo mode). */
    get photoOn() { return photo.on; },
    setPhoto(on) { setPhoto(on); },
    /** Where you stand, into the active save slot (main.js writeSave); not from a bench's fixed views. */
    save() {
      // (not while a ship's scene plays: the opening's traveller stands in the ship in orbit, a take-off's in the air)
      if (flags || pinned || player.dead || (shipOn && ship.playing)) return;
      SaveGame.write({ level: levelId, pos: player.pos.toArray(), heading: player.heading, yaw: rig.yaw, hour: sky.hour, up: player.frame.up.toArray(), fwd: player.frame.fwd.toArray() });
    },
    /**
     * The game menu's panels (src/game-menu-data.js menuSources, as main.js wires them, with what the engine carries:
     * the items' pictures by id, the Map's ground drawn by its WorldMap). `travel(id)`: the Worlds page's Travel here.
     */
    menuSources({ travel = null } = {}) {
      const charge = () => chargeState({ flag: (f) => gameState.flag(f), keepsakes: gameState.keepsakes(), completed: ship?.completed?.().length ?? 0,
        failed: Object.entries(gameState.data.flags).filter(([k, v]) => k.startsWith('failed.') && v).map(([, v]) => v) });
      const seen = (w) => journal.seen(w), flag = (k) => gameState.flag(k);
      return menuSources({ items: { owned: () => Object.keys(ITEMS).filter((id) => gear.has(id)) },
        quests: story?.quests ?? null, charge, keepsakes: () => gameState.keepsakes(), journal, current: levelId, order: ORDER, known: (id) => journal.seen(id), game: gameState,
        levels: LEVELS.map((l) => ({ id: l.id, title: l.title, hidden: l.hidden, blurb: l.blurb, relicNames: CONTENT[l.id]?.relics?.names })),
        mode: () => ({ mode: tool?.owned ? tool.mode : null, modes: tool?.owned ? tool.modes : [] }), boxes: () => boxes?.counts?.() ?? {},
        map: (o) => mapSource(o), travel: (id) => !!travel && fastTravel.can({ to: id, from: levelId, seen, flag }) });
    },
    /** The Map's drawn ground by its key (the view's map.ground): a PixelCanvas (width, height, data: RGBA, rows top down). */
    mapPicture: (key) => pictures.get(key) ?? null,
    /** Fill and draw the Map's ground now (a test's, a tool's), `ms` at most. */
    drawMap(ms = 1e5) { if (!mapWhole) mapSource(); worldMap.view(mapWhole, MAP.cells); pumpMap(ms); return worldMap.want?.canvas ?? null; },
    /** Why the ship won't take you to `id` (null: it will; src/fast-travel.js). */
    travelRefusal(id) { return fastTravel.refusal({ to: id, from: levelId, seen: (w) => journal.seen(w), flag: (k) => gameState.flag(k) })?.text ?? null; },
    /** The player's settings (src/ui.js Settings) on the camera and the sound, as main.js applies them. */
    applySettings(s = settings) {
      if (!s) return;
      setFaces(s.padFaces);
      rig.sensitivity = s.sensitivity ?? 1; rig.invertY = !!s.invertY;
      if (sound === SILENT) return;
      sound.setVolumes?.(s.music, s.effects); sound.setVoices?.(s.voices, s.alienVoices);
      if (!!s.mute !== !!sound.muted) sound.toggleMute?.();
    },
    frame(dtRaw) {
      const tA = performance.now();
      const on = game.sectionsOn; let tL = tA;
      // (a lap: the time since the last, to `name`; only when asked, a clock read each)
      const lap = on ? (name) => { const t = performance.now(); SEC.ms[name] = (SEC.ms[name] ?? 0) + t - tL; tL = t; } : null;
      if (on) SEC.frames++;
      const dt = Math.min(dtRaw, 1 / 20);
      page.tick(tA);
      // a menu open (engine/menus.js): the world holds still under it, as the web's menus pause the game; the pad
      // goes to the menu (the controller's menu context), the scene is still drawn
      if (menus?.open) {
        controller.update(dt, true);
        // (the Map open: its ground drawn on, the menu told how far every few frames for its "Drawing the map… n %")
        if (menus.mode === 'game' && menus.state?.panel?.id === 'map' && pumpMap() && ++mapTick % 8 === 0) menus.changed();
        screen.set('prompt', null); screen.set('stamina', null);
        const tB0 = performance.now();
        mirror.time = simT;
        veilsFrame();
        const stats = mirror.sync(scene, camera);
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
          photo.saved = 2.5;
          screen.set('photo', { hint: `Photo saved · ${photoHint()}` });
        }
        if (photo.saved > 0 && (photo.saved -= dt) <= 0 && !photo.capture) screen.set('photo', { hint: photoHint() });
        const tB0 = performance.now();
        mirror.time = simT;
        veilsFrame();
        const stats = mirror.sync(scene, camera);
        return { ms: { update: tB0 - tA, mirror: performance.now() - tB0 }, stats, frames };
      }
      simT += dt; frames++;
      saveIn -= dt;
      // (the engine playing with its menus: where you stand saved every 10 s, and the save's playtime, as main.js does)
      if (menus && saveIn <= 0) { saveIn = 10; if (!flags && !pinned) { game.save(); slots.touch(slots.active, { addSeconds: 10 }); } }
      const pad = controller.update(dt, true);
      const ctl = mergeControls(latched(), pad);
      atmo = level.atmo(player.pos.x, player.pos.z, player.pos.y);
      updateSky();
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
      lap?.('weather');
      sharedUniforms.uTime.value = simT;
      crowd?.update(dt, simT, player, camera);
      lap?.('crowd');
      // (the backend's peopleLod, the Unity bridge's: a person past 30 m out of the last frame's view, with room round them
      // for their shadow and the camera's turn, is moved a quarter of the frames as past 110 m, src/npc.js offView)
      const lod = !!backend?.peopleLod;
      for (const n of npcs) {
        if (lod && !n.pooled) n.offView = !inView(n.pos, 3 * (n.object?.scale?.y ?? 1) + 6);
        n.update(dt, player, camera);
      }
      lap?.('people');
      // the ship's E aboard and its autopilot (the ramp's walk in and out), as main.js filters the input before the rest
      const busy0 = !!story?.busy?.() || (shipOn && ship.busy());
      const ctlS = shipOn && !pinned ? (busy0 ? noInput : ship.input(ctl)) : ctl;
      // E goes to the nearest person or thing first (story/index.js, interact.js), as main.js does
      const ePressed = !!ctlS.KeyE && !eWasDown && !pinned; eWasDown = !!ctlS.KeyE;
      let handled = false;
      if (story) { try { handled = story.update(dt, simT, { camera, ePressed, paused: busy0 || (shipOn && ship.playing) }).handled; } catch (e) { if (!story.failed) log('story update failed', e?.message ?? e); story.failed = true; } }
      if (handled) player._eHeld = true;
      if (shopWaiting && !talking()) { const e = shopWaiting; shopWaiting = null; menus.openShop(shopPanel, e); }
      lap?.('story');
      const busy = !!story?.busy?.() || (shipOn && ship.busy());
      player.camFwd = camera.getWorldDirection(player.camFwd ?? new THREE.Vector3());
      player.update(dt, pinned || busy ? noInput : ctlS, rig.yaw, rig.pitch);
      // the vehicles no one rides go about (the cabs on their lanes; main.js)
      lap?.('traveller');
      for (const v of player.vehicles) if (v !== player.ride) { try { v.update(dt, null, simT); } catch (e) { if (!game._vehiclesFailed) { game._vehiclesFailed = true; console.warn('[game] a vehicle failed', e?.stack ?? e); } } }
      if (pinned) {
        // a fixed view: the traveller stands (idle), the camera is pinned to the eye
        camera.position.copy(pinned.eye); camera.quaternion.copy(pinned.q);
        if (camera.fov !== pinned.fov) { camera.fov = pinned.fov; camera.updateProjectionMatrix(); }
        player.object.visible = !pinned.hidePlayer;
      } else {
        rig.follow(player.ride?.heading ?? player.heading, dt, player.riding || player.gliding);
        rig.down = !!player.down;
        rig.update(player.pos, dt, player.frame);
        story?.frameCamera?.(camera);   // the two-shot while talking
      }
      lap?.('vehicles, camera');
      try { boxes?.update(dt, simT, { camera }); } catch (e) { if (!game._boxesFailed) { game._boxesFailed = true; console.warn('[game] the boxes failed in their update', e?.stack ?? e); } }
      if (shipOn && !pinned) {
        // inside or out, its scenes and their camera (after the rig, as main.js: a scene's shot replaces the rig's)
        try { ship.update(dt, simT, ctl); } catch (e) { if (!game._shipFailed) { game._shipFailed = true; console.warn('[game] the ship failed in its update', e?.stack ?? e); } }
        // the holo table's galactic map is the page's: here the game menu's Worlds page, its Travel here the ship's take-off
        // (without power the ship only says so: the map is dark)
        if (ship.map?.open) { ship.map.toggle(false); if (gameState.flag('ship.powered')) menus.show('game', 'worlds'); }
      }
      // the fingers (hands.js: relaxed, gripping, gesturing), the coral-shirt traveller's own hands after (main.js)
      try { updateHands(dt, { player, npcs, camera }); player.character?.updateHands?.(); } catch (e) { if (!game._handsFailed) { game._handsFailed = true; console.warn('[game] the hands failed', e?.stack ?? e); } }
      lap?.('boxes, hands');
      hud(dt, busy);
      lap?.('hud');
      level.update?.(dt, simT, { player, rig, camera, passage: null, fade: () => {} });
      lap?.('level');
      // the world's life, the tool and the drone (main.js's order)
      try {
        tool?.update(dt, pinned || busy ? noInput : ctl, busy || !!pinned);
        scout?.update(dt, busy || !!pinned);
        for (const f of flocks) f.update(dt, simT, player.pos, camera.position);
        motes?.update(dt, simT, camera.position);
        footprints?.update(dt);
        // (not paused at a fixed view, as main.js doesn't pause them for the bench's: the answering plants wake as the
        // traveller stands by them, the animals go about)
        wildlife?.update(dt, simT, player, camera, busy);
        reactiveWorld?.update(dt, simT, player, camera, busy);
        flammables?.update(dt, simT, player.pos);
      } catch (e) { if (!game._lifeFailed) { game._lifeFailed = true; console.warn('[game] a system failed in its update', e?.stack ?? e); } }
      lap?.('life');
      if (ctl.KeyQ && !qWasDown && scout && !busy) scout.ping?.();
      qWasDown = !!ctl.KeyQ;
      // the sound's wind, rain and steps (main.js: sound.update; the gust as wind.js's)
      if (sound !== SILENT) {
        try {
          const gust = wind ? wind.gust() : Math.max(Math.min(Math.max(0.35 + 0.45 * Math.sin(simT * 0.21) + 0.3 * Math.sin(simT * 0.53 + 1.7), 0), 1), Wx?.storm ?? 0);
          const ground = level.ground?.heightAt ? level.ground.heightAt(player.pos.x, player.pos.z) : player.pos.y;
          sound.update(pinned || busy ? CALM : {
            speed: player.riding ? 0 : Math.hypot(player.vel.x, player.vel.z), gust, storm: Wx?.storm ?? 0, rain: Wx?.rainOut ?? 0, rainRoof: Wx?.rainRoof ?? 0,
            thrusting: !!player.thrusting, riding: !!player.riding, rideKind: player.ride?.kind ?? null, rideSpeed: player.ride?.speed ?? 0,
            altitude: Number.isFinite(ground) ? player.pos.y - ground : 0, flying: !!(player.gliding || player.thrusting), indoor: shelter?.indoor ?? 0, night: sky.hour < 6.4 || sky.hour > 19.3,
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
      if (wind && !aboard && level.ground?.heightAt) wind.update(dt, player.pos, camera, level.ground, (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / height, !!level.features.wind);
      // the traveller's feet for the plants and the grass to part round (the engine's own, a frame's worth: brush.js on the web)
      backend?.brush?.(player.pos, Math.hypot(player.vel.x, player.vel.z));
      lap?.('wind');
      const tB = performance.now();
      mirror.time = simT;
      // (the props under the preset's pixels on screen hidden for this frame's mirror, shown again after: main.js renderFrame)
      const hidden = Q?.propPx ? (smallCull ??= new SmallCuller(scene)).hide(camera, pxPerRad, Q.propPx, []) : null;
      veilsFrame();
      const stats = mirror.sync(scene, camera);
      if (hidden) for (const o of hidden) o.visible = true;
      // what the camera saw, as main.js after drawing: the next frame's fires and machines skip what is out of it
      // (src/motion-kit/view.js: the kit's detail tiers, the flames' tongues)
      setView(camera);
      const tC = performance.now();
      return { ms: { update: tB - tA, mirror: tC - tB }, stats, frames };
    },
  };
  game.applySettings();
  // the ship's first scene (main.js ship.start): a new save's opening, the arrival after a flight, else nothing
  if (shipOn) quiet(() => ship.start({ via: via === 'ship' ? 'ship' : null, prologue: playPrologue, onReady: () => {} }));  stamp('ready');
  log(`built ${levelId}: ${JSON.stringify(T)} ms`);
  return game;
}
