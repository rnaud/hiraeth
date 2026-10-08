// The world's workings: the parts of a world that act on any body inside them, not only on the traveller
// (docs/systems/foes.md, "Foes in the world's workings"). A temple's updrafts, gusts and pendulums register
// here (src/temples/pieces.js), and so do the open world's own (the mastery trials' updrafts,
// src/trials/), so a foe knocked into one, or flying through one, feels it wherever it stands
// (src/foes.js). The traveller's own answer to each stays in the piece that draws it.
//
//   const off = registerWorking({ kind: 'updraft', contains: (p) => bool, lift: 7, top: y, foot: Vector3, r })
//   workingsAt(pos)            → every working whose volume holds pos (feet), in no order
//   workingsAt(pos, 'gust')    → only that kind
//
// Kinds and their fields (all read-only for the caller):
//   updraft  { contains(p), foot (Vector3), r, top (y of its top), lift (m/s up) }
//   gust     { contains(p), dir (unit Vector3, world), push (m/s), blowing() → bool, sheltered?(p) → bool }
//   swing    { contains(p), center (Vector3), radius, moving() → bool, push(p, out) → Vector3 (the way it knocks) }

const list = new Set();

/** Add a working; returns its remover. */
export function registerWorking(w) {
  if (!w || typeof w.contains !== 'function') throw new Error('a working needs contains(pos)');
  list.add(w);
  return () => list.delete(w);
}

/** The workings whose volume holds `pos` (a body's feet), optionally of one kind. */
export function workingsAt(pos, kind = null, out = []) {
  out.length = 0;
  for (const w of list) if ((!kind || w.kind === kind) && w.contains(pos)) out.push(w);
  return out;
}

export const allWorkings = () => [...list];
export const clearWorkings = () => list.clear();
