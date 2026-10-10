// The title screen: the game's name (Hiraeth, lettered in src/title-logo.js) over one of the
// worlds, seen from a fixed camera framed like one of the covers it was designed from (a
// different shot each time the game opens: src/title-shots.js, drawn by src/title-world.js).
// The name and the menu show at once over the paper; the world fades in when it is ready (the
// drawn backdrop below when WebGL can't). Then Continue (the save played last), Saves (the
// slots: continue one, start a new game in an empty one, delete one), Settings, What's new.
// It runs before the game's modules load (src/boot.js), so the slot chosen here is the one
// every store reads (src/save-slots.js). The world's modules read the game state as they load:
// the slots are sandboxed meanwhile, and once a save is chosen the game starts in a fresh page
// (?start), so nothing of the title's world reaches the game.
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

import { slots, SLOT_COUNT, formatPlaytime, formatDate, progressLine } from './save-slots.js';
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
import { VERSION } from './changelog.js';
import { buildLabel } from './build-label.js';

import { devMode } from './dev-gate.js';
import { padConfirm } from './menu-pad.js';
import { logoSvg } from './title-logo.js';
import { titleLayout, layoutVars } from './title-layout.js';
import { chooseShot } from './title-shots.js';

/** ms after the player's last press before what can wait (the sound's start, the world's build) goes on. */
export const TITLE_QUIET = 400;

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

/** The name: HIRAETH in ivory block capitals, an ink line and a vermilion shadow (src/title-logo.js). */
export const LOGO = logoSvg();

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

/** The safe-area insets (a phone's notch and rounded corners), read off a probe, in CSS px. */
function safeInsets(doc, win) {
  const el = doc.createElement('div');
  el.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  doc.body.appendChild(el);
  const cs = win.getComputedStyle?.(el);
  const v = (k) => parseFloat(cs?.[k]) || 0;
  const out = { top: v('paddingTop'), right: v('paddingRight'), bottom: v('paddingBottom'), left: v('paddingLeft') };
  el.remove();
  return out;
}

/**
 * Show the title screen; resolves with the chosen slot ({ slot, fresh }) once the player
 * picks one (it is already the active slot then), after the title has faded out. When the
 * world behind it was started, the game opens in a fresh page instead (?start: the world's
 * modules read the sandboxed save, not the chosen one) and this never resolves.
 */
