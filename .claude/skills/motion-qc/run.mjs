// The motion QC in the running game (.claude/skills/motion-qc/SKILL.md): the traveller driven by scripted hands (the
// stick, Shift) through every gait, a sprint reversed, a pivot and a turn, in two or three worlds, in a MUTED headless
// Chrome on the real GPU; recorded every frame right after the player moved (scripts/motion-qc/sample.mjs) and judged in
// node (scripts/motion-qc/lib.mjs): feet sliding, pops, jolts, blend boundaries, the pose's answer to the stick, pivots,
// and what the matcher costs a frame. The camera-qc skill's harness, for the traveller instead of the camera.
//
//   node .claude/skills/motion-qc/run.mjs <out-dir> [--worlds desert,bazaar] [--ways moves,mm] [--preset medium] [--cpu 4]
//   PORT (default 5363; never 5173), CDP (default 5364)
//
// ways: moves (the game's default: the loops with the captured starts, stops and turns), mm (motion matching, ?mm=1),
// loops (?moves=0). --cpu 4: Chrome's CPU throttled 4x (a handheld's main thread, roughly) for the cost columns.
// Writes <out>/motion-world.json, motion-world.md (the table), <scenario>.<way>.png (a contact sheet of the worst frames,
// pictures of the game captioned with what was wrong and by how much) and <scenario>.<way>.json (the samples). Exits 1
// if a run of the default way is red. No game code changed: it drives `window.input` as a player's hands would, and reads.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'motion-qc-world'));
const W = 1280, H = 720, PRESET = arg('preset', 'medium'), CPU = Number(arg('cpu', 1));
const PORT = Number(process.env.PORT ?? 5363), CDP = Number(process.env.CDP ?? 5364);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const L = await import(join(ROOT, 'scripts/motion-qc/lib.mjs'));
const { WORLDS } = await import(join(ROOT, 'scripts/motion-qc/scenarios.mjs'));
const worlds = arg('worlds')?.split(','), ways = arg('ways', 'moves,mm').split(',');
const plan = WORLDS.filter((s) => !worlds || worlds.includes(s.world) || worlds.includes(s.name));
if (!plan.length) throw new Error('no scenario matches');
const QUERY = { moves: '', mm: '&mm=1', loops: '&moves=0' };

// ---------------------------------------------------------------- the server and the browser (one each, closed at the end)
const profile = mkdtempSync(join(tmpdir(), 'motion-qc-chrome-'));
const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
// (its own dependency cache: in a worktree node_modules is the main checkout's, and its .vite the author's server's)
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), cacheDir: process.env.VITE_CACHE ?? join(profile, 'vite-cache'), logLevel: 'error', clearScreen: false,
  server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const BASE = `http://127.0.0.1:${PORT}/`;
const proc = spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', `--window-size=${W},${H}`, '--force-device-scale-factor=1',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
const done = async () => { try { proc.kill('SIGKILL'); } catch {} try { await server.close(); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} };
process.on('exit', () => { try { proc.kill('SIGKILL'); } catch {} });   // (never leave a Chrome behind on a shared machine)
process.on('uncaughtException', async (e) => { console.error(e); await done(); process.exit(1); });
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = (await (await fetch(`http://localhost:${CDP}/json`)).json()).filter?.((t) => t.webSocketDebuggerUrl); if (!tabs?.length) tabs = null; } catch { await sleep(250); } }
if (!tabs) throw new Error(`no Chrome on debugging port ${CDP} (set CDP to a free port)`);
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waits = new Map(), errors = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails?.exception?.description ?? '').slice(0, 200)); });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const d = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (d.result?.exceptionDetails) throw new Error(`page: ${d.result.exceptionDetails.exception?.description?.slice(0, 400)}`); return d.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

