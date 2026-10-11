// The Lantern's light in the sky (issue #127). Home opens after any six worlds, but the end is past the Signal
// Market, the twelfth: from the seventh world on, the far light the singing light comes from hangs in every
// world's sky, brighter the nearer the end. It is drawn by the ink pass as part of the sky (src/post.js
// drawLantern: a small inked disc, four needle rays, flat gold washes), never a marker on the screen; nobody
// names it. Where it hangs is the world's own (a little round from the others), always on the side of the sky
// the sun and the moon never cross (their paths run from 30° to 210°: src/timeofday.js), high enough to clear the
// skyline (17–22°).
//
// Pure: main.js sets the sky's uniform from it (applyLanternSky); the tests use it directly.

import { ENDING_WORLDS, marketHeard } from './ending.js';
import { ORDER, SIDE, SUB } from '../levels/names.js';

/** From how many worlds done the light is in the sky: six (you are in your seventh). */
export const LIGHT_FROM = ENDING_WORLDS;
/** How bright it is in the seventh world, and at its brightest (0..1, the ink pass's Lt.w). */
export const LIGHT_MIN = 0.3, LIGHT_MAX = 1;

/** The worlds whose sky has it: the route's, the detours', their sub-levels' (not home, nor the Lantern itself, nor the test levels). */
const SKIES = new Set([...ORDER, ...SIDE, ...Object.keys(SUB)]);

const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };

/**
 * The light in `level`'s sky now, or null: { strength 0..1, az, el } (degrees, as the planets are given).
 * Six worlds done: LIGHT_MIN; then brighter with every world, LIGHT_MAX with all but one done; a little more
 * after the first homecoming and once the market has been heard. Gone once Ilen is found (`finale.met`).
 * @param o.level the world · o.completed the worlds done (ids or a count) · o.flag (k) => value
 */
export function lanternSky({ level, completed = 0, flag = () => undefined } = {}) {
  const n = Array.isArray(completed) ? completed.length : completed;
  if (!SKIES.has(level) || n < LIGHT_FROM || flag('finale.met') || flag('ending.final')) return null;
  const k = Math.min(1, (n - LIGHT_FROM) / Math.max(1, ORDER.length - 1 - LIGHT_FROM));
  const lift = (flag('ending.done') ? 0.08 : 0) + (marketHeard({ flag, completed }) ? 0.08 : 0);
  const strength = Math.min(LIGHT_MAX, LIGHT_MIN + (LIGHT_MAX - LIGHT_MIN) * k + lift);
  const h = hash(level);
  return { strength, az: 268 + (h % 61), el: 17 + ((h >>> 8) % 6) };
}

/** Set the ink pass's uniform (a THREE.Vector4: direction, strength) from lanternSky(); none: strength 0. */
export function applyLanternSky(v4, light) {
  if (!light) return v4.set(0, 1, 0, 0);
  const el = (light.el * Math.PI) / 180, az = (light.az * Math.PI) / 180;
  return v4.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az), light.strength);
}
