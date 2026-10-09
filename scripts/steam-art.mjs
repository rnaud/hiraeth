// Steam's library artwork for the Deck's shortcut, from captures of the game itself (References
// views, docs/systems/app-icon.md) and the title's own lettering (src/title-logo.js):
//
//   node scripts/steam-art.mjs capture [--only hero]       → docs/steam/capture-<art>.png (committed)
//   node scripts/steam-art.mjs build                        → desktop/steam/{portrait,wide,hero,logo}.png
//   node scripts/steam-art.mjs all                          (both)
//   node scripts/steam-art.mjs survey --views a,b --size 1920x620 --out <dir>   (to choose views)
//
// deck.py copies them into each Steam account's config/grid/ under the shortcut's app id
// (<id>p.png the portrait capsule, <id>.png the wide one, <id>_hero.png, <id>_logo.png, and the app
// icon as <id>_icon.png). capture starts its own Vite (PORT, default 5854) and headless Chrome on the
// GPU (muted, the game's volumes at 0; PLAYWRIGHT / CHROME as in the other scripts), hides the
// page's HTML and the views' people, and renders each view at its art's size at 2x.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logoSvg as letterLogo, LOGO_BOX } from '../src/title-logo.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURES = join(ROOT, 'docs/steam');
const OUT = join(ROOT, 'desktop/steam');   // (the Deck package's resources/app/steam/, not the web game)

/**
 * Each art's view, size (Steam's), the view's field of view widened `zoom` times, its camera lowered
 * `lift` metres and turned `pan` degrees to the right, and where the title goes (`logo`: its centre
 * as fractions of the art, its width as a fraction of the art's width; none on the hero, which Steam
 * puts the logo over).
 */
export const ART = {
  hero: { view: '3772-saucers', size: [1920, 620], zoom: 1, lift: 0, pan: 0 },
  wide: { view: '3784-cliff-monastery', size: [920, 430], zoom: 1.5, lift: -6, pan: 0, logo: { x: 0.5, y: 0.17, width: 0.56 } },
  portrait: { view: '3786-island', size: [600, 900], zoom: 1, lift: 0, pan: 0, logo: { x: 0.5, y: 0.15, width: 0.9 } },
};
/** The transparent logo Steam lays over the hero: the lettering carries its own ink line and shadow,
 *  so it reads on the sand where Steam puts it by default. */
export const LOGO_SIZE = [1280, 320];
export const inked = (svg) => svg;
export const RENDER_SCALE = 2;
/** Steam's names in config/grid/, after the shortcut's app id: the package's files (resources/app/), as deck.py STEAM_ART. */
export const GRID = { 'p.png': 'steam/portrait.png', '.png': 'steam/wide.png', '_hero.png': 'steam/hero.png', '_logo.png': 'steam/logo.png', '_icon.png': 'game/icons/icon-512.png' };

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const out = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); console.log(path.startsWith(ROOT) ? path.slice(ROOT.length + 1) : path); };
const png = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');
/** The title's lettering, as the title screen draws it. */
export const logoSvg = () => letterLogo({ ink: 16 }).replace('<svg class="logo"', `<svg width="1000" height="${Math.round((1000 * LOGO_BOX.h) / LOGO_BOX.w)}"`);

async function browser(gpu) {
  const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core');
  return chromium.launch({
    executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--mute-audio', '--autoplay-policy=user-gesture-required', ...(gpu ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [])],
  });
}

