// The menus for an engine (docs/systems/engine-bridge.md, "The menus"): the title, the Start menu and the game menu,
// as the web game has them (src/title.js, src/ui.js SettingsMenu, src/game-menu.js), as plain state an engine draws
// (the Unity bridge: BridgeMenu.cs). The web's are pages of buttons; here the same entries, in the same order, moved
// through by the same rules:
//   - the title: Continue (the save played last) or New game, Saves, Settings; Saves lists the three slots (X / □
//     deletes, asked first), Back, and the folded Debug row (src/title.js debugSavesHtml, issue #227): opened, the slot
//     it writes and every world of the route (src/debug-save.js seedDebugSave);
//   - the Start menu (Menu / Esc): a sidebar (Resume, Items, Quests, Map, Settings, Controls, Quit to title) and its
//     page, left / right between them and up / down round each (src/menu-pad.js sideStep, issue #210), a slider's
//     left / right its value, B / ○ in the page back to the sidebar first;
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
import { controlsList } from '../src/ui.js';
import { confirmKey, backKey } from '../src/native-pad.js';

/** The slot after `into` for the debug saves: the debug slot, then the player's 1..count, round again (src/title.js). */
export const nextInto = (into, count = SLOT_COUNT) => (into === DEBUG_SLOT ? 1 : into >= count ? DEBUG_SLOT : into + 1);

/**
 * The settings an engine's Start menu and title show (src/ui.js SettingsMenu's, those the engines carry out): a slider
 * (min, max, step), a switch, or a choice (opts). Graphics applies at the next start (the engine's preset is read at launch).
 */
