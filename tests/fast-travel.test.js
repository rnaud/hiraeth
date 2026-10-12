// Fast travel from the game menu's Worlds page (v1.62, issue #213: "I want fast travel from the worlds page to the
// world's landing only"; src/fast-travel.js, docs/systems/ui.md): only to a world you have been to, never the one you
// are in, by the galactic map's own way (the ship's travel: the take-off, the arrival at its landing), and the leave
// gates hold (issue #217: the desert's blade and guard, Vael's wings), the ship's line shown under the button.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { fastTravel } = await import('../src/fast-travel.js');
const { worldsData } = await import('../src/game-menu-data.js');
const { worldsPanel, GameMenu, fullHtml, PANELS } = await import('../src/game-menu.js');

const flagsOf = (o) => (k) => o[k];
const seen = (...ids) => (id) => ids.includes(id);

test('"Travel here" shows on a world you have been to, with the ship powered, never on the one you are in', () => {
  const flag = flagsOf({ 'ship.powered': true });
  assert.equal(fastTravel.can({ to: 'desert', from: 'edena', seen: seen('desert', 'edena'), flag }), true);
  assert.equal(fastTravel.can({ to: 'edena', from: 'edena', seen: seen('desert', 'edena'), flag }), false, 'not where you are');
  assert.equal(fastTravel.can({ to: 'bazaar', from: 'edena', seen: seen('desert', 'edena'), flag }), false, 'not a world you have never been to');
  assert.equal(fastTravel.can({ to: 'desert', from: 'edena', seen: seen('desert'), flag: flagsOf({}) }), false, 'not without power');
  assert.equal(fastTravel.can({ to: 'arzach', from: 'arzach2', seen: seen('arzach'), flag }), false, 'a merged world’s part is that world');
});

test('the leave gates hold: the desert without its blade and guard, Vael without its wings; the ship says why', () => {
  const powered = { 'ship.powered': true, 'item.backpack': true, 'item.doublejump': true, 'item.gun': true };
  const no = fastTravel.refusal({ to: 'arzach', from: 'desert', seen: seen('arzach', 'desert'), flag: flagsOf(powered) });
  assert.ok(no, 'refused');
  assert.match(no.text, /^Not yet\. The Givers’ blade and the Givers’ guard are still in the Rose House\.$/);
  assert.deepEqual(no.missing, ['sword', 'shield']);
  assert.equal(no.quest, 'temple.desert', 'the quest that leads there (main.js starts it)');
  assert.equal(fastTravel.refusal({ to: 'arzach', from: 'desert', seen: seen('arzach'), flag: flagsOf({ ...powered, 'item.sword': true, 'item.shield': true }) }), null, 'with them: away');
  const vael = fastTravel.refusal({ to: 'desert', from: 'arzach', seen: seen('desert'), flag: flagsOf({ 'ship.powered': true }) });
  assert.match(vael.text, /fluid wings are still in the Aerie/);
  assert.equal(fastTravel.refusal({ to: 'desert', from: 'edena', seen: seen('desert'), flag: flagsOf({ 'ship.powered': true }) }), null, 'a world with no gate: away');
  assert.ok(fastTravel.refusal({ to: 'bazaar', from: 'edena', seen: seen('desert'), flag: flagsOf({ 'ship.powered': true }) }).text, 'never been there: no');
});

test('the Worlds page: a world you can travel to says so on its row; its full view’s A / × travels, or shows the gate’s line', () => {
  const levels = [{ id: 'desert', title: 'The Desert', relicNames: [] }, { id: 'arzach', title: 'Vael', relicNames: [] }, { id: 'perdide', title: 'Lorn', relicNames: [] }];
  const list = worldsData({ levels, order: ['desert', 'arzach', 'perdide'], current: 'arzach', travel: (id) => id !== 'perdide' });
  assert.deepEqual(list.map((w) => [w.id, w.travel]), [['desert', true], ['arzach', false], ['perdide', false]], 'not the one you are in');
  const { html, rows } = worldsPanel(list);
  assert.equal((html.match(/class="wtravel"/g) ?? []).length, 1);
  assert.equal(rows[0][0].full.use, 'Travel here');
  assert.equal(rows[1][0].full.use, null);
  // the menu: A / × on the row opens it; A / × in it travels
  const travelled = [];
  let answer = null;
  const m = new GameMenu(null, { sources: { worlds: () => list }, onTravel: (id) => { travelled.push(id); return answer; } });
  m.open('worlds');
  m.confirm();
  assert.equal(m.full?.id, 'desert', 'A / × on its row: its full view');
  assert.equal(m.verb(), 'Travel here', 'the strip says what A / × does');
  answer = 'Not yet. The fluid wings are still in the Aerie.';
  m.confirm();
  assert.deepEqual(travelled, ['desert']);
  assert.equal(m.note, answer, 'refused: the ship’s line, in the full view');
  assert.match(fullHtml(m.fullCell(), { note: m.note }), /class="fnote"[^>]*>Not yet\. The fluid wings are still in the Aerie\.</);
  m.back();
  assert.equal(m.note, null, 'gone once you go back');
  // the one you are in: nothing to do
  m.select(1, 0); m.confirm();
  assert.equal(m.verb(), null);
  m.confirm();
  assert.deepEqual(travelled, ['desert'], 'no travel to where you are');
  assert.ok(PANELS.some((p) => p.id === 'worlds'));
});

test('main.js: "Travel here" goes the galactic map’s way (the ship’s travel: take-off, arrival, saves), refusals start the gadget’s quest', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /travel: \(id\) => fastTravel\.can\(\{ to: id, from: levelId, seen: \(w\) => journal\.seen\(w\), flag: \(k\) => game\.flag\(k\) \}\)/);
  const on = main.slice(main.indexOf('  onTravel: (id) => {'), main.indexOf('  onTravel: (id) => {') + 600);
  assert.match(on, /fastTravel\.refusal\(/);
  assert.match(on, /game\.emit\('travel:refused'/);
  assert.match(on, /journal\.toggle\(false\);\s*ship\.travel\(id\);/);
  const ship = fs.readFileSync(new URL('../src/ship/ship.js', import.meta.url), 'utf8');
  assert.match(ship, /travel\(to\) \{[^]*?leaveRefusal\(this\.levelId, to,[^]*?TakeoffDirector[^]*?via=ship/, 'the ship’s own travel: the gate, the take-off, the arrival');
});
