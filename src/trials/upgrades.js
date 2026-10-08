import { HOOK } from '../gadgets/hook.js';
import { LENS } from '../gadgets/lens.js';
import { BOUNCE } from '../gadgets/springs.js';
import { FAN } from '../gadgets/fan.js';
import { BOOM } from '../gadgets/boomerang.js';
import { BUBBLE } from '../gadgets/bubble.js';
import { PEN } from '../gadgets/bridge.js';
import { MAG } from '../gadgets/magnet.js';
import { BOMB } from '../gadgets/bomb.js';
import { HISTORY } from '../gadgets/history.js';

// The trials' rewards at work (src/items.js, the items with `trial`): each an upgrade to a gadget's tuning
// table while it is owned, put back when it is not (the dev menu). syncUpgrades(has) is run once a world
// starts, before the gadgets are made (the recall's history takes its window when it is made), and again
// whenever an item is granted or taken (main.js, items.on).

/** Each upgrade: [the table, its key, the value with it]. The value without it is read once, here. */
export const UPGRADES = {
  clearglass: [LENS, 'drain', LENS.drain * 0.5],
  longline: [HOOK, 'range', 34],
  fourthcoil: [BOUNCE, 'max', 4],
  widevane: [FAN.hover, 'gusts', 5],
  fourthnotch: [BOOM, 'locks', 4],
  longbreath: [BUBBLE, 'life', BUBBLE.life * 1.5],
  deepwell: [PEN, 'ink', PEN.ink * 1.5],
  lodestone: [MAG, 'range', 26],
  fourthpouch: [BOMB, 'max', 4],
  longsand: [HISTORY, 'window', 12],
};
const BASE = Object.fromEntries(Object.entries(UPGRADES).map(([id, [t, k]]) => [id, t[k]]));
// (the bubble you float in yourself lasts longer too)
const SELF = BUBBLE.self?.life;

/** Set every gadget's tuning for the upgrades owned (has(id)). Returns the ids on. */
export function syncUpgrades(has) {
  const on = [];
  for (const [id, [t, k, v]] of Object.entries(UPGRADES)) {
    const owned = !!has(id);
    t[k] = owned ? v : BASE[id];
    if (owned) on.push(id);
  }
  if (BUBBLE.self && SELF != null) BUBBLE.self.life = has('longbreath') ? SELF * 1.5 : SELF;
  return on;
}
