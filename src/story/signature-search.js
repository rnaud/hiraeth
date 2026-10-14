// The signature search: how a new world gets onto the ship's galactic map (v1.6).
//
// The route still opens in ORDER (src/story/route.js knownWorlds: where the ship came down, then the next two
// worlds not done yet). What changed is how a newly opened world shows on the map: the ship reads the
// singing light's signature out there (the three slow pulses, src/story/signature.js), but not where.
// Such a world is "findable": the map draws an uncharted region somewhere round it and no name, and
// the player sweeps the chart with the scanner (the cursor, the left stick, WASD, a finger) until the
// cues lead to it: the scanner warms and pulses faster, the light's three notes come fainter or
// louder, the pad rumbles in threes (src/rumble.js 'search'). Held over it for a moment, the planet
// resolves and is charted (flag `map.found.<id>`), and the ship says so.
//
// A world is charted (no search) when it is the first one (where the ship came down), you have been there or
// stand in it, it is done, or it was found. Old saves keep every world they had charted: the
// migration (src/save-migrate.js step 6) marks the worlds they knew as found. The detours
// (CHARTED_SIDE), the Lantern and home are charted outright; the worlds still being made (WIP)
// are never on the map at all.
//
// Fair and quick: the cue reaches across nearly half the chart, the lock spot is the size of a
// planet's disc (at least LOCK_MIN px, so a phone's finger or a handheld's stick finds it), and
// half a second over it is enough. Pure: tests/signature-search.test.js.

import { knownWorlds } from './route.js';
import { spoken } from './tone.js';

/** The save flag of a world found by the search. */
export const foundFlag = (id) => `map.found.${id}`;

/** The search's tuning, as fractions of the chart field's diagonal (and seconds). */
export const SEARCH = {
  reach: 0.45,     // the cue starts this far from the hidden world (0 at the edge of it, 1 on top)
  lock: 0.06,      // the lock spot's radius, at least LOCK_MIN px and the planet's disc
  lockMin: 30,
  hold: 0.5,       // s over the spot to resolve it
  decay: 1.2,      // the lock lost per second away from it
  speed: 0.5,      // the scanner's speed on the stick / keys (diagonals per second at full tilt)
  region: 0.16,    // the uncharted region drawn round a hidden world (its radius) …
  offset: 0.45,    // … its centre off the world's spot by up to this much of that radius
  arm: 0.05,       // the scanner must be swept this far (of the diagonal) after the map opens before a lock can build
  clear: 2.5,      // and it starts at least this many lock radii from every hidden world (issue #204)
};

/** Is this world on the chart without a search? `index`: its place in ORDER. */
export function isCharted({ id, index = 1, visited = false, done = false, current = false, flag = () => undefined }) {
  return index === 0 || !!visited || !!done || !!current || !!flag(foundFlag(id));
}

/**
 * The route split for the map: `charted` (named, choosable) and `findable` (opened by the route, the
 * signature read, not found yet). Same arguments as knownWorlds, plus `flag`.
 */
export function routeChart({ order = [], done = () => false, visited = () => false, current = null, flag = () => undefined, after } = {}) {
  const known = knownWorlds({ order, done, visited, current, ...(after ? { after } : {}) });
  const charted = [], findable = [];
  for (const id of known) {
    (isCharted({ id, index: order.indexOf(id), visited: visited(id), done: done(id), current: id === current, flag }) ? charted : findable).push(id);
  }
  return { known, charted, findable };
}

/** The worlds named anywhere (the level picker, the sketchbook): the charted ones only. */
export const chartedWorlds = (o) => routeChart(o).charted;

/**
 * The cue's strength, 0 (out of reach) .. 1 (on the hidden world), for the scanner `d` px from it on
 * a field whose diagonal is `diag` px. Eased so the last stretch rises fast (the "warmer" feel).
 */
export function cueStrength(d, diag, S = SEARCH) {
  const reach = Math.max(1, S.reach * diag);
  const k = 1 - Math.min(1, Math.max(0, d) / reach);
  return k * k * (3 - 2 * k) * 0.85 + k ** 4 * 0.15;
}

