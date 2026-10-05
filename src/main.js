import * as shipSfx from './ship/sfx.js';
import { updateHazards } from './hazards.js';
import * as THREE from 'three';
import { ReactiveWorld } from './reactive-world.js';
import { Controller, mergeControls, menuNavigate } from './controller.js';
import { installNativePad, watchLabels, setFaces, padFaces, confirmKey, backKey } from './native-pad.js';
import { installAppShell, markBooted } from './native-app.js';
import { ObservatoryQuest } from './observatory.js';
import { Scout, nextObjective } from './scout.js';
import { Wildlife } from './wildlife.js';
import { createGBuffer, createComposeTarget, createBlit, setSubject } from './pipeline.js';
import GUI from 'lil-gui';
import { sharedUniforms, markHero, setEnvGround } from './materials.js';
import { createPost, createBloom, DEBUG_VIEWS, PRESETS } from './post.js';
import { LEVELS, levelById } from './levels/index.js';
import { Player, CameraRig } from './player.js';
import { applyTimeOfDay, colourScript } from './timeofday.js';
import { WindStreaks } from './wind.js';
import { HOLO } from './ship/hologram.js';
import { Physics, dropBuriedFlora } from './physics.js';
import { tileScene, cullFar, fitBounds, SmallCuller, RoomCuller, resolveQuality, detectHandheld, GpuTimer, adaptScale } from './perf.js';
import { buildFlora, floraKeep, FLORA_WORLDS } from './flora.js';
import { buildGrass } from './flora-grass.js';
import { Cascade, ShadowCuller, shadowDirection } from './shadows.js';
import { Trail } from './trail.js';
import { Flock, Motes, Footprints } from './life.js';
import { Sound } from './audio.js';
import { Weather, WEATHER_KINDS } from './weather.js';
import { Shelter, addIndoors } from './shelter.js';
import { spawnNPCs, pooledNPC, registerNPCTargets } from './npc.js';
import { Crowd } from './crowd.js';
import { Journal, Relics, Story, Errands } from './quest.js';
import { CONTENT, ERRANDS } from './levels/content.js';
import { loadAnimationLibrary, Animator } from './animator.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadHuman, Humanoid } from './humanoid.js';
import { Changelog, VERSION } from './changelog.js';
import { Settings, SettingsMenu, TouchControls, SaveGame, isTouch, isNativeApp, ToolHud } from './ui.js';
import { FluidTool, bindToolMouse } from './fluid-tool.js';
import { ORDER } from './levels/content.js';
import { createStory } from './story/index.js';
import { knownWorlds, newlyKnown } from './story/route.js';
import { revealNote } from './story/signature.js';
import { registerInteractable, PRIORITY } from './interact.js';
import { Ship } from './ship/ship.js';
import { birdAnswers, promisedBird } from './bird.js';
import { game } from './game-state.js';
import { items, ITEMS, gearHtml } from './items.js';
import { Flammables, flammableSpots } from './flammable.js';
import { createBoxes, migrateSave } from './boxes/index.js';
import { createItemEffects } from './boxes/effects.js';
import { DevMenu } from './dev-menu.js';
import { isolate, restore } from './story/portrait-bg.js';
import { badgeLine } from './prompt-keys.js';
import { chargeState, chargeHud, chargeJournalHtml, showChargeCard, GIVEN as CHARGE_GIVEN, CARD as CHARGE_CARD } from './story/charge.js';
import { slots, formatPlaytime } from './save-slots.js';

// Android: the handheld's controls come from the app (native-pad.js), and prompts use its button names
installNativePad();
watchLabels();

// Loading: each stage updates the inked loading screen, then yields a frame
// so it can paint (its pen animation runs on the compositor meanwhile).
const loadMsg = document.querySelector('#loading .msg');
const tLoad = performance.now();
let tStage = tLoad, lastMsg = 'start';
const stage = (msg) => {
  console.info(`load: ${lastMsg} ${(performance.now() - tStage).toFixed(0)} ms`);
  tStage = performance.now(); lastMsg = msg;
  if (loadMsg) loadMsg.textContent = msg;
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
};

// We author every colour as a display value and output it untouched.
THREE.ColorManagement.enabled = false;

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
const pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.3, 5000);

// G-buffer: [0] albedo + light, [1] normal + view depth, [2] surface hatching
const gbuffer = createGBuffer();   // (src/pipeline.js: shared with the character studio)

