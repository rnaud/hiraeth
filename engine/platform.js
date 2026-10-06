// The browser, as far as the game needs one, for a JavaScript VM inside an engine (GodotJS's V8,
// Puerts' V8 / QuickJS): the engine draws, the game runs here. docs/systems/engine-bridge.md.
//
//   installPlatform(host)
//
// host (what the engine side provides; every member optional):
//   now()             ms, monotonic (performance.now)
//   readFile(path)    an ArrayBuffer, or null: the game's public/ files (anim/*.glb, sounds…)
//   storage           { get(k), set(k, v), remove(k) }: localStorage, kept by the engine
//   pads()            Gamepad-shaped objects (navigator.getGamepads)
//   log(level, ...a)  console output
//
// What it puts on globalThis, only where the VM has none of its own:
//   performance, TextDecoder / TextEncoder (UTF-8), queueMicrotask, structuredClone,
//   requestAnimationFrame (driven by the engine: tick() runs the callbacks), self / window
//   with add / remove / dispatchEvent (the engine's keys arrive as keydown / keyup, as in a
//   page), document (elements that take every call and draw nothing), navigator, location,
//   URL / URLSearchParams (enough for the game's own uses), localStorage, fetch (from readFile),
//   atob / btoa, Image, matchMedia.
//
// Nothing here is used by the web build: it is bundled only into the engines' scripts
// (scripts/engine-bundle.mjs) and loaded by the tests.

const G = globalThis;
const def = (k, v) => { if (G[k] === undefined) G[k] = v; };

// ------------------------------------------------------------------ text
class Utf8Decoder {
  constructor(label = 'utf-8') { this.encoding = String(label).toLowerCase(); }
  decode(input) {
    if (input === undefined) return '';
    const b = ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : new Uint8Array(input);   // (isView: buffers from another realm too)
    let s = '', i = 0;
    const n = b.length;
    const parts = [];
    while (i < n) {
      const c = b[i++];
      let cp;
      if (c < 0x80) cp = c;
      else if (c < 0xe0) cp = ((c & 0x1f) << 6) | (b[i++] & 0x3f);
      else if (c < 0xf0) cp = ((c & 0x0f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f);
      else cp = ((c & 0x07) << 18) | ((b[i++] & 0x3f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f);
      if (cp > 0xffff) { cp -= 0x10000; s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff)); } else s += String.fromCharCode(cp);
      if (s.length > 8192) { parts.push(s); s = ''; }
    }
    parts.push(s);
    return parts.join('');
  }
}
class Utf8Encoder {
  get encoding() { return 'utf-8'; }
  encode(str = '') {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let cp = str.charCodeAt(i);
      if (cp >= 0xd800 && cp < 0xdc00 && i + 1 < str.length) { cp = 0x10000 + ((cp - 0xd800) << 10) + (str.charCodeAt(++i) - 0xdc00); }
      if (cp < 0x80) out.push(cp);
      else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
      else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
    return Uint8Array.from(out);
  }
}

