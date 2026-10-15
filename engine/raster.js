// A canvas for an engine's VM, drawn in plain JavaScript into RGBA bytes (docs/systems/engine-bridge.md, "The menus" and
// "Canvas textures"): the 2D context's calls the game's canvases use, so the same drawing the web makes on its canvas
// becomes a picture the engine shows: the Map's ground (src/world-map.js drawTerrain, BridgeMenu's Map) and every canvas
// a texture is made of (engine/platform.js hands one out for document.createElement('canvas')): the ship's console screen
// and wall pictures (src/ship/portrait.js, art.js), the signs and boards (src/minigames/kit/marker.js, interior-kit.js,
// levels/arcade.js), the drawings at home (levels/home-drawings.js). The engine's backend sends its pixels as a texture.
//
//   const c = new PixelCanvas(512, 512);
//   drawTerrain(c.getContext('2d'), grid, 512);
//   c.data   → Uint8ClampedArray, width × height × 4, rows top to bottom, sRGB, not premultiplied
//   c.version  moves each time something is drawn
//
// What it draws: fillRect / strokeRect / clearRect; paths (moveTo, lineTo, quadraticCurveTo, bezierCurveTo, arc, arcTo
// as a line, ellipse, rect, closePath) filled (non-zero, antialiased by each pixel's covered area) and stroked (round
// ends and joins, each pixel's nearness to the nearest segment, blended once so a pale line crossing itself doesn't
// darken), dashes; the transform (translate, rotate, scale, transform, setTransform) and save / restore; colours as
// '#rgb', '#rrggbb(aa)', 'rgb(a)(…)', 'hsl(a)(…)' or a few names, linear and radial gradients, globalAlpha; text
// (fillText, strokeText, measureText) in the open fonts of engine/glyphs.js (scripts/engine-glyphs.mjs: Roboto for the
// sans faces, Roboto Mono for the monospace ones), by the font's size, weight, style and family, textAlign and
// textBaseline; pictures (putImageData, getImageData, drawImage of another canvas or an ImageData, smoothed or not).
// Not drawn: shadows, clipping, patterns, composite operations other than source-over, images (no decoder in the VMs).
import { GLYPHS } from './glyphs.js';

const NAMED = { black: [0, 0, 0, 1], white: [255, 255, 255, 1], transparent: [0, 0, 0, 0], red: [255, 0, 0, 1], green: [0, 128, 0, 1], blue: [0, 0, 255, 1], gray: [128, 128, 128, 1], grey: [128, 128, 128, 1] };

/** '#rrggbb', '#rgb', '#rrggbbaa', 'rgb(r, g, b)', 'rgba(r, g, b, a)', 'hsl(…)' → [r, g, b, a] (a 0..1); black for anything else. */
export function parseColour(s) {
  const t = String(s ?? '').trim();
  let m = t.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) { const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255, m[2] ? parseInt(m[2], 16) / 255 : 1]; }
  m = t.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m) return [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16), 1];
  m = t.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  m = t.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) {
    const h = (+m[1] % 360) / 360, sa = +m[2] / 100, l = +m[3] / 100;
    const q = l < 0.5 ? l * (1 + sa) : l + sa - l * sa, p = 2 * l - q;
    const f = (x) => { x = (x + 1) % 1; return 255 * (x < 1 / 6 ? p + (q - p) * 6 * x : x < 0.5 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p); };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3), m[4] === undefined ? 1 : +m[4]];
  }
  return NAMED[t.toLowerCase()]?.slice() ?? [0, 0, 0, 1];
}

/** A gradient (createLinearGradient, createRadialGradient): its colour at t looked up in 256 steps. */
class Gradient {
  constructor(kind, a) { this.kind = kind; this.a = a; this.stops = []; this.lut = null; }
  addColorStop(o, c) { this.stops.push([Math.min(1, Math.max(0, +o || 0)), parseColour(c)]); this.stops.sort((x, y) => x[0] - y[0]); this.lut = null; }
  table() {
    if (this.lut) return this.lut;
    const L = this.lut = new Float32Array(256 * 4), S = this.stops;
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let c;
      if (!S.length) c = [0, 0, 0, 0];
      else if (t <= S[0][0]) c = S[0][1];
      else if (t >= S[S.length - 1][0]) c = S[S.length - 1][1];
      else { let k = 1; while (S[k][0] < t) k++; const [o0, c0] = S[k - 1], [o1, c1] = S[k], f = o1 > o0 ? (t - o0) / (o1 - o0) : 0; c = c0.map((v, j) => v + (c1[j] - v) * f); }
      L.set(c, i * 4);
    }
    return L;
  }
  /** t at a point of user space. */
  at(x, y) {
    const a = this.a;
    if (this.kind === 'linear') { const dx = a[2] - a[0], dy = a[3] - a[1], l2 = dx * dx + dy * dy || 1; return ((x - a[0]) * dx + (y - a[1]) * dy) / l2; }
    // radial: the circles' centres taken as the outer one's (the game's are concentric)
    const r0 = a[2], r1 = a[5], d = Math.hypot(x - a[3], y - a[4]);
    return r1 > r0 ? (d - r0) / (r1 - r0) : 0;
  }
}

