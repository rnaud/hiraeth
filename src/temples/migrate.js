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
  ['incal.temple.jetpack', 'wardenbellows'],
  ['arzach2.temple.bell', 'bell'],
  ['spheres.temple.lens', 'lens'],
  ['buried.temple.cell', 'cell'],
  ['perdide2.temple.lantern', 'lantern'],
  ['perdide.temple.stun', 'stun'],
  ['arzach.temple.glider', 'glider'],
  ['garage.temple.coil', 'coil'],
  ['edena.temple.bloom', 'bloom'],
  ['bazaar.temple.echo', 'echo'],
  ['spacecity.temple.tether', 'tether'],
  ['moonfoundry.temple.tongs', 'tongs'],
  ['underwater.temple.horn', 'horn'],
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
  garage: {
    v: 2,
    steps: [
      { if: ['open.d2', 'gadget', 'lit.k1', 'open.d3', 'lit.k2', 'open.br1', 'boss'], set: { 'unlocked.d2': 2, 'found.kW': true, 'found.kE': true, 'lit.arW': true, 'open.dWo': true, 'lit.sS': true } },
      { if: ['lit.k2', 'open.br1', 'boss'], set: { 'unlocked.d4': 1, 'found.kB': true, 'lit.k3': true } },
    ],
  },
  // v1.48: the Builders' Greenhouse round its Potting Hall. Past the Glass Stair's door: its two small keys in it, the
  // Shade House won, the Cold Frame's eyes awake. v1.49: the Seed Vault off the Vine Gulf's far side; past the bud at the
  // top of the glass: the great key in the door beyond it, the vault's seeds grown
  edena: {
    v: 3,
    steps: [
      { if: ['open.d1', 'lit.s2', 'open.d2', 'gadget', 'lit.bud1', 'open.d3', 'lit.seed1', 'boss'], set: { 'unlocked.d1': 2, 'found.kW': true, 'found.kE': true, 'lit.arW': true, 'lit.sC1': true, 'lit.sC2': true } },
      { if: ['open.d4', 'boss'], set: { 'unlocked.dB': 1, 'found.kB': true, 'lit.sdA': true, 'lit.sdB': true } },
    ],
  },
  // v1.48: the Warden's Well round its Climb. Past the door at the balcony's end (or with the bellows): its two small keys
  // in it, the Ash Store won, the Vane Room's key taken
  incal: {
    v: 2,
    steps: [
      { if: ['open.d1', 'gadget', 'lit.s2', 'open.iris', 'open.iris2', 'lit.s4', 'open.d3', 'boss'], set: { 'unlocked.d1': 2, 'found.kW': true, 'found.kE': true, 'lit.arW': true } },
    ],
  },
  // v1.48: the Undertower round its Cable Well. Up the second disc (or with the shell): the Shell Chamber's door has its
  // two small keys, the Cable Store won, the Tuning Room's horn answered
  // v1.49: the Choir off the Gallery of Voices' far side. Past its far door: the great key in it, the Choir's horns
  // answered (the passage's horn's new footstone stands behind a door already open)
  bazaar: {
    v: 3,
    steps: [
      { if: ['lit.eW', 'open.wdisc', 'gadget', 'lit.e0', 'open.d3', 'open.d4', 'boss'], set: { 'unlocked.dK': 2, 'found.kW': true, 'found.kE': true, 'lit.arW': true, 'lit.eT': true, 'drum.ballT': 1 } },
      { if: ['open.d4', 'boss'], set: { 'unlocked.d4': 1, 'found.kB': true, 'lit.hA': true, 'lit.hB': true, 'drum.ballQ': 1 } },
    ],
  },
  // v1.48: the Engine-House round its Fourth Chamber, past the chest. Past the Crank Passage's door: its small key in it,
  // the Boiler Room won and its flue open, the chamber's shutters up; past the Furnace's bridge: the great key in the
  // warden's door too (before it, the Governor Room is a walk back)
  buried: {
    v: 2,
    steps: [
      { if: ['open.d3', 'lit.k2', 'open.br1', 'boss'], set: { 'unlocked.d3': 1, 'found.kS': true, 'lit.arB': true, 'open.dBo': true, 'lit.k0': true, 'open.dS': true } },
      { if: ['open.br1', 'boss'], set: { 'unlocked.d4': 1, 'found.kB': true, 'lit.k3': true } },
    ],
  },
  // v1.49: the Aerie's stack, the Moult off the Wind Well's floor and the Eyrie off its high balcony. Past the balcony's
  // way north (its gulf vent's stone moved, or further): the small key in it and the Moult won; past the perch: the great
  // key in the Roost's door too (before it, the Eyrie is a flight back)
  arzach: {
    v: 2,
    steps: [
      { if: ['drum.ballB', 'drum.ballP', 'drum.ballR', 'boss'], set: { 'unlocked.dG': 1, 'found.kM': true, 'lit.arM': true } },
      { if: ['drum.ballP', 'drum.ballR', 'boss'], set: { 'unlocked.d3': 1, 'found.kE': true, 'drum.bE': 1 } },
    ],
  },
  // v1.49: the Lamp-House's Kennel off the Hall of Dark Pools and its Wick Room off the Dark Gallery's far side. Past the
  // Lamp Passage's door: its small key in it, the Kennel won; past the gallery's far door: the great key in it too
  // (before it, the Wick Room is a few steps off the far side)
  perdide2: {
    v: 2,
    steps: [
      { if: ['open.d2', 'lit.s4', 'drum.orb', 'lit.l2', 'open.d4', 'boss'], set: { 'unlocked.d2': 1, 'found.kS': true, 'lit.arK': true } },
      { if: ['open.d4', 'boss'], set: { 'unlocked.d4': 1, 'found.kB': true, 'open.cW': true } },
    ],
  },
  // v1.52: the Hush-House's Snapping Passage stills in the Choir's order (its two side mouths before the gate), the Nursery
  // west off the gallery's far landing and the Choir's balcony along the ledge round the Bog Well. Past the gate of jaws
  // (its stilling was `j1`): the side mouths stilled too; past the far door: its great key in it, the Nursery won, the
  // ledge's door unlocked, the balcony's ball on its footstone (before it, the wings are a walk back)
  perdide: {
    v: 2,
    steps: [
      { if: ['open.d2', 'lit.j1', 'lit.w1', 'open.d3', 'open.ds', 'boss'], set: { 'lit.j2': true, 'lit.j3': true } },
      { if: ['open.d3', 'boss'], set: { 'unlocked.d3': 1, 'found.kB': true, 'found.kS': true, 'unlocked.dL': 1, 'lit.arN': true, 'drum.oB': 1 } },
    ],
  },
  // v1.53: the Mooring-House's Rope Store off the Moorers' Gallery (its small key now opens the moorers' gate) and the
  // great key on the Capstan Hall's balcony for the Capstan Floor's door. With the Gallery's ring pulled (the gate was
  // open): its small key in the gate, the store won; past the west door: the great key in the floor's door too
  spacecity: {
    v: 2,
    steps: [
      { if: ['lit.r5', 'open.sc', 'open.gN', 'boss'], set: { 'unlocked.sc': 1, 'found.kS': true, 'lit.arR': true } },
      { if: ['open.gN', 'boss'], set: { 'unlocked.d6': 1, 'found.kB': true, 'drum.bK': 0.167 } },   // (spacecity.js PERCH.plateAt: tests/temples.test.js checks)
    ],
  },
  // v1.49: the Founders' Belfry's west store an arena. Past the Hall of Stones' door: its small key in it, the store won
  arzach2: {
    v: 2,
    steps: [
      { if: ['open.d1', 'drum.ballS', 'lit.s1', 'open.d2', 'gadget', 'open.br1', 'boss'], set: { 'unlocked.d1': 1, 'found.kW': true, 'lit.arW': true } },
    ],
  },
};
export function migrateTempleLayouts(g) {
  let n = 0;
  for (const [id, L] of Object.entries(LAYOUTS)) {
    const k = `temple.${id}.layout`;
    if ((g.flag(k) ?? 1) >= L.v) continue;
    for (const st of L.steps) {
      if (!st.if.some((f) => g.flag(`temple.${id}.${f}`))) continue;
      for (const [f, v] of Object.entries(st.set)) if (g.flag(`temple.${id}.${f}`) === undefined) { g.set(`temple.${id}.${f}`, v); n++; }
    }
    g.set(k, L.v);
  }
  return n;
}
