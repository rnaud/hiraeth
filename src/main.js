import * as shipSfx from './ship/sfx.js';
import { updateHazards } from './hazards.js';
import * as THREE from 'three';
import { ReactiveWorld } from './reactive-world.js';
import { Controller, mergeControls, menuNavigate } from './controller.js';
import { installNativePad, watchLabels, setFaces, padFaces, confirmKey, backKey } from './native-pad.js';
import { installAppShell, markBooted } from './native-app.js';
import { ObservatoryQuest } from './observatory.js';
import { Scout, nextObjective, findText, roughDistance, HINT } from './scout.js';
import { guardianHint } from './temples/hints.js';
import { cueText, Cue, PlaceName, Fader, questsPageHtml } from './hud.js';
import { closeHint, inputKind } from './prompt-keys.js';
import { Wildlife } from './wildlife.js';
import { createGBuffer, createComposeTarget, createBlit, setSubject } from './pipeline.js';
import GUI from 'lil-gui';
import { sharedUniforms, markHero, setEnvGround } from './materials.js';
import { createPost, createBloom, DEBUG_VIEWS, PRESETS } from './post.js';
import { LEVELS, levelById } from './levels/index.js';
import { Player, CameraRig } from './player.js';
import { applyTimeOfDay, colourScript } from './timeofday.js';
import { WindStreaks } from './wind.js';
import { EDGE_HINTS, EdgeInk } from './edge.js';
import { HOLO } from './ship/hologram.js';
import { Physics, dropBuriedFloraSteps } from './physics.js';
import { tileSceneSteps, cullFar, fitBounds, SmallCuller, RoomCuller, InteriorCuller, resolveQuality, detectHandheld, GpuTimer, adaptScale, engineLabel } from './perf.js';
import { LodManager, lodView } from './lod.js';
import { skinnedLods } from './skinned-lod.js';
import { buildFloraSteps, floraKeep, FLORA_WORLDS } from './flora.js';
import { buildGrass } from './flora-grass.js';
import { BrushTrail } from './brush.js';
import { Cascade, ShadowCuller, shadowDirection, farPassSkips, selfLitSkips } from './shadows.js';
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
import { CONTENT, ERRANDS } from './levels/content.js';
import { loadAnimationLibrary, Animator } from './animator.js';
import { loadMotionLibrary, matchingSetting } from './motion-match.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadHuman, Humanoid } from './humanoid.js';
import { loadPeople, usesMakeHuman } from './makehuman/people.js';
import { talkFaces, TALK_FACE } from './talk-face.js';
import { updateHands } from './hands.js';
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
import { RIDER_CALL, RIDER_CALL_BEAT } from './story/arzach-data.js';
import { game } from './game-state.js';
import { items, ITEMS, gearHtml } from './items.js';
import { Flammables, flammableSpots } from './flammable.js';
import { createBoxes, migrateSave } from './boxes/index.js';
import { createItemEffects } from './boxes/effects.js';
import { DevMenu } from './dev-menu.js';
import { isolate, restore, portraitPixelRatio } from './story/portrait-bg.js';
import { chargeState, chargeHud, chargeJournalHtml, showChargeCard, GIVEN as CHARGE_GIVEN, CARD as CHARGE_CARD } from './story/charge.js';
import { slots, formatPlaytime } from './save-slots.js';
import { Waters, BreathMeter } from './water.js';
import { Passage, PassageCover, WarmDraw, warmPasses, carryAcross, PASSAGE } from './passage.js';
import { slicer, runStepsAsync } from './load-steps.js';
import { waterShared } from './water-shader.js';

// Android: the handheld's controls come from the app (native-pad.js), and prompts use its button names
installNativePad();
watchLabels();

