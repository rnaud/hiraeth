// The camera QC (.claude/skills/camera-qc/SKILL.md): scripted walks, runs, turns, jumps, lock-on and tight spaces in
// several worlds, driven in a MUTED headless Chrome on the real GPU, the camera recorded every frame (right after
// CameraRig.update) and judged by scripts/camera-qc/lib.mjs: collision pops, jumps off its smooth path, look-point
// jumps, turns nobody asked for, the lens in a wall, the traveller hidden or out of the frame, the arm's jitter.
//
//   node .claude/skills/camera-qc/run.mjs <out-dir> [--only train-walk,desert-open] [--worlds overnighttrain] [--preset medium]
//   PORT (default 5361; never 5173), CDP (default 5362)
//
// Writes <out-dir>/camera.json (every scenario's measures and events), camera.md (the table), <scenario>.png (a contact
// sheet of its worst frames, each captioned with what happened and how much) and <scenario>.json (the raw samples).
// Exits 1 if a scenario is red. No game code changed: it drives `window.input` (the stick, Shift, Space, Tab) and
// `rig.look` as a player's hands would, and reads.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'camera-qc'));
const W = 1280, H = 720, PRESET = arg('preset', 'medium');
const PORT = Number(process.env.PORT ?? 5361), CDP = Number(process.env.CDP ?? 5362);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const L = await import(join(ROOT, 'scripts/camera-qc/lib.mjs'));
const { SCENARIOS } = await import(join(ROOT, 'scripts/camera-qc/scenarios.mjs'));
const only = arg('only')?.split(','), worldsOnly = arg('worlds')?.split(',');
const plan = SCENARIOS.filter((s) => (!only || only.includes(s.name)) && (!worldsOnly || worldsOnly.includes(s.world)));
if (!plan.length) throw new Error('no scenario matches');

