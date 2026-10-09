import { CatmullRomCurve3, Vector3 } from 'three';

// Where the hand-built desert landmarks stand (src/desert-landmarks.js).
// buildWorld keeps its scattered props clear of these footprints, and sites
// flagged `calm` get level ground (the dune and ridge relief fades out).
// Golden dunes: carcass, wreck, camp, sails. Rose canyons: canyon, umbrellas.
// Salt flats: petals, lagoons, dishes.
export const SITES = {
  carcass: { x: -700, z: -660, r: 100, yaw: 0.55 },
  wreck: { x: -110, z: 760, r: 85, yaw: -0.5 },
  camp: { x: -44, z: 30, r: 9, yaw: 0.4 },
  sails: { x: -170, z: 360, r: 42, yaw: 2.4 },
  canyon: { x: 620, z: 690, r: 150, yaw: 0.35, calm: true },
  umbrellas: { x: 1060, z: 420, r: 70, yaw: 0, calm: true },
  petals: { x: -850, z: 120, r: 52, yaw: 0.2, calm: true },
  lagoons: { x: -1060, z: 520, r: 150 },
  dishes: { x: 640, z: -1070, r: 90, yaw: 0, calm: true },
};
// the telegraph line from the petal station to the lagoons
export const POLE_LINE = [[-885, 165], [-1010, 430]];

// The desert's story (src/desert-city.js, src/story/desert.js): the old city
// of Qanat round its burning tree, the pilgrims' camps outside its gate, the
// fallen giant whose skull hides the way down to the cave, and the cave
// itself (an interior built far overhead, reached through the skull).
// `yaw` turns local +z (the main gate) toward the camps and the spawn.
// Kept apart from SITES so the reference-landmark tests stay about those.
export const STORY = {
  city: { x: 230, z: 400, r: 66, yaw: Math.atan2(-230, -400) },
  camps: { x: 168, z: 292, r: 40 },
  giant: { x: 318, z: 530, r: 30, yaw: Math.atan2(88, 130) },     // the skull outside the back gate, its face to the dunes (the body lies under the city)
  cave: { x: -1250, y: 1000, z: 1250 },                             // the interior's origin (far overhead)
  pilgrim: { x: 8, z: 218 },                                        // the old pilgrim who fell behind: on a dune west of the way in, in sight of it (v1.9: she sat 300 m out, a trip there and back with nothing else on it)
  drum: { x: 156.65, z: -187.6 },                                   // Teo's drum, blown under the old ribcage and jammed against the inside of a rib's foot (src/story/desert-errands.js)
  bike: { x: 132, z: 150, yaw: 2.3 },                               // Marrow's hollow: the hoverbike under its tarp (quest desert.bike)
  // the Givers' Hearth (src/desert-hearth.js): a butte of red rock far out in the south-east, ~1.7 km from
  // Qanat (a long ride, more than four minutes' run), the spark-stone in the dark cave under it; its rooms far overhead
  hearth: { x: 1650, z: -450, r: 46 },
  hearthCave: { x: 1250, y: 1000, z: -1250 },
};
STORY.hearth.yaw = Math.atan2(STORY.city.x - STORY.hearth.x, STORY.city.z - STORY.hearth.z);   // its door looks back toward Qanat

/**
 * The fire-bearers' marked stones from Qanat to the Givers' Hearth: [x, z] about every 150 m, from just
 * past the procession's circuit to the butte's door, wandering a little either side of the straight way.
 */
export function hearthStones() {
  const a = STORY.city, b = STORY.hearth, dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  const out = [];
  for (let d = 340; d < L - 90; d += 150) {
    const k = d / L, side = Math.sin(d * 0.011) * 14;
    out.push([a.x + dx * k - (dz / L) * side, a.z + dz * k + (dx / L) * side]);
  }
  return out;
}
/**
 * Three things to stop for on the long ride to the Hearth (src/desert-hearth.js way, src/story/desert-way.js),
 * by marked stones about a third of the way apart: the keepers' bowl at the foot of the second stone (fill
 * it and the stone's dull mark wakes), their cold camp halfway, and a bell glinting in the sand near the end.
 * Each: { x, z, stone } (stone: the index of the marked stone beside it; side: metres off the way).
 */
