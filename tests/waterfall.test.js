// The City Behind the Waterfall (src/levels/waterfall.js, docs/systems/worlds.md): the world builds, stands where it
// is drawn, the ship lands on its shelf, its views are in the References, the falls' shader is compiled in.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWaterfall, CAVE, BALCONIES, SHIP_SITE, SHEETS, roarAt, groundHeight } from '../src/levels/waterfall.js';
import { Physics } from '../src/physics.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { EXTRA, TITLES } from '../src/levels/names.js';
import { mapEntries } from '../src/ship/starmap.js';
import { makeMaterial } from '../src/materials.js';
import { FALL } from '../src/waterfall-shader.js';
import { fallSheet } from '../src/levels/waterfall-kit.js';
import { buildPeople } from '../src/crowd.js';
import { toneOf } from '../src/story/tone.js';

const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };
const scene = new THREE.Scene();
const level = quiet(() => createWaterfall(scene));
const physics = new Physics(scene, level.ground);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

test('the world is registered off the route: in the worlds list, on the galactic map from the start, never counted', () => {
  const meta = LEVELS.find((l) => l.id === 'waterfall');
  assert.ok(meta && !meta.hidden && !meta.dev, 'a world of the list');
  assert.equal(meta.title, TITLES.waterfall);
  assert.ok(EXTRA.includes('waterfall') && !ORDER.includes('waterfall'), 'off the route');
  assert.equal(CONTENT.waterfall.relics.names.length, 0);
  assert.equal(CONTENT.waterfall.story.manual, true, 'no page closes by walking somewhere');
  const entries = mapEntries({ order: ORDER, levels: LEVELS, flag: () => false, journal: null, current: 'desert', home: false });
  const e = entries.find((x) => x.id === 'waterfall');
  assert.ok(e && e.known && e.extra, 'charted from the first world on');
  assert.equal(entries.filter((x) => !x.extra && x.known).length, 3, 'the route itself is as before: the desert and the two ahead');
});

test('the promenade, the bridges and the balconies are solid where they are drawn; the pool is under the curtain', () => {
  for (let x = CAVE.x0 + 6; x < CAVE.x1 - 4; x += 7) assert.ok(Math.abs(physics.groundAt(x, 3, 6) - 0) < 0.05, `the promenade at x ${x}`);
  for (const bx of BALCONIES) {
    for (const z of [24, 28, 33, 36.5]) assert.ok(Math.abs(physics.groundAt(bx, 3, z)) < 0.05, `balcony ${bx}, z ${z}: ${physics.groundAt(bx, 3, z)}`);
    assert.ok(!SHEETS.some(([a, b]) => bx > a && bx < b), 'a slit in the water before each balcony');
  }
  assert.equal(groundHeight(-100, 50), CAVE.bed, 'the pool\'s bed');
  assert.ok(physics.groundAt(-100, 2, 50) < CAVE.poolY - 2, 'the pool is deep enough to swim');
});

test('the ship lands on the shelf outside the mouth: flat, clear, open to the sky', () => {
  for (let a = 0; a < 6.28; a += 0.5) for (const r of [0, 8, 15]) {
    const x = SHIP_SITE.x + Math.cos(a) * r, z = SHIP_SITE.z + Math.sin(a) * r;
    assert.ok(Math.abs(physics.groundAt(x, 5, z)) < 0.25, `the shelf at ${x.toFixed(1)}, ${z.toFixed(1)}`);
    assert.equal(physics.rayHit(V(x, 2, z), V(0, 1, 0), 300), null, `open sky over ${x.toFixed(1)}, ${z.toFixed(1)}`);
  }
  assert.ok(Math.abs(physics.groundAt(level.spawn.x, 3, level.spawn.z)) < 0.25, 'the spawn stands on the shelf');
});

test('the terraces climb by their stairs: a walk up the lower town finds ground step by step', () => {
  // the first stair of the lower town: its steps rise 0.3 m at a time, each solid
  const st = level.streets.length;
  assert.ok(st >= 8, `streets: ${st}`);
  for (const s of level.streets) assert.ok(Math.abs(physics.groundAt((s.x0 + s.x1) / 2, s.y + 2, s.z1 - 1.2) - s.y) < 0.05, `the street at y ${s.y} is solid at its front`);
});

test('the falls roar near their foot and fall quiet far off; the people walk where it is solid', () => {
  assert.ok(roarAt(V(-100, 0, 20)) > 0.6, 'by the parapet');
  assert.ok(roarAt(V(-100, 0, -80)) < roarAt(V(-100, 0, 15)), 'quieter at the back');
  assert.ok(roarAt(V(180, 0, -60)) < 0.2, 'faint on the landing');
  level.init?.(physics);
  const { routes } = quiet(() => buildPeople(physics, level.crowdSpots()));
  assert.ok(routes.length >= 10, `walkable crowd routes: ${routes.length}`);
  for (const line of level.crowdLines) assert.ok(toneOf(line), `toned: ${line}`);
  for (const n of CONTENT.waterfall.npcs) for (const line of n.lines) assert.ok(toneOf(line), `toned: ${line}`);
  const triangles = physics.triangles;
  assert.ok(triangles < 200000, `static collision budget: ${triangles}`);
});

test('the falling water: a material says it with `fall`, its sheet carries its uv in metres', () => {
  const m = makeMaterial({ color: '#66c2c6', color2: '#b2ebe2', color3: '#357f8a', fall: { speed: 5 }, glow: 0.72 });
  assert.equal(m.defines.FALL, 1);
  assert.equal(m.uniforms.uFallA.value.x, 5);
  assert.equal(m.uniforms.uFallA.value.y, FALL.column);
  assert.equal(m.side, THREE.DoubleSide);
  const g = fallSheet({ w: 20, h: 60, bow: 2 }), uv = g.attributes.uv, p = g.attributes.position;
  let maxU = 0, maxV = 0;
  for (let i = 0; i < uv.count; i++) { maxU = Math.max(maxU, uv.getX(i)); maxV = Math.max(maxV, uv.getY(i)); assert.ok(Math.abs(uv.getY(i) - p.getY(i)) < 1e-4, 'v is the height'); }
  assert.ok(Math.abs(maxU - 20) < 1e-4 && Math.abs(maxV - 60) < 1e-4);
  assert.ok(level.waterfalls.every((w) => w.material.defines.FALL && w.userData.noCollide), 'the curtain is drawn only');
});

test('the City Behind the Waterfall\'s views: four plates, one view each, in the References', async () => {
  const { REFERENCE_WORLDS } = await import('../src/levels/reference-worlds.js');
  const w = REFERENCE_WORLDS.find((x) => x.id === 'waterfall');
  assert.ok(w, 'a references world');
  const m = await w.load();
  assert.equal(m.VIEWS.length, w.count);
  assert.deepEqual(m.VIEWS.map((v) => v.sheet), ['waterfall-1', 'waterfall-2', 'waterfall-3', 'waterfall-4']);
  for (const v of m.VIEWS) {
    assert.ok(m.SHEETS[v.sheet].name.startsWith(`${w.name} / `));
    assert.deepEqual(v.crop, [0, 0, ...m.SHEETS[v.sheet].size]);
  }
});