// ---------------------------------------------------------------- the server and the browser (one each, closed at the end)
const profile = mkdtempSync(join(tmpdir(), 'camera-qc-chrome-'));
const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
// (its own dependency cache: in a worktree node_modules is the main checkout's, and its .vite the author's server's)
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), cacheDir: join(profile, 'vite-cache'), logLevel: 'error', clearScreen: false,
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
// (one function, stringified: it wraps rig.update, so every frame's camera is read right after the rig placed it, and
// the script's hands for the next frame are set there too; renderer.render is wrapped to keep a picture of a bad frame)
function install(L) {
  const { THREE, rig, camera, player, physics, input, renderer } = window;
  const V = (a) => new THREE.Vector3(...a), up = new THREE.Vector3(0, 1, 0);
  const st = window.__cq = { samples: [], shots: [], segs: [], seg: -1, segT: 0, done: true, wp: 0, stuck: 0, stuckP: null, lastT: 0, log: [] };
  const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _d = new THREE.Vector3(), _h = new THREE.Vector3(), _n = new THREE.Vector3();
  const dirs = [];
  const clearance = () => {
    const c = camera.position; camera.getWorldDirection(_f); _r.crossVectors(_f, camera.up).normalize(); _h.crossVectors(_r, _f).normalize();
    let m = 1;
    for (const [v, s] of [[_r, 1], [_r, -1], [_h, 1], [_h, -1], [_f, -1]]) m = Math.min(m, physics.rayDistance(c, _d.copy(v).multiplyScalar(s), 1));
    m = Math.min(m, physics.rayDistance(c, _f, 0.3) < 0.3 ? physics.rayDistance(c, _f, 0.3) : 1);
    return m;
  };
  const ndc = (p) => { _n.copy(p).project(camera); return _n.z > 1 ? null : [+_n.x.toFixed(3), +_n.y.toFixed(3)]; };
  let pending = 0, prev = null, prev2 = null;
  const update = rig.update.bind(rig);
  rig.update = function (pos, dt, frame) {
    // the hands: this frame's segment of the script
    let cmdYaw = 0, cmdPitch = 0;
    if (!st.done && dt > 0) {
      let s = st.segs[st.seg];
      st.segT += dt;
      if (!s || st.segT >= s.for || (s.path && st.wp >= s.path.length)) {
        st.seg++; st.segT = 0; st.wp = 0; st.stuck = 0; st.stuckP = null;
        for (const k of ['ShiftLeft', 'Space', 'Tab']) input[k] = false;
        input.stick = null;
        s = st.segs[st.seg];
        if (!s) { st.done = true; }
        else if (s.lock) { input.Tab = true; s._tab = 0.1; }
        if (s && typeof s.path === 'string') s.path = window.__cqPaths?.[s.path] ?? [];   // (a path the scenario's setup worked out in the page)
      }
      if (s) {
        if (s._tab != null && (s._tab -= dt) <= 0) { input.Tab = false; s._tab = null; }
        input.ShiftLeft = !!s.run;
        let want = null;
        if (s.path && st.wp < s.path.length) {
          const w = s.path[st.wp];
          _d.set(w[0] - player.pos.x, 0, w[w.length - 1] - player.pos.z);
          if (_d.length() < (s.near ?? 0.6)) { st.wp++; st.stuck = 0; }
          else want = _d.normalize().clone();
          // stuck: no way on toward this point for 2 s, the next one
          if (!st.stuckP || st.stuckP.distanceTo(player.pos) > 0.3) { st.stuckP = player.pos.clone(); st.stuck = 0; }
          else if ((st.stuck += dt) > 2) { st.log.push(`${s.name ?? 'seg ' + st.seg}: stuck before ${w.map((x) => x.toFixed(1)).join(', ')}`); st.wp++; st.stuck = 0; st.stuckP = null; }
        } else if (s.stick) {
          const [x, y] = s.stick; camera.getWorldDirection(_f); _f.y = 0; _f.normalize(); _r.set(-_f.z, 0, _f.x);
          want = _f.clone().multiplyScalar(y).addScaledVector(_r, x); if (want.lengthSq() < 1e-6) want = null; else want.normalize().multiplyScalar(Math.min(1, Math.hypot(x, y)));
        }
        if (s.wander) {
          // a walk that turns away from what it meets: forward, and a turn of the way it walks when stopped
          st.wa ??= s.heading ?? 0;
          if (!st.stuckP || st.stuckP.distanceTo(player.pos) > 0.25) { st.stuckP = player.pos.clone(); st.stuck = 0; }
          else if ((st.stuck += dt) > 0.4) { st.wa += 1.9 + Math.random() * 0.8; st.stuck = 0; }
          want = new THREE.Vector3(Math.sin(st.wa), 0, Math.cos(st.wa));
        }
        if (want) {
          camera.getWorldDirection(_f); _f.y = 0; _f.normalize(); _r.set(-_f.z, 0, _f.x);
          // (changed in place: assigning it every frame would mark it "tapped", and main.js latches a tapped key to true)
          if (input.stick && typeof input.stick === 'object') { input.stick.x = want.dot(_r); input.stick.y = want.dot(_f); }
          else input.stick = { x: want.dot(_r), y: want.dot(_f) };
          // a player turns the camera after where they walk (steer: deg/s at most)
          if (s.steer) {
            const err = Math.atan2(want.x * _f.z - want.z * _f.x, want.dot(_f));
            const goal = Math.min(Math.abs(err) * 2.5, (s.steer * Math.PI) / 180) * Math.sign(err);
            st.rate = (st.rate ?? 0) + (goal - (st.rate ?? 0)) * (1 - Math.exp(-8 * dt));   // (a thumb on the stick: it doesn't jump to full turn)
            const y0 = rig.yaw; rig.look(-(st.rate * dt) / (0.0025 * rig.sensitivity), 0); cmdYaw += rig.yaw - y0;
          }
        } else if (input.stick) input.stick = null;
        if (s.turn || s.pitch) {
          const y0 = rig.yaw, p0 = rig.pitch;
          rig.look(-((s.turn ?? 0) * Math.PI / 180 * dt) / (0.0025 * rig.sensitivity), ((s.pitch ?? 0) * Math.PI / 180 * dt) / (0.0025 * rig.sensitivity));
          cmdYaw += rig.yaw - y0; cmdPitch += rig.pitch - p0;
        }
        if (s.jumpEvery) { const ph = st.segT % s.jumpEvery; input.Space = ph < 0.15; }
      }
    }
    // (what moved the lens this frame, for the diagnosis: the push off walls after the arm was placed)
    let push = 0;
    const unclip = rig.unclip, pc = physics.pushCapsule;
    rig.unclip = function (cam, ...a) { const b = cam.clone(); const r = unclip.call(this, cam, ...a); push += b.distanceTo(cam); return r; };
    physics.pushCapsule = function (p, ...a) { const b = p.clone(); const r = pc.call(this, p, ...a); push += b.distanceTo(p); return r; };
    let r;
    try { r = update(pos, dt, frame); } finally { rig.unclip = unclip; physics.pushCapsule = pc; }
    if (!st.rec || dt <= 0) return r;
    // the record
    camera.getWorldDirection(_f);
    const head = player.pos.clone().addScaledVector(up, 1.6), chest = player.pos.clone().addScaledVector(up, 1.1);
    const to = head.clone().sub(camera.position), Lh = to.length();
    const occl = Lh > 0.4 && physics.rayDistance(camera.position, to.divideScalar(Lh), Lh) < Lh - 0.25;
    const s = {
      t: +window.clock().toFixed(4), dt: +dt.toFixed(4), cam: camera.position.toArray().map((x) => +x.toFixed(4)), look: rig._look.toArray().map((x) => +x.toFixed(4)),
      pos: player.pos.toArray().map((x) => +x.toFixed(4)), fwd: _f.toArray().map((x) => +x.toFixed(5)), cmdYaw: +cmdYaw.toFixed(5), cmdPitch: +cmdPitch.toFixed(5),
      clear: +clearance().toFixed(3), occl, head: ndc(head), chest: ndc(chest), tight: +rig.tightK.toFixed(3), side: +rig._side.toFixed(3), shoulder: rig.shoulder,
      cur: +rig._curDist.toFixed(3), push: +push.toFixed(3),
      seg: st.seg, stick: input.stick ? [+input.stick.x.toFixed(2), +input.stick.y.toFixed(2)] : null, spd: +Math.hypot(player.vel.x, player.vel.z).toFixed(2),
    };
    st.samples.push(s);
    // a quick read of how bad this frame is (the full judgement is node's): worth a picture?
    if (prev2 && !L.isCut(prev, s) && !L.isCut(prev2, prev)) {
      const one = L.steps([prev2, prev, s])[1];
      const sev = Math.max(Math.abs(one.dArm) / L.LIMITS.pop, one.move / (L.LIMITS.jump * 1.5), one.look / (L.LIMITS.lookJump * 1.5), one.spin / (L.LIMITS.spin * 1.5),
        s.clear < L.LIMITS.clip ? 1 + (L.LIMITS.clip - s.clear) / L.LIMITS.clip : 0);
      const weakest = st.shots.length < 10 ? 0 : Math.min(...st.shots.map((x) => x.sev));
      if (sev >= 1 && sev > weakest && !st.shots.some((x) => Math.abs(x.t - s.t) < 0.6 && x.sev >= sev)) pending = { t: s.t, sev, what: `Δarm ${one.dArm.toFixed(2)} m · off-path ${one.move.toFixed(2)} m · look ${one.look.toFixed(2)} m · spin ${one.spin.toFixed(0)}°/s · lens ${s.clear.toFixed(2)} m` };
    }
    prev2 = prev; prev = s;
    return r;
  };
  const render = renderer.render.bind(renderer);
  const cv = document.createElement('canvas'); cv.width = 480; cv.height = 270; const cx = cv.getContext('2d');
  renderer.render = function (scene, cam) {
    const r = render(scene, cam);
    if (pending && renderer.getRenderTarget() === null) {
      cx.drawImage(renderer.domElement, 0, 0, cv.width, cv.height);
      st.shots = st.shots.filter((x) => Math.abs(x.t - pending.t) >= 0.6);
      st.shots.push({ ...pending, img: cv.toDataURL('image/jpeg', 0.75) });
      st.shots.sort((a, b) => b.sev - a.sev); st.shots.length = Math.min(st.shots.length, 10);
      pending = 0;
    }
    return r;
  };
  st.start = (segs) => { st.segs = segs; st.seg = -1; st.segT = 0; st.samples = []; st.shots = []; st.log = []; st.wa = null; st.rate = 0; st.done = false; st.rec = true; prev = prev2 = null; };
  return true;
}

