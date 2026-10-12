// How soon the title screen paints and how soon a press of Continue gets you playing (issue #110,
// docs/systems/ui.md "The title screen", Boot). Serves a built game (dist/, `npx vite build` first; DIST=… another
// build, an older commit's, to compare) from its own small server, never the author's dev server, and for each run
// opens the title in a fresh headless muted Chrome at 1280 × 720 with a save to continue, then reports, from the
// navigation's start:
//   fcp        the first pixel of any kind (Chrome's first contentful paint)
//   script     the entry script fetched (its responseEnd): what "after the page's script runs" counts from
//   boot       the page's script begins (the title's timing.start; null before issue #110)
//   paint      the title's first frame: its name over the paper (window.title.timing.painted; before issue #110 the
//              name came with the menu)
//   picture    the title's picture on the screen (timing.picture: the vector drawing's first frame; before, the still's load)
//   menu       the name and the menu painted, answering: "Press A to start" (timing.shown)
//   world      the live 3D world faded in behind the menu (null: none built)
//   play       Continue pressed at --press ms: the game's first frame, from the press (ms)
//
//   node scripts/title-boot.mjs [--presets high,handheld] [--cpu 1,4] [--runs 3] [--press 4000] [--query vista=still]
//                               [--shot A4] [--net 4g|3g] [--json out.json]
// --cpu slows Chrome's CPU N times (4: a handheld's, roughly). PORT (default 5371) is the server's, CDP its + 1.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(process.env.DIST ?? join(ROOT, 'dist'));
process.env.PORT ??= '5371';
process.env.CDP ??= String(Number(process.env.PORT) + 1);
const PORT = Number(process.env.PORT);
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const PRESETS = arg('presets', 'high,handheld').split(',');
const CPUS = arg('cpu', '1,4').split(',').map(Number);
const RUNS = Number(arg('runs', 3));
const PRESS = Number(arg('press', 4000));
const QUERY = arg('query', '');
const SHOT = arg('shot', 'A4');
const OUT = arg('json');
// --net 4g: a mobile connection (Chrome's: 9 Mbit/s down, 170 ms round trips), for the site's first load
const NET = { '4g': { latency: 170, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 }, '3g': { latency: 400, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 } }[arg('net', '')] ?? null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.opus': 'audio/ogg', '.woff2': 'font/woff2' };
function serveDist() {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('no dist/: run npx vite build first');
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(DIST, p);
    if (!f.startsWith(DIST) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(f).pipe(res);
  });
  return new Promise((r) => server.listen(PORT, '127.0.0.1', () => r(server)));
}

const SAVE = JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] });
async function measure(c, preset, cpu) {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await c.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/manifest.webmanifest` }); await sleep(300);
  await c.ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted', '1');
    localStorage.setItem('hiraeth.s1.game.v1', ${JSON.stringify(SAVE)});
    localStorage.setItem('hiraeth.s1.meta.v1', JSON.stringify({ playtime: 600, lastPlayed: Date.now() }));
    localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: '${preset}', showFps: false, music: 0, effects: 0, voices: 0 })); true`);
  await c.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  if (NET) { await c.send('Network.enable'); await c.send('Network.emulateNetworkConditions', { offline: false, ...NET }); }
  await c.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?shot=${SHOT}${QUERY ? `&${QUERY}` : ''}` });
  await sleep(PRESS);
  const r = JSON.parse(await c.ev(`JSON.stringify({ timing: window.title?.timing ?? null,
    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
    script: performance.getEntriesByType('resource').filter((e) => e.initiatorType === 'script' && /\\/assets\\/main-/.test(e.name))[0]?.responseEnd ?? null,
    continue: !!document.querySelector('#title [data-a="continue"]') })`));
  // Continue: the game's first frame (a fresh page or this one), from the press
  const t0 = Date.now();
  await c.ev(`(window.title?.root?.querySelector('[data-a="continue"]') ?? document.querySelector('#title [data-a="continue"]'))?.click(); true`);
  let play = null;
  for (let i = 0; i < 1200 && play === null; i++) {
    await sleep(100);
    try { if (await c.ev(`!!(window.__hiraethBooted && document.getElementById('loading')?.classList.contains('done') !== false && !document.getElementById('title'))`)) play = Date.now() - t0; } catch { /* navigating */ }
  }
  await c.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const t = r.timing ?? {};
  const round = (x) => (x == null ? null : Math.round(x));
  return { preset, cpu, fcp: round(r.fcp), script: round(r.script), boot: round(t.start), paint: round(t.painted ?? t.shown), picture: round(t.picture ?? t.still), menu: round(t.shown), world: round(t.world), play, continue: r.continue };
}

const median = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const server = await serveDist();
const { chrome } = await import('./changelog-shots.mjs');
const results = [];
try {
  for (const preset of PRESETS) for (const cpu of CPUS) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      const c = await chrome();
      const m = await measure(c, preset, cpu).finally(() => c.close());
      runs.push(m);
      console.log(`${preset} cpu ×${cpu} #${i + 1}: fcp ${m.fcp}, script ${m.script}, boot ${m.boot}, paint ${m.paint}, picture ${m.picture}, menu ${m.menu}, world ${m.world}, play ${m.play} ms after Continue${m.continue ? '' : ' (no Continue!)'}`);
    }
    const sum = { preset, cpu, runs: RUNS, query: QUERY, net: arg('net', '') };
    for (const k of ['fcp', 'script', 'boot', 'paint', 'picture', 'menu', 'world', 'play']) sum[k] = median(runs.map((r) => r[k]));
    results.push({ ...sum, all: runs });
    console.log(`${preset} cpu ×${cpu} (median of ${RUNS}): fcp ${sum.fcp}, script ${sum.script}, boot ${sum.boot}, paint ${sum.paint}, picture ${sum.picture}, menu ${sum.menu}, world ${sum.world}, play ${sum.play}`);
  }
} finally {
  server.close();
}
if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 2));
