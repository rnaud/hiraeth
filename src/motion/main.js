// The Motion page (motion.html): the traveller's two ways of moving compared, drawn by the game's
// own pipeline (shadow cascades, the G-buffer materials, the ink pass of post.js, FXAA):
//   - duo: two travellers in two lanes driven by the same input at the same time (your keyboard
//     or pad, or a scripted run of the gait harness), one on the blended loops (the game's
//     default), one on motion matching (src/motion-match.js); split screen or one view
//   - solo: one traveller and a toggle, with the matcher's live debug: the clip and frame it
//     plays, the cost, the trajectory it predicts against the path walked, the planted feet
//   - people: a row of walkers, each on the library's walk or one of the captured walks
// The live numbers are the harness's (src/gait-course.js measure, as tests/gait-sim.js and
// scripts/mocap/compare.mjs read them). No world loads: a small test course (flat ground, a 12°
// ramp, 18 cm stairs, a few pillars and crates), the people's assets and the captured motion.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sharedUniforms, makeMaterial, markHero } from '../materials.js';
import { createPost, PRESETS } from '../post.js';
import { createGBuffer, createComposeTarget, createBlit, setSubject } from '../pipeline.js';
import { Cascade, shadowDirection } from '../shadows.js';
import { applyTimeOfDay } from '../timeofday.js';
import { loadAnimationLibrary, Animator } from '../animator.js';
import { loadMotionLibrary, MotionMatcher, MATCH } from '../motion-match.js';
import { loadHuman, Humanoid } from '../humanoid.js';
import { Player, buildCharacter } from '../player.js';
import { loadTravellerV1, createTravellerV1 } from '../characters/traveller-v1.js';
import { loadBody as loadMakeHumanBody } from '../makehuman/body.js';
import { MakeHumanPeople } from '../makehuman/people.js';
import { Physics } from '../physics.js';
import { NPC } from '../npc.js';
import { stick as deadzone } from '../controller.js';
import { course, PAGE_RUNS, CAM_PLUS_Z, scriptFrame, runFrames, sampleFrame, measure } from '../gait-course.js';
import { BLANK } from '../studio/people.js';
import { cleanState, encodeState, decodeState, RUN_IDS, RATES, parseWalkers, formatWalkers } from './state.js';

// as in the game (main.js): every colour is authored as a display value and output untouched
THREE.ColorManagement.enabled = false;

const $ = (id) => document.getElementById(id);
const UP = new THREE.Vector3(0, 1, 0);
const view = $('view'), statusEl = $('status'), overlay = $('overlay'), ctx = overlay.getContext('2d');
let state = decodeState(location.search);
const setStatus = (t) => { statusEl.textContent = t; };
const FPS = 60, DT = 1 / FPS;
const COLORS = { v1: '#2b211f', mh: '#2f7f6f', loops: '#3f5fae', mm: '#c8483a', pred: '#c8483a', match: '#2f7f6f', path: '#2b211f', l: '#2b211f', r: '#8a4f9e' };

// ------------------------------------------------------------------ the game's pipeline
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.autoClear = false;
renderer.setPixelRatio(1);
view.prepend(renderer.domElement);
const scene = new THREE.Scene();
const cameras = [new THREE.PerspectiveCamera(38, 1, 0.05, 2000), new THREE.PerspectiveCamera(38, 1, 0.05, 2000)];
const gbuffer = createGBuffer();
const post = createPost();
const U = post.uniforms, SU = sharedUniforms;
U.tAlbedo.value = gbuffer.textures[0];
U.tNormal.value = gbuffer.textures[1];
U.tHatch.value = gbuffer.textures[2];
const composeRT = createComposeTarget();
const blit = createBlit(composeRT.texture);
// the shadow cascades with the game's sizes (main.js): the fine one round the traveller, the near one
const cascades = {
  fine: new Cascade({ name: 'fine', size: 2048, extent: 12, depth: 1600, bias: 3.4, offset: 2.6, uniforms: { map: SU.uShadowMap0, matrix: SU.uShadowMatrix0, bias: SU.uShadowBias0, offset: SU.uShadowNormalOffset0 } }),
  near: new Cascade({ name: 'near', size: 4096, extent: 220, depth: 1600, bias: 2.3, offset: 3.2, uniforms: { map: SU.uShadowMap, matrix: SU.uShadowMatrix, bias: SU.uShadowBias, offset: SU.uShadowNormalOffset } }),
  far: new Cascade({ name: 'far', size: 256, extent: 1150, depth: 3200, bias: 2.2, offset: 2.4, uniforms: { map: SU.uShadowMap2, matrix: SU.uShadowMatrix2, bias: SU.uShadowBias2, offset: SU.uShadowNormalOffset2 } }),
};
for (const c of Object.values(cascades)) c.prime(renderer);
cascades.far.disable();
cascades.near.configure(2048, 80);
cascades.near.prime(renderer);
SU.uShadowTaps.value = 9;
SU.uShadowTexel.value.set(cascades.fine.texel, cascades.near.texel, cascades.far.texel);
SU.uCloudShadows.value = 0;
const shadowOverride = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });
for (const [k, v] of Object.entries(PRESETS['Moebius print'])) if (U[k]) U[k].value = v;
applyTimeOfDay(10.5, SU.uSunDir.value, U, null);
U.uBackdrop.value.set(0.933, 0.914, 0.871, 0);

const dpr = () => Math.min(devicePixelRatio, 2);
let cssW = 1, cssH = 1;
function resize() {
  cssW = Math.max(1, view.clientWidth); cssH = Math.max(1, view.clientHeight);
  renderer.setSize(Math.floor(cssW * dpr()), Math.floor(cssH * dpr()), false);
  overlay.width = Math.floor(cssW * dpr()); overlay.height = Math.floor(cssH * dpr());
  U.uPixelRatio.value = SU.uPixelRatio.value = dpr();
}
new ResizeObserver(() => resize()).observe(view);
/** The targets sized for one view (a split screen draws two, each half the width). */
function sizeTargets(w, h) {
  const rw = Math.max(1, Math.floor(w * dpr())), rh = Math.max(1, Math.floor(h * dpr()));
  if (gbuffer.width === rw && gbuffer.height === rh) return;
  gbuffer.setSize(rw, rh);
  composeRT.setSize(rw, rh);
  blit.material.uniforms.resolution.value.set(1 / rw, 1 / rh);
  U.uRes.value.set(rw, rh);
}

// ------------------------------------------------------------------ the test course
const ground = new THREE.Group();
course({ obstacles: true, group: ground });
const MATS = {
  floor: makeMaterial({ color: '#e3cf9f', grid: 1, motionPage: 'floor' }),
  ramp: makeMaterial({ color: '#d8b98c', grid: 0.5, motionPage: 'ramp' }),
  step: makeMaterial({ color: '#cdb08a', motionPage: 'step' }),
  pillar: makeMaterial({ color: '#b9a58a', motionPage: 'pillar' }),
  crate: makeMaterial({ color: '#a8794f', motionPage: 'crate' }),
};
ground.traverse((o) => { if (o.isMesh) o.material = MATS[o.name] ?? MATS.step; });
scene.add(ground);
const physics = new Physics(ground);
const obstacles = ground.children.filter((o) => o.name === 'pillar' || o.name === 'crate');
// (the obstacles' collision stays: off, they are only hidden; scripted runs never go near them)
const showObstacles = () => { for (const o of obstacles) o.visible = state.obstacles; };
showObstacles();
const FREE_AT = new THREE.Vector3(0, 0, -24);   // where your own control starts
const PEOPLE_Z = -110;                           // the people lane, out of every run's way
const LANE = 0.9;                                // duo: the loops at +x, matching at -x (left and right from behind)

// ------------------------------------------------------------------ assets
const BASE = import.meta.env.BASE_URL;
const t0 = performance.now();
const [lib, hm, hf, travellerScene, travellerV1, mhData] = await Promise.all([
  loadAnimationLibrary(`${BASE}anim/ual.glb`), loadHuman('m'), loadHuman('f'),
  new GLTFLoader().loadAsync(`${BASE}anim/traveller.glb`).then((g) => g.scene).catch(() => null),
  // the game's traveller (the coral shirt: src/characters/traveller-v1.js), and the MakeHuman people's body
  loadTravellerV1(BASE).catch((e) => { console.warn('motion: no traveller v1, the old one', e); return null; }),
  loadMakeHumanBody(BASE).catch(() => null),
]);
// the captured motion: the people's walks (walks.glb) and the matching database, whatever
// locomotion.glb holds (CMU now; Mixamo's starts, stops and turns once rebuilt with them)
await loadMotionLibrary(lib, { base: BASE, matching: true });
const motion = lib.motion ?? { db: null, walks: [], clips: [] };
const db = motion.db;
console.info(`motion: loaded in ${(performance.now() - t0).toFixed(0)} ms; database ${db ? `${db.segments.length / 2} clips, ${db.n} frames with mirrors` : 'missing'}; ${motion.walks.length} walks`);

