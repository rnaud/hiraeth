// Issue #207: "The desert level music is not very good. It's too on the nose, almost a parody." The author's direction:
// "more ambient, mysterious rather than aggressive; a melange of old-school oud music and modern electronic music,
// since it's still a world of space exploration." The desert's score (src/score.js SCORES.desert) is a modelled oud
// (src/score-voices.js luteString), sparse, into a slow echo, over a soft analog pad and a low drone with the wind in
// it, a granular shimmer, the father's theme on an ondes-like sine; no frame drum. Its old Suno recording (D hijaz, a
// frame drum) is retired; a new one made to match the score ("Descent into D Bayati", desert-bayati.mp3) plays the
// moments (arriving, indoors, a moment), the score's light layers between. Until it has decoded, or where it can't,
// the score carries its own moments.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installAudio } from '../engine/webaudio.js';
import { SCORES, MODES, scoreFor, scoreBeat, sectionBeats, CALM_ACT, scoreFreq } from '../src/score.js';
import { KINDS, luteString, LUTE_BASES } from '../src/score-voices.js';
import { SOUNDTRACKS } from '../src/soundtracks.js';
import { MusicMoments, MUSIC_MOMENTS } from '../src/music-moments.js';

const G = globalThis;
G.window ??= G; G.addEventListener ??= () => {}; G.removeEventListener ??= () => {};
delete G.AudioContext; installAudio(G, { sampleRate: 48000 });
const { Sound, OWN_KINDS } = await import('../src/audio.js');
const { prologueMusic } = await import('../src/ship/cinematics.js');

const S = SCORES.desert;
const WALK = { ...CALM_ACT, move: 1 };
const spb = 60 / S.tempo;
/** Every event of the desert's first `secs` seconds. */
const events = (secs, act = CALM_ACT) => { const out = []; for (let b = 0; b < secs / spb; b++) for (const e of scoreBeat('desert', b, act)) out.push({ ...e, beat: b }); return out; };
const perMinute = (list, secs) => (list.length * 60) / secs;

test('the desert\'s score: D bayati, slow, its oud and its electronics, no frame drum', () => {
  assert.equal(S.mode, 'bayati');
  assert.deepEqual(scoreFor('desert').scale, MODES.bayati);
  assert.equal(S.root, SCORES.ship.root, 'on the ship\'s tonic (D): the step out is a door, not a new key');
  assert.ok(S.tempo <= 60, 'slow');
  assert.deepEqual(S.pal, { drone: 'dune', pad: 'nebula', bass: 'sine', pluck: 'lute', lead: 'lute', father: 'ondes', echo: 'lute' });
  for (const k of ['lute', 'ondes']) assert.ok(KINDS.notes.includes(k) && !OWN_KINDS.has(k), k);
  for (const k of ['dune', 'nebula']) assert.ok(KINDS.held.includes(k), k);
  assert.ok(KINDS.colours.includes(S.color.kind) && S.color.kind === 'grains');
  for (const k of Object.values(S.perc.hits)) assert.ok(['heart', 'dust'].includes(k), `a slow pulse, not a frame drum: ${k}`);
  assert.ok(S.echo && S.moments);
  // the quarter-flat second only in the motif (a phrase, sparingly): never under the pad, the drone or the plucks
  for (const e of events(600, WALK)) {
    if (e.degree === undefined) continue;
    const semi = Math.round(1200 * Math.log2(scoreFreq(S, e.degree, e.octave) / S.root)) / 100, pc = ((semi % 12) + 12) % 12;
    if (Math.abs(pc - 1.5) < 0.01) assert.ok(['lead', 'echo'].includes(e.layer), `${e.layer} on the quarter tone`);
  }
});

test('ambient, not aggressive: few notes, lots of space, a slow pulse at most', () => {
  const secs = 600;
  const notes = (act) => events(secs, act).filter((e) => ['lead', 'pluck', 'echo', 'father'].includes(e.layer));
  assert.ok(perMinute(notes(CALM_ACT), secs) < 20, `standing: ${perMinute(notes(CALM_ACT), secs).toFixed(1)} notes a minute`);
  assert.ok(perMinute(notes(WALK), secs) < 32, `walking: ${perMinute(notes(WALK), secs).toFixed(1)} notes a minute`);
  const pulse = (act) => events(secs, act).filter((e) => e.layer === 'perc');
  assert.equal(pulse(CALM_ACT).length, 0, 'no pulse standing');
  assert.ok(perMinute(pulse(WALK), secs) <= 30, `walking: ${perMinute(pulse(WALK), secs).toFixed(1)} beats a minute (the old frame drum: about 60)`);
  // whole sections with no note at all standing (the drone, the pad, the shimmer): room to breathe
  const busy = new Set(notes(CALM_ACT).map((e) => Math.floor(e.beat / sectionBeats(S))));
  assert.ok(busy.size < (secs / spb / sectionBeats(S)) * 0.8, `${busy.size} sections of ${Math.round(secs / spb / sectionBeats(S))} with a note`);
});

