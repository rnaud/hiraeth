// The quest QC's measurable checks (.claude/skills/quest-qc/SKILL.md): every quest in the story data, step by step,
// with what can be counted flagged (⚑). It only imports the data, as the tests do; it never runs the game.
//
//   node .claude/skills/quest-qc/check.mjs [--worlds desert,incal] [--all]
//
// Flags:
//   long step      a step's text over WORDS words (the author: "every quest hint should be a few words")
//   keys           a step that names buttons ({key:…}): the controls are taught where they are first needed
//   hand-off       a talk step to one person right after a talk step to another (one person sending you to the next)
//   ask-someone    a step whose words send you to a person ("Ask X", "Tell X", "Find X, who…") that isn't the last
//   can't skip     a step with no goal the game can see done (no flag, no when): going straight past it never counts
//   gate?          a step whose flag is an item (item.*) with no gate: later steps may pass it without the item
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const only = (() => { const i = process.argv.indexOf('--worlds'); return i > 0 ? new Set(process.argv[i + 1].split(',')) : null; })();
const all = process.argv.includes('--all');
const WORDS = 9;
const words = (s) => (String(s).match(/[\p{L}\p{N}’'-]+/gu) ?? []).length;
const ASK = /^(Ask|Tell|Talk to|Speak with|Find|Go and see|Go down to|Meet)\b/;

const dir = join(ROOT, 'src/story');
let n = 0, flagged = 0;
for (const f of readdirSync(dir).filter((x) => /-(data|people)\.js$/.test(x))) {
  const m = await import(pathToFileURL(join(dir, f)));
  for (const q of m.QUESTS ?? []) {
    if (only && !only.has(q.world)) continue;
    const lines = [];
    q.stages.forEach((s, i) => {
      const fl = [];
      if (words(s.text) > WORDS) fl.push(`long step (${words(s.text)} words)`);
      if (/\{key:/.test(s.text)) fl.push('keys');
      const prev = q.stages[i - 1];
      if (s.talk && prev?.talk && prev.talk !== s.talk) fl.push(`hand-off (${prev.talk} → ${s.talk})`);
      if (ASK.test(s.text) && i < q.stages.length - 1 && (s.talk || /^(Ask|Tell|Talk|Speak)/.test(s.text))) fl.push('ask-someone');
      if (!s.flag && !s.when && !s.goto) fl.push('can’t skip');
      if (s.flag?.startsWith('item.') && !s.gate && i < q.stages.length - 1) fl.push('gate?');
      n++;
      if (fl.length) flagged++;
      if (fl.length || all) lines.push(`  ${s.id.padEnd(10)} ${s.text}${fl.length ? `  ⚑ ${fl.join(', ')}` : ''}`);
    });
    if (lines.length) console.log(`\n${q.id}${q.main ? ' (main)' : ''}  ${f}\n${lines.join('\n')}`);
  }
}
console.log(`\n${n} steps, ${flagged} flagged`);
