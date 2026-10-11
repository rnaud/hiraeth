// Every person's name is used once in the game (the second story pass, October 2026:
// docs/systems/story.md, "Every name once"). Two people who share a name, or look alike
// (Ysel and Ysolde, Ferro and Ferrol), blur in the credits, the mother's "who did you meet"
// and the player's head; and nobody but the protagonist is "the traveller".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { CONTENT } = await import('../src/levels/content.js');
const { ALIENS } = await import('../src/story/aliens-data.js');
const LISTS = ['PEOPLE', 'LANDING', 'LOCALS', 'KEEPERS', 'RIM', 'STREET', 'VILLAGERS', 'WREN'];

/** Every person: { world, where, id, name }. */
async function everyone() {
  const out = [];
  const add = (world, where, p) => { if (p?.name && (p.talk || p.lines || p.listen || p.kind || p.species)) out.push({ world, where, id: p.id, name: p.name }); };
  for (const dir of ['story', 'temples']) {
    for (const f of readdirSync(new URL(`../src/${dir}/`, import.meta.url)).filter((x) => x.endsWith('-data.js') && x !== 'aliens-data.js')) {
      const m = await import(`../src/${dir}/${f}`), world = f.replace('-data.js', '');
      for (const key of LISTS) {
        const v = m[key];
        if (!v || typeof v !== 'object') continue;
        if (v.name) add(world, `${dir}/${f} ${key}`, v);
        else for (const p of Array.isArray(v) ? v : Object.values(v)) add(world, `${dir}/${f} ${key}`, p);
      }
    }
  }
  // (the Sealed Hangar's people, kept with the dismissed world: src/levels/dismissed/hangar/)
  {
    const m = await import('../src/levels/dismissed/hangar/story-data.js');
    for (const key of LISTS) { const v = m[key]; if (v && typeof v === 'object') for (const p of v.name ? [v] : Array.isArray(v) ? v : Object.values(v)) add('garage', `levels/dismissed/hangar/story-data.js ${key}`, p); }
  }
  for (const [world, c] of Object.entries(CONTENT)) for (const n of c.npcs ?? []) add(world, 'content.js npcs', n);
  for (const a of Object.values(ALIENS)) for (const p of Array.isArray(a) ? a : [a]) add(p.world ?? 'aliens', 'aliens-data.js', p);
  // (the same person listed twice, by the same id, is one person)
  const byId = new Map();
  for (const p of out) if (!byId.has(`${p.id}|${p.name}`)) byId.set(`${p.id}|${p.name}`, p);
  return [...byId.values()];
}

/** A name without its honorific: "Sister Aube" and "Aube" are the same name. */
const bare = (n) => n.replace(/^(Sister|Brother|Mother|Father|Madame|Aunt|Uncle|Old|Slow|Little) /, '').trim();

test('no two people share a name, honorifics aside', async () => {
  const people = await everyone();
  assert.ok(people.length > 90, `found ${people.length} people`);
  const by = new Map();
  for (const p of people.filter((x) => !/^(The|A|An) /.test(x.name))) {
    const k = bare(p.name);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(p);
  }
  const dups = [...by.entries()].filter(([, l]) => new Set(l.map((p) => p.id)).size > 1);
  assert.deepEqual(dups.map(([n, l]) => `${n}: ${l.map((p) => `${p.world}/${p.id}`).join(', ')}`), []);
});

test('the near-misses are gone, and only the protagonist is the traveller', async () => {
  const names = new Set((await everyone()).map((p) => p.name));
  for (const n of ['Ysel', 'Ysa', 'Tamsin', 'Ferrol', 'Brann', 'Wick', 'The traveller']) assert.ok(!names.has(n), `${n} is not a person's name`);
  // the renamed, where they live now
  for (const n of ['Zazie', 'Rue', 'Tobin', 'Ket', 'Jot', 'Kesh', 'Emrys', 'Linnet', 'Hobb', 'Agathe', 'Rima', 'Dalia', 'Gaspard', 'Fisk', 'Robin', 'Naji']) assert.ok(names.has(n), `${n} is someone`);
});

// Issue #141 (the dialogue review, docs/audits/dialogue-v1.48.md): names a player could not keep apart were changed,
// and the Sealed Hangar's three travellers given homes on the route. Ids and flags kept the old names; nothing a
// player sees may (the dismissed Hangar, the save migrations and the changelog's earlier versions aside).
const OLD_NAMES = /Givers['’] [Hh]ouse|\b(?:Mireille|Ansel|Oren|Ilse|Tamar|Ottilie)\b/;
const RENAMES_LINE = 'A few names were too alike to keep apart';
/** A source file without its comments (a `//` after code or a blank, and block comments). */
const uncommented = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;,{}()[\]])\/\/.*$/gm, '$1');

test('the old names are gone from what a player sees: the Rose House, Brune, Yusuf, Halden, Petra, Ines, Liesel', async () => {
  const { readFileSync: read, readdirSync: list } = await import('node:fs');
  const root = new URL('../src/', import.meta.url);
  const SKIP = /^(?:levels\/dismissed\/|changelog\.js$|changelog-media\.js$|save-migrate\.js$)/;
  const files = list(root, { recursive: true }).filter((f) => f.endsWith('.js') && !SKIP.test(f.split('\\').join('/')));
  assert.ok(files.length > 300, `read ${files.length} files`);
  const found = [];
  for (const f of files) {
    uncommented(read(new URL(f, root), 'utf8')).split('\n').forEach((line, i) => { const m = line.match(OLD_NAMES); if (m) found.push(`src/${f}:${i + 1} ${m[0]}`); });
  }
  assert.deepEqual(found, []);
  const names = new Set((await everyone()).map((p) => p.name));
  for (const n of ['Brune', 'Yusuf', 'Halden', 'Petra', 'Ines', 'Liesel']) assert.ok(names.has(n), `${n} is someone`);
  // the newest changelog entry: only the line that says what changed names them
  const { CHANGELOG, lineText } = await import('../src/changelog.js');
  for (const item of CHANGELOG[0].items) {
    const text = lineText(item);
    if (!text.startsWith(RENAMES_LINE)) assert.ok(!OLD_NAMES.test(`${text} ${item.see ?? ''}`), `v${CHANGELOG[0].v}: ${text.slice(0, 60)}…`);
  }
});

test('Lune, Ottla and Zazie come from worlds the route reaches, not the dismissed Hangar', async () => {
  const { isDismissed } = await import('../src/levels/names.js');
  const met = [];
  for (const [world, c] of Object.entries(CONTENT)) {
    if (isDismissed(world)) continue;
    for (const p of (c.npcs ?? []).filter((n) => ['lune', 'ottla', 'pip.garage'].includes(n.id))) {
      met.push(p.name);
      assert.ok(!isDismissed(p.lang), `${p.name} in ${world} speaks a tongue of the route, not ${p.lang}`);
      const said = JSON.stringify([p.lines, p.talk, p.title]);
      assert.ok(!/Hangar|Major|Brask/.test(said), `${p.name} in ${world} says nothing of the Hangar`);
    }
  }
  assert.deepEqual(met.sort(), ['Lune', 'Ottla', 'Zazie']);
  const lineOf = (id) => JSON.stringify([...CONTENT.antennas.npcs, ...CONTENT.underside.npcs].find((p) => p.id === id)?.talk);
  assert.match(lineOf('lune'), /Signal Market/);
  assert.match(lineOf('ottla'), /Glass Dunes/);
  assert.match(lineOf('pip.garage'), /City-Shaft/);
});
