import { store } from './platform.js';
import { VERSION } from './changelog.js';
import { confirmKey, backKey } from './native-pad.js';
import { slotStorage } from './save-slots.js';
import { UpdatePanel } from './update-panel.js';
// Player-facing UI: settings (saved), the settings menu, touch controls and
// the save file for "continue where you left off".

const SETTINGS_KEY = 'moebius.settings.v1';
const SAVE_KEY = 'moebius.save.v1';

export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// the Android app (the Retroid Pocket and phones) starts on the handheld preset (perf.js QUALITY_PRESETS)
export const isNativeApp = !!globalThis.Capacitor?.isNativePlatform?.();
/** The Steam Deck's app (Electron, desktop/main.mjs): the game at moebius://game, always fullscreen. */
export const isDeckApp = globalThis.location?.protocol === 'moebius:';

const DEFAULTS = {
  quality: isNativeApp ? 'handheld' : isDeckApp || isTouch ? 'auto' : 'high',   // auto | handheld | deck | low | medium | high
  sensitivity: 1,
  invertY: false,
  padFaces: 'auto',   // controller: where the printed A B X Y are (native-pad.js setFaces): auto | xbox | nintendo | nintendo-xbox
  music: 0.8,
  effects: 1,
  voices: 0.8,          // the mumbled alien voices (src/story/voice.js)
  alienVoices: true,    // off: conversations go back to plain soft blips
  enemies: true,        // the ink blots in the wilds and the machines in the temples (src/foes.js); off: the calm game
  devPanel: false,
  showFps: false,       // the frame readout (F, or ?fps=1 for a session): off, nothing on the screen
  hudV: 1,              // settings saved before v1 had the frame readout on by default: it goes off once
  deckV: 1,             // the Steam Deck before v1 started on High (its first save kept it): it goes to Auto (its own preset) once
};

export class Settings {
  constructor() {
    let saved = {};
    try { saved = JSON.parse(store.get(SETTINGS_KEY)) ?? {}; } catch { /* ignore */ }
    Object.assign(this, DEFAULTS, migrateSettings(saved, { deck: isDeckApp }));
    this.listeners = [];
  }
  save() {
    const out = {};
    for (const k of Object.keys(DEFAULTS)) out[k] = this[k];
    store.set(SETTINGS_KEY, JSON.stringify(out));
  }
  set(k, v) { this[k] = v; this.save(); for (const f of this.listeners) f(k, v); }
  on(f) { this.listeners.push(f); f(null); }
}

/** Saved settings from an older build, brought up to date (the frame readout was on by default until hudV 1). */
export function migrateSettings(saved = {}, { deck = false } = {}) {
  const out = { ...saved };
  if (!(out.hudV >= 1)) { delete out.showFps; out.hudV = 1; }
  // (High was only ever the default there: a player who picked a lighter preset keeps it)
  if (deck && !(out.deckV >= 1)) { if (['high', 'medium', undefined].includes(out.quality)) out.quality = 'auto'; out.deckV = 1; }
  return out;
}

/**
 * Every control, for the menu's Controls page: [what, how] pairs by device. Written in Xbox /
 * PlayStation form for the pad (native-pad.js prints them as the pad does).
 */
