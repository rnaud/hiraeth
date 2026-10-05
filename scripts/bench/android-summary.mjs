// The handheld run's results in one file (scripts/bench/results/android.json, read by report.mjs):
//   node scripts/bench/android-summary.mjs scripts/bench/results/android-<date>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ROOT } from './lib.mjs';

const dir = resolve(process.argv[2]);
const rows = [], runs = [];
for (const f of readdirSync(dir).filter((x) => /^(unity|web)-\w+\.json$/.test(x))) {
  const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const side = r.side ?? (f.startsWith('unity') ? 'android-unity' : 'android-web');
  runs.push({ file: f, side, preset: r.preset, device: r.deviceModel ?? r.device, api: r.api ?? r.gl?.renderer, screen: r.screen ?? r.canvas, scripting: r.scripting, load: r.load, meminfo: r.meminfo ?? r.chromeMeminfo, thermalEnd: r.thermalEnd, error: r.error });
  for (const v of r.views ?? []) {
    const raw = v.raw?.frame ?? [];
    rows.push({ side, preset: r.preset, view: v.name, kind: v.kind, fps: v.fps, mean: v.frame?.mean, median: v.frame?.median, p95: v.frame?.p95, p99: v.frame?.p99,
      over20: raw.length ? +(raw.filter((x) => x > 20).length / raw.length * 100).toFixed(1) : null,   // frames that missed a 60 Hz refresh (%)
      cpu: v.cpu?.median, gpu: v.gpu?.median, gpuBusy: v.gpuBusy, gpuMHz: v.gpuMHz, draws: v.draws, tris: v.tris, hitches: v.hitches });
  }
}
const out = resolve(ROOT, 'scripts/bench/results/android.json');
writeFileSync(out, JSON.stringify({ about: 'Memento on the handheld: the Unity APK and the web game in Chrome (android-run.sh)', from: dir, time: new Date().toISOString(), runs, rows }, null, 1) + '\n');
for (const r of rows) console.log(`${r.side.padEnd(14)} ${String(r.preset).padEnd(9)} ${r.view.padEnd(11)} fps ${r.fps} median ${r.median} p95 ${r.p95} p99 ${r.p99} >20ms ${r.over20}% cpu ${r.cpu} gpu ${r.gpu} busy ${r.gpuBusy}% ${r.gpuMHz} MHz draws ${r.draws} tris ${r.tris}`);
console.log(`wrote ${out}`);
