// Three save slots (SLOT_COUNT). Every store of progress (the game state, the sketchbook, the
// saved position, the reactive world's memory) reads and writes through
// `slotStorage`, a localStorage look-alike that files each key under the active
// slot: 'hiraeth.game.v1' in slot 2 is 'hiraeth.s2.game.v1'. Settings, mute,
// the pad layout, the changelog's "seen" mark and the update toast stay global.
//
//   import { slots, slotStorage } from './save-slots.js';
//   slots.active              // 1..SLOT_COUNT, read once per page from 'hiraeth.slot' (each world is its own page)
//   slots.setActive(3)        // the title screen's choice, before the game's modules load
//   slots.summary(2)          // { empty, level, world, worldsDone, items, playtime, lastPlayed, … }
//   slots.latest()            // the slot played last (Continue), or null
//   slots.remove(4)           // delete a save
//   slots.touch(n, { addSeconds })   // playtime and "last played"
//
// The single save from before the slots is copied into slot 1 the first time
// (migrate()). The old keys stay as they were, so a build from before the slots
// (an over-the-air update rolled back on Android) still finds its save.
//
// One more slot, 'debug' (DEBUG_SLOT, keys 'hiraeth.sdebug.*'), is the worlds list's (src/debug-save.js):
// a world picked there plays in it, never in the player's own slots. The title never lists it
// (list, latest, firstEmpty count 1..SLOT_COUNT); choosing a save there leaves it.
//
// The title screen draws a world behind its menu with the game's own modules (src/title-world.js),
// and some of them read the game state as they load. While it does, the slots are sandboxed
// (sandbox(seed)): every store reads and writes an in-memory save instead of a slot, so nothing is
// read from the save not yet chosen and nothing is written to any; the title starts the game in a
// fresh page after the choice (src/title.js).

import { reviewStorage } from './cinematics-page/storage.js';
const cinematicStorage = reviewStorage();

import { TITLES, ORDER, worldFor } from './levels/names.js';

export const SLOT_COUNT = 3;
export const SLOT_KEY = 'hiraeth.slot';
/** The worlds list's own save (src/debug-save.js): not one of the title's slots. */
export const DEBUG_SLOT = 'debug';
/** The URL a debug save starts from (src/boot.js seeds it, src/debug-save.js): ?level=<id>&debugsave=1, and
 *  &debugslot=<n> when it goes into one of the player's own slots (the title's Saves screen, issue #203). */
export const DEBUG_PARAM = 'debugsave', DEBUG_SLOT_PARAM = 'debugslot';
/** The slot a debug save may go into: one of the player's (1..SLOT_COUNT) when asked for, else the debug slot. */
export function debugSlot(v, count = SLOT_COUNT) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= count ? n : DEBUG_SLOT;
}
/** Where a debug save at `levelId` starts: the world, its debug save, the slot when it is one of the player's. */
export function debugSaveHref(levelId, slot = DEBUG_SLOT) {
  const n = debugSlot(slot);
  return `?level=${levelId}&${DEBUG_PARAM}=1${n === DEBUG_SLOT ? '' : `&${DEBUG_SLOT_PARAM}=${n}`}`;
}
export const SLOTS_VERSION_KEY = 'hiraeth.slots.v';
// the progress kept per slot (src/game-state.js, src/quest.js, src/ui.js SaveGame, src/reactive-world.js)
export const PROGRESS_KEYS = ['hiraeth.game.v1', 'hiraeth.journal.v1', 'hiraeth.save.v1', 'hiraeth.encounters.v1'];
// per slot: { playtime (seconds), lastPlayed (ms), created (ms) }
export const META_KEY = 'hiraeth.meta.v1';

/** A key as filed under slot n. */
export const slotKey = (key, n) => key.replace(/^hiraeth\./, `hiraeth.s${n}.`);
const validSlot = (v) => { if (v === DEBUG_SLOT) return v; const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT ? n : null; };
const parse = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const defaultStorage = () => { try { return cinematicStorage ?? globalThis.localStorage ?? null; } catch { return null; } };

