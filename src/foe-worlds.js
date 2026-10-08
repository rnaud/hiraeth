// Which foes each world holds (docs/systems/foes.md, "Each world's foes"): the wild packs, the relics' guards and
// the temple rooms draw from the world's roster. Pure tables and picks (tests/foe-worlds.test.js).
//
//   wild     the pack leads and how often each comes (a weight); a pack is its lead, then fillers
//   fill     what fills a pack round its lead (weights); first: the first pack of a visit (alone)
//   guards   the kinds that gather round a relic; temple: the kinds in the temple rooms, room by room
//   shade    how often a lone shade comes instead (from the fourth pack on)

/** Worlds that have no roster of their own: the old mix of blots, spitters and swarms. */
export const CLASSIC = { wild: { blot: 5, spitter: 3, swarm: 2 }, fill: { blot: 1 }, first: 'blot', guards: ['blot', 'blot'], temple: ['machine'], shade: 0.1 };

export const ROSTERS = {
  // the route
  desert: { wild: { ray: 4, blot: 3, spitter: 2, swarm: 1 }, first: 'blot', guards: ['ray', 'blot'] },
  arzach: { wild: { blot: 3, flyer: 4, spitter: 2 }, first: 'flyer', guards: ['flyer', 'blot'] },
  arzach2: { wild: { blot: 2, flyer: 4, spitter: 2 }, first: 'flyer', guards: ['flyer', 'flyer'], shade: 0.14 },
  perdide: { wild: { stalker: 4, swarm: 2, blot: 2, spitter: 1 }, first: 'stalker', guards: ['stalker', 'blot'] },
  perdide2: { wild: { stalker: 4, swarm: 2, spitter: 2 }, first: 'stalker', guards: ['stalker', 'stalker'] },
  edena: { wild: { blot: 3, stalker: 2, spitter: 2 }, first: 'blot', guards: ['stalker', 'blot'] },
  incal: { wild: { drone: 4, blot: 2, flyer: 2 }, first: 'drone', guards: ['drone', 'blot'], temple: ['machine', 'drone'] },
  garage: { wild: { drone: 5, machine: 1, blot: 1 }, fill: { drone: 1, blot: 1 }, first: 'drone', guards: ['drone', 'drone'], temple: ['machine', 'drone'] },
  buried: { wild: { ray: 3, drone: 3, spitter: 1, blot: 1 }, first: 'ray', guards: ['ray', 'drone'], temple: ['machine', 'drone'] },
  spheres: { wild: { blot: 3, spitter: 2, swarm: 2, stalker: 1 }, first: 'blot', guards: ['blot', 'spitter'] },
  bazaar: { wild: { moth: 5, blot: 2, spitter: 1 }, first: 'moth', guards: ['moth', 'blot'] },
  // the larger side worlds
  glassdunes: { wild: { golem: 4, blot: 2, spitter: 1, flyer: 1 }, fill: { blot: 1 }, first: 'golem', guards: ['golem', 'blot'] },
  mangrove: { wild: { stalker: 5, swarm: 2, blot: 1 }, first: 'stalker', guards: ['stalker', 'stalker'] },
  saltharbour: { wild: { crab: 5, blot: 1, spitter: 2 }, fill: { blot: 1, crab: 1 }, first: 'crab', guards: ['crab', 'crab'] },
  underwater: { wild: { crab: 4, swarm: 2, blot: 1 }, fill: { blot: 1 }, first: 'crab', guards: ['crab', 'blot'] },
  moonfoundry: { wild: { slag: 4, drone: 2, blot: 1 }, fill: { drone: 1, blot: 1 }, first: 'slag', guards: ['slag', 'drone'] },
  eclipse: { wild: { hound: 5, blot: 1 }, fill: { blot: 1 }, first: 'hound', guards: ['hound', 'hound'], shade: 0.18 },
  antennas: { wild: { moth: 3, drone: 3, flyer: 2 }, fill: { blot: 1 }, first: 'drone', guards: ['drone', 'moth'] },
  fallenring: { wild: { drone: 3, flyer: 3, blot: 2 }, first: 'drone', guards: ['drone', 'blot'] },
  underside: { wild: { flyer: 4, drone: 2, blot: 1 }, first: 'flyer', guards: ['flyer', 'drone'] },
  spacecity: { wild: { drone: 4, moth: 2 }, fill: { blot: 1 }, first: 'drone', guards: ['drone', 'drone'] },
  waterfall: { wild: { crab: 3, stalker: 2, blot: 2 }, first: 'crab', guards: ['crab', 'blot'] },
};

/** How many of a kind come together (a pack of them alone); and the packs before a kind may lead one. */
export const GROUP = { swarm: 6, moth: 3, hound: 2 };
export const FROM = { swarm: 2, machine: 2, golem: 1, slag: 1, shade: 3 };
/** A big lead takes this many of a pack's places. */
export const COSTS = { machine: 2, golem: 2, slag: 2, crab: 1.5 };

/** A world's roster: its own, over the classic mix. */
export function rosterOf(levelId) {
  return { ...CLASSIC, ...(ROSTERS[levelId] ?? {}) };
}

/** A weighted pick from { kind: weight }. */
export function pick(weights, rng = Math.random) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let x = rng() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of entries) if ((x -= w) <= 0) return k;
  return entries.at(-1)?.[0];
}

/**
 * What the n-th pack of a visit to a world is (n from 0): the first, the world's own kind alone (a blot on the
 * very first visit to the desert: there the game explains them); from the fourth, now and then a lone shade;
 * otherwise a lead drawn from the roster (a group kind comes as a group), the rest of the 2 or 3 places filled.
 */
export function packOf(n, levelId, rng = Math.random) {
  const R = rosterOf(levelId);
  if (n === 0) return [R.first];
  const r = rng(), size = 2 + Math.floor(rng() * 2);
  if (n >= 3 && r < R.shade) return ['shade'];
  let lead = pick(R.wild, rng);
  if ((FROM[lead] ?? 0) > n) lead = pick(R.fill, rng);
  if (GROUP[lead]) return Array(GROUP[lead]).fill(lead);
  const out = [lead];
  for (let left = size - (COSTS[lead] ?? 1); left >= 1 - 1e-9; left--) out.push(pick(R.fill, rng));
  return out;
}

/** The kinds round a relic (as many as `size`). */
export function guardKinds(levelId, size = 2) {
  const g = rosterOf(levelId).guards;
  return Array.from({ length: size }, (_, i) => g[i % g.length]);
}

/** The kind in a temple's room i (the first room past the entrance is 1). */
export function templeKind(levelId, i) {
  const t = rosterOf(levelId).temple;
  return t[(i - 1 + t.length) % t.length];
}
