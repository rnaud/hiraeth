// The reference lab's Pick mode (docs/systems/reference-lab.md#pick-mode): every batch still to pick, one at a
// time and full screen, in the prompt documents' order (a world's or an object's sheets together), a pick or a
// "none of them" moving straight on to the next. Pure: the queue, its order, the session's moves and the drawing;
// pickmode-ui.js puts it on the page, the dev server does the picks (the same pick as the grid's Pick button).
import { candidateSrc, esc, fileSrc } from './view.js';

/** The default reasons, pre-filled in the "why" field (never required; typed over at will). */
export const PICK_WHY = 'the best of the batch';
export const REJECT_WHY = 'none of them fits';

/** A batch's `from` as the page knows it (`<doc>#<id>` for a main prompt, `<doc>#<id>/<key>` for a variant). */
const fromKey = (doc, id, key) => `${doc}#${id}${key === 'main' ? '' : `/${key}`}`;

/** Every prompt-document entry by its `from`: { docIndex, entryIndex, variantIndex, doc, docTitle, id, title, section, group, key, label, target }. */
export function promptIndex(prompts) {
  const out = new Map();
  (prompts?.docs ?? []).forEach((d, docIndex) => d.entries.forEach((e, entryIndex) => e.variants.forEach((v, variantIndex) => {
    out.set(fromKey(d.doc, e.id, v.key), { docIndex, entryIndex, variantIndex, doc: d.doc, docTitle: d.title ?? null, id: e.id, title: e.title, section: e.section ?? null, group: e.group ?? null, key: v.key, label: v.label, target: e.target });
  })));
  return out;
}

