// The menus for an engine (docs/systems/engine-bridge.md, "The menus"): the title, the Start menu and the game menu,
// as the web game has them (src/title.js, src/ui.js SettingsMenu, src/game-menu.js), as plain state an engine draws
// (the Unity bridge: BridgeMenu.cs). The web's are pages of buttons; here the same entries, in the same order, moved
// through by the same rules:
//   - the title: Continue (the save played last) or New game, Saves, Settings; Saves lists the three slots (X / □
//     deletes, asked first), Back, and the folded Debug row (src/title.js debugSavesHtml, issue #227): opened, the slot
//     it writes and every world of the route (src/debug-save.js seedDebugSave);
//   - the Start menu (Menu / Esc): a sidebar (Resume, Items, Quests, Map, Settings, Controls, Quit to title) and its
//     page, left / right between them and up / down round each (src/menu-pad.js sideStep, issue #210), a slider's
//     left / right its value, B / ○ in the page back to the sidebar first; inside a makers' house, House map after Map
//     (issue #405, src/house-map.js): its page the floor drawn (a picture by its key, sent as the Map's are), LB / RB a floor;
//   - the dev menu (L3 + R3, F2, `; issue #387): src/dev-menu.js DevMenu's tabs and acts, drawn as the game menu's sheet
//     (kind 'game', panel 'dev'), LB / RB (◀ ▶) a tab, up / down its rows, A / × the row;
//   - the game menu (View / Select, J): its five panels (src/game-menu.js PANELS, MenuState, the panels' own rows from
//     itemsPanel, questsPanel, mapPanel, worldsPanel, peoplePanel), turned with LB / RB, the cursor's moves and the
//     side tabs as there (moveCursor), A / × a thing's full view, a quest tracked, a person's page.
// The engine hands it the controller's menu actions (src/controller.js, context 'menu': confirm, back, tabPrev,
// tabNext, start, select, x) and directions, or keys; `view()` is what to draw, its `v` moving when it changes.
//
//   const menus = new EngineMenus({ store: slots, settings, onStart, onResume, onQuit, onTravel });
//   menus.open('title'); menus.action('confirm'); menus.navigate(0, 1); menus.view();

import { slots as defaultStore, SLOT_COUNT, DEBUG_SLOT, formatPlaytime, formatDate, progressLine } from '../src/save-slots.js';
import { ORDER, TITLES } from '../src/levels/names.js';
import { t } from '../src/i18n.js';
import { MenuState, PANELS, DEFAULT_PANEL, ACT, itemsPanel, questsPanel, worldsPanel, peoplePanel, mapPanel, worldFacts, CARRY_COL, GEAR_COLS, PEOPLE_COLS, KIND_MARK } from '../src/game-menu.js';
import { sideStep } from '../src/menu-pad.js';
import { controlsList, REBIND_PAD, REBIND_KEYS, PAD_RAW_ROWS, TEXT_SIZES, reducedMotion } from '../src/ui.js';
import { PAD_VERBS, BUTTON_NAME, KEYS } from '../src/bindings.js';
import { padFor, padConflicts, padRename, capturePad, keyFor, keyLabel, keyConflicts, captureKey, RESERVED_KEYS, RUN_MODES, GUARD_MODES } from '../src/remap.js';
import { CHANGELOG, lineText, newestFirst } from '../src/changelog.js';
import { confirmKey, backKey } from '../src/native-pad.js';
import { stockText, stateText } from '../src/shop-panel.js';
import { stripTone } from '../src/story/tone.js';
import { MapView, VIEW, mapAspect } from '../src/world-map.js';
import { chooseShot } from '../src/title-shots.js';
import { titleLayout } from '../src/title-layout.js';
import { MUSIC_MODES, musicMode } from '../src/music-moments.js';
import { tabWindow } from '../src/world-debug.js';
import { TAB_STRIP, verb } from '../src/dev-menu.js';
import { drawHouseMap, HouseMapPage, HOUSE_MAP } from '../src/house-map.js';
import { PixelCanvas } from './raster.js';

/** The slot after `into` for the debug saves: the debug slot, then the player's 1..count, round again (src/title.js). */
export const nextInto = (into, count = SLOT_COUNT) => (into === DEBUG_SLOT ? 1 : into >= count ? DEBUG_SLOT : into + 1);

