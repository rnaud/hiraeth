import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SFX, sfxFiles, variation, RoundRobin, SampleBank } from '../src/sfx.js';
import { AudioContext } from '../engine/webaudio.js';
// (public/sfx and references/audio through their literal catalogues, checked against the directories: tests/test-catalogs.test.js)
import * as sfxBank from './catalogs/sfx-files.js';
import * as audioRefs from './catalogs/audio-references.js';
const reference = (path) => { assert.ok(path.startsWith('references/audio/'), `${path}: under references/audio/`); return audioRefs.bytes(path.slice('references/audio/'.length)); };

const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('every runtime take has accurate per-file provenance and a bounded payload', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/sfx/manifest.json', import.meta.url), 'utf8'));
  // These five author-selected revisions add 2,145,244 bytes of mono 44.1 kHz PCM.
  // Keep the prior bank budget intact; future files cannot borrow this allowance.
  const selectedFive = new Set(['hoverbike-glide-0.wav', 'hologram-crt-0.wav', 'chest-open-0.wav', 'key-unlock-0.wav', 'temple-ambience-0.wav']);
  const foundSelected = new Set();
  let priorBytes = 0, selectedBytes = 0;
  for (const f of sfxFiles()) {
    const bytes = sfxBank.bytes(f);
    if (selectedFive.has(f)) { selectedBytes += bytes.length; foundSelected.add(f); }
    else priorBytes += bytes.length;
    const m = manifest.files[f.replace(/\.(mp3|wav)$/, '')];
    assert.ok(m, `${f} has a source`);
    assert.equal(m.bytes, bytes.length);
    if (f.endsWith('.wav')) {
      assert.match(m.from, /ElevenLabs/); assert.match(m.licence, /not CC0/);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), m.sha256);
      const source = reference(m.source);
      assert.equal(createHash('sha256').update(source).digest('hex'), m.sourceSha256);
      assert.equal(bytes.toString('ascii',0,4), 'RIFF');
      assert.equal(bytes.readUInt16LE(22), 1, 'mono');
      assert.equal(bytes.readUInt32LE(24), 44100);
      assert.equal(bytes.readUInt16LE(34), 16);
      assert.ok(m.peakDbfs <= -3 && m.duration < 9 && bytes.length < 800000);
      if (f.startsWith('step-')) assert.ok(m.duration < 0.8, 'a single contact, never the whole four-second master');
    } else {
      assert.ok(bytes.length > 1000 && bytes.length < 40000);
      assert.match(m.url, /^https:\/\/(kenney\.nl\/assets\/(impact-sounds|rpg-audio)|freesound\.org\/s\/\d+\/)$/);
    }
  }
  assert.deepEqual([...foundSelected].sort(), [...selectedFive].sort(), 'the allowance covers exactly the five approved revisions');
  assert.ok(priorBytes <= 7 * 2 ** 20, `original bank and any future assets stay within 7 MiB: ${priorBytes}`);
  assert.ok(selectedBytes <= 2.1 * 2 ** 20, `only the five approved revisions use the separate 2.1 MiB allowance: ${selectedBytes}`);
  const shipped = readdirSync(new URL('../public/sfx/', import.meta.url)).filter((f) => /\.(mp3|wav)$/.test(f)).sort();
  assert.deepEqual(shipped, sfxFiles().sort());
  const sources = JSON.parse(readFileSync(new URL('../references/audio/elevenlabs-sfx-2026-10-21/manifest.json', import.meta.url)));
  assert.equal(sources.sources.length, 11);
  for (const source of sources.sources.filter((s) => s.kind === 'footsteps')) {
    assert.equal(source.cuts.length, 4);
    source.cuts.forEach(([start,end],i) => { assert.ok(end > start); if (i) assert.ok(start > source.cuts[i-1][1]); });
  }
});

test('a play varies pitch and level within the group\'s spread', () => {
  const r = seeded(3);
  for (let i = 0; i < 200; i++) {
    const v = variation(SFX.swing, r);
    assert.ok(Math.abs(v.rate - 1) <= SFX.swing.rate + 1e-9);
    assert.ok(v.gain <= 1 && v.gain >= 1 - SFX.swing.gain - 1e-9);
  }
  const a = variation(SFX.swing, seeded(1)), b = variation(SFX.swing, seeded(2));
  assert.notEqual(a.rate, b.rate, 'two plays are not the same');
  assert.deepEqual(variation({}, seeded(1)), { rate: 1, gain: 1 });
});

