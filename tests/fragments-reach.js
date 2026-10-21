// The walker's reach for the fragments of the singing light (src/fragments-data.js; docs/systems/fragments.md):
// a flood over the ground from a world's spawn, step by step as tests/playthrough-agent.js walkTo steps (a cell
// at a time, up what a double jump climbs, down what a fall doesn't hurt, with room to stand), and the checks a
// fragment's spot must pass. Shared by tests/fragments.test.js and scripts/fragment-spots.mjs.
import * as THREE from 'three';
import { LAYOUT as SPHERES } from '../src/levels/spheres.js';
import { COURT, HUNG, HUNG2, CRADLE, BOWL, PMOON, HOIST } from '../src/levels/moon-foundry.js';
import { ROAD as PILGRIMS_ROAD } from '../src/desert-road.js';
import { FRAGMENT_MARKERS, markerName } from '../src/fragment-markers.js';
import { FRAGMENT_LANDMARKS, LANDMARK_KINDS, landmarkName, landmarkSpot, onLandmarkTop } from '../src/fragment-landmarks.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0), DOWN = V(0, -1, 0);
const _rc = new THREE.Raycaster();
/** How high a step up may be: a plain jump, the lift valve's double jump (tests/playthrough-agent.js RISE). */
export const RISE = { jump: 1.4, doublejump: 4.8 };
/** The flood's cell (m), world by world: 1 m where the way up is a narrow stair a 2 m grid steps off (the floating city's
 * stack, the broken moon's street and spiral: v1.61, #228). Desert's new berth shifts the grid phase; its cairn
 * shoulder also needs 1 m samples to resolve the valid double-jump landing, else 2 m skips it (v1.92, #603). */
export const REACH_CELL = { desert: 1, spacecity: 1, moonfoundry: 1 };
export const reachCell = (id) => REACH_CELL[id] ?? 2;

/**
 * Every spot reached from `from` (a spot, or several: a merged world's parts' spawns): [[x, y, z, steps, inside]] (inside: through a doorway, a room of its own). With `targets` ([Vector3]) it stops once each is within
 * `near` m of a spot reached, and says which were: { reached: [bool], nodes }.
 * (With targets it goes toward them first, the spot nearest a target not yet reached each time, by the same steps: a
 * target it reaches is reached. Only when one is left is the whole flood run, wave by wave, for the verdict as it was:
 * breadth first, the fragments' check walked most of each world, 67 million rays and 2.5 minutes for the twelve.)
 */
export function flood(world, from, options = {}) {
  if (!options.targets) return floodFrom(world, from, options);
  const guided = floodFrom(world, from, options, true);
  return guided.reached.every(Boolean) ? guided : floodFrom(world, from, options);
}

/** A binary heap of items by priority, least first. */
class Heap {
  constructor() { this.items = []; this.keys = []; }
  get size() { return this.items.length; }
  push(item, key) {
    const I = this.items, K = this.keys; let i = I.length; I.push(item); K.push(key);
    while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= key) break; I[i] = I[p]; K[i] = K[p]; i = p; }
    I[i] = item; K[i] = key;
  }
  pop() {
    const I = this.items, K = this.keys, top = I[0], item = I.pop(), key = K.pop(), n = I.length;
    if (n) {
      let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && K[c + 1] < K[c]) c++; if (K[c] >= key) break; I[i] = I[c]; K[i] = K[c]; i = c; }
      I[i] = item; K[i] = key;
    }
    return top;
  }
}

