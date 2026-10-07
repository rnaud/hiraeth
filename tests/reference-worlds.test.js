// The References' worlds (src/levels/reference-worlds.js, docs/systems/references.md "One world at a time"):
// the registry matches the world modules, the numbering and the address round trip, and the level loads
// and builds only the world it opens on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import {
  REFERENCE_WORLDS, firstView, totalViews, worldIndex, locateView, loadWorld, loadedWorld, loadAllWorlds, startOf, findView, viewSearch,
} from '../src/levels/reference-worlds.js';
import { createReferences, buildReferences, viewCentre, referencePeople } from '../src/levels/references.js';
import { runStepsAsync } from '../src/load-steps.js';
import { ReferencePicker } from '../src/levels/reference-picker.js';

globalThis.window ??= { innerWidth: 1260, innerHeight: 800 };
const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const q = (s) => new URLSearchParams(s);

test('a world is not loaded until asked for, and the sync build needs it loaded', () => {
  for (let k = 0; k < REFERENCE_WORLDS.length; k++) assert.equal(loadedWorld(k), null, `${REFERENCE_WORLDS[k].id}: not loaded by importing the level`);
  assert.throws(() => createReferences(new THREE.Scene(), { params: q('world=market') }), /promise/, 'the sync runner cannot wait for the import');
});

