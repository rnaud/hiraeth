// The tracing behind the title's vector drawings (scripts/title-vectors.mjs, issue #110): a picture's pixels in,
// flat colour regions and its ink lines out, as SVG paths. Pure (no DOM, no files): tests/title-vectors.test.js.
//
//   quantize(rgba, w, h, { k, ink })   → { labels, palette }   k colours (k-means), the ink's pixels filled from round them
//   cleanLabels(labels, w, h, { passes, minArea })              speckle away: a majority filter, small pieces merged
//   components(mask or labels, w, h)   → { comp, list }         4-connected pieces: { id, label, area, box, top }
//   loops(inside, w, h)                → [[x, y, …], …]          the outlines of a mask, along the pixels' edges
//   simplify(points, eps)                                        Ramer-Douglas-Peucker on a closed loop
//   pathOf(loops, scale, { smooth })   → 'M…Z…'                  compact SVG path data (relative, integers)

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** A tiny seeded random (mulberry32): the same picture traces the same way every time. */
function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * k colours for a picture (k-means++ on a sample, then Lloyd), every pixel labelled with its nearest; the ink's pixels
 * (`ink`, a 0/1 mask: inkMask) are left out of the colours and labelled from their neighbours.
 */
export function quantize(rgba, w, h, { k = 12, ink = null, iterations = 12, sample = 24000, seed = 7, extra = 6, residual = 900 } = {}) {
  const n = w * h, rand = rng(seed);
  const isInk = ink ?? new Uint8Array(n);
  const idx = [];
  for (let i = 0; i < n; i++) if (!isInk[i]) idx.push(i);
  const pick = [];
  for (let s = 0; s < Math.min(sample, idx.length); s++) pick.push(idx[Math.floor(rand() * idx.length)]);
  const px = (i) => [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]];
  const d2 = (a, b) => (a[0] - b[0]) ** 2 * 0.9 + (a[1] - b[1]) ** 2 * 1.2 + (a[2] - b[2]) ** 2 * 0.9;
  // k-means++ seeds
  const C = [px(pick[0])];
  const dist = pick.map((i) => d2(px(i), C[0]));
  while (C.length < k) {
    const sum = dist.reduce((a, b) => a + b, 0);
    let t = rand() * sum, j = 0;
    while (j < dist.length - 1 && (t -= dist[j]) > 0) j++;
    C.push(px(pick[j]));
    for (let s = 0; s < pick.length; s++) dist[s] = Math.min(dist[s], d2(px(pick[s]), C[C.length - 1]));
  }
  const nearest = (p) => { let best = 0, bd = Infinity; for (let c = 0; c < C.length; c++) { const d = d2(p, C[c]); if (d < bd) { bd = d; best = c; } } return best; };
  for (let it = 0; it < iterations; it++) {
    const acc = C.map(() => [0, 0, 0, 0]);
    for (const i of pick) { const p = px(i), c = nearest(p); acc[c][0] += p[0]; acc[c][1] += p[1]; acc[c][2] += p[2]; acc[c][3]++; }
    for (let c = 0; c < C.length; c++) if (acc[c][3]) C[c] = [acc[c][0] / acc[c][3], acc[c][1] / acc[c][3], acc[c][2] / acc[c][3]];
  }
  // the colours the clusters fit worst (a small red coat, a green orb): clusters of their own, `extra` more
  for (let round = 0; round < extra; round++) {
    let worst = null, wd = residual;
    const far = [];
    for (const i of pick) { const p = px(i), d = d2(p, C[nearest(p)]); if (d > residual) far.push(p); if (d > wd) { wd = d; worst = p; } }
    if (!worst || far.length < pick.length * 0.0004) break;
    // the far pixels' own mean, near the worst of them
    let c = worst;
    for (let it = 0; it < 6; it++) {
      const acc = [0, 0, 0, 0];
      for (const p of far) if (d2(p, c) < residual) { acc[0] += p[0]; acc[1] += p[1]; acc[2] += p[2]; acc[3]++; }
      if (acc[3]) c = [acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3]];
    }
    C.push(c);
  }
  const labels = new Int16Array(n).fill(-1);
  for (const i of idx) labels[i] = nearest(px(i));
  // the ink's pixels: from their labelled neighbours, ring by ring
  let left = n - idx.length;
  for (let guard = 0; left > 0 && guard < 64; guard++) {
    const next = labels.slice();
    for (let i = 0; i < n; i++) {
      if (labels[i] >= 0) continue;
      const x = i % w, y = (i / w) | 0;
      const votes = new Map();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const l = labels[Y * w + X];
        if (l >= 0) votes.set(l, (votes.get(l) ?? 0) + 1);
      }
      if (votes.size) { next[i] = [...votes].sort((a, b) => b[1] - a[1])[0][0]; left--; }
    }
    labels.set(next);
  }
  for (let i = 0; i < n; i++) if (labels[i] < 0) labels[i] = 0;
  return { labels, palette: C.map((c) => c.map((v) => Math.round(v))), isInk };
}

