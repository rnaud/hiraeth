// Where Lorn's route through its explorations stands (issue #188; docs/systems/worlds.md, "Lorn: one route through
// the roots, the drowned wood and the keepers' canopy"), as plain numbers: read by the Deep Wood's scatter
// (src/levels/perdide2.js leaves its own trunks and giants out of them, its dice thrown all the same) and by the
// builders (src/lorn-canopy.js, src/lorn-flood.js). No imports: the wood's own module reads it.
//
//   CANOPY      the keepers' village up in the Deep Wood's trunks over the second dark pool: four great trunks of their
//               own, a deck round each 70 m up, rope bridges between, a stair up the first, a second up the tallest
//               to the lookout 120 m up, and the cap square (a giant Veil's solid cap at the deck's height)
//   VIEW_LANE   the lookout's view out to the Great Crystal, kept clear of the wood's trunks
//   CLEARINGS   the drowned wood's clearings off the lit path, reached by water (the skiff, or a swim)
//   woodKeepOut(x, z, r)  is a thing r round at (x, z) in the way of either?

/** The village's trunks ({ x, z, r, h }: centre, radius, height), its deck height, its bridges (pairs of trunk ids). */
export const CANOPY = {
  deck: 70,
  lookout: 120,
  trunks: {
    stair: { x: 28, z: -750, r: 5, h: 150 },     // by the path, the stair up it from the bank
    winch: { x: 13.3, z: -777.1, r: 5, h: 140 },  // its deck's jetty out over the second dark pool, the winch on it
    huts: { x: -33, z: -783.2, r: 5, h: 146 },    // across the path, its huts
    tall: { x: -13.6, z: -745.2, r: 6, h: 172 },  // the tallest: the stair on up it to the lookout
  },
  square: { x: -58, z: -818, capR: 13, stalk: 2.6 },   // the cap square, its top level with the decks
  bridges: [['stair', 'winch'], ['winch', 'huts'], ['huts', 'tall'], ['tall', 'stair'], ['huts', 'square']],
  // (the deck round a trunk: from its bark out to r + DECK_W)
  deckW: 6,
};

/**
 * The lookout's view to the Great Crystal ([x, z] from, to): no trunk of the wood's stands across it (its lane is a few
 * metres wide, nothing a walker sees from below), so from the top of the tallest trunk the swamp's Crystal glows on the
 * horizon, the two halves of Lorn in one look.
 */
export const VIEW_LANE = [[-13.6, -745.2], [120, -150]];

/** The drowned wood's clearings ({ id, x, z, r }), off the lit path, each with a pause in it. */
export const CLEARINGS = [
  { id: 'eggs', x: -80, z: -704, r: 14 },    // the egg isle: a moss mound heaped with glowing eggs, a keeper's hut
  { id: 'heron', x: -124, z: -524, r: 12 },  // the heron's nest on a broken drowned trunk
  { id: 'dome', x: 156, z: -672, r: 12 },    // a moss dome half drowned, its door lit over the water
];

const segDist = (x, z, a, b) => {
  const ex = b.x - a.x, ez = b.z - a.z, L = ex * ex + ez * ez, t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / L));
  return Math.hypot(x - a.x - ex * t, z - a.z - ez * t);
};
const node = (id) => CANOPY.trunks[id] ?? CANOPY.square;

/**
 * Is a thing r round at (x, z) in the way of the village (its trunks with their stairs and decks, its bridges, the cap
 * square) or of a clearing? (`tall`: it rises past the decks: a trunk; a giant mushroom stays under them, so only the
 * trunks' own room and the stairs keep it out; `shaft`: a trunk's radius aloft, where the lookout looks past it.)
 */
export function woodKeepOut(x, z, r = 0, { tall = true, shaft = r } = {}) {
  for (const T of Object.values(CANOPY.trunks)) if (Math.hypot(x - T.x, z - T.z) < T.r + (tall ? CANOPY.deckW + 2 : 4) + r) return true;
  if (Math.hypot(x - CANOPY.square.x, z - CANOPY.square.z) < CANOPY.square.capR + 2 + r) return true;
  if (tall) for (const [a, b] of CANOPY.bridges) if (segDist(x, z, node(a), node(b)) < 3 + r) return true;
  if (tall && segDist(x, z, { x: VIEW_LANE[0][0], z: VIEW_LANE[0][1] }, { x: VIEW_LANE[1][0], z: VIEW_LANE[1][1] }) < 2.5 + shaft) return true;   // (aloft: its shaft, not its foot)
  for (const C of CLEARINGS) if (Math.hypot(x - C.x, z - C.z) < C.r + r) return true;
  return false;
}
