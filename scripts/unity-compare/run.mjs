// The visual check, every step (docs/plans/unity-default-portables.md section 4, D17; docs/systems/engine-bridge.md
// "The visual check"): the views from the game's data (views.mjs), the web's pictures in one muted headless Chrome on
// its own Vite (scripts/design-qc/capture.mjs, High, 1280 × 720, a fixed render scale), Unity's from the editor's batch
// (unity.mjs: -fresh -no-hud, the same views), then the pairs, their heat maps and scores in one HTML report (pair.mjs).
//
//   node scripts/unity-compare/run.mjs [--out dir] [--worlds a,b] [--set main|lantern] [--skip views,web,unity]
//       [--notes notes.json]
//   PORT (the web's Vite, default 5391; never 5173), LOCK (a lock dir shared with other Unity runs), MAX_LOAD (25: each
//   step waits while the machine's 1-minute load is over it)
// Writes <out>/views.json, <out>/web/, <out>/unity/<world>/, <out>/report/index.html (default output/unity-compare/<sha>/).
import { spawnSync, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
const OUT = resolve(arg('out', join(ROOT, 'output/unity-compare', sha)));
const skip = new Set((arg('skip') ?? '').split(',').filter(Boolean));
const worlds = arg('worlds'), set = arg('set', 'main'), MAX_LOAD = +(process.env.MAX_LOAD ?? 25);
if (String(process.env.PORT ?? '') === '5173') throw new Error('5173 is the author’s own dev server: pick another PORT');
mkdirSync(OUT, { recursive: true });
const load = () => +execSync('uptime').toString().match(/load averages?:\s*([\d.]+)/)[1];
const rest = () => { while (load() > MAX_LOAD) { console.log(`load ${load()}: resting`); spawnSync('sleep', ['60']); } };
const step = (name, cmd, env = {}) => {
  console.log(`— ${name}`);
  const r = spawnSync(process.execPath, cmd, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status) throw new Error(`${name} failed (${r.status})`);
};
const views = join(OUT, 'views.json');
if (!skip.has('views')) step('views', ['scripts/unity-compare/views.mjs', views, '--set', set, ...(worlds ? ['--worlds', worlds] : [])]);
if (!skip.has('web')) {
  rest();
  step('the web', ['scripts/design-qc/capture.mjs', join(OUT, 'web'), '--views', views, '--res', '1280x720', '--preset', 'high', '--fixed-scale', '--rest', '10', ...(worlds ? ['--worlds', worlds] : [])],
    { PORT: process.env.PORT ?? '5391', QC_VITE_CACHE: process.env.QC_VITE_CACHE ?? join(ROOT, '.vite-cache/unity-compare') });
}
if (!skip.has('unity')) step('Unity', ['scripts/unity-compare/unity.mjs', views, join(OUT, 'unity'), ...(worlds ? ['--worlds', worlds] : [])]);
step('the pairs', ['scripts/unity-compare/pair.mjs', join(OUT, 'web'), join(OUT, 'unity'), join(OUT, 'report'), '--views', views, ...(arg('notes') ? ['--notes', arg('notes')] : [])]);
console.log(`the report: ${join(OUT, 'report/index.html')}`);
