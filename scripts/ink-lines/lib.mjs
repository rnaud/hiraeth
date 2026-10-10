// The ink-lines audit's measures, its pure part (.claude/skills/ink-lines/SKILL.md; the browser part is
// .claude/skills/ink-lines/capture.mjs; tests/ink-lines.test.js). Every picture is { pixels, channels, width, height }
// (scripts/png.mjs decodePNG); masks are Uint8Array / Float32Array of width × height, row by row from the top.
//
//   objectMask     what an object covers: two albedo pictures (debug 2), with and without it
//   inkOf          the lines alone (debug 14, the lines as drawn: blue is the ink, 0..1)
//   strokeWidth    how wide the lines are, px: per ink pixel the shorter of its runs across and down, the median
//   inkShare       how much of an object (its mask grown by the line's reach) is ink
//   darkShare      how much of it is near-black in the final picture (lines, spot blacks, black eyes: what reads as ink)
//   eyeMarks       the traveller's eyes: how much darker than his cheek each eye's box is, against the eye's own size
//   shimmer        the same view a half pixel apart: how much the lines change (pops and crawl at low resolution)
//   grade          the rubric: each check passed, borderline or failed, and a score out of 5 a picture

import { dilate, blobs } from '../visual-probes/lib.mjs';
export { dilate, blobs };

export const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Pixels that differ between an albedo picture with the object and one without it (its silhouette, no shadow). */
export function objectMask(a, b, threshold = 14) {
  const n = a.width * a.height, out = new Uint8Array(n);
  for (let j = 0, i = 0; j < n; j++, i += a.channels) {
    const d = Math.max(Math.abs(a.pixels[i] - b.pixels[i]), Math.abs(a.pixels[i + 1] - b.pixels[i + 1]), Math.abs(a.pixels[i + 2] - b.pixels[i + 2]));
    out[j] = d > threshold ? 1 : 0;
  }
  return out;
}

/** The ink of debug 14 (blue: the lines as drawn, after the fog, the haze, the grass's and the lights' own), 0..1 a pixel. */
export function inkOf(img) {
  const n = img.width * img.height, out = new Float32Array(n);
  for (let j = 0, i = 0; j < n; j++, i += img.channels) out[j] = img.pixels[i + 2] / 255;
  return out;
}

/** The mask's box and size: { n, box: [x0, y0, x1, y1], h, w } (h, w in px; n 0: nothing). */
export function extent(mask, w, h) {
  let n = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let p = 0; p < mask.length; p++) if (mask[p]) { n++; const x = p % w, y = (p - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return n ? { n, box: [x0, y0, x1, y1], w: x1 - x0 + 1, h: y1 - y0 + 1 } : { n: 0, box: null, w: 0, h: 0 };
}

/**
 * How wide the lines are: for every pixel inked over `on` (inside `within`, if given), the shorter of its run across and
 * its run down (a horizontal line is short down, a vertical one short across; a blob is long both ways), then the
 * median and the 90th percentile of those (px), and the share of ink pixels in runs of `blob` px or more both ways.
 */
export function strokeWidth(ink, w, h, { on = 0.5, within = null, blob = 5 } = {}) {
  const H = new Uint16Array(ink.length), V = new Uint16Array(ink.length);
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (ink[y * w + x] < on) { x++; continue; }
      let e = x; while (e < w && ink[y * w + e] >= on) e++;
      for (let k = x; k < e; k++) H[y * w + k] = e - x;
      x = e;
    }
  }
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (ink[y * w + x] < on) { y++; continue; }
      let e = y; while (e < h && ink[e * w + x] >= on) e++;
      for (let k = y; k < e; k++) V[k * w + x] = e - y;
      y = e;
    }
  }
  const runs = [];
  let blobs_ = 0;
  for (let p = 0; p < ink.length; p++) {
    if (!H[p] || (within && !within[p])) continue;
    const r = Math.min(H[p], V[p]);
    runs.push(r);
    if (r >= blob) blobs_++;
  }
  if (!runs.length) return { n: 0, median: 0, p90: 0, blobShare: 0 };
  runs.sort((a, b) => a - b);
  return { n: runs.length, median: runs[runs.length >> 1], p90: runs[Math.min(runs.length - 1, Math.floor(runs.length * 0.9))], blobShare: blobs_ / runs.length };
}

/** The share of `mask` (grown by `grow` px: a silhouette's line is drawn half outside it) that is ink, weighted by the ink. */
export function inkShare(ink, mask, w, h, grow = 2) {
  const m = grow > 0 ? dilate(mask, w, h, grow) : mask;
  let s = 0, n = 0;
  for (let p = 0; p < m.length; p++) if (m[p]) { n++; s += ink[p]; }
  return n ? s / n : 0;
}