export function showTitle({ store = slots, doc = document, win = window, vista: wantVista = true } = {}) {
  return new Promise((resolve) => {
    const settings = new Settings();
    // (the title's own recording takes over from the procedural menu music once it has loaded: src/soundtracks.js TITLE_THEME)
    // (started once the menu answers: startIfAllowed below; a press starts it at once, as anywhere)
    const sound = new Sound('title', { score: false, titleTheme: true, autoStart: false });
    let vista = null, vistaQuality = settings.quality, worldStarted = false;
    // (a different world each opening, never the last one shown: src/title-shots.js)
    let ls = null;
    try { ls = win.localStorage; } catch { /* private mode */ }
    const shot = wantVista ? chooseShot({ storage: ls, search: win.location?.search ?? '', saves: (() => { try { return store.list(); } catch { return []; } })() }) : null;
    // (the boot's timings: the name on the screen, the world faded in; window.title.timing)
    const now = () => win.performance?.now?.() ?? Date.now();
    const timing = { shot: shot?.id ?? null, shown: null, world: null, stages: {} };
    // the player's last press (a key, a touch, the pad): what can wait (the sound's start, the world's build)
    // waits while they are pressing, so the menu answers first (TITLE_QUIET)
    let lastInput = -Infinity;
    const busy = () => now() - lastInput < TITLE_QUIET;
    const pressed = () => { lastInput = now(); };
    settings.on(() => {
      sound.setVolumes(settings.music, settings.effects); setFaces(settings.padFaces);
      if (vista && settings.quality !== vistaQuality) vista.setQuality((vistaQuality = settings.quality));
    });
    sound.menuMusic(true);

    const root = doc.createElement('div');
    root.id = 'title';
    root.className = shot ? 'vista-wait' : '';   // (the paper until the world fades in)
    if (shot) root.dataset.shot = shot.id;
    // (Full screen only where it does something: not in the apps (the Deck's, the Xbox's, Android's are full
    // screen already), nor in an installed web app already shown full screen)
    const fullscreen = () => !isNativeApp && !isDeckApp && !isXboxApp && !!doc.fullscreenEnabled
      && !(!doc.fullscreenElement && win.matchMedia?.('(display-mode: fullscreen)')?.matches);
    root.innerHTML = `${BACKDROP}<div class="paper" aria-hidden="true"></div><div class="print" aria-hidden="true"></div>
      <div class="front">
        <header>${LOGO}</header>
        <nav class="screen main-menu" data-screen="main"></nav>
        <section class="screen saves" data-screen="saves" hidden>
          <div class="head"><h2 data-t="title.savesHead">${t('title.savesHead')}</h2><button data-a="back">${glyph('back', { key: 'Esc' })}<span data-t="title.back">${t('title.back')}</span></button></div>
          <ol class="slots"></ol>
        </section>
        <p class="version">v${VERSION}${buildLabel()}</p>
      </div>
      <div class="confirm" hidden><div class="card" role="alertdialog" aria-labelledby="title-confirm-q">
        <h3 id="title-confirm-q"></h3><p class="what"></p><p data-t="title.undone">${t('title.undone')}</p>
        <div class="row"><button data-a="keep">${glyph('back', { key: 'Esc' })}<span data-t="title.keep">${t('title.keep')}</span></button><button data-a="delete" class="danger">${glyph('ok', { focus: true })}<span data-t="title.delete">${t('title.delete')}</span></button></div>
      </div></div>
      <div id="title-settings"></div>`;
    doc.body.appendChild(root);
    const settingsMenu = new SettingsMenu(settings, { sound, el: root.querySelector('#title-settings'), title: true });
    // (a new language, chosen in the settings: the title's own words in it; the menu and saves draw as they show)
    onLanguage(() => { if (done) return; for (const e of root.querySelectorAll('.front [data-t], .confirm [data-t]')) e.textContent = t(e.dataset.t); if (screen === 'saves') renderSaves(); else renderMain(); });

    const mainNav = root.querySelector('.main-menu');
    const savesEl = root.querySelector('.saves');
    const confirmEl = root.querySelector('.confirm');
    let screen = 'main', toDelete = null, done = false;

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
    const renderSaves = () => { root.querySelector('.slots').innerHTML = store.list().map(slotHtml).join(''); };
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
      const back = root.querySelector(`[data-del="${toDelete}"]`);
      toDelete = null;
      if (back) back.focus({ preventScroll: true }); else focusFirst(savesEl);
    };

    const choose = (n) => {
      if (done) return;
      done = true;
      const fresh = store.summary(n).empty;
      store.setActive(n);
      store.touch(n);   // (the selector's "last played", and Continue, follow it from now on)
      sound.menuMusic(false);
      root.classList.add('leaving');
      cleanup();
      vistaAbort.abort(); vista?.stop();   // (its last frame fades out with the title)
      setTimeout(() => {
        vista?.dispose(); vista = null; sound.dispose();
        // the world's modules were loaded on the sandboxed save: the game starts in a fresh page, in the chosen slot
        if (worldStarted) { win.location.replace(`${win.location.pathname}?start`); return; }
        root.remove(); resolve({ slot: n, fresh });
      }, 450);
    };

    const back = () => {
      if (!confirmEl.hidden) closeConfirm();
      else if (settingsMenu.open) { settingsMenu.back(); if (!settingsMenu.open) root.querySelector('[data-a="settings"]')?.focus({ preventScroll: true }); }
      else if (screen === 'saves') show('main', '[data-a="saves"]');
    };
    const act = (a, el) => {
      if (a === 'continue') choose(store.latest());
      else if (a === 'new') choose(store.firstEmpty() ?? 1);
      else if (a === 'saves') show('saves', '.slot .pick');
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
      else if (a === 'delete') {
        const n = toDelete;
        store.remove(n);
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
      const rows = [savesEl.querySelector('[data-a="back"]'), ...savesEl.querySelectorAll('.slot')];
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
    const navigate = (x, y, fresh = true) => (!confirmEl.hidden || settingsMenu.open ? menuNavigate(navRoot(), x, y, fresh)
      : screen === 'saves' ? savesNavigate(x, y) : mainNavigate(x, y));
    const navRoot = () => (!confirmEl.hidden ? confirmEl : settingsMenu.open ? settingsMenu.el : root.querySelector(`[data-screen="${screen}"]`));
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
        if (name === 'x' && screen === 'saves' && confirmEl.hidden && !settingsMenu.open) {
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
    // an audio context, 100-250 ms), then the world behind the menu, built in small steps that pause while the
    // player presses (src/title-world.js), its shaders compiled and first used a slice at a time, faded in on
    // its first frame; without WebGL (or on a software GPU) the drawn backdrop shows instead. Each in the
    // browser's idle time (at most `timeout` ms away) and never while the player is pressing (busy).
    const whenIdle = (fn, timeout = 500) => {
      const go = () => { if (done) return; if (busy()) setTimeout(() => whenIdle(fn, timeout), 100); else fn(); };
      if (win.requestIdleCallback) win.requestIdleCallback(go, { timeout }); else setTimeout(go, 30);
    };
    const vistaAbort = new AbortController();
    const drawn = () => root.classList.remove('vista-wait', 'vista-on');
    (win.requestAnimationFrame ?? ((f) => setTimeout(f, 16))).call(win, () => whenIdle(() => {
      sound.startIfAllowed();
      if (shot) whenIdle(startWorld);
    }));
    function startWorld() {
      if (done) return;
      const still = reducedMotion(settings, win);   // (the "Reduce motion" setting; not set: prefers-reduced-motion)
      // (the world's modules read the game state as they load: an in-memory save, past the prologue, meanwhile: src/save-slots.js)
      slots.sandbox({ 'moebius.game.v1': JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }) });
      worldStarted = true;
      import('./title-world.js')
        .then(({ startTitleWorld }) => startTitleWorld({ parent: root, shot, settings, native: isNativeApp, touch: isTouch, still, signal: vistaAbort.signal, win, busy,
          onStage: (name) => { timing.stages[name] = Math.round(now()); } }))
        .then((v) => {
          if (!v) { if (!done) drawn(); return; }
          if (done) { v.dispose(); return; }
          vista = v;
          v.onLost = () => { drawn(); v.dispose(); if (vista === v) vista = null; };
          win.requestAnimationFrame(() => { root.classList.replace('vista-wait', 'vista-on'); timing.world = now(); });
        })
        .catch((e) => { console.warn('title world unavailable', e); if (!done) drawn(); });
    }
    Object.assign(win, { title: { root, store, choose, show, askDelete, settingsMenu, sound, shot, timing, relayout, get vista() { return vista; } } });
  });
}
