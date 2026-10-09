// The visual audit's probes (.claude/skills/visual-audit/SKILL.md, sections 3-5): what still frames from fixed
// cameras miss, measured in a MUTED headless Chrome on the real GPU, world by world, at each preset.
//
//   orbit     at chosen spots (stairs, cave walls, room corners, walls at the ways in, the known spots of past bugs)
//             the camera orbits the spot a few degrees at a time; the same surface points (raycast once, projected
//             again each frame, hidden ones left out) are read in the spot masks (debug 10) and the enclosure
//             (debug 9). A mask that comes and goes on the same surface as the view turns is flagged (the blocks of
//             c58cbcaa). scripts/visual-probes/lib.mjs stability.
//   ghost     the traveller stands in front of the spot's dark area; the masks (9, 10) are taken with him and with
//             him hidden, his silhouette from the albedo (2). A pale region beside him in a dark mass is the "white
//             shadow" of 620c4384; a dark one the halo before it. lib.mjs ghostCheck.
//   seams     inside every cave and room (the ways in: level.portals' `to`, and the known caves): level rays at the
//             foot of the walls and a metre up (a gap under a wall), and the light term (debug 5) looking round at
//             the floor's edge for thin lit lines (the cave seam of c58cbcaa). lib.mjs floorSlits, litRidges.
//
//   node .claude/skills/visual-audit/probes.mjs <out-dir> [--worlds desert,incal] [--presets handheld,high]
//        [--hour 9.5] [--auto 4] [--interiors 4] [--only known] [--root <checkout to serve>] [--rest 20]
//   PORT (default 5333), CDP (Chrome's debugging port, default 5338). Never 5173 (the author's own dev server).
// Writes <out-dir>/report.json and, for every flagged probe, its debug pictures (<world>/<preset>/...png).
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ROOT = resolve(arg('root', HERE));   // (the code served: another checkout to compare, e.g. the commit before a fix)
const { decodePNG } = await import(join(HERE, 'scripts/png.mjs'));
const L = await import(join(HERE, 'scripts/visual-probes/lib.mjs'));
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'visual-probes'));
const PRESETS = arg('presets', 'handheld,high').split(','), HOUR = +arg('hour', 9.5), AUTO = +arg('auto', 4), MAXI = +arg('interiors', 4);
const SAVE_ALL = args.includes('--save-all'), ONLY = arg('only', 'all'), SPOTS = arg('spots', '').split(',').filter(Boolean), SKIP = arg('skip', '').split(','), REST = +arg('rest', 20) * 1000, W = 1280, H = 720;
const PORT = Number(process.env.PORT ?? 5333), CDP = Number(process.env.CDP ?? 5338);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const names = await import(join(HERE, 'src/levels/names.js'));
const WORLDS = arg('worlds', names.ORDER.join(',')).split(',').filter(Boolean);
const VW = JSON.parse(readFileSync(join(HERE, 'scripts/bench/viewpoints-worlds.json'), 'utf8')).worlds;
const VD = JSON.parse(readFileSync(join(HERE, 'scripts/bench/viewpoints.json'), 'utf8')).views;
const viewsOf = (id) => (id === 'desert' ? VD : VW[id]?.views ?? []).filter((v) => v.eye && v.target).slice(0, 2);

/** The spots of past bugs (src/changelog-media.js v1.1 / v1.2 shots): each must stay clean. */
const KNOWN = {
  desert: [
    { name: 'qanat-tree-stairs', kind: 'stairs', ghost: true, player: [219.1, 4.6, 382.0], heading: 2.6, eye: [213.62, 8.85, 372.51], target: [219.1, 3.85, 382.04] },
    { name: 'giant-cave', kind: 'cave', inside: true, player: [-1250, 1000, 1272], heading: Math.PI, eye: [-1249.3, 1001.8, 1274.5], target: [-1250, 999.6, 1250] },
    { name: 'hearth-cave', kind: 'cave', inside: true, player: [1250, 1000, -1242], heading: Math.PI, eye: [1250.7, 1001.8, -1239.4], target: [1249, 1000.6, -1262] },
  ],
};

