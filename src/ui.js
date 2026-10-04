import { VERSION } from './changelog.js';
// Player-facing UI: settings (saved), the settings menu, touch controls and
// the save file for "continue where you left off".

const SETTINGS_KEY = 'moebius.settings.v1';
const SAVE_KEY = 'moebius.save.v1';

export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

const DEFAULTS = {
  quality: isTouch ? 'auto' : 'high',   // auto | low | medium | high
  sensitivity: 1,
  invertY: false,
  swapAB: false,   // controller: B confirms and jumps, A goes back (native-pad.js)
  music: 0.8,
  effects: 1,
  voices: 0.8,          // the mumbled alien voices (src/story/voice.js)
  alienVoices: true,    // off: conversations go back to plain soft blips
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
  constructor(settings, { sound, onResetProgress, isBusy, onNews, onDev }) {
    this.s = settings;
    const el = (this.el = document.getElementById('settings'));
    const row = (label, control) => `<label class="row"><span>${label}</span>${control}</label>`;
    el.innerHTML = `
      <div class="panel">
        <h1>SETTINGS <span style="font-size:12px;letter-spacing:0;opacity:.6">v${VERSION}</span></h1>
        ${row('Graphics', `<select data-k="quality"><option value="auto">Auto (adapts to keep it smooth)</option><option value="low">Low (fast)</option><option value="medium">Medium</option><option value="high">High (smooth lines)</option></select>`)}
        ${row('Camera sensitivity', `<input data-k="sensitivity" type="range" min="0.3" max="3" step="0.05">`)}
        ${row('Invert camera Y', `<input data-k="invertY" type="checkbox">`)}
        ${row('Swap A/B (confirm/back)', `<input data-k="swapAB" type="checkbox">`)}
        ${row('Music', `<input data-k="music" type="range" min="0" max="1" step="0.05">`)}
        ${row('Effects', `<input data-k="effects" type="range" min="0" max="1" step="0.05">`)}
        ${row('Voices', `<input data-k="voices" type="range" min="0" max="1" step="0.05">`)}
        ${row('Alien voices (heard through your translator)', `<input data-k="alienVoices" type="checkbox">`)}
        ${row('Mute (M)', `<input data-k="mute" type="checkbox">`)}
        ${row('Show FPS (F)', `<input data-k="showFps" type="checkbox">`)}
        ${row('Developer panel', `<input data-k="devPanel" type="checkbox">`)}
        ${row('Dev menu: items, boxes, worlds (\`)', `<button data-a="dev" type="button">open</button>`)}
        <div class="buttons">
          <button data-a="reset">Reset progress</button>
          <button data-a="news">What's new (N)</button>
          <button data-a="close">Close</button>
        </div>
        <p class="keys">Controller: left stick move · right stick look · A/× jump · X/□ interact · Y/△ ping · RT/R2 run · LT/L2 aim the fluid tool, RT/R2 shoot · B/○ push · A/× again in the air boost · ↑ worlds · ↓ photo · View sketchbook · Menu settings. In menus: D-pad select, left/right adjust, A/× confirm, B/○ back, right stick scroll.</p>
        <p class="keys" id="app-build" hidden></p>
        <p class="keys install-tip">Play full screen on iPhone: open in Safari, tap Share → Add to Home Screen, then enable Open as Web App if shown.</p>
        <p class="keys">WASD move · SHIFT run · SPACE jump / glide / jetpack (SPACE again in the air: fluid boost) · E interact · Q ping scout · hold right mouse or R aim the fluid tool · left click or G shoot · C or middle click push · J sketchbook · L worlds · P photo · H help · O settings · N what's new</p>
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
      if (a === 'news') { this.toggle(false); onNews?.(); }
      if (a === 'dev') { e.preventDefault(); this.toggle(false); onDev?.(); }
      if (a === 'reset' && confirm('Forget every relic, story page and saved position?')) onResetProgress();
    });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;   // (holding Esc to skip a scene must not open the settings when the scene ends)
      if (e.code === 'KeyO') this.toggle();
      else if (e.code === 'Escape') {
        if (this.open) this.toggle(false);
        else if (!isBusy()) this.toggle(true);
      }
    });
    document.getElementById('gear')?.addEventListener('click', () => this.toggle());
    this.sync = sync;
    settings.on(() => sound?.setVoices?.(this.s.voices, this.s.alienVoices));
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
      <button data-press="KeyQ" class="b-ping" aria-label="Ping next objective">ping</button>
      <button data-press="KeyJ" class="b-book">❏</button>
      <button data-press="KeyL" class="b-map">◫</button>
      <button data-toggle="KeyR" class="b-aim" aria-label="Aim the fluid tool">◎</button>
      <button data-key="KeyG" class="b-fire" aria-label="Shoot fluid">✺</button>
      <button data-key="KeyC" class="b-push" aria-label="Push">✋</button>
      <button data-key="KeyX" class="b-mode" aria-label="Switch the fluid's mode">◐</button>`;
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
    // Touch events stay targeted at the element where the gesture began.
    // Only canvas gestures belong to gameplay; menu swipes must scroll normally.
    canvas.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    // buttons: hold keys, toggle run, or a one-shot key press (for page hotkeys)
    for (const b of root.querySelectorAll('button')) {
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (b.dataset.key) input[b.dataset.key] = true;
        if (b.dataset.toggle) { input[b.dataset.toggle] = !input[b.dataset.toggle]; b.classList.toggle('on', input[b.dataset.toggle]); }
        if (b.dataset.press) {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: b.dataset.press }));
          window.dispatchEvent(new KeyboardEvent('keyup', { code: b.dataset.press }));
        }
      }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); if (b.dataset.key) input[b.dataset.key] = false; }, { passive: false });
      b.addEventListener('touchcancel', () => { if (b.dataset.key) input[b.dataset.key] = false; });
      // Touch prevents the compatibility click; keyboard/assistive clicks still work.
      if (b.dataset.press) b.addEventListener('click', () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: b.dataset.press }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: b.dataset.press }));
      });
    }
  }
}

