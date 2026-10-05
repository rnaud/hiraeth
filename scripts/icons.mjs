// The app's icons, from a capture of the game itself: one of the References level's views
// (docs/systems/app-icon.md). Two steps, each runnable alone:
//
//   node scripts/icons.mjs capture [--view 3786-island] [--box cx,cy,size]   → docs/icon/capture.png
//   node scripts/icons.mjs build [--from docs/icon/capture.png]               → every size
//   node scripts/icons.mjs all                                                 (both)
//
// capture: starts its own Vite (PORT, default 5853), opens ?level=references&view=<n> in headless
// Chrome (muted, the game's volumes at 0, PLAYWRIGHT / CHROME as in the other scripts), hides the
// page's HTML (no HUD, no comparison overlay) and the view's people, renders a square frame at 2x
// and cuts `box` out of it: the icon's 108-unit adaptive canvas (centre x, y and side, as fractions
// of the frame). Chrome's GPU is needed (ANGLE on Metal on the Mac).
//
// build: the capture is the 108-unit canvas; the launcher shows its middle 72 and keeps the round
// 66-unit safe zone. The sky is keyed out (a flood from the edges over the sky's colour, stopped by
// the ink) into the adaptive foreground; the background is the sky alone; the monochrome layer is
// the foreground's silhouette. Every size is drawn from the capture on a canvas, halving down:
//
//   Android  mipmap-*/ic_launcher.png (legacy, rounded square), ic_launcher_round.png,
//            ic_launcher_{foreground,background,monochrome}.png (108 dp),
//            mipmap-anydpi-v26/ic_launcher{,_round}.xml, drawable*/splash.png (before Android 12)
//   web      favicon.ico (16/32/48), icons/icon-{180,192,512}.png (apple-touch, "any", the
//            Play-style 512 that the Steam Deck and Electron use too), icons/maskable-{192,512}.png
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(ROOT, 'android/app/src/main/res');
const PUBLIC = join(ROOT, 'public');
const CAPTURE = join(ROOT, 'docs/icon/capture.png');
const PAPER = '#f7ecd2';   // the splash's paper (capacitor.config.json's backgroundColor)

/** The view the icon is cut from; its zoom (the view's field of view widened that many times, so
 *  its subject fits the safe zone) and lift (the camera lowered that many metres, eye and aim, so
 *  the horizon drops away under a floating subject); the 108-unit canvas in the square frame
 *  (centre x, y, side, as fractions); and what the monochrome layer keeps of the foreground:
 *  'skyline', what stands above the ground and a strip of it; 'inner', the shapes that don't touch
 *  the canvas's edge (a floating island, not the horizon under it); or 'all'.
 *  The other candidates (docs/icon/candidates/): 3786-island zoom 2 box 0.5125,0.469,0.783 'inner';
 *  3785-spires zoom 1.9 box 0.506,0.506,0.925; 3785-bird-palace zoom 2.3 box 0.55,0.45,0.894;
 *  3779-floating-tower zoom 2 box 0.5225,0.547,0.6625. */
export const ICON = { view: '3774-dish-city', zoom: 1.2, lift: 0, box: [0.569, 0.431, 0.825], mono: 'skyline' };
/** The capture's frame (px, square) and its render scale (the game's antialiasing). */
export const FRAME = 1600, RENDER_SCALE = 2;

// What each output shows of the 108-unit canvas: the launcher the middle 72 (its mask's viewport),
// the maskable web icon a little more (the 66-unit safe circle inside its 80% circle), the favicon
// a little less (the subject larger in a 16 px tab).
export const VIEW = { full: [18, 72], maskable: [12, 84], layer: [0, 108], favicon: [22, 64] };
export const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
export const SPLASH = {
  drawable: [480, 320],
  'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280],
  'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920],
};
export const WEB = { 'icon-180.png': [180, 'full'], 'icon-192.png': [192, 'full'], 'icon-512.png': [512, 'full'],
  'maskable-192.png': [192, 'maskable'], 'maskable-512.png': [512, 'maskable'] };
