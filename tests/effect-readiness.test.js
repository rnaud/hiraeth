import test from 'node:test';
import assert from 'node:assert/strict';
import { SampleBank } from '../src/sfx.js';
import { prepareEffectAssets, preparedBank } from '../src/effect-assets.js';
import { AudioContext, AudioReplay } from '../engine/webaudio.js';

const response = () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
function decoder() {
  const ctx = new AudioContext({ sampleRate: 8000 });
  ctx.decodeAudioData = async () => { const b = ctx.createBuffer(1, 800, 8000); b.getChannelData(0).fill(.25); return b; };
  return ctx;
}

test('strict preparation rejects a missing take and retry fetches only that take', async () => {
  const table = { contact: { n: 3, vol: 1 } }, asked = [];
  let missing = true;
  const options = { table, base: 'retry/', makeDecoder: decoder, fetcher: async url => {
    asked.push(url); return missing && url.endsWith('-1.mp3') ? { ok: false, status: 404 } : response();
  } };
  await assert.rejects(prepareEffectAssets(options), error => error.name === 'SoundEffectsLoadError' && error.failures[0].file === 'contact-1.mp3');
  await assert.rejects(prepareEffectAssets(options));
  assert.equal(asked.length, 3, 'failure never retries without an explicit request');
  missing = false;
  const assets = await prepareEffectAssets({ ...options, retry: true });
  assert.equal(assets.ready, true);
  assert.deepEqual(asked, ['retry/contact-0.mp3', 'retry/contact-1.mp3', 'retry/contact-2.mp3', 'retry/contact-1.mp3']);
});

test('preparation shares buffers but each title/world playback owner can stop independently', async () => {
  const table = { contact: { n: 1, vol: 1 } };
  let fetched = 0, made = 0;
  const options = { table, base: 'shared/', fetcher: async () => { fetched++; return response(); }, makeDecoder: () => { made++; return decoder(); } };
  const [a, b] = await Promise.all([prepareEffectAssets(options), prepareEffectAssets(options)]);
  assert.equal(a, b); assert.equal(made, 1); assert.equal(fetched, 1);
  const title = preparedBank(new AudioContext({ sampleRate: 8000 }), a);
  const world = preparedBank(new AudioContext({ sampleRate: 8000 }), b);
  assert.equal(title.groups.get('contact').buffers[0], world.groups.get('contact').buffers[0]);
  title.dispose();
  assert.ok(world.start('contact', { dest: world.ctx.destination }));
  assert.equal(a.bank.state('contact'), 'ready');
  world.dispose();
  const next = await prepareEffectAssets(options);
  assert.equal(next, a); assert.equal(fetched, 1, 'disposing a playback owner never destroys prepared assets');
});

test('preload bounds pending decoder promises below the native queue and starts no sources', async () => {
  const table = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`cue${i}`, { n: 5, vol: 1 }]));
  let fetching = 0, fetchPeak = 0, fetched = 0, decoding = 0, decodePeak = 0, decoded = 0;
  const ctx = decoder(); ctx.createBufferSource = () => { throw new Error('preparation must not create sources'); };
  ctx.decodeAudioData = async () => {
    decoding++; decodePeak = Math.max(decodePeak, decoding);
    // Fetch can finish immediately while native PCM decoding remains outstanding.
    // Count the promise lifetime, not just network requests or active decoder threads.
    await new Promise(resolve => setImmediate(() => setImmediate(resolve)));
    decoding--; decoded++; return ctx.createBuffer(1, 800, 8000);
  };
  const bank = new SampleBank(ctx, { table, fetcher: async () => {
    fetching++; fetchPeak = Math.max(fetchPeak, fetching);
    await new Promise(resolve => setImmediate(resolve)); fetching--; fetched++; return response();
  } });
  await bank.preload(100);
  assert.equal(fetched, 105); assert.equal(decoded, 105);
  assert.ok(fetchPeak <= 20, `pending fetches ${fetchPeak}`);
  assert.ok(decodePeak > 1 && decodePeak <= 20, `pending decode promises ${decodePeak}`);
  assert.equal(decoding, 0); assert.equal(bank.active.size, 0);
});

test('shared decoded PCM is sent to both independent native playback contexts', () => {
  const buffer = decoder().createBuffer(1, 800, 8000); buffer.getChannelData(0).fill(.25);
  for (let owner = 0; owner < 2; owner++) {
    const ctx = new AudioContext({ sampleRate: 8000, record: true });
    const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(ctx.destination); source.start();
    const replay = new AudioReplay(8000), result = replay.apply(ctx.takeOps(4));
    assert.ok(result.pcm.some(value => value > .1), `owner ${owner} receives its PCM, not only a stale buffer ID`);
  }
});


