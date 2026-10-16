// Light a bubble carries (issue #377, the Lamp-House: its tool is the bubble wand since the lantern charm went to the
// open; docs/systems/gadgets.md "The bubble wand", docs/systems/temples.md "The gadgets earned inside"). A lit place
// says so here (a pool-lamp a splash lit, a lamp's glass once it burns, a pool-orb while it glows, the Lantern Chamber's
// fount); a bubble blown in its light, or floating through it, catches it and glows (src/gadgets/bubble.js), and where a
// glowing bubble bursts it gives the light up (the game event 'bubble:light' { pos }): a dark lamp or a dark orb within
// CARRY.reach of that drinks it (src/temples/pieces.js LightEar `carried`, Ball `lamp.carried`).
//
//   const off = registerLight({ position: () => v3, radius: 2.6, enabled: () => lit })
//   lightAt(pos) → the light whose reach `pos` is in (enabled), or null
//
// Module-wide, as the targets are (src/targets.js): what registers lets go in its dispose().

const LIGHTS = new Set();

/** How far a lit place's light reaches a bubble (m), and how near a dark lamp a glowing bubble must burst (m). */
export const CARRY = { radius: 2.6, reach: 2.8 };

/** A lit place a bubble may take light from. Returns the function that takes it away. */
export function registerLight(l) {
  const e = { radius: CARRY.radius, enabled: () => true, ...l };
  LIGHTS.add(e);
  return () => LIGHTS.delete(e);
}

/** The lit place whose light reaches `p` (its reach, enabled now), or null. */
export function lightAt(p, list = LIGHTS) {
  for (const l of list) if (l.enabled() && l.position().distanceTo(p) <= l.radius) return l;
  return null;
}

/**
 * What drinks a glowing bubble's light (a dark lamp's glass, a dark orb, the Lampless hanging low): a glowing bubble that
 * comes within `radius` of one bursts on it (src/gadgets/bubble.js), so its light goes there. Returns the function that
 * takes it away.
 */
const DRINKERS = new Set();
export function registerDrinker(d) {
  const e = { radius: 1.2, enabled: () => true, ...d };
  DRINKERS.add(e);
  return () => DRINKERS.delete(e);
}
/** The drinker a glowing bubble at `p` (radius r) touches now, or null. */
export function drinkerAt(p, r = 0, list = DRINKERS) {
  for (const d of list) if (d.enabled() && d.position().distanceTo(p) <= d.radius + r) return d;
  return null;
}

/** Every light (tests). */
export const allLights = () => [...LIGHTS];
/** (tests) */
export function clearLights() { LIGHTS.clear(); }
