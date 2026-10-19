// People never start in a plant (issue #496) and plants never grow on a roof (issue #497, src/plant-ground.js builtTop): in every world of the route, neither the responsive
// world's flowers, fans and fungi (src/reactive-world.js: seeded round the people, the relics and the goal, they used to
// land on the roof over whoever stood under it, on stalls and a pyramid's crown) nor the flora's scatter (src/flora.js:
// in its ray-cast parts, on slabs and sand banks) stand on top of anything built. Roof gardens a world draws on purpose
// (the City-Shaft's villas, the floating city's roofs) are its own drawing, not scattered: none is listed here.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { builtTop, GROUND_LIFT, plantClear, CircleGrid, routeClear, peopleStarts } from '../src/plant-ground.js';
import { ORDER } from '../src/levels/names.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT } from '../src/levels/content.js';
import { Physics } from '../src/physics.js';
import { ReactiveWorld } from '../src/reactive-world.js';
import { buildFlora, floraKeep } from '../src/flora.js';

// (a little DOM: the people's balloons)
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, append() {}, setAttribute() {}, set textContent(v) {}, set innerHTML(v) {}, get firstElementChild() { return el(); } });
globalThis.document ??= { createElement: () => el(), body: el(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, hidden: false };
const { spawnNPCs } = await import('../src/npc.js');
const { buildPeople } = await import('../src/crowd.js');

const store = { getItem: () => null, setItem() {} };
const quiet = (fn) => { const w = console.warn, i = console.info, l = console.log; console.warn = console.info = console.log = () => {}; try { return fn(); } finally { console.warn = w; console.info = i; console.log = l; } };
/** Plants a world puts on a built top on purpose, by world: [x, z, r] (none: roof gardens are drawn, not scattered). */
const DELIBERATE = {};

/** A route world as the game builds it, up to its plants. */
function plantWorld(id) {
  const meta = LEVELS.find((l) => l.id === id);
  const scene = new THREE.Scene();
  const level = quiet(() => meta.create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const content = CONTENT[id];
  const reactiveWorld = quiet(() => new ReactiveWorld(scene, level, physics, content, { storage: store }));
  return { scene, level, physics, content, reactiveWorld };
}

test('builtTop: the terrain and a pavement on it are ground; a roof over it, or a small raised top on a world\'s own raised ground, is built', () => {
  const flat = { heightAt: () => 0 };
  const roofHere = (x, z) => Math.abs(x) < 3 && Math.abs(z) < 3;   // a hut 3 m tall, 6 m across
  const physics = { groundAt: (x, from, z) => (roofHere(x, z) && from > 3 ? 3 : 0) };
  assert.equal(builtTop(physics, { ground: flat }, 10, 0, 10), false, 'the terrain');
  assert.equal(builtTop(physics, { ground: flat }, 10, GROUND_LIFT - 0.05, 10), false, 'a pavement');
  assert.equal(builtTop(physics, { ground: flat }, 0, 3, 0), true, 'the hut\'s roof');
  // a world's own raised ground (Vael's sky stones): a broad table is ground, a small top on it is built
  const table = { ground: { heightAt: () => -200 }, plantGround: () => true };
  const broad = { groundAt: () => 40 };
  assert.equal(builtTop(broad, table, 0, 40, 0), false, 'a broad rock table');
  assert.equal(builtTop(physics, { ...table, plantGround: () => true }, 0, 3, 0), true, 'a hut on it');
  // a world of meshes, no heightfield: the edge test alone
  assert.equal(builtTop(physics, { ground: { heightAt: () => -Infinity } }, 0, 3, 0), true);
  assert.equal(builtTop(broad, { ground: { heightAt: () => -Infinity } }, 0, 40, 0), false);
});

for (const id of ORDER) {
  test(`${id}: no plant on a roof or any built top`, () => {
    const { scene, level, physics, content, reactiveWorld: rw } = plantWorld(id);
    const allowed = (x, z) => (DELIBERATE[id] ?? []).some(([ax, az, r]) => Math.hypot(ax - x, az - z) < r);
    const plants = rw.nodes.filter((n) => n.obj?.petals && n.foot);
    const onTop = plants.filter((n) => !allowed(n.foot.x, n.foot.z) && builtTop(physics, level, n.foot.x, n.foot.y, n.foot.z));
    assert.deepEqual(onTop.map((n) => n.foot.toArray().map((v) => +v.toFixed(1))), [], 'responsive plants on a built top');
    const flora = quiet(() => buildFlora({ scene, level, levelId: id, physics, keep: floraKeep({ level, content, reactiveWorld: rw }) }));
    const bad = (flora?.plants ?? []).filter((p) => !allowed(p.x, p.z) && builtTop(physics, level, p.x, p.y, p.z));
    assert.deepEqual(bad.slice(0, 10).map((p) => [p.sp.id, +p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)]), [], 'the flora on a built top');
  });
}

// ------------------------------------------------------------------ people never start in a plant (issue #496)
// The people walk loops up to 14 m round their spots (src/npc.js) and the crowd stands and strolls (src/crowd.js);
// the responsive plants grow before them (seeded round their spots), the flora after. Nobody's loop starts or turns
// inside a responsive plant, and the flora keeps off everyone's spot and the loop they walk: so no person, in any world
// of the route, starts within a plant's footprint (its widest reach, as drawn).
const footprint = (p) => { const b = p.sp.geo.boundingBox; return Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z) * 0.8 * (p.height / p.sp.h); };
for (const id of ORDER) {
  test(`${id}: no one starts in the middle of a plant`, () => {
    const { scene, level, physics, content, reactiveWorld: rw } = plantWorld(id);
    const clear = plantClear(rw);
    const npcs = quiet(() => spawnNPCs(scene, physics, content.npcs ?? [], { clear }));
    let crowd = null;
    if (level.crowdSpots) {
      const spots = { lines: level.crowdLines, ...level.crowdSpots() };
      const built = quiet(() => buildPeople(physics, spots, { seed: 11, clear: [...(content.npcs ?? []).map((s) => ({ x: s.at[0], y: s.y, z: s.at[1], r: 3 })), ...clear] }));
      crowd = { people: built.people, walks: spots.walks ?? [] };
    }
    rw.keepOff(peopleStarts(npcs, crowd));   // (as the game does once the story's people are placed too)
    const flora = quiet(() => buildFlora({ scene, level, levelId: id, physics, keep: floraKeep({ level, content, npcs, crowd, reactiveWorld: rw }) }));
    const plants = [
      ...rw.nodes.filter((n) => n.obj?.petals && n.foot).map((n) => ({ what: 'responsive', x: n.foot.x, y: n.foot.y, z: n.foot.z, r: n.obj.reach * n.obj.root.scale.x, h: 2 })),
      ...(flora?.plants ?? []).map((p) => ({ what: p.sp.id, x: p.x, y: p.y, z: p.z, r: footprint(p), h: p.height })),
    ];
    const grid = new CircleGrid(plants);
    const inside = (q) => plants.filter((p) => Math.hypot(p.x - q.x, p.z - q.z) < p.r + 0.25 && q.y > p.y - 1 && q.y < p.y + p.h + 1).map((p) => p.what);
    const starts = [
      ...npcs.map((n) => ({ who: n.def?.name ?? n.lines?.[0]?.slice(0, 20) ?? 'someone', x: n.pos.x, y: n.pos.y, z: n.pos.z })),
      ...(crowd?.people ?? []).map((p) => ({ who: p.walk ? 'a stroller' : 'the crowd', x: p.pos.x, y: p.pos.y, z: p.pos.z })),
    ];
    const bad = starts.filter((q) => grid.hits(q.x, q.z, 0.25) && inside(q).length).map((q) => `${q.who} at ${q.x.toFixed(1)}, ${q.z.toFixed(1)} in ${inside(q).join(', ')}`);
    assert.deepEqual(bad, [], 'people starting inside a plant');
    // and nobody's loop turns inside one of the flora's (the walk between points is kept clear too)
    const turns = npcs.flatMap((n) => (n.route ?? []).map((p) => ({ who: n.def?.name ?? 'someone', x: p.x, y: p.y, z: p.z })));
    const badTurns = turns.filter((q) => grid.hits(q.x, q.z, 0.25) && inside(q).length).map((q) => `${q.who} at ${q.x.toFixed(1)}, ${q.z.toFixed(1)}`);
    assert.deepEqual(badTurns, [], 'a loop turning inside a plant');
  });
}

test('routeClear and CircleGrid: a loop’s points and the way between them, looked up by cell', () => {
  const V = (x, z) => new THREE.Vector3(x, 0, z);
  const c = routeClear([V(0, 0), V(10, 0)], { r: 2, rw: 1, step: 2 });
  assert.equal(c.filter((q) => q.r === 2).length, 2);
  assert.ok(c.some((q) => q.r === 1 && Math.abs(q.x - 4) < 1e-9), 'the way between');
  const g = new CircleGrid(c);
  assert.ok(g.hits(4, 0.5) && g.hits(-1.5, 0) && g.hits(4, 1.8, 1));
  assert.ok(!g.hits(5, 3) && !g.hits(-30, 0));
});
