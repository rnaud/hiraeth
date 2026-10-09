// A view cut out of a reference sheet for the 3D mode (docs/systems/reference-lab.md, "3D mode"): our sheets put
// four views side by side, and Tripo wants one subject a picture. The page draws the rectangle, the CLI takes
// --crop x,y,w,h (pixels of the original); both end here, server-side, with sharp (in node_modules through the
// dev tools; imported only when a crop is asked for, so the rest of the lab runs without it).

/** 'x,y,w,h' (or { x, y, w, h }) → { x, y, w, h } integers, or null for none ('', '-', null). Throws on nonsense. */
export function parseCrop(v) {
  if (v == null || v === '' || v === '-') return null;
  const a = typeof v === 'object' ? [v.x, v.y, v.w, v.h] : String(v).split(',').map((s) => s.trim());
  const n = a.map(Number);
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x)) || n[0] < 0 || n[1] < 0 || n[2] < 8 || n[3] < 8) {
    throw new Error(`crop "${typeof v === 'object' ? JSON.stringify(v) : v}": x,y,w,h in pixels (w and h at least 8)`);
  }
  const [x, y, w, h] = n.map(Math.round);
  return { x, y, w, h };
}

/** The crop kept inside a picture of `width` × `height` (pure). */
export function clampCrop(c, width, height) {
  const x = Math.min(Math.max(0, c.x), width - 1), y = Math.min(Math.max(0, c.y), height - 1);
  return { x, y, w: Math.max(1, Math.min(c.w, width - x)), h: Math.max(1, Math.min(c.h, height - y)) };
}

let sharpMod = null;
async function loadSharp() {
  if (!sharpMod) {
    try { sharpMod = (await import('sharp')).default; } catch {
      throw new Error('cropping needs sharp (npm install puts it in node_modules); or crop the picture yourself and give the file');
    }
  }
  return sharpMod;
}

/**
 * A picture (bytes) cut to `crop` and/or turned into a PNG Tripo takes (it reads JPEG and PNG, not WebP):
 * → { bytes, mime, width, height, crop } (crop clamped, or null). JPEG and PNG without a crop pass untouched.
 */
export async function prepareView(bytes, mime, crop = null, { sharp: s } = {}) {
  if (!crop && /^image\/(jpeg|png)$/.test(mime)) return { bytes, mime, crop: null };
  const sharp = s ?? await loadSharp();
  const img = sharp(bytes);
  const meta = await img.metadata();
  const c = crop ? clampCrop(crop, meta.width, meta.height) : null;
  const out = await (c ? img.extract({ left: c.x, top: c.y, width: c.w, height: c.h }) : img).png().toBuffer();
  return { bytes: out, mime: 'image/png', width: c?.w ?? meta.width, height: c?.h ?? meta.height, crop: c };
}
