// A world's load, timed (README: "Loading without a stall"): headless Chrome on ANGLE Metal, muted, the
// game's sound at 0, paced (vsync on). Per world: a fresh page of ?level=<id>, the main thread's long
// tasks from the first byte to a few seconds after the first frame (PerformanceObserver), the frames
// the page managed meanwhile (requestAnimationFrame from the first script: a gap is a frame the loading
// screen's own JavaScript could not have drawn; the pen turns on the compositor regardless), and the
// load's stages (its console lines).
//   npx vite build && npx vite preview --port 6441 --strictPort &      (the shipped bundle, not the dev server's modules)
//   node scripts/transition-perf/loading.mjs --url http://localhost:6441/ --preset high|handheld [--cpu 4] [--only desert] [--out f.json]
//   node scripts/transition-perf/loading.mjs --pen       does the loading screen's pen keep turning through a 500 ms task?
import { writeFileSync } from 'node:fs';
import { options, sleep } from '../bench/lib.mjs';
import { PLAYWRIGHT, CHROME } from '../bench/browser.mjs';

const opt = options();
const BASE = (opt.url ?? 'http://localhost:6441/').replace(/\/?$/, '/');
const preset = opt.preset ?? 'high';
const cpuRate = +(opt.cpu ?? (preset === 'handheld' ? 4 : 1));
const WORLDS = (opt.only ? String(opt.only).split(',') : ['desert', 'incal', 'arzach', 'garage', 'edena', 'perdide', 'home', 'spheres', 'buried', 'lab']);

const INIT = `(() => {
  const L = window.__load = { long: [], frames: [], stages: [], t0: performance.now() };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) L.long.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch {}
  let last = -1;
  const tick = (ts) => { if (last >= 0) L.frames.push([Math.round(last), +(ts - last).toFixed(1)]); last = ts; if (!L.stop) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const info = console.info;
  console.info = function (...a) { const s = String(a[0] ?? ''); if (s.startsWith('load: ')) L.stages.push([Math.round(performance.now()), s.slice(6)]); return info.apply(this, a); };
})();`;

const { chromium } = await import(PLAYWRIGHT);
const browser = await chromium.launch({ executablePath: CHROME, headless: true,
  args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.addInitScript(INIT);
page.on('pageerror', (e) => console.error('pageerror', e.message));
const cdp = await ctx.newCDPSession(page);
await page.goto(BASE + 'manifest.webmanifest');
const glName = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const d = c.getExtension('WEBGL_debug_renderer_info'); return c.getParameter(d.UNMASKED_RENDERER_WEBGL); });
if (/SwiftShader|llvmpipe|Software/i.test(glName)) { console.error('software rendering: ' + glName); process.exit(2); }
console.log(glName, preset, `cpu ×${cpuRate}`);

if (opt.pen) {
  // the loading screen up, then the main thread held for 500 ms: two screenshots inside it should differ
  await page.evaluate(() => { localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: 'high', music: 0, effects: 0, voices: 0 })); });
  await page.goto(BASE + '?level=home');
  await page.waitForFunction(() => window.__moebiusBooted, null, { timeout: 300000 });
  await sleep(1500);
  // (the loading screen is gone once the game runs: put the same one back, index.html's markup under its own styles)
  await page.evaluate(() => {
    document.getElementById('loading')?.remove();
    const l = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'loading' }));
    l.innerHTML = '<svg class="pen" viewBox="0 0 120 120" aria-hidden="true"><circle class="ring" cx="60" cy="60" r="44" /><circle class="ring r2" cx="60" cy="60" r="30" /><path class="nib" d="M60 14 L66 34 L60 40 L54 34 Z" /></svg><div class="msg">sketching the world…</div>';
  });
  await sleep(500);
  const shots = [];
  // The frames the compositor sends (a screencast) while the main thread is held for 900 ms: if the pen
  // turns on the compositor, they keep coming and keep changing. (A screenshot waits for the main thread.)
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => { frames.push({ t: f.metadata.timestamp * 1000, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: 1280, maxHeight: 720 });
  await sleep(400);
  await page.evaluate(() => setTimeout(() => { window.__busy = [Date.now()]; const t = performance.now(); while (performance.now() - t < 900) { /* a long task */ } window.__busy.push(Date.now()); }, 50));
  await sleep(1400);
  await cdp.send('Page.stopScreencast');
  const [b0, b1] = await page.evaluate(() => window.__busy);
  const inside = frames.filter((f) => f.t > b0 + 30 && f.t < b1 - 30);
  const distinct = new Set(inside.map((f) => f.data)).size;
  console.log(`a ${b1 - b0} ms task; ${frames.length} compositor frames in all, ${inside.length} inside the task, ${distinct} of them different`);
  console.log('pen turning during the long task:', inside.length >= 3 && distinct >= Math.min(3, inside.length) ? 'yes' : 'NO');
  inside.slice(0, 3).forEach((f, i) => shots.push(f.data));
  for (let i = 0; i < shots.length; i++) writeFileSync(`${opt.shots ?? '.'}/pen-${i}.png`, Buffer.from(shots[i], 'base64'));
  await browser.close();
  process.exit(0);
}

