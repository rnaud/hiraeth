import * as THREE from 'three';
import GUI from 'lil-gui';
import { sharedUniforms } from './materials.js';
import { createPost, DEBUG_VIEWS, PRESETS } from './post.js';
import { LEVELS, levelById } from './levels/index.js';
import { Player, CameraRig } from './player.js';
import { applyTimeOfDay, colourScript } from './timeofday.js';
import { WindStreaks } from './wind.js';
import { Physics } from './physics.js';
import { tileScene } from './perf.js';
import { Flock, Motes, Footprints } from './life.js';
import { Sound } from './audio.js';
import { Weather, WEATHER_KINDS } from './weather.js';
import { spawnNPCs } from './npc.js';
import { Journal, Relics, Story, Gate, turnPage, arriveFromPage } from './quest.js';
import { CONTENT, nextLevel } from './levels/content.js';
import { loadAnimationLibrary, Animator } from './animator.js';
import { loadHuman, Humanoid } from './humanoid.js';
import { Settings, SettingsMenu, TouchControls, SaveGame, isTouch } from './ui.js';
import { ORDER } from './levels/content.js';

// Loading: each stage updates the inked loading screen, then yields a frame
// so it can paint (its pen animation runs on the compositor meanwhile).
const loadMsg = document.querySelector('#loading .msg');
const stage = (msg) => {
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

// Sun shadow maps: two orthographic cascades that follow the player.
// near = sharp shadows around the player, far = mesas shadowing distant dunes.
const shadowOverride = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });

function makeCascade(size, extent, depth, biasWorld, mapU, matrixU, biasU) {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    format: THREE.RedFormat,
    depthBuffer: true,
    depthTexture: new THREE.DepthTexture(size, size),
  });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2);
  mapU.value = rt.depthTexture;
  biasU.value = biasWorld / depth;
  const ls = new THREE.Vector3();
  return {
    rt,
    // Fixed orientation looking along the light; translate the ortho window in
    // light space and snap it to texels so shadows don't shimmer when moving.
    update(center, dir) {
      cam.position.copy(dir).multiplyScalar(10);
      cam.up.set(0, 1, 0);
      if (Math.abs(dir.y) > 0.99) cam.up.set(0, 0, 1);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      ls.copy(center).applyMatrix4(cam.matrixWorldInverse);
      const texel = (extent * 2) / size;
      ls.x = Math.round(ls.x / texel) * texel;
      ls.y = Math.round(ls.y / texel) * texel;
      cam.left = ls.x - extent;
      cam.right = ls.x + extent;
      cam.bottom = ls.y - extent;
      cam.top = ls.y + extent;
      cam.near = -ls.z - depth / 2;
      cam.far = -ls.z + depth / 2;
      cam.updateProjectionMatrix();
      matrixU.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    },
    render(scene) {
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
    },
  };
}
const SU = sharedUniforms;
const fineShadow = makeCascade(2048, 12, 1600, 0.04, SU.uShadowMap0, SU.uShadowMatrix0, SU.uShadowBias0);
const nearShadow = makeCascade(4096, 220, 1600, 0.25, SU.uShadowMap, SU.uShadowMatrix, SU.uShadowBias);
const farShadow = makeCascade(2048, 1150, 3200, 2.5, SU.uShadowMap2, SU.uShadowMatrix2, SU.uShadowBias2);

const post = createPost();
post.uniforms.tAlbedo.value = gbuffer.textures[0];
post.uniforms.tNormal.value = gbuffer.textures[1];
post.uniforms.tHatch.value = gbuffer.textures[2];

