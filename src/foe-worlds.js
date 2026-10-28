import { ARCHETYPES, spawnKindOf, archetypeOfKind } from './enemies/archetypes.js';

// Which foes each world holds (docs/design/enemy-roster.md, "World table"; docs/systems/foes.md, "Each world's
// foes"): the wild packs and the temple rooms draw from the world's archetypes, each in the
// world's skin (src/enemies/skins.js). Pure tables and picks (tests/archetypes.test.js, tests/foe-kinds.test.js).
//
// WORLDS[world] (the doc's table):
//   stage    where on the difficulty curve it stands (0: the Desert and Vael … 3: the Buried Machine and the Garden,
//            4: the Signal Market alone; side worlds 2): its packs' places (BUDGET), and from 3 the turns and the harm
//            of src/foes.js (TURNS.late, HARM_BY_STAGE)
//   budget   [lo, hi] places when a world's differ from its stage's (v1.22: docs/audits/combat-v1.22.md)
//   lead     the pack lead: the most common archetype there, and a visit's first pack, alone (the same few on the route
//            since roster v4: the blot in the Desert, the grunt, the prowler in the last worlds)
//   roster   its archetypes by weight (how often each leads a pack)
//   late     archetypes that lead only from the third pack on; placed: one met where it is placed, not in packs
//   sites    archetypes met only at its encounter sites (src/encounters/sites.js), never in a pack: the hulk, the warlord,
//            the sentinel and the oracle (and the Desert's prowlers, at its nest and its ambush before any pack)
//   horde    the pre-v4 roster its fight temple breeds (tests/fight-temples-worlds.test.js), the archetypes RETIRED kept
//   temple   the kinds in its temple rooms (no archetype in its echo guardian's temple: the makers' machines stay)
// Since batch 5 (v1.18) every archetype is built on its own body: no stand-in is left, and every world runs on the new
// roster (an archetype not built would run on a stand-in's body, src/enemies/archetypes.js `kind`, or wait, `planned`).
//
// rosterOf(world) turns a world's table into what spawning reads, in foe kinds:
//   wild     the pack leads and how often each comes (a weight); a pack is its lead, then fillers
//   fill     what fills a pack round its lead (weights); first: the first pack of a visit (alone)
//   temple   the kinds in the temple rooms, room by room (the relics' guards went with the relics in v2.34, #732)