// ------------------------------------------------------------------ travellers
const noItems = { has: () => false };
/** A traveller as the game makes one (main.js): Player, Animator, the suit, the gear. */
function makeTraveller(key, matching) {
  const p = new Player(physics, { climb: false, health: false, items: noItems });
  p.animator = new Animator(lib, p.char);
  if (travellerV1) { p.character = createTravellerV1(p.char, travellerV1); p.humanoid = p.character.humanoid; }
  else p.humanoid = travellerScene ? new Humanoid(hm, p.char, 'm', { outfit: travellerScene }) : new Humanoid(hm, p.char, 'm', { suit: true });
  p.humanoid.ownMaterials?.();
  p.attach(scene);
  markHero(p.char.root);
  const T = { key, p, matching, frames: [], prev: null, t: 0, ring: [], err: null, live: null, last: null, series: {} };
  resetTraveller(T, FREE_AT);
  return T;
}
const travellers = { loops: makeTraveller('loops', false), mm: makeTraveller('mm', true) };
const NAMES = { loops: 'Loops (the default)', mm: 'Motion matching', v1: 'The traveller', mh: 'A MakeHuman person' };

/** Back to standing at `at` facing +z, as the harness's traveller starts every run (a fresh Animator: its blend, phase and matcher). */
function resetTraveller(T, at) {
  const p = T.p;
  p.animator = new Animator(lib, p.char);
  p.animator.matching = T.matching && !!db;
  Object.assign(p, { loco: null, _stepLag: null, _turn: 0, _lastHeading: undefined, _feetO: null, _moveDir: null, _wantSpeed: 0, _accel: 8, _still: 0, _animAcc: 0, time: 0, _jumpHeld: false, heading: 0, onGround: true });
  p.pos.copy(at); p.pos.y = physics.groundAt(at.x, at.y + 5, at.z);
  p.vel.set(0, 0, 0);
  p._lastVel?.set(0, 0, 0);
  p.lastSafe.copy(p.pos);
  p.humanoid.resetFeet();
  p.object.position.copy(p.pos);
  resetNumbers(T);
}
function resetNumbers(T) { T.frames = []; T.prev = null; T.t = 0; T.ring = []; T.err = { pred: [0, 0, 0], match: [0, 0, 0], n: [0, 0, 0], nm: [0, 0, 0] }; T.live = null; }
/** Which travellers this mode drives. */
const active = () => (state.mode === 'duo' ? [travellers.loops, travellers.mm] : state.mode === 'solo' ? [travellers.loops] : []);

// ------------------------------------------------------------------ the moves (moves.glb): on the traveller and on a MakeHuman person
// Each played as the game plays a move (Animator.play: laid over the blend, the body following the
// clip's hips), so what is seen here is what the game draws; the feet as the clip has them.
const MOVES_AT = new THREE.Vector3(0, 0, -150);
const moveNames = () => (motion.clips ?? []).map((c) => c.name);
const moveClip = () => motion.clips.find((c) => c.name === state.move) ?? motion.clips[0] ?? null;
const moveBodies = (() => {
  const out = [];
  const T = { key: 'v1', p: null };
  const v1 = new Player(physics, { climb: false, health: false, items: noItems });
  v1.animator = new Animator(lib, v1.char);
  if (travellerV1) { v1.character = createTravellerV1(v1.char, travellerV1); v1.humanoid = v1.character.humanoid; }
  else v1.humanoid = new Humanoid(hm, v1.char, 'm', { suit: true });
  v1.gear = { update() {}, device: { visible: true }, noShadow: [] };   // (no gear: but no robe either, Player.updateCloth gives a body without gear one)
  v1.humanoid.ownMaterials?.();
  v1.attach(scene);
  markHero(v1.char.root);
  T.p = v1; T.name = travellerV1 ? 'The traveller' : 'The traveller (old body)';
  out.push(T);
  if (mhData) {
    const npc = new NPC(scene, physics, { route: [MOVES_AT.clone()], cape: 0, lines: ['~neutral~ …'], lib, human: new MakeHumanPeople(mhData).template('m'), kind: 'm' });
    npc.restyle({ ...BLANK('m'), cloth: '#a9c4b8' });
    npc.humanoid.ownMaterials?.();
    out.push({ key: 'mh', npc, name: 'A MakeHuman person' });
  }
  return out;
})();
const bodyOf = (B) => B.p ?? B.npc;
let moveClock = 0;
/** Pose every move body `t` s into the clip (dt: the cloth's step). */
function poseMoves(t, dt = DT) {
  const clip = moveClip();
  moveBodies.forEach((B, i) => {
    const b = bodyOf(B), A = b.animator, H = b.humanoid;
    if (!A || !H) return;
    // (side by side as seen from the side: one behind the other along the way they face)
    b.pos.copy(MOVES_AT).add(new THREE.Vector3(0, 0, (i - (moveBodies.length - 1) / 2) * 1.8));
    b.heading = 0;
    if (clip) A.play(clip.name, t, 1, { full: true });
    A.update(dt, { speed: 0, onGround: true, mode: 'ground', walkAt: 1, jogAt: 2, sprintAt: 3, strideScale: 1 });
    const o = b.object;
    o.visible = state.mode === 'moves';
    o.position.copy(b.pos); o.quaternion.identity();
    A.apply(o, { legScale: 1.04 });
    o.updateMatrixWorld(true);
    H.update();
    H.poseHands?.(A);
    H.resetFeet();
    if (B.p) B.p.updateCloth?.(dt);
  });
}
function applyMode() {
  const solo = travellers.loops;
  solo.matching = state.mode === 'solo' ? state.mm : false;
  solo.p.animator.matching = solo.matching && !!db;
  for (const T of Object.values(travellers)) {
    const on = active().includes(T);
    T.p.object.visible = on;
  }
  for (const w of walkers) w.npc.object.visible = state.mode === 'people';
  for (const B of moveBodies) bodyOf(B).object.visible = state.mode === 'moves';
  showObstacles();
  restart();
}

// ------------------------------------------------------------------ the people lane
const fakePlayer = { pos: new THREE.Vector3(1e4, 0, 1e4), vel: new THREE.Vector3(), frame: { up: UP }, wind: new THREE.Vector3(), riding: false, hidden: true, bodyCapsules: () => [] };
const detailCam = new THREE.PerspectiveCamera();   // (each walker posed in full detail: within NPC_DETAIL of "the camera")
const walkByName = (n) => motion.walks.find((w) => w.name === n) ?? null;
let walkers = [];
const SHIRTS = ['#e2d3b4', '#a9c4b8', '#e0b48f', '#b9b4d8', '#d9c27a', '#c9a1a1', '#9fb6d1', '#cfd6a4'];
function buildWalkers() {
  for (const w of walkers) w.npc.dispose(scene);
  walkers = [];
  const specs = parseWalkers(state.walkers), n = specs.length;
  specs.forEach((sp, i) => {
    const x = (i - (n - 1) / 2) * 2.2;
    const npc = new NPC(scene, physics, { route: [new THREE.Vector3(x, 0, PEOPLE_Z - 6), new THREE.Vector3(x, 0, PEOPLE_Z + 6)], cape: 0, lines: ['~neutral~ …'], lib, human: hm, kind: 'm', speed: sp.speed });
    // plainly dressed (the studio's blank body: no robe or cape over the legs), each in a colour of their own
    npc.restyle({ ...BLANK('m'), cloth: SHIRTS[i % SHIRTS.length] });
    npc.humanoid.ownMaterials();
    // a plain gait style for all (unless asked for their own), so the walks are what differs
    if (!state.style) npc.gait = { stride: 1, bob: 1, sway: 0.03, lean: 0.03, stoop: 0, chin: 0, pace: 1, phase: (i * 0.37) % 1, wobble: 0, wobbleRate: 0.3 };
    npc._walkFor = npc.gait;   // (this walk, not one picked for them)
    npc.speed = sp.speed; npc.pause = 0;
    npc.animator.useWalk(sp.walk === 'library' ? null : walkByName(sp.walk));
    npc.object.visible = state.mode === 'people';
    walkers.push({ npc, spec: sp, frames: [], prev: null, t: 0, live: null });
  });
}
function stepWalker(w, dt) {
  const npc = w.npc;
  detailCam.position.set(npc.pos.x + 3, 1.6, npc.pos.z);
  npc.update(dt, fakePlayer, detailCam);
  npc.pause = Math.min(npc.pause, 0.35);   // (a short stop at each end: they turn round and go back)
  npc.object.updateMatrixWorld(true);
  if (!npc.humanoid) return;
  w.prev = sampleFrame(npc, w.t, 'walk', w.prev);
  w.frames.push(w.prev);
  if (w.frames.length > FPS * 12) w.frames.splice(0, FPS * 2);
  w.t += dt;
}

