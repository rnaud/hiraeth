// The fragments of the singing light (src/fragments.js, src/fragments-data.js), the scientist who counts them
// (src/story/scientist.js, scientist-data.js) and the upgrades he fits (src/items.js `fragments`); issue #196,
// docs/systems/fragments.md. Where each fragment stands, and that the walker reaches it, is checked with the
// other every-world checks in tests/contact-audit.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import { readFileSync } from 'node:fs';
await import('./register-gadgets.js');
const { FRAGMENTS, FRAGMENT_TOTAL, FRAGMENTS_PER_WORLD, fragmentCounts, fragKey } = await import('../src/fragments-data.js');
const { createFragments, FRAGMENT, finderInterval, finderPitch } = await import('../src/fragments.js');
const { THRUM, THRUM_TALK, THRUM_SHOP_LINES, thrumPerson, tallyLines } = await import('../src/story/scientist-data.js');
const { PRICES, FragmentShop, fragmentPurse, thrumWares, affordable } = await import('../src/fragment-shop.js');
const { shopHtml, upgradeWare, shopMoney, ShopPanel } = await import('../src/shop-panel.js');
const { setupScientist, meetSpot, ABOARD, JAR_MAX } = await import('../src/story/scientist.js');
const { ITEMS, FRAGMENT_ITEMS, items } = await import('../src/items.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { Quests } = await import('../src/story/quests.js');
const { GameState, game: sharedGame } = await import('../src/game-state.js');
const { migrateFlags, migrateFragments196, migrateFragments228, migrateFragments250, FRAGMENTS_MOVED_228, FRAGMENTS_MOVED_250, MIGRATED } = await import('../src/save-migrate.js');
const { parseLine } = await import('../src/story/tone.js');
const { ORDER } = await import('../src/levels/names.js');
const { Resources, MAGIC_COST, HEARTS } = await import('../src/resources.js');
const { BLADE } = await import('../src/fluid-blade.js');
const { syncUpgrades } = await import('../src/trials/upgrades.js');
const { LIGHT } = await import('../src/boxes/effects.js');
const { worldsData, itemsData } = await import('../src/game-menu-data.js');
const { worldsPanel } = await import('../src/game-menu.js');
const { PERSON } = await import('../src/story/people-book.js');
const { buildItemModel } = await import('../src/boxes/model.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
/** A fresh save, and items kept in it (as src/items.js keeps them in the shared one). */
function fresh(flags = {}) {
  const game = new GameState(memory());
  Object.assign(game.data.flags, flags);
  const its = {
    has: (id) => !!game.flag(`item.${id}`),
    grant: (id) => { if (its.has(id)) return false; game.set(`item.${id}`, true); return true; },
  };
  return { game, items: its, quests: new Quests({ game }) };
}
/** n fragments found, the first worlds' first. */
const found = (n) => {
  const f = {};
  for (const id of ORDER) for (let i = 0; i < FRAGMENTS[id].length && n > 0; i++, n--) f[fragKey(id, i)] = true;
  return f;
};
/** Talk to him and give these answers (by their first words); → the runner and the pages said. */
function talk(person, ctx, answers = []) {
  const r = new DialogueRunner(person, ctx), said = [];
  const read = () => { said.push(r.text); while (!r.lastPage) { r.advance(); said.push(r.text); } };
  read();
  for (const a of answers) {
    const pick = r.choices().find((c) => c.text.startsWith(a));
    assert.ok(pick, `no answer "${a}" in ${JSON.stringify(r.choices().map((c) => c.text))} at ${r.nodeId}`);
    r.choose(pick.index);
    if (r.ended) break;
    read();
  }
  while (!r.ended && r.advance()) read();
  return { r, said: said.join(' ') };
}

test('the data: eight in each world on the route, ninety-six all told; his seven upgrades priced 3 to 30, ninety-six all told', () => {
  assert.deepEqual(Object.keys(FRAGMENTS).sort(), [...ORDER].sort(), 'every route world, and only those');
  for (const id of ORDER) {
    assert.equal(FRAGMENTS[id].length, FRAGMENTS_PER_WORLD, id);
    for (const p of FRAGMENTS[id]) assert.ok(p.length === 3 && p.every(Number.isFinite), `${id}: [x, y, z]`);
  }
  assert.equal(FRAGMENT_TOTAL, ORDER.length * FRAGMENTS_PER_WORLD);
  assert.equal(FRAGMENT_TOTAL, 96);
  // (v1.62, issue #185: a shop; the cheapest first, as the milestones came: 5, 10, 15, 25, 50, 75, 96)
  assert.deepEqual(FRAGMENT_ITEMS.map((u) => [u.id, u.price]), [['finder', 3], ['lightheart', 5], ['lightedge', 7], ['lightcell', 10], ['lightwing', 18], ['lightstep', 23], ['lightguard', 30]]);
  assert.equal(Object.values(PRICES).reduce((a, b) => a + b, 0), FRAGMENT_TOTAL, 'every upgrade for every fragment there is');
  // bought the cheapest first, as soon as you could: the n-th upgrade never later than the n-th milestone was
  const OLD = [5, 10, 15, 25, 50, 75, 96];
  let paid = 0;
  FRAGMENT_ITEMS.forEach((u, n) => { paid += u.price; assert.ok(paid <= OLD[n], `${u.id}: the ${n + 1}th bought by ${paid} found, the ${n + 1}th milestone was ${OLD[n]}`); });
  assert.equal(Math.max(...Object.values(PRICES)), PRICES.lightguard, 'the guard the dearest');
  for (const { id } of FRAGMENT_ITEMS) {
    assert.ok(THRUM_SHOP_LINES[id]?.length, `${id}: his line as he fits it`);
    for (const l of THRUM_SHOP_LINES[id]) assert.ok(parseLine(l).explicit, `${id}: toned`);
    assert.match(ITEMS[id].where, /sells it aboard your ship, for [a-z-]+ fragments/, `${id}: where says his price`);
    assert.ok(buildItemModel(id).children.length >= 2, `${id}: a model of its own for the items page`);
  }
});

test('the counts: all told and world by world, with how many are left in each', () => {
  const c = fragmentCounts({ ...found(10), [fragKey('bazaar', 7)]: true });
  assert.equal(c.found, 11);
  assert.equal(c.total, 96);
  assert.deepEqual([c.worlds.desert.found, c.worlds.desert.left], [8, 0]);
  assert.deepEqual([c.worlds.arzach.found, c.worlds.arzach.left], [2, 6]);
  assert.deepEqual([c.worlds.bazaar.found, c.worlds.bazaar.left], [1, 7]);
  assert.equal(c.worlds.perdide.left, 8);
});

test('a fragment walked into is yours: saved, counted, gone, its light out; it sings near, and only near', () => {
  const { game, items: its } = fresh();
  const player = { pos: V(), hidden: false };
  const sang = [], toasts = [], events = [];
  const sound = { fragmentSong: (p, k) => sang.push(k), fragmentTaken: () => {}, finderBeep: () => {} };
  const lights = [];
  game.on('fragment', (e) => events.push(e));
  const F = createFragments({ levelId: 'edena', scene: new THREE.Scene(), player, sound, game, items: its, toast: (t) => toasts.push(t), lights });
  assert.equal(F.list.length, 8);
  assert.equal(lights.length, 8, 'each glows on the ground round it');
  const f = F.list[2];
  // far off: quiet
  player.pos.copy(f.pos).add(V(80, 0, 0));
  F.update(0.1, 0);
  assert.equal(sang.length, 0, 'not heard from 80 m');
  // near: its three notes, once a while
  player.pos.copy(f.pos).add(V(12, -FRAGMENT.lift, 0));
  for (let k = 0; k < 40; k++) F.update(0.1, k * 0.1);
  assert.ok(sang.length >= 1 && sang.length <= 2, `sings every ${FRAGMENT.singEvery} s (${sang.length} in 4 s)`);
  // walked into
  player.pos.copy(f.pos).add(V(0.5, -FRAGMENT.lift, 0));
  F.update(0.1, 5);
  assert.equal(game.flag(fragKey('edena', 2)), true, 'saved');
  assert.equal(f.grp.visible, false);
  assert.equal(lights.length, 7);
  assert.deepEqual(events, [{ world: 'edena', i: 2, found: 1, total: 96, left: 7 }]);
  assert.match(toasts[0], /fragment of the singing light · 1 of 96 · 7 left in Viridel/);
  // a world built again with it found: not there
  const again = createFragments({ levelId: 'edena', scene: new THREE.Scene(), player, game, items: its, lights: [] });
  assert.equal(again.list[2].grp.visible, false);
  assert.equal(again.list.filter((x) => !x.found).length, 7);
});

test('the finder: beeps from 60 m, faster and higher as a fragment comes closer; switched off from the items page', () => {
  assert.equal(finderInterval(61), null, 'out of range: quiet');
  assert.ok(finderInterval(60) > finderInterval(30) && finderInterval(30) > finderInterval(2), 'faster closer');
  assert.ok(Math.abs(finderInterval(0) - FRAGMENT.finder.fast) < 1e-9 && Math.abs(finderInterval(60) - FRAGMENT.finder.slow) < 1e-9);
  assert.ok(finderPitch(5) > finderPitch(50), 'higher closer');
  const { game, items: its } = fresh();
  const player = { pos: V() };
  const beeps = [];
  const F = createFragments({ levelId: 'edena', scene: new THREE.Scene(), player, sound: { finderBeep: (f) => beeps.push(f) }, game, items: its });
  const f = F.list[0];
  const count = (d) => { beeps.length = 0; player.pos.copy(f.pos).add(V(d, -FRAGMENT.lift, 0)); for (let k = 0; k < 50; k++) F.update(0.1, k * 0.1); return beeps.length; };
  // (3 m off: out of reach to take)
  assert.equal(count(3), 0, 'no finder yet: no beeps');
  its.grant('finder');
  const far = count(40), near = count(3);
  assert.ok(far >= 1 && near > far * 3, `beeps in 5 s: ${far} from 40 m, ${near} from 3 m`);
  // (quiet in a conversation or a menu: main.js passes busy(), issue #231)
  beeps.length = 0; for (let k = 0; k < 50; k++) F.update(0.1, k * 0.1, { quiet: true });
  assert.equal(beeps.length, 0, 'no beeps while someone talks or a menu is up');
  assert.match(fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), /fragments\.update\(dt, t, \{ quiet: busy\(\) \}\)/);
  game.set('frag.finder.off', true);
  assert.equal(count(3), 0, 'switched off');
  // the items page: it is a thing you switch, in use while on
  const page = itemsData({ owned: ['finder'], toggles: { finder: true } });
  assert.deepEqual([page.gear[0].usable, page.gear[0].inUse], [true, true]);
  assert.equal(itemsData({ owned: ['finder'], toggles: { finder: false } }).gear[0].inUse, false);
});

test('Anselm Thrum: met at the first fragment, a few words, then aboard; his count, what you hold, and his shop', () => {
  // the meeting
  const ctx = fresh(found(1));
  const person = thrumPerson({ flags: () => ctx.game.data.flags, has: ctx.items.has, here: 'desert' });
  const m = talk(person, ctx, ['Come aboard']);
  assert.match(m.said, /on the lookout for these/, 'he has been on the lookout for them');
  assert.doesNotMatch(m.said, /Orrin|at your service/, 'no name and trade announced (v1.61, #229): the panel names him');
  assert.match(m.said, /Bits of its song, I’d say/, 'he hedges: a witness reports before believing (issue #282)');
  assert.doesNotMatch(m.said, /shed splinters/, 'not told as fact before the Lantern');
  assert.match(m.said, /at a price/);
  assert.match(m.said, /the hold, among the crates/);
  assert.doesNotMatch(m.said, /if you’ll have me/, 'an invitation is not answered "if you’ll have me" (issue #226, quest QC rule 5)');
  assert.equal(ctx.game.flag('frag.met'), true);
  assert.ok(m.said.split(/(?<=[.!?)])\s+/).length <= 12, 'terse');
  // asked where he'll be instead: on your ship, if you'll have him
  const ctx2 = fresh(found(1));
  const m2 = talk(thrumPerson({ flags: () => ctx2.game.data.flags, has: ctx2.items.has, here: 'desert' }), ctx2, ['Where will I find you']);
  assert.match(m2.said, /On your ship, if you’ll have me/);
  assert.equal(ctx2.game.flag('frag.met'), true);
  // aboard, with one: his count and what you hold; one answer opens his shop
  const c1 = talk(person, ctx, ['Where do they hide']);
  assert.match(c1.said, /One of 96\. One to spend\./);
  assert.match(c1.said, /Seven still hide here, in the Desert\./);
  assert.match(c1.said, /Up high\. Behind things\./);
  assert.equal(person.fresh(), false, 'no balloon: nothing you can buy yet');
  const opened = [];
  ctx.game.on('shop:open', (e) => opened.push(e.shop));
  talk(person, ctx, ['Show me what you have']);
  assert.deepEqual(opened, ['thrum'], 'his shop opens (main.js: the shop panel)');
  // three: the finder can be had, his balloon says so
  Object.assign(ctx.game.data.flags, found(3));
  assert.equal(affordable(ctx.game.data.flags, ctx.items.has), 'finder');
  assert.equal(person.fresh(), true, 'his balloon: enough for something');
  assert.match(tallyLines(found(96), null, () => false).join(' '), /every one there is/);
  const none = tallyLines({}, null, () => false).join(' ');
  assert.match(none, /None of 96 yet\. None to spend\./, 'the zero count reads as words (issue #282)');
  assert.doesNotMatch(none, /\bNo of\b/);
  // every line he says, toned (the meeting, the count, the shop)
  const all = [...Object.values(THRUM_TALK.nodes).flatMap((n) => [n.say].flat()), ...Object.values(THRUM_TALK.nodes).flatMap((n) => (n.choices ?? []).map((c) => c.text)), ...THRUM.lines, ...Object.values(THRUM_SHOP_LINES).flat()];
  for (const l of all) assert.ok(parseLine(l).explicit, `toned: ${l}`);
  for (const k of ['open', 'short', 'needs', 'owned', 'bye']) assert.ok(THRUM_SHOP_LINES[k]?.length, `his shop's ${k} line`);
});

