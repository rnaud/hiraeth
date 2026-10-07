import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { glassRidge, silhouetteAt, silhouetteDistance, SHAPES, PROFILES, GLASS, awningCamp, glassArch, glassPassage, glassPools, boulders } from '../src/levels/glass-dunes-kit.js';
import { makeMaterial } from '../src/materials.js';
import { GLASS_ATTR } from '../src/dune-glass-shader.js';
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
  // the silhouette: its signed distance in the glass shader's attribute, negative inside (the shader cuts it hard)
  const g = r.geo.attributes[GLASS_ATTR];
  assert.ok(g && g.itemSize === 4 && g.count === p.count && g.array.every(Number.isFinite));
  let inside = 0, thin = 0;
  for (let i = 0; i < g.count; i++) { if (g.getX(i) < 0) inside++; if (g.getY(i) > 0.5) thin++; }
  assert.ok(inside > 20, 'the giant held inside');
  assert.ok(thin > 20 && thin < g.count * 0.8, 'thin glass at its foot and ends, not everywhere');
  void GLASS;
});

test('a passage through a ridge: its opening cut from both faces, a vault through it', () => {
  const H = () => 0;
  const plain = glassRidge({ path: [[-60, 0], [0, 0], [60, 0]], height: 40, depth: 30, profile: 'cliff', H, step: 1.5 });
  const r = glassRidge({ path: [[-60, 0], [0, 0], [60, 0]], height: 40, depth: 30, profile: 'cliff', H, step: 1.5, passages: [{ at: [0, 0], w: 8, h: 10 }] });
  assert.ok(r.geo.index.count < plain.geo.index.count, 'triangles cut out');
  const q = r.passages[0];
  assert.ok(Math.abs(q.x) < 2 && Math.abs(q.z) < 0.5 && q.h === 10 && q.d > 20, JSON.stringify(q));
  // no triangle of the ridge left inside the opening (u within the arch's legs, low)
  const p = r.geo.attributes.position, ix = r.geo.index;
  for (let t = 0; t < ix.count; t += 3) {
    let cx = 0, cy = 0;
    for (let k = 0; k < 3; k++) { cx += p.getX(ix.getX(t + k)) / 3; cy += p.getY(ix.getX(t + k)) / 3; }
    assert.ok(!(Math.abs(cx) < 3 && cy > 0.5 && cy < 7), `a triangle left in the opening at ${cx.toFixed(1)}, ${cy.toFixed(1)}`);
  }
  const v = glassPassage(q);
  assert.ok(v.attributes.position.array.every(Number.isFinite) && v.attributes.color && v.attributes[GLASS_ATTR]);
  const b = new THREE.Box3().setFromBufferAttribute(v.attributes.position);
  assert.ok(b.max.y > 10 && b.max.y < 14 && b.max.z - b.min.z > q.d, 'the vault spans the ridge, as high as the arch and its thickness');
});

test('the glass and its sand: the shader\'s defines, the pools of light at a wall\'s foot', () => {
  const m = makeMaterial({ color: '#ffffff', vertexColors: true, duneGlass: true });
  assert.ok(m.defines.DUNE_GLASS && m.uniforms.uDuneMint && m.defaultAttributeValues[GLASS_ATTR].length === 4);
  const sand = makeMaterial({ color: '#f2c99c', mode: 1, dunePool: true });
  assert.ok(sand.defines.DUNE_POOL && sand.uniforms.uPoolMint);
  const r = glassRidge({ path: [[-60, 0], [0, 0], [60, 0]], height: 30, depth: 20, profile: 'cliff', H: () => 0 });
  const ground = new THREE.PlaneGeometry(200, 200, 50, 50).rotateX(-Math.PI / 2);
  glassPools(ground, [r]);
  const a = ground.attributes[GLASS_ATTR], pos = ground.attributes.position;
  let near = null, far = null;
  for (let i = 0; i < a.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    if (Math.abs(x) < 3 && Math.abs(z + 4) < 3) near = [a.getX(i), a.getY(i), a.getZ(i)];
    if (Math.abs(x) < 3 && Math.abs(z + 90) < 3) far = a.getX(i);
  }
  assert.ok(near[0] > 0.5 && near[2] > 0.5, `near the front foot: lit, the wall toward +z (${near})`);
  assert.equal(far, 0, 'far from any wall: none');
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
  const kit = { add: (m, g, o) => { adds.push({ m, g, o }); return g; }, mesh: (g, m, o) => { adds.push({ m, g, o }); return {}; }, H: () => 1 };
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
    const kit = { add: (m, g) => { adds.push({ m, g }); return g; }, mesh: (g, m) => { adds.push({ m, g }); return {}; }, H: v.ground.height, mat: (o) => o, group: { children: [], add() {} }, rng: Math.random, light() {} };
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
  // the passages: walk through the cliff of the giants and through the frozen wave, along their vaults
  for (const name of ['giants', 'wave']) {
    const q = level.ridges.find((r) => r.name === name).ridge.passages[0];
    const from = new THREE.Vector3(q.x - q.nx * 6, q.y + 1.6, q.z - q.nz * 6), dir = new THREE.Vector3(q.nx, 0, q.nz);
    const through = physics.rayHit(from, dir, q.d + 10);
    assert.ok(!through, `${name}: the way through is open (${through?.point.toArray().map((v) => v.toFixed(1))})`);
    const side = new THREE.Vector3(-q.nz, 0, q.nx), beside = from.clone().addScaledVector(side, q.w / 2 + 6);
    assert.ok(physics.rayHit(beside, dir, q.d + 10), `${name}: beside the archway, the glass`);
    const up = physics.rayHit(new THREE.Vector3(q.x + q.nx * q.d / 2, q.y + 1.6, q.z + q.nz * q.d / 2), new THREE.Vector3(0, 1, 0), 30);
    assert.ok(up && up.point.y < q.y + q.h + 1, `${name}: the vault's roof over you`);
  }
  // the breaking wave's hollow: from the north camp you walk on into it, a long way under its lip
  const into = physics.rayHit(new THREE.Vector3(10, H(10, -195) + 1.6, -195), new THREE.Vector3(0, 0, -1), 200);
  assert.ok(into && into.point.z < -240, `the hollow goes in (${into?.point.z})`);
  const lip = physics.rayHit(new THREE.Vector3(10, H(10, -238) + 1.6, -238), new THREE.Vector3(0, 1, 0), 200);
  assert.ok(lip && lip.point.y > H(10, -238) + 20, `the lip overhead (${lip?.point.y})`);
  // the ring beyond the edge is drawn only (no collision to pay for), and the edge keeps you inside it
  assert.ok(level.limit < 600);
});

test('the Glass Dunes: what you stand on and climb is the drawn glass (the contact audit)', async () => {
  const { auditContact, formatContact } = await import('../src/contact-audit.js');
  const { scene, physics } = await built();
  const r = quiet(() => auditContact({ physics, scene, max: 12000 }));
  assert.ok(r.checked.walk > 400 && r.checked.wall > 1000, JSON.stringify(r.checked));
  const c = r.counts;
  // (known: the camps' awnings and floats are drawn only; the kiln's mouth; the sand banked at a stone's foot;
  //  the archways' drawn-only rims that took 5 climbs are passages now)
  assert.ok((c['feet sink'] ?? 0) <= 12 && (c['feet hover'] ?? 0) <= 6 && (c['climbs inside'] ?? 0) <= 4 && (c['walks through'] ?? 0) <= 8, formatContact(r));
});
