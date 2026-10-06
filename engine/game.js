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
// Left out for now (the page's, or not drawn by the engines yet): the HUD and menus, the story's
// conversations, sound, the fluid tool, the drone, weather, wildlife, the grass blades.
import { page } from './boot.js';
import * as THREE from 'three';
import { levelById } from '../src/levels/index.js';
import { CONTENT } from '../src/levels/content.js';
import { Physics } from '../src/physics.js';
import { Waters } from '../src/water.js';
import { Ship } from '../src/ship/ship.js';
import { buildFlora, floraKeep } from '../src/flora.js';
import { Player, CameraRig } from '../src/player.js';
import { Controller, mergeControls } from '../src/controller.js';
import { loadAnimationLibrary, Animator } from '../src/animator.js';
import { loadHuman, Humanoid } from '../src/humanoid.js';
import { spawnNPCs, pooledNPC } from '../src/npc.js';
import { Crowd, CROWD_BUDGET, buildPeople } from '../src/crowd.js';
import { createStory } from '../src/story/index.js';
import { game as gameState } from '../src/game-state.js';
import { markHero, sharedUniforms } from '../src/materials.js';
import { createPost, PRESETS } from '../src/post.js';
import { applyTimeOfDay, colourScript } from '../src/timeofday.js';
import { EDGE_HINTS } from '../src/edge.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SceneMirror } from './mirror.js';
import { screen } from '../src/platform.js';
import { cueText, Cue, PlaceName, Fader, healthHud, staminaHud } from '../src/hud.js';
import { toastSeconds } from '../src/quest.js';
import { selfLitSkips } from '../src/shadows.js';
import { plainValue } from './ink-spec.js';

export { page };
export { Raycaster } from 'three';   // (for the tests and the tools that probe the world in the VM)

const quiet = (fn) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; console.info = i; } };

/** The look the engines draw with, from post.js's uniforms and the shared ones: plain numbers. */
export const LOOK_KEYS = ['uSkyTop', 'uSkyHorizon', 'uInk', 'uShadowTint', 'uLightTint', 'uToon', 'uHatch', 'uHatchSpacing', 'uFogDensity', 'uFogStart', 'uFogMul',
  'uLineWidth', 'uLineVary', 'uDepthThresh', 'uNormalThresh', 'uAlbedoEdges', 'uShadowEdges', 'uWobble', 'uHaze', 'uAerial', 'uSkyFlat', 'uSkyBands', 'uHazeBands',
  'uHalftone', 'uBounce', 'uShadeKeep', 'uFlatten', 'uNight', 'uSunDisc', 'uPaper', 'uGrain', 'uSkyDots', 'uCrevice', 'uAO', 'uEnvGround',
  'uSunColor', 'uMoonDisc', 'uMoonVis'];