// ------------------------------------------------------------------ the simulation (fixed 60 Hz steps, as the harness)
let run = null, runK = 0, runId = '';
let simT = 0, acc = 0, stepOnce = 0;
function restart() {
  runId = state.run;
  run = runId ? PAGE_RUNS[RUN_IDS[runId]] : null;
  runK = 0;
  const at = run ? new THREE.Vector3(...run.at) : FREE_AT;
  const lanes = state.mode === 'duo' ? { loops: LANE, mm: -LANE } : { loops: 0, mm: 0 };
  for (const T of active()) resetTraveller(T, at.clone().add(new THREE.Vector3(lanes[T.key], 0, 0)));
  for (const k of Object.keys(camState)) delete camState[k];
  if (state.mode === 'people') for (const w of walkers) { w.frames = []; w.prev = null; w.t = 0; }
}

function simStep() {
  simT += DT;
  if (state.mode === 'people') { for (const w of walkers) stepWalker(w, DT); return; }
  if (state.mode === 'moves') {
    const c = moveClip(), d = c?.duration ?? 1;
    moveClock = state.paused ? state.moveT * d : (moveClock + DT) % d;
    poseMoves(moveClock);
    return;
  }
  let input = liveInput, camYaw = controlYaw, tag = 'free';
  if (run) {
    const s = scriptFrame(run, runK, FPS);
    if (s.done) {
      // the run's numbers, whole (the harness's), kept as "last run"
      for (const T of active()) T.last = { ...measure(T.frames, T.p.humanoid, DT), err: errOf(T), mode: T.p.animator.matching ? 'mm' : 'loops' };
      if (state.mode === 'solo') { const T = active()[0]; T.series[T.last.mode] = T.last; }
      if (state.loop) restart(); else { state.paused = true; updatePanel(); }
      return;
    }
    input = s.input; tag = s.tag; camYaw = CAM_PLUS_Z; runK++;
  }
  for (const T of active()) stepTraveller(T, input, camYaw, tag);
}

const _f = new THREE.Vector3(), _l = new THREE.Vector3(), _p = new THREE.Vector3();
const predictor = { db, traj: new Float32Array(12) };
function stepTraveller(T, input, camYaw, tag) {
  const p = T.p;
  p.update(DT, input, camYaw);
  p.object.updateMatrixWorld(true);
  T.prev = sampleFrame(p, T.t, tag, T.prev);
  T.frames.push(T.prev);
  // your own control: the numbers over the last 20 s
  if (!run && T.frames.length > FPS * 22) T.frames.splice(0, FPS * 2);
  T.t += DT;
  // (the matcher's view of the path: only while it is on)
  if (p.animator.matching) trajectories(T); else if (T.ring.length) T.ring = [];
}

/**
 * The matcher's view of the path (src/motion-match.js): where the stick says the body will be
 * 1/3, 2/3 and 1 s on (MotionMatcher.predict, the controller's own spring), and where the clip it
 * plays goes (the database's trajectory features of the frame playing), in the world; kept for
 * 1 s, so each can be checked against where the body really got to.
 */
function trajectories(T) {
  if (!db) return;
  const p = T.p, A = p.animator, size = A.legRatio ?? 1;
  const fwd = p.frame.dir(p.heading, _f), left = _l.crossVectors(p.frame.up, fwd);
  const at = (x, z, out) => out.copy(p.pos).addScaledVector(left, x * size).addScaledVector(fwd, z * size);
  const dir = (s, c) => new THREE.Vector3().addScaledVector(left, s).addScaledVector(fwd, c);
  MotionMatcher.prototype.predict.call(predictor, p.matchInput(), size);
  const tr = predictor.traj, e = { pos: p.pos.clone(), pred: [], match: null };
  for (let k = 0; k < 3; k++) e.pred.push({ at: at(tr[k * 2], tr[k * 2 + 1], new THREE.Vector3()), dir: dir(tr[6 + k * 2], tr[7 + k * 2]) });
  const M = A.mm;
  if (A.matching && M && M.cur >= 0 && A.mmW > 0.05) {
    const j = Math.min(Math.round(M.cur), db.n - 1), F = db.F, r = db.rawFeat;
    e.match = [];
    for (let k = 0; k < 3; k++) e.match.push({ at: at(r[j * F + 15 + k * 2], r[j * F + 16 + k * 2], new THREE.Vector3()), dir: dir(r[j * F + 21 + k * 2], r[j * F + 22 + k * 2]) });
  }
  const R = T.ring;
  R.push(e);
  // how far off each was, now that the body is there (1/3, 2/3, 1 s after)
  for (let k = 0; k < 3; k++) {
    const old = R[R.length - 1 - MATCH.horizon[k] * 2];
    if (!old) continue;
    T.err.pred[k] += Math.hypot(old.pred[k].at.x - p.pos.x, old.pred[k].at.z - p.pos.z); T.err.n[k]++;
    if (old.match) { T.err.match[k] += Math.hypot(old.match[k].at.x - p.pos.x, old.match[k].at.z - p.pos.z); T.err.nm[k]++; }
  }
  if (R.length > 100) R.splice(0, R.length - 100);
}
const errOf = (T) => ({ pred: T.err.pred.map((s, k) => (T.err.n[k] ? s / T.err.n[k] : NaN)), match: T.err.match.map((s, k) => (T.err.nm[k] ? s / T.err.nm[k] : NaN)) });