export class SlotStore {
  constructor(storage = defaultStorage()) {
    this.storage = storage;
    this._active = null;
    this._migrated = false;
    this._sandbox = null;
    this._held = null;
  }
  /**
   * Point the slot view (slotStorage) at an in-memory save until the page ends: `seed` is its keys
   * and values (unprefixed, as the stores ask for them). The selector's own reads (summary, list,
   * latest, remove, touch) still see the real slots.
   */
  sandbox(seed = {}) { this._sandbox = new Map(Object.entries(seed).map(([k, v]) => [k, String(v)])); return this; }
  get sandboxed() { return !!this._sandbox; }
  /**
   * The slot view's writes kept in memory from now on (the game loading behind the title, src/title-hold.js): it
   * reads them back, the selector and the disk don't see them; commitWrites() puts them on the disk (the save was
   * chosen), dropWrites() forgets them (another was).
   */
  holdWrites() { this._held = new Map(); return this; }
  get holding() { return !!this._held; }
  commitWrites() {
    const held = this._held;
    this._held = null;
    for (const [k, v] of held ?? []) if (v === null) this.del(k); else this.put(k, v);
    return held?.size ?? 0;
  }
  dropWrites() { const n = this._held?.size ?? 0; this._held = null; return n; }
  get(k) { try { return this.storage?.getItem(k) ?? null; } catch { return null; } }
  put(k, v) { try { this.storage?.setItem(k, v); } catch { /* private mode, full */ } }
  del(k) { try { this.storage?.removeItem(k); } catch { /* ignore */ } }

  /** The save from before the slots goes to slot 1 (once). Returns true if there was one. */
  migrate() {
    this._migrated = true;
    if (this.get(SLOTS_VERSION_KEY)) return false;
    let moved = false;
    for (const key of PROGRESS_KEYS) {
      const v = this.get(key);
      if (v != null && this.get(slotKey(key, 1)) == null) { this.put(slotKey(key, 1), v); moved = true; }
    }
    if (moved) {
      const t = parse(this.get('hiraeth.save.v1'))?.t;
      this.put(slotKey(META_KEY, 1), JSON.stringify({ playtime: 0, lastPlayed: Number.isFinite(t) ? t : Date.now(), migrated: true }));
    }
    this.put(SLOTS_VERSION_KEY, '1');
    return moved;
  }
  ready() { if (!this._migrated) this.migrate(); }

  /** The slot this page plays (pinned on first read: another tab choosing a slot doesn't move this one). */
  get active() {
    this.ready();
    if (this._active === null) this._active = validSlot(this.get(SLOT_KEY)) ?? 1;
    return this._active;
  }
  setActive(n) {
    const v = validSlot(n);
    if (!v) throw new RangeError(`no save slot ${n}`);
    this.ready();
    this._active = v;
    this.put(SLOT_KEY, String(v));
    return v;
  }

  /** A localStorage look-alike for slot n (default: the active slot). */
  view(n = null) {
    const at = () => n ?? this.active;
    const sb = () => (n === null ? this._sandbox : null);
    return {
      getItem: (k) => {
        const m = sb(); if (m) return m.get(k) ?? null;
        this.ready();
        const key = slotKey(k, at());
        return this._held?.has(key) ? this._held.get(key) : this.get(key);
      },
      setItem: (k, v) => { const m = sb(); if (m) { m.set(k, String(v)); return; } this.ready(); const key = slotKey(k, at()); if (this._held) this._held.set(key, String(v)); else this.put(key, String(v)); },
      removeItem: (k) => { const m = sb(); if (m) { m.delete(k); return; } this.ready(); const key = slotKey(k, at()); if (this._held) this._held.set(key, null); else this.del(key); },
    };
  }

  used(n) { this.ready(); return PROGRESS_KEYS.some((k) => this.get(slotKey(k, n)) != null); }
  /** Delete everything saved in slot n. */
  remove(n) {
    if (!validSlot(n)) return;
    this.ready();
    for (const k of [...PROGRESS_KEYS, META_KEY]) this.del(slotKey(k, n));
  }

