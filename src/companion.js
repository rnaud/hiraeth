// Plumb, the drone that comes when it is needed (src/scout.js flies it, src/drone.js is its body; the character:
// lore/characters/plumb.md). Besides finding the objective when you ask (Q, R3), it has a little mind
// of its own, all here so it can be tested without a scene:
//
//   LostWatch   notices when you are lost: no progress (a quest step, an item, a chest, a talk) and
//               no new place for a few minutes while you walk about, sooner when you walk away from
//               the goal. Then it says one short line, naming the place it means when it is one
//               (placeOf: "The giant's skull is over here"), and flies out toward the goal (the ping's own
//               flight: it comes, a look, the flare, it goes). Cooldowns, so it never nags.
//   StepWatch   in a makers' house: a long time on one step of its solver (logic.next(), the same thing
//               for minutes): a line about the kind of thing that waits (HOUSE_LINES: a switch, a plate,
//               a ball...) and the ping's flight to it (issue #434).
//   FightWatch  against a guardian: once the struggle has gone on (src/hint-level.js STRUGGLE: 40, 100,
//               180 s in one phase) it offers the next of the phase's hints by itself, the ping's hint
//               flight (the lens on the weak point; src/temples/hints.js), once a threshold.
//   Opening     a few lines at the start of a game, each said once per save (flags drone.said.<id>):
//               stepping out of the ship the first time (the village on the horizon, someone there to
//               help us recharge: then it flies off toward it, issue #434), the first person near, the
//               first chest, the first time you are lost (the R3 line after the first talk is the hint
//               system's, issue #151: these say nothing of the button), the first Blade Gate near (issue #483).
//
// One rate limit over all of it: never two of its own lines within GAP s (the opening's excepted).
//
// The setting "Drone hints" (src/ui.js droneHints: on | fewer | off) sets how often it speaks up:
// fewer waits twice as long and rests twice as long between two; off, it says nothing on its own
// (the lines and the pointing; it still finds what you ask for).
// Hints off (src/hint-level.js) silences it too: no help means none.
//
//   const plumb = new Companion({ state: game, setting: () => settings.droneHints })
//   plumb.progress()                       a quest step, an item, a chest, a talk, a new world
//   plumb.note('chest')                    an opening moment happened (said when it can be)
//   plumb.update(dt, { active, canSpeak, pos, goal, place, house, fight })
//       →  { say: text | '', point: reason | null, id }   point: fly the ping's flight (main.js scout.ping())

import { hintLevel, STRUGGLE } from './hint-level.js';
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
  // the opening: each once per save (out and recharge one after the other, stepping out of the ship the first time)
  out: '~curious~ Best bet? The village on the horizon.',
  recharge: '~neutral~ Someone there might help us recharge.',
  person: '~whisper~ Someone’s there. Go and say hello.',
  chest: '~happy~ Oh, that’s a good one. Keep it.',
  pointer: '~playful~ This way. Ask me any time.',
  // the first Blade Gate near (a fight temple's door, its host beside it; issue #483: the makers' sign for kept out)
  bladegate: '~curious~ Makers’ gate. Blades mean keep out. Something got in.',
  // lost, by why it thinks so (in turn)
  still: ['~curious~ Lost? A little. This way.', '~playful~ Scenic route? The goal is over here.'],
  away: ['~curious~ Wrong way, I think. Look.', '~neutral~ Further and further. It’s back here.'],
  circling: ['~tired~ That rock again. Over here.', '~playful~ My petals are dizzy. This way.'],
};
export const OPENING = ['out', 'recharge', 'person', 'chest', 'pointer'];
/** Lines said once per save as the opening's are, later in the journey (flags drone.said.<id>). */
export const ONCE = ['bladegate'];
/** An opening line that brings the next with it (said in turn). */
export const FOLLOWS = { out: 'recharge' };
/** An opening line after which it flies off toward the goal, and why (main.js: 'village' starts the desert's quest, issue #434). */
export const OPENING_POINTS = { recharge: 'village' };

/**
 * Lost, with the place it means named ({place}: the objective's label, when it is a place: placeOf). Each template
 * puts the place at the start of a sentence.
 */