// ------------------------------------------------------------------ the fonts
const FACE_OF = {};
/** A CSS font ('bold 42px ui-monospace, Menlo, monospace', '900 15px Futura…', 'italic 700 20px …') → its face, size, slant. */
export function parseFont(s) {
  const t = String(s ?? '10px sans-serif');
  let f = FACE_OF[t];
  if (f) return f;
  const m = t.match(/([\d.]+)px/);
  const size = m ? +m[1] : 10, pre = m ? t.slice(0, m.index) : '', family = m ? t.slice(m.index + m[0].length) : t;
  const w = pre.match(/\b([1-9]00)\b/), weight = w ? +w[1] : /\bbold(er)?\b/i.test(pre) ? 700 : 400;
  const mono = /mono|menlo|consolas|courier/i.test(family);
  const face = mono ? (weight >= 600 ? 'monoBold' : 'mono') : weight >= 800 ? 'sansBlack' : weight >= 600 ? 'sansBold' : 'sans';
  f = FACE_OF[t] = { face, size, slant: /\b(italic|oblique)\b/i.test(pre) ? 0.2 : 0 };
  return f;
}
const GLYPH_PATHS = {};
/** A letter's outline: [['M', x, y] | ['L', x, y] | ['Q', cx, cy, x, y] | ['Z']] in its font's units, y up; and its advance. */
function glyph(face, ch) {
  const F = GLYPHS[face] ?? GLYPHS.sans, key = face + ch;
  let g = GLYPH_PATHS[key];
  if (g) return g;
  const src = F.glyphs[ch] ?? F.glyphs['?'];
  const cmds = [];
  if (src?.[1]) for (const m of src[1].matchAll(/([MLQZ])([^MLQZ]*)/g)) cmds.push([m[1], ...m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number)]);
  g = GLYPH_PATHS[key] = { adv: src?.[0] ?? F.upm * 0.5, cmds };
  return g;
}

const IDENTITY = [1, 0, 0, 1, 0, 0];