// ---------------------------------------------------------------- the browser
const { createServer } = await import(join(HERE, 'node_modules/vite/dist/node/index.js'));
process.chdir(ROOT);   // (vite.config.js allows serving from the working directory's workspace)
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', clearScreen: false, ...(ROOT !== HERE ? { cacheDir: join(tmpdir(), 'visual-probes-vite') } : {}),
  server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const BASE = `http://127.0.0.1:${PORT}/`;
const profile = mkdtempSync(join(tmpdir(), 'visual-probes-chrome-'));
const proc = spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', `--window-size=${W},${H}`, '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { try { proc.kill('SIGKILL'); } catch {} });   // (never leave a Chrome behind on a shared machine)
process.on('uncaughtException', (e) => { console.error(e); process.exit(1); });
let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = (await (await fetch(`http://localhost:${CDP}/json`)).json()).filter?.((t) => t.webSocketDebuggerUrl); if (!tabs?.length) tabs = null; } catch { await sleep(250); } }
if (!tabs) throw new Error(`no Chrome on debugging port ${CDP} (set CDP to a free port)`);
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waits = new Map(), errors = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails?.exception?.description ?? '').slice(0, 200)); });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const d = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (d.result?.exceptionDetails) throw new Error(`page: ${d.result.exceptionDetails.exception?.description?.slice(0, 300)}`); return d.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
const grab = async () => decodePNG(Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
const grabRaw = async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64');

// the page's side: a pinned camera, the traveller hidden on demand, surface points raycast and projected, level rays
const PAGE = `(() => {
  const { THREE, camera, player, physics, params } = window, up = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4();
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  if (!camera.__probe) { camera.__probe = true; camera.updateMatrixWorld = function (f) { const P = window.__pin; if (P) { this.position.copy(P.e); this.quaternion.copy(P.q); if (this.fov !== P.fov) { this.fov = P.fov; this.updateProjectionMatrix(); } } return base.call(this, f); }; }
  const V = (a) => new THREE.Vector3(...a);
  const P = window.__probe = {
    pin(eye, target, fov = 55) { const e = V(eye); window.__pin = { e, q: new THREE.Quaternion().setFromRotationMatrix(m4.lookAt(e, V(target), up)), fov }; camera.updateMatrixWorld(true); return true; },
    hide(on) { const o = player.object ?? player.char?.root; if (!o) return false; if (!o.__probeVis) { let v = o.visible; Object.defineProperty(o, 'visible', { get() { return window.__hideP ? false : v; }, set(x) { v = x; }, configurable: true }); o.__probeVis = true; } window.__hideP = !!on; return true; },
    place(pos, heading) { player.teleport?.(V(pos), up, new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading))); player.heading = heading; player.vel?.set(0, 0, 0); return true; },
    debug(n) { params.debug = n; return true; },
    ground(x, y, z) { const g = physics.groundAt(x, y + 1.5, z, 30); return Number.isFinite(g) ? g : null; },
    hit(o, d, far = 80) { const h = physics.rayHit(V(o), V(d).normalize(), far); return h ? { d: h.distance, p: h.point.toArray(), n: h.normal.toArray() } : null; },
    // surface points round the middle of the view: a grid of pixels raycast once (faces seen square enough)
    points(cx, cy, half = [200, 130], step = 10) {
      const ray = new THREE.Raycaster(), out = [], cam = camera.position.clone();
      for (let y = cy - half[1]; y <= cy + half[1]; y += step) for (let x = cx - half[0]; x <= cx + half[0]; x += step) {
        ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
        const h = physics.rayHit(ray.ray.origin, ray.ray.direction, 40);
        if (!h || h.normal.dot(ray.ray.direction) > -0.3) continue;
        out.push(h.point.clone().addScaledVector(h.normal, 0.02).toArray());
      }
      return out;
    },
    // where each point is on the screen now, null where something stands in front of it or it is off screen
    project(points) {
      camera.updateMatrixWorld(true);
      const cam = camera.position, d = new THREE.Vector3();
      return points.map((p) => {
        const v = V(p), s = v.clone().project(camera);
        if (s.z > 1 || Math.abs(s.x) > 0.98 || Math.abs(s.y) > 0.98) return null;
        d.subVectors(v, cam); const len = d.length();
        const h = physics.rayHit(cam, d.normalize(), len + 0.5);
        if (h && h.distance < len - 0.08) return null;
        return [Math.round((s.x * 0.5 + 0.5) * innerWidth), Math.round((0.5 - s.y * 0.5) * innerHeight)];
      });
    },
    // one origin's rays at once: level hits a metre up all round, and ground profiles out along 8 directions
    scan(o) {
      const g = P.ground(o[0], o[1] + 1, o[2]); if (g === null) return null;
      const hits = [];
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, h = P.hit([o[0], g + 1, o[2]], [Math.sin(a), 0, Math.cos(a)], 12); if (h && h.d > 2 && Math.abs(h.n[1]) < 0.3) hits.push({ a, ...h }); }
      const profiles = [];
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, d = [Math.sin(a), Math.cos(a)], hs = []; for (let s = 0; s < 100; s++) hs.push(P.ground(o[0] + d[0] * s * 0.2, g + 6, o[2] + d[1] * s * 0.2)); profiles.push({ d, hs }); }
      return { g, hits, profiles };
    },
    // the foot of the walls and a metre up, all round (24 ways)
    footRays(o, g) {
      const out = [];
      for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, d = [Math.sin(a), 0, Math.cos(a)], lo = P.hit([o[0], g + 0.06, o[2]], d, 60), hi = P.hit([o[0], g + 1.0, o[2]], d, 60);
        out.push({ angle: +a.toFixed(3), low: lo ? +lo.d.toFixed(2) : null, high: hi ? +hi.d.toFixed(2) : null }); }
      return out;
    },
    screen(p) { camera.updateMatrixWorld(true); const s = V(p).project(camera); return [(s.x * 0.5 + 0.5) * innerWidth, (0.5 - s.y * 0.5) * innerHeight]; },
  };
  return true;
})()`;
const setHour = `(() => { if (window.sky) { window.sky.hour = ${HOUR}; window.sky.speed = 0; window.updateSky?.(); } return true; })()`;

const settle = (ms = 260) => sleep(ms);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const add = (a, b) => a.map((x, i) => x + b[i]);
const mul = (a, k) => a.map((x) => x * k);
const len = (a) => Math.hypot(...a);
const norm = (a) => mul(a, 1 / (len(a) || 1));
/** The eye turned about the vertical through `target` by `deg`. */
const orbitEye = (eye, target, deg) => { const r = sub(eye, target), a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [target[0] + r[0] * c - r[2] * s, eye[1], target[2] + r[0] * s + r[2] * c]; };
const valueAt = (img, px) => (px ? img.data[Math.min(img.h - 1, Math.max(0, px[1])) * img.w + Math.min(img.w - 1, Math.max(0, px[0]))] : null);

async function orbit(spot, dir) {
  await ev(`__probe.hide(true)`);
  await ev(`__probe.pin(${JSON.stringify(spot.eye)}, ${JSON.stringify(spot.target)})`); await settle(500);
  const c = await ev(`__probe.screen(${JSON.stringify(spot.target)})`);
  const pts = await ev(`__probe.points(${Math.round(c[0])}, ${Math.round(c[1])})`);
  const series = { spot: pts.map(() => []), encl: pts.map(() => []) };
  let firstSpot = null, worstPng = null;
  for (const yaw of L.ORBIT.yaw) {
    await ev(`__probe.pin(${JSON.stringify(orbitEye(spot.eye, spot.target, yaw))}, ${JSON.stringify(spot.target)})`); await settle();
    const px = await ev(`__probe.project(${JSON.stringify(pts)})`);
    await ev(`__probe.debug(10)`); await settle(120); const rawS = await grabRaw(); const s = L.maskOf(decodePNG(rawS), L.spotPick);
    await ev(`__probe.debug(9)`); await settle(120); const e = L.maskOf(await grab(), L.enclosurePick);
    px.forEach((p, i) => { series.spot[i].push(valueAt(s, p)); series.encl[i].push(valueAt(e, p)); });
    if (yaw === L.ORBIT.yaw[0]) firstSpot = rawS;
    if (yaw === L.ORBIT.yaw.at(-1)) worstPng = rawS;
  }
  await ev(`__probe.debug(0)`); await ev(`__probe.hide(false)`);
  const spotR = L.stability(series.spot), enclR = L.stability(series.encl);
  const flagged = L.unstable(spotR) || L.unstable(enclR), drift = L.drifting(spotR) || L.drifting(enclR);
  if (flagged || drift) { writeFileSync(join(dir, `${spot.name}-orbit-first-d10.png`), firstSpot); writeFileSync(join(dir, `${spot.name}-orbit-last-d10.png`), worstPng); }
  const r3 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(3) : v]));
  return { points: pts.length, spot: r3(spotR), enclosure: r3(enclR), flagged, drift };
}

