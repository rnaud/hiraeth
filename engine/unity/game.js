// The game, Unity side (docs/systems/engine-bridge.md): engine/game.js in Puerts' V8, the scene
// mirrored to Unity objects drawn by the C# port's own ink look (its URP renderer feature, its
// Surface shader and materials, HiraethLook), the keys and pads from Unity's Input System.
// BridgeRunner.cs loads this bundle and calls start(args) once and frame(dt) every frame; a batch
// run (BridgeBatch.cs, scripts/unity-export/unity-batch.sh BridgeBatch.Run) passes its plan in args.
import { pads, host, toHost } from './host.js';
import { createGame } from '../game.js';
import { UnityBackend } from './backend.js';
import { portLook } from './port-format.js';
import { fullGcWatch } from './gc-watch.js';
import { panSteps } from './pan.js';
import { installMatrixCache } from '../../src/matrix-cache.js';
import { watchSceneEdits } from '../scene-matrices.js';
import { EngineMenus } from '../menus.js';
import { readHref } from '../trials.js';
import { Controller } from '../../src/controller.js';
import { Settings, SaveGame, TEXT_SIZES } from '../../src/ui.js';
import { slots, DEBUG_SLOT, formatPlaytime } from '../../src/save-slots.js';
import { setRumbleSettings, rumblePlay } from '../../src/rumble.js';
import { game as gameState } from '../../src/game-state.js';
import { seedDebugSave } from '../../src/debug-save.js';
import { levelById } from '../../src/levels/index.js';
import { TITLES } from '../../src/levels/names.js';
import { VERSION } from '../../src/version.js';
import { devMode } from '../../src/dev-gate.js';
import { setEnginePad, setFaces, padFaces, padLabels, promptText } from '../../src/native-pad.js';
import { keyRouter } from '../../src/remap.js';

// The scene's matrices recomposed only where something moved (src/matrix-cache.js, the web game's own, with its walks
// entered below the root forced, reparented objects forced and updateMatrix remembered), for the walk over the whole
// scene (the mirror's updateMatrixWorld: ~4 200 objects a frame at the desert's spawn, ~13 % of them moved).
// tests/pose-exact-web.test.js: every bone the same as three's own walk.
installMatrixCache();
// (and the scene graph's edits counted, so the mirror's flat list of the scene knows when to be made again: engine/scene-matrices.js)
watchSceneEdits();

let S = null;
const now = () => host.Now();
// the sound kept this far ahead of what Unity has played (BridgeAudio.cs's ring): frames
const AUDIO_AHEAD = 0.12;
// a run at fixed views starts from the web bench's save (scripts/bench/web-page.mjs prepareStorage): the backpack found
const BENCH_FLAGS = { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 };

