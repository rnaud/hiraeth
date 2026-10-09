import { ARCHETYPES, spawnKindOf, archetypeOfKind } from './enemies/archetypes.js';

// Which foes each world holds (docs/design/enemy-roster.md, "World table"; docs/systems/foes.md, "Each world's
// foes"): the wild packs, the relics' guards and the temple rooms draw from the world's archetypes, each in the
// world's skin (src/enemies/skins.js). Pure tables and picks (tests/archetypes.test.js, tests/foe-kinds.test.js).
//
// WORLDS[world] (the doc's table):
//   stage    where on the difficulty curve it stands (0: the Desert and Vael … 3: the last three; side worlds 2)
//   lead     the pack lead: the most common archetype there (no two route worlds in a row share one)
//   roster   its archetypes by weight (how often each leads a pack)
//   late     archetypes that lead only from the third pack on; placed: one met where it is placed, not in packs
//   temple   the kinds in its temple rooms (no archetype in its echo guardian's temple: the makers' machines stay)
// An archetype not built yet runs on its stand-in's body (src/enemies/archetypes.js `kind`); one with nothing to
// stand in for it (`planned`) is listed but passed over until it lands.
//
// rosterOf(world) turns a world's table into what spawning reads, in foe kinds:
//   wild     the pack leads and how often each comes (a weight); a pack is its lead, then fillers
//   fill     what fills a pack round its lead (weights); first: the first pack of a visit (alone)
//   guards   the kinds that gather round a relic; temple: the kinds in the temple rooms, room by room

export const WORLDS = {
  // the route
  desert: { stage: 0, lead: 'blot', roster: { blot: 4, worm: 3, heron: 2, skitter: 2 }, placed: ['tripod'] },
  arzach: { stage: 0, lead: 'ray', roster: { ray: 4, heron: 2, blot: 3 } },
  arzach2: { stage: 1, lead: 'crab', roster: { crab: 4, ray: 3, jelly: 2, blot: 2 } },
  perdide: { stage: 1, lead: 'toad', roster: { toad: 4, rootknot: 3, heron: 2, skitter: 2 } },
  perdide2: { stage: 1, lead: 'rootknot', roster: { rootknot: 4, jelly: 2, moth: 3, shade: 0.6 }, placed: ['brute'] },
  edena: { stage: 2, lead: 'moth', roster: { moth: 4, rootknot: 3, brute: 2, blot: 2 } },
  incal: { stage: 2, lead: 'tripod', roster: { tripod: 4, drone: 3, lizard: 3, toad: 2, shade: 1 }, temple: ['machine', 'drone'] },
  garage: { stage: 2, lead: 'drone', roster: { drone: 4, cart: 2, crab: 2, roller: 2, ray: 2, shade: 1 }, temple: ['machine', 'drone'] },
  buried: { stage: 3, lead: 'worm', roster: { worm: 4, tripod: 3, cart: 2, lizard: 2, centipede: 2, skitter: 2 }, temple: ['machine', 'drone'] },
  spheres: { stage: 3, lead: 'roller', roster: { roller: 4, drone: 3, jelly: 2, centipede: 2, shade: 1, hound: 2 }, late: ['hound', 'marionette'], placed: ['marionette'] },
  bazaar: { stage: 3, lead: 'lizard', roster: { lizard: 4, moth: 3, crab: 2, bell: 2, marionette: 1, hound: 2 }, late: ['hound', 'marionette'] },
  // the side worlds (all still being made; their tables are set as each world is vetted)
  mangrove: { stage: 2, lead: 'heron', roster: { heron: 4, rootknot: 3, hound: 2, roller: 2 } },
  glassdunes: { stage: 2, lead: 'brute', roster: { brute: 4, crab: 3, ray: 2, worm: 2, shade: 1 } },
  waterfall: { stage: 2, lead: 'toad', roster: { toad: 4, centipede: 2, brute: 2, rootknot: 2 } },
  saltharbour: { stage: 2, lead: 'crab', roster: { crab: 4, roller: 3, bell: 2, marionette: 1 } },
  antennas: { stage: 2, lead: 'moth', roster: { moth: 4, drone: 3, crab: 2, centipede: 2 } },
  underwater: { stage: 2, lead: 'crab', roster: { crab: 4, ray: 3, tripod: 2, jelly: 2 } },
  eclipse: { stage: 2, lead: 'hound', roster: { hound: 4, lizard: 3, centipede: 2, shade: 2 } },
  fallenring: { stage: 2, lead: 'centipede', roster: { centipede: 4, jelly: 3, tripod: 2, drone: 2 } },
  moonfoundry: { stage: 2, lead: 'cart', roster: { cart: 4, skitter: 3, lizard: 2, brute: 2 } },
  underside: { stage: 2, lead: 'marionette', roster: { marionette: 3, bell: 2, ray: 3, skitter: 2 } },
  spacecity: { stage: 2, lead: 'drone', roster: { drone: 4, moth: 3, roller: 2 } },
};

