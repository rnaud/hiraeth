// The sketch hunt's rules (src/minigames/sketchhunt.js, docs/systems/minigames.md), pure: how well a subject
// sits in a sketch's frame (how much of it the subject fills, how near the middle it is, whether it is seen
// from the side the list asks for), the list drawn from a pool so it changes every time, and the score.
// Plain { x, y, z } vectors in, numbers out: the tests check them without a scene (tests/minigames.test.js).
//
//   frameScore(view, { c, r }, subject)   // 0..1, with what made it: { q, fill, centre, angle, nx, ny, size }
//   pickList(pool, rng, 6)                // six subjects, of different kinds, none twice
//   huntScore(sketches, secondsLeft, 6)   // { base, bonus, total }

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const len = (a) => Math.hypot(a.x, a.y, a.z);
const unit = (a) => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

/** How the sketch is judged: the share of the frame's height a subject should fill (its default), the softness of each part. */
export const FRAMING = {
  fill: 0.6,       // the subject's size (its radius over half the frame's height): 0.6, it spans 60 % of the frame's height
  fillSoft: 0.75,  // (on a log scale: half or twice the size keeps ~0.4)
  centre: 0.62,    // how far from the middle (in half-frames) before the centre's score falls to a third
  min: 0.28,       // below this the sketch is not of that subject at all
  angleSoft: 30,   // degrees past the side asked for over which the angle's score falls to nothing
};

/**
 * A subject in a view. view: { eye, fwd, up, fov (vertical, degrees), aspect }; target: { c (its middle), r (its
 * radius) }; subject: { fill?, from?: { dir (unit, from the subject toward where the eye should be), within
 * (degrees) }, eye?: (eye) => bool (where you must stand) }. Returns q (0..1) and its parts; q 0 when it is
 * behind you or out of the frame. (from: 'normal' asks for each target's own side: target.n, within subject.within.)
 */
export function frameScore(view, target, subject = {}, F = FRAMING) {
  const v = sub(target.c, view.eye), dist = len(v);
  const fwd = unit(view.fwd), right = unit(cross(fwd, view.up)), up = cross(right, fwd);
  const depth = dot(v, fwd);
  const none = { q: 0, fill: 0, centre: 0, angle: 0, nx: 0, ny: 0, size: 0, dist };
  if (depth <= Math.max(0.2, target.r * 0.3)) return none;
  const tv = Math.tan((view.fov * Math.PI) / 360), th = tv * (view.aspect ?? 1);
  const nx = dot(v, right) / depth / th, ny = dot(v, up) / depth / tv;
  // its size: the angle it spans, as a share of the frame's height
  const half = Math.asin(Math.min(1, target.r / Math.max(dist, 1e-6)));
  const size = Math.tan(half) / tv;
  // (out of the frame: its middle off the page, or the frame entirely inside it)
  if (Math.abs(nx) > 1 + size * 0.5 || Math.abs(ny) > 1 + size * 0.5) return { ...none, nx, ny, size };
  const want = subject.fill ?? F.fill;
  const fill = Math.exp(-((Math.log(Math.max(size, 1e-4) / want) / F.fillSoft) ** 2));
  const d = Math.hypot(nx, ny);
  const centre = Math.exp(-((d / F.centre) ** 2) * 1.1);
  let angle = 1;
  // (from: 'normal' is each target's own side, target.n: a screen seen square on)
  const from = subject.from === 'normal' ? (target.n ? { dir: target.n, within: subject.within ?? 24 } : null) : subject.from;
  if (from) {
    const toEye = unit(sub(view.eye, target.c));
    const a = (Math.acos(Math.max(-1, Math.min(1, dot(toEye, unit(from.dir))))) * 180) / Math.PI;
    angle = a <= from.within ? 1 : Math.max(0, 1 - (a - from.within) / F.angleSoft);
  }
  if (subject.eye && !subject.eye(view.eye)) angle *= 0.15;
  const q = Math.max(0, Math.min(1, fill * centre ** 0.8 * angle));
  return { q, fill, centre, angle, nx, ny, size, dist };
}

/** A sketch's word: what the page says under it. */
export const verdict = (q) => (q >= 0.85 ? 'a fine likeness' : q >= 0.65 ? 'a good sketch' : q >= 0.45 ? 'a fair sketch' : q >= FRAMING.min ? 'a rough sketch' : 'not recognisable');

/** Stars for a sketch (1..3), for the list and the page. */
export const stars = (q) => (q >= 0.8 ? 3 : q >= 0.55 ? 2 : q >= FRAMING.min ? 1 : 0);

/**
 * Six subjects (n) from the pool: of as many kinds as there are (an animal, a plant, people, a landmark…), the
 * kinds taken in turn so the list mixes them, none twice; `ok(s)` leaves out what this world can't show now.
 * rng: () => 0..1 (Math.random, or a seeded one for the tests).
 */
export function pickList(pool, rng = Math.random, n = 6, ok = () => true) {
  const byKind = new Map();
  for (const s of pool) if (ok(s)) { if (!byKind.has(s.kind)) byKind.set(s.kind, []); byKind.get(s.kind).push(s); }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const kinds = shuffle([...byKind.keys()]).map((k) => shuffle([...byKind.get(k)]));
  // (the people's kind first in the order when there is one: a person doing something is always on the list)
  kinds.sort((a, b) => (b[0].kind === 'person') - (a[0].kind === 'person'));
  const out = [];
  while (out.length < n && kinds.some((k) => k.length)) for (const k of kinds) { if (out.length < n && k.length) out.push(k.shift()); }
  return out;
}

/** The hunt's score: each subject's best sketch (q × 100), and the time left (×2 a second) when the whole list is done. */
export function huntScore(sketches, secondsLeft, n = 6) {
  const done = sketches.filter((s) => s && s.q >= FRAMING.min);
  const base = done.reduce((a, s) => a + Math.round(s.q * 100), 0);
  const bonus = done.length >= n ? Math.round(Math.max(0, secondsLeft) * 2) : 0;
  return { base, bonus, total: base + bonus, found: done.length };
}

/**
 * The best of a subject's targets in a view: each scored, the best few in turn asked whether they can be seen
 * (`seen`: a ray, say; at most `rays` of them), the first seen kept. Returns { t, s } or null.
 */
export function bestTarget(view, targets, subject, seen = () => true, rays = 4) {
  const scored = [];
  for (const t of targets) { const s = frameScore(view, t, subject); if (s.q > 0.02) scored.push({ t, s }); }
  scored.sort((a, b) => b.s.q - a.s.q);
  for (let i = 0; i < Math.min(rays, scored.length); i++) if (seen(scored[i].t)) return scored[i];
  return null;
}
