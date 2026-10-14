// Issue #318: "the procedural score sounds too similar level to level". Every world plays a score of its own (eight
// worlds off the route played the desert's, and the Glass Dunes the Hangar's note for note), and no two scores are
// near each other: a feature vector per score (scripts/score-features.mjs: tempo, metre, mode and key, the
// instruments, notes a second, register, where in the beat the notes fall, drums) and a distance between two. The
// scores are also rendered offline (engine/webaudio.js) to check that each sounds, and none is louder or brighter
// (harsher) than the scores were before.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as score from '../src/score.js';
import { TITLES } from '../src/levels/names.js';
import { SOUNDTRACKS } from '../src/soundtracks.js';
import { scoreFeatures, distanceParts, scoreDistance, nearestPairs, renderFeatures } from '../scripts/score-features.mjs';

const { SCORES, SCORE_OF, scoreFor } = score;
const IDS = Object.keys(SCORES);
const feats = IDS.map((id) => scoreFeatures(score, id));
/** The nearest two scores may come: before #318 the Hangar and the Glass Dunes were 0.77 apart, a detour and the desert 0.05. */
const MIN_DISTANCE = 2.4;
/** Two scores share at most half their instruments (drone, pad, bass, pluck, lead, the father's voice, hits, colour). */
const MIN_TIMBRE = 0.5;

test('every world has a score of its own (or plays another\'s on purpose), none the desert\'s by default', () => {
  const worlds = new Set([...Object.keys(TITLES), ...Object.keys(SOUNDTRACKS)]);
  for (const id of worlds) {
    if (id === 'desert') continue;
    assert.ok(SCORES[id] || SCORE_OF[id], `${id} has a score (src/score.js SCORES) or names whose it plays (SCORE_OF)`);
    assert.notEqual(scoreFor(id), SCORES.desert, `${id} doesn't fall back to the desert's`);
  }
  assert.equal(scoreFor('lantern'), SCORES.home, 'the Lantern plays home\'s, as it plays home\'s recording');
  assert.equal(scoreFor('lab'), SCORES.desert, 'the Lab and unknown ids still play the desert\'s');
});

test('no two scores are near each other (features from what they play)', () => {
  const pairs = nearestPairs(feats);
  const near = pairs.filter((p) => p.d < MIN_DISTANCE).map((p) => `${p.a} ~ ${p.b}: ${p.d.toFixed(2)} (${Object.entries(p.parts).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ')})`);
  assert.deepEqual(near, [], 'too alike: give one of them its own tempo, rhythm, register or instruments');
  const sameSound = pairs.filter((p) => p.parts.timbre < MIN_TIMBRE).map((p) => `${p.a} ~ ${p.b}: timbre ${p.parts.timbre.toFixed(2)}`);
  assert.deepEqual(sameSound, [], 'two scores on (nearly) the same instruments');
});

test('the scores spread over tempo, metre, modes, registers and rhythms', () => {
  const tempos = feats.map((f) => f.tempo), meters = new Set(feats.map((f) => f.meter));
  assert.ok(Math.max(...tempos) - Math.min(...tempos) >= 40, 'tempos from slow to busy');
  assert.ok(meters.size >= 5, `metres: ${[...meters]}`);
  assert.ok(new Set(IDS.map((id) => SCORES[id].mode)).size >= 10, 'modes');
  const regs = feats.map((f) => f.register);
  assert.ok(Math.max(...regs) - Math.min(...regs) >= 12, 'an octave or more between the lowest-lying score and the highest');
  // swung, triplet and straight worlds: where the notes fall in the beat
  const off = (f, bins) => bins.reduce((s, i) => s + f.rhythm[i], 0);
  assert.ok(feats.some((f) => off(f, [8]) > 0.05), 'a swung or triplet world (notes two thirds into the beat)');
  assert.ok(feats.some((f) => off(f, [4]) > 0.05), 'a triplet world (a third into the beat)');
  assert.ok(feats.some((f) => off(f, [3, 9]) > 0.05), 'a world in sixteenths');
  assert.ok(IDS.filter((id) => SCORES[id].figure).length >= 8, 'worlds with a written figure of their own, not only random plucks');
});

test('the distance is a distance: zero to itself, the same both ways', () => {
  const [a, b] = feats;
  assert.equal(scoreDistance(a, a), 0);
  assert.equal(scoreDistance(a, b), scoreDistance(b, a));
  for (const v of Object.values(distanceParts(a, b))) assert.ok(v >= 0 && v <= 1);
});

test('a world\'s figure: in its mode, deterministic, louder walking than standing about', () => {
  const { scoreBeat, CALM_ACT } = score;
  for (const id of IDS.filter((i) => SCORES[i].figure)) {
    const walk = [], still = [];
    for (let b = 0; b < 256; b++) {
      for (const e of scoreBeat(id, b, { ...CALM_ACT, move: 1 })) if (e.layer === 'pluck') walk.push(e);
      for (const e of scoreBeat(id, b, { ...CALM_ACT, still: 60 })) if (e.layer === 'pluck') still.push(e);
    }
    assert.ok(walk.length > 20, `${id}: the figure plays`);
    assert.ok(walk.every((e) => Number.isInteger(e.degree) && e.at >= 0 && e.at < 1), `${id}: on the scale, within its beat`);
    const loud = (es) => es.reduce((s, e) => s + e.vol, 0);
    assert.ok(loud(still) < loud(walk), `${id}: quieter standing about`);
    assert.deepEqual(scoreBeat(id, 77, { ...CALM_ACT, move: 1 }), scoreBeat(id, 77, { ...CALM_ACT, move: 1 }), `${id}: deterministic`);
  }
});

test('every score sounds, rendered offline, and none is louder or brighter than the scores were before #318', async () => {
  const setT = globalThis.setTimeout, setI = globalThis.setInterval;
  globalThis.setTimeout = (...a) => { const h = setT(...a); h?.unref?.(); return h; };
  globalThis.setInterval = (...a) => { const h = setI(...a); h?.unref?.(); return h; };
  try {
    for (const id of IDS) {
      const r = await renderFeatures(id, { secs: 8 });
      assert.ok(Number.isFinite(r.rms) && r.rms > -36, `${id}: something plays (${r.rms.toFixed(1)} dB)`);
      // (before: -24.9 to -30.8 dB RMS, the top band at most 6 % of the energy: the bazaar's)
      assert.ok(r.rms < -24, `${id}: no louder than the loudest before (${r.rms.toFixed(1)} dB)`);
      assert.ok(r.high < 0.07, `${id}: no brighter than the brightest before (${(r.high * 100).toFixed(1)} % above 2 kHz)`);
      assert.ok(r.peak < 0.5, `${id}: peaks (${r.peak.toFixed(2)})`);
    }
  } finally { globalThis.setTimeout = setT; globalThis.setInterval = setI; }
});
