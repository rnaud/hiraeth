// The recorded themes on a device (src/music-store.js, src/soundtracks.js loadSoundtrack): a world plays the
// bundle's theme, else the copy kept in IndexedDB, else the procedural score until the background download
// (themeDownloader, from the first open, every theme the device hasn't got) lands it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bundledGame, SHEET_SITE } from '../src/levels/reference-sheets.js';
import {
  ON_DEVICE_THEMES, THEME_DB, THEME_STORE, THEME_DB_VERSION, themeKey, localThemeUrl, siteThemeUrl,
  themeStore, themeSources, themeDownloader, themeProgressText,
} from '../src/music-store.js';
import { loadSoundtrack, SOUNDTRACKS, THEME_FILES } from '../src/soundtracks.js';
import { AudioContext } from '../engine/webaudio.js';

const at = (href) => new URL(href);
const ANDROID = at('http://127.0.0.1:41730/index.html?level=incal');
const DECK = at('moebius://game/index.html');
const WEB = at(`${SHEET_SITE}?level=incal`);
const MP3 = { get: (h) => (h === 'content-type' ? 'audio/mpeg' : null) };

/** A fetch over a little world: `files` maps URLs to bytes (strings); the rest are 404s (or HTML, `html`). */
function net(files = {}, { html = false, offline = false } = {}) {
  const calls = [];
  const state = { offline };
  const fetcher = async (url, opts = {}) => {
    calls.push(String(url));
    if (opts.signal?.aborted) { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
    if (state.offline && /^https:/.test(url)) throw new TypeError('NetworkError when attempting to fetch resource.');
    const body = files[url];
    if (body == null) return html ? { ok: true, status: 200, headers: { get: () => 'text/html' }, blob: async () => new Blob(['<!doctype html>']) } : { ok: false, status: 404, headers: MP3 };
    return { ok: true, status: 200, headers: MP3, blob: async () => new Blob([body]) };
  };
  return { fetcher, calls, state };
}

/** themeStore's shape, in memory. */
function memStore(init = {}) {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, new Blob([v])]));
  return {
    m,
    get: async (k) => m.get(themeKey(k)) ?? null,
    put: async (k, b) => { m.set(themeKey(k), b); },
    delete: async (k) => { m.delete(themeKey(k)); },
    keys: async () => [...m.keys()],
  };
}

const local = (f) => localThemeUrl(f), site = (f) => siteThemeUrl(f);
const text = async (blob) => (blob ? await blob.text() : null);
const sites = (calls) => calls.filter((u) => u.startsWith('https:'));
/** A downloader for tests: no waiting, a manual 'online' event. */
const quick = (o) => { let wake = null; const d = themeDownloader({ files: THEME_FILES, booted: () => true, settle: 0, gap: 0, retryMs: 1e9, online: () => true, sleep: async () => {}, listen: (fn) => { wake = fn; }, ...o }); d.wake = () => wake?.(); return d; };

test('a device is the Android app (GeckoView or its WebView), the Deck; never the site or a dev server', () => {
  assert.ok(bundledGame(ANDROID), 'GeckoView');
  assert.ok(bundledGame(DECK), 'the Deck');
  assert.ok(bundledGame(at('https://localhost/index.html')), 'the WebView fallback (Capacitor)');
  assert.ok(!bundledGame(WEB), 'the site');
  assert.ok(!bundledGame(at('http://localhost:5511/')), 'a dev server');
  assert.ok(!bundledGame(at('https://localhost:8443/')), 'an https dev server');
  assert.ok(!bundledGame(undefined), 'no page (tests)');
});

test('a theme is kept under its file name, for good: the database and the key never move', () => {
  assert.deepEqual([THEME_DB, THEME_STORE, THEME_DB_VERSION], ['hiraeth-music', 'themes', 1]);
  assert.equal(themeKey('incal.mp3'), 'incal.mp3');
  assert.equal(themeKey('music/incal.mp3'), 'incal.mp3');
  assert.equal(siteThemeUrl('incal.mp3'), `${SHEET_SITE}music/incal.mp3`);
  assert.equal(localThemeUrl('incal.mp3', './'), './music/incal.mp3');
  assert.deepEqual(ON_DEVICE_THEMES, ['desert.mp3']);
  assert.equal(THEME_FILES.length, 25, 'home and the Lantern share one');
});

