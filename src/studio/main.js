// The character studio (studio.html): the people alone, drawn by the game's own
// pipeline (shadow cascades, the G-buffer materials, the ink pass of post.js,
// FXAA), to tune bodies, outfits, faces and expressions without loading a world.
// Only the people's assets load: the two bodies, the clip library, the
// traveller's outfit (and a world's story data and sky when picked).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sharedUniforms, makeMaterial, markHero } from '../materials.js';
import { createPost, DEBUG_VIEWS, PRESETS } from '../post.js';
import { createGBuffer, createComposeTarget, createBlit, setSubject } from '../pipeline.js';
import { Cascade, shadowDirection } from '../shadows.js';
import { applyTimeOfDay, colourScript } from '../timeofday.js';
import { loadAnimationLibrary, Animator } from '../animator.js';
import { loadHuman, Humanoid } from '../humanoid.js';
import { buildCharacter } from '../player.js';
import { Gear } from '../gear.js';
import { NPC } from '../npc.js';
import { COSTUME_WORLDS, crowdLook, BUILDS, HEAD_IDS, HAIR_IDS, MASK_IDS, BODY_IDS, PROP_IDS, TRIM_IDS, tribeOf, setCostumeWorld } from '../costumes.js';
import { figureGeometry, packLook } from '../crowd.js';
import { CROWD_POSES } from '../crowd-shader.js';
import { IRIS } from '../eyes.js';
import { mulberry32 } from '../noise.js';
import { BODY_MORPHS, FACE_MORPHS, NEUTRAL_BODY, cleanMorph } from '../morph.js';
import { EXPRESSION_KEYS, TONE_EXPRESSIONS, expressionFor } from '../expression.js';
import { TONES } from '../story/tone.js';
import { TITLES } from '../levels/names.js';
import { cleanState, encodeState, decodeState, settingsJSON } from './state.js';
import { FACE_PRESETS, castOf, lookFor, BLANK, STORY_WORLDS } from './people.js';

// as in the game (main.js): every colour is authored as a display value and output untouched
THREE.ColorManagement.enabled = false;

const $ = (id) => document.getElementById(id);
const UP = new THREE.Vector3(0, 1, 0);
const view = $('view'), statusEl = $('status');
let state = decodeState(location.search);
const setStatus = (t) => { statusEl.textContent = t; };

// ------------------------------------------------------------------ the game's pipeline
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.autoClear = false;
view.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 2000);
const gbuffer = createGBuffer();
const post = createPost();
const U = post.uniforms, SU = sharedUniforms;
U.tAlbedo.value = gbuffer.textures[0];
U.tNormal.value = gbuffer.textures[1];
U.tHatch.value = gbuffer.textures[2];
const composeRT = createComposeTarget();
const blit = createBlit(composeRT.texture);
// the shadow cascades with the game's sizes (main.js): fine (character shadows) and near; far off
const cascades = {
  fine: new Cascade({ name: 'fine', size: 2048, extent: 12, depth: 1600, bias: 3.4, offset: 2.6, uniforms: { map: SU.uShadowMap0, matrix: SU.uShadowMatrix0, bias: SU.uShadowBias0, offset: SU.uShadowNormalOffset0 } }),
  near: new Cascade({ name: 'near', size: 4096, extent: 220, depth: 1600, bias: 2.3, offset: 3.2, uniforms: { map: SU.uShadowMap, matrix: SU.uShadowMatrix, bias: SU.uShadowBias, offset: SU.uShadowNormalOffset } }),
  far: new Cascade({ name: 'far', size: 256, extent: 1150, depth: 3200, bias: 2.2, offset: 2.4, uniforms: { map: SU.uShadowMap2, matrix: SU.uShadowMatrix2, bias: SU.uShadowBias2, offset: SU.uShadowNormalOffset2 } }),
};
for (const c of Object.values(cascades)) c.prime(renderer);
cascades.far.disable();
/**
 * The shadows as the game draws them on this person: 'fine' within ~12 m of the traveller (the
 * fine cascade), 'near' further off (the street's map, 9 cm texels), 'handheld' (the handheld
 * preset: no fine map, a smaller near one, 4 taps), 'off'.
 */
function configureShadows() {
  const m = state.shadows;
  if (m === 'handheld') { cascades.fine.disable(); cascades.near.configure(2048, 160); SU.uShadowTaps.value = 4; }
  else {
    cascades.near.configure(4096, 220);
    if (m === 'fine') cascades.fine.configure(2048, 12); else cascades.fine.disable();
    SU.uShadowTaps.value = 9;
  }
  if (m === 'off') cascades.near.disable();
  for (const c of [cascades.fine, cascades.near]) if (c.enabled) c.prime(renderer);
  SU.uShadowTexel.value.set(cascades.fine.texel, cascades.near.texel, cascades.far.texel);
}
SU.uCloudShadows.value = 0;
const shadowOverride = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });

function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const pr = Math.min(devicePixelRatio, 2) * state.scale;
  const rw = Math.max(1, Math.floor(w * pr)), rh = Math.max(1, Math.floor(h * pr));
  renderer.setSize(Math.floor(w * Math.min(devicePixelRatio, 2)), Math.floor(h * Math.min(devicePixelRatio, 2)), false);
  gbuffer.setSize(rw, rh);
  composeRT.setSize(rw, rh);
  blit.material.uniforms.resolution.value.set(1 / rw, 1 / rh);
  U.uRes.value.set(rw, rh);
  U.uPixelRatio.value = pr;
  SU.uPixelRatio.value = pr;
}
new ResizeObserver(() => resize()).observe(view);

// the floor, a stool for the seated, the gaze target
const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 64).rotateX(-Math.PI / 2), makeMaterial({ color: '#e3cf9f', studio: 'ground' }));
ground.userData.noCollide = true;
scene.add(ground);
const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.45, 18).translate(0, 0.225, 0), makeMaterial({ color: '#a8794f', studio: 'stool' }));
stool.visible = false;
scene.add(stool);
const marker = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), makeMaterial({ color: '#c8483a', glow: 0.9, studio: 'marker' }));
marker.position.set(0.6, 1.6, 1.1);
scene.add(marker);