/** The world (or object) a batch is about: the level its target is in, else its prompt document's title, else its folder. */
export function worldOf(target, info = null) {
  const lv = String(target ?? '').match(/^references\/levels\/([^/]+)\//);
  if (lv) return lv[1];
  if (info?.docTitle) return info.docTitle;
  return String(target ?? '').replace(/^references\//, '').split('/').filter(Boolean)[0] ?? 'Other';
}

const firstSentence = (t, max = 180) => {
  const s = String(t ?? '').trim().split(/(?<=[.!?])\s/)[0];
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

/** What a batch is, said for the header: { world, title, id, line }. */
export function describe(b, info = null) {
  const world = worldOf(b.target, info);
  if (!info) return { world, title: [world, b.from || b.batch].join(' · '), id: b.batch, line: firstSentence(b.prompt) };
  const group = info.group?.id ?? (info.section && info.section !== world ? info.section : null);
  const variant = info.key === 'main' ? '' : ` (${info.key})`;
  const title = [world, group, `${info.title}${variant}`].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
  const label = info.label && info.label !== info.key ? info.label : '';
  return { world, title, id: `${info.id}${info.key === 'main' ? '' : `/${info.key}`}`, line: label || firstSentence(b.prompt) };
}

/** Is a batch (as listBatches gives it) still to pick, and can Pick mode show it? (2D, done, a picture left, no pick, not turned down) */
export const pickable = (b) => (b.mode ?? '2d') === '2d' && b.status === 'done' && b.count > 0 && !b.picked && !b.rejected;

/**
 * The queue: every batch still to pick, in the prompt documents' order, a world's (or an object's) together: the
 * worlds in the order they first come in the documents, then within one the documents, their entries and variants
 * as written; batches from no document after those of their world, oldest first.
 * Each item: { batch, from, target, prompt, world, title, id, line, state: 'open' }.
 */
export function buildPickQueue(batches, prompts) {
  const idx = promptIndex(prompts);
  const INF = Number.MAX_SAFE_INTEGER;
  const items = batches.filter(pickable).map((b) => {
    const info = idx.get(b.from) ?? null;
    return { batch: b.batch, created: b.created ?? '', from: b.from ?? null, target: b.target ?? null, prompt: b.prompt ?? '', ...describe(b, info), order: info ? [info.docIndex, info.entryIndex, info.variantIndex] : [INF, INF, INF], state: 'open', picked: null };
  });
  const byDoc = (a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2] || String(a.created || a.batch).localeCompare(String(b.created || b.batch));
  const rank = new Map();
  for (const it of [...items].sort(byDoc)) if (!rank.has(it.world)) rank.set(it.world, rank.size);
  return items.sort((a, b) => rank.get(a.world) - rank.get(b.world) || byDoc(a, b));
}

/** The next item to show after `at`: an open one further on, then one before (wrapping), then a skipped one the same way; -1 when all are decided. */
export function nextOpen(queue, at = -1) {
  const n = queue.length;
  for (const want of ['open', 'skipped']) {
    for (let k = 1; k <= n; k++) {
      const i = (((at + k) % n) + n) % n;
      if (queue[i].state === want) return i;
    }
  }
  return -1;
}

/** How far along: { left (open or skipped), total, decided, picked, rejected }. */
export function pickProgress(queue) {
  const c = (s) => queue.filter((q) => q.state === s).length;
  const picked = c('picked'), rejected = c('rejected');
  return { left: queue.length - picked - rejected, total: queue.length, decided: picked + rejected, picked, rejected };
}

/** "12 of 48 to pick" (and how many were picked or turned down here). */
export function progressText(p) {
  if (!p.total) return 'nothing to pick';
  if (!p.left) return `all ${p.total} done · ${p.picked} picked, ${p.rejected} none of them`;
  return `${p.left} of ${p.total} to pick${p.decided ? ` · ${p.picked} picked, ${p.rejected} none of them` : ''}`;
}

/**
 * A Pick-mode session over a queue. `api`: { pick({ batch, candidate, why }), unpick({ batch, candidate }),
 * reject({ batch, why }) } (promises; the dev server's calls on the page, batch.mjs's in the tests). Every move
 * lands on the next item to show (`at`; -1 when everything is decided); Back walks the items shown, newest first.
 */
export class PickSession {
  constructor(queue, api) {
    this.queue = queue; this.api = api; this.history = [];
    this.at = nextOpen(queue, -1);
  }
  get current() { return this.queue[this.at] ?? null; }
  progress() { return pickProgress(this.queue); }
  go(i) { if (this.at >= 0 && i !== this.at) this.history.push(this.at); this.at = i; return this.current; }
  advance() { return this.go(nextOpen(this.queue, this.at)); }
  /** Pick a candidate of the current batch (a pick there before is taken back first: Back then a new pick changes it). */
  async pick(candidate, why = '') {
    const it = this.current;
    if (!it) return null;
    if (it.picked && it.picked !== candidate) { await this.api.unpick({ batch: it.batch, candidate: it.picked }); it.picked = null; it.state = 'open'; }
    if (it.state === 'rejected') { await this.api.reject({ batch: it.batch, why: null }); it.state = 'open'; }
    const r = await this.api.pick({ batch: it.batch, candidate, why });
    it.state = 'picked'; it.picked = candidate; it.result = r;
    this.advance();
    return r;
  }
  /** None of them (why: required by the server; the default stands in when it is empty). */
  async reject(why = '') {
    const it = this.current;
    if (!it) return null;
    if (it.picked) { await this.api.unpick({ batch: it.batch, candidate: it.picked }); it.picked = null; }
    const r = await this.api.reject({ batch: it.batch, why: String(why).trim() || REJECT_WHY });
    it.state = 'rejected';
    this.advance();
    return r;
  }
  skip() {
    const it = this.current;
    if (it && it.state === 'open') it.state = 'skipped';
    return this.advance();
  }
  /** The item shown before this one (to change its pick); with none shown before, the one before in the queue. */
  back() {
    if (this.history.length) { this.at = this.history.pop(); return this.current; }
    if (this.at > 0) this.at -= 1;
    else if (this.at < 0 && this.queue.length) this.at = this.queue.length - 1;
    return this.current;
  }
}

/** How many columns lay n pictures of aspect ar ("16:9") out largest in a w × h box (cap: a caption under each). */
export function bestColumns(n, ar, w, h, { gap = 12, cap = 30 } = {}) {
  const [aw, ah] = String(ar ?? '16:9').split(':').map(Number);
  const a = aw > 0 && ah > 0 ? aw / ah : 16 / 9;
  let best = 1, bestArea = -1;
  for (let cols = 1; cols <= Math.max(1, n); cols++) {
    const rows = Math.ceil(n / cols);
    const cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows - cap;
    if (cw <= 0 || ch <= 0) continue;
    const iw = Math.min(cw, ch * a), area = iw * (iw / a);
    if (area > bestArea + 1) { best = cols; bestArea = area; }
  }
  return best;
}

/** The pictures of a batch Pick mode shows: every candidate not discarded, numbered 1, 2, 3… */
export const shownCandidates = (m) => (m?.candidates ?? []).filter((c) => c.status !== 'discarded');

/** One batch's candidates, side by side: a number to press, the picture (a click picks it), its provider, a zoom corner. */
export function pickGridHtml(m, picked = null) {
  const cands = shownCandidates(m);
  if (!cands.length) return '<p class="pm-empty">No picture left in this batch.</p>';
  return cands.map((c, i) => {
    const p = m.providers?.[c.provider] ?? {};
    const on = c.id === picked || c.status === 'picked';
    return `<figure class="pm-cand${on ? ' on' : ''}" data-pm-cand="${esc(c.id)}" tabindex="0" title="Pick this one (${i + 1})">
      <div class="pm-pic"><img src="${esc(candidateSrc(m.batch, c.file))}" alt="${esc(c.id)}" draggable="false"><span class="pm-num">${i < 9 ? i + 1 : ''}</span><button type="button" class="pm-zbtn" data-pm-zoom="${esc(c.id)}" title="See it alone, full size (Z)">⤢</button>${on ? '<span class="pm-tick">✓ picked</span>' : ''}</div>
      <figcaption><b>${esc(p.label ?? c.label ?? c.provider)}</b> <small>${esc(c.model ?? p.model ?? '')} · #${esc(c.id.split('/').pop())}</small></figcaption>
    </figure>`;
  }).join('');
}

/** The header's words for an item: what is being picked, from where, into where. */
export function pickHeadHtml(it, m = null) {
  if (!it) return '<div class="pm-world">All done</div><div class="pm-title">Every batch in the queue is picked or turned down.</div>';
  const ref = m?.comparison ?? m?.refs?.[0];
  return `<div class="pm-world">${esc(it.world)}</div>
    <div class="pm-title">${esc(it.title)} <small>${esc(it.id)}</small></div>
    <div class="pm-line" title="${esc(it.prompt)}">${esc(it.line)}</div>
    <div class="pm-target">→ ${esc(it.target ?? '(no target folder: the form\'s is used)')}${it.state === 'picked' ? ` <b class="picked">picked: ${esc(it.picked)}</b>` : it.state === 'rejected' ? ' <b class="err">none of them</b>' : it.state === 'skipped' ? ' <i>(skipped before)</i>' : ''}</div>
    ${ref ? `<img class="pm-ref" src="${esc(fileSrc(ref))}" alt="the reference" title="the reference: ${esc(ref)}">` : ''}`;
}
