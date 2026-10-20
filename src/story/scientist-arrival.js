import * as THREE from 'three';

// Anselm Thrum's arrival, filmed (issue #550: "The first time I pick up a fragment of light there should be a cinematic
// for Anselm to show up, not just immediately appearance"). src/story/scientist.js plays it on the first fragment, in
// whatever world that is, on the world's moment stage (src/story/moment.js: letterboxed, skippable with B / ○, Menu,
// Esc or a tap on the corner tag, once per save):
//
//   A  the traveller, three-quarter from the front: the box's ticking, and he turns toward it          ARRIVAL.A s
//   B  over his shoulder: the thin man in the patched coat runs in from where he was hidden (over a
//      rise, out of the ship's way, round a wall), the tick quickening as he comes            the run, ~2.5–4.5 s
//   C  side on, the two of them: he slows, stops a few steps off, bent over, out of breath            ARRIVAL.C s
//
// then the talk opens (his "Don't drop it!"). Where he comes from: `arrivalFrom` looks round the spot he will stop on
// (meetSpot's) for a start ARRIVAL.dist m off, over walkable ground all the way (no step he couldn't take, no wall, no
// water, nothing unsafe), out of the traveller's sight if it can (behind a crest or a wall), toward the ship if it is in
// this world; none at all (a narrow ledge, a deck high up), and he comes up beside you as he always did, unfilmed.
// Skipped or failed, he is put on his spot and the talk opens just the same.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

export const ARRIVAL = {
  id: 'thrum.arrival',
  flag: 'thrum.arrival',     // the save's: filmed once (and only ever on the first fragment: frag.met follows it)
  dist: [24, 20, 16, 12, 9], // m: how far off he starts, the farthest that has a way in
  dirs: 16,                  // directions tried round his spot
  step: 0.8,                 // m between two checks of the ground on his way in
  climb: 0.75,               // m: the most the ground may rise or fall between two of them
  run: 5.2,                  // m/s: his run
  slow: 1.1,                 // m/s per m left: he slows as he comes up (to a walk in the last metre)
  near: 0.35,                // m: arrived
  A: 1.4,                    // s: the traveller hears the tick
  C: 2.3,                    // s: the two-shot, him winded
  cutBefore: 0.7,            // s before he stops that the two-shot comes in
  windedFor: 3.5,            // s he stays bent over, catching his breath, once the talk is open
};

/** His speed with `left` m to go: the run, easing to a walk over the last metres. */
export const runSpeed = (left, A = ARRIVAL) => Math.max(0.9, Math.min(A.run, 0.9 + left * A.slow));

/** Seconds his run takes over `d` m (the speed above, stepped). */
export function runTime(d, A = ARRIVAL) {
  let left = d, t = 0;
  const dt = 1 / 60;
  while (left > A.near && t < 30) { left -= runSpeed(left, A) * dt; t += dt; }
  return t;
}

/**
 * The way in, from `from` to `to`, checked a step at a time: the ground there (no drop, no wall to it), each step a rise
 * or fall he can take, no wall across it at his chest, nothing unsafe. → the ground's heights, or null.
 */
export function wayIn({ physics, level }, from, to, A = ARRIVAL) {
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  const n = Math.max(1, Math.ceil(d / A.step));
  const dir = V(to.x - from.x, 0, to.z - from.z).normalize();
  let prev = to.y;
  const ys = [];
  // (walked backward from his spot, whose ground is known, out to the start)
  for (let k = 0; k <= n; k++) {
    const f = 1 - k / n, x = from.x + (to.x - from.x) * f, z = from.z + (to.z - from.z) * f;
    const g = physics.groundAt(x, prev + 2.2, z, 6);
    if (!Number.isFinite(g) || Math.abs(g - prev) > A.climb + (k ? 0 : 0.6)) return null;
    if (Number.isFinite(level?.killY) && g < level.killY) return null;
    const p = V(x, g, z);
    if (level?.unsafe?.(p)) return null;
    if (physics.rayDistance(V(x, g + 0.3, z), UP, 2) < 1.9) return null;   // (room to run upright)
    if (k && physics.rayDistance(V(x, Math.max(g, prev) + 1.0, z), dir, d / n) < d / n) return null;   // (no wall between this step and the last)
    ys.push(g);
    prev = g;
  }
  return ys.reverse();
}

