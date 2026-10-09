// The recorded themes on a device (docs/systems/audio.md, "The themes on a device"). The APK and the Steam Deck
// package carry only the desert's (ON_DEVICE_THEMES: the first world plays its theme offline from the very first
// session); the over-the-air zip carries no others either (scripts/web-update.mjs onDemand). From the first open
// of the app, a bundled game (src/levels/reference-sheets.js bundledGame) fetches every other theme it hasn't
// got from the site, in the background, one at a time, and keeps them for good (themeDownloader):
//   - kept in IndexedDB (THEME_DB), one Blob per file name. The music never changes, so the file name is the
//     whole key: nothing is ever checked again, and it plays offline from then on;
//   - first from its own files if its bundle still has them (the APK and the updates up to v1.0 carried them
//     all: an install from before keeps them without a download), else from the site (SHEET_SITE/music/<file>,
//     served with CORS: public/_headers);
//   - only once the page is up (the title, or a world after its first frame) and settled: never during a
//     load. Each world is a new page, so a file cut short by a world change, closing the app or going offline
//     is fetched again from its start next time (when back online, or on the next open); the kept ones stay.
// A world reads its theme from the bundle, else the kept copy (themeSources); else the procedural score plays
// (src/score.js) and the theme comes in when the downloader lands it (src/soundtracks.js loadSoundtrack, which
// asks for that one first). The site and the dev server only ever read their own files.
import { bundledGame, SHEET_SITE } from './levels/reference-sheets.js';

/** The themes the devices carry: the desert's (the first world), the title's. The packaging reads this too. */
export const ON_DEVICE_THEMES = ['desert.mp3', 'singing-light.mp3', 'title.mp3'];   // (and the singing light's cue, heard in the prologue: src/soundtracks.js CUES; and the title's music, the first thing a launch plays: TITLE_THEME)
export const THEME_DB = 'hiraeth-music', THEME_STORE = 'themes', THEME_DB_VERSION = 1;

/** The key a theme is kept under: its file name (they never change; a new recording gets a new name). */
export const themeKey = (file) => String(file).split('/').pop();

/** A file in `music/`, the local copy (the bundle's, or the site's own on the web). */
export const localThemeUrl = (file, base = import.meta.env?.BASE_URL ?? './') => `${base}music/${themeKey(file)}`;
/** The same file on the game's site. */
export const siteThemeUrl = (file, site = SHEET_SITE) => new URL(`music/${themeKey(file)}`, site).href;

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

/**
 * The kept themes, in IndexedDB (GeckoView's loopback origin and Electron's moebius:// both have it; the Cache
 * API isn't sure on a custom scheme). null where there is none. { get(key) → Blob | null, put(key, blob), delete(key), keys() }
 */
export function themeStore(idb = globalThis.indexedDB) {
  if (!idb?.open) return null;
  let db = null;
  const open = () => db ??= new Promise((resolve, reject) => {
    const r = idb.open(THEME_DB, THEME_DB_VERSION);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(THEME_STORE)) r.result.createObjectStore(THEME_STORE); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => { db = null; reject(r.error); };
    r.onblocked = () => { db = null; reject(new Error('theme store blocked')); };
  });
  const run = async (mode, fn) => { const d = await open(); return req(fn(d.transaction(THEME_STORE, mode).objectStore(THEME_STORE))); };
  return {
    get: async (key) => (await run('readonly', (s) => s.get(themeKey(key)))) ?? null,
    put: (key, blob) => run('readwrite', (s) => s.put(blob, themeKey(key))),
    delete: (key) => run('readwrite', (s) => s.delete(themeKey(key))),
    keys: () => run('readonly', (s) => s.getAllKeys()),
  };
}

let sharedStore;
/** The page's store (one connection), or null. */
export const pageThemeStore = () => sharedStore === undefined ? (sharedStore = themeStore()) : sharedStore;

/** A fetch answer that is the file itself, not a page (a dev server answers a missing file with index.html). */
async function audioBlob(fetcher, url, opts) {
  const res = await fetcher(url, opts);
  if (!res?.ok) return null;
  const type = res.headers?.get?.('content-type') ?? '';
  if (/text\/html/i.test(type)) return null;
  return res.blob ? await res.blob() : new Blob([await res.arrayBuffer()]);
}
const aborted = (e) => e?.name === 'AbortError';

/**
 * Where a world's theme is read from now, in order (bundle → kept): yields { from, blob, keep }, `keep` true when
 * the bundle's copy should be kept (an install whose bundle still has every theme). The site's copy comes
 * through themeDownloader instead.
 */
export async function* themeSources(file, { here = globalThis.location, store = null, fetcher = globalThis.fetch, signal, base } = {}) {
  const key = themeKey(file), bundled = bundledGame(here), onDevice = ON_DEVICE_THEMES.includes(key);
  try {
    const blob = await audioBlob(fetcher, localThemeUrl(key, base), { signal });
    if (blob) { yield { from: 'bundle', blob, keep: bundled && !onDevice && !!store }; return; }
  } catch (e) { if (aborted(e)) throw e; }
  if (!bundled || !store) return;
  let blob = null;
  try { blob = await store.get(key); } catch { /* no store today */ }
  if (blob) yield { from: 'stored', blob, keep: false };
}

