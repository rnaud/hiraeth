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
  // Shade House won, the Cold Frame's eyes awake
  edena: {
    v: 2,
    steps: [
      { if: ['open.d1', 'lit.s2', 'open.d2', 'gadget', 'lit.bud1', 'open.d3', 'lit.seed1', 'boss'], set: { 'unlocked.d1': 2, 'found.kW': true, 'found.kE': true, 'lit.arW': true, 'lit.sC1': true, 'lit.sC2': true } },
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
  bazaar: {
    v: 2,
    steps: [
      { if: ['lit.eW', 'open.wdisc', 'gadget', 'lit.e0', 'open.d3', 'open.d4', 'boss'], set: { 'unlocked.dK': 2, 'found.kW': true, 'found.kE': true, 'lit.arW': true, 'lit.eT': true, 'drum.ballT': 1 } },
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
