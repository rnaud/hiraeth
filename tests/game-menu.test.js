import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PANELS, DEFAULT_PANEL, MenuState, moveCursor, GameMenu, itemsPanel, questsPanel, worldsPanel, mapPanel, fullHtml, itemUse, worldFacts, menuPrompts, GEAR_COLS, CARRY_COL, ENDED } from '../src/game-menu.js';
import { itemsData, questsData, worldsData, chargeCard, menuSources } from '../src/game-menu-data.js';
import { Quests } from '../src/story/quests.js';
import { questGoal, QUEST_GOALS } from '../src/story/quest-goals.js';
import { Controller } from '../src/controller.js';
import { ITEMS } from '../src/items.js';

// The game menu (src/game-menu.js) that took the sketchbook's place: five panels (the Sketchbook's went in v1.62) turned with the
// shoulder buttons, a cursor over each panel's grid, A / × to open a thing full screen (and use it there),
// to track a quest or zoom the map, B / ○ to go back or close (issue #213).

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const row = (n, from = 0) => Array.from({ length: n }, (_, i) => ({ col: from + i }));

function questsWorld() {
  const flags = {}, game = { flag: (k) => flags[k], set: (k, v) => { flags[k] = v; }, emit() {} };
  const q = new Quests({ game });
  q.define({ id: 'desert.power', title: 'The Tree That Drinks', main: true, outro: 'The tree burns again.', stages: [
    { id: 'city', text: 'Walk to Qanat and find Nour', label: 'Qanat', at: [0, 0, 0] },
    { id: 'well', text: 'Listen at the dry well, as Nour asked', label: 'The dry well', at: [5, 0, 0] },
    { id: 'ama', text: 'Ask Ama at the camp fires for the drinking jar', label: 'Ama', at: [9, 0, 0] },
  ] });
  q.define({ id: 'desert.drum', title: 'Teo’s Drum', outro: 'Teo plays again.', stages: [{ id: 'find', text: 'Find Teo’s drum', at: [1, 0, 1] }, { id: 'back', text: 'Bring the drum back to Teo', at: [2, 0, 2] }] });
  q.define({ id: 'desert.mask', title: 'The Mask in the Sand', failOutro: 'The sand won.', stages: [{ id: 'go', text: 'Visit the masked head' }] });
  return { q, flags };
}

test('the panels: Quests first (the menu opens there, issue #213), the Map beside it, then Items, Worlds, People (no Sketchbook since v1.62); the shoulder buttons turn them round', () => {
  assert.deepEqual(PANELS.map((p) => p.name), ['Quests', 'Map', 'Items', 'Worlds', 'People']);
  assert.ok(!PANELS.some((p) => p.id === 'sketches'), 'the Sketchbook is gone (issue #213)');
  assert.equal(DEFAULT_PANEL, 'quests');
  const s = new MenuState();
  assert.equal(s.panel.id, 'quests');
  assert.deepEqual([s.neighbours().prev.name, s.neighbours().next.name], ['People', 'Map'], 'the neighbours named at the sides');
  s.turn(1); assert.equal(s.panel.id, 'map');
  s.turn(1); s.turn(1); assert.equal(s.panel.id, 'worlds');
  s.turn(1); assert.equal(s.panel.id, 'people');
  s.turn(1); assert.equal(s.panel.id, 'quests', 'round again');
  s.turn(-1); assert.equal(s.panel.id, 'people');
  s.show('sketches'); assert.equal(s.panel.id, 'people', 'an old caller asking for the Sketchbook: nothing changes');
  // each panel keeps its own cursor
  s.at.people = { r: 1, c: 2 }; s.turn(1); s.turn(-1);
  assert.deepEqual(s.cursor(), { r: 1, c: 2 });
});

