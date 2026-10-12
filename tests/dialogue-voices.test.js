// The dialogue review's measurable findings, kept fixed (docs/audits/dialogue-v1.57.md, issue #202):
// - nobody opens a conversation on their own name ("Hask. I tend the Wick…"): the panel already shows it, and
//   thirty-two first lines alike were the template one level below the cameos' (the v1.53 review, finding 1);
// - the traveller never ends a talk on a bare "Goodbye, X." (B / Esc already closes it): his exit answers what
//   was just said, or carries a gesture (139 of them in v1.53, finding 4).
// It walks every conversation in the story data, the makers' houses' guides and the levels' own people, as
// tests/dialogue-choices.test.js does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { parseLine } from '../src/story/tone.js';

const SRC = new URL('../src/', import.meta.url);
const { CONTENT } = await import('../src/levels/content.js');

const SEEN = new Set();
/** Every person with a conversation under a value: [where, person-ish ({ name, talk })]. */
function people(v, where, out = []) {
  if (v == null || typeof v !== 'object' || SEEN.has(v)) return out;
  SEEN.add(v);
  const talk = v.talk ?? v;
  if (talk?.nodes && typeof talk.nodes === 'object' && Object.values(talk.nodes).some((n) => n && ('say' in n || 'choices' in n))) {
    if (!SEEN.has(talk)) { SEEN.add(talk); out.push([where, { name: v.name ?? null, talk }]); }
    return out;
  }
  for (const [k, x] of Object.entries(v)) if (!['if', 'after', 'do', 'set', 'palette'].includes(k)) people(x, `${where}.${k}`, out);
  return out;
}

const ALL = [];
for (const dir of ['story', 'temples']) {
  for (const f of readdirSync(new URL(`${dir}/`, SRC)).filter((x) => x.endsWith('-data.js'))) {
    const m = await import(new URL(`${dir}/${f}`, SRC));
    for (const [k, v] of Object.entries(m)) if (!['QUESTS', 'ITEMS'].includes(k)) people(v, `${dir}/${f}:${k}`, ALL);
  }
}
for (const [id, c] of Object.entries(CONTENT)) people(c.npcs, `content.${id}`, ALL);

const text = (p) => parseLine(typeof p === 'object' && p ? (p.text ?? '') : p ?? '').text;
// (every way a talk opens: its entries' nodes, the ones behind a condition too, a first meeting's, v1.61 #229; or its first node)
const firstPages = (talk) => {
  const firsts = (talk.entry ?? []).map((e) => talk.nodes[e?.node]).filter(Boolean);
  return (firsts.length ? firsts : [Object.values(talk.nodes)[0]]).map((n) => [n?.say].flat().map(text).filter(Boolean));
};
// a name and a trade announced in the first lines: "I study light: Orrin Thrum, at your service" (the scientist's, until v1.61)
// (a name dropped in mid-moment, "Sit down. I’m Ama.", is how the v1.57 rewrite opens; a trade and a name announced is not)
const introduces = (line, name) => [name, name.split(' ')[0]].some((n) => new RegExp(`\\b(I study|I am a|I’m a|I'm a) [^.!?]*: ${n}\\b|${n}, at your service`).test(line));

// the desert's own drummer keeps his (the review: "Teo. Drummer. Currently providing only the first half of the
// service." earns it); the Hangar's quartermaster went with his world (src/shop.js: dismissed, not counted)
const OWN_NAME_KEPT = new Set(['Teo', 'Odo']);

test('nobody opens a conversation on their own name (the panel shows it)', () => {
  const bad = [];
  let n = 0;
  for (const [where, p] of ALL) {
    if (!p.name || OWN_NAME_KEPT.has(p.name) || /^(The|A|An) /.test(p.name)) continue;   // (things you look at name themselves)
    const name = p.name.replace(/^(Madame|Mother|Sister|Brother|Aunt) /, '');
    for (const pages of firstPages(p.talk)) {
      for (const page of pages.slice(0, 1)) {
        n++;
        const opening = page.replace(/^\([^)]*\)\s*/, '');
        if (new RegExp(`^(I’m |I'm )?${name}[.,]`).test(opening)) bad.push(`${where} (${p.name}): ${page.slice(0, 60)}`);
      }
      // (nor introduces themselves in the lines after: the scientist's "I study light: Orrin Thrum, at your service", v1.61)
      const own = pages.slice(0, 3).find((l) => introduces(l, name));
      if (own) bad.push(`${where} (${p.name}) introduces themselves: ${own.slice(0, 60)}`);
    }
  }
  assert.ok(n > 100, `${n} first pages read`);
  assert.deepEqual(bad, []);
});

test('the traveller never leaves on a bare goodbye: his last word answers what was said', () => {
  const BARE = /^(good)?bye\b|^see you\b|^farewell\b|^walk on\b/i;
  const bad = [];
  let n = 0;
  for (const [where, p] of ALL) {
    for (const [id, node] of Object.entries(p.talk.nodes)) {
      for (const c of node?.choices ?? []) {
        if (!c.end) continue;
        n++;
        const t = text(c.text);
        if (BARE.test(t) && t.split(/\s+/).length <= 3) bad.push(`${where} ${id}: “${t}”`);
      }
    }
  }
  assert.ok(n > 300, `${n} closing answers read`);
  assert.deepEqual(bad, []);
});