function floodFrom({ physics, level }, from, { cell = 2, rise = RISE.doublejump, drop = 6, radius = 700, max = 1500000, targets = null, near = 2.5, swim = true, slope = 0.7 } = {}, guided = false) {
  const key = (x, y, z) => `${Math.round(x / cell)},${Math.round(z / cell)},${Math.round(y / 4)}`;
  const starts = [from].flat();
  const seen = new Set(starts.map((s) => key(s.x, s.y, s.z)));
  const q = starts.map((s) => [s.x, s.y, s.z, 0, false]);
  const edge = (level.limit ?? 1900) - 4;   // (the world's edge: the traveller is turned back there, src/player.js keepInside)
  const far = (x, z) => Math.max(Math.abs(x), Math.abs(z)) > edge || starts.every((s) => Math.hypot(x - s.x, z - s.z) > radius);
  const portals = (level.portals ?? []).filter((p) => p.at && p.to && (!p.when || p.when()));
  const hit = targets ? targets.map(() => false) : null;
  let left = targets?.length ?? 0;
  const touch = (x, y, z) => {
    for (let i = 0; i < targets.length; i++) {
      if (hit[i]) continue;
      const t = targets[i];
      if (Math.hypot(t.x - x, t.z - z) < near && Math.abs(t.y - y) < 1.6) { hit[i] = true; left--; }
    }
  };
  if (targets) for (const s of starts) touch(s.x, s.y, s.z);
  let n = 0;
  // (guided: the spots nearest a target not yet reached first, a heap on that distance; the same steps)
  const aim = (x, z) => { let m = Infinity; for (let i = 0; i < targets.length; i++) if (!hit[i]) m = Math.min(m, Math.hypot(targets[i].x - x, targets[i].z - z)); return m; };
  const heap = guided ? new Heap() : null;
  if (guided) for (const s of q.splice(0)) heap.push(s, 0);
  const take = () => guided ? heap.pop() : q[n];
  while ((guided ? heap.size : n < q.length) && n < max && (!targets || left > 0)) {
    const [cx, cy, cz, d, inside] = take(); n++;
    const next = [];
    // (the rays down start under the ceiling over you: from inside a glass tube, its roof is not a floor to step onto)
    const top = Math.min(rise + 0.2, physics.rayDistance(V(cx, cy + 0.3, cz), UP, rise + 1) + 0.15);
    for (const [dx, dz] of [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]) {
      const x = cx + dx, z = cz + dz;
      if (far(x, z)) continue;
      // (two ways on: level or down, from just over your feet, and up onto what is there, from under your ceiling: a tube's
      // floor and its roof are both at the tube's mouth)
      const level0 = physics.groundAt(x, cy + 0.6, z, 0.6 + drop), up0 = physics.groundAt(x, cy + top, z, top + drop);
      for (const g of new Set([level0, up0])) {
      if (!Number.isFinite(g) || g - cy > rise || cy - g > drop) continue;
      // (only what you can stand on: a dome's or a dune's steep flank is slid down, not stood on, so not climbed a step at a time)
      if (slope && g - cy > 0.6 && (physics.groundNormal(x, g + 0.5, z).y < slope)) continue;
      // (no walking through a wall: a glass tube's side, a house's: across at chest height over the higher of the two floors)
      { const h = Math.max(cy, g) + 0.9; if (physics.rayDistance(V(cx, h, cz), V(dx, 0, dz).normalize(), cell) < cell) continue; }
      // (and no climbing through your own ceiling: a room's roof, a dome's glass seen from inside, is not a step up)
      if (g - cy > 0.6 && physics.rayDistance(V(cx, cy + 0.3, cz), UP, g - cy + 1.6) < g - cy + 1.5) continue;
      if (physics.rayDistance(V(x, g + 0.3, z), UP, 1.9) < 1.5) continue;
      if (!swim && level.unsafe?.(V(x, g, z))) continue;   // (swim: deep water is crossed swimming, as Lorn's is)
      if (Number.isFinite(level.killY) && g < level.killY) continue;
      next.push([x, g, z, inside]);
      }
    }
    // (a doorway into a room of its own, a temple or a shop built far overhead, leads inside; a lock or a lift out into
    // the world, the Underwater City's divers' lock onto the seabed, doesn't)
    for (const p of portals) if (Math.hypot(cx - p.at.x, cz - p.at.z) < p.r + cell && Math.abs(cy - p.at.y) < 2.5) next.push([p.to.x, p.to.y, p.to.z, inside || !!p.temple || Math.abs(p.to.y - p.at.y) > 300]);
    for (const [x, y, z, inn] of next) {
      const k = key(x, y, z);
      if (seen.has(k)) continue;
      seen.add(k);
      if (targets) touch(x, y, z);
      if (guided) heap.push([x, y, z, d + 1, inn], aim(x, z)); else q.push([x, y, z, d + 1, inn]);
    }
  }
  return targets ? { reached: hit, nodes: n } : q;
}