test('his shop: fragments are a currency; what you hold goes down as you buy, the found total never does', () => {
  const ctx = fresh({ 'frag.met': true, ...found(12) });
  const shop = new FragmentShop({ game: ctx.game, items: ctx.items });
  const flags = ctx.game.data.flags;
  assert.deepEqual(fragmentPurse(flags, ctx.items.has), { found: 12, total: 96, spent: 0, held: 12 });
  const state = () => Object.fromEntries(shop.view().map((w) => [w.id, w.state]));
  assert.deepEqual(state(), { finder: 'ok', lightheart: 'ok', lightedge: 'needs', lightcell: 'needs', lightwing: 'needs', lightstep: 'short', lightguard: 'needs' },
    'the blade, the tank, the wings and the guard not had yet: those wait for their gear');
  // the finder, then the heart: 12 → 9 → 4
  const bought = [];
  ctx.game.on('thrum:bought', (e) => bought.push(e));
  assert.deepEqual(shop.buy('finder'), { ok: true, state: 'ok', price: 3, ware: 'finder' });
  assert.equal(shop.held, 9);
  assert.equal(ctx.items.has('finder'), true);
  assert.equal(shop.buy('finder').state, 'owned', 'not twice');
  assert.equal(shop.buy('lightheart').ok, true);
  assert.equal(shop.held, 4);
  assert.deepEqual(bought.map((e) => [e.ware, e.price]), [['finder', 3], ['lightheart', 5]]);
  // the found total stays: the Worlds page, the Start menu, the Lantern read it
  assert.equal(fragmentCounts(flags).found, 12);
  // the blade had: the edge can be bought, but 4 is short of 7
  ctx.items.grant('sword');
  assert.equal(state().lightedge, 'short');
  assert.equal(shop.buy('lightedge').state, 'short');
  assert.equal(ctx.items.has('lightedge'), false);
  Object.assign(flags, found(15));
  assert.equal(shop.held, 7);
  assert.equal(shop.buy('lightedge').ok, true);
  assert.equal(shop.held, 0);
  // one whose gear you don't have: never sold, and says why in one line
  assert.equal(shop.buy('lightwing').state, 'needs');
  assert.equal(upgradeWare(shop.view().find((w) => w.id === 'lightwing')).flag, 'Needs the wings first');
  assert.equal(upgradeWare(shop.view().find((w) => w.id === 'finder')).flag, 'Fitted');
  // the panel: the fragments you hold as the wallet, the prices in fragments, his upgrades by name
  const html = shopHtml({ keeper: THRUM, line: THRUM_SHOP_LINES.open[0], wallet: shop.held, wares: shop.view().map((w) => upgradeWare(w)), money: shopMoney('fragments') });
  assert.match(html, /frag-ico/, 'a fragment, not a chime');
  assert.doesNotMatch(html, /class="chime-ico"/);
  assert.match(html, /Light-veined wings/);
  assert.match(html, /Needs the wings first/);
  assert.equal((html.match(/data-state="owned"/g) ?? []).length, 3);
  assert.equal(shopMoney('fragments').ask({ name: 'Light chamber', price: 10 }), 'Light chamber: buy it for 10 fragments?');
});

