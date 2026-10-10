// LORE.md §10, "Decided and fixed": the small story contradictions settled in the text, kept settled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ERRANDS, ERRAND_PLACES } from '../src/levels/content.js';
import { stripTone } from '../src/story/tone.js';
import { PEOPLE as VAEL2_PEOPLE, LOCALS as VAEL2_LOCALS } from '../src/story/arzach2-data.js';
import { PEOPLE as CITY } from '../src/story/incal-data.js';

const people = (P) => (Array.isArray(P) ? P : Object.values(P));
const VAEL2 = [...people(VAEL2_PEOPLE), ...VAEL2_LOCALS];
const node = (P, id, n) => people(P).find((p) => p.id === id).talk.nodes[n];
const said = (line) => stripTone(typeof line === 'string' ? line : line.text);
/** The words spoken aloud: what is left once the gestures (in brackets) are taken out. */
const spokenWords = (line) => said(line).replace(/\([^)]*\)/g, ' ').split(/\s+/).filter((w) => /\w/.test(w));

test('Vael is quiet by choice: its errand lines are gestures and a word or two', () => {
  // (Vael's own people, the part: since October 2026 the sky stones are Vael's too, and their monks talk)
  for (const e of ERRAND_PLACES) {
    const lines = [e.from[0] === 'arzach' && e.ask, e.from[0] === 'arzach' && e.wait, e.to[0] === 'arzach' && e.thanks].filter(Boolean);
    for (const l of lines) assert.ok(spokenWords(l).length <= 3, `${e.id}: “${said(l)}” says too much for Vael`);
  }
  const feather = ERRANDS.find((e) => e.id === 'feather');
  assert.match(said(feather.ask), /sky stones/, 'it still says where it goes');
});

test('Vael II: the sky stones are older than the bell’s silence; only loose things fell up when it stopped', () => {
  const stones = said(node(VAEL2, 'aube', 'stones').say[0]);
  assert.match(stones, /long before the bell stopped/);
  assert.match(stones, /mother’s day/);
  const why = said(node(VAEL2, 'aube', 'why').say[0]);
  assert.match(why, /everything loose fell/);
  assert.doesNotMatch(why, /the stones fell/);
  // Tiv is a child: his cairn fell up the night the light went over, not thirty years ago
  assert.match(said(node(VAEL2, 'tiv', 'hello').say[1]), /night the light went over/);
});

test('the Lodestar: fading all Nima’s life, and going out since the night the sky rang', () => {
  const what = said(node(CITY, 'nima', 'what').say[1]);
  assert.match(what, /brighter when I was a girl/);
  assert.match(what, /every year/);
  assert.match(what, /since the night the sky rang, it’s been going out/);
});
