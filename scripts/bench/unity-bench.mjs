// The Unity side of the benchmark on the Mac: the standalone player (BenchBuild.Mac) in its benchmark
// mode (Runtime/Bench.cs): vSync off, no frame cap, FrameTimingManager and ProfilerRecorder.
//   node scripts/bench/unity-bench.mjs --preset high --res 1280x720 --out result.json [--app Memento.app]
//        [--secs 10] [--warmup 3] [--only spawn,camps] [--label run1]
// Adds what the player can't see itself: the process's memory (macOS footprint, sampled), the wall
// clock from launch to the desert's first frame, the build's size.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { ROOT, VIEWPOINTS, memorySampler, sizeOf, sleep } from './lib.mjs';

const opt = Object.fromEntries(process.argv.slice(2).join(' ').split(/\s*--/).filter(Boolean).map((s) => { const [k, ...v] = s.split(/\s+/); return [k, v.join(' ') || true]; }));
const app = resolve(opt.app ?? resolve(ROOT, 'unity/Memento/Builds/macOS-bench/Memento.app'));
const preset = opt.preset ?? 'high';
const [w, h] = (opt.res ?? '1280x720').split('x').map(Number);
const out = resolve(opt.out ?? `unity-${preset}-${w}x${h}.json`);
mkdirSync(dirname(out), { recursive: true });
const raw = out.replace(/\.json$/, '.player.json'), logFile = out.replace(/\.json$/, '.log');
rmSync(raw, { force: true });
const bin = resolve(app, 'Contents/MacOS/Memento');
if (!existsSync(bin)) { console.error(`no player at ${bin}: scripts/unity-export/unity-batch.sh BenchBuild.Mac`); process.exit(1); }

const args = ['-bench', VIEWPOINTS, '-benchOut', raw, '-benchPreset', preset, '-benchRes', `${w}x${h}`, '-benchLabel', String(opt.label ?? ''),
  '-screen-width', String(w), '-screen-height', String(h), '-screen-fullscreen', '0', '-logFile', logFile];
if (opt.secs) args.push('-benchSecs', String(opt.secs));
if (opt.warmup) args.push('-benchWarmup', String(opt.warmup));
if (opt.only) args.push('-benchOnly', String(opt.only));
if (opt.off) args.push('-benchOff', String(opt.off));   // (a diagnosis: those behaviours switched off)
if (opt.paths === '0') args.push('-benchPaths', '0');
if (typeof opt.shots === 'string') args.push('-benchShots', resolve(opt.shots));
if (typeof opt.extra === 'string') args.push(...opt.extra.split(' '));   // (more player arguments, e.g. -benchCounters)
const t0 = Date.now();
const kid = spawn(bin, args, { stdio: 'ignore' });
const mem = memorySampler(() => (kid.exitCode === null ? [kid.pid] : []), 2000);
let firstFrameWall = null;
const watch = (async () => {
  while (kid.exitCode === null) {
    if (!firstFrameWall && existsSync(logFile) && /bench: the desert's first frame/.test(readFileSync(logFile, 'utf8'))) firstFrameWall = (Date.now() - t0) / 1000;
    await sleep(100);
  }
})();
const code = await new Promise((r) => kid.on('exit', r));
await watch;
const m = mem.stop();
if (!existsSync(raw)) { console.error(`the player wrote nothing (exit ${code}); its log: ${logFile}`); process.exit(2); }
const r = JSON.parse(readFileSync(raw, 'utf8'));
const data = resolve(app, 'Contents/Resources/Data');
Object.assign(r, {
  side: 'unity', exit: code, wallSecs: (Date.now() - t0) / 1000,
  load: { ...r.load, firstFrameWall },
  process: { peakFootprintMB: Math.round(m.peak.total / 1e6), peakGraphicsMB: Math.round(m.peak.graphics / 1e6), lastFootprintMB: m.last && Math.round(m.last.total / 1e6) },
  size: { appMB: Math.round(sizeOf(app) / 1e6), streamingAssetsMB: Math.round(sizeOf(resolve(data, 'StreamingAssets')) / 1e6) },
});
writeFileSync(out, JSON.stringify(r) + '\n');
rmSync(raw, { force: true });
for (const v of r.views ?? []) console.log(`unity ${preset} ${w}x${h} ${v.name.padEnd(11)} frame ${v.frame?.median} ms (p95 ${v.frame?.p95}, p99 ${v.frame?.p99}) cpu ${v.cpu?.median} gpu ${v.gpu?.median} draws ${v.draws} batches ${v.batches} tris ${v.tris}`);
console.log(`unity: first frame ${r.load?.firstFrame} s (wall ${firstFrameWall}), peak ${r.process.peakFootprintMB} MB; ${out}`);
process.exit(r.error ? 3 : 0);
