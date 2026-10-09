// The world behind the title (src/title-world.js) and how the title runs it (src/title.js): loaded after
// the menu is up, on a sandboxed save, freed before the game, the game started in a fresh page after it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { titleResolution, titlePreset } from '../src/title-world.js';
import { SlotStore, slotKey } from '../src/save-slots.js';

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('the title shows its name and menu first; the world is imported after, on a sandboxed save', () => {
  const title = src('title.js');
  assert.doesNotMatch(title, /from '\.\/title-world\.js'/, 'never a static import: the menu must not wait for it');
  assert.match(title, /import\('\.\/title-world\.js'\)/);
  assert.ok(title.indexOf('markBooted(win)') < title.indexOf("import('./title-world.js')"), 'the heartbeat does not wait for the world');
  assert.ok(title.indexOf("show('main')") < title.indexOf("import('./title-world.js')"), 'the menu is drawn before');
  assert.ok(title.indexOf('slots.sandbox(') < title.indexOf("import('./title-world.js')"), 'sandboxed before any world module reads the save');
  // freed before the game: stopped, disposed; then a fresh page in the chosen slot
  assert.match(title, /vista\?\.dispose\(\)/);
  assert.match(title, /if \(worldStarted\) \{ win\.location\.replace\(`\$\{win\.location\.pathname\}\?start`\); return; \}/);
  // and ?start is a page that skips the title and plays the active slot (src/boot.js, src/save-slots.js)
  assert.match(src('boot.js'), /has\('start'\)\) history\.replaceState/);
  assert.match(src('save-slots.js'), /'start'/);
});

test('the world reads nothing of a save directly, and its levels load on demand', () => {
  const w = src('title-world.js');
  assert.doesNotMatch(w, /localStorage|SaveGame|slotStorage|journal/);
  assert.doesNotMatch(w, /from '\.\/levels\/index\.js'|from '\.\/levels\/content\.js'|from '\.\/main\.js'|from '\.\/ui\.js'/);
  assert.doesNotMatch(w, /from '\.\/levels\/(?!index)[\w-]+\.js'/, 'a world module is imported only when its shot is shown');
  // the traveller's modules too (the Player and the flask read the game state as they load)
  assert.match(w, /import\('\.\/player\.js'\)/);
  assert.doesNotMatch(w, /from '\.\/player\.js'|from '\.\/fluid-tool\.js'|from '\.\/game-state\.js'|from '\.\/items\.js'/);
  // no sound of its own: the title's menu music plays on
  assert.doesNotMatch(w, /new Sound\(|audio\.js/);
});

test('a sandboxed slot view reads and writes memory; the selector still sees the real slots', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  storage.setItem('moebius.slots.v', '1');
  storage.setItem('moebius.slot', '2');
  storage.setItem(slotKey('moebius.game.v1', 2), '{"flags":{"prologue.done":true,"real":1}}');
  const store = new SlotStore(storage), view = store.view();
  assert.match(view.getItem('moebius.game.v1'), /"real":1/);
  store.sandbox({ 'moebius.game.v1': '{"flags":{"title":1}}' });
  assert.ok(store.sandboxed);
  assert.match(view.getItem('moebius.game.v1'), /"title":1/, 'the sandbox, not slot 2');
  view.setItem('moebius.game.v1', '{"flags":{"written":1}}');
  view.setItem('moebius.save.v1', '{}');
  assert.match(mem.get(slotKey('moebius.game.v1', 2)), /"real":1/, 'slot 2 untouched');
  assert.equal(mem.get(slotKey('moebius.save.v1', 2)), undefined);
  view.removeItem('moebius.game.v1');
  assert.ok(mem.has(slotKey('moebius.game.v1', 2)));
  // the selector's reads: the real saves
  assert.equal(store.summary(2).empty, false);
  assert.equal(store.summary(1).empty, true);
  // a numbered slot's own view is never sandboxed (the selector reads those)
  assert.match(store.view(2).getItem('moebius.game.v1'), /"real":1/);
});

test('the render size is capped, lower on touch screens and handhelds, never supersampled', () => {
  const desk = titleResolution({ width: 1600, height: 900, dpr: 2, scale: 1.5 });
  assert.ok(desk.w * desk.h <= 2.1e6 + 4000, `${desk.w}x${desk.h}`);
  const plain = titleResolution({ width: 1920, height: 1080, dpr: 1, scale: 1 });
  assert.deepEqual([plain.w, plain.h], [1920, 1080]);
  const phone = titleResolution({ width: 390, height: 844, dpr: 3, scale: 1, touch: true });
  assert.ok(phone.w * phone.h <= 1e6 + 3000);
  const hand = titleResolution({ width: 730, height: 410, dpr: 2.6, scale: 0.75, handheld: true });
  assert.ok(hand.w * hand.h <= 0.5e6 + 2000);
  assert.equal(titlePreset('high', {}).scale, 1, 'High\'s 1.5x is the game\'s, not the title\'s');
  assert.equal(titlePreset('auto', { handheld: true }).key, 'handheld');
});

test('the menu still wires up: every entry, the keys, the pad and the glyphs', () => {
  const title = src('title.js');
  for (const a of ['continue', 'new', 'saves', 'settings', 'news', 'debug', 'fullscreen', 'back', 'keep', 'delete']) assert.match(title, new RegExp(`a === '${a}'|data-a="${a}"`), a);
  assert.match(title, /win\.addEventListener\('keydown', onKey\)/);
  assert.match(title, /new Controller\(/);
  assert.match(title, /menuNavigate\(navRoot\(\), x, y, fresh\)/);
  assert.match(title, /const lbl = \(text\) => `<span class="lbl">\$\{glyph\('ok', \{ focus: true \}\)\}/, 'the focused entry: A, inside the button');
  assert.match(title, /root\.addEventListener\('click', onClick\)/, 'mouse and touch');
  // laid out for the screen (src/title-layout.js), again on a resize and when the entries change
  assert.match(title, /titleLayout\(\{ w: win\.innerWidth, h: win\.innerHeight, buttons: mainNav\.querySelectorAll\('button'\)\.length/);
  assert.match(title, /win\.addEventListener\('resize', onResize\)/);
  assert.match(title, /win\.removeEventListener\('resize', onResize\)/);
  // the CSS reads the layout
  const css = src('menus.css');
  for (const v of ['--logo-top', '--logo-w', '--menu-top', '--menu-w', '--menu-cols', '--btn-h', '--btn-font']) assert.ok(css.includes(`var(${v}`), v);
});
