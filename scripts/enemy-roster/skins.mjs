// Contact sheets of the enemy roster's built archetypes (docs/design/enemy-roster.md; src/enemies/archetypes.js), from
// the creatures gallery (enemies.html: the game's own models through Foes.look):
//
//   node scripts/enemy-roster/skins.mjs --out <dir> [crab lizard …]
//     <dir>/skins-<archetype>.png   the archetype in each of its skins, standing, three-quarters from above
//     <dir>/tells-<archetype>.png   its own skin winding up each of its attacks (80 % of the wind-up: the held pose)
//
// One Vite (PORT, default 5363; never 5173) and one headless muted Chrome (CDP, default 5413), closed at the end.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const OUT = resolve(arg('out', 'output/enemy-roster'));
const picks = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const PORT = Number(process.env.PORT ?? 5363), CDP = Number(process.env.CDP ?? 5413);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), cacheDir: join(tmpdir(), 'hiraeth-roster-sheets'), server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const profile = mkdtempSync(join(tmpdir(), 'hiraeth-roster-chrome-'));
const proc = spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--disable-gpu-shader-disk-cache', '--disk-cache-size=1', '--force-device-scale-factor=1', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
let ws;
try {
  let tabs;
  for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
  ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const waits = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { const [res, rej] = waits.get(d.id); waits.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waits.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/enemies.html` });
  for (let i = 0; i < 240; i++) { try { if (await ev('!!window.enemyViewer')) break; } catch { /* loading */ } await sleep(500); }
  await sleep(1500);
  await ev('window.requestAnimationFrame = () => 0, true');
  mkdirSync(OUT, { recursive: true });
  const list = picks.length ? picks : ['crab', 'lizard', 'hound', 'tripod', 'blot'];
  for (const a of list) {
    for (const what of ['skins', 'tells']) {
      const url = await ev(`(async () => {
        const E = window.enemyViewer, V = E.viewer, a = ${JSON.stringify(a)}, w = 320, h = 300;
        const skins = Object.keys(E.skins[a]).slice(0, ${JSON.stringify(a)} === 'blot' ? 8 : 99);
        const first = a === 'blot' ? 'blot' : a;
        const ids = ${JSON.stringify(what)} === 'skins' ? skins.map((s) => first + '@' + s) : [first + '@' + skins[0]];
        const shots = [];
        for (const id of ids) {
          E.choose(id);
          const f = V.models.get(id)?.f ?? V.model(id).f;
          const moves = f.def.attacks.filter((x) => !x.chain);
          const poses = ${JSON.stringify(what)} === 'skins' ? [{ mode: 'walk', label: id }] : moves.map((m, i) => ({ mode: 'attack' + i, label: (m.name ?? m.id) + ' (wind-up)' }));
          for (const p of poses) {
            V.mode = p.mode; V.fixed = null; V.orbit.yaw = 1.02; V.orbit.pitch = 0.3; V.orbit.zoom = 1.0; V.setSize(w, h);
            V.time = 0; V.render(id);
            if (p.mode === 'walk') for (let i = 0; i < 70; i++) { V.time += 1 / 60; V.render(id); }
            else { const m = moves[Number(p.mode.slice(6))]; const t = m.wind * 0.8; for (let i = 0; i < 40; i++) { V.time = t * i / 39; V.render(id); } }
            const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(V.renderer.domElement, 0, 0);
            shots.push({ c, label: p.label });
          }
        }
        const cols = Math.min(4, shots.length), rows = Math.ceil(shots.length / cols);
        const out = document.createElement('canvas'); out.width = w * cols; out.height = h * rows;
        const g = out.getContext('2d'); g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, out.width, out.height);
        shots.forEach((s, i) => { const x = (i % cols) * w, y = Math.floor(i / cols) * h; g.drawImage(s.c, x, y); g.fillStyle = '#5a4a3a'; g.font = '15px sans-serif'; g.fillText(s.label, x + 8, y + 20); });
        return out.toDataURL('image/png');
      })()`);
      const file = join(OUT, `${what}-${a}.png`);
      writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      console.log(file);
    }
  }
} finally {
  try { ws?.close(); } catch { /* gone */ }
  const gone = new Promise((r) => proc.once('exit', r));
  proc.kill('SIGTERM');
  await Promise.race([gone, sleep(5000)]);
  rmSync(profile, { recursive: true, force: true });
  await server.close();
}
