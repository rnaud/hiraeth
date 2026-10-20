import { CatmullRomCurve3, Vector3 } from 'three';

// Where the hand-built desert landmarks stand (src/desert-landmarks.js).
// buildWorld keeps its scattered props clear of these footprints, and sites
// flagged `calm` get level ground (the dune and ridge relief fades out).
// Golden dunes: carcass, wreck, camp, sails. Rose canyons: canyon, umbrellas.
// Salt flats: petals, lagoons, dishes.
export const ROSE_SITE = { x: 550, z: 376, r: 34 };

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
  // the skull outside the back gate, its face to the gate: you come out of the city to its sockets, teeth and mouth
  // (issue #154: it looked out to the dunes, and from the gate you saw the back of its head first); the body lies on under the sand
  giant: { x: 318, z: 530, r: 30, yaw: Math.atan2(-88, -130) },
  cave: { x: -1250, y: 1000, z: 1250 },                             // the interior's origin (far overhead)
  pilgrim: { x: 8, z: 218 },                                        // the old pilgrim who fell behind: on a dune west of the way in, in sight of it (v1.9: she sat 300 m out, a trip there and back with nothing else on it)
  drum: { x: 156.65, z: -187.6 },                                   // Teo's drum, blown under the old ribcage and jammed against the inside of a rib's foot (src/story/desert-errands.js)
  bike: { x: 132, z: 150, yaw: 2.3 },                               // Marrow's hollow: the hoverbike under its tarp (quest desert.bike)
  lookout: { x: 165, z: 182 },                                      // Zahir on the dune's crest over the hollow, the tarp in sight below (issue #278)
  // the red rag's mast on the hollow's north-west lip, between it and the ship (issue #561: the 263 m from the drinking roots
  // to the tarp were blind): `h` m tall, and from the roots it stands in the arch of Qanat's main gate (tests/desert-lookout.test.js)
  rag: { x: 115, z: 172, h: 20 },
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
 * Four stops on the straight ride out, from Marrow's hollow (where the bike wakes) to the Hearth's door: the
 * way most riders take, the butte's chimney ahead, while the marked stones run home to Qanat a little to the
 * north (the level design audit, v1.9: the ride was 1.5 km with nothing on it). A third of the way, a
 * salt-carrier resting in the shade of her sunshade (src/levels/content.js: Yara); not quite halfway, the skiff's
 * stone anchor, dragged loose and left in the sand, its rope trailing on toward the wreck (the level design audit,
 * third round: Yara's shade to the wreck was 418 m with nothing on it); two thirds, a sand-skiff's
 * wreck, its mast still standing; four fifths, the tusk gate the Givers stood where the red rocks begin, right
 * over the way (v1.15: the wreck to the Hearth was 518 m with nothing on it) (src/desert-hearth.js `ride`,
 * src/story/desert-way.js).
 * Each: { x, z, f } (f: how far along the ride; side: metres to its right).
 */
export const RIDE = { shade: { f: 0.3, side: 9 }, anchor: { f: 0.455, side: -7 }, wreck: { f: 0.61, side: -12 }, tusks: { f: 0.81, side: 0 } };
export function ridePlaces() {
  const a = STORY.bike, b = STORY.hearth, dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), out = {};
  for (const [id, w] of Object.entries(RIDE)) out[id] = { x: a.x + dx * w.f - (dz / L) * w.side, z: a.z + dz * w.f + (dx / L) * w.side, f: w.f, heading: Math.atan2(dx, dz) };
  return out;
}
/**
 * The old river's dry wash (src/desert-ground.js channel, cut in desertHeight): from its head out past the cold camp,
 * north-west between the straight ride out and the marked stones home, through the dune ridge, toward the camps.
 * The giants walked down it carrying the water when it failed (src/desert-giants.js). [x, z], upstream first.
 */
export const DRY_WASH = {
  points: [[1085, -175], [1015, -140], [945, -100], [880, -62], [815, -60], [735, -40], [655, 45], [575, 85], [495, 120], [415, 150], [340, 168]],
  bed: 6, bank: 28, depth: 4.5,
};
/**
 * The giants' road (issue #167, references/levels/The Desert/environment/explorations/giants-road/): the giants fell
 * one by one along the old river on their way from the swamp of lights, the last under Qanat. Four lie out on the
 * dunes between the ride out and the stones home, 30-150 m off both (the level design audit: 1 optional place of 37 at
 * mid-distance), each with a pilgrims' shrine whose verse is read outward from Qanat, back up their road (I-IV):
 *   hand   a hand standing out of the dune like a ruin, by the wash
 *   arm    an arm lying across the wash, a bridge you ride up from the shoulder (`at`: where it crosses the bed)
 *   spine  a spine up a dune's slope like a stair, its skull a lookout at the top (from `foot` to `top`)
 *   jaw    a lower jaw standing over the wash's head like an arch, the pilgrims' shelter; its verse points on
 */
