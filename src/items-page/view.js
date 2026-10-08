// The items page's cards, built from the data alone (tests/items-page.test.js reads it in node).

export const KIND_NAMES = { core: 'Core', movement: 'Movement', mode: 'Gun modes', upgrade: 'Upgrades', charm: 'Charms', pass: 'Passes', cosmetic: 'Cosmetic', quest: 'Quest' };
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
      : `<ul class="where"><li>${it.kind === 'quest' || it.kind === 'pass' ? 'Given in a quest.' : 'Not in a box.'}</li></ul>`;
    const html = `<article data-id="${esc(id)}" data-kind="${esc(it.kind)}">
      <div class="pic" title="Drag to turn it; click to see it full screen"><img src="item-pictures/${esc(id)}.webp" alt="" loading="lazy"><canvas></canvas></div>
      <div class="txt"><h2>${esc(it.name)}</h2><div class="meta">${esc(KIND_NAMES[it.kind] ?? it.kind)}${it.needs ? ` · needs ${esc(items[it.needs]?.name ?? it.needs)}` : ''} · ${esc(id)}</div>
      <p>${esc(it.text)}</p>${it.use ? `<p class="use">${esc(it.use)}</p>` : ''}${whereHtml}</div>
    </article>`;
    return { id, kind: it.kind, html, search: [it.name, it.text, it.use, id, ...where.map((w) => `${w.title} ${w.note}`)].join(' ').toLowerCase() };
  });
}
