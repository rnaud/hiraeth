// The fragments of the singing light (docs/systems/fragments.md, issue #196): where they hide, world by world.
//
// The light sheds them where it passed, small splinters of its song that settled on the worlds' landmarks: in a ribcage,
// on a temple's steps, a tower's balcony, a moon's courtyard, a cairn (issue #550: never a bare ledge or corner); never
// on the way you are sent. Each is a
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
//
// Issue #550 ("fragment of lights should be in a place that makes sense, like the top of a building, or the center of a
// point of interest, right now they feel like a bit of random placement"): every one now on or in a named place of
// interest (FRAGMENT_PLACES below; tests/fragments-poi.test.js), 153 of the 288 moved, marked "(v1.87, #550)" with their
// place (their earlier marks kept). Picked by scripts/fragment-spots.mjs <world> --anchors (the slots already on a named
// place stay), under the same rules, the houses, halls and islands the walker reaches added as places where the sights
// alone held too few (tests/fragments-reach.js POI_THINGS, POI_PIECES). The Desert's two by the ship (#247) sit at the
// pilgrims' cairns there. A save keeps its count: the flags stay on their slots (a moved one found shows as found).

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
    [59.6, 19.92, 160.0],   // (#247; v1.87, #550) the first, easy: at the pilgrims’ cairn by the ship, 30 m from the ramp, the way the road comes down
    [31.6, 23.16, 166.0],   // (#247; v1.87, #550) the second, easy: at the next cairn up the pilgrims’ road, 60 m from the ramp
    [-376.0, 4.15, 629.9],   // (v1.66, #250) between the vertebrae of a ribcage in the west dunes
    [428.0, 28.32, 189.9],   // (v1.70, #317) on the giant’s hand
    [276.0, -1.73, 533.9],   // (v1.70, #317) among the fallen giant’s bones
    [-160.0, 10.40, 369.9],   // (v1.70, #317) among the sail tents
    [-256.0, -9.21, 491.9],   // (v1.70, #317) inside a ribcage
    [-418.0, 3.72, 619.9],   // (v1.70, #317) inside a ribcage
    [-52.0, 3.89, 771.9],   // (v1.70, #317) by the crashed hull
    [582.00, 43.67, 379.90],   // (v1.70, #317) on the Rose House’s raised stone terrace
    [562.0, 7.83, 99.9],   // (v1.70, #317) a boat stranded in the dry wash
    [302.0, 12.86, 41.9],   // (v1.70, #317; v1.87, #550) by a doorway the dune let go of
    [-308.0, 9.27, 411.9],   // (v1.70, #317; v1.87, #550) inside a ribcage
    [530.0, 39.82, 429.9],   // (v1.70, #317; v1.87, #550) on the Rose House’s terraces
    [-130.0, 17.24, 781.9],   // (v1.70, #317; v1.87, #550) on the crashed hull
    [648.0, 26.13, 37.9],   // (v1.70, #317; v1.87, #550) on the giant’s arm
    [188.0, -12.87, -236.1],   // (v1.70, #317; v1.87, #550) inside a ribcage
    [412.0, 23.57, 211.9],   // (v1.70, #317; v1.87, #550) at the first qanat well
    [670.0, 27.68, 75.9],   // (v1.70, #317; v1.87, #550) on the giant’s arm
  ],
  arzach: [   // (v1.55, issue #187: picked afresh, scripts/fragment-spots.mjs, once the riders' road, the sundial and the broken edge were in)
    [216.0, 40.00, -580.0],   // (v1.66, #250) by Ondine’s tally, on the island’s edge
    [-4.0, 26.00, -940.0],   // (v1.61, #228) a slab tipped up at the plain’s broken edge
    [-434.0, 63.51, -1074.0],   // (v1.87, #550) on the Aerie
    [42.0, 53.07, -1338.0],   // (v1.61, #228; v1.66, #250) at the hour stone toward the riders’ gate, on the sundial
    [-24.0, 22.92, -1018.0],   // (v1.61, #228) under a tipped slab past the riders’ gate
    [-140.0, 46.42, -1184.0],   // (v1.87, #550) by the shop in the hoodoo
    [-86.0, 37.21, 52.0],   // (v1.87, #550) by the Founders’ Belfry
    [-2.0, 24.68, -998.0],   // (v1.87, #550) on the slabs tipped out of the plain
    [-4.0, 48.85, -1372.0],   // (v1.70, #317; v1.87, #550) at the hour stone toward the landing
    [12.0, 25.68, -1010.0],   // (v1.70, #317; v1.87, #550) on the slabs tipped out of the plain
    [-306.0, 46.83, -1022.0],   // (v1.70, #317; v1.87, #550) by the rider’s mounting stone
    [-24.0, 22.42, -1034.0],   // (v1.70, #317; v1.87, #550) on the first broken slab
    [-152.0, 20.38, -890.0],   // (v1.70, #317; v1.87, #550) on the stone tables over the cloud
    [-20.0, 53.30, -1372.0],   // (v1.70, #317) by the hour stone toward the landing (new country)
    [14.0, 28.07, -954.0],   // (v1.70, #317; v1.87, #550) on the slabs tipped out of the plain
    [-400.0, 69.19, -1148.0],   // (v1.70, #317; v1.87, #550) on the Aerie
    [-414.0, 59.51, -1048.0],   // (v1.70, #317; v1.87, #550) on the Aerie
    [42.0, 52.77, -1356.0],   // (v1.70, #317; v1.87, #550) at the hour stone toward the riders’ gate
    [-86.0, 25.76, -8.0],   // (v1.70, #317; v1.87, #550) by the Founders’ Belfry
    [-142.0, 12.46, -900.0],   // (v1.70, #317; v1.87, #550) on the stone tables over the cloud
    [-156.0, 13.13, -912.0],   // (v1.70, #317; v1.87, #550) on the stone tables over the cloud
    [-38.0, 53.56, -1366.0],   // (v1.70, #317; v1.87, #550) on the riders’ road’s worn steps
    [-86.0, 39.44, 4.0],   // (v1.70, #317; v1.87, #550) by the Founders’ Belfry
    [-260.0, 61.07, -1258.0],   // (v1.70, #317; v1.87, #550) among the great bird’s bones
  ],
  perdide: [
    [-14.0, 70.00, -756.0],   // (v1.87, #550) up on the keepers’ canopy, by their hut
    [-142.0, 2.20, 144.0],   // (v1.87, #550) at the Hush-House
    [54.0, -1.01, -916.0],   // (v1.61, #228; v1.87, #550) at the Lamp-House
    [-54.0, -0.64, -530.0],   // (v1.66, #250) among the keepers’ stalks
    [-84.0, 0.56, -700.0],   // (v1.61, #228) on the egg isle’s heap, in the drowned wood
    [24.0, -0.73, -744.0],   // (v1.61, #228; v1.87, #550) on the keepers’ stair
    [88.0, 2.65, 0.0],   // (v1.87, #550) in the makers’ court
    [16.0, 0.63, -898.0],   // (v1.87, #550) at the Lamp-House
    [38.0, -0.63, -910.0],   // (v1.70, #317; v1.87, #550) at the Lamp-House
    [54.0, 7.33, -34.0],   // (v1.70, #317) by Wendel’s lookout
    [-128.0, 2.20, 66.0],   // (v1.70, #317; v1.87, #550) at the Hush-House
    [-40.0, 10.11, -518.0],   // (v1.70, #317) on a shroom’s cap
    [10.0, 0.32, -752.0],   // (v1.70, #317) on the keepers’ stair (new country)
    [92.0, 2.65, 18.0],   // (v1.70, #317; v1.87, #550) in the makers’ court
    [-12.0, -0.23, -550.0],   // (v1.70, #317; v1.87, #550) by the moss-dome shop
    [36.0, -0.83, -936.0],   // (v1.70, #317; v1.87, #550) at the Lamp-House
    [70.0, 2.65, 14.0],   // (v1.70, #317; v1.87, #550) in the makers’ court
    [-62.0, -1.47, -820.0],   // (v1.70, #317) beneath the cap square, in the shallows
    [56.0, -1.32, -936.0],   // (v1.70, #317; v1.87, #550) at the Lamp-House
    [-124.0, 2.20, 140.0],   // (v1.70, #317; v1.87, #550) at the Hush-House
    [-146.0, 2.20, 72.0],   // (v1.70, #317; v1.87, #550) at the Hush-House
    [-24.0, 3.64, -510.0],   // (v1.70, #317; v1.87, #550) on a shroom’s cap
    [-138.0, 2.20, 128.0],   // (v1.70, #317; v1.87, #550) at the Hush-House
    [10.0, -1.04, -736.0],   // (v1.70, #317; v1.87, #550) on the keepers’ stair
  ],
  edena: [
    [26.0, 16.47, 144.0],   // (v1.66, #250) on a cap of the pyramid nursery, 16 m up
    [40.0, 8.29, 226.0],   // (v1.87, #550) among the trees on the nursery’s terraces
    [14.0, 35.79, 240.0],   // (v1.61, #228) on the old pyramid’s terraces, 36 m up
    [150.0, -15.60, -80.0],   // (v1.61, #228) on the round ship’s hill
    [154.0, -16.01, -64.0],   // (v1.87, #550) on the round ship’s hill
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
    [42.0, 7.22, 132.0],   // (v1.70, #317; v1.87, #550) on a cap of the pyramid nursery
    [130.0, -15.70, -158.0],   // (v1.70, #317; v1.87, #550) by the dish pond
    [56.0, 0.57, 96.0],   // (v1.70, #317; v1.87, #550) by the nursery’s seedling beds
    [-36.0, -0.25, -98.0],   // (v1.70, #317; v1.87, #550) by the runnel’s basin
    [14.0, -14.20, -118.0],   // (v1.70, #317; v1.87, #550) on the builders’ machine
    [-2.0, -7.56, -120.0],   // (v1.70, #317; v1.87, #550) on the builders’ machine
    [-2.0, 3.83, 42.0],   // (v1.70, #317; v1.87, #550) by the split meteor
    [18.0, -15.89, -144.0],   // (v1.70, #317; v1.87, #550) on the builders’ machine
    [-34.0, -1.33, -82.0],   // (v1.70, #317; v1.87, #550) by the runnel’s basin
  ],
  underwater: [
    [186.2, -7.20, -54.9],   // (v1.61, #228) the far café’s terrace, over the canyon
    [174.2, -28.08, -50.9],   // (v1.87, #550) on a tower of pods
    [136.2, -0.60, 27.1],   // (v1.61, #228) out on the seabed, at a pod tower’s foot
    [157.6, -64.00, -72.0],   // (v1.66, #250) among the whale bones on the canyon’s floor
    [138.2, -26.25, -68.9],   // (v1.61, #228) a pod tower’s ring down the canyon’s wall
    [-155.8, 0.90, -212.9],   // (v1.61, #228; v1.87, #550) on a tower of pods
    [146.2, -7.20, -50.9],   // (v1.61, #228) on the white bridge over the canyon
    [170.2, -7.20, -50.9],   // (v1.87, #550) on a tower of pods
    [168.2, -6.52, -32.9],   // (v1.70, #317) on a tower of pods (new country)
    [130.2, -44.86, -144.9],   // (v1.70, #317) on a tower of pods
    [-53.8, 4.71, -38.9],   // (v1.70, #317) on a tower of pods
    [-153.8, -0.37, 73.1],   // (v1.70, #317) on a tower of pods
    [-45.8, 4.38, 77.1],   // (v1.70, #317) on a tower of pods
    [-139.8, -0.55, -36.9],   // (v1.70, #317) on a tower of pods
    [56.47, 3.86, 180.10],   // (v1.70, #317) on the relocated pod tower’s lower ledge
    [131.6, -54.36, -194.0],   // (v1.70, #317) on a tower of pods
    [147.6, -64.00, -58.0],   // (v1.70, #317; v1.87, #550) on a tower of pods
    [173.6, -64.00, -112.0],   // (v1.70, #317) on a tower of pods (new country)
    [-87.8, -0.50, 89.1],   // (v1.70, #317) on a tower of pods
    [174.2, -64.00, -68.9],   // (v1.70, #317; v1.87, #550) on a tower of pods
    [171.6, -63.76, -174.0],   // (v1.70, #317) on a tower of pods
    [-47.8, -0.60, 175.1],   // (v1.70, #317) on a tower of pods
    [64.2, -0.70, -28.9],   // (v1.70, #317) on a tower of pods
    [173.6, -64.00, -138.0],   // (v1.70, #317) on a tower of pods
  ],
  incal: [
    [-24.0, 150.00, -40.0],   // (v1.87, #550) on the high ring round the spire
    [38.0, 150.00, 28.0],   // (v1.87, #550) on the high ring round the spire
    [-92.0, 150.00, 172.0],   // (v1.66, #250) under the cab-wrights’ crane
    [34.0, 150.00, -32.0],   // (v1.87, #550) on the high ring round the spire
    [144.0, 200.00, 220.0],   // (v1.66, #250) by the great mirror, on the rim’s top
    [354.0, 200.00, 94.0],   // (v1.66, #250) by Tobin’s telescopes on the rim
    [192.0, 150.00, 8.0],   // (v1.66, #250) in a stall of the balcony market
    [46.0, 150.00, 0.0],   // (v1.87, #550) on the high ring round the spire
    [-24.0, 150.00, 40.0],   // (v1.70, #317; v1.87, #550) on the high ring round the spire
    [10.0, 150.00, 46.0],   // (v1.70, #317; v1.87, #550) on the high ring round the spire
    [42.0, 150.00, -18.0],   // (v1.70, #317; v1.87, #550) on the high ring round the spire
    [6.0, 150.00, -46.0],   // (v1.70, #317; v1.87, #550) on the high ring round the spire
    [342.0, 200.00, -88.0],   // (v1.70, #317; v1.87, #550) at the Warden’s Well, on the rim
    [162.0, 200.00, 208.0],   // (v1.70, #317; v1.87, #550) by the great mirror, on the rim
    [338.0, 200.00, -6.0],   // (v1.70, #317; v1.87, #550) on the Rim Docks’ berth
    [338.0, 200.00, -22.0],   // (v1.70, #317; v1.87, #550) on the Rim Docks’ berth
    [326.0, 200.00, 4.0],   // (v1.70, #317; v1.87, #550) on the Rim Docks’ berth
    [342.0, 200.00, 10.0],   // (v1.70, #317; v1.87, #550) on the Rim Docks’ berth
    [322.0, 200.00, -20.0],   // (v1.70, #317; v1.87, #550) on the Rim Docks’ berth
    [292.0, 200.00, -114.0],   // (v1.70, #317; v1.87, #550) at the Warden’s Well, on the rim
    [366.0, 200.00, -74.0],   // (v1.70, #317; v1.87, #550) at the Warden’s Well, on the rim
    [312.0, 200.00, -106.0],   // (v1.70, #317; v1.87, #550) at the Warden’s Well, on the rim
    [282.0, 200.00, -98.0],   // (v1.70, #317; v1.87, #550) at the Warden’s Well, on the rim
    [366.0, 200.00, -114.0],   // (v1.70, #317; v1.87, #550) at the Warden’s Well, on the rim
  ],
  glassdunes: [
    [28.0, 28.33, 34.0],   // (v1.87, #550) by the wave’s cairn, on the frozen wave’s crest
    [-244.0, -0.26, 278.0],   // (v1.87, #550) on the vermilion stair
    [12.0, 27.32, 36.0],   // (v1.66, #250) by the wave’s cairn, on the frozen wave’s crest
    [-324.0, -0.58, -154.0],   // (v1.87, #550) in the pearl city
    [-78.0, 90.99, -242.0],   // (v1.66, #250) by the breaker’s cairn, 91 m up on the breaking wave
    [-334.0, 1.99, 14.0],   // (v1.87, #550) at the prism crossings
    [0.0, 0.42, 284.0],   // (v1.66, #250; v1.87, #550) in the Float Yard
    [-36.0, 6.03, -246.0],   // (v1.66, #250) on the glass that holds the moment in the wave
    [-126.0, 1.71, 212.0],   // (v1.70, #317; v1.87, #550) in the painted stair quarter
    [-178.0, 3.18, -8.0],   // (v1.70, #317) on the glass that holds a stopped minute (the dust)
    [-20.0, 2.00, 40.0],   // (v1.70, #317) by the passage through the frozen wave
    [134.0, 1.88, -28.0],   // (v1.70, #317) by the carriers’ shade
    [14.0, 4.96, -202.0],   // (v1.70, #317) by the north camp
    [-136.0, 8.46, 24.0],   // (v1.70, #317) by the west camp
    [156.0, 2.78, -62.0],   // (v1.70, #317) on the wind-glass
    [48.0, 2.68, 38.0],   // (v1.70, #317) on the glass that holds a stopped minute (the flock)
    [-156.0, 2.71, 4.0],   // (v1.70, #317) by the dust in the cliff
    [104.0, 2.51, 18.0],   // (v1.70, #317) by the carriers’ float-sledge
    [278.0, 1.42, -152.0],   // (v1.70, #317; v1.87, #550) in the half-buried court
    [-336.0, 2.94, 192.0],   // (v1.70, #317; v1.87, #550) in the folded ravine
    [-76.0, 89.23, -226.0],   // (v1.70, #317; v1.87, #550) by the breaker’s cairn, way up the breaking wave
    [166.0, 0.05, 106.0],   // (v1.70, #317; v1.87, #550) by the carriers in the glass
    [20.0, 30.94, 20.0],   // (v1.70, #317; v1.87, #550) by the wave’s cairn, on the frozen wave’s crest
    [140.0, 2.74, -52.0],   // (v1.70, #317; v1.87, #550) on the wind-glass
  ],
  buried: [
    [-44.0, -32.63, -274.0],   // (v1.61, #228; v1.66, #250) behind the oil fall, at the canyon’s foot
    [-120.0, 13.13, 128.0],   // (v1.87, #550) at the Engine-House
    [28.0, -3.77, -328.0],   // (v1.87, #550) on the keepers’ gangway
    [-124.0, 13.13, 68.0],   // (v1.66, #250; v1.87, #550) at the Engine-House
    [-6.0, 14.79, -356.0],   // (v1.87, #550) up on the keepers’ crown
    [-146.0, 13.13, 106.0],   // (v1.87, #550) at the Engine-House
    [16.0, 7.77, -344.0],   // (v1.66, #250) on the keepers’ gangway
    [12.0, 7.98, -136.0],   // (v1.66, #250) on a cap of the Tooth Day posts
    [22.0, -11.55, -312.0],   // (v1.70, #317) on the keepers’ gangway
    [76.0, 14.85, -60.0],   // (v1.70, #317) among the Tooth Day posts
    [20.0, 6.87, -100.0],   // (v1.70, #317) among the Tooth Day posts
    [28.0, 5.49, -298.0],   // (v1.70, #317) on the keepers’ gangway
    [-30.0, -33.94, -290.0],   // (v1.70, #317) by the oil fall
    [-136.0, 13.13, 120.0],   // (v1.70, #317; v1.87, #550) at the Engine-House
    [-126.0, 13.13, 104.0],   // (v1.70, #317; v1.87, #550) at the Engine-House
    [18.0, 6.48, 124.0],   // (v1.70, #317; v1.87, #550) at the old port
    [-40.0, -5.58, -290.0],   // (v1.70, #317; v1.87, #550) by the keepers’ lectern, at the broken oil pipe
    [-12.0, 4.38, 132.0],   // (v1.70, #317; v1.87, #550) under the freight stage’s crane
    [34.0, 14.79, -342.0],   // (v1.70, #317; v1.87, #550) on the keepers’ gangway
    [36.0, 10.61, -112.0],   // (v1.70, #317; v1.87, #550) among the Tooth Day posts
    [-46.0, 8.09, -320.0],   // (v1.70, #317; v1.87, #550) by the keepers’ lectern, at the broken oil pipe
    [2.0, 5.64, 124.0],   // (v1.70, #317; v1.87, #550) at the old port
    [18.0, 6.65, 108.0],   // (v1.70, #317; v1.87, #550) at the old port
    [-38.0, 3.09, -346.0],   // (v1.70, #317; v1.87, #550) by the keepers’ lectern, at the broken oil pipe
  ],
  moonfoundry: [
    [10.0, 13.06, -208.0],
    [-23.0, 37.12, -197.0],   // (v1.61, #228) a landing of the broken moon’s stair street, 37 m up
    [-89.0, 13.06, -164.0],   // (v1.66, #250) on the bowl’s deck, among its garden
    [30.0, 31.77, -201.0],   // (v1.61, #228; v1.87, #550) in the broken moon
    [-8.0, 30.25, -216.0],   // (v1.61, #228) behind a house on the stair street, 30 m up
    [-85.0, 13.06, -136.0],   // (v1.61, #228; v1.87, #550) on the bowl
    [21.0, 13.06, -186.0],   // (v1.87, #550) in the broken moon
    [-71.0, 0.00, -112.0],   // (v1.66, #250) against the cracked mould
    [60.0, 0.63, 55.0],   // (v1.70, #317) by the footbridge over the long runnel (new country)
    [-70.0, 13.06, -143.0],   // (v1.70, #317) on the bowl
    [87.0, 0.00, -79.0],   // (v1.70, #317) by the footbridge over the furnace runnel (new country)
    [-38.0, 0.00, -104.0],   // (v1.70, #317) by the footbridge over the west runnel (new country)
    [52.0, 0.00, -112.0],   // (v1.70, #317) by the footbridge over the west runnel (new country)
    [-8.0, 13.06, -189.0],   // (v1.70, #317) on the courtyard in the broken moon
    [33.0, 0.00, 50.0],   // (v1.70, #317) by the steps down into the long runnel (new country)
    [-102.0, 13.06, -153.0],   // (v1.70, #317; v1.87, #550) on the bowl
    [70.0, 4.81, -107.0],   // (v1.70, #317; v1.87, #550) by the moon in its cradle
    [60.0, 2.40, -81.0],   // (v1.70, #317; v1.87, #550) by the moon in its cradle
    [75.0, 2.11, -91.0],   // (v1.70, #317; v1.87, #550) by the moon in its cradle
    [144.0, 0.00, -169.0],   // (v1.70, #317; v1.87, #550) at the Casting-House
    [-56.0, 0.00, -104.0],   // (v1.70, #317; v1.87, #550) by the cracked mould
    [45.0, 0.00, 62.0],   // (v1.70, #317; v1.87, #550) by the steps down into the long runnel
    [155.0, 0.00, -136.0],   // (v1.70, #317; v1.87, #550) at the Casting-House
    [156.0, 0.00, -181.0],   // (v1.70, #317; v1.87, #550) at the Casting-House
  ],
  spheres: [
    [-219.5, 54.69, -144.5],   // (v1.66, #250) on the white hill’s pyramid, by the temple on its top (the far corner from the Pyramid key)
    [236.0, -1.99, 36.0],   // (v1.61, #228; v1.87, #550) by the cairn at the yellow sphere’s furrow
    [-122.0, 2.38, -456.0],   // (v1.66, #250) in the empty arcade in the android wood
    // (v1.56, issue #190: these two picked afresh by scripts/fragment-spots.mjs spheres once the explorations were built;
    //  the old ones, on an umbrella's flaring roots by the plaza and under one far west, were left too close to a ledge)
    [-262.0, 17.64, 226.0],   // (v1.87, #550) at the Footprint
    [-88.0, -4.32, -268.0],   // (v1.66, #250) on the terraces round the sphere west of the arch
    [206.0, -1.83, -302.0],   // (v1.66, #250) in the ring of stones at the white monolith
    [-194.0, 15.98, 308.0],   // (v1.87, #550) at the Footprint
    [252.0, -0.74, 38.0],   // (v1.66, #250) by the cairn at the yellow sphere’s furrow
    [-196.0, 34.44, -150.0],   // (v1.70, #317) on the white hill’s pyramid
    [58.0, -1.27, 120.0],   // (v1.70, #317) by the lantern at the white stone
    [-234.0, 32.19, -160.0],   // (v1.70, #317) on the white hill’s pyramid
    [122.0, 0.35, -178.0],   // (v1.70, #317) on the lake’s pyramid
    [-86.0, 0.39, -194.0],   // (v1.70, #317) on the meadow’s pyramid
    [-58.0, 0.39, -194.0],   // (v1.70, #317) on the meadow’s pyramid
    [-92.0, 0.39, -140.0],   // (v1.70, #317) on the meadow’s pyramid
    [-268.0, -0.79, 326.0],   // (v1.70, #317) tucked in among walls
    [16.0, 3.94, -180.0],   // (v1.70, #317; v1.87, #550) by the pavilion shop
    [86.0, 0.46, -60.0],   // (v1.70, #317; v1.87, #550) on a great sphere
    [118.0, 0.35, -196.0],   // (v1.70, #317; v1.87, #550) on the lake’s pyramid
    [-72.0, 0.68, -264.0],   // (v1.70, #317; v1.87, #550) on the terraces round the sphere west of the arch
    [-84.0, -1.82, -252.0],   // (v1.70, #317; v1.87, #550) on the terraces round the sphere west of the arch
    [-110.0, 0.79, -444.0],   // (v1.70, #317; v1.87, #550) in the empty arcade in the android wood
    [198.0, -1.90, -316.0],   // (v1.70, #317; v1.87, #550) in the ring of stones at the white monolith
    [60.0, -1.22, 104.0],   // (v1.70, #317; v1.87, #550) by the lantern at the white stone
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
    [88.0, 43.36, -116.0],   // (v1.70, #317; v1.87, #550) up the stack
    [-22.0, 0.00, -42.0],   // (v1.70, #317; v1.87, #550) on the Market island
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
    [58.0, 0.00, -38.0],   // (v1.87, #550) by the screen lanes
    [22.0, 0.30, 164.0],   // (v1.87, #550) out on the port’s apron
    [-34.0, 8.32, -144.0],   // (v1.87, #550) on a tower over the street
    [64.0, 0.00, -52.0],   // (v1.61, #228; v1.87, #550) by the screen lanes
    [34.0, 8.32, -274.0],   // (v1.66, #250) on a tower’s service balcony over Signal Square
    [-74.0, 0.00, -64.0],   // (v1.66, #250) by the radio-mender’s table in the listeners’ lane
    [28.0, 0.30, -176.0],   // (v1.70, #317; v1.87, #550) by the old market, down a storey
    [100.0, 8.32, -324.0],   // (v1.70, #317) on a tower over the street
    [30.0, 8.32, -78.0],   // (v1.70, #317) on a tower over the street (new country)
    [38.0, 0.00, 64.0],   // (v1.70, #317; v1.87, #550) out on the port’s apron
    [40.0, 0.00, 128.0],   // (v1.70, #317; v1.87, #550) out on the port’s apron
    [32.0, 4.00, -58.0],   // (v1.70, #317) on a tower over the street
    [26.0, 0.30, -150.0],   // (v1.70, #317; v1.87, #550) by the old market, down a storey
    [36.0, 0.00, 108.0],   // (v1.70, #317; v1.87, #550) out on the port’s apron
    [-88.0, 0.00, -56.0],   // (v1.70, #317; v1.87, #550) by the radio-mender’s table
    [36.0, 0.00, -162.0],   // (v1.70, #317; v1.87, #550) by the old market, down a storey
    [30.0, 0.30, -132.0],   // (v1.70, #317; v1.87, #550) by the old market, down a storey
    [-22.0, 0.30, 152.0],   // (v1.70, #317; v1.87, #550) by the board of call-signs
    [22.0, 0.30, 140.0],   // (v1.70, #317; v1.87, #550) out on the port’s apron
    [2.0, 0.00, 140.0],   // (v1.70, #317; v1.87, #550) out on the port’s apron
    [40.0, 0.00, 80.0],   // (v1.70, #317; v1.87, #550) out on the port’s apron
    [64.0, 0.00, 184.0],   // (v1.70, #317; v1.87, #550) out on the port’s apron
  ],
};

