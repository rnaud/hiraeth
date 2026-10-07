import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { glassRidge, silhouetteAt, SHAPES, PROFILES, GLASS, awningCamp, glassArch, boulders } from '../src/levels/glass-dunes-kit.js';
import { REFERENCE_WORLDS } from '../src/levels/reference-worlds.js';

// The Glass Dunes: the kit (glass-dunes-kit.js), the References' four plates (reference-glassdunes.js)

test('a glass ridge: finite, coloured, its face looking out, its ends sunk in the sand', () => {
  const H = (x, z) => 0.02 * x;
  const r = glassRidge({ path: [[-60, 0], [0, -10], [60, 0]], height: 40, depth: 50, profile: 'wave', H, silhouettes: [{ shape: 'giant', u: 60, y: 2, s: 20 }] });
  const p = r.geo.attributes.position, c = r.geo.attributes.color, n = r.geo.attributes.normal;
  assert.ok(p.count > 1000 && c.count === p.count && n.count === p.count);
  for (const a of [p.array, c.array, n.array]) assert.ok(a.every(Number.isFinite), 'no NaN');
  // the middle section: its face's normals look out of the ridge (away from `into`)
  const mid = r.at(r.length / 2);
  let out = 0, k = 0;
  for (let i = 0; i < p.count; i++) {
    const dx = p.getX(i) - mid.x, dz = p.getZ(i) - mid.z;
    if (dx * dx + dz * dz < 144 && p.getY(i) > 5 && p.getY(i) < 20) { k++; out += n.getX(i) * mid.nx + n.getZ(i) * mid.nz < 0 ? 1 : 0; }
  }
  assert.ok(k > 3 && out / k > 0.8, `the face looks out (${out}/${k})`);
  // as high as asked in the middle, low at its ends
  let top = -Infinity, endTop = -Infinity;
  const a0 = r.at(0);
  for (let i = 0; i < p.count; i++) {
    top = Math.max(top, p.getY(i));
    if (Math.hypot(p.getX(i) - a0.x, p.getZ(i) - a0.z) < 3) endTop = Math.max(endTop, p.getY(i));
  }
  assert.ok(top > 30 && top < 60, `crest ${top}`);
  assert.ok(endTop < 12, `the ends sink into the sand (${endTop})`);
  // the silhouette darkens what lies inside it
  let dark = 0;
  for (let i = 0; i < c.count; i++) if (c.getY(i) < new THREE.Color(GLASS.foot).g * 0.6) dark++;
  assert.ok(dark > 20, 'the giant held inside is printed darker');
});

test('silhouettes: inside 1, outside 0, a soft edge; every shape and profile is usable', () => {
  const sil = SHAPES.head(0, 0, 20);
  assert.equal(silhouetteAt(sil, 0, 15), 1);
  assert.equal(silhouetteAt(sil, 60, 15), 0);
  const edge = silhouetteAt(sil, 10, 15, 3);
  assert.ok(edge > 0 && edge < 1, 'soft at its edge');
  for (const name of Object.keys(SHAPES)) assert.ok(SHAPES[name](0, 0, 10).every((e) => e.length === 4 && e[2] > 0 && e[3] > 0), name);
  for (const [name, pts] of Object.entries(PROFILES)) {
    assert.ok(pts[0][1] < 0 && pts.at(-1)[1] < 0.05, `${name}: both feet at the ground`);
    assert.ok(Math.max(...pts.map((q) => q[1])) >= 1, `${name}: reaches its height`);
  }
});

test('the camp, the arches and the stones are drawn whole', () => {
  const adds = [];
  const kit = { add: (m, g, o) => { adds.push({ m, g, o }); return g; }, H: () => 1 };
  const M = { pole: 'pole', cloth: ['c1', 'c2'], rug: ['r'], crate: 'crate', float: 'float', kiln: 'kiln', dark: 'dark', glass: 'glass', light: 'light' };
  let s = 1; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const spots = awningCamp(kit, M, rng, { x: 0, z: 0, w: 12, n: 4 });
  assert.equal(spots.length, 4, 'a place to stand under each awning');
  glassArch(kit, M, { x: 0, z: -10, w: 6, h: 9 });
  boulders(kit, 'rock', rng, { x: 0, z: 0, r: 10, n: 8 });
  for (const { g } of adds) assert.ok(g.attributes.position.array.every(Number.isFinite), 'finite');
  assert.ok(adds.some((a) => a.m === 'glass' && a.g.attributes.color), 'the arch\'s rim carries its colours (vertex-coloured glass)');
  assert.ok(adds.filter((a) => a.m === 'c1' || a.m === 'c2').length === 4, 'four awnings');
});

test('the References: the Glass Dunes\' four plates, one view each, registered at the end, their sheets on disk', async () => {
  const w = REFERENCE_WORLDS.find((x) => x.id === 'glassdunes');
  assert.ok(w && w.name === 'The Glass Dunes' && w.count === 4);
  const { SHEETS, VIEWS } = await w.load();
  assert.equal(VIEWS.length, 4);
  assert.deepEqual(VIEWS.map((v) => v.sheet), ['glassdunes-1', 'glassdunes-2', 'glassdunes-3', 'glassdunes-4']);
  for (const v of VIEWS) {
    const S = SHEETS[v.sheet];
    assert.ok(S.name.startsWith('The Glass Dunes / '), 'grouped under the world in the quick menu');
    assert.ok(existsSync(fileURLToPath(S.url)), `${v.sheet}: the plate is on disk`);
    assert.deepEqual(v.crop, [0, 0, ...S.size], 'the whole plate');
    // the view builds: finite geometry, something glass in it
    const adds = [];
    const kit = { add: (m, g) => { adds.push({ m, g }); return g; }, H: v.ground.height, mat: (o) => o, group: { children: [], add() {} }, rng: Math.random, light() {} };
    v.build(kit, v);
    assert.ok(adds.length > 20, `${v.id}: something stands in it`);
    assert.ok(adds.some((a) => a.m.vertexColors), `${v.id}: glass`);
    for (const { g } of adds) assert.ok(g.attributes.position.array.every(Number.isFinite), `${v.id}: finite`);
  }
});
