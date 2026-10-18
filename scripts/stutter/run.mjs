// The stutter harness's runs (issue #468, docs/systems/performance.md "Stutters"): every run of engine/stutter-routes.js
// STUTTER_RUNS (or those named) played by the JS bridge's macOS player, muted, each frame recorded (-stutter), then read
// by scripts/stutter/report.mjs. A run rests while the machine is loaded (MAX_LOAD, the 1-minute load average: other
// agents' builds make spikes of their own), and is played `--repeat` times (the second a warm one: the player's own
// caches, Metal's shader cache).
//
//   node scripts/stutter/run.mjs [ids…] [--out dir] [--quality handheld] [--repeat 2] [--extra "-js-off copy"] [--spike 16.7]
//   APP (default unity/Hiraeth/Builds/bridge-macOS/Hiraeth JS.app), MAX_LOAD (default 12), LIMIT (s a run, default 240)
// Writes <out>/<id>-<k>.unity.tsv, <id>-<k>.js.json, <id>-<k>.log; then the report (<out>/report.md, report.json).
import { spawnSync, execSync } from 'node:child_process';
import { mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUTTER_RUNS } from '../../engine/stutter-routes.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ids = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const OUT = resolve(arg('out', join(ROOT, 'output/stutter/mac')));
const quality = arg('quality', 'high'), repeat = +arg('repeat', 1);
const extra = (arg('extra') ?? '').split(' ').filter(Boolean);
const APP = process.env.APP ?? join(ROOT, 'unity/Hiraeth/Builds/bridge-macOS/Hiraeth JS.app');
const MAX_LOAD = +(process.env.MAX_LOAD ?? 12);
const sleep = (s) => spawnSync('sleep', [String(s)]);
const load = () => +execSync('uptime').toString().match(/load averages?:\s*([\d.]+)/)[1];
const exe = join(APP, 'Contents/MacOS', 'Hiraeth JS');
if (!existsSync(exe)) { console.error(`no player at ${APP} (scripts/unity-export/unity-batch.sh BridgeBuild.Mac)`); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const runs = STUTTER_RUNS.filter((r) => !ids.length || ids.includes(r.id));
for (const run of runs) {
  for (let k = 1; k <= repeat; k++) {
    while (load() > MAX_LOAD) { console.log(`load ${load()}: resting`); sleep(30); }
    const name = `${run.id}-${k}`, prefix = join(OUT, name), log = `${prefix}.log`;
    const t0 = Date.now();
    // (1280 × 720, uncapped as the desktop players are (a cap hides what is shorter than its frame), the debug save the sequence seeds)
    const r = spawnSync(exe, ['-mute', '-screen-width', '1280', '-screen-height', '720', '-screen-fullscreen', '0', '-limit', process.env.LIMIT ?? '240', '-logFile', log,
      '-quality', quality, '-sequence', run.id, '-stutter', prefix, ...extra], { cwd: ROOT, encoding: 'utf8' });
    const ok = existsSync(`${prefix}.unity.tsv`) && existsSync(`${prefix}.js.json`);
    console.log(`${name} (${run.what}): ${ok ? 'recorded' : 'NOT recorded'} in ${((Date.now() - t0) / 1000).toFixed(0)} s, exit ${r.status}`);
    if (!ok && existsSync(log)) copyFileSync(log, `${prefix}.failed.log`);
  }
}
spawnSync(process.execPath, [join(ROOT, 'scripts/stutter/report.mjs'), OUT, '--spike', arg('spike', '16.7')], { stdio: 'inherit' });
process.exit(0);
