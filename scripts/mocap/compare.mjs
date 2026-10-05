#!/usr/bin/env node
// The traveller's locomotion with motion matching on and off, measured by the gait harness
// (tests/gait-sim.js) on the runs README's "Locomotion" table uses, plus a few the matcher is
// for: a walk with turns, a 90° turn at a run, a jog that slows to a walk.
//   node scripts/mocap/compare.mjs [run name ...]
import * as THREE from 'three';
import { course, traveller, drive, timeToFace } from '../../tests/gait-sim.js';

const W = { KeyW: true }, R = { KeyW: true, ShiftLeft: true }, SR = { KeyS: true, ShiftLeft: true }, S = { KeyS: true }, D = { KeyD: true }, WD = { KeyW: true, KeyD: true }, none = {};
const slow = (x, y) => ({ stick: { x, y } });
export const RUNS = {
  'walk → run → 180° turn → stop': { at: [0, 0, -60], script: [[1, none, 'idle'], [2, W, 'walk'], [2, R, 'run'], [1.5, SR, 'turn180'], [2.5, none, 'stop']], face: [5, Math.PI] },
  'walk, 90° turn, stop': { at: [0, 0, -60], script: [[1, none, 'idle'], [2, W, 'walk'], [2, D, 'turn90'], [2, none, 'stop']], face: [3, -Math.PI / 2] },
  'turn round on the spot': { at: [0, 0, -60], script: [[1, none, 'idle'], [0.12, S, 'tap'], [2.5, none, 'settle']] },
  'up the ramp, stand': { at: [-20, 0, 24], script: [[1, none, 'idle'], [5, W, 'up'], [1.5, none, 'stand']] },
  'stairs up, stand, down': { at: [20, 0, 26], script: [[1, none, 'idle'], [1.6, W, 'up'], [1, none, 'stand'], [3, W, 'down'], [1, none, 'stand']] },
  'slow walk (half stick), stop': { at: [0, 0, -60], script: [[1, none, 'idle'], [3, slow(0, 0.45), 'stroll'], [2, none, 'stop']] },
  'jog, 45° and back, stop': { at: [0, 0, -60], script: [[1, none, 'idle'], [2, W, 'jog'], [1, WD, 'veer'], [1.5, W, 'jog'], [2, none, 'stop']] },
  'stand still 6 s': { at: [0, 0, -60], script: [[6, none, 'idle']] },
};

/** Per phase of a run (its script's tags): the contacts that began in it, their worst and mean slide. */
export function byTag(r) {
  const out = {};
  for (const s of r.slides) { const o = (out[s.tag] ??= { n: 0, max: 0, sum: 0 }); o.n++; o.max = Math.max(o.max, s.slide); o.sum += s.slide; }
  for (const o of Object.values(out)) o.mean = o.sum / o.n;
  return out;
}

const fmt = (r) => `slide ${r.maxSlide.toFixed(2)} / ${r.meanSlide.toFixed(3)}  held ${r.heldSlide.toFixed(3)}  sink ${r.sink.toFixed(3)}  jerk ${r.jitterHead.toFixed(2)}  bone ${r.maxTurn.toFixed(2)}`;

export async function compare(names = Object.keys(RUNS)) {
  const out = {};
  for (const name of names) {
    const run = RUNS[name];
    out[name] = {};
    for (const matching of [false, true]) {
      const p = await traveller(course(), new THREE.Vector3(...run.at), { matching });
      const r = drive(p, run.script);
      r.face = run.face ? timeToFace(r.frames, run.face[0], run.face[1]) : null;
      r.mmShare = r.frames.filter((f) => f.t > 0.3).reduce((a, f) => a + (f.mmW ?? 0), 0) / Math.max(1, r.frames.filter((f) => f.t > 0.3).length);
      r.jumps = p.animator.mm?.jumps ?? 0;
      out[name][matching ? 'mm' : 'loops'] = r;
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // (MM='{"keep":0.3}' node scripts/mocap/compare.mjs: try the matcher's settings, src/motion-match.js MATCH)
  if (process.env.MM) Object.assign((await import('../../src/motion-match.js')).MATCH, JSON.parse(process.env.MM));
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(RUNS);
  const res = await compare(names);
  for (const [name, r] of Object.entries(res)) {
    console.log(name);
    for (const k of ['loops', 'mm']) {
      const x = r[k];
      console.log(`  ${k.padEnd(5)} ${fmt(x)}${x.face !== null ? `  face ${x.face.toFixed(2)} s` : ''}${k === 'mm' ? `  (matching ${(x.mmShare * 100).toFixed(0)} % of the time, ${x.jumps} jumps)` : ''}`);
    }
    if (process.env.TAGS) {
      const a = byTag(r.loops), b = byTag(r.mm);
      for (const t of Object.keys({ ...a, ...b })) console.log(`    ${t.padEnd(8)} loops ${a[t] ? `${a[t].max.toFixed(2)} / ${a[t].mean.toFixed(3)}` : '-'}   mm ${b[t] ? `${b[t].max.toFixed(2)} / ${b[t].mean.toFixed(3)}` : '-'}`);
    }
  }
}