// Supersampling: the whole pipeline renders at renderScale x the device
// resolution into an offscreen target, then is box-filtered down. Lines and
// strokes are sized by the effective pixel ratio, so they keep their look.
const settings = new Settings();
const QUALITY = { low: 0.7, medium: 1, high: pixelRatio >= 2 ? 1 : 1.5 };
const quality = { renderScale: QUALITY[settings.quality] ?? 1 };
const composeRT = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
const blit = (() => {
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { tSrc: { value: composeRT.texture }, uTexel: { value: new THREE.Vector2() } },
    vertexShader: 'out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `precision highp float; uniform sampler2D tSrc; uniform vec2 uTexel; in vec2 vUv; out highp vec4 fragColor;
      void main() {
        vec2 o = uTexel * 0.5;   // four bilinear taps = a box filter over the supersampled pixels
        fragColor = 0.25 * (texture(tSrc, vUv + vec2(-o.x, -o.y)) + texture(tSrc, vUv + vec2(o.x, -o.y))
                          + texture(tSrc, vUv + vec2(-o.x, o.y)) + texture(tSrc, vUv + vec2(o.x, o.y)));
      }`,
    depthTest: false, depthWrite: false,
  });
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  return { scene, material };
})();

const overlays = { motes: null };   // sprite overlays sized with the render targets

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const pr = pixelRatio * quality.renderScale;
  const rw = Math.floor(w * pr), rh = Math.floor(h * pr);
  gbuffer.setSize(rw, rh);
  composeRT.setSize(rw, rh);
  blit.material.uniforms.uTexel.value.set(1 / (w * pixelRatio), 1 / (h * pixelRatio));
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
const levelParam = query.get('level');
const viaGate = query.get('via') === 'gate';
const meta = levelById(levelParam) ?? LEVELS[0];
const levelId = meta.id;
const content = CONTENT[levelId];
const animLib = loadAnimationLibrary().catch((e) => { console.warn('animation library failed to load', e); return null; });
const humans = Promise.all([loadHuman('m'), loadHuman('f')]).catch((e) => { console.warn('human models failed to load', e); return null; });
await stage(`sketching ${meta.title.toLowerCase()}…`);
const level = meta.create(scene);
const terrain = level.ground;
await stage('inking the collisions…');
// Collision against the real level geometry (built before the player / vehicles join the scene).
const t0 = performance.now();
const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
console.info(`collision: ${physics.triangles.toLocaleString()} triangles in ${(performance.now() - t0).toFixed(0)} ms`);
level.init?.(physics);
// tile world-spanning meshes so each pass only draws what it can see
const tiled = tileScene(scene);
await stage('waking the people…');
const player = new Player(physics, {
  mount: level.mount, jetpack: level.features.jetpack, climb: level.features.climb ?? true,
  killY: level.killY, limit: level.limit ?? 1900, spawn: level.spawn, spawnHeading: level.spawnHeading,
  gravityAt: level.gravityAt, unsafe: level.unsafe, dynamic: level.dynamic,
});
player.vehicles.push(...(level.vehicles ?? []));
const lib = await animLib;
if (lib) {
  player.animator = player._animator = new Animator(lib, player.char);
  console.info('clip ground speeds (m/s):', Object.fromEntries(Object.entries(lib.native).map(([k, v]) => [k, +v.toFixed(2)])));
}
const humanT = await humans;
if (humanT) {
  player.humanoid = new Humanoid(humanT[0], player.char, 'm', { skin: '#e9cfb4' });
  player.humanoid.setHeadwear('wizard', { color: player.char.colors.cloak, hair: '#3a2a22' });
}
player.attach(scene);
if (player.mount) scene.add(player.mount.object);

// ambient life
const lifeCfg = level.life ?? {};
const flocks = (lifeCfg.flocks ?? []).map((f) => new Flock(scene, f));
const motes = lifeCfg.motes ? new Motes(scene, lifeCfg.motes) : null;
if (motes) motes.uniforms.tNormal.value = gbuffer.textures[1];
overlays.motes = motes;
const footprints = lifeCfg.footprints ? new Footprints(scene, { color: lifeCfg.footprints }) : null;
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
rig.constrain = level.constrainCamera;

// ------------------------------------------------------------------ sound, weather, people, story
const sound = new Sound(levelId);
const weather = new Weather(content.weather);
{
  const stormColor = { desert: '#e3c58f', arzach: '#e8dfcb' }[levelId];
  if (stormColor) post.uniforms.uStormColor.value.set(stormColor);
}
const npcs = spawnNPCs(scene, physics, content.npcs, { lib, humans: humanT });
const journal = new Journal(LEVELS.map((l) => ({ id: l.id, title: l.title, hidden: l.hidden, relicNames: CONTENT[l.id].relics.names, storyTitle: CONTENT[l.id].story.title })));
const capture = (eye, look, w, h) => captureView(eye, look, w, h);
const relics = new Relics(scene, physics, { levelId, spots: content.relics.spots, names: content.relics.names, journal, sound, capture, lights: levelLights });
const next = nextLevel(levelId);
const nextTitle = levelById(next).title;
const story = new Story(scene, { levelId, def: { ...content.story, next: nextTitle }, journal, sound, capture, player, physics, ground: level.ground.heightAt ? level.ground : null });
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
if (viaGate) {
  const a = gate.arrival();
  player.respawn(a.pos);
  player.heading = a.heading;
  rig.yaw = a.heading;   // camera behind the player, looking away from the gate
  history.replaceState(null, '', `?level=${levelId}`);
}
// continue where you left off (same world, not arriving through a gate)
const saved = SaveGame.load();
if (!viaGate && saved?.level === levelId && saved.pos) {
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
setInterval(() => { if (!player.riding && player.onGround) writeSave(); }, 5000);
window.addEventListener('beforeunload', () => { if (!player.riding) writeSave(); });

// footsteps: prints in the sand + a sound
const onStepPrint = player.onStep;
player.onStep = (p, heading, up, i) => {
  onStepPrint?.(p, heading, up, i);
  sound.step(Math.hypot(player.vel.x, player.vel.z));
};

const input = {};
window.addEventListener('keydown', (e) => {
  input[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => (input[e.code] = false));
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
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
}
applyPreset(params.preset);
gui.close();   // collapsed by default; click the title to open

// ------------------------------------------------------------------ settings, touch
let lastQuality = settings.quality;
settings.on((k) => {
  rig.sensitivity = settings.sensitivity;
  rig.invertY = settings.invertY;
  sound.setVolumes(settings.music, settings.effects);
  gui.domElement.style.display = settings.devPanel ? '' : 'none';
  if (settings.quality !== lastQuality) { lastQuality = settings.quality; quality.renderScale = QUALITY[settings.quality] ?? 1; resize(); }
});
const menu = new SettingsMenu(settings, {
  sound,
  isBusy: () => story.pageOpen || journal.open || picker.classList.contains('open') || photo.on,
  onResetProgress: () => { localStorage.removeItem('moebius.journal.v1'); SaveGame.clear(); location.search = '?level=desert'; },
});
if (isTouch) new TouchControls(input, rig);

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
    <p>Find every story page and every relic in the six worlds.</p><div class="moves">a seventh page</div></div></div>` : `
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
  picker.classList.toggle('open', on);
  if (on) document.exitPointerLock?.();
}
showPicker(!levelParam);
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
function photoUpdate(dt) {
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
  else {
    if (player.climbing) parts.push(`climbing ${gauge(player.stamina)} · SPACE jump off`);
    else if (player.stamina < 0.99) parts.push(`stamina ${gauge(player.stamina)}`);
    if (level.features.jetpack) parts.push(`jetpack ${gauge(player.fuel)}`);
    const near = player.nearestVehicle();
    if (near) parts.push(`E ${near.kind === 'taxi' ? 'get in the taxi' : 'ride the ' + (level.mountName ?? near.kind)}`);
    else if (player.mount) parts.push(`E whistle for the ${level.mountName}`);
    else if (level.features.taxis) parts.push('E hail a taxi');
    if (!parts.length) parts.push('push into a wall to climb it');
  }
  const goal = story.hud();
  const text = `${atmo.name} · ${parts.join(' · ')}` +
    `\n${goal ? goal + ' · ' : ''}relics ${journal.relicCount(levelId)}/${content.relics.names.length} · J sketchbook · M ${sound.muted ? 'unmute' : 'mute'}` +
    (gate.near ? ` · walk through the gate to ${nextTitle}` : '');
  audioCfg.mute = sound.muted;
  if (text !== lastStatus) { status.textContent = text; lastStatus = text; }
}


const busy = () => story.pageOpen || journal.open || picker.classList.contains('open') || menu.open || endingOpen;
const noInput = {};

/** The whole pipeline for one view: shadows, G-buffer, composite, overlays. */
function renderFrame() {
  // 1. shadow maps (the wide cascade only refreshes every 3rd frame)
  const lightDir = sharedUniforms.uSunDir.value;
  scene.overrideMaterial = shadowOverride;
  for (const o of level.noShadow ?? []) o.visible = false;
  fineShadow.update(player.pos, lightDir);
  fineShadow.render(scene);
  nearShadow.update(player.pos, lightDir);
  nearShadow.render(scene);
  if (frameNo++ % 3 === 0 || sky.speed > 0) {
    for (const o of tiled.small) o.visible = false;   // pebbles and bushes don't need km-wide shadows
    farShadow.update(player.pos, lightDir);
    farShadow.render(scene);
    for (const o of tiled.small) o.visible = true;
  }
  scene.overrideMaterial = null;
  for (const o of level.noShadow ?? []) o.visible = true;

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
  const ss = quality.renderScale > 1;
  renderer.setRenderTarget(ss ? composeRT : null);
  renderer.clear();
  renderer.render(post.scene, post.camera);

  // 4. wind-blown sand and drifting motes, drawn on top (depth-tested against the G-buffer)
  renderer.render(wind.scene, camera);
  if (motes) renderer.render(motes.scene, camera);

  // 5. downsample the supersampled frame
  if (ss) {
    renderer.setRenderTarget(null);
    renderer.render(blit.scene, post.camera);
  }
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

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 20);
  const t = timer.getElapsed();
  const ctl = busy() ? noInput : input;

  if (sky.speed > 0) sky.hour = (sky.hour + (sky.speed / 60) * dt) % 24;
  // region fog / horizon follow the player smoothly (the field itself is smooth)
  atmo = level.atmo(player.pos.x, player.pos.z, player.pos.y);
  updateSky();
  level.lightAt?.(player.pos, sharedUniforms.uSunDir.value);

  for (const v of player.vehicles) if (v !== player.ride) v.update(dt, null, t);
  if (photo.on) {
    photoUpdate(dt);
  } else {
    player.update(dt, ctl, rig.yaw);
    rig.follow(player.ride?.heading ?? 0, dt, player.riding);
    rig.update(player.pos, dt, player.frame);
  }
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
  for (const n of npcs) n.update(dt, player, camera);
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
  updateHud();
  level.update(dt, t, { player, rig });
  // levels with zones (the Garage) switch ink style as you cross between them
  if (level.zoneAt) {
    const zone = level.zoneAt(player.pos);
    if (zone.preset !== params.preset) { params.preset = zone.preset; applyPreset(zone.preset); }
  }

  sharedUniforms.uTime.value = t;
  U.uTime.value = t;
  U.uDebug.value = params.debug;

  renderFrame();
  if (photo.capture) savePhoto();

  requestAnimationFrame(frame);
}
let flapT = 0;

// ------------------------------------------------------------------ the ending
// Every world's story page and every relic found: a closing page, and the
// seventh page (the Atelier) opens in the picker.
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
    <div class="p p1"><img src="${imgs[0]}" alt=""><div class="cap"><b>THE END OF THE ROAD</b><br>Six worlds, thirty small things kept.</div></div>
    <div class="p p2"><img src="${imgs[1]}" alt=""></div>
    <div class="p p3"><img src="${imgs[2]}" alt=""><div class="cap">A seventh page has opened.<br>(L → The Atelier)</div></div>
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
await renderer.compileAsync(scene, camera).catch(() => {});
await renderer.compileAsync(post.scene, post.camera).catch(() => {});
requestAnimationFrame((t) => {
  frame(t);
  const ld = document.getElementById('loading');
  ld?.classList.add('done');
  setTimeout(() => ld?.remove(), 900);
  if (viaGate) arriveFromPage(meta.title);
  else story.start();
});

// handy for debugging from the console
Object.assign(window, { THREE, renderer, scene, camera, player, rig, post, sky, updateSky, terrain, params, wind, input, level, physics, photo, setPhoto, quality, resize, flocks, npcs, relics, story, gate, journal, weather, sound, captureView, settings, menu });
