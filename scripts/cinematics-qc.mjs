// Quality control for the cinematics (docs/systems/cinematics-qc.md, .claude/skills/cinematics-qc).
// Plays every cinematic of the review page's list (src/cinematics-page/catalog.js) in a headless,
// muted Chrome on the GPU against a Vite server of this checkout (its own port: never 5173), the
// same way the review page does (index.html?level=…&cinematicReview=<id>: temporary progress, the
// real directors). While each plays, a sampler in the page records every frame: whether a scene is
// playing, the camera, the HUD pieces that show, the letterbox, the skip tag, the subtitle, whether
// the lens is inside a solid or grazing one, whether the traveller is hidden behind a solid while in
// frame, the master bus's loudness. A screenshot is taken every --every seconds; N of them are kept
// (evenly spread) as WebP in <out>/<id>/. Console errors and exceptions are logged per cinematic.
//
//   node scripts/cinematics-qc.mjs                               every cinematic (the trailer: frames only)
//   node scripts/cinematics-qc.mjs --only desert.flow,box.desert.star   (ids, or a prefix ending in '*')
//   node scripts/cinematics-qc.mjs --group "World moments" --frames 8 --every 1
//   node scripts/cinematics-qc.mjs --skip          also test the skip: hold Esc 1.2 s in, it must end within 3 s
//   node scripts/cinematics-qc.mjs --size 844x390 --mobile        phone landscape (touch emulated)
//   node scripts/cinematics-qc.mjs --out output/cinematics-qc/run1 --quality high --rest 5   (s idle between cinematics)
// PORT (default 5308) is Vite's; Chrome picks its own debugging port. Writes <out>/report.json and report.md.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ------------------------------------------------------------------ pure logic (tests/cinematics-qc.test.js)

/** The catalog entries asked for: --only ids (a trailing '*' is a prefix), --group a collection name. */
export function pickEntries(catalog, { only = null, group = null } = {}) {
  return catalog.filter((e) => (!group || e.group === group)
    && (!only || only.some((o) => (o.endsWith('*') ? e.id.startsWith(o.slice(0, -1)) : e.id === o))));
}

/** How long to wait for one to finish (s): the prologue and homecomings are long and partly interactive. */
export function timeoutFor(entry) {
  if (entry.id === 'prologue') return 150;
  if (entry.id.startsWith('homecoming.')) return 120;
  if (entry.id.startsWith('call.')) return 90;
  if (entry.id.startsWith('arrival.') || entry.id === 'takeoff') return 45;
  return 40;
}

/** The ship's scenes skip on a hold of Esc / B: their tag shows once you press (src/ship/cinema.js holdToSkip). */
export const holdsToSkip = (entry) => /^(call\.|arrival\.|takeoff|homecoming\.|prologue)/.test(entry?.id ?? '');

