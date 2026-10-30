// What a world leaves behind in the page, so the next one can be swapped in without a page load (issue #790,
// docs/systems/world-swap.md). A world runs inside a scope: the listeners it adds to the page (window, document, the
// page's own elements of index.html), its timers, frames and observers are written down as they are made, and the
// registries' entries made under it (a thing you can use, an indoors test, a game event's handler: owned()) with
// them. Closing the scope takes all of them away again: the next world starts on the page as the first one did.
//
//   installScopes(window)            once, before the first world: wraps the page's timers and listeners
//   const s = openScope()            a world begins
//   owned(off)                       a registry's remover, called when the world's scope closes
//   closeScope(s)                    the world is over: its listeners off, timers cleared, removers called
//   markPage(document) / restorePage()   index.html's elements as they were before the first world, put back
//
// Outside a browser (node tests, the engines' VM) nothing is installed and owned() only hands the remover back.

let current = null;
let installed = null;

/** The scope a world runs in now (null between worlds, or where scopes are not installed). */
export const currentScope = () => current;

/** A registry's remover, to be called when the world now running is let go (returned unchanged). */
export function owned(off) {
  if (current && typeof off === 'function') current.offs.push(off);
  return off;
}

/** fn run outside any world's scope: what it adds lasts across worlds (a page-wide service started lazily). */
export function persist(fn) {
  const was = current;
  current = null;
  try { return fn(); } finally { current = was; }
}

/** A new world's scope (one at a time: a scope still open is closed first). */
export function openScope(name = 'world') {
  if (current) closeScope(current);
  current = { name, offs: [], listeners: [], timeouts: new Set(), intervals: new Set(), frames: new Set(), idles: new Set(), observers: new Set(), workers: new Set(), unload: [], closed: false };
  return current;
}

/**
 * Close a world's scope: its page-unload handlers run first (its save, as a page load would have run them), then its
 * listeners are taken off, its timers, frames and observers stopped and the registries' removers called.
 * Returns what was let go (counts, for the tests and the log).
 */
export function closeScope(scope = current) {
  if (!scope || scope.closed) return null;
  if (current === scope) current = null;
  scope.closed = true;
  const n = { unload: 0, listeners: scope.listeners.length, timers: scope.timeouts.size + scope.intervals.size, frames: scope.frames.size, observers: scope.observers.size, workers: scope.workers.size, offs: scope.offs.length, errors: 0 };
  const N = installed?.native;
  for (const { target, type, fn } of scope.unload) {
    try { (typeof fn === 'function' ? fn : fn.handleEvent?.bind(fn))?.call(target, { type, target, swap: true, persisted: false, preventDefault() {}, stopPropagation() {} }); n.unload++; }
    catch (e) { n.errors++; console.warn(`world swap: a ${type} handler failed`, e); }
  }
  for (const { target, type, fn, capture } of scope.listeners) { try { (N?.remove ?? target.removeEventListener).call(target, type, fn, capture); } catch { /* gone */ } }
  for (const id of scope.timeouts) (N?.clearTimeout ?? clearTimeout)(id);
  for (const id of scope.intervals) (N?.clearInterval ?? clearInterval)(id);
  for (const id of scope.frames) N?.cancelFrame?.(id);
  for (const id of scope.idles) N?.cancelIdle?.(id);
  for (const o of scope.observers) { try { o.disconnect(); } catch { /* gone */ } }
  for (const w of scope.workers) { try { w.terminate(); } catch { /* gone */ } }
  for (const off of scope.offs.splice(0).reverse()) { try { off(); } catch (e) { n.errors++; console.warn('world swap: a remover failed', e); } }
  scope.listeners.length = 0; scope.unload.length = 0;
  scope.timeouts.clear(); scope.intervals.clear(); scope.frames.clear(); scope.idles.clear(); scope.observers.clear(); scope.workers.clear();
  return n;
}

const UNLOAD = new Set(['pagehide', 'beforeunload', 'unload']);

/**
 * Wrap the page's timers, frames, observers and listeners (once): what is made under an open scope is written into it.
 * Listeners are kept only for what outlives a world (window, document, <html>, <head>, <body>, index.html's own
 * elements, the screen and viewport, media queries): those on a world's own elements go with the elements.
 */
