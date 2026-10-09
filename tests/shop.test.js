// The shops (src/shop.js, src/shop-panel.js, src/shop-world.js, src/story/shops.js; docs/systems/items.md "Shops"):
// what they sell and at what price, the stock, the potions made finite (and old saves given a full stock), the
// panel's markup and its controller wiring, and Qanat's shop in the desert.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

globalThis.document ??= { createElement: () => ({ getContext: () => null, style: {} }), body: {}, getElementById: () => null, querySelector: () => null };
const { Shop, SHOPS, PRICES, SHELF, stepPrice, restock } = await import('../src/shop.js');
const { Resources, POTION, HEARTS, RES_VERSION } = await import('../src/resources.js');
const { GameState } = await import('../src/game-state.js');
const { migrateFlags, MIGRATED } = await import('../src/save-migrate.js');
const { shopHtml, warePicture, keeperLine, ShopPanel, stockText } = await import('../src/shop-panel.js');
const { SHOPKEEPERS, SHOP_LINES } = await import('../src/story/shop-data.js');
const { buildShop, SHOP_ROOM } = await import('../src/shop-world.js');
const { interiorAt } = await import('../src/interior-kit.js');
const { DROP_OF, PURSE } = await import('../src/chimes.js');
const { parseLine } = await import('../src/story/tone.js');

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const itemSet = (...ids) => { const s = new Set(ids); return { has: (id) => s.has(id) }; };
/** A fresh save and a Qanat shop over it, its clock in our hands. */
function fresh(chimes = 0) {
  const g = new GameState(null), R = new Resources(g, itemSet('backpack'));
  if (chimes) R.addChimes(chimes);
  const clock = { now: 1_000_000 };
  const shop = new Shop(SHOPS.qanat, { state: g, res: R, now: () => clock.now });
  return { g, R, shop, clock };
}
const ware = (shop, id) => shop.view().find((w) => w.id === id);

test('buying: paid from the wallet, given at once; short of chimes nothing is taken', () => {
  const { R, shop, g } = fresh(200);
  const events = [];
  g.on('shop:bought', (e) => events.push(e));
  assert.equal(R.maxHearts, HEARTS.start);
  const r = shop.buy('heart');
  assert.deepEqual(r, { ok: true, state: 'ok', price: PRICES.heart.base, ware: 'heart' });
  assert.equal(R.chimes, 200 - PRICES.heart.base, 'paid');
  assert.equal(R.maxHearts, HEARTS.start + 1, 'a heart more');
  const m = R.maxMagic;
  assert.ok(shop.buy('magic').ok);
  assert.equal(R.maxMagic, m + 1, 'a unit more on the bar');
  assert.equal(events.length, 2);
  const poor = fresh(5);
  assert.equal(ware(poor.shop, 'potion').state, 'short');
  assert.deepEqual(poor.shop.buy('potion'), { ok: false, state: 'short', price: PRICES.potion, ware: 'potion' });
  assert.equal(poor.R.chimes, 5, 'nothing taken');
  assert.equal(poor.R.potions.count, POTION.start, 'nothing given');
});

test('limited stock: a shop has a couple of hearts and expansions; each later one costs more, in every shop', () => {
  const { R, shop } = fresh(2000);
  const prices = [];
  while (ware(shop, 'heart').state === 'ok') prices.push(shop.buy('heart').price);
  assert.deepEqual(prices, [50, 80], 'Qanat: two hearts, the second dearer');
  assert.equal(ware(shop, 'heart').state, 'soldout');
  assert.equal(ware(shop, 'heart').stock, 0);
  assert.deepEqual(shop.buy('heart'), { ok: false, state: 'soldout', price: 110, ware: 'heart' });
  assert.equal(R.maxHearts, HEARTS.start + 2);
  assert.deepEqual([shop.buy('magic').price, shop.buy('magic').price], [40, 70]);
  assert.equal(ware(shop, 'magic').state, 'soldout');
  // the price's step counts every shop's sales (batch 4's shops go on from here)
  const other = new Shop({ id: 'elsewhere', wares: [{ id: 'heart', stock: 1 }] }, { state: shop.state, res: R });
  assert.equal(other.price('heart'), stepPrice('heart', 2), 'the next shop\'s first heart is the third price');
  assert.equal(stepPrice('heart', 0), 50); assert.equal(stepPrice('magic', 3), 130);
});