/** n indices spread evenly over 0..count-1 (first and last included). */
export function spread(count, n) {
  if (count <= 0 || n <= 0) return [];
  if (n >= count) return [...Array(count).keys()];
  if (n === 1) return [Math.floor((count - 1) / 2)];
  const out = new Set();
  for (let i = 0; i < n; i++) out.add(Math.round((i * (count - 1)) / (n - 1)));
  return [...out];
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Angle between two quaternions [x, y, z, w], in degrees. */
export function quatAngle(a, b) {
  const d = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
  return (2 * Math.acos(d) * 180) / Math.PI;
}

/**
 * What the frames say. samples: [{ t (s), playing, cam [x,y,z], q [x,y,z,w], fov, hud [ids showing],
 * bars, skip, sub, embedded, graze (m to the nearest surface, or null), hidden (traveller in frame
 * behind a solid), db (master RMS dBFS, or null), player [x,y,z], menu }].
 * Returns the cinematic's span and its findings (all numbers, for the report and the score).
 */
export function analyse(samples, { cutMove = 1.5, cutTurn = 25, popMove = 0.3, holdMove = 0.02, holdTurn = 0.3 } = {}) {
  const play = samples.filter((s) => s.playing);
  const out = {
    played: play.length > 0, duration: 0, frames: play.length, cuts: 0, shots: 0, pops: [], longestHold: 0,
    hudLeaks: {}, barsShare: 0, skipShown: false, subtitles: 0, embedded: 0, graze: 0, hidden: 0,
    peakDb: null, releaseJump: 0, releaseTurn: 0, playerJump: 0, endedCleanly: false, menuOpened: false,
  };
  if (!play.length) return out;
  const i0 = samples.indexOf(play[0]), i1 = samples.lastIndexOf(play.at(-1));
  out.duration = play.at(-1).t - play[0].t;
  out.endedCleanly = i1 < samples.length - 1 && !samples.slice(i1 + 1).some((s) => s.playing);
  let holdStart = play[0].t, bars = 0;
  const subs = new Set();
  for (let i = i0; i <= i1; i++) {
    const s = samples[i];
    if (!s.playing) continue;
    for (const id of s.hud ?? []) out.hudLeaks[id] = (out.hudLeaks[id] ?? 0) + 1;
    if (s.bars) bars++;
    if (s.skip) out.skipShown = true;
    if (s.sub) subs.add(s.sub);
    if (s.embedded) out.embedded++;
    if (s.graze != null && s.graze < 0.12) out.graze++;
    if (s.hidden) out.hidden++;
    if (s.menu) out.menuOpened = true;
    if (s.db != null) out.peakDb = Math.max(out.peakDb ?? -Infinity, s.db);
    const p = samples[i - 1];
    if (i > i0 && p?.playing) {
      const move = dist(p.cam, s.cam), turn = quatAngle(p.q, s.q), dt = Math.max(1e-3, s.t - p.t);
      if (move > cutMove || turn > cutTurn) { out.cuts++; holdStart = s.t; }
      else {
        // a small jump in one frame between two quiet ones: a hitch, not a cut
        const pp = samples[i - 2], n = samples[i + 1];
        const quiet = (a, b) => a && b && a.playing && b.playing && dist(a.cam, b.cam) < popMove / 4;
        if (move > popMove && move / dt > 12 && quiet(pp, p) && quiet(s, n)) out.pops.push(+(s.t - play[0].t).toFixed(2));
        if (move > holdMove || turn > holdTurn || Math.abs(s.fov - p.fov) > 0.05) holdStart = s.t;
      }
      out.longestHold = Math.max(out.longestHold, s.t - holdStart);
    }
  }
  out.shots = out.cuts + 1;
  out.barsShare = bars / play.length;
  out.subtitles = subs.size;
  const after = samples[i1 + 1], last = samples[i1];
  if (after) {
    out.releaseJump = dist(last.cam, after.cam);
    out.releaseTurn = quatAngle(last.q, after.q);
    if (last.player && after.player) out.playerJump = dist(last.player, after.player);
  }
  return out;
}

/** Frames that read as empty: little ink (mean gradient of the luminance) inside the letterbox. */
export function inkDensity({ width, height, channels, pixels }, { bar = 0.11, step = 2 } = {}) {
  const y0 = Math.ceil(height * bar) + 1, y1 = Math.floor(height * (1 - bar)) - 1;
  const lum = (x, y) => { const o = (y * width + x) * channels; return 0.299 * pixels[o] + 0.587 * pixels[o + 1] + 0.114 * pixels[o + 2]; };
  let sum = 0, n = 0, edges = 0;
  for (let y = y0; y < y1 - step; y += step) for (let x = 0; x < width - step; x += step) {
    const g = Math.abs(lum(x + step, y) - lum(x, y)) + Math.abs(lum(x, y + step) - lum(x, y));
    sum += g; n++; if (g > 40) edges++;
  }
  return n ? { gradient: sum / n, edges: edges / n } : { gradient: 0, edges: 0 };
}

/**
 * The technical score, 0–5, and why points went: the start, errors, the HUD, the lens, the
 * traveller hidden, pops, the skip, the return, loudness, empty frames.
 */
export function scoreTechnical(a, { errors = [], status = '', skip = null, hold = false, emptyFrames = 0, frames = 0, loudDb = -6 } = {}) {
  const why = [];
  let s = 5;
  const lose = (n, reason) => { s -= n; why.push(reason); };
  if (!a.played) return { score: 0, why: [status.startsWith('Could not') ? status : 'never played'] };
  if (errors.length) lose(Math.min(2, errors.length), `${errors.length} console error${errors.length > 1 ? 's' : ''}`);
  const leaks = Object.entries(a.hudLeaks).filter(([, n]) => n / Math.max(1, a.frames) > 0.1).map(([id]) => id);
  if (leaks.length) lose(1, `HUD showing: ${leaks.join(', ')}`);
  if (a.barsShare < 0.5) lose(0.5, 'no letterbox');
  if (a.embedded / Math.max(1, a.frames) > 0.03) lose(1.5, `lens inside geometry (${a.embedded} frames)`);
  else if (a.graze / Math.max(1, a.frames) > 0.05) lose(0.5, `lens grazing a surface (${a.graze} frames)`);
  if (a.hidden / Math.max(1, a.frames) > 0.15) lose(1, `traveller behind a solid (${a.hidden} frames)`);
  if (a.pops.length) lose(0.5, `pops at ${a.pops.slice(0, 4).join(', ')} s`);
  if (!a.skipShown && !hold && !skip?.ok) lose(0.5, 'no skip tag');
  if (skip && !skip.ok) lose(1, `skip failed (${skip.why})`);
  if (!a.endedCleanly) lose(1, 'did not hand back control');
  else if (a.playerJump > 1.5) lose(0.5, `traveller moved ${a.playerJump.toFixed(1)} m on release`);
  if (a.menuOpened) lose(0.5, 'a menu opened during it');
  if (a.peakDb != null && a.peakDb > loudDb) lose(0.5, `loud (${a.peakDb.toFixed(1)} dBFS)`);
  if (frames && emptyFrames / frames > 0.25) lose(0.5, `${emptyFrames}/${frames} frames nearly empty`);
  return { score: Math.max(0, Math.round(s * 2) / 2), why };
}

/** The report's table, Markdown. results: [{ entry, analysis, tech, errors, frames, skip }]. */
export function formatReport(results) {
  const rows = results.map(({ entry, analysis: a, tech, errors, skip }) => [
    entry.id, entry.group, a.played ? `${a.duration.toFixed(1)} s` : '—', a.played ? a.shots : '—',
    a.played ? `${a.longestHold.toFixed(1)} s` : '—', tech.score, skip ? (skip.ok ? `ok ${skip.secs.toFixed(1)} s` : 'FAIL') : '',
    a.peakDb == null ? '' : a.peakDb.toFixed(0), (errors?.length ?? 0), tech.why.join('; ') || 'ok',
  ].join(' | '));
  return ['| Cinematic | Group | Length | Shots | Longest hold | Tech /5 | Skip | Peak dBFS | Errors | Findings |',
    '|---|---|---|---|---|---|---|---|---|---|', ...rows.map((r) => `| ${r} |`)].join('\n');
}

// ------------------------------------------------------------------ the page's sampler (string: evaluated in the game)

/** Installed once the world is up; records a sample every frame into window.__qc. */
export const SAMPLER = `(() => {
  if (window.__qc) return true;
  const { THREE, camera, physics, player, ship, storyRt, boxes, sound, menu } = window;
  const HUD = ['cue', 'fps', 'gear', 'touch', 'tool', 'health', 'stamina', 'prompt', 'controller-hint', 'toast', 'lock-reticle', 'gadget-chip', 'gadget-reticle', 'gadget-wheel'];
  const visible = (e) => { if (!e || !e.isConnected) return false; for (let p = e; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight; };
  const AX = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map((a) => new THREE.Vector3(...a));
  const head = new THREE.Vector3(), dir = new THREE.Vector3(), frustum = new THREE.Frustum(), m = new THREE.Matrix4();
  const buf = new Float32Array(2048);
  const qc = window.__qc = { samples: [], t0: performance.now(), frame: 0 };
  // sound on (Chrome is muted): the master meter reads the real mix
  // (re-asserted: the review runtime turns the volumes down once the world is up)
  const loud = () => { try { sound.muted = false; if (sound.musicVol !== 0.8) { sound.setVolumes(0.8, 1); sound.setVoices(0.8); } sound.start(); if (sound.master && sound.master.gain.value < 0.5) sound.master.gain.value = sound.masterLevel(); qc.audio = sound.ctx?.state ?? 'none'; } catch (e) { qc.audio = String(e); } };
  loud();
  const playing = window.__qcPlaying = () => !!(ship?.playing || storyRt?.moments?.playing || storyRt?.world?.busy?.() || boxes?.busy?.());   // (a conversation after it is not the cinematic)
  const tick = () => {
    requestAnimationFrame(tick);
    const f = qc.frame++;
    if (f % 30 === 0) loud();
    const cam = camera.getWorldPosition(new THREE.Vector3()), q = camera.getWorldQuaternion(new THREE.Quaternion());
    const s = { t: (performance.now() - qc.t0) / 1000, playing: playing(), cam: cam.toArray().map((v) => +v.toFixed(3)), q: q.toArray().map((v) => +v.toFixed(4)), fov: +camera.fov.toFixed(2),
      player: player?.pos ? player.pos.toArray().map((v) => +v.toFixed(2)) : null, menu: !!(menu?.open) };
    if (s.playing || f % 10 === 0) {
      s.hud = HUD.filter((id) => visible(document.getElementById(id)));
      s.bars = document.body.classList.contains('cine-on');
      s.skip = !!document.querySelector('#cine .skip.show, #boxscene.on .skip');
      s.sub = document.querySelector('#cine .sub.show span')?.textContent ?? '';
      if (physics && f % 3 === 0) {
        try {
          s.embedded = physics.embedded(cam);
          let g = Infinity; for (const d of AX) { const h = physics.rayHit(cam, d, 1); if (h && h.front) g = Math.min(g, h.distance); }
          s.graze = g === Infinity ? null : +g.toFixed(3);
          const base = physics.base?.heightAt?.(cam.x, cam.z); if (base != null && cam.y < base - 0.05 && Math.abs(physics.up?.y ?? 1) > 0.9) s.embedded = true;
          if (player?.pos) {
            head.copy(player.pos).addScaledVector(player.up ?? new THREE.Vector3(0, 1, 0), 1.5);
            frustum.setFromProjectionMatrix(m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
            const d = cam.distanceTo(head);
            if (frustum.containsPoint(head) && d < 18 && d > 0.5) { const h = physics.rayHit(cam, dir.copy(head).sub(cam).normalize(), d - 0.6); s.hidden = !!(h && h.distance > 0.3); }
          }
        } catch {}
      }
      const an = sound?.meters?.master;
      if (an) { an.getFloatTimeDomainData(buf); let e = 0; for (const v of buf) e += v * v; const r = Math.sqrt(e / buf.length); s.db = r > 1e-5 ? +(20 * Math.log10(r)).toFixed(1) : -100; }
    }
    qc.samples.push(s);
    if (qc.samples.length > 20000) qc.samples.splice(0, 5000);
  };
  requestAnimationFrame(tick);
  return true;
})()`;

// ------------------------------------------------------------------ the run (node scripts/cinematics-qc.mjs)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function chrome({ size = [1280, 720], mobile = false } = {}) {
  const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const profile = mkdtempSync(join(tmpdir(), 'hiraeth-cineqc-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check', '--disable-gpu-shader-disk-cache', '--disk-cache-size=1',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--force-device-scale-factor=1', `--window-size=${size[0]},${size[1]}`, 'about:blank'], { stdio: 'ignore' });
  // (port 0: Chrome picks a free one and writes it in the profile, so a stray Chrome on a fixed port is never driven by mistake)
  let tabs;
  for (let i = 0; i < 80 && !tabs; i++) {
    try { const cdp = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; tabs = await (await fetch(`http://127.0.0.1:${cdp}/json`)).json(); } catch { await sleep(250); }
  }
  if (!tabs) throw new Error('Chrome did not start');
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const waits = new Map(); const errors = [];
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waits.has(d.id)) { const [res, rej] = waits.get(d.id); waits.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails?.exception?.description?.split('\n')[0] ?? d.params.exceptionDetails?.text ?? 'exception');
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').split('\n')[0]);
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon|404/.test(d.params.entry.text)) errors.push(d.params.entry.text.split('\n')[0]);
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waits.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${expression.slice(0, 80)}…: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: size[0], height: size[1], deviceScaleFactor: 1, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const close = async () => {
    try { ws.close(); } catch { /* gone */ }
    const gone = new Promise((r) => proc.once('exit', r));
    proc.kill('SIGTERM'); await Promise.race([gone, sleep(5000)]);
    rmSync(profile, { recursive: true, force: true });
  };
  return { send, ev, errors, close };
}

