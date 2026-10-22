// Issue #264: the holo table's galactic map in the engines (engine/starmap.js, engine/menus.js 'starmap', BridgeMenu.StarMap.cs):
// the web's StarMap model without its page, its signature search played as there (a scanner moved over the chart, the
// world resolved when held over it, charted by the ship), the system, the way on and its NEXT, the relay's signal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EngineStarMap, chartBox } from '../engine/starmap.js';
import { chartDrawing, mapEntries } from '../src/ship/starmap.js';
import { ORDER } from '../src/levels/names.js';
import { LEVELS } from '../src/levels/index.js';
import { foundFlag } from '../src/story/signature-search.js';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const { EngineMenus } = await import('../engine/menus.js');

/** A StarMap's options (src/ship/ship.js attach) on a set of flags, the ship in `current`. */
function options(flags = {}, current = 'desert', more = {}) {
  const F = { 'ship.powered': true, ...flags }, found = [], travelled = [];
  const o = { order: ORDER, levels: LEVELS, current, side: [], journal: { seen: () => false, storyDone: () => false },
    flag: (k) => F[k], powered: () => !!F['ship.powered'], home: () => false, relay: null, finale: false, tower: false,
    onFound: (id) => { F[foundFlag(id)] = true; found.push(id); }, onTravel: (id) => travelled.push(id), sound: () => null, ...more };
  return { o, F, found, travelled };
}
/** Frames of `dt` with the stick pushed toward (x, y) on the field, until `until()` or n frames. */
function sweepTo(map, [x, y], n = 600, until = () => false) {
  for (let i = 0; i < n && !until(); i++) {
    const dx = x - map.scan[0], dy = y - map.scan[1], d = Math.hypot(dx, dy);
    map.update(1 / 60, d > 3 ? [dx / d, dy / d] : [0, 0]);
  }
}

test("the chart's box is the page's: a 900 x 648 field beside a 300 px side at 1280 x 720 (measured in Chrome)", () => {
  const B = chartBox(1280, 720);
  assert.deepEqual([B.fw, B.fh, B.side, B.w, B.h], [900, 648, 300, 1200, 648]);
  assert.equal(B.x, 38); assert.equal(B.y, 34);
  const R = chartBox(960, 720);   // (the Retroid's 4:3)
  assert.ok(R.fw > 600 && R.side >= 210 && R.side <= 300);
});

test('the engine map draws what the page draws: the same entries, the same system', () => {
  const { o } = options({ 'world.desert.done': true, 'world.arzach.done': true, 'world.perdide.done': true, 'world.edena.done': true, [foundFlag('underwater')]: true, [foundFlag('incal')]: true }, 'desert', { relay: () => ({ stage: 'far', world: 'bazaar' }) });
  const map = new EngineStarMap({ o });
  map.open();
  const v = map.view(), D = chartDrawing(mapEntries(o), 900, 648);
  assert.equal(v.kind, 'starmap');
  assert.equal(v.orbits.length, D.orbits.length);
  assert.deepEqual(v.worlds.map((w) => w.id), mapEntries(o).filter((e) => e.known).map((e) => e.id));
  // the way on: from the desert to the next world charted and not done, its NEXT, the pick as the map opens
  const next = v.worlds.find((w) => w.next);
  assert.equal(next?.id, 'underwater');
  assert.ok(v.wayon && v.wayon.head.length === 3, 'the gold line out to it, its arrowhead');
  assert.equal(v.panel.title, LEVELS.find((l) => l.id === 'underwater').title, 'opened on the place it points at');
  assert.equal(v.worlds.find((w) => w.id === 'desert').tag, 'you are here');
  assert.ok(!v.searching && !v.scanner && v.legend.search === false, 'nothing to find: no scanner');
  // the relay's signal: four worlds done, the market not charted (its ring and "a signal")
  assert.ok(v.relays.some((r) => r.tag === 'a signal'), JSON.stringify(v.relays));
  assert.match(v.sub, /a faint signal further along the route/);
});

