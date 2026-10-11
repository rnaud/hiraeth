// The game loading behind the title (issue #110): while the player is on the title screen, the game (src/main.js)
// loads the world of the save Continue would play, under the title, and waits at its first frame. Choosing that
// save lets it go on: the title fades out over the game's first frame, at once if the load is done, after a quiet
// progress mark if not. Any other choice (another save, a new game in another slot, a setting changed meanwhile)
// opens the game in a fresh page, as before (?start).
//
// While it is held, the game must not hear the player: the keys, clicks and touches are the title's. So, from the
// moment the load starts, every input listener the page adds to the window or the document is wrapped to ignore
// what comes while the hold lasts (the title's own were added before, and go on as they were), the game's music
// waits (main.js: its Sound not started), its build stands aside while the player presses (busy, a gatedSlicer), and
// whatever it writes to the save stays in memory until the save is chosen (src/save-slots.js holdWrites).
//
//   const hold = createHold(win)     window.__titleHold = hold; the game reads it as it loads
//   hold.busy = () => …               the player is pressing (the title's)
//   hold.arrive() / hold.arrived      main.js: the load is done, at the first frame's door
//   hold.go                           the promise main.js waits on; hold.release() resolves it
//   hold.played() / hold.playing      main.js: the first frame is drawn (the title may go)
//   hold.fail(e) / hold.failed        the game couldn't load: the choice opens a fresh page
//   hold.stage                        the load's last stage line (the progress mark's words)
//
// Pure apart from the window it is given (tests/title-hold.test.js runs it on a stand-in).

/** The events the game must not hear while it is held. */
export const INPUT_EVENTS = new Set(['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'mousedown',
  'mouseup', 'mousemove', 'click', 'dblclick', 'contextmenu', 'wheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel']);

const capture = (opts) => (typeof opts === 'boolean' ? opts : !!opts?.capture);

/**
 * Wrap the input listeners added to `win` and its document from now on: while held() they hear nothing. Returns
 * stop(): listeners added after it are left as they are (the wrapped ones stay wrapped, and pass everything once
 * held() is false; removing one by its own function still works).
 */
export function holdInput(win, held) {
  const proto = win.EventTarget?.prototype;
  if (!proto) return () => {};
  const add = proto.addEventListener, remove = proto.removeEventListener;
  const doc = win.document;
  const wrapped = new WeakMap();   // the listener → its wrappers, by type, phase and target
  const keyOf = (target, type, opts) => `${target === win ? 'w' : 'd'}|${type}|${capture(opts)}`;
  let adding = true;
  proto.addEventListener = function addHeld(type, fn, opts) {
    if (adding && fn && (this === win || this === doc) && INPUT_EVENTS.has(type)) {
      let m = wrapped.get(fn);
      if (!m) wrapped.set(fn, (m = new Map()));
      const key = keyOf(this, type, opts);
      let w = m.get(key);
      if (!w) {
        w = function heldListener(e) { if (held()) return undefined; return typeof fn === 'function' ? fn.call(this, e) : fn.handleEvent(e); };
        m.set(key, w);
      }
      return add.call(this, type, w, opts);
    }
    return add.call(this, type, fn, opts);
  };
  proto.removeEventListener = function removeHeld(type, fn, opts) {
    const w = fn && wrapped.get(fn)?.get(keyOf(this, type, opts));
    if (w) remove.call(this, type, w, opts);
    return remove.call(this, type, fn, opts);
  };
  return () => { adding = false; };
}

export function createHold(win = globalThis.window) {
  let release, arrive, played, fail;
  const hold = {
    held: true,
    busy: () => false,
    stage: '',
    go: new Promise((r) => { release = r; }),
    arrived: new Promise((r) => { arrive = r; }),
    playing: new Promise((r) => { played = r; }),
    failed: null,
    started: false,
    /** The input from now on is the title's alone (call it just before the game starts loading). */
    start() {
      if (hold.started) return;
      hold.started = true;
      hold.stopWrapping = holdInput(win, () => hold.held);
    },
    release() { if (!hold.held) return; hold.held = false; hold.stopWrapping?.(); release(); },
    arrive() { hold.isArrived = true; arrive(); },
    played() { hold.isPlaying = true; played(); },
    fail(e) { hold.failed = e ?? new Error('the game did not load'); fail?.(hold.failed); },
    onFail(f) { fail = f; if (hold.failed) f(hold.failed); },
  };
  return hold;
}
