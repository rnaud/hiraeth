import { store } from './platform.js';
import { VERSION } from './changelog.js';
import { confirmKey, backKey } from './native-pad.js';
import { PAD, PAD_VERBS, KEYS, BUTTON_NAME } from './bindings.js';
import { slotStorage } from './save-slots.js';
import { UpdatePanel } from './update-panel.js';
import { devMode } from './dev-gate.js';
import { t, setLanguage, onLanguage, LANGUAGES } from './i18n.js';
import { setControlPrefs, controlPrefs, keyFor, keyLabel, verbKey, keyConflicts, padFor, padConflicts, captureKey, capturePad, RESERVED_KEYS } from './remap.js';
import { setMotion } from './feel.js';
import { touchScale, touchLayout, stickLayout } from './touch-layout.js';
import { padCancel } from './menu-pad.js';
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
  invertFlight: false,  // the jets (player.js JET): off, the stick forward tips the nose down as a plane's; on, forward climbs
  padFaces: 'auto',   // controller: where the printed A B X Y are (native-pad.js setFaces): auto | xbox | nintendo | nintendo-xbox
  music: 0.8,
  musicMode: 'moments', // the recorded theme for arrivals, interiors and moments, ambience between (src/music-moments.js) | always
  effects: 1,
  voices: 0.8,          // the mumbled alien voices (src/story/voice.js)
  alienVoices: true,    // off: conversations go back to plain soft blips
  enemies: 'normal',    // the foes (src/foes.js): normal | gentle (half the harm, slower, one at a time) | off (the calm game)
  devPanel: false,
  showFps: false,       // the frame readout (F, or ?fps=1 for a session): off, nothing on the screen
  hitboxes: false,      // the fight's hitbox overlay (F4, L3 + R3, the dev menu, the Arena's board: src/hitboxes.js)
  // accessibility (docs/systems/ui.md, "Accessibility"): applyAccess() hands them to the modules that use them
  lang: 'en',           // the menus' and the HUD's language (src/i18n.js): en | fr
  textSize: 'normal',   // the words on the screen (TEXT_SIZES: dialogue, toasts, story pages, the menus)
  speechBg: false,      // a solid, plain background behind what is said (the conversation panel, the balloons)
  reduceMotion: null,   // no hit-stop, slow motion or camera kicks, a still title (src/feel.js); null: as the system asks
  shake: 1,             // the camera's kick when a blow lands, 0..1
  keys: {},             // keyboard: verb → key, where the player moved it (src/remap.js; the defaults: bindings.js KEYS)
  pad: {},              // controller: verb → button, where the player moved it (the defaults: bindings.js PAD_VERBS)
  run: 'auto',          // run on the pad: auto (L3 until you stop) | hold | toggle (the keyboard: hold | toggle)
  guard: 'hold',        // guard: hold | toggle
  hudV: 1,              // settings saved before v1 had the frame readout on by default: it goes off once
  deckV: 1,             // the Steam Deck before v1 started on High (its first save kept it): it goes to Auto (its own preset) once
};

/** The text sizes (× the words' size): the "Text size" setting. */
export const TEXT_SIZES = { small: 0.85, normal: 1, large: 1.2, larger: 1.45 };

