// #800 phase 2: one comparison sheet of a trial foe's stills at an equal size, camera and light: the approved
// reference, then current | direct | Tripo, by row (three-quarter, front, side, rear, clay front). From the capture's
// PNGs (baseline-shots.mjs --extra, each variant) in <dir>.
//   node references/enemy-redesign-2026-10-30/trials/sheet.mjs <dir> <foe> <reference.png> <out.webp>
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');
const [DIR, FOE, REF, OUT] = process.argv.slice(2);
const COLS = ['current', 'direct', 'tripo'];
const ROWS = [['still-3q', { left: 400, top: 300, width: 480, height: 300 }], ['still-front', { left: 360, top: 200, width: 560, height: 350 }], ['still-flank', { left: 360, top: 200, width: 560, height: 350 }], ['still-rear', { left: 360, top: 200, width: 560, height: 350 }], ['still-clay-front', { left: 360, top: 200, width: 560, height: 350 }]];
const W = 480, H = 300, PAD = 26;
// (the capture writes PNG; the committed copies are WebP)
const file = (v, what) => { const b = join(DIR, v === 'current' ? `${FOE}-${what}` : `${FOE}-${v}-${what}`); return existsSync(`${b}.webp`) ? `${b}.webp` : `${b}.png`; };
const label = (text, w = W) => Buffer.from(`<svg width="${w}" height="${PAD}"><rect width="${w}" height="${PAD}" fill="#f4ecd8"/><text x="8" y="18" font-family="Helvetica" font-size="15" fill="#3a2e22">${text}</text></svg>`);
const comp = [];
comp.push({ input: await sharp(REF).resize(W, Math.round(W * 928 / 1232)).toBuffer(), left: 0, top: PAD });
comp.push({ input: label('approved reference (concept, not the game)'), left: 0, top: 0 });
ROWS.forEach(([what], r) => COLS.forEach((v, c) => { comp.push({ input: label(`${v} · ${what.replace('still-', '')}`), left: W * (c + 1), top: r * (H + PAD) }); }));
for (const [r, [what, crop]] of ROWS.entries()) for (const [c, v] of COLS.entries()) {
  const f = file(v, what);
  if (!existsSync(f)) continue;
  comp.push({ input: await sharp(f).extract(crop).resize(W, H).toBuffer(), left: W * (c + 1), top: r * (H + PAD) + PAD });
}
await sharp({ create: { width: W * 4, height: ROWS.length * (H + PAD), channels: 3, background: '#f4ecd8' } }).composite(comp).webp({ quality: 78 }).toFile(OUT);
console.log(OUT);
