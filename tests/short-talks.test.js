// Issue #479 (quest QC v1.85, rule 7, short talks): a quest giver's talk is a few pages, the essentials only. Nour's,
// from the open chest to the skull, is the house measure (three nodes, five pages: tests/dialogue-playtest.test.js).
// Edda had 12 pages before the letter, Nima and Ossa 9 before the splinter, with one answer leading on at each node.
// Here every world's quest givers are measured: the fewest pages, through the answers on offer, from a talk's first
// node to the node that gives the quest (it starts it, sets its step, or sets the flag of the talk's own step).
// Lore stays for whoever asks: only the shortest way is held to the limit. A quest's last step (its ending talk) isn't.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';
import { check } from '../src/story/dialogue.js';
import { stripTone } from '../src/story/tone.js';

const DIR = new URL('../src/story/', import.meta.url);
export const MAX_PAGES = 6;      // Nour's limit
const MAX_WORDS = 45;            // a page, as Nour's

const list = (v) => [].concat(v ?? []);
const conditional = (p) => !!(p && typeof p === 'object' && p.if);
/** A node's pages as read: its plain pages, and one for its pages said only on a condition. */
const pagesOf = (n) => { const a = list(n?.say), plain = a.filter((p) => !conditional(p)).length; return plain + (a.length > plain ? 1 : 0); };
const effects = (n) => [...list(n.do), ...list(n.choices).flatMap((c) => list(c.do))].filter(Boolean);

/** The fewest pages from the talk's entry (for `ctx`) to a node `gives` is true of, and the nodes on the way. */
function shortest(person, ctx, gives) {
  const N = person.talk.nodes;
  const from = list(person.talk.entry ?? [{ node: Object.keys(N)[0] }]).find((e) => check(e.if, ctx))?.node;
  if (!N[from]) return null;
  const dist = { [from]: pagesOf(N[from]) }, prev = {}, todo = [from];
  while (todo.length) {
    todo.sort((a, b) => dist[a] - dist[b]);
    const id = todo.shift();
    if (gives(N[id], id)) { const path = [id]; while (prev[path[0]]) path.unshift(prev[path[0]]); return { pages: dist[id], path }; }
    for (const c of list(N[id].choices)) {
      if (!c.goto || !N[c.goto] || !check(c.if, ctx)) continue;
      const d = dist[id] + pagesOf(N[c.goto]);
      if (dist[c.goto] == null || d < dist[c.goto]) { dist[c.goto] = d; prev[c.goto] = id; todo.push(c.goto); }
    }
  }
  return null;
}

async function measure() {
  const out = [];
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('-data.js'))) {
    const m = await import(new URL(f, DIR));
    const people = m.PEOPLE ?? {}, quests = m.QUESTS ?? [];
    const world = (q, stage) => {
      const game = new GameState(null), qs = new Quests({ game });
      for (const d of quests) qs.define(d);
      if (q) qs.start(q.id, stage);
      return { game, quests: qs };
    };
    // a quest's talk steps (all but its last): the talk that does the step
    for (const q of quests) q.stages.slice(0, -1).forEach((s) => {
      const who = s.talk ?? (typeof s.at === 'string' ? s.at : null), p = people[who];
      if (!p?.talk?.nodes) return;
      const gives = (n) => effects(n).some((d) => d.stage?.[0] === q.id || d.advance?.[0] === q.id || d.start === q.id || (s.flag && d.set && s.flag in d.set));
      const r = shortest(p, world(q, s.id), gives);
      if (r) out.push({ f, who, quest: q.id, step: s.id, ...r, N: p.talk.nodes });
    });
    // a talk that starts a quest, met before anything has started
    for (const [who, p] of Object.entries(people)) for (const [id, n] of Object.entries(p.talk?.nodes ?? {})) {
      for (const d of effects(n)) if (d.start) {
        const r = shortest(p, world(null), (_, k) => k === id);
        if (r) out.push({ f, who, quest: d.start, step: '(start)', ...r, N: p.talk.nodes });
      }
    }
  }
  return out;
}

test(`every quest giver gives the quest within ${MAX_PAGES} pages, no page over ${MAX_WORDS} words (issue #479)`, async () => {
  const all = await measure();
  assert.ok(all.length > 30, `${all.length} talks measured`);
  const long = all.filter((t) => t.pages > MAX_PAGES).map((t) => `${t.f} ${t.who} → ${t.quest}:${t.step}: ${t.pages} pages (${t.path.join(' → ')})`);
  assert.deepEqual(long, [], 'talks too long before the quest');
  const wordy = [];
  for (const t of all) for (const id of t.path) for (const p of list(t.N[id].say)) {
    const w = stripTone(p?.text ?? p).split(/\s+/).length;
    if (w > MAX_WORDS) wordy.push(`${t.f} ${t.who}.${id}: ${w} words`);
  }
  assert.deepEqual([...new Set(wordy)], [], 'pages too long on the way to a quest');
});

test('Edda, Nima, Ossa and Wen: five pages or fewer to the quest, Sel six (issue #479)', async () => {
  const all = await measure();
  const of = (who, quest, step) => all.find((t) => t.who === who && t.quest === quest && t.step === step);
  for (const [who, quest, step] of [['edda', 'bazaar.nightmail', 'edda'], ['nima', 'incal.light', 'nima'], ['ossa', 'incal.light', 'ossa'], ['sel', 'bazaar.signal', 'sel'], ['wen', 'buried.tooth', 'wen']]) {
    const t = of(who, quest, step);
    assert.ok(t, `${who} measured`);
    assert.ok(t.pages <= (who === 'sel' ? 6 : 5), `${who}: ${t.pages} pages (${t.path.join(' → ')})`);
  }
});
