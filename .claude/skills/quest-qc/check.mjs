// The quest QC's measurable checks (.claude/skills/quest-qc/SKILL.md): every quest in the story data, step by step,
// with what can be counted flagged (⚑); then the temples' steps (src/temples/*-data.js QUEST: find, gadget, use,
// keeper) and the makers' boxes' hints (src/boxes/placements.js), each a one-step quest, with the flags that apply to
// a line (long step, keys, ask-someone; issue #279). It only imports the data, as the tests do; it never runs the game.
//
//   node .claude/skills/quest-qc/check.mjs [--worlds desert,incal] [--all]
//
// Flags:
//   long step      a step's text over WORDS words (the author: "every quest hint should be a few words")
//   keys           a step that names buttons ({key:…}): the controls are taught where they are first needed
//   hand-off       a talk step to one person right after a talk step to another (one person sending you to the next)
//   ask-someone    a step whose words send you to a person ("Ask X", "Tell X", "Find X, who…") that isn't the last
//   can't skip     a step with no goal the game can see done (no flag, when, goto, talk or bring): going past it never counts
//   gate?          a step whose flag is an item (item.*) with no gate (nor ahead: false): later steps may pass it without the item
//   look only      a step whose flag only a thing's page sets (its look prompt, E there) and whose words don't name the
//                  thing: reaching the place does nothing, and the marker stays (issue #349: "Climb to the crown" done
//                  only by reading the note on the post)
//
//   --walk         and walk every marker in the game (marker-walk.mjs, as tests/marker-walk.test.js does): a marker
//                  that points back at a place reached (the riders' gate on the way to Aube), a door whose way on is
//                  straight back out or another room's door (issue #351), a step finished only by a prompt it doesn't name
import { readdirSync, readFileSync } from 'node:fs';
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
// the flags things' pages set (`do: { set }` in a THINGS talk), and the flags the game's code sets itself
const STOPS = new Set(['the', 'from', 'with', 'into', 'onto', 'over', 'under', 'your', 'their', 'that', 'this', 'what', 'then', 'back', 'down', 'there', 'here', 'little', 'old', 'its']);
const stems = (t) => new Set((String(t).toLowerCase().match(/[\p{L}]+/gu) ?? []).filter((w) => w.length >= 4 && !STOPS.has(w)).map((w) => w.slice(0, 4)));
const setsOf = (x, out = new Set()) => { if (x && typeof x === 'object') { if (x.set && typeof x.set === 'object') Object.keys(x.set).forEach((k) => out.add(k)); Object.values(x).forEach((v) => setsOf(v, out)); } return out; };
const dataFiles = readdirSync(dir).filter((x) => /-(data|people)\.js$/.test(x));
const thingSets = new Map();
for (const f of dataFiles) for (const t of Object.values((await import(pathToFileURL(join(dir, f)))).THINGS ?? {})) for (const k of setsOf(t.talk)) thingSets.set(k, t);
const code = readdirSync(join(ROOT, 'src'), { recursive: true }).filter((x) => x.endsWith('.js') && !dataFiles.some((d) => x.endsWith(d))).map((x) => readFileSync(join(ROOT, 'src', x), 'utf8')).join('\n');
const codeSets = (flag) => code.includes(`set('${flag}'`) || code.includes(`'${flag}': true`);
for (const f of dataFiles) {
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
      if (!s.flag && !s.when && !s.goto && !s.talk && !s.bring) fl.push('can’t skip');   // (talk and bring steps are done by doing them: docs/systems/story.md)
      if (s.flag?.startsWith('item.') && !s.gate && s.ahead !== false && i < q.stages.length - 1) fl.push('gate?');
      const thing = s.flag && thingSets.get(s.flag);
      if (thing && !codeSets(s.flag) && ![...stems(thing.name)].some((w) => stems(s.text).has(w)) && !/\b(look|read|listen|watch|hear|touch|lay)\b/i.test(s.text)) fl.push(`look only (${thing.name})`);
      n++;
      if (fl.length) flagged++;
      if (fl.length || all) lines.push(`  ${s.id.padEnd(10)} ${s.text}${fl.length ? `  ⚑ ${fl.join(', ')}` : ''}`);
    });
    if (lines.length) console.log(`\n${q.id}${q.main ? ' (main)' : ''}  ${f}\n${lines.join('\n')}`);
  }
}

// ------------------------------------------------------------------ the temples' steps and the boxes' hints
/** The flags that read a line alone: long, keys, ask-someone (a step that sends you to a person, not its quest's last). */
const lineFlags = (text, last) => {
  const fl = [];
  if (words(text) > WORDS) fl.push(`long step (${words(text)} words)`);
  if (/\{key:/.test(text)) fl.push('keys');
  if (ASK.test(text) && !last && /^(Ask|Tell|Talk|Speak)/.test(text)) fl.push('ask-someone');
  return fl;
};
const report = (title, steps) => {
  const lines = [];
  steps.forEach(([id, text], i) => {
    const fl = lineFlags(text, i === steps.length - 1);
    n++;
    if (fl.length) flagged++;
    if (fl.length || all) lines.push(`  ${id.padEnd(10)} ${text}${fl.length ? `  ⚑ ${fl.join(', ')}` : ''}`);
  });
  if (lines.length) console.log(`\n${title}\n${lines.join('\n')}`);
};
const tdir = join(ROOT, 'src/temples');
let temples = 0, boxes = 0;
const story = n;
for (const f of readdirSync(tdir).filter((x) => /-data\.js$/.test(x))) {
  const { QUEST: q } = await import(pathToFileURL(join(tdir, f)));
  if (!q || (only && !only.has(q.world))) continue;
  temples++;
  const steps = [['find', q.find], ['gadget', q.gadget], q.use && ['use', q.use.text ?? q.use], ['keeper', q.keeper]].filter((s) => s && s[1]);
  report(`${q.id}${q.main ? ' (main)' : ''}  temples/${f}`, steps);
}
const { PLACEMENTS } = await import(pathToFileURL(join(ROOT, 'src/boxes/placements.js')));
for (const [world, list] of Object.entries(PLACEMENTS)) {
  if (only && !only.has(world)) continue;
  for (const b of list) if (b.hint) { boxes++; report(`box.${b.id}  boxes/placements.js`, [['find', b.hint]]); }
}
console.log(`\n${n} steps (${story} in the story, ${n - story - boxes} in ${temples} temples, ${boxes} boxes’ hints), ${flagged} flagged`);

if (process.argv.includes('--walk')) {
  process.chdir(ROOT);
  const { walkMarkers } = await import('./marker-walk.mjs');
  const found = walkMarkers(only ? [...only] : null);
  console.log(`\nthe markers walked: ${found.length ? '' : 'nothing loops'}`);
  for (const f of found) console.log(`  ${f.world} ${f.at}  ⚑ ${f.kind}: ${f.text}`);
  process.exit(0);
}
