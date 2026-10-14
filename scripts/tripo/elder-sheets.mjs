// Contact sheets of the Elder's whole cycles (issue #237): each motion of tools/elder-review.html stepped at 60 Hz
// from its start, a column per moment, a row per view (front, side and back in the game's ink; three-quarters in clay
// and in the unlit texture), so a cycle's snaps, frozen parts and tearing show side by side.
//
//   node scripts/tripo/elder-sheets.mjs --out <dir> [--tag after] [--root <tree>] [motion…]
//
// motion: the review page's own (idle, walk, turn, hover, flightCycle, wingsFolded, wingsSpread, sleep, wake, open,
// weary, resolved, peck, stamp, buffet, gale, dive, feathers, encounter0/1/2); none: all. --root serves another
// checkout (a `git archive` of the commit before, node_modules linked) for the "before". --rows front,side… picks views.
// Writes <out>/<motion>-<tag>.png. One Vite (PORT, default 6237) and one headless muted Chrome (CDP, default 6238).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tempDir, ownProcess, removeTemp, viteCacheDir } from '../temp-dirs.mjs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ROOT = resolve(arg('root', fileURLToPath(new URL('../../', import.meta.url))));
const OUT = resolve(arg('out', 'output/elder-sheets')), TAG = arg('tag', 'after');
const ROWS = arg('rows', 'front:ink,side:ink,back:ink,quarter:clay,quarter:unlit').split(',').map((r) => r.split(':'));
const CELL = [Number(arg('w', 240)), Number(arg('h', 300))];
const PORT = Number(process.env.PORT ?? 6237), CDP = Number(process.env.CDP ?? 6238);
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Each motion: its phase, a settle before the first column, and the moments shown (s from then).
const range = (a, b, d) => Array.from({ length: Math.round((b - a) / d) + 1 }, (_, i) => +(a + i * d).toFixed(3));
// (an attack as the fight times it, tools/elder-drive.js attackBeats: the wind-up, the strike's frames, the blow, the recovery)
const { attackBeats, LEAD } = await import('../../tools/elder-drive.js');
const STRIKE = (id) => { const b = attackBeats(id), w = b.wind; return [-.5, 0, .35 * w, .7 * w, .9 * w, w - .04, w + .05, w + .12, w + .25, b.active, (b.active + b.end) / 2, b.end, b.end + .6].map((x) => +(x + LEAD).toFixed(2)); };
export const MOTIONS = {
  idle: { times: range(0, 4.5, .5) }, walk: { settle: 1, times: range(0, 2.25, .25) }, turn: { times: range(0, 9, 1) },
  hover: { phase: 1, settle: 2, times: range(0, 1.35, .15) }, flightCycle: { times: range(0, 11, 1) },
  wingsFolded: { times: range(0, 2.25, .25) }, wingsSpread: { times: range(0, 2.25, .25) },
  sleep: { times: range(0, 4.5, .5) }, wake: { times: range(0, 4.5, .5) }, open: { times: range(0, 4.5, .5) },
  weary: { times: range(0, 4.5, .5) }, resolved: { times: range(0, 4.5, .5) },
  peck: { times: STRIKE('peck') }, stamp: { times: STRIKE('stamp') }, buffet: { times: STRIKE('buffet') }, gale: { times: STRIKE('gale') },
  dive: { phase: 1, times: STRIKE('dive') }, feathers: { times: STRIKE('feathers') },
  encounter0: { motion: 'encounter', phase: 0, times: range(0, 22, 2) }, encounter1: { motion: 'encounter', phase: 1, times: range(0, 22, 2) },
  encounter2: { motion: 'encounter', phase: 2, times: range(0, 22, 2) },
  // one moment of her guard, for close views (--rows quarter:unlit,back:ink --w 640 --h 720 --zoom 0.3)
  still: { motion: 'idle', times: [2.5] },
  // her levels of detail side by side (ELDER_LOD's cells, the whole mesh first), close up and from 4x as far
  lod: { motion: 'idle', times: [2, 2, 2, 2], lods: [null, -4, -3, -2] }, lodFar: { motion: 'idle', times: [2, 2, 2, 2], lods: [null, -4, -3, -2], far: 4 },
};
const ids = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const list = ids.length ? ids : Object.keys(MOTIONS);