/** A 3 × 3 majority filter `passes` times, then every 4-connected piece under `minArea` pixels joins its commonest neighbour. */
export function cleanLabels(labels, w, h, { passes = 2, minArea = 12 } = {}) {
  let L = labels;
  for (let p = 0; p < passes; p++) {
    const out = L.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const counts = new Map();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const l = L[(y + dy) * w + x + dx]; counts.set(l, (counts.get(l) ?? 0) + 1); }
      let best = L[y * w + x], bc = counts.get(best);
      for (const [l, c] of counts) if (c > bc) { best = l; bc = c; }
      if (bc >= 5) out[y * w + x] = best;
    }
    L = out;
  }
  for (let round = 0; round < 4; round++) {
    const { comp, list } = components(L, w, h);
    let changed = 0;
    for (const c of list) {
      if (c.area >= minArea) continue;
      const votes = new Map();
      for (const i of c.pixels) {
        const x = i % w, y = (i / w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const j = Y * w + X;
          if (comp[j] !== c.id) votes.set(L[j], (votes.get(L[j]) ?? 0) + 1);
        }
      }
      if (!votes.size) continue;
      const to = [...votes].sort((a, b) => b[1] - a[1])[0][0];
      for (const i of c.pixels) L[i] = to;
      changed++;
    }
    if (!changed) break;
  }
  return L;
}

/** The 4-connected pieces of a label image (or of a 0/1 mask: label 1 only when `only` is given). */
export function components(labels, w, h, { only = null } = {}) {
  const comp = new Int32Array(w * h).fill(-1), list = [];
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (comp[s] >= 0 || (only !== null && labels[s] !== only)) continue;
    const id = list.length, label = labels[s], pixels = [];
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    comp[s] = id; stack.push(s);
    while (stack.length) {
      const i = stack.pop(); pixels.push(i);
      const x = i % w, y = (i / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && comp[i - 1] < 0 && labels[i - 1] === label) { comp[i - 1] = id; stack.push(i - 1); }
      if (x < w - 1 && comp[i + 1] < 0 && labels[i + 1] === label) { comp[i + 1] = id; stack.push(i + 1); }
      if (y > 0 && comp[i - w] < 0 && labels[i - w] === label) { comp[i - w] = id; stack.push(i - w); }
      if (y < h - 1 && comp[i + w] < 0 && labels[i + w] === label) { comp[i + w] = id; stack.push(i + w); }
    }
    list.push({ id, label, area: pixels.length, pixels, box: [x0, y0, x1 + 1, y1 + 1] });
  }
  return { comp, list };
}

/**
 * The outlines of the pixels where inside(i) is true, along the pixels' edges: closed loops of lattice points
 * (x0, y0, x1, y1, …), the outer ones clockwise and the holes the other way (fill them even-odd or non-zero alike).
 */
