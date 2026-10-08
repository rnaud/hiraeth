// The visual audit's eyes (.claude/skills/visual-audit/SKILL.md): every world's benchmark views at several hours,
// the inside of every door, cave and portal (level.portals' `to`), and the traveller close up, shot in a MUTED
// headless Chrome on the real GPU, with each picture measured for what usually means an artifact: crushed blacks
// (shadow acne, light leaks' opposite, unlit interiors), blown whites, NaN-magenta or pure-black holes, and a
// screen of one colour (nothing drawn). The clipping audit (window.clipAudit) is run once per world.
//
//   node .claude/skills/visual-audit/views.mjs <out-dir> [--worlds desert,incal] [--hours 7,12,18.5,22]
//        [--preset high] [--interiors 1] [--max-interiors 6] [--res 1280x720]     PORT (default 5494; Chrome's PORT + 1)
// Writes <out-dir>/<world>/<view>@<hour>.png and <out-dir>/report.json (the numbers of every picture, flagged).
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { decodePNG } = await import(join(ROOT, 'scripts/png.mjs'));
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'visual-audit'));
const HOURS = arg('hours', '7,12,18.5,22').split(',').map(Number), PRESET = arg('preset', 'high'), [W, H] = arg('res', '1280x720').split('x').map(Number);
const INTERIORS = arg('interiors', '1') !== '0', MAXI = +arg('max-interiors', 6);
const PORT = Number(process.env.PORT ?? 5494), CDP = PORT + 1;
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const names = await import(join(ROOT, 'src/levels/names.js'));
const WORLDS = (arg('worlds') ?? [...new Set([...names.ORDER, ...names.SIDE, 'home', 'lantern'])].join(',')).split(',').filter(Boolean);
const VW = JSON.parse(readFileSync(join(ROOT, 'scripts/bench/viewpoints-worlds.json'), 'utf8')).worlds;
const VD = JSON.parse(readFileSync(join(ROOT, 'scripts/bench/viewpoints.json'), 'utf8')).views;
const viewsOf = (id) => (id === 'desert' ? VD : VW[id]?.views ?? []).filter((v) => v.eye && v.target).slice(0, 3);

const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', clearScreen: false,
  server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const BASE = `http://127.0.0.1:${PORT}/`;
const profile = mkdtempSync(join(tmpdir(), 'visual-audit-chrome-'));
const proc = spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', `--window-size=${W},${H}`, '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waits = new Map(), errors = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails?.exception?.description ?? '').slice(0, 200)); });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const d = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return d.result?.exceptionDetails ? `ERR ${d.result.exceptionDetails.exception?.description?.slice(0, 160)}` : d.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

/** What a picture's pixels say: shares of crushed black, blown white, NaN-magenta, and of its commonest colour. */
function measure(png) {
  const { pixels: p, channels: c } = decodePNG(png), n = p.length / c, hist = new Map();
  let black = 0, white = 0, magenta = 0;
  for (let i = 0; i < p.length; i += c) {
    const r = p[i], g = p[i + 1], b = p[i + 2], l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (l < 10) black++; else if (r > 250 && g > 250 && b > 250) white++;
    if (r > 235 && b > 235 && g < 30) magenta++;
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4); hist.set(k, (hist.get(k) ?? 0) + 1);
  }
  const top = Math.max(...hist.values());
  const s = { black: +(black / n).toFixed(4), white: +(white / n).toFixed(4), magenta: +(magenta / n).toFixed(5), flat: +(top / n).toFixed(3), colours: hist.size };
  // (the print look has deep ink blacks by design: a flag is a picture to look at, not a verdict)
  s.flags = [s.black > 0.25 && 'crushed blacks', s.white > 0.2 && 'blown whites', s.magenta > 0.001 && 'NaN-magenta pixels', s.flat > 0.6 && 'mostly one colour (nothing drawn?)', s.colours < 40 && 'very few colours'].filter(Boolean);
  return s;
}
const pin = (v) => `(() => { const { THREE, camera, player } = window, up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
  const e = new THREE.Vector3(...${JSON.stringify(v.eye)}), t = new THREE.Vector3(...${JSON.stringify(v.target)});
  window.__pin = { e, q: new THREE.Quaternion().setFromRotationMatrix(m.lookAt(e, t, up)), fov: ${v.fov ?? 55} };
  if (!camera.__pinned) { const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld; camera.__pinned = true;
    camera.updateMatrixWorld = function (f) { const P = window.__pin; if (P) { this.position.copy(P.e); this.quaternion.copy(P.q); if (this.fov !== P.fov) { this.fov = P.fov; this.updateProjectionMatrix(); } } return base.call(this, f); }; }
  ${v.player ? `player.teleport?.(new THREE.Vector3(...${JSON.stringify(v.player)}), up, new THREE.Vector3(0, 0, 1)); player.heading = ${v.heading ?? 0};` : ''} return true; })()`;