async function ghost(spot, dir) {
  // the traveller in front of the spot's surface, on the camera's line, or where the known spot puts him
  let player = spot.player, eye = spot.eye, heading = spot.heading ?? 0;
  if (!spot.ghost || !player) {
    const n = norm([spot.normal?.[0] ?? sub(spot.eye, spot.target)[0], 0, spot.normal?.[2] ?? sub(spot.eye, spot.target)[2]]);
    const foot = add(spot.target, mul(n, 1.3)), g = await ev(`__probe.ground(${foot[0]}, ${foot[1] + 1}, ${foot[2]})`);
    if (g === null) return { skipped: 'no ground in front of the surface' };
    player = [foot[0], g, foot[2]]; heading = Math.atan2(n[0], n[2]);
    eye = add(add(spot.target, mul(n, 5)), [0, 1.2, 0]);
  }
  await ev(`__probe.place(${JSON.stringify(player)}, ${heading})`);
  await ev(`__probe.pin(${JSON.stringify(eye)}, ${JSON.stringify(add(player, [0, 0.9, 0]))})`); await settle(700);
  const shots = {};
  const chest = await ev(`__probe.screen(${JSON.stringify(add(player, [0, 1.0, 0]))})`);
  for (const hide of [false, true]) {
    await ev(`__probe.hide(${hide})`);
    for (const d of [2, 9, 10]) { await ev(`__probe.debug(${d})`); await settle(160); shots[`${d}${hide ? '-' : '+'}`] = await grabRaw(); }
  }
  // the same masks again with no one moving: what the world's own motion changes is left out
  for (const d of [9, 10]) { await ev(`__probe.debug(${d})`); await settle(160); shots[`${d}=`] = await grabRaw(); }
  await ev(`__probe.debug(0)`); await ev(`__probe.hide(false)`);
  const P = Object.fromEntries(Object.entries(shots).map(([k, v]) => [k, decodePNG(v)]));
  const sil = L.personBlob(L.silhouette(P['2+'], P['2-']), W, H, chest.map(Math.round));
  const m = (k, pick) => L.maskOf(P[k], pick);
  const r9 = L.ghostCheck(m('9+', L.enclosurePick), m('9-', L.enclosurePick), sil, { noise: L.noiseOf(m('9-', L.enclosurePick), m('9=', L.enclosurePick)) });
  const r10 = L.ghostCheck(m('10+', L.spotPick), m('10-', L.spotPick), sil, { noise: L.noiseOf(m('10-', L.spotPick), m('10=', L.spotPick)) });
  const flagged = [...r9.flags, ...r10.flags].some((f) => !/hardly in view/.test(f));
  if (flagged) for (const k of ['9+', '9-', '10+', '10-']) writeFileSync(join(dir, `${spot.name}-ghost-d${k.replace('+', 'with').replace('-', 'without')}.png`), shots[k]);
  const pick = (r) => ({ person: r.person, mass: r.mass, biggestPale: r.biggestPale, biggestDark: r.biggestDark, paleShare: +r.paleShare.toFixed(3), darkShare: +r.darkShare.toFixed(3), flags: r.flags });
  return { enclosure: pick(r9), spot: pick(r10), flagged };
}