export const WORLDS = {
  // the route (issue #726, roster v4, the author's rule of 2026-10-28: the same foes in every world; tiers, not new looks,
  // carry the later worlds; docs/design/enemy-roster-v4.md, "Where they live" and "Each foe's place"). The packs are
  // grunts, prowlers and crawlers, mixed by the world's stage; the sites hold the rest (`sites`: the hulk at a camp, the
  // sentinel and the oracle at a makers' place, the warlord at its hold from the second world on). Kept beside them,
  // for the roles v4 has no foe for: the blot (the first world's teacher), the sky ray and the ring drone (the flyers),
  // the skitters (the swarm, in the two machine-works) and the lamp tripod and the makers' fencer (droids already).
  // `horde`: the world's pre-v4 roster, the animals its fight temple still breeds (src/fight-temples/<world>.js), kept
  // as it was with their skins (RETIRED below).
  desert: { stage: 0, lead: 'blot', roster: { blot: 4, grunt: 4, crawler: 2, prowler: 1.5 }, placed: ['tripod'], sites: ['hulk', 'sentinel'],
    horde: { blot: 4, worm: 3, heron: 2, skitter: 2, mummer: 1.5 } },
  arzach: { stage: 0, lead: 'grunt', roster: { grunt: 4, crawler: 2.5, ray: 2, prowler: 1.5 }, sites: ['hulk', 'warlord', 'sentinel'],
    horde: { ray: 4, heron: 2, blot: 3 } },
  arzach2: { stage: 1, lead: 'grunt', roster: { grunt: 3.5, prowler: 2.5, crawler: 2, ray: 2.5 }, sites: ['hulk', 'warlord', 'sentinel'],
    horde: { crab: 4, ray: 3, jelly: 2, blot: 2 } },
  perdide: { stage: 1, lead: 'grunt', roster: { grunt: 4, prowler: 2.5, crawler: 2.5 }, sites: ['hulk', 'warlord', 'sentinel'],
    horde: { toad: 3.5, rootknot: 3, heron: 1.5, skitter: 3 } },
  perdide2: { stage: 1, lead: 'grunt', roster: { grunt: 3.5, prowler: 3, crawler: 2.5 }, placed: ['sentinel'], sites: ['hulk', 'warlord'],
    horde: { rootknot: 4, jelly: 2, moth: 3, shade: 1, wisp: 1.5 } },
  edena: { stage: 2, budget: [3, 4], lead: 'grunt', roster: { grunt: 4, prowler: 3, crawler: 2.5, drone: 1.5 }, sites: ['hulk', 'warlord', 'sentinel', 'oracle'],
    horde: { moth: 4, rootknot: 2, brute: 1.5, blot: 1 } },
  underwater: { stage: 2, budget: [3, 4], lead: 'grunt', roster: { grunt: 3.5, prowler: 3, crawler: 2.5, ray: 2 }, sites: ['warlord', 'sentinel', 'oracle', 'tripod'],
    horde: { crab: 4, ray: 2.5, jelly: 3, tripod: 2 } },
  incal: { stage: 2, lead: 'grunt', roster: { grunt: 4, prowler: 3, crawler: 3, drone: 1.5 }, sites: ['hulk', 'warlord', 'sentinel', 'tripod'], temple: ['machine', 'drone'],
    horde: { tripod: 4, drone: 1, lizard: 3.5, toad: 2.5, shade: 2.5 } },
  // (the Sealed Hangar, dismissed in October 2026: its table kept with its skins, src/levels/dismissed/)
  garage: { stage: 2, budget: [4, 5], lead: 'drone', roster: { drone: 4, cart: 3.5, crab: 2.5, roller: 2, ray: 1, shade: 2.5 }, temple: ['machine', 'drone'] },
  glassdunes: { stage: 2, budget: [4, 5], lead: 'grunt', roster: { grunt: 4, prowler: 3, crawler: 2.5, drone: 1.5, ray: 1.5 }, sites: ['hulk', 'warlord', 'sentinel', 'oracle'], temple: ['machine', 'drone'],
    horde: { brute: 4, crab: 3, ray: 2, worm: 2, drone: 2, shade: 1 } },
  buried: { stage: 3, lead: 'prowler', roster: { grunt: 3.5, prowler: 3.5, crawler: 3, skitter: 2 }, sites: ['hulk', 'warlord', 'sentinel', 'oracle'], temple: ['machine', 'drone'],
    horde: { worm: 3.5, tripod: 3, cart: 2, lizard: 2, centipede: 2, skitter: 3 } },
  moonfoundry: { stage: 3, lead: 'grunt', roster: { grunt: 3.5, prowler: 3.5, crawler: 3, skitter: 2 }, sites: ['hulk', 'warlord', 'sentinel', 'fencer'], temple: ['machine', 'drone'],
    horde: { cart: 4, skitter: 3, lizard: 2.5, brute: 2, wisp: 2.5, fencer: 1.5 } },
  spheres: { stage: 3, budget: [4, 6], lead: 'prowler', roster: { grunt: 3.5, prowler: 4, crawler: 3, drone: 1.5 }, placed: ['oracle'], sites: ['hulk', 'warlord', 'sentinel'],
    horde: { roller: 4, drone: 1, jelly: 1, centipede: 4, shade: 3.5, hound: 4 } },
  spacecity: { stage: 3, budget: [4, 6], lead: 'grunt', roster: { grunt: 3, prowler: 4, crawler: 3, drone: 2.5 }, sites: ['warlord', 'fencer'], temple: ['machine', 'drone'],
    horde: { drone: 4, moth: 3, roller: 3, fencer: 2 } },
  bazaar: { stage: 4, lead: 'prowler', roster: { grunt: 3.5, prowler: 4, crawler: 3, drone: 1.5 }, sites: ['hulk', 'warlord', 'sentinel', 'oracle'],
    horde: { lizard: 4, moth: 1.5, crab: 1.5, bell: 3, marionette: 2.5, hound: 3.5, fencer: 1.5 } },
  // the side worlds (all discarded, names.js DISCARDED: their tables stay as they are)
  mangrove: { stage: 2, lead: 'heron', roster: { heron: 4, rootknot: 3, hound: 2, roller: 2 } },
  waterfall: { stage: 2, lead: 'toad', roster: { toad: 4, centipede: 2, brute: 2, rootknot: 2 } },
  saltharbour: { stage: 2, lead: 'crab', roster: { crab: 4, roller: 3, bell: 2, marionette: 1 } },
  antennas: { stage: 2, lead: 'moth', roster: { moth: 4, drone: 3, crab: 2, centipede: 2 } },
  eclipse: { stage: 2, lead: 'hound', roster: { hound: 4, lizard: 3, centipede: 2, shade: 2, wisp: 2 } },
  fallenring: { stage: 2, lead: 'centipede', roster: { centipede: 4, jelly: 3, tripod: 2, drone: 2 } },
  underside: { stage: 2, lead: 'marionette', roster: { marionette: 3, bell: 2, ray: 3, skitter: 2 } },
};

