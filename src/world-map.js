// The map of the world you are in (issue #205: "a proper map to the current level I can access from select
// button"): the Map panel of the game menu (View / Select, then RB / R1 from Quests; src/game-menu.js mapPanel).
// The ground drawn from above in the game's ink and paper: every world's collision is sampled straight down on a
// grid (Physics.groundAt: the heightfield and every collider, so a city's roofs, a temple's walls and a floating
// island all show), then drawn as a printed map: flat bands of colour by height, shaded from the north-west, contour
// lines, the steep edges inked, open water in the world's teal, and the void (where a ray finds nothing: the City
// Floating in Space, the sky stones) left as dotted paper. On it, as marks the menu draws: the traveller (his place
// and the way he faces), the ship, the way on (the scout's objective), the makers' temples, the people met here and
// the boxes opened. Never a fragment of the singing light, nor a box still closed (src/fragments.js: those are yours
// to find).
//
//   mapBounds(points, o)        → { x0, z0, w, h } the square of world the map shows (pure)
//   zoomBounds(b, at, k)        → a square k of b's size round `at`, kept inside b (pure)
//   toMap(b, x, z)              → [u, v] in 0..1 across and down (north up: −z)
//   compass(dx, dz)             → 'north', 'north-east', … (pure)
//   facing(dx, dz)              → degrees clockwise from north, for a mark's arrow (pure)
//   new HeightGrid(b, n, sample) → .step(ms) fills it a slice at a time (sample(x, z) → { h, water }); .done
//   drawTerrain(ctx, grid, size)  ink and paper (a canvas 2D context)
//   new WorldMap({ sample, size }) → .view(bounds) → { canvas, done, progress }; .pump(ms) (while the menu is open)
//
// The grid is drawn a few milliseconds a frame while the menu is open (main.js pausedFrame: worldMap.pump), so a
// handheld never stalls; 150 × 150 rays take about 30 ms on the Mac. Tests: tests/world-map.test.js.

export const MAP = {
  cells: 180,       // rays across (and down) the whole map
  zoomCells: 120,   // and across a zoomed one
  pad: 0.18,        // room round the places that frame it (of its size)
  minSpan: 160,     // m: the smallest the whole map shows
  maxSpan: 1600,    // m: the largest (a world's limit beyond that is empty desert)
  zoom: 0.34,       // a zoomed map shows this much of the whole one's width
  up: 70,           // m over the highest place the rays start from (a temple's or a dome's roof far overhead is left out)
  drop: 1400,       // m the rays look down
  size: 640,        // px: the drawn map's side
  budget: 6,        // ms a frame for the rays
};

/**
 * The square of the world a map shows: round `points` ([{ x, z }], the places that matter: the landing, the ship,
 * the temples, the people, the boxes, the traveller), padded, at least minSpan and at most maxSpan across, inside
 * the world's `limit` (m from the middle) when it has one.
 */
export function mapBounds(points = [], { limit = Infinity, pad = MAP.pad, minSpan = MAP.minSpan, maxSpan = MAP.maxSpan } = {}) {
  const ps = points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.z));
  if (!ps.length) return { x0: -minSpan / 2, z0: -minSpan / 2, w: minSpan, h: minSpan };
  let x0 = Math.min(...ps.map((p) => p.x)), x1 = Math.max(...ps.map((p) => p.x));
  let z0 = Math.min(...ps.map((p) => p.z)), z1 = Math.max(...ps.map((p) => p.z));
  const span = Math.min(maxSpan, Math.max(minSpan, (Math.max(x1 - x0, z1 - z0)) * (1 + 2 * pad)));
  let cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // (inside the world's edge, when the square fits in it)
  if (Number.isFinite(limit) && span < 2 * limit) {
    cx = Math.min(limit - span / 2, Math.max(-limit + span / 2, cx));
    cz = Math.min(limit - span / 2, Math.max(-limit + span / 2, cz));
  }
  return { x0: cx - span / 2, z0: cz - span / 2, w: span, h: span };
}

/** A square `k` of `b`'s width round `at` ({ x, z }), moved to lie inside `b`. */
export function zoomBounds(b, at, k = MAP.zoom) {
  const w = b.w * k, h = b.h * k;
  const x0 = Math.min(b.x0 + b.w - w, Math.max(b.x0, at.x - w / 2)), z0 = Math.min(b.z0 + b.h - h, Math.max(b.z0, at.z - h / 2));
  return { x0, z0, w, h };
}

/** Where (x, z) lies on the map of `b`: [across, down], 0..1 inside it (north, −z, at the top). */
export const toMap = (b, x, z) => [(x - b.x0) / b.w, (z - b.z0) / b.h];

