// Sequences, the web against the engines moment by moment (issue #429, bridge parity 2: "compare sequences, not stills").
// A sequence is a world set up one way (a save, a cinematic of the review page's catalog, the prologue, a game's page)
// and a list of beats; each beat has a way to get there (a dev jump on the game's own objects, keys pressed, a condition
// waited for, a time in the game's seconds) and is then recorded: a picture, and what the screen shows as data (probe).
// The same file runs in three places, each with its own clock and its own way to press a key:
//   the web     scripts/unity-compare/sequences.mjs web: imported into the page by Vite, ticked from headless Chrome
//               (the page's own clock, window.clock()), the keys pressed by Chrome's input, the picture Chrome's
//   node        engine/sequence-run.mjs: the engines' bundle (engine/game.js, which exports this file's runner) played in
//               a bare VM at a fixed step; the state stream only (tests/sequences.test.js, on GitHub)
//   Unity       engine/unity/game.js -sequence <id>: the bundle in Puerts, a frame a tick, Unity's picture
// The streams are compared beat by beat (compareStreams): what differs and isn't named in engine/bridge-gaps.js
// STREAM_DIFFS fails the test. docs/systems/engine-bridge.md, "Sequences".
import * as THREE from 'three';
import { inkSpec } from './ink-spec.js';
import { portMaterial } from './unity/port-format.js';
import { OPENING_BEATS, beatDue } from './opening-beats.js';
import { PROLOGUE_STAGES } from '../src/ship/prologue.js';
import { HOLO } from '../src/ship/hologram.js';
import { CINEMATICS } from '../src/cinematics-page/catalog.js';
import { stageCinematic, seedReviewEntry } from '../src/cinematics-page/runtime.js';
import { screen } from '../src/platform.js';
import { game as gameState } from '../src/game-state.js';
import { seedDebugSave } from '../src/debug-save.js';
import { slots, slotStorage, DEBUG_SLOT } from '../src/save-slots.js';
import { items } from '../src/items.js';
import { HUD_HIDES } from '../src/hud-shows.js';

// ------------------------------------------------------------------ the sequences

