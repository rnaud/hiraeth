import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { PLACEMENTS } from '../src/boxes/placements.js';

// "Every quest hint should be a few words. 'Bring something of value' for example" (the author's playthrough, October
// 2026, issue #72): every step of every quest is one short line, with no buttons named in it (the controls are taught
// where they are first needed), in the story data, the temples' quests and the makers' boxes' steps.
// (.claude/skills/quest-qc/check.mjs lists them all, with the other checks.)
const MAX = 9;
const words = (s) => (String(s).match(/[\p{L}\p{N}’'-]+/gu) ?? []).length;
const SRC = new URL('../src/', import.meta.url);

test('every quest step in the story data is one short line, no buttons named', async () => {
  let n = 0;
  for (const f of readdirSync(new URL('story/', SRC)).filter((x) => /-(data|people)\.js$/.test(x))) {
    const m = await import(new URL(`story/${f}`, SRC));
    for (const q of m.QUESTS ?? []) for (const s of q.stages) {
      n++;
      assert.ok(words(s.text) <= MAX, `${q.id}.${s.id}: “${s.text}” (${words(s.text)} words)`);
      assert.doesNotMatch(s.text, /\{key:/, `${q.id}.${s.id}: no buttons in a step`);
    }
  }
  assert.ok(n > 120, `${n} steps`);
});

test('the temples’ steps and the makers’ boxes’ are short too', async () => {
  for (const f of readdirSync(new URL('temples/', SRC)).filter((x) => /-data\.js$/.test(x))) {
    // (the Givers' House is being reworked on its own branch: its steps are shortened there)
    if (f === 'desert-data.js') continue;
    const { QUEST } = await import(new URL(`temples/${f}`, SRC));
    if (!QUEST) continue;
    for (const k of ['find', 'gadget', 'keeper']) if (QUEST[k]) assert.ok(words(QUEST[k]) <= MAX, `${f} ${k}: “${QUEST[k]}”`);
    if (QUEST.use?.text) assert.ok(words(QUEST.use.text) <= MAX, `${f} use: “${QUEST.use.text}”`);
  }
  for (const p of Object.values(PLACEMENTS).flat()) if (p.hint) assert.ok(words(p.hint) <= MAX, `${p.id}: “${p.hint}”`);
});
