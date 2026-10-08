// The City Floating in Space, the world (src/levels/space-city.js; docs/systems/worlds.md): registered off the route,
// built without errors, every deck and bridge underfoot and the way through clear, the edges walled, the void below.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { SIDE } from '../src/levels/names.js';
import { mapEntries } from '../src/ship/starmap.js';
import { createSpaceCity, SPACECITY_CONTENT, ISLANDS, BRIDGES, LANES, SHIP_SITE, UNSAFE_Y, PLAZA, CROWD_LINES, PLANET } from '../src/levels/space-city.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
let world = null;
const built = () => world ??= (() => {
  const scene = new THREE.Scene(), w = console.warn, e = console.error, errors = [], warns = []; console.warn = (...a) => warns.push(a.join(' ')); console.error = (...a) => errors.push(a.join(' '));
  try { const level = createSpaceCity(scene); return { scene, level, physics: new Physics(scene, level.ground), errors, warns }; } finally { console.warn = w; console.error = e; }
})();
const clearAt = (physics, p, y) => physics.pushCapsule(new THREE.Vector3(p.x, y + 0.05, p.z), 0.35, 0.6, 1.9) === null;
const line = (a, b, step = 1) => { const A = V(...a), B = V(...b), n = Math.max(1, Math.ceil(A.distanceTo(B) / step)); return Array.from({ length: n + 1 }, (_, i) => A.clone().lerp(B, i / n)); };
const deckAt = (physics, p, from = 4) => physics.groundAt(p.x + 0.03, p.y + from, p.z + 0.02, from + 3);

test('the City Floating in Space: off the route, on the map from the start, reached by ?level=spacecity', () => {
  const L = LEVELS.find((l) => l.id === 'spacecity');
  assert.ok(L && L.hidden && !L.dev, 'a world, not on the route');
  assert.ok(SIDE.includes('spacecity') && !ORDER.includes('spacecity'));
  assert.equal(CONTENT.spacecity, SPACECITY_CONTENT);
  assert.ok(SPACECITY_CONTENT.story.manual, 'no story to follow: no beacon, never in the way home');
  const entries = mapEntries({ order: ORDER, levels: LEVELS, side: SIDE, journal: { seen: () => false, storyDone: () => false }, current: 'desert', flag: () => undefined, home: () => true });
  const e = entries.find((x) => x.id === 'spacecity');
  assert.ok(e && e.known && e.side, 'charted, off the dotted line');
  assert.ok(entries.at(-1).home, 'home still last');
  const named = SPACECITY_CONTENT.npcs.filter((p) => p.id && p.world).map((p) => p.id).sort();
  assert.deepEqual(named, ['kip', 'nima', 'sel'], 'Kip and Madame Sel of the Signal Market, Nima of the City-Shaft');
  for (const p of SPACECITY_CONTENT.npcs.filter((q) => q.talk)) assert.ok(p.talk.listen?.length >= 3 && !p.talk.nodes, `${p.id}: only words for the city, no errands`);
  for (const p of SPACECITY_CONTENT.npcs) for (const l of p.lines) assert.match(l, /^~[a-z]+~ /, 'every line toned');
  for (const l of CROWD_LINES) assert.match(l, /^~[a-z]+~ /);
  assert.ok(PLANET.size > 15 && PLANET.craters === false, 'a great plain planet over the roofs');
});

