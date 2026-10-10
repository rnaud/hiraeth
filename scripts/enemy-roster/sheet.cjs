// Contact sheet for docs/design/enemy-roster.md: each archetype's two picked design sheets
// (references/enemy-archetypes/<id>/sheet-1.jpg, the main skin, and sheet-2.jpg, the alternate), the black shape the
// main sheet draws (found on it: its largest patch of plain black, or archetypes.json's `sil` crop of sheet-1), name,
// role, plan, tier and worlds.
// node scripts/enemy-roster/sheet.cjs [out.jpg] [one id]   (default out: docs/design/enemy-roster-sheet.jpg)
// sharp comes with the dev dependencies (npm install); it is not a direct dependency of the game.
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const R = path.resolve(__dirname, '../..') + '/';
const OUT = process.argv[2] || R + 'docs/design/enemy-roster-sheet.jpg';
const ONLY = process.argv[3];

const A = require(__dirname + '/archetypes.json');

const CAT = { creature: '#5d8a6a', machine: '#a8772e', spirit: '#6b4f8f' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function cropOf(c) {
  const file = R + c[1];
  const img = sharp(file);
  const m = await img.metadata();
  const [x0, y0, x1, y1] = c.slice(2);
  const left = Math.round(x0 * m.width), top = Math.round(y0 * m.height);
  const width = Math.round((x1 - x0) * m.width), height = Math.round((y1 - y0) * m.height);
  return sharp(file).extract({ left, top, width, height }).toBuffer();
}

// a black shape: the crop's plain dark pixels, its largest shape with the holes filled
async function silhouette(buf, h) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: hh } = info;
  const out = Buffer.alloc(w * hh);
  for (let i = 0; i < w * hh; i++) {
    // (the sheets' black shape: plain dark pixels; the paper and the drawings round it stay out)
    out[i] = (data[i * 3] + data[i * 3 + 1] + data[i * 3 + 2]) / 3 < 70 ? 0 : 255;
  }
  // close small gaps (blur, then threshold) at a working size
  const SW = 220, SH = Math.round(hh * SW / w);
  const g = await sharp(out, { raw: { width: w, height: hh, channels: 1 } }).resize(SW, SH).blur(1.2).extractChannel(0).raw().toBuffer();
  const ink = new Uint8Array(SW * SH);
  for (let i = 0; i < ink.length; i++) ink[i] = g[i] < 170 ? 1 : 0;
  // keep the largest connected shape (drops neighbours' edges and stray marks)
  const lab = new Int32Array(SW * SH); let best = 0, bestN = 0, id = 0;
  for (let s = 0; s < ink.length; s++) {
    if (!ink[s] || lab[s]) continue;
    id++; let n = 0; const st = [s]; lab[s] = id;
    while (st.length) {
      const p = st.pop(); n++;
      const x = p % SW, y = (p / SW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= SW || Y >= SH) continue;
        const q = Y * SW + X;
        if (ink[q] && !lab[q]) { lab[q] = id; st.push(q); }
      }
    }
    if (n > bestN) { bestN = n; best = id; }
  }
  // fill holes: whatever the outside can't reach is inside
  const outside = new Uint8Array(SW * SH); const st = [];
  for (let x = 0; x < SW; x++) st.push(x, (SH - 1) * SW + x);
  for (let y = 0; y < SH; y++) st.push(y * SW, y * SW + SW - 1);
  while (st.length) {
    const p = st.pop();
    if (outside[p] || lab[p] === best) continue;
    outside[p] = 1;
    const x = p % SW, y = (p / SW) | 0;
    if (x > 0) st.push(p - 1); if (x < SW - 1) st.push(p + 1);
    if (y > 0) st.push(p - SW); if (y < SH - 1) st.push(p + SW);
  }
  const px = Buffer.alloc(SW * SH);
  let x0 = SW, x1 = 0, y0 = SH, y1 = 0;
  for (let i = 0; i < px.length; i++) {
    const on = !outside[i];
    px[i] = on ? 0 : 255;
    if (on) { const x = i % SW, y = (i / SW) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  const trimmed = await sharp(px, { raw: { width: SW, height: SH, channels: 1 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer();
  return sharp(trimmed).resize({ height: h }).threshold(128).png().toBuffer();
}

// where the sheet draws its black shape: the largest patch of plain black (dark and grey, not an inked colour), as
// fractions of the sheet, padded
async function blackPatch(file) {
  const SW = 480;
  const { data, info } = await sharp(file).resize(SW).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info, ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    ink[i] = (r + g + b) / 3 < 58 && Math.max(r, g, b) - Math.min(r, g, b) < 20 ? 1 : 0;
  }
  const lab = new Int32Array(w * h); let best = null, id = 0;
  for (let s = 0; s < ink.length; s++) {
    if (!ink[s] || lab[s]) continue;
    id++; let n = 0, x0 = w, x1 = 0, y0 = h, y1 = 0; const st = [s]; lab[s] = id;
    while (st.length) {
      const p = st.pop(); n++;
      const x = p % w, y = (p / w) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const q = Y * w + X;
        if (ink[q] && !lab[q]) { lab[q] = id; st.push(q); }
      }
    }
    if (!best || n > best.n) best = { n, x0, x1, y0, y1 };
  }
  const pad = 0.015;
  return [Math.max(0, best.x0 / w - pad), Math.max(0, best.y0 / h - pad), Math.min(1, (best.x1 + 1) / w + pad), Math.min(1, (best.y1 + 1) / h + pad)];
}

(async () => {
  const CW = 460, COLS = 7, HEAD = 120, BOX_W = CW - 24, BOX_H = Math.round(BOX_W * 9 / 16), CH = 64 + BOX_H * 2 + 6 + 190;
  const list = ONLY ? A.filter((a) => a.id === ONLY) : A;
  const rows = Math.ceil(list.length / COLS);
  const W = CW * Math.min(COLS, list.length), H = HEAD + CH * rows + 40;
  const layers = [];
  const svgParts = [];
  svgParts.push(`<text x="24" y="54" font-family="Helvetica, Arial, sans-serif" font-size="38" font-weight="bold" fill="#2a2420">Hiraeth: the enemy roster (21 archetypes)</text>`);
  svgParts.push(`<text x="24" y="92" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#5a524a">Each archetype's picked design sheets (references/enemy-archetypes/&lt;id&gt;/sheet-1.jpg, the main skin, over sheet-2.jpg, the alternate), the black shape the main sheet draws as it reads far off. Colour band: <tspan fill="${CAT.creature}" font-weight="bold">creature</tspan>, <tspan fill="${CAT.machine}" font-weight="bold">possessed machine</tspan>, <tspan fill="${CAT.spirit}" font-weight="bold">spirit</tspan>. Details: docs/design/enemy-roster.md</text>`);
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const cx = (i % COLS) * CW, cy = HEAD + Math.floor(i / COLS) * CH;
    const sheets = [1, 2].map((n) => `references/enemy-archetypes/${a.id}/sheet-${n}.jpg`);
    for (let k = 0; k < 2; k++) {
      const fit = await sharp(R + sheets[k]).resize(BOX_W, BOX_H, { fit: 'contain', background: '#f3ece0' }).toBuffer();
      layers.push({ input: fit, left: cx + 12, top: cy + 64 + k * (BOX_H + 6) });
    }
    const silCrop = ['file', sheets[0], ...(a.sil ?? await blackPatch(R + sheets[0]))];
    const sil = await silhouette(await cropOf(silCrop), 96);
    const sm = await sharp(sil).metadata();
    const sy = cy + 64 + BOX_H * 2 + 16;
    layers.push({ input: await sharp(sil).resize({ width: Math.min(sm.width, 190), height: 96, fit: 'inside' }).toBuffer(), left: cx + 12, top: sy });
    const col = CAT[a.cat];
    svgParts.push(`<rect x="${cx + 6}" y="${cy + 4}" width="${CW - 12}" height="${CH - 10}" fill="none" stroke="#cfc4b2" stroke-width="2" rx="6"/>`);
    svgParts.push(`<rect x="${cx + 6}" y="${cy + 4}" width="${CW - 12}" height="8" fill="${col}" rx="3"/>`);
    svgParts.push(`<text x="${cx + 14}" y="${cy + 38}" font-family="Helvetica, Arial, sans-serif" font-size="25" font-weight="bold" fill="#2a2420">${i + 1}. ${esc(a.name)}</text>`);
    svgParts.push(`<text x="${cx + 14}" y="${cy + 58}" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="${col}" font-weight="bold">${esc(a.role)}</text>`);
    svgParts.push(`<text x="${cx + 214}" y="${sy + 26}" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#2a2420">${esc(a.plan)}</text>`);
    svgParts.push(`<text x="${cx + 214}" y="${sy + 46}" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#5a524a">tier ${esc(a.tier)}</text>`);
    svgParts.push(`<text x="${cx + 214}" y="${sy + 66}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#8a8072">${esc(a.from || '')}</text>`);
    const lines = a.sig.match(/.{1,52}(\s|$)/g) || [a.sig];
    lines.slice(0, 2).forEach((l, j) => svgParts.push(`<text x="${cx + 14}" y="${sy + 124 + j * 18}" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#2a2420">${esc(l.trim())}</text>`));
    svgParts.push(`<text x="${cx + 14}" y="${sy + 162}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#5a524a">${esc(a.worlds)}</text>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svgParts.join('')}</svg>`;
  layers.push({ input: Buffer.from(svg), left: 0, top: 0 });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#f7f1e6' } })
    .composite(layers).jpeg({ quality: 76, mozjpeg: true }).toFile(OUT);
  console.log(OUT, fs.statSync(OUT).size, W, H);
})();
