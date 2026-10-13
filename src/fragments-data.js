// The fragments of the singing light (docs/systems/fragments.md, issue #196): where they hide, world by world.
//
// The light sheds them where it passed, small splinters of its song that settled in the out-of-the-way places: up on
// ledges and high places, tucked behind things, at the ends of side paths; never on the way you are sent. Each is a
// spot on the ground, [x, y, z] in its world's coordinates (a merged world's: Vael's sky stones and Lorn's Deep Wood
// are in Vael's and Lorn's own frame); the fragment floats a little over it (src/fragments.js LIFT). Found ones are
// the save's flags `frag.<world>.<i>`; their count is what the scientist aboard counts (src/story/scientist.js).
//
// The spots were first picked by scripts/fragment-spots.mjs (the walker's flood from the world's spawn, scored for a
// drop under them, walls round them, height, and distance from the people, the chests and the relics), then looked
// at one by one; tests/fragments.test.js checks each still stands on solid ground with room over it and that the
// walker reaches it from the world's spawn (a double jump high at most, falls that don't hurt, Lorn's water swum).
//
// v1.61 (issue #228): 29 re-picked over the rebuilt worlds' new country and off the route (the level design audit's
// critical path: tests/fragments-route.test.js, 25 m at least), each in the slot it replaced, marked "(v1.61, #228)"
// with its place. A save's found flags on those slots move to unmoved ones still to find (src/save-migrate.js step 23,
// FRAGMENTS_MOVED_228, which must list exactly the marked slots).
//
// Issue #247 ("make the first few ones easy to find around my ship"): the Desert's slots 5 and 6 moved from the far
// south and the western ridge to the open sand round the landing, 40 and 60 m from the ramp and 30 m and more off the
// route (#228's rule kept), marked "(#247)"; Marrow points at the nearer (the errand desert.splinter). A save that
// found either keeps its count (the flag stays on its slot: the new place shows as found).
//
// Issue #250 ("often within points of interest or at the top of structures hard to climb"): 31 more moved into and onto
// the worlds' places of interest (a ribcage, a temple's top, a cairn on the frozen wave, the whale bones; scored by
// scripts/fragment-spots.mjs, tests/fragments-reach.js pointsOfInterest, counted by tests/fragments-poi.test.js), each
// in its slot, marked "(v1.66, #250)" with its place; a save's found flags on them move as #228's did (src/save-migrate.js
// step 25, FRAGMENTS_MOVED_250, which must list exactly the marked slots).

import { ORDER, TITLES } from './levels/names.js';

/** How many hide in each world on the route. */
export const FRAGMENTS_PER_WORLD = 8;

