// The title screen: the game's name (Memento) over a drawn landscape, then Continue (the
// save played last), Saves (five slots: continue one, start a new game in an empty one,
// delete one) and Settings. It runs before the game's modules load (src/boot.js), so
// the slot chosen here is the one every store reads (src/save-slots.js).
//
// Keyboard (arrows / WASD, Enter, Esc, Delete), mouse and touch, and a controller
// (d-pad or stick to move, A confirm, B back) through the same menuNavigate as the
// game's menus. The menu music plays under it (src/audio.js menuMusic).
//
// Imports nothing that loads the game state: the summaries come from the raw saves.

import { slots, SLOT_COUNT, formatPlaytime, formatDate, progressLine } from './save-slots.js';
import { Settings, SettingsMenu, isNativeApp } from './ui.js';
import { Sound } from './audio.js';
import { Controller, menuNavigate } from './controller.js';
import { setFaces, padFaces } from './native-pad.js';
import { markBooted } from './native-app.js';
import { VERSION } from './changelog.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** The drawn backdrop: a ringed planet over mesas, dunes, a giant's ribs and a caped traveller. */
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

/** The name in comic lettering: thick ink outline, a hard shadow, letters set a little askew. */
export const LOGO = `
<svg class="logo" viewBox="0 0 1000 250" role="img" aria-label="Memento">
  <g font-family="Futura, 'Futura PT', 'Avenir Next', 'Roboto', 'Arial Black', sans-serif" font-weight="900" font-size="200" text-anchor="middle">
    <text x="512" y="200" rotate="-5 3 -2 4 -3 2 -4" textLength="860" lengthAdjust="spacingAndGlyphs" fill="#2b211f" stroke="#2b211f" stroke-width="16" stroke-linejoin="round">MEMENTO</text>
    <text x="500" y="188" rotate="-5 3 -2 4 -3 2 -4" textLength="860" lengthAdjust="spacingAndGlyphs" fill="#f2c54b" stroke="#2b211f" stroke-width="14" stroke-linejoin="round" paint-order="stroke">MEMENTO</text>
  </g>
  <path d="M190 226 C380 210 640 214 820 230" fill="none" stroke="#c8483a" stroke-width="9" stroke-linecap="round"/>
</svg>`;

function slotHtml(s) {
  if (s.empty) {
    return `<li class="slot empty"><button class="pick" data-slot="${s.n}"><span class="thumb new" aria-hidden="true">+</span>
      <span class="txt"><b>Save ${s.n}</b><span class="world">New game</span><span class="prog">Starts with the prologue</span></span></button>
    <span class="del spacer" aria-hidden="true">Delete</span></li>`;
  }
  // (a save from before the slots has no playtime yet: only its date)
  const when = [s.playtime >= 60 && `${formatPlaytime(s.playtime)} played`, formatDate(s.lastPlayed)].filter(Boolean).join(' · ');
  return `<li class="slot"><button class="pick" data-slot="${s.n}">
      <img class="thumb" src="thumbs/${esc(s.level)}.jpg" alt="" onerror="this.style.visibility='hidden'">
      <span class="txt"><span class="top"><b>Save ${s.n}</b><span class="when">${esc(when)}</span></span><span class="world">${esc(s.world)}</span><span class="prog">${esc(progressLine(s))}</span></span></button>
    <button class="del" data-del="${s.n}" aria-label="Delete save ${s.n}">Delete</button></li>`;
}

/**
 * Show the title screen; resolves with the chosen slot ({ slot, fresh }) once the player
 * picks one (it is already the active slot then), after the title has faded out.
 */
