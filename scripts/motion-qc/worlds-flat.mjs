#!/usr/bin/env node
// The worlds' course on node's flat ground at the game's uneven frames (scenarios.mjs WORLDS_FLAT, unevenFrames), a few seeds:
// the game's reds in seconds, without a browser (issue #47's sixth round; issue #699's loop).
//   node scripts/motion-qc/worlds-flat.mjs [--seeds 1,2,3,4,5,6] [--verbose]     TUNE='{...}' as run.mjs
import { runScenario } from './runner.mjs';
import { WORLDS_FLAT, unevenFrames } from './scenarios.mjs';

const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
if (process.env.TUNE) for (const [mod, o] of Object.entries(JSON.parse(process.env.TUNE))) { const M = await import(`../../src/${mod}`); for (const [k, v] of Object.entries(o)) Object.assign(M[k], v); }
const seeds = arg('seeds', '1,2,3,4,5,6').split(',').map(Number);
const sum = { red: 0, pops: 0, jolts: 0, bound: 0, slide: 0 };
for (const seed of seeds) {
  const { r } = await runScenario(WORLDS_FLAT, 'moves', { body: 'b3', frames: unevenFrames(seed) });
  const m = r.measures;
  sum.red += r.green ? 0 : 1; sum.pops += m.popsPerMin; sum.jolts += m.joltsPerMin; sum.bound = Math.max(sum.bound, m.boundaryMax); sum.slide += m.slideP95;
  console.log(`seed ${seed}: ${r.green ? 'green' : 'RED'} slide ${(m.slideP95 * 100).toFixed(1)}/${(m.slideMax * 100).toFixed(1)} held ${(m.held * 100).toFixed(1)} pops ${m.popsPerMin.toFixed(0)} jolts ${m.joltsPerMin.toFixed(0)} boundary ${(m.boundaryMax * 100).toFixed(1)} stop ${m.stop?.toFixed(2)} ${r.fails.join(' ')}`);
  if (args.includes('--verbose')) for (const w of r.worst.slice(0, 5)) console.log('   ', w.what);
}
console.log(`red ${sum.red}/${seeds.length}, pops ${(sum.pops / seeds.length).toFixed(1)}/min, jolts ${(sum.jolts / seeds.length).toFixed(1)}/min, worst boundary ${(sum.bound * 100).toFixed(1)} cm, slide p95 ${(sum.slide / seeds.length * 100).toFixed(1)} cm`);