// ------------------------------------------------------------------ assets
const BASE = import.meta.env.BASE_URL;
const t0 = performance.now();
const [lib, hm, hf, travellerScene] = await Promise.all([
  loadAnimationLibrary(`${BASE}anim/ual.glb`), loadHuman('m'), loadHuman('f'),
  new GLTFLoader().loadAsync(`${BASE}anim/traveller.glb`).then((g) => g.scene),
]);
const humans = { m: hm, f: hf };
console.info(`studio: people loaded in ${(performance.now() - t0).toFixed(0)} ms`);
// the worlds' skies come with the Lab's rooms (one sample of every world: its sky, light, ink and ground)
let ROOMS = [];
const roomsReady = import('../levels/lab-rooms.js').then((m) => { ROOMS = m.ROOMS; applyLight(); }).catch((e) => console.warn('no world skies', e));

// a flat world for the people: the ground at y = 0 (feet planting, cloth)
const physics = {
  groundAt: () => 0, pushCapsule() {}, heightAbove: (p) => p.y,
  groundNormal: (x, y, z, out = new THREE.Vector3()) => out.set(0, 1, 0),
};
const wind = new THREE.Vector3();
const fakePlayer = { pos: new THREE.Vector3(0, -100, 0), wind, vel: new THREE.Vector3(), hidden: true };

// ------------------------------------------------------------------ people
/**
 * One person on the stage: { kind: 'traveller' | 'npc', root, char, h (Humanoid), animator,
 * npc?, gear?, look?, baseScale, pos, heading }.
 */
function makeTraveller() {
  const char = buildCharacter();
  char.jetpack.visible = false;
  const h = new Humanoid(hm, char, 'm', { outfit: travellerScene });
  const animator = new Animator(lib, char);
  scene.add(char.root);
  const gear = new Gear(scene, h, char);
  if (char.pack) char.pack.visible = false;
  h.ownMaterials();
  const copies = markHero(char.root);
  markHero(gear.device, copies);
  return { type: 'traveller', name: 'The traveller', root: char.root, char, h, animator, gear, baseScale: 1, noShadow: gear.noShadow };
}

function makeNPC(def, look, world) {
  setCostumeWorld(world);
  const kind = look.kind ?? def?.kind ?? 'm';
  const npc = new NPC(scene, physics, {
    route: [new THREE.Vector3()], palette: def?.palette ?? {}, lines: ['…'], lib, human: humans[kind], kind,
    scale: def?.scale ?? null, head: def?.head ?? null, cape: def?.cape ?? null, def: def ?? null, world,
  });
  npc.restyle(look);
  npc.char.pack.visible = !!state.l.pack;
  npc.humanoid.ownMaterials();
  const baseScale = (def?.scale ?? look.height ?? 1) * (look.size ?? 1);
  return { type: 'npc', name: def?.name ?? (look.blank ? 'A blank body' : `Someone of ${TITLES[world] ?? world}`), root: npc.object, char: npc.char, h: npc.humanoid, animator: npc.animator, npc, look, baseScale, noShadow: [] };
}

function disposePerson(p) {
  if (!p) return;
  if (p.npc) p.npc.dispose(scene);
  else { scene.remove(p.root); p.gear?.device?.removeFromParent(); }
}

let people = [];      // on stage
let gpu = null;       // the GPU crowd figures (crowd-shader.js)
let cast = [];        // the world's story people
const lookOf = (p) => p.look;

/** The single person the panel edits (the first on stage). */
const subject = () => people[0];

async function rebuild() {
  for (const p of people) disposePerson(p);
  people = [];
  if (gpu) { gpu.removeFromParent(); gpu.geometry.dispose(); gpu = null; }
  cast = await castOf(state.world);
  const world = state.world;
  const specs = [];
  if (state.lineup === 'cast') {
    for (const def of cast) specs.push({ who: 'npc', def });
    if (!specs.length) specs.push({ who: 'blank' });
  } else if (state.lineup === 'crowd') {
    for (let i = 0; i < state.count; i++) specs.push({ who: 'crowd', seed: state.seed + i });
  } else if (state.lineup === 'faces') {
    // the traveller and a story person of every world (the n-th of each cast: the crowd seed picks), dressed for their world
    specs.push({ who: 'traveller' });
    for (const w of STORY_WORLDS) {
      const c = await castOf(w);
      specs.push(c.length ? { who: 'npc', def: c[(state.seed - 1) % c.length], world: w } : { who: 'crowd', seed: state.seed, world: w });
    }
  } else specs.push({ who: state.who, def: cast.find((d) => d.id === state.npc) ?? cast[0], seed: state.seed });
  const n = specs.length, gap = state.lineup ? 1.05 : 0;
  specs.forEach((sp, i) => {
    let p;
    const w = sp.world ?? world;
    if (sp.who === 'traveller') p = makeTraveller();
    else {
      const look = lookFor(sp, state, w);
      p = makeNPC(sp.who === 'npc' ? sp.def : null, look, w);
      p.spec = sp;
      p.world = w;
    }
    p.pos = new THREE.Vector3((i - (n - 1) / 2) * gap, 0, 0);
    p.home = p.pos.clone();
    p.heading = 0;
    p.clipTime = 0;
    people.push(p);
  });
  // the GPU crowd figures: behind a crowd lineup, or beside the one person (twin)
  const twins = state.lineup === 'crowd' ? people : state.twin && !state.lineup && people[0]?.look ? [people[0]] : [];
  if (twins.length) {
    const geo = figureGeometry('mid', world);
    for (const k of ['aAnim', 'aReact', 'aLook0', 'aLook1', 'aDress', 'aBody']) geo.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(twins.length * 4), 4));
    gpu = new THREE.InstancedMesh(geo, makeMaterial({ color: '#ffffff', crowd: true, side: THREE.DoubleSide }), twins.length);
    gpu.frustumCulled = false;
    gpu.userData.twins = twins;
    scene.add(gpu);
  }
  applyBody();
  applyFace();
  updatePanel();
  setStatus(describe());
}

