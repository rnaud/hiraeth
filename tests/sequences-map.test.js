// The sequences' streams don't hang on the machine's speed (issue #468): the Map draws a few ms a frame in play, so the
// node runner and the web's recorder have it drawn whole at its first look (engine/sequences.js mapAtOnce); a stream
// taken on a loaded machine had a menu beat see less of it and a listed difference go missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAP } from '../src/world-map.js';
import { mapAtOnce } from '../engine/sequences.js';

test('mapAtOnce gives the Map all the time it wants, and both stream takers ask for it', () => {
  const was = MAP.budget;
  try {
    mapAtOnce();
    assert.ok(MAP.budget >= 1e5, `${MAP.budget}`);
  } finally { MAP.budget = was; }
  for (const f of ['../engine/sequence-run.mjs', '../scripts/unity-compare/sequences.mjs']) {
    assert.match(readFileSync(new URL(f, import.meta.url), 'utf8'), /mapAtOnce\?\.\(\)/, f);
  }
  // (and not the players' runs: the stutter routes measure the budget itself)
  assert.doesNotMatch(readFileSync(new URL('../engine/unity/game.js', import.meta.url), 'utf8'), /mapAtOnce/);
});