export const SETTINGS_ROWS = [
  { k: 'music', label: () => t('set.music'), kind: 'range', min: 0, max: 1, step: 0.05 },
  { k: 'effects', label: () => t('set.effects'), kind: 'range', min: 0, max: 1, step: 0.05 },
  { k: 'voices', label: () => t('set.voices'), kind: 'range', min: 0, max: 1, step: 0.05 },
  { k: 'mute', label: () => t('set.mute').replace(/ \(M\)$/, ''), kind: 'switch' },
  { k: 'sensitivity', label: () => t('set.sensitivity'), kind: 'range', min: 0.3, max: 3, step: 0.05 },
  { k: 'invertY', label: () => t('set.invertY'), kind: 'switch' },
  // (where the printed A B X Y are: the Retroid's own "Xbox style" swaps them, src/native-pad.js setFaces)
  { k: 'padFaces', label: () => t('set.padFaces'), kind: 'choice', opts: ['auto', 'xbox', 'nintendo', 'nintendo-xbox'], name: (v) => t(`set.padFaces.${v ?? 'auto'}`) },
  { k: 'hints', label: () => t('set.hints').replace(/ \(.*$/, ''), kind: 'choice', opts: ['off', 'subtle', 'full'], name: (v) => t(`set.hints.${v}`) },
  { k: 'quality', label: () => t('set.quality'), kind: 'choice', opts: ['handheld', 'low', 'medium', 'high'], name: (v) => t(`set.quality.${v}`), note: 'from the next start' },
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

/** The Start menu's sidebar: its entries and what each does (src/ui.js SettingsMenu render, in the game). */
export const START_SIDE = [
  { id: 'resume', label: () => t('menu.resume') },
  { id: 'items', label: () => t('menu.items'), panel: 'items' },
  { id: 'quests', label: () => t('menu.quests'), panel: 'quests' },
  { id: 'map', label: () => t('menu.map'), panel: 'map' },
  { id: 'settings', label: () => t('menu.settings'), page: 'settings' },
  { id: 'controls', label: () => t('menu.controls'), page: 'controls' },
  { id: 'quit', label: () => t('menu.quit') },
];

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
   * @param o.onTravel  (id) → null | a line why not (the Worlds page's Travel here)
   * @param o.onUse, o.onTrack  an item used, a quest tracked (the game menu's)
   * @param o.where     () → the Start menu's heading: the world you are in
   * @param o.itemCols  () → how many of the Items panel's tiles fit a row on the engine's screen (the web's grid fits
   *                    as many as its tile's size allows: src/game-menu.css --tile); GEAR_COLS without one
   */
  constructor({ store = defaultStore, settings = null, sources = null, dev = () => true, order = ORDER, onStart = () => {}, onResume = () => {}, onQuit = () => {}, onTravel = () => null, onUse = () => {}, onTrack = () => {}, onSetting = () => {}, where = () => '', version = '', itemCols = () => GEAR_COLS } = {}) {
    Object.assign(this, { store, settings, sources, dev, order, onStart, onResume, onQuit, onTravel, onUse, onTrack, onSetting, where, version, itemCols });
    this.mode = null;            // null | 'title' | 'start' | 'game'
    this.v = 0;
    this.title = { screen: 'main', i: 0, debugOpen: false, into: DEBUG_SLOT, ask: null, starting: null };
    this.start = { at: { in: 'side', i: 0 }, page: 'settings', back: -1 };
    this.state = new MenuState(PANELS);
    this.full = null;            // the game menu's full view: { cell, list, k }
    this.person = null;          // the People panel's open page
    this.zoom = null;            // the Map's mark zoomed on
    this.note = '';
  }

  get open() { return !!this.mode; }
  changed() { this.v++; }

  /** Open a menu: 'title', 'start', or 'game' (on a panel). */
  show(mode, panel = null) {
    this.mode = mode;
    this.note = '';
    if (mode === 'title') Object.assign(this.title, { screen: 'main', i: 0, ask: null, debugOpen: false, starting: null });
    if (mode === 'start') this.start = { at: { in: 'side', i: 0 }, page: 'settings', back: -1 };
    if (mode === 'game') { this.state.show(panel ?? DEFAULT_PANEL); this.full = null; this.person = null; this.zoom = null; this.startAt(); }
    this.changed();
  }
  close() { if (!this.mode) return; this.mode = null; this.changed(); this.onResume(); }

  // ------------------------------------------------------------------ input

  /** The controller's menu actions (src/controller.js, context 'menu'). */
  action(name) {
    if (!this.mode) return;
    if (this.mode === 'title') this.titleAction(name);
    else if (this.mode === 'start') this.startAction(name);
    else this.gameAction(name);
    this.changed();
  }
  /** A direction (the D-pad, the stick, the arrows): x, y in -1 / 0 / 1. */
  navigate(x, y) {
    if (!this.mode) return;
    if (this.mode === 'title') this.titleMove(x, y);
    else if (this.mode === 'start') this.startMove(x, y);
    else this.gameMove(x, y);
    this.changed();
  }
  /** A key (KeyboardEvent.code) while a menu is open: true when it was the menus'. */
  key(code) {
    if (!this.mode) return false;
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] }[code];
    if (dir) { this.navigate(dir[0], dir[1]); return true; }
    const act = { Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', Backspace: 'back', KeyQ: 'tabPrev', BracketLeft: 'tabPrev', KeyE: 'tabNext', BracketRight: 'tabNext', Delete: 'x', KeyX: 'x', KeyJ: 'select', KeyO: 'start' }[code];
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
      ];
    }
    if (T.screen === 'saves') {
      const rows = [{ id: 'back', text: t('title.back'), back: true }];
      for (const x of s.list()) {
        if (x.empty) rows.push({ id: `slot.${x.n}`, slot: x.n, text: t('title.save', { n: x.n }), sub: t('title.new'), sub2: 'Starts at your ship', empty: true });
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
    const rows = this.titleRows(), r = rows[Math.min(T.i, rows.length - 1)];
    if (name === 'back') { if (T.screen === 'saves') { T.screen = 'main'; T.i = 1; } return; }
    if (name === 'x' && r?.del) { T.ask = { kind: 'delete', slot: r.slot, on: 0, q: t('title.deleteAsk', { n: r.slot }), what: [r.sub, r.sub2].filter(Boolean).join(' · '), yes: t('title.delete') }; return; }
    if (name !== 'confirm' || !r) return;
    if (r.id === 'continue') this.begin({ slot: this.store.latest(), fresh: false });
    else if (r.id === 'new') { const n = this.store.firstEmpty(); if (n) this.begin({ slot: n, fresh: true }); else { T.screen = 'saves'; T.i = 1; } }
    else if (r.id === 'saves') { T.screen = 'saves'; T.i = 1; T.debugOpen = false; }
    else if (r.id === 'settings') { T.screen = 'settings'; T.at = { in: 'page', i: 0 }; }
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
    if (x) { const r = rows[at.at.i]; if (r) this.setSetting(r, settingStep(r, this.settings[r.k], x)); }
  }
  settingsAction(name, at, back) {
    const rows = this.settings ? SETTINGS_ROWS : [];
    if (name === 'back') { back(); return; }
    if (name === 'confirm') { const r = rows[at.at?.i ?? 0]; if (r && r.kind !== 'range') this.setSetting(r, settingStep(r, this.settings[r.k], 1)); }
  }
  setSetting(row, v) { this.settings.set(row.k, v); this.onSetting(row.k, v); }
  settingsPage(at) {
    if (!this.settings) return [];
    return SETTINGS_ROWS.map((r, i) => ({ text: r.label(), val: settingText(r, this.settings[r.k]), slider: r.kind === 'range' ? (this.settings[r.k] - r.min) / (r.max - r.min) : null, on: at?.in === 'page' && at.i === i, note: r.note ?? '' }));
  }

  // ------------------------------------------------------------------ the Start menu

  startPage() { return this.start.page === 'controls' ? 'controls' : 'settings'; }
  startPageRows() {
    if (this.startPage() === 'controls') return controlsList().pad.map(([what, how]) => ({ text: what, val: how, plain: true }));
    return this.settingsPage(this.start.at);
  }
  startMove(x, y) {
    const S = this.start, side = START_SIDE.length;
    const pageRows = this.startPageRows(), page = this.startPage() === 'settings' ? pageRows.length : 0;
    // (a slider, a switch or a choice in the page: left / right its value, as the web keeps a slider's; B goes back)
    if (S.at.in === 'page' && x && page) { const r = SETTINGS_ROWS[S.at.i]; if (r) this.setSetting(r, settingStep(r, this.settings[r.k], x)); return; }
    const home = START_SIDE.findIndex((e) => e.page === this.startPage());
    const go = sideStep({ side, page, at: S.at, home, back: S.back }, x, y);
    if (!go) return;
    if (S.at.in === 'page' && go.in === 'side') S.back = S.at.i;
    S.at = { in: go.in, i: go.to };
    // (on the sidebar, a page's entry shows its page)
    const e = START_SIDE[S.at.i];
    if (go.in === 'side' && e?.page) S.page = e.page;
  }
  startAction(name) {
    const S = this.start;
    if (name === 'start') { this.close(); return; }
    if (name === 'select') { this.show('game'); return; }
    if (S.at.in === 'page') {
      if (name === 'back') { S.back = S.at.i; S.at = { in: 'side', i: Math.max(0, START_SIDE.findIndex((e) => e.page === this.startPage())) }; return; }
      if (name === 'confirm' && this.startPage() === 'settings') this.settingsAction('confirm', S, () => {});
      return;
    }
    if (name === 'back') { this.close(); return; }
    if (name !== 'confirm') return;
    const e = START_SIDE[S.at.i];
    if (e.id === 'resume') this.close();
    else if (e.panel) this.show('game', e.panel);
    else if (e.page) { S.page = e.page; if (e.page === 'settings') S.at = { in: 'page', i: 0 }; }
    else if (e.id === 'quit') { this.mode = null; this.onQuit(); }
  }

  // ------------------------------------------------------------------ the game menu

  /** The current panel's data and rows (src/game-menu.js builders, fed by `sources`). */
  panel() {
    const id = this.state.panel.id, src = this.sources;
    let data = null;
    try {
      data = id === 'people' ? src?.people?.(this.person) : id === 'map' ? src?.map?.({ zoom: this.zoom }) : src?.[id]?.();
    } catch (e) { console.warn(`[menus] the ${id} panel's data: ${e?.message ?? e}`); }
    data ??= id === 'worlds' ? [] : id === 'map' ? { world: '', marks: [] } : {};
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
  startAt() {
    const p = this.panel();
    if (p.start) this.state.at[p.id] = p.start;
  }
  gameMove(x, y) {
    if (this.full) { if (x) this.fullStep(x); return; }
    const p = this.panel();
    if (p.id === 'people' && this.person && x) { const d = p.data?.person; const to = x > 0 ? d?.nextId : d?.prevId; if (to) this.person = to; return; }
    const r = this.state.move(p.rows, x, y);
    if (r === 'turn') { this.full = null; this.person = null; this.zoom = null; this.startAt(); }
  }
  fullStep(dx) {
    const F = this.full, k = F.k + Math.sign(dx);
    if (k < 0 || k >= F.list.length) return;
    F.k = k; F.cell = F.list[k]; F.note = '';
  }
  gameAction(name) {
    if (name === 'select') { this.close(); return; }
    if (name === 'start') { this.show('start'); return; }
    if (name === 'tabPrev' || name === 'tabNext') { this.state.turn(name === 'tabNext' ? 1 : -1); this.full = null; this.person = null; this.zoom = null; this.startAt(); return; }
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
   *   start: { head, sub, side: [{ text, on, sel }], page: { title, rows: [{ text, val, slider, on, plain }] }, hint }
   *   game:  { tabs: { names, i, edge }, panel, cols, rows: [[{ text, sub, on, col, span, kind, mark, inUse, empty }]], strip, full, map, hint }
   */
  view() {
    if (!this.mode) return null;
    const v = this.mode === 'title' ? this.titleView() : this.mode === 'start' ? this.startView() : this.gameView();
    // (the menus' own confirm and back are the buttons printed A and B whatever the layout, as on the web: with Nintendo
    // letters the right and the bottom ones; the prompts' "A / ×" written by position, src/native-pad.js confirmKey)
    v.hint = menuKeys(v.hint);
    v.keys = { ok: confirmKey(), back: backKey(), prev: 'LB', next: 'RB' };
    return v;
  }
  titleView() {
    const T = this.title;
    const base = { v: this.v, kind: 'title', screen: T.screen, logo: 'HIRAETH', version: this.version };
    if (T.starting) return { ...base, rows: [], starting: this.note || '…', hint: '' };
    if (T.screen === 'settings') return { ...base, head: t('title.settings').toUpperCase(), page: { rows: this.settingsPage(T.at) }, hint: 'A / × change · ◀ ▶ adjust · B / ○ back' };
    const rows = this.titleRows().map((r, i) => ({ text: r.text, sub: r.sub ?? '', sub2: r.sub2 ?? '', when: r.when ?? '', tag: r.tag ?? '', fold: r.fold ?? '', back: !!r.back, del: !!r.del, note: r.note ?? '', primary: !!r.primary, on: i === Math.min(T.i, this.titleRows().length - 1) }));
    const sel = this.titleRows()[Math.min(T.i, rows.length - 1)];
    const hint = T.screen === 'saves' ? `A / × choose${sel?.del ? ' · X / □ delete' : ''} · B / ○ back` : 'A / × choose';
    return { ...base, head: T.screen === 'saves' ? t('title.savesHead') : '', rows,
      ask: T.ask ? { q: T.ask.q, what: T.ask.what, undone: T.ask.kind === 'delete' ? t('title.undone') : '', no: t('title.keep'), yes: T.ask.yes, on: T.ask.on } : null, hint };
  }
  startView() {
    const S = this.start, page = this.startPage();
    return { v: this.v, kind: 'start', head: this.where() || '', sub: '',
      side: START_SIDE.map((e, i) => ({ text: e.label(), on: S.at.in === 'side' && S.at.i === i, sel: e.page === page })),
      page: { title: page === 'controls' ? t('menu.controls') : t('menu.settings'), rows: this.startPageRows() },
      hint: S.at.in === 'page' ? '◀ ▶ adjust · A / × change · B / ○ back' : 'A / × choose · ▶ the page · B / ○ resume' };
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
    if (p.id === 'map') view.map = { world: p.data?.world ?? '', marks: (p.data?.marks ?? []).filter((m) => m.on).map((m) => ({ id: m.id, kind: m.kind, name: m.name, u: +m.u.toFixed(4), v: +m.v.toFixed(4), deg: m.deg ?? null, on: cell?.id === m.id })), note: p.data?.note ?? '', zoom: this.zoom };
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
