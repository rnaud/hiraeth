// Does the loading pen turn smoothly through a load on the Steam Deck? (docs/systems/performance.md, "The loading
// pen"; the Mac's reading is scripts/transition-perf/pen.mjs). The game on the Deck (scripts/bench/deck-run.sh),
// then: a screencast of each world's load over the DevTools protocol, and in every frame the pen's angle from its
// red nib, decoded here in headless Chrome (muted).
//   node scripts/bench/deck-pen.mjs [--port 5310] [--only desert,incal] [--quality deck] [--out f.json]
import { writeFileSync } from 'node:fs';
import { options, sleep } from './lib.mjs';
import { PLAYWRIGHT, CHROME } from './browser.mjs';

const opt = options();
const PORT = +(opt.port ?? 5310);
const WORLDS = String(opt.only ?? 'desert,incal').split(',');
const quality = String(opt.quality ?? 'deck');

const target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map(), listeners = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id) { pending.get(d.id)?.(d); pending.delete(d.id); } else for (const l of listeners) l(d); };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');

const { chromium } = await import(PLAYWRIGHT);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--mute-audio'] });

/** the pen's angle (degrees) in each frame: the red nib's centroid round the pen's centre (as pen.mjs) */
async function angles(shots, pen) {
  const dec = await browser.newPage();
  const out = await dec.evaluate(async ({ shots, pen }) => {
    const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
    const res = [];
    for (const s of shots) {
      const img = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + s.data)).blob());
      const k = img.width / s.w;
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

const result = { quality, worlds: {} };
for (const w of WORLDS) {
  await ev(`localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${quality}', hudV: 1, deckV: 1, music: 0, effects: 0, voices: 0 })); true`);
  const shots = [];
  const onFrame = (d) => {
    if (d.method !== 'Page.screencastFrame') return;
    const f = d.params;
    shots.push({ t: f.metadata.timestamp * 1000, data: f.data, w: f.metadata.deviceWidth });
    send('Page.screencastFrameAck', { sessionId: f.sessionId });
  };
  listeners.push(onFrame);
  await send('Page.startScreencast', { format: 'jpeg', quality: 60, everyNthFrame: 1, maxWidth: 640, maxHeight: 400 });
  const t0 = Date.now();
  await send('Page.navigate', { url: `moebius://game/index.html?level=${w}` });
  let pen = null;
  for (let i = 0; i < 200 && !pen; i++) { pen = await ev(`(() => { const e = document.querySelector('#loading .pen'); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2, r: r.width / 2 } : null; })()`).catch(() => null); if (!pen) await sleep(50); }
  while (!(await ev('!!window.__moebiusBooted').catch(() => false))) { if (Date.now() - t0 > 300000) break; await sleep(250); }
  const loadS = (Date.now() - t0) / 1000;
  await send('Page.stopScreencast');
  listeners.splice(listeners.indexOf(onFrame), 1);
  const a = await angles(shots, pen);
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
  result.worlds[w] = { loadS: +loadS.toFixed(1), frames: rows.length, spanS: +(span / 1000).toFixed(1), fps: +(rows.length / (span / 1000 || 1)).toFixed(1),
    gapP50: q(gaps, 0.5), gapP95: q(gaps, 0.95), gapMax: q(gaps, 1), gapsOver50: gaps.filter((g) => g > 50).length, gapsOver100: gaps.filter((g) => g > 100).length,
    stallMax: q(stalls, 1) ?? 0, stallsOver100: stalls.filter((s) => s > 100).length };
  console.log(w, JSON.stringify(result.worlds[w]));
}
if (opt.out) writeFileSync(opt.out, JSON.stringify(result, null, 1) + '\n');
await browser.close();
process.exit(0);
