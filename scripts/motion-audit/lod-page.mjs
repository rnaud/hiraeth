// The locomotion kit's savings measured in the running game (docs/systems/procedural-animation.md, "Phase 7, LOD and
// style"): the Arena with a guardian (the Cistern-Keeper, called into its ring and circling) and a pack of the roster
// on screen in front of it, more of them far off all round; the kit's savings (src/motion-kit/rig.js LOD: the view, the
// far tier's turns, the stepped clock) switched off and on in turns in the same page, the same scene.
//
//   node scripts/motion-audit/lod-page.mjs [--presets high,deck] [--slow 1,4] [--turns 3] [--secs 6] [--port 5491] [--shot <path>]
//
// Per preset (and CPU slow-down: Chrome's throttling, ×4 for a handheld as docs/systems/performance.md does), each turn
// reads for `secs`: the kit's own time a frame (every Rig.update and Rig.write, and the guardian's whole animate) and the
// JS a frame (every animation-frame callback: the game's frame). One Vite (PORT) and one headless Chrome, muted (CDP:
// PORT + 1), both closed at the end.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ROOT = resolve(arg('root', fileURLToPath(new URL('../../', import.meta.url))));
const PORT = Number(arg('port', 5491)), CDP = PORT + 1, TURNS = Number(arg('turns', 3)), SECS = Number(arg('secs', 6));
const PRESETS = arg('presets', 'high,deck').split(','), SLOW = arg('slow', '1,4').split(',').map(Number);
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), cacheDir: join(tmpdir(), 'hiraeth-lod-page'), logLevel: 'error', clearScreen: false,
  server: { port: PORT, strictPort: true, host: '127.0.0.1', fs: { strict: false }, hmr: false, watch: null } });
await server.listen();
const profile = mkdtempSync(join(tmpdir(), 'hiraeth-lod-chrome-'));
const proc = spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
  '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check', '--disable-gpu-shader-disk-cache', '--disk-cache-size=1',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--force-device-scale-factor=1', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });

// in the page: the scene, and the meters round the kit and the frame
const SETUP = `(async () => {
  const { THREE, camera, player, physics, scene, foes } = window; const V = THREE.Vector3;
  window.sound?.setVolumes?.(0, 0);
  player.hurt = () => {}; player.knockDown = () => {};   // (nothing ends the run)
  foes.setPractice?.('');
  await new Promise((r) => setTimeout(r, 300));
  const { ArenaGuardians } = await import('/src/arena-guardians.js');
  const R = await import('/src/motion-kit/rig.js');
  const A = new ArenaGuardians({ scene, player, physics, sound: null, notice() {} });
  const g = A.call('desert'), m = g.model;
  g.state = 'fight'; g.t = 0; g.cool = 1e9; g.begin = () => {};   // (it circles in its ring and never strikes)
  const C = m.pos.clone(), f = C.clone().sub(player.pos).setY(0).normalize(), r = new V(f.z, 0, -f.x);
  // the pack: eight of the roster between you and it; twenty more far off all round (70-110 m)
  const KINDS = ['crab', 'hound', 'lizard', 'tripod', 'skitter', 'brute', 'bell', 'shade'];
  KINDS.forEach((k, i) => foes.add(k, player.pos.clone().addScaledVector(f, 7 + (i % 4) * 2).addScaledVector(r, (i - 3.5) * 2.2)));
  for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; foes.add(KINDS[i % KINDS.length], player.pos.clone().add(new V(Math.sin(a), 0, Math.cos(a)).multiplyScalar(70 + (i % 5) * 10))); }
  // the camera behind you, the pack and the guardian in front
  const eye = player.pos.clone().addScaledVector(f, -9).add(new V(0, 7, 0)), at = C.clone().addScaledVector(f, -4).add(new V(0, 1.5, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, at, new V(0, 1, 0)));
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); if (this.fov !== 55) { this.fov = 55; this.updateProjectionMatrix(); } return base.call(this, force); };
  // the meters
  const M = window.__lod = { kit: 0, js: 0, frames: 0, guard: 0, LOD: R.LOD };
  const P = R.Rig.prototype, u = P.update, w = P.write;
  P.update = function (...a) { const t = performance.now(); const o = u.apply(this, a); M.kit += performance.now() - t; return o; };
  P.write = function () { const t = performance.now(); w.call(this); M.kit += performance.now() - t; };
  const an = m.animate.bind(m);
  m.animate = (...a) => { const t = performance.now(); an(...a); M.guard += performance.now() - t; };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((ts) => { const t = performance.now(); cb(ts); M.js += performance.now() - t; });
  const tick = () => { A.update(1 / 60, performance.now() / 1000); raf(tick); }; tick();
  raf(function count() { M.frames++; raf(count); });
  return true;
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
  for (const preset of PRESETS) for (const slow of SLOW) {
    await send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/manifest.webmanifest` }); await sleep(300);
    await ev(`localStorage.clear(); localStorage.setItem('moebius.muted', '1'); localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] })); localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${preset}', showFps: false, music: 0, effects: 0, voices: 0 })); true`);
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?level=arena` });
    let up = false;
    for (let t = 0; t < 600 && !up; t++) { try { up = await ev('!!window.__moebiusBooted && !!window.player && !!window.renderer'); } catch { /* loading */ } if (!up) await sleep(250); }
    if (!up) throw new Error('the game never came up');
    await sleep(2500);
    await ev(SETUP);
    await sleep(3000);
    if (arg('shot')) writeFileSync(`${arg('shot')}-${preset}.png`, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));   // (--shot <path>: what it measured)
    if (slow > 1) await send('Emulation.setCPUThrottlingRate', { rate: slow });
    const rows = { on: [], off: [] };
    for (let k = 0; k < TURNS * 2; k++) {
      const on = k % 2 === 1;
      await ev(`(() => { const L = window.__lod.LOD; L.view = L.far = L.stepped = ${on}; return true; })()`);
      await sleep(1500);   // (the tiers settle: a change is held 30 frames)
      await ev(`(() => { const M = window.__lod; M.kit = M.js = M.guard = 0; M.frames = 0; return true; })()`);
      await sleep(SECS * 1000);
      const r = await ev(`(() => { const M = window.__lod; return { kit: M.kit / M.frames, js: M.js / M.frames, guard: M.guard / M.frames, fps: M.frames / ${SECS} }; })()`);
      rows[on ? 'on' : 'off'].push(r);
    }
    const med = (a, k) => { const s = a.map((x) => x[k]).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const f = (x) => x.toFixed(2);
    console.log(`${preset}${slow > 1 ? ` CPU ×${slow}` : ''}: kit ms/frame ${f(med(rows.off, 'kit'))} → ${f(med(rows.on, 'kit'))} (guardian ${f(med(rows.off, 'guard'))} → ${f(med(rows.on, 'guard'))}); JS ms/frame ${f(med(rows.off, 'js'))} → ${f(med(rows.on, 'js'))}; fps ${f(med(rows.off, 'fps'))} → ${f(med(rows.on, 'fps'))}`);
    console.log(`  turns off: ${rows.off.map((r) => f(r.kit) + '/' + f(r.js)).join('  ')}   on: ${rows.on.map((r) => f(r.kit) + '/' + f(r.js)).join('  ')}`);
  }
} finally {
  try { ws?.close(); } catch { /* gone */ }
  const gone = new Promise((r) => proc.once('exit', r));
  proc.kill('SIGTERM');
  await Promise.race([gone, sleep(5000)]);
  rmSync(profile, { recursive: true, force: true });
  await server.close();
}
