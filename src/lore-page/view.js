// The lore page's markup, built from its data alone (scripts/lore-data.mjs buildLore; tests/lore-page.test.js
// renders it in node). Every part of it carries a Note button (`data-note`: its anchor, `data-label`: what it is),
// which src/lore-page/main.js turns into a note on that part (src/lore-page/notes.js).

import { keyText, escapeHtml as esc } from '../prompt-keys.js';
import { KIND_NAMES } from '../items-page/view.js';

export const KINDS = { weapon: 'The blade and the guard', ...KIND_NAMES };
/** The page's parts, in order: the contents. */
export const SECTIONS = [['story', 'The story'], ['traveller', 'The traveller'], ['worlds', 'The worlds'], ['gadgets', 'The gadgets']];

/** Words: escaped, with the dialogue's *emphasis*. */
const words = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
const paras = (list = []) => list.map((p) => `<p>${words(p)}</p>`).join('');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** The Note button for a part of the page. */
export const noteButton = (anchor, label) => `<button type="button" class="note-btn" data-note="${esc(anchor)}" data-label="${esc(label)}" aria-label="Note on ${esc(label)}" title="Leave a note on this">Note</button>`;
const pic = (src, alt, cls = 'pic') => (src ? `<figure class="${cls}"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy"></figure>` : '');
/** An item's picture, or its glyph on a blank tile while it has none. */
const thumb = (it) => (it.picture ? `<img class="thumb" src="${esc(it.picture)}" alt="" loading="lazy">` : `<span class="thumb blank" aria-hidden="true">${esc(it.glyph || '?')}</span>`);
const head = (tag, anchor, label, title = label) => `<div class="head"><${tag}>${title}</${tag}>${noteButton(anchor, label)}</div>`;

function storyPart(p) {
  const anchor = `story-${p.id}`;
  return `<article class="part" id="${anchor}">${head('h3', anchor, p.title, esc(p.title))}${paras(p.text)}${
    p.ending?.length ? `<details class="ending"><summary>Show the ending</summary>${paras(p.ending)}</details>` : ''}</article>`;
}

function traveller(t) {
  return `<article class="part traveller" id="traveller-about">${head('h3', 'traveller-about', 'The traveller', esc(t.title))}
    <div class="pair">${pic(t.portrait, 'The traveller’s portrait', 'pic portrait')}${pic(t.sheet, 'The traveller’s character sheet', 'pic sheet')}</div>
    ${paras(t.text)}
    <dl class="gear">${t.gear.map(([k, v]) => `<div id="traveller-${slug(k)}"><dt>${esc(k)} ${noteButton(`traveller-${slug(k)}`, `The traveller: ${k}`)}</dt><dd>${words(v)}</dd></div>`).join('')}</dl>
  </article>`;
}

const fate = (g) => (g.kind === 'organic' ? 'calmed' : 'stopped');
function guardian(g, t, verbs) {
  const anchor = `guardian-${t.id}`, name = g.name.replace(/^the /, 'The ');
  const steps = g.phases.map((p) => `<li>${words(p.hint)}${p.asks ? `<div class="verb"><b>Second verb: ${esc(verbs[p.asks.verb] ?? p.asks.verb)}.</b> ${words(p.asks.hint)}</div>` : ''}</li>`).join('');
  return `<article class="guardian" id="${anchor}">${head('h4', anchor, `${name} (${t.name})`, `${esc(name)} <small>the guardian, ${fate(g)}</small>`)}
    <div class="body"><div class="info">
    <p class="said">${words(g.wake)}</p>
    <p><b>The gimmick:</b> ${esc(t.gadget.name)} is the key. ${g.kind === 'organic' ? `Once it is calm, ${esc(g.touch || 'go to it')}.` : 'Wear it down with it until it stops.'}</p>
    <ol class="phases">${steps}</ol>
    ${g.weary ? `<p class="said">${words(g.weary)}</p>` : ''}<p class="said">${words(g.resolved)}</p>
    </div>${pic(g.picture, `${name}: its design sheet`)}</div>
  </article>`;
}

function temple(t, w, verbs) {
  const anchor = `temple-${t.id}`;
  return `<article class="temple" id="${anchor}">${head('h4', anchor, `${t.name} (${w.title})`, `${esc(t.name)} <small>${t.part ? `${esc(t.part)} · ` : ''}the temple</small>`)}
    <div class="body">${pic(t.picture, `${t.name}`)}<div class="info">
    ${t.local ? `<p class="meta">At its door: ${esc(t.local.name)}${t.local.title ? `, ${esc(t.local.title)}` : ''}.</p>` : ''}
    <p class="said">${words(t.enter)}</p>
    <div class="gadget" id="gadget-${t.id}">${head('h5', `gadget-${t.id}`, `${t.gadget.name}, the gadget of ${t.name}`, `The gadget: ${esc(t.gadget.name)}`)}
      ${thumb(t.gadget)}<p>${keyText(esc(t.gadget.text), { html: true })}</p></div>
    ${t.open.length ? `<p class="meta">In the open, outside: ${t.open.map((i) => `<a href="#item-${esc(i.id)}">${esc(i.name)}</a>`).join(', ')}.</p>` : ''}
    </div></div>
    ${t.guardian ? guardian(t.guardian, t, verbs) : ''}
    ${t.quest.outro ? `<p class="after"><b>After:</b> ${words(t.quest.outro)}</p>` : ''}
  </article>`;
}

