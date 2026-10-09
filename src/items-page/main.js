// The items page (items.html, linked from the worlds list: src/world-picker.js PAGES): every item of
// src/items.js, what it is, what it does, and where it is found (the makers' boxes in
// src/boxes/placements.js, by world: in the open or in the temple; the fallbacks by the ship; quests).
// Each card's picture is the item in 3D (src/items-page/viewer.js, the game's own pipeline): drag it to
// turn it; click it for the full-screen view (drag, zoom, the other items with ← →). Without WebGL the
// cards keep the pictures the game drew (public/item-pictures/, scripts/item-pictures.mjs).
import '../gadgets/all.js';   // (first: the gadgets are items too, src/gadgets/)
import { ITEMS } from '../items.js';
import { PLACEMENTS, FALLBACKS } from '../boxes/placements.js';
import { TITLES } from '../levels/names.js';
import { itemsPage, KIND_NAMES, shortLine } from './view.js';
import { keyText, escapeHtml as esc } from '../prompt-keys.js';
import { Controller, menuNavigate } from '../controller.js';
import { installNativePad, watchLabels, padFaces } from '../native-pad.js';
import { installGlyphs } from '../pad-glyphs.js';
import { InputMode } from '../input-mode.js';
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// a controller here too (a handheld opens this page from the worlds list): its buttons' glyphs, its own names
installNativePad(); watchLabels(); installGlyphs();
const inputMode = new InputMode({ touchDevice: isTouch });
inputMode.apply(document.body.classList);
for (const ev of ['keydown', 'pointerdown', 'touchstart']) addEventListener(ev, (e) => { inputMode.event(e); inputMode.apply(document.body.classList); }, { capture: true, passive: true });
document.body.dataset.gridNav = '';   // (menuNavigate: the cards are a grid)

const $ = (s) => document.querySelector(s);
const entries = itemsPage(ITEMS, PLACEMENTS, FALLBACKS, TITLES);
const state = { kind: 'all', q: '' };
const kinds = ['all', ...new Set(entries.map((e) => e.kind))];
$('#kinds').innerHTML = kinds.map((k) => `<button class="chip" data-kind="${k}" aria-pressed="${k === 'all'}">${k === 'all' ? 'All' : KIND_NAMES[k] ?? k}</button>`).join('');
$('#list').innerHTML = entries.map((e) => e.html).join('');
const visible = () => [...document.querySelectorAll('article')].filter((a) => !a.hidden).map((a) => a.dataset.id);
const apply = () => {
  let n = 0;
  for (const el of document.querySelectorAll('article')) {
    const e = entries.find((x) => x.id === el.dataset.id);
    const show = (state.kind === 'all' || e.kind === state.kind) && (!state.q || e.search.includes(state.q));
    el.hidden = !show; if (show) n++;
  }
  for (const c of document.querySelectorAll('.chip')) c.setAttribute('aria-pressed', String(c.dataset.kind === state.kind));
  $('#count').textContent = `${n} of ${entries.length}`;
};
$('#kinds').addEventListener('click', (ev) => { const k = ev.target.closest('[data-kind]')?.dataset.kind; if (k) { state.kind = k; apply(); } });
$('#search').addEventListener('input', (ev) => { state.q = ev.target.value.trim().toLowerCase(); apply(); });
for (const img of document.querySelectorAll('.pic img')) img.addEventListener('error', () => { img.remove(); }, { once: true });
apply();

