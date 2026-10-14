// A canvas for an engine's VM, drawn in plain JavaScript into RGBA bytes (docs/systems/engine-bridge.md, "The menus"):
// the few calls of the 2D context the game's map uses (src/world-map.js drawTerrain: fillRect, strokeRect, the
// paths' moveTo / lineTo and stroke, fillStyle / strokeStyle as '#rrggbb', 'rgb(…)' or 'rgba(…)', lineWidth, and the
// ground's small picture put in and spread over the map smoothed: offscreen, putImageData, drawImage), so the
// same drawing the web makes on its canvas becomes a picture the engine shows (the Unity bridge: BridgeMenu's Map).
// The page's own canvas is not needed: engine/platform.js's stand-in draws nothing.
//
//   const c = new PixelCanvas(512, 512);
//   drawTerrain(c.getContext('2d'), grid, 512);
//   c.data   → Uint8ClampedArray, width × height × 4, rows top to bottom, sRGB, opaque where drawn
//
// A stroke is laid down as a coverage mask first (each pixel's nearness to the nearest segment, antialiased over a
// pixel) and then blended once in its colour, so a pale line crossing itself doesn't darken (as a canvas strokes).

/** '#rrggbb', '#rgb', 'rgb(r, g, b)', 'rgba(r, g, b, a)' → [r, g, b, a] (a 0..1); black for anything else. */
export function parseColour(s) {
  const t = String(s ?? '').trim();
  let m = t.match(/^#([0-9a-f]{6})$/i);
  if (m) { const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 1]; }
  m = t.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m) return [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16), 1];
  m = t.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  return [0, 0, 0, 1];
}

