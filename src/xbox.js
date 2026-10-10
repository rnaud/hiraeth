// The Xbox app around the game (xbox/: a UWP app with WebView2, docs/systems/xbox.md). In a browser and on the
// other platforms all of this is a no-op: everything here starts with onXbox().
//
// - Detection: the app puts window.__hiraethXbox ({ api, app, tvSafe }) on every page before its scripts run
//   and adds "HiraethXbox/<api>" to the user agent; ?platform=xbox fakes it in a browser for a session.
// - The defaults it picks elsewhere: the Xbox button prompts (src/native-pad.js), the Xbox quality preset
//   (src/perf.js QUALITY_PRESETS.xbox, through src/ui.js), "XBOX" first on the frame readout with a JIT probe
//   and the JS heap (src/main.js), the settings' update section (src/native-app.js: the app answers the same
//   calls as Android's AppShell, over WebView2's web messages).
// - The TV's safe area: .tv-safe on the root moves every --safe-* inset (index.html) to at least 5 % of the
//   screen, Xbox's guidance for TVs (48 × 27 of 960 × 540); the 3D picture still fills the screen.
// - The B button: the app keeps the system's Back from closing the game and sends moebius:back. The game reads
//   B from the Gamepad API like any other button; when no pad reaches the page, Back becomes an Escape press.
// - Pause and resume: the app sends moebius:pause / moebius:resume like Android's (src/audio-guard.js).
// - The pad read by the app: the console's WebView2 never saw A or B, so the app reads the controller itself and
//   posts it here ({ hiraeth: 'pad', pads }); listenHostPad folds it into navigator.getGamepads().

/** The app's user agent token (xbox/Hiraeth/MainPage.xaml.cs UserAgentToken). */
export const XBOX_UA = /\bHiraethXbox\/(\d+)/;
/** The page's origin in the app (MainPage.Host): fixed for good, the saves live in its storage. */
export const XBOX_HOST = 'hiraeth.example';
const FAKE_KEY = 'moebius.platform';
const safe = (f) => { try { return f(); } catch { return null; } };

/** Whether this page runs in the Xbox app (or fakes it: ?platform=xbox, kept for the session's later pages). */
export function onXbox(win = globalThis.window) {
  if (!win) return false;
  if (win.__hiraethXbox) return true;
  if (XBOX_UA.test(win.navigator?.userAgent ?? '')) return true;
  const asked = safe(() => new URLSearchParams(win.location?.search ?? '').get('platform'));
  if (asked === 'xbox') { safe(() => win.sessionStorage?.setItem(FAKE_KEY, 'xbox')); return true; }
  if (asked) { safe(() => win.sessionStorage?.removeItem(FAKE_KEY)); return false; }
  return safe(() => win.sessionStorage?.getItem(FAKE_KEY)) === 'xbox';
}

/** The app's level (its XboxApi; 0 when faked in a browser or not on the Xbox). */
export function xboxApi(win = globalThis.window) {
  const own = +win?.__hiraethXbox?.api;
  if (own > 0) return own;
  const m = XBOX_UA.exec(win?.navigator?.userAgent ?? '');
  return m ? +m[1] : 0;
}

/** Whether to keep the HUD inside the TV's safe area: on the Xbox unless the app or ?tvsafe=0 says not. */
export function tvSafe(win = globalThis.window) {
  if (!onXbox(win)) return false;
  const q = safe(() => new URLSearchParams(win.location?.search ?? '').get('tvsafe'));
  if (q === '0') return false;
  if (q === '1') return true;
  return win.__hiraethXbox?.tvSafe !== false;
}

/** The root's classes for the Xbox (.xbox, .tv-safe), the Back button's fallback. Once per page. */
export function installXbox(win = globalThis.window) {
  if (!onXbox(win) || win.__xboxInstalled) return false;
  win.__xboxInstalled = true;
  const root = win.document?.documentElement;
  root?.classList?.add('xbox');
  root?.classList?.toggle('tv-safe', tvSafe(win));
  win.addEventListener?.('moebius:back', () => backFallback(win));
  focusAlways(win);
  forwardLogs(win);
  listenHostPad(win);
  return true;
}

