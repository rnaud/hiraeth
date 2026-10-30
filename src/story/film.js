import * as THREE from 'three';
import { faceOf } from './moment.js';

// Pieces the worlds' moments share (src/story/moment.js; the desert's two in desert-moments.js
// keep their own copies, written first): where the traveller's face is, which way he faces,
// a close-up on it that never swings, and plain camera moves round a point. Each world's moments
// are in src/story/<world>-moments.js and listed in WORLD_MOMENTS below (tests/world-moments.test.js
// holds every one to it: registered, short, once per save, skippable).

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const UP = V(0, 1, 0);
export const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const _f = V(0, 0, 0);

/**
 * Every world's climax, filmed: { world: [{ id, flag, beat }] } (`beat`: what it shows, for the docs
 * and the tests). The moment's own module plays it with exactly this id and flag.
 */
export const WORLD_MOMENTS = {
  desert: [
    { id: 'desert.flow', flag: 'desert.moment.flow', beat: 'the water runs for the first time' },
    { id: 'desert.fill', flag: 'desert.moment.fill', beat: 'the empty battery fills' },
    { id: 'desert.font', flag: 'desert.moment.font', beat: 'the lever pulled in the Rose House’s Font Room: the pool fills round him, the battery with it, and the makers’ mark lights' },
    { id: 'desert.lit', flag: 'desert.moment.lit', beat: 'the great tree catches, seen from the roots out to the whole of it over the city' },
  ],
  arzach: [{ id: 'arzach.bird', flag: 'arzach.moment.bird', beat: 'the bird comes down out of the haze and bows' }],
  arzach2: [{ id: 'arzach2.bell', flag: 'arzach2.moment.bell', beat: 'the bell rings after thirty years and the cloud settles' }],
  perdide: [{ id: 'perdide.crystal', flag: 'perdide.moment.crystal', beat: 'the cave sings the light’s phrase back to the splinter' }],
  perdide2: [{ id: 'perdide2.pools', flag: 'perdide2.moment.pools', beat: 'the last dark pool is lit and the saucer blinks back across the water' }],
  edena: [{ id: 'edena.terraces', flag: 'edena.moment.terraces', beat: 'the cistern gate gives way and the flood takes the terraces' }],
  incal: [{ id: 'incal.lodestar', flag: 'incal.moment.lodestar', beat: 'the Lodestar lights again over the shaft' }],
  garage: [{ id: 'garage.signal', flag: 'garage.moment.signal', beat: 'the signal is read through the ring’s slit' }],   // (the Sealed Hangar's, dismissed: kept with its world)
  glassdunes: [{ id: 'glassdunes.clock', flag: 'glassdunes.moment.clock', beat: 'the clock over the Clock-House comes round and keeps time, and the great cogs turn in the sand' }],
  buried: [{ id: 'buried.wheel', flag: 'buried.moment.wheel', beat: 'the great wheel turns, and goes on turning' }],
  spheres: [{ id: 'spheres.chord', flag: 'spheres.moment.chord', beat: 'the pole rings with the three spheres’ chord' }],
  bazaar: [{ id: 'bazaar.broadcast', flag: 'bazaar.moment.broadcast', beat: 'the silent tower broadcasts again' }],
  // (the three worlds that joined the route in v1.40)
  underwater: [{ id: 'underwater.whales', flag: 'underwater.moment.whales', beat: 'the whales come back to the glass and sing, the light’s note first' }],
  moonfoundry: [{ id: 'moonfoundry.moon', flag: 'moonfoundry.moment.moon', beat: 'the last moon is lifted out of its mould onto a hook, and every hung moon turns to it' }],
  spacecity: [{ id: 'spacecity.cables', flag: 'spacecity.moment.cables', beat: 'the cables draw taut and the islands come home together, lamps running along them' }],
};
/** The one entry for a moment id (its flag). */
export const momentDef = (id) => Object.values(WORLD_MOMENTS).flat().find((m) => m.id === id) ?? null;

/** Where the traveller's face is (his head bone, else up from his feet). */
export function faceAt(player, out = V(0, 0, 0)) {
  const head = player.humanoid?.b?.Head;
  if (head && player.object?.visible !== false) return head.getWorldPosition(out).addScaledVector(UP, 0.06);
  return out.copy(player.pos).addScaledVector(UP, 1.62);
}
/** The way he faces, flat. */
export function facing(player, out = V(0, 0, 0)) {
  return (player.frame?.dir ? player.frame.dir(player.heading, out) : out.set(Math.sin(player.heading), 0, Math.cos(player.heading))).setY(0).normalize();
}
export const rightOf = (f, out = V(0, 0, 0)) => out.set(-f.z, 0, f.x);
/** A flat direction turned by `a` radians about up. */
export const turn = (v, a) => V(v.x * Math.cos(a) + v.z * Math.sin(a), 0, -v.x * Math.sin(a) + v.z * Math.cos(a));