function standardPad(state, id) {
  // (BridgeHost.Pad: "b0,b1,…,b16|a0,a1,a2,a3", the standard mapping's buttons as values, the sticks; its name as the
  // Gamepad's id, which src/native-pad.js reads the printed letters and the prompts' names from)
  const [b, a] = state.split('|');
  const values = b.split(',').map(Number), axes = a.split(',').map(Number);
  return { id: id || 'unity pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, buttons: values.map((v) => ({ pressed: v > 0.5, touched: v > 0, value: v })), axes, vibrationActuator: host.Rumble ? RUMBLE : null };
}
/**
 * The pad's motors as the Gamepad API's (src/rumble.js plays its patterns on it): a pulse is Unity's
 * Gamepad.SetMotorSpeeds for its length (BridgeHost.Rumble: the heavy motor, the light one, ms); where Unity's pad has
 * no motors it does nothing.
 */
const RUMBLE = {
  type: 'dual-rumble', effects: ['dual-rumble'],
  playEffect(kind, o = {}) { host.Rumble(+o.strongMagnitude || 0, +o.weakMagnitude || 0, Math.round(+o.duration || 0)); return Promise.resolve('complete'); },
  reset() { host.Rumble(0, 0, 0); return Promise.resolve('complete'); },
};

/** A run with a plan (the bench's views, a conversation, the tour…): straight into its world, no title, no menus. */
const planned = (a) => !!(a.views?.length || a.talk || a.through != null || a.play || a.walk || a.tour || a.idle || a.aboard || a.fight || a.noTitle || a.trial || a.game);
/** -aboard cockpit,main,cabin,hold: the rooms of the parked ship it photographs, as the web's ?aboard= (main.js). */
const aboardRooms = (a) => String(a.aboard ?? '').split(',').filter(Boolean);

/**
 * The platform's pad (src/native-pad.js setEnginePad): on Android (the Retroid) the handheld's own names, A B X Y as
 * printed, L1 R1, Select Start, and its Nintendo letters moved to positions (Unity reports them by letter, as Android
 * does); on the Xbox, Xbox names; on the Deck's player and a computer, the family of the pad in hand (Steam's: Xbox).
 */
function platformPad() {
  const p = String(host?.Platform?.() ?? '');
  setEnginePad({ layout: p === 'android' ? 'android' : 'standard', family: p === 'xbox' ? 'xbox' : '' });
}
/** A state's text with its prompts in the pad's own names (`remap`: the player's own buttons too; not the menus' own). */
function forPad(json, remap) {
  const L = padLabels();
  return promptText(json, { ...L, remap });
}

export function start(argsJson) {
  const args = JSON.parse(argsJson || '{}');
  platformPad();
  if (planned(args)) { launch(args); return; }
  // played: the title first (engine/menus.js; src/title.js on the web), the world loaded once a save is chosen; a reboot
  // (Quit to title onto another save, Travel here: BridgeRunner.Reboot) comes back with its choice made (`boot`)
  const settings = new Settings();
  // (the Graphics setting as the engine started with it: the saved one, the command line's, or the platform's default,
  // BridgeArgs.Quality; a change applies from the next start. Auto stays Auto: the device's own preset each start)
  if (args.quality && settings.quality !== 'auto') settings.quality = args.quality;
  setFaces(settings.padFaces);
  setRumbleSettings(settings);   // (Settings > Rumble and its strength, src/rumble.js)
  const menus = new EngineMenus({
    store: slots, settings, dev: () => devMode({ settings }), version: `v${VERSION}`,
    onStart: (choice) => begin(choice),
    onResume: () => { S?.game?.applySettings?.(); },
    onQuit: () => { S.game?.save(); menus.show('title'); },
    onPhoto: () => { S?.game?.setPhoto?.(true); },
    onSetting: (k) => {
      setFaces(settings.padFaces); S?.game?.applySettings?.(settings);
      if (k === 'rumble' || k === 'rumbleLevel') rumblePlay('hurt', { h: 0.75 });   // (a taste of the new strength, as the web's page)
    },
    where: () => TITLES[S?.game?.level?.id] ?? '',
    // (the save under the Start menu's heading, as the web's: "Save 1 · The Desert · 12 min played")
    saveLine: () => `${slots.active === DEBUG_SLOT ? 'Debug save' : `Save ${slots.active}`} · ${TITLES[S?.game?.level?.id] ?? ''} · ${formatPlaytime(slots.meta?.()?.playtime ?? 0)} played`,
    // (the menus' canvas, its units: 720 high, as wide as the screen's shape; the title laid out on it)
    screen: () => ({ w: host.MenuWidth?.() || 1280, h: 720 }),
    // (the Items panel's tiles a row: as many of ~128 units as the sheet holds, BridgeMenu's canvas 720 high)
    itemCols: () => Math.max(4, Math.min(12, Math.floor(((host.MenuWidth?.() || 1280) - 72) / 128))),
    // (the room BridgeMenu's sheet has for the Map, its units: "w,h"; the map is drawn as wide as it, issue #272)
    mapBox: () => { const [w, h] = String(host.MenuMapBox?.() ?? '').split(',').map(Number); return w > 0 && h > 0 ? { w, h } : null; },
  });
  S = { args, menus, settings, game: null, frames: 0, plan: null, results: [], keys: new Set(), lastT: 0, audioMs: 0, menuV: -1 };
  // (the pad on the title, before the game and its controller are made: the controller's menu context, as the page's)
  S.titlePad = new Controller({ pads: () => pads, context: () => 'menu', action: (n) => menus.action(n), navigate: (x, y) => menus.navigate(x, y), look() {}, scroll() {}, faces: () => padFaces() });
  if (args.boot) begin(args.boot);
  else menus.show('title');
  showMenu();
}

/**
 * The title's choice: the save made the active slot and read again (the game state was read at import, from the slot
 * last played), or a debug save written at its world (src/debug-save.js); then its world. With a world already loaded:
 * the same save and world resume it, another reboots the engine onto it (the page's fresh page, src/title.js).
 */
function begin(choice) {
  let slot = choice.slot, level = choice.level ?? null, arrive = !!choice.arrive, start = null, prologue = false;
  const via = choice.via ?? null, game = choice.game ?? null;
  if (choice.debug) { seedDebugSave(choice.debug, { slot, state: gameState }); slot = slots.active; level = choice.debug; arrive = true; }
  else {
    slots.setActive(slot);
    slots.touch(slot);
    gameState.reload();
    const saved = choice.fresh ? null : SaveGame.load();
    // (a new save starts in the world the engine was started at: -level, the desert by default, with the opening there,
    // as the web's title opens a new game: the prologue until it has been played, prologue.done; issue #264)
    level ??= saved?.level && levelById(saved.level) ? saved.level : levelById(S.args.level) ? S.args.level : 'desert';
    prologue = !saved && !via && level === 'desert' && !gameState.flag('prologue.done') && S.args.prologue !== false;
    if (game) { arrive = false; prologue = false; }   // (a game's page: its own start; the world's place kept for its Quit)
    else if (!arrive && saved?.level === level) start = saved; else arrive = !prologue;
  }
  if (S.game) {
    if (S.game.level?.id === level && S.slot === slot && !arrive && !prologue && !game && !S.game.trials?.def) { S.menus.close(); return; }
    console.log(`[unity] onto save ${slot}, ${level}: the engine starts again`);
    host.Reboot?.(JSON.stringify({ boot: { slot, level, arrive, via, game, resolved: true } }));
    return;
  }
  S.slot = slot;
  launch({ ...S.args, level }, { start, arrive, via, prologue, game });
}

/**
 * The accessibility settings the HUD honours (src/ui.js applyAccess, the page's --ts and .speech-solid; issue #346): the
 * words' size, the plain solid background behind speech and the hints, the frame readout. BridgeHud reads them with
 * the screen's state.
 */
function access() {
  const s = S?.settings ?? {}, state = { ts: TEXT_SIZES[s.textSize] ?? 1, solid: !!s.speechBg, fps: !!s.showFps };
  return { state, key: `${state.ts}|${state.solid}|${state.fps}` };
}

/** The menu's state to Unity (BridgeMenu.cs) when it changed. */
function showMenu() {
  const m = S?.menus;
  if (!m || m.v === S.menuV) return;
  S.menuV = m.v;
  const v = m.view();
  // (the Map's drawn ground and its sharper part zoomed in, once each: their RGBA to Unity before the state that shows
  // them, BridgeHost.MapImage)
  for (const key of [v?.map?.ground, v?.map?.detail?.key]) {
    if (!key || (S.mapsSent ??= new Set()).has(key)) continue;
    const pic = S.game?.mapPicture?.(key);
    if (pic && host.MapImage) { host.MapImage(key, toHost(pic.data.buffer), pic.width, pic.height); S.mapsSent.add(key); }
  }
  host.Menu?.(forPad(JSON.stringify(v), false));
}

/**
 * A game's sign played (a host's Play: ?game=<id>&from=<world> on the web) and its Quit back (?level=<world>): the engine
 * starts again on the game's page, then on the world at the place saved as you left it (engine/trials.js).
 */
function playGame(href) {
  const { game, from } = readHref(href);
  if (!game) return;
  S.game?.save();
  console.log(`[unity] the game ${game}: the engine starts again on its page`);
  host.Reboot?.(JSON.stringify({ boot: { slot: slots.active, level: from ?? S.game?.level?.id ?? 'desert', game, resolved: true } }));
}
function leaveGame(href) {
  const { level, from } = readHref(href);
  const to = level ?? from ?? S.gameFrom ?? 'desert';
  console.log(`[unity] back from the game to ${to}`);
  // (a plan's game, the bridge's -game: it ends with it)
  if (S.plan) { host.Exit(0); return; }
  host.Reboot?.(JSON.stringify({ boot: { slot: slots.active, level: to, resolved: true } }));
}

/** Another world by the ship (its take-off done, Ship.travel's `go`): the engine starts again at that world's landing, arriving. */
function flyTo(to) {
  S.game?.save();
  console.log(`[unity] the ship flies to ${to}: the engine starts again, arriving by ship`);
  host.Reboot?.(JSON.stringify({ boot: { slot: slots.active, level: to, arrive: true, via: 'ship', resolved: true } }));
}

function launch(args, { start: from = null, arrive = false, via = null, prologue = false, game = null } = {}) {
  const t0 = now();
  const backend = new UnityBackend(host);
  backend.portraitDir = args.out ?? null;
  // (-js-off a,b: the script's own measures turned off for a before-and-after on one build: still, the mirror's still
  // matrices; hidden, the hidden subtrees' matrices; people, the people out of view; shape, the banners' frames moved by vertices();
  // copy, the frame's commands handed over as a fresh ArrayBuffer instead of a view of the writer's (pack.js takeView); BridgeArgs passes it as `off`)
  const off = new Set(String(args.off ?? '').split(',').filter(Boolean));
  if (off.has('still')) backend.stillMatrices = false;
  if (off.has('hidden')) backend.skipHidden = false;
  if (off.has('people')) backend.peopleLod = false;
  if (off.has('shape')) backend.shapeAttrs = null;
  if (off.has('copy')) backend.frameView = false;
  if (off.has('portrait')) backend.portrait = null;   // (portrait: a conversation's chip without its picture, their initial instead)
  // (gestures: the conversations' captured gestures left unloaded, public/anim/gestures.glb, issue #197)
  // (played, the title's state kept: its menus, settings and the save chosen)
  S = { ...(S ?? {}), args, backend, game: null, frames: 0, plan: null, results: [], keys: new Set(), lastT: 0, audioMs: 0, gcs: args.gcs ? fullGcWatch() : null };
  // the sound at Unity's output rate (BridgeAudio: muted in batch runs, where it is only counted)
  const rate = args.sound === false ? 0 : host.AudioRate?.() ?? 0;
  // (rendered on Unity's audio thread where it has one: the graph recorded here, BridgeHost.AudioBatch)
  const record = !!rate && !!host.AudioThreaded?.() && args.audioJs !== true;
  // (-trial <id>, -game <id>: a run's cards want the menus that draw them, on the debug save, the player's own untouched)
  if (!S.menus && (args.trial || args.game)) {
    slots.setActive(DEBUG_SLOT); gameState.reload();
    const settings = new Settings();
    S.settings = settings;
    S.menus = new EngineMenus({ store: slots, settings, version: `v${VERSION}`, screen: () => ({ w: host.MenuWidth?.() || 1280, h: 720 }) });
  }
  const menus = S.menus ?? null;
  game ??= args.game ?? null;
  S.gameFrom = args.level ?? 'desert';
  createGame({ levelId: args.level ?? 'desert', backend, game, from: game ? args.level ?? 'desert' : null, onGame: (href) => playGame(href), onLeave: (href) => leaveGame(href), trials: !!args.trial, quality: args.quality ?? null, people: args.people !== false, audio: rate ? { sampleRate: rate, record } : null, flags: args.views?.length || args.play ? BENCH_FLAGS : null, log: (...a) => console.log('[game]', ...a),
    menus, settings: S.settings ?? null, start: from, arrive: arrive || !!args.arrive, hullSpawn: !!args.hullSpawn, gestures: !off.has('gestures'),
    via, prologue: prologue || !!args.prologue, onTravel: (to) => flyTo(to), aboard: aboardRooms(args)[0] ?? null, scenes: !!args.aboard, fight: !!args.fight })
    .then((game) => {
      S.game = game;
      if (menus) {
        // the game menu's panels from the world now running (engine/game.js menuSources), its Travel here by a reboot
        menus.sources = game.menuSources({ travel: true });
        menus.onTrack = (id) => game.story?.quests?.choose?.(id);
        // (a gun mode taken, a gadget taken in hand, the finder switched: main.js onUse; issue #344)
        menus.onUse = (id) => game.useItem(id);
        menus.onTravel = (id) => {
          const no = game.travelRefusal(id);
          if (no) return no;
          game.save();
          // (the ship's own way, as the web's: its take-off, then the next world's arrival; ship.travel's `go`, flyTo)
          if (game.shipScenes) { menus.close(); game.ship.travel(id); return null; }
          console.log(`[unity] travel to ${id}: the engine starts again at its landing`);
          host.Reboot?.(JSON.stringify({ boot: { slot: slots.active, level: id, arrive: true, resolved: true } }));
          return null;
        };
        if (menus.mode === 'title') menus.close();
        game.save();
        // (-shop <id>: the shop's sheet opened at once, a test of it on a device)
        if (args.shop && !game.openShop(args.shop)) console.log(`[unity] no shop ${args.shop} here`);
      }
      // (-trial <id>: that trial or makers' run of this world on its start card, as its host's Play)
      if (args.trial && !game.trials?.open(args.trial, { grant: true })) console.log(`[unity] no trial ${args.trial} here`);
      if (args.freeze !== undefined) game.mirror.freeze = !!args.freeze;   // (-freeze: still subtrees frozen, mirror-freeze.js; off by default)
      console.log(`[unity] ready in ${(now() - t0).toFixed(0)} ms (in the VM: ${JSON.stringify(game.T)})`);
      if (args.split) {
        // what a call into C# costs, and how fast plain JS runs here (against Node's numbers in the docs)
        const d0 = Date.now(); for (let i = 0; i < 2000; i++) performance.now(); const callUs = (Date.now() - d0) / 2;
        const d1 = Date.now(); let x = 0; for (let i = 0; i < 2e7; i++) x += Math.fround(i * 0.5) % 7; const loopMs = Date.now() - d1;
        console.log(`[unity] a clock read ${callUs} µs; 2e7 fround loop ${loopMs} ms (${x > 0})`);
      }
      S.plan = makePlan(args);
    })
    .catch((e) => { console.error('[unity] the game failed to start', e?.stack ?? e); host.Exit(3); });
}

/**
 * The conversations' gestures timed while a talk is measured (-talk id -bench secs): Animator.layTalk's own ms summed
 * (src/animator.js, src/talk-gesture.js), and how many of its calls laid a gesture; put back as it was after.
 */
function talkClock(game, P) {
  const proto = Object.getPrototypeOf(game.player.animator ?? {});
  const was = proto?.layTalk;
  if (!was) return;
  const T = (P.talkMs = { ms: 0, n: 0, off: () => { proto.layTalk = was; } });
  proto.layTalk = function (dt, s) { const t0 = now(); was.call(this, dt, s); T.ms += now() - t0; if (this.talkW > 0) T.n++; };
}

function makePlan(args) {
  const steps = [];
  for (const v of args.views ?? []) {
    // (and a second and a half of the game's time: what wakes by the traveller's nearness, the answering plants, has woken
    // as on the web bench's view, which waits seconds)
    steps.push({ kind: 'pin', view: v }, { kind: 'wait', frames: 12, secs: args.settle ?? 1.5 });
    if (args.bench) steps.push({ kind: 'measure', view: v, secs: args.bench });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-${v.name}.png` });
    // (-pan N [-pan-step deg]: the distant shimmer's frames, issue #218: the view turned by a fixed step a frame (0.025°, a
    // third of a render pixel on the Retroid at Handheld), a picture of each of N + 1 frames; scripts/bench/unity-shimmer.mjs
    // counts the pixels that flick and come back; -pan-step 0 is the world's own motion; -pan-live no pictures, to watch)
    if (args.pan) steps.push(...panSteps(v, { n: args.pan, stepDeg: args.panStep, out: args.out, live: !!args.panLive }));
  }
  if (args.talk) {
    // walk up to someone (args.talk: their id, or 'any'), press E, and photograph the conversation as it goes
    steps.push({ kind: 'approach', who: args.talk }, { kind: 'wait', frames: 20 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-prompt.png` });
    steps.push({ kind: 'key', code: 'KeyE', down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code: 'KeyE', down: false }, { kind: 'wait', frames: 30 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-talk.png` });
    // (-talk-seq N: N pictures of the first line, one every -talk-every frames (6): the gestures in motion, against the
    // web's frames of the same conversation; -bench secs: the frame measured while they talk, the gestures' own ms in it)
    for (let k = 0; k < (args.talkSeq ?? 0); k++) steps.push({ kind: 'wait', frames: args.talkEvery ?? 6 }, { kind: 'shot', file: `${args.out}/unity-talk-seq-${String(k).padStart(2, '0')}.png` });
    if (args.bench) steps.push({ kind: 'measure', view: { name: 'talk' }, secs: args.bench, talk: true });
    steps.push({ kind: 'wait', frames: 240 });
    for (let k = 0; k < 3; k++) {
      steps.push({ kind: 'key', code: 'Space', down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code: 'Space', down: false }, { kind: 'wait', frames: 240 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-talk-${k + 2}.png` });
    }
  }
  if (args.through != null) {
    // (-through id: a way through walked into, src/passage.js: a portal by its label's words or its index in level.portals,
    // the paper photographed as it sweeps, the room on the far side, then the way back out of it; issue #264)
    steps.push({ kind: 'wait', frames: 30 }, { kind: 'through', which: args.through }, { kind: 'key', code: 'KeyW', down: true });
    for (let k = 0; k < 8; k++) steps.push({ kind: 'wait', frames: 3 }, ...(args.out ? [{ kind: 'shot', file: `${args.out}/unity-through-${k}.png` }] : []));
    // (the room and the way back once the paper has gone: by the game's clock, a batch's frames being quick ones)
    steps.push({ kind: 'key', code: 'KeyW', down: false }, { kind: 'wait', frames: 60, secs: 1.6 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-through-room.png` });
    steps.push({ kind: 'wait', frames: 45, secs: 1.5 }, { kind: 'through', back: true }, { kind: 'wait', frames: 70, secs: 2 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-through-back.png` });
  }
  if (args.play) {
    // the fluid tool (aim with R, fire with G: a shot and its splat) and the drone (Q), photographed as they go
    steps.push({ kind: 'wait', frames: 40 });
    if (args.play.includes('tool')) {
      steps.push({ kind: 'key', code: 'KeyR', down: true }, { kind: 'wait', frames: 25 }, { kind: 'key', code: 'KeyG', down: true }, { kind: 'wait', frames: 3 }, { kind: 'key', code: 'KeyG', down: false }, { kind: 'wait', frames: 10 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-tool.png` });
      steps.push({ kind: 'wait', frames: 45 }, { kind: 'key', code: 'KeyR', down: false }, { kind: 'wait', frames: 20 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-splat.png` });
    }
    if (args.play.includes('cab')) {
      // the traveller seated in the market's parked cab (src/taxi.js), the ride camera on him
      steps.push({ kind: 'cab' }, { kind: 'wait', frames: 90 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-cab.png` });
      // and close, from beside him (the web's side: the same place from the traveller, scratch views)
      steps.push({ kind: 'cabClose' }, { kind: 'wait', frames: 6 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-cabclose.png` });
    }
    if (args.play.includes('drone')) {
      steps.push({ kind: 'key', code: 'KeyQ', down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code: 'KeyQ', down: false }, { kind: 'wait', frames: 75 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-drone.png` });
    }
  }
  if (args.warp) {
    // (-warp <title>: the take-off's warp over the view without flying, the ship's own Warp started (screen 'warp',
    // BridgeHud.cs DrawWarp: issue #264), pictured as the disc opens, once open, and with the streaks at speed)
    steps.push({ kind: 'warp', title: String(args.warp) });
    for (const [secs, n] of [[0.25, 1], [0.45, 2], [0.8, 3]]) {
      steps.push({ kind: 'wait', frames: 2, secs });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-warp-${n}.png` });
    }
  }
  // (-aboard: each room of the parked ship, the traveller where ?aboard= puts him on the web, the camera behind him; its
  // ship attached, scenes: the hull hidden from the sun inside, as the web's; tests/engine-ship.test.js)
  for (const room of aboardRooms(args)) {
    steps.push({ kind: 'aboard', room }, { kind: 'wait', frames: 90, secs: 3 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-aboard-${room}.png` });
    // (at the console: E, the voicemail's message or "No new messages.", photographed as it plays)
    if (room === 'console') {
      steps.push({ kind: 'key', code: 'KeyE', down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code: 'KeyE', down: false }, { kind: 'wait', frames: 45, secs: 1.5 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-aboard-console-e.png` });
    }
  }
  // (-fight foe,down,guardian: the fight photographed, engine/combat.js: a blot set down ahead of him, locked on (Tab), a
  // cut (F); low on hearts, then knocked out and up again; the level's guardian woken in its arena and locked on, its
  // framing; tests/engine-combat.test.js)
  const fights = String(args.fight ?? '').split(',').filter(Boolean);
  if (fights.includes('foe')) {
    steps.push({ kind: 'wait', frames: 60, secs: 2 }, { kind: 'foe', what: 'blot' }, { kind: 'wait', frames: 30, secs: 1 },
      { kind: 'key', code: 'Tab', down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code: 'Tab', down: false }, { kind: 'wait', frames: 40, secs: 1.2 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-fight-lock.png` });
    steps.push({ kind: 'key', code: 'KeyF', down: true }, { kind: 'wait', frames: 3 }, { kind: 'key', code: 'KeyF', down: false }, { kind: 'wait', frames: 8 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-fight-cut.png` });
    steps.push({ kind: 'wait', frames: 60, secs: 2 });
  }
  if (fights.includes('down')) {
    // (at a quarter of a heart: the edges' heartbeat; then knocked out: the card)
    steps.push({ kind: 'foe', what: 'low' }, { kind: 'wait', frames: 20, secs: 0.4 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-fight-low.png` });
    steps.push({ kind: 'wait', frames: 60, secs: 1.6 }, { kind: 'foe', what: 'out' }, { kind: 'wait', frames: 120, secs: 2.5 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-fight-out.png` });
    steps.push({ kind: 'key', code: 'Enter', down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code: 'Enter', down: false }, { kind: 'wait', frames: 30 });
  }
  if (fights.includes('guardian')) {
    steps.push({ kind: 'foe', what: 'guardian' }, { kind: 'wait', frames: 240, secs: 6 },
      { kind: 'key', code: 'Tab', down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code: 'Tab', down: false }, { kind: 'wait', frames: 60, secs: 1.5 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-fight-guardian.png` });
  }
  if (args.trial || args.game) {
    // a run's cards and HUD photographed (-trial <id> in its world, -game <id> on its page): the start card, Start (Enter),
    // the 3-2-1, the run a while (the stick forward), the pause (Esc), Resume, then the run left (Esc on the pause, Quit)
    const shot = (name) => (args.out ? [{ kind: 'shot', file: `${args.out}/unity-${name}.png` }] : []);
    const tap = (code, frames = 3) => [{ kind: 'key', code, down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code, down: false }, { kind: 'wait', frames }];
    steps.push({ kind: 'wait', frames: 60, secs: 2 }, ...shot('card'), ...tap('Enter', 20), { kind: 'say', text: '[unity] run: counting' }, ...shot('count'),
      { kind: 'wait', frames: 60, secs: 2.6 }, { kind: 'key', code: 'KeyW', down: true }, { kind: 'wait', frames: 60, secs: args.runSecs ?? 3 }, ...shot('run'),
      { kind: 'key', code: 'KeyW', down: false }, ...tap('Escape', 10), ...shot('pause'), { kind: 'say', text: '[unity] run: paused' }, ...tap('Enter', 30), ...shot('resumed'));
  }
  if (args.walk) {
    steps.push({ kind: 'key', code: 'KeyW', down: true }, { kind: 'measure', view: { name: 'walk' }, secs: args.walk }, { kind: 'key', code: 'KeyW', down: false });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-walk.png` });
  }
  if (args.tour) {
    // a fixed little tour for side-by-side pictures (the Xbox's shadow settings: -tour, LocalState\args.txt): still at
    // the spawn, a walk forward, a quarter turn, each followed by a hold the pictures are taken in ("[unity] tour: …")
    const say = (what) => ({ kind: 'say', text: `[unity] tour: ${what}` });
    steps.push({ kind: 'wait', frames: 240, secs: 6 }, say('still'), { kind: 'wait', frames: 360, secs: 6 },
      say('walking'), { kind: 'key', code: 'KeyW', down: true }, { kind: 'wait', frames: 150, secs: 2.5 }, say('walking, mid-step'), { kind: 'wait', frames: 60, secs: 1 }, { kind: 'key', code: 'KeyW', down: false },
      say('walked'), { kind: 'wait', frames: 360, secs: 6 },
      say('turning'), { kind: 'turn', frames: 90, dx: 8 }, say('turned'), { kind: 'wait', frames: 360, secs: 6 }, say('done'), { kind: 'hold' });
  }
  if (args.idle) {
    // the spawn as it is, measured once the load's tail is over (-idle N -split: the Xbox's frame taken apart, with
    // no command line there: LocalState\args.txt); the game goes on after it, nothing pinned, nothing pressed. The spawn
    // is the level's, clear of the ship (Ship.clearSpawn: the desert's at the foot of the ramp); -hull-spawn the spot
    // under the ramp the plans started on before (issue #265), to compare with the numbers taken there
    // (docs/systems/performance.md, "The bench's desert start")
    steps.push({ kind: 'wait', frames: 120, secs: 3 }, { kind: 'measure', view: { name: 'spawn' }, secs: args.idle }, { kind: 'hold' });
  }
  if (!steps.length) return null;
  if (!args.idle && !args.tour) steps.push({ kind: 'done' });
  return { steps, i: 0, wait: 0, t: 0, samples: null };
}