// ------------------------------------------------------------------ the pad, read by the app (xbox/Hiraeth/HostPad.cs)
// On a Series X the page's Gamepad API saw only D-pad up, down and left, never A, B or D-pad right (WebView2 in a UWP
// app: the presses XAML took never reached it). The app reads every pad through Windows.Gaming.Input and posts each
// change: { hiraeth: 'pad', pads: [{ buttons: [17 values], axes: [4] }] }, in the Standard Gamepad's order. Here
// navigator.getGamepads() then serves the real pads with the app's presses added (a press seen by either counts), and
// a standard pad of the app's own for one the page doesn't see at all. The game's controller reads it unchanged.
// Nothing changes until the first such message: an older app sends none.

/** The id of a pad only the app sees (it ends with STANDARD GAMEPAD, like WebView2's own: src/native-pad.js families). */
export const HOST_PAD_ID = 'Xbox Controller (read by the Hiraeth app) (STANDARD GAMEPAD)';
const TRIGGERS = new Set([6, 7]);
const num = (v) => { const n = +v; return Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0; };
/** A button of the app's reading as the Gamepad API has it (a trigger counts as pressed from a light squeeze, as Chrome's XInput does). */
const hostButton = (v, i) => {
  const value = Math.max(0, num(v));
  const pressed = TRIGGERS.has(i) ? value > 0.12 : value >= 0.5;
  return { pressed, touched: pressed, value };
};

/**
 * navigator.getGamepads() with the app's pads folded in: the k-th connected standard pad gets the k-th pad the app
 * read (each button pressed if either says so, the larger value; each axis the one pushed further); an app's pad with
 * no real one beside it is served on its own, in the first free slot.
 */
export function mergePads(real, host, stamp = 0) {
  const out = Array.from(real ?? [], (p) => p ?? null);
  const live = out.flatMap((p, i) => (p?.connected && p.mapping === 'standard' ? [i] : []));
  (host ?? []).forEach((h, k) => {
    const buttons = Array.from({ length: 17 }, (_, i) => hostButton(h?.buttons?.[i], i));
    const axes = Array.from({ length: 4 }, (_, i) => num(h?.axes?.[i]));
    const i = live[k];
    if (i !== undefined) {
      const p = out[i];
      const own = Array.from(p.buttons ?? []), ownAxes = Array.from(p.axes ?? []);
      out[i] = {
        id: p.id, index: p.index, connected: true, mapping: p.mapping, timestamp: Math.max(+p.timestamp || 0, stamp),
        vibrationActuator: p.vibrationActuator ?? null,
        buttons: Array.from({ length: Math.max(own.length, buttons.length) }, (_, j) => {
          const r = own[j], b = buttons[j];
          if (!r) return b;
          if (!b) return r;
          return { pressed: !!(r.pressed || b.pressed), touched: !!(r.touched || b.touched), value: Math.max(+r.value || 0, b.value) };
        }),
        axes: Array.from({ length: Math.max(ownAxes.length, axes.length) }, (_, j) => {
          const r = +ownAxes[j] || 0, a = axes[j] ?? 0;
          return Math.abs(a) > Math.abs(r) ? a : r;
        }),
      };
    } else {
      let slot = out.findIndex((p) => !p);
      if (slot < 0) slot = out.length;
      out[slot] = { id: HOST_PAD_ID, index: slot, connected: true, mapping: 'standard', timestamp: stamp, vibrationActuator: null, buttons, axes };
    }
  });
  return out;
}

/** Take the app's pad messages and, from the first, serve them through navigator.getGamepads(). Once per page; false off the app. */
export function listenHostPad(win = globalThis.window) {
  const wv = win?.chrome?.webview, nav = win?.navigator;
  if (!wv || !nav || !onXbox(win) || win.__xboxHostPad) return false;
  const state = win.__xboxHostPad = { pads: [], stamp: 0, messages: 0, served: false };
  const now = () => safe(() => win.performance.now()) ?? Date.now();
  const serve = () => {
    const original = typeof nav.getGamepads === 'function' ? nav.getGamepads.bind(nav) : () => [];
    const merged = () => mergePads(safe(() => original()) ?? [], state.pads, state.stamp);
    safe(() => Object.defineProperty(nav, 'getGamepads', { value: merged, configurable: true, writable: true }));
    if (nav.getGamepads !== merged) safe(() => { nav.getGamepads = merged; });
    state.served = nav.getGamepads === merged;
    safe(() => wv.postMessage({ hiraeth: 'log', level: 'info', text: `pad: read by the app too (${state.pads.length} pad${state.pads.length === 1 ? '' : 's'})${state.served ? '' : ', but getGamepads could not be replaced'}` }));
  };
  wv.addEventListener('message', (e) => {
    let d = e?.data;
    if (typeof d === 'string') d = safe(() => JSON.parse(d)) ?? d;
    if (d?.hiraeth !== 'pad' || !Array.isArray(d.pads)) return;
    state.pads = d.pads;
    state.stamp = now();
    if (state.messages++ === 0) serve();
  });
  safe(() => wv.postMessage({ hiraeth: 'pad-sync' }));   // (the app sends what is held now)
  return true;
}

