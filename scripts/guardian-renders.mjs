#!/usr/bin/env node
// Turnaround renders of the guardians' in-game models (docs/design/guardian-turnaround-prompts.md, "From the game's
// model"): each guardian's body built by the game's own code (src/temples/guardian-*.js, guardians.js), in its
// neutral rest pose, drawn by the game's pipeline (the character studio's G-buffer and ink pass, studio.html) on a
// flat paper backdrop, lit from beside the camera in every view, no floor and no shadows; four views in one row at
// one scale (front, front three-quarter, side in profile facing left, back), the camera at mid-body height looking
// level. The sheet is the base picture (--refs) of a guardian's "from the game's model" turnaround prompt.
//
//   node scripts/guardian-renders.mjs --out <dir> [--ids listener,last-founder,anchor-warden] [--width 1600]
//
// A vite server of its own (port 5881) and a muted headless Chrome (scripts/temp-dirs.mjs), both gone at exit.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, ownProcess } from './temp-dirs.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const PORT = 5881, CDP = 5882;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** The guardians it draws: the module and builder of each body, and how its rest pose is held. */
export const SUBJECTS = {
  listener: { module: '/src/temples/guardian-listener.js', build: 'listenerModel' },
  'last-founder': { module: '/src/temples/guardian-founder.js', build: 'founderModel' },
  'anchor-warden': { module: '/src/temples/guardian-anchor.js', build: 'anchorModel' },
};

/** The four views, left to right (the order of the turnaround prompts): the camera's yaw round the body (0: in front, on +z). */
export const VIEWS = [
  { id: 'front', yaw: 0 },
  { id: 'three-quarter', yaw: Math.PI / 4 },
  { id: 'side', yaw: Math.PI / 2 },     // (the camera on +x: the body faces the picture's left)
  { id: 'back', yaw: Math.PI },
];

/**
 * Where the camera stands for a view (pure): level with the middle of the body's box (centre, size: [x, y, z] m), far
 * enough that the box fits the picture from any yaw, the same distance in every view (one scale). The box's
 * horizontal half-diagonal fits the width, its half-height the height, and the near half of it stands closer.
 */
export function viewCamera({ centre, size, fov, aspect = 1 }, yaw, margin = 1.06) {
  const vHalf = (fov * Math.PI) / 360, hHalf = Math.atan(Math.tan(vHalf) * aspect);
  const rh = Math.hypot(size[0], size[2]) / 2, rv = size[1] / 2;
  const d = Math.max(rv / Math.tan(vHalf), rh / Math.tan(hHalf)) * margin + rh;
  return { eye: [centre[0] + Math.sin(yaw) * d, centre[1], centre[2] + Math.cos(yaw) * d], target: [...centre], d };
}

/** The sheet's layout: one row of `n` cells across `width` px, cell w × h at the render's aspect (pure). */
export function sheetLayout(n, width, aspect) {
  const w = Math.floor(width / n), h = Math.round(w / aspect);
  return { width: w * n, height: h, cells: Array.from({ length: n }, (_, i) => ({ x: i * w, y: 0, w, h })) };
}

export function parseArgs(argv) {
  const o = { ids: Object.keys(SUBJECTS), width: 1600, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === '--ids') { o.ids = v.split(',').map((s) => s.trim()).filter(Boolean); i++; }
    else if (a === '--width') { o.width = +v; i++; }
    else if (a === '--out') { o.out = v; i++; }
    else throw new Error(`unknown option ${a}`);
  }
  for (const id of o.ids) if (!SUBJECTS[id]) throw new Error(`no guardian "${id}" (there: ${Object.keys(SUBJECTS).join(', ')})`);
  if (!o.out) throw new Error('--out <dir> is needed');
  return o;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chrome() {
  const profile = tempDir('hiraeth-guardian-renders-chrome-');
  const proc = ownProcess(spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check',
    '--disable-gpu-shader-disk-cache', '--disk-cache-size=1', '--force-device-scale-factor=1', '--window-size=900,1200', 'about:blank'], { stdio: 'ignore' }));
  let tabs;
  for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
  if (!tabs) throw new Error('Chrome did not start');
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const waits = new Map(), errors = [];
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waits.has(d.id)) { const [res, rej] = waits.get(d.id); waits.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails?.exception?.description ?? 'exception');
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waits.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${expression.slice(0, 90)}…: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  const close = async () => { try { ws.close(); } catch { /* gone */ } proc.kill('SIGTERM'); await sleep(500); };
  return { send, ev, errors, close };
}