/** Restyle (costume, colours, build) without rebuilding the people. */
function applyLook() {
  for (const p of people) {
    if (!p.npc) continue;
    const look = lookFor(p.spec, state, p.world ?? state.world);
    p.look = look;
    setCostumeWorld(p.world ?? state.world);
    p.npc.restyle(look);
    p.npc.char.pack.visible = !!state.l.pack;
    p.h.ownMaterials();
    p.baseScale = (p.spec.def?.scale ?? look.height ?? 1) * (look.size ?? 1);
  }
  applyBody();
  applyFace();
  if (gpu) writeGPU(0);
  setStatus(describe());
}
function applyBody() {
  const one = !state.lineup;
  for (const p of people) {
    p.morph = p.h.setMorph(one ? state.b : null);
  }
}
function applyFace() {
  const one = !state.lineup;
  for (const p of people) {
    // (the person's own face, the traveller's: Humanoid.ownFace, under the sliders)
    p.h.setFace(one ? { ...(p.h.ownFace ?? {}), ...state.f } : p.h.ownFace);
    // the traveller's skin, if picked (the rest is their suit)
    if (p.type === 'traveller' && state.c.skin) for (const m of [p.h.body.material, p.h.eyeMesh?.material]) m?.uniforms.uSkin.value.set(state.c.skin);
  }
}

function writeGPU(t) {
  const twins = gpu.userData.twins, A = gpu.geometry.attributes, m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const walking = /game:(walk|jog|run)/.test(state.anim);
  twins.forEach((p, i) => {
    const s = p.baseScale * (p.look.kind === 'm' ? 1.03 : 1);
    const at = state.lineup === 'crowd' ? new THREE.Vector3(p.pos.x, 0, p.pos.z - 2.2) : new THREE.Vector3(p.pos.x + 1.1, 0, p.pos.z);
    q.setFromAxisAngle(UP, p.heading);
    gpu.setMatrixAt(i, m.compose(at, q, new THREE.Vector3().setScalar(s)));
    const L = packLook(p.look);
    A.aAnim.array.set([(i * 0.37) % 1, walking ? 0.9 : 0, (i * 0.61) % 1, walking ? CROWD_POSES.walk : state.anim === 'game:sit' ? CROWD_POSES.sit : CROWD_POSES.stand], i * 4);
    A.aReact.array.set([0, 0, state.talk || state.anim === 'game:talk' ? 1 : 0, -1e9], i * 4);
    A.aLook0.array.set(L[0], i * 4); A.aLook1.array.set(L[1], i * 4); A.aDress.array.set(L[2], i * 4); A.aBody.array.set(L[3], i * 4);
  });
  for (const k of Object.keys(A)) A[k].needsUpdate = true;
  gpu.instanceMatrix.needsUpdate = true;
  gpu.count = twins.length;
}

function describe() {
  const p = subject();
  if (!p) return '';
  if (state.lineup === 'faces') return `${people.length} faces, from the left: ${people.map((q) => (q.world ? `${q.name} (${TITLES[q.world] ?? q.world})` : q.name)).join(', ')} · Share → Faces sheet`;
  if (state.lineup) return `${people.length} people · ${TITLES[state.world] ?? state.world}${state.lineup === 'crowd' ? ' · front: full bodies, back: GPU crowd figures' : ''}`;
  const L = p.look;
  return L ? `${p.name} · ${L.kind === 'f' ? 'woman' : L.kind === 'm' ? 'man' : 'person'} · ${L.build} · ${(p.baseScale * (state.b.height ?? 1) * 1.8).toFixed(2)} m · ${L.tribe ?? ''}` : `${p.name} · the suit, the gear of traveller.glb`;
}

// ------------------------------------------------------------------ animation, eyes, expression, cloth
const clipNames = lib.all.map((c) => c.name).sort();
const GAITS = { 'game:walk': 'walk', 'game:jog': 'jog', 'game:run': 'sprint' };
function gaitSpeed() {
  const N = lib.native, g = GAITS[state.anim];
  return g === 'walk' ? N.walk * 1.3 : g === 'jog' ? N.jog : g === 'sprint' ? N.sprint * 1.2 : 0;
}
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

function animate(p, dt, t) {
  const c = p.char, a = p.animator, root = p.root;
  const dtA = state.paused ? 0 : dt * state.speed;
  const speed = gaitSpeed();
  // walking forward over the floor (wrapping round), or on the spot
  if (state.move && speed > 0 && !state.paused) {
    p.pos.z += speed * dtA;
    if (p.pos.z > 5) { p.pos.z = p.home.z - 5; p.h.resetFeet(); if (p.npc?.cape) p.npc.cape.ready = false; }
  } else if (!state.move) p.pos.z = p.home.z;
  p.heading = 0;
  const seated = state.anim === 'game:sit';
  root.position.copy(p.pos);
  root.quaternion.setFromAxisAngle(UP, p.heading);
  root.scale.setScalar(p.baseScale * (state.lineup ? 1 : state.b.height ?? 1));
  root.updateMatrixWorld(true);
  const clip = state.anim.startsWith('clip:') ? lib.all.find((k) => k.name === state.anim.slice(5)) : null;
  p.extra ??= new Map();
  if (clip) {
    // one clip of the library, as authored
    for (const act of Object.values(a.actions)) act.setEffectiveWeight(0);
    for (const act of p.extra.values()) act.setEffectiveWeight(0);
    let act = Object.values(a.actions).find((x) => x.getClip() === clip) ?? p.extra.get(clip.name);
    if (!act) { act = a.mixer.clipAction(clip); act.play(); p.extra.set(clip.name, act); }
    act.enabled = true;
    act.setEffectiveWeight(1);
    p.clipTime = state.paused ? state.time * clip.duration : (p.clipTime + dtA) % clip.duration;
    act.time = p.clipTime;
    a.mixer.update(0);
    a.src.updateMatrixWorld(true);
  } else {
    // the game's blend (as NPC.pose drives it): idle / walk / jog / run by speed, talking
    for (const act of p.extra.values()) act.setEffectiveWeight(0);
    const N = lib.native;
    a.update(dtA, { speed: state.paused ? speed : speed, onGround: true, mode: state.anim === 'game:talk' ? 'talk' : 'ground', walkAt: N.walk * 1.3, jogAt: N.jog, sprintAt: N.sprint * 1.2, strideScale: 1.05 });
  }
  a.apply(root, { legScale: 1.04 });
  if (seated && p.npc) {
    p.npc.time = t;
    p.npc.object = root;
    p.npc.pos.copy(p.pos);
    p.npc.posture(dtA, { pose: 4 });
    const s = root.scale.y;
    root.position.set(p.pos.x, 0.45 + (0.05 - 0.95) * s, p.pos.z - 0.12 * s);
  }
  // the head turns toward what they look at (NPC.pose: the yaw, 0.8 of it)
  const target = lookTarget();
  if (target) {
    _v.subVectors(target, p.pos);
    let ang = Math.atan2(_v.x, _v.z) - p.heading;
    ang = Math.atan2(Math.sin(ang), Math.cos(ang));
    c.head.rotateY(THREE.MathUtils.clamp(ang, -1.1, 1.1) * 0.8);
  }
  root.updateMatrixWorld(true);
  const H = p.h;
  H.update();
  if (p.type === 'traveller') {
    H.poseHands(a);
    // the traveller's feet find the ground (the player's plantFeet); the people's don't, in the game either
    if (state.plant && !clip && !seated) H.plantFeet(dt, physics, UP, root.position, _w.set(Math.sin(p.heading), 0, Math.cos(p.heading)), null);
    else H.resetFeet();
  }
  // the expression: the tone's, then the sliders' own values on top; talking moves the mouth
  const e = expressionFor(state.tone, { amount: state.amount, talking: state.talk, t, rest: H.restExpression });
  for (const d of EXPRESSION_KEYS) if (state.e[d.key] !== undefined) e[d.key] = +state.e[d.key];
  if (state.gaze === 'fixed') e.gaze = [+(state.e.gazeX ?? 0), +(state.e.gazeY ?? 0)];
  else if (state.gaze !== 'free') e.gaze = null;
  H.setExpression(e);
  if (!state.blink) { H.eyeLook.blink = 0; H.eyeLook.blinkAt = -1; H.eyeLook.nextBlink = H.eyeLook.t + 1; }
  H.updateEyes(dt, state.gaze === 'camera' || state.gaze === 'target' ? target : null);
  // cloth
  if (p.npc?.cape) {
    const cape = p.npc.cape;
    cape.mesh.visible = true;
    if (state.cape) {
      p.npc.vel.set(Math.sin(p.heading) * speed, 0, Math.cos(p.heading) * speed);
      root.updateMatrixWorld(true);
      const s = p.npc.clothState(fakePlayer, state.move ? speed : 0);
      if (!cape.drape && !cape.ready) cape.bake({ ...s, capsules: p.npc.clothCapsules(null) }, { key: p.npc.drapeKey(seated ? 4 : 0) });
      if (dt > 1e-4) cape.update(Math.min(dt, 1 / 20), s);   // (a cloth step of 0 s divides by it)
    } else {
      root.updateMatrixWorld(true);
      if (!cape.drape) cape.bake(p.npc.clothState(fakePlayer, 0), { key: p.npc.drapeKey(seated ? 4 : 0), force: true });
      cape.rest(dt);
    }
  }
  if (p.gear) p.gear.update(dt, _w.set(0, 0, 0), a.phase ?? 0, speed / 6, true);
}