/** Keep a theme (best effort: a full disk only means it is fetched again later). */
export async function keepTheme(store, file, blob) {
  try { await store?.put(file, blob); return true; } catch { return false; }
}

const pageBooted = () => globalThis.window?.__moebiusBootedAt !== undefined;   // (src/native-app.js markBooted)

/**
 * The background download of every theme a device hasn't got. start() any number of times (the title and each
 * world call it); prefer(file) puts a theme first (the world being played); arrived(file) resolves with its
 * Blob once it is kept (null if the signal aborts first); progress() { have, total } counts the desert's.
 * @param o.files the themes (SOUNDTRACKS' files); o.booted whether the page is up; o.settle ms to wait after
 *   that; o.gap ms between two files; o.retryMs a later try after a failure (and on the 'online' event)
 */
export function themeDownloader({
  files, here = globalThis.location, store = pageThemeStore(), fetcher = globalThis.fetch, base, site,
  booted = pageBooted, settle = 8000, gap = 1500, retryMs = 120_000, online = () => globalThis.navigator?.onLine !== false,
  connection = globalThis.navigator?.connection, sleep = (ms) => new Promise((r) => { const t = setTimeout(r, ms); t?.unref?.(); }),
  listen = (fn) => globalThis.addEventListener?.('online', fn), onProgress = () => {},
} = {}) {
  const all = [...new Set(files.map(themeKey))];
  const wanted = all.filter((k) => !ON_DEVICE_THEMES.includes(k));
  const enabled = bundledGame(here) && !!store && !!fetcher;
  let have = null, running = null, first = null, retry = null, listening = false;
  const skipped = new Set(), waiters = new Map();
  const state = { downloaded: 0, failures: 0, done: false };

  const progress = () => ({ have: all.length - wanted.filter((k) => !have?.has(k)).length, total: all.length });
  const tell = (key, blob) => { for (const w of waiters.get(key) ?? []) w(blob); waiters.delete(key); };
  const next = () => {
    const missing = (k) => !have.has(k) && !skipped.has(k);
    return first && missing(first) ? first : wanted.find(missing) ?? null;
  };
  const later = () => {
    if (!listening) { listening = true; listen(() => { void start(); }); }
    clearTimeout(retry);
    retry = setTimeout(() => { void start(); }, retryMs);
    retry?.unref?.();
  };

  async function run() {
    while (!booted()) await sleep(1000);
    if (settle) await sleep(settle);
    if (!have) {
      try { have = new Set(await store.keys()); } catch { return; }
      onProgress(progress());
    }
    for (let key = next(); key; key = next()) {
      if (!online() || connection?.saveData) { later(); return; }
      let blob = null;
      try {
        blob = await audioBlob(fetcher, localThemeUrl(key, base));   // (a bundle from before still has it: no download)
      } catch { blob = null; }
      if (!blob) {
        try { blob = await audioBlob(fetcher, siteThemeUrl(key, site), { priority: 'low' }); }
        catch { state.failures++; later(); return; }   // (offline, or the site out of reach: from this file, later)
        if (!blob) { skipped.add(key); continue; }    // (the site hasn't got it: not this session)
        state.downloaded++;
      }
      if (!await keepTheme(store, key, blob)) { later(); return; }   // (a full disk: later)
      have.add(key);
      tell(key, blob);
      onProgress(progress());
      if (gap && next()) await sleep(gap);
    }
    state.done = wanted.every((k) => have.has(k));
  }

  function start() {
    if (!enabled) return Promise.resolve();
    return running ??= run().catch(() => {}).finally(() => { running = null; });
  }

  return {
    state, start, progress,
    prefer(file) { first = themeKey(file); },
    /** The theme's Blob once kept (already kept: at once), or null when the signal aborts. */
    async arrived(file, signal) {
      const key = themeKey(file);
      if (!enabled) return null;
      const kept = async () => { try { return await store.get(key); } catch { return null; } };
      const now = await kept();
      if (now) return now;
      return new Promise((resolve) => {
        const list = waiters.get(key) ?? [];
        list.push(resolve);
        waiters.set(key, list);
        signal?.addEventListener?.('abort', () => resolve(null), { once: true });
        if (have?.has(key)) void kept().then((blob) => tell(key, blob));   // (kept in the meantime)
      });
    },
  };
}

let shared = null;
/** The page's downloader (one per page; each world is a page), started once the page is up. */
export function startThemeDownload(files, { first } = {}) {
  shared ??= themeDownloader({ files });
  if (first) shared.prefer(first);
  void shared.start();
  return shared;
}

/** Settings > Updates: "Music: 18 of 25 downloaded" while some are missing on a device, else ''. */
export async function themeProgressText(files, { here = globalThis.location, store = pageThemeStore() } = {}) {
  if (!bundledGame(here) || !store) return '';
  const all = [...new Set(files.map(themeKey))];
  let keys;
  try { keys = new Set(await store.keys()); } catch { return ''; }
  const have = all.filter((k) => ON_DEVICE_THEMES.includes(k) || keys.has(k)).length;
  return have < all.length ? `Music: ${have} of ${all.length} downloaded` : '';
}