const hour = (h) => `(() => { if (window.sky) { window.sky.hour = ${h}; window.sky.speed = 0; window.updateSky?.(); } return true; })()`;
const shoot = async (file) => { const png = Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'); writeFileSync(file, png); return measure(png); };

const report = { preset: PRESET, res: `${W}x${H}`, hours: HOURS, date: new Date().toISOString(), worlds: [] };
for (const world of WORLDS) {
  mkdirSync(join(OUT, world), { recursive: true });
  await send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(250);
  await ev(`localStorage.clear(); localStorage.setItem('moebius.muted','1');
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${PRESET}', music: 0, effects: 0, voices: 0 }));
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] })); true`);
  errors.length = 0;
  await send('Page.navigate', { url: `${BASE}?level=${world}` });
  let up = false; for (let i = 0; i < 1200 && !up; i++) { up = (await ev('!!window.__moebiusBooted && !!window.player')) === true; if (!up) await sleep(100); }
  if (!up) { report.worlds.push({ world, error: 'never booted', errors: errors.slice(0, 4) }); continue; }
  await sleep(2500);
  await ev(`(() => { window.sound?.setVolumes?.(0, 0); window.story?.closePage?.(); if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; }
    const s = document.createElement('style'); s.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(s); return true; })()`);
  const shots = [];
  for (const v of viewsOf(world).length ? viewsOf(world) : [{ name: 'boot' }]) {
    if (v.eye) await ev(pin(v));
    for (const h of HOURS) { await ev(hour(h)); await sleep(1500); shots.push({ view: v.name, hour: h, ...(await shoot(join(OUT, world, `${v.name}@${h}.png`))) }); }
  }
  // inside every way in (doors, caves, portals): from just past its threshold, looking further in, at noon
  if (INTERIORS) {
    const ways = await ev(`(window.level.portals ?? []).filter((p) => p.to).slice(0, ${MAXI}).map((p, i) => ({ i, to: [p.to.x, p.to.y, p.to.z], h: p.toHeading ?? p.heading ?? 0 }))`);
    for (const w of Array.isArray(ways) ? ways : []) {
      const f = [Math.sin(w.h), 0, Math.cos(w.h)], eye = [w.to[0] - f[0] * 2.5, w.to[1] + 1.7, w.to[2] - f[2] * 2.5], target = [w.to[0] + f[0] * 6, w.to[1] + 1.2, w.to[2] + f[2] * 6];
      await ev(pin({ eye, target, player: w.to, heading: w.h })); await ev(hour(12)); await sleep(2500);
      shots.push({ view: `inside-${w.i}`, hour: 12, ...(await shoot(join(OUT, world, `inside-${w.i}@12.png`))) });
    }
  }
  const clip = await ev(`(async () => { try { const r = await window.clipAudit({ print: false }); return { checked: r.checked, counts: r.counts, offenders: (r.offenders ?? []).slice(0, 12).map((o) => o.what ?? o.kind ?? o.id ?? String(o)) }; } catch (e) { return { error: String(e).slice(0, 160) }; } })()`);
  const row = { world, shots, clip, errors: errors.slice(0, 4) };
  report.worlds.push(row);
  const flagged = shots.filter((s) => s.flags.length);
  console.log(`${world.padEnd(16)} ${shots.length} pictures, ${flagged.length} flagged${flagged.length ? ` (${flagged.slice(0, 4).map((s) => `${s.view}@${s.hour}: ${s.flags.join('/')}`).join('; ')})` : ''} · clipping: ${clip?.counts ? JSON.stringify(clip.counts) : clip?.error ?? '?'}${row.errors.length ? ` · ${row.errors.length} page errors` : ''}`);
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`pictures and report.json in ${OUT}`);
ws.close(); proc.kill('SIGTERM'); await sleep(1000); rmSync(profile, { recursive: true, force: true });
await server.close();
process.exit(0);
