// Does the loading screen's pen turn smoothly through a world's load? (docs/systems/performance.md, "The loading
// pen"). Headless Chrome (muted, the game's sound at 0, the Handheld preset, the CPU slowed --cpu times): a
// screencast of the whole load, and in every frame the pen's angle, read from its red nib (the centroid of the
// red pixels round the pen's centre). A smooth pen advances 150° a second; a stall is a stretch of frames where
// it doesn't move, or a jump in time between two frames.
//   npx vite build && npx vite preview --port 6441 --strictPort &
//   node scripts/transition-perf/pen.mjs --url http://localhost:6441/ [--only desert,incal] [--cpu 4] [--out f.json]
// On the handheld the same reading works on a screen recording (adb shell screenrecord) decoded in Chrome: frames()
// that reading on any list of frames ({ t ms, data base64 JPEG, w CSS width }) is angles() below.
import { writeFileSync } from 'node:fs';
import { options, sleep } from '../bench/lib.mjs';
import { PLAYWRIGHT, CHROME } from '../bench/browser.mjs';

const opt = options();
const BASE = (opt.url ?? 'http://localhost:6441/').replace(/\/?$/, '/');
const cpuRate = +(opt.cpu ?? 4);
const WORLDS = String(opt.only ?? 'desert,incal').split(',');
const { chromium } = await import(PLAYWRIGHT);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

/** the pen's angle (degrees) in each frame, decoded in a page of its own: the red nib's centroid round the pen's centre */
async function angles(shots, pen) {
  const dec = await browser.newPage();
  const out = await dec.evaluate(async ({ shots, pen }) => {
    const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
    const res = [];
    for (const s of shots) {
      const img = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + s.data)).blob());
      const k = img.width / s.w;   // (the frame may be scaled from CSS px)
      const x0 = Math.round((pen.x - pen.r) * k), y0 = Math.round((pen.y - pen.r) * k), size = Math.round(pen.r * 2 * k);
      c.width = c.height = size; g.drawImage(img, x0, y0, size, size, 0, 0, size, size);
      const d = g.getImageData(0, 0, size, size).data;
      let sx = 0, sy = 0, n = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = (y * size + x) * 4; if (d[i] > 150 && d[i + 1] < 110 && d[i + 2] < 100) { sx += x; sy += y; n++; } }
      res.push(n > 10 ? Math.atan2(sx / n - size / 2, -(sy / n - size / 2)) * 180 / Math.PI : null);
    }
    return res;
  }, { shots, pen });
  await dec.close();
  return out;
}

const result = { cpu: cpuRate, worlds: {} };
for (const w of WORLDS) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  // the load's stages (its console lines), on the same clock as the screencast's frames
  const stages = [];
  page.on('console', (m) => { const s = m.text(); if (s.startsWith('load: ') || s.startsWith('passage warm-up') || s.startsWith('shaders')) stages.push([Date.now(), s.slice(0, 60)]); });
  await page.goto(BASE + 'manifest.webmanifest');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: 'handheld', hudV: 1, music: 0, effects: 0, voices: 0 }));
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  const shots = [];
  cdp.on('Page.screencastFrame', (f) => { shots.push({ t: f.metadata.timestamp * 1000, data: f.data, w: f.metadata.deviceWidth }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => 0); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, everyNthFrame: 1 });
  const t0 = Date.now();
  await page.goto(BASE + `?level=${w}`, { waitUntil: 'commit' });
  let pen = null;
  for (let i = 0; i < 100 && !pen; i++) { pen = await page.evaluate(() => { const e = document.querySelector('#loading .pen'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, r: r.width / 2 }; }).catch(() => null); await sleep(50); }
  await page.waitForFunction(() => window.__moebiusBooted, null, { timeout: 600000, polling: 500 });
  const loadS = (Date.now() - t0) / 1000;
  await cdp.send('Page.stopScreencast');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const a = await angles(shots, pen);
  // the stretch while the loading screen shows: frames with the pen in them
  const rows = shots.map((s, i) => ({ t: s.t, a: a[i] })).filter((r) => r.a !== null);
  const gaps = [], stalls = [];
  let still = null;
  for (let i = 1; i < rows.length; i++) {
    const dt = rows[i].t - rows[i - 1].t, da = ((rows[i].a - rows[i - 1].a) % 360 + 540) % 360 - 180;
    gaps.push(dt);
    if (Math.abs(da) < 1) still ??= rows[i - 1].t; else if (still !== null) { stalls.push(rows[i - 1].t - still); still = null; }
  }
  const q = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(0) : null; };
  const span = rows.length > 1 ? rows[rows.length - 1].t - rows[0].t : 0;
  result.worlds[w] = { loadS: +loadS.toFixed(1), frames: rows.length, spanS: +(span / 1000).toFixed(1), fps: +(rows.length / (span / 1000)).toFixed(1),
    gapP50: q(gaps, 0.5), gapP95: q(gaps, 0.95), gapMax: q(gaps, 1), gapsOver50: gaps.filter((g) => g > 50).length, gapsOver100: gaps.filter((g) => g > 100).length,
    stallMax: q(stalls, 1) ?? 0, stallsOver100: stalls.filter((s) => s > 100).length,
    // the long gaps and the stage under way when each began (the stage that logged next)
    long: rows.slice(1).map((r, i) => [rows[i].t, r.t - rows[i].t]).filter(([, g]) => g > 100).map(([t, g]) => `${Math.round(g)} ms during ${(stages.find(([ts]) => ts > t) ?? [0, 'after'])[1]}`) };
  console.log(w, JSON.stringify(result.worlds[w]));
  await ctx.close();
}
if (opt.out) writeFileSync(opt.out, JSON.stringify(result, null, 1) + '\n');
await browser.close();
process.exit(0);
