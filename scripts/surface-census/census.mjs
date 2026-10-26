// The surface census (docs/audits/surfaces-v2.30.md, issue #690; the first, v2.27's, was a scratch script): for every
// world, every visible mesh drawn with makeMaterial's surface shader, grouped by material and put in one class by its
// options and compiled defines (lib.mjs classify: treated / skin / grid only / bands only / plain / pending), weighted
// two ways:
//   area     its world area at boot (what v2.27 measured: where untreated material is, not what a frame shows)
//   walked   rays from the points the player walks and stops at (walk.mjs: the critical path every 8 m, the people,
//            the quest places, the doors and the inside of every way in): down, what he stands on; a fan round his
//            eye, what he sees (page.js walk)
// and a picture of each world's most walked untreated materials: the view, and the same with that material in magenta.
//
//   node scripts/surface-census/census.mjs <out-dir> [--worlds desert,home] [--shots 4] [--preset high]
//        PORT (vite, default 5449), CDP (Chrome's debugging port, default 9750). Muted Chrome; the game's own mute too.
// Writes <out-dir>/walk.json, <out-dir>/report.json, <out-dir>/report.md (the tables) and <out-dir>/<world>.jpg.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, ownProcess, viteCacheDir, removeTemp } from '../temp-dirs.mjs';
import { COUNTED, LEFT_OUT, UNTREATED, shares } from './lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'surface-census');
mkdirSync(OUT, { recursive: true });
const PORT = Number(process.env.PORT ?? 5449), CDP = Number(process.env.CDP ?? 9750);
if (PORT === 5173 || CDP === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
const PRESET = arg('preset', 'high'), SHOTS = +arg('shots', 4), W = 1280, H = 720;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const names = await import(join(ROOT, 'src/levels/names.js'));
const WORLDS = (arg('worlds') ?? [...names.ORDER, 'home'].join(',')).split(',').filter(Boolean);
const sharp = (await import('sharp')).default;

// ---- the walked points, in node
const walkFile = join(OUT, 'walk.json');
const r = spawnSync(process.execPath, [join(ROOT, 'scripts/surface-census/walk.mjs'), walkFile, '--worlds', WORLDS.join(',')], { stdio: 'inherit' });
if (r.status !== 0) throw new Error('walk.mjs failed');
const WALK = JSON.parse(readFileSync(walkFile, 'utf8'));

// ---- the game, muted
const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', clearScreen: false, cacheDir: viteCacheDir('surface-census-vite'),
  server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const BASE = `http://127.0.0.1:${PORT}/`;
const profile = tempDir('surface-census-chrome-');
const proc = ownProcess(spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', `--window-size=${W},${H}`, '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' }));
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((res) => ws.addEventListener('open', res));
let id = 0; const waits = new Map(), errors = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails?.exception?.description ?? '').slice(0, 200)); });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const d = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return d.result?.exceptionDetails ? `ERR ${d.result.exceptionDetails.exception?.description?.slice(0, 300)}` : d.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

const pin = (eye, target, player) => `(() => { const { THREE, camera, player } = window, up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
  const e = new THREE.Vector3(...${JSON.stringify(eye)}), t = new THREE.Vector3(...${JSON.stringify(target)});
  window.__pin = { e, q: new THREE.Quaternion().setFromRotationMatrix(m.lookAt(e, t, up)), fov: 55 };
  if (!camera.__pinned) { const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld; camera.__pinned = true;
    camera.updateMatrixWorld = function (f) { const P = window.__pin; if (P) { this.position.copy(P.e); this.quaternion.copy(P.q); if (this.fov !== P.fov) { this.fov = P.fov; this.updateProjectionMatrix(); } } return base.call(this, f); }; }
  player.teleport?.(new THREE.Vector3(...${JSON.stringify(player)}), up, new THREE.Vector3(0, 0, 1)); return true; })()`;
const shot = async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64');
/** The share of a picture that is the highlight's magenta (lit or in shade). */
async function magentaShare(png) {
  const { data, info } = await sharp(png).resize(320, 180).raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < data.length; i += info.channels) { const r = data[i], g = data[i + 1], b = data[i + 2]; if (r > 90 && b > 90 && g < 0.45 * Math.min(r, b)) n++; }
  return n / (info.width * info.height);
}
/** A view of a hit: from where its ray started (a seen hit) or from behind and over the point (a hit underfoot). */
function viewOf(h) {
  if (h.kind === 'seen') { const [x, y, z] = h.from, [a, b, c] = h.at; const d = Math.hypot(a - x, c - z) || 1; return { eye: [x - ((a - x) / d) * 2.5, y + 1.2, z - ((c - z) / d) * 2.5], target: h.at, player: [x, y - 1.7, z] }; }
  const [x, y, z] = h.at; return { eye: [x - 4.5, y + 4.2, z - 4.5], target: [x + 1.5, y, z + 1.5], player: [x, y, z] };
}

