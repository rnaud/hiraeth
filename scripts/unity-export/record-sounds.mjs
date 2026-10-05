// Record the web game's synthesised sounds (src/audio.js, Web Audio) into WAV files for the Unity
// port: every effect the desert plays (footsteps, the bike's whistle, the box's creak, burst and
// fanfare, the father's charge, the fluid tool's shots, splashes, pushes and boosts, the chime,
// the page…) and a few minutes of the desert's score. Each one is rendered by the game's own
// Sound class into an OfflineAudioContext (window.AudioContext swapped for it), so the clips are
// exactly what the browser plays. The continuous layers (wind, the cloak, the engine) and the
// voices are synthesised live in Unity (Assets/Memento/Runtime/Audio).
//
//   npx vite --port 5238 --strictPort &
//   PLAYWRIGHT=/path/to/playwright-core/index.mjs node scripts/unity-export/record-sounds.mjs [outDir]
//
// outDir defaults to unity/Memento/Assets/StreamingAssets/sound (git-ignored). URL: the dev server.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] ?? resolve(here, '../../unity/Memento/Assets/StreamingAssets/sound'));
const URL = process.env.URL ?? 'http://localhost:5238';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
// a blank page on the dev server's origin, so the game's modules import as they are
await page.route(`${URL}/__record.html`, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>record</title>' }));
await page.goto(`${URL}/__record.html`);

// [name, seconds, what to play (s: a started Sound)]
const FX = [
  ['step_sand_walk', 0.4, 's.step(4)'], ['step_sand_walk2', 0.4, 's.step(4)'], ['step_sand_run', 0.4, 's.step(9)'], ['step_sand_run2', 0.4, 's.step(9)'],
  ['chime', 1.6, 's.chime()'], ['bell', 3, 's.bell()'], ['page', 0.6, 's.page()'], ['whoosh', 2.2, 's.whoosh()'],
  ['whistle', 1.0, "s.whistle('mount')"], ['charge', 4.5, 's.charge()'],
  ['box_creak', 1.6, 's.boxCreak()'], ['box_burst', 2.5, 's.boxBurst()'], ['fanfare', 3.5, 's.fanfare()'], ['box_hum', 3, 's.boxHum(1)'], ['box_answer', 2.2, 's.boxAnswer(1)'],
  ['fluid_shoot', 0.8, "s.fluidShoot('shoot')"], ['fluid_shoot_stun', 0.8, "s.fluidShoot('stun')"], ['fluid_shoot_fire', 0.8, "s.fluidShoot('fire')"],
  ['fluid_mode', 0.6, "s.fluidMode('shoot')"], ['fluid_mode_stun', 0.6, "s.fluidMode('stun')"], ['fluid_mode_fire', 0.6, "s.fluidMode('fire')"],
  ['fluid_splash', 0.9, "s.fluidSplash(false, 'shoot')"], ['fluid_splash_target', 0.9, "s.fluidSplash(true, 'shoot')"], ['fluid_splash_fire', 0.9, "s.fluidSplash(false, 'fire')"],
  ['fluid_push', 1.0, 's.fluidPush()'], ['fluid_boost', 1.0, 's.fluidBoost()'], ['fluid_refill', 1.6, 's.fluidRefill(false)'], ['fluid_refill_colour', 2.2, 's.fluidRefill(true)'],
  ['fluid_empty', 0.8, 's.fluidEmpty()'], ['fluid_dock', 0.8, 's.fluidDock(true)'],
  ['splash', 1.2, 's.splash(1)'], ['wade', 0.8, 's.wade(0.5)'], ['flap', 0.6, 's.flap()'],
];
const results = await page.evaluate(async ({ FX, url }) => {
  const { Sound } = await import(`${url}/src/audio.js`);
  const SR = 44100;
  const wav = (buf) => {
    const n = buf.length, ch = buf.numberOfChannels, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const W = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    W(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); W(8, 'WAVE'); W(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
    out.setUint16(22, ch, true); out.setUint32(24, SR, true); out.setUint32(28, SR * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
    W(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const d = [...Array(ch).keys()].map((c) => buf.getChannelData(c));
    let peak = 0;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, d[c][i])); peak = Math.max(peak, Math.abs(v)); out.setInt16(44 + (i * ch + c) * 2, v * 32767, true); }
    let s = ''; const b = new Uint8Array(out.buffer);
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return { b64: btoa(s), peak };
  };
  /** A Sound whose context is an OfflineAudioContext of `secs` (its clock pinned, for the score). */
  const offline = (secs, score = false) => {
    let ctx = null;
    window.AudioContext = function () { ctx = new OfflineAudioContext(2, Math.ceil(SR * secs), SR); return ctx; };
    window.webkitAudioContext = undefined;
    const s = new Sound('desert', { score: false });
    if (!s.ctx) s.start();
    s.score = score;
    return s;
  };
  const out = [];
  for (const [name, secs, code] of FX) {
    const s = offline(secs);
    try { (new Function('s', code))(s); } catch (e) { out.push({ name, error: String(e) }); continue; }
    const buf = await s.ctx.startRendering();
    out.push({ name, ...wav(buf) });
  }
  // the desert's score: the scheduler run by hand along a pinned clock, then the whole of it rendered
  {
    const secs = 150, s = offline(secs + 4, true);
    let now = 0;
    Object.defineProperty(s.ctx, 'currentTime', { get: () => now });
    for (now = 0; now < secs; now += 0.1) s.schedule();
    now = 0;
    const buf = await s.ctx.startRendering();
    out.push({ name: 'music_desert', ...wav(buf) });
  }
  return out;
}, { FX, url: URL });
for (const r of results) {
  if (r.error) { console.log('failed', r.name, r.error); continue; }
  writeFileSync(resolve(OUT, `${r.name}.wav`), Buffer.from(r.b64, 'base64'));
  console.log(`${r.name}.wav peak ${r.peak.toFixed(2)}`);
}
await browser.close();
