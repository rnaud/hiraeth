// The wisps' ground (wind.js GroundCache, docs/systems/performance.md): exact heights 0.5 m apart, read
// bilinearly, worked out once while the ground stays as it is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GroundCache } from '../src/wind.js';
import { SandDrifts } from '../src/sand-drifts.js';

test('the wisps\' ground is the ground, to within a centimetre away from a wall\'s foot, with fewer exact lookups', () => {
  const dunes = (x, z) => Math.sin(x * 0.05) * 3 + Math.cos(z * 0.031) * 2;
  const d = new SandDrifts({ heightAt: dunes, wind: [0.8, 0.6], seed: 2 });
  for (const [cx, cz, w, h] of [[0, 0, 6, 3], [14, 5, 3, 3], [-12, -8, 8, 2]]) d.addFootprint([[cx - w, cz - h], [cx + w, cz - h], [cx + w, cz + h], [cx - w, cz + h]]);
  const ground = { heightAt: dunes };
  d.raise(ground);
  let calls = 0;
  const cache = new GroundCache((x, z) => { calls++; return ground.heightAt(x, z); });
  let seed = 9; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let worst = 0, lookups = 0, sandy = 0; const errs = [];
  for (let frame = 0; frame < 60; frame++) for (let k = 0; k < 400; k++) {
    // the wisps' points: a band moving downwind, frame by frame
    const x = -30 + rand() * 60 + frame * 0.2, z = -20 + rand() * 40;
    let wall = false;
    for (const s of d.sources) { const b = s.poly; const xs = b.map((q) => q[0]), zs = b.map((q) => q[1]); wall ||= x > Math.min(...xs) - 1 && x < Math.max(...xs) + 1 && z > Math.min(...zs) - 1 && z < Math.max(...zs) + 1; }
    const exact = ground.heightAt(x, z), err = Math.abs(cache.get(x, z) - exact); lookups++;
    if (!wall) { worst = Math.max(worst, err); errs.push(err); if (exact - dunes(x, z) > 0.05) sandy++; }
  }
  assert.ok(sandy > 150, `points on banked sand (${sandy})`);
  // (the worst where the field itself steps: the edge of a drift's box, two drifts' crease)
  errs.sort((a, b) => a - b);
  const p99 = errs[Math.floor(errs.length * 0.99)];
  assert.ok(p99 < 0.01, `99 % within a centimetre off the walls (${p99})`);
  assert.ok(worst < 0.05, `all within 5 cm, where the field steps (${worst})`);
  assert.ok(calls < lookups, `fewer exact lookups than reads (${calls} for ${lookups})`);
});

test('a reshaped ground is read afresh', () => {
  let level = 0;
  const cache = new GroundCache(() => level);
  cache.check(0);
  assert.equal(cache.get(3.3, 4.1), 0);
  level = 2; cache.check(0);
  assert.equal(cache.get(3.3, 4.1), 0, 'kept while the version is the same');
  cache.check(1);
  assert.equal(cache.get(3.3, 4.1), 2);
});