test('Sound preparation does not activate output and a disposed owner cannot adopt a late result', async () => {
  const G = globalThis;
  G.window ??= G; G.addEventListener ??= () => {}; G.removeEventListener ??= () => {};
  const { Sound } = await import('../src/audio.js');
  const table = { one: { n: 1, vol: 1 } };
  let release;
  const options = { table, base: 'cancelled-owner/', makeDecoder: decoder, fetcher: () => new Promise(resolve => { release = () => resolve(response()); }) };
  const first = new Sound('desert', { autoStart: false, listen: false, muted: true });
  const second = new Sound('desert', { autoStart: false, listen: false, muted: true });
  try {
    const pending = first.prepareEffects(options);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(!first.ctx); assert.ok(!first.bank);
    const rejected = assert.rejects(pending, /disposed/);
    first.dispose(); release(); await rejected;
    const ready = await second.prepareEffects(options);
    assert.equal(ready.ready, true); assert.ok(!second.ctx); assert.ok(!second.bank);
  } finally { first.dispose(); second.dispose(); }
});


for (const stalledAt of ['fetch', 'body', 'decode']) test(`a hung ${stalledAt} has a deadline and cannot overwrite a successful Retry`, async () => {
  const ctx = decoder(), old = ctx.createBuffer(1, 80, 8000), fresh = ctx.createBuffer(1, 160, 8000);
  let release, requestedSignal, first = true;
  const stuck = () => new Promise(resolve => { release = resolve; });
  ctx.decodeAudioData = () => first && stalledAt === 'decode' ? stuck() : Promise.resolve(fresh);
  const bank = new SampleBank(ctx, { table: { cue: { n: 1, vol: 1 } }, timeoutMs: 10,
    fetcher: async (_, options) => {
      requestedSignal = options.signal;
      if (first && stalledAt === 'fetch') return stuck();
      return { ok: true, arrayBuffer: () => first && stalledAt === 'body' ? stuck() : Promise.resolve(new ArrayBuffer(8)) };
    } });
  await assert.rejects(bank.preload(), error => error.name === 'SoundEffectsLoadError' && /timed out/.test(error.failures[0].message));
  assert.equal(bank.state('cue'), 'failed'); assert.equal(bank.active.size, 0);
  assert.equal(requestedSignal.aborted, true);
  first = false;
  await bank.preload(4, { retry: true });
  assert.equal(bank.groups.get('cue').buffers[0], fresh);
  release(stalledAt === 'fetch' ? response() : stalledAt === 'body' ? new ArrayBuffer(8) : old);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bank.groups.get('cue').buffers[0], fresh);
  assert.equal(bank.groups.get('cue').takeBuffers[0], fresh, 'late old result cannot replace the retry cache');
  assert.equal(bank.active.size, 0); assert.equal(bank.pendingLoads.size, 0);
  bank.dispose();
});

test('disposal ends a hung decode without waiting for the deadline or enabling playback', async () => {
  const ctx = decoder(); ctx.decodeAudioData = () => new Promise(() => {});
  const bank = new SampleBank(ctx, { table: { cue: { n: 1, vol: 1 } }, fetcher: async () => response() });
  const pending = assert.rejects(bank.preload(), /couldn’t load/);
  await new Promise(resolve => setImmediate(resolve));
  bank.dispose(); await pending;
  assert.equal(bank.pendingLoads.size, 0); assert.equal(bank.active.size, 0);
});


test('one deadline ends the whole stalled bank, and Retry can finish every assigned take', async () => {
  const table = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`cue${i}`, { n: 5, vol: 1 }]));
  let stalled = true, asked = 0;
  const ctx = decoder(), bank = new SampleBank(ctx, { table, timeoutMs: 10,
    fetcher: async () => { asked++; return stalled ? new Promise(() => {}) : response(); } });
  const began = performance.now();
  await assert.rejects(bank.preload(), error => error.name === 'SoundEffectsLoadError' && error.failures.some(f => /timed out/.test(f.message)));
  assert.ok(performance.now() - began < 1000, 'bank exits on first terminal deadline, not one deadline per queued group');
  assert.equal(asked, 20, 'only the initial four groups are requested; queued groups never begin');
  assert.equal(bank.pendingLoads.size, 0);
  assert.equal(bank.active.size, 0);
  stalled = false; await bank.preload(4, { retry: true });
  assert.equal(bank.groups.size, 21);
  assert.ok([...bank.groups.values()].every(g => g.state === 'ready'));
  assert.equal(asked, 125, 'Retry includes all105 assigned takes');
  bank.dispose();
});
