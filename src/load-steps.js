// A world's build in steps (docs/systems/performance.md, "Loading"). A long build is a generator that
// yields between its pieces (and inside its long loops); it can be run straight through, at once
// (runSteps: tests, the studio, anything that wants the result now), or a slice at a time
// (runStepsAsync): the main thread is given back whenever a slice has run its budget, so no task
// runs long, the page stays responsive and the loading screen keeps being drawn.
//
// A step may yield a promise (a worker's result, an asset): the async runner waits for it, the
// sync one can't, so such steps must also have a synchronous way (see Terrain.make).
//
// The yield is a MessageChannel message: a task of its own, with no clamping (setTimeout(0) can be
// held to 4 ms and more) and no need for scheduler.yield (the Android WebView 109 lacks it).

export const LOAD_BUDGET = 24;   // ms of work before the main thread is given back

let channel = null;
const waiting = [];
/** Give the main thread back for a moment: resolves on a fresh task. */
export function yieldTask() {
  // (Node, the tests: setImmediate, which doesn't hold the process open as a message port does)
  if (typeof setImmediate === 'function') return new Promise((r) => setImmediate(r));
  if (typeof MessageChannel === 'undefined') return new Promise((r) => setTimeout(r, 0));
  if (!channel) {
    channel = new MessageChannel();
    channel.port1.onmessage = () => waiting.shift()?.();
  }
  return new Promise((r) => { waiting.push(r); channel.port2.postMessage(0); });
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * A time slicer: await slice() as often as you like; it only yields once `budget` ms have run since
 * the last time it did. stats: how many slices, the longest.
 */
export function slicer(budget = LOAD_BUDGET) {
  let t0 = now();
  const s = async () => {
    const t = now();
    if (t - t0 < budget) return false;
    s.longest = Math.max(s.longest, t - t0);
    s.slices++;
    await yieldTask();
    t0 = now();
    return true;
  };
  s.slices = 0; s.longest = 0; s.budget = budget;
  s.reset = () => { t0 = now(); };
  return s;
}

const isThenable = (v) => v && typeof v.then === 'function';

/** Run a generator of steps straight through; returns what it returns. (A yielded promise is an error here.) */
export function runSteps(gen) {
  let r = gen.next();
  while (!r.done) {
    if (isThenable(r.value)) throw new Error('runSteps: a step waits for a promise (use runStepsAsync)');
    r = gen.next(r.value);
  }
  return r.value;
}

/** Run a generator of steps, a slice at a time (slice: a slicer()); a yielded promise is awaited and its value sent back. */
export async function runStepsAsync(gen, slice = slicer()) {
  let r = gen.next();
  while (!r.done) {
    let v = r.value;
    if (isThenable(v)) { v = await v; slice.reset?.(); } else await slice();
    r = gen.next(v);
  }
  return r.value;
}

/** A level's builder, sync: `create` (tests) runs `build` straight through. */
export const stepped = (build) => (...args) => runSteps(build(...args));

/**
 * Pacing a load's GPU work by the GPU's own progress (docs/systems/performance.md, "The loading pen"). The
 * slicer gives the main thread back by its own clock, but what each slice queued for the GPU process (a
 * program compiled and linked, a mesh's buffers and textures uploaded) runs there later, and slice after
 * slice it piles up: the GPU process, which also composites the page, works through a backlog, and the
 * loading screen's pen stops for 100-240 ms at a time though it turns on the compositor. pace() after each
 * piece of GPU work puts a fence after it; before going on it waits (a task at a time, at most `most` ms)
 * only while a fence put more than `lag` ms ago is still unsignaled: the GPU is that far behind. A GPU that
 * keeps up costs nothing (a fence's status is seen a frame late at best, so waiting on every one would add a
 * frame a piece). Without fences (WebGL 1, a test) it does nothing.
 */
export function gpuPacer(gl, { lag = 40, most = 250 } = {}) {
  const queue = [];   // [fence, when put]
  const ok = !!gl && typeof gl.fenceSync === 'function';
  const signaled = (s) => gl.getSyncParameter(s, gl.SYNC_STATUS) === gl.SIGNALED;
  const drop = () => { while (queue.length && signaled(queue[0][0])) gl.deleteSync(queue.shift()[0]); };
  const pace = async () => {
    if (!ok) return;
    drop();
    const t0 = now();
    while (queue.length && now() - queue[0][1] > lag && now() - t0 < most) { await new Promise((r) => setTimeout(r, 2)); drop(); }
    pace.waited += now() - t0;
    queue.push([gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), now()]);
    gl.flush();
  };
  pace.waited = 0;
  return pace;
}
