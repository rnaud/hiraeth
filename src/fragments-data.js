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
// point of interest, right now they feel like a bit of random placement"): every one now ON a named place of interest
// (FRAGMENT_PLACES below; tests/fragments-poi.test.js: at a sight's mark, on a named thing or in its middle, raised on a
// floor-like one, in a piece of the level), out of the water, a place holding two at most (three a very big one), and
// where a world's places run out the rest spread over it, each on a little cairn or plinth set for it
// (src/fragment-markers.js). 223 of the 288 moved, marked "(v1.87, #550)" with their place (their earlier marks kept).
// Picked by scripts/fragment-spots.mjs <world> --anchors. The Desert's two by the ship (#247) sit at the pilgrims'
// cairns there. A save keeps its count: the flags stay on their slots (a moved one found shows as found).
//
// Its third pass: in the Signal Market and on the City-Shaft's rim the plinths stood at the foot of tower walls. Where
// each stood, a small building with a way up (a water tank, a stall block, a signal platform, a kiosk; on the rim a
// cistern, a shed, a lamplighters' platform, a pavilion) or a square's centrepiece (a fountain, a statue, a bandstand)
// now stands, the fragment on its top (src/fragment-landmarks.js; its place `landmarkName`); 32 moved in their slots,
// their notes saying where on it.

import { ORDER, TITLES } from './levels/names.js';

/** How many hide in each world on the route (8 until v1.70; issue #317). */
export const FRAGMENTS_PER_WORLD = 24;

