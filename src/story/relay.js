// The relay signal: the way to Ilen before home (docs/story-audit.md, "Ilen before Home";
// lore/plot-review.md §1).
//
// The Signal Market is the last world on the route, and home opens after six, so a
// player could reach the stone without ever hearing the broadcast (the father's voice,
// years younger, to a child called Ilen). The worlds keep their order; what changes is
// that the ship notices the broadcast from far off and says so:
//
//  - 'far': from RELAY_FROM worlds done, until the broadcast is heard: the receiver holds a
//    faint signal on an old relay, too weak to read, from further along the route (the
//    market's place on the galactic map pulses, named or not; the console's standby screen
//    says RELAY SIGNAL, and its "no new messages" says where it comes from);
//  - 'held': the broadcast was heard and the traveller asked the reel for the name, but
//    the mother's recording ("For when he asks") has not played yet: the map's home panel and
//    the console say a recording is held. It waits from the moment he steps out of the ship
//    or the ship flies (src/story/calls.js ilenPending), so flying straight home from the
//    market still leaves it at the console before the stone, if he goes to hear it.
//
// Pure: the tests use it directly.

import { ENDING_WORLDS } from './ending.js';

/** The market, where the broadcast is. */
export const RELAY_WORLD = 'bazaar';
/** From how many worlds done the ship hears the signal: two before home opens. */
export const RELAY_FROM = ENDING_WORLDS - 2;

/**
 * The relay signal now: null, or { stage: 'far' | 'held', world }.
 * @param o.flag (k) => value · o.completed: the worlds done (ids or a count)
 */
export function relaySignal({ flag = () => undefined, completed = 0 } = {}) {
  const n = Array.isArray(completed) ? completed.length : completed;
  if (flag('calls.ilen.told')) return null;
  if (flag('calls.ilen.asked')) return { stage: 'held', world: RELAY_WORLD };
  const heard = flag('clue.bazaar.home') || flag(`world.${RELAY_WORLD}.done`);
  if (heard || n < RELAY_FROM) return null;
  return { stage: 'far', world: RELAY_WORLD };
}

/** The words the map and the console use for it. */
export const RELAY_TEXT = {
  // on the map, by the market's place (named, or a faint dot not charted yet)
  tag: 'a signal',
  far: 'The receiver holds a faint signal from here, on an old relay. Too weak to read: a voice, and what might be a name, over and over.',
  farUncharted: 'Further along the route, past the worlds charted, the receiver holds a faint signal on an old relay. Too weak to read yet: a voice, and what might be a name.',
  // on the home panel while the mother's recording is held
  held: 'A recording is held at the console: “For when he asks.” Your mother’s voice.',
  // the console's screen (standby) and its "no new messages"
  screen: { far: 'RELAY SIGNAL', held: 'RECORDING HELD' },
  console: {
    far: 'No new messages. The receiver still holds a faint signal on an old relay, further along the route. Too weak to read.',
    held: 'One recording held: “For when he asks.” It will wait here.',
  },
};

/** The ship's line at the end of "Come home", while the signal is out there (tone-tagged). */
export const RELAY_COME_HOME = '~neutral~ The receiver also holds a faint signal on an old relay, further along the route. Too weak to read yet. Marked on the map.';
