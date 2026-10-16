// Issue #371: the galactic map chooses a world by the direction pressed (the D-pad, the stick, the arrows, W A S D when
// not searching), the nearest disc that way on the chart, on the page (src/ship/starmap.js StarMap.move) and in the
// engines (engine/starmap.js EngineStarMap.move, engine/menus.js 'starmap' navigate(x, y)). It answered only left and
// right before, stepping along the route (up and down did the same).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { worldToward, chartToward, chartDrawing, mapEntries, DIR_KEYS } from '../src/ship/starmap.js';
import { EngineStarMap } from '../engine/starmap.js';
import { ORDER } from '../src/levels/names.js';
import { LEVELS } from '../src/levels/index.js';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const { EngineMenus } = await import('../engine/menus.js');

const DIRS = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

/** A StarMap's options with the route's first worlds done (charted, nothing left to search for), the ship in `current`. */
function options(done = ORDER.slice(0, 8), current = 'desert') {
  const F = { 'ship.powered': true };
  for (const id of done) F[`world.${id}.done`] = true;
  return { order: ORDER, levels: LEVELS, current, side: [], journal: { seen: () => false, storyDone: () => false },
    flag: (k) => F[k], powered: () => true, home: () => false, relay: null, finale: false, tower: false,
    onFound: () => {}, onTravel: () => {}, sound: () => null };
}

test('worldToward: the nearest disc that way, one well off to the side counting as further, nothing when none lies that way', () => {
  //        1 (0, -100)
  //  3 (-100, 0)   0 (0, 0)   2 (120, 10)   4 (60, 90)
  const pts = [[0, 0], [0, -100], [120, 10], [-100, 0], [60, 90], null];
  assert.equal(worldToward(pts, 0, ...DIRS.up), 1);
  assert.equal(worldToward(pts, 0, ...DIRS.right), 2, 'the one nearly straight right, not the nearer one down and right');
  assert.equal(worldToward(pts, 0, ...DIRS.left), 3);
  assert.equal(worldToward(pts, 0, ...DIRS.down), 4);
  assert.equal(worldToward(pts, 1, ...DIRS.up), -1, 'nothing above the top one');
  assert.equal(worldToward(pts, 3, ...DIRS.left), -1, 'nor left of the leftmost');
  // past the cone, anything on that side: from 2, up finds 1 though it lies well to the left
  assert.equal(worldToward([[0, 0], [-200, -20]], 0, ...DIRS.up), 1);
  assert.equal(worldToward(pts, 5, ...DIRS.up), -1, 'from an entry not on the chart: nothing');
  assert.equal(worldToward(pts, 0, 0, 0), -1, 'no direction: nothing');
});

test('on the real chart every direction picks a world that way, and each charted world can be reached from the first pick', () => {
  for (const [W, H] of [[900, 648], [620, 648], [420, 700]]) {
    const entries = mapEntries(options()), D = chartDrawing(entries, W, H);
    const known = entries.map((e, i) => (e.known ? i : -1)).filter((i) => i >= 0);
    assert.ok(known.length >= 8, `${W}×${H}: worlds charted (${known.length})`);
    let vertical = 0;
    for (const i of known) for (const [name, [dx, dy]] of Object.entries(DIRS)) {
      const j = chartToward(entries, D, i, dx, dy);
      if (j < 0) continue;
      assert.ok(entries[j].known, 'a charted world');
      const [x0, y0] = D.pos(entries[i]), [x1, y1] = D.pos(entries[j]);
      assert.ok((x1 - x0) * dx + (y1 - y0) * dy > 0, `${W}×${H}: ${name} from ${entries[i].id} goes ${name} (to ${entries[j].id})`);
      if (dy) vertical++;
    }
    assert.ok(vertical >= known.length / 2, `${W}×${H}: up and down move too (${vertical})`);
    // reachable: from any world, the four directions lead everywhere
    const seen = new Set([known[0]]), todo = [known[0]];
    while (todo.length) {
      const i = todo.pop();
      for (const [dx, dy] of Object.values(DIRS)) { const j = chartToward(entries, D, i, dx, dy); if (j >= 0 && !seen.has(j)) { seen.add(j); todo.push(j); } }
    }
    assert.deepEqual([...seen].sort((a, b) => a - b), known, `${W}×${H}: every charted world reachable`);
  }
});