/**
 * A close-up on his face, `angle` off the way it looks (a three-quarter view), framed off the head as
 * posed (faceOf), its turn followed slowly so the panel never swings; it pushes in over `dur`.
 * Returns a frame function for a shot's `from` (use `clear: false` on that shot).
 */
export function closeUp(player, { angle = 0.5, dur = 2.5, dist = 1.4, push = 0.2, fov = 36, drop = 0.08 } = {}) {
  const sm = { t: -1, fwd: V(0, 0, 1) }, F0 = { pos: V(0, 0, 0), fwd: V(0, 0, 0) };
  return (t) => {
    const F = faceOf(player.humanoid, F0);
    const at = F ? F.pos.clone() : faceAt(player, V(0, 0, 0));
    const want = F && Math.hypot(F.fwd.x, F.fwd.z) > 0.3 ? V(F.fwd.x, 0, F.fwd.z).normalize() : facing(player, _f).clone();
    if (sm.t < 0 || t < sm.t) sm.fwd.copy(want); else sm.fwd.lerp(want, 1 - Math.exp(-1.5 * (t - sm.t))).normalize();
    sm.t = t;
    const k = smooth(t / dur);
    return { pos: at.clone().addScaledVector(turn(sm.fwd, angle), dist - push * k).addScaledVector(UP, -drop), look: at.clone().addScaledVector(UP, -0.06), fov: fov - 2 * k };
  };
}

/**
 * A slow arc round `at` (a Vector3 or a function): from `a0` to `a1` radians (0: the +z side),
 * `r` out and `h` up, looking at it `lookUp` above. A frame function for a shot's `from`.
 */
export function orbit({ at, r = 10, h = 4, a0 = 0, a1 = 0.4, dur = 3, lookUp = 0, fov = 46, fov1 = fov, ease = smooth }) {
  return (t) => {
    const c = typeof at === 'function' ? at() : at, k = ease(t / dur), a = a0 + (a1 - a0) * k;
    return { pos: V(c.x + Math.sin(a) * r, c.y + h, c.z + Math.cos(a) * r), look: V(c.x, c.y + lookUp, c.z), fov: fov + (fov1 - fov) * k };
  };
}

/** A frame `dist` back from `at` along the flat direction `dir` (and `h` up), looking at `at` + `lookUp`. */
export function from(at, dir, { dist = 8, h = 3, side = 0, lookUp = 0, fov = 46 } = {}) {
  const d = V(dir.x, 0, dir.z).normalize(), r = rightOf(d);
  return { pos: at.clone().addScaledVector(d, dist).addScaledVector(r, side).addScaledVector(UP, h), look: at.clone().addScaledVector(UP, lookUp), fov };
}

/**
 * A long lens up at something in the sky that keeps the horizon at the frame's foot: the look is
 * pitched down from `target` until the horizon (level with `eye`, far off) sits `foot` of the way down
 * the lower half of the frame, but never so far that `target` leaves the upper `top` of it (both inside
 * the letterbox, which covers about a fifth of each half). `fov` is widened (to `max` at most) when both can't fit. Returns { look, fov } (degrees). (Vael's panel B:
 * looking straight at her it was two seconds of plain sky with a speck: the QC pass.)
 */
export function riseLook(eye, target, fov, { top = 0.5, foot = 0.62, max = 48 } = {}) {
  const dx = target.x - eye.x, dz = target.z - eye.z, flat = Math.hypot(dx, dz) || 1e-6;
  const dist = Math.hypot(flat, target.y - eye.y);
  const up = Math.atan2(target.y - eye.y, flat), D = Math.PI / 180;
  if (up > 0) fov = Math.min(max, Math.max(fov, (2 * up) / (top + foot) / D));
  const h = (fov / 2) * D;
  const el = Math.max(Math.min(up, foot * h), up - top * h);
  const c = Math.cos(el) * dist;
  return { look: V(eye.x + (dx / flat) * c, eye.y + Math.sin(el) * dist, eye.z + (dz / flat) * c), fov };
}

const _rc = new THREE.Raycaster();
/**
 * Can a lens at `pos` see `at`? False when a solid or a drawn surface stands between them, short of the subject's own
 * `near` m round `at` (its own façade, a jib over its door: the subject, not in its way). `physics` (the colliders,
 * both sides: a lens inside a solid meets its back face at once) and `roots` (drawn meshes the colliders don't all
 * follow: a house's skin, its floating plates; nothing hidden or see-through), each optional; `skip`: objects that
 * never block (the subject's own mesh, him).
 */
export function sightClear(pos, at, { physics = null, roots = [], near = 3, skip = [] } = {}) {
  const d = pos.distanceTo(at) - near;
  if (d <= 0.3) return true;
  const dir = V(at.x - pos.x, at.y - pos.y, at.z - pos.z).normalize();
  if (physics?.rayDistance && physics.rayDistance(pos, dir, d) < d) return false;
  if (!roots.length) return true;
  _rc.set(pos, dir); _rc.near = 0; _rc.far = d;
  const shown = (o) => { for (let q = o; q; q = q.parent) if (!q.visible || skip.includes(q)) return false; return true; };
  for (const h of _rc.intersectObjects(roots.filter(Boolean), true)) {
    const mat = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
    if (h.object.isMesh && !mat?.transparent && mat?.visible !== false && shown(h.object)) return false;
  }
  return true;
}

