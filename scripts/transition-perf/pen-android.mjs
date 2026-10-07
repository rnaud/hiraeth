// Does the loading pen turn smoothly through a world's load on the handheld? (docs/systems/performance.md,
// "The loading pen"). In the GeckoView test app (com.rnaud.moebius.gecko, scripts/bench/gecko-apk.sh), the game
// served from this Mac (or from the APK, --apk 1) and driven through the page bridge (scripts/bench/gecko-bridge.mjs):
// for each world the app started afresh, `adb shell screenrecord` through the load, the recording pulled and read
// frame by frame with pen-read.swift (AVFoundation: each frame's own time), then pen-stops.mjs's measures.
//   npx vite build
//   ANDROID_SERIAL=… node scripts/transition-perf/pen-android.mjs [--serve dist] [--worlds desert,incal] [--apk 1]
//        [--port 6253] [--raw dir] [--out file.json]
// Device rules: only the test app is started and stopped, never com.rnaud.moebius (the player's app) nor a
// setting; the game's sound at 0 and its frame readout (F) on; only this script's own port rule, removed at the end.
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { options, sleep, ROOT } from '../bench/lib.mjs';
import { ADB } from '../handheld-perf/lib.mjs';
import { Bridge, GeckoPage } from '../bench/gecko-bridge.mjs';
import { staticHandler } from '../bench/serve.mjs';
import { penStops } from './pen-stops.mjs';

const opt = options();
const HERE = dirname(fileURLToPath(import.meta.url));
const GPKG = 'com.rnaud.moebius.gecko', GACTIVITY = `${GPKG}/com.rnaud.memento.gecko.MainActivity`;
const PORT = +(opt.port ?? 6253), BASE = `http://localhost:${PORT}/`, APK_BASE = 'http://127.0.0.1:6281/';
const apk = opt.apk === '1' || opt.apk === true, ORIGIN = apk ? APK_BASE : BASE;
const WORLDS = String(opt.worlds ?? 'desert,incal').split(',');
const RAW = resolve(opt.raw ?? `${ROOT}/scripts/bench/results/raw/pen-android-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`);
mkdirSync(RAW, { recursive: true });
const ON_DEVICE = '/data/local/tmp/memento-pen.mp4';

function adb(args) {
  const line = args.join(' ');
  if (/com\.rnaud\.moebius(?![.\w])/.test(line)) throw new Error(`refusing to touch the player's app: adb ${line}`);
  if (/\b(settings\s+put|setprop|pm\s+(clear|uninstall|disable)|uninstall)\b/.test(line)) throw new Error(`refusing: adb ${line}`);
  try { return execFileSync(ADB[0], [...ADB.slice(1), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return String(e.stdout ?? ''); }
}
const stopApp = () => adb(['shell', 'am', 'force-stop', GPKG]);

// the reader, built once
const READER = `${RAW}/pen-read`;
if (!existsSync(READER)) execFileSync('swiftc', ['-O', `${HERE}/pen-read.swift`, '-o', READER], { stdio: ['ignore', 'ignore', 'inherit'] });

const bridge = new Bridge();
const dist = resolve(ROOT, String(opt.serve ?? 'dist'));
const files = staticHandler([['/', dist]], { inject: (req) => bridge.tagFor(req) });
const server = createServer((req, res) => { if (!bridge.handle(req, res)) files(req, res); });
await new Promise((r) => server.listen(PORT, r));
adb(['reverse', `tcp:${PORT}`, `tcp:${PORT}`]);
const keeper = setInterval(() => { if (!adb(['reverse', '--list']).includes(`tcp:${PORT}`)) adb(['reverse', `tcp:${PORT}`, `tcp:${PORT}`]); }, 1500);
const cleanup = () => { clearInterval(keeper); stopApp(); adb(['shell', 'rm', '-f', ON_DEVICE]); adb(['reverse', '--remove', `tcp:${PORT}`]); server.close(); };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { cleanup(); process.exit(130); });

const result = { device: adb(['shell', 'getprop', 'ro.product.model']).trim(), apk, worlds: {} };
for (const w of WORLDS) {
  stopApp(); await sleep(1000);
  const seen = bridge.seen;
  adb(['shell', 'am', 'start', '-n', GACTIVITY, ...(apk ? ['--es', 'url', 'bundled:/bench-blank.html', '--es', 'inject', `${BASE}__bridge/init.js`] : ['--es', 'url', BASE + 'bench-blank.html'])]);
  await bridge.waitPage(ORIGIN, seen);
  const page = new GeckoPage(bridge);
  await page.eval(() => {
    localStorage.clear();
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: 'handheld', showFps: true, hudV: 1, music: 0, effects: 0, voices: 0 }));
    return true;
  });
  const rec = spawn(ADB[0], [...ADB.slice(1), 'shell', 'screenrecord', '--bit-rate', '12M', '--time-limit', '120', ON_DEVICE]);
  const recDone = new Promise((r) => rec.on('exit', r));
  await sleep(1500);
  const t0 = Date.now();
  await page.goto(`${ORIGIN}?level=${w}&fps=1`);
  // the pen's centre and size in the screen's pixels (the recording's)
  let pen = null;
  for (let i = 0; i < 40 && !pen; i++) {
    pen = await page.eval(() => { const e = document.querySelector('#loading .pen'); if (!e) return null; const r = e.getBoundingClientRect(), k = devicePixelRatio; return r.width ? { x: Math.round((r.x + r.width / 2) * k), y: Math.round((r.y + r.height / 2) * k), r: Math.round(r.width / 2 * k * 1.1) } : null; }).catch(() => null);
    if (!pen) await sleep(100);
  }
  await page.waitFor('!!window.__moebiusBooted', 300000, 250);
  const loadS = (Date.now() - t0) / 1000;
  await sleep(2000);
  adb(['shell', 'pkill', '-INT', 'screenrecord']);
  await recDone; await sleep(800);
  const mp4 = `${RAW}/${w}.mp4`;
  adb(['pull', ON_DEVICE, mp4]); adb(['shell', 'rm', '-f', ON_DEVICE]);
  stopApp();
  if (!pen || !existsSync(mp4) || !statSync(mp4).size) { result.worlds[w] = { error: pen ? 'no recording' : 'no pen found' }; console.log(w, result.worlds[w]); continue; }
  const lines = execFileSync(READER, [mp4, String(pen.x), String(pen.y), String(pen.r)], { encoding: 'utf8', maxBuffer: 1 << 26 }).trim().split('\n');
  const rows = lines.map((l) => { const [t, a] = l.split(' '); return { t: +t, a: a === '-' ? null : +a }; });
  writeFileSync(`${RAW}/${w}.txt`, lines.join('\n') + '\n');
  result.worlds[w] = { loadS: +loadS.toFixed(1), pen, ...penStops(rows) };
  console.log(w, JSON.stringify(result.worlds[w]));
}
cleanup();
if (opt.out) writeFileSync(resolve(opt.out), JSON.stringify(result, null, 1) + '\n');
process.exit(0);