export const PLACE_LINES = {
  still: ['~curious~ Lost? A little. {place}: this way.', '~playful~ Scenic route? {place} is over here.'],
  away: ['~curious~ Wrong way, I think. {place} is back here.', '~neutral~ Further and further. {place} is back here.'],
  circling: ['~tired~ That rock again. {place}: over here.', '~playful~ My petals are dizzy. {place}: this way.'],
};
/** The longest place it names (characters): a longer label and it says the plain line. */
export const PLACE_MAX = 28;
/**
 * The objective's label as a place it can name, or null: "The giant’s skull", "Qanat, under the dark tree", "Your
 * ship, and Qanat’s gift"; not a person ("Marrow, by your ship": `people` their names), not a doing ("Climb to ledge 2",
 * "Back to the ship", "Through the doorway"). Hints say where, never who.
 */
export function placeOf(label, people = new Set()) {
  const s = String(label ?? '').trim();
  if (!s || s.length > PLACE_MAX) return null;
  const head = s.split(',')[0].trim();
  if (people.has(head) || people.has(head.split(/\s+/)[0])) return null;
  if (/^(The|Your)\s/.test(s) || (s.includes(',') && /^[A-Z][\w’'-]+$/.test(head))) return s;
  return null;
}

/**
 * In a makers' house, stuck on one step a long time: a line about what waits (by the kind of the solver's next element,
 * src/temples/logic.js next()), then it flies there.
 */
export const HOUSE_LINES = {
  switch: '~curious~ A switch nobody has thrown. Over here.',
  plate: '~curious~ That plate wants a weight. Look.',
  weight: '~curious~ That weight belongs on a plate.',
  drum: '~curious~ That ball rolls somewhere useful. Look.',
  key: '~happy~ A key, lying about. Over here.',
  door: '~curious~ A lock wants your key. This way.',
  bridge: '~curious~ That bridge wants waking. This way.',
  brazier: '~curious~ A cold brazier. Over here.',
  bramble: '~curious~ Something’s grown over the way. Look.',
  bell: '~curious~ A bell nobody has rung. Over here.',
  vane: '~curious~ That vane wants turning. Over here.',
  arena: '~whisper~ Something waits in there. Ready?',
  boss: '~whisper~ The keeper of this house waits. Ready?',
  gadget: '~happy~ Something here is yours. This way.',
  find: '~happy~ Something to pick up. This way.',
  default: '~curious~ Stuck? A little. Try over here.',
};
export const houseLine = (type) => HOUSE_LINES[type] ?? HOUSE_LINES.default;
export const HOUSE = {
  after: { on: 150, fewer: 300 },   // s on one step before it says so
  cool: { on: 240, fewer: 480 },    // s at least between two
};
/** Never two of its own lines (lost, a house, a guardian) closer than this (s); the opening's lines are their own. */
export const GAP = { on: 45, fewer: 90 };

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

/** The line as the cue shows it: the drone's ◇ and its name, no tone tag ("◇ Plumb: Best bet? …"). */
export const shown = (line) => `◇ ${DRONE_NAME}: ${stripTone(line)}`;
/** A lost line with its place filled in (or the plain line, no place). */
export const withPlace = (line, place) => String(line).replace('{place}', place ?? '');

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

/** A makers' house: how long on one step of its solver; update() is true when it is time to say so. */
export class StepWatch {
  constructor() { this.step = null; this.t = 0; this.cool = 0; }
  /** step: the solver's next element (null: nothing, or not in a house); active: in the house, nothing else up. */
  update(dt, { step = null, active = true, say = 'on' } = {}) {
    if (!(dt > 0)) return false;
    this.cool = Math.max(0, this.cool - dt);
    if (step !== this.step) { this.step = step; this.t = 0; }
    if (!step || !active) return false;
    this.t += dt;
    if (say === 'off' || this.cool > 0 || this.t < HOUSE.after[say]) return false;
    this.t = 0; this.cool = HOUSE.cool[say];
    return true;
  }
}

/**
 * A guardian's fight: `secs` into its phase (`id`, src/temples/hints.js Struggle). update() is true once as each
 * STRUGGLE threshold is crossed (fewer: from the second), held while it can't speak; a new phase starts over.
 */
export class FightWatch {
  constructor() { this.id = null; this.n = 0; }
  update({ id = null, secs = 0, say = 'on', canSpeak = true } = {}) {
    if (id !== this.id) { this.id = id; this.n = 0; }
    if (!id || say === 'off') return false;
    const due = STRUGGLE.filter((s) => secs >= s).length;
    if (say === 'fewer' && this.n < 1) this.n = Math.min(1, due);
    if (due <= this.n || !canSpeak) return false;
    this.n = due;
    return true;
  }
}

/** The opening's lines: each said once per save (state: the game state, flags drone.said.<id>). */
export class Opening {
  constructor(state) { this.state = state; this.queue = []; }
  said(id) { return !!this.state?.flag?.(`drone.said.${id}`); }
  /** The moment happened: its line waits to be said (once), and any that follow it. */
  note(id) {
    for (let k = id; k; k = FOLLOWS[k]) if ((OPENING.includes(k) || ONCE.includes(k)) && !this.said(k) && !this.queue.includes(k)) this.queue.push(k);
  }
  /** The next line to say now (marked said), or ''. `this.last` is its id. */
  take() {
    while (this.queue.length) {
      const id = this.queue.shift();
      if (this.said(id)) continue;
      this.state?.set?.(`drone.said.${id}`, true);
      this.last = id;
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
    this.house = new StepWatch(); this.fight = new FightWatch();
    this.seen = new Set(); this.turn = { still: 0, away: 0, circling: 0 };
    this.gap = 0;   // s until it may say another line of its own (GAP)
  }
  get say() { return droneSay(this.setting(), this.hints()); }
  progress() { this.lost.reset(); }
  note(id) { if (this.say !== 'off') this.opening.note(id); }
  /** A lost line for this reason (the first time: the opening's pointer line), naming `place` when there is one. */
  lostLine(why, place = null) {
    if (!this.opening.said('pointer')) { this.state?.set?.('drone.said.pointer', true); return DRONE_LINES.pointer; }
    const lines = (place ? PLACE_LINES[why] : null) ?? DRONE_LINES[why] ?? DRONE_LINES.still, n = this.turn[why] ?? 0;
    this.turn[why] = n + 1;
    return withPlace(lines[n % lines.length], place);
  }
  /**
   * active: the lost watch runs (in the world, no fight, no scene); canSpeak: nothing else on the screen just now;
   * goal: the objective's position or null; place: the objective's label when it is a place (placeOf), else null;
   * house: { step, type } in a makers' house (its solver's next element and its kind), else null; fight: { id, secs }
   * against a guardian (the phase's hint id and the seconds in it), else null. Returns { say: the line to put on the
   * cue ('' none), point: why it flies the ping's flight ('still' | 'away' | 'circling' | 'house' | 'hint' |
   * 'village'), or null; id: the opening line's id }.
   */
  update(dt, { active = true, canSpeak = true, pos, goal = null, place = null, house = null, fight = null } = {}) {
    const say = this.say;
    if (say === 'off') this.opening.drop();
    if (dt > 0) this.gap = Math.max(0, this.gap - dt);
    const quiet = this.gap > 0;
    const spoke = (r) => { this.gap = GAP[say] ?? GAP.on; return r; };
    // a guardian's fight: the next of its hints, by itself, once the struggle has gone on (the hint's line is the ping's)
    if (this.fight.update({ id: fight?.id ?? null, secs: fight?.secs ?? 0, say, canSpeak: canSpeak && !quiet })) return spoke({ say: '', point: 'hint' });
    // a makers' house: a long time on one step (the lost watch rests inside: the house's own watch is the one)
    if (this.house.update(dt, { step: house?.step ?? null, active: !!house && active && canSpeak && !quiet, say })) return spoke({ say: houseLine(house.type), point: 'house' });
    const why = this.lost.update(dt, { active: active && canSpeak && !house && !quiet, pos, goal, say, seen: this.seen });
    if (why) return spoke({ say: this.lostLine(why, place), point: why });
    if (canSpeak && say !== 'off') {
      const line = this.opening.take();
      if (line) { const id = this.opening.last; return { say: line, point: OPENING_POINTS[id] ?? null, id }; }
    }
    return { say: '', point: null };
  }
}


/**
 * What Plumb's watches need from the world now (main.js and engine/game.js, sampled once a second): the guardian's
 * fight (`hint`: src/temples/hints.js guardianHint(level.temple), `secs`: its Struggle's seconds), else the makers'
 * house you are in and its solver's next step (src/temples/logic.js next()) and that element's kind.
 */
export function droneWorld({ level, pos, hint = null, secs = 0 }) {
  const fight = hint ? { id: hint.id, secs } : null;
  let house = null;
  if (!fight && pos) {
    const rt = [...(level?.temples ?? []), level?.temple].find((t) => t?.logic?.next && t.inside?.(pos)) ?? null;
    if (rt) {
      const step = rt.logic.resolved ? null : rt.logic.next();
      house = { step: step ? `${rt.id}.${step}` : null, type: step ? rt.logic.el?.(step)?.type ?? null : null };
    }
  }
  return { fight, house };
}
