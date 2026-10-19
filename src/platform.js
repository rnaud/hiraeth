// The page, as the game's modules reach it: one place for document, window, localStorage, audio and
// input, and the screen's state as data (docs/systems/engine-bridge.md, "The platform layer").
//
// On the web every call is what the module did before (document.getElementById, a window listener,
// localStorage behind a try). In an engine (Unity through the JS bridge) the page is a stand-in
// (engine/platform.js), and what the HUD shows is read from `screen` instead of drawn into it: the
// cue line, the toast, the floating prompt, the health bar and stamina wheel, the conversation. The
// modules that draw those set their part of `screen` as they draw, so the web and the engine draw
// from the same state.

const hasDoc = () => typeof document !== 'undefined';
const hasWin = () => typeof window !== 'undefined' && typeof window.addEventListener === 'function';

export const page = {
  /** An element of index.html by id, or null (no page: Node, a test). */
  byId: (id) => (hasDoc() ? document.getElementById(id) : null),
  /** A window listener (keys, the mouse, blur…); returns a function that removes it. */
  on(type, fn, opts) {
    if (!hasWin()) return () => {};
    window.addEventListener(type, fn, opts);
    return () => window.removeEventListener(type, fn, opts);
  },
  /** A class on the page's body ('talking', 'controller'…). */
  bodyClass(name, on) { if (hasDoc()) document.body?.classList.toggle(name, !!on); },
  hasBodyClass: (name) => (hasDoc() ? !!document.body?.classList.contains(name) : false),
  exitPointerLock() { if (hasDoc()) document.exitPointerLock?.(); },
  activeElement: () => (hasDoc() ? document.activeElement : null),
  /** Does the page draw a game's own HUD canvas (the drum circle's ring, the pirates' reticle)? Not in an engine
   * (engine/platform.js hudIsData): there the game's screen part is drawn instead (BridgeHud.cs), and a full-screen
   * canvas drawn into bytes each frame would only cost. */
  drawsHud: () => hasDoc() && !document.hudIsData,
};

/** localStorage, never throwing (private windows, a full quota, no storage at all). */
export const store = {
  get(k) { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } },
  set(k, v) { try { globalThis.localStorage?.setItem(k, v); return true; } catch { return false; } },
  remove(k) { try { globalThis.localStorage?.removeItem(k); } catch { /* none */ } },
};

/** The pads (navigator.getGamepads) and nothing when there are none. */
export const input = {
  pads: () => (typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads() ?? []) : []),
};

/** Web Audio's context, or null where there is none (an engine: its sound is its own). */
export const audio = {
  available: () => !!(globalThis.AudioContext ?? globalThis.webkitAudioContext),
  context(opts) { const C = globalThis.AudioContext ?? globalThis.webkitAudioContext; return C ? new C(opts) : null; },
};

