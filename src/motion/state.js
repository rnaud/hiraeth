// The Motion page's settings (motion.html): one plain object kept in the URL's query string, so
// a setup (two travellers on a scripted run, slowed down, seen from the side) can be sent as a
// link. Only what differs from DEFAULTS is written. The people lane's walkers are one key:
//   ?mode=people&walkers=library:1.25,cmu_137_29:1.3,cmu_142_07:0.6

import { PAGE_RUNS } from '../gait-course.js';

/** Short ids for the scripted runs (src/gait-course.js PAGE_RUNS), in the order shown. '' is your own control. */
export const RUN_IDS = {
  'walk-run-180': 'walk → run → 180° turn → stop',
  'walk-90': 'walk, 90° turn, stop',
  'spot': 'turn round on the spot',
  'ramp': 'up the ramp, stand',
  'stairs': 'stairs up, stand, down',
  'slow': 'slow walk (half stick), stop',
  'jog-45': 'jog, 45° and back, stop',
  'still': 'stand still 6 s',
  'start-stop': 'start, stop, again (walk and run)',
};
for (const name of Object.values(RUN_IDS)) if (!PAGE_RUNS[name]) throw new Error(`motion page: no run "${name}"`);

export const MODES = ['duo', 'solo', 'people', 'moves'];
export const RATES = [1, 0.5, 0.25];

export const DEFAULTS = Object.freeze({
  mode: 'duo',          // duo: loops and motion matching side by side, one input | solo: one traveller, a toggle | people: a row of walkers | moves: the traveller's own moves (moves.glb) on him and a MakeHuman person
  run: '',              // '' your own control (keyboard / pad), or a RUN_IDS id
  loop: true,           // a scripted run starts again when it ends
  rate: 1,              // 1 | 0.5 | 0.25: slow motion
  paused: false,
  follow: 'split',      // duo: split (two views side by side, one traveller each) | both (one view) | loops | mm
  view: 'side',         // side | behind | orbit (drag to turn round)
  mm: false,            // solo: motion matching on (else the loops)
  traj: true,           // solo: the predicted and the matched trajectory, the path walked
  feet: true,           // planted feet marked on the ground
  obstacles: true,      // pillars and crates to walk round (free control)
  yaw: 0, pitch: 0.22, zoom: 1,   // the view: turned from its own direction (side, behind), tilted, how far
  style: false,         // people: each their own seeded gait style (else one plain style, so only the walks differ)
  focus: -1,            // people: the walker the camera is on (-1 the whole row)
  walkers: 'library:1.25,cmu_137_29:1.3,cmu_136_20:1,cmu_142_07:0.6',   // people: walk:speed, comma separated
  move: '',             // moves: the clip shown ('' the first)
  moveT: 0,             // moves: where in it (0..1) while paused
});

/** The people lane's walkers from the URL value: [{ walk: 'library' | a captured walk's name, speed }]. */
export function parseWalkers(s) {
  const out = [];
  for (const part of String(s ?? '').split(',')) {
    const [walk, sp] = part.split(':');
    const name = (walk ?? '').trim();
    if (!/^[\w.-]{1,40}$/.test(name)) continue;
    const speed = Number(sp);
    out.push({ walk: name, speed: Number.isFinite(speed) && speed > 0 ? Math.min(Math.max(speed, 0.3), 3) : 1.25 });
    if (out.length >= 16) break;
  }
  return out;
}
export const formatWalkers = (list) => list.map((w) => `${w.walk}:${+w.speed.toFixed(2)}`).join(',');

/** A full state from a partial one (unknown keys dropped, types follow DEFAULTS, choices checked). */
export function cleanState(s = {}) {
  const out = { ...DEFAULTS };
  for (const [k, def] of Object.entries(DEFAULTS)) {
    if (!(k in s)) continue;
    const v = s[k];
    if (typeof def === 'number') { const n = Number(v); if (Number.isFinite(n)) out[k] = n; }
    else if (typeof def === 'boolean') out[k] = v === true || v === 'true' || v === '1' || v === 1;
    else out[k] = String(v ?? def);
  }
  if (!MODES.includes(out.mode)) out.mode = DEFAULTS.mode;
  if (out.run && !RUN_IDS[out.run]) out.run = '';
  if (!RATES.includes(out.rate)) out.rate = 1;
  if (!['loops', 'mm', 'both', 'split'].includes(out.follow)) out.follow = DEFAULTS.follow;
  if (!['side', 'behind', 'orbit'].includes(out.view)) out.view = DEFAULTS.view;
  out.zoom = Math.min(Math.max(out.zoom, 0.2), 6);
  out.walkers = formatWalkers(parseWalkers(out.walkers));
  return out;
}

/** The query string for a state (only what differs from DEFAULTS). */
export function encodeState(s) {
  const c = cleanState(s), p = new URLSearchParams();
  for (const [k, def] of Object.entries(DEFAULTS)) if (c[k] !== def) p.set(k, String(c[k]));
  return p.toString();
}

/** A state from a query string (or URLSearchParams). */
export function decodeState(q) {
  const p = q instanceof URLSearchParams ? q : new URLSearchParams(q);
  return cleanState(Object.fromEntries(p));
}
