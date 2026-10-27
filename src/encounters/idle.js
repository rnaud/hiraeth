// The life a foe lives at its site before the fight (issue #722; docs/systems/foes.md, "Encounter sites"): sitting
// round a fire, asleep in a nest, standing guard, keeping a lookout, walking a beat, circling its post (a flyer). A
// foe of a site carries one (f.idle, src/encounters/index.js); src/foes.js asks it, while the foe is calm and not
// provoked, what it does and whether it has noticed you (Foe.update's idle case), and how much a cut on it is worth
// (Foe.hit: a sleeping one takes a sneak strike). Its body's rest (lowered onto its legs, head down, breathing) is
// restPose's, laid on the body as a hit's reaction is (src/foe-react.js applyReact's `extra`).
//
//   const idle = makeIdle('sleep', { face, path, rng })
//   idle.calm(f, dt, P, d, env) → true once it has noticed you (then the fight is the foe's own)
//   idle.sneak(f) → the blade's factor on a foe still calm (3 asleep, else 1)
//   restPose(f, dt) → { y, pitch, roll, sx, sy } or null

/** Each idle's tuning: how near it notices you (× its kind's own calm distance, `min` to `max` m: a tripod's own 20 m
 *  would see you from across the map), its turn about (scan, rad). */
export const IDLE = {
  sit: { k: 0.8, min: 4, max: 8, low: 0.2, pitch: 0.12 },
  sleep: { near: 2.4, run: 6, speed: 5.5, low: 0.3, pitch: 0.2, roll: 0.14, sneak: 3, breathe: 1.5 },
  guard: { k: 1.2, min: 8, max: 12, scan: 0.55, rate: 0.35 },
  lookout: { k: 1.6, min: 14, max: 18, scan: 1.15, rate: 0.28 },
  patrol: { k: 1, min: 7, max: 12, speed: 0.35, wait: 1.6 },
  orbit: { k: 1, min: 6, max: 10, r: 2.4, rate: 0.35 },
  hidden: { k: 0, min: 0 },
};
/** The foes that wake the camp: a lookout, a guard or a patrol that notices you calls the rest (src/encounters/index.js). */
export const CALLS = new Set(['lookout', 'guard', 'patrol']);

const lostFor = (P, f) => P.dead || !!P.ride || !!P.veiled || Math.abs(P.pos.y - f.level) >= 6 || !!P.down;

/** An idle of `mode`: o.face [x, z] (what a sitter faces), o.path [[x, z], [x, z]] (a patrol's beat), o.heading (a guard's way). */
export function makeIdle(mode, o = {}) {
  const T = IDLE[mode] ?? IDLE.guard, rng = o.rng ?? Math.random;
  const I = {
    mode, t: rng() * 10, leg: 0, wait: 0, rest: 0, heading: o.heading ?? 0, face: o.face ?? null, path: o.path ?? null,
    /** How near it notices you (m), by its kind's own calm distance. */
    reach(f) { const base = f.def.calm?.provoke ?? f.def.sight * 0.4; return mode === 'sleep' ? T.near : Math.min(T.max ?? Infinity, Math.max(T.min, base * T.k)); },
    sneak() { return mode === 'sleep' ? T.sneak : 1; },
    calm(f, dt, P, d, env) {
      I.t += dt;
      const D = f.def;
      if (mode === 'patrol' && I.path) {
        // end to end along its beat, a short wait at each end, looking along it
        const to = I.path[I.leg % I.path.length];
        if (I.wait > 0) { I.wait -= dt; if (I.wait <= 0) I.leg++; }
        else if (Math.hypot(to[0] - f.pos.x, to[1] - f.pos.z) < 0.45) I.wait = T.wait;
        else f.walkTo(to[0], to[1], D.speed * T.speed, dt, env);
      } else if (mode === 'orbit') {
        // a flyer at its post: slow rounds over it
        const a = I.t * T.rate;
        f.walkTo(f.home.x + Math.sin(a) * T.r, f.home.z + Math.cos(a) * T.r, D.speed * 0.25, dt, env);
      } else {
        // at its post (put back if it was shoved off), facing its way: the fire, or out, turning to look about
        if (Math.hypot(f.home.x - f.pos.x, f.home.z - f.pos.z) > 0.6) f.walkTo(f.home.x, f.home.z, D.speed * 0.3, dt, env);
        else {
          const want = I.face ? Math.atan2(I.face[0] - f.pos.x, I.face[1] - f.pos.z) : I.heading + (T.scan ? Math.sin(I.t * T.rate) * T.scan : 0);
          f.face(Math.sin(want), Math.cos(want), dt, mode === 'sleep' ? 0.5 : 2);
        }
      }
      if (mode === 'hidden' || lostFor(P, f)) return false;
      // asleep: only right beside it, or someone running up close, wakes it; awake: you, within its reach and in its sight
      if (mode === 'sleep') {
        const speed = Math.hypot(P.vel?.x ?? 0, P.vel?.z ?? 0);
        return d < T.near || (d < T.run && speed > T.speed);
      }
      return d < I.reach(f) && (env.seen?.(f.chest, P.pos) ?? true);
    },
  };
  return I;
}

/**
 * Its body at rest this frame (eased in while it rests, out as it wakes): lowered onto its legs (a body with no legs to
 * bend squashes instead), its head down, asleep a little rolled over and breathing. Null when nothing is left of it.
 */
export function restPose(f, dt, out = {}) {
  const I = f.idle, mode = I?.mode, T = IDLE[mode];
  const resting = !!I && !f.provoked && f.state === 'idle' && (mode === 'sit' || mode === 'sleep');
  I && (I.rest = Math.max(0, Math.min(1, I.rest + (resting ? dt * 1.5 : -dt * 4))));
  const k = I?.rest ?? 0;
  if (k <= 0.001) return null;
  const legs = !!f.model?.rig, h = f.def.height ?? 1;
  const breathe = mode === 'sleep' ? Math.sin((I.t ?? 0) * T.breathe * Math.PI * 2 / 3) : Math.sin((I.t ?? 0) * 1.3) * 0.3;
  out.y = -T.low * h * k * (legs ? 1 : 0.3);
  out.pitch = (T.pitch + (mode === 'sit' ? 0.04 * breathe : 0)) * k;
  out.roll = (T.roll ?? 0) * k;
  out.sx = 1 + (legs ? 0 : 0.08 * k);
  out.sy = 1 - (legs ? 0.03 : 0.16) * k + 0.025 * k * breathe;
  return out;
}
