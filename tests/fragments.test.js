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
const { FRAGMENTS, FRAGMENT_TOTAL, FRAGMENTS_PER_WORLD, fragmentCounts, fragKey, CHART_FLAG } = await import('../src/fragments-data.js');
const { createFragments, FRAGMENT, finderInterval, finderPitch } = await import('../src/fragments.js');
const { THRUM, THRUM_TALK, THRUM_SHOP_LINES, thrumPerson, tallyLines, hereLine, thrumTalk } = await import('../src/story/scientist-data.js');
const PRICES_MOD = await import('../src/fragment-shop.js');
const { PRICES, FragmentShop, fragmentPurse, thrumWares, affordable } = PRICES_MOD;
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
const { worldsPanel, worldFacts } = await import('../src/game-menu.js');
const { fragmentsLine } = await import('../src/host/game-host.js');
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

test('the data: twenty-four in each world on the route, 288 all told (issue #317); his seven upgrades priced 3 to 30 as before, 96 all told', () => {
  assert.deepEqual(Object.keys(FRAGMENTS).sort(), [...ORDER].sort(), 'every route world, and only those');
  for (const id of ORDER) {
    assert.equal(FRAGMENTS[id].length, FRAGMENTS_PER_WORLD, id);
    for (const p of FRAGMENTS[id]) assert.ok(p.length === 3 && p.every(Number.isFinite), `${id}: [x, y, z]`);
  }
  assert.equal(FRAGMENT_TOTAL, ORDER.length * FRAGMENTS_PER_WORLD);
  assert.equal(FRAGMENTS_PER_WORLD, 24, 'eight a world until v1.70: many more, to be easier to find (issue #317)');
  assert.equal(FRAGMENT_TOTAL, 288);
  // spread, not heaped (issue #317: one every minute or so of exploring): no fragment with more than four others within
  // 40 m of it (six in the Floating city, a few islands and tiers 230 × 340 m)
  for (const id of ORDER) {
    const l = FRAGMENTS[id], d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const most = Math.max(...l.map((p) => l.filter((q) => q !== p && d(p, q) < 40).length));
    assert.ok(most <= (id === 'spacecity' ? 6 : 4), `${id}: ${most} others within 40 m of one`);
  }
  // (v1.62, issue #185: a shop; the cheapest first, as the milestones came: 5, 10, 15, 25, 50, 75, 96. Issue #317: the
  // prices kept as they were, so the seven come sooner, all of them for a third of the fragments there are)
  assert.deepEqual(FRAGMENT_ITEMS.map((u) => [u.id, u.price]), [['finder', 3], ['lightheart', 5], ['lightedge', 7], ['lightcell', 10], ['lightwing', 18], ['lightstep', 23], ['lightguard', 30]]);
  assert.equal(Object.values(PRICES).reduce((a, b) => a + b, 0), 96, 'the seven for 96 fragments, as before (issue #317: the prices the same)');
  assert.ok(Object.values(PRICES).reduce((a, b) => a + b, 0) <= FRAGMENT_TOTAL / 3, 'every upgrade for a third of the fragments there are');
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
  const c = fragmentCounts({ ...found(26), [fragKey('bazaar', 7)]: true, [fragKey('bazaar', 23)]: true });
  assert.equal(c.found, 28);
  assert.equal(c.total, 288);
  assert.deepEqual([c.worlds.desert.found, c.worlds.desert.left], [24, 0]);
  assert.deepEqual([c.worlds.arzach.found, c.worlds.arzach.left], [2, 22]);
  assert.deepEqual([c.worlds.bazaar.found, c.worlds.bazaar.left], [2, 22]);
  assert.equal(c.worlds.perdide.left, 24);
});

