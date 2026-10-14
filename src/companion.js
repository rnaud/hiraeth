// Plumb, the drone that comes when it is needed (src/scout.js flies it, src/drone.js is its body; the character:
// lore/characters/plumb.md). Besides finding the objective when you ask (Q, R3), it has a little mind
// of its own, three parts, all here so they can be tested without a scene:
//
//   LostWatch   notices when you are lost: no progress (a quest step, an item, a chest, a talk) and
//               no new place for a few minutes while you walk about, sooner when you walk away from
//               the goal. Then it says one short line and flies out toward the goal (the ping's own
//               flight: it comes, a look, the flare, it goes). Cooldowns, so it never nags.
//   Opening     a few lines at the start of a game, each said once per save (flags drone.said.<id>):
//               stepping out of the ship, the first person near, the first chest, the first time
//               you are lost (the R3 line after the first talk is the hint system's, issue #151:
//               these say nothing of the button).
//   Mood        small moves on the dock: a hop when you find something, a lean and a look toward
//               something worth seeing near you, a shiver in a storm. None with Reduce motion.
//               Unused while the drone is not carried on you (issue #294: it comes when it is needed).
//
// The setting "Drone hints" (src/ui.js droneHints: on | fewer | off) sets how often it speaks up:
// fewer waits twice as long and rests twice as long between two; off, it says nothing on its own
// (the lines and the pointing; it still finds what you ask for, and still moves on the dock).
// Hints off (src/hint-level.js) silences it too: no help means none.
//
//   const plumb = new Companion({ state: game, setting: () => settings.droneHints })
//   plumb.progress()                       a quest step, an item, a chest, a talk, a new world
//   plumb.note('chest')                    an opening moment happened (said when it can be)
//   plumb.update(dt, { active, canSpeak, pos, goal })  →  { say: text | '', point: reason | null }

import { hintLevel } from './hint-level.js';
import { stripTone } from './story/tone.js';

export const DRONE_HINTS = ['on', 'fewer', 'off'];
export const DEFAULT_DRONE_HINTS = 'on';

/** The drone's name (the character note: lore/characters/plumb.md). */
export const DRONE_NAME = 'Plumb';

/**
 * What it says (the house style: terse, dry, warm; it answers its own questions, that is its tic).
 * Each carries its tone (src/story/tone.js); the cue shows them without it, after the drone's ◇.
 */
export const DRONE_LINES = {
  // the opening: each once per save
  out: '~playful~ Out at last. I’ll ride on your pack.',
  person: '~whisper~ Someone’s there. Go and say hello.',
  chest: '~happy~ Oh, that’s a good one. Keep it.',
  pointer: '~playful~ This way. Ask me any time.',
  // lost, by why it thinks so (in turn)
  still: ['~curious~ Lost? A little. This way.', '~playful~ Scenic route? The goal is over here.'],
  away: ['~curious~ Wrong way, I think. Look.', '~neutral~ Further and further. It’s back here.'],
  circling: ['~tired~ That rock again. Over here.', '~playful~ My petals are dizzy. This way.'],
};
export const OPENING = ['out', 'person', 'chest', 'pointer'];

export const LOST = {
  after: { on: 180, fewer: 360 },   // s of no progress before it says so
  cool: { on: 300, fewer: 720 },    // s at least between two
  cell: 24,       // m: a place (a cube of the world); a new one is news
  credit: 40,     // s a new place gives back on the clock
  walk: 60,       // m walked since the last progress, at least (standing still, or away from the keys, is not lost)
  away: 40,       // m further from the goal than at the last progress: walking away
  awayRate: 1.5,  // × the clock while walking away
  circle: { walk: 150, cells: 3 },   // walked this far in no more than this many places: going round in circles
  sample: 1,      // s between two looks at the goal
};

/** The drone's say in the settings and the hint level: 'on' | 'fewer' | 'off'. */
export function droneSay(setting, hints = hintLevel()) {
  if (hints === 'off') return 'off';
  return DRONE_HINTS.includes(setting) ? setting : DEFAULT_DRONE_HINTS;
}