// (in the page: the studio's pipeline, the people hidden, the guardian built by the game's code and held at rest)
const PAGE = ({ subjects, views, layout, render }) => `(async () => {
  const T = await import('/node_modules/three/build/three.module.js');
  const { sharedUniforms: SU } = await import('/src/materials.js');
  const S = window.studio;
  S.set({ bg: 'flat', bgColor: '#f3ead8', ground: false, shadows: 'off', hatch: false, subject: false, preset: 'world', hour: 11 });
  S.applyLight();
  // only the guardian on stage: the people, their capes and the studio's own props (the gaze marker, the stool) hidden
  // just before each picture (the studio's frame loop shows some of them again between awaits)
  const bare = (keep) => {
    for (const p of S.people()) { p.root.visible = false; if (p.npc?.cape) p.npc.cape.mesh.visible = false; }
    for (const o of S.scene.children) if (!o.isLight) o.visible = o === keep;
  };
  const cam = S.camera, U = S.post.uniforms, R = S.renderer;
  cam.aspect = R.domElement.width / R.domElement.height; cam.fov = 16; cam.updateProjectionMatrix();
  const out = {};
  for (const [id, sub] of Object.entries(${JSON.stringify(subjects)})) {
    const mod = await import(sub.module);
    const m = mod[sub.build]();
    S.scene.add(m.group);
    // the rest pose: idle (no fight, no attack) eased a few seconds at t = 0, so every sway's sine is nil
    for (let i = 0; i < 240; i++) m.animate(1 / 60, 0, { state: 'idle', attack: null, k: 0, meter: 0 });
    if (m.bars) m.bars.rotation.y = 0;
    // (the Listener's four lips half open round its ear, as the prompts ask: in its fight they are a quarter open)
    if (m.lips) for (const l of m.lips) l.rotation.x = -0.9 + 0.5 * 1.7;
    for (const h of m.hanging ?? []) h.rotation.x = 0;
    m.group.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(m.group, true), c = box.getCenter(new T.Vector3());
    const size = box.getSize(new T.Vector3());
    const sheet = document.createElement('canvas'); sheet.width = ${layout.width}; sheet.height = ${layout.height};
    const g = sheet.getContext('2d'); g.fillStyle = '#f3ead8'; g.fillRect(0, 0, sheet.width, sheet.height);
    const views = ${JSON.stringify(views)}, cells = ${JSON.stringify(layout.cells)};
    for (const [n, v] of views.entries()) {
      const { eye } = (${viewCamera.toString()})({ centre: c.toArray(), size: size.toArray(), fov: cam.fov, aspect: cam.aspect }, v.yaw);
      cam.position.fromArray(eye); cam.lookAt(c); cam.updateMatrixWorld();
      // the light from just beside the camera and a little above it, the same in every view: nearly all of what is seen
      // is lit (few shadow edges for a drawing to copy as painted light), the toon threshold lowered to match
      const a = v.yaw + 0.3, sun = new T.Vector3(Math.sin(a), 0.55, Math.cos(a)).normalize();
      SU.uSunDir.value.copy(sun); if (U.uSunDir) U.uSunDir.value.copy(sun);
      const toon = SU.uToon.value; SU.uToon.value = toon * 0.6;
      bare(m.group);
      S.render();
      SU.uToon.value = toon;
      const cell = cells[n];
      g.drawImage(R.domElement, 0, 0, R.domElement.width, R.domElement.height, cell.x, cell.y, cell.w, cell.h);
    }
    out[id] = { jpeg: sheet.toDataURL('image/jpeg', 0.9), size: box.getSize(new T.Vector3()).toArray().map((x) => +x.toFixed(2)) };
    S.scene.remove(m.group);
  }
  return out;
})()`;

export async function main(argv = process.argv.slice(2)) {
  const o = parseArgs(argv);
  const outDir = resolve(o.out); mkdirSync(outDir, { recursive: true });
  const render = { w: 900, h: 1200 }, layout = sheetLayout(VIEWS.length, o.width, render.w / render.h);
  const { createServer } = await import('vite');
  const server = await createServer({ root: ROOT, cacheDir: tempDir('.guardian-renders-vite-', ROOT), server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false }, logLevel: 'error' });
  await server.listen();
  const c = await chrome();
  try {
    await c.send('Emulation.setDeviceMetricsOverride', { width: render.w, height: render.h, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/studio.html?who=npc&world=desert&view=full&bg=flat` });
    for (let i = 0; i < 240; i++) { if (await c.ev('!!window.studio').catch(() => false)) break; await sleep(250); }
    await sleep(1500);
    const subjects = Object.fromEntries(o.ids.map((id) => [id, SUBJECTS[id]]));
    const res = await c.ev(PAGE({ subjects, views: VIEWS, layout, render }));
    for (const [id, r] of Object.entries(res)) {
      const file = join(outDir, `${id}-game-render.jpg`);
      writeFileSync(file, Buffer.from(r.jpeg.split(',')[1], 'base64'));
      console.log(`${file}  (${layout.width}×${layout.height}; body ${r.size.join(' × ')} m)`);
    }
    if (c.errors.length) console.warn('page errors:', c.errors.join('\n'));
  } finally { await c.close(); await server.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
