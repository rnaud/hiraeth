import test from 'node:test';
import assert from 'node:assert/strict';
import { CINEMATICS, reviewURL } from '../src/cinematics-page/catalog.js';
import { reviewStorage, mergeNotes } from '../src/cinematics-page/storage.js';
import { readFileSync } from 'node:fs';
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
  assert.equal(new URL(reviewURL(CINEMATICS.find(e=>e.id==='trailer')), 'https://example.com/').searchParams.get('muted'),'1');
  a.removeItem('moebius.s1.game.v1'); assert.equal(a.getItem('moebius.s1.game.v1'), null);
});

test('imported QC notes merge by date, and the last QC pass\'s notes load and name real cinematics', () => {
  const here = { a: { verdict: 'Pass', text: 'old', updated: '2026-10-01' }, b: { verdict: 'Needs work', text: 'mine', updated: '2026-10-09' } };
  const merged = mergeNotes(here, { notes: { a: { verdict: 'Needs work', text: 'new', updated: '2026-10-05' }, b: { verdict: 'Pass', text: 'older', updated: '2026-10-02' }, c: { verdict: 'Nonsense' } } });
  assert.equal(merged.a.text, 'new'); assert.equal(merged.b.text, 'mine'); assert.equal(merged.c, undefined);
  const pass = JSON.parse(readFileSync(new URL('../docs/systems/cinematics-qc-notes.json', import.meta.url), 'utf8'));
  const ids = new Set(CINEMATICS.map((e) => e.id));
  for (const id of Object.keys(pass.notes)) assert.ok(ids.has(id), id);
  assert.equal(Object.keys(mergeNotes({}, pass)).length, CINEMATICS.length, 'every cinematic has its verdict');
});
