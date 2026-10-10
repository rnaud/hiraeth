import { registerInteractable, PRIORITY } from '../interact.js';
import { Shop } from '../shop.js';
import { SHOPKEEPERS } from './shop-data.js';

// The story side of a world's shops (src/shop-world.js builds them, src/shop.js is what they sell): the keeper
// behind the counter (a story person: E talks to them, and their "Show me what you have" opens the shop), the
// counter itself (E looks at the wares: the shop at once), and the wares on the counter kept to the stock.
// Both open the shop panel the same way: game.emit('shop:open', { shop }) (main.js opens src/shop-panel.js).
//
//   const shops = setupShops({ level, game, spawn });   → { list, update(dt) } or null

export function setupShops({ level, game, spawn }) {
  const built = level?.shops ?? [];
  if (!built.length) return null;
  const list = built.map((s) => {
    const logic = new Shop(s.def, { state: game });
    // (dressed as their place's people and speaking its tongue: a merged world's second part's keeper keeps theirs,
    // the sky stones' almoner her chant: src/levels/names.js PARTS)
    const own = SHOPKEEPERS[s.def.keeper], part = s.def.world;
    const keeper = own && part && part !== level.id && !own.lang ? { ...own, lang: part } : own;
    const npc = keeper && spawn ? spawn(keeper, { route: [s.keeper.at.clone()], heading: s.keeper.heading, speed: 0.4, ...(part && part !== level.id ? { world: part } : {}) }) : null;
    if (npc) npc.facing = s.keeper.heading;
    const at = s.counter.at, look = s.counter.look;
    registerInteractable({
      id: `shop.${s.id}.counter`, priority: PRIORITY.use, range: 1.6, prompt: 'look at the wares',
      at: () => look,
      distance: (p) => (Math.abs(p.pos.y - at.y) < 2 ? Math.hypot(p.pos.x - at.x, p.pos.z - at.z) : Infinity),
      use: () => game.emit('shop:open', { shop: s.id }),
    });
    const show = () => s.show(logic.view());
    show();
    return { shop: s, logic, keeper, npc, show };
  });
  game.on('shop:bought', ({ shop }) => list.find((e) => e.shop.id === shop)?.show());
  let t = 0;
  return {
    list,
    byId: (id) => list.find((e) => e.shop.id === id) ?? null,
    /** The wares on the counters kept to the stock (a potion comes back on the shelf with time). */
    update(dt) { if ((t -= dt) <= 0) { t = 5; for (const e of list) e.show(); } },
  };
}
