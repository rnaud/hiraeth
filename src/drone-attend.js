import * as THREE from 'three';

// Plumb drifts out to what matters (issue #662): while you dawdle near someone you should talk to or something you
// should take, the drone comes out of its light and hovers over it a while, its lens on it, then goes. It never
// leaves your side in a fight, a talk or a scene, nor while you run or ride, and it never flies to a goal on another
// floor or out of sight. Pure rules (tests/drone-attend.test.js); src/host/game-host.js wireCompanion drives it (the
// web and the engines alike) and src/scout.js flies it (Scout.attend). Rules: docs/systems/scout.md, "It shows you".
//
//   attendCandidates(quests)           → [{ id, kind, weight, position }]: what the quests say matters here
//   new AttendPicker().pick(cands, ctx) → the candidate to hover at (with hysteresis), or null
//   attendSpot({ feet, goal, up, ray })  → where it hovers by a target

export const ATTEND = {
  range: 22,      // m: a target this near you (and in sight, on your floor) can be shown
  keep: 30,       // m: one being shown is let go only past this (hysteresis: no on and off at the edge)
  floor: 3.5,     // m: a goal more than this above or below your feet is on another floor: never
  reached: 3,     // m (flat): you are at it; done, it goes home
  slow: 2.4,      // m/s: you walk slowly or stand: it may go out
  fast: 4.2,      // m/s: you run (or ride): it comes home
  settle: 1.6,    // s slow (and nothing else on) before it goes out
  hurry: 0.4,     // s fast before it comes home (a stumble is not a run)
  hold: 5,        // s at least on one target before it may change to another
  switchBy: 1.4,  // and only for one this much better (its score over the current one's)
  blind: 1.5,     // s the one shown may be out of sight (someone walking behind a post) before it is let go
  show: 14,       // s at most over one target, then home
  again: 75,      // s before the same target is shown again (fewer: `againFewer`)
  againFewer: 180,
  rest: 6,        // s after it comes home before it goes out to anything
  over: 1.85,     // m over the target's feet it hovers (by a person's head, clear of the barks' bubbles over it)
  toward: 0.8,    // m back toward you from it (in the camera's view, not hidden behind it)
  side: 0.7,      // m to its side, as you see it (beside the face, not on it)
};
/** How much each kind matters: the step the scout finds first, then someone waiting to give you a quest, then another quest's step. */
export const WEIGHT = { tracked: 3, giver: 2, step: 1.4 };

/** A quest stage worth flying to: someone to talk to, something to bring or take, a thing marked (`at`); never a place to walk to. */
export function stageWorthShowing(st) {
  if (!st) return false;
  if (st.talk != null || st.bring != null) return true;
  return st.at != null && st.goto == null;
}

/**
 * What the quests say matters here (src/story/quests.js): the tracked objective (the scout's find), the people still
 * waiting to give a quest (the Map's giver marks), and every other quest's step with a place. Places to walk to are
 * left out (the drone hovers over people and things); each id once, the most important kind kept.
 */
export function attendCandidates(quests) {
  if (!quests) return [];
  const out = new Map();
  const add = (o, kind) => {
    if (!o?.position || out.has(o.id)) return;
    out.set(o.id, { id: o.id, kind, weight: WEIGHT[kind], position: o.position.clone ? o.position.clone() : o.position, label: o.label ?? '' });
  };
  const worth = (o) => {
    if (!o) return false;
    if (/^(giver|opener)-/.test(o.id)) return true;
    return stageWorthShowing(o.quest ? quests.current?.(o.quest) : null);
  };
  const tracked = quests.objective?.();
  if (worth(tracked)) add(tracked, 'tracked');
  for (const g of quests.giverMarks?.() ?? []) add(g, 'giver');
  for (const o of quests.objectives?.() ?? []) if (worth(o)) add(o, 'step');
  return [...out.values()];
}

const _t = new THREE.Vector3();
/** Distance (3D), height over your feet along `up`, and flat distance. */
export function measure(feet, goal, up) {
  _t.subVectors(goal, feet);
  const dy = _t.dot(up), d = _t.length();
  return { d, dy, flat: Math.sqrt(Math.max(0, d * d - dy * dy)) };
}
/** A candidate's score (higher is better): its weight, less the further it is (half its worth at the edge of range). */
export const attendScore = (c, d, A = ATTEND) => c.weight * (1 - 0.5 * Math.min(1, d / A.range));

/**
 * Which target to hover at, steady: a candidate is taken when it is on your floor, in range, in sight, not reached and
 * not shown lately; the one shown is kept while it stays on your floor and within `keep` (out of sight for `blind` s at
 * most), for `hold` s at least, and only another `switchBy` times better takes its place. One done (gone from the
 * list: talked to, taken) or reached is marked shown and let go.
 *   pick(cands, { feet, up, dt, now, sees(c) → bool, again }) → the candidate, or null
 */