// Loading: each stage updates the inked loading screen, then yields a frame
// so it can paint (its pen animation runs on the compositor meanwhile).
const loadMsg = document.querySelector('#loading .msg');
const tLoad = performance.now();
let tStage = tLoad, lastMsg = 'start';
// Between stages, the build gives the main thread back every LOAD_BUDGET ms (src/load-steps.js:
// await slice() as often as you like; a world's own build yields from inside itself)
const slice = slicer();
const stage = (msg) => {
  console.info(`load: ${lastMsg} ${(performance.now() - tStage).toFixed(0)} ms`);
  tStage = performance.now(); lastMsg = msg;
  if (loadMsg) loadMsg.textContent = msg;
  return new Promise((r) => requestAnimationFrame(() => setTimeout(() => { slice.reset(); r(); }, 0)));
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
const brushTrail = new BrushTrail(sharedUniforms);   // the plants and the grass feel the traveller pass (src/brush.js)
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
// the people on MakeHuman bodies (src/makehuman/people.js, docs/makehuman.md: the Desert's by default, ?mh=1
// any world's, ?mh=0 none): the body's one file asked for now, while the rest loads
const mhPeople = usesMakeHuman(levelId, query.get('mh')) ? loadPeople(import.meta.env.BASE_URL, levelId).catch((e) => { console.warn('MakeHuman bodies unavailable', e); return null; }) : null;
await stage(`sketching ${meta.title.toLowerCase()}…`);
const level = meta.build ? await runStepsAsync(meta.build(scene), slice) : meta.create(scene);
const terrain = level.ground;
// what the metals see below the horizon: the world's ground (materials.js)
setEnvGround(level.envGround ?? level.ground?.mesh?.material?.uniforms?.uColor?.value);
await slice();
await stage('inking the collisions…');
// Collision against the real level geometry (built before the player / vehicles join the scene).
const t0 = performance.now();
const physics = await Physics.create(scene, level.ground.heightAt ? level.ground : null, slice);
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
const playPrologue = levelId === 'desert' && !viaShip && (query.get('prologue') === '1' || (!levelParam && !game.flag('prologue.done')));
// coming home by ship ends the story (src/ship/homecoming.js); ?ending=1 replays it
const playHomecoming = levelId === 'home' && ((viaShip && !game.flag('ending.done')) || query.get('ending') === '1');
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
  mount: level.mount, jetpack: level.features.jetpack, climb: level.features.climb ?? true,
  killY: level.killY, limit: level.limit ?? 1900, edgeHint: level.edgeHint ?? EDGE_HINTS[levelId] ?? EDGE_HINTS.default, spawn: level.spawn, spawnHeading: level.spawnHeading,
  gravityAt: level.gravityAt, unsafe: level.unsafe, dynamic: level.dynamic, water: waters,
  // a hurt: a thud; knocked over (a hard landing: the ragdoll, src/ragdoll.js): a heavier one;
  // knocked out: the screen dims and asks to restart (updateRestart below)
  onHurt: (k) => { shipSfx.rumble(sound, 0.35 + k * 0.4, 0.25 + k * 0.5); hpShown = 3; },
  onKnockdown: (dead) => { shipSfx.rumble(sound, dead ? 0.95 : 0.6, dead ? 0.9 : 0.45); hpShown = 3; },
  onKnockout: (why) => { knockedOut = why; },
  onWhistle: (kind) => (kind === 'mount' && level.mountName === 'bird' ? sound.tune(RIDER_CALL, RIDER_CALL_BEAT) : sound.whistle(kind)),   // calling the bike, the bird (the rider's call, on the flute) or a taxi
  onRestart: () => { ship.cinema?.fade(1, true, 0.05); setTimeout(() => ship.cinema?.fade(0, true, 0.9), 120); },
});
// the health bar (index.html #health): only while you're hurt, and a moment after
const hpEl = document.getElementById('health'), hpFill = hpEl?.firstElementChild;
let hpShown = 0;
const hpFade = new Fader(3);   // (src/hud.js: while hurt or healing, and 3 s after)
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
// the stamina wheel (index.html #stamina, src/stamina.js): beside the traveller, on the screen,
// while it isn't full and a moment after; red while winded
const stEl = document.getElementById('stamina'), stArc = stEl?.querySelector('.arc');
let stShown = 0, stLast = -1;
const _stP = new THREE.Vector3(), _stR = new THREE.Vector3();
function updateStamina(dt) {
  if (!stEl) return;
  const k = THREE.MathUtils.clamp(player.stamina ?? 1, 0, 1);
  stShown = k < 0.995 || player.winded ? 0.9 : Math.max(0, stShown - dt);
  const on = stShown > 0 && !ship.playing && !photo.on && !player.ride && !player.down && !busy();
  stEl.classList.toggle('on', on);
  stEl.classList.toggle('winded', !!player.winded);
  if (Math.abs(k - stLast) > 0.002) { stArc.setAttribute('stroke-dasharray', `${(k * 100).toFixed(1)} 100`); stLast = k; }
  if (!on && stShown <= 0) return;
  // a little up and to the right of the shoulders, as the camera sees them
  _stR.setFromMatrixColumn(camera.matrixWorld, 0);
  _stP.copy(player.object?.position ?? player.pos).addScaledVector(player.frame.up, 1.75).addScaledVector(_stR, 0.62).project(camera);
  if (_stP.z > 1) return;
  const x = (_stP.x * 0.5 + 0.5) * innerWidth, y = (-_stP.y * 0.5 + 0.5) * innerHeight;
  stEl.style.transform = `translate(${(x - 17).toFixed(1)}px, ${(y - 17).toFixed(1)}px)`;
}
function updateHealth(dt) {
  updateRestart(dt);
  updateStamina(dt);
  if (!hpEl) return;
  const h = player.health ?? 1;
  if (hpShown > 0) { hpFade.update(0, true); hpShown = 0; }   // (a hurt, a knockdown: at once)
  const hpOn = hpFade.update(dt, h < 0.999 || !!player.down);
  hpEl.classList.toggle('on', hpOn && !ship.playing && !photo.on);
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
await slice();
const lib = await animLib;
if (lib) {
  player.animator = player._animator = new Animator(lib, player.char);
  console.info('clip ground speeds (m/s):', Object.fromEntries(Object.entries(lib.native).map(([k, v]) => [k, +v.toFixed(2)])));
  // captured motion (src/motion-match.js, not waited for): the people's own walks always; the
  // traveller's motion matching only when it is switched on (the dev menu, ?mm=1)
  const matching = matchingSetting.get();
  loadMotionLibrary(lib, { matching }).then(() => { if (player.animator) player.animator.matching = matching && !!lib.motion?.db; });
}
const humanT = await humans;
// the people on MakeHuman bodies (each by their age, build and world); the traveller stays on his own body
// (docs/makehuman.md). Without the file, the Quaternius ones.
const peopleT = humanT && mhPeople ? ((await mhPeople)?.humans() ?? humanT) : humanT;
const travellerTemplate = await traveller;
if (humanT && travellerTemplate) {
  // the traveller: the people's own body and skeleton, the suit painted on, the gear of traveller.glb worn on top (src/traveller.js)
  player.humanoid = new Humanoid(humanT[0], player.char, 'm', { outfit: travellerTemplate });
} else if (humanT) {
  player.humanoid = new Humanoid(humanT[0], player.char, 'm', { skin: '#e9b9a0', gloves: player.char.colors.gloves, suit: true });
  player.humanoid.setHeadwear('short', { hair: '#8a5638' });
}
player.attach(scene);
await slice();
const heroMaterials = markHero(player.char.root);
markHero(player.gear?.device, heroMaterials);
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
  sharedUniforms.uLightCount.value = n;   // (the shader looks at these only)
  for (; n < 8; n++) L[n].set(0, -1e5, 0, 0);
}
wind = new WindStreaks();
wind.uniforms.tNormal.value = gbuffer.textures[1];
wind.uniforms.uRes.value.copy(post.uniforms.uRes.value);
wind.uniforms.uInk.value = post.uniforms.uInk.value;
// the ink where you lean on the world's edge (src/edge.js), drawn with the wisps
const edgeInk = new EdgeInk(wind.mesh.material);
wind.scene.add(edgeInk.mesh);
// the recordings' hologram (src/ship/hologram.js): light drawn over the composite, hidden behind what the G-buffer holds
HOLO.uniforms.tNormal.value = gbuffer.textures[1];
const rig = new CameraRig(camera, renderer.domElement, physics);
rig.yaw = level.camYaw;
rig.pitch = level.camPitch ?? rig.pitch;
rig.constrain = level.constrainCamera;
await slice();