/** The contact sheet: the scenario's worst frames (their pictures kept by the page), captioned, tiled 3 across. */
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
      c.fillText('t ' + shots[i].t.toFixed(2) + ' s · severity ' + shots[i].sev.toFixed(1), x + 6, y + h + 14); c.fillText(shots[i].what, x + 6, y + h + 29);
    }
    return cv.toDataURL('image/png');
  })()`);
}

// ---------------------------------------------------------------- the scenarios, world by world
const results = {}, logs = {};
const byWorld = [...new Set(plan.map((s) => s.world))];
for (const [wn, world] of byWorld.entries()) {
  if (wn) await sleep(1500);   // (a rest between worlds: the machine is shared)
  const first = plan.find((s) => s.world === world);
  await send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(250);
  await ev(`localStorage.clear(); localStorage.setItem('moebius.muted','1');
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${PRESET}', music: 0, effects: 0, voices: 0, volume: 0, enemies: 'normal' }));
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'foes.seen': true, ...${JSON.stringify(first.flags ?? {})} }, keepsakes: [] })); true`);
  await send('Page.navigate', { url: `${BASE}?level=${world}${first.query ?? ''}` });
  let up = false;
  for (let i = 0; i < 1500 && !up; i++) { up = (await ev('!!window.__moebiusBooted && !!window.player && !!window.rig').catch(() => false)) === true; if (!up) await sleep(100); }
  if (!up) { console.log(`${world}: never booted`); for (const s of plan.filter((x) => x.world === world)) results[s.name] = { error: 'never booted' }; continue; }
  await sleep(2500);
  await ev(`(() => { window.sound?.setVolumes?.(0, 0); window.story?.closePage?.(); if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; } return true; })()`);
  await ev(`(async () => { const L = await import('/scripts/camera-qc/lib.mjs'); return (${install.toString()})(L); })()`);
  for (const sc of plan.filter((s) => s.world === world)) {
    // the start: placed, turned, settled
    await ev(`(async () => { const { THREE, player, rig } = window; ${sc.setup ?? ''}
      ${sc.at ? `player.teleport(new THREE.Vector3(...${JSON.stringify(sc.at)}), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));` : ''}
      ${sc.yaw != null ? `rig.yaw = ${sc.yaw};` : ''} ${sc.pitchTo != null ? `rig.pitch = ${sc.pitchTo};` : ''} rig._lastP = null; window.story?.closePage?.(); return true; })()`);
    await sleep((sc.settle ?? 2) * 1000);
    await ev(`window.__cq.start(${JSON.stringify(sc.segs)}); true`);
    const total = sc.segs.reduce((s, x) => s + x.for, 0);
    const t0 = Date.now();
    while (!(await ev('window.__cq.done')) && Date.now() - t0 < (total * 3 + 30) * 1000) await sleep(250);
    const { samples, shots, log } = await ev('(() => { const s = window.__cq; s.rec = false; return { samples: s.samples, shots: s.shots, log: s.log }; })()');
    const r = L.analyse(samples);
    results[sc.name] = { world, about: sc.about, ...r, events: r.events.slice(0, 40) };
    logs[sc.name] = log;
    writeFileSync(join(OUT, `${sc.name}.json`), JSON.stringify(samples));
    const png = await sheet(sc.name, shots.sort((a, b) => b.sev - a.sev).slice(0, 6));
    if (png) writeFileSync(join(OUT, `${sc.name}.png`), Buffer.from(png.split(',')[1], 'base64'));
    console.log(`${sc.name.padEnd(22)} ${r.green ? 'green' : 'RED  '} pops ${r.measures.pops} jumps ${r.measures.jumps} look ${r.measures.lookJumps} spins ${r.measures.spins} clip ${(r.measures.clip * 100).toFixed(1)}% hidden ${(r.measures.occluded * 100).toFixed(1)}% out ${(r.measures.out * 100).toFixed(1)}% rev ${r.measures.reversals}/s rough ${(r.measures.rms * 100).toFixed(2)} cm${log.length ? ` (${log.length} stuck)` : ''}`);
  }
}
writeFileSync(join(OUT, 'camera.json'), JSON.stringify({ when: new Date().toISOString(), preset: PRESET, limits: L.LIMITS, results, logs, errors: errors.slice(0, 20) }, null, 2));
const ok = Object.fromEntries(Object.entries(results).filter(([, r]) => !r.error));
writeFileSync(join(OUT, 'camera.md'), `${L.table(ok)}\n`);
console.log(`\n${L.table(ok)}\n\nwritten to ${OUT}`);
await done();
process.exit(Object.values(results).some((r) => r.error || !r.green) ? 1 : 0);
