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

// Issue #281 (the dialogue review v1.66, findings 2 and 3): the hosts brought names that nearly matched people already in
// their world (Ysolt and Mother Ysolde, Brother Felix and Brother Calix, Ostra and Ossa, Nadir and Naji, Ilka and Ilo),
// and the scientist aboard in every world, Anselm, stood beside the Whale-House's Anselme. Within one world (its parts
// together, a sub-level with the world it leaves from), with the hosts, the fellow traveller at her stops and the
// scientist aboard everywhere: no two people a player meets share their first three letters, or lie within two edits of
// each other where that is a look-alike (they share their first two letters, or both have five letters or more: two
// edits make a three-letter name another name, Ama and Rima, Teo and Ilo, and those read apart).
/** A name as a player reads it: no honorific, no accents, lower case, its first word. */
const plain = (n) => bare(n).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(' ')[0];
/** Levenshtein distance. */
function edits(a, b) {
  const d = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
}
/** Do these two names blur? → why, or ''. */
function alike(x, y) {
  const a = plain(x), b = plain(y);
  if (a === b) return '';   // (one name, one person is the test above's)
  if (a.slice(0, 3) === b.slice(0, 3)) return 'the same first three letters';
  const d = edits(a, b);
  if (d <= 2 && (a.slice(0, 2) === b.slice(0, 2) || Math.min(a.length, b.length) >= 5)) return `${d} edit${d > 1 ? 's' : ''} apart`;
  return '';
}
/** One world: one shape, the same first letter and length (four or more), two letters apart (Nuri and Nour). */
const closeKin = (a, b) => a !== b && a[0] === b[0] && a.length === b.length && a.length >= 4 && edits(a, b) <= 2;
/** The route's worlds together: the same first five letters (Hollis and Hollin). */
const farKin = (a, b) => a !== b && a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5);
/** The games' signs a level puts up itself (src/levels/desert.js, bazaar.js), and the games' markers: the world of each host. */
const SIGNS = { fishing: 'desert', canyon: 'desert', rings: 'desert', wingdrop: 'desert', gallery: 'bazaar' };

test('within a world, no two people’s names look or sound alike (issue #281)', async () => {
  await import('./register-gadgets.js');
  const { partOf, SUB, ORDER, SIDE } = await import('../src/levels/names.js');
  const { EVERYONE } = await import('../src/story/people-book.js');
  const { HOSTS } = await import('../src/minigames/kit/hosts.js');
  const { THRUM } = await import('../src/story/scientist-data.js');
  const { TANSY, STOPS } = await import('../src/story/fellow-data.js');
  const files = readdirSync(new URL('../src/minigames/', import.meta.url)).filter((f) => f.endsWith('.js') && f !== 'index.js');
  const markers = Object.fromEntries((await Promise.all(files.map((f) => import(`../src/minigames/${f}`))))
    .flatMap((m) => Object.values(m)).filter((g) => g?.id && g.markers?.length).map((g) => [g.id, g.markers[0].level]));
  const fileWorld = { 'night-train': 'overnighttrain' };
  const worldOf = (w) => { const p = partOf(fileWorld[w] ?? w); return SUB[p] ?? p; };
  const by = new Map();
  const meet = (w, name) => { if (!name || /^(The|A|An) /.test(name)) return; w = worldOf(w); if (!by.has(w)) by.set(w, new Set()); by.get(w).add(name); };
  for (const p of await everyone()) meet(p.world, p.name);
  for (const p of EVERYONE) meet(p.world, p.name);
  for (const [id, H] of Object.entries(HOSTS)) {
    if (H.object) continue;
    const w = SIGNS[id] ?? markers[id] ?? id.replace(/^trial-/, '');
    assert.ok([...ORDER, ...SIDE, 'arzach2', 'perdide2'].includes(w), `${id}: the host’s world (${w})`);
    meet(w, H.name);
  }
  for (const w of STOPS) meet(w, TANSY.name);
  for (const w of [...ORDER, ...SIDE]) meet(w, THRUM.name);   // (aboard in every world once met: src/story/scientist.js)
  assert.ok(by.get('desert').size > 30, `${by.get('desert').size} people in the desert`);
  const bad = [];
  for (const [w, set] of by) {
    const l = [...set];
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { const why = alike(l[i], l[j]); if (why) bad.push(`${w}: ${l[i]} and ${l[j]} (${why})`); }
  }
  assert.deepEqual(bad, []);
  // (issue #563, the v1.87 review's finding 5: names the rules above let through) one world, two names of one shape: the
  // same first letter and length, two letters apart (Nuri and Nour); the route's worlds together, the same first five
  // letters (Hollis in Viridel, Hollin in Lorn: a player meets both); and two hosts of one world never in the same colours
  // with the same first letter (Ozren and Opal, both of the Glass Dunes' kilns, one palette)
  const near = [];
  for (const [w, set] of by) {
    const l = [...set].map(plain);
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) if (closeKin(l[i], l[j])) near.push(`${w}: ${l[i]} and ${l[j]}`);
  }
  const all = [...new Set([...by].filter(([w]) => ORDER.includes(w)).flatMap(([, s]) => [...s]).map(plain))];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (farKin(all[i], all[j])) near.push(`the route: ${all[i]} and ${all[j]}`);
  assert.deepEqual(near, []);
  const colours = new Map();
  for (const [id, H] of Object.entries(HOSTS)) {
    if (H.object) continue;
    const k = `${SIGNS[id] ?? markers[id] ?? id.replace(/^trial-/, '')}|${H.palette?.cloak}|${plain(H.name)[0]}`;
    assert.ok(!colours.has(k), `${H.name} wears ${colours.get(k)}’s colours in one world (${k})`);
    colours.set(k, H.name);
  }
  for (const [a, b] of [['Nuri', 'Nour']]) assert.ok(closeKin(plain(a), plain(b)), `${a} and ${b} blur`);
  for (const [a, b] of [['Hollis', 'Hollin']]) assert.ok(farKin(plain(a), plain(b)), `${a} and ${b} blur`);
  // the check sees what the review found, and lets through what reads apart
  for (const [a, b] of [['Ysolt', 'Mother Ysolde'], ['Brother Felix', 'Brother Calix'], ['Ostra', 'Ossa'], ['Nadir', 'Naji'], ['Faris', 'Idris'], ['Darro', 'Marrow'], ['Ilka', 'Ilo'], ['Anselme', 'Anselm Thrum'], ['Ansgar', 'Anselm Thrum'], ['Tamsy', 'Tansy']]) assert.ok(alike(a, b), `${a} and ${b} blur`);
  for (const [a, b] of [['Ama', 'Rima'], ['Teo', 'Ilo'], ['Wen', 'Dun'], ['Rosa', 'Joss'], ['Madame Sel', 'Teb']]) assert.equal(alike(a, b), '', `${a} and ${b} read apart`);
});

test('the Desert’s canyon race is not a third rose (issue #281)', async () => {
  const { readFileSync: read } = await import('node:fs');
  const { HOSTS } = await import('../src/minigames/kit/hosts.js');
  const said = JSON.stringify(Object.values(HOSTS)) + uncommented(read(new URL('../src/minigames/canyon.js', import.meta.url), 'utf8'));
  assert.ok(!/Rose Canyon/i.test(said), 'the Rose House and the rose-stone house keep the roses');
  assert.match(HOSTS.canyon.title, /the Two Chasms/);
});