export const FRAGMENTS = {
  desert: [
    [166.8, -16.97, -204.4],   // (v1.66, #250) under the old ribcage’s ribs
    [558.0, 43.93, 345.9],
    [658.0, 24.45, 51.9],
    [-166.0, 27.03, 745.9],
    [-324.0, 7.61, 395.9],
    [70.0, 17.85, 190.5],   // (#247) the first, easy: on the open sand 40 m from the ramp, ahead and to the right as you step out
    [44.0, 20.86, 120.0],   // (#247) the second, easy: up the low rise 60 m behind the ship
    [-376.0, 4.15, 629.9],   // (v1.66, #250) between the vertebrae of a ribcage in the west dunes
  ],
  arzach: [   // (v1.55, issue #187: picked afresh, scripts/fragment-spots.mjs, once the riders' road, the sundial and the broken edge were in)
    [216.0, 40.00, -580.0],   // (v1.66, #250) by Ondine’s tally, on the island’s edge
    [-4.0, 26.00, -940.0],   // (v1.61, #228) a slab tipped up at the plain’s broken edge
    [212.0, 40.00, -686.0],
    [42.0, 53.07, -1338.0],   // (v1.61, #228; v1.66, #250) at the hour stone toward the riders’ gate, on the sundial
    [-24.0, 22.92, -1018.0],   // (v1.61, #228) under a tipped slab past the riders’ gate
    [-800.0, 46.87, -1038.0],
    [-444.0, 39.86, -922.0],
    [314.0, 39.62, -1224.0],
  ],
  perdide: [
    [-698.0, 39.48, -448.0],
    [676.0, 29.64, -554.0],
    [-24.0, 70.00, -748.0],   // (v1.61, #228) the keepers’ canopy: a deck 70 m up
    [-54.0, -0.64, -530.0],   // (v1.66, #250) among the keepers’ stalks
    [-84.0, 0.56, -700.0],   // (v1.61, #228) on the egg isle’s heap, in the drowned wood
    [34.0, 32.70, -754.0],   // (v1.61, #228) halfway up the keepers’ stair
    [-134.0, -0.17, -998.0],
    [-638.0, 0.18, 238.0],
  ],
  edena: [
    [26.0, 16.47, 144.0],   // (v1.66, #250) on a cap of the pyramid nursery, 16 m up
    [-618.0, 23.18, 210.0],
    [14.0, 35.79, 240.0],   // (v1.61, #228) on the old pyramid’s terraces, 36 m up
    [150.0, -15.60, -80.0],   // (v1.61, #228) on the round ship’s hill
    [624.0, 19.56, 282.0],
    [-18.0, 5.78, 50.0],   // (v1.66, #250) inside the split meteor
    [8.0, -7.26, -134.0],   // (v1.61, #228) on the builders’ machine’s flank
    [138.0, -17.67, -144.0],   // (v1.66, #250) in the dish pond
  ],
  underwater: [
    [186.2, -7.20, -54.9],   // (v1.61, #228) the far café’s terrace, over the canyon
    [-32.0, 0.08, 138.0],
    [136.2, -0.60, 27.1],   // (v1.61, #228) out on the seabed, at a pod tower’s foot
    [157.6, -64.00, -72.0],   // (v1.66, #250) among the whale bones on the canyon’s floor
    [138.2, -26.25, -68.9],   // (v1.61, #228) a pod tower’s ring down the canyon’s wall
    [48.2, -0.97, -168.9],   // (v1.61, #228) out on the seabed, by a tower’s round door
    [146.2, -7.20, -50.9],   // (v1.61, #228) on the white bridge over the canyon
    [-38.0, 0.08, -112.0],
  ],
  incal: [
    [-164.0, 150.00, -200.0],
    [182.0, 150.00, -184.0],
    [-92.0, 150.00, 172.0],   // (v1.66, #250) under the cab-wrights’ crane
    [-200.0, 150.00, 76.0],
    [144.0, 200.00, 220.0],   // (v1.66, #250) by the great mirror, on the rim’s top
    [354.0, 200.00, 94.0],   // (v1.66, #250) by Tobin’s telescopes on the rim
    [192.0, 150.00, 8.0],   // (v1.66, #250) in a stall of the balcony market
    [-236.0, 150.00, -106.0],
  ],
  glassdunes: [
    [218.0, 43.33, 62.0],
    [82.0, 42.74, -284.0],
    [12.0, 27.32, 36.0],   // (v1.66, #250) by the wave’s cairn, on the frozen wave’s crest
    [228.0, 35.91, -122.0],
    [-78.0, 90.99, -242.0],   // (v1.66, #250) by the breaker’s cairn, 91 m up on the breaking wave
    [298.0, 50.41, -26.0],
    [170.0, 12.17, 118.0],   // (v1.66, #250) on the glass that holds the carriers
    [-36.0, 6.03, -246.0],   // (v1.66, #250) on the glass that holds the moment in the wave
  ],
  buried: [
    [-44.0, -32.63, -274.0],   // (v1.61, #228; v1.66, #250) behind the oil fall, at the canyon’s foot
    [220.0, 15.34, -70.0],
    [-126.0, 11.78, 448.0],
    [-18.0, 14.79, -360.0],   // (v1.66, #250) on a summit of the keepers’ way, over the machine
    [-486.0, 7.48, -38.0],
    [424.0, 11.78, -254.0],
    [16.0, 7.77, -344.0],   // (v1.66, #250) on the keepers’ gangway
    [12.0, 7.98, -136.0],   // (v1.66, #250) on a cap of the Tooth Day posts
  ],
  moonfoundry: [
    [10.0, 13.06, -208.0],
    [-23.0, 37.12, -197.0],   // (v1.61, #228) a landing of the broken moon’s stair street, 37 m up
    [-89.0, 13.06, -164.0],   // (v1.66, #250) on the bowl’s deck, among its garden
    [-31.0, 13.06, -128.0],   // (v1.61, #228) a gantry over the floor
    [-8.0, 30.25, -216.0],   // (v1.61, #228) behind a house on the stair street, 30 m up
    [-153.0, 0.00, 33.0],   // (v1.61, #228) tucked behind a wall on the floor
    [154.0, 0.00, -280.0],
    [-71.0, 0.00, -112.0],   // (v1.66, #250) against the cracked mould
  ],
  spheres: [
    [-219.5, 54.69, -144.5],   // (v1.66, #250) on the white hill’s pyramid, by the temple on its top (the far corner from the Pyramid key)
    [78.0, -2.65, -244.0],   // (v1.61, #228) down in the cracked sphere’s crater
    [-122.0, 2.38, -456.0],   // (v1.66, #250) in the empty arcade in the android wood
    // (v1.56, issue #190: these two picked afresh by scripts/fragment-spots.mjs spheres once the explorations were built;
    //  the old ones, on an umbrella's flaring roots by the plaza and under one far west, were left too close to a ledge)
    [440.0, 1.48, -462.0],
    [-88.0, -4.32, -268.0],   // (v1.66, #250) on the terraces round the sphere west of the arch
    [206.0, -1.83, -302.0],   // (v1.66, #250) in the ring of stones at the white monolith
    [592.0, 5.22, 72.0],
    [252.0, -0.74, 38.0],   // (v1.66, #250) by the cairn at the yellow sphere’s furrow
  ],
  spacecity: [
    [79.0, 78.73, -119.0],   // (v1.61, #228) the stack’s top, 79 m up
    [-92.0, -0.00, 42.0],
    [75.0, 50.00, -121.0],   // (v1.61, #228) on the stack’s stair, 50 m up
    [-29.0, 16.59, -57.0],   // (v1.61, #228) on a rooftop 17 m up over the Towers
    [-36.0, -0.00, -52.0],
    [-36.0, 0.00, -88.0],   // (v1.61, #228) the rim walk behind a tower, west of the Towers (the old spot lay by the way #233 moved)
    [-5.0, 0.00, 146.0],   // (v1.61, #228; v1.66, #250) by the telescope at the Pier’s end
    [-76.0, -4.00, -48.0],   // (v1.61, #228) the Garden island’s rim
  ],
  bazaar: [
    [34.0, 25.00, -90.0],   // (v1.61, #228) the far end of Kip’s skybridge, 25 m up
    [38.0, 8.32, -142.0],   // (v1.61, #228) a ledge 8 m up over Signal Square
    [162.0, 0.00, -498.0],
    [212.0, 0.00, 152.0],
    [-132.0, 0.00, -498.0],
    [128.0, 0.00, 8.0],   // (v1.61, #228) past the screen lanes’ biggest set
    [34.0, 8.32, -274.0],   // (v1.66, #250) on a tower’s service balcony over Signal Square
    [-74.0, 0.00, -64.0],   // (v1.66, #250) by the radio-mender’s table in the listeners’ lane
  ],
};

/** Every fragment there is. */
export const FRAGMENT_TOTAL = Object.values(FRAGMENTS).reduce((a, l) => a + l.length, 0);

/** A fragment's save flag: found. */
export const fragKey = (world, i) => `frag.${world}.${i}`;

/** How many are found, all told and world by world, from the save's flags: { found, total, worlds: { [id]: { found, total, left, title } } }. */
export function fragmentCounts(flags = {}) {
  const worlds = {};
  let found = 0;
  for (const id of ORDER) {
    const list = FRAGMENTS[id] ?? [];
    const n = list.filter((_, i) => flags[fragKey(id, i)]).length;
    worlds[id] = { found: n, total: list.length, left: list.length - n, title: TITLES[id] ?? id };
    found += n;
  }
  return { found, total: FRAGMENT_TOTAL, worlds };
}
