// #800 phase 2: the trial variants' cost in the Arena (scripts/enemy-roster/bench.mjs --variant), as phase 1's
// bench-all.mjs measured the current four: 1 and 6 of each variant and an empty control, High and Handheld, two rounds
// with the order reversed, the load waited out over 25. One JSON line per run into <out>.
//   node references/enemy-redesign-2026-10-30/trials/bench-trial.mjs <out.jsonl> [crab@arzach2] [current,direct,tripo]
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const [OUT, FOE = 'crab@arzach2', LIST = 'current,direct,tripo'] = process.argv.slice(2);
const VARIANTS = LIST.split(',');
const CASES = [['none', 'current'], ...VARIANTS.map((v) => [FOE, v])];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const round of [1, 2]) for (const q of ['high', 'handheld']) for (const [c, v] of round === 1 ? CASES : [...CASES].reverse()) for (const n of [1, 6]) {
  if (c === 'none' && n === 6) continue;
  while (loadavg()[0] > 25) await sleep(30000);
  const pack = c === 'none' ? '' : Array(n).fill(c).join(',');
  let r = null;
  try { r = JSON.parse(execFileSync('node', ['scripts/enemy-roster/bench.mjs', '--quality', q, '--seconds', '8', '--pack', pack, '--variant', v], { cwd: ROOT, env: { ...process.env, PORT: process.env.PORT ?? '5492' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop()); }
  catch (e) { r = { error: String(e).slice(0, 200) }; }
  appendFileSync(OUT, JSON.stringify({ round, case: c, variant: v, n, q, load: +loadavg()[0].toFixed(1), r }) + '\n');
  console.log(round, q, c, v, n, r?.calls ?? r?.error);
}
console.log('done');
