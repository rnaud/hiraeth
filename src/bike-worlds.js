import { Hoverbike } from './bike.js';

// The hoverbike in the worlds after the desert (issue #86: "the hover bike should be available on other planets if I
// get it"). Found in the desert (desert.bike.found: Marrow's, under the tarp in the red-rag hollow, woken with a full
// tank: src/story/desert-bike.js), it comes along in the ship's hold, and in a world where riding makes sense it is
// brought out and stands by the ramp when you land: called from your pack (E, or the pad's call button) it comes over as
// in the desert. Where Vael's bird has promised to answer (src/bird.js birdAnswers: open sky, no mount of the world's own),
// she keeps the call and the bike stands by the ship to be boarded. docs/systems/vehicles.md, "The hoverbike in
// other worlds"; tests/bike-worlds.test.js.
//
// World by world (the route, src/levels/names.js ORDER, and the places off it a player reaches):
//   desert       its own (found there)            arzach (Vael)   her bird, its own mount
//   perdide      the skiff, its own (water)       edena (Viridel) yes: open meadows round the ruins
//   underwater   no: domes joined by tubes under the sea
//   incal        no: a city down a shaft's terraces, its cabs to carry you
//   glassdunes   yes: the sand valley between the glass walls
//   buried       yes: the dunes over the machine, the ramp and the trench
//   moonfoundry  no: a workshop's floor among its benches, rails and gantries
//   spheres      yes: the meadow, the avenue and the lake shore
//   spacecity    no: small islands over the void
//   bazaar       no: streets and stairs, its cabs to carry you
//   home, lantern, arena, the train, the worlds still being made: no (a village and a hill, one small island, a ring,
//   a train's roofs; the unfinished worlds are not shown to players)
// Interiors anywhere (rooms off the map) refuse the call already (main.js canSummon).

/** The worlds the bike is brought out in, and why (the rest walk: see above). */
export const BIKE_WORLDS = {
  edena: 'open meadows round the ruins',
  glassdunes: 'the sand valley between the glass walls',
  buried: 'the dunes over the machine, its ramp and trench',
  spheres: 'the meadow, the avenue and the lake shore',
};

/** Does the bike come out of the ship here? Found in the desert, a world for riding, no mount of the world's own. */
export function bikeComes(levelId, level, flag) {
  return !!flag?.('desert.bike.found') && Object.hasOwn(BIKE_WORLDS, levelId) && !level?.features?.mount;
}

/**
 * How calling the mount sounds (main.js onWhistle; issue #249, "it shouldn't be a whistle to call the hover bike"): Vael's
 * bird, the rider's call on the flute ('rider'); the hoverbike, from your pack ('pack': its socket sends the bike a pulse,
 * the tank's rings blink, sound.packCall and tool.signal; nothing without the pack it runs on, null); a taxi or the
 * skiff, a whistle ('whistle').
 */
export function callKind(kind, mountName, hasPack) {
  if (kind !== 'mount') return 'whistle';
  if (mountName === 'bird') return 'rider';
  if (mountName === 'hoverbike') return hasPack ? 'pack' : null;
  return 'whistle';
}

/** Where it stands by the ship: beside the ramp's foot, a little to the right of the way out, facing out. */
export function parkingSpot(spawn, heading = 0) {
  const fx = Math.sin(heading), fz = Math.cos(heading);   // (the way out of the ship: the spawn's heading)
  return { x: (spawn?.x ?? 0) + fx * 5 - fz * 4, z: (spawn?.z ?? 0) + fz * 5 + fx * 4, heading };
}

/** The hoverbike, parked by the ship (called from your pack as in the desert when it is the world's mount). */
export function parkedBike(physics, spawn, heading = 0) {
  const b = new Hoverbike(physics);
  const at = parkingSpot(spawn, heading);
  b.place(at.x, at.z, at.heading, spawn ?? null);
  b.pos.y -= 1;   // (place lifts it a metre to arrive riding; parked it hovers at its height)
  return b;
}

/**
 * The hover trails (src/trail.js) stream from the jets of whatever hover vehicle you ride: the hoverbike or the
 * skiff, never the bird or a cab (issue #376: where Vael's bird answers, as in Viridel, the bird is the world's mount
 * and the bike only one of your vehicles, and the trails, made for the mount alone, were never there).
 */
export const laysTrail = (v) => !!v && v instanceof Hoverbike;

/** The vehicles of a world that lay trails (the mount first). */
export const trailVehicles = (player) => (player?.vehicles ?? []).filter(laysTrail);

/** The one whose jets the trails follow this frame: the one ridden, else the last ridden (coasting, its trails fading). */
export function trailVehicle(player, last = null) {
  return laysTrail(player?.ride) ? player.ride : last ?? trailVehicles(player)[0] ?? null;
}
