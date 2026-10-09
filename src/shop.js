import { game as sharedGame } from './game-state.js';
import { resources as sharedResources, POTION, HEARTS, MAGIC } from './resources.js';

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
 * Every shop: its id (the save's), its keeper (src/story/shop-data.js), its world, and its wares with the stock
 * of the limited ones. Batch 4 adds a shop to every world here.
 */
export const SHOPS = {
  qanat: { id: 'qanat', keeper: 'haddu', world: 'desert', name: 'Haddu’s Chimes & Cures', wares: [{ id: 'potion' }, { id: 'heart', stock: 2 }, { id: 'magic', stock: 2 }] },
};

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
