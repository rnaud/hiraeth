// Issue #516: "In the quest menu it's not clear which quest is currently tracking and how to track another one?"
// The Quests page (src/game-menu.js questsPanel) draws the tracked quest in red (a red frame, a TRACKING tag with a
// dot), and the cursor's card on any other quest under way says A / × TRACK at its right (the pad's own button through
// src/pad-glyphs.js, Enter on the keyboard). The engines' menu (engine/menus.js gameView) gives each row `track` for
// BridgeMenu.Chrome.cs QuestCard to draw the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const { questsPanel } = await import('../src/game-menu.js');
const { EngineMenus } = await import('../engine/menus.js');
const { SlotStore } = await import('../src/save-slots.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DATA = {
  charge: { title: 'The charge', goal: 'Go', step: 'Walk', worlds: '0 of 9' },
  active: [{ id: 'q2', title: 'Sand', goal: 'Sweep', step: 'Sweep', tracked: true }, { id: 'q1', title: 'Water', goal: 'Find water', step: 'Look', main: true, tracked: false }],
  errands: [{ id: 'e1', title: 'A gear', goal: 'Carry it', step: 'Carry it' }], done: [], failed: [],
};
/** Each card of the page's html by its quest id. */
const cards = (html) => Object.fromEntries([...html.matchAll(/<button class="qcard ([^"]*)"[^>]*data-quest="([^"]+)">([\s\S]*?)<\/button>/g)].map((m) => [m[2], { cls: m[1], body: m[3] }]));

test('the tracked quest is marked TRACKING; the others under way carry the A / × track prompt', () => {
  const c = cards(questsPanel(DATA).html);
  assert.match(c.q2.cls, /\btracked\b/);
  assert.match(c.q2.body, /<em class="tag"><i class="dot">◉<\/i>tracking<\/em>/);
  assert.doesNotMatch(c.q2.body, /qtrack/, 'nothing to track on the one tracked');
  assert.match(c.q1.body, /<span class="qtrack"><span class="glyph" data-glyph="ok"[^>]*><\/span>track<\/span>/, 'the pad\'s A / × (Enter on the keyboard) and the verb');
  assert.doesNotMatch(c.q1.body, /class="tag"/);
  for (const id of ['charge', 'e1']) assert.doesNotMatch(c[id].body, /qtrack/, `${id}: not a quest to track`);
});

test('the page draws the tracked card in red, and the prompt only on the cursor\'s card', () => {
  const css = read('src/game-menu.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /#journal \.qcard\.tracked \{[^}]*border-color: var\(--red\)/, 'a red frame');
  assert.match(css, /#journal \.qhead \.qtrack \{[^}]*display: none/, 'hidden on the other cards');
  assert.match(css, /#journal \.qcard\.at \.qhead \.qtrack[^{]*\{ display: inline-flex; \}/, 'shown on the cursor\'s');
});

test('the engines\' Quests rows say which is tracked and which the pad can track (engine/menus.js gameView)', () => {
  const ls = new Map();
  const store = new SlotStore({ getItem: (k) => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) });
  const m = new EngineMenus({ store, sources: { quests: () => DATA, items: () => ({ gear: [], slots: 0, pack: [], keepsakes: [] }), worlds: () => [], people: () => ({ groups: [], person: null }), map: () => ({ world: '', marks: [] }) } });
  m.show('game', 'quests');
  const rows = m.view().rows.flat().filter((r) => r.kind === 'quest');
  const by = Object.fromEntries(rows.map((r) => [r.text, r]));
  assert.equal(by.Sand.tracked, true);
  assert.equal(by.Sand.track, '', 'the tracked one: no prompt');
  assert.equal(by.Water.tracked, false);
  assert.match(by.Water.track, /track/i);
  const cs = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.Chrome.cs');
  assert.match(cs, /◉ TRACKING/, 'Unity\'s tag');
  assert.match(cs, /Key\("ok", "A"\) \+ "  " \+ Ui\.Upper\(track\)/, 'Unity\'s prompt in the pad\'s own A / ×');
});