const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), cacheDir: viteCacheDir(`elder-sheets-${TAG}`), server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false, fs: { strict: false } }, logLevel: 'error' });   // (fs: a --root tree's node_modules is a link outside it)
await server.listen();
const profile = tempDir('hiraeth-elder-sheets-chrome-');
const proc = ownProcess(spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--disable-gpu-shader-disk-cache', '--disk-cache-size=1', '--force-device-scale-factor=1', `--window-size=${CELL[0]},${CELL[1]}`, 'about:blank'], { stdio: 'ignore' }));
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
  await send('Emulation.setDeviceMetricsOverride', { width: CELL[0], height: CELL[1], deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/tools/elder-review.html` });
  for (let i = 0; i < 240; i++) { try { if (await ev('!!window.elderReview')) break; } catch { /* loading */ } await sleep(500); }
  if (!(await ev('!!window.elderReview'))) throw new Error('the review page did not load: ' + await ev(`document.getElementById('status')?.textContent`));
  await ev(`(elderReview.stop(), document.querySelector('header').style.display='none', elderReview.size(${CELL[0]},${CELL[1]}), true)`);
  mkdirSync(OUT, { recursive: true });
  for (const name of list) {
    const M = MOTIONS[name];
    if (!M) { console.warn(`no motion ${name}`); continue; }
    const url = await ev(`(() => {
      const R = elderReview, [w, h] = ${JSON.stringify(CELL)}, rows = ${JSON.stringify(ROWS)}, times = ${JSON.stringify(M.times)};
      R.start(${JSON.stringify(M.motion ?? name)}, ${M.phase ?? 'undefined'});
      const lods = ${JSON.stringify(M.lods ?? null)};
      R.step(${M.settle ?? 0});
      const out = document.createElement('canvas'), top = 22; out.width = w * times.length + 70; out.height = h * rows.length + top;
      const c = out.getContext('2d'); c.fillStyle = '#eee9de'; c.fillRect(0, 0, out.width, out.height);
      c.fillStyle = '#3a3128'; c.font = 'bold 14px sans-serif'; c.fillText(${JSON.stringify(`${name} · ${TAG}`)}, 6, 16);
      let at = 0;
      times.forEach((s, col) => {
        R.step(s - at); at = s;
        const g = R.guard, label = s.toFixed(2) + ' s' + (${JSON.stringify(M.motion ?? '')} === 'encounter' ? ' ' + g.state + (g.attack ? '/' + g.attack.id : '') : '');
        if (lods) { const tris = R.lod(lods[col]); rows.forEach(([a, mode], row) => { const cv = R.view(a, mode, ${Number(arg('zoom', .55))} * ${M.far ?? 1}); c.drawImage(cv, 70 + col * w, top + row * h); }); c.fillStyle = '#3a3128'; c.fillText(tris + ' tris', 70 + col * w + 4, top + 30); return; }
        rows.forEach(([a, mode], row) => { const cv = R.view(a, mode, ${Number(arg('zoom', .55))}); c.drawImage(cv, 70 + col * w, top + row * h); });
        c.fillStyle = '#3a3128'; c.font = '12px sans-serif'; c.fillText(label, 70 + col * w + 4, top + 14);
      });
      rows.forEach(([a, mode], row) => { c.fillText(a, 4, top + row * h + h / 2); c.fillText(mode, 4, top + row * h + h / 2 + 15); });
      return out.toDataURL('image/png');
    })()`);
    const file = join(OUT, `${name}-${TAG}.png`);
    writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log(file);
  }
} finally {
  try { ws?.close(); } catch { /* gone */ }
  proc.kill('SIGKILL');
  removeTemp(profile);
  await server.close();
}
