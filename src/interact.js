// One interact button (E / the pad's right face button / the touch "E" button), many uses:
// talking to people, the ship's hatch and console, the mount's whistle, a
// stuck bone you can heave. Systems register what they offer and this picks
// ONE per frame, so nobody fights over the key.
//
//   import { registerInteractable } from './interact.js';
//   const off = registerInteractable({
//     id: 'ship-hatch',
//     priority: 30,                       // higher wins (see PRIORITY)
//     range: 3,                           // metres; offered only within range
//     distance: (player) => metres,       // Infinity when not available
//     prompt: 'open the hatch',           // shown as "E open the hatch" (or a function returning it)
//     at: () => Vector3,                  // optional: where the floating prompt hangs
//     use: (player) => {},                // pressed
//     enabled: () => true,                // optional
//   });
//   off();                                // unregister
//
// The rule: among the interactables within their range, the highest
// priority wins; ties go to the nearest *in the way you face*: an entry's
// distance is weighed by how far it is off your heading (FACING: as is ahead,
// ×2 to the side, ×3 behind), so with a cab in front of you and a passer-by
// at your shoulder, E boards the cab. People, vehicles and things share one
// tier; the prompt shown is always the one E will use (updateInteract); the ship's hatch and console sit above it (at or inside the ship they
// always win). Nothing in range → the press falls through to the player's
// own E (whistle the mount, hail a taxi), the lowest priority of all. While
// riding, only entries with `whileRiding: true` are offered (getting off
// comes first).

import * as THREE from 'three';

export const PRIORITY = {
  ship: 40,       // hatch and cockpit console, when at or inside the ship
  vehicle: 20,    // a vehicle right beside you
  talk: 20,       // a person to talk to
  use: 20,        // a thing to use (a lens, a bone to heave, a well)
  whistle: 0,     // the mount's whistle (the player's own fallback, not registered)
};

const entries = new Set();

export function registerInteractable(o) {
  const e = { priority: PRIORITY.use, range: 3, enabled: () => true, distance: () => Infinity, prompt: 'use', ...o };
  entries.add(e);
  return () => entries.delete(e);
}

export function clearInteractables() { entries.clear(); }
export const allInteractables = () => [...entries];

/** How much further an entry off your heading counts: ×1 ahead, ×(1 + FACING) to the side, ×(1 + 2·FACING) behind. */
export const FACING = 1;
const _f = new THREE.Vector3();

/**
 * An entry's distance weighed by where it lies from the way you face (its `at()`, your heading on the
 * ground; as it is without either).
 */
export function facingWeight(player, e) {
  const at = e.at?.(), pos = player?.pos;
  if (!at || !pos || !Number.isFinite(player.heading)) return 1;
  const dx = at.x - pos.x, dz = at.z - pos.z, L = Math.hypot(dx, dz);
  if (L < 0.3) return 1;   // (right on top of it: no direction to speak of)
  // (the way you face on the ground: the player's own frame where it has one)
  const f = player.frame?.dir ? player.frame.dir(player.heading, _f) : _f.set(Math.sin(player.heading), 0, Math.cos(player.heading));
  const fl = Math.hypot(f.x, f.z) || 1;
  return 1 + FACING * (1 - (dx * f.x + dz * f.z) / (L * fl));
}

/** The interactable that E would use right now, or null: { entry, distance }. */
export function bestInteractable(player, { riding = !!player?.riding } = {}) {
  let best = null, bd = Infinity, bs = Infinity, bp = -Infinity;
  for (const e of entries) {
    if (riding && !e.whileRiding) continue;
    if (!e.enabled()) continue;
    const d = e.distance(player);
    if (!(d <= e.range)) continue;
    const score = d * facingWeight(player, e);
    if (e.priority > bp || (e.priority === bp && score < bs)) { best = e; bd = d; bs = score; bp = e.priority; }
  }
  return best ? { entry: best, distance: bd } : null;
}

/**
 * Per frame, before the player's own update: `pressed` is a fresh E press.
 * Returns { prompt, handled }: the prompt to show (or null), and whether the
 * press was consumed (then the player's own E must not also fire).
 */
export function updateInteract(player, pressed, o = {}) {
  const best = bestInteractable(player, o);
  if (best && pressed) best.entry.use(player);
  const prompt = best ? (typeof best.entry.prompt === 'function' ? best.entry.prompt() : best.entry.prompt) : null;
  return { prompt, entry: best?.entry ?? null, handled: !!(best && pressed) };
}