// ------------------------------------------------------------------ capture
/** shots: [{ view, size, zoom, lift, pan, to }] → PNGs of those views, one page per size. */
async function capture(shots) {
  const { createServer } = await import('vite');
  const port = Number(process.env.PORT ?? 5854);
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port, strictPort: true, fs: { strict: false } } });
  await server.listen();
  const BASE = `http://localhost:${port}/`;
  const b = await browser(true);
  try {
    for (const shot of shots) {
      const [width, height] = shot.size;
      const page = await (await b.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage();
      page.on('pageerror', (e) => console.log('pageerror', e.message));
      await page.goto(BASE + 'manifest.webmanifest');
      await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('moebius.muted', '1');
        localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'items.v': 2 }, keepsakes: [] }));
        localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: 'high', showFps: false, music: 0, effects: 0, voices: 0 }));
      });
      await page.goto(`${BASE}?level=references&view=${encodeURIComponent(shot.view)}`, { waitUntil: 'load' });   // (a number or a view's id: the level opens on its world)
      await page.waitForFunction(() => window.__moebiusBooted && window.renderFrame && window.player && window.level?.held, null, { timeout: 300000, polling: 200 });
      const n = await page.evaluate(({ view, rs }) => {
        window.sound?.setVolumes?.(0, 0);
        window.quality.renderScale = rs; window.preset().dynamic = null; window.resize();
        window.weather.mode = 'clear';
        const hide = document.createElement('style');
        hide.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }';
        document.head.appendChild(hide);
        for (const p of window.npcs) { p.hide(); p.show = () => {}; p.cape?.mesh.removeFromParent(); }
        const i = /^\d+$/.test(view) ? Number(view) - 1 : window.level.views.find((v) => v.def.id === view)?.i ?? -1;   // (level.views: the world built; v.i its number)
        if (i < 0) throw new Error(`no view ${view}`);
        window.level.goTo(i);
        return i + 1;
      }, { view: String(shot.view), rs: RENDER_SCALE });
      await page.waitForTimeout(3500);   // the fade to the view, its hour and its look settled
      await page.evaluate(({ zoom = 1, lift = 0, pan = 0 }) => {
        const v = window.level.held;
        v.cam.fov = 2 * Math.atan(Math.tan((v.cam.fov * Math.PI) / 360) * zoom) * 180 / Math.PI;
        v.eye.y -= lift; v.target.y -= lift;
        if (pan) {   // turn the aim round the eye
          const a = (pan * Math.PI) / 180, dx = v.target.x - v.eye.x, dz = v.target.z - v.eye.z;
          v.target.x = v.eye.x + dx * Math.cos(a) - dz * Math.sin(a);
          v.target.z = v.eye.z + dx * Math.sin(a) + dz * Math.cos(a);
        }
      }, shot);
      await page.waitForTimeout(800);
      out(shot.to, await page.screenshot({ type: 'png' }));
      console.log(`  view ${n} (${shot.view}) at ${width}×${height}, zoom ${shot.zoom ?? 1}, lift ${shot.lift ?? 0}, pan ${shot.pan ?? 0}`);
      await page.context().close();
    }
  } finally {
    await b.close();
    await server.close();
  }
}

// ------------------------------------------------------------------ build (in a page, on canvases)
const PAGE = String.raw`
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
window.artBuild = async (J) => {
  const svg = (text) => load('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text))));
  const logo = await svg(J.svg), ink = await svg(J.inked);
  const r = {};
  for (const [name, a] of Object.entries(J.art)) {
    const [w, h] = a.size, img = await load(J.captures[name]), c = canvas(w, h), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, h);
    if (a.logo) {
      const lw = a.logo.width * w, lh = lw / 4;
      g.drawImage(logo, a.logo.x * w - lw / 2, a.logo.y * h - lh / 2, lw, lh);
    }
    r[name] = c.toDataURL('image/png');
  }
  const [lw, lh] = J.logoSize, c = canvas(lw, lh), g = c.getContext('2d');
  g.drawImage(ink, 0, 0, lw, lh);
  r.logo = c.toDataURL('image/png');
  return r;
};`;

async function build() {
  const b = await browser(false);
  try {
    const page = await b.newPage();
    await page.setContent(`<!doctype html><script>${PAGE}</script>`);
    const captures = Object.fromEntries(Object.keys(ART).map((name) => [name, `data:image/png;base64,${readFileSync(join(CAPTURES, `capture-${name}.png`)).toString('base64')}`]));
    const r = await page.evaluate((J) => window.artBuild(J), { art: ART, captures, svg: logoSvg(), inked: inked(logoSvg()), logoSize: LOGO_SIZE });
    for (const [name, data] of Object.entries(r)) out(join(OUT, `${name}.png`), png(data));
  } finally {
    await b.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const step = process.argv[2] ?? 'all';
  if (step === 'survey') {
    const [w, h] = arg('size', '1920x620').split('x').map(Number), dir = resolve(arg('out', 'output/steam-survey'));
    await capture(arg('views').split(',').map((view) => ({ view, size: [w, h], zoom: Number(arg('zoom', 1)), to: join(dir, `${view}-${w}x${h}.png`) })));
  } else {
    const only = arg('only');
    if (step === 'capture' || step === 'all') {
      await capture(Object.entries(ART).filter(([name]) => !only || name === only).map(([name, a]) => ({ ...a, to: join(CAPTURES, `capture-${name}.png`) })));
    }
    if (step === 'build' || step === 'all') await build();
  }
}