const out = [];
for (const world of WORLDS) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.goto(BASE + 'manifest.webmanifest');
  await page.evaluate((q) => {
    localStorage.clear();
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'ship.launched': true }, keepsakes: [] }));
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: q, showFps: false, music: 0, effects: 0, voices: 0 }));
  }, preset);
  // (once without timing: the modules and assets cached, as on a jump between worlds)
  if (!opt.cold) { await page.goto(BASE + `?level=${world}`); await page.waitForFunction(() => window.__moebiusBooted, null, { timeout: 600000, polling: 250 }); }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  if (opt.profile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
  const t0 = Date.now();
  await page.goto(BASE + `?level=${world}`);
  await page.waitForFunction(() => window.__moebiusBooted, null, { timeout: 900000, polling: 250 });
  const bootMs = Date.now() - t0;
  if (opt.profile) {
    // where the load's time goes: inclusive time per function (each function once per sample), the game's own code
    const { profile } = await cdp.send('Profiler.stop');
    const byId = new Map(profile.nodes.map((n) => [n.id, n])), parent = new Map();
    for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
    const incl = new Map(), self = new Map();
    const key = (n) => { const f = n.callFrame; return `${f.functionName || '(anon)'} ${f.url.replace(/^.*\/(src|assets)\//, '$1/').replace(/\?.*$/, '')}:${f.lineNumber + 1}`; };
    profile.samples.forEach((id, i) => {
      const dt = (profile.timeDeltas[i] ?? 0) / 1000;
      const seen = new Set();
      let n = byId.get(id);
      self.set(key(n), (self.get(key(n)) ?? 0) + dt);
      while (n) { const k = key(n); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) ?? 0) + dt); } n = byId.get(parent.get(n.id)); }
    });
    // the busy stretches (no idle sample for 45 ms or more: a long task, or tasks back to back), and what ran in each
    const stacks = profile.samples.map((id) => { const ks = []; let n = byId.get(id); while (n) { ks.push(key(n)); n = byId.get(parent.get(n.id)); } return ks; });
    const runs = []; let cur = null;
    profile.samples.forEach((id, i) => {
      const dt = (profile.timeDeltas[i] ?? 0) / 1000, idle = /^\(idle\)/.test(stacks[i][0]);
      if (idle) { if (cur && cur.ms >= 45) runs.push(cur); cur = null; return; }
      (cur ??= { ms: 0, f: new Map() }).ms += dt;
      for (const k of new Set(stacks[i])) cur.f.set(k, (cur.f.get(k) ?? 0) + dt);
    });
    for (const r of runs.sort((a, b) => b.ms - a.ms).slice(0, 8)) {
      const fns = [...r.f].filter(([k]) => /src\/|assets\//.test(k) && !/main\.js:0|runStepsAsync|load-steps/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 6);
      console.log(`  busy ${r.ms.toFixed(0)} ms: ${fns.map(([k, v]) => `${k.split(' ')[0]} ${k.split(' ')[1].replace(/^src\//, '')} ${v.toFixed(0)}`).join(' | ')}`);
    }
    const top = (m, re, n) => [...m].filter(([k]) => re.test(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(0).padStart(6)} ms  ${k}`);
    console.log(`\n-- ${world}: inclusive (src/ and the bundle)\n` + top(incl, /src\/|assets\//, +(opt.profile === true ? 40 : opt.profile)).join('\n'));
    console.log(`-- ${world}: self\n` + top(self, /./, 25).join('\n'));
  }
  await sleep(3000);
  const L = await page.evaluate(() => { const L = window.__load; L.stop = true; return { ...L, booted: Math.round(window.__moebiusBootedAt ?? 0) }; });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const before = L.long.filter((l) => l.at < L.booted);
  const top = before.slice().sort((a, b) => b.ms - a.ms).slice(0, 6);
  const stageAt = (t) => { let s = 'module load'; for (const [at, m] of L.stages) if (at <= t) s = m.replace(/ \d+ ms$/, ''); else break; return s; };
  // (a stage line is logged as the next one starts: the task at t belongs to the stage logged after t)
  const stageOf = (t) => { const next = L.stages.find(([at]) => at > t); return next ? next[1].replace(/ \d+ ms$/, '').replace(/^total.*/, 'warm-up / first frame') : 'after'; };
  const gaps = L.frames.filter(([at]) => at < L.booted).map(([, dt]) => dt);
  const r = {
    world, bootMs, booted: L.booted, long: before.length, over50: before.filter((l) => l.ms > 50).length, longMs: before.reduce((s, l) => s + l.ms, 0),
    longest: top.map((l) => ({ ms: l.ms, at: l.at, stage: stageOf(l.at) })),
    frames: gaps.length, maxGap: Math.max(0, ...gaps), stages: L.stages.map(([at, s]) => `${at} ${s}`),
    after: L.long.filter((l) => l.at >= L.booted).map((l) => l.ms),
    trace: L.frames.filter(([at]) => at < L.booted + 3000),
  };
  out.push(r);
  console.log(`\n== ${world}: first frame at ${r.booted} ms (${bootMs} ms wall)  long tasks ${r.long} (${r.over50} over 50 ms, ${r.longMs} ms)  longest ${r.longest.map((l) => `${l.ms} ms [${l.stage}]`).join(', ')}`);
  console.log(`   frames before it: ${r.frames}, longest gap ${r.maxGap} ms;  after it: ${r.after.length ? r.after.join(', ') + ' ms' : 'none'}`);
  console.log(`   stages: ${r.stages.join(' | ')}`);
}
if (opt.out) writeFileSync(opt.out, JSON.stringify({ gl: glName, preset, cpuRate, worlds: out }, null, 1));
await browser.close();
