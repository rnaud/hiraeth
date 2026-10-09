// The title screen's shots (src/title.js, drawn by src/title-world.js): each one a real world of the
// game seen from a fixed camera framed like one of the covers in references/Title Screen/ (the
// Midjourney covers the title was designed from: selections.json has their prompts). The title
// picks one each time the game opens, never the one it showed last.
//
// A shot:
//   id, ref      the cover it follows (its label and file in references/Title Screen/)
//   level        the world (src/levels/names.js)
//   hour         the clock, stopped (the world's own when left out)
//   camera       { eye: [x, y, z], target: [x, y, z], fov (vertical, deg, at 16:9), roll (deg) }
//   portrait     the same for a screen held upright (eye, target, fov, any of them), when the
//                wide framing would lose what matters; else shotCamera derives one
//   traveller    { at: [x, y, z], heading (rad: he faces (sin h, 0, cos h)) }, or null
//   clock        where the level's own clock starts (s): its mantas, boats, baskets where the cover has them
//   mirror       true: the render flipped left to right (a cover whose world is built the other way round)
//   sky          { planets, eclipse }: the cover's planets in place of the world's (src/post.js: az, el, size,
//                color, ring), its eclipse's disc moved or resized
//   look         the view's own touches on the world's ink preset (post.js uniforms), rarely
//   menu         'mid': the title's menu higher, in the middle of the space under the name, for a cover whose
//                lower left is busy (src/title-layout.js; left out: the lower left, calm in every shot so far)
//
// Pure: no three.js, no DOM (the tests import it; the shots' data is checked there).

import { TITLES } from './levels/names.js';

/** Where the title remembers the shot it showed (a global key: not a save's). */
export const LAST_SHOT_KEY = 'moebius.title.shot';
/** The covers' shape: every shot is framed at 16:9 first. */
export const REF_ASPECT = 16 / 9;