export const FAVICON = [16, 32, 48];
export const ADAPTIVE = `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by scripts/icons.mjs from docs/icon/capture.png -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;

/** An .ico holding PNGs (every browser reads PNG entries). */
export function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head[e] = size % 256; head[e + 1] = size % 256;
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const out = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); console.log(path.slice(ROOT.length + 1)); };
const png = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');

async function browser(gpu) {
  const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core');
  return chromium.launch({
    executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--mute-audio', '--autoplay-policy=user-gesture-required', ...(gpu ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [])],
  });
}

// ------------------------------------------------------------------ capture
async function capture({ view = ICON.view, zoom = ICON.zoom, lift = ICON.lift, box = ICON.box, to = CAPTURE } = {}) {
  const { createServer } = await import('vite');
  const port = Number(process.env.PORT ?? 5853);
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port, strictPort: true } });
  await server.listen();
  const BASE = `http://localhost:${port}/`;
  const b = await browser(true);
  try {
    const page = await (await b.newContext({ viewport: { width: FRAME, height: FRAME }, deviceScaleFactor: 1 })).newPage();
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    await page.goto(BASE + 'manifest.webmanifest');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('moebius.muted', '1');
      localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'items.v': 2 }, keepsakes: [] }));
      localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: 'high', showFps: false, music: 0, effects: 0, voices: 0 }));
    });
    // (the views are numbered from 1 in the address; an id is looked up once the level is up)
    await page.goto(`${BASE}?level=references&view=${/^\d+$/.test(view) ? view : 1}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__moebiusBooted && window.renderFrame && window.player && window.level?.held, null, { timeout: 300000, polling: 200 });
    const n = await page.evaluate(({ view, rs }) => {
      window.sound?.setVolumes?.(0, 0);
      window.quality.renderScale = rs; window.preset().dynamic = null; window.resize();
      window.weather.mode = 'clear';
      const hide = document.createElement('style');
      hide.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }';
      document.head.appendChild(hide);
      for (const p of window.npcs) { p.hide(); p.show = () => {}; p.cape?.mesh.removeFromParent(); }   // no people (nor their capes) in the icon
      const i = /^\d+$/.test(view) ? Number(view) - 1 : window.level.views.findIndex((v) => v.def.id === view);
      if (i < 0) throw new Error(`no view ${view}`);
      window.level.goTo(i);
      return i + 1;
    }, { view: String(view), rs: RENDER_SCALE });
    await page.waitForTimeout(3500);   // the fade to the view, its hour and its look settled
    // wider: the held view's field of view, which the level sets on the camera every frame
    // (the held view's camera, which the level puts on the screen's camera every frame)
    await page.evaluate(({ zoom, lift }) => {
      const v = window.level.held;
      v.cam.fov = 2 * Math.atan(Math.tan((v.cam.fov * Math.PI) / 360) * zoom) * 180 / Math.PI;
      v.eye.y -= lift; v.target.y -= lift;
    }, { zoom, lift });
    await page.waitForTimeout(800);
    const [cx, cy, side] = box, s = Math.round(side * FRAME);
    const clip = { x: Math.round(cx * FRAME - s / 2), y: Math.round(cy * FRAME - s / 2), width: s, height: s };
    if (clip.x < 0 || clip.y < 0 || clip.x + s > FRAME || clip.y + s > FRAME) throw new Error('the box leaves the frame');
    out(to, await page.screenshot({ type: 'png', clip }));
    console.log(`view ${n} (${view}), zoom ${zoom}, lift ${lift}, box ${box.join(',')}: ${s} px`);
  } finally {
    await b.close();
    await server.close();
  }
}

// ------------------------------------------------------------------ build (in a page, on canvases)
const PAGE = String.raw`
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
/** src (an image or canvas, square) → its square [x, side] (in 108ths) at s px, halving down for a clean small size. */
function cut(src, [x0, side], s) {
  const k = src.width / 108;
  let c = canvas(Math.round(side * k)); c.getContext('2d').drawImage(src, -x0 * k, -x0 * k);
  while (c.width / 2 >= s) { const d = canvas(Math.round(c.width / 2)); const g = d.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, d.width, d.height); c = d; }
  const d = canvas(s); const g = d.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, s, s);
  return d;
}
function shape(c, kind, inset = 0) {
  const s = c.width, d = canvas(s), g = d.getContext('2d');
  g.beginPath();
  if (kind === 'circle') g.arc(s / 2, s / 2, s / 2 - inset, 0, Math.PI * 2);
  else g.roundRect(inset, inset, s - 2 * inset, s - 2 * inset, (s - 2 * inset) * 0.18);
  g.clip(); g.drawImage(c, 0, 0);
  return d;
}
/** The sky keyed out: a flood from the edges over pixels near their neighbour and near the sky's colour
 *  (on a blurred copy, so the paper's grain doesn't stop it; the ink does). → { fg, bg, mono } canvases. */