class Context2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000'; this.strokeStyle = '#000'; this.lineWidth = 1;
    this.lineCap = 'butt'; this.lineJoin = 'miter'; this.imageSmoothingEnabled = true; this.imageSmoothingQuality = 'low'; this.globalAlpha = 1;
    this.font = '10px sans-serif'; this.textAlign = 'start'; this.textBaseline = 'alphabetic';
    this.globalCompositeOperation = 'source-over'; this.lineDashOffset = 0; this.miterLimit = 10;
    this.shadowBlur = 0; this.shadowColor = 'rgba(0,0,0,0)'; this.shadowOffsetX = 0; this.shadowOffsetY = 0; this.filter = 'none';
    this.m = IDENTITY.slice();
    this.dash = [];
    this.stack = [];
    this.subs = []; this.sub = null;   // the path: its subpaths' points in the canvas's pixels (transformed as they were added)
    this.colours = new Map();
  }

  // ---- state
  save() { this.stack.push({ fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, lineCap: this.lineCap, lineJoin: this.lineJoin, globalAlpha: this.globalAlpha, font: this.font, textAlign: this.textAlign, textBaseline: this.textBaseline, imageSmoothingEnabled: this.imageSmoothingEnabled, lineDashOffset: this.lineDashOffset, m: this.m.slice(), dash: this.dash.slice() }); }
  restore() { const s = this.stack.pop(); if (s) Object.assign(this, s); }
  reset() { this.stack.length = 0; this.m = IDENTITY.slice(); this.dash = []; this.beginPath(); this.canvas.data.fill(0); this.canvas.touch(); }
  translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  scale(x, y) { const m = this.m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; }
  rotate(a) { const m = this.m, c = Math.cos(a), s = Math.sin(a), [a0, b0, c0, d0] = m; m[0] = a0 * c + c0 * s; m[1] = b0 * c + d0 * s; m[2] = -a0 * s + c0 * c; m[3] = -b0 * s + d0 * c; }
  transform(a, b, c, d, e, f) { const m = this.m, [a0, b0, c0, d0, e0, f0] = m; m[0] = a0 * a + c0 * b; m[1] = b0 * a + d0 * b; m[2] = a0 * c + c0 * d; m[3] = b0 * c + d0 * d; m[4] = a0 * e + c0 * f + e0; m[5] = b0 * e + d0 * f + f0; }
  setTransform(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) { if (typeof a === 'object' && a) ({ a = 1, b = 0, c = 0, d = 1, e = 0, f = 0 } = a); this.m = [a, b, c, d, e, f]; }
  resetTransform() { this.m = IDENTITY.slice(); }
  getTransform() { const [a, b, c, d, e, f] = this.m; return { a, b, c, d, e, f }; }
  setLineDash(d) { this.dash = Array.isArray(d) && d.every((v) => v >= 0) ? (d.length % 2 ? [...d, ...d] : d.slice()) : this.dash; }
  getLineDash() { return this.dash.slice(); }
  createLinearGradient(x0, y0, x1, y1) { return new Gradient('linear', [x0, y0, x1, y1]); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return new Gradient('radial', [x0, y0, r0, x1, y1, r1]); }
  createConicGradient() { return new Gradient('linear', [0, 0, 1, 0]); }
  createPattern() { return null; }
  isPointInPath() { return false; }
  clip() {}
  colour(s) { let c = this.colours.get(s); if (!c) { c = parseColour(s); this.colours.set(s, c); } return c; }
  /** The canvas's pixels per user unit (the transform's mean scale: a line's width, a curve's steps). */
  get k() { const m = this.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1; }
  tx(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }

  /** One pixel (k: its index) blended toward c by a (source-over, not premultiplied). */
  blend(k, c, a) {
    if (a <= 0) return;
    const d = this.canvas.data, i = k * 4, da = d[i + 3] / 255;
    if (a >= 1 || da >= 1) {
      const b = 1 - a;
      d[i] = d[i] * b + c[0] * a; d[i + 1] = d[i + 1] * b + c[1] * a; d[i + 2] = d[i + 2] * b + c[2] * a;
      d[i + 3] = Math.min(255, d[i + 3] + 255 * a * (1 - da));
      if (da >= 1) d[i + 3] = 255;
      return;
    }
    const oa = a + da * (1 - a), w = (da * (1 - a)) / oa, v = a / oa;
    d[i] = d[i] * w + c[0] * v; d[i + 1] = d[i + 1] * w + c[1] * v; d[i + 2] = d[i + 2] * w + c[2] * v;
    d[i + 3] = oa * 255;
  }
  /** The paint (a colour or a gradient) as a function of a pixel: [r, g, b, a] (a 0..1, globalAlpha in). */
  paint(style) {
    const ga = this.globalAlpha;
    if (style instanceof Gradient) {
      const L = style.table(), m = this.m, det = m[0] * m[3] - m[1] * m[2] || 1;
      const i0 = m[3] / det, i1 = -m[1] / det, i2 = -m[2] / det, i3 = m[0] / det, i4 = (m[2] * m[5] - m[3] * m[4]) / det, i5 = (m[1] * m[4] - m[0] * m[5]) / det;
      const out = [0, 0, 0, 0];
      return (px, py) => {
        const ux = i0 * px + i2 * py + i4, uy = i1 * px + i3 * py + i5;
        const t = style.at(ux, uy), j = Math.round(Math.min(1, Math.max(0, t)) * 255) * 4;
        out[0] = L[j]; out[1] = L[j + 1]; out[2] = L[j + 2]; out[3] = L[j + 3] * ga;
        return out;
      };
    }
    const c = this.colour(typeof style === 'string' ? style : '#000'), out = [c[0], c[1], c[2], c[3] * ga];
    return () => out;
  }

  // ---- rectangles
  fillRect(x, y, w, h) {
    const m = this.m;
    if (m[1] || m[2]) { const keep = this.keepPath(); this.beginPath(); this.rect(x, y, w, h); this.fill(); this.subs = keep.subs; this.sub = keep.sub; return; }
    // (axis-aligned: the pixels whose middles it covers; a rect under a pixel still marks the one it sits in, at its share)
    const X = m[0] * x + m[4], Y = m[3] * y + m[5], Wd = m[0] * w, Hd = m[3] * h;
    const ax = Math.min(X, X + Wd), ay = Math.min(Y, Y + Hd), aw = Math.abs(Wd), ah = Math.abs(Hd);
    const { width: W, height: H } = this.canvas, paint = this.paint(this.fillStyle), solid = !(this.fillStyle instanceof Gradient);
    let x0 = Math.round(ax), y0 = Math.round(ay), x1 = Math.round(ax + aw), y1 = Math.round(ay + ah), share = 1;
    if (x1 <= x0 || y1 <= y0) { x0 = Math.floor(ax); y0 = Math.floor(ay); x1 = x0 + 1; y1 = y0 + 1; share = Math.min(1, aw * ah); }
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
    if (x1 <= x0 || y1 <= y0) return;
    const d = this.canvas.data;
    this.canvas.touch();
    if (solid) {
      const c = paint(), k = c[3] * share;
      if (k >= 1) { for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) { const p = (j * W + i) * 4; d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255; } return; }
      for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) this.blend(j * W + i, c, k);
      return;
    }
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) { const c = paint(i + 0.5, j + 0.5); this.blend(j * W + i, c, c[3] * share); }
  }
  clearRect(x = 0, y = 0, w = this.canvas.width, h = this.canvas.height) {
    const m = this.m, { width: W, height: H, data: d } = this.canvas;
    this.canvas.touch();
    if (m[1] || m[2]) { d.fill(0); return; }
    const X = m[0] * x + m[4], Y = m[3] * y + m[5], Wd = m[0] * w, Hd = m[3] * h;
    const x0 = Math.max(0, Math.round(Math.min(X, X + Wd))), x1 = Math.min(W, Math.round(Math.max(X, X + Wd)));
    const y0 = Math.max(0, Math.round(Math.min(Y, Y + Hd))), y1 = Math.min(H, Math.round(Math.max(Y, Y + Hd)));
    if (x0 === 0 && x1 === W) { d.fill(0, y0 * W * 4, y1 * W * 4); return; }
    for (let j = y0; j < y1; j++) d.fill(0, (j * W + x0) * 4, (j * W + x1) * 4);
  }
  keepPath() { return { subs: this.subs, sub: this.sub }; }
  strokeRect(x, y, w, h) { const keep = this.keepPath(); this.beginPath(); this.rect(x, y, w, h); this.stroke(); this.subs = keep.subs; this.sub = keep.sub; }

  // ---- paths (points kept in the canvas's pixels)
  beginPath() { this.subs = []; this.sub = null; }
  /** Begin a subpath at a point already in pixels. */
  _start(X, Y) { this.sub = { pts: [X, Y], closed: false }; this.subs.push(this.sub); }
  _to(X, Y) { if (!this.sub) this._start(X, Y); else this.sub.pts.push(X, Y); }
  moveTo(x, y) { const [X, Y] = this.tx(x, y); this._start(X, Y); }
  lineTo(x, y) { const [X, Y] = this.tx(x, y); this._to(X, Y); }
  closePath() {
    const s = this.sub;
    if (!s) return;
    s.closed = true;
    this._start(s.pts[0], s.pts[1]);
  }
  /** The last point of the path, in pixels (null: none). */
  _last() { const s = this.sub; return s ? [s.pts[s.pts.length - 2], s.pts[s.pts.length - 1]] : null; }
  quadraticCurveTo(cx, cy, x, y) {
    const p0 = this._last() ?? this.tx(cx, cy), [C0, C1] = this.tx(cx, cy), [X, Y] = this.tx(x, y);
    const n = Math.min(64, Math.max(2, Math.ceil(Math.sqrt(Math.hypot(C0 - p0[0], C1 - p0[1]) + Math.hypot(X - C0, Y - C1)) * 1.2)));
    if (!this.sub) this._start(p0[0], p0[1]);
    for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; this.sub.pts.push(u * u * p0[0] + 2 * u * t * C0 + t * t * X, u * u * p0[1] + 2 * u * t * C1 + t * t * Y); }
  }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    const p0 = this._last() ?? this.tx(c1x, c1y), [A0, A1] = this.tx(c1x, c1y), [B0, B1] = this.tx(c2x, c2y), [X, Y] = this.tx(x, y);
    const len = Math.hypot(A0 - p0[0], A1 - p0[1]) + Math.hypot(B0 - A0, B1 - A1) + Math.hypot(X - B0, Y - B1);
    const n = Math.min(96, Math.max(2, Math.ceil(Math.sqrt(len) * 1.5)));
    if (!this.sub) this._start(p0[0], p0[1]);
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      this.sub.pts.push(a * p0[0] + b * A0 + c * B0 + d * X, a * p0[1] + b * A1 + c * B1 + d * Y);
    }
  }
  arcTo(x1, y1, x2, y2) { this.lineTo(x1, y1); }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  roundRect(x, y, w, h) { this.rect(x, y, w, h); }
  arc(cx, cy, r, a0, a1, ccw = false) { this.ellipse(cx, cy, r, r, 0, a0, a1, ccw); }
  ellipse(cx, cy, rx, ry, rot, a0, a1, ccw = false) {
    if (!(rx >= 0 && ry >= 0)) return;
    // the sweep as the canvas has it: a whole turn when asked for one or more, otherwise the way round it goes, under one
    const T = Math.PI * 2;
    let sweep = a1 - a0;
    if (!ccw && sweep >= T) sweep = T;
    else if (ccw && -sweep >= T) sweep = -T;
    else if (!ccw) { sweep %= T; if (sweep < 0) sweep += T; }
    else { sweep %= T; if (sweep > 0) sweep -= T; }
    const n = Math.max(4, Math.min(256, Math.ceil(Math.abs(sweep) * Math.sqrt(Math.max(rx, ry) * this.k) * 1.6)));
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let i = 0; i <= n; i++) {
      const a = a0 + (sweep * i) / n, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
      const [X, Y] = this.tx(cx + ex * cr - ey * sr, cy + ex * sr + ey * cr);
      if (i === 0 && !this.sub) this._start(X, Y); else this._to(X, Y);
    }
  }

  // ---- filling: each pixel's covered area, signed by the edges' way round, summed along the row (non-zero)
  fill(path) {
    const subs = path?.subs ?? this.subs;
    const paint = this.paint(this.fillStyle), solid = !(this.fillStyle instanceof Gradient);
    this.fillSubs(subs, paint, solid);
  }
  fillSubs(subs, paint, solid) {
    const C = this.canvas, { width: W, height: H } = C;
    let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
    for (const s of subs) {
      const p = s.pts;
      for (let i = 0; i < p.length; i += 2) { const x = p[i], y = p[i + 1]; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    }
    if (bx1 < 0 || by1 < 0 || bx0 >= W || by0 >= H) return;
    const X0 = Math.max(0, Math.floor(bx0)), X1 = Math.min(W - 1, Math.ceil(bx1)), Y0 = Math.max(0, Math.floor(by0)), Y1 = Math.min(H - 1, Math.ceil(by1));
    const acc = C.acc(), S = W + 2;
    for (const s of subs) {
      const p = s.pts, n = p.length / 2;
      if (n < 2) continue;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        if (j === 0 && n === 2) break;
        this.edge(acc, S, W, H, p[i * 2], p[i * 2 + 1], p[j * 2], p[j * 2 + 1]);
      }
    }
    C.touch();
    const d = C.data;
    for (let y = Y0; y <= Y1; y++) {
      let sum = 0;
      const row = y * S;
      for (let x = X0; x <= X1 + 1 && x <= W; x++) {
        sum += acc[row + x]; acc[row + x] = 0;
        if (x >= W) continue;
        const cov = Math.min(1, Math.abs(sum));
        if (cov < 1 / 512) continue;
        const c = solid ? paint() : paint(x + 0.5, y + 0.5), a = cov * c[3];
        const k = y * W + x;
        if (a >= 1) { const q = k * 4; d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255; } else this.blend(k, c, a);
      }
      // (what is left on the row past the box: cleared for the next fill)
      for (let x = X1 + 2; x < S; x++) acc[row + x] = 0;
      if (X0 > 0) for (let x = 0; x < X0; x++) acc[row + x] = 0;
    }
  }
  /** One edge's signed area into the accumulator (font-rs's way), x held to the canvas (outside it, its edge). */
  edge(a, S, W, H, x0, y0, x1, y1) {
    if (y0 === y1) return;
    let dir = 1;
    if (y0 > y1) { dir = -1; [x0, x1] = [x1, x0]; [y0, y1] = [y1, y0]; }
    if (y1 <= 0 || y0 >= H) return;
    const dxdy = (x1 - x0) / (y1 - y0);
    let x = x0;
    if (y0 < 0) { x -= y0 * dxdy; y0 = 0; }
    const yEnd = Math.min(H, Math.ceil(y1));
    for (let y = Math.floor(y0); y < yEnd; y++) {
      const dy = Math.min(y + 1, y1) - Math.max(y, y0);
      const xn = x + dxdy * dy, d = dy * dir;
      let xa = x < xn ? x : xn, xb = x < xn ? xn : x;
      xa = xa < 0 ? 0 : xa > W ? W : xa; xb = xb < 0 ? 0 : xb > W ? W : xb;
      const ls = y * S, xaf = Math.floor(xa), xai = xaf, xbc = Math.ceil(xb), xbi = xbc;
      if (xbi <= xai + 1) {
        const xm = Math.min(Math.max(0.5 * (x + xn), 0), W) - xaf;
        a[ls + xai] += d - d * xm;
        a[ls + xai + 1] += d * xm;
      } else {
        const s = 1 / (xb - xa), x0f = xa - xaf, a0 = 0.5 * s * (1 - x0f) * (1 - x0f), x1f = xb - xbc + 1, am = 0.5 * s * x1f * x1f;
        a[ls + xai] += d * a0;
        if (xbi === xai + 2) a[ls + xai + 1] += d * (1 - a0 - am);
        else {
          const a1 = s * (1.5 - x0f);
          a[ls + xai + 1] += d * (a1 - a0);
          for (let xi = xai + 2; xi < xbi - 1; xi++) a[ls + xi] += d * s;
          const a2 = a1 + (xbi - xai - 3) * s;
          a[ls + xbi - 1] += d * (1 - a2 - am);
        }
        a[ls + xbi] += d * am;
      }
      x = xn;
    }
  }

  // ---- stroking
  stroke(path) {
    const subs = path?.subs ?? this.subs;
    const { width: W, height: H } = this.canvas;
    const paint = this.paint(this.strokeStyle), solid = !(this.strokeStyle instanceof Gradient), r = Math.max(0.5, (this.lineWidth * this.k) / 2);
    // the segments, in pixels (a closed subpath's last one back to its start; dashes cut out of them)
    let segs = [];
    for (const s of subs) {
      const p = s.pts;
      for (let i = 0; i + 3 < p.length; i += 2) segs.push(p[i], p[i + 1], p[i + 2], p[i + 3]);
      if (s.closed && p.length >= 4) segs.push(p[p.length - 2], p[p.length - 1], p[0], p[1]);
    }
    if (this.dash.length && this.dash.some((v) => v > 0)) segs = this.dashed(subs);
    if (!segs.length) return;
    const mask = this.canvas.mask();
    let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
    for (let q = 0; q < segs.length; q += 4) {
      const ax = segs[q], ay = segs[q + 1], ex = segs[q + 2], ey = segs[q + 3], dx = ex - ax, dy = ey - ay, l2 = dx * dx + dy * dy || 1e-9;
      const x0 = Math.max(0, Math.floor(Math.min(ax, ex) - r - 1)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, ex) + r + 1));
      const y0 = Math.max(0, Math.floor(Math.min(ay, ey) - r - 1)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, ey) + r + 1));
      if (x1 < x0 || y1 < y0) continue;
      if (x0 < bx0) bx0 = x0; if (y0 < by0) by0 = y0; if (x1 > bx1) bx1 = x1; if (y1 > by1) by1 = y1;
      for (let j = y0; j <= y1; j++) {
        const py = j + 0.5 - ay;
        for (let i = x0; i <= x1; i++) {
          const px = i + 0.5 - ax;
          let t = (px * dx + py * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ox = px - t * dx, oy = py - t * dy, cov = r + 0.5 - Math.sqrt(ox * ox + oy * oy);
          if (cov <= 0) continue;
          const k = j * W + i, v = cov > 1 ? 1 : cov;
          if (v > mask[k]) mask[k] = v;
        }
      }
    }
    this.canvas.touch();
    for (let j = by0; j <= by1; j++) for (let i = bx0; i <= bx1; i++) {
      const k = j * W + i, v = mask[k];
      if (v > 0) { const c = solid ? paint() : paint(i + 0.5, j + 0.5); this.blend(k, c, v * c[3]); mask[k] = 0; }
    }
  }
  /** The path's segments with the dashes' gaps left out (lengths in pixels: the dash × the transform's scale). */
  dashed(subs) {
    const D = this.dash.map((v) => v * this.k), total = D.reduce((s, v) => s + v, 0), out = [];
    if (!(total > 0)) return out;
    for (const s of subs) {
      const p = s.pts.slice();
      if (s.closed && p.length >= 4) p.push(p[0], p[1]);
      let k = 0, left = D[0], on = true, off = (this.lineDashOffset * this.k) % total;
      while (off > 0) { const t = Math.min(off, left); off -= t; left -= t; if (left <= 0) { k = (k + 1) % D.length; left = D[k]; on = !on; } }
      for (let i = 0; i + 3 < p.length; i += 2) {
        let ax = p[i], ay = p[i + 1];
        const ex = p[i + 2], ey = p[i + 3];
        let len = Math.hypot(ex - ax, ey - ay);
        const ux = len ? (ex - ax) / len : 0, uy = len ? (ey - ay) / len : 0;
        while (len > 1e-9) {
          const t = Math.min(len, left);
          if (on && t > 0) out.push(ax, ay, ax + ux * t, ay + uy * t);
          ax += ux * t; ay += uy * t; len -= t; left -= t;
          if (left <= 1e-9) { k = (k + 1) % D.length; left = D[k]; on = !on; }
        }
      }
    }
    return out;
  }

  // ---- text
  /** The text's width and its letters' outlines as subpaths in pixels, placed by the alignment and baseline. */
  textSubs(text, x, y, maxWidth) {
    const F = parseFont(this.font), G = GLYPHS[F.face] ?? GLYPHS.sans, k = F.size / G.upm;
    const s = String(text ?? '');
    let w = 0;
    for (const ch of s) w += glyph(F.face, ch).adv * k;
    const squeeze = maxWidth > 0 && w > maxWidth ? maxWidth / w : 1;
    const al = this.textAlign, ww = w * squeeze;
    let ox = al === 'center' ? -ww / 2 : al === 'right' || al === 'end' ? -ww : 0;
    const asc = G.ascent / (G.ascent - G.descent), desc = 1 - asc, bl = this.textBaseline;
    const oy = bl === 'top' || bl === 'hanging' ? asc * F.size : bl === 'middle' ? ((asc - desc) / 2) * F.size : bl === 'bottom' || bl === 'ideographic' ? -desc * F.size : 0;
    const subs = [];
    let pen = 0;
    const steps = Math.min(12, Math.max(2, Math.ceil(Math.sqrt(F.size * this.k) * 0.6)));
    for (const ch of s) {
      const g = glyph(F.face, ch), gx = x + ox + pen * squeeze;
      const at = (px, py) => this.tx(gx + (px * k + py * k * F.slant) * squeeze, y + oy - py * k);
      let sub = null, last = null;
      for (const c of g.cmds) {
        if (c[0] === 'M') { const P = at(c[1], c[2]); sub = { pts: [P[0], P[1]], closed: true }; subs.push(sub); last = [c[1], c[2]]; }
        else if (c[0] === 'L' && sub) { const P = at(c[1], c[2]); sub.pts.push(P[0], P[1]); last = [c[1], c[2]]; }
        else if (c[0] === 'Q' && sub) {
          for (let i = 1; i <= steps; i++) {
            const t = i / steps, u = 1 - t, qx = u * u * last[0] + 2 * u * t * c[1] + t * t * c[3], qy = u * u * last[1] + 2 * u * t * c[2] + t * t * c[4];
            const P = at(qx, qy); sub.pts.push(P[0], P[1]);
          }
          last = [c[3], c[4]];
        }
      }
      pen += g.adv * k;
    }
    return { subs, width: w };
  }
  fillText(text, x, y, maxWidth) {
    const { subs } = this.textSubs(text, x, y, maxWidth);
    if (subs.length) this.fillSubs(subs, this.paint(this.fillStyle), !(this.fillStyle instanceof Gradient));
  }
  strokeText(text, x, y, maxWidth) { const keep = this.keepPath(); this.subs = this.textSubs(text, x, y, maxWidth).subs; this.stroke(); this.subs = keep.subs; this.sub = keep.sub; }
  measureText(text) {
    const F = parseFont(this.font), G = GLYPHS[F.face] ?? GLYPHS.sans, k = F.size / G.upm;
    let w = 0;
    for (const ch of String(text ?? '')) w += glyph(F.face, ch).adv * k;
    const asc = (G.ascent / (G.ascent - G.descent)) * F.size;
    return { width: w, actualBoundingBoxLeft: 0, actualBoundingBoxRight: w, actualBoundingBoxAscent: asc * 0.72, actualBoundingBoxDescent: (F.size - asc) * 0.5, fontBoundingBoxAscent: asc, fontBoundingBoxDescent: F.size - asc };
  }

  // ---- pictures (the Map's smooth ground: the grid's colours a pixel a cell, spread over the map; issue #343)
  /** A canvas of its own, `w` × `h` (drawTerrain's small one: an OffscreenCanvas on the page). */
  offscreen(w, h) { return new PixelCanvas(w, h); }
  createImageData(w, h) {
    if (w && typeof w === 'object') ({ width: w, height: h } = w);
    return { width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4) };
  }
  getImageData(x, y, w, h) {
    const img = this.createImageData(w, h), { width: W, height: H, data: d } = this.canvas;
    for (let j = 0; j < h; j++) {
      const sy = y + j;
      if (sy < 0 || sy >= H) continue;
      for (let i = 0; i < w; i++) { const sx = x + i; if (sx < 0 || sx >= W) continue; const a = (sy * W + sx) * 4, b = (j * w + i) * 4; img.data[b] = d[a]; img.data[b + 1] = d[a + 1]; img.data[b + 2] = d[a + 2]; img.data[b + 3] = d[a + 3]; }
    }
    return img;
  }
  /** An image's pixels put down as they are (no blending, no transform), its top left at (x, y). */
  putImageData(img, x = 0, y = 0) {
    const { width: W, height: H, data: d } = this.canvas, s = img.data, x0 = Math.round(x), y0 = Math.round(y);
    this.canvas.touch();
    for (let j = 0; j < img.height; j++) {
      const ty = y0 + j;
      if (ty < 0 || ty >= H) continue;
      for (let i = 0; i < img.width; i++) {
        const tx = x0 + i;
        if (tx < 0 || tx >= W) continue;
        const a = (j * img.width + i) * 4, b = (ty * W + tx) * 4;
        d[b] = s[a]; d[b + 1] = s[a + 1]; d[b + 2] = s[a + 2]; d[b + 3] = s[a + 3];
      }
    }
  }
  /**
   * A canvas (or an ImageData) drawn over this one: (src, dx, dy), (src, dx, dy, dw, dh) or (src, sx, sy, sw, sh, dx, dy,
   * dw, dh); smoothed as a page's canvas spreads a small picture (bilinear, its colours weighed by their cover, so a clear
   * pixel's colour never bleeds in), or not (imageSmoothingEnabled false), blended over what is there. The transform's
   * scale and move are taken, not a turn. A picture the VM cannot read (an Image) draws nothing.
   */
  drawImage(src, ...a) {
    let s = src?.data, sw0 = src?.width, sh0 = src?.height;
    if (!s || !(sw0 > 0 && sh0 > 0)) return;
    let sx = 0, sy = 0, sw = sw0, sh = sh0, dx, dy, dw, dh;
    if (a.length >= 8) [sx, sy, sw, sh, dx, dy, dw, dh] = a;
    else { [dx = 0, dy = 0, dw = sw0, dh = sh0] = a; }
    if (s === this.canvas.data) s = s.slice();   // (drawn onto itself: what was there before)
    const m = this.m;
    const X = m[0] * dx + m[4], Y = m[3] * dy + m[5];
    dw *= m[0]; dh *= m[3]; dx = X; dy = Y;
    if (dw < 0) { dx += dw; dw = -dw; } if (dh < 0) { dy += dh; dh = -dh; }
    const { width: W, height: H, data: d } = this.canvas;
    if (!(dw > 0 && dh > 0 && sw > 0 && sh > 0)) return;
    const x0 = Math.max(0, Math.floor(dx)), y0 = Math.max(0, Math.floor(dy)), x1 = Math.min(W, Math.ceil(dx + dw)), y1 = Math.min(H, Math.ceil(dy + dh));
    const kx = sw / dw, ky = sh / dh, smooth = this.imageSmoothingEnabled !== false, ga = this.globalAlpha;
    const lx = Math.max(0, Math.floor(sx)), ly = Math.max(0, Math.floor(sy)), hx = Math.min(sw0 - 1, Math.ceil(sx + sw) - 1), hy = Math.min(sh0 - 1, Math.ceil(sy + sh) - 1);
    if (hx < lx || hy < ly) return;
    this.canvas.touch();
    const c = [0, 0, 0];
    for (let j = y0; j < y1; j++) {
      const v = sy + (j + 0.5 - dy) * ky - 0.5, vj = Math.floor(v), fy = smooth ? v - vj : 0;
      const ja = Math.min(hy, Math.max(ly, smooth ? vj : Math.round(v))), jb = Math.min(hy, Math.max(ly, vj + 1));
      for (let i = x0; i < x1; i++) {
        const u = sx + (i + 0.5 - dx) * kx - 0.5, ui = Math.floor(u), fx = smooth ? u - ui : 0;
        const ia = Math.min(hx, Math.max(lx, smooth ? ui : Math.round(u))), ib = Math.min(hx, Math.max(lx, ui + 1));
        const p00 = (ja * sw0 + ia) * 4, p10 = (ja * sw0 + ib) * 4, p01 = (jb * sw0 + ia) * 4, p11 = (jb * sw0 + ib) * 4;
        const w00 = (1 - fx) * (1 - fy) * s[p00 + 3], w10 = fx * (1 - fy) * s[p10 + 3], w01 = (1 - fx) * fy * s[p01 + 3], w11 = fx * fy * s[p11 + 3];
        const wa = w00 + w10 + w01 + w11;
        if (wa <= 0) continue;
        for (let q = 0; q < 3; q++) c[q] = (s[p00 + q] * w00 + s[p10 + q] * w10 + s[p01 + q] * w01 + s[p11 + q] * w11) / wa;
        this.blend(j * W + i, c, (wa / 255) * ga);
      }
    }
  }
}