// a lit line this long (px at 1280 x 720) in the light term inside is flagged; 30 up to it is a picture to look at
// (the Hearth's seam before c58cbcaa: 63-152 px in its six looks; after, at most 52, its bone markers and a short
// line to check: docs/audits/visual-v1.4.md)
const LIT_LINE = 70;
async function seams(where, dir, name) {
  const g = await ev(`__probe.ground(${where[0]}, ${where[1] + 1}, ${where[2]})`);
  if (g === null) return { name, skipped: 'no floor' };
  const ceiling = await ev(`__probe.hit([${where[0]}, ${g + 1.5}, ${where[2]}], [0, 1, 0], 60)`);
  const rays = await ev(`__probe.footRays(${JSON.stringify(where)}, ${g})`);
  const slits = L.floorSlits(rays);
  // the light term looking round at the floor's edge, 6 ways
  const looks = [];
  if (ceiling) {
    await ev(`__probe.hide(true)`);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.4, f = [Math.sin(a), 0, Math.cos(a)];
      const eye = [where[0] - f[0] * 1.5, g + 1.7, where[2] - f[2] * 1.5], target = [where[0] + f[0] * 8, g + 0.2, where[2] + f[2] * 8];
      await ev(`__probe.pin(${JSON.stringify(eye)}, ${JSON.stringify(target)})`); await ev(`__probe.debug(5)`); await settle(450);
      const raw = await grabRaw(), r = L.litRidges(L.maskOf(decodePNG(raw), L.lightPick), { minRun: 30 });
      looks.push({ heading: +a.toFixed(2), longest: r.longest, px: r.px, line: r.runs[0] ?? null });
      if (r.longest >= 30 || SAVE_ALL) writeFileSync(join(dir, `${name}-light-${k}.png`), raw);
    }
    await ev(`__probe.debug(0)`); await ev(`__probe.hide(false)`);
  }
  const lit = looks.filter((l) => l.longest >= LIT_LINE), look = looks.filter((l) => l.longest >= 30 && l.longest < LIT_LINE);
  return { name, enclosed: !!ceiling, ceiling: ceiling ? +ceiling.d.toFixed(1) : null, slits, lit, look, looks, flagged: !!ceiling && (slits.length > 0 || lit.length > 0) };
}

