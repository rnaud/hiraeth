// The Elder's colour map with its baked light taken out (issue #237): Tripo's "Remove Lighting" left broad grey shading
// and darkened creases baked into her feathers, which the game's own light and ink then shaded again. Each pixel is
// sorted into her colours (cream feathers, the pink of the wing ends, the tan of her bill and legs); within its colour
// the slow changes of brightness (a blur of that colour's own pixels alone, so the islands of the atlas don't bleed
// into each other) are the baked light, and each is brought most of the way up to its colour's lit value. What changes
// fast is kept: the painted feather lines and barbs, the eye, her markings. Only brightness changes; the hue and its
// strength stay her own.
//
//   import { delight } from './elder-delight.mjs';
//   const { data, stats } = delight(rgba, width, height, opts)   // rgba: Uint8Array (4 a pixel), returned anew
//
// stats: per colour, the spread of the slow brightness (the share its 10th-90th percentiles lie apart) before and after.

export const DELIGHT = {
  sigma: 22,       // px at 2K: the shading's scale (a few feathers across)
  strength: 0.8,   // how much of the way to the lit value (1: all of it)
  lit: 0.85,       // the lit value: this percentile of a colour's slow brightness
  line: 0.72,      // darker than this share of the slow brightness: a painted line, not surface (left out of the blur)
  maxGain: 1.6,    // never brightened more than this (deep creases stay creases)
  crease: 0.6,     // how much of a crease's darkness is lifted (0 none, 1 all), between `fine` and `band` px
  fine: 2, band: 10, maxCrease: 1.35,
  sort: 3,         // px: the colour a pixel is sorted on is its neighbourhood's
  strengthBy: [1, 0, 1],   // per colour: the pink wing ends' 5 % spread is painted (pink to mauve), not light
  creaseBy: [1, 0, 0.8],   // per colour (cream, pink, tan): the pink wing ends have no creases, only the JPEG's grain
};

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const ramp = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/**
 * How much of each of her colours a pixel is ([cream, pink, tan], summing to 1; all 0 for the dark lines and the eye),
 * soft at the edges: a hard sort flipped JPEG blocks of a pale pink between pink and cream, patching it.
 */
export function colourOf(r, g, b, out = [0, 0, 0]) {
  const L = luma(r, g, b), mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn, sat = c / Math.max(1, mx);
  if (L < 60) { out[0] = out[1] = out[2] = 0; return out; }
  let h; if (c === 0) h = 0; else if (mx === r) h = ((g - b) / c + 6) % 6; else if (mx === g) h = (b - r) / c + 2; else h = (r - g) / c + 4;
  h *= 60;
  const pinkHue = h >= 180 ? ramp(250, 285, h) : 1 - ramp(4, 20, h), tanHue = ramp(8, 20, h) * (1 - ramp(65, 85, h));
  const pink = pinkHue * ramp(0.02, 0.06, sat), tan = Math.min(1 - pink, tanHue * ramp(0.14, 0.26, sat));
  out[1] = pink; out[2] = tan; out[0] = Math.max(0, 1 - pink - tan);
  return out;
}

function blur(src, w, h, s) {
  // three box passes ≈ a gaussian of sigma s
  const r = Math.max(1, Math.round((Math.sqrt(4 * s * s + 1) - 1) / 2)), k = 2 * r + 1;
  let a = Float32Array.from(src);
  const t = new Float32Array(src.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {           // horizontal, a -> t
      const row = y * w; let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) { t[row + x] = acc / k; acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < w; x++) {           // vertical, t -> a
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += t[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) { a[y * w + x] = acc / k; acc += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; }
    }
  }
  return a;
}