// ------------------------------------------------------------------ input: keyboard and pad (one input drives both)
const keys = {};
const typing = (e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName) && e.target.type !== 'checkbox' && e.target.type !== 'range';
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space']);
addEventListener('keydown', (e) => {
  if (typing(e)) return;
  if (GAME_KEYS.has(e.code)) { keys[e.code] = true; e.preventDefault(); return; }
  if (e.code === 'KeyP') togglePause();
  else if (e.code === 'Period') frameStep();
  else if (e.code === 'KeyR') restart();
});
addEventListener('keyup', (e) => { if (GAME_KEYS.has(e.code)) keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
let liveInput = {}, controlYaw = CAM_PLUS_Z, padMenu = false;
function readInput(dt) {
  const input = { ...keys };
  const pad = Array.from(navigator.getGamepads?.() ?? []).find((g) => g?.connected && g.axes?.length >= 2);
  if (pad) {
    const l = deadzone(pad.axes[0], pad.axes[1]), r = deadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
    if (l.x || l.y) input.stick = { x: l.x, y: -l.y };
    const b = (i) => !!pad.buttons[i]?.pressed;
    if (b(7) || b(10)) input.ShiftLeft = true;   // RT / R2 or L3: run
    if (b(0)) input.Space = true;                 // A / ×: jump
    // the right stick turns the view round
    if (r.x || r.y) { state.yaw -= r.x * dt * 2.2; state.pitch = THREE.MathUtils.clamp(state.pitch + r.y * dt * 1.4, -0.4, 1.3); }
    if (b(9) && !padMenu) togglePause();          // Menu: pause
    padMenu = b(9);
  }
  liveInput = input;
}

// ------------------------------------------------------------------ cameras
const camState = {};
/** Place `cam` on `who` (a traveller, a walker, or several), from the side, behind, or orbiting. */
function placeCamera(cam, key, who, dt, aspect) {
  const list = who.filter(Boolean);
  if (!list.length) return;
  const c = new THREE.Vector3();
  for (const o of list) c.add(o.pos);
  c.divideScalar(list.length);
  const S = (camState[key] ??= { at: c.clone(), yaw: null });
  S.at.lerp(c, 1 - Math.exp(-25 * dt));
  const lead = list[0], heading = lead.heading ?? 0;
  let base;
  // (several side by side in lanes: from a little ahead of the side, so they don't hide each other)
  const group = list.length > 1 ? (state.mode === 'people' ? 0.8 : 0.55) : 0;
  if (state.view === 'behind') base = heading + Math.PI - group * 0.5;
  else if (state.view === 'side') base = -Math.PI / 2 + group;
  else base = -0.8;
  if (S.yaw === null) S.yaw = base;
  // (behind: it swings round after the body, as the game's camera does)
  let d = base - S.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  S.yaw += d * (state.view === 'behind' ? 1 - Math.exp(-(run ? 4 : 2) * dt) : 1);
  const yaw = S.yaw + state.yaw, pitch = state.pitch;
  let dist = 6 * state.zoom;
  if (list.length > 1) {
    // the whole group in the frame
    let half = 0;
    for (const o of list) half = Math.max(half, o.pos.distanceTo(c));
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * aspect);
    dist = Math.max(dist, ((half + 2) / Math.tan(hfov / 2)) * state.zoom);
  }
  if (aspect < 0.85) dist *= 0.85 / aspect;
  const ty = S.at.y + 0.85;
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
  cam.position.set(S.at.x + Math.sin(yaw) * Math.cos(pitch) * dist, ty + Math.sin(pitch) * dist, S.at.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  cam.position.y = Math.max(cam.position.y, physics.groundAt(cam.position.x, cam.position.y + 2, cam.position.z) + 0.15);
  cam.lookAt(S.at.x, ty, S.at.z);
  cam.updateMatrixWorld();
  return yaw;
}

/** The views this frame: [{ cam, rect (CSS px), show: [travellers / walkers], label }]. */
function views(dt) {
  const L = travellers.loops, M = travellers.mm;
  if (state.mode === 'moves') {
    placeCamera(cameras[0], 'moves', [{ pos: MOVES_AT, heading: 0 }], dt, cssW / cssH);
    return [{ cam: cameras[0], rect: { x: 0, y: 0, w: cssW, h: cssH }, show: moveBodies, label: moveClip()?.name ?? 'no moves (anim/moves.glb)' }];
  }
  if (state.mode === 'people') {
    const f = walkers[state.focus];
    const list = f ? [f.npc] : walkers.map((w) => w.npc);
    placeCamera(cameras[0], f ? `w${state.focus}` : 'people', list, dt, cssW / cssH);
    return [{ cam: cameras[0], rect: { x: 0, y: 0, w: cssW, h: cssH }, show: f ? [f] : walkers, walkers: true }];
  }
  if (state.mode === 'solo') {
    controlYaw = placeCamera(cameras[0], 'solo', [L.p], dt, cssW / cssH) ?? controlYaw;
    return [{ cam: cameras[0], rect: { x: 0, y: 0, w: cssW, h: cssH }, show: [L], label: L.matching ? NAMES.mm : NAMES.loops, color: L.matching ? COLORS.mm : COLORS.loops }];
  }
  if (state.follow === 'split') {
    const w = Math.floor(cssW / 2);
    controlYaw = placeCamera(cameras[0], 'a', [L.p], dt, w / cssH) ?? controlYaw;
    placeCamera(cameras[1], 'b', [M.p], dt, (cssW - w) / cssH);
    return [{ cam: cameras[0], rect: { x: 0, y: 0, w, h: cssH }, show: [L], label: NAMES.loops, color: COLORS.loops }, { cam: cameras[1], rect: { x: w, y: 0, w: cssW - w, h: cssH }, show: [M], label: NAMES.mm, color: COLORS.mm }];
  }
  const show = state.follow === 'loops' ? [L] : state.follow === 'mm' ? [M] : [L, M];
  controlYaw = placeCamera(cameras[0], state.follow, show.map((T) => T.p), dt, cssW / cssH) ?? controlYaw;
  return [{ cam: cameras[0], rect: { x: 0, y: 0, w: cssW, h: cssH }, show, label: show.length === 1 ? NAMES[show[0].key] : '', color: COLORS[show[0].key] }];
}

// ------------------------------------------------------------------ drawing
const _v = new THREE.Vector3();
function bodyParts(o) { const p = o.p ?? o.npc; return [p.object].filter(Boolean); }
function renderView(v) {
  sizeTargets(v.rect.w, v.rect.h);
  const cam = v.cam;
  // only what this view shows (a split screen hides the other lane's traveller)
  const all = state.mode === 'people' ? walkers : state.mode === 'moves' ? moveBodies : active();
  const hide = all.filter((o) => !v.show.includes(o)).flatMap(bodyParts).filter((o) => o.visible);
  for (const o of hide) o.visible = false;
  scene.updateMatrixWorld();
  // 1. shadows round what is shown
  const centre = _v.set(0, 0, 0);
  for (const o of v.show) centre.add((o.p ?? o.npc).pos);
  centre.divideScalar(Math.max(v.show.length, 1)).setY(centre.y + 1);
  const dir = shadowDirection(SU.uSunDir.value, new THREE.Vector3());
  const noShadow = all.flatMap((o) => (o.p?.gear?.noShadow ?? [])).filter((o) => o.visible);
  for (const o of noShadow) o.visible = false;
  scene.overrideMaterial = shadowOverride;
  for (const c of [cascades.fine, cascades.near]) if (c.enabled) { c.aim(dir); c.place(centre); c.render(renderer, scene); }
  scene.overrideMaterial = null;
  for (const o of noShadow) o.visible = true;
  // 2. the G-buffer
  renderer.setRenderTarget(gbuffer);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, cam);
  // 3. the ink pass
  U.uInvProj.value.copy(cam.projectionMatrixInverse);
  U.uCamWorld.value.copy(cam.matrixWorld);
  U.uProj11.value = cam.projectionMatrix.elements[5];
  const subj = v.show.length === 1 ? (v.show[0].p ?? v.show[0].npc) : null;
  setSubject(U, cam, subj ? subj.pos : _v.set(0, 0, 0), UP, !subj);
  renderer.setRenderTarget(composeRT);
  renderer.clear();
  renderer.render(post.scene, post.camera);
  // 4. FXAA into this view's part of the screen
  renderer.setRenderTarget(null);
  const pr = dpr();
  renderer.setViewport(v.rect.x * pr, (cssH - v.rect.y - v.rect.h) * pr, v.rect.w * pr, v.rect.h * pr);
  renderer.render(blit.scene, post.camera);
  renderer.setViewport(0, 0, cssW * pr, cssH * pr);
  for (const o of hide) o.visible = true;
}

// the overlay: trajectories, planted feet, labels, drawn over the picture (2D, per view)
const _s = new THREE.Vector3();
function toScreen(cam, rect, p) {
  _s.copy(p).project(cam);
  if (_s.z > 1 || _s.z < -1) return null;
  return [rect.x + (_s.x * 0.5 + 0.5) * rect.w, rect.y + (0.5 - _s.y * 0.5) * rect.h];
}
const onGround = (p, lift = 0.02) => { const g = physics.groundAt(p.x, p.y + 1.2, p.z, 3); return _p.set(p.x, (Number.isFinite(g) ? g : p.y) + lift, p.z); };
function polyline(cam, rect, pts, color, width = 2, dash = null) {
  ctx.beginPath();
  let started = false;
  for (const q of pts) {
    const s = toScreen(cam, rect, onGround(q));
    if (!s) { started = false; continue; }
    if (started) ctx.lineTo(...s); else { ctx.moveTo(...s); started = true; }
  }
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash ?? []); ctx.stroke(); ctx.setLineDash([]);
}
function dot(cam, rect, q, color, r = 4, fill = true, alpha = 1) {
  const s = toScreen(cam, rect, onGround(q));
  if (!s) return;
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = color; ctx.fill(); } else { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function arrow(cam, rect, q, dir, color) {
  const a = toScreen(cam, rect, onGround(q)), b = toScreen(cam, rect, onGround(_v.copy(q).addScaledVector(dir, 0.35)));
  if (!a || !b) return;
  ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
}
/** The ground under each foot: a filled mark where it is planted (held by feet.js), a ring where the gait says it is down but it isn't held; the hold's place and how far the ball is from it. */
function drawFeet(cam, rect, body) {
  const H = body.humanoid, B = H?.b;
  if (!B) return;
  for (const s of ['l', 'r']) {
    const F = H._feet?.[s], ball = B[`ball_${s}`].getWorldPosition(new THREE.Vector3());
    const down = (body.animator?.contact?.[s] ?? 0) > 0.5;
    if (F?.locked && F.w > 0.3) {
      dot(cam, rect, ball, COLORS[s], 5, true, 0.85);
      const a = toScreen(cam, rect, onGround(F.pos)), b = toScreen(cam, rect, onGround(ball));
      if (a && b) {
        ctx.beginPath(); ctx.moveTo(a[0] - 4, a[1]); ctx.lineTo(a[0] + 4, a[1]); ctx.moveTo(a[0], a[1] - 4); ctx.lineTo(a[0], a[1] + 4);
        if (F.pos.distanceTo(ball) > 0.01) { ctx.moveTo(...a); ctx.lineTo(...b); }
        ctx.strokeStyle = COLORS[s]; ctx.lineWidth = 1.5; ctx.stroke();
      }
    } else if (F?.step) dot(cam, rect, ball, COLORS[s], 5, false, 0.9);
    else if (down) dot(cam, rect, ball, COLORS[s], 4, false, 0.6);
  }
}
function drawTrajectories(cam, rect, T) {
  const R = T.ring, now = R[R.length - 1];
  if (!now) return;
  // the path walked (1.5 s), the stick's prediction made 1 s ago (where it said the body would be now)
  polyline(cam, rect, R.slice(-90).map((e) => e.pos), COLORS.path, 2.5);
  const ago = R[R.length - 1 - 60];
  if (ago) { polyline(cam, rect, [ago.pos, ...ago.pred.map((q) => q.at)], COLORS.pred, 1.2, [3, 4]); for (const q of ago.pred) dot(cam, rect, q.at, COLORS.pred, 3, false, 0.6); }
  // now: the stick's prediction, and the clip's own path ahead (what the matcher picked)
  polyline(cam, rect, [now.pos, ...now.pred.map((q) => q.at)], COLORS.pred, 2);
  for (const q of now.pred) { dot(cam, rect, q.at, COLORS.pred, 4); arrow(cam, rect, q.at, q.dir, COLORS.pred); }
  if (now.match) {
    polyline(cam, rect, [now.pos, ...now.match.map((q) => q.at)], COLORS.match, 2);
    for (const q of now.match) { dot(cam, rect, q.at, COLORS.match, 4); arrow(cam, rect, q.at, q.dir, COLORS.match); }
  }
}
function label(x, y, text, color = '#2b211f', align = 'left') {
  ctx.font = '600 12px system-ui, sans-serif';
  const w = ctx.measureText(text).width;
  const x0 = align === 'center' ? x - w / 2 : x;
  ctx.fillStyle = 'rgba(246, 242, 232, 0.86)';
  ctx.fillRect(x0 - 5, y - 13, w + 10, 18);
  ctx.fillStyle = color;
  ctx.fillText(text, x0, y);
}
function drawOverlay(vs) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
  for (const v of vs) {
    ctx.save();
    ctx.beginPath(); ctx.rect(v.rect.x, v.rect.y, v.rect.w, v.rect.h); ctx.clip();
    for (const o of v.show) {
      const body = o.p ?? o.npc;
      if (o.p && state.traj && o.p.animator.matching && state.mode !== 'people') drawTrajectories(v.cam, v.rect, o);
      if (state.feet) drawFeet(v.cam, v.rect, body);
      // a name over the head (two in one view, or the walkers)
      if (v.walkers || (v.show.length > 1 && o.key)) {
        const head = toScreen(v.cam, v.rect, _v.copy(body.pos).setY(body.pos.y + 2.05 * (body.object.scale?.y ?? 1)));
        if (head) {
          // (a long row: just their numbers, the panel says who is who)
          const i = walkers.indexOf(o), crowded = v.walkers && v.show.length > 5;
          const name = o.key ? NAMES[o.key] : crowded ? `${i + 1}` : `${i + 1}. ${walkTitle(o.spec.walk)}`;
          label(head[0], head[1], name, o.key ? COLORS[o.key] : '#2b211f', 'center');
          if (o.live && v.walkers && !crowded) label(head[0], head[1] + 18, `slide ${fmt(o.live.maxSlide, 2)} / ${fmt(o.live.meanSlide, 3)} m`, '#2b211f', 'center');
        }
      }
    }
    if (v.label) label(v.rect.x + 12, v.rect.y + 22, v.label, v.color);
    if (vs.length > 1 && v.rect.x > 0) { ctx.fillStyle = '#2b211f'; ctx.fillRect(v.rect.x - 1, 0, 2, cssH); }
    ctx.restore();
  }
  // the legend for what is drawn on the ground
  if (state.mode !== 'people' && (state.traj || state.feet)) {
    const items = [];
    if (state.traj && active().some((T) => T.p.animator.matching)) items.push(['the stick’s prediction (and 1 s ago)', COLORS.pred], ['the matched clip’s path', COLORS.match], ['the path walked', COLORS.path]);
    if (state.feet) items.push(['planted foot (left / right; + where it is held)', COLORS.l]);
    let y = cssH - 40 - items.length * 16;
    ctx.font = '11px system-ui, sans-serif';
    for (const [t, c] of items) { ctx.fillStyle = c; ctx.fillRect(10, y - 8, 14, 3); ctx.fillStyle = 'rgba(43,33,31,0.85)'; ctx.fillText(t, 30, y - 3); y += 16; }
  }
}

