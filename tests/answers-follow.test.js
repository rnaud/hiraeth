// Every answer follows from what was just said (the quest QC's rule 5, .claude/skills/quest-qc/SKILL.md; issue #279).
// An answer that names a thing (a proper noun, "the singing") is offered only on a node whose pages, or the pages of a
// node that leads to it, name it. The quest QC v1.66 found three slips in talk written since v1.57 (Anselm's "Come
// aboard, then.", Ilen's "Your answer?", Marrow's "What's that singing out on the sand?" after a page about Qanat's
// fire); this walks every conversation in the story data (src/story/*-data.js, *-people.js) and the temples' locals
// (src/temples/*-data.js).
//
// A name counts as said if the speaker is it, or if it was in the node's pages or in one before. Some answers rightly
// name what the traveller brings from elsewhere: what he found or did, someone met in another world, his own search.
// Those are listed below, each with its reason; a new one needs its reason too, or a page that names the thing first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

const SRC = new URL('../src/', import.meta.url);
const DIRS = [['story', /-(data|people)\.js$/], ['temples', /-data\.js$/]];

/** The traveller's own search, known wherever he goes: the light he follows, and the couple who went before him. */
const HIS_OWN = ['singing light', 'Odile', 'Talo'];

/** `file who.node: word` → why the answer may name it there. */
export const EXCEPTIONS = {
  // what he hears or sees, not what was said
  'desert-data.js marrow.wreck: singing': 'the fragment sings at the cairn by the ship as he steps out: he asks about the sound (issue #279)',
  'desert-data.js marrow.hello: singing': 'the same, at the ship, while the fragment still sings there (issue #279)',
  'perdide-data.js corm.hello: Great Crystal': 'the swamp\'s landmark, over every pool: what he sees',
  'perdide-data.js corm.again: Great Crystal': 'the same',
  // what he did or found, told to the one it matters to
  'bazaar-data.js brush.read: HEARD YOU': 'what the oldest sign said when he woke it: Brush asks',
  'incal-data.js nima.again: Lodestar': 'the mark he saw on the Lodestar, the light Nima tends',
  'night-train-data.js solange.hello: Edda': 'the letter in his hand is Edda\'s',
  'underwater-people.js maelle.lamps: Whale-House': 'the temple he is on his way to',
  'garage-data.js wim.after: Foreman': 'the Clock-House\'s guardian, whom he has just faced',
  'buried-data.js dun.opened: Tooth Day': 'his joke on the tooth he opened for Dun',
  // people of the same world, named by their quests
  'arzach2-data.js calix.hello: Aube': 'what Sister Aube told him at the cloud, brought to her brother',
  'arzach2-data.js ondine.after: Calix': 'Calix rings the bell: the world\'s main quest',
  'edena-data.js sorrel.after: Esk': 'Esk\'s terraces, the garden\'s own quest',
  'desert-data.js nour.again: Givers': 'Nour spoke of the Givers in their first talk ("again")',
  // his own story, told to Ilen
  'lantern-data.js ilen.gone: singing': 'his father, listening for the light: his own memory',
  'lantern-data.js ilen.more: Viridel': 'where he broke the hill of tea: his own confession',
};

const strip = (t) => String(t && typeof t === 'object' ? t.text ?? '' : t ?? '').replace(/^\s*~\w+~\s*/, '');
const pagesOf = (n) => (n?.say ?? []).flatMap((p) => (Array.isArray(p) ? p : [p])).map(strip).join('\n');
const NOT_NAMES = new Set(['I', 'I’ll', 'I’m', 'I’d', 'I’ve', 'OK']);

