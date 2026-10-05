// The whole Mac comparison (scripts/bench/mac-run.sh runs it, then report.mjs): the web game, the Unity
// player and Unity's WebGL build, each over the same viewpoints and paths, alternating, N rounds, every
// run behind the quiet-machine gate (lib.mjs quietCheck) and watched while it records.
//   node scripts/bench/run-all.mjs [--rounds 3] [--configs high@1280x720,handheld@1280x960]
//        [--sides web,unity,unity-webgl] [--secs 10] [--warmup 3] [--paced 0] [--wait 1800] [--strict]
//        [--out scripts/bench/results/mac.json] [--raw <folder for the full runs>]
// Each round: every config on every side uncapped (all views and paths), then the paths again paced
// by the display (vsync, 60 Hz: the stutter a player sees), unless --paced 0.
// A run the gate didn't pass (still busy after --wait seconds), or that saw the machine busy while it
// recorded, is kept but marked invalid (with what was running); --strict stops instead.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, createReadStream } from 'node:fs';
import { resolve, join } from 'node:path';
import { createGzip } from 'node:zlib';
import { ROOT, options, gate, watchQuiet, machine, median, sleep, sizeOf, viewpoints } from './lib.mjs';

const opt = options();
const rounds = +(opt.rounds ?? 3);
const configs = String(opt.configs ?? 'high@1280x720,handheld@1280x960').split(',').map((c) => { const [preset, res] = c.split('@'); return { preset, res }; });
let sides = String(opt.sides ?? 'web,unity,unity-webgl').split(',');
const paced = opt.paced !== '0';
const pathNames = viewpoints().paths.map((p) => p.name).join(',');
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const out = resolve(ROOT, opt.out ?? 'scripts/bench/results/mac.json');
const raw = resolve(opt.raw ?? join(ROOT, 'scripts/bench/results/raw', stamp));
mkdirSync(raw, { recursive: true });
const PORT = 5245;
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
const APP = resolve(ROOT, 'unity/Memento/Builds/macOS-bench/Memento.app'), WEBGL = resolve(ROOT, 'unity/Memento/Builds/WebGL'), APK = resolve(ROOT, 'unity/Memento/Builds/Android/memento-unity.apk');

if (sides.includes('unity') && !existsSync(join(APP, 'Contents/MacOS/Memento'))) { log('no Unity player: scripts/unity-export/unity-batch.sh BenchBuild.Mac'); process.exit(1); }
if (sides.includes('unity-webgl') && !existsSync(join(WEBGL, 'index.html'))) { log('no Unity WebGL build (BenchBuild.WebGL): that column is left out'); sides = sides.filter((s) => s !== 'unity-webgl'); }
if (!existsSync(resolve(ROOT, 'dist/index.html'))) { log('no web build: npx vite build'); process.exit(1); }

// the sizes, once (gzipped as a web server or an archive would carry them)
async function gzSize(p) {
  if (!existsSync(p)) return null;
  const files = []; const walk = (d) => { for (const f of readdirSync(d)) { const q = join(d, f); if (statSync(q).isDirectory()) walk(q); else files.push(q); } };
  if (statSync(p).isDirectory()) walk(p); else files.push(p);
  let total = 0;
  for (const f of files) total += await new Promise((ok) => { let n = 0; createReadStream(f).pipe(createGzip({ level: 6 })).on('data', (c) => { n += c.length; }).on('end', () => ok(n)); });
  return total;
}
log('measuring the builds\' sizes');
const MB = (b) => (b == null ? null : +(b / 1e6).toFixed(1));
const sizes = {
  webDistMB: MB(sizeOf(resolve(ROOT, 'dist'))), webDistGzipMB: MB(await gzSize(resolve(ROOT, 'dist'))),
  unityAppMB: MB(sizeOf(APP)), unityAppGzipMB: MB(await gzSize(APP)), unityExportMB: MB(sizeOf(join(APP, 'Contents/Resources/Data/StreamingAssets'))),
  webglMB: MB(sizeOf(WEBGL)), webglGzipMB: MB(await gzSize(WEBGL)), apkMB: MB(existsSync(APK) ? sizeOf(APK) : null),
};