/**
 * A fragment's spot (on the ground, `p.y` the ground's height): solid ground just under it, near level, room over
 * it to stand, out of the water and the world's other harm. Returns why not, or null.
 */
export function spotWhyNot({ physics, level }, p) {
  const g = physics.groundAt(p.x, p.y + 1.5, p.z, 4);
  if (!Number.isFinite(g) || Math.abs(g - p.y) > 0.7) return `no ground under it (${Number.isFinite(g) ? (g - p.y).toFixed(2) : 'none'})`;
  if (physics.groundNormal(p.x, g + 1, p.z).y < 0.75) return 'on a slope';
  // (room for the feet: the same ground a step round it, not the top of a post or a rail)
  for (const [dx, dz] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]]) {
    const h = physics.groundAt(p.x + dx, g + 1, p.z + dz, 2);
    if (!Number.isFinite(h) || Math.abs(h - g) > 0.5) return 'no footing round it';
  }
  if (physics.rayDistance(V(p.x, g + 0.3, p.z), UP, 2) < 1.9) return 'no room over it';
  if (level.unsafe?.(V(p.x, g, p.z))) return 'in harm’s way';
  return null;
}
export const spotOk = (W, p) => !spotWhyNot(W, p);

/** How near air a spot out in the sea must be (m): the helmet's 20 s run out there and back (the Underwater City, v1.56). */
export const AIR_NEAR = 35;
/**
 * A world under the sea (`level.sea`): a spot under the glass of a hall, or out on the seabed within AIR_NEAR m of air
 * (a bell, a café, a lock's drum: `level.air`), where the helmet's air takes you and back. Returns why not, or null.
 */
export function seaWhyNot({ physics, level }, p) {
  if (!level.sea || physics.rayDistance(V(p.x, p.y + 0.3, p.z), UP, 400) !== Infinity) return null;
  if (!level.air) return 'out in the sea, not under the glass';
  for (let r = 0; r <= AIR_NEAR; r += 5) for (let k = 0; k < (r ? 16 : 1); k++) {
    const a = (k / 16) * Math.PI * 2;
    if (level.air(p.x + Math.cos(a) * r, p.y + 1.2, p.z + Math.sin(a) * r)) return null;
  }
  return `out in the sea, over ${AIR_NEAR} m from air`;
}

/**
 * The real traveller (src/player.js) set down a metre over the spot: does he come to stand on it, close enough to take
 * it? (A post's top, an arch's crown, a lip too narrow for his feet, or rising air, and he slides off or is lifted.)
 * `Player` is passed in (the module is heavy to load for the flood's users who don't need it). → why not, or null.
 */
export function standWhyNot({ physics, level }, p, Player) {
  const P = new Player(physics, { unsafe: level.unsafe, health: false, spawn: p.clone() });
  P.respawn(new THREE.Vector3(p.x, p.y + 1, p.z));
  P.onGround = false;
  for (let f = 0; f < 90 && !(P.onGround && f > 20); f++) P.update(1 / 60, {}, 0);
  const off = Math.hypot(P.pos.x - p.x, P.pos.z - p.z), up = P.pos.y - p.y;
  if (!P.onGround || off > 1.2 || Math.abs(up) > 0.6) return `the traveller set down on it ends ${off.toFixed(1)} m off, ${up.toFixed(1)} m up${P.onGround ? '' : ', not standing'}`;
  return null;
}

