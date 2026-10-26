// Two builds' play recordings (scripts/tech-audit/play.mjs) world by world, interleaved (A, B, A, B…), each run only
// while the machine is quiet (the 1-minute load under --max-load, waited for and written down with the run): the A/B
// of docs/audits/technical-v2.28.md. One merged file per build: <out>/<name>.json (play.mjs's form, every run of a
// world kept as its own entry, `run` numbered).
//   PORT=5425 node scripts/tech-audit/ab.mjs --a before=<dist dir> --b after=<dist dir> --out <dir> [--worlds desert,arzach]
//        [--runs 2] [--preset high] [--max-load 10] [--res 1280x720] [--extra "--sweep 12"] (more of play.mjs's arguments)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { loadavg } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const builds = ['a', 'b'].map((k) => { const [name, dir] = arg(k).split('='); return { name, dir }; });
const EXTRA = (arg('extra') ?? '').split(' ').filter(Boolean), OUT = resolve(arg('out', '.')), RUNS = +arg('runs', 2), PRESET = arg('preset', 'high'), MAX = +arg('max-load', 10), RES = arg('res', '1280x720');
const route = await import(join(ROOT, 'src/levels/names.js'));
const WORLDS = (arg('worlds') ?? [...route.ORDER, 'home'].join(',')).split(',');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const merged = Object.fromEntries(builds.map((b) => {
  const f = join(OUT, `${b.name}.json`);
  return [b.name, existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null];
}));

for (const world of WORLDS) for (let run = 1; run <= RUNS; run++) for (const b of (run % 2 ? builds : [...builds].reverse())) {
  if (merged[b.name]?.worlds.some((w) => w.world === world && w.run === run)) continue;   // (done before: a rerun picks up)
  let waited = 0;
  while (loadavg()[0] > MAX) { if (waited % 60 === 0) console.log(`load ${loadavg()[0].toFixed(1)} > ${MAX}: waiting (${world} ${b.name} #${run})`); await sleep(10000); waited += 10; }
  const tmp = join(OUT, `.${b.name}-${world}-${run}.json`);
  execFileSync(process.execPath, [join(ROOT, 'scripts/tech-audit/play.mjs'), '--worlds', world, '--dist', b.dir, '--preset', PRESET, '--res', RES, '--out', tmp, ...EXTRA], { stdio: 'inherit', env: process.env });
  const r = JSON.parse(readFileSync(tmp, 'utf8'));
  merged[b.name] ??= { ...r, worlds: [] };
  for (const w of r.worlds) merged[b.name].worlds.push({ ...w, run, load: r.load, load_after: r.load_after });
  writeFileSync(join(OUT, `${b.name}.json`), JSON.stringify(merged[b.name]));
}
console.log('done', OUT);