test('his shop in the shop panel: A / × asks, A / × again buys, his lines in his voice, the held count on the wallet', () => {
  const ctx = fresh({ 'frag.met': true, ...found(8) });
  const shop = new FragmentShop({ game: ctx.game, items: ctx.items });
  const html = [];
  const el = { setAttribute() {}, classList: { add() {}, remove() {} }, addEventListener() {}, querySelector: () => null, set innerHTML(v) { html.push(v); }, get innerHTML() { return html.at(-1) ?? ''; } };
  const sounds = [];
  const panel = new ShopPanel({ el, game: ctx.game, resources: { chimes: 999 }, sound: { fragmentTaken: () => sounds.push('light'), purchase: () => sounds.push('coins'), shopBell: () => sounds.push('bell') }, doc: {} });
  const npc = { time: 0 };
  panel.open({ kind: 'fragments', shop: { id: 'thrum', label: THRUM.name }, logic: shop, keeper: THRUM, lines: THRUM_SHOP_LINES, npc });
  assert.ok(THRUM_SHOP_LINES.open.includes(panel.line), 'his greeting');
  assert.match(html.at(-1), /shop-wallet[^>]*>[^]*?frag-ico[^]*?<b>8<\/b>/, 'the wallet: the eight you hold');
  assert.ok(!sounds.includes('bell'), 'no shop bell in the hold');
  panel.pick('lightstep');
  assert.ok(THRUM_SHOP_LINES.short.includes(panel.line), 'too dear: he says so');
  panel.pick('lightcell');
  assert.ok(THRUM_SHOP_LINES.needs.includes(panel.line), 'no tank yet: he says so');
  panel.pick('lightheart');
  assert.equal(panel.ask, 'lightheart');
  assert.match(html.at(-1), /Light-stitched heart: buy it for 5 fragments\?/);
  const r = panel.buy();
  assert.equal(r.ok, true);
  assert.ok(THRUM_SHOP_LINES.lightheart.includes(panel.line), 'his line as he fits it');
  assert.deepEqual(sounds, ['light'], 'the light’s rise, no coins');
  assert.match(html.at(-1), /shop-wallet[^>]*>[^]*?<b>3<\/b>/, 'three left to spend');
  panel.close();
  assert.ok(THRUM_SHOP_LINES.bye.includes(npc.shout.text), 'his goodbye over his head');
  // main.js: his shop opens on game 'shop:open' { shop: 'thrum' }, his entry from the scientist
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /shop === 'thrum' \? storyRt\.scientist\?\.shopEntry\(\)/);
});

