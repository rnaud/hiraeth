// The game, Unity side (docs/systems/engine-bridge.md): engine/game.js in Puerts' V8, the scene
// mirrored to Unity objects drawn by the C# port's own ink look (its URP renderer feature, its
// Surface shader and materials, HiraethLook), the keys and pads from Unity's Input System.
// BridgeRunner.cs loads this bundle and calls start(args) once and frame(dt) every frame; a batch
// run (BridgeBatch.cs, scripts/unity-export/unity-batch.sh BridgeBatch.Run) passes its plan in args.
import { pads, host, toHost } from './host.js';
import { trackSession } from '../../src/analytics/session.js';
import { unityTransport } from '../../src/analytics/unity.js';
// (the mirror's change notices, before anything is made: engine/mirror-notices.js, issue #455)
import './notices-on.js';
import { createGame, makeSound } from '../game.js';
import { page } from '../boot.js';
import { setAudioDecoder } from '../webaudio.js';
import { musicDecoder, pollMusic, themeArrival, themeDownloads } from './music.js';
import { SOUNDTRACKS, setThemeWait } from '../../src/soundtracks.js';
import { UnityBackend } from './backend.js';
import { loadShare, LOAD_WHY } from '../../src/load-page.js';
import { portLook } from './port-format.js';
import { sharedUniforms } from '../../src/materials.js';
import { fullGcWatch } from './gc-watch.js';
import { StutterLog, stutterState } from '../stutter.js';
import { routeById } from '../stutter-routes.js';
import { panSteps } from './pan.js';
import { WorldLabels } from '../../src/minigames/kit/labels.js';
import * as THREE from 'three';
import { installMatrixCache } from '../../src/matrix-cache.js';
import { watchSceneEdits } from '../scene-matrices.js';
import { EngineMenus, itemColsFor } from '../menus.js';
import { UnityUpdates } from './updates.js';
import { STARMAP_SCENES, STARMAP_BASE, poseStarMap } from '../starmap.js';
import { sequenceById, SequenceRun, engineSetup, engineReady, engineGame, engineKey, probe, engineGameArg } from '../sequences.js';
import { readHref } from '../trials.js';
import { Controller } from '../../src/controller.js';
import { Settings, SaveGame, TEXT_SIZES } from '../../src/ui.js';
import { slots, slotStorage, DEBUG_SLOT, formatPlaytime } from '../../src/save-slots.js';
import { setRumbleSettings, rumblePlay } from '../../src/rumble.js';
import { game as gameState } from '../../src/game-state.js';
import { seedDebugSave } from '../../src/debug-save.js';
import { levelById } from '../../src/levels/index.js';
import { TITLES } from '../../src/levels/names.js';
import { chooseShot } from '../../src/title-shots.js';
import { VERSION } from '../../src/version.js';
import { devMode } from '../../src/dev-gate.js';
import { setEnginePad, setFaces, padFaces, padLabels, promptText } from '../../src/native-pad.js';
import { keyRouter } from '../../src/remap.js';
import { hudShows } from '../../src/hud-shows.js';
import { parsePresses } from '../../src/hud-buttons.js';
import { parseMenuPointer } from '../menus.js';
import { uiPose, UI_KEYS } from '../ui-poses.js';
import { items as ownedItems } from '../../src/items.js';

// The scene's matrices recomposed only where something moved (src/matrix-cache.js, the web game's own, with its walks
// entered below the root forced, reparented objects forced and updateMatrix remembered), for the walk over the whole
// scene (the mirror's updateMatrixWorld: ~4 200 objects a frame at the desert's spawn, ~13 % of them moved).
// tests/pose-exact-web.test.js: every bone the same as three's own walk.
installMatrixCache();
// (and the scene graph's edits counted, so the mirror's flat list of the scene knows when to be made again: engine/scene-matrices.js)
watchSceneEdits();

let S = null;
const now = () => host.Now();
// (the recorded music: Unity decodes the MP3s the shim can't, BridgeMusic.cs; engine/unity/music.js)
setAudioDecoder(musicDecoder(host));
setThemeWait(themeArrival());   // (a theme this player downloads: played as soon as it is there, issue #471)
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
const planned = (a) => !!(a.views?.length || a.talk || a.through != null || a.play || a.walk || a.sprintShots || a.hudRun || a.tour || a.idle || a.aboard || a.fight || a.foes || a.devmenu || a.ui || a.noTitle || a.trial || a.game || a.ending || a.opening || a.sequence || a.starmap || a.updatesPage || a.house || a.wardrobe || a.menuPointer);
/** -aboard cockpit,main,cabin,hold: the rooms of the parked ship it photographs, as the web's ?aboard= (main.js). */
const aboardRooms = (a) => String(a.aboard ?? '').split(',').filter(Boolean);
/**
 * -starmap search,warm,found,system,ask,nopower (engine/starmap.js STARMAP_SCENES): the holo table's galactic map opened
 * aboard in the desert, on the debug save (its flags and its journal set for each scene), each photographed
 * (unity-starmap-<scene>.png) to lay beside the web's StarMap at 1280 x 720.
 */
const starmapScenes = (a) => String(a.starmap ?? '').split(',').filter((k) => STARMAP_SCENES[k]);
/**
 * -page <to>:<from> (docs/plans/unity-finishable.md): a place a page load reaches on the web (the night train's bell at
 * the market's halt: `travel:page` with ?level=<to>&from=<from>, src/story/night-train.js) played as a player meets it:
 * in <from> on the debug save, the hand-over said, the engine started again at <to> at that level's arrival from <from>
 * (level.arrivals); a picture before and after (unity-page-before.png, unity-page-arrival.png), where he stands logged.
 */
const pageRun = (a) => { const [to, from] = String(a.page ?? '').split(':'); return to && from ? { to, from } : null; };
/** A scene's save: the base (past the prologue, the map's first lines heard), its flags; the save's format kept. */
function starmapFlags(scene) {
  const keep = Object.fromEntries(['save.migrated', 'res.v'].map((k) => [k, gameState.data.flags[k]]).filter(([, v]) => v !== undefined));
  gameState.data.flags = { ...keep, ...STARMAP_BASE, 'signature.told': true, 'signature.search.told': true, ...(STARMAP_SCENES[scene]?.flags ?? {}) };
}

/**
 * -ending first|final (docs/plans/unity-finishable.md): the homecoming played as a player reaches it, on the debug save,
 * the ship's scenes on (not a bench's flags): home arrived at by ship with six worlds done and the last recording heard
 * (first), or after the Lantern (final: the end card and the credits). Pictures every few seconds, the scene's stage and
 * its subtitle logged.
 */
const ENDING_FLAGS = (kind) => ({ 'prologue.done': true, 'ship.powered': true, 'calls.home': true,
  ...Object.fromEntries(['desert', 'arzach', 'perdide', 'edena', 'underwater', 'incal'].map((w) => [`world.${w}.done`, true])),
  // (the debug save keeps what the last run ended with: the ending's own flags set as each kind starts from)
  'ending.done': kind === 'final', 'ending.final': false, 'finale.met': kind === 'final', 'home.ilen.home': false,
  ...(kind === 'final' ? { 'ending.first': 'new', 'world.bazaar.done': true } : {}) });

/**
 * The platform's pad (src/native-pad.js setEnginePad): on Android (the Retroid) the handheld's own names, A B X Y as
 * printed, L1 R1, Select Start, and its Nintendo letters moved to positions (Unity reports them by letter, as Android
 * does); on the Xbox, Xbox names; on the Deck's player and a computer, the family of the pad in hand (Steam's: Xbox).
 */
function platformPad(args = {}) {
  // (-pad-layout android: a handheld's in the editor's batch, its prompts and its taps: issue #574)
  const p = args.padLayout === 'android' ? 'android' : String(host?.Platform?.() ?? '');
  setEnginePad({ layout: p === 'android' ? 'android' : 'standard', family: p === 'xbox' ? 'xbox' : '' });
}
/** A state's text with its prompts in the pad's own names (`remap`: the player's own buttons too; not the menus' own). */
function forPad(json, remap) {
  const L = padLabels();
  return promptText(json, { ...L, remap });
}

/** The world's name over the Start menu's save line (the page's #menu-where). */
const where = () => TITLES[S?.game?.level?.id] ?? '';
/** The line under the Start menu's heading, as the web's: "Save 1 · The Desert · 12 min played", and the fragments' (fragmentsLine). */
const saveLine = () => `${slots.active === DEBUG_SLOT ? 'Debug save' : `Save ${slots.active}`} · ${TITLES[S?.game?.level?.id] ?? ''} · ${formatPlaytime(slots.meta?.()?.playtime ?? 0)} played${S?.game?.fragmentsLine?.() ? ` · ${S.game.fragmentsLine()}` : ''}`;

export function start(argsJson) {
  const args = JSON.parse(argsJson || '{}');
  platformPad(args);
  // (-screen 960x720: the whole run on a screen of that shape, the Retroid's 4:3: its menus, its shots; issue #264)
  const [sw, sh] = String(args.screen ?? '').split('x').map(Number);
  if (sw > 0 && sh > 0) host.ScreenAs?.(sw, sh);
  if (planned(args)) {
    try { host.Analytics?.('enabled', '{"enabled":false}'); } catch { /* older player */ }
    launch(args); return;
  }
  // played: the title first (engine/menus.js; src/title.js on the web), the world loaded once a save is chosen; a reboot
  // (Quit to title onto another save, Travel here: BridgeRunner.Reboot) comes back with its choice made (`boot`)
  const settings = new Settings();
  // (the Graphics setting as the engine started with it: the saved one, the command line's, or the platform's default,
  // BridgeArgs.Quality; a change applies from the next start. Auto stays Auto: the device's own preset each start)
  if (args.quality && settings.quality !== 'auto') settings.quality = args.quality;
  setFaces(settings.padFaces);
  setRumbleSettings(settings);   // (Settings > Rumble and its strength, src/rumble.js)
  // (the script over the air, BridgeUpdates.cs: the Updates page, the game saved before its Restart now)
  const updates = new UnityUpdates({ host, version: VERSION, save: () => S?.game?.save?.() });
  const menus = new EngineMenus({
    updates: updates.on ? updates : null,
    store: slots, settings, dev: () => devMode({ settings }), version: `v${VERSION}`,
    onStart: (choice) => begin(choice),
    onResume: () => { S?.game?.applySettings?.(); },
    onQuit: () => { S.game?.save(); menus.show('title'); },
    onPhoto: () => { S?.game?.setPhoto?.(true); },
    onSetting: (k) => {
      setFaces(settings.padFaces); S?.game?.applySettings?.(settings);
      if (!S?.game && S?.titleSound) titleSettings(S.titleSound, settings);
      if (k === 'rumble' || k === 'rumbleLevel') rumblePlay('hurt', { h: 0.75 });   // (a taste of the new strength, as the web's page)
    },
    where,
    // (the jets' and the pirates' pitch rows: once the jets are owned, once the pirates are beaten, as the page's)
    hasJets: () => ownedItems.has('jetpack'), piratesBeaten: () => !!gameState.flag('minigame.pirates.beaten'),
    // (the save under the Start menu's heading, as the web's: "Save 1 · The Desert · 12 min played")
    saveLine,
    // (the menus' canvas, its units: 720 high, as wide as the screen's shape; the title laid out on it)
    screen: () => ({ w: host.MenuWidth?.() || 1280, h: 720 }),
    // (the Items panel's tiles a row: as many of ~128 units as the sheet holds, BridgeMenu's canvas 720 high)
    itemCols: () => itemColsFor(host.MenuWidth?.() || 1280, 720),
    // (the room BridgeMenu's sheet has for the Map, its units: "w,h"; the map is drawn as wide as it, issue #272)
    mapBox: () => { const [w, h] = String(host.MenuMapBox?.() ?? '').split(',').map(Number); return w > 0 && h > 0 ? { w, h } : null; },
    // (inside a makers' house: its map, the game menu's House map; issue #405, #487)
    house: () => S?.game?.houseView?.() ?? null,
    // (-title-art H1: that painted world behind the title, as the web's ?shot=H1, to lay the two side by side)
    shots: (o) => chooseShot({ ...o, search: args.titleArt ? `?shot=${encodeURIComponent(args.titleArt)}` : '' }),
  });
  S = { args, menus, settings, game: null, frames: 0, plan: null, results: [], keys: new Set(), lastT: 0, audioMs: 0, menuV: -1 };
  // (the pad on the title, before the game and its controller are made: the controller's menu context, as the page's)
  S.titlePad = new Controller({ pads: () => pads, context: () => 'menu', action: (n) => menus.action(n), navigate: (x, y) => menus.navigate(x, y), look() {}, scroll() {}, faces: () => padFaces() });
  if (args.boot) begin(args.boot);
  // (-page overnighttrain:bazaar: in the second world first, on the debug save, then by a page load's way to the first; below)
  else if (pageRun(args)) begin({ slot: DEBUG_SLOT, level: pageRun(args).from, arrive: true });
  else { menus.show('title'); S.titleSound = titleSound(args, settings); updates.auto(); }   // (and the title's own check for a newer script)
  // (-title-shots 960x1280,1280x960 -out dir: the title on screens of those sizes one after another, the first from
  // before the first frame as a device's cold start, each photographed once settled: unity-title-<k>-<w>x<h>.png; issue #470)
  const sizes = String(args.titleShots ?? '').split(',').map((s) => s.split('x').map(Number)).filter(([w, h]) => w > 0 && h > 0);
  if (sizes.length && !args.boot) { S.titleShots = { sizes, k: 0, t: 0 }; host.ScreenAs?.(...sizes[0]); }
  if (args.titleGo && !args.boot) { S.titleGo = { at: Number(args.titleGo) || 60, t: 0, went: -1, ready: -1 }; host.ScreenAs?.(1280, 720); }
  showMenu();
}