function lookTarget() {
  if (state.gaze === 'camera') return camera.position;
  if (state.gaze === 'target') return marker.position;
  return null;
}

// ------------------------------------------------------------------ light and ink
const room = () => ROOMS.find((r) => r.id === state.world);
/** The hour shown: the panel's, or the world's own (its default in the game). */
const worldHour = () => (state.hour >= 0 ? state.hour : room()?.hour ?? { lab: 11, home: 17.6, atelier: 11 }[state.world] ?? 10);
/** Worlds whose light on the ground isn't the sky's (levels/<world>.js lightAt). */
const WORLD_LIGHT = { bazaar: 'overhead', incal: 'steep', buried: 'steep' };
let atmo = null, script;
function applyLight() {
  const R = room();
  script = R?.sky?.script ? colourScript(R.sky.script) : undefined;
  atmo = R?.atmo ? { tint: R.atmo.tint, fog: R.atmo.fog } : null;
  // the ink preset: the world's (Moebius print and its touches, as the game's worlds) or one by name
  const name = state.preset === 'world' ? 'Moebius print' : state.preset;
  for (const [k, v] of Object.entries(PRESETS[name] ?? PRESETS['Moebius print'])) if (U[k]) U[k].value = v;
  if (state.preset === 'world') for (const [k, v] of Object.entries(R?.look ?? {})) if (U[k]) U[k].value = v;
  if (!state.hatch) SU.uHatch.value = 0;
  U.uDebug.value = +state.debug;
  // planets in the world's sky
  const planets = R?.sky?.planets ?? [];
  for (let i = 0; i < 3; i++) {
    const pl = planets[i];
    if (!pl) { U.uPlanet.value[i].set(0, -1, 0, 0); continue; }
    const el = THREE.MathUtils.degToRad(pl.el), az = THREE.MathUtils.degToRad(pl.az);
    U.uPlanet.value[i].set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az), THREE.MathUtils.degToRad(pl.size));
    const col = new THREE.Color(pl.color);
    U.uPlanetColor.value[i].set(col.r, col.g, col.b, pl.ring ?? 0);
    U.uPlanetCraters.value.setComponent(i, pl.craters === false ? 0 : 1);
  }
  ground.material.uniforms.uColor.value.set(R?.ground?.material?.color ?? '#e3cf9f');
  ground.visible = state.ground;
  configureShadows();
  applySky();
}
function applySky() {
  applyTimeOfDay(worldHour(), SU.uSunDir.value, U, atmo, script);
  // the world's own light on the people (levels/*.js lightAt): the Signal Market's streets are lit from straight above
  const light = state.light || WORLD_LIGHT[state.world] || 'hour', d = SU.uSunDir.value;
  if (light === 'overhead' && d.y > 0) d.set(0.12, 1, 0.18).normalize();
  // (the City-Shaft's terraces, the Buried Machine's canyon: the sun comes in steeper)
  else if (light === 'steep' && d.y > 0.05) { d.y += state.world === 'buried' ? 0.8 : 0.9; d.normalize(); }
  // turn the light round the person (the sun's azimuth, the moon's with it)
  const turn = THREE.MathUtils.degToRad(state.sunTurn);
  if (turn) for (const v of [SU.uSunDir.value, U.uSunDisc.value, U.uMoonDisc.value, U.uSunDir.value]) v.applyAxisAngle(UP, turn);
  const bg = new THREE.Color(state.bgColor);
  U.uBackdrop.value.set(bg.r, bg.g, bg.b, state.bg === 'flat' ? 1 : 0);
}