export class PixelCanvas {
  constructor(width = 300, height = width === 300 ? 150 : width) {
    this._w = Math.max(1, width | 0); this._h = Math.max(1, height | 0); this._ctx = null;
    this.version = 0;
    // (what a page's canvas element answers that the game asks of one)
    this.style = {}; this.dataset = {}; this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
    this.resize();
  }
  // (a canvas's size set again clears it, as a page's does: WorldMap sets it before it draws)
  get width() { return this._w; }
  set width(v) { this._w = Math.max(1, v | 0); this.resize(); }
  get height() { return this._h; }
  set height(v) { this._h = Math.max(1, v | 0); this.resize(); }
  resize() { this.data = new Uint8ClampedArray(this._w * this._h * 4); this._mask = null; this._acc = null; this.touch(); if (this._ctx) { this._ctx.m = IDENTITY.slice(); this._ctx.stack.length = 0; this._ctx.beginPath(); } }
  touch() { this.version++; }
  mask() { return (this._mask ??= new Float32Array(this.width * this.height)); }
  /** The fill's accumulator: a row of width + 2 a line, kept zero between fills. */
  acc() { return (this._acc ??= new Float32Array((this.width + 2) * this.height)); }
  getContext(kind) { return kind === '2d' ? (this._ctx ??= new Context2D(this)) : null; }
  // (the element's own calls: none of them draw)
  addEventListener() {} removeEventListener() {} dispatchEvent() { return true; } setAttribute() {} getAttribute() { return null; } remove() {}
  getBoundingClientRect() { return { left: 0, top: 0, right: this._w, bottom: this._h, x: 0, y: 0, width: this._w, height: this._h }; }
  toDataURL() { return 'data:,'; }
  toBlob(cb) { cb?.(null); }
}