// Sun shadow maps: three orthographic cascades that follow the player (src/shadows.js).
// fine = crisp character shadows, near = the street around you, far = mesas shadowing distant dunes.
// Sizes come from the graphics preset (applyQuality); bias and normal offset are in texels.
const shadowOverride = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });
const SU = sharedUniforms;
const cascades = {
  fine: new Cascade({ name: 'fine', size: 2048, extent: 12, depth: 1600, bias: 3.4, offset: 2.6, uniforms: { map: SU.uShadowMap0, matrix: SU.uShadowMatrix0, bias: SU.uShadowBias0, offset: SU.uShadowNormalOffset0 } }),
  near: new Cascade({ name: 'near', size: 4096, extent: 220, depth: 1600, bias: 2.3, offset: 3.2, uniforms: { map: SU.uShadowMap, matrix: SU.uShadowMatrix, bias: SU.uShadowBias, offset: SU.uShadowNormalOffset } }),
  far: new Cascade({ name: 'far', size: 2048, extent: 1150, depth: 3200, bias: 2.2, offset: 2.4, uniforms: { map: SU.uShadowMap2, matrix: SU.uShadowMatrix2, bias: SU.uShadowBias2, offset: SU.uShadowNormalOffset2 } }),
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
// the graphics preset (perf.js QUALITY_PRESETS); Auto runs the handheld recipe on the Android app and mobile GPUs
const gpuName = (() => {
  const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
  try { return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? ''); } catch { return ''; }
})();
const handheld = detectHandheld({ native: isNativeApp, touch: isTouch, gpu: gpuName });
let preset = resolveQuality(settings.quality, { handheld, hiDPI: pixelRatio >= 2 });
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
const meta = levelById(levelParam) ?? levelById(resumeId) ?? LEVELS[0];
const levelId = meta.id;
const content = CONTENT[levelId];
const animLib = loadAnimationLibrary().catch((e) => { console.warn('animation library failed to load', e); return null; });
const traveller = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}anim/traveller.glb`).then(g => g.scene).catch(e => { console.warn('Traveller unavailable; using the original explorer.', e); return null; });
const humans = Promise.all([loadHuman('m'), loadHuman('f')]).catch((e) => { console.warn('human models failed to load', e); return null; });
await stage(`sketching ${meta.title.toLowerCase()}…`);
const level = meta.create(scene);
const terrain = level.ground;
// what the metals see below the horizon: the world's ground (materials.js)
setEnvGround(level.envGround ?? level.ground?.mesh?.material?.uniforms?.uColor?.value);
await stage('inking the collisions…');
// Collision against the real level geometry (built before the player / vehicles join the scene).
const t0 = performance.now();
const physics = await Physics.create(scene, level.ground.heightAt ? level.ground : null);
console.info(`collision: ${physics.triangles.toLocaleString()} triangles in ${(performance.now() - t0).toFixed(0)} ms (BVH in a worker)`);
level.init?.(physics);
// trees and shrubs that landed inside a house or a rock are left out (src/physics.js; window.clipAudit lists the rest)
const buriedFlora = dropBuriedFlora(scene, physics);
if (buriedFlora) console.info(`flora: ${buriedFlora} buried instances left out`);
// the traveller's ship at this world's arrival point (src/ship/); a new game opens with the prologue
// (no ?level and prologue.done unset, or ?prologue=1 to replay it)
const playPrologue = levelId === 'desert' && !viaShip && (query.get('prologue') === '1' || (!levelParam && !game.flag('prologue.done')));
// coming home by ship ends the story (src/ship/homecoming.js); ?ending=1 replays it
const playHomecoming = levelId === 'home' && ((viaShip && !game.flag('ending.done')) || query.get('ending') === '1');
const ship = new Ship({ scene, physics, level, levelId, content, prologue: playPrologue || playHomecoming });
level.ship ??= { pos: ship.rampFoot.clone() };
const auditRoots = scene.children.slice();   // the level and the ship: what the clipping audit looks over (window.clipAudit)   // quests that say "return to the ship" point at its ramp
const reactiveWorld = new ReactiveWorld(scene, level, physics, content);
window.addEventListener('pagehide', () => reactiveWorld.flush());
// tile world-spanning meshes so each pass only draws what it can see
const tiled = tileScene(scene);
tiled.small.push(...(level.smallProps ?? []));
await stage('waking the people…');
// the bird's promise: under open sky, in a world with no mount of its own, the whistle calls her down (src/bird.js)
if (birdAnswers(levelId, level, (k) => game.flag(k))) { level.mount = (p) => promisedBird(p, level.spawn); level.mountName = 'bird'; }
const player = new Player(physics, {
  mount: level.mount, jetpack: level.features.jetpack, climb: level.features.climb ?? true,
  killY: level.killY, limit: level.limit ?? 1900, spawn: level.spawn, spawnHeading: level.spawnHeading,
  gravityAt: level.gravityAt, unsafe: level.unsafe, dynamic: level.dynamic,
  // a hurt: a thud; knocked over (a hard landing: the ragdoll, src/ragdoll.js): a heavier one;
  // knocked out: the screen dims and asks to restart (updateRestart below)
  onHurt: (k) => { shipSfx.rumble(sound, 0.35 + k * 0.4, 0.25 + k * 0.5); hpShown = 3; },
  onKnockdown: (dead) => { shipSfx.rumble(sound, dead ? 0.95 : 0.6, dead ? 0.9 : 0.45); hpShown = 3; },
  onKnockout: (why) => { knockedOut = why; },
  onWhistle: (kind) => sound.whistle(kind),   // calling the bike, the bird or a taxi
  onRestart: () => { ship.cinema?.fade(1, true, 0.05); setTimeout(() => ship.cinema?.fade(0, true, 0.9), 120); },
});
// the health bar (index.html #health): only while you're hurt, and a moment after
const hpEl = document.getElementById('health'), hpFill = hpEl?.firstElementChild;
let hpShown = 0;
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
    restartEl.querySelector('p').textContent = knockedOut === 'fall' ? 'That was too far a fall.' : 'You were knocked out.';
    restartEl.querySelector('small').textContent = controllerActive ? `${confirmKey()} restart` : isTouch ? 'tap to restart' : 'Enter to restart';
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
function updateHealth(dt) {
  updateRestart(dt);
  if (!hpEl) return;
  const h = player.health ?? 1;
  hpShown = h < 0.999 || player.down ? 3 : Math.max(0, hpShown - dt);
  hpEl.classList.toggle('on', hpShown > 0 && !ship.playing);
  hpEl.classList.toggle('low', h < 0.3);
  hpFill.style.width = `${(h * 100).toFixed(1)}%`;
}
player.vehicles.push(...(level.vehicles ?? []));
// rooms off the map, reached through doorways (the desert's chambers and the cave in the
// giant's chest, ~1 km up): no whistling the mount or hailing a taxi into them; it would
// come to the same x, z on the dunes far below and wait there
const offMapRooms = (level.portals ?? []).filter((p) => p.to && !p.toUp && p.to.y - (terrain.heightAt?.(p.to.x, p.to.z) ?? p.to.y) > 200).map((p) => p.to);
const inOffMapRoom = () => offMapRooms.some((r) => r.distanceToSquared(player.pos) < 90 * 90);
player.opts.canSummon = () => !inOffMapRoom() && !ship?.inside;   // (nor from inside the ship)
const lib = await animLib;
if (lib) {
  player.animator = player._animator = new Animator(lib, player.char);
  console.info('clip ground speeds (m/s):', Object.fromEntries(Object.entries(lib.native).map(([k, v]) => [k, +v.toFixed(2)])));
}
const humanT = await humans;
const travellerTemplate = await traveller;
if (humanT && travellerTemplate) {
  // the traveller: the people's own body and skeleton, the suit painted on, the gear of traveller.glb worn on top (src/traveller.js)
  player.humanoid = new Humanoid(humanT[0], player.char, 'm', { outfit: travellerTemplate });
} else if (humanT) {
  player.humanoid = new Humanoid(humanT[0], player.char, 'm', { skin: '#e9b9a0', gloves: player.char.colors.gloves, suit: true });
  player.humanoid.setHeadwear('short', { hair: '#8a5638' });
}
player.attach(scene);
const heroMaterials = markHero(player.char.root);
markHero(player.gear?.device, heroMaterials);
markHero(player.cape?.mesh, heroMaterials);
if (player.mount) scene.add(player.mount.object);

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
resize();
if (footprints) player.onStep = (p, heading, up) => footprints.add(p, heading, up);

// local lights: the 8 nearest to the player go to the shader each frame
const levelLights = level.lights ?? (level.lights = []);
const jetLight = new THREE.Vector4();
function updateLights() {
  const L = sharedUniforms.uLights.value;
  const p = player.pos;
  const ranked = levelLights
    .map((l) => [l, (l.x - p.x) ** 2 + (l.y - p.y) ** 2 + (l.z - p.z) ** 2])
    .filter(([l, d]) => d < (l.w + 250) ** 2)
    .sort((a, b) => a[1] - b[1]);
  let n = 0;
  if (player.thrusting) {
    jetLight.set(p.x, p.y + 0.6, p.z, 7 + Math.random() * 1.5);   // the flame flickers on nearby walls
    L[n++].copy(jetLight);
  }
  for (const [l] of ranked) { if (n >= 8) break; L[n++].copy(l); }
  for (; n < 8; n++) L[n].set(0, -1e5, 0, 0);
}
wind = new WindStreaks();
wind.uniforms.tNormal.value = gbuffer.textures[1];
wind.uniforms.uRes.value.copy(post.uniforms.uRes.value);
wind.uniforms.uInk.value = post.uniforms.uInk.value;
// the recordings' hologram (src/ship/hologram.js): light drawn over the composite, hidden behind what the G-buffer holds
HOLO.uniforms.tNormal.value = gbuffer.textures[1];
const rig = new CameraRig(camera, renderer.domElement, physics);
rig.yaw = level.camYaw;
rig.pitch = level.camPitch ?? rig.pitch;
rig.constrain = level.constrainCamera;

// ------------------------------------------------------------------ sound, weather, people, story
const sound = new Sound(levelId);
// the magic-fluid backpack: shoot, boost and push on three shared charges (fluid-tool.js)
const tool = new FluidTool({ scene, player, physics, camera, rig, sound, level, hud: new ToolHud(), noShadow: (level.noShadow ??= []) });
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
const npcs = spawnNPCs(scene, physics, content.npcs, { lib, humans: humanT });
// city crowds: hundreds of GPU-animated people, the nearest few promoted to full NPCs (crowd.js)
const crowd = level.crowdSpots ? new Crowd(scene, physics, {
  spots: { lines: level.crowdLines, ...level.crowdSpots() },
  clear: content.npcs.map((s) => ({ x: s.at[0], y: s.y, z: s.at[1], r: 3 })),
  makeNPC: (kind) => pooledNPC(scene, physics, { kind, lib, humans: humanT }),
}) : null;
if (crowd) { npcs.push(...crowd.npcs); console.info(`crowd: ${crowd.people.length} people in ${crowd.groups.length} groups, placed in ${crowd.buildMs.toFixed(0)} ms`); }
registerNPCTargets(npcs);   // the fluid tool can splash or shove anyone
const journal = new Journal(LEVELS.map((l) => ({ id: l.id, title: l.title, hidden: l.hidden, relicNames: CONTENT[l.id].relics.names, storyTitle: CONTENT[l.id].story.title })));
const errands = new Errands({ levelId, defs: ERRANDS, npcs, journal, titles: Object.fromEntries(LEVELS.map((l) => [l.id, l.title])), capture: (e, l, w, h) => captureView(e, l, w, h), sound });
const capture = (eye, look, w, h) => captureView(eye, look, w, h);
const relics = new Relics(scene, physics, { levelId, spots: content.relics.spots, names: content.relics.names, journal, sound, capture, lights: levelLights });
// the route: the worlds you know of (src/story/route.js); finishing this one names the next on the ship's map
const worldDone = (id) => !!(game.flag(`world.${id}.done`) || journal.storyDone(id));
const known = () => knownWorlds({ order: ORDER, done: worldDone, visited: (id) => journal.seen(id), current: levelId });
let knownBefore = known();
const revealed = () => {
  const now = known(), fresh = newlyKnown(knownBefore, now);
  knownBefore = now;
  return revealNote(fresh.map((id) => levelById(id).title));   // "New on the ship's map: …", and the signature reads there too
};
journal.known = (id) => !ORDER.includes(id) || known().includes(id);   // the sketchbook leaves out worlds you don't know yet
const story = new Story(scene, { levelId, def: { ...content.story, next: revealed }, journal, sound, capture, player, physics, ground: level.ground.heightAt ? level.ground : null });
const expedition = level.observatory ? new ObservatoryQuest({ model: level.observatory, journal, traveler: npcs[5], story, capture, sound }) : null;
// ---- story: conversations, quests, the world's people and places (src/story/, src/interact.js)
const showToast = (text) => ship.cinema.toast(text);   // queued, and held while a scene has the screen dark (src/ship/cinema.js)
player.onNotice = showToast;   // "It needs power." (a vehicle without the backpack)
const preStory = new Set(scene.children);
const storyRt = createStory({ levelId, scene, physics, level, player, npcs, crowd, sound, journal, story, lib, humans: humanT, toast: showToast, tool,
  capture: (e, l, w, h, o) => captureView(e, l, w, h, o) });
for (const c of scene.children) if (!preStory.has(c)) auditRoots.push(c);   // (and what the world's story placed)
story.waitFor = () => storyRt.dialogue.open;   // a story page never opens over a conversation: it waits for its end
// E: boarding a vehicle and turning a lens share the interact button with talking (nearest wins)
registerInteractable({ id: 'vehicle', priority: PRIORITY.vehicle, range: 6, at: () => player.nearestVehicle()?.pos,
  prompt: () => { const v = player.nearestVehicle(); return v?.kind === 'taxi' ? 'get in the taxi' : v?.powered && !items.has('backpack') ? `ride the ${level.mountName ?? v?.kind} (it needs power)` : `ride the ${level.mountName ?? v?.kind ?? 'mount'}`; },
  distance: (p) => { const v = p.nearestVehicle(); return v && !p.boarding && !p.unboarding ? v.pos.distanceTo(p.pos) : Infinity; }, use: () => player.interact() });
if (expedition) registerInteractable({ id: 'lens', priority: PRIORITY.use, range: 1, prompt: 'turn the lens', distance: (p) => (expedition.nearby(p) >= 0 ? 0 : Infinity), use: () => {} });
const scout = new Scout({ scene, player, physics, sound, label: document.getElementById('scout-label'),
  getTarget: () => nextObjective({ player, expedition, story, relics, ship: level.ship, level, quest: () => storyRt.objective() }),
});
// ---- item boxes (src/boxes/): they notice you; E opens one (a Zelda-style scene on the ship's cinematic camera)
const boxes = createBoxes({ levelId, scene, physics, level, player, sound, quests: storyRt.quests, toast: showToast,
  anchor: () => ship.arrivalSpot(),
  quiet: () => ship.playing || storyRt.dialogue.open,   // box quests wait for the landing, the recordings and talk to be over
  cam: { shot: (s) => ship.shot(s), release: (b) => ship.release(b), hud: (on) => ship.cinema.hud(on), bars: (on) => ship.cinema.bars(on) } });
const itemFx = createItemEffects({ player, tool, level, sound, toast: showToast, isNight: () => sky.hour < 6.4 || sky.hour > 19.3 });
journal.sections.unshift(() => gearHtml(items.owned(), { mode: tool.owned && tool.modes.length > 1 ? tool.modeName : null }));   // Select / View opens on your gear
journal.sections.push(() => boxes.journalHtml(Object.fromEntries(LEVELS.map((l) => [l.id, l.title]))));
// the father's charge (src/story/charge.js): the journey's own quest, pinned above everything
const charge = () => chargeState({ flag: (f) => game.flag(f), keepsakes: game.keepsakes(), completed: ship.completed().length });
journal.sections.unshift(() => chargeJournalHtml(charge()));
let chargeKept = null;   // a keepsake just earned: the HUD says what the charge gained, for a while
game.on('keepsake', (k) => { chargeKept = { name: k.name, until: performance.now() + 9000 }; });
// a save from before the charge had its card: letter it once, at the first quiet moment
if (game.flag('prologue.done') && !game.flag(CHARGE_CARD) && !playPrologue && !playHomecoming) {
  game.set(CHARGE_GIVEN, true);
  const wait = setInterval(() => {
    if (busy() || ship.playing || ship.busy() || document.hidden) return;
    clearInterval(wait);
    game.set(CHARGE_CARD, true);
    showChargeCard({ sound });
  }, 4000);
}
const devMenu = new DevMenu({ levelId, levels: LEVELS, boxes, quests: storyRt.quests, story });
window.addEventListener('keydown', (e) => {
  if (!boxes.busy() || e.repeat) return;
  if (e.code === 'Escape') boxes.skip();
  else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') boxes.dismiss();
});
// flora: the world's own plants in clumps, clear of the people, the boxes, the relics, the ship and
// the story's places (src/flora.js); the large ones are solid
const flora = buildFlora({ scene, level, levelId, physics, density: preset.floraDensity ?? 1, keep: floraKeep({ level, content, ship, npcs, crowd, boxes, reactiveWorld }) });
if (flora) {
  tiled.small.push(...flora.small);
  (level.noShadow ??= []).push(...flora.noShadow);
  if (flora.collider) physics.addCollider(flora.collider);
  console.info(`flora: ${flora.count} plants (${flora.largeCount} large) of ${flora.sets.length} species, ${flora.buildMs.toFixed(0)} ms`);
}
// grass blades round the camera on the grassy grounds (src/flora-grass.js), by the graphics preset
blades.grow = () => {
  if (blades.key === preset.key) return;
  blades.key = preset.key;
  if (blades.grass) { blades.grass.dispose(); level.noShadow = level.noShadow.filter((o) => o !== blades.grass.mesh); }
  blades.grass = buildGrass({ scene, level, physics, presetKey: preset.key, water: FLORA_WORLDS[levelId]?.water });
  if (blades.grass) (level.noShadow ??= []).push(blades.grass.mesh);
};
blades.grow();
// wildlife: two or three small species per world, each with a surprise (src/wildlife.js)
const wildlife = new Wildlife(scene, level, physics, { content, sound, defs: level.wildlife });   // (a level may bring its own list: the Lab's rooms)
ship.attach({ player, rig, camera, sound, journal, post, story, wind, npcs, lib, humans: humanT, levels: LEVELS, order: ORDER, titles: Object.fromEntries(LEVELS.map((l) => [l.id, l.title])) });
if (viaShip) {
  const a = ship.arrivalSpot();
  player.respawn(a.pos);
  player.heading = a.heading;
  rig.yaw = a.heading + Math.PI;
  history.replaceState(null, '', `?level=${levelId}`);
}
// continue where you left off (same world, not arriving by ship)
const saved = SaveGame.load();
if (!viaShip && !playPrologue && saved?.level === levelId && saved.pos) {
  const p = new THREE.Vector3(...saved.pos);
  player.respawn(p);
  if (saved.up) player.frame.set(new THREE.Vector3(...saved.up), new THREE.Vector3(...saved.fwd));
  player.heading = saved.heading ?? player.heading;
  rig.yaw = saved.yaw ?? rig.yaw;
}
let resetting = false;   // (a save being started over: nothing more is written to it)
const writeSave = () => !resetting && SaveGame.write({
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
window.addEventListener('blur', () => Object.keys(input).forEach((k) => (input[k] = false)));

// ------------------------------------------------------------------ time of day
const savedEarly = SaveGame.load();
const sky = { hour: !viaShip && savedEarly?.level === levelId && savedEarly.hour !== undefined ? savedEarly.hour : level.defaults.hour, speed: 0 }; // speed in in-game hours per real minute
let atmo = level.atmo(player.pos.x, player.pos.z, player.pos.y);
const script = level.sky?.script ? colourScript(level.sky.script) : undefined;
// (a level with rooms of its own sky, the Lab's biome rooms, hands its colour script over with atmo)
const updateSky = () => applyTimeOfDay(sky.hour, sharedUniforms.uSunDir.value, post.uniforms, atmo, atmo?.script ?? script);
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
const params = {
  preset: level.defaults.preset ?? 'Moebius print',
  debug: 0,
  ink: '#2b211f',
};
const gui = new GUI({ title: 'Memento shader' });
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
fAtmo.add(U.uGrain, 'value', 0, 0.4, 0.01).name('paper grain');
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
const lowDetail = () => preset.lowDetail || (preset.key === 'auto' && adapt.dropped);
function applyDetail() {
  const low = lowDetail();
  U.uAO.value = preset.ao && !low ? baseAO : 0;
  sharedUniforms.uCloudShadows.value = preset.cloudShadows && !low ? baseCloudSh : 0;
  sharedUniforms.uShadowTaps.value = preset.taps;
  U.uPostLite.value = preset.postLite ? 1 : 0;
  for (const n of npcs) n.lowDetail = low;
  if (crowd) {
    const mid = preset.crowdMid ?? crowdRange.midIn;
    Object.assign(crowd.range, { far: Math.min(preset.crowdFar ?? Infinity, crowdRange.far), midIn: Math.min(mid, crowdRange.midIn), midOut: Math.min(mid + 7, crowdRange.midOut),
      shadow: preset.crowdMid ? Math.min(crowdRange.shadow, mid * 0.5) : crowdRange.shadow });
  }
}
function applyQuality() {
  preset = resolveQuality(settings.quality, { handheld, hiDPI: pixelRatio >= 2 });
  quality.renderScale = preset.scale;
  adapt.slow = adapt.fast = adapt.hold = 0; adapt.dropped = false;
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
function adaptQuality(fps, missed) {
  const D = preset.dynamic;
  if (!D || document.hidden || busy() || photo.on) return;
  const { scale, dropped } = adaptScale(adapt, { fps, missed }, D, quality.renderScale);
  if (scale === quality.renderScale) return;
  quality.renderScale = scale;
  if (dropped && !adapt.dropped) { adapt.dropped = true; applyDetail(); }
  resize();
}
settings.on((k) => {
  rig.sensitivity = settings.sensitivity;
  rig.invertY = settings.invertY;
  sound.setVolumes(settings.music, settings.effects);
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
  onBook: () => journal.toggle(true),
  onDebug: () => showPicker(true),
  onQuit: () => quitToTitle(),
  // where you are, at the top of the Start menu
  where: () => `<b>Save ${slots.active}</b>${meta.title} · ${formatPlaytime((slots.meta().playtime ?? 0) + playClock)} played`,
  // (Esc during the ship's scenes is "hold to skip", even in the parts you walk through)
  isBusy: () => story.pageOpen || journal.open || changelog.open || picker.classList.contains('open') || photo.on || storyRt.busy() || ship.busy() || ship.playing || boxes.busy(),
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
// The full-screen menus (Start: settings; View / Select: the sketchbook; what's new) pause
// the game: frame() skips the world while one is open, and the menu music plays over the
// hushed world (src/audio.js menuMusic).
const paused = () => menu.open || journal.open || changelog.open;
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
if (isTouch) new TouchControls(input, rig);
// where the controller's printed letters are (settings), and the Android app: build label, update toast, pause/resume
settings.on((k) => { if (!k || k === 'padFaces') { setFaces(settings.padFaces); menu.syncControls?.(); } });
installAppShell({ sound, label: () => document.getElementById('app-build'), toast: showToast });   // (queued with the rest, src/ship/cinema.js)

// ------------------------------------------------------------------ level picker
const picker = document.getElementById('picker');
const completed = () => !!journal.data.completed;
const cont = SaveGame.load();
if (cont?.level && levelById(cont.level)) {
  const btn = document.createElement('a');
  btn.className = 'continue';
  btn.href = `?level=${cont.level}`;
  btn.textContent = `▶ Continue — ${levelById(cont.level).title}`;
  picker.querySelector('header').after(btn);
}
// only the worlds you know of (src/story/route.js): the rest open as you go. ?level=<id> and the dev menu go anywhere.
const pickable = LEVELS;   // the worlds list (L) is a debug tool: every world, open, whatever you've found (play travels by the ship's map)
picker.querySelector('.cards').innerHTML = pickable.map((l, i) => false ? `
  <div class="card locked"><div class="lock">?</div><div class="txt"><div class="num">${i + 1}</div><h2>???</h2>
    <p>${l.lock?.text ?? `Find every story page and every relic in all ${ORDER.length} worlds.`}</p><div class="moves">${l.lock?.moves ?? 'the final page'}</div></div></div>` : `
  <a class="card${l.id === levelId ? ' current' : ''}" href="?level=${l.id}">
    <img src="thumbs/${l.id}.jpg" alt="" onerror="this.style.visibility='hidden'" />
    <div class="txt">
      <div class="num">${i + 1}</div>
      <h2>${l.title}</h2>
      <div class="src">${l.source}</div>
      <p>${l.blurb}</p>
      <div class="moves">${l.moves}</div>
    </div>
  </a>`).join('');
function showPicker(on) {
  if (on) for (const q of [menu, journal, changelog]) if (q.open) q.toggle(false);
  picker.classList.toggle('open', on);
  if (on) document.exitPointerLock?.();
}
showPicker(query.get('worlds') === '1');   // (the title's and the Start menu's Debug entry) L is a developer shortcut; in play, worlds are chosen on the ship's galactic map (and saves on the title screen)
picker.querySelector('.close').addEventListener('click', () => showPicker(false));
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyL') showPicker(!picker.classList.contains('open'));
  if (e.code === 'Escape' && picker.classList.contains('open')) showPicker(false);
  const n = Number(e.key);
  if (picker.classList.contains('open') && n >= 1 && n <= pickable.length && (!pickable[n - 1].hidden || completed())) location.search = '?level=' + pickable[n - 1].id;
});

// ------------------------------------------------------------------ photo mode
// P: free camera (WASD / Q E, mouse look, SHIFT faster), HUD hidden,
// H toggles the panel, ENTER saves a PNG of the frame.
const photo = { on: false, capture: false, pos: new THREE.Vector3() };
const photoHint = document.getElementById('photo');
const hud = document.getElementById('hud');
function setPhoto(on) {
  photo.on = on;
  if (on) photo.pos.copy(camera.position);
  hud.style.display = on ? 'none' : '';
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
  if (e.code === 'KeyH' && !photo.on) document.body.classList.toggle('help');   // controls help, off by default
  if (e.code === 'KeyP') setPhoto(!photo.on);
  if (photo.on && e.code === 'KeyH') gui.domElement.style.display = gui.domElement.style.display === 'none' ? '' : 'none';
  if (photo.on && e.code === 'Enter') photo.capture = true;
});

// ------------------------------------------------------------------ loop
const timer = new THREE.Timer();
let frameNo = 0;

const status = document.getElementById('status');
let lastStatus = '';
// The status box: where you are, your gauges, and only the prompts for what is right here.
// No standing list of buttons (the settings carry the full controls, H shows the keyboard's);
// a button in a prompt is drawn as a round badge (src/prompt-keys.js).
const RIDE_HINT_MS = 6000;   // a ride's controls show for a few seconds after you get on, then go
const RIDE_KEYS = {
  taxi: 'E get out · W/S throttle · A/D steer · SPACE up · SHIFT down',
  bird: 'E jump off · A/D bank · W dive · S pull up · SPACE flap',
  bike: 'E dismount · W/S throttle · A/D steer · SHIFT boost',
  skiff: 'E step off · W/S throttle · A/D steer · SHIFT boost',
};
// a pad rides on the triggers: RT goes, the stick steers (and tilts a flyer: forward dives, back climbs)
const RIDE_PAD = {
  taxi: 'B / ○ get out · RT / R2 go · LT / L2 brake · left stick steer, forward down, back up · A / × up',
  bird: 'B / ○ jump off · RT / R2 fly on · left stick bank, forward dive, back climb · A / × flap',
  bike: 'B / ○ dismount · RT / R2 go · LT / L2 brake · left stick steer · RB / R1 boost · A / × hop',
  skiff: 'B / ○ step off · RT / R2 go · LT / L2 brake · left stick steer · RB / R1 boost · A / × hop',
};
const rideHint = { kind: null, at: 0 };
function updateHud() {
  const gauge = (v) => { const n = Math.round(v * 10); return `[${'■'.repeat(n)}${'·'.repeat(10 - n)}]`; };
  const RIDE = controllerActive ? RIDE_PAD : RIDE_KEYS;
  const parts = [];
  const now = performance.now();
  if (player.ride) {
    if (rideHint.kind !== player.ride.kind) { rideHint.kind = player.ride.kind; rideHint.at = now; }
    if (now - rideHint.at < RIDE_HINT_MS) parts.push(RIDE[player.ride.kind] ?? RIDE.bike);
  } else {
    rideHint.kind = null;
    if (tool.aiming) parts.push(tool.hudText());
    else {
      if (player.climbing) parts.push(`climbing ${gauge(player.stamina)}`);
      else if (player.stamina < 0.99) parts.push(`stamina ${gauge(player.stamina)}`);
      // the jets burn the tank: a gauge while it's not full (or in the air)
      if (player.canJet && (player.thrusting || tool.jetBurnt)) parts.push(`jets ${gauge(player.jetFuel)}`);
      // what the use button does right here (a prompt with a place to hang floats over it instead: placePrompt)
      if (storyRt.prompt && !storyRt.promptAt) parts.push(`E ${storyRt.prompt}`);
      else if (!storyRt.prompt && expedition?.nearby(player) >= 0) parts.push('observatory lenses');
      else if (player.boarding) parts.push('slotting the backpack in…');
      const shipHint = ship.hud();   // inside the ship and at its ramp, E is the ship's
      // (and while one of its scenes plays, E does nothing at all)
      if (shipHint || ship.playing) { for (let i = parts.length - 1; i >= 0; i--) if (parts[i].startsWith('E ')) parts.splice(i, 1); if (shipHint) parts.unshift(shipHint); }
    }
  }
  // a tracked quest's line wins; otherwise the ship's objective (set by the prologue) and the world's story
  const objective = game.flag('objective');
  // (none during the ship's scenes: in orbit the camps are "1.1 km through the doorway")
  const questLine = ship.playing ? null : expedition?.state.started && !expedition.state.returned ? expedition.hud(player) : storyRt.hud();
  // the father's charge (✦, gold): what a new keepsake added to it, for a while; otherwise whenever nothing nearer is asked
  const kept = chargeKept && now < chargeKept.until ? chargeKept.name : null;
  const chargeLine = ship.playing ? null : chargeHud(charge(), { kept });
  const goal = ship.playing ? '' : (kept && chargeLine) || questLine || [objective && `◆ ${objective}`, expedition && !expedition.state.returned ? expedition.hud(player) : story.hud()].filter(Boolean).join(' · ') || chargeLine || '';
  let text = [atmo.name, ...parts].join(' · ') +
    `\n${goal ? goal + ' · ' : ''}${errands.hud() ? errands.hud() + ' · ' : ''}relics ${journal.relicCount(levelId)}/${content.relics.names.length}`;
  // the pad's names by position: bottom jumps, the right button uses (native-pad.js prints them as the pad does)
  if (controllerActive) text = text.replaceAll('SPACE', 'A / ×').replaceAll('SHIFT', 'L3').replaceAll('W/S', 'left stick').replaceAll('A/D', 'left stick').replace(/\bE\b/g, 'B / ○');
  audioCfg.mute = sound.muted;
  if (text !== lastStatus) { status.innerHTML = badgeLine(text); lastStatus = text; }
}


const busy = () => restartOpen || story.pageOpen || journal.open || changelog.open || picker.classList.contains('open') || menu.open || endingOpen || storyRt.busy() || ship.busy() || boxes.busy();
const noInput = {};
let controllerActive = false;
const hintShown = { text: '', at: -1e9, active: false };
const controllerHint = document.createElement('div');
controllerHint.id = 'controller-hint';
document.body.appendChild(controllerHint);
// what a controller press goes to: the topmost thing open (a story page sits over a conversation)
const pageEl = document.getElementById('page');
const pageUp = () => pageEl.classList.contains('open');
const menuRoot = () => restartOpen ? restartEl : boxes.busy() && boxes.card.el ? boxes.card.el : menu.open ? menu.el : changelog.open ? changelog.el : pageUp() ? pageEl : storyRt.dialogue.open ? storyRt.dialogue.el : journal.open ? journal.el : picker.classList.contains('open') ? picker : pageEl;
const closeControllerMenu = () => {
  if (restartOpen) return;   // (only confirm restarts: there is nothing to go back to)
  if (boxes.busy()) boxes.skip();
  else if (menu.open) menu.back();
  else if (changelog.open) changelog.toggle(false);
  else if (pageUp()) pageEl.click();
  else if (storyRt.dialogue.open) storyRt.dialogue.close();
  else if (journal.open) journal.toggle(false);
  else if (picker.classList.contains('open')) showPicker(false);
  else pageEl.click();
};
const controller = new Controller({
  context: () => busy() ? (menuRoot() === storyRt.dialogue.el ? 'talk' : 'menu') : photo.on ? 'photo' : player.ride ? 'ride' : 'game',
  faces: () => padFaces(),
  look: (x, y) => { if (x || y) rig.look(x, y); },
  activity: () => { controllerActive = true; screenInput = false; sound.start(); },   // (where a pad press may start sound: the Android app)
  navigate: (x, y) => menuNavigate(menuRoot(), x, y),
  scroll: amount => { const root = menuRoot(); (root.querySelector('.list, .panel, .sheet') ?? root).scrollTop += amount; },
  action: (name, dt) => {
    if (name === 'zoomOut' || name === 'zoomIn') rig.dist = THREE.MathUtils.clamp(rig.dist * Math.exp((name === 'zoomOut' ? 1 : -1) * dt), 4, 60);
    if (name === 'back') closeControllerMenu();
    // (in a menu, a conversation or a scene: Start toggles the Start menu, Select the sketchbook)
    if (name === 'start') menu.toggle(!menu.open);
    if (name === 'select') journal.toggle(!journal.open);
    if (name === 'confirm') {
      const root = menuRoot();
      if (root.id === 'dialogue') { const f = document.activeElement; if (f?.dataset?.i !== undefined && root.contains(f) && storyRt.dialogue.revealed >= storyRt.dialogue.runner.text.length) f.click(); else storyRt.dialogue.next(); }
      else if (root.id === 'page') root.click();
      else if (root.contains(document.activeElement)) {
        const el = document.activeElement;
        if (el.tagName !== 'SELECT' && el.type !== 'range') el.click();
      }
      else menuNavigate(root, 0, 1);
    }
    if (name === 'settings') menu.toggle(true);
    if (name === 'journal') journal.toggle(true);
    if (name === 'worlds') showPicker(true);
    if (name === 'photo') setPhoto(!photo.on);
    if (name === 'capture') photo.capture = true;
    if (name === 'ping' && !ship.playing) scout.ping();
    if (name === 'call' && !ship.playing) player.callMount();   // the pad's own button for it (the keyboard's E still falls back to it)
    if (name === 'bell' && level.jump) level.jump(1);   // in the Lab, R3 / L3 hop to the next / previous world's room
    else if (name === 'bell') itemFx.ring();   // R3: the bell-note whistle (V)
    if (name === 'l3' && level.jump) level.jump(-1);
  },
});
// The keyboard, the mouse or a finger takes over from the controller (and back on its next use). A pad
// that is connected (the Retroid's own controls) counts as in use until the screen or keys are touched,
// so a handheld shows no touch buttons from the start.
let screenInput = false;
for (const event of ['keydown', 'pointerdown', 'touchstart']) window.addEventListener(event, () => { controllerActive = false; screenInput = true; });


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
// flames, animated every frame, swept moving shadows across the city.
let glowCache = null;
function glowCasters() {
  if (glowCache && glowCache.n === scene.children.length) return glowCache.list;
  const list = [];
  scene.traverse((o) => { if (o.isMesh && !Array.isArray(o.material) && (o.material?.uniforms?.uGlow?.value ?? 0) >= 0.8) list.push(o); });
  glowCache = { n: scene.children.length, list };
  return list;
}

// What each pass draws (perf.js, shadows.js): beyond the camera's frustum culling, small props
// under a pixel or two, rooms off the map you aren't in, and in the shadow passes the casters
// whose shadow can't reach the view or that are smaller than about a texel of that cascade.
const shadowCull = new ShadowCuller(scene);
const smallCull = new SmallCuller(scene);
let roomCull = null;
const shadowDir = new THREE.Vector3();
const frameStats = { calls: 0, tris: 0, n: 0, culled: 0 };
renderer.info.autoReset = false;   // one frame's draw calls over all its passes (the F readout)

/** One shadow pass: place the cascade, hide what it doesn't need, render, show it again. */
function shadowPass(c, reach, hide = []) {
  c.place(player.pos);
  const off = shadowCull.hide(reach, c.texel, c.depth, 0.75, hide);
  c.render(renderer, scene);
  frameStats.culled += off.length;
  for (const o of off) o.visible = true;
}

/** The whole pipeline for one view: shadows, G-buffer, composite, overlays. */
const _subjUp = new THREE.Vector3(0, 1, 0);
function renderFrame() {
  renderer.info.reset();
  // the scene graph's matrices once per frame, not once per pass: renderer.render() walks the
  // whole scene to update them every call, and a frame makes four or five calls (~1 ms of CPU)
  scene.matrixWorldAutoUpdate = true;
  scene.updateMatrixWorld();
  scene.matrixWorldAutoUpdate = false;
  // hidden in every pass of this frame (then shown again): far pebbles and shrubs, props under
  // a pixel or two on screen, rooms off the map while the camera is elsewhere
  camera.updateMatrixWorld();
  const frameHidden = [];
  flora?.update(camera, preset.floraFar ?? 1);   // each species draws the plants in view near enough
  blades.grass?.update(camera);
  cullFar(tiled.small, camera, preset.propFar, frameHidden);
  smallCull.hide(camera, gbuffer.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)), preset.propPx, frameHidden);
  (roomCull ??= new RoomCuller(scene, offMapRooms, { keep: [player.object, player.mount?.object, ...player.vehicles.map((v) => v.object ?? v.mesh), ...npcs.map((n) => n.object)] })).hide(camera, frameHidden);

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
  if (turned || frameNo % preset.nearEvery === 0) shadowPass(cascades.near, camToPlayer + cascades.near.extent * 1.8);
  if (turned || frameNo % preset.farEvery === (preset.nearEvery > 1 ? 1 : 0)) {
    const small = tiled.small.filter((o) => o.visible);
    for (const o of small) o.visible = false;   // pebbles and bushes don't need km-wide shadows
    shadowPass(cascades.far, camera.far);
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
  renderer.render(scene, camera);
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

  // 4. wind-blown sand and drifting motes, drawn on top (depth-tested against the G-buffer)
  // (not in a portrait shot: just the person against a flat colour)
  if (!portraitShot) {
    renderer.render(wind.scene, camera);
    if (motes) renderer.render(motes.scene, camera);
    if (HOLO.live()) HOLO.render(renderer, camera, composeRT);   // the recordings' hologram: light, not ink
  }

  // 5. smooth edges and scale the completed frame to the display
  renderer.setRenderTarget(null);
  renderer.render(blit.scene, post.camera);
  for (const o of frameHidden) o.visible = true;
  frameStats.calls += renderer.info.render.calls; frameStats.tris += renderer.info.render.triangles; frameStats.n++;
  scene.matrixWorldAutoUpdate = true;   // (anything else that renders the scene keeps the usual behaviour)
}

/** Render the scene from another viewpoint and grab it as an image (comic panels, sketches). */
const grabCanvas = document.createElement('canvas');
const _cp = new THREE.Vector3(), _cq = new THREE.Quaternion(), _cu = new THREE.Vector3();
// o.keep: draw only these objects (a conversation's portrait), with o.backdrop ('#hex') in place of the sky
let portraitShot = false;
function captureView(eye, look, w, h, { keep = null, backdrop = null, fov = null } = {}) {
  _cp.copy(camera.position); _cq.copy(camera.quaternion); _cu.copy(camera.up);
  camera.position.copy(eye);
  camera.up.copy(player.frame.up);
  camera.lookAt(look);
  const fov0 = camera.fov;
  if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const hidden = keep ? isolate(keep, scene) : [];
  const weather = [U.uRain.value, U.uStorm.value];
  if (keep) {
    portraitShot = true;
    U.uRain.value = U.uStorm.value = 0;
    if (backdrop) { const c = new THREE.Color(backdrop); U.uBackdrop.value.set(c.r, c.g, c.b, 1); }
  }
  try { renderFrame(); } finally {
    restore(hidden);
    portraitShot = false;
    [U.uRain.value, U.uStorm.value] = weather;
    U.uBackdrop.value.w = 0;
    if (fov) { camera.fov = fov0; camera.updateProjectionMatrix(); }
  }
  const src = renderer.domElement;
  const aspect = w / h, sw = src.width, sh = src.height;
  let cw = sw, ch = sw / aspect;
  if (ch > sh) { ch = sh; cw = sh * aspect; }
  grabCanvas.width = w; grabCanvas.height = h;
  grabCanvas.getContext('2d').drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
  camera.position.copy(_cp); camera.quaternion.copy(_cq); camera.up.copy(_cu);
  camera.updateMatrixWorld();
  return grabCanvas.toDataURL('image/jpeg', 0.82);
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
window.addEventListener('keydown', (e) => { if (e.code === 'KeyF' && !photo.on) settings.set('showFps', !settings.showFps); });
function frameReadout(fps) {
  const n = Math.max(frameStats.n, 1), gpu = gpuTimer.take();
  return `${Math.round(fps)} fps · ${(1000 / fps).toFixed(1)} ms (cpu ${(cpuMs / fpsN).toFixed(1)}${gpu !== null ? ` gpu ${gpu.toFixed(1)}` : ''})`
    + ` · ${quality.renderScale}× · ${Math.round(frameStats.calls / n)} calls · ${Math.round(frameStats.tris / n / 1000)}k tris · ${preset.key}`;
}
function frame() {
  const tFrame = performance.now();
  if (lastFrameT && gaps.length < 200) gaps.push(tFrame - lastFrameT);
  lastFrameT = tFrame;
  if (++fpsN, tFrame - fpsT > 500) {
    const fps = (fpsN * 1000) / (tFrame - fpsT);
    if (settings.showFps) fpsEl.textContent = frameReadout(fps);
    adaptQuality(fps, missedFrames());
    fpsN = 0; fpsT = tFrame; cpuMs = 0; gaps.length = 0;
    frameStats.calls = frameStats.tris = frameStats.n = frameStats.culled = 0;
  }
  gpuTimer.enabled = settings.showFps;
  timer.update();
  const rawDt = timer.getDelta();
  const dt = Math.min(rawDt, 1 / 20);
  const padInput = controller.update(dt, !document.hidden && document.hasFocus());
  if (controller.index === null) controllerActive = false;
  else if (!screenInput) controllerActive = true;
  document.body.classList.toggle('controller', controllerActive);
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
  atmo = level.atmo(player.pos.x, player.pos.z, player.pos.y);
  updateSky();
  level.lightAt?.(player.pos, sharedUniforms.uSunDir.value);

  for (const v of player.vehicles) if (v !== player.ride) v.update(dt, null, t);
  // E goes to the nearest person / thing / vehicle first (src/interact.js); only then to the player's whistle
  const ePressed = !!ctl.KeyE && !eWasDown && !photo.on && !player.down; eWasDown = !!ctl.KeyE;   // (no talking while knocked down)
  const interacted = storyRt.update(dt, t, { camera, ePressed, paused: busy() || photo.on || ship.playing }).handled;
  if (photo.on) {
    if (!busy()) photoUpdate(dt, mergedInput);
  } else {
    player.camFwd = camera.getWorldDirection(player.camFwd ?? new THREE.Vector3());   // whistled mounts arrive into view
    const usingLens = expedition?.update(dt, player, ctl, busy());
    if (usingLens && ctl.KeyE) player._eHeld = true; // the same press must not whistle after the last turn
    if (interacted) player._eHeld = true;
    player.update(dt, busy() ? noInput : ctl, rig.yaw);
    rig.follow(player.ride?.heading ?? player.heading, dt, player.riding || player.gliding);
    rig.down = !!player.down;   // knocked down: the camera follows the body on the ground, lower and softer
    rig.update(player.pos, dt, player.frame);
    storyRt.frameCamera(camera);   // the two-shot while talking
  }
  boxes.update(dt, t, { camera });   // (after the player: it poses the kneel; before the ship, which places its camera)
  itemFx.update(dt, t);
  ship.update(dt, t, mergedInput, { photo: photo.on });   // inside / outside, its scenes and their camera
  tool.update(dt, ctl, busy() || photo.on);
  flammables.update(dt, t, player.pos);
  scout.update(dt, busy() || photo.on);
  if (!busy() && !photo.on) scout.placeLabel(camera);
  else if (scout.label) scout.label.hidden = true;
  // flocks circle the player (also in photo mode, so you can fly up to them)
  for (const f of flocks) f.update(dt, t, player.pos, camera.position);
  motes?.update(dt, t, camera.position);
  footprints?.update(dt);
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
    sharedUniforms.uBrush.value.set(player.pos.x, player.riding ? -1e4 : player.pos.y, player.pos.z, Math.hypot(player.vel.x, player.vel.z));
    sharedUniforms.uWind.value.set(wx, wz, (level.features.wind ? 1 : 0.55) * (1 + Wx.storm * 2 + Wx.rain * 0.4), wind.gust());
  }
  // doorways into interiors (and back out)
  portalCool = Math.max(portalCool - dt, 0);
  if (!portalCool && !player.riding && !player.dead && level.portals) {
    for (const pt of level.portals) {
      if (player.pos.distanceTo(pt.at) < pt.r) {
        player.teleport(pt.to, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
        player.heading = pt.heading;
        rig.yaw = pt.heading + Math.PI;
        rig.target.copy(pt.to);
        rig._curDist = 2;
        sound.page();
        portalCool = 1.2;
        break;
      }
    }
  }
  crowd?.update(dt, t, player, camera);
  for (const n of npcs) n.update(dt, player, camera);
  errands.update();
  // only the nearest talking villager shows a balloon
  {
    camera.updateMatrixWorld();   // project with this frame's camera, not last frame's
    let best = null, bd = Infinity;
    for (const n of npcs) if (n.talking) { const d = n.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = n; } }
    const prompted = storyRt.prompt && storyRt.promptEntry?.npc;
    for (const n of npcs) n.placeBalloon(camera, n === best, n === prompted ? 30 : 0);
    if (!busy() && !photo.on) storyRt.placePrompt(camera, controllerActive); else storyRt.placePrompt(camera, false);
  }
  relics.update(dt, t, player);
  story.update(dt, t, camera);
  const rideK = player.ride?.kind;
  if (rideK === 'bird' && (ctl.Space || ctl.Throttle > 0.3) && (flapT -= dt) <= 0) { sound.flap(); flapT = 0.5; }
  sound.update({
    speed: player.riding ? 0 : Math.hypot(player.vel.x, player.vel.z), gust: wind.gust(), storm: Wx.storm, rain: Wx.rainOut, rainRoof: Wx.rainRoof,
    thrusting: player.thrusting, riding: player.riding, rideKind: rideK, rideSpeed: player.ride?.speed ?? 0,
    altitude: player.pos.y - (terrain.heightAt ? terrain.heightAt(player.pos.x, player.pos.z) : player.pos.y),
  });

  // sand: ambient gusts + dust behind the bike
  const pxScale = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / window.innerHeight;
  const b = player.mount;
  if (b && player.ride === b && b.grounded && Math.abs(b.speed) > 10 && world.wind) {
    const [fx, fz] = b.forward;
    for (let i = 0; i < Math.abs(b.speed) / 12; i++)
      wind.emit(b.pos.x - fx * 1.8, b.pos.z - fz * 1.8, b.vel.x * 0.25 - fz * (Math.random() - 0.5) * 6, b.vel.z * 0.25 + fx * (Math.random() - 0.5) * 6);
  }
  wind.update(dt, player.pos, camera, terrain, pxScale, world.wind);
  if (trails) {
    const m = player.mount, moving = Math.hypot(m.vel.x, m.vel.z) > 3;
    m.body.updateMatrixWorld(true);
    trails.forEach((tr, i) => tr.update(dt, moving ? m.body.localToWorld(JETS[i].clone()) : null));
  }
  updateHud();
  if (!busy() && !ship.playing) updateHazards(dt, player, { notice: showToast });   // fire and spines (src/hazards.js)
  updateHealth(dt);
  level.update(dt, t, { player, rig, camera, fade: (k, secs) => ship.cinema?.fade(k, true, secs) });
  reactiveWorld.update(dt, t, player, camera, busy() || photo.on);
  wildlife.update(dt, t, player, camera, busy() || photo.on);
  // levels with zones (the Hangar) switch ink style as you cross between them
  if (level.zoneAt) {
    const zone = level.zoneAt(player.pos);
    if (zone.preset !== params.preset) { params.preset = zone.preset; applyPreset(zone.preset); }
    // a zone may also carry its world's own look, planets and hour (the Lab's biome rooms)
    if (zone !== lastZone) {
      if (zone.look) { for (const [k, v] of Object.entries(zone.look)) if (U[k]) U[k].value = v; gui.controllersRecursive().forEach((c) => c.updateDisplay()); }
      else if (lastZone?.look) applyPreset(params.preset);
      if (zone.planets || lastZone?.planets) setPlanets(zone.planets ?? level.sky?.planets ?? []);
      if (zone.hour !== undefined && lastZone) sky.hour = zone.hour;
      lastZone = zone;
    }
  }

  sharedUniforms.uTime.value = t;
  U.uTime.value = t;
  U.uDebug.value = params.debug;

  gpuTimer.begin();
  renderFrame();
  gpuTimer.end();
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
// Every world's story page and every relic found: a closing page, and the
// final page (the Atelier) opens in the picker.
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
    <div class="p p1"><img src="${imgs[0]}" alt=""><div class="cap"><b>THE END OF THE ROAD</b><br>Seven worlds, thirty-five small things kept.</div></div>
    <div class="p p2"><img src="${imgs[1]}" alt=""></div>
    <div class="p p3"><img src="${imgs[2]}" alt=""><div class="cap">The final page has opened.<br>(L → The Atelier)</div></div>
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
async function warmShaders(targetScene, targetCamera) {
  let timer;
  await Promise.race([
    renderer.compileAsync(targetScene, targetCamera).catch(() => {}),
    new Promise((resolve) => { timer = setTimeout(resolve, 2000); }),
  ]);
  clearTimeout(timer);
}
// instanced props left unculled (rocks, flowers, story props) get real bounds, so every pass can cull them
console.info(`bounds: ${fitBounds(scene)} instanced meshes made cullable`);
await warmShaders(scene, camera);
await warmShaders(post.scene, post.camera);
stage('ready'); console.info(`load: total ${(performance.now() - tLoad).toFixed(0)} ms (after module load)`);
requestAnimationFrame((t) => {
  frame(t);
  markBooted();   // the heartbeat: the Android app keeps a downloaded web build only once it gets here (native-app.js)
  const ld = document.getElementById('loading');
  ld?.classList.add('done');
  setTimeout(() => ld?.remove(), 900);
  ship.start({ via: viaShip ? 'ship' : null, prologue: playPrologue, homecoming: playHomecoming, onReady: () => { if (playHomecoming) journal.markSeen(levelId); else story.start(); } });   // the homecoming is its own page
  if (changelog.fresh) { changelog.markSeen(); setTimeout(() => showToast(`Updated to v${VERSION} · what's new is in the settings`), 4000); }   // after an update: point at what changed, once (not again on the next world; no key: a handheld has none)
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
Object.assign(window, { flora, blades, bloom, shelter, items, flammables, THREE, renderer, scene, camera, player, rig, post, sky, updateSky, terrain, params, wind, input, level, physics, photo, setPhoto, quality, resize, flocks, npcs, relics, story, journal, errands, expedition, scout, weather, sound, captureView, settings, menu, trails, reactiveWorld, tool, crowd, wildlife,
  storyRt, quests: storyRt.quests, dialogue: storyRt.dialogue, ship, game, boxes, devMenu, slots, paused, quitToTitle, clock: () => simT, sharedUniforms, cascades, shadowCull, applyQuality, preset: () => preset, frameStats, renderFrame });
