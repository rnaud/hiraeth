// Controllers on Android, and button labels for them.
//
// In the Android app (android/.../GamepadBridge.java) the activity reads the
// handheld's built-in controls itself and calls window.__nativePad(name, axes,
// buttons) whenever they change; the WebView's own Gamepad API often misses
// built-in controllers or reports them without the standard mapping. Here that
// state is served as a Standard Gamepad from navigator.getGamepads(), so
// controller.js works unchanged.
//
// Prompts in the game are written for Xbox / PlayStation ("A / ×", "RT / R2",
// "View", "Menu"). On Android handhelds such as the Retroid Pocket the buttons
// are printed A B X Y, L1 R1 L2 R2, Select and Start: padText() rewrites
// prompts to those names, and watchLabels() applies it to all text on the page.
//
// "Swap A/B" in the settings (setSwapAB) trades the two buttons for players
// who expect the other one to confirm and jump (Controller swaps the button
// indices, see controller.js); the prompts then name the other letter too.

let native = null;

export function installNativePad(win = globalThis.window) {
  if (!win || win.__nativePad) return;
  win.__nativePad = (id, axes, buttons) => {
    const first = !native;
    native = {
      id, index: 0, connected: true, mapping: 'standard', timestamp: win.performance?.now?.() ?? Date.now(),
      axes, buttons: buttons.map((v) => ({ pressed: v > 0.5, touched: v > 0.05, value: v })),
    };
    if (first) { win.dispatchEvent?.(new Event('nativepadconnected')); applyLayout(win); }
  };
  const nav = win.navigator;
  if (!nav) return;
  const original = nav.getGamepads?.bind(nav);
  nav.getGamepads = () => (native ? [native, null, null, null] : original?.() ?? []);
}

export const nativePad = () => native;

/** 'android' (A B X Y · L1 R1 · Select Start) in the Android app, on a Retroid, or with ?pad=android; else 'standard'. */
export function padLayout(win = globalThis.window) {
  const forced = new URLSearchParams(win?.location?.search ?? '').get('pad') ?? safe(() => win.localStorage.getItem('moebius.pad'));
  if (forced === 'android' || forced === 'standard') return forced;
  if (win?.Capacitor?.isNativePlatform?.() || native) return 'android';
  const pads = safe(() => Array.from(win.navigator.getGamepads?.() ?? [])) ?? [];
  return pads.some((p) => p && /retroid|odin|anbernic|ayn/i.test(p.id)) ? 'android' : 'standard';
}
const safe = (f) => { try { return f(); } catch { return null; } };

const ANDROID = [
  [/\bA ?\/ ?×/g, 'A'], [/\bB ?\/ ?○/g, 'B'], [/\bX ?\/ ?□/g, 'X'], [/\bY ?\/ ?△/g, 'Y'],
  [/\bLT ?\/ ?L2\b/g, 'L2'], [/\bRT ?\/ ?R2\b/g, 'R2'], [/\bLB ?\/ ?L1\b/g, 'L1'], [/\bRB ?\/ ?R1\b/g, 'R1'],
  [/\bLB ?\/ ?RB\b/g, 'L1/R1'],
  [/\bLT\b/g, 'L2'], [/\bRT\b/g, 'R2'], [/\bLB\b/g, 'L1'], [/\bRB\b/g, 'R1'],
  [/\bView\b(?= (?:sketchbook|journal))/g, 'Select'], [/\bMenu\b(?= (?:settings|menu))/g, 'Start'],
];

let swapped = false;
/** Swap A and B (confirm / back, jump / push) and their names in the prompts. */
export function setSwapAB(on, win = globalThis.window) {
  if (swapped === !!on) return;
  swapped = !!on;
  relabel(win);
}
export const swapAB = () => swapped;

const SWAP = /\b([AB])( ?\/ ?)([×○])/g;

/** A prompt in the given layout's button names (and with A and B traded when swapped). */
export function padText(text, layout = 'android', swap = swapped) {
  if (!text) return text;
  let out = swap ? text.replace(SWAP, (_, l, sep) => (l === 'A' ? `B${sep}○` : `A${sep}×`)) : text;
  if (layout !== 'android') return out;
  for (const [re, to] of ANDROID) out = out.replace(re, to);
  return out;
}

let observer = null, layout = 'standard';
const source = new WeakMap();   // text node → [its text as the game wrote it, what we made of it]
function rewrite(node) {
  if (node.nodeType === 3) {
    const seen = source.get(node);
    const src = seen && seen[1] === node.nodeValue ? seen[0] : node.nodeValue;
    const t = padText(src, layout);
    if (t !== node.nodeValue) node.nodeValue = t;
    if (t !== src) source.set(node, [src, t]); else source.delete(node);
    return;
  }
  if (node.nodeType !== 1 || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
  for (const c of node.childNodes) rewrite(c);
}

/** Keep every prompt on the page in Android button names, and A/B swapped when set (else a no-op). */
export function watchLabels(win = globalThis.window) {
  if (!win?.document?.body) return;
  layout = padLayout(win);
  if (observer) { rewrite(win.document.body); return; }
  if (layout !== 'android' && !swapped) return;
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