test('the signature search: swept over, a world resolves, the ship charts it, and the map flies there', () => {
  const { o, F, found, travelled } = options({ 'world.desert.done': true });
  let closed = 0;
  const map = new EngineStarMap({ o, onClose: () => closed++ });
  map.open();
  let v = map.view();
  assert.deepEqual(map.targets.map((t) => t.id).sort(), ['arzach', 'perdide']);
  assert.ok(v.searching && v.scanner && v.meter, 'the scanner and the meter');
  assert.equal(v.regions.length, 2, 'an uncharted region round each');
  assert.deepEqual(v.worlds.map((w) => w.id), ['desert'], 'not named yet');
  assert.match(v.sub, /2 signatures to find/);
  assert.equal(v.legend.label, 'SIGNATURE SEARCH');
  // (the scanner starts clear of both, issue #204)
  for (const t of map.targets) assert.ok(Math.hypot(map.scan[0] - t.x, map.scan[1] - t.y) > 60);
  const t = map.targets.find((x) => x.id === 'arzach');
  // nearer, warmer: the meter's bars rise
  sweepTo(map, [t.x + 120, t.y], 600, () => Math.hypot(map.scan[0] - t.x - 120, map.scan[1] - t.y) < 4);
  const far = map.view().meter.bars;
  sweepTo(map, [t.x, t.y], 600, () => found.length > 0);
  assert.deepEqual(found, ['arzach'], 'held over it half a second: resolved');
  assert.ok(F[foundFlag('arzach')]);
  v = map.view();
  assert.ok(v.resolve?.id === 'arzach', 'the planet resolving where it was');
  assert.ok(far <= 5);
  for (let i = 0; i < 70; i++) map.update(1 / 60, null);
  v = map.view();
  assert.ok(!v.resolve);
  assert.deepEqual(v.worlds.map((w) => w.id).sort(), ['arzach', 'desert'], 'charted and named');
  assert.equal(map.entries[map.sel].id, 'arzach', 'picked');
  assert.match(v.sub, /a signature to find/);
  // A / × asks first; B / ○ says no; A / × again, then yes: the ship takes off for it
  map.action('confirm');
  assert.match(map.view().ask.title, /Travel to Vael\?/);
  map.action('back');
  assert.equal(map.view().ask, null);
  map.action('confirm'); map.navigate(1, 0); assert.equal(map.view().ask.on, 'no'); map.navigate(1, 0);
  map.action('confirm');
  assert.deepEqual(travelled, ['arzach']);
  assert.equal(closed, 1, 'closed as it flies');
});

test('W A S D move the scanner, the arrows choose a world, Esc closes; without power the map is dark', () => {
  const { o } = options({ 'world.desert.done': true });
  const map = new EngineStarMap({ o });
  map.open();
  const at = [...map.scan];
  assert.ok(map.key('KeyD'));
  for (let i = 0; i < 30; i++) map.update(1 / 60);
  map.keyUp('KeyD');
  assert.ok(map.scan[0] > at[0] + 50, 'moved right');
  const x = map.scan[0];
  map.update(1 / 60);
  assert.equal(map.scan[0], x, 'let go: still');
  assert.ok(map.key('Escape'));
  assert.ok(!map.isOpen);
  const dark = options({ 'world.desert.done': true, 'ship.powered': false });
  const d = new EngineStarMap({ o: dark.o });
  d.open();
  const v = d.view();
  assert.ok(v.locked && !v.searching && v.panel.off);
  d.action('confirm');
  assert.equal(d.view().ask, null, 'no travel without power');
});

test("the menus carry the map: its own view, the stick to the scanner while searching, B / ○ closes it", () => {
  const { o } = options({ 'world.desert.done': true });
  let resumed = 0;
  const menus = new EngineMenus({ onResume: () => resumed++ });
  const map = new EngineStarMap({ o, screen: () => menus.screen() });
  assert.ok(menus.openStarMap(map));
  assert.equal(menus.view().kind, 'starmap');
  assert.ok(menus.analog({ x: 1, y: 0 }, 1 / 60), 'the stick taken for the scanner');
  const x = map.scan[0];
  const v0 = menus.v;
  menus.starFrame(1 / 60);
  assert.ok(map.scan[0] > x && menus.v > v0, 'moved, the view sent again');
  menus.action('back');
  assert.ok(!menus.open && resumed === 1);
});

