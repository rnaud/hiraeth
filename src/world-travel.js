// Going from one world to another in the same page (issue #790, the author: "we shouldn't load web pages when we move
// from one world to another, we should swap in place … so we don't lose sound"). docs/systems/world-swap.md.
//
// The game (src/main.js runWorld) builds one world from the page's address. Every way to another world (the ship's
// flight, a game on the way, a homecoming, the Worlds page's Travel here, the Debug menu's worlds, a game's way back)
// asks `travel(href)`: an address of this page that names a world (?level= or ?game=) is swapped in place: the address
// changed with history.replaceState, the world let go (its save written as a page load would, its listeners, timers,
// frames and registries' entries: src/world-scope.js; its renderer and GPU memory; the page's elements as index.html
// had them, the loading page back up), the next world built by runWorld again. The sound's context is carried over,
// still allowed to play: the last world's music goes on over the loading page and crossfades into the next world's.
// Anything else (the title, another page) is a page load as before; so is a swap asked for while a world is still
// being built, or one that fails (then the address is loaded as a page, the old way).

import { installScopes, openScope, closeScope, snapshotPage, restorePage, currentScope } from './world-scope.js';

const W = { run: null, world: null, scope: null, busy: false, carried: null, swaps: [], win: null, globals: null, prepare: null };

/** The address as a world of this page (a URL), or null: another page, or the title (no world named). */
export function worldAddress(href, loc) {
  let u;
  try { u = new URL(String(href), loc.href); } catch { return null; }
  if (u.origin !== loc.origin) return null;
  const page = (p) => p.replace(/index\.html$/, '');
  if (page(u.pathname) !== page(loc.pathname)) return null;
  if (!u.searchParams.has('level') && !u.searchParams.has('game')) return null;
  return u;
}

/** The loading page's look for the trip (index.html's own line: the space crossing for a flight or the pirates' fight). */
export const spaceLoading = (search) => /[?&](via=ship|game=pirates)(&|$)/.test(search);

/**
 * The first world (main.js, once): the page's wrappers installed, index.html's elements noted as they are, then
 * run() builds it. run() calls worldReady() once its world plays. prepare(win): what an address with debugsave asks
 * first (its debug save written, as src/boot.js does for the first world).
 */
export async function startWorlds(run, { win = globalThis.window, prepare = null } = {}) {
  W.run = run; W.win = win; W.prepare = prepare;   // (prepare(win): a Debug menu world's save seeded, main.js)
  installScopes(win);
  snapshotPage(win.document);
  // (the page's own names on window, before a world adds its: the world's are taken away with it, so the last
  // world is not held in memory while the next one is built)
  W.globals = new Set(Object.keys(win));
  win.__travel = travel; win.__swaps = swaps;   // (the benches' and the tests' handles: scripts/world-swap-bench.mjs)
  // a link to a world of this page (the Debug menu's cards, a game card's way on): swapped in place too
  win.document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target?.closest?.('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    if (!W.world || W.busy || !worldAddress(a.href, win.location)) return;
    e.preventDefault();
    travel(a.href, { win });
  });
  W.scope = openScope('world');
  await run();
}

/** The world now playing hands in what the next swap lets go of: { levelId, sound, teardown() }. */
export function worldReady(world) {
  W.world = world;
  W.win?.dispatchEvent?.(new W.win.CustomEvent('hiraeth:world', { detail: { level: world.levelId } }));
}

/** The last world's sound context, carried over to the next (once): { ctx, release(fade) }, or null. */
export function takeCarriedSound() { const c = W.carried; W.carried = null; return c; }

/** Is a world swap going on (the last one let go, the next one not playing yet)? */
export const swapping = () => W.busy;

/** The swaps so far: [{ from, to, ms, ok }] (the tests', the bench's). */
export const swaps = () => W.swaps;

const navigate = (win, href) => { win.location.href = href; };

/**
 * Go to `href`: a world of this page is swapped in place (true), anything else loaded as a page (false).
 * opts.page: true always loads the page (the old way: a reload asked for on purpose).
 */
export function travel(href, { win = W.win ?? globalThis.window, page = false } = {}) {
  const u = page ? null : worldAddress(href, win.location);
  if (!u || !W.world || W.busy || !W.run) { navigate(win, href); return false; }
  void swap(u, win);
  return true;
}

/** `location.search = s` for a world's address: travel('?…'). */
export const travelSearch = (search, o) => travel(String(search).startsWith('?') ? search : `?${search}`, o);

async function swap(u, win) {
  W.busy = true;
  const t0 = performance.now();
  const old = W.world;
  const rec = { from: old?.levelId ?? null, to: u.searchParams.get('level') ?? u.searchParams.get('game'), ms: 0, ok: false, letGo: null };
  W.world = null;
  try {
    // the world's own page-unload work first (its save, its play time), as a page load would run it; then its
    // listeners, timers, frames and registries' entries let go (src/world-scope.js)
    rec.letGo = closeScope(W.scope);
    W.scope = null;
    // its sound handed on (still playing over the loading page), the renderer and the rest let go (main.js)
    W.carried = old?.sound?.handOver?.() ?? null;
    try { old?.teardown?.(); } catch (e) { console.warn('world swap: the last world did not let go cleanly', e); }
    rec.globals = dropGlobals(win);
    // the page as the first world found it, the loading page back up
    restorePage();
    const doc = win.document;
    win.history.replaceState(null, '', `${u.pathname}${u.search}${u.hash}`);
    doc.getElementById('loading')?.classList.toggle('space', spaceLoading(u.search));
    // a route world picked in the Debug menu: its debug save first, as the page's start writes it (src/boot.js)
    if (u.searchParams.has('debugsave')) await W.prepare?.(win);
    W.scope = openScope('world');
    await W.run();
    rec.ok = true;
  } catch (e) {
    console.error('world swap failed: loading the page instead', e);
    W.carried?.release?.(0.2); W.carried = null;
    navigate(win, u.href);
  } finally {
    rec.ms = Math.round(performance.now() - t0);
    W.swaps.push(rec);
    console.info(`world swap: ${rec.from} → ${rec.to} in ${rec.ms} ms${rec.letGo ? ` (let go: ${rec.letGo.listeners} listeners, ${rec.letGo.timers} timers, ${rec.letGo.offs} entries)` : ''}`);
    W.busy = false;
  }
}

/** The names a world put on window (its debugging handles: window.player, window.scene…) taken away. */
function dropGlobals(win) {
  if (!W.globals) return 0;
  let n = 0;
  for (const k of Object.keys(win)) {
    if (W.globals.has(k) || k.startsWith('__')) continue;
    try { delete win[k]; n++; } catch { /* not ours to take */ }
  }
  return n;
}

/** For the tests: the module's state as at first. */
export function _resetTravelForTests() { Object.assign(W, { run: null, world: null, scope: null, busy: false, carried: null, swaps: [], win: null, globals: null, prepare: null }); }
export const _scopeForTests = () => currentScope();