test('the modelled oud: in tune in every register, plucked and dying away, the same every time', () => {
  const sr = 24000;
  for (const f of LUTE_BASES) {
    const x = luteString(sr, f);
    assert.deepEqual(x, luteString(sr, f), 'seeded');
    assert.ok(x.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.9001));
    // pitch by autocorrelation, 0.3 to 0.6 s in
    const a = Math.round(0.3 * sr), n = Math.round(0.3 * sr), ac = (lag) => { let s = 0; for (let i = a; i < a + n; i++) s += x[i] * x[i + lag]; return s; };
    let best = -Infinity, lag = 0;
    for (let l = Math.floor(sr / (f * 1.25)); l <= Math.ceil(sr / (f / 1.25)); l++) { const v = ac(l); if (v > best) { best = v; lag = l; } }
    const y0 = ac(lag - 1), y1 = ac(lag), y2 = ac(lag + 1), p = lag + (0.5 * (y0 - y2)) / (y0 - 2 * y1 + y2);
    const cents = 1200 * Math.log2(sr / p / f);
    assert.ok(Math.abs(cents) < 6, `${f} Hz: ${cents.toFixed(1)} cents`);
    const db = (s, e) => { let q = 0; for (let i = Math.round(s * sr); i < Math.round(e * sr); i++) q += x[i] * x[i]; return 10 * Math.log10(q / ((e - s) * sr)); };
    assert.ok(db(0, 0.1) - db(1.4, 1.6) > 20, `${f} Hz: it dies away`);
  }
});

/** A desert Sound on the JS Web Audio, its scheduler driven by hand. */
function desert() {
  const s = new Sound('desert', { score: false });
  s.start(); clearInterval(s.scheduler); clearTimeout(s._preload);
  return s;
}
const CALM = { speed: 0, gust: 0, storm: 0, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0, indoor: 0 };
/** Play `secs` of it (the frame's update and the scheduler every 0.1 s): the events the score played, its sound. */
function play(s, secs, state = CALM, onTick) {
  const played = [], real = s.playEvent;
  s.playEvent = function (e, t0, sp) { played.push(e); return real.call(this, e, t0, sp); };
  const chunks = [];
  for (let k = 0; k < secs * 10; k++) { onTick?.(s, k / 10); s.update(state); s.schedule(); chunks.push(s.ctx.render(4800)); }
  s.playEvent = real;
  const out = new Float32Array(chunks.reduce((a, c) => a + c.length, 0));
  let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return { played, out };
}
const rms = (a) => { let q = 0; for (let i = 0; i < a.length; i++) q += a[i] * a[i]; return Math.sqrt(q / Math.max(1, a.length)); };

test('the music graph builds and plays: its echo and the oud\'s registers made once, sound and nothing broken', () => {
  const s = desert();
  s.voice.ambience = 'none'; s.fx.gain.value = 0;
  const { played, out } = play(s, 20);
  assert.ok(s._echo, 'the echo, made once');
  assert.ok(s._luteReady && s.V.lute.length === LUTE_BASES.length && s.V.lute.every(Boolean), 'the oud\'s registers, rendered a tick at a time');
  assert.ok(played.some((e) => e.layer === 'lead' && e.kind === 'lute'), 'the oud\'s motif in the first section');
  assert.ok(out.every(Number.isFinite));
  const level = 20 * Math.log10(rms(out));
  assert.ok(level > -50 && level < -15, `${level.toFixed(1)} dBFS`);
  s.dispose?.();
});

test('the CPU budget: fewer nodes a minute than the old desert score, the notes\' work done ahead', () => {
  const s = desert();
  const made = { osc: 0, src: 0, filt: 0 }, ctx = s.ctx;
  const count = (k, fn) => (...a) => { made[k]++; return fn(...a); };
  ctx.createOscillator = count('osc', ctx.createOscillator.bind(ctx));
  ctx.createBufferSource = count('src', ctx.createBufferSource.bind(ctx));
  ctx.createBiquadFilter = count('filt', ctx.createBiquadFilter.bind(ctx));
  const secs = 60, k = 60 / secs;
  let schedMs = 0;
  const realSchedule = s.schedule;
  s.schedule = function () { const t = performance.now(); realSchedule.call(this); schedMs += performance.now() - t; };
  play(s, secs, { ...CALM, speed: 4.5 });   // walking, the score in full (its arrival): the busiest it gets
  // (the old desert score walking in full, measured the same way in headless Chrome: 123 oscillators, 49 buffer
  // sources and 94 filters a minute)
  assert.ok(made.osc * k < 80, `${made.osc * k} oscillators a minute`);
  assert.ok(made.src * k < 70, `${made.src * k} buffer sources a minute`);
  assert.ok(made.filt * k < 60, `${made.filt * k} filters a minute`);
  assert.ok(schedMs / secs < 25, `the scheduler: ${(schedMs / secs).toFixed(2)} ms a second of music (the engine bridge renders here too)`);
  s.dispose?.();
});

