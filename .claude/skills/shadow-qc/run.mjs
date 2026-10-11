// The shadow QC (.claude/skills/shadow-qc/SKILL.md): the traveller walked through the Shadow Room
// (src/levels/shadow-room.js, ?level=shadows) in a MUTED headless Chrome on the real GPU, once per graphics preset and
// sun; every frame the game's own shadow lookup is evaluated at fixed probes on the room's surfaces and under the
// traveller (scripts/shadow-qc/probes.js) and judged against ray-traced truth (scripts/shadow-qc/lib.mjs): acne,
// leaks, peter-panning, casters off screen, flicker (shimmer and cascade pops), cascade seams, the traveller's shadow.
//
//   node .claude/skills/shadow-qc/run.mjs <out-dir> [--presets high,deck,handheld] [--suns 35/90,12/90] [--only props,stairs]
//   PORT (default 5371; never 5173), CDP (default 5372); VITE_CACHE a dependency cache inside the checkout (a worktree)
//
// Writes <out-dir>/shadows.json (every run's counters and measures per spot), shadows.md (the table), and
// <run>.<spot>.png (a contact sheet of the spot's worst frames, the misjudged probes marked). Exits 1 if a spot is red.
// No game code changed: it drives `window.input` (the stick, Shift) and `rig.look` as a player's hands would, holds the
// sun with the room's own controls (level.shadowRoom), and reads.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'shadow-qc'));
const W = 1280, H = 720;
const PRESETS = arg('presets', 'high,deck,handheld').split(',');
const SUNS = arg('suns', '35/90,12/90').split(',').map((s) => s.split('/').map(Number));
const ONLY = arg('only')?.split(',') ?? null;
const PORT = Number(process.env.PORT ?? 5371), CDP = Number(process.env.CDP ?? 5372);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const L = await import(join(ROOT, 'scripts/shadow-qc/lib.mjs'));
const { SHADOW_ROOM } = await import(join(ROOT, 'src/levels/shadow-room.js'));

// ---------------------------------------------------------------- the server and the browser (one each, closed at the end)
const profile = mkdtempSync(join(tmpdir(), 'shadow-qc-chrome-'));
const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
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
  if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails?.exception?.description ?? '').slice(0, 300)); });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const d = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (d.result?.exceptionDetails) throw new Error(`page: ${d.result.exceptionDetails.exception?.description?.slice(0, 600)}`); return d.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