const tap = (...codes) => codes;
/** A cinematic of the review page's catalog (src/cinematics-page/catalog.js) by its id. */
export const catalogEntry = (id) => CINEMATICS.find((e) => e.id === id) ?? null;
/** What plays now: the prologue, a world's moment, a ship's scene or a box opening, and its own clock (s). */
export function playing(G) {
  const P = G.ship?.prologue;
  if (P && !P.done && G.ship?.playing) return { what: 'prologue', stage: P.stage, t: P.t };
  const m = G.story?.moments?.current;
  if (m) return { what: `moment:${m.id}`, stage: null, t: m.t ?? 0 };
  const c = G.ship?.cinematic;
  if (c && G.ship?.playing) return { what: `ship:${c.constructor?.name ?? 'scene'}`, stage: c.i ?? null, t: c.t ?? 0 };
  const b = G.boxes?.scene;
  if (b && G.boxes?.busy?.()) return { what: 'box', stage: b.phase ?? null, t: b.t ?? 0 };
  return null;
}
/** Seconds into what plays (its own clock), or -1 when nothing does. */
const playT = (G) => playing(G)?.t ?? -1;
/** A beat `secs` into the cinematic that plays (or the first beat after it ended). */
const into = (name, secs, more = {}) => ({ name, until: (G) => playT(G) >= secs || (!playing(G) && G.since > secs), timeout: secs + 30, ...more });
/** A beat at a ship's scene's step `i` (src/ship/cinematics.js Sequence: its clock starts again each step), `secs` into it. */
const atStep = (name, i, secs, more = {}) => ({ name, until: (G) => { const c = G.ship?.cinematic; return !G.ship?.playing || (c && (c.i > i || (c.i === i && c.t >= secs))); }, timeout: 60, ...more });
/** A beat at a box opening's phase (src/boxes/scene.js: its clock starts again each phase). */
const atPhase = (name, phase, secs, more = {}) => ({ name, until: (G) => { const b = G.boxes?.scene; return !b || (b.phase === phase && b.t >= secs) || BOX_PHASES.indexOf(b.phase) > BOX_PHASES.indexOf(phase); }, timeout: 30, ...more });
const BOX_PHASES = ['approach', 'wake', 'rise', 'wobble', 'dissolve', 'reveal', 'card', 'beat', 'out'];
/** Someone of this world by their id, the traveller put 1.6 m before them facing them (the Unity host's 'approach'). */
function approach(G, who) {
  const n = (G.npcs ?? []).find((x) => x.def?.id === who && !x.pooled);
  if (!n) throw new Error(`no ${who} here`);
  const dir = new THREE.Vector3(Math.sin(n.heading ?? 0), 0, Math.cos(n.heading ?? 0)), p = n.pos.clone().addScaledVector(dir, 1.6);
  G.player.teleport(p, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
  G.player.heading = Math.atan2(n.pos.x - p.x, n.pos.z - p.z); G.rig.yaw = G.player.heading + Math.PI;
}
/** The makers' temple of this id in the world. */
const temple = (G, id) => (G.level.temples ?? []).find((t) => t.id === id) ?? null;
/** A minigame's start card's main button, a pause, as a pad's Menu (src/minigames/kit/runner.js padAction). */
const padStart = (G) => G.minigame?.padAction?.('start');
/** A run of a game's page: its card, the count, the run held a while on `hold`, the pause. */
const gameBeats = (hold) => [
  { name: 'card', wait: 1 },
  { name: 'count', act: padStart, wait: 0.8 },
  { name: 'run', until: (G) => G.minigame?.phase === 'play', timeout: 20, hold: { [hold]: true }, wait: 2.5 },
  { name: 'pause', hold: { [hold]: false }, act: padStart, wait: 0.6 },
];

/** The opening (issue #394's beats, engine/opening-beats.js): a new save's prologue in the desert. */
const OPENING = {
  id: 'opening', title: 'The opening', setup: { level: 'desert', prologue: true, fresh: true },
  beats: [...OPENING_BEATS.map((b) => ({
    name: b.name,
    // (the E that plays the father's message: pressed after the console's beat, before the call's)
    keys: b.stage === 'call' && b.name === 'call-rise' ? tap('KeyE') : [],
    until: (G) => { const P = G.ship?.prologue; return !P || P.done || beatDue(b, PROLOGUE_STAGES, P.stage, P.t); },
    timeout: 120,
    // (at the console: the traveller at the cockpit's point, the voicemail's prompt over its button)
    after: b.console ? (G) => { const m = G.ship.modelOf(G.player.pos); if (m?.interior?.points?.cockpit) G.player.pos.copy(G.ship.world(m, m.interior.points.cockpit)); } : null,
    wait: b.console ? 0.9 : 0,
  })),
  // after it: Plumb's word on the village on the horizon, on the cue in its name (src/companion.js, issue #434)
  // (and the first step out's drift into the view over, so the camera is the rig's on both sides whenever the line comes)
  { name: 'plumb', until: (G) => /Plumb:/.test(G.screen().cue?.text ?? '') && !G.ship?.reveal && !G.ship?.blend, timeout: 60 }],
};

/** Every world's filmed moment (src/story/*-moments.js, the catalog's "World moments"): three beats into each. */
const MOMENTS = CINEMATICS.filter((e) => e.group === 'World moments').map((e) => ({
  id: `moment-${e.id}`, title: `World moment · ${e.title}`, setup: { level: e.world, review: e.id },
  beats: [into('start', 0.6), into('mid', 4), into('late', 9)],
}));

export const SEQUENCES = [
  OPENING,
  ...MOMENTS,
  {
    id: 'box', title: 'A makers\' box opening', setup: { level: 'desert', review: 'box.desert.backpack' },
    beats: [atPhase('rise', 'rise', 0.3), atPhase('wobble', 'wobble', 1), atPhase('reveal', 'reveal', 0.4), { name: 'card', until: (G) => !!G.screen().boxCard?.card, timeout: 30, wait: 0.6 }],
  },
  {
    id: 'arrival', title: 'The ship\'s arrival', setup: { level: 'arzach', review: 'arrival.arzach' },
    beats: [atStep('space', 0, 1.5), atStep('clouds', 1, 1), atStep('descent', 2, 2), atStep('land', 3, 1.5), atStep('ramp', 4, 1.2), { name: 'out', until: (G) => !G.ship?.playing, timeout: 60, wait: 1.5 }],
  },
  {
    id: 'takeoff', title: 'The ship\'s takeoff', setup: { level: 'arzach', review: 'takeoff' },
    beats: [atStep('seal', 0, 1), atStep('lift', 1, 2), atStep('away', 1, 4.6), atStep('stars', 2, 0.8)],
  },
  {
    // the Start menu and its pages (src/ui.js SettingsMenu and src/game-menu.js on the web, engine/menus.js in the engines)
    id: 'menus', title: 'The Start menu and its pages', setup: { level: 'bazaar', debug: true },
    beats: [
      { name: 'play', wait: 1.5 },
      { name: 'start', act: (G) => G.menu.open('start'), wait: 0.5 },
      { name: 'items', act: (G) => { G.menu.close(); G.menu.open('game', 'items'); }, wait: 0.5 },
      { name: 'map', act: (G) => { G.menu.close(); G.menu.open('game', 'map'); }, wait: 1.5 },
      { name: 'quests', act: (G) => { G.menu.close(); G.menu.open('game', 'quests'); }, wait: 0.5 },
      { name: 'settings', act: (G) => { G.menu.close(); G.menu.open('start', 'settings'); }, wait: 0.5 },
      { name: 'closed', act: (G) => G.menu.close(), wait: 0.8 },
    ],
  },
  {
    // the House map (issue #405, src/house-map.js): the Start menu's page inside a makers' house, its floor drawn
    id: 'house-map', title: 'The House map', setup: { level: 'buried', debug: true },
    beats: [
      { name: 'inside', act: (G) => { const a = temple(G, 'buried').arrival, h = a.heading; G.player.teleport(a.pos.clone(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(h), 0, Math.cos(h))); G.player.heading = h; G.rig.yaw = h + Math.PI; }, wait: 2 },
      { name: 'map', act: (G) => G.menu.open('start', 'house'), wait: 1.5 },
      { name: 'closed', act: (G) => G.menu.close(), wait: 0.6 },
    ],
  },
  {
    // a fight in the Arena (its waves stopped): a blot set down, locked on, a cut, a hit, its death, its chimes
    id: 'fight', title: 'A fight', setup: { level: 'arena', fight: true },
    beats: [
      { name: 'ready', act: (G) => { const F = G.foes; F.setPractice?.(''); F.waveRest = F.packRest = 1e9; for (const f of [...F.list]) F.remove(f); }, wait: 1 },
      { name: 'spawn', act: (G) => { G.foe = G.foes.spawnKind('blot', { n: 1, dist: 5 })[0]; G.foeHp = G.foe?.hp; }, wait: 1 },
      { name: 'lock', keys: tap('Tab'), wait: 0.8 },
      { name: 'cut', keys: tap('KeyF'), wait: 0.1 },
      { name: 'hit', keys: tap('KeyF', 'KeyF'), until: (G) => !G.foe || G.foe.hp < G.foeHp, timeout: 4, wait: 0.1 },
      { name: 'death', act: (G) => { if (G.foe?.alive) G.foes.hurt(G.foe, 'blade', new THREE.Vector3(0, 0, 1), { damage: 99 }); }, wait: 0.6 },
      { name: 'chimes', act: (G) => { if (G.foe) G.player.teleport(G.foe.pos.clone(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); }, wait: 2.5 },
    ],
  },
  {
    // a makers' temple, the Buried's: in at its door, its first switch lit, a small key, the great key and the guardian's door
    id: 'temple', title: 'A makers\' temple', setup: { level: 'buried', debug: true },
    beats: [
      { name: 'enter', act: (G) => { const a = temple(G, 'buried').arrival, h = a.heading; G.player.teleport(a.pos.clone(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(h), 0, Math.cos(h))); G.player.heading = h; G.rig.yaw = h + Math.PI; }, wait: 2 },
      { name: 'switch', act: (G) => temple(G, 'buried').piece('s1')?.hit('shoot'), wait: 1.2 },
      { name: 'key', act: (G) => { const rt = temple(G, 'buried'); rt.logic.light('arB'); rt.onLit('arB'); rt.applyDoors(); rt.piece('kS')?.openIt(); }, wait: 3 },
      { name: 'door', act: (G) => { const rt = temple(G, 'buried'); rt.logic.light('k3'); rt.logic.moveDrum('bQ', 0); rt.piece('kB')?.openIt(); rt.logic.unlock('d4'); rt.applyDoors(); }, wait: 3 },
    ],
  },
  {
    // a fight temple's run (the Sunken Hall, src/fight-temples): its card, the count, the first wave up from the springs
    id: 'fight-temple', title: 'A fight temple\'s first wave', setup: { level: 'desert', game: 'fight-desert' },
    beats: [
      { name: 'card', wait: 1 },
      { name: 'count', act: padStart, wait: 0.8 },
      { name: 'wave', until: (G) => G.minigame?.session?.run?.phase === 'fight' && G.minigame.session.run.standing >= 1, timeout: 40, wait: 1.5 },
    ],
  },
  { id: 'game-rings', title: 'A minigame: the rings', setup: { level: 'desert', game: 'rings' }, beats: gameBeats('Space') },
  { id: 'game-ski', title: 'A minigame: the ski', setup: { level: 'desert', game: 'ski' }, beats: gameBeats('KeyW') },
  {
    // a conversation with choices: Teo in the desert (src/story/desert-data.js: two pages, then his two answers)
    id: 'talk', title: 'A conversation with choices', setup: { level: 'desert', debug: true },
    beats: [
      { name: 'beside', act: (G) => approach(G, 'teo'), wait: 1.2 },
      { name: 'open', keys: tap('KeyE'), until: (G) => !!G.story?.dialogue?.open, timeout: 5, wait: 1.2 },
      { name: 'page', keys: tap('Space'), wait: 1.2 },
      { name: 'choices', until: (G) => (G.screen().dialogue?.choices?.length ?? 0) > 0, timeout: 6, wait: 0.5 },
      { name: 'answer', keys: tap('Digit1'), wait: 1.5 },
    ],
  },
  {
    // the desert's hoverbike on a new save (issue #421: in Unity it was given at the prologue's end, nothing in the
    // hollow, no quest): under its tarp in Marrow's hollow, the tarp pulled back with E, the errand begun
    id: 'hoverbike', title: 'The hoverbike in its hollow', setup: { level: 'desert' },
    beats: [
      { name: 'hollow', act: (G) => {
        const b = G.player.mount, dir = new THREE.Vector3(1, 0, 0.6).normalize(), p = b.pos.clone().addScaledVector(dir, 3.2);
        G.player.teleport(p, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
        G.player.heading = Math.atan2(b.pos.x - p.x, b.pos.z - p.z); G.rig.yaw = G.player.heading + Math.PI;
      }, wait: 2 },
      { name: 'tarp', keys: tap('KeyE'), wait: 1.6 },
    ],
  },
];

/** The sequence of that id, or null. */
export const sequenceById = (id) => SEQUENCES.find((s) => s.id === id) ?? null;

// ------------------------------------------------------------------ setting a sequence up

/**
 * The page's address for a sequence on the web: its world, and what the page seeds and starts from the address (the
 * cinematics review: the save before that world and the cinematic staged; the prologue; a debug save; a game's page).
 */
export function webQuery(setup) {
  const q = new URLSearchParams({ level: setup.level });
  if (setup.review) { const e = catalogEntry(setup.review); q.set('cinematicReview', setup.review); for (const [k, v] of Object.entries(e?.query ?? {})) q.set(k, v); }
  if (setup.prologue) q.set('prologue', '1');
  if (setup.debug) q.set('debugsave', '1');
  if (setup.game) { q.set('game', setup.game); q.set('from', setup.level); }
  return `?${q}`;
}

/**
 * The engines' side of the same: the save written first (always the debug save's slot, never a player's), then what
 * createGame takes. Called before createGame; `ready(G)` after it, the cinematic staged as the page's review does.
 */
export function engineSetup(setup) {
  slots.setActive(DEBUG_SLOT); gameState.reload(); gameState.reset();
  try { slotStorage.removeItem('hiraeth.journal.v1'); } catch { /* none */ }
  const e = setup.review ? catalogEntry(setup.review) : null;
  if (e) seedReviewEntry(e);
  if (setup.debug) seedDebugSave(setup.level, { slot: DEBUG_SLOT, state: gameState });
  const opts = { levelId: setup.level };
  if (setup.prologue) opts.prologue = true;
  if (e?.query?.via) { opts.via = e.query.via; opts.arrive = true; }
  if (e?.query?.prologue) opts.prologue = true;
  if (setup.fight) opts.fight = true;
  if (setup.game) { opts.game = setup.game; opts.from = setup.level; }
  return opts;
}

/** After the world is up: the review's cinematic staged (the page does it itself from its address: startReview). */
export function engineReady(G, setup) {
  const e = setup.review ? catalogEntry(setup.review) : null;
  if (!e || e.query) return null;
  G.story?.closePage?.();
  return stageCinematic(stageWindow(G), e);
}
/** The page's window as stageCinematic reads it, from the engines' game. */
const stageWindow = (G) => ({ storyRt: G.story, story: G.storyPage, ship: G.ship, boxes: G.boxes, level: G.level, player: G.player, items, THREE, rig: G.rig, camera: G.camera, gadgets: G.gadgets });

// ------------------------------------------------------------------ the game, seen the same way on both sides

/**
 * The web's game as a sequence sees it: the page's globals (src/main.js Object.assign(window, …)), its Start menu
 * (window.menu, src/ui.js SettingsMenu) and its game menu (window.journal.menu, src/game-menu.js GameMenu).
 */
export function webGame(w) {
  return {
    side: 'web', win: w,
    scene: w.scene, camera: w.camera, player: w.player, rig: w.rig, level: w.level, ship: w.ship, boxes: w.boxes,
    story: w.storyRt, storyPage: w.story, npcs: w.npcs, gadgets: w.gadgets, tool: w.tool, foes: w.foes, trials: w.trials, items: w.items, state: gameState,
    get minigame() { return w.minigame ?? null; },
    // (the screen's state, and what the page draws of the fight in its own HTML that the engines send as parts:
    // engine/combat.js 'lock', 'warn', 'restart'; the web's #foe-lock, #foe-warn, #restart)
    screen: () => ({ ...screen.state, lock: w.foes?.lock ? true : screen.state.lock ?? null, warn: w.foes?.warnView?.length ? true : null, restart: w.document.getElementById('restart')?.classList.contains('open') ? true : null,
      foeTab: w.document.getElementById('foe-tab') && !w.document.body.classList.contains('foe-list') ? true : null }),
    // (the recordings' hologram: on the page a scene of its own drawn over the picture, HOLO.render)
    // (what the page draws over the finished picture from scenes of its own: the see-through surfaces' wash and the ways
    // through's light (level.veils), the wind's wisps, the motes, a makers' house's air, the recordings' hologram; the
    // engines hang them all in the mirrored scene: engine/bridge-gaps.js, its passes)
    extraScenes: () => [w.level?.veils?.scene, w.wind?.scene, w.motes?.scene, ...(w.houseAir?.scenes?.() ?? []), HOLO.live() ? HOLO.scene : null].filter(Boolean),
    menu: {
      open(kind, page = null) {
        if (kind === 'start') w.menu.toggle(true, page ?? 'settings');
        else w.journal.toggle(true, page);
      },
      close() { if (w.menu.open) w.menu.toggle(false); if (w.journal.open) w.journal.toggle(false); },
      view() {
        const txt = (el) => clean(el?.textContent);
        if (w.menu.open) {
          const el = w.menu.el, page = w.menu.current;
          const side = [...el.querySelectorAll('.menu-nav button')].filter((b) => !b.hidden).map(txt);
          const rows = [...el.querySelectorAll(`.panel[data-page="${page}"] label.row > span:first-child, .panel[data-page="${page}"] li > span:first-child`)].map(txt);
          return { kind: 'start', page, side, rows };
        }
        if (w.journal.open) {
          const M = w.journal.menu;
          return { kind: 'game', page: M.panel, side: [], rows: (M.rows ?? []).flat().map((c) => clean(c.name ?? '')) };
        }
        return null;
      },
    },
  };
}

/** The engines' game (engine/game.js createGame) as a sequence sees it, with the menus the host made (engine/menus.js). */
export function engineGame(g, menus = null) {
  return {
    side: 'engine', game: g,
    scene: g.scene, camera: g.camera, player: g.player, rig: g.rig, level: g.level, ship: g.ship, boxes: g.boxes,
    story: g.story, storyPage: g.storyPage, npcs: g.npcs, gadgets: g.gadgets, tool: g.tool, foes: g.foes, trials: g.trials, items, state: gameState,
    get minigame() { return g.trials?.runner ?? null; },
    screen: () => { const st = g.screen().state; return { ...st, lock: st.lock ? true : null, warn: st.warn?.length ? true : null, restart: st.restart ? true : null }; },
    extraScenes: () => [],
    menu: {
      open(kind, page = null) {
        if (!menus) return;
        if (kind === 'start') {
          menus.show('start');
          if (page && page !== 'settings') { const i = menus.startSide().findIndex((e) => e.page === page); if (i >= 0) { menus.start.page = page; menus.start.at = { in: 'side', i }; } }
          menus.changed();
        } else menus.show('game', page);
      },
      close() { menus?.close(); },
      view() {
        const v = menus?.view?.();
        if (!v) return null;
        if (v.kind === 'start') return { kind: 'start', page: menus.startPage(), side: v.side.map((s) => clean(s.text)), rows: (v.page?.rows ?? []).map((r) => clean(r.text)) };
        if (v.kind === 'game') return { kind: 'game', page: v.panel, side: [], rows: menus.panel().rows.flat().map((c) => clean(c.name ?? '')) };
        // (a run's card, a shop, the foes' list: the page's own HTML on the web, compared by their screen parts)
        return null;
      },
    },
  };
}

/**
 * A key pressed or let go in the engines as the Unity host's readInput routes the player's (engine/unity/game.js): a
 * menu open takes it; Esc in play opens the Start menu (not over a conversation, a scene, a box, photo mode or a run),
 * J the game menu; else the game's.
 */
export function engineKey(g, menus, code, down) {
  if (!down) { menus?.keyUp?.(code); g.key(code, false); return; }
  if (menus?.open) { menus.key(code); return; }
  if (menus && code === 'Escape' && !g.story?.dialogue?.open && !g.photoOn && !g.scenePlaying && !g.boxPlaying && !g.minigameOn) { menus.show('start'); return; }
  if (menus && code === 'KeyJ' && !g.minigameOn) { menus.show('game'); return; }
  g.key(code, true);
}

// ------------------------------------------------------------------ the runner

/**
 * One sequence played against a game (webGame / engineGame): tick(dt) with the game's seconds since the last tick,
 * once a frame (the engines) or every few frames (the web, from outside). It answers what the side has to do:
 *   { keys: [[code, down], …] }   press or let go (the web through Chrome's input, the engines engineKey)
 *   { record: beat, late }        the beat is here: take the picture and probe(G)
 *   { done: true }                no beats left
 *   null                          nothing this tick
 * A beat runs in this order: act(G) (a dev jump; a promise is waited for), its keys tapped (down, 0.12 s, up, 0.25 s
 * apart), until(G) waited for (timeout s, then recorded `late`), after(G), wait s more, then recorded.
 */
export class SequenceRun {
  constructor(G, seq) { Object.assign(this, { G, seq, i: 0, phase: 'act', t: 0, time: 0, events: [], busy: false, late: false, errors: [] }); G.since = 0; }
  tick(dt) {
    this.time += dt;
    const G = this.G;
    G.since = (G.since ?? 0) + dt;
    const due = this.events.filter((e) => e.at <= this.time);
    if (due.length) { this.events = this.events.filter((e) => e.at > this.time); return { keys: due.map((e) => [e.code, e.down]) }; }
    if (this.busy) return null;
    const b = this.seq.beats[this.i];
    if (!b) return { done: true };
    if (this.phase === 'act') {
      this.phase = 'keys'; this.t = 0; this.late = false;
      const r = this.call(b.act);
      if (r?.then) { this.busy = true; r.then(() => { this.busy = false; }, (e) => { this.errors.push(`${b.name}: ${e?.message ?? e}`); this.busy = false; }); }
      (b.keys ?? []).forEach((code, k) => { this.events.push({ at: this.time + 0.05 + k * 0.25, code, down: true }, { at: this.time + 0.17 + k * 0.25, code, down: false }); });
      for (const [code, down] of Object.entries(b.hold ?? {})) this.events.push({ at: this.time + 0.05, code, down });
      return null;
    }
    if (this.phase === 'keys') { if (!this.events.length) { this.phase = 'until'; this.t = 0; } return null; }
    if (this.phase === 'until') {
      this.t += dt;
      let ok = !b.until;
      if (!ok) { try { ok = !!b.until(G); } catch { ok = false; } }
      if (!ok && this.t < (b.timeout ?? 30)) return null;
      this.late = !ok;
      this.call(b.after);
      this.phase = 'wait'; this.t = 0;
      return null;
    }
    if (this.phase === 'wait') { this.t += dt; if (this.t < (b.wait ?? 0)) return null; this.phase = 'act'; this.i++; G.since = 0; return { record: b, late: this.late }; }
    return null;
  }
  call(f) { if (!f) return null; try { return f(this.G); } catch (e) { this.errors.push(`${this.seq.beats[this.i]?.name}: ${e?.message ?? e}`); return null; } }
}

// ------------------------------------------------------------------ what is on screen, as data

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.!?…)]+$/gu, '').trim();
const r1 = (v) => Math.round(v * 10) / 10;
/** Each screen part as the stream keeps it: what a player reads of it, not its timing (null: just that it shows). */
const PART = {
  prompt: (p) => ({ text: clean(p.text), key: p.key ?? null }),
  cue: (p) => clean(p.text),
  toast: (p) => clean(p.text),
  sub: (p) => ({ who: p.who ?? null, text: clean(p.text) }),
  dialogue: (d) => ({ name: clean(d.name), text: clean(d.text), choices: (d.choices ?? []).map((c) => clean(c.text)) }),
  cine: (c) => ({ bars: !!c.bars, lids: !!c.lids, hud: c.hud !== false, walk: !!c.walk, skip: !!c.skip }),
  boxCard: (b) => ({ name: clean(b.name), card: !!b.card, scene: !!b.scene }),
  charge: (c) => ({ mark: c.mark ?? null, text: clean(c.text) }),
  keys: (k) => ({ small: k.small ?? 0, big: !!k.big }),
  health: (h) => ({ low: !!h.low }),
  gadget: (g) => g.id ?? null,
  carry: (c) => clean(c.name),
};
/** Parts that come and go with timing alone (the stamina wheel's fade, a pad's pick): not compared. */
// (the toast: the engines keep its part, drawn for its secs from when its id came, the page clears it as it fades, and
// queues the next by its own clock; what was toasted is the story's, the same on both sides)
const UNSTEADY = new Set(['choice', 'stamina', 'version', 'toast']);

