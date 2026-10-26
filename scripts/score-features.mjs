// Command-line score report; computations live in the importable core.
import { pathToFileURL } from 'node:url';
import { DISTANCE_WEIGHTS, scoreFeatures, distanceParts, scoreDistance, nearestPairs, renderFeatures } from './score-features-core.mjs';
export { DISTANCE_WEIGHTS, scoreFeatures, distanceParts, scoreDistance, nearestPairs, renderFeatures } from './score-features-core.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const score = await import(process.env.SCORE_MODULE ? pathToFileURL(process.env.SCORE_MODULE).href : '../src/score.js');
  const ids = process.env.IDS ? process.env.IDS.split(',') : Object.keys(score.SCORES);
  const feats = ids.map((id) => scoreFeatures(score, id));
  for (const f of feats) console.log(`${f.id.padEnd(15)} ${String(f.tempo).padStart(3)} bpm ${f.meter}/x  ${f.density.toFixed(2)} notes/s  ${f.drums.toFixed(2)} hits/s  register ${f.register.toFixed(1)}  ${[...f.timbre].join(' ')}`);
  console.log('\nnearest pairs:');
  for (const p of nearestPairs(feats).slice(0, 12)) console.log(`${p.d.toFixed(2)}  ${p.a} ~ ${p.b}   ${Object.entries(p.parts).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ')}`);
  if (process.argv.includes('--render')) {
    console.log('\nrendered (10 s walking, music only):');
    for (const id of ids) { const r = await renderFeatures(id); console.log(`${id.padEnd(15)} ${r.rms.toFixed(1)} dB  peak ${r.peak.toFixed(2)}  low ${r.low.toFixed(2)} mid ${r.mid.toFixed(2)} high ${r.high.toFixed(3)}  ${r.onsets.toFixed(2)} onsets/s`); }
  }
  process.exit(0);
}
