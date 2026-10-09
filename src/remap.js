// The player's own controls (docs/systems/controls.md, "Remapping"): which key or button each verb is on, and
// whether run and guard are held or toggled. The defaults are the fixed tables of src/bindings.js (KEYS,
// PAD_VERBS); a player's changes are kept as overrides beside them, saved with the settings (src/ui.js
// Settings: keys, pad, run, guard) and handed here by setControlPrefs().
//
// The game itself never learns of them: it goes on reading the default codes and buttons.
// - The keyboard: installKeyRemap() listens first (capture, on the window, before anything else is
//   registered: boot.js) and sends each key on as the default key of the verb it is bound to (a new
//   KeyboardEvent with that code); a default key whose verb moved away, and that nothing took, sends nothing.
// - The pad: Controller (src/controller.js) reads each verb's button through padMap() while playing and
//   riding; the menus and conversations keep the default buttons (confirm, back: the way out is never lost).
// - The prompts: native-pad.js renames the default button names on the page ("A / ×") to the ones now bound
//   (padRename), and the keyboard's key badges ("E") to the keys now bound (keyRename).
//
//   setControlPrefs({ keys: { jump: 'KeyK' }, pad: { jump: 'B', evade: 'A' }, run: 'toggle', guard: 'hold' })

import { KEYS, PAD_VERBS, PAD_BUTTONS, BUTTON_NAME } from './bindings.js';
import { t, language } from './i18n.js';

export const RUN_MODES = ['auto', 'hold', 'toggle'];   // auto: the pad's L3 runs until the stick is let go (the keyboard holds)
export const GUARD_MODES = ['hold', 'toggle'];
/** Keys a verb can't be moved to: the menus' and the scenes' own (Esc backs out, Enter confirms), the F keys, the dev menu's. */
export const RESERVED_KEYS = /^(Escape|Enter|NumpadEnter|F\d+|Backquote|Meta\w*|OSLeft|OSRight|ContextMenu)$/;
/** The pad's buttons a verb can be moved to (not View or Menu). */
export const BINDABLE_BUTTONS = PAD_BUTTONS.filter((b) => b !== 'View' && b !== 'Menu');

const IDX = Object.fromEntries(PAD_BUTTONS.map((b, i) => [b, i]));
export const IDENTITY = Object.freeze(PAD_BUTTONS.map((_, i) => i));

const clean = (o, ok) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([v, c]) => ok(v, c)));
const cleanKeys = (keys) => clean(keys, (v, c) => KEYS[v] && typeof c === 'string' && c !== KEYS[v] && !RESERVED_KEYS.test(c));
const cleanPad = (pad) => clean(pad, (v, b) => PAD_VERBS[v] && BINDABLE_BUTTONS.includes(b) && b !== PAD_VERBS[v]);

/**
 * A pad layout saved before PAD_SCHEME 4 (src/ui.js migrateSettings, once), brought up to date: one job per button,
 * ↑ the gadgets, ← the potion, ↓ the mount, → the next gun mode.
 * - Scheme 3 (v1.11's first build; a saved 'potion' tells it, the potion was no pad verb before): the potion sat on
 *   ↓, so a verb the player put on ↓ swapped places with it; that verb goes to the potion's place now, ←, and the
 *   swap stays a swap (potion on LB, guard on ↓: potion on LB, guard on ←). The potion keeps the button chosen.
 * - Schemes 1–2: 'call' (↓) and 'modeNext' (→) are where they were; 'modePrev' (←) is gone, the potion has ←.
 * Whatever then shares a button (a verb on the gun mode's or the potion's new place) goes back to its default:
 * no guessing.
 */
export function migratePad(pad) {
  if (!pad || typeof pad !== 'object') return {};
  const out = { ...pad };
  if ('potion' in out) for (const v of Object.keys(out)) if (v !== 'potion' && out[v] === '↓') out[v] = '←';
  delete out.modePrev;
  for (let i = 0; i < Object.keys(PAD_VERBS).length; i++) {
    const clash = padConflicts(cleanPad(out));
    const moved = [...clash].filter((v) => v in out);
    if (!moved.length) break;
    for (const v of moved) delete out[v];
  }
  return cleanPad(out);
}

/** The prefs from a settings object (or anything with keys / pad / run / guard), cleaned: only real changes stay. */
export function normalisePrefs(p = {}) {
  return {
    keys: cleanKeys(p.keys), pad: cleanPad(p.pad),
    run: RUN_MODES.includes(p.run) ? p.run : 'auto', guard: GUARD_MODES.includes(p.guard) ? p.guard : 'hold',
  };
}

let prefs = normalisePrefs();
let routes = new Map(), map = IDENTITY;
const listeners = new Set();

/** The player's controls now (from the settings): src/ui.js calls it as they load and change. */
export function setControlPrefs(p = {}) {
  const next = normalisePrefs(p);
  const changed = JSON.stringify(next) !== JSON.stringify(prefs);
  prefs = next; routes = keyRoutes(next.keys); map = padMap(next.pad);
  if (changed) for (const f of listeners) f(prefs);
  return prefs;
}
export const controlPrefs = () => prefs;
/** Told whenever the controls change (native-pad.js renames the prompts). Returns a function that stops it. */
export function onControlPrefs(f) { listeners.add(f); return () => listeners.delete(f); }

