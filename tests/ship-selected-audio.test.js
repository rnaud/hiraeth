import test from 'node:test';
import assert from 'node:assert/strict';
import { ShipAudio } from '../src/ship/audio-controller.js';
import { engines, hum, deck } from '../src/ship/sfx.js';
import { pirateSounds } from '../src/minigames/pirates-sfx.js';

function fixture() {
  const plays = [], fallback = [], active = new Set();
  const s = { ctx: { currentTime: 0 }, fx: {}, muted: false };
  s.bank = {
    ready: true,
    duration() { return this.ready ? 6 : 0; },
    load() {},
    start(group, options) {
      if (!this.ready) return null;
      const h = { group, options: { ...options }, stops: 0, set(v) { Object.assign(this.options, v); }, stop() { this.stops++; active.delete(this); } };
      plays.push(h); active.add(h); return h;
    },
  };
  const c = new ShipAudio(s); s._shipAudio = c;
  return { s, c, plays, active, fallback, synth: (k) => fallback.push(k) };
}

test('one recorded engine follows throttle, stops at zero, and retries without stacked voices', () => {
  const { s, plays, active } = fixture();
  for (let i = 0; i < 120; i++) engines(s, .7, i / 120);
  assert.equal(plays.length, 1); assert.equal(active.size, 1);
  assert.equal(plays[0].group, 'ship-thrust');
  engines(s, 0); assert.equal(active.size, 0);
  pirateSounds(s).engine(.8, 1);
  assert.equal(plays.at(-1).group, 'ship-thrust');
  assert.equal(active.size, 1, 'Pirates uses a single aggregate bed, not four emitters');
  pirateSounds(s).engine(0); assert.equal(active.size, 0);
});

test('loading fallback transitions once; pause, mute and disposal silence both paths', () => {
  const { s, c, plays, active, fallback, synth } = fixture();
  s.bank.ready = false;
  c.loop('idle', 'ship-idle', .6, 1, synth);
  assert.equal(fallback.at(-1), .6);
  c.pause(true); assert.equal(fallback.at(-1), 0);
  s.bank.ready = true; c.pause(true); assert.equal(plays.length, 0);
  c.pause(false); assert.equal(active.size, 1); assert.equal(fallback.at(-1), 0);
  s.muted = true; c.pause(); assert.equal(active.size, 0);
  s.muted = false; c.pause(); assert.equal(active.size, 1);
  c.dispose(); assert.equal(active.size, 0);
  c.pause(false); c.loop('idle', 'ship-idle', 1, 1, synth);
  assert.equal(active.size, 0, 'disposed controller cannot revive after a late load');
});

test('aboard idle and thrust are independent; muted initial construction starts neither', () => {
  const { s, c, plays, active } = fixture();
  s.muted = true; hum(s, .6); engines(s, .5);
  assert.equal(plays.length, 0);
  s.muted = false; c.pause();
  assert.deepEqual(plays.map(p => p.group), ['ship-idle', 'ship-thrust']);
  hum(s, 0); assert.equal(active.size, 1);
  engines(s, 0); assert.equal(active.size, 0);
});

test('deck follows physical phase, resumes at offset, reverses, and skips silently', () => {
  const { s, c, plays, active } = fixture(), model = {};
  deck(s, model, undefined, 1); deck(s, model, 1, 0);
  assert.equal(plays.length, 0, 'construction and skip are not movement');
  deck(s, model, 0, .01);
  const opened = plays.at(-1);
  assert.equal(opened.group, 'deck-open');
  assert.equal(opened.options.rate, 6 / 4.2);
  for (let k = .02; k < .5; k += .01) { s.ctx.currentTime += .042; deck(s, model, k - .01, k); }
  assert.equal(plays.length, 1);
  c.pause(true); assert.equal(active.size, 0);
  c.pause(false);
  assert.ok(Math.abs(plays.at(-1).options.offset - .49 * 6) < 1e-9);
  deck(s, model, .49, .48);
  assert.equal(plays.at(-1).group, 'deck-close');
  assert.equal(plays.at(-1).options.offset, .52 * 6);
  assert.equal(active.size, 1);
  deck(s, model, .48, 0); assert.equal(active.size, 0, 'skip stops existing cue without starting another');
  const count = plays.length; c.pause(false); assert.equal(plays.length, count);
});

test('offline deck motor is continuous and its locking click only occurs at an actually reached endpoint', () => {
  const { s, c, fallback, synth } = fixture(); s.bank.ready = false;
  let clicks = 0; const model = {}, clunk = () => clicks++;
  c.moveDeck(model, 0, .1, synth, clunk);
  assert.equal(fallback.at(-1), 1);
  c.pause(true); assert.equal(fallback.at(-1), 0);
  c.pause(false); assert.equal(fallback.at(-1), 1);
  c.moveDeck(model, .1, 1, synth, clunk); assert.equal(clicks, 0, 'skip does not schedule a delayed click');
  c.moveDeck(model, 1, .9, synth, clunk);
  c.moveDeck(model, .1, 0, synth, clunk); assert.equal(clicks, 1);
  assert.equal(fallback.at(-1), 0);
});

test('engine silent stand-in and a pre-start Sound never allocate audio nodes', () => {
  const silent = new Proxy({}, { get: (t, k) => k === 'ctx' ? null : () => {} });
  assert.doesNotThrow(() => { hum(silent, 1); engines(silent, 1); deck(silent, {}, 0, .1); });
  const s = { muted: false, ctx: null };
  hum(s, .6); engines(s, 1);
  assert.equal(s._ship, undefined);
  s._shipAudio.dispose();
});

test('departure completion cancels an interrupted deck cue before navigation', () => {
  const { s, c, active, plays } = fixture();
  deck(s, {}, 1, .99); assert.equal(active.size, 1);
  c.stopDeck(); assert.equal(active.size, 0);
  c.pause(false); assert.equal(plays.length, 1);
});


test('foreground stall resynchronises to capped physical movement without restarting each ordinary frame', () => {
  const { s, c, plays, active } = fixture(), model = {};
  let k = .01;
  deck(s, model, 0, k);
  for (let i = 0; i < 30; i++) {
    s.ctx.currentTime += 1 / 60;
    const next = k + 1 / 60 / 4.2;
    deck(s, model, k, next); k = next;
  }
  assert.equal(plays.length, 1, 'ordinary animation and audio stay on the same source');
  s.ctx.currentTime += 2; // browser main thread stalled; AudioContext continued
  const next = k + .05 / 4.2; // game applies its real capped simulation step
  deck(s, model, k, next); k = next;
  assert.equal(plays.length, 2);
  assert.equal(plays[0].stops, 1);
  assert.ok(Math.abs(plays[1].options.offset - k * 6) < 1e-9);
  assert.equal(active.size, 1);
  for (let i = 0; i < 30; i++) {
    s.ctx.currentTime += 1 / 60;
    const next = k + 1 / 60 / 4.2;
    deck(s, model, k, next); k = next;
  }
  assert.equal(plays.length, 2, 'normal frames after recovery do not churn sources');
  c.stopDeck();
});