test('a fragment walked into is yours: saved, counted, gone, its light out; it sings near, and only near', () => {
  const { game, items: its } = fresh();
  const player = { pos: V(), hidden: false };
  const sang = [], toasts = [], events = [];
  // (the nearest fragment owns the local approach phrase)
  const sound = { fragmentSong: (p, k) => { if (p === F.list[2].pos) sang.push(k); }, fragmentTaken: () => {}, finderBeep: () => {} };
  const lights = [];
  game.on('fragment', (e) => events.push(e));
  const F = createFragments({ levelId: 'edena', scene: new THREE.Scene(), player, sound, game, items: its, toast: (t) => toasts.push(t), lights });
  assert.equal(F.list.length, 24);
  assert.equal(lights.length, 24, 'each glows on the ground round it');
  const f = F.list[2];
  // across the world: not drawn (24 a world since v1.70, issue #317: no draws for the far ones)
  player.pos.copy(f.pos).add(V(FRAGMENT.drawTo + 20, 0, 0));
  F.update(0.1, 0);
  assert.equal(f.grp.visible, false, 'not drawn from across the world');
  // far off: quiet, but drawn
  player.pos.copy(f.pos).add(V(80, 0, 0));
  F.update(0.1, 0);
  assert.equal(sang.length, 0, 'not heard from 80 m');
  assert.equal(f.grp.visible, true, 'seen from 80 m');
  // near: its three notes, once a while
  player.pos.copy(f.pos).add(V(12, -FRAGMENT.lift, 0));
  for (let k = 0; k < 40; k++) F.update(0.1, k * 0.1);
  assert.ok(sang.length >= 1 && sang.length <= 2, `sings every ${FRAGMENT.singEvery} s (${sang.length} in 4 s)`);
  // walked into
  player.pos.copy(f.pos).add(V(0.5, -FRAGMENT.lift, 0));
  F.update(0.1, 5);
  assert.equal(game.flag(fragKey('edena', 2)), true, 'saved');
  assert.equal(f.grp.visible, false);
  assert.equal(lights.length, 23);
  assert.deepEqual(events, [{ world: 'edena', i: 2, found: 1, total: 288, left: 23 }]);
  assert.equal(toasts[0], 'A fragment of the singing light · 1 found', 'how many found, never of how many, nor how many left (issue #519)');
  // a world built again with it found: not there
  const again = createFragments({ levelId: 'edena', scene: new THREE.Scene(), player, game, items: its, lights: [] });
  assert.equal(again.list[2].grp.visible, false);
  assert.equal(again.list.filter((x) => !x.found).length, 23);
});

test('the finder: beeps from 60 m, faster and higher as a fragment comes closer; switched off from the items page', () => {
  assert.equal(finderInterval(61), null, 'out of range: quiet');
  assert.ok(finderInterval(60) > finderInterval(30) && finderInterval(30) > finderInterval(2), 'faster closer');
  assert.ok(Math.abs(finderInterval(0) - FRAGMENT.finder.fast) < 1e-9 && Math.abs(finderInterval(60) - FRAGMENT.finder.slow) < 1e-9);
  assert.ok(finderPitch(5) > finderPitch(50), 'higher closer');
  const { game, items: its } = fresh();
  const player = { pos: V() };
  const beeps = [];
  const F = createFragments({ levelId: 'desert', scene: new THREE.Scene(), player, sound: { finderBeep: (f) => beeps.push(f) }, game, items: its });   // (the Desert: one alone there, issue #550 gathered Viridel's on its places)
  // (the one farthest from the others: the finder beeps for the nearest, 24 a world since v1.70)
  const alone = (g) => Math.min(...F.list.filter((h) => h !== g).map((h) => h.pos.distanceTo(g.pos)));
  const f = F.list.reduce((a, b) => (alone(b) > alone(a) ? b : a));
  assert.ok(alone(f) > 100);
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
  assert.match(m.said, /Bits of it that broke off, I think/, 'he hedges: a witness reports before believing (issue #282)');
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
  assert.match(c1.said, /One so far\. One to spend\./);
  assert.match(c1.said, /The Desert still sings loud\./, 'a loose word for the world, never a number (issue #519)');
  assert.doesNotMatch(c1.said, /288|twenty-three|still hide|Most left/i);
  assert.match(c1.said, /On the landmarks, off the main paths/, 'where they are now: on the landmarks (issue #550)');
  assert.equal(person.fresh(), false, 'no balloon: nothing you can buy yet');
  const opened = [];
  ctx.game.on('shop:open', (e) => opened.push(e.shop));
  talk(person, ctx, ['Show me what you have']);
  assert.deepEqual(opened, ['thrum'], 'his shop opens (main.js: the shop panel)');
  // three: the finder can be had, his balloon says so
  Object.assign(ctx.game.data.flags, found(3));
  assert.equal(affordable(ctx.game.data.flags, ctx.items.has), 'finder');
  assert.equal(person.fresh(), true, 'his balloon: enough for something');
  // (issue #519: "I shouldn't be able to tell how many fragments of light there are in total": his count says how many
  // found and how many to spend, and a loose word for the world you are in; never the total, never a world's number)
  const none = tallyLines({}, null, () => false).join(' ');
  assert.match(none, /None yet\. None to spend\./, 'the zero count reads as words (issue #282)');
  for (const n of [1, 30, 96, 150, FRAGMENT_TOTAL]) {
    const said = tallyLines(found(n), 'desert', () => false).join(' ');
    assert.doesNotMatch(said, new RegExp(`of ${FRAGMENT_TOTAL}|every one there is|\\d+ left|still hide`), `${n}: no total`);
  }
  const thirty = tallyLines({ ...found(30) }, 'arzach', () => false).join(' ');
  assert.match(thirty, /Thirty so far\. Thirty to spend\./);
  assert.match(thirty, /Vael still sings loud\./, 'more than half still to find: loud');
  assert.match(tallyLines({ ...found(40) }, 'arzach', () => false).join(' '), /Some singing left in Vael\./, 'half or less, a fifth or more: some (#563)');
  assert.match(hereLine({ total: 24, left: 4 }, 'arzach'), /A little singing left in Vael\./, 'under a fifth: a little');
  assert.match(hereLine({ total: 24, left: 5 }, 'arzach'), /Some singing left/);
  assert.match(tallyLines({ ...found(24) }, 'desert', () => false).join(' '), /gone quiet here/, 'all found: quiet');
  assert.doesNotMatch(fs.readFileSync(new URL('../src/story/scientist-data.js', import.meta.url), 'utf8'), /\b(96|288)\b/);
  // every line he says, toned (the meeting, the count, the shop)
  const all = [...Object.values(THRUM_TALK.nodes).flatMap((n) => [n.say].flat()), ...Object.values(THRUM_TALK.nodes).flatMap((n) => (n.choices ?? []).map((c) => c.text)), ...THRUM.lines, ...Object.values(THRUM_SHOP_LINES).flat()];
  for (const l of all) assert.ok(parseLine(l).explicit, `toned: ${l}`);
  for (const k of ['open', 'short', 'needs', 'owned', 'bye']) assert.ok(THRUM_SHOP_LINES[k]?.length, `his shop's ${k} line`);
});

