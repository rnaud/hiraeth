// #800 family G: six of each rebuilt foe in the Arena, before (a commit) and after (this checkout), High and the Steam Deck
// preset, alternating, each run started under load 25 (scripts/enemy-roster/bench.mjs); the lines appended to <out.jsonl>.
//   node references/enemy-redesign-2026-10-30/trials/familyG-tripo/bench-g.mjs <before-sha> <out.jsonl> [kinds] [rounds]
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { loadavg } from 'node:os';

const [before, out, kindsArg = 'mummerking,sentinel,hulk', rounds = '1'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const runs = [];
for (let r = 0; r < +rounds; r++) for (const kind of ['none', ...kindsArg.split(',')]) for (const quality of ['high', 'deck']) {
  const order = (r + runs.length) % 2 ? ['after', 'before'] : ['before', 'after'];
  for (const which of order) runs.push({ kind, quality, which, round: r });
}
for (const R of runs) {
  while (loadavg()[0] > 25) await sleep(10000);
  const pack = R.kind === 'none' ? 'none' : Array.from({ length: 6 }, () => `${R.kind}@desert`).join(',');
  const args = ['scripts/enemy-roster/bench.mjs', '--quality', R.quality, '--pack', pack, '--seconds', '6', ...(R.which === 'before' ? ['--commit', before] : [])];
  const res = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, PORT: process.env.PORT ?? '5494' }, timeout: 600000 });
  const text = (res.stdout ?? '') + (res.stderr ?? '');
  let J = null; for (const l of text.trim().split('\n').reverse()) { try { J = JSON.parse(l); break; } catch { /* not the result */ } }
  const line = { ...R, load: +loadavg()[0].toFixed(1), frame: J?.frame, cpu: J?.cpu, gpu: J?.gpu, calls: J?.calls, tris: J?.tris, made: J?.made?.length, errors: J?.errors?.length ?? text.slice(-300) };
  appendFileSync(out, JSON.stringify(line) + '\n');
  console.log(JSON.stringify(line));
}