test('a world on a device: the bundle\'s theme first, then the kept copy; never the site directly', async () => {
  const order = async (files, store, opts) => {
    const { fetcher, calls } = net(files, opts);
    const out = [];
    for await (const s of themeSources('incal.mp3', { here: ANDROID, store, fetcher })) out.push([s.from, await text(s.blob), s.keep]);
    assert.deepEqual(sites(calls), []);
    return out;
  };
  assert.deepEqual(await order({ [local('incal.mp3')]: 'B' }, memStore({ 'incal.mp3': 'K' })), [['bundle', 'B', true]], 'an older install: its bundle has it (and keeps it)');
  assert.deepEqual(await order({}, memStore({ 'incal.mp3': 'K' })), [['stored', 'K', false]]);
  assert.deepEqual(await order({}, memStore()), [], 'not yet: the download brings it');
  assert.deepEqual(await order({}, memStore({ 'incal.mp3': 'K' }), { html: true }), [['stored', 'K', false]], 'a page for a missing file is not the file');
  const desert = [];
  for await (const s of themeSources('desert.mp3', { here: DECK, store: memStore(), fetcher: net({ [local('desert.mp3')]: 'D' }).fetcher })) desert.push([s.from, s.keep]);
  assert.deepEqual(desert, [['bundle', false]], 'the desert\'s is in every bundle: never kept twice');
});

test('on the site and the dev server: only the game\'s own files, never the store, the site or a download', async () => {
  const { fetcher, calls } = net({});
  const out = [];
  for await (const s of themeSources('incal.mp3', { here: WEB, store: memStore({ 'incal.mp3': 'K' }), fetcher })) out.push(s.from);
  assert.deepEqual(out, []);
  assert.deepEqual(calls, [local('incal.mp3')]);
  const d = quick({ here: WEB, store: memStore(), fetcher });
  await d.start();
  assert.deepEqual(calls, [local('incal.mp3')], 'no background download on the web');
  assert.equal(await themeProgressText(THEME_FILES, { here: WEB, store: memStore() }), '');
});

// ---- the background download

test('the first open downloads every theme but the desert\'s, one at a time, this world\'s first, and keeps them', async () => {
  const files = Object.fromEntries(THEME_FILES.map((f) => [site(f), `site ${f}`]));
  const { fetcher, calls } = net(files);
  const store = memStore(), seen = [];
  const d = quick({ here: ANDROID, store, fetcher, onProgress: (p) => seen.push(p.have) });
  d.prefer('incal.mp3');
  assert.equal(await themeProgressText(THEME_FILES, { here: ANDROID, store }), 'Music: 1 of 25 downloaded');
  await d.start();
  assert.equal(sites(calls)[0], site('incal.mp3'), 'the world being played comes first');
  assert.equal(sites(calls).length, 24, 'each once, not the desert\'s');
  assert.deepEqual([...store.m.keys()].sort(), THEME_FILES.filter((f) => f !== 'desert.mp3').sort());
  assert.deepEqual(seen, Array.from({ length: 25 }, (_, i) => i + 1), 'progress, from the desert\'s alone to all');
  assert.ok(d.state.done);
  assert.equal(await themeProgressText(THEME_FILES, { here: ANDROID, store }), '', 'all there: the settings say nothing');
  await d.start();
  assert.equal(sites(calls).length, 24, 'never checked again');
});

test('cut off midway: what arrived stays, the rest resumes when back online (or on the next open)', async () => {
  const files = Object.fromEntries(THEME_FILES.map((f) => [site(f), `site ${f}`]));
  const n = net(files);
  const store = memStore();
  let left = 5;
  const fetcher = async (url, o) => { if (url.startsWith('https:') && left-- <= 0) n.state.offline = true; return n.fetcher(url, o); };
  const d = quick({ here: DECK, store, fetcher });
  await d.start();
  assert.equal(store.m.size, 5);
  assert.equal(d.state.failures, 1);
  n.state.offline = false; left = Infinity;
  d.wake();   // ('online')
  await new Promise((r) => setTimeout(r, 0));
  await d.start();
  assert.equal(store.m.size, 24);
  assert.equal(new Set(sites(n.calls)).size, 24, 'nothing fetched twice but the file cut off');

  const next = quick({ here: DECK, store, fetcher: n.fetcher });   // (the next open)
  const before = n.calls.length;
  await next.start();
  assert.equal(n.calls.length, before, 'all kept: not a single request');
});