  meta(n = this.active) { return parse(this.get(slotKey(META_KEY, n))) ?? {}; }
  /** Count playtime and mark the slot as just played. */
  touch(n = this.active, { addSeconds = 0, now = Date.now() } = {}) {
    const m = this.meta(n);
    m.created ??= now;
    m.playtime = (m.playtime ?? 0) + Math.max(0, addSeconds || 0);
    m.lastPlayed = now;
    this.put(slotKey(META_KEY, n), JSON.stringify(m));
    return m;
  }

  /** What the save selector shows for slot n. */
  summary(n) {
    const empty = !this.used(n);
    const game = parse(this.get(slotKey('hiraeth.game.v1', n))) ?? {};
    const journal = parse(this.get(slotKey('hiraeth.journal.v1', n))) ?? {};
    const save = parse(this.get(slotKey('hiraeth.save.v1', n)));
    const meta = this.meta(n);
    const flags = game.flags ?? {};
    // (a merged or dismissed world's id: the world that took its place, src/levels/names.js worldFor)
    const level = empty ? null : worldFor(save?.level ?? flags['ship.level'] ?? 'desert', worldFor(flags['ship.level'] ?? 'desert'));
    const worldsDone = ORDER.filter((id) => flags[`world.${id}.done`] || journal.stories?.[id]).length;
    // items found (src/items.js: `item.<id>` = true; a quest's carried things are counts)
    const items = Object.entries(flags).filter(([k, v]) => v === true && /^item\.[^.]+$/.test(k)).length;
    return {
      n, empty, level, world: level ? TITLES[level] ?? level : null,
      prologue: !empty && !flags['prologue.done'], ended: !!flags['ending.done'],
      worldsDone, worldsTotal: ORDER.length, items,
      playtime: meta.playtime ?? 0, lastPlayed: meta.lastPlayed ?? save?.t ?? null,
    };
  }
  list() { return Array.from({ length: SLOT_COUNT }, (_, i) => this.summary(i + 1)); }
  /** The slot played last (what Continue loads), or null when every slot is empty. */
  latest() {
    let best = null;
    for (const s of this.list()) if (!s.empty && (!best || (s.lastPlayed ?? 0) > (best.lastPlayed ?? 0))) best = s;
    return best?.n ?? null;
  }
  firstEmpty() { return this.list().find((s) => s.empty)?.n ?? null; }
}

// ---- how the save selector words it

/** "under a minute", "12 min", "1 h 05" */
export function formatPlaytime(seconds) {
  const m = Math.floor((seconds || 0) / 60);
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "today 14:05", "yesterday 09:30", "3 Oct 2026" (local time) */
export function formatDate(ms, now = Date.now()) {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms), n = new Date(now);
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const ago = Math.round((day(n) - day(d)) / 86400000);
  if (ago === 0) return `today ${hm}`;
  if (ago === 1) return `yesterday ${hm}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Prologue", or "3 / 9 worlds · 4 items" (the relics' count went with them in v2.34, issue #732) */
export function progressLine(s) {
  if (s.empty) return 'New game';
  if (s.prologue) return 'Prologue';
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return [`${s.worldsDone} / ${s.worldsTotal} worlds`, plural(s.items, 'item')].join(' · ') + (s.ended ? ' · home' : '');
}

/**
 * Does this page load open on the title screen (src/boot.js)? Not when a world is asked for
 * directly: ?level=<id> (the ship's arrivals, the dev shortcut; it plays the current slot),
 * ?prologue=1, ?ending=1, ?start (a save started over from the Start menu), or ?game=<id> (a minigame).
 */
export const DIRECT_PARAMS = ['level', 'prologue', 'ending', 'start', 'game'];   // (game: a minigame's page, src/minigames/)
export function opensTitle(search = '') {
  const q = new URLSearchParams(search);
  return !DIRECT_PARAMS.some((k) => q.has(k));
}

export const slots = new SlotStore();
/** The active slot's storage: what every progress store reads and writes. */
export const slotStorage = slots.view();
