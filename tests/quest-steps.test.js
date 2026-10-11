import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
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
    const { QUEST } = await import(new URL(`temples/${f}`, SRC));
    if (!QUEST) continue;
    for (const k of ['find', 'gadget', 'keeper']) if (QUEST[k]) assert.ok(words(QUEST[k]) <= MAX, `${f} ${k}: “${QUEST[k]}”`);
    if (QUEST.use?.text) assert.ok(words(QUEST.use.text) <= MAX, `${f} use: “${QUEST.use.text}”`);
  }
  for (const p of Object.values(PLACEMENTS).flat()) if (p.hint) assert.ok(words(p.hint) <= MAX, `${p.id}: “${p.hint}”`);
});

// "No talk-to-X hand-offs: hints name a place or an action" (the author's standing rules; the v1.49 audit, issue #118):
// no step tells you to ask, talk to, meet, see or find a person, or to go down to one. The world's opening talk is said
// as "Hear X out at <place>" (a verb and a place); a step that brings or gives something to someone names the thing.
const PERSON_VERB = /^(Ask|Talk to|Speak (?:to|with)|Go and (?:see|ask)|Meet|See|Find|Visit|Go (?:back )?(?:down |up )?to)\s+(.+)/;
async function storyData() {
  const out = [];
  for (const f of readdirSync(new URL('story/', SRC)).filter((x) => /-(data|people)\.js$/.test(x))) out.push([f, await import(new URL(`story/${f}`, SRC))]);
  return out;
}
/** Every person's name in the story data (Sister Aube, Brother Calix, Madame Sel, Wen…). */
function people(mods) {
  const names = new Set();
  const look = (v) => { if (v && typeof v === 'object' && typeof v.name === 'string' && v.talk && /^\p{Lu}[\p{L}-]*( \p{Lu}[\p{L}-]*)*$/u.test(v.name)) names.add(v.name); };   // (a person's name; not a thing's, “Teo’s drum”)
  for (const [, m] of mods) for (const v of Object.values(m)) {
    if (Array.isArray(v)) v.forEach(look);
    else if (v && typeof v === 'object') { look(v); for (const w of Object.values(v)) look(w); }
  }
  return [...names];
}
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('no quest step sends you to a person: no “Ask Hask”, “Find Brother Calix”, “Talk to Linnet” (issue #118)', async () => {
  const mods = await storyData(), names = people(mods);
  assert.ok(names.length > 60 && names.includes('Brother Calix') && names.includes('Wen'), `${names.length} people`);
  const bad = [];
  for (const [f, m] of mods) for (const q of m.QUESTS ?? []) for (const s of q.stages) {
    const hit = PERSON_VERB.exec(s.text);
    if (!hit) continue;
    const person = names.some((n) => new RegExp(`^(the )?${escape(n)}(?![’'\\p{L}])`, 'u').test(hit[2]));
    if (/^(Ask|Talk to|Speak|Go and)/.test(hit[1]) || person) bad.push(`${f} ${q.id}.${s.id}: “${s.text}”`);
  }
  assert.deepEqual(bad, []);
});

test('no line ends by sending you on: no “Ask her.”, no “go and ask X” (issue #118)', () => {
  const files = [
    ...readdirSync(new URL('story/', SRC)).filter((x) => /-(data|people)\.js$/.test(x)).map((x) => `story/${x}`),
    ...readdirSync(new URL('temples/', SRC)).filter((x) => /-data\.js$/.test(x)).map((x) => `temples/${x}`),
  ];
  const bad = [];
  for (const f of files) {
    for (const [i, line] of readFileSync(new URL(f, SRC), 'utf8').split('\n').entries()) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;   // (comments)
      if (/\b[Aa]sk (her|him|them)\b|\b[Gg]o (and )?(ask|talk to|see) [A-Z]/.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(bad, []);
});