test('potions: the shelf sells out and comes back with time; you carry five at most', () => {
  const { R, shop, clock } = fresh(500);
  assert.equal(ware(shop, 'potion').stock, SHELF.potions, 'a full shelf');
  assert.equal(R.potions.count, 3);
  assert.ok(shop.buy('potion').ok && shop.buy('potion').ok);
  assert.equal(R.potions.count, POTION.cap);
  assert.equal(ware(shop, 'potion').state, 'full', 'a full pack: no more');
  assert.equal(shop.buy('potion').state, 'full');
  R.takePotion(); R.takePotion(); R.takePotion();
  assert.ok(shop.buy('potion').ok);
  assert.equal(ware(shop, 'potion').state, 'soldout', 'three bought: the shelf is bare');
  clock.now += SHELF.restock * 1000 - 1;
  assert.equal(shop.stock('potion'), 0, 'not yet');
  clock.now += 1;
  assert.equal(shop.stock('potion'), 1, 'one back after the restock time');
  clock.now += SHELF.restock * 1000 * 10;
  assert.equal(shop.stock('potion'), SHELF.potions, 'never more than the shelf holds');
  assert.deepEqual(restock(undefined, undefined, 5), { count: SHELF.potions, t: 5 }, 'a shelf never bought from is full');
  assert.equal(restock(0, 10_000, 0).count, 0, 'a clock set back counts from now');
});

test('the potion switch: finite since the first shop; a save from before gets a full stock, a new game three', () => {
  // a v1.5 save from before the shop: potions infinite (no flag), a few chimes
  const old = { 'item.backpack': true, 'res.v': 1, 'res.chimes': 30, 'save.migrated': 4 };
  assert.equal(migrateFlags(old), true);
  assert.equal(old['res.potions'], POTION.cap, 'a full stock: nobody loses out');
  assert.equal(old['res.potions.infinite'], false);
  assert.equal(old['res.v'], RES_VERSION);
  assert.equal(old['save.migrated'], MIGRATED());
  assert.equal(old['res.chimes'], 30, 'the wallet as it was');
  // older still (before the resources' format): the same
  const older = { 'quest.desert.power': 'done', 'save.migrated': 1 };
  migrateFlags(older);
  assert.equal(older['res.potions'], POTION.cap);
  // made infinite by the dev menu on purpose: stays so
  const dev = { 'res.potions.infinite': true, 'res.v': 1, 'save.migrated': 4 };
  migrateFlags(dev);
  assert.equal(dev['res.potions.infinite'], true);
  // once only
  old['res.potions'] = 1;
  assert.equal(migrateFlags(old), false);
  assert.equal(old['res.potions'], 1);
  // a new game
  const g = new GameState(null); g.reset();
  assert.deepEqual(new Resources(g, itemSet()).potions, { count: POTION.start, infinite: false });
  assert.equal(g.flag('res.v'), RES_VERSION);
});

