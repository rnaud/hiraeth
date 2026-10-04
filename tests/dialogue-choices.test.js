// No conversation ever offers more than three answers at once, and most offer
// one or two. This walks every dialogue tree in the game (the people, locals
// and things in src/story/*-data.js and the levels' own people) and, for each
// node, tries every combination of the conditions its choices depend on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { check } from '../src/story/dialogue.js';

const SRC = new URL('../src/', import.meta.url);
const DATA = readdirSync(new URL('story/', SRC)).filter((f) => f.endsWith('-data.js'));
const { CONTENT } = await import('../src/levels/content.js');

/** Every talk tree under a value: [where, talk]. */
const SEEN = new Set();   // a tree shared by two lists (a level's people reuse the data's) counts once
function trees(v, where, out = [], seen = SEEN) {
  if (v == null || typeof v !== 'object' || seen.has(v)) return out;
  seen.add(v);
  if (v.nodes && typeof v.nodes === 'object' && Object.values(v.nodes).some((n) => n && ('say' in n || 'choices' in n))) { out.push([where, v]); return out; }
  for (const [k, x] of Object.entries(v)) trees(x, `${where}.${k}`, out, seen);
  return out;
}

const QUEST_STAGES = new Map();
const ALL = [];
for (const f of DATA) {
  const m = await import(new URL(`story/${f}`, SRC));
  for (const q of m.QUESTS ?? []) QUEST_STAGES.set(q.id, q.stages.map((s) => s.id));
  for (const [k, v] of Object.entries(m)) if (k !== 'QUESTS') trees(v, `${f}:${k}`, ALL);
}
for (const [id, c] of Object.entries(CONTENT)) trees(c.npcs, `content.${id}`, ALL);

/** The atoms a condition reads, each with the values worth trying: flags, items, quest stages, opaque functions. */
function atoms(cond, out) {
  if (cond == null) return out;
  if (typeof cond === 'function') { out.set(cond, [false, true]); return out; }
  if (Array.isArray(cond)) { cond.forEach((c) => atoms(c, out)); return out; }
  if (cond.all) return atoms(cond.all, out);
  if (cond.any) return atoms(cond.any, out);
  if (cond.not) return atoms(cond.not, out);
  if (cond.has) { out.set(`has:${cond.has}`, [false, true]); return out; }
  if (cond.flag) {
    const k = `flag:${cond.flag}`, vals = out.get(k) ?? [undefined, true];
    if ('is' in cond && !vals.includes(cond.is)) vals.push(cond.is);
    out.set(k, vals);
    return out;
  }
  if (cond.quest) {
    const k = `quest:${cond.quest}`, vals = out.get(k) ?? [undefined, ...(QUEST_STAGES.get(cond.quest) ?? []), 'done'];
    for (const s of [cond.stage, cond.reached].flat()) if (s && !vals.includes(s)) vals.push(s);
    out.set(k, vals);
  }
  return out;
}

/** A game and quest log where each atom holds one value. */
function ctxOf(assign) {
  const flags = new Map(), items = new Set(), stages = new Map();
  for (const [k, v] of assign) {
    if (typeof k === 'function') continue;
    if (k.startsWith('flag:')) flags.set(k.slice(5), v);
    else if (k.startsWith('has:')) { if (v) items.add(k.slice(4)); }
    else stages.set(k.slice(6), v);
  }
  const quests = {
    stage: (q) => stages.get(q),
    has: (i) => items.has(i),
    isStarted: (q) => stages.get(q) !== undefined,
    isDone: (q) => stages.get(q) === 'done',
    isActive: (q) => stages.get(q) !== undefined && stages.get(q) !== 'done',
    reached: (q, s) => {
      const at = stages.get(q), list = QUEST_STAGES.get(q) ?? [];
      if (at === undefined) return false;
      return at === 'done' || (list.indexOf(s) >= 0 && list.indexOf(at) >= list.indexOf(s));
    },
  };
  return { game: { flag: (f) => flags.get(f) }, quests };
}

/** check(), except that an opaque (function) condition takes the value assigned to it. */
function holds(cond, ctx, assign) {
  if (typeof cond === 'function') return assign.get(cond);
  if (Array.isArray(cond)) return cond.every((c) => holds(c, ctx, assign));
  if (cond?.all) return cond.all.every((c) => holds(c, ctx, assign));
  if (cond?.any) return cond.any.some((c) => holds(c, ctx, assign));
  if (cond?.not) return !holds(cond.not, ctx, assign);
  return check(cond, ctx);
}

