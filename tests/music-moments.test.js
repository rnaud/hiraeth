import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicMoments, MUSIC_MOMENTS as T, lightScore, musicMode } from '../src/music-moments.js';
import { scoreBeat } from '../src/score.js';

test('the theme plays on arrival, then fades out to let ambience carry the world', () => {
  const m = new MusicMoments({ now: 0, rand: () => 0 });
  assert.deepEqual(m.update(1), { on: true, why: 'arrival' });
  assert.equal(m.update(T.arrival - 1).on, true);
  assert.deepEqual(m.update(T.arrival + 1), { on: false, why: 'quiet' });
});

test('a moment brings it back (after its delay) and holds it', () => {
  const m = new MusicMoments({ now: 0, rand: () => 0.5 });
  m.update(T.arrival + 10);
  m.cue('moment', T.arrival + 20, { delay: 4 });
  assert.equal(m.update(T.arrival + 22).on, false, 'the swell plays first');
  assert.deepEqual(m.update(T.arrival + 25), { on: true, why: 'moment' });
  assert.equal(m.update(T.arrival + 24 + T.moment - 1).on, true);
  assert.equal(m.update(T.arrival + 24 + T.moment + 1).on, false);
  // a cue while it plays only lengthens it
  const n = new MusicMoments({ now: 0 });
  n.cue('moment', 10);
  assert.equal(n.from, 0);
  assert.equal(n.until, Math.max(T.arrival, 10 + T.moment));
});

test('indoors it plays, and lingers a little after you step out', () => {
  const m = new MusicMoments({ now: 0, rand: () => 0 });
  const t0 = T.arrival + 30;
  assert.equal(m.update(t0).on, false);
  assert.deepEqual(m.update(t0 + 1, { indoor: 1 }), { on: true, why: 'indoor' });
  assert.equal(m.update(t0 + 100, { indoor: 1 }).on, true);
  assert.equal(m.update(t0 + 100 + T.indoorTail - 1, { indoor: 0 }).on, true);
  assert.equal(m.update(t0 + 100 + T.indoorTail + 1, { indoor: 0 }).on, false);
});

test('after a long quiet it comes back by itself, then goes again', () => {
  const m = new MusicMoments({ now: 0, rand: () => 0 });
  const end = T.arrival;
  assert.equal(m.update(end + 1).on, false);
  assert.equal(m.update(end + T.returnAfter[0]).on, false);
  assert.deepEqual(m.update(end + 1 + T.returnAfter[0] + 0.1), { on: true, why: 'back' });
  const back = end + 1 + T.returnAfter[0] + 0.1;
  assert.equal(m.update(back + T.back + 1).on, false);
  // (the next return is drawn again, from the end of this one)
  assert.equal(m.update(back + T.back + 2).on, false);
});

test('Always keeps the recording on; anything unknown is Moments', () => {
  const m = new MusicMoments({ mode: 'always', now: 0 });
  assert.deepEqual(m.update(10000), { on: true, why: 'always' });
  m.setMode('moments');
  assert.equal(m.update(10001).on, false);
  assert.equal(musicMode('loud'), 'moments');
  assert.equal(musicMode('always'), 'always');
});

test('the light layers: no melody, no drums, no bass, and softer', () => {
  let n = 0;
  for (let beat = 0; beat < 400; beat++) {
    const all = scoreBeat('desert', beat, { move: 1, ride: 0, still: 0, indoor: 0, night: 0, storm: 0 });
    const light = lightScore(all);
    for (const e of light) {
      assert.ok(['drone', 'pad', 'pluck', 'color', 'echo'].includes(e.layer), e.layer);
      const src = all.find((a) => a.layer === e.layer && a.at === e.at && a.degree === e.degree);
      assert.ok(e.vol < src.vol);
    }
    n += light.length;
    assert.ok(!light.some((e) => ['lead', 'father', 'perc', 'bass'].includes(e.layer)));
  }
  assert.ok(n > 20, 'something still plays');
});

test('the Sound fades the recording out after its time and starts it again from the opening at a moment', async () => {
  const { AudioContext } = await import('../engine/webaudio.js');
  const G = globalThis, hadWindow = 'window' in G;
  if (!hadWindow) G.window = G;
  try {
    const { Sound } = await import('../src/audio.js');
    const ctx = new AudioContext({ sampleRate: 8000 });
    const trackGain = ctx.createGain(); trackGain.connect(ctx.destination);
    const s = { ctx, trackBuffer: ctx.createBuffer(1, 800, 8000), trackGain, trackOn: true, recordedTrack: null, moments: new MusicMoments({ now: 0, rand: () => 0 }) };
    s.recordedTrack = ctx.createBufferSource();
    const update = (t) => { ctx.currentTime = t; Sound.prototype.musicMomentsUpdate.call(s, 0); };
    let now = 0;
    Object.defineProperty(ctx, 'currentTime', { get: () => now, set: (v) => { now = v; }, configurable: true });
    update(10);
    assert.equal(s.trackOn, true);
    update(T.arrival + 1);
    assert.equal(s.trackOn, false, 'faded out');
    clearTimeout(s._trackStop);
    s.recordedTrack = null;   // (as the timer does after the fade)
    Sound.prototype.musicCue.call(s, 'moment');
    update(T.arrival + 2);
    assert.equal(s.trackOn, true);
    assert.ok(s.recordedTrack, 'a new source, from the opening');
    clearTimeout(s._trackStop);
  } finally { if (!hadWindow) delete G.window; }
});
