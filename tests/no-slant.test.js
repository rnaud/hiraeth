import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// (the source through its literal catalogue, checked against the directory: tests/src-tree.js, tests/test-catalogs.test.js)
import { srcPaths, srcText } from './src-tree.js';

// Issue #222: "make sure nothing is slanted in the UI." No panel, card, tag, stamp or heading is drawn tilted: a
// rotate() or skew() of a few degrees in any style (index.html, src/**/*.css, the styles written in src/**/*.js). Left
// alone: turns that mean something (a quarter or half turn, a 45° diamond, an arrow turned the way you face through a
// variable, a spinner's full turn), and two motions of drawn things, the potion tilting as you drink and the title's
// cape in the wind.
const TILT = /(?:rotate|skew[XY]?)\(\s*-?[0-9]*\.?[0-9]+\s*deg\s*\)/g;
const MEANT = /^rotate\(\s*-?(45|90|135|180|270|360)deg\s*\)$/;
const MOTIONS = ['pdrink', 'title-cape'];

/** index.html and the .css and .js files under src/: [path from the repository root, its text]. */
const files = () => [['/index.html', () => readFileSync(new URL('../index.html', import.meta.url), 'utf8')], ...srcPaths(/\.(css|js)$/).map((p) => ['/' + p, () => srcText(p)])];

test('nothing in the UI is drawn slanted', () => {
  const bad = [];
  for (const [f, read] of files()) {
    const lines = read().split('\n');
    lines.forEach((line, i) => {
      if (!/transform\s*:|@keyframes/.test(line) || MOTIONS.some((m) => line.includes(m))) return;
      for (const m of line.match(TILT) ?? []) if (!MEANT.test(m)) bad.push(`${f.slice(1)}:${i + 1} ${m}`);
    });
  }
  assert.deepEqual(bad, [], 'a tilted style');
});
