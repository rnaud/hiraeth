import test from 'node:test';
import assert from 'node:assert/strict';
import { SCORES, scoreFor, scoreBeat, CALM_ACT } from '../src/score.js';
import { KINDS } from '../src/score-voices.js';
import { OWN_KINDS, Sound } from '../src/audio.js';
import { MusicMoments } from '../src/music-moments.js';
import { prologueMusic } from '../src/ship/cinematics.js';

// Issue #149: "It doesn't make sense for the desert music to play in the prologue since it's in the ship. We
// should have another music for the ship." The ship has its own score; the desert's (and its recorded theme) come
// in as you step out.

globalThis.window ??= { addEventListener() {} };

test('the ship has a score of its own: quiet, no drums, every note playable, the desert\'s tonic', () => {
  const S = SCORES.ship;
  assert.ok(S && S.title, 'a ship score');
  assert.equal(scoreFor('ship'), S);
  assert.equal(S.perc, null, 'no drums in the ship');
  assert.equal(S.root, SCORES.desert.root, 'on the desert\'s tonic: the step out opens a door, not a new key');
  assert.notEqual(S.mode, SCORES.desert.mode);
  const playable = new Set([...KINDS.notes, ...KINDS.held, ...OWN_KINDS]);
  for (let b = 0; b < 400; b++) for (const e of scoreBeat('ship', b, { ...CALM_ACT, move: 1 })) {
    if (e.layer !== 'perc') assert.ok(playable.has(e.kind) || e.layer === 'color', `ship: ${e.layer} ${e.kind} is playable`);
  }
});

/** A Sound without its audio graph: the fields the score and the moments use. */
function bare() {
  const s = Object.create(Sound.prototype);
  s.scoreId = 'desert'; s.S = scoreFor('desert');
  s.profile = { root: s.S.root, scale: s.S.scale, tempo: s.S.tempo };
  s.voice = { lead: s.S.pal.lead, pluck: s.S.pal.pluck, melody: s.S.motif };
  s.ctx = { currentTime: 0 };
  s.moments = new MusicMoments({ now: 0 });
  // the recorded theme loaded and playing (as on arriving)
  s.trackBuffer = {}; s.trackGain = { gain: { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} } };
  s.recordedTrack = { stop() {}, disconnect() {} }; s.trackOn = true;
  return s;
}

test('in the ship the ship\'s score plays and the desert\'s theme is held; it comes in as you step out', () => {
  const s = bare();
  prologueMusic(s, 'ship');
  assert.equal(s.scoreId, 'ship');
  assert.equal(s.profile.tempo, SCORES.ship.tempo);
  assert.equal(s.voice.lead, SCORES.ship.pal.lead);
  s.musicMomentsUpdate(0);
  assert.equal(s.trackOn, false, 'the desert\'s recorded theme fades out in the ship');
  // the father's message: no score under it
  prologueMusic(s, 'quiet');
  assert.equal(s.scoreOff, true);
  s.ctx.currentTime = 200;   // (past the arrival's 150 s: only the step out brings the theme back)
  s.musicMomentsUpdate(0);
  assert.equal(s.trackOn, false);
  // stepping out
  prologueMusic(s, 'desert');
  assert.equal(s.scoreId, 'desert');
  assert.equal(s.scoreOff, false);
  assert.equal(s.profile.root, SCORES.desert.root);
  s.musicMomentsUpdate(0);
  assert.equal(s.trackOn, true, 'the desert\'s theme comes in as you step out');
});

test('the prologue\'s director asks for the ship\'s music at the start, quiet at the message, the desert\'s at the step out', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/ship/cinematics.js', import.meta.url), 'utf8');
  const enter = src.slice(src.indexOf('export class PrologueDirector'), src.indexOf('export class PrologueDirector') + 20000);
  const at = (stage) => enter.indexOf(`case '${stage}'`);
  const call = (phase) => enter.indexOf(`prologueMusic(s.sound, '${phase}')`);
  assert.ok(call('ship') > at('black') && call('ship') < at('wake'), 'the ship\'s music from the first black');
  assert.ok(call('quiet') > at('call') && call('quiet') < at('pause'), 'quiet from the father\'s message');
  assert.ok(call('desert') > at('stepout'), 'the desert\'s as you step out');
  assert.match(src, /finish\(skipped\) \{[\s\S]{0,120}prologueMusic\(s\.sound, 'desert'\)/, 'and when the prologue is skipped');
});
