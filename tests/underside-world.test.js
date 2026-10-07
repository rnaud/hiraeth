import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { SIDE } from '../src/levels/names.js';
import { mapEntries } from '../src/ship/starmap.js';
import {
  createUnderside, UNDERSIDE_CONTENT, SHELF, BASE, DECK, LOW, MEADOW, STAIR, LANDING, WALK, GALLERY_S, GALLERY_N, CROSS, PLAZA, TIP, BASKET, BASKET_STAIR, NORTH_STAIR, SHIP_SITE, CLOUD_Y,
} from '../src/levels/underside.js';

// ------------------------------------------------------------------ the world (src/levels/underside.js)
let world = null;
const built = () => world ??= (() => {
  const scene = new THREE.Scene(), w = console.warn; console.warn = () => {};
  try { const level = createUnderside(scene); return { scene, level, physics: new Physics(scene, level.ground) }; } finally { console.warn = w; }
})();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clear = (physics, x, y, z) => physics.pushCapsule(V(x, y + 0.6, z), 0.4, 0.6, 1.8) === null;
/** Whether the traveller's own body (player.js: 0.45 m round, from 0.6 m over the feet to 2.2) fits there: a rail stops it. */
const fits = (physics, x, y, z) => physics.pushCapsule(V(x, y, z), 0.45, 0.6, 2.2) === null;
/** The ground under (x, z) from a little over y, and whether one stands there clear. */
const at = (physics, x, y, z) => { const h = physics.groundAt(x, y + 1.5, z, 4); return { h, ok: Math.abs(h - y) < 0.35 && clear(physics, x, h, z) }; };
const along = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);

test('the Underside: off the route, on the map from the start, reached by ?level=underside', () => {
  const L = LEVELS.find((l) => l.id === 'underside');
  assert.ok(L && L.hidden && !L.dev, 'a world, not on the route');
  assert.ok(SIDE.includes('underside') && !ORDER.includes('underside'));
  assert.equal(CONTENT.underside, UNDERSIDE_CONTENT);
  assert.ok(UNDERSIDE_CONTENT.story.manual, 'no story to follow: no beacon');
  const entries = mapEntries({ order: ORDER, levels: LEVELS, side: SIDE, journal: { seen: () => false, storyDone: () => false }, current: 'desert', flag: () => undefined, home: () => true });
  const e = entries.find((x) => x.id === 'underside');
  assert.ok(e && e.known && e.side, 'charted, off the dotted line');
  assert.ok(entries.at(-1).home, 'home still last');
});

test('the shelf builds: the ship on its top, people from three worlds, the cloud far below', () => {
  const { level, physics } = built();
  assert.equal(level.id, 'underside');
  const top = SHELF.top + MEADOW;
  assert.ok(Math.abs(physics.groundAt(SHIP_SITE.x, top + 20, SHIP_SITE.z, 40) - top) < 0.05, 'the ship lands on the flat top');
  for (const [dx, dz] of [[-12, 0], [12, 0], [0, -12], [0, 12]]) assert.ok(Math.abs(physics.groundAt(SHIP_SITE.x + dx, top + 20, SHIP_SITE.z + dz, 40) - top) < 0.05, 'and the top is flat round it');
  assert.ok(Math.abs(level.spawn.y - top) < 0.2 && clear(physics, level.spawn.x, top, level.spawn.z), 'nothing in the way where he starts');
  const named = UNDERSIDE_CONTENT.npcs.filter((p) => p.id).map((p) => p.id);
  assert.deepEqual(named.sort(), ['kip', 'pip.garage', 'tiv']);
  for (const p of UNDERSIDE_CONTENT.npcs.filter((q) => q.talk)) assert.ok(p.talk.listen?.length >= 3 && !p.talk.nodes && !p.talk.entry, `${p.id}: only words for the town, no errands`);
  // every one of them stands on what is drawn at their level
  for (const p of UNDERSIDE_CONTENT.npcs) {
    const y = p.y ?? DECK, h = physics.groundAt(p.at[0], y + 1.5, p.at[1], 4);
    assert.ok(Number.isFinite(h) && Math.abs(h - y) < 0.6, `someone at ${p.at} stands on ground (${h} vs ${y})`);
  }
  assert.ok(level.lights.length > 60, `lamps everywhere (${level.lights.length})`);
  assert.ok(level.killY > CLOUD_Y && level.killY < LOW - 30, 'a fall into the cloud puts you back');
  assert.equal(level.ground.heightAt(80, -140), -600, 'no ground but the cloud, far below');
});