/** The names an answer uses: capitalised words not starting a sentence (runs kept together: "Great Crystal"), and the singing. */
export function namesIn(text) {
  const t = strip(text).replace(/\([^)]*\)/g, ' ');   // (stage directions: "(sit, and hold on)")
  const out = [];
  const re = /(^|[.!?…:]\s+|[“"(—]\s*)?(\p{Lu}[\p{L}’'-]*(?: \p{Lu}[\p{L}’'-]*)*)/gu;
  for (let m; (m = re.exec(t));) {
    let run = m[2].split(' ');
    if (m[1] !== undefined || m.index === 0) run = run.slice(1);   // (a sentence's first word is no name)
    run = run.map((w) => w.replace(/[’']s$/, '')).filter((w) => !NOT_NAMES.has(w));
    if (run.length) out.push(run.join(' '));
  }
  if (/\bsinging\b/i.test(t)) out.push(/\bsinging light\b/i.test(t) ? 'singing light' : 'singing');
  return out;
}
const said = (word, text) => (word === 'singing' ? /\bsing/i : new RegExp(`(?<!\\p{L})${word.replace(/[’'-]/g, '.')}`, 'iu')).test(text);

/** Every conversation: [file, who, talk] (who: the speaker's id or key, name). */
async function conversations() {
  const out = [];
  for (const [dir, re] of DIRS) for (const f of readdirSync(new URL(`${dir}/`, SRC)).filter((x) => re.test(x))) {
    const m = await import(new URL(`${dir}/${f}`, SRC));
    const seen = new Set();
    const walk = (v, key, owner) => {
      if (!v || typeof v !== 'object' || seen.has(v)) return;
      seen.add(v);
      const me = typeof v.name === 'string' || v.talk ? { id: v.id ?? key, key, name: v.name ?? '' } : owner;
      if (v.nodes && typeof v.nodes === 'object') { out.push([f, me ?? { id: key, key, name: '' }, v]); return; }
      for (const [k, x] of Object.entries(v)) walk(x, k, me);
    };
    for (const [k, v] of Object.entries(m)) walk(v, k, null);
  }
  return out;
}

test('every answer that names a thing follows a page that names it (rule 5, issue #279)', async () => {
  const convs = await conversations();
  assert.ok(convs.length > 150, `${convs.length} conversations`);
  const bad = [], used = new Set();
  let answers = 0;
  for (const [f, who, talk] of convs) {
    const N = talk.nodes, before = {};
    for (const [id, n] of Object.entries(N)) {
      for (const c of n?.choices ?? []) if (c.goto) (before[c.goto] ??= new Set()).add(id);
      if (n?.next) (before[n.next] ??= new Set()).add(id);
    }
    const speaker = [who.name, ...String(who.name).split(' '), who.key, who.id].filter(Boolean).map((s) => String(s).toLowerCase());
    for (const [id, n] of Object.entries(N)) for (const c of n?.choices ?? []) {
      answers++;
      const heard = [pagesOf(n), ...[...(before[id] ?? [])].map((b) => pagesOf(N[b]))].join('\n');
      const missing = namesIn(c.text).filter((w) => !speaker.includes(w.toLowerCase()) && !HIS_OWN.includes(w)
        && !w.split(' ').every((x) => HIS_OWN.includes(x)) && !said(w, heard));
      if (!missing.length) continue;
      const k = `${f} ${who.id}.${id}: ${missing.join(', ')}`;
      if (EXCEPTIONS[k]) used.add(k);
      else bad.push(`${k}  «${strip(c.text)}»`);
    }
  }
  assert.ok(answers > 1200, `${answers} answers`);
  assert.deepEqual(bad, [], 'an answer naming what nobody has just said (say it in the page before, or list it with its reason)');
  assert.deepEqual(Object.keys(EXCEPTIONS).filter((k) => !used.has(k)), [], 'every exception still needed (or off the list)');
});

test('the rule-5 check sees the slips it was written for', () => {
  assert.deepEqual(namesIn('~curious~ What’s that singing out on the sand?'), ['singing']);
  assert.deepEqual(namesIn('~curious~ What do you think the Great Crystal is?'), ['Great Crystal']);
  assert.deepEqual(namesIn('~neutral~ I’ll take it to her.'), []);
  assert.deepEqual(namesIn('~neutral~ Thanks, Marrow.'), ['Marrow']);
  assert.ok(!said('singing', 'Power? Your ship isn’t broken. Nothing but *Qanat*.'), 'Qanat\'s fire says nothing of the singing');
  assert.ok(said('Edda', 'A letter from Edda’s hand.'));
});