/**
 * The console's WebView2 answers document.hasFocus() false while it has the focus and the pad's presses reach it
 * (seen on a Series X, WebView2 150): every page's pad loop reads only while the page has the focus, so the game
 * took no press at all. The app is the whole screen: here the page has the focus whenever it is shown.
 */
export function focusAlways(win = globalThis.window) {
  const doc = win?.document;
  if (!doc) return;
  safe(() => { doc.hasFocus = () => !doc.hidden; });
}

// ------------------------------------------------------------------ the page's log, into the app's (LocalState\web\update.log)
// The console has no DevTools at hand, but its Device Portal can fetch the app's files: the page's warnings and
// errors, the load's stages and timings, and what reaches it from the pad (a pad, or mouse events: the system's
// mouse mode) go to the app over WebView2's web messages ({ hiraeth: 'log', level, text }), which writes them into
// its log. An app from before this ignores them.

/** The console lines worth keeping: warnings and errors (not three.js's shader-compiler notes), the load's timings. */
export const LOG_INFO = /^(load:|shaders:|passage warm-up|gpu pacer|bounds:)/;
const NOISE = /Program Info Log|warning X\d{4}/;
export const LOG_MAX = 300;   // lines a page sends at most

/** Send the page's warnings, errors, load timings and input findings to the app. Once per page; false off the Xbox app. */
export function forwardLogs(win = globalThis.window) {
  const wv = win?.chrome?.webview;
  if (!wv || !onXbox(win) || win.__xboxLogs) return false;
  let sent = 0;
  const post = (level, text) => {
    if (sent >= LOG_MAX) return;
    sent++;
    safe(() => wv.postMessage({ hiraeth: 'log', level, text: (sent === LOG_MAX ? '(the page\'s log stops here) ' : '') + String(text).slice(0, 400) }));
  };
  const show = (a) => (typeof a === 'string' ? a : a instanceof Error ? `${a.message}` : safe(() => JSON.stringify(a)) ?? String(a));
  const con = win.console;
  for (const level of ['warn', 'error', 'info']) {
    const own = con?.[level];
    if (typeof own !== 'function') continue;
    con[level] = function (...args) {
      own.apply(this, args);
      const text = args.map(show).join(' ');
      if (NOISE.test(text) || (level === 'info' && !LOG_INFO.test(text))) return;
      post(level, text);
    };
  }
  win.addEventListener?.('error', (e) => post('error', `${e?.message ?? e} ${e?.filename ? `(${e.filename}:${e.lineno})` : ''}`));
  win.addEventListener?.('unhandledrejection', (e) => post('error', `unhandled: ${show(e?.reason)}`));
  // what the pad looks like from here: a pad on the Gamepad API, or mouse events (the system's mouse mode)
  win.addEventListener?.('gamepadconnected', (e) => post('info', `pad: ${e?.gamepad?.id} (${e?.gamepad?.mapping || 'no mapping'})`));
  let pointers = 0;
  const pointer = (e) => {
    if (++pointers > 1) return;
    const pads = safe(() => Array.from(win.navigator.getGamepads()).filter(Boolean).length) ?? 0;
    post('warn', `mouse input: a ${e?.pointerType || 'mouse'} ${e?.type} (pads seen: ${pads}): the system's mouse mode is on`);
  };
  win.addEventListener?.('pointermove', pointer, { capture: true, passive: true });
  win.addEventListener?.('pointerdown', pointer, { capture: true, passive: true });
  win.__xboxLogs = true;
  post('info', `page: ${win.location?.pathname ?? ''}${win.location?.search ?? ''}`);
  return true;
}

