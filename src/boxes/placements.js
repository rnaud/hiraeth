// Where the item boxes stand, world by world (src/boxes/index.js builds them).
// Every box is an artifact of the makers (docs/story-bible.md, "The boxes"):
// left where their giants walked, for a traveller who comes a long way, so
// they sit in sacred or out-of-the-way places, never in the open by chance.
// Coordinates are world metres. Each entry:
//
//   id       unique, '<world>.<what>' (its flag: box.<id>)
//   item     an id in src/items.js ITEMS
//   at       [x, z] (dropped onto the highest surface there) or [x, y, z]
//            (the surface just under y: a ledge, a roof, a terrace)
//   toward   [x, z] the front of the box faces this way (where you come from;
//            default: the world's spawn). face: a heading instead.
//   site     (level) => { at, face } instead of at / face: a spot a level builds (Qanat's ledge)
//   beacon   a pale column over it, seen from afar (the boxes you must find); a number: only
//            within that many metres (it rises out of a city, not over the whole desert)
//   hint     the box's own quest (src/boxes/index.js): where it is, in the player's words; the quest
//            starts when you arrive and leads the scout there (the desert's first box is the story's)
//   note     where it is and how you get there (for people, not the code)
//
// tests/boxes.test.js checks that every one stands on reachable ground.

export const PLACEMENTS = {
  desert: [
    // the makers' ledge in Qanat: a plank shelf jutting out of the burning tree's trunk 3 m up, on a
    // buttress root you climb (src/desert-city.js builds it), above the terrace beside the dry well. Up
    // the main stairs from the gate, on the left of the well; the box's pale column shows the way.
    { id: 'desert.backpack', item: 'backpack', site: (level) => level.qanat?.city.ledge && { at: level.qanat.city.ledge.box.toArray(), face: level.qanat.city.ledge.yaw }, beacon: 170,
      note: 'In Qanat, on the makers’ ledge up the burning tree’s trunk, left of the dry well: climb the buttress root. The first find, and the elder’s.' },
    // Qanat: on the flat roof of a domeless house inside the main gate (a 6 m climb)
    { id: 'desert.star', item: 'star', at: [246.9, 7.6, 363.6], lift: 0.5, toward: [230, 330],
      hint: 'A makers’ box sits on a flat roof just inside Qanat’s main gate. Climb the house wall',
      note: 'A house roof just inside the main gate of the old city; climb its wall.' },
  ],
  incal: [
    // the first jetpack world: the jets wait on the makers' pillar, a lone stone column on the rim 130 m
    // round from the ship (src/levels/incal.js PILLAR): a 14 m climb, no jetpack needed (you need them for the shaft)
    { id: 'incal.jetpack', item: 'jetpack', at: [Math.cos(0.45) * 286, 216, Math.sin(0.45) * 286], toward: [274, 0], beacon: true,
      hint: 'A makers’ box waits on top of the lone stone pillar on the rim, round from the ship. Climb it',
      note: 'On top of the makers’ pillar on the rim, round from the ship: climb the column.' },
  ],
  arzach: [
    // the nearest capped needle spire, 240 m north: a long climb or a landing on the bird
    { id: 'arzach.bell', item: 'bell', at: [17.9, 59.5, 239.9], toward: [0, 0],
      hint: 'A makers’ box sits on the flat cap of the needle spire north of the landing. Climb it, or land the bird on top',
      note: 'The flat cap of the needle spire north of the spawn; climb it or land the bird on it.' },
  ],
  arzach2: [
    // the sky stones: the top of the balanced five-stone stack on the start plateau
    { id: 'arzach2.glider', item: 'glider', at: [35, 65.3, -43.5], toward: [0, 22],
      hint: 'A makers’ box teeters on the top stone of the balanced stack on the starting plateau. Climb the stones',
      note: 'The top stone of the balanced stack on the starting plateau: a teetering climb.' },
  ],
  garage: [
    // on the keep's south curtain wall, facing the spawn (a 14 m climb)
    { id: 'garage.coil', item: 'coil', at: [8, 14, 24], toward: [0, 120],
      hint: 'A makers’ box stands on top of the keep’s south curtain wall. Climb the wall',
      note: 'The top of the keep’s south curtain wall.' },
  ],
  buried: [
    // the oil-light: the ring platform round the smoking chimney stack (jets or a climb up the stack)
    { id: 'buried.fire', item: 'fire', at: [110, 33.8, 144.5], toward: [110, 160],
      hint: 'A makers’ box rests on the lower ring platform of the smoking chimney stack, north-east of the landing',
      note: 'The lower ring platform of the chimney stack north-east of the spawn, on its +z side.' },
  ],
  edena: [
    // the upper canopy of an umbrella tree: climb the trunk
    { id: 'edena.lantern', item: 'lantern', at: [-52, 85.7, 66], toward: [-60, 70],
      hint: 'A makers’ box waits on the top canopy of the umbrella tree west of the landing. Climb the trunk',
      note: 'Up the umbrella tree west of the spawn, on its top canopy.' },
  ],
  spheres: [
    // the grove's umbrella tree, on its flat canopy
    { id: 'spheres.lens', item: 'lens', at: [62, 24, -4], toward: [56, 2],
      hint: 'A makers’ box sits on the canopy of the grove’s umbrella tree, east of the landing. Climb the trunk',
      note: 'On the canopy of the grove’s umbrella tree east of the spawn.' },
  ],
  perdide: [
    // the swamp of lights: a mossy rise above Wendel’s glowing eggs, where the creatures crowd
    { id: 'perdide.stun', item: 'stun', at: [30, 6.2, -30], toward: [0, 0],
      hint: 'A makers’ box hides on the mossy rise south-east of the landing, among the creatures',
      note: 'The mossy rise south-east of the landing, among the wildlife.' },
  ],
  perdide2: [
    // the top of the first root arch over the path
    { id: 'perdide2.cell', item: 'cell', at: [-18.8, 15.1, -89.5], toward: [0, 0],
      hint: 'A makers’ box sits on top of the first root arch over the path. Climb its root',
      note: 'On top of the first root arch over the path; climb its root.' },
  ],
};

/**
 * A world that needs an item you don't have gets a box with it beside the
 * ship's ramp (or the spawn): when(levelId, level) says if the world needs it.
 * Skipped if the world's own table already has a box with that item.
 */
export const FALLBACKS = [
  // the backpack powers everything; you could arrive anywhere without it (the worlds menu)
  { item: 'backpack', slot: 0, when: ({ levelId }) => levelId !== 'desert' && levelId !== 'home' },
  // the jetpack worlds need jets
  { item: 'jetpack', slot: 1, when: ({ level }) => !!level?.features?.jetpack },
];

/** Offsets tried for a fallback box: [right, forward] metres from the ramp's foot, facing out of the ship. */
export const FALLBACK_OFFSETS = [
  [[3.4, 4.2], [-3.4, 4.2], [4.6, 1.5], [-4.6, 1.5], [0, 6.5], [6, 6], [-6, 6], [2.5, 9], [-2.5, 9]],
  [[-3.6, 5.6], [3.6, 6.2], [-5, 2.8], [5, 3], [0, 9], [-7, 7], [7, 7], [-3, 11], [3, 11]],
];