/** Is (x, z) on the map of `b`? */
export const onMap = (b, x, z) => { const [u, v] = toMap(b, x, z); return u >= 0 && u <= 1 && v >= 0 && v <= 1; };

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
/** The way (dx, dz) points, in words (north is −z, east +x). */
export function compass(dx, dz) {
  if (!dx && !dz) return '';
  const a = (Math.atan2(dx, -dz) * 180) / Math.PI;   // (0 north, 90 east)
  return POINTS[((Math.round(a / 45) % 8) + 8) % 8];
}

/** Degrees clockwise from north for something facing (dx, dz): an arrow drawn pointing up, turned by this. */
export const facing = (dx, dz) => ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;

/** A distance in words: "12 m", "350 m", "1.2 km". */
export const metres = (d) => (d < 1000 ? `${Math.max(1, Math.round(d / (d < 100 ? 1 : 10)) * (d < 100 ? 1 : 10))} m` : `${(d / 1000).toFixed(1)} km`);

/**
 * The heights under a map, n × n, filled a slice at a time. `sample(x, z)` → { h (−Infinity: nothing below), water
 * (the open water's surface over it, or null) }. Cell (i, j) is the world at the middle of column i, row j.
 */
export class HeightGrid {
  constructor(bounds, n, sample) {
    Object.assign(this, { bounds, n, sample });
    this.h = new Float32Array(n * n).fill(-Infinity);
    this.water = new Float32Array(n * n).fill(NaN);
    this.next = 0;
  }
  get done() { return this.next >= this.n * this.n; }
  get progress() { return this.next / (this.n * this.n); }
  /** Rays for `ms` milliseconds at most (`now`: the clock); true once the grid is full. */
  step(ms = MAP.budget, now = () => (globalThis.performance?.now?.() ?? Date.now())) {
    const { n, bounds: b } = this, end = now() + ms;
    while (this.next < n * n) {
      const k = this.next++, i = k % n, j = (k / n) | 0;
      const s = this.sample(b.x0 + ((i + 0.5) / n) * b.w, b.z0 + ((j + 0.5) / n) * b.h) ?? {};
      this.h[k] = Number.isFinite(s.h) ? s.h : -Infinity;
      this.water[k] = Number.isFinite(s.water) && s.water > this.h[k] ? s.water : NaN;
      if ((k & 31) === 31 && now() > end) break;
    }
    return this.done;
  }
  /** The lowest and highest ground found (finite), or null. */
  range() {
    let lo = Infinity, hi = -Infinity;
    for (const v of this.h) if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    return lo <= hi ? { lo, hi } : null;
  }
}