test('an old save with his milestone upgrades keeps them; what it holds is what it found less their prices, never below none', () => {
  // (no save step: what you hold is worked out from what you found and what you have, src/fragment-shop.js)
  const at = (n, ids) => fragmentPurse({ ...found(n), ...Object.fromEntries(ids.map((id) => [`item.${id}`, true])) });
  assert.deepEqual(at(5, ['lightheart']), { found: 5, total: 96, spent: 5, held: 0 });
  assert.equal(at(10, ['lightheart', 'finder']).held, 2);
  assert.equal(at(15, ['lightheart', 'finder', 'lightedge']).held, 0);
  assert.equal(at(50, ['lightheart', 'finder', 'lightedge', 'lightcell', 'lightwing']).held, 7);
  assert.equal(at(75, ['lightheart', 'finder', 'lightedge', 'lightcell', 'lightwing', 'lightstep']).held, 9);
  assert.equal(at(96, FRAGMENT_ITEMS.map((u) => u.id)).held, 0);
  // a save given one some other way (the dev menu) never holds less than none
  assert.equal(at(2, ['lightguard']).held, 0);
  // and it loads with them still had, through the save's migrations
  const old = { 'save.migrated': MIGRATED(), ...found(10), 'item.lightheart': true, 'item.finder': true, 'frag.met': true };
  migrateFlags(old);
  assert.equal(old['item.lightheart'], true); assert.equal(old['item.finder'], true);
  assert.equal(fragmentPurse(old).held, 2);
  assert.deepEqual(thrumWares(old).filter((w) => w.state === 'owned').map((w) => w.id), ['finder', 'lightheart']);
});

