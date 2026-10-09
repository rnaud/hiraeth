// The mastery trials' rules (docs/systems/minigames.md, "Trials in the worlds"): pure, over plain
// { x, y, z } points, tested in node (tests/trials.test.js).
//
// A course is a list of gates ({ x, y, z, r }), taken in order: a gate is passed when the body's path
// this frame (from where it was to where it is) comes within r of its middle. The last gate is the line.

/** The least distance from point c to the segment a → b. */
export function segmentDistance(a, b, c) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const L = abx * abx + aby * aby + abz * abz;
  let t = L > 1e-12 ? ((c.x - a.x) * abx + (c.y - a.y) * aby + (c.z - a.z) * abz) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = a.x + abx * t - c.x, dy = a.y + aby * t - c.y, dz = a.z + abz * t - c.z;
  return Math.hypot(dx, dy, dz);
}

/** Did the path a → b go through gate g (within its radius)? */
export const throughGate = (a, b, g) => segmentDistance(a, b, g) <= g.r;

/**
 * One run of a course. step(from, to) each frame: returns 'gate' when a gate was passed, 'finish' at the
 * line, else null. `next` is the index of the gate wanted; `splits` the time at each gate passed.
 */
export class CourseRun {
  constructor(gates) { this.gates = gates; this.next = 0; this.splits = []; this.done = false; }
  get gate() { return this.gates[this.next] ?? null; }
  get left() { return this.gates.length - this.next; }
  step(from, to, t = 0) {
    if (this.done) return null;
    const g = this.gate;
    if (!g || !throughGate(from, to, g)) return null;
    this.splits.push(t);
    this.next++;
    if (this.next >= this.gates.length) { this.done = true; return 'finish'; }
    return 'gate';
  }
}

/**
 * How a course is flown or ridden: what the traveller must have to try it (items, the mount found), what he
 * must keep doing (on the bike, on the bird, in the air), and the words for not having it.
 */
export const MODES = {
  foot: { needs: [], words: '' },
  glider: { needs: ['backpack', 'glider'], words: 'It wants the fluid wings.' },
  jets: { needs: ['backpack', 'jetpack'], words: 'It wants the fluid jets.' },
  bike: { needs: ['backpack'], mount: 'bike', words: 'It wants the hoverbike.' },
  skiff: { needs: ['backpack'], mount: 'skiff', words: 'It wants the skiff.' },
  bird: { needs: [], mount: 'bird', words: 'It wants the bird.' },
  eyes: { needs: ['backpack'], words: 'It wants the backpack.' },
  kit: { needs: [], words: '' },   // (a makers' run, src/trials/kit-data.js: its own needs)
};

/** What the traveller lacks to try a trial (a sentence), or '' if he can. has(id), mount: the level's mount or null. */
export function lacks(trial, { has = () => false, mount = null } = {}) {
  const M = MODES[trial.mode] ?? MODES.foot;
  for (const id of [...M.needs, ...(trial.needs ?? [])]) if (!has(id)) return trial.lacks ?? M.words ?? 'Not yet.';
  if (M.mount && (!mount || mount.dormant || mount.kind !== M.mount)) return trial.lacks ?? M.words;
  return '';
}

/** Is the traveller still doing what the trial wants (riding its mount; for a flight, not walking off)? */
export function inMode(trial, P) {
  const M = MODES[trial.mode] ?? MODES.foot;
  if (M.mount) return !!P?.ride && (P.ride === P.mount);
  return true;
}

/** The gentle goal: a par time a player who keeps going will beat on a first try (the course's length at an easy pace). */
export function parTime(gates, start, speed) {
  let d = 0, p = start;
  for (const g of gates) { d += Math.hypot(g.x - p.x, g.y - p.y, g.z - p.z); p = g; }
  return Math.ceil((d / speed) * 1.6 + 5);
}
