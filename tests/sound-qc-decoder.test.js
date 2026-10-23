// Cold-cache proof: a host must decode the shipped MP3 takes, not inherit a developer's cached WAVs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempDir } from '../scripts/temp-dirs.mjs';
import { decodedTakes, RATE } from '../scripts/sound-qc/render.mjs';
import { sfxFiles } from '../src/sfx.js';

test('every packaged MP3 decodes from a cold cache into finite non-silent PCM', () => {
  const read = decodedTakes(tempDir('hiraeth-mp3-decode-'));
  const files = sfxFiles().filter(name => name.endsWith('.mp3'));
  assert.ok(files.length > 0, 'exercise the actual compressed assets');
  for (const name of files) {
    const pcm = read(name);
    assert.ok(pcm, `${name}: real decoding failed; install FFmpeg (or use macOS afconvert)`);
    assert.equal(pcm.rate, RATE, `${name}: expected decoder sample rate`);
    assert.ok(pcm.channels.length > 0 && pcm.channels[0].length > 0, `${name}: decoded frames`);
    let peak = 0;
    for (const channel of pcm.channels) {
      assert.equal(channel.length, pcm.channels[0].length, `${name}: channel length`);
      for (const sample of channel) {
        assert.ok(Number.isFinite(sample) && Math.abs(sample) <= 1, `${name}: valid PCM`);
        peak = Math.max(peak, Math.abs(sample));
      }
    }
    assert.ok(peak > 0.00001, `${name}: real sound, not a silent readiness placeholder`);
  }
});