/**
 * -title-go frames: the title that long, then the debug save's desert chosen as the title's Debug row does
 * (engine/menus.js begin), the load after it photographed (unity-title-go-<frames after>.png) until the world has played
 * a while; issue #510, the loading screen from the title.
 */
function titleGo() {
  const T = S.titleGo, out = S.args.out;
  const shot = (name) => { if (out) { const file = `${out}/unity-title-go-${name}.png`; host.Shot(file); console.log(`[unity] saved ${file}`); } };
  T.t++;
  if (T.went < 0) {
    // (the title as it stands, its pictures drawn and the start's loading screen faded off it, before the choice: 2.5 s
    // at least, a batch run's frames being short)
    T.t0 ??= now();
    if (T.shotAt == null && T.t >= T.at && now() - T.t0 > 2500) { shot('title'); T.shotAt = T.t; }
    if (T.shotAt == null || T.t < T.shotAt + 10) return;
    T.went = T.t;
    S.menus.begin({ debug: 'desert', slot: DEBUG_SLOT });
    return;
  }
  const since = T.t - T.went;
  if (S.game && T.ready < 0) { T.ready = T.t; console.log(`[unity] title-go: the world ready ${since} frames after the choice`); }
  if (T.ready < 0) { if ([1, 3, 8, 20, 40].includes(since)) shot(since); return; }
  const after = T.t - T.ready;
  if (after === 1) shot('ready-1');
  if (after === 20) shot('ready-20');
  if (after >= 90) { shot('world'); S.titleGo = null; host.Exit(0); }
}

/** -title-shots: each size a while (the title's picture streamed in, the layout sent again), photographed, then the next. */
function titleShots() {
  const T = S.titleShots, [w, h] = T.sizes[T.k];
  if (++T.t < (S.args.titleWait ?? 45)) return;
  if (S.args.out) { const file = `${S.args.out}/unity-title-${T.k}-${w}x${h}.png`; host.Shot(file); console.log(`[unity] saved ${file}`); }
  T.t = 0;
  if (++T.k < T.sizes.length) { host.ScreenAs?.(...T.sizes[T.k]); return; }
  S.titleShots = null;
  host.Exit(0);
}

/** The sound's rate (Unity's output; 0: none) and whether it renders on Unity's audio thread (the graph recorded here). */
const soundRate = (args) => (args.sound === false ? 0 : host.AudioRate?.() ?? 0);
const soundRecorded = (args, rate) => !!rate && !!host.AudioThreaded?.() && args.audioJs !== true;

/**
 * The title's sound, as src/title.js makes it: the menu music, then the title's own recording over it once Unity has
 * decoded it (src/soundtracks.js loadTitleTheme, BridgeMusic). Faded out as a save is chosen, let go once the world is up.
 */
function titleSound(args, settings) {
  const rate = soundRate(args);
  if (!rate) return null;
  try {
    const s = makeSound('title', { sampleRate: rate, record: soundRecorded(args, rate), title: true });
    titleSettings(s, settings);
    s.menuMusic(true);
    return s;
  } catch (e) { console.warn('[unity] the title\'s sound', e?.stack ?? e); return null; }
}
function titleSettings(s, settings) {
  s.setVolumes?.(settings.music, settings.effects);
  if (!!settings.mute !== !!s.muted) s.toggleMute?.();
}

/**
 * The title's choice: the save made the active slot and read again (the game state was read at import, from the slot
 * last played), or a debug save written at its world (src/debug-save.js); then its world. With a world already loaded:
 * the same save and world resume it, another reboots the engine onto it (the page's fresh page, src/title.js).
 */
function begin(choice) {
  let slot = choice.slot, level = choice.level ?? null, arrive = !!choice.arrive, start = null, prologue = false;
  const via = choice.via ?? null, game = choice.game ?? null, came = choice.from ?? null, transit = choice.to ?? null, back = choice.back ?? null;
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
    // (come by the night train's way, choice.from: at that level's arrival, not the ship's ramp nor the save's place)
    else if (came) { arrive = false; prologue = false; }
    else if (!arrive && saved?.level === level) start = saved; else arrive = !prologue;
  }
  if (S.game) {
    if (S.game.level?.id === level && S.slot === slot && !arrive && !prologue && !game && !S.game.trials?.def) { S.menus.close(); return; }
    console.log(`[unity] onto save ${slot}, ${level}: the engine starts again`);
    host.Reboot?.(JSON.stringify({ boot: { slot, level, arrive, via, game, from: came, to: transit, back, resolved: true } }));
    return;
  }
  S.slot = slot;
  S.analytics?.dispose();
  let analyticsAllowed = false;
  try { analyticsAllowed = slots.active !== DEBUG_SLOT && host.AnalyticsAllowed?.() === true; } catch { /* older player */ }
  if (!analyticsAllowed) { try { host.Analytics?.('enabled', '{"enabled":false}'); } catch { /* older player */ } }
  S.analytics = trackSession({ game: gameState, settings: S.settings, world: game ? null : level, allowed: analyticsAllowed,
    loadTransport: async () => unityTransport(globalThis.__HIRAETH_HOST__, String(VERSION)) });
  S.titleSound?.menuMusic(false);   // (the title's music fades as the world loads, as the page's does before it goes)
  launch({ ...S.args, level }, { start, arrive, via, prologue, game, came, transit, back });
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
  // (sent again when the menus' canvas changes width, as well as when the state does: the title is laid out for it,
  // and its first state is made before BridgeMenu's first frame, with the default width or a cold start's upright
  // screen; on the Retroid's 4:3 its name stayed laid out for 1280 or the portrait panel: issue #470)
  const width = host.MenuWidth?.() || 1280;
  if (!m || (m.v === S.menuV && width === S.menuW)) return;
  S.menuV = m.v; S.menuW = width;
  const v = m.view();
  // (the Map's drawn ground and its sharper part zoomed in, once each: their RGBA to Unity before the state that shows
  // them, BridgeHost.MapImage)
  for (const key of [v?.map?.ground, v?.map?.detail?.key, v?.house?.key]) {
    if (!key || (S.mapsSent ??= new Set()).has(key)) continue;
    const pic = S.game?.mapPicture?.(key) ?? m.housePicture?.(key);   // (the House map's floors: engine/menus.js, issue #405)
    if (pic && host.MapImage) { host.MapImage(key, toHost(pic.data.buffer), pic.width, pic.height); S.mapsSent.add(key); }
  }
  host.Menu?.(forPad(JSON.stringify(v), false));
}

/**
 * A game's sign played (a host's Play: ?game=<id>&from=<world> on the web) and its Quit back (?level=<world>): the engine
 * starts again on the game's page, then on the world at the place saved as you left it (engine/trials.js).
 */
function playGame(href) {
  const { game, from, to, stage, encounter } = readHref(href);
  if (!game) return;
  S.game?.save();
  console.log(`[unity] the game ${game}${to ? ` on the way to ${to}` : ''}: the engine starts again on its page`);
  // (to: the chime-pirates on the first flight to a world, ?game=pirates&to=<world>: src/ambush.js, issue #435)
  host.Reboot?.(JSON.stringify({ boot: { slot: slots.active, level: from ?? S.game?.level?.id ?? 'desert', game: encounter ? `${game}?encounter=${encodeURIComponent(encounter)}` : stage ? `${game}?stage=${stage}` : game, to: to ?? null, resolved: true } }));   // (stage: the pirates' next place, issue #555)
}
function leaveGame(href) {
  const { level, from, via, game, back } = readHref(href);
  // (a card's Previous or Next game, from the Arcade: that game's page, as the page's link)
  if (game && !S.plan) { playGame(href); return; }
  const to = level ?? from ?? S.gameFrom ?? 'desert';
  console.log(`[unity] back from the game to ${to}${via === 'ship' ? ', arriving by ship' : ''}`);
  // (a plan's game, the bridge's -game: it ends with it)
  if (S.plan) { host.Exit(0); return; }
  // (the pirates won on the way: on to the world, landing, as the page's ?level=<world>&via=ship)
  // (Back to the Arcade, ?level=arcade&back=<id>: in front of that game's sign, as the page's address puts you)
  host.Reboot?.(JSON.stringify({ boot: via === 'ship' ? { slot: slots.active, level: to, arrive: true, via: 'ship', resolved: true } : { slot: slots.active, level: to, back: back ?? null, resolved: true } }));
}

/** Another world by the ship (its take-off done, Ship.travel's `go`): the engine starts again at that world's landing, arriving. */
function flyTo(to) {
  S.game?.save();
  console.log(`[unity] the ship flies to ${to}: the engine starts again, arriving by ship`);
  host.Reboot?.(JSON.stringify({ boot: { slot: slots.active, level: to, arrive: true, via: 'ship', resolved: true } }));
}

/** A place reached by a page load on the web (the night train's halt and porch): the engine starts again there. */
function pageTo({ level, from = null }) {
  S.game?.save();
  console.log(`[unity] by way of ${from ?? '?'} to ${level}: the engine starts again`);
  host.Reboot?.(JSON.stringify({ boot: { slot: slots.active, level, from, resolved: true } }));
}

