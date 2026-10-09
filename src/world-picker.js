// The worlds list (L in play, Debug on the title and in the Start menu): every world, open,
// whatever you've found. Its cards are drawn here, for the game (src/main.js) and for the
// title's Debug entry, which shows the list alone (?worlds=1, src/boot.js) without building a world.
// A world on the route opens in the debug save (src/debug-save.js): its own slot, as if every world
// before it had been played through; the others open in the save being played.

import { ORDER } from './levels/names.js';
import { GAMES, gameHref } from './minigames/index.js';
import { bestScore, formatScore } from './minigames/kit/scores.js';
import { scoreDef } from './minigames/kit/flow.js';
import { InputMode } from './input-mode.js';
import { glyph } from './pad-glyphs.js';

/** The game's other pages, at the top of the list (they leave the game). */
export const PAGES = [
  { href: 'studio.html', label: 'Character studio', hint: 'the people alone, to tune them' },
  { href: 'motion.html', label: 'Motion', hint: 'the traveller\'s loops against motion matching' },
  { href: 'trailer.html', label: 'Trailer', hint: 'the in-engine trailer' },
  { href: 'changelog.html', label: 'What\'s new', hint: 'every change, with pictures' },
  { href: 'cinematics.html', label: 'Cinematics', hint: 'replay the films and record quality-control notes' },
  { href: 'items.html', label: 'Items', hint: 'every item, its picture, what it does, where it is found' },
];

/** A game's best in the save (`state`: flag(name)), as its results show it, or '' (none yet, or no save). */
export function gameBest(g, state) {
  if (!state?.flag) return '';
  const v = bestScore(state, scoreDef(g, state));   // (a best of each difficulty: the one chosen last)
  return v === null ? '' : formatScore(g, v);
}

/** The minigames' row, under the pages: each opens its game's page (?game=<id>, src/minigames/), its best under its name. */
export function gamesRow(games = GAMES, state = null) {
  if (!games.length) return '';
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return `<span class="label">Games</span>${games.map((g) => {
    const best = gameBest(g, state);
    return `<a href="${gameHref(g.id)}" title="${esc(g.blurb)}">${esc(g.name)}${best ? `<small class="best">best ${esc(best)}</small>` : ''}</a>`;
  }).join('')}`;
}

/** Where a card goes: a route world in the debug save (?debugsave=1, src/boot.js), any other in the save being played. */
export function pickHref(id, order = ORDER) {
  return order.includes(id) ? `?level=${id}&debugsave=1` : `?level=${id}`;
}

/** The line under the pages: what picking a world does to the save. */
export const DEBUG_NOTE = 'A world on the route opens in a separate debug save, as if every world before it were done: '
  + 'their quests, boxes, gear and recordings. Your own saves are not touched (choose one on the title to go back to it).';

/** What a card says of the save it opens in. */
export const alongLine = (id, order = ORDER) => {
  const i = order.indexOf(id);
  return i < 0 ? 'in your save' : i === 0 ? 'debug save · a new journey' : `debug save · ${i} world${i === 1 ? '' : 's'} done before it`;
};

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/**
 * A world's card in the grid: its picture with its number, its name, its source and the save it opens in;
 * its blurb and moves are its tooltip and, focused, the strip at the foot. The confirm glyph shows on the
 * focused one (src/pad-glyphs.js).
 */
export function cardHtml(l, i, current = false) {
  return `<a class="card${current ? ' current' : ''}" href="${pickHref(l.id)}" data-id="${esc(l.id)}" title="${esc(l.blurb)}">
    <span class="pic"><img src="thumbs/${esc(l.id)}.jpg" alt="" loading="lazy" onerror="this.style.visibility='hidden'" /><b class="num">${i + 1}</b>${glyph('ok', { focus: true })}</span>
    <span class="txt"><h2>${esc(l.title)}</h2><span class="src">${esc(l.source)}</span><span class="along">${esc(alongLine(l.id))}</span></span>
  </a>`;
}

