import * as THREE from 'three';
import { buildDesert } from '../levels/desert.js';
import { buildArzach2 } from '../levels/arzach2.js';
import { buildSpheres } from '../levels/spheres.js';
import { buildBuried } from '../levels/buried.js';
import { buildPerdide2 } from '../levels/perdide2.js';
import { runStepsAsync } from '../load-steps.js';
import { sharedUniforms as SU, setEnvGround } from '../materials.js';
import { createGBuffer, createComposeTarget, createBlit } from '../pipeline.js';
import { createPost, createBloom, PRESETS } from '../post.js';
import { applyTimeOfDay, colourScript } from '../timeofday.js';
import { loadHuman } from '../humanoid.js';
import { loadAnimationLibrary } from '../animator.js';
import { createActors } from './actors.js';
import { loadTravellerV1 } from '../characters/traveller-v1.js';
import { REFERENCE_SCENES, referenceBuilder } from './reference-scenes.js';
import { Physics } from '../physics.js';
import { Bird } from '../bird.js';
import { updateTrailerWorld } from './world.js';
import { Cascade } from '../shadows.js';
import { playVoice } from '../score-voices.js';
import { FATHER_THEME } from '../score.js';
import { exportFilm } from './export.js';
import { scheduleFoley } from './foley.js';
import { SHOTS, DURATION, frameAt } from './timeline.js';

const film = document.querySelector('#film'), ctx = film.getContext('2d');
const status = document.querySelector('#status'), play = document.querySelector('#play');
const record = document.querySelector('#record'), sound = document.querySelector('#sound');
const W = film.width, H = film.height;
const RW = 3840, RH = 2160; // Supersample before the 1440p encode.
let renderer, audio, master, audioStream, recorder, stream, playing = false, elapsed = 0, last = 0, muted = false;
const worlds = new Map();
let active = null;
THREE.ColorManagement.enabled = false;
const camera = new THREE.PerspectiveCamera(52, W / H, 0.5, 5000);
const gbuffer = createGBuffer(), compose = createComposeTarget(), post = createPost(), bloom = createBloom(gbuffer);
const U = post.uniforms, blit = createBlit(compose.texture);
gbuffer.setSize(RW, RH); compose.setSize(RW, RH); bloom.setSize(RW, RH);
U.tAlbedo.value = gbuffer.textures[0]; U.tNormal.value = gbuffer.textures[1]; U.tHatch.value = gbuffer.textures[2];
U.tBloom.value = bloom.texture; U.tBloom2.value = bloom.wide;
U.uRes.value.set(RW, RH); U.uPixelRatio.value = RW / W; SU.uPixelRatio.value = RW / W;
blit.material.uniforms.resolution.value.set(1 / RW, 1 / RH);
const baseLook = THREE.UniformsUtils.clone(U);
const shadowOverride = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });
const cascades = [['0', 1024, 100], ['', 2048, 350], ['2', 2048, 1500]].map(([suffix, size, extent]) =>
  new Cascade({ size, extent, depth: 3200, uniforms: { map: SU[`uShadowMap${suffix}`], matrix: SU[`uShadowMatrix${suffix}`], bias: SU[`uShadowBias${suffix}`], offset: SU[`uShadowNormalOffset${suffix}`] } }));
SU.uShadowTexel.value.set(...cascades.map(c => c.texel));