test('the City Floating in Space builds: the Pier under the ship, every island\'s deck and every bridge underfoot, the people on them', () => {
  const { level, physics, errors } = built();
  assert.equal(level.id, 'spacecity');
  assert.deepEqual(errors, [], 'no errors building it');
  assert.equal(level.ground.heightAt(0, 0), -Infinity, 'no ground: only the decks');
  assert.ok(Math.abs(deckAt(physics, level.spawn) - ISLANDS.pier.y) < 0.1, 'the traveller starts on the Pier');
  for (let a = 0; a < 6.3; a += 0.5) for (const r of [0, 8, 16]) assert.ok(Math.abs(deckAt(physics, V(SHIP_SITE.x + Math.cos(a) * r, 0, SHIP_SITE.z + Math.sin(a) * r))) < 0.08, 'the landing is flat');
  for (const [k, I] of Object.entries(ISLANDS)) {
    const L = LANES[k], p = L.circles[0] ? V(L.circles[0][0] + 0.3, I.y, L.circles[0][1] + 0.2) : V(I.x, I.y, I.z);
    assert.ok(Math.abs(deckAt(physics, p) - I.y) < 0.1, `${k}: its deck at ${I.y}`);
  }
  // every bridge: a deck from end to end at its height (and its hump), the way along it clear
  for (const B of BRIDGES) for (let t = 0; t <= 1.0001; t += 0.05) {
    const [x, y, z] = B.at(t), g = physics.groundAt(x + 0.03, y + 3, z + 0.02, 6);
    assert.ok(Math.abs(g - y) < 0.12, `${B.name} holds at ${t.toFixed(2)} (${g?.toFixed(2)} for ${y.toFixed(2)})`);
    assert.ok(clearAt(physics, V(x, y, z), g), `${B.name} is clear at ${t.toFixed(2)}`);
  }
  // the people stand on something
  for (const p of SPACECITY_CONTENT.npcs) {
    const top = physics.groundAt(p.at[0] + 0.03, p.y + 2, p.at[1] + 0.02, 6);
    assert.ok(Math.abs(top - p.y) < 0.3, `${p.id ?? p.lines[0]} stands on it (${top?.toFixed(2)} for ${p.y})`);
  }
  assert.ok(level.lights.length > 20, 'lamps, lit doors, the glows under the islands');
});

test('the way through the city is clear: from the ship along the lanes and over the bridges to the Balcony, the Towers and the Garden', () => {
  const { physics } = built();
  const Y = (k) => ISLANDS[k].y;
  const legs = [
    [[4, 0, 110], [0, 0, ISLANDS.pier.z - 24]], [[0, 0, 56], [0, 0, 8]],      // the Pier, the Gate's lane
    [[0, 0, -42], [0, 0, -104]], [[-34, 0, -66.5], [34, 0, -73.5]],           // the Market's lanes, across the plaza
    [[0, 0, -146], [0, 0, -178]],                                            // the Balcony's lane, to the railing
    [[77, Y('towers'), -80.2], [100, Y('towers'), -83.8]], [[-73, Y('garden'), -61.8], [-94, Y('garden'), -58.4]],
  ];
  for (const [a, b] of legs) for (const p of line(a, b, 1)) {
    const g = deckAt(physics, p);
    assert.ok(Number.isFinite(g) && Math.abs(g - p.y) < 0.15, `a deck at ${p.x.toFixed(1)}, ${p.z.toFixed(1)} (${g?.toFixed(2)})`);
    assert.ok(clearAt(physics, p, g), `the way is clear at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
  }
  for (let a = 0; a < 6.3; a += 0.6) { const p = V(PLAZA.x + Math.cos(a) * 6, 0, PLAZA.z + Math.sin(a) * 6); assert.ok(clearAt(physics, p, deckAt(physics, p)), 'the plaza is open round its middle'); }
});

test('the edge: a parapet round every island but where a bridge lands; off it, the void puts you back', () => {
  const { level, physics } = built();
  let walled = 0, open = 0;
  for (const [k, I] of Object.entries(ISLANDS)) {
    const D = level.islands[k];
    for (let a = 0; a < Math.PI * 2; a += 0.21) {
      // just inside the edge along the ray at a
      let lo = 0, hi = Math.max(I.w, I.d);
      for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (D.inside(I.x + Math.cos(a) * m, I.z + Math.sin(a) * m)) lo = m; else hi = m; }
      const p = V(I.x + Math.cos(a) * (lo - 0.25), I.y, I.z + Math.sin(a) * (lo - 0.25));
      if (BRIDGES.some((B) => [B.a, B.b].some(([x, , z]) => Math.hypot(x - p.x, z - p.z) < B.w / 2 + 1.6))) { open++; continue; }
      assert.ok(!clearAt(physics, p, I.y), `${k}: the edge is walled at angle ${a.toFixed(2)}`);
      walled++;
    }
  }
  assert.ok(walled > 100 && open >= 4, `${walled} walled, ${open} open to bridges`);
  assert.ok(level.unsafe(V(0, UNSAFE_Y - 1, 0)) && !level.unsafe(V(0, 0, 0)) && !level.unsafe(V(-92, -4, -60)), 'below the islands is the void; the decks are safe');
  assert.equal(level.features.jetpack, false, 'no jets: a fall is a fall');
});