// The new country, world by world (v1.61, #228; scripts/fragment-spots.mjs scores it, tests/route-worlds.test.js counts it): the level's sights (`level.sights`) whose names are its explorations' pieces (v1.55–
// v1.57), and how near one a spot must be to count as in it (m). The places built to be found.
export const NEW_COUNTRY = {
  arzach: { r: 40, sights: /stone ear|hour stone|broken slab|highest stone|stone that rises|table of the plain|riders’ shrine|riders’ gate/ },
  perdide: { r: 45, sights: /keepers’ (huts|winch|lookout|stair)|cap square|bridge over the lit path|egg isle|heron|drowned|root gate/ },
  edena: { r: 45, sights: /round ship|dish pond|split meteor|builders’ machine|old pyramid|nursery|great pyramids|water stair|seed-drill|Greenhouse water/ },
  underwater: { r: 40, sights: /pod tower|sunken cart|bridge over the canyon|far wall|whale bones|window over the deep/ },
  moonfoundry: { r: 40, sights: /street’s top|crown|signal box|hoist tower|footbridge|steps down|cracked mould/ },
  spheres: { r: 45, sights: /causeway|stepping|furrow|crater|cracked|pillar|walkway|belvedere/i },
  spacecity: { r: 35, sights: /underhouses|capstan|parted|stack|roof street|cables under|anchor/ },
  // (and Kip's skybridge, which the sign painters' gallery runs on to since v1.56: src/market-air.js KIP_BRIDGE)
  bazaar: { r: 30, sights: /gallery|mast|first stall|round grille|screen-mender|biggest set/, also: [[20, 25, -90]] },
};
/** A world's new country: the sights of its explorations (`level.sights`, named in NEW_COUNTRY, and its `also` points) and whether a spot is near one. */
export function newCountry(level, id) {
  const def = NEW_COUNTRY[id];
  const at = (p) => (Array.isArray(p) ? p : p?.isVector3 ? [p.x, p.y, p.z] : p?.at ? at(p.at) : null);
  const sights = def ? [...((typeof level.sights === 'function' ? level.sights() : level.sights) ?? []).filter((s) => def.sights.test(s.name)).map((s) => at(s.at)).filter(Boolean), ...(def.also ?? [])] : [];
  // (near in 3D, height counting half again: a deck 40 m over a sight is not beside it)
  const isNew = (x, y, z) => sights.some((s) => Math.hypot(s[0] - x, (s[1] - y) * 1.5, s[2] - z) < def.r);
  return { sights, isNew };
}