export async function createGame({ levelId = 'desert', backend, width = 1280, height = 720, people = true, view = null, log = () => {} } = {}) {
  const T = {};
  const t0 = performance.now();
  const stamp = (k) => { T[k] = Math.round(performance.now() - t0); };
  const meta = levelById(levelId);
  if (!meta) throw new Error(`no level ${levelId}`);
  const content = CONTENT[levelId];
  // start the loads the way main.js does: the clips, the traveller, the bodies
  const animLib = loadAnimationLibrary().catch((e) => { log('animation library failed', e); return null; });
  const travellerP = new GLTFLoader().loadAsync('anim/traveller.glb').then((g) => g.scene).catch(() => null);
  const humansP = Promise.all([loadHuman('m'), loadHuman('f')]).catch((e) => { log('human models failed', e); return null; });

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
  const humans = await humansP;
  const travellerTemplate = await travellerP;
  if (humans && travellerTemplate) player.humanoid = new Humanoid(humans[0], player.char, 'm', { outfit: travellerTemplate });
  player.attach(scene);
  const heroMaterials = markHero(player.char.root);
  markHero(player.gear?.device, heroMaterials);
  markHero(player.cape?.mesh, heroMaterials);
  if (player.mount) scene.add(player.mount.object);
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
    const clear = content.npcs.map((s) => ({ x: s.at[0], y: s.y, z: s.at[1], r: 3 }));
    quiet(() => {
      const built = buildPeople(physics, spots, { seed: 11, clear });
      const pooled = Array.from({ length: CROWD_BUDGET.pool }, (_, i) => pooledNPC(scene, physics, { kind: i % 2 ? 'f' : 'm', lib, humans }));
      crowd = new Crowd(scene, physics, { spots, built, pooled, clear, makeNPC: (kind) => pooledNPC(scene, physics, { kind, lib, humans }) });
    });
    if (crowd) npcs.push(...crowd.npcs);
  }
  // the story's people and places (story/index.js), as the exporter builds it (build-world.mjs): its
  // conversations and pages are the page's, so they are left out; its people stand and move
  // the toasts, one at a time for their reading time (as ship/cinema.js shows them on the page)
  const toasts = { queue: [], left: 0 };
  const toast = (text) => { if (text && toasts.queue.at(-1) !== text) toasts.queue.push(String(text)); };
  player.onNotice = toast;
  let story = null;
  if (people && humans && lib) {
    const journal = { sections: [], el: { addEventListener() {} }, seen: () => false, storyDone: () => false, markSeen() {}, relicCount: () => 0, render() {} };
    const sound = new Proxy({}, { get: (t, k) => (k === 'ctx' ? null : k === 'band' ? () => null : () => {}) });
    try {
      gameState.data.flags['prologue.done'] = true;
      story = quiet(() => createStory({ levelId, scene, physics, level, player, npcs, crowd, sound, journal, story: { complete() {}, start() {}, done: false, waitFor: null },
        capture: null, lib, humans, toast, tool: null, isNight: () => false, ship, drone: () => null }));
    } catch (e) { log('the story failed to start', e?.message ?? e); }
  }
  stamp('people');
  const flora = quiet(() => buildFlora({ scene, level, levelId, physics, keep: floraKeep({ level, content, ship, npcs }) }));
  if (flora?.noShadow) (level.noShadow ??= []).push(...flora.noShadow);
  stamp('flora');

  // the camera rig, on the page's stand-in canvas
  const rig = new CameraRig(camera, document.createElement('canvas'), physics);
  rig.yaw = level.camYaw ?? (player.heading + Math.PI);
  rig.pitch = level.camPitch ?? rig.pitch;
  rig.constrain = level.constrainCamera;

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
  let eWasDown = false;
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
  let simT = 0, frames = 0;
  // a fixed view (the side-by-sides and the benchmark's viewpoints): the camera pinned there
  let pinned = view ? pin(view) : null;
  function pin(v) {
    const eye = new THREE.Vector3(...v.eye), target = new THREE.Vector3(...v.target);
    // the traveller where the view says (scripts/bench/web-page.mjs __benchPlace does the same on the web)
    if (v.player) { player.teleport(new THREE.Vector3(...v.player), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); player.heading = v.heading ?? player.heading; }
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, target, new THREE.Vector3(0, 1, 0)));
    return { eye, q, fov: v.fov ?? 55, hidePlayer: !!v.hidePlayer };
  }
  // the first frame's camera
  rig.update(player.pos, 0, player.frame);

  const lookOut = {};
  const game = {
    scene, camera, player, rig, level, physics, npcs, crowd, story, ship, mirror, sky, post, T,
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
      const nums = (o) => { const out = {}; for (const [k, x] of Object.entries(o)) if (typeof x?.value === 'number') out[k] = x.value; return out; };
      return { ...this.lookParams(), post: nums(U), shared: nums(sharedUniforms), preset: presetName, planets: level.sky?.planets ?? [] };
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
      hud(dt, busy);
      level.update?.(dt, simT, { player, rig, camera, passage: null, fade: () => {} });
      // (the ship stands at its site: its scenes, inside and its console want the story's journal and the page: ship.attach)
      const tB = performance.now();
      const stats = mirror.sync(scene, camera);
      const tC = performance.now();
      return { ms: { update: tB - tA, mirror: tC - tB }, stats, frames };
    },
  };
  stamp('ready');
  log(`built ${levelId}: ${JSON.stringify(T)} ms`);
  return game;
}
