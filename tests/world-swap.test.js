// The world swapped in place (issue #790, src/world-scope.js, src/world-travel.js, docs/systems/world-swap.md): what a
// world leaves in the page is let go with it, index.html's elements put back, a world's address swapped and not
// loaded, the sound's context handed on. The whole game swapped round worlds many times, its memory read after each:
// scripts/world-swap-bench.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installScopes, openScope, closeScope, owned, persist, currentScope, markPage, snapshotPage, restorePage, scopeDispatcher, _resetForTests } from '../src/world-scope.js';
import { EventDispatcher } from 'three';
import { worldAddress, spaceLoading, travel, startWorlds, worldReady, swaps, takeCarriedSound, _resetTravelForTests } from '../src/world-travel.js';
import { game } from '../src/game-state.js';
import { registerInteractable, allInteractables } from '../src/interact.js';
import { addIndoors, isIndoors } from '../src/shelter.js';

// ------------------------------------------------------------------ a page small enough to swap worlds in
class El extends EventTarget {
  constructor(tag, doc, attrs = {}) { super(); this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.parentNode = null; this._attrs = new Map(Object.entries(attrs)); this._html = ''; }
  get attributes() { return [...this._attrs].map(([name, value]) => ({ name, value })); }
  getAttribute(n) { return this._attrs.has(n) ? this._attrs.get(n) : null; }
  setAttribute(n, v) { this._attrs.set(n, String(v)); }
  removeAttribute(n) { this._attrs.delete(n); }
  hasAttribute(n) { return this._attrs.has(n); }
  get id() { return this._attrs.get('id') ?? ''; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; }
  get firstChild() { return this.children[0] ?? null; }
  get nextSibling() { const p = this.parentNode; return p ? p.children[p.children.indexOf(this) + 1] ?? null : null; }
  appendChild(c) { c.remove(); c.parentNode = this; this.children.push(c); return c; }
  insertBefore(c, ref) { c.remove(); c.parentNode = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
  remove() { const p = this.parentNode; if (p) { p.children.splice(p.children.indexOf(this), 1); this.parentNode = null; } }
  classList = { toggle: (n, on) => { const c = new Set((this.getAttribute('class') ?? '').split(' ').filter(Boolean)); if (on) c.add(n); else c.delete(n); this.setAttribute('class', [...c].join(' ')); } };
}
function makePage() {
  const doc = new EventTarget();
  doc.documentElement = new El('html', doc); doc.head = new El('head', doc); doc.body = new El('body', doc, { class: 'keys' });
  doc.createElement = (t) => new El(t, doc);
  doc.getElementById = (id) => doc.body.children.find((c) => c.id === id) ?? null;
  for (const [id, html] of [['loading', '<p class="msg">…</p>'], ['journal', ''], ['picker', '<a href="?level=arzach">Arzach</a>']]) { const e = new El('div', doc, { id }); e.innerHTML = html; doc.body.appendChild(e); }
  doc.body.appendChild(new El('script', doc, { type: 'module' }));
  return doc;
}
const page = makePage();
const frames = new Map(); let frameId = 0;
const win = Object.assign(new EventTarget(), {
  EventTarget, document: page, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval,
  requestAnimationFrame: (fn) => { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame: (id) => frames.delete(id),
  Worker: class { constructor(url) { this.url = url; } terminate() { this.dead = true; } },
  CustomEvent: class extends Event { constructor(t, o) { super(t); this.detail = o?.detail; } },
  location: { href: 'http://game.test/hiraeth/?level=desert', origin: 'http://game.test', pathname: '/hiraeth/', search: '?level=desert' },
  history: { replaceState(_, __, url) { const u = new URL(url, win.location.href); if ('_href' in win.location) win.location._href = u.href; else win.location.href = u.href; Object.assign(win.location, { pathname: u.pathname, search: u.search }); } },
});
const scopes = installScopes(win);

test('a world\'s window listeners, timers and frames are let go with it; the page\'s own stay', async () => {
  let pageHeard = 0, worldHeard = 0, ticked = 0, framed = 0;
  win.addEventListener('keydown', () => pageHeard++);   // (the page's own: added outside any world)
  const s = openScope('w1');
  win.addEventListener('keydown', () => worldHeard++);
  page.addEventListener('visibilitychange', () => worldHeard++);
  win.setInterval(() => ticked++, 5);
  win.setTimeout(() => ticked++, 5);
  win.requestAnimationFrame(() => framed++);
  win.dispatchEvent(new Event('keydown'));
  assert.equal(pageHeard, 1); assert.equal(worldHeard, 1);
  const n = closeScope(s);
  assert.equal(n.listeners, 2); assert.equal(n.timers, 2); assert.equal(n.frames, 1);
  assert.equal(frames.size, 0, 'its frame cancelled');
  win.dispatchEvent(new Event('keydown')); page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(pageHeard, 2, 'the page\'s listener still hears'); assert.equal(worldHeard, 1, 'the world\'s does not');
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(ticked, 0, 'its timers never fired');
  assert.equal(currentScope(), null);
});

test('a world\'s page-unload handlers run as it is let go (its save), then are gone', () => {
  const s = openScope('w2');
  let saved = 0;
  win.addEventListener('beforeunload', () => saved++);
  win.addEventListener('pagehide', () => saved++, { once: true });
  const removed = () => saved += 100;
  win.addEventListener('pagehide', removed); win.removeEventListener('pagehide', removed);
  closeScope(s);
  assert.equal(saved, 2);
  win.dispatchEvent(new Event('beforeunload'));
  assert.equal(saved, 2);
});

test('a registry\'s entries made in a world go with it (owned); those made outside, or persist()ed, stay', () => {
  const before = allInteractables().length;
  const keep = registerInteractable({ id: 'page.thing', distance: () => Infinity });
  const s = openScope('w3');
  registerInteractable({ id: 'world.thing', distance: () => Infinity });
  persist(() => registerInteractable({ id: 'lazy.page.thing', distance: () => Infinity }));
  addIndoors((p) => p.x === 1234);
  let heard = 0; game.on('swap:test', () => heard++);
  let offs = 0; owned(() => offs++);
  assert.equal(allInteractables().length, before + 3);
  assert.ok(isIndoors({ x: 1234 }));
  closeScope(s);
  assert.deepEqual(allInteractables().slice(before).map((e) => e.id), ['page.thing', 'lazy.page.thing']);
  assert.ok(!isIndoors({ x: 1234 }));
  game.emit('swap:test'); assert.equal(heard, 0);
  assert.equal(offs, 1);
  keep();
});

test('a world\'s workers stop with it; a page-wide one made under persist() goes on', () => {
  const s = openScope('w-workers');
  const mine = new win.Worker('cloth.js'), kept = persist(() => new win.Worker('lod.js'));
  assert.ok(mine instanceof win.Worker);
  assert.equal(closeScope(s).workers, 1);
  assert.equal(mine.dead, true); assert.equal(kept.dead, undefined);
});

test('three\'s dispose listeners added under a world (a renderer\'s, on a material a module keeps) go with it', () => {
  scopeDispatcher(EventDispatcher.prototype);
  const cached = new EventDispatcher();
  const pageOwn = () => {}; cached.addEventListener('dispose', pageOwn);
  const s = openScope('w-three');
  const renderers = () => {}; cached.addEventListener('dispose', renderers);
  cached.addEventListener('change', () => {});   // (other events are the object's own business)
  closeScope(s);
  assert.deepEqual(cached._listeners.dispose, [pageOwn]);
  assert.equal(cached._listeners.change.length, 1);
});

test('index.html\'s elements are put back as the first world found them; what a world added is taken away', () => {
  _resetForTests();
  markPage(page);
  page.getElementById('journal').innerHTML = '<b>translated</b>';   // (the page's own setup, before the world: kept)
  snapshotPage(page);
  const s = openScope('w4');
  // the world: its canvas and panels, the loading page taken away, the static ones filled in, a class on the body
  page.body.appendChild(new El('canvas', page));
  page.body.appendChild(new El('div', page, { class: 'shop' }));
  page.getElementById('loading').remove();
  const j = page.getElementById('journal');
  j.innerHTML = '<div>the world\'s journal</div>'; j.setAttribute('class', 'open'); j.setAttribute('style', 'display:block');
  let clicks = 0; j.addEventListener('click', () => clicks++);
  page.body.setAttribute('class', 'keys talking');
  page.head.appendChild(new El('style', page));
  const named = page.head.appendChild(new El('style', page, { id: 'starmap-css' }));
  closeScope(s);
  const removed = restorePage();
  assert.equal(removed, 3, 'the canvas, the shop and the unnamed style');
  assert.deepEqual(page.body.children.map((c) => c.id || c.tagName), ['loading', 'journal', 'picker', 'SCRIPT'], 'the loading page back, first');
  assert.equal(j.innerHTML, '<b>translated</b>');
  assert.equal(j.getAttribute('class'), null); assert.equal(j.getAttribute('style'), null);
  assert.equal(page.body.getAttribute('class'), 'keys');
  assert.ok(named.parentNode, 'a named style stays (its module adds it once)');
  j.dispatchEvent(new Event('click')); assert.equal(clicks, 0, 'its listener on a page element let go');
  // (children unchanged in their markup are made anew too: those left would keep the last world's listeners)
  const picker = page.getElementById('picker');
  const before = picker.innerHTML;
  picker.innerHTML = before; const stamp = {}; picker._stamp = stamp;
  let set = 0; const html = Object.getOwnPropertyDescriptor(El.prototype, 'innerHTML');
  Object.defineProperty(picker, 'innerHTML', { configurable: true, get: () => html.get.call(picker), set: (v) => { set++; html.set.call(picker, v); } });
  restorePage();
  assert.equal(set, 1, 'set again though its markup was unchanged');
});

test('which addresses are worlds of this page (swapped) and which are pages (loaded)', () => {
  const loc = { href: 'http://game.test/hiraeth/?level=desert', origin: 'http://game.test' , pathname: '/hiraeth/' };
  assert.equal(worldAddress('?level=arzach&via=ship', loc)?.searchParams.get('level'), 'arzach');
  assert.equal(worldAddress('?game=pirates&to=perdide', loc)?.searchParams.get('game'), 'pirates');
  assert.ok(worldAddress('/hiraeth/index.html?level=vael', loc));
  assert.equal(worldAddress('/hiraeth/', loc), null, 'the title');
  assert.equal(worldAddress('?start', loc), null, 'a new game from the title');
  assert.equal(worldAddress('cinematics.html#prologue', loc), null, 'another page');
  assert.equal(worldAddress('http://elsewhere.test/?level=desert', loc), null);
  assert.ok(spaceLoading('?level=arzach&via=ship')); assert.ok(spaceLoading('?game=pirates&to=x')); assert.ok(!spaceLoading('?level=arzach'));
});

test('travel swaps a world in place: the last let go, its sound handed on, the next built from the new address', async () => {
  _resetTravelForTests(); _resetForTests();
  closeScope(currentScope());
  markPage(page);
  const built = [], torn = [], loads = [];
  win.location.assign = (h) => loads.push(h);
  Object.defineProperty(win.location, 'href', { configurable: true, get() { return this._href; }, set(h) { loads.push(h); } });
  win.location._href = 'http://game.test/hiraeth/?level=desert';
  const sounds = [];
  const ctx = { state: 'running' };
  const run = async () => {
    const level = new URLSearchParams(win.location.search).get('level');
    let tick = 0; win.setInterval(() => tick++, 1000);
    win.addEventListener('keydown', () => {});
    const carried = takeCarriedSound();
    const sound = { level, ctx: carried?.ctx ?? ctx, handOver() { sounds.push(`handed ${level}`); return { ctx: this.ctx, release: () => sounds.push(`released ${level}`) }; } };
    if (carried) carried.release();
    built.push(level);
    worldReady({ levelId: level, sound, teardown: () => torn.push(level) });
  };
  await startWorlds(run, { win });
  assert.deepEqual(built, ['desert']);
  assert.equal(travel('cinematics.html#x', { win }), false, 'another page: loaded');
  assert.deepEqual(loads, ['cinematics.html#x']);
  assert.equal(travel('?level=arzach&via=ship', { win }), true);
  assert.equal(travel('?level=perdide', { win }), false, 'a second trip asked mid-swap is a page load');
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(built, ['desert', 'arzach']);
  assert.deepEqual(torn, ['desert']);
  assert.equal(win.location.search, '?level=arzach&via=ship', 'the address replaced, not loaded');
  assert.deepEqual(sounds, ['handed desert', 'released desert'], 'the context handed to the next world, the old sound let go once it started');
  assert.ok(page.getElementById('loading').getAttribute('class')?.includes('space'), 'the crossing\'s loading page for a flight');
  assert.equal(swaps().length, 1); assert.equal(swaps()[0].ok, true); assert.equal(swaps()[0].from, 'desert');
  assert.ok(swaps()[0].letGo.listeners >= 1 && swaps()[0].letGo.timers >= 1, 'the desert\'s listener and timer let go');
  assert.equal(loads.length, 2, 'the trip asked for mid-swap went to a page load');
  closeScope(currentScope());   // (the last world's interval)
});

test('every way between worlds goes through travel(), not a page load', () => {
  const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  const main = src('main.js');
  assert.match(main, /^async function runWorld\(\) \{$/m);
  assert.match(main, /\nawait startWorlds\(runWorld, \{ prepare: seedDebugWorld \}\);\n$/);
  assert.match(main, /playGame: \(href\) => \{ if \(!helperHereRt\?\.play\(href\)\) travel\(href\); \}/);
  assert.match(main, /navigate: \(href\) => \{ helper\?\.left\(\); transit\?\.left\(\); flushPlay\(\); travel\(href\); \}/);
  assert.doesNotMatch(main, /location\.search = /, 'main.js sets no address by a page load');
  assert.match(src('ship/ship.js'), /else travelSearch\(this\.departure\?\.\(to\) \?\? `\?level=\$\{to\}&via=ship`\)/);
  assert.match(src('dev-menu.js'), /travelSearch\(`\?level=\$\{id\}`\)/);
  assert.match(src('story/night-train.js'), /travelSearch\(href\)/);
  assert.match(src('minigames/kit/runner.js'), /travel\(href\)/);
  assert.match(src('minigames/kit/marker-core.js'), /travel\(href\)/);
  assert.match(src('levels/arcade-board.js'), /travel\(href\)/);
  // (the sound carried over: started on the last world's context, faded in, the last one released)
  assert.match(main, /sound\.start\(carried\.ctx, \{ fadeIn: 1\.5 \}\); carried\.release\(1\.5\);/);
  assert.match(main, /worldReady\(\{ levelId, sound, teardown:/);
  assert.match(main, /renderer\.forceContextLoss\(\);/);
});

test('the sound hands its context on and lets go of the rest without closing it', async () => {
  const audio = src2('audio.js');
  assert.match(audio, /handOver\(\) \{/);
  assert.match(audio, /release\(fade = 1\.5\) \{\n    const ctx = this\.ctx;\n    this\.ctx = null;/);
  assert.match(audio, /start\(adopt = null, \{ fadeIn = 0 \} = \{\}\)/);
});
const src2 = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
void scopes;

test('a world\'s story hangs its closures on its own copy of a quest, not on the data module\'s (held after the world)', async () => {
  const { Quests } = await import('../src/story/quests.js');
  const DATA = { id: 'swap.test', title: 'A test', world: 'desert', stages: [{ id: 'a', text: 'go' }] };
  const quests = new Quests({ game });
  quests.define(DATA);
  quests.def('swap.test').onDone = () => {};
  assert.equal(DATA.onDone, undefined, 'the data object untouched');
  assert.notEqual(quests.def('swap.test').stages[0], DATA.stages[0]);
  assert.equal(quests.def('swap.test').title, 'A test');
});