/** The cards (and Continue, to the world this save was left in, and the other pages) into the #picker element. */
export function fillPicker(picker, { levels, current = null, cont = null, state = null }) {
  const nav = document.createElement('nav');
  nav.className = 'pages';
  nav.innerHTML = PAGES.map((p) => `<a href="${p.href}" title="${p.hint}">${p.label}</a>`).join('');
  picker.querySelector('header').after(nav);
  const games = document.createElement('nav');
  games.className = 'pages games';
  games.innerHTML = gamesRow(GAMES, state);
  if (games.innerHTML) nav.after(games);
  const note = document.createElement('p');
  note.className = 'debug-note';
  note.textContent = DEBUG_NOTE;
  (games.isConnected ? games : nav).after(note);
  if (cont) {
    const btn = document.createElement('a');
    btn.className = 'continue';
    btn.href = `?level=${cont.id}`;
    btn.textContent = `▶ Continue — ${cont.title}`;
    picker.querySelector('header').after(btn);
  }
  picker.querySelector('.cards').innerHTML = levels.map((l, i) => cardHtml(l, i, l.id === current)).join('');
  // a grid on a controller: the D-pad and the stick move to the card that way (menuNavigate, data-grid-nav);
  // the focused card's words in the strip at the foot (the cards are small: a picture, a name, the save)
  picker.dataset.gridNav = '';
  const info = picker.querySelector('.info') ?? picker.appendChild(Object.assign(document.createElement('p'), { className: 'info' }));
  picker.addEventListener('focusin', (e) => {
    const card = e.target.closest?.('.card');
    const l = card && levels.find((x) => x.id === card.dataset.id);
    info.innerHTML = l ? `<b>${esc(l.title)}</b> ${esc(l.blurb)} <span class="moves">${esc(l.moves)}</span>` : '';
    info.hidden = !l;
  });
  info.hidden = true;
  const close = picker.querySelector('.close');
  if (close && !close.querySelector('.glyph')) close.insertAdjacentHTML('afterbegin', glyph('back', { key: 'Esc' }));
}

/** The list alone, before any world is built: a card (or its number) loads that world; close goes back to the title. */
export async function showWorldsOnly(doc = document, win = window) {
  const [{ LEVELS, levelById }, { SaveGame, isTouch }, { Controller, menuNavigate }, { padFaces }, { game }] = await Promise.all([
    import('./levels/index.js'), import('./ui.js'), import('./controller.js'), import('./native-pad.js'), import('./game-state.js')]);
  const picker = doc.getElementById('picker');
  // what is in hand (remembered from the title): the glyphs in the buttons follow it (src/pad-glyphs.js)
  const inputMode = new InputMode({ touchDevice: isTouch });
  const hint = picker.querySelector('header .hint');
  const showInput = () => { inputMode.apply(doc.body.classList); if (hint) hint.textContent = inputMode.kind === 'keys' ? 'press a number' : ''; };
  for (const ev of ['keydown', 'pointerdown', 'touchstart']) win.addEventListener(ev, (e) => { inputMode.event(e); showInput(); }, { capture: true, passive: true });
  const saved = SaveGame.load()?.level;
  fillPicker(picker, { levels: LEVELS, cont: levelById(saved) ?? null, state: game });
  showInput();   // (the keys' hint: a number opens its world; a pad's back button is in the close button)
  const toTitle = () => { win.location.href = win.location.pathname; };
  picker.querySelector('.close').addEventListener('click', toTitle);
  const ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  win.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyL') toTitle();
    if (ARROWS[e.code]) { e.preventDefault(); menuNavigate(picker, ...ARROWS[e.code]); }   // (the grid, as the pad moves in it)
    const n = Number(e.key);
    if (n >= 1 && n <= LEVELS.length) win.location.search = pickHref(LEVELS[n - 1].id);
  });
  // a controller: d-pad / stick move, A opens the world, B back to the title (as on the title, src/title.js)
  const controller = new Controller({
    context: () => 'menu',
    look: () => {}, faces: () => padFaces(),
    activity: () => { inputMode.pad(); showInput(); },   // (and the world it opens starts with no touch buttons: src/input-mode.js)
    navigate: (x, y, fresh) => menuNavigate(picker, x, y, fresh),
    scroll: (amount) => { picker.scrollTop += amount; },
    action: (name) => {
      if (name === 'back' || name === 'start' || name === 'select') toTitle();
      if (name === 'tabPrev' || name === 'tabNext') picker.scrollBy({ top: (name === 'tabNext' ? 1 : -1) * picker.clientHeight * 0.8 });   // (LB / RB: a page)
      if (name === 'confirm') { if (picker.contains(doc.activeElement)) doc.activeElement.click(); else menuNavigate(picker, 0, 1); }
    },
  });
  let last = performance.now();
  const loop = (now) => {
    const pads = Array.from(navigator.getGamepads?.() ?? []).some((p) => p?.connected);
    if (inputMode.frame(pads) === 'pad' !== doc.body.classList.contains('controller')) showInput();
    controller.update(Math.min((now - last) / 1000, 0.1), !doc.hidden && doc.hasFocus());
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  doc.getElementById('loading')?.remove();
  picker.classList.add('open');
}
