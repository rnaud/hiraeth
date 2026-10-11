// The galactic map's layout as a system (issue #129: "it makes no sense to find the next planet if they
// are all on a grid"): one star, the worlds on their orbits round it, the route reading outward.
//
//  - The star sits at the chart's near edge (the left; the top on a phone held upright), cut by it, the way a
//    poster of a solar system draws its sun. Home is on the innermost orbit, where the route begins.
//  - Each world on the route has an orbit of its own, further out the further along the route it is: the
//    desert next to home, the Signal Market on the outermost. Distance on the chart is how far out you are.
//  - Moons go round their worlds where the lore says so (MOON_OF): the Moon Foundry round the Buried Machine
//    (Dun and Wen "come up from the domes" to see it), the City Floating in Space round the Signal Market's
//    great pale planet (its cables catch the planet's hum, which carries the market's broadcast). A moon has a
//    small orbit of its own round its world, and a smaller disc.
//  - The detours (names.js CHARTED_SIDE) lie on a belt past the market; the Lantern beyond the chart's
//    edge ("past the Signal Market, off every chart").
//  - Each body sits on its orbit's arc, at a height picked so that no two footprints (disc, name, tag) meet,
//    nor the star: a body tries the heights round the gentle wave the route makes, nearest first. If they cannot
//    all fit, everything is drawn a little smaller and laid out again.
//
// Pure: the tests use it directly (tests/starmap-system.test.js).

/** world id → the world it goes round. */
export const MOON_OF = { moonfoundry: 'buried', spacecity: 'bazaar' };
/** A moon's disc, against a world's. */
export const MOON_SCALE = 0.72;

const HEADER = 62;   // the title and the count, top left of the field
const PAD = 6;
const GAP = 3;

/** A world's footprint on the chart at scale s: the disc, then two lines of name and a line of tag under it. */
// (no narrower than 70 px: the names stay readable on a small phone held sideways)
export function worldBox(s = 1) {
  const disc = Math.round(58 * s), font = Math.max(9.5, 11.5 * s), line = font * 1.25;
  return { disc, font, w: Math.max(70, Math.round(108 * s)), h: disc + 10 + 2 * line + line * 0.95 };
}

/** The footprint rectangle of a world whose disc centre is (x, y). */
export function boxRect(x, y, b) {
  return { x0: x - b.w / 2, x1: x + b.w / 2, y0: y - b.disc / 2, y1: y - b.disc / 2 + b.h };
}

const hits = (a, b, m = GAP) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;

/** An entry as the layout needs it: { id, side, finale } (a bare id is a world on the route; 'lantern' the finale). */
const norm = (e) => (typeof e === 'string' ? { id: e, side: false, finale: e === 'lantern' } : { id: e.id, side: !!e.side && !e.finale, finale: !!e.finale });

/**
 * Where everything goes on a field of W x H px.
 * @param entries the chart's worlds but home, in the map's order (the route, the detours, the Lantern): ids or { id, side, finale }
 * @returns { kind: 'system', scale, portrait, box, homeBox, moonBox, pts (by entry index: the disc centres), home,
 *   star { x, y, r }, orbits [{ r, ids }] (round the star), moons [{ id, of, x, y, r }] (a moon's own orbit round
 *   its world), edge (the chart's edge, round the star, between the market's orbit and the Lantern), ring (0..: each entry's orbit, -1 a moon) }
 */
export function chartLayout(entries, W, H) {
  const list = (Array.isArray(entries) ? entries : []).map(norm);
  const tryAt = (s, tight) => { try { return attempt(list, W, H, s, tight); } catch (e) { if (e === NO_ROOM) return null; throw e; } };
  // (spread out down to 0.6 of full size first: packed, the worlds fall into rows)
  for (const [tight, low] of [[false, 0.6], [true, 0.45]]) for (let s = 1; s >= low - 1e-6; s -= 0.05) {
    const b = worldBox(s);
    if ((list.length + 1) * (b.w + GAP) * (b.h + GAP) > W * (H - HEADER) * 0.9) continue;   // (no hope of room at this size)
    const L = tryAt(s, tight);
    if (L) return L;
  }
  return attempt(list, W, H, 0.45, true, true);
}
const NO_ROOM = Symbol('no room');