function split(img, monoKeep) {
  const S = img.width, src = canvas(S), g = src.getContext('2d'); g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, S, S).data;
  const bl = canvas(S), gb = bl.getContext('2d'); gb.filter = 'blur(' + Math.max(1, S / 400) + 'px)'; gb.drawImage(img, 0, 0);
  const b = gb.getImageData(0, 0, S, S).data;
  const at = (i) => [b[i * 4], b[i * 4 + 1], b[i * 4 + 2]];
  const dist = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
  // the sky: the top row's median colour
  const top = []; for (let x = 0; x < S; x++) top.push(at(x));
  const med = [0, 1, 2].map((c) => top.map((p) => p[c]).sort((a, z) => a - z)[S >> 1]);
  const sky = new Uint8Array(S * S), stack = [];
  const seed = (i) => { if (!sky[i] && dist(at(i), med) < 60) { sky[i] = 1; stack.push(i); } };
  for (let x = 0; x < S; x++) { seed(x); }
  for (let y = 0; y < S; y++) { seed(y * S); seed(y * S + S - 1); }
  while (stack.length) {
    const i = stack.pop(), x = i % S, y = (i / S) | 0, p = at(i);
    for (const j of [x > 0 ? i - 1 : -1, x < S - 1 ? i + 1 : -1, y > 0 ? i - S : -1, y < S - 1 ? i + S : -1]) {
      if (j < 0 || sky[j]) continue;
      const q = at(j);
      if (dist(p, q) < 7 && dist(q, med) < 90) { sky[j] = 1; stack.push(j); }
    }
  }
  // the background: each row's sky colour (rows with none keep the one above), smoothed down the rows
  const rows = new Float32Array(S * 3); let last = med;
  for (let y = 0; y < S; y++) {
    let r = 0, gg = 0, bb = 0, n = 0;
    for (let x = 0; x < S; x++) { const i = y * S + x; if (sky[i]) { r += px[i * 4]; gg += px[i * 4 + 1]; bb += px[i * 4 + 2]; n++; } }
    if (n > S / 50) last = [r / n, gg / n, bb / n];
    rows.set(last, y * 3);
  }
  const bg = canvas(S), g2 = bg.getContext('2d'), bd = g2.createImageData(S, S);
  const R = Math.round(S / 60);
  for (let y = 0; y < S; y++) {
    const c = [0, 0, 0]; let n = 0;
    for (let k = Math.max(0, y - R); k <= Math.min(S - 1, y + R); k++, n++) for (let ch = 0; ch < 3; ch++) c[ch] += rows[k * 3 + ch];
    for (let x = 0; x < S; x++) { const i = (y * S + x) * 4; bd.data[i] = c[0] / n; bd.data[i + 1] = c[1] / n; bd.data[i + 2] = c[2] / n; bd.data[i + 3] = 255; }
  }
  g2.putImageData(bd, 0, 0);
  // the foreground: the capture where it isn't sky, its edge softened by a pixel
  const m = canvas(S), gm = m.getContext('2d'), md = gm.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { md.data[i * 4 + 3] = sky[i] ? 0 : 255; }
  gm.putImageData(md, 0, 0);
  const soft = canvas(S), gs = soft.getContext('2d'); gs.filter = 'blur(' + Math.max(0.6, S / 1200) + 'px)'; gs.drawImage(m, 0, 0);
  const fg = canvas(S), gf = fg.getContext('2d'); gf.drawImage(soft, 0, 0); gf.globalCompositeOperation = 'source-in'; gf.drawImage(img, 0, 0);
  // the monochrome: the foreground's silhouette ('inner': without the shapes touching the edge)
  if (monoKeep === 'inner') {
    const seen = new Uint8Array(S * S), edge = [];
    for (let x = 0; x < S; x++) edge.push(x, (S - 1) * S + x);
    for (let y = 0; y < S; y++) edge.push(y * S, y * S + S - 1);
    for (const i0 of edge) if (!sky[i0] && !seen[i0]) {
      seen[i0] = 1; const st = [i0];
      while (st.length) {
        const i = st.pop(), x = i % S, y = (i / S) | 0;
        for (const j of [x > 0 ? i - 1 : -1, x < S - 1 ? i + 1 : -1, y > 0 ? i - S : -1, y < S - 1 ? i + S : -1]) if (j >= 0 && !sky[j] && !seen[j]) { seen[j] = 1; st.push(j); }
      }
    }
    for (let i = 0; i < S * S; i++) if (seen[i]) md.data[i * 4 + 3] = 0;
    gm.putImageData(md, 0, 0);
  } else if (monoKeep === 'skyline') {
    // the first row that is all ground, and a strip of it; below that, nothing
    let y0 = S;
    for (let y = 0; y < S && y0 === S; y++) { let n = 0; for (let x = 0; x < S; x++) n += sky[y * S + x] ? 0 : 1; if (n > 0.97 * S) y0 = y; }
    for (let i = (y0 + Math.round(S / 40)) * S; i < S * S; i++) md.data[i * 4 + 3] = 0;
    gm.putImageData(md, 0, 0);
  }
  const ms = canvas(S), gms = ms.getContext('2d'); gms.filter = 'blur(' + Math.max(0.6, S / 1200) + 'px)'; gms.drawImage(m, 0, 0);
  const mono = canvas(S), go = mono.getContext('2d'); go.drawImage(ms, 0, 0); go.globalCompositeOperation = 'source-in'; go.fillStyle = '#fff'; go.fillRect(0, 0, S, S);
  return { fg, bg, mono, skyShare: sky.reduce((a, v) => a + v, 0) / (S * S) };
}
window.iconBuild = async (src, J) => {
  const img = await load(src), u = (c) => c.toDataURL('image/png');
  const { fg, bg, mono, skyShare } = split(img, J.mono);
  const r = { android: {}, splash: {}, web: {}, favicon: [], skyShare };
  for (const [d, k] of Object.entries(J.DENSITIES)) {
    const s = 48 * k, legacy = cut(img, J.VIEW.full, s - 2 * k), c = canvas(s);
    c.getContext('2d').drawImage(legacy, k, k);
    r.android[d] = { ic_launcher: u(shape(c, 'rounded', k)), ic_launcher_round: u(shape(c, 'circle', k)),
      ic_launcher_foreground: u(cut(fg, J.VIEW.layer, 108 * k)), ic_launcher_background: u(cut(bg, J.VIEW.layer, 108 * k)),
      ic_launcher_monochrome: u(cut(mono, J.VIEW.layer, 108 * k)) };
  }
  for (const [dir, [w, h]] of Object.entries(J.SPLASH)) {
    const s = Math.round(Math.min(w, h) / 3), c = canvas(w, h), g = c.getContext('2d');
    g.fillStyle = J.PAPER; g.fillRect(0, 0, w, h);
    g.drawImage(shape(cut(img, J.VIEW.full, s), 'rounded'), (w - s) >> 1, (h - s) >> 1);
    r.splash[dir] = u(c);
  }
  for (const [name, [s, v]] of Object.entries(J.WEB)) r.web[name] = u(cut(img, J.VIEW[v], s));
  for (const s of J.FAVICON) r.favicon.push(u(shape(cut(img, J.VIEW.favicon, s), 'rounded')));
  return r;
};`;

async function build(from = CAPTURE, mono = ICON.mono) {
  const b = await browser(false);
  try {
    const page = await b.newPage();
    await page.setContent(`<!doctype html><script>${PAGE}</script>`);
    const src = `data:image/png;base64,${readFileSync(from).toString('base64')}`;
    const r = await page.evaluate(([src, J]) => window.iconBuild(src, J), [src, { DENSITIES, SPLASH, WEB, VIEW, FAVICON, PAPER, mono }]);
    for (const [d, files] of Object.entries(r.android)) for (const [name, data] of Object.entries(files)) out(join(RES, `mipmap-${d}`, `${name}.png`), png(data));
    for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) out(join(RES, 'mipmap-anydpi-v26', name), ADAPTIVE);
    for (const [dir, data] of Object.entries(r.splash)) out(join(RES, dir, 'splash.png'), png(data));
    for (const [name, data] of Object.entries(r.web)) out(join(PUBLIC, 'icons', name), png(data));
    out(join(PUBLIC, 'favicon.ico'), ico(r.favicon.map((data, i) => ({ size: FAVICON[i], data: png(data) }))));
    console.log(`sky keyed out: ${(r.skyShare * 100).toFixed(0)}% of the canvas`);
  } finally {
    await b.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const step = ['capture', 'build', 'all'].includes(process.argv[2]) ? process.argv[2] : 'build';
  const box = arg('box') ? arg('box').split(',').map(Number) : undefined;
  const num = (name) => (arg(name) !== undefined ? Number(arg(name)) : undefined);
  if (step !== 'build') await capture({ view: arg('view'), zoom: num('zoom'), lift: num('lift'), box, to: arg('out') ? resolve(arg('out')) : CAPTURE });
  if (step !== 'capture') await build(arg('from') ? resolve(arg('from')) : CAPTURE, arg('mono') ?? ICON.mono);
}
