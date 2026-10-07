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
