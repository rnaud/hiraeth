// The page, as the game's modules reach it: one place for document, window, localStorage, audio and
// input, and the screen's state as data (docs/systems/engine-bridge.md, "The platform layer").
//
// On the web every call is what the module did before (document.getElementById, a window listener,
// localStorage behind a try). In an engine (Unity through the JS bridge) the page is a stand-in
// (engine/platform.js), and what the HUD shows is read from `screen` instead of drawn into it: the
// cue line, the toast, the floating prompt, the health bar and stamina wheel, the conversation. The
// modules that draw those set their part of `screen` as they draw, so the web and the engine draw
// from the same state.

const hasDoc = () => typeof document !== 'undefined';
const hasWin = () => typeof window !== 'undefined' && typeof window.addEventListener === 'function';

export const page = {
  /** An element of index.html by id, or null (no page: Node, a test). */
  byId: (id) => (hasDoc() ? document.getElementById(id) : null),
  /** A window listener (keys, the mouse, blur…); returns a function that removes it. */
  on(type, fn, opts) {
    if (!hasWin()) return () => {};
    window.addEventListener(type, fn, opts);
    return () => window.removeEventListener(type, fn, opts);
  },
  /** A class on the page's body ('talking', 'controller'…). */
  bodyClass(name, on) { if (hasDoc()) document.body?.classList.toggle(name, !!on); },
  hasBodyClass: (name) => (hasDoc() ? !!document.body?.classList.contains(name) : false),
  exitPointerLock() { if (hasDoc()) document.exitPointerLock?.(); },
  activeElement: () => (hasDoc() ? document.activeElement : null),
};

/** localStorage, never throwing (private windows, a full quota, no storage at all). */
export const store = {
  get(k) { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } },
  set(k, v) { try { globalThis.localStorage?.setItem(k, v); return true; } catch { return false; } },
  remove(k) { try { globalThis.localStorage?.removeItem(k); } catch { /* none */ } },
};

/** The pads (navigator.getGamepads) and nothing when there are none. */
export const input = {
  pads: () => (typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads() ?? []) : []),
};

/** Web Audio's context, or null where there is none (an engine: its sound is its own). */
export const audio = {
  available: () => !!(globalThis.AudioContext ?? globalThis.webkitAudioContext),
  context(opts) { const C = globalThis.AudioContext ?? globalThis.webkitAudioContext; return C ? new C(opts) : null; },
};

/**
 * What the screen shows, as data. Each part is null (nothing) or a plain object:
 *   cue       { text, kind }                     the line at the bottom (hud.js Cue): kind 'place' for a region's name
 *   toast     { text, secs, id }                 the line at the top (ship/cinema.js): id counts up, one a toast
 *   prompt    { text, key, at: [x, y, z] }       "E talk to Ama", floating over them (story/index.js placePrompt)
 *   health    { value, low }                     the bar while hurt (hud.js healthHud)
 *   stamina   { value, winded, at: [x, y, z] }   the wheel by the traveller (hud.js staminaHud)
 *   dialogue  { name, title, color, text, shown, done, speaker, choices: [{ text, tone, index }], more }
 *   choice    the answer a pad has picked (an engine's: the page focuses a button instead)
 * `version` moves whenever a part changes, so a renderer reads it only then.
 */
export const screen = {
  state: { cue: null, toast: null, prompt: null, health: null, stamina: null, dialogue: null, choice: null },
  version: 0,
  _keys: {},
  set(part, value) {
    const key = value == null ? '' : JSON.stringify(value);
    if (this._keys[part] === key) return false;
    this._keys[part] = key;
    this.state[part] = value ?? null;
    this.version++;
    return true;
  },
  _toasts: 0,
  /** A toast as it goes up (the web's queue decides when). */
  toast(text, secs = 4) { if (text) this.set('toast', { text: String(text), secs, id: ++this._toasts }); },
  reset() { for (const k of Object.keys(this.state)) this.set(k, null); },
};