export function installScopes(win = globalThis.window) {
  if (installed || !win?.EventTarget) return installed;
  const ET = win.EventTarget.prototype;
  const native = {
    add: ET.addEventListener, remove: ET.removeEventListener,
    setTimeout: win.setTimeout.bind(win), clearTimeout: win.clearTimeout.bind(win),
    setInterval: win.setInterval.bind(win), clearInterval: win.clearInterval.bind(win),
    frame: win.requestAnimationFrame?.bind(win), cancelFrame: win.cancelAnimationFrame?.bind(win),
    idle: win.requestIdleCallback?.bind(win), cancelIdle: win.cancelIdleCallback?.bind(win),
  };
  const doc = win.document;
  const lasting = new WeakSet([win, doc, doc?.documentElement, doc?.head, doc?.body, win.visualViewport, win.screen, win.screen?.orientation].filter(Boolean));
  const MQL = win.MediaQueryList;
  const kept = (t) => lasting.has(t) || (MQL && t instanceof MQL) || PAGE.nodes.has(t);
  const captureOf = (o) => (typeof o === 'boolean' ? o : !!o?.capture);
  // (a bare addEventListener(…) in a module is the window's, called with no `this`)
  ET.addEventListener = function (type, fn, opts) {
    const s = current, t = this ?? win;
    if (s && fn && kept(t)) {
      const capture = captureOf(opts);
      s.listeners.push({ target: t, type, fn, capture });
      if (t === win && UNLOAD.has(type)) s.unload.push({ target: t, type, fn });
    }
    return native.add.call(t, type, fn, opts);
  };
  ET.removeEventListener = function (type, fn, opts) {
    const s = current, t = this ?? win;
    if (s && fn) {
      const capture = captureOf(opts);
      const i = s.listeners.findIndex((l) => l.target === t && l.type === type && l.fn === fn && l.capture === capture);
      if (i >= 0) s.listeners.splice(i, 1);
      const j = s.unload.findIndex((l) => l.target === t && l.type === type && l.fn === fn);
      if (j >= 0) s.unload.splice(j, 1);
    }
    return native.remove.call(t, type, fn, opts);
  };
  win.setTimeout = function (fn, ms, ...args) {
    const s = current;
    if (!s || typeof fn !== 'function') return native.setTimeout(fn, ms, ...args);
    const id = native.setTimeout(() => { s.timeouts.delete(id); fn(...args); }, ms);
    s.timeouts.add(id);
    return id;
  };
  win.clearTimeout = function (id) { current?.timeouts.delete(id); return native.clearTimeout(id); };
  win.setInterval = function (fn, ms, ...args) {
    const s = current, id = native.setInterval(fn, ms, ...args);
    s?.intervals.add(id);
    return id;
  };
  win.clearInterval = function (id) { current?.intervals.delete(id); return native.clearInterval(id); };
  if (native.frame) {
    win.requestAnimationFrame = function (fn) {
      const s = current;
      if (!s) return native.frame(fn);
      const id = native.frame((t) => { s.frames.delete(id); fn(t); });
      s.frames.add(id);
      return id;
    };
    win.cancelAnimationFrame = function (id) { current?.frames.delete(id); return native.cancelFrame(id); };
  }
  if (native.idle) {
    win.requestIdleCallback = function (fn, o) {
      const s = current;
      if (!s) return native.idle(fn, o);
      const id = native.idle((d) => { s.idles.delete(id); fn(d); }, o);
      s.idles.add(id);
      return id;
    };
    win.cancelIdleCallback = function (id) { current?.idles.delete(id); return native.cancelIdle(id); };
  }
  for (const name of ['MutationObserver', 'ResizeObserver', 'IntersectionObserver']) {
    const O = win[name];
    if (!O) continue;
    const observe = O.prototype.observe;
    O.prototype.observe = function (...a) { current?.observers.add(this); return observe.apply(this, a); };
  }
  // (a world's workers stopped with it: a worker running holds its handlers, and they the world; a page-wide worker
  // a module keeps for good is made under persist())
  if (win.Worker) {
    const W = win.Worker;
    const Scoped = function Worker(...a) { const w = new W(...a); current?.workers.add(w); return w; };
    Scoped.prototype = W.prototype;
    win.Worker = Scoped;
  }
  installed = { win, native };
  return installed;
}