/** The drawables in view: each visible mesh within `far` m of the camera and in its frustum, by the port's kind of its material. */
function objectKinds(G, far = 120) {
  const cam = G.camera, kinds = {};
  cam.updateMatrixWorld();
  const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const at = cam.getWorldPosition(new THREE.Vector3()), s = new THREE.Sphere(), seen = new Map();
  const kindOf = (m) => {
    if (seen.has(m)) return seen.get(m);
    let k;
    try { const spec = inkSpec(m), p = portMaterial(spec, 0); k = p.port ?? (spec.type === 'other' ? `three:${spec.three}` : spec.type); } catch { k = 'unknown'; }
    seen.set(m, k);
    return k;
  };
  for (const root of [G.scene, ...G.extraScenes()]) {
    root?.traverseVisible?.((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
      const g = o.geometry;
      if (g && !o.isInstancedMesh && !o.isSkinnedMesh) {
        if (!g.boundingSphere) { try { g.computeBoundingSphere(); } catch { return; } }
        if (g.boundingSphere) {
          s.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
          if (s.center.distanceTo(at) - s.radius > far || !fr.intersectsSphere(s)) return;
        }
      }
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && m.visible !== false) { const k = kindOf(m); kinds[k] = (kinds[k] ?? 0) + 1; }
    });
  }
  return kinds;
}

