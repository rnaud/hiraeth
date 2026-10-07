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
// Left out for now (the page's): the menus.
import { page } from './boot.js';
import * as THREE from 'three';
import { levelById } from '../src/levels/index.js';
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
import { loadTravellerV1, createTravellerV1 } from '../src/characters/traveller-v1.js';
import { CLOTH_HOST } from '../src/characters/tripo-cloth.js';
import { updateHands } from '../src/hands.js';
import { spawnNPCs, pooledNPC } from '../src/npc.js';
import { Crowd, CROWD_BUDGET, buildPeople } from '../src/crowd.js';
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
import { Shelter } from '../src/shelter.js';
import { Flock, Motes, Footprints } from '../src/life.js';
import { Scout, nextObjective } from '../src/scout.js';
import { FluidTool } from '../src/fluid-tool.js';
import { ToolHud } from '../src/ui.js';
import { screen } from '../src/platform.js';
import { cueText, Cue, PlaceName, Fader, healthHud, staminaHud } from '../src/hud.js';
import { toastSeconds } from '../src/quest.js';
import { selfLitSkips } from '../src/shadows.js';
import { plainValue } from './ink-spec.js';
import { Sound } from '../src/audio.js';
import { createBoxes } from '../src/boxes/index.js';
import { installAudio } from './webaudio.js';

export { page };
export { Raycaster } from 'three';   // (for the tests and the tools that probe the world in the VM)

/** Sound where the engine has none: every call taken, nothing played. */
const SILENT = new Proxy({}, { get: (t, k) => (k === 'ctx' ? null : k === 'band' ? () => null : () => {}) });
const CALM = { speed: 0, gust: 0, storm: 0, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0 };