// The points of interest (issue #250: "Fragments of the singing light should often be within points of interest or at
// the top of structures hard to climb. Like at the top of the big temples in the sphere levels, or within the skeletons
// in the desert level."). scripts/fragment-spots.mjs scores them, tests/fragments-poi.test.js counts them. A spot is in
// or on one when it lies
//   - by a sight of the level (`level.sights`, the level design audit's places to stop for): within SIGHT_R m of it,
//     and within SIGHT_DY m of its height;
//   - up a beacon (`level.beacons`: a mast, a lamp, a tower's top seen from far): within BEACON_R m of it, in the top
//     two fifths of its height (not at its foot);
//   - inside a named thing's bounds, its box in the world (a ribcage, the leviathan, a giant's bones, a canopy, a stack:
//     the scene's objects named in POI_THINGS) or one of the level's own big pieces (POI_PIECES: the Garden's spheres
//     and pyramids), its top included;
//   - or on a summit: the topmost ground there, standing SUMMIT_DROP m and more over the ground SUMMIT_OUT m round it
//     in most directions (the top of something tall, not a ledge under a cliff).
export const SIGHT_R = 12, SIGHT_DY = 8, BEACON_R = 8, SUMMIT_DROP = 15, SUMMIT_OUT = [12, 24];
/** The scene's named things that count as places, world by world (their names: the scene's object names). */
// Match the Rose House’s exterior group: its reference rebuild replaces the old wall batch.
// (issue #550, every fragment on a named place: the worlds' houses, halls and islands the walker reaches added, where
// their sights alone held too few: Vael's Aerie and Belfry, Lorn's Lamp-House and Hush-House, the Rim Docks' berth and
// the Warden's Well on the City-Shaft's rim, the Buried Machine's Engine-House and port, the Moon Foundry's
// Casting-House, the Footprint in the Garden of Spheres, the Floating city's islands)
export const POI_THINGS = {
  desert: /^(Ribcage|Sunken leviathan|Fallen giant|Crashed hull|The giant’s (hand|arm|spine|jaw)|Givers’ Hearth butte|Radio dishes|Umbrella grove|Petal station|Sail tents|Lavender butte|The Rose House)$/,
  arzach: /^(The rider’s roost|The riders’ gate|The great bird’s bones|The slabs tipped out of the plain|The stones that fell up|The tables of the plain over the cloud|The riders’ road: the niches|The riders’ road: the worn steps|The Aerie|The Founders’ Belfry|shopfront\.hoodoo)$/,
  perdide: /^(The cave’s crown|Wendel’s lookout|shroom-top|The keepers’ (stalks|light|canopy \(hut\))|The cap square|The flooded wood \(mound\)|The Lamp-House|The Hush-House|shopfront\.mossdome|Makers’ court \(stun\))$/,
  edena: /^(The round ship’s (hill|tree’s crown)|The dish pond|The split meteor.*|The builders’ machine|The pyramid nursery’s (caps|terrace trees)|The water stair)$/,
  underwater: /^(Whale|The whale overhead)$/,
  incal: /^(Lio’s dispatch (mast|booth)|The lamplighters’ pad|The Warden’s Well|berth body)$/,
  glassdunes: /^(The glass that holds a stopped minute.*|The breaker’s cairn)$/,
  buried: /^(The canyon stack|The Tooth Day posts|The keepers’ gangway|Fisk’s flag|The Engine-House|buried port|The broken oil pipe and the keepers’ lectern|The keepers’ dials and their log)$/,
  moonfoundry: /^(The moon-carrier|The Moon Foundry: the (west|east) crane|The Casting-House)$/,
  spheres: /^(The belvedere’s streamer|The Footprint|shopfront\.pavilion)$/,
  spacecity: /^(the anchor under the Towers|the stack \((low|high)\)|the lamprock|the drifted span|the yard|the garden|the market|The Mooring-House|the gate)$/,
  bazaar: /^(The old market|The screen lanes: the face|bazaar port)$/,
};
/** A level's own big pieces, where the scene doesn't name them: boxes ({ name, min: [x, y, z], max }) balls ({ name, ball: [x, y, z, r], upper }: on it or in it, 2 m round; `upper`: its upper half) or columns. */
export const POI_PIECES = {
  // the Garden of Spheres: its stepped and smooth pyramids, the temples on their tops, and its great spheres (24 m across
  // and more)
  spheres: (level) => [
    // (the white hill's stepped pyramid and its belvedere, the meadow's smooth pyramid, the lake's far-shore temple, its
    // pagoda and dome, and the pyramid beside it: src/levels/spheres.js LAYOUT; the hill's pyramid from over its foot on
    // the hill's top terrace, 27.7 m)
    { name: 'the white hill’s pyramid', min: [SPHERES.hill.x - SPHERES.hillPyr.half, 29, SPHERES.hill.z - SPHERES.hillPyr.half], max: [SPHERES.hill.x + SPHERES.hillPyr.half, 130, SPHERES.hill.z + SPHERES.hillPyr.half] },
    { name: 'the meadow’s pyramid', min: [SPHERES.meadowPyr.x - SPHERES.meadowPyr.half, -5, SPHERES.meadowPyr.z - SPHERES.meadowPyr.half], max: [SPHERES.meadowPyr.x + SPHERES.meadowPyr.half, 45, SPHERES.meadowPyr.z + SPHERES.meadowPyr.half] },
    { name: 'the lake’s temple', min: [SPHERES.lake.x - 26, 2, SPHERES.lake.z - SPHERES.lake.rz - 18], max: [SPHERES.lake.x + 34, 32, SPHERES.lake.z - SPHERES.lake.rz - 4] },
    { name: 'the lake’s pyramid', min: [SPHERES.lake.x - 73, 0, SPHERES.lake.z - SPHERES.lake.rz - 27], max: [SPHERES.lake.x - 43, 30, SPHERES.lake.z - SPHERES.lake.rz + 3] },
    ...(level.spheres?.orbs ?? []).filter((o) => o.R >= 12).map((o, i) => ({ name: `a great sphere (${i + 1})`, ball: [o.x, o.y, o.z, o.R], upper: true })),
  ],
};
// (and columns: { name, column: [x, z, r, y0, y1] }, in it or on it)
// the Desert's pilgrims' road: its cairns of stacked stones, each a marker (src/desert-road.js ROAD), the last two by the
// ship (issue #550: the first fragments by the ship on something, the cairns below the ramp)
POI_PIECES.desert = () => PILGRIMS_ROAD.map(([x, z], i) => ({ name: `the pilgrims’ cairn (${i + 1})`, column: [x, z, 2.2, -60, 200] }));
// the City-Shaft's high ring round the spire, the round plaza at the top terraces' level the bridges run out to
// (src/levels/incal.js: SPIRE_R 24 to SPIRE_RING 48, at LEVELS[0])
POI_PIECES.incal = (level) => { const s = level.shaft; return s ? [{ name: 'the spire’s high ring', column: [0, 0, s.SPIRE_RING + 1, s.LEVELS[0] - 2, s.LEVELS[0] + 6] }] : []; };
POI_PIECES.underwater = (level) => [
  // the Underwater City's towers of pods, out in the sea and down the canyon's walls (their pods stand out round them)
  ...[...(level.podTowers ?? []), ...(level.uw?.canyon?.towers ?? [])].map((t, i) => ({ name: `a tower of pods (${i + 1})`, column: [t.x, t.z, t.r + 2.5, -80, 90] })),
  // the tower of pods inside the great dome, its open decks to climb to
  ...(level.decks ?? []).map((d, i) => ({ name: `a pod deck in the great dome (${i + 1})`, ball: [d.x, d.y ?? 0, d.z, (d.R ?? 3) + 1] })),
];
// the Moon Foundry's moons: the broken moon and its courtyard, the two hung from the roof, the one in its cradle, the
// bowl, the pillar moon and the lookout house under it; and the old hoist tower (src/levels/moon-foundry.js)
POI_PIECES.moonfoundry = () => [
  { name: 'the broken moon', ball: [COURT.x, COURT.yc, COURT.z, COURT.R + 2] },
  { name: 'the moon hung over the floor', ball: [HUNG.x, HUNG.y, HUNG.z, HUNG.R + 2] },
  { name: 'the moon hung at the back', ball: [HUNG2.x, HUNG2.y, HUNG2.z, HUNG2.R + 2] },
  { name: 'the moon in its cradle', ball: [CRADLE.x, CRADLE.yc, CRADLE.z, CRADLE.R + 2] },
  { name: 'the bowl', ball: [BOWL.x, 0, BOWL.z, BOWL.R + 6] },
  { name: 'the pillar moon', column: [PMOON.x, PMOON.z, PMOON.R + 2, 8, PMOON.h + 2 * PMOON.R + 2] },
  { name: 'the hoist tower', column: [HOIST.x, HOIST.z, 7, 8, 84] },
];
// the Signal Market's towers down both sides of the street: on them, 4 m up and more (their service balconies, their
// ledges; the pavement at their feet is the street's), out to 4 m from their faces (src/levels/bazaar.js streetTowers)
POI_PIECES.bazaar = (level) => (level.streetTowers ?? []).map((t, i) => ({ name: `a tower over the street (${i + 1})`,
  min: [t.x - t.w / 2 - 4, 4, t.z - 22], max: [t.x + t.w / 2 + 4, t.h + 14, t.z + 22] }));