test('the upgrades change real numbers: hearts 3 → 4, the blade ×1.5, the bar +1, the wings, the boots, the guard 1 → 0.5', () => {
  const g = new GameState(memory());
  const owned = new Set();
  const R = new Resources(g, { has: (id) => owned.has(id) });
  assert.equal(R.maxHearts, HEARTS.start);
  const bar = R.maxMagic;
  owned.add('lightheart'); owned.add('lightcell');
  assert.equal(R.maxHearts, HEARTS.start + 1, 'one more heart');
  assert.equal(R.maxMagic, bar + 1, 'one more unit of magic');
  assert.equal(BLADE.edge, 1);
  assert.equal(MAGIC_COST.shield, 1);
  syncUpgrades((id) => id === 'lightedge' || id === 'lightguard');
  assert.equal(BLADE.edge, 1.5, 'every cut half as hard again');
  assert.equal(MAGIC_COST.shield, 0.5, 'a block half the magic');
  syncUpgrades(() => false);
  assert.deepEqual([BLADE.edge, MAGIC_COST.shield], [1, 1], 'put back without them');
  assert.deepEqual(LIGHT, { glide: 1.2, sink: 0.75, sprint: 0.7, rest: 1.5 });
  // the item cards say the same numbers
  assert.match(ITEMS.lightedge.text, /1\.5, 1\.5 and 4\.5 instead of 1, 1 and 3/);
  assert.match(ITEMS.lightwing.text, /18 m\/s instead of 15/);
  assert.match(ITEMS.lightguard.text, /half a unit/);
});

