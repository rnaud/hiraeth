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
//   mapBounds(points, o)        → { x0, z0, w, h } the rectangle of world the map shows, `o.aspect` wide (pure)
//   mapAspect(w, h)             → the page's box (px) as a map's aspect, in steps (issue #272) (pure)
//   zoomBounds(b, at, k)        → a rectangle k of b's size round `at`, kept inside b (pure)
//   toMap(b, x, z)              → [u, v] in 0..1 across and down (north up: −z)
//   compass(dx, dz)             → 'north', 'north-east', … (pure)
//   facing(dx, dz)              → degrees clockwise from north, for a mark's arrow (pure)
//   new HeightGrid(b, n, sample) → .step(ms) fills it a slice at a time (sample(x, z) → { h, water }); .done
//                                 (n: rays across and down, or [across, down] for a map wider than tall)
//   drawTerrain(ctx, grid, size)  ink and paper (a canvas 2D context; size: the short side, px)
//   new WorldMap({ sample, size }) → .view(bounds) → { canvas, done, progress }; .pump(ms) (while the menu is open)
//   new MapView()                 the Map panel's view (issue #244): a cursor the left stick moves, zoomed in and out
//                                 round it, the window panned to keep it in sight; .pick(marks) the mark under it (pure)
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
  size: 640,        // px: the drawn map's short side (its long one as much longer as the map is)
  budget: 6,        // ms a frame for the rays
  keep: 6,          // parts of the map drawn sharper for a zoom, kept besides the whole
  // the map's shape (issue #272: "it leaves wide empty margins in the page"): as wide as the page's box for it, from
  // a tall phone's to a wide handheld's, in steps of a tenth (a box a little off is letterboxed, never drawn again)
  aspects: { min: 0.6, max: 2.4, step: 0.1 },
};

/** The aspect (width / height) of a map for a box `w` × `h` px: inside MAP.aspects, rounded to its step; 1 without a box. */
export function mapAspect(w, h, { min, max, step } = MAP.aspects) {
  if (!(w > 0 && h > 0)) return 1;
  return +(Math.round(Math.min(max, Math.max(min, w / h)) / step) * step).toFixed(2);
}

/**
 * The rectangle of the world a map shows, `aspect` times as wide as it is tall (1: a square): round `points`
 * ([{ x, z }], the places that matter: the landing, the ship, the temples, the people, the boxes, the traveller),
 * padded, its short side at least minSpan and at most maxSpan, inside the world's `limit` (m from the middle) where it
 * fits in it. A wider map shows more of the world to the sides of the places (issue #272), never less round them.
 */
export function mapBounds(points = [], { limit = Infinity, pad = MAP.pad, minSpan = MAP.minSpan, maxSpan = MAP.maxSpan, aspect = 1 } = {}) {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1, wide = Math.max(1, a), tall = Math.max(1, 1 / a);
  const ps = points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.z));
  if (!ps.length) return { x0: -(minSpan * wide) / 2, z0: -(minSpan * tall) / 2, w: minSpan * wide, h: minSpan * tall };
  let x0 = Math.min(...ps.map((p) => p.x)), x1 = Math.max(...ps.map((p) => p.x));
  let z0 = Math.min(...ps.map((p) => p.z)), z1 = Math.max(...ps.map((p) => p.z));
  // (the short side: enough for the places across and down at this shape)
  const need = Math.max((x1 - x0) / wide, (z1 - z0) / tall) * (1 + 2 * pad);
  const short = Math.min(maxSpan, Math.max(minSpan, need)), w = short * wide, h = short * tall;
  let cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // (inside the world's edge, on each side it fits in)
  if (Number.isFinite(limit) && w < 2 * limit) cx = Math.min(limit - w / 2, Math.max(-limit + w / 2, cx));
  if (Number.isFinite(limit) && h < 2 * limit) cz = Math.min(limit - h / 2, Math.max(-limit + h / 2, cz));
  return { x0: cx - w / 2, z0: cz - h / 2, w, h };
}