export const SHOTS = [
  // the city behind the waterfall: its terraces on the left, the curtain on the right, the cavern's mouth
  // in the gap between them, the traveller on a balcony over the pool
  { id: 'H1', ref: 'H1-waterfall-city.jpg', level: 'waterfall', hour: 10.5,
    camera: { eye: [-150, 9, 22], target: [44, 20, 8], fov: 55 }, traveller: { at: [-126, 0, 35], heading: 1.7 } },
  // the underwater city: towers and their pods down the canal, the traveller on a pod's deck
  { id: 'B2', ref: 'B2-underwater.jpg', level: 'underwater', hour: 11, clock: 62,
    camera: { eye: [-98, 21.5, -8], target: [0.9, 10, -30], fov: 55 }, traveller: { at: [-84, 15.7, -4], heading: 1.9 } },
  // the white mangrove at dusk: the trees over the still water, the traveller on the landing stage
  { id: 'F1', ref: 'F1-white-mangrove.jpg', level: 'mangrove', hour: 17.4,
    camera: { eye: [-5, 6.5, 64], target: [-34, 2, -32], fov: 40 }, traveller: { at: [-3.6, 1.2, 51.5], heading: -2.85 } },
  // the underside: the inhabited shelf over the sea of cloud, seen from the stair's landing (the world is
  // built the other way round from the cover: mirrored)
  { id: 'O1', ref: 'O1-underside.jpg', level: 'underside', hour: 7.6, mirror: true,
    camera: { eye: [10, 4.6, 39], target: [70, 22, -60], fov: 52 }, traveller: { at: [12, 2, 30], heading: 2.8 } },
  // the sky stones: the monastery's table and its needle over the cloud, from a rose ledge
  { id: 'E3', ref: 'E3-sky-stones.jpg', level: 'arzach2', hour: 9,
    camera: { eye: [-491, 85.6, -136], target: [-397.8, 78, -152], fov: 52 }, traveller: { at: [-484.5, 82, -133.5], heading: 1.75 } },
  // the salt harbour: the two beached ships, the street between them, the gangway across
  { id: 'G4', ref: 'G4-salt-harbour.jpg', level: 'saltharbour', hour: 10.5,
    camera: { eye: [-6, 1.8, 95], target: [-4, 26, -10], fov: 54 }, traveller: { at: [3, 0, 83], heading: 3.1 } },
  // the moon foundry: the hung moons, the broken one and the cradle under the gantries
  { id: 'I1', ref: 'I1-moon-foundry.jpg', level: 'moonfoundry', hour: 10.5,
    camera: { eye: [-20, 1.8, 60], target: [-14.9, 24, -36.5], fov: 54 }, traveller: { at: [-14.9, 0, 48.3], heading: 3.09 } },
  // the garden of spheres: the umbrella trees either side, the arch and the pyramids between
  { id: 'K4', ref: 'K4-garden-spheres.jpg', level: 'spheres', hour: 17.5,
    camera: { eye: [0, 1.6, 30], target: [0, 22.4, -67.8], fov: 50 }, traveller: { at: [5, 0, 12], heading: Math.PI } },
  // the city floating in space: the balcony island before its great planet, from the bridge
  { id: 'L3', ref: 'L3-space-city.jpg', level: 'spacecity', hour: 8.5,
    camera: { eye: [-2, 4, -108], target: [4, 6, -192], fov: 55 }, traveller: { at: [1.2, 0, -114], heading: 3.1 } },
  // the forest of antennas: the great receiver over the village, the path winding up to it
  { id: 'N4', ref: 'N4-forest-antennas.jpg', level: 'antennas', hour: 15.5,
    camera: { eye: [4.1, 1.5, 23.5], target: [45.8, 17, -66], fov: 54 }, traveller: { at: [11.5, -0.87, 17], heading: 2.71 } },
  // the desert: mesas either side, the leviathan's ribs on the left, the ringed planet over the dunes
  { id: 'A1', ref: 'A1-desert.jpg', level: 'desert', hour: 9.5,
    camera: { eye: [-560, 2.1, -470], target: [-631, 10, -541], fov: 40 }, traveller: { at: [-565, 1.3, -482], heading: 3.9 },
    sky: { planets: [{ az: 220, el: 9, size: 2.2, color: '#ece4d2', ring: 0.3 }] } },
  // a butte on the left, the ribs far off in the middle of the plain
  { id: 'A2', ref: 'A2-desert.jpg', level: 'desert', hour: 15.5,
    camera: { eye: [-1250, 14.9, -710], target: [-1152.3, 29.7, -694.5], fov: 36 }, traveller: { at: [-1235, 14.1, -702.4], heading: 1.51 },
    sky: { planets: [{ az: 69, el: 10, size: 2.2, color: '#ece4d2', ring: 0.3 }] } },
  // the leviathan's spine across the middle, a mesa at the left
  { id: 'A4', ref: 'A4-desert.jpg', level: 'desert', hour: 9.5,
    camera: { eye: [-770.4, -2.6, -851.4], target: [-709.1, 7.5, -773], fov: 40 }, traveller: { at: [-766.2, -4.3, -836.9], heading: 0.6 },
    sky: { planets: [{ az: 31, el: 9, size: 2.2, color: '#ece4d2', ring: 0.3 }] } },
  // the glass dunes: the breaker's curl over the north camp, the billows on the right
  { id: 'M1', ref: 'M1-glass-dunes.jpg', level: 'glassdunes', hour: 16.5,
    camera: { eye: [-140, 5.3, -80], target: [-48.3, 20, -117.1], fov: 50 }, traveller: { at: [-128.4, 2.1, -80.7], heading: 2.25 } },
  // the buried machine: the great wheel half sunk in the dunes, the ring of arches on the horizon
  { id: 'J3', ref: 'J3-buried-machine.jpg', level: 'buried', hour: 7.5,
    camera: { eye: [45, 13, -75], target: [98, 30, -168], fov: 44 }, traveller: { at: [53.4, 12.5, -81.7], heading: 2.6 } },
  // the city during the eclipse: the market's lanterns on the left, the great stair, the black sun
  { id: 'P1', ref: 'P1-eclipse-city.jpg', level: 'eclipse', hour: 12,
    camera: { eye: [-2.5, 1.7, -17], target: [-16.1, 24.2, -113.5], fov: 48 }, traveller: { at: [1.6, 0, -28.4], heading: 3.32 },
    sky: { eclipse: { size: 2.4, el: 17 } } },
];

/** Is this a complete shot? Returns the list of what is wrong ([] when it is fine). */
export function shotProblems(s) {
  const out = [];
  const v3 = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
  if (!s || typeof s !== 'object') return ['not a shot'];
  if (!s.id) out.push('no id');
  if (!TITLES[s.level]) out.push(`unknown world ${s.level}`);
  if (s.hour !== undefined && !(s.hour >= 0 && s.hour < 24)) out.push(`hour ${s.hour}`);
  const cams = [['camera', s.camera], ...(s.portrait ? [['portrait', { ...s.camera, ...s.portrait }]] : [])];
  for (const [name, c] of cams) {
    if (!c) { out.push(`no ${name}`); continue; }
    if (!v3(c.eye)) out.push(`${name}.eye`);
    if (!v3(c.target)) out.push(`${name}.target`);
    if (!(c.fov > 10 && c.fov < 100)) out.push(`${name}.fov ${c.fov}`);
    if (v3(c.eye) && v3(c.target) && Math.hypot(c.eye[0] - c.target[0], c.eye[1] - c.target[1], c.eye[2] - c.target[2]) < 1) out.push(`${name} looks at itself`);
  }
  for (const p of s.sky?.planets ?? []) if (![p.az, p.el, p.size].every(Number.isFinite)) out.push('sky.planets');
  if (s.traveller !== null && s.traveller !== undefined) {
    if (!v3(s.traveller.at)) out.push('traveller.at');
    if (!Number.isFinite(s.traveller.heading ?? 0)) out.push('traveller.heading');
  }
  return out;
}

