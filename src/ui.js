// Player-facing UI: settings (saved), the settings menu, touch controls and
// the save file for "continue where you left off".

const SETTINGS_KEY = 'moebius.settings.v1';
const SAVE_KEY = 'moebius.save.v1';

export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

const DEFAULTS = {
  quality: isTouch ? 'low' : 'high',   // low | medium | high
  sensitivity: 1,
  invertY: false,
  music: 0.8,
  effects: 1,
  devPanel: false,
  showFps: true,
};

export class Settings {
  constructor() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {}; } catch { /* ignore */ }
    Object.assign(this, DEFAULTS, saved);
    this.listeners = [];
  }
  save() {
    const out = {};
    for (const k of Object.keys(DEFAULTS)) out[k] = this[k];
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(out)); } catch { /* ignore */ }
  }
  set(k, v) { this[k] = v; this.save(); for (const f of this.listeners) f(k, v); }
  on(f) { this.listeners.push(f); f(null); }
}

/** The settings menu: O, Esc (when nothing else is open) or the gear button. */
export class SettingsMenu {
  constructor(settings, { sound, onResetProgress, isBusy }) {
    this.s = settings;
    const el = (this.el = document.getElementById('settings'));
    const row = (label, control) => `<label class="row"><span>${label}</span>${control}</label>`;
    el.innerHTML = `
      <div class="panel">
        <h1>SETTINGS</h1>
        ${row('Graphics', `<select data-k="quality"><option value="low">Low (fast)</option><option value="medium">Medium</option><option value="high">High (smooth lines)</option></select>`)}
        ${row('Mouse / touch sensitivity', `<input data-k="sensitivity" type="range" min="0.3" max="3" step="0.05">`)}
        ${row('Invert camera Y', `<input data-k="invertY" type="checkbox">`)}
        ${row('Music', `<input data-k="music" type="range" min="0" max="1" step="0.05">`)}
        ${row('Effects', `<input data-k="effects" type="range" min="0" max="1" step="0.05">`)}
        ${row('Mute (M)', `<input data-k="mute" type="checkbox">`)}
        ${row('Show FPS (F)', `<input data-k="showFps" type="checkbox">`)}
        ${row('Developer panel', `<input data-k="devPanel" type="checkbox">`)}
        <div class="buttons">
          <button data-a="reset">Reset progress</button>
          <button data-a="close">Close</button>
        </div>
        <p class="keys">WASD move · SHIFT run · SPACE jump / glide / jetpack · E interact · J sketchbook · L worlds · P photo · H help · O settings</p>
      </div>`;
    const sync = () => {
      for (const c of el.querySelectorAll('[data-k]')) {
        const k = c.dataset.k;
        const v = k === 'mute' ? sound.muted : this.s[k];
        if (c.type === 'checkbox') c.checked = !!v; else c.value = v;
      }
    };
    el.addEventListener('input', (e) => {
      const c = e.target, k = c.dataset.k;
      if (!k) return;
      if (k === 'mute') { if (c.checked !== sound.muted) sound.toggleMute(); return; }
      this.s.set(k, c.type === 'checkbox' ? c.checked : c.type === 'range' ? +c.value : c.value);
    });
    el.addEventListener('click', (e) => {
      const a = e.target.dataset?.a;
      if (a === 'close' || e.target === el) this.toggle(false);
      if (a === 'reset' && confirm('Forget every relic, story page and saved position?')) onResetProgress();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyO') this.toggle();
      else if (e.code === 'Escape') {
        if (this.open) this.toggle(false);
        else if (!isBusy()) this.toggle(true);
      }
    });
    document.getElementById('gear')?.addEventListener('click', () => this.toggle());
    this.sync = sync;
  }
  toggle(on = !this.open) {
    this.open = on;
    if (on) { this.sync(); document.exitPointerLock?.(); }
    this.el.classList.toggle('open', on);
  }
}

/**
 * Touch: a virtual stick on the left half, camera drag on the right half,
 * buttons for jump, interact, run, sketchbook, worlds and settings. Writes
 * into the same `input` object as the keyboard (input.stick is analog).
 */
export class TouchControls {
  constructor(input, rig) {
    this.input = input;
    document.body.classList.add('touch');
    const root = document.getElementById('touch');
    root.innerHTML = `
      <div class="stick"><div class="nub"></div></div>
      <button data-key="Space" class="b-jump">⤒</button>
      <button data-key="KeyE" class="b-use">E</button>
      <button data-toggle="ShiftLeft" class="b-run">run</button>
      <button data-press="KeyJ" class="b-book">❏</button>
      <button data-press="KeyL" class="b-map">◫</button>`;
    const stick = root.querySelector('.stick'), nub = root.querySelector('.nub');
    let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
    const R = 60;
    const setStick = (dx, dy) => {
      const l = Math.hypot(dx, dy), k = l > R ? R / l : 1;
      dx *= k; dy *= k;
      nub.style.transform = `translate(${dx}px, ${dy}px)`;
      const x = dx / R, y = -dy / R;
      input.stick = { x: Math.abs(x) > 0.12 ? x : 0, y: Math.abs(y) > 0.12 ? y : 0 };
      // digital keys too, for vehicles
      input.KeyW = y > 0.35; input.KeyS = y < -0.35; input.KeyD = x > 0.35; input.KeyA = x < -0.35;
    };
    const canvas = document.querySelector('canvas');
    const onStart = (e) => {
      for (const t of e.changedTouches) {
        if (t.target.closest?.('button')) continue;
        if (t.clientX < innerWidth * 0.45 && stickId === null) {
          stickId = t.identifier; sx = t.clientX; sy = t.clientY;
          stick.style.left = `${sx - 70}px`; stick.style.top = `${sy - 70}px`;
          stick.classList.add('on');
          setStick(0, 0);
        } else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
      }
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) setStick(t.clientX - sx, t.clientY - sy);
        else if (t.identifier === lookId) { rig.look((t.clientX - lx) * 1.6, (t.clientY - ly) * 1.6); lx = t.clientX; ly = t.clientY; }
      }
      e.preventDefault();
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) { stickId = null; stick.classList.remove('on'); setStick(0, 0); input.stick = null; }
        if (t.identifier === lookId) lookId = null;
      }
    };
    canvas.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    // buttons: hold keys, toggle run, or a one-shot key press (for page hotkeys)
    for (const b of root.querySelectorAll('button')) {
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (b.dataset.key) input[b.dataset.key] = true;
        if (b.dataset.toggle) { input[b.dataset.toggle] = !input[b.dataset.toggle]; b.classList.toggle('on', input[b.dataset.toggle]); }
        if (b.dataset.press) window.dispatchEvent(new KeyboardEvent('keydown', { code: b.dataset.press }));
      }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); if (b.dataset.key) input[b.dataset.key] = false; }, { passive: false });
    }
  }
}

// ---------------------------------------------------------------------------

export const SaveGame = {
  load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } },
  write(state) { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, t: Date.now() })); } catch { /* ignore */ } },
  clear() { localStorage.removeItem(SAVE_KEY); },
};
