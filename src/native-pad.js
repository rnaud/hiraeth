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

import { installPadMaps, eightBitDoLetters } from './pad-maps.js';
import { padRename, keyRename, onControlPrefs } from './remap.js';
import { onLanguage } from './i18n.js';
import { onXbox } from './xbox.js';

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
  win.addEventListener?.('gamepaddisconnected', () => { memo = null; setTimeout(() => applyLayout(win), 0); });   // (its prompts go with it)
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

// ---- which controller is it (its prompts: src/pad-glyphs.js)
// The game writes its prompts in Xbox / PlayStation form ("A / ×"); the page shows the half that
// matches the pad in hand, from the Gamepad's id (Chrome: "Xbox Wireless Controller (STANDARD GAMEPAD
// Vendor: 045e …)", "DualSense Wireless Controller (… Vendor: 054c …)", "Pro Controller (… 057e …)"):
//   'xbox'         A B X Y · LB RB LT RT · View Menu (also any pad we don't know: the standard's own names)
//   'playstation'  × ○ □ △ · L1 R1 L2 R2 · Create Options
//   'nintendo'     a Switch pad (or an 8BitDo with Nintendo letters, the SN30 Pro) on a computer: B at the
//                  bottom, A on the right · L R ZL ZR · − +
//   'handheld'     the Android app or a Retroid: the handheld's own names (padText's 'android' layout)
const IS_XBOX = /xbox|x-box|xinput|microsoft|045e/i;
const IS_PLAYSTATION = /playstation|dualsense|dualshock|sony|054c|\bps[345]\b|^wireless controller/i;
const IS_NINTENDO = /nintendo|057e|pro controller|joy-?con|switch/i;
const IS_HANDHELD = /retroid|odin|anbernic|ayn/i;
// Steam Input's own pads (the Steam Deck's controls in its app and in Gaming Mode, any pad Steam wraps):
// Valve's vendor id 28de, "Steam Virtual Gamepad", "Steam Deck"; Steam draws them as an Xbox pad
const IS_STEAM = /\b28de\b|steam virtual gamepad|steam deck|steam controller|valve/i;

/** A pad's family from its Gamepad id (see above); '' for no id. */
export function familyOf(id) {
  const s = String(id ?? '');
  if (!s) return '';
  if (IS_HANDHELD.test(s)) return 'handheld';
  if (IS_STEAM.test(s)) return 'xbox';
  if (IS_XBOX.test(s)) return 'xbox';
  if (IS_PLAYSTATION.test(s)) return 'playstation';
  if (IS_NINTENDO.test(s)) return 'nintendo';
  // an 8BitDo in D-input (Chrome on a Mac: "8Bitdo SN30 Pro (Vendor: 2dc8 Product: 6101)"): the letters it prints
  if (eightBitDoLetters(s) === 'nintendo') return 'nintendo';
  return 'xbox';
}

/** The family of the pad on this page: 'handheld' in the Android layout, else the first listed pad's; '' with none. */
export function padFamily(win = globalThis.window) {
  if (padLayout(win) === 'android') return 'handheld';
  const ids = native ? [native.id] : padIds(win);
  return ids.length ? familyOf(ids[0]) : '';
}

// ---- one half of "A / ×", always
// A browser lists a pad only after its first press on the page (each world is a new page), and Steam
// Input's pads on the Steam Deck the same: until then padFamily() is ''. The prompts used to stay as
// written then ("A / × jump", both halves); now the page picks a half from the best it knows:
//   1. the pad listed now (padFamily)
//   2. the family of the last pad listed on this device (remembered: rememberFamily, localStorage)
//   3. the platform's own (platformFamily): the Steam Deck's app or a Steam pad → Xbox letters
//      (Steam draws its pads so); the Android app is the 'handheld' layout already; anything else the
//      standard's own names, Xbox's.
export const PAD_FAMILY_KEY = 'moebius.padFamily.v1';
const FAMILIES = new Set(['xbox', 'playstation', 'nintendo', 'handheld']);
const store = (win) => safe(() => win?.localStorage) ?? null;
/** The family of the last pad listed on this device ('' none yet). */
export function rememberedFamily(win = globalThis.window) {
  const v = safe(() => store(win)?.getItem(PAD_FAMILY_KEY));
  return FAMILIES.has(v) ? v : '';
}
/** Remember a listed pad's family for the pages after (a new world, the next launch). */
export function rememberFamily(family, win = globalThis.window) {
  if (FAMILIES.has(family) && rememberedFamily(win) !== family) safe(() => store(win)?.setItem(PAD_FAMILY_KEY, family));
}
/** The Steam Deck: its app (the moebius: page, src/ui.js isDeckApp), Steam's browser, or a Steam pad on the list. */
export function onSteam(win = globalThis.window) {
  if (win?.location?.protocol === 'moebius:') return true;
  if (/steamdeck|valve steam|steam(?:os)?\b/i.test(win?.navigator?.userAgent ?? '')) return true;
  return padIds(win).some((id) => IS_STEAM.test(id));
}
/** The platform's own family when no pad is known (see above): never ''. */
export function platformFamily(win = globalThis.window) {
  if (padLayout(win) === 'android') return 'handheld';
  if (onXbox(win)) return 'xbox';   // (the Xbox app: src/xbox.js)
  if (onSteam(win)) return 'xbox';
  return 'xbox';
}
/** The family the page's prompts are drawn for: the listed pad's, else the remembered one, else the platform's. Never ''.
 *  In the Xbox app always Xbox's: the console's pads are Xbox pads, whatever id its WebView2 gives them. */