export function controlsList(ok = confirmKey(), back = backKey()) {
  return {
    keyboard: [
      ['Move · run', 'WASD · SHIFT'], ['Look', 'mouse (click the game to capture it) · wheel zooms'],
      ['Jump · fluid boost', 'SPACE · SPACE again in the air'], ['Jets / wings (once found)', 'hold SPACE in the air · or hold left click without aiming: WASD flies where you look (look down to dive), no keys hovers, SPACE climbs'],
      ['Climb', 'push into a wall'], ['Use, talk, get on / off', 'E (moving: jump off)'],
      ['In a cab (it drives itself)', 'choose a stop: click it, or its number · SPACE choose again · E get out'],
      ['The scout finds your objective', 'Q'], ['Aim the fluid tool · shoot', 'hold right mouse or R · left click or G'],
      ['Gun mode (fluid, push, and those found)', 'X'], ['Fluid blade (press again to chain three swings) · guard · lock on', 'F · hold CTRL or Z · TAB'], ['Dive · rise (in water)', 'Z or CTRL · SPACE'],
      ['Items, quests, sketchbook · menu · this page', 'J (Q / E turn its panels) · O or Esc · H'], ['Photo mode · frame readout · what\'s new', 'P · F3 · N'], ['Mute', 'M'],
    ],
    pad: [
      ['Move · run', 'left stick · click it (L3)'], ['Look · zoom', 'right stick · hold LB / L1 with the right stick (no foe near)'],
      ['Jump · boost · wings', 'A / × · again in the air · hold'], ['Use, talk, get on', 'B / ○'],
      ['Call your mount or a taxi', 'X / □'], ['The scout finds your objective', 'Y / △ (riding too)'],
      ['Aim · shoot', 'LT / L2 · RT / R2 while aiming'], ['Jets', 'hold RT / R2 without aiming: the left stick flies where you look (look down to dive, up to climb), the stick at rest hovers · A / × held climbs'],
      ['Gun mode (fluid, push, and those found)', 'D-pad left / right'], ['Fluid blade (press again to chain three swings) · guard · lock on', 'RB / R1 · hold LB / L1 · click the right stick (R3)'], ['Photo mode · bell whistle (once found)', 'D-pad down · D-pad up'],
      ['Items, quests and sketchbook · menu', 'View · Menu'],
      ['Their panels (items, quests, sketchbook, worlds)', 'LB / L1 · RB / R1'],
      ['Riding', 'RT / R2 go · LT / L2 brake · left stick steer (flying: forward dives, back climbs) · X / □ hop, flap, rise · RB / R1 boost · A / × jump off · B / ○ get off'],
      ['In a cab (it drives itself)', 'choose a stop: left stick and A / × · X / □ choose again · B / ○ get out'],
      ['Swimming', 'left stick swim (L3 sprints) · look down and swim forward to dive · A / × rise, climb out'],
      ['In menus', `D-pad select · left / right adjust · ${ok} confirm · ${back} back · right stick scroll`],
    ],
    touch: [
      ['Move · look', 'drag on the left · drag on the right'], ['Jump · use', '⤒ · the use button (it names what it does)'],
      ['Run', 'run (a toggle)'], ['The scout finds your objective', 'ping'], ['Aim · shoot · gun mode (push is one)', '◎ · ✺ · ◐'], ['Blade · guard (hold) · lock on', '⚔ · 🛡 · ◉'],
      ['Items, quests and sketchbook · menu', '❏ (its tabs turn the panels) · the small ⚙ in the corner'],
    ],
  };
}

/**
 * The Start menu: O, Esc (when nothing else is open), the small gear on a touch screen or Menu /
 * Start on a controller. Full screen: on the left Resume, Items and Quests (they open the game menu,
 * src/game-menu.js, on that panel: o.onBook(panel)), Settings, Controls, what's new and Quit to title
 * (with where you are: the save, the world, the time played); on the right the page: the settings
 * (where it opens) or every control (H opens it there). B / ○ or Esc closes it, from any page.
 * main.js pauses the game and plays the menu music while it is open.
 * The title screen (src/title.js) shows the same settings on its own element: { el, title: true }
 * (no game entries, no keys of its own; Controls is there too).
 * In the Android app the settings start with the game's updates (src/update-panel.js);
 * onBeforeRestart saves the game before an update restarts it.
 */
