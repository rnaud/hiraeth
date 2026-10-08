import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { SFX, sfxFiles, variation, RoundRobin, SampleBank } from '../src/sfx.js';
import { AudioContext } from '../engine/webaudio.js';

const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('every take of the bank is a small packaged MP3 with a CC0 source in the manifest', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/sfx/manifest.json', import.meta.url), 'utf8'));
  assert.match(manifest.licence, /CC0/);
  let total = 0;
  for (const f of sfxFiles()) {
    const size = statSync(new URL(`../public/sfx/${f}`, import.meta.url)).size;
    assert.ok(size > 1000 && size < 40000, `${f}: ${size} bytes`);
    total += size;
    const m = manifest.files[f.replace(/\.mp3$/, '')];
    assert.ok(m, `${f} has a source`);
    assert.match(m.url, /^https:\/\/(kenney\.nl\/assets\/(impact-sounds|rpg-audio)|freesound\.org\/s\/\d+\/)$/);
  }
  assert.ok(total < 1.5 * 2 ** 20, `the bank stays small: ${total} bytes`);
  // nothing in the folder the bank doesn't use
  const shipped = readdirSync(new URL('../public/sfx/', import.meta.url)).filter((f) => f.endsWith('.mp3')).sort();
  assert.deepEqual(shipped, sfxFiles().sort());
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

test('not loaded yet: the bank says no (the synth plays) and starts loading; loaded, it plays a take', async () => {
  const ctx = new AudioContext({ sampleRate: 8000 });
  const asked = [];
  ctx.decodeAudioData = async () => ctx.createBuffer(1, 400, 8000);
  const fetcher = async (url) => { asked.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
  const bank = new SampleBank(ctx, { base: 'sfx/', fetcher, rand: seeded(5) });
  const dest = ctx.createGain(); dest.connect(ctx.destination);
  assert.equal(bank.play('land', { dest }), false);
  assert.equal(bank.state('land'), 'loading');
  await bank.load('land');
  assert.equal(bank.state('land'), 'ready');
  assert.deepEqual(asked, ['sfx/land-0.mp3', 'sfx/land-1.mp3', 'sfx/land-2.mp3']);
  assert.equal(bank.play('land', { dest, vol: 0.5 }), true);
  const p = bank.played.at(-1);
  assert.ok(p.vol <= SFX.land.vol * 0.5 && p.vol > 0);
  assert.equal(bank.play('land', { dest, vol: 0 }), false, 'silent: nothing played');
  assert.equal(bank.play('nothing', { dest }), false);
});

test('offline or no decoder: the group fails and stays on the synth', async () => {
  const ctx = new AudioContext({ sampleRate: 8000 });   // (the engine's: decodeAudioData rejects)
  const bank = new SampleBank(ctx, { base: 'sfx/', fetcher: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) });
  assert.equal(await bank.load('hurt'), false);
  assert.equal(bank.state('hurt'), 'failed');
  assert.equal(bank.play('hurt', { dest: ctx.destination }), false);
  const off = new SampleBank(ctx, { fetcher: async () => { throw new TypeError('offline'); } });
  await off.preload();
  for (const g of Object.keys(SFX)) assert.equal(off.state(g), 'failed');
  const missing = new SampleBank(ctx, { fetcher: async () => ({ ok: false, status: 404 }) });
  assert.equal(await missing.load('splat'), false);
});

test('one take missing: the group plays the ones it has', async () => {
  const ctx = new AudioContext({ sampleRate: 8000 });
  ctx.decodeAudioData = async () => ctx.createBuffer(1, 100, 8000);
  const bank = new SampleBank(ctx, { base: '', fetcher: async (u) => ({ ok: !u.endsWith('-1.mp3'), status: 404, arrayBuffer: async () => new ArrayBuffer(8) }), rand: seeded(9) });
  assert.equal(await bank.load('splat'), true);
  for (let i = 0; i < 10; i++) assert.equal(bank.play('splat', { dest: ctx.destination }), true);
  assert.ok(bank.played.every((p) => p.take < 3));
});
