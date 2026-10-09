// The stone hand's riddle on Vael (src/story/arzach.js): four knuckles, shot in the right order, ring the hand.
//
// The order is smallest finger to tallest: little, index (first), ring, middle (KNUCKLE_ORDER in
// arzach-data.js). The playtest of 2026-10-08 found it unclear (which knuckle is "smallest"? from below the
// hand, mirrored, the fingers looked alike). It stays the same riddle, made readable by looking:
//   - the fingers are clearly graded in length, and so are the four knuckle stones (src/levels/arzach.js);
//   - each knuckle stone carries its place carved in dots, one to four (`dots`);
//   - a right knuckle rings its note (a rising scale) and stays lit, so the chain so far shows;
//     a wrong one gives a dull knock, every knuckle flashes rust and goes dark, and the chain starts again;
//   - after RIDDLE.hint misses Kesh calls the order out and the journal's line spells it (flag
//     arzach.hand.hint); after RIDDLE.glint misses the next right knuckle glints.
// This file is the pure part (tested in tests/knuckle-riddle.test.js); arzach.js draws and sounds it.

export const RIDDLE = { hint: 2, glint: 3, radius: [2.5, 3.0, 3.5, 4.0] };

/** A fresh riddle: the chain struck so far (knuckle indices), and the misses. */
export function riddleState() { return { seq: [], misses: 0, rung: false }; }

/** The knuckle that comes next in `order` (or null once rung). */
export function nextKnuckle(s, order) { return s.rung ? null : order[s.seq.length] ?? null; }

/** How many dots are carved on knuckle i: its place in the order, 1 to 4. */
export function dots(i, order) { return order.indexOf(i) + 1; }

/**
 * Knuckle i is shot. Returns { result, hint }:
 *   result: 'right' (the next in the chain; it stays lit), 'rung' (the last: the hand rings), 'wrong' (the chain
 *   breaks: it starts again, from this knuckle if it is the first), or 'done' (already rung: it only chimes);
 *   hint: null, 'call' (this miss is the RIDDLE.hint-th: Kesh calls the order, the journal spells it) or
 *   'glint' (misses from RIDDLE.glint on: the next right knuckle glints).
 * Mutates s.
 */
export function strikeKnuckle(s, i, order) {
  if (s.rung) return { result: 'done', hint: null };
  if (order[s.seq.length] === i) {
    s.seq.push(i);
    if (s.seq.length === order.length) { s.rung = true; return { result: 'rung', hint: null }; }
    return { result: 'right', hint: null };
  }
  s.misses++;
  s.seq = order[0] === i ? [i] : [];
  const hint = s.misses === RIDDLE.hint ? 'call' : s.misses >= RIDDLE.glint ? 'glint' : null;
  return { result: 'wrong', hint };
}

/** The size of knuckle i's stone (m): graded by its place in the order, the first the smallest. */
export function knuckleRadius(i, order) { return RIDDLE.radius[order.indexOf(i)] ?? 3.4; }

/** Should the next right knuckle glint (enough misses, not rung)? */
export function glinting(s) { return !s.rung && s.misses >= RIDDLE.glint; }