function launch(args, { start: from = null, arrive = false, via = null, prologue = false, game = null, came = null, transit = null, back = null, retryEffects = false } = {}) {
  const retryOptions = { start: from, arrive, via, prologue, game, came, transit, back, retryEffects: true };
  const t0 = now();
  const backend = new UnityBackend(host);
  backend.clock = () => sharedUniforms.uTime.value;   // (the shaders' time: HiraethLook.GameClock)
  backend.portraitDir = args.out ?? null;
  // (-js-off a,b: the script's own measures turned off for a before-and-after on one build: still, the mirror's still
  // matrices; quiet, the mirror's quiet walk; hidden, the hidden subtrees' matrices; people, the people out of view; shape, the banners' frames moved by vertices();
  // copy, the frame's commands handed over as a fresh ArrayBuffer instead of a view of the writer's (pack.js takeView); BridgeArgs passes it as `off`)
  const off = new Set(String(args.off ?? '').split(',').filter(Boolean));
  if (off.has('still')) backend.stillMatrices = false;
  if (off.has('quiet')) backend.quietWalk = false;   // (quiet: every drawable looked at in full every frame, the mirror's own check, issue #455)
  if (off.has('noticed')) backend.noticed = false;   // (noticed: the mirror looking at its drawables as before the notices, issue #455)
  if (off.has('hidden')) backend.skipHidden = false;
  if (off.has('people')) backend.peopleLod = false;
  if (off.has('shape')) backend.shapeAttrs = null;
  if (off.has('copy')) backend.frameView = false;
  if (off.has('surfd')) backend.surfacesD = false;   // (surfd: issue #264's surfaces D left out, the before: the portrait head's face still, no hatch's least spacing, plants' own lean, cut or white line)
  if (off.has('eyepaint')) backend.eyePaint = false;
  if (off.has('relief')) sharedUniforms.uRelief.value = 0;   // (relief: the marks flat, without the painted relief, src/relief.js: its before, issue #696)   // (eyepaint: the portrait head's eyes and brows from his vertex colours, the before of issue #473)
  if (off.has('portrait')) backend.portrait = null;   // (portrait: a conversation's chip without its picture, their initial instead)
  // (far: the small props past the preset's propFar drawn all the same, engine/game.js, issue #262)
  // (gestures: the conversations' captured gestures left unloaded, public/anim/gestures.glb, issue #197)
  // (moves: the people's walks and the traveller's captured moves left unloaded, walks.glb, moves.glb; -js-on matching: the
  // matching database loaded and the matching on, locomotion.glb: issue #427, round 4)
  // (played, the title's state kept: its menus, settings and the save chosen)
  S = { ...(S ?? {}), args, backend, game: null, frames: 0, plan: null, planPointer: String(args.menuPointer ?? '').startsWith('device-'), results: [], keys: new Set(), lastT: 0, audioMs: 0, gcs: args.gcs || args.stutter ? fullGcWatch() : null,
    // (-stutter <prefix>: every script frame and what was happening, written once at the end: engine/stutter.js, issue #468)
    stutter: args.stutter ? new StutterLog() : null };
  // a played world is built under the loading screen (BridgeHud.Loading.cs, the page's #loading), from the title's choice as
  // from a start or a reboot, until its first frame has played; Unity draws on meanwhile instead of waiting on the build
  // (BridgeRunner). Issue #510: from the title the screen stayed on the title's "…" until the world popped up.
  S.loadingWorld = !planned(args);
  if (S.loadingWorld) host.Loading?.(true);
  // the sound at Unity's output rate (BridgeAudio: muted in batch runs, where it is only counted)
  const rate = soundRate(args);
  // (rendered on Unity's audio thread where it has one: the graph recorded here, BridgeHost.AudioBatch)
  const record = soundRecorded(args, rate);
  // (-trial <id>, -game <id>: a run's cards want the menus that draw them, on the debug save, the player's own untouched)
  if (!S.menus && (args.trial || args.game)) {
    slots.setActive(DEBUG_SLOT); gameState.reload();
    const settings = new Settings();
    S.settings = settings;
    S.menus = new EngineMenus({ store: slots, settings, version: `v${VERSION}`, screen: () => ({ w: host.MenuWidth?.() || 1280, h: 720 }) });
  }
  // (-ui: on the debug save past the prologue with the backpack, as the web's side's page storage: engine/ui-poses.js)
  if (args.ui) {
    slots.setActive(DEBUG_SLOT); gameState.reload();
    for (const k of ['prologue.done', 'item.backpack', 'charge.given', 'charge.card']) gameState.set(k, true);
  }
  const starScenes = starmapScenes(args);
  if (starScenes.length) {
    // (the debug save, its journal of worlds seen emptied: the worlds to find are those the route opens, none seen yet)
    slots.setActive(DEBUG_SLOT); gameState.reload();
    try { slotStorage.removeItem('hiraeth.journal.v1'); } catch { /* none */ }
    starmapFlags(starScenes[0]);
    args.level = 'desert';
  }
  // (-fresh: the debug save emptied first, its journal too, as the web's side-by-sides start from a cleared page's storage
  // (scripts/bench/web-page.mjs prepareStorage, scripts/design-qc/capture.mjs): no world's story told, nothing kept, so both
  // sides draw the same state of the world; scripts/unity-compare/)
  if (args.fresh) {
    slots.setActive(DEBUG_SLOT); gameState.reload(); gameState.reset();
    try { slotStorage.removeItem('hiraeth.journal.v1'); } catch { /* none */ }
  }
  // (-aboard alone: the rooms on the debug save the web's ?aboard= shots boot (scripts/design-qc/capture.mjs: past the
  // prologue, the backpack worn), emptied first as theirs is. Given as createGame's `flags` instead, as -views has them, the
  // ship's scenes would be off; left as it was, the run drew whatever save the last one left, the desert's debug save from
  // before Qanat's shrine, and the traveller stood aboard without his backpack where the web's wore it: issue #466)
  if (args.aboard && !args.ending && !starScenes.length) {
    slots.setActive(DEBUG_SLOT); gameState.reload(); gameState.reset();
    try { slotStorage.removeItem('hiraeth.journal.v1'); } catch { /* none */ }
    Object.assign(gameState.data.flags, BENCH_FLAGS);
  }
  // (-set-flags a,b,k=v: on the debug save, those flags set first: the hoverbike found, the bird's promise, a kit's colour
  // chosen (kit.colour.sword=ember), for a world's picture)
  if (args.setFlags) {
    slots.setActive(DEBUG_SLOT); gameState.reload();
    for (const f of String(args.setFlags).split(',').filter(Boolean)) { const [k, v] = f.split('='); gameState.data.flags[k] = v ?? true; }
  }
  // (-sequence <id>: one of engine/sequences.js's sequences, on the debug save seeded as the sequence says, each beat
  // photographed and its state logged, issue #429; -opening is the opening's, issue #394)
  if (args.opening) args.sequence = 'opening';
  let seqFight = false;
  if (args.sequence) {
    const seq = sequenceById(String(args.sequence)) ?? routeById(String(args.sequence));   // (a stutter route plays as a sequence: engine/stutter-routes.js)
    if (!seq) { console.log(`[unity] no sequence ${args.sequence}`); host.Exit(2); return; }
    const o = engineSetup(seq.setup);
    args.level = o.levelId; prologue = !!o.prologue; arrive = !!o.arrive; via = o.via ?? null; seqFight = !!o.fight;
    // (a game's page with its address's words, as -game takes them: the chime pirates' stage and where they fly, #555)
    game = engineGameArg(o);
  }
  const ending = args.ending ? String(args.ending) : null;
  if (ending) {
    slots.setActive(DEBUG_SLOT); gameState.reload();
    Object.assign(gameState.data.flags, ENDING_FLAGS(ending));
  }
  // (the ship's scenes play only with menus: an -ending run makes its own, never opened)
  // (-foes: the Arena's list of foes is a page of the menus, so the plan has menus to draw it, and writes no save; -devmenu:
  // the dev menu is one of the menus too, with the player's settings for its frame readout)
  const menus = S.menus ?? (ending || starScenes.length ? new EngineMenus({ store: slots, screen: () => ({ w: host.MenuWidth?.() || 1280, h: 720 }) })
    // (a sequence's menus are drawn: its Start menu's pages are beats; S.menus is what BridgeMenu is sent)
    : args.sequence || args.menuPointer ? (S.menus = new EngineMenus({ store: slots, settings: new Settings(), where, saveLine, version: `v${VERSION}`, house: () => S?.game?.houseView?.() ?? null, screen: () => ({ w: host.MenuWidth?.() || 1280, h: 720 }), itemCols: () => itemColsFor(host.MenuWidth?.() || 1280, 720), mapBox: () => { const [w, h] = String(host.MenuMapBox?.() ?? '').split(',').map(Number); return w > 0 && h > 0 ? { w, h } : null; } }))
    : args.foes || args.devmenu || args.house || args.ui || args.wardrobe ? (S.menus = new EngineMenus({ dev: () => false, house: () => S?.game?.houseView?.() ?? null, screen: () => ({ w: host.MenuWidth?.() || 1280, h: 720 }) })) : null);
  if (args.devmenu && !S.settings) S.settings = new Settings();
  if (starScenes.length) S.menus = menus;   // (shown: BridgeMenu draws the map)
  // (-updates-page: the Start menu's Updates page photographed as it checks, downloads and restarts: BridgeUpdates, with
  // -updates <manifest>; the debug save, so Restart now's save writes nothing of the player's)
  if (args.updatesPage) {
    slots.setActive(DEBUG_SLOT); gameState.reload();
    const updates = new UnityUpdates({ host, version: VERSION, save: () => S?.game?.save?.() });
    S.menus = new EngineMenus({ store: slots, settings: new Settings(), version: `v${VERSION}`, updates, screen: () => ({ w: host.MenuWidth?.() || 1280, h: 720 }) });
  }
  if (ending) { args.level = 'home'; via = 'ship'; arrive = true; }
  game ??= args.game ?? null;
  // (-game pirates?stage=ice&to=edena: a game's page with its address's own words, the chime pirates' level and the
  // world the flight goes to: issue #555)
  const [gameId, gameQ] = String(game ?? '').split('?');
  game = game ? gameId : null;
  const gq = readHref(`?${gameQ ?? ''}`), stage = gq.stage;
  S.gameFrom = args.level ?? 'desert';
  createGame({ levelId: args.level ?? 'desert', backend, back, game, stage, encounter: gq.encounter ?? null, from: game ? args.level ?? 'desert' : null, to: game ? transit ?? args.to ?? gq.to ?? null : null, onGame: (href) => playGame(href), onLeave: (href) => leaveGame(href), trials: !!args.trial || !!args.fresh, quality: args.quality ?? null, people: args.people !== false, audio: rate ? { sampleRate: rate, record, retryEffects } : null, flags: !ending && (args.views?.length || args.play) ? BENCH_FLAGS : null, log: (...a) => console.log('[game]', ...a),
    menus, settings: S.settings ?? null, start: from, arrive: arrive || !!args.arrive, hullSpawn: !!args.hullSpawn, gestures: !off.has('gestures'), moves: !off.has('moves'), matching: String(args.on ?? '').split(',').includes('matching') || null, sprint: off.has('kevinSprint') ? 'ual' : String(args.on ?? '').split(',').includes('kevinSprint') ? 'kevin' : null,
    via, prologue: prologue || !!args.prologue, onTravel: (to) => flyTo(to), aboard: aboardRooms(args)[0] ?? (starScenes.length ? 'main' : null), scenes: !!args.aboard, fight: !!args.fight || seqFight, arrival: came, onPage: (o) => pageTo(o), saves: !args.foes && !args.devmenu && !args.house && !args.ui && !args.wardrobe && !args.menuPointer, defer: !off.has('defer'), far: !off.has('far'), skies: !off.has('skies'), lod: String(args.on ?? '').split(',').includes('lod'), onStage: (t) => host.LoadStage?.(t),
    // (the bar under the line and why this part takes the time, src/load-page.js: BridgeHud.Loading draws them, issue #527)
    onLoad: (o) => host.LoadProgress?.(o.p, o.why ?? ''),
    // (-traveller v2 [-outfit id]: the Blender rebuild, or b3; else the device's own switch, engine/game.js: issue #493)
    traveller: args.traveller ? { on: args.traveller === 'v2', outfit: args.outfit ?? null } : null })
    .then((game) => {
      S.game = game;
      S.analytics?.ready();
      S.analytics?.play();
      // (built: what is left is Unity's own first frame, its pipelines for this world's look; the bar full once it has played)
      if (S.loadingWorld) host.LoadProgress?.(loadShare('mixing', 'surfaces'), LOAD_WHY.surfaces);
      // (the title's sound let go: the world's own plays from here; the themes this package lacks fetched once, BridgeMusic)
      if (S.titleSound) { S.titleSound.dispose(); S.titleSound = null; }
      if (rate && !planned(args)) { const d = themeDownloads(SOUNDTRACKS[game.level?.id] ?? null); host.MusicFetch?.(d.list, d.carried); }
      if (menus) {
        // the game menu's panels from the world now running (engine/game.js menuSources), its Travel here by a reboot
        menus.sources = game.menuSources({ travel: true });
        menus.onTrack = (id) => game.story?.quests?.choose?.(id);
        // (a gun mode taken, a gadget taken in hand, the finder switched: main.js onUse; issue #344)
        menus.onUse = (id) => game.useItem(id);
        // (the Wardrobe: its preview follows the cursor, A / × wears it: src/wardrobe.js, issue #571)
        menus.wardrobe = game.wardrobe;
        menus.onTravel = (id) => {
          const no = game.travelRefusal(id);
          if (no) return no;
          game.save();
          // (the ship's own way, as the web's: its take-off, then the next world's arrival; ship.travel's `go`, flyTo)
          // (game.travel: a world on the holo table's chart too, found by its signature as it is chosen: engine/chart.js)
          if (game.shipScenes) { menus.close(); return game.travel(id); }
          console.log(`[unity] travel to ${id}: the engine starts again at its landing`);
          host.Reboot?.(JSON.stringify({ boot: { slot: slots.active, level: id, arrive: true, resolved: true } }));
          return null;
        };
        if (menus.mode === 'title') menus.close();
        if (!args.foes && !args.devmenu && !args.house && !args.wardrobe && !args.menuPointer) game.save();
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
    .catch((e) => {
      console.error('[unity] the game failed to start', e?.stack ?? e);
      if (e?.name !== 'SoundEffectsLoadError') { host.Exit(3); return; }
      S.loadingWorld = false; host.Loading?.(false);
      S.menus ??= new EngineMenus({ store: slots, settings: S.settings, version: `v${VERSION}`, screen: () => ({ w: host.MenuWidth?.() || 1280, h: 720 }) });
      S.titlePad ??= new Controller({ pads: () => pads, context: () => 'menu', action: n => S.menus.action(n), navigate: (x, y) => S.menus.navigate(x, y), look() {}, scroll() {}, faces: () => padFaces() });
      S.menus.showSoundLoadFailure({ retry: () => launch(args, retryOptions), back: () => host.Reboot?.('{}') });
    });
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
    // (a path among the views, as the web bench's (scripts/bench/web-page.mjs runAll): its points, speed and secs; the
    // traveller and the camera carried along it by the clock while it is measured: scripts/bench/deck-engines.mjs)
    if (v.points) {
      steps.push({ kind: 'pin', view: pathAt(v, 0) }, { kind: 'wait', frames: 12, secs: args.settle ?? 1.5 });
      if (args.bench) steps.push({ kind: 'measure', view: v, secs: v.secs ?? args.bench, path: v });
      continue;
    }
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
  const walkIn = args.through != null && /@\d/.test(String(args.through)) ? String(args.through).match(/^(.*)@([\d.]+)(r?)$/) : null;
  if (walkIn) {
    // (-through id@metres[r]: walked (r: run) into it from that far out in front, as a player comes to a door, issue #389:
    // the frames every 4 of the game's, each one's speed, the passage's phase and the door walk's logged, as the web's)
    const [, which, back, run] = walkIn;
    steps.push({ kind: 'wait', frames: 30 }, { kind: 'through', which, from: +back }, { kind: 'wait', frames: 40, secs: 1 });
    if (run) steps.push({ kind: 'key', code: 'ShiftLeft', down: true });
    steps.push({ kind: 'key', code: 'KeyW', down: true });
    for (let k = 0; k < 36; k++) steps.push({ kind: 'state', name: `through-${k}` }, ...(args.out ? [{ kind: 'shot', file: `${args.out}/unity-walkin-${String(k).padStart(2, '0')}.png` }] : [{ kind: 'wait', frames: 3 }]), { kind: 'wait', frames: 1 });
    steps.push({ kind: 'key', code: 'KeyW', down: false }, { kind: 'key', code: 'ShiftLeft', down: false }, { kind: 'wait', frames: 30 });
  } else if (args.through != null) {
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
  if (args.ui) {
    // (-ui balloons,objective,…: the page elements of issue #430 put up one after another as the web's side does
    // (engine/ui-poses.js), each photographed a moment on (unity-ui-<piece>.png), then let go)
    steps.push({ kind: 'wait', frames: 90, secs: 3 });
    // (a piece the next one carries on, shop then shopask, is not let go between them)
    const pieces = String(args.ui).split(',').filter(Boolean);
    pieces.forEach((piece, i) => {
      // (the aim: its key held while it is up, as the web's side holds it: UI_KEYS)
      if (UI_KEYS[piece]) steps.push({ kind: 'key', code: UI_KEYS[piece], down: true });
      steps.push({ kind: 'ui', piece }, { kind: 'wait', frames: 30, secs: piece === 'objective' ? 1.2 : piece === 'endcard' || piece === 'credits' ? 2.2 : piece === 'mode' ? 0.4 : 1 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-ui-${piece}.png` });
      if (UI_KEYS[piece]) steps.push({ kind: 'key', code: UI_KEYS[piece], down: false });
      if (!pieces[i + 1]?.startsWith(piece)) steps.push({ kind: 'ui', piece: 'none' }, { kind: 'wait', frames: 10 });
    });
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
  // (-foes [world]: the Arena's list of foes as the menus draw it (BridgeMenu.cs DrawFoes): the Arena with its FOES tab, the
  // list on that world's page, the pad moved and a foe chosen (lit), then closed and the foe come in to fight)
  if (args.updatesPage) {
    const shot = (name) => (args.out ? [{ kind: 'shot', file: `${args.out}/unity-updates-${host.UpdateInfo ? JSON.parse(host.UpdateInfo()).web : 0}-${name}.png` }] : []);
    steps.push({ kind: 'wait', frames: 60, secs: 2 }, { kind: 'updates' }, { kind: 'wait', frames: 30, secs: 1 }, ...shot('open'));
    // (each press waited out: the check's answer, the download's first bytes, then its end and the restart it is armed for)
    const until = (states, secs = 30) => ({ kind: 'updates', until: states, secs });
    steps.push({ kind: 'updates', act: 'check' }, until(['current', 'available', 'apk', 'offline', 'error', 'ready']), { kind: 'wait', frames: 5 }, ...shot('checked'));
    steps.push({ kind: 'updates', act: 'download' }, until(['downloading', 'ready', 'error', 'offline', 'current']), ...shot('downloading'), until(['ready', 'error', 'offline', 'current'], 60), { kind: 'wait', frames: 20 }, ...shot('ready'), { kind: 'wait', frames: 120, secs: 4 });
  }
  if (args.foes) {
    steps.push({ kind: 'wait', frames: 90, secs: 3 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-arena.png` });
    steps.push({ kind: 'foes', world: args.foes }, { kind: 'wait', frames: 10 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-foes.png` });
    steps.push({ kind: 'menu', x: 1, y: 0 }, { kind: 'menu', x: 0, y: 1 }, { kind: 'menu', act: 'confirm' }, { kind: 'wait', frames: 10 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-foes-chosen.png` });
    steps.push({ kind: 'menu', act: 'back' }, { kind: 'wait', frames: 150, secs: 4 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-foes-fight.png` });
  }
  if (args.house) {
    // (-house id: the House map, issue #405: the traveller at the house's way in (or by the mark of -house-room), half its
    // rooms seen, its map found, the game menu on House map, each floor photographed (unity-house-<id>-<floor>.png, to lay
    // beside the web's), ▲ between them)
    steps.push({ kind: 'wait', frames: 120, secs: 4 }, { kind: 'house', id: String(args.house) }, { kind: 'wait', frames: 40, secs: 1.5 }, { kind: 'house', open: true });
  }
  if (args.wardrobe) {
    // (-wardrobe: the game menu's Wardrobe, issue #571: opened, photographed, the cursor down through the blade's colours won
    // (the traveller's preview following it), one worn with A / ×, then closed: unity-wardrobe-<name>.png beside the web's)
    // (the colours won as the web's pictures have them: -set-flags kit.colours.ember,kit.colours.slate,kit.colours.reed,kit.colours.neon)
    const shot = (name) => (args.out ? [{ kind: 'shot', file: `${args.out}/unity-wardrobe-${name}.png` }] : []);
    // (-wardrobe-at x,z: him set down there first, in the ship's shadow or in the sun: the page lights him the same, issue #578)
    if (args.wardrobeAt) steps.push({ kind: 'wait', frames: 60, secs: 2 }, { kind: 'wardrobe', at: String(args.wardrobeAt) }, { kind: 'wait', frames: 30, secs: 1 }, ...shot('world'));
    steps.push({ kind: 'wait', frames: 120, secs: 4 }, { kind: 'wardrobe' }, { kind: 'wait', frames: 120, secs: 4 }, ...shot('open'));
    for (let i = 1; i <= 3; i++) steps.push({ kind: 'menu', x: 0, y: 1 }, { kind: 'wait', frames: 40, secs: 1.5 }, ...shot(`blade-${i}`));
    steps.push({ kind: 'menu', act: 'confirm' }, { kind: 'wait', frames: 30, secs: 1 }, ...shot('worn'), { kind: 'menu', act: 'back' }, { kind: 'wait', frames: 20 }, ...shot('closed'), { kind: 'wardrobe', log: true });
  }
  if (args.menuPointer && !String(args.menuPointer).startsWith('device-')) {
    // (-menu-pointer mouse | touch, issue #574: the menus by the pointer through the Input System's own devices: the Start
    // menu, the mouse over Settings (its :hover look), Controls clicked or tapped (its page), Resume; the game menu, its Items
    // tab, the mouse over the second tile (or a tap on it: picked), a click or a tap again on it (its full view), the full
    // view's Back; the Wardrobe, the mouse over its line; then its close.
    // unity-menu-<name>.png beside the web's; the '[unity] menu:' lines say where each left the menus)
    const P = String(args.menuPointer), shot = (name) => (args.out ? [{ kind: 'shot', file: `${args.out}/unity-menu-${name}.png` }] : []);
    const at = (where, frames = 20) => [{ kind: 'pointer', what: P, at: `menu:${where}` }, { kind: 'wait', frames, secs: frames / 30 }];
    const over = (where) => (P === 'mouse' ? [{ kind: 'pointer', what: 'mouse', at: `over:menu:${where}` }, { kind: 'wait', frames: 10, secs: 0.3 }] : []);
    const log = (text) => ({ kind: 'menuLog', text });
    steps.push({ kind: 'wait', frames: 120, secs: 4 }, { kind: 'menuOpen', mode: 'start' }, { kind: 'wait', frames: 20, secs: 0.6 }, log('opened'), ...shot('start'),
      ...over('side:1'), log('over Settings'), ...shot('start-over'),
      ...at('side:2'), log('Controls pressed'), ...shot('start-controls'),
      ...at('side:0'), log('Resume pressed'),
      { kind: 'menuOpen', mode: 'game' }, { kind: 'wait', frames: 30, secs: 1 }, log('the game menu'), ...shot('game'),
      ...(starmapScenes(args).length ? [] : [...at('tab:2', 30), log('the Items tab pressed'), ...shot('game-items'),
      ...over('cell:0,1'), ...(P === 'mouse' ? [] : at('cell:0,1')), log('the second tile picked'), ...shot('game-picked'),
      ...at('cell:0,1'), log('pressed again'), ...shot('game-full'),
      ...at('full:back'), log('the full view\'s back')]),
      // (the Wardrobe, the mouse over its first line: the debug save has one blade; a tap on it would wear it)
      ...at('tab:5', 40), ...over('cell:0,0'), { kind: 'wait', frames: 30, secs: 1 }, log('the Wardrobe'), ...shot('wardrobe'),
      { kind: 'pointer', what: P, at: 'drag:menu:wardrobe-turn' }, { kind: 'wait', frames: 45, secs: 1.5 }, log('Wardrobe dragged'), ...shot('wardrobe-dragged'),
      ...at('close'), log('closed'),
      { kind: 'menuOpen', mode: 'start' }, { kind: 'wait', frames: 20 }, ...at('side:4'), ...shot('news'),
      ...at('news-pictures'), log('See what changed pressed'), ...at('close'));

  }
  // Device checks wait on a real Android touch, rather than replaying a simulated editor touch.
  if (args.menuPointer === 'device-wardrobe') steps.push({ kind: 'wait', frames: 120, secs: 4 },
    { kind: 'menuOpen', mode: 'game', panel: 'wardrobe' }, { kind: 'hold' });
  if (args.menuPointer === 'device-news') steps.push({ kind: 'wait', frames: 120, secs: 4 },
    { kind: 'menuOpen', mode: 'start' }, { kind: 'wait', frames: 20 },
    { kind: 'pointer', what: 'touch', at: 'menu:side:4' }, { kind: 'wait', frames: 20 }, { kind: 'hold' });
  if (args.devmenu) {
    // (-devmenu: the dev menu, issue #387: opened on F2 as the keys open it, each tab photographed (unity-dev-<n>-<id>.png, to lay
    // beside the web's), a teleport to the temple's door off the World tab, god mode on from Cheats, up and across, then off:
    // set down on the ground below)
    const shot = (name) => (args.out ? [{ kind: 'shot', file: `${args.out}/unity-dev-${name}.png` }] : []);
    steps.push({ kind: 'wait', frames: 120, secs: 4 }, { kind: 'key', code: 'F2', down: true }, { kind: 'key', code: 'F2', down: false }, { kind: 'wait', frames: 10 }, { kind: 'dev', what: 'log' },
      { kind: 'dev', what: 'tabs' }, { kind: 'dev', what: 'noon' }, { kind: 'dev', what: 'tp' }, { kind: 'wait', frames: 90, secs: 3 }, { kind: 'dev', what: 'log' }, ...shot('tp-temple'),
      { kind: 'dev', what: 'god' }, { kind: 'key', code: 'Space', down: true }, { kind: 'wait', frames: 60, secs: 1.5 }, { kind: 'key', code: 'Space', down: false },
      { kind: 'key', code: 'KeyW', down: true }, { kind: 'key', code: 'ShiftLeft', down: true }, { kind: 'wait', frames: 60, secs: 1.5 }, { kind: 'key', code: 'KeyW', down: false }, { kind: 'key', code: 'ShiftLeft', down: false },
      { kind: 'wait', frames: 30, secs: 0.8 }, { kind: 'dev', what: 'log' }, ...shot('god-flying'), { kind: 'dev', what: 'god' }, { kind: 'wait', frames: 40, secs: 1.2 }, { kind: 'dev', what: 'log' }, ...shot('god-landed'),
      { kind: 'dev', what: 'fps' }, { kind: 'wait', frames: 20 }, ...shot('cheats-fps-on'), { kind: 'dev', what: 'fps' }, { kind: 'menu', act: 'back' }, { kind: 'wait', frames: 10 });   // (the readout back off: the settings are the player's)
  }
  for (const room of aboardRooms(args)) {
    // (-aboard …,pictures: from the main room, each canvas drawn aboard close up, the console's screen and the wall
    // pictures: engine/raster.js, sent as textures; unity-canvas-<n>.png, the web's the same way from window.ship)
    if (room === 'pictures') {
      steps.push({ kind: 'aboard', room: 'main' }, { kind: 'wait', frames: 30, secs: 1 });
      for (let i = 0; i < 8; i++) { steps.push({ kind: 'canvas', i }, { kind: 'wait', frames: 20, secs: 0.6 }); if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-canvas-${i}.png`, canvas: i }); }
      steps.push({ kind: 'canvas', i: -1 });
      continue;
    }
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
  if (fights.includes('combo')) {
    // (-fight combo, issues #712 / #713: a toad set down 2.4 m ahead, kept alive, locked on; the three cuts pressed in a
    // chain, a picture every few frames from the first press: the hit bursts, the heavy third)
    const shots = (from, n) => (args.out ? Array.from({ length: n }, (_, i) => ({ kind: 'shot', file: `${args.out}/unity-combo-${String(from + i).padStart(2, '0')}.png` })) : []);
    const press = [{ kind: 'key', code: 'KeyF', down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code: 'KeyF', down: false }];
    steps.push({ kind: 'wait', frames: 60, secs: 2 }, { kind: 'foe', what: 'toad', dist: 2.4, hp: 99 }, { kind: 'wait', frames: 30, secs: 1 },
      { kind: 'key', code: 'Tab', down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code: 'Tab', down: false }, { kind: 'wait', frames: 30, secs: 0.6 },
      ...press, { kind: 'wait', frames: 4 }, ...shots(0, 8), ...press, ...shots(8, 10), ...press, ...shots(18, 22), { kind: 'wait', frames: 60, secs: 1 });
  }
  if (fights.includes('wisp')) {
    // (-fight wisp: an exchange with the ember wisp, issue #398: set down 9 m ahead, locked on; its wind-up, its ball in the
    // air, the blade (F) pressed as the ball comes in, the ball sent back, the wisp stunned low; tests/engine-fireball.test.js)
    const shot = (name) => (args.out ? [{ kind: 'shot', file: `${args.out}/unity-wisp-${name}.png` }] : []);
    steps.push({ kind: 'wait', frames: 60, secs: 2 }, { kind: 'foe', what: 'wisp' }, { kind: 'wait', frames: 30, secs: 1 },
      { kind: 'key', code: 'Tab', down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code: 'Tab', down: false },
      { kind: 'wisp', until: 'wind', secs: 10 }, ...shot('1-windup'), { kind: 'wisp', until: 'near', d: 5.5, secs: 6 }, ...shot('2-ball'),
      { kind: 'wisp', until: 'near', d: 3.3, secs: 3 }, { kind: 'key', code: 'KeyF', down: true }, { kind: 'wait', frames: 3 }, { kind: 'key', code: 'KeyF', down: false },
      { kind: 'wisp', until: 'back', secs: 1 }, ...shot('3-deflect'), { kind: 'wisp', until: 'stunned', secs: 2 }, { kind: 'wait', frames: 25, secs: 0.8 }, ...shot('4-stun'), { kind: 'wisp', until: 'log' });
  }
  if (fights.includes('armour')) {
    // (-fight armour, issue #722: a bell walker of the Signal Market set down 5 m ahead, kept up, locked on: its plates on;
    // three charged cuts at it (Foes.hurt, as the blade's): its plates knocked off onto the ground; then a banded bell walker
    // (its stronger tier) in its place; a picture of each)
    const shot = (name) => (args.out ? [{ kind: 'shot', file: `${args.out}/unity-armour-${name}.png` }] : []);
    steps.push({ kind: 'wait', frames: 60, secs: 2 }, { kind: 'foe', what: 'bell@bazaar', dist: 5, hp: 99, tier: 0 }, { kind: 'wait', frames: 60, secs: 1.5 },
      { kind: 'key', code: 'Tab', down: true }, { kind: 'wait', frames: 2 }, { kind: 'key', code: 'Tab', down: false }, { kind: 'wait', frames: 40, secs: 1 }, ...shot('on'),
      { kind: 'foe', what: 'strip' }, { kind: 'wait', frames: 100, secs: 2 }, ...shot('off'),
      { kind: 'foe', what: 'clear' }, { kind: 'foe', what: 'bell@bazaar*', dist: 5, hp: 99 }, { kind: 'wait', frames: 90, secs: 2 }, ...shot('tier'));
  }
  if (fights.includes('mummers')) {
    // (-fight mummers, issue #724: the humanoid foes on clips, src/enemies/humanoid-rig.js: a mummer king 7 m ahead and a
    // mummer 4.5 m ahead, standing; their rig said (the clips in, the state's clip); then each winds up its first blow,
    // pictured at three quarters of it: the clip's loaded pose held)
    const shot = (name) => (args.out ? [{ kind: 'shot', file: `${args.out}/unity-mummers-${name}.png` }] : []);
    steps.push({ kind: 'wait', frames: 60, secs: 2 }, { kind: 'foe', what: 'mummerking@desert', dist: 7, hp: 99 }, { kind: 'foe', what: 'mummer@desert', dist: 4.5, hp: 99 },
      { kind: 'wait', frames: 90, secs: 2.5 }, { kind: 'foe', what: 'rig' }, ...shot('stand'),
      { kind: 'foe', what: 'windup' }, { kind: 'wait', frames: 30, secs: 0.55 }, { kind: 'foe', what: 'rig' }, ...shot('windup'));
  }
  // (-fight site:<id>,…: an encounter site of this world (issue #722, src/encounters/): the traveller set down 16 m in front of
  // it facing it, its things made and its foes out in their idle, a picture from his follow camera)
  for (const f of fights.filter((x) => x.startsWith('site:'))) {
    steps.push({ kind: 'wait', frames: 30, secs: 1 }, { kind: 'foe', what: 'site', id: f.slice(5) }, { kind: 'wait', frames: 150, secs: 3 });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-site-${f.slice(5)}.png` });
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
    const runKey = args.runKey ?? 'KeyW';
    steps.push({ kind: 'wait', frames: 60, secs: 2 }, ...shot('card'), ...tap('Enter', 20), { kind: 'say', text: '[unity] run: counting' }, ...shot('count'),
      // (-run-key: the key held through the run, W by default; -pose: the game's own pose for its pictures a moment before
      // the run's, session.pose: the drum circle played by itself, a fish on the fishing's line)
      { kind: 'wait', frames: 60, secs: 2.6 }, { kind: 'key', code: runKey, down: true }, { kind: 'wait', frames: 60, secs: args.runSecs ?? 3 },
      ...(args.pose ? [{ kind: 'pose' }, { kind: 'wait', frames: 40, secs: 1.5 }] : []), ...shot('run'),
      // (-words: a fixed set of the minigames' words round the traveller, a second on: BridgeHud's DrawWords against the web's)
      ...(args.words ? [{ kind: 'key', code: runKey, down: false }, { kind: 'words' }, { kind: 'wait', frames: 30, secs: 1 }, ...shot('words')] : []),
      { kind: 'key', code: runKey, down: false },
      // (-pointer mouse | touch, issue #570: the HUD's pause button pressed instead of Esc, through the Input System's own
      // devices. First a pad taken in hand (its View pressed): the button goes; a press where it was does nothing but bring
      // it back, as on the page; a second one pauses)
      ...(args.pointer ? [{ kind: 'inHand', text: 'run: before' }, { kind: 'pointer', what: 'pad' }, { kind: 'wait', frames: 20, secs: 0.6 }, { kind: 'inHand', text: 'run: a pad pressed' }, ...shot('pointer-pad'),
        { kind: 'pointer', what: args.pointer, at: 'pause' }, { kind: 'wait', frames: 20, secs: 0.6 }, { kind: 'inHand', text: `run: the ${args.pointer} pressed, the button hidden` }, ...shot('pointer-shown'),
        { kind: 'pointer', what: args.pointer, at: 'pause' }, { kind: 'wait', frames: 20, secs: 0.8 }, { kind: 'inHand', text: `run: the ${args.pointer} on the button` }] : tap('Escape', 10)),
      ...shot('pause'), { kind: 'say', text: '[unity] run: paused' },
      // (-pointer, issue #574: the card's buttons by the pointer too, as the page's click: the mouse over Retry (its :hover,
      // a paler paper, the focus left on Resume), a click or a tap on Resume; then paused again by the button and Retry)
      ...(args.pointer ? [
        ...(args.pointer === 'mouse' ? [{ kind: 'pointer', what: 'mouse', at: 'over:menu:act:retry' }, { kind: 'wait', frames: 10, secs: 0.3 }, ...shot('pointer-hover')] : []),
        { kind: 'pointer', what: args.pointer, at: 'menu:act:resume' }, { kind: 'wait', frames: 30, secs: 0.8 }, { kind: 'inHand', text: `run: Resume by the ${args.pointer}` }, ...shot('resumed'),
        { kind: 'wait', frames: 30, secs: 1 }, { kind: 'pointer', what: args.pointer, at: 'pause' }, { kind: 'wait', frames: 20, secs: 0.8 }, { kind: 'inHand', text: 'run: paused again' },
        { kind: 'pointer', what: args.pointer, at: 'menu:act:retry' }, { kind: 'wait', frames: 30, secs: 0.8 }, { kind: 'inHand', text: `run: Retry by the ${args.pointer}` }, ...shot('retried'),
      ] : [...tap('Enter', 30), ...shot('resumed')]));
  }
  if (args.hudRun) {
    // (-hud-run secs: the floating prompt and the stamina wheel in motion, to watch or record, BridgeHud's -hud-trace
    // measuring them: beside someone (-talk id, else anyone), round them at a walk, the camera turning (the prompt),
    // then a sprint away (the wheel); the camera's turn in game seconds, so a slow device circles alike)
    const say = (what) => ({ kind: 'say', text: `[unity] hud run: ${what}` });
    steps.push({ kind: 'approach', who: args.talk ?? 'any' }, { kind: 'wait', frames: 30, secs: 1 }, say('circling'),
      { kind: 'key', code: 'KeyD', down: true }, { kind: 'spin', secs: args.hudRun / 2, degPerSec: -100 }, { kind: 'key', code: 'KeyD', down: false },
      say('sprinting'), { kind: 'key', code: 'ShiftLeft', down: true }, { kind: 'key', code: 'KeyW', down: true }, { kind: 'spin', secs: args.hudRun / 2, degPerSec: 12 },
      { kind: 'key', code: 'KeyW', down: false }, { kind: 'key', code: 'ShiftLeft', down: false }, say('done'), { kind: 'wait', frames: 30, secs: 1 });
  }
  if (args.walk) {
    steps.push({ kind: 'key', code: 'KeyW', down: true }, { kind: 'measure', view: { name: 'walk' }, secs: args.walk }, { kind: 'key', code: 'KeyW', down: false });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-walk.png` });
  }
  if (args.sprintShots) {
    // (-sprint-shots N: the traveller sprinting (Shift, W) for 2.5 s, then N pictures two frames apart, his sprint as asked
    // (-js-on kevinSprint: Kevin Iglesias's, issue #704))
    steps.push({ kind: 'key', code: 'ShiftLeft', down: true }, { kind: 'key', code: 'KeyW', down: true }, { kind: 'wait', frames: 150, secs: 2.5 });
    for (let k = 0; k < args.sprintShots; k++) steps.push({ kind: 'wait', frames: 2 }, ...(args.out ? [{ kind: 'shot', file: `${args.out}/unity-sprint-${String(k).padStart(2, '0')}.png` }] : []));
    steps.push({ kind: 'key', code: 'KeyW', down: false }, { kind: 'key', code: 'ShiftLeft', down: false });
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
  if (starmapScenes(args).length) {
    steps.push({ kind: 'wait', frames: 240, secs: 5 });
    for (const scene of starmapScenes(args)) {
      steps.push({ kind: 'starmap', scene }, { kind: 'wait', frames: 90, secs: STARMAP_SCENES[scene].found ? 2.6 : 1.2 });
      if (args.menuPointer && !String(args.menuPointer).startsWith('device-') && scene === 'search') steps.push({ kind: 'pointer', what: String(args.menuPointer), at: 'drag:menu:scanner' }, { kind: 'wait', frames: 45, secs: 1.5 });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-starmap-${scene}.png` });
      if (args.menuPointer === 'device-scanner') steps.push({ kind: 'hold' });
    }
  }
  if (pageRun(args)) {
    const { to, from } = pageRun(args);
    steps.push({ kind: 'wait', frames: 150, secs: 5 }, { kind: 'pageAt', from });
    if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-page-${args.boot ? 'arrival' : 'before'}.png` });
    // (the first world: the hand-over, then the engine starts again; the second: done)
    steps.push(args.boot ? { kind: 'done' } : { kind: 'page', to, from }, { kind: 'hold' });
  }
  if (args.sequence) steps.push({ kind: 'seq', id: String(args.sequence) });
  if (args.ending) {
    const n = args.endingShots ?? 40, every = args.endingEvery ?? 5;
    for (let k = 0; k < n; k++) {
      steps.push({ kind: 'wait', frames: 2, secs: every }, { kind: 'stage' });
      if (args.out) steps.push({ kind: 'shot', file: `${args.out}/unity-ending-${String(k).padStart(2, '0')}.png` });
      steps.push({ kind: 'untilOver' });
    }
  }
  if (!steps.length) return null;
  if (!args.idle && !args.tour) steps.push({ kind: 'done' });
  return { steps, i: 0, wait: 0, t: 0, samples: null };
}

/**
 * The minigames' words for a picture (-words): a pop of each kind round the traveller's head, 4 s long, a balloon to his
 * right and a tag to his left (src/minigames/kit/labels.js; the web's side the same, scratchpad webshots.mjs).
 */
function planWords(game) {
  const w = new WorldLabels(game.camera), p = game.player.pos, at = (x, y, z) => new THREE.Vector3(p.x + x, p.y + y, p.z + z);
  w.pop(at(0, 1, -4), '+10', '', 4); w.pop(at(4, 1, -2), '+250', 'gold', 4); w.pop(at(-4, 1, -2), '×3', 'combo', 4); w.pop(at(0, 1, -8), 'spilled', 'bad', 4);
  const say = w.balloon(); say.show('The water’s in it.', 10); say.place(at(6, 2, 2));
  w.tag('<b>Longer blade</b>Reaches a step further').place(at(-7, 1, 2));
  w.update(0);
  return w;
}

/** Where a bench path is `s` m along (web-page.mjs runAll's `at`, the same numbers): a view with the traveller in it. */
function pathAt(p, s) {
  const pts = p.points, n = pts.length;
  const k = Math.min(Math.max(s, 0), n - 1.001), i = Math.floor(k), u = k - i, a = pts[i], b = pts[i + 1];
  const L = (x, y) => x.map((c, j) => c + (y[j] - c) * u);
  let dh = b.h - a.h; dh = ((dh + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return { name: p.name, player: L(a.p, b.p), heading: a.h + dh * u, eye: L(a.eye, b.eye), target: L(a.target, b.target), fov: p.fov ?? 55, hidePlayer: false };
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

/** The parked ship's meshes drawn from a canvas (the console's screen first, then the pictures), each with a view of it. */
export function shipCanvases(game) {
  const S = game.ship?.parked, out = [];
  if (!S) return out;
  S.group.updateMatrixWorld(true);
  S.group.traverse((o) => {
    const t = o.material?.uniforms?.uHasMap?.value > 0.5 ? o.material.uniforms.uMap.value : null;
    if (!t?.image?.data || !o.visible) return;
    const V = o.position.constructor, p = o.getWorldPosition(new V()), n = new V(0, 0, 1).transformDirection(o.matrixWorld);
    const screen = t === S.callScreen?.texture, d = screen ? 0.9 : 0.7;
    out.push({ screen, w: t.image.width, h: t.image.height, target: [p.x, p.y, p.z], eye: [p.x + n.x * d, p.y + n.y * d, p.z + n.z * d] });
  });
  return out.sort((a, b) => b.screen - a.screen);
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
    if (!down) { menus?.keyUp?.(k); game.key(k, false); continue; }
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
  readPointer(game);
  const look = host.MouseLook();   // (the right button held: "dx,dy" pixels)
  if (look && !menus?.open) { const [dx, dy] = look.split(',').map(Number); if (dx || dy) game.look(dx, dy); }
}
/**
 * The mouse's and the fingers' presses since the last frame (BridgeHost.Pointer, issue #570), each through the game's
 * pointer: what is in hand follows it, and a press on one of the HUD's own buttons does what the page's click does (the
 * minigames' pause). One button a frame: a finger's press and the mouse's the same frame are one press.
 */
function readPointer(game) {
  let took = false;
  for (const p of parsePresses(host.Pointer?.())) if (!took) took = game.pointer(p);
  readMenuPointer();
}
/**
 * What the mouse and the fingers did on the menus since the last frame (BridgeHost.MenuPointer, issue #574: BridgeMenu
 * placed them on what it drew), each through the menus' pointer: what the web's click does (engine/menus.js pointer).
 */
function readMenuPointer() {
  const text = host.MenuPointer?.();
  if (text && S?.menus) for (const ev of parseMenuPointer(text)) S.menus.pointer(ev);
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
  readMenuPointer();
  S.titlePad.update(Math.min(dt, 0.1), true);
}

/**
 * The sound's next PCM to Unity: what keeps its ring AUDIO_AHEAD seconds ahead (whole 128-frame blocks); and where the
 * recordings Unity plays itself stand (BridgeMusic: from the audio thread when it renders there, else from here).
 */
function pumpAudio(ctx) {
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
    const nat = ctx.nativeText?.() ?? '';
    if (nat || S.natives) { host.AudioNatives?.(nat); S.natives = nat; }
  }
  S.audioMs += now() - t0;
}

// (Hiraeth.frame's calls, every one: BridgeRunner's framesLet counts the same, the stutter record's join, issue #468)
let calls = 0;
export function frame(dt) {
  calls++;
  if (!S?.stutter) { playFrame(dt); return; }
  // (the whole script frame, the plan's step with it: a route's spawn is made there, after the game's own frame)
  const t0 = now();
  try { playFrame(dt); } finally { S.stutter.whole(calls, now() - t0); }
}
function playFrame(dt) {
  S?.menus?.tick?.();   // (a rebinding on the Controls page left waiting: kept as it was, engine/menus.js)
  pollMusic(host);   // (the recordings Unity has decoded since: their decodeAudioData answered)
  // the title, before a world: only its menu (the world loading behind it once chosen) and its music
  if (S?.menus && !S.game) {
    if (!S.menus.title.starting && S.titlePad) readTitleInput(dt);
    showMenu();
    if (S.titleShots) titleShots();
    if (S.titleGo) titleGo();
    // (its timers too: the menu tune's scheduler; in a world engine/game.js runs them)
    if (S.titleSound) { page.tick(now()); pumpAudio(S.titleSound.ctx); }
    return;
  }
  if (!S?.game) return;
  const { game, backend } = S;
  const tA = now();
  if (!S.plan) readInput(game);
  else if (S.planPointer) { readPad(); readPointer(game); }   // (a plan's -pointer: its presses and pad through Unity's input, the keys still the plan's)
  const r = game.frame(dt);
  showMenu();
  if (S.loadingWorld) { S.loadingWorld = false; host.LoadProgress?.(1, ''); host.Loading?.(false); }   // (its first frame played: the loading screen fades)
  if (S.titleGo) titleGo();
  backend.lights(game.localLights());
  backend.water(game.waterOver?.());   // (the water's pass over the page: under it the tint and haze, above it the sun's sparkle)
  const tL = now();
  // (the look moves with the hour and the place: read every 4th frame is enough)
  if (S.frames % 4 === 0) backend.look(JSON.stringify(portLook(game.fullLook())));
  S.lookMs = (S.lookMs ?? 0) + now() - tL;
  // the HUD's state when it changed (src/platform.js screen: BridgeHud draws it in uGUI), with which of its parts the page's
  // rules hide now (src/hud-shows.js: BridgeHud asks it, issue #430)
  const scr = game.screen(), acc = access();
  if (scr.version !== S.screenV || acc.key !== S.accessKey) { S.screenV = scr.version; S.accessKey = acc.key; host.Screen(forPad(JSON.stringify({ ...scr.state, access: acc.state, shows: hudShows(scr.state) }), true)); }
  pumpAudio(game.audio);
  const tB = now();
  const lastT = S.lastT; S.lastT = tA;
  S.frames++;
  // (-v8-gcs: each of V8's full collections said with its frame, beside the late frames in unity.log; gc-watch.js)
  const fullGc = S.gcs ? S.gcs.check() : 0;
  if (fullGc && (S.args.gcs || !S.stutter)) console.log(`[unity] V8 full GC ${S.gcs.count} at frame ${S.frames}, ${fullGc} frames after the last`);
  if (S.stutter) {
    if (!game.sectionsOn) { game.sectionsOn = true; game.sections?.(); }
    // (the region's name as the screen says it, every few frames: the cue's place kind, src/hud.js PlaceName)
    const cue = scr.state?.cue, region = cue?.kind === 'place' ? String(cue.text ?? '') : '';
    S.stutter.frame({ n: calls, r, backend, vm: tB - tA, sections: game.sections?.() ?? null, fullGc, state: S.frames % 3 === 0 ? stutterState(game, S.menus) : S.stutter.state, region });
  }
  const P = S.plan;
  if (!P) return;
  const step = P.steps[P.i];
  if (!step || step.kind === 'hold') return;
  const next = () => { P.i++; P.wait = 0; P.t = 0; };
  if (step.kind === 'pin') { game.pin(aimed(game, step.view)); next(); }
  else if (step.kind === 'key') {
    // (a menu open, a run's card: its keys, as the player's arrive, readInput)
    if (S.menus?.open) { if (step.down) S.menus.key(step.code); else S.menus.keyUp?.(step.code); } else game.key(step.code, step.down);
    next();
  }
  else if (step.kind === 'say') { console.log(step.text); next(); }
  else if (step.kind === 'pointer') {
    // (a batch run's press through the Input System, issue #570: on a HUD button's middle as BridgeHud last drew it; a pad's
    // View for 'pad'. The state it leaves: the 'inHand' step's line)
    S.planPointer = true;
    host.PointerSim(step.what, step.at ?? '');
    next();
  }
  else if (step.kind === 'inHand') {
    const R = game.trials?.runner;
    console.log(`[unity] ${step.text}: in hand ${game.inputKind}, buttons ${JSON.stringify(game.screen().state.buttons)}, paused ${!!R?.paused}, phase ${R?.phase ?? '-'}, menu ${S.menus?.mode ?? '-'}`);
    next();
  }
  else if (step.kind === 'state') {
    // (the traveller's speed, height, the passage's phase and the door walk's: issue #389's frames against the web's)
    const Pl = game.player, ps = game.passage?.cur;
    console.log(`[unity] ${step.name} t=${S.frames} v=${Math.hypot(Pl.vel.x, Pl.vel.z).toFixed(2)} y=${Pl.pos.y.toFixed(1)} ${ps?.phase ?? '-'} ${game.doorWalk?.phase ?? '-'}${Pl.climbing ? ' CLIMB' : ''}`);
    next();
  }
  else if (step.kind === 'page') {
    // (as the night train's bell says it: the page's location, here the engine's onPage, engine/game.js)
    console.log(`[unity] page: ?level=${step.to}&from=${step.from}`);
    gameState.emit('travel:page', { href: `?level=${step.to}&from=${step.from}` });
    next();
  }
  else if (step.kind === 'pageAt') {
    const a = game.level.arrivals?.[step.from], p = game.player.pos;
    console.log(`[unity] page: in ${game.level.id} at ${p.toArray().map((v) => v.toFixed(1))}${a ? `, its arrival from ${step.from} at ${a.pos.toArray().map((v) => v.toFixed(1))} (${p.distanceTo(a.pos).toFixed(1)} m off)` : ''}; the screen's fade ${JSON.stringify(game.screen().state.passage ?? game.screen().state.cine?.fade ?? null)}`);
    next();
  }
  else if (step.kind === 'starmap') {
    // (the scene's save, the map opened as the holo table opens it, its moment posed: engine/starmap.js)
    if (S.menus?.open) S.menus.close();
    starmapFlags(step.scene);
    const ok = game.openStarMap?.();
    if (ok) poseStarMap(game.starMap, step.scene);
    const v = ok ? game.starMap.view() : null;
    console.log(`[unity] starmap ${step.scene}: ${ok ? `${v.worlds.length} worlds charted, to find: ${game.starMap.targets.map((t) => t.id).join(' ') || '-'}, picked ${v.panel?.title ?? '-'}${v.ask ? `, ${v.ask.title}` : ''}${v.locked ? ', NO POWER' : ''}` : 'not opened'}`);
    next();
  }
  else if (step.kind === 'words') { planWords(game); console.log('[unity] words up'); next(); }
  else if (step.kind === 'pose') { const ok = game.trials?.runner?.session?.pose?.(S.args.pose); console.log(`[unity] run: posed ${ok ? 'yes' : 'no pose'}`); next(); }
  else if (step.kind === 'stage') {
    const c = game.ship?.cinematic, sub = game.screen().state.sub?.text ?? '';
    console.log(`[unity] ending: ${c?.constructor?.name ?? '-'} ${c?.stage ?? '-'} playing=${!!game.ship?.playing} ending.done=${!!gameState.flag('ending.done')} ending.final=${!!gameState.flag('ending.final')} sub="${sub}" space=${!!game.ship?.spaceCopy} cine=${JSON.stringify(game.screen().state.cine ?? null)} prompt=${JSON.stringify(game.screen().state.prompt?.text ?? null)} holo=${!!game.ship?.holo?.visible} cam=${game.camera.position.toArray().map((v) => v.toFixed(0))}`);
    next();
  }
  else if (step.kind === 'seq') {
    // (a sequence's beats, engine/sequences.js: its runner ticked a frame at a time in the game's seconds, its keys as the
    // player's arrive (engineKey), each beat photographed and what the screen shows logged as one line of JSON)
    if (!P.seq) {
      P.G = engineGame(game, S.menus);
      P.seq = new SequenceRun(P.G, sequenceById(step.id) ?? routeById(step.id));
      const r = engineReady(P.G, P.seq.seq.setup);
      if (r?.then) { P.staging = true; r.then((ok) => { P.staging = false; if (ok === false) console.log('[unity] seq: the cinematic refused to start'); }, (e) => { P.staging = false; console.log(`[unity] seq: staging failed ${e?.message ?? e}`); }); }
      return;
    }
    if (P.staging) return;
    const r = P.seq.tick(Math.min(dt, 0.05));
    if (r?.keys) for (const [code, down] of r.keys) engineKey(game, S.menus, code, down);
    if (r?.record) {
      S.stutter?.event(r.record.name);
      console.log(`[unity] seq ${step.id} ${r.record.name} ${JSON.stringify({ beat: r.record.name, t: +P.seq.time.toFixed(2), late: r.late, ...probe(P.G) })}`);
      if (S.args.out) { P.steps.splice(P.i, 0, { kind: 'shot', file: `${S.args.out}/unity-${step.id}-${r.record.name}.png` }); P.wait = 0; }
    }
    if (r?.done) { for (const e of P.seq.errors) console.log(`[unity] seq error: ${e}`); next(); }
  }
  else if (step.kind === 'untilOver') {
    // (the homecoming over: one more picture of where it leaves him, then done)
    if (game.ship && !game.ship.playing && !P.over) { P.over = true; P.i = P.steps.length - 1; P.steps.splice(P.i, 0, { kind: 'wait', frames: 2, secs: 3 }, { kind: 'stage' }, ...(S.args.out ? [{ kind: 'shot', file: `${S.args.out}/unity-ending-after.png` }] : [])); return; }
    next();
  }
  else if (step.kind === 'ui') {
    if (step.piece === 'none') { game.menus?.close?.(); S.menus?.close?.(); console.log('[unity] ui: let go'); uiPose({ THREE, player: game.player }, 'none'); }
    else console.log(`[unity] ui ${step.piece}: ${uiPose({ THREE, player: game.player, npcs: game.npcs, ship: game.ship, items: ownedItems, level: game.level, tool: game.tool, page: false, openArcade: (b) => S.menus?.openArcade?.(b),
      openShop: (id) => S.menus?.mode === 'shop' || !!game.openShop?.(id), askShop: () => { if (S.menus?.mode !== 'shop') return false; S.menus.action('confirm'); return true; } }, step.piece)}`);
    next();
  }
  else if (step.kind === 'warp') { game.ship?.warp?.start(step.title); next(); }
  else if (step.kind === 'foe') {
    const F = game.foes;
    if (!F) console.log('[unity] no foes here');
    else if (step.what === 'low') { game.player.hearts = 0.5; game.player.hurt?.(0.25, 'foe'); console.log(`[unity] hearts ${game.player.hearts}`); }
    else if (step.what === 'out') { game.player.hurt?.(1, 'foe'); console.log(`[unity] knocked out: ${!!game.player.dead}`); }
    else if (step.what === 'site') {
      const s = F.encounters?.sites.find((q) => q.id === step.id);
      if (!s) console.log(`[unity] no site ${step.id} here`);
      else {
        const V = s.pos.constructor, h = s.heading ?? 0, at = new V(s.pos.x + Math.sin(h) * 16, s.pos.y + 0.5, s.pos.z + Math.cos(h) * 16);
        game.player.teleport(at, new V(0, 1, 0), new V(0, 0, 1));
        game.player.heading = h + Math.PI; game.rig.yaw = game.player.heading + Math.PI;
        console.log(`[unity] at site ${s.id} (${s.kind})`);
      }
    }
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
    } else if (step.what === 'rig') {
      // (-fight mummers: each humanoid's rig, issue #724: its own Animator on the shared clips, what its state plays)
      for (const f of F.list.filter((x) => x.model?.driver)) console.log(`[unity] ${f.kind} rig: clips ${!!f.model.driver.A}, ${f.state}, plays ${JSON.stringify(f.model.driver.chosen)}, ${f.model.driver.cost.toFixed(3)} ms`);
    } else if (step.what === 'windup') {
      for (const f of F.list.filter((x) => x.model?.driver && x.alive)) { const a = f.def.attacks.find((x) => !x.chain && (!x.weapon || x.weapon === f.weapon) && !x.unarmed && !x.throwsAlly && !x.horn); if (a) { f.state = 'chase'; f.cool = 0; f.beginWind(a, game.player); } }
    } else if (step.what === 'clear') {
      for (const f of F.list.slice()) F.remove(f);
      console.log('[unity] the foes cleared');
    } else if (step.what === 'strip') {
      // (-fight armour: three charged cuts at the bell's front, as the blade's: its plates off, issue #722)
      const f = F.list.find((x) => x.alive && x.armour);
      if (!f) console.log('[unity] nothing armoured here');
      else {
        const V = f.pos.constructor, p = game.player.pos, dir = new V(f.pos.x - p.x, 0, f.pos.z - p.z).normalize();
        for (let i = 0; i < 3; i++) { f.downT = 0; f.stunned = 0; f.open = 0; F.hurt(f, 'blade', dir, { damage: 2, combo: 2, breaks: true, charged: true }, null); }
        console.log(`[unity] plates on ${f.platesOn}, bare ${f.armour.bare}, fallen ${F.fallen?.length ?? 0}`);
      }
    } else {
      const got = F.spawnKind(step.what, { n: 1, dist: step.dist ?? (step.what === 'wisp' ? 9 : 5), ...(step.tier === 0 ? { tier: 0 } : {}) });
      if (step.hp) for (const f of got) { f.hp = step.hp; f.cool = 99; }   // (kept up and slow to strike: -fight combo)
      for (const f of got) if (f.armour || f.tierN) console.log(`[unity] ${step.what}: plates ${f.platesOn}, tier ${f.tierN}`);
      console.log(`[unity] a ${step.what} set down: ${got.length}`);
    }
    next();
  }
  else if (step.kind === 'wisp') {
    // (-fight wisp's beats, waited for at most secs: its fireball's wind-up well on, its ball within d m of his chest, sent back, it stunned)
    const F = game.foes, f = F?.list.find((x) => x.kind === 'wisp' && x.alive), b = F?.balls?.[0], p = game.player.pos;
    P.t += Math.min(dt, 0.1);
    const near = b && b.state === 'out' && Math.hypot(b.pos.x - p.x, b.pos.y - p.y - 1.1, b.pos.z - p.z) < (step.d ?? 3);
    const ok = step.until === 'wind' ? f?.state === 'wind' && f.atk?.ball && f.k > 0.7 : step.until === 'near' ? near : step.until === 'back' ? b?.state === 'back' : step.until === 'stunned' ? f?.stunned > 0 : true;
    if (ok || P.t >= (step.secs ?? 0)) { console.log(`[unity] wisp ${step.until}: ${ok ? 'yes' : 'timed out'} (${f ? `${f.state} hp ${f.hp} stunned ${f.stunned.toFixed(2)} up ${(f.chest.y - p.y).toFixed(2)} m` : 'gone'}${b ? `, ball ${b.state}` : ''})`); next(); }
  }
  else if (step.kind === 'dev') {
    const D = game.devMenu, M = S.menus, p = game.player;
    if (!D) { console.log('[unity] dev menu: none here'); next(); return; }
    const pick = (tab, test) => { D.nav.show(D.tabs, tab); const i = D.tab.rows.findIndex(test); if (i >= 0) D.nav.at(D.tabs, i); M.changed(); return D.tab.rows[i]?.label ?? null; };
    if (step.what === 'log') console.log(`[unity] dev menu: open ${!!M?.open && M.mode === 'dev'}, at ${p.pos.toArray().map((v) => v.toFixed(1)).join(' ')}, god ${!!p.god}, on the ground ${!!p.onGround}, the frame readout ${!!S.settings?.showFps}`);
    else if (step.what === 'tabs') {
      // (each tab photographed, RB to the next: as many as this world's menu has)
      console.log(`[unity] dev menu tabs: ${D.tabs.map((t) => `${t.id} ${t.rows.length}`).join(', ')}`);
      const more = [];
      D.tabs.forEach((t, i) => more.push({ kind: 'wait', frames: 8 }, ...(S.args.out ? [{ kind: 'shot', file: `${S.args.out}/unity-dev-${String(i).padStart(2, '0')}-${t.id}.png` }] : []), { kind: 'menu', act: 'tabNext' }));
      P.steps.splice(P.i + 1, 0, ...more);
    }
    else if (step.what === 'noon') { if (!M.open) game.openDev(); console.log(`[unity] dev menu: the hour, ${pick('toggles', (r) => r.act?.do === 'hour' && r.act.h === 12)}`); M.action('confirm'); }
    else if (step.what === 'tp') { if (!M.open) game.openDev(); console.log(`[unity] dev menu: teleport to ${pick('world', (r) => r.act?.point?.key === 'temple')}`); M.action('confirm'); }
    else if (step.what === 'god' || step.what === 'fps') {
      if (!M.open) game.openDev();
      pick('cheats', (r) => r.act?.key === step.what);
      M.action('confirm');
      if (step.what === 'god') M.close();
      console.log(`[unity] dev menu: ${step.what} ${step.what === 'god' ? !!p.god : !!S.settings?.showFps}`);
    }
    next();
  }
  else if (step.kind === 'wardrobe') {
    const M = S.menus;
    if (step.at) {
      const [x, z] = step.at.split(',').map(Number), P = game.player, V = P.pos.constructor;
      const y = game.level.ground?.heightAt ? game.level.ground.heightAt(x, z) : P.pos.y;
      P.teleport(new V(x, y + 0.05, z), new V(0, 1, 0), new V(0, 0, 1));
      console.log(`[unity] the Wardrobe: him set down at ${P.pos.toArray().map((v) => v.toFixed(2)).join(', ')}`);
      next();
      return;
    }
    if (!step.log) M.show('game', 'wardrobe');
    // (-wardrobe-yaw: him held there, as the web's pictures of the page pin him, so the two can be laid side by side)
    if (!step.log && Number.isFinite(S.args?.wardrobeYaw)) { M.turntable.yaw = S.args.wardrobeYaw; M.turntable.idle = -Infinity; }
    const d = game.wardrobe?.data?.();
    console.log(`[unity] the Wardrobe: ${M.open ? M.state.panel.id : 'closed'}, v2 ${!!d?.v2}, sword ${!!d?.sword}, colours ${(d?.blades ?? []).map((b) => `${b.id}${b.worn ? '*' : ''}`).join(' ')}, beside him ${!!game.wardrobe?.sword?.parent}`);
    next();
  }
  else if (step.kind === 'house') {
    const rt = (game.level.temples ?? []).find((t) => t.id === step.id) ?? game.level.temple, M = S.menus;
    if (!rt?.housePlan) { console.log(`[unity] no house ${step.id} here`); next(); return; }
    if (!step.open) {
      const plan = rt.housePlan(), room = S.args.houseRoom ?? plan.entry;
      const m = rt.marks.find((k) => k.room === room) ?? rt.marks[0], V = m.spot.constructor;
      game.player.teleport(m.spot.clone(), new V(0, 1, 0), new V(0, 0, 1));
      game.player.heading = m.heading + Number(S.args.houseTurn ?? 0);
      for (const r of plan.rooms.slice(0, Math.ceil(plan.rooms.length * 0.45))) gameState.set(`temple.${rt.id}.been.${r.id}`, true);
      rt.logic.find('map');
      console.log(`[unity] in ${rt.def.name} by the mark of ${m.room}: inside ${rt.inside(game.player.pos)}`);
    } else {
      M.show('game', 'house');
      const on = M.state.panel.id === 'house';
      const floors = on ? M.hv?.floors ?? [] : [];
      if (floors.length) { M.housePage.pick(M.hv, floors[0].id); M.changed(); }   // (from the lowest floor up, ▲ each time)
      console.log(`[unity] the House map: ${on ? floors.map((f) => f.label).join(' ') : 'not offered'}`);
      const more = [];
      floors.forEach((f) => more.push({ kind: 'wait', frames: 10, secs: 0.4 }, ...(S.args.out ? [{ kind: 'shot', file: `${S.args.out}/unity-house-${rt.id}-${f.id}.png` }] : []), { kind: 'menu', x: 0, y: -1 }));
      // (then Menu: the Start menu, which has no House map, Items, Quests or Map since issue #487)
      more.push({ kind: 'menu', act: 'start' }, { kind: 'wait', frames: 10, secs: 0.4 }, ...(S.args.out ? [{ kind: 'shot', file: `${S.args.out}/unity-house-${rt.id}-start.png` }] : []));
      P.steps.splice(P.i + 1, 0, ...more);
    }
    next();
  }
  else if (step.kind === 'foes') {
    const ok = game.openFoes();
    if (ok && step.world && step.world !== 'all') { const L = game.foeList; L.setWorld(step.world); S.menus.changed(); }
    console.log(ok ? `[unity] the list of foes: ${game.foeList.filterTitle()}, ${game.foeList.shown().reduce((n, s) => n + s.items.length, 0)} to fight` : '[unity] no list of foes here');
    next();
  } else if (step.kind === 'updates') {
    // (-updates-page: the Start menu open on Updates, then its buttons pressed as the pad would)
    const m = S.menus;
    if (step.until) {
      // (the page's own poll moves the state: waited for, at most secs)
      P.t += Math.min(dt, 0.1);
      const st = m.updates?.info?.check;
      if (step.until.includes(st) || P.t >= step.secs) { console.log(`[unity] Updates: ${st} after ${P.t.toFixed(1)} s`); next(); }
    } else if (!step.act) {
      m.show('start');
      const i = m.startSide().findIndex((e) => e.id === 'updates');
      if (i >= 0) { m.start.at = { in: 'page', i: m.updatesFirst() }; m.start.page = 'updates'; m.changed(); }
      console.log(`[unity] the Updates page: ${i >= 0 ? JSON.stringify(m.updatesRowsNow().map((r) => r.text)) : 'none in this player'}`);
    } else {
      const rows = m.updatesRowsNow(), at = rows.findIndex((r) => r.act === step.act);
      console.log(`[unity] Updates: ${step.act} ${at >= 0 ? 'pressed' : 'not offered'} (${m.updates?.info?.check ?? '?'})`);
      if (at >= 0) { m.start.at = { in: 'page', i: at }; m.action('confirm'); }
    }
    if (!step.until) next();
  } else if (step.kind === 'menu') {
    if (step.act) S.menus.action(step.act); else S.menus.navigate(step.x, step.y);
    next();
  }
  else if (step.kind === 'menuOpen') { S.menus?.show(step.mode, step.panel ?? null); next(); }
  else if (step.kind === 'menuLog') {
    // (where the menus are: -menu-pointer's lines, issue #574)
    const M = S.menus, v = M?.view?.();
    const at = !M?.mode ? 'closed' : M.mode === 'start' ? `start, the ${M.startPage()} page, at ${JSON.stringify(M.start.at)}` : M.mode === 'game' ? `game, ${M.state.panel.id}, at ${JSON.stringify(M.state.cursor())}${v?.full ? `, full: ${v.full.title}` : ''}` : M.mode;
    console.log(`[unity] menu: ${step.text}: ${at}${v ? `, pointer ${!!v.pointer}` : ''}`);
    next();
  }
  else if (step.kind === 'canvas') {
    // (the i-th mesh of the parked ship drawn from a canvas: the camera half a metre to a metre before it, pinned; -1 lets go)
    const list = shipCanvases(game);
    const c = list[step.i];
    if (step.i < 0 || !c) game.pin(null); else game.pin({ eye: c.eye, target: c.target, fov: 45, hidePlayer: true });
    if (step.i >= 0) console.log(c ? `[unity] canvas ${step.i}: ${c.w} × ${c.h}` : `[unity] no canvas ${step.i}`);
    next();
  }
  else if (step.kind === 'aboard') { console.log(game.goAboard(step.room) ? `[unity] aboard: ${step.room}` : `[unity] no room ${step.room} aboard`); next(); }
  else if (step.kind === 'turn') { game.look(step.dx, 0); if (++P.wait >= step.frames) next(); }
  // (the camera turned at degPerSec of the game's time, the rig's 0.0025 rad a mouse pixel: src/player.js look, for secs)
  else if (step.kind === 'spin') { const d = Math.min(dt, 0.1); game.look((step.degPerSec * d * Math.PI) / 180 / 0.0025, 0); P.t += d; if (P.t >= step.secs) next(); }
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
    if (pt && step.from) {
      // (out in front of its door on the side it is walked into from, facing it, the camera behind)
      S.through = pt;
      const V = pt.at.constructor, door = pt._threshold?.door ?? pt.door;
      const n = new V(Math.sin(door?.yaw ?? 0), 0, Math.cos(door?.yaw ?? 0));
      const side = Math.sign(pt.at.clone().sub(door?.at ?? pt.at).dot(n)) || 1;
      const p = (door?.at ?? pt.at).clone().addScaledVector(n, -side * step.from);
      const g = game.physics?.groundAt?.(p.x, p.y + 2, p.z, 6);
      if (Number.isFinite(g)) p.y = g;
      game.player.teleport(p, new V(0, 1, 0), new V(0, 0, 1));
      game.player.heading = Math.atan2(n.x * side, n.z * side);
      game.rig.yaw = game.player.heading + Math.PI;
      console.log(`[unity] ${step.from} m out from the way through "${pt.label ?? '?'}" (${P2.indexOf(pt)} of ${P2.length})`);
    } else if (pt) {
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
    if (!P.samples) { game.mirror.profiling = !!S.args.split; game.sectionsOn = !!S.args.split; game.sections?.(); game.mirror.profile(); backend.stats.hostMs = 0; host.ApplyMs(); host.ClothMs?.(); host.CapeMs?.(); host.WaitMs?.(); host.GpuSplit?.(); host.RenderStats?.(); S.audioMs = 0; P.n0 = backend.stats.frames; S.lookMs = 0; S.looks = backend.stats.looks ?? 0; }
    if (step.path) {   // (along the path by the clock: the traveller set there, not walked, as the web bench does)
      P.pathT0 ??= now();
      const at = pathAt(step.path, ((now() - P.pathT0) / 1000) * (step.path.speed ?? 4));
      game.player.pos.set(...at.player); game.player.vel?.set(0, 0, 0); game.player.heading = at.heading;
      game.pin({ eye: at.eye, target: at.target, fov: at.fov, hidePlayer: false });
    }
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
      // (every frame's interval, for the 1 % lows and the stalls: scripts/bench/deck-engines-summary.mjs)
      res.raw = s.map((x) => +x.dt.toFixed(2));
      // (what Unity drew a frame over the measure: its SetPass calls, triangles and vertices, every pass)
      try { res.rs = JSON.parse(host.RenderStats?.() ?? '{}'); } catch { /* none */ }
      S.results.push(res);
      console.log(`[bench] ${JSON.stringify(res)}`);
      P.samples = null; P.pathT0 = null;
      next();
    }
  } else if (step.kind === 'shot') {
    if (++P.wait < 3) return;   // (a frame for the pin to land, one for the shadows)
    host.Shot(step.file);
    console.log(`[unity] saved ${step.file}`);
    next();
  } else if (step.kind === 'done') {
    if (S.stutter) host.WriteText(`${S.args.stutter}.js.json`, S.stutter.json());
    if (S.args.out && S.results.length) host.WriteText(`${S.args.out}/unity-bench.json`, JSON.stringify({ engine: 'unity', results: S.results, backend: backend.stats }, null, 1));
    console.log(`[unity] done after ${S.frames} frames; ${JSON.stringify(backend.stats)}`);
    host.Exit(0);
  }
}
