// Saves from before the temples: the gadgets that moved into a temple's
// chest (src/boxes/placements.js, the entries with `temple`) were found in
// the open before. Whoever already carries one finds its temple chest open
// (counted as found in the sketchbook), and the temple's doors that want the
// gadget answer it at once (logic.js: `gadget` is also "you have it").
// Idempotent: it runs at every load (src/boxes/index.js migrateSave), so a
// gadget got another way later (a fallback box by the ship) counts too.

/** [box id, item] of every temple chest. */
export const TEMPLE_BOXES = [
  ['desert.temple.sword', 'sword'],
  ['desert.temple.shield', 'shield'],
  ['incal.temple.jetpack', 'fan'],   // (the Warden's bellows until issue #377, the jets before: the box's id kept)
  ['incal.bridge', 'bridge'],   // (issue #375: the Ash Store's prize, the makers' court's box before)
  ['arzach2.temple.bell', 'hook'],   // (the bell-note whistle until issue #377: the box's id kept)
  ['spheres.temple.lens', 'monocle'],   // (the glyph lens until issue #377: the box's id kept)
  ['buried.temple.cell', 'bomb'],   // (the fourth chamber until issue #377: the box's id kept)
  ['perdide2.temple.lantern', 'bubble'],   // (the lantern charm until issue #377: the box's id kept)
  ['perdide.temple.stun', 'stun'],
  ['arzach.temple.glider', 'glider'],
  ['garage.temple.coil', 'boomerang'],   // (the quick coil until issue #377: the box's id kept)
  ['edena.temple.bloom', 'bloom'],
  ['bazaar.temple.echo', 'recall'],   // (the echo shell until issue #377: the box's id kept)
  ['spacecity.temple.tether', 'tether'],
  ['moonfoundry.temple.tongs', 'magnet'],   // (the founders' tongs until issue #377: the box's id kept)
  ['underwater.temple.horn', 'springs'],   // (the whale-horn until issue #377: the box's id kept)
];

export function migrateTemples(g) {
  let n = 0;
  for (const [box, item] of TEMPLE_BOXES) {
    if (g.flag(`item.${item}`) && !g.flag(`box.${box}`)) { g.set(`box.${box}`, true); n++; }
  }
  n += migrateTempleLayouts(g);
  return n;
}

/**
 * A temple reworked (issue #23: round a hub, with keys, locks and arenas) whose old saves stand somewhere in it: each
 * step's flags (under temple.<id>.*) set once, if the save has any of its `if` flags (it was past that point in the old
 * house), so nobody finds a new lock shut behind them or the wings they never saw between them and where they were.
 * temple.<id>.layout keeps the version a save has been brought to (it runs at every load, once a version).
 */
