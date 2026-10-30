// The title that paints at once (issue #110): the shot's vector drawing and the name on the screen the moment the
// page's script runs, with no world, no WebGL and no game module (src/title-paint.js, public/title-vectors/); the
// game loading behind the menu and waiting at its first frame until its save is chosen (src/title-hold.js); the
// tracing that makes the drawings (scripts/title-trace.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { paintTitle, vectorUrl } from '../src/title-paint.js';
import { createHold, holdInput, INPUT_EVENTS } from '../src/title-hold.js';
import { SlotStore } from '../src/save-slots.js';
import { SHOTS } from '../src/title-shots.js';
import { CHANGELOG } from '../src/changelog.js';
import { VERSION } from '../src/version.js';
import { changelogVersion } from '../vite.config.js';
import { quantize, cleanLabels, components, loops, simplify, loopArea, pathOf, inkMask, thin, strokes, strokePath } from '../scripts/title-trace.mjs';

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

// ------------------------------------------------------------------ a stand-in page
function fakeElement(tag) {
  const el = {
    tagName: tag.toUpperCase(), children: [], dataset: {}, attrs: {}, html: '', isConnected: false, listeners: {},
    style: { props: {}, setProperty(k, v) { this.props[k] = v; }, cssText: '' },
    classList: {
      set: new Set(),
      add(...c) { for (const x of c) this.set.add(x); }, remove(...c) { for (const x of c) this.set.delete(x); },
      replace(a, b) { if (!this.set.has(a)) return false; this.set.delete(a); this.set.add(b); return true; }, contains(c) { return this.set.has(c); },
    },
    set className(v) { el.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); },
    get className() { return [...el.classList.set].join(' '); },
    set innerHTML(v) { el.html = v; el.img = /<img class="art"/.test(v) ? fakeElement('img') : null; },
    get innerHTML() { return el.html; },
    querySelector(sel) { return sel === 'img.art' ? el.img : null; },
    querySelectorAll() { return []; },
    remove() { el.isConnected = false; },
    setAttribute(k, v) { el.attrs[k] = v; },
  };
  return el;
}
function fakePage({ search = '', w = 1280, h = 720 } = {}) {
  const body = { kids: [], appendChild(el) { this.kids.push(el); el.isConnected = true; return el; } };
  const doc = { body, createElement: fakeElement };
  const frames = [];
  const storage = new Map();
  const win = {
    innerWidth: w, innerHeight: h, location: { search },
    performance: { now: () => 12.5 },
    requestAnimationFrame: (f) => frames.push(f),
    getComputedStyle: () => ({ paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px' }),
    localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) },
  };
  return { doc, win, frames, storage };
}

test('the title paints its drawing and its name at once, with nothing of the game', () => {
  const page = fakePage({ search: '?shot=A4' });
  const store = new SlotStore(page.win.localStorage);
  const { root, shot, timing } = paintTitle({ doc: page.doc, win: page.win, store });
  assert.equal(shot.id, 'A4');
  assert.ok(page.doc.body.kids.includes(root), 'on the page');
  assert.equal(root.id, 'title');
  assert.match(root.innerHTML, /<svg class="logo"/, 'the name');
  assert.match(root.innerHTML, /<div class="paper"/, 'the paper under it until the drawing is in');
  assert.match(root.innerHTML, /<div class="light"/, 'the singing light');
  assert.ok(root.classList.contains('art-wait'));
  assert.equal(root.img.src, 'title-vectors/A4.svg');
  assert.equal(root.dataset.shot, 'A4');
  assert.ok(root.style.props['--logo-w'], 'the name laid out as the menu will lay it');
  // the drawing in: shown, and its first frame timed
  root.img.onload();
  assert.ok(root.classList.contains('art-on') && !root.classList.contains('art-wait'));
  for (const f of page.frames) f();
  assert.equal(timing.picture, 12.5);
  assert.equal(timing.painted, 12.5);
  // no drawing: the paper and the drawn land (src/title.js BACKDROP)
  const again = fakePage({ search: '?shot=H1' });
  const r2 = paintTitle({ doc: again.doc, win: again.win, store: new SlotStore(again.win.localStorage) }).root;
  r2.img.onerror();
  assert.ok(r2.classList.contains('art-none'));
});