test('round robin: every take once a round, never the same take twice running', () => {
  const rr = new RoundRobin(4, seeded(11));
  let last = -1;
  for (let round = 0; round < 50; round++) {
    const seen = new Set();
    for (let i = 0; i < 4; i++) { const k = rr.next(); assert.notEqual(k, last); last = k; seen.add(k); }
    assert.equal(seen.size, 4);
  }
  assert.equal(new RoundRobin(1).next(), 0);
});

test('play never starts a lazy download; explicitly loaded takes play', async () => {
  const ctx = new AudioContext({ sampleRate: 8000 });
  const asked = [];
  ctx.decodeAudioData = async () => ctx.createBuffer(1, 400, 8000);
  const fetcher = async (url) => { asked.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
  const bank = new SampleBank(ctx, { base: 'sfx/', fetcher, rand: seeded(5) });
  const dest = ctx.createGain(); dest.connect(ctx.destination);
  assert.equal(bank.play('land', { dest }), false);
  assert.equal(bank.state('land'), 'idle');
  assert.equal(asked.length, 0);
  await bank.load('land');
  assert.equal(bank.state('land'), 'ready');
  assert.deepEqual(asked, ['sfx/land-0.mp3', 'sfx/land-1.mp3', 'sfx/land-2.mp3']);
  assert.equal(bank.play('land', { dest, vol: 0.5 }), true);
  const p = bank.played.at(-1);
  assert.ok(p.vol <= SFX.land.vol * 0.5 && p.vol > 0);
  assert.equal(bank.play('land', { dest, vol: 0 }), false, 'silent: nothing played');
  assert.equal(bank.play('nothing', { dest }), false);
});

test('offline or no decoder: preparation fails explicitly without a playback substitute', async () => {
  const ctx = new AudioContext({ sampleRate: 8000 });   // (the engine's: decodeAudioData rejects)
  const bank = new SampleBank(ctx, { base: 'sfx/', fetcher: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) });
  assert.equal(await bank.load('hurt'), false);
  assert.equal(bank.state('hurt'), 'failed');
  assert.equal(bank.play('hurt', { dest: ctx.destination }), false);
  const off = new SampleBank(ctx, { fetcher: async () => { throw new TypeError('offline'); } });
  await assert.rejects(off.preload(), { name: 'SoundEffectsLoadError' });
  assert.equal(off.groups.size, 4, 'first failure cancels the attempt before queued groups start');
  for (const group of off.groups.values()) assert.equal(group.state, 'failed');
  for (const g of Object.keys(SFX)) assert.equal(off.play(g, { dest: ctx.destination }), false, 'failed or unattempted groups cannot play');
  const missing = new SampleBank(ctx, { fetcher: async () => ({ ok: false, status: 404 }) });
  assert.equal(await missing.load('splat'), false);
});

test('one take missing: the whole assigned group remains unavailable', async () => {
  const ctx = new AudioContext({ sampleRate: 8000 });
  ctx.decodeAudioData = async () => ctx.createBuffer(1, 100, 8000);
  const bank = new SampleBank(ctx, { base: '', fetcher: async u => ({ ok: !u.endsWith('-1.mp3'), status: 404, arrayBuffer: async () => new ArrayBuffer(8) }) });
  assert.equal(await bank.load('splat'), false);
  assert.equal(bank.play('splat', { dest: ctx.destination }), false);
  assert.equal(bank.played.length, 0);
});


test('loop handles update on the audio clock, stop once and dispose releases pending fades', async () => {
  const ctx = new AudioContext({ sampleRate: 8000 });
  ctx.decodeAudioData = async () => ctx.createBuffer(1, 800, 8000);
  const bank = new SampleBank(ctx, { table: { hum: { n: 1, vol: 0.2, ext: 'wav' } }, fetcher: async (url) => {
    assert.ok(url.endsWith('hum-0.wav'));
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  } });
  await bank.load('hum');
  const handle = bank.start('hum', { dest: ctx.destination, loop: true, vol: 0 });
  assert.equal(handle.duration, 0.1);
  assert.equal(bank.active.size, 1);
  handle.set({ vol: 0.6, rate: 1.2 });
  handle.stop(0.3); handle.stop(0.3);
  assert.equal(bank.active.size, 1, 'fading source retained until it ends');
  bank.dispose();
  assert.equal(bank.active.size, 0, 'dispose releases even fading loops immediately');
  assert.equal(bank.start('hum', { dest: ctx.destination }), null);
  assert.equal(await bank.load('hum'), false);
});