/** The line as the cue shows it: the drone's ◇, no tone tag. */
export const shown = (line) => `◇ ${stripTone(line)}`;

/** The lost detector: update() returns why you look lost ('still' | 'away' | 'circling') when it is time to say so, else null. */
export class LostWatch {
  constructor() { this.cool = 0; this.reset(); }
  /** Something happened: the clock starts over (the cooldown stays). */
  reset() {
    this.t = 0; this.walked = 0; this.cells = new Set(); this.ref = NaN; this.dist = NaN; this.sampleT = 0;
    this.last = null;
  }
  /**
   * active: on your feet (or riding) in the world, nothing on the screen, no fight; pos: where you are; goal: the
   * objective's position (null: nothing to find, never lost); say: 'on' | 'fewer' | 'off'; seen: the places ever
   * visited (cell keys; a Set kept across resets, so a place stays known).
   */
  update(dt, { active = true, pos, goal = null, say = 'on', seen }) {
    if (!(dt > 0) || !pos) return null;
    if (!active) { this.last = null; return null; }
    this.cool = Math.max(0, this.cool - dt);
    // walked (a teleport or a cut is no walk)
    if (this.last) { const d = Math.hypot(pos.x - this.last.x, pos.y - this.last.y, pos.z - this.last.z); if (d < 8) this.walked += d; }
    this.last = { x: pos.x, y: pos.y, z: pos.z };
    // places: a new one gives time back
    const c = LOST.cell, key = `${Math.floor(pos.x / c)},${Math.floor(pos.y / c)},${Math.floor(pos.z / c)}`;
    this.cells.add(key);
    if (seen && !seen.has(key)) { seen.add(key); this.t = Math.max(0, this.t - LOST.credit); }
    // the goal: how far, now and then
    if (!goal) { this.t = 0; this.ref = NaN; return null; }
    if ((this.sampleT -= dt) <= 0 || !Number.isFinite(this.dist)) {
      this.sampleT = LOST.sample;
      this.dist = Math.hypot(goal.x - pos.x, goal.y - pos.y, goal.z - pos.z);
      if (!Number.isFinite(this.ref)) this.ref = this.dist;
    }
    const away = this.dist > this.ref + LOST.away;
    this.t += dt * (away ? LOST.awayRate : 1);
    if (say === 'off') return null;
    if (this.t < LOST.after[say] || this.cool > 0 || this.walked < LOST.walk) return null;
    const why = away ? 'away' : this.walked >= LOST.circle.walk && this.cells.size <= LOST.circle.cells ? 'circling' : 'still';
    this.cool = LOST.cool[say];
    this.reset();
    return why;
  }
}

/** The opening's lines: each said once per save (state: the game state, flags drone.said.<id>). */
export class Opening {
  constructor(state) { this.state = state; this.queue = []; }
  said(id) { return !!this.state?.flag?.(`drone.said.${id}`); }
  /** The moment happened: its line waits to be said (once). */
  note(id) { if (OPENING.includes(id) && !this.said(id) && !this.queue.includes(id)) this.queue.push(id); }
  /** The next line to say now (marked said), or ''. */
  take() {
    while (this.queue.length) {
      const id = this.queue.shift();
      if (this.said(id)) continue;
      this.state?.set?.(`drone.said.${id}`, true);
      return DRONE_LINES[id];
    }
    return '';
  }
  drop() { this.queue.length = 0; }
}

