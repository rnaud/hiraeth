// The motion QC's scenarios (.claude/skills/motion-qc/SKILL.md).
//
// COURSE: on the gait harness's course in node (src/gait-course.js: flat ground, a 12° ramp, 18 cm stairs), the
// traveller driven by a script of [seconds, input, tag] steps, input { KeyW, KeyS, KeyA, KeyD, ShiftLeft } or
// { stick: { x, y } } (camera-relative, the camera looking along +z). Pivots are judged wherever the controller pivots.
//
// WORLDS: in the running game (the skill's run.mjs, a muted headless Chrome): { name, world, at?, yaw?, setup?, segs }
// with segments { for (s), stick: [x, y] (camera-relative), run (Shift), tag }.
import { RUNS } from '../../src/gait-course.js';

const none = {}, W = { KeyW: true }, S = { KeyS: true }, A = { KeyA: true }, D = { KeyD: true };
const R = { KeyW: true, ShiftLeft: true }, SR = { KeyS: true, ShiftLeft: true };
const stick = (x, y, run = false) => ({ stick: { x, y }, ...(run ? { ShiftLeft: true } : {}) });

export const COURSE = {
  // the harness's own runs (scripts/mocap/compare.mjs, the "Locomotion" tables)
  ...Object.fromEntries(Object.entries(RUNS).map(([k, v]) => [k, { ...v, about: 'the gait harness’s run' }])),
  'gaits: walk → jog → sprint → jog → walk → stop': { at: [0, 0, -60], about: 'every gait in turn, each change of the loop that leads a blend boundary',
    script: [[1, none, 'idle'], [2, stick(0, 0.45), 'walk'], [2, W, 'jog'], [2.5, R, 'sprint'], [1.5, W, 'jog'], [1.5, stick(0, 0.45), 'walk'], [2, none, 'stop']] },
  'starts and stops, walk and run': { at: [0, 0, -60], about: 'setting off and stopping over and over, at a walk, a jog and a run',
    script: [[1, none, 'idle'], ...[0, 1].flatMap((i) => [[1.2, stick(0, 0.45), `walk${i}`], [1.2, none, `wstop${i}`]]),
      ...[0, 1].flatMap((i) => [[1, W, `jog${i}`], [1.2, none, `jstop${i}`]]), ...[0, 1].flatMap((i) => [[1.4, R, `run${i}`], [1.5, none, `rstop${i}`]])] },
  'pivots standing: 90° each way, 180°': { at: [0, 0, -60], about: 'turning on the spot by a tap of the stick',
    script: [[1, none, 'idle'], [0.15, D, 'pivot-r'], [1.6, none, 'settle'], [0.15, A, 'pivot-l'], [1.6, none, 'settle2'], [0.15, S, 'pivot-180'], [2, none, 'settle3']] },
  'pivot 180° at a jog, and at a sprint': { at: [0, 0, -60], about: 'reversing the stick while moving',
    script: [[1, none, 'idle'], [2, W, 'jog'], [1.5, S, 'pivot-jog'], [1.2, none, 'stop'], [2.5, SR, 'sprint'], [1.5, R, 'pivot-sprint'], [2, none, 'stop2']] },
  'curve: the stick round a circle at a jog': { at: [0, 0, -60], about: 'a steady turn (the stick sweeping 90°/s), then back the other way',
    script: [[1, none, 'idle'], ...Array.from({ length: 24 }, (_, i) => [0.25, stick(Math.sin(i * Math.PI / 8), Math.cos(i * Math.PI / 8)), i < 12 ? 'curve' : 'curve2']), [1.5, none, 'stop']] },
  'down the ramp, stop on it': { at: [-20, 0, 42], about: 'walking down the 12° ramp and stopping on the slope',
    script: [[1, none, 'idle'], [2.2, S, 'down'], [1.5, none, 'stand'], [1.5, S, 'down2']] },
  'stairs at a run': { at: [20, 0, 26], about: 'up the 18 cm stairs, over the landing and down at a run',
    script: [[1, none, 'idle'], [3.2, R, 'run'], [1.5, none, 'stand']] },
};

// the worlds: open sand (slopes), a town's street (kerbs, crowds), the Arena's flat floor
const course = (prefix = '') => [
  { for: 1, tag: `${prefix}idle` }, { for: 2, stick: [0, 0.45], tag: `${prefix}walk` }, { for: 2, stick: [0, 1], tag: `${prefix}jog` },
  { for: 2.5, stick: [0, 1], run: true, tag: `${prefix}sprint` }, { for: 1.5, stick: [0, -1], run: true, tag: `${prefix}pivot-sprint` },
  { for: 1.5, tag: `${prefix}stop` }, { for: 0.15, stick: [1, 0], tag: `${prefix}pivot-r` }, { for: 1.5, tag: `${prefix}settle` },
  { for: 1.6, stick: [0, 1], tag: `${prefix}jog2` }, { for: 1.2, stick: [-1, 0], tag: `${prefix}turn90` }, { for: 1.2, tag: `${prefix}stop2` },
];
export const WORLDS = [
  { name: 'desert-dunes', world: 'desert', about: 'the open sand by the landing: every gait, a sprint reversed, a pivot, a 90° turn at a jog', segs: course() },
  { name: 'bazaar-street', world: 'bazaar', about: 'the Signal Market’s street from the landing: the same, between the stalls', yaw: Math.PI, segs: course() },
  // (the City-Shaft's terraces were tried: the landing is a terrace a few metres deep, and every way the script ran into a
  // railing or a house within the sprint, and he climbed it; the course's stairs, in node, stand in for its steps)
  { name: 'arena-floor', world: 'arena', about: 'the Arena’s open floor (no foe called): the same on hard flat ground', segs: course() },
];
