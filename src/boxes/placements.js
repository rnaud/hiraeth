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
//   chest    'temple': the temple chest though it stands outside a temple (the desert's first, issue #140)
//   temple   the box stands inside that world's temple (src/temples/): the gadget there is the key to
//            the temple's later rooms; no box quest of its own (the temple's quest leads to it)
//   story    the main quest leads there (the desert's lift valve and gun, in the cave and the Hearth: interiors
//            built far from the world's ground, through their doorways): no box quest of its own
//   court    the box stands behind the gate of its world's makers' court (src/finds/courts.js): the court's puzzle opens it
//   lock     { tool, side }: a small lock beside the box that one tool answers (src/boxes/locks.js): shut till then
//
// The rule (v1.86, issue #518, the author: "Little chests should always be a rewards for puzzles completion. And I should
// have all the tools available at that moment in the game to open them"): every little chest outside a temple and off
// the story's way is behind a puzzle, a court's gate or a small lock, whose tool is one you have by the time you first
// reach its world (or one earned there). Climbing to a high place pays fragments, not chests. tests/boxes.test.js
// checks it over every world on the route.
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
    // the makers' dais in Qanat (issue #140, v1.49): at the burning tree's foot in the town's square, in a clearing of
    // pale flagstones between the roots, left of the trunk as you come up the avenue from the gate; a round dais of
    // white stone and gold, and on it the temple chest (`chest: 'temple'`: the first chest is the temples' own, the same
    // in every world). It stood on a plank shelf 7 m up the trunk before, a climb in two pitches (src/desert-city.js
    // builds the dais). The box's pale column shows the way.
    // (`dry`: its tank comes out empty, as src/story/desert.js leaves it, unless the pool has already risen: the box's scene shows it so)
    { id: 'desert.backpack', item: 'backpack', chest: 'temple', found: 'box.found.backpack', dry: (game) => !game.flag('desert.channel.open') && !game.flag('desert.pool.tinted'), site: (level) => level.qanat?.city.shrine && { at: level.qanat.city.shrine.box.toArray(), face: level.qanat.city.shrine.yaw }, beacon: 170,
      note: 'In Qanat, on the makers’ dais at the burning tree’s foot in the town’s square. The first find, and the elder’s.' },
    // the progression rewrite (v1.38, docs/systems/progression.md; v1.44: he comes with nothing in his hands). The backpack's first
    // strength, the lift valve (the double jump), waits by the giant's pool in the cave of the giant's heart: the main
    // quest leads down there to fill the tank (and the box hums once it is full), on the dry floor between the basin and
    // the cave's wall, facing the pool
    // (v1.45, issue #81: on its own dais by the pool's kerb at the keepers' stair's foot, in a shaft of light, nothing round
    // it; issue #68: shut and silent until the pool has filled your tank, `ready`; issue #156: in the makers' shrine, a mini
    // temple west of the pool, behind a door the full tank opens, so no shut chest stands in sight)
    { id: 'desert.lift', item: 'doublejump', site: (level) => level.qanat?.cave?.chest && { at: level.qanat.cave.chest.at.toArray(), face: level.qanat.cave.chest.face }, story: true,
      // (behind the makers' shrine's door, which opens once the cave's monsters are down (issue #730; a full tank before,
      // issue #156); it waits shut until the door is open)
      ready: (g, it) => it.has('backpack') && !!g.flag('desert.door.open'),
      sealed: 'The makers’ chest sits shut and silent on its dais.',
      note: 'In the cave of the giant’s heart (the skull’s mouth, past Qanat’s back gate), in the makers’ shrine west of the pool, on a dais in a shaft of light. The shrine’s door opens once the monsters in the cave are down.' },
    // (issue #729: the Givers' gun on the Dry Channel's near ledge in the Rose House, its chest shut until the battery is
    // full at the font beside the Hall of the Flame's bowl; its push rolls the weight there at once)
    { id: 'desert.gun', item: 'gun', temple: 'desert', site: findSite('desert', 'gun'),
      ready: g => !!g.flag('desert.battery.charged') || !!g.flag('temple.desert.found.font'), sealed: 'The chest waits for a full battery: fill it at the font by the Givers’ bowl.',
      note: 'Inside the Rose House, on the Dry Channel’s near ledge past the Hall of the Flame. Its push rolls the Givers’ weight onto its plate there.' },
    // Qanat: on the flat roof of a domeless house inside the main gate (a 6 m climb)
    // (issue #518: two cold braziers beside it, lit with the fluid gun's ember, which comes with the gun in the Rose House)
    { id: 'desert.star', item: 'star', at: [246.9, 7.6, 363.6], lift: 0.5, toward: [230, 330], lock: { tool: 'ember' },
      hint: 'Between two braziers on a roof inside Qanat’s gate',
      note: 'A house roof just inside the main gate of the old city; climb its wall, and light the braziers either side of the chest with ember.' },
    // the Givers' House (src/temples/desert.js, v1.44): on the dais in its Sword Chamber, half-way through, the Givers'
    // blade, the key to the rest (the thorns, the balls a cut sends far, the eye, the Keeper's spokes); on the Hall of
    // Fires' far landing their guard, for their watcher's bolt (issue #245) and the Keeper's charge. (Ember mode was here before: it comes with the gun now.)
    { id: 'desert.temple.sword', item: 'sword', temple: 'desert', site: templeSite('desert'),
      note: 'Inside the rose-stone house in the eastern dunes, on the Great Hall’s balcony past the Dry Channel’s bridge.' },
    { id: 'desert.temple.shield', item: 'shield', temple: 'desert', site: findSite('desert', 'guard'),
      ready: g => !!g.flag('item.sword'), sealed: 'Find the Givers’ blade on the Great Hall’s balcony first.',
      note: 'Inside the rose-stone house in the eastern dunes, in the Watcher’s Hall over the Hall of Fires’ bridge.' },
  ],
  incal: [
    // the first jetpack world: the jets wait on the makers' pillar, a lone stone column on the rim 130 m
    // round from the ship (src/levels/incal.js PILLAR): a 14 m climb, no jetpack needed (you need them for the shaft)
    // It held the jets until the makers' tower was built (src/temples/incal.js): the jets are its key now, and
    // the pillar keeps the soft-fall soles, a gift in the open
    // (v1.86, issue #518: the soles left the pillar's top for the makers' court beyond the rim, behind the gate its bridge
    // pen puzzle opens; the pillar's top keeps a fragment of the singing light. Its id the saves' flag)
    { id: 'incal.soles', item: 'soles', site: courtSite('incal'), beacon: 160, court: 'incal',
      hint: 'In the makers’ court beyond the rim',
      note: 'In the makers’ court beyond the rim, in the alcove behind its gate: draw a bridge with the pen from the near tower to the far one, and stand on its plate.' },
    // the Warden's Well (src/temples/incal.js): in the chamber half-way up, the gust fan (issue #377; the Warden's bellows
    // until then, the jets until v1.42). It is the key to the rest: the great vanes its gust turns, the draught, the
    // warden's crown hatch
    { id: 'incal.temple.jetpack', item: 'fan', temple: 'incal',   // (its id from when it held the jets: the saves' flag)
      site: templeSite('incal'),
      note: 'Inside the makers’ tower on the rim, in the round chamber over the climbing well.' },
    // (issue #169) the light that goes down: on the little square at the foot of the mirrors' chain on the bottom terrace,
    // 50 m round from the Upward Shrine, on a low rise with a smooth slope all round (issue #162: no steps). It sits shut
    // and cold in the shade until the mirrors throw the sun down onto it (src/shaft-mirrors.js, src/story/light-down.js:
    // the errand leads there, so no quest of its own: `story`)
    { id: 'incal.sunglass', item: 'sunglass', site: (level) => level.shaft?.mirrors?.end?.chest ?? null, story: true,
      ready: (g) => !!g.flag('incal.beam.lit'),
      sealed: 'The makers’ chest sits shut and cold in the shade. It wants the sun on it.',
      note: 'On the bottom terrace, on a low rise in the little square at the foot of the mirrors, a short walk round from the Upward Shrine. It opens once the mirrors throw the sun down onto it.' },
    // the Warden's Well's Ash Store (src/temples/incal.js, a find): its fight's prize, the bridge pen, shut till its keepers are
    // beaten (issue #375: "gadgets should never be in a chest out in the wild"; in the makers' court beyond the rim before,
    // whose bay of towers stays; its id the saves' flag). The Vane Room's chasm a room on wants it
    { id: 'incal.bridge', item: 'bridge', temple: 'incal', site: findSite('incal', 'pen'),
      ready: (g) => !!g.flag('temple.incal.lit.arW'),
      sealed: 'The makers’ chest sits shut among the ash. Its keepers still stand.',
      note: 'Inside the Warden’s Well on the City-Shaft’s rim, in the Ash Store west of the Climb: beat its keepers and the chest opens. The pen spans the shaft’s terraces too.' },
  ],
  arzach: [
    // the capped needle spire out on the plain, halfway from the landing to the lone tower (Senn listens at its foot,
    // a shed feather lies on its cap): a long climb or a landing on the bird. (v1.9, the level design audit: it was on a
    // spire 240 m north, a trip there and back with nothing else on it.)
    // It held the bell-note whistle until the Founders' Belfry was built (src/temples/arzach2.js): the bell belongs
    // to the bell world, and is the belfry's key now. The spire keeps the hush-cloth, a gift in the open
    // (issue #518: two pull-rings on posts beside it, tugged with the grappling hook, earned in Vael's Founders' Belfry)
    { id: 'arzach.hush', item: 'hush', at: [172.5, 86.2, -278], toward: [0, 0], lock: { tool: 'hook' },
      hint: 'Between two pull-rings on the needle spire',
      note: 'The flat cap of the needle spire on the plain halfway from the landing to the lone tower; climb it or land the bird on it, then tug both pull-rings with the hook.' },
    // the Aerie (src/temples/arzach.js): in its round chamber over the feather stair. The wings are the key to the
    // rest: the gulf, the wind well, the Elder, who will not fly alone
    { id: 'arzach.temple.glider', item: 'glider', temple: 'arzach', site: templeSite('arzach'),
      note: 'Inside the Aerie on the plain west of the landing, in the round chamber at the top of the feather stair.' },
    // the makers' court (src/finds/courts.js): the hook's bay round it (rings on its wall, towers to reel up to). Its box
    // held the grappling hook until issue #375 ("gadgets should never be in a chest out in the wild"): the hook is earned
    // in the Founders' Belfry now, and the box holds the bell-note whistle, the belfry's old charm (its id the saves' flag)
    // (v1.86, issue #518: behind the court's gate, not at its front edge; two pull-rings high on sheer posts open it)
    { id: 'arzach.hook', item: 'bell', site: courtSite('arzach'), beacon: 160, court: 'arzach',
      hint: 'In the pale court west of the landing',
      note: 'In the makers’ court on the rise west of the landing, in the alcove behind its gate: tug the two pull-rings high on its posts with the grappling hook, earned in the Founders’ Belfry.' },
  ],
  arzach2: [
    // the sky stones. It held the fluid wings until Vael's Aerie was built (src/temples/arzach.js): the wings are the
    // Aerie's key now, and the box keeps the wind-silk scarf. (Issue #476: on the top of Tiv's balanced stack on the great
    // table's west rim, src/levels/arzach2.js TIV_STACK, in v1.85; before, on the first sky stone's stack.)
    // (v1.86, issue #518: the scarf left the stack's top for the makers' court on the first sky stone, behind the gate its
    // wings puzzle opens. Its id the saves' flag)
    { id: 'arzach2.scarf', item: 'scarf', site: courtSite('arzach2'), beacon: 160, court: 'arzach2',
      hint: 'In the court on the first sky stone',
      note: 'In the makers’ court on the first sky stone, in the alcove behind its gate: climb its tower and glide with the wings to the plate on the sheer pillar.' },
    // the Founders' Belfry (src/temples/arzach2.js): in the bell chamber half-way up. The grappling hook is the key to the
    // rest (issue #377; the bell-note whistle was here): the bells' pull-rings, so the held doors, the stones that come down
    // into a bridge, the great key's cage and the Cloud-Mother's calm. (Its id from when it held the whistle: the saves' flag)
    { id: 'arzach2.temple.bell', item: 'hook', temple: 'arzach2', site: templeSite('arzach2'),
      note: 'Inside the Founders’ Belfry, out of the cloud west of the first sky stone, in the round chamber over the stone stair.' },
    // (the makers' court on the first sky stone kept the spring boots' bay and no box from issue #375; since v1.86, issue #518,
    // its bay is the wings', and the scarf waits behind its gate: src/finds/courts.js)
  ],
  glassdunes: [
    // (the Sealed Hangar's three, moved with the First Garage, now the Clock-House, when the Hangar was dismissed in
    // October 2026: src/levels/names.js DISMISSED; their ids stay, so a save that opened one keeps it opened)
    // the brass level, a gift in the open: on top of the glass mound west of the valley (a 14 m climb)
    // (v1.86, issue #518: the level left the glass mound's top for the makers' court north of the Clock-House, behind the
    // gate its boomerang puzzle opens; the mound's top keeps a fragment of the singing light. Its id the saves' flag)
    { id: 'garage.level', item: 'level', site: courtSite('glassdunes'), beacon: 160, court: 'glassdunes',
      hint: 'In the court north of the Clock-House',
      note: 'In the makers’ court on the sand north of the Clock-House, in the alcove behind its gate: wake its three eyes in one throw of the boomerang.' },
    // the Clock-House (src/temples/garage.js): in its round chamber over the winding well. The boomerang is the key to the
    // rest (issue #377; the quick coil was here): the banks of six eyes that wake only together, three of them struck in
    // one throw, in turn; the Foreman's six numerals. (Its id from when it held the coil: the saves' flag)
    { id: 'garage.temple.coil', item: 'boomerang', temple: 'garage', site: templeSite('garage'),
      note: 'Inside the Clock-House east of the valley, in the round chamber over the winding well.' },
    // (the makers' court on the sand north of the Clock-House kept the magnet glove's bay and no box from issue #375; since
    // v1.86, issue #518, its bay is the boomerang's, the Clock-House's gadget, and the level waits behind its gate)
  ],
  buried: [
    // the ring platform round the smoking chimney stack (jets or a climb up the stack). It held ember mode
    // until the Givers' House was built: the ember is the desert temple's key now, the resin a gift in the open
    // (issue #518: a cracked stone cap over it, broken with an ink bomb, earned in the Engine-House)
    { id: 'buried.resin', item: 'resin', at: [110, 33.8, 144.5], toward: [110, 160], lock: { tool: 'bomb' },
      hint: 'Under a cracked cap on the chimney stack’s ring',
      note: 'The lower ring platform of the chimney stack north-east of the spawn, on its +z side: break the cracked cap over the chest with an ink bomb.' },
    // the Engine-House (src/temples/buried.js): in the round chamber past the counterweight. Ink bombs are the key to the
    // rest (issue #377; the fourth chamber was here): the banks of four eyes that wake only together, three splashed and
    // the rest in a blast, the Tooth-Warden's four vents. (Its id from when it held the fourth chamber: the saves' flag)
    { id: 'buried.temple.cell', item: 'bomb', temple: 'buried', site: templeSite('buried'),
      note: 'Inside the Engine-House on the dunes west of the domes, in the round chamber past the counterweight.' },
    // the makers' court (src/finds/courts.js): the seeing lens's bay round it (a false plank, a true path of glass, writing
    // only the lens reads). Its box held the seeing lens until issue #375: it is earned in the Garden of Spheres' Footprint
    // now, and the box holds the glyph lens, the Footprint's old charm (its id the saves' flag)
    // (v1.86, issue #518: the court's bay swapped with the Garden of Spheres': the ink bombs' now, the Engine-House's gadget,
    // the box in the alcove behind its cracked wall)
    { id: 'buried.monocle', item: 'lens', site: courtSite('buried'), beacon: 160, court: 'buried',
      hint: 'Behind the cracked wall in the western court',
      note: 'In the makers’ court on the dunes west of the landing, in the alcove behind its cracked wall: blast it with an ink bomb, earned in the Engine-House.' },
  ],
  edena: [
    // the Builders' Greenhouse (src/temples/edena.js): on the Palm House's floor, its first hall (issue #477: the gadget
    // first; in the Seed Chamber before). Bloom mode (a new gun mode) is the key to the rest: the budded doors, the seed
    // trays, the vine bridge, the vine up the glass, the Gardener
    { id: 'edena.temple.bloom', item: 'bloom', temple: 'edena', site: templeSite('edena'),
      note: 'Inside the Builders’ Greenhouse in the meadow hollow north of the white ruins, on a mound in the middle of its first hall, the Palm House.' },
    // the makers' court (src/finds/courts.js): the bubble wand's bay round it (a crate to float up onto the ledge's plate).
    // Its box held the bubble wand until issue #375: it is earned in Lorn's Lamp-House now, and the box holds the lantern
    // charm, the Lamp-House's old gift, back in Viridel where it was first found (its id the saves' flag)
    // (v1.86, issue #518: in the bay's own alcove, behind the gate the ledge's plate opens)
    { id: 'edena.bubble', item: 'lantern', site: courtSite('edena'), beacon: 160, court: 'edena',
      hint: 'In the court in the south-west meadow',
      note: 'In the makers’ court in the meadow south-west of the landing, in the alcove behind its gate: float a crate up onto the ledge’s plate with the bubble wand, earned in Lorn’s Lamp-House.' },
  ],
  spheres: [
    // the grove's umbrella tree, on its flat canopy
    // It held the glyph lens until the Footprint was built (src/temples/spheres.js): the lens is its key now, and
    // the canopy keeps the listening shell, a gift in the open
    // (issue #518: the chest itself shows only through the seeing lens, earned in the Footprint)
    { id: 'spheres.shell', item: 'shell', at: [62, 24, -4], toward: [56, 2], lock: { tool: 'lens' },
      hint: 'On the grove’s umbrella tree, seen only through glass',
      note: 'On the canopy of the grove’s umbrella tree east of the spawn: the chest shows only through the seeing lens.' },
    // the Footprint (src/temples/spheres.js): in the round chamber half-way in. The seeing lens is the key to the rest (issue
    // #377; the glyph lens was here): the door that is wall until it looks, the stones and the eye only it shows, the Echo's
    // print. (Its id from when it held the glyph lens: the saves' flag)
    { id: 'spheres.temple.lens', item: 'monocle', temple: 'spheres', site: templeSite('spheres'),
      note: 'Inside the Footprint north of the grove, in the heel, in the round chamber past the still pool.' },
    // the makers' court (src/finds/courts.js): the bombs' bay round it (a cracked wall, a cracked boulder, crates to throw).
    // Its box held the ink bombs until issue #375: they are earned in the Engine-House now, and the box holds the fourth
    // chamber, the Engine-House's old upgrade (its id the saves' flag)
    // (v1.86, issue #518: the court's bay swapped with the Buried Machine's: the seeing lens's now, the Footprint's gadget;
    // the box on the far tower, reached only by the glass path the lens holds up)
    { id: 'spheres.bomb', item: 'cell', site: courtSite('spheres'), beacon: 160, court: 'spheres',
      hint: 'On the far tower of the south-west court',
      note: 'In the makers’ court in the grove south-west of the landing, on its far tower: cross to it on the glass path only the seeing lens holds up, earned in the Footprint.' },
  ],
  perdide: [
    // the swamp of lights: on top of Wendel's lookout, the stepped crystal on the mossy rise east of the landing
    // (src/lorn-ways.js; level design audit, fifth round: the swamp's one high place, 30 m up)
    // It held the stilling mode until the Hush-House was built (src/temples/perdide.js): the stilling mode is the
    // house's key now, and the lookout keeps the breathing reed, a gift in the open
    // (issue #518: a dark lamp on a sheer pole beside it, lit by floating up to it in a bubble: the bubble wand, earned in
    // the Deep Wood's Lamp-House)
    { id: 'perdide.reed', item: 'reed', at: [62, 37, -32], toward: [0, 0], lock: { tool: 'bubble' },
      hint: 'Under a dark lamp on the crystal lookout',
      note: 'On top of the crystal lookout, the stepped teal crystal on the mossy rise east of the landing: four short climbs and the last, then float up to the lamp on its pole in a bubble.' },
    // the Hush-House (src/temples/perdide.js): in its round chamber over the bog well. The stilling mode is the key
    // to the rest: the gates of jaws, the pendulums, the Mother Snapper
    { id: 'perdide.temple.stun', item: 'stun', temple: 'perdide', site: templeSite('perdide'),
      note: 'Inside the Hush-House on the cave island, in the round chamber over the bog well.' },
    // the makers' court (src/finds/courts.js): the gust fan's bay round it (pinwheels, a fire in a hut's door, a ledge to
    // hover up to). Its box held the fan until issue #375: it is earned in the City-Shaft's Warden's Well now, and the box
    // holds the Warden's bellows, the Well's old gift (its id the saves' flag)
    // (v1.86, issue #518: the court's bay re-keyed from the gust fan, earned four worlds later, to the stilling mode, Lorn's
    // own Hush-House gadget: jaws across the alcove's mouth a stilling glob holds open)
    { id: 'perdide.fan', item: 'wardenbellows', site: courtSite('perdide'), beacon: 160, court: 'perdide',
      hint: 'Behind the jaws in the court east of here',
      note: 'In the makers’ court on the dry ground east of the landing, in the alcove behind its jaws: still them with the stilling mode, earned in the Hush-House.' },
  ],
  perdide2: [
    // the top of the first root arch over the path
    // It held the fourth chamber until the Engine-House was built (src/temples/buried.js): the chamber is the
    // Buried Machine's temple key now, and the arch keeps the glow-moss pin, a gift in the open
    // (issue #518: stone jaws snap over it, held open with the stilling mode, earned in the Hush-House)
    { id: 'perdide2.moss', item: 'moss', at: [-18.8, 15.1, -89.5], toward: [0, 0], lock: { tool: 'stun' },
      hint: 'In stone jaws on the first root arch',
      note: 'On top of the first root arch over the path; climb its root, and still the jaws snapping over the chest.' },
    // the Lamp-House (src/temples/perdide2.js): in its dark round chamber over the root stair. The bubble wand is the key
    // to the rest (issue #377; the lantern charm was here): its bubbles carry a lamp's light to the lamps and orbs out of
    // reach, the moss-stones' hanging lamp, the Lampless. (Its id from when it held the lantern: the saves' flag)
    { id: 'perdide2.temple.lantern', item: 'bubble', temple: 'perdide2', site: templeSite('perdide2'),
      note: 'Inside the Lamp-House in the shallows east of the root cave, in the dark chamber over the root stair.' },
    // the makers' court (src/finds/courts.js): the boomerang's bay round it (targets, lanterns, crates on ropes, pots of ink
    // out of reach). Its box held the boomerang until issue #375: it is earned in the Glass Dunes' Clock-House now, and the
    // box holds the quick coil, the Clock-House's old upgrade (its id the saves' flag)
    // (v1.86, issue #518: the court's bay re-keyed from the boomerang, earned three worlds later, to the bubble wand, the
    // Deep Wood's own Lamp-House gadget: two lamps on sheer poles to float up to)
    { id: 'perdide2.boomerang', item: 'coil', site: courtSite('perdide2'), beacon: 160, court: 'perdide2',
      hint: 'In the court south-east of the island',
      note: 'In the makers’ court on the dry ground south-east of the Deep Wood’s island, in the alcove behind its gate: float up in a bubble to the plates on both sheer poles.' },
  ],
  bazaar: [
    // the market has no chest in the open. The Undertower (src/temples/bazaar.js), under the silent tower: in its
    // round chamber over the cable well. The recall hourglass is the key to the rest (issue #377; the echo shell was here,
    // folded into it): its sand keeps the last note sung near you and gives it back, so the doors and the pillars that
    // listen for a note played back, the First Sign that wants its own word. (Its id from when it held the shell: the saves' flag)
    { id: 'bazaar.temple.echo', item: 'recall', temple: 'bazaar', site: templeSite('bazaar'),
      note: 'Inside the Undertower, through the old doorway in the silent tower’s back, in the round chamber over the cable well.' },
    // the makers' court east of the start (v1.86, issue #518: a box at last): a crate on a high sheer ledge to knock down,
    // ride and send back up with the recall hourglass, earned in the Undertower; the plate up there opens the gate
    { id: 'bazaar.court', item: 'sandglass', site: courtSite('bazaar'), beacon: 160, court: 'bazaar',
      hint: 'In the makers’ court east of the start',
      note: 'In the makers’ court east of the start, in the alcove behind its gate: knock the crate off the high ledge, stand on it and send it back up with the recall hourglass, then step on the plate.' },
  ],
  // (v1.48, issue #101: the makers' courts of the three worlds of v1.40, src/finds/courts.js: no gadget's box, a charm for the
  // court's gadget behind the gate its puzzle opens)
  moonfoundry: [
    { id: 'moonfoundry.court', item: 'keeper', site: courtSite('moonfoundry'), beacon: 160, court: 'moonfoundry',
      hint: 'Behind the gate in the dock’s court',
      note: 'In the makers’ court in the landing dock west of the way in, in the alcove behind its gate: lift the iron crate out of its cage with the magnet glove and set it in the pit, on the plate only iron presses.' },
    // the pocket bellows, a gift in the open: on the crown of the moon in its cradle's claws (a climb up the claws and the shell)
    // (issue #518: an iron disc on a post beside it: the magnet glove, earned in the Casting-House, pulls you to it)
    { id: 'moonfoundry.bellows', item: 'bellows', at: [64, 46, -92], toward: [40, -60], lock: { tool: 'magnet' },
      hint: 'By an iron disc atop the cradled moon',
      note: 'The crown of the cradled moon (CRADLE), 42 m up: climb a claw of the cradle, then the shell, and let the magnet glove pull you to the iron disc.' },
    // the Casting-House (src/temples/moonfoundry.js): in the round chamber at the top of the hoist. The magnet glove is the
    // key to the rest (issue #377; the founders' tongs were here): the iron moons only its field draws along their rails, the
    // hot moons through the pilot flames, the Last Founder's cradle. (Its id from when it held the tongs: the saves' flag)
    { id: 'moonfoundry.temple.tongs', item: 'magnet', temple: 'moonfoundry', site: templeSite('moonfoundry'),
      note: 'Inside the Casting-House on the hangar’s east side, in the round chamber at the top of the hoist.' },
  ],
  spacecity: [
    { id: 'spacecity.court', item: 'splice', site: courtSite('spacecity'), beacon: 160, court: 'spacecity',
      hint: 'Behind the gate in the Yard’s court',
      note: 'In the makers’ court on the Yard, the island west of the Gate, in the alcove behind its gate: use the hook to lower the high crate, or push the ground crate along the low guides. Leave either crate on the marked plate; carrying it there works too. The gate stays open once the load settles.' },
    // the star-thread, a gift in the open: on the flat roof of a tall house on the Towers, just past the Towers bridge
    // (a 12 m climb from the deck)
    // (issue #518: a ring on a post beside it, pulled with the tether mode, earned in the Mooring-House)
    { id: 'spacecity.starthread', item: 'starthread', at: [87.5, 18.6, -70.5], toward: [98, -84], lock: { tool: 'tether' },
      hint: 'By a taut ring on a Towers roof',
      note: 'The flat roof of a tall house on the Towers, south-east of where the Towers bridge lands; climb its wall from the lane, and pull the ring with the tether.' },
    // the Mooring-House (src/temples/spacecity.js): in the Cord Loft past the great door. Tether mode is the key to the
    // rest: the moorers' rings, the balls out on their cables over the void, the Anchor-Warden's anchors
    { id: 'spacecity.temple.tether', item: 'tether', temple: 'spacecity', site: templeSite('spacecity'),
      note: 'Inside the Mooring-House on the Moorings north of the Towers, in the round loft past the great door.' },
  ],
  underwater: [
    { id: 'underwater.court', item: 'floatbead', site: courtSite('underwater'), beacon: 160, court: 'underwater',
      hint: 'Behind the gate in the divers’ court',
      note: 'In the makers’ court under its own dome west of the Plaza, in the alcove behind its gate: float a crate up over the pit’s wall with the bubble wand and pop it there.' },
    // the diver's pearl, a gift in the open: on the top deck of the tower of pods inside the Avenue's dome (a climb up
    // the pods from the street, three decks)
    // (issue #518: a plate in front of it a stomp of the spring boots, earned in the Whale-House, presses)
    { id: 'underwater.pearl', item: 'pearl', at: [-22.0, 15.7, -21.3], toward: [-24, -16], lock: { tool: 'springs' },
      hint: 'Behind a plate atop the great dome’s pod tower',
      note: 'The top deck of the tower of pods in the Avenue (level.decks), 16 m up: climb from deck to deck, and stomp the plate in front of the chest with the spring boots.' },
    // the Whale-House (src/temples/underwater.js): on the shell pulpit in the Horn Chamber. The spring boots are the key to the
    // rest (issue #377; the whale-horn was here): a stomp's boom is the deep note the house's ears hear, the held door, the
    // ear behind the tank's glass, the ear over the Listener's Door, the Listener itself. (Its id: the saves' flag)
    { id: 'underwater.temple.horn', item: 'springs', temple: 'underwater', site: templeSite('underwater'),
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
  // (those three are the desert's main quest's: its ship doesn't fly until they are had, so a run never sees them;
  // they are for a save brought in some other way, the worlds menu)
  // (the Givers' blade and guard, v1.44, have no fallback since v1.45, issue #91: "chests should always feel earned;
  // seeing two chests after just landing on Vael makes no sense". The Givers' House is off the desert's main quest, so a
  // traveller who skipped it landed in Vael beside two free chests. They wait in the house, the desert always on the map;
  // nothing after the desert asks for them (no foe comes while he is unarmed, src/foes.js armed(); the blade's switches
  // are the house's own))
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
