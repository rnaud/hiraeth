// The web side of the benchmark on the handheld: the game in the device's Chrome, driven over the
// DevTools protocol (scripts/handheld-perf/lib.mjs), with exactly the page logic of the Mac run
// (web-page.mjs, browser.mjs INSTRUMENT). android-run.sh sets up the ports and the tab; alone:
//   adb reverse tcp:5219 tcp:5219; adb forward tcp:9339 localabstract:chrome_devtools_remote
//   node scripts/bench/serve.mjs --port 5219 &
//   adb shell am start -a android.intent.action.VIEW -d http://localhost:5219/manifest.webmanifest com.android.chrome
//   PERF_PORT=5219 node scripts/bench/android-web.mjs --preset handheld --out result.json
// Chrome on Android paces frames to the screen (60 Hz): the frame times are capped there, as the Unity
// APK's are; the GPU's busy share and clock (Qualcomm kgsl, sampled once a second) are the GPU number
// both sides share.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { options, viewpoints, sleep } from './lib.mjs';
import { INSTRUMENT } from './browser.mjs';
import { SCALE, prepareStorage, conditions, runAll, gpuEstimate } from './web-page.mjs';
import { ourPage, fullscreen, BASE, thermal, ADB, sh } from '../handheld-perf/lib.mjs';

const opt = options();
const preset = opt.preset ?? 'handheld';
const out = resolve(opt.out ?? `android-web-${preset}.json`);
mkdirSync(dirname(out), { recursive: true });
const VP = viewpoints();
const secs = +(opt.secs ?? VP.secs), warmup = +(opt.warmup ?? VP.warmup);

/** the GPU's busy share and clock once a second (Qualcomm kgsl) */
export function gpuSampler() {
  const kid = spawn(ADB[0], [...ADB.slice(1), 'shell', 'while true; do echo $(cat /sys/class/kgsl/kgsl-3d0/gpu_busy_percentage) $(cat /sys/class/kgsl/kgsl-3d0/devfreq/cur_freq); sleep 1; done']);
  let rows = [], buf = '';
  kid.stdout.on('data', (d) => { buf += d; const ls = buf.split('\n'); buf = ls.pop(); for (const l of ls) { const m = l.match(/(\d+)\s*%\s+(\d+)/); if (m) rows.push([+m[1], +m[2] / 1e6]); } });
  const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : null);
  return { mark() { rows = []; }, take() { const r = { gpuBusy: med(rows.map((x) => x[0])), gpuMHz: med(rows.map((x) => x[1])) }; rows = []; return r; }, stop() { kid.kill(); } };
}

const page = await ourPage();
const ev = (fn, arg) => page.eval(fn, arg);
const errors = [];
page.log = (type, t) => { if (type === 'exception' || type === 'error') errors.push(t.slice(0, 160)); };
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT });
await page.goto(BASE + 'manifest.webmanifest');
await prepareStorage(ev, preset);
await page.goto(BASE + '?level=desert');
await page.waitFor('!!(window.__moebiusBooted && window.renderFrame && window.player)', 300000, 250);
const load = await page.eval('(window.__moebiusBootedAt ?? NaN) / 1000');
await fullscreen(page);
await sleep(5000);
const canvas = await conditions(ev, { hour: VP.hour, weather: VP.weather, scale: SCALE[preset] ?? 0.75 });
const gl = await page.eval(`(() => { const gl = window.renderer.getContext(); const d = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null, timerQuery: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'), ua: navigator.userAgent, dpr: devicePixelRatio, view: innerWidth + 'x' + innerHeight }; })()`);
const gs = gpuSampler();
const views = await runAll(ev, VP, {
  secs, warmup, only: typeof opt.only === 'string' ? opt.only.split(',') : null, paths: opt.paths !== '0', tag: `android web ${preset}`,
  onEach: async () => { const g = gs.take(); const th = thermal(); return { ...g, gpuC: +th['gpuss-0'] / 1000, cpuC: +th['cpu-1-0'] / 1000, thermal: th.Thermal }; },
});
gs.stop();
const gpuEst = await gpuEstimate(ev);
const meminfo = sh('dumpsys meminfo com.android.chrome | grep -E "TOTAL PSS|TOTAL:" | head -2').trim();
page.close();
const result = { engine: 'web', side: 'android-web', device: sh('getprop ro.product.model').trim(), android: sh('getprop ro.build.version.release').trim(), preset, canvas, gl,
  load: { firstFrame: load }, gpuEstimate: gpuEst, chromeMeminfo: meminfo, errors: errors.slice(0, 5), time: new Date().toISOString(), views };
writeFileSync(out, JSON.stringify(result) + '\n');
console.log(`android web: first frame ${load?.toFixed?.(2)} s, canvas ${canvas?.join('×')}; ${out}`);
process.exit(0);