/** A round step for the contour lines over `span` m: 1, 2, 5, 10, 20 … m, about `lines` of them. */
export function contourStep(span, lines = 12) {
  const raw = Math.max(0.5, span / lines), p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

// the printed map's inks (the game's: src/game-menu.css)
const INK = '#2b211f';
const PAPER = [246, 236, 211];
// the bands of colour by height, low to high (the desert's ochres to a pale crest)
const BANDS = [[214, 176, 118], [226, 195, 137], [236, 212, 158], [242, 226, 182], [248, 238, 210]];
const WATER = [127, 185, 181], DEEP = [84, 150, 155];

/**
 * Draw the grid as a printed map on `ctx` (`size` px square): the bands, the shade, the water, the void, the
 * contours, the steep edges, the frame. Pure over a canvas-like context (tests use a recording one).
 */
export function drawTerrain(ctx, grid, size = MAP.size) {
  const { n, h, water } = grid, cell = grid.bounds.w / n, px = size / n;
  const r = grid.range() ?? { lo: 0, hi: 1 }, span = Math.max(1, r.hi - r.lo);
  const at = (i, j) => h[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))];
  ctx.fillStyle = `rgb(${PAPER.join(',')})`;
  ctx.fillRect(0, 0, size, size);
  // the ground, a cell at a time: its height's band, shaded from the north-west in four steps (as the game's ink is);
  // drawn at the grid's size and spread over the map smoothed where the page can (an OffscreenCanvas), else cell by cell
  const small = typeof OffscreenCanvas !== 'undefined' && ctx.drawImage ? new OffscreenCanvas(n, n) : null;
  const sctx = small?.getContext('2d') ?? null, img = sctx ? sctx.createImageData(n, n) : null;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, v = h[k];
    if (!Number.isFinite(v)) continue;
    const w = water[k];
    let c;
    if (Number.isFinite(w)) c = w - v > 2.5 ? DEEP : WATER;
    else {
      const t = (v - r.lo) / span, band = BANDS[Math.min(BANDS.length - 1, Math.floor(t * BANDS.length))];
      // (the slope toward the light: the north-west, -x and -z, higher is in shade)
      const gx = (fin(at(i + 1, j), v) - fin(at(i - 1, j), v)) / (2 * cell), gz = (fin(at(i, j + 1), v) - fin(at(i, j - 1), v)) / (2 * cell);
      const lit = (0.7 * gx + 0.7 * gz + 1) / Math.sqrt(gx * gx + gz * gz + 1);
      const k3 = lit > 1.05 ? 1.06 : lit > 0.8 ? 1 : lit > 0.55 ? 0.88 : 0.76;
      c = band.map((x) => Math.min(255, Math.round(x * k3)));
    }
    if (img) { img.data.set([c[0], c[1], c[2], 255], k * 4); continue; }
    ctx.fillStyle = `rgb(${c.join(',')})`;
    ctx.fillRect(Math.floor(i * px), Math.floor(j * px), Math.ceil(px) + 1, Math.ceil(px) + 1);
  }
  if (img) {
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, size, size);
  }
  // the void: nothing below (an island's edge, the sky): dotted paper
  ctx.fillStyle = 'rgba(43,33,31,0.22)';
  for (let j = 0; j < n; j += 2) for (let i = (j / 2) % 2; i < n; i += 3) if (!Number.isFinite(h[j * n + i])) ctx.fillRect(i * px + px / 2, j * px + px / 2, 1.4, 1.4);
  // the contours (marching squares on the cells' middles), every fifth darker
  const step = contourStep(span);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let lv = Math.ceil(r.lo / step) * step, idx = Math.ceil(r.lo / step); lv <= r.hi; lv += step, idx++) {
    ctx.beginPath();
    ctx.strokeStyle = idx % 5 === 0 ? 'rgba(43,33,31,0.5)' : 'rgba(43,33,31,0.2)';
    ctx.lineWidth = idx % 5 === 0 ? 1.2 : 0.8;
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) contourCell(ctx, at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1), lv, (i + 0.5) * px, (j + 0.5) * px, px);
    ctx.stroke();
  }
  // the pen's lines, traced round (marching squares, so they run smooth): the steep places (a cliff, a wall, a
  // dome's or a roof's edge), the shore of the void (an island's edge), the water's edge
  const steep = Math.max(1.6, cell * 1.4);
  const relief = new Float32Array(n * n), solid = new Float32Array(n * n), wet = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, v = h[k];
    solid[k] = Number.isFinite(v) ? 1 : 0;
    wet[k] = Number.isFinite(water[k]) ? 1 : 0;
    if (!solid[k]) continue;
    let m = 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = at(i + di, j + dj); if (Number.isFinite(u)) m = Math.max(m, Math.abs(u - v)); }
    relief[k] = m >= steep ? 1 : 0;
  }
  const trace = (f, style, width) => {
    const val = (i, j) => (i < 0 || j < 0 || i >= n || j >= n ? 0 : f[j * n + i]);
    ctx.beginPath(); ctx.strokeStyle = style; ctx.lineWidth = width;
    for (let j = -1; j < n; j++) for (let i = -1; i < n; i++) contourCell(ctx, val(i, j), val(i + 1, j), val(i + 1, j + 1), val(i, j + 1), 0.5, (i + 0.5) * px, (j + 0.5) * px, px);
    ctx.stroke();
  };
  trace(relief, INK, Math.max(1, px * 0.3));
  trace(solid, INK, Math.max(1.6, px * 0.45));
  trace(wet, 'rgba(31,79,96,0.8)', 1.1);
  // the frame
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
  ctx.lineWidth = 1; ctx.strokeRect(7.5, 7.5, size - 15, size - 15);
  return { step, range: r };
}

const fin = (v, or) => (Number.isFinite(v) ? v : or);

/** One cell of marching squares at level `lv` (corners clockwise from the top left; centre (x, y), side s). */
function contourCell(ctx, a, b, c, d, lv, x, y, s) {
  if (![a, b, c, d].every(Number.isFinite)) return;
  const code = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
  if (code === 0 || code === 15) return;
  const t = (p, q) => (lv - p) / (q - p || 1e-9);
  const top = [x + t(a, b) * s, y], right = [x + s, y + t(b, c) * s], bottom = [x + t(d, c) * s, y + s], left = [x, y + t(a, d) * s];
  const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
  switch (code) {
    case 1: case 14: seg(left, bottom); break;
    case 2: case 13: seg(bottom, right); break;
    case 3: case 12: seg(left, right); break;
    case 4: case 11: seg(top, right); break;
    case 5: seg(left, top); seg(bottom, right); break;
    case 6: case 9: seg(top, bottom); break;
    case 7: case 8: seg(left, top); break;
    case 10: seg(left, bottom); seg(top, right); break;
    default: break;
  }
}

