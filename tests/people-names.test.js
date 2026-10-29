// One name, one person (issue #229, the game audit v1.59): the scientist of the fragments was named Orrin, the name of
// the father's neighbours, and the Floating city's anchor-minder Odile, the name of Viridel's lost traveller. Every
// person you meet (the people book, src/story/people-book.js, and every world's people, src/levels/content.js) has a name
// no one else has, and none takes a name the story gives someone you never meet (docs/story-bible.md).
// One id, one person (issue #251): Lorn's cave-mouth Bram and the Floating city's capstan man shared the id 'bram' (and
// the desert's Pell's 'pell' was Hobb's and Aldo's too), so meeting one marked the other met. An id names one person in
// every world: one name, one title, one home world (a traveller, `world` naming their home, keeps their own).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// (src/ directories through their literal catalogues, checked against the directories: tests/test-catalogs.test.js)
import * as storyData from './catalogs/story-data-modules.js';
import * as templeData from './catalogs/temples-data-modules.js';
const DATA = { story: storyData, temples: templeData };

await import('./register-gadgets.js');
const { EVERYONE } = await import('../src/story/people-book.js');
const { CONTENT } = await import('../src/levels/content.js');

const BIBLE = readFileSync(new URL('../docs/story-bible.md', import.meta.url), 'utf8');
// the people of the story you never meet, by name: they are told of (a log, a grave, a call home)
const TOLD_OF = {
  Odile: 'Viridel: Odile and Talo, whose ship fell; their stones on the Lantern’s point',
  Talo: 'Viridel: Odile and Talo',
  Orrin: 'home: the Orrins, the father’s neighbours who never came to dig out the well, and the Orrin boy',
};
const first = (name) => name.replace(/^(Madame|Mother|Sister|Brother|Aunt|The) /, '').split(' ')[0];

test('the people told of are in the story bible, and nobody you meet has their names', () => {
  for (const n of Object.keys(TOLD_OF)) assert.match(BIBLE, new RegExp(`\\b${n}`), `${n} is in docs/story-bible.md`);
  const bad = [];
  for (const p of EVERYONE) if (TOLD_OF[first(p.name)]) bad.push(`${p.world}: ${p.name} (${TOLD_OF[first(p.name)]})`);
  for (const [w, c] of Object.entries(CONTENT)) for (const n of c?.npcs ?? []) if (n.name && TOLD_OF[first(n.name)]) bad.push(`${w}: ${n.name} (${TOLD_OF[first(n.name)]})`);
  assert.deepEqual(bad, []);
});

test('one name, one person: in the people book and among every world’s people', () => {
  const ids = new Map();
  const add = (name, id, where) => { if (!name || !id) return; const k = first(name); if (!ids.has(k)) ids.set(k, new Map()); ids.get(k).set(id, where); };
  for (const p of EVERYONE) add(p.name, p.id, `the book, ${p.world}`);
  for (const [w, c] of Object.entries(CONTENT)) for (const n of c?.npcs ?? []) add(n.name, n.id, w);
  const shared = [...ids].filter(([, m]) => m.size > 1).map(([k, m]) => `${k}: ${[...m].map(([id, w]) => `${id} (${w})`).join(', ')}`);
  assert.ok(ids.size > 100, `${ids.size} names`);
  assert.deepEqual(shared, []);
  // the two renamed in v1.61: the scientist and the anchor-minder
  assert.equal(EVERYONE.find((p) => p.id === 'thrum')?.name, 'Anselm Thrum');
  assert.equal(CONTENT.spacecity.npcs.find((n) => n.id === 'tilde')?.name, 'Tilde');
});

/** Every listing of a person by id: the people book, every world's people, the story's and the temples' people lists. */
async function listings() {
  const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {} });
  globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
  const out = [];
  for (const p of EVERYONE) out.push({ id: p.id, name: p.name, where: `the book, ${p.world}` });
  for (const [w, c] of Object.entries(CONTENT)) for (const n of c?.npcs ?? []) if (n.id && n.name) out.push({ id: n.id, name: n.name, title: n.title, at: w, home: n.world, where: w });
  for (const dir of ['story', 'temples']) {
    for (const f of DATA[dir].files.filter((x) => x.endsWith('-data.js') && x !== 'aliens-data.js')) {
      const m = await DATA[dir].load(f);
      for (const key of ['PEOPLE', 'LANDING', 'LOCALS', 'KEEPERS', 'RIM', 'STREET', 'VILLAGERS', 'WREN']) {
        const v = m[key];
        if (!v || typeof v !== 'object') continue;
        for (const p of v.name ? [v] : Array.isArray(v) ? v : Object.values(v)) if (p?.id && p.name) out.push({ id: p.id, name: p.name, where: `${dir}/${f} ${key}` });
      }
    }
  }
  return out;
}
/** The ids that name more than one person: two names, two titles, or two worlds they live in. → ['id: why'] */
function sharedIds(list) {
  const by = new Map();
  for (const p of list) { if (!by.has(p.id)) by.set(p.id, []); by.get(p.id).push(p); }
  const bad = [];
  for (const [id, l] of by) {
    const names = new Set(l.map((p) => first(p.name)));
    const titles = new Set(l.filter((p) => p.at).map((p) => p.title ?? ''));
    const homes = new Set(l.filter((p) => p.at && !p.home).map((p) => p.at));
    if (names.size > 1) bad.push(`${id}: ${l.map((p) => `${p.name} (${p.where})`).join(', ')}`);
    else if (titles.size > 1) bad.push(`${id}: ${l.filter((p) => p.at).map((p) => `${p.name} ${p.title} (${p.where})`).join(', ')}`);
    else if (homes.size > 1) bad.push(`${id}: at home in ${[...homes].join(' and ')}`);
  }
  return bad;
}

test('one id, one person: across every world, the book and the story’s lists', async () => {
  const list = await listings();
  assert.ok(new Set(list.map((p) => p.id)).size > 100, 'the people found');
  assert.deepEqual(sharedIds(list), []);
  // the check catches what #251 found: one id, two people (two titles, two homes), and one id with two names
  const bram = [{ id: 'bram', name: 'Bram', title: 'who minds the cave mouth', at: 'perdide2', where: 'perdide2' }, { id: 'bram', name: 'Bram', title: 'who works the capstan', at: 'spacecity', where: 'spacecity' }];
  assert.equal(sharedIds(bram).length, 1);
  assert.equal(sharedIds([bram[0], { ...bram[0], at: 'spacecity', where: 'spacecity' }]).length, 1, 'two homes');
  assert.deepEqual(sharedIds([bram[0], { ...bram[0], at: 'mangrove', home: 'perdide2', where: 'mangrove' }]), [], 'a traveller is one person');
  assert.equal(sharedIds([{ id: 'pell', name: 'Pell', where: 'the book' }, { id: 'pell', name: 'Hobb', where: 'temples' }]).length, 1, 'two names');
  // the three renamed in v1.63
  assert.equal(CONTENT.spacecity.npcs.find((n) => n.id === 'ewart')?.name, 'Ewart');
  assert.ok(!CONTENT.spacecity.npcs.some((n) => n.id === 'bram'), 'no Bram in the Floating city');
  assert.equal(CONTENT.waterfall.npcs.find((n) => n.id === 'aldo')?.name, 'Aldo');
  assert.equal(list.find((p) => p.id === 'hobb')?.name, 'Hobb');
});
