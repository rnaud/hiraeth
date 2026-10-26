// Pure PCM measurements and recorded-theme metadata; no game or filesystem decoder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { measure, variation, judge, envelope, kWeight, dB, ROLES, LIMITS } from '../scripts/sound-qc/lib.mjs';
const RATE = 48000;
/** Interleaved stereo: `secs` of silence with a `f` Hz sine of amplitude `a` from `at` for `len` s (a short fade each end). */
function tone({ secs = 1, at = 0.2, len = 0.2, f = 1000, a = 0.1 } = {}) {
  const n = Math.round(secs * RATE), out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / RATE - at;
    if (t < 0 || t > len) continue;
    const env = Math.min(1, t / 0.002, (len - t) / 0.002);
    out[i * 2] = out[i * 2 + 1] = a * env * Math.sin(2 * Math.PI * f * t);
  }
  return out;
}

test('a tone is measured: its level, its start, its length and its brightness', () => {
  const m = measure(tone({ at: 0.2, len: 0.2, f: 1000, a: 0.1 }), RATE);
  // (a 1 kHz sine of 0.1: -23 dB RMS, the K-weighting lifts 1 kHz by about 0.7 dB)
  assert.ok(Math.abs(m.rms - (dB(0.1 / Math.SQRT2) + 0.7)) < 1, `level ${m.rms}`);
  assert.ok(Math.abs(m.peak - dB(0.1)) < 0.1, `peak ${m.peak}`);
  assert.ok(Math.abs(m.onset - 0.2) < 0.002, `onset ${m.onset}`);
  assert.ok(Math.abs(m.dur - 0.2) < 0.06, `length ${m.dur}`);
  assert.ok(Math.abs(m.centroid - 1000) < 120, `brightness ${m.centroid}`);
  assert.equal(measure(new Float32Array(RATE * 2), RATE), null, 'silence: nothing heard');
});

test('the bed is taken out: a tone over a steady hum is measured as the tone', () => {
  const bed = tone({ at: 0, len: 1, f: 200, a: 0.05 }), both = tone({ at: 0.3, len: 0.2, f: 2000, a: 0.1 }).map((x, i) => x + bed[i]);
  const m = measure(both, RATE, { bed });
  assert.ok(Math.abs(m.onset - 0.3) < 0.03, `onset ${m.onset}`);
});

test('a low thump counts for less than a mid tone of the same RMS (K-weighting)', () => {
  const lo = envelope(kWeight(tone({ f: 60, len: 0.5 })), RATE), mid = envelope(kWeight(tone({ f: 1000, len: 0.5 })), RATE);
  assert.ok(dB(Math.max(...mid)) - dB(Math.max(...lo)) > 1, 'the 60 Hz one quieter');
});

test('repeats: alike takes are repetitive, varied ones are not', () => {
  const same = [1, 2, 3].map(() => measure(tone({ at: 0, f: 1000, a: 0.1 }), RATE));
  const varied = [0.8, 1, 1.25].map((k) => measure(tone({ at: 0, f: 1000 * k, a: 0.1 * k }), RATE));
  assert.equal(judge(same[0], 'action', -20, { v: variation(same) }).verdict, 'repetitive');
  assert.equal(judge(varied[0], 'action', -20, { v: variation(varied) }).verdict, 'OK');
});

test('the verdicts: missing, too quiet, too loud, too late, too long, OK', () => {
  const m = measure(tone({ a: 0.1 }), RATE), ref = m.rms;
  assert.equal(judge(m, 'action', ref, { wired: false }).verdict, 'missing');
  assert.equal(judge(null, 'action', ref).verdict, 'missing');
  assert.equal(judge(m, 'action', ref + ROLES.action.hi + 30).verdict, 'too quiet');
  assert.equal(judge(m, 'foley', ref - 20).verdict, 'too loud');
  assert.equal(judge({ ...m, onset: 0 }, 'action', ref, { press: LIMITS.press + 0.05 }).verdict, 'too late');
  assert.equal(judge({ ...m, onset: 0, dur: 3 }, 'ui', ref + 15).verdict, 'too long');
  assert.equal(judge({ ...m, onset: 0 }, 'action', ref + 5).verdict, 'OK');
});

test('the mix\'s reference is the recording that plays: the world\'s theme at the engines\' gain (src/theme-levels.js)', async () => {
  const { themeOf } = await import('../scripts/sound-qc/render-core.mjs');
  const { SOUNDTRACKS } = await import('../src/soundtracks.js');
  const { THEME_LEVELS } = await import('../src/theme-levels.js');
  assert.deepEqual(themeOf('desert'), { file: SOUNDTRACKS.desert, gain: THEME_LEVELS[SOUNDTRACKS.desert] });
  for (const lv of ['desert', 'bazaar', 'home']) assert.ok(THEME_LEVELS[themeOf(lv).file] > 0, `${lv}: a measured gain`);
  assert.equal(themeOf('no-such-world'), null, 'no recording: the procedural score is the fallback');
});