const report = { preset: PRESET, date: new Date().toISOString(), revision: spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim(), worlds: [] };
for (const world of WORLDS) {
  const t0 = Date.now();
  await send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(250);
  await ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted','1');
    localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: '${PRESET}', music: 0, effects: 0, voices: 0, soundV: 1, enemies: 'off' }));
    localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] })); true`);
  errors.length = 0;
  // (?batch=0: each still mesh draws itself, so a ray's hit is its own mesh and material, not a batch's)
  await send('Page.navigate', { url: `${BASE}?level=${world}&batch=0` });
  let up = false; for (let i = 0; i < 1500 && !up; i++) { up = (await ev('!!window.__hiraethBooted && !!window.player')) === true; if (!up) await sleep(100); }
  if (!up) { report.worlds.push({ world, error: 'never booted', errors: errors.slice(0, 4) }); console.log(`${world}: never booted`); continue; }
  await sleep(2500);
  await ev(`(() => { window.sound?.setVolumes?.(0, 0); window.story?.closePage?.(); if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; }
    if (window.sky) { window.sky.hour = 12; window.sky.speed = 0; window.updateSky?.(); }
    const s = document.createElement('style'); s.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(s); return true; })()`);
  const res = await ev(`(async () => { const C = await import('/scripts/surface-census/page.js'); window.__census = C; C.census(); return C.walk(${JSON.stringify(WALK[world] ?? [])}); })()`);
  if (typeof res === 'string') { report.worlds.push({ world, error: res }); console.log(`${world}: ${res}`); continue; }
  const rows = res.rows.sort((a, b) => b.area - a.area);
  for (const x of rows) {
    if (x.names.length && x.names.every((n) => /voidM/.test(n))) x.cls = 'void';   // (a temple door's dark: temples/kit)
    // (the drawn-only far backdrops, never reached: the Buried Machine's city and ring, the Moon Foundry's far moons; v2.27 left them out)
    else if (x.names.length && x.names.some((n) => /drawn only|^far /.test(n)) && x.names.every((n) => /drawn only|^far |\(unnamed\)/.test(n))) x.cls = 'backdrop';
  }
  const tot = { under: res.tally.under || 1, seen: res.tally.seen || 1 };
  for (const x of rows) { x.underShare = +(x.under / tot.under * 100).toFixed(1); x.seenShare = +(x.seen / tot.seen * 100).toFixed(1); x.walked = +((x.underShare + x.seenShare) / 2).toFixed(1); }
  const row = { world, title: names.TITLES?.[world] ?? world, tally: res.tally, area: shares(rows, 'area'), under: shares(rows, 'under'), seen: shares(rows, 'seen'),
    // (walked: the classes' shares of everything the rays hit, the terrain, water and the rest included, under and seen averaged)
    walkedAll: Object.fromEntries([...COUNTED, ...LEFT_OUT, 'other'].map((c) => [c, +(rows.filter((x) => (x.cls === c)).reduce((s, x) => s + x.walked, 0)).toFixed(1)])),
    rows, errors: errors.slice(0, 4) };
  row.walkedAll.other = +((res.tally.other.under / tot.under * 100 + res.tally.other.seen / tot.seen * 100) / 2).toFixed(1);
  // ---- pictures of the most walked untreated materials (then the largest by area)
  const untreated = rows.filter((x) => UNTREATED.includes(x.cls) || x.cls === 'pending');
  const pick = [...untreated.filter((x) => x.walked >= 0.3 && x.hits.length).sort((a, b) => b.walked - a.walked)];
  for (const x of untreated.filter((x) => x.hits.length).sort((a, b) => b.area - a.area)) if (pick.length < SHOTS && !pick.includes(x)) pick.push(x);
  row.shots = [];
  const tiles = [];
  for (const x of pick.slice(0, SHOTS)) {
    // (up to three of its hits tried, highlighted: the view where it fills most of the frame, so a camera that ended
    // up inside a wall or behind a post doesn't make the picture)
    const tries = [...x.hits.filter((q) => q.kind === 'seen').slice(0, 2), ...x.hits.filter((q) => q.kind === 'under').slice(0, 1)].slice(0, 3);
    await ev(`window.__census.highlight(${JSON.stringify(x.key)}, true)`);
    let best = null;
    for (const h of tries) {
      const v = viewOf(h);
      await ev(pin(v.eye, v.target, v.player)); await sleep(1500);
      const b = await shot(), share = await magentaShare(b);
      if (!best || share > best.share) best = { v, b, share };
      if (share > 0.2) break;
    }
    await ev(`window.__census.highlight(${JSON.stringify(x.key)}, false)`);
    await ev(pin(best.v.eye, best.v.target, best.v.player)); await sleep(1200);
    const a = await shot();
    tiles.push(await sharp(a).resize(400, 225).toBuffer(), await sharp(best.b).resize(400, 225).toBuffer());
    row.shots.push({ key: x.key, colour: x.colour, cls: x.cls, names: x.names, view: best.v, share: +best.share.toFixed(3) });
  }
  if (tiles.length) {
    const rowsN = tiles.length / 2;
    await sharp({ create: { width: 800, height: 225 * rowsN, channels: 3, background: '#ffffff' } })
      .composite(tiles.map((t, i) => ({ input: t, left: (i % 2) * 400, top: Math.floor(i / 2) * 225 }))).jpeg({ quality: 68 }).toFile(join(OUT, `${world}.jpg`));
  }
  for (const x of rows) delete x.hits;
  report.worlds.push(row);
  console.log(`${world.padEnd(12)} ${rows.length} materials · area ${COUNTED.map((c) => `${c} ${row.area[c]}`).join(' ')} · walked ${COUNTED.map((c) => `${c} ${row.walkedAll[c]}`).join(' ')} terrain ${row.walkedAll.terrain} · ${row.shots.length} shots (${((Date.now() - t0) / 1000).toFixed(0)} s)${row.errors.length ? ` · ${row.errors.length} page errors` : ''}`);
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
}

// ---- the tables
const pc = (v) => (v ? v.toFixed(1) : '0');
let md = `# Surface census (${report.revision}, ${PRESET})\n\n## By area (terrain, water, glass, glow, people and grass left out)\n\n| world | ${COUNTED.join(' | ')} |\n|---|${COUNTED.map(() => '---').join('|')}|\n`;
for (const w of report.worlds.filter((w) => w.area)) md += `| ${w.world} | ${COUNTED.map((c) => pc(w.area[c])).join(' | ')} |\n`;
md += `\n## Walked (share of every ray's hit, underfoot and seen averaged; terrain and the rest included)\n\n| world | ${COUNTED.join(' | ')} | terrain | water | glow | cloud | other |\n|---|${COUNTED.map(() => '---').join('|')}|---|---|---|---|---|\n`;
for (const w of report.worlds.filter((w) => w.area)) md += `| ${w.world} | ${COUNTED.map((c) => pc(w.walkedAll[c])).join(' | ')} | ${pc(w.walkedAll.terrain)} | ${pc(w.walkedAll.water)} | ${pc(w.walkedAll.glow)} | ${pc(w.walkedAll.cloud)} | ${pc(w.walkedAll.other)} |\n`;
md += '\n## Untreated materials per world (by walked, then area)\n';
for (const w of report.worlds.filter((w) => w.rows)) {
  md += `\n### ${w.world}\n\n| material | class | walked % (under / seen) | area m² | meshes | options |\n|---|---|---|---|---|---|\n`;
  for (const x of w.rows.filter((x) => UNTREATED.includes(x.cls) || x.cls === 'pending').sort((a, b) => b.walked - a.walked || b.area - a.area).slice(0, 10))
    md += `| ${x.colour} ${x.names.join(', ')} | ${x.cls} | ${x.walked} (${x.underShare} / ${x.seenShare}) | ${x.area} | ${x.meshes} | ${x.opts.replace(/\|/g, '/')} ${x.skin} |\n`;
}
writeFileSync(join(OUT, 'report.md'), md);
console.log(`report.json, report.md and pictures in ${OUT}`);
ws.close(); proc.kill('SIGTERM'); await sleep(1000); removeTemp(profile);
await server.close();
process.exit(0);