/** The share of `mask` (grown by `grow`) whose final colour is near-black: luminance under `dark` (0..255). */
export function darkShare(img, mask, grow = 2, dark = 48) {
  const { width: w, height: h, pixels: P, channels: c } = img, m = grow > 0 ? dilate(mask, w, h, grow) : mask;
  let s = 0, n = 0;
  for (let p = 0; p < m.length; p++) if (m[p]) { n++; const i = p * c; if (lum(P[i], P[i + 1], P[i + 2]) < dark) s++; }
  return n ? s / n : 0;
}

/** The luminance of the pixels of a box [x0, y0, x1, y1], sorted. */
function boxLums(img, [x0, y0, x1, y1]) {
  const { width: w, height: h, pixels: P, channels: c } = img, out = [];
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(h - 1, Math.ceil(y1)); y++)
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w - 1, Math.ceil(x1)); x++) { const i = (y * w + x) * c; out.push(lum(P[i], P[i + 1], P[i + 2])); }
  return out.sort((a, b) => a - b);
}

/**
 * The traveller's eyes (src/characters/head-ink.js): each eye's centre on screen and its half width and height
 * (px, the drawn opening), and a cheek point under it. The eye's "ink" is how much darker than the cheek the pixels
 * in a box round it are (each pixel's (cheek - its luminance) / cheek, at least 0; the box the opening × `pad` and half
 * a pixel), summed: the dark it lays on the face, in pixels' worth of black.
 *   density  that over the opening's area (π w h, at least a pixel): a drawn eye (a cream white, a dark iris cut by a
 *            heavy lid) is under 1; a black socket over it (the dark fills the opening and spills past it)
 *   share    that over the face's area (`face`, its height in px, squared): the same at every size if the eye keeps
 *            its proportion; a black dot on a small face is many times the share of a drawn eye on a big one
 *   darkest  the deepest pixel against the cheek (0 black .. 1 as the cheek)
 */
export function eyeMarks(img, eyes, { pad = 1.4, face = 0 } = {}) {
  const out = [];
  for (const e of eyes) {
    const cheek = boxLums(img, [e.cheek[0] - Math.max(1, e.w * 0.5), e.cheek[1] - Math.max(1, e.h), e.cheek[0] + Math.max(1, e.w * 0.5), e.cheek[1] + Math.max(1, e.h)]);
    const skin = cheek.length ? cheek[cheek.length >> 1] : 0;
    const rx = e.w * pad + 0.5, ry = e.h * pad + 0.5;
    const L = boxLums(img, [e.x - rx, e.y - ry, e.x + rx, e.y + ry]);
    let ink = 0;
    for (const l of L) ink += Math.max(0, (skin - l) / Math.max(skin, 1));
    const area = Math.max(Math.PI * e.w * e.h, 1);
    out.push({ skin: Math.round(skin), ink: +ink.toFixed(2), density: +(ink / area).toFixed(3), share: face ? +(ink / (face * face)).toFixed(5) : null, darkest: L.length && skin ? +(L[0] / skin).toFixed(3) : 1, h: +e.h.toFixed(2) });
  }
  return out;
}

/**
 * The same view rendered twice, the camera half a pixel apart: the mean change of the ink inside `mask` (or the whole
 * picture) over the ink there, and the share of ink pixels that pop (from under 0.15 to over 0.65 or back). Lines that
 * are stable slide with the view; lines at the edge of their threshold come and go.
 */
export function shimmer(a, b, mask = null) {
  let d = 0, s = 0, pops = 0, n = 0;
  for (let p = 0; p < a.length; p++) {
    if (mask && !mask[p]) continue;
    const hi = Math.max(a[p], b[p]);
    if (hi < 0.15) continue;
    n++; s += hi; d += Math.abs(a[p] - b[p]);
    if (Math.min(a[p], b[p]) < 0.15 && hi > 0.65) pops++;
  }
  return { change: s ? +(d / s).toFixed(3) : 0, pops: n ? +(pops / n).toFixed(3) : 0, n };
}

/**
 * The rubric (SKILL.md "The rubric"). Each check: [value, good-at-or-under, bad-at-or-over]: under the first passes
 * (1), over the second fails (0), between is borderline (0.5). A picture's score is 5 × the mean of its checks.
 */