export class AttendPicker {
  constructor(A = ATTEND) { this.A = A; this.current = null; this.held = 0; this.blindT = 0; this.shownT = 0; this.seen = new Map(); this.ended = null; }
  /** Let the one shown go; `seen`: marked shown (not again for `again` s). Sent home by you (a run, a fight, a talk), it is not. */
  reset(seen = true) { if (this.current && seen) this.seen.set(this.current.id, this.now ?? 0); this.current = null; this.held = this.blindT = this.shownT = 0; }
  /** A target recently shown (or reached) waits `again` s. */
  fresh(id, now, again) { const t = this.seen.get(id); return t == null || now - t >= again; }
  pick(cands, { feet, up, dt = 0, now = 0, sees = () => true, again = this.A.again } = {}) {
    const A = this.A;
    this.now = now; this.ended = null;
    let cur = null;
    if (this.current) {
      cur = cands.find((c) => c.id === this.current.id) ?? null;
      if (!cur) { this.ended = 'done'; this.reset(); }   // (talked to, taken, the step moved on)
    }
    if (cur) {
      const m = measure(feet, cur.position, up);
      this.blindT = sees(cur) ? 0 : this.blindT + dt;
      this.held += dt; this.shownT += dt;
      const why = m.flat < A.reached ? 'reached' : Math.abs(m.dy) > A.floor ? 'floor' : m.d > A.keep ? 'far'
        : this.blindT > A.blind ? 'blind' : this.shownT > A.show ? 'shown' : null;
      if (why) { this.ended = why; this.reset(); cur = null; }
      else { this.current = cur; cur.score = attendScore(cur, m.d, A); }
    }
    let best = null;
    for (const c of cands) {
      if (cur && c.id === cur.id) continue;
      if (!this.fresh(c.id, now, again)) continue;
      const m = measure(feet, c.position, up);
      if (m.d > A.range || Math.abs(m.dy) > A.floor || m.flat < A.reached) continue;
      const s = attendScore(c, m.d, A);
      if (best && s <= best.score) continue;
      if (!sees(c)) continue;
      best = { ...c, score: s };
    }
    if (cur && best && this.held >= A.hold && best.score > cur.score * A.switchBy) {
      this.seen.set(cur.id, now);
      this.ended = 'switch';
      cur = null;
    }
    if (!cur && best) { this.current = best; this.held = this.blindT = this.shownT = 0; return best; }
    return cur;
  }
}

/**
 * Where it hovers by a target (a fresh or `out` Vector3): `over` m over its feet, `toward` m back toward you and `side`
 * m to its right as you see it (in the camera's view by a person's head, not on the face, under a bark's bubble), under a ceiling (`ray(origin, dir, far)`: distance
 * to the first thing hit, or Infinity).
 */
export function attendSpot({ feet, goal, up, ray = null, A = ATTEND }, out = new THREE.Vector3()) {
  const back = _b.subVectors(feet, goal);
  back.addScaledVector(up, -back.dot(up));
  const l = back.length();
  if (l > 1e-3) back.divideScalar(l); else back.set(0, 0, 0);
  const base = _g.copy(goal).addScaledVector(up, 1);
  const room = ray ? ray(base, up, A.over) : Infinity;
  out.copy(base).addScaledVector(up, Math.max(0.2, Math.min(A.over - 1, room - 0.5)));
  out.addScaledVector(back, Math.min(A.toward, l * 0.5));
  return out.addScaledVector(_sd.crossVectors(back, up), -A.side);   // (its right, seen from you: back × up is your left)
}
const _b = new THREE.Vector3(), _g = new THREE.Vector3(), _sd = new THREE.Vector3();

/**
 * When it may go out (the gate): you walk slowly or stand for `settle` s, calm (no talk, scene, menu, fight), on foot,
 * nothing else of Plumb's under way (a talk waiting, a ping's flight), not resting after its last outing. When it comes
 * home: you run or ride (`hurry` s), a fight, anything not calm.
 *   update(dt, { speed, calm, fight, riding, busy }) → 'out' (may go / stay out) | 'home' (come back now) | 'wait'
 */
export class AttendGate {
  constructor(A = ATTEND) { this.A = A; this.slowT = 0; this.fastT = 0; this.restT = 0; }
  rest(secs = this.A.rest) { this.restT = Math.max(this.restT, secs); this.slowT = 0; }
  update(dt, { speed = 0, calm = true, fight = false, riding = false, busy = false } = {}) {
    const A = this.A;
    this.restT = Math.max(0, this.restT - dt);
    if (!calm || fight || riding) { this.slowT = this.fastT = 0; return 'home'; }
    this.fastT = speed > A.fast ? this.fastT + dt : 0;
    if (speed < A.slow && !busy) this.slowT += dt;   // (between slow and fast, or a stumble: as it was)
    if (this.fastT > A.hurry) { this.slowT = 0; return 'home'; }
    if (busy) return 'wait';
    return this.slowT >= A.settle && this.restT <= 0 ? 'out' : 'wait';
  }
}
