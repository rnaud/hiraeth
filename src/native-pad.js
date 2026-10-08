// Controllers on Android, where their face buttons are, and button labels for them.
//
// In the Android app (android/.../GamepadBridge.java) the activity reads the
// handheld's built-in controls itself and calls window.__nativePad(name, axes,
// buttons) whenever they change; the WebView's own Gamepad API often misses
// built-in controllers or reports them without the standard mapping. Here that
// state is served as a Standard Gamepad from navigator.getGamepads(), so
// controller.js works unchanged.
//
// Face buttons. The game's layout is by position (controller.js): bottom
// jump, right interact, left call the mount, top ping. A Standard Gamepad
// puts them at 0 bottom, 1 right, 2 left, 3 top. But Android reports buttons by
// their printed letter (KEYCODE_BUTTON_A is 0, B is 1, X 2, Y 3), and the
// Retroid Pocket prints them Nintendo-style: A right, B bottom, X top, Y left.
// So on such a handheld index 0 is the right button. padFaces() says which:
//   faces   'xbox' (A at the bottom: Xbox, PlayStation) or 'nintendo' (A on the right)
//   byLabel the indices are letters, not positions (Android with Nintendo labels):
//           Controller moves them to their positions (controller.js toPositions)
// The setting "Controller buttons" (setFaces) picks one when Auto guesses wrong:
// 'auto', 'xbox', 'nintendo', or 'nintendo-xbox' (a Retroid switched to its
// own "Xbox style": Nintendo letters printed, but reported by position).
//
// Prompts in the game are written for Xbox / PlayStation, by position ("A / ×"
// is the bottom button, "B / ○" the right one; "RT / R2", "View", "Menu"). On
// Android handhelds the buttons are printed A B X Y, L1 R1 L2 R2, Select and
// Start, and with Nintendo labels the bottom button is B: padText() rewrites
// prompts to those names, and watchLabels() applies it to all text on the page.
// Menus confirm with the button printed A and go back with B, whatever the
// layout (each platform's own habit): confirmKey() / backKey() name them.

// The player's own buttons and keys (src/remap.js): the prompts are written with the default ones, and
// rewrite() renames those too (padRename: "A / ×" is the button now bound to jump; keyRename: an "E" key badge
// the key now bound to use), except under .pad-raw (the menus' own confirm / back, which never move).

import { installPadMaps } from './pad-maps.js';
import { padRename, keyRename, hasRenames, onControlPrefs } from './remap.js';
import { onLanguage } from './i18n.js';

let native = null;

export function installNativePad(win = globalThis.window) {
  if (!win || win.__nativePad) return;
  win.__nativePad = (id, axes, buttons) => {
    const first = !native || native.id !== id;
    native = {
      id, index: 0, connected: true, mapping: 'standard', timestamp: win.performance?.now?.() ?? Date.now(),
      axes, buttons: buttons.map((v) => ({ pressed: v > 0.5, touched: v > 0.05, value: v })),
    };
    if (first) { memo = null; win.dispatchEvent?.(new Event('nativepadconnected')); applyLayout(win); }
  };
  win.addEventListener?.('gamepadconnected', () => { memo = null; applyLayout(win); });   // (a Retroid's name, an Xbox pad's)
  const nav = win.navigator;
  if (!nav) return;
  const original = nav.getGamepads?.bind(nav);
  nav.getGamepads = () => (native ? [native, null, null, null] : original?.() ?? []);
  installPadMaps(win);   // (pads without the standard mapping, an 8BitDo in D-input on a Mac: read as standard, src/pad-maps.js)
}

export const nativePad = () => native;

/** 'android' (A B X Y · L1 R1 · Select Start) in the Android app, on a Retroid, or with ?pad=android; else 'standard'. */
export function padLayout(win = globalThis.window) {
  const forced = new URLSearchParams(win?.location?.search ?? '').get('pad') ?? safe(() => win.localStorage.getItem('moebius.pad'));
  if (forced === 'android' || forced === 'standard') return forced;
  if (win?.Capacitor?.isNativePlatform?.() || native) return 'android';
  return padIds(win).some((id) => /retroid|odin|anbernic|ayn/i.test(id)) ? 'android' : 'standard';
}
const safe = (f) => { try { return f(); } catch { return null; } };
const padIds = (win) => (safe(() => Array.from(win.navigator.getGamepads?.() ?? [])) ?? []).filter(Boolean).map((p) => p.id ?? '');

// pads that print their letters where Xbox does, even on Android
const XBOX_LIKE = /xbox|x-box|microsoft|playstation|dualsense|dualshock|sony|wireless controller/i;

let facesSetting = 'auto';
let memo = null;   // { at, value } for the page's own window: padFaces() is asked every frame
/** The "Controller buttons" setting: 'auto' | 'xbox' | 'nintendo' | 'nintendo-xbox'. */
export function setFaces(value, win = globalThis.window) {
  const v = ['xbox', 'nintendo', 'nintendo-xbox'].includes(value) ? value : 'auto';
  if (v === facesSetting) return;
  facesSetting = v; memo = null;
  relabel(win);
}
export const facesChoice = () => facesSetting;