test('the way down: the great stair, a tread under every step, the landing, the rope walk into the town', () => {
  const { physics } = built();
  let last = -Infinity;
  for (let i = 1; i < STAIR.n; i += 3) {
    const z = STAIR.foot - (i - 0.5) * STAIR.run, y = physics.groundAt(STAIR.x, SHELF.top + 2, z, SHELF.top + 4);
    assert.ok(y >= last - 1e-6 && Math.abs(y - (DECK + i * STAIR.rise)) < 0.3, `a step at z ${z.toFixed(1)} (${y})`);
    assert.ok(clear(physics, STAIR.x, y, z), `and room to walk it at z ${z.toFixed(1)}`);
    last = y;
  }
  // its parapet on the open (east) side
  let hit = false;
  for (let s = 0; s < 6 && !hit; s += 0.25) hit = !fits(physics, STAIR.x + s, DECK + 80 * STAIR.rise, STAIR.foot - 79.5 * STAIR.run);
  assert.ok(hit, 'a parapet beside the stair');
  for (const [x, z] of along([LANDING.x0 + 3, LANDING.z1 - 3], [LANDING.x1 - 3, LANDING.z0 + 3], 5)) assert.ok(at(physics, x, DECK, z).ok, `the landing at ${x}, ${z}`);
  for (const [x, z] of along([11, WALK.z1 - 1], [11, WALK.z0 + 1], 30)) assert.ok(at(physics, x, DECK, z).ok, `the rope walk at z ${z.toFixed(1)}`);
});

test('under the shelf: the galleries, the cross decks, the Bell Deck and the tip deck, all walked and all clear', () => {
  const { physics } = built();
  const walk = (name, a, b, n, y = DECK) => { for (const [x, z] of along(a, b, n)) { const r = at(physics, x, y, z); assert.ok(r.ok, `${name} at ${x.toFixed(1)}, ${z.toFixed(1)} (${r.h})`); } };
  walk('the south gallery', [GALLERY_S.x0 + 2, -59], [GALLERY_S.x1 - 2, -59], 50);
  walk('the north gallery', [GALLERY_N.x0 + 2, -232], [GALLERY_N.x1 - 2, -232], 40);
  for (const c of CROSS) walk(`the cross deck at ${c.x0}`, [(c.lane[0] + c.lane[1]) / 2, c.z1 - 1], [(c.lane[0] + c.lane[1]) / 2, c.z0 + 1], 50);
  walk('the Bell Deck', [PLAZA.x0 + 12, PLAZA.z0 + 4], [PLAZA.x1 - 12, PLAZA.z0 + 4], 16);
  walk('the tip deck', [TIP.x0 + 1, -146], [TIP.x1 - 1, -146], 16);
  // the basket deck below, down its stair from the landing on the gallery's edge
  walk('the basket deck', [BASKET.x0 + 1, -48], [BASKET.x1 - 1, -48], 10, LOW);
  const [a, b] = [BASKET_STAIR.from, BASKET_STAIR.to];
  for (let i = 1; i < 10; i++) { const t = i / 10, x = a[0] + (b[0] - a[0]) * t, y = physics.groundAt(x, DECK + 2, a[2], 12); assert.ok(Math.abs(y - (a[1] + (b[1] - a[1]) * t)) < 0.35, `the basket stair at x ${x.toFixed(1)} (${y})`); }
  // headroom under the rock everywhere on the main decks: the lobes stay over a walker's head
  for (const [x, z] of [[60, -64], [40, -150], [90, -145], [132, -100], [160, -146], [100, -230]]) {
    const up = new THREE.Raycaster(V(x, DECK + 0.2, z), V(0, 1, 0), 0, 20), hits = up.intersectObjects(built().scene.children, true).filter((h) => !h.object.userData.noCollide);
    assert.ok(!hits.length || hits[0].distance > 2.6, `room overhead at ${x}, ${z} (${hits[0]?.distance})`);
  }
});