/**
 * What the screen shows at a beat, as data: the HUD's parts (src/platform.js screen) and what each says, the menu open
 * and its rows, what plays (the prologue's stage, a moment, a ship's scene, a box), the drawables in view by the port's
 * kind of their material, the camera and the traveller.
 */
export function probe(G) {
  const S = G.screen(), hud = {};
  for (const [k, v] of Object.entries(S)) {
    if (v == null || UNSTEADY.has(k)) continue;
    // (a region's name: it fades in and out by the game's clock as he walks, the page's and the engines' a little apart)
    if (k === 'cue' && v.kind === 'place') continue;
    try { hud[k] = PART[k] ? PART[k](v) : true; } catch { hud[k] = true; }
  }
  const c = G.camera, p = G.player?.pos;
  const play = playing(G);
  let menu = null;
  try { menu = G.menu.view(); } catch { menu = null; }
  return {
    hud, menu,
    playing: play ? { what: play.what, stage: play.stage ?? null } : null,
    objects: objectKinds(G),
    cam: c ? [...c.getWorldPosition(new THREE.Vector3()).toArray().map(r1), r1(c.fov ?? 0)] : null,
    player: p ? p.toArray().map(r1) : null,
  };
}

// ------------------------------------------------------------------ the two streams against each other

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Kinds that follow the camera (the dust motes, the wind's wisps: one cloud each, in view or culled by a hair): not compared. */
const AMBIENT = new Set(['mote', 'wisp']);
/** How far apart the camera and the traveller may be (m) before it is a difference: the two clocks differ a little. */
export const TOLERANCE = { cam: 3, fov: 4, player: 2.5 };

/**
 * One beat's records against each other → the differences, each { key, web, engine }:
 *   part-:<name> / part+:<name>   a HUD part shown on the web only / in the engines only
 *   part~:<name>                  shown on both, saying different things
 *   menu, menu.side, menu.rows    another menu or page open / its sidebar / its rows
 *   playing                       another cinematic or stage playing
 *   obj-:<kind> / obj+:<kind>     drawables of that port kind in view on the web only / in the engines only
 *   cam, cam.fov, player          the camera or the traveller further apart than TOLERANCE
 *   late                          the beat's condition never came on one side (recorded at its timeout)
 */
/**
 * The parts of a beat's HUD that show (src/hud-shows.js, the one table the page's CSS and BridgeHud follow): a part set
 * but hidden (a bark under a conversation, the cue under the letterbox) is not on screen on either side.
 */
export function shownHud(hud) {
  const c = hud.cine && typeof hud.cine === 'object' ? hud.cine : null, walk = !!c?.walk;
  const on = { talking: 'dialogue' in hud, bars: !!c?.bars && !walk, hudOff: !!c && c.hud === false && !walk, minigame: 'minigame' in hud };
  const out = { ...hud };
  for (const [state, parts] of Object.entries(HUD_HIDES)) if (on[state]) for (const p of parts) delete out[p];
  // (people's barks come when chance has them say something: the page's and the engines' never at the same moment)
  delete out.balloons;
  return out;
}

export function compareBeat(web, eng) {
  web = { ...web, hud: shownHud(web.hud) }; eng = { ...eng, hud: shownHud(eng.hud) };
  const out = [], add = (key, a, b) => out.push({ key, web: a ?? null, engine: b ?? null });
  // (the hold-to-skip tag shows for a while after a press, by the wall's clock: kept in the stream, not compared)
  const steady = (k, v) => (k === 'cine' && v ? { ...v, skip: undefined } : v);
  for (const k of new Set([...Object.keys(web.hud), ...Object.keys(eng.hud)])) {
    if (!(k in eng.hud)) add(`part-:${k}`, web.hud[k], null);
    else if (!(k in web.hud)) add(`part+:${k}`, null, eng.hud[k]);
    else if (!same(steady(k, web.hud[k]), steady(k, eng.hud[k]))) add(`part~:${k}`, web.hud[k], eng.hud[k]);
  }
  const wm = web.menu, em = eng.menu;
  if (!!wm !== !!em || (wm && (wm.kind !== em.kind || wm.page !== em.page))) add('menu', wm && `${wm.kind}:${wm.page}`, em && `${em.kind}:${em.page}`);
  else if (wm) {
    if (!same(wm.side, em.side)) add('menu.side', wm.side, em.side);
    if (!same(wm.rows, em.rows)) add('menu.rows', wm.rows, em.rows);
  }
  if (!!web.late !== !!eng.late) add('late', !!web.late, !!eng.late);
  if (!same(web.playing, eng.playing)) add('playing', web.playing, eng.playing);
  for (const k of new Set([...Object.keys(web.objects), ...Object.keys(eng.objects)])) {
    if (AMBIENT.has(k)) continue;
    if (!eng.objects[k]) add(`obj-:${k}`, web.objects[k], 0);
    else if (!web.objects[k]) add(`obj+:${k}`, 0, eng.objects[k]);
  }
  if (web.cam && eng.cam) {
    if (dist(web.cam, eng.cam) > TOLERANCE.cam) add('cam', web.cam.slice(0, 3), eng.cam.slice(0, 3));
    if (Math.abs(web.cam[3] - eng.cam[3]) > TOLERANCE.fov) add('cam.fov', web.cam[3], eng.cam[3]);
  }
  if (web.player && eng.player && dist(web.player, eng.player) > TOLERANCE.player) add('player', web.player, eng.player);
  return out;
}

/**
 * Two streams ({ <sequence id>: { beats: [{ beat, …probe }] } }) against each other → every difference
 * { seq, beat, key, web, engine }; a beat on one side only is `beat-missing`.
 */
export function compareStreams(web, eng, { only = null } = {}) {
  const out = [];
  for (const id of new Set([...Object.keys(web), ...Object.keys(eng)])) {
    if (only && !only.includes(id)) continue;
    const W = web[id]?.beats ?? [], E = eng[id]?.beats ?? [];
    for (const name of new Set([...W.map((b) => b.beat), ...E.map((b) => b.beat)])) {
      const a = W.find((b) => b.beat === name), b = E.find((x) => x.beat === name);
      if (!a || !b) { out.push({ seq: id, beat: name, key: 'beat-missing', web: !!a, engine: !!b }); continue; }
      for (const d of compareBeat(a, b)) out.push({ seq: id, beat: name, ...d });
    }
  }
  return out;
}

/** A list's pattern: `*` any run, `a|b` either. */
export const glob = (p) => new RegExp(`^(?:${String(p).split('|').map((alt) => alt.split('*').map((x) => x.replace(/[.+?^$()|[\]\\{}]/g, '\\$&')).join('.*')).join('|')})$`);
/** The entry of a list (engine/bridge-gaps.js STREAM_DIFFS) that names a difference, or null. */
export function listedDiff(list, d) {
  return list.find((e) => glob(e.seq ?? '*').test(d.seq) && glob(e.beat ?? '*').test(d.beat) && (e.keys ?? []).some((k) => glob(k).test(d.key))) ?? null;
}
