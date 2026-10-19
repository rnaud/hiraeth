// Plants never on a roof (issue #497, src/plant-ground.js builtTop): in every world of the route, neither the responsive
// world's flowers, fans and fungi (src/reactive-world.js: seeded round the people, the relics and the goal, they used to
// land on the roof over whoever stood under it, on stalls and a pyramid's crown) nor the flora's scatter (src/flora.js:
// in its ray-cast parts, on slabs and sand banks) stand on top of anything built. Roof gardens a world draws on purpose
// (the City-Shaft's villas, the floating city's roofs) are its own drawing, not scattered: none is listed here.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { builtTop, GROUND_LIFT } from '../src/plant-ground.js';
import { ORDER } from '../src/levels/names.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT } from '../src/levels/content.js';
import { Physics } from '../src/physics.js';
import { ReactiveWorld } from '../src/reactive-world.js';
import { buildFlora, floraKeep } from '../src/flora.js';

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
