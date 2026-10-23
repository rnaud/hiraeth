// The title screen: the game's name (Hiraeth, lettered in src/title-logo.js) over one of the
// worlds, seen from a fixed camera framed like one of the covers it was designed from (a
// different shot each time the game opens: src/title-shots.js). The world is a vector drawing of
// the game's own render of that shot, flat colour and ink, painted with the name the moment the
// page's script runs (src/title-paint.js, issue #110): no 3D world is built for the title. The
// menu joins them here: Continue (the save played last), Saves (the slots: continue one, start a
// new game in an empty one, delete one), Settings, What's new.
// It runs before the game's modules load (src/boot.js), so the slot chosen here is the one
// every store reads (src/save-slots.js). Once the menu answers, the game loads behind it, in the
// save Continue would play, and waits at its first frame (src/title-hold.js): choosing that save
// lets it go on; any other choice opens the game in a fresh page (?start).
// ?vista=live builds the old live world behind the menu instead (src/title-world.js, to compare).
//
// Layout: src/title-layout.js places the name across the top and the menu small, low at the left: the
// main entries (Continue or New game, Saves) a short column of text buttons, the tools (Settings, What's
// new, Debug, Full screen) a row of icon buttons under it (TITLE_ICONS), each named and labelled on focus.
//
// Keyboard (arrows / WASD, Enter, Esc, Delete), mouse and touch, and a controller
// (d-pad or stick to move, A confirm, B back): the main menu by its own mainNavigate (down the
// column into the row, along it), the rest through the same menuNavigate as the game's menus. The menu music plays under it (src/audio.js menuMusic), the title's recording once it has loaded (playTitleTheme).
//
// Imports nothing that loads the game state: the summaries come from the raw saves.

import { slots, SLOT_COUNT, DEBUG_SLOT, debugSaveHref, formatPlaytime, formatDate, progressLine } from './save-slots.js';
import { ORDER, TITLES } from './levels/names.js';
import { Settings, SettingsMenu, isNativeApp, isDeckApp, isXboxApp, isTouch, reducedMotion } from './ui.js';
import { t, onLanguage } from './i18n.js';
import { Sound } from './audio.js';
import { Controller, menuNavigate } from './controller.js';
import { InputMode } from './input-mode.js';
import { setFaces, padFaces } from './native-pad.js';
import { glyph } from './pad-glyphs.js';
import { markBooted } from './native-app.js';
import { startThemeDownload } from './music-store.js';
import { THEME_FILES } from './soundtracks.js';
import { VERSION } from './version.js';
import { buildLabel } from './build-label.js';

import { devMode } from './dev-gate.js';
import { padConfirm } from './menu-pad.js';
import { titleLayout, layoutVars } from './title-layout.js';
import { paintTitle, safeInsets, LOGO } from './title-paint.js';

/** ms after the player's last press before what can wait (the sound's start, the world's build) goes on. */
export const TITLE_QUIET = 400;
/**
 * ms after the player's last press before the game loading behind the title goes on (src/title-hold.js): its load has
 * steps of up to 0.35 s on a desktop (1.4 s with the processor slowed four times, a handheld's), which a press waits
 * through, so it stands aside the while the player is moving through the menu.
 */