/** Back (the B button seen by the system): an Escape press when no pad reaches the page, else nothing (the page has B already). */
export function backFallback(win = globalThis.window) {
  const pads = safe(() => Array.from(win.navigator?.getGamepads?.() ?? []).filter(Boolean)) ?? [];
  if (pads.length) return false;
  const target = win.document?.activeElement ?? win.document ?? win;
  for (const type of ['keydown', 'keyup']) {
    target.dispatchEvent?.(new win.KeyboardEvent(type, { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
  }
  return true;
}

/** The Graphics setting's choices (src/ui.js): the Xbox preset (src/perf.js QUALITY_PRESETS.xbox) only in the Xbox app. */
export const qualityChoices = (xbox = false) => ['auto', 'handheld', 'deck', ...(xbox ? ['xbox'] : []), 'low', 'medium', 'high'];

let seq = 0;
/**
 * Ask the app (MainPage.OnMessage): info, check, download, restart, the same calls as Android's AppShell.
 * WebView2's web messages: { hiraeth: 'call', id, method } out, { hiraeth: 'reply', id, result | error } back.
 */
export function xboxCall(method, win = globalThis.window, { timeout = 15000 } = {}) {
  const wv = win?.chrome?.webview;
  if (!wv || !onXbox(win)) return Promise.reject(new Error('not in the Xbox app'));
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const done = (e) => {
      let d = e?.data;
      if (typeof d === 'string') d = safe(() => JSON.parse(d)) ?? d;
      if (d?.hiraeth !== 'reply' || d.id !== id) return;
      wv.removeEventListener('message', done); clearTimeout(timer);
      if (d.error) reject(new Error(d.error)); else resolve(d.result ?? null);
    };
    const timer = setTimeout(() => { wv.removeEventListener('message', done); reject(new Error('The app didn\'t answer')); }, timeout);
    wv.addEventListener('message', done);
    wv.postMessage({ hiraeth: 'call', id, method });
  });
}

/** The Xbox app as src/native-app.js's shell (null elsewhere, and in a browser faking it: no app to ask). */
export const xboxShell = (win = globalThis.window) => (onXbox(win) && win?.chrome?.webview ? { call: (method) => xboxCall(method, win) } : null);

// ------------------------------------------------------------------ the JIT probe (the frame readout)
// Is JavaScript's JIT on in this WebView? An integer loop: optimised by the JIT it takes about a nanosecond a
// turn on a console's CPU; interpreted (a "jitless" engine) ten to forty. Run twice, the quicker kept (the
// first run pays for the compile). About 2 ms with the JIT, 40 to 80 without; once a page, when asked.
export function jitProbe({ now = () => globalThis.performance.now(), n = 1_000_000 } = {}) {
  let best = Infinity, x = 0;
  for (let run = 0; run < 2; run++) {
    const t0 = now();
    for (let i = 0; i < n; i++) x = ((x + i * 7) ^ (x >>> 3)) | 0;
    best = Math.min(best, ((now() - t0) * 1e6) / n);
  }
  return { ns: best, verdict: jitVerdict(best), sink: x };
}

/** 'on' under 4 ns a turn, 'off' over 12, else 'unsure' (a busy moment, a slow CPU). */
export const jitVerdict = (ns) => (!(ns >= 0) ? 'unsure' : ns < 4 ? 'on' : ns > 12 ? 'off' : 'unsure');

let probed = null;
/** The readout's line for the console (" · jit on 1.1 ns · js 240 MB"), or '' off the Xbox (?jit=1 shows it anywhere). */
export function xboxReadout(win = globalThis.window) {
  const asked = safe(() => new URLSearchParams(win?.location?.search ?? '').get('jit')) === '1';
  if (!onXbox(win) && !asked) return '';
  probed ??= jitProbe();
  const heap = win?.performance?.memory?.usedJSHeapSize;
  // (the app's memory limit, from an app that tells it: about 1 GB as an App, the GPU shared; 5 as a Game)
  const limit = +win?.__hiraethXbox?.memory;
  return ` · jit ${probed.verdict} ${probed.ns.toFixed(1)} ns${heap ? ` · js ${Math.round(heap / 1048576)} MB` : ''}${limit > 0 ? ` · ${limit < 2048 ? 'app' : 'game'} ${(limit / 1024).toFixed(1)} GB` : ''}`;
}