/**
 * The map of one world: its grids (the whole and each zoom asked for, kept for the session: the ground doesn't
 * move), drawn into canvases as they fill. `sample(x, z)` as HeightGrid's; `canvas()` makes a canvas (a page's).
 */
export class WorldMap {
  constructor({ sample, canvas = () => (typeof document !== 'undefined' ? document.createElement('canvas') : null), size = MAP.size } = {}) {
    Object.assign(this, { sample, makeCanvas: canvas, size });
    this.maps = new Map();   // key → { grid, canvas, drawn }
    this.want = null;
    this.onReady = null;
  }
  key(b) { return `${b.x0.toFixed(1)},${b.z0.toFixed(1)},${b.w.toFixed(1)}`; }
  /** The map of `b` (`cells` rays across): { canvas, done, progress }. Asking makes it the one being filled. */
  view(b, cells = MAP.cells) {
    const k = this.key(b);
    let m = this.maps.get(k);
    if (!m) { m = { grid: new HeightGrid(b, cells, this.sample), canvas: null, drawn: false }; this.maps.set(k, m); }
    this.want = m;
    return { canvas: m.drawn ? m.canvas : null, done: m.drawn, progress: m.grid.progress, bounds: b };
  }
  /** While the menu is open: fill the map being looked at, `ms` a frame; drawn (and onReady told) once full. */
  pump(ms = MAP.budget) {
    const m = this.want;
    if (!m || m.drawn) return false;
    if (!m.grid.step(ms)) return false;
    m.canvas = this.makeCanvas();
    if (m.canvas) {
      m.canvas.width = m.canvas.height = this.size;
      const ctx = m.canvas.getContext('2d');
      if (ctx) drawTerrain(ctx, m.grid, this.size);
    }
    m.drawn = true;
    this.onReady?.();
    return true;
  }
}

/**
 * The marks on a map and its legend's lines: `you` { x, z, dx, dz } (where he stands, the way he faces), `ship`,
 * `goal` { x, z, label }, `temples` [{ id, x, z, name }], `people` [{ id, x, z, name }], `boxes` [{ id, x, z, name }]
 * (opened ones only), all in world metres; `bounds` the map shown. Each mark: { id, kind, name, sub (how far and which
 * way from you), u, v (0..1 on the map), deg (the traveller's), on (inside the map) }. The traveller first, then the
 * way on, the ship and the temples, then the people and the boxes, nearest first.
 */
export function mapMarks({ you = null, ship = null, goal = null, temples = [], people = [], boxes = [], bounds }) {
  const far = (p) => (you ? Math.hypot(p.x - you.x, p.z - you.z) : 0);
  const sub = (p, what) => {
    if (!you) return what;
    const d = far(p);
    return [what, d < 4 ? 'here' : `${metres(d)} ${compass(p.x - you.x, p.z - you.z)}`].filter(Boolean).join(' · ');
  };
  const mark = (id, kind, p, name, what) => {
    const [u, v] = toMap(bounds, p.x, p.z);
    return { id, kind, name, sub: sub(p, what), u, v, on: u >= 0 && u <= 1 && v >= 0 && v <= 1, d: far(p) };
  };
  const out = [];
  if (you) {
    const way = compass(you.dx ?? 0, you.dz ?? 0);
    out.push({ ...mark('you', 'you', you, 'You', ''), sub: way ? `facing ${way}` : 'here', deg: facing(you.dx ?? 0, you.dz ?? 1) });
  }
  const rest = [];
  if (goal) rest.push(mark('goal', 'goal', goal, goal.label || 'The way on', 'the way on'));
  if (ship) rest.push(mark('ship', 'ship', ship, 'Your ship', 'the ship'));
  temples.forEach((t, i) => rest.push(mark(`temple.${t.id ?? i}`, 'temple', t, t.name || 'The makers’ temple', 'a makers’ temple')));
  people.forEach((p) => rest.push(mark(`person.${p.id}`, 'person', p, p.name, 'met')));
  boxes.forEach((b) => rest.push(mark(`box.${b.id}`, 'box', b, b.name || 'A makers’ box', 'a box you opened')));
  const rank = { goal: 0, ship: 1, temple: 2, person: 3, box: 4 };
  rest.sort((a, b) => rank[a.kind] - rank[b.kind] || a.d - b.d);
  return [...out, ...rest];
}

/** The scale bar for a map `w` m across: a round length and its share of the width. */
export function scaleBar(w, want = 0.22) {
  const m = contourStep(w * want, 1);
  return { m, frac: m / w, label: metres(m) };
}
