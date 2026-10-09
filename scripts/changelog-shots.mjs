// Before / after pictures for the interactive changelog (changelog.html, docs/systems/changelog.md).
// Each picture is described in src/changelog-media.js: the commit that made the change and the view
// that shows it. For every commit needed (a shot's `commit`, and its parent for the "before"), this
// extracts the commit into a folder of its own (git archive: no worktree to prune), links this
// checkout's node_modules into it, serves it with Vite (its own cache, so the author's dev server is
// never touched), drives a headless muted Chrome on the GPU to each view with the same hour, weather,
// preset, size and camera for both, and writes changelog-media/<version>/<name>-before|after.webp
// (cwebp). The folder is deleted as soon as its shots are taken: one commit on disk at a time.
//
//   node scripts/changelog-shots.mjs                     every shot whose pictures are missing
//   node scripts/changelog-shots.mjs --only 0.79/cloak-arms,0.78/stalls   (version/name, or a name)
//   node scripts/changelog-shots.mjs --version 0.77,0.76 [--force] [--keep-png] [--dry]
// PORT (default 5430) is Vite's, CDP (default PORT+1) Chrome's debugging port; TMP the work folder (default $TMPDIR).
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statfsSync, symlinkSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANGELOG_MEDIA, MEDIA_DIR, shotFiles } from '../src/changelog-media.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.PORT ?? 5430), CDP = Number(process.env.CDP ?? PORT + 1);
const MIN_FREE = 6 * 2 ** 30;   // never extract a commit with less than 6 GB free on the disk
/** The WebP the page shows: 1280 px wide at most, quality 72 (a pair is about 100–200 KB). */
export const WEBP = { width: 1280, quality: 72 };
export const DEFAULT_VIEW = { size: [1280, 720], quality: 'high', hour: 10, weather: 'clear', wait: 4000 };

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name) => args.includes(`--${name}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();

/** Every shot of src/changelog-media.js, with its version, its commits and its files. */
export function allShots(media = CHANGELOG_MEDIA) {
  const out = [];
  for (const [v, lines] of Object.entries(media)) for (const line of lines) for (const s of line.shots ?? []) {
    if (!s.view) continue;   // (a picture made by hand: `from` says where it came from)
    out.push({ v, ...s, key: `${v}/${s.name}`, files: shotFiles(v, s) });
  }
  return out;
}

function freeBytes(path = tmpdir()) { const s = statfsSync(path); return s.bavail * s.bsize; }

/** One commit's tree in its own folder, ready to serve. */
function extract(sha, work) {
  if (freeBytes(work) < MIN_FREE) throw new Error(`less than 6 GB free on the disk: not extracting ${sha}`);
  const dir = join(work, sha.slice(0, 10));
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  execFileSync('sh', ['-c', `git archive ${sha} | tar -x -C "${dir}"`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], maxBuffer: 1 << 30 });
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
  return dir;
}

async function serve(dir, { prod = false } = {}) {
  const { createServer } = await import('vite');
  const server = await createServer({
    // (prod: import.meta.env.DEV false, as in a player's build: the author's dev-only entries hidden, src/dev-gate.js)
    ...(prod ? { define: { 'import.meta.env.DEV': 'false' } } : {}),
    root: dir, configFile: existsSync(join(dir, 'vite.config.js')) ? join(dir, 'vite.config.js') : false,
    cacheDir: join(dir, '.vite-cache'), logLevel: 'error', clearScreen: false,
    server: { port: PORT, strictPort: true, host: '127.0.0.1', fs: { strict: false }, hmr: false, watch: null },
  });
  await server.listen();
  return server;
}

// ------------------------------------------------------------------ Chrome over its debugging protocol
async function chrome() {
  const profile = mkdtempSync(join(tmpdir(), 'memento-shots-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check',
    '--disable-gpu-shader-disk-cache', '--disk-cache-size=1', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--force-device-scale-factor=1', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
  let tabs;
  for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
  if (!tabs) throw new Error('Chrome did not start');
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const waits = new Map(); const errors = [];
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
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const close = async () => {   // (the profile goes with it: Chrome's caches are hundreds of MB)
    try { ws.close(); } catch { /* gone */ }
    const gone = new Promise((r) => proc.once('exit', r));
    proc.kill('SIGTERM');
    await Promise.race([gone, sleep(5000)]);
    rmSync(profile, { recursive: true, force: true });
  };
  return { send, ev, errors, close };
}

/** What the page is set to before it loads: silent, the preset, a save past the prologue. */
const storage = (v) => `localStorage.clear();
  localStorage.setItem('moebius.muted', '1');
  localStorage.setItem('moebius.game.v1', JSON.stringify(${JSON.stringify(v.save ?? { flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] })}));
  localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${v.quality}', showFps: false, music: 0, effects: 0, voices: 0, ...${JSON.stringify(v.settings ?? {})} }));
  ${v.storage ?? ''}`;

/** In the page once the world is up: the hour, the weather, a fixed resolution, the HUD hidden, the camera pinned. */
const CONDITIONS = (v) => `(() => {
  const { THREE, camera } = window;
  window.sound?.setVolumes?.(0, 0);
  const p = window.preset?.(); if (p) p.dynamic = null;
  if (window.quality) { window.quality.renderScale = ${v.scale ?? 1}; window.resize?.(); }
  if (window.sky && ${v.hour !== null}) { window.sky.hour = ${v.hour}; window.sky.speed = 0; window.updateSky?.(); }
  if (window.weather && '${v.weather}') { window.weather.mode = '${v.weather}'; window.weather.intensity = 0; }
  window.story?.closePage?.();
  if (${!v.hud}) {
    const hide = document.createElement('style');
    hide.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }';
    document.head.appendChild(hide);
  }
  if (${!!v.eye}) {
    const up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
    const e = new THREE.Vector3(...${JSON.stringify(v.eye ?? [0, 0, 0])}), t = new THREE.Vector3(...${JSON.stringify(v.target ?? [0, 0, 1])});
    const pin = { eye: e, q: new THREE.Quaternion().setFromRotationMatrix(m.lookAt(e, t, up)), fov: ${v.fov ?? 55} };
    const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
    camera.updateMatrixWorld = function (force) { this.position.copy(pin.eye); this.quaternion.copy(pin.q); if (this.fov !== pin.fov) { this.fov = pin.fov; this.updateProjectionMatrix(); } return base.call(this, force); };
  }
  if (${!!v.player}) {
    window.player.teleport?.(new THREE.Vector3(...${JSON.stringify(v.player ?? [0, 0, 0])}), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
    window.player.heading = ${v.heading ?? 0};
  }
  return true;
})()`;

async function shoot(c, base, v, file) {
  const [w, h] = v.size;
  await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await c.send('Page.navigate', { url: `${base}manifest.webmanifest` }); await sleep(300);
  await c.ev(`${storage(v)}; true`);
  const page = v.page ?? '';
  // (a References view: opened by its id, so the level builds its world; a commit from before the worlds were split builds them all)
  const query = v.ref ? `?level=references&view=${encodeURIComponent(v.ref)}${v.query ? `&${v.query}` : ''}` : v.level ? `?level=${v.level}${v.query ? `&${v.query}` : ''}` : (v.query ? `?${v.query}` : '');
  if (page.startsWith('studio')) await c.send('Emulation.setDeviceMetricsOverride', { width: w + 340, height: h, deviceScaleFactor: 1, mobile: false });   // (the studio's panel beside the view)
  c.errors.length = 0;
  await c.send('Page.navigate', { url: `${base}${page}${query}` });
  const ready = v.ready ?? (page.startsWith('studio') ? '!!window.studio && !!window.studio.people?.()' : page ? 'document.readyState === "complete"' : '!!window.__moebiusBooted && !!window.player && !!window.renderer');
  let up = false;
  for (let t = 0; t < 4 * 300 && !up; t++) { try { up = !!(await c.ev(`!!(${ready})`)); } catch { /* loading */ } if (!up) await sleep(250); }
  if (!up) throw new Error(`the page never came up (${c.errors.slice(-1)[0] ?? 'no error'})`);
  await sleep(v.settle ?? 2500);
  if (!page) await c.ev(CONDITIONS(v));
  else if (page.startsWith('studio')) { v.clipTo ??= '#view'; await c.ev(`(() => { for (const e of document.querySelectorAll('#view > :not(canvas)')) e.style.visibility = 'hidden'; return true; })()`); }
  if (v.ref) {
    await c.ev(`(() => { const v = window.level.views.find((x) => x.def.id === ${JSON.stringify(v.ref)}); if (!v) throw new Error('no view ${v.ref}'); window.level.goTo(v.i); return v.i; })()`);
    await sleep(3500);
  }
  if (v.setup) await c.ev(`(async () => { ${v.setup} ; return true; })()`);
  await sleep(v.wait);
  mkdirSync(dirname(file), { recursive: true });
  if (v.people) { writeFileSync(file, Buffer.from((await c.ev(PEOPLE(v))).split(',')[1], 'base64')); return; }
  let clip = v.clip;
  if (v.clipTo) { const b = await c.ev(`(() => { const r = document.querySelector(${JSON.stringify(v.clipTo)}).getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()`); clip = b; }
  const r = await c.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: 1 } } : {}) });
  writeFileSync(file, Buffer.from(r.data, 'base64'));
}

/**
 * People seen close in the running game (view.people: [{ id, yaw, dist, height, lift }], id a story person's
 * or 'traveller'; yaw 0 from in front, in radians round them), each drawn by the game's own captureView
 * and laid side by side in one picture of view.size.
 */
const PEOPLE = (v) => `(async () => {
  const V = window.THREE.Vector3, list = ${JSON.stringify(v.people)}, [W, H] = ${JSON.stringify(v.size)};
  const w = Math.round(W / list.length), out = [];
  const find = (id) => id === 'traveller' ? { pos: window.player.pos, heading: window.player.heading, object: window.player.object } : window.npcs.find((q) => q.def?.id === id);
  let near = null;
  for (const p of list) {
    const n = find(p.id);
    if (!n) throw new Error('no ' + p.id + ' among ' + window.npcs.map((q) => q.def?.id).filter(Boolean).join(','));
    if (p.id !== 'traveller' && near !== p.id) {   // the traveller a few steps behind each (they are drawn and their cloth simulates near), out of the pictures
      const h = n.heading ?? 0;
      window.player.pos.copy(n.pos).addScaledVector(new V(Math.sin(h), 0, Math.cos(h)), -4);
      near = p.id;
      await new Promise((r) => setTimeout(r, 2500));
    }
    // (from in front: the way the body faces, its object's +z, turned by yaw)
    const f = new V(); n.object.getWorldDirection(f);
    const h = Math.atan2(f.x, f.z) + (p.yaw ?? 0), s = n.object?.scale?.y ?? 1;
    const look = n.pos.clone().add(new V(0, (p.height ?? 0.95) * s, 0));
    const eye = look.clone().addScaledVector(new V(Math.sin(h), 0, Math.cos(h)), p.dist ?? 3.2).add(new V(0, p.lift ?? 0.3, 0));
    out.push(window.captureView(eye, look, w, H));
  }
  const cv = document.createElement('canvas'); cv.width = w * list.length; cv.height = H;
  const g = cv.getContext('2d');
  for (let i = 0; i < out.length; i++) { const im = new Image(); im.src = out[i]; await im.decode(); g.drawImage(im, i * w, 0, w, H); }
  return cv.toDataURL('image/png');
})()`;

export function toWebp(png, webp, { width = WEBP.width, quality = WEBP.quality } = {}) {
  mkdirSync(dirname(webp), { recursive: true });
  execFileSync('cwebp', ['-quiet', '-q', String(quality), '-m', '6', '-resize', String(width), '0', png, '-o', webp]);
  return statSync(webp).size;
}

async function main() {
  const only = arg('only')?.split(',');
  const versions = arg('version')?.split(',');
  let shots = allShots().filter((s) => (!versions || versions.includes(s.v)) && (!only || only.includes(s.key) || only.includes(s.name)));
  if (!flag('force')) shots = shots.filter((s) => Object.values(s.files).some((f) => f && !existsSync(join(ROOT, f))));
  // each picture and the commit it is taken at (the before: the commit's first parent, unless given)
  const jobs = new Map();
  for (const s of shots) {
    const after = git('rev-parse', `${s.commit}^{commit}`);
    const before = git('rev-parse', `${s.before ?? `${s.commit}^`}^{commit}`);
    for (const [sha, side] of [[before, 'before'], [after, 'after']].filter(([, side]) => s.files[side])) {
      const key = s.view.prod ? `${sha}+prod` : sha;   // (a view as a player's build sees it: a server of its own)
      if (!jobs.has(key)) jobs.set(key, []);
      jobs.get(key).push({ s, side });
    }
  }
  console.log(`${shots.length} shots at ${jobs.size} commits`);
  if (flag('dry')) { for (const [sha, list] of jobs) console.log(sha.slice(0, 9), list.map((j) => `${j.s.key}:${j.side}`).join(' ')); return; }
  const work = mkdtempSync(join(process.env.TMP ?? tmpdir(), 'memento-shots-'));
  const pngs = join(work, 'png');
  const c = await chrome();
  let failed = 0;
  try {
    for (const [key, list] of jobs) {
      const t0 = Date.now(), [sha, prod] = key.split('+');
      const dir = extract(sha, work);
      const server = await serve(dir, { prod: !!prod });
      try {
        for (const { s, side } of list) {
          const v = { ...DEFAULT_VIEW, ...s.view, ...(s.view[side] ?? {}) };
          const png = join(pngs, `${s.key}-${side}.png`);
          try {
            await shoot(c, `http://127.0.0.1:${PORT}/`, v, png);
            const size = toWebp(png, join(ROOT, s.files[side]), s.webp);
            console.log(`  ${s.key} ${side} at ${sha.slice(0, 9)}: ${(size / 1024).toFixed(0)} KB`);
          } catch (e) { failed++; console.error(`  ${s.key} ${side} at ${sha.slice(0, 9)} FAILED: ${e.message}`); }
        }
      } finally {
        await server.close();
        rmSync(dir, { recursive: true, force: true });
      }
      console.log(`${sha.slice(0, 9)} done in ${((Date.now() - t0) / 1000).toFixed(0)} s (${(freeBytes(work) / 2 ** 30).toFixed(1)} GB free)`);
    }
  } finally {
    await c.close();
    if (!flag('keep-png')) rmSync(work, { recursive: true, force: true }); else console.log(`PNGs kept in ${pngs}`);
  }
  if (failed) { console.error(`${failed} pictures failed`); process.exitCode = 1; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
// (scripts/world-thumbs.mjs takes the worlds list's pictures with the same Chrome, server and views)
export { serve, chrome, shoot };
export { MEDIA_DIR };