/**
 * three's objects outlive a world when a module keeps them (a cached material, a shared geometry or texture), and
 * the renderer that drew them hangs a 'dispose' listener on each: the last world's renderer (its canvas, the world's
 * listeners on it, the world) would be held by every one. Those added under a world are taken off with it.
 * proto: three's EventDispatcher.prototype (main.js, once).
 */
export function scopeDispatcher(proto, types = ['dispose']) {
  if (!proto || proto.__worldScoped) return;
  const add = proto.addEventListener;
  proto.addEventListener = function (type, fn) {
    const s = current;
    if (s && types.includes(type) && !this._listeners?.[type]?.includes(fn)) s.offs.push(() => this.removeEventListener(type, fn));
    return add.call(this, type, fn);
  };
  Object.defineProperty(proto, '__worldScoped', { value: true });
}

// ------------------------------------------------------------------ index.html's elements
const PAGE = { nodes: new WeakSet(), list: [], head: null, body: null, doc: null };

/** index.html's elements (the body's children now, before the title or a world adds its own): those put back between worlds. */
export function markPage(doc = globalThis.document) {
  if (!doc?.body || PAGE.doc) return;
  PAGE.doc = doc;
  PAGE.list = [...doc.body.children].filter((el) => el.tagName !== 'SCRIPT').map((el) => ({ el, html: null, attrs: null, next: null }));
  for (const p of PAGE.list) PAGE.nodes.add(p.el);
}

/** Their contents as a world first finds them (after the page's own setup: its glyphs and words), kept once. */
export function snapshotPage(doc = globalThis.document) {
  markPage(doc);
  if (!PAGE.doc || PAGE.head) return;
  for (const p of PAGE.list) { p.html = p.el.innerHTML; p.attrs = [...p.el.attributes].map((a) => [a.name, a.value]); }
  PAGE.body = [...doc.body.attributes].map((a) => [a.name, a.value]);
  PAGE.head = new Set(doc.head.children);
}

const setAttrs = (el, attrs) => {
  for (const a of [...el.attributes]) if (!attrs.some(([n]) => n === a.name)) el.removeAttribute(a.name);
  for (const [n, v] of attrs) if (el.getAttribute(n) !== v) el.setAttribute(n, v);
};

/**
 * The page as the first world found it: what a world added to the body taken away (its canvas, panels, cards), each
 * of index.html's elements back with its first contents and attributes (the loading screen put back up), a world's own
 * unnamed styles out of the head (an element marked data-lasting is the page's own, and stays). Returns how many nodes
 * were taken away.
 */
export function restorePage({ keep = (el) => el.hasAttribute?.('data-lasting') } = {}) {
  const doc = PAGE.doc;
  if (!doc || !PAGE.head) return 0;
  let removed = 0;
  for (const el of [...doc.body.children]) if (!PAGE.nodes.has(el) && el.tagName !== 'SCRIPT' && !keep(el)) { el.remove(); removed++; }
  // (in their first order: the loading screen first, as index.html has it)
  let before = doc.body.firstChild;
  for (const p of PAGE.list) {
    setAttrs(p.el, p.attrs);
    p.el.innerHTML = p.html;   // (always: children left as they were would keep the last world's listeners)
    if (p.el.parentNode !== doc.body || p.el !== before) doc.body.insertBefore(p.el, before);
    before = p.el.nextSibling;
  }
  setAttrs(doc.body, PAGE.body);
  for (const el of [...doc.head.children]) if (!PAGE.head.has(el) && el.tagName === 'STYLE' && !el.id && !el.hasAttribute('data-vite-dev-id')) { el.remove(); removed++; }
  return removed;
}

/** For the tests: forget the page's snapshot and the installation's state (the wrappers stay). */
export function _resetForTests() { PAGE.nodes = new WeakSet(); PAGE.list = []; PAGE.head = null; PAGE.body = null; PAGE.doc = null; current = null; }