export const BEHIND_QUIET = 1500;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** The tools' icons, inked like the covers' line work (24 × 24, the stroke in the button's colour). */
const icon = (d, extra = '') => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}${extra}</svg>`;
export const TITLE_ICONS = {
  // a gear: eight teeth round a wheel, its hub
  settings: icon('<path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.85 1.85M16.65 16.65l1.85 1.85M5.5 18.5l1.85-1.85M16.65 7.35l1.85-1.85"/><circle cx="12" cy="12" r="5.6" fill="currentColor" fill-opacity=".14"/><circle cx="12" cy="12" r="2.1"/>'),
  // a star with a spark: what's new
  news: icon('<path d="M10.5 3.5l1.9 5.6 5.6 1.9-5.6 1.9-1.9 5.6-1.9-5.6-5.6-1.9 5.6-1.9z" fill="currentColor" fill-opacity=".14"/><path d="M18.5 14.5v5M16 17h5"/>'),
  // a beetle: debug
  debug: icon('<ellipse cx="12" cy="14" rx="4.6" ry="6" fill="currentColor" fill-opacity=".14"/><path d="M12 8v12M9.8 6.4a2.4 2.4 0 0 1 4.4 0M7.4 11.5 4 9.6M7.4 14.5H3.6M7.6 17.6l-3.2 2.2M16.6 11.5 20 9.6M16.6 14.5h3.8M16.4 17.6l3.2 2.2"/>'),
  // corner brackets, out: full screen; in: leave it
  fullscreen: icon('<path d="M3.5 8.5v-5h5M15.5 3.5h5v5M20.5 15.5v5h-5M8.5 20.5h-5v-5"/>'),
  leave: icon('<path d="M8.5 3.5v5h-5M20.5 8.5h-5v-5M15.5 20.5v-5h5M3.5 15.5h5v5"/>'),
};

/** The drawn backdrop (without WebGL): a ringed planet over mesas, dunes, a giant's ribs and a caped traveller. */
export const BACKDROP = `
<svg class="land" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <pattern id="tdots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="#2b211f" opacity=".55"/></pattern>
    <pattern id="thatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line x1="0" y1="0" x2="0" y2="10" stroke="#2b211f" stroke-width="1.4" opacity=".45"/></pattern>
  </defs>
  <rect width="1600" height="900" fill="#7ea6d4"/>
  <rect y="180" width="1600" height="720" fill="#9dbde0"/>
  <rect y="330" width="1600" height="570" fill="#c4d4dc"/>
  <rect y="430" width="1600" height="470" fill="#ead9b0"/>
  <rect y="500" width="1600" height="400" fill="#f2c890"/>
  <g class="planet">
    <circle cx="1230" cy="250" r="150" fill="#f4e6c4" stroke="#2b211f" stroke-width="3.5"/>
    <path d="M1230 100 a150 150 0 0 1 0 300 a110 150 0 0 0 0 -300z" fill="url(#tdots)"/>
    <circle cx="1185" cy="205" r="18" fill="none" stroke="#2b211f" stroke-width="2"/>
    <circle cx="1268" cy="300" r="11" fill="none" stroke="#2b211f" stroke-width="2"/>
    <circle cx="1210" cy="320" r="7" fill="none" stroke="#2b211f" stroke-width="1.6"/>
    <ellipse cx="1230" cy="262" rx="265" ry="46" fill="none" stroke="#2b211f" stroke-width="3.5" transform="rotate(-14 1230 262)"/>
    <ellipse cx="1230" cy="262" rx="238" ry="36" fill="none" stroke="#c8483a" stroke-width="4" transform="rotate(-14 1230 262)"/>
  </g>
  <circle cx="330" cy="160" r="34" fill="#f7ecd2" stroke="#2b211f" stroke-width="3"/>
  <g class="clouds">
    <path d="M90 300 h300 q30 0 30 -14 q0 -14 -40 -14 h-60 q-10 -22 -60 -22 q-50 0 -70 22 h-80 q-30 0 -30 14 q0 14 30 14z" fill="#f7ecd2" stroke="#2b211f" stroke-width="2.5"/>
    <path d="M700 380 h260 q24 0 24 -12 q0 -12 -32 -12 h-50 q-12 -18 -52 -18 q-44 0 -60 18 h-70 q-26 0 -26 12 q0 12 26 12z" fill="#f7ecd2" stroke="#2b211f" stroke-width="2.2"/>
  </g>
  <path d="M0 520 L60 520 L80 430 L190 425 L205 520 L420 520 L432 470 L520 466 L540 520 L1600 520 L1600 900 L0 900Z" fill="#d79a6e" stroke="#2b211f" stroke-width="3" stroke-linejoin="round"/>
  <path d="M80 430 L190 425 L205 520 L130 520 Z" fill="url(#thatch)"/>
  <path d="M1080 520 L1110 410 L1150 404 L1170 330 L1300 326 L1316 420 L1420 424 L1440 520Z" fill="#cf8b62" stroke="#2b211f" stroke-width="3" stroke-linejoin="round"/>
  <path d="M1300 326 L1316 420 L1420 424 L1440 520 L1330 520 L1290 400Z" fill="url(#thatch)"/>
  <path d="M0 600 C200 540 380 560 560 590 C760 622 900 560 1100 556 C1300 552 1450 600 1600 590 L1600 900 L0 900Z" fill="#ecb877" stroke="#2b211f" stroke-width="3"/>
  <g class="ribs" transform="translate(-480 30)" fill="none" stroke="#2b211f" stroke-width="4" stroke-linecap="round">
    <path d="M690 600 C690 470 820 440 880 470" stroke-width="14" stroke="#f4ecd8"/><path d="M690 600 C690 470 820 440 880 470"/>
    <path d="M745 596 C752 492 850 470 900 498" stroke-width="13" stroke="#f4ecd8"/><path d="M745 596 C752 492 850 470 900 498"/>
    <path d="M800 594 C812 516 880 500 918 524" stroke-width="12" stroke="#f4ecd8"/><path d="M800 594 C812 516 880 500 918 524"/>
    <path d="M852 592 C866 540 905 532 932 548" stroke-width="10" stroke="#f4ecd8"/><path d="M852 592 C866 540 905 532 932 548"/>
    <path d="M660 610 C760 580 900 560 960 560" stroke-width="9" stroke="#f4ecd8"/><path d="M660 610 C760 580 900 560 960 560"/>
    <path d="M960 560 C985 528 1040 524 1056 552 C1066 572 1040 590 1012 586 L990 596 C978 584 966 574 960 560Z" fill="#f4ecd8" stroke-width="3.5"/>
    <circle cx="1022" cy="555" r="7" fill="#2b211f" stroke="none"/>
  </g>
  <path d="M0 700 C260 640 520 660 760 700 C980 736 1200 676 1600 690 L1600 900 L0 900Z" fill="#f3cf92" stroke="#2b211f" stroke-width="3.5"/>
  <path d="M760 700 C980 736 1200 676 1600 690 L1600 760 C1300 740 1050 780 760 700Z" fill="url(#tdots)" opacity=".7"/>
  <path d="M0 800 C300 760 600 790 900 820 C1150 846 1400 800 1600 810 L1600 900 L0 900Z" fill="#e6a868" stroke="#2b211f" stroke-width="3.5"/>
  <g class="traveller" transform="translate(1330 686) scale(1.25)">
    <path class="cape" d="M0 -46 C-14 -40 -40 -22 -72 -12 C-50 -6 -26 -2 -8 -4 Z" fill="#c8483a" stroke="#2b211f" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M-7 -46 L7 -46 L9 -14 L4 0 L-4 0 L-9 -14 Z" fill="#f4ecd8" stroke="#2b211f" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="0" cy="-54" r="8" fill="#f4ecd8" stroke="#2b211f" stroke-width="2.5"/>
    <path d="M-12 -57 L12 -57 L4 -66 L-4 -66 Z" fill="#2b211f"/>
  </g>
