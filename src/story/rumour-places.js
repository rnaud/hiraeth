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
    'inside a ribcage+', 'on the Rose House’s terraces', 'on the giant’s arm', 'on the crashed hull',
    'inside a ribcage+', 'by the stone cairn beside your ship', 'by the next cairn up the pilgrims’ road',
    'among the sail tents', 'by a pilgrims’ cairn on the old road+', 'inside a ribcage+', 'on a little stone cairn+',
    'on the giant’s hand', 'inside a ribcage+', 'by the crashed hull', 'on the Rose House’s walls',
    'in a boat stranded in the dry wash', 'among the sail tents', 'inside a ribcage+', 'on the Rose House’s terraces',
    'on a little stone cairn+', 'on the giant’s arm', 'inside a ribcage+', 'at the first qanat well',
    'on a little stone cairn+',
  ],
  arzach: [
    'on a little stone cairn+', 'on a slab tipped up at the plain’s broken edge', 'on the Aerie',
    'at the hour stone toward the riders’ gate', 'on the slabs tipped out of the plain', 'by the shop in the hoodoo',
    'on a little stone cairn+', 'on the slabs tipped out of the plain', 'at the hour stone toward the landing',
    'on a little stone cairn+', 'by the rider’s mounting stone', 'on a little stone cairn+',
    'on the stone tables over the cloud', 'on a little stone cairn+', 'on a little stone cairn+', 'on the Aerie',
    'on a little stone cairn+', 'on a little stone cairn+', 'on a little stone cairn+',
    'on the stone tables over the cloud', 'on a little stone cairn+', 'on a little stone cairn+',
    'on a little stone cairn+', 'on a little stone cairn+',
  ],
  perdide: [
    'on a little stone cairn+', 'at the Hush-House', 'at the Lamp-House', 'by the moss-dome shop',
    'on the egg isle’s heap, in the drowned wood', 'on a little stone cairn+', 'on a little stone cairn+',
    'at the Lamp-House', 'on a little stone cairn+', 'on a little stone cairn+', 'at the Hush-House',
    'on a shroom’s cap+', 'on a little stone cairn+', 'in the makers’ court', 'on a little stone cairn+',
    'on a little stone cairn+', 'in the makers’ court', 'on a little stone cairn+', 'on a little stone cairn+',
    'on a little stone cairn+', 'on a little stone cairn+', 'on a shroom’s cap+',
    'up on the keepers’ canopy, by their hut', 'on a little stone cairn+',
  ],
  edena: [
    'on a cap of the pyramid nursery', 'among the trees on the nursery’s terraces', 'up the old pyramid’s terraces',
    'on the round ship’s hill', 'on the round ship’s hill', 'inside the split meteor',
    'on the builders’ machine’s flank', 'in the dish pond', 'by the runnel’s basin',
    'among the trees on the nursery’s terraces', 'on a little stone cairn+', 'on a little stone cairn+',
    'on a little stone cairn+', 'on a little stone cairn+', 'on a little stone cairn+',
    'on a cap of the pyramid nursery', 'in the dish pond', 'on a little stone cairn+', 'on a little stone cairn+',
    'on a little stone cairn+', 'on a little stone cairn+', 'on a little stone cairn+', 'on a little stone cairn+',
    'on a little stone cairn+',
  ],
  underwater: [
    'on a tower of pods+', 'on a tower of pods+', 'out on the seabed, at a pod tower’s foot',
    'among the whale bones on the canyon’s floor', 'on a tower of pods+', 'on a tower of pods+',
    'on the white bridge over the canyon', 'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+',
    'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+',
    'on a little stone plinth+', 'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+',
    'by the glow-kelp troughs', 'on a tower of pods+', 'on a tower of pods+', 'on a tower of pods+',
    'on a little stone plinth+',
  ],
  incal: [
    'on the high ring round the spire', 'on the high ring round the spire', 'under the cab-wrights’ crane',
    'on the high ring round the spire', 'by the great mirror, on the rim', 'by Tobin’s telescopes',
    'in a stall of the balcony market', 'on a little stone plinth+', 'on a little stone plinth+',
    'on a little stone plinth+', 'on a little stone plinth+', 'on a little stone plinth+',
    'at the Warden’s Well, on the rim', 'on a little stone plinth+', 'on the Rim Docks’ berth',
    'on the Rim Docks’ berth', 'on a little stone plinth+', 'on a little stone plinth+', 'on a little stone plinth+',
    'on a little stone plinth+', 'on a little stone plinth+', 'on a little stone plinth+',
    'on a little stone plinth+', 'on a little stone plinth+',
  ],
  glassdunes: [
    'by the wave’s cairn, on the frozen wave’s crest', 'on a little stone cairn+', 'on a little stone cairn+',
    'on a little stone cairn+', 'by the breaker’s cairn, way up the breaking wave', 'by the dust in the cliff',
    'on a little stone cairn+', 'on the glass that holds the moment in the wave', 'in the painted stair quarter',
    'on a little stone cairn+', 'on the vermilion stair', 'by the passage through the frozen wave',
    'by the north camp, under the breaking wave', 'on a little stone cairn+', 'on a little stone cairn+',
    'on a little stone cairn+', 'by the birds in the wave', 'on a little stone cairn+', 'on a little stone cairn+',
    'on a little stone cairn+', 'on a little stone cairn+', 'by the carriers in the glass',
    'on a little stone cairn+', 'on a little stone cairn+',
  ],
  buried: [
    'on a little stone cairn+', 'at the Engine-House', 'on the keepers’ gangway', 'at the Engine-House',
    'on a little stone cairn+', 'on a little stone cairn+', 'on the keepers’ gangway', 'on a little stone cairn+',
    'on a little stone cairn+', 'on a little stone cairn+', 'among the Tooth Day posts', 'on a little stone cairn+',
    'on a little stone cairn+', 'on a little stone cairn+', 'on a little stone cairn+', 'on a little stone cairn+',
    'on a little stone cairn+', 'under the freight stage’s crane', 'on a little stone cairn+',
    'on a little stone cairn+', 'on a little stone cairn+', 'on a little stone cairn+', 'on a little stone cairn+',
    'on a little stone cairn+',
  ],
  moonfoundry: [
    'in the broken moon', 'on a landing of the broken moon’s stair street', 'on the bowl’s deck, in its garden',
    'by the cracked mould', 'in the courtyard in the broken moon', 'on the bowl',
    'by the footbridge over the west runnel', 'by the steps down into the long runnel',
    'by the footbridge over the long runnel', 'on a little stone plinth+',
    'by the footbridge over the furnace runnel', 'on a little stone plinth+', 'on a little stone plinth+',
    'on a little stone plinth+', 'on a little stone plinth+', 'on a little stone plinth+',
    'by the moon in its cradle', 'by the moon in its cradle', 'on a little stone plinth+',
    'on a little stone plinth+', 'on a little stone plinth+', 'on a little stone plinth+',
    'on a little stone plinth+', 'on a little stone plinth+',
  ],
  spheres: [
    'on the white hill’s pyramid, by the temple on top', 'by the cairn at the yellow sphere’s furrow',
    'in the empty arcade in the android wood', 'at the Footprint', 'by the lantern at the white stone',
    'in the ring of stones at the white monolith', 'at the Footprint',
    'on the terraces round the sphere west of the arch', 'on the white hill’s pyramid', 'on a little stone plinth+',
    'on a little stone plinth+', 'on the lake’s pyramid', 'on the meadow’s pyramid', 'on the meadow’s pyramid',
    'on a little stone plinth+', 'on a little stone plinth+', 'by the pavilion shop', 'on a great sphere+',
    'on the lake’s pyramid', 'on a little stone plinth+', 'on a little stone plinth+', 'on a little stone plinth+',
    'on a little stone plinth+', 'on a little stone plinth+',
  ],
  spacecity: [
    'up the stack', 'on the Yard island', 'halfway up the stack’s stair', 'on a rooftop over the Towers',
    'on the Market island', 'on the rim walk behind a tower, west of the Towers', 'on a little stone plinth+',
    'on the Garden island’s rim', 'on the Gate island', 'on the Gate island', 'on the Garden island',
    'on the Garden island', 'on a little stone plinth+', 'on a little stone plinth+', 'on a little stone plinth+',
    'at the Mooring-House', 'on a little stone plinth+', 'on the Yard island', 'on a little stone plinth+',
    'on a little stone plinth+', 'on the Yard island', 'on a little stone plinth+', 'at the Mooring-House',
    'on a little stone plinth+',
  ],
  bazaar: [
    'at the far end of Kip’s skybridge', 'on a ledge over Signal Square', 'on a little stone plinth+',
    'on a little stone plinth+', 'on a tower over the street+', 'on a little stone plinth+',
    'on a tower’s service balcony over Signal Square', 'on a little stone plinth+', 'on a little stone plinth+',
    'on a tower over the street+', 'on a tower over the street+', 'on a little stone plinth+',
    'on a little stone plinth+', 'on a little stone plinth+', 'on a little stone plinth+',
    'on a little stone plinth+', 'on a little stone plinth+', 'on a little stone plinth+',
    'on a little stone plinth+', 'on a little stone plinth+', 'on a little stone plinth+',
    'on a little stone plinth+', 'on a little stone plinth+', 'on a little stone plinth+',
  ],
};