/**
 * A view aimed at someone (view.npc: their id, or 'traveller'; the side-by-sides' close-ups): the eye `dist` m off
 * their front, a little to the side, looking at their chest (view.face: at their head, from its height), wherever
 * they have walked to by now; view.expression (an expression.js expression: smile, open, brow, browTilt, squint)
 * put on their face. Other views as they are. (scratchpad webshots.mjs does the same on the web.)
 */
function aimed(game, v) {
  if (v?.temple !== undefined) {
    // a temple's first room (view.temple: its index in level.temples): the traveller where you come in, the camera behind him
    const T = game.level.temples?.[v.temple], a = T?.arrival;
    if (!a?.pos) { console.log(`[unity] no temple ${v.temple} here`); return v; }
    const p = a.pos, h = a.heading ?? 0, fx = Math.sin(h), fz = Math.cos(h);
    return { ...v, player: [p.x, p.y, p.z], heading: h, eye: [p.x - fx * 5, p.y + 2.6, p.z - fz * 5], target: [p.x + fx * 4, p.y + 1.2, p.z + fz * 4], fov: v.fov ?? 55 };
  }
  if (!v?.npc) return v;
  const trav = v.npc === 'traveller';
  const n = trav ? { pos: game.player.pos, heading: game.player.heading, object: game.player.object, humanoid: game.player.humanoid } : game.npcs.find((x) => x.def?.id === v.npc);
  if (!n) { console.log(`[unity] no ${v.npc} here`); return v; }
  if (v.expression && n.humanoid?.setExpression) n.humanoid.setExpression(v.expression);
  const p = n.pos, h = n.heading ?? 0, d = v.dist ?? 2.8, side = v.side ?? 0.6;
  // (where they face: their object's +z (npc.js turns it by the heading), whatever the heading says by now)
  const e = n.object?.matrixWorld?.elements, fl = e ? Math.hypot(e[8], e[10]) : 0, sg = 1;
  const fx = fl > 1e-6 ? sg * e[8] / fl : Math.sin(h), fz = fl > 1e-6 ? sg * e[10] / fl : Math.cos(h);
  const head = v.face ? n.humanoid?.b?.Head?.getWorldPosition?.(p.clone()) : null;
  const t = head ? [head.x, head.y + 0.05, head.z] : [p.x, p.y + (v.face ? 1.6 : 1.1), p.z];
  const eyeY = (v.face ? t[1] : p.y + 1.5) + (v.dy ?? 0);
  return { ...v, player: null, hidePlayer: !trav, eye: [t[0] + fx * d + fz * side, eyeY, t[2] + fz * d - fx * side], target: t, fov: v.fov ?? 45 };
}