// ------------------------------------------------------------------ sound, weather, people, story
const sound = new Sound(levelId);
waters.sound = sound;
player.onSwim = (kind, info) => waters.event(kind, info);   // splashes, strokes, a gasp
// hoverbikes and skiffs skim over any water (bike.js groundAt)
for (const v of player.vehicles) if (v.groundAt && !v.surface) v.surface = (x, y, z) => waters.floorAt(x, y, z);
const breathMeter = new BreathMeter();
// the magic-fluid backpack: shoot, boost and push on three shared charges (fluid-tool.js)
const tool = new FluidTool({ scene, player, physics, camera, rig, sound, level, hud: new ToolHud(), noShadow: (level.noShadow ??= []) });
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
const errands = new Errands({ levelId, defs: ERRANDS, npcs, journal, titles: Object.fromEntries(LEVELS.map((l) => [l.id, l.title])), capture: (e, l, w, h) => captureView(e, l, w, h), sound });
const capture = (eye, look, w, h) => captureView(eye, look, w, h);
const relics = new Relics(scene, physics, { levelId, spots: content.relics.spots, names: content.relics.names, journal, sound, capture, lights: levelLights });
await slice();
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
const story = new Story(scene, { levelId, def: { ...content.story, next: revealed }, journal, sound, capture, player, physics, ground: level.ground.heightAt ? level.ground : null, say: (t) => showToast(t) });
const expedition = level.observatory ? new ObservatoryQuest({ model: level.observatory, journal, traveler: npcs[5], story, capture, sound }) : null;
await slice();
// ---- story: conversations, quests, the world's people and places (src/story/, src/interact.js)
const showToast = (text) => ship.cinema.toast(text);   // queued, and held while a scene has the screen dark (src/ship/cinema.js)
player.onNotice = showToast;   // "It needs power." (a vehicle without the backpack)
const preStory = new Set(scene.children);
const storyRt = createStory({ levelId, scene, physics, level, player, npcs, crowd, sound, journal, story, lib, humans: peopleT, toast: showToast, tool,
  isNight: () => sky.hour < 6.4 || sky.hour > 19.3,
  ship, drone: (out) => (scout && scout.phase !== 'docked' ? out.copy(scout.object.position) : null),   // (home: the scenes wait for the ship's; the dog barks at the drone)
  capture: (e, l, w, h, o) => captureView(e, l, w, h, o) });