function attempt(list, W, H, s, tight, force = false) {
  const portrait = H - HEADER > W * 1.05;
  const b = worldBox(s), hb = worldBox(s * 0.8), mb = worldBox(s * MOON_SCALE);
  // the field in (u, v): u outward from the star, v across. Landscape: u = x, v = y; upright: u = y, v = x.
  const U0 = portrait ? HEADER : PAD, U1 = portrait ? H - PAD : W - PAD;
  const V0 = portrait ? PAD : HEADER, V1 = portrait ? W - PAD : H - PAD;
  const toXY = (u, v) => (portrait ? [v, u] : [u, v]);
  // how far a footprint reaches from its disc centre along u: before it, after it
  const reach = (bx) => (portrait ? [bx.disc / 2, bx.h - bx.disc / 2] : [bx.w / 2, bx.w / 2]);
  const vc = (V0 + V1) / 2, span = (V1 - V0) / 2;
  const starR = Math.max(16, Math.min(44, (V1 - V0) * 0.12));
  const su = U0 + starR * 0.25, sv = vc;   // (a sliver of it past the edge)
  const [sx, sy] = toXY(su, sv);
  const star = { x: sx, y: sy, r: starR };
  const starRect = { x0: sx - starR, x1: sx + starR, y0: sy - starR, y1: sy + starR };

  // the orbits: home, then each world of the route that is not a moon, then a belt for the detours, then the Lantern past the edge
  const route = list.filter((e) => !e.side && !e.finale);
  const isMoon = (e) => !!MOON_OF[e.id] && route.some((p) => p.id === MOON_OF[e.id]);
  const parents = route.filter((e) => !isMoon(e));
  const sides = list.filter((e) => e.side), fin = list.filter((e) => e.finale);
  const cols = 1 + parents.length + (sides.length ? 1 : 0) + 1;   // (the Lantern's place is kept whether it is charted or not)
  const r0 = starR * 1.25 + reach(hb)[0] + GAP;
  const rN = U1 - su - Math.max(reach(b)[1], 4);
  const step = (rN - r0) / Math.max(1, cols - 1);
  const R = (c) => r0 + step * c;

  const placed = [], pts = new Array(list.length).fill(null), ring = new Array(list.length).fill(-1), moons = [], orbits = [];
  const fits = (rect) => rect.x0 >= 0 && rect.x1 <= W && rect.y0 >= HEADER - 4 && rect.y1 <= H && !hits(rect, starRect, 2) && placed.every((p) => !hits(rect, p));
  /** The point on the orbit of radius r at cross-offset dv from the star's line (null where the orbit doesn't reach). */
  const onOrbit = (r, dv) => (Math.abs(dv) < r * 0.94 ? toXY(su + Math.sqrt(r * r - dv * dv), sv + dv) : null);
  const fine = W * H < 200000, HV = fine ? 20 : 14;   // (a small chart: tried more finely)
  let nth = 0;
  /**
   * A body on an orbit near radius `want` (no nearer the star than `lo`), at a height near `wantV`: every orbit
   * and height tried, the cheapest that fits taken. Returns { p, r } or null. Spread out (`tight` false), the orbit
   * nearest its even share of the field counts most; packed (`tight`), the nearest the star that fits. Each body tries
   * heights offset a little from the last one's (nth): no rows.
   */
  const onRing = (bx, want, lo, wantV, hi = rN) => {
    const ph = ((nth++ * 0.618) % 1) - 0.5;
    const cands = [];
    for (let r = Math.max(lo, r0 * 0.6); r <= hi + 1e-6; r += fine ? 3 : 4) for (let k = -HV; k <= HV; k++) {
      const dv = ((k + ph) / HV) * span, p = onOrbit(r, dv);
      if (p) cands.push({ p, r, cost: tight ? (r - lo) / Math.max(step, 1) + Math.abs(sv + dv - wantV) / span * 0.4
        : Math.abs(r - want) / Math.max(step, 1) + Math.abs(sv + dv - wantV) / span * 1.6 });
    }
    cands.sort((a, c) => a.cost - c.cost);
    for (const q of cands) { const rect = boxRect(q.p[0], q.p[1], bx); if (fits(rect)) { placed.push(rect); return q; } }
    return null;
  };
  const fail = () => { if (!force) throw NO_ROOM; };   // (one that doesn't fit: give up on this try at once)
  const place = (i, q, fallback, c) => { if (!q) fail(); pts[i] = q?.p ?? fallback; ring[i] = c; return q?.r ?? R(c); };
  // home, on the innermost orbit, level with the star
  const hq = onRing(hb, R(0), 0, vc, R(0) + step);
  if (!hq) fail();
  const home = hq?.p ?? toXY(su + R(0), vc);
  orbits.push({ r: hq?.r ?? R(0), ids: ['home'] });
  // the route outward, a gentle wave either side of the star's line (wider further out), never nearer the star than the one before
  let prev = hq?.r ?? R(0), c = 0;
  for (const e of parents) {
    c++;
    const i = list.indexOf(e);
    // (each at its own phase round its orbit, as planets are: spread by the golden ratio, never a zigzag or a row)
    const phase = (((c * 0.618034 + 0.29) % 1) * 2 - 1) * 0.9;
    const wantV = vc + span * Math.sin(phase * Math.PI / 2) * Math.min(0.85, 0.35 + c * 0.07);
    const r = place(i, onRing(b, R(c), prev + 4, wantV), toXY(su + R(c), vc), c);
    prev = r;
    orbits.push({ r, ids: [e.id] });
    // its moons, on a small orbit of their own round it: as close as they fit
    for (const m of route.filter((x) => isMoon(x) && MOON_OF[x.id] === e.id)) {
      const mi = list.indexOf(m), [px, py] = pts[i];
      const away = portrait ? (px >= sx ? 0 : Math.PI) : (py >= sy ? Math.PI / 2 : -Math.PI / 2);
      const cands = [];
      for (let d = b.disc * 0.9; d <= 4 * Math.max(b.w, b.h); d += 2) for (let a = 0; a < 24; a++) {
        const t = away + (a % 2 ? -1 : 1) * Math.ceil(a / 2) * (Math.PI / 12);
        cands.push({ p: [px + Math.cos(t) * d, py + Math.sin(t) * d], cost: d + Math.ceil(a / 2) * 3 });
      }
      cands.sort((a2, c2) => a2.cost - c2.cost);
      let got = null;
      for (const q of cands) { const rect = boxRect(q.p[0], q.p[1], mb); if (fits(rect)) { placed.push(rect); got = q; break; } }
      if (!got) fail();
      pts[mi] = got?.p ?? [px, py];
      ring[mi] = -1;
      moons.push({ id: m.id, of: e.id, x: px, y: py, r: Math.hypot(pts[mi][0] - px, pts[mi][1] - py) });
    }
  }
  // the detours: a belt past the market
  if (sides.length) {
    c++;
    let lo = prev + 4;
    const rs = [];
    sides.forEach((e, k) => {
      const r = place(list.indexOf(e), onRing(b, R(c), lo, vc + (k % 2 ? 1 : -1) * span * 0.4), toXY(su + R(c), vc), c);
      rs.push(r);
    });
    prev = Math.max(prev, ...rs);
    orbits.push({ r: R(c), ids: sides.map((e) => e.id), belt: true });
  }
  // the Lantern: past the chart's edge, off every orbit
  c = cols - 1;
  const edge = Math.min(rN, prev + Math.max(6, (R(c) - prev) / 2));
  for (const e of fin) place(list.indexOf(e), onRing(b, R(c), edge + 2, vc + span * 0.35), toXY(su + R(c), vc), c);
  return { kind: 'system', scale: s, portrait, box: b, homeBox: hb, moonBox: mb, pts, home, star, orbits, moons, edge, ring, centre: [sx, sy] };
}