// ------------------------------------------------------------------ the keyboard

/** The key a verb is on now. */
export const keyFor = (verb, keys = prefs.keys) => keys[verb] ?? KEYS[verb];

/**
 * Where each key goes: physical code → the default codes it sends. Only keys that change are listed (the rest
 * go on as they are). Two verbs on one key: it sends both (a conflict, shown on the Controls page).
 */
export function keyRoutes(keys = {}) {
  const out = new Map();
  const add = (code, to) => { const l = out.get(code) ?? []; if (!l.includes(to)) l.push(to); out.set(code, l); };
  const moved = Object.keys(KEYS).filter((v) => keyFor(v, keys) !== KEYS[v]);
  for (const v of moved) add(keyFor(v, keys), KEYS[v]);
  // a key a verb moved onto keeps the job it had, if its own verb is still there
  for (const code of [...out.keys()]) for (const [w, d] of Object.entries(KEYS)) if (d === code && keyFor(w, keys) === code) add(code, code);
  for (const v of moved) if (!out.has(KEYS[v])) out.set(KEYS[v], []);   // (moved away, nothing took it: it sends nothing)
  return out;
}

/** The verbs that share a key with another (the Controls page marks them). */
export function keyConflicts(keys = prefs.keys) {
  const by = new Map();
  for (const v of Object.keys(KEYS)) { const c = keyFor(v, keys); by.set(c, [...(by.get(c) ?? []), v]); }
  return new Set([...by.values()].filter((l) => l.length > 1).flat());
}

// what a key is called on the keys themselves (the keyboard's own layout when the browser says it: an AZERTY's KeyQ is "A")
const NAMES = {
  Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'CTRL', ControlRight: 'R-CTRL', AltLeft: 'ALT', AltRight: 'ALT GR',
  Tab: 'TAB', CapsLock: 'CAPS', Backspace: '⌫', Delete: 'DEL', Insert: 'INS', Home: 'HOME', End: 'END', PageUp: 'PG ↑', PageDown: 'PG ↓',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};
const PUNCT = { Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Backslash: '\\', Comma: ',', Period: '.', Slash: '/', IntlBackslash: '<' };
let layout = null;   // the browser's keyboard layout map, once read (navigator.keyboard.getLayoutMap: Chrome)
/** Read the keyboard's own layout (an AZERTY's letters) where the browser tells it; the labels follow. */
export function readKeyboardLayout(nav = globalThis.navigator) {
  const k = nav?.keyboard;
  if (!k?.getLayoutMap) return Promise.resolve(null);
  return k.getLayoutMap().then((m) => { layout = m; for (const f of listeners) f(prefs); return m; }).catch(() => null);
}
/** A key's name as printed on it ('SPACE', 'E', '↑'); local: in the language's words ('ESPACE'), else the prompts' own ('SPACE'). */
export function keyLabel(code, lay = layout, local = true) {
  if (!code) return '?';
  if (local && NAMES[code]) { const k = t(`key.${code}`); if (k !== `key.${code}`) return k; }
  if (NAMES[code]) return NAMES[code];
  const printed = lay?.get?.(code);
  if (printed && /^\S$/u.test(printed)) return printed.toUpperCase();
  if (PUNCT[code]) return PUNCT[code];
  let m;
  if ((m = code.match(/^Key([A-Z])$/))) return m[1];
  if ((m = code.match(/^Digit(\d)$/))) return m[1];
  if ((m = code.match(/^Numpad(.+)$/))) return `NUM ${m[1]}`;
  return code.toUpperCase();
}
/** The key's name for a verb now. */
export const verbKey = (verb) => keyLabel(keyFor(verb));

/** The default key names the prompts are written with (KEYS by their QWERTY name: 'E', 'SPACE') → the names now. */
let renamed = null;   // (keyRename for the prefs, layout and language now: asked for every text on the page)
export function keyRename(keys = prefs.keys, lay = layout) {
  const now = keys === prefs.keys && lay === layout;
  if (now && renamed?.keys === keys && renamed.lay === lay && renamed.lang === language()) return renamed.out;
  const out = new Map();
  for (const v of Object.keys(KEYS)) {
    const from = keyLabel(KEYS[v], null, false), to = keyLabel(keyFor(v, keys), lay);
    if (from !== to && !out.has(from)) out.set(from, to);
  }
  if (now) renamed = { keys, lay, lang: language(), out };
  return out;
}

// a key event's `key` for a default code (the handlers that read e.key: the numbers in lists)
const keyChar = (code) => (code === 'Space' ? ' ' : /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : /^Digit\d$/.test(code) ? code.slice(5) : code);
const editable = (t) => !!t && (t.isContentEditable || (t.tagName === 'INPUT' && !['checkbox', 'range', 'radio', 'button'].includes(t.type)) || t.tagName === 'TEXTAREA');
const SENT = Symbol('remapped');

