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
//            starts when you arrive (once you have found a box of your own) and leads the scout there
//            (the desert's first box is the story's)
//   note     where it is and how you get there (for people, not the code)
//   temple   the box stands inside that world's temple (src/temples/): the gadget there is the key to
//            the temple's later rooms; no box quest of its own (the temple's quest leads to it)
//   story    the main quest leads there (the desert's lift valve and gun, in the cave and the Hearth: interiors
//            built far from the world's ground, through their doorways): no box quest of its own
//
// The makers' gifts are split half and half: the tools that open a temple's later rooms wait inside
// it, the small gifts in the open (src/temples/index.js GADGETS has the plan, world by world).
//
// tests/boxes.test.js checks that every one stands on reachable ground.

export const PLACEMENTS = {
  desert: [
    // the makers' pedestal in Qanat: a carved stone dais high on the burning tree's trunk (7 m up), on
    // a stone pier standing on a buttress root's shoulder: two pitches to climb (src/desert-city.js
    // builds it), above the terrace beside the dry well. Up the main stairs from the gate, on the left
    // of the well; the box's pale column shows the way.
    { id: 'desert.backpack', item: 'backpack', site: (level) => level.qanat?.city.ledge && { at: level.qanat.city.ledge.box.toArray(), face: level.qanat.city.ledge.yaw }, beacon: 170,
      note: 'In Qanat, on the makers’ pedestal high on the burning tree’s trunk, left of the dry well: climb the buttress root, then the stone pier. The first find, and the elder’s.' },
    // the progression rewrite (v1.38, docs/systems/progression.md): he comes with his sword alone. The backpack's first
    // strength, the lift valve (the double jump), waits by the giant's pool in the cave of the giant's heart: the main
    // quest leads down there to fill the tank (and the box hums once it is full), on the dry floor between the basin and
    // the cave's wall, facing the pool
    { id: 'desert.lift', item: 'doublejump', site: (level) => level.qanat?.cave && { at: level.qanat.cave.local(16, 0, 13).toArray(), face: Math.atan2(-16, -13) }, story: true,
      note: 'In the cave of the giant’s heart (the skull’s mouth, past Qanat’s back gate), on the floor beside the pool. The main quest goes there to fill the tank.' },
    // the fluid gun (a gadget) in the Givers' Hearth, by the stone ball its push rolls (the main quest's spark-stone):
    // on the hall's floor across from the plinth, facing the passage in
    { id: 'desert.gun', item: 'gun', site: (level) => level.hearth?.local && { at: level.hearth.local(8.5, 0, -2).toArray(), face: 0 }, story: true,
      note: 'In the Givers’ Hearth far out in the red rocks (the hoverbike’s ride), on the hall’s floor across from the stone ball. The main quest goes there for the spark-stone.' },
    // Qanat: on the flat roof of a domeless house inside the main gate (a 6 m climb)
    { id: 'desert.star', item: 'star', at: [246.9, 7.6, 363.6], lift: 0.5, toward: [230, 330],
      hint: 'A makers’ box sits on a flat roof just inside Qanat’s main gate. Climb the house wall',
      note: 'A house roof just inside the main gate of the old city; climb its wall.' },
    // the Givers' House (src/temples/desert.js): on the dais in its Chest Chamber, half-way through. Ember mode
    // is the key to the rest: the braziers by the door beyond, the bridge, the thorns, the Keeper's cistern.
    { id: 'desert.temple.fire', item: 'fire', temple: 'desert', site: (level) => level.temple?.gadgetSite,
      note: 'Inside the rose-stone house in the eastern dunes, in the round chamber past the sand pit.' },
  ],
  incal: [
    // the first jetpack world: the jets wait on the makers' pillar, a lone stone column on the rim 130 m
    // round from the ship (src/levels/incal.js PILLAR): a 14 m climb, no jetpack needed (you need them for the shaft)
    // It held the jets until the makers' tower was built (src/temples/incal.js): the jets are its key now, and
    // the pillar keeps the soft-fall soles, a gift in the open
    { id: 'incal.soles', item: 'soles', at: [Math.cos(0.45) * 286, 216, Math.sin(0.45) * 286], toward: [274, 0], beacon: true,
      hint: 'A makers’ box waits on top of the lone stone pillar on the rim, round from the ship. Climb it',
      note: 'On top of the makers’ pillar on the rim, round from the ship: climb the column.' },
    // the Warden's Well (src/temples/incal.js): in the chamber half-way up. The jets are the key to the rest: the way
    // up through its ceiling, the eyes over their shelves, the warden's crown
    { id: 'incal.temple.jetpack', item: 'harness', temple: 'incal',   // (its id from when it held the jets: the saves' flag)
      site: (level) => level.temple?.gadgetSite,
      note: 'Inside the makers’ tower on the rim, in the round chamber over the climbing well.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'incal.bridge', item: 'bridge', site: (level) => level.finds?.court?.box ?? null, beacon: 160, gadget: true,
      hint: 'A makers’ court stands on the plateau beyond the rim, behind the landing, towers across a gap. A box waits at its edge',
      note: 'In the makers’ court on the plateau beyond the rim behind the landing: towers across a gap, a rise to a lamp. The pen spans the shaft’s terraces too.' },
  ],
  arzach: [
    // the capped needle spire out on the plain, halfway from the landing to the lone tower (Senn listens at its foot,
    // a shed feather lies on its cap): a long climb or a landing on the bird. (v1.9, the level design audit: it was on a
    // spire 240 m north, a trip there and back with nothing else on it.)
    // It held the bell-note whistle until the Founders' Belfry was built (src/temples/arzach2.js): the bell belongs
    // to the bell world, and is the belfry's key now. The spire keeps the hush-cloth, a gift in the open
    { id: 'arzach.hush', item: 'hush', at: [172.5, 86.2, -278], toward: [0, 0],
      hint: 'A makers’ box sits on the flat cap of the needle spire out on the plain, halfway to the lone tower. Climb it, or land the bird on top',
      note: 'The flat cap of the needle spire on the plain halfway from the landing to the lone tower, where Senn listens; climb it or land the bird on it.' },
    // the Aerie (src/temples/arzach.js): in its round chamber over the feather stair. The wings are the key to the
    // rest: the gulf, the wind well, the Elder, who will not fly alone
    { id: 'arzach.temple.glider', item: 'glider', temple: 'arzach', site: (level) => level.temple?.gadgetSite,
      note: 'Inside the Aerie on the plain west of the landing, in the round chamber at the top of the feather stair.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'arzach.hook', item: 'hook', site: (level) => level.finds?.court?.box ?? null, beacon: 160, gadget: true,
      hint: 'A makers’ court of pale stone stands on the rise west of the landing, rings high on its towers. A box waits at its edge',
      note: 'In the makers’ court on the rise west of the landing, at its front edge: rings on its wall and towers to reel up to.' },
  ],
  arzach2: [
    // the sky stones: the top of the balanced five-stone stack on the start plateau
    // It held the fluid wings until Vael's Aerie was built (src/temples/arzach.js): the wings are the Aerie's key
    // now, and the stack keeps the wind-silk scarf, a gift in the open
    { id: 'arzach2.scarf', item: 'scarf', at: [35, 65.3, -43.5], toward: [0, 22],
      hint: 'A makers’ box teeters on the top stone of the balanced stack on the starting plateau. Climb the stones',
      note: 'The top stone of the balanced stack on the starting plateau: a teetering climb.' },
    // the Founders' Belfry (src/temples/arzach2.js): in the bell chamber half-way up. The whistle is the key to the
    // rest: the bell-tuned doors, the stones that come down into a bridge, the Cloud-Mother's calm
    { id: 'arzach2.temple.bell', item: 'bell', temple: 'arzach2', site: (level) => level.temple?.gadgetSite,
      note: 'Inside the Founders’ Belfry, out of the cloud west of the starting plateau, in the round chamber over the stone stair.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'arzach2.springs', item: 'springs', site: (level) => level.finds?.court?.box ?? null, beacon: 160, gadget: true,
      hint: 'A makers’ court stands at the north end of the starting plateau, its tall blocks over the cloud. A box waits at its edge',
      note: 'In the makers’ court at the north end of the starting plateau: blocks of 4, 8 and 12 m and a tower to bounce up.' },
  ],
  garage: [
    // on the keep's south curtain wall, facing the spawn (a 14 m climb)
    // It held the quick coil until the First Garage was built (src/temples/garage.js): the coil is its key now, and
    // the wall keeps the brass level, a gift in the open (a new box: saves that opened the coil's find it there)
    { id: 'garage.level', item: 'level', at: [8, 14, 24], toward: [0, 120],
      hint: 'A makers’ box stands on top of the keep’s south curtain wall. Climb the wall',
      note: 'The top of the keep’s south curtain wall.' },
    // the First Garage (src/temples/garage.js): in its round chamber over the winding well. The coil is the key to the
    // rest: the banks of six eyes that wake only together (two tanks in one breath), the Foreman's six numerals
    { id: 'garage.temple.coil', item: 'coil', temple: 'garage', site: (level) => level.temple?.gadgetSite,
      note: 'Inside the First Garage on the plateau’s rim west of the keep, in the round chamber over the winding well.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'garage.magnet', item: 'magnet', site: (level) => level.finds?.court?.box ?? null, beacon: 160, gadget: true,
      hint: 'A makers’ court stands on the plain west of the landing, an iron block on a pillar. A box waits at its edge',
      note: 'In the makers’ court on the plain west of the landing: a plate only metal presses, an iron block across a gap. The Hangar’s brass pumps pull you up too.' },
  ],
  buried: [
    // the ring platform round the smoking chimney stack (jets or a climb up the stack). It held ember mode
    // until the Givers' House was built: the ember is the desert temple's key now, the resin a gift in the open
    { id: 'buried.resin', item: 'resin', at: [110, 33.8, 144.5], toward: [110, 160],
      hint: 'A makers’ box rests on the lower ring platform of the smoking chimney stack, north-east of the landing',
      note: 'The lower ring platform of the chimney stack north-east of the spawn, on its +z side.' },
    // the Engine-House (src/temples/buried.js): in the round chamber past the counterweight. The fourth chamber
    // is the key to the rest: the banks of four eyes that wake only together, the Tooth-Warden's four vents
    { id: 'buried.temple.cell', item: 'cell', temple: 'buried', site: (level) => level.temple?.gadgetSite,
      note: 'Inside the Engine-House on the dunes west of the domes, in the round chamber past the counterweight.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'buried.monocle', item: 'monocle', site: (level) => level.finds?.court?.box ?? null, beacon: 160, gadget: true,
      hint: 'A makers’ court stands on the dunes west of the landing, two towers and a plank between them. A box waits at its edge',
      note: 'In the makers’ court on the dunes west of the landing: a false plank, a true path of glass, writing only the lens reads. The canyon’s glass bridge too.' },
  ],
  edena: [
    // the upper canopy of an umbrella tree: climb the trunk
    // It held the lantern charm until the Lamp-House was built (src/temples/perdide2.js): the lantern is that
    // temple's key now, and the canopy keeps the seed pouch, a gift in the open
    { id: 'edena.pouch', item: 'pouch', at: [-52, 85.7, 66], toward: [-60, 70],
      hint: 'A makers’ box waits on the top canopy of the umbrella tree west of the landing. Climb the trunk',
      note: 'Up the umbrella tree west of the spawn, on its top canopy.' },
    // the Builders' Greenhouse (src/temples/edena.js): in its round chamber over the glass stair. Bloom mode (a new
    // gun mode) is the key to the rest: the budded doors, the vine bridge, the vine up the glass, the Gardener
    { id: 'edena.temple.bloom', item: 'bloom', temple: 'edena', site: (level) => level.temple?.gadgetSite,
      note: 'Inside the Builders’ Greenhouse in the meadow hollow north of the white ruins, in the round chamber over the glass stair.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'edena.bubble', item: 'bubble', site: (level) => level.finds?.court?.box ?? null, beacon: 160, gadget: true,
      hint: 'A makers’ court stands in the meadow south-west of the landing, a ledge with a gate on it. A box waits at its edge',
      note: 'In the makers’ court in the meadow south-west of the landing: a crate to float up onto the ledge’s plate.' },
  ],
  spheres: [
    // the grove's umbrella tree, on its flat canopy
    // It held the glyph lens until the Footprint was built (src/temples/spheres.js): the lens is its key now, and
    // the canopy keeps the listening shell, a gift in the open
    { id: 'spheres.shell', item: 'shell', at: [62, 24, -4], toward: [56, 2],
      hint: 'A makers’ box sits on the canopy of the grove’s umbrella tree, east of the landing. Climb the trunk',
      note: 'On the canopy of the grove’s umbrella tree east of the spawn.' },
    // the Footprint (src/temples/spheres.js): in the round chamber half-way in. The lens is the key to the rest:
    // the door that is wall without it, the bridge and the eye only it shows
    { id: 'spheres.temple.lens', item: 'lens', temple: 'spheres', site: (level) => level.temple?.gadgetSite,
      note: 'Inside the Footprint north of the grove, in the heel, in the round chamber past the still pool.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'spheres.bomb', item: 'bomb', site: (level) => level.finds?.court?.box ?? null, beacon: 160, gadget: true,
      hint: 'A makers’ court stands in the grove south-west of the landing, a cracked wall closing an alcove. A box waits at its edge',
      note: 'In the makers’ court in the grove south-west of the landing: a cracked wall, a cracked boulder, crates to throw.' },
  ],
  perdide: [
    // the swamp of lights: on top of Wendel's lookout, the stepped crystal on the mossy rise east of the landing
    // (src/lorn-ways.js; level design audit, fifth round: the swamp's one high place, 30 m up)
    // It held the stilling mode until the Hush-House was built (src/temples/perdide.js): the stilling mode is the
    // house's key now, and the lookout keeps the breathing reed, a gift in the open
    { id: 'perdide.reed', item: 'reed', at: [62, 37, -32], toward: [0, 0],
      hint: 'A makers’ box sits on top of Wendel’s lookout, the stepped crystal on the rise east of the landing. Climb it a step at a time',
      note: 'On top of Wendel’s lookout, the stepped teal crystal on the mossy rise east of the landing: four short climbs and the last.' },
    // the Hush-House (src/temples/perdide.js): in its round chamber over the bog well. The stilling mode is the key
    // to the rest: the gates of jaws, the pendulums, the Mother Snapper
    { id: 'perdide.temple.stun', item: 'stun', temple: 'perdide', site: (level) => level.temple?.gadgetSite,
      note: 'Inside the Hush-House on the cave island, in the round chamber over the bog well.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'perdide.fan', item: 'fan', site: (level) => level.finds?.court?.box ?? null, beacon: 160, gadget: true,
      hint: 'A makers’ court stands on the dry ground east of the landing, three pinwheels on its posts. A box waits at its edge',
      note: 'In the makers’ court on the dry ground east of the landing: pinwheels, a fire in a hut’s door, a ledge to hover up to. Its gusts fill the skiff’s sail too.' },
  ],
  perdide2: [
    // the top of the first root arch over the path
    // It held the fourth chamber until the Engine-House was built (src/temples/buried.js): the chamber is the
    // Buried Machine's temple key now, and the arch keeps the glow-moss pin, a gift in the open
    { id: 'perdide2.moss', item: 'moss', at: [-18.8, 15.1, -89.5], toward: [0, 0],
      hint: 'A makers’ box sits on top of the first root arch over the path. Climb its root',
      note: 'On top of the first root arch over the path; climb its root.' },
    // the Lamp-House (src/temples/perdide2.js): in its dark round chamber over the root stair. The lantern is the
    // key to the rest: the lamps that wake to it, the moss-stones and the eye only its light shows, the Lampless
    { id: 'perdide2.temple.lantern', item: 'lantern', temple: 'perdide2', site: (level) => level.temple?.gadgetSite,
      note: 'Inside the Lamp-House in the shallows east of the root cave, in the dark chamber over the root stair.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'perdide2.boomerang', item: 'boomerang', site: (level) => level.finds?.court?.box ?? null, beacon: 160, gadget: true,
      hint: 'A makers’ court stands on the dry ground south-east of the landing, crates hung from its beam. A box waits at its edge',
      note: 'In the makers’ court on the dry ground south-east of the landing: targets, lanterns, crates on ropes and pots of ink out of reach.' },
  ],
  bazaar: [
    // the market has no chest in the open. The Undertower (src/temples/bazaar.js), under the silent tower: in its
    // round chamber over the cable well. The echo shell (a new tool) is the key to the rest: the doors and the
    // bridge that listen for a note played back, the First Sign that wants its own word
    { id: 'bazaar.temple.echo', item: 'echo', temple: 'bazaar', site: (level) => level.temple?.gadgetSite,
      note: 'Inside the Undertower, through the old doorway in the silent tower’s back, in the round chamber over the cable well.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'bazaar.recall', item: 'recall', site: (level) => level.finds?.court?.box ?? null, beacon: 160, gadget: true,
      hint: 'A makers’ court stands east of the start, by the market’s edge, a crate on a high ledge. A box waits at its edge',
      note: 'In the makers’ court east of the start: a crate on a high ledge to knock down, ride and send back up. The market’s cabs go back along their lanes too.' },
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
  // the desert's two other finds (v1.38): the worlds after it are built for the double jump (the sky stones, the
  // tower's steps, the crowns of trees) and the fluid gun (lamps, plates, the hands-on errands, the temples)
  { item: 'doublejump', slot: 2, when: ({ levelId }) => levelId !== 'desert' && levelId !== 'home' },
  { item: 'gun', slot: 3, when: ({ levelId }) => levelId !== 'desert' && levelId !== 'home' },
  // (the jets anywhere are a debug item since v1.38: no fallback box of them; the City-Shaft has its harness in its temple)
];

/** Offsets tried for a fallback box: [right, forward] metres from the ramp's foot, facing out of the ship. */
export const FALLBACK_OFFSETS = [
  [[3.4, 4.2], [-3.4, 4.2], [4.6, 1.5], [-4.6, 1.5], [0, 6.5], [6, 6], [-6, 6], [2.5, 9], [-2.5, 9]],
  [[-3.6, 5.6], [3.6, 6.2], [-5, 2.8], [5, 3], [0, 9], [-7, 7], [7, 7], [-3, 11], [3, 11]],
  [[6.4, 2.2], [-6.4, 2.6], [1.6, 7.8], [-8, 4.4], [8, 9], [-5.4, 10], [9.5, 2], [-9.5, 2], [5, 12.5]],
  [[-1.6, 7.8], [6.8, 5.4], [-6.8, 6.2], [9, 5.2], [-9, 8.6], [1.4, 12.5], [-6, 13], [10.5, 11], [-11, 3]],
];
