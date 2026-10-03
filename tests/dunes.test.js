import test from 'node:test';
import assert from 'node:assert/strict';
import { Terrain, heightFn } from '../src/world.js';
import { basinHeight } from '../src/desert-vistas.js';
import { Hoverbike } from '../src/bike.js';
import { mulberry32 } from '../src/noise.js';
import { biomeWeights } from '../src/biome.js';

// The desert as the game builds it (same mesh, same exact height lookup).
const terrain = new Terrain({ height: (x, z) => basinHeight(x, z, heightFn) });
const INNER = 1250;   // inside the ring of horizon mountains
const quantile = (a, p) => Float64Array.from(a).sort()[Math.floor(p * (a.length - 1))];

test('dune crests are rounded: bounded convex curvature along bike-speed paths', () => {
  const rng = mulberry32(5), convex = [], slopes = [];
  for (let p = 0; p < 400; p++) {
    const x0 = (rng() * 2 - 1) * 1200, z0 = (rng() * 2 - 1) * 1200, a = rng() * Math.PI * 2;
    const dx = Math.sin(a), dz = Math.cos(a), d = 6;
    for (let s = 0; s < 300; s += 2) {
      const x = x0 + dx * s, z = z0 + dz * s;
      if (Math.max(Math.abs(x), Math.abs(z)) > INNER) break;
      const h0 = terrain.heightAt(x - dx * d, z - dz * d), h1 = terrain.heightAt(x, z), h2 = terrain.heightAt(x + dx * d, z + dz * d);
      convex.push(-(h2 - 2 * h1 + h0) / (d * d));
      slopes.push(Math.abs(h2 - h0) / (2 * d));
    }
  }
  // A crest of curvature k throws the bike once v²k beats its hover spring
  // (~30 m/s²): at 34 m/s that is k ≈ 0.026. The old ridged dunes reached 0.39.
  assert.ok(quantile(convex, 0.999) < 0.016, `p99.9 convex curvature ${quantile(convex, 0.999)}`);
  assert.ok(quantile(convex, 1) < 0.03, `max convex curvature ${quantile(convex, 1)}`);
  // the slip faces stay gentle enough to ride up and walk down (< 35°)
  assert.ok(quantile(slopes, 1) < 0.7, `max slope ${quantile(slopes, 1)}`);
});

test('the dunes still have real relief', () => {
  const rng = mulberry32(9), heights = [];
  for (let i = 0; i < 4000; i++) {
    const x = (rng() * 2 - 1) * 1100, z = (rng() * 2 - 1) * 1100, w = biomeWeights(x, z);
    if (w.salt < 0.2 && Math.hypot(x, z) > 200) heights.push(terrain.heightAt(x, z));
  }
  assert.ok(quantile(heights, 0.95) - quantile(heights, 0.05) > 40, 'dunes and basins span tens of metres');
});

test('the hoverbike stays on the sand across the dunes, at cruise and at boost', () => {
  const physics = { groundAt: (x, y, z) => terrain.heightAt(x, z), pushCapsule: () => false, rayDistance: () => Infinity };
  const rng = mulberry32(11);
  for (const boost of [false, true]) {
    let worst = 0, high = 0, n = 0;
    for (let p = 0; p < 50; p++) {
      const bike = new Hoverbike(physics);
      bike.place((rng() * 2 - 1) * 1000, (rng() * 2 - 1) * 1000, rng() * Math.PI * 2);
      const input = { KeyW: true, ShiftLeft: boost };
      for (let i = 0; i < 60 * 12; i++) {
        input.KeyA = (Math.floor(i / 90) + p) % 5 === 0;   // weave now and then
        bike.update(1 / 60, input);
        if (Math.max(Math.abs(bike.pos.x), Math.abs(bike.pos.z)) > INNER) break;
        if (i < 120) continue;   // up to speed
        const clearance = bike.pos.y - terrain.heightAt(bike.pos.x, bike.pos.z) - 1.15;
        worst = Math.max(worst, clearance); n++;
        if (clearance > 1.5) high++;
      }
    }
    // before: 23% of cruising time airborne, up to 22 m above the sand
    if (!boost) assert.ok(worst < 1.5, `cruise: highest ${worst.toFixed(2)} m above hover height`);
    else assert.ok(worst < 5, `boost: highest ${worst.toFixed(2)} m above hover height`);
    // at boost (54 m/s) the odd crest still gives a short skim, never a launch
    const share = boost ? 0.02 : 0.002;
    assert.ok(high / n < share, `${boost ? 'boost' : 'cruise'}: ${(100 * high / n).toFixed(2)}% of the time more than 1.5 m up`);
  }
});