export const MENU_PAGES = ['settings', 'controls'];
export class SettingsMenu {
  constructor(settings, { sound, onResetProgress, isBusy = () => false, onNews, onDev, onQuit, onBook, onDebug, onBeforeRestart, where, el = document.getElementById('settings'), title = false }) {
    this.s = settings;
    this.el = el;
    this.where = where;
    this.current = 'settings';
    const row = (label, control) => `<label class="row"><span>${label}</span>${control}</label>`;
    const game = !title;
    const go = (page, label) => `<button data-a="page" data-page="${page}">${label}</button>`;
    el.classList.add('fullmenu');
    el.innerHTML = `
      <div class="pause">
        <aside class="side">
          <div class="brand" aria-hidden="true">${game ? 'PAUSED' : 'HIRAETH'}</div>
          <div class="where"></div>
          <nav class="menu-nav">
            <button data-a="close" class="primary">${game ? 'Resume' : 'Back'}</button>
            ${game ? '<button data-a="book" data-panel="items">Items</button><button data-a="book" data-panel="quests">Quests</button>' : ''}
            ${go('settings', 'Settings')}
            ${go('controls', 'Controls')}
            ${game ? `<button data-a="news">What's new</button>
            <button data-a="debug">Debug: worlds</button>
            <button data-a="title">Quit to title</button>` : ''}
          </nav>
          <p class="saved">${game ? 'Your progress is saved as you play.' : ''}</p>
        </aside>
        <section class="panel" data-page="settings">
          <h1>SETTINGS <span>v${VERSION}</span></h1>
          ${isNativeApp || isDeckApp ? '<section class="updates" hidden></section>' : ''}
          ${row('Graphics', `<select data-k="quality"><option value="auto">Auto (adapts to keep it smooth)</option><option value="handheld">Handheld (Retroid, phones)</option><option value="deck">Steam Deck</option><option value="low">Low (fast)</option><option value="medium">Medium</option><option value="high">High (smooth lines)</option></select>`)}
          ${row('Camera sensitivity', `<input data-k="sensitivity" type="range" min="0.3" max="3" step="0.05">`)}
          ${row('Invert camera Y', `<input data-k="invertY" type="checkbox">`)}
          ${row('Controller buttons', `<select data-k="padFaces"><option value="auto">Auto</option><option value="xbox">A at the bottom (Xbox, PlayStation)</option><option value="nintendo">A on the right (Retroid, Nintendo)</option><option value="nintendo-xbox">A on the right, Retroid set to Xbox style</option></select>`)}
          ${row('Music', `<input data-k="music" type="range" min="0" max="1" step="0.05">`)}
          ${row('Effects', `<input data-k="effects" type="range" min="0" max="1" step="0.05">`)}
          ${row('Voices', `<input data-k="voices" type="range" min="0" max="1" step="0.05">`)}
          ${row('Alien voices (heard through your translator)', `<input data-k="alienVoices" type="checkbox">`)}
          ${row('Mute (M)', `<input data-k="mute" type="checkbox">`)}
          ${row('Enemies (ink blots in the wilds, machines in the temples)', `<input data-k="enemies" type="checkbox">`)}
          ${row('Show FPS and frame time (F3)', `<input data-k="showFps" type="checkbox">`)}
          ${game ? `${row('Developer panel', `<input data-k="devPanel" type="checkbox">`)}
          ${row('Dev menu: items, boxes, worlds (\`)', `<button data-a="dev" type="button">open</button>`)}
          <div class="danger">
            <button data-a="reset">Restart this save from the prologue</button>
            <div class="ask" hidden><span>Forget every relic, story page and place in this save?</span>
              <button data-a="reset-yes">Yes, start over</button><button data-a="reset-no">No, keep it</button></div>
          </div>` : ''}
          ${isNativeApp || isDeckApp ? "" : `<p class="keys install-tip">Play full screen on iPhone: open in Safari, tap Share → Add to Home Screen, then enable Open as Web App if shown.</p>`}
        </section>
        <section class="panel controls" data-page="controls" hidden></section>
      </div>`;
    // the controls page names the menu's confirm / back buttons, which follow the "Controller buttons" setting
    this.syncControls = () => {
      const p = el.querySelector('.panel[data-page="controls"]'), b = typeof document !== 'undefined' ? document.body.classList : null;
      if (p) p.innerHTML = controlsHtml(controlsList(), b?.contains('controller') ? 'pad' : b?.contains('touch') ? 'touch' : 'keyboard');
    };
    const sync = () => {
      this.syncControls();
      for (const c of el.querySelectorAll('[data-k]')) {
        const k = c.dataset.k;
        const v = k === 'mute' ? sound?.muted : this.s[k];
        if (c.type === 'checkbox') c.checked = !!v; else c.value = v;
      }
    };
    el.addEventListener('input', (e) => {
      const c = e.target, k = c.dataset.k;
      if (!k) return;
      if (k === 'mute') { if (sound && c.checked !== sound.muted) sound.toggleMute(); return; }
      this.s.set(k, c.type === 'checkbox' ? c.checked : c.type === 'range' ? +c.value : c.value);
    });
    const ask = el.querySelector('.ask'), resetBtn = el.querySelector('[data-a="reset"]');
    this.askReset = (on) => {
      if (!ask) return;
      ask.hidden = !on; resetBtn.hidden = on;
      if (on) ask.querySelector('[data-a="reset-no"]').focus({ preventScroll: true });
      else if (ask.contains(document.activeElement)) resetBtn.focus({ preventScroll: true });
    };
    el.addEventListener('click', (e) => {
      const at = e.target.closest?.('[data-a]'), a = at?.dataset.a;
      if (a === 'close') this.toggle(false);
      if (a === 'page') this.page(at.dataset.page);
      if (a === 'news') { this.toggle(false); onNews?.(); }
      if (a === 'book') { this.toggle(false); onBook?.(at.dataset.panel); }
      if (a === 'title') onQuit?.();
      if (a === 'debug') { this.toggle(false); onDebug?.(); }
      if (a === 'dev') { e.preventDefault(); this.toggle(false); onDev?.(); }
      // (an inline question, not confirm(): a controller can answer it)
      if (a === 'reset') this.askReset(true);
      if (a === 'reset-no') this.askReset(false);
      if (a === 'reset-yes') onResetProgress?.();
    });
    if (game) {
      window.addEventListener('keydown', (e) => {
        if (e.repeat) return;   // (holding Esc to skip a scene must not open the settings when the scene ends)
        if (e.code === 'KeyO') this.toggle();
        else if (e.code === 'KeyH' && !isBusy()) { if (this.open && this.current === 'controls') this.toggle(false); else this.toggle(true, 'controls'); }
        else if (e.code === 'Escape') {
          if (this.open) this.back();
          else if (!isBusy()) this.toggle(true);
        }
      });
      document.getElementById('gear')?.addEventListener('click', () => this.toggle());
    }
    this.sync = sync;
    this.updates = new UpdatePanel(el.querySelector('.updates'), { onBeforeRestart });
    settings.on(() => sound?.setVoices?.(this.s.voices, this.s.alienVoices));
  }
  /** Show a page on the right: 'settings' or 'controls'. */
  page(name = 'settings') {
    if (!this.el.querySelector(`[data-page="${name}"].panel`)) name = 'settings';
    this.current = name;
    for (const p of this.el.querySelectorAll('.panel[data-page]')) p.hidden = p.dataset.page !== name;
    for (const b of this.el.querySelectorAll('.menu-nav [data-page]')) b.classList.toggle('on', b.dataset.page === name);
    if (name === 'controls') this.syncControls();
    this.el.querySelector(`.panel[data-page="${name}"]`)?.scrollTo?.(0, 0);
  }
  /**
   * Back (B / ○, Esc): first out of the "start over?" question, then out of the menu, whatever
   * page it shows (the pages are side by side, not one inside another: B closes the menu).
   */
  back() {
    const ask = this.el.querySelector('.ask');
    if (ask && !ask.hidden) this.askReset(false);
    else this.toggle(false);
  }
  /** Open (on a page: 'settings' unless asked) or close. */
  toggle(on = !this.open, page = 'settings') {
    this.open = on;
    if (on) {
      this.sync(); document.exitPointerLock?.();
      const w = this.el.querySelector('.where');
      if (w) w.innerHTML = this.where?.() ?? '';
      this.askReset(false);
      this.page(page);
      this.updates?.open();
    } else {
      this.updates?.close();
      if (this.el.contains(document.activeElement)) document.activeElement.blur();
    }
    this.el.classList.toggle('open', on);
    // (focus once it shows: a hidden element can't take it; on a page, its button)
    if (on) (this.el.querySelector(page !== 'settings' ? `.menu-nav [data-page="${page}"]` : '.primary') ?? this.el.querySelector('.primary'))?.focus({ preventScroll: true });
  }
}

