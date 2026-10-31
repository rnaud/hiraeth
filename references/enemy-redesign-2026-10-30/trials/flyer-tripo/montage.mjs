// A contact sheet of pictures (a working view, never changelog media): node montage.mjs <out.png> <cols> <width> <png…>
import sharp from 'sharp';
const [OUT, COLS, WIDTH, ...files] = process.argv.slice(2);
const cols = +COLS, w = +WIDTH;
const tiles = await Promise.all(files.map(async (f) => { const im = sharp(f).resize({ width: w }); const { data, info } = await im.png().toBuffer({ resolveWithObject: true }); return { data, h: info.height }; }));
const h = Math.max(...tiles.map((t) => t.h)), rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * w, height: rows * h, channels: 3, background: '#ffffff' } })
  .composite(tiles.map((t, i) => ({ input: t.data, left: (i % cols) * w, top: Math.floor(i / cols) * h }))).png().toFile(OUT);
console.log(OUT, cols * w, rows * h);
