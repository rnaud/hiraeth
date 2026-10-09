// The items page's cards, built from the data alone (tests/items-page.test.js reads it in node).

import { keyText } from '../prompt-keys.js';   // (an item's {key:verb}: the keyboard's, on this page)

export const KIND_NAMES = { core: 'Core', movement: 'Movement', mode: 'Gun modes', gadget: 'Gadgets', upgrade: 'Upgrades', charm: 'Charms', pass: 'Passes', cosmetic: 'Cosmetic', quest: 'Quest' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Where an item is found: each box that holds it ({ world, title, temple, note }), the fallbacks by the ship, or a quest. */
export function whereFound(id, placements, fallbacks = [], titles = {}) {
  const out = [];
  for (const [world, list] of Object.entries(placements)) for (const p of list) if (p.item === id) out.push({ world, title: titles[world] ?? world, temple: !!p.temple, note: p.note ?? p.hint ?? '' });
  for (const f of fallbacks) if (f.item === id) out.push({ world: f.world ?? '', title: 'By the ship', temple: false, note: f.note ?? 'A spare box by the ship, in the worlds that want it, for anyone who came without it.' });
  return out;
}

/** Every item as a card: { id, kind, search, html }, in the registry's order. */
export function itemsPage(items, placements, fallbacks, titles) {
  return Object.entries(items).map(([id, it]) => {
    const where = whereFound(id, placements, fallbacks, titles);
    const whereHtml = where.length
      ? `<ul class="where">${where.map((w) => `<li><b>${esc(w.title)}</b>${w.temple ? ' (its temple)' : ''}: ${esc(w.note)}</li>`).join('')}</ul>`
      : `<ul class="where"><li>${esc(it.where ?? (it.kind === 'quest' || it.kind === 'pass' ? 'Given in a quest.' : 'Not in a box.'))}</li></ul>`;
    // (focusable, data-nav: a controller moves through the cards in 2D and A opens one, src/items-page/main.js)
    const html = `<article data-id="${esc(id)}" data-kind="${esc(it.kind)}" tabindex="0" data-nav>
      <div class="pic" title="Drag to turn it; click to see it full screen"><img src="item-pictures/${esc(id)}.webp" alt="" loading="lazy"><canvas></canvas><span class="glyph on-focus" data-glyph="ok" aria-hidden="true"></span></div>
      <div class="txt"><h2>${esc(it.name)}</h2><div class="meta">${esc(KIND_NAMES[it.kind] ?? it.kind)}${it.needs ? ` · needs ${esc(items[it.needs]?.name ?? it.needs)}` : ''} · ${esc(id)}</div>
      <p>${esc(it.text)}</p>${it.use ? `<p class="use">${keyText(esc(it.use), { html: true })}</p>` : ''}${whereHtml}</div>
    </article>`;
    return { id, kind: it.kind, html, search: [it.name, it.text, it.use, id, ...where.map((w) => `${w.title} ${w.note}`)].join(' ').toLowerCase() };
  });
}

/**
 * The full-screen view's one line (on a handheld's small screen the item must stay in sight: the
 * author's playtest, October 2026): the first sentence of what the item is, cut at `max` letters. The
 * rest (all of it, and what it does) opens on request, beside the item.
 */
export function shortLine(text, max = 90) {
  const s = String(text ?? '').trim();
  const m = s.match(/^(.+?[.!?])(?:\s|$)/);
  const first = m ? m[1] : s;
  return first.length <= max ? first : `${first.slice(0, max - 1).replace(/[\s,;:]+\S*$/, '')}…`;
}