/** How near the line from a to b passes to p, across the ground (m). */
export function segmentNear(a, b, p) {
  const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz;
  const k = L > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L)) : 0;
  return Math.hypot(a.x + dx * k - p.x, a.z + dz * k - p.z);
}

/** Is a point (his head at the start) out of the traveller's sight from `eye`: a wall, a rock, a crest of the ground between? */
export function hidden(physics, eye, head) {
  const to = head.clone().sub(eye), d = to.length();
  if (d < 1) return false;
  to.divideScalar(d);
  if (physics.rayDistance(eye, to, d) < d - 0.5) return true;
  const base = physics.base;
  if (!base?.heightAt) return false;
  for (let k = 1; k < 12; k++) {
    const p = eye.clone().addScaledVector(to, (d * k) / 12);
    if (base.heightAt(p.x, p.z) > p.y + 0.2) return true;
  }
  return false;
}

/**
 * Where he comes from: { at, ys, dist, hidden } (the start on the ground, the way in's heights), or null when there is
 * no way in from ARRIVAL.dist's nearest. `meet` his spot beside the traveller, `eye` the traveller's eyes, `toward` the
 * ship (or null): a way from out of sight first, then the farthest, then the one from the ship's side. Never a way through
 * the traveller (his feet under `eye`): he comes up to you, not through you.
 */
export function arrivalFrom({ physics, level, meet, eye, toward = null }, A = ARRIVAL) {
  if (!physics || !meet) return null;
  let best = null;
  const shipDir = toward ? V(toward.x - meet.x, 0, toward.z - meet.z) : null;
  if (shipDir && shipDir.lengthSq() > 1) shipDir.normalize();
  for (let k = 0; k < A.dirs; k++) {
    const a = (k / A.dirs) * Math.PI * 2, dir = V(Math.sin(a), 0, Math.cos(a));
    for (const r of A.dist) {
      const g0 = physics.groundAt(meet.x + dir.x * r, meet.y + 8, meet.z + dir.z * r, 20);
      if (!Number.isFinite(g0)) continue;
      const at = V(meet.x + dir.x * r, g0, meet.z + dir.z * r);
      if (eye && segmentNear(at, meet, eye) < 2.9) continue;   // (not past you at arm’s length either: round to his spot)
      const ys = wayIn({ physics, level }, at, meet, A);
      if (!ys) continue;
      at.y = ys[0];
      const out = hidden(physics, eye ?? meet.clone().addScaledVector(UP, 1.6), at.clone().addScaledVector(UP, 1.6));
      const score = r + (out ? 10 : 0) + (shipDir?.lengthSq() > 0.5 ? 6 * dir.dot(shipDir) : 0);
      if (!best || score > best.score) best = { at, ys, dist: r, hidden: out, score };
      break;   // (the farthest way in this direction)
    }
  }
  return best;
}

/**
 * The panels (src/story/moment.js shots), for a run of `run` s from the moment's start: the traveller at `P` (his feet), the man's spot `M`, his
 * start `S`; `him()` his position now, `face()` the traveller's eyes. → { shots, dur, side }
 */