/** Where the printed letters are, and whether the pad's indices are letters rather than positions (see the top). */
export function padFaces(win = globalThis.window, setting = facesSetting) {
  const page = win && win === globalThis.window && setting === facesSetting;
  const now = Date.now();
  if (page && memo && now - memo.at < 1000) return memo.value;
  const android = padLayout(win) === 'android';
  let faces;
  if (setting === 'xbox') faces = 'xbox';
  else if (setting === 'nintendo' || setting === 'nintendo-xbox') faces = 'nintendo';
  else if (!android) faces = 'xbox';
  else {
    const ids = native ? [native.id] : padIds(win);
    faces = ids.length && ids.every((id) => XBOX_LIKE.test(id)) ? 'xbox' : 'nintendo';   // the Retroid and its kind
  }
  const value = { faces, byLabel: faces === 'nintendo' && android && setting !== 'nintendo-xbox' };
  if (page) memo = { at: now, value };
  return value;
}

/** The raw button index (as navigator.getGamepads() has it) that confirms ('ok', printed A) or goes back ('back', printed B) in menus. */
export function padIndex(role, win = globalThis.window) {
  const { faces, byLabel } = padFaces(win);
  const aRaw = faces === 'nintendo' && !byLabel ? 1 : 0;   // printed A: index 0, unless the pad reports positions with A on the right
  return role === 'ok' ? aRaw : 1 - aRaw;
}

/** The menu's confirm / back buttons as a prompt names them (by position, Xbox form: padText makes them "A" / "B"). */
export const confirmKey = (win = globalThis.window) => (padFaces(win).faces === 'nintendo' ? 'B / ○' : 'A / ×');
export const backKey = (win = globalThis.window) => (padFaces(win).faces === 'nintendo' ? 'A / ×' : 'B / ○');

// the face buttons by position (Xbox / PlayStation form) → the printed letter
const FACE = /\b([ABXY])( ?\/ ?)([×○□△])/g;
const LETTER = {
  xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y' },
  nintendo: { A: 'B', B: 'A', X: 'Y', Y: 'X' },   // bottom B, right A, left Y, top X
};
const ANDROID = [
  [/\bLT ?\/ ?L2\b/g, 'L2'], [/\bRT ?\/ ?R2\b/g, 'R2'], [/\bLB ?\/ ?L1\b/g, 'L1'], [/\bRB ?\/ ?R1\b/g, 'R1'],
  [/\bLB ?\/ ?RB\b/g, 'L1/R1'],
  [/\bLT\b/g, 'L2'], [/\bRT\b/g, 'R2'], [/\bLB\b/g, 'L1'], [/\bRB\b/g, 'R1'],
  [/\bView\b(?= (?:gear|sketchbook|journal|compare))/g, 'Select'], [/\bMenu\b(?= (?:settings|menu|options))/g, 'Start'],
];

let labelFaces = 'xbox';   // what watchLabels() last found

/** A prompt in the given layout's button names ('android': the handheld's) and face letters ('nintendo': B at the bottom). */
export function padText(text, layout = 'android', faces = labelFaces) {
  if (!text) return text;
  let out = text;
  if (faces === 'nintendo' || layout === 'android') {
    const letters = LETTER[faces] ?? LETTER.xbox;
    out = out.replace(FACE, (_, l) => letters[l]);
  }
  if (layout !== 'android') return out;
  for (const [re, to] of ANDROID) out = out.replace(re, to);
  return out;
}

/**
 * A prompt as the page shows it: the player's own buttons (remap: false under .pad-raw), then the pad's names.
 * `keys`: a keyboard key badge's text, renamed whole ("E" → "F") when its verb moved.
 */
export function promptText(text, { layout: lay = layout, faces = labelFaces, remap = true, key = false } = {}) {
  if (!text) return text;
  if (key) {
    const names = keyRename(), s = text.trim();
    if (names.has(s)) return names.get(s);
    const pair = s.match(/^([^/\s]+)\/([^/\s]+)$/);   // ("W/S", "A/D")
    if (pair && (names.has(pair[1]) || names.has(pair[2]))) return `${names.get(pair[1]) ?? pair[1]}/${names.get(pair[2]) ?? pair[2]}`;
  }
  return padText(remap ? padRename(text) : text, lay, faces);
}

let observer = null, layout = 'standard';
const source = new WeakMap();   // text node → [its text as the game wrote it, what we made of it]
const rawAt = (n) => !!n?.closest?.('.pad-raw');
function rewrite(node, raw = rawAt(node.nodeType === 3 ? node.parentElement : node)) {
  if (node.nodeType === 3) {
    const seen = source.get(node);
    const src = seen && seen[1] === node.nodeValue ? seen[0] : node.nodeValue;
    const t = promptText(src, { remap: !raw, key: !!node.parentElement?.classList?.contains('key') });
    if (t !== node.nodeValue) node.nodeValue = t;
    if (t !== src) source.set(node, [src, t]); else source.delete(node);
    return;
  }
  if (node.nodeType !== 1 || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
  const r = raw || !!node.classList?.contains('pad-raw');
  for (const c of node.childNodes) rewrite(c, r);
}

/** Keep every prompt on the page in the pad's own button names (else a no-op). */
export function watchLabels(win = globalThis.window) {
  if (!win?.document?.body) return;
  layout = padLayout(win);
  labelFaces = padFaces(win).faces;
  if (observer) { rewrite(win.document.body); return; }
  if (layout !== 'android' && labelFaces !== 'nintendo' && !hasRenames()) return;
  rewrite(win.document.body);
  observer = new win.MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') rewrite(m.target);
      else for (const n of m.addedNodes) rewrite(n);
    }
  });
  observer.observe(win.document.body, { subtree: true, childList: true, characterData: true });
}
function applyLayout(win) { if (win?.document?.body) watchLabels(win); }
const relabel = applyLayout;
onControlPrefs(() => relabel(globalThis.window));   // (a verb moved: every prompt on the page again)
onLanguage(() => relabel(globalThis.window));       // (the keys' names in the language: 'ESPACE')
