// The opening, web against Unity, beat by beat (issue #394): engine/opening-beats.js's beats of the prologue, each
// photographed in headless Chrome (a fresh page's storage, ?level=desert&prologue=1) and in Unity (`-opening`,
// engine/unity/game.js), and laid side by side on one contact sheet.
//
//   PORT=5431 node scripts/unity-compare/opening.mjs web <out-dir>          the web's beats: <out-dir>/web-opening-<beat>.png, web-opening.json
//   scripts/unity-js-run.sh opening -opening -out <out-dir>                 Unity's: <out-dir>/unity-opening-<beat>.png
//   node scripts/unity-compare/opening.mjs sheet <web-dir> <unity-dir> <sheet.jpg> [--title "before"]
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENING_BEATS } from '../../engine/opening-beats.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [mode, ...rest] = process.argv.slice(2);
const pos = rest.filter((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--'));
const arg = (n, d) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : d; };

async function web(out) {
  const PORT = Number(process.env.PORT ?? 5431);
  if (PORT === 5173) throw new Error('5173 is the author\'s own dev server');
  mkdirSync(out, { recursive: true });
  const { chrome } = await import('../cinematics-qc.mjs');
  const { viteCacheDir } = await import('../temp-dirs.mjs');
  const { createServer } = await import('vite');
  const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), cacheDir: viteCacheDir('opening'), logLevel: 'error', clearScreen: false,
    server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false, watch: null } });
  await server.listen();
  const c = await chrome({ size: [1280, 720] });
  const base = `http://127.0.0.1:${PORT}/`;
  const log = [];
  try {
    await c.send('Page.navigate', { url: `${base}manifest.webmanifest` }); await sleep(300);
    await c.ev(`localStorage.clear(); localStorage.setItem('hiraeth.settings.v1', JSON.stringify({ quality: 'high', showFps: false })); true`);
    await c.send('Page.navigate', { url: `${base}?level=desert&prologue=1` });
    let up = false;
    for (let i = 0; i < 720 && !up; i++) { try { up = await c.ev('!!window.__hiraethBooted && !!window.ship?.prologue'); } catch { /* loading */ } if (!up) await sleep(250); }
    if (!up) throw new Error(`the page never came up: ${c.errors.at(-1) ?? ''}`);
    const { PROLOGUE_STAGES } = await import('../../src/ship/prologue.js');
    const { beatDue } = await import('../../engine/opening-beats.js');
    const keyE = async (type) => c.send('Input.dispatchKeyEvent', { type, key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69, nativeVirtualKeyCode: 69, text: type === 'keyDown' ? 'e' : undefined });
    for (const b of OPENING_BEATS) {
      const t0 = Date.now();
      for (;;) {
        const s = await c.ev('({ stage: window.ship.prologue.stage, t: window.ship.prologue.t, done: window.ship.prologue.done })');
        if (s.done || beatDue(b, PROLOGUE_STAGES, s.stage, s.t)) break;
        if (Date.now() - t0 > 120000) { console.log(`${b.name}: never came (${s.stage})`); break; }
        await sleep(40);
      }
      if (b.console) {
        await c.ev('(() => { const m = ship.modelOf(player.pos); player.pos.copy(ship.world(m, m.interior.points.cockpit)); return true; })()');
        await sleep(900);
      }
      const r = await c.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(out, `web-opening-${b.name}.png`), Buffer.from(r.data, 'base64'));
      const st = await c.ev(`(() => { const p = document.getElementById('prompt'); const sub = document.querySelector('#cinema .sub, .cine-sub, #subtitle');
        return { stage: ship.prologue.stage, t: +ship.prologue.t.toFixed(2), holo: !!ship.holo?.visible, prompt: p && getComputedStyle(p).display !== 'none' && p.offsetParent ? p.textContent.trim() : null, sub: sub?.textContent?.trim() ?? null, cam: camera.position.toArray().map((v) => +v.toFixed(1)) }; })()`);
      log.push({ beat: b.name, ...st });
      console.log(b.name, JSON.stringify(st));
      if (b.console) { await keyE('keyDown'); await sleep(120); await keyE('keyUp'); }
    }
  } finally { writeFileSync(join(out, 'web-opening.json'), JSON.stringify({ log, errors: c.errors }, null, 1)); await c.close(); await server.close(); }
}

async function sheet(webDir, unityDir, file, title) {
  const sharp = (await import('sharp')).default;
  const W = 640, H = 360, LAB = 26, rows = [];
  const esc = (s) => String(s).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
  const tile = async (f) => (existsSync(f) ? sharp(f).resize(W, H, { fit: 'fill' }).png().toBuffer()
    : sharp({ create: { width: W, height: H, channels: 3, background: '#333' } }).png().toBuffer());
  for (const [i, b] of OPENING_BEATS.entries()) {
    rows.push({ input: await tile(join(webDir, `web-opening-${b.name}.png`)), left: 0, top: LAB * 2 + i * (H + LAB) + LAB });
    rows.push({ input: await tile(join(unityDir, `unity-opening-${b.name}.png`)), left: W + 8, top: LAB * 2 + i * (H + LAB) + LAB });
  }
  const total = LAB * 2 + OPENING_BEATS.length * (H + LAB);
  const labels = OPENING_BEATS.map((b, i) => `<text x="8" y="${LAB * 2 + i * (H + LAB) + 19}" font-size="17" font-family="Helvetica" fill="#eee">${i + 1}. ${esc(b.name)} (${b.stage} +${b.t}s)</text>`).join('');
  const svg = `<svg width="${W * 2 + 8}" height="${total}" xmlns="http://www.w3.org/2000/svg"><text x="8" y="34" font-size="22" font-family="Helvetica" font-weight="bold" fill="#fff">The opening: web (left) · Unity (right)${title ? ` · ${esc(title)}` : ''}</text>${labels}</svg>`;
  await sharp({ create: { width: W * 2 + 8, height: total, channels: 3, background: '#161616' } })
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }, ...rows]).jpeg({ quality: 78 }).toFile(file);
  console.log(`sheet: ${file}`);
}

if (mode === 'web') await web(resolve(pos[0] ?? 'output/opening'));
else if (mode === 'sheet') await sheet(resolve(pos[0]), resolve(pos[1]), resolve(pos[2]), arg('title', ''));
else console.log('usage: opening.mjs web <out-dir> | sheet <web-dir> <unity-dir> <sheet.jpg> [--title t]');