/**
 * The fluid tool's HUD while aiming: a small inked crosshair at the centre of
 * the screen, and under it the three charges as pips in the fluid's tones
 * (with the seconds to the refill when some are spent). The crosshair opens
 * when it sits on something the tool can touch and kicks on a hit; it
 * shakes when the tank is empty. The label says the gun mode (fluid,
 * stilling, ember) in its colour, and shows for a moment on a switch even
 * when not aiming. Without the backpack the body gets .no-tool (index.html
 * hides the tool's buttons and hints); with two modes or more, .modes.
 */
export class ToolHud {
  constructor(el = document.getElementById('tool')) {
    this.el = el;
    if (!el) return;
    el.innerHTML = '<div class="cross"><i></i><i></i><i></i><i></i></div><div class="mode"><b>fluid</b><span class="pips"><u></u><u></u><u></u></span><span class="wait"></span></div>';
    this.pips = [...el.querySelectorAll('.pips u')];
    this.wait = el.querySelector('.wait');
    this.cross = el.querySelector('.cross');
    this.name = el.querySelector('.mode b');
    this.last = ''; this.lastBody = '';
  }
  update({ on, charges = 3, max = 3, refillIn = 0, ready, aimKind, hit, tones = [], owned = true, mode = 'shoot', modeName = 'fluid', modes = 1, modeFlash = 0 }) {
    if (!this.el) return;
    const flash = modeFlash > 0 && !on;
    const bodyKey = `${on}|${owned}|${modes > 1}|${flash}`;
    if (bodyKey !== this.lastBody) {
      this.lastBody = bodyKey;
      const b = document.body.classList;
      b.toggle('aiming', on); b.toggle('no-tool', !owned); b.toggle('modes', modes > 1); b.toggle('modeflash', flash);
    }
    if (!on && !flash) return;
    const secs = charges < max ? Math.ceil(refillIn) : 0;
    const key = `${charges}|${max}|${secs}|${ready}|${aimKind}|${tones.join()}|${mode}`;
    if (key !== this.last) {
      // one pip per charge the tank holds (four with the Fourth chamber)
      if (this.pips.length !== max) {
        const row = this.el.querySelector('.pips');
        row.innerHTML = '<u></u>'.repeat(max);
        this.pips = [...row.querySelectorAll('u')];
      }
      this.last = key;
      if (this.name) this.name.textContent = modeName;
      this.el.className = `fluid m-${mode}${ready ? '' : ' wait'}${aimKind === 'target' ? ' lock' : ''}${charges ? '' : ' empty'}`;
      this.pips.forEach((u, i) => { u.style.background = i < charges ? tones[i % tones.length] ?? '' : ''; u.classList.toggle('on', i < charges); });
      this.wait.textContent = secs ? `${secs}s` : '';
    }
    if (hit === 'target' || hit === 'empty') {
      const c = this.cross;
      c.classList.remove('hit', 'empty'); void c.offsetWidth; c.classList.add(hit === 'target' ? 'hit' : 'empty');
    }
  }
}

// ---------------------------------------------------------------------------

export const SaveGame = {
  load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } },
  write(state) { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, t: Date.now() })); } catch { /* ignore */ } },
  clear() { localStorage.removeItem(SAVE_KEY); },
};