export function arrivalShots({ P, M, S, run, him, physics = null }, A = ARRIVAL) {
  const u = V(S.x - P.x, 0, S.z - P.z);
  if (u.lengthSq() < 1e-4) u.set(0, 0, 1);
  u.normalize();
  const r = V(-u.z, 0, u.x);
  const chest = (p, h = 1.35) => p.clone().addScaledVector(UP, h);
  const B = Math.max(1.4, run - A.A - A.cutBefore);   // (he runs from the first frame: the two-shot comes in just before he stops)
  // A: in front of him, a little to the side, toward where the ticking comes from: his face as he turns to it
  const aPos = P.clone().addScaledVector(u, 2.3).addScaledVector(r, 0.9).addScaledVector(UP, 1.55);
  const aLook = chest(P, 1.5);
  // B: over his shoulder (the side with room), the lens on the running man, eased (a long lens must not jerk)
  const clear = (side) => !physics?.rayDistance || physics.rayDistance(chest(P, 1.7), P.clone().addScaledVector(u, -2.6).addScaledVector(r, side).sub(P).setY(0.35).normalize(), 2.9) > 2.6;
  const side = clear(0.95) ? 0.95 : -0.95;
  const pan = { t: -1, look: V() };
  const bFrame = (t) => {
    const want = chest(him(), 1.3);
    if (pan.t < 0 || t < pan.t) pan.look.copy(want); else pan.look.lerp(want, 1 - Math.exp(-7 * (t - pan.t)));
    pan.t = t;
    const k = Math.min(1, t / B);
    return { pos: P.clone().addScaledVector(u, -2.6 - 0.4 * k).addScaledVector(r, side).addScaledVector(UP, 1.75), look: pan.look.clone(), fov: 38 + 6 * k };
  };
  // C: side on to the two of them, the side the lens has room on, at chest height
  const mid = P.clone().lerp(M, 0.5);
  const w = V(-(M.z - P.z), 0, M.x - P.x);
  if (w.lengthSq() < 1e-4) w.copy(r); else w.normalize();
  // (far enough off that both stand in the frame with room round them: half the gap and a body's width each side, in a
  // 16:9 frame's 40° lens; the cinema's bars take the rest)
  const sep = Math.hypot(M.x - P.x, M.z - P.z), cD = Math.min(9, Math.max(4.5, (sep / 2 + 1.4) / 0.6));
  // (a lens with a clear line to both of them, from the side, turned a little either way; in a tight place, a deck
  // between rails and posts, none: then over the traveller's shoulder onto the man, as the run's panel ends)
  const sees = (pos, to) => { const d = to.clone().sub(pos), L = d.length(); return physics.rayDistance(pos, d.divideScalar(L), L) > L - 0.4; };
  let C = null;
  for (const s of [1, -1]) for (const turn of [0, 0.35, -0.35, 0.7, -0.7]) {
    if (C) break;
    const dir = w.clone().multiplyScalar(s).applyAxisAngle(UP, turn);
    const pos = mid.clone().addScaledVector(dir, cD).addScaledVector(UP, 1.35);
    if (!physics?.rayDistance || (sees(chest(mid, 1.35), pos) && sees(pos, chest(P, 1.2)) && sees(pos, chest(M, 1.2)) && sees(pos, chest(P, 1.7)) && sees(pos, chest(M, 1.7)))) C = { pos, dir };
  }
  const cShot = C
    ? { dur: A.C, from: { pos: C.pos, look: chest(mid, 1.2), fov: 40 }, to: { pos: C.pos.clone().addScaledVector(C.dir, -0.35), look: chest(mid, 1.15), fov: 39 } }
    : { dur: A.C, from: { pos: P.clone().addScaledVector(u, -2.4).addScaledVector(r, side).addScaledVector(UP, 1.75), look: chest(M, 1.3), fov: 44 },
      to: { pos: P.clone().addScaledVector(u, -2.1).addScaledVector(r, side).addScaledVector(UP, 1.7), look: chest(M, 1.25), fov: 42 } };
  const shots = [
    { dur: A.A, from: { pos: aPos, look: aLook, fov: 42 }, to: { pos: aPos.clone().addScaledVector(u, -0.35), look: aLook, fov: 40 } },
    { dur: B, ease: 'linear', from: bFrame },
    cShot,
  ];
  return { shots, dur: A.A + B + A.C, side };
}