test('never while the page loads: it waits for the boot, then settles', async () => {
  let up = false, waited = [];
  const { fetcher, calls } = net({ [site('incal.mp3')]: 'I' });
  const d = themeDownloader({ files: ['incal.mp3'], here: ANDROID, store: memStore(), fetcher, booted: () => up, settle: 8000, gap: 0, online: () => true,
    sleep: async (ms) => { waited.push(ms); if (waited.length === 3) up = true; } });
  await d.start();
  assert.deepEqual(waited, [1000, 1000, 1000, 8000], 'polled until up, then the settle');
  assert.deepEqual(sites(calls), [site('incal.mp3')]);
});

test('offline or with Data Saver it waits; nothing a world needs waits for it', async () => {
  const { fetcher, calls } = net({});
  await quick({ here: ANDROID, store: memStore(), fetcher, online: () => false }).start();
  await quick({ here: ANDROID, store: memStore(), fetcher, connection: { saveData: true } }).start();
  assert.deepEqual(calls, []);
});

const decodes = (ctx) => { ctx.decodeAudioData = async (buf) => { const s = new TextDecoder().decode(buf); if (s.startsWith('bad')) throw new Error('not audio'); const b = ctx.createBuffer(1, 400, 100); b.getChannelData(0).fill(0.2); return b; }; return ctx; };
const soundFor = (levelId) => { const ctx = decodes(new AudioContext({ sampleRate: 100 })); return { score: true, levelId, ctx, music: ctx.createGain() }; };
const quietly = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };

test('a kept theme plays at once, offline, and nothing is downloaded', async () => {
  const sound = soundFor('incal'), store = memStore({ 'incal.mp3': 'kept' });
  const { fetcher, calls } = net({}, { offline: true });
  assert.equal(await loadSoundtrack(sound, fetcher, { here: ANDROID, store, downloader: quick({ here: ANDROID, store, fetcher }) }), true);
  assert.equal(sound.trackFrom, 'stored');
  assert.ok(sound.recordedTrack && sound.trackOn, 'started, faded in');
  assert.deepEqual(sites(calls), []);
});

test('a world entered before its theme: the score plays, then the theme comes in with the next moment', async () => {
  const sound = soundFor('incal'), store = memStore();
  const { fetcher } = net({ [site('incal.mp3')]: 'from the site', [site('edena.mp3')]: 'E' });
  const d = quick({ here: ANDROID, store, fetcher, files: ['edena.mp3', 'incal.mp3'] });
  const playing = loadSoundtrack(sound, fetcher, { here: ANDROID, store, downloader: d });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(sound.trackBuffer, undefined, 'meanwhile, the procedural score');
  await d.start();
  assert.equal(await playing, true);
  assert.equal(sound.trackFrom, 'site');
  assert.ok(sound.trackBuffer && sound.trackGain, 'ready for Sound.musicMomentsUpdate');
  assert.equal(sound.recordedTrack, undefined, 'not started on top of the score');
  assert.equal(sound.trackOn, false, 'the moments bring it in, faded');
  assert.equal(await text(store.m.get('incal.mp3')), 'from the site');
});

