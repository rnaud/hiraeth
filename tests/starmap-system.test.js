// The galactic map as a system (issue #129): one star, each world on its own orbit, further out the further
// along the route, the moons round their worlds, nothing on a grid, and the next place to go marked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chartLayout, boxRect, fromStar, MOON_OF, nextDestination } from '../src/ship/system.js';
import { mapEntries } from '../src/ship/starmap.js';
import { ORDER } from '../src/levels/names.js';
import { LEVELS } from '../src/levels/index.js';

// the field beside the panel (or above it, upright): a desktop chart, a smaller window, a handheld, a phone
// (measured in Chrome: 1600 x 900 and 1920 x 1080 give 900 x 720, 844 x 390 gives 591 x 351, 390 x 844 gives 374 x 544)
const FIELDS = { desktop: [900, 720], laptop: [880, 560], handheld: [591, 351], phone: [374, 544], 'small phone, sideways': [400, 320] };
const CHART = [...ORDER, { id: 'lantern', finale: true, side: true }];
const boxOf = (L, id) => (MOON_OF[id] ? L.moonBox : L.box);

test('the galactic map: no two footprints overlap, nor the star, inside the field at every chart size', () => {
  for (const [name, [W, H]] of Object.entries(FIELDS)) {
    const L = chartLayout(CHART, W, H);
    const ids = CHART.map((e) => e.id ?? e);
    const rects = [...L.pts.map(([x, y], i) => boxRect(x, y, boxOf(L, ids[i]))), boxRect(L.home[0], L.home[1], L.homeBox)];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, `${name}: ${ids[i] ?? 'home'} and ${ids[j] ?? 'home'} overlap`);
    }
    const s = L.star, star = { x0: s.x - s.r, x1: s.x + s.r, y0: s.y - s.r, y1: s.y + s.r };
    for (const r of rects) {
      assert.ok(r.x0 >= 0 && r.x1 <= W && r.y0 >= 50 && r.y1 <= H + 0.5, `${name}: inside the field, under the title: ${JSON.stringify(r)}`);
      assert.ok(r.x1 <= star.x0 || star.x1 <= r.x0 || r.y1 <= star.y0 || star.y1 <= r.y0, `${name}: clear of the star`);
    }
    assert.ok(L.box.font >= 9.5, `${name}: names stay readable`);
  }
  assert.ok(chartLayout(CHART, ...FIELDS.desktop).scale >= 0.95, 'a desktop chart at full size');
  assert.ok(chartLayout(CHART, ...FIELDS.handheld).scale >= 0.6, `a handheld's at a readable size: ${chartLayout(CHART, ...FIELDS.handheld).scale}`);
});

test('the galactic map is a system: one star, the route outward orbit by orbit, home nearest, the moons round their worlds', () => {
  for (const [name, [W, H]] of Object.entries(FIELDS)) {
    const L = chartLayout(CHART, W, H);
    assert.equal(L.kind, 'system', name);
    // the star at the chart's near edge: the left, or the top on a phone held upright
    if (L.portrait) assert.ok(L.star.y < H * 0.25, `${name}: the star at the top`);
    else assert.ok(L.star.x < W * 0.15, `${name}: the star at the left`);
    // distance means something: every world on the route (but the moons) further out than the one before; home nearest
    const route = ORDER.filter((id) => !MOON_OF[id]);
    let last = fromStar(L, L.home);
    for (const id of route) {
      const d = fromStar(L, L.pts[ORDER.indexOf(id)]);
      assert.ok(d > last, `${name}: ${id} further out than the world before it (${d.toFixed(0)} > ${last.toFixed(0)})`);
      last = d;
    }
    // the Lantern past the chart's edge, past everything
    const lantern = fromStar(L, L.pts[CHART.length - 1]);
    assert.ok(lantern > L.edge && L.edge > fromStar(L, L.pts[ORDER.indexOf('bazaar')]), `${name}: the Lantern past the edge, the edge past the market`);
    // a moon close by its world, on a small orbit of its own, nearer to it than to any other world
    for (const [moon, of] of Object.entries(MOON_OF)) {
      const m = L.pts[ORDER.indexOf(moon)], p = L.pts[ORDER.indexOf(of)];
      const d = Math.hypot(m[0] - p[0], m[1] - p[1]);
      const o = L.moons.find((x) => x.id === moon);
      assert.ok(o && o.of === of && Math.abs(o.r - d) < 0.5, `${name}: ${moon} goes round ${of}`);
      for (const id of ORDER) if (id !== of && !MOON_OF[id]) {
        const q = L.pts[ORDER.indexOf(id)];
        assert.ok(Math.hypot(m[0] - q[0], m[1] - q[1]) >= d - 1, `${name}: ${moon} nearer ${of} than ${id}`);
      }
    }
    // every world on an orbit of its own (but the moons, which go round theirs)
    const rings = new Set(L.ring.filter((r) => r >= 0));
    assert.equal(rings.size, ORDER.length - Object.keys(MOON_OF).length + 1, `${name}: an orbit each, and the Lantern's place past the edge`);
  }
});

