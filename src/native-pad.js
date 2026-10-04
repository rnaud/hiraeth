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

/** A prompt in the given layout's button names. */
export function padText(text, layout = 'android') {
  if (layout !== 'android' || !text) return text;
  let out = text;
  for (const [re, to] of ANDROID) out = out.replace(re, to);
  return out;
}

let observer = null;
function rewrite(node) {
  if (node.nodeType === 3) {
    const t = padText(node.nodeValue);
    if (t !== node.nodeValue) node.nodeValue = t;
    return;
  }
  if (node.nodeType !== 1 || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
  for (const c of node.childNodes) rewrite(c);
}

/** Keep every prompt on the page in Android button names (no-op in the standard layout). */
export function watchLabels(win = globalThis.window) {
  if (!win?.document?.body || observer || padLayout(win) !== 'android') return;
  rewrite(win.document.body);
  observer = new win.MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') rewrite(m.target);
      else for (const n of m.addedNodes) rewrite(n);
    }
  });
  observer.observe(win.document.body, { subtree: true, childList: true, characterData: true });
}
function applyLayout(win) { if (win.document?.body) watchLabels(win); }
