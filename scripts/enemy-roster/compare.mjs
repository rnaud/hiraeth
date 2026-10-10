// Contact images of a built archetype against its reference sheets (references/enemy-archetypes/<id>/sheet-N.jpg),
// for the art pass (docs/design/enemy-roster.md, "Art match"): the sheet on top, and under it the game's own body
// from the creatures gallery (enemies.html, through Foes.look) in the sheet's skin and the sheet's views: front,
// side (facing left), three-quarter, and the attack wind-up the sheet draws (80 % of the wind-up: the held pose).
//
//   node scripts/enemy-roster/compare.mjs --out <dir> [--tag after] [--skins 1,2] [crab lizard …]
//     <dir>/compare-<archetype>-<n>[-<tag>].png   sheet n (1: the main skin, 2: the alternate) over the game's body:
//                                                 a contact sheet, a working tool only (never changelog media)
//   node scripts/enemy-roster/compare.mjs --separate --out <dir> [--tag after] [--size 1280x720] [--zoom 0.62] [crab …]
//     <dir>/<archetype>-<n>-<view>[-<tag>].png    each view alone, large, 3D only (no sheet stitched in): the pictures
//                                                 for a before / after (cwebp them into changelog-media/, with the
//                                                 sheet as its own picture: docs/systems/changelog.md, "Enemies")
//
// Which skin each sheet is: the archetype's `art` (src/enemies/archetypes.js: { main, alt } worlds).
// One Vite (PORT, default 5364; never 5173) and one headless muted Chrome (CDP, default 5414), closed at the end.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHETYPES } from '../../src/enemies/archetypes.js';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const OUT = resolve(arg('out', 'output/enemy-roster'));
const TAG = arg('tag', '');
const SEPARATE = args.includes('--separate');
const [SW, SH] = (arg('size', '1280x720')).split('x').map(Number);
const ZOOM = Number(arg('zoom', SEPARATE ? 0.62 : 0.92));
const SHEETS = arg('skins', '1,2').split(',').map(Number);
const picks = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1]?.startsWith('--') && !['--separate'].includes(args[i - 1])));
const PORT = Number(process.env.PORT ?? 5364), CDP = Number(process.env.CDP ?? 5414);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// the wind-ups each sheet draws (attack ids), and the yaw of each view (0: from the front; π/2: side, facing left)
const WINDUPS = { crab: ['spin'], lizard: ['blare'], hound: ['pounce'], tripod: ['beam'], blot: ['lunge', 'spit'], worm: ['spit'], ray: ['skim'], moth: ['flash'], centipede: ['lunge'], jelly: ['ward'],
  toad: ['lob'], heron: ['spear'], skitter: ['rush'], rootknot: ['grip'], brute: ['slam'], drone: ['harpoon'], cart: ['pour'], bell: ['toll'] };
// (the flyers are shown flying: 'walk' in the gallery is the creature moving)
const MOVING = new Set(['ray', 'moth', 'jelly', 'drone']);
// (from above for a flat flyer: its back is what the sheet draws and what you see of it)
const PITCH = { ray: 0.75 };
// (how far into a wind-up the held pose is: the worm's spit before its stones come out of its mouth)
const AT = { worm: 0.35, toad: 0.6 };   // (the toad's: the glob still in its swollen throat)
const VIEWS = [['front', 0], ['side', Math.PI / 2], ['three-quarter', 0.75]];

