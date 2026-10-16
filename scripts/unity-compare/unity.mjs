// The visual check's Unity side (scripts/unity-compare/, D17): the views file (views.mjs) shot world by world by the
// JS bridge in the Unity editor's batch run, muted, at a preset (scripts/unity-js-run.sh: BridgeBatch.Run -level <id>
// -views <file> -out <dir>), 1280 × 720 as the web's side. A view's `flags` (the lantern set's worlds done) go to the
// debug save first (-set-flags). One Unity at a time on a shared Mac: LOCK, a directory taken with mkdir and given
// back when Unity exits; and a rest while the machine is loaded (MAX_LOAD, the 1-minute load average).
//
//   node scripts/unity-compare/unity.mjs <views.json> <out-dir> [--worlds a,b] [--quality high] [--extra "-js-off skies"]
//   LOCK=<dir> (a lock shared with other agents' Unity runs), MAX_LOAD (default 25)
// Writes <out-dir>/<world>/unity-<view>.png and <out-dir>/<world>.log.
import { spawnSync, execSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const [viewsFile, outDir] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const V = JSON.parse(readFileSync(resolve(viewsFile), 'utf8'));
const OUT = resolve(outDir ?? join(ROOT, 'output/unity-compare/unity'));
const only = arg('worlds')?.split(','), quality = arg('quality', 'high');
const extra = (arg('extra') ?? '').split(' ').filter(Boolean);   // (more of the bridge's arguments: --extra "-js-off skies", a before)
const LOCK = process.env.LOCK, MAX_LOAD = +(process.env.MAX_LOAD ?? 25);
const sleep = (s) => spawnSync('sleep', [String(s)]);
const load = () => +execSync('uptime').toString().match(/load averages?:\s*([\d.]+)/)[1];

function take() {
  if (!LOCK) return;
  for (;;) { try { mkdirSync(LOCK); break; } catch { sleep(60); } }
  writeFileSync(join(LOCK, 'owner'), `${process.pid} compare\n`);
}
const give = () => { if (LOCK) rmSync(LOCK, { recursive: true, force: true }); };
process.on('SIGINT', () => { give(); process.exit(130); });

for (const [world, { views }] of Object.entries(V.worlds)) {
  if (only && !only.includes(world)) continue;
  const dir = join(OUT, world);
  mkdirSync(dir, { recursive: true });
  const flags = [...new Set(views.flatMap((v) => Object.keys(v.flags ?? {})))];
  while (load() > MAX_LOAD) { console.log(`load ${load()}: resting`); sleep(60); }
  take();
  const t0 = Date.now();
  let r;
  try {
    r = spawnSync(join(ROOT, 'scripts/unity-js-run.sh'), [`compare-${world}`, '-level', world, '-views', resolve(viewsFile), '-out', dir, '-quality', quality, '-fresh', '-no-hud', ...(flags.length ? ['-set-flags', flags.join(',')] : []), ...extra],
      { cwd: ROOT, env: { ...process.env, LIMIT: process.env.LIMIT ?? '900', TAIL: '200' }, encoding: 'utf8' });
  } finally { give(); }
  const log = join(ROOT, `output/engine-bridge/unity-compare-${world}.log`);
  if (existsSync(log)) copyFileSync(log, join(OUT, `${world}.log`));
  const saved = (r.stdout.match(/saved /g) ?? []).length;
  console.log(`${world}: ${saved} of ${views.length} pictures in ${((Date.now() - t0) / 1000).toFixed(0)} s${saved < views.length ? `\n${r.stdout.split('\n').filter((l) => /error|Exception|failed|no temple/i.test(l)).slice(0, 8).join('\n')}` : ''}`);
}
process.exit(0);