test('the menu: each world you know with how many are left, and the count all told', () => {
  const levels = ORDER.map((id) => ({ id, title: id }));
  const none = worldsData({ levels, order: ORDER, fragments: fragmentCounts({}) });
  assert.equal(none[0].fragments, null, 'nothing shown before the first');
  const list = worldsData({ levels, order: ORDER, known: (id) => id === 'desert' || id === 'arzach', fragments: fragmentCounts({ ...found(9) }) });
  assert.deepEqual(list.map((w) => w.fragments), [[8, 8], [1, 8]]);
  const { html } = worldsPanel(list);
  assert.match(html, /Fragments of the singing light: 9 of 96/);
  assert.match(html, /✧ all 8/);
  assert.match(html, /✧ 7 left/);
});

test('the save: an old save starts at zero, the scientist still to meet (the fragments’ step)', () => {
  // (a save from before the fragments' step, 22)
  const old = { 'save.migrated': 21, 'frag.met': true, 'frag.desert.0': true, 'world.desert.done': true };
  migrateFlags(old);
  assert.equal(old['frag.met'], undefined);
  assert.equal(fragmentCounts(old).found, 0);
  assert.equal(old['world.desert.done'], true, 'nothing else touched');
  assert.deepEqual(migrateFragments196({ a: 1 }), { a: 1 });
  // a save made since keeps its fragments through a reload
  const store = memory();
  const g = new GameState(store);
  g.set('frag.desert.3', true); g.set('frag.met', true);
  const again = new GameState(store);
  assert.equal(fragmentCounts(again.data.flags).found, 1);
  assert.equal(again.flag('frag.met'), true);
});

/** The slots src/fragments-data.js marks with `mark` (#228, #250), world by world. */
function markedSlots(mark) {
  const src = readFileSync(new URL('../src/fragments-data.js', import.meta.url), 'utf8');
  const marked = {};
  for (const id of ORDER) {
    const block = src.match(new RegExp(`\\n  ${id}: \\[[^\\n]*\\n((?:    .*\\n)+?)  \\],`))?.[1] ?? '';
    const rows = block.split('\n').filter((l) => /^\s+\[[-\d.]+, [-\d.]+, [-\d.]+\],/.test(l));
    assert.equal(rows.length, FRAGMENTS_PER_WORLD, `${id}: its rows read`);
    const moved = rows.flatMap((l, i) => (l.includes(mark) ? [i] : []));
    if (moved.length) marked[id] = moved;
  }
  return marked;
}

test('the save: the fragments re-placed in v1.61 keep a save’s count, its found ones off the moved slots (step 23)', () => {
  // the table is the data's: every slot marked as moved there, and no other (a slot moved again in v1.66 keeps its mark)
  assert.deepEqual(markedSlots('#228'), FRAGMENTS_MOVED_228);
  // Lorn: slots 2 and 4 moved and found, 6 found and kept; they go to 0 and 1, the count stays three
  const old = { 'save.migrated': 22, 'frag.met': true, 'frag.perdide.2': true, 'frag.perdide.4': true, 'frag.perdide.6': true, 'met.odile': true, 'talks.odile': 2 };
  migrateFlags(old);
  assert.equal(fragmentCounts(old).worlds.perdide.found, 3);
  assert.deepEqual(Object.keys(old).filter((k) => k.startsWith('frag.perdide.')).sort(), ['frag.perdide.0', 'frag.perdide.1', 'frag.perdide.6']);
  assert.equal(old['frag.met'], true);
  assert.equal(old['met.tilde'], true); assert.equal(old['talks.tilde'], 2); assert.equal(old['met.odile'], undefined);
  // a world found all but the moved: they stay where they are (nowhere free), the count the same
  const full = Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((i) => [`frag.underwater.${i}`, true]));
  migrateFragments228(full);
  assert.equal(fragmentCounts(full).worlds.underwater.found, 8);
});

