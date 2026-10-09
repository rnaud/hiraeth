// What the player holds: a controller ('pad'), the keyboard and mouse ('keys') or the touch screen
// ('touch'), and so whether the touch buttons show (index.html body.touch, body.controller).
//
// It is remembered for the tab (sessionStorage): a new world is a new page (main.js navigate), and
// before, every load started from nothing. A browser only lists a pad after its first press on the
// new page, so the touch buttons came back over the loading screen's end until the pad was pressed
// again; a keyboard on a touch-screen laptop never hid them at all.

export const INPUT_MODE_KEY = 'moebius.input.v1';
const KINDS = new Set(['pad', 'keys', 'touch']);

/** sessionStorage, never throwing (none in node, a private window, a full quota). */
const sessionStore = {
  get(k) { try { return globalThis.sessionStorage?.getItem(k) ?? null; } catch { return null; } },
  set(k, v) { try { globalThis.sessionStorage?.setItem(k, v); } catch { /* none */ } },
};

/** Remember what is in hand for the next page (a page without the game's loop: the worlds list). */
export const rememberInput = (kind, storage = sessionStore) => { if (KINDS.has(kind)) storage.set(INPUT_MODE_KEY, kind); };

/** Typing into a field (a save's name, the dev menu's search) is not the keyboard taking over the game. */
const typing = (e) => !!e?.target?.closest?.('input, textarea, select, [contenteditable="true"]');

export class InputMode {
  /**
   * @param o.touchDevice the screen takes touches (ui.js isTouch): the touch buttons exist
   * @param o.storage     { get, set } (default sessionStorage)
   */
  constructor({ touchDevice = false, storage = sessionStore } = {}) {
    this.touchDevice = !!touchDevice;
    this.storage = storage;
    const saved = storage.get(INPUT_MODE_KEY);
    this.kind = KINDS.has(saved) ? saved : this.touchDevice ? 'touch' : 'keys';
    if (this.kind === 'touch' && !this.touchDevice) this.kind = 'keys';
    this.restored = KINDS.has(saved);
    // the screen or the keys were what was in hand (here, or on the page before): a connected pad no
    // longer counts as in use until it is pressed
    this.screen = this.restored && this.kind !== 'pad';
    this.padSeen = false;    // a pad was listed on this page
  }

  _set(kind) {
    if (kind === 'touch' && !this.touchDevice) kind = 'keys';
    if (this.kind !== kind) this.kind = kind;
    this.storage.set(INPUT_MODE_KEY, kind);
  }

  /** A pad press or stick push (controller.js activity). */
  pad() { this.screen = false; this.padSeen = true; this._set('pad'); }

  /**
   * A DOM event: a trusted key press, a mouse click or a touch. The touch buttons' own key presses
   * are synthetic (ui.js TouchControls dispatches them) and change nothing.
   */
  event(e) {
    if (!e) return;
    if (e.type === 'keydown') {
      // (a handheld's own buttons may arrive as key events without a key's code: not a keyboard)
      if (e.isTrusted === false || !e.code || typing(e)) return;
      this.screen = true; this._set('keys');
    } else if (e.type === 'touchstart' || (e.type === 'pointerdown' && (e.pointerType === 'touch' || e.pointerType === 'pen'))) {
      this.screen = true; this._set('touch');
    } else if (e.type === 'pointerdown' || e.type === 'mousedown') {
      // (a tap fires a pointerdown of its own type first; only a real mouse is the mouse)
      this.screen = true; this._set('keys');
    }
  }

  /**
   * Each frame, with whether a pad is listed now. A pad that is connected (a Retroid's own controls)
   * counts as in use until the screen or the keys are touched. One remembered from the page before
   * stays in use while the browser hasn't listed it yet; once it was listed and goes, the screen's
   * own input takes over again.
   */
  frame(padConnected) {
    if (padConnected) {
      this.padSeen = true;
      if (!this.screen && this.kind !== 'pad') this._set('pad');
    } else if (this.kind === 'pad' && (this.padSeen || this.screen || !this.restored)) {
      this._set(this.touchDevice ? 'touch' : 'keys');
    }
    return this.kind;
  }

  get controller() { return this.kind === 'pad'; }
  /** The touch buttons show: a touch screen, and the fingers are what is in use. */
  get touchButtons() { return this.touchDevice && this.kind === 'touch'; }

  /** The body's classes for it (controller: no buttons on the screen; touch: the touch layout and buttons). */
  apply(classList) {
    if (!classList) return;
    classList.toggle('controller', this.controller);
    classList.toggle('touch', this.touchButtons);
  }
}
