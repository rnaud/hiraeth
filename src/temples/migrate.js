// Saves from before the temples: the gadgets that moved into a temple's
// chest (src/boxes/placements.js, the entries with `temple`) were found in
// the open before. Whoever already carries one finds its temple chest open
// (counted as found in the sketchbook), and the temple's doors that want the
// gadget answer it at once (logic.js: `gadget` is also "you have it").
// Idempotent: it runs at every load (src/boxes/index.js migrateSave), so a
// gadget got another way later (a fallback box by the ship) counts too.

/** [box id, item] of every temple chest. */
export const TEMPLE_BOXES = [
  ['desert.temple.fire', 'fire'],
  ['incal.temple.jetpack', 'jetpack'],
  ['arzach2.temple.bell', 'bell'],
  ['spheres.temple.lens', 'lens'],
  ['buried.temple.cell', 'cell'],
  ['perdide2.temple.lantern', 'lantern'],
  ['perdide.temple.stun', 'stun'],
  ['arzach.temple.glider', 'glider'],
  ['garage.temple.coil', 'coil'],
];

export function migrateTemples(g) {
  let n = 0;
  for (const [box, item] of TEMPLE_BOXES) {
    if (g.flag(`item.${item}`) && !g.flag(`box.${box}`)) { g.set(`box.${box}`, true); n++; }
  }
  return n;
}