/** Lost watch, opening and the setting together (main.js). */
export class Companion {
  constructor({ state, setting = () => DEFAULT_DRONE_HINTS, hints = hintLevel } = {}) {
    this.state = state; this.setting = setting; this.hints = hints;
    this.lost = new LostWatch(); this.opening = new Opening(state);
    this.seen = new Set(); this.turn = { still: 0, away: 0, circling: 0 };
  }
  get say() { return droneSay(this.setting(), this.hints()); }
  progress() { this.lost.reset(); }
  note(id) { if (this.say !== 'off') this.opening.note(id); }
  /** A lost line for this reason (the first time: the opening's pointer line). */
  lostLine(why) {
    if (!this.opening.said('pointer')) { this.state?.set?.('drone.said.pointer', true); return DRONE_LINES.pointer; }
    const lines = DRONE_LINES[why] ?? DRONE_LINES.still, n = this.turn[why] ?? 0;
    this.turn[why] = n + 1;
    return lines[n % lines.length];
  }
  /**
   * active: the lost watch runs (in the world, no fight, no scene); canSpeak: nothing else on the screen just now;
   * goal: the objective's position or null. Returns { say: the line to put on the cue ('' none), point: why
   * it is pointing ('still' | 'away' | 'circling'), or null }.
   */
  update(dt, { active = true, canSpeak = true, pos, goal = null } = {}) {
    const say = this.say;
    if (say === 'off') this.opening.drop();
    const why = this.lost.update(dt, { active: active && canSpeak, pos, goal, say, seen: this.seen });
    if (why) return { say: this.lostLine(why), point: why };
    if (canSpeak && say !== 'off') { const line = this.opening.take(); if (line) return { say: line, point: null }; }
    return { say: '', point: null };
  }
}

/**
 * The dock's little moves (Mood): a hop when you find something, a look and a lean toward something worth
 * seeing, a shiver in a storm. step() eases them; pose() is what the dock adds this frame, in the dock's
 * frame (+y out of the surface, +z the way the lens looks): { lift (m), yaw, tilt (rad), shake (rad), awake }.
 */
export const MOOD = {
  hop: { time: 0.7, height: 0.07, hops: 2 },   // a find: two little hops
  lean: { tilt: 0.28, range: 10, ease: 4 },   // toward a thing within range m: the lens on it, the top tipped toward it
  shiver: { from: 0.3, amp: 0.06, rate: 31 },  // a storm over `from`: a quick shake
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export class Mood {
  constructor() { this.hopT = Infinity; this.yaw = 0; this.k = 0; this.t = 0; this.storm = 0; this.still = false; }
  /** Something was found: a hop (not again while one plays). */
  hop() { if (!(this.hopT < MOOD.hop.time)) this.hopT = 0; }
  /**
   * dir: the thing worth seeing, in the dock's frame ({ x, z }, unnormalised; null: nothing near);
   * storm: 0..1; still: Reduce motion (nothing moves).
   */
  step(dt, { dir = null, storm = 0, still = false } = {}) {
    this.t += dt; this.hopT += dt;
    this.still = still; this.storm = storm;
    const e = 1 - Math.exp(-MOOD.lean.ease * dt);
    const want = dir && Math.hypot(dir.x, dir.z) > 1e-3;
    this.k += ((want ? 1 : 0) - this.k) * e;
    this.yaw += wrap((want ? Math.atan2(dir.x, dir.z) : 0) - this.yaw) * e;   // (the short way round)
    return this.pose();
  }
  /** What the dock adds now: lift (m, out of the surface), yaw (rad round its up), tilt (rad, the top toward the lens), shake (rad), awake (the eye open). */
  pose() {
    if (this.still) return { lift: 0, yaw: 0, tilt: 0, shake: 0, awake: false };
    const H = MOOD.hop, k = this.hopT < H.time ? this.hopT / H.time : 1;
    const lift = k < 1 ? Math.abs(Math.sin(Math.PI * H.hops * k)) * H.height * (1 - k * 0.5) : 0;
    const S = MOOD.shiver, s = Math.max(0, (this.storm - S.from) / (1 - S.from));
    const shake = s > 0 ? Math.sin(this.t * S.rate) * Math.sin(this.t * S.rate * 0.37 + 1) * S.amp * s : 0;
    return { lift, yaw: this.yaw, tilt: MOOD.lean.tilt * this.k, shake, awake: k < 1 || this.k > 0.3 };
  }
  /** Anything to show (the dock skips its work otherwise). */
  get busy() { return !this.still && (this.hopT < MOOD.hop.time || this.k > 0.01 || Math.abs(this.yaw) > 0.01 || this.storm > MOOD.shiver.from); }
}
