// Motion strips: 8 frames over 2 s of a foe walking, seen three-quarters from above as the game's camera does, from the enemies viewer (enemies.html, which
// draws them through the game's own models and Foes.look, as the Arena does). For the changelog's before / after
// and for reviewing a body plan (docs/systems/procedural-animation.md, "Measuring").
//
//   node scripts/motion-audit/strips.mjs --out <dir> [--root <tree>] [--tag after] [--yaw 1.02] [--pitch 0.32] id…   (yaw π/2, pitch 0.1: side on)
//
// id: a world enemy (desert/dune-skitter) or one of the Arena's own kinds (crab, hound, machine). --root serves
// another checkout's tree (a `git archive` of the commit before, with node_modules linked) for the "before".
// Writes <out>/<id>-<tag>.png: two rows of four frames, left to right, top to bottom, 1/4 s apart.
// One Vite (PORT, default 5357) and one headless muted Chrome (CDP, default 5407), both closed at the end.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ROOT = resolve(arg('root', fileURLToPath(new URL('../../', import.meta.url))));
const OUT = resolve(arg('out', 'output/motion-strips')), TAG = arg('tag', 'after'), YAW = Number(arg('yaw', Math.PI / 2 - 0.55)), PITCH = Number(arg('pitch', 0.32));
const ids = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const PORT = Number(process.env.PORT ?? 5357), CDP = Number(process.env.CDP ?? 5407);
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), cacheDir: join(tmpdir(), `hiraeth-strips-${TAG}`), server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const profile = mkdtempSync(join(tmpdir(), 'hiraeth-strips-chrome-'));
const proc = spawn(CHROME, ['--headless=new', '--mute-audio', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--disable-gpu-shader-disk-cache', '--disk-cache-size=1', '--force-device-scale-factor=1', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
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
  await ev('window.requestAnimationFrame = () => 0, true');   // (the page's own loop stops: the strip steps the model itself)
  await sleep(300);
  mkdirSync(OUT, { recursive: true });
  for (const subject of ids) {
    const url = await ev(`(() => {
      const E = window.enemyViewer, V = E.viewer, id = ${JSON.stringify(subject)}, w = 320, h = 300;
      if (E.roster.some((e) => e.id === id)) E.choose(id);
      V.mode = 'walk'; V.fixed = null; V.orbit.yaw = ${YAW}; V.orbit.pitch = ${PITCH}; V.orbit.zoom = 1.05;
      V.setSize(w, h);
      V.render(id); const m = V.models.get(id); if (m) m.f.dist = 1;   // (close by: a hound is solid, not its running shadow)
      for (let i = 0; i < 60; i++) { V.time += 1 / 60; V.render(id); }   // (1 s to settle into its walk)
      const out = document.createElement('canvas'); out.width = w * 4; out.height = h * 2;
      const c = out.getContext('2d');
      c.fillStyle = '#f4ecd8'; c.fillRect(0, 0, out.width, out.height);
      for (let i = 0; i < 120; i++) {
        V.time += 1 / 60; V.render(id);
        if (i % 15 === 0) { const k = i / 15; c.drawImage(V.renderer.domElement, (k % 4) * w, Math.floor(k / 4) * h); c.fillStyle = '#5a4a3a'; c.font = '14px sans-serif'; c.fillText((k * 0.25).toFixed(2) + ' s', (k % 4) * w + 8, Math.floor(k / 4) * h + 18); }
      }
      return out.toDataURL('image/png');
    })()`);
    const file = join(OUT, `${subject.replace(/\//g, '-')}-${TAG}.png`);
    writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log(file);
  }
} finally {
  try { ws?.close(); } catch { /* gone */ }
  const gone = new Promise((r) => proc.once('exit', r));
  proc.kill('SIGTERM');
  await Promise.race([gone, sleep(5000)]);
  rmSync(profile, { recursive: true, force: true });
  await server.close();
}
