// Where the item boxes stand, world by world (src/boxes/index.js builds them): by the part (the old world) they
// were placed for, in its own coordinates; a merged world places its parts' boxes, each moved by its part's
// offset (src/levels/names.js PARTS, PART_OFFSET; placementsFor). The Sealed Hangar's went to the Glass Dunes.
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

/** A temple's chest (the temple by its id: a merged world has two). */
const templeSite = (id) => (level) => (level.temples?.find((t) => t.id === id) ?? level.temple)?.gadgetSite;
/** A temple's second chest (a `find`, logic.js: the Givers' guard), by the find's element id. */
const findSite = (id, el) => (level) => (level.temples?.find((t) => t.id === id) ?? level.temple)?.findSites?.[el];
/** A makers' court's box (the court by the part it was made for: src/finds/courts.js courtBoxOf). */
const courtSite = (id) => (level) => level?.finds?.courts?.[id]?.box ?? level?.finds?.court?.box ?? null;

export const PLACEMENTS = {
  desert: [
    // the makers' ledge in Qanat: a plank shelf high on the burning tree's trunk (7 m up), on a pier of
    // root standing on a buttress root's shoulder: two pitches to climb (src/desert-city.js builds it),
    // over the town's square beside the dry well. Up the avenue from the gate, on the left of the well;
    // the box's pale column shows the way.
    // (`dry`: its tank comes out empty, as src/story/desert.js leaves it, unless the pool has already risen: the box's scene shows it so)
    { id: 'desert.backpack', item: 'backpack', found: 'box.found.backpack', dry: (game) => !game.flag('desert.channel.open') && !game.flag('desert.pool.tinted'), site: (level) => level.qanat?.city.ledge && { at: level.qanat.city.ledge.box.toArray(), face: level.qanat.city.ledge.yaw }, beacon: 170,
      note: 'In Qanat, on the makers’ ledge high on the burning tree’s trunk in the town’s square, left of the dry well: climb the buttress root, then the pier. The first find, and the elder’s.' },
    // the progression rewrite (v1.38, docs/systems/progression.md; v1.44: he comes with nothing in his hands). The backpack's first
    // strength, the lift valve (the double jump), waits by the giant's pool in the cave of the giant's heart: the main
    // quest leads down there to fill the tank (and the box hums once it is full), on the dry floor between the basin and
    // the cave's wall, facing the pool
    { id: 'desert.lift', item: 'doublejump', site: (level) => level.qanat?.cave && { at: level.qanat.cave.local(16, 0, 13).toArray(), face: Math.atan2(-16, -13) }, story: true,
      note: 'In the cave of the giant’s heart (the skull’s mouth, past Qanat’s back gate), on the floor beside the pool. The main quest goes there to fill the tank.' },
    // the fluid gun (a gadget) in the Givers' Hearth, by the stone ball its push rolls (the main quest's spark-stone):
    // on the hall's floor across from the plinth, facing the passage in
    { id: 'desert.gun', item: 'gun', site: (level) => level.hearth?.local && { at: level.hearth.local(8.5, 0, -2).toArray(), face: 0 }, story: true,
      note: 'In the Givers’ Hearth far out in the red rocks (the hoverbike’s ride), on the hall’s floor across from the stone ball. The main quest goes there for the spark-stone.' },
    // ember mode (v1.44: the Givers' House's key until the house was remade for the blade): in the Givers' Hearth, where
    // the Givers kept their fire, by the gun (a mode: the gun shoots it; the main quest goes there)
    { id: 'desert.hearth.fire', item: 'fire', site: (level) => level.hearth?.local && { at: level.hearth.local(5.5, 0, 6).toArray(), face: Math.PI * 0.75 }, story: true,
      note: 'In the Givers’ Hearth, where the Givers kept their fire: on the hall’s floor, by the gun, nearer the passage in.' },
    // Qanat: on the flat roof of a domeless house inside the main gate (a 6 m climb)
    { id: 'desert.star', item: 'star', at: [246.9, 7.6, 363.6], lift: 0.5, toward: [230, 330],
      hint: 'On a roof just inside Qanat’s main gate',
      note: 'A house roof just inside the main gate of the old city; climb its wall.' },
    // the Givers' House (src/temples/desert.js, v1.44): on the dais in its Sword Chamber, half-way through, the Givers'
    // blade, the key to the rest (the thorns, the balls a cut sends far, the eye, the Keeper's spokes); on the Hall of
    // Fires' far landing their guard, for the wind of their bellows and the Keeper's charge. (Ember mode was here before.)
    { id: 'desert.temple.sword', item: 'sword', temple: 'desert', site: templeSite('desert'),
      note: 'Inside the rose-stone house in the eastern dunes, in the round chamber past the sand pit.' },
    { id: 'desert.temple.shield', item: 'shield', temple: 'desert', site: findSite('desert', 'guard'),
      note: 'Inside the rose-stone house in the eastern dunes, on the far landing of the Hall of Fires.' },
  ],
  incal: [
    // the first jetpack world: the jets wait on the makers' pillar, a lone stone column on the rim 130 m
    // round from the ship (src/levels/incal.js PILLAR): a 14 m climb, no jetpack needed (you need them for the shaft)
    // It held the jets until the makers' tower was built (src/temples/incal.js): the jets are its key now, and
    // the pillar keeps the soft-fall soles, a gift in the open
    { id: 'incal.soles', item: 'soles', at: [Math.cos(0.45) * 286, 216, Math.sin(0.45) * 286], toward: [274, 0], beacon: true,
      hint: 'On the lone stone pillar on the rim',
      note: 'On top of the makers’ pillar on the rim, round from the ship: climb the column.' },
    // the Warden's Well (src/temples/incal.js): in the chamber half-way up, the Warden's bellows (the jets until v1.42).
    // They are the key to the rest: the draught up through its ceiling, the great vanes, the warden's crown
    { id: 'incal.temple.jetpack', item: 'wardenbellows', temple: 'incal',   // (its id from when it held the jets: the saves' flag)
      site: templeSite('incal'),
      note: 'Inside the makers’ tower on the rim, in the round chamber over the climbing well.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'incal.bridge', item: 'bridge', site: courtSite('incal'), beacon: 160, gadget: true,
      hint: 'At the makers’ court beyond the rim',
      note: 'In the makers’ court on the plateau beyond the rim behind the landing: towers across a gap, a rise to a lamp. The pen spans the shaft’s terraces too.' },
  ],
  arzach: [
    // the capped needle spire out on the plain, halfway from the landing to the lone tower (Senn listens at its foot,
    // a shed feather lies on its cap): a long climb or a landing on the bird. (v1.9, the level design audit: it was on a
    // spire 240 m north, a trip there and back with nothing else on it.)
    // It held the bell-note whistle until the Founders' Belfry was built (src/temples/arzach2.js): the bell belongs
    // to the bell world, and is the belfry's key now. The spire keeps the hush-cloth, a gift in the open
    { id: 'arzach.hush', item: 'hush', at: [172.5, 86.2, -278], toward: [0, 0],
      hint: 'On the needle spire out on the plain',
      note: 'The flat cap of the needle spire on the plain halfway from the landing to the lone tower, where Senn listens; climb it or land the bird on it.' },
    // the Aerie (src/temples/arzach.js): in its round chamber over the feather stair. The wings are the key to the
    // rest: the gulf, the wind well, the Elder, who will not fly alone
    { id: 'arzach.temple.glider', item: 'glider', temple: 'arzach', site: templeSite('arzach'),
      note: 'Inside the Aerie on the plain west of the landing, in the round chamber at the top of the feather stair.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'arzach.hook', item: 'hook', site: courtSite('arzach'), beacon: 160, gadget: true,
      hint: 'At the pale court west of the landing',
      note: 'In the makers’ court on the rise west of the landing, at its front edge: rings on its wall and towers to reel up to.' },
  ],
  arzach2: [
    // the sky stones: the top of the balanced five-stone stack on the start plateau
    // It held the fluid wings until Vael's Aerie was built (src/temples/arzach.js): the wings are the Aerie's key
    // now, and the stack keeps the wind-silk scarf, a gift in the open
    { id: 'arzach2.scarf', item: 'scarf', at: [35, 65.3, -43.5], toward: [0, 22],
      hint: 'On the balanced stack on the first sky stone',
      note: 'The top stone of the balanced stack on the first sky stone, the plateau over the cloud south of the plain: a teetering climb.' },
    // the Founders' Belfry (src/temples/arzach2.js): in the bell chamber half-way up. The whistle is the key to the
    // rest: the bell-tuned doors, the stones that come down into a bridge, the Cloud-Mother's calm
    { id: 'arzach2.temple.bell', item: 'bell', temple: 'arzach2', site: templeSite('arzach2'),
      note: 'Inside the Founders’ Belfry, out of the cloud west of the first sky stone, in the round chamber over the stone stair.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'arzach2.springs', item: 'springs', site: courtSite('arzach2'), beacon: 160, gadget: true,
      hint: 'At the makers’ court on the first sky stone',
      note: 'In the makers’ court at the north end of the first sky stone: blocks of 4, 8 and 12 m and a tower to bounce up.' },
  ],
  glassdunes: [
    // (the Sealed Hangar's three, moved with the First Garage, now the Clock-House, when the Hangar was dismissed in
    // October 2026: src/levels/names.js DISMISSED; their ids stay, so a save that opened one keeps it opened)
    // the brass level, a gift in the open: on top of the glass mound west of the valley (a 14 m climb)
    { id: 'garage.level', item: 'level', at: [-110, -60], toward: [-20, -60],
      hint: 'On the glass mound west of the valley',
      note: 'The top of the glass mound west of the valley floor, under the cliffs of the giants.' },
    // the Clock-House (src/temples/garage.js): in its round chamber over the winding well. The coil is the key to the
    // rest: the banks of six eyes that wake only together (two tanks in one breath), the Foreman's six numerals
    { id: 'garage.temple.coil', item: 'coil', temple: 'garage', site: templeSite('garage'),
      note: 'Inside the Clock-House east of the valley, in the round chamber over the winding well.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'garage.magnet', item: 'magnet', site: courtSite('glassdunes'), beacon: 160, gadget: true,
      hint: 'At the court north of the Clock-House',
      note: 'In the makers’ court on the sand north of the Clock-House, toward the north camp: a plate only metal presses, an iron block across a gap.' },
  ],
  buried: [
    // the ring platform round the smoking chimney stack (jets or a climb up the stack). It held ember mode
    // until the Givers' House was built: the ember is the desert temple's key now, the resin a gift in the open
    { id: 'buried.resin', item: 'resin', at: [110, 33.8, 144.5], toward: [110, 160],
      hint: 'On the smoking chimney stack’s lower ring',
      note: 'The lower ring platform of the chimney stack north-east of the spawn, on its +z side.' },
    // the Engine-House (src/temples/buried.js): in the round chamber past the counterweight. The fourth chamber
    // is the key to the rest: the banks of four eyes that wake only together, the Tooth-Warden's four vents
    { id: 'buried.temple.cell', item: 'cell', temple: 'buried', site: templeSite('buried'),
      note: 'Inside the Engine-House on the dunes west of the domes, in the round chamber past the counterweight.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'buried.monocle', item: 'monocle', site: courtSite('buried'), beacon: 160, gadget: true,
      hint: 'At the makers’ court west of the landing',
      note: 'In the makers’ court on the dunes west of the landing: a false plank, a true path of glass, writing only the lens reads. The canyon’s glass bridge too.' },
  ],
  edena: [
    // the upper canopy of an umbrella tree: climb the trunk
    // It held the lantern charm until the Lamp-House was built (src/temples/perdide2.js): the lantern is that
    // temple's key now, and the canopy keeps the seed pouch, a gift in the open
    { id: 'edena.pouch', item: 'pouch', at: [-52, 85.7, 66], toward: [-60, 70],
      hint: 'On the umbrella tree west of the landing',
      note: 'Up the umbrella tree west of the spawn, on its top canopy.' },
    // the Builders' Greenhouse (src/temples/edena.js): in its round chamber over the glass stair. Bloom mode (a new
    // gun mode) is the key to the rest: the budded doors, the vine bridge, the vine up the glass, the Gardener
    { id: 'edena.temple.bloom', item: 'bloom', temple: 'edena', site: templeSite('edena'),
      note: 'Inside the Builders’ Greenhouse in the meadow hollow north of the white ruins, in the round chamber over the glass stair.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'edena.bubble', item: 'bubble', site: courtSite('edena'), beacon: 160, gadget: true,
      hint: 'At the court in the south-west meadow',
      note: 'In the makers’ court in the meadow south-west of the landing: a crate to float up onto the ledge’s plate.' },
  ],
  spheres: [
    // the grove's umbrella tree, on its flat canopy
    // It held the glyph lens until the Footprint was built (src/temples/spheres.js): the lens is its key now, and
    // the canopy keeps the listening shell, a gift in the open
    { id: 'spheres.shell', item: 'shell', at: [62, 24, -4], toward: [56, 2],
      hint: 'On the grove’s umbrella tree, east of the landing',
      note: 'On the canopy of the grove’s umbrella tree east of the spawn.' },
    // the Footprint (src/temples/spheres.js): in the round chamber half-way in. The lens is the key to the rest:
    // the door that is wall without it, the bridge and the eye only it shows
    { id: 'spheres.temple.lens', item: 'lens', temple: 'spheres', site: templeSite('spheres'),
      note: 'Inside the Footprint north of the grove, in the heel, in the round chamber past the still pool.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'spheres.bomb', item: 'bomb', site: courtSite('spheres'), beacon: 160, gadget: true,
      hint: 'At the court in the south-west grove',
      note: 'In the makers’ court in the grove south-west of the landing: a cracked wall, a cracked boulder, crates to throw.' },
  ],
  perdide: [
    // the swamp of lights: on top of Wendel's lookout, the stepped crystal on the mossy rise east of the landing
    // (src/lorn-ways.js; level design audit, fifth round: the swamp's one high place, 30 m up)
    // It held the stilling mode until the Hush-House was built (src/temples/perdide.js): the stilling mode is the
    // house's key now, and the lookout keeps the breathing reed, a gift in the open
    { id: 'perdide.reed', item: 'reed', at: [62, 37, -32], toward: [0, 0],
      hint: 'On top of Wendel’s crystal lookout',
      note: 'On top of Wendel’s lookout, the stepped teal crystal on the mossy rise east of the landing: four short climbs and the last.' },
    // the Hush-House (src/temples/perdide.js): in its round chamber over the bog well. The stilling mode is the key
    // to the rest: the gates of jaws, the pendulums, the Mother Snapper
    { id: 'perdide.temple.stun', item: 'stun', temple: 'perdide', site: templeSite('perdide'),
      note: 'Inside the Hush-House on the cave island, in the round chamber over the bog well.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'perdide.fan', item: 'fan', site: courtSite('perdide'), beacon: 160, gadget: true,
      hint: 'At the pinwheel court east of the landing',
      note: 'In the makers’ court on the dry ground east of the landing: pinwheels, a fire in a hut’s door, a ledge to hover up to. Its gusts fill the skiff’s sail too.' },
  ],
  perdide2: [
    // the top of the first root arch over the path
    // It held the fourth chamber until the Engine-House was built (src/temples/buried.js): the chamber is the
    // Buried Machine's temple key now, and the arch keeps the glow-moss pin, a gift in the open
    { id: 'perdide2.moss', item: 'moss', at: [-18.8, 15.1, -89.5], toward: [0, 0],
      hint: 'On top of the first root arch',
      note: 'On top of the first root arch over the path; climb its root.' },
    // the Lamp-House (src/temples/perdide2.js): in its dark round chamber over the root stair. The lantern is the
    // key to the rest: the lamps that wake to it, the moss-stones and the eye only its light shows, the Lampless
    { id: 'perdide2.temple.lantern', item: 'lantern', temple: 'perdide2', site: templeSite('perdide2'),
      note: 'Inside the Lamp-House in the shallows east of the root cave, in the dark chamber over the root stair.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'perdide2.boomerang', item: 'boomerang', site: courtSite('perdide2'), beacon: 160, gadget: true,
      hint: 'At the court south-east of the island',
      note: 'In the makers’ court on the dry ground south-east of the Deep Wood’s island: targets, lanterns, crates on ropes and pots of ink out of reach.' },
  ],
  bazaar: [
    // the market has no chest in the open. The Undertower (src/temples/bazaar.js), under the silent tower: in its
    // round chamber over the cable well. The echo shell (a new tool) is the key to the rest: the doors and the
    // bridge that listen for a note played back, the First Sign that wants its own word
    { id: 'bazaar.temple.echo', item: 'echo', temple: 'bazaar', site: templeSite('bazaar'),
      note: 'Inside the Undertower, through the old doorway in the silent tower’s back, in the round chamber over the cable well.' },
    // the makers' court (src/finds/courts.js): the gadget, with what it is for round it
    { id: 'bazaar.recall', item: 'recall', site: courtSite('bazaar'), beacon: 160, gadget: true,
      hint: 'At the makers’ court by the market’s edge',
      note: 'In the makers’ court east of the start: a crate on a high ledge to knock down, ride and send back up. The market’s cabs go back along their lanes too.' },
  ],
  moonfoundry: [
    // the pocket bellows, a gift in the open: on the crown of the moon in its cradle's claws (a climb up the claws and the shell)
    { id: 'moonfoundry.bellows', item: 'bellows', at: [64, 46, -92], toward: [40, -60],
      hint: 'On top of the moon in the orange claws',
      note: 'The crown of the cradled moon (CRADLE), 42 m up: climb a claw of the cradle, then the shell.' },
    // the Casting-House (src/temples/moonfoundry.js): in the round chamber at the top of the hoist. The tongs are the key
    // to the rest: the iron moons that only roll for them, the hot moons through the pilot flames, the Last Founder's cradle
    { id: 'moonfoundry.temple.tongs', item: 'tongs', temple: 'moonfoundry', site: templeSite('moonfoundry'),
      note: 'Inside the Casting-House on the hangar’s east side, in the round chamber at the top of the hoist.' },
  ],
  spacecity: [
    // the star-thread, a gift in the open: on the flat roof of a tall house on the Towers, just past the Towers bridge
    // (a 12 m climb from the deck)
    { id: 'spacecity.starthread', item: 'starthread', at: [87.5, 18.6, -70.5], toward: [98, -84],
      hint: 'On a tall house’s roof on the Towers',
      note: 'The flat roof of a tall house on the Towers, south-east of where the Towers bridge lands; climb its wall from the lane.' },
    // the Mooring-House (src/temples/spacecity.js): in the Cord Loft past the great door. Tether mode is the key to the
    // rest: the moorers' rings, the balls out on their cables over the void, the Anchor-Warden's anchors
    { id: 'spacecity.temple.tether', item: 'tether', temple: 'spacecity', site: templeSite('spacecity'),
      note: 'Inside the Mooring-House on the Moorings north of the Towers, in the round loft past the great door.' },
  ],
  underwater: [
    // the diver's pearl, a gift in the open: on the top deck of the tower of pods inside the Avenue's dome (a climb up
    // the pods from the street, three decks)
    { id: 'underwater.pearl', item: 'pearl', at: [-22.0, 15.7, -21.3], toward: [-24, -16],
      hint: 'Atop the pod tower in the great dome',
      note: 'The top deck of the tower of pods in the Avenue (level.decks), 16 m up: climb from deck to deck.' },
    // the Whale-House (src/temples/underwater.js): on the shell pulpit in the Horn Chamber. The horn is the key to the rest:
    // the held door, the ear behind the tank's glass, the ear over the Listener's Door, the Listener itself
    { id: 'underwater.temple.horn', item: 'horn', temple: 'underwater', site: templeSite('underwater'),
      note: 'Inside the Whale-House at the end of the last tube north of the Plaza, on the shell pulpit in the round chamber.' },
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
  // the Givers' blade and guard (v1.44): the desert's temple holds them, and a traveller who left the desert without
  // going in finds them by the ship in the next world (every world after it has foes in its wilds)
  { item: 'sword', slot: 1, when: ({ levelId }) => levelId !== 'desert' && levelId !== 'home' },
  { item: 'shield', slot: 4, when: ({ levelId }) => levelId !== 'desert' && levelId !== 'home' },
  // (the jets anywhere are a debug item since v1.38: no fallback box of them; the City-Shaft has its bellows in its temple)
];

/** Offsets tried for a fallback box: [right, forward] metres from the ramp's foot, facing out of the ship. */
export const FALLBACK_OFFSETS = [
  [[3.4, 4.2], [-3.4, 4.2], [4.6, 1.5], [-4.6, 1.5], [0, 6.5], [6, 6], [-6, 6], [2.5, 9], [-2.5, 9]],
  [[-3.6, 5.6], [3.6, 6.2], [-5, 2.8], [5, 3], [0, 9], [-7, 7], [7, 7], [-3, 11], [3, 11]],
  [[6.4, 2.2], [-6.4, 2.6], [1.6, 7.8], [-8, 4.4], [8, 9], [-5.4, 10], [9.5, 2], [-9.5, 2], [5, 12.5]],
  [[-1.6, 7.8], [6.8, 5.4], [-6.8, 6.2], [9, 5.2], [-9, 8.6], [1.4, 12.5], [-6, 13], [10.5, 11], [-11, 3]],
  [[1.8, 10.4], [-8.2, 3.6], [8.6, 7.8], [-4.4, 9.6], [11.5, 4], [-10.5, 6.6], [4.5, 14], [-8.5, 12], [12, 13]],
];
