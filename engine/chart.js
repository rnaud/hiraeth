// The galactic map's choices without its page (issue #264, docs/plans/unity-finishable.md): on the web the holo table
// opens the StarMap (src/ship/starmap.js), where the worlds the route has opened are chosen, the ones not named yet found
// by the signature search, and Home and the Lantern appear once the story opens them. The engines have no page for it:
// their holo table opens the game menu's Worlds page (engine/game.js), whose Travel here was fast travel only (worlds
// already visited, src/fast-travel.js). So a world never visited could not be reached in Unity, and the game could not
// be finished there. Aboard, the Worlds page now lists the chart's worlds as the StarMap does (its own mapEntries), and
// Travel here takes the ship to any of them; a world still to be found by its signature is found as it is chosen.
//
//   chartWorlds(entries)                                  → the ids on the chart (known or findable), in its order
//   chartTravel({ to, from, entries, aboard, seen, flag }) → { text, missing?, quest? } (refused) | { find } (goes)
//
// Pure: engine/game.js and the tests use it.

import { fastTravel } from '../src/fast-travel.js';
import { leaveRefusal } from '../src/story/leave-gate.js';
import { partOf } from '../src/levels/names.js';

/** The ids the chart offers (mapEntries' entries that are known, or findable by their signature). */
export const chartWorlds = (entries = []) => entries.filter((e) => e.known || e.findable).map((e) => e.id);

/**
 * Whether the ship goes to `to`. Off the ship (the Worlds page from View anywhere): fast travel's rules, worlds already
 * visited. Aboard (the holo table): any world on the chart, with the same leave gates as the ship's own travel
 * (src/story/leave-gate.js); `find` true when the world was only findable (its signature to be locked first).
 */
export function chartTravel({ to, from, entries = [], aboard = false, seen = () => false, flag = () => false } = {}) {
  const fast = fastTravel.refusal({ to, from, seen, flag });
  if (!fast) return { find: false };
  const e = aboard ? entries.find((x) => x.id === to) : null;
  if (!e || !(e.known || e.findable) || !flag('ship.powered') || partOf(to) === partOf(from)) return fast;
  const no = leaveRefusal(from, to, (id) => !!flag(`item.${id}`));
  return no ? { text: no.line.text, missing: no.missing, quest: no.quest } : { find: !!e.findable };
}
