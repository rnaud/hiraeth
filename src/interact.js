// One interact button (E / gamepad X-□ / the touch "E" button), many uses:
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
// priority wins; ties go to the nearest. People, vehicles and things share
// one tier, so you talk to someone only when they are the closest thing to
// use; the ship's hatch and console sit above it (at or inside the ship they
// always win). Nothing in range → the press falls through to the player's
// own E (whistle the mount, hail a taxi), the lowest priority of all. While
// riding, only entries with `whileRiding: true` are offered (getting off
// comes first).

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

/** The interactable that E would use right now, or null: { entry, distance }. */
export function bestInteractable(player, { riding = !!player?.riding } = {}) {
  let best = null, bd = Infinity, bp = -Infinity;
  for (const e of entries) {
    if (riding && !e.whileRiding) continue;
    if (!e.enabled()) continue;
    const d = e.distance(player);
    if (!(d <= e.range)) continue;
    if (e.priority > bp || (e.priority === bp && d < bd)) { best = e; bd = d; bp = e.priority; }
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
