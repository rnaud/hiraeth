import * as THREE from 'three';
import { ReactiveWorld } from './reactive-world.js';
import { Controller, mergeControls, menuNavigate } from './controller.js';
import { installNativePad, watchLabels, setSwapAB } from './native-pad.js';
import { installAppShell, markBooted } from './native-app.js';
import { ObservatoryQuest } from './observatory.js';
import { Scout, nextObjective } from './scout.js';
import { Wildlife } from './wildlife.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import GUI from 'lil-gui';
import { sharedUniforms, markHero } from './materials.js';
import { createPost, DEBUG_VIEWS, PRESETS } from './post.js';
import { LEVELS, levelById } from './levels/index.js';
import { Player, CameraRig } from './player.js';
import { applyTimeOfDay, colourScript } from './timeofday.js';
import { WindStreaks } from './wind.js';
import { Physics } from './physics.js';
import { tileScene, cullFar, fitBounds, SmallCuller, RoomCuller, resolveQuality, detectHandheld, GpuTimer } from './perf.js';
import { Cascade, ShadowCuller, shadowDirection } from './shadows.js';
import { Trail } from './trail.js';
import { Flock, Motes, Footprints } from './life.js';
import { Sound } from './audio.js';
import { Weather, WEATHER_KINDS } from './weather.js';
import { spawnNPCs, pooledNPC, registerNPCTargets } from './npc.js';
import { Crowd } from './crowd.js';
import { Journal, Relics, Story, Gate, Errands, turnPage, arriveFromPage } from './quest.js';
import { CONTENT, ERRANDS, nextLevel } from './levels/content.js';
import { loadAnimationLibrary, Animator } from './animator.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadHuman, Humanoid } from './humanoid.js';
import { Changelog, VERSION } from './changelog.js';
import { Settings, SettingsMenu, TouchControls, SaveGame, isTouch, isNativeApp, ToolHud } from './ui.js';
import { FluidTool, bindToolMouse } from './fluid-tool.js';
import { ORDER } from './levels/content.js';
import { createStory } from './story/index.js';
import { registerInteractable, PRIORITY } from './interact.js';
import { Ship } from './ship/ship.js';
import { birdAnswers, promisedBird } from './bird.js';
import { game } from './game-state.js';
import { items, ITEMS } from './items.js';
import { Flammables, flammableSpots } from './flammable.js';
import { createBoxes, migrateSave } from './boxes/index.js';
import { createItemEffects } from './boxes/effects.js';
import { DevMenu } from './dev-menu.js';

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
const gbuffer = new THREE.WebGLRenderTarget(1, 1, {
  count: 3,
  type: THREE.HalfFloatType,
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  depthBuffer: true,
});

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
const composeRT = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
const blit = (() => {
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms),
    vertexShader: FXAAShader.vertexShader,
    fragmentShader: FXAAShader.fragmentShader,
    depthTest: false, depthWrite: false,
  });
  material.uniforms.tDiffuse.value = composeRT.texture;
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  return { scene, material };
})();