test('the galactic map has no world on a grid lattice', () => {
  for (const [name, [W, H]] of Object.entries(FIELDS)) {
    const L = chartLayout(CHART, W, H);
    const pts = [...L.pts, L.home];
    // no rows: the worlds take many heights (a grid's rows take a few); no columns: no two worlds share an x
    const ys = new Set(pts.map(([, y]) => Math.round(y / 4))), xs = new Set(pts.map(([x]) => Math.round(x / 4)));
    assert.ok(ys.size >= pts.length * 0.5 && xs.size >= pts.length * 0.8, `${name}: ${xs.size} columns and ${ys.size} rows for ${pts.length} places: a grid`);
    // no lattice: the steps between neighbours along the route are not all one of a couple of vectors
    const steps = new Set();
    for (let i = 1; i < ORDER.length; i++) {
      const a = L.pts[i - 1], b = L.pts[i];
      steps.add(`${Math.round((b[0] - a[0]) / 6)},${Math.round((b[1] - a[1]) / 6)}`);
    }
    assert.ok(steps.size >= ORDER.length - 3, `${name}: the route's steps repeat (${steps.size} different of ${ORDER.length - 1})`);
  }
});

// a save: n worlds done along the route, the current one, more flags
function entries(n, current, flags = {}, o = {}) {
  const f = { ...flags };
  for (const id of ORDER.slice(0, n)) f[`world.${id}.done`] = true;
  for (const id of ORDER) f[`map.found.${id}`] = true;
  const flag = (k) => f[k];
  return mapEntries({ order: ORDER, levels: LEVELS, flag, journal: { seen: (id) => ORDER.indexOf(id) < n }, current, ...o });
}
const nextOf = (list) => list.filter((e) => e.next).map((e) => e.id);

test('the galactic map marks the next place to go: the next world, home when it waits, the silent tower after it, the trace', () => {
  // early on: the first world charted and not done
  assert.deepEqual(nextOf(entries(2, 'arzach')), ['perdide'], 'the next world along the route');
  // six done, home on the map: home
  assert.deepEqual(nextOf(entries(6, 'incal', { 'calls.home': true }, { home: true })), ['home']);
  // after the first homecoming, the market not heard: the Signal Market (its silent tower), charted or not
  const after = entries(7, 'glassdunes', { 'calls.home': true, 'ending.done': true }, { home: true, tower: true });
  assert.deepEqual(nextOf(after), ['bazaar'], 'the silent tower is the next place');
  const market = after.find((e) => e.id === 'bazaar');
  assert.ok(market.tower && !market.known, 'the market carries the tower (and is still a faint dot, not charted yet)');
  // the light's trace charted: the Lantern
  const traced = entries(12, 'bazaar', { 'calls.home': true, 'ending.done': true, 'world.bazaar.done': true }, { home: true, finale: true, relay: { stage: 'trace', world: 'lantern' } });
  assert.deepEqual(nextOf(traced), ['lantern']);
  // Ilen aboard: home
  assert.deepEqual(nextOf(entries(12, 'lantern', { 'calls.home': true, 'ending.done': true, 'finale.met': true }, { home: true, finale: true })), ['home']);
  // never the world you are in, and only one at a time
  for (const list of [entries(3, 'perdide'), after, traced]) assert.ok(nextOf(list).length <= 1 && !list.some((e) => e.next && e.current));
  // the rule alone
  assert.equal(nextDestination([{ id: 'a', known: true, done: true }, { id: 'b', known: true }], {}), 'b');
  assert.equal(nextDestination([{ id: 'a', known: true, current: true }], {}), null, 'nothing left: nothing marked');
});
