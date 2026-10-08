// The game audit's eyes (.claude/skills/game-audit/SKILL.md): serves this checkout with Vite on its own port
// (never 5173, the author's), drives a MUTED headless Chrome through a plan of views and writes a JPEG of
// each, with what the page said (its text, errors) and how long the world took to boot.
//
//   node .claude/skills/game-audit/capture.mjs <out-dir> [plan.json]      (default: default-plan.json beside this)
//   PORT=5490 (Vite; Chrome's debugging port is PORT + 1)
//
// A plan is a list of views: { name, q?, save?, fresh?, title?, wait?, eval?, then?: [{ eval, wait }] }
//   q      the query (?level=desert …); none: the title screen
//   save   the game save to start from (moebius.game.v1); fresh: true for a first-time player (nothing stored)
//   title  the view is a page that never boots a world (the title screen): just wait, then shoot
//   eval   a script run in the page before the shot (its value is printed)
//   then   steps after the first shot, each run, waited for and shot as <name>-<i>
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const OUT = resolve(process.argv[2] ?? join(tmpdir(), 'game-audit-shots'));
const PLAN = JSON.parse(readFileSync(process.argv[3] ?? join(HERE, 'default-plan.json'), 'utf8'));
const PORT = Number(process.env.PORT ?? 5490), CDP = PORT + 1;
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', clearScreen: false,
  server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const BASE = `http://127.0.0.1:${PORT}/`;

// (muted twice over: Chrome's own switch, and the game's mute and volumes before it loads)
const profile = mkdtempSync(join(tmpdir(), 'game-audit-chrome-'));
const proc = spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
  '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
if (!tabs) throw new Error('Chrome did not start');
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waits = new Map(), logs = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && waits.has(d.id)) { const [res, rej] = waits.get(d.id); waits.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
  if (d.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (d.params.exceptionDetails?.exception?.description ?? '').slice(0, 240));
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push('error: ' + d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 240));
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waits.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.exceptionDetails ? `ERR ${r.exceptionDetails.exception?.description ?? ''}` : r.result.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
const shot = async (name) => writeFileSync(join(OUT, `${name}.jpg`), Buffer.from((await send('Page.captureScreenshot', { format: 'jpeg', quality: 72 })).data, 'base64'));

const report = [];
for (const v of PLAN) {
  await send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(300);
  await ev(`localStorage.clear(); localStorage.setItem('moebius.muted', '1');
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ music: 0, effects: 0, voices: 0 }));
    ${v.fresh ? '' : `localStorage.setItem('moebius.game.v1', JSON.stringify(${JSON.stringify(v.save ?? { flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] })}));`} true`);
  logs.length = 0;
  const t0 = Date.now();
  await send('Page.navigate', { url: BASE + (v.q ?? '') });
  let boot = null;
  if (!v.title) for (let i = 0; i < 600; i++) { if (await ev('!!window.__moebiusBooted && !!window.player')) { boot = Date.now() - t0; break; } await sleep(250); }
  await sleep(v.wait ?? 6000);
  const row = { name: v.name, boot_ms: boot, said: v.eval ? await ev(v.eval) : undefined };
  await shot(v.name);
  for (const [i, s] of (v.then ?? []).entries()) { row[`step${i}`] = await ev(s.eval ?? 'true'); await sleep(s.wait ?? 3000); await shot(`${v.name}-${i}`); }
  row.text = String(await ev('document.body.innerText')).replace(/\s+/g, ' ').slice(0, 400);
  if (logs.length) row.errors = logs.slice(0, 8);
  report.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
ws.close(); proc.kill('SIGTERM'); await sleep(1000); rmSync(profile, { recursive: true, force: true });
await server.close();
console.log(`shots and report.json in ${OUT}`);