class Context2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000'; this.strokeStyle = '#000'; this.lineWidth = 1;
    this.lineCap = 'butt'; this.lineJoin = 'miter'; this.imageSmoothingEnabled = true; this.imageSmoothingQuality = 'low'; this.globalAlpha = 1;
    this.segs = []; this.pen = null;
    this.colours = new Map();
  }
  colour(s) { let c = this.colours.get(s); if (!c) { c = parseColour(s); this.colours.set(s, c); } return c; }
  /** Blend one pixel (k: its index) toward c by coverage a. */
  blend(k, c, a) {
    const d = this.canvas.data, i = k * 4, b = 1 - a;
    d[i] = d[i] * b + c[0] * a; d[i + 1] = d[i + 1] * b + c[1] * a; d[i + 2] = d[i + 2] * b + c[2] * a;
    d[i + 3] = Math.min(255, d[i + 3] + 255 * a);
  }
  fillRect(x, y, w, h) {
    const { width: W, height: H } = this.canvas, c = this.colour(this.fillStyle), a = c[3] * this.globalAlpha;
    // (the pixels whose middles it covers; a rect under a pixel still marks the one it sits in, at its share)
    let x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h), k = a;
    if (x1 <= x0 || y1 <= y0) { x0 = Math.floor(x); y0 = Math.floor(y); x1 = x0 + 1; y1 = y0 + 1; k = a * Math.min(1, Math.max(0, w) * Math.max(0, h)); }
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
    const d = this.canvas.data;
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) {
      if (k >= 1) { const p = (j * W + i) * 4; d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255; } else this.blend(j * W + i, c, k);
    }
  }
  clearRect() { this.canvas.data.fill(0); }
  beginPath() { this.segs.length = 0; this.pen = null; }
  moveTo(x, y) { this.pen = [x, y]; }
  lineTo(x, y) { if (this.pen) this.segs.push(this.pen[0], this.pen[1], x, y); this.pen = [x, y]; }
  closePath() {}
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.lineTo(x, y); }
  strokeRect(x, y, w, h) { const keep = this.segs.slice(); this.beginPath(); this.rect(x, y, w, h); this.stroke(); this.segs = keep; }
  stroke() {
    const { width: W, height: H } = this.canvas, s = this.segs;
    if (!s.length) return;
    const c = this.colour(this.strokeStyle), a = c[3] * this.globalAlpha, r = Math.max(0.5, this.lineWidth / 2);
    const mask = this.canvas.mask();
    let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
    for (let q = 0; q < s.length; q += 4) {
      const ax = s[q], ay = s[q + 1], ex = s[q + 2], ey = s[q + 3], dx = ex - ax, dy = ey - ay, l2 = dx * dx + dy * dy || 1e-9;
      const x0 = Math.max(0, Math.floor(Math.min(ax, ex) - r - 1)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, ex) + r + 1));
      const y0 = Math.max(0, Math.floor(Math.min(ay, ey) - r - 1)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, ey) + r + 1));
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
    for (let j = by0; j <= by1; j++) for (let i = bx0; i <= bx1; i++) {
      const k = j * W + i, v = mask[k];
      if (v > 0) { this.blend(k, c, v * a); mask[k] = 0; }
    }
  }
  fill() {}
  // ---- pictures (drawTerrain's smooth ground: the grid's colours a pixel a cell, spread over the map; issue #343)
  /** A canvas of its own, `w` × `h` (drawTerrain's small one: an OffscreenCanvas on the page). */
  offscreen(w, h) { return new PixelCanvas(w, h); }
  createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4) }; }
  /** An image's pixels put down as they are (no blending), its top left at (x, y). */
  putImageData(img, x = 0, y = 0) {
    const { width: W, height: H, data: d } = this.canvas, s = img.data, x0 = Math.round(x), y0 = Math.round(y);
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
   * A canvas drawn over this one at (dx, dy), dw × dh, smoothed as a page's canvas spreads a small picture (bilinear,
   * its colours weighed by their cover, so a clear pixel's colour never bleeds in), blended over what is there.
   */
  drawImage(src, dx = 0, dy = 0, dw = src.width, dh = src.height) {
    const { width: W, height: H, data: d } = this.canvas, s = src.data, sw = src.width, sh = src.height;
    if (!s || !(dw > 0 && dh > 0)) return;
    const x0 = Math.max(0, Math.floor(dx)), y0 = Math.max(0, Math.floor(dy)), x1 = Math.min(W, Math.ceil(dx + dw)), y1 = Math.min(H, Math.ceil(dy + dh));
    const kx = sw / dw, ky = sh / dh, smooth = this.imageSmoothingEnabled !== false, ga = this.globalAlpha;
    for (let j = y0; j < y1; j++) {
      const v = (j + 0.5 - dy) * ky - 0.5, vj = Math.floor(v), fy = smooth ? v - vj : 0;
      const ja = Math.min(sh - 1, Math.max(0, smooth ? vj : Math.round(v))), jb = Math.min(sh - 1, Math.max(0, vj + 1));
      for (let i = x0; i < x1; i++) {
        const u = (i + 0.5 - dx) * kx - 0.5, ui = Math.floor(u), fx = smooth ? u - ui : 0;
        const ia = Math.min(sw - 1, Math.max(0, smooth ? ui : Math.round(u))), ib = Math.min(sw - 1, Math.max(0, ui + 1));
        const p00 = (ja * sw + ia) * 4, p10 = (ja * sw + ib) * 4, p01 = (jb * sw + ia) * 4, p11 = (jb * sw + ib) * 4;
        const w00 = (1 - fx) * (1 - fy) * s[p00 + 3], w10 = fx * (1 - fy) * s[p10 + 3], w01 = (1 - fx) * fy * s[p01 + 3], w11 = fx * fy * s[p11 + 3];
        const wa = w00 + w10 + w01 + w11;
        if (wa <= 0) continue;
        const a = (wa / 255) * ga, q = (j * W + i) * 4, b = 1 - a;
        for (let c = 0; c < 3; c++) d[q + c] = d[q + c] * b + ((s[p00 + c] * w00 + s[p10 + c] * w10 + s[p01 + c] * w01 + s[p11 + c] * w11) / wa) * a;
        d[q + 3] = Math.min(255, d[q + 3] + 255 * a);
      }
    }
  }
  save() {} restore() {} translate() {} scale() {} setTransform() {}
  measureText(s) { return { width: String(s ?? '').length * 6 }; }
}

export class PixelCanvas {
  constructor(width = 1, height = width) {
    this._w = width; this._h = height; this._ctx = null;
    this.resize();
  }
  // (a canvas's size set again clears it, as a page's does: WorldMap sets it before it draws)
  get width() { return this._w; }
  set width(v) { this._w = Math.max(1, v | 0); this.resize(); }
  get height() { return this._h; }
  set height(v) { this._h = Math.max(1, v | 0); this.resize(); }
  resize() { this.data = new Uint8ClampedArray(this._w * this._h * 4); this._mask = null; }
  mask() { return (this._mask ??= new Float32Array(this.width * this.height)); }
  getContext(kind) { return kind === '2d' ? (this._ctx ??= new Context2D(this)) : null; }
}