const overlays = { motes: null, trail: null };   // sprite overlays sized with the render targets

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const pr = pixelRatio * quality.renderScale;
  const rw = Math.floor(w * pr), rh = Math.floor(h * pr);
  gbuffer.setSize(rw, rh);
  composeRT.setSize(rw, rh);
  blit.material.uniforms.resolution.value.set(1 / rw, 1 / rh);
  post.uniforms.uRes.value.set(rw, rh);
  post.uniforms.uPixelRatio.value = pr;
  sharedUniforms.uPixelRatio.value = pr;
  wind?.uniforms.uRes.value.set(rw, rh);
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
const viaEdge = query.get('via') === 'edge';
const viaGate = query.get('via') === 'gate' || viaEdge;
const viaShip = query.get('via') === 'ship';
const meta = levelById(levelParam) ?? LEVELS[0];
const levelId = meta.id;
const content = CONTENT[levelId];
const animLib = loadAnimationLibrary().catch((e) => { console.warn('animation library failed to load', e); return null; });
const traveller = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}anim/traveller.glb`).then(g => g.scene).catch(e => { console.warn('Traveller unavailable; using the original explorer.', e); return null; });
const humans = Promise.all([loadHuman('m'), loadHuman('f')]).catch((e) => { console.warn('human models failed to load', e); return null; });
await stage(`sketching ${meta.title.toLowerCase()}…`);
const level = meta.create(scene);
const terrain = level.ground;
await stage('inking the collisions…');
// Collision against the real level geometry (built before the player / vehicles join the scene).
const t0 = performance.now();
const physics = await Physics.create(scene, level.ground.heightAt ? level.ground : null);
console.info(`collision: ${physics.triangles.toLocaleString()} triangles in ${(performance.now() - t0).toFixed(0)} ms (BVH in a worker)`);
level.init?.(physics);
// the traveller's ship at this world's arrival point (src/ship/); a new game opens with the prologue
// (no ?level and prologue.done unset, or ?prologue=1 to replay it)
const playPrologue = levelId === 'desert' && !viaGate && !viaShip && (query.get('prologue') === '1' || (!levelParam && !game.flag('prologue.done')));
// coming home by ship ends the story (src/ship/homecoming.js); ?ending=1 replays it
const playHomecoming = levelId === 'home' && ((viaShip && !game.flag('ending.done')) || query.get('ending') === '1');
const ship = new Ship({ scene, physics, level, levelId, content, prologue: playPrologue || playHomecoming });
level.ship ??= { pos: ship.rampFoot.clone() };   // quests that say "return to the ship" point at its ramp
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
});
player.vehicles.push(...(level.vehicles ?? []));
// rooms off the map, reached through doorways (the desert's chambers and the cave in the
// giant's chest, ~1 km up): no whistling the mount or hailing a taxi into them; it would
// come to the same x, z on the dunes far below and wait there
const offMapRooms = (level.portals ?? []).filter((p) => p.to && !p.toUp && p.to.y - (terrain.heightAt?.(p.to.x, p.to.z) ?? p.to.y) > 200).map((p) => p.to);
const inOffMapRoom = () => offMapRooms.some((r) => r.distanceToSquared(player.pos) < 90 * 90);
player.opts.canSummon = () => !inOffMapRoom();
const lib = await animLib;
if (lib) {
  player.animator = player._animator = new Animator(lib, player.char);
  console.info('clip ground speeds (m/s):', Object.fromEntries(Object.entries(lib.native).map(([k, v]) => [k, +v.toFixed(2)])));
}
const humanT = await humans;
const travellerTemplate = await traveller;
if (travellerTemplate) {
  player.humanoid = new Humanoid(travellerTemplate, player.char, 'm', { imported: true });
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
const JETS = [new THREE.Vector3(0.66, -0.08, -1.18), new THREE.Vector3(-0.66, -0.08, -1.18)];   // the pods' rear caps
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
const next = nextLevel(levelId);
const nextTitle = levelById(next).title;
const story = new Story(scene, { levelId, def: { ...content.story, next: nextTitle }, journal, sound, capture, player, physics, ground: level.ground.heightAt ? level.ground : null });
const expedition = level.observatory ? new ObservatoryQuest({ model: level.observatory, journal, traveler: npcs[5], story, capture, sound }) : null;
const gate = (() => {
  const g = content.gate;
  const fromY = levelId === 'incal' ? level.spawn.y + 5 : 1e4;
  const y = physics.groundAt(g.at[0], fromY, g.at[1], 2e4);
  return new Gate(scene, {
    pos: new THREE.Vector3(g.at[0], Number.isFinite(y) ? y : level.spawn.y, g.at[1]), heading: g.heading,
    dest: next, destTitle: nextTitle, sound,
    onTravel: (dest, title) => turnPage(title, () => { location.search = `?level=${dest}&via=gate`; }),
  });
})();
levelLights.push(gate.light);
// ---- story: conversations, quests, the world's people and places (src/story/, src/interact.js)
const showToast = (text) => ship.cinema.toast(text);   // queued, and held while a scene has the screen dark (src/ship/cinema.js)
player.onNotice = showToast;   // "It needs power." (a vehicle without the backpack)
const storyRt = createStory({ levelId, scene, physics, level, player, npcs, crowd, sound, journal, story, lib, humans: humanT, toast: showToast, tool,
  capture: (e, l, w, h) => captureView(e, l, w, h) });
// E: boarding a vehicle and turning a lens share the interact button with talking (nearest wins)
registerInteractable({ id: 'vehicle', priority: PRIORITY.vehicle, range: 6, at: () => player.nearestVehicle()?.pos,
  prompt: () => { const v = player.nearestVehicle(); return v?.kind === 'taxi' ? 'get in the taxi' : v?.powered && !items.has('backpack') ? `ride the ${level.mountName ?? v?.kind} (it needs power)` : `ride the ${level.mountName ?? v?.kind ?? 'mount'}`; },
  distance: (p) => { const v = p.nearestVehicle(); return v && !p.boarding && !p.unboarding ? v.pos.distanceTo(p.pos) : Infinity; }, use: () => player.interact() });
if (expedition) registerInteractable({ id: 'lens', priority: PRIORITY.use, range: 1, prompt: 'turn the lens', distance: (p) => (expedition.nearby(p) >= 0 ? 0 : Infinity), use: () => {} });
const scout = new Scout({ scene, player, physics, sound, label: document.getElementById('scout-label'),
  getTarget: () => nextObjective({ player, expedition, story, relics, gate, level, quest: () => storyRt.objective() }),
});
// ---- item boxes (src/boxes/): they notice you; E opens one (a Zelda-style scene on the ship's cinematic camera)
const boxes = createBoxes({ levelId, scene, physics, level, player, sound, quests: storyRt.quests, toast: showToast,
  anchor: () => ship.arrivalSpot(),
  cam: { shot: (s) => ship.shot(s), release: (b) => ship.release(b), hud: (on) => ship.cinema.hud(on), bars: (on) => ship.cinema.bars(on) } });
const itemFx = createItemEffects({ player, tool, level, sound, toast: showToast, isNight: () => sky.hour < 6.4 || sky.hour > 19.3 });
journal.sections.push(() => boxes.journalHtml(Object.fromEntries(LEVELS.map((l) => [l.id, l.title]))));
const devMenu = new DevMenu({ levelId, levels: LEVELS, boxes, quests: storyRt.quests, story });
window.addEventListener('keydown', (e) => {
  if (!boxes.busy() || e.repeat) return;
  if (e.code === 'Escape') boxes.skip();
  else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') boxes.dismiss();
});
// wildlife: two or three small species per world, each with a surprise (src/wildlife.js)
const wildlife = new Wildlife(scene, level, physics, { content, sound });
ship.attach({ player, rig, camera, sound, journal, post, story, wind, npcs, levels: LEVELS, order: ORDER, titles: Object.fromEntries(LEVELS.map((l) => [l.id, l.title])) });
if (viaShip) {
  const a = ship.arrivalSpot();
  player.respawn(a.pos);
  player.heading = a.heading;
  rig.yaw = a.heading + Math.PI;
  history.replaceState(null, '', `?level=${levelId}`);
}
if (viaGate) {
  const a = gate.arrival();
  player.respawn(a.pos);
  player.heading = a.heading;
  rig.yaw = a.heading;   // camera behind the player, looking away from the gate
  history.replaceState(null, '', `?level=${levelId}`);
}
// ---- seamless travel: walk, ride or glide off the edge of a world into the next one
const EDGE = levelId === 'atelier' || !Number.isFinite(level.limit ?? 1900) ? null : (level.limit ?? 1900) - 50;
const prevLevel = ORDER[(ORDER.indexOf(levelId) + ORDER.length - 1) % ORDER.length];
if (viaEdge && EDGE) {
  // left the last world through its +x edge (side=xp): arrive at this world's -x edge, heading inward, same lateral place
  const side = query.get('side') ?? 'xp', axis = side[0], sgn = side[1] === 'n' ? -1 : 1;
  const lat = THREE.MathUtils.clamp(+(query.get('lat') ?? 0), -0.6, 0.6) * EDGE;
  // the arrival point: near the edge, walking inward until there is ground (the city is smaller than its page)
  let x = 0, z = 0, g = NaN;
  for (let k = EDGE - 220; k >= 0 && !Number.isFinite(g); k -= 60) {
    const inset = -sgn * k, l = lat * (k / EDGE);
    x = axis === 'x' ? inset : l; z = axis === 'x' ? l : inset;
    g = physics.groundAt(x, 1e4, z, 2e4);
  }
  const pos = Number.isFinite(g) ? new THREE.Vector3(x, g + 1, z) : player.pos.clone();
  player.respawn(pos);
  player.heading = axis === 'x' ? (sgn > 0 ? Math.PI / 2 : -Math.PI / 2) : (sgn > 0 ? 0 : Math.PI);
  rig.yaw = player.heading;
  if (query.get('ride') === '1' && player.mount && (!player.mount.powered || items.has('backpack'))) {
    if (player.mount.place) player.mount.place(x, z, player.heading, pos);
    else player.mount.pos.copy(pos);
    player.mount_(player.mount);
  }
}
let edgeLeaving = false;
function edgeTravel() {
  if (!EDGE || edgeLeaving || endingOpen) return null;
  const p = player.ride?.pos ?? player.pos;
  const ax = Math.abs(p.x) > Math.abs(p.z) ? 'x' : 'z', v = p[ax], m = Math.abs(v);
  const dest = v > 0 ? next : prevLevel;
  if (m > EDGE) {
    edgeLeaving = true;
    const lat = (ax === 'x' ? p.z : p.x) / EDGE;
    const ride = player.ride && player.ride === player.mount ? 1 : 0;
    turnPage(levelById(dest).title, () => { location.search = `?level=${dest}&via=edge&side=${ax}${v > 0 ? 'p' : 'n'}&lat=${lat.toFixed(3)}&ride=${ride}`; });
    return null;
  }
  return m > EDGE - 160 ? `the edge of the page · keep going for ${levelById(dest).title}` : null;
}
// continue where you left off (same world, not arriving through a gate)
const saved = SaveGame.load();
if (!viaGate && !viaShip && !playPrologue && saved?.level === levelId && saved.pos) {
  const p = new THREE.Vector3(...saved.pos);
  player.respawn(p);
  if (saved.up) player.frame.set(new THREE.Vector3(...saved.up), new THREE.Vector3(...saved.fwd));
  player.heading = saved.heading ?? player.heading;
  rig.yaw = saved.yaw ?? rig.yaw;
}
const writeSave = () => SaveGame.write({
  level: levelId, pos: player.pos.toArray(), heading: player.heading, yaw: rig.yaw, hour: sky.hour,
  up: player.frame.up.toArray(), fwd: player.frame.fwd.toArray(),
});
setInterval(() => { if (!player.riding && player.onGround && !ship.playing) writeSave(); }, 5000);
window.addEventListener('beforeunload', () => { if (!player.riding && !ship.playing) writeSave(); });

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
const sky = { hour: !viaGate && savedEarly?.level === levelId && savedEarly.hour !== undefined ? savedEarly.hour : level.defaults.hour, speed: 0 }; // speed in in-game hours per real minute
let atmo = level.atmo(player.pos.x, player.pos.z, player.pos.y);
const script = level.sky?.script ? colourScript(level.sky.script) : undefined;
const updateSky = () => applyTimeOfDay(sky.hour, sharedUniforms.uSunDir.value, post.uniforms, atmo, script);
// planets hanging in this level's sky
(level.sky?.planets ?? []).slice(0, 3).forEach((p, i) => {
  const el = THREE.MathUtils.degToRad(p.el), az = THREE.MathUtils.degToRad(p.az);
  post.uniforms.uPlanet.value[i].set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az), THREE.MathUtils.degToRad(p.size));
  const c = new THREE.Color(p.color);
  post.uniforms.uPlanetColor.value[i].set(c.r, c.g, c.b, p.ring ?? 0);
  post.uniforms.uPlanetCraters.value.setComponent(i, p.craters === false ? 0 : 1);
});
updateSky();

// ------------------------------------------------------------------ GUI
const U = post.uniforms;
const params = {
  preset: level.defaults.preset ?? 'Moebius print',
  debug: 0,
  ink: '#2b211f',
};
const gui = new GUI({ title: 'Moebius shader' });
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
const adapt = { slow: 0, fast: 0, dropped: false };
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
  adapt.slow = adapt.fast = 0; adapt.dropped = false;
  const S = preset.shadow;
  cascades.fine.configure(S.fine || 256, cascades.fine.extent);
  if (!S.fine) cascades.fine.disable();
  cascades.near.configure(S.near, preset.nearExtent);
  cascades.far.configure(S.far, cascades.far.extent);
  for (const c of Object.values(cascades)) c.prime(renderer);
  shadowTexels();
  resize();
  applyDetail();
}
/** Dynamic resolution: the render scale follows the frame rate, inside the preset's range (Auto, Handheld). */
function adaptQuality(fps) {
  const D = preset.dynamic;
  if (!D || document.hidden || busy() || photo.on) return;
  if (fps < D.low) { adapt.slow++; adapt.fast = 0; } else if (fps > D.high) { adapt.fast++; adapt.slow = 0; } else adapt.slow = adapt.fast = 0;
  if (adapt.slow >= 3 && quality.renderScale > D.min) {
    const step = fps < D.low * 0.7 ? 0.1 : 0.05;   // well under: a bigger step
    quality.renderScale = Math.max(D.min, +(quality.renderScale - step).toFixed(2));
    adapt.slow = 0;
    if (!adapt.dropped) { adapt.dropped = true; applyDetail(); }
    resize();
  } else if (adapt.fast >= 12 && quality.renderScale < D.max) {
    quality.renderScale = Math.min(D.max, +(quality.renderScale + 0.05).toFixed(2));
    adapt.fast = 0;
    resize();
  }
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
  // (Esc during the ship's scenes is "hold to skip", even in the parts you walk through)
  isBusy: () => story.pageOpen || journal.open || changelog.open || picker.classList.contains('open') || photo.on || storyRt.busy() || ship.busy() || ship.playing || boxes.busy(),
  onResetProgress: () => { reactiveWorld.clear(); localStorage.removeItem('moebius.journal.v1'); SaveGame.clear(); game.reset(); location.href = location.pathname; },   // a new game: the prologue
});
// one panel at a time: J over the open settings drew the sketchbook's quest log under the
// settings card (and O over the sketchbook the other way round)
{
  const panels = [menu, journal, changelog];
  for (const p of panels) {
    const toggle = p.toggle.bind(p);
    p.toggle = (on = !p.open, ...rest) => { if (on) for (const q of panels) if (q !== p && q.open) q.toggle(false); return toggle(on, ...rest); };
  }
}
if (isTouch) new TouchControls(input, rig);
// controller A/B swap (settings), and the Android app: build label, update toast, pause/resume
settings.on((k) => { if (!k || k === 'swapAB') setSwapAB(settings.swapAB); });
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
picker.querySelector('.cards').innerHTML = LEVELS.map((l, i) => l.hidden && !completed() ? `
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
showPicker(!levelParam && !playPrologue);   // L stays a developer shortcut; in play, worlds are chosen on the ship's galactic map
picker.querySelector('.close').addEventListener('click', () => showPicker(false));
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyL') showPicker(!picker.classList.contains('open'));
  if (e.code === 'Escape' && picker.classList.contains('open') && levelParam) showPicker(false);
  const n = Number(e.key);
  if (picker.classList.contains('open') && n >= 1 && n <= LEVELS.length && (!LEVELS[n - 1].hidden || completed())) location.search = '?level=' + LEVELS[n - 1].id;
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
function updateHud() {
  const gauge = (v) => { const n = Math.round(v * 10); return `[${'■'.repeat(n)}${'·'.repeat(10 - n)}]`; };
  const RIDE = {
    taxi: 'E get out · W/S throttle · A/D steer · SPACE up · SHIFT down',
    bird: 'E jump off · A/D bank · W dive · S pull up · SPACE flap',
    bike: 'E dismount · W/S throttle · A/D steer · SHIFT boost',
    skiff: 'E step off · W/S throttle · A/D steer · SHIFT boost',
  };
  const parts = [];
  if (player.ride) parts.push(RIDE[player.ride.kind] ?? RIDE.bike);
  else if (tool.aiming) parts.push(tool.hudText(controllerActive));
  else {
    if (player.climbing) parts.push(`climbing ${gauge(player.stamina)} · SPACE jump off`);
    else if (player.stamina < 0.99) parts.push(`stamina ${gauge(player.stamina)}`);
    // the jets burn the tank: a gauge while it's not full (or in the air)
    if (player.canJet && (player.thrusting || tool.jetBurnt)) parts.push(`jets ${gauge(player.jetFuel)}`);
    if (tool.modes.length > 1 && !player.ride) parts.push(`${controllerActive ? 'D-pad ← →' : isTouch ? '◐' : 'X'} mode: ${tool.modeName}`);
    const near = player.nearestVehicle();
    const unpowered = (v) => v?.powered && !items.has('backpack');   // hoverbikes and skiffs run on the backpack
    if (storyRt.prompt) parts.push(`E ${storyRt.prompt}`);
    else if (expedition?.nearby(player) >= 0) parts.push('observatory lenses');
    else if (player.boarding) parts.push('slotting the backpack in…');
    else if (near && unpowered(near)) parts.push(`the ${level.mountName ?? near.kind} needs power`);
    else if (near) parts.push(`E ${near.kind === 'taxi' ? 'get in the taxi' : 'ride the ' + (level.mountName ?? near.kind)}`);
    else if (player.mount && !inOffMapRoom() && !unpowered(player.mount)) parts.push(`E whistle for the ${level.mountName}`);
    else if (level.features.taxis && !inOffMapRoom()) parts.push('E hail a taxi');
    const shipHint = ship.hud();   // inside the ship and at its ramp, E is the ship's
    // (and while one of its scenes plays, E does nothing at all: no whistling from orbit)
    if (shipHint || ship.playing) { for (let i = parts.length - 1; i >= 0; i--) if (parts[i].startsWith('E ')) parts.splice(i, 1); if (shipHint) parts.unshift(shipHint); }
    if (!parts.length) parts.push('push into a wall to climb it');
  }
  // a tracked quest's line wins; otherwise the ship's objective (set by the prologue) and the world's story
  const objective = game.flag('objective');
  // (none during the ship's scenes: in orbit the camps are "1.1 km through the doorway")
  const questLine = ship.playing ? null : expedition?.state.started && !expedition.state.returned ? expedition.hud(player) : storyRt.hud();
  const goal = ship.playing ? '' : questLine ?? [objective && `◆ ${objective}`, expedition && !expedition.state.returned ? expedition.hud(player) : story.hud()].filter(Boolean).join(' · ');
  const edgeHint = edgeTravel();
  let text = `${atmo.name} · ${parts.join(' · ')}` +
    `\n${goal ? goal + ' · ' : ''}${errands.hud() ? errands.hud() + ' · ' : ''}relics ${journal.relicCount(levelId)}/${content.relics.names.length} · Q ping · R tool · H help` +
    (gate.near ? ` · walk through the gate to ${nextTitle}` : '') + (edgeHint ? ` · ${edgeHint}` : '');
  if (!tool.owned) text = text.replace(' · R tool', '');   // no backpack yet: no tool
  if (isTouch && !controllerActive) text = text.replace(' · Q ping · R tool · H help', '').replace(' · Q ping · H help', '');   // the buttons say it
  if (controllerActive) text = text.replaceAll('SPACE', 'A / ×').replaceAll('SHIFT', 'RT / R2').replaceAll('W/S', 'left stick').replaceAll('A/D', 'left stick').replace(/\bE\b/g, 'X / □').replace('Q ping · R tool · H help', 'Y / △ ping · LT tool · Menu settings').replace('Q ping · H help', 'Y / △ ping · Menu settings');
  audioCfg.mute = sound.muted;
  if (text !== lastStatus) { status.textContent = text; lastStatus = text; }
}


