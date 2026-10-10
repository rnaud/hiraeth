// What a change to the ink pass costs (.claude/skills/ink-lines/SKILL.md, section 5): synced frame times of the
// scenes capture.mjs uses, each renderFrame() closed by a readPixels (the GPU's work counted, not queued), the median of
// `--rounds` rounds of `--frames` frames, the game's clock held. Run it for the build before and after (the same
// machine, in turns; it shares the GPU with whatever else runs: compare medians of several runs, never one number).
//
//   PORT=5617 node .claude/skills/ink-lines/cost.mjs [--res desk1080x2,handheld] [--scenes veg-far,town-far] [--rounds 9] [--frames 16] [--out file.json]
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(process.env.PORT ?? 5617), CDP = PORT + 1;
if (PORT === 5173 || CDP === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RES = {
  desk1080x2: { w: 1920, h: 1080, dpr: 2, quality: 'high' },
  desk1080: { w: 1920, h: 1080, dpr: 1, quality: 'medium' },
  handheld: { w: 1280, h: 720, dpr: 1, quality: 'handheld', scale: 0.75 },
};
const VIEWS = {   // (capture.mjs's: the start of the ride to Qanat; Edena's meadow from its start, looking out)
  'town-far': { world: 'desert', eye: [130.593, 12.427, 143.143], target: [166.8, 11.4, 319.5], player: [132, 9.227, 150] },
  'veg-far': { world: 'edena', eye: [300, 1731, -309], target: [300, 1729, -285], player: [300, 1727.2, -309] },
};
const resKeys = arg('res', 'desk1080x2,handheld').split(','), scenes = arg('scenes', 'town-far,veg-far').split(',');
const ROUNDS = +arg('rounds', 9), FRAMES = +arg('frames', 16);

// one headless Chrome at a time on the machine (capture.mjs's rule: an orphan over 5 minutes old isn't waited for)
const others = () => { try { return execFileSync('ps', ['-axo', 'pid,ppid,etime,command'], { encoding: 'utf8' }).split('\n').filter((l) => l.includes('--headless') && !l.includes('Helper') && !l.includes('--type=')
  && !l.includes(`--remote-debugging-port=${CDP}`) && !(l.trim().split(/\s+/)[1] === '1' && /-|\d+:\d+:\d+|^([5-9]|\d\d+):/.test(l.trim().split(/\s+/)[2]))).length; } catch { return 0; } };
while (others() > 0) await sleep(5000);
const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', clearScreen: false, server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const profile = mkdtempSync(join(tmpdir(), 'inklines-cost-'));
const proc = spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
  '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', '--enable-webgl-draft-extensions', '--enable-privileged-webgl-extensions', 'about:blank'], { stdio: 'ignore' });
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waits = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const d = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (d.result?.exceptionDetails) throw new Error(d.result.exceptionDetails.exception?.description?.slice(0, 300)); return d.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable');
const out = { commit: execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(), rows: [] };
for (const world of [...new Set(scenes.map((s) => VIEWS[s].world))]) {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/manifest.webmanifest` }); await sleep(300);
  await ev(`localStorage.clear(); localStorage.setItem('moebius.muted','1'); localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: 'medium', music: 0, effects: 0, voices: 0, volume: 0, enemies: 'off' }));
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] })); true`);
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?level=${world}` });
  for (let i = 0; i < 1500; i++) { if (await ev('!!window.__moebiusBooted && !!window.renderFrame').catch(() => false)) break; await sleep(100); }
  await sleep(3000);
  for (const rk of resKeys) {
    const r = RES[rk];
    await send('Emulation.setDeviceMetricsOverride', { width: r.w, height: r.h, deviceScaleFactor: r.dpr, mobile: false });
    await ev(`(() => { window.settings.quality = '${r.quality}'; window.applyQuality?.(); window.preset().dynamic = null; ${r.scale ? `window.quality.renderScale = ${r.scale};` : ''} window.resize(); window.sky.speed = 0; window.sky.hour = 10.5; window.updateSky?.(); return true; })()`);
    for (const s of scenes.filter((x) => VIEWS[x].world === world)) {
      const V = VIEWS[s];
      await ev(`(() => { const { THREE, camera, player } = window; player.pos.set(...${JSON.stringify(V.player)}); const e = new THREE.Vector3(...${JSON.stringify(V.eye)});
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(e, new THREE.Vector3(...${JSON.stringify(V.target)}), new THREE.Vector3(0, 1, 0)));
        const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld; camera.updateMatrixWorld = function (f) { this.position.copy(e); this.quaternion.copy(q); return base.call(this, f); }; return true; })()`);
      await sleep(2500);
      const times = await ev(`(async () => {
        const gl = window.renderer.getContext(), px = new Uint8Array(4), med = [];
        const pause = window.__inkPause ??= (() => { const raf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; return () => { window.requestAnimationFrame = raf; }; })();
        for (let r = 0; r < ${ROUNDS}; r++) { const t = [];
          for (let i = 0; i < ${FRAMES}; i++) { const t0 = performance.now(); window.renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); t.push(performance.now() - t0); }
          t.sort((a, b) => a - b); med.push(t[t.length >> 1]); await new Promise((res) => setTimeout(res, 30)); }
        return med; })()`);
      // the composite (the ink pass) alone, by timer query: each renderer.render() of the post material's scene timed on the GPU
      const pass = await ev(`(async () => {
        const R = window.renderer, gl = R.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        if (!ext) return null;
        const isPost = (sc) => sc === window.post.scene;
        const base = R.render.bind(R), qs = [];
        R.render = (sc, cam) => { if (!isPost(sc)) return base(sc, cam); const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); base(sc, cam); gl.endQuery(ext.TIME_ELAPSED_EXT); qs.push(q); };
        const px = new Uint8Array(4);
        for (let i = 0; i < ${ROUNDS * FRAMES}; i++) { window.renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (i % ${FRAMES} === 0) await new Promise((r) => setTimeout(r, 20)); }
        R.render = base;
        await new Promise((r) => setTimeout(r, 200));
        const t = [];
        for (const q of qs) { for (let k = 0; k < 50 && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); k++) await new Promise((r) => setTimeout(r, 10));
          if (!gl.getParameter(ext.GPU_DISJOINT_EXT) && gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) t.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); }
        t.sort((a, b) => a - b); return t.length ? { median: t[t.length >> 1], n: t.length, p25: t[t.length >> 2], p75: t[(t.length * 3) >> 2] } : null; })()`);
      times.sort((a, b) => a - b);
      const row = { scene: s, res: rk, median: +times[times.length >> 1].toFixed(2), rounds: times.map((t) => +t.toFixed(2)), pass: pass && { median: +pass.median.toFixed(3), p25: +pass.p25.toFixed(3), p75: +pass.p75.toFixed(3), n: pass.n } };
      out.rows.push(row); console.log(`${rk.padEnd(11)} ${s.padEnd(9)} frame ${row.median} ms · ink pass ${row.pass ? `${row.pass.median} ms (${row.pass.p25}-${row.pass.p75}, ${row.pass.n})` : 'no timer query'}`);
    }
  }
}
if (arg('out')) writeFileSync(arg('out'), JSON.stringify(out, null, 1));
ws.close(); proc.kill('SIGTERM'); await sleep(1200); rmSync(profile, { recursive: true, force: true }); await server.close();
process.exit(0);