test('the prices, against the drop table: a heart in a few fights, never a grind; a potion about one fight', () => {
  // an early fight: three or four foes (ink blots, a stilt heron, a sky ray)
  const fight = DROP_OF.blot * 2 + DROP_OF.heron + DROP_OF.ray;
  assert.ok(fight >= 8 && fight <= 16, `a fight: ${fight} chimes`);
  const fights = (n) => n / fight;
  assert.ok(fights(PRICES.potion) <= 1.2, 'a potion: about one fight');
  assert.ok(fights(PRICES.heart.base) >= 3 && fights(PRICES.heart.base) <= 6, `the first heart: ${fights(PRICES.heart.base).toFixed(1)} fights`);
  assert.ok(PRICES.magic.base < PRICES.heart.base, 'an expansion a little less than a heart');
  assert.ok(stepPrice('heart', 1) - PRICES.heart.base <= 40, 'each next one a few fights more, not double');
  // a temple's purse (40) and a makers' run's (15) buy most of the first heart
  assert.ok(PURSE.guardian + PURSE.run >= PRICES.heart.base);
  // written down
  const doc = src('docs/systems/items.md');
  assert.match(doc, /## Shops/);
  assert.match(doc, new RegExp(`heart container[^\\n]*${PRICES.heart.base}`, 'i'));
});

test('the panel: a card a ware with its picture, name, effect, price and stock; the states say so; glyphs in the buttons', () => {
  const { shop } = fresh(60);
  const html = shopHtml({ keeper: SHOPKEEPERS.haddu, line: '~happy~ Look all you like.', wallet: 60, wares: shop.view() });
  assert.match(html, /data-grid-nav/, 'the cards are a grid for the pad');
  for (const id of ['potion', 'heart', 'magic']) assert.match(html, new RegExp(`data-ware="${id}"`));
  assert.equal((html.match(/class="ware /g) ?? []).length, 3);
  assert.match(html, /Healing potion/); assert.match(html, /Heart container/); assert.match(html, /Magic expansion/);
  assert.match(html, /<b>50<\/b>/, 'the price');
  assert.match(html, /3 on the shelf/); assert.match(html, /2 left/);
  assert.match(html, /you carry 3 \/ 5/);
  assert.match(html, /class="shop-wallet"[^>]*>[\s\S]*?<b>60<\/b>/, 'the wallet');
  assert.match(html, /Look all you like\./); assert.doesNotMatch(html, /~happy~/, 'the tone tag never shows');
  assert.match(html, /data-glyph="ok"/); assert.match(html, /data-glyph="back"/, 'B in the close button');
  assert.match(html, /<svg/);
  for (const k of ['potion', 'heart', 'magic']) assert.match(warePicture(k), /^<svg/);
  // states: too dear, sold out, a full pack
  const poor = fresh(10);
  const ph = shopHtml({ keeper: SHOPKEEPERS.haddu, wallet: 10, wares: poor.shop.view() });
  assert.match(ph, /class="ware short"[^>]*aria-disabled="true"/);
  assert.match(ph, /Not enough chimes/);
  const view = [{ id: 'heart', kind: 'heart', price: 110, stock: 0, limited: true, owned: 5, cap: 20, state: 'soldout' }, { id: 'potion', kind: 'potion', price: 10, stock: 3, limited: false, owned: 5, cap: 5, state: 'full' }];
  const sh = shopHtml({ wares: view });
  assert.match(sh, /Sold out/); assert.match(sh, /Your pack is full/);
  assert.doesNotMatch(sh.split('data-ware="potion"')[0], /ware-price/, 'no price on a sold-out card');
  // the question: yes / no, the cards behind it inert
  const ask = shopHtml({ wares: shop.view(), ask: 'heart' });
  assert.match(ask, /Buy a heart container for 50 chimes\?/);
  assert.match(ask, /data-a="yes"[\s\S]*data-glyph="ok"/); assert.match(ask, /data-a="no"[\s\S]*data-glyph="back"/);
  assert.match(ask, /shop-wares" data-grid-nav inert/);
  assert.deepEqual(stockText({ id: 'magic', limited: true, stock: 1, owned: 4 }), { left: '1 left', have: 'your bar: 4' });
});

test('the panel at work: ask, buy, the keeper\'s words react; B backs out of the question, then out of the shop', () => {
  const { g, R, shop } = fresh(60);
  // a page-free stand-in for the panel's element
  const el = { innerHTML: '', classList: { add() {}, remove() {} }, setAttribute() {}, addEventListener() {}, querySelector: () => null };
  const sold = [];
  const panel = new ShopPanel({ el, game: g, resources: R, doc: { body: {} }, onBought: (r) => sold.push(r) });
  const npc = { time: 0 };
  panel.open({ shop: { label: 'Haddu’s' }, logic: shop, keeper: SHOPKEEPERS.haddu, npc });
  assert.ok(panel.isOpen);
  assert.ok(SHOP_LINES.haddu.open.includes(panel.line), 'a greeting');
  panel.pick('magic');
  assert.equal(panel.ask, 'magic', 'a card asks first');
  assert.match(el.innerHTML, /Buy a magic expansion for 40 chimes\?/);
  assert.equal(panel.back(), true);
  assert.equal(panel.ask, null, 'B: out of the question');
  assert.ok(panel.isOpen, 'still in the shop');
  panel.pick('heart');
  const r = panel.buy();
  assert.ok(r.ok);
  assert.ok(SHOP_LINES.haddu.heart.includes(panel.line), 'thanks for a heart');
  assert.equal(sold.length, 1);
  assert.equal(R.chimes, 10);
  panel.pick('heart');
  assert.equal(panel.ask, null, 'too dear: no question');
  assert.ok(SHOP_LINES.haddu.short.includes(panel.line), 'short of chimes');
  R.addChimes(500);
  panel.pick('heart'); panel.buy();
  panel.pick('heart');
  assert.ok(SHOP_LINES.haddu.soldOut.includes(panel.line), 'sold out');
  panel.back();
  assert.equal(panel.isOpen, false, 'B again: out of the shop');
  assert.ok(SHOP_LINES.haddu.bye.includes(npc.shout.text), 'the keeper says goodbye over his head');
  // in turn: never the same line twice running
  const turn = new Map();
  assert.notEqual(keeperLine('haddu', 'potion', turn), keeperLine('haddu', 'potion', turn));
});

test('the keeper: a new person of Qanat, every line with a tone; "Show me what you have" opens the shop', () => {
  const H = SHOPKEEPERS.haddu;
  assert.equal(H.name, 'Haddu');
  assert.ok(H.palette && H.head && H.look, 'his look');
  assert.ok(Number.isFinite(H.voice) && H.kind === 'm', 'his voice');
  const opens = Object.values(H.talk.nodes).flatMap((n) => n.choices ?? []).filter((c) => c.do?.emit?.[0] === 'shop:open');
  assert.ok(opens.length >= 3 && opens.every((c) => c.do.emit[1].shop === 'qanat' && c.end));
  for (const e of H.talk.entry) assert.ok(H.talk.nodes[e.node]);
  for (const n of Object.values(H.talk.nodes)) for (const c of n.choices ?? []) if (c.goto) assert.ok(H.talk.nodes[c.goto], c.goto);
  for (const [what, lines] of Object.entries(SHOP_LINES.haddu)) for (const l of lines) assert.ok(parseLine(l).explicit, `${what}: "${l}" has a tone`);
  for (const k of ['open', 'potion', 'heart', 'magic', 'short', 'soldOut', 'full', 'bye']) assert.ok(SHOP_LINES.haddu[k]?.length, k);
  assert.equal(SHOPS.qanat.keeper, 'haddu');
});

test('the shop\'s room: a counter with the wares laid out, the keeper behind it, the display kept to the stock', () => {
  const scene = new THREE.Scene();
  const s = buildShop(scene, { def: SHOPS.qanat, slot: 11, door: { at: new THREE.Vector3(10, 0, 10), heading: 0 } });
  assert.equal(interiorAt(s.keeper.at), s.interior, 'the keeper stands in the shop');
  assert.equal(interiorAt(s.counter.at), s.interior);
  assert.ok(s.keeper.at.z < s.counter.at.z - 1.5, 'behind the counter, the door side is the customer\'s');
  assert.equal(s.interior.portals[0].label, 'shop door');
  const shown = (id) => s.display[id].filter((m) => m.visible).length;
  assert.deepEqual([shown('potion'), shown('heart'), shown('magic')], [SHELF.potions, 2, 2]);
  s.show([{ id: 'heart', stock: 1 }, { id: 'potion', stock: 0 }]);
  assert.deepEqual([shown('potion'), shown('heart')], [0, 1], 'what is sold goes from the counter');
  assert.equal(SHOP_ROOM.counter > -SHOP_ROOM.d / 2 && SHOP_ROOM.counter < 0, true);
});

test('Qanat\'s shop in the desert: beside the way from the camps to the gate, on the ground, its door turned to the path', async () => {
  const { createDesert } = await import('../src/levels/desert.js');
  const scene = new THREE.Scene();
  const level = createDesert(scene);
  const [shop] = level.shops;
  assert.ok(shop, 'the desert has its shop');
  assert.ok(level.portals.includes(shop.portals[0]) && level.portals.includes(shop.portals[1]), 'its doors among the level\'s ways through');
  const door = shop.interior.door.at, Q = level.qanat;
  const gate = Q.city.gate, camp = Q.camps.center;
  const dGate = Math.hypot(door.x - gate.x, door.z - gate.z), dCamp = Math.hypot(door.x - camp.x, door.z - camp.z);
  assert.ok(dGate < 30 && dCamp < 55, `on the way (gate ${dGate.toFixed(0)} m, camps ${dCamp.toFixed(0)} m)`);
  // out of the straight way from the camps to the gate (and the quest's steps along it)
  const ax = gate.x - camp.x, az = gate.z - camp.z, L = Math.hypot(ax, az);
  const off = Math.abs((door.x - camp.x) * az - (door.z - camp.z) * ax) / L;
  assert.ok(off > 10, `beside the path, not on it (${off.toFixed(1)} m off)`);
  assert.ok(Math.abs(door.y - level.ground.heightAt(door.x, door.z)) < 0.3, 'its door on the ground');
  // its door looks toward the path
  const fwd = new THREE.Vector3(Math.sin(shop.interior.door.heading), 0, Math.cos(shop.interior.door.heading));
  const toPath = new THREE.Vector3(camp.x + ax * 0.6 - door.x, 0, camp.z + az * 0.6 - door.z).normalize();
  assert.ok(fwd.dot(toPath) > 0.3, 'the shopfront faces the way');
  // far from Marrow's crates and the camps' fires
  for (const f of Q.camps.fires) assert.ok(Math.hypot(door.x - f.x, door.z - f.z) > 25);
  assert.ok(level.floraAvoid(door.x, door.z), 'no plant on its doorstep');
});

test('the wiring: main.js opens the panel on shop:open, it takes the controller and B, the story spawns the keeper', () => {
  const m = src('src/main.js');
  assert.match(m, /new ShopPanel\(/);
  assert.match(m, /game\.on\('shop:open'/);
  assert.match(m, /const busy = \(\) => [^\n]*shopPanel\.isOpen/, 'a menu: the game waits');
  assert.match(m, /shopPanel\.isOpen \? shopPanel\.root/, 'the controller\'s presses go to it');
  assert.match(m, /else if \(shopPanel\.isOpen\) shopPanel\.back\(\)/, 'B / ○ backs out');
  assert.match(m, /player\.setMaxHearts\(resources\.maxHearts\); player\.restore\(player\.maxHearts\)/, 'a heart container fills the hearts');
  assert.match(src('src/story/index.js'), /setupShops\(\{ level, game, spawn \}\)/);
  assert.match(src('src/boot.js'), /import '\.\/shop-panel\.css'/);
  const css = src('src/shop-panel.css');
  assert.match(css, /@media \(max-height: 480px\)/, 'a phone on its side');
  assert.match(css, /@media \(max-width: 560px\)/, 'a phone held upright');
  for (const k of ['shop.potion.name', 'shop.heart.name', 'shop.magic.name', 'shop.ask', 'shop.soldOut', 'shop.short', 'shop.full']) {
    assert.ok(src('src/i18n/en.js').includes(`'${k}'`) && src('src/i18n/fr.js').includes(`'${k}'`), k);
  }
});

// ------------------------------------------------------------------ a shop in every route world (batch 4)

test('a shop in every route world: one each, its keeper, its style, its wares (potions everywhere)', async () => {
  const { ORDER } = await import('../src/levels/names.js');
  const { STOCK_TOTAL, shopOf } = await import('../src/shop.js');
  const { FRONTS } = await import('../src/shop-fronts.js');
  const { SHOP_STYLES } = await import('../src/shop-world.js');
  const { BOOK } = await import('../src/story/people-book.js');
  const all = Object.values(SHOPS);
  assert.deepEqual([...new Set(all.map((s) => s.world))].sort(), [...ORDER].sort(), 'a shop in each route world, none elsewhere');
  for (const world of ORDER) {
    const list = all.filter((s) => s.world === world);
    assert.equal(list.length, 1, `${world}: exactly one shop`);
    const s = list[0];
    assert.equal(shopOf(world), s);
    assert.ok(s.name && s.id && SHOPKEEPERS[s.keeper], `${s.id}: a name and a keeper`);
    assert.ok(s.style === 'qanat' || (FRONTS[s.style] && SHOP_STYLES[s.style]), `${s.id}: its own front and room (${s.style})`);
    assert.ok(s.wares.some((w) => w.id === 'potion'), `${s.id}: sells potions`);
    assert.ok((s.wares.find((w) => w.id === 'heart')?.stock ?? 0) >= 1, `${s.id}: a heart container or more`);
    assert.ok(BOOK[world].some((p) => p.id === s.keeper), `${s.keeper}: on the People page under ${world}`);
  }
  assert.equal(new Set(all.map((s) => s.keeper)).size, all.length, 'a keeper a shop');
  assert.equal(new Set(all.map((s) => s.style)).size, all.length, 'a style a shop');
  // the totals, under the caps
  const { MAGIC } = await import('../src/resources.js');
  assert.ok(STOCK_TOTAL.heart <= HEARTS.cap - HEARTS.start, `every heart bought stays under the cap (${HEARTS.start + STOCK_TOTAL.heart} of ${HEARTS.cap})`);
  assert.ok(STOCK_TOTAL.heart >= 10, `enough hearts to matter (${STOCK_TOTAL.heart})`);
  assert.equal(STOCK_TOTAL.magic, MAGIC.cap - MAGIC.start, 'every expansion bought fills the bar to its cap');
  // later worlds a little more: the second half of the route holds at least as many as the first
  const stockOf = (w) => shopOf(w).wares.filter((x) => x.id !== 'potion').reduce((a, x) => a + x.stock, 0);
  const half = Math.ceil(ORDER.length / 2);
  const early = ORDER.slice(1, half).reduce((a, w) => a + stockOf(w), 0) / (half - 1), late = ORDER.slice(half).reduce((a, w) => a + stockOf(w), 0) / (ORDER.length - half);
  assert.ok(late > early, `the later shops hold more (${late.toFixed(1)} a shop against ${early.toFixed(1)})`);
});

test('the prices up the route: every container a few dozen packs of its own world\'s foes at most, never a handful', async () => {
  const { ORDER } = await import('../src/levels/names.js');
  const { shopOf } = await import('../src/shop.js');
  const { rosterOf, BUDGET } = await import('../src/foe-worlds.js');
  // a pack of the world's foes: its wild kinds' drops (src/chimes.js, the tiers only change how they look), the
  // pack's size by the world's stage (src/foe-worlds.js BUDGET)
  const pack = (w) => {
    const R = rosterOf(w), e = Object.entries(R.wild), tot = e.reduce((a, [, x]) => a + x, 0);
    const [lo, hi] = BUDGET[R.stage];
    return e.reduce((a, [k, x]) => a + (DROP_OF[k] ?? 1) * x, 0) / tot * (lo + hi) / 2;
  };
  const bought = { heart: 0, magic: 0 };
  for (const w of ORDER) for (const ware of shopOf(w).wares) {
    if (ware.id === 'potion') { assert.ok(PRICES.potion <= pack(w) * 3.5, `${w}: a potion a few packs at most`); continue; }
    for (let i = 0; i < ware.stock; i++) {
      const price = stepPrice(ware.id, bought[ware.id]++), packs = price / pack(w);
      assert.ok(packs >= (ware.id === 'magic' ? 5 : 8) && packs <= 35, `${w}: a ${ware.id} at ${price} is ${packs.toFixed(1)} packs`);   // (an expansion a little less than a heart)
    }
  }
});

test('every keeper: a look, a voice, a conversation that opens their own shop, and every line toned', () => {
  for (const s of Object.values(SHOPS)) {
    const K = SHOPKEEPERS[s.keeper], L = SHOP_LINES[s.keeper];
    assert.ok(K.name && K.palette && K.head && K.look && Number.isFinite(K.voice) && ['m', 'f'].includes(K.kind), `${s.keeper}: look and voice`);
    const choices = Object.values(K.talk.nodes).flatMap((n) => n.choices ?? []);
    const opens = choices.filter((c) => c.do?.emit?.[0] === 'shop:open');
    assert.ok(opens.length >= 3 && opens.every((c) => c.do.emit[1].shop === s.id && c.end), `${s.keeper}: "Show me what you have" opens ${s.id}`);
    for (const e of K.talk.entry) assert.ok(K.talk.nodes[e.node], `${s.keeper}: ${e.node}`);
    for (const c of choices) if (c.goto) assert.ok(K.talk.nodes[c.goto], `${s.keeper}: ${c.goto}`);
    const said = [...(K.lines ?? []), ...Object.values(K.talk.nodes).flatMap((n) => [...(Array.isArray(n.say) ? n.say : [n.say]), ...(n.choices ?? []).map((c) => c.text)])];
    for (const l of said) assert.ok(parseLine(typeof l === 'string' ? l : l.text).explicit, `${s.keeper}: "${typeof l === 'string' ? l : l.text}" has a tone`);
    for (const k of ['open', 'potion', 'heart', 'magic', 'short', 'soldOut', 'full', 'bye']) {
      assert.ok(L?.[k]?.length >= 2, `${s.keeper}: ${k} lines`);
      for (const l of L[k]) assert.ok(parseLine(l).explicit, `${s.keeper} ${k}: "${l}" has a tone`);
    }
  }
});

test('every world\'s shop room: its counter with the wares, the keeper behind it, the display kept to the stock', () => {
  let slot = 20;
  for (const def of Object.values(SHOPS)) {
    const scene = new THREE.Scene();
    const s = buildShop(scene, { def, slot: slot++, door: { at: new THREE.Vector3(10, 0, 10), heading: 0.4 } });
    assert.equal(interiorAt(s.keeper.at), s.interior, `${def.id}: the keeper in the shop`);
    assert.equal(interiorAt(s.counter.at), s.interior);
    assert.ok(s.keeper.at.z < s.counter.at.z - 1.5, `${def.id}: behind the counter`);
    assert.equal(s.interior.label, def.name, 'the cue names it as you step in');
    const shown = (id) => s.display[id].filter((m) => m.visible).length;
    const stock = (id) => def.wares.find((w) => w.id === id)?.stock ?? 0;
    assert.deepEqual([shown('potion'), shown('heart'), shown('magic')], [SHELF.potions, stock('heart'), stock('magic')], `${def.id}: the wares on its counter`);
    s.show([{ id: 'heart', stock: 0 }]);
    assert.equal(shown('heart'), 0, 'what is sold goes from the counter');
  }
});