export function pageFamily(win = globalThis.window) {
  if (onXbox(win)) return 'xbox';
  return padFamily(win) || rememberedFamily(win) || platformFamily(win);
}

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
  else if (!android) faces = padIds(win).some((id) => familyOf(id) === 'nintendo') ? 'nintendo' : 'xbox';   // (a Switch pad: A on the right, reported by position)
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

// the other buttons, for each family on a computer (Xbox / PlayStation form → the family's own names)
const SHOULDERS = (lb, rb, lt, rt) => [
  [/\bLT ?\/ ?L2\b/g, lt], [/\bRT ?\/ ?R2\b/g, rt], [/\bLB ?\/ ?L1\b/g, lb], [/\bRB ?\/ ?R1\b/g, rb], [/\bLB ?\/ ?RB\b/g, `${lb}/${rb}`],
];
const VIEW_MENU = (view, menu) => [
  [/\bView\b(?= (?:gear|sketchbook|journal|compare|\+|held))/g, view], [/\bMenu\b(?= (?:settings|menu|options|\/))/g, menu],
];
const FAMILY = {
  xbox: [...SHOULDERS('LB', 'RB', 'LT', 'RT'), [/\bL3\b/g, 'LS'], [/\bR3\b/g, 'RS']],
  playstation: [...SHOULDERS('L1', 'R1', 'L2', 'R2'), [/\bLT\b/g, 'L2'], [/\bRT\b/g, 'R2'], [/\bLB\b/g, 'L1'], [/\bRB\b/g, 'R1'], ...VIEW_MENU('Create', 'Options')],
  nintendo: [...SHOULDERS('L', 'R', 'ZL', 'ZR'), [/\bLT\b/g, 'ZL'], [/\bRT\b/g, 'ZR'], [/\bLB\b/g, 'L'], [/\bRB\b/g, 'R'], [/\bL3\b/g, 'LS'], [/\bR3\b/g, 'RS'], ...VIEW_MENU('−', '+')],
};
const SYMBOL = { A: '×', B: '○', X: '□', Y: '△' };

let labelFaces = 'xbox';   // what watchLabels() last found
let labelFamily = '';      // and the pad's family (pageFamily: never '' once watchLabels has run)

/**
 * A prompt in the given layout's button names ('android': the handheld's) and face letters ('nintendo': B at the bottom).
 * `family` (on a computer, 'standard'): the half of "A / ×" that matches the pad, and its own shoulder and menu names.
 */
export function padText(text, layout = 'android', faces = labelFaces, family = '') {
  if (!text) return text;
  let out = text;
  if (layout !== 'android' && family === 'handheld') layout = 'android';
  if (layout !== 'android' && !FAMILY[family]) family = faces === 'nintendo' ? 'nintendo' : 'xbox';   // (no pad known: one half, never the pair)
  if (layout !== 'android' && FAMILY[family]) {
    const nin = family === 'nintendo' || (faces === 'nintendo' && family !== 'playstation');
    out = out.replace(FACE, (_, l) => (family === 'playstation' ? SYMBOL[l] : (nin ? LETTER.nintendo : LETTER.xbox)[l]));
    for (const [re, to] of FAMILY[family]) out = out.replace(re, to);
    return out;
  }
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
export function promptText(text, { layout: lay = layout, faces = labelFaces, family = labelFamily, remap = true, key = false } = {}) {
  if (!text) return text;
  if (key) {
    const names = keyRename(), s = text.trim();
    if (names.has(s)) return names.get(s);
    const pair = s.match(/^([^/\s]+)\/([^/\s]+)$/);   // ("W/S", "A/D")
    if (pair && (names.has(pair[1]) || names.has(pair[2]))) return `${names.get(pair[1]) ?? pair[1]}/${names.get(pair[2]) ?? pair[2]}`;
  }
  return padText(remap ? padRename(text) : text, lay, faces, family);
}

/** What the page's prompts are drawn for now: { layout, faces, family } (src/pad-glyphs.js reads it). */
export const labelState = () => ({ layout, faces: labelFaces, family: labelFamily });
const labelHooks = new Set();
/** Called whenever the page's labels are worked out again (a pad connected or gone, the setting, a language). */
export const onLabels = (fn) => { labelHooks.add(fn); return () => labelHooks.delete(fn); };

let observer = null, layout = 'standard';
const source = new WeakMap();   // text node → [its text as the game wrote it, what we made of it]
const rawAt = (n) => !!n?.closest?.('.pad-raw');
function rewrite(node, raw = rawAt(node.nodeType === 3 ? node.parentElement : node)) {
  if (node.nodeType === 3) {
    if (node.parentElement?.closest?.('[data-glyph]')) return;   // (a button's glyph: drawn for the pad already, src/pad-glyphs.js)
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
  const listed = padFamily(win);
  if (listed) rememberFamily(listed, win);
  labelFamily = onXbox(win) ? 'xbox' : listed || rememberedFamily(win) || platformFamily(win);
  for (const fn of labelHooks) { try { fn(labelState()); } catch (e) { console.warn('labels', e); } }
  if (observer) { rewrite(win.document.body); return; }
  // (always: every prompt is written as a pair, "A / ×", and the page shows one half)
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
