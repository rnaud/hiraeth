// #800 phase 1: the four trial foes' cost in the Arena (scripts/enemy-roster/bench.mjs), 1 and 6 of each and an empty
// control, High and Handheld, two rounds with the order reversed. One JSON line per run into <out>.
//   node bench-all.mjs <repo> <out.jsonl>
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { loadavg } from 'node:os';
const [ROOT, OUT] = process.argv.slice(2);
const CASES = ['none', 'crab@arzach2', 'hound@eclipse', 'brute@perdide2', 'mummer@desert'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const round of [1, 2]) for (const q of ['high', 'handheld']) for (const c of round === 1 ? CASES : [...CASES].reverse()) for (const n of [1, 6]) {
  if (c === 'none' && n === 6) continue;
  while (loadavg()[0] > 25) await sleep(30000);
  const pack = c === 'none' ? '' : Array(n).fill(c).join(',');
  let r = null;
  try { r = JSON.parse(execFileSync('node', ['scripts/enemy-roster/bench.mjs', '--quality', q, '--seconds', '8', '--pack', pack], { cwd: ROOT, env: { ...process.env, PORT: '5464' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop()); }
  catch (e) { r = { error: String(e).slice(0, 200) }; }
  appendFileSync(OUT, JSON.stringify({ round, case: c, n, q, load: +loadavg()[0].toFixed(1), r }) + '\n');
}
console.log('done');