function activate(id) {
  if (active === id) return;
  active = id;
  const { level, script } = worlds.get(id);
  // Reset world-specific values so one world's haze cannot leak into the next.
  for (const key of new Set(SHOTS.flatMap(s => Object.keys(worlds.get(s.scene ?? s.world).level.defaults.look ?? {})))) U[key].value = baseLook[key].value;
  for (const [key, value] of Object.entries({ ...PRESETS[level.defaults.preset], ...level.defaults.look })) if (U[key]) U[key].value = value;
  setEnvGround(level.envGround ?? level.ground?.mesh?.material?.uniforms?.uColor?.value);
  applyTimeOfDay(level.defaults.hour, SU.uSunDir.value, U, level.atmo?.(0, 0, 0), script);
  for (let i = 0; i < 3; i++) {
    const p = level.sky?.planets?.[i];
    if (!p) { U.uPlanet.value[i].set(0, -1, 0, 0); continue; }
    const el = THREE.MathUtils.degToRad(p.el), az = THREE.MathUtils.degToRad(p.az), c = new THREE.Color(p.color);
    U.uPlanet.value[i].set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az), THREE.MathUtils.degToRad(p.size));
    U.uPlanetColor.value[i].set(c.r, c.g, c.b, p.ring ?? 0);
    U.uPlanetCraters.value.setComponent(i, p.craters === false ? 0 : 1);
  }
  SU.uCloudShadows.value = level.defaults.cloudShadows ?? 1;
  SU.uLightCount.value = Math.min(8, level.lights?.length ?? 0);
  level.lights?.slice(0, 8).forEach((light, i) => SU.uLights.value[i].copy(light));
}
function draw(seconds, dt = 0) {
  const f = frameAt(seconds); activate(f.shot.scene ?? f.shot.world);
  const { scene, level, bird, script, actors } = worlds.get(active);
  const position = [...f.position], look = [...f.look];
  if (f.shot.groundRelative) {
    position[1] += level.ground.heightAt(position[0], position[2]);
    look[1] += level.ground.heightAt(look[0], look[2]);
  }
  camera.fov = f.shot.fov; camera.updateProjectionMatrix();
  camera.position.fromArray(position);
  const target = new THREE.Vector3(...look);
  if (level.stage) { camera.position.applyMatrix4(level.stage.matrixWorld); target.applyMatrix4(level.stage.matrixWorld); }
  camera.lookAt(target); camera.updateMatrixWorld();
  applyTimeOfDay(level.defaults.hour, SU.uSunDir.value, U, level.atmo?.(...position), script);
  level.lightAt?.(camera.position, SU.uSunDir.value);
  if (bird) {
    bird.object.visible = !!f.bird;
    if (f.bird) {
      bird.pos.fromArray(f.bird);
      const [a, b] = f.shot.bird;
      bird.heading = Math.atan2(b[0] - a[0], b[2] - a[2]);
      bird.pitch = -Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2]));
      bird.bank = Math.sin(f.progress * Math.PI * 2) * 0.12;
      bird.flap = seconds * 6; bird.pose(0);
    }
  }
  actors.update(f, dt);
  updateTrailerWorld(level, seconds, dt, camera); SU.uTime.value = seconds; U.uTime.value = seconds;
  scene.overrideMaterial = shadowOverride;
  const hidden = (level.noShadow ?? []).filter(o => o.visible);
  hidden.forEach(o => { o.visible = false; });
  for (const cascade of cascades) { cascade.aim(SU.uSunDir.value); cascade.place(camera.position); cascade.render(renderer, scene); }
  scene.overrideMaterial = null; hidden.forEach(o => { o.visible = true; });
  renderer.setRenderTarget(gbuffer); renderer.setClearColor(0, 0); renderer.clear(); renderer.render(scene, camera);
  bloom.render(renderer);
  U.uInvProj.value.copy(camera.projectionMatrixInverse); U.uCamWorld.value.copy(camera.matrixWorld);
  U.uProj11.value = camera.projectionMatrix.elements[5]; U.uSubject.value.w = -1;
  renderer.setRenderTarget(compose); renderer.clear(); renderer.render(post.scene, post.camera);
  renderer.setRenderTarget(null); renderer.clear(); renderer.render(blit.scene, post.camera);
  ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(renderer.domElement, 0, 0, W, H);
  ctx.fillStyle = '#111b20'; ctx.fillRect(0, 0, W, H * 66 / 720); ctx.fillRect(0, H - H * 66 / 720, W, H * 66 / 720);
  ctx.globalAlpha = f.fade; ctx.fillStyle = '#111b20'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
}
async function soundtrack() {
  if (audio) await audio.close();
  audio = new AudioContext(); await audio.resume();
  master = audio.createGain(); const monitor = audio.createGain();
  monitor.gain.value = muted ? 0 : 1; master.connect(monitor); monitor.connect(audio.destination);
  audioStream = audio.createMediaStreamDestination(); master.connect(audioStream);
  sound.onclick = () => { muted = !muted; monitor.gain.value = muted ? 0 : 1; sound.textContent = muted ? 'Sound off' : 'Sound on'; sound.setAttribute('aria-pressed', String(!muted)); };
  scheduleScore(audio, master, audio.currentTime + 0.1);
}
function scheduleScore(audio, destination, start) {
  const V = { ctx: audio };
  const master = audio.createGain(); master.connect(destination);
  scheduleFoley(audio, master, SHOTS, start);
  master.gain.setValueAtTime(0, start); master.gain.linearRampToValueAtTime(0.8, start + 2);
  master.gain.setValueAtTime(0.8, start + 43); master.gain.linearRampToValueAtTime(0, start + DURATION);
  // The game's father's theme, arranged with its own warm pad and bell voices.
  for (let section = 0; section < 6; section++) {
    const t = start + section * 8, root = [146.83, 130.81, 174.61, 164.81, 130.81, 146.83][section];
    for (const ratio of [1, 1.5, 2]) playVoice(V, 'warm', root * ratio / 2, t, 7, 0.055, master, true);
    let beat = 0;
    for (const [note, length] of FATHER_THEME) {
      playVoice(V, 'sine', root * 2 ** (note / 12), t + beat * 0.75, length * 0.75, 0.12, master);
      beat += length;
    }
  }
}
function stop() {
  playing = false; play.textContent = 'Replay trailer'; play.disabled = false; record.disabled = !canRecord;
  if (recorder?.state === 'recording') recorder.stop();
  audio?.suspend();
  status.textContent = '48-second in-engine trailer · replay or export a video.';
}
function tick(now) {
  if (!playing) return;
  const step = (now - last) / 1000; last = now;
  elapsed = Math.min(DURATION, elapsed + step); draw(elapsed, Math.min(step, 0.1));
  if (elapsed >= DURATION) stop(); else requestAnimationFrame(tick);
}
const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4'].find(m => window.MediaRecorder?.isTypeSupported(m));
const canRecord = !!mime && !!film.captureStream;
async function start(exporting = false) {
  play.disabled = true; record.disabled = true;
  try {
    if (exporting && window.VideoEncoder && window.AudioEncoder) {
      audio?.suspend(); playing = false;
      const blob = await exportFilm({ canvas: film, draw, schedule: scheduleScore, duration: DURATION,
        progress: p => { status.textContent = `Rendering 1440p video · ${Math.round(p * 100)}%`; } });
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'memento-trailer-1440p.webm'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      stop(); status.textContent = 'Exported · 1440p · 30 fps · 48 seconds'; return;
    }
    await soundtrack();
    if (exporting) {
      stream = film.captureStream(30); audioStream.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 24000000 });
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime }), url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = `memento-trailer.${mime.includes('mp4') ? 'mp4' : 'webm'}`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000); stream.getTracks().forEach(t => t.stop());
      };
      recorder.onerror = event => { stop(); stream.getTracks().forEach(t => t.stop()); status.textContent = `Recording failed: ${event.error?.message ?? 'browser encoder error'}`; };
      recorder.start();
    }
    elapsed = 0; last = performance.now(); playing = true;
    status.textContent = exporting ? 'Recording the trailer… the video downloads when it finishes.' : 'Playing · 48 seconds';
    requestAnimationFrame(tick);
  } catch (error) { stop(); status.textContent = `Could not start: ${error.message}`; }
}
// Pause video and audio together when the tab is hidden, including during export.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && playing) {
    playing = false; audio?.suspend();
    if (recorder?.state === 'recording') recorder.pause();
    document.body.dataset.resume = '1';
  } else if (!document.hidden && document.body.dataset.resume) {
    delete document.body.dataset.resume; playing = true; last = performance.now(); audio?.resume();
    if (recorder?.state === 'paused') recorder.resume();
    requestAnimationFrame(tick);
  }
});
play.onclick = () => start(); record.onclick = () => start(true);
sound.onclick = () => { muted = !muted; sound.textContent = muted ? 'Sound off' : 'Sound on'; sound.setAttribute('aria-pressed', String(!muted)); };
try {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setSize(RW, RH); renderer.autoClear = false;
  status.textContent = "Preparing the cast…";
  const [human, lib, outfit] = await Promise.all([loadHuman(), loadAnimationLibrary(), loadTravellerV1(import.meta.env.BASE_URL)]);
  for (const [id, build, title] of [['desert', buildDesert, 'the desert'], ['arzach2', buildArzach2, 'the sky stones'], ['buried', buildBuried, 'the Buried Machine'], ['perdide2', buildPerdide2, 'the Deep Wood'], ['spheres', buildSpheres, 'the Garden of Spheres'], ...Object.keys(REFERENCE_SCENES).map(id => [id, referenceBuilder(id), id])]) {
    status.textContent = `Preparing ${title}…`;
    const scene = new THREE.Scene(), level = await runStepsAsync(build(scene));
    let bird = null;
    if (id === 'arzach2') {
      bird = new Bird({ groundAt: () => 0 }); // Only the game's flight pose runs; the shot authors the flight path.
      bird.landed = false; bird.wingFold = 0; bird.flapPower = 0.6;
      bird.object.visible = false; scene.add(bird.object);
    }
    if (id === 'buried' || id === 'shaft') level.physics = new Physics(scene);
    const actors = createActors(level.stage ?? scene, level, SHOTS.filter(s => (s.scene ?? s.world) === id), human, lib, outfit, bird);
    worlds.set(id, { scene, level, bird, actors, script: level.sky?.script ? colourScript(level.sky.script) : undefined });
    renderer.setRenderTarget(gbuffer);
    await renderer.compileAsync(scene, camera);
  }
  let warmTime = 0;
  for (const shot of SHOTS) { draw(warmTime + shot.duration / 2); warmTime += shot.duration; }
  draw(3); play.disabled = false; record.disabled = !canRecord;
  status.textContent = canRecord ? 'Ready · 48 seconds · 1440p video with music' : 'Ready · video export is unavailable in this browser.';
  // Deterministic framing for capture and visual review; no game/save state is loaded.
  window.trailer = { draw, start, inspect: () => worlds.get(active).actors.inspect(), duration: DURATION, get playing() { return playing; } };
} catch (error) { status.textContent = `The trailer could not load: ${error.message}. Reload to try again.`; console.error(error); }
