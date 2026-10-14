// Where each fragment of the singing light hides, in the words of the people who live there (issue #340: the rumours,
// src/story/rumours.js). One entry a slot of src/fragments-data.js FRAGMENTS, in its order (24 a world):
//
//   'under the old ribcage’s ribs'     the place, said whole
//   'on a tower of pods+'              the place, then which way it lies from the nearest landmark ("… west of the moon pool")
//   '=ledge'                           a kind of place (RUMOUR_KINDS), then the landmark ("on a ledge with a long drop, north of …")
//
// Written from the spots' own notes in src/fragments-data.js (what they are in or on), as a local would say it: no
// metres, no slot numbers, names the way the people use them. tests/rumours.test.js checks there is one for every slot.

/** A kind of place, as said before its landmark. */
export const RUMOUR_KINDS = {
  ledge: 'on a ledge with a long drop',
  high: 'up high',
  summit: 'on a high top',
  walls: 'tucked in among walls',
  end: 'at the end of a path',
  edge: 'right at the edge, over the drop',
  near: 'out',
};

export const RUMOUR_PLACES = {
  desert: [
    'under the old ribcage’s ribs', '=near', '=near', '=near', '=near',
    'on the open sand a few dozen paces from your ramp', 'up the low rise behind your ship',
    'between the vertebrae of a ribcage in the west dunes', 'on the giant’s hand', 'among the fallen giant’s bones',
    'among the sail tents', 'inside a ribcage+', 'inside a ribcage+', 'by the crashed hull', 'on the Rose House’s walls',
    'in a boat stranded in the dry wash', '=ledge', '=ledge', '=end', '=high', '=ledge', '=ledge', '=ledge', '=walls',
  ],
  arzach: [
    'by Ondine’s tally, at the island’s edge', 'on a slab tipped up at the plain’s broken edge', '=near',
    'at the hour stone toward the riders’ gate', 'under a tipped slab past the riders’ gate', '=near', '=near', '=near',
    '=summit', '=summit', '=summit', '=summit', '=summit', 'by the hour stone toward the landing', '=summit', '=summit', '=summit',
    '=ledge', '=ledge', '=high', '=ledge', '=ledge', '=high', '=edge',
  ],
  perdide: [
    '=near', '=near', 'on the keepers’ canopy, high over the wood', 'among the keepers’ stalks',
    'on the egg isle’s heap, in the drowned wood', 'halfway up the keepers’ stair', '=near', '=near', '=walls',
    'by Wendel’s lookout', '=walls', 'on a shroom’s cap+', 'at the foot of the keepers’ stair', '=walls', '=walls', '=walls',
    '=walls', '=walls', '=walls', '=end', '=walls', '=end', '=walls', '=high',
  ],
  edena: [
    'on a cap of the pyramid nursery', '=near', 'up the old pyramid’s terraces', 'on the round ship’s hill', '=near',
    'inside the split meteor', 'on the builders’ machine’s flank', 'in the dish pond',
    'among the trees on the nursery’s terraces', 'among the trees on the nursery’s terraces', 'on a low cap of the pyramid nursery',
    'on the water stair', 'on the round ship’s hill', 'by the nursery’s seedling beds', 'by the runnel’s basin',
    '=ledge', '=ledge', '=ledge', '=ledge', '=high', '=high', '=high', '=high', '=high',
  ],
  underwater: [
    'on the far café’s terrace, over the canyon', '=near', 'out on the seabed, at a pod tower’s foot',
    'among the whale bones on the canyon’s floor', 'on a pod tower’s ring, down the canyon’s wall',
    'out on the seabed, by a tower’s round door', 'on the white bridge over the canyon', '=near',
    'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+',
    'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+',
    'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+',
    'on a tower of pods+',
  ],
  incal: [
    '=near', '=near', 'under the cab-wrights’ crane', '=near', 'by the great mirror, on the rim', 'by Tobin’s telescopes',
    'in a stall of the balcony market', '=near', '=summit', '=summit', '=summit', '=summit', '=summit', '=summit', '=summit',
    '=summit', '=summit', '=summit', '=edge', '=walls', '=walls', '=walls', '=walls', '=walls',
  ],
  glassdunes: [
    '=near', '=near', 'by the wave’s cairn, on the frozen wave’s crest', '=near', 'by the breaker’s cairn, way up the breaking wave',
    '=near', 'on the glass that holds the carriers', 'on the glass that holds the moment in the wave', '=summit',
    'on the glass that holds the stopped dust', 'by the passage through the frozen wave', 'by the carriers’ shade',
    'by the north camp, under the breaking wave', 'by the west camp', 'on the wind-glass', 'on the glass that holds the flock',
    'by the dust in the cliff', 'by the carriers’ float-sledge', '=ledge', '=ledge', '=ledge', '=ledge', '=ledge', '=ledge',
  ],
  buried: [
    'behind the oil fall, at the canyon’s foot', '=near', '=near', 'on a top of the keepers’ way, over the machine', '=near',
    '=near', 'on the keepers’ gangway', 'on a cap of the Tooth Day posts', 'on the keepers’ gangway', 'among the Tooth Day posts',
    'among the Tooth Day posts', 'on the keepers’ gangway', 'by the oil fall', '=walls', '=walls', '=end', '=end', '=high',
    '=high', '=ledge', '=high', '=end', '=ledge', '=high',
  ],
  moonfoundry: [
    '=near', 'on a landing of the broken moon’s stair street', 'on the bowl’s deck, in its garden', 'on a gantry over the floor',
    'behind a house on the stair street', 'tucked behind a wall on the floor+', '=near', 'against the cracked mould',
    'by the footbridge over the long runnel', 'on the bowl', 'by the footbridge over the furnace runnel',
    'by the footbridge over the west runnel', 'by the footbridge over the west runnel', 'in the courtyard in the broken moon',
    'by the steps down into the long runnel', '=end', '=end', '=end', '=end', '=ledge', '=end', '=end', '=walls', '=ledge',
  ],
  spheres: [
    'on the white hill’s pyramid, by the temple on top', 'down in the cracked sphere’s crater',
    'in the empty arcade in the android wood', '=near', 'on the terraces round the sphere west of the arch',
    'in the ring of stones at the white monolith', '=near', 'by the cairn at the yellow sphere’s furrow',
    'on the white hill’s pyramid', 'by the lantern at the white stone', 'on the white hill’s pyramid', 'on the lake’s pyramid',
    'on the meadow’s pyramid', 'on the meadow’s pyramid', 'on the meadow’s pyramid', '=walls', '=end', '=end', '=end', '=walls',
    '=end', '=walls', '=walls', '=ledge',
  ],
  spacecity: [
    'on top of the stack', '=near', 'halfway up the stack’s stair', 'on a rooftop over the Towers', '=near',
    'on the rim walk behind a tower, west of the Towers', 'by the telescope at the Pier’s end', 'on the Garden island’s rim',
    'by the bench on the washing tier', 'by the bench on the washing tier', 'by the sapling in its pot', 'by the sapling in its pot',
    '=summit', '=summit', 'by the sapling in its pot', '=edge', '=edge', '=edge', '=edge', '=edge', '=edge', '=edge', '=edge', '=edge',
  ],
  bazaar: [
    'at the far end of Kip’s skybridge', 'on a ledge over Signal Square', '=near', '=near', '=near',
    'past the biggest set in the screen lanes', 'on a tower’s service balcony over Signal Square',
    'by the radio-mender’s table in the listeners’ lane', '=summit', 'on a tower over the street+', 'on a tower over the street+',
    '=walls', '=walls', 'on a tower over the street+', '=end', '=end', '=walls', '=end', '=end', '=end', '=end', '=end', '=end', '=end',
  ],
};