/** The game's Sound on the shim (engine/webaudio.js), started: the engine has no autoplay rule to wait for. */
function makeSound(levelId, { sampleRate = 48000, volume = 1 } = {}) {
  installAudio(globalThis, { sampleRate });
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
function engineColours(ch, { gltf, colors }) {
  const parts = [ch.mesh, ch.cloth?.garment, ch.cloth?.underlayer, ch.cloth?.innerShirt].filter(Boolean);
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

export async function createGame({ levelId = 'desert', backend, width = 1280, height = 720, people = true, view = null, audio = null, flags = null, grassPreset = 'high', log = () => {} } = {}) {
  const T = {};
  const t0 = performance.now();
  // the save's flags to start from (the side-by-sides: the web bench's, scripts/bench/web-page.mjs prepareStorage)
  if (flags) Object.assign(gameState.data.flags, flags);
  const stamp = (k) => { T[k] = Math.round(performance.now() - t0); };
  const meta = levelById(levelId);
  if (!meta) throw new Error(`no level ${levelId}`);
  const content = CONTENT[levelId];
  // start the loads the way main.js does: the clips, the traveller, the bodies
  const animLib = loadAnimationLibrary().catch((e) => { log('animation library failed', e); return null; });
  // the traveller as main.js has him: the coral-shirt traveller (src/characters/traveller-v1.js), his overshirt's cloth
  // stepped on this thread (no workers in the engines' VMs: tripo-cloth.js falls back); the old suit if he can't load
  const travellerV1P = loadTravellerV1('').catch((e) => { log('traveller v1 unavailable', e?.message ?? e); return null; });
  const humansP = Promise.all([loadHuman('m'), loadHuman('f')]).catch((e) => { log('human models failed', e); return null; });
  // the people on MakeHuman bodies (src/makehuman/people.js, docs/makehuman.md), each world's as main.js has them
  const mhP = people && usesMakeHuman(levelId) ? loadPeople('', levelId).catch((e) => { log('MakeHuman bodies unavailable', e?.message ?? e); return null; }) : null;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.3, 5000);
  const level = quiet(() => meta.create(scene));
  level.id ??= levelId;
  stamp('level');
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  stamp('physics');
  const waters = quiet(() => new Waters(scene, { physics }));
  const ship = quiet(() => new Ship({ scene, physics, level, levelId, content, prologue: false }));
  stamp('ship');
  const player = new Player(physics, {
    mount: level.mount, jetpack: level.features.jetpack, climb: level.features.climb ?? true,
    killY: level.killY, limit: level.limit ?? 1900, edgeHint: level.edgeHint ?? EDGE_HINTS[levelId] ?? EDGE_HINTS.default, spawn: level.spawn, spawnHeading: level.spawnHeading,
    gravityAt: level.gravityAt, unsafe: level.unsafe, dynamic: level.dynamic, water: waters,
  });
  const lib = await animLib;
  if (lib) player.animator = player._animator = new Animator(lib, player.char);
  const humans0 = await humansP;
  // (the people's templates: MakeHuman's man and woman where the world has them, else the Quaternius pair; the traveller
  // keeps his own body)
  const humans = humans0 && mhP ? ((await mhP)?.humans() ?? humans0) : humans0;
  const generated = await travellerV1P;
  if (generated) {
    try {
      // (his overshirt done by the engine where it can: Unity's Burst job, not this thread; tripo-cloth.js CLOTH_HOST)
      CLOTH_HOST.offload = backend?.clothOffload?.() ?? null;
      try { player.character = createTravellerV1(player.char, generated); } finally { CLOTH_HOST.offload = null; }
      player.humanoid = player.character.humanoid;
      engineColours(player.character, generated);
    } catch (e) { log('traveller v1 failed', e?.message ?? e); player.character = null; }
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
  let story = null;
  if (people && humans && lib) {
    const journal = { sections: [], el: { addEventListener() {} }, seen: () => false, storyDone: () => false, markSeen() {}, relicCount: () => 0, render() {} };
    try {
      gameState.data.flags['prologue.done'] = true;
      story = quiet(() => createStory({ levelId, scene, physics, level, player, npcs, crowd, sound, journal, story: { complete() {}, start() {}, done: false, waitFor: null },
        capture: backend.portrait ? (eye, look, w, h, o) => portraitCapture(eye, look, w, h, o) : null, lib, humans, toast, tool: null, isNight: () => false, ship, drone: () => null }));
    } catch (e) { log('the story failed to start', e?.message ?? e); }
  }
  stamp('people');
  // the makers' boxes (src/boxes/): each with its beacon, the pale pillar of light over a box that must be found
  const boxes = optional('the boxes', () => createBoxes({ levelId, scene, physics, level, player, sound, quests: story?.quests ?? null, toast,
    anchor: () => ship?.arrivalSpot?.() ?? null, quiet: () => !!story?.dialogue?.open, cam: null }));
  // the world's answering plants, fans and screens (reactive-world.js: what a shot of the fluid wakes), before the flora keeps clear of them
  const reactiveWorld = optional('the responsive world', () => runSteps(ReactiveWorld.make(scene, level, physics, content)));
  const flora = quiet(() => buildFlora({ scene, level, levelId, physics, keep: floraKeep({ level, content, ship, npcs, crowd, boxes, reactiveWorld }) }));
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
  // (on the page a screen overlay of their own; here a mesh in the mirrored scene, on the port's Memento/Wisp)
  const wind = optional('the wind', () => new WindStreaks());
  if (wind) {
    wind.uniforms.uInk.value = new THREE.Color('#2b211f');
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
  const sky = { hour: level.defaults?.hour ?? 10 };
  const script = level.sky?.script ? colourScript(level.sky.script) : undefined;
  let atmo = level.atmo(player.pos.x, player.pos.z, player.pos.y);
  const updateSky = () => applyTimeOfDay(sky.hour, sharedUniforms.uSunDir.value, U, atmo, atmo?.script ?? script);
  updateSky();

  // input: the keys by KeyboardEvent.code, as the page's listeners keep them (main.js), and the pads
  const keys = {};
  const tapped = new Set();
  const latched = () => { const o = { ...keys }; for (const k of tapped) o[k] = true; tapped.clear(); return o; };
  // a conversation's answer picked with the pad (the page focuses a button; here: an index, screen.choice)
  const talk = { sel: 0 };
  const dialogue = () => story?.dialogue ?? null;
  const talking = () => !!dialogue()?.open;
  const controller = new Controller({
    pads: () => navigator.getGamepads?.() ?? [],
    context: () => (talking() ? 'talk' : player.ride ? 'ride' : 'game'),
    look: (x, y) => { if (x || y) rig.look(x, y); },
    action: (name, dt) => {
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
    navigate: (x, y) => { const n = screen.state.dialogue?.choices?.length ?? 0; if (n) talk.sel = Math.max(0, Math.min(n - 1, talk.sel + y)); },
    scroll: () => {},
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
    const text = cueText({ quiet, ride: player.ride?.kind ?? null, rideFor: nowMs - rideHint.at, prompt: story?.prompt, promptAt: story?.promptAt, boarding: player.boarding, controller: pad });
    const place = quiet ? '' : placeName.update(atmo?.name, nowMs);
    cue.set(text || place, text ? '' : 'place');
    if (story && !busy && !pinned) story.placePrompt?.(camera, pad); else screen.set('prompt', null);
    // toasts: the next once the last has been read
    toasts.left -= dt;
    if (toasts.left <= 0 && toasts.queue.length && !busy) { const t = toasts.queue.shift(), secs = toastSeconds(t); screen.toast(t, secs); toasts.left = secs * 0.58; }
    if (toasts.left < -6) screen.set('toast', null);
    screen.set('health', healthHud({ health: player.health ?? 1, down: player.down, quiet: !!pinned }, hpFade, dt));
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
  const mirror = new SceneMirror(backend, { castsShadow });
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
  let simT = 0, frames = 0;
  // a fixed view (the side-by-sides and the benchmark's viewpoints): the camera pinned there
  let pinned = view ? pin(view) : null;
  function pin(v) {
    const eye = new THREE.Vector3(...v.eye), target = new THREE.Vector3(...v.target);
    // the traveller where the view says (scripts/bench/web-page.mjs __benchPlace does the same on the web)
    if (v.player) { player.teleport(new THREE.Vector3(...v.player), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); player.heading = v.heading ?? player.heading; }
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, target, new THREE.Vector3(0, 1, 0)));
    // (a view with no place for the traveller leaves him out of the picture, as web-shots.mjs does)
    return { eye, q, fov: v.fov ?? 55, hidePlayer: v.hidePlayer ?? !v.player };
  }
  // the first frame's camera
  rig.update(player.pos, 0, player.frame);

  const lookOut = {};
  const game = {
    scene, camera, player, rig, level, physics, npcs, crowd, story, ship, mirror, boxes, grass, wind, sky, post, T, wildlife, weather, tool, scout, sound, flora, reactiveWorld, flammables,
    /** The sound's AudioContext (engine/webaudio.js): ctx.render(frames) → the next stereo PCM, or null without sound. */
    get audio() { return sound.ctx ?? null; },
    key(code, down) {
      if (down) tapped.add(code);
      const was = keys[code];
      keys[code] = down;
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
    frame(dtRaw) {
      const tA = performance.now();
      const dt = Math.min(dtRaw, 1 / 20);
      simT += dt; frames++;
      page.tick(tA);
      const pad = controller.update(dt, true);
      const ctl = mergeControls(latched(), pad);
      atmo = level.atmo(player.pos.x, player.pos.z, player.pos.y);
      updateSky();
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
      sharedUniforms.uTime.value = simT;
      crowd?.update(dt, simT, player, camera);
      for (const n of npcs) n.update(dt, player, camera);
      // E goes to the nearest person or thing first (story/index.js, interact.js), as main.js does
      const ePressed = !!ctl.KeyE && !eWasDown && !pinned; eWasDown = !!ctl.KeyE;
      let handled = false;
      if (story) { try { handled = story.update(dt, simT, { camera, ePressed, paused: false }).handled; } catch (e) { if (!story.failed) log('story update failed', e?.message ?? e); story.failed = true; } }
      if (handled) player._eHeld = true;
      const busy = !!story?.busy?.();
      player.camFwd = camera.getWorldDirection(player.camFwd ?? new THREE.Vector3());
      player.update(dt, pinned || busy ? noInput : ctl, rig.yaw, rig.pitch);
      // the vehicles no one rides go about (the cabs on their lanes; main.js)
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
      try { boxes?.update(dt, simT, { camera }); } catch (e) { if (!game._boxesFailed) { game._boxesFailed = true; console.warn('[game] the boxes failed in their update', e?.stack ?? e); } }
      // the fingers (hands.js: relaxed, gripping, gesturing), the coral-shirt traveller's own hands after (main.js)
      try { updateHands(dt, { player, npcs, camera }); player.character?.updateHands?.(); } catch (e) { if (!game._handsFailed) { game._handsFailed = true; console.warn('[game] the hands failed', e?.stack ?? e); } }
      hud(dt, busy);
      level.update?.(dt, simT, { player, rig, camera, passage: null, fade: () => {} });
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
      // (the ship stands at its site: its scenes, inside and its console want the story's journal and the page: ship.attach)
      // the plants in view within their distance (main.js renderFrame: flora.update, before the frame is drawn)
      camera.updateMatrixWorld();
      flora?.update?.(camera, 1, null);
      // the grass round the camera: the tufts that wrapped placed again (flora-grass.js; the patch placed whole on its first frame)
      grass?.update(camera);
      // the wind's wisps round the traveller (their ribbons turned to the camera, a pixel's width from its field of view)
      if (wind && level.ground?.heightAt) wind.update(dt, player.pos, camera, level.ground, (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / height, !!level.features.wind);
      // the traveller's feet for the plants and the grass to part round (the engine's own, a frame's worth: brush.js on the web)
      backend?.brush?.(player.pos, Math.hypot(player.vel.x, player.vel.z));
      const tB = performance.now();
      mirror.time = simT;
      const stats = mirror.sync(scene, camera);
      const tC = performance.now();
      return { ms: { update: tB - tA, mirror: tC - tB }, stats, frames };
    },
  };
  stamp('ready');
  log(`built ${levelId}: ${JSON.stringify(T)} ms`);
  return game;
}
