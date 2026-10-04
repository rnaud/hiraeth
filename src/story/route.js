// The route: which worlds the traveller knows about.
//
// The worlds open up one by one, in ORDER (src/levels/content.js), instead of
// all being on the chart from the start:
//
//  - the first world (the desert, where the ship crashes) is always known;
//  - after it, the next AHEAD (2) worlds that are not done yet are known, so
//    there is always a choice of two places to go;
//  - finishing a world (its `world.<id>.done` flag or its story page) takes it
//    out of that pair, and the next world in ORDER takes its place;
//  - a world you have been to (or are standing in) stays known, done or not.
//
// The ship's galactic map (src/ship/starmap.js) draws the others as faint,
// nameless dots; the level picker (L, main.js) leaves them out. Home is not on
// the route: it opens on its own (src/story/ending.js). For development,
// ?level=<id> and the dev menu still go anywhere.
//
// Pure: the tests use it directly.

/** How many unfinished worlds ahead are known at once. */
export const AHEAD = 2;

/**
 * The known worlds, in ORDER.
 * @param o.order    the route (ids)
 * @param o.done     (id) => the world is done
 * @param o.visited  (id) => you have been there
 * @param o.current  the world you are in
 */
export function knownWorlds({ order = [], done = () => false, visited = () => false, current = null, ahead = AHEAD } = {}) {
  const known = new Set(order.slice(0, 1));
  for (const id of order) if (id === current || done(id) || visited(id)) known.add(id);
  let open = 0;
  for (const id of order.slice(1)) {
    if (open >= ahead) break;
    if (!done(id)) { known.add(id); open++; }
  }
  return order.filter((id) => known.has(id));
}

/** The worlds in `after` that were not in `before` (what finishing a world revealed). */
export const newlyKnown = (before, after) => after.filter((id) => !before.includes(id));