test('the save: the fragments re-placed in v1.66 into the places of interest keep a save’s count, its found ones off the moved slots (step 25, #250)', () => {
  // the table is the data's: every slot marked as moved in v1.66, and no other; the Desert's two easy ones by the ship stay
  assert.deepEqual(markedSlots('#250'), FRAGMENTS_MOVED_250);
  assert.ok(!FRAGMENTS_MOVED_250.desert.includes(5) && !FRAGMENTS_MOVED_250.desert.includes(6), 'the Desert’s slots 5 and 6 (#247) kept');
  // a save from before (step 24 done): the Glass Dunes' 2 and 4 found (both moved) and 0; they go to 1 and 3, the count stays three
  const old = { 'save.migrated': 24, 'frag.met': true, 'frag.glassdunes.0': true, 'frag.glassdunes.2': true, 'frag.glassdunes.4': true };
  migrateFlags(old);
  assert.equal(old['save.migrated'], MIGRATED());
  assert.equal(fragmentCounts(old).worlds.glassdunes.found, 3);
  assert.deepEqual(Object.keys(old).filter((k) => k.startsWith('frag.glassdunes.')).sort(), ['frag.glassdunes.0', 'frag.glassdunes.1', 'frag.glassdunes.3']);
  // the Desert: a moved slot found never lands on slot 5, Marrow's errand's goal (it would end it unasked)
  const desert = { 'frag.desert.0': true, 'frag.desert.1': true, 'frag.desert.2': true, 'frag.desert.3': true, 'frag.desert.4': true };
  migrateFragments250(desert);
  assert.equal(fragmentCounts(desert).worlds.desert.found, 5);
  assert.equal(desert['frag.desert.5'], undefined);
  assert.equal(desert['frag.desert.6'], true);
  // nothing free: the flags stay on their slots, the count the same
  const full = Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((i) => [`frag.spheres.${i}`, true]));
  migrateFragments250(full);
  assert.equal(fragmentCounts(full).worlds.spheres.found, 8);
});

test('the Lantern: Ilen knows the fragments for her song, one line by how many you found (none, some, every one)', async () => {
  const { PEOPLE } = await import('../src/story/lantern-data.js');
  const lines = (n) => {
    const ctx = fresh(found(n));
    return talk(PEOPLE.ilen, ctx, ['Ilen?', 'Your brother', 'They died', 'No. Mum kept']).said;
  };
  const none = lines(0), some = lines(12), all = lines(FRAGMENT_TOTAL);
  assert.match(none, /Nobody stops for them\./); assert.doesNotMatch(none, /in your hold|whole again/);
  assert.match(some, /I can hear them from here, in your hold\./); assert.doesNotMatch(some, /Nobody stops|whole again/);
  assert.match(all, /Then it’s whole again\./); assert.doesNotMatch(all, /Nobody stops|in your hold/);
  assert.match(all, /It was mine\. My answer\./, 'right after she owns up to the light');
  // and her answer is the node's last page, so "Your answer?" follows what she has just said (issue #226, quest QC rule 5)
  for (const said of [none, some, all]) assert.ok(said.indexOf('My answer. I’m sorry.') > Math.max(said.indexOf('Nobody stops'), said.indexOf('in your hold'), said.indexOf('whole again')));
});

test('the people book: Anselm Thrum, his story growing with each upgrade, at its price', () => {
  const p = PERSON.get('thrum');
  assert.ok(p, 'in the book');
  assert.equal(p.name, 'Anselm Thrum');
  const src = fs.readFileSync(new URL('../src/story/people-book.js', import.meta.url), 'utf8');
  for (const [id, words] of [['lightheart', 'five'], ['finder', 'three'], ['lightedge', 'seven'], ['lightcell', 'ten'], ['lightwing', 'eighteen'], ['lightstep', 'twenty-three'], ['lightguard', 'thirty']])
    assert.ok(src.includes(`[f('item.${id}'), 'For ${words} `), `${id}: for ${words}`);
});

