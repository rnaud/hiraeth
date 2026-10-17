// The visual check's pairs (scripts/unity-compare/, D17): each view's web picture beside Unity's, a difference heat map,
// and numbers that find the pairs worth a look; one HTML report, worst first.
//   - SSIM of the two in grey at 256 px wide (8 px windows): the structure, 1 the same;
//   - colour: the mean colour of each cell of a 6 × 4 grid in CIE Lab, the mean and the worst ΔE (76) of the cells;
//   - ink: the share of dark pixels (L* < 30) on each side, the difference in points;
//   - edges: Sobel edges at 512 px on each side, how many of the web's are found within a pixel on Unity's (recall)
//     and the other way (precision), as an F1;
//   - the score: 50 (1 − SSIM) + 1.5 · mean ΔE + |ink difference|, higher is further apart.
//
//   node scripts/unity-compare/pair.mjs <web-dir> <unity-dir> <out-dir> [--views views.json] [--notes notes.json]
// <web-dir>/<world>--<view>.png (scripts/design-qc/capture.mjs), <unity-dir>/<world>/unity-<view>.png (unity.mjs).
// notes.json: { "<world>--<view>": "what differs, and whether it is a bug (fixed / open) or design" } shown beside each.
// Writes <out-dir>/index.html, pairs/<world>--<view>.webp (web | Unity | heat), scores.json.
import sharp from 'sharp';
import { lab, dE, raw, ssim } from './measure.mjs';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const [webDir, unityDir, outDir] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')).map((p) => resolve(p));
const notes = arg('notes') && existsSync(arg('notes')) ? JSON.parse(readFileSync(arg('notes'), 'utf8')) : {};
const viewInfo = {};
if (arg('views')) for (const v of JSON.parse(readFileSync(arg('views'), 'utf8')).views) viewInfo[v.name] = v;
mkdirSync(join(outDir, 'pairs'), { recursive: true });

function edges(g, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = (i, j) => g[(y + j) * w + x + i];
    const gx = -p(-1, -1) - 2 * p(-1, 0) - p(-1, 1) + p(1, -1) + 2 * p(1, 0) + p(1, 1);
    const gy = -p(-1, -1) - 2 * p(0, -1) - p(1, -1) + p(-1, 1) + 2 * p(0, 1) + p(1, 1);
    out[y * w + x] = Math.hypot(gx, gy) > 160 ? 1 : 0;
  }
  return out;
}
function near(e, w, h, x, y) { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const X = x + i, Y = y + j; if (X >= 0 && Y >= 0 && X < w && Y < h && e[Y * w + X]) return true; } return false; }
function edgeF1(a, b, w, h) {
  let na = 0, nb = 0, ha = 0, hb = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    if (a[k]) { na++; if (near(b, w, h, x, y)) ha++; }
    if (b[k]) { nb++; if (near(a, w, h, x, y)) hb++; }
  }
  const rec = na ? ha / na : 1, pre = nb ? hb / nb : 1;
  return { recall: rec, precision: pre, f1: rec + pre ? (2 * rec * pre) / (rec + pre) : 0 };
}

async function measure(web, unity) {
  // structure
  const W1 = 256, H1 = 144;
  const s = ssim(await raw(web, W1, H1, true), await raw(unity, W1, H1, true), W1, H1);
  // colour by region (6 × 4) and ink, at 320 × 180
  const W2 = 320, H2 = 180, A = await raw(web, W2, H2), Bb = await raw(unity, W2, H2);
  const GX = 6, GY = 4, cells = [];
  let inkA = 0, inkB = 0;
  const la = new Array(W2 * H2), lb = new Array(W2 * H2);
  for (let k = 0; k < W2 * H2; k++) { la[k] = lab(A[k * 3], A[k * 3 + 1], A[k * 3 + 2]); lb[k] = lab(Bb[k * 3], Bb[k * 3 + 1], Bb[k * 3 + 2]); if (la[k][0] < 30) inkA++; if (lb[k][0] < 30) inkB++; }
  for (let cy = 0; cy < GY; cy++) for (let cx = 0; cx < GX; cx++) {
    const ma = [0, 0, 0], mb = [0, 0, 0]; let n = 0;
    for (let y = Math.floor((cy * H2) / GY); y < Math.floor(((cy + 1) * H2) / GY); y++) for (let x = Math.floor((cx * W2) / GX); x < Math.floor(((cx + 1) * W2) / GX); x++) {
      const k = y * W2 + x; for (let c = 0; c < 3; c++) { ma[c] += la[k][c]; mb[c] += lb[k][c]; } n++;
    }
    cells.push(dE(ma.map((v) => v / n), mb.map((v) => v / n)));
  }
  // edges
  const W3 = 512, H3 = 288;
  const e = edgeF1(edges(await raw(web, W3, H3, true), W3, H3), edges(await raw(unity, W3, H3, true), W3, H3), W3, H3);
  const meanDE = cells.reduce((a, b) => a + b, 0) / cells.length, worstDE = Math.max(...cells);
  const ink = { web: (100 * inkA) / (W2 * H2), unity: (100 * inkB) / (W2 * H2) };
  const score = 50 * (1 - s) + 1.5 * meanDE + Math.abs(ink.web - ink.unity);
  return { ssim: +s.toFixed(3), meanDE: +meanDE.toFixed(1), worstDE: +worstDE.toFixed(1), worstCell: cells.indexOf(worstDE), ink: { web: +ink.web.toFixed(1), unity: +ink.unity.toFixed(1) }, edges: { f1: +e.f1.toFixed(3), recall: +e.recall.toFixed(3), precision: +e.precision.toFixed(3) }, score: +score.toFixed(1) };
}

