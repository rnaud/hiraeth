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

// ------------------------------------------------------------------ the world (glass-dunes.js)
const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };
let world = null;
const built = async () => {
  if (world) return world;
  const { LEVELS } = await import('../src/levels/index.js');
  const { Physics } = await import('../src/physics.js');
  const scene = new THREE.Scene();
  const level = quiet(() => LEVELS.find((l) => l.id === 'glassdunes').create(scene));
  return (world = { scene, level, physics: new Physics(scene, level.ground) });
};

test('the Glass Dunes: a detour on the map, off the route, with its people and no quest', async () => {
  const { LEVELS } = await import('../src/levels/index.js');
  const { ORDER, SIDE, TITLES } = await import('../src/levels/names.js');
  const { CONTENT } = await import('../src/levels/content.js');
  const { mapEntries } = await import('../src/ship/starmap.js');
  const meta = LEVELS.find((l) => l.id === 'glassdunes');
  assert.ok(meta && meta.hidden && meta.title === TITLES.glassdunes);
  assert.ok(SIDE.includes('glassdunes') && !ORDER.includes('glassdunes'), 'off the route: nothing to finish, never counted');
  const c = CONTENT.glassdunes;
  assert.ok(c.npcs.length >= 3 && c.relics.names.length === 0 && c.story.manual, 'people, no relics, no quest');
  for (const n of c.npcs) assert.ok(n.lines.every((l) => /^~\w+~ /.test(l)), 'toned lines');
  // the map: the detour charted after the route, known from the start, no signature, before home
  const e = mapEntries({ order: ORDER, side: SIDE, levels: LEVELS, flag: () => false, journal: null, current: 'desert', home: true });
  const g = e.find((x) => x.id === 'glassdunes');
  assert.ok(g && g.known && g.side && !g.signature && !g.done);
  assert.ok(e.indexOf(g) > e.findIndex((x) => x.id === ORDER.at(-1)) && e.at(-1).home, 'after the route, home last');
  assert.equal(e.filter((x) => !x.side && !x.home).length, ORDER.length, 'the route unchanged');
});

test('the Glass Dunes build: the glass solid as drawn, the camps, the arches lit, the ship on its flat', async () => {
  const { level, physics } = await built();
  assert.equal(level.id, 'glassdunes');
  assert.ok(level.ridges.length >= 8 && level.camps.west.length >= 4 && level.camps.north.length >= 4);
  assert.ok(level.lights.length >= 8, 'the kilns, camps and arches glow at night');
  // the ship's flat: level ground round its site, the spawn beside it on the sand
  const H = (x, z) => level.ground.heightAt(x, z), s = level.shipSite;
  for (let a = 0; a < 6.28; a += 0.5) assert.ok(Math.abs(H(s.x + Math.cos(a) * 25, s.z + Math.sin(a) * 25) - H(s.x, s.z)) < 0.6, 'flat for the ship');
  assert.ok(Math.abs(level.spawn.y - H(level.spawn.x, level.spawn.z)) < 0.01);
  // a ridge stops you: a ray along the ground into the giants' cliff hits the glass
  const hit = physics.rayHit(new THREE.Vector3(-120, H(-120, 30) + 6, 30), new THREE.Vector3(-1, 0, 0), 120);
  assert.ok(hit && hit.point.x < -150, `the cliff of the giants is solid (${hit?.point.x})`);
  // and a mound you can stand on: the ray down lands on its glass, over the sand
  const m = level.ridges.find((r) => r.name === 'mound 0'), p = m.ridge.at(m.ridge.length / 2, m.depth * 0.4);
  const top = physics.rayHit(new THREE.Vector3(p.x, 80, p.z), new THREE.Vector3(0, -1, 0), 120);
  assert.ok(top && top.point.y > H(p.x, p.z) + 4, `the mound is stood on where it is drawn (${top?.point.y})`);
  // the ring beyond the edge is drawn only (no collision to pay for), and the edge keeps you inside it
  assert.ok(level.limit < 600);
});

test('the Glass Dunes: what you stand on and climb is the drawn glass (the contact audit)', async () => {
  const { auditContact, formatContact } = await import('../src/contact-audit.js');
  const { scene, physics } = await built();
  const r = quiet(() => auditContact({ physics, scene, max: 12000 }));
  assert.ok(r.checked.walk > 400 && r.checked.wall > 1000, JSON.stringify(r.checked));
  const c = r.counts;
  // (known: the camps' awnings and floats are drawn only; the kiln's mouth; the sand banked at a stone's foot)
  assert.ok((c['feet sink'] ?? 0) <= 12 && (c['feet hover'] ?? 0) <= 6 && (c['climbs inside'] ?? 0) <= 12 && (c['walks through'] ?? 0) <= 30, formatContact(r));
});