// ------------------------------------------------------------------ camera
const VIEWS = {
  full: { y: 0.92, dist: 4.6 }, bust: { y: 1.45, dist: 1.3 }, face: { y: 1.67, dist: 0.72 }, close: { y: 1.67, dist: 0.4 }, far: { y: 0.92, dist: 34 },
};
const orbit = { yaw: state.yaw, pitch: state.pitch, zoom: 1 };
function placeCamera(dt) {
  if (state.turntable) orbit.yaw += dt * 0.45;
  const V = VIEWS[state.view] ?? VIEWS.full;
  const p = subject();
  const s = state.lineup ? 1 : (p?.baseScale ?? 1) * (state.b.height ?? 1);
  const headView = state.view === 'face' || state.view === 'close' || state.view === 'bust';
  let dist = V.dist * orbit.zoom * (headView ? s : Math.max(s, 1));
  if (camera.aspect < 0.85) dist *= 0.85 / camera.aspect;   // (a tall, narrow view: keep the shoulders in)
  if (state.lineup && state.view === 'full') {
    // the whole row in the frame
    const half = (people.length * 1.05) / 2 + 0.7, hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
    dist = Math.max(dist, (half / Math.tan(hfov / 2)) * orbit.zoom);
  }
  // (the head's real height: a seated person, longer legs, a bigger head)
  let ty = V.y * s;
  const head = p?.h?.b?.Head;
  if (p && headView && head) ty = head.getWorldPosition(_v).y + (state.view === 'bust' ? -0.13 : state.view === 'close' ? 0.045 : 0.0) * s;
  const cx = state.lineup ? 0 : p?.pos.x ?? 0, cz = state.lineup ? 0 : p?.pos.z ?? 0;
  const target = new THREE.Vector3(cx, ty, cz);
  camera.position.set(cx + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * dist, ty + Math.sin(orbit.pitch) * dist, cz + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * dist);
  camera.position.y = Math.max(camera.position.y, 0.05);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

// orbit by dragging, zoom with the wheel or a pinch; drag the red ball to move the gaze target
const ray = new THREE.Raycaster(), pointers = new Map();
let drag = null;
const ndc = (e) => { const r = renderer.domElement.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
renderer.domElement.addEventListener('pointerdown', (e) => {
  renderer.domElement.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  ray.setFromCamera(ndc(e), camera);
  if (marker.visible && ray.intersectObject(marker).length) {
    const n = camera.getWorldDirection(new THREE.Vector3());
    drag = { marker: true, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, marker.position) };
  } else drag = { x: e.clientX, y: e.clientY, yaw: orbit.yaw, pitch: orbit.pitch };
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    const others = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1];
    const d0 = Math.hypot(prev.x - others.x, prev.y - others.y);
    if (d0 > 0) orbit.zoom = THREE.MathUtils.clamp(orbit.zoom * d0 / d, 0.15, 6);
    return;
  }
  if (!drag) return;
  if (drag.marker) {
    ray.setFromCamera(ndc(e), camera);
    ray.ray.intersectPlane(drag.plane, marker.position);
    return;
  }
  orbit.yaw = drag.yaw - (e.clientX - drag.x) * 0.008;
  orbit.pitch = THREE.MathUtils.clamp(drag.pitch + (e.clientY - drag.y) * 0.006, -0.5, 1.35);
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  if (drag && !drag.marker) { state.yaw = +orbit.yaw.toFixed(3); state.pitch = +orbit.pitch.toFixed(3); saveURL(); }
  drag = null;
};
renderer.domElement.addEventListener('pointerup', endPointer);
renderer.domElement.addEventListener('pointercancel', endPointer);
renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); orbit.zoom = THREE.MathUtils.clamp(orbit.zoom * Math.exp(e.deltaY * 0.0012), 0.15, 6); }, { passive: false });

// ------------------------------------------------------------------ frame
let focus = null;   // (the contact sheet: the one person drawn)

/**
 * A contact sheet of everyone on stage: each person alone (the others hidden), their face (view
 * 'face' / 'close', or 'bust') from the orbit's angle, in a grid of `cols`, cell w x h CSS px.
 * Returns a PNG data URL. (Share → Faces sheet; window.studio.sheet())
 */
function sheet({ cols = 4, w = 340, h = 400, view = state.view === 'close' || state.view === 'bust' ? state.view : 'face' } = {}) {
  const src = renderer.domElement, dpr = renderer.getPixelRatio();
  const out = document.createElement('canvas');
  const rows = Math.ceil(people.length / cols);
  out.width = Math.round(cols * w * dpr); out.height = Math.round(rows * h * dpr);
  const g = out.getContext('2d');
  g.fillStyle = '#f2ecdf'; g.fillRect(0, 0, out.width, out.height);
  const aspect0 = camera.aspect;
  const parts = (q) => [q.root, q.npc?.cape?.mesh, q.gear?.device].filter(Boolean);
  const shown = people.flatMap((q) => parts(q).map((o) => [o, o.visible]));
  const V = VIEWS[view] ?? VIEWS.face, s0 = Math.min(src.width / src.height, w / h);
  try {
    people.forEach((p, i) => {
      for (const q of people) for (const o of parts(q)) o.visible = q === p;
      focus = p;
      camera.aspect = src.width / src.height;
      camera.updateProjectionMatrix();
      // (twice: the head turns toward the camera, the camera follows the head)
      for (let k = 0; k < 2; k++) {
        const head = p.h.b.Head.getWorldPosition(new THREE.Vector3()), sc = p.root.scale.y;
        head.y += (view === 'bust' ? -0.13 : view === 'close' ? 0.045 : 0) * sc;
        // (the cell is cut from the middle of the picture, its full height: the face view's framing)
        const dist = V.dist * sc * orbit.zoom;
        camera.position.set(head.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * dist, head.y + Math.sin(orbit.pitch) * dist, head.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * dist);
        camera.lookAt(head);
        camera.updateMatrixWorld();
        animate(p, 0, simT);
      }
      renderFrame();
      const ch = src.height, cw = Math.min(src.width, ch * s0);
      g.drawImage(src, (src.width - cw) / 2, 0, cw, ch, (i % cols) * w * dpr, Math.floor(i / cols) * h * dpr, w * dpr, h * dpr);
      g.fillStyle = 'rgba(242,236,223,0.85)';
      g.fillRect((i % cols) * w * dpr, (Math.floor(i / cols) + 1) * h * dpr - 22 * dpr, w * dpr, 22 * dpr);
      g.fillStyle = '#2b211f'; g.font = `${12 * dpr}px sans-serif`;
      g.fillText(p.world ? `${p.name} · ${TITLES[p.world] ?? p.world}` : p.name, (i % cols) * w * dpr + 8 * dpr, (Math.floor(i / cols) + 1) * h * dpr - 7 * dpr);
    });
  } finally {
    focus = null;
    for (const [o, v] of shown) o.visible = v;
    camera.aspect = aspect0;
    camera.updateProjectionMatrix();
  }
  return out.toDataURL('image/png');
}