// ---------------------------------------------------------------- the recorder and the hands, put into the page
// (one function, stringified: it wraps rig.update for the hands and renderer.render to judge each frame right after it
// is drawn, while the frame's shadow maps, their uniforms and the G-buffer still hold it)
async function install(o) {
  const { THREE, rig, camera, player, renderer, level, post, input, scene, sharedUniforms: SU } = window;
  const Pm = await import('/scripts/shadow-qc/probes.js'), Lb = await import('/scripts/shadow-qc/lib.mjs'), Sh = await import('/src/shadows.js');
  const room = level.shadowRoom, plan = room.plan, spotIds = plan.spots.map((s) => s.id);
  const spotAt = (x, z) => { for (const [k, s] of plan.spots.entries()) { const [x0, z0, x1, z1] = s.rect; if (x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && z >= Math.min(z0, z1) && z <= Math.max(z0, z1)) return k; } return -1; };
  const exclude = [player.object, ...room.movers, ...(player.vehicles ?? []).map((v) => v.object ?? v.mesh)].filter(Boolean);
  const C = Pm.casters(scene, { exclude, noShadow: level.noShadow ?? [] });
  const P = Pm.layProbes(C, plan.receivers, spotIds);
  const K = 36 * 90 + 80;
  const E = new Pm.ProbeEval(renderer, P, K);
  const st = window.__sq = { prof: {}, acc: {}, shots: {}, series: [], log: [], done: true, rec: false, wp: 0, look: 0, stuck: 0, stuckP: null, N: P.N, tris: C.tris };
  const Ld = new THREE.Vector3(), Lprev = new THREE.Vector3();
  st.retrace = () => { Sh.shadowDirection(SU.uSunDir.value, Ld); Pm.trace(P, C, Ld); Lprev.copy(Ld); return { N: P.N, lit: P.truth.filter((t) => t === 0).length, shade: P.truth.filter((t) => t === 1).length }; };
  const _r = new THREE.Ray(), _p = new THREE.Vector3(), _f = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Sphere(), _fr = new THREE.Frustum(), _pm = new THREE.Matrix4();
  const groundAt = (x, y, z) => { _r.origin.set(x, y + 1.2, z); _r.direction.set(0, -1, 0); const h = C.bvh.raycastFirst(_r, THREE.DoubleSide, 0, 6); return h ? h.point.y : y; };
  // (a ground probe under him near a static shadow's edge: the filter's blur of that edge is not his; not judged)
  const _q = new THREE.Vector3();
  const nearStatic = (p) => { for (const [dx, dz] of [[0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12]]) { _q.set(p.x + dx, p.y, p.z + dz); if (blocked(_q, Ld)) return true; } return false; };
  const blocked = (p, L) => { _r.origin.copy(p).addScaledVector(L, 0.004); _r.direction.copy(L); return !!C.bvh.raycastFirst(_r, THREE.DoubleSide, 0, 3000); };
  // what may shade a probe this frame and doesn't stand still: the movers and the traveller (spheres round them)
  const movingSpheres = () => {
    const out = [];
    for (const m of room.movers) { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); _s.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld); out.push([_s.center.clone(), _s.radius + 0.3]); }
    out.push([player.pos.clone().add(new THREE.Vector3(0, 0.9, 0)), 1.4]);
    return out;
  };
  const nearRay = (p, L, c, r) => { _d.subVectors(c, p); const s = Math.max(0, _d.dot(L)); return _d.addScaledVector(L, -s).lengthSq() < r * r; };
  let prev = null, movedPrev = new Uint8Array(P.N), moved = new Uint8Array(P.N), pending = false;
  const keep = (k) => ({ sh: new Float32Array(k.sh), vis: new Float32Array(k.vis), iF: new Float32Array(k.iF), i0: new Float32Array(k.i0), i1: new Float32Array(k.i1) });
  const COLORS = { acne: '#ff2a2a', leak: '#2a6bff', peter: '#ff9a1f', off: '#e22ad8', shimmer: '#ffe11f', pop: '#1fe3ff', seam: '#33d14a' };
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const cx = cv.getContext('2d');

  function judge() {
    const cascades = window.cascades, taps = SU.uShadowTaps.value;
    Sh.shadowDirection(SU.uSunDir.value, Ld);
    const turned = Ld.distanceTo(Lprev) > 1e-6;
    // the traveller's ground probes, then every lookup
    let _t0 = performance.now(); const mark = (k) => { const n = performance.now(); st.prof[k] = (st.prof[k] ?? 0) + n - _t0; _t0 = n; };
    const cp = Pm.charProbes(player, Ld, groundAt);
    E.setDynamic(cp.pos, cp.nor); mark('charProbes');
    const tN = post.uniforms.tNormal.value, Hpx = tN?.image?.height || renderer.domElement.height;
    const pxAngle = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Hpx;
    const active = new Set();
    const cam = camera.getWorldPosition(new THREE.Vector3());
    plan.spots.forEach((s, k) => { const [x0, z0, x1, z1] = s.rect; const dx = Math.max(Math.min(x0, x1) - cam.x, 0, cam.x - Math.max(x0, x1)), dz = Math.max(Math.min(z0, z1) - cam.z, 0, cam.z - Math.max(z0, z1)); if (Math.hypot(dx, dz) < o.range) active.add(k); });
    const F = E.read(camera, tN, pxAngle, active); mark('gpu');
    // movers and the traveller: their probes left out (this frame and the last)
    const spheres = movingSpheres();
    moved.fill(0);
    for (let i = 0; i < P.N; i++) {
      if (!F.vis[i]) continue;
      _p.fromArray(P.pos, 3 * i);
      for (const [c, r] of spheres) if (nearRay(_p, Ld, c, r)) { moved[i] = 1; break; }
    }
    const both = new Uint8Array(P.N); for (let i = 0; i < P.N; i++) both[i] = moved[i] | movedPrev[i];
    camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
    const offscreen = (i) => !_fr.containsPoint(_p.fromArray(P.hit, 3 * i));
    const cas = [cascades.fine.enabled ? { texel: cascades.fine.texel, offset: SU.uShadowNormalOffset0.value } : null,
      { texel: cascades.near.texel, offset: SU.uShadowNormalOffset.value }, { texel: cascades.far.texel, offset: SU.uShadowNormalOffset2.value }];
    const clear = (i, tol) => Pm.exactEdge(P, C, i, Ld, tol) > tol;
    mark('moved'); const r = Lb.judgeFrame(P, F, prev, { cascades: cas, taps, hero: (SU.uShadowHero?.value ?? 0) > 0.5, moved: both, offscreen, turned, clear }, st.acc); mark('judge');
    // the traveller's own shadow
    const here = spotAt(player.pos.x, player.pos.z), body = here >= 0 && Ld.y > 0.05 ? Pm.bodyBVH(player) : null;
    mark('body');
    const inBody = (p) => { _r.origin.copy(p).addScaledVector(Ld, 0.002); _r.direction.copy(Ld); return !!body.bvh.raycastFirst(_r, THREE.DoubleSide, 0, 60); };
    let ch = null;
    if (body) {
      const truth = new Int8Array(cp.grid), sh = F.sh.subarray(P.N, P.N + cp.grid);
      for (let j = 0; j < cp.grid; j++) {
        _p.fromArray(cp.pos, 3 * j);
        let mv = false; for (const [c, rr] of spheres.slice(0, -1)) if (nearRay(_p, Ld, c, rr)) { mv = true; break; }
        truth[j] = mv || blocked(_p, Ld) || nearStatic(_p) ? -1 : inBody(_p) ? 1 : 0;
      }
      const feet = [];
      for (const f of cp.feet) {
        if (!f.planted) continue;
        let drawn = Infinity, tru = Infinity;
        for (let m = 0; m < f.count; m++) {
          const q = f.start + m;
          _p.fromArray(cp.pos, 3 * q);
          if (tru === Infinity && inBody(_p)) tru = m * 0.015;
          if (drawn === Infinity && F.sh[P.N + q] < Lb.LIMITS.dark) drawn = m * 0.015;
        }
        if (tru < 0.2) feet.push({ drawn, truth: tru });
      }
      ch = Lb.judgeCharacter(truth, sh, cp.w, feet, (st.acc[here] ??= Lb.counters()));
      mark('char');
    }
    // the worst frames of each spot (by its own misjudged probes; the traveller's shadow counts for the spot he is in),
    // the misjudged probes marked
    const t = window.clock();
    const byS = {};
    for (const [i, kind] of r.bad) { const s = P.spot[i]; byS[s] = (byS[s] ?? 0) + (kind === 'shimmer' || kind === 'pop' ? 3 : kind === 'seam' ? 0.5 : kind === 'off' ? 2 : 1); }
    if (ch && here >= 0) byS[here] = (byS[here] ?? 0) + Math.max(0, Lb.LIMITS.coverage - ch.coverage) * 400 + Math.max(0, ch.spill - Lb.LIMITS.spill) * 400;
    const score = Object.values(byS).reduce((a, b) => a + b, 0);
    st.series.push({ t: +t.toFixed(3), spot: here, score: +score.toFixed(1), bad: r.bad.length, cov: ch ? +ch.coverage.toFixed(3) : null, spill: ch ? +ch.spill.toFixed(3) : null, fps: +(1 / Math.max(1e-3, st.dt ?? 0.016)).toFixed(0) });
    let img = null;
    for (const [s, sc] of Object.entries(byS)) {
      if (!(sc > 0)) continue;
      const list = (st.shots[s] ??= []);
      const weakest = list.length < 4 ? 0 : Math.min(...list.map((x) => x.score));
      if (!(sc > weakest) || list.some((x) => Math.abs(x.t - t) < 0.8 && x.score >= sc)) continue;
      const counts = {};
      if (!img) {
        cx.drawImage(renderer.domElement, 0, 0, cv.width, cv.height);
        const sx = cv.width / 2, sy = cv.height / 2;
        for (const [i, kind] of r.bad) {
          _p.fromArray(P.pos, 3 * i).project(camera);
          if (_p.z > 1) continue;
          cx.fillStyle = COLORS[kind]; cx.fillRect(sx + _p.x * sx - 1.5, sy - _p.y * sy - 1.5, 3, 3);
        }
        img = cv.toDataURL('image/jpeg', 0.8);
      }
      for (const [i, kind] of r.bad) if (String(P.spot[i]) === s) counts[kind] = (counts[kind] ?? 0) + 1;
      const what = Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(' · ') + (ch && String(here) === s ? ` · his shadow ${(ch.coverage * 100).toFixed(0)} % drawn, ${(ch.spill * 100).toFixed(0)} % spill` : '');
      const keepList = list.filter((x) => Math.abs(x.t - t) >= 0.8);
      keepList.push({ t, score: sc, what, img });
      keepList.sort((a, b) => b.score - a.score); keepList.length = Math.min(keepList.length, 4);
      st.shots[s] = keepList;
    }
    mark('shots'); prev = keep(F); [movedPrev, moved] = [moved, movedPrev]; Lprev.copy(Ld); mark('keep'); st.prof.n = (st.prof.n ?? 0) + 1;
  }

  const render = renderer.render.bind(renderer);
  let inside = false;
  renderer.render = function (sc, cm) {
    const res = render(sc, cm);
    if (pending && !inside && renderer.getRenderTarget() === null && st.rec) {
      pending = false; inside = true;
      try { judge(); } catch (e) { st.log.push(String(e?.stack ?? e).slice(0, 400)); st.done = true; } finally { inside = false; }
    }
    return res;
  };
  // the hands: the path's waypoints at a run, the camera turned after the way; at a 'look' stop a full turn of the camera
  const update = rig.update.bind(rig);
  rig.update = function (pos, dt, frame) {
    st.dt = dt;
    if (!st.done && dt > 0) {
      pending = true;
      const w = st.path[st.wp];
      if (!w) { st.done = true; input.stick = null; input.ShiftLeft = false; }
      else if (st.look > 0) {
        input.stick = null; input.ShiftLeft = false;
        st.look -= dt;
        rig.look(-((o.lookTurn * Math.PI) / 180 * dt) / (0.0025 * rig.sensitivity), 0);
        if (st.look <= 0) st.wp++;
      } else {
        _d.set(w[0] - player.pos.x, 0, w[1] - player.pos.z);
        if (_d.length() < 0.7) { if (w[2] === 'look' && o.lookSecs > 0) st.look = o.lookSecs; else st.wp++; st.stuck = 0; }
        else {
          const want = _d.normalize();
          camera.getWorldDirection(_f); _f.y = 0; _f.normalize(); const rt = new THREE.Vector3(-_f.z, 0, _f.x);
          if (input.stick && typeof input.stick === 'object') { input.stick.x = want.dot(rt); input.stick.y = want.dot(_f); } else input.stick = { x: want.dot(rt), y: want.dot(_f) };
          input.ShiftLeft = !!o.run;
          const err = Math.atan2(want.x * _f.z - want.z * _f.x, want.dot(_f));
          const goal = Math.min(Math.abs(err) * 2.5, (o.steer * Math.PI) / 180) * Math.sign(err);
          st.rate = (st.rate ?? 0) + (goal - (st.rate ?? 0)) * (1 - Math.exp(-8 * dt));
          rig.look(-(st.rate * dt) / (0.0025 * rig.sensitivity), 0);
          if (!st.stuckP || st.stuckP.distanceTo(player.pos) > 0.3) { st.stuckP = player.pos.clone(); st.stuck = 0; }
          else if ((st.stuck += dt) > 2.5) { st.log.push(`stuck before ${w[0]}, ${w[1]}`); st.wp++; st.stuck = 0; st.stuckP = null; }
        }
      }
    }
    return update(pos, dt, frame);
  };
  st.start = (path) => { st.path = path; st.wp = 0; st.look = 0; st.acc = {}; st.shots = {}; st.series = []; st.log = []; prev = null; movedPrev.fill(0); st.done = false; st.rec = true; };
  return { N: P.N, tris: C.tris, spots: spotIds };
}