/**
 * Where each lies (issue #550, the author: "fragment of lights should be in a place that makes sense, like the top of a
 * building, or the center of a point of interest, right now they feel like a bit of random placement"): the place of
 * interest it stands on or in, one a slot, as tests/fragments-reach.js pointsOfInterest names it (a sight of the level, a
 * beacon, a named thing of the scene, one of the level's own pieces). tests/fragments-poi.test.js checks each is there.
 */
export const FRAGMENT_PLACES = {
  desert: [
    'Ribcage', 'The Rose House (2)', 'the giant’s arm over the dry wash', 'Crashed hull', 'Ribcage (5)',
    'the pilgrims’ cairn (9)', 'the pilgrims’ cairn (8)', 'Ribcage (4)', 'the giant’s hand', 'Fallen giant',
    'Sail tents', 'Ribcage (5)', 'Ribcage (4)', 'Crashed hull', 'The Rose House (2)',
    'a boat stranded in the dry wash', 'a doorway the dune let go of', 'Ribcage (5)', 'The Rose House (2)',
    'Crashed hull', 'The giant’s arm', 'Ribcage', 'the first qanat well', 'The giant’s arm',
  ],
  arzach: [
    'Ondine’s tally', 'The stones that fell up', 'The Aerie (2)', 'the hour stone toward the riders’ gate',
    'the first broken slab', 'shopfront.hoodoo', 'The Founders’ Belfry (2)', 'The slabs tipped out of the plain',
    'the hour stone toward the landing', 'The slabs tipped out of the plain', 'the rider’s mounting stone',
    'the first broken slab', 'The tables of the plain over the cloud', 'the hour stone toward the landing',
    'The slabs tipped out of the plain', 'The Aerie (2)', 'The Aerie (2)', 'the hour stone toward the riders’ gate',
    'The Founders’ Belfry (2)', 'The tables of the plain over the cloud', 'The tables of the plain over the cloud',
    'The riders’ road: the worn steps', 'The Founders’ Belfry (2)', 'The great bird’s bones',
  ],
  perdide: [
    'The keepers’ canopy (hut)', 'The Hush-House (2)', 'The Lamp-House (2)', 'The keepers’ stalks', 'the egg isle',
    'the keepers’ stair', 'Makers’ court (stun)', 'The Lamp-House (2)', 'The Lamp-House (2)', 'Wendel’s lookout',
    'The Hush-House (2)', 'shroom-top', 'the keepers’ stair', 'Makers’ court (stun)', 'shopfront.mossdome',
    'The Lamp-House (2)', 'Makers’ court (stun)', 'The cap square', 'The Lamp-House (2)', 'The Hush-House (2)',
    'The Hush-House (2)', 'shroom-top', 'The Hush-House (2)', 'the keepers’ stair',
  ],
  edena: [
    'The pyramid nursery’s caps', 'The pyramid nursery’s terrace trees', 'the old pyramid’s top',
    'The round ship’s hill', 'The round ship’s hill', 'The split meteor (west half)', 'the builders’ machine',
    'the dish pond', 'The pyramid nursery’s terrace trees', 'The pyramid nursery’s terrace trees',
    'The pyramid nursery’s caps', 'The water stair', 'The round ship’s hill', 'the pyramid nursery’s seedling beds',
    'the runnel’s basin', 'The pyramid nursery’s caps', 'the dish pond', 'the pyramid nursery’s seedling beds',
    'the runnel’s basin', 'The builders’ machine', 'The builders’ machine', 'the split meteor',
    'The builders’ machine', 'the runnel’s basin',
  ],
  underwater: [
    'the far wall’s café', 'a tower of pods (15)', 'a tower of pods (10)', 'the whale bones on the canyon’s floor',
    'a tower of pods (11)', 'a tower of pods (5)', 'the bridge over the canyon', 'a tower of pods (15)',
    'a tower of pods (19)', 'a tower of pods (17)', 'a tower of pods (4)', 'a tower of pods (14)',
    'a tower of pods (1)', 'a tower of pods (9)', 'a tower of pods (13)', 'a tower of pods (18)',
    'a tower of pods (11)', 'a tower of pods (21)', 'a tower of pods (8)', 'a tower of pods (20)',
    'a tower of pods (23)', 'a tower of pods (12)', 'a tower of pods (3)', 'a tower of pods (22)',
  ],
  incal: [
    'the spire’s high ring', 'the spire’s high ring', 'the cab-wrights’ crane', 'the spire’s high ring',
    'the great mirror', 'Tobin’s telescopes', 'the balcony market', 'the spire’s high ring', 'the spire’s high ring',
    'the spire’s high ring', 'the spire’s high ring', 'the spire’s high ring', 'The Warden’s Well (2)',
    'the great mirror', 'berth body', 'berth body', 'berth body', 'berth body', 'berth body', 'The Warden’s Well (2)',
    'The Warden’s Well (2)', 'The Warden’s Well (2)', 'The Warden’s Well (2)', 'The Warden’s Well (2)',
  ],
  glassdunes: [
    'the wave’s cairn', 'the vermilion stair', 'the wave’s cairn', 'the pearl city', 'the breaker’s cairn',
    'the prism crossings', 'the Float Yard', 'the moment in the wave', 'the painted stair quarter',
    'The glass that holds a stopped minute (dust)', 'the passage through the frozen wave', 'the carriers’ shade',
    'the north camp, under the breaking wave', 'the west camp', 'the wind-glass',
    'The glass that holds a stopped minute (flock)', 'the dust in the cliff', 'the carriers’ float-sledge',
    'the half-buried court', 'the folded ravine', 'the breaker’s cairn', 'the carriers in the glass',
    'the wave’s cairn', 'the wind-glass',
  ],
  buried: [
    'the oil fall', 'The Engine-House (2)', 'The keepers’ gangway', 'The Engine-House (2)', 'the keepers’ crown',
    'The Engine-House (2)', 'The keepers’ gangway', 'The Tooth Day posts', 'The keepers’ gangway',
    'The Tooth Day posts', 'The Tooth Day posts', 'The keepers’ gangway', 'the oil fall', 'The Engine-House (2)',
    'The Engine-House (2)', 'buried port', 'The broken oil pipe and the keepers’ lectern',
    'the freight stage’s crane', 'The keepers’ gangway', 'The Tooth Day posts',
    'The broken oil pipe and the keepers’ lectern', 'buried port', 'buried port',
    'The broken oil pipe and the keepers’ lectern',
  ],
  moonfoundry: [
    'the broken moon', 'the broken moon', 'the bowl', 'the broken moon', 'the broken moon', 'the bowl',
    'the broken moon', 'the cracked mould', 'the footbridge over the long runnel', 'the bowl',
    'the footbridge over the furnace runnel', 'the footbridge over the west runnel',
    'the footbridge over the west runnel', 'the courtyard in the broken moon', 'the steps down into the long runnel',
    'the bowl', 'the moon in its cradle', 'the moon in its cradle', 'the moon in its cradle', 'The Casting-House (2)',
    'the cracked mould', 'the steps down into the long runnel', 'The Casting-House (2)', 'The Casting-House (2)',
  ],
  spheres: [
    'the white hill’s pyramid', 'the cairn at the yellow sphere’s furrow', 'the empty arcade in the android wood',
    'The Footprint (2)', 'the terraces round the sphere west of the arch', 'the ring of stones at the white monolith',
    'The Footprint (2)', 'the cairn at the yellow sphere’s furrow', 'the white hill’s pyramid',
    'the lantern at the white stone', 'the white hill’s pyramid', 'the lake’s pyramid', 'the meadow’s pyramid',
    'the meadow’s pyramid', 'the meadow’s pyramid', 'The Footprint (2)', 'shopfront.pavilion', 'a great sphere (2)',
    'the lake’s pyramid', 'the terraces round the sphere west of the arch',
    'the terraces round the sphere west of the arch', 'the empty arcade in the android wood',
    'the ring of stones at the white monolith', 'the lantern at the white stone',
  ],
  spacecity: [
    'the stack’s top', 'the yard', 'the stack (high)', 'the market', 'the market', 'the market',
    'the telescope at the Pier’s end', 'the garden', 'the bench on the washing tier', 'the bench on the washing tier',
    'the sapling in its pot', 'the sapling in its pot', 'the stack (high)', 'the market', 'the sapling in its pot',
    'The Mooring-House (2)', 'the market', 'the yard', 'the garden', 'the market', 'the garden', 'the yard',
    'The Mooring-House (2)', 'the yard',
  ],
  bazaar: [
    'a tower over the street (8)', 'a tower over the street (10)', 'The screen lanes: the face', 'bazaar port',
    'a tower over the street (9)', 'The screen lanes: the face', 'a tower over the street (14)',
    'the radio-mender’s table', 'The old market', 'a tower over the street (16)', 'a tower over the street (8)',
    'bazaar port', 'bazaar port', 'a tower over the street (8)', 'The old market', 'bazaar port',
    'the radio-mender’s table', 'The old market', 'The old market', 'the board of call-signs', 'bazaar port',
    'bazaar port', 'bazaar port', 'bazaar port',
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