let keyCapture = null;   // { done(code | null) } while the Controls page waits for a key
/**
 * The next key pressed goes to `done(code)` instead of the game (Esc: done(null)); the Controls page's
 * "press a key". Returns a function that stops waiting.
 */
export function captureKey(done) { keyCapture = { done }; return () => { if (keyCapture?.done === done) keyCapture = null; }; }
export const capturingKey = () => !!keyCapture;

/**
 * Listen to the keyboard first and send each key on as the verb's default key (above). Toggle run / guard:
 * a press turns the default key on, the next turns it off (its own key-up is not sent). Installed once, first
 * thing (boot.js; main.js for a world opened directly).
 */
export function installKeyRemap(win = globalThis.window) {
  if (!win?.addEventListener || win.__keyRemap) return;
  win.__keyRemap = true;
  const toggled = new Set(), swallowUp = new Set();
  const isToggle = (code) => (code === KEYS.run && prefs.run === 'toggle') || (code === KEYS.guard && prefs.guard === 'toggle');
  const handler = (e) => {
    if (e[SENT]) return;
    if (e.type === 'keyup' && swallowUp.delete(e.code)) { e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (keyCapture && e.type === 'keydown') {
      e.stopImmediatePropagation(); e.preventDefault();
      if (e.repeat) return;
      const { done } = keyCapture; keyCapture = null; swallowUp.add(e.code);
      done(e.code === 'Escape' ? null : e.code);
      return;
    }
    if (editable(e.target)) return;
    const to = routes.get(e.code) ?? [e.code];
    if (to.length === 1 && to[0] === e.code && !isToggle(e.code)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    for (const code of to) {
      let type = e.type;
      if (isToggle(code)) {
        if (e.type === 'keyup' || e.repeat) continue;
        if (toggled.has(code)) { toggled.delete(code); type = 'keyup'; } else { toggled.add(code); type = 'keydown'; }
      }
      const ev = new win.KeyboardEvent(type, { code, key: keyChar(code), repeat: e.repeat, bubbles: true, cancelable: true, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey });
      ev[SENT] = true;
      (e.target?.dispatchEvent ? e.target : win).dispatchEvent(ev);
    }
  };
  win.addEventListener('keydown', handler, true);
  win.addEventListener('keyup', handler, true);
  win.addEventListener('blur', () => toggled.clear());
  onControlPrefs(() => toggled.clear());
  readKeyboardLayout(win.navigator);
}

// ------------------------------------------------------------------ the pad

/** The button a verb is on now ('A', 'RB', '↑'…). */
export const padFor = (verb, pad = prefs.pad) => pad[verb] ?? PAD_VERBS[verb];

/** For each of the pad's buttons as the game reads it (its default verb's), the button pressed for it (indices). */
export function padMap(pad = {}) {
  const m = IDENTITY.slice();
  for (const v of Object.keys(PAD_VERBS)) m[IDX[PAD_VERBS[v]]] = IDX[padFor(v, pad)];
  return Object.freeze(m);
}
/** The map the controller reads through now. */
export const currentPadMap = () => map;

/** The verbs that share a button with another. */
export function padConflicts(pad = prefs.pad) {
  const by = new Map();
  for (const v of Object.keys(PAD_VERBS)) { const b = padFor(v, pad); by.set(b, [...(by.get(b) ?? []), v]); }
  return new Set([...by.values()].filter((l) => l.length > 1).flat());
}

/** The button's name now for a verb ('B / ○'). */
export const verbButton = (verb, pad = prefs.pad) => BUTTON_NAME[padFor(verb, pad)];

const NAME_RE = new RegExp(Object.keys(PAD_VERBS).map((v) => BUTTON_NAME[PAD_VERBS[v]]).sort((a, b) => b.length - a.length).map((s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|'), 'g');
const VERB_OF = Object.fromEntries(Object.entries(PAD_VERBS).map(([v, b]) => [BUTTON_NAME[b], v]));

/** A prompt written with the default buttons ("A / × jump"), in the buttons now bound (one pass: swaps stay swaps). */
export function padRename(text, pad = prefs.pad) {
  if (!text || !Object.keys(pad).length) return text;
  return text.replace(NAME_RE, (name) => BUTTON_NAME[padFor(VERB_OF[name], pad)]);
}
/** Any change to rename on the page (the pad's buttons, or keys by the player or by the keyboard's layout). */
export const hasRenames = () => Object.keys(prefs.pad).length > 0 || keyRename().size > 0;

let padCapture = null;
/**
 * The next button pressed (after all are let go) goes to `done(button)` ('A', 'RB', '↑'…) instead of the game;
 * Menu or View: done(null). The controller hands it on (Controller.update). Returns a function that stops waiting.
 */
export function capturePad(done) { padCapture = { done }; return () => { if (padCapture?.done === done) padCapture = null; }; }
export const capturingPad = () => !!padCapture;
/** (Controller) a new press while waiting: its position's index. */
export function padCaptured(index) {
  if (!padCapture) return;
  const { done } = padCapture; padCapture = null;
  const b = PAD_BUTTONS[index];
  done(b && BINDABLE_BUTTONS.includes(b) ? b : null);
}
