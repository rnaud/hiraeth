// The worlds' names and the route's order, with no imports: the title screen and
// the save slots (src/save-slots.js) show them before any world, story or game
// state is loaded. levels/index.js and levels/content.js take them from here.

export const TITLES = {
  desert: 'The Desert',
  incal: 'The City-Shaft',
  arzach: 'Vael',
  arzach2: 'Vael II: The Sky Stones',   // (merged into Vael: MERGED below)
  garage: 'The Sealed Hangar',          // (dismissed: DISMISSED below)
  buried: 'The Buried Machine',
  edena: 'Viridel',
  spheres: 'The Garden of Spheres',
  perdide: 'Lorn',
  perdide2: 'Lorn II: The Deep Wood',   // (merged into Lorn)
  bazaar: 'The Signal Market',
  waterfall: 'The City Behind the Waterfall',
  atelier: 'The Atelier',               // (dismissed)
  mangrove: 'The White Mangrove',
  saltharbour: 'The Salt Harbour',
  antennas: 'The Forest of Antennas',
  home: 'Home',
  lantern: 'The Lantern',
  glassdunes: 'The Glass Dunes',
  underwater: 'The Underwater City',
  eclipse: 'The City During the Eclipse',
  fallenring: 'The Fallen Ring',
  moonfoundry: 'The Moon Foundry',
  underside: 'The Underside',
  spacecity: 'The City Floating in Space',
  overnighttrain: 'The Overnight Train',
};

// the route, world by world (src/story/route.js). The wings come first (Vael's Aerie, the second world,
// where the winds lift them); the City-Shaft's Warden's Well gives them their bellows in the middle. (The
// jets are debug-only since v1.38: no world on the route needs them.)
// (October 2026, the author's level changes: Vael and Vael II became one world, Lorn and Lorn II too; the
// Sealed Hangar left the route for the Glass Dunes, which took its temple: MERGED, DISMISSED, PARTS below.)
export const ORDER = ['desert', 'arzach', 'perdide', 'edena', 'underwater', 'incal', 'glassdunes', 'buried', 'moonfoundry', 'spheres', 'spacecity', 'bazaar'];
// the worlds off the route: never needed on the way home (no story to follow). All seven are DISCARDED, so the
// ship's map charts none of them (CHARTED_SIDE is empty)
export const SIDE = ['mangrove', 'waterfall', 'saltharbour', 'antennas', 'eclipse', 'fallenring', 'underside'];
// the discarded worlds (the author's decision, 2026-10-18, #503): the seven side worlds, built in a rush in October
// 2026 and never vetted or finished, are given up. They stay as they are, reachable from the debug menu only (the
// worlds list (Debug), the dev menu and ?level=<id>): off the galactic map (CHARTED_SIDE) and the Sightings page,
// left out of the QC, audit and bench sweeps, and they get no work unless the author asks for it. Unlike a DISMISSED
// world (below) they keep their place in the Debug menu and their code where it is.
export const DISCARDED = ['mangrove', 'waterfall', 'saltharbour', 'antennas', 'eclipse', 'fallenring', 'underside'];
/** Was this world discarded (debug menu only, never shown to players, left out of the sweeps)? */
export const isDiscarded = (id) => DISCARDED.includes(id);
// the sub-levels: places off the ship's map, reached by a way through from a route world's quest, with the world they
// belong to (the Overnight Train: the Signal Market's night halt, its bell; the night mail, src/story/night-train.js).
// Not on the route, not on the map; ?level=<id> and the worlds list still open them.
export const SUB = { overnighttrain: 'bazaar' };
/** Is this a sub-level (reached from another world, not by the ship)? */
export const isSub = (id) => Object.hasOwn(SUB, id);
// the detours a player sees on the galactic map: the ones off the route that are not discarded (none now)
export const CHARTED_SIDE = SIDE.filter((id) => !isDiscarded(id));
// a world that follows another's story is only charted once that one is done (Vael II waited for the bird's
// promise until it became part of Vael: none now; src/story/route.js still reads it)
export const AFTER = {};

