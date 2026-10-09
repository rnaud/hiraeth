// The title screen's shots (src/title-shots.js) as the game draws them, beside the covers they follow
// (references/Title Screen/): serves this checkout with its own Vite (never the author's dev server),
// drives one headless muted Chrome on the GPU to the title with ?shot=<id>, waits for the world to fade
// in, and writes
//   OUT/<id>.jpg                         the title screen (name, menu, world) at 1280 × 720
//   docs/title-shots/<id>-compare.jpg    the cover and the render side by side
// and, with --sizes, the title at every screen shape it is checked on (into OUT, default the scratch
// folder given by TMPDIR): 1920×1080, 2560×1080, 1280×800, 1024×768, 812×375, 375×812, 1080×2400 (at 1/2.6).
//
//   node scripts/title-shots.mjs                    every shot
//   node scripts/title-shots.mjs H1,E3 [--sizes] [--clean]   those (clean: the world alone, no name or menu)
//   CAM='{"camera":{"eye":[…],"target":[…],"fov":50},"traveller":{…}}' node scripts/title-shots.mjs H1   (try a pose)
// PORT (default 5345) is Vite's, CDP (default 5395) Chrome's debugging port.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.PORT ??= '5345';
process.env.CDP ??= '5395';
const { serve, chrome } = await import('./changelog-shots.mjs');
const { SHOTS } = await import('../src/title-shots.js');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT);
const BASE = `http://127.0.0.1:${PORT}/`;
const DOCS = join(ROOT, 'docs/title-shots');
const REFS = join(ROOT, 'references/Title Screen');
export const SIZES = [[1920, 1080], [2560, 1080], [1280, 800], [1024, 768], [812, 375], [375, 812], [412, 915]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const only = args.find((a) => !a.startsWith('--'))?.split(',');
const OUT = process.env.OUT ?? mkdtempSync(join(tmpdir(), 'title-sizes-'));
const tryCam = process.env.CAM ? JSON.parse(process.env.CAM) : null;
// CAMS='[{…},{…}]': several poses tried on one load (OUT/<id>-v<n>.png and their comparisons)
const tryCams = process.env.CAMS ? JSON.parse(process.env.CAMS) : null;

const storage = `localStorage.clear(); localStorage.setItem('moebius.muted', '1');
  localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: '${process.env.QUALITY ?? 'medium'}', showFps: false, music: 0, effects: 0, voices: 0 }));`;

/** Open the title on `id` at w × h; resolves once its world is on the screen (or it gave up). */
async function open(c, id, [w, h], { dpr = 1, mobile = false } = {}) {
  await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile });
  await c.send('Page.navigate', { url: `${BASE}manifest.webmanifest` }); await sleep(250);
  await c.ev(`${storage}; true`);
  c.errors.length = 0;
  const t0 = Date.now();
  await c.send('Page.navigate', { url: `${BASE}?shot=${encodeURIComponent(id)}` });
  let state = 'wait';
  for (let i = 0; i < 360 && state === 'wait'; i++) {
    await sleep(250);
    try { state = await c.ev(`(() => { const r = window.title?.root; if (!r) return 'wait'; if (r.classList.contains('vista-on')) return 'on'; return r.classList.contains('vista-wait') ? 'wait' : 'drawn'; })()`); } catch { /* loading */ }
  }
  const timing = await c.ev('JSON.stringify(window.title?.timing ?? null)').catch(() => 'null');
  if (state !== 'on') console.warn(`${id}: the world did not show (${state}) ${c.errors.slice(-2).join(' | ')}`);
  if (tryCam) { await c.ev(`(() => { window.title.vista.setShot(${JSON.stringify(tryCam)}); return true; })()`); }
  await sleep(1800);   // (the fade, and the traveller settled)
  return { state, timing: JSON.parse(timing), ms: Date.now() - t0 };
}

async function grab(c, file, clean = false) {
  if (clean) await c.ev(`(() => { for (const e of document.querySelectorAll('#title .front, #title .version')) e.style.visibility = 'hidden'; return true; })()`);
  const r = await c.send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(r.data, 'base64'));
  if (clean) await c.ev(`(() => { for (const e of document.querySelectorAll('#title .front, #title .version')) e.style.visibility = ''; return true; })()`);
}

const jpg = (png, out, width = 1280, q = 74) => execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(q), '--resampleWidth', String(width), png, '--out', out], { stdio: 'ignore' });