/** Reduced motion: the setting, or (not set yet) what the system asks for (prefers-reduced-motion). */
export function reducedMotion(s, win = globalThis.window) {
  if (s?.reduceMotion === true || s?.reduceMotion === false) return s.reduceMotion;
  return !!win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

/**
 * The accessibility settings, handed to the modules that use them: the controls (src/remap.js), the motion
 * (src/feel.js), the language (src/i18n.js), and the page's text size, speech background and reduced motion
 * (the root's --ts, .speech-solid, .reduce-motion: index.html, menus.css, game-menu.css).
 */
export function applyAccess(s, doc = globalThis.document) {
  setControlPrefs(s);
  const still = reducedMotion(s);
  setMotion({ reduce: still, shake: s.shake ?? 1 });
  setLanguage(s.lang);
  const root = doc?.documentElement;
  if (!root) return;
  root.style?.setProperty?.('--ts', String(TEXT_SIZES[s.textSize] ?? 1));
  root.classList?.toggle('speech-solid', !!s.speechBg);
  root.classList?.toggle('reduce-motion', still);
}

export class Settings {
  constructor() {
    let saved = {};
    try { saved = JSON.parse(store.get(SETTINGS_KEY)) ?? {}; } catch { /* ignore */ }
    Object.assign(this, DEFAULTS, migrateSettings(saved, { deck: isDeckApp }));
    this.listeners = [];
    applyAccess(this);
  }
  save() {
    const out = {};
    for (const k of Object.keys(DEFAULTS)) out[k] = this[k];
    store.set(SETTINGS_KEY, JSON.stringify(out));
  }
  set(k, v) { this[k] = v; this.save(); applyAccess(this); for (const f of this.listeners) f(k, v); }
  on(f) { this.listeners.push(f); f(null); }
}

/** Saved settings from an older build, brought up to date (the frame readout was on by default until hudV 1). */
export function migrateSettings(saved = {}, { deck = false } = {}) {
  const out = { ...saved };
  if (!(out.hudV >= 1)) { delete out.showFps; out.hudV = 1; }
  // (High was only ever the default there: a player who picked a lighter preset keeps it)
  if (typeof out.enemies === 'boolean') out.enemies = out.enemies ? 'normal' : 'off';   // (v0.87 saved it as on / off)
  if (deck && !(out.deckV >= 1)) { if (['high', 'medium', undefined].includes(out.quality)) out.quality = 'auto'; out.deckV = 1; }
  return out;
}

/**
 * Every control, for the menu's Controls page: [what, how] pairs by device. Written in Xbox /
 * PlayStation form for the pad (native-pad.js prints them as the pad does, in the buttons the player chose);
 * the keyboard's in the keys as they are now (moved, or printed otherwise on this keyboard: an AZERTY's Z).
 */
export function controlsList(ok = confirmKey(), back = backKey()) {
  const P = { ...PAD, ok, back };
  const K = Object.fromEntries(Object.keys(KEYS).map((v) => [v, verbKey(v)]));
  K.move = `${K.forward}${K.left}${K.back}${K.right}`;
  const rows = (prefix, ids, vars) => ids.map((id) => [t(`${prefix}.${id}`, vars), t(`${prefix}.${id}.how`, vars), id]);
  return {
    keyboard: rows('ctl.k', ['move', 'look', 'jump', 'jets', 'climb', 'use', 'cab', 'fight', 'aim', 'dive', 'scout', 'gadget', 'whistle', 'pages', 'photo', 'mute', 'debug'], K),
    pad: rows('ctl.p', ['move', 'look', 'jump', 'use', 'evade', 'fight', 'lock', 'scout', 'aim', 'mode', 'jets', 'gadget', 'whistle', 'call', 'pages', 'panels', 'photo', 'ride', 'cab', 'swim', 'talk', 'menus', 'debug'], P),
    touch: rows('ctl.t', ['move', 'jump', 'jets', 'run', 'scout', 'aim', 'fight', 'gadget', 'pages'], {}),
  };
}
// (the pad's rows that name the menus' own buttons, which never move: native-pad.js leaves them as they are)
const PAD_RAW_ROWS = new Set(['talk', 'menus', 'panels', 'photo']);

/** The verbs on the Controls page's "your buttons" and "your keys", in the order shown. */
export const REBIND_PAD = ['jump', 'evade', 'interact', 'gadget', 'blade', 'guard', 'aim', 'fire', 'run', 'lock', 'pick', 'call', 'modePrev', 'modeNext'];
export const REBIND_KEYS = ['forward', 'back', 'left', 'right', 'run', 'jump', 'interact', 'blade', 'guard', 'evade', 'lock', 'aim', 'fire', 'mode', 'scout', 'gadget', 'gadgetNext', 'whistle', 'journal', 'menu', 'controls', 'photo', 'mute'];

/**
 * The Controls page's rebinding: each verb with its key or button now, the ones that share one marked
 * (⚠ and the other verb's name: not by colour alone), and a reset. `kind`: 'pad' or 'keys'.
 */
export function rebindHtml(kind, prefs = controlPrefs()) {
  const pad = kind === 'pad';
  const verbs = pad ? REBIND_PAD : REBIND_KEYS;
  const clash = pad ? padConflicts(prefs.pad) : keyConflicts(prefs.keys);
  const on = (v) => (pad ? padFor(v, prefs.pad) : keyFor(v, prefs.keys));
  const name = (v) => (pad ? BUTTON_NAME[on(v)] : keyLabel(on(v)));
  const moved = (v) => (pad ? on(v) !== PAD_VERBS[v] : on(v) !== KEYS[v]);
  const verbName = (v) => { const k = `verb.${v}.${kind}`, s = t(k); return s === k ? t(`verb.${v}`) : s; };
  const rows = verbs.map((v) => {
    const others = clash.has(v) ? verbs.filter((w) => w !== v && on(w) === on(v)).map((w) => verbName(w)) : [];
    return `<li class="${others.length ? 'clash' : ''}${moved(v) ? ' moved' : ''}"><span>${verbName(v)}</span>`
      + `<button type="button" data-rebind="${kind}" data-verb="${v}" aria-label="${verbName(v)}: ${name(v)}">${name(v)}</button>`
      + `${others.length ? `<em>⚠ ${t('rebind.also', { verbs: others.join(', ') })}</em>` : ''}</li>`;
  }).join('');
  return `<section class="rebind ${pad ? 'pad-raw' : ''}" data-kind="${kind}">
      <h2>${t(pad ? 'rebind.padTitle' : 'rebind.keysTitle')}</h2>
      <p class="keys">${t(pad ? 'rebind.padHow' : 'rebind.keysHow')}</p>
      <ul class="rb">${rows}</ul>
      <p class="rb-foot">${clash.size ? `<span class="rb-warn">⚠ ${t('rebind.clashes')}</span>` : ''}<button type="button" data-a="rebind-reset" data-kind="${kind}">${t('rebind.reset')}</button></p>
    </section>`;
}

/**
 * The Start menu: O, Esc (when nothing else is open), the small gear on a touch screen or Menu /
 * Start on a controller. Full screen: on the left Resume, Items and Quests (they open the game menu,
 * src/game-menu.js, on that panel: o.onBook(panel)), Settings, Controls, Photo mode, what's new and Quit to title
 * (with where you are: the save, the world, the time played); on the right the page: the settings
 * (where it opens) or every control (H opens it there), with the rebinding at its top. B / ○ or Esc closes it,
 * from any page. main.js pauses the game and plays the menu music while it is open.
 * The title screen (src/title.js) shows the same settings on its own element: { el, title: true }
 * (no game entries, no keys of its own; Controls is there too).
 * In the Android app the settings start with the game's updates (src/update-panel.js);
 * onBeforeRestart saves the game before an update restarts it.
 * Its words are the language's (src/i18n.js): it draws itself again when the language changes.
 */
export const MENU_PAGES = ['settings', 'controls'];
export class SettingsMenu {
  constructor(settings, { sound, onResetProgress, isBusy = () => false, onNews, onDev, onQuit, onBook, onPhoto, onDebug, onBeforeRestart, where, el = document.getElementById('settings'), title = false }) {
    this.s = settings;
    this.el = el;
    this.where = where;
    this.title = title;
    this.sound = sound;
    this.current = 'settings';
    el.classList.add('fullmenu');
    this.render();
    // the controls page names the menu's confirm / back buttons, which follow the "Controller buttons" setting
    this.syncControls = () => {
      const p = el.querySelector('.panel[data-page="controls"]'), b = typeof document !== 'undefined' ? document.body.classList : null;
      const kind = b?.contains('controller') ? 'pad' : b?.contains('touch') ? 'touch' : 'keyboard';
      if (p) p.innerHTML = controlsHtml(controlsList(), kind, kind === 'pad' ? ['pad', 'keys'] : ['keys', 'pad']);
    };
    const sync = () => {
      this.syncControls();
      // the author's entries (src/dev-gate.js): the Developer panel setting, a dev build or ?dev=1
      const dev = devMode({ settings: this.s });
      for (const b of el.querySelectorAll('[data-dev]')) b.hidden = !dev;
      for (const c of el.querySelectorAll('[data-k]')) {
        const k = c.dataset.k;
        const v = k === 'mute' ? sound?.muted : k === 'reduceMotion' ? reducedMotion(this.s) : this.s[k];
        if (c.type === 'checkbox') c.checked = !!v; else c.value = v;
      }
    };
    el.addEventListener('input', (e) => {
      const c = e.target, k = c.dataset.k;
      if (!k) return;
      if (k === 'mute') { if (sound && c.checked !== sound.muted) sound.toggleMute(); return; }
      this.s.set(k, c.type === 'checkbox' ? c.checked : c.type === 'range' ? +c.value : c.value);
      if (k === 'devPanel') sync();   // (the Developer panel shows the debug entries too)
    });
    this.askReset = (on) => {
      const ask = el.querySelector('.ask'), resetBtn = el.querySelector('[data-a="reset"]');
      if (!ask) return;
      ask.hidden = !on; resetBtn.hidden = on;
      if (on) ask.querySelector('[data-a="reset-no"]').focus({ preventScroll: true });
      else if (ask.contains(document.activeElement)) resetBtn.focus({ preventScroll: true });
    };
    el.addEventListener('click', (e) => {
      const at = e.target.closest?.('[data-a], [data-rebind]'), a = at?.dataset.a;
      if (at?.dataset.rebind) { e.preventDefault(); this.rebind(at.dataset.rebind, at.dataset.verb); return; }
      if (a === 'close') this.toggle(false);
      if (a === 'page') this.page(at.dataset.page);
      if (a === 'news') { this.toggle(false); onNews?.(); }
      if (a === 'photo') { this.toggle(false); onPhoto?.(); }
      if (a === 'book') { this.toggle(false); onBook?.(at.dataset.panel); }
      if (a === 'title') onQuit?.();
      if (a === 'debug' && devMode({ settings: this.s })) { this.toggle(false); onDebug?.(); }
      if (a === 'dev') { e.preventDefault(); this.toggle(false); onDev?.(); }
      if (a === 'rebind-reset') { this.s.set(at.dataset.kind === 'pad' ? 'pad' : 'keys', {}); this.syncControls(); el.querySelector(`[data-a="rebind-reset"][data-kind="${at.dataset.kind}"]`)?.focus({ preventScroll: true }); }
      // (an inline question, not confirm(): a controller can answer it)
      if (a === 'reset') this.askReset(true);
      if (a === 'reset-no') this.askReset(false);
      if (a === 'reset-yes') onResetProgress?.();
    });
    if (!title) {
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
    // a new language: the menu in its words, on the page it was on, the language setting still in hand
    onLanguage(() => {
      const page = this.current, focus = document.activeElement?.dataset?.k;
      this.render();
      this.page(page);
      if (this.open) { this.sync(); const w = this.el.querySelector('.where'); if (w) w.innerHTML = this.where?.() ?? ''; }
      if (focus) this.el.querySelector(`[data-k="${focus}"]`)?.focus({ preventScroll: true });
    });
  }
  /** Draw the menu (again, in a new language): the side, the settings, the controls' page (filled when it shows). */
  render() {
    const el = this.el, game = !this.title;
    const row = (label, control) => `<label class="row"><span>${label}</span>${control}</label>`;
    const go = (page, label) => `<button data-a="page" data-page="${page}">${label}</button>`;
    const opts = (k, list) => `<select data-k="${k}">${list.map((v) => `<option value="${v}">${t(`set.${k}.${v}`)}</option>`).join('')}</select>`;
    const updates = el.querySelector('.updates');   // (kept across a redraw: it has its own state)
    el.innerHTML = `
      <div class="pause">
        <aside class="side">
          <div class="brand" aria-hidden="true">${game ? t('menu.paused') : 'HIRAETH'}</div>
          <div class="where"></div>
          <nav class="menu-nav">
            <button data-a="close" class="primary">${game ? t('menu.resume') : t('menu.back')}</button>
            ${game ? `<button data-a="book" data-panel="items">${t('menu.items')}</button><button data-a="book" data-panel="quests">${t('menu.quests')}</button>` : ''}
            ${go('settings', t('menu.settings'))}
            ${go('controls', t('menu.controls'))}
            ${game ? `<button data-a="photo">${t('menu.photo')}</button>
            <button data-a="news">${t('menu.news')}</button>
            <button data-a="debug" data-dev hidden>${t('menu.debug')}</button>
            <button data-a="title">${t('menu.quit')}</button>` : ''}
          </nav>
          <p class="saved">${game ? t('menu.saved') : ''}</p>
        </aside>
        <section class="panel" data-page="settings">
          <h1>${t('set.title')} <span>v${VERSION}</span></h1>
          ${isNativeApp || isDeckApp ? '<section class="updates" hidden></section>' : ''}
          <h2>${t('set.group.screen')}</h2>
          ${row(t('set.lang'), `<select data-k="lang" data-pad="open">${Object.entries(LANGUAGES).map(([id, l]) => `<option value="${id}">${l.name}</option>`).join('')}</select>`)}
          ${row(t('set.quality'), opts('quality', ['auto', 'handheld', 'deck', 'low', 'medium', 'high']))}
          ${row(t('set.textSize'), opts('textSize', Object.keys(TEXT_SIZES)))}
          ${row(t('set.speechBg'), `<input data-k="speechBg" type="checkbox">`)}
          ${row(t('set.showFps'), `<input data-k="showFps" type="checkbox">`)}
          <h2>${t('set.group.camera')}</h2>
          ${row(t('set.sensitivity'), `<input data-k="sensitivity" type="range" min="0.3" max="3" step="0.05">`)}
          ${row(t('set.invertY'), `<input data-k="invertY" type="checkbox">`)}
          ${row(t('set.invertFlight'), `<input data-k="invertFlight" type="checkbox">`)}
          ${row(t('set.reduceMotion'), `<input data-k="reduceMotion" type="checkbox">`)}
          ${row(t('set.shake'), `<input data-k="shake" type="range" min="0" max="1" step="0.05">`)}
          <h2>${t('set.group.controls')}</h2>
          ${row(t('set.padFaces'), opts('padFaces', ['auto', 'xbox', 'nintendo', 'nintendo-xbox']))}
          ${row(t('set.run'), opts('run', ['auto', 'hold', 'toggle']))}
          ${row(t('set.guard'), opts('guard', ['hold', 'toggle']))}
          <div class="row"><span>${t('set.rebind')}</span><button type="button" data-a="page" data-page="controls">${t('set.rebindOpen')}</button></div>
          <h2>${t('set.group.sound')}</h2>
          ${row(t('set.music'), `<input data-k="music" type="range" min="0" max="1" step="0.05">`)}
          ${row(t('set.musicMode'), `<select data-k="musicMode"><option value="moments">${t('set.musicMode.moments')}</option><option value="always">${t('set.musicMode.always')}</option></select>`)}
          ${row(t('set.effects'), `<input data-k="effects" type="range" min="0" max="1" step="0.05">`)}
          ${row(t('set.voices'), `<input data-k="voices" type="range" min="0" max="1" step="0.05">`)}
          ${row(t('set.alienVoices'), `<input data-k="alienVoices" type="checkbox">`)}
          ${row(t('set.mute'), `<input data-k="mute" type="checkbox">`)}
          <h2>${t('set.group.game')}</h2>
          ${row(t('set.enemies'), opts('enemies', ['normal', 'gentle', 'off']))}
          ${game ? `${row(t('set.devPanel'), `<input data-k="devPanel" type="checkbox">`)}
          ${row(t('set.devMenu'), `<button data-a="dev" type="button">${t('set.devOpen')}</button>`)}
          <div class="danger">
            <button data-a="reset">${t('set.reset')}</button>
            <div class="ask" hidden><span>${t('set.resetAsk')}</span>
              <button data-a="reset-yes">${t('set.resetYes')}</button><button data-a="reset-no">${t('set.resetNo')}</button></div>
          </div>` : ''}
          ${isNativeApp || isDeckApp ? '' : `<p class="keys install-tip">${t('set.installTip')}</p>`}
        </section>
        <section class="panel controls" data-page="controls" hidden></section>
      </div>`;
    if (updates) el.querySelector('.updates')?.replaceWith(updates);
  }
  /**
   * "Press a key" / "press a button" for a verb (the Controls page): the next one pressed is its new key or
   * button (src/remap.js captureKey / capturePad: nothing else gets it), Esc or Menu leaves it as it was, and so
   * does waiting 8 s. Saved with the settings; another verb on it is shown as a clash, not moved.
   */
  rebind(kind, verb) {
    this.stopRebind?.();
    const btn = this.el.querySelector(`[data-rebind="${kind}"][data-verb="${verb}"]`);
    if (!btn) return;
    btn.classList.add('waiting');
    btn.textContent = t(kind === 'pad' ? 'rebind.pressButton' : 'rebind.pressKey');
    let timer = 0, stop = () => {};
    const finish = (value) => {
      clearTimeout(timer); stop(); this.stopRebind = null;
      if (value && !(kind === 'keys' && RESERVED_KEYS.test(value))) {
        const k = kind === 'pad' ? 'pad' : 'keys', next = { ...this.s[k] };
        if (value === (kind === 'pad' ? PAD_VERBS[verb] : KEYS[verb])) delete next[verb]; else next[verb] = value;
        this.s.set(k, next);
      }
      this.syncControls();
      this.el.querySelector(`[data-rebind="${kind}"][data-verb="${verb}"]`)?.focus({ preventScroll: true });
    };
    stop = kind === 'pad' ? capturePad(finish) : captureKey(finish);
    timer = setTimeout(() => finish(null), 8000);
    this.stopRebind = () => finish(null);
  }
  /** Show a page on the right: 'settings' or 'controls'. */
  page(name = 'settings') {
    if (!this.el.querySelector(`[data-page="${name}"].panel`)) name = 'settings';
    this.stopRebind?.();
    this.current = name;
    for (const p of this.el.querySelectorAll('.panel[data-page]')) p.hidden = p.dataset.page !== name;
    for (const b of this.el.querySelectorAll('.menu-nav [data-page]')) b.classList.toggle('on', b.dataset.page === name);
    if (name === 'controls') this.syncControls();
    this.el.querySelector(`.panel[data-page="${name}"]`)?.scrollTo?.(0, 0);
  }
  /**
   * Back (B / ○, Esc): first out of an open dropdown (src/menu-pad.js), then out of the "start over?" question, then out of the menu, whatever
   * page it shows (the pages are side by side, not one inside another: B closes the menu).
   */
  back() {
    const ask = this.el.querySelector('.ask');
    if (padCancel()) return;   // (an open dropdown first: its old choice back, src/menu-pad.js)
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
      this.stopRebind?.();
      padCancel();   // (a dropdown left open: as it was)
      this.updates?.close();
      if (this.el.contains(document.activeElement)) document.activeElement.blur();
    }
    this.el.classList.toggle('open', on);
    // (focus once it shows: a hidden element can't take it; on a page, its button)
    if (on) (this.el.querySelector(page !== 'settings' ? `.menu-nav [data-page="${page}"]` : '.primary') ?? this.el.querySelector('.primary'))?.focus({ preventScroll: true });
  }
}

/**
 * The Controls page: the rebinding (`rebind`: 'pad', 'keys', in that order; none: []), then every control for a
 * controller, keyboard and mouse, a touch screen (`first`: the one in your hands).
 */
export function controlsHtml(list = controlsList(), first = 'keyboard', rebind = []) {
  const rows = (l, k) => l.map(([what, how, id]) => `<li${k === 'pad' && PAD_RAW_ROWS.has(id) ? ' class="pad-raw"' : ''}><span>${what}</span><b>${how}</b></li>`).join('');
  const names = { pad: t('ctl.controller'), keyboard: t('ctl.keyboard'), touch: t('ctl.touch') };
  const order = [first, ...['pad', 'keyboard', 'touch'].filter((k) => k !== first)];
  return `<h1>${t('ctl.title')}</h1>
    ${rebind.map((k) => rebindHtml(k)).join('\n    ')}
    ${order.map((k) => `<h2>${names[k]}</h2><ul class="ctl">${rows(list[k], k)}</ul>`).join('\n    ')}
    <p class="keys">${t('ctl.note')}</p>`;
}

/**
 * Touch: a virtual stick on the left half, camera drag on the right half,
 * buttons for jump, interact, run, the scout's find, the game menu (❏) and the fluid tool (the
 * menu is the small faint ⚙ in the corner, index.html #gear). Writes
 * into the same `input` object as the keyboard (input.stick is analog).
 */
export class TouchControls {
  constructor(input, rig) {
    this.input = input;   // (body.touch, which shows them, is main.js's: src/input-mode.js)
    const root = document.getElementById('touch');
    root.innerHTML = `
      <div class="stick"><div class="nub"></div></div>
      <button data-key="Space" class="b-jump">⤒</button>
      <button data-key="KeyE" class="b-use">E</button>
      <button data-toggle="ShiftLeft" class="b-run">${t('touch.run')}</button>
      <button data-press="KeyQ" class="b-ping" aria-label="${t('touch.ping')}">ping</button>
      <button data-press="KeyJ" class="b-book">❏</button>
      <button data-toggle="KeyR" class="b-aim" aria-label="${t('touch.aim')}">◎</button>
      <button data-key="TouchFire" class="b-fire" aria-label="${t('touch.fire')}">✺</button>
      <button data-key="KeyX" class="b-mode" aria-label="${t('touch.mode')}">◐</button>
      <button data-key="TouchBlade" class="b-blade" aria-label="${t('touch.blade')}">⚔</button>
      <button data-key="TouchGuard" class="b-guard" aria-label="${t('touch.guard')}">◇</button>
      <button data-key="TouchEvade" class="b-evade" aria-label="${t('touch.evade')}">↶</button>
      <button data-press="Tab" class="b-lock" aria-label="${t('touch.lock')}">◉</button>`;
    const stick = root.querySelector('.stick'), nub = root.querySelector('.nub');
    let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
    let R = 60, ring = 140;
    // the cluster scales with the screen's short side (src/touch-layout.js): a phone held sideways keeps
    // it in the lower right corner; the HUD keeps clear of wherever the buttons end up (src/ship/cinema.js)
    const place = () => {
      const k = touchScale(globalThis.innerWidth, globalThis.innerHeight), L = touchLayout(k), S = stickLayout(k);
      root.style?.setProperty('--tk', String(k));
      for (const b of root.querySelectorAll('button')) {
        const p = L[b.className.match(/\bb-(\w+)/)?.[1]];
        if (!p) continue;
        Object.assign(b.style, { right: `calc(${p.r}px + var(--safe-right, 0px))`, bottom: `calc(${p.b}px + var(--safe-bottom, 0px))`,
          width: `${p.d}px`, height: `${p.d}px`, fontSize: `${p.f}px` });
      }
      R = S.reach; ring = S.ring;
      Object.assign(stick.style, { width: `${S.ring}px`, height: `${S.ring}px` });
      Object.assign(nub.style, { width: `${S.nub}px`, height: `${S.nub}px`, left: `${(S.ring - S.nub) / 2 - 2}px`, top: `${(S.ring - S.nub) / 2 - 2}px` });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('orientationchange', place);
    if (typeof MutationObserver === 'function') new MutationObserver(place).observe(root, { childList: true });   // (a button added later: the gadget's, src/gadgets/hud.js)
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
          stick.style.left = `${sx - ring / 2}px`; stick.style.top = `${sy - ring / 2}px`;
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