/** The Controls page: a controller, keyboard and mouse, a touch screen (`first`: the one in your hands). */
export function controlsHtml(list = controlsList(), first = 'keyboard') {
  const rows = (l) => l.map(([what, how]) => `<li><span>${what}</span><b>${how}</b></li>`).join('');
  const names = { pad: 'Controller', keyboard: 'Keyboard and mouse', touch: 'Touch' };
  const order = [first, ...['pad', 'keyboard', 'touch'].filter((k) => k !== first)];
  return `<h1>CONTROLS</h1>
    ${order.map((k) => `<h2>${names[k]}</h2><ul class="ctl">${rows(list[k])}</ul>`).join('\n    ')}
    <p class="keys">Nothing stays on the screen while you play: the health and the stamina show when they change, and the use button's prompt when something is near. The tank on your backpack shows how full it is.</p>`;
}

/**
 * Touch: a virtual stick on the left half, camera drag on the right half,
 * buttons for jump, interact, run, the scout's find, the game menu (❏) and the fluid tool (the
 * menu is the small faint ⚙ in the corner, index.html #gear). Writes
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
      <button data-press="KeyQ" class="b-ping" aria-label="The scout finds your objective">ping</button>
      <button data-press="KeyJ" class="b-book">❏</button>
      <button data-toggle="KeyR" class="b-aim" aria-label="Aim the fluid tool">◎</button>
      <button data-key="TouchFire" class="b-fire" aria-label="Shoot fluid">✺</button>
      <button data-key="KeyX" class="b-mode" aria-label="Switch the fluid's mode">◐</button>
      <button data-key="TouchBlade" class="b-blade" aria-label="Swing the fluid blade">⚔</button>
      <button data-key="TouchGuard" class="b-guard" aria-label="Guard (hold)">🛡</button>
      <button data-press="Tab" class="b-lock" aria-label="Lock on to a foe">◉</button>`;
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
 * The fluid tool's HUD while aiming: a small inked crosshair at the centre of the screen and, under
 * it, the gun mode's name (fluid, stilling, ember) in its colour. No charge pips: the tank on the
 * backpack shows how full it is. The crosshair opens when it sits on something the tool can touch
 * and kicks on a hit; it is dashed and shakes when the tank is empty. The mode's name shows for a
 * moment on a switch even when not aiming, and "empty" for a moment when the tank runs dry (the
 * only time the tank says anything off the backpack). Without the backpack the body gets .no-tool
 * (index.html hides the tool's buttons and hints); with two modes or more, .modes.
 */
