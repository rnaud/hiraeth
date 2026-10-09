import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PANELS, MenuState, moveCursor, GameMenu, itemsPanel, questsPanel, sketchesPanel, worldsPanel, menuPrompts, GEAR_COLS, CARRY_COL, ENDED } from '../src/game-menu.js';
import { itemsData, questsData, sketchesData, worldsData, chargeCard, menuSources } from '../src/game-menu-data.js';
import { Quests } from '../src/story/quests.js';
import { questGoal, QUEST_GOALS } from '../src/story/quest-goals.js';
import { Controller } from '../src/controller.js';
import { ITEMS } from '../src/items.js';

// The game menu (src/game-menu.js) that took the sketchbook's place: four panels turned with the
// shoulder buttons, a cursor over each panel's grid, A / × to use or look, B / ○ to close.

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

test('the panels: Items, Quests, Sketchbook, Worlds, side by side; the shoulder buttons turn them round', () => {
  assert.deepEqual(PANELS.map((p) => p.name), ['Items', 'Quests', 'Sketchbook', 'Worlds']);
  const s = new MenuState();
  assert.equal(s.panel.id, 'items');
  assert.deepEqual([s.neighbours().prev.name, s.neighbours().next.name], ['Worlds', 'Quests'], 'the neighbours named at the sides');
  s.turn(1); assert.equal(s.panel.id, 'quests');
  s.turn(1); s.turn(1); assert.equal(s.panel.id, 'worlds');
  s.turn(1); assert.equal(s.panel.id, 'items', 'round again');
  s.turn(-1); assert.equal(s.panel.id, 'worlds');
  s.show('sketches'); assert.equal(s.panel.id, 'sketches');
  // each panel keeps its own cursor
  s.at.sketches = { r: 1, c: 2 }; s.turn(1); s.turn(-1);
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
  s.at.items = { r: 0, c: 3 };
  s.move(rows, 1, 0); assert.ok(s.cursor().edge, 'on the tab');
  assert.equal(s.cell(rows), null);
  assert.equal(s.move(rows, 1, 0), 'turn'); assert.equal(s.panel.id, 'quests');
});

test('the menu without a page: open on a panel, move, turn with the shoulders, A / × tracks a quest or takes a gun mode', () => {
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
  assert.deepEqual(used, ['stun'], 'A / × on a gun mode takes it');
  assert.equal(m.rows[0][2].act, null, 'in use now: nothing more to do');
  // RB / R1: the Quests panel (the father's charge first, then the quests under way)
  m.turn(1);
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
  // LB / L1 back to Items; past the row's start, the Worlds tab
  m.turn(-1); assert.equal(m.panel, 'items');
  m.state.at.items = { r: 0, c: 0 }; m.navigate(-1, 0);
  assert.equal(m.state.cursor().edge, -1);
  m.confirm(); assert.equal(m.panel, 'worlds', 'A / × on a side tab turns to it');
});