for (const c of scene.children) if (!preStory.has(c)) auditRoots.push(c);   // (and what the world's story placed)
story.waitFor = () => storyRt.dialogue.open;   // a story page never opens over a conversation: it waits for its end
await slice();
// E: boarding a vehicle and turning a lens share the interact button with talking (nearest wins)
registerInteractable({ id: 'vehicle', priority: PRIORITY.vehicle, range: 6, at: () => player.nearestVehicle()?.pos,
  prompt: () => { const v = player.nearestVehicle(); return v?.kind === 'taxi' ? 'get in the taxi' : v?.powered && !items.has('backpack') ? `ride the ${level.mountName ?? v?.kind} (it needs power)` : `ride the ${level.mountName ?? v?.kind ?? 'mount'}`; },
  distance: (p) => { const v = p.nearestVehicle(); return v && !p.boarding && !p.unboarding ? v.pos.distanceTo(p.pos) : Infinity; }, use: () => player.interact() });
if (expedition) registerInteractable({ id: 'lens', priority: PRIORITY.use, range: 1, prompt: 'turn the lens', distance: (p) => (expedition.nearby(p) >= 0 ? 0 : Infinity), use: () => {} });
// the scout finds the objective (Q, Y / △, the touch "ping"; src/scout.js): the cue names it and
// how far, at once (a toast would wait its turn), and the quest marker over it shows for a while
// (src/story/quests.js QuestMarker.reveal)
const scoutSaid = { text: '', until: 0 };
const scoutSays = (text, secs) => { scoutSaid.text = text; scoutSaid.until = performance.now() + secs * 1000; };
const scout = new Scout({ scene, player, physics, sound,
  getTarget: () => nextObjective({ player, expedition, story, ship: level.ship, level, quest: () => storyRt.objective() }),
  onFind: (target, d) => { scoutSays(`◆ ${findText(target, d)}`, 5); storyRt.marker.reveal(); },
  onShrug: () => scoutSays('Nothing to find here', 2.5),
  // in a guardian's fight the ping is a hint: the lens on the weak point, the line on the cue (src/temples/hints.js)
  getHint: () => guardianHint(level.temple),
  onHint: (line) => scoutSays(`◇ ${line}`, HINT.say),
});
// a world that wants to show you the way at once (the City-Shaft's jets, just found: up through the ceiling)
game.on('scout:ping', () => { if (!ship.playing && !storyRt.dialogue.open) scout.ping(); });
// ---- item boxes (src/boxes/): they notice you; E opens one (a Zelda-style scene on the ship's cinematic camera)
const boxes = createBoxes({ levelId, scene, physics, level, player, sound, quests: storyRt.quests, toast: showToast,
  anchor: () => ship.arrivalSpot(),
  quiet: () => ship.playing || storyRt.dialogue.open,   // box quests wait for the landing, the recordings and talk to be over
  cam: { shot: (s) => ship.shot(s), release: (b) => ship.release(b), hud: (on) => ship.cinema.hud(on), bars: (on) => ship.cinema.bars(on) } });
