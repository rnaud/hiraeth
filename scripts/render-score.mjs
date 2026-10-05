// Render each world's score to a WAV, offline, to listen to later: the game's own Sound class
// (src/audio.js, src/score.js) runs in headless Chrome with an OfflineAudioContext swapped in for
// the AudioContext and its clock pinned, along a little walk (standing at the landing, walking a
// while, standing again), so the layers come and go as they would in the game. Nothing plays out
// loud: Chrome runs muted and the context renders into a buffer.
//
//   PLAYWRIGHT=/path/to/playwright-core/index.mjs node scripts/render-score.mjs <outDir> [seconds]
//
// WORLDS=desert,incal… to choose (default: the route, home and the atelier); MUSIC_ONLY=1 leaves out
// the ambience beds (birds, horns, gears) and the wind; PORT for its own
// dev server (default 5847; it starts one, so none need be running); CHROME for the browser.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] ?? 'score-renders');
const SECS = Number(process.argv[3] ?? 60);
const PORT = Number(process.env.PORT ?? 5847);
const WORLDS = (process.env.WORLDS ?? 'desert,incal,arzach,arzach2,garage,buried,edena,spheres,perdide,perdide2,bazaar,home,atelier').split(',');
// the walk: [from (s), speed (m/s)]
const WALK = [[0, 0], [10, 4.5], [36, 0]];
const MUSIC_ONLY = process.env.MUSIC_ONLY === '1';

mkdirSync(OUT, { recursive: true });
const server = await createServer({ root: resolve(here, '..'), logLevel: 'error', server: { port: PORT, strictPort: true } });
await server.listen();
const URL = `http://localhost:${PORT}`;
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core');
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.route(`${URL}/__score.html`, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>score</title>' }));
  await page.goto(`${URL}/__score.html`);
  for (const world of WORLDS) {
    const r = await page.evaluate(async ({ url, world, secs, walk, musicOnly }) => {
      const { Sound } = await import(`${url}/src/audio.js`);
      const SR = 44100;
      let ctx = null;
      window.AudioContext = function () { ctx = new OfflineAudioContext(2, Math.ceil(SR * (secs + 2)), SR); return ctx; };
      window.webkitAudioContext = undefined;
      localStorage.removeItem('moebius.muted');
      const s = new Sound(world, { score: false });
      if (!s.ctx) s.start();
      s.score = true;
      if (musicOnly) { s.voice.ambience = 'none'; s.fx.gain.value = 0; }
      if (window.__amb) s.voice.ambience = window.__amb;
      let now = 0;
      Object.defineProperty(s.ctx, 'currentTime', { get: () => now });
      const speedAt = (t) => walk.filter(([from]) => from <= t).at(-1)[1];
      const CALM = { gust: 0.2, storm: 0, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0, flying: false, indoor: 0, night: false };
      for (now = 0; now < secs; now += 0.1) { s.update({ ...CALM, speed: speedAt(now) }); s.schedule(); }
      now = 0;
      const buf = await s.ctx.startRendering();
      // 16-bit WAV, faded over the last second (the render stops mid-phrase)
      const n = Math.min(buf.length, Math.ceil(SR * secs)), ch = buf.numberOfChannels, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
      const W = (o, str) => { for (let i = 0; i < str.length; i++) out.setUint8(o + i, str.charCodeAt(i)); };
      W(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); W(8, 'WAVE'); W(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
      out.setUint16(22, ch, true); out.setUint32(24, SR, true); out.setUint32(28, SR * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
      W(36, 'data'); out.setUint32(40, n * ch * 2, true);
      const d = [...Array(ch).keys()].map((c) => buf.getChannelData(c));
      let peak = 0, sum = 0;
      for (let i = 0; i < n; i++) {
        const fade = Math.min(1, (n - i) / SR);
        for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, d[c][i] * fade)); peak = Math.max(peak, Math.abs(v)); sum += v * v; out.setInt16(44 + (i * ch + c) * 2, v * 32767, true); }
      }
      let str = ''; const b = new Uint8Array(out.buffer);
      for (let i = 0; i < b.length; i += 0x8000) str += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return { b64: btoa(str), peak, rms: Math.sqrt(sum / (n * ch)), title: s.S.title, mode: s.S.mode };
    }, { url: URL, world, secs: SECS, walk: WALK, musicOnly: MUSIC_ONLY });
    const file = resolve(OUT, `score_${world}${MUSIC_ONLY ? '_music' : ''}.wav`);
    writeFileSync(file, Buffer.from(r.b64, 'base64'));
    console.log(`${file}  "${r.title}" (${r.mode})  peak ${r.peak.toFixed(2)}  rms ${(20 * Math.log10(r.rms + 1e-9)).toFixed(1)} dB`);
  }
} finally {
  await browser.close();
  await server.close();
}
