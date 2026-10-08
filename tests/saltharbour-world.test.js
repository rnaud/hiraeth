import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { SIDE } from '../src/levels/names.js';
import { mapEntries } from '../src/ship/starmap.js';
import { createSaltHarbour, SALT_CONTENT, SHIPS, TOWER, SHIP_SITE } from '../src/levels/salt-harbour.js';

// ------------------------------------------------------------------ the world (src/levels/salt-harbour.js)
let world = null;
const built = () => world ??= (() => {
  const scene = new THREE.Scene(), w = console.warn; console.warn = () => {};
  try { const level = createSaltHarbour(scene); return { scene, level, physics: new Physics(scene, level.ground) }; } finally { console.warn = w; }
})();
const V = (x, y, z) => new THREE.Vector3(x, y, z);

test('the Salt Harbour: off the route, on the map from the start, reached by ?level=saltharbour', () => {
  const L = LEVELS.find((l) => l.id === 'saltharbour');
  assert.ok(L && L.hidden && !L.dev, 'a world, not on the route');
  assert.ok(SIDE.includes('saltharbour') && !ORDER.includes('saltharbour'));
  assert.equal(CONTENT.saltharbour, SALT_CONTENT);
  assert.ok(SALT_CONTENT.story.manual, 'no story to follow: no beacon, and never in the way home');
  const entries = mapEntries({ order: ORDER, levels: LEVELS, side: SIDE, journal: { seen: () => false, storyDone: () => false }, current: 'desert', flag: () => undefined, home: () => true });
  const e = entries.find((x) => x.id === 'saltharbour');
  assert.ok(e && e.known && e.side, 'charted, off the dotted line');
  assert.ok(entries.at(-1).home, 'home still last');
});

test('the Salt Harbour builds: the ship lands on open salt, the traveller beside it, people from three worlds', () => {
  const { level, physics } = built();
  assert.equal(level.id, 'saltharbour');
  const g = (x, z) => level.ground.heightAt(x, z);
  assert.ok(Math.abs(g(SHIP_SITE.x, SHIP_SITE.z)) < 1, 'the ship lands on the flat salt');
  assert.ok(Math.abs(level.spawn.y - g(level.spawn.x, level.spawn.z)) < 0.2, 'the traveller starts on the salt');
  assert.equal(physics.pushCapsule(level.spawn.clone().add(V(0, 0.5, 0)), 0.4, 0.6, 1.8), null, 'nothing in the way where he starts');
  const named = SALT_CONTENT.npcs.filter((p) => p.id && p.world).map((p) => p.id);
  assert.deepEqual(named.sort(), ['corvin', 'marrow', 'pip'], 'Marrow of the desert, Corvin and Pip of the City-Shaft');
  for (const p of SALT_CONTENT.npcs.filter((q) => q.talk)) assert.ok(p.talk.listen?.length >= 3 && !p.talk.nodes && !p.talk.entry, `${p.id}: only words for the harbour, no errands`);
  assert.ok(level.lights.length > 30, 'lamps at the shops and doors');
  assert.equal(SHIPS.filter((s) => !s.id.startsWith('f')).length, 5, 'four along the street and the one stood on its stern');
});

test('the Salt Harbour\'s street is open from the ship to the upright ship, and its hulls are solid', () => {
  const { physics, level } = built();
  // down the middle of the street, nothing in the way, the salt under the feet
  for (let z = 60; z > -330; z -= 3) {
    const y = level.ground.heightAt(0, z);
    assert.equal(physics.pushCapsule(V(0, y + 0.6, z), 0.4, 0.6, 1.8), null, `the street is clear at z ${z}`);
  }
  // walking into a hull from the street stops at its plating
  for (const [x, z, dx] of [[-6, -20, -1], [6, -60, 1], [-6, -210, -1], [6, -240, 1]]) {
    let hit = false;
    // (in quarter-metre steps: the plating is a shell, and a stride could step clean through it)
    for (let s = 0; s < 40 && !hit; s += 0.25) { const p = V(x + dx * s, level.ground.heightAt(x + dx * s, z) + 2.5, z); hit = !!physics.pushCapsule(p, 0.4, 0.6, 1.8); }
    assert.ok(hit, `a hull beside the street at z ${z}`);
  }
});

test('the stair tower climbs to w1\'s deck, the gangway crosses to e1\'s: walked, step by step', () => {
  const { physics, level } = built();
  const w1 = level.ships.w1, e1 = level.ships.e1;
  // the tower: a tread under every step of the way, rising, from the salt to the top landing
  const foot = level.ground.heightAt(TOWER.x, TOWER.z);
  assert.ok(TOWER.top > foot + 30 && Math.abs(TOWER.top - (w1.deckY + 0.35)) < 0.01, 'its top at the deck');
  let tops = 0;
  for (let y = foot + 1; y < TOWER.top; y += 1.2) {
    const yy = physics.groundAt(TOWER.x + 0.11, y + 0.9, TOWER.z + 0.07, 3);
    if (Number.isFinite(yy)) tops++;
  }
  assert.ok(tops > 10, `treads and landings up the tower (${tops})`);
  // the bridge from its top onto the deck, and the deck itself
  const bx = (TOWER.x + w1.on(0.5, w1.S.D - 2).p.x) / 2;
  assert.ok(Math.abs(physics.groundAt(TOWER.x - 2.2, TOWER.top + 2, TOWER.exit, 5) - TOWER.top) < 0.4, 'the bridge leaves the top landing');
  assert.ok(Math.abs(physics.groundAt(w1.S.x + 4, w1.deckY + 3, w1.S.z + 30, 6) - w1.deckY) < 0.3, 'w1\'s deck to walk on');
  assert.ok(Math.abs(physics.groundAt(e1.S.x - 12, e1.deckY + 3, e1.S.z - 14, 6) - e1.deckY) < 0.3, 'e1\'s deck to walk on');
  void bx;
  // the walked gangway: planks all the way across the street, high over it
  const [A, B] = [w1.put(new THREE.Vector3(w1.H.halfB(0.2) * 0.86 - 3, w1.S.D, -0.6 * w1.H.L / 2)), e1.put(new THREE.Vector3(e1.H.halfB(0.58) * 0.76 + 3, e1.S.D, 0.16 * e1.H.L / 2))];
  for (let t = 0.1; t <= 0.9; t += 0.05) {
    const p = A.clone().lerp(B, t), y = physics.groundAt(p.x + 0.05, p.y + 3, p.z + 0.03, 8);
    assert.ok(Number.isFinite(y) && y > 30, `a plank under the gangway at ${t.toFixed(2)} (${y})`);
  }
});