/** A rectangle `k` of `b`'s size round `at` ({ x, z }), moved to lie inside `b`. */
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
    const [nx, ny] = Array.isArray(n) ? n : [n, n];
    Object.assign(this, { bounds, n: nx, nx, ny, sample });
    this.h = new Float32Array(nx * ny).fill(-Infinity);
    this.water = new Float32Array(nx * ny).fill(NaN);
    this.next = 0;
  }
  get done() { return this.next >= this.nx * this.ny; }
  get progress() { return this.next / (this.nx * this.ny); }
  /** Rays for `ms` milliseconds at most (`now`: the clock); true once the grid is full. */
  step(ms = MAP.budget, now = () => (globalThis.performance?.now?.() ?? Date.now())) {
    const { nx, ny, bounds: b } = this, end = now() + ms;
    while (this.next < nx * ny) {
      const k = this.next++, i = k % nx, j = (k / nx) | 0;
      const s = this.sample(b.x0 + ((i + 0.5) / nx) * b.w, b.z0 + ((j + 0.5) / ny) * b.h) ?? {};
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

/** The canvas a grid is drawn on, `size` px its short side: [width, height]. */
export const mapPixels = (grid, size = MAP.size) => {
  const nx = grid.nx ?? grid.n, ny = grid.ny ?? grid.n;
  return nx >= ny ? [Math.round((size * nx) / ny), size] : [size, Math.round((size * ny) / nx)];
};

/**
 * Draw the grid as a printed map on `ctx` (`size` px its short side: mapPixels): the bands, the shade, the water, the
 * void, the contours, the steep edges, the frame. Pure over a canvas-like context (tests use a recording one).
 */
export function drawTerrain(ctx, grid, size = MAP.size) {
  const { h, water } = grid, nx = grid.nx ?? grid.n, ny = grid.ny ?? grid.n, cell = grid.bounds.w / nx;
  const [W, H] = mapPixels(grid, size), px = W / nx;
  const r = grid.range() ?? { lo: 0, hi: 1 }, span = Math.max(1, r.hi - r.lo);
  const at = (i, j) => h[Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
  ctx.fillStyle = `rgb(${PAPER.join(',')})`;
  ctx.fillRect(0, 0, W, H);
  // the ground, a cell at a time: its height's band, shaded from the north-west in four steps (as the game's ink is);
  // drawn at the grid's size and spread over the map smoothed where the page can (an OffscreenCanvas), else cell by cell
  const small = typeof OffscreenCanvas !== 'undefined' && ctx.drawImage ? new OffscreenCanvas(nx, ny) : null;
  const sctx = small?.getContext('2d') ?? null, img = sctx ? sctx.createImageData(nx, ny) : null;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, v = h[k];
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
    ctx.drawImage(small, 0, 0, W, H);
  }
  // the void: nothing below (an island's edge, the sky): dotted paper
  ctx.fillStyle = 'rgba(43,33,31,0.22)';
  for (let j = 0; j < ny; j += 2) for (let i = (j / 2) % 2; i < nx; i += 3) if (!Number.isFinite(h[j * nx + i])) ctx.fillRect(i * px + px / 2, j * px + px / 2, 1.4, 1.4);
  // the contours (marching squares on the cells' middles), every fifth darker
  const step = contourStep(span);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let lv = Math.ceil(r.lo / step) * step, idx = Math.ceil(r.lo / step); lv <= r.hi; lv += step, idx++) {
    ctx.beginPath();
    ctx.strokeStyle = idx % 5 === 0 ? 'rgba(43,33,31,0.5)' : 'rgba(43,33,31,0.2)';
    ctx.lineWidth = idx % 5 === 0 ? 1.2 : 0.8;
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) contourCell(ctx, at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1), lv, (i + 0.5) * px, (j + 0.5) * px, px);
    ctx.stroke();
  }
  // the pen's lines, traced round (marching squares, so they run smooth): the steep places (a cliff, a wall, a
  // dome's or a roof's edge), the shore of the void (an island's edge), the water's edge
  const steep = Math.max(1.6, cell * 1.4);
  const relief = new Float32Array(nx * ny), solid = new Float32Array(nx * ny), wet = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, v = h[k];
    solid[k] = Number.isFinite(v) ? 1 : 0;
    wet[k] = Number.isFinite(water[k]) ? 1 : 0;
    if (!solid[k]) continue;
    let m = 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = at(i + di, j + dj); if (Number.isFinite(u)) m = Math.max(m, Math.abs(u - v)); }
    relief[k] = m >= steep ? 1 : 0;
  }
  const trace = (f, style, width) => {
    const val = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny ? 0 : f[j * nx + i]);
    ctx.beginPath(); ctx.strokeStyle = style; ctx.lineWidth = width;
    for (let j = -1; j < ny; j++) for (let i = -1; i < nx; i++) contourCell(ctx, val(i, j), val(i + 1, j), val(i + 1, j + 1), val(i, j + 1), 0.5, (i + 0.5) * px, (j + 0.5) * px, px);
    ctx.stroke();
  };
  trace(relief, INK, Math.max(1, px * 0.3));
  trace(solid, INK, Math.max(1.6, px * 0.45));
  trace(wet, 'rgba(31,79,96,0.8)', 1.1);
  // the frame
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  ctx.lineWidth = 1; ctx.strokeRect(7.5, 7.5, W - 15, H - 15);
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
  key(b) { return `${b.x0.toFixed(1)},${b.z0.toFixed(1)},${b.w.toFixed(1)},${b.h.toFixed(1)}`; }
  /** The map of `b` (`cells` rays across its short side): { canvas, done, progress }. Asking makes it the one being filled. */
  view(b, cells = MAP.cells) {
    const k = this.key(b), a = b.w / b.h;
    const m = this.maps.get(k) ?? { grid: new HeightGrid(b, [Math.round(cells * Math.max(1, a)), Math.round(cells * Math.max(1, 1 / a))], this.sample), canvas: null, drawn: false };
    // (the last few looked at, a canvas each: the whole map is asked for at every look, so it stays)
    this.maps.delete(k); this.maps.set(k, m);
    while (this.maps.size > MAP.keep + 1) this.maps.delete(this.maps.keys().next().value);
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
      [m.canvas.width, m.canvas.height] = mapPixels(m.grid, this.size);
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
 * `goal` { x, z, label }, `quests` [{ id, x, z, title, label }] (the other quests under way, at their steps), `temples`
 * [{ id, x, z, name }], `people` [{ id, x, z, name }], `boxes` [{ id, x, z, name }]
 * (opened ones only), all in world metres; `bounds` the map shown. Each mark: { id, kind, name, sub (how far and which
 * way from you), u, v (0..1 on the map), deg (the traveller's), on (inside the map) }. The traveller first, then the
 * way on, the other quests, the ship and the temples, then the people and the boxes, nearest first.
 */
export function mapMarks({ you = null, ship = null, goal = null, quests = [], givers = [], temples = [], people = [], boxes = [], bounds }) {
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
  // (the people with a quest for you, not met yet: the ship hears the light's pulse on them, issue #273; one the way on
  // points at is the way on, drawn as a giver: its gold ring, and why the ship knows them)
  const heard = 'the ship heard the light on them';
  const atGoal = goal && givers.find((p) => Math.hypot(p.x - goal.x, p.z - goal.z) < 2);
  if (goal) rest.push(atGoal ? mark('goal', 'giver', goal, goal.label || atGoal.label || 'The way on', `the way on · ${heard}`) : mark('goal', 'goal', goal, goal.label || 'The way on', 'the way on'));
  for (const p of givers) if (p !== atGoal) rest.push(mark(`giver.${p.id}`, 'giver', p, p.label || p.name || 'Someone with a word for you', heard));
  // (the other quests under way, each at its step: issue #244; one at the way on's own place is the way on)
  for (const q of quests) {
    if (goal && Math.hypot(q.x - goal.x, q.z - goal.z) < 2) continue;
    rest.push(mark(`quest.${q.id}`, 'quest', q, q.title || q.label || 'A quest', q.label || 'a quest'));
  }
  if (ship) rest.push(mark('ship', 'ship', ship, 'Your ship', 'the ship'));
  temples.forEach((t, i) => rest.push(mark(`temple.${t.id ?? i}`, 'temple', t, t.name || 'The makers’ temple', 'a makers’ temple')));
  people.forEach((p) => rest.push(mark(`person.${p.id}`, 'person', p, p.name, 'met')));
  boxes.forEach((b) => rest.push(mark(`box.${b.id}`, 'box', b, b.name || 'A makers’ box', 'a box you opened')));
  const rank = { goal: 0, giver: 1, quest: 1, ship: 2, temple: 3, person: 4, box: 5 };
  rest.sort((a, b) => rank[a.kind] - rank[b.kind] || a.d - b.d);
  return [...out, ...rest];
}

/** The scale bar for a map `w` m across: a round length and its share of the width. */
export function scaleBar(w, want = 0.22) {
  const m = contourStep(w * want, 1);
  return { m, frac: m / w, label: metres(m) };
}

// ------------------------------------------------------------------ the view (issue #244)
// "On the map menu using the left stick should move around the map. There should be no list under it. I should be
// able to zoom in and out. ... Hovering over an item tells me what it is." The map is the whole sheet; a cursor (a small
// ring) moves over it with the left stick (or the D-pad, the arrows, the mouse), the view zooms in and out round it
// (the triggers, the mouse wheel, − and +, A / × in a step) and pans to keep it in sight; the mark under the cursor is
// named beside it. All in the map's own units, 0..1 across and down (toMap). The map may be wider than it is tall
// (issue #272: `aspect`, its width over its height): a move, the pick's reach and the view's margin are measured
// in the view's width, the same on the sheet across as down.

export const VIEW = {
  maxZoom: 6,       // the closest: a sixth of the whole map's width
  pan: 0.6,         // the cursor at full tilt: this much of the view's width a second
  zoomRate: 1.9,    // a trigger held all the way: e-folds of zoom a second
  wheel: 1.25,      // one notch of the wheel (or a press of − / +)
  step: 0.07,       // a press of the D-pad or an arrow: this much of the view's width
  edge: 0.14,       // the view pans once the cursor is this close to its edge (of its width)
  pick: 0.05,       // a mark this near the cursor (of the view's width; of its height on a wide map) is the one under it
};

export class MapView {
  constructor() { this.aspect = 1; this.reset(); }
  /** The whole map, the cursor on `at` ([u, v]: the traveller, else the middle); `aspect` the map's width over its height. */
  reset(at = null, aspect = this.aspect) {
    this.aspect = aspect > 0 ? aspect : 1;
    this.z = 1; this.u0 = 0; this.v0 = 0;
    this.u = at?.[0] ?? 0.5; this.v = at?.[1] ?? 0.5;
    this.clamp();
    return this;
  }
  /** The view's side, in map units. */
  get span() { return 1 / this.z; }
  get zoomed() { return this.z > 1.001; }
  /** Everything back inside: the zoom in its bounds, the cursor on the map, the window following the cursor (`follow`), inside the map. */
  clamp(follow = true) {
    const c = (x, a, b) => Math.min(b, Math.max(a, x));
    this.z = c(this.z, 1, VIEW.maxZoom);
    this.u = c(this.u, 0, 1); this.v = c(this.v, 0, 1);
    // (the margin as wide on the sheet down as across, never more than a third of the view's height)
    const s = this.span, m = s * VIEW.edge, mv = Math.min(s * 0.3, m * this.aspect);
    // (the window keeps the cursor in sight, then stays inside the map)
    if (follow) {
      if (this.u < this.u0 + m) this.u0 = this.u - m; else if (this.u > this.u0 + s - m) this.u0 = this.u - s + m;
      if (this.v < this.v0 + mv) this.v0 = this.v - mv; else if (this.v > this.v0 + s - mv) this.v0 = this.v - s + mv;
    }
    this.u0 = c(this.u0, 0, 1 - s); this.v0 = c(this.v0, 0, 1 - s);
    if (!follow) { this.u = c(this.u, this.u0, this.u0 + s); this.v = c(this.v, this.v0, this.v0 + s); }
    return this;
  }
  /** The cursor moved by (du, dv) of the view's width (down as far on the sheet as across). */
  move(du, dv) { this.u += du * this.span; this.v += dv * this.span * this.aspect; return this.clamp(); }
  /** The left stick (x, y in −1..1, down positive) for `dt` seconds. */
  stick(x, y, dt) { return this.move(x * VIEW.pan * dt, y * VIEW.pan * dt); }
  /** Zoom by `k` (more than 1: in) round the cursor (or `at` [u, v]: the mouse), which stays where it is on the sheet. */
  zoomBy(k, at = null) {
    const [au, av] = at ?? [this.u, this.v];
    const [sx, sy] = this.toSheet(au, av);
    this.z = Math.min(VIEW.maxZoom, Math.max(1, this.z * k));
    this.u0 = au - sx * this.span; this.v0 = av - sy * this.span;
    if (at) { this.u = au; this.v = av; }
    return this.clamp(!at);   // (round the mouse: the map holds still under it)
  }
  /** Where (u, v) of the map lies on the sheet, 0..1 across and down (outside: off the view). */
  toSheet(u, v) { return [(u - this.u0) * this.z, (v - this.v0) * this.z]; }
  /** And back: a point of the sheet (0..1) on the map. */
  fromSheet(sx, sy) { return [this.u0 + sx * this.span, this.v0 + sy * this.span]; }
  /** The cursor on a point of the sheet (the mouse, a finger): the view stays (it would slide away under the mouse). */
  point(sx, sy) {
    const c = (x) => Math.min(1, Math.max(0, x));
    [this.u, this.v] = this.fromSheet(c(sx), c(sy));
    return this;
  }
  /** Dragged by (dx, dy) of the sheet: the map moves with the finger (the cursor with it). */
  drag(dx, dy) {
    const s = this.span;
    this.u0 = Math.min(1 - s, Math.max(0, this.u0 - dx * s)); this.v0 = Math.min(1 - s, Math.max(0, this.v0 - dy * s));
    this.u = Math.min(this.u0 + s, Math.max(this.u0, this.u - dx * s)); this.v = Math.min(this.v0 + s, Math.max(this.v0, this.v - dy * s));
    return this;
  }
  /** The mark under the cursor (on the map, the nearest within VIEW.pick of the view's width, of its height on a wide map; the traveller last), or null. */
  pick(marks = []) {
    let best = null, bd = VIEW.pick * this.span * Math.min(1, 1 / this.aspect);   // (of the short side on a wide map: as near on the sheet as on a square one)
    for (const m of marks) {
      if (!m.on) continue;
      const d = Math.hypot(m.u - this.u, (m.v - this.v) / this.aspect) * (m.kind === 'you' ? 1.6 : 1);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }
  /** The scale bar for a whole map `w` m across, at this zoom (on a wide map, as long as on a square one of its height, nearly). */
  scale(w) { return scaleBar(w / this.z, 0.22 * Math.min(1, 1.4 / this.aspect)); }
  /**
   * The part of the map worth drawing again sharper for this view (zoomed in twice or more; else null): a square half
   * as wide again as the view round it, its corner on a grid of a quarter view, so a small pan keeps the same one.
   */
  detailWindow() {
    if (this.z < 2) return null;
    const v = this.span, s = Math.min(1, v * 1.5), g = v / 4;
    const snap = (a) => Math.min(1 - s, Math.max(0, Math.round((a + v / 2 - s / 2) / g) * g));
    return { u0: snap(this.u0), v0: snap(this.v0), s };
  }
}
