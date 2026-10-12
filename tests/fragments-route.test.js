// The fragments of the singing light off the way you are sent, and in the new country (issue #228, the game audit
// v1.59; docs/systems/fragments.md). Each world is built as the play-through builds it (tests/playthrough-agent.js
// loadWorld) and its critical path laid as the level design audit lays it (scripts/level-design/path.mjs: the landing,
// the route's quests stage by stage, back to the ship, its straight legs in 3D). Every fragment lies 25 m or more from
// it; and each of the six worlds rebuilt in v1.55–v1.57 has at least two in its new country (tests/fragments-reach.js
// NEW_COUNTRY), one of them high (15 m over the landing, or on a ledge with a 10 m drop by it).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const { loadWorld } = await import('./playthrough-agent.js');
const { criticalPath, pathSegments, distanceToPath } = await import('../scripts/level-design/path.mjs');
const { newCountry } = await import('./fragments-reach.js');
const { FRAGMENTS } = await import('../src/fragments-data.js');
const { ORDER } = await import('../src/levels/names.js');

/** The nearest a fragment may lie to the route's line (m). */
export const ROUTE_CLEAR = 25;
/** The worlds rebuilt after the fragments were first placed (v1.55–v1.57): Lorn, Viridel, the Underwater City, the Moon Foundry, the Floating city, the Signal Market. */
const REBUILT = ['perdide', 'edena', 'underwater', 'moonfoundry', 'spacecity', 'bazaar'];

const worlds = new Map();
const world = (id) => {
  if (!worlds.has(id)) {
    globalThis.location = { search: `?level=${id}` };
    const W = loadWorld(id);
    worlds.set(id, { W, segs: pathSegments(criticalPath(W, id).path) });
  }
  return worlds.get(id);
};

test('every fragment lies 25 m or more from the route’s line', () => {
  const near = [];
  for (const id of ORDER) {
    const { segs } = world(id);
    assert.ok(segs.length > 2, `${id}: a route of ${segs.length} legs`);
    FRAGMENTS[id].forEach((p, i) => { const d = distanceToPath(p, segs); if (d < ROUTE_CLEAR) near.push(`${id} ${i} (${p.join(', ')}): ${d.toFixed(1)} m from the route`); });
  }
  assert.deepEqual(near, []);
});

test('the rebuilt worlds hide at least two in their new country, one of them high', () => {
  const short = [];
  for (const id of REBUILT) {
    const { W } = world(id);
    const { sights, isNew } = newCountry(W.level, id);
    assert.ok(sights.length >= 3, `${id}: ${sights.length} sights of the new country`);
    const fresh = FRAGMENTS[id].filter(([x, y, z]) => isNew(x, y, z));
    const spawnY = W.level.spawn.y;
    const ledge = ([x, y, z]) => [0, 1, 2, 3, 4, 5, 6, 7].some((k) => {
      const a = (k / 8) * Math.PI * 2, g = W.physics.groundAt(x + Math.cos(a) * 4, y + 1, z + Math.sin(a) * 4, 80);
      return !Number.isFinite(g) || y - g >= 10;
    });
    const high = fresh.filter((p) => p[1] - spawnY >= 15 || ledge(p));
    if (fresh.length < 2 || !high.length) short.push(`${id}: ${fresh.length} in the new country, ${high.length} high`);
  }
  assert.deepEqual(short, []);
});

// (THREE is loaded by the worlds; kept imported so the module graph matches the play-through's)
void THREE;