/**
 * This frame's keys from Unity (BridgeHost.Keys: the KeyboardEvent codes held) as the page's keydown / keyup, each new
 * press and release first through the player's keys (Controls, "Your keys": src/remap.js keyRouter, as the page's
 * installKeyRemap; a key the page waits for goes to it alone), then as before with the default codes they send.
 */
const keyRoute = keyRouter();
function keyChanges(held) {
  const out = [];
  const add = (k, down) => { if (!keyRoute.take(k, down)) for (const e of keyRoute.route(k, down) ?? [[k, down]]) out.push(e); };
  for (const k of held) if (!S.keys.has(k)) add(k, true);
  for (const k of S.keys) if (!held.has(k)) add(k, false);
  S.keys = held;
  return out;
}
function readInput(game) {
  const held = new Set((host.Keys() || '').split(',').filter(Boolean));
  const menus = S.menus;
  // (the player went away, BridgeRunner.Away: the Steam button, a suspend, the home button. Back, the game waits under the
  // Start menu, saved, as Menu would leave it; the sound was silenced by Unity meanwhile)
  const away = host.AwayCount?.() ?? 0;
  if (away !== (S.away ??= away)) {
    S.away = away;
    if (menus && !menus.open) { if (game.photoOn) game.setPhoto?.(false); game.save(); menus.show('start'); }
  }
  for (const [k, down] of keyChanges(held)) {
    if (!down) { game.key(k, false); continue; }
    // a menu open: its keys (engine/menus.js key); in play Esc opens the Start menu (not over a conversation, which it
    // closes) and J the game menu, as the page's listeners do
    if (menus?.open) { menus.key(k); continue; }
    // (Esc held in a ship's scene skips it, skips a box's opening, and leaves photo mode: the game's own)
    // (a run under way: Esc is its pause, J nothing, the runner's keys: src/minigames/kit/runner.js key)
    if (menus && k === 'Escape' && !game.story?.dialogue?.open && !game.photoOn && !game.scenePlaying && !game.boxPlaying && !game.minigameOn) { game.save(); menus.show('start'); continue; }
    if (menus && k === 'KeyJ' && !game.minigameOn) { menus.show('game'); continue; }
    game.key(k, true);
  }
  readPad();
  const look = host.MouseLook();   // (the right button held: "dx,dy" pixels)
  if (look && !menus?.open) { const [dx, dy] = look.split(',').map(Number); if (dx || dy) game.look(dx, dy); }
}
function readPad() {
  const pad = host.Pad();
  pads.length = 0;
  if (pad) pads.push(standardPad(pad, host.PadName?.() ?? ''));
}