/** Every point of interest of a built world ({ scene, level }) whose id is `id`: [{ kind, name, test(x, y, z) }]. */
export function pointsOfInterest({ scene, level }, id) {
  const out = [];
  const at = (p) => (Array.isArray(p) ? p : p?.isVector3 ? [p.x, p.y, p.z] : p?.at ? at(p.at) : null);
  for (const s of (typeof level.sights === 'function' ? level.sights() : level.sights) ?? []) {
    const a = at(s.at); if (!a) continue;
    out.push({ kind: 'sight', name: s.name, at: a, test: (x, y, z) => Math.hypot(x - a[0], z - a[2]) < SIGHT_R && Math.abs(y - a[1]) < SIGHT_DY });
  }
  for (const b of (typeof level.beacons === 'function' ? level.beacons() : level.beacons) ?? []) {
    const t = at(b.top); if (!t || !(b.height > 0)) continue;
    out.push({ kind: 'beacon', name: b.name, at: t, test: (x, y, z) => Math.hypot(x - t[0], z - t[2]) < BEACON_R && y > t[1] - b.height * 0.4 && y < t[1] + 1.5 });
  }
  const box = (kind, name, min, max) => out.push({ kind, name, at: [(min[0] + max[0]) / 2, max[1], (min[2] + max[2]) / 2], min, max,
    test: (x, y, z) => x > min[0] - 1 && x < max[0] + 1 && z > min[2] - 1 && z < max[2] + 1 && y > min[1] - 1 && y < max[1] + 1.5 });
  const named = POI_THINGS[id];
  if (named && scene) {
    scene.updateMatrixWorld(true);
    const b = new THREE.Box3(), seen = new Map();
    scene.traverse((o) => {
      if (!o.name || !named.test(o.name)) return;
      b.setFromObject(o);
      // (several of one name, the desert's six ribcages: each its own place, numbered)
      const n = (seen.get(o.name) ?? 0) + 1; seen.set(o.name, n);
      if (!b.isEmpty()) box('thing', n > 1 ? `${o.name} (${n})` : o.name, b.min.toArray(), b.max.toArray());
      // (issue #550: on it, not on the ground inside its box: the ground just under the spot is the thing's own)
      if (!b.isEmpty()) out.at(-1).on = (x, y, z) => { _rc.set(new THREE.Vector3(x, y + 0.6, z), DOWN); _rc.far = 1.2; return _rc.intersectObject(o, true).length > 0; };
    });
  }
  // (and the markers set for the fragments, issue #550: each a place of its own, a prop under one fragment)
  const markers = (FRAGMENT_MARKERS[id] ?? []).map(([x, y, z], i) => ({ name: markerName(i), column: [x, z, 1.4, y - 1, y + 2.5], marker: true }));
  for (const p of [...(POI_PIECES[id]?.(level) ?? []), ...markers]) {
    if (p.column) {
      const [cx, cz, r, y0, y1] = p.column;
      out.push({ kind: 'piece', name: p.name, at: [cx, y1, cz], column: true, marker: !!p.marker, test: (x, y, z) => Math.hypot(x - cx, z - cz) < r && y > y0 && y < y1 });
      continue;
    }
    if (!p.ball) { box('piece', p.name, p.min, p.max); continue; }
    const [bx, by, bz, r] = p.ball;
    // (`upper`: on its upper half only, a sphere's top, not the grass at its foot)
    out.push({ kind: 'piece', name: p.name, at: [bx, by + r, bz], test: (x, y, z) => Math.hypot(x - bx, y - by, z - bz) < r + 2 && (!p.upper || y > by) });
  }
  // (and the landmarks set for them, issue #550's third pass: a roof with a way up, a square's middle; each a place of
  // its own, src/fragment-landmarks.js; in it as far as half a metre round its top and a metre over or under)
  (FRAGMENT_LANDMARKS[id] ?? []).forEach((L, i) => out.push({ kind: 'piece', name: landmarkName(id, i), at: landmarkSpot(L), landmark: L,
    roof: !!LANDMARK_KINDS[L.kind].roof, test: (x, y, z) => onLandmarkTop(L, x, y, z, -0.5, 1) }));
  return out;
}
/** On a summit: the topmost ground at x, z, and in 6 of 8 directions the ground SUMMIT_OUT m off SUMMIT_DROP m and more under it (or none). */
export function onSummit(physics, x, y, z) {
  const top = physics.groundAt(x, y + 200, z, 400);
  if (!Number.isFinite(top) || top - y > 0.6) return false;
  let low = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (SUMMIT_OUT.every((r) => { const g = physics.groundAt(x + Math.cos(a) * r, y + 2, z + Math.sin(a) * r, 400); return !Number.isFinite(g) || y - g >= SUMMIT_DROP; })) low++;
  }
  return low >= 6;
}
// Issue #550, its second pass (seven on one port's apron, six round one house, ten on one ring "don't read as placed",
// and leave the rest of the world empty): a fragment is ON its place, a place holds two at most (three a very big one),
// and none lies in water or flat on an open floor unless a prop is under it (src/fragment-markers.js: a cairn, a
// plinth, set where a world has no landmark left where one should go).
/** How many fragments one place holds: two, three for a very big one (the Rose House, the Floating city's islands, the spire's ring). */
export const PLACE_CAP = 2;
export const BIG_PLACES = { desert: /^The Rose House/, spacecity: /^(the yard|the garden|the market|the gate)$/, incal: /^the spire’s high ring$/ };
export const placeCap = (id, name) => (BIG_PLACES[id]?.test(name ?? '') ? 3 : PLACE_CAP);
/** The named things whose top is a floor (a port's apron, an island's deck, a sunken street, a court): on them only raised. */
export const FLOOR_THINGS = /^(buried port|bazaar port|The old market|The screen lanes: the face|the yard|the garden|the market|the gate|The flooded wood.*|Makers’ court.*)$/;
/** By a sight, within this of its mark (m): at it, not out on the ground round it. */
export const SIGHT_CORE = 5;
/** Raised: the ground falls `rise` m and more within 3 m of it in two directions of eight at least (a roof, a ledge, a step, a top). */
export function raised(physics, x, y, z, rise = 1.2) {
  let n = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, g = physics.groundAt(x + Math.cos(a) * 3, y + 0.5, z + Math.sin(a) * 3, 40);
    if (!Number.isFinite(g) || y - g >= rise) n++;
  }
  return n >= 2;
}
/**
 * Is a spot on its place (issue #550: "the top of a building, or the center of a point of interest"): by a sight,
 * within SIGHT_CORE m of its mark; a named thing, on it (the ground under the spot its own: a roof, a deck, a terrace;
 * a floor-like one only where it is raised) or in its middle (inside a ribcage, among bones and posts); a beacon, a
 * piece of the level or a marker, in it as its test says. Never a bare summit.
 */