// ---------------------------------------------------------------- the recorder and the hands, put into the page
// (one function, stringified: it wraps rig.update, which runs right after the player moved and was posed, so every
// frame's traveller is read there and the script's hands for the next frame are set; renderer.render is wrapped to keep
// the last few frames' pictures, so a bad frame found two frames later can still be kept)
function install(S, LIB) {
  const { rig, player, input, renderer } = window;
  S.timeAnimator(player.animator);
  const st = window.__mq = { samples: [], shots: [], segs: [], seg: -1, segT: 0, done: true, rec: false, rs: {}, t: 0 };
  const RING = 6, ring = Array.from({ length: RING }, () => { const c = document.createElement('canvas'); c.width = 480; c.height = 270; return { c, i: -1 }; });
  let ri = 0;
  const update = rig.update.bind(rig);
  rig.update = function (pos, dt, frame) {
    const r = update(pos, dt, frame);
    if (st.done || !(dt > 0)) return r;
    // the record (this frame: the hands set last frame moved him)
    const s = st.segs[st.seg];
    if (st.rec && s) {
      st.samples.push(S.sample(player, st.rs, { t: st.t, dt, tag: s.tag ?? `seg ${st.seg}`, stick: s.stick ?? null, run: !!s.run }));
      st.t += dt;
      // a quick read of how bad the frame two back was (pops and jolts need the frames either side; node judges)
      const n = st.samples.length;
      if (n >= 5) {
        const w5 = st.samples.slice(n - 5), i = n - 3;
        const sev = Math.max(LIB.pops(w5, 0).reduce((a, p) => Math.max(a, p.size / LIB.LIMITS.popW), 0),
          LIB.jolts(w5, 0).events.reduce((a, p) => Math.max(a, p.size / LIB.LIMITS.jolt), 0),
          ...['l', 'r'].map((f) => { const a = st.samples[i - 1].feet[f], b = st.samples[i].feet[f]; return b.ball[1] - b.gBall < 0.05 ? Math.hypot(b.ball[0] - a.ball[0], b.ball[2] - a.ball[2]) / 0.03 : 0; }));
        const pic = ring.find((x) => x.i === i);
        const weakest = st.shots.length < 12 ? 0 : Math.min(...st.shots.map((x) => x.sev));
        if (pic && sev >= 1 && sev > weakest && !st.shots.some((x) => Math.abs(x.i - i) < 20 && x.sev >= sev)) {
          st.shots = st.shots.filter((x) => Math.abs(x.i - i) >= 20);
          st.shots.push({ i, sev, img: pic.c.toDataURL('image/jpeg', 0.75) });
          st.shots.sort((a, b) => b.sev - a.sev); st.shots.length = Math.min(st.shots.length, 12);
        }
      }
    }
    // the hands for the next frame
    st.segT += dt;
    if (!s || st.segT >= s.for) {
      st.seg++; st.segT = 0;
      const nx = st.segs[st.seg];
      if (!nx) { st.done = true; input.stick = null; input.ShiftLeft = false; return r; }
    }
    const c = st.segs[st.seg];
    input.ShiftLeft = !!c.run;
    // (changed in place: assigning it every frame would mark it "tapped", and main.js latches a tapped key to true)
    if (c.stick) { if (input.stick && typeof input.stick === 'object') { input.stick.x = c.stick[0]; input.stick.y = c.stick[1]; } else input.stick = { x: c.stick[0], y: c.stick[1] }; }
    else if (input.stick) input.stick = null;
    return r;
  };
  const render = renderer.render.bind(renderer);
  renderer.render = function (scene, cam) {
    const r = render(scene, cam);
    if (st.rec && !st.done && renderer.getRenderTarget() === null) {
      const x = ring[ri]; ri = (ri + 1) % RING;
      x.c.getContext('2d').drawImage(renderer.domElement, 0, 0, x.c.width, x.c.height); x.i = st.samples.length - 1;
    }
    return r;
  };
  st.start = (segs) => { Object.assign(st, { segs, seg: 0, segT: 0, samples: [], shots: [], done: false, rec: true, rs: {}, t: 0 }); const c = segs[0]; input.ShiftLeft = !!c.run; input.stick = c.stick ? { x: c.stick[0], y: c.stick[1] } : null; };
  return true;
}

/** The contact sheet: the worst frames' pictures (kept by the page) nearest node's worst frames, captioned, 3 across. */
async function sheet(name, picks) {
  return ev(`(async () => {
    const shots = ${JSON.stringify(picks)}; if (!shots.length) return null;
    const C = 3, w = 480, h = 270, cap = 34, rows = Math.ceil(shots.length / C);
    const cv = document.createElement('canvas'); cv.width = C * w; cv.height = rows * (h + cap) + 30; const c = cv.getContext('2d');
    c.fillStyle = '#f4ecdf'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#222'; c.font = 'bold 16px sans-serif'; c.fillText(${JSON.stringify(name)} + ': the worst frames', 8, 20);
    for (let i = 0; i < shots.length; i++) {
      const im = new Image(); im.src = shots[i].img; await im.decode();
      const x = (i % C) * w, y = 30 + Math.floor(i / C) * (h + cap);
      c.drawImage(im, x, y, w, h); c.fillStyle = '#222'; c.font = '12px sans-serif';
      c.fillText(shots[i].head, x + 6, y + h + 14); c.fillStyle = '#900'; c.fillText(shots[i].what, x + 6, y + h + 29);
    }
    return cv.toDataURL('image/png');
  })()`);
}