// (the sheets' skins: art { main, alt }; batch 2's art 'sheet-1': its own skin, the first listed, and sheet-2's from the skins' notes)
const { SKINS } = await import('../../src/enemies/skins.js');
const ALT = { worm: 'buried', ray: 'glassdunes', moth: 'antennas', centipede: 'fallenring', jelly: 'underwater' };
const artOf = (a) => { const A = ARCHETYPES[a]; if (A?.art?.main) return A.art; if (A?.art === 'sheet-1') return { main: Object.keys(SKINS[a])[0], alt: ALT[a] }; return null; };
const list = (picks.length ? picks : Object.keys(WINDUPS)).filter((a) => artOf(a));
if (!list.length) throw new Error('no archetype with its sheets set (art: { main, alt } or sheet-1)');
const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), cacheDir: join(tmpdir(), 'hiraeth-roster-compare'), server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const profile = mkdtempSync(join(tmpdir(), 'hiraeth-compare-chrome-'));
const proc = spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--disable-gpu-shader-disk-cache', '--disk-cache-size=1', '--force-device-scale-factor=1', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
let ws;
try {
  let tabs;
  for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
  ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const waits = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data);
    // (the page's errors, a shader that does not compile among them, said here)
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') console.error('page:', d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 2000));
    if (d.method === 'Runtime.exceptionThrown') console.error('page:', d.params.exceptionDetails?.exception?.description ?? d.params.exceptionDetails?.text);
    if (d.id && waits.has(d.id)) { const [res, rej] = waits.get(d.id); waits.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waits.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/enemies.html` });
  for (let i = 0; i < 240; i++) { try { if (await ev('!!window.enemyViewer')) break; } catch { /* loading */ } await sleep(500); }
  await sleep(1500);
  await ev('window.requestAnimationFrame = () => 0, true');
  mkdirSync(OUT, { recursive: true });
  for (const a of list) {
    const A = ARCHETYPES[a];
    const art = artOf(a);
    for (const [n, world] of [[1, art.main], [2, art.alt]].filter(([n, w]) => w && SHEETS.includes(n))) {
      const job = { id: `${A.kind}@${world}`, sheet: `/references/enemy-archetypes/${a}/sheet-${n}.jpg`, views: VIEWS, windups: WINDUPS[a] ?? [], separate: SEPARATE, size: [SW, SH], zoom: ZOOM, idle: MOVING.has(a) ? 'walk' : 'idle', pitch: PITCH[a] ?? 0.12, at: AT[a] ?? 0.8 };
      const url = await ev(`(async () => {
        const J = ${JSON.stringify(job)}, E = window.enemyViewer, V = E.viewer, W = 1280;
        const img = new Image(); img.src = J.sheet; await img.decode();
        const sheetH = Math.round(img.height * W / img.width);
        E.choose(J.id);
        // a wind-up framed on the body alone, as the views are (the gallery widens its frame to the move's area)
        const T = await import('/node_modules/three/build/three.module.js');
        if (!V._bodyOnly) { const model = V.model; V._bodyOnly = true; V.model = function (id) {
          const m = model.call(this, id); if (!this.mode.startsWith('attack')) return m;
          m.owner.group.position.set(0, 0, 0); m.holder.updateMatrixWorld(true);
          const b = new T.Box3().setFromObject(m.f.model.group); m.owner.group.position.copy(b.getCenter(new T.Vector3())).negate();
          m.r = b.getBoundingSphere(new T.Sphere()).radius; m.height = b.max.y - b.min.y; return m; }; }
        const f = () => V.models.get(J.id)?.f ?? V.model(J.id).f;
        const moves = f().def.attacks.filter((x) => !x.chain);
        const poses = [...J.views.map(([label, yaw]) => ({ label, yaw, mode: J.idle })),
          ...J.windups.map((w) => { const i = moves.findIndex((m) => m.id === w); return { label: (moves[i].name ?? w) + ' wind-up', yaw: 0.75, mode: 'attack' + i, wind: moves[i].wind }; })];
        const pw = J.separate ? J.size[0] : Math.floor(W / poses.length), ph = J.separate ? J.size[1] : 420, shots = [];
        for (const p of poses) {
          const m = f(); m.provoked = true; m.watcher = true;   // (standing: a hound not lying as its shadow, a blot not pooled)
          V.mode = p.mode; V.fixed = null; V.orbit.yaw = p.yaw; V.orbit.pitch = J.pitch; V.orbit.zoom = J.zoom; V.setSize(pw, ph);
          V.time = 0;
          if (!p.mode.startsWith('attack')) for (let i = 0; i < 90; i++) { V.time += 1 / 60; V.render(J.id); }
          else { const t = p.wind * J.at; for (let i = 0; i < 48; i++) { V.time = t * i / 47; V.render(J.id); } }
          const c = document.createElement('canvas'); c.width = pw; c.height = ph; c.getContext('2d').drawImage(V.renderer.domElement, 0, 0);
          shots.push({ c, label: p.label });
        }
        if (J.separate) return shots.map((s) => ({ label: s.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase(), url: s.c.toDataURL('image/png') }));
        const out = document.createElement('canvas'); out.width = W; out.height = sheetH + ph;
        const g = out.getContext('2d'); g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, W, out.height);
        g.drawImage(img, 0, 0, W, sheetH);
        g.fillStyle = '#b7a98f'; g.fillRect(0, sheetH, W, 2);
        shots.forEach((s, i) => { g.drawImage(s.c, i * pw, sheetH + 2); g.fillStyle = '#5a4a3a'; g.font = '15px sans-serif'; g.fillText(i ? s.label : J.id + ' · ' + s.label, i * pw + 8, sheetH + 22); });
        return out.toDataURL('image/png');
      })()`);
      const files = SEPARATE ? url.map((s) => [join(OUT, `${a}-${n}-${s.label}${TAG ? '-' + TAG : ''}.png`), s.url]) : [[join(OUT, `compare-${a}-${n}${TAG ? '-' + TAG : ''}.png`), url]];
      for (const [file, data] of files) { writeFileSync(file, Buffer.from(data.split(',')[1], 'base64')); console.log(file); }
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