test('the cursor: along a row, off its end onto the side tab, once more turns the panel; up and down keep the column', () => {
  const rows = [row(4), row(4), row(2)];
  assert.deepEqual(moveCursor(rows, { r: 0, c: 0 }, 1, 0), { r: 0, c: 1 });
  assert.deepEqual(moveCursor(rows, { r: 0, c: 3 }, 1, 0), { edge: 1, r: 0 }, 'past the end: the next panel\'s tab');
  assert.deepEqual(moveCursor(rows, { edge: 1, r: 0 }, 1, 0), { turn: 1 }, 'once more: turn');
  assert.deepEqual(moveCursor(rows, { edge: 1, r: 0 }, -1, 0), { r: 0, c: 3 }, 'back off the tab');
  assert.deepEqual(moveCursor(rows, { r: 1, c: 0 }, -1, 0), { edge: -1, r: 1 });
  assert.deepEqual(moveCursor(rows, { r: 0, c: 1 }, 0, 1), { r: 1, c: 1 });
  assert.deepEqual(moveCursor(rows, { r: 1, c: 3 }, 0, 1), { r: 0, c: 3 }, 'the short row has no column 3: on round to the top');
  assert.deepEqual(moveCursor(rows, { r: 0, c: 1 }, 0, -1), { r: 2, c: 1 }, 'up from the top: the bottom row');
  // a column no other row has: the next row's nearest cell
  assert.deepEqual(moveCursor([[{ col: 8 }], row(3)], { r: 0, c: 0 }, 0, 1), { r: 1, c: 2 });
  // nothing on the panel: left / right still reach the tabs
  assert.deepEqual(moveCursor([], { r: 0, c: 0 }, 1, 0), { edge: 1, r: 0 });
  const s = new MenuState();
  assert.equal(s.move(rows, 1, 0), 'move');
  s.at.quests = { r: 0, c: 3 };
  s.move(rows, 1, 0); assert.ok(s.cursor().edge, 'on the tab: right at the last column goes somewhere');
  assert.equal(s.cell(rows), null);
  assert.equal(s.move(rows, 1, 0), 'turn'); assert.equal(s.panel.id, 'map');
});

test('the menu without a page: open on a panel, move, turn with the shoulders; A / × opens an item full screen, takes its gun mode there, tracks a quest', () => {
  const { q } = questsWorld();
  q.start('desert.power'); q.start('desert.drum');
  const used = [], tracked = [];
  const owned = ['backpack', 'stun', 'jetpack'];
  let mode = 'shoot';
  const m = new GameMenu(null, {
    sources: menuSources({ items: { owned: () => owned }, mode: () => ({ mode, modes: ['shoot', 'stun'] }), quests: q, charge: () => ({ stage: 'out', worlds: 1, of: 6, names: [] }), journal: { data: {} }, levels: [], order: [] }),
    onTrack: (id) => { tracked.push(id); q.choose(id); }, onUse: (id) => { used.push(id); mode = { stun: 'stun', backpack: 'shoot' }[id]; },
  });
  m.open('items');
  assert.equal(m.panel, 'items');
  assert.equal(m.state.cell(m.rows).id, 'backpack', 'the backpack first');
  m.navigate(1, 0); m.navigate(1, 0);
  assert.equal(m.state.cell(m.rows).id, 'stun');
  m.confirm();
  assert.deepEqual(used, [], 'A / × on an item opens it full screen, nothing used yet');
  assert.equal(m.full?.id, 'stun', 'open full screen');
  assert.equal(m.fullCell().full.use, 'Use this mode', 'its action said there');
  m.confirm();
  assert.deepEqual(used, ['stun'], 'A / × in the full view takes the gun mode');
  assert.equal(m.full?.id, 'stun', 'and it stays open');
  assert.equal(m.fullCell().full.use, null, 'in use now: nothing more to do');
  assert.equal(m.fullCell().full.inUse, true);
  m.navigate(-1, 0); assert.equal(m.full.id, 'jetpack', '← the one before');
  assert.equal(m.state.cell(m.rows).id, 'jetpack', 'the cursor follows');
  m.navigate(1, 0);
  assert.equal(m.back(), true, 'B / ○: back to the grid');
  assert.equal(m.full, null);
  assert.equal(m.state.cell(m.rows).id, 'stun', 'on the one just shown');
  // LB / L1 twice: the Quests panel (the father's charge first, then the quests under way)
  m.turn(-1); m.turn(-1);
  assert.equal(m.panel, 'quests');
  assert.equal(m.state.cell(m.rows).id, 'desert.drum', 'it opens on the quest you are on');
  m.state.at.quests = { r: 0, c: 0 };
  m.navigate(0, 1); m.navigate(0, 1);
  const cell = m.state.cell(m.rows);
  assert.equal(cell.id, 'desert.power', 'the main quest (the drum was started last: it is tracked)');
  m.confirm();
  assert.deepEqual(tracked, ['desert.power']);
  assert.equal(q.tracked(), 'desert.power');
  assert.equal(m.rows[1][0].id, 'desert.power', 'the one you are on comes first');
  assert.equal(m.state.cell(m.rows).id, 'desert.power', 'and the cursor goes with it');
  // past the row's start, the People's tab; A / × on it turns there
  m.state.at.quests = { r: 0, c: 0 }; m.navigate(-1, 0);
  assert.equal(m.state.cursor().edge, -1);
  m.confirm(); assert.equal(m.panel, 'people', 'A / × on a side tab turns to it');
  // opened again with no panel asked (View / Select, J): the Quests (issue #213)
  m.open(); assert.equal(m.panel, 'quests');
  m.show('items'); m.open(); assert.equal(m.panel, 'quests', 'whatever was left showing');
  m.open('items'); assert.equal(m.panel, 'items', 'the Start menu\'s Items: its own');
});