const pct = (arr, p) => { if (!arr.length) return 0; const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

export function delight(rgba, w, h, o = {}) {
  const O = { ...DELIGHT, ...o }, n = w * h, M = [new Float32Array(n), new Float32Array(n), new Float32Array(n)], L = new Float32Array(n), m = [0, 0, 0];
  // (sorted on the colour a few px round each pixel: the JPEG's grain flipped single blocks between pink and cream)
  const ch = [0, 1, 2].map((k) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = rgba[i * 4 + k]; return blur(a, w, h, O.sort); });
  for (let i = 0; i < n; i++) {
    L[i] = luma(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]); colourOf(ch[0][i], ch[1][i], ch[2][i], m);
    M[0][i] = m[0]; M[1][i] = m[1]; M[2][i] = m[2];
  }
  const out = new Uint8Array(rgba), stats = {}, gainSum = new Float32Array(n), wSum = new Float32Array(n);
  // a first pass of each colour's slow brightness finds its lines; the second leaves them out
  for (const c of [0, 1, 2]) {
    let low;
    for (let pass = 0; pass < 2; pass++) {
      const num = new Float32Array(n), den = new Float32Array(n);
      for (let i = 0; i < n; i++) { const wt = M[c][i] * (pass === 0 || L[i] > O.line * low[i] ? 1 : 0); num[i] = L[i] * wt; den[i] = wt; }
      const bn = blur(num, w, h, O.sigma), bd = blur(den, w, h, O.sigma);
      low = new Float32Array(n);
      for (let i = 0; i < n; i++) low[i] = bd[i] > 1e-3 ? bn[i] / bd[i] : 0;
    }
    const mine = []; for (let i = 0; i < n; i += 7) if (M[c][i] > 0.5 && low[i] > 0) mine.push(low[i]);
    const lit = pct(mine, O.lit), spread = (a) => (pct(a, 0.9) - pct(a, 0.1)) / Math.max(1, pct(a, 0.5));
    const after = [];
    for (let i = 0; i < n; i++) {
      if (!(M[c][i] > 0) || !(low[i] > 0)) continue;
      const gain = Math.min(O.maxGain, Math.max(1, 1 + O.strength * (O.strengthBy?.[c] ?? 1) * (lit / low[i] - 1)));
      gainSum[i] += M[c][i] * gain; wSum[i] += M[c][i];
      if (i % 7 === 0 && M[c][i] > 0.5) after.push(low[i] * gain);
    }
    stats[['cream', 'pink', 'tan'][c]] = { pixels: mine.length * 7, lit: +lit.toFixed(1), before: +spread(mine).toFixed(3), after: +spread(after).toFixed(3) };
  }
  // (the lines and the eye, no colour of hers, take their neighbours' gain: they stay as much darker than them as painted)
  const gs = blur(gainSum, w, h, 2), ws = blur(wSum, w, h, 2), gain = new Float32Array(n), G = new Float32Array(n);
  for (let i = 0; i < n; i++) { gain[i] = ws[i] > 1e-3 ? gs[i] / ws[i] : 1; G[i] = L[i] * gain[i]; }
  // the creases: darker bands a few px to a few tens wide (a feather's shaded overlap, a baked fold), within each colour,
  // lifted by `crease` of the way; a line under ~2 px (the painted ink) is left as dark as it was
  if (O.crease > 0) {
    const lift = new Float32Array(n), lw = new Float32Array(n);
    for (const c of [0, 1, 2]) {
      const k = O.crease * (O.creaseBy?.[c] ?? 1);
      const wn = new Float32Array(n), wd = new Float32Array(n);
      for (let i = 0; i < n; i++) { wn[i] = G[i] * M[c][i]; wd[i] = M[c][i]; }
      const n2 = blur(wn, w, h, O.fine), d2 = blur(wd, w, h, O.fine), n9 = blur(wn, w, h, O.band), d9 = blur(wd, w, h, O.band);
      for (let i = 0; i < n; i++) {
        if (!(M[c][i] > 0) || d2[i] < 1e-3 || d9[i] < 1e-3) continue;
        const mid = (n2[i] / d2[i]) / Math.max(1, n9[i] / d9[i]);
        const f = mid < 1 ? Math.min(O.maxCrease, Math.pow(mid, -k)) : 1;
        lift[i] += M[c][i] * f; lw[i] += M[c][i];
      }
    }
    for (let i = 0; i < n; i++) if (lw[i] > 1e-3) gain[i] *= lift[i] / lw[i];
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) out[i * 4 + k] = Math.min(255, Math.round(rgba[i * 4 + k] * gain[i]));
  return { data: out, stats };
}
