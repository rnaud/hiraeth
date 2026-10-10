// Ink shimmer on a walking foe (docs/systems/procedural-animation.md, "Phase 7, LOD and style"): the motion check's
// flicker (docs/systems/rendering.md, "Stable in motion": a pixel that jumped over 20 levels and came straight back, per
// 10 000 px) counted in a box round one foe walking past a still camera, the game's clock stepped by hand (every frame the
// same from run to run), with the kit's stepped clock off and on (src/motion-kit/rig.js LOD.stepped).
//
//   node scripts/motion-audit/shimmer.mjs [--kinds tripod,bell,brute] [--frames 150] [--preset high] [--port 5493]
//
// One Vite (PORT) and one headless Chrome, muted (CDP: PORT + 1), both closed at the end.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ROOT = resolve(arg('root', fileURLToPath(new URL('../../', import.meta.url))));
const PORT = Number(arg('port', 5493)), CDP = PORT + 1, FRAMES = Number(arg('frames', 150)), PRESET = arg('preset', 'high');
const KINDS = arg('kinds', 'tripod,bell,brute').split(',');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), cacheDir: join(tmpdir(), 'hiraeth-shimmer'), logLevel: 'error', clearScreen: false,
  server: { port: PORT, strictPort: true, host: '127.0.0.1', fs: { strict: false }, hmr: false, watch: null } });
await server.listen();
const profile = mkdtempSync(join(tmpdir(), 'hiraeth-shimmer-chrome-'));
const proc = spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
  '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check', '--disable-gpu-shader-disk-cache', '--disk-cache-size=1',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--force-device-scale-factor=1', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });

// one foe walking past: the clock taken over, each frame stepped and read back, the flicker counted in a box round it
const RUN = (kind, stepped) => `(async () => {
  const { THREE, camera, player, foes, renderer } = window; const V = THREE.Vector3;
  const R = await import('/src/motion-kit/rig.js'); R.LOD.stepped = ${stepped};
  for (const f of [...foes.list]) foes.remove?.(f);
  player.hurt = () => {}; player.knockDown = () => {};
  const start = new V(-8, 0, -10);
  player.teleport(new V(40, 0, -10), new V(0, 1, 0), new V(-1, 0, 0));
  const f = foes.add('${kind}', start.clone());
  // (walked by hand along a straight line at its own pace: out of the foes' list, so its mind never moves it; drawn by Foes.look)
  foes.list.splice(foes.list.indexOf(f), 1);
  const speed = f.def.speed ?? 2;
  const walk = () => { f.pos.x += speed / 60; f.heading = Math.PI / 2; f.state = 'chase'; f.dist = 2; foes.look(f, 1 / 60); };
  // the camera still, side-on to its path, 7 m off
  const eye = new V(-2, 2.6, -17), at = new V(-2, 1.2, -10), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, at, new V(0, 1, 0)));
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); if (this.fov !== 55) { this.fov = 55; this.updateProjectionMatrix(); } return base.call(this, force); };
  // the clock by hand
  const V0 = window.__vt ??= (() => {
    const realNow = performance.now.bind(performance), raf = window.requestAnimationFrame.bind(window);
    const T = { manual: false, t: 0, q: [] };
    performance.now = () => (T.manual ? T.t : realNow());
    window.requestAnimationFrame = (cb) => { if (T.manual) { T.q.push(cb); return 1; } return raf((ts) => (T.manual ? T.q.push(cb) : cb(ts))); };
    T.start = () => { T.t = realNow(); T.manual = true; };
    T.step = (dt) => { T.t += dt * 1000; const q = T.q; T.q = []; for (const cb of q) cb(T.t); };
    return T;
  })();
  if (!V0.manual) { V0.start(); await new Promise((r) => setTimeout(r, 100)); }
  for (let i = 0; i < 90; i++) { walk(); V0.step(1 / 60); }   // (into its walk)
  const W = renderer.domElement.width, H = renderer.domElement.height, B = 300;
  const cv = document.createElement('canvas'); cv.width = B; cv.height = B; const c = cv.getContext('2d', { willReadFrequently: true });
  const p = new V();
  let a = null, b = null, flick = 0, px = 0, moved = 0;
  for (let i = 0; i < ${FRAMES}; i++) {
    walk(); V0.step(1 / 60);
    p.copy(f.pos).setY(f.pos.y + 1.2).project(camera);
    const x = Math.round((p.x * 0.5 + 0.5) * W - B / 2), y = Math.round((0.5 - p.y * 0.5) * H - B / 2);
    // (the box follows it in steps of a whole box, so the pixels compared are the same ones on the screen)
    const bx = Math.max(0, Math.min(W - B, Math.round(x / 40) * 40)), by = Math.max(0, Math.min(H - B, Math.round(y / 40) * 40));
    c.drawImage(renderer.domElement, bx, by, B, B, 0, 0, B, B);
    const d = c.getImageData(0, 0, B, B).data, L = new Float32Array(B * B);
    for (let k = 0; k < B * B; k++) L[k] = 0.299 * d[k * 4] + 0.587 * d[k * 4 + 1] + 0.114 * d[k * 4 + 2];
    const cur = { L, bx, by };
    if (a && b && a.bx === b.bx && a.by === b.by && b.bx === bx && b.by === by) {
      for (let k = 0; k < B * B; k++) {
        const d1 = b.L[k] - a.L[k], d2 = L[k] - b.L[k];
        if (Math.abs(d1) > 20) moved++;
        if (Math.abs(d1) > 20 && Math.abs(d2) > 20 && Math.sign(d1) !== Math.sign(d2)) flick++;
      }
      px += B * B;
    }
    a = b; b = cur;
  }
  foes.list.push(f); foes.remove?.(f);
  return { flicker: (flick / px) * 1e4, changed: (moved / px) * 1e4, px };
})()`;

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
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  for (const kind of KINDS) for (const stepped of [false, true]) {
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/manifest.webmanifest` }); await sleep(300);
    await ev(`localStorage.clear(); localStorage.setItem('moebius.muted', '1'); localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] })); localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${PRESET}', showFps: false, music: 0, effects: 0, voices: 0 })); true`);
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?level=arena&enemy=${kind}` });
    let up = false;
    for (let t = 0; t < 600 && !up; t++) { try { up = await ev('!!window.__moebiusBooted && !!window.player && !!window.renderer'); } catch { /* loading */ } if (!up) await sleep(250); }
    if (!up) throw new Error('the game never came up');
    await sleep(2500);
    await ev(`(() => { window.sound?.setVolumes?.(0, 0); const p = window.preset?.(); if (p) p.dynamic = null; if (window.sky) { window.sky.hour = 10; window.sky.speed = 0; window.updateSky?.(); } if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; }
      window.foes.setPractice?.(''); const hide = document.createElement('style'); hide.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(hide); return true; })()`);
    await sleep(800);
    const r = await ev(RUN(kind, stepped));
    console.log(`${kind.padEnd(8)} stepped ${stepped ? 'on ' : 'off'}: flicker ${r.flicker.toFixed(2)} / 10 000 px, changed ${r.changed.toFixed(1)} / 10 000 px a frame (${r.px} px read)`);
  }
} finally {
  try { ws?.close(); } catch { /* gone */ }
  const gone = new Promise((r) => proc.once('exit', r));
  proc.kill('SIGTERM');
  await Promise.race([gone, sleep(5000)]);
  rmSync(profile, { recursive: true, force: true });
  await server.close();
}
