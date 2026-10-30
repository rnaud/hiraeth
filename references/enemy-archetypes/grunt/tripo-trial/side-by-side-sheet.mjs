// Contact sheets from side-by-side-capture.mjs's shots: one tile per pose/view, labelled.
// Usage: node references/enemy-archetypes/grunt/tripo-trial/side-by-side-sheet.mjs <scratch folder> [out folder]
// MODE=side3 (as the capture): the trio's sheets, procedural | Tripo textured | Tripo flat, and the faces close up.
import sharp from 'sharp';
import { join } from 'node:path';
const DIR = process.argv[2]; if (!DIR) throw new Error('usage: side-by-side-sheet.mjs <scratch folder> [out]');
const S = join(DIR, 'shots'), OUT = process.argv[3] ?? DIR, MODE = process.env.MODE ?? 'side', TRIO = /^side3/.test(MODE), LODM = MODE === 'side3l';
const PAIR = { left: 300, top: 140, width: 680, height: 400 }, WIDE = { left: 200, top: 190, width: 880, height: 340 }, FACE = { left: 40, top: 255, width: 1200, height: 340 };
const LAB = 30, who = LODM ? 'left: procedural · middle: Tripo flat 31k (before) · right: Tripo LOD 12k (after)' : TRIO ? 'left: procedural · middle: Tripo textured · right: Tripo flat' : 'left: procedural · right: Tripo';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function sheet(file, title, tiles, cols, crop = TRIO ? WIDE : PAIR) {
  const TW = crop.width, TH = crop.height, rows = Math.ceil(tiles.length / cols), W = cols * TW, H = 56 + rows * (TH + LAB);
  const comps = [];
  for (let i = 0; i < tiles.length; i++) {
    const [name, label] = tiles[i], x = (i % cols) * TW, y = 56 + Math.floor(i / cols) * (TH + LAB);
    comps.push({ input: await sharp(join(S, name + '.png')).extract(crop).toBuffer(), left: x, top: y + LAB });
    comps.push({ input: Buffer.from(`<svg width="${TW}" height="${LAB}"><rect width="100%" height="100%" fill="#17201f"/><text x="10" y="21" font-family="Helvetica" font-size="17" fill="#f7ecd2">${esc(label)}</text><text x="${TW - 10}" y="21" text-anchor="end" font-family="Helvetica" font-size="14" fill="#c2aa72">${esc(who)}</text></svg>`), left: x, top: y });
  }
  comps.push({ input: Buffer.from(`<svg width="${W}" height="56"><rect width="100%" height="100%" fill="#f4f0e5"/><text x="14" y="36" font-family="Helvetica" font-size="24" fill="#292821">${esc(title)}</text></svg>`), left: 0, top: 0 });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#b9b4a7' } }).composite(comps).jpeg({ quality: 82 }).toFile(join(OUT, file));
  console.log(file, W, H);
}
const poses = [
  ['idle-front', 'Idle'], ['walk-a-front', 'Walk, t 2.20 s'], ['walk-b-front', 'Walk, t 2.45 s'],
  ['club-wind-front', 'Club wind-up, 90 %'], ['club-strike-front', 'Club strike, 60 %'], ['club-recover-front', 'Club recover, 30 %'],
];
const turnaround = [
  ['idle-front', 'Idle · front'], ['idle-threeq', 'Idle · three-quarter'], ['idle-side', 'Idle · side'], ['idle-back', 'Idle · back'],
  ['club-wind-front', 'Wind-up · front'], ['club-wind-threeq', 'Wind-up · three-quarter'], ['club-wind-side', 'Wind-up · side'], ['club-wind-back', 'Wind-up · back'],
  ['club-strike-front', 'Strike · front'], ['club-strike-threeq', 'Strike · three-quarter'], ['club-strike-side', 'Strike · side'], ['club-strike-back', 'Strike · back'],
];
if (LODM) {
  await sheet('lod-poses.jpg', 'Grunt #768 round 3: procedural | Tripo flat 31k, round 2 | Tripo LOD 12k, fitted grip (lod-tripo.mjs) · web Arena, High', poses, 3);
  await sheet('lod-turnaround.jpg', 'Grunt #768 round 3: turnaround, procedural | Tripo flat 31k | Tripo LOD 12k · web Arena, High', turnaround, 4);
  await sheet('lod-faces.jpg', 'Grunt #768 round 3: the faces, procedural | Tripo flat 31k | Tripo LOD 12k (smoothed scalp, inked nostrils)', [['face-idle-front', 'Idle · closer'], ['face-wind-front', 'Wind-up · the eyes flash']], 1, FACE);
  const grip = ['wind-30', 'wind-60', 'strike-30', 'strike-90', 'recover-10', 'recover-60', 'recover-95'].flatMap((n) => [[`grip-${n}-front`, `Club ${n.replace('-', ' ')} % · front`], [`grip-${n}-side`, `Club ${n.replace('-', ' ')} % · side`]]);
  await sheet('lod-grip.jpg', 'Grunt #768 round 3: the club through its cycle, procedural | Tripo flat (old grip) | Tripo LOD (fitted grip)', grip, 4);
} else if (TRIO) {
  await sheet('trio-poses.jpg', 'Grunt #768: procedural | Tripo textured | Tripo flat (flatten-tripo.mjs), same clip rig and clock · web Arena, High', poses, 3);
  await sheet('trio-turnaround.jpg', 'Grunt #768: turnaround, procedural | Tripo textured | Tripo flat · web Arena, High', turnaround, 4);
  await sheet('trio-faces.jpg', 'Grunt #768: the faces, procedural | Tripo textured | Tripo flat · idle, and the wind-up’s eye flash', [['face-idle-front', 'Idle · closer'], ['face-wind-front', 'Wind-up · the eyes flash']], 1, FACE);
} else {
  await sheet('side-by-side-poses.jpg', 'Grunt #768: procedural (left) vs Tripo auto-rig (right), same clip rig and clock · web Arena, High', poses, 3);
  await sheet('side-by-side-turnaround.jpg', 'Grunt #768: turnaround, procedural (left) vs Tripo (right) · web Arena, High', turnaround, 4);
}
