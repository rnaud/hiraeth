// The hints at the top of the screen are one short line (issue #221: "too wide, too verbose"): every teaching
// and hint line, both words of every quietOr, the foes' first-meeting notes and the worlds' arrival words.
// Measured as the player sees them: a {key:verb} / {aim} placeholder counts as 3 letters (a button's name),
// a line's tone ('~sad~ ') not at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// (the source through its literal catalogue, checked against the directory: tests/src-tree.js, tests/test-catalogs.test.js)
import { srcPaths, srcText } from './src-tree.js';
import { EN } from '../src/i18n/en.js';
import { CONTENT } from '../src/levels/content.js';
import { ARCHETYPE_NOTES } from '../src/enemies/archetypes.js';
import { NOTES } from '../src/foe-kinds.js';

/** A hint line's limits: letters as seen, and sentences. */
const HINT_MAX = 72, HINT_SENTENCES = 2;
/** A world's arrival toast: its opening words alone (src/quest.js showPage), two short lines at most. */
const INTRO_MAX = 112;
/** UI labels among the hint keys, not hint lines. */
const LABELS = new Set(['hint.photo', 'hint.close', 'hint.toClose']);
const FILLER = /\b(you can now|remember that|don't forget|note that)\b/i;

const seen = (s) => String(s).replace(/^~[a-z]+~\s*/, '').replace(/\{[^{}]*\}/g, 'xxx');
const sentences = (s) => seen(s).trim().split(/(?<=[.!?…])\s+/).filter(Boolean).length;
const problems = (where, s) => {
  const out = [], n = seen(s).length;
  if (n > HINT_MAX) out.push(`${where}: ${n} letters (at most ${HINT_MAX}): ${s}`);
  if (sentences(s) > HINT_SENTENCES) out.push(`${where}: ${sentences(s)} sentences: ${s}`);
  if (FILLER.test(s)) out.push(`${where}: filler: ${s}`);
  return out;
};

test('every teaching and hint line is one short line', () => {
  const keys = Object.keys(EN).filter((k) => /^(teach|hint)\./.test(k) && !LABELS.has(k));
  assert.ok(keys.length > 20, `the hint keys are found (${keys.length})`);
  assert.deepEqual(keys.flatMap((k) => problems(k, EN[k])), []);
});

test('the first-meeting note of every foe is one short line', () => {
  const notes = { ...NOTES, ...ARCHETYPE_NOTES };
  assert.ok(Object.keys(ARCHETYPE_NOTES).length > 10);
  assert.deepEqual(Object.entries(notes).flatMap(([k, s]) => problems(`note ${k}`, s)), []);
});

test(`every world's arrival words fit one toast (at most ${INTRO_MAX} letters)`, () => {
  const long = [];
  let n = 0;
  for (const [id, c] of Object.entries(CONTENT)) {
    const s = c?.story;
    if (!s?.intro) continue;
    n++;
    const line = s.intro;
    if (line.length > INTRO_MAX) long.push(`${id}: ${line.length}: ${line}`);
  }
  assert.ok(n > 20, `the stories are found (${n})`);
  assert.deepEqual(long, []);
});

// quietOr(quiet, plain) in the source (src/hint-level.js): both lines, when each is a plain string literal, or a
// template whose only parts are ${tr('key')} (filled from the English table). Anything else is skipped.
const LIT = String.raw`'(?:[^'\\\n]|\\.)*'|` + '`(?:[^`\\\\]|\\\\.)*`';
const CALL = new RegExp(String.raw`\bquietOr\(\s*(${LIT})\s*,\s*(${LIT})\s*[,)]`, 'g');
const literal = (q) => {
  const body = q.slice(1, -1);
  if (q[0] === "'") return body.replace(/\\(.)/g, '$1');
  const out = body.replace(/\$\{tr\('([^']+)'\)\}/g, (_, k) => EN[k] ?? '${?}');
  return out.includes('${') ? null : out;
};

test('both lines of every quietOr are one short line', () => {
  const bad = [];
  let n = 0;
  for (const f of srcPaths(/\.js$/)) {
    if (f.endsWith('hint-level.js')) continue;   // (its own examples)
    const src = srcText(f);
    for (const m of src.matchAll(CALL)) {
      const at = `${f.slice('src/'.length)}:${src.slice(0, m.index).split('\n').length}`;
      for (const [which, q] of [['quiet', m[1]], ['plain', m[2]]]) {
        const s = literal(q);
        if (s == null) continue;
        n++;
        bad.push(...problems(`${at} ${which}`, s));
      }
    }
  }
  assert.ok(n > 40, `the quietOr lines are found (${n})`);
  assert.deepEqual(bad, []);
});