export const RUBRIC = Object.freeze({
  // the ink on a plant, of its area grown by the line's reach: lines, not a black mass
  foliageInk: { near: [0.22, 0.34], far: [0.18, 0.3] },
  // the near-black share of a plant in the final picture
  foliageDark: [0.16, 0.3],
  // a line on something under 40 px tall: at most this many px wide (median), and at most this share of its height (p90)
  smallWidth: [2, 3.5], smallWidthOfHeight: [0.06, 0.12],
  // the traveller's eyes: their dark against the opening (see eyeMarks), and their share of the face against the 1 m portrait's
  // on a face under 12 px, its darkest eye pixel against the cheek (1 - that: a black dot is near 1)
  eyeDensity: [0.9, 1.3], eyeGrowth: [1.5, 2.5], eyeBlack: [0.6, 0.8],
  // a person's near-black share
  figureDark: [0.18, 0.32],
  // the lines a half pixel apart
  shimmerChange: [0.35, 0.55], shimmerPops: [0.12, 0.25],
  // the whole frame: how much of it is ink (a busy view at low resolution turns grey with lines)
  frameInk: [0.09, 0.16],
});

/** One check: 1 under `good`, 0 over `bad`, 0.5 between (lower is better). */
export function check(v, [good, bad]) { return v <= good ? 1 : v >= bad ? 0 : 0.5; }

/**
 * The checks of one picture, from its measures (capture.mjs's row): { name: { value, verdict } } and its score of 5.
 * `ref` the same scene's measures at the reference resolution and nearest distance (the eyes' growth).
 */
export function grade(row, ref = null) {
  const c = {}, R = RUBRIC, put = (k, v, lim) => { if (Number.isFinite(v)) c[k] = { value: +v.toFixed(3), verdict: check(v, lim) }; };
  const m = row.metrics ?? {};
  if (row.kind === 'foliage' && m.object?.n) {
    put('inkShare', m.inkShare, row.far ? R.foliageInk.far : R.foliageInk.near);
    put('darkShare', m.darkShare, R.foliageDark);
  }
  if ((row.kind === 'figure' || row.kind === 'foliage' || row.kind === 'foe') && m.object?.n && m.object.h < 40 && m.width?.n) {
    put('lineWidth', m.width.median, R.smallWidth);
    put('lineOfHeight', m.width.p90 / Math.max(m.object.h, 1), R.smallWidthOfHeight);
  }
  // (a foe is not judged by its blacks: the blots are ink by design)
  if (row.kind === 'figure') put('darkShare', m.darkShare, R.figureDark);
  if (m.eyes?.length) {
    const avg = (row_, k) => row_.metrics.eyes.reduce((a, e) => a + (e[k] ?? 0), 0) / row_.metrics.eyes.length;
    // (the density only where the opening is a few pixels tall: under that a pixel's worth dominates it)
    if (m.eyes[0].h >= 1.5) put('eyeDensity', avg(row, 'density'), R.eyeDensity);
    const r = ref?.metrics?.eyes?.length ? avg(ref, 'share') : null;
    // (the share only on a face of 12 px or more: under that the eye is a pixel or less, its share a pixel's rounding)
    if (r && ref !== row && (m.facePx ?? 99) >= 12) put('eyeGrowth', avg(row, 'share') / Math.max(r, 1e-6), R.eyeGrowth);
    if ((m.facePx ?? 99) < 12) put('eyeBlack', 1 - Math.min(...m.eyes.map((e) => e.darkest)), R.eyeBlack);
  }
  if (m.shimmer?.n > 20) { put('shimmer', m.shimmer.change, R.shimmerChange); put('pops', m.shimmer.pops, R.shimmerPops); }
  if (row.kind === 'view') put('frameInk', m.frameInk, R.frameInk);
  const v = Object.values(c);
  return { checks: c, score: v.length ? +(5 * v.reduce((a, x) => a + x.verdict, 0) / v.length).toFixed(2) : null };
}

/** An RGB PNG from { pixels, channels, width, height } (the crops and masks the audit saves). */
export async function encodePNG({ pixels, channels, width, height }) {
  const { deflateSync } = await import('node:zlib');
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let k = 0; k < 3; k++) raw[y * (width * 3 + 1) + 1 + x * 3 + k] = pixels[(y * width + x) * channels + Math.min(k, channels - 1)];
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type, 'latin1'), len = Buffer.alloc(4), cr = Buffer.alloc(4); len.writeUInt32BE(data.length); cr.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** A crop of a picture, scaled up `k` times (nearest neighbour: small things judged by their pixels). */
export function crop(img, [x0, y0, x1, y1], k = 1) {
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(img.width - 1, Math.ceil(x1)); y1 = Math.min(img.height - 1, Math.ceil(y1));
  const w = (x1 - x0 + 1) * k, h = (y1 - y0 + 1) * k, out = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = ((y0 + Math.floor(y / k)) * img.width + x0 + Math.floor(x / k)) * img.channels, d = (y * w + x) * 3; out[d] = img.pixels[s]; out[d + 1] = img.pixels[s + 1]; out[d + 2] = img.pixels[s + 2]; }
  return { pixels: out, channels: 3, width: w, height: h };
}