function renderFrame() {
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  // 1. shadows round the person
  const dir = shadowDirection(SU.uSunDir.value, new THREE.Vector3());
  const centre = focus ? _v.copy(focus.pos).setY(1) : subject() && !state.lineup ? _v.copy(subject().pos).setY(1) : _v.set(0, 1, 0);
  const hidden = [marker, ...(gpu ? [gpu] : []), ...people.flatMap((p) => p.noShadow ?? [])].filter((o) => o.visible);
  for (const o of hidden) o.visible = false;
  scene.overrideMaterial = shadowOverride;
  for (const c of [cascades.fine, cascades.near]) if (c.enabled) { c.aim(dir); c.place(centre); c.render(renderer, scene); }
  scene.overrideMaterial = null;
  for (const o of hidden) o.visible = true;
  // 2. the G-buffer
  renderer.setRenderTarget(gbuffer);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  // 3. the ink pass
  U.uInvProj.value.copy(camera.projectionMatrixInverse);
  U.uCamWorld.value.copy(camera.matrixWorld);
  U.uProj11.value = camera.projectionMatrix.elements[5];
  const p = focus ?? subject();
  setSubject(U, camera, p && (focus || !state.lineup) ? p.pos : _w.set(0, 0, 0), UP, !state.subject || !p);
  renderer.setRenderTarget(composeRT);
  renderer.clear();
  renderer.render(post.scene, post.camera);
  // 4. FXAA to the screen
  renderer.setRenderTarget(null);
  renderer.render(blit.scene, post.camera);
}

let last = performance.now(), simT = 0, fps = 60, statusT = 0;
let failed = false;
function frame(now) {
  requestAnimationFrame(frame);
  try { step(now); } catch (e) { if (!failed) console.error('studio frame:', e); failed = true; }
}
function step(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  simT += dt;
  SU.uTime.value = U.uTime.value = simT;
  wind.set(state.wind * 1.6, 0, state.wind * 0.6);
  SU.uWind.value.set(1, 0, state.wind, 0.4);
  marker.visible = state.gaze === 'target';
  stool.visible = state.anim === 'game:sit' && !state.lineup;
  if (stool.visible && subject()) stool.position.set(subject().pos.x, 0, subject().pos.z - 0.12);
  placeCamera(dt);
  for (const p of people) animate(p, dt, simT);
  if (gpu) writeGPU(simT);
  renderFrame();
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
  statusT += dt;
  if (statusT > 0.5 && people.length) {
    statusT = 0;
    // how tall the person stands on screen (px): post.js thins a figure's ink by it (70 – 260 px)
    const s = subject(), depth = camera.position.distanceTo(_v.copy(s.pos).setY(0.95 * s.root.scale.y));
    const px = 1.8 * s.root.scale.y * (renderer.domElement.clientHeight * 0.5) * camera.projectionMatrix.elements[5] / depth;
    setStatus(`${describe()} · ${px.toFixed(0)} px tall · ${fps.toFixed(0)} fps`);
  }
}

// ------------------------------------------------------------------ the panel
const controls = $('controls');
const refreshers = [];
let urlTimer = 0;
function saveURL() {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => history.replaceState(null, '', `${location.pathname}?${encodeState(state)}`), 150);
}
const get = (path) => path.split('.').reduce((o, k) => o?.[k], state);
function set(path, v) {
  const keys = path.split('.');
  let o = state;
  for (const k of keys.slice(0, -1)) o = o[k];
  if (v === undefined || v === '') delete o[keys.at(-1)]; else o[keys.at(-1)] = v;
  saveURL();
}
function section(title, open = false) {
  const d = document.createElement('details');
  d.open = open;
  d.innerHTML = `<summary>${title}</summary>`;
  controls.append(d);
  return d;
}
function row(parent, label, input, out = null) {
  const r = document.createElement('div');
  r.className = 'row';
  const l = document.createElement('label');
  l.textContent = label;
  r.append(l, input);
  if (out) r.append(out);
  parent.append(r);
  return r;
}
/** A dropdown: options [[value, label]] (or a function giving them), on change → then(). */
function select(parent, label, path, options, then) {
  const s = document.createElement('select');
  const fill = () => {
    const opts = typeof options === 'function' ? options() : options;
    s.replaceChildren(...opts.map(([v, t]) => new Option(t, v)));
    s.value = String(get(path) ?? '');
  };
  fill();
  s.onchange = () => { set(path, s.value); then?.(); };
  row(parent, label, s);
  refreshers.push(fill);
  return s;
}
/** A slider; def: the value shown when the path is unset (a number or a function). */
function slider(parent, label, path, min, max, step, def, then, { unset = false } = {}) {
  const i = document.createElement('input');
  Object.assign(i, { type: 'range', min, max, step });
  const out = document.createElement('output');
  const r = row(parent, label, i, out);
  const show = () => {
    const v = get(path);
    const shown = v ?? (typeof def === 'function' ? def() : def);
    i.value = shown;
    out.textContent = (+shown).toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0);
    r.classList.toggle('overridden', unset && v !== undefined);
  };
  show();
  i.oninput = () => { set(path, +i.value); show(); then?.(); };
  // a double click puts it back
  i.ondblclick = () => { set(path, unset ? undefined : typeof def === 'function' ? def() : def); show(); then?.(); };
  refreshers.push(show);
  return i;
}
function check(parent, label, path, then) {
  const i = document.createElement('input');
  i.type = 'checkbox';
  const show = () => { i.checked = !!get(path); };
  show();
  i.onchange = () => { set(path, i.checked); then?.(); };
  row(parent, label, i);
  refreshers.push(show);
  return i;
}
let listN = 0;
function color(parent, label, path, swatches, def, then) {
  const i = document.createElement('input');
  i.type = 'color';
  const list = document.createElement('datalist');
  list.id = `swatch-${listN++}`;
  i.setAttribute('list', list.id);
  const r = row(parent, label, i);
  r.append(list);
  const show = () => {
    list.replaceChildren(...(typeof swatches === 'function' ? swatches() : swatches).map((c) => new Option('', c)));
    const v = get(path) ?? (typeof def === 'function' ? def() : def) ?? '#888888';
    i.value = /^#[0-9a-f]{6}$/i.test(v) ? v : '#888888';
    r.classList.toggle('overridden', get(path) !== undefined);
  };
  show();
  i.oninput = () => { set(path, i.value); show(); then?.(); };
  i.ondblclick = () => { set(path, undefined); show(); then?.(); };
  refreshers.push(show);
}
function buttons(parent, list) {
  const b = document.createElement('div');
  b.className = 'buttons';
  for (const [t, f] of list) { const x = document.createElement('button'); x.textContent = t; x.onclick = f; b.append(x); }
  parent.append(b);
  return b;
}
function updatePanel() { for (const f of refreshers) f(); viewButtons(); }
const opt = (list, own = 'their own') => [['', own], ...list.map((v) => [v, v])];
const pal = (k) => () => tribeOf(state.world).palette?.[k] ?? [];
const lookDef = (k) => () => subject()?.look?.[k];