/** A Sound without its audio graph, for the moments and the prologue: what the scheduler would play, beat by beat. */
function bare() {
  const s = Object.create(Sound.prototype);
  s.scoreId = 'desert'; s.S = scoreFor('desert');
  s.profile = { root: s.S.root, scale: s.S.scale, tempo: s.S.tempo };
  s.voice = { lead: s.S.pal.lead, pluck: s.S.pal.pluck, melody: s.S.motif, ambience: 'none' };
  s.act = { ...CALM_ACT };
  s.ctx = { currentTime: 0 };
  // (the quiet's own return, after one of returnAfter [300, 480] s drawn when the first quiet starts, pinned to its
  // longest: drawn at random it could fall inside a test's later stretch and bring the theme back by itself)
  s.moments = new MusicMoments({ mode: 'moments', now: 0, rand: () => 1 });
  s.V = {}; s._echo = {}; s._luteReady = true;
  s.beat = 0; s.nextBeat = 0;
  s.played = [];
  s.playEvent = (e) => s.played.push(e.layer);
  s.ambienceTick = () => {};
  return s;
}
/** Advance the bare Sound to `t` s, then play `secs` more: the layers it played. */
function layersAt(s, t, secs = 40, indoor = 0) {
  s.ctx.currentTime = t; s.nextBeat = t; s.musicMomentsUpdate(indoor);
  s.played = [];
  for (let k = 0; k < secs * 10; k++) { s.ctx.currentTime = t + k / 10; s.musicMomentsUpdate(indoor); s.schedule(); }
  return new Set(s.played);
}

/** The bare Sound with the desert's recording decoded (src/soundtracks.js startTrack, as on arriving): its gain's ramps logged. */
function withRecording(s) {
  s.ramps = [];
  const g = { value: 1, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v, t) { s.ramps.push([+(t - s.ctx.currentTime).toFixed(3), v]); this.value = v; } };
  s.trackBuffer = {}; s.trackGain = { gain: g };
  s.ctx.createBufferSource = () => ({ connect() {}, start() {}, stop() {}, disconnect() {} });
  s.recordedTrack = { stop() {}, disconnect() {} }; s.trackOn = true;
  return s;
}

test('the desert\'s recording (issue #207): on arriving, indoors and at a moment; the score\'s light layers between; crossfaded', () => {
  assert.equal(SOUNDTRACKS.desert, 'desert-bayati.mp3', 'its new recording, "Descent into D Bayati"');
  const s = withRecording(bare());
  // arriving: the recording, and no procedural note on top of it
  assert.equal(layersAt(s, 0, 40).size, 0, 'arriving: the recording alone');
  assert.equal(s.trackOn, true);
  // the arrival's 150 s over: the recording fades out over 10 s and the score's light layers come in under it
  const between = layersAt(s, MUSIC_MOMENTS.arrival + 1, 120);
  assert.equal(s.trackOn, false);
  assert.deepEqual(s.ramps.at(-1), [MUSIC_MOMENTS.fadeOut, 0], 'faded out, not cut');
  for (const l of ['lead', 'father', 'bass', 'perc']) assert.ok(!between.has(l), `between the moments, no ${l}`);
  assert.ok(between.has('drone') && between.has('pad'), 'the drone and the pad carry the quiet');
  s.act.move = 1;   // walking between moments: still only the light layers
  assert.ok(!layersAt(s, MUSIC_MOMENTS.arrival + 200, 60).has('perc'));
  s.act.move = 0;
  // indoors: the recording again, faded in over 3 s from where the gain is; the score stops
  assert.equal(layersAt(s, MUSIC_MOMENTS.arrival + 300, 10, 1).size, 0, 'indoors: the recording alone');
  assert.equal(s.trackOn, true);
  assert.deepEqual(s.ramps.at(-1), [MUSIC_MOMENTS.fadeIn, 1], 'faded in');
  // out again, the tail of the interior, then the quiet; a moment brings the recording back
  layersAt(s, s.ctx.currentTime + 1, MUSIC_MOMENTS.indoorTail + 15);
  assert.equal(s.trackOn, false);
  // a long quiet: it comes back by itself, returnAfter's longest (480 s, rand pinned) after the first quiet began
  const back = MUSIC_MOMENTS.arrival + 1 + MUSIC_MOMENTS.returnAfter[1];   // (the quiet first seen at arrival + 1)
  layersAt(s, s.ctx.currentTime + 1, back - 1 - (s.ctx.currentTime + 1));
  assert.equal(s.trackOn, false, 'not before its time');
  layersAt(s, back, 2);
  assert.equal(s.trackOn, true, 'back by itself after a long quiet');
  layersAt(s, s.ctx.currentTime + 1, MUSIC_MOMENTS.back + 15);
  assert.equal(s.trackOn, false);
  s.moments.cue('moment', s.ctx.currentTime + 1);
  layersAt(s, s.ctx.currentTime + 1, 1);
  assert.equal(s.trackOn, true, 'a moment brings it back');
  clearTimeout(s._trackStop);
  // Settings > Music: Always
  const a = withRecording(bare()); a.moments.setMode('always');
  assert.equal(layersAt(a, 1000, 5).size, 0);
  assert.equal(a.trackOn, true);
});

