// The items page (items.html, linked from the worlds list: src/world-picker.js PAGES): every item of
// src/items.js with its picture (public/item-pictures/<id>.webp: scripts/item-pictures.mjs draws them with
// the game's own pipeline), what it is, what it does, and where it is found (the makers' boxes in
// src/boxes/placements.js, by world: in the open or in the temple; the fallbacks by the ship; quests).
import { ITEMS } from '../items.js';
import { PLACEMENTS, FALLBACKS } from '../boxes/placements.js';
import { TITLES } from '../levels/names.js';
import { itemsPage, KIND_NAMES } from './view.js';

const $ = (s) => document.querySelector(s);
const entries = itemsPage(ITEMS, PLACEMENTS, FALLBACKS, TITLES);
const state = { kind: 'all', q: '' };
const kinds = ['all', ...new Set(entries.map((e) => e.kind))];
$('#kinds').innerHTML = kinds.map((k) => `<button class="chip" data-kind="${k}" aria-pressed="${k === 'all'}">${k === 'all' ? 'All' : KIND_NAMES[k] ?? k}</button>`).join('');
$('#list').innerHTML = entries.map((e) => e.html).join('');
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
