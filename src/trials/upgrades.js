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
import { RECALL } from '../gadgets/recall.js';
import { RIDE_SPEED } from '../bike.js';
import { BLADE } from '../fluid-blade.js';
import { MAGIC_COST } from '../resources.js';

// The trials' rewards at work (src/items.js, the items with `trial`): each an upgrade to a gadget's tuning
// table (the desert's: the hoverbike's, the one thing it has to upgrade) while it is owned, put back when it is not (the dev menu). syncUpgrades(has) is run once a world
// starts, before the gadgets are made (the recall's history takes its window when it is made), and again
// whenever an item is granted or taken (main.js, items.on).

/** Each upgrade: [the table, its key, the value with it]. The value without it is read once, here. */
export const UPGRADES = {
  dunefins: [RIDE_SPEED, 'max', 42],
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
/**
 * The charms the three worlds of v1.40 keep behind their makers' courts' gates (v1.48, issue #101: src/finds/courts.js),
 * each a little more for the gadget its court is for, on keys of their own (not the trials'): [the table, its key, the value with it].
 */
export const CHARM_TUNES = {
  floatbead: [BUBBLE, 'maxRise', 10.5],
  keeper: [MAG, 'pull', 24],
  splice: [HOOK, 'pull', 34],
  sunglass: [PEN, 'life', PEN.life * 1.5],   // (issue #169: the City-Shaft's mirrors' chest)
  sandglass: [RECALL, 'range', 48],   // (v1.86, issue #518: the Signal Market's court, a box at last)
};
const CHARM_BASE = Object.fromEntries(Object.entries(CHARM_TUNES).map(([id, [t, k]]) => [id, t[k]]));
// (the bubble you float in yourself lasts longer too)
const SELF = BUBBLE.self?.life;

/**
 * The scientist's upgrades that are a number in a table (issue #196: src/items.js `fragments`, src/story/scientist.js):
 * [the table, its key, the value with it]. The others are read where they act: the heart and the chamber from the items
 * (src/resources.js HEART_ITEMS, MAGIC_ITEMS), the wings and the boots in src/boxes/effects.js.
 */
export const FRAGMENT_TUNES = {
  lightedge: [BLADE, 'edge', 1.5],
  lightguard: [MAGIC_COST, 'shield', 0.5],
};
const FRAGMENT_BASE = Object.fromEntries(Object.entries(FRAGMENT_TUNES).map(([id, [t, k]]) => [id, t[k]]));

/** Set every gadget's tuning for the upgrades owned (has(id)). Returns the ids on. */
export function syncUpgrades(has) {
  const on = [];
  for (const [id, [t, k, v]] of Object.entries(UPGRADES)) {
    const owned = !!has(id);
    t[k] = owned ? v : BASE[id];
    if (owned) on.push(id);
  }
  if (BUBBLE.self && SELF != null) BUBBLE.self.life = has('longbreath') ? SELF * 1.5 : SELF;
  for (const [id, [t, k, v]] of Object.entries(CHARM_TUNES)) t[k] = has(id) ? v : CHARM_BASE[id];
  for (const [id, [t, k, v]] of Object.entries(FRAGMENT_TUNES)) t[k] = has(id) ? v : FRAGMENT_BASE[id];
  return on;
}
