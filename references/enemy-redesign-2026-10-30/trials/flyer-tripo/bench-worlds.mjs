// #800 family B: a flyer's cost in real worlds, before and after (the skill's "Bench in real worlds"): six of one skin
// over its world (scripts/enemy-roster/bench.mjs --level <world> --pack …), against the same world with none, High and
// Handheld, at the commit before (git archive) and this checkout, alternating, `rounds` times; each run waits for the
// machine's load to fall under 25. Writes one JSON line a run to <out.jsonl> and prints the medians' table.
//
//   PORT=54xx node bench-worlds.mjs <out.jsonl> <before-commit> <kind@skin:world> [<kind@skin:world> …] [--rounds 2]
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { loadavg } from 'node:os';
import { join, resolve } from 'node:path';

if (process.env.PORT === '5173') throw new Error('never 5173');
const argv = process.argv.slice(2), ri = argv.indexOf('--rounds'), ROUNDS = ri >= 0 ? +argv.splice(ri, 2)[1] : 2;
const [OUT, BEFORE, ...CASES] = argv;
const ROOT = resolve(new URL('../../../..', import.meta.url).pathname);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = async (args) => {
  while (loadavg()[0] > 25) { console.log('load', loadavg()[0].toFixed(1), 'waiting'); await sleep(30000); }
  const out = execFileSync('node', [join(ROOT, 'scripts/enemy-roster/bench.mjs'), ...args], { cwd: ROOT, encoding: 'utf8', env: process.env, maxBuffer: 1 << 26 });
  const line = out.trim().split('\n').filter((l) => l.startsWith('{')).at(-1);
  return JSON.parse(line);
};
for (let round = 0; round < ROUNDS; round++) for (const c of CASES) {
  const [id, world] = c.split(':');
  for (const quality of ['high', 'handheld']) {
    const order = round % 2 ? ['after', 'before', 'none'] : ['before', 'after', 'none'];
    for (const what of order) {
      const args = ['--quality', quality, '--level', world, '--pack', what === 'none' ? 'none' : Array(6).fill(id).join(','), ...(what === 'before' ? ['--commit', BEFORE] : [])];
      const r = await run(args);
      const rec = { round, id, world, quality, what, load: +loadavg()[0].toFixed(1), calls: r.calls, tris: r.tris, cpu: r.cpu, gpu: r.gpu, frame: r.frame, made: r.made?.length ?? r.made, memory: r.memory, errors: r.errors };
      appendFileSync(OUT, JSON.stringify(rec) + '\n');
      console.log(JSON.stringify(rec));
    }
  }
}
// the table: medians over rounds, after the world's own (none) taken off
const rows = readFileSync(OUT, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
for (const c of CASES) for (const quality of ['high', 'handheld']) {
  const [id, world] = c.split(':');
  const pick = (what, k) => med(rows.filter((r) => r.id === id && r.world === world && r.quality === quality && r.what === what).map((r) => r[k]));
  const add = (what, k) => +(pick(what, k) - pick('none', k)).toFixed(2);
  console.log(`${id} in ${world}, ${quality}: draws +${add('before', 'calls')} → +${add('after', 'calls')}; tris +${(add('before', 'tris') / 1000).toFixed(1)}k → +${(add('after', 'tris') / 1000).toFixed(1)}k; cpu +${add('before', 'cpu')} → +${add('after', 'cpu')} ms; foe geometry ${med(rows.filter((r) => r.id === id && r.world === world && r.quality === quality && r.what === 'before').map((r) => r.memory?.foeGeometryMB + r.memory?.foeTextureMB))} → ${med(rows.filter((r) => r.id === id && r.world === world && r.quality === quality && r.what === 'after').map((r) => r.memory?.foeGeometryMB + r.memory?.foeTextureMB))} MB`);
}
if (!existsSync(OUT)) process.exit(1);