// ---------------------------------------------------------------------------
// Merged and dismissed worlds (docs/systems/worlds.md, "Merged and dismissed worlds"). Nothing is deleted:
//
//  - a MERGED world's id became an alias of the world it joined: Vael II's sky stones are Vael's now, north
//    of its plain over the cloud; Lorn II's Deep Wood is Lorn's, south of its crystal swamp. Its people,
//    quests, temple, trial, makers' run, court, boxes and flags keep their ids (`arzach2.*`, `perdide2.*`):
//    they are a PART of the world that carries them (PARTS). Data kept world by world (the boxes, the
//    trials, the courts, the shops, the people book…) still says `arzach2`; what is loaded for a world reads
//    its parts' (partsOf).
//  - a DISMISSED world left the route and the Debug menu; its code lives in src/levels/dismissed/ (its
//    level, story, people and props), built by its tests, kept to reuse. Its replacement is where a save
//    left there wakes up (null: the world the ship last flew to). The Sealed Hangar's temple, the First
//    Garage, moved to the Glass Dunes with its court, its boxes, its trial and its makers' run; the Atelier
//    was a page off the route nobody was led to.
// A save sitting in a merged or dismissed world loads into its replacement (worldFor; src/save-migrate.js).
// ---------------------------------------------------------------------------

/** world id → the world it became part of */
export const MERGED = { arzach2: 'arzach', perdide2: 'perdide' };
/** world id → the world a save left there wakes up in (null: the ship's last world) */
export const DISMISSED = { garage: 'glassdunes', atelier: null };
/** a world's parts: the old worlds whose story it carries, its own first */
export const PARTS = { arzach: ['arzach', 'arzach2'], perdide: ['perdide', 'perdide2'] };
/**
 * Where a part's own coordinates sit in the world that carries it ([dx, dy, dz], added): Vael's plain lies south
 * of the sky stones over the cloud, its lone tower where theirs stood, 38 m up on their plain; the Deep Wood
 * lies south of Lorn's crystal swamp, its island where the wood begins. The other parts keep their coordinates. A part's data that names places
 * (its boxes, its court, its trial, its people, its temple's site) is shifted by it when loaded (shiftAt).
 */
export const PART_OFFSET = { arzach: [-190, 38, -1080], perdide2: [0, 0, -480] };
/** A part's offset ([0, 0, 0] if it keeps its coordinates). */
export const offsetOf = (part) => PART_OFFSET[part] ?? [0, 0, 0];
/** A place in a part's own coordinates, where it is in its world: [x, z] or [x, y, z] (a y that is not a number is kept). */
export function shiftAt(part, p) {
  const o = PART_OFFSET[part];
  if (!o || !Array.isArray(p)) return p;
  if (p.length === 2) return [p[0] + o[0], p[1] + o[2]];
  return [p[0] + o[0], typeof p[1] === 'number' ? p[1] + o[1] : p[1], p[2] + o[2]];
}
/** The parts of a world (itself, unless it carries others). */
export const partsOf = (id) => PARTS[id] ?? [id];
/** The world a part belongs to (itself, unless it was merged). */
export const partOf = (id) => MERGED[id] ?? id;
/** Was this world dismissed? */
export const isDismissed = (id) => Object.hasOwn(DISMISSED, id);
/**
 * The world an id is played in now: a merged world's, a dismissed world's replacement (or `fallback` when it
 * has none), else itself.
 */
export function worldFor(id, fallback = 'desert') {
  if (id == null) return id;
  if (MERGED[id]) return MERGED[id];
  if (isDismissed(id)) return DISMISSED[id] ?? fallback;
  return id;
}
/**
 * Every part on the route, in route order: the old worlds whose people, quests and temples the route
 * still carries (the eleven places a world was kept for: a temple, a trial, a makers' run, a shop each).
 */
export const ROUTE_PARTS = ORDER.flatMap(partsOf);
