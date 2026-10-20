// The design audits' eyes (.claude/skills/level-design-qc, temple-design-qc): the views the audits planned
// (scripts/level-design/audit.mjs and scripts/temple-design/audit.mjs write views.json), shot world by world in
// ONE muted headless Chrome against ONE dev server, with a rest between worlds; and the audits' SVG maps and
// plans turned into pictures by the same browser. It leaves no Chrome and no server behind.
//
//   node scripts/design-qc/capture.mjs <out-dir> [--views a/views.json,b/views.json] [--svgs dir1,dir2]
//        [--worlds desert,incal] [--rest 15] [--res 960x540] [--preset high] [--fixed-scale] [--query traveller=v2&outfit=<id>]
//   PORT (default 5344; never 5173, the author's own server). Chrome's debugging port: chosen by Chrome.
//   QC_VITE_CACHE: the dev server's cache folder (default: in Chrome's throwaway profile; in a worktree whose node_modules is
//   a link to the main checkout's, give one inside the worktree, .vite-cache/qc, or its deps cannot find three)
// A view: { world, name, eye, target, player?, heading?, hour?, weather?, fov?, flags? (the save its world boots with), act? (an expression
// run in the page before the shot), npc? (aimed at that person instead of eye and target: dist?, side?, face?, dy?), gait? (the
// traveller held in a gait at a phase, { gait, phase }: engine/gait-hold.js, as the engines hold him) }. --query: more of
// the page's address for every world (the v2 traveller, issue #493: traveller=v2&outfit=pearl-diver).
// Writes <out-dir>/<view name>.png for each view, <svg name>.png beside each SVG, and <out-dir>/captured.json (each view's
// draw calls and triangles a frame, averaged over a second before the shot).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tempDir, ownProcess, viteCacheDir } from '../temp-dirs.mjs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'design-qc'));
const [W, H] = arg('res', '960x540').split('x').map(Number), PRESET = arg('preset', 'high'), REST = +arg('rest', 15) * 1000;
const FIXED = args.includes('--fixed-scale');
const QUERY = arg('query', '').replace(/^[?&]/, '');   // (no dynamic resolution, the render scale 1: the Unity side-by-sides, scripts/unity-compare/)
const PORT = Number(process.env.PORT ?? 5344);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const views = (arg('views') ?? '').split(',').filter(Boolean).flatMap((f) => JSON.parse(readFileSync(resolve(f), 'utf8')).views);
const only = arg('worlds')?.split(',');
const svgs = (arg('svgs') ?? '').split(',').filter(Boolean).flatMap((d) => readdirSync(resolve(d)).filter((f) => f.endsWith('.svg')).map((f) => join(resolve(d), f)));

// ---- one Chrome (muted, the real GPU), its debugging port of its own choosing
const profile = tempDir('design-qc-chrome-');
const proc = ownProcess(spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--allow-file-access-from-files', `--window-size=${W},${H}`, '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' }));
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
  // (its own dependency cache: in a worktree node_modules is the main checkout's, and its .vite is the author's server's)
  server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), cacheDir: process.env.QC_VITE_CACHE ?? viteCacheDir('design-qc'), logLevel: 'error', clearScreen: false, server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
  await server.listen();
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
}
const BASE = `http://127.0.0.1:${PORT}/`;
// (a view's `npc`: aimed at that person wherever they stand now, as the engines' fixed views aim one (engine/unity/game.js
// aimed: the eye `dist` m off their front, `side` m aside, at their chest; `face`: at their head), the traveller left where he is)
const npcAim = (v) => `const n = (window.npcs ?? []).find((x) => x.def?.id === ${JSON.stringify(v.npc)} && !x.pooled);
  if (!n) return 'ERR no ${v.npc} here';
  const p = n.pos, h = n.heading ?? 0, d = ${v.dist ?? 2.8}, side = ${v.side ?? 0.6}, el = n.object?.matrixWorld?.elements, fl = el ? Math.hypot(el[8], el[10]) : 0;
  const fx = fl > 1e-6 ? el[8] / fl : Math.sin(h), fz = fl > 1e-6 ? el[10] / fl : Math.cos(h);
  const head = ${v.face ? 'n.humanoid?.b?.Head?.getWorldPosition?.(p.clone())' : 'null'};
  const t = head ? new THREE.Vector3(head.x, head.y + 0.05, head.z) : new THREE.Vector3(p.x, p.y + ${v.face ? 1.6 : 1.1}, p.z);
  const e = new THREE.Vector3(t.x + fx * d + fz * side, ${v.face ? 't.y' : 'p.y + 1.5'} + ${v.dy ?? 0}, t.z + fz * d - fx * side);`;
