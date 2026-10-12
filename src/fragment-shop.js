import { fragmentCounts } from './fragments-data.js';
import { ITEMS, FRAGMENT_ITEMS } from './items.js';

// Anselm Thrum's shop (v1.62, issue #185: "I just want Anselm to sell me upgrades"; docs/systems/fragments.md): the
// fragments of the singing light are a currency. He sells his seven upgrades aboard the ship, each for a price in
// fragments (src/items.js `fragments`: 3, 5, 7, 10, 18, 23, 30, every fragment there is all told), and the ones you
// hold go down as you buy. Until v1.62 he fitted them free at milestones of the count (5, 10, 15, 25, 50, 75, 96).
//
// Nothing new is saved: what you hold is the fragments found less the prices of the upgrades you have, so a save with
// milestone upgrades keeps them, and holds found − their prices (never less than none). The found total (the Worlds
// page, the Start menu, the Lantern's line) never goes down.
//
//   fragmentPurse(flags, has) → { found, total, spent, held }
//   thrumWares(flags, has)    → [{ id, price, state, needs }]   state: 'ok' | 'short' | 'needs' | 'owned'
//   new FragmentShop({ game, items }) → { view(), buy(id) }       (the shop panel's logic, as src/shop.js Shop's)

/** Each upgrade's price in fragments. */
export const PRICES = Object.fromEntries(FRAGMENT_ITEMS.map((u) => [u.id, u.price]));

/** The fragments found, spent (the prices of the upgrades you have) and held. `has(id)`: an item owned. */
export function fragmentPurse(flags = {}, has = (id) => !!flags[`item.${id}`]) {
  const { found, total } = fragmentCounts(flags);
  const spent = FRAGMENT_ITEMS.reduce((n, u) => n + (has(u.id) ? u.price : 0), 0);
  return { found, total, spent, held: Math.max(0, found - spent) };
}

/** His wares, the cheapest first: bought already ('owned'), its gear not had yet ('needs'), too dear ('short'), or 'ok'. */
export function thrumWares(flags = {}, has = (id) => !!flags[`item.${id}`]) {
  const { held } = fragmentPurse(flags, has);
  return FRAGMENT_ITEMS.map(({ id, price }) => {
    const needs = ITEMS[id]?.needs ?? null;
    const state = has(id) ? 'owned' : needs && !has(needs) ? 'needs' : held < price ? 'short' : 'ok';
    return { id, price, state, needs };
  });
}

/** The first upgrade you could buy now (his balloon, his greeting), or null. */
export const affordable = (flags, has) => thrumWares(flags, has).find((w) => w.state === 'ok')?.id ?? null;

/** The shop panel's logic (src/shop-panel.js), over the save and the items. */
export class FragmentShop {
  constructor({ game, items }) {
    this.game = game; this.items = items;
  }
  flags() { return this.game?.data?.flags ?? {}; }
  has = (id) => this.items.has(id);
  /** What you hold now. */
  get held() { return fragmentPurse(this.flags(), this.has).held; }
  view() { return thrumWares(this.flags(), this.has).map((w) => ({ ...w, kind: 'upgrade', limited: true, stock: w.state === 'owned' ? 0 : 1 })); }
  /** Bought: the upgrade is yours, the price off what you hold. Else why not ({ ok: false, state }). */
  buy(id) {
    const w = thrumWares(this.flags(), this.has).find((x) => x.id === id);
    if (!w) return { ok: false, state: 'none', ware: id };
    if (w.state !== 'ok') return { ok: false, state: w.state, price: w.price, ware: id };
    if (!this.items.grant(id)) return { ok: false, state: 'owned', price: w.price, ware: id };
    this.game?.emit?.('thrum:bought', { ware: id, price: w.price });
    return { ok: true, state: 'ok', price: w.price, ware: id };
  }
}