</svg>`;

export { LOGO };

function slotHtml(s) {
  if (s.empty) {
    return `<li class="slot empty"><button class="pick" data-slot="${s.n}"><span class="thumb new" aria-hidden="true">+</span>
      <span class="txt"><b>${t('title.save', { n: s.n })}</b><span class="world">${t('title.new')}</span><span class="prog">${t('title.startsPrologue')}</span></span>${glyph('ok', { focus: true })}</button>
    <span class="del spacer" aria-hidden="true">${t('title.delete')}</span></li>`;
  }
  // (a save from before the slots has no playtime yet: only its date)
  const when = [s.playtime >= 60 && t('title.played', { time: formatPlaytime(s.playtime) }), formatDate(s.lastPlayed)].filter(Boolean).join(' · ');
  return `<li class="slot"><button class="pick" data-slot="${s.n}">
      <img class="thumb" src="thumbs/${esc(s.level)}.jpg" alt="" onerror="this.style.visibility='hidden'">
      <span class="txt"><span class="top"><b>${t('title.save', { n: s.n })}</b><span class="when">${esc(when)}</span></span><span class="world">${esc(s.world)}</span><span class="prog">${esc(progressLine(s))}</span></span>${glyph('ok', { focus: true })}</button>
    <button class="del" data-del="${s.n}" aria-label="${t('title.deleteSave', { n: s.n })}">${glyph('x', { key: 'Del' })}${t('title.delete')}</button></li>`;
}

/**
 * The Saves screen's debug saves (issue #203: "a debug saves option in the save menu that restarts the game at a
 * specific level and has unlocked everything in all the previous levels"), shown to whoever src/dev-gate.js lets in
 * (every player while ALWAYS_DEV stays on): the slot it writes (`into`: the debug slot, the player's saves untouched,
 * or one of them, asked first when it holds a save), then every world of the route, its picture and how many worlds
 * before it are done. src/debug-save.js writes the save. Folded shut (`open` false, issue #227): one "Debug" row under
 * the saves, the route's worlds neither on the screen nor in the pad's path until it is chosen (A opens it, A folds it).
 */
export function debugSavesHtml(into = DEBUG_SLOT, order = ORDER, open = false) {
  const head = `<button class="dopen" data-a="debug-open" aria-expanded="${open}">${glyph('ok', { focus: true })}<span class="dh">${t(open ? 'title.dbg.head' : 'title.debug')}</span><em class="dtag">${t('title.dbg.tag')}</em><span class="dfold" aria-hidden="true">${open ? '▴' : '▾'}</span></button>`;
  if (!open) return head;
  const slotName = into === DEBUG_SLOT ? t('title.dbg.intoDebug') : t('title.save', { n: into });
  const world = (id, i) => `<li><button class="dworld" data-debug-world="${esc(id)}"><img class="thumb" src="thumbs/${esc(id)}.jpg" alt="" onerror="this.style.visibility='hidden'">
      <span class="txt"><b>${i + 1}</b><span class="world">${esc(TITLES[id] ?? id)}</span><span class="prog">${i === 0 ? t('title.dbg.fresh') : i === 1 ? t('title.dbg.before1') : t('title.dbg.before', { n: i })}</span></span>${glyph('ok', { focus: true })}</button></li>`;
  return `${head}
    <p class="why">${t('title.dbg.why')}</p>
    <button class="dinto" data-a="debug-into">${glyph('ok', { focus: true })}<span>${esc(t('title.dbg.into', { slot: slotName }))}</span></button>
    <ol class="dworlds">${order.map(world).join('')}</ol>`;
}

/** The Saves screen's rows the pad steps through: Back, each save, then the debug section's buttons (one row while folded). */
export const savesRows = (savesEl) => [savesEl.querySelector('[data-a="back"]'), ...savesEl.querySelectorAll('.slot, .debug-saves button')];

/** The slot after `into` for the debug saves: the debug slot, then the player's 1..count, round again. */
export const nextDebugInto = (into, count = SLOT_COUNT) => (into === DEBUG_SLOT ? 1 : into >= count ? DEBUG_SLOT : into + 1);

/**
 * Show the title screen; resolves with the chosen slot ({ slot, fresh, behind }) once the player
 * picks one (it is already the active slot then), after the title has faded out. `painted`: the screen
 * src/title-paint.js already put up (src/boot.js paints it first), else it is painted here. `behind`:
 * { hold, load } to load the game behind the menu (src/title-hold.js); when it was loaded for the save
 * chosen, it goes on and this resolves with behind: true. When it (or the live world) was loaded on
 * another save, the game opens in a fresh page instead (?start) and this never resolves.
 */
export function showTitle({ store = slots, doc = document, win = window, vista: wantVista = true, painted = null, behind = null } = {}) {
  return new Promise((resolve) => {
    const settings = new Settings();
    // (the title's own recording takes over from the procedural menu music once it has loaded: src/soundtracks.js TITLE_THEME)
    // (started once the menu answers: startIfAllowed below; a press starts it at once, as anywhere)
    const sound = new Sound('title', { score: false, titleTheme: true, autoStart: false });
    let vista = null, vistaQuality = settings.quality, worldStarted = false;
    let ls = null;
    try { ls = win.localStorage; } catch { /* private mode */ }
    // the drawing and the name, on the screen already (src/title-paint.js), or now
    const paint = painted ?? paintTitle({ doc, win, store, ...(wantVista ? {} : { shot: null }) });
    const { root, shot } = paint;
    // (the boot's timings: the drawing and the name painted, the menu, the live world faded in; window.title.timing)
    const now = () => win.performance?.now?.() ?? Date.now();
    const timing = Object.assign(paint.timing, { shown: null, world: null, stages: {} });
    // ?vista=live: the old live world behind the menu (src/title-world.js), over the drawing (to compare; no game behind it)
    const live = !!shot && new URLSearchParams(win.location?.search ?? '').get('vista') === 'live';
    // the player's last press (a key, a touch, the pad): what can wait (the sound's start, the game's load)
    // waits while they are pressing, so the menu answers first (TITLE_QUIET)
    let lastInput = -Infinity;
    const busy = () => now() - lastInput < TITLE_QUIET;
    const pressed = () => { lastInput = now(); };
    settings.on(() => {
      sound.setVolumes(settings.music, settings.effects); setFaces(settings.padFaces);
      if (vista && settings.quality !== vistaQuality) vista.setQuality((vistaQuality = settings.quality));
    });
    sound.menuMusic(true);

    // (Full screen only where it does something: not in the apps (the Deck's, the Xbox's, Android's are full
    // screen already), nor in an installed web app already shown full screen)
    const fullscreen = () => !isNativeApp && !isDeckApp && !isXboxApp && !!doc.fullscreenEnabled
      && !(!doc.fullscreenElement && win.matchMedia?.('(display-mode: fullscreen)')?.matches);
    // the menu joins the name (the drawn land under all, shown only if the drawing can't load)
    root.insertAdjacentHTML('afterbegin', BACKDROP);
    root.querySelector('.front').insertAdjacentHTML('beforeend', `
        <nav class="screen main-menu" data-screen="main"></nav>
        <section class="screen saves" data-screen="saves" hidden>
          <div class="head"><h2 data-t="title.savesHead">${t('title.savesHead')}</h2><button data-a="back">${glyph('back', { key: 'Esc' })}<span data-t="title.back">${t('title.back')}</span></button></div>
          <ol class="slots"></ol>
        </section>
        <p class="version">v${VERSION}${buildLabel()}</p>
        <p class="starting" role="status" aria-live="polite" hidden><span class="pen" aria-hidden="true"></span><span class="what"></span></p>`);
    root.insertAdjacentHTML('beforeend', `<div class="confirm" hidden><div class="card" role="alertdialog" aria-labelledby="title-confirm-q">
        <h3 id="title-confirm-q"></h3><p class="what"></p><p data-t="title.undone">${t('title.undone')}</p>
        <div class="row"><button data-a="keep">${glyph('back', { key: 'Esc' })}<span data-t="title.keep">${t('title.keep')}</span></button><button data-a="delete" class="danger">${glyph('ok', { focus: true })}<span data-t="title.delete">${t('title.delete')}</span></button></div>
      </div></div>
      <div id="title-settings"></div>`);
    if (!root.isConnected) doc.body.appendChild(root);
    const settingsMenu = new SettingsMenu(settings, { sound, el: root.querySelector('#title-settings'), title: true });
    // (a new language, chosen in the settings: the title's own words in it; the menu and saves draw as they show)
    onLanguage(() => { if (done) return; for (const e of root.querySelectorAll('.front [data-t], .confirm [data-t]')) e.textContent = t(e.dataset.t); if (screen === 'saves') renderSaves(); else renderMain(); });

    const mainNav = root.querySelector('.main-menu');
    const savesEl = root.querySelector('.saves');
    const confirmEl = root.querySelector('.confirm');
    let screen = 'main', toDelete = null, done = false;
    // (the debug saves: the slot they write, and the one waiting for "Replace Save n?")
    // (and whether its world list is open: folded shut each time the Saves screen opens, issue #227)
    let debugInto = DEBUG_SLOT, pendingDebug = null, debugOpen = false;

    const focusFirst = (el) => el.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    const renderMain = () => {
      const last = store.latest(), s = last ? store.summary(last) : null;
      // (each label carries the confirm glyph, shown beside it while it has a pad's focus: src/pad-glyphs.js)
      const lbl = (text) => `<span class="lbl">${glyph('ok', { focus: true })}${text}</span>`;
      // the main entries: a short column of compact text buttons; the tools: a row of icon buttons under it
      // (each named for a screen reader and in a label shown on hover or focus, at the row's right end where
      // nothing is covered: --k, how many icons stand to its right; the glyph in its corner)
      const fs = !!doc.fullscreenElement;
      const tools = [['data-a="settings"', t('title.settings'), 'settings'], ['data-a="news"', t('title.news'), 'news'],
        devMode({ settings }) && ['data-a="debug"', t('title.debug'), 'debug'],
        fullscreen() && ['data-a="fullscreen"', t(fs ? 'title.leaveFullscreen' : 'title.fullscreen'), fs ? 'leave' : 'fullscreen']].filter(Boolean);
      const tool = ([attr, label, icon], i) => `<button ${attr} class="tool" style="--k: ${tools.length - 1 - i}" aria-label="${esc(label)}">${TITLE_ICONS[icon]}<span class="tip" aria-hidden="true">${esc(label)}</span>${glyph('ok', { focus: true })}</button>`;
      mainNav.innerHTML = `<div class="entries">${s
        ? `<button data-a="continue" class="primary">${lbl(t('title.continue'))}<small>${esc(s.world)}</small></button>`
        : `<button data-a="new" class="primary">${lbl(t('title.new'))}</button>`}
        <button data-a="saves">${lbl(t('title.saves'))}</button></div>
        <div class="tools">${tools.map(tool).join('')}</div>`;
      relayout();
    };
    // the name and the menu placed for this screen (src/title-layout.js), as CSS variables
    let insets = null;
    const relayout = () => {
      insets ??= safeInsets(doc, win);
      const L = titleLayout({ w: win.innerWidth, h: win.innerHeight, buttons: mainNav.querySelectorAll('.entries button').length, icons: mainNav.querySelectorAll('.tools button').length, safe: insets, at: shot?.menu });
      for (const [k, v] of Object.entries(layoutVars(L))) root.style.setProperty(k, v);
      root.dataset.layout = L.mode;
      for (const g of root.querySelectorAll('header .logo g[stroke-width]')) g.setAttribute('stroke-width', L.ink.toFixed(1));
    };
    const onResize = () => { insets = null; relayout(); };
    win.addEventListener('resize', onResize);
    const renderSaves = () => {
      // (the author's debug saves under the player's, issue #203: src/dev-gate.js decides who sees them)
      const debug = devMode({ settings }) ? `<li class="debug-saves${debugOpen ? ' open' : ''}">${debugSavesHtml(debugInto, ORDER, debugOpen)}</li>` : '';
      root.querySelector('.slots').innerHTML = store.list().map(slotHtml).join('') + debug;
    };
    // a debug save at a world: into the debug slot at once; into one of the player's, asked first if it holds a save
    const startDebug = (id, slot = debugInto, asked = false) => {
      if (done || !ORDER.includes(id)) return;
      if (slot !== DEBUG_SLOT && !asked && !store.summary(slot).empty) { askDebug(id, slot); return; }
      done = true;
      cleanup();
      // (the game loading behind the title keeps its writes in memory until the page goes: its save on the way out must
      // not land in the player's slot it was loading, issue #203: "without overwriting the player's own save slots")
      if (!store.holding) store.holdWrites();
      win.location.href = `${win.location.pathname}${debugSaveHref(id, slot)}`;
    };
    const askDebug = (id, slot) => {
      const s = store.summary(slot);
      pendingDebug = { id, slot }; toDelete = null;
      confirmEl.querySelector('h3').textContent = t('title.dbg.replaceAsk', { n: slot });
      confirmEl.querySelector('.what').textContent = t('title.dbg.replaceWhat', { was: [s.world, progressLine(s)].filter(Boolean).join(' · '), world: TITLES[id] ?? id });
      confirmEl.querySelector('[data-a="delete"] [data-t="title.delete"]').textContent = t('title.dbg.replace');
      confirmEl.hidden = false;
      confirmEl.querySelector('[data-a="keep"]').focus({ preventScroll: true });
    };
    const show = (name, focus) => {
      screen = name;
      for (const el of root.querySelectorAll('.screen')) el.hidden = el.dataset.screen !== name;
      root.dataset.screen = name;
      if (name === 'main') renderMain(); else renderSaves();
      const target = focus && root.querySelector(focus);
      if (target) target.focus({ preventScroll: true }); else focusFirst(root.querySelector(`[data-screen="${name}"]`));
    };
    const askDelete = (n) => {
      const s = store.summary(n);
      if (s.empty) return;
      toDelete = n;
      confirmEl.querySelector('h3').textContent = t('title.deleteAsk', { n });
      confirmEl.querySelector('.what').textContent = [s.world, progressLine(s), s.playtime >= 60 && t('title.played', { time: formatPlaytime(s.playtime) })].filter(Boolean).join(' · ');
      confirmEl.hidden = false;
      confirmEl.querySelector('[data-a="keep"]').focus({ preventScroll: true });
    };
    const closeConfirm = () => {
      confirmEl.hidden = true;
      const back = pendingDebug ? root.querySelector(`[data-debug-world="${pendingDebug.id}"]`) : root.querySelector(`[data-del="${toDelete}"]`);
      toDelete = null; pendingDebug = null;
      confirmEl.querySelector('[data-a="delete"] [data-t="title.delete"]').textContent = t('title.delete');
      if (back) back.focus({ preventScroll: true }); else focusFirst(savesEl);
    };

    const choose = (n) => {
      if (done) return;
      done = true;
      const fresh = store.summary(n).empty;
      const ours = game && gameFits(n);
      store.setActive(n);
      store.touch(n);   // (the selector's "last played", and Continue, follow it from now on)
      sound.menuMusic(false);
      cleanup();
      vistaAbort.abort(); vista?.stop();   // (its last frame fades out with the title)
      const fade = (then) => {
        root.classList.add('leaving');
        setTimeout(() => { vista?.dispose(); vista = null; sound.dispose(); then(); }, 450);
      };
      const freshPage = () => { store.dropWrites(); win.location.replace(`${win.location.pathname}?start`); };
      if (ours) {
        // the game loaded behind the title for this save: it goes on, and the title fades out over its first frame
        // (at once if the load is done; a quiet progress mark until then)
        store.commitWrites();
        const hold = behind.hold;
        const mark = root.querySelector('.starting'), what = mark.querySelector('.what');
        const tick = () => { what.textContent = hold.stage || ''; };
        let timer = 0;
        if (!hold.isArrived) { root.classList.add('waiting'); mark.hidden = false; tick(); timer = setInterval(tick, 250); }
        hold.onFail(() => { clearInterval(timer); fade(freshPage); });
        hold.release();
        hold.playing.then(() => { clearInterval(timer); fade(() => { root.remove(); resolve({ slot: n, fresh, behind: true }); }); });
        return;
      }
      // the live world's modules (or the game's) were loaded on another save: the game starts in a fresh page, in the chosen slot
      fade(() => { if (worldStarted || game) { freshPage(); return; } root.remove(); resolve({ slot: n, fresh }); });
    };

    const effectDialog = () => doc.querySelector('dialog[data-effect-loading][open]');
    const back = () => {
      if (effectDialog()) { effectDialog().dispatchEvent(new Event('cancel', { cancelable: true })); return; }
      if (!confirmEl.hidden) closeConfirm();
      else if (settingsMenu.open) { settingsMenu.back(); if (!settingsMenu.open) root.querySelector('[data-a="settings"]')?.focus({ preventScroll: true }); }
      else if (screen === 'saves') show('main', '[data-a="saves"]');
    };
    const act = (a, el) => {
      if (a === 'continue') choose(store.latest());
      else if (a === 'new') choose(store.firstEmpty() ?? 1);
      else if (a === 'saves') { debugOpen = false; show('saves', '.slot .pick'); }
      else if (a === 'back') back();
      else if (a === 'settings') settingsMenu.toggle(true);
      else if (a === 'debug' && devMode({ settings })) {
        // the worlds list (any world, open) for the save played last (or the first): the list alone,
        // no world built behind it (?worlds=1, src/world-picker.js)
        store.setActive(store.latest() ?? 1);
        win.location.href = `${win.location.pathname}?worlds=1`;
      }
      // the interactive changelog (changelog.html, its Play button comes back here)
      else if (a === 'news') win.location.href = 'changelog.html';
      else if (a === 'fullscreen') {
        const p = doc.fullscreenElement ? doc.exitFullscreen?.() : doc.documentElement.requestFullscreen?.();
        Promise.resolve(p).catch(() => {}).finally(() => setTimeout(() => { if (screen === 'main') show('main', '[data-a="fullscreen"]'); }, 150));
      } else if (a === 'keep') closeConfirm();
      else if (a === 'delete' && pendingDebug) { const { id, slot } = pendingDebug; startDebug(id, slot, true); }
      else if (a === 'debug-open') {
        debugOpen = !debugOpen;
        renderSaves();
        const head = root.querySelector('[data-a="debug-open"]');
        head?.focus({ preventScroll: true });
        if (debugOpen) head?.scrollIntoView?.({ block: 'start' });
      } else if (a === 'debug-into') {
        debugInto = nextDebugInto(debugInto);
        renderSaves();
        root.querySelector('[data-a="debug-into"]')?.focus({ preventScroll: true });
      } else if (el?.dataset.debugWorld) startDebug(el.dataset.debugWorld);
      else if (a === 'delete') {
        const n = toDelete;
        store.remove(n);
        if (game?.slot === n) game.spoilt = true;   // (the game behind the title was loading it: a fresh page, if chosen)
        confirmEl.hidden = true; toDelete = null;
        renderSaves();
        root.querySelector(`[data-slot="${n}"]`)?.focus({ preventScroll: true });
      } else if (el?.dataset.slot) choose(+el.dataset.slot);
      else if (el?.dataset.del) askDelete(+el.dataset.del);
    };
    const onClick = (e) => {
      const el = e.target.closest?.('button');
      if (!el || !root.contains(el) || settingsMenu.el.contains(el) || done) return;
      sound.start();
      act(el.dataset.a, el);
    };
    root.addEventListener('click', onClick);
    // (the settings' own Back button returns to the title's menu)
    settingsMenu.el.addEventListener('click', (e) => { if (e.target.closest?.('[data-a="close"]')) root.querySelector('[data-a="settings"]')?.focus({ preventScroll: true }); });

    // the save selector moves by rows (up / down) and between a save and its Delete (left / right)
    const savesNavigate = (x, y) => {
      const rows = savesRows(savesEl);
      const cur = doc.activeElement, i = rows.findIndex((r) => r === cur || r.contains(cur));
      if (y || i < 0) {
        const next = rows[i < 0 ? 1 : (i + (y || 1) + rows.length) % rows.length];
        (next.querySelector?.('.pick') ?? next).focus({ preventScroll: true });
        next.scrollIntoView?.({ block: 'nearest' });
      } else if (x && rows[i].classList?.contains('slot')) {
        const del = rows[i].querySelector('.del'), pick = rows[i].querySelector('.pick');
        (cur === pick && del ? del : pick).focus({ preventScroll: true });
      }
    };
    // the main menu: ↑ ↓ through the column and down into the tools' row (its first icon), ← → along the row,
    // ↑ from the row back to the column's last entry, ↓ from the row round to the first
    const mainNavigate = (x, y) => {
      const col = [...mainNav.querySelectorAll('.entries button')], row = [...mainNav.querySelectorAll('.tools button')];
      const cur = doc.activeElement, ci = col.indexOf(cur), ri = row.indexOf(cur);
      let next = null;
      if (ci < 0 && ri < 0) next = col[0] ?? row[0];
      else if (ci >= 0) next = y > 0 ? col[ci + 1] ?? row[0] ?? col[0] : y < 0 ? col[ci - 1] ?? row[0] ?? col.at(-1) : null;
      else if (x) next = row[Math.min(Math.max(ri + x, 0), row.length - 1)];
      else next = y < 0 ? col.at(-1) ?? row[ri] : col[0] ?? row[ri];
      next?.focus({ preventScroll: true });
    };
    const navigate = (x, y, fresh = true) => (effectDialog() || !confirmEl.hidden || settingsMenu.open ? menuNavigate(navRoot(), x, y, fresh)
      : screen === 'saves' ? savesNavigate(x, y) : mainNavigate(x, y));
    const navRoot = () => effectDialog() ?? (!confirmEl.hidden ? confirmEl : settingsMenu.open ? settingsMenu.el : root.querySelector(`[data-screen="${screen}"]`));
    const KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
    const onKey = (e) => {
      if (done) return;
      root.classList.remove('pad'); root.classList.add('typed');
      const dir = KEYS[e.code];
      const t = e.target;
      const adjusting = t && (t.type === 'range' || t.tagName === 'SELECT');
      if (dir && !(adjusting && (e.code === 'ArrowLeft' || e.code === 'ArrowRight'))) { e.preventDefault(); navigate(dir[0], dir[1]); }
      else if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); back(); }
      else if ((e.code === 'Delete' || e.code === 'KeyX') && screen === 'saves' && confirmEl.hidden) {
        const n = +(doc.activeElement?.dataset?.slot ?? doc.activeElement?.dataset?.del ?? 0);
        if (n) askDelete(n);
      } else if ((e.code === 'Enter' || e.code === 'Space') && !navRoot().contains(doc.activeElement)) { e.preventDefault(); navigate(0, 1); }
    };
    win.addEventListener('keydown', onKey);
    // what is in hand, for the world this opens (src/input-mode.js: no touch buttons there while a pad is used)
    const inputMode = new InputMode({ touchDevice: isTouch });
    // (and the body's classes: the glyphs in the buttons show the pad's buttons, the keys or nothing on a touch screen)
    const onInput = (e) => { pressed(); inputMode.event(e); inputMode.apply(doc.body.classList); };
    inputMode.apply(doc.body.classList);
    for (const ev of ['keydown', 'pointerdown', 'touchstart']) win.addEventListener(ev, onInput, { capture: true, passive: true });

    // a controller: d-pad / stick move, A confirm, B back (controller.js, as in the game's menus)
    const controller = new Controller({
      context: () => 'menu',
      look: () => {}, faces: () => padFaces(),
      activity: () => { pressed(); inputMode.pad(); inputMode.apply(doc.body.classList); sound.start(); root.classList.add('pad'); root.classList.remove('typed'); },
      navigate,
      scroll: (amount) => { const r = navRoot(); (r.querySelector('.panel, .slots') ?? r).scrollTop += amount; },
      action: (name) => {
        if (name === 'back' || name === 'start' || name === 'select') back();
        // X / □ on a save: delete it (asks first; its Delete button carries the glyph)
        if (!effectDialog() && name === 'x' && screen === 'saves' && confirmEl.hidden && !settingsMenu.open) {
          const n = +(doc.activeElement?.dataset?.slot ?? doc.activeElement?.dataset?.del ?? 0);
          if (n) askDelete(n);
        }
        if (name === 'confirm') {
          const r = navRoot(), el = doc.activeElement;
          if (r.contains(el)) { if (!padConfirm(el)) el.click(); }   // (a dropdown opens, then keeps the choice shown: src/menu-pad.js)
          else navigate(0, 1);
        }
      },
    });
    let last = performance.now(), raf = 0;
    const loop = (now) => {
      const padOn = Array.from(navigator.getGamepads?.() ?? []).some((p) => p?.connected);
      if ((inputMode.frame(padOn) === 'pad') !== doc.body.classList.contains('controller')) inputMode.apply(doc.body.classList);   // (a Retroid's own controls count from the start)
      controller.update(Math.min((now - last) / 1000, 0.1), !doc.hidden && doc.hasFocus());
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onFullscreen = () => { if (screen === 'main' && !done) show('main', '[data-a="fullscreen"]'); };
    doc.addEventListener('fullscreenchange', onFullscreen);
    function cleanup() {
      cancelAnimationFrame(raf);
      win.removeEventListener('keydown', onKey);
      for (const ev of ['keydown', 'pointerdown', 'touchstart']) win.removeEventListener(ev, onInput, { capture: true });
      doc.removeEventListener('fullscreenchange', onFullscreen);
      win.removeEventListener('resize', onResize);
    }

    show('main');
    // the name and the menu are on the screen: the first thing the player sees (the world follows)
    win.requestAnimationFrame?.(() => { timing.shown = now(); });
    // the app's heartbeat: this build is up (src/native-app.js; the game marks it again after its first frame)
    markBooted(win);
    // on a device: the recorded themes it hasn't got yet, in the background once the title has settled (src/music-store.js)
    startThemeDownload(THEME_FILES);

    // What can wait, once the menu has painted and answers: first the sound (asking whether it may start opens
    // an audio context, 100-250 ms), then the game behind the menu (startGame), its build pausing while the player
    // presses (or with ?vista=live the title's own world, src/title-world.js, faded in over the drawing on its first
    // frame). Each in the browser's idle time (at most `timeout` ms away) and never while the player is pressing (busy).
    const whenIdle = (fn, timeout = 500) => {
      const go = () => { if (done) return; if (busy()) setTimeout(() => whenIdle(fn, timeout), 100); else fn(); };
      if (win.requestIdleCallback) win.requestIdleCallback(go, { timeout }); else setTimeout(go, 30);
    };
    const vistaAbort = new AbortController();
    const drawn = () => root.classList.remove('vista-wait', 'vista-on');
    (win.requestAnimationFrame ?? ((f) => setTimeout(f, 16))).call(win, () => whenIdle(() => {
      sound.startIfAllowed();
      if (live) whenIdle(startWorld);
      else if (behind) whenIdle(startGame);
    }));
    // The game behind the title (src/title-hold.js): the save Continue plays (a new player's: the first empty one,
    // the prologue) loads under the menu, its writes kept in memory, its input and its sound held, its build
    // standing aside while the player presses. It is the one that plays if that save is chosen and nothing it
    // read has changed meanwhile (the settings, the language, the save deleted).
    let game = null;
    const SETTINGS_KEYS = ['hiraeth.settings.v1', 'hiraeth.muted'];
    const settingsNow = () => SETTINGS_KEYS.map((k) => { try { return ls?.getItem(k) ?? ''; } catch { return ''; } }).join('\n');
    const gameFits = (n) => !!game && game.slot === n && !game.spoilt && !behind.hold.failed && settingsNow() === game.settings;
    function startGame() {
      if (done || game) return;
      const slot = store.latest() ?? store.firstEmpty() ?? 1;
      game = { slot, settings: settingsNow(), spoilt: false };
      timing.game = now();
      store.setActive(slot);
      store.holdWrites();
      // (its load stands aside while the player moves through the menu: within BEHIND_QUIET of a press, and all the time
      // they are in the saves, the settings or a question; on the main screen, idle, it goes on)
      behind.hold.busy = () => now() - lastInput < BEHIND_QUIET || screen !== 'main' || settingsMenu.open || !confirmEl.hidden;
      behind.hold.start();
      Promise.resolve().then(() => behind.load()).catch((e) => { console.warn('the game behind the title did not load', e); behind.hold.fail(e); });
    }
    function startWorld() {
      if (done) return;
      const stillOnly = reducedMotion(settings, win);   // (the "Reduce motion" setting; not set: prefers-reduced-motion)
      // (the world's modules read the game state as they load: an in-memory save, past the prologue, meanwhile: src/save-slots.js)
      slots.sandbox({ 'hiraeth.game.v1': JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }) });
      worldStarted = true;
      import('./title-world.js')
        .then(({ startTitleWorld }) => startTitleWorld({ parent: root, shot, settings, native: isNativeApp, touch: isTouch, still: stillOnly, signal: vistaAbort.signal, win, busy,
          onStage: (name) => { timing.stages[name] = Math.round(now()); } }))
        .then((v) => {
          if (!v) { if (!done) drawn(); return; }
          if (done) { v.dispose(); return; }
          vista = v;
          v.onLost = () => { drawn(); v.dispose(); if (vista === v) vista = null; };
          win.requestAnimationFrame(() => { root.classList.add('vista-on'); timing.world = now(); });
        })
        .catch((e) => { console.warn('title world unavailable', e); if (!done) drawn(); });
    }
    Object.assign(win, { title: { root, store, choose, show, askDelete, settingsMenu, sound, shot, timing, relayout, get vista() { return vista; }, get game() { return game; } } });
  });
}
