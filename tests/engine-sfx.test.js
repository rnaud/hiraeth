import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioContext, AudioBuffer, NativeAudioBuffer, setAudioDecoder } from '../engine/webaudio.js';
import { SFX_FILE } from '../engine/unity/music.js';

const pcm = (length = 512) => ({ numberOfChannels: 2, length, sampleRate: 48000,
  pcm: Float32Array.from({ length: length * 2 }, (_, i) => i % 2 ? 0.25 : 0.5).buffer });

test('decoded effects retain channels and play through the ordinary gain/pan/loop graph', async () => {
  setAudioDecoder(() => pcm());
  try {
    const ctx = new AudioContext({ sampleRate: 48000 });
    const buffer = await ctx.decodeAudioData(new ArrayBuffer(1));
    assert.ok(buffer instanceof AudioBuffer && !(buffer instanceof NativeAudioBuffer));
    assert.equal(buffer.getChannelData(0)[200], 0.5);
    assert.equal(buffer.getChannelData(1)[200], 0.25);
    const source = ctx.createBufferSource(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
    source.buffer = buffer; source.loop = true; source.playbackRate.value = 1.5;
    gain.gain.value = 0.4; pan.pan.value = -1;
    source.connect(gain).connect(pan).connect(ctx.destination); source.start();
    const out = ctx.render(2048);
    assert.ok(out.some(v => v > 0), 'loop survives the end of the short source');
    assert.ok(out.filter((_, i) => i % 2).every(v => Math.abs(v) < 1e-6), 'fully left panned');
    assert.equal(ctx.nativeText(), '', 'no streaming voice bypasses the DSP');
    gain.gain.value = 0;
    assert.ok(ctx.render(256).every(v => v === 0), 'game mute applies');
    source.stop(); await ctx.close();
    assert.ok(ctx.render(256).every(v => v === 0));
  } finally { setAudioDecoder(null); }
});

test('effect decoder rejects invalid transfers, retaining caller fallback', async () => {
  for (const bad of [{ ...pcm(), length: 513 }, { ...pcm(), sampleRate: 0 },
    { ...pcm(), numberOfChannels: 9 }, { ...pcm(), pcm: new Float32Array(1024).fill(NaN).buffer }]) {
    setAudioDecoder(() => bad);
    await assert.rejects(new AudioContext().decodeAudioData(new ArrayBuffer(1)), /effect PCM/);
  }
  setAudioDecoder(null);
});

test('effect path namespace cannot decode music, traversal or remote arbitrary files', () => {
  for (const path of ['sfx/swing-1.mp3', 'sfx/ship-thrust-1.mp3', 'sfx/ship-thrust-1.wav']) assert.ok(SFX_FILE.test(path));
  for (const path of ['music/theme.mp3', 'sfx/../theme.mp3', 'sfx/a/b.mp3', 'https://x/sfx/a.mp3']) assert.ok(!SFX_FILE.test(path));
});

test('decoded effects replay sample-exactly in the native worker and end at pitched duration', async () => {
  const { AudioReplay } = await import('../engine/webaudio.js');
  setAudioDecoder(() => pcm(512));
  try {
    async function setup(record) {
      const ctx = new AudioContext({ sampleRate: 48000, record });
      const source = ctx.createBufferSource(); source.buffer = await ctx.decodeAudioData(new ArrayBuffer(1));
      source.playbackRate.value = 2; source.connect(ctx.destination); source.start();
      let ended = 0; source.onended = () => ended++;
      return { ctx, ended: () => ended };
    }
    const a = await setup(false), b = await setup(true), replay = new AudioReplay(48000);
    const expected = a.ctx.render(512), actual = replay.apply(b.ctx.takeOps(4));
    assert.deepEqual(actual.pcm, expected);
    assert.ok(expected.slice(0, 256 * 2).some(v => v > 0));
    assert.ok(expected.slice(256 * 2).every(v => v === 0), 'twice-speed source ends after 256 frames');
    b.ctx.ended(actual.ended); await Promise.resolve();
    assert.equal(a.ended(), 1); assert.equal(b.ended(), 1);
  } finally { setAudioDecoder(null); }
});

test('Unity effect polling coalesces callers and consumes both successful and failed transfers', async () => {
  const { installPlatform } = await import('../engine/platform.js');
  const { musicDecoder, pollMusic } = await import('../engine/unity/music.js');
  const fetch = globalThis.fetch; delete globalThis.fetch;
  try {
    installPlatform({ readFile: () => new ArrayBuffer(4) });
    const data = await (await globalThis.fetch('sfx/swing-1.mp3')).arrayBuffer();
    let state = '', takes = 0;
    const host = { SfxLoad: () => 7, SfxState: () => state, SfxTake: () => { takes++; return pcm().pcm; } };
    const decode = musicDecoder(host), a = decode(data), b = decode(data);
    pollMusic(host); assert.equal(takes, 0);
    state = 'ok,2,512,48000'; pollMusic(host);
    const [one, two] = await Promise.all([a, b]);
    assert.equal(one.pcm, two.pcm); assert.equal(takes, 1);
    const failure = decode(data); state = 'fail,not found'; pollMusic(host);
    await assert.rejects(failure, /not found/); assert.equal(takes, 2);
    pollMusic(host); assert.equal(takes, 2, 'completed requests removed');
  } finally { globalThis.fetch = fetch; }
});