export function loops(inside, w, h) {
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && inside(y * w + x);
  // directed edges with the inside on their right: from each lattice vertex, where they go
  const out = new Map();
  const key = (x, y) => y * (w + 1) + x;
  const add = (ax, ay, bx, by) => { const k = key(ax, ay); const l = out.get(k); if (l) l.push(bx, by); else out.set(k, [bx, by]); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!at(x, y)) continue;
    if (!at(x, y - 1)) add(x, y, x + 1, y);
    if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!at(x - 1, y)) add(x, y + 1, x, y);
  }
  const result = [];
  for (const [k0] of out) {
    while (out.get(k0)?.length) {
      const pts = [];
      let x = k0 % (w + 1), y = Math.floor(k0 / (w + 1)), px = null, py = null;
      const sx = x, sy = y;
      for (let guard = 0; guard < 4 * w * h + 8; guard++) {
        pts.push(x, y);
        const l = out.get(key(x, y));
        if (!l?.length) break;
        let j = 0;
        if (l.length > 2 && px !== null) {
          // a vertex two pieces touch at a corner: turn right (keep each piece's loop its own)
          const dx = x - px, dy = y - py;
          const right = [-dy, dx];
          for (let m = 0; m < l.length; m += 2) if (l[m] - x === right[0] && l[m + 1] - y === right[1]) { j = m; break; }
        }
        const nx = l[j], ny = l[j + 1];
        l.splice(j, 2);
        px = x; py = y; x = nx; y = ny;
        if (x === sx && y === sy) break;
      }
      if (pts.length >= 6) result.push(pts);
    }
  }
  return result;
}

/** Ramer-Douglas-Peucker on a closed loop (flat [x, y, …]): the points within `eps` of the line dropped. */
export function simplify(pts, eps = 0.7) {
  const n = pts.length / 2;
  if (n <= 4) return pts.slice();
  // split the loop at its first point and the point farthest from it
  let far = 0, fd = -1;
  for (let i = 1; i < n; i++) { const d = (pts[2 * i] - pts[0]) ** 2 + (pts[2 * i + 1] - pts[1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const keep = new Uint8Array(n); keep[0] = 1; keep[far] = 1;
  const rdp = (a, b) => {   // indices along the loop, b may wrap past n
    if (b - a < 2) return;
    const ax = pts[2 * (a % n)], ay = pts[2 * (a % n) + 1], bx = pts[2 * (b % n)], by = pts[2 * (b % n) + 1];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let best = -1, bd = -1;
    for (let i = a + 1; i < b; i++) {
      const x = pts[2 * (i % n)], y = pts[2 * (i % n) + 1];
      const d = Math.abs(dy * (x - ax) - dx * (y - ay)) / len;
      if (d > bd) { bd = d; best = i; }
    }
    if (bd > eps) { keep[best % n] = 1; rdp(a, best); rdp(best, b); }
  };
  rdp(0, far); rdp(far, n);
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[2 * i], pts[2 * i + 1]);
  return out;
}

/** The loops' area (signed, lattice units): what a loop encloses, for dropping the tiniest. */
export function loopArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length / 2; i < n; i++) { const j = (i + 1) % n; a += pts[2 * i] * pts[2 * j + 1] - pts[2 * j] * pts[2 * i + 1]; }
  return a / 2;
}

/**
 * Compact SVG path data for loops scaled by `scale`: relative moves in whole units; `smooth` draws each loop as
 * quadratic curves through its edges' midpoints (the corners rounded, as a brush would), else straight lines.
 */