test('the keyboard in the menu: Q / E and [ ] turn the panels, the arrows and WASD move, Enter uses', () => {
  const m = new GameMenu(null, { sources: { items: () => itemsData({ owned: ['backpack', 'jetpack'] }) } });
  m.open('items');
  const key = (code, o = {}) => m.key({ code, ...o });
  assert.equal(key('KeyE'), true); assert.equal(m.panel, 'worlds');
  key('KeyQ'); assert.equal(m.panel, 'items');
  key('BracketRight'); key('BracketLeft'); assert.equal(m.panel, 'items');
  key('ArrowRight'); assert.equal(m.state.cell(m.rows).id, 'jetpack');
  key('KeyA'); assert.equal(m.state.cell(m.rows).id, 'backpack');
  key('Enter'); assert.equal(m.full?.id, 'backpack', 'Enter opens it full screen');
  key('ArrowRight'); assert.equal(m.full?.id, 'jetpack', '→ the next one');
  assert.equal(key('Backspace'), true); assert.equal(m.full, null, 'Backspace (or Esc) back');
  assert.equal(key('KeyZ'), false, 'not the menu\'s');
  const quest = src('src/quest.js');
  assert.match(quest, /else if \(e\.code === 'Escape' && this\.open\) \{ e\.stopImmediatePropagation\(\); if \(!this\.menu\.back\(\)\) this\.toggle\(false\); \}/, 'Esc closes it (a person\'s page first)');
  assert.match(quest, /this\.open && !e\.repeat && this\.menu\.key\(e\)\) \{ e\.preventDefault\(\); e\.stopImmediatePropagation\(\); \}/, 'its keys go no further (Q is not the scout\'s, E not the use)');
});

