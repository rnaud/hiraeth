import { fragmentCounts, CHART_FLAG } from './fragments-data.js';
import { ITEMS, FRAGMENT_ITEMS } from './items.js';

// Anselm Thrum's shop (v1.62, issue #185: "I just want Anselm to sell me upgrades"; docs/systems/fragments.md): the
// fragments of the singing light are a currency. He sells his seven upgrades aboard the ship, each for a price in
// fragments (src/items.js `fragments`: 3, 5, 7, 10, 18, 23, 30: 96, every fragment there was until v1.70, a third of the 288 since, issue #317), and the ones you
// hold go down as you buy. Until v1.62 he fitted them free at milestones of the count (5, 10, 15, 25, 50, 75, 96).
//
// Nothing new is saved: what you hold is the fragments found less the prices of the upgrades you have, so a save with
// milestone upgrades keeps them, and holds found − their prices (never less than none). The found total (the Worlds
// page, the Start menu, the Lantern's line) never goes down.
//
//   fragmentPurse(flags, has) → { found, total, spent, held }
//   thrumWares(flags, has)    → [{ id, price, state, needs }]   state: 'ok' | 'short' | 'needs' | 'owned' | 'wait'
//   THRUM_WARES               the wares that aren't upgrades (v1.86, issue #481): his notebook, his lamp, his chart, the tune
//   new FragmentShop({ game, items }) → { view(), buy(id) }       (the shop panel's logic, as src/shop.js Shop's)

/** Each upgrade's price in fragments. */
export const PRICES = Object.fromEntries(FRAGMENT_ITEMS.map((u) => [u.id, u.price]));

/**
 * What else he sells once the seven upgrades can be had (issue #481: "192 of the 288 fragments buy nothing"; the proposal
 * on #481): things that aren't numbers, each offered once enough fragments are FOUND (`after`; found never goes down,
 * so spending never takes one off his shelf again). Not items: each is a flag (`flag`), and `pages` of his notebook are
 * bought one at a time, a page for every `every` found. 110 all told; with the upgrades' 96, 206 to spend.
 *   page   his notebook, a page at a time: his story on the People page (src/story/people-book.js)
 *   lamp   his jar becomes a lamp that lights the hold, brighter with every fragment found (src/story/scientist.js)
 *   chart  the Map marks every fragment still hiding in the world you are in (issue #520, src/world-map.js)
 *   tune   he plays the light's theme whole, aboard, when you ask (src/story/scientist-data.js)
 */
export const THRUM_WARES = [
  { id: 'page', price: 5, pages: 6, every: 20 },
  { id: 'lamp', price: 15, after: 60, flag: 'thrum.lamp' },
  { id: 'chart', price: 40, after: 100, flag: CHART_FLAG },
  { id: 'tune', price: 25, after: 150, flag: 'thrum.tune' },
];
const WARE = Object.fromEntries(THRUM_WARES.map((w) => [w.id, w]));
/** A page of his notebook's flag (1 to 6). */
export const pageFlag = (n) => `thrum.page.${n}`;
/** How many pages of his notebook are yours. */
export const pagesOwned = (flags = {}) => Array.from({ length: WARE.page.pages }, (_, i) => i + 1).filter((n) => flags[pageFlag(n)]).length;
/** All his wares' prices, the upgrades' and the others' (every page counted): what there is to spend. */
export const ALL_PRICES = Object.values(PRICES).reduce((a, b) => a + b, 0) + THRUM_WARES.reduce((a, w) => a + w.price * (w.pages ?? 1), 0);

/** The fragments found, spent (the upgrades you have, the other wares bought) and held. `has(id)`: an item owned. */
export function fragmentPurse(flags = {}, has = (id) => !!flags[`item.${id}`]) {
  const { found, total } = fragmentCounts(flags);
  const spent = FRAGMENT_ITEMS.reduce((n, u) => n + (has(u.id) ? u.price : 0), 0)
    + THRUM_WARES.reduce((n, w) => n + (w.pages ? pagesOwned(flags) * w.price : flags[w.flag] ? w.price : 0), 0);
  return { found, total, spent, held: Math.max(0, found - spent) };
}

/**
 * His wares: the upgrades, the cheapest first: bought already ('owned'), its gear not had yet ('needs'), too dear
 * ('short'), or 'ok'; then the other wares he has by now (found ≥ `after`), the same, and his notebook's next page
 * ('wait': he hasn't written it yet, a page for every 20 found; `page`: its number).
 */
export function thrumWares(flags = {}, has = (id) => !!flags[`item.${id}`]) {
  const { held, found } = fragmentPurse(flags, has);
  const ups = FRAGMENT_ITEMS.map(({ id, price }) => {
    const needs = ITEMS[id]?.needs ?? null;
    const state = has(id) ? 'owned' : needs && !has(needs) ? 'needs' : held < price ? 'short' : 'ok';
    return { id, price, state, needs };
  });
  const more = [];
  for (const w of THRUM_WARES) {
    if (w.pages) {
      if (found < w.every) continue;
      const owned = pagesOwned(flags), page = Math.min(w.pages, owned + 1);
      const state = owned >= w.pages ? 'owned' : found < page * w.every ? 'wait' : held < w.price ? 'short' : 'ok';
      more.push({ id: w.id, price: w.price, state, needs: null, page, ware: true });
      continue;
    }
    if (found < w.after) continue;
    more.push({ id: w.id, price: w.price, state: flags[w.flag] ? 'owned' : held < w.price ? 'short' : 'ok', needs: null, ware: true });
  }
  return [...ups, ...more];
}

/** The first upgrade or ware you could buy now (his balloon, his greeting), or null. */
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
  /** Bought: the upgrade is yours (or the ware: its flag, a page its own), the price off what you hold. Else why not ({ ok: false, state }). */
  buy(id) {
    const w = thrumWares(this.flags(), this.has).find((x) => x.id === id);
    if (!w) return { ok: false, state: 'none', ware: id };
    if (w.state !== 'ok') return { ok: false, state: w.state, price: w.price, ware: id };
    if (w.ware) {
      const k = WARE[id].pages ? pageFlag(w.page) : WARE[id].flag;
      if (this.game?.flag?.(k)) return { ok: false, state: 'owned', price: w.price, ware: id };
      this.game?.set?.(k, true);
    } else if (!this.items.grant(id)) return { ok: false, state: 'owned', price: w.price, ware: id };
    this.game?.emit?.('thrum:bought', { ware: id, price: w.price, ...(w.page ? { page: w.page } : {}) });
    return { ok: true, state: 'ok', price: w.price, ware: id, ...(w.page ? { page: w.page } : {}) };
  }
}