test('the engine map: the D-pad, the arrows and W S choose by direction; in the question any direction flips the answer', () => {
  const map = new EngineStarMap({ o: options() });
  map.open();
  const D = map.D, at = () => D.pos(map.entries[map.sel]);
  for (const [name, [dx, dy]] of Object.entries(DIRS)) {
    const from = map.sel, want = chartToward(map.entries, D, from, dx, dy);
    map.navigate(dx, dy);
    assert.equal(map.sel, want >= 0 ? want : from, `navigate ${name}`);
  }
  // up and down move (they stepped along the route before, the same as left and right)
  let moved = 0;
  for (let k = 0; k < 6; k++) {
    const [, y0] = at();
    map.key(k % 2 ? 'ArrowUp' : 'ArrowDown');
    const [, y1] = at();
    if (y1 !== y0) { moved++; assert.ok(k % 2 ? y1 < y0 : y1 > y0, 'that way'); }
  }
  assert.ok(moved > 0, 'up / down moved the pick');
  // W A S D move the scanner while there is a world to find, and choose by direction once there is none
  assert.equal(map.searching(), true);
  const sel0 = map.sel;
  assert.ok(map.key('KeyS')); map.keyUp('KeyS');
  assert.equal(map.sel, sel0, 'searching: S moves the scanner, not the pick');
  const all = new EngineStarMap({ o: options(ORDER) });
  all.open();
  assert.equal(all.searching(), false, 'every world charted');
  const before = all.sel, want = chartToward(all.entries, all.D, before, 0, 1);
  assert.ok(all.key('KeyS'));
  assert.equal(all.sel, want >= 0 ? want : before);
  // in the question, up / down flip yes and no as left / right do
  map.sel = map.entries.findIndex((e) => e.known && !e.current);
  map.action('confirm');
  assert.ok(map.asking);
  map.navigate(0, 1); assert.equal(map.yes, false);
  map.key('ArrowUp'); assert.equal(map.yes, true);
});

test('the menus hand the map their directions (the pad and the stick when not searching)', () => {
  const menus = new EngineMenus({ onResume: () => {} });
  const map = new EngineStarMap({ o: options(), screen: () => menus.screen() });
  menus.openStarMap(map);
  const from = map.sel, want = chartToward(map.entries, map.D, from, 0, -1);
  menus.navigate(0, -1);
  assert.equal(map.sel, want >= 0 ? want : from);
});

test("the page's map reads the same directions: the arrows and W A S D, the D-pad's four, the stick's two axes", () => {
  assert.deepEqual(DIR_KEYS.ArrowUp, [0, -1]); assert.deepEqual(DIR_KEYS.ArrowDown, [0, 1]);
  assert.deepEqual(DIR_KEYS.KeyW, [0, -1]); assert.deepEqual(DIR_KEYS.KeyS, [0, 1]);
  const src = readFileSync(new URL('../src/ship/starmap.js', import.meta.url), 'utf8');
  assert.match(src, /DIR_KEYS\[e\.code\]\) \{ this\.move\(\.\.\.DIR_KEYS\[e\.code\]\)/, 'the keys move by direction');
  assert.match(src, /y = \(b\(13\) \? 1 : 0\) - \(b\(12\) \? 1 : 0\)/, 'the D-pad’s up and down are a direction of their own');
  assert.match(src, /gp\.axes\[1\]/, 'the stick’s vertical axis read');
  assert.match(src, /this\.move\(x, y\)/);
  assert.doesNotMatch(src, /'← →'/, 'the keys’ hint names all the arrows');
});