// ------------------------------------------------------------------ URL (the game's own uses only)
class SearchParams {
  constructor(q = '') {
    this._m = [];
    String(q).replace(/^\?/, '').split('&').filter(Boolean).forEach((kv) => {
      const [k, v = ''] = kv.split('=');
      this._m.push([decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, ' '))]);
    });
  }
  get(k) { const e = this._m.find((x) => x[0] === k); return e ? e[1] : null; }
  getAll(k) { return this._m.filter((x) => x[0] === k).map((x) => x[1]); }
  has(k) { return this._m.some((x) => x[0] === k); }
  set(k, v) { this.delete(k); this._m.push([k, String(v)]); }
  append(k, v) { this._m.push([k, String(v)]); }
  delete(k) { this._m = this._m.filter((x) => x[0] !== k); }
  forEach(fn) { this._m.forEach(([k, v]) => fn(v, k, this)); }
  entries() { return this._m[Symbol.iterator](); }
  [Symbol.iterator]() { return this._m[Symbol.iterator](); }
  toString() { return this._m.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&'); }
}
class MiniURL {
  constructor(url, base) {
    let s = String(url);
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
      const b = base === undefined ? null : new MiniURL(String(base));
      if (!b) throw new TypeError(`Invalid URL: ${s}`);
      if (s.startsWith('/')) s = `${b.protocol}//${b.host}${s}`;
      else {
        const dir = b.pathname.replace(/[^/]*$/, '');
        const parts = (dir + s).split('/');
        const out = [];
        for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.') out.push(p); }
        s = `${b.protocol}//${b.host}${out.join('/')}`;
      }
    }
    const m = s.match(/^([a-z][a-z0-9+.-]*:)(\/\/([^/?#]*))?([^?#]*)(\?[^#]*)?(#.*)?$/i);
    this.protocol = m[1]; this.host = m[3] ?? ''; this.hostname = this.host.replace(/:\d+$/, '');
    this.pathname = m[4] || '/'; this.search = m[5] ?? ''; this.hash = m[6] ?? '';
    this.searchParams = new SearchParams(this.search);
  }
  get origin() { return `${this.protocol}//${this.host}`; }
  get href() { return `${this.protocol}//${this.host}${this.pathname}${this.search}${this.hash}`; }
  toString() { return this.href; }
  static createObjectURL() { return 'blob:engine'; }
  static revokeObjectURL() {}
}

// ------------------------------------------------------------------ the page: elements that draw nothing
// a 2D context that takes every call and draws nothing (the canvas textures stay blank)
const ctx2d = new Proxy(function () {}, {
  get: (t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' || k === 'createImageData' ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(4 * Math.max(1, w * h)), width: w, height: h }) : k === 'canvas' ? { width: 1, height: 1 } : ctx2d),
  set: () => true,
  apply: () => ctx2d,
});
class Listeners {
  constructor() { this._l = new Map(); }
  addEventListener(type, fn) { if (!fn) return; if (!this._l.has(type)) this._l.set(type, new Set()); this._l.get(type).add(fn); }
  removeEventListener(type, fn) { this._l.get(type)?.delete(fn); }
  dispatchEvent(e) {
    e.target ??= this; e.currentTarget = this;
    for (const fn of [...(this._l.get(e.type) ?? [])]) { try { typeof fn === 'function' ? fn.call(this, e) : fn.handleEvent?.(e); } catch (err) { console.error(err); } }
    return !e.defaultPrevented;
  }
  listenerCount(type) { return this._l.get(type)?.size ?? 0; }
}
class StubElement extends Listeners {
  constructor(tag = 'div') {
    super();
    this.tagName = String(tag).toUpperCase(); this.children = []; this.childNodes = this.children; this.parentNode = null;
    this.style = new Proxy({}, { get: (o, k) => (k === 'setProperty' ? (a, b) => { o[a] = b; } : k === 'removeProperty' ? (a) => { delete o[a]; } : k === 'getPropertyValue' ? (a) => o[a] ?? '' : o[k] ?? ''), set: (o, k, v) => { o[k] = v; return true; } });
    this.dataset = {}; this.attributes = {}; this._text = '';
    this.width = 1; this.height = 1; this.value = ''; this.checked = false; this.disabled = false; this.hidden = false;
    this.offsetWidth = 1; this.offsetHeight = 1; this.clientWidth = 1; this.clientHeight = 1; this.scrollTop = 0; this.scrollHeight = 0;
    const cls = new Set();
    this.classList = { add: (...c) => c.forEach((x) => cls.add(x)), remove: (...c) => c.forEach((x) => cls.delete(x)), toggle: (c, on) => { const v = on ?? !cls.has(c); if (v) cls.add(c); else cls.delete(c); return v; }, contains: (c) => cls.has(c), replace: (a, b) => { cls.delete(a); cls.add(b); } };
  }
  get className() { return ''; } set className(v) {}
  get firstElementChild() { return this.children[0] ?? null; }
  get lastElementChild() { return this.children[this.children.length - 1] ?? null; }
  get firstChild() { return this.children[0] ?? null; }
  get textContent() { return this._text; } set textContent(v) { this._text = String(v ?? ''); this.children.length = 0; }
  get innerText() { return this._text; } set innerText(v) { this._text = String(v ?? ''); }
  get innerHTML() { return this._text; } set innerHTML(v) { this._text = String(v ?? ''); this.children.length = 0; }
  get outerHTML() { return ''; }
  getContext() { return ctx2d; }
  toDataURL() { return 'data:,'; }
  toBlob(cb) { cb?.(null); }
  appendChild(c) { if (c && c !== this) { c.parentNode = this; this.children.push(c); } return c; }
  append(...cs) { cs.forEach((c) => typeof c === 'object' && this.appendChild(c)); }
  prepend(...cs) { cs.forEach((c) => typeof c === 'object' && this.appendChild(c)); }
  insertBefore(c) { return this.appendChild(c); }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  replaceChildren(...cs) { this.children.length = 0; this.append(...cs); }
  remove() { this.parentNode?.removeChild(this); }
  cloneNode() { return new StubElement(this.tagName); }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return k in this.attributes; }
  toggleAttribute(k, on) { if (on ?? !(k in this.attributes)) this.attributes[k] = ''; else delete this.attributes[k]; }
  insertAdjacentHTML() {}
  insertAdjacentElement(p, e) { return this.appendChild(e); }
  querySelector() { return new StubElement(); }
  querySelectorAll() { return []; }
  getElementsByTagName() { return []; }
  getElementsByClassName() { return []; }
  closest() { return null; }
  matches() { return false; }
  contains(o) { return o === this; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 1, bottom: 1, x: 0, y: 0, width: 1, height: 1 }; }
  focus() {} blur() {} click() {} scrollIntoView() {} scrollTo() {}
  requestPointerLock() {} requestFullscreen() { return Promise.resolve(); }
  animate() { return { finished: Promise.resolve(), cancel() {}, onfinish: null }; }
  play() { return Promise.resolve(); } pause() {} load() {}
}

class StubDocument extends Listeners {
  constructor() {
    super();
    this.body = new StubElement('body'); this.head = new StubElement('head'); this.documentElement = new StubElement('html');
    this.activeElement = this.body; this.pointerLockElement = null; this.fullscreenElement = null; this.hidden = false; this.visibilityState = 'visible';
    this.readyState = 'complete'; this.fonts = { ready: Promise.resolve(), load: () => Promise.resolve([]), check: () => true };
    this._byId = new Map();
  }
  createElement(tag) { return new StubElement(tag); }
  createElementNS(ns, tag) { return new StubElement(tag); }
  createTextNode(t) { const e = new StubElement('#text'); e.textContent = t; return e; }
  createDocumentFragment() { return new StubElement('#fragment'); }
  /** An element by id: the same stub each time (main.js keeps references to #health and friends). */
  getElementById(id) { if (!this._byId.has(id)) this._byId.set(id, new StubElement('div')); return this._byId.get(id); }
  querySelector() { return new StubElement(); }
  querySelectorAll() { return []; }
  getElementsByTagName() { return []; }
  exitPointerLock() {} exitFullscreen() { return Promise.resolve(); }
  hasFocus() { return true; }
}

// ------------------------------------------------------------------ events the engine sends
class StubEvent {
  constructor(type, init = {}) { Object.assign(this, init); this.type = type; this.defaultPrevented = false; this.timeStamp = G.performance?.now?.() ?? 0; }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() {} stopImmediatePropagation() {}
}

/** A Response from bytes the engine read (fetch's body: arrayBuffer, text, json, blob). */
function response(buf, url) {
  const ok = !!buf;
  return {
    ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'Not Found', url, headers: { get: (k) => (String(k).toLowerCase() === 'content-length' && buf ? String(buf.byteLength) : null), has: () => false },
    arrayBuffer: () => (ok ? Promise.resolve(buf) : Promise.reject(new Error(`404 ${url}`))),
    text: () => (ok ? Promise.resolve(new Utf8Decoder().decode(buf)) : Promise.reject(new Error(`404 ${url}`))),
    json: () => (ok ? Promise.resolve(JSON.parse(new Utf8Decoder().decode(buf))) : Promise.reject(new Error(`404 ${url}`))),
    blob: () => Promise.resolve({ size: buf?.byteLength ?? 0, arrayBuffer: () => Promise.resolve(buf) }),
    clone() { return response(buf, url); },
    body: null,
  };
}

/** The path under public/ that a URL the game asks for names ('anim/ual.glb', './anim/x.glb', 'https://…/anim/x.glb'). */
export function publicPath(url) {
  let s = String(url?.url ?? url);
  s = s.replace(/^[a-z]+:\/\/[^/]*/i, '').replace(/[?#].*$/, '');
  s = s.replace(/^(\.\/)+/, '').replace(/^\/+/, '');
  return decodeURIComponent(s);
}

/** Put the stand-ins on globalThis. Returns the page's handles: { window, document, tick, dispatch }. */
export function installPlatform(host = {}) {
  const t0 = Date.now();
  const now = host.now ? () => host.now() : () => Date.now() - t0;
  def('performance', { now, mark() {}, measure() {}, getEntriesByName: () => [], timeOrigin: t0 });
  if (!G.performance.now) G.performance.now = now;
  def('TextDecoder', Utf8Decoder);
  def('TextEncoder', Utf8Encoder);
  def('queueMicrotask', (fn) => { Promise.resolve().then(fn); });
  def('structuredClone', (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v))));
  def('URL', MiniURL);
  def('URLSearchParams', SearchParams);
  def('Event', StubEvent);
  def('KeyboardEvent', StubEvent);
  def('MouseEvent', StubEvent);
  def('PointerEvent', StubEvent);
  def('CustomEvent', StubEvent);
  def('ProgressEvent', StubEvent);
  def('EventTarget', Listeners);
  const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  def('btoa', (s) => { let o = ''; for (let i = 0; i < s.length; i += 3) { const n = (s.charCodeAt(i) << 16) | ((s.charCodeAt(i + 1) || 0) << 8) | (s.charCodeAt(i + 2) || 0); o += b64[(n >> 18) & 63] + b64[(n >> 12) & 63] + (i + 1 < s.length ? b64[(n >> 6) & 63] : '=') + (i + 2 < s.length ? b64[n & 63] : '='); } return o; });
  def('atob', (s) => { s = String(s).replace(/[^A-Za-z0-9+/]/g, ''); let o = ''; for (let i = 0; i < s.length; i += 4) { const n = (b64.indexOf(s[i]) << 18) | (b64.indexOf(s[i + 1]) << 12) | ((b64.indexOf(s[i + 2]) & 63) << 6) | (b64.indexOf(s[i + 3]) & 63); o += String.fromCharCode((n >> 16) & 255); if (s[i + 2] !== undefined) o += String.fromCharCode((n >> 8) & 255); if (s[i + 3] !== undefined) o += String.fromCharCode(n & 255); } return o; });

  // the frame callbacks: the engine calls tick(ms) once a frame
  let rafId = 0;
  const raf = new Map();
  def('requestAnimationFrame', (fn) => { raf.set(++rafId, fn); return rafId; });
  def('cancelAnimationFrame', (id) => { raf.delete(id); });
  const tick = (ms = now()) => { const due = [...raf.values()]; raf.clear(); for (const fn of due) { try { fn(ms); } catch (e) { console.error(e); } } };

  // the window: the global object itself, as in a page (its listeners are where keys arrive)
  if (!G.addEventListener) {
    const win = new Listeners();
    G.addEventListener = win.addEventListener.bind(win);
    G.removeEventListener = win.removeEventListener.bind(win);
    G.dispatchEvent = win.dispatchEvent.bind(win);
    G.__engineWindow = win;
  }
  def('window', G);
  def('self', G);
  def('globalThis', G);
  def('devicePixelRatio', 1);
  def('innerWidth', host.width ?? 1280);
  def('innerHeight', host.height ?? 720);
  def('document', new StubDocument());
  def('navigator', {
    userAgent: `Memento engine (${host.engine ?? 'unknown'})`, platform: host.engine ?? 'engine', language: 'en', languages: ['en'], maxTouchPoints: 0, hardwareConcurrency: 4,
    getGamepads: () => (host.pads ? host.pads() : []), vibrate: () => false, clipboard: { writeText: () => Promise.resolve() },
    gpu: undefined, userAgentData: undefined,
  });
  def('location', { href: 'engine://memento/', origin: 'engine://memento', protocol: 'engine:', host: 'memento', hostname: 'memento', pathname: '/', search: host.search ?? '', hash: '', reload() {}, assign() {}, replace() {} });
  def('history', { replaceState() {}, pushState() {}, back() {} });
  def('screen', { width: 1280, height: 720, orientation: { type: 'landscape-primary', lock: () => Promise.reject(new Error('no')) } });
  def('matchMedia', (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  def('getComputedStyle', () => new Proxy({}, { get: (o, k) => (k === 'getPropertyValue' ? () => '' : '') }));
  def('Image', class extends StubElement { constructor() { super('img'); } });
  def('HTMLCanvasElement', StubElement);
  def('HTMLElement', StubElement);
  def('HTMLImageElement', StubElement);
  def('Element', StubElement);
  def('Node', StubElement);
  const store = host.storage;
  const mem = new Map();
  def('localStorage', {
    getItem: (k) => (store ? store.get(k) ?? null : mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => (store ? store.set(k, String(v)) : mem.set(k, String(v))),
    removeItem: (k) => (store ? store.remove(k) : mem.delete(k)),
    clear: () => mem.clear(),
    key: () => null,
    get length() { return mem.size; },
  });
  def('sessionStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  def('fetch', (url) => {
    const p = publicPath(url);
    let buf = null;
    try { buf = host.readFile?.(p) ?? null; } catch (e) { buf = null; }
    return Promise.resolve(response(buf, String(url?.url ?? url)));
  });
  def('AbortController', class { constructor() { this.signal = { aborted: false, reason: undefined, addEventListener() {}, removeEventListener() {}, throwIfAborted() {} }; } abort(r) { this.signal.aborted = true; this.signal.reason = r; } });
  def('MutationObserver', class { observe() {} disconnect() {} takeRecords() { return []; } });
  def('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  def('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  // (no Worker: the game's off-thread work runs inline, lod.js falls back)
  return { window: G, document: G.document, tick, dispatch: (type, init) => G.dispatchEvent(new StubEvent(type, init)) };
}

export { StubElement, StubDocument, StubEvent, MiniURL, SearchParams, Utf8Decoder, Utf8Encoder };
