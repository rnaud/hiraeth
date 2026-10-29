#!/usr/bin/env node
// The controller's feel in numbers (issue #699, beside the BotW study in docs/design/locomotion-botw-study.md): the node
// traveller on the gait harness's flat (scripts/motion-qc/runner.mjs) set off, stopped, turned and reversed, and timed
// at 60 frames a second: how long to 50 / 90 % of the gait's speed, how far and how long a stop takes, how long the
// facing takes round a 180° at a run, the body's lean and bank. Prints a table; --json for the numbers.
//
//   node scripts/motion-qc/feel.mjs [--json] [--snap]   (--snap: the old crisp stop; the carried one is the game's, src/loco-moves.js STOP_FEEL)       TUNE='{"locomotion.js":{"LOCO":{...}}}' as run.mjs
// The measurement is feel-core.mjs, which tests import: TUNE's environment-chosen imports stay out of their graph.
import { feel } from './feel-core.mjs';
export * from './feel-core.mjs';

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.TUNE) for (const [mod, o] of Object.entries(JSON.parse(process.env.TUNE))) { const M = await import(`../../src/${mod}`); for (const [k, v] of Object.entries(o)) Object.assign(M[k], v); }
  const stop = process.argv.includes('--snap') ? 'snap' : 'carry';
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
