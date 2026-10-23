import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBoard, newFlow, flowStep, releaseFlow, retryFlow, previewChannels, solve, turnStone, round } from '../src/minigames/channels.js';

for (const fps of [30, 60]) test(`${fps} Hz: planning waits indefinitely and only an explicit valve action releases water`, () => {
  const B = makeBoard(31), F = newFlow(B, { planning: true });
  for (let i = 0; i < fps * 600; i++) assert.deepEqual(flowStep(B, F, 1 / fps, { hurry: true }), []);
  assert.equal(F.t, 0); assert.equal(F.started, false); assert.ok(B.cells.every(c => !c.wet));
  solve(B); assert.equal(releaseFlow(F), true); assert.equal(releaseFlow(F), false);
  for (let i = 0; !F.done && i < fps * 300; i++) flowStep(B, F, 1 / fps, { hurry: true });
  assert.ok(F.done); assert.equal(F.troughs, B.troughs.length);
});

test('retry drains only transient water, preserves every chosen rotation, and cannot duplicate an attempt score', () => {
  const B = makeBoard(14), F = newFlow(B, { wait: 0 });
  for (let i = 0; !F.done && i < 1000; i++) flowStep(B, F, 3);
  const turns = B.cells.map(c => c.r), shape = B.cells.map(c => c.kind);
  const again = retryFlow(B, F);
  assert.deepEqual(B.cells.map(c => c.r), turns); assert.deepEqual(B.cells.map(c => c.kind), shape);
  assert.ok(B.cells.every(c => !c.wet && !c.set)); assert.ok(B.troughs.every(t => !t.filled));
  assert.equal(again.filled, 0); assert.equal(again.troughs, 0); assert.equal(again.hurried, 0); assert.equal(again.planning, true);
});

test('preview reads current channels without revealing or mutating the construction solution', () => {
  const B = { w: 1, h: 1, spout: { x: 0, y: 0, side: 0 }, cells: [{ kind: 'I', r: 1, wet: 0, set: false }], troughs: [{ x: 0, y: 0, side: 2, filled: false }], way: [0] };
  const before = JSON.stringify(B), bad = previewChannels(B);
  assert.equal(bad.complete, false); assert.equal(bad.troughs, 0); assert.equal(bad.spills.length, 1);
  assert.equal(JSON.stringify(B), before);
  turnStone(B, 0, 0); const good = previewChannels(B);
  assert.equal(good.complete, true); assert.equal(good.troughs, 1); assert.deepEqual(good.connected, [true]);
  assert.equal(B.cells[0].wet, 0); assert.equal(B.cells[0].set, false);
});

test('all three round configurations retain constructed routes with the new planning/preview rules', () => {
  for (let i = 0; i < 3; i++) for (let seed = 1; seed <= 80; seed++) {
    const R = round(i), B = makeBoard(seed * 97, R); solve(B);
    assert.equal(previewChannels(B).complete, true, `round ${i + 1}, seed ${seed * 97}`);
  }
});