export function onPlace(p, x, y, z, physics = null) {
  if (!p || p.kind === 'summit' || FLAT_SIGHTS.test(p.name)) return false;
  if (p.marker) return true;
  // (on a roof, or a square's middle, set for it: on its top, the ground under the spot that top, issue #550)
  if (p.landmark) return onLandmarkTop(p.landmark, x, y, z) && (!physics || Math.abs(physics.groundAt(x, y + 1.5, z, 4) - y) < 0.3);
  // (and never out on the bare ground round it: raised, or something of it within reach, a wall, a stone, a post)
  const held = () => !!physics && (raised(physics, x, y, z) || byProp(physics, x, y, z));
  if (p.kind === 'sight') return Math.hypot(p.at[0] - x, p.at[2] - z) <= SIGHT_CORE && held();
  if (p.kind === 'thing') {
    if (FLOOR_THINGS.test(p.name.replace(/ \(\d+\)$/, ''))) return !!p.on?.(x, y, z) && !!physics && raised(physics, x, y, z);
    // (on it; in its middle by something; or on a top of it, a deck or a ledge 3 m and more over the ground round it)
    return !!p.on?.(x, y, z) || (Math.abs(x - p.at[0]) < (p.max[0] - p.min[0]) / 4 && Math.abs(z - p.at[2]) < (p.max[2] - p.min[2]) / 4 && held())
      || (!!physics && raised(physics, x, y, z, 3));
  }
  if (p.column) return held();
  return true;
}
/** The sights that are a stretch of open ground (a salt pan): nothing there to stand a fragment on. */
export const FLAT_SIGHTS = /^the salt pan$/;
/** Something within reach of the spot at waist height (2.2 m: a wall, a stone, a post, a rail), in any direction. */
export function byProp(physics, x, y, z, r = 2.2) {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (physics.rayDistance(new THREE.Vector3(x, y + 0.6, z), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), r) < r) return true;
  }
  return false;
}
export const central = onPlace;
/** In water (`waters`: src/water.js Waters): a surface over the spot's ground (a sea, the Underwater City's, aside). */
export function wetAt(waters, x, y, z) {
  const s = waters?.surfaceAt?.(x, z, y + 0.1, 0.5);
  return !!(s && !s.body?.sea && s.y > y + 0.03);
}
/** The point of interest a spot is in or on (the first that has it, a summit last), or null. */
export function poiAt(pois, physics, x, y, z) {
  return pois.find((p) => p.test(x, y, z)) ?? (onSummit(physics, x, y, z) ? { kind: 'summit', name: 'a summit' } : null);
}
