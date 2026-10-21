import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tempDir } from '../scripts/temp-dirs.mjs';
import { decodedTakes } from '../scripts/sound-qc/render.mjs';

test('QC decodes PCM WAV directly and invalidates in-memory takes when source bytes change', () => {
  const root = tempDir('hiraeth-sfx-cache-test-');
  mkdirSync(join(root, 'audio'));
  const file = join(root, 'audio', 'test.wav');
  const bytes = readFileSync(new URL('../public/sfx/blade-light-0.wav', import.meta.url));
  writeFileSync(file, bytes);
  const decode = decodedTakes(join(root, 'cache'), 'audio', root);
  const first = decode('test.wav'); assert.equal(first.rate, 44100);
  const changed = Buffer.from(bytes); changed.writeInt16LE(12345, 44);
  writeFileSync(file, changed);
  const next = decode('test.wav');
  assert.notStrictEqual(next, first);
  assert.equal(next.channels[0][0], 12345 / 32768);
  assert.strictEqual(decode('test.wav'), next);
});