/** The contact sheet: a spot's worst frames (their pictures kept by the page), captioned, tiled 2 across. */
async function sheet(title, shots) {
  return ev(`(async () => {
    const shots = ${JSON.stringify(shots)}; if (!shots.length) return null;
    const C = 2, w = 640, h = 360, cap = 22, rows = Math.ceil(shots.length / C), head = 46;
    const cv = document.createElement('canvas'); cv.width = C * w; cv.height = rows * (h + cap) + head; const c = cv.getContext('2d');
    c.fillStyle = '#f4ecdf'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#222'; c.font = 'bold 16px sans-serif'; c.fillText(${JSON.stringify(title)}, 8, 20);
    c.font = '12px sans-serif';
    const key = [['acne', '#ff2a2a'], ['leak', '#2a6bff'], ['peter-pan', '#ff9a1f'], ['off screen', '#e22ad8'], ['shimmer', '#ffe11f'], ['pop', '#1fe3ff'], ['seam', '#33d14a']];
    let x = 8; for (const [k, col] of key) { c.fillStyle = col; c.fillRect(x, 30, 10, 10); c.fillStyle = '#222'; c.fillText(k, x + 14, 39); x += 30 + c.measureText(k).width; }
    for (let i = 0; i < shots.length; i++) {
      const im = new Image(); im.src = shots[i].img; await im.decode();
      const X = (i % C) * w, Y = head + Math.floor(i / C) * (h + cap);
      c.drawImage(im, X, Y, w, h); c.fillStyle = '#222';
      c.fillText('t ' + shots[i].t.toFixed(2) + ' s · score ' + shots[i].score.toFixed(0) + ' · ' + shots[i].what, X + 6, Y + h + 15);
    }
    return cv.toDataURL('image/png');
  })()`);
}