/**
 * The encounters placed by hand (WORLDS[w].placed: one met where it stands, not in a pack): where each stands (x, z: its
 * ground found under it) and which way it faces (rad); met calm, as its archetype keeps to itself (src/foes.js
 * Foes.updatePosts); once cut down, gone for good (a flag per save). The Desert's cistern pump, a makers' lamp tripod,
 * keeps the one deep water the dunes hold: the mineral basin under the lavender cliffs (src/desert-vistas.js BASIN), on
 * its far shore from the fishing sign, its lamp turned out over the water. Since roster v4 (issue #726) Lorn II's post on
 * the dry bank of the lit path, between the root arches past the glass dome, is a sentinel's, standing guard where the
 * wood cutter (a furnace brute) stood; the Garden of Spheres' white archway in the android wood an oracle's, hanging over
 * its threshold where the glass puppet (a marionette) swayed.
 */
export const PLACED = {
  desert: [{ archetype: 'tripod', at: [-489.0, -187.0], heading: Math.PI / 2 }],
  perdide2: [{ archetype: 'sentinel', at: [13.7, -280.0], heading: -1.03 }],
  spheres: [{ archetype: 'oracle', at: [-108.0, -411.7], heading: 1.4 }],
};

/**
 * The archetypes roster v4 retired from the route (issue #726): the per-world animals and the mummers, no longer met in
 * a route world's packs, sites or posts. Kept with their code and skins: the Arena's list, the debug menu's foes (the
 * roster), the discarded side worlds' tables and the fight temples' hordes (WORLDS[w].horde) still field them.
 */
export const RETIRED = ['crab', 'lizard', 'toad', 'worm', 'centipede', 'heron', 'mummer', 'mummerking', 'shade', 'hound', 'moth', 'roller',
  'bell', 'brute', 'cart', 'jelly', 'wisp', 'marionette', 'rootknot'];

/** Worlds with no table of their own (a minigame's field, a test's): ink blots. */
export const CLASSIC = { wild: { blot: 1 }, fill: { blot: 1 }, first: 'blot', temple: ['machine'], shade: 0, stage: 1 };

