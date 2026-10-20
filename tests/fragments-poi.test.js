// The fragments of the singing light in and on the worlds' places of interest (issue #250: "Fragments of the singing
// light should often be within points of interest or at the top of structures hard to climb. Like at the top of the big
// temples in the sphere levels, or within the skeletons in the desert level."; docs/systems/fragments.md). Each route
// world is built as the contact audit builds it (tests/built-worlds.js) and its places of interest gathered as
// scripts/fragment-spots.mjs scores them (tests/fragments-reach.js pointsOfInterest: by a sight, up a beacon, inside a
// named thing's bounds or one of the level's big pieces, on a summit).
import test from 'node:test';
import assert from 'node:assert/strict';
import { builtWorld } from './built-worlds.js';
import { pointsOfInterest, poiAt, POI_THINGS, POI_PIECES, onPlace, placeCap, wetAt, PLACE_CAP } from './fragments-reach.js';
import { FRAGMENT_MARKERS, markerName, buildFragmentMarkers, MARKER_HEIGHT } from '../src/fragment-markers.js';
import { Waters } from '../src/water.js';
import * as THREE from 'three';
import { FRAGMENTS, FRAGMENTS_PER_WORLD, FRAGMENT_PLACES } from '../src/fragments-data.js';
import { RUMOUR_PLACES } from '../src/story/rumour-places.js';
import { ORDER } from '../src/levels/names.js';

/**
 * How many of a world's lie in or on a place of interest, at least: half (4 of 8 in v1.66; 12 of 24 since v1.70, issue
 * #317), the Desert's two easy ones by the ship among the rest. Four worlds have fewer places off the route than that
 * holds (each place takes two or three at most, 20 m and more apart, or they would be one find): Lorn's keepers' country
 * and its shroom caps (the rest of its sights stand in deep water), the Buried Machine's gangway, posts and oil fall,
 * the Floating city's few islands, the Signal Market's towers; they hold what they have, and the other worlds more.
 */
export const POI_SHARE = 12;
export const POI_MIN = { perdide: 7, buried: 9, spacecity: 11, bazaar: 8 };
/** And of all of them, at least half (of 96 in v1.66, 56 held; of 288 since v1.70, 150). */
export const POI_TOTAL = 144;

const placed = new Map();
const world = (id) => {
  if (!placed.has(id)) {
    const W = builtWorld(id);
    const pois = pointsOfInterest(W, id);
    placed.set(id, { pois, physics: W.physics, waters: new Waters(W.scene, { physics: W.physics }), at: FRAGMENTS[id].map(([x, y, z]) => poiAt(pois, W.physics, x, y, z)) });
  }
  return placed.get(id);
};

test('every world hides half its fragments or more in or on a place of interest (or all its places hold), and over half of them all are', () => {
  const short = [], seen = [];
  let all = 0;
  for (const id of ORDER) {
    const { at } = world(id);
    const n = at.filter(Boolean).length;
    all += n;
    seen.push(`${id} ${n}/${FRAGMENTS_PER_WORLD}: ${at.map((p, i) => `${i} ${p?.name ?? '-'}`).join(', ')}`);
    if (n < (POI_MIN[id] ?? POI_SHARE)) short.push(`${id}: ${n} of ${FRAGMENTS_PER_WORLD} in or on a place of interest`);
  }
  assert.deepEqual(short, [], seen.join('\n'));
  assert.ok(all >= POI_TOTAL, `${all} of ${FRAGMENTS_PER_WORLD * ORDER.length} in or on a place of interest (at least ${POI_TOTAL})\n${seen.join('\n')}`);
  console.log(seen.map((l) => l.split(':')[0]).join('\n'), `\nall told: ${all}`);
});

// Issue #550 ("fragment of lights should be in a place that makes sense, like the top of a building, or the center of a
// point of interest, right now they feel like a bit of random placement"): every one of them, not half, ON the named
// place src/fragments-data.js FRAGMENT_PLACES gives it (tests/fragments-reach.js onPlace: at a sight's mark, on a named
// thing or in its middle, a raised spot on a floor-like one, in a piece of the level or on a marker set for it: never a
// bare summit, a ledge or a nook), out of the water, and the people say that place when they tell of it.
test('every fragment stands on its named place, out of the water, never a bare spot (issue #550)', () => {
  const off = [];
  for (const id of ORDER) {
    const { pois, physics, waters } = world(id);
    const names = FRAGMENT_PLACES[id] ?? [];
    if (names.length !== FRAGMENTS[id].length) off.push(`${id}: ${names.length} places for ${FRAGMENTS[id].length} fragments`);
    FRAGMENTS[id].forEach(([x, y, z], i) => {
      const name = names[i], same = pois.filter((q) => q.name === name), p = same.find((q) => q.test(x, y, z)) ?? same[0];
      if (!p) { off.push(`${id} ${i}: no place of interest named ${JSON.stringify(name)} in the world`); return; }
      const d = Math.hypot(p.at[0] - x, p.at[2] - z).toFixed(0);
      if (!p.test(x, y, z) || !same.some((q) => q.test(x, y, z) && onPlace(q, x, y, z, physics))) off.push(`${id} ${i} (${x}, ${y}, ${z}): not on ${name} (its mark ${d} m off)`);
      if (wetAt(waters, x, y, z)) off.push(`${id} ${i} (${x}, ${y}, ${z}): in the water`);
    });
  }
  assert.deepEqual(off, [], off.join('\n'));
});

