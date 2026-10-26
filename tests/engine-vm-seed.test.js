// Generic VM reproducibility is independent of the expensive gameplay sequences.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBundle } from '../engine/vm-run.mjs';
import { SEED } from '../engine/sequence-run.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tempDir, removeTemp } from '../scripts/temp-dirs.mjs';

test('the engines\' VM seeded: its Math.random one fixed run each time, node\'s own left alone (issue #454)', () => {
  const dir = tempDir('hiraeth-seed-');
  try {
    const file = join(dir, 'b.js');
    writeFileSync(file, 'module.exports = { draw: () => [Math.random(), Math.random(), Math.random()] };');
    const host = Math.random;
    const draw = (seed) => [...loadBundle(file, {}, {}, { seed }).exports.draw()];   // (the VM's array, as one of node's)
    const a = draw(454);
    assert.deepEqual(draw(454), a);
    assert.notDeepEqual(draw(7), a);
    assert.ok(a.every((x) => x >= 0 && x < 1));
    assert.equal(Math.random, host);
    assert.equal(SEED, 454);
  } finally { removeTemp(dir); }
});