/** Turns tried (radians, the smallest first) and lifts (m) when a shot is blocked: clearShot. */
export const CLEAR_TURNS = [0, 0.26, -0.26, 0.52, -0.52, 0.79, -0.79, 1.05, -1.05, 1.31, -1.31, 1.57, -1.57];
export const CLEAR_LIFTS = [0, 4, 8];

/**
 * A shot of frames `{ from, to? }` (not functions) kept seeing its subject: each end's lens and the middle of its move
 * are checked (sightClear, to `subject` or the look); when one is blocked, the whole move is swung round the subject's
 * upright by the smallest turn (CLEAR_TURNS) and, failing that, lifted (CLEAR_LIFTS) until all three see it. Its
 * frames turn as one (lens and look), so the subject keeps its place in the frame. A house rebuilt round a lens set
 * by hand (the Moon Foundry's and the floating city's climaxes filmed walls: the cinematics QC, v1.85, #491) then
 * moves the shot, not the picture into a wall. Returns a new shot (`clear: false`: checked here; `cleared`: the turn
 * and lift used), or the shot as it was when nothing clears (the moment's own pull-in still applies).
 */
export function clearShot(shot, { subject = null, ...o } = {}) {
  const ends = [shot.from, shot.to ?? shot.from];
  const at = (f) => subject ?? f.look;
  const c = subject ?? ends[0].look;
  const swing = (p, a, lift) => {
    const x = p.x - c.x, z = p.z - c.z, s = Math.sin(a), k = Math.cos(a);
    return V(c.x + x * k + z * s, p.y + lift, c.z - x * s + z * k);
  };
  for (const lift of CLEAR_LIFTS) for (const a of CLEAR_TURNS) {
    const fr = ends.map((f) => ({ ...f, pos: swing(f.pos, a, lift), look: swing(f.look, a, lift * 0.5) }));
    const mid = { pos: fr[0].pos.clone().lerp(fr[1].pos, 0.5), look: fr[0].look.clone().lerp(fr[1].look, 0.5) };
    if (![fr[0], mid, fr[1]].every((f) => sightClear(f.pos, subject ? at(f) : f.look, o))) continue;
    if (!a && !lift) return { ...shot, clear: false, cleared: { turn: 0, lift: 0 } };
    return { ...shot, from: fr[0], ...(shot.to ? { to: fr[1] } : {}), clear: false, cleared: { turn: a, lift } };
  }
  return shot;
}

/**
 * How far past `at`, seen from `pos`, the first surface behind it stands (the backdrop's distance; Infinity: open
 * sky or far off): physics' colliders and `roots`' drawn meshes, as sightClear.
 */
export function backdrop(pos, at, { physics = null, roots = [], far = 40 } = {}) {
  const dir = V(at.x - pos.x, at.y - pos.y, at.z - pos.z).normalize(), from = at.clone().addScaledVector(dir, 0.6);
  let d = physics?.rayDistance ? physics.rayDistance(from, dir, far) : Infinity;
  if (roots.length) {
    _rc.set(from, dir); _rc.near = 0; _rc.far = Math.min(far, d);
    const h = _rc.intersectObjects(roots.filter(Boolean), true).find((x) => {
      const mat = Array.isArray(x.object.material) ? x.object.material[0] : x.object.material;
      if (!x.object.isMesh || mat?.transparent || mat?.visible === false) return false;
      for (let q = x.object; q; q = q.parent) if (!q.visible) return false;
      return true;
    });
    if (h) d = Math.min(d, h.distance);
  }
  return d >= far ? Infinity : d + 0.6;
}

/**
 * closeUp, its side picked when the panel starts: of `angles` (the first is the one wanted), the first whose
 * backdrop behind his face is at least `open` m off, else the farthest. Beside a house's wall, a three-quarter face
 * against the wall was half a dark wall (the Moon Foundry's climax: the cinematics QC, v1.85, #491); the other side
 * of him, or a little more round, has the floor and the sky behind. `sight`: { physics, roots } (backdrop).
 */
export function openCloseUp(player, { angles = [0.5, -0.5, 0.9, -0.9], open = 12, sight = {}, ...o } = {}) {
  const shots = angles.map((angle) => closeUp(player, { ...o, angle }));
  let pick = null;
  return (t) => {
    if (!pick) {
      let best = -1;
      for (const s of shots) {
        const f = s(0), d = backdrop(f.pos, f.look, sight);
        if (d >= open) { pick = s; break; }
        if (d > best) { best = d; pick = s; }
      }
    }
    return pick(t);
  };
}