/** Spots found in the world round some origins: walls, room corners, stairs. */
async function findSpots(origins) {
  const walls = [], corners = [], stairs = [];
  for (const [oi, o] of origins.entries()) {
    const sc = await ev(`__probe.scan(${JSON.stringify(o)})`);
    if (!sc) continue;
    const { g, hits } = sc;
    for (const h of hits) walls.push({ origin: oi, ...h });
    for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
      const c = L.cornerOf({ p: [hits[i].p[0], hits[i].p[2]], n: [hits[i].n[0], hits[i].n[2]] }, { p: [hits[j].p[0], hits[j].p[2]], n: [hits[j].n[0], hits[j].n[2]] });
      if (c && Math.hypot(c.p[0] - o[0], c.p[1] - o[2]) < 10) corners.push({ origin: oi, p: [c.p[0], g + 1, c.p[1]], n: [c.n[0], 0, c.n[1]] });
    }
    for (const { d, hs } of sc.profiles) {
      const r = L.stairRisers(hs.map((x) => (x === null ? NaN : x)));
      if (r.stairs) { const mid = r.run[Math.floor(r.run.length / 2)].i; stairs.push({ origin: oi, p: [o[0] + d[0] * mid * 0.2, hs[mid], o[2] + d[1] * mid * 0.2], n: [-d[0] * Math.sign(r.run[0].d), 0, -d[1] * Math.sign(r.run[0].d)] }); break; }
    }
  }
  return { walls, corners, stairs };
}
/** A spot's camera: in front of the surface, a little above, looking at it. */
const camFor = (p, n, kind) => { const D = kind === 'stairs' ? 7 : L.ORBIT.distance, lift = kind === 'stairs' ? 3 : L.ORBIT.lift; return { eye: [p[0] + n[0] * D, p[1] + lift, p[2] + n[2] * D], target: [p[0], p[1] + (kind === 'stairs' ? 0.5 : 0), p[2]] }; };