// ------------------------------------------------------------------ frame
let last = performance.now(), fps = 60, numbersT = 0, failed = false;
function frame(now) {
  requestAnimationFrame(frame);
  try { tick(now); } catch (e) { if (!failed) console.error('motion frame:', e); failed = true; }
}
function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  readInput(dt);
  if (!state.paused) acc += dt * state.rate;
  let n = 0;
  while (acc >= DT && n < 6) { simStep(); acc -= DT; n++; }
  if (n === 6) acc = 0;
  for (; stepOnce > 0; stepOnce--) simStep();
  SU.uTime.value = U.uTime.value = simT;
  const vs = views(dt);
  renderer.setRenderTarget(null);
  renderer.setViewport(0, 0, cssW * dpr(), cssH * dpr());
  for (const v of vs) renderView(v);
  drawOverlay(vs);
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
  numbersT += dt;
  if (numbersT > 0.25) { numbersT = 0; liveNumbers(); }
}

// ------------------------------------------------------------------ numbers
const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '–');
function liveNumbers() {
  if (state.mode === 'people') for (const w of walkers) w.live = w.frames.length > 30 ? measure(w.frames, w.npc.humanoid, DT, w.frames[0].t + 1) : null;
  else for (const T of active()) {
    T.live = T.frames.length > 30 ? { ...measure(T.frames, T.p.humanoid, DT, T.frames[0].t + 0.3), err: errOf(T), mode: T.p.animator.matching ? 'mm' : 'loops' } : null;
    // (solo, your own control: each way's numbers kept while it is on, so a toggle compares them)
    if (state.mode === 'solo' && T.live && !run) T.series[T.live.mode] = T.live;
  }
  renderNumbers();
  renderMatcher();
  const time = run ? `${(runK / FPS).toFixed(2)} / ${(runFrames(run, FPS) / FPS).toFixed(2)} s` : `${simT.toFixed(1)} s`;
  setStatus(`${{ duo: 'Two travellers, one input', solo: 'One traveller', people: 'The people’s walks', moves: `Moves · ${moveClip()?.name ?? 'none'} · ${moveClock.toFixed(2)} / ${(moveClip()?.duration ?? 0).toFixed(2)} s` }[state.mode]} · ${state.mode === 'people' ? `${walkers.length} walkers` : run ? RUN_IDS[runId] : 'your control (WASD / arrows, Shift run; left stick, RT / R2 run)'} · ${time}${state.paused ? ' · paused' : state.rate !== 1 ? ` · ${state.rate}×` : ''} · ${fps.toFixed(0)} fps`);
}