/** The title's input before a world is loaded: its keys, and the pad through the controller's menu context. */
function readTitleInput(dt) {
  for (const [k, down] of keyChanges(new Set((host.Keys() || '').split(',').filter(Boolean)))) if (down) S.menus.key(k);
  readPad();
  S.titlePad.update(Math.min(dt, 0.1), true);
}

/** The sound's next PCM to Unity: what keeps its ring AUDIO_AHEAD seconds ahead (whole 128-frame blocks). */
function pumpAudio(game) {
  const ctx = game.audio;
  if (!ctx) return;
  const t0 = now();
  const want = Math.floor(ctx.sampleRate * AUDIO_AHEAD) - host.AudioQueued();
  if (ctx._rec) {
    // recorded: the frame's ops and the blocks to render after them, to the audio thread; the sources it ended back
    const blocks = want >= 128 ? Math.floor(want / 128) : 0;
    const ops = ctx.takeOps(blocks);
    if (blocks > 0 || ops.length > 2) host.AudioBatch(toHost(ops.buffer));
    const ended = host.AudioEndedTake();
    if (ended) ctx.ended(ended.split(',').map(Number));
    S.audioMs += now() - t0;
    return;
  }
  if (want >= 128) {
    const pcm = ctx.render(want);
    if (pcm.length) host.Audio(toHost(pcm.buffer));
  }
  S.audioMs += now() - t0;
}

