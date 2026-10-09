import { CourseRun } from './course.js';

// The makers' runs' rules (docs/systems/challenges.md): pure, over plain { x, y, z } points, tested in node
// (tests/trials-kit.test.js). A makers' run is a short chain of the temples' own pieces stood in the open
// (src/trials/kit-courses.js builds them): gates on foot, taken in order, and at the end, for some, a task:
// a bank of eyes to wake in one breath, or balls to roll onto their plates. The task only counts once every
// gate is behind you, so nobody wakes the bank from the door or climbs round the outside to it (a ball rolled
// home early waits there, and the last gate finishes the run).
//
//   const run = new KitRun({ gates, bank: 3, words })   (bank: how many, 0 for none; words: the task's goal)
//   run.step(from, to, t)  → 'gate' | 'ready' (the last gate: the task counts now) | 'finish' | null
//   run.wake(n, t)         how many are done now (eyes awake, balls home): 'finish' once all of them are
//   run.goal()             the line under the clock: 'gate 2 / 5', 'wake the eyes 1 / 3', 'roll the spheres home 1 / 2'

export class KitRun {
  constructor({ gates = [], bank = 0, words = 'wake the eyes' } = {}) {
    this.course = new CourseRun(gates);
    this.bank = bank;
    this.words = words;
    this.awake = 0;
    this.done = false;
    this.finishedAt = null;
  }
  get gates() { return this.course.gates; }
  get next() { return this.course.next; }
  get splits() { return this.course.splits; }
  /** Every gate passed: the bank (if any) listens now. */
  get ready() { return this.course.done; }
  step(from, to, t = 0) {
    if (this.done) return null;
    const r = this.course.step(from, to, t);
    if (r === 'finish') {
      if (this.bank > 0) return 'ready';
      this.done = true; this.finishedAt = t;
      return 'finish';
    }
    return r;
  }
  /** The bank's eyes awake now (inside its window). Only counts once the gates are behind you. */
  wake(n, t = 0) {
    if (this.done || !this.ready || this.bank <= 0) return null;
    this.awake = Math.max(0, Math.min(this.bank, n));
    if (this.awake >= this.bank) { this.done = true; this.finishedAt = t; return 'finish'; }
    return null;
  }
  goal() {
    if (this.done) return '';
    if (!this.ready) return `gate ${Math.min(this.next + 1, this.gates.length)} / ${this.gates.length}`;
    return `${this.words} ${this.awake} / ${this.bank}`;
  }
}

/**
 * Out of a makers' run? (a reason in words for the results card, or ''.) P: the traveller ({ dead, swim,
 * inWater: { depth } }). A run over water (`wet: true`, the Hush walk) ends in the water; a run up in the air
 * (`fall`, the feather leap) ends down on the ground under it once its first gates are behind you (passed:
 * the gates passed; height and along: the traveller's feet in the course's frame, up and its z); any run ends
 * at a knockout.
 */
export function outOfRun(trial, P, { passed = 0, height = Infinity, along = Infinity } = {}) {
  if (!P) return '';
  if (P.dead) return 'Knocked out';
  if (trial?.wet && (P.swim || (P.inWater?.depth ?? 0) > 0.7)) return 'In the water';
  const F = trial?.fall;
  if (F && passed >= (F.after ?? 0) && height < F.below && along >= (F.from ?? -Infinity)) return F.words ?? 'Fell';
  return '';
}

/**
 * What the one standing nearby says when a run ends well (src/trials/kit-data.js `voice`): the first finish,
 * the makers' mark beaten for the first time, or a later finish. Lines carry their tone (src/story/tone.js).
 */
export function voiceLine(voice, { first = false, beaten = false, beatenBefore = false } = {}) {
  if (!voice) return null;
  if (first) return voice.first;
  if (beaten && !beatenBefore) return voice.beaten ?? voice.again;
  return voice.again ?? null;
}