const D = Math.PI / 180;
/**
 * The camera for a screen of this shape (width / height): the shot's own at 16:9 and wider (the
 * height kept: more of the sides); narrower, the vertical field opens to keep the cover's width
 * (all of it down to 4:3, less on a screen held upright, where the shot's portrait framing wins).
 * Returns { eye, target, fov, roll }.
 */
export function shotCamera(shot, aspect = REF_ASPECT) {
  const c = shot.camera;
  if (aspect < 0.95) {
    if (shot.portrait) return { roll: 0, ...c, ...shot.portrait };
    return portraitFrom(shot, aspect);
  }
  let fov = c.fov;
  if (aspect < REF_ASPECT) {
    const half = Math.atan(Math.tan((c.fov * D) / 2) * REF_ASPECT);   // the cover's horizontal half-field
    const need = (2 * Math.atan(Math.tan(half) / aspect)) / D;
    // (a square screen keeps a little less than all of it: the corners would stretch)
    const keep = aspect >= 4 / 3 ? 1 : 0.6 + 0.4 * ((aspect - 0.95) / (4 / 3 - 0.95));
    fov = Math.min(c.fov + (need - c.fov) * keep, 88);
  }
  return { roll: 0, ...c, fov };
}

/**
 * A screen held upright without a framing of its own: the same eye, the view turned part of the way
 * toward the traveller (he stays in it), the field a little wider.
 */
function portraitFrom(shot, aspect) {
  const c = shot.camera, [ex, ey, ez] = c.eye;
  let [tx, ty, tz] = c.target;
  if (shot.traveller) {
    const [px, , pz] = shot.traveller.at;
    const a0 = Math.atan2(tx - ex, tz - ez), a1 = Math.atan2(px - ex, pz - ez);
    let da = a1 - a0;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const a = a0 + da * 0.75, r = Math.hypot(tx - ex, tz - ez);
    tx = ex + Math.sin(a) * r; tz = ez + Math.cos(a) * r;
  }
  const fov = Math.min(c.fov * 1.25, 72);
  // (the view slid up a little: the traveller between the name above and the menu below)
  return { roll: 0, ...c, target: [tx, ty, tz], fov, shiftY: 0.14 };
}

/**
 * The shot to show this time: any shot but the last one shown, the worlds a save has reached
 * three times as likely (a new player may see any: they are the title's art).
 * @param o.last     the id shown last time (LAST_SHOT_KEY)
 * @param o.reached  level ids the saves have reached
 * @param o.rng      () => [0, 1)
 */
export function pickShot(shots = SHOTS, { last = null, reached = [], rng = Math.random } = {}) {
  const pool = shots.length > 1 ? shots.filter((s) => s.id !== last) : shots.slice();
  if (!pool.length) return null;
  const seen = new Set(reached);
  const weights = pool.map((s) => (seen.has(s.level) ? 3 : 1));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r < 0) return pool[i]; }
  return pool[pool.length - 1];
}

/** A shot by id (?shot=<id>, the authoring tools), or null. */
export const shotById = (id, shots = SHOTS) => shots.find((s) => s.id === id) ?? null;

/**
 * The shot this opening shows: ?shot=<id> (the authoring tools; not remembered), else pickShot with the
 * last one shown (read from and written to `storage`, LAST_SHOT_KEY) and the worlds the saves are in.
 * @param o.storage  localStorage (or a look-alike; null: nothing remembered)
 * @param o.search   location.search
 * @param o.saves    the save selector's list (src/save-slots.js list(): { empty, level })
 */
export function chooseShot({ storage = null, search = '', saves = [], shots = SHOTS, rng = Math.random } = {}) {
  const asked = new URLSearchParams(search).get('shot');
  if (asked && shotById(asked, shots)) return shotById(asked, shots);
  let last = null;
  try { last = storage?.getItem(LAST_SHOT_KEY) ?? null; } catch { /* private mode */ }
  const reached = saves.filter((s) => s && !s.empty && s.level).map((s) => s.level);
  const shot = pickShot(shots, { last, reached, rng });
  try { if (shot) storage?.setItem(LAST_SHOT_KEY, shot.id); } catch { /* full */ }
  return shot;
}