// who
const sWho = section('Who', true);
select(sWho, 'Person', 'who', [['traveller', 'The traveller'], ['npc', 'A story person'], ['crowd', 'Someone in the crowd'], ['blank', 'A blank body']], () => { state.lineup = ''; rebuild(); });
select(sWho, 'World', 'world', COSTUME_WORLDS.map((w) => [w, TITLES[w] ?? w]), () => { state.npc = ''; state.spot = ''; rebuild(); applyLight(); });
select(sWho, 'Story person', 'npc', () => [['', cast.length ? '(the first)' : '(nobody in this world)'], ...cast.map((d) => [d.id, `${d.name}${d.title ? `, ${d.title}` : ''}`])], () => { state.who = 'npc'; rebuild(); });
slider(sWho, 'Crowd seed', 'seed', 1, 200, 1, 1, () => { if (state.who === 'crowd' || state.lineup === 'crowd') rebuild(); });
const spotSel = select(sWho, 'Where (City-Shaft)', 'spot', [['', 'as the story places them'], ['rim', 'the rim'], ['upper', 'the upper levels'], ['middle', 'the middle levels'], ['lower', 'the bottom of the shaft']], applyLook);
select(sWho, 'Body', 'kind', [['m', 'man'], ['f', 'woman']], () => { if (state.who !== 'npc' && state.who !== 'traveller') rebuild(); });
refreshers.push(() => { spotSel.parentElement.hidden = state.world !== 'incal'; });
const sLine = section('Lineup');
select(sLine, 'Lineup', 'lineup', [['', 'one person'], ['cast', "the world's story people"], ['crowd', 'crowd people (+ GPU figures)'], ['faces', "every world's faces (+ the traveller)"]], rebuild);
slider(sLine, 'How many', 'count', 2, 14, 1, 6, () => { if (state.lineup === 'crowd') rebuild(); });
check(sLine, 'GPU crowd twin', 'twin', rebuild);

// body
const sBody = section('Body');
select(sBody, 'Build', 'build', [['', 'their own'], ...Object.keys(BUILDS).map((b) => [b, b])], applyLook);
for (const m of BODY_MORPHS) slider(sBody, m.label, `b.${m.key}`, m.min, m.max, 0.01, m.def, applyBody, { unset: true });
buttons(sBody, [['Reset body', () => { state.b = {}; state.build = ''; saveURL(); applyLook(); updatePanel(); }]]);

// outfit
const sFit = section('Outfit');
{
  // the head slot: a hairstyle (bare-headed) or headwear (with the short hair under it)
  const sel = document.createElement('select');
  const group = (label, ids) => { const g = document.createElement('optgroup'); g.label = label; g.append(...ids.map((v) => new Option(v, v))); return g; };
  sel.append(new Option('their own', ''), new Option("bare: their people's hair", 'bare'), group('Hair', HAIR_IDS), group('Headwear', HEAD_IDS.filter((h) => !HAIR_IDS.includes(h))));
  const show = () => { sel.value = state.l.head ?? ''; };
  sel.onchange = () => { set('l.head', sel.value); applyLook(); };
  row(sFit, 'Hair / headwear', sel);
  refreshers.push(show);
  show();
}
check(sFit, 'Beard', 'l.beard', applyLook);
select(sFit, 'Mask', 'l.mask', opt(MASK_IDS), applyLook);
select(sFit, 'Shoulders', 'l.body', opt(BODY_IDS), applyLook);
select(sFit, 'Held prop', 'l.prop', opt(PROP_IDS), applyLook);
select(sFit, 'Cloth pattern', 'l.trim', opt(TRIM_IDS), applyLook);
slider(sFit, 'Robe hem (m)', 'l.robe', 0, 0.9, 0.01, lookDef('robe'), applyLook, { unset: true });
slider(sFit, 'Robe flare', 'l.flare', 0.2, 0.55, 0.01, lookDef('flare'), applyLook, { unset: true });
slider(sFit, 'Cape length', 'l.capeLen', 0, 1.7, 0.05, lookDef('capeLen'), applyLook, { unset: true });
slider(sFit, 'Cape width', 'l.capeWide', 0.7, 1.5, 0.01, lookDef('capeWide'), applyLook, { unset: true });
check(sFit, 'Satchel', 'l.pack', applyLook);
check(sFit, 'Cape cloth sim', 'cape');
slider(sFit, 'Wind', 'wind', 0, 3, 0.05, 0.6);
for (const [k, label, list] of [['cloak', 'Cloak', 'cloaks'], ['cloth', 'Tunic', 'tunics'], ['legs', 'Trousers', 'legs'], ['hat', 'Hat', 'hats'], ['accent', 'Accent', 'accents'], ['hair', 'Hair', 'hair'], ['skin', 'Skin', 'skins']])
  color(sFit, label, `c.${k}`, pal(list), lookDef(k), applyLook);
color(sFit, 'Eyes', 'c.eyes', IRIS.map(([c]) => c), lookDef('eyes'), applyLook);
buttons(sFit, [['Reset outfit', () => { state.l = {}; state.c = {}; saveURL(); applyLook(); updatePanel(); }]]);

// face
const sFace = section('Face');
const facePreset = document.createElement('select');
facePreset.replaceChildren(new Option('(pick a face)', ''), ...Object.keys(FACE_PRESETS).map((k) => new Option(k, k)));
facePreset.onchange = () => { if (facePreset.value) { state.f = { ...FACE_PRESETS[facePreset.value] }; saveURL(); applyFace(); updatePanel(); } facePreset.value = ''; };
row(sFace, 'Face variant', facePreset);
for (const m of FACE_MORPHS) slider(sFace, m.label, `f.${m.key}`, m.min, m.max, 0.01, m.def, applyFace, { unset: true });
buttons(sFace, [['Reset face', () => { state.f = {}; saveURL(); applyFace(); updatePanel(); }]]);