test('aboard the real ship: he stands on the deck of the hold, inside its rooms, and you walk to him from the hatch', async () => {
  const { LEVELS } = await import('../src/levels/index.js');
  const { Physics } = await import('../src/physics.js');
  const { CONTENT } = await import('../src/levels/content.js');
  const { Ship } = await import('../src/ship/ship.js');
  const { flood, RISE } = await import('./fragments-reach.js');
  const quiet = (f) => { const w = console.warn, i = console.info, l = console.log; console.warn = console.info = console.log = () => {}; try { return f(); } finally { console.warn = w; console.info = i; console.log = l; } };
  const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
  const page = { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
  // (one world: the ship's rooms are the same in every one)
  const id = 'edena', scene = new THREE.Scene();
  const level = quiet(() => LEVELS.find((l) => l.id === id).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  delete globalThis.document;
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: id, content: CONTENT[id] }));
  globalThis.document = page;
  const ctx = fresh({ 'frag.met': true, ...found(3) });
  const npcs = [];
  const S = quiet(() => setupScientist({ levelId: id, scene, physics, level, ship, npcs, game: ctx.game, items: ctx.items, talkable: () => () => {} }));
  assert.ok(S.aboard, 'aboard once met');
  const p = S.aboard.pos;
  assert.ok(ship.isInside(ship.parked, p), 'inside the rooms');
  const deck = physics.groundAt(p.x, p.y + 1.2, p.z, 3);
  assert.ok(Math.abs(deck - p.y) < 0.2, `on the deck (${(deck - p.y).toFixed(2)})`);
  assert.ok(physics.rayDistance(V(p.x, p.y + 0.3, p.z), V(0, 1, 0), 2.2) > 1.9, 'room over his head');
  const from = ship.world(ship.parked, ship.parked.interior.points.aboard);
  from.y = physics.groundAt(from.x, from.y + 1.2, from.z, 3);
  const { reached } = flood({ physics, level }, from, { cell: 0.5, rise: RISE.jump * 0.4, drop: 1, radius: 20, targets: [p], near: 1.4 });
  assert.ok(reached[0], 'walked to from the hatch, on the deck');
  assert.equal(S.jar.group.children.filter((c) => c.visible).length - 6, 3, 'three splinters in his jar');
});

test('the first fragment brings him beside you; once met he is aboard, in the hold, with his jar', () => {
  const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
  globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
  const ctx = fresh();
  const scene = new THREE.Scene();
  // flat ground, a fake ship whose hold is at its origin
  const floor = new THREE.Mesh(new THREE.BoxGeometry(400, 1, 400), new THREE.MeshBasicMaterial());
  floor.position.y = -0.5; scene.add(floor); scene.updateMatrixWorld(true);
  const physics = { groundAt: (x, y) => (y >= 0 ? 0 : -Infinity), rayDistance: () => Infinity };
  const npcs = [], talked = [];
  const group = new THREE.Group(); group.position.set(50, 0, 0); scene.add(group);
  const ship = {
    parked: { group }, playing: false,
    world: (m, v) => { m.group.updateMatrixWorld(); return v.clone().applyMatrix4(m.group.matrixWorld); },
    worldHeading: (m, h) => h,
    isInside: (m, p) => p.distanceTo(group.position) < 12,
  };
  const player = { pos: V(0, 0, 0), heading: 0 };
  const dialogue = { open: false, start: (def, npc) => { talked.push([def.id, npc]); dialogue.open = true; return true; } };
  const S = setupScientist({ levelId: 'desert', scene, physics, level: {}, ship, npcs, game: ctx.game, items: ctx.items, talkable: () => () => {}, dialogue, player });
  assert.equal(S.aboard, null, 'not met: not aboard');
  // the first fragment
  ctx.game.set(fragKey('desert', 0), true);
  ctx.game.emit('fragment', { world: 'desert', i: 0, found: 1, total: 96, left: 7 });
  S.update(0.1);
  assert.equal(talked.length, 1, 'the talk opens at once');
  assert.equal(talked[0][0], 'thrum');
  const d = S.field.pos.distanceTo(player.pos);
  assert.ok(d > 2.5 && d < 7, `beside you (${d.toFixed(1)} m)`);
  // the talk had: aboard
  ctx.game.set('frag.met', true); dialogue.open = false;
  S.update(0.1);
  assert.ok(S.aboard, 'aboard');
  const local = S.aboard.pos.clone().sub(group.position);
  assert.ok(local.distanceTo(V(...ABOARD.at)) < 0.5, 'in the hold, by the crates');
  assert.ok(S.jar && S.jar.group.parent === group, 'his jar on the crate');
  assert.equal(S.jar.group.children.filter((c) => c.visible).length - 6, 1, 'a splinter for the one found');
  // you walk off: the one who met you is gone
  player.pos.set(-80, 0, 0);
  S.update(0.1);
  assert.equal(S.field, null);
  assert.ok(!npcs.includes(talked[0][1]), 'out of the world');
  assert.ok(JAR_MAX >= 12);
  assert.ok(meetSpot({ physics, level: {}, at: V(), heading: 0 }), 'a spot on open ground');
});
