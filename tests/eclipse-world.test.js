import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { SIDE } from '../src/levels/names.js';
import { mapEntries } from '../src/ship/starmap.js';
import { createEclipse, ECLIPSE_CONTENT, ECLIPSE_SCRIPT, SHIP_SITE, STAIR, BOWL, LEVEL, BOUNDS, WEST } from '../src/levels/eclipse.js';

// ------------------------------------------------------------------ the world (src/levels/eclipse.js)
let world = null;
const built = () => world ??= (() => {
  const scene = new THREE.Scene(), w = console.warn; console.warn = () => {};
  try { const level = createEclipse(scene); return { scene, level, physics: new Physics(scene, level.ground) }; } finally { console.warn = w; }
})();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clear = (physics, x, y, z) => physics.pushCapsule(V(x, y + 0.6, z), 0.4, 0.6, 1.8) === null;

test('the City During the Eclipse: off the route, on the map from the start, reached by ?level=eclipse', () => {
  const L = LEVELS.find((l) => l.id === 'eclipse');
  assert.ok(L && L.hidden && !L.dev, 'a world, not on the route');
  assert.ok(SIDE.includes('eclipse') && !ORDER.includes('eclipse'));
  assert.equal(CONTENT.eclipse, ECLIPSE_CONTENT);
  assert.ok(ECLIPSE_CONTENT.story.manual, 'no story to follow: no beacon');
  const entries = mapEntries({ order: ORDER, levels: LEVELS, side: SIDE, journal: { seen: () => false, storyDone: () => false }, current: 'desert', flag: () => undefined, home: () => true });
  const e = entries.find((x) => x.id === 'eclipse');
  assert.ok(e && e.known && e.side, 'charted, off the dotted line');
  assert.ok(entries.at(-1).home, 'home still last');
});

test('the city builds: the ship on the esplanade, the eclipse at noon, people from three worlds', () => {
  const { level, physics } = built();
  assert.equal(level.id, 'eclipse');
  const g = (x, z) => level.ground.heightAt(x, z);
  assert.ok(Math.abs(g(SHIP_SITE.x, SHIP_SITE.z)) < 0.5, 'the ship lands on the flat esplanade');
  assert.ok(Math.abs(level.spawn.y - g(level.spawn.x, level.spawn.z)) < 0.2);
  assert.ok(clear(physics, level.spawn.x, level.spawn.y, level.spawn.z), 'nothing in the way where he starts');
  assert.equal(level.defaults.hour, 12, 'he lands in totality');
  assert.ok(level.sky.eclipse, 'its own sky (src/eclipse.js)');
  assert.equal(level.atmo(0, 0, 0).script, ECLIPSE_SCRIPT);
  const named = ECLIPSE_CONTENT.npcs.filter((p) => p.id).map((p) => p.id);
  assert.deepEqual(named.sort(), ['mira', 'wen', 'ysolde']);
  for (const p of ECLIPSE_CONTENT.npcs.filter((q) => q.talk)) assert.ok(p.talk.listen?.length >= 3 && !p.talk.nodes && !p.talk.entry, `${p.id}: only words for the city, no errands`);
  // every one of them stands on clear ground at their own level
  for (const p of ECLIPSE_CONTENT.npcs) {
    const y = p.y ?? g(p.at[0], p.at[1]), top = physics.groundAt(p.at[0], y + 1.5, p.at[1], 4);
    assert.ok(Number.isFinite(top) && Math.abs(top - y) < 0.6, `someone at ${p.at} stands on ground (${top} vs ${y})`);
  }
  assert.ok(level.lights.length > 60, `lamps everywhere (${level.lights.length})`);
});

test('the way through: the gate, the square, up the Great Stair, across the bowl and up its tiers', () => {
  const { physics, level } = built();
  for (let z = 110; z > -28; z -= 3) assert.ok(clear(physics, 0.5, level.ground.heightAt(0.5, z), z) || clear(physics, 6.5, 0, z), `the way north is open at z ${z}`);
  // the Great Stair: a tread under every step, rising to the upper city
  let last = -1;
  for (let i = 1; i < STAIR.len / STAIR.run; i++) {
    const z = STAIR.z - (i - 0.5) * STAIR.run, y = physics.groundAt(1, LEVEL.high + 2, z, LEVEL.high + 4);
    assert.ok(y >= last - 1e-6 && y <= LEVEL.high + 0.01, `a step at z ${z.toFixed(1)} (${y})`);
    last = y;
  }
  assert.ok(Math.abs(physics.groundAt(1, LEVEL.high + 2, BOUNDS.STEP - 3, 4) - LEVEL.high) < 0.05, 'the upper city at the stair\'s head');
  // the bowl: up the middle stair, tier by tier, to the top
  for (let i = 0; i < LEVEL.tiers; i++) {
    const z = BOWL.Z1 - BOWL.D * i - 1.5, y = physics.groundAt(0.5, LEVEL.high + 20, z, 30);
    assert.ok(Math.abs(y - (LEVEL.high + LEVEL.tier * (i + 1))) < 0.05, `tier ${i + 1} at z ${z} (${y})`);
  }
  // the side stair up the west wall to its terraces
  assert.ok(Math.abs(physics.groundAt(WEST.stairX, WEST.y1 + 2, (WEST.landing[0] + WEST.landing[1]) / 2, 4) - WEST.y1) < 0.05, 'the landing at the side stair\'s head');
  assert.ok(Math.abs(physics.groundAt(WEST.x1 - 3, WEST.y1 + 2, WEST.landing[1] - 1.5, 4) - WEST.y1) < 0.05, 'onto the first terrace');
  assert.ok(Math.abs(physics.groundAt(WEST.stair2X, WEST.y2 + 2, WEST.front2 - 1.5, 4) - WEST.y2) < 0.05, 'up to the second');
});

test('the city stands on its walls over the plain: walking off the square stops at a parapet', () => {
  const { physics } = built();
  for (const [x, y, z, dx] of [[-40, 0, 10, -1], [40, 0, 0, 1], [-48, 6, -100, -1], [48, 6, -150, 1]]) {
    let hit = false;
    for (let s = 0; s < 30 && !hit; s += 0.25) hit = !clear(physics, x + dx * s, y, z);
    assert.ok(hit, `a wall or parapet beside x ${x}, z ${z}`);
  }
});
