import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSoundtrack, loadSoundtrack, SOUNDTRACKS } from '../src/soundtracks.js';
import { AudioContext } from '../engine/webaudio.js';
import { statSync } from 'node:fs';

test('recordings join the tail to the opening and balance loudness', () => {
  const ctx = new AudioContext({ sampleRate: 100 });
  const original = ctx.createBuffer(2, 1000, 100);
  for (let ch = 0; ch < 2; ch++) original.getChannelData(ch).fill(0.5);
  const result = prepareSoundtrack(ctx, original);
  assert.equal(result.length, 800);
  assert.equal(result.numberOfChannels, 2);
  assert.ok(Math.abs(result.getChannelData(0)[0] - 10 ** (-27 / 20)) < 1e-6);
  assert.equal(original.getChannelData(0)[0], 0.5);
});

test('title screen and unmapped levels do not fetch music', async () => {
  const fail = () => { throw new Error('unexpected fetch'); };
  assert.equal(await loadSoundtrack({ score: false, levelId: 'desert' }, fail), false);
  assert.equal(await loadSoundtrack({ score: true, levelId: 'lab' }, fail), false);
});

test('a disposed world never starts a recording after its download', async () => {
  const sound = { score: true, levelId: 'desert', _disposed: true, ctx: { decodeAudioData: async () => ({}) } };
  assert.equal(await loadSoundtrack(sound, async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })), false);
  assert.equal(sound.recordedTrack, undefined);
});

test('registered soundtracks are packaged audio files', () => {
  for (const file of Object.values(SOUNDTRACKS)) assert.ok(statSync(new URL(`../public/music/${file}`, import.meta.url)).size > 100000);
});
