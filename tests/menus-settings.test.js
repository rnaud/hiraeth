// Playtest notes 2026-10-08, "Menus and settings": the galactic map charted the worlds still being made,
// the Settings' dropdowns could not be changed with a controller, and the language switched to French on
// its own while the debug entries vanished (hidden on purpose by src/dev-gate.js; they must survive a
// change of language when the gate is on).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORDER, SIDE, WIP, CHARTED_SIDE, isWip } from '../src/levels/names.js';
import { mapEntries } from '../src/ship/starmap.js';
import { padDirection, padConfirm, padCancel, padOpen, padReset, padStep, opensOnly } from '../src/menu-pad.js';
import { devMode } from '../src/dev-gate.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const levels = [...ORDER, ...SIDE].map((id) => ({ id, title: id }));

// ------------------------------------------------------------------ the galactic map: finished worlds only

test('the worlds still being made are off the galactic map, and still in the worlds list and the dev menu', () => {
  assert.ok(WIP.length > 0 && WIP.every((id) => SIDE.includes(id)), 'WIP worlds are detours off the route');
  assert.ok(ORDER.every((id) => !isWip(id)), 'every route world is finished');
  assert.deepEqual(CHARTED_SIDE, SIDE.filter((id) => !WIP.includes(id)));
  // the ship's map uses the charted detours by default
  const ship = src('src/ship/ship.js');
  assert.match(ship, /side: deps\.side \?\? CHARTED_SIDE/);
  assert.doesNotMatch(ship, /\?\? SIDE\b/);
  const shown = mapEntries({ order: ORDER, levels, side: CHARTED_SIDE, flag: () => false, journal: null, current: 'desert', home: false });
  assert.ok(shown.every((e) => !isWip(e.id)), 'no world still being made on the chart');
  assert.ok(ORDER.every((id) => shown.some((e) => e.id === id)), 'the route is all there');
  // ... and reachable for the author: the worlds list (L, Debug) and the dev menu take every level
  const main = src('src/main.js');
  assert.match(main, /const pickable = LEVELS;/);
  assert.match(main, /new DevMenu\(\{ levelId, levels: LEVELS,/);
});

test('the Sightings page leaves out the slots of the worlds still being made, unless already met there', async () => {
  const store = new Map();
  const { GameState } = await import('../src/game-state.js');
  const game = new GameState({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) });
  const { sightingsData, SIGHTINGS, sightingFlag } = await import('../src/story/sightings.js');
  const wipOne = SIGHTINGS.find((s) => isWip(s.world));
  assert.ok(wipOne, 'there are detour sightings to hide');
  const ids = (data) => data.flatMap((t) => t.entries.map((e) => e.id));
  const before = ids(sightingsData({ game }));
  assert.ok(before.every((id) => !isWip(SIGHTINGS.find((s) => s.id === id).world)), 'no ? slot for an unreachable world');
  assert.ok(SIGHTINGS.filter((s) => !isWip(s.world)).every((s) => before.includes(s.id)), 'every route sighting still counted');
  game.set(sightingFlag(wipOne.id), true);
  assert.ok(ids(sightingsData({ game })).includes(wipOne.id), 'one met (the dev menu took you there) is kept');
});

// ------------------------------------------------------------------ the Settings on a controller

/** A <select> or a range input, as menu-pad reads it. */
function control(kind, { options = 3, index = 0, value = 0.5, min = 0, max = 1, step = 0.25, pad } = {}) {
  const events = [], classes = new Set();
  const el = {
    tagName: kind === 'select' ? 'SELECT' : 'INPUT', type: kind === 'select' ? 'select-one' : 'range',
    options: kind === 'select' ? Array.from({ length: options }, (_, i) => ({ value: `o${i}` })) : undefined,
    selectedIndex: index, value: String(value), min: String(min), max: String(max), step: String(step),
    dataset: pad ? { pad } : {}, events,
    classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) },
    closest: () => null,
    dispatchEvent: (e) => events.push(e.type),
  };
  return el;
}
const button = { tagName: 'BUTTON', type: 'submit', dataset: {} };

test('left / right change a dropdown, but never with the push that landed on it (how French came on its own)', () => {
  padReset();
  const quality = control('select', { options: 6, index: 0 });
  // holding right from the menu's last button: the first push moves the focus (handled by menuNavigate)...
  assert.equal(padDirection(button, 1, 0, true), false, 'a button: the focus moves');
  // ...and the same push, repeating, now finds the dropdown focused: it stays as it was
  for (let i = 0; i < 5; i++) assert.equal(padDirection(quality, 1, 0, false), true, 'swallowed, the focus stays');
  assert.equal(quality.selectedIndex, 0);
  assert.deepEqual(quality.events, []);
  // a new push changes it, one step, told as an input; held, it repeats
  assert.equal(padDirection(quality, 1, 0, true), true);
  assert.equal(quality.selectedIndex, 1);
  padDirection(quality, 1, 0, false);
  assert.equal(quality.selectedIndex, 2);
  padDirection(quality, -1, 0, true);
  assert.equal(quality.selectedIndex, 1);
  assert.deepEqual(quality.events, ['input', 'input', 'input']);
  // up / down move on, never change it
  assert.equal(padDirection(quality, 0, 1, true), false);
  assert.equal(quality.selectedIndex, 1);
});