/** The lock spot's radius (px) on a field of `diag` px with planets `disc` px wide. */
export const lockRadius = (diag, disc = 0, S = SEARCH) => Math.max(S.lockMin, S.lock * diag, disc * 0.6);

/**
 * One step of the search. `state`: { lock: 0..1 per target id }; `at`: the scanner [x, y];
 * `targets`: [{ id, x, y }]. Returns { strength, nearest, lock, found } (found: the id resolved this
 * step, or null). `diag`: the field's diagonal, `disc`: a planet's disc (px).
 */
export function searchStep(state, { at, targets = [], dt = 0, diag = 1000, disc = 0, armed = true }, S = SEARCH) {
  state.lock ??= {};
  // (not swept yet since the map opened: the cues answer, but nothing is held, so nothing resolves by itself: issue #204)
  if (!armed) dt = 0;
  let strength = 0, nearest = null, found = null, lock = 0;
  const r = lockRadius(diag, disc, S);
  for (const t of targets) {
    const d = Math.hypot(at[0] - t.x, at[1] - t.y);
    const s = cueStrength(d, diag, S);
    if (s > strength || !nearest) { strength = Math.max(strength, s); nearest = t.id; }
    const l = d <= r ? (state.lock[t.id] ?? 0) + dt / S.hold : Math.max(0, (state.lock[t.id] ?? 0) - dt * S.decay);
    state.lock[t.id] = Math.min(1, l);
    if (state.lock[t.id] > lock) lock = state.lock[t.id];
    if (!found && state.lock[t.id] >= 1) found = t.id;
  }
  return { strength, nearest, lock, found };
}

/**
 * Where the scanner starts when the map opens (issue #204: "it auto found the first planet because of where the
 * cursor was"): the first of `prefer` (the ship's own world, say) and the field's middle, then a ring of spots round
 * it, that lies at least SEARCH.clear lock radii from every hidden world; else the one farthest from them all.
 * `box`: [left, top, right, bottom] the scanner may be in (px).
 */
export function scanStart({ targets = [], box = [0, 0, 800, 600], diag = 1000, disc = 0, prefer = [] } = {}, S = SEARCH) {
  const [l, t, r, b] = box, mid = [(l + r) / 2, (t + b) / 2];
  const inBox = (p) => [Math.min(r, Math.max(l, p[0])), Math.min(b, Math.max(t, p[1]))];
  const ring = Array.from({ length: 8 }, (_, k) => [mid[0] + Math.cos((k / 8) * Math.PI * 2) * (r - l) * 0.32, mid[1] + Math.sin((k / 8) * Math.PI * 2) * (b - t) * 0.32]);
  const spots = [...prefer.filter(Boolean), mid, ...ring].map(inBox);
  const far = S.clear * lockRadius(diag, disc, S);
  const gap = (p) => Math.min(Infinity, ...targets.map((x) => Math.hypot(p[0] - x.x, p[1] - x.y)));
  return spots.find((p) => gap(p) >= far) ?? spots.reduce((a, p) => (gap(p) > gap(a) ? p : a), spots[0]);
}

/** Has the scanner been swept far enough since the map opened for a lock to build (`moved` px)? */
export const searchArmed = (moved, diag, S = SEARCH) => moved >= S.arm * diag;

/**
 * The scanner's interference (issue #353: "the finder is shaking too much, and much too much when it's far away"): no
 * more a fresh random offset every frame, but a slow wander along a smooth curve, `amp` px at most (cues().jitter), its
 * pace in Hz (cues().wander); faint, it barely drifts, and it never trembles. `ease`: how fast (1/s) the amplitude
 * follows the strength.
 */
export const WANDER = { min: 0.3, max: 1.6, hz: 0.2, hzStrong: 0.45, ease: 2.5 };