/** web | Unity | the heat map of ΔE per pixel (blurred a little: the lines' own wobble is not a difference), 640 × 360 each. */
async function sheet(web, unity, file) {
  const w = 640, h = 360;
  const A = await sharp(web).resize(w, h, { fit: 'fill' }).removeAlpha().blur(1.2).raw().toBuffer();
  const B = await sharp(unity).resize(w, h, { fit: 'fill' }).removeAlpha().blur(1.2).raw().toBuffer();
  const heat = Buffer.alloc(w * h * 3);
  for (let k = 0; k < w * h; k++) {
    const d = Math.min(1, dE(lab(A[k * 3], A[k * 3 + 1], A[k * 3 + 2]), lab(B[k * 3], B[k * 3 + 1], B[k * 3 + 2])) / 40);
    // black → red → yellow → white
    heat[k * 3] = Math.round(255 * Math.min(1, d * 2)); heat[k * 3 + 1] = Math.round(255 * Math.max(0, Math.min(1, d * 2 - 0.7))); heat[k * 3 + 2] = Math.round(255 * Math.max(0, d * 3 - 2));
  }
  const tile = async (f) => sharp(f).resize(w, h, { fit: 'fill' }).removeAlpha().png().toBuffer();
  await sharp({ create: { width: w * 3, height: h, channels: 3, background: '#000' } })
    .composite([{ input: await tile(web), left: 0, top: 0 }, { input: await tile(unity), left: w, top: 0 }, { input: await sharp(heat, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer(), left: 2 * w, top: 0 }])
    .webp({ quality: 78 }).toFile(file);
}

const rows = [];
for (const f of readdirSync(webDir).filter((x) => x.endsWith('.png') && x.includes('--')).sort()) {
  const key = f.replace(/\.png$/, ''), [world, view] = key.split('--');
  const unity = join(unityDir, world, `unity-${view}.png`), web = join(webDir, f);
  if (!existsSync(unity)) { rows.push({ key, world, view, missing: 'unity' }); continue; }
  const m = await measure(web, unity);
  await sheet(web, unity, join(outDir, 'pairs', `${key}.webp`));
  rows.push({ key, world, view, ...m, note: notes[key] ?? '', hour: viewInfo[key]?.hour, about: viewInfo[key]?.note ?? '' });
  process.stdout.write(`${key}: score ${m.score} ssim ${m.ssim} ΔE ${m.meanDE} / ${m.worstDE} ink ${m.ink.web}/${m.ink.unity} edges ${m.edges.f1}\n`);
}
rows.sort((a, b) => (b.score ?? 1e9) - (a.score ?? 1e9));
writeFileSync(join(outDir, 'scores.json'), JSON.stringify(rows, null, 1));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const ok = rows.filter((r) => !r.missing);
const mean = (k) => (ok.reduce((a, r) => a + k(r), 0) / Math.max(ok.length, 1)).toFixed(3);
const html = `<!doctype html><meta charset="utf-8"><title>Hiraeth: the web against Unity</title>
<style>body{font:14px/1.4 -apple-system,system-ui,sans-serif;margin:24px;background:#f6f1e7;color:#2b211f}h1{font-size:22px}
.row{margin:0 0 28px;padding:12px;background:#fff;border:1px solid #d8cbb5}.row img{width:100%;display:block}.k{font-weight:600}
.n{color:#6b5d50;font-size:12px}.note{margin-top:6px;padding:6px 8px;background:#fdf4d8;border-left:3px solid #c9a447}
table{border-collapse:collapse;margin:8px 0 20px}td,th{padding:2px 10px;border-bottom:1px solid #e3d8c6;text-align:left;font-size:12px}</style>
<h1>The web against Unity: ${ok.length} views in ${new Set(ok.map((r) => r.world)).size} worlds</h1>
<p class="n">Each row: the web (headless Chrome, High, 1280 × 720) | Unity (the editor's batch, High, 1280 × 720) | the colour difference (ΔE per pixel, 40 = white). Worst first. Mean SSIM ${mean((r) => r.ssim)}, mean ΔE ${mean((r) => r.meanDE)}, mean edge F1 ${mean((r) => r.edges.f1)}.${rows.some((r) => r.missing) ? ` Missing on Unity's side: ${rows.filter((r) => r.missing).map((r) => r.key).join(', ')}.` : ''}</p>
<table><tr><th>view</th><th>score</th><th>SSIM</th><th>ΔE mean / worst</th><th>ink web / Unity %</th><th>edges F1</th><th>note</th></tr>
${ok.map((r) => `<tr><td><a href="#${r.key}">${r.key}</a></td><td>${r.score}</td><td>${r.ssim}</td><td>${r.meanDE} / ${r.worstDE}</td><td>${r.ink.web} / ${r.ink.unity}</td><td>${r.edges.f1}</td><td>${esc(r.note).slice(0, 90)}</td></tr>`).join('\n')}</table>
${ok.map((r) => `<div class="row" id="${r.key}"><div><span class="k">${r.key}</span> <span class="n">${esc(r.about)}${r.hour != null ? ` · ${r.hour} h` : ''} · score ${r.score} · SSIM ${r.ssim} · ΔE ${r.meanDE} (worst ${r.worstDE}) · ink ${r.ink.web} / ${r.ink.unity} % · edges F1 ${r.edges.f1}</span></div>
<img loading="lazy" src="${relative(outDir, join(outDir, 'pairs', `${r.key}.webp`))}">${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}</div>`).join('\n')}`;
writeFileSync(join(outDir, 'index.html'), html);
console.log(`${ok.length} pairs: ${join(outDir, 'index.html')}`);