// ---------------------------------------------------------------- the scenarios, world by world, way by way
const results = {}, rows = [];
let first = true;
for (const sc of plan) for (const way of ways) {
  if (!first) await sleep(1500);   // (a rest between runs: the machine is shared)
  first = false;
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(250);
  await ev(`localStorage.clear(); localStorage.setItem('moebius.muted','1');
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${PRESET}', music: 0, effects: 0, voices: 0, volume: 0, enemies: 'off' }));
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'foes.seen': true, ...${JSON.stringify(sc.flags ?? {})} }, keepsakes: [] })); true`);
  await send('Page.navigate', { url: `${BASE}?level=${sc.world}${QUERY[way] ?? ''}` });
  let up = false;
  for (let i = 0; i < 1500 && !up; i++) { up = (await ev('!!window.__moebiusBooted && !!window.player && !!window.rig && !!window.player.humanoid').catch(() => false)) === true; if (!up) await sleep(100); }
  const key = `${sc.name} · ${way}`;
  if (!up) { console.log(`${key}: never booted`); results[key] = { error: 'never booted' }; continue; }
  await sleep(3000);
  // (the matcher's database loads after the game starts: wait for it under ?mm=1)
  if (way === 'mm') for (let i = 0; i < 100 && !(await ev('!!window.player.animator?.matching')); i++) await sleep(100);
  await ev(`(() => { window.sound?.setVolumes?.(0, 0); window.story?.closePage?.(); if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; } return true; })()`);
  await ev(`(async () => { const S = await import('/scripts/motion-qc/sample.mjs'); const LIB = await import('/scripts/motion-qc/lib.mjs'); return (${install.toString()})(S, LIB); })()`);
  await ev(`(async () => { const { THREE, player, rig } = window; ${sc.setup ?? ''}
    ${sc.at ? `player.teleport(new THREE.Vector3(...${JSON.stringify(sc.at)}), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));` : ''}
    ${sc.yaw != null ? `rig.yaw = ${sc.yaw};` : ''} rig.dist = ${sc.dist ?? 3.6}; rig._lastP = null; window.story?.closePage?.(); return true; })()`);
  await sleep(1500);
  if (CPU > 1) await send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await ev(`window.__mq.start(${JSON.stringify(sc.segs)}); true`);
  const total = sc.segs.reduce((s, x) => s + x.for, 0), t0 = Date.now();
  while (!(await ev('window.__mq.done')) && Date.now() - t0 < (total * CPU * 3 + 30) * 1000) await sleep(250);
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const { samples, shots, meta } = await ev(`(async () => { const s = window.__mq; s.rec = false; const S = await import('/scripts/motion-qc/sample.mjs'); return { samples: s.samples, shots: s.shots, meta: S.metaOf(window.player) }; })()`);
  const r = L.analyse(samples, meta);
  results[key] = { world: sc.world, way, about: sc.about, cpu: CPU, measures: r.measures, fails: r.fails, green: r.green, worst: r.worst, events: { ...r.events, steps: r.events.steps.slice().sort((a, b) => b.slide - a.slide).slice(0, 12) } };
  rows.push({ name: sc.name, way, r });
  writeFileSync(join(OUT, `${sc.name}.${way}.json`), JSON.stringify({ meta, samples }));
  // the sheet: for each of node's worst frames, the page's picture nearest it (within a third of a second)
  const picks = [];
  for (const w of r.worst) {
    const near = shots.filter((x) => Math.abs(x.i - w.i) <= 20).sort((a, b) => Math.abs(a.i - w.i) - Math.abs(b.i - w.i))[0];
    if (near && !picks.some((p) => p.img === near.img)) { const s = samples[w.i]; picks.push({ img: near.img, head: `t ${s.t.toFixed(2)} s · ${s.tag} · ${Math.hypot(s.vel[0], s.vel[2]).toFixed(1)} m/s${s.mm?.w > 0.5 ? ` · ${s.mm.clip}` : ''}${s.move ? ` · ${s.move}` : ''}`, what: w.what }); }
  }
  const png = await sheet(key, picks.slice(0, 6));
  if (png) writeFileSync(join(OUT, `${sc.name}.${way}.png`), Buffer.from(png.split(',')[1], 'base64'));
  const m = r.measures;
  console.log(`${key.padEnd(30)} ${r.green ? 'green' : 'RED  '} slide ${(m.slideP95 * 100).toFixed(1)}/${(m.slideMax * 100).toFixed(1)} cm held ${(m.held * 100).toFixed(1)} pops ${m.popsPerMin.toFixed(1)}/min jolts ${m.joltsPerMin.toFixed(1)}/min boundary ${(m.boundaryMax * 100).toFixed(1)} cm anim ${m.animUs.toFixed(0)} µs match ${m.matchUs.toFixed(0)} µs${r.fails.length ? `  [${r.fails.join(' ')}]` : ''}`);
}
writeFileSync(join(OUT, 'motion-world.json'), JSON.stringify({ when: new Date().toISOString(), preset: PRESET, cpu: CPU, limits: L.LIMITS, results, errors: errors.slice(0, 20) }, null, 1));
writeFileSync(join(OUT, 'motion-world.md'), `${L.table(rows)}\n`);
console.log(`\n${L.table(rows)}\n\nwritten to ${OUT}`);
await done();
process.exit(Object.values(results).some((r) => r.error || (r.way === 'moves' && !r.green)) ? 1 : 0);