const itemFx = createItemEffects({ player, tool, level, sound, camera, toast: showToast, isNight: () => sky.hour < 6.4 || sky.hour > 19.3 });
await slice();
journal.sections.unshift(() => gearHtml(items.owned(), { mode: tool.owned && tool.modes.length > 1 ? tool.modeName : null }));   // Select / View opens on your gear
journal.sections.push(() => boxes.journalHtml(Object.fromEntries(LEVELS.map((l) => [l.id, l.title]))));
// the father's charge (src/story/charge.js): the journey's own quest, pinned above everything
const charge = () => chargeState({ flag: (f) => game.flag(f), keepsakes: game.keepsakes(), completed: ship.completed().length,
  failed: Object.entries(game.data.flags).filter(([k, v]) => k.startsWith('failed.') && v).map(([, v]) => v) });   // (quests that went wrong: src/story/quests.js)
journal.sections.unshift(() => chargeJournalHtml(charge()));
// a keepsake just earned: a toast says what the father's charge gained
game.on('keepsake', (k) => { const line = chargeHud(charge(), { kept: k.name }); if (line) showToast(line); });
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
const devMenu = new DevMenu({ levelId, levels: LEVELS, boxes, quests: storyRt.quests, story,
  // (motion matching for the traveller: src/motion-match.js; its database loads the first time it is switched on)
  matching: lib && {
    get: () => !!player.animator?.matching,
    set: (on) => { matchingSetting.set(on); loadMotionLibrary(lib, { matching: on }).then(() => { if (player.animator) player.animator.matching = on && !!lib.motion?.db; devMenu.render(); }); },
  } });
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
await slice();
ship.attach({ player, rig, camera, sound, journal, post, story, wind, npcs, lib, humans: peopleT, levels: LEVELS, order: ORDER, titles: Object.fromEntries(LEVELS.map((l) => [l.id, l.title])) });
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
  waterShared.uWaterLite.value = low || preset.postLite ? 1 : 0;   // (src/water-shader.js)
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
if (query.get('fps') === '1') settings.showFps = true;   // (the frame readout for this session, not saved: measuring on a handheld)
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
  // the Quests page: where to go now (what the scout would find), the father's charge, the quest log (the sketchbook's own sections)
  quests: () => { const ob = scout.getTarget(); return questsPageHtml({ objective: ob?.label, distance: ob ? roughDistance(player.pos.distanceTo(ob.position)) : '', charge: chargeJournalHtml(charge()), quests: storyRt.quests.journalHtml(), carrying: errands.hud() }); },
  onTrack: (id) => storyRt.quests.track(id),
  onQuit: () => quitToTitle(),
  // an update restarts the game (at the title, in the new build): the position and the time played first
  onBeforeRestart: () => { if (!player.riding && !ship.playing) writeSave(); flushPlay(); reactiveWorld.flush(); },
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
installAppShell({ sound, toast: showToast });   // (queued with the rest, src/ship/cinema.js)

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
  if (on) { document.exitPointerLock?.(); const h = picker.querySelector('header .hint'); if (h) h.textContent = inputKind() === 'keys' ? 'press a number · L to toggle this screen' : closeHint(''); }
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
// right here when it has nothing to float over (the ship's hatch and console, a lens), a ride's
// controls for a few seconds after you get on, and a region's name as you cross into it.
const cue = new Cue(), placeName = new PlaceName();
const rideHint = { kind: null, at: 0 };
function updateHud() {
  const now = performance.now();
  if (player.ride) { if (rideHint.kind !== player.ride.kind) { rideHint.kind = player.ride.kind; rideHint.at = now; } }
  else rideHint.kind = null;
  const quiet = busy() || photo.on || player.dead;
  const lens = !player.ride && expedition?.state.started && !expedition.state.done && expedition.nearby(player) >= 0 ? expedition.hud(player) : null;
  const text = cueText({ quiet, ride: player.ride?.kind ?? null, rideFor: now - rideHint.at, aiming: tool.aiming, shipHint: ship.hud(), shipPlaying: ship.playing,
    prompt: storyRt.prompt, promptAt: storyRt.promptAt, lens, boarding: player.boarding, controller: controllerActive });
  const place = quiet || ship.playing || ship.inside ? '' : placeName.update(atmo?.name, now);
  const found = !quiet && now < scoutSaid.until ? scoutSaid.text : '';   // (what the scout found, a moment)
  cue.set(found || text || place, found || text ? '' : 'place');
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
// (in the order they stack on the screen: what's new, the Start menu, the sketchbook over a box's card, the
// worlds, a story page, a conversation; B / ○ closes the one on top, so the sketchbook opened over a
// conversation or a moment closes first)
const menuRoot = () => restartOpen ? restartEl : changelog.open ? changelog.el : menu.open ? menu.el : journal.open ? journal.el : boxes.busy() && boxes.card.el ? boxes.card.el : picker.classList.contains('open') ? picker : pageUp() ? pageEl : storyRt.dialogue.open ? storyRt.dialogue.el : pageEl;
const closeControllerMenu = () => {
  if (restartOpen) return;   // (only confirm restarts: there is nothing to go back to)
  if (changelog.open) changelog.toggle(false);
  else if (menu.open) menu.back();
  else if (journal.open) journal.toggle(false);
  else if (storyRt.moments.playing) storyRt.moments.skip();   // B / ○ skips a moment (src/story/moment.js)
  else if (boxes.busy()) boxes.skip();
  else if (picker.classList.contains('open')) showPicker(false);
  else if (pageUp()) pageEl.click();
  else if (storyRt.dialogue.open) storyRt.dialogue.close();
  else pageEl.click();
};
const controller = new Controller({
  context: () => busy() ? (menuRoot() === storyRt.dialogue.el ? 'talk' : 'menu') : photo.on ? 'photo' : player.ride ? 'ride' : 'game',
  faces: () => padFaces(),
  look: (x, y) => { if (x || y) rig.look(x, y); },
  activity: () => { controllerActive = true; screenInput = false; sound.start(); },   // (where a pad press may start sound: the Android app)
  navigate: (x, y) => menuNavigate(menuRoot(), x, y),
  scroll: amount => { const root = menuRoot(); (root.querySelector('.list, .panel:not([hidden]), .sheet') ?? root).scrollTop += amount; },
  action: (name, dt) => {
    if (name === 'zoomOut' || name === 'zoomIn') rig.dist = THREE.MathUtils.clamp(rig.dist * Math.exp((name === 'zoomOut' ? 1 : -1) * dt), 4, 60);
    if (name === 'back') closeControllerMenu();
    // (in a menu, a conversation or a scene: Start toggles the Start menu, Select the sketchbook)
    if (name === 'start') { if (storyRt.moments.playing && !menu.open) storyRt.moments.skip(); else menu.toggle(!menu.open); }   // (Menu skips a moment too)
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
    if (name === 'journal' && level.compare) level.compare();   // (the references: View compares the render with its panel)
    else if (name === 'journal') journal.toggle(true);
    if (name === 'worlds') showPicker(true);
    if (name === 'photo') setPhoto(!photo.on);
    if (name === 'capture') photo.capture = true;
    if (name === 'ping' && !ship.playing) scout.ping();
    if (name === 'call' && !ship.playing) player.callMount();   // the pad's own button for it (the keyboard's E still falls back to it)
    if (name === 'bell' && level.jump) level.jump(1);   // in the Lab, R3 / L3 hop to the next / previous world's room
    else if (name === 'bell') itemFx.ring();   // R3: the bell-note whistle (V), and the echo shell plays back
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
  if (turned || frameNo % preset.nearEvery === 0) shadowPass(cascades.near, camToPlayer + cascades.near.extent * 1.8);
  if (turned || frameNo % preset.farEvery === (preset.nearEvery > 1 ? 1 : 0)) {
    // pebbles and bushes don't need km-wide shadows (but a tile of boulders, globes or pillars does)
    const small = farPassSkips(tiled.small, cascades.far.texel);
    for (const o of small) o.visible = false;
    if (preset.lodPx) lod.shadowPass(cascades.far.texel);   // nor detail finer than a texel of it
    shadowPass(cascades.far, camera.far);
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
  waters.renderOver(renderer, camera, { tNormal: gbuffer.textures[1], tAlbedo: gbuffer.textures[0], target: composeRT, toon: U.uToon.value });   // the sun's sparkle; under water, the tint and haze

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
  return css ? grabCanvas.toDataURL('image/png') : grabCanvas.toDataURL('image/jpeg', 0.82);
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
// (first the engine, and a benchmark's label when it sets one: window.__benchLabel, e.g. "camps r2/3")
const ENGINE = window.__fpsEngine = engineLabel(navigator.userAgent, location.search, window.Capacitor);
function frameReadout(fps) {
  const n = Math.max(frameStats.n, 1), gpu = gpuTimer.take();
  return `${ENGINE}${window.__benchLabel ? ` ${window.__benchLabel}` : ''} · ${Math.round(fps)} fps · ${(1000 / fps).toFixed(1)} ms (cpu ${(cpuMs / fpsN).toFixed(1)}${gpu !== null ? ` gpu ${gpu.toFixed(1)}` : ''})`
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
  passage.update(dt);   // a hand-over under way: the move happens here, before the traveller and the camera do
  if (photo.on) {
    if (!busy()) photoUpdate(dt, mergedInput);
  } else {
    player.camFwd = camera.getWorldDirection(player.camFwd ?? new THREE.Vector3());   // whistled mounts arrive into view
    const usingLens = expedition?.update(dt, player, ctl, busy());
    if (usingLens && ctl.KeyE) player._eHeld = true; // the same press must not whistle after the last turn
    if (interacted) player._eHeld = true;
    player.update(dt, busy() ? noInput : ctl, rig.yaw, rig.pitch);   // (the pitch: the jets fly where the camera looks)
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
  scout.flare.eye = camera.position;
  scout.update(dt, busy() || photo.on);
  // flocks circle the player (also in photo mode, so you can fly up to them)
  for (const f of flocks) f.update(dt, t, player.pos, camera.position);
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
    // the one who talks near you says it with their face too (src/talk-face.js; a conversation drives its own)
    if (best?.humanoid && !best.talkTo && best.object.visible && camera.position.distanceTo(best.pos) < TALK_FACE.near) talkFaces.drive(best.humanoid, best.balloonFace());
    talkFaces.update(dt);
    updateHands(dt, { player, npcs, camera });   // the fingers: relaxed, gripping, gesturing with the line (src/hands.js)
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
    flying: player.gliding || player.thrusting, indoor: shelter.indoor, night: sky.hour < 6.4 || sky.hour > 19.3,
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
  if (!busy() && !ship.playing) updateHazards(dt, player, { notice: showToast });   // fire and spines (src/hazards.js)
  updateHealth(dt);
  level.update(dt, t, { player, rig, camera, passage, fade: (k, secs) => ship.cinema?.fade(k, true, secs) });
  reactiveWorld.update(dt, t, player, camera, busy() || photo.on);
  wildlife.update(dt, t, player, camera, busy() || photo.on);
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
  breathMeter.update(player.breath, !!player.swim && (player.swim.under || player.breath < 0.999) && !busy());

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
// The world's own surfaces, a slice at a time: compile() for the whole scene at once built every
// program's source and key in one task (100-500 ms, far longer on a handheld). One object stands
// for each kind of program (its material, and what of the mesh goes into the key: instanced,
// skinned, points or lines, its optional attributes), compiled between yields; then the wait for
// the driver, polled. (A combination missed here compiles at first sight, as it always would.)
const programKind = (o, m) => `${m.id}|${o.isInstancedMesh ? 1 : 0}${o.instanceColor ? 1 : 0}${o.isSkinnedMesh ? 1 : 0}${o.isBatchedMesh ? 1 : 0}${o.isPoints ? 1 : 0}${o.isLine ? 1 : 0}${o.isSprite ? 1 : 0}|${Object.keys(o.geometry?.morphAttributes ?? {}).length}|${['color', 'uv1', 'uv2', 'uv3', 'tangent'].map((a) => (o.geometry?.attributes?.[a] ? 1 : 0)).join('')}`;
// (the scene a program's key is taken from: no lights, fog or environment, as the world's own; an
// empty one, so each compile doesn't walk the whole world looking for lights)
const keyScene = new THREE.Scene();
async function warmShadersSliced(targetScene, targetCamera, target = null, { wear = null } = {}) {
  const reps = new Map();
  targetScene.traverse((o) => {
    if (!o.material || !(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
    for (const m of [wear ?? o.material].flat()) { const k = programKind(o, m); if (!reps.has(k)) reps.set(k, o); }
  });
  const prev = renderer.getRenderTarget(), mats = new Set();
  for (const o of reps.values()) {
    const own = o.material;
    if (wear) o.material = wear;
    try {
      renderer.setRenderTarget(target);
      for (const m of renderer.compile(o, targetCamera, keyScene)) mats.add(m);
    } finally { if (wear) o.material = own; }
    await slice();
  }
  renderer.setRenderTarget(prev);
  // the driver compiles in parallel (KHR_parallel_shader_compile): wait for it a while, yielding
  const pending = () => [...mats].filter((m) => { const p = renderer.properties.get(m).currentProgram; return p && !p.isReady(); }).length;
  const t0 = performance.now();
  while (pending() && performance.now() - t0 < 2000) await new Promise((r) => setTimeout(r, 10));
  return reps.size;
}
// instanced props left unculled (rocks, flowers, story props) get real bounds, so every pass can cull them
console.info(`bounds: ${fitBounds(scene)} instanced meshes made cullable`);
await slice();
{
  const t0 = performance.now();
  const n = await warmShadersSliced(scene, camera, gbuffer);
  console.info(`shaders: ${n} kinds of surface, ${renderer.info.programs.length} programs, ${(performance.now() - t0).toFixed(0)} ms`);
}
await warmShaders(post.scene, post.camera, composeRT);
await slice();
{ const wp = waters.warmPass?.(); if (wp) await warmShaders(wp.scene, wp.camera, composeRT); }   // the water's sparkle pass
await slice();
// the shadow passes draw everything with one depth-only material, a program per kind of mesh
// (instanced, skinned, which attributes): compiled now too, each kind wearing it for the moment
// (a person or a plant first seen in a shadow had stalled a frame on its compile)
await warmShadersSliced(scene, camera, Object.values(cascades).find((c) => c.enabled && c.rt)?.rt ?? null, { wear: shadowOverride });
// The ways through, drawn once ahead (src/passage.js): every room, cave and hall a door or a portal
// leads to, and the ship's rooms, with their geometry and textures on the GPU and the driver's
// pipelines built before the first frame (they used to arrive with the first sight of them); and
// what the first frame will see, so its uploads are spread over the load, a slice at a time,
// instead of all landing in the first frame.
const warmDraw = new WarmDraw(renderer, scene, { passes: warmPasses({ makeGBuffer: createGBuffer, shadowOverride }), lodFull: (o) => lod?.fullOf?.(o) });
{
  const t0 = performance.now();
  scene.updateMatrixWorld();
  rig.update(player.pos, 0, player.frame);   // (the first frame's camera)
  camera.updateMatrixWorld();
  const dests = [...(level.portals ?? []), ...(level.navigationPortals ?? [])].map((p) => p.to).filter(Boolean);
  const view = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const inView = (o) => { try { return !o.frustumCulled || view.intersectsObject(o); } catch { return false; } };
  const seen = warmDraw.meshes().filter((o) => o.visible !== false && (!o.isInstancedMesh || o.count > 0) && inView(o));
  const todo = [...warmDraw.near(dests), ...warmDraw.of(...(ship.parked?.indoor ?? [])), ...warmDraw.near([player.pos], 120), ...seen];
  let n = 0;
  for (let i = 0; i < todo.length; i += 24) { n += warmDraw.draw(todo.slice(i, i + 24)); await slice(); }
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
const passage = new Passage({ cover: new PassageCover(), warm: warmDraw, carry: (c) => carryAcross(player, rig, camera, c), busy: () => !!blades.grass?.placing });
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
Object.assign(window, { waters, flora, blades, bloom, shelter, items, flammables, THREE, renderer, scene, camera, player, rig, post, sky, updateSky, terrain, params, wind, input, level, physics, photo, setPhoto, quality, resize, flocks, npcs, relics, story, journal, errands, expedition, scout, weather, sound, captureView, settings, menu, trails, reactiveWorld, tool, crowd, wildlife,
  storyRt, quests: storyRt.quests, dialogue: storyRt.dialogue, ship, game, passage, warmDraw, boxes, devMenu, slots, paused, quitToTitle, clock: () => simT, sharedUniforms, cascades, shadowCull, applyQuality, preset: () => preset, frameStats, renderFrame, lod: () => lod, skinnedLods, interiorCull });