/** Worlds with no table of their own (a minigame's field, a test's): ink blots. */
export const CLASSIC = { wild: { blot: 1 }, fill: { blot: 1 }, first: 'blot', guards: ['blot', 'blot'], temple: ['machine'], shade: 0, stage: 1 };

/** How many of a kind come together (a pack of them alone); and the packs before a kind may lead one. */
export const GROUP = { swarm: 6, moth: 3, hound: 2, lizard: 2 };
export const FROM = { swarm: 2, machine: 2, golem: 1, slag: 1, shade: 3, tripod: 1 };
/** A big lead takes this many of a pack's places. */
export const COSTS = { machine: 2, golem: 2, slag: 2, crab: 1.5, tripod: 2 };
/** The pack's places by stage of the route (docs/design/enemy-roster.md, "Difficulty curve"). */
export const BUDGET = [[1, 2], [2, 3], [3, 4], [4, 5]];
/** Is a kind a ranged or area one (the archetype it is or stands in for)? Early packs hold at most one. */
export const rangedKind = (k) => !!ARCHETYPES[archetypeOfKind(k)]?.ranged && k !== 'blot';   // (the blot's spit is a teacher's, not a ranged role)

/** The kinds a world's table fields (each archetype's own or its stand-in), weighted; planned ones dropped. */
function kindsOf(table, { late = false } = {}) {
  const out = {};
  for (const [a, w] of Object.entries(table.roster)) {
    if (late && table.late?.includes(a)) continue;
    const k = spawnKindOf(a);
    if (k) out[k] = (out[k] ?? 0) + w;
  }
  return out;
}

/** The world tables as spawning reads them (in foe kinds), by world. */
export const ROSTERS = Object.fromEntries(Object.entries(WORLDS).map(([w, T]) => {
  const wild = kindsOf(T), early = kindsOf(T, { late: true });
  const lead = spawnKindOf(T.lead) ?? Object.entries(early).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'blot';
  wild[lead] = (wild[lead] ?? 0) + 1;   // (the lead leads most often)
  const fill = Object.fromEntries(Object.entries(early).filter(([k]) => !GROUP[k] && (COSTS[k] ?? 1) <= 1.5 && k !== 'shade'));
  fill.blot = (fill.blot ?? 0) + 1;     // (the blot: in every world, few)
  const second = Object.entries(early).filter(([k]) => k !== lead && !GROUP[k]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'blot';
  const late = Object.fromEntries((T.late ?? []).map((a) => [spawnKindOf(a), 2]).filter(([k]) => k));
  return [w, { wild, fill, first: lead, guards: [lead, second], temple: T.temple ?? ['machine'], shade: 0, stage: T.stage ?? 2, late }];
}));

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
 * What the n-th pack of a visit to a world is (n from 0): the first, the world's lead alone (a blot on the very first
 * visit to the desert: there the game explains them); otherwise a lead drawn from the roster (a group kind comes as a
 * group; a late one only from the third pack), the rest of the stage's places filled, at most one ranged kind in
 * the first half of the route.
 */
export function packOf(n, levelId, rng = Math.random) {
  const R = rosterOf(levelId);
  if (n === 0) return [R.first];
  const [lo, hi] = BUDGET[Math.max(0, Math.min(BUDGET.length - 1, R.stage ?? 1))];
  const size = lo + Math.floor(rng() * (hi - lo + 1));
  if (n >= 3 && rng() < R.shade) return ['shade'];
  let lead = pick(R.wild, rng);
  if ((FROM[lead] ?? 0) > n || (R.late?.[lead] && n < 3)) lead = pick(R.fill, rng);
  if (GROUP[lead]) return Array(GROUP[lead]).fill(lead);
  const out = [lead];
  let ranged = rangedKind(lead) ? 1 : 0;
  for (let left = size - (COSTS[lead] ?? 1); left >= 1 - 1e-9; left--) {
    let k = pick(R.fill, rng);
    if ((R.stage ?? 1) <= 1 && rangedKind(k) && ranged >= 1) k = 'blot';
    if (rangedKind(k)) ranged++;
    out.push(k);
  }
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

/** The archetypes a world fields (its table's, placed ones too), in its table's order. */
export const worldArchetypes = (w) => (WORLDS[w] ? [...new Set([...Object.keys(WORLDS[w].roster), ...(WORLDS[w].placed ?? [])])] : []);
