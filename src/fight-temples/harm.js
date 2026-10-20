// The fight temples' harm along the route (issues #532, #533; docs/design/fight-temples.md "Harm along the route"):
// every blow and every hazard in a temple is scaled by the hearts a traveller has on arriving in its world, so each
// temple costs a like share of his hearts, rising gently from the first to the last. The hurts that come out under a
// quarter heart are not rounded up to one (resources.js quarters made every light blow a quarter heart, from the
// desert's 3 hearts to the Signal Market's 15): they are carried over (harmBank) and paid a quarter at a time.
//
//   fightHarm('desert')            → the scale of the Sunken Hall's blows and hazards (0.25: a quarter of a blow's own)
//   arrivalHearts('bazaar')        → 15: the start and every heart container sold in the worlds before it
//   const pay = harmBank(); pay(0.1) → 0, pay(0.1) → 0.25 (carried), …

import { ORDER, MERGED } from '../levels/names.js';
import { SHOPS } from '../shop.js';
import { HEARTS } from '../resources.js';

/**
 * The scale: `ref` hearts on arrival strike at the blows' own harm (1); fewer, less, more, more; and on top of that a
 * rise of `rise` from the route's first world to its last (the last temple the hardest for the hearts he has). The hazards'
 * at most `hazards` (hazardScale). One blow takes at most `blow` hearts (a tough tripod's stamp at the Oil Exchange's scale
 * was 1.7 hearts, a gorged drone's as much: Foes harmCap).
 */
export const FIGHT_HARM = { ref: 12, rise: 0.5, hazards: 1, blow: 1 };

/**
 * The hearts a traveller can have arriving in each world of the route: the start, and every heart container sold in the
 * shops of the worlds before it (src/shop.js SHOPS). What a careful player has; the combat review plays with the same
 * (scripts/combat-review/lib.mjs heartsOnArrival). A shop in a merged world's part counts in its world (`merged`:
 * src/levels/names.js MERGED; issue #560: the Almonry's and the Welcome-Shelf's hearts, Vael's and Lorn's, were left out).
 */
export function arrivalTable(shops = SHOPS, order = ORDER, start = HEARTS.start, merged = MERGED) {
  const per = {};
  for (const s of Object.values(shops)) { const w = merged[s.world] ?? s.world; per[w] = (per[w] ?? 0) + (s.wares.find((x) => x.id === 'heart')?.stock ?? 0); }
  const out = {}; let h = start;
  for (const w of order) { out[w] = h; h += per[w] ?? 0; }
  return out;
}
let table = null;
export const arrivalHearts = (world) => (table ??= arrivalTable())[world] ?? HEARTS.start;

/** The harm's scale in a world's temple (1 at `ref` hearts, rising `rise` along the route); `at`: its place, 0..1. */
export function harmScale(hearts, at = 0, H = FIGHT_HARM) {
  return (hearts / H.ref) * (1 + H.rise * Math.min(1, Math.max(0, at)));
}
/**
 * The hazards' scale for a temple's: the same, but never above `hazards` (1: each kind's own harm). The rise past it is
 * the foes' (issue #533: the oil, the shade and the toll at 1.6–1.9 times took more than the crowds in the last temples);
 * a hazard is read and learnt once, and its harm should not grow with the route.
 */
export const hazardScale = (scale, H = FIGHT_HARM) => Math.min(scale, H.hazards);
/** The scale in a world's fight temple: its hearts on arrival and its place on the route. */
export function fightHarm(world, order = ORDER) {
  const i = order.indexOf(world);
  return harmScale(arrivalHearts(world), i < 0 ? 0 : i / Math.max(1, order.length - 1));
}

/**
 * A purse of harm (error diffusion): each hurt in hearts goes in, and the whole quarters in it come out (nearest, a tie
 * down), the rest carried to the next. So a tenth of a heart a blow costs a quarter every two or three blows, and
 * 0.4 of a blow is not 0.5 of one. Returns the hearts to take now (0 when it is still under an eighth).
 */
export function harmBank() {
  let carry = 0;
  const pay = (h) => {
    if (!(h > 0)) return 0;
    if (h === Infinity) return h;
    carry += h;
    const q = Math.max(0, Math.ceil(carry * 4 - 0.5 - 1e-9) / 4);
    carry -= q;
    return q;
  };
  Object.defineProperty(pay, 'carry', { get: () => carry });
  return pay;
}