// expression
const sExp = section('Expression', true);
select(sExp, 'Tone', 'tone', TONES.map((t) => [t, t]), () => updatePanel());
slider(sExp, 'Amount', 'amount', 0, 1.5, 0.01, 1);
check(sExp, 'Talking', 'talk');
check(sExp, 'Blinking', 'blink');
select(sExp, 'Looks at', 'gaze', [['camera', 'the camera'], ['target', 'the red ball (drag it)'], ['free', 'around (glances)'], ['fixed', 'gaze sliders']]);
const toneVal = (k) => () => (TONE_EXPRESSIONS[state.tone]?.[k] ?? 0) * state.amount;
for (const d of EXPRESSION_KEYS) slider(sExp, d.label, `e.${d.key}`, d.min, d.max, 0.01, toneVal(d.key), null, { unset: true });
slider(sExp, 'Gaze sideways', 'e.gazeX', -0.42, 0.42, 0.01, 0, null);
slider(sExp, 'Gaze up / down', 'e.gazeY', -0.26, 0.2, 0.01, 0, null);
buttons(sExp, [['Back to the tone', () => { state.e = {}; saveURL(); updatePanel(); }]]);

// animation
const sAnim = section('Animation');
select(sAnim, 'Motion', 'anim', [['game:idle', 'Game: standing (idle, looks around)'], ['game:walk', 'Game: walking'], ['game:jog', 'Game: jogging'], ['game:run', 'Game: running'], ['game:talk', 'Game: talking'], ['game:sit', 'Game: seated (story pose)'],
  ...clipNames.map((n) => [`clip:${n}`, `Clip: ${n}`])], () => { for (const p of people) p.h.resetFeet(); if (gpu) writeGPU(0); });
slider(sAnim, 'Speed', 'speed', 0, 2, 0.01, 1);
check(sAnim, 'Paused', 'paused');
slider(sAnim, 'Scrub (clips)', 'time', 0, 1, 0.001, 0, () => { state.paused = true; updatePanel(); });
check(sAnim, 'Walk over the floor', 'move');
check(sAnim, 'Plant the feet (traveller)', 'plant');

// light and ink
const sLight = section('Light and ink');
slider(sLight, 'Hour', 'hour', 0, 24, 0.05, () => worldHour(), applySky, { unset: true });
slider(sLight, 'Turn the sun (°)', 'sunTurn', -180, 180, 1, 0, applySky);
select(sLight, 'Light', 'light', [['', "the world's"], ['hour', 'the sun of the hour'], ['steep', 'steeper (down the City-Shaft, the canyon)'], ['overhead', 'from straight above (the Signal Market)']], applySky);
select(sLight, 'Background', 'bg', [['sky', "the world's sky"], ['flat', 'a flat colour']], applySky);
color(sLight, 'Flat colour', 'bgColor', ['#eee9de', '#f3ead8', '#e1e6c6', '#d7dfd9', '#2b211f', '#a4d7d1', '#f2c49a'], '#eee9de', applySky);
check(sLight, 'Floor', 'ground', applyLight);
select(sLight, 'Ink preset', 'preset', [['world', "the world's"], ...Object.keys(PRESETS).map((k) => [k, k])], applyLight);
select(sLight, 'Debug view', 'debug', Object.entries(DEBUG_VIEWS).map(([k, v]) => [String(v), k]), applyLight);
select(sLight, 'Shadows', 'shadows', [['fine', 'next to the traveller (fine map)'], ['near', 'further off (street map)'], ['handheld', 'the handheld preset'], ['off', 'none']], applyLight);
check(sLight, 'Hatching', 'hatch', applyLight);
check(sLight, 'Subject detail', 'subject');
select(sLight, 'Resolution', 'scale', [['1', '1× (the game’s Auto)'], ['1.5', '1.5× (High)'], ['2', '2× (print)']], () => { state.scale = +state.scale; resize(); });

// share
const sShare = section('Share');
const json = document.createElement('textarea');
json.readOnly = true;
buttons(sShare, [
  ['Copy settings as JSON', () => { json.value = settingsJSON(state, { yaw: +orbit.yaw.toFixed(3) }); navigator.clipboard?.writeText(json.value).catch(() => {}); }],
  ['Copy link', () => { navigator.clipboard?.writeText(`${location.origin}${location.pathname}?${encodeState(state)}`).catch(() => {}); }],
  ['Save image', () => { const a = document.createElement('a'); a.download = `memento-${state.who}-${state.world}.png`; a.href = renderer.domElement.toDataURL('image/png'); a.click(); }],
  ['Faces sheet', () => { const a = document.createElement('a'); a.download = `memento-faces-${state.lineup || state.who}.png`; a.href = sheet(); a.click(); }],
  ['Reset all', () => { location.search = ''; }],
]);
sShare.append(json);

// view buttons over the picture
function viewButtons() {
  const v = $('views');
  v.replaceChildren();
  for (const [k, t] of [['full', 'Full body'], ['bust', 'Bust'], ['face', 'Face'], ['close', 'Close-up'], ['far', 'Far away']]) {
    const b = document.createElement('button');
    b.textContent = t;
    b.className = state.view === k ? 'on' : '';
    b.onclick = () => { state.view = k; orbit.zoom = 1; saveURL(); viewButtons(); };
    v.append(b);
  }
  const tt = document.createElement('button');
  tt.textContent = state.turntable ? 'Stop turning' : 'Turntable';
  tt.className = state.turntable ? 'on' : '';
  tt.onclick = () => { state.turntable = !state.turntable; saveURL(); viewButtons(); };
  v.append(tt);
}

// ------------------------------------------------------------------ go
resize();
applyLight();
await rebuild();
await roomsReady;
window.studio = { step, sheet, state: () => state, people: () => people, scene, camera, renderer, post, rebuild, applyLook, applyBody, applyFace, applyLight, updatePanel, set: (s) => { state = cleanState({ ...state, ...s }); saveURL(); updatePanel(); }, NEUTRAL_BODY, cleanMorph, orbit };
requestAnimationFrame((t) => { last = t; frame(t); });
