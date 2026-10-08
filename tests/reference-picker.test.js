import test from 'node:test';
import assert from 'node:assert/strict';
import { REFERENCE_VIEWS, REFERENCE_SHEETS } from '../src/levels/reference-views.js';
import { pickerGroups, worldOf, thumbSize, drawThumb, ReferencePicker } from '../src/levels/reference-picker.js';

const flat = (groups) => groups.flatMap((w) => w.sheets.flatMap((s) => s.entries.map((e) => ({ ...e, world: w.world, group: s.sheet }))));

test('the quick menu: every view has one entry, numbered as the level counts them', () => {
  const entries = flat(pickerGroups(REFERENCE_VIEWS, REFERENCE_SHEETS));
  assert.equal(entries.length, REFERENCE_VIEWS.length);
  assert.deepEqual(entries.map((e) => e.index).sort((a, b) => a - b), REFERENCE_VIEWS.map((_, i) => i));
  for (const e of entries) {
    const v = REFERENCE_VIEWS[e.index];
    assert.equal(e.number, e.index + 1);
    assert.equal(e.id, v.id);
    assert.equal(e.title, v.title);
    assert.equal(e.sheet, v.sheet);
    assert.equal(e.group, v.sheet, `${v.id}: listed under its own sheet`);
    assert.equal(e.world, worldOf(v, REFERENCE_SHEETS), `${v.id}: listed under its own world`);
  }
});

test('the quick menu: grouped by world, then by sheet, in the views\' order', () => {
  const groups = pickerGroups(REFERENCE_VIEWS, REFERENCE_SHEETS);
  const worlds = groups.map((w) => w.world);
  assert.equal(new Set(worlds).size, worlds.length, 'each world once');
  assert.equal(worlds[0], 'The Desert');
  for (const w of ['The City-Shaft', 'The Buried Machine', 'The Garden of Spheres']) assert.ok(worlds.includes(w), w);
  for (const w of groups) {
    const sheets = w.sheets.map((s) => s.sheet);
    assert.equal(new Set(sheets).size, sheets.length, `${w.world}: each sheet once`);
    for (const s of w.sheets) for (const e of s.entries) assert.ok(String(REFERENCE_SHEETS[e.sheet].name).startsWith(w.world) || REFERENCE_VIEWS[e.index].world === w.world);
  }
  // a view added later (another world, another sheet) shows up by itself, with no list kept by hand
  const extra = { id: 'x', title: 'A new one', sheet: 'NEW_1', panel: 1, crop: [10, 20, 300, 200] };
  const more = pickerGroups([...REFERENCE_VIEWS, extra], { ...REFERENCE_SHEETS, NEW_1: { name: 'A New World / NEW_1.JPG', size: [1024, 1024], url: 'x.jpg' } });
  const last = more.at(-1);
  assert.equal(last.world, 'A New World');
  assert.deepEqual(last.sheets[0].entries[0].crop, extra.crop);
  assert.equal(last.sheets[0].entries[0].number, REFERENCE_VIEWS.length + 1);
});

test('the quick menu: each thumbnail is the view\'s own crop of its sheet', () => {
  for (const e of flat(pickerGroups(REFERENCE_VIEWS, REFERENCE_SHEETS))) {
    const v = REFERENCE_VIEWS[e.index];
    assert.deepEqual(e.crop, v.crop, `${v.id}: the thumbnail's crop`);
    assert.equal(e.url, REFERENCE_SHEETS[v.sheet].url, `${v.id}: cut from its own sheet`);
    const { w, h } = thumbSize(e.crop);
    assert.ok(w <= 132 && h <= 84 && (w === 132 || h === 84), `${v.id}: fits the thumbnail box`);
    assert.ok(Math.abs((w / h) / (v.crop[2] / v.crop[3]) - 1) < 0.03, `${v.id}: keeps the panel's proportions`);   // (relative: a strip's height rounds to whole pixels)
    const calls = [], img = {};
    drawThumb({ drawImage: (...a) => calls.push(a) }, img, e.crop, w * 2, h * 2);
    assert.deepEqual(calls, [[img, ...v.crop, 0, 0, w * 2, h * 2]], `${v.id}: drawn from the crop`);
  }
});

test('the quick menu: in the References level, without a page it builds nothing', async () => {
  const picker = new ReferencePicker({ views: REFERENCE_VIEWS, sheets: REFERENCE_SHEETS, win: null, doc: null });
  assert.equal(picker.open, false);
  assert.equal(picker.toggle(true), false, 'no page: nothing opens');
  assert.equal(picker.el, null);
  const src = (await import('node:fs')).readFileSync(new URL('../src/levels/references.js', import.meta.url), 'utf8');
  assert.match(src, /quickMenu: new ReferencePicker\(/, 'the level carries it (main.js: level.quickMenu)');
  assert.match(src, /Tab all views/, 'the label names the key');
  assert.match(src, /D-pad ↓ all views/, 'and the pad\'s button');
});