/** A label of the web's split at its first " (": the words, and what is in the brackets (the row's note under it). */
const head = (k) => () => t(k).replace(/ \(.*$/, '');
const aside = (k) => () => t(k).match(/ \((.*)\)$/)?.[1] ?? '';
/**
 * The settings an engine's Start menu and title show (src/ui.js SettingsMenu's, those the engines carry out): a slider
 * (min, max, step), a switch, or a choice (opts); `value(settings)` where the page shows something else than the saved
 * value (reduced motion unset: as the system asks), `note` under the row while the pad is on it. Graphics applies at the
 * next start (the engine's preset is read at launch). The web's Language is left out (no other language for now), and
 * its rows the engines don't carry (the foes, the drone's hints, the developer's).
 */
export const SETTINGS_ROWS = [
  { k: 'music', label: () => t('set.music'), kind: 'range', min: 0, max: 1, step: 0.05 },
  // (when the recorded theme plays: for the moments, or all the time; src/music-moments.js, Unity playing the recordings)
  { k: 'musicMode', label: () => t('set.musicMode'), kind: 'choice', opts: MUSIC_MODES, name: (v) => t(`set.musicMode.${musicMode(v)}`).replace(/ \(.*$/, ''), note: () => `Moments: ${t('set.musicMode.moments').match(/\((.*)\)/)?.[1] ?? ''}` },
  { k: 'effects', label: () => t('set.effects'), kind: 'range', min: 0, max: 1, step: 0.05 },
  { k: 'voices', label: () => t('set.voices'), kind: 'range', min: 0, max: 1, step: 0.05 },
  { k: 'mute', label: () => t('set.mute').replace(/ \(M\)$/, ''), kind: 'switch' },
  { k: 'sensitivity', label: () => t('set.sensitivity'), kind: 'range', min: 0.3, max: 3, step: 0.05 },
  { k: 'invertY', label: () => t('set.invertY'), kind: 'switch' },
  // (no hit-stop, slow motion or camera kicks: src/feel.js, through applyAccess; issue #346)
  { k: 'reduceMotion', label: head('set.reduceMotion'), note: aside('set.reduceMotion'), kind: 'switch', value: (s) => reducedMotion(s) },
  { k: 'shake', label: () => t('set.shake'), kind: 'range', min: 0, max: 1, step: 0.05 },
  // (where the printed A B X Y are: the Retroid's own "Xbox style" swaps them, src/native-pad.js setFaces)
  { k: 'padFaces', label: () => t('set.padFaces'), kind: 'choice', opts: ['auto', 'xbox', 'nintendo', 'nintendo-xbox'], name: (v) => t(`set.padFaces.${v ?? 'auto'}`) },
  // (the pad's motors: src/rumble.js, the engine's pad through BridgeHost.Rumble)
  { k: 'rumble', label: () => t('set.rumble'), kind: 'switch' },
  { k: 'rumbleLevel', label: () => t('set.rumbleLevel'), kind: 'choice', opts: ['low', 'medium', 'high'], name: (v) => t(`set.rumbleLevel.${v ?? 'medium'}`) },
  { k: 'hints', label: () => t('set.hints').replace(/ \(.*$/, ''), kind: 'choice', opts: ['off', 'subtle', 'full'], name: (v) => t(`set.hints.${v}`) },
  // (Auto: the device's own preset, BridgeArgs.Quality: Steam Deck on the Deck's player, Handheld on Android, High elsewhere;
  // the Steam Deck's preset as on the web's Deck app; the Unity-default plan's D7)
  { k: 'quality', label: () => t('set.quality'), kind: 'choice', opts: ['auto', 'handheld', 'deck', 'low', 'medium', 'high'], name: (v) => (v === 'auto' ? 'Auto (this device’s own)' : t(`set.quality.${v}`)), note: 'from the next start' },
  // (the words on the screen, a solid plain background behind speech, the frame readout: BridgeHud, issue #346)
  { k: 'textSize', label: head('set.textSize'), note: () => `${aside('set.textSize')()}`.replace(/, menus$/, ''), kind: 'choice', opts: Object.keys(TEXT_SIZES), name: (v) => t(`set.textSize.${v ?? 'normal'}`) },
  { k: 'speechBg', label: () => t('set.speechBg'), kind: 'switch' },
  { k: 'showFps', label: head('set.showFps'), kind: 'switch' },
];

/** A setting's value as the page shows it. */
export function settingText(row, v) {
  if (row.kind === 'switch') return v ? 'On' : 'Off';
  if (row.kind === 'choice') return row.name ? row.name(v) : String(v);
  if (row.k === 'sensitivity') return `${Number(v).toFixed(2)}×`;
  return `${Math.round(Number(v) * 100)} %`;
}

/** A setting moved one step (dir ±1): a slider's step, a switch flipped, the next or the one before of a choice. */
export function settingStep(row, v, dir) {
  if (row.kind === 'switch') return !v;
  if (row.kind === 'choice') { const i = Math.max(0, row.opts.indexOf(v)); return row.opts[(i + dir + row.opts.length) % row.opts.length]; }
  const n = Math.round((Number(v) + dir * row.step) / row.step) * row.step;
  return +Math.min(row.max, Math.max(row.min, n)).toFixed(3);
}

/** The Start menu's sidebar: its entries and what each does (src/ui.js SettingsMenu render, in the game; photo mode issue #264). */
export const START_SIDE = [
  { id: 'resume', label: () => t('menu.resume') },
  { id: 'items', label: () => t('menu.items'), panel: 'items' },
  { id: 'quests', label: () => t('menu.quests'), panel: 'quests' },
  { id: 'map', label: () => t('menu.map'), panel: 'map' },
  { id: 'settings', label: () => t('menu.settings'), page: 'settings' },
  { id: 'controls', label: () => t('menu.controls'), page: 'controls' },
  { id: 'photo', label: () => t('menu.photo') },
  { id: 'news', label: () => t('menu.news'), page: 'news' },
  { id: 'quit', label: () => t('menu.quit') },
];

/**
 * The Updates entry, before Quit to title, in a player that updates its script over the air (the Unity players:
 * engine/unity/updates.js, BridgeUpdates.cs; the Unity-default plan's D13). The title has it too, under Settings.
 */
export const UPDATES_SIDE = { id: 'updates', label: () => 'Updates', page: 'updates' };
/** The House map entry, after Map, only inside a makers' house (issue #405, src/house-map.js; src/ui.js has it too). */
export const HOUSE_SIDE = { id: 'house', label: () => t('menu.house'), page: 'house' };

/** The Controls page's own choices over the rebinding (src/ui.js: run and guard held or toggled). */
export const CONTROL_ROWS = [
  { k: 'run', label: () => t('set.run'), kind: 'choice', opts: RUN_MODES, name: (v) => t(`set.run.${v ?? 'auto'}`) },
  { k: 'guard', label: () => t('set.guard'), kind: 'choice', opts: GUARD_MODES, name: (v) => t(`set.guard.${v ?? 'hold'}`) },
];
/** How many versions What's new lists (the newest first, as the web's changelog panel; the rest on the web's page). */
export const NEWS_VERSIONS = 4;
const verbName = (v, kind = 'pad') => { const k = `verb.${v}.${kind}`, s = t(k); return s === k ? t(`verb.${v}`) : s; };
/** Is the keyboard in hand (the body's 'controller' class unset, as engine/game.js's InputMode keeps it; none: the pad)? */
const keysInHand = () => { const b = globalThis.document?.body?.classList; return !!b && !b.contains?.('controller'); };

const BUILDERS = { items: itemsPanel, quests: questsPanel, map: mapPanel, worlds: worldsPanel, people: peoplePanel };
/** Each panel's columns across the sheet, as the page lays them out (the cells' `col`; a cell's `span` columns wide). */
const COLS = { quests: [0.64, 0.36], items: Array(GEAR_COLS).fill(1 / GEAR_COLS),   // (the items': as many as fit, itemGrid)
  worlds: [1], people: Array(PEOPLE_COLS).fill(1 / PEOPLE_COLS), map: [1] };
/** A menu's prompt with its confirm (written "A / ×") and back ("B / ○") as the pad in hand has them (native-pad.js). */
export const menuKeys = (s) => {
  const ok = confirmKey(), back = backKey();
  return ok === 'A / ×' ? s : String(s ?? '').replace(/A \/ ×|B \/ ○/g, (k) => (k === 'A / ×' ? ok : back));
};
/** The cells that carry a thing's picture (the Items panel's gear, what you carry, the keepsakes). */
const PICTURED = new Set(['item', 'pack', 'keepsake']);
const plain = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export class EngineMenus {
  /**
   * @param o.store     the save slots (src/save-slots.js slots)
   * @param o.settings  src/ui.js Settings (its values, set(k, v)); null: no settings page
   * @param o.sources   the game menu's panels (src/game-menu-data.js menuSources), once the game runs
   * @param o.dev       whether the debug saves show (src/dev-gate.js devMode)
   * @param o.onStart   ({ slot, fresh } | { debug, slot }) the title's choice
   * @param o.onResume  () the Start menu or the game menu closed
   * @param o.onQuit    () Quit to title chosen (the engine saves, then shows the title)
   * @param o.onPhoto   () Photo mode chosen (the menu closed first)
   * @param o.onTravel  (id) → null | a line why not (the Worlds page's Travel here)
   * @param o.onUse, o.onTrack  an item used, a quest tracked (the game menu's)
   * @param o.where     () → the Start menu's heading: the world you are in
   * @param o.itemCols  () → how many of the Items panel's tiles fit a row on the engine's screen (the web's grid fits
   *                    as many as its tile's size allows: src/game-menu.css --tile); GEAR_COLS without one
   * @param o.mapBox    () → { w, h }: the room the engine's sheet has for the Map (its units), so the map is drawn as
   *                    wide as it (issue #272, src/world-map.js mapAspect); null: a square
   * @param o.screen    () → { w, h }: the engine's canvas for the menus (its units), the title laid out on it as the
   *                    web's on the page (src/title-layout.js)
   * @param o.shots     (o) → the title's shot (src/title-shots.js chooseShot): a different world each opening
   * @param o.saveLine  () → the line under the Start menu's heading: the save, the world, the time played
   * @param o.updates   the player's script updates (engine/unity/updates.js UnityUpdates: rows(), act(a), tick()); null: none
   */
  constructor({ store = defaultStore, settings = null, sources = null, dev = () => true, order = ORDER, onStart = () => {}, onResume = () => {}, onQuit = () => {}, onTravel = () => null, onUse = () => {}, onTrack = () => {}, onSetting = () => {}, onPhoto = () => {}, where = () => '', version = '', itemCols = () => GEAR_COLS, mapBox = () => null, screen = () => ({ w: 1280, h: 720 }), shots = (o) => chooseShot(o), saveLine = () => '', updates = null, house = () => null } = {}) {
    Object.assign(this, { store, settings, sources, dev, order, onStart, onResume, onQuit, onTravel, onUse, onTrack, onSetting, onPhoto, where, version, itemCols, mapBox, screen, shots, saveLine, updates, house });
    // the House map (issue #405): the house's view as the Start menu opened (house(): src/house-map.js houseView, or null
    // outside a house), the floor chosen, and its drawn floors by key (engine/raster.js: the engine shows them as the Map's)
    this.hv = null;
    this.housePage = new HouseMapPage();
    this.housePics = new Map();
    this.houseN = 0;
    this.mode = null;            // null | 'title' | 'start' | 'game' | 'shop' | 'card' | 'starmap' | 'foes' | 'dev'
    this.v = 0;
    this.title = { screen: 'main', i: 0, debugOpen: false, into: DEBUG_SLOT, ask: null, starting: null };
    this.start = { at: { in: 'side', i: 0 }, page: 'settings', back: -1 };
    this.state = new MenuState(PANELS);
    this.full = null;            // the game menu's full view: { cell, list, k }
    this.person = null;          // the People panel's open page
    this.zoom = null;            // the Map's mark zoomed on (none now: the cursor zooms, issue #343)
    // the Map's view (src/world-map.js MapView, issue #244 on the web, #343 here): a cursor the left stick or the D-pad
    // moves over the whole sheet, zoomed in and out round it (the triggers, A / ×), the mark under it named beside it
    this.mapView = new MapView();
    this.mapFresh = true;        // (opened or turned to: the whole map, the cursor on the traveller)
    this.mapMoved = 0;           // (when the view last moved: a zoomed part is drawn again sharper once it rests)
    this.mapDetail = null;       // (the part asked for)
    this.note = '';
  }

  get open() { return !!this.mode; }
  changed() { this.v++; }

  /** Open a menu: 'title', 'start', or 'game' (on a panel). */
  show(mode, panel = null) {
    this.mode = mode;
    this.note = '';
    if (mode === 'title') {
      Object.assign(this.title, { screen: 'main', i: 0, ask: null, debugOpen: false, starting: null });
      // the painted world behind it (src/title-paint.js: one of the covers' shots, never the one shown last; the
      // engine's picture of its drawing, StreamingAssets/hiraeth-js/title/<id>.jpg), chosen once a showing
      let shot = null;
      try { shot = this.shots({ storage: globalThis.localStorage ?? null, saves: this.store.list?.() ?? [] }); } catch (e) { console.warn(`[menus] the title's shot: ${e?.message ?? e}`); }
      this.title.shot = shot ? { id: shot.id, menu: shot.menu ?? 'low' } : null;
    }
    if (mode === 'start') {
      this.start = { at: { in: 'side', i: 0 }, page: 'settings', back: -1 };
      try { this.hv = this.house?.() ?? null; } catch (e) { this.hv = null; console.warn(`[menus] the house's map: ${e?.message ?? e}`); }
      this.housePage.reset(this.hv);
    }
    if (mode === 'game') { this.state.show(panel ?? DEFAULT_PANEL); this.full = null; this.person = null; this.zoom = null; this.mapFresh = true; this.startAt(); }
    this.changed();
  }
  close() {
    if (!this.mode) return;
    this.stopRebind?.();
    if (this.mode === 'shop') this.shop?.panel?.close?.();
    const star = this.mode === 'starmap' ? this.star : null, dev = this.mode === 'dev' ? this.dev : null;
    this.mode = null; this.shop = null; this.card = null; this.foes = null; this.star = null; this.dev = null; this.arcade = null;
    star?.close();
    if (dev?.open) dev.toggle(false);
    this.changed(); this.onResume();
  }

  // ------------------------------------------------------------------ the galactic map

  /**
   * The holo table's galactic map (engine/starmap.js EngineStarMap: the web's StarMap and its signature search): its
   * world chosen with the D-pad (or the arrows), the scanner moved by the left stick (or W A S D), A / × travel (asked
   * first), B / ○ no, then close. Its view is the map's own (kind 'starmap').
   */
  openStarMap(map) {
    if (!map) return false;
    this.star = map;
    map.onClose = () => { if (this.mode === 'starmap') { this.star = null; this.mode = null; this.changed(); this.onResume(); } };
    map.open();
    this.mode = 'starmap';
    this.starV = map.cv;
    this.changed();
    return true;
  }
  /** Each frame with the map open: the search (the stick the controller handed over this frame, W A S D held). */
  starFrame(dt) {
    if (this.mode !== 'starmap' || !this.star) return;
    const moved = this.star.update(dt, this.starStick);
    this.starStick = null;
    if (moved || this.star.cv !== this.starV) { this.starV = this.star.cv; this.changed(); }
  }
  /** A key let go (W A S D held for the search). */
  keyUp(code) { if (this.mode === 'starmap') this.star?.keyUp(code); }

  // ------------------------------------------------------------------ a game's card

  /**
   * A minigame's or a trial's card (src/minigames/kit/runner.js cardModel: the start card, the pause, the results;
   * docs/systems/engine-bridge.md "The trials and games"): its options' rows and its buttons, up and down (and left and
   * right along the buttons), left / right an option's value; A / × the button picked (or the option on), B / ○ the
   * runner's back, Menu its start (the intro starts, the results retry, the pause resumes), LB / RB its links (the
   * Arcade's other games); Enter the main button, R Retry, as the page's keys. `runner`: the MinigameRunner; the card is
   * left open while the runner has one up (engine/trials.js keeps them in step).
   */
  openCard(runner) {
    this.card = { runner, v: -1, i: 0 };
    this.mode = 'card';
    this.cardSync();
    this.changed();
  }
  /** The runner's card moved on (redrawn, or another one up): the pick on its main button again. */
  cardSync() {
    const C = this.card, M = C?.runner?.cardModel;
    if (!M || C.v === C.runner.cardV) return;
    C.v = C.runner.cardV;
    const items = this.cardItems(M);
    const keep = C.keep && items.findIndex((x) => x.key === C.keep);
    C.keep = null;
    C.i = keep >= 0 ? keep : Math.max(0, items.findIndex((x) => x.main));
    this.changed();
  }
  /** What the pad goes through on a card: its options, then its buttons. */
  cardItems(M) {
    return [...(M.options ?? []).map((o) => ({ opt: o.id, key: `opt:${o.id}` })), ...(M.buttons ?? []).map((b) => ({ act: b.act, main: !!b.main, key: `act:${b.act}` }))];
  }
  cardMove(x, y) {
    const C = this.card, M = C.runner.cardModel;
    if (!M) return;
    const items = this.cardItems(M), it = items[C.i];
    if (it?.opt && x) { C.keep = it.key; C.runner.stepCardOption(it.opt, Math.sign(x)); this.cardSync(); return; }
    const d = y || x;
    if (d) C.i = Math.max(0, Math.min(items.length - 1, C.i + Math.sign(d)));
  }
  cardAction(name) {
    const R = this.card.runner, M = R.cardModel;
    if (!M) return;
    const it = this.cardItems(M)[this.card.i];
    if (name === 'confirm') { if (it?.opt) { this.card.keep = it.key; R.stepCardOption(it.opt, 1); } else if (it?.act) R.act(it.act); }
    else if (name === 'back' || name === 'start' || name === 'tabPrev' || name === 'tabNext') R.padAction(name);
    this.cardSync();
  }
  /** The card's keys (the page's runner.key): Enter its main button, Space the one picked, R Retry, Esc back, [ ] the links. */
  cardKey(code) {
    const R = this.card.runner, M = R.cardModel;
    if (!M) return true;
    if (code === 'Enter' || code === 'NumpadEnter') { const main = (M.buttons ?? []).find((b) => b.main); if (main) R.act(main.act); }
    else if (code === 'Space') this.cardAction('confirm');
    else if (code === 'Escape' || code === 'KeyO' || code === 'Backspace') R.padAction('back');
    else if (code === 'KeyR' && M.kind !== 'intro') R.act('retry');
    else if (code === 'BracketLeft' || code === 'BracketRight') R.padAction(code === 'BracketLeft' ? 'tabPrev' : 'tabNext');
    else return false;
    this.cardSync();
    return true;
  }
  /**
   * The card to draw (BridgeMenu.cs DrawCard): the runner's model, the options' rows and the buttons each with `on` where
   * the pad is.
   */
  cardView() {
    const C = this.card, M = C.runner.cardModel ?? {};
    const items = this.cardItems(M), at = items[C.i]?.key;
    return { v: this.v, kind: 'card', hint: '', card: { ...M, options: (M.options ?? []).map((o) => ({ ...o, on: at === `opt:${o.id}` })), buttons: (M.buttons ?? []).map((b) => ({ ...b, on: at === `act:${b.act}` })) } };
  }

  // ------------------------------------------------------------------ a shop

  /**
   * A shop's sheet (issue #264): the web's ShopPanel (src/shop-panel.js) keeps its logic, the keeper's lines and the
   * question; here its wares are a list the pad goes down, A / × on one asks (or the keeper says why not), A / × on Buy
   * buys, B / ○ backs out of the question, then out of the shop. Anselm's aboard (his upgrades for fragments) and every
   * keeper's (chimes).
   */
  openShop(panel, entry) {
    if (!panel?.open?.(entry)) return false;
    const wares = panel.view().wares;
    this.shop = { panel, i: Math.max(0, wares.findIndex((w) => w.state === 'ok')), on: 1 };
    this.mode = 'shop';
    this.changed();
    return true;
  }
  shopMove(x, y) {
    const S = this.shop, P = S.panel;
    if (P.ask) { if (x) S.on = x > 0 ? 1 : 0; return; }
    const n = P.view().wares.length, d = y || x;
    if (n && d) S.i = Math.max(0, Math.min(n - 1, S.i + Math.sign(d)));
  }
  shopAction(name) {
    const S = this.shop, P = S.panel;
    if (name === 'back') { if (P.ask) P.back(); else this.close(); return; }
    if (name !== 'confirm') return;
    if (P.ask) { if (S.on === 1) P.buy(); else P.back(); return; }
    const w = P.view().wares[S.i];
    if (w) { P.pick(w.id); S.on = 1; }
  }
  shopView() {
    const S = this.shop, v = S.panel.view(), frag = v.money?.cls === 'fragments';
    const rows = v.wares.map((w, i) => {
      const { left, have } = w.note === undefined ? stockText(w) : {};
      const flag = w.flag ?? stateText(w.state), stock = w.note === undefined ? [left, have].filter(Boolean).join(' · ') : w.note;
      const price = w.state === 'soldout' || w.state === 'owned' ? '' : `${w.price} ${frag ? '✦' : '◆'}`;
      return { id: w.id, text: w.name ?? t(`shop.${w.id}.name`), sub: [plain(w.effect ?? t(`shop.${w.id}.effect`)), stock].filter(Boolean).join('\n'), val: [price, flag].filter(Boolean).join('  '),
        state: w.state, ok: w.state === 'ok', on: i === S.i, pic: frag ? w.id : '', mark: frag ? '✦' : w.kind === 'potion' ? '◒' : w.kind === 'heart' ? '♥' : '◆' };
    });
    const asked = v.ask ? v.wares.find((w) => w.id === v.ask) : null;
    return { v: this.v, kind: 'shop', head: v.keeper?.name ?? '', sub: v.keeper?.title ?? '', line: plain(stripTone(v.line ?? '')),
      wallet: `${v.wallet} ${frag ? '✦' : '◆'}`, money: v.money?.title ?? '', rows,
      ask: asked ? { q: plain(v.money.ask(asked)), what: '', undone: '', no: t('shop.no'), yes: t('shop.yes'), on: S.on } : null,
      hint: asked ? '◀ ▶ choose · A / × answer · B / ○ not now' : 'A / × buy · B / ○ leave' };
  }

  // ------------------------------------------------------------------ the Arena's foes

  /**
   * The Arena's list of foes (issue #264): the web's FoeList (src/foe-spawner.js, the level's quick menu) keeps what is
   * in it and what a choice does (choose: a foe practised, a world's waves, a guardian called into its ring, the waves
   * again, the field cleared); here its page is a sheet of rows the pad goes over as the page's buttons (left / right the
   * row before / after, up / down the one above / below), LB / RB the world filter, A / × fights, B / ○ closes.
   */
  openFoes(list) {
    if (!list?.shown) return false;
    this.foes = { list, i: 0 };
    this.mode = 'foes';
    this.changed();
    return true;
  }
  /** The list as its rows, `cols` across (a section's heading and its "Waves from here", its foes, then the two at the foot). */
  foesRows() {
    const L = this.foes.list, cols = (this.screen?.()?.w ?? 1280) < 1100 ? 2 : 3, rows = [];
    for (const s of L.shown()) {
      const headRow = [{ kind: 'head', text: s.title, col: 0, span: s.waves ? cols - 1 : cols }];
      if (s.waves) headRow.push({ kind: 'waves', text: 'Waves from here', act: { waves: s.id }, col: cols - 1 });
      rows.push(headRow);
      for (let k = 0; k < s.items.length; k += cols) {
        rows.push(s.items.slice(k, k + cols).map((it, j) => ({ kind: 'foe', text: it.name, sub: it.sub, act: it.guardian ? { guardian: it.guardian } : { kind: it.kind }, col: j })));
      }
    }
    rows.push([{ kind: 'foot', text: 'Waves again', act: { waves: null }, col: 0 }, { kind: 'foot', text: 'Clear the field', act: { clear: true }, col: 1 }]);
    // (the rows the pad can be on, in order: what left / right steps through)
    const items = [];
    rows.forEach((row, r) => row.forEach((c, k) => { if (c.act) items.push({ r, k, c }); }));
    return { rows, items, cols };
  }
  foesMove(x, y) {
    const F = this.foes, { items } = this.foesRows(), n = items.length;
    if (!n) return;
    const at = Math.min(F.i, n - 1);
    if (!y) { F.i = Math.max(0, Math.min(n - 1, at + Math.sign(x))); return; }
    // the nearest row in the next line down (or up), by its column
    const me = items[at], col = me.c.col;
    let best = -1, bestD = Infinity;
    items.forEach((it, j) => {
      const dr = (it.r - me.r) * Math.sign(y);
      if (dr <= 0) return;
      const d = dr * 4 + Math.abs(it.c.col - col);
      if (d < bestD) { bestD = d; best = j; }
    });
    if (best >= 0) F.i = best;
  }
  foesAction(name) {
    const F = this.foes, L = F.list;
    if (name === 'back' || name === 'start' || name === 'select') { this.close(); return; }
    if (name === 'tabPrev' || name === 'tabNext') { L.turn(name === 'tabPrev' ? -1 : 1); F.i = 0; return; }
    if (name !== 'confirm') return;
    const it = this.foesRows().items[F.i];
    if (it) L.choose(it.c.act);
  }
  foesView() {
    const F = this.foes, L = F.list, { rows, items, cols } = this.foesRows();
    F.i = Math.min(F.i, Math.max(0, items.length - 1));
    const on = items[F.i];
    const stops = L.filters, w = L.filter.world;
    return { v: this.v, kind: 'foes', head: 'Foes', cols: Array(cols).fill(1 / cols),
      filter: { text: L.filterTitle(w), i: Math.max(0, stops.indexOf(w)), n: stops.length },
      rows: rows.map((row, r) => row.map((c, k) => ({ kind: c.kind, text: c.text, sub: c.sub ?? '', col: c.col, span: c.span ?? 1, on: !!on && on.r === r && on.k === k, lit: !!c.act && L.isChosen(c.act) }))),
      empty: L.shown().length ? '' : 'Nothing by that name.',
      hint: 'A / × fights · LB / RB a world · B / ○ closes' };
  }

  // ------------------------------------------------------------------ the Arcade's games board

  /**
   * The Arcade's board of games (issue #430): the web's ArcadeBoard (src/levels/arcade-board.js, the level's quick menu)
   * keeps the games, their lines and bests and what a choice does (board.choose: that game's page); here its sheet is a
   * grid of rows as the Arena's foes' (BridgeMenu.cs DrawArcade): left / right the game before / after, up / down the one
   * above / below, A / × plays, B / ○ closes. Its words are the page's (board.words: ARCADE_BOARD).
   */
  openArcade(board) {
    if (!board?.games?.length) return false;
    this.arcade = { board, i: 0 };
    this.mode = 'arcade';
    board.open = true;
    this.changed();
    return true;
  }
  arcadeRows() {
    const B = this.arcade.board, cols = (this.screen?.()?.w ?? 1280) < 1100 ? 2 : 3, rows = [], items = [];
    for (let k = 0; k < B.games.length; k += cols) {
      const r = rows.length;
      rows.push(B.games.slice(k, k + cols).map((g, j) => {
        const best = B.best(g);
        const c = { kind: 'foe', text: g.name, sub: `${g.blurb ?? ''}\n${best ? `best ${best}` : 'no best yet'}`, color: g.color ?? '#71d7cf', col: j, id: g.id };
        items.push({ r, k: j, c });
        return c;
      }));
    }
    return { rows, items, cols };
  }
  arcadeMove(x, y) {
    const A = this.arcade, { items, cols } = this.arcadeRows(), n = items.length;
    if (!n) return;
    const at = Math.min(A.i, n - 1);
    if (!y) { A.i = Math.max(0, Math.min(n - 1, at + Math.sign(x))); return; }
    const j = at + Math.sign(y) * cols;
    if (j >= 0 && j < n) A.i = j;
  }
  arcadeAction(name) {
    const A = this.arcade;
    if (name === 'back' || name === 'start' || name === 'select') { A.board.open = false; this.close(); return; }
    if (name !== 'confirm') return;
    const it = this.arcadeRows().items[A.i];
    if (!it) return;
    A.board.open = false;
    this.close();
    A.board.choose(it.c.id);
  }
  arcadeView() {
    const A = this.arcade, { rows, items, cols } = this.arcadeRows();
    A.i = Math.min(A.i, Math.max(0, items.length - 1));
    const on = items[A.i];
    const W = A.board.words ?? {};
    return { v: this.v, kind: 'arcade', kicker: W.kicker ?? '', head: W.title ?? '', cols: Array(cols).fill(1 / cols),
      rows: rows.map((row, r) => row.map((c, k) => ({ kind: c.kind, text: c.text, sub: c.sub, color: c.color, col: c.col, span: 1, on: !!on && on.r === r && on.k === k }))),
      hint: W.pad ?? '' };
  }

  // ------------------------------------------------------------------ the dev menu

  /**
   * The dev menu (src/dev-menu.js DevMenu, issue #387): its tabs (src/world-debug.js devTabs) and its acts are the page's;
   * here its sheet is the game menu's (kind 'game', panel 'dev': BridgeMenu.cs DrawGame, the tab strip with five of its
   * tabs round the open one, a row a line, its state at the right, what A / × does in the strip). LB / RB (Q / E, [ ],
   * ← →) a tab, up / down its rows, A / × the row, B / ○, L3 + R3, F2 or ` closes; Menu and View go on to theirs.
   */
  openDev(dev) {
    if (!dev) return false;
    this.dev = dev;
    dev.changed = () => this.changed();
    this.mode = 'dev';
    if (!dev.open) dev.toggle(true); else dev.refresh();
    this.changed();
    return true;
  }
  devAction(name) {
    const D = this.dev;
    if (name === 'tabPrev' || name === 'tabNext') D.turn(name === 'tabPrev' ? -1 : 1);
    else if (name === 'confirm') { D.choose(); if (this.mode === 'dev' && !D.open) this.close(); }
    else if (name === 'back' || name === 'worldDebug') this.close();
    else if (name === 'start') { this.close(); this.show('start'); }
    else if (name === 'select') { this.close(); this.show('game'); }
  }
  devMove(x, y) { if (y) this.dev.move(y); else if (x) this.dev.turn(x); }
  devView() {
    const D = this.dev, tabs = D.tabs, n = D.nav, tab = tabs[n.tab];
    const [a, b] = tabWindow(tabs.length, n.tab, TAB_STRIP), cur = n.current(tabs);
    const rows = (tab?.rows ?? []).map((r, i) => [r.head
      ? { kind: 'head', text: `${r.label} · ${r.hint}`, sub: '', col: 0, span: 1, on: false }
      : { kind: 'dev', text: `${r.now ? '▸ ' : ''}${r.label}`, sub: r.hint ?? '', val: r.state !== undefined ? (r.state ? 'ON' : 'OFF') : r.tag ? String(r.tag).toUpperCase() : '', lit: !!r.state, col: 0, span: 1, on: i === n.row }]);
    if (tab?.note) rows.unshift([{ kind: 'head', text: tab.note, sub: '', col: 0, span: 1, on: false }]);
    return { v: this.v, kind: 'game', panel: 'dev', tabs: { names: tabs.slice(a, b).map((t) => t.name), i: n.tab - a, edge: 0 }, cols: [1], rows,
      empty: rows.length ? '' : tab?.empty ?? 'Nothing here.',
      strip: cur ? { name: cur.label, sub: `${tab.title} · ${n.tab + 1} / ${tabs.length}`, desc: cur.hint ?? '', act: verb(cur) } : { name: tab?.title ?? '', sub: `${n.tab + 1} / ${tabs.length}`, desc: tab?.line ?? '', act: '' },
      hint: 'LB / RB a tab · A / × choose · B / ○ close' };
  }

  // ------------------------------------------------------------------ input

  /** The controller's menu actions (src/controller.js, context 'menu'). */
  action(name) {
    if (!this.mode) return;
    // (a key awaited: a pad's button leaves it as it was, as Esc does)
    if (this.rebinding?.kind === 'keys') { this.stopRebind?.(); return; }
    if (this.mode === 'title') this.titleAction(name);
    else if (this.mode === 'start') this.startAction(name);
    else if (this.mode === 'shop') this.shopAction(name);
    else if (this.mode === 'card') this.cardAction(name);
    else if (this.mode === 'foes') this.foesAction(name);
    else if (this.mode === 'arcade') this.arcadeAction(name);
    else if (this.mode === 'starmap') this.star?.action(name);
    else if (this.mode === 'dev') this.devAction(name);
    else this.gameAction(name);
    this.changed();
  }
  /** A direction (the D-pad, the stick, the arrows): x, y in -1 / 0 / 1. */
  navigate(x, y) {
    if (!this.mode) return;
    if (this.mode === 'title') this.titleMove(x, y);
    else if (this.mode === 'start') this.startMove(x, y);
    else if (this.mode === 'shop') this.shopMove(x, y);
    else if (this.mode === 'card') this.cardMove(x, y);
    else if (this.mode === 'foes') this.foesMove(x, y);
    else if (this.mode === 'arcade') this.arcadeMove(x, y);
    else if (this.mode === 'starmap') this.star?.navigate(x, y);
    else if (this.mode === 'dev') this.devMove(x, y);
    else this.gameMove(x, y);
    this.changed();
  }
  /** A key (KeyboardEvent.code) while a menu is open: true when it was the menus'. */
  key(code) {
    if (!this.mode) return false;
    // (a pad's button awaited; a key awaited is the page's before it comes here: src/remap.js captureKey, engine/unity/game.js)
    if (this.rebinding) { if (code === 'Escape' || code === 'Backspace') this.stopRebind?.(); return true; }
    if (this.mode === 'card' && this.cardKey(code)) { this.changed(); return true; }
    if (this.mode === 'starmap') { const took = !!this.star?.key(code); this.changed(); return took; }
    if (this.mode === 'dev' && (code === 'F2' || code === 'Backquote')) { this.close(); return true; }   // (as it opened)
    if (this.mode === 'dev' && (code === 'PageUp' || code === 'PageDown')) { this.action(code === 'PageUp' ? 'tabPrev' : 'tabNext'); return true; }
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] }[code];
    if (dir) { this.navigate(dir[0], dir[1]); return true; }
    const act = { Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', Backspace: 'back', KeyQ: 'tabPrev', BracketLeft: 'tabPrev', KeyE: 'tabNext', BracketRight: 'tabNext', Delete: 'x', KeyX: 'x', KeyJ: 'select', KeyO: 'start' }[code];
    if (this.mode === 'foes' && code === 'KeyK') { this.close(); return true; }   // (K opened it: K closes it, as the page's)
    if (this.mode === 'arcade' && code === 'Tab') { this.arcadeAction('back'); return true; }   // (Tab opened it: Tab closes it, as the page's)
    if (!act) return false;
    if (this.mode === 'game' && act === 'select') { this.close(); return true; }
    this.action(act);
    return true;
  }

  // ------------------------------------------------------------------ the title

  /** The title's rows on its screen now: [{ id, text, sub, … }]. */
  titleRows() {
    const T = this.title, s = this.store;
    if (T.screen === 'main') {
      const last = s.latest(), sum = last ? s.summary(last) : null;
      return [
        sum ? { id: 'continue', text: t('title.continue'), sub: sum.world, primary: true } : { id: 'new', text: t('title.new'), primary: true },
        { id: 'saves', text: t('title.saves') },
        ...(this.settings ? [{ id: 'settings', text: t('title.settings') }] : []),
        ...(this.hasUpdates() ? [{ id: 'updates', text: UPDATES_SIDE.label() }] : []),
      ];
    }
    if (T.screen === 'saves') {
      const rows = [{ id: 'back', text: t('title.back'), back: true }];
      for (const x of s.list()) {
        if (x.empty) rows.push({ id: `slot.${x.n}`, slot: x.n, text: t('title.save', { n: x.n }), sub: t('title.new'), sub2: t('title.startsPrologue'), empty: true });
        else {
          const when = [x.playtime >= 60 && t('title.played', { time: formatPlaytime(x.playtime) }), formatDate(x.lastPlayed)].filter(Boolean).join(' · ');
          rows.push({ id: `slot.${x.n}`, slot: x.n, text: t('title.save', { n: x.n }), sub: x.world, sub2: progressLine(x), when, del: true, thumb: x.level });
        }
      }
      if (this.dev()) {
        rows.push({ id: 'debug', text: T.debugOpen ? t('title.dbg.head') : t('title.debug'), tag: t('title.dbg.tag'), fold: T.debugOpen ? 'open' : 'shut' });
        if (T.debugOpen) {
          const slotName = T.into === DEBUG_SLOT ? t('title.dbg.intoDebug') : t('title.save', { n: T.into });
          rows.push({ id: 'into', text: t('title.dbg.into', { slot: slotName }), note: t('title.dbg.why') });
          this.order.forEach((id, i) => rows.push({ id: `world.${id}`, world: id, text: `${i + 1}  ${TITLES[id] ?? id}`, sub: i === 0 ? t('title.dbg.fresh') : i === 1 ? t('title.dbg.before1') : t('title.dbg.before', { n: i }), thumb: id }));
        }
      }
      return rows;
    }
    return [];
  }
  titleMove(x, y) {
    const T = this.title;
    if (T.ask) { if (x) T.ask.on = T.ask.on ? 0 : 1; return; }
    if (T.screen === 'settings') { this.settingsMove(x, y, T); return; }
    if (T.screen === 'updates') { this.updatesMove(y, T); return; }
    const n = this.titleRows().length;
    if (y && n) T.i = (T.i + y + n) % n;
  }
  titleAction(name) {
    const T = this.title;
    if (T.starting) return;
    if (T.ask) {
      if (name === 'back' || (name === 'confirm' && !T.ask.on)) { T.ask = null; return; }
      if (name !== 'confirm') return;
      const a = T.ask; T.ask = null;
      if (a.kind === 'delete') { this.store.remove(a.slot); T.i = Math.min(T.i, this.titleRows().length - 1); }
      else if (a.kind === 'debug') this.begin({ debug: a.world, slot: a.slot });
      return;
    }
    if (T.screen === 'settings') { this.settingsAction(name, T, () => { T.screen = 'main'; T.i = this.titleRows().findIndex((r) => r.id === 'settings'); }); return; }
    if (T.screen === 'updates') {
      if (name === 'back') { T.screen = 'main'; T.i = this.titleRows().findIndex((r) => r.id === 'updates'); }
      else if (name === 'confirm') this.updatesConfirm(T.at?.i ?? 0);
      return;
    }
    const rows = this.titleRows(), r = rows[Math.min(T.i, rows.length - 1)];
    if (name === 'back') { if (T.screen === 'saves') { T.screen = 'main'; T.i = 1; } return; }
    if (name === 'x' && r?.del) { T.ask = { kind: 'delete', slot: r.slot, on: 0, q: t('title.deleteAsk', { n: r.slot }), what: [r.sub, r.sub2].filter(Boolean).join(' · '), yes: t('title.delete') }; return; }
    if (name !== 'confirm' || !r) return;
    if (r.id === 'continue') this.begin({ slot: this.store.latest(), fresh: false });
    else if (r.id === 'new') { const n = this.store.firstEmpty(); if (n) this.begin({ slot: n, fresh: true }); else { T.screen = 'saves'; T.i = 1; } }
    else if (r.id === 'saves') { T.screen = 'saves'; T.i = 1; T.debugOpen = false; }
    else if (r.id === 'settings') { T.screen = 'settings'; T.at = { in: 'page', i: 0 }; }
    else if (r.id === 'updates') { T.screen = 'updates'; T.at = { in: 'page', i: this.updatesFirst() }; }
    else if (r.id === 'back') { T.screen = 'main'; T.i = 1; }
    else if (r.slot) this.begin({ slot: r.slot, fresh: !!r.empty });
    else if (r.id === 'debug') T.debugOpen = !T.debugOpen;
    else if (r.id === 'into') T.into = nextInto(T.into);
    else if (r.world) {
      if (T.into !== DEBUG_SLOT && !this.store.summary(T.into).empty) {
        const s = this.store.summary(T.into);
        T.ask = { kind: 'debug', world: r.world, slot: T.into, on: 0, q: t('title.dbg.replaceAsk', { n: T.into }), what: t('title.dbg.replaceWhat', { was: [s.world, progressLine(s)].filter(Boolean).join(' · '), world: TITLES[r.world] ?? r.world }), yes: t('title.dbg.replace') };
      } else this.begin({ debug: r.world, slot: T.into });
    }
  }
  /** The title's choice made: it stays up, saying so, while the engine loads the world. */
  begin(choice) {
    this.title.starting = choice;
    this.note = choice.debug ? (TITLES[choice.debug] ?? choice.debug) : (this.store.summary(choice.slot)?.world || TITLES[ORDER[0]] || '');
    this.onStart(choice);
  }

  // ------------------------------------------------------------------ the settings page (the title's and the Start menu's)

  settingsMove(x, y, at) {
    const rows = this.settings ? SETTINGS_ROWS : [], n = rows.length;
    at.at ??= { in: 'page', i: 0 };
    if (!n) return;
    if (y) { at.at.i = (at.at.i + y + n) % n; return; }
    if (x) { const r = rows[at.at.i]; if (r) this.setSetting(r, settingStep(r, this.settingValue(r), x)); }
  }
  settingsAction(name, at, back) {
    const rows = this.settings ? SETTINGS_ROWS : [];
    if (name === 'back') { back(); return; }
    if (name === 'confirm') { const r = rows[at.at?.i ?? 0]; if (r && r.kind !== 'range') this.setSetting(r, settingStep(r, this.settingValue(r), 1)); }
  }
  setSetting(row, v) { this.settings.set(row.k, v); this.onSetting(row.k, v); }
  /** A setting's value as the page has it (reduced motion unset: what the system asks). */
  settingValue(r) { return r.value ? r.value(this.settings) : this.settings[r.k]; }
  settingsPage(at) {
    if (!this.settings) return [];
    return SETTINGS_ROWS.map((r, i) => ({ text: r.label(), val: settingText(r, this.settingValue(r)), slider: r.kind === 'range' ? (this.settings[r.k] - r.min) / (r.max - r.min) : null, kind: r.kind, on: at?.in === 'page' && at.i === i, note: (typeof r.note === 'function' ? r.note() : r.note) ?? '' }));
  }

  // ------------------------------------------------------------------ the Updates page (the title's and the Start menu's)

  /** Whether this player updates its script (engine/unity/updates.js). */
  hasUpdates() { return !!this.updates?.on; }
  /** The page's rows, the cursor's on (`at.i`): always a button, the nearest one when the rows changed under it. */
  updatesRows(at) {
    let rows = [];
    try { rows = this.updates?.rows() ?? []; } catch (e) { console.warn(`[menus] the updates page: ${e?.message ?? e}`); }
    if (at?.in === 'page' && !rows[at.i]?.act) {
      const buttons = rows.map((r, i) => (r.act ? i : -1)).filter((i) => i >= 0);
      if (buttons.length) at.i = buttons.reduce((a, b) => (Math.abs(b - at.i) < Math.abs(a - at.i) ? b : a));
    }
    return rows.map((r, i) => ({ ...r, on: at?.in === 'page' && at.i === i && !!r.act }));
  }
  /** The first button's row (where the cursor goes on the page). */
  updatesFirst() { const i = this.updatesRowsNow().findIndex((r) => r.act); return i < 0 ? 0 : i; }
  updatesRowsNow() { try { return this.updates?.rows() ?? []; } catch { return []; } }
  /** Up / down: from button to button (the page's other rows are read, not chosen). */
  updatesMove(y, at) {
    const buttons = this.updatesRowsNow().map((r, i) => (r.act ? i : -1)).filter((i) => i >= 0);
    at.at ??= { in: 'page', i: buttons[0] ?? 0 };
    if (!y || !buttons.length) return;
    const k = buttons.indexOf(at.at.i);
    at.at.i = buttons[((k < 0 ? 0 : k + y) + buttons.length) % buttons.length];
  }
  /** A / × on the page: the row's button, if it is one. */
  updatesConfirm(i) {
    const rows = this.updatesRowsNow(), r = rows[Math.min(i, rows.length - 1)];
    if (r?.act) this.updates.act(r.act);
  }
  /** Is the Updates page on screen (the title's or the Start menu's)? */
  updatesShown() { return (this.mode === 'title' && this.title.screen === 'updates') || (this.mode === 'start' && this.startPage() === 'updates'); }

  // ------------------------------------------------------------------ the Start menu

  /** The Start menu's sidebar: START_SIDE, and Updates before Quit to title in a player that has them. */
  startSide() {
    const map = START_SIDE.findIndex((e) => e.id === 'map');
    const side = this.hv ? [...START_SIDE.slice(0, map + 1), HOUSE_SIDE, ...START_SIDE.slice(map + 1)] : START_SIDE;
    if (!this.hasUpdates()) return side;
    const quit = side.findIndex((e) => e.id === 'quit');
    return [...side.slice(0, quit), UPDATES_SIDE, ...side.slice(quit)];
  }

  startPage() { return ['controls', 'news'].includes(this.start.page) || (this.start.page === 'updates' && this.hasUpdates()) || (this.start.page === 'house' && this.hv) ? this.start.page : 'settings'; }
  /**
   * The House map's picture of a floor (src/house-map.js drawHouseMap into engine/raster.js's PixelCanvas), by its key:
   * drawn once a floor while the menu is open (the last few kept), sent to the engine as the Map's ground is.
   */
  houseKey(view, floor) {
    for (const [k, p] of this.housePics) if (p.view === view && p.floor === floor) return k;
    const c = new PixelCanvas(HOUSE_MAP.w, HOUSE_MAP.h);
    drawHouseMap(c.getContext('2d'), view, floor);
    const key = `house${++this.houseN}`;
    this.housePics.set(key, { canvas: c, view, floor });
    while (this.housePics.size > 4) this.housePics.delete(this.housePics.keys().next().value);
    return key;
  }
  /** A drawn floor by its key (engine/unity/game.js sends its RGBA to Unity), or null. */
  housePicture(key) { return this.housePics.get(key)?.canvas ?? null; }
  startPageRows() {
    const page = this.startPage(), at = this.start.at, on = (i) => at.in === 'page' && at.i === i;
    if (page === 'house') return [];
    if (page === 'controls') return this.controlsRows().map((r, i) => ({ ...r, on: on(i) }));
    if (page === 'news') return this.newsRows().map((r, i) => ({ ...r, on: on(i) }));
    if (page === 'updates') return this.updatesRows(at);
    return this.settingsPage(at);
  }
  /**
   * The Controls page (src/ui.js rebindHtml, then controlsList): the pad's verbs, each on its button now (A / × on
   * one: the next button pressed is its new one, src/remap.js capturePad; Menu or 8 s leave it), the ones sharing a
   * button marked, run and guard held or toggled, the reset; the keyboard's verbs the same way (A / × or Enter on one:
   * the next key, captureKey; Esc or 8 s leave it), and their reset; then every control on the pad and the keyboard, in
   * the buttons and keys now bound. The one in your hands first, as the web's (`keysFirst`).
   */
  controlsRows() {
    const s = this.settings ?? {}, rows = [];
    const keysFirst = this.keysFirst();
    const padRows = () => {
      const pad = s.pad ?? {}, clash = padConflicts(pad), wait = this.rebinding?.kind === 'pad' ? this.rebinding.verb : null;
      for (const v of REBIND_PAD) {
        const others = clash.has(v) ? REBIND_PAD.filter((w) => w !== v && padFor(w, pad) === padFor(v, pad)).map((w) => verbName(w)) : [];
        rows.push({ text: verbName(v), val: wait === v ? t('rebind.pressButton') : `${others.length ? '⚠ ' : ''}${BUTTON_NAME[padFor(v, pad)]}`, rebind: v, moved: padFor(v, pad) !== PAD_VERBS[v], note: others.length ? `⚠ ${t('rebind.also', { verbs: others.join(', ') })}` : '' });
      }
      for (const r of CONTROL_ROWS) rows.push({ text: r.label(), val: r.name(s[r.k]), control: r.k });
      rows.push({ text: t('rebind.reset'), act: 'reset', note: clash.size ? `⚠ ${t('rebind.clashes')}` : '' });
    };
    const keyRows = () => {
      const keys = s.keys ?? {}, clash = keyConflicts(keys), wait = this.rebinding?.kind === 'keys' ? this.rebinding.verb : null;
      for (const v of REBIND_KEYS) {
        const others = clash.has(v) ? REBIND_KEYS.filter((w) => w !== v && keyFor(w, keys) === keyFor(v, keys)).map((w) => verbName(w, 'keys')) : [];
        rows.push({ text: verbName(v, 'keys'), val: wait === v ? t('rebind.pressKey') : `${others.length ? '⚠ ' : ''}${keyLabel(keyFor(v, keys))}`, rebindKey: v, moved: keyFor(v, keys) !== KEYS[v], note: others.length ? `⚠ ${t('rebind.also', { verbs: others.join(', ') })}` : '' });
      }
      rows.push({ text: t('rebind.reset'), act: 'resetKeys', note: clash.size ? `⚠ ${t('rebind.clashes')}` : '' });
    };
    const head = (k) => rows.push({ text: t(k).toUpperCase(), head: true, plain: true });
    if (this.settings) {
      if (keysFirst) { keyRows(); head('rebind.padTitle'); padRows(); } else { padRows(); head('rebind.keysTitle'); keyRows(); }
      head('menu.controls');
    }
    // (the menus' own buttons never move: those rows as they are, the rest in the player's buttons, src/remap.js padRename;
    // the keyboard's in the keys now bound, controlsList's verbKey)
    const list = controlsList();
    const padList = () => { for (const [what, how, id] of list.pad) rows.push({ text: what, val: PAD_RAW_ROWS.has(id) ? how : padRename(how, s.pad ?? {}), plain: true }); };
    const keyList = () => { for (const [what, how] of list.keyboard) rows.push({ text: what, val: how, plain: true }); };
    if (keysFirst) { keyList(); head('ctl.controller'); padList(); } else { padList(); if (this.settings) { head('ctl.keyboard'); keyList(); } }
    return rows;
  }
  /** The keyboard's verbs first on the Controls page: the keyboard in hand, and settings to rebind them in. */
  keysFirst() { return !!this.settings && keysInHand(); }
  /** What's new (src/changelog.js, as its panel lists it): the newest versions, each line newest first. */
  newsRows() {
    const rows = [];
    for (const e of CHANGELOG.slice(0, NEWS_VERSIONS)) {
      rows.push({ text: `v${e.v}`, val: e.date ?? '', head: true, plain: true });
      for (const i of newestFirst(e)) rows.push({ text: plain(lineText(i)), plain: true, wide: true });
    }
    return rows;
  }
  /**
   * A verb's button (or key: `kind` 'keys') chosen again: the next press (a button after all are let go; a key, before
   * anything else gets it) is its new one; Menu, View, Esc or 8 s keep it. A key the menus and scenes keep (Esc, Enter,
   * the F keys: RESERVED_KEYS) is not taken.
   */
  rebind(verb, kind = 'pad') {
    this.stopRebind?.();
    let stop = () => {};
    const finish = (value) => {
      stop(); this.rebinding = null; this.stopRebind = null;
      if (value && this.settings && !(kind === 'keys' && RESERVED_KEYS.test(value))) {
        const k = kind === 'keys' ? 'keys' : 'pad', next = { ...(this.settings[k] ?? {}) };
        if (value === (kind === 'keys' ? KEYS[verb] : PAD_VERBS[verb])) delete next[verb]; else next[verb] = value;
        this.setSetting({ k }, next);
      }
      this.changed();
    };
    this.rebinding = { verb, kind, until: Date.now() + 8000 };
    stop = kind === 'keys' ? captureKey(finish) : capturePad(finish);
    this.stopRebind = () => finish(null);
  }
  /** Each frame (the engine's): a rebinding left waiting 8 s keeps the button it had. */
  tick() {
    if (this.rebinding && Date.now() > this.rebinding.until) this.stopRebind?.();
    // (the Map's view at rest: the part in view drawn again sharper, so the view asks for it once)
    if (this.onMap && !this.mapRested && Date.now() - this.mapMoved >= 400) { this.mapRested = true; this.changed(); }
    // (the Updates page follows the player's check and download while it shows)
    if (this.updatesShown()) { try { if (this.updates.tick()) this.changed(); } catch (e) { console.warn(`[menus] the updates page: ${e?.message ?? e}`); } }
  }
  startMove(x, y) {
    const S = this.start, SIDE = this.startSide(), side = SIDE.length;
    const pageRows = this.startPageRows(), page = pageRows.length;
    // (a slider, a switch or a choice in the page: left / right its value, as the web keeps a slider's; B goes back)
    if (S.at.in === 'page' && x && page && this.startPage() === 'settings') { const r = SETTINGS_ROWS[S.at.i]; if (r) this.setSetting(r, settingStep(r, this.settingValue(r), x)); return; }
    const control = S.at.in === 'page' && x && CONTROL_ROWS.find((r) => r.k === pageRows[S.at.i]?.control);
    if (control) { this.setSetting(control, settingStep(control, this.settings[control.k], x)); return; }
    if (S.at.in === 'page' && y && !x && this.startPage() === 'updates') { this.updatesMove(y, S); return; }
    const home = SIDE.findIndex((e) => e.page === this.startPage());
    const go = sideStep({ side, page, at: S.at, home, back: S.back }, x, y);
    if (!go) return;
    if (S.at.in === 'page' && go.in === 'side') S.back = S.at.i;
    S.at = { in: go.in, i: go.to };
    // (on the sidebar, a page's entry shows its page)
    const e = SIDE[S.at.i];
    if (go.in === 'side' && e?.page) S.page = e.page;
  }
  startAction(name) {
    const S = this.start, SIDE = this.startSide();
    if (name === 'start') { this.close(); return; }
    if (name === 'select') { this.show('game'); return; }
    // (LB / RB on the House map: the floor below, the floor above)
    if ((name === 'tabPrev' || name === 'tabNext') && this.startPage() === 'house' && this.hv) { this.housePage.turn(this.hv, name === 'tabPrev' ? -1 : 1); return; }
    if (S.at.in === 'page') {
      if (name === 'back') { S.back = S.at.i; S.at = { in: 'side', i: Math.max(0, SIDE.findIndex((e) => e.page === this.startPage())) }; return; }
      if (name === 'confirm' && this.startPage() === 'updates') this.updatesConfirm(S.at.i);
      if (name === 'confirm' && this.startPage() === 'settings') this.settingsAction('confirm', S, () => {});
      if (name === 'confirm' && this.startPage() === 'controls') {
        const r = this.startPageRows()[S.at.i], control = CONTROL_ROWS.find((c) => c.k === r?.control);
        if (r?.rebind) this.rebind(r.rebind);
        else if (r?.rebindKey) this.rebind(r.rebindKey, 'keys');
        else if (r?.act === 'resetKeys') this.setSetting({ k: 'keys' }, {});
        else if (control) this.setSetting(control, settingStep(control, this.settings[control.k], 1));
        else if (r?.act === 'reset') this.setSetting({ k: 'pad' }, {});
      }
      return;
    }
    if (name === 'back') { this.close(); return; }
    if (name !== 'confirm') return;
    const e = SIDE[S.at.i];
    if (e.id === 'resume') this.close();
    else if (e.panel) this.show('game', e.panel);
    else if (e.page === 'house') S.page = e.page;   // (its page has nothing to move to: the floors are LB / RB's)
    else if (e.page) { S.page = e.page; S.at = { in: 'page', i: e.page === 'updates' ? this.updatesFirst() : 0 }; }
    else if (e.id === 'quit') { this.mode = null; this.onQuit(); }
    else if (e.id === 'photo') { this.close(); this.onPhoto(); }
  }

  // ------------------------------------------------------------------ the game menu

  /** The current panel's data and rows (src/game-menu.js builders, fed by `sources`). */
  panel() {
    const id = this.state.panel.id, src = this.sources;
    let data = null;
    try {
      data = id === 'people' ? src?.people?.(this.person) : id === 'map' ? src?.map?.({ zoom: null, detail: this.mapDetailWanted(), aspect: this.mapShape() }) : src?.[id]?.();
    } catch (e) { console.warn(`[menus] the ${id} panel's data: ${e?.message ?? e}`); }
    data ??= id === 'worlds' ? [] : id === 'map' ? { world: '', marks: [] } : {};
    if (id === 'map') this.mapSync(data);
    const built = BUILDERS[id](data);
    const rows = id === 'items' ? this.itemRows(built.rows) : built.rows;
    return { id, data, rows, start: built.start };
  }
  /** The Items panel's grid on this screen: { cols, carry } (the tiles a row; the column the keepsakes start at). */
  itemGrid() {
    const cols = Math.max(2, Math.min(GEAR_COLS, Math.round(Number(this.itemCols()) || GEAR_COLS)));
    return { cols, carry: cols === GEAR_COLS ? CARRY_COL : Math.ceil(cols / 2) };
  }
  /** The gear's tiles regrouped `cols` a row (itemsPanel lays out GEAR_COLS), what you carry and the keepsakes under them. */
  itemRows(rows) {
    const { cols, carry } = this.itemGrid();
    if (cols === GEAR_COLS) return rows;
    const gear = rows.flat().filter((c) => c.kind === 'item'), out = [];
    gear.forEach((c, i) => (out[Math.floor(i / cols)] ??= []).push({ ...c, col: i % cols }));
    for (const row of rows) if (!row.some((c) => c.kind === 'item')) out.push(row.map((c) => (c.col === CARRY_COL ? { ...c, col: carry } : c)));
    return out;
  }
  // ---- the Map's view (issue #343: the web's cursor and zoom, src/game-menu.js mapAnalog / mapPaint)

  /** The map's shape for the engine's sheet: its width over its height, in the web's steps (mapAspect); 1 without one. */
  mapShape() { const b = this.mapBox?.(); return b && b.w > 0 && b.h > 0 ? mapAspect(b.w, b.h) : 1; }
  /** The view put on the map just read: opened (or the map at a new shape), the whole of it, the cursor on the traveller. */
  mapSync(data) {
    const a = data?.aspect > 0 ? data.aspect : 1;
    if (!this.mapFresh && Math.abs(a - this.mapView.aspect) < 1e-3) return;
    this.mapFresh = false; this.mapDetail = null;
    const you = data?.marks?.find((m) => m.kind === 'you' && m.on);
    this.mapView.reset(you ? [you.u, you.v] : null, a);
  }
  /** The part of the map to draw again sharper: the view's (zoomed in twice or more) once it has rested 0.4 s; the last one meanwhile. */
  mapDetailWanted() {
    if (Date.now() - this.mapMoved >= 400 || !this.mapDetail) this.mapDetail = this.mapView.detailWindow();
    return this.mapDetail;
  }
  mapTouched() { this.mapMoved = Date.now(); this.mapRested = false; }
  /** On the Map (and not a thing's full view): the menu's view is the map's. */
  get onMap() { return this.mode === 'game' && !this.full && this.state.panel.id === 'map'; }
  /**
   * Each frame in a menu, the pad's left stick and triggers (src/controller.js menuAnalog): on the Map the stick moves
   * its cursor smoothly (the view following), RT zooms in and LT out round it, as far as they are pressed. True when
   * the Map took them (the controller then leaves the stick's steps to the D-pad).
   */
  analog({ x = 0, y = 0, lt = 0, rt = 0 } = {}, dt = 1 / 60) {
    // (the galactic map: while there is a world to find, the stick moves the scanner, the D-pad chooses a world)
    if (this.mode === 'starmap') { this.starStick = [x, y]; return !!this.star?.searching() && !this.star.asking; }
    if (!this.onMap) return false;
    const V = this.mapView, k = (rt > 0.08 ? rt : 0) - (lt > 0.08 ? lt : 0);
    if (x || y) V.stick(x, y, dt);
    if (k) V.zoomBy(Math.exp(k * VIEW.zoomRate * dt));
    if (x || y || k) { this.mapTouched(); this.changed(); }
    return true;
  }
  mapZoomBy(k) { this.mapView.zoomBy(k); this.mapTouched(); }

  startAt() {
    const p = this.panel();
    if (p.start) this.state.at[p.id] = p.start;
  }
  gameMove(x, y) {
    if (this.full) { if (x) this.fullStep(x); return; }
    // (the Map: the D-pad, the arrows, WASD move its cursor a step; the stick moves it smoothly, analog)
    if (this.onMap) { this.mapView.move(Math.sign(x) * VIEW.step, Math.sign(y) * VIEW.step); this.mapTouched(); return; }
    const p = this.panel();
    if (p.id === 'people' && this.person && x) { const d = p.data?.person; const to = x > 0 ? d?.nextId : d?.prevId; if (to) this.person = to; return; }
    const r = this.state.move(p.rows, x, y);
    if (r === 'turn') { this.full = null; this.person = null; this.zoom = null; this.mapFresh = true; this.startAt(); }
  }
  fullStep(dx) {
    const F = this.full, k = F.k + Math.sign(dx);
    if (k < 0 || k >= F.list.length) return;
    F.k = k; F.cell = F.list[k]; F.note = '';
  }
  gameAction(name) {
    if (name === 'select') { this.close(); return; }
    if (name === 'start') { this.show('start'); return; }
    if (name === 'tabPrev' || name === 'tabNext') { this.state.turn(name === 'tabNext' ? 1 : -1); this.full = null; this.person = null; this.zoom = null; this.mapFresh = true; this.startAt(); return; }
    // the Map: A / × closer round the cursor, twice as close each press, at the closest the whole map again; B / ○ the
    // whole map first when zoomed in, then out of the menu (src/game-menu.js confirm, back)
    if (this.onMap && (name === 'confirm' || name === 'back')) {
      const V = this.mapView;
      if (name === 'confirm') this.mapZoomBy(V.z >= VIEW.maxZoom - 1e-3 ? 1 / VIEW.maxZoom : 2);
      else if (V.zoomed) this.mapZoomBy(1 / VIEW.maxZoom);
      else this.close();
      return;
    }
    if (this.full) {
      if (name === 'back') { this.full = null; return; }
      if (name !== 'confirm') return;
      const c = this.full.cell;
      if (!c.full?.use) return;
      if (c.kind === 'world') { const why = this.onTravel(c.id); this.full.note = why ?? ''; if (!why) this.mode = null; }
      else if (c.kind === 'item') { this.onUse(c.id); this.refreshFull(); }
      return;
    }
    const p = this.panel(), cell = this.state.cell(p.rows);
    if (name === 'back') {
      if (p.id === 'people' && this.person) { const id = this.person; this.person = null; this.cursorTo('people', (x) => x.id === id); return; }
      if (p.id === 'map' && this.zoom) { this.zoom = null; return; }
      this.close(); return;
    }
    if (name !== 'confirm' || !cell) return;
    if (cell.act === 'track') { this.onTrack(cell.id); return; }
    if (cell.act === 'open' && cell.kind === 'person') { this.person = cell.id; this.state.at.people = { r: 0, c: 0 }; return; }
    if (cell.act === 'back') { const id = this.person; this.person = null; this.cursorTo('people', (x) => x.id === id); return; }
    if (cell.act === 'zoom') { this.zoom = this.zoom === cell.id ? null : cell.id; return; }
    if (cell.full) {
      const list = p.rows.flat().filter((x) => x.full && x.kind === cell.kind);
      this.full = { cell, list, k: Math.max(0, list.indexOf(cell)), note: '' };
    }
  }
  /** The full view drawn again from the panel's data (an item just used: its "in use"). */
  refreshFull() {
    const p = this.panel(), id = this.full.cell.id, kind = this.full.cell.kind;
    const list = p.rows.flat().filter((x) => x.full && x.kind === kind), k = list.findIndex((x) => x.id === id);
    if (k >= 0) this.full = { cell: list[k], list, k, note: '' };
  }
  cursorTo(panel, pick) {
    const p = this.panel();
    for (let r = 0; r < p.rows.length; r++) { const c = p.rows[r].findIndex(pick); if (c >= 0) { this.state.at[panel] = { r, c }; return; } }
  }

  // ------------------------------------------------------------------ what to draw

  /**
   * The menu as plain state (null when none is open):
   *   { v, kind: 'title' | 'start' | 'game', … } with, by kind,
   *   title: { screen, logo, version, rows: [{ text, sub, sub2, when, on, tag, fold, back, del, note }], page (settings), ask, starting, hint }
   *   start: { brand, head, sub, line, side: [{ text, on, sel }], page: { title, rows: [{ text, val, slider, kind, on, plain }] }, hint }
   *   game:  { tabs: { names, i, edge }, panel, cols, rows: [[{ text, sub, on, col, span, kind, mark, inUse, empty }]], strip, full, map, hint }
   */
  view() {
    if (!this.mode) return null;
    const v = this.mode === 'title' ? this.titleView() : this.mode === 'start' ? this.startView() : this.mode === 'shop' ? this.shopView() : this.mode === 'card' ? this.cardView() : this.mode === 'foes' ? this.foesView() : this.mode === 'arcade' ? this.arcadeView() : this.mode === 'starmap' ? { v: this.v, hint: '', ...this.star.view() } : this.mode === 'dev' ? this.devView() : this.gameView();
    // (the menus' own confirm and back are the buttons printed A and B whatever the layout, as on the web: with Nintendo
    // letters the right and the bottom ones; the prompts' "A / ×" written by position, src/native-pad.js confirmKey)
    v.hint = menuKeys(v.hint);
    v.keys = { ok: confirmKey(), back: backKey(), prev: 'LB', next: 'RB' };
    return v;
  }
  titleView() {
    const T = this.title;
    const base = { v: this.v, kind: 'title', screen: T.screen, logo: 'HIRAETH', version: this.version, shot: T.shot?.id ?? '' };
    // (where the name and the menu go on the engine's canvas: the web's layout, src/title-layout.js, the name across the
    // top, the entries a short column low at the left so the world shows)
    const lay = (n) => {
      const S = this.screen?.() ?? { w: 1280, h: 720 }, L = titleLayout({ w: S.w, h: S.h, buttons: n, icons: 0, at: T.shot?.menu ?? 'low' }), r = (x) => Math.round(x * 10) / 10;
      return { logo: { x: r(L.logo.left), y: r(L.logo.top), w: r(L.logo.width), h: r(L.logo.height) },
        menu: { x: r(L.menu.list.left), y: r(L.menu.list.top), w: r(Math.max(L.menu.list.width, 220)), button: r(L.menu.button), gap: r(L.menu.gap), font: r(L.menu.font) } };
    };
    if (T.starting) return { ...base, rows: [], starting: this.note || '…', layout: lay(2), hint: '' };
    if (T.screen === 'settings') return { ...base, head: t('title.settings').toUpperCase(), page: { rows: this.settingsPage(T.at) }, hint: 'A / × change · ◀ ▶ adjust · B / ○ back' };
    if (T.screen === 'updates') return { ...base, head: 'UPDATES', page: { rows: this.updatesRows(T.at) }, hint: 'A / × choose · B / ○ back' };
    const rows = this.titleRows().map((r, i) => ({ text: r.text, sub: r.sub ?? '', sub2: r.sub2 ?? '', when: r.when ?? '', tag: r.tag ?? '', fold: r.fold ?? '', back: !!r.back, del: !!r.del, note: r.note ?? '', primary: !!r.primary, on: i === Math.min(T.i, this.titleRows().length - 1) }));
    const sel = this.titleRows()[Math.min(T.i, rows.length - 1)];
    const hint = T.screen === 'saves' ? `A / × choose${sel?.del ? ' · X / □ delete' : ''} · B / ○ back` : 'A / × choose';
    return { ...base, head: T.screen === 'saves' ? t('title.savesHead') : '', rows, layout: T.screen === 'main' ? lay(rows.length) : null,
      ask: T.ask ? { q: T.ask.q, what: T.ask.what, undone: T.ask.kind === 'delete' ? t('title.undone') : '', no: t('title.keep'), yes: T.ask.yes, on: T.ask.on } : null, hint };
  }
  startView() {
    const S = this.start, page = this.startPage();
    const keysFirst = page === 'controls' && this.keysFirst();
    const title = { controls: t(keysFirst ? 'rebind.keysTitle' : 'rebind.padTitle'), news: `${t('menu.news')}  v${CHANGELOG[0].v}`, updates: UPDATES_SIDE.label(), house: `${this.hv?.name ?? ''} · ${t('menu.house')}` }[page] ?? t('menu.settings');
    const hint = this.rebinding ? (this.rebinding.kind === 'keys' ? `${t('rebind.pressKey')} · Esc keeps it` : `${t('rebind.pressButton')} · Menu keeps it`)
      : page === 'house' ? `LB / RB floor · B / ○ ${S.at.in === 'page' ? 'back' : 'resume'}`
      : S.at.in !== 'page' ? 'A / × choose · ▶ the page · B / ○ resume'
      : page === 'news' ? '▲ ▼ read · B / ○ back' : page === 'updates' ? 'A / × choose · B / ○ back' : page === 'controls' ? 'A / × change · ◀ ▶ adjust · B / ○ back' : '◀ ▶ adjust · A / × change · B / ○ back';
    const view = { v: this.v, kind: 'start', brand: t('menu.paused'), head: this.where() || '', sub: '', line: this.saveLine?.() ?? '',
      side: this.startSide().map((e, i) => ({ text: e.label(), on: S.at.in === 'side' && S.at.i === i, sel: e.page === page })),
      page: { title, note: page === 'controls' && this.settings ? t(keysFirst ? 'rebind.keysHow' : 'rebind.padHow') : '', rows: this.startPageRows() }, hint };
    // the House map: its floors' tabs (LB / RB), the one shown, its picture by key, the picture's shape (issue #405)
    if (page === 'house' && this.hv) {
      const hv = this.hv, floor = this.housePage.floor(hv), i = hv.floors.findIndex((f) => f.id === floor);
      view.page.house = { key: this.houseKey(hv, floor), tabs: hv.floors.map((f) => f.label), here: hv.floors.findIndex((f) => f.id === hv.here), i, name: hv.floors[i]?.name ?? '', aspect: +(HOUSE_MAP.w / HOUSE_MAP.h).toFixed(4), prev: hv.floors.length > 1 ? 'LB' : '', next: hv.floors.length > 1 ? 'RB' : '' };
    }
    return view;
  }
  gameView() {
    const p = this.panel(), at = this.state.cursor(), cell = this.state.cell(p.rows);
    const names = PANELS.map((x) => x.name);
    const grid = p.id === 'items' ? this.itemGrid() : null;
    const rows = p.rows.map((row, r) => row.map((c, k) => ({
      text: c.name ?? '', sub: c.sub ?? '', col: c.col ?? k, span: grid && c.kind !== 'item' ? (c.col === 0 ? grid.carry : grid.cols - grid.carry) : 1,
      kind: c.kind,
      // (a thing's picture: public/item-pictures/<id>, as the items page draws it; its kind's mark where it has none)
      pic: PICTURED.has(c.kind) ? c.id ?? '' : '', mark: PICTURED.has(c.kind) ? KIND_MARK[c.it?.kind ?? c.kind] ?? '✧' : '', on: !at.edge && at.r === r && at.c === k, inUse: !!c.it?.inUse, tracked: !!c.q?.tracked, done: c.kind === 'ended' ? (c.q?.failed ? 'failed' : 'done') : '',
      here: c.kind === 'world' && /here/i.test(c.sub ?? ''), off: c.kind === 'mark' && !c.mark?.on,
      // (a quest's next step under it, as the page's card shows it)
      step: ['quest', 'charge', 'errand'].includes(c.kind) ? plain(c.q?.step) : '',
    })));
    if (grid) {
      // the slots still to find, drawn after the gear but not named (src/game-menu.js itemsPanel), never the cursor's
      const gearRows = rows.filter((row) => row.some((c) => c.kind === 'item')).length, n = rows.slice(0, gearRows).flat().length;
      let made = gearRows;
      for (let i = n; i < (p.data?.slots ?? 0); i++) {
        const r = Math.floor(i / grid.cols);
        if (r >= made) rows.splice(made++, 0, []);   // (a row of empties only, before what you carry)
        rows[r].push({ text: '', sub: '', col: i % grid.cols, span: 1, kind: 'empty', empty: true, on: false, pic: '', mark: '' });
      }
    }
    const view = { v: this.v, kind: 'game', panel: p.id, tabs: { names, i: this.state.i, edge: at.edge ?? 0 }, cols: grid ? Array(grid.cols).fill(1 / grid.cols) : COLS[p.id] ?? [1], rows,
      empty: p.rows.length ? '' : plain(BUILDERS[p.id](p.data).html.match(/<p class="none">([^<]*)<\/p>/)?.[1] ?? ''),
      strip: cell ? { name: cell.name ?? '', sub: cell.sub ?? '', desc: plain(cell.desc), act: cell.act ? ACT[cell.act] : '' } : null,
      hint: this.full ? 'B / ○ back · ◀ ▶ the next' : 'LB / RB turn · A / × choose · B / ○ close' };
    if (p.id === 'items') { view.slots = p.data?.slots ?? 0; view.gear = (p.data?.gear ?? []).length; view.chimes = p.data?.chimes ?? null; }
    if (p.id === 'map') {
      // the map is the whole sheet (no list under it, issue #244): its ground (the engine's picture by its key,
      // engine/game.js mapPicture; "Drawing the map… n %" until then) and the sharper part of it zoomed in, placed by the
      // view (z: the zoom, u0 / v0: the view's top left on the map); the marks, the cursor and the name of the mark under
      // it beside it, all on the sheet (0..1 across and down), as src/game-menu.js mapPaint places them
      const V = this.mapView, d = p.data ?? {}, on = (d.marks ?? []).filter((m) => m.on), hit = V.pick(on), [cx, cy] = V.toSheet(V.u, V.v);
      const r4 = (x) => +Number(x).toFixed(4);
      const ground = d.canvas?.key ?? '', progress = d.progress ?? 0, part = d.detail?.canvas?.key ? d.detail : null;
      const marks = [];
      for (const m of on) {
        const [x, y] = V.toSheet(m.u, m.v);
        if (m.kind === 'rumour') {
          // (a rumour: its soft circle on the sheet, rx across and ry down, and its short name: issue #340)
          const rx = (m.ru ?? 0) * V.z, ry = (m.rv ?? 0) * V.z;
          if (x + rx >= 0 && x - rx <= 1 && y + ry >= 0 && y - ry <= 1) marks.push({ id: m.id, kind: m.kind, x: r4(x), y: r4(y), deg: null, sel: m === hit, rx: r4(rx), ry: r4(ry), label: m.name ?? '' });
          continue;
        }
        if (x >= -0.03 && x <= 1.03 && y >= -0.03 && y <= 1.03) marks.push({ id: m.id, kind: m.kind, x: r4(x), y: r4(y), deg: m.deg ?? null, sel: m === hit });
      }
      const bar = d.span ? V.scale(d.span) : d.scale;
      view.map = { world: d.world ?? '', note: d.note ?? '', aspect: r4(d.aspect ?? 1), ground, drawing: ground ? '' : `${t('gm.map.drawing')} ${Math.round(progress * 100)} %`,
        detail: part ? { key: part.canvas.key, u0: r4(part.u0), v0: r4(part.v0), s: r4(part.s) } : null,
        z: r4(V.z), u0: r4(V.u0), v0: r4(V.v0), cursor: [r4(cx), r4(cy)], on: !!hit, marks, none: !(d.marks ?? []).length ? t('gm.map.none') : '',
        tip: hit ? { name: hit.name ?? '', sub: hit.sub ?? '', left: cx > 0.58, below: cy < 0.16 } : null,
        scale: bar ? { frac: r4(bar.frac), label: bar.label } : null, zoomed: V.zoomed };
      view.rows = [];
      view.strip = { name: hit?.name ?? d.world ?? '', sub: hit?.sub ?? '', desc: '', act: V.z >= VIEW.maxZoom - 1e-3 ? ACT.whole : ACT.zoom };
      view.hint = `LT / RT zoom · A / × ${V.z >= VIEW.maxZoom - 1e-3 ? ACT.whole.toLowerCase() : ACT.zoom.toLowerCase()} · LB / RB turn · B / ○ ${V.zoomed ? ACT.whole.toLowerCase() : 'close'}`;
    }
    if (p.id === 'people' && p.data?.person) {
      const d = p.data.person;
      view.person = { name: d.name, role: [d.role, d.worldTitle].filter(Boolean).join(' · '), story: d.story ?? [], now: d.now ?? '', choices: d.choices ?? [],
        between: [d.talks ? (d.talks > 1 ? t('gm.p.talksN', { n: d.talks }) : t('gm.p.talks1')) : '', ...(d.quests ?? []).map((q) => `${q.state === 'done' ? '✓' : q.state === 'failed' ? '·' : '◇'} ${q.title}`), ...(d.things ?? [])].filter(Boolean),
        prev: d.prev ?? '', next: d.next ?? '' };
      view.hint = 'B / ○ back · ◀ ▶ the next';
    }
    if (this.full) {
      const c = this.full.cell, F = this.full, f = c.full ?? {};
      const w = c.kind === 'world' ? (Array.isArray(p.data) ? p.data.find((x) => x.id === c.id) : null) : null;
      view.full = { title: c.name ?? '', sub: f.sub ?? '', pic: PICTURED.has(c.kind) ? c.id ?? '' : '', mark: PICTURED.has(c.kind) ? KIND_MARK[c.it?.kind ?? c.kind] ?? '✧' : '', text: plain(f.text), inUse: !!f.inUse, use: f.use ?? '', note: F.note ?? '',
        facts: w ? worldFacts(w).map((x) => ({ text: x.text, on: !!x.on, list: (x.list ?? []).join(' · ') })) : [],
        prev: F.list[F.k - 1]?.name ?? '', next: F.list[F.k + 1]?.name ?? '', kind: c.kind };
    }
    return view;
  }
}