export const LAYOUTS = {
  // v1.48: the Clock-House round its Winding Well. Past the door over the climb (or with the coil): its two small keys
  // in it, the Pendulum Hall won and its way out open; the Foreman set right: the great lock open too
  // v1.77 (issue #336): the house remade to the redesign's rules, its rooms bigger and moved, the Winding Passage a room
  // of its own behind the chamber's north door (dP: the coil in hand), the counterweight's socket on the landing (the same
  // pieces, the same state). A save that entered the house: taken to its last mark if it stood inside the old rooms
  // (runtime.js relaid)
  garage: {
    v: 3,
    steps: [
      { if: ['open.d2', 'gadget', 'lit.k1', 'open.d3', 'lit.k2', 'open.br1', 'boss'], set: { 'unlocked.d2': 2, 'found.kW': true, 'found.kE': true, 'lit.arW': true, 'open.dWo': true, 'lit.sS': true } },
      { if: ['lit.k2', 'open.br1', 'boss'], set: { 'unlocked.d4': 1, 'found.kB': true, 'lit.k3': true } },
      { if: ['entered'], set: { relaid: true } },
    ],
  },
  // v1.48: the Builders' Greenhouse round its Potting Hall. Past the Glass Stair's door: its two small keys in it, the
  // Shade House won, the Cold Frame's eyes awake. v1.49: the Seed Vault off the Vine Gulf's far side; past the bud at the
  // top of the glass: the great key in the door beyond it, the vault's seeds grown
  // v1.60: the Seed Vault moved north off the Shade House (its door opens with the arena won), its keepers' door onto the
  // Glass Stair's root-wall opening with its vine. With its great key already found, or past the bud: the vine up
  // v1.77 (issue #336): the house remade to the redesign's rules, its rooms bigger and moved, the Bud Passage a room of its
  // own (the same pieces, the same state). A save that entered the house: taken to its last mark if it stood inside the
  // old rooms (runtime.js RELAID)
  // v1.83 (issue #411): the Potting Hall and the Glass Stair one great hall, the Palm House, its gallery 18 m up; the old
  // Glass Stair's door (d1) the Seed Chamber's door now (both keys, and the eye on the bridge, s2), the Cold Frame behind the
  // eye's door (dE), the builders' water the house's state. Past the eye: the Cold Frame's door open. Past the old stair's
  // door, or anything after it: the new door's eye woken. The Seed Vault's seeds grown (or anything past them): its weight on
  // its plate. A save that entered the house: taken to its last mark in the new rooms
  edena: {
    v: 6,
    steps: [
      { if: ['open.d1', 'lit.s2', 'open.d2', 'gadget', 'lit.bud1', 'open.d3', 'lit.seed1', 'boss'], set: { 'unlocked.d1': 2, 'found.kW': true, 'found.kE': true, 'lit.arW': true, 'lit.sC1': true, 'lit.sC2': true } },
      { if: ['open.d4', 'boss'], set: { 'unlocked.dB': 1, 'found.kB': true, 'lit.sdA': true, 'lit.sdB': true } },
      { if: ['found.kB', 'open.d4', 'boss'], set: { 'lit.sdA': true, 'lit.sdB': true, 'open.vineV': true, 'lit.arW': true } },
      { if: ['lit.s1', 'open.d1', 'lit.sC1', 'lit.sC2', 'found.kE', 'gadget', 'boss'], set: { 'open.dE': true } },
      { if: ['open.d1', 'open.d2', 'gadget', 'lit.bud1', 'open.d3', 'lit.seed1', 'boss'], set: { 'lit.s2': true } },
      { if: ['lit.sdA', 'open.vineV', 'found.kB', 'boss'], set: { 'weight.wV': 'pVw' } },
      { if: ['entered'], set: { relaid: true } },
    ],
  },
  // v1.48: the Warden's Well round its Climb. Past the door at the balcony's end (or with the bellows): its two small keys
  // in it, the Ash Store won, the Vane Room's key taken
  // v1.74 (issue #23's last round): the high door takes the great key too, from the Flue's ledge. Past it: the key in it
  // v1.77 (issue #336): the house remade to the redesign's rules, its rooms bigger and moved (the same pieces, the same
  // state). A save that entered the house: taken to its last mark if it stood inside the old rooms (runtime.js RELAID)
  incal: {
    v: 4,
    steps: [
      { if: ['open.d1', 'gadget', 'lit.s2', 'open.iris', 'open.iris2', 'lit.s4', 'open.d3', 'boss'], set: { 'unlocked.d1': 2, 'found.kW': true, 'found.kE': true, 'lit.arW': true } },
      { if: ['open.d3', 'boss'], set: { 'unlocked.d3': 1, 'found.kG': true } },
      { if: ['entered'], set: { relaid: true } },
    ],
  },
  // v1.48: the Undertower round its Cable Well. Up the second disc (or with the shell): the Shell Chamber's door has its
  // two small keys, the Cable Store won, the Tuning Room's horn answered
  // v1.49: the Choir off the Gallery of Voices' far side. Past its far door: the great key in it, the Choir's horns
  // answered (the passage's horn's new footstone stands behind a door already open)
  // v1.60: the Choir moved over the Cable Store, behind a keepers' gate off the walk round the Cable Well (its horn on the
  // first hall's far landing) and a door onto the Shell Chamber. With its great key already found, or past the far door:
  // the gate's horn answered, so both stand open and the Choir is done
  // v1.77 (issue #336): the house remade to the redesign's rules, bigger rooms (the Listening Passage a room of its own, the
  // Tuning Room's ball in that room; the same state). A save that entered the house: taken to its last mark if it stood
  // inside the old rooms (runtime.js relaid)
  bazaar: {
    v: 5,
    steps: [
      { if: ['lit.eW', 'open.wdisc', 'gadget', 'lit.e0', 'open.d3', 'open.d4', 'boss'], set: { 'unlocked.dK': 2, 'found.kW': true, 'found.kE': true, 'lit.arW': true, 'lit.eT': true, 'drum.ballT': 1 } },
      { if: ['open.d4', 'boss'], set: { 'unlocked.d4': 1, 'found.kB': true, 'lit.hA': true, 'lit.hB': true, 'drum.ballQ': 1 } },
      { if: ['found.kB', 'open.d4', 'boss'], set: { 'lit.hG': true, 'lit.hA': true, 'lit.hB': true, 'drum.ballQ': 1 } },
      { if: ['entered'], set: { relaid: true } },
    ],
  },
  // v1.48: the Engine-House round its Fourth Chamber, past the chest. Past the Crank Passage's door: its small key in it,
  // the Boiler Room won and its flue open, the chamber's shutters up; past the Furnace's bridge: the great key in the
  // warden's door too (before it, the Governor Room is a walk back)
  // v1.77 (issue #336): the house remade to the redesign's rules, its rooms bigger and moved, the Crank Hall's ball on its
  // near landing (it lay on the Piston Hall's gantry), the Crank Passage a room of its own (the same pieces, the same
  // state). A save that entered the house: taken to its last mark if it stood inside the old rooms (runtime.js relaid)
  buried: {
    v: 3,
    steps: [
      { if: ['open.d3', 'lit.k2', 'open.br1', 'boss'], set: { 'unlocked.d3': 1, 'found.kS': true, 'lit.arB': true, 'open.dBo': true, 'lit.k0': true, 'open.dS': true } },
      { if: ['open.br1', 'boss'], set: { 'unlocked.d4': 1, 'found.kB': true, 'lit.k3': true } },
      { if: ['entered'], set: { relaid: true } },
    ],
  },
  // v1.49: the Aerie's stack, the Moult off the Wind Well's floor and the Eyrie off its high balcony. Past the balcony's
  // way north (its gulf vent's stone moved, or further): the small key in it and the Moult won; past the perch: the great
  // key in the Roost's door too (before it, the Eyrie is a flight back)
  // v1.74 (issue #23, round 6): the well's column reaches the high balcony only with the floor's second vent stopped. Up
  // there already (or anything done up there or after): its stone in its throat
  // v1.77 (issue #336): the house remade to the redesign's rules, its rooms bigger and moved, the gulf vent's stone in the
  // Vent Hall north of the balcony (the same pieces, the same state). A save that entered the house: taken to its last
  // mark if it stood inside the old rooms (runtime.js relaid)
  // v1.83 (issue #407): the well 62 m across with a gallery round it, the Fledgery off the gallery whose stone, dropped
  // through its floor, opens the Wing Chamber's shutter (dW). With the wings, or anything after them: that stone dropped.
  // A save that entered the house: taken to its last mark again (the rooms moved)
  arzach: {
    v: 5,
    steps: [
      { if: ['gadget', 'checkpoint=wings', 'checkpoint=top', 'checkpoint=eyrie', 'checkpoint=moult', 'checkpoint=gulf', 'checkpoint=perch', 'checkpoint=gulfFar', 'checkpoint=roost', 'drum.bF', 'drum.bE', 'drum.ballB', 'drum.ballP', 'drum.ballR', 'lit.arM', 'found.kM', 'found.kE', 'found.cache', 'unlocked.dG', 'boss', 'done'], set: { 'drum.bD': 1 } },
      { if: ['drum.ballB', 'drum.ballP', 'drum.ballR', 'boss'], set: { 'unlocked.dG': 1, 'found.kM': true, 'lit.arM': true } },
      { if: ['drum.ballP', 'drum.ballR', 'boss'], set: { 'unlocked.d3': 1, 'found.kE': true, 'drum.bE': 1 } },
      { if: ['checkpoint=top', 'checkpoint=eyrie', 'checkpoint=moult', 'checkpoint=gulf', 'checkpoint=perch', 'checkpoint=gulfFar', 'checkpoint=roost', 'drum.bE', 'drum.ballB', 'drum.ballP', 'drum.ballR', 'lit.arM', 'found.kM', 'found.kE', 'found.cache', 'unlocked.dG', 'boss', 'done'], set: { 'drum.bF': 1 } },
      { if: ['entered'], set: { relaid: true } },
    ],
  },
  // v1.49: the Lamp-House's Kennel off the Hall of Dark Pools and its Wick Room off the Dark Gallery's far side. Past the
  // Lamp Passage's door: its small key in it, the Kennel won; past the gallery's far door: the great key in it too
  // (before it, the Wick Room is a few steps off the far side)
  // v1.60: the Wick Room moved off the Hall of Dark Pools, its grille a lock for the Kennel's small key (the Lamp Passage's
  // door is its lamp alone again, so a key put there is back in hand); its keepers' door onto the Root Stair opens with the
  // grille. With the great key already found, or past the far door: the Kennel's key in the grille
  // v1.77 (issue #336): the house remade to the redesign's rules, bigger rooms (the Lamp Passage's lamp in the Lantern Chamber, the
  // Root Stair's orb and its small pool in that room; the same state). A save that entered the house: taken to its last
  // mark if it stood inside the old rooms (runtime.js relaid)
  // v1.83 (issue #410): the house round its Lamp Hall and the great lamp, lit or dark, its state. Past the Lamp Passage's door
  // (it opened to a lamp by the fount before): the ledge's door open, the great lamp kindled and lit (the Kennel's lamp-door
  // and the Lamp Passage's open with it); past the far door, its lamp lit too (its pool-orb's niche before). A save that
  // entered the house: taken to its last mark in the new rooms (runtime.js relaid)
  perdide2: {
    v: 5,
    steps: [
      { if: ['open.d2', 'lit.s4', 'drum.orb', 'lit.l2', 'open.d4', 'boss'], set: { 'unlocked.d2': 1, 'found.kS': true, 'lit.arK': true } },
      { if: ['open.d4', 'boss'], set: { 'unlocked.d4': 1, 'found.kB': true, 'open.cW': true } },
      { if: ['found.kB', 'open.cW', 'open.d4', 'boss'], set: { 'unlocked.cW': 1, 'found.kS': true, 'lit.arK': true, 'open.cW': true } },
      { if: ['open.d2', 'open.br1', 'lit.l2', 'open.d4', 'boss', 'checkpoint=gallery'], set: { 'lit.l0': true, 'open.dC': true, 'lit.s8': true, 'lit.lG': true, 'drum.lamp': 1, 'open.dK': true } },
      { if: ['open.d4', 'boss'], set: { 'lit.l2': true } },
      { if: ['entered'], set: { relaid: true } },
    ],
  },
  // v1.52: the Hush-House's Snapping Passage stills in the Choir's order (its two side mouths before the gate), the Nursery
  // west off the gallery's far landing and the Choir's balcony along the ledge round the Bog Well. Past the gate of jaws
  // (its stilling was `j1`): the side mouths stilled too; past the far door: its great key in it, the Nursery won, the
  // ledge's door unlocked, the balcony's ball on its footstone (before it, the wings are a walk back)
  // v1.77 (issue #336): the house remade to the redesign's rules, bigger rooms (the Snapping Passage a room of its own, its
  // side mouths in shrines on its floor; the ledge's door by the Bog Well's west wall and a walk to the balcony down the
  // Choir's west side; the same state). A save that entered the house: taken to its last mark if it stood inside the old
  // rooms (runtime.js relaid)
  // v1.83 (issue #409): no fight at all. The Choir the great hall (every room north of it 12 m on), the Mother's hall off
  // its east wall through the great door (dG: the great key and the Choir's three crystals hushed, h2..h4), the small key's
  // cage on the far landing sung open by the pendulums (the Nursery and the keeper's gate gone), the Threshold's door (d0)
  // opened by its crystal. With the Nursery won or its key: the pendulums sung; past the old far door: the great door
  // open; a save that entered: the Threshold's door open, and taken to its last mark (the rooms moved)
  perdide: {
    v: 4,
    steps: [
      { if: ['open.d2', 'lit.j1', 'lit.w1', 'open.d3', 'open.ds', 'boss'], set: { 'lit.j2': true, 'lit.j3': true } },
      { if: ['open.d3', 'boss'], set: { 'unlocked.d3': 1, 'found.kB': true, 'found.kS': true, 'unlocked.dL': 1, 'lit.arN': true, 'drum.oB': 1 } },
      { if: ['lit.arN', 'found.kS', 'unlocked.dL', 'open.ds', 'unlocked.d3', 'open.d3', 'boss', 'done'], set: { 'lit.w1': true, 'lit.w2': true, 'lit.w3': true, 'found.kS': true } },
      { if: ['unlocked.d3', 'open.d3', 'checkpoint=ante', 'boss', 'done'], set: { 'unlocked.dG': 1, 'lit.h2': true, 'lit.h3': true, 'lit.h4': true, 'lit.c1': true, 'lit.c2': true, 'lit.c3': true, 'lit.c4': true } },
      { if: ['entered'], set: { 'lit.c1': true, relaid: true } },
    ],
  },
  // v1.53: the Mooring-House's Rope Store off the Moorers' Gallery (its small key now opens the moorers' gate) and the
  // great key on the Capstan Hall's balcony for the Capstan Floor's door. With the Gallery's ring pulled (the gate was
  // open): its small key in the gate, the store won; past the west door: the great key in the floor's door too
  // v1.77 (issue #336): the house remade to the redesign's rules, its rooms bigger and moved (the same pieces, the same
  // state; the Mooring Passage's ring now over the loft's floor). A save that entered the house: taken to its last mark if
  // it stood inside the old rooms (runtime.js relaid)
  spacecity: {
    v: 3,
    steps: [
      { if: ['lit.r5', 'open.sc', 'open.gN', 'boss'], set: { 'unlocked.sc': 1, 'found.kS': true, 'lit.arR': true } },
      { if: ['open.gN', 'boss'], set: { 'unlocked.d6': 1, 'found.kB': true, 'drum.bK': 0.167 } },   // (spacecity.js PERCH.plateAt: tests/temples.test.js checks)
      { if: ['entered'], set: { relaid: true } },
    ],
  },
  // v1.53: an arena in three houses that had none, each its small key for a later door (with its own condition). Past
  // that door: its key in it, the arena won. The Whale-House's Horn Store (off the Sounding Hall's south wall) and the
  // Song Passage's door (past the chest: past the tank, its key in it); the Casting-House's Sand Room (south off the Mould Room) and the Founders' Door; the Footprint's
  // Keepers' Lodge (west off the Keepers' Gallery) and the Hall of the Unseen's far door
  // v1.77 (issue #336): the house remade to the redesign's rules, its rooms bigger and moved, the Pool Room's ball in a
  // cradle of its own (the same pieces, the same state). A save that entered the house: taken to its last mark if it
  // stood inside the old rooms (runtime.js relaid)
  underwater: {
    v: 3,
    steps: [
      { if: ['lit.e5', 'open.dK', 'open.dL', 'boss'], set: { 'unlocked.d4': 1, 'found.kS': true, 'lit.arH': true } },
      { if: ['entered'], set: { relaid: true } },
    ],
  },
  // v1.77 (issue #336): the Casting-House remade to the redesign's rules, its rooms bigger and moved, the upper floor 11 m
  // up, the Pouring Floor's stone moon in the Mould Room, the Pincer Passage folded into the Tong Chamber, the hot moon's
  // rail on the furnace's near lip (the same pieces, the same state). A save that entered the house: taken to its last
  // mark if it stood inside the old rooms (runtime.js relaid)
  moonfoundry: {
    v: 3,
    steps: [
      { if: ['open.dF', 'boss'], set: { 'unlocked.dF': 1, 'found.kS': true, 'lit.arS': true } },
      { if: ['entered'], set: { relaid: true } },
    ],
  },
  // v1.77 (issue #336): the Footprint remade to the redesign's rules, its rooms bigger and moved, the far landing's eye on
  // a pillar out of the chasm (the same pieces, the same state). A save that entered the house: taken to its last mark if
  // it stood inside the old rooms (runtime.js relaid)
  // v1.82 (issue #401): the house across four floors round the Heel Well: the Hall of Spheres' door is the iris over the
  // first drop (d1), the Still Pool's berth opens the Lens Chamber too (dL), the Hall of the Unseen opens to a sphere
  // dropped through the Sounding Toe's floor (dT), the Lodge's door to an eye seen from the spiral and the great sphere up
  // (dR), the far door wants the great sphere down too and opens on the great key, for the great door (dG) on the heel's
  // floor. Past the old far door (or the guardian): all of that as done, the great sphere down. And a save that entered
  // the house: taken to its last mark
  spheres: {
    v: 4,
    steps: [
      { if: ['open.d4', 'boss'], set: { 'unlocked.d4': 1, 'found.kS': true, 'lit.arL': true } },
      { if: ['open.d4', 'boss'], set: { 'drum.ballT': 1, 'open.dT': true, 'open.dL': true, 'lit.sL': true, 'seen.spiral': true, 'open.dR': true, 'drum.lift': 1, 'open.d4': true, 'found.kG': true, 'unlocked.dG': 1 } },
      { if: ['entered'], set: { relaid: true } },
    ],
  },
  // v1.65: the Rose House's bellows' wind gone (issue #245); the Givers' watcher by the far landing's east doorway, its
  // door shut till it is broken. Past it in the old house (in the Hall of Channels, or anything done there or after):
  // the watcher broken, its door open
  // v1.76 (issue #337): the Dry Channel's plate holds the chamber's door only while weighed down, the Givers' weight on it
  // (it latched open for good when stood on). Past it (its door opened once, or anything after): the weight on the plate
  // v1.77 (issue #336): the house remade to the redesign's rules, bigger rooms; the Sword Chamber's fight moved to a hall of
  // its own past its north door (the Machines' Hall, an arena), the Hall of Fires' ball in that hall now. Past the old
  // chamber's fight (won, or anything after it): the hall won, its way on open. A save that entered the house: taken to its
  // last mark if it stood inside the old rooms (desert.js RELAID)
  // v1.83 (issue #406): the house round its Great Hall, the hub: the blade on the hall's balcony, the small key caged on
  // its floor under the balcony's hole (a ball cut into the hole drops onto its plate), the key's door into the east wing
  // (the Machines' Hall, the Hall of Fires, the Guard's Hall, the Hall of Channels), the watcher before the cistern's door,
  // which wants it broken and the Hall of Channels' bowl lit. Past the old Machines' Hall (won, or anything after it): the
  // ball dropped, the key taken and turned in its door. A save that entered the house: taken to its last mark
  desert: {
    v: 5,
    steps: [
      { if: ['lit.arM', 'open.dm', 'encounter=done', 'lit.bw0', 'drum.ball3', 'lit.b3', 'open.br1', 'found.guard', 'lit.sentry', 'checkpoint=fires', 'checkpoint=wing', 'checkpoint=ante', 'checkpoint=cistern', 'lit.e10', 'open.sc', 'drum.ball4', 'lit.b4', 'open.d3', 'boss', 'done'], set: { 'drum.ballK': 1, 'found.kS': true, 'unlocked.dE': 1 } },
      { if: ['checkpoint=wing', 'checkpoint=ante', 'checkpoint=cistern', 'lit.e10', 'open.sc', 'drum.ball4', 'lit.b4', 'open.d3', 'boss', 'done'], set: { 'lit.sentry': true, 'open.dw': true } },
      { if: ['open.dc', 'gadget', 'checkpoint=chest', 'checkpoint=fires', 'checkpoint=wing', 'checkpoint=ante', 'checkpoint=cistern', 'boss', 'done'], set: { 'weight.wP': 'pp' } },
      { if: ['encounter=done', 'lit.bw0', 'drum.ball3', 'lit.b3', 'open.br1', 'found.guard', 'lit.sentry', 'checkpoint=fires', 'checkpoint=wing', 'checkpoint=ante', 'checkpoint=cistern', 'lit.e10', 'boss', 'done'], set: { 'lit.arM': true, 'open.dm': true } },
      { if: ['entered'], set: { relaid: true } },
    ],
  },
  // v1.49: the Founders' Belfry's west store an arena. Past the Hall of Stones' door: its small key in it, the store won
  // v1.74 (issue #23's last round): the far door takes the great key, from the Ringers' Walk's ledge high in the Stone Stair.
  // Past the far door: the great key in it
  // v1.77 (issue #336): the house remade to the redesign's rules, bigger rooms (the porch a room of its own, the
  // antechamber too). A save that entered the house: taken to its last mark if it stood inside the old rooms (arzach2.js RELAID)
  // v1.83 (issue #408): the house round the Great Belfry (its hall where the Stone Stair was), the founders' bell the house's
  // state; the porch's door a founders' stone sunk for good the first time the bell rings (its held bell before), the far
  // door's own bell gone. Past the porch (anything done past it): its slab sunk. A save that entered the house: taken to its
  // last mark in the new rooms (arzach2.js RELAID)
  arzach2: {
    v: 5,
    steps: [
      { if: ['open.d1', 'drum.ballS', 'lit.s1', 'open.d2', 'gadget', 'open.br1', 'boss'], set: { 'unlocked.d1': 1, 'found.kW': true, 'lit.arW': true } },
      { if: ['open.d4', 'boss'], set: { 'unlocked.d4': 1, 'found.kB': true } },
      { if: ['drum.ball3', 'open.br1', 'found.kB', 'open.d4', 'boss', 'checkpoint=echoes', 'checkpoint=ringers', 'checkpoint=ante'], set: { 'open.d3': true } },
      { if: ['entered'], set: { relaid: true } },
    ],
  },
};
export function migrateTempleLayouts(g) {
  let n = 0;
  for (const [id, L] of Object.entries(LAYOUTS)) {
    const k = `temple.${id}.layout`;
    if ((g.flag(k) ?? 1) >= L.v) continue;
    for (const st of L.steps) {
      // ('checkpoint=wing': the flag holds that value)
      const has = (f) => { const [k, v] = f.split('='); const x = g.flag(`temple.${id}.${k}`); return v === undefined ? !!x : x === v; };
      if (!st.if.some(has)) continue;
      // (`relaid` is spent, null, once the traveller has been taken to his mark: a later version of the house sets it again)
      for (const [f, v] of Object.entries(st.set)) { const was = g.flag(`temple.${id}.${f}`); if (was === undefined || (f === 'relaid' && was === null)) { g.set(`temple.${id}.${f}`, v); n++; } }
      // (a flag cleared to null counts as unset: `relaid`, used up once, is set again when the house is remade again, #408)
      for (const [f, v] of Object.entries(st.set)) if (g.flag(`temple.${id}.${f}`) == null) { g.set(`temple.${id}.${f}`, v); n++; }
    }
    g.set(k, L.v);
  }
  return n;
}