export const FRAGMENTS = {
  desert: [
    [128.0, -16.20, -200.1],   // (v1.66, #250; v1.87, #550) inside a ribcage
    [558.00, 43.67, 345.90],
    [658.0, 24.45, 51.9],
    [-166.0, 27.03, 745.9],
    [-324.0, 7.61, 395.9],
    [59.6, 19.92, 160.0],   // (#247; v1.87, #550) the first, easy: at the pilgrims’ cairn by the ship, 30 m from the ramp, the way the road comes down
    [31.6, 23.16, 166.0],   // (#247; v1.87, #550) the second, easy: at the next cairn up the pilgrims’ road, 60 m from the ramp
    [-162.0, 10.93, 359.9],   // (v1.66, #250; v1.87, #550) among the sail tents
    [4.0, 21.37, 193.9],   // (v1.70, #317; v1.87, #550) by a pilgrims’ cairn on the old road
    [-386.0, 4.23, 629.9],   // (v1.70, #317; v1.87, #550) inside a ribcage
    [-450.0, 3.74, -268.1],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [434.0, 29.20, 185.9],   // (v1.70, #317; v1.87, #550) on the giant’s hand
    [-418.0, 3.72, 619.9],   // (v1.70, #317) inside a ribcage
    [-52.0, 3.89, 771.9],   // (v1.70, #317) by the crashed hull
    [582.00, 43.67, 379.90],   // (v1.70, #317) on the Rose House’s raised stone terrace
    [562.0, 7.83, 99.9],   // (v1.70, #317) a boat stranded in the dry wash
    [-196.0, 16.98, 363.9],   // (v1.70, #317; v1.87, #550) among the sail tents
    [-308.0, 9.27, 411.9],   // (v1.70, #317; v1.87, #550) inside a ribcage
    [530.0, 39.82, 429.9],   // (v1.70, #317; v1.87, #550) on the Rose House’s terraces
    [-124.0, 32.03, -510.1],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [648.0, 26.13, 37.9],   // (v1.70, #317; v1.87, #550) on the giant’s arm
    [188.0, -12.87, -236.1],   // (v1.70, #317; v1.87, #550) inside a ribcage
    [412.0, 23.57, 211.9],   // (v1.70, #317; v1.87, #550) at the first qanat well
    [392.0, 1.94, 785.9],   // (v1.70, #317; v1.87, #550) on a little stone cairn
  ],
  arzach: [   // (v1.55, issue #187: picked afresh, scripts/fragment-spots.mjs, once the riders' road, the sundial and the broken edge were in)
    [214.0, 40.00, -572.0],   // (v1.66, #250; v1.87, #550) on a little stone cairn
    [-4.0, 26.00, -940.0],   // (v1.61, #228) a slab tipped up at the plain’s broken edge
    [-434.0, 63.51, -1074.0],   // (v1.87, #550) on the Aerie
    [42.0, 53.01, -1342.0],   // (v1.61, #228; v1.66, #250; v1.87, #550) at the hour stone toward the riders’ gate
    [-28.0, 22.66, -1028.0],   // (v1.61, #228; v1.87, #550) on the first broken slab
    [-140.0, 46.42, -1184.0],   // (v1.87, #550) by the shop in the hoodoo
    [262.0, 34.84, -1106.0],   // (v1.87, #550) on a little stone cairn
    [-2.0, 24.68, -998.0],   // (v1.87, #550) on the slabs tipped out of the plain
    [-4.0, 48.85, -1372.0],   // (v1.70, #317; v1.87, #550) at the hour stone toward the landing
    [216.0, 40.00, -822.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-306.0, 46.83, -1022.0],   // (v1.70, #317; v1.87, #550) by the rider’s mounting stone
    [222.0, 37.88, -166.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-152.0, 20.38, -890.0],   // (v1.70, #317; v1.87, #550) on the stone tables over the cloud
    [458.0, 44.18, -890.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-620.0, 41.39, -1588.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-400.0, 69.19, -1148.0],   // (v1.70, #317; v1.87, #550) on the Aerie
    [-808.0, 43.60, -906.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-148.0, 26.19, -1756.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [460.0, 22.18, -1304.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-142.0, 12.46, -900.0],   // (v1.70, #317; v1.87, #550) on the stone tables over the cloud
    [-86.0, 37.21, 52.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-856.0, 31.11, -1286.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [216.0, 47.32, -1648.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-324.0, 47.58, -1496.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
  ],
  perdide: [
    [-428.0, 2.63, 60.0],   // (v1.87, #550) on a little stone cairn
    [-142.0, 2.20, 144.0],   // (v1.87, #550) at the Hush-House
    [52.0, 0.78, -912.0],   // (v1.61, #228; v1.87, #550) at the Lamp-House
    [-14.0, 3.24, -550.0],   // (v1.66, #250; v1.87, #550) by the moss-dome shop
    [-84.0, 0.56, -700.0],   // (v1.61, #228) on the egg isle’s heap, in the drowned wood
    [674.0, 21.05, -624.0],   // (v1.61, #228; v1.87, #550) on a little stone cairn
    [-696.0, 37.83, -446.0],   // (v1.87, #550) on a little stone cairn
    [16.0, 0.63, -898.0],   // (v1.87, #550) at the Lamp-House
    [-638.0, 0.18, 238.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [448.0, 1.56, -176.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-128.0, 2.20, 66.0],   // (v1.70, #317; v1.87, #550) at the Hush-House
    [-40.0, 10.11, -518.0],   // (v1.70, #317) on a shroom’s cap
    [-536.0, 0.10, -810.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [92.0, 2.65, 18.0],   // (v1.70, #317; v1.87, #550) in the makers’ court
    [430.0, 2.36, 422.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-412.0, 6.17, -162.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [70.0, 2.65, 14.0],   // (v1.70, #317; v1.87, #550) in the makers’ court
    [394.0, 1.09, -858.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [304.0, 1.38, -468.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-302.0, 1.34, -950.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [684.0, 4.74, -356.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-24.0, 3.64, -510.0],   // (v1.70, #317; v1.87, #550) on a shroom’s cap
    [-14.0, 70.00, -756.0],   // (v1.70, #317; v1.87, #550) up on the keepers’ canopy, by their hut
    [-362.0, 0.08, -626.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
  ],
  edena: [
    [58.0, 2.86, 150.0],   // (v1.66, #250; v1.87, #550) on a cap of the pyramid nursery
    [40.0, 8.29, 226.0],   // (v1.87, #550) among the trees on the nursery’s terraces
    [14.0, 35.79, 240.0],   // (v1.61, #228) on the old pyramid’s terraces, 36 m up
    [150.0, -15.60, -80.0],   // (v1.61, #228) on the round ship’s hill
    [154.0, -16.01, -64.0],   // (v1.87, #550) on the round ship’s hill
    [-18.0, 5.78, 50.0],   // (v1.66, #250) inside the split meteor
    [8.0, -7.26, -134.0],   // (v1.61, #228) on the builders’ machine’s flank
    [138.0, -17.67, -144.0],   // (v1.66, #250) in the dish pond
    [-36.0, -0.57, -92.0],   // (v1.70, #317; v1.87, #550) by the runnel’s basin
    [28.0, 19.29, 226.0],   // (v1.70, #317) among the pyramid nursery’s terrace trees (new country)
    [-202.0, 12.69, 638.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [264.0, 13.88, -404.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [28.0, 1.60, -546.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-618.0, 23.18, 210.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [624.0, 19.56, 282.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [42.0, 7.22, 132.0],   // (v1.70, #317; v1.87, #550) on a cap of the pyramid nursery
    [130.0, -15.70, -158.0],   // (v1.70, #317; v1.87, #550) by the dish pond
    [538.0, -9.56, -438.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-616.0, 5.77, -254.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [76.0, 25.47, 694.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-372.0, 18.21, -574.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [680.0, 12.16, -90.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [392.0, 13.17, 572.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [354.0, 7.58, 162.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
  ],
  underwater: [
    [172.2, -5.99, -36.9],   // (v1.61, #228; v1.87, #550) on a tower of pods
    [174.2, -28.08, -50.9],   // (v1.87, #550) on a tower of pods
    [136.2, -0.60, 27.1],   // (v1.61, #228) out on the seabed, at a pod tower’s foot
    [150.2, -64.00, -84.9],   // (v1.66, #250; v1.87, #550) among the whale bones on the canyon’s floor
    [172.2, -8.07, -54.9],   // (v1.61, #228; v1.87, #550) on a tower of pods
    [-155.8, 0.90, -212.9],   // (v1.61, #228; v1.87, #550) on a tower of pods
    [146.2, -7.20, -50.9],   // (v1.61, #228) on the white bridge over the canyon
    [132.2, -26.25, -68.9],   // (v1.87, #550) on a tower of pods
    [132.2, -58.58, -186.9],   // (v1.70, #317; v1.87, #550) on a tower of pods
    [130.2, -44.86, -144.9],   // (v1.70, #317) on a tower of pods
    [-53.8, 4.71, -38.9],   // (v1.70, #317) on a tower of pods
    [-153.8, -0.37, 73.1],   // (v1.70, #317) on a tower of pods
    [-45.8, 4.38, 77.1],   // (v1.70, #317) on a tower of pods
    [-139.8, -0.55, -36.9],   // (v1.70, #317) on a tower of pods
    [56.47, 3.86, 180.10],   // (v1.70, #317) on the relocated pod tower’s lower ledge
    [-103.8, -0.45, -126.9],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [147.6, -64.00, -58.0],   // (v1.70, #317; v1.87, #550) on a tower of pods
    [-61.8, -0.50, -52.9],   // (v1.70, #317; v1.87, #550) on a tower of pods
    [-87.8, -0.50, 89.1],   // (v1.70, #317) on a tower of pods
    [-112.0, 0.04, 24.0],   // (v1.70, #317; v1.87, #550) by the glow-kelp troughs
    [62.2, -0.53, -12.9],   // (v1.70, #317; v1.87, #550) on a tower of pods
    [-47.8, -0.60, 175.1],   // (v1.70, #317) on a tower of pods
    [64.2, -0.70, -28.9],   // (v1.70, #317) on a tower of pods
    [-25.8, -0.59, -182.9],   // (v1.70, #317; v1.87, #550) on a little stone plinth
  ],
  incal: [
    [-24.0, 150.00, -40.0],   // (v1.87, #550) on the high ring round the spire
    [38.0, 150.00, 28.0],   // (v1.87, #550) on the high ring round the spire
    [-92.0, 150.00, 172.0],   // (v1.66, #250) under the cab-wrights’ crane
    [34.0, 150.00, -32.0],   // (v1.87, #550) on the high ring round the spire
    [150.0, 200.00, 216.0],   // (v1.66, #250; v1.87, #550) by the great mirror, on the rim
    [354.0, 200.00, 94.0],   // (v1.66, #250) by Tobin’s telescopes on the rim
    [192.0, 150.00, 8.0],   // (v1.66, #250) in a stall of the balcony market
    [744.5, 206.00, -8.7],   // (v1.87, #550) on the cistern’s deck, up its stair
    [263.9, 204.80, -517.5],   // (v1.70, #317; v1.87, #550) on the cab-wrights’ shed’s roof, up its crates
    [219.5, 206.40, 689.0],   // (v1.70, #317; v1.87, #550) on the lamplighters’ platform, up its stair
    [724.5, 203.60, 471.5],   // (v1.70, #317; v1.87, #550) on the round pavilion’s roof, up its stair
    [-389.5, 201.00, -221.5],   // (v1.70, #317; v1.87, #550) on the fountain’s dry middle, in a little square
    [342.0, 200.00, -88.0],   // (v1.70, #317; v1.87, #550) at the Warden’s Well, on the rim
    [611.9, 204.80, -389.5],   // (v1.70, #317; v1.87, #550) on the cab-wrights’ shed’s roof, up its crates
    [342.0, 200.00, 10.0],   // (v1.70, #317; v1.87, #550) on the Rim Docks’ berth
    [338.0, 200.00, -22.0],   // (v1.70, #317; v1.87, #550) on the Rim Docks’ berth
    [-115.5, 200.55, 547.2],   // (v1.70, #317; v1.87, #550) at the feet of a lamplighter’s statue, in a little square
    [409.7, 206.00, 438.5],   // (v1.70, #317; v1.87, #550) on the cistern’s deck, up its stair
    [480.5, 200.90, -669.5],   // (v1.70, #317; v1.87, #550) in the bandstand, in a little square
    [46.5, 201.00, -285.5],   // (v1.70, #317; v1.87, #550) on the fountain’s dry middle, in a little square
    [-253.5, 151.00, -7.5],   // (v1.70, #317; v1.87, #550) on the fountain’s dry middle, in a little square
    [937.0, 206.40, 83.5],   // (v1.70, #317; v1.87, #550) on the lamplighters’ platform, up its stair
    [608.5, 200.90, 138.5],   // (v1.70, #317; v1.87, #550) in the bandstand, in a little square
    [-132.2, 150.55, -191.5],   // (v1.70, #317; v1.87, #550) at the feet of a lamplighter’s statue, in a little square
  ],
  glassdunes: [
    [26.0, 30.28, 30.0],   // (v1.87, #550) by the wave’s cairn, on the frozen wave’s crest
    [-554.0, 14.24, -130.0],   // (v1.87, #550) on a little stone cairn
    [-556.0, 15.16, 198.0],   // (v1.66, #250; v1.87, #550) on a little stone cairn
    [-324.0, 26.86, -242.0],   // (v1.87, #550) on a little stone cairn
    [-78.0, 90.99, -242.0],   // (v1.66, #250) by the breaker’s cairn, 91 m up on the breaking wave
    [-170.0, 2.91, -2.0],   // (v1.87, #550) by the dust in the cliff
    [282.0, 1.51, -144.0],   // (v1.66, #250; v1.87, #550) on a little stone cairn
    [-36.0, 6.03, -246.0],   // (v1.66, #250) on the glass that holds the moment in the wave
    [-126.0, 1.71, 212.0],   // (v1.70, #317; v1.87, #550) in the painted stair quarter
    [-354.0, 67.89, 108.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-240.0, -0.27, 278.0],   // (v1.70, #317; v1.87, #550) on the vermilion stair
    [-16.0, 2.21, 42.0],   // (v1.70, #317; v1.87, #550) by the passage through the frozen wave
    [14.0, 1.88, -194.0],   // (v1.70, #317; v1.87, #550) by the north camp, under the breaking wave
    [-430.0, 14.04, 366.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [552.0, 16.54, 302.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [268.0, 14.16, 556.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [50.0, 3.14, 48.0],   // (v1.70, #317; v1.87, #550) by the birds in the wave
    [454.0, 17.42, 478.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-556.0, 15.54, 532.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [62.0, 12.40, 556.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [556.0, 12.66, 100.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [166.0, 0.05, 106.0],   // (v1.70, #317; v1.87, #550) by the carriers in the glass
    [556.0, 15.86, -198.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-276.0, 15.44, 556.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
  ],
  buried: [
    [226.0, 15.45, -60.0],   // (v1.61, #228; v1.66, #250; v1.87, #550) on a little stone cairn
    [-120.0, 13.13, 128.0],   // (v1.87, #550) at the Engine-House
    [28.0, -3.77, -328.0],   // (v1.87, #550) on the keepers’ gangway
    [-124.0, 13.13, 68.0],   // (v1.66, #250; v1.87, #550) at the Engine-House
    [-466.0, 16.84, 580.0],   // (v1.87, #550) on a little stone cairn
    [424.0, 11.78, -254.0],   // (v1.87, #550) on a little stone cairn
    [16.0, 7.77, -344.0],   // (v1.66, #250) on the keepers’ gangway
    [-134.0, 11.09, 538.0],   // (v1.66, #250; v1.87, #550) on a little stone cairn
    [-512.0, 4.17, -164.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [444.0, 19.44, 454.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [20.0, 6.87, -100.0],   // (v1.70, #317) among the Tooth Day posts
    [-572.0, 18.22, 400.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [168.0, 17.27, 730.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [366.0, 13.68, 118.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-172.0, 13.46, -592.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [146.0, 17.07, 444.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-474.0, 16.76, 92.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-12.0, 4.38, 132.0],   // (v1.70, #317; v1.87, #550) under the freight stage’s crane
    [-282.0, 17.20, 328.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [42.0, 11.32, -528.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [250.0, 9.24, -422.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [582.0, 16.91, 190.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [-250.0, 5.45, -290.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
    [486.0, 18.32, -54.0],   // (v1.70, #317; v1.87, #550) on a little stone cairn
  ],
  moonfoundry: [
    [10.0, 13.06, -208.0],
    [-23.0, 37.12, -197.0],   // (v1.61, #228) a landing of the broken moon’s stair street, 37 m up
    [-89.0, 13.06, -164.0],   // (v1.66, #250) on the bowl’s deck, among its garden
    [-68.0, 0.00, -111.0],   // (v1.61, #228; v1.87, #550) by the cracked mould
    [-4.0, 13.06, -190.0],   // (v1.61, #228; v1.87, #550) in the courtyard in the broken moon
    [-85.0, 13.06, -136.0],   // (v1.61, #228; v1.87, #550) on the bowl
    [-40.0, 0.41, -110.0],   // (v1.87, #550) by the footbridge over the west runnel
    [35.0, -0.99, 54.0],   // (v1.66, #250; v1.87, #550) by the steps down into the long runnel
    [60.0, 0.63, 55.0],   // (v1.70, #317) by the footbridge over the long runnel (new country)
    [156.0, 0.00, -181.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [87.0, 0.00, -79.0],   // (v1.70, #317) by the footbridge over the furnace runnel (new country)
    [14.0, 13.06, -4.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [-153.0, 0.00, 33.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [-150.0, 0.00, -285.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [103.0, 0.00, -283.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [-54.0, 0.00, -280.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [70.0, 4.81, -107.0],   // (v1.70, #317; v1.87, #550) by the moon in its cradle
    [60.0, 2.40, -81.0],   // (v1.70, #317; v1.87, #550) by the moon in its cradle
    [153.0, 0.00, 33.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [155.0, 0.00, -50.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [-125.0, 6.24, -46.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [-154.0, 0.00, -206.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [-153.0, 0.00, -131.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [-11.0, 30.25, -212.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
  ],
  spheres: [
    [-219.5, 54.69, -144.5],   // (v1.66, #250) on the white hill’s pyramid, by the temple on its top (the far corner from the Pyramid key)
    [246.0, -1.12, 38.0],   // (v1.61, #228; v1.87, #550) by the cairn at the yellow sphere’s furrow
    [-118.0, 2.68, -454.0],   // (v1.66, #250; v1.87, #550) in the empty arcade in the android wood
    // (v1.56, issue #190: these two picked afresh by scripts/fragment-spots.mjs spheres once the explorations were built;
    //  the old ones, on an umbrella's flaring roots by the plaza and under one far west, were left too close to a ledge)
    [-262.0, 17.64, 226.0],   // (v1.87, #550) at the Footprint
    [60.0, -1.31, 118.0],   // (v1.66, #250; v1.87, #550) by the lantern at the white stone
    [206.0, -1.83, -302.0],   // (v1.66, #250) in the ring of stones at the white monolith
    [-194.0, 15.98, 308.0],   // (v1.87, #550) at the Footprint
    [-80.0, 0.68, -264.0],   // (v1.66, #250; v1.87, #550) on the terraces round the sphere west of the arch
    [-196.0, 34.44, -150.0],   // (v1.70, #317) on the white hill’s pyramid
    [610.0, -2.44, -270.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [154.0, -0.46, -606.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [122.0, 0.35, -178.0],   // (v1.70, #317) on the lake’s pyramid
    [-86.0, 0.39, -194.0],   // (v1.70, #317) on the meadow’s pyramid
    [-58.0, 0.39, -194.0],   // (v1.70, #317) on the meadow’s pyramid
    [-494.0, -4.26, 36.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [432.0, 1.61, -458.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [16.0, 3.94, -180.0],   // (v1.70, #317; v1.87, #550) by the pavilion shop
    [86.0, 0.46, -60.0],   // (v1.70, #317; v1.87, #550) on a great sphere
    [118.0, 0.35, -196.0],   // (v1.70, #317; v1.87, #550) on the lake’s pyramid
    [-326.0, 1.43, -302.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [-314.0, -0.51, 56.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [68.0, 4.54, -418.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [390.0, 2.41, -288.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [-66.0, -0.41, 8.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
  ],
  spacecity: [
    [79.0, 78.73, -119.0],   // (v1.61, #228) the stack’s top, 79 m up
    [-92.0, -0.00, 42.0],
    [75.0, 50.00, -121.0],   // (v1.61, #228) on the stack’s stair, 50 m up
    [-29.0, 16.59, -57.0],   // (v1.61, #228) on a rooftop 17 m up over the Towers
    [-36.0, -0.00, -52.0],
    [-36.0, 0.00, -88.0],   // (v1.61, #228) the rim walk behind a tower, west of the Towers (the old spot lay by the way #233 moved)
    [-68.0, 0.00, 15.0],   // (v1.61, #228; v1.66, #250; v1.87, #550) on a little stone plinth
    [-76.0, -4.00, -48.0],   // (v1.61, #228) the Garden island’s rim
    [-25.0, 0.00, 45.0],   // (v1.70, #317; v1.87, #550) on the Gate island
    [-25.0, 0.00, 21.0],   // (v1.70, #317; v1.87, #550) on the Gate island
    [-107.0, -4.00, -75.0],   // (v1.70, #317) by the sapling in its pot
    [-111.0, -4.00, -59.0],   // (v1.70, #317) by the sapling in its pot
    [28.0, 0.00, -99.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [27.0, 0.00, -43.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [79.0, 66.00, -133.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [115.00, 14.00, -191.00],   // (v1.70, #317) at the Mooring-House’s outer apron, over the drop
    [95.0, 68.91, -126.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [-92.0, -0.00, 21.0],   // (v1.70, #317) at the edge, over the drop
    [89.0, 42.92, -116.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [-80.0, -4.00, -75.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [-61.0, 0.00, 42.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [-22.0, 0.00, -42.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
    [77.00, 14.00, -190.00],   // (v1.70, #317) at the Mooring-House’s outer apron, over the drop
    [-103.0, -4.00, -43.0],   // (v1.70, #317; v1.87, #550) on a little stone plinth
  ],
  bazaar: [
    [34.0, 25.00, -90.0],   // (v1.61, #228) the far end of Kip’s skybridge, 25 m up
    [38.0, 8.32, -142.0],   // (v1.61, #228) a ledge 8 m up over Signal Square
    [-109.5, 1.00, -51.5],   // (v1.87, #550) on the fountain’s dry middle, in a little square
    [-232.7, 6.00, -491.5],   // (v1.87, #550) on the water tank’s deck, up its stair
    [-34.0, 8.32, -144.0],   // (v1.87, #550) on a tower over the street
    [206.5, 4.80, 163.9],   // (v1.61, #228; v1.87, #550) on the stall block’s roof, up its crates
    [34.0, 8.32, -274.0],   // (v1.66, #250) on a tower’s service balcony over Signal Square
    [-278.5, 6.40, -238.0],   // (v1.66, #250; v1.87, #550) on the signal platform, up its stair
    [-234.2, 0.55, 184.5],   // (v1.70, #317; v1.87, #550) at the feet of a quiet one’s statue, in a little square
    [100.0, 8.32, -324.0],   // (v1.70, #317) on a tower over the street
    [30.0, 8.32, -78.0],   // (v1.70, #317) on a tower over the street (new country)
    [286.5, 3.60, -492.5],   // (v1.70, #317; v1.87, #550) on the round kiosk’s roof, up its stair
    [287.3, 6.00, -217.5],   // (v1.70, #317; v1.87, #550) on the water tank’s deck, up its stair
    [4.5, 0.90, 194.5],   // (v1.70, #317; v1.87, #550) in the bandstand, in a little square
    [-16.5, 6.40, -464.0],   // (v1.70, #317; v1.87, #550) on the signal platform, up its stair
    [-153.5, 1.00, -343.5],   // (v1.70, #317; v1.87, #550) on the fountain’s dry middle, in a little square
    [174.5, 4.80, -2.1],   // (v1.70, #317; v1.87, #550) on the stall block’s roof, up its crates
    [-234.2, 0.55, 12.5],   // (v1.70, #317; v1.87, #550) at the feet of a quiet one’s statue, in a little square
    [-287.5, 3.60, -370.5],   // (v1.70, #317; v1.87, #550) on the round kiosk’s roof, up its stair
    [246.5, 0.90, -373.5],   // (v1.70, #317; v1.87, #550) in the bandstand, in a little square
    [158.5, 1.00, -213.5],   // (v1.70, #317; v1.87, #550) on the fountain’s dry middle, in a little square
    [61.2, 0.55, 74.5],   // (v1.70, #317; v1.87, #550) at the feet of a quiet one’s statue, in a little square
    [-171.5, 0.90, -203.5],   // (v1.70, #317; v1.87, #550) in the bandstand, in a little square
    [-89.5, 1.00, 94.5],   // (v1.70, #317; v1.87, #550) on the fountain’s dry middle, in a little square
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
    'Ribcage', 'The Rose House (2)', 'The giant’s arm', 'Crashed hull', 'Ribcage (5)', 'the pilgrims’ cairn (9)',
    'the pilgrims’ cairn (8)', 'Sail tents', 'the pilgrims’ cairn (7)', 'Ribcage (4)', 'the light’s cairn (1)',
    'The giant’s hand', 'Ribcage (4)', 'Crashed hull', 'The Rose House (2)', 'a boat stranded in the dry wash',
    'Sail tents', 'Ribcage (5)', 'The Rose House (2)', 'the light’s cairn (2)', 'The giant’s arm', 'Ribcage',
    'the first qanat well', 'the light’s cairn (3)',
  ],
  arzach: [
    'the light’s cairn (1)', 'The stones that fell up', 'The Aerie (2)', 'the hour stone toward the riders’ gate',
    'The slabs tipped out of the plain', 'shopfront.hoodoo', 'the light’s cairn (2)',
    'The slabs tipped out of the plain', 'the hour stone toward the landing', 'the light’s cairn (3)',
    'the rider’s mounting stone', 'the light’s cairn (4)', 'The tables of the plain over the cloud',
    'the light’s cairn (5)', 'the light’s cairn (6)', 'The Aerie (2)', 'the light’s cairn (7)',
    'the light’s cairn (8)', 'the light’s cairn (9)', 'The tables of the plain over the cloud',
    'the light’s cairn (10)', 'the light’s cairn (11)', 'the light’s cairn (12)', 'the light’s cairn (13)',
  ],
  perdide: [
    'the light’s cairn (1)', 'The Hush-House (2)', 'The Lamp-House (2)', 'shopfront.mossdome',
    'The flooded wood (mound)', 'the light’s cairn (2)', 'the light’s cairn (3)', 'The Lamp-House (2)',
    'the light’s cairn (4)', 'the light’s cairn (5)', 'The Hush-House (2)', 'shroom-top', 'the light’s cairn (6)',
    'Makers’ court (stun)', 'the light’s cairn (7)', 'the light’s cairn (8)', 'Makers’ court (stun)',
    'the light’s cairn (9)', 'the light’s cairn (10)', 'the light’s cairn (11)', 'the light’s cairn (12)',
    'shroom-top', 'The keepers’ canopy (hut)', 'the light’s cairn (13)',
  ],
  edena: [
    'The pyramid nursery’s caps', 'The pyramid nursery’s terrace trees', 'the old pyramid’s top',
    'The round ship’s hill', 'The round ship’s hill', 'The split meteor’s inside (west half)',
    'the builders’ machine', 'The dish pond', 'the runnel’s basin', 'The pyramid nursery’s terrace trees',
    'the light’s cairn (1)', 'the light’s cairn (2)', 'the light’s cairn (3)', 'the light’s cairn (4)',
    'the light’s cairn (5)', 'The pyramid nursery’s caps', 'The dish pond', 'the light’s cairn (6)',
    'the light’s cairn (7)', 'the light’s cairn (8)', 'the light’s cairn (9)', 'the light’s cairn (10)',
    'the light’s cairn (11)', 'the light’s cairn (12)',
  ],
  underwater: [
    'a tower of pods (19)', 'a tower of pods (15)', 'a tower of pods (10)', 'the whale bones on the canyon’s floor',
    'a tower of pods (15)', 'a tower of pods (5)', 'the bridge over the canyon', 'a tower of pods (16)',
    'a tower of pods (18)', 'a tower of pods (17)', 'a tower of pods (4)', 'a tower of pods (14)',
    'a tower of pods (1)', 'a tower of pods (9)', 'a tower of pods (13)', 'the light’s cairn (1)',
    'a tower of pods (11)', 'a tower of pods (4)', 'a tower of pods (8)', 'the glow-kelp troughs',
    'a tower of pods (3)', 'a tower of pods (12)', 'a tower of pods (3)', 'the light’s cairn (2)',
  ],
  incal: [
    'the spire’s high ring', 'the spire’s high ring', 'the cab-wrights’ crane', 'the spire’s high ring',
    'the great mirror', 'Tobin’s telescopes', 'the balcony market', 'the cistern on stilts (1)',
    'the cab-wrights’ shed (1)', 'the lamplighters’ platform (1)', 'the round pavilion (1)', 'the fountain (1)',
    'The Warden’s Well (2)', 'the cab-wrights’ shed (2)', 'berth body', 'berth body',
    'the statue of a lamplighter (1)', 'the cistern on stilts (2)', 'the bandstand (1)', 'the fountain (2)',
    'the fountain (3)', 'the lamplighters’ platform (2)', 'the bandstand (2)', 'the statue of a lamplighter (2)',
  ],
  glassdunes: [
    'the wave’s cairn', 'the light’s cairn (1)', 'the light’s cairn (2)', 'the light’s cairn (3)',
    'The breaker’s cairn', 'the dust in the cliff', 'the light’s cairn (4)',
    'The glass that holds a stopped minute (moment)', 'the painted stair quarter', 'the light’s cairn (5)',
    'the vermilion stair', 'the passage through the frozen wave', 'the north camp, under the breaking wave',
    'the light’s cairn (6)', 'the light’s cairn (7)', 'the light’s cairn (8)', 'the birds in the wave',
    'the light’s cairn (9)', 'the light’s cairn (10)', 'the light’s cairn (11)', 'the light’s cairn (12)',
    'the carriers in the glass', 'the light’s cairn (13)', 'the light’s cairn (14)',
  ],
  buried: [
    'the light’s cairn (1)', 'The Engine-House (2)', 'The keepers’ gangway', 'The Engine-House (2)',
    'the light’s cairn (2)', 'the light’s cairn (3)', 'The keepers’ gangway', 'the light’s cairn (4)',
    'the light’s cairn (5)', 'the light’s cairn (6)', 'The Tooth Day posts', 'the light’s cairn (7)',
    'the light’s cairn (8)', 'the light’s cairn (9)', 'the light’s cairn (10)', 'the light’s cairn (11)',
    'the light’s cairn (12)', 'the freight stage’s crane', 'the light’s cairn (13)', 'the light’s cairn (14)',
    'the light’s cairn (15)', 'the light’s cairn (16)', 'the light’s cairn (17)', 'the light’s cairn (18)',
  ],
  moonfoundry: [
    'the broken moon', 'the broken moon', 'the bowl', 'the cracked mould', 'the courtyard in the broken moon',
    'the bowl', 'the footbridge over the west runnel', 'the steps down into the long runnel',
    'the footbridge over the long runnel', 'the light’s cairn (1)', 'the footbridge over the furnace runnel',
    'the light’s cairn (2)', 'the light’s cairn (3)', 'the light’s cairn (4)', 'the light’s cairn (5)',
    'the light’s cairn (6)', 'the moon in its cradle', 'the moon in its cradle', 'the light’s cairn (7)',
    'the light’s cairn (8)', 'the light’s cairn (9)', 'the light’s cairn (10)', 'the light’s cairn (11)',
    'the light’s cairn (12)',
  ],
  spheres: [
    'the white hill’s pyramid', 'the cairn at the yellow sphere’s furrow', 'the empty arcade in the android wood',
    'The Footprint (2)', 'the lantern at the white stone', 'the ring of stones at the white monolith',
    'The Footprint (2)', 'the terraces round the sphere west of the arch', 'the white hill’s pyramid',
    'the light’s cairn (1)', 'the light’s cairn (2)', 'the lake’s pyramid', 'the meadow’s pyramid',
    'the meadow’s pyramid', 'the light’s cairn (3)', 'the light’s cairn (4)', 'shopfront.pavilion',
    'a great sphere (2)', 'the lake’s pyramid', 'the light’s cairn (5)', 'the light’s cairn (6)',
    'the light’s cairn (7)', 'the light’s cairn (8)', 'the light’s cairn (9)',
  ],
  spacecity: [
    'the stack (high)', 'the yard', 'the stack (high)', 'the market', 'the market', 'the market',
    'the light’s cairn (1)', 'the garden', 'the gate', 'the gate', 'the garden', 'the garden',
    'the light’s cairn (2)', 'the light’s cairn (3)', 'the light’s cairn (4)', 'The Mooring-House (2)',
    'the light’s cairn (5)', 'the yard', 'the light’s cairn (6)', 'the light’s cairn (7)', 'the yard',
    'the light’s cairn (8)', 'The Mooring-House (2)', 'the light’s cairn (9)',
  ],
  bazaar: [
    'a tower over the street (8)', 'a tower over the street (10)', 'the fountain (1)',
    'the water tank on stilts (1)', 'a tower over the street (9)', 'the stall block (1)',
    'a tower over the street (14)', 'the signal platform (1)', 'the statue of a quiet one (1)',
    'a tower over the street (16)', 'a tower over the street (8)', 'the round kiosk (1)',
    'the water tank on stilts (2)', 'the bandstand (1)', 'the signal platform (2)', 'the fountain (2)',
    'the stall block (2)', 'the statue of a quiet one (2)', 'the round kiosk (2)', 'the bandstand (2)',
    'the fountain (3)', 'the statue of a quiet one (3)', 'the bandstand (3)', 'the fountain (4)',
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
