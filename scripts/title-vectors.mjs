// The title's vector drawings (issue #110, docs/systems/ui.md "The title screen"): each shot's still
// (docs/title-shots/stills/<id>.jpg, the world as the game draws it: scripts/title-shots.mjs --stills) traced into
// flat colour and ink (scripts/title-trace.mjs), written as public/title-vectors/<id>.svg, 1600 × 900, the
// mirrored shots flipped already. The title paints it the moment it opens, with no world, no WebGL and no
// big file (src/title-paint.js).
//
//   node scripts/title-vectors.mjs [ids] [--k 14] [--preview]   (--preview: a PNG of each under its still, in TMPDIR or PREVIEWS)
// One headless muted Chrome decodes the stills (and renders the previews); CDP (default 5397) is its port.
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { quantize, cleanLabels, components, loops, simplify, loopArea, pathOf, inkMask, close, thin, strokes, simplifyOpen, lineLength, strokePath } from './title-trace.mjs';

process.env.CDP ??= '5397';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { chrome } = await import('./changelog-shots.mjs');
const { SHOTS } = await import('../src/title-shots.js');
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const only = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))?.split(',');
const K = Number(arg('k', 18));
const VW = 1600, VH = 900;
const FILL = [640, 360];   // the colours' grid
const INK = [1600, 900];   // the ink's: the still's own size
const OUT = join(ROOT, 'public/title-vectors');
const STILLS = join(ROOT, 'docs/title-shots/stills');   // the game's own renders (scripts/title-shots.mjs --stills)
const INK_COLOUR = '#2b211f';
const PEN = 1.8;   // the pen's width, in the drawing's units (1600 across)
const SEAM = 0.9;  // the fills' own stroke, in the colours' grid: no paper between two colours
const EPS = Number(arg('eps', 0.9));   // how far an outline may stray from the pixels' edges (grid units)

const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

async function pixels(c, file, [w, h], mirror) {
  const b64 = readFileSync(file).toString('base64');
  const out = await c.ev(`(async () => {
    const img = new Image(); img.src = 'data:image/jpeg;base64,${b64}'; await img.decode();
    const cv = new OffscreenCanvas(${w}, ${h}), g = cv.getContext('2d');
    g.imageSmoothingQuality = 'high';
    ${mirror ? `g.translate(${w}, 0); g.scale(-1, 1);` : ''}
    g.drawImage(img, 0, 0, ${w}, ${h});
    const d = g.getImageData(0, 0, ${w}, ${h}).data;
    let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
    return btoa(s);
  })()`);
  return new Uint8ClampedArray(Buffer.from(out, 'base64'));
}

/** One still traced: the SVG's text and what is in it. */
export async function trace(c, shot) {
  const file = join(STILLS, `${shot.id}.jpg`);
  const [fw, fh] = FILL, [iw, ih] = INK;
  // the colours: k flat ones, speckle away
  const rgba = await pixels(c, file, FILL, shot.mirror);
  const q = quantize(rgba, fw, fh, { k: K, ink: inkMask(rgba, fw, fh, { reach: [1, 2], contrast: 22 }) });
  const labels = cleanLabels(q.labels, fw, fh, { passes: 2, minArea: 14 });
  const { comp, list } = components(labels, fw, fh);
  // the sky: the largest piece touching the top edge, painted as the whole picture's ground (whatever an outline
  // rounds off between two pieces shows sky, never the page)
  const top = list.filter((p) => p.box[1] === 0).sort((a, b) => b.area - a.area)[0];
  // fills: by colour, the big ones first (each stroked in its own colour too, so no seam of paper shows between two),
  // in the colours' grid scaled up (smaller numbers to write)
  const byLabel = new Map();
  for (const p of list) {
    if (p === top) continue;
    if (!byLabel.has(p.label)) byLabel.set(p.label, { label: p.label, ids: new Set(), area: 0 });
    const e = byLabel.get(p.label); e.ids.add(p.id); e.area += p.area;
  }
  const layer = (e) => {
    const ls = loops((i) => e.ids.has(comp[i]), fw, fh).map((l) => simplify(l, EPS)).filter((l) => Math.abs(loopArea(l)) >= 2);
    const col = hex(q.palette[e.label]);
    return `<path fill="${col}" stroke="${col}" d="${pathOf(ls, 1, { smooth: true, frame: [fw, fh] })}"/>`;
  };
  const land = [...byLabel.values()].sort((a, b) => b.area - a.area).map(layer);
  const sky = hex(q.palette[top?.label ?? 0]);
  // the ink: the still's own line work, at its own size, as pen strokes along its centre lines
  const ink = await pixels(c, file, INK, shot.mirror);
  const mask = close(inkMask(ink, iw, ih), iw, ih, 1);
  const inkComp = components(mask, iw, ih, { only: 1 });
  for (const p of inkComp.list) if (p.area < 14) for (const i of p.pixels) mask[i] = 0;
  thin(mask, iw, ih);
  const lines = strokes(mask, iw, ih).map((l) => simplifyOpen(l, 0.85)).filter((l) => lineLength(l) >= 6);
  const pen = (d) => `<path fill="none" stroke="${INK_COLOUR}" stroke-width="${PEN}" stroke-linecap="round" stroke-linejoin="round" d="${d}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid slice" data-shot="${shot.id}">`
    + `<rect class="sky" width="${VW}" height="${VH}" fill="${sky}"/>`
    + `<g class="land" transform="scale(${VW / fw})" stroke-width="${SEAM}" stroke-linejoin="round">${land.join('')}</g>`
    + `<g class="ink">${pen(strokePath(lines, VW / iw))}</g></svg>`;
  return { svg, colours: q.palette.length, sky, ink: lines.length };
}

const c = await chrome();
const previews = process.env.PREVIEWS ?? (args.includes('--preview') ? mkdtempSync(join(tmpdir(), 'title-vectors-')) : null);
if (previews) mkdirSync(previews, { recursive: true });
try {
  mkdirSync(OUT, { recursive: true });
  for (const shot of SHOTS.filter((s) => !only || only.includes(s.id))) {
    const t0 = Date.now();
    const r = await trace(c, shot);
    writeFileSync(join(OUT, `${shot.id}.svg`), r.svg);
    console.log(`${shot.id}: ${(r.svg.length / 1024).toFixed(0)} KB, ${r.colours} colours, ${r.ink} ink lines, sky ${r.sky} (${Date.now() - t0} ms)`);
    if (previews) {
      const still = readFileSync(join(STILLS, `${shot.id}.jpg`)).toString('base64');
      await c.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1800, deviceScaleFactor: 1, mobile: false });
      await c.send('Page.navigate', { url: 'about:blank' });
      await c.ev(`document.body.style.margin = 0; document.body.innerHTML = ${JSON.stringify(`<img style="display:block;width:1600px;height:900px${shot.mirror ? ';transform:scaleX(-1)' : ''}" src="data:image/jpeg;base64,${still}"><div style="width:1600px;height:900px">${r.svg}</div>`)}; true`);
      await new Promise((res) => setTimeout(res, 500));
      const png = await c.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(previews, `${shot.id}.png`), Buffer.from(png.data, 'base64'));
    }
  }
} finally {
  await c.close();
}
if (previews) console.log(`previews in ${previews}`);