// ------------------------------------------------------------------ the panel
const controls = $('controls');
let urlTimer = 0;
function saveURL() {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => history.replaceState(null, '', `${location.pathname}${encodeState(state) ? `?${encodeState(state)}` : ''}`), 150);
}
const refreshers = [];
function updatePanel() { for (const f of refreshers) f(); transport(); }
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v);
  e.append(...kids);
  return e;
}
function section(title, open = false) {
  const d = el('details');
  d.open = open;
  d.append(el('summary', {}, title));
  controls.append(d);
  return d;
}
function row(parent, label, input, out = null) {
  const r = el('div', { class: 'row' }, el('label', {}, label), input);
  if (out) r.append(out);
  parent.append(r);
  return r;
}
/** Buttons for one choice: [[value, label]]; the one on is marked. */
function seg(parent, label, key, options, then) {
  const box = el('div', { class: 'seg' });
  const bs = options.map(([v, t]) => el('button', { onclick: () => { state[key] = v; saveURL(); then?.(); updatePanel(); } }, t));
  box.append(...bs);
  const r = label ? row(parent, label, box) : (parent.append(box), box);
  refreshers.push(() => bs.forEach((b, i) => b.classList.toggle('on', state[key] === options[i][0])));
  return r;
}
function check(parent, label, key, then) {
  const i = el('input', { type: 'checkbox' });
  i.onchange = () => { state[key] = i.checked; saveURL(); then?.(); };
  refreshers.push(() => { i.checked = !!state[key]; });
  return row(parent, label, i);
}
const note = (parent, text) => { const p = el('p', { class: 'note' }); p.innerHTML = text; parent.append(p); return p; };
const onlyIn = (node, ...modes) => refreshers.push(() => { node.hidden = !modes.includes(state.mode); });

// mode
const sMode = section('Mode', true);
seg(sMode, '', 'mode', [['duo', 'Side by side'], ['solo', 'One, toggled'], ['people', 'People’s walks'], ['moves', 'Moves']], applyMode);
const modeNote = note(sMode, '');
refreshers.push(() => {
  modeNote.innerHTML = {
    duo: 'Two travellers in two lanes, the <b class="loops">loops</b> (the game’s default) and <b class="mm">motion matching</b>, driven by the same input at the same time.',
    solo: 'One traveller: switch between the loops and motion matching in place, with the matcher’s debug drawn on the ground.',
    people: 'A row of walkers, each on the library’s walk or one of the captured walks (CMU), at its own speed.',
    moves: 'The traveller’s own moves (anim/moves.glb: Mixamo’s get-ups, jumps, idles, the kneel and the petting), on him and on a MakeHuman person, played as the game plays them.',
  }[state.mode];
});

// run
const sRun = section('Input', true);
onlyIn(sRun, 'duo', 'solo');
{
  const s = el('select');
  s.append(new Option('Your control (keyboard / pad)', ''), ...Object.entries(RUN_IDS).map(([id, name]) => new Option(`Run: ${name}`, id)));
  s.onchange = () => { state.run = s.value; state.paused = false; saveURL(); restart(); updatePanel(); };
  refreshers.push(() => { s.value = state.run; });
  row(sRun, 'Drive with', s);
}
check(sRun, 'Loop the run', 'loop');
check(sRun, 'Obstacles', 'obstacles', showObstacles);
note(sRun, 'Keyboard: WASD or the arrows, Shift runs, Space jumps; pad: left stick, RT / R2 or L3 runs, A / × jumps, the right stick turns the view, Menu pauses. P pauses, . steps a frame, R restarts. Runs are the gait harness’s (tests/gait-sim.js) at its 60 steps a second.');

// camera
const sCam = section('Camera', true);
const followRow = seg(sCam, 'Follow', 'follow', [['split', 'Split'], ['both', 'Both'], ['loops', 'Loops'], ['mm', 'Matching']]);
refreshers.push(() => { followRow.hidden = state.mode !== 'duo'; });
seg(sCam, 'From', 'view', [['side', 'the side'], ['behind', 'behind'], ['orbit', 'orbit']], () => { for (const k of Object.keys(camState)) delete camState[k]; });
{
  const z = el('input', { type: 'range', min: 0.3, max: 3, step: 0.05 }), out = el('output');
  z.oninput = () => { state.zoom = +z.value; out.textContent = state.zoom.toFixed(2); saveURL(); };
  refreshers.push(() => { z.value = state.zoom; out.textContent = state.zoom.toFixed(2); });
  row(sCam, 'Distance', z, out);
}
sCam.append(el('div', { class: 'buttons' }, el('button', { onclick: () => { state.yaw = 0; state.pitch = 0.22; state.zoom = 1; saveURL(); updatePanel(); } }, 'Reset the view')));
note(sCam, 'Drag to turn round, wheel or pinch to come closer.');
const peopleFocus = el('select');
peopleFocus.onchange = () => { state.focus = +peopleFocus.value; saveURL(); };
const focusRow = row(sCam, 'Look at', peopleFocus);
refreshers.push(() => {
  focusRow.hidden = state.mode !== 'people';
  peopleFocus.replaceChildren(new Option('the whole row', '-1'), ...walkers.map((w, i) => new Option(`${i + 1}. ${walkTitle(w.spec.walk)}`, String(i))));
  peopleFocus.value = String(walkers[state.focus] ? state.focus : -1);
});

// solo: the toggle and what is drawn
const sShow = section('Drawn on the ground', true);
const soloRow = seg(sShow, 'Traveller on', 'mm', [[false, 'Loops'], [true, 'Motion matching']], () => {
  const T = travellers.loops;
  T.matching = state.mm;
  T.p.animator.matching = state.mm && !!db;
  // (a fresh series for the numbers: each way's are kept apart)
  resetNumbers(T);
});
refreshers.push(() => { soloRow.hidden = state.mode !== 'solo'; });
check(sShow, 'Trajectories', 'traj');
check(sShow, 'Planted feet', 'feet');
onlyIn(sShow, 'duo', 'solo', 'people');

// numbers
const sNums = section('Numbers', true);
const numsBox = el('div');
sNums.append(numsBox);
note(sNums, 'As the gait harness measures them (docs/systems/animation.md, “Locomotion”): <b>slide</b>, how far a foot moves over the ground while within 3 cm of it (worst / mean contact); <b>held</b>, how far a planted foot moves; <b>sink</b>, the deepest sole under the ground; <b>jerk</b>, the head’s (km/s³); <b>bone</b>, the biggest turn of a bone in a frame. Your control: the last 20 s; a run: from its start, and the whole of the last one. <b>Path</b>: how far from where the body got to, 1/3, 2/3 and 1 s on, the stick’s prediction and the matched clip were. The better of the two is in bold.');
sNums.append(el('div', { class: 'buttons' }, el('button', { onclick: () => { for (const T of active()) { resetNumbers(T); T.last = null; T.series = {}; } for (const w of walkers) { w.frames = []; w.prev = null; } } }, 'Reset the numbers')));
const ROWS = [['slide max', (r) => r.maxSlide, 2], ['slide mean', (r) => r.meanSlide, 3], ['held', (r) => r.heldSlide, 3], ['sink', (r) => r.sink, 3], ['head jerk', (r) => r.jitterHead, 2], ['bone / frame', (r) => r.maxTurn, 2], ['contacts', (r) => r.contacts, 0, true],
  ['path err 1 s', (r) => r.err?.pred[2], 2], ['clip path 1 s', (r) => r.err?.match[2], 2]];
function table(cols) {
  const t = el('table', { class: 'nums' });
  t.append(el('tr', {}, el('th', {}, ''), ...cols.map((c) => el('th', { class: c.cls ?? '' }, c.name))));
  for (const [name, get, d, plain] of ROWS) {
    const vals = cols.map((c) => (c.r ? get(c.r) : NaN));
    const fin = vals.filter(Number.isFinite), best = fin.length > 1 && !plain ? Math.min(...fin) : NaN;
    if (!fin.length) continue;
    t.append(el('tr', {}, el('td', {}, name), ...vals.map((v) => el('td', { class: v === best && fin.some((x) => x !== best) ? 'win' : '' }, fmt(v, d)))));
  }
  return t;
}
function renderNumbers() {
  if (!sNums.open) return;
  numsBox.replaceChildren();
  if (state.mode === 'moves') { numsBox.append(el('p', { class: 'note' }, 'No numbers for the moves: they are looked at.')); return; }
  if (state.mode === 'people') {
    // one row a walker (the best of each column in bold)
    const cols = [['slide max', (r) => r.maxSlide, 2], ['mean', (r) => r.meanSlide, 3], ['held', (r) => r.heldSlide, 3], ['sink', (r) => r.sink, 3], ['jerk', (r) => r.jitterHead, 2]];
    const t = el('table', { class: 'nums' });
    t.append(el('tr', {}, el('th', {}, 'walk'), ...cols.map(([n]) => el('th', {}, n))));
    const best = cols.map(([, get]) => Math.min(...walkers.map((w) => (w.live ? get(w.live) : Infinity))));
    walkers.forEach((w, i) => t.append(el('tr', {}, el('td', { title: walkTitle(w.spec.walk) }, `${i + 1}. ${shortWalk(w.spec.walk)}`),
      ...cols.map(([, get, d], k) => { const x = w.live ? get(w.live) : NaN; return el('td', { class: x === best[k] && walkers.length > 1 ? 'win' : '' }, fmt(x, d)); }))));
    numsBox.append(t);
    return;
  }
  if (state.mode === 'duo') {
    const [L, M] = active();
    numsBox.append(el('p', { class: 'note' }, run ? 'This run so far' : 'The last 20 s'), table([{ name: 'loops', cls: 'loops', r: L.live }, { name: 'matching', cls: 'mm', r: M.live }]));
    if (L.last) numsBox.append(el('p', { class: 'note' }, 'The last whole run'), table([{ name: 'loops', cls: 'loops', r: L.last }, { name: 'matching', cls: 'mm', r: M.last }]));
    return;
  }
  const T = active()[0], col = (m) => (T.live?.mode === m ? T.live : T.series[m]);
  numsBox.append(el('p', { class: 'note' }, run ? 'This run so far (the other way: its last whole run)' : 'Each way, while it was on (the last 20 s of it)'),
    table([{ name: 'loops', cls: 'loops', r: col('loops') }, { name: 'matching', cls: 'mm', r: col('mm') }]));
  if (run && T.last) numsBox.append(el('p', { class: 'note' }, `The last whole run (${T.last.mode === 'mm' ? 'motion matching' : 'loops'})`), table([{ name: T.last.mode === 'mm' ? 'matching' : 'loops', cls: T.last.mode, r: T.last }]));
}

