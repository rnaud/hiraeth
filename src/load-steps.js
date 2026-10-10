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

/**
 * A slicer that also stands aside while the player is pressing (the title's world, src/title-world.js: the
 * menu answers first). After each yield, while busy() says so, it waits (polling every `poll` ms) and its
 * budget starts afresh; stopped() ends the wait (the build was cancelled). Same API as slicer().
 */
export function gatedSlicer({ busy = () => false, stopped = () => false, budget = LOAD_BUDGET, poll = 50 } = {}) {
  const raw = slicer(budget);
  const quiet = async () => { while (busy() && !stopped()) await new Promise((r) => setTimeout(r, poll)); };
  const s = async () => {
    const yielded = await raw();
    if (yielded && busy()) { await quiet(); raw.reset(); }
    return yielded;
  };
  s.quiet = quiet;
  s.reset = raw.reset;
  Object.defineProperties(s, { slices: { get: () => raw.slices }, longest: { get: () => raw.longest } });
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
 *
 * It gives up, for the rest of its life, when the fences can't be trusted: `giveUp` waits in a row that ran
 * the whole `most`, or `budget` ms of waiting in all. A driver whose fences never signal (the Steam Deck's
 * ANGLE under gamescope, seemingly, with the canvas hidden) had every piece wait the whole `most`: 741 kinds
 * of surface in the desert and as many warm-draw batches, minutes on "mixing the inks…".
 */
export function gpuPacer(gl, { lag = 40, most = 250, giveUp = 3, budget = 3000, warn = console.warn } = {}) {
  const queue = [];   // [fence, when put]
  const ok = !!gl && typeof gl.fenceSync === 'function';
  const signaled = (s) => gl.getSyncParameter(s, gl.SYNC_STATUS) === gl.SIGNALED;
  const drop = () => { while (queue.length && signaled(queue[0][0])) gl.deleteSync(queue.shift()[0]); };
  let maxed = 0;   // waits in a row that ran the whole `most`
  const stop = (why) => {
    pace.off = true;
    for (const [f] of queue) gl.deleteSync(f);
    queue.length = 0;
    warn?.(`gpu pacer: ${why}; the load goes on without waiting for the GPU (${pace.waited.toFixed(0)} ms waited)`);
  };
  const pace = async () => {
    if (!ok || pace.off) return;
    drop();
    const t0 = now();
    let full = false;
    while (queue.length && now() - queue[0][1] > lag) {
      if (now() - t0 >= most) { full = true; break; }
      await new Promise((r) => setTimeout(r, 2));
      drop();
    }
    pace.waited += now() - t0;
    maxed = full ? maxed + 1 : 0;
    if (maxed >= giveUp) return stop(`${maxed} waits in a row ran out (${most} ms each): fences not signalled`);
    if (pace.waited >= budget) return stop(`waited over ${budget} ms in all`);
    queue.push([gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), now()]);
    gl.flush();
  };
  pace.waited = 0; pace.off = false;
  return pace;
}

/**
 * The next frame, or `fallback` ms, whichever comes first: a loading stage waits for a frame so the loading
 * screen can paint, but a window the compositor doesn't show (hidden, occluded, a handheld's compositor
 * holding it back) may run no frame callbacks at all, and the load must not wait for one forever.
 */
export function nextFrame(fallback = 250) {
  return new Promise((resolve) => {
    let done = false, timer = 0;
    const go = () => { if (done) return; done = true; clearTimeout(timer); resolve(); };
    timer = setTimeout(go, fallback);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go);
  });
}

/**
 * A load's watchdog: every `every` ms, if the current step (what `step()` says) has run over `after` ms,
 * it says so once (a load that stalls says where). stop() when the load is over.
 */
export function loadWatchdog(step, { every = 2000, after = 15000, warn = console.warn } = {}) {
  let cur = null, since = now(), told = false;
  const id = setInterval(() => {
    const s = step();
    if (s !== cur) { cur = s; since = now(); told = false; return; }
    if (!told && now() - since > after) { told = true; warn(`load: still on "${s}" after ${((now() - since) / 1000).toFixed(0)} s`); }
  }, every);
  return { stop: () => clearInterval(id) };
}
