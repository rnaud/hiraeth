// The lore page (lore.html, src/lore-page/, docs/systems/lore-page.md; issues #268, #269): built from the game's
// data (every world on the route, its temples, guardians and gadgets, every item, no missing pictures), and built by vite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildLore, lorePlugin, LORE_MODULE } from '../scripts/lore-data.mjs';
import { lorePage, lorePictures } from '../src/lore-page/view.js';
import { SOURCES } from '../src/lore-page/pictures.js';
import { WORLD_LORE, THREAD } from '../src/lore-page/lore-text.js';
import { ORDER } from '../src/levels/names.js';
import { TEMPLES, templesIn } from '../src/temples/index.js';
import { ITEMS } from '../src/items.js';
import { BUILD_INPUT } from '../vite.config.js';
import { LORE_FILE } from '../scripts/web-update.mjs';
import { siteOnly } from '../scripts/site-only.mjs';

const lore = await buildLore();
const { nav, main } = lorePage(lore);
const html = nav + main;
const anchors = [...html.matchAll(/data-note="([^"]+)"/g)].map((m) => m[1]);

test('the lore page: built by vite, its data a virtual module, its pictures the site\'s alone', async () => {
  assert.ok(Object.values(BUILD_INPUT).some((p) => p.endsWith('/lore.html')), 'vite builds lore.html');
  const page = readFileSync(new URL('../lore.html', import.meta.url), 'utf8');
  assert.match(page, /src="\/src\/lore-page\/main\.js"/);
  const plugin = lorePlugin();
  const id = plugin.resolveId(LORE_MODULE);
  assert.ok(id);
  assert.match(await plugin.load(id), /^export default \{/);
  assert.ok(LORE_FILE.test('lore-pictures/guardian-desert.webp') && !LORE_FILE.test('lore.html'));
  assert.ok(siteOnly('lore-pictures/traveller-portrait.webp'), 'the APK and the Deck leave its pictures out');
  // linked from the Notes page and the changelog page
  assert.match(readFileSync(new URL('../notes.html', import.meta.url), 'utf8'), /href="\.\/lore\.html"/);
  assert.match(readFileSync(new URL('../changelog.html', import.meta.url), 'utf8'), /href="\.\/lore\.html"/);
});

test('every world on the route, in its order, with its lore, people, temples, guardians and gadgets', () => {
  assert.deepEqual(lore.worlds.map((w) => w.id), ORDER);
  for (const w of lore.worlds) {
    assert.ok(WORLD_LORE[w.id]?.length, `${w.id}: its lore (src/lore-page/lore-text.js WORLD_LORE)`);
    assert.ok(w.blurb && w.page.title, `${w.id}: its blurb and its page`);
    assert.ok(w.people.length, `${w.id}: its people (the people book)`);
    assert.deepEqual(w.temples.map((t) => t.id).sort(), templesIn(w.id).sort(), `${w.id}: its temples`);
    assert.ok(html.includes(`id="world-${w.id}"`), `${w.id}: on the page`);
    for (const p of w.people) assert.ok(html.includes(`id="person-${w.id}-`), `${w.id}: ${p.name} on the page`);
  }
  const shown = lore.worlds.flatMap((w) => w.temples);
  assert.deepEqual(shown.map((t) => t.id).sort(), Object.keys(TEMPLES).sort(), 'every temple, in its world');
  for (const t of shown) {
    assert.equal(t.gadget.id, TEMPLES[t.id].def.gadget, `${t.id}: its gadget`);
    assert.ok(ITEMS[t.gadget.id], `${t.id}: its gadget is an item`);
    assert.ok(t.guardian?.name && t.guardian.phases.length, `${t.id}: its guardian and how it is beaten`);
    for (const a of [`temple-${t.id}`, `guardian-${t.id}`, `gadget-${t.id}`]) assert.ok(anchors.includes(a), `${a}: a Note`);
    assert.ok(html.includes(`The gadget: ${t.gadget.name}`), `${t.id}: the gadget named`);
  }
  // the second verb (#257) of the six guardians that ask for one
  const asks = shown.filter((t) => t.guardian.phases.some((p) => p.asks));
  assert.equal(asks.length, 6, 'six guardians ask for a second verb');
  for (const t of asks) for (const p of t.guardian.phases.filter((x) => x.asks)) assert.ok(lore.verbs[p.asks.verb], `${t.id}: the verb ${p.asks.verb} named`);
  assert.equal((html.match(/Second verb:/g) ?? []).length, asks.reduce((n, t) => n + t.guardian.phases.filter((p) => p.asks).length, 0));
});

test('every item, where it is found, and the temples\' gadgets marked as the key to their guardian', () => {
  assert.deepEqual(lore.items.map((i) => i.id).sort(), Object.keys(ITEMS).sort());
  for (const i of lore.items) assert.ok(anchors.includes(`item-${i.id}`), `${i.id}: a card with a Note`);
  assert.ok(lore.items.find((i) => i.id === 'sword').temple?.temple === 'desert');
  assert.ok(lore.items.find((i) => i.id === 'backpack').where.some((w) => w.world === 'desert'));
  assert.ok(!/\{key:/.test(html), 'the item texts\' keys are written out');
});

test('the story, its ending behind a fold, and the traveller', () => {
  for (const p of THREAD) assert.ok(anchors.includes(`story-${p.id}`), `${p.id}: a Note`);
  for (const id of ['light', 'father', 'makers', 'fragments', 'lantern']) assert.ok(THREAD.some((p) => p.id === id), id);
  const lantern = main.slice(main.indexOf('id="story-lantern"'));
  assert.match(lantern, /<details class="ending"><summary>Show the ending<\/summary>[^]*Ilen/, 'the Lantern\'s ending folded');
  const open = main.replace(/<details class="ending">[^]*?<\/details>/g, '');
  assert.ok(!/Ilen, his elder sister/.test(open), 'the sister only in the fold');
  assert.ok(anchors.includes('traveller-about'));
  assert.ok(lore.traveller.portrait && lore.traveller.gear.length >= 3);
});

test('no missing pictures, and every Note names its part', () => {
  for (const name of Object.keys(SOURCES)) assert.ok(existsSync(new URL(`../public/lore-pictures/${name}.webp`, import.meta.url)), `${name}: made (node scripts/lore-pictures.mjs)`);
  for (const src of lorePictures(lore)) assert.ok(existsSync(new URL(`../public/${src}`, import.meta.url)), `${src} exists`);
  for (const m of html.matchAll(/<img src="([^"]+)"/g)) assert.ok(existsSync(new URL(`../public/${m[1]}`, import.meta.url)), `${m[1]} exists`);
  assert.equal(new Set(anchors).size, anchors.length, 'one Note per anchor');
  for (const a of anchors) assert.ok(html.includes(`id="${a}"`), `${a}: the Note's part is on the page`);
  for (const m of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${m[1]}"`), `#${m[1]}: a link to a part of the page`);
  for (const m of html.matchAll(/data-label="([^"]*)"/g)) assert.ok(m[1].trim(), 'a label');
});