// the matcher, live
const sMatch = section('The matcher', true);
onlyIn(sMatch, 'duo', 'solo');
const matchBox = el('div', { class: 'kv' });
sMatch.append(matchBox);
note(sMatch, `Settings (src/motion-match.js MATCH): a search every ${MATCH.interval} s (at once when the stick turns past ${MATCH.forceTurn} rad), jumps blended over a ${MATCH.halflife} s half-life, playback warped ×${MATCH.rate[0]}–${MATCH.rate[1]}; a best cost over ${MATCH.maxCost} hands the pose back to the loops.`);
let playingClip = null;
function renderMatcher() {
  const T = active().find((x) => x.p.animator.matching);
  playingClip = null;
  if (!T || !db) { matchBox.replaceChildren(el('span', {}, 'off'), el('span', {}, db ? 'motion matching is not on' : 'no matching database (anim/locomotion.glb)')); renderClips(); return; }
  const A = T.p.animator, M = A.mm;
  const kv = [];
  if (M && M.cur >= 0) {
    const seg = db.segments[db.segOf[Math.floor(M.cur)]];
    playingClip = seg;
    const f = M.cur - seg.start;
    kv.push(['clip', `${seg.name}${seg.mirrored ? ' (mirrored)' : ''}`], ['', seg.desc ?? ''], ['frame', `${f.toFixed(1)} / ${seg.n} (${(f / db.fps).toFixed(2)} s)`], ['cost', `${fmt(M.cost, 2)}${M.cost > MATCH.maxCost ? ' (over: no match)' : ''}`],
      ['share of the pose', `${(A.mmW * 100).toFixed(0)} %${A._mmMiss ? (A._mmLag ? ' · the loops: the body outruns the clips' : ' · the loops: nothing close') : ''}`], ['playback', `×${fmt(M.rate, 2)} · clip ${fmt(M.speed, 2)} m/s`], ['jumps', `${M.jumps} in ${M.searches} searches`],
      ['feet (clip)', `l ${fmt(M.contact.l, 2)} · r ${fmt(M.contact.r, 2)}`]);
  } else kv.push(['state', A.mmW > 0 ? 'starting' : 'the loops (off the ground, or nothing searched yet)']);
  const H = T.p.humanoid._feet;
  if (H) kv.push(['planted', ['l', 'r'].map((s) => `${s} ${H[s].locked ? 'held' : H[s].step ? 'stepping' : 'free'}`).join(' · ')]);
  matchBox.replaceChildren(...kv.flatMap(([k, v]) => [el('span', {}, k), el('span', {}, v)]));
  renderClips();
}

// the database: whatever locomotion.glb holds (Mixamo's clips appear here once the library is rebuilt with them)
const sDB = section('The database');
const dbSummary = el('p', { class: 'note' }), clipList = el('ul', { class: 'clips' });
sDB.append(dbSummary, clipList);
const sourceOf = (s) => (s.source ?? s.name ?? '').split(/[\s_:]/)[0].toUpperCase() || 'OTHER';
let clipItems = [];
function buildClips() {
  clipList.replaceChildren();
  clipItems = [];
  if (!db) { dbSummary.textContent = 'No matching database: anim/locomotion.glb did not load.'; return; }
  const takes = db.segments.filter((s) => !s.mirrored);
  const bySource = {};
  for (const s of takes) (bySource[sourceOf(s)] ??= []).push(s);
  const secs = takes.reduce((t, s) => t + s.n, 0) / db.fps;
  dbSummary.textContent = `${takes.length} clips, ${secs.toFixed(0)} s (${db.n} frames with their mirror images): ${Object.entries(bySource).map(([k, v]) => `${k} ${v.length}`).join(', ')}. The page loads whatever anim/locomotion.glb holds.`;
  for (const [src, list] of Object.entries(bySource)) {
    clipList.append(el('li', { class: 'group' }, el('span', {}, src), el('small', {}, `${list.length}`)));
    for (const s of list) {
      const li = el('li', { title: s.source ?? '' }, el('span', {}, `${s.name}${s.loop ? ' ↻' : ''}`), el('small', {}, `${s.desc ?? ''} · ${(s.n / db.fps).toFixed(1)} s`));
      clipList.append(li);
      clipItems.push([s, li]);
    }
  }
  clipList.append(el('li', { class: 'group' }, el('span', {}, 'The people’s walks (walks.glb)'), el('small', {}, `${motion.walks.length}`)));
  for (const w of motion.walks) clipList.append(el('li', {}, el('span', {}, w.name), el('small', {}, `${w.desc ?? ''} · ${fmt(w.speed, 2)} m/s`)));
  if (motion.clips.length) {
    clipList.append(el('li', { class: 'group' }, el('span', {}, 'Other clips'), el('small', {}, `${motion.clips.length}`)));
    for (const c of motion.clips) clipList.append(el('li', {}, el('span', {}, c.name), el('small', {}, `${c.duration.toFixed(1)} s`)));
  }
}
function renderClips() {
  for (const [s, li] of clipItems) {
    const on = !!playingClip && playingClip.take === s.take;
    if (on !== li.classList.contains('playing')) { li.classList.toggle('playing', on); if (on && sDB.open) li.scrollIntoView({ block: 'nearest' }); }
  }
}

// the moves
const sMoves = section('The move', true);
onlyIn(sMoves, 'moves');
{
  const s = el('select');
  const fill = () => { s.replaceChildren(...moveNames().map((n) => new Option(`${n.replace(/^mixamo_/, '')} · ${(motion.clips.find((c) => c.name === n)?.duration ?? 0).toFixed(1)} s`, n))); s.value = moveClip()?.name ?? ''; };
  fill();
  s.onchange = () => { state.move = s.value; moveClock = 0; saveURL(); updatePanel(); };
  refreshers.push(() => { s.value = moveClip()?.name ?? ''; });
  row(sMoves, 'Move', s);
  const r = el('input', { type: 'range', min: 0, max: 1, step: 0.001 }), out = el('output');
  r.oninput = () => { state.moveT = +r.value; state.paused = true; saveURL(); updatePanel(); };
  refreshers.push(() => { r.value = state.moveT; out.textContent = `${(state.moveT * (moveClip()?.duration ?? 0)).toFixed(2)} s`; });
  row(sMoves, 'Scrub', r, out);
  note(sMoves, 'Scrubbing pauses. <code>motionPage.sheet()</code> makes a frame strip of the move (or of the run playing, in the other modes).');
}

