import test from 'node:test';
import assert from 'node:assert/strict';
import { holdUntil } from '../scripts/browser-held-input.mjs';
import { GameState } from '../src/game-state.js';
import { Prologue, SKIP_HOLD } from '../src/ship/prologue.js';

function slowPrologue() {
  const finished = [];
  const prologue = new Prologue({ game: new GameState(null), director: { enter() {}, frame() {}, finish(skipped) { finished.push(skipped); } } });
  prologue.start();
  let time = 0, held = false, frames = 0, releases = 0;
  return { prologue, finished, now: () => time,
    press: () => { held = true; }, release: () => { held = false; releases++; },
    pause(ms) { time += ms; frames++; if (frames % 4 === 0) prologue.update(0.05, held); },
    state: () => ({ held, releases }) };
}

test('continuous input reaches the real prologue skip threshold on a one-FPS runner', async () => {
  const old = slowPrologue();
  for (let i = 0; i < 6; i++) {
    old.press(); for (let n = 0; n < 9; n++) old.pause(250);
    old.release(); for (let n = 0; n < 4; n++) old.pause(250);
  }
  assert.equal(old.prologue.done, false, 'six short wall-clock holds still fail on the original harness');
  assert.ok(old.prologue.skipT < SKIP_HOLD);
  const slow = slowPrologue();
  await holdUntil({ ...slow, done: () => slow.prologue.done, timeoutMs: 30000 });
  assert.equal(slow.prologue.game.flag('prologue.done'), true);
  assert.deepEqual(slow.finished, [true], 'production prologue finishes by its own skip path');
  assert.ok(slow.now() >= 17000, 'waited for actual simulated frames');
  assert.deepEqual(slow.state(), { held: false, releases: 1 });
});

test('a stalled simulation times out and releases the key without forcing success', async () => {
  let time = 0, released = 0;
  await assert.rejects(holdUntil({ press() {}, release() { released++; }, done: () => false,
    pause(ms) { time += ms; }, now: () => time, timeoutMs: 1100, label: 'prologue' }), /timed out waiting for prologue/);
  assert.equal(time, 1100);
  assert.equal(released, 1);
});

test('page errors release held input; an already-complete scene receives no key', async () => {
  let reads = 0, released = 0;
  await assert.rejects(holdUntil({ press() {}, release() { released++; }, done() { if (++reads > 1) throw Error('page failed'); return false; } }), /page failed/);
  assert.equal(released, 1);
  await holdUntil({ done: () => true, press() { assert.fail('unnecessary keydown'); }, release() { assert.fail('unnecessary keyup'); } });
});
