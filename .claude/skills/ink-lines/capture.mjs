// The ink-lines audit's eyes (.claude/skills/ink-lines/SKILL.md): a fixed set of scenes (plants near, mid and far,
// the traveller's face at 1, 4, 10 and 25 m, a pack of foes, a temple hall, a town far off) shot at every
// resolution the game is played at, in a MUTED headless Chrome on the real GPU, the game's clock held (every frame the
// same), and each picture measured (scripts/ink-lines/lib.mjs): how wide the lines are against the object they draw,
// how much of a plant or a person is ink or near-black, the traveller's eyes against his cheek, and how much the
// lines change with the camera half a pixel over.
//
//   node .claude/skills/ink-lines/capture.mjs <out-dir> [--res desk1080,desk1080x2,p720,handheld,handheld-low,deck,phone]
//        [--scenes portrait-1,veg-far,…] [--worlds desert,edena,…] [--save all|final|none] [--tag before]
//        PORT (default 5617; Chrome's debugging port PORT + 1). Never 5173.
// Writes <out-dir>/report.json (every picture's measures and grade) and <out-dir>/<res>/<scene>.png (the final
// picture; with --save all also the ink, the albedo pair and the nudged ink). Then:
//   node .claude/skills/ink-lines/report.mjs <out-dir>/report.json [--before <dir>/report.json] [--out docs/audits/ink-lines-v<version>.md]
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { decodePNG } = await import(join(ROOT, 'scripts/png.mjs'));
const L = await import(join(ROOT, 'scripts/ink-lines/lib.mjs'));
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'ink-lines'));
const SAVE = arg('save', 'final');
const PORT = Number(process.env.PORT ?? 5617), CDP = PORT + 1;
if (PORT === 5173 || CDP === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ the matrix
// CSS size, device pixel ratio, the graphics preset and (where the preset's dynamic resolution would move it) a fixed
// render scale. The reference, where the author approved the look: desk1080 (1920 × 1080, Medium, scale 1).
export const RESOLUTIONS = {
  desk1080: { w: 1920, h: 1080, dpr: 1, quality: 'medium', note: '1920 × 1080, Medium (scale 1): the reference' },
  'desk1080x2': { w: 1920, h: 1080, dpr: 2, quality: 'high', note: '1920 × 1080 at DPR 2, High (scale 1 on HiDPI: 3840 × 2160)' },
  p720: { w: 1280, h: 720, dpr: 1, quality: 'medium', note: '1280 × 720, Medium' },
  handheld: { w: 1280, h: 720, dpr: 1, quality: 'handheld', scale: 0.75, note: 'Handheld (Retroid), 1280 × 720 at scale 0.75 (960 × 540)' },
  'handheld-low': { w: 1280, h: 720, dpr: 1, quality: 'handheld', scale: 0.5, note: 'Handheld at its dynamic floor, scale 0.5 (640 × 360)' },
  deck: { w: 1280, h: 800, dpr: 1, quality: 'deck', scale: 1, note: 'Steam Deck, 1280 × 800' },
  phone: { w: 844, h: 390, dpr: 3, quality: 'handheld', scale: 0.75, note: 'a phone (390 × 844 held sideways) at DPR 3, Handheld (1899 × 877)' },
};

// The scenes, world by world. `kind` says which checks apply (lib.mjs grade); `hide` is the in-page code that hides the
// object measured (its mask: the albedo with and without it); `cam` returns { eye, target, fov } (and may move people).
const FACE = (d, up = 0) => ({ kind: 'figure', world: 'desert', hide: 'player.object', portrait: true, d, up });
export const SCENES = {
  'portrait-1': FACE(1), 'portrait-4': FACE(4), 'portrait-10': FACE(10), 'portrait-25': FACE(25),
  'veg-near': { kind: 'foliage', world: 'edena', hide: 'flora.root', d: 5 },
  'veg-mid': { kind: 'foliage', world: 'edena', hide: 'flora.root', d: 18 },
  'veg-far': { kind: 'foliage', world: 'edena', hide: 'flora.root', d: 55, far: true },
  'veg-farthest': { kind: 'foliage', world: 'edena', hide: 'flora.root', d: 120, far: true },
  'canopy-mid': { kind: 'foliage', world: 'spheres', hide: 'leaves', d: 25 },
  'canopy-far': { kind: 'foliage', world: 'spheres', hide: 'leaves', d: 80, far: true },
  'pack': { kind: 'foe', world: 'arena', hide: 'foes.group', d: 14 },
  'temple-hall': { kind: 'view', world: 'temple' },
  // (the start of the bench's ride-city path, at the hoverbike's hollow, looking up the valley past the camps to Qanat)
  'town-far': { kind: 'view', world: 'desert', view: { player: [132, 9.227, 150], eye: [130.593, 12.427, 143.143], target: [166.8, 11.4, 319.5], fov: 55 } },
};
const WORLD_URL = { desert: 'desert', edena: 'edena', spheres: 'spheres', arena: 'arena', temple: 'desert' };

const RES = arg('res', Object.keys(RESOLUTIONS).join(',')).split(',').filter((k) => RESOLUTIONS[k]);
const WANT = arg('scenes', Object.keys(SCENES).join(',')).split(',').filter((k) => SCENES[k]);
const WORLDS = arg('worlds') ? arg('worlds').split(',') : [...new Set(WANT.map((k) => SCENES[k].world))];

// ------------------------------------------------------------------ one headless Chrome at a time on this machine
function othersChrome() {
  // (an orphan, its runner gone (parent 1) for over 5 minutes, is not waited for: it would never end; it isn't ours to kill)
  const orphan = (l) => { const [, ppid, et] = l.trim().split(/\s+/); return ppid === '1' && (et.includes('-') || et.split(':').length > 2 || +et.split(':')[0] >= 5); };
  try { return execFileSync('ps', ['-axo', 'pid,ppid,etime,command'], { encoding: 'utf8' }).split('\n').filter((l) => l.includes('--headless') && !l.includes('Helper') && !l.includes('--type=') && /Google Chrome |chrome-headless|Chromium/.test(l) && !l.includes(`--remote-debugging-port=${CDP}`) && !orphan(l)).length; } catch { return 0; }
}
for (let i = 0; othersChrome() > 0; i++) { if (i % 12 === 0) console.log('another headless Chrome is running: waiting for it'); await sleep(5000); }

const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', clearScreen: false,
  server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const BASE = `http://127.0.0.1:${PORT}/`;
const profile = mkdtempSync(join(tmpdir(), 'inklines-chrome-'));
const proc = spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--window-size=1920,1080',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-gpu-shader-disk-cache', 'about:blank'], { stdio: 'ignore' });
const finish = async () => { try { ws?.close(); } catch { /* gone */ } proc.kill('SIGTERM'); await sleep(1200); rmSync(profile, { recursive: true, force: true }); await server.close(); };
process.on('SIGINT', async () => { await finish(); process.exit(130); });
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waits = new Map(), errors = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails?.exception?.description ?? '').slice(0, 200)); });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const d = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (d.result?.exceptionDetails) throw new Error(`${e.slice(0, 120)}…: ${d.result.exceptionDetails.exception?.description?.slice(0, 300)}`); return d.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
// the game's clock taken over (scripts/motion-check/record.mjs): frames only when stepped, every one the same
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const realNow = performance.now.bind(performance);
  const V = window.__vt = { manual: false, t: 0, q: [] };
  performance.now = () => (V.manual ? V.t : realNow());
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { if (V.manual) { V.q.push(cb); return 1; } return raf((ts) => (V.manual ? V.q.push(cb) : cb(ts))); };
  // (from a fixed hour of the clock, not the real one: the sway, the clouds and the idle run from the same instant every run)
  V.start = () => { V.t = Math.max(realNow() + 1000, 3600000); V.manual = true; };
  V.step = (dt) => { V.t += dt * 1000; const q = V.q; V.q = []; for (const cb of q) cb(V.t); };
})();` });

const metricsFor = (r) => send('Emulation.setDeviceMetricsOverride', { width: r.w, height: r.h, deviceScaleFactor: r.dpr, mobile: false });
const steps = (n, dt = 1 / 30) => ev(`(() => { for (let i = 0; i < ${n}; i++) window.__vt.step(${dt}); return true; })()`);
const grab = async () => decodePNG(Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
const grabRaw = async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64');
// the view drawn again with nothing moved (renderFrame: no clock, no simulation), so the final picture, the debug
// views and the albedo with and without the object are of one instant
// (the shaders' clock held at one value too: the plants' sway, the clouds and the lines' boil the same in every run)
const T = 'window.sharedUniforms.uTime.value = window.post.uniforms.uTime.value = 1000';
const debugView = (n) => ev(`(window.params.debug = ${n}, window.post.uniforms.uDebug.value = ${n}, ${T}, window.renderFrame(), true)`);
const redraw = () => ev(`(${T}, window.renderFrame(), true)`);

const SETUP = `(() => {
  const { THREE, camera } = window;
  window.sound?.setVolume?.(0); window.sound?.setVolumes?.(0, 0);
  window.story?.closePage?.();
  if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; }
  window.sky.hour = 10.5; window.sky.speed = 0; window.updateSky?.();
  const s = document.createElement('style'); s.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(s);
  document.querySelectorAll('body > *').forEach((e) => { if (e.tagName !== 'CANVAS' && e.querySelector('canvas')) e.style.setProperty('visibility', 'visible', 'important'); });
  const up = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4();
  window.__cam = null;
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (f) { const c = window.__cam; if (c) { this.position.copy(c.eye); this.quaternion.copy(c.q); if (this.fov !== c.fov) { this.fov = c.fov; this.updateProjectionMatrix(); } } return base.call(this, f); };
  window.__setCam = (eye, target, fov = 55) => { const e = new THREE.Vector3(...eye), t = new THREE.Vector3(...target); window.__cam = { eye: e, t, q: new THREE.Quaternion().setFromRotationMatrix(m4.lookAt(e, t, up)), fov }; };
  // half a render pixel sideways (the shimmer's second take)
  window.__nudge = (k = 0.5) => { const c = window.__cam; const h = window.renderer.domElement.height * (window.quality.renderScale ?? 1) / (window.renderer.getPixelRatio?.() || 1);
    const rh = window.post.uniforms.uRes.value.y, d = c.eye.distanceTo(c.t), px = 2 * d * Math.tan(c.fov * Math.PI / 360) / rh;
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(c.q); c.eye.addScaledVector(side, px * k); c.t.addScaledVector(side, px * k); };
  window.__vt.start();
  return true; })()`;

/** The traveller's eyes on screen (device px of the screenshot): each eye's centre, its drawn half width and height, a cheek point under it. */
const EYES = `(() => {
  const { THREE, camera, renderer } = window;
  let mesh = null; window.player.object.traverse((o) => { if (o.name === 'TravellerTripoHeadV2') mesh = o; });
  if (!mesh) return null;
  const sk = mesh.skeleton, bi = sk.bones.findIndex((b) => b.name === 'Head'); if (bi < 0) return null;
  const M = new THREE.Matrix4().multiplyMatrices(sk.bones[bi].matrixWorld, sk.boneInverses[bi]).multiply(mesh.bindMatrix).premultiply(mesh.bindMatrixInverse).premultiply(mesh.matrixWorld);
  // HEAD_FIT (tripo-head.js): bind = offset + scale × source; HEAD_INK.eye (head-ink.js) in source units
  const S = 0.32, O = [-0.001, 1.455, -0.006], E = { x: 0.0995, y: 0.5935, w: 0.0405, up: 0.0134, lo: 0.0108 };
  const pos = mesh.geometry.attributes.position;
  // the skin's front at a source point: the vertex nearest it in x, y with the largest z (the face)
  const front = (sx, sy) => { const bx = O[0] + S * sx, by = O[1] + S * sy; let best = null, bz = -1e9;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); if (Math.abs(x - bx) < 0.006 && Math.abs(y - by) < 0.006 && pos.getZ(i) > bz) { bz = pos.getZ(i); best = i; } }
    return best === null ? null : new THREE.Vector3(bx, by, bz).applyMatrix4(M); };
  const W = renderer.domElement.width, H = renderer.domElement.height, dpr = window.devicePixelRatio;
  const scr = (v) => { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * W / renderer.getPixelRatio() * dpr, (0.5 - p.y * 0.5) * H / renderer.getPixelRatio() * dpr]; };
  const out = [];
  for (const side of [-1, 1]) {
    const c = front(-0.001 + side * E.x, E.y), r = front(-0.001 + side * (E.x + E.w), E.y), t = front(-0.001 + side * E.x, E.y + E.up), ch = front(-0.001 + side * E.x, E.y - 0.075);
    if (!c || !r || !t || !ch) return null;
    const [x, y] = scr(c), [rx, ry] = scr(r), [tx, ty] = scr(t);
    out.push({ x, y, w: Math.hypot(rx - x, ry - y), h: Math.hypot(tx - x, ty - y) * (E.up + E.lo) / (2 * E.up), cheek: scr(ch) });
  }
  const head = front(-0.001, 0.62), chin = front(-0.001, 0.36);
  return { eyes: out, facePx: head && chin ? Math.hypot(...scr(head).map((v, i) => v - scr(chin)[i])) : 0 };
})()`;

function hideExpr(what, on) {
  const v = on ? 'false' : 'true';
  if (what === 'leaves') return `(() => { let n = 0; window.scene.traverse((o) => { const m = o.material; if (o.isMesh && m && !Array.isArray(m) && (m.userData?.cacheKey ?? '').includes('"pattern":"leaves"')) { o.visible = ${v}; n++; } }); return n; })()`;
  return `(() => { const o = window.${what}; if (!o) return 0; o.visible = ${v}; return 1; })()`;
}

/** Where to stand and look for a scene: in-page, returns { eye, target, fov, info }. */
function camExpr(name, sc) {
  if (sc.portrait) return `(() => {
    const { THREE, player } = window;
    if (!window.__spot) window.__spot = player.pos.clone();
    player.teleport?.(window.__spot.clone(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); player.pos.copy(window.__spot); player.vel?.set(0, 0, 0); player.heading = 0;
    for (let i = 0; i < 4; i++) window.__vt.step(1 / 30);
    // the face's middle and the way it looks, from the head's skinning (tripo-head.js face.at / facing)
    let mesh = null; player.object.traverse((o) => { if (o.name === 'TravellerTripoHeadV2') mesh = o; });
    const sk = mesh.skeleton, bi = sk.bones.findIndex((b) => b.name === 'Head');
    const M = new THREE.Matrix4().multiplyMatrices(sk.bones[bi].matrixWorld, sk.boneInverses[bi]).multiply(mesh.bindMatrix).premultiply(mesh.bindMatrixInverse).premultiply(mesh.matrixWorld);
    const h = new THREE.Vector3(-0.001, 1.619, 0.076).applyMatrix4(M);
    const f = new THREE.Vector3(0, 0, 1).transformDirection(M).setY(0).normalize();
    const eye = h.clone().addScaledVector(f, ${sc.d}).add(new THREE.Vector3(0, ${sc.d * 0.03 + 0.02}, 0));
    const gy = window.physics.groundAt(eye.x, eye.y + 30, eye.z, 80);   // (never inside a dune)
    if (Number.isFinite(gy)) eye.y = Math.max(eye.y, gy + 1.2);
    window.__setCam(eye.toArray(), h.toArray(), ${sc.d <= 1 ? 40 : 55});
    return { head: h.toArray() }; })()`;
  if (sc.hide === 'flora.root') return `(() => {
    // the tallest plants within 200 m of the start, the camera ${sc.d} m off one on the side toward the start
    const { THREE, flora, player } = window, P = flora.plants, s = player.pos;
    if (!window.__plant) { const near = P.filter((p) => Math.hypot(p.x - s.x, p.z - s.z) < 200).sort((a, b) => b.height - a.height);
      const p = near.find((p) => p.height < 6) ?? near[0]; window.__plant = p; }
    const p = window.__plant, dir = new THREE.Vector3(s.x - p.x, 0, s.z - p.z); if (dir.lengthSq() < 1) dir.set(0, 0, 1); dir.normalize();
    const ex = p.x + dir.x * ${sc.d}, ez = p.z + dir.z * ${sc.d};
    const gy = window.physics.groundAt(ex, p.y + 200, ez, 600);
    const ey = (Number.isFinite(gy) ? gy : p.y) + 1.7 + ${sc.d} * 0.04;
    // the traveller behind the camera, the world streamed round him
    player.pos.set(ex + dir.x * 2.5, Number.isFinite(gy) ? gy : p.y, ez + dir.z * 2.5); player.vel?.set(0, 0, 0);
    window.__setCam([ex, ey, ez], [p.x, p.y + p.height * 0.5, p.z], 55);
    return { plant: [p.x, p.y, p.z], height: p.height }; })()`;
  if (sc.hide === 'leaves') return `(() => {
    // a tree's crown near the start: of the leaves meshes (instanced), the one with the biggest geometry, its instance
    // nearest the start past 12 m; the camera ${sc.d} m off it toward the start
    const { THREE, player } = window, s = player.pos;
    if (!window.__canopy) { let mesh = null, big = 0, n = 0;
      window.scene.traverse((o) => { const m = o.material; if (!(o.isMesh && m && !Array.isArray(m) && (m.userData?.cacheKey ?? '').includes('"pattern":"leaves"'))) return;
        n++; o.geometry.computeBoundingSphere(); const r = o.geometry.boundingSphere.radius; if (r > big && r < 30) { big = r; mesh = o; } });
      if (!mesh) return { error: 'no canopy (' + n + ' leaves meshes)' };
      const M = new THREE.Matrix4(), c = new THREE.Vector3(); let bd = 1e9, best = null;
      const count = mesh.isInstancedMesh ? mesh.count : 1;
      for (let i = 0; i < count; i++) { if (mesh.isInstancedMesh) mesh.getMatrixAt(i, M); else M.identity();
        c.copy(mesh.geometry.boundingSphere.center).applyMatrix4(M).applyMatrix4(mesh.matrixWorld); const d = c.distanceTo(s); if (d > 12 && d < bd) { bd = d; best = c.clone(); } }
      window.__canopy = best; }
    const p = window.__canopy; if (!p) return { error: 'no canopy instance' };
    const dir = new THREE.Vector3(s.x - p.x, 0, s.z - p.z); if (dir.lengthSq() < 1) dir.set(0, 0, 1); dir.normalize();
    const ex = p.x + dir.x * ${sc.d}, ez = p.z + dir.z * ${sc.d}; const gy = window.physics.groundAt(ex, p.y + 200, ez, 600);
    const ey = Math.max(Number.isFinite(gy) ? gy + 1.7 : p.y, p.y - ${sc.d} * 0.15);
    player.pos.set(ex + dir.x * 2.5, Number.isFinite(gy) ? gy : p.y - 5, ez + dir.z * 2.5); player.vel?.set(0, 0, 0);
    window.__setCam([ex, ey, ez], p.toArray(), 55);
    return { canopy: p.toArray() }; })()`;
  if (sc.hide === 'foes.group') return `(() => {
    const { THREE, player, foes } = window;
    if (!window.__packed) { window.__packed = true; foes.setPractice('blot'); foes.spawnKind('blot', { n: 2 }); foes.spawnKind('machine', { n: 1 }); }
    const list = foes.list, f = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
    const c = player.pos.clone().addScaledVector(f, 9);
    list.forEach((e, i) => { const p = e.pos; if (p) { p.copy(c).add(new THREE.Vector3((i - 1.5) * 2.2, 0, (i % 2) * 1.5)); p.y = window.physics.groundAt(p.x, p.y + 20, p.z, 60) ?? p.y; } });
    const eye = c.clone().addScaledVector(f, -${sc.d}).add(new THREE.Vector3(0, 2.2, 0));
    window.__setCam(eye.toArray(), c.clone().add(new THREE.Vector3(0, 0.8, 0)).toArray(), 55);
    return { foes: list.length }; })()`;
  if (sc.world === 'temple') return `(() => {
    const { THREE, player } = window, T = Object.values(window.temples ?? {})[0]; if (!T?.arrival) return { error: 'no temple' };
    const a = T.arrival, f = new THREE.Vector3(Math.sin(a.heading), 0, Math.cos(a.heading)), p = a.pos.clone ? a.pos.clone() : new THREE.Vector3(...a.pos);
    player.teleport?.(p.clone(), new THREE.Vector3(0, 1, 0), f.clone()); player.pos.copy(p); player.vel?.set(0, 0, 0); player.heading = a.heading;
    const eye = p.clone().addScaledVector(f, -3.2).add(new THREE.Vector3(0, 2.2, 0));
    window.__setCam(eye.toArray(), p.clone().addScaledVector(f, 8).add(new THREE.Vector3(0, 1.2, 0)).toArray(), 60);
    return { temple: T.id }; })()`;
  if (sc.view) return `(() => {
    const V = ${JSON.stringify(sc.view)};
    const { player } = window;
    if (V.player) { player.pos.set(...V.player); player.vel?.set(0, 0, 0); }
    window.__setCam(V.eye, V.target, V.fov ?? 55); return { view: V.name }; })()`;
  throw new Error(`no camera for ${name}`);
}

async function boot(world) {
  await send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(300);
  await ev(`localStorage.clear(); localStorage.setItem('moebius.muted','1');
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: 'medium', music: 0, effects: 0, voices: 0, volume: 0, enemies: '${world === 'arena' ? 'on' : 'off'}' }));
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] })); true`);
  errors.length = 0;
  await send('Page.navigate', { url: `${BASE}?level=${WORLD_URL[world]}` });
  let up = false; for (let i = 0; i < 1500 && !up; i++) { up = (await ev('!!window.__moebiusBooted && !!window.player && !!window.renderFrame').catch(() => false)) === true; if (!up) await sleep(100); }
  if (!up) return false;
  await sleep(2500);
  await ev(SETUP);
  return true;
}

async function setRes(r) {
  await metricsFor(r);
  await ev(`(() => { window.settings.quality = '${r.quality}'; window.applyQuality?.(); const p = window.preset(); p.dynamic = null; ${r.scale ? `window.quality.renderScale = ${r.scale};` : ''} window.resize(); return true; })()`);
  await steps(6);
  return ev(`({ scale: window.quality.renderScale, res: [window.post.uniforms.uRes.value.x, window.post.uniforms.uRes.value.y], pr: window.post.uniforms.uPixelRatio.value, dpr: window.devicePixelRatio })`);
}

mkdirSync(OUT, { recursive: true });
const report = { date: new Date().toISOString(), tag: arg('tag', ''), commit: execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(), resolutions: {}, rows: [] };
const t0 = Date.now();
for (const world of WORLDS) {
  const scenes = WANT.filter((k) => SCENES[k].world === world);
  if (!scenes.length) continue;
  if (!(await boot(world))) { console.log(`${world}: never booted ${errors.slice(0, 2).join(' | ')}`); continue; }
  for (const rk of RES) {
    const r = RESOLUTIONS[rk];
    const got = await setRes(r);
    report.resolutions[rk] = { ...r, ...got };
    mkdirSync(join(OUT, rk), { recursive: true });
    for (const name of scenes) {
      const sc = SCENES[name];
      const row = { scene: name, res: rk, kind: sc.kind, far: !!sc.far, world };
      try {
        await ev(`(window.params.debug = 0, true)`);
        row.info = await ev(camExpr(name, sc));
        if (row.info?.error) throw new Error(row.info.error);
        await steps(name === 'pack' ? 4 : sc.world === 'temple' ? 90 : 24);   // (the temple's lamps wake as he comes in; the flora's cells, the LODs and the shadows round the new view)
        await ev(camExpr(name, sc));   // (again: the first frames moved people as the world streamed in)
        await steps(8);
        await debugView(0);
        const finalRaw = await grabRaw(), fin = decodePNG(finalRaw);
        writeFileSync(join(OUT, rk, `${name}.png`), finalRaw);
        await debugView(14); const inkImg = await grab(), ink = L.inkOf(inkImg);
        const W = fin.width, H = fin.height, m = { frameInk: ink.reduce((a, v) => a + v, 0) / ink.length, frameWidth: L.strokeWidth(ink, W, H) };
        if (sc.hide) {
          await debugView(2); const withIt = await grab();
          row.hidden = await ev(hideExpr(sc.hide, true)); await redraw(); const without = await grab(); await ev(hideExpr(sc.hide, false));
          const mask = L.objectMask(withIt, without);
          m.object = L.extent(mask, W, H);
          if (m.object.n) {
            const grow = Math.max(2, Math.round(2 * r.dpr));
            m.inkShare = L.inkShare(ink, mask, W, H, grow);
            m.darkShare = L.darkShare(fin, mask, grow);
            m.width = L.strokeWidth(ink, W, H, { within: L.dilate(mask, W, H, grow) });
          }
          if (SAVE === 'all') { const mi = { pixels: new Uint8Array(W * H * 3), channels: 3, width: W, height: H }; for (let p = 0; p < mask.length; p++) mi.pixels.fill(mask[p] ? 255 : 0, p * 3, p * 3 + 3);
            writeFileSync(join(OUT, rk, `${name}-mask.png`), await L.encodePNG(mi)); writeFileSync(join(OUT, rk, `${name}-ink.png`), await L.encodePNG(inkImg)); }
        }
        if (sc.portrait) {
          await debugView(0);
          const e = await ev(EYES);
          if (e && SAVE !== 'none') { const ex = e.eyes, cx = (ex[0].x + ex[1].x) / 2, cy = (ex[0].y + ex[1].y) / 2, r = Math.max(e.facePx * 1.3, 12);
            const k = Math.max(1, Math.min(8, Math.round(160 / (2 * r)))); writeFileSync(join(OUT, rk, `${name}-face.png`), await L.encodePNG(L.crop(fin, [cx - r, cy - r * 0.9, cx + r, cy + r * 1.1], k))); }
          if (e) { m.facePx = +e.facePx.toFixed(1); m.eyes = L.eyeMarks(fin, e.eyes, { face: e.facePx }); m.eyeBox = e.eyes.map((x) => ({ x: +x.x.toFixed(1), y: +x.y.toFixed(1), w: +x.w.toFixed(2), h: +x.h.toFixed(2) })); }
        }
        // the shimmer: the ink with the camera half a render pixel over
        await ev('(window.__nudge(0.5), true)'); await debugView(14);
        const ink2 = L.inkOf(await grab());
        await ev('(window.__nudge(-0.5), true)'); await debugView(0);
        m.shimmer = L.shimmer(ink, ink2, null);
        row.metrics = m;
        row.size = [W, H];
      } catch (err) { row.error = String(err).slice(0, 300); }
      report.rows.push(row);
      const M = row.metrics ?? {};
      console.log(`${rk.padEnd(13)} ${name.padEnd(14)} ${row.error ? `ERROR ${row.error}` : `frame ink ${(M.frameInk * 100).toFixed(1)}% w${M.frameWidth?.median}` +
        (M.object ? ` · object ${M.object.h}px ink ${((M.inkShare ?? 0) * 100).toFixed(1)}% dark ${((M.darkShare ?? 0) * 100).toFixed(1)}% w${M.width?.median ?? '-'}/${M.width?.p90 ?? '-'}` : '') +
        (M.eyes ? ` · face ${M.facePx}px eyes ${M.eyes.map((x) => x.density).join('/')}` : '') + ` · shimmer ${M.shimmer?.change}/${M.shimmer?.pops}`}`);
    }
  }
}
// grades, against the reference resolution's nearest portrait for the eyes
const refOf = (row) => report.rows.find((x) => x.res === 'desk1080' && x.scene === 'portrait-1') ?? null;
for (const row of report.rows) if (row.metrics) Object.assign(row, L.grade(row, row.metrics.eyes ? refOf(row) : null));
report.seconds = Math.round((Date.now() - t0) / 1000);
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
console.log(`report.json and pictures in ${OUT} (${report.seconds} s)`);
await finish();
process.exit(0);
