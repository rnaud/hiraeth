import test from 'node:test';
import assert from 'node:assert/strict';
import { CINEMATICS, reviewURL } from '../src/cinematics-page/catalog.js';
import { reviewStorage } from '../src/cinematics-page/storage.js';
import { WORLD_MOMENTS } from '../src/story/film.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { ORDER, SIDE } from '../src/levels/names.js';
test('review covers every registered moment, item box and destination without duplicate links', () => {
  const ids = new Set(CINEMATICS.map(e => e.id));
  assert.equal(ids.size, CINEMATICS.length);
  for (const m of Object.values(WORLD_MOMENTS).flat()) assert.ok(ids.has(m.id));
  for (const b of Object.values(PLACEMENTS).flat()) assert.ok(ids.has(`box.${b.id}`));
  for (const world of [...ORDER, ...SIDE, 'home', 'lantern']) assert.ok(ids.has(`arrival.${world}`));
  for (const e of CINEMATICS.filter(e => e.id !== 'trailer')) assert.equal(new URL(reviewURL(e), 'https://example.com/game/').searchParams.get('cinematicReview'), e.id);
});
test('review storage never writes through to a player save and starts fresh on replay', () => {
  assert.equal(reviewStorage('?level=desert'), null);
  const a = reviewStorage('?cinematicReview=desert.flow'); a.setItem('moebius.s1.game.v1', 'temporary');
  assert.equal(a.getItem('moebius.s1.game.v1'), 'temporary');
  const b = reviewStorage('?cinematicReview=desert.flow'); assert.equal(b.getItem('moebius.s1.game.v1'), null);
  a.removeItem('moebius.s1.game.v1'); assert.equal(a.getItem('moebius.s1.game.v1'), null);
});
