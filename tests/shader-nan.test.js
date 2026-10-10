// Shader maths that can turn into NaN (v1.41): pow() of a negative number is undefined in GLSL (NaN on the GPUs we
// run on). A rim term pow(1.0 - |n·v|, k) went NaN where an interpolated normal was a hair longer than 1; the NaN went
// into the G-buffer and the bloom's blurs spread it into black blocks round the blade and the glowing things near it,
// a few frames in every hundred through a swing (the author's "shadow artifacts when hits land"). Every pow(1.0 - x, …)
// in these shaders must have x held to 1 (or the base held to 0).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = ['src/blade-shader.js', 'src/foe-surface.js'];

test('the blade\'s and the foes\' rim terms never take pow() of a negative', () => {
  for (const f of files) {
    const s = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    for (const m of s.matchAll(/pow\(\s*1\.0\s*-\s*([a-zA-Z_][\w.]*)\s*,/g)) {
      const name = m[1];
      // the variable is held to 1 where it is made (min(…, 1.0)), or clamped
      const held = new RegExp(`${name.replace('.', '\\.')}\\s*=\\s*(min\\([^;]*1\\.0\\)|clamp\\()`).test(s);
      assert.ok(held, `${f}: pow(1.0 - ${name}, …) with ${name} not held to 1`);
    }
    assert.ok(!/pow\(1\.0 - ndv/.test(s) || /max\(1\.0 - ndv, 0\.0\)/.test(s), `${f}: the blade's rim`);
  }
});