test('the way back up: the timber stair climbs the north face, flight by flight, to the top', () => {
  const { physics } = built();
  const NS = NORTH_STAIR, rise = (SHELF.top - DECK) / NS.flights;
  for (let k = 0; k < NS.flights; k++) {
    const lane = k % 2 ? NS.laneB : NS.laneA, z = (lane[0] + lane[1]) / 2, east = k % 2 === 0;
    const y0 = DECK + k * rise, x = east ? NS.x0 + 4 : NS.x1 - 4, y = physics.groundAt(x, y0 + rise + 1, z, rise + 2);
    assert.ok(y > y0 + 0.5 && y < y0 + rise, `flight ${k + 1} at x ${x} (${y})`);
  }
  assert.ok(at(physics, NS.x0 - 1.2, DECK, NS.laneA[1] - 0.4).ok, 'its foot, off the gallery');
  assert.ok(at(physics, NS.x0 - 1.2, SHELF.top, SHELF.zN - 2).ok, 'its bridge onto the top');
  assert.ok(Math.abs(physics.groundAt(NS.x0 - 1.2, SHELF.top + 3, SHELF.zN + 12, 6) - (SHELF.top + MEADOW)) < 0.3, 'and the top beyond it');
});

test('railed where it drops away: walking off a deck\'s open edge stops at a rail', () => {
  const { physics } = built();
  for (const [x, y, z, dx, dz] of [[100, DECK, -60, 0, 1], [160, DECK, -146, 1, 0], [100, DECK, -232, 0, -1], [80, LOW, -46, 0, 1], [40, DECK, -110, -1, 0], [11, DECK, -10, 1, 0]]) {
    let hit = false;
    for (let s = 0; s < 30 && !hit; s += 0.25) hit = !fits(physics, x + dx * s, y, z + dz * s);
    assert.ok(hit, `a rail beside ${x}, ${z}`);
  }
});

test('the town lives: baskets go up and down their ropes; the build stays in its budgets', () => {
  const { level, scene } = built();
  const moving = [];
  scene.traverse((o) => { if (o.userData.dynamic && o.isGroup) moving.push(o); });
  assert.ok(moving.length >= 4, `baskets (${moving.length})`);
  const y0 = moving.map((m) => m.position.y);
  level.update(0.016, 0); const ya = moving.map((m) => m.position.y);
  level.update(0.016, 20); const yb = moving.map((m) => m.position.y);
  assert.ok(ya.some((y, i) => Math.abs(y - yb[i]) > 0.5), 'they move');
  assert.ok(yb.every((y) => y < DECK && y > -50), 'between the decks and the cloud');
  void y0;
  let tris = 0, solid = 0, meshes = 0;
  scene.traverse((o) => { if (!o.isMesh) return; meshes++; const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); tris += n; if (!o.userData.noCollide) solid += n; });
  assert.ok(meshes < 110, `merged by material (${meshes} meshes)`);
  assert.ok(tris < 950_000, `triangles (${Math.round(tris / 1000)} k)`);
  assert.ok(solid < 200_000, `collision triangles (${Math.round(solid / 1000)} k)`);
  assert.ok(BASE - DECK > 8, 'the decks well under the rock');
});