test('pointer scanner preserves first-hover sweep guard, supports touch, clamps and resets on reopen', () => {
  const { o } = options({ 'world.desert.done': true });
  const map = new EngineStarMap({ o });
  map.open();
  const start = [...map.scan];
  assert.equal(map.pointer(.5, .5), false);
  assert.deepEqual(map.scan, start);
  assert.equal(map.moved, 0);
  assert.equal(map.pointer(.6, .5), true);
  assert.ok(map.moved > 0);
  assert.deepEqual(map.scan, [map.box.fw * .6, map.box.fh * .5]);
  map.close(); map.open();
  assert.equal(map.pointer(.8, .7, true), true);
  assert.equal(map.moved, 0, 'first tap places scanner but does not arm discovery');
  map.pointer(2, -1);
  assert.deepEqual(map.scan, [map.box.fw, 0]);
  const before = [...map.scan];
  assert.equal(map.pointer(NaN, .5), false);
  assert.deepEqual(map.scan, before);
  map.asking = {};
  assert.equal(map.pointer(.3, .4, true), false);
  map.asking = null; map.close();
  assert.equal(map.pointer(.3, .4, true), false);
});

test('an open native chart follows delayed canvas size and later resize without inventing a sweep', () => {
  const { o } = options({ 'world.desert.done': true });
  let screen = { w: 1280, h: 720 };
  const map = new EngineStarMap({ o, screen: () => screen }); map.open();
  map.pointer(.6, .4, true); map.pointer(.65, .45);
  const cv = map.cv, sel = map.sel;
  screen = { w: 960, h: 720 };
  const view = map.view(), box = chartBox(960, 720);
  assert.deepEqual(view.chart, { x: 17.2, y: 34, w: 921.6, h: 648, side: 248.8 });
  assert.ok(view.chart.x + view.chart.w + 4 <= 960);
  assert.ok(map.cv > cv, 'native full-chart cache must rebuild');
  assert.equal(map.sel, sel);
  assert.ok(Math.abs(map.scan[0] / box.fw - .65) < 1e-9);
  assert.equal(map.moved, 0, 'resize never arms discovery');
  assert.equal(map.pointer(.7, .5), false, 'first hover remains guarded');
  assert.equal(map.pointer(.8, .6, true), true);
  assert.ok(map.moved > 0);
  assert.deepEqual(map.scan, [box.fw * .8, box.fh * .6]);
  map.still = true; screen = { w: 1440, h: 900 };
  assert.equal(map.update(0), true, 'held diagnostic views still relayout');
  assert.deepEqual(map.box, chartBox(1440, 900));
  assert.equal(map.update(0), false, 'unchanged dimensions do not rebuild every frame');
});

test('after native resize a deliberate pointer swipe and dwell still discovers and charts a world', () => {
  const { o, found, F } = options({ 'world.desert.done': true });
  let screen = { w: 1280, h: 720 };
  const map = new EngineStarMap({ o, screen: () => screen }); map.open();
  screen = { w: 960, h: 720 }; map.view();
  const target = map.targets.find(t => t.id === 'arzach'), box = map.box;
  map.pointer(.05, .05, true);
  for (let i = 1; i <= 30; i++) {
    const k = i / 30;
    map.pointer(.05 + (target.x / box.fw - .05) * k, .05 + (target.y / box.fh - .05) * k);
    map.update(1 / 60);
  }
  for (let i = 0; i < 180; i++) map.update(1 / 60);
  assert.deepEqual(found, ['arzach']);
  assert.equal(F[foundFlag('arzach')], true);
  assert.ok(map.entries.find(e => e.id === 'arzach').known);
  assert.ok(map.view().worlds.some(w => w.id === 'arzach'));
});