test('nothing the game loads imports a world\'s views: only the registry, by dynamic import', () => {
  const ids = REFERENCE_WORLDS.map((w) => w.id);
  const world = new RegExp(`from '\\./reference-(${ids.join('|')})\\.js'`);
  const dir = new URL('../src/levels/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const s = readFileSync(new URL(f, dir), 'utf8');
    if (ids.some((id) => f === `reference-${id}.js`)) continue;   // (a world's module may borrow another's pieces)
    assert.ok(!world.test(s), `${f}: imports a world's module statically`);
    if (f !== 'reference-views.js') assert.ok(!/from '\.\/reference-views\.js'/.test(s), `${f}: imports every view (reference-views.js)`);
  }
  for (const f of ['main.js', 'levels/index.js', 'levels/content.js', 'levels/references.js', 'levels/reference-picker.js']) assert.ok(!/reference-views\.js'/.test(src(f)), `${f}`);
  for (const w of REFERENCE_WORLDS) {
    assert.ok(existsSync(new URL(`../src/levels/reference-${w.id}.js`, import.meta.url)), `${w.id}: reference-${w.id}.js`);
    assert.match(String(w.load), new RegExp(`import\\('\\./reference-${w.id}\\.js'\\)`), `${w.id}: loads its own module`);
  }
});

test('each world\'s entry: a unique id, its count of views, its sheets named for it', async () => {
  assert.equal(new Set(REFERENCE_WORLDS.map((w) => w.id)).size, REFERENCE_WORLDS.length);
  const worlds = await loadAllWorlds();
  const ids = new Set();
  for (const w of worlds) {
    assert.equal(w.views.length, w.count, `${w.id}: count ${w.count} in the registry, ${w.views.length} views in its module`);
    assert.ok(w.count > 0 && w.count < 196, `${w.id}: fewer views than the grid has cells`);
    assert.equal(w.first, firstView(w.k));
    for (const v of w.views) {
      const s = w.sheets[v.sheet];
      assert.ok(s, `${v.id}: its sheet ${v.sheet} is the world's`);
      assert.ok(s.name.startsWith(`${w.name} / `), `${v.id}: its sheet named for its world (${s.name})`);
      assert.ok(s.url && s.size?.length === 2);
      assert.ok(!ids.has(v.id), `${v.id}: one view of that id`);
      ids.add(v.id);
    }
  }
  assert.equal(ids.size, totalViews());
  assert.equal(loadedWorld(0), worlds[0], 'loaded once, kept');
  assert.equal(await loadWorld(0), worlds[0]);
});

test('every world\'s views: reference-views.js is the registry\'s worlds in order', async () => {
  const { REFERENCE_VIEWS, REFERENCE_SHEETS } = await import('../src/levels/reference-views.js');
  const worlds = await loadAllWorlds();
  assert.equal(REFERENCE_VIEWS.length, totalViews());
  for (const w of worlds) w.views.forEach((v, j) => { assert.equal(REFERENCE_VIEWS[w.first + j], v); assert.equal(REFERENCE_SHEETS[v.sheet], w.sheets[v.sheet]); });
});

test('the numbering: a view\'s place across the worlds and in its own, and the address', async () => {
  const n = totalViews();
  for (let i = 0; i < n; i++) {
    const at = locateView(i);
    assert.equal(firstView(at.k) + at.local, i);
    assert.ok(at.local < REFERENCE_WORLDS[at.k].count);
  }
  assert.equal(locateView(n), null);
  assert.equal(locateView(-1), null);
  assert.deepEqual(startOf(q('')), { k: 0, local: 0 }, 'the first world\'s first view');
  assert.deepEqual(startOf(q('view=28')), { k: 1, local: 0 }, 'view 28: the City-Shaft\'s first (the desert has 27)');
  assert.deepEqual(startOf(q('world=shaft&view=3')), { k: 1, local: 2 });
  assert.deepEqual(startOf(q('world=shaft')), { k: 1, local: 0 });
  assert.deepEqual(startOf(q('world=shaft&view=999')), { k: 1, local: 0 }, 'past its views: its first');
  assert.deepEqual(startOf(q('world=nowhere&view=2')), { k: 0, local: 1 }, 'an unknown world: the number across the worlds');
  assert.deepEqual(startOf(q(`view=${n + 5}`)), { k: 0, local: 0 });
  assert.deepEqual(startOf(q('view=3797-egg-heaps')), { id: '3797-egg-heaps' });
  assert.deepEqual(await findView('3797-egg-heaps'), { k: worldIndex('lorn'), local: (await loadWorld(worldIndex('lorn'))).views.findIndex((v) => v.id === '3797-egg-heaps') });
  assert.equal(await findView('no-such-view'), null);
  const s = viewSearch('?level=references&look=desert&view=4', worldIndex('vael2'), 6);
  assert.equal(s, '?level=references&look=desert&view=7&world=vael2', 'the rest of the query kept');
  assert.deepEqual(startOf(q(s)), { k: worldIndex('vael2'), local: 6 }, 'and read back');
});

test('the grid: every view in the cell of its number, far from the others of its world and the ship', async () => {
  for (const w of await loadAllWorlds()) {
    const c = w.views.map((_, j) => viewCentre(w.first + j));
    for (let a = 0; a < c.length; a++) {
      assert.ok(c[a].length() > 1500, 'clear of the ship at the origin');
      for (let b = a + 1; b < c.length; b++) assert.ok(c[a].distanceTo(c[b]) > 3000, `${w.id}: views ${a + 1} and ${b + 1} apart`);
    }
  }
  assert.equal(viewCentre(196).distanceTo(viewCentre(0)), 0, 'past 196 views the cells go round again');
});

test('the level builds the world it opens on, a view a step, and goes to another world by the address', async () => {
  const scene = new THREE.Scene(), gone = [];
  let steps = 0;
  const gen = buildReferences(scene, { params: q('world=market&view=3'), search: '?level=references&world=market&view=3&look=bazaar', go: (s) => gone.push(s) });
  const counted = { next: (v) => { steps++; return gen.next(v); }, [Symbol.iterator]() { return this; } };
  const level = await runStepsAsync(counted);
  const market = await loadWorld(worldIndex('market'));
  assert.equal(level.world, market);
  assert.ok(steps > market.count, `built in steps (${steps}), one a view at least`);
  assert.equal(level.views.length, market.count, 'the market\'s views only');
  assert.deepEqual(level.views.map((v) => v.i), market.views.map((_, j) => market.first + j), 'numbered across the worlds');
  assert.equal(scene.children.filter((o) => o.name.startsWith('Reference: ')).length, market.count, 'nothing of the other worlds in the scene');
  assert.deepEqual(referencePeople(), [], 'the market\'s panels have no people');
  const player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), heading: 0, object: new THREE.Object3D(), teleport(p) { this.pos.copy(p); } };
  const camera = new THREE.PerspectiveCamera(55, 1260 / 800, 0.3, 5000);
  const step = () => level.update(1 / 60, 0, { player, camera });
  step();
  assert.equal(level.held, level.views[2], 'the third of its views, as the address asks');
  level.goTo(level.views[5].i); step();
  assert.equal(level.held, level.views[5], 'a view of this world: framed here');
  assert.deepEqual(gone, []);
  level.jumpWorld(1); step();
  { const k = (REFERENCE_WORLDS.findIndex((w) => w.id === 'market') + 1) % REFERENCE_WORLDS.length;
    assert.deepEqual(gone, [`?level=references&world=${REFERENCE_WORLDS[k].id}&view=1&look=bazaar`], 'the next world (round to the first after the last): the page goes there, ?look kept');
    assert.deepEqual(level.leaving, { k, local: 0 }); }
  step();
  assert.equal(gone.length, 1, 'once');
});

test('the quick menu reads every world on its first opening', async () => {
  let asked = 0;
  const picker = new ReferencePicker({ load: () => { asked++; return loadAllWorlds(); }, win: null, doc: null });
  assert.equal(picker.views, null, 'nothing read before it is opened');
  assert.equal(picker.toggle(true), false, 'no page: nothing opens');
  await picker.prepare();
  assert.equal(asked, 1);
  assert.equal(picker.views.length, totalViews());
  assert.ok(Object.keys(picker.sheets).length >= 30);
  const src2 = src('levels/references.js');
  assert.match(src2, /\{ \} world/, 'the label names the world keys');
  assert.match(src2, /quickMenu: new ReferencePicker\(\{ load: loadAllWorlds/);
  assert.match(src('main.js'), /quickMenu\.turn\?\.\(/, 'LB / RB in the list: the world before / after');
});