// the people lane
const shortWalk = (name) => (name === 'library' ? 'library' : walkByName(name)?.desc?.replace(/ walk( forward)?$/, '').replace(/^muscular, heavyset person's$/, 'heavyset') ?? name);
const walkTitle = (name) => (name === 'library' ? 'the library’s walk' : (() => { const w = walkByName(name); return w ? `${w.desc} (${w.name.replace(/^cmu_/, 'CMU ')})` : name; })());
const sPeople = section('The walkers', true);
onlyIn(sPeople, 'people');
const walkerBox = el('div');
sPeople.append(walkerBox);
const setWalkers = (list, rebuild = true) => { state.walkers = formatWalkers(list); saveURL(); if (rebuild) { buildWalkers(); renderWalkers(); updatePanel(); } };
function renderWalkers() {
  walkerBox.replaceChildren();
  const list = parseWalkers(state.walkers);
  list.forEach((sp, i) => {
    const s = el('select');
    s.append(new Option('the library’s walk', 'library'), ...motion.walks.map((w) => new Option(`${w.desc} · ${w.name.replace(/^cmu_/, '')} · ${fmt(w.speed, 2)} m/s`, w.name)));
    s.value = sp.walk;
    s.onchange = () => { list[i].walk = s.value; const w = walkers[i]; if (w) { w.spec.walk = s.value; w.npc.animator.useWalk(s.value === 'library' ? null : walkByName(s.value)); w.frames = []; w.prev = null; } setWalkers(list, false); updatePanel(); };
    const r = el('input', { type: 'range', min: 0.4, max: 2.4, step: 0.05 }), out = el('output', {}, `${sp.speed.toFixed(2)}`);
    r.value = sp.speed;
    r.oninput = () => { list[i].speed = +r.value; out.textContent = (+r.value).toFixed(2); const w = walkers[i]; if (w) { w.npc.speed = +r.value; w.spec.speed = +r.value; w.frames = []; w.prev = null; } setWalkers(list, false); };
    const x = el('button', { title: 'Take this walker away', onclick: () => { list.splice(i, 1); setWalkers(list); } }, '×');
    const own = walkByName(sp.walk);
    walkerBox.append(el('div', { class: 'walker' }, s, r, out, x, el('small', {}, `${i + 1}. ${own ? `captured at ${fmt(own.speed, 2)} m/s` : 'the clip library’s walk'} · slider: their speed (m/s)`)));
  });
}
sPeople.append(el('div', { class: 'buttons' },
  el('button', { onclick: () => { const l = parseWalkers(state.walkers); if (l.length < 16) l.push({ walk: motion.walks[l.length % Math.max(motion.walks.length, 1)]?.name ?? 'library', speed: 1.25 }); setWalkers(l); } }, 'Add a walker'),
  el('button', { onclick: () => setWalkers([{ walk: 'library', speed: 1.25 }, ...motion.walks.map((w) => ({ walk: w.name, speed: Math.min(Math.max(w.speed * 1.05, 0.9), 1.6) }))]) }, 'Every walk'),
  el('button', { onclick: () => setWalkers(parseWalkers(cleanState({}).walkers)) }, 'Back to four')));
check(sPeople, 'Their own gait style', 'style', () => { buildWalkers(); updatePanel(); });
note(sPeople, '“Every walk”: each at its own captured pace (as the game picks them: within 0.8–1.25 of it). Off, everyone walks one plain gait style, so only the walks differ; on, each gets the seeded stride, bob and lean the game gives a person.');

// share
const sShare = section('Share');
sShare.append(el('div', { class: 'buttons' },
  el('button', { onclick: () => navigator.clipboard?.writeText(location.href).catch(() => {}) }, 'Copy the link'),
  el('button', { onclick: () => { const a = el('a'); a.download = `memento-motion-${state.mode}.png`; a.href = renderer.domElement.toDataURL('image/png'); a.click(); } }, 'Save the picture'),
  el('button', { onclick: () => { location.search = ''; } }, 'Reset everything')));

// transport, over the picture: play / pause, a frame, slow motion, restart
function togglePause() { state.paused = !state.paused; saveURL(); transport(); }
function frameStep() { state.paused = true; stepOnce++; saveURL(); transport(); }
function transport() {
  const box = $('transport');
  box.replaceChildren(
    el('button', { onclick: togglePause, class: state.paused ? 'on' : '' }, state.paused ? '▶ Play' : '❚❚ Pause'),
    el('button', { onclick: frameStep, title: 'One frame (1/60 s): .' }, 'Step'),
    ...RATES.map((r) => el('button', { class: state.rate === r ? 'on' : '', onclick: () => { state.rate = r; saveURL(); transport(); } }, `${r}×`)),
    el('button', { onclick: () => restart(), title: 'R' }, state.mode === 'people' ? 'Again' : run ? 'Restart the run' : 'Back to the start'));
}

// orbit by dragging, zoom with the wheel or a pinch
const pointers = new Map();
let drag = null;
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch }; });
canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1];
    const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d = Math.hypot(e.clientX - other.x, e.clientY - other.y);
    if (d0 > 0) state.zoom = THREE.MathUtils.clamp(state.zoom * d0 / d, 0.3, 3);
    return;
  }
  if (!drag) return;
  state.yaw = drag.yaw - (e.clientX - drag.x) * 0.008;
  state.pitch = THREE.MathUtils.clamp(drag.pitch + (e.clientY - drag.y) * 0.006, -0.4, 1.3);
});
const endPointer = (e) => { pointers.delete(e.pointerId); if (drag) { state.yaw = +state.yaw.toFixed(3); state.pitch = +state.pitch.toFixed(3); saveURL(); updatePanel(); } drag = null; };
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); state.zoom = THREE.MathUtils.clamp(state.zoom * Math.exp(e.deltaY * 0.0012), 0.3, 3); saveURL(); updatePanel(); }, { passive: false });

// ------------------------------------------------------------------ go
resize();
buildWalkers();
buildClips();
renderWalkers();
applyMode();
updatePanel();
/**
 * A frame strip (a contact sheet) as a PNG data URL: in the moves mode, `frames` poses evenly
 * through the move (or at `times`, s); in the others, the current run from its start, stepped to
 * each of `times` (s). Each tile is the middle of the view, w x h CSS px, labelled with its time.
 */
function sheet({ frames = 8, times = null, cols = null, w = 300, h = 420, label = '' } = {}) {
  const moves = state.mode === 'moves', clip = moveClip();
  const ts = times ?? Array.from({ length: frames }, (_, i) => (moves ? (clip?.duration ?? 1) * i / Math.max(frames - 1, 1) : i * 0.25));
  const n = ts.length, C = cols ?? n, R = Math.ceil(n / C), pr = dpr();
  const out = document.createElement('canvas');
  out.width = Math.round(C * w * pr); out.height = Math.round((R * h + (label ? 26 : 0)) * pr);
  const g = out.getContext('2d');
  g.fillStyle = '#f2ecdf'; g.fillRect(0, 0, out.width, out.height);
  g.scale(pr, pr);
  if (label) { g.fillStyle = '#2b211f'; g.font = '600 15px system-ui, sans-serif'; g.fillText(label, 8, 18); }
  const top = label ? 26 : 0;
  const was = state.paused;
  state.paused = true;
  if (!moves) restart();
  let at = 0;
  ts.forEach((t, i) => {
    if (moves) {
      // (stepped up to it, so the cloth follows)
      const from = i === 0 ? Math.max(0, t - 0.5) : ts[i - 1];
      for (let x = from; x < t; x += DT) poseMoves(x);
      poseMoves(t);
      moveClock = t;
    } else for (; at < t - 1e-6; at += DT) simStep();
    const vs = views(1);   // (the camera on the body at once: dt 1 s)
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, cssW * pr, cssH * pr);
    for (const v of vs) renderView(v);
    drawOverlay(vs);
    const x = (i % C) * w, y = top + Math.floor(i / C) * h;
    const sx = (cssW - w) / 2, sy = Math.max(0, (cssH - h) / 2);
    g.drawImage(renderer.domElement, sx * pr, sy * pr, w * pr, h * pr, x, y, w, h);
    g.drawImage(overlay, sx * pr, sy * pr, w * pr, h * pr, x, y, w, h);
    g.fillStyle = '#2b211f'; g.font = '12px system-ui, sans-serif'; g.fillText(`${t.toFixed(2)} s`, x + 8, y + 16);
    g.strokeStyle = 'rgba(43,33,31,0.25)'; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  });
  state.paused = was;
  return out.toDataURL('image/png');
}

window.motionPage = {
  state: () => state, sheet, poseMoves, moveBodies, motion, set: (s) => { state = cleanState({ ...state, ...s }); saveURL(); buildWalkers(); renderWalkers(); applyMode(); updatePanel(); },
  travellers, walkers: () => walkers, lib, db, scene, cameras, renderer, physics, step: (n = 1) => { for (let i = 0; i < n; i++) simStep(); liveNumbers(); }, restart, liveNumbers,
};
requestAnimationFrame((t) => { last = t; frame(t); });