const pin = (v) => `(() => { const { THREE, camera, player } = window, up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
  ${v.npc ? npcAim(v) : `const e = new THREE.Vector3(...${JSON.stringify(v.eye)}), t = new THREE.Vector3(...${JSON.stringify(v.target)});`}
  window.__pin = { e, q: new THREE.Quaternion().setFromRotationMatrix(m.lookAt(e, t, up)), fov: ${v.fov ?? (v.npc ? 45 : 60)}, far: ${v.far ?? 0} };
  if (!camera.__pinned) { const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld; camera.__pinned = true;
    camera.updateMatrixWorld = function (f) { const P = window.__pin; if (P) { this.position.copy(P.e); this.quaternion.copy(P.q); if (this.fov !== P.fov || (P.far && this.far < P.far)) { this.fov = P.fov; if (P.far) this.far = P.far; this.updateProjectionMatrix(); } } return base.call(this, f); };
    // (and as soon as the follow camera has moved, so what the frame's updates measure from the eye is measured from the
    // pinned one, as the engines' fixed views do: a way's light fading as the eye comes near it, issue #502; before, its
    // fade was the follow camera's, metres off, and a temple's first room seen through its way in came out lighter)
    const rig = window.rig, rigUpdate = rig?.update;
    if (rigUpdate) rig.update = function (...a) { const r = rigUpdate.apply(this, a); const P = window.__pin; if (P) { camera.position.copy(P.e); camera.quaternion.copy(P.q); } return r; }; }
  ${v.player ? `player.teleport?.(new THREE.Vector3(...${JSON.stringify(v.player)}), up, new THREE.Vector3(0, 0, 1));` : ''}
  ${Number.isFinite(v.heading) ? `player.heading = ${v.heading};` : ''}
  ${v.weather && v.weather !== 'clear' ? `if (window.weather) window.weather.mode = ${JSON.stringify(v.weather)};` : ''}
  ${FIXED ? 'const pr = window.preset?.(); if (pr) pr.dynamic = null; if (window.quality) { window.quality.renderScale = 1; window.resize?.(); }' : ''} return true; })()`;
for (const [n, world] of worlds.entries()) {
  if (n) await sleep(REST);   // a rest between worlds: the machine is shared
  await send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(250);
  await ev(`localStorage.clear(); localStorage.setItem('hiraeth.muted','1');
    localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: '${PRESET}', music: 0, effects: 0, voices: 0, soundV: 1 }));
    localStorage.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, ...${JSON.stringify(Object.assign({}, ...views.filter((x) => x.world === world).map((x) => x.flags ?? {})))} }, keepsakes: [] })); true`);   // (a view's `flags`: the save its world boots with, shared by the world's views)
  await send('Page.navigate', { url: `${BASE}?level=${world}${QUERY ? `&${QUERY}` : ''}` });
  let up = false; for (let i = 0; i < 1200 && !up; i++) { up = (await ev('!!window.__hiraethBooted && !!window.player')) === true; if (!up) await sleep(100); }
  if (!up) { console.log(`${world}: never booted`); captured.push({ world, error: 'never booted' }); continue; }
  await sleep(2500);
  // (a makers' house's lights held at their reach as built: their flicker on each side's own clock moved a room's pool of
  // light a size either side between the web's picture and Unity's, issue #264; engine/game.js pin holds them there too)
  await ev(`(() => { window.sound?.setVolumes?.(0, 0); window.story?.closePage?.(); if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; }
    if (window.houseAir) window.houseAir.still = true;
    const s = document.createElement('style'); s.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(s); return true; })()`);
  for (const v of views.filter((x) => x.world === world)) {
    await ev(pin(v));
    // (a view's `gait`: the traveller held in it, the engines' way: engine/gait-hold.js through the dev server)
    { const r = await ev(`import('/engine/gait-hold.js').then((m) => ${v.gait ? `m.holdGait(window.player, ${JSON.stringify(v.gait)})` : 'm.releaseGait(window.player)'} ?? true)`); if (typeof r === 'string' && r.startsWith('ERR')) console.log(`${v.name}: ${r}`); }
    // (a view's `act`: an expression run in the page once the view is set, before the shot: a horn rung, a note sounded)
    if (v.act) { await sleep(1500); const r = await ev(v.act); if (typeof r === 'string' && r.startsWith('ERR')) console.log(`${v.name}: ${r}`); }
    await ev(`(() => { if (window.sky) { window.sky.hour = ${v.hour ?? 12}; window.sky.speed = 0; window.updateSky?.(); } return true; })()`);
    await sleep(v.player ? 3500 : 2500);   // (a teleport: the world round him streams in)
    if (v.npc) { const r = await ev(pin(v)); if (typeof r === 'string' && r.startsWith('ERR')) console.log(`${v.name}: ${r}`); }   // (aimed again where they have walked to)
    // (the frame's draw calls and triangles over a second, from main.js frameStats: a change's cost, view by view)
    const cost = await ev(`new Promise((r) => { const f = window.frameStats, s = []; const t = setInterval(() => { if (f?.n) s.push([f.calls / f.n, f.tris / f.n]); }, 40);
      setTimeout(() => { clearInterval(t); const m = (i) => s.length ? Math.round(s.reduce((a, x) => a + x[i], 0) / s.length) : null; r({ calls: m(0), tris: m(1) }); }, 1200); })`);
    await shoot(join(OUT, `${v.name}.png`));
    captured.push({ world, name: v.name, note: v.note ?? '', ...(cost && typeof cost === 'object' ? cost : {}) });
  }
  console.log(`${world}: ${views.filter((x) => x.world === world).length} views`);
}
writeFileSync(join(OUT, 'captured.json'), JSON.stringify(captured, null, 2));
console.log(`pictures in ${OUT}`);
await done();
process.exit(0);