const pressEnter = async (c) => { for (const type of ['keyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: type === 'keyDown' ? '\r' : undefined }); };
const key = (c, type) => c.send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });

async function playOne(c, base, entry, o) {
  const size = o.size;
  const { decodePNG } = await import('./png.mjs');
  const { reviewURL } = await import('../src/cinematics-page/catalog.js');
  const dir = join(o.out, entry.id);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  await c.send('Page.navigate', { url: `${base}manifest.webmanifest` }); await sleep(200);
  await c.ev(`localStorage.clear(); localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${o.quality}', showFps: false })); true`);
  c.errors.length = 0;
  const t0 = Date.now();
  const shots = [];
  const grab = async (label) => {
    const r = await c.send('Page.captureScreenshot', { format: 'png' });
    const png = Buffer.from(r.data, 'base64'), file = join(dir, `${String(shots.length).padStart(2, '0')}-${label}.png`);
    writeFileSync(file, png);
    let ink = null; try { ink = inkDensity(decodePNG(png)); } catch { /* an odd PNG */ }
    shots.push({ file, label, ink });
  };
  if (entry.id === 'trailer') {
    await c.send('Page.navigate', { url: `${base}trailer.html` });
    let up = false; for (let i = 0; i < 240 && !up; i++) { try { up = await c.ev('!!window.trailer?.draw'); } catch { /* loading */ } if (!up) await sleep(250); }
    if (!up) return { entry, status: 'trailer never came up', analysis: analyse([]), errors: [...c.errors], shots: [] };
    const dur = await c.ev('window.trailer.duration');
    for (const k of spread(o.frames * 3, o.frames)) { await c.ev(`window.trailer.draw(${(dur * k) / (o.frames * 3 - 1)}); true`); await sleep(400); await grab(`t${Math.round((dur * k) / (o.frames * 3 - 1))}`); }
    return { entry, status: 'frames only (scrubbed)', analysis: { ...analyse([]), played: true, duration: dur, skipShown: true, endedCleanly: true, barsShare: 1 }, errors: [...c.errors], shots, manual: true };
  }
  await c.send('Page.navigate', { url: base + reviewURL(entry).replace(/^\.\//, '') });
  let up = false;
  for (let i = 0; i < 4 * 180 && !up; i++) { try { up = await c.ev('!!window.__moebiusBooted && !!window.camera && !!window.ship'); } catch { /* loading */ } if (!up) await sleep(250); }
  if (!up) return { entry, status: `never came up (${c.errors.at(-1) ?? 'no error'})`, analysis: analyse([]), errors: [...c.errors], shots: [] };
  await c.ev(SAMPLER);
  const limit = timeoutFor(entry) * 1000, every = o.every * 1000;
  let started = null, ended = null, next = 0, skip = null, status = '', nextPress = null;
  for (let t = Date.now(); Date.now() - t < limit + 30000;) {
    const st = await c.ev(`({ playing: !!window.__qcPlaying?.(), card: !!document.querySelector('#boxscene.card'), status: window.cinematicReview?.status ?? '', loading: !!document.getElementById('loading') })`);
    status = st.status;
    if (st.playing && !started) { started = Date.now(); next = 0; }
    if (started && !ended) {
      if (Date.now() - started >= next) { next += every; await grab(`${((Date.now() - started) / 1000).toFixed(1)}s`); }
      if (st.card) await c.ev('window.boxes.skip(); true');   // (the box's card waits for a press)
      // (the homecomings and the prologue wait on a choice now and then, the cargo check: confirm it, as a player would)
      if (/^(prologue|homecoming\.)/.test(entry.id) && Date.now() - started > (nextPress ??= 6000)) { nextPress += 6000; await pressEnter(c); }
      if (o.skip && !skip && Date.now() - started > 1200) {
        const k0 = Date.now(); await key(c, 'keyDown'); await sleep(1600); await key(c, 'keyUp');
        let done = false; for (let i = 0; i < 30 && !done; i++) { done = !(await c.ev('!!window.__qcPlaying?.()')); if (!done) { if (await c.ev("!!document.querySelector('#boxscene.card')")) await c.ev('window.boxes.skip(); true'); await sleep(100); } }
        const secs = (Date.now() - k0) / 1000, menu = await c.ev('!!window.menu?.open');
        skip = { ok: done && secs <= 4.6 && !menu, secs, why: !done ? 'still playing' : menu ? 'menu opened' : secs > 4.6 ? 'slow' : '' };
      }
      if (!st.playing) { ended = Date.now(); await sleep(1500); await grab('after'); break; }
      if (Date.now() - started > limit) { status += ' · timed out'; break; }
    } else if (!started && (Date.now() - t > 30000 || status.startsWith('Could not'))) break;
    await sleep(80);
  }
  const samples = await c.ev('window.__qc?.samples ?? []'), audio = await c.ev('window.__qc?.audio ?? null');
  const analysis = analyse(samples);
  // the frames while it played (and a second either side), to find which shot a finding is in
  const first = samples.findIndex((x) => x.playing), last = samples.findLastIndex((x) => x.playing);
  if (first >= 0) writeFileSync(join(dir, 'samples.json'), JSON.stringify(samples.slice(Math.max(0, first - 60), last + 60).map((x) => ({ ...x, t: +(x.t - samples[first].t).toFixed(3) }))));
  // keep N evenly spread frames (and the one after), as WebP when cwebp is there
  const during = shots.filter((s) => s.label !== 'after'), keep = new Set(spread(during.length, o.frames).map((i) => during[i]));
  for (const s of shots) if (s.label === 'after') keep.add(s);
  const emptyFrames = during.filter((s) => s.ink && s.ink.gradient < o.emptyInk).length;
  const kept = [];
  for (const s of shots) {
    if (!keep.has(s)) { rmSync(s.file, { force: true }); continue; }
    let file = s.file;
    try { const webp = s.file.replace(/\.png$/, '.webp'); execFileSync('cwebp', ['-quiet', '-q', '70', '-resize', '960', '0', s.file, '-o', webp]); rmSync(s.file); file = webp; } catch { /* no cwebp: the PNG stays */ }
    kept.push({ file: file.slice(o.out.length + 1), label: s.label, ink: s.ink && +s.ink.gradient.toFixed(1) });
  }
  // one picture of them all (4 across, labelled), to look at in one go
  try {
    const cols = 4, w = 480, h = Math.round((w * size[1]) / size[0]), rows = Math.max(1, Math.ceil(kept.length / cols));
    const html = `<body style="margin:0;background:#2b211f;font:13px monospace;color:#f7ecd2;display:grid;grid-template-columns:repeat(${cols},${w}px)">${kept.map((k) => `<div style="position:relative"><img src="${k.file.split('/').pop()}" style="width:${w}px;height:${h}px;display:block"><span style="position:absolute;left:4px;top:4px;background:#2b211f;padding:1px 4px">${entry.id} · ${k.label}</span></div>`).join('')}</body>`;
    writeFileSync(join(dir, 'sheet.html'), html);
    await c.send('Emulation.setDeviceMetricsOverride', { width: cols * w, height: rows * h, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.navigate', { url: pathToFileURL(join(dir, 'sheet.html')).href }); await sleep(600);
    const r = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    writeFileSync(join(dir, 'sheet.jpg'), Buffer.from(r.data, 'base64'));
    rmSync(join(dir, 'sheet.html'));
  } finally { await c.send('Emulation.setDeviceMetricsOverride', { width: size[0], height: size[1], deviceScaleFactor: 1, mobile: o.mobile }); }
  return { entry, status, analysis, errors: [...new Set(c.errors)], shots: kept, frames: during.length, emptyFrames, skip, audio, wall: (Date.now() - t0) / 1000 };
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (name, d) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : d; };
  const flag = (name) => args.includes(`--${name}`);
  const PORT = Number(process.env.PORT ?? 5308);
  if (PORT === 5173) throw new Error('5173 is the author\'s own dev server: pick another PORT');
  const size = arg('size', '1280x720').split('x').map(Number);
  const o = { out: resolve(ROOT, arg('out', 'output/cinematics-qc')), frames: Number(arg('frames', 8)), every: Number(arg('every', 1)), quality: arg('quality', 'high'),
    skip: flag('skip'), emptyInk: Number(arg('empty-ink', 3)), rest: Number(arg('rest', 3)), size, mobile: flag('mobile') };
  const { CINEMATICS } = await import('../src/cinematics-page/catalog.js');
  const entries = pickEntries(CINEMATICS, { only: arg('only')?.split(','), group: arg('group') });
  if (!entries.length) throw new Error('no cinematic matches');
  mkdirSync(o.out, { recursive: true });
  const { createServer } = await import('vite');
  const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), cacheDir: join(ROOT, 'node_modules/.vite-cineqc'), logLevel: 'error', clearScreen: false,
    server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
  await server.listen();
  const c = await chrome({ size, mobile: flag('mobile') });
  // stopped (Ctrl-C, kill): close the browser and the server too, never leave them running
  let closing = false;
  const stop = async () => { if (closing) return; closing = true; try { await c.close(); await server.close(); } finally { process.exit(130); } };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const results = [];
  try {
    for (const entry of entries) {
      let r;
      try { r = await playOne(c, `http://127.0.0.1:${PORT}/`, entry, o); } catch (e) { r = { entry, status: `harness error: ${e.message}`, analysis: analyse([]), errors: [...c.errors], shots: [] }; }
      r.tech = scoreTechnical(r.analysis, { hold: holdsToSkip(entry), errors: r.errors, status: r.status, skip: r.skip, emptyFrames: r.emptyFrames, frames: r.frames });
      results.push(r);
      const a = r.analysis;
      console.log(`${entry.id.padEnd(28)} ${a.played ? `${a.duration.toFixed(1)}s ${a.shots} shots` : 'NOT PLAYED'}  tech ${r.tech.score}  ${r.tech.why.join('; ')}${r.errors.length ? `\n    errors: ${r.errors.slice(0, 3).join(' | ')}` : ''}`);
      await c.send('Page.navigate', { url: 'about:blank' }); await sleep(o.rest * 1000);   // (the world unloaded and a breather between them: a laptop runs hot)
      writeFileSync(join(o.out, 'report.json'), JSON.stringify({ when: new Date().toISOString(), size, quality: o.quality, results }, null, 1));
    }
  } finally { await c.close(); await server.close(); }
  writeFileSync(join(o.out, 'report.md'), `# Cinematics QC run (${new Date().toISOString().slice(0, 16)}, ${size.join('×')}, ${o.quality})\n\n${formatReport(results)}\n`);
  console.log(`\n${results.length} cinematics · report: ${join(o.out, 'report.md')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((e) => { console.error(e); process.exit(1); });