// ------------------------------------------------------------------ the items in 3D
let viewer = null;
try {
  const { ItemViewer, dragOrbit, zoomOrbit, VIEW } = await import('./viewer.js');
  viewer = new ItemViewer();
  const orbits = new Map(), queue = new Set();
  const orbitOf = (id) => orbits.get(id) ?? orbits.set(id, { yaw: VIEW.yaw, pitch: VIEW.pitch, zoom: 1 }).get(id);
  const draw = (pic) => { const id = pic.closest('article').dataset.id; if (viewer.drawInto(pic.querySelector('canvas'), id, orbitOf(id))) pic.classList.add('drawn'); };
  // each card drawn once as it comes into view, one a frame
  const seen = new IntersectionObserver((list) => { for (const e of list) if (e.isIntersecting) { queue.add(e.target); seen.unobserve(e.target); } });
  for (const pic of document.querySelectorAll('.pic')) seen.observe(pic);
  const pump = () => { const pic = queue.values().next().value; if (pic) { queue.delete(pic); draw(pic); } requestAnimationFrame(pump); };
  requestAnimationFrame(pump);
  // a card: drag to turn it (drawn as it turns), a click without a drag opens it full screen
  for (const pic of document.querySelectorAll('.pic')) {
    let drag = null;
    pic.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; pic.setPointerCapture(e.pointerId); });
    pic.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      dragOrbit(orbitOf(pic.closest('article').dataset.id), dx, dy);
      draw(pic);
    });
    pic.addEventListener('pointerup', () => { if (drag && drag.moved < 5) open(pic.closest('article').dataset.id); drag = null; });
  }
  // the full-screen view
  const full = $('#full');
  let current = null, fdrag = null, pinch = null;
  // the words: one short line under the item (its kind, the first sentence); "more" (A / I) opens all of it
  // in a column beside the item, which moves over (the canvas narrows: never under the words)
  const describe = (id) => {
    const it = ITEMS[id];
    full.querySelector('h2').textContent = it.name;
    full.querySelector('.short').innerHTML = `<b>${esc(KIND_NAMES[it.kind] ?? it.kind)}</b><span class="line">${esc(shortLine(it.text))}</span>`;
    full.querySelector('.long').innerHTML = `<p>${esc(it.text)}</p>${it.use ? `<p class="use">${keyText(esc(it.use), { html: true })}</p>` : ''}`;
  };
  const more = (on = !full.classList.contains('more')) => {
    full.classList.toggle('more', on);
    full.querySelector('.more .lbl').textContent = on ? 'less' : 'more';
  };
  function open(id) {
    current = id; describe(id);
    full.classList.add('open'); full.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
    viewer.show(full, id);
  }
  function close() {
    full.classList.remove('open'); full.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; more(false);
    viewer.hide();
    const was = current; current = null;
    for (const pic of document.querySelectorAll('.pic.drawn')) draw(pic);   // (the renderer was the full view's: the cards again)
    document.querySelector(`article[data-id="${was}"]`)?.focus({ preventScroll: false });   // (back on its card, for the pad)
  }
  const go = (d) => { const list = visible(), i = list.indexOf(current); open(list[(i + d + list.length) % list.length]); };
  const reset = () => Object.assign(viewer.orbit, { yaw: VIEW.yaw, pitch: VIEW.pitch, zoom: VIEW.fullZoom });
  full.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
    else if (e.target.closest('[data-go]')) go(+e.target.closest('[data-go]').dataset.go);
    else if (e.target.closest('[data-spin]')) viewer.spin = !viewer.spin;
    else if (e.target.closest('[data-reset]')) reset();
    else if (e.target.closest('[data-more]')) more();
  });
  // a controller: the cards are a grid (the D-pad and the stick move to the card that way), A opens one;
  // full screen: ← → or LB / RB the other items, ↑ ↓ zoom, the right stick tilts, A more, Y turn, X reset, B closes.
  // Each of those buttons carries its glyph (src/pad-glyphs.js), for the pad in hand or the keys.
  const controller = new Controller({
    context: () => 'menu', look: () => {}, faces: () => padFaces(),
    activity: () => { inputMode.pad(); inputMode.apply(document.body.classList); },
    navigate: (x, y, fresh) => {
      if (!current) return menuNavigate(document.body, x, y, fresh);
      if (x) go(x);
      else if (y) zoomOrbit(viewer.orbit, y > 0 ? 1.15 : 1 / 1.15);
    },
    scroll: (amount) => { if (current) { viewer.spin = false; dragOrbit(viewer.orbit, 0, amount * 0.6); } else window.scrollBy(0, amount); },
    action: (name) => {
      if (current) {
        if (name === 'back') close();
        else if (name === 'tabPrev' || name === 'tabNext') go(name === 'tabNext' ? 1 : -1);
        else if (name === 'confirm') more();
        else if (name === 'y') viewer.spin = !viewer.spin;
        else if (name === 'x') reset();
        return;
      }
      const el = document.activeElement;
      if (name === 'confirm') { if (el?.matches?.('article')) open(el.dataset.id); else if (el && el !== document.body) el.click(); else menuNavigate(document.body, 0, 1); }
      else if (name === 'tabPrev' || name === 'tabNext') {   // (LB / RB: the kind before / after)
        const i = kinds.indexOf(state.kind), k = kinds[(i + (name === 'tabNext' ? 1 : -1) + kinds.length) % kinds.length];
        state.kind = k; apply();
      } else if (name === 'back') location.href = './?worlds=1';   // (back to the worlds list it was opened from)
    },
  });
  let last = performance.now();
  const tick = (t) => {
    const padOn = Array.from(navigator.getGamepads?.() ?? []).some((p) => p?.connected);
    if ((inputMode.frame(padOn) === 'pad') !== document.body.classList.contains('controller')) inputMode.apply(document.body.classList);
    controller.update(Math.min(0.1, (t - last) / 1000), !document.hidden && document.hasFocus());
    last = t; requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  full.addEventListener('dblclick', () => Object.assign(viewer.orbit, { yaw: VIEW.yaw, pitch: VIEW.pitch, zoom: VIEW.fullZoom }));
  full.addEventListener('pointerdown', (e) => { if (e.target.closest('.bar, .about')) return; fdrag = { x: e.clientX, y: e.clientY }; viewer.spin = false; full.setPointerCapture(e.pointerId); });
  full.addEventListener('pointermove', (e) => { if (!fdrag) return; dragOrbit(viewer.orbit, e.clientX - fdrag.x, e.clientY - fdrag.y); fdrag.x = e.clientX; fdrag.y = e.clientY; });
  full.addEventListener('pointerup', () => { fdrag = null; });
  full.addEventListener('wheel', (e) => { e.preventDefault(); zoomOrbit(viewer.orbit, Math.exp(e.deltaY * 0.0015)); }, { passive: false });
  full.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) { pinch = null; return; }
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (pinch) zoomOrbit(viewer.orbit, pinch / d);
    pinch = d; fdrag = null;
  }, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (!current) {
      if (e.target.tagName === 'INPUT') return;
      const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
      if (dir) { e.preventDefault(); menuNavigate(document.body, ...dir); }
      else if (e.key === 'Enter' && document.activeElement?.matches?.('article')) open(document.activeElement.dataset.id);
      return;
    }
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'r' || e.key === 'R') viewer.spin = !viewer.spin;
    else if (e.key === 'i' || e.key === 'I' || e.key === 'Enter') more();
    else if (e.key === '0') reset();
  });
  window.itemsViewer = viewer;   // (for the screenshots and the console)
} catch (e) {
  console.warn('items page: no 3D, the pictures stay', e);
}
