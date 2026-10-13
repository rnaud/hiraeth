// The fragments of the singing light in and on the worlds' places of interest (issue #250: "Fragments of the singing
// light should often be within points of interest or at the top of structures hard to climb. Like at the top of the big
// temples in the sphere levels, or within the skeletons in the desert level."; docs/systems/fragments.md). Each route
// world is built as the contact audit builds it (tests/built-worlds.js) and its places of interest gathered as
// scripts/fragment-spots.mjs scores them (tests/fragments-reach.js pointsOfInterest: by a sight, up a beacon, inside a
// named thing's bounds or one of the level's big pieces, on a summit).
import test from 'node:test';
import assert from 'node:assert/strict';
import { builtWorld } from './built-worlds.js';
import { pointsOfInterest, poiAt, POI_THINGS, POI_PIECES } from './fragments-reach.js';
import { FRAGMENTS, FRAGMENTS_PER_WORLD } from '../src/fragments-data.js';
import { ORDER } from '../src/levels/names.js';

/** How many of a world's eight lie in or on a place of interest, at least (the Desert's two easy ones by the ship among the rest). */
export const POI_SHARE = 4;
/** And of the 96, at least. */
export const POI_TOTAL = 56;

const placed = new Map();
const world = (id) => {
  if (!placed.has(id)) {
    const W = builtWorld(id);
    const pois = pointsOfInterest(W, id);
    placed.set(id, { pois, at: FRAGMENTS[id].map(([x, y, z]) => poiAt(pois, W.physics, x, y, z)) });
  }
  return placed.get(id);
};

test('every world hides half its fragments or more in or on a place of interest, and most of the 96 are', () => {
  const short = [], seen = [];
  let all = 0;
  for (const id of ORDER) {
    const { at } = world(id);
    const n = at.filter(Boolean).length;
    all += n;
    seen.push(`${id} ${n}/${FRAGMENTS_PER_WORLD}: ${at.map((p, i) => `${i} ${p?.name ?? '-'}`).join(', ')}`);
    if (n < POI_SHARE) short.push(`${id}: ${n} of ${FRAGMENTS_PER_WORLD} in or on a place of interest`);
  }
  assert.deepEqual(short, [], seen.join('\n'));
  assert.ok(all >= POI_TOTAL, `${all} of 96 in or on a place of interest (at least ${POI_TOTAL})\n${seen.join('\n')}`);
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