/** The wander's offset [x, y] px at `phase` (rad, advanced by 2π·hz a second) and amplitude `amp` px: within amp. */
export function wander(phase, amp) {
  const x = Math.sin(phase) * 0.7 + Math.sin(1.73 * phase + 1.3) * 0.3;
  const y = Math.cos(1.31 * phase + 0.4) * 0.7 + Math.sin(2.07 * phase + 2.1) * 0.3;
  return [x * amp * Math.SQRT1_2, y * amp * Math.SQRT1_2];
}

/**
 * What the cues do at a strength (0..1): the scanner's warmth (0 cool violet .. 1 gold), the beat
 * (s between the three pulses: the signature's own rhythm, faster nearer), the interference (px the
 * scanner wanders: the fainter the smaller; `wander` its pace in Hz), the light's notes' volume
 * (0: silent), and a word for the meter.
 */
export function cues(s, W = WANDER) {
  const k = Math.min(1, Math.max(0, s));
  return {
    warmth: k,
    beat: 2.2 - 1.45 * k,
    jitter: k < 0.12 ? 0 : W.min + (W.max - W.min) * k * k,
    wander: W.hz + (W.hzStrong - W.hz) * k,
    notes: k < 0.12 ? 0 : 0.25 + 0.75 * k,
    bars: Math.round(k * 5),
    word: k < 0.12 ? 'silent' : k < 0.4 ? 'faint' : k < 0.7 ? 'warmer' : k < 0.9 ? 'strong' : 'locking',
  };
}

/** A small seeded number in [0, 1) from a world's id (the uncharted region's offset: the same every time). */
export function idHash(id, salt = 0) {
  let h = 2166136261 ^ salt;
  for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10007) / 10007;
}

/** The uncharted region round a hidden world at (x, y): { cx, cy, r }, never centred on it (it would give it away). */
export function regionFor(id, x, y, diag, S = SEARCH) {
  const r = S.region * diag, a = idHash(id) * Math.PI * 2, o = (0.25 + 0.75 * idHash(id, 7)) * S.offset * r;
  return { cx: x + Math.cos(a) * o, cy: y + Math.sin(a) * o, r };
}

/** The light's three notes, faintly (Hz, beats): the map plays them through src/audio.js (signatureNotes below). */
export const SIGNATURE_NOTES = [[784, 1], [659.3, 1], [987.8, 2]];

/**
 * Play the singing light's notes on the map at `vol` (0..1). The light's own theme, once the opening has
 * one (sound.lightTheme, src/audio.js), else three soft flute notes on the effects bus (sound.tune).
 */
export function signatureNotes(sound, vol = 1) {
  if (!sound || vol <= 0) return false;
  if (typeof sound.lightTheme === 'function') return sound.lightTheme({ vol: 0.35 * vol, short: true }) ?? true;
  return sound.tune?.(SIGNATURE_NOTES, 0.17, 'flute', 0.05 * vol) ?? false;
}

// ---- the words (the ship's voice; every line has a tone: src/story/tone.js)

/** The map's own label for the search, beside the chart (and its short form on small screens). */
export const SEARCH_LABEL = 'SIGNATURE SEARCH';
export const SEARCH_LEGEND = 'The ship hears the singing light’s three pulses out there, but not where. Sweep the uncharted regions: the scanner warms, quickens and sings as you near a world that carries it. Hold it there to chart it.';
export const SEARCH_LEGEND_SHORT = 'Sweep the uncharted regions: the scanner warms and sings near a world carrying the signal.';

/** The ship, the first time the map opens with a world to find (flag `signature.search.told`). */
export const SEARCH_LINE = spoken('ship', '~curious~ The same signature, further out. I can hear the three pulses, but not where they come from. Sweep the chart: I will sing louder as you get close.');

/** The ship, when the search charts a world. */
export const foundLine = (title) => spoken('ship', `~happy~ Signature locked. ${title} is on the chart.`);

/** The toast when finishing a world opens new ones: no names yet, they have to be found. */
export function findableNote(n = 0) {
  if (!n) return null;
  return n === 1
    ? 'The ship reads the singing light’s signature somewhere new. Search for it on the galactic map.'
    : `The ship reads the singing light’s signature in ${n} new places. Search for them on the galactic map.`;
}
