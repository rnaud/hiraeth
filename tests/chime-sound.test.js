// The chimes' sound (src/audio.js crystalTing, chimePickup, chimeScatter, purchase): since October 2026 the chimes
// are small crystals, and picking one up rings like struck glass, not brass. Rendered silently, in memory, on the
// engines' Web Audio (engine/webaudio.js): nothing reaches a speaker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioContext, installAudio } from '../engine/webaudio.js';

const rms = (a, from = 0, to = a.length) => { let s = 0, n = 0; for (let i = from; i < to; i += 2) { s += a[i] * a[i]; n++; } return Math.sqrt(s / Math.max(n, 1)); };

/** A Sound on the in-memory context, its score silent, the oscillators it makes recorded (their frequencies). */
async function silentSound() {
  const G = globalThis;
  const saved = { window: G.window, AudioContext: G.AudioContext };
  G.window = G; G.window.addEventListener ??= () => {}; G.window.removeEventListener ??= () => {};
  delete G.AudioContext; installAudio(G);
  const { Sound, CRYSTAL_PARTIALS } = await import('../src/audio.js');
  const s = new Sound('desert', { score: false });
  s.start();
  assert.ok(s.ctx instanceof AudioContext, 'the in-memory context, never a speaker');
  s.ctx.render(4800);
  const made = [];
  const make = s.ctx.createOscillator.bind(s.ctx);
  s.ctx.createOscillator = () => { const o = make(); made.push(o); return o; };
  const done = () => {
    clearInterval(s.scheduler); clearInterval(s.menuTimer); s._unlisten?.();
    if (saved.AudioContext) G.AudioContext = saved.AudioContext; else delete G.AudioContext;
    if (saved.window === undefined) delete G.window;
  };
  return { s, made, done, CRYSTAL_PARTIALS };
}

test('a chime picked up rings like glass: the struck glass\'s inharmonic partials, a shimmering twin, higher than the brass ting', async () => {
  const { s, made, done, CRYSTAL_PARTIALS } = await silentSound();
  try {
    s._chimeAt = -9;
    s.chimePickup(1);
    const f = made.map((o) => o.frequency.value);
    assert.equal(f.length, CRYSTAL_PARTIALS.length, 'one oscillator a partial');
    const f0 = Math.min(...f), ratios = f.map((x) => x / f0).sort((a, b) => a - b);
    CRYSTAL_PARTIALS.map(([k]) => k).sort((a, b) => a - b).forEach((k, i) => assert.ok(Math.abs(ratios[i] - k) < 1e-6, `partial ${k}`));
    assert.ok(ratios.some((r) => r > 1 && r < 1.01), 'the fundamental doubled a hair sharp (it beats)');
    assert.ok(!ratios.some((r) => Math.abs(r - 2.76) < 0.01 || Math.abs(r - 5.4) < 0.01), 'not the brass ting\'s partials');
    assert.ok(Math.abs(f0 - s.freq(0, 3)) < 1e-6, `an octave above the old ting (${f0.toFixed(0)} Hz)`);
    // it sounds, and its tail rings on past the strike, then dies away
    const out = s.ctx.render(48000);
    const head = rms(out, 0, 9600), tail = rms(out, 48000, 57600), end = rms(out, 86400);
    assert.ok(head > 1e-4, `audible (${head.toExponential(1)})`);
    assert.ok(tail > 0 && tail < head, 'a tail after the strike');
    assert.ok(end < head / 10, 'dying away');
    assert.ok(out.every(Number.isFinite), 'finite');
    // a five: a second ting over it, higher
    made.length = 0; s._chimeAt = -9;
    s.chimePickup(5);
    assert.equal(made.length, CRYSTAL_PARTIALS.length * 2);
    assert.ok(Math.min(...made.slice(CRYSTAL_PARTIALS.length).map((o) => o.frequency.value)) > Math.min(...made.slice(0, CRYSTAL_PARTIALS.length).map((o) => o.frequency.value)));
  } finally { done(); }
});

test('a quick run of pickups climbs; a drop and a sale are glassy tings too; muted, nothing at all', async () => {
  const { s, made, done, CRYSTAL_PARTIALS } = await silentSound();
  try {
    const firsts = [];
    s._chimeAt = -9;
    for (let i = 0; i < 4; i++) { made.length = 0; s.chimePickup(1); firsts.push(Math.min(...made.map((o) => o.frequency.value))); }
    assert.ok(firsts.every((f, i) => i === 0 || f > firsts[i - 1]), `climbing (${firsts.map((f) => f.toFixed(0))})`);
    made.length = 0; s.chimeScatter();
    assert.equal(made.length, 3 * CRYSTAL_PARTIALS.length, 'three falling tings');
    made.length = 0; s.purchase(10);
    assert.ok(made.length >= 3 * CRYSTAL_PARTIALS.length, 'counted onto the counter');
    made.length = 0; s.muted = true; s.chimePickup(1); s.chimeScatter(true);
    assert.equal(made.length, 0, 'muted: silent');
  } finally { done(); }
});
