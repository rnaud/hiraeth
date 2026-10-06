// Silence while the game is away: the Android app asleep, at home or in the recents, or the
// page hidden. One guard per page (audioGuard(win)), installed before any sound exists
// (src/boot.js, and every Sound), so it holds on the title screen and while a world loads too.
//
// Why it has to be the page's own: GeckoView (the app's engine) deliberately keeps a page that
// plays Web Audio running in the background (Gecko's BrowsingContext::InactiveForSuspend: "playing
// web audio" is an awake request), and the system WebView keeps rendering it too. So the music
// went on with the screen off unless the page itself suspended every AudioContext it had.
//
// - Away = the app said so (moebius:pause, until moebius:resume; window.__moebiusAway when a page
//   starts while the app is away) or the page is hidden or frozen. Input never brings it back.
// - Every AudioContext is registered in one place: the page's AudioContext constructor is wrapped,
//   so the game's Sound, the title's, the bell in src/story/arzach2.js and anything later all are.
// - Going away suspends every context (and remembers the ones that were playing); resume() on any
//   of them does nothing while away (it resumes on return instead); a context made while away is
//   suspended at once. Coming back resumes the ones that were playing.
// - on(fn) tells the owners (Sound mutes its master gain as well), whenBack(fn) runs a deferred
//   start once the page is back.

const KEY = '__moebiusAudioGuard';

/** The page's guard (installed on first use); null without a window. */
export function audioGuard(win = globalThis.window) {
  if (!win) return null;
  return win[KEY] ?? (win[KEY] = createGuard(win));
}

/** Whether sound must stay silent now (no window: never). */
export const audioAway = (win = globalThis.window) => audioGuard(win)?.away() ?? false;

function createGuard(win) {
  const doc = win.document;
  const contexts = new Set(), subs = new Set();
  let pending = [];
  let appAway = win.__moebiusAway === true, frozen = false, away = false;
  const wants = new WeakSet();   // contexts to resume on return

  const isAway = () => appAway || frozen || !!doc?.hidden;
  const AC = win.AudioContext, WAC = win.webkitAudioContext;
  const protos = [...new Set([AC, WAC].filter(Boolean).map((C) => C.prototype))];
  const realResume = new Map(), realSuspend = new Map();
  const call = (map, ctx) => {
    for (const [proto, f] of map) if (proto.isPrototypeOf(ctx)) return f.call(ctx);
    return (map === realResume ? ctx.resume : ctx.suspend)?.call(ctx);
  };
  const quiet = (p) => { p?.catch?.(() => {}); return p; };
  const suspend = (ctx) => quiet(call(realSuspend, ctx));
  const resume = (ctx) => quiet(call(realResume, ctx));

  const track = (ctx) => {
    if (!ctx || contexts.has(ctx)) return ctx;
    contexts.add(ctx);
    ctx.addEventListener?.('statechange', () => { if (ctx.state === 'closed') contexts.delete(ctx); });
    if (away && ctx.state !== 'closed') { if (ctx.state !== 'suspended') wants.add(ctx); suspend(ctx); }
    return ctx;
  };

  // resume() and suspend() on every context, through the guard
  for (const proto of protos) {
    if (proto[KEY]) continue;
    const r = proto.resume, s = proto.suspend;
    realResume.set(proto, r); realSuspend.set(proto, s);
    proto.resume = function () {
      track(this);
      if (away) { wants.add(this); return Promise.resolve(); }
      return r.call(this);
    };
    proto.suspend = function () { track(this); wants.delete(this); return s.call(this); };
    proto[KEY] = true;
  }
  // and every new one registered (made while away: suspended at once)
  const wrap = (C) => C && class extends C { constructor(...args) { super(...args); track(this); } };
  if (AC) win.AudioContext = wrap(AC);
  if (WAC) win.webkitAudioContext = WAC === AC ? win.AudioContext : wrap(WAC);

  const update = () => {
    const now = isAway();
    if (now === away) return;
    away = now;
    for (const ctx of contexts) {
      if (ctx.state === 'closed') { contexts.delete(ctx); continue; }
      if (away) { if (ctx.state !== 'suspended') wants.add(ctx); suspend(ctx); }
      else if (wants.has(ctx)) { wants.delete(ctx); resume(ctx); }
    }
    for (const f of subs) { try { f(away); } catch { /* an owner's trouble is its own */ } }
    if (!away) { const run = pending; pending = []; for (const f of run) { try { f(); } catch { /* ignore */ } } }
  };

  win.addEventListener?.('moebius:pause', () => { appAway = true; win.__moebiusAway = true; update(); });
  win.addEventListener?.('moebius:resume', () => { appAway = false; win.__moebiusAway = false; update(); });
  win.addEventListener?.('pagehide', () => { frozen = true; update(); });
  win.addEventListener?.('pageshow', () => { frozen = false; update(); });
  doc?.addEventListener?.('visibilitychange', update);
  doc?.addEventListener?.('freeze', () => { frozen = true; update(); });
  doc?.addEventListener?.('resume', () => { frozen = false; update(); });
  update();

  return {
    away: () => away,
    /** register a context made before the guard (the constructor does it for the rest) */
    track,
    /** fn(away) on every change; returns the unsubscribe */
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    /** run fn now, or when the page is back */
    whenBack(fn) { if (away) pending.push(fn); else fn(); },
    /** (a test hook) the contexts it holds */
    contexts: () => [...contexts],
  };
}