// ---------------------------------------------------------------- the run
const report = { root: ROOT, hour: HOUR, res: `${W}x${H}`, date: new Date().toISOString(), worlds: [] };
let firstWorld = true;
for (const world of WORLDS) for (const preset of PRESETS) {
  if (!firstWorld && REST) await sleep(REST);   // (a shared machine: rests between worlds)
  firstWorld = false;
  const dir = join(OUT, world, preset); mkdirSync(dir, { recursive: true });
  const row = { world, preset, orbit: [], ghost: [], seams: [] };
  report.worlds.push(row);
  try {
    await send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(250);
    await ev(`localStorage.clear(); localStorage.setItem('moebius.muted','1');
      localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${preset}', music: 0, effects: 0, voices: 0, volume: 0 }));
      localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] })); true`);
    errors.length = 0;
    await send('Page.navigate', { url: `${BASE}?level=${world}` });
    let up = false;
    for (let tries = 0; tries < 2 && !up; tries++) {   // (a first load may meet vite still bundling its dependencies: once more)
      if (tries) await send('Page.reload');
      for (let i = 0; i < 900 && !up; i++) { up = (await ev('!!window.__moebiusBooted && !!window.player').catch(() => false)) === true; if (!up) await sleep(100); }
    }
    if (!up) { row.error = 'never booted'; continue; }
    await sleep(2500);
    await ev(`(() => { window.sound?.setVolumes?.(0, 0); window.story?.closePage?.(); if (window.weather) { window.weather.mode = 'clear'; window.weather.intensity = 0; }
      const p = window.preset?.(); if (p) { p.dynamic = null; window.resize?.(); }
      const s = document.createElement('style'); s.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(s); return true; })()`);
    await ev(PAGE); await ev(setHour);
    // the spots: the known ones of this world, then found ones round the ways in and the benchmark views
    const spots = (KNOWN[world] ?? []).map((s) => ({ ...s, known: true }));
    const ways = await ev(`(window.level.portals ?? []).filter((p) => p.to).slice(0, ${MAXI}).map((p) => [p.to.x, p.to.y, p.to.z])`);
    if (ONLY !== 'known' && AUTO > 0) {
      const origins = [...ways, ...viewsOf(world).map((v) => v.player ?? v.target), await ev('window.player.pos.toArray()')];
      const f = await findSpots(origins);
      const chosen = [];
      if (f.stairs[0]) chosen.push({ kind: 'stairs', ...f.stairs[0] });
      const inside = (o) => o < ways.length;
      const corner = f.corners.find((c) => inside(c.origin)) ?? f.corners[0]; if (corner) chosen.push({ kind: 'corner', ...corner });
      for (const w of [...f.walls.filter((w) => inside(w.origin)), ...f.walls.filter((w) => !inside(w.origin))]) {
        if (chosen.length >= AUTO) break;
        if (chosen.some((c) => len(sub(c.p, w.p)) < 6)) continue;
        chosen.push({ kind: inside(w.origin) ? 'inner wall' : 'wall', p: w.p, n: w.n });
      }
      chosen.slice(0, AUTO).forEach((c, i) => spots.push({ name: `${c.kind.replace(' ', '-')}-${i}`, kind: c.kind, normal: c.n, ...camFor(c.p, c.n, c.kind), at: c.p.map((x) => +x.toFixed(1)) }));
    }
    for (const s of spots.filter((x) => !SPOTS.length || SPOTS.includes(x.name))) {
      // the shadow maps and the zones follow the traveller: he stands at the spot (hidden while orbiting)
      await ev(`__probe.place(${JSON.stringify(s.player ?? s.target)}, ${s.heading ?? 0})`); await settle(400);
      row.orbit.push({ name: s.name, kind: s.kind, known: !!s.known, at: s.at ?? s.target, ...(await orbit(s, dir)) });
      row.ghost.push({ name: s.name, kind: s.kind, known: !!s.known, ...(await ghost(s, dir)) });
    }
    // seams: inside every way in and the known caves
    const insides = [...spots.filter((s) => s.inside).map((s) => ({ name: s.name, at: s.player })), ...ways.map((w, i) => ({ name: `inside-${i}`, at: w }))];
    for (const where of SKIP.includes('seams') ? [] : insides.filter((x) => !SPOTS.length || SPOTS.includes(x.name))) {
      await ev(`__probe.place(${JSON.stringify(where.at)}, 0)`); await settle(600);
      row.seams.push(await seams(where.at, dir, where.name));
    }
    row.errors = errors.slice(0, 4);
  } catch (e) { row.error = String(e).slice(0, 300); }
  const fl = (l) => l.filter((x) => x.flagged).map((x) => x.name);
  console.log(`${world.padEnd(12)} ${preset.padEnd(9)} orbit ${row.orbit.length} (flagged: ${fl(row.orbit).join(', ') || '-'}) · ghost ${row.ghost.length} (flagged: ${fl(row.ghost).join(', ') || '-'}) · seams ${row.seams.length} (flagged: ${fl(row.seams).join(', ') || '-'})${row.error ? ` · ERROR ${row.error}` : ''}`);
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`report.json in ${OUT}`);
ws.close(); proc.kill('SIGTERM'); await sleep(1000); rmSync(profile, { recursive: true, force: true });
await server.close();
process.exit(0);