test('the language only changes once opened with A: left / right alone leave it', () => {
  padReset();
  const lang = control('select', { options: 2, index: 0, pad: 'open' });
  assert.ok(opensOnly(lang));
  assert.equal(padDirection(lang, 1, 0, true), true, 'a fresh push on it: nothing, the focus stays');
  assert.equal(lang.selectedIndex, 0);
  assert.deepEqual(lang.events, []);
  // the Settings menu marks it so
  assert.match(src('src/ui.js'), /<select data-k="lang" data-pad="open">/);
  // and nothing reads the device's language: English unless chosen
  assert.match(src('src/ui.js'), /lang: 'en',/);
  for (const f of ['src/ui.js', 'src/i18n.js', 'src/title.js', 'src/boot.js']) assert.doesNotMatch(src(f), /navigator\.languages?\b/, f);
});

test('A opens a dropdown, the directions go through its choices, A keeps one, B puts the old one back', () => {
  padReset();
  const lang = control('select', { options: 2, index: 0, pad: 'open' });
  assert.equal(padConfirm(lang), true, 'opened, not clicked');
  assert.equal(padOpen(), lang);
  assert.ok(lang.classList.contains('pad-open'), 'marked open');
  assert.equal(padDirection(lang, 0, 1, true), true, 'down: the next choice');
  assert.equal(lang.selectedIndex, 1);
  assert.deepEqual(lang.events, [], 'not applied while open');
  assert.equal(padConfirm(lang), true, 'A keeps it');
  assert.deepEqual(lang.events, ['input'], 'applied once');
  assert.equal(padOpen(), null);
  assert.ok(!lang.classList.contains('pad-open'));
  // B: as it was
  padConfirm(lang);
  padDirection(lang, 0, -1, true);
  assert.equal(lang.selectedIndex, 0);
  assert.equal(padCancel(), true);
  assert.equal(lang.selectedIndex, 1, 'the old choice back');
  assert.deepEqual(lang.events, ['input'], 'nothing applied');
  assert.equal(padCancel(), false, 'nothing open: B goes on as before');
  // the focus elsewhere while open: closed, as it was
  padConfirm(lang); padDirection(lang, 0, -1, true);
  padDirection(button, 0, 1, true);
  assert.equal(padOpen(), null);
  assert.equal(lang.selectedIndex, 1);
  // A on a checkbox or a button is still a click, on a slider nothing
  assert.equal(padConfirm(button), false);
  assert.equal(padConfirm(control('range')), true);
});

test('sliders step within their range', () => {
  const r = control('range', { value: 0.9, step: 0.05 });
  assert.equal(padStep(r, 1), true);
  assert.equal(r.value, '0.95');
  padStep(r, 1); padStep(r, 1);
  assert.equal(r.value, '1');
  assert.equal(padStep(r, 1), false, 'at the end');
});

test('the menus hand A, B and the held direction to menu-pad', () => {
  const main = src('src/main.js'), title = src('src/title.js'), ui = src('src/ui.js'), ctl = src('src/controller.js');
  assert.match(ctl, /this\.navigate\(y \? 0 : x, y, direction !== this\.direction\)/, 'a fresh push is told apart from a repeat');
  assert.match(ctl, /if \(padDirection\(root\.contains\(current\) \? current : null, x, y, fresh\)\) return;/);
  assert.match(main, /menuNavigate\(root, x, y, fresh\)/);
  assert.match(main, /if \(!padConfirm\(el\)\) el\.click\(\);/);
  assert.match(title, /menuNavigate\(navRoot\(\), x, y, fresh\)/);
  assert.match(title, /if \(!padConfirm\(el\)\) el\.click\(\);/);
  assert.match(ui, /if \(padCancel\(\)\) return;/, 'B closes an open dropdown before the menu');
});

// ------------------------------------------------------------------ the debug entries

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('the debug entries stay hidden from players, and with the gate on they survive a change of language', () => {
  // the gate (src/dev-gate.js) is meant: a player sees none, in any language
  assert.equal(devMode({ storage: mem(), search: '', dev: false, always: false, settings: { lang: 'fr' } }), false);
  // the Developer panel, ?dev=1 or a dev build show them, whatever the language
  for (const lang of ['en', 'fr']) {
    assert.equal(devMode({ storage: mem(), search: '', dev: false, always: false, settings: { devPanel: true, lang } }), true, lang);
    assert.equal(devMode({ storage: mem(), search: '?dev=1', dev: false, always: false, settings: { lang } }), true, lang);
  }
  const ui = src('src/ui.js'), title = src('src/title.js');
  // the Start menu redrawn in a new language goes through sync() (which shows [data-dev] by devMode)...
  const onLang = ui.slice(ui.indexOf('onLanguage(() => {'), ui.indexOf('/** Draw the menu (again'));
  assert.match(onLang, /this\.render\(\);/);
  assert.match(onLang, /if \(this\.open\) \{ this\.sync\(\);/);
  assert.match(ui, /toggle\(on = !this\.open, page = 'settings'\) \{\s*this\.open = on;\s*if \(on\) \{\s*this\.sync\(\);/, 'and when it opens later');
  // ...and the title's menu, redrawn in a new language, asks devMode again
  assert.match(title, /onLanguage\(\(\) => \{[^\n]*renderMain\(\); \}\);/);
  assert.match(title, /devMode\(\{ settings \}\) \? `<button data-a="debug">/);
  // found by data-a, never by their words
  for (const f of [ui, title]) assert.doesNotMatch(f, /textContent === ['"]D[eé]bog|textContent === ['"]Debug/);
});