test('until its recording has decoded (or where it can\'t), the score keeps its own moments: in full on arriving, indoors and at a moment', () => {
  const s = bare();
  const arrive = layersAt(s, 0, 40);
  assert.equal(s.scoreMoment, true);
  assert.ok(arrive.has('lead') && arrive.has('father'), 'arriving: the motif and the father\'s theme');
  const between = layersAt(s, MUSIC_MOMENTS.arrival + 20, 120);
  assert.equal(s.scoreMoment, false);
  for (const l of ['lead', 'father', 'bass', 'perc']) assert.ok(!between.has(l), `between the moments, no ${l}`);
  assert.ok(between.has('drone') && between.has('pad'), 'the drone and the pad carry the quiet');
  layersAt(s, MUSIC_MOMENTS.arrival + 300, 5, 1);
  assert.equal(s.scoreMoment, true, 'indoors: in full');
  s.moments.cue('moment', s.ctx.currentTime + 1);
  layersAt(s, s.ctx.currentTime + 1, 1);
  assert.equal(s.scoreMoment, true, 'a moment brings it back');
  const a = bare(); a.moments.setMode('always');
  layersAt(a, 1000, 5);
  assert.equal(a.scoreMoment, true);
});

test('the prologue: the ship\'s own score, nothing under the father\'s message, the desert\'s recording as you step out', () => {
  const s = withRecording(bare());
  prologueMusic(s, 'ship');
  const ship = layersAt(s, 0, 30);
  assert.equal(s.scoreId, 'ship');
  assert.ok(ship.has('drone'), 'the ship\'s score');
  assert.equal(s.trackOn, false, 'the desert\'s recording held back in the ship');
  prologueMusic(s, 'quiet');
  assert.equal(layersAt(s, 30, MUSIC_MOMENTS.arrival).size, 0, 'nothing under the father\'s message');
  assert.equal(s.trackOn, false, 'not the recording either');
  prologueMusic(s, 'desert');
  assert.equal(s.scoreId, 'desert');
  const out = layersAt(s, s.ctx.currentTime, 20);   // (past the world's first 150 s: the step out is its arrival)
  assert.equal(s.trackOn, true, 'the desert\'s recording as you step out');
  assert.deepEqual(s.ramps.at(-1), [MUSIC_MOMENTS.fadeIn, 1]);
  assert.equal(out.size, 0, 'and no score on top of it');
  // and the arrival's 150 s from the step out, then the quiet
  layersAt(s, s.ctx.currentTime, MUSIC_MOMENTS.arrival - 25);
  assert.equal(s.trackOn, true);
  layersAt(s, s.ctx.currentTime, 10);
  assert.equal(s.trackOn, false);
  clearTimeout(s._trackStop);
  // with no recording decoded: the score in full from its first section
  const b = bare();
  prologueMusic(b, 'ship'); layersAt(b, 0, 5);
  prologueMusic(b, 'quiet'); layersAt(b, 5, 160);
  prologueMusic(b, 'desert');
  assert.equal(b.beat, 0, 'from its first section');
  const o2 = layersAt(b, b.ctx.currentTime, 20);
  assert.equal(b.scoreMoment, true);
  assert.ok(o2.has('drone') && o2.has('lead'), 'the drone and the oud\'s motif at once');
});