/** The distance of a point from the star (for the tests: further along the route is further out). */
export const fromStar = (L, [x, y]) => Math.hypot(x - L.star.x, y - L.star.y);

/**
 * The place the chart points at now (an entry's id), or null: the one thing to do next, marked on the map.
 *  - Ilen aboard: home (the last homecoming);
 *  - after the first homecoming, before the market has been heard: the Signal Market (its silent tower), charted or not;
 *  - the light's trace charted: the Lantern;
 *  - home on the map and not yet gone to: home;
 *  - else the first world along the route that is charted and not done (not the one you are in).
 * @param entries mapEntries() · o { flag, towerDue }
 */
export function nextDestination(entries = [], { flag = () => undefined, towerDue = false } = {}) {
  const by = (f) => entries.find((e) => f(e) && !e.current) ?? null;
  if (flag('finale.met') && !flag('ending.final')) return by((e) => e.home)?.id ?? null;
  if (towerDue) return by((e) => e.id === 'bazaar')?.id ?? null;
  const trace = by((e) => e.finale && e.signal === 'trace');
  if (trace) return trace.id;
  if (!flag('ending.done')) { const h = by((e) => e.home); if (h) return h.id; }
  return by((e) => e.known && !e.done && !e.side && !e.home && !e.finale)?.id ?? null;
}