function person(p, w) {
  const anchor = `person-${w.id}-${slug(p.id)}`;
  return `<li class="person" id="${anchor}">${head('h5', anchor, `${p.name} (${w.title})`, `${esc(p.name)} <small>${esc(p.role)}</small>`)}${paras(p.story)}</li>`;
}

function world(w, i, verbs) {
  const anchor = `world-${w.id}`;
  return `<section class="world" id="${anchor}">
    <header class="world-head">${pic(w.picture, w.title, 'pic wide')}
      <div>${head('h3', anchor, w.title, `<span class="n">${i + 1}</span> ${esc(w.title)}`)}
      ${w.page.title ? `<p class="page-title">${esc(w.page.title)}</p>` : ''}${w.parts.length > 1 ? `<p class="meta">With ${w.parts.slice(1).map(esc).join(', ')}.</p>` : ''}
      <p class="blurb">${words(w.blurb)}</p></div></header>
    <div class="lore">${paras(w.lore)}${w.page.intro ? `<p class="said">${words(w.page.intro)}</p>` : ''}</div>
    <div class="temples">${w.temples.map((t) => temple(t, w, verbs)).join('')}</div>
    <details class="people"><summary>Its people (${w.people.length})</summary><ul>${w.people.map((p) => person(p, w)).join('')}</ul></details>
  </section>`;
}

function itemCard(it) {
  const anchor = `item-${it.id}`;
  const where = it.where.length
    ? it.where.map((x) => `<li><b>${esc(x.title)}</b>${x.temple ? ' (its temple)' : ''}: ${words(x.note)}</li>`).join('')
    : `<li>${words(it.whereText || (it.kind === 'quest' || it.kind === 'pass' ? 'Given in a quest.' : 'Not in a box.'))}</li>`;
  return `<article class="item" id="${anchor}" data-kind="${esc(it.kind)}">
    ${thumb(it)}
    <div>${head('h4', anchor, it.name, esc(it.name))}
      <p class="meta">${esc(KINDS[it.kind] ?? it.kind)}${it.needs ? ` · needs ${esc(it.needs)}` : ''}</p>
      <p>${keyText(esc(it.text), { html: true })}</p>
      ${it.temple ? `<p class="key-to">The key to <a href="#temple-${esc(it.temple.temple)}">${esc(it.temple.name)}</a> and its guardian, <a href="#guardian-${esc(it.temple.temple)}">${esc(it.temple.guardian)}</a>.</p>` : ''}
      <ul class="where">${where}</ul></div>
  </article>`;
}

/** The page's main markup: { nav, main }. */
export function lorePage(d) {
  const kinds = [...new Set(d.items.map((i) => i.kind))];
  const nav = SECTIONS.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('');
  const main = `
  <section id="story" class="band"><h2>The story</h2>${d.thread.map(storyPart).join('')}</section>
  <section id="traveller" class="band"><h2>The traveller</h2>${traveller(d.traveller)}</section>
  <section id="worlds" class="band"><h2>The worlds <small>in the route’s order</small></h2>
    <nav class="toc">${d.worlds.map((w, i) => `<a href="#world-${w.id}">${i + 1}. ${esc(w.title)}</a>`).join('')}</nav>
    ${d.worlds.map((w, i) => world(w, i, d.verbs)).join('')}</section>
  <section id="gadgets" class="band"><h2>The gadgets <small>every gift of the makers</small></h2>
    ${kinds.map((k) => `<h3 class="kind" id="kind-${esc(k)}">${esc(KINDS[k] ?? k)}</h3><div class="items">${d.items.filter((i) => i.kind === k).map(itemCard).join('')}</div>`).join('')}</section>`;
  return { nav, main };
}

/** Every picture the page shows (the test checks each exists). */
export function lorePictures(d) {
  const out = new Set([d.traveller.portrait, d.traveller.sheet]);
  for (const w of d.worlds) { out.add(w.picture); for (const t of w.temples) { out.add(t.picture); out.add(t.gadget.picture); if (t.guardian?.picture) out.add(t.guardian.picture); } }
  for (const i of d.items) out.add(i.picture);
  return [...out].filter(Boolean);
}