test('dispose during decode cannot resurrect a loaded bank', async () => {
  const ctx = new AudioContext({ sampleRate: 8000 });
  let resolve;
  ctx.decodeAudioData = () => new Promise((done) => { resolve = done; });
  const bank = new SampleBank(ctx, { table: { one: { n: 1, vol: 1 } }, fetcher: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) });
  const pending = bank.load('one');
  await new Promise((done) => setImmediate(done));
  bank.dispose(); resolve(ctx.createBuffer(1, 8, 8000));
  assert.equal(await pending, false);
  assert.equal(bank.groups.size, 0);
});


test('a resumed cue starts at a bounded decoded-buffer offset without replaying its onset', async () => {
  const ctx = new AudioContext({ sampleRate: 8000 });
  const buffer = ctx.createBuffer(1, 8000, 8000); buffer.getChannelData(0).fill(0.25);
  ctx.decodeAudioData = async () => buffer;
  const bank = new SampleBank(ctx, { table: { cue: { n: 1, vol: 1 } }, fetcher: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) });
  await bank.load('cue');
  assert.equal(bank.start('cue', { dest: ctx.destination, offset: 1 }), null);
  assert.equal(bank.start('cue', { dest: ctx.destination, offset: -1 }), null);
  const cue = bank.start('cue', { dest: ctx.destination, offset: 0.75 });
  assert.equal(cue.duration, 1);
  const rendered = ctx.render(8000);
  assert.ok(rendered.slice(0, 1000).some((v) => v !== 0));
  assert.ok(rendered.slice(4000).every((v) => v === 0), 'only the final quarter second plays');
  bank.dispose();
});

test('bounded contacts keep their scheduled onset and fade out at a wall-clock deadline', async () => {
  const ctx = new AudioContext({ sampleRate: 8000 });
  const buffer = ctx.createBuffer(1, 8000, 8000); buffer.getChannelData(0).fill(0.5);
  ctx.decodeAudioData = async () => buffer;
  const bank = new SampleBank(ctx, { table: { contact: { n: 1, vol: 1 } }, fetcher: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) });
  await bank.load('contact');
  const handle = bank.start('contact', { dest: ctx.destination, when: 0.45, maxDuration: 0.3, rate: 0.7 });
  handle.set({ vol: 0.8 });
  const pcm = ctx.render(8000);
  assert.ok(pcm.slice(0, 7200).every((v) => v === 0), 'never before the 0.45-second plant');
  assert.ok(pcm.slice(7400, 11000).some((v) => Math.abs(v) > 0.1));
  assert.ok(Math.abs(pcm[11800]) < Math.abs(pcm[11400]), '25 ms tail is faded, not abruptly cut');
  assert.ok(pcm.slice(12000).every((v) => v === 0), 'finished at 0.75 seconds despite the slower playback rate');
  bank.dispose();
});

test('sand contacts start at the measured impact and settle before the next running step', () => {
  for (let i = 0; i < 4; i++) {
    const wav = sfxBank.bytes(`step-sand-${i}.wav`);
    const rate = wav.readUInt32LE(24), frames = wav.readUInt32LE(40) / 2;
    assert.equal(frames, Math.round(.24 * rate), 'a core contact, not the long settling scrape');
    const window = Math.round(.02 * rate), energy = [];
    for (let start = 0; start < frames; start += window) {
      let sum = 0;
      for (let n = start; n < Math.min(start + window, frames); n++) sum += wav.readInt16LE(44 + 2 * n) ** 2;
      energy.push(sum / Math.min(window, frames - start));
    }
    const peak = Math.max(...energy);
    assert.ok(energy.indexOf(peak) * .02 <= .08, 'impact is near the actual trigger, not 400 ms late');
    assert.ok(energy.at(-1) < peak * .5, 'softened tail, not a hard truncation');
  }
});