/**
 * What the screen shows, as data. Each part is null (nothing) or a plain object:
 *   cue       { text, kind }                     the line at the bottom (hud.js Cue): kind 'place' for a region's name
 *   toast     { text, secs, id }                 the line at the top (ship/cinema.js): id counts up, one a toast
 *   prompt    { text, key, at: [x, y, z] }       "E talk to Ama", floating over them (story/index.js placePrompt)
 *   health    { value, low }                     the bar while hurt (hud.js healthHud)
 *   stamina   { value, winded, at: [x, y, z] }   the wheel by the traveller (hud.js staminaHud)
 *   tool      { aim, mode, name, wait, lock, empty, flash, gauge, hits, hit, at? }  the fluid tool's crosshair and mode while
 *             aiming; its mode's name a moment on a switch, "empty" as the tank runs dry, by the traveller (at) when not aiming
 *             (ui.js ToolHud, host/game-host.js toolGauge)
 *   keys      { small, big }                     the key counter while in a temple: small keys in hand, the great key (hud.js keysHud)
 *   dialogue  { name, title, color, text, shown, done, speaker, choices: [{ text, tone, index }], more }
 *   choice    the answer a pad has picked (an engine's: the page focuses a button instead)
 *   cine      { bars, lids, lid, eyes, fade, white, secs, red, hint, skip: { k, label, press }, hud, walk }  a ship's scene
 *             (ship/cinema.js): the letterbox, the eyes' opening, the fade, the alarm's wash, the hint, hold-to-skip,
 *             the game's HUD hidden (hud false) but for the cue in a scene you walk through (walk)
 *   sub       { who, cls, text, id }             the scene's subtitle (ship/cinema.js): the speaker's tag and the line
 *   photo     { hint }                           photo mode's keys (an engine's, engine/game.js)
 *   gadget    { id, name, glyph, k, empty }      the gadget in hand's chip, top right (gadgets/hud.js): id names its picture,
 *             k how full its count is (null: none), empty none left
 *   gadgetWheel { slots: [{ id, glyph, name }], hi, name }   the wheel for choosing one (gadgets/hud.js)
 *   reticle   { at: [x, y, z] | null, kind, label }   where an aiming gadget would catch (kind ok, anchor, target, far)
 *   gadgetMarks [{ at, label }]                  the numbered diamonds on what a gadget has locked on to (the boomerang)
 *   carry     { name, how }                      something carried in both hands (src/carry.js): its name, how it came
 *             ('hand', or 'hook': the grappling hook pulled it in); its pose and the thing itself reach a renderer
 *             through the scene (the traveller's bones, the thing's object)
 *   boxCard   { name, text, ok, okLabel, scene, back, skipLabel }   a makers' box opening (boxes/card.js): scene while it
 *             plays (the skip's button), and its card once the item is out (name, what it does, the button to go on)
 *   charge    { id, mark, text, ms }   the father's charge lettered low in the lower third (story/charge.js showChargeCard)
 *   foeTab    { text, key }   the Arena's tab on the left edge: its list of foes, and the key that opens it (src/foe-spawner.js)
 *   words     { pops: [{ id, text, kind, at, secs }], says: [{ text, at }], tags: [{ title, text, at }] }   a minigame's words
 *             in the world (src/minigames/kit/labels.js): the "+10" that floats up from a point (kind '', gold, bad, combo;
 *             a renderer floats and fades it over secs from when its id first comes), a speech balloon, a label over a thing
 *   drums     the drum circle's ring, sockets and glyphs (minigames/drums.js drumsPart): the song's time t (s, sent on a
 *             change and four times a second, n counting the sends; a renderer runs it on while run), the glyphs near, the hits
 *   hunt      the sketch hunt's list, viewfinder, flash and hint (minigames/sketchhunt.js)
 *   fishing   the fishing's journal, line meter, pull, hint and catch card (minigames/fishing.js)
 *   pirates   the chime pirates' reticle, lock, captain's bar, hull pips, hit flare (half-size canvas px) and comms line
 *   self      { at: [x, y, z], head: [x, y, z], k, size }   the traveller's ring in a fight temple's crowd (fight-temples/self-mark.js):
 *             drawn round him from his feet to his head (size × that across), over the foes that hide him, k its fade
 *   visor     the Lens Vault's first-person visor (minigames/lens-vault-hud.js visorPart, CSS px of W × H): the rim, the hearts,
 *             the ARM / LENS tab, the reticle with the charge's and the reading's rings, the lock, the lens's marks, its reading
 * `version` moves whenever a part changes, so a renderer reads it only then.
 */
export const screen = {
  state: { cue: null, toast: null, prompt: null, health: null, stamina: null, tool: null, keys: null, dialogue: null, choice: null, cine: null, sub: null, photo: null, gadget: null, gadgetWheel: null, reticle: null, gadgetMarks: null, carry: null, boxCard: null, charge: null, warp: null, foeTab: null, words: null, drums: null, hunt: null, fishing: null, pirates: null, visor: null, self: null },
  version: 0,
  _keys: {},
  set(part, value) {
    const key = value == null ? '' : JSON.stringify(value);
    if (this._keys[part] === key) return false;
    this._keys[part] = key;
    this.state[part] = value ?? null;
    this.version++;
    return true;
  },
  _toasts: 0,
  /** A toast as it goes up (the web's queue decides when). */
  toast(text, secs = 4) { if (text) this.set('toast', { text: String(text), secs, id: ++this._toasts }); },
  reset() { for (const k of Object.keys(this.state)) this.set(k, null); },
};