export function pathOf(list, scale = 1, { smooth = false, digits = 0, frame = null } = {}) {
  const f = 10 ** digits, r = (v) => Math.round(v * scale * f) / f;
  let d = '', cx = 0, cy = 0;
  const num = (v) => (Object.is(v, -0) ? '0' : String(v));
  const pair = (x, y) => { const s = `${num(x)}${y < 0 ? '' : ' '}${num(y)}`; return s; };
  const join = (vals) => vals.reduce((acc, v, i) => acc + (i && v >= 0 ? ' ' : '') + num(v), '');
  for (const pts of list) {
    const n = pts.length / 2;
    const P = [];
    for (let i = 0; i < n; i++) P.push([r(pts[2 * i]), r(pts[2 * i + 1])]);
    if (!smooth) {
      const [x0, y0] = P[0];
      d += `${d ? 'm' : 'M'}${pair(x0 - (d ? cx : 0), y0 - (d ? cy : 0))}`;
      let lx = x0, ly = y0;
      const rel = [];
      for (let i = 1; i < n; i++) { const [x, y] = P[i]; if (x === lx && y === ly) continue; rel.push(x - lx, y - ly); lx = x; ly = y; }
      d += `l${join(rel)}z`;
      cx = x0; cy = y0;
    } else {
      // through the midpoints, each corner a control point
      const mid = (a, b) => [Math.round(((a[0] + b[0]) / 2) * f) / f, Math.round(((a[1] + b[1]) / 2) * f) / f];
      const m0 = mid(P[n - 1], P[0]);
      d += `${d ? 'm' : 'M'}${pair(m0[0] - (d ? cx : 0), m0[1] - (d ? cy : 0))}`;
      let lx = m0[0], ly = m0[1];
      // (a corner on the picture's edge stays a corner: the frame's corners are not rounded off)
      let cmd = '', vals = [];
      const emit = (c, v) => { if (c !== cmd) { if (cmd) d += `${cmd}${join(vals)}`; cmd = c; vals = []; } vals.push(...v); };
      for (let i = 0; i < n; i++) {
        const c = P[i], m = mid(P[i], P[(i + 1) % n]);
        const ox = pts[2 * i], oy = pts[2 * i + 1];
        if (frame && (ox <= 0 || oy <= 0 || ox >= frame[0] || oy >= frame[1])) emit('l', [c[0] - lx, c[1] - ly, m[0] - c[0], m[1] - c[1]]);
        else emit('q', [c[0] - lx, c[1] - ly, m[0] - lx, m[1] - ly]);
        lx = m[0]; ly = m[1];
      }
      d += `${cmd}${join(vals)}z`;
      cx = m0[0]; cy = m0[1];
    }
  }
  return d;
}

/**
 * The ink in a picture: the pen's lines are valleys of darkness, a pixel darker by `contrast` than the pixels `reach`
 * away on both sides along some direction (across the line), and no lighter than `under`. A dark sea is no line, nor
 * the dark water beside a bright glint (one side only is lighter).
 */
export function inkMask(rgba, w, h, { reach = [2, 3], contrast = 24, under = 160 } = {}) {
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = lum(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
  const mask = new Uint8Array(w * h);
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = L[y * w + x];
    if (l > under) continue;
    let hit = false;
    for (const r of reach) {
      for (const [dx, dy] of dirs) {
        const ax = x - dx * r, ay = y - dy * r, bx = x + dx * r, by = y + dy * r;
        if (ax < 0 || ay < 0 || bx < 0 || by < 0 || ax >= w || bx >= w || ay >= h || by >= h) continue;
        if (l < Math.min(L[ay * w + ax], L[by * w + bx]) - contrast) { hit = true; break; }
      }
      if (hit) break;
    }
    if (hit) mask[y * w + x] = 1;
  }
  return mask;
}

/** A 0/1 mask closed (grown by `r` pixels, then shrunk back): the gaps a picture's compression bit out of a line, filled. */
export function close(mask, w, h, r = 1) {
  const grow = (m, on) => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let hit = !on;
      for (let dy = -r; dy <= r && hit !== on; dy++) for (let dx = -r; dx <= r; dx++) {
        const X = x + dx, Y = y + dy;
        const v = X >= 0 && Y >= 0 && X < w && Y < h ? m[Y * w + X] : (on ? 0 : 1);
        if (!!v === on) { hit = on; break; }
      }
      out[y * w + x] = hit ? 1 : 0;
    }
    return out;
  };
  return grow(grow(mask, true), false);
}

/** Zhang-Suen thinning of a 0/1 mask, in place: one-pixel-wide centre lines. */
export function thin(mask, w, h) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? mask[y * w + x] : 0);
  for (let changed = true, guard = 0; changed && guard < 100; guard++) {
    changed = false;
    for (const step of [0, 1]) {
      const del = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
        const b = p.reduce((a, v) => a + v, 0);
        if (b < 2 || b > 6) continue;
        let a = 0; for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) a++;
        if (a !== 1) continue;
        if (step === 0 ? (p[0] * p[2] * p[4] || p[2] * p[4] * p[6]) : (p[0] * p[2] * p[6] || p[0] * p[4] * p[6])) continue;
        del.push(y * w + x);
      }
      for (const i of del) mask[i] = 0;
      if (del.length) changed = true;
    }
  }
  return mask;
}