export function frame(dt) {
  S?.menus?.tick?.();   // (a rebinding on the Controls page left waiting: kept as it was, engine/menus.js)
  // the title, before a world: only its menu (the world loading behind it once chosen)
  if (S?.menus && !S.game) { if (!S.menus.title.starting) readTitleInput(dt); showMenu(); return; }
  if (!S?.game) return;
  const { game, backend } = S;
  const tA = now();
  if (!S.plan) readInput(game);
  const r = game.frame(dt);
  showMenu();
  backend.lights(game.localLights());
  const tL = now();
  // (the look moves with the hour and the place: read every 4th frame is enough)
  if (S.frames % 4 === 0) backend.look(JSON.stringify(portLook(game.fullLook())));
  S.lookMs = (S.lookMs ?? 0) + now() - tL;
  // the HUD's state when it changed (src/platform.js screen: BridgeHud draws it in uGUI)
  const scr = game.screen(), acc = access();
  if (scr.version !== S.screenV || acc.key !== S.accessKey) { S.screenV = scr.version; S.accessKey = acc.key; host.Screen(forPad(JSON.stringify({ ...scr.state, access: acc.state }), true)); }
  pumpAudio(game);
  const tB = now();
  const lastT = S.lastT; S.lastT = tA;
  S.frames++;
  // (-v8-gcs: each of V8's full collections said with its frame, beside the late frames in unity.log; gc-watch.js)
  if (S.gcs) { const f = S.gcs.check(); if (f) console.log(`[unity] V8 full GC ${S.gcs.count} at frame ${S.frames}, ${f} frames after the last`); }
  const P = S.plan;
  if (!P) return;
  const step = P.steps[P.i];
  if (!step || step.kind === 'hold') return;
  const next = () => { P.i++; P.wait = 0; P.t = 0; };
  if (step.kind === 'pin') { game.pin(aimed(game, step.view)); next(); }
  else if (step.kind === 'key') {
    // (a menu open, a run's card: its keys, as the player's arrive, readInput)
    if (S.menus?.open) { if (step.down) S.menus.key(step.code); } else game.key(step.code, step.down);
    next();
  }
  else if (step.kind === 'say') { console.log(step.text); next(); }
  else if (step.kind === 'warp') { game.ship?.warp?.start(step.title); next(); }
  else if (step.kind === 'foe') {
    const F = game.foes;
    if (!F) console.log('[unity] no foes here');
    else if (step.what === 'low') { game.player.hearts = 0.5; game.player.hurt?.(0.25, 'foe'); console.log(`[unity] hearts ${game.player.hearts}`); }
    else if (step.what === 'out') { game.player.hurt?.(1, 'foe'); console.log(`[unity] knocked out: ${!!game.player.dead}`); }
    else if (step.what === 'guardian') {
      // (into the arena of the level's temple guardian, two thirds of the way out from its middle: it wakes)
      const T = (game.level.temples ?? []).find((t) => t.guardian), G = T?.guardian;
      if (!G) console.log('[unity] no guardian here');
      else {
        const c = G.arena.center, V = c.constructor, at = c.clone().add(new V(0, 0.5, G.arena.r * 0.6));
        game.player.teleport(at, new V(0, 1, 0), new V(0, 0, 1));
        game.player.heading = Math.atan2(c.x - at.x, c.z - at.z); game.rig.yaw = game.player.heading + Math.PI;
        console.log(`[unity] in ${T.id}'s arena (${G.state})`);
      }
    } else { const got = F.spawnKind(step.what, { n: 1, dist: 5 }); console.log(`[unity] a ${step.what} set down: ${got.length}`); }
    next();
  }
  else if (step.kind === 'aboard') { console.log(game.goAboard(step.room) ? `[unity] aboard: ${step.room}` : `[unity] no room ${step.room} aboard`); next(); }
  else if (step.kind === 'turn') { game.look(step.dx, 0); if (++P.wait >= step.frames) next(); }
  else if (step.kind === 'approach') {
    const people = game.npcs.filter((n) => n.def && !n.pooled);
    const n = people.find((x) => x.def.id === step.who) ?? people[0];
    if (n) {
      const V = n.pos.constructor, dir = new V(Math.sin(n.heading ?? 0), 0, Math.cos(n.heading ?? 0));
      const p = n.pos.clone().addScaledVector(dir, 1.6);
      game.player.teleport(p, new V(0, 1, 0), new V(0, 0, 1));
      game.player.heading = Math.atan2(n.pos.x - p.x, n.pos.z - p.z);
      game.rig.yaw = game.player.heading + Math.PI;
      console.log(`[unity] beside ${n.def.id}`);
    }
    next();
  }
  else if (step.kind === 'through') {
    const P2 = game.level.portals ?? [], open = (q) => !q.when || q.when();
    const w = step.which, pt = step.back
      ? P2.find((q) => q !== S.through && open(q) && q.at.distanceTo(S.through.to) < 40 && q.to.distanceTo(S.through.at) < 40)
      : (/^\d+$/.test(String(w)) ? P2[+w] : P2.find((q) => open(q) && String(q.label ?? '').includes(String(w))));
    if (pt) {
      if (!step.back) S.through = pt;
      const V = pt.at.constructor;
      game.player.teleport(pt.at.clone(), new V(0, 1, 0), new V(0, 0, 1));
      console.log(`[unity] into the way through "${pt.label ?? '?'}" (${P2.indexOf(pt)} of ${P2.length})`);
    } else console.log(`[unity] no way through ${step.back ? 'back' : w}: ${P2.map((q) => q.label).join(', ')}`);
    next();
  }
  else if (step.kind === 'cab') {
    const v = game.player.vehicles.find((x) => x.kind === 'taxi' || x.constructor?.name === 'Taxi') ?? game.player.vehicles[0];
    game.pin(null);   // (the camera back on the rig: the ride camera)
    if (v) { game.player.mount_(v); console.log(`[unity] seated in the ${v.kind ?? 'vehicle'}`); } else console.log('[unity] no vehicle here');
    next();
  }
  else if (step.kind === 'cabClose') {
    const p = game.player.pos;
    game.pin({ eye: [p.x + 2.6, p.y + 1.9, p.z + 2.6], target: [p.x, p.y + 0.9, p.z], fov: 50, hidePlayer: false });
    next();
  }
  else if (step.kind === 'wait') { P.t += Math.min(dt, 0.05); if (++P.wait >= step.frames && P.t >= (step.secs ?? 0)) next(); }
  else if (step.kind === 'measure') {
    if (!P.samples && step.talk) talkClock(game, P);
    if (!P.samples) { game.mirror.profiling = !!S.args.split; game.sectionsOn = !!S.args.split; game.sections?.(); game.mirror.profile(); backend.stats.hostMs = 0; host.ApplyMs(); host.ClothMs?.(); host.CapeMs?.(); host.WaitMs?.(); host.GpuSplit?.(); S.audioMs = 0; P.n0 = backend.stats.frames; S.lookMs = 0; S.looks = backend.stats.looks ?? 0; }
    P.samples ??= [];
    P.samples.push({ dt: lastT ? tA - lastT : dt * 1000, vm: tB - tA, update: r.ms.update, mirror: r.ms.mirror, cpu: host.LastFrameCpuMs(), gpu: host.LastFrameGpuMs(), moved: r.stats.moved });
    P.t += Math.min(dt, 0.1);   // (a load's long first frame counts as one)
    if (P.t >= step.secs) {
      const s = P.samples.slice(5);
      const q = (k, f) => { const a = s.map((x) => x[k]).sort((x, y) => x - y); return a.length ? +a[Math.floor(a.length * f)].toFixed(2) : 0; };
      const nf = Math.max(backend.stats.frames - P.n0, 1);
      const split = { ...game.mirror.profile(), audio: +(S.audioMs / nf).toFixed(3), host: +(backend.stats.hostMs / nf).toFixed(3), apply: +(host.ApplyMs() / nf).toFixed(3), look: +(S.lookMs / nf).toFixed(3), lookSent: (backend.stats.looks ?? 0) - S.looks, clothWait: +((host.ClothMs?.() ?? 0) / nf).toFixed(3), capeWait: +((host.CapeMs?.() ?? 0) / nf).toFixed(3), mainWait: +((host.WaitMs?.() ?? 0) / nf).toFixed(3), threaded: !!host.Threaded?.() };   // (clothWait: the main thread waiting on the overshirt's job, BridgeCloth; capeWait: on the capes' jobs and their meshes)
      if (S.args.split && game.sections) split.update = game.sections();
      if (S.args.split && host.GpuSplit) { try { split.gpu = JSON.parse(host.GpuSplit()); } catch { /* none */ } }
      // (the hitches: frames over twice the median, how many and how the script's time and the main thread's wait went then)
      const med = q('dt', 0.5), hit = s.filter((x) => x.dt > 2 * med);
      const hitches = { n: hit.length, vm: hit.length ? +(hit.reduce((a, x) => a + x.vm, 0) / hit.length).toFixed(2) : 0, every: hit.length > 1 ? +((s.indexOf(hit[hit.length - 1]) - s.indexOf(hit[0])) / (hit.length - 1)).toFixed(1) : 0 };
      if (P.talkMs) { split.talkGestures = +(P.talkMs.ms / nf).toFixed(3); split.talking = P.talkMs.n; P.talkMs.off(); P.talkMs = null; }
      const res = { split, view: step.view.name, frames: s.length, frame: q('dt', 0.5), frameP95: q('dt', 0.95), frameP99: q('dt', 0.99), hitches, vm: q('vm', 0.5), update: q('update', 0.5), mirror: q('mirror', 0.5), cpu: q('cpu', 0.5), gpu: q('gpu', 0.5), moved: q('moved', 0.5), drawn: r.stats.drawn, commandBytes: backend.stats.commandBytes, opWords: backend.stats.opWords, visited: r.stats.visited };
      S.results.push(res);
      console.log(`[bench] ${JSON.stringify(res)}`);
      P.samples = null;
      next();
    }
  } else if (step.kind === 'shot') {
    if (++P.wait < 3) return;   // (a frame for the pin to land, one for the shadows)
    host.Shot(step.file);
    console.log(`[unity] saved ${step.file}`);
    next();
  } else if (step.kind === 'done') {
    if (S.args.out && S.results.length) host.WriteText(`${S.args.out}/unity-bench.json`, JSON.stringify({ engine: 'unity', results: S.results, backend: backend.stats }, null, 1));
    console.log(`[unity] done after ${S.frames} frames; ${JSON.stringify(backend.stats)}`);
    host.Exit(0);
  }
}
