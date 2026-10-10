import { game as sharedGame } from './game-state.js';
import { resources as sharedResources, POTION, HEARTS, MAGIC } from './resources.js';
import { isDismissed, partsOf } from './levels/names.js';

// The shops (docs/systems/items.md, "Shops"): what they sell for chimes, at what price, and how much is left.
// Pure over the save's flags and the resources (src/resources.js), so the tests drive it without a page, and
// every world's shop (batch 4) is one more entry in SHOPS: its wares and its stock, nothing else.
//
//   Potions      `potion`: one healing potion (POTION.heal hearts), PRICES.potion each. The shelf holds
//                SHELF.potions; one comes back every SHELF.restock seconds (the wall clock, so it refills
//                between sessions too). You carry at most POTION.cap.
//   Hearts       `heart`: a heart container, +1 heart for good (the hearts filled too). A shop has a few
//                (its `stock`); the price rises with every container bought in any shop (PRICES.heart).
//   Magic        `magic`: a magic-bar expansion, +1 unit. Limited per shop, the price rising the same way.
//
// The save (game flags):
//   shop.<id>.<ware>.sold     how many of a limited ware this shop has sold
//   shop.<id>.potions         potions on its shelf (unset: a full shelf)
//   shop.<id>.potions.t       when the shelf last counted a restock (ms, Date.now())
//   shop.bought.heart / .magic   containers and expansions bought in every shop (the prices' step)
//
//   const s = new Shop(SHOPS.qanat);
//   s.view() → [{ id, kind, price, stock, owned, state }]     state: 'ok' | 'short' | 'soldout' | 'full'
//   s.buy('heart') → { ok, state, price }                      ok: paid and given; else why not (state)

/** Prices in chimes: a potion's, and the first container's and expansion's with the step each later one adds. */
export const PRICES = {
  potion: 10,
  heart: { base: 50, step: 30 },
  magic: { base: 40, step: 30 },
};

/** The potion shelf: how many it holds, and the seconds for one to come back. */
export const SHELF = { potions: 3, restock: 180 };

/** What a ware is (its picture, name and effect are the panel's: src/shop-panel.js). */
export const WARES = {
  potion: { id: 'potion', kind: 'potion' },
  heart: { id: 'heart', kind: 'heart' },
  magic: { id: 'magic', kind: 'magic' },
};

/**
 * Every shop, one in each route world (batch 4): its id (the save's), its keeper (src/story/shop-data.js), its
 * world (the level id), its name (the cue's place name inside), its style (its front, src/shop-fronts.js, and its
 * room, src/shop-world.js SHOP_STYLES), and its wares with the stock of the limited ones. Potions everywhere; the
 * heart containers and the magic expansions a few a shop, a little more in the later worlds, so that every one
 * of them bought makes 18 hearts of the 20 (HEARTS.cap) and a bar of 9 (MAGIC.cap: with the Engine-House's cell
 * the last expansion is never needed). STOCK_TOTAL sums them (tests/shop.test.js holds them under the caps).
 */