export class ToolHud {
  constructor(el = document.getElementById('tool')) {
    this.el = el;
    if (!el) return;
    el.innerHTML = '<div class="cross"><i></i><i></i><i></i><i></i></div><div class="mode"><b>fluid</b></div>';
    this.cross = el.querySelector('.cross');
    this.name = el.querySelector('.mode b');
    this.last = ''; this.lastBody = '';
  }
  update({ on, charges = 3, ready, aimKind, hit, owned = true, mode = 'shoot', modeName = 'fluid', modes = 1, modeFlash = 0, dry = false, now = performance.now() / 1000 }) {
    if (!this.el) return;
    const flash = modeFlash > 0 && !on;
    const gauge = !on && !flash && this.gaugeShown({ owned, dry, now });
    const bodyKey = `${on}|${owned}|${modes > 1}|${flash}|${gauge}`;
    if (bodyKey !== this.lastBody) {
      this.lastBody = bodyKey;
      const b = document.body.classList;
      b.toggle('aiming', on); b.toggle('no-tool', !owned); b.toggle('modes', modes > 1); b.toggle('modeflash', flash); b.toggle('tool-gauge', gauge);
    }
    if (!on && !flash && !gauge) return;
    const key = `${charges > 0}|${ready}|${aimKind}|${mode}|${modeName}`;
    if (key !== this.last) {
      this.last = key;
      if (this.name) this.name.textContent = modeName;
      this.el.className = `fluid m-${mode}${ready ? '' : ' wait'}${aimKind === 'target' ? ' lock' : ''}${charges ? '' : ' empty'}`;
    }
    if (on && (hit === 'target' || hit === 'empty')) {
      const c = this.cross;
      c.classList.remove('hit', 'empty'); void c.offsetWidth; c.classList.add(hit === 'target' ? 'hit' : 'empty');
    }
  }
  /**
   * The empty tank's notice, when not aiming: the tank running dry (waiting for magical water) says
   * "empty" beside the traveller for GAUGE_DRY seconds, then goes. Nothing else: a short tank, a
   * refill or the jets burning show on the backpack's own tank, not on the screen.
   */
  gaugeShown({ owned, dry, now }) {
    if (!owned) { this.gaugeUntil = 0; this.wasDry = dry; return false; }
    if (dry && !this.wasDry) this.gaugeUntil = now + GAUGE_DRY;
    this.wasDry = dry;
    return now < (this.gaugeUntil ?? 0);
  }
}
/** s the empty tank's notice stays. */
export const GAUGE_DRY = 3;

// ---------------------------------------------------------------------------

// where you stand, in the active save slot (src/save-slots.js)
export const SaveGame = {
  load() { try { return JSON.parse(slotStorage.getItem(SAVE_KEY)); } catch { return null; } },
  write(state) { try { slotStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, t: Date.now() })); } catch { /* ignore */ } },
  clear() { slotStorage.removeItem(SAVE_KEY); },
};