// ---------------------------------------------------------------- the runs: a preset and a sun each, on a fresh boot
const OPTS = { range: Number(arg('range', 45)), run: arg('walk') ? false : true, steer: 140, lookTurn: 72, lookSecs: Number(arg('look', 5)) };
const path = ONLY ? SHADOW_ROOM.path.filter(([x, z]) => ONLY.some((id) => { const s = SHADOW_ROOM.spots.find((q) => q.id === id); const [x0, z0, x1, z1] = s.rect; return x >= Math.min(x0, x1) - 3 && x <= Math.max(x0, x1) + 3 && z >= Math.min(z0, z1) - 3 && z <= Math.max(z0, z1) + 3; })) : SHADOW_ROOM.path;
const results = {}, rows = [];
// (written after every run: a long run stopped half way keeps what it measured)
const save = () => {
  writeFileSync(join(OUT, 'shadows.json'), JSON.stringify({ when: new Date().toISOString(), limits: L.LIMITS, opts: OPTS, results, errors: errors.slice(0, 20) }, null, 2));
  writeFileSync(join(OUT, 'shadows.md'), `${L.table(rows)}\n`);
};
let first = true;
for (const preset of PRESETS) for (const [el, az] of SUNS) {
  const run = `${preset}.sun${el}-${az}`;
  if (!first) await sleep(1500);   // (a rest between runs: the machine is shared)
  first = false;
  await send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(250);
  await ev(`localStorage.clear(); localStorage.setItem('moebius.muted','1');
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${preset}', music: 0, effects: 0, voices: 0, volume: 0, enemies: 'normal' }));
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'foes.seen': true }, keepsakes: [] })); true`);
  await send('Page.navigate', { url: `${BASE}?level=shadows` });
  let up = false;
  for (let i = 0; i < 1500 && !up; i++) { up = (await ev('!!window.__moebiusBooted && !!window.player && !!window.rig && !!window.level?.shadowRoom').catch(() => false)) === true; if (!up) await sleep(100); }
  if (!up) { console.log(`${run}: never booted`); results[run] = { error: 'never booted', errors: errors.slice(-5) }; continue; }
  await sleep(2500);
  await ev(`(() => { window.sound?.setVolumes?.(0, 0); window.story?.closePage?.(); if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; } if (window.sky) window.sky.speed = 0; window.level.shadowRoom.setSun(${el}, ${az}); return true; })()`);
  await sleep(1200);
  const info = await ev(`(async () => (${install.toString()})(${JSON.stringify(OPTS)}))()`);
  const truth = await ev('window.__sq.retrace()');
  const [sx, sz] = path[0];
  await ev(`(() => { const { THREE, player, rig } = window; player.teleport(new THREE.Vector3(${sx}, 0.05, ${sz}), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)); rig.yaw = 0; rig._lastP = null; return true; })()`);
  await sleep(1500);
  await ev(`window.__sq.start(${JSON.stringify(path)}); true`);
  const t0 = Date.now();
  while (!(await ev('window.__sq.done')) && Date.now() - t0 < 900 * 1000) await sleep(500);
  const got = await ev('(() => { const s = window.__sq; s.rec = false; return { prof: s.prof, acc: s.acc, series: s.series, log: s.log, shots: Object.fromEntries(Object.entries(s.shots).map(([k, v]) => [k, v])) }; })()');
  const spots = {};
  for (const [k, A] of Object.entries(got.acc)) {
    const id = info.spots[k];
    const r = L.verdict(A);
    spots[id] = { ...r, counters: { ...A, gaps: undefined } };
    rows.push([run, id, r]);
    const shots = got.shots[k] ?? [];
    if (shots.length) {
      const png = await sheet(`${run} · ${id}: the worst frames`, shots);
      if (png) writeFileSync(join(OUT, `${run}.${id}.png`), Buffer.from(png.split(',')[1], 'base64'));
    }
  }
  const fps = got.series.map((s) => s.fps).sort((a, b) => a - b);
  results[run] = { prof: got.prof, preset, sun: { el, az }, probes: info.N, tris: info.tris, truth, spots, log: got.log, frames: got.series.length, fpsMedian: fps[Math.floor(fps.length / 2)] ?? 0, secs: (Date.now() - t0) / 1000 };
  writeFileSync(join(OUT, `${run}.series.json`), JSON.stringify(got.series));
  const cost = Object.entries(got.prof ?? {}).filter(([k]) => k !== 'n').map(([k, v]) => `${k} ${(v / (got.prof.n || 1)).toFixed(1)}`).join(', ');
  console.log(`${run}: ${got.series.length} frames, ${info.N} probes, ${results[run].secs.toFixed(0)} s; the QC's own ms a frame: ${cost}${got.log.length ? `; log: ${got.log.slice(0, 3).join(' | ')}` : ''}`);
  for (const [id, r] of Object.entries(spots)) console.log(`  ${id.padEnd(10)} ${r.green ? 'green' : 'RED  '} ${r.fails.join('; ')}`);
  save();
}
save();
console.log(`\n${L.table(rows)}\n\nwritten to ${OUT}`);
await done();
process.exit(Object.values(results).some((r) => r.error) || rows.some(([, , r]) => !r.green) ? 1 : 0);
