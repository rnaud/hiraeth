import * as THREE from 'three';
import GUI from 'lil-gui';
import { sharedUniforms } from './materials.js';
import { createPost, DEBUG_VIEWS, PRESETS } from './post.js';
import { createDesert } from './levels/desert.js';
import { createIncal } from './levels/incal.js';
import { Player, CameraRig } from './player.js';
import { applyTimeOfDay } from './timeofday.js';
import { WindStreaks } from './wind.js';

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
const nearShadow = makeCascade(4096, 220, 1600, 0.25, SU.uShadowMap, SU.uShadowMatrix, SU.uShadowBias);
const farShadow = makeCascade(2048, 1150, 3200, 2.5, SU.uShadowMap2, SU.uShadowMatrix2, SU.uShadowBias2);

const post = createPost();
post.uniforms.tAlbedo.value = gbuffer.textures[0];
post.uniforms.tNormal.value = gbuffer.textures[1];
post.uniforms.tHatch.value = gbuffer.textures[2];

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  gbuffer.setSize(Math.floor(w * pixelRatio), Math.floor(h * pixelRatio));
  post.uniforms.uRes.value.set(w * pixelRatio, h * pixelRatio);
  post.uniforms.uPixelRatio.value = pixelRatio;
  sharedUniforms.uPixelRatio.value = pixelRatio;
  wind?.uniforms.uRes.value.set(w * pixelRatio, h * pixelRatio);
}
window.addEventListener('resize', () => resize());
let wind = null;
resize();

// ------------------------------------------------------------------ world
const LEVELS = { desert: createDesert, incal: createIncal };
const levelId = new URLSearchParams(location.search).get('level') in LEVELS
  ? new URLSearchParams(location.search).get('level') : 'desert';
const level = LEVELS[levelId](scene);
const terrain = level.ground;
const player = new Player(terrain, level.colliders, {
  bike: level.features.bike, jetpack: level.features.jetpack,
  killY: level.killY, spawn: level.spawn, spawnHeading: level.spawnHeading,
});
scene.add(player.object);
if (level.features.bike) scene.add(player.bike.object);
wind = new WindStreaks();
wind.uniforms.tNormal.value = gbuffer.textures[1];
wind.uniforms.uRes.value.copy(post.uniforms.uRes.value);
wind.uniforms.uInk.value = post.uniforms.uInk.value;
const rig = new CameraRig(camera, renderer.domElement, terrain);
rig.yaw = level.camYaw;
rig.constrain = level.constrainCamera;

const input = {};
window.addEventListener('keydown', (e) => {
  input[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => (input[e.code] = false));
window.addEventListener('blur', () => Object.keys(input).forEach((k) => (input[k] = false)));

// ------------------------------------------------------------------ time of day
const sky = { hour: level.defaults.hour, speed: 0 }; // speed in in-game hours per real minute
let atmo = level.atmo(player.pos.x, player.pos.z, player.pos.y);
const updateSky = () => applyTimeOfDay(sky.hour, sharedUniforms.uSunDir.value, post.uniforms, atmo);
updateSky();

// ------------------------------------------------------------------ GUI
const U = post.uniforms;
const params = {
  preset: 'Moebius',
  debug: 0,
  ink: '#2b211f',
};
const gui = new GUI({ title: 'Moebius shader' });
gui.add(params, 'preset', Object.keys(PRESETS)).name('style preset').onChange(applyPreset);
gui.add({ level: levelId }, 'level', { 'Desert (Sable)': 'desert', "L'Incal — city-shaft": 'incal' })
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

const world = { wind: level.features.wind };
const fWorld = gui.addFolder('World');
fWorld.add(world, 'wind').name('wind-blown sand');
fWorld.close();

function applyPreset(name) {
  const p = PRESETS[name];
  for (const [k, v] of Object.entries(p)) if (U[k]) U[k].value = v;
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
}
applyPreset(params.preset);

// ------------------------------------------------------------------ loop
const timer = new THREE.Timer();
let frameNo = 0;

const status = document.getElementById('status');
let lastStatus = '';
function updateHud() {
  let hint;
  if (level.features.jetpack) {
    const n = Math.round(player.fuel * 10);
    hint = `jetpack [${'■'.repeat(n)}${'·'.repeat(10 - n)}] hold SPACE in the air`;
  } else {
    const d = player.bikeDistance();
    hint = player.riding ? 'E dismount · W/S throttle · A/D steer · SHIFT boost'
      : d < 6 ? 'E ride the hoverbike' : 'E whistle for the hoverbike';
  }
  const text = `${atmo.name} · ${hint}`;
  if (text !== lastStatus) { status.textContent = text; lastStatus = text; }
}
document.getElementById('loading')?.remove();

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 20);
  const t = timer.getElapsed();

  if (sky.speed > 0) sky.hour = (sky.hour + (sky.speed / 60) * dt) % 24;
  // region fog / horizon follow the player smoothly (the field itself is smooth)
  atmo = level.atmo(player.pos.x, player.pos.z, player.pos.y);
  updateSky();

  player.update(dt, input, rig.yaw);
  rig.follow(player.bike.heading, dt, player.riding);
  rig.update(player.pos, dt);

  // sand: ambient gusts + dust behind the bike
  const pxScale = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / window.innerHeight;
  const b = player.bike;
  if (level.features.bike && player.riding && Math.abs(b.speed) > 10 && b.grounded && world.wind) {
    const [fx, fz] = b.forward;
    for (let i = 0; i < Math.abs(b.speed) / 12; i++)
      wind.emit(b.pos.x - fx * 1.8, b.pos.z - fz * 1.8, b.vel.x * 0.25 - fz * (Math.random() - 0.5) * 6, b.vel.z * 0.25 + fx * (Math.random() - 0.5) * 6);
  }
  wind.update(dt, player.pos, camera, terrain, pxScale, world.wind);
  updateHud();
  level.update(dt, t);

  sharedUniforms.uTime.value = t;
  U.uTime.value = t;
  U.uDebug.value = params.debug;

  // 1. shadow maps (the wide cascade only refreshes every 3rd frame)
  const lightDir = sharedUniforms.uSunDir.value;
  scene.overrideMaterial = shadowOverride;
  nearShadow.update(player.pos, lightDir);
  nearShadow.render(scene);
  if (frameNo++ % 3 === 0 || sky.speed > 0) {
    farShadow.update(player.pos, lightDir);
    farShadow.render(scene);
  }
  scene.overrideMaterial = null;

  // 2. G-buffer (clearing to 0 marks sky pixels with depth 0)
  camera.updateMatrixWorld();
  renderer.setRenderTarget(gbuffer);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);

  // 3. Moebius composite
  U.uInvProj.value.copy(camera.projectionMatrixInverse);
  U.uCamWorld.value.copy(camera.matrixWorld);
  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(post.scene, post.camera);

  // 4. wind-blown sand, inked on top (depth-tested against the G-buffer)
  renderer.render(wind.scene, camera);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy for debugging from the console
Object.assign(window, { THREE, renderer, scene, camera, player, rig, post, sky, updateSky, terrain, params, wind, input, level });