// (the second pass: "seven fragments on one port apron, six round one Lamp-House or ten on one ring don't read as
// placed. They also leave the rest of each world empty.")
test(`a place holds ${PLACE_CAP} fragments at most, a very big one 3 (issue #550)`, () => {
  const over = [];
  let most = 0;
  for (const id of ORDER) {
    const n = new Map();
    for (const name of FRAGMENT_PLACES[id] ?? []) n.set(name, (n.get(name) ?? 0) + 1);
    for (const [name, k] of n) { most = Math.max(most, k); if (k > placeCap(id, name)) over.push(`${id}: ${k} on ${name}`); }
  }
  assert.deepEqual(over, []);
  assert.ok(most <= 3);
});

test('each marker stands on the ground under one fragment, drawn as one mesh a world, without collision (issue #550)', () => {
  const bad = [];
  for (const id of ORDER) {
    const list = FRAGMENT_MARKERS[id] ?? [], names = FRAGMENT_PLACES[id] ?? [];
    list.forEach(([x, y, z], i) => {
      const on = names.flatMap((n, k) => (n === markerName(i) ? [k] : []));
      if (on.length !== 1) bad.push(`${id}: ${markerName(i)} under ${on.length} fragments`);
      else { const [fx, fy, fz] = FRAGMENTS[id][on[0]]; if (Math.hypot(fx - x, fz - z) > 0.3 || Math.abs(fy - y) > 0.3) bad.push(`${id}: ${markerName(i)} not under its fragment`); }
      const g = world(id).physics.groundAt(x, y + 1.5, z, 4);
      if (!(Math.abs(g - y) < 0.4)) bad.push(`${id}: ${markerName(i)} off the ground (${(g - y).toFixed(2)})`);
    });
    if (names.some((n) => /^the light’s cairn/.test(n) && !list[+n.match(/\((\d+)\)/)[1] - 1])) bad.push(`${id}: a fragment on a marker that isn't there`);
    const scene = new THREE.Scene(), m = buildFragmentMarkers(scene, id, world(id).physics);
    if (list.length && (!m || scene.children.length !== 1 || !m.userData.noCollide)) bad.push(`${id}: not one mesh without collision`);
    if (m) { m.geometry.computeBoundingBox(); if (m.geometry.boundingBox.max.y > Math.max(...list.map((p) => p[1])) + MARKER_HEIGHT + 0.1) bad.push(`${id}: a marker over the fragment it carries`); }
  }
  assert.deepEqual(bad, []);
});

test('the people say where each lies by its place, never a kind of place alone (issue #550)', () => {
  const generic = [];
  for (const id of ORDER) (RUMOUR_PLACES[id] ?? []).forEach((s, i) => { if (s.startsWith('=')) generic.push(`${id} ${i}: ${s}`); });
  assert.deepEqual(generic, []);
});

test('a world’s fragments in places of interest are spread over three of them at least, not heaped in one', () => {
  const heaped = [];
  for (const id of ORDER) {
    // (each summit its own)
    const names = new Set(world(id).at.flatMap((p, i) => (!p ? [] : [p.kind === 'summit' ? `a summit (${i})` : p.name])));
    if (names.size < 3) heaped.push(`${id}: ${[...names].join(', ')}`);
  }
  assert.deepEqual(heaped, []);
});

test('the named places of interest are still in their worlds (a rename would drop them silently)', () => {
  const gone = [];
  for (const id of ORDER) {
    const { pois } = world(id);
    if (POI_THINGS[id] && !pois.some((p) => p.kind === 'thing')) gone.push(`${id}: none of ${POI_THINGS[id]}`);
    if (POI_PIECES[id] && !pois.some((p) => p.kind === 'piece')) gone.push(`${id}: none of its pieces`);
  }
  assert.deepEqual(gone, []);
});
