// The voice reference the Unity port's tests compare its voice with (issue #333): scripts/unity-export/voice-reference.mjs
// plans lines with src/story/voice.js, sings them with the web game's renderer (src/voice-synth.js on engine/webaudio.js)
// and measures the sound; export-world.mjs writes it into the desert's world.json (voiceReference), and
// unity/Hiraeth/Assets/Hiraeth/Editor/Tests/VoiceTests.cs measures its own the same way.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { voiceReference, VOICE_LINES, VOICE_REF_RATE, envelope, pitchTrack, bands } from '../scripts/unity-export/voice-reference.mjs';
import { LANGUAGES } from '../src/story/voice.js';

test('the reference: each line\'s plan and its sound measured', () => {
  const R = voiceReference(VOICE_LINES.filter(([, , lang], k) => k === 0 || lang === 'murmur'));
  assert.equal(R.length, 2);
  for (const r of R) {
    assert.ok(r.n > 3 && r.syllables.length === r.n && r.shortN <= 9 + (r.lang === 'murmur' ? 27 : 0), `${r.lang}: ${r.n} syllables`);
    assert.ok(r.voice.f0 > 50 && r.timbre.tilt > 0.8 && r.cps > 1);
    const s = r.sound;
    assert.ok(Math.abs(s.length - Math.round((r.total + 0.5) * VOICE_REF_RATE)) <= 128, `${r.lang}: ${s.length} samples`);   // (rendered in blocks of 128)
    assert.ok(s.rms > 0.005 && s.peak < 1, `${r.lang}: rms ${s.rms}, peak ${s.peak}`);
    assert.equal(s.envelope.length, Math.floor((s.length - 0.02 * VOICE_REF_RATE) / (0.01 * VOICE_REF_RATE)) + 1);
    assert.ok(s.pitch.filter(([f0, rr]) => rr >= 0.8 && f0 >= s.lo && f0 <= s.hi).length > 20, `${r.lang}: voiced frames`);
    assert.equal(s.bands.length, 18);
    assert.ok(Math.abs(s.bands.reduce((a, b) => a + b, 0)) < 0.05, 'the bands\' mean taken off');
  }
  // the murmurs: the chorus's syllables are in the plan (a voice each)
  assert.ok(R[1].syllables.some((x) => x.chorus > 0));
});

test('the measures: a known tone is heard as itself', () => {
  const rate = VOICE_REF_RATE, x = new Float32Array(rate);
  for (let i = 0; i < x.length; i++) x[i] = 0.5 * Math.sin(2 * Math.PI * 200 * i / rate);
  const P = pitchTrack(x, rate, 100, 400);
  assert.ok(P.every(([f0, r]) => Math.abs(f0 - 200) < 3 && r > 0.99));
  assert.ok(envelope(x, rate).every((e) => Math.abs(e - 0.5 / Math.SQRT2) < 0.01));
  const B = bands(x, rate);
  assert.equal(B.indexOf(Math.max(...B)), 1, 'the 200 Hz band the loudest');
});

test('every tongue of a reference line is the game\'s, and the desert\'s export carries it', () => {
  for (const [, , lang] of VOICE_LINES) assert.ok(LANGUAGES[lang], lang);
  const src = readFileSync(new URL('../scripts/unity-export/export-world.mjs', import.meta.url), 'utf8');
  assert.match(src, /voiceReference = \(await import\('\.\/voice-reference\.mjs'\)\)\.voiceReference\(\)/);
});