export const WAY = { bowl: { stone: 1, side: 2.8 }, camp: { stone: 4, side: -5.5 }, bell: { stone: 7, side: 3.4, along: 18 } };
export function wayPlaces() {
  const a = STORY.city, b = STORY.hearth, dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  const stones = hearthStones(), out = {};
  for (const [id, w] of Object.entries(WAY)) {
    const [sx, sz] = stones[w.stone], along = w.along ?? 0;
    out[id] = { x: sx + (dx / L) * along - (dz / L) * w.side, z: sz + (dz / L) * along + (dx / L) * w.side, stone: w.stone };
  }
  return out;
}
/**
 * Two stops on the straight ride out, from Marrow's hollow (where the bike wakes) to the Hearth's door: the
 * way most riders take, the butte's chimney ahead, while the marked stones run home to Qanat a little to the
 * north (the level design audit, v1.9: the ride was 1.5 km with nothing on it). A third of the way, a
 * salt-carrier resting in the shade of her sunshade (src/levels/content.js: Yara); two thirds, a sand-skiff's
 * wreck, its mast still standing (src/desert-hearth.js `ride`, src/story/desert-way.js).
 * Each: { x, z, f } (f: how far along the ride; side: metres to its right).
 */
export const RIDE = { shade: { f: 0.3, side: 9 }, wreck: { f: 0.61, side: -12 } };
export function ridePlaces() {
  const a = STORY.bike, b = STORY.hearth, dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), out = {};
  for (const [id, w] of Object.entries(RIDE)) out[id] = { x: a.x + dx * w.f - (dz / L) * w.side, z: a.z + dz * w.f + (dx / L) * w.side, f: w.f, heading: Math.atan2(dx, dz) };
  return out;
}
/** The procession's circuit as a smooth closed curve: [x, z] every `step` metres. */
export function processionLoop(step = 3) {
  const curve = new CatmullRomCurve3(PROCESSION.map(([x, z]) => new Vector3(x, 0, z)), true, 'centripetal');
  const n = Math.ceil(curve.getLength() / step);
  return curve.getSpacedPoints(n).slice(0, n).map((p) => [p.x, p.z]);
}
// the procession's circuit round the city, out over the golden dunes (x, z)
export const PROCESSION = [
  [120, 262], [62, 330], [40, 420], [70, 520], [150, 600], [262, 640], [372, 610], [420, 520], [400, 418], [376, 306], [330, 222], [228, 196],
];

/** The desert's touches on the print preset (as its plates): a clean sky, no cloud bank; far dunes a pale warm band. */
/** The far dunes in stepped pale bands of the far haze (post.js 4b): from 250 m, each band 1.9 × farther. */
export const DUNE_HAZE = { uHazeLayers: [250, 1.9, 0.12, 4], uHazeTone: [1, 1, 1, 0] };
export const DESERT_LOOK = { uCumulus: 0, uClouds: 0, uHaze: [0.95, 0.9, 0.87, 0.55], ...DUNE_HAZE };
/**
 * The desert world's sky: the plates' (no cumulus bank on the horizon), with a few of the print's flat
 * inked clouds drifting over it, far apart, and their shadows passing over the dunes. (Off from v0.63,
 * when the desert took its plates' clean sky; the reference views keep DESERT_LOOK's.)
 */
export const DESERT_CLOUDS = 0.25;
/**
 * The world's shade keeps more of the sand's own warmth (the plates shade a dune a deeper orange, not a grey-olive:
 * the print's 0.3 under the blue-grey tint turned the ochre sand khaki; October 2026 colour pass).
 */
export const DESERT_SHADE_KEEP = 0.5;
export const DESERT_WORLD_LOOK = { ...DESERT_LOOK, uClouds: DESERT_CLOUDS, uShadeKeep: DESERT_SHADE_KEEP };