test('a damaged kept copy is dropped (the download fetches it again); a world left before it lands stays quiet', async () => {
  const store = memStore({ 'incal.mp3': 'bad bytes' });
  const { fetcher } = net({ [site('incal.mp3')]: 'good' });
  const d = quick({ here: ANDROID, store, fetcher, files: ['incal.mp3'] });
  const sound = soundFor('incal');
  const playing = loadSoundtrack(sound, fetcher, { here: ANDROID, store, downloader: d });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(store.m.has('incal.mp3'), false, 'dropped');
  await d.start();
  assert.equal(await playing, true);
  assert.equal(await text(store.m.get('incal.mp3')), 'good');

  const gone = soundFor('edena');
  const d2 = quick({ here: DECK, store: memStore(), fetcher: net({}, { offline: true }).fetcher });
  const waiting = loadSoundtrack(gone, fetcher, { here: DECK, store: memStore(), downloader: d2 });
  await new Promise((r) => setTimeout(r, 0));
  gone._disposed = true; gone.trackAbort.abort();
  assert.equal(await waiting, false);
  assert.equal(gone.trackBuffer, undefined);
});

test('an install from before (every theme in its bundle) keeps them from there, and never downloads them', async () => {
  const store = memStore();
  const old = net(Object.fromEntries(THEME_FILES.map((f) => [local(f), `bundled ${f}`])));
  const sound = soundFor('edena');
  assert.equal(await loadSoundtrack(sound, old.fetcher, { here: ANDROID, store, downloader: quick({ here: ANDROID, store, fetcher: old.fetcher }) }), true);
  assert.equal(sound.trackFrom, 'bundle');
  await quick({ here: ANDROID, store, fetcher: old.fetcher }).start();
  assert.deepEqual(sites(old.calls), [], 'from the bundle, not the site');
  assert.deepEqual([...store.m.keys()].sort(), THEME_FILES.filter((f) => f !== 'desert.mp3').sort());

  // the next update: only the desert's in the bundle, the site out of reach
  const next = net({ [local('desert.mp3')]: 'desert' }, { offline: true });
  for (const levelId of ['edena', 'incal', 'home', 'lantern', 'mangrove', 'desert']) {
    const s = soundFor(levelId);
    assert.equal(await loadSoundtrack(s, next.fetcher, { here: ANDROID, store, downloader: quick({ here: ANDROID, store, fetcher: next.fetcher }) }), true, levelId);
    assert.equal(s.trackFrom, levelId === 'desert' ? 'bundle' : 'stored', levelId);
  }
  await quick({ here: ANDROID, store, fetcher: next.fetcher }).start();
  assert.deepEqual(sites(next.calls), [], 'nothing downloaded again');
  assert.equal(SOUNDTRACKS.lantern, SOUNDTRACKS.home);
});


/** Just enough IndexedDB for themeStore (requests answered on the next tick). */
function fakeIDB() {
  const dbs = new Map();
  const request = (fn) => { const r = {}; setTimeout(() => { try { r.result = fn(); r.onsuccess?.(); } catch (e) { r.error = e; r.onerror?.(); } }); return r; };
  return {
    open(name, version) {
      const r = {};
      setTimeout(() => {
        let db = dbs.get(name);
        if (!db) {
          const stores = new Map();
          db = { version: 0, stores, objectStoreNames: { contains: (n) => stores.has(n) }, createObjectStore: (n) => stores.set(n, new Map()),
            transaction: (n) => ({ objectStore: () => { const s = stores.get(n); return {
              get: (k) => request(() => s.get(k)), put: (v, k) => request(() => { s.set(k, v); return k; }),
              delete: (k) => request(() => { s.delete(k); }), getAllKeys: () => request(() => [...s.keys()]) }; } }) };
          dbs.set(name, db);
        }
        r.result = db;
        if (db.version < version) { db.version = version; r.onupgradeneeded?.(); }
        r.onsuccess?.();
      });
      return r;
    },
  };
}

test('themeStore keeps Blobs in IndexedDB under the file name', async () => {
  assert.equal(themeStore(undefined), null, 'no IndexedDB: nothing kept');
  const idb = fakeIDB();
  const a = themeStore(idb);
  assert.equal(await a.get('incal.mp3'), null);
  await a.put('music/incal.mp3', new Blob(['I']));
  const b = themeStore(idb);   // (the next page, the next launch)
  assert.equal(await text(await b.get('incal.mp3')), 'I');
  assert.deepEqual(await b.keys(), ['incal.mp3']);
  await b.delete('incal.mp3');
  assert.equal(await a.get('incal.mp3'), null);
});