test('a controller: LB / L1 and RB / R1 turn the panels in a menu, B / ○ closes it, View / Select still opens it', () => {
  const pad = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const actions = [];
  let ctx = 'menu';
  const c = new Controller({ pads: () => [pad], context: () => ctx, action: (a) => actions.push(a), look() {}, navigate() {}, scroll() {}, faces: () => ({ faces: 'xbox', byLabel: false }) });
  const tap = (i) => { pad.buttons[i] = { pressed: true, value: 1 }; c.update(0.016); pad.buttons[i] = { pressed: false, value: 0 }; c.update(0.016); };
  tap(4); tap(5); tap(1); tap(0);
  assert.deepEqual(actions, ['tabPrev', 'tabNext', 'back', 'confirm']);
  ctx = 'game'; c.update(0.016); actions.length = 0;
  tap(8); assert.deepEqual(actions, ['journal'], 'View opens it from the game');
  const main = src('src/main.js');
  assert.match(main, /if \(name === 'journal' && level\.compare\) level\.compare\(\);[^\n]*\n\s*else if \(name === 'journal'\) journal\.toggle\(true\);/);
  assert.match(main, /\(name === 'tabPrev' \|\| name === 'tabNext'\) && menuRoot\(\) === journal\.el\) journal\.menu\.turn\(name === 'tabPrev' \? -1 : 1\)/);
  assert.match(main, /else if \(root === journal\.el\) journal\.menu\.navigate\(x, y\)/, 'the stick and D-pad move its cursor');
  assert.match(main, /else if \(root === journal\.el\) journal\.menu\.confirm\(\);/, 'A / × uses or looks');
  const close = main.slice(main.indexOf('const closeControllerMenu'), main.indexOf('const controller = new Controller'));
  assert.match(close, /else if \(journal\.open\) \{ if \(!journal\.menu\.back\(\)\) journal\.toggle\(false\); \}/, 'B / ○ closes the whole menu, from any panel (a person\'s page first)');
  // the prompts are in the buttons (src/pad-glyphs.js): the side tabs carry LB / RB (Q / E), the ✕ carries B (Esc);
  // the strip only says what the confirm button does here, with its glyph
  assert.match(menuPrompts('track', 'pad'), /^<span class="gm-act"><span class="glyph" data-glyph="ok"[^>]*><\/span>track<\/span>$/);
  assert.match(menuPrompts('track', 'keys'), /data-glyph="ok"/);
  assert.equal(menuPrompts(null, 'pad'), '', 'nothing to do here: nothing said');
  assert.equal(menuPrompts('look', 'touch'), '', 'a touch screen: a second tap uses');
  const m = src('src/game-menu.js');
  assert.match(m, /class="gm-side prev"[^`]*\$\{glyph\('lb', \{ key: 'Q' \}\)\}/);
  assert.match(m, /class="gm-side next"[^`]*\$\{glyph\('rb', \{ key: 'E' \}\)\}/);
  assert.match(m, /class="gm-close close"[^`]*\$\{glyph\('back', \{ key: 'Esc' \}\)\}✕/);
});

test('a quest shows only its overall goal and its next step, and both follow the progress', () => {
  const { q } = questsWorld();
  q.start('desert.power');
  let a = q.summary().active[0];
  assert.equal(a.goal, 'Wake your ship with the fire of Qanat’s great tree', 'the goal, from quest-goals.js');
  assert.equal(a.step, 'Walk to Qanat and find Nour');
  q.advance('desert.power');
  a = q.summary().active[0];
  assert.equal(a.step, 'Listen at the dry well, as Nour asked', 'the next step moves on');
  assert.equal(a.goal, 'Wake your ship with the fire of Qanat’s great tree', 'the goal stays');
  const { html } = questsPanel(questsData({ quests: q }));
  assert.match(html, /Wake your ship with the fire of Qanat’s great tree/);
  assert.match(html, /<small>Next<\/small>Listen at the dry well, as Nour asked/);
  assert.doesNotMatch(html, /Walk to Qanat/, 'no step already done');
  assert.doesNotMatch(q.journalHtml(), /Walk to Qanat|class="done"/, 'nor in the quests as text');
  q.advance('desert.power'); q.advance('desert.power');
  const s = q.summary();
  assert.equal(s.active.length, 0);
  assert.deepEqual(s.done.map((d) => d.title), ['The Tree That Drinks'], 'finished: by title, in the short list');
  const done = questsPanel(questsData({ quests: q })).html;
  assert.doesNotMatch(done, /Ask Ama|dry well/, 'a finished quest keeps no steps');
  assert.match(done, /class="ended"[^>]*><i>✓<\/i>The Tree That Drinks/);
});

test('the Quests panel: the father\'s charge, the quests under way, then a short list of the ended ones; the goals come from one place', () => {
  const { q } = questsWorld();
  q.start('desert.drum'); q.start('desert.mask'); q.fail('desert.mask'); q.start('desert.power');
  const d = questsData({ quests: q, charge: { stage: 'out', worlds: 2, of: 6, kept: 1, names: ['x'] }, errands: { e1: { item: 'a brass gear', toTitle: 'Viridel', done: false } } });
  assert.equal(d.charge.goal, 'Bring back something of value');
  assert.equal(d.charge.step, 'Keep looking, out in the worlds');
  assert.deepEqual(d.errands.map((e) => e.goal), ['Carry a brass gear to Viridel']);
  const { rows, html } = questsPanel(d);
  assert.equal(rows[0][0].kind, 'charge');
  assert.deepEqual(rows.slice(1, 3).map((r) => r[0].id), ['desert.power', 'desert.drum'], 'the tracked one first');
  assert.equal(rows[0][1].kind, 'ended'); assert.equal(rows[0][1].sub, 'What happened');
  assert.match(rows[0][1].desc, /The sand won/, 'how it ended: said at the bottom when picked');
  assert.match(html, /<em class="tag"><i class="dot">◉<\/i>tracking<\/em>/);
  // at most ENDED of each in the list
  const many = Array.from({ length: ENDED + 3 }, (_, i) => ({ id: `d${i}`, title: `Done ${i}`, outro: '' }));
  assert.match(questsPanel({ done: many }).html, /and 3 more/);
  assert.equal(questsPanel({ done: many }).rows.length, ENDED);
  // every world's quest has a goal of its own words (or a rule: temples, boxes)
  assert.equal(questGoal({ id: 'temple.arzach', title: 'The Aerie' }), 'Find what the makers left in the Aerie');
  assert.equal(questGoal({ id: 'box.edena.lens', title: 'A Makers’ Box' }), 'Find the makers’ box and open it');
  assert.equal(questGoal({ id: 'x', title: 'Untold', goal: 'Its own goal' }), 'Its own goal');
  for (const [id, g] of Object.entries(QUEST_GOALS)) assert.ok(g.length < 64 && !/\.$/.test(g), `${id}: a few words, no full stop`);
});

test('the Items panel: a slot for every item to find (the empty ones unnamed), the gear first, what you carry and the keepsakes under it', () => {
  const d = itemsData({ owned: ['jetpack', 'backpack', 'lantern'], carried: ['the spark-stone'], keepsakes: [{ id: 'desert.knowing', level: 'desert', name: 'What the giants left', text: 'The giants carried the water.' }], titles: { desert: 'The Desert' }, icon: (id) => (id === 'backpack' ? 'data:image/png;base64,AA' : null) });
  assert.equal(d.slots, Object.values(ITEMS).filter((it) => !it.debug && !it.retired).length, 'a slot for every item there is to find');
  const { html, rows } = itemsPanel(d);
  assert.equal((html.match(/class="slot empty"/g) ?? []).length, d.slots - 3, 'empty slots drawn, never named');
  assert.match(html, /<img class="ico" src="data:image\/png;base64,AA"/, 'the item\'s own picture');
  assert.match(html, /<i class="ico mark" data-icon="jetpack">/, 'its kind\'s mark until the picture is ready');
  assert.deepEqual(rows.map((r) => r.map((x) => x.kind)), [['item', 'item', 'item'], ['pack', 'keepsake']], 'under the gear: a row of what you carry and the keepsakes');
  assert.deepEqual(rows[1].map((x) => x.col), [0, CARRY_COL]);
  assert.match(rows[1][1].sub, /from The Desert/);
  assert.deepEqual(moveCursor(rows, { r: 0, c: 2 }, 0, 1), { r: 1, c: 0 }, 'down from the gear: the pack');
  assert.ok(GEAR_COLS * 6 >= d.slots + 10, `six rows hold every item, the ten gadgets too (registered in the game, not here): ${d.slots} + 10`);
  // the menu learns of a picture once drawn (src/item-icons.js)
  const m = new GameMenu(null, { sources: { items: () => d } });
  m.open('items'); m.iconReady('jetpack', 'data:x');
  assert.equal(m.rows[0].find((x) => x.id === 'jetpack').it.icon, 'data:x');
});

test('the Worlds panel: every world you know, its story and relics; the boxes counted', () => {
  const data = { relics: { desert: { 0: { img: 'a' }, 2: { img: 'b' } } }, stories: { desert: { img: 'p' } }, observatory: { started: true, img: 'o' }, errands: { e: { item: 'a gear', toTitle: 'Viridel', done: true, img: 'g' } } };
  const levels = [{ id: 'desert', title: 'The Desert', relicNames: ['r0', 'r1', 'r2'], storyTitle: 'The Tree That Drinks', blurb: 'Dunes.' }, { id: 'incal', title: 'The City-Shaft', relicNames: ['s0'] }, { id: 'atelier', title: 'The Atelier', hidden: true, relicNames: [] }];
  const w = worldsData({ data, levels, order: ['desert', 'incal'], current: 'incal', boxes: { desert: { found: 1, total: 2 } }, known: () => true });
  assert.deepEqual(w.map((x) => [x.id, x.told, x.relics, x.boxes, x.current]), [['desert', true, [2, 3], [1, 2], false], ['incal', false, [0, 1], null, true]]);
  const wp = worldsPanel(w);
  assert.match(wp.html, /thumbs\/desert\.jpg/);
  assert.match(wp.html, /you are here/);
  assert.equal(wp.rows[0][0].desc, 'Dunes.');
  assert.equal(chargeCard(null), null, 'no charge before the father has said it');
});

test('nothing the sketchbook held is lost: the menu reads the gear, the charge, the quests, the errands and the boxes (the journal keeps the sketches)', () => {
  const main = src('src/main.js');
  const wire = main.slice(main.indexOf('Object.assign(journal.menu, {'), main.indexOf("onTrack: (id) => storyRt.quests.choose(id),\n  // an item"));
  for (const part of ['items,', 'quests: storyRt.quests', 'charge,', 'keepsakes: () => game.keepsakes()', 'journal,', 'boxes: () => boxes.counts()', 'errandDefs: ERRANDS', 'icon: (id) => itemIcons.get(id)'])
    assert.ok(wire.includes(part), `the menu reads ${part}`);
  assert.doesNotMatch(main, /journal\.sections/, 'no sketchbook sections any more');
  assert.match(main, /if \(journal\.open\) itemIcons\.pump\(\);/, 'the items\' pictures are drawn while the menu is open');
  // the Start menu's Items and Quests open it there; the touch ❏ (J) opens it too
  assert.match(main, /onBook: \(panel\) => journal\.toggle\(true, panel\)/);
  assert.match(src('src/ui.js'), /data-press="KeyJ" class="b-book"/);
  assert.match(src('index.html'), /<div id="journal"><\/div>/);
  assert.match(src('src/boot.js'), /import '\.\/game-menu\.css';/);
});

test('the Quests panel names what you finished in other worlds, whose quests are not defined where you are now', () => {
  // in Vael: Vael's own quest under way, the desert's and the City-Shaft's finished there (only their flags here)
  const flags = { 'quest.desert.power': 'done', 'quest.incal.light': 'done' }, game = { flag: (k) => flags[k], set: (k, v) => { flags[k] = v; }, emit() {} };
  const q = new Quests({ game });
  q.define({ id: 'arzach.bird', title: 'The Waiting Bird', world: 'arzach', main: true, stages: [{ id: 'a', text: 'Find Oïa', at: [0, 0, 0] }] });
  q.start('arzach.bird');
  const d = questsData({ quests: q });
  assert.deepEqual(d.active.map((x) => x.id), ['arzach.bird']);
  const titles = d.done.map((x) => x.title);
  assert.ok(titles.includes('The Tree That Drinks'), `done: ${titles.join(', ')}`);
  assert.ok(d.done.some((x) => x.id === 'incal.light'), 'the City-Shaft’s too');
  assert.match(questsPanel(d).html, /class="ended"[^>]*><i>✓<\/i>The Tree That Drinks/);
  assert.doesNotMatch(questsPanel(d).html, /None yet/);
});

// ------------------------------------------------------------------ issue #213: large items, A / × full screen, the Quests first

test('the items are large tiles with their names; the strip says the name only, the words are in the full view, beside the picture, never over it', () => {
  const d = itemsData({ owned: ['backpack', 'stun'], mode: 'shoot', modes: ['shoot', 'stun'] });
  const { html, rows } = itemsPanel(d);
  assert.match(html, /<div class="gm-items" data-grid-nav>/, 'as many tiles a row as fit, the cursor moving by where they are');
  assert.match(html, /<span class="nm">Stilling mode<\/span>/, 'each tile named under its picture');
  assert.doesNotMatch(html, /gm-preview/, 'no picture beside the grid any more');
  const stun = rows[0].find((x) => x.id === 'stun');
  assert.equal(stun.act, 'look');
  const full = fullHtml(stun, { prev: 'Magic-fluid backpack', next: null });
  // (the picture and the words are two cells of the full view's grid: .fpic and .ftext, side by side or one over the other)
  const pic = full.indexOf('class="fpic"'), text = full.indexOf('class="ftext"');
  assert.ok(pic > 0 && text > pic, 'the picture, then the words beside it');
  assert.doesNotMatch(full.slice(pic, text), /<p>|Stilling mode/, 'no words over the picture');
  assert.match(full.slice(text), /<h2>Stilling mode<\/h2>/);
  assert.match(full, /data-full-use>.*Use this mode/, 'its action, on A / ×');
  assert.match(full, /data-full-step="-1">.*Magic-fluid backpack/, '← the one before');
  // the game menu's strip: the name and what it is, no paragraph of words
  const gm = src('src/game-menu.js');
  assert.match(gm, /<footer class="gm-info"><div class="gm-what"><b class="gm-name"><\/b><span class="gm-sub"><\/span><\/div>/);
  assert.doesNotMatch(gm, /gm-desc/);
  assert.doesNotMatch(src('src/game-menu.css'), /gm-preview|gm-desc/);
});

test('the fragment finder switches on and off from its full view; a gadget is taken in hand there', () => {
  assert.equal(itemUse({ usable: true, toggle: true, inUse: true }), 'Switch it off');
  assert.equal(itemUse({ usable: true, toggle: true, inUse: false }), 'Switch it on');
  assert.equal(itemUse({ usable: true, kind: 'gadget' }), 'Take it in hand');
  assert.equal(itemUse({ usable: false, kind: 'gadget' }), null);
  let on = true;
  const used = [];
  const m = new GameMenu(null, { sources: menuSources({ items: { owned: () => ['finder'] }, toggles: () => ({ finder: on }), journal: { data: {} }, levels: [], order: [] }),
    onUse: (id) => { used.push(id); on = !on; } });
  m.open('items');
  assert.equal(m.state.cell(m.rows).id, 'finder');
  m.confirm();
  assert.equal(m.fullCell().full.use, 'Switch it off');
  m.confirm();
  assert.deepEqual(used, ['finder']);
  assert.equal(m.fullCell().full.use, 'Switch it on', 'drawn again, switched off');
  m.confirm();
  assert.equal(m.fullCell().full.use, 'Switch it off');
});

test('the worlds one a row: up and down go between them, A / × shows what you have found there and what is still to find', () => {
  const levels = ['desert', 'arzach', 'perdide'].map((id, i) => ({ id, title: ['The Desert', 'Vael', 'Lorn'][i], relicNames: ['Cup', 'Bell', 'Horn'], blurb: `${id}.` }));
  const flags = { 'met.ama': true, 'met.nour': true };
  const m = new GameMenu(null, { sources: menuSources({ items: { owned: () => [] }, game: { data: { flags }, keepsakes: () => [] }, journal: { data: { relics: { desert: { 0: { img: 'a' }, 2: { img: 'b' } } }, stories: { desert: { t: 1 } } } },
    levels, order: ['desert', 'arzach', 'perdide'], current: 'arzach', boxes: () => ({ desert: { found: 1, total: 2 } }) }) });
  m.open('worlds');
  assert.deepEqual(m.rows.map((r) => r.length), [1, 1, 1], 'one a row');
  m.navigate(0, 1); assert.equal(m.state.cell(m.rows).id, 'arzach', 'down: the next world');
  m.navigate(0, 1); m.navigate(0, 1); assert.equal(m.state.cell(m.rows).id, 'desert', 'and round');
  m.navigate(0, -1); assert.equal(m.state.cell(m.rows).id, 'perdide', 'up from the first: the last');
  m.navigate(0, 1);
  m.confirm();
  assert.equal(m.full?.id, 'desert');
  const f = m.fullCell().full;
  assert.match(f.facts, /The story is told/);
  assert.match(f.facts, /Relics: 2 of 3/); assert.match(f.facts, /Cup · \? · Horn/, 'the relics found by name, a ? for the one still to find');
  assert.match(f.facts, /Makers’ boxes: 1 of 2/);
  assert.match(f.facts, /People met: 2/); assert.match(f.facts, /Ama/);
  m.navigate(1, 0); assert.equal(m.full.id, 'arzach', '→ the next world');
  assert.match(m.fullCell().full.facts, /not told yet/);
  assert.deepEqual(worldFacts({ told: false, relics: [0, 0] }).map((x) => x.text), ['The story is not told yet']);
});