export function showTitle({ store = slots, doc = document, win = window } = {}) {
  return new Promise((resolve) => {
    const settings = new Settings();
    const sound = new Sound('title', { score: false });
    settings.on(() => { sound.setVolumes(settings.music, settings.effects); setFaces(settings.padFaces); });
    sound.menuMusic(true);

    const root = doc.createElement('div');
    root.id = 'title';
    const fullscreen = !isNativeApp && doc.fullscreenEnabled;
    root.innerHTML = `${BACKDROP}
      <div class="front">
        <header>${LOGO}<p class="tag">a traveller, a fallen ship, and worlds drawn in ink</p></header>
        <nav class="screen main-menu" data-screen="main"></nav>
        <section class="screen saves" data-screen="saves" hidden>
          <div class="head"><h2>SAVES</h2><button data-a="back">Back</button></div>
          <ol class="slots"></ol>
        </section>
        <p class="hint"><span class="pad">A / × choose · B / ○ back</span><span class="keys">Enter choose · Esc back · Delete removes a save</span></p>
        <p class="version">v${VERSION}</p>
      </div>
      <div class="confirm" hidden><div class="card" role="alertdialog" aria-labelledby="title-confirm-q">
        <h3 id="title-confirm-q"></h3><p class="what"></p><p>This can't be undone.</p>
        <div class="row"><button data-a="keep">Keep it</button><button data-a="delete" class="danger">Delete</button></div>
      </div></div>
      <div id="title-settings"></div>`;
    doc.body.appendChild(root);
    const settingsMenu = new SettingsMenu(settings, { sound, el: root.querySelector('#title-settings'), title: true });

    const mainNav = root.querySelector('.main-menu');
    const savesEl = root.querySelector('.saves');
    const confirmEl = root.querySelector('.confirm');
    let screen = 'main', toDelete = null, done = false;

    const focusFirst = (el) => el.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    const renderMain = () => {
      const last = store.latest(), s = last ? store.summary(last) : null;
      mainNav.innerHTML = `${s
        ? `<button data-a="continue" class="primary">Continue<small>Save ${s.n} · ${esc(s.world)} · ${esc(progressLine(s))}</small></button>`
        : '<button data-a="new" class="primary">New game<small>The story begins with the prologue</small></button>'}
        <button data-a="saves">Saves<small>${SLOT_COUNT} slots: continue one, start anew, or delete one</small></button>
        <button data-a="settings">Settings</button>
        ${fullscreen ? `<button data-a="fullscreen">${doc.fullscreenElement ? 'Leave full screen' : 'Full screen'}</button>` : ''}`;
    };
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
      confirmEl.querySelector('h3').textContent = `Delete Save ${n}?`;
      confirmEl.querySelector('.what').textContent = [s.world, progressLine(s), s.playtime >= 60 && `${formatPlaytime(s.playtime)} played`].filter(Boolean).join(' · ');
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
      setTimeout(() => { sound.dispose(); root.remove(); resolve({ slot: n, fresh }); }, 450);
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
    const navigate = (x, y) => (screen === 'saves' && confirmEl.hidden && !settingsMenu.open ? savesNavigate(x, y) : menuNavigate(navRoot(), x, y));
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

    // a controller: d-pad / stick move, A confirm, B back (controller.js, as in the game's menus)
    const controller = new Controller({
      context: () => 'menu',
      look: () => {}, faces: () => padFaces(),
      activity: () => { sound.start(); root.classList.add('pad'); root.classList.remove('typed'); doc.body.classList.add('controller'); },
      navigate,
      scroll: (amount) => { const r = navRoot(); (r.querySelector('.panel, .slots') ?? r).scrollTop += amount; },
      action: (name) => {
        if (name === 'back' || name === 'start' || name === 'select') back();
        if (name === 'confirm') {
          const r = navRoot(), el = doc.activeElement;
          if (r.contains(el)) { if (el.tagName !== 'SELECT' && el.type !== 'range') el.click(); }
          else navigate(0, 1);
        }
      },
    });
    let last = performance.now(), raf = 0;
    const loop = (now) => {
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
      doc.removeEventListener('fullscreenchange', onFullscreen);
    }

    show('main');
    // the app's heartbeat: this build is up (src/native-app.js; the game marks it again after its first frame)
    markBooted(win);
    Object.assign(win, { title: { root, store, choose, show, askDelete, settingsMenu, sound } });
  });
}
