#!/usr/bin/env node
// The controller's feel in numbers (issue #699, beside the BotW study in docs/design/locomotion-botw-study.md): the node
// traveller on the gait harness's flat (scripts/motion-qc/runner.mjs) set off, stopped, turned and reversed, and timed
// at 60 frames a second: how long to 50 / 90 % of the gait's speed, how far and how long a stop takes, how long the
// facing takes round a 180° at a run, the body's lean and bank. Prints a table; --json for the numbers.
//
//   node scripts/motion-qc/feel.mjs [--json] [--carry]   (--carry: the carried stop, src/loco-moves.js STOP_FEEL)       TUNE='{"locomotion.js":{"LOCO":{...}}}' as run.mjs
import * as THREE from 'three';
import { course, traveller } from '../../tests/gait-sim.js';
import { CAM_PLUS_Z } from '../../src/gait-course.js';

/** One measured run: script [secs, input] steps; returns per-frame { t, speed, heading, lean, bank }. */
export async function feelRun(script, { fps = 60, at = [0, 0, 0], stop = 'snap' } = {}) {
  const p = await traveller(course(), new THREE.Vector3(...at), { moves: true, body: 'b3' });
  p.stopFeel = stop;
  const S = [];
  let t = 0;
  for (const [secs, input, tag] of script) {
    for (let i = 0, n = Math.round(secs * fps); i < n; i++) {
      p.update(1 / fps, input, CAM_PLUS_Z);
      const v = p.vel, speed = Math.hypot(v.x, v.z);
      S.push({ t, tag, speed, heading: p.heading, lean: p.loco?.lean ?? 0, bank: p.loco?.bank ?? 0, x: p.pos.x, z: p.pos.z, move: p.moves?.cur?.name ?? null });
      t += 1 / fps;
    }
  }
  return S;
}

const first = (S, from, f) => { for (let i = from; i < S.length; i++) if (f(S[i])) return S[i].t - S[from].t; return null; };
const idx = (S, tag) => S.findIndex((s) => s.tag === tag);

/** The numbers: starts (jog, sprint), stops (jog, sprint), the 180° at a sprint, the curve's bank. */
export async function feel({ stop = 'snap' } = {}) {
  const W = { KeyW: true }, R = { KeyW: true, ShiftLeft: true }, B = { KeyS: true, ShiftLeft: true }, none = {};
  const out = {};
  for (const [name, input, top] of [['jog', W, 3.8], ['sprint', R, 8.2]]) {
    const S = await feelRun([[0.5, none, 'stand'], [2.5, input, 'go'], [1.5, none, 'stop']], { stop });
    const g = idx(S, 'go'), s = idx(S, 'stop');
    let i = s; while (i < S.length - 1 && S[i].speed > 0.05) i++;
    out[name] = { to50: first(S, g, (x) => x.speed > top * 0.5), to90: first(S, g, (x) => x.speed > top * 0.9), stopTime: S[i].t - S[s].t,
      stopDist: Math.hypot(S[i].x - S[s].x, S[i].z - S[s].z), leanMax: Math.max(...S.slice(g, s).map((x) => x.lean)), leanBack: Math.min(...S.slice(s).map((x) => x.lean)) };
  }
  {
    const S = await feelRun([[0.5, none, 'stand'], [2.5, R, 'go'], [1.5, B, 'back']], { stop });
    const b = idx(S, 'back'), h0 = S[b - 1].heading;
    const faced = first(S, b, (x) => Math.cos(x.heading - h0) < -0.95);
    const slowest = S.slice(b, b + 60).reduce((a, x) => Math.min(a, x.speed), Infinity);
    out.reverse = { faced, slowest, leanBack: Math.min(...S.slice(b).map((x) => x.lean)) };
  }
  {
    // the stick round a circle at a sprint: the bank
    const script = [[0.5, {}, 'stand'], [1.5, { stick: { x: 0, y: 1 }, ShiftLeft: true }, 'go']];
    for (let k = 0; k < 120; k++) { const a = k / 120 * Math.PI * 2; script.push([1 / 30, { stick: { x: Math.sin(a), y: Math.cos(a) }, ShiftLeft: true }, 'curve']); }
    const S = await feelRun(script, { stop });
    const c = S.filter((x) => x.tag === 'curve');
    out.curve = { bankMax: Math.max(...c.map((x) => Math.abs(x.bank))), bankMean: c.reduce((a, x) => a + Math.abs(x.bank), 0) / c.length };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.TUNE) for (const [mod, o] of Object.entries(JSON.parse(process.env.TUNE))) { const M = await import(`../../src/${mod}`); for (const [k, v] of Object.entries(o)) Object.assign(M[k], v); }
  const stop = process.argv.includes('--carry') ? 'carry' : 'snap';
  const r = await feel({ stop });
  console.log(`stop feel: ${stop}`);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
  else {
    const f = (x, d = 2) => (x == null ? '-' : x.toFixed(d));
    const deg = (x) => (x * 180 / Math.PI).toFixed(1) + '°';
    for (const k of ['jog', 'sprint']) { const o = r[k]; console.log(`${k.padEnd(7)} start: 50 % in ${f(o.to50)} s, 90 % in ${f(o.to90)} s; stop: ${f(o.stopTime)} s, ${f(o.stopDist)} m; lean ${deg(o.leanMax)} forward, ${deg(-o.leanBack)} back`); }
    console.log(`reverse at a sprint: faced back in ${f(r.reverse.faced)} s, slowest ${f(r.reverse.slowest)} m/s, lean back ${deg(-r.reverse.leanBack)}`);
    console.log(`curve at a sprint: bank ${deg(r.curve.bankMax)} at most, ${deg(r.curve.bankMean)} on average`);
  }
}
