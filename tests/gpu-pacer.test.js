// The load's GPU work paced by the GPU's own progress (load-steps.js gpuPacer; docs/systems/performance.md,
// "The loading pen"): no wait while the GPU keeps up, a wait while a fence put long ago is unsignaled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gpuPacer } from '../src/load-steps.js';

/** a WebGL 2 context's fences, signalled when the test says */
function fakeGL() {
  const fences = [];
  return {
    fences, SYNC_GPU_COMMANDS_COMPLETE: 1, SYNC_STATUS: 2, SIGNALED: 3, UNSIGNALED: 4, flushes: 0, deleted: 0,
    fenceSync() { const f = { done: false }; fences.push(f); return f; },
    getSyncParameter(f) { return f.done ? this.SIGNALED : this.UNSIGNALED; },
    deleteSync() { this.deleted++; }, flush() { this.flushes++; },
  };
}

test('a GPU that keeps up is never waited for; one that lags is, until it catches up', async () => {
  const gl = fakeGL(), pace = gpuPacer(gl, { lag: 20, most: 1000 });
  for (let i = 0; i < 5; i++) { await pace(); gl.fences.forEach((f) => { f.done = true; }); }
  assert.ok(pace.waited < 15, `no waiting while every fence is signalled (${pace.waited} ms)`);
  assert.equal(gl.flushes, 5);
  // a fence left unsignalled: the next pieces go on until it is older than the lag, then wait for it
  await pace();
  const stuck = gl.fences.at(-1);
  setTimeout(() => { stuck.done = true; }, 80);
  const t0 = Date.now();
  await new Promise((r) => setTimeout(r, 30));
  await pace();
  assert.ok(Date.now() - t0 >= 75, 'waited for the old fence');
  assert.ok(gl.deleted >= 6, 'signalled fences are let go');
});

test('the wait is capped, and nothing happens without fences', async () => {
  const gl = fakeGL(), pace = gpuPacer(gl, { lag: 0, most: 40 });
  await pace();
  const t0 = Date.now();
  await pace();   // the first never signals
  assert.ok(Date.now() - t0 < 200, 'gave up after `most`');
  await gpuPacer(null)();
  await gpuPacer({})();
});

test('fences that never signal: it gives up after a few full waits, once, and the load goes on unpaced', async () => {
  const gl = fakeGL(), warns = [];
  const pace = gpuPacer(gl, { lag: 0, most: 30, giveUp: 3, warn: (m) => warns.push(m) });
  const t0 = Date.now();
  for (let i = 0; i < 200; i++) await pace();   // 200 pieces: unbounded, that's 200 × 30 ms
  const took = Date.now() - t0;
  assert.ok(pace.off, 'it gave up');
  assert.ok(took < 1500, `the whole load's wait is bounded (${took} ms)`);
  assert.ok(pace.waited < 600, `about giveUp × most waited (${pace.waited.toFixed(0)} ms)`);
  assert.equal(warns.length, 1, 'one warning');
  assert.match(warns[0], /not signalled/);
  assert.equal(gl.deleted, gl.fences.length, 'the fences left are let go');
  const n = gl.fences.length;
  await pace();
  assert.equal(gl.fences.length, n, 'no more fences once given up');
});

test('a GPU that is slow but does signal: a full wait now and then is fine, the total is still capped', async () => {
  const gl = fakeGL(), warns = [];
  const pace = gpuPacer(gl, { lag: 0, most: 20, giveUp: 3, budget: 120, warn: (m) => warns.push(m) });
  const t0 = Date.now();
  for (let i = 0; i < 100; i++) {
    await pace();
    if (i % 2) gl.fences.forEach((f) => { f.done = true; });   // every other piece the GPU catches up
  }
  assert.ok(pace.off, 'it gave up on the budget');
  assert.match(warns[0], /in all/);
  assert.ok(Date.now() - t0 < 1000, `bounded (${Date.now() - t0} ms)`);
});

test('a give-up for unsignalled fences is remembered: the next load on that GPU never waits (a slow GPU is not)', async () => {
  let saved = false;
  const memory = { get: () => saved, set: () => { saved = true; } };
  const first = gpuPacer(fakeGL(), { lag: 0, most: 10, giveUp: 3, warn: null, memory });
  for (let i = 0; i < 10; i++) await first();
  assert.ok(first.off && saved, 'gave up, and said so to the memory');
  const gl = fakeGL(), next = gpuPacer(gl, { lag: 0, most: 1000, memory });
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) await next();
  assert.ok(next.off, 'off from the start');
  assert.equal(gl.fences.length, 0, 'no fences at all');
  assert.ok(Date.now() - t0 < 50, 'no waiting');
  // the budget running out (fences that do signal, slowly) is not remembered
  let slowSaved = false;
  const slowGl = fakeGL(), slow = gpuPacer(slowGl, { lag: 0, most: 20, giveUp: 3, budget: 60, warn: null, memory: { get: () => false, set: () => { slowSaved = true; } } });
  for (let i = 0; i < 40; i++) { await slow(); if (i % 2) slowGl.fences.forEach((f) => { f.done = true; }); }
  assert.ok(slow.off && !slowSaved, 'a slow GPU tries again next load');
});

test('nextFrame: a frame, or the fallback when frame callbacks never run', async () => {
  const { nextFrame } = await import('../src/load-steps.js');
  const had = globalThis.requestAnimationFrame;
  try {
    globalThis.requestAnimationFrame = (f) => setTimeout(f, 5);
    let t0 = Date.now();
    await nextFrame(1000);
    assert.ok(Date.now() - t0 < 500, 'the frame came first');
    globalThis.requestAnimationFrame = () => 0;   // a window not shown: no frame ever
    t0 = Date.now();
    await nextFrame(40);
    assert.ok(Date.now() - t0 < 500, 'the fallback came');
  } finally { globalThis.requestAnimationFrame = had; }
});

test('loadWatchdog: a step that runs too long is named, once', async () => {
  const { loadWatchdog } = await import('../src/load-steps.js');
  const warns = [];
  let step = 'a';
  const w = loadWatchdog(() => step, { every: 5, after: 30, warn: (m) => warns.push(m) });
  await new Promise((r) => setTimeout(r, 15));
  step = 'mixing the inks… / surfaces';
  await new Promise((r) => setTimeout(r, 120));
  w.stop();
  assert.equal(warns.length, 1);
  assert.match(warns[0], /mixing the inks… \/ surfaces/);
});