/** The most answers a node can show at once (a plain end shows "(leave)"; a `next` with none shows nothing). */
export function maxVisible(node) {
  const list = node.choices ?? [];
  if (!list.length) return node.next ? 0 : 1;
  const a = new Map();
  for (const c of list) atoms(c.if, a);
  const keys = [...a.keys()];
  let best = 0, combos = 0;
  const walk = (i, assign) => {
    if (i === keys.length) {
      combos++;
      const ctx = ctxOf(assign);
      let n = list.filter((c) => holds(c.if, ctx, assign)).length;
      if (!n && !node.next) n = 1;
      best = Math.max(best, n);
      return;
    }
    for (const v of a.get(keys[i])) { assign.set(keys[i], v); walk(i + 1, assign); }
    assign.delete(keys[i]);
  };
  walk(0, new Map());
  assert.ok(combos < 500000, 'too many combinations');
  return best;
}

const COUNTS = [];
for (const [where, talk] of ALL) for (const [id, node] of Object.entries(talk.nodes)) COUNTS.push({ at: `${where}.${id}`, n: maxVisible(node) });

test('dialogue: the walk finds the game’s conversations', () => {
  assert.ok(ALL.length > 60, `${ALL.length} trees`);
  assert.ok(COUNTS.length > 300, `${COUNTS.length} nodes`);
});

test('dialogue: the walk sees conditions that exclude each other', () => {
  const q = [...QUEST_STAGES.keys()][0], [s1, s2] = QUEST_STAGES.get(q);
  assert.equal(maxVisible({ choices: [{ text: 'a', if: { quest: q, stage: s1 } }, { text: 'b', if: { quest: q, stage: s2 } }, { text: 'c', end: true }] }), 2);
  assert.equal(maxVisible({ choices: [{ text: 'a', if: { flag: 'x' } }, { text: 'b', if: { not: { flag: 'x' } } }] }), 1);
  assert.equal(maxVisible({ choices: [{ text: 'a', if: { flag: 'x' } }, { text: 'b', if: { flag: 'y' } }, { text: 'c' }, { text: 'd' }] }), 4);
  assert.equal(maxVisible({ choices: [{ text: 'a', if: () => false }, { text: 'b' }] }), 2, 'a function may hold');
  assert.equal(maxVisible({ say: 'x' }), 1);
  assert.equal(maxVisible({ say: 'x', next: 'y' }), 0);
});

test('dialogue: trimming the answers left no node stranded (every node is an entry, a goto or a next)', () => {
  const lost = [];
  for (const [where, talk] of ALL) {
    const ids = Object.keys(talk.nodes), seen = new Set(), todo = [...(talk.entry ?? []).map((e) => e.node), ids[0]];
    while (todo.length) {
      const id = todo.pop();
      if (seen.has(id) || !talk.nodes[id]) continue;
      seen.add(id);
      const n = talk.nodes[id];
      if (n.next) todo.push(n.next);
      for (const c of n.choices ?? []) if (c.goto) todo.push(c.goto);
    }
    for (const id of ids) if (!seen.has(id)) lost.push(`${where}.${id}`);
  }
  assert.deepEqual(lost, []);
});

test('dialogue: never more than three answers at once, and two or fewer on average', () => {
  const shown = COUNTS.filter((c) => c.n > 0);
  const hist = {};
  for (const c of shown) hist[c.n] = (hist[c.n] ?? 0) + 1;
  const avg = shown.reduce((s, c) => s + c.n, 0) / shown.length;
  if (process.env.CHOICES) console.log(JSON.stringify({ trees: ALL.length, nodes: shown.length, hist, avg: +avg.toFixed(3) }), '\n' + COUNTS.filter((c) => c.n > (+process.env.CHOICES || 3)).map((c) => `${c.n} ${c.at}`).join('\n'));
  assert.deepEqual(COUNTS.filter((c) => c.n > 3).map((c) => `${c.at}: ${c.n}`), []);
  assert.ok(avg <= 2, `average ${avg.toFixed(2)}`);
  assert.ok(shown.filter((c) => c.n <= 2).length / shown.length >= 0.95, 'nearly every node offers one or two; three is for the few real decisions');
});