test('the keyboard in the menu: Q / E and [ ] turn the panels, the arrows and WASD move, Enter uses', () => {
  const m = new GameMenu(null, { sources: { items: () => itemsData({ owned: ['backpack', 'jetpack'] }) } });
  m.open('items');
  const key = (code, o = {}) => m.key({ code, ...o });
  assert.equal(key('KeyE'), true); assert.equal(m.panel, 'quests');
  key('KeyQ'); assert.equal(m.panel, 'items');
  key('BracketRight'); key('BracketLeft'); assert.equal(m.panel, 'items');
  key('ArrowRight'); assert.equal(m.state.cell(m.rows).id, 'jetpack');
  key('KeyA'); assert.equal(m.state.cell(m.rows).id, 'backpack');
  assert.equal(key('KeyZ'), false, 'not the menu\'s');
  const quest = src('src/quest.js');
  assert.match(quest, /else if \(e\.code === 'Escape' && this\.open\) \{ e\.stopImmediatePropagation\(\); this\.toggle\(false\); \}/, 'Esc closes it');
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
  assert.match(close, /else if \(journal\.open\) journal\.toggle\(false\);/, 'B / ○ closes the whole menu, from any panel');
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
  assert.match(html, /<em class="tag">tracked<\/em>/);
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
  assert.equal(d.slots, Object.keys(ITEMS).length);
  const { html, rows } = itemsPanel(d);
  assert.equal((html.match(/class="slot empty"/g) ?? []).length, d.slots - 3, 'empty slots drawn, never named');
  assert.match(html, /<img class="ico" src="data:image\/png;base64,AA"/, 'the item\'s own picture');
  assert.match(html, /<i class="ico mark" data-icon="jetpack">/, 'its kind\'s mark until the picture is ready');
  assert.deepEqual(rows.map((r) => r.map((x) => x.kind)), [['item', 'item', 'item'], ['pack', 'keepsake']], 'under the gear: a row of what you carry and the keepsakes');
  assert.deepEqual(rows[1].map((x) => x.col), [0, CARRY_COL]);
  assert.match(rows[1][1].sub, /from The Desert/);
  assert.deepEqual(moveCursor(rows, { r: 0, c: 2 }, 0, 1), { r: 1, c: 0 }, 'down from the gear: the pack');
  assert.ok(GEAR_COLS * 6 >= d.slots + 10, 'six rows hold every item, the ten gadgets too (registered in the game, not here)');
  // the menu learns of a picture once drawn (src/item-icons.js)
  const m = new GameMenu(null, { sources: { items: () => d } });
  m.open('items'); m.iconReady('jetpack', 'data:x');
  assert.equal(m.rows[0].find((x) => x.id === 'jetpack').it.icon, 'data:x');
});

test('the Sketchbook and Worlds panels: every world you know, its story page and relics, the errands and the observatory; the boxes counted', () => {
  const data = { relics: { desert: { 0: { img: 'a' }, 2: { img: 'b' } } }, stories: { desert: { img: 'p' } }, observatory: { started: true, img: 'o' }, errands: { e: { item: 'a gear', toTitle: 'Viridel', done: true, img: 'g' } } };
  const levels = [{ id: 'desert', title: 'The Desert', relicNames: ['r0', 'r1', 'r2'], storyTitle: 'The Tree That Drinks', blurb: 'Dunes.' }, { id: 'incal', title: 'The City-Shaft', relicNames: ['s0'] }, { id: 'atelier', title: 'The Atelier', hidden: true, relicNames: [] }];
  const sk = sketchesData({ data, levels, known: (id) => id !== 'incal' });
  assert.deepEqual(sk.worlds.map((w) => w.id), ['desert'], 'only worlds you know, and not the hidden one');
  const { rows } = sketchesPanel(sk);
  assert.deepEqual(rows[0].map((x) => x.act), ['look', 'look', null, 'look'], 'drawn ones can be held up');
  assert.equal(rows[0][2].name, 'Not found yet', 'a relic not found keeps its name to itself');
  assert.deepEqual(rows.slice(1).map((r) => r[0].sub), ['The Sleeping Observatory', 'Errands']);
  const w = worldsData({ data, levels, order: ['desert', 'incal'], current: 'incal', boxes: { desert: { found: 1, total: 2 } }, known: () => true });
  assert.deepEqual(w.map((x) => [x.id, x.told, x.relics, x.boxes, x.current]), [['desert', true, [2, 3], [1, 2], false], ['incal', false, [0, 1], null, true]]);
  const wp = worldsPanel(w);
  assert.match(wp.html, /thumbs\/desert\.jpg/);
  assert.match(wp.html, /you are here/);
  assert.equal(wp.rows[0][0].desc, 'Dunes.');
  assert.equal(chargeCard(null), null, 'no charge before the father has said it');
});

test('nothing the sketchbook held is lost: the menu reads the gear, the charge, the quests, the sketches, the errands, the observatory and the boxes', () => {
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

test('a story told in an older save, before pages were drawn, reads as told in the Sketchbook', () => {
  const sk = sketchesData({ data: { stories: { desert: { t: 1 } } }, levels: [{ id: 'desert', title: 'The Desert', relicNames: [] }] });
  assert.equal(sk.worlds[0].story.told, true);
  assert.equal(sk.worlds[0].story.img, null);
  const story = sketchesPanel(sk).rows.flat().find((c) => c.kind === 'story');
  assert.match(story.sub, /the story, told/);
  assert.match(story.desc, /older save/);
});
