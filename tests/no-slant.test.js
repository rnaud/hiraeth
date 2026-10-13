import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Issue #222: "make sure nothing is slanted in the UI." No panel, card, tag, stamp or heading is drawn tilted: a
// rotate() or skew() of a few degrees in any style (index.html, src/**/*.css, the styles written in src/**/*.js). Left
// alone: turns that mean something (a quarter or half turn, a 45° diamond, an arrow turned the way you face through a
// variable, a spinner's full turn), and two motions of drawn things, the potion tilting as you drink and the title's
// cape in the wind.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TILT = /(?:rotate|skew[XY]?)\(\s*-?[0-9]*\.?[0-9]+\s*deg\s*\)/g;
const MEANT = /^rotate\(\s*-?(45|90|135|180|270|360)deg\s*\)$/;
const MOTIONS = ['pdrink', 'title-cape'];

function files(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(css|js)$/.test(f)) out.push(p);
  }
  return out;
}

test('nothing in the UI is drawn slanted', () => {
  const bad = [];
  for (const f of [join(ROOT, 'index.html'), ...files(join(ROOT, 'src'))]) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/transform\s*:|@keyframes/.test(line) || MOTIONS.some((m) => line.includes(m))) return;
      for (const m of line.match(TILT) ?? []) if (!MEANT.test(m)) bad.push(`${f.slice(ROOT.length)}:${i + 1} ${m}`);
    });
  }
  assert.deepEqual(bad, [], 'a tilted style');
});
