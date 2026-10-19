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
// critical path: tests/route-worlds.test.js, 25 m at least), each in the slot it replaced, marked "(v1.61, #228)"
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
//
// Issue #317 ("many more fragments of light per world to make them easier to find; keep the professor prices the
// same"): 8 → 24 a world, 96 → 288. The first eight of each world keep their slots and places (a save's found flags
// still point at them); slots 8–23 are new, picked by scripts/fragment-spots.mjs --keep all --count 24 under the same
// rules (the walker reaches them, he stands on them, drawn ground, 15 m apart and more, 25 m off the route), half of
// them and more in or on a place of interest, spread over the world; marked "(v1.70, #317)" with their place. Nothing
// to migrate: the new slots start unfound.

import { ORDER, TITLES } from './levels/names.js';

/** How many hide in each world on the route (8 until v1.70; issue #317). */
export const FRAGMENTS_PER_WORLD = 24;

export const FRAGMENTS = {
  desert: [
    [166.8, -16.97, -204.4],   // (v1.66, #250) under the old ribcage’s ribs
    [558.00, 43.67, 345.90],
    [658.0, 24.45, 51.9],
    [-166.0, 27.03, 745.9],
    [-324.0, 7.61, 395.9],
    [70.0, 17.85, 190.5],   // (#247) the first, easy: on the open sand 40 m from the ramp, ahead and to the right as you step out
    [44.0, 20.86, 120.0],   // (#247) the second, easy: up the low rise 60 m behind the ship
    [-376.0, 4.15, 629.9],   // (v1.66, #250) between the vertebrae of a ribcage in the west dunes
    [428.0, 28.32, 189.9],   // (v1.70, #317) on the giant’s hand
    [276.0, -1.73, 533.9],   // (v1.70, #317) among the fallen giant’s bones
    [-160.0, 10.40, 369.9],   // (v1.70, #317) among the sail tents
    [-256.0, -9.21, 491.9],   // (v1.70, #317) inside a ribcage
    [-418.0, 3.72, 619.9],   // (v1.70, #317) inside a ribcage
    [-52.0, 3.89, 771.9],   // (v1.70, #317) by the crashed hull
    [582.00, 43.67, 379.90],   // (v1.70, #317) on the Rose House’s raised stone terrace
    [562.0, 7.83, 99.9],   // (v1.70, #317) a boat stranded in the dry wash
    [-34.0, 28.91, -440.1],   // (v1.70, #317) a ledge, a 6 m drop by it
    [482.0, 21.46, -132.1],   // (v1.70, #317) a ledge, a 8 m drop by it
    [522.0, 9.27, -394.1],   // (v1.70, #317) out at the end of the way
    [522.0, 11.77, 703.9],   // (v1.70, #317) up high, 9 m over the middle
    [-246.0, 11.97, -72.1],   // (v1.70, #317) a ledge, a 7 m drop by it
    [200.0, 8.33, -460.1],   // (v1.70, #317) a ledge, a 6 m drop by it
    [398.0, 30.56, -24.1],   // (v1.70, #317) a ledge, a 11 m drop by it
    [-212.0, 8.94, -300.1],   // (v1.70, #317) tucked in among walls
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
    [220.0, 37.48, -164.0],   // (v1.70, #317) on a summit
    [218.0, 40.00, -844.0],   // (v1.70, #317) on a summit
    [212.0, 40.00, -372.0],   // (v1.70, #317) on a summit
    [294.00, 42.93, -292.00],   // (v1.70, #317) on the relocated needle plateau’s summit
    [218.0, 40.00, -474.0],   // (v1.70, #317) on a summit
    [-20.0, 53.30, -1372.0],   // (v1.70, #317) by the hour stone toward the landing (new country)
    [270.0, 37.38, -180.0],   // (v1.70, #317) on a summit
    [90.0, 40.00, -108.0],   // (v1.70, #317) on a summit
    [216.0, 40.00, -766.0],   // (v1.70, #317) on a summit
    [-120.0, 20.76, -1744.0],   // (v1.70, #317) a ledge, a 9 m drop by it
    [-450.0, 53.85, -1382.0],   // (v1.70, #317) a ledge, a 7 m drop by it
    [234.0, 49.64, -1624.0],   // (v1.70, #317) up high, 156 m over the middle
    [462.0, 45.71, -890.0],   // (v1.70, #317) a ledge, a 12 m drop by it
    [-718.0, 18.04, -1306.0],   // (v1.70, #317) a ledge, a 9 m drop by it
    [-620.0, 41.39, -1588.0],   // (v1.70, #317) up high, 148 m over the middle
    [-82.0, 37.38, 58.0],   // (v1.70, #317) at the edge, over the drop
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
    [-292.0, -0.22, -398.0],   // (v1.70, #317) tucked in among walls
    [54.0, 7.33, -34.0],   // (v1.70, #317) by Wendel’s lookout
    [-300.0, 0.54, -834.0],   // (v1.70, #317) tucked in among walls
    [-40.0, 10.11, -518.0],   // (v1.70, #317) on a shroom’s cap
    [10.0, 0.32, -752.0],   // (v1.70, #317) on the keepers’ stair (new country)
    [-518.0, 0.01, -706.0],   // (v1.70, #317) tucked in among walls
    [344.0, 0.69, -590.0],   // (v1.70, #317) tucked in among walls
    [214.0, 2.92, 208.0],   // (v1.70, #317) tucked in among walls
    [-410.0, 6.04, -160.0],   // (v1.70, #317) tucked in among walls
    [-62.0, -1.47, -820.0],   // (v1.70, #317) beneath the cap square, in the shallows
    [448.0, 1.56, -176.0],   // (v1.70, #317) tucked in among walls
    [430.0, 2.36, 422.0],   // (v1.70, #317) out at the end of the way
    [-148.0, 1.60, 204.0],   // (v1.70, #317) tucked in among walls
    [592.0, 3.61, -804.0],   // (v1.70, #317) out at the end of the way
    [376.0, 0.10, -830.0],   // (v1.70, #317) tucked in among walls
    [662.0, 44.08, -396.0],   // (v1.70, #317) up high, 46 m over the middle
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
    [30.0, 19.29, 254.0],   // (v1.70, #317) among the pyramid nursery’s terrace trees (new country)
    [28.0, 19.29, 226.0],   // (v1.70, #317) among the pyramid nursery’s terrace trees (new country)
    [60.0, 7.79, 154.0],   // (v1.70, #317) on a cap of the pyramid nursery (new country)
    [70.00, 18.11, 294.00],   // (v1.70, #317) on the water stair (new country)
    [136.0, -17.10, -58.0],   // (v1.70, #317) on the round ship’s hill (new country)
    [56.0, 0.99, 112.0],   // (v1.70, #317) by the pyramid nursery’s seedling beds (new country)
    [-50.0, -0.06, -88.0],   // (v1.70, #317) on the runnel’s basin
    [32.0, 1.60, -542.0],   // (v1.70, #317) a ledge, a 14 m drop by it
    [538.0, -9.56, -438.0],   // (v1.70, #317) a ledge, a 5 m drop by it
    [-240.0, 14.75, 190.0],   // (v1.70, #317) a ledge, a 11 m drop by it
    [-616.0, 5.77, -254.0],   // (v1.70, #317) a ledge, a 6 m drop by it
    [-334.0, 27.87, -494.0],   // (v1.70, #317) up high, 28 m over the middle
    [76.0, 25.47, 694.0],   // (v1.70, #317) up high, 25 m over the middle
    [666.0, 23.61, -162.0],   // (v1.70, #317) up high, 24 m over the middle
    [352.0, 13.41, 572.0],   // (v1.70, #317) up high, 13 m over the middle
    [-284.0, 13.79, 580.0],   // (v1.70, #317) up high, 14 m over the middle
  ],
  underwater: [
    [186.2, -7.20, -54.9],   // (v1.61, #228) the far café’s terrace, over the canyon
    [-32.0, 0.08, 138.0],
    [136.2, -0.60, 27.1],   // (v1.61, #228) out on the seabed, at a pod tower’s foot
    [157.6, -64.00, -72.0],   // (v1.66, #250) among the whale bones on the canyon’s floor
    [138.2, -26.25, -68.9],   // (v1.61, #228) a pod tower’s ring down the canyon’s wall
    [45.20, -0.69, -163.70],   // (v1.61, #228) on the seabed by the relocated tower, within reach of air
    [146.2, -7.20, -50.9],   // (v1.61, #228) on the white bridge over the canyon
    [-38.0, 0.08, -112.0],
    [168.2, -6.52, -32.9],   // (v1.70, #317) on a tower of pods (new country)
    [130.2, -44.86, -144.9],   // (v1.70, #317) on a tower of pods
    [-53.8, 4.71, -38.9],   // (v1.70, #317) on a tower of pods
    [-153.8, -0.37, 73.1],   // (v1.70, #317) on a tower of pods
    [-45.8, 4.38, 77.1],   // (v1.70, #317) on a tower of pods
    [-139.8, -0.55, -36.9],   // (v1.70, #317) on a tower of pods
    [56.47, 3.86, 180.10],   // (v1.70, #317) on the relocated pod tower’s lower ledge
    [131.6, -54.36, -194.0],   // (v1.70, #317) on a tower of pods
    [40.2, -0.47, -60.9],   // (v1.70, #317) on a tower of pods
    [173.6, -64.00, -112.0],   // (v1.70, #317) on a tower of pods (new country)
    [-87.8, -0.50, 89.1],   // (v1.70, #317) on a tower of pods
    [-51.80, -0.52, -158.90],   // (v1.70, #317) on the seabed by the relocated tower, within reach of air
    [171.6, -63.76, -174.0],   // (v1.70, #317) on a tower of pods
    [-47.8, -0.60, 175.1],   // (v1.70, #317) on a tower of pods
    [64.2, -0.70, -28.9],   // (v1.70, #317) on a tower of pods
    [173.6, -64.00, -138.0],   // (v1.70, #317) on a tower of pods
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
    [44.0, 150.00, -254.0],   // (v1.70, #317) on a summit
    [80.0, 150.00, -178.0],   // (v1.70, #317) on a summit
    [-242.0, 150.00, 92.0],   // (v1.70, #317) on a summit
    [56.0, 150.00, 12.0],   // (v1.70, #317) on a summit
    [-14.0, 150.00, 106.0],   // (v1.70, #317) on a summit
    [104.0, 150.00, -236.0],   // (v1.70, #317) on a summit
    [-96.0, 150.00, -38.0],   // (v1.70, #317) on a summit
    [-166.0, 150.00, -64.0],   // (v1.70, #317) on a summit
    [-28.0, 150.00, 168.0],   // (v1.70, #317) on a summit
    [154.0, 150.00, 128.0],   // (v1.70, #317) on a summit
    [-60.0, 150.00, -252.0],   // (v1.70, #317) at the edge, over the drop
    [746.0, 200.00, -14.0],   // (v1.70, #317) tucked in among walls
    [408.0, 200.00, -392.0],   // (v1.70, #317) tucked in among walls
    [396.0, 200.00, 448.0],   // (v1.70, #317) tucked in among walls
    [214.0, 200.00, 696.0],   // (v1.70, #317) tucked in among walls
    [758.0, 200.00, -362.0],   // (v1.70, #317) tucked in among walls
  ],
  glassdunes: [
    [-62.00, 64.38, -290.00],   // on a ledge behind the breaking wave
    [82.0, 42.74, -284.0],
    [12.0, 27.32, 36.0],   // (v1.66, #250) by the wave’s cairn, on the frozen wave’s crest
    [46.00, 46.93, -288.00],   // on a ledge behind the breaking wave
    [-78.0, 90.99, -242.0],   // (v1.66, #250) by the breaker’s cairn, 91 m up on the breaking wave
    [-28.00, 60.18, -288.00],   // on a ledge behind the breaking wave
    [116.00, 40.32, -270.00],   // (v1.66, #250) on the eastern shoulder of the breaking wave
    [-36.0, 6.03, -246.0],   // (v1.66, #250) on the glass that holds the moment in the wave
    [130.0, 17.50, -192.0],   // (v1.70, #317) on a summit
    [-178.0, 3.18, -8.0],   // (v1.70, #317) on the glass that holds a stopped minute (the dust)
    [-20.0, 2.00, 40.0],   // (v1.70, #317) by the passage through the frozen wave
    [134.0, 1.88, -28.0],   // (v1.70, #317) by the carriers’ shade
    [14.0, 4.96, -202.0],   // (v1.70, #317) by the north camp
    [-136.0, 8.46, 24.0],   // (v1.70, #317) by the west camp
    [156.0, 2.78, -62.0],   // (v1.70, #317) on the wind-glass
    [48.0, 2.68, 38.0],   // (v1.70, #317) on the glass that holds a stopped minute (the flock)
    [-156.0, 2.71, 4.0],   // (v1.70, #317) by the dust in the cliff
    [104.0, 2.51, 18.0],   // (v1.70, #317) by the carriers’ float-sledge
    [24.00, 57.29, -278.00],   // (v1.70, #317) on a ledge behind the breaking wave
    [2.0, 48.86, -300.0],   // (v1.70, #317) a ledge, a 49 m drop by it
    [-84.00, 76.89, -288.00],   // (v1.70, #317) on the high western shoulder of the breaking wave
    [344.00, 2.00, 182.00],   // (v1.70, #317) in a nook beneath the eastern glass billows
    [-160.00, 11.95, 198.00],   // (v1.70, #317) on a ledge at the western glass cliff
    [-46.00, 66.81, -276.00],   // (v1.70, #317) on a ledge behind the breaking wave
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
    [22.0, -11.55, -312.0],   // (v1.70, #317) on the keepers’ gangway
    [76.0, 14.85, -60.0],   // (v1.70, #317) among the Tooth Day posts
    [20.0, 6.87, -100.0],   // (v1.70, #317) among the Tooth Day posts
    [28.0, 5.49, -298.0],   // (v1.70, #317) on the keepers’ gangway
    [-30.0, -33.94, -290.0],   // (v1.70, #317) by the oil fall
    [-170.0, 14.90, -588.0],   // (v1.70, #317) tucked in among walls
    [250.0, 9.24, -422.0],   // (v1.70, #317) tucked in among walls
    [-476.0, 2.79, 266.0],   // (v1.70, #317) out at the end of the way
    [182.0, 8.06, 354.0],   // (v1.70, #317) out at the end of the way
    [472.0, 17.60, 240.0],   // (v1.70, #317) up high, 9 m over the middle
    [-472.0, 19.08, 572.0],   // (v1.70, #317) up high, 10 m over the middle
    [-340.0, 10.55, -290.0],   // (v1.70, #317) a ledge, a 4 m drop by it
    [164.0, 18.17, 734.0],   // (v1.70, #317) up high, 9 m over the middle
    [-208.0, 5.44, 170.0],   // (v1.70, #317) out at the end of the way
    [42.0, 11.32, -528.0],   // (v1.70, #317) a ledge, a 15 m drop by it
    [358.0, 17.32, 564.0],   // (v1.70, #317) up high, 9 m over the middle
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
    [60.0, 0.63, 55.0],   // (v1.70, #317) by the footbridge over the long runnel (new country)
    [-70.0, 13.06, -143.0],   // (v1.70, #317) on the bowl
    [87.0, 0.00, -79.0],   // (v1.70, #317) by the footbridge over the furnace runnel (new country)
    [-38.0, 0.00, -104.0],   // (v1.70, #317) by the footbridge over the west runnel (new country)
    [52.0, 0.00, -112.0],   // (v1.70, #317) by the footbridge over the west runnel (new country)
    [-8.0, 13.06, -189.0],   // (v1.70, #317) on the courtyard in the broken moon
    [33.0, 0.00, 50.0],   // (v1.70, #317) by the steps down into the long runnel (new country)
    [-153.0, 0.00, -283.0],   // (v1.70, #317) out at the end of the way
    [-50.0, 0.00, -285.0],   // (v1.70, #317) out at the end of the way
    [-155.0, 0.00, -206.0],   // (v1.70, #317) out at the end of the way
    [50.0, 0.00, -285.0],   // (v1.70, #317) out at the end of the way
    [-125.0, 6.24, -46.0],   // (v1.70, #317) a ledge, a 6 m drop by it
    [-100.0, 0.00, -275.0],   // (v1.70, #317) out at the end of the way
    [-154.0, 0.00, -128.0],   // (v1.70, #317) out at the end of the way
    [44.0, 0.00, -145.0],   // (v1.70, #317) tucked in among walls (new country)
    [-18.0, 10.35, -164.0],   // (v1.70, #317) a ledge, a 10 m drop by it
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
    [-196.0, 34.44, -150.0],   // (v1.70, #317) on the white hill’s pyramid
    [58.0, -1.27, 120.0],   // (v1.70, #317) by the lantern at the white stone
    [-234.0, 32.19, -160.0],   // (v1.70, #317) on the white hill’s pyramid
    [122.0, 0.35, -178.0],   // (v1.70, #317) on the lake’s pyramid
    [-86.0, 0.39, -194.0],   // (v1.70, #317) on the meadow’s pyramid
    [-58.0, 0.39, -194.0],   // (v1.70, #317) on the meadow’s pyramid
    [-92.0, 0.39, -140.0],   // (v1.70, #317) on the meadow’s pyramid
    [-268.0, -0.79, 326.0],   // (v1.70, #317) tucked in among walls
    [154.0, -0.46, -606.0],   // (v1.70, #317) out at the end of the way
    [-532.0, -2.10, 134.0],   // (v1.70, #317) out at the end of the way
    [610.0, -2.44, -270.0],   // (v1.70, #317) out at the end of the way
    [-318.0, -0.72, 54.0],   // (v1.70, #317) tucked in among walls
    [-452.0, 0.50, -98.0],   // (v1.70, #317) out at the end of the way
    [-330.0, 1.51, -300.0],   // (v1.70, #317) tucked in among walls
    [370.0, 2.93, -288.0],   // (v1.70, #317) tucked in among walls
    [-158.0, -1.82, -272.0],   // (v1.70, #317) a ledge, a 8 m drop by it
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
    [80.0, 66.00, -134.0],   // (v1.70, #317) by the bench on the washing tier (new country)
    [94.0, 69.48, -125.0],   // (v1.70, #317) by the bench on the washing tier (new country)
    [-107.0, -4.00, -75.0],   // (v1.70, #317) by the sapling in its pot
    [-111.0, -4.00, -59.0],   // (v1.70, #317) by the sapling in its pot
    [-56.0, -1.68, -63.0],   // (v1.70, #317) on a summit
    [-47.0, 0.45, 29.0],   // (v1.70, #317) on a summit
    [-95.0, -4.00, -59.0],   // (v1.70, #317) by the sapling in its pot
    [115.00, 14.00, -191.00],   // (v1.70, #317) at the Mooring-House’s outer apron, over the drop
    [27.0, -0.00, -101.0],   // (v1.70, #317) at the edge, over the drop
    [-92.0, -0.00, 21.0],   // (v1.70, #317) at the edge, over the drop
    [-88.0, -4.00, -76.0],   // (v1.70, #317) at the edge, over the drop
    [28.0, -0.00, -44.0],   // (v1.70, #317) at the edge, over the drop
    [-105.0, -4.00, -44.0],   // (v1.70, #317) at the edge, over the drop
    [-68.0, -0.00, 15.0],   // (v1.70, #317) at the edge, over the drop
    [77.00, 14.00, -190.00],   // (v1.70, #317) at the Mooring-House’s outer apron, over the drop
    [-75.0, -0.00, 45.0],   // (v1.70, #317) at the edge, over the drop
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
    [12.0, 25.00, -88.0],   // (v1.70, #317) on a summit (new country)
    [100.0, 8.32, -324.0],   // (v1.70, #317) on a tower over the street
    [30.0, 8.32, -78.0],   // (v1.70, #317) on a tower over the street (new country)
    [190.0, 0.00, -306.0],   // (v1.70, #317) tucked in among walls
    [-190.0, 0.00, -374.0],   // (v1.70, #317) tucked in among walls
    [32.0, 4.00, -58.0],   // (v1.70, #317) on a tower over the street
    [-220.0, 0.00, 156.0],   // (v1.70, #317) out at the end of the way
    [-152.0, 0.00, -306.0],   // (v1.70, #317) out at the end of the way
    [-8.0, 0.00, -446.0],   // (v1.70, #317) tucked in among walls
    [192.0, 0.00, -218.0],   // (v1.70, #317) out at the end of the way
    [-218.0, 0.00, -60.0],   // (v1.70, #317) out at the end of the way
    [-146.0, 0.00, -182.0],   // (v1.70, #317) out at the end of the way
    [-38.0, 3.34, 170.0],   // (v1.70, #317) out at the end of the way
    [104.00, 0.00, -392.00],   // (v1.70, #317) beside the set-back market towers
    [-110.0, 0.00, -400.0],   // (v1.70, #317) out at the end of the way
    [-150.0, 0.00, 60.0],   // (v1.70, #317) out at the end of the way
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
  // (`chart`: Anselm's chart bought, issue #520: the Map marks the fragments still to find, the Worlds page says when a
  // world has gone quiet; the total itself is never shown to the player, issue #519)
  return { found, total: FRAGMENT_TOTAL, worlds, chart: !!flags[CHART_FLAG] };
}

/** Anselm's chart (issue #520, src/fragment-shop.js): bought, the Map marks every fragment still hiding in the world. */
export const CHART_FLAG = 'thrum.chart';