/** The centre lines of a thinned mask as open polylines ([x, y, …] in pixel centres), each pixel pair walked once. */
export function strokes(mask, w, h) {
  const N = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  // (m-adjacency: a diagonal step only where no side step makes it, so a staircase is one line, not a knot at every stair)
  const on = (X, Y) => X >= 0 && Y >= 0 && X < w && Y < h && mask[Y * w + X];
  const nb = (i) => {
    const x = i % w, y = (i / w) | 0, out = [];
    for (const [dx, dy] of N) {
      const X = x + dx, Y = y + dy;
      if (!on(X, Y)) continue;
      if (dx && dy && (on(x + dx, y) || on(x, y + dy))) continue;
      out.push(Y * w + X);
    }
    return out;
  };
  const used = new Set();
  const ek = (a, b) => (a < b ? a * w * h + b : b * w * h + a);
  const lines = [];
  const walk = (s, n) => {
    const pts = [s % w + 0.5, ((s / w) | 0) + 0.5];
    let prev = s, cur = n;
    used.add(ek(s, n));
    for (let guard = 0; guard < w * h; guard++) {
      pts.push(cur % w + 0.5, ((cur / w) | 0) + 0.5);
      const around = nb(cur), next = around.filter((j) => j !== prev && !used.has(ek(cur, j)));
      if (around.length !== 2 || !next.length) break;
      used.add(ek(cur, next[0])); prev = cur; cur = next[0];
    }
    lines.push(pts);
  };
  const ends = [];
  for (let i = 0; i < w * h; i++) if (mask[i] && nb(i).length !== 2) ends.push(i);
  for (const s of ends) for (const n of nb(s)) if (!used.has(ek(s, n))) walk(s, n);
  for (let i = 0; i < w * h; i++) if (mask[i]) for (const n of nb(i)) if (!used.has(ek(i, n))) walk(i, n);   // (closed rings)
  return lines;
}

/** Ramer-Douglas-Peucker on an open polyline. */
export function simplifyOpen(pts, eps = 0.6) {
  const n = pts.length / 2;
  if (n <= 2) return pts.slice();
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const rdp = (a, b) => {
    if (b - a < 2) return;
    const ax = pts[2 * a], ay = pts[2 * a + 1], dx = pts[2 * b] - ax, dy = pts[2 * b + 1] - ay, len = Math.hypot(dx, dy) || 1;
    let best = -1, bd = -1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * (pts[2 * i] - ax) - dx * (pts[2 * i + 1] - ay)) / len; if (d > bd) { bd = d; best = i; } }
    if (bd > eps) { keep[best] = 1; rdp(a, best); rdp(best, b); }
  };
  rdp(0, n - 1);
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[2 * i], pts[2 * i + 1]);
  return out;
}

/** The length of an open polyline. */
export const lineLength = (pts) => { let s = 0; for (let i = 2; i < pts.length; i += 2) s += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); return s; };

/** Open polylines as compact path data (relative, whole units after `scale`). */
export function strokePath(list, scale = 1) {
  const r = (v) => Math.round(v * scale);
  const num = (v) => (Object.is(v, -0) ? '0' : String(v));
  const join = (vals) => vals.reduce((acc, v, i) => acc + (i && v >= 0 ? ' ' : '') + num(v), '');
  let d = '', cx = 0, cy = 0;
  for (const pts of list) {
    const x0 = r(pts[0]), y0 = r(pts[1]);
    d += `${d ? 'm' : 'M'}${join([x0 - cx, y0 - cy])}`;
    let lx = x0, ly = y0;
    const rel = [];
    for (let i = 2; i < pts.length; i += 2) { const x = r(pts[i]), y = r(pts[i + 1]); if (x === lx && y === ly) continue; rel.push(x - lx, y - ly); lx = x; ly = y; }
    d += rel.length ? `l${join(rel)}` : 'l0 0';
    cx = lx; cy = ly;
  }
  return d;
}