export const GIANTS = {
  hand: { x: 432, z: 192, yaw: 0.35 },
  arm: { x: 655, z: 45 },
  spine: { foot: [935, -112], top: [875, -95] },
  jaw: { x: 1062, z: -150, yaw: 0.6 },
};
/**
 * The walking dunes (issue #167, references/levels/The Desert/environment/explorations/walking-dunes/; src/desert-dunes.js):
 *   SAND_RIVER  a river of running sand from Marrow's hollow out along the south side of the ride to the salt-carrier's
 *               shade, a shallow channel (src/desert-ground.js) the bike rides fast down; the second runs down the dry
 *               wash's bed (DRY_WASH), from the jaw home past the giants
 *   RUINS       four old things the dunes cover and uncover, two at a time, a different two each visit (`DUNE_VISITS`)
 *   SANDFALLS   sand pouring off two mesas' lips: [x, z] of the mesa (src/world.js scatters them; found by raycasting),
 *               the way the fall faces (`toward`), its width
 *   LOOKOUT     the ledge up the second one's mesa to a lookout beside its lip (issue #181)
 */
export const SAND_RIVER = {
  points: [[170, 100], [255, 45], [340, -45], [430, -72], [520, -66], [600, -45]],
  bed: 7, bank: 14, depth: 1.2,
};
export const RUINS = [
  { id: 'stair', x: 305, z: 46, yaw: -1.0 },     // a stone doorway, its stair going down into the dark
  { id: 'tower', x: 480, z: -125, yaw: 0.3 },   // the top of a windcatcher tower
  { id: 'caravan', x: 900, z: -232, yaw: 1.1 }, // a buried caravan: three carts
  { id: 'arcade', x: 1180, z: -382, yaw: 0.6 }, // three arches of an old wall
];
/** Which two ruins stand clear on each visit (visit n: DUNE_VISITS[n % 6]); the first visit the stair and the caravan. */
export const DUNE_VISITS = [[0, 2], [1, 3], [0, 3], [1, 2], [2, 3], [0, 1]];
/** Where a dune that has walked off its ruin lies: downwind of it (the motes' wind, src/levels/desert.js life.motes). */
export const DUNE_WALK = { dx: 32, dz: 12 };
export const SANDFALLS = [
  { mesa: [605, 194], toward: [640, 60], w: 18, seed: 3 },   // over the dry wash, the giant's arm below it
  { mesa: [791, -197], toward: [800, -100], w: 18, seed: 7 }, // over the ride out, just past the skiff's anchor
];
/**
 * The lookout on the sandfall mesa over the ride (issue #181: the desert's places stood all on the sand): a ledge cut
 * round the mesa's west face, from the sand at angle `a0` (round the mesa's middle, world atan2(z, x)) up to a stone
 * platform at `a1` beside the fall's lip, `rise` m over the sand where it starts. `w` the ledge's width, `deck` the
 * platform's radius. Walked (or ridden) up, never climbed: src/desert-dunes.js.
 */
export const LOOKOUT = { fall: 1, a0: 3.75, a1: 1.9, rise: 38, w: 4.6, deck: 6.5 };
/**
 * The memory of water (issue #167, references/levels/The Desert/environment/explorations/water-memory/;
 * src/desert-water.js):
 *   SALT_PAN  where the dry wash ends, east of the camps: a level white pan the procession's circuit crosses, a
 *             mirage of the old lake over it (boats, reeds) that sinks away as you come near; when the tree drinks
 *             it floods, a shallow mirror the procession walks through
 *   WELLS     a line of old qanat wells from the giant's hand to Qanat, a shaft and a windcatcher each, to listen at
 *   BOATS     two boats stranded on the dry wash's banks: [metres along DRY_WASH, side (+ its right bank)]
 */
export const SALT_PAN = { x: 295, z: 195, r: 48, fade: 60 };
export const WELLS = (() => {
  const a = GIANTS.hand, b = STORY.city, L = Math.hypot(b.x - a.x, b.z - a.z), out = [];
  for (const d of [26, 70, 114, 158, 202]) out.push([a.x + (b.x - a.x) * d / L, a.z + (b.z - a.z) * d / L]);
  return out;
})();
export const BOATS = [[300, 8.5, 0.5], [610, -9, 2.2]];
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
 * inked clouds drifting over it, far apart. (Off from v0.63, when the desert took its plates' clean sky; the
 * reference views keep DESERT_LOOK's.) They cast no shadow on the sand (DESERT_CLOUD_SHADOWS): a cloud's shadow
 * took the toon shade whole, a band of the blue-violet shadow tone across the dunes with no cast shadow left
 * in it and no cloud over it to say why (the author's playtest, issue #66: "the sand looks blue outside the
 * city behind the great tree? And with no shadows?").
 */
export const DESERT_CLOUDS = 0.25;
export const DESERT_CLOUD_SHADOWS = 0;
/**
 * The world's shade keeps more of the sand's own warmth (the plates shade a dune a deeper orange, not a grey-olive:
 * the print's 0.3 under the blue-grey tint turned the ochre sand khaki; October 2026 colour pass).
 */
export const DESERT_SHADE_KEEP = 0.5;
export const DESERT_WORLD_LOOK = { ...DESERT_LOOK, uClouds: DESERT_CLOUDS, uShadeKeep: DESERT_SHADE_KEEP };