test('his shop: fragments are a currency; what you hold goes down as you buy, the found total never does', () => {
  const ctx = fresh({ 'frag.met': true, ...found(12) });
  const shop = new FragmentShop({ game: ctx.game, items: ctx.items });
  const flags = ctx.game.data.flags;
  assert.deepEqual(fragmentPurse(flags, ctx.items.has), { found: 12, total: 288, spent: 0, held: 12 });
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
  assert.deepEqual(at(5, ['lightheart']), { found: 5, total: 288, spent: 5, held: 0 });
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

test('the menu: each world you know with how many found there, and the count all told; never how many there are (issue #519)', () => {
  const levels = ORDER.map((id) => ({ id, title: id }));
  const none = worldsData({ levels, order: ORDER, fragments: fragmentCounts({}) });
  assert.equal(none[0].fragments, null, 'nothing shown before the first');
  const list = worldsData({ levels, order: ORDER, known: (id) => id === 'desert' || id === 'arzach', fragments: fragmentCounts({ ...found(25) }) });
  assert.deepEqual(list.map((w) => w.fragments), [{ found: 24, quiet: false }, { found: 1, quiet: false }], 'a world all found is not said to be, without the chart');
  const { html } = worldsPanel(list);
  assert.match(html, /Fragments of the singing light: 25 found/);
  assert.match(html, /✧ 24 found here/);
  assert.match(html, /✧ 1 found here/);
  assert.doesNotMatch(html, /288|\b24 left|all 24|23 left|of 24/, 'no total, no "left"');
  const facts = worldFacts(list[0]);
  assert.ok(!facts.find((f) => /Fragments/.test(f.text)).on, 'not ticked done without the chart');
  // with Anselm's chart (issue #520): a world all found has gone quiet
  const charted = worldsData({ levels, order: ORDER, known: (id) => id === 'desert' || id === 'arzach', fragments: fragmentCounts({ ...found(25), [CHART_FLAG]: true }) });
  assert.deepEqual(charted.map((w) => w.fragments), [{ found: 24, quiet: true }, { found: 1, quiet: false }]);
  assert.match(worldsPanel(charted).html, /the song is quiet here/);
  // the Start menu's line: found and to spend (src/host/game-host.js, the engines' too)
  const { game, items: its } = fresh({ ...found(12), 'frag.met': true, 'item.finder': true });
  const line = fragmentsLine({ fragments: { counts: () => fragmentCounts(game.data.flags) }, game, items: its });
  assert.equal(line, '✧ 12 fragments found · 9 to spend');
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

test('the save: a save from before v1.70 keeps its fragments where they were; the sixteen new a world start unfound (issue #317)', () => {
  // (nothing to migrate: the first eight of each world kept their slots and their places, the new ones are slots 8–23)
  const old = { 'save.migrated': MIGRATED(), 'frag.met': true, 'item.finder': true, 'item.lightheart': true };
  for (const id of ORDER) for (let i = 0; i < 8; i++) old[fragKey(id, i)] = true;   // (every one there was: 96)
  const before = Object.keys(old).filter((k) => k.startsWith('frag.')).sort();
  migrateFlags(old);
  assert.deepEqual(Object.keys(old).filter((k) => k.startsWith('frag.')).sort(), before, 'its found flags as they were');
  const c = fragmentCounts(old);
  assert.deepEqual([c.found, c.total], [96, 288]);
  for (const id of ORDER) assert.deepEqual([c.worlds[id].found, c.worlds[id].left], [8, 16], id);
  assert.deepEqual(fragmentPurse(old), { found: 96, total: 288, spent: 8, held: 88 }, 'what it bought stays bought, the rest to spend');
  // a world built with that save: the old eight gone, the new sixteen there to find
  const g = new GameState(memory());
  Object.assign(g.data.flags, old);
  const F = createFragments({ levelId: 'spheres', scene: new THREE.Scene(), player: { pos: V() }, game: g, items: { has: () => false }, lights: [] });
  assert.deepEqual(F.list.map((f) => f.found), [...Array(24).keys()].map((i) => i < 8));
  // the old places kept: the v1.66 table still the first eight's (the steps 23 and 25 move flags among those only)
  for (const [id, slots] of Object.entries({ ...FRAGMENTS_MOVED_228, ...FRAGMENTS_MOVED_250 })) assert.ok(slots.every((i) => i < 8), id);
});

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

test('the Lantern: Ilen knows the fragments for her song, one line by how many you found (none, a few, many, most, every one: issue #481)', async () => {
  const { PEOPLE } = await import('../src/story/lantern-data.js');
  const lines = (n) => {
    const ctx = fresh(found(n));
    return talk(PEOPLE.ilen, ctx, ['Ilen?', 'Your brother', 'They died', 'No. Mum kept']).said;
  };
  const third = FRAGMENT_TOTAL / 3;
  const said = { none: lines(0), few: lines(12), many: lines(Math.round(third * 1.5)), most: lines(Math.round(third * 2.5)), all: lines(FRAGMENT_TOTAL) };
  const MARK = { none: /Nobody stops for them\./, few: /A few\. I can hear them from here/, many: /a whole handful of my song/, most: /You kept nearly all of it\./, all: /Then it’s whole again\./ };
  for (const [k, s] of Object.entries(said)) {
    for (const [j, re] of Object.entries(MARK)) (j === k ? assert.match : assert.doesNotMatch)(s, re, `${k}: ${j}'s line ${j === k ? '' : 'not '}said`);
    // her answer is the node's last page, so "Your answer?" follows what she has just said (issue #226, quest QC rule 5)
    assert.ok(s.indexOf('My answer. I’m sorry.') > s.search(MARK[k]), `${k}: her answer after it`);
  }
  // the thresholds at their edges: a third is many, two thirds is many, a hair over is most
  assert.match(lines(Math.ceil(third)), MARK.many);
  assert.match(lines(Math.floor(third) - 1), MARK.few);
  assert.match(lines(Math.floor(third * 2) + 1), MARK.most);
});

test('the true ending counts them: the credits say how many were carried home, never of how many; his lamp goes in the round window (issue #481)', async () => {
  const { credits, creditLines, creditsHtml, tombLines, splinterLine } = await import('../src/story/ending.js');
  const { creditsPart } = await import('../src/ship/homecoming.js');
  assert.equal(splinterLine(0), '');
  assert.equal(splinterLine(1), 'You carried home one splinter of her song.');
  assert.equal(splinterLine(130), 'You carried home 130 splinters of her song.');
  const c = credits({ order: ['desert'], splinters: 130 });
  assert.ok(creditLines(c).includes('You carried home 130 splinters of her song.'));
  assert.match(creditsHtml(c), /You carried home 130 splinters of her song\./);
  assert.equal(creditsPart(c).splinters, 'You carried home 130 splinters of her song.', 'the engines\' page too (BridgeHud.Credits.cs)');
  for (const s of [creditLines(c).join(' '), creditsHtml(c)]) assert.doesNotMatch(s, /288|of \d+ splinters/);
  assert.equal(creditsPart(credits({ order: ['desert'] })).splinters, '', 'none found: no line');
  const lit = tombLines([], { final: true, lamp: true, lou: true });
  const lamp = lit.find((l) => l.lamp);
  assert.equal(lamp?.tone, 'solemn', 'his lamp, set in the round window, toned');
  assert.ok(!tombLines([], { final: true }).some((l) => l.lamp), 'not without it');
  // (issue #559: not between Ilen's lines, no tally: after the stone's last words, just before the closing line)
  assert.equal(lit.indexOf(lamp), lit.length - 2, 'after the stone\'s last words, before the closing');
  assert.ok(lit.findIndex((l) => l.reel) < lit.indexOf(lamp));
  assert.doesNotMatch(lamp.text, /splinter|every|\d/i, 'no count in the quiet beat');
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
  // (his jar drawn with the rooms: hidden with them when the camera is too far off to see in, issue #264's Retroid cost)
  assert.ok(ship.parked.indoor.includes(S.jar.group), 'the jar among the rooms\' indoor pieces');
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
  ctx.game.emit('fragment', { world: 'desert', i: 0, found: 1, total: 288, left: 23 });
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

// Issue #550 ("The first time I pick up a fragment of light there should be a cinematic for Anselm to show up, not just
// immediately appearance"): his arrival filmed on the world's moment stage (src/story/scientist-arrival.js).
async function arrivalRig({ ground = (x, z) => 0, flags = {} } = {}) {
  const { MomentStage } = await import('../src/story/moment.js');
  const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
  globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
  const ctx = fresh(flags);
  const scene = new THREE.Scene();
  const physics = { groundAt: (x, y, z) => { const g = ground(x, z); return y >= g ? g : -Infinity; }, rayDistance: () => Infinity, pushCapsule: () => false, groundNormal: (x, y, z, o = V()) => o.set(0, 1, 0) };
  const npcs = [], talked = [], shots = [];
  const group = new THREE.Group(); group.position.set(60, 0, 0); scene.add(group);
  const cinema = { bars() {}, hud() {}, say() {}, skip() {}, skipEl: null };
  const ship = {
    parked: { group }, playing: false, cinema, shot: (c) => shots.push(c), release() {}, busy: () => false,
    world: (m, v) => { m.group.updateMatrixWorld(); return v.clone().applyMatrix4(m.group.matrixWorld); },
    worldHeading: (m, h) => h,
    isInside: (m, p) => p.distanceTo(group.position) < 12,
  };
  const player = { pos: V(0, 0, 0), vel: V(), heading: 0, onGround: true };
  const dialogue = { open: false, start: (def, npc) => { talked.push([def.id, npc]); dialogue.open = true; return true; } };
  const moments = new MomentStage({ ship, game: ctx.game, player, physics });
  const S = setupScientist({ levelId: 'desert', scene, physics, level: {}, ship, npcs, game: ctx.game, items: ctx.items, talkable: () => () => {}, dialogue, player, moments });
  const camera = new THREE.PerspectiveCamera();
  /** A frame of the game: the moments, him, the people (src/story/index.js, main.js). */
  const step = (dt = 1 / 30) => { moments.update(dt); S.update(dt); for (const n of npcs) n.update(dt, player, camera); if (shots.length) camera.position.copy(shots.at(-1).pos); };
  const first = (i = 0) => { ctx.game.set(fragKey('desert', i), true); ctx.game.emit('fragment', { world: 'desert', i, found: 1, total: 288, left: 23 }); };
  return { ctx, S, moments, dialogue, talked, shots, player, npcs, step, first, group };
}

test('the first fragment: Anselm’s arrival is filmed, he runs in from out of the way, winded, then the talk opens (issue #550)', async () => {
  const { ARRIVAL, arrivalFrom, runTime } = await import('../src/story/scientist-arrival.js');
  const R = await arrivalRig();
  R.first();
  R.step();
  assert.ok(R.moments.playing, 'the cinematic plays');
  assert.equal(R.moments.current.id, ARRIVAL.id);
  assert.equal(R.talked.length, 0, 'the talk waits for it');
  const npc = R.S.field, start = npc.pos.clone();
  const d0 = start.distanceTo(R.player.pos);
  assert.ok(d0 > 15, `he starts well off, not in front of the lens (${d0.toFixed(1)} m)`);
  // (the ship is east of him: he comes from its side)
  assert.ok(start.x > 8, `from the ship’s side (${start.toArray().map((v) => v.toFixed(1))})`);
  const dur = R.moments.current.dur;
  assert.ok(dur > 4 && dur < 10, `a few seconds (${dur.toFixed(1)} s)`);
  let closest = Infinity, fast = 0, prev = npc.pos.clone();
  for (let t = 0; t < dur + 1 && R.moments.playing; t += 1 / 30) {
    R.step();
    fast = Math.max(fast, prev.distanceTo(npc.pos) * 30); prev.copy(npc.pos);
    closest = Math.min(closest, npc.pos.distanceTo(R.player.pos));
  }
  assert.ok(!R.moments.playing, 'over');
  assert.ok(fast > 4, `he runs (${fast.toFixed(1)} m/s at his fastest)`);
  assert.ok(closest > 2.5, `never brushing past you on his way (${closest.toFixed(1)} m at the nearest)`);
  assert.equal(R.talked.length, 1, 'then the talk opens');
  assert.equal(R.talked[0][1], npc, 'with him');
  const d = npc.pos.distanceTo(R.player.pos);
  assert.ok(d > 2.5 && d < 7, `beside you (${d.toFixed(1)} m)`);
  assert.ok(npc.winded > 0.5, 'out of breath');
  assert.ok(R.shots.length > 60, 'filmed');
  // his breath back over the talk
  for (let k = 0; k < 150; k++) R.step();
  assert.equal(npc.winded, 0, 'his breath back');
  // once: the talk had, the next fragment brings no cinematic
  R.ctx.game.set('frag.met', true); R.dialogue.open = false;
  R.step();
  R.first(1);
  R.step();
  assert.ok(!R.moments.playing, 'no cinematic for the second fragment');
  assert.equal(R.talked.length, 1, 'nor a meeting');
  assert.ok(runTime(24) > 3 && runTime(24) < 7);
  // (where he comes from: none where there is no way in, the ground falling away all round his spot)
  const ledge = { groundAt: (x, y, z) => (Math.hypot(x, z) < 6 ? 0 : -Infinity), rayDistance: () => Infinity };
  assert.equal(arrivalFrom({ physics: ledge, level: {}, meet: V(3, 0, 0), eye: V(0, 1.6, 0) }), null);
  // (never through you: on a long narrow ledge, from behind his spot, not from behind your back)
  const ridge = { groundAt: (x, y, z) => (Math.abs(z) < 1.5 ? 0 : -Infinity), rayDistance: () => Infinity };
  const way = arrivalFrom({ physics: ridge, level: {}, meet: V(3, 0, 0), eye: V(0, 1.6, 0) });
  assert.ok(way && way.at.x > 3, `from beyond his spot (${way?.at.x.toFixed(1)})`);
});

test('Anselm’s arrival can be skipped: he is on his spot, out of breath, and the talk opens just the same (issue #550)', async () => {
  const R = await arrivalRig();
  R.first();
  R.step();
  assert.ok(R.moments.playing);
  for (let k = 0; k < 24; k++) R.step();   // (past the grace: src/story/moment.js)
  assert.ok(R.moments.skip(), 'B / Menu / Esc / the tag skips it');
  R.step();
  assert.ok(!R.moments.playing, 'skipped');
  assert.equal(R.talked.length, 1, 'the talk opens');
  const d = R.S.field.pos.distanceTo(R.player.pos);
  assert.ok(d > 2.5 && d < 7, `beside you (${d.toFixed(1)} m)`);
  assert.equal(R.S.field.follow, null, 'not running any more');
  // with no way in for him (a ledge), no cinematic: beside you at once, as before
  const L = await arrivalRig({ ground: (x, z) => (Math.hypot(x, z) < 5 ? 0 : -50) });
  L.first();
  L.step();
  assert.ok(!L.moments.playing, 'nothing to film');
  assert.equal(L.talked.length, 1, 'the talk opens at once');
  // and in the air (a jump onto it), he waits for you to land
  const J = await arrivalRig();
  J.player.onGround = false;
  J.first();
  J.step();
  assert.ok(!J.moments.playing && !J.S.field, 'not while you are in the air');
  J.player.onGround = true;
  J.step();
  assert.ok(J.moments.playing, 'landed: he comes');
});

test('Marrow on the first fragment hedges, in the desert’s word: the light “passed” (issue #282)', async () => {
  const { PEOPLE } = await import('../src/story/desert-data.js');
  const said = PEOPLE.marrow.talk.nodes.splinter.say.map((p) => String(p.text ?? p)).join(' ');
  assert.match(said, /^~playful~ /, 'his tone kept');
  assert.match(said, /Something the light dropped when it passed, I’d say/, 'a witness reports before believing (lore/voice-guide.md)');
  assert.doesNotMatch(said, /went over|A splinter of the light/, 'not told as fact, nor in another people’s words');
  assert.match(said, /\*stone cairn beside your ship\*/, 'still says where: the cairn it sits by (issue #550)');
});

test('what the rest buy (issue #481): his notebook a page at a time, his lamp, his chart, the tune; offered by the count found, spent never off it', () => {
  const { THRUM_WARES, ALL_PRICES, pagesOwned } = PRICES_MOD;
  assert.equal(ALL_PRICES, 206, 'the seven upgrades (96) and the rest (110): 206 to spend');
  assert.ok(ALL_PRICES < FRAGMENT_TOTAL, 'some carried home for the ending, unspent');
  const wares = (flags, has = () => false) => Object.fromEntries(thrumWares(flags, has).filter((w) => w.ware).map((w) => [w.id, w]));
  assert.deepEqual(Object.keys(wares(found(19))), [], 'none before 20 found');
  assert.deepEqual(Object.keys(wares(found(20))), ['page']);
  assert.deepEqual(Object.keys(wares(found(60))), ['page', 'lamp']);
  assert.deepEqual(Object.keys(wares(found(100))), ['page', 'lamp', 'chart']);
  assert.deepEqual(Object.keys(wares(found(150))), ['page', 'lamp', 'chart', 'tune']);
  // buying: a page at a time, a page for every 20 found; the price off what you hold, the count found untouched
  const { game, items: its } = fresh({ ...found(45), 'frag.met': true });
  const shop = new FragmentShop({ game, items: its });
  assert.equal(shop.buy('page').ok, true);
  assert.equal(shop.buy('page').ok, true);
  assert.equal(pagesOwned(game.data.flags), 2);
  const third = shop.buy('page');
  assert.deepEqual([third.ok, third.state], [false, 'wait'], 'the third page waits for 60 found');
  assert.equal(fragmentPurse(game.data.flags, its.has).held, 35);
  assert.equal(fragmentCounts(game.data.flags).found, 45, 'found never goes down');
  // the panel names them, the next page by its number
  const w = upgradeWare(shop.view().find((x) => x.id === 'page'));
  assert.match(w.name, /page 3/);
  assert.equal(w.flag, 'Not written yet');
  // the chart (issue #520): offered once 100 are found, 40; he says so the first time; bought, the Map marks the rest
  Object.assign(game.data.flags, found(100));
  const said = tallyLines(game.data.flags, 'desert', its.has).join(' ');
  assert.match(said, /plotting where they ring/);
  const person = thrumPerson({ flags: () => game.data.flags, has: its.has, here: 'desert' });
  talk(person, { game, items: its, quests: new Quests({ game }) });
  assert.doesNotMatch(tallyLines(game.data.flags, 'desert', its.has).join(' '), /plotting/, 'said once, the first time he has it');
  assert.equal(shop.buy('chart').ok, true);
  assert.equal(game.flag(CHART_FLAG), true);
  for (const id of ['wait', 'page', 'lamp', 'chart', 'tune']) for (const l of THRUM_SHOP_LINES[id]) assert.ok(parseLine(l).explicit, `${id}: toned`);
  assert.equal(THRUM_WARES.find((x) => x.id === 'chart').price, 40);
  // the tune: an answer in his talk once bought
  Object.assign(game.data.flags, found(150));
  assert.equal(shop.buy('tune').ok, true);
  const played = [];
  game.on('thrum:tune', () => played.push(1));
  talk(person, { game, items: its, quests: new Quests({ game }) }, ['Play me']);
  assert.equal(played.length, 1, 'he plays it');
  // his notebook on the People page, a page at a time
  const p = PERSON.get('thrum');
  const heard = (flags) => p.story.filter((s) => typeof s === 'string' || (s[0]?.flag && flags[s[0].flag])).length;
  assert.equal(heard({ 'thrum.page.1': true, 'thrum.page.2': true }) - heard({}), 2);
});

test('Anselm’s chart (issue #520): the Map marks each fragment still to find in the world, once bought; none before, none found', async () => {
  const { chartMarks } = await import('../src/fragments.js');
  const { mapMarks } = await import('../src/world-map.js');
  const { MAP_MARKS } = await import('../engine/map-marks.js');
  const { game, items: its } = fresh({ 'frag.met': true, [fragKey('edena', 3)]: true });
  const F = createFragments({ levelId: 'edena', scene: new THREE.Scene(), player: { pos: V(), hidden: false }, game, items: its, lights: [] });
  assert.deepEqual(chartMarks(F, game), [], 'without the chart: never a fragment on the Map');
  game.set(CHART_FLAG, true);
  const marks = chartMarks(F, game);
  assert.equal(marks.length, 23, 'every one still hiding, not the one found');
  assert.ok(!marks.some((m) => m.i === 3));
  const xs = marks.map((m) => m.x), zs = marks.map((m) => m.z);
  const bounds = { x0: Math.min(...xs) - 10, z0: Math.min(...zs) - 10, w: Math.max(...xs) - Math.min(...xs) + 20, h: Math.max(...zs) - Math.min(...zs) + 20 };
  const drawn = mapMarks({ you: { x: 0, z: 0, dx: 0, dz: 1 }, fragments: marks, bounds }).filter((m) => m.kind === 'fragment');
  assert.equal(drawn.length, 23);
  assert.ok(drawn.every((m) => m.name && m.u >= 0 && m.u <= 1), 'named, on the sheet');
  assert.ok(MAP_MARKS.fragment?.svg, 'the engines draw it too (engine/map-marks.js, BridgeMenu.cs)');
  // both hosts' Map sources pass them
  for (const f of ['../src/main.js', '../engine/game.js']) assert.match(fs.readFileSync(new URL(f, import.meta.url), 'utf8'), /fragments: chartMarks\(fragments,/);
});

test('the tune he sells stops short: only Ilen gives the light\'s song back whole (issue #559)', async () => {
  for (const l of THRUM_SHOP_LINES.tune) assert.doesNotMatch(l, /whole/i, l);
  const said = thrumTalk({ 'frag.met': true, 'thrum.tune': true }).nodes.tune.say.join(' ');
  assert.match(said, /stops short/);
  assert.doesNotMatch(said, /whole/i);
  // and the box plays it so: the theme's short form, cut before it settles (src/story/light-theme.js)
  const src = readFileSync(new URL('../src/story/scientist.js', import.meta.url), 'utf8');
  assert.match(src, /thrum:tune'.*lightTheme\?\.\(\{[^}]*short: true/);
});


test('nearby fragments share one phrase deadline across nearest switches and leaving range', () => {
  const { game, items: its } = fresh();
  const player = { pos: V() }, songs = [];
  const F = createFragments({ levelId: 'desert', scene: new THREE.Scene(), player, game, items: its,
    sound: { fragmentSong: (p) => songs.push(p) } });
  const a = F.list[5], b = F.list[6];
  const middle = a.pos.clone().add(b.pos).multiplyScalar(0.5).add(V(0, -FRAGMENT.lift, 0));
  player.pos.copy(middle).lerp(a.pos.clone().add(V(0, -FRAGMENT.lift, 0)), 0.05);
  F.update(0.1, 0);
  assert.deepEqual(songs, [a.pos], 'overlapping real Desert hearing radii start one nearest phrase');
  player.pos.copy(middle).lerp(b.pos.clone().add(V(0, -FRAGMENT.lift, 0)), 0.05);
  F.update(0.1, 0.1);
  assert.equal(songs.length, 1, 'switching nearest cannot start a second phrase');
  player.pos.set(10000, 10000, 10000); F.update(0.1, 0.2);
  player.pos.copy(middle).lerp(b.pos.clone().add(V(0, -FRAGMENT.lift, 0)), 0.05);
  F.update(0.1, 0.3);
  assert.equal(songs.length, 1, 're-entry retains the deadline');
  F.update(FRAGMENT.singEvery, 4);
  assert.deepEqual(songs, [a.pos, b.pos], 'next due phrase uses the current nearest fragment');
  F.dispose();
});

test('quiet and hidden fragment approaches never start phrases or queue a resume burst', () => {
  const { game, items: its } = fresh();
  const player = { pos: V(), hidden: false }, songs = [];
  const F = createFragments({ levelId: 'desert', scene: new THREE.Scene(), player, game, items: its,
    sound: { fragmentSong: (p) => songs.push(p) } });
  player.pos.copy(F.list[5].pos).add(V(4, -FRAGMENT.lift, 0));
  F.update(20, 20, { quiet: true });
  assert.equal(songs.length, 0, 'conversation/menu suppresses approach songs');
  player.hidden = true; F.update(20, 40);
  assert.equal(songs.length, 0, 'hidden player does not start a song');
  player.hidden = false; F.update(0.1, 40.1);
  assert.equal(songs.length, 1, 'resume starts only one currently due phrase');
  F.update(0.1, 40.2); F.update(0.1, 40.3);
  assert.equal(songs.length, 1, 'no accumulated missed phrases');
  F.dispose();
});

test('quiet collection still grants one fragment and reload never sings or grants it again', () => {
  const { game, items: its } = fresh();
  const player = { pos: V() }, songs = [], taken = [], events = [];
  game.on('fragment', (e) => events.push(e));
  const sound = { fragmentSong: (p) => songs.push(p), fragmentTaken: (e) => taken.push(e) };
  const make = () => createFragments({ levelId: 'desert', scene: new THREE.Scene(), player, game, items: its, sound });
  const F = make(), pos = F.list[5].pos.clone();
  player.pos.copy(pos).add(V(0, -FRAGMENT.lift, 0));
  F.update(1, 1, { quiet: true }); F.update(10, 11, { quiet: true });
  assert.equal(game.flag('frag.desert.5'), true);
  assert.equal(taken.length, 1); assert.equal(events.length, 1); assert.equal(songs.length, 0);
  F.dispose();
  const again = make(); again.update(10, 21);
  assert.equal(again.list[5].found, true); assert.equal(again.list[5].grp.visible, false);
  assert.equal(taken.length, 1); assert.equal(events.length, 1);
  assert.ok(songs.every(p => !p.equals(pos)), 'found slot never sings after reload');
  again.dispose();
});


test('a pickup reserves the shared phrase interval for its payoff, even with another fragment in range', () => {
  const { game, items: its } = fresh();
  const player = { pos: V() }, songs = [], taken = [], events = [];
  game.on('fragment', (e) => events.push(e));
  const F = createFragments({ levelId: 'desert', scene: new THREE.Scene(), player, game, items: its,
    sound: { fragmentSong: (p) => songs.push(p), fragmentTaken: (e) => taken.push(e) } });
  const a = F.list[5], b = F.list[6];
  // A close-pair fixture exercises pickup and an eligible approach in the SAME update.
  b.pos.copy(a.pos).add(V(10, 0, 0));
  player.pos.copy(a.pos).add(V(0, -FRAGMENT.lift, 0));
  F.update(10, 10);
  assert.equal(taken.length, 1); assert.equal(events.length, 1);
  assert.equal(game.flag('frag.desert.5'), true);
  assert.equal(game.flag('frag.desert.6'), undefined, 'uncollected neighbour has no saved flag');
  assert.equal(b.i, 6, 'the neighbour is Desert fragment 6');
  assert.equal(b.found, false, 'the neighbouring fragment remains available');
  assert.equal(songs.length, 0, 'no approach song competes with pickup in the same frame');
  F.update(0.1, 10.1);
  assert.equal(songs.length, 0, 'following frame retains the pickup deadline');
  F.update(FRAGMENT.singEvery - 0.2, 13.3);
  assert.equal(songs.length, 0, 'payoff retains the whole phrase interval');
  F.update(0.2, 13.5);
  assert.deepEqual(songs, [b.pos], 'next nearby fragment may sing after the payoff interval');
  assert.equal(taken.length, 1); assert.equal(events.length, 1);
  F.dispose();
});
