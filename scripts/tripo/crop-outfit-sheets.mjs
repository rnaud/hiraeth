// Tripo outfit trial (#682): the picked outfit turnarounds (front, side, back on one sheet) cut into aligned
// square inputs for Tripo's multiview-to-model. Mechanical only: each figure's columns are found against the
// sheet's flat background, everything outside them is filled with the sampled background colour, and the three
// views share one vertical span and one uniform scale. No pixel of a figure is redrawn.
//
//   node scripts/tripo/crop-outfit-sheets.mjs [id …]
//   → data/characters/tripo-outfits/<id>/reference/{front,left,back}.png, crop-recipe.json, prepared-inputs.png
//
// The sheet's side view has the nose pointing left in the image: the character's left side, Tripo's `left`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('../..', import.meta.url).pathname;
const SIZE = 1024;
const MARGIN = 0.06;          // of the shared span, above the hair and below the shadow
const THRESH = 38;            // colour distance from the background counted as figure
const COL_FRACTION = 0.03;    // a column is figure when this share of its pixels is

export const OUTFITS = ['void-navigator', 'gravity-ranger'];
const VIEWS = ['front', 'left', 'back'];

async function cropSheet(id) {
  const src = `references/characters/traveller-outfits/${id}/approved-reference.png`;
  const { data, info } = await sharp(join(ROOT, src)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (x, y) => { const i = (y * W + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  // background: the median of the four 20 px corner squares
  const samples = [];
  for (const [cx, cy] of [[0, 0], [W - 20, 0], [0, H - 20], [W - 20, H - 20]])
    for (let y = cy; y < cy + 20; y++) for (let x = cx; x < cx + 20; x++) samples.push(px(x, y));
  const bg = [0, 1, 2].map((c) => samples.map((s) => s[c]).sort((a, b) => a - b)[samples.length >> 1]);
  const isFig = (x, y) => { const p = px(x, y); return Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]) > THRESH; };
  const colCount = new Array(W).fill(0);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (isFig(x, y)) colCount[x]++;
  // runs of figure columns, merged across gaps narrower than 2 % of the width (between an arm and the body)
  const runs = [];
  for (let x = 0, start = -1; x <= W; x++) {
    const on = x < W && colCount[x] > H * COL_FRACTION;
    if (on && start < 0) start = x;
    if (!on && start >= 0) { runs.push([start, x - 1]); start = -1; }
  }
  const merged = [];
  for (const r of runs) {
    const last = merged.at(-1);
    if (last && r[0] - last[1] < W * 0.02) last[1] = r[1]; else merged.push([...r]);
  }
  const figs = merged.filter((r) => r[1] - r[0] > W * 0.08).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, 3).sort((a, b) => a[0] - b[0]);
  if (figs.length !== 3) throw new Error(`${id}: found ${figs.length} figures, not 3`);
  // each figure's rows (within its columns)
  const boxes = figs.map(([x0, x1]) => {
    let top = H, bottom = 0;
    for (let y = 0; y < H; y++) for (let x = x0; x <= x1; x++) if (isFig(x, y)) { if (y < top) top = y; if (y > bottom) bottom = y; break; }
    return { left: x0, right: x1, top, bottom };
  });
  const top = Math.min(...boxes.map((b) => b.top)), bottom = Math.max(...boxes.map((b) => b.bottom));
  const span = Math.round((bottom - top) * (1 + 2 * MARGIN));
  const y0 = Math.round(top - (bottom - top) * MARGIN);
  const scale = SIZE / span;
  const out = join(ROOT, `data/characters/tripo-outfits/${id}/reference`);
  mkdirSync(out, { recursive: true });
  const recipes = [];
  const tiles = [];
  for (let i = 0; i < 3; i++) {
    const b = boxes[i], view = VIEWS[i];
    const cx = Math.round((b.left + b.right) / 2);
    const x0 = cx - (span >> 1);
    // a canvas of the background, the figure's own columns (only) pasted in at the same place
    const keepL = Math.max(0, b.left - 6), keepR = Math.min(W - 1, b.right + 6);
    const yTop = Math.max(0, y0), yBot = Math.min(H, y0 + span);
    const strip = await sharp(join(ROOT, src)).removeAlpha().extract({ left: keepL, top: yTop, width: keepR - keepL + 1, height: yBot - yTop }).toBuffer();
    const canvas = await sharp({ create: { width: span, height: span, channels: 3, background: { r: bg[0], g: bg[1], b: bg[2] } } })
      .composite([{ input: strip, left: keepL - x0, top: yTop - y0 }]).png().toBuffer();
    const png = await sharp(canvas).resize(SIZE, SIZE, { kernel: 'lanczos3' }).png().toBuffer();
    writeFileSync(join(out, `${view}.png`), png);
    tiles.push(png);
    recipes.push({ view, figureColumns: [b.left, b.right], figureRows: [b.top, b.bottom], keptColumns: [keepL, keepR], square: { left: x0, top: y0, size: span } });
  }
  const sheet = await sharp({ create: { width: SIZE * 3, height: SIZE, channels: 3, background: '#ffffff' } })
    .composite(tiles.map((t, i) => ({ input: t, left: i * SIZE, top: 0 }))).png().toBuffer().then((b) => sharp(b).resize(1536, 512).png().toBuffer());
  writeFileSync(join(out, 'prepared-inputs.png'), sheet);
  const recipe = {
    issue: 682, source: src, sheetSize: [W, H],
    notes: 'Mechanical crops and one uniform scale only. Figure columns found against the flat background; outside them the square is filled with the sampled background colour (the neighbouring figures removed). All three views share one vertical span so the feet and crowns line up. Side view: nose points left in the image = the character\'s left side = Tripo `left`. No right view: the outfits are asymmetric, so the side was not mirrored.',
    background: bg, threshold: THRESH, columnFraction: COL_FRACTION, margin: MARGIN,
    sharedRows: [top, bottom], scale: +scale.toFixed(5), size: SIZE, recipes,
  };
  writeFileSync(join(out, 'crop-recipe.json'), `${JSON.stringify(recipe, null, 2)}\n`);
  return recipe;
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : OUTFITS;
for (const id of ids) {
  const r = await cropSheet(id);
  console.log(id, 'bg', r.background.join(','), 'span', r.recipes[0].square.size, r.recipes.map((x) => `${x.view} ${x.figureColumns.join('-')}`).join(' | '));
}