const busy = () => story.pageOpen || journal.open || changelog.open || picker.classList.contains('open') || menu.open || endingOpen || storyRt.busy() || ship.busy() || boxes.busy();
const noInput = {};
let controllerActive = false;
const hintShown = { text: '', at: -1e9, active: false };
const controllerHint = document.createElement('div');
controllerHint.id = 'controller-hint';
document.body.appendChild(controllerHint);
const menuRoot = () => boxes.busy() && boxes.card.el ? boxes.card.el : storyRt.dialogue.open ? storyRt.dialogue.el : menu.open ? menu.el : changelog.open ? changelog.el : journal.open ? journal.el : picker.classList.contains('open') ? picker : document.getElementById('page');
const closeControllerMenu = () => {
  if (boxes.busy()) boxes.skip();
  else if (storyRt.dialogue.open) storyRt.dialogue.close();
  else if (menu.open) menu.toggle(false);
  else if (changelog.open) changelog.toggle(false);
  else if (journal.open) journal.toggle(false);
  else if (picker.classList.contains('open')) showPicker(false);
  else document.getElementById('page').click();
};
const controller = new Controller({
  context: () => busy() ? 'menu' : photo.on ? 'photo' : 'game',
  look: (x, y) => { if (x || y) rig.look(x, y); },
  activity: () => { controllerActive = true; sound.start(); },   // (where a pad press may start sound: the Android app)
  swapAB: () => settings.swapAB,
  navigate: (x, y) => menuNavigate(menuRoot(), x, y),
  scroll: amount => { const root = menuRoot(); (root.querySelector('.list, .panel, .sheet') ?? root).scrollTop += amount; },
  action: (name, dt) => {
    if (name === 'zoomOut' || name === 'zoomIn') rig.dist = THREE.MathUtils.clamp(rig.dist * Math.exp((name === 'zoomOut' ? 1 : -1) * dt), 4, 60);
    if (name === 'back') closeControllerMenu();
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
  },
});
for (const event of ['keydown', 'pointerdown', 'touchstart']) window.addEventListener(event, () => { controllerActive = false; });


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
const _subj = new THREE.Vector3(), _subjUp = new THREE.Vector3(0, 1, 0);
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
  const frameHidden = cullFar(tiled.small, camera, preset.propFar);
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

  // 3. Moebius composite
  U.uInvProj.value.copy(camera.projectionMatrixInverse);
  U.uCamWorld.value.copy(camera.matrixWorld);
  U.uProj11.value = camera.projectionMatrix.elements[5];
  // Projected player size controls how much fine ink detail remains visible.
  _subj.copy(player.pos).addScaledVector(player.frame?.up ?? _subjUp, 0.95).applyMatrix4(camera.matrixWorldInverse);
  const sdep = -_subj.z;
  if (sdep > 0.5 && !player.hidden) {
    _subj.applyMatrix4(camera.projectionMatrix);
    U.uSubject.value.set(_subj.x * 0.5 + 0.5, _subj.y * 0.5 + 0.5, sdep, 1.35 * U.uProj11.value / (2 * sdep));
  } else U.uSubject.value.w = -1;
  renderer.setRenderTarget(composeRT);
  renderer.clear();
  renderer.render(post.scene, post.camera);

  // 4. wind-blown sand and drifting motes, drawn on top (depth-tested against the G-buffer)
  renderer.render(wind.scene, camera);
  if (motes) renderer.render(motes.scene, camera);

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
function captureView(eye, look, w, h) {
  _cp.copy(camera.position); _cq.copy(camera.quaternion); _cu.copy(camera.up);
  camera.position.copy(eye);
  camera.up.copy(player.frame.up);
  camera.lookAt(look);
  renderFrame();
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
let fpsN = 0, fpsT = performance.now(), cpuMs = 0;
window.addEventListener('keydown', (e) => { if (e.code === 'KeyF' && !photo.on) settings.set('showFps', !settings.showFps); });
function frameReadout(fps) {
  const n = Math.max(frameStats.n, 1), gpu = gpuTimer.take();
  return `${Math.round(fps)} fps · ${(1000 / fps).toFixed(1)} ms (cpu ${(cpuMs / fpsN).toFixed(1)}${gpu !== null ? ` gpu ${gpu.toFixed(1)}` : ''})`
    + ` · ${quality.renderScale}× · ${Math.round(frameStats.calls / n)} calls · ${Math.round(frameStats.tris / n / 1000)}k tris · ${preset.key}`;
}
function frame() {
  const tFrame = performance.now();
  if (++fpsN, tFrame - fpsT > 500) {
    const fps = (fpsN * 1000) / (tFrame - fpsT);
    if (settings.showFps) fpsEl.textContent = frameReadout(fps);
    adaptQuality(fps);
    fpsN = 0; fpsT = tFrame; cpuMs = 0;
    frameStats.calls = frameStats.tris = frameStats.n = frameStats.culled = 0;
  }
  gpuTimer.enabled = settings.showFps;
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 20);
  const t = timer.getElapsed();
  const padInput = controller.update(dt, !document.hidden && document.hasFocus());
  if (controller.index === null) controllerActive = false;
  document.body.classList.toggle('controller', controllerActive);
  const hintText = busy() ? 'D-pad / left stick select · A / × confirm · B / ○ back · right stick scroll'
    : photo.on ? 'Left stick fly · right stick look · LB/RB down/up · A / × save · B / ○ exit'
    : tool.owned ? `A / × jump (again in the air: boost) · X / □ use · Y / △ ping · RT / R2 run · LT aim (+ RT shoot) · B / ○ push${tool.modes.length > 1 ? ' · ← → mode' : ''} · ↑ worlds · ↓ photo · View sketchbook · Menu settings`
    : 'A / × jump · X / □ use · Y / △ ping · RT / R2 run · ↑ worlds · ↓ photo · View sketchbook · Menu settings';
  // the button list shows for a few seconds when the controller takes over (or what the buttons do changes),
  // then fades; in menus and photo mode it stays. Set only when it changes (the label rewrite watches the page).
  if (hintText !== hintShown.text || (controllerActive && !hintShown.active)) { if (hintText !== hintShown.text) controllerHint.textContent = hintText; hintShown.text = hintText; hintShown.at = t; }
  hintShown.active = controllerActive;
  document.body.classList.toggle('controller-hint', controllerActive && (busy() || photo.on || t - hintShown.at < 7));
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
  const ePressed = !!ctl.KeyE && !eWasDown && !photo.on; eWasDown = !!ctl.KeyE;
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
  const W = weather.update(dt);
  U.uRain.value = W.rain;
  U.uStorm.value = W.storm;
  U.uFogMul.value *= 1 + W.fog * 2.6 + W.storm * 2.2 + W.rain * 0.6;
  wind.boost = W.storm;
  {
    const [wx, wz] = wind.windDir;
    const k = (level.features.wind ? 2.5 : 1.2) * (1 + W.storm * 3.5 + W.rain * 0.6);
    player.wind.set(wx * k, 0, wz * k);
  }
  // doorways into interiors (and back out)
  portalCool = Math.max(portalCool - dt, 0);
  if (!portalCool && !player.riding && level.portals) {
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
  gate.update(dt, t, player);
  const rideK = player.ride?.kind;
  if (rideK === 'bird' && ctl.Space && (flapT -= dt) <= 0) { sound.flap(); flapT = 0.5; }
  sound.update({
    speed: player.riding ? 0 : Math.hypot(player.vel.x, player.vel.z), gust: wind.gust(), storm: W.storm, rain: W.rain,
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
  level.update(dt, t, { player, rig, camera });
  reactiveWorld.update(dt, t, player, camera, busy() || photo.on);
  wildlife.update(dt, t, player, camera, busy() || photo.on);
  // levels with zones (the Garage) switch ink style as you cross between them
  if (level.zoneAt) {
    const zone = level.zoneAt(player.pos);
    if (zone.preset !== params.preset) { params.preset = zone.preset; applyPreset(zone.preset); }
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
let flapT = 0;
let portalCool = 0;
let eWasDown = false;

// ------------------------------------------------------------------ the ending
// Every world's story page and every relic found: a closing page, and the
// final page (the Atelier) opens in the picker.
let endingOpen = false;
const allDone = () => ORDER.every((id) => journal.storyDone(id) && journal.relicCount(id) >= CONTENT[id].relics.names.length);
setInterval(() => {
  if (journal.data.completed || story.pageOpen || journal.open || !allDone()) return;
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
    <div class="hint">click / E to continue</div></div>`;
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
  if (viaGate) arriveFromPage(meta.title);
  ship.start({ via: viaShip ? 'ship' : viaGate ? 'gate' : null, prologue: playPrologue, homecoming: playHomecoming, onReady: () => { if (playHomecoming) journal.markSeen(levelId); else if (!viaGate) story.start(); } });   // the homecoming is its own page
  if (changelog.fresh) { changelog.markSeen(); setTimeout(() => showToast(`Updated to v${VERSION} · press N to see what's new`), 4000); }   // after an update: point at what changed, once (not again on the next world)
});

// handy for debugging from the console
Object.assign(window, { items, flammables, THREE, renderer, scene, camera, player, rig, post, sky, updateSky, terrain, params, wind, input, level, physics, photo, setPhoto, quality, resize, flocks, npcs, relics, story, gate, journal, errands, expedition, scout, weather, sound, captureView, settings, menu, trails, reactiveWorld, tool, crowd, wildlife,
  storyRt, quests: storyRt.quests, dialogue: storyRt.dialogue, ship, game, boxes, devMenu, sharedUniforms, cascades, shadowCull, applyQuality, preset: () => preset, frameStats });
