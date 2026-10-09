// The design audits' eyes (.claude/skills/level-design-qc, temple-design-qc): the views the audits planned
// (scripts/level-design/audit.mjs and scripts/temple-design/audit.mjs write views.json), shot world by world in
// ONE muted headless Chrome against ONE dev server, with a rest between worlds; and the audits' SVG maps and
// plans turned into pictures by the same browser. It leaves no Chrome and no server behind.
//
//   node scripts/design-qc/capture.mjs <out-dir> [--views a/views.json,b/views.json] [--svgs dir1,dir2]
//        [--worlds desert,incal] [--rest 15] [--res 960x540] [--preset high]
//   PORT (default 5344; never 5173, the author's own server). Chrome's debugging port: chosen by Chrome.
// Writes <out-dir>/<view name>.png for each view, <svg name>.png beside each SVG, and <out-dir>/captured.json.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'design-qc'));
const [W, H] = arg('res', '960x540').split('x').map(Number), PRESET = arg('preset', 'high'), REST = +arg('rest', 15) * 1000;
const PORT = Number(process.env.PORT ?? 5344);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const views = (arg('views') ?? '').split(',').filter(Boolean).flatMap((f) => JSON.parse(readFileSync(resolve(f), 'utf8')).views);
const only = arg('worlds')?.split(',');
const svgs = (arg('svgs') ?? '').split(',').filter(Boolean).flatMap((d) => readdirSync(resolve(d)).filter((f) => f.endsWith('.svg')).map((f) => join(resolve(d), f)));

// ---- one Chrome (muted, the real GPU), its debugging port of its own choosing
const profile = mkdtempSync(join(tmpdir(), 'design-qc-chrome-'));
const proc = spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--allow-file-access-from-files', `--window-size=${W},${H}`, '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
let server = null;
const done = async () => { try { ws?.close(); } catch { /* closed */ } proc.kill('SIGTERM'); await sleep(800); rmSync(profile, { recursive: true, force: true }); if (server) await server.close(); };
process.on('SIGINT', async () => { await done(); process.exit(130); });
let port = null;
for (let i = 0; i < 80 && !port; i++) { const f = join(profile, 'DevToolsActivePort'); if (existsSync(f)) port = +readFileSync(f, 'utf8').split('\n')[0]; else await sleep(250); }
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(250); } }
var ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waits = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const d = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return d.result?.exceptionDetails ? `ERR ${d.result.exceptionDetails.exception?.description?.slice(0, 160)}` : d.result?.result?.value; };
const shoot = async (file) => { const png = Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'); writeFileSync(file, png); };
await send('Page.enable'); await send('Runtime.enable');
const captured = [];

// ---- the SVGs first (no server needed): each at its own size
for (const f of svgs) {
  const svg = readFileSync(f, 'utf8'), w = +(svg.match(/width="(\d+)/)?.[1] ?? 800), h = +(svg.match(/height="(\d+)/)?.[1] ?? 600);
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: pathToFileURL(f).href }); await sleep(600);
  await shoot(f.replace(/\.svg$/, '.png').replace(/-map\.png$/, '-map-named.png'));
  captured.push({ svg: f });
}

// ---- the views, world by world
const worlds = [...new Set(views.map((v) => v.world))].filter((w) => !only || only.includes(w));
if (worlds.length) {
  const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
  server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', clearScreen: false, server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
  await server.listen();
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
}
const BASE = `http://127.0.0.1:${PORT}/`;
const pin = (v) => `(() => { const { THREE, camera, player } = window, up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
  const e = new THREE.Vector3(...${JSON.stringify(v.eye)}), t = new THREE.Vector3(...${JSON.stringify(v.target)});
  window.__pin = { e, q: new THREE.Quaternion().setFromRotationMatrix(m.lookAt(e, t, up)), fov: ${v.fov ?? 60}, far: ${v.far ?? 0} };
  if (!camera.__pinned) { const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld; camera.__pinned = true;
    camera.updateMatrixWorld = function (f) { const P = window.__pin; if (P) { this.position.copy(P.e); this.quaternion.copy(P.q); if (this.fov !== P.fov || (P.far && this.far < P.far)) { this.fov = P.fov; if (P.far) this.far = P.far; this.updateProjectionMatrix(); } } return base.call(this, f); }; }
  ${v.player ? `player.teleport?.(new THREE.Vector3(...${JSON.stringify(v.player)}), up, new THREE.Vector3(0, 0, 1));` : ''} return true; })()`;
for (const [n, world] of worlds.entries()) {
  if (n) await sleep(REST);   // a rest between worlds: the machine is shared
  await send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(250);
  await ev(`localStorage.clear(); localStorage.setItem('moebius.muted','1');
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${PRESET}', music: 0, effects: 0, voices: 0 }));
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] })); true`);
  await send('Page.navigate', { url: `${BASE}?level=${world}` });
  let up = false; for (let i = 0; i < 1200 && !up; i++) { up = (await ev('!!window.__moebiusBooted && !!window.player')) === true; if (!up) await sleep(100); }
  if (!up) { console.log(`${world}: never booted`); captured.push({ world, error: 'never booted' }); continue; }
  await sleep(2500);
  await ev(`(() => { window.sound?.setVolumes?.(0, 0); window.story?.closePage?.(); if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; }
    const s = document.createElement('style'); s.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(s); return true; })()`);
  for (const v of views.filter((x) => x.world === world)) {
    await ev(pin(v));
    await ev(`(() => { if (window.sky) { window.sky.hour = ${v.hour ?? 12}; window.sky.speed = 0; window.updateSky?.(); } return true; })()`);
    await sleep(v.player ? 3500 : 2500);   // (a teleport: the world round him streams in)
    await shoot(join(OUT, `${v.name}.png`));
    captured.push({ world, name: v.name, note: v.note ?? '' });
  }
  console.log(`${world}: ${views.filter((x) => x.world === world).length} views`);
}
writeFileSync(join(OUT, 'captured.json'), JSON.stringify(captured, null, 2));
console.log(`pictures in ${OUT}`);
await done();
process.exit(0);
