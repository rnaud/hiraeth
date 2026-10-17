// The measures the visual checks share (pair.mjs: still views; sequences.mjs: the sequences' beats): CIE Lab, ΔE, a
// picture's raw pixels at a size, SSIM of two grey pictures.
import sharp from 'sharp';

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export function lab(r, g, b) {
  const R = lin(r / 255), G = lin(g / 255), B = lin(b / 255);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const raw = async (file, w, h, grey = false) => {
  let s = sharp(file).resize(w, h, { fit: 'fill' }).removeAlpha();
  if (grey) s = s.greyscale();
  return (await s.raw().toBuffer({ resolveWithObject: true })).data;
};

export function ssim(a, b, w, h, win = 8) {
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
  let sum = 0, n = 0;
  for (let y = 0; y + win <= h; y += win / 2) for (let x = 0; x + win <= w; x += win / 2) {
    let ma = 0, mb = 0;
    for (let j = 0; j < win; j++) for (let i = 0; i < win; i++) { const k = (y + j) * w + x + i; ma += a[k]; mb += b[k]; }
    ma /= win * win; mb /= win * win;
    let va = 0, vb = 0, cv = 0;
    for (let j = 0; j < win; j++) for (let i = 0; i < win; i++) { const k = (y + j) * w + x + i, da = a[k] - ma, db = b[k] - mb; va += da * da; vb += db * db; cv += da * db; }
    va /= win * win - 1; vb /= win * win - 1; cv /= win * win - 1;
    sum += ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); n++;
  }
  return sum / n;
}