// our own server (dist/ and the WebGL build) on 5245
const server = spawn(process.execPath, [resolve(ROOT, 'scripts/bench/serve.mjs'), '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok, fail) => { server.stdout.once('data', ok); server.once('exit', (c) => fail(new Error(`the server stopped (${c}): is port ${PORT} taken?`))); });
const stopServer = () => { try { server.kill(); } catch { /* */ } };
process.on('exit', stopServer);

const SCRIPT = { web: 'web-bench.mjs', unity: 'unity-bench.mjs', 'unity-webgl': 'unity-webgl-bench.mjs' };
function runOne(side, cfg, mode, file) {
  const args = [resolve(ROOT, 'scripts/bench', SCRIPT[side]), '--preset', cfg.preset, '--res', cfg.res, '--out', file];
  if (opt.secs) args.push('--secs', String(opt.secs));
  if (opt.warmup) args.push('--warmup', String(opt.warmup));
  if (mode === 'paced') args.push('--paced', '1', '--only', pathNames);
  else if (typeof opt.only === 'string') args.push('--only', opt.only);
  if (side === 'web' || side === 'unity-webgl') args.push('--url', `http://localhost:${PORT}/${side === 'web' ? '' : 'unity-webgl/'}`);
  return new Promise((done) => { spawn(process.execPath, args, { stdio: ['ignore', 'inherit', 'inherit'] }).on('exit', (code) => done(code)); });
}

const runs = [];
const t0 = Date.now();
for (let r = 0; r < rounds; r++) {
  // alternate: each round starts with the next side
  const order = sides.map((_, i) => sides[(i + r) % sides.length]);
  const jobs = [];
  for (const cfg of configs) for (const side of order) jobs.push({ side, cfg, mode: 'uncapped' });
  if (paced) for (const cfg of configs) for (const side of order) jobs.push({ side, cfg, mode: 'paced' });
  for (const { side, cfg, mode } of jobs) {
    const file = join(raw, `${side}-${cfg.preset}-${cfg.res}-${mode}-r${r + 1}.json`);
    const g = await gate({ mine: [server.pid], maxWait: +(opt.wait ?? 1800), log });
    if (!g.quiet && opt.strict) { log(`not quiet after ${g.waited} s (${g.reasons.join(', ')}): stopping (--strict)`); process.exit(4); }
    log(`round ${r + 1}/${rounds} ${side} ${cfg.preset} ${cfg.res} ${mode}${g.quiet ? '' : `: NOT QUIET (${g.reasons.join(', ')}), marked invalid`}`);
    const watch = watchQuiet({ mine: () => [server.pid], every: 5 });
    const code = await runOne(side, cfg, mode, file);
    const w = watch.stop();
    const res = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { error: `exit ${code}` };
    const reasons = [...new Set([...(g.quiet ? [] : g.reasons), ...w.bad.flatMap((b) => b.reasons)])];
    res.gate = { quietBefore: g.quiet, waited: g.waited, load: g.load, power: g.power, thermal: g.thermal, idle: g.idle, seenBefore: g.seen.slice(0, 10), checks: w.checks, busyDuring: w.bad.slice(0, 10) };
    res.invalid = reasons.length > 0 || !!res.error;
    res.invalidReasons = res.error ? [String(res.error), ...reasons] : reasons;
    res.round = r + 1; res.mode = mode;
    writeFileSync(file, JSON.stringify(res) + '\n');
    runs.push({ side, preset: cfg.preset, res: cfg.res, mode, round: r + 1, file, data: res });
    await sleep(3000);   // (a breath between runs)
  }
}
stopServer();

// ------------------------------------------------------------------ the summary (the committed JSON: no per-frame lists)
const pick = (v, side) => {
  // the frame as each side measures it best: the page's own intervals for the WebGL build (Unity's
  // unscaledDeltaTime there is whole milliseconds), the player's or the page's otherwise
  const web = side === 'unity-webgl' && v.page;
  const f = web ? v.page.frame : v.frame, cpu = web ? v.page.cpu : v.cpu;
  const rawF = v.raw?.frame ?? [];
  return { fps: web ? v.page.fps : v.fps, mean: f?.mean, median: f?.median, p95: f?.p95, p99: f?.p99, max: f?.max, cpu: cpu?.median, cpuP95: cpu?.p95,
    gpu: v.gpu?.median, gpuP95: v.gpu?.p95, main: v.main?.median, renderThread: v.renderThread?.median, draws: v.draws, tris: v.tris,
    hitches: web ? v.page.hitches : v.hitches, over20: rawF.length ? (100 * rawF.filter((x) => x > 20).length) / rawF.length : null, frames: v.frames };
};
const spread = (xs) => { const a = xs.filter(Number.isFinite); return a.length ? { med: +median(a).toFixed(3), min: +Math.min(...a).toFixed(3), max: +Math.max(...a).toFixed(3), n: a.length } : null; };
const summary = {
  about: 'Memento: web (three.js) vs Unity (URP) vs Unity WebGL on the same desert viewpoints; docs/benchmark-web-vs-unity.md', time: new Date().toISOString(), minutes: +((Date.now() - t0) / 60000).toFixed(1),
  machine: machine(), rounds, configs, sides, paced, sizes, invalidRuns: runs.filter((x) => x.data.invalid).length,
  runs: runs.map(({ side, preset, res, mode, round, data: d }) => ({ side, preset, res, mode, round, invalid: d.invalid, reasons: d.invalidReasons, gate: d.gate, load: d.load, process: d.process, size: d.size,
    gl: d.gl?.renderer ?? d.gpu, api: d.api, scripting: d.scripting, development: d.development, canvas: d.canvas ?? d.screen, renderScale: d.renderScale, shadows: d.shadows, gpuEstimate: d.gpuEstimate,
    memView: d.views?.map((v) => ({ name: v.name, ...v.mem })), error: d.error })),
  results: [],
};
for (const mode of ['uncapped', 'paced']) for (const cfg of configs) for (const side of sides) {
  const mine = runs.filter((x) => x.side === side && x.preset === cfg.preset && x.res === cfg.res && x.mode === mode);
  if (!mine.length) continue;
  const valid = mine.filter((x) => !x.data.invalid);
  const names = [...new Set(mine.flatMap((x) => (x.data.views ?? []).map((v) => v.name)))];
  for (const name of names) {
    const per = (list) => list.map((x) => x.data.views?.find((v) => v.name === name)).filter(Boolean).map((v) => pick(v, side));
    const perValid = per(valid), use = perValid.length ? perValid : per(mine);
    const s = {};
    for (const k of ['fps', 'mean', 'median', 'p95', 'p99', 'max', 'cpu', 'cpuP95', 'gpu', 'gpuP95', 'main', 'renderThread', 'draws', 'tris', 'hitches', 'over20']) s[k] = spread(use.map((p) => p[k]));
    summary.results.push({ mode, side, preset: cfg.preset, res: cfg.res, view: name, kind: mine[0].data.views?.find((v) => v.name === name)?.kind, runs: use.length, allInvalid: !perValid.length, ...s });
  }
}
mkdirSync(resolve(out, '..'), { recursive: true });
writeFileSync(out, JSON.stringify(summary, null, 1) + '\n');
log(`${runs.length} runs (${summary.invalidRuns} invalid) in ${summary.minutes} min; summary ${out}; full runs in ${raw}`);
process.exit(0);
