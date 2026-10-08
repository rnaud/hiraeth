// Gear a game lends the traveller for its run (docs/systems/minigames.md): the ring race's jets, the wing
// drop's fluid wings. The registry (src/items.js) answers yes for the lent ids while the game runs, so the
// tank, the nozzles and the wings are drawn on the back (src/fluid-tool.js reads items.has each frame);
// nothing is written to the save. The returned function gives them back (the session's end()).
//
//   const giveBack = lendItems(['backpack', 'jetpack']);  …  giveBack();

import { items } from '../../items.js';

export function lendItems(ids, registry = items) {
  const own = registry.has;
  const lent = new Set(ids);
  const has = function (id) { return lent.has(id) || own.call(this, id); };
  registry.has = has;
  return () => { if (registry.has === has) registry.has = own; };
}