/** The cover and the render side by side (drawn by the same Chrome: a page with the two pictures). */
async function compare(c, shot, renderPng, out) {
  const ref = `data:image/jpeg;base64,${readFileSync(join(REFS, shot.ref)).toString('base64')}`;
  const ren = `data:image/png;base64,${readFileSync(renderPng).toString('base64')}`;
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 590, deviceScaleFactor: 1, mobile: false });
  await c.send('Page.navigate', { url: 'about:blank' }); await sleep(200);
  await c.ev(`(async () => {
    document.body.style.cssText = 'margin:0;background:#2b211f;display:flex;gap:16px;padding:16px;box-sizing:border-box;font:14px ui-monospace,monospace;color:#efe0bf';
    document.body.innerHTML = '<figure style="margin:0;flex:1"><img id=a style="width:100%;display:block"><figcaption>cover ${shot.ref}</figcaption></figure><figure style="margin:0;flex:1"><img id=b style="width:100%;display:block"><figcaption>the game: ${shot.level}, shot ${shot.id}</figcaption></figure>';
    const a = document.getElementById('a'), b = document.getElementById('b');
    a.src = ${JSON.stringify(ref)}; b.src = ${JSON.stringify(ren)};
    await Promise.all([a.decode(), b.decode()]);
    return true;
  })()`);
  const r = await c.send('Page.captureScreenshot', { format: 'png' });
  const tmp = `${out}.png`;
  writeFileSync(tmp, Buffer.from(r.data, 'base64'));
  jpg(tmp, out, 1600, 62);
  rmSync(tmp);
}

/** Several pictures on one sheet, two to a row, each captioned (the cover first). */
async function sheet(c, items, out) {
  const rows = Math.ceil(items.length / 2);
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: rows * 470 + 20, deviceScaleFactor: 1, mobile: false });
  await c.send('Page.navigate', { url: 'about:blank' }); await sleep(200);
  const data = items.map(([file, cap]) => [`data:image/${file.endsWith('.png') ? 'png' : 'jpeg'};base64,${readFileSync(file).toString('base64')}`, cap]);
  await c.ev(`(async () => {
    document.body.style.cssText = 'margin:0;background:#2b211f;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;box-sizing:border-box;font:16px ui-monospace,monospace;color:#efe0bf';
    const items = ${JSON.stringify(data)};
    for (const [src, cap] of items) { const f = document.createElement('figure'); f.style.margin = 0; const i = new Image(); i.src = src; i.style.cssText = 'width:100%;display:block'; f.append(i, cap); document.body.append(f); await i.decode(); }
    return true;
  })()`);
  const r = await c.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${out}.png`, Buffer.from(r.data, 'base64'));
  jpg(`${out}.png`, out, 1600, 70);
  rmSync(`${out}.png`);
}

const shots = SHOTS.filter((s) => !only || only.includes(s.id));
const server = await serve(ROOT);
const c = await chrome();
const report = [];
try {
  for (const shot of shots) {
    const png = join(OUT, `${shot.id}.png`);
    const r = await open(c, shot.id, [1280, 720]);
    if (tryCams) {
      for (const [i, cam] of tryCams.entries()) {
        await c.ev(`(() => { window.title.vista.setShot(${JSON.stringify(cam)}); return true; })()`);
        await sleep(700);
        if (process.env.EVAL) console.log(`v${i}:`, await c.ev(process.env.EVAL).catch((e) => e.message));
        const f = join(OUT, `${shot.id}-v${i}.png`);
        await grab(c, f, true);
        jpg(f, join(OUT, `${shot.id}-v${i}.jpg`), 960, 70);
      }
      await sheet(c, [[join(REFS, shot.ref), 'cover'], ...tryCams.map((cam, i) => [join(OUT, `${shot.id}-v${i}.jpg`), `v${i} ${JSON.stringify(cam.camera ?? {}).slice(0, 90)}`])], join(OUT, `${shot.id}-sheet.jpg`));
      console.log(`${shot.id}: ${tryCams.length} poses in ${OUT}/${shot.id}-sheet.jpg`);
      continue;
    }
    await grab(c, png, flag('clean'));
    report.push({ id: shot.id, level: shot.level, state: r.state, ms: r.ms, timing: r.timing });
    if (!tryCam && !flag('clean')) {
      mkdirSync(DOCS, { recursive: true });
      jpg(png, join(OUT, `${shot.id}.jpg`));
      await compare(c, shot, png, join(DOCS, `${shot.id}-compare.jpg`));
    } else await compare(c, shot, png, join(OUT, `${shot.id}-compare.jpg`));
    if (flag('sizes')) {
      for (const [w, h] of SIZES) {
        const mobile = w < 900 || h > w;
        await open(c, shot.id, [w, h], { mobile });
        console.log(`  ${w}x${h}:`, await c.ev(`JSON.stringify({ vw: innerWidth, vh: innerHeight, layout: window.title.root.dataset.layout, menu: window.title.root.style.getPropertyValue('--menu-left') + ',' + window.title.root.style.getPropertyValue('--menu-top') })`));
        await grab(c, join(OUT, `${shot.id}-${w}x${h}.png`), flag('clean'));
      }
    }
    console.log(`${shot.id} ${shot.level}: ${r.state}, title on screen ${Math.round(r.timing?.shown ?? -1)} ms, world ${Math.round(r.timing?.world ?? -1)} ms (stages ${JSON.stringify(r.timing?.stages ?? {})})`);
  }
} finally {
  await c.close();
  await server.close();
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
console.log(`pictures in ${OUT}`);
