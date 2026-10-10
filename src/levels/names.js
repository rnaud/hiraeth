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
// where the winds lift them); the jets wait in the later half (the City-Shaft's Warden's Well), and the
// worlds that want them (the Glass Dunes' First Garage, the Buried Machine, the Signal Market) come after it.
// (October 2026, the author's level changes: Vael and Vael II became one world, Lorn and Lorn II too; the
// Sealed Hangar left the route for the Glass Dunes, which took its temple: MERGED, DISMISSED, PARTS below.)
export const ORDER = ['desert', 'arzach', 'perdide', 'edena', 'underwater', 'incal', 'glassdunes', 'buried', 'moonfoundry', 'spheres', 'spacecity', 'bazaar'];
// the worlds off the route: on the ship's map from the start, never needed on the way home (no story to follow)
export const SIDE = ['mangrove', 'waterfall', 'saltharbour', 'antennas', 'eclipse', 'fallenring', 'underside'];
// the worlds still being made: built in a rush in October 2026 and never vetted or finished. The galactic
// map leaves them off (CHARTED_SIDE) and the Sightings page leaves their slots out; the worlds list (Debug)
// and the dev menu still open them, and ?level=<id>. A world leaves this list once it has been played
// through and signed off, and it is charted on the map from then on.
export const WIP = ['mangrove', 'waterfall', 'saltharbour', 'antennas', 'eclipse', 'fallenring', 'underside'];
/** Is this world still being made (not shown to players)? */
export const isWip = (id) => WIP.includes(id);
// the sub-levels: places off the ship's map, reached by a way through from a route world's quest, with the world they
// belong to (the Overnight Train: the Signal Market's night halt, its bell; the night mail, src/story/night-train.js).
// Not on the route, not on the map; ?level=<id> and the worlds list still open them.
export const SUB = { overnighttrain: 'bazaar' };
/** Is this a sub-level (reached from another world, not by the ship)? */
export const isSub = (id) => Object.hasOwn(SUB, id);
// the detours a player sees on the galactic map: the ones off the route that are finished
export const CHARTED_SIDE = SIDE.filter((id) => !isWip(id));
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
