// Contact sheet for docs/design/enemy-roster.md: each archetype's reference crops, a silhouette, name, role.
// node scripts/enemy-roster/sheet.cjs [out.jpg] [one id]   (default out: docs/design/enemy-roster-sheet.jpg)
// The crops are in archetypes.json: [world, lineup file 1-4, x0, y0, x1, y1] in fractions of the image.
// sharp comes with the dev dependencies (npm install); it is not a direct dependency of the game.
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const R = path.resolve(__dirname, '../..') + '/';
const roster = require(R + 'references/archive/world-enemies/enemy-roster.json');
const DIR = Object.fromEntries(roster.worlds.map((w) => [w.world, w]));
const OUT = process.argv[2] || R + 'docs/design/enemy-roster-sheet.jpg';
const ONLY = process.argv[3];

const A = require(__dirname + '/archetypes.json');

const CAT = { creature: '#5d8a6a', machine: '#a8772e', spirit: '#6b4f8f' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function cropOf(c) {
  let file;
  if (c[0] === 'file') file = R + c[1];
  else file = R + DIR[c[0]].directory + '/' + DIR[c[0]].files[c[1] - 1].file;
  const img = sharp(file);
  const m = await img.metadata();
  const [x0, y0, x1, y1] = c.slice(2);
  const left = Math.round(x0 * m.width), top = Math.round(y0 * m.height);
  const width = Math.round((x1 - x0) * m.width), height = Math.round((y1 - y0) * m.height);
  return sharp(file).extract({ left, top, width, height }).toBuffer();
}

// a black shape: pixels away from the paper's colour (the border's median) go black
async function silhouette(buf, h) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: hh } = info;
  const border = [];
  for (let x = 0; x < w; x += 2) { border.push(x, 0); border.push(x, hh - 1); }
  for (let y = 0; y < hh; y += 2) { border.push(0, y); border.push(w - 1, y); }
  const ch = [[], [], []];
  for (let i = 0; i < border.length; i += 2) {
    const o = (border[i + 1] * w + border[i]) * 3;
    for (let k = 0; k < 3; k++) ch[k].push(data[o + k]);
  }
  const med = ch.map((a) => a.sort((p, q) => p - q)[a.length >> 1]);
  const out = Buffer.alloc(w * hh);
  for (let i = 0; i < w * hh; i++) {
    const d = Math.abs(data[i * 3] - med[0]) + Math.abs(data[i * 3 + 1] - med[1]) + Math.abs(data[i * 3 + 2] - med[2]);
    out[i] = d > 60 ? 0 : 255;
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

(async () => {
  const CW = 380, CH = 520, COLS = 7, HEAD = 120;
  const list = ONLY ? A.filter((a) => a.id === ONLY) : A;
  const rows = Math.ceil(list.length / COLS);
  const W = CW * Math.min(COLS, list.length), H = HEAD + CH * rows + 40;
  const layers = [];
  const svgParts = [];
  svgParts.push(`<text x="24" y="54" font-family="Helvetica, Arial, sans-serif" font-size="38" font-weight="bold" fill="#2a2420">Hiraeth: enemy roster proposal (21 archetypes)</text>`);
  svgParts.push(`<text x="24" y="92" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#5a524a">Reference crops from references/archive/world-enemies/* (Midjourney), the black shape below each as it would read far off. Colour band: <tspan fill="${CAT.creature}" font-weight="bold">creature</tspan>, <tspan fill="${CAT.machine}" font-weight="bold">possessed machine</tspan>, <tspan fill="${CAT.spirit}" font-weight="bold">spirit</tspan>. Details: docs/design/enemy-roster.md</text>`);
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const cx = (i % COLS) * CW, cy = HEAD + Math.floor(i / COLS) * CH;
    const n = a.crops.length;
    const boxW = Math.floor((CW - 24 - (n - 1) * 6) / n), boxH = 300;
    let first;
    for (let k = 0; k < n; k++) {
      const buf = await cropOf(a.crops[k]);
      if (!k) first = buf;
      const fit = await sharp(buf).resize(boxW, boxH, { fit: 'contain', background: '#f3ece0' }).toBuffer();
      layers.push({ input: fit, left: cx + 12 + k * (boxW + 6), top: cy + 64 });
    }
    const sil = await silhouette(a.silhouette ? await cropOf(a.silhouette) : first, 76);
    const sm = await sharp(sil).metadata();
    const sw = Math.min(sm.width, 150);
    layers.push({ input: await sharp(sil).resize({ width: sw, height: 76, fit: 'inside' }).toBuffer(), left: cx + 12, top: cy + 366 });
    const col = CAT[a.cat];
    svgParts.push(`<rect x="${cx + 6}" y="${cy + 4}" width="${CW - 12}" height="${CH - 10}" fill="none" stroke="#cfc4b2" stroke-width="2" rx="6"/>`);
    svgParts.push(`<rect x="${cx + 6}" y="${cy + 4}" width="${CW - 12}" height="8" fill="${col}" rx="3"/>`);
    svgParts.push(`<text x="${cx + 14}" y="${cy + 38}" font-family="Helvetica, Arial, sans-serif" font-size="25" font-weight="bold" fill="#2a2420">${i + 1}. ${esc(a.name)}</text>`);
    svgParts.push(`<text x="${cx + 14}" y="${cy + 58}" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="${col}" font-weight="bold">${esc(a.role)}</text>`);
    svgParts.push(`<text x="${cx + 172}" y="${cy + 392}" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#2a2420">${esc(a.plan)}</text>`);
    svgParts.push(`<text x="${cx + 172}" y="${cy + 412}" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#5a524a">tier ${esc(a.tier)}</text>`);
    svgParts.push(`<text x="${cx + 172}" y="${cy + 432}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#8a8072">${esc(a.from || '')}</text>`);
    const lines = a.sig.match(/.{1,46}(\s|$)/g) || [a.sig];
    lines.slice(0, 2).forEach((l, j) => svgParts.push(`<text x="${cx + 14}" y="${cy + 462 + j * 18}" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#2a2420">${esc(l.trim())}</text>`));
    svgParts.push(`<text x="${cx + 14}" y="${cy + 500}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#5a524a">${esc(a.worlds)}</text>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svgParts.join('')}</svg>`;
  layers.push({ input: Buffer.from(svg), left: 0, top: 0 });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#f7f1e6' } })
    .composite(layers).jpeg({ quality: 78, mozjpeg: true }).toFile(OUT);
  console.log(OUT, fs.statSync(OUT).size, W, H);
})();
