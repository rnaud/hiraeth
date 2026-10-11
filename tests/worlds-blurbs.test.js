// The Worlds page's blurbs and moves (src/levels/index.js, shown by src/game-menu-data.js worldsData) say what a
// player can do there: the jets are debug-only since v1.38, so no world a player can open names them; photo mode
// saves under the game's name (issue #94).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/levels/index.js', import.meta.url), 'utf8');

test('no player world names the jets in its blurb or moves', () => {
  // each entry: from `id: '…'` to the next; the developer's worlds (dev: true) may
  const entries = src.split(/\n {4}id: /).slice(1);
  assert.ok(entries.length > 20);
  for (const e of entries) {
    if (/dev: true/.test(e.split('\n')[0])) continue;
    const text = [...e.matchAll(/(?:blurb|moves): '([^']*)'/g)].map((m) => m[1]).join(' ');
    assert.doesNotMatch(text, /\bjet/i, e.slice(0, 40));
  }
});

test('photo mode saves hiraeth-<world>-….png', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /`hiraeth-\$\{levelId\}-/);
  assert.doesNotMatch(main, /`moebius-\$\{levelId\}/);
});