test('the first paint imports nothing heavy, and the page paints it before anything else', () => {
  // title-paint.js and what it imports: pure, small modules (no three.js, no world, no sound, no game state)
  const seen = new Set();
  const walk = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    for (const [, dep] of src(f).matchAll(/^import [^;]*? from '\.\/([\w/-]+\.js)';/gm)) walk(dep);
  };
  walk('title-paint.js');
  assert.deepEqual([...seen].sort(), ['cinematics-page/storage.js', 'levels/names.js', 'save-slots.js', 'title-layout.js', 'title-logo.js', 'title-paint.js', 'title-shots.js']);
  for (const f of seen) assert.doesNotMatch(src(f), /from 'three'|import\('/, `${f}: nothing loaded on the way`);
  // the boot paints first: before the sound's guard, the keys, the first-run check and the title's own module
  const boot = src('boot.js');
  const at = (s) => { const i = boot.indexOf(s); assert.ok(i > 0, s); return i; };
  assert.ok(at('const painted = titled ? paintTitle() : null;') < at('audioGuard();'));
  assert.ok(at('paintTitle()') < at("import('./first-run.js')"));
  assert.ok(at('paintTitle()') < at("await import('./title.js')"));
  assert.match(boot, /showTitle\(\{ painted, behind: \{ hold, load \} \}\)/);
  // the title takes the painted screen over (no second one), and the version without the whole changelog
  const t = src('title.js');
  assert.match(t, /const paint = painted \?\? paintTitle\(/);
  assert.doesNotMatch(t + src('ui.js') + src('update-panel.js'), /from '\.\/changelog\.js'/, 'the 430 kB changelog is not on the title\'s way');
});

test('the version written into the build is the changelog\'s newest', () => {
  assert.equal(changelogVersion(), CHANGELOG[0].v);
  assert.equal(VERSION, CHANGELOG[0].v, 'written by node scripts/changelog-md.mjs, as under node and the dev server');
  assert.match(readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8'), /transform\(code, id\) \{ return build && [^?]*version[^?]*\? `export const VERSION = \$\{JSON\.stringify\(changelogVersion\(\)\)\};`/);
  assert.match(src('version.js'), /^export const VERSION = '[0-9.]+';$/m, 'a literal, no top-level await: the engines\' bundles take it as it is');
});

test('every shot has its drawing: an SVG of flat colour and ink, small', () => {
  for (const s of SHOTS) {
    const f = new URL(`../public/${vectorUrl(s)}`, import.meta.url);
    assert.ok(existsSync(f), `${s.id}: ${vectorUrl(s)} (node scripts/title-vectors.mjs ${s.id})`);
    const size = statSync(f).size;
    assert.ok(size < 220e3, `${s.id}: ${Math.round(size / 1024)} kB, under 220 kB`);
    const svg = readFileSync(f, 'utf8');
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"/);
    assert.match(svg, /<rect class="sky"/, 'the sky under all');
    assert.ok((svg.match(/<path fill="#/g) ?? []).length >= 8, `${s.id}: its colours`);
    assert.match(svg, /<g class="ink"><path fill="none" stroke="#2b211f"/, `${s.id}: its line work`);
    assert.doesNotMatch(svg, /<image|data:image|<script/, 'vectors only');
  }
  // the stills they are traced from stay out of the game's files (docs/title-shots/stills/)
  assert.ok(!existsSync(new URL('../public/title-stills', import.meta.url)), 'not shipped');
  for (const s of SHOTS) assert.ok(existsSync(new URL(`../docs/title-shots/stills/${s.id}.jpg`, import.meta.url)), `${s.id}: its still`);
});

// ------------------------------------------------------------------ the game behind the title
function fakeWindow() {
  class Target {
    constructor() { this.l = {}; }
    addEventListener(type, fn) { (this.l[type] ??= []).push(fn); }
    removeEventListener(type, fn) { this.l[type] = (this.l[type] ?? []).filter((f) => f !== fn); }
    fire(type, e = { type }) { for (const f of [...(this.l[type] ?? [])]) (typeof f === 'function' ? f.call(this, e) : f.handleEvent(e)); }
  }
  const win = new Target();
  win.EventTarget = Target;
  win.document = new Target();
  return win;
}

test('while the game is held, the input it listens for is the title\'s alone', () => {
  const win = fakeWindow();
  const heard = { title: 0, game: 0, gameDoc: 0, el: 0, resize: 0 };
  const title = () => heard.title++;
  win.addEventListener('keydown', title);   // (the title's, added before)
  let held = true;
  holdInput(win, () => held);
  const game = () => heard.game++;
  win.addEventListener('keydown', game);
  win.document.addEventListener('pointerdown', { handleEvent: () => heard.gameDoc++ });
  win.addEventListener('resize', () => heard.resize++);   // (not input: as it was)
  const el = new win.EventTarget();
  el.addEventListener('click', () => heard.el++);   // (an element's: as it was; the title covers the game's)
  win.fire('keydown'); win.document.fire('pointerdown'); win.fire('resize'); el.fire('click');
  assert.deepEqual(heard, { title: 1, game: 0, gameDoc: 0, el: 1, resize: 1 });
  // let go: the game hears everything, and a listener removed by its own function is gone
  held = false;
  win.fire('keydown'); win.document.fire('pointerdown');
  assert.deepEqual([heard.title, heard.game, heard.gameDoc], [2, 1, 1]);
  win.removeEventListener('keydown', game);
  win.fire('keydown');
  assert.deepEqual([heard.title, heard.game], [3, 1]);
  for (const t of ['keydown', 'keyup', 'pointerdown', 'click', 'touchstart', 'wheel']) assert.ok(INPUT_EVENTS.has(t), t);
});

test('the hold: the game waits at its first frame until released; the title goes once it has drawn it', async () => {
  const win = fakeWindow();
  const hold = createHold(win);
  assert.equal(hold.held, true);
  hold.start();
  let went = false, drew = false;
  hold.go.then(() => { went = true; });
  hold.playing.then(() => { drew = true; });
  hold.arrive();
  await Promise.resolve();
  assert.equal(went, false, 'loaded, and waiting');
  hold.release();
  await Promise.resolve();
  assert.equal(went, true);
  assert.equal(hold.held, false);
  hold.played();
  await Promise.resolve();
  assert.equal(drew, true);
  // a failed load is told to the title (it opens a fresh page)
  const h2 = createHold(win);
  let told = null;
  h2.onFail((e) => { told = e; });
  h2.fail(new Error('boom'));
  assert.equal(told.message, 'boom');
});

test('the game behind the title waits for its save; what it writes meanwhile stays in memory', () => {
  const m = new Map();
  const storage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const store = new SlotStore(storage);
  store.setActive(1);
  storage.setItem('hiraeth.s1.game.v1', 'old');
  store.holdWrites();
  const view = store.view();
  view.setItem('hiraeth.game.v1', 'new');
  view.removeItem('hiraeth.journal.v1');
  assert.equal(view.getItem('hiraeth.game.v1'), 'new', 'the game reads its own writes back');
  assert.equal(storage.getItem('hiraeth.s1.game.v1'), 'old', 'the disk is untouched');
  assert.equal(store.summary(1).empty, false);
  assert.equal(store.dropWrites(), 2, 'another save chosen: forgotten');
  assert.equal(view.getItem('hiraeth.game.v1'), 'old');
  store.holdWrites();
  view.setItem('hiraeth.game.v1', 'kept');
  store.commitWrites();
  assert.equal(storage.getItem('hiraeth.s1.game.v1'), 'kept', 'its save chosen: written');
  view.setItem('hiraeth.game.v1', 'after');
  assert.equal(storage.getItem('hiraeth.s1.game.v1'), 'after', 'and straight to the disk from then on');
});

test('starting waits only for the load: the title lets the game go and fades over its first frame', () => {
  const t = src('title.js');
  // the game behind the menu: Continue's save (a new player's first empty one), its writes held, its input held
  assert.match(t, /const slot = store\.latest\(\) \?\? store\.firstEmpty\(\) \?\? 1;/);
  assert.ok(t.indexOf('store.setActive(slot);') < t.indexOf('behind.load()'), 'the slot pinned before the game reads it');
  assert.ok(t.indexOf('store.holdWrites();') < t.indexOf('behind.load()'));
  assert.ok(t.indexOf('behind.hold.start();') < t.indexOf('behind.load()'), 'the input held before the game adds a listener');
  // chosen: its writes kept, released, and the title gone on the game's first frame; a mark until then
  assert.match(t, /if \(ours\) \{[\s\S]*?store\.commitWrites\(\);[\s\S]*?hold\.release\(\);\s*hold\.playing\.then\(/);
  assert.match(t, /if \(!hold\.isArrived\) \{ root\.append\(mark\); root\.classList\.add\('waiting'\); mark\.hidden = false;/);
  // the same save, the same settings, not deleted: anything else is a fresh page
  assert.match(t, /const gameFits = \(n\) => !!game && game\.slot === n && !game\.spoilt && !behind\.hold\.failed && settingsNow\(\) === game\.settings;/);
  assert.match(t, /if \(game\?\.slot === n\) game\.spoilt = true;/);
  // the game: built standing aside, its sound waiting, held at the first frame's door until released
  const m = src('main.js');
  assert.match(m, /const titleHold = window\.__titleHold \?\? null;/);
  assert.match(m, /autoStart: false, listen: false/);
  assert.match(m, /if \(!titleHold\) sound\.startIfAllowed\(\);/);
  assert.ok(m.indexOf('await prepareSoundWithRetry(sound') < m.indexOf('sound.listenForInput()'), 'recordings ready before gameplay can activate audio');
  assert.match(m, /loadWatch\.stop\(\);\s*\/\/[^\n]*\s*analytics\.ready\(\);[^\n]*\s*if \(titleHold\) \{ titleHold\.arrive\(\); await titleHold\.go; sound\.startIfAllowed\(\); \}\s*analytics\.play\(\);\s*stage\('ready'\);/);
  assert.ok(m.indexOf('titleHold?.played()') > m.indexOf("stage('ready')"), 'the title goes on the first frame');
  // the CSS: the drawing over the paper, the mark where the menu was
  const css = readFileSync(new URL('../src/menus.css', import.meta.url), 'utf8');
  assert.match(css, /#title\.art-on img\.art \{ opacity: 1; \}/);
  assert.match(css, /#title\.waiting \.main-menu, #title\.waiting \.saves \{ visibility: hidden; \}/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{[^}]*#title\.art-on \.light i/, 'the light still with reduced motion');
});

// ------------------------------------------------------------------ the tracing (scripts/title-trace.mjs)
test('tracing: flat colours, their outlines, and the pen\'s centre lines', () => {
  // an 24 × 16 picture: sky blue over sand, a red square, a dark pen line across the sand
  const w = 24, h = 16, rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    let c = y < 6 ? [90, 170, 172] : [236, 186, 116];
    if (x >= 3 && x < 9 && y >= 8 && y < 14) c = [214, 92, 72];
    if (y === 11 && x >= 12 && x < 22) c = [40, 32, 30];
    rgba.set([...c, 255], i);
  }
  const ink = inkMask(rgba, w, h, { reach: [1, 2] });
  assert.equal(ink[11 * w + 15], 1, 'the line is ink');
  assert.equal(ink[3 * w + 5], 0, 'the sky is not');
  const q = quantize(rgba, w, h, { k: 3, ink, sample: 2000, extra: 0 });
  const L = cleanLabels(q.labels, w, h, { passes: 0, minArea: 2 });
  assert.equal(L[11 * w + 15], L[13 * w + 15], 'the ink\'s pixels take the colour round them');
  const { list } = components(L, w, h);
  assert.equal(list.length, 3, 'sky, sand, the square');
  const square = list.find((c) => c.box[0] === 3 && c.box[1] === 8);
  const outline = loops((i) => square.pixels.includes(i), w, h);
  assert.equal(outline.length, 1);
  assert.equal(Math.abs(loopArea(simplify(outline[0], 0.5))), square.area, 'the piece\'s outline: its area, kept by its corners alone');
  assert.ok(square.area >= 24, 'the square, its edge maybe taken for ink');
  assert.match(pathOf([simplify(outline[0], 0.5)], 1), /^M\d+ \d+l[-\d ]+z$/);
  assert.match(pathOf([simplify(outline[0], 0.5)], 1, { smooth: true, frame: [w, h] }), /^M[\d.]+ [\d.]+q/);
  const line = strokes(thin(ink.slice(), w, h), w, h);
  assert.ok(line.length >= 1);
  assert.match(strokePath(line, 1), /^M\d+ \d+l/);
});
