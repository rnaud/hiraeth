// What a pack of the roster's foes costs to draw (docs/systems/foes.md, "Procedural surfaces"; the enemy-rework skill):
// the Arena with a pack spawned in front of the traveller and the camera held on them, in headless Chrome on the GPU
// (muted), its frames timed by the benchmark's instrument (scripts/bench/browser.mjs INSTRUMENT: the CPU time of each
// frame's callbacks, the GPU time where EXT_disjoint_timer_query_webgl2 allows, renderer.info's draw calls).
//
//   node scripts/enemy-roster/bench.mjs [--commit <sha>] [--quality high|deck|low] [--size 1280x720] [--seconds 8]
//     [--pack crab@arzach2,crab@saltharbour,lizard@incal,…] [--shot file.png] [--level arzach2: in a world, for its look]
// --commit measures that commit (extracted with git archive into $TMPDIR, this checkout's node_modules linked in,
// deleted after); without it, this checkout. One Vite (PORT, default 5480; never 5173), one Chrome (CDP: PORT + 1).
// Headless timings are for comparing a before with an after on one machine, not absolute numbers.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTRUMENT } from '../bench/browser.mjs';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(process.env.PORT ?? 5480);
process.env.CDP ??= String(PORT + 1);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server');
process.env.PORT = String(PORT);
const { serve, chrome } = await import('../changelog-shots.mjs');
const [W, H] = arg('size', '1280x720').split('x').map(Number);
const QUALITY = arg('quality', 'high'), SECONDS = Number(arg('seconds', 8));
const PACK = arg('pack', 'crab@arzach2,crab@saltharbour,lizard@incal,lizard@bazaar,hound@spheres,tripod@incal,blot@desert,blot@garage,centipede@buried,jelly@arzach2,moth@perdide2,ray@arzach').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let dir = ROOT, work = null;
if (arg('commit')) {
  work = mkdtempSync(join(tmpdir(), 'hiraeth-bench-'));
  dir = join(work, 'tree');
  execFileSync('sh', ['-c', `mkdir -p "${dir}" && git archive ${arg('commit')} | tar -x -C "${dir}"`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], maxBuffer: 1 << 30 });
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
}
const server = await serve(dir);
const c = await chrome();
try {
  await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT });
  const base = `http://127.0.0.1:${PORT}/`;
  await c.send('Page.navigate', { url: `${base}manifest.webmanifest` }); await sleep(300);
  await c.ev(`localStorage.clear(); localStorage.setItem('moebius.muted', '1');
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${QUALITY}', showFps: false, music: 0, effects: 0, voices: 0 })); true`);
  await c.send('Page.navigate', { url: `${base}?level=${arg('level', 'arena')}` });
  for (let i = 0; i < 400; i++) { try { if (await c.ev('!!window.__moebiusBooted && !!window.foes && !!window.player')) break; } catch { /* loading */ } await sleep(250); }
  await sleep(3000);
  const info = await c.ev(`(() => {
    const { THREE, camera, player, foes } = window;
    window.sound?.setVolumes?.(0, 0);
    const p = window.preset?.(); if (p) p.dynamic = null;
    if (window.sky) { window.sky.hour = 10; window.sky.speed = 0; window.updateSky?.(); }
    const hide = document.createElement('style'); hide.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(hide);
    const P = player.pos.clone(), f = new THREE.Vector3(Math.sin(player.heading ?? 0), 0, Math.cos(player.heading ?? 0));
    const r = new THREE.Vector3(f.z, 0, -f.x), pack = ${JSON.stringify(PACK)};
    // (the Arena's own foes gone and its waves stopped: only the pack, standing where it is put, posed once a frame)
    const update = foes.update.bind(foes);
    foes.update = () => { for (const x of foes.list) foes.look(x, 1 / 60); };
    for (const x of [...foes.list]) foes.remove(x);
    const made = pack.map((id, i) => { const at = P.clone().addScaledVector(f, 7 + (i % 3) * 2.2).addScaledVector(r, ((i / 3) | 0) * 2.4 - 3.6); try { const x = foes.add(id, at); if (x) { x.heading = Math.atan2(-f.x, -f.z); x.provoked = true; foes.look(x, 0); } return x ? id : null; } catch (e) { return 'x:' + id + ' ' + e.message; } });
    const eye = P.clone().addScaledVector(f, -3).add(new THREE.Vector3(0, 3.2, 0)), at = P.clone().addScaledVector(f, 9).add(new THREE.Vector3(0, 0.8, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, at, new THREE.Vector3(0, 1, 0)));
    const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
    camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); return base.call(this, force); };
    return { made, preset: p?.key ?? null };
  })()`);
  await sleep(3000);
  await c.ev('(window.__bench.reset(), window.__bench.rec = true, true)');
  await sleep(SECONDS * 1000);
  const r = await c.ev(`(() => { const B = window.__bench; B.rec = false; const med = (a) => { const s = a.filter(Number.isFinite).slice().sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(2) : null; };
    return { frames: B.frames.length, frame: med(B.frames), cpu: med(B.cpu), gpu: med(B.gpu), gpuFrames: B.gpu.length, calls: med(B.calls), tris: med(B.tris), timer: !!B.ext }; })()`);
  if (arg('shot')) { const { writeFileSync } = await import('node:fs'); const shot = await c.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(arg('shot'), Buffer.from(shot.data, 'base64')); }
  console.log(JSON.stringify({ commit: arg('commit') ?? 'worktree', quality: QUALITY, size: `${W}x${H}`, ...info, ...r, errors: c.errors.slice(0, 3) }));
} finally {
  await c.close();
  await server.close();
  if (work) rmSync(work, { recursive: true, force: true });
}