/** How many of a kind come together (a pack of them alone); and the packs before a kind may lead one. */
export const GROUP = { skitter: 8, moth: 3, hound: 2, lizard: 2, mummer: 2, crawler: 2 };
/** The places a group takes in a pack from the third stage on (the rest filled round it): a flock of feeble skitters two. */
export const GROUP_COST = { skitter: 2, moth: 3, hound: 2, lizard: 2, mummer: 2, crawler: 2 };
export const FROM = { wisp: 1, skitter: 1, mummer: 1, mummerking: 3, machine: 2, brute: 1, cart: 1, bell: 2, shade: 3, tripod: 1, centipede: 1, marionette: 3, roller: 1, fencer: 2, prowler: 1 };
/** A big lead takes this many of a pack's places. */
export const COSTS = { mummerking: 2, machine: 2, brute: 2, cart: 2, bell: 2, crab: 1.5, tripod: 2, centipede: 2, marionette: 2, fencer: 2, prowler: 1.5 };
/** The places a kind takes in a pack: a group its group's, a big lead its own, else one. */
export const costOf = (k) => (GROUP[k] ? GROUP_COST[k] ?? GROUP[k] : COSTS[k] ?? 1);
/** The pack's places by stage of the route (docs/design/enemy-roster.md, "Difficulty curve"). */
export const BUDGET = [[1, 2], [2, 3], [3, 5], [4, 5], [5, 6]];
/** Is a kind a ranged or area one (the archetype it is or stands in for)? Early packs hold at most one. */
export const rangedKind = (k) => !!ARCHETYPES[archetypeOfKind(k)]?.ranged && k !== 'blot' && k !== 'grunt';   // (the blot's spit is a teacher's, the grunt's rock its empty hands': not a ranged role)

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
  // (issue #722: the fillers are the world's own, every kind of its roster that may join a pack, a pair or a trio as its
  // group (not a swarm: a flock of skitters leads its own); until then they left out the groups and the big kinds and
  // added a blot everywhere, so the Market's five-foe packs were a lead, a crab and three tutorial blots)
  const fill = Object.fromEntries(Object.entries(early).filter(([k]) => k !== 'shade' && !(GROUP[k] > (GROUP_COST[k] ?? GROUP[k]))));
  if (!Object.keys(fill).length) fill[lead] = 1;
  const late = Object.fromEntries((T.late ?? []).map((a) => [spawnKindOf(a), 2]).filter(([k]) => k));
  return [w, { wild, fill, first: lead, temple: T.temple ?? ['machine'], shade: 0, stage: T.stage ?? 2, late, ...(T.budget ? { budget: T.budget } : {}) }];
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
  const [lo, hi] = R.budget ?? BUDGET[Math.max(0, Math.min(BUDGET.length - 1, R.stage ?? 1))];
  const size = lo + Math.floor(rng() * (hi - lo + 1));
  if (n >= 3 && rng() < R.shade) return ['shade'];
  let lead = pick(R.wild, rng);
  if ((FROM[lead] ?? 0) > n || (R.late?.[lead] && n < 3)) lead = pick(R.fill, rng);
  // a group comes as its group: alone in the first half of the route, with fillers to the stage's places after (v1.22)
  if (GROUP[lead] && (R.stage ?? 1) < 2) return Array(GROUP[lead]).fill(lead);
  const out = GROUP[lead] ? Array(GROUP[lead]).fill(lead) : [lead];
  let ranged = rangedKind(lead) ? 1 : 0;
  // the places left filled from the world's own roster, each filler taking its own places (a big one two, a pair two; the
  // last may run half a place over: a crab for the Market's last place, which has no kind of one place); early, a group
  // never fills and at most one ranged kind comes
  const early = (R.stage ?? 1) < 2;
  for (let left = size - costOf(lead); left >= 1 - 1e-9;) {
    const fits = Object.entries(R.fill).filter(([k]) => costOf(k) <= left + 0.5 + 1e-9 && !(early && GROUP[k]) && !((R.stage ?? 1) <= 1 && ranged >= 1 && rangedKind(k)) && (FROM[k] ?? 0) <= n);
    if (!fits.length) break;
    const k = pick(Object.fromEntries(fits), rng);
    if (rangedKind(k)) ranged++;
    out.push(...Array(GROUP[k] ?? 1).fill(k));
    left -= costOf(k);
  }
  return out;
}

/** The kind in a temple's room i (the first room past the entrance is 1). */
export function templeKind(levelId, i) {
  const t = rosterOf(levelId).temple;
  return t[(i - 1 + t.length) % t.length];
}

/** The archetypes a world fields (its table's, placed ones too), in its table's order. */
export const worldArchetypes = (w) => (WORLDS[w] ? [...new Set([...Object.keys(WORLDS[w].roster), ...(WORLDS[w].placed ?? []), ...(WORLDS[w].sites ?? [])])] : []);