export const SHOPS = {
  qanat: { id: 'qanat', keeper: 'haddu', world: 'desert', style: 'qanat', name: 'Haddu’s Chimes & Cures', wares: [{ id: 'potion' }, { id: 'heart', stock: 2 }, { id: 'magic', stock: 2 }] },
  windshelf: { id: 'windshelf', keeper: 'brin', world: 'arzach', style: 'hoodoo', name: 'The Wind-Shelf', wares: [{ id: 'potion' }, { id: 'heart', stock: 1 }] },
  almonry: { id: 'almonry', keeper: 'perpetue', world: 'arzach2', style: 'almonry', name: 'The Almonry', wares: [{ id: 'potion' }, { id: 'heart', stock: 1 }] },
  float: { id: 'float', keeper: 'nettle', world: 'perdide', style: 'raft', name: 'Nettle’s Float', wares: [{ id: 'potion' }, { id: 'heart', stock: 1 }, { id: 'magic', stock: 1 }] },
  welcome: { id: 'welcome', keeper: 'rowan', world: 'perdide2', style: 'mossdome', name: 'The Welcome-Shelf', wares: [{ id: 'potion' }, { id: 'heart', stock: 1 }] },
  potting: { id: 'potting', keeper: 'clover', world: 'edena', style: 'potting', name: 'Clover’s Potting House', wares: [{ id: 'potion' }, { id: 'heart', stock: 1 }] },
  basket: { id: 'basket', keeper: 'fausta', world: 'incal', style: 'basket', name: 'Fausta’s Basket-Shop', wares: [{ id: 'potion' }, { id: 'heart', stock: 2 }, { id: 'magic', stock: 1 }] },
  // (the Sealed Hangar's, kept with its world, dismissed in October 2026: src/levels/names.js DISMISSED; not counted)
  hatch: { id: 'hatch', keeper: 'odo', world: 'garage', style: 'kiosk', name: 'The Quartermaster’s Hatch', wares: [{ id: 'potion' }, { id: 'heart', stock: 1 }] },
  // (in the kiosk that stood by the First Garage's porch: it came to the dunes with the Clock-House)
  kilnstall: { id: 'kilnstall', keeper: 'marit', world: 'glassdunes', style: 'kiosk', name: 'Marit’s Kiln-Stall', wares: [{ id: 'potion' }, { id: 'heart', stock: 1 }] },
  toothcounter: { id: 'toothcounter', keeper: 'mott', world: 'buried', style: 'rivetdome', name: 'Mott’s Tooth-Counter', wares: [{ id: 'potion' }, { id: 'heart', stock: 2 }, { id: 'magic', stock: 1 }] },
  listening: { id: 'listening', keeper: 'hale', world: 'spheres', style: 'pavilion', name: 'The Listening Stall', wares: [{ id: 'potion' }, { id: 'heart', stock: 1 }] },
  curestall: { id: 'curestall', keeper: 'pashka', world: 'bazaar', style: 'stall', name: 'Pashka’s Cure-Stall', wares: [{ id: 'potion' }, { id: 'heart', stock: 2 }, { id: 'magic', stock: 1 }] },
};

/** The shops a player can reach: one in each place on the route (a dismissed world's shop stays in the list, unvisited). */
export const OPEN_SHOPS = Object.values(SHOPS).filter((s) => !isDismissed(s.world));
/** How many heart containers and magic expansions all the shops hold together. */
export const STOCK_TOTAL = OPEN_SHOPS.reduce((t, s) => {
  for (const w of s.wares) if (w.id !== 'potion') t[w.id] = (t[w.id] ?? 0) + (w.stock ?? 0);
  return t;
}, { heart: 0, magic: 0 });

/** A world's shop (its level id), or null. */
export const shopOf = (world) => Object.values(SHOPS).find((s) => s.world === world) ?? null;
/** The shops in a world (a merged world has its parts': Vael's Wind-Shelf and the sky stones' Almonry). */
export const shopsIn = (world) => partsOf(world).map(shopOf).filter(Boolean);

const num = (v, d = 0) => (Number.isFinite(+v) && v !== null && v !== undefined && v !== '' ? +v : d);

/** The price of the next container (`kind` heart or magic) after `bought` of them in all the shops. */
export function stepPrice(kind, bought) {
  const P = PRICES[kind];
  return P.base + P.step * Math.max(0, Math.floor(bought));
}

/** The shelf now: `{ count, t }` from what was saved (count, t) and the time, one potion back each SHELF.restock s. */
export function restock(count, t, now) {
  const size = SHELF.potions, step = SHELF.restock * 1000;
  if (count === undefined || count === null || !Number.isFinite(+count)) return { count: size, t: now };
  let c = Math.max(0, Math.min(size, Math.floor(+count)));
  let at = Number.isFinite(+t) ? +t : now;
  if (at > now) at = now;   // (a clock set back: counted from now)
  if (c >= size) return { count: size, t: now };
  const back = Math.floor((now - at) / step);
  c = Math.min(size, c + back);
  return { count: c, t: c >= size ? now : at + back * step };
}

