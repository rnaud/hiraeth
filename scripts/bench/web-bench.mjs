// The web side of the benchmark on the Mac: the three.js game in real Chrome on the GPU (browser.mjs),
// the same viewpoints and paths as the Unity player (viewpoints.json), the same hour and weather, the
// HUD hidden (web-page.mjs). Uncapped: Chrome runs without vsync or a frame-rate limit, so
// requestAnimationFrame comes as fast as a frame is done; each frame's interval, its CPU time (the
// game's frame() and anything else on that animation frame) and its GPU time
// (EXT_disjoint_timer_query_webgl2) are recorded.
//   npx vite build && node scripts/bench/serve.mjs &
//   node scripts/bench/web-bench.mjs --preset high --res 1280x720 --out result.json [--url http://localhost:5245/]
//        [--secs 10] [--warmup 3] [--only spawn,camps] [--paths 0] [--shots dir] [--label run1]
// --preset high | handheld: the game's own Graphics presets, at a fixed render scale (High 1.0, not its
// usual 1.5× supersampling; Handheld 0.75, without its dynamic resolution) so both sides draw the
// same number of pixels (docs/benchmark-web-vs-unity.md).
import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { ROOT, options, viewpoints, memorySampler, sizeOf, sleep } from './lib.mjs';
import { launch, glInfo } from './browser.mjs';
import { SCALE, prepareStorage, conditions, runAll, gpuEstimate } from './web-page.mjs';

const opt = options();
const BASE = (opt.url ?? 'http://localhost:5245/').replace(/\/?$/, '/');
const preset = opt.preset ?? 'high';
const [w, h] = (opt.res ?? '1280x720').split('x').map(Number);
const out = resolve(opt.out ?? `web-${preset}-${w}x${h}.json`);
mkdirSync(dirname(out), { recursive: true });
const VP = viewpoints();
const secs = +(opt.secs ?? VP.secs), warmup = +(opt.warmup ?? VP.warmup);
const shots = typeof opt.shots === 'string' ? resolve(opt.shots) : null;
if (shots) mkdirSync(shots, { recursive: true });

const profile = resolve(dirname(out), `.chrome-${process.pid}`);
const { ctx, page, pids } = await launch({ w, h, profile, paced: !!opt.paced });
const ev = (fn, arg) => page.evaluate(fn, arg);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const mem = memorySampler(pids, 3000);

await page.goto(BASE + 'manifest.webmanifest');
const gl = await glInfo(page);
if (/SwiftShader|llvmpipe|Software/i.test(gl.renderer ?? '')) { console.error('software rendering: ' + gl.renderer); process.exit(2); }
await prepareStorage(ev, preset);

const t0 = Date.now();
await page.goto(BASE + '?level=desert', { waitUntil: 'load' });
await page.waitForFunction(() => window.__moebiusBooted && window.renderFrame && window.player, null, { timeout: 300000, polling: 100 });
const wallLoad = (Date.now() - t0) / 1000;
const load = await ev(() => ({
  firstFrame: (window.__moebiusBootedAt ?? NaN) / 1000,
  resources: performance.getEntriesByType('resource').map((r) => ({ url: r.name, bytes: r.decodedBodySize })),
}));
await sleep(4000);
const canvas = await conditions(ev, { hour: VP.hour, weather: VP.weather, scale: SCALE[preset] ?? 1 });
const views = await runAll(ev, VP, {
  secs, warmup, only: typeof opt.only === 'string' ? opt.only.split(',') : null, paths: opt.paths !== '0', tag: `web ${preset} ${w}x${h}`,
  onEach: async (name) => { if (shots) await page.screenshot({ path: join(shots, `web-${preset}-${name}.png`) }); return {}; },
});
const gpuEst = await gpuEstimate(ev);
const m = mem.stop();
await ctx.close();
rmSync(profile, { recursive: true, force: true });

// what the desert downloads: the files it fetched, their size and their size gzipped (as GitHub Pages serves them)
const dist = resolve(ROOT, 'dist');
let fetched = 0, gz = 0;
for (const r of load.resources) {
  const u = new URL(r.url); if (u.origin !== new URL(BASE).origin) continue;
  const f = join(dist, decodeURIComponent(u.pathname));
  if (existsSync(f)) { try { const b = readFileSync(f); fetched += b.length; gz += gzipSync(b, { level: 6 }).length; } catch { /* a folder */ } }
}
const result = {
  engine: 'web', side: 'web', paced: !!opt.paced, preset, screen: [w, h], renderScale: SCALE[preset] ?? 1, canvas, gl, label: opt.label ?? '', time: new Date().toISOString(),
  load: { firstFrame: load.firstFrame, firstFrameWall: wallLoad },
  process: { peakFootprintMB: Math.round(m.peak.total / 1e6), peakGraphicsMB: Math.round(m.peak.graphics / 1e6), processes: m.peak.processes },
  gpuEstimate: gpuEst, errors: errors.slice(0, 5),
  size: { distMB: +(sizeOf(dist) / 1e6).toFixed(1), fetchedMB: +(fetched / 1e6).toFixed(1), fetchedGzipMB: +(gz / 1e6).toFixed(1), files: load.resources.length },
  views,
};
writeFileSync(out, JSON.stringify(result) + '\n');
console.log(`web: first frame ${load.firstFrame?.toFixed(2)} s after navigation (wall ${wallLoad}), canvas ${canvas.join('×')}, peak ${result.process.peakFootprintMB} MB; ${out}`);
process.exit(0);