export class Shop {
  /**
   * @param def        an entry of SHOPS
   * @param o.state    the game flags (src/game-state.js)
   * @param o.res      the resources (src/resources.js)
   * @param o.now      () => ms, the wall clock (tests give their own)
   */
  constructor(def, { state = sharedGame, res = sharedResources, now = () => Date.now() } = {}) {
    Object.assign(this, { def, state, res, now });
    this.id = def.id;
  }
  ware(id) { return this.def.wares.find((w) => w.id === id) ?? null; }
  /** How many of a limited ware this shop has sold. */
  sold(id) { return Math.max(0, Math.floor(num(this.state.flag(`shop.${this.id}.${id}.sold`)))); }
  /** Potions on the shelf now (restocked by the clock). */
  shelf() {
    const k = `shop.${this.id}.potions`;
    return restock(this.state.flag(k), this.state.flag(`${k}.t`), this.now()).count;
  }
  /** How many are left: the shelf's potions, or a limited ware's stock less what was sold. */
  stock(id) {
    const w = this.ware(id);
    if (!w) return 0;
    if (w.id === 'potion') return this.shelf();
    return Math.max(0, (w.stock ?? 0) - this.sold(id));
  }
  /** The price of the next one, in chimes. */
  price(id) {
    if (id === 'potion') return PRICES.potion;
    return stepPrice(id, num(this.state.flag(`shop.bought.${id}`)));
  }
  /** What you already have of it: potions carried, hearts, the bar's units. */
  owned(id) {
    if (id === 'potion') return this.res.potions.count;
    if (id === 'heart') return this.res.maxHearts;
    if (id === 'magic') return this.res.maxMagic;
    return 0;
  }
  /** The most you can have of it (a potion's carry cap, the hearts' and the bar's caps). */
  cap(id) {
    if (id === 'potion') return this.res.potions.infinite ? Infinity : POTION.cap;
    if (id === 'heart') return HEARTS.cap;
    if (id === 'magic') return MAGIC.cap;
    return Infinity;
  }
  /** Can it be bought now: 'ok', 'soldout' (none left), 'full' (you can't carry or hold more), 'short' (not enough chimes). */
  status(id) {
    if (this.stock(id) <= 0) return 'soldout';
    if (this.owned(id) >= this.cap(id)) return 'full';
    if (!this.res.canAfford(this.price(id))) return 'short';
    return 'ok';
  }
  /** Every ware as the panel shows it. */
  view() {
    return this.def.wares.map((w) => ({ id: w.id, kind: WARES[w.id]?.kind ?? w.id, price: this.price(w.id), stock: this.stock(w.id), limited: w.id !== 'potion', owned: this.owned(w.id), cap: this.cap(w.id), state: this.status(w.id) }));
  }
  /** Buy one: paid, given, the stock taken down. Returns { ok, state, price, ware }. */
  buy(id) {
    const w = this.ware(id);
    if (!w) return { ok: false, state: 'none', price: 0, ware: id };
    const state = this.status(id), price = this.price(id);
    if (state !== 'ok') return { ok: false, state, price, ware: id };
    if (!this.res.spend(price, { source: `shop.${this.id}` })) return { ok: false, state: 'short', price, ware: id };
    if (id === 'potion') {
      const k = `shop.${this.id}.potions`, s = restock(this.state.flag(k), this.state.flag(`${k}.t`), this.now());
      this.state.set(`${k}.t`, s.count >= SHELF.potions ? this.now() : s.t);
      this.state.set(k, s.count - 1);
      this.res.addPotions(1);
    } else {
      this.state.set(`shop.${this.id}.${id}.sold`, this.sold(id) + 1);
      this.state.set(`shop.bought.${id}`, Math.max(0, Math.floor(num(this.state.flag(`shop.bought.${id}`)))) + 1);
      if (id === 'heart') this.res.addHeartContainer(1);
      if (id === 'magic') this.res.addMagic(1);
    }
    this.state.emit?.('shop:bought', { shop: this.id, ware: id, price });
    return { ok: true, state: 'ok', price, ware: id };
  }
}
