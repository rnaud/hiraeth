// The lore page (lore.html, src/lore-page/, docs/systems/lore-page.md; issues #268, #269): built from the game's
// data (every world on the route, its temples, guardians and gadgets, every item, no missing pictures), a Note on
// every part filed through the Notes page's own API with the lore page's footer, and built by vite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildLore, lorePlugin, LORE_MODULE } from '../scripts/lore-data.mjs';
import { lorePage, lorePictures } from '../src/lore-page/view.js';
import { noteText, noteRequest, fileNote, signedIn, notesHere, LORE_URL } from '../src/lore-page/notes.js';
import { SOURCES } from '../src/lore-page/pictures.js';
import { WORLD_LORE, THREAD } from '../src/lore-page/lore-text.js';
import { ORDER } from '../src/levels/names.js';
import { TEMPLES, templesIn } from '../src/temples/index.js';
import { ITEMS } from '../src/items.js';
import { BUILD_INPUT } from '../vite.config.js';
import { PAGES } from '../src/world-picker.js';
import { handleIssues, SOURCES as FOOTERS } from '../worker/issues.js';
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
  // linked from the Notes page, and in the Debug menu's Pages, not on What's new (issue #291)
  assert.match(readFileSync(new URL('../notes.html', import.meta.url), 'utf8'), /href="\.\/lore\.html"/);
  assert.ok(PAGES.some((p) => p.href === 'lore.html' && p.label === 'Lore'), 'Debug → Pages → Lore');
  assert.doesNotMatch(readFileSync(new URL('../changelog.html', import.meta.url), 'utf8'), /href="\.\/lore\.html"/);
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

test('each world names the night by its own people\'s words (lore/voice-guide.md; issue #282)', () => {
  // "the night the sky rang" is the City-Shaft's, a shaft that rings; the others name it by what they saw
  const OWN = { perdide: 'the night the light passed', underwater: 'the night the whales went quiet', moonfoundry: 'the night the singing went over', spacecity: 'the night the cables sang', glassdunes: 'the night the singing light passed' };
  for (const [id, paras] of Object.entries(WORLD_LORE)) {
    const t = paras.join(' ');
    if (id !== 'incal') assert.doesNotMatch(t, /sky rang/, `${id}: not the City-Shaft's night`);
    if (OWN[id]) assert.ok(t.toLowerCase().includes(OWN[id]), `${id}: “${OWN[id]}”`);
  }
  const thread = THREAD.flatMap((p) => [...p.text, ...(p.ending ?? [])]).join(' ');
  assert.equal(thread.match(/sky rang/g)?.length ?? 0, 1, 'the story names the City-Shaft\'s night once, beside the others');
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

test('a note: the comment, what it is about, and the Notes page\'s API with the lore page\'s footer', async () => {
  const ref = { anchor: 'guardian-desert', label: 'The Keeper of the cistern (The Rose House)' };
  assert.equal(noteText('  Too easy\nThe braziers light themselves.  ', ref),
    `Too easy\nThe braziers light themselves.\n\nOn the lore page: **The Keeper of the cistern (The Rose House)** (${LORE_URL}#guardian-desert)`);
  const calls = [];
  const fake = async (url, options) => { calls.push({ url, options }); return Response.json({ issue: { number: 301, title: 'Too easy' } }, { status: 201 }); };
  const issue = await fileNote('Too easy\nThe braziers light themselves.', ref, fake);
  assert.equal(issue.number, 301);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/notes/issues', 'the Notes page\'s own endpoint, same origin');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.credentials, 'same-origin', 'its session cookie, no token');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].options.body), noteRequest('Too easy\nThe braziers light themselves.', ref));
  assert.equal(JSON.parse(calls[0].options.body).source, 'lore');
  await assert.rejects(fileNote('   ', ref, fake), /Write a line/);
  await assert.rejects(fileNote('x', ref, async () => Response.json({ error: 'Please unlock your notebook again.' }, { status: 401 })), (e) => e.status === 401);
  assert.equal(await signedIn(async () => Response.json({ authenticated: true })), true);
  assert.equal(await signedIn(async () => { throw new Error('offline'); }), false);
  assert.equal(notesHere({ hostname: 'hiraeth.alexandria-rnaud.workers.dev' }), true);
  assert.equal(notesHere({ hostname: 'localhost' }), true);
  assert.equal(notesHere({ hostname: 'rnaud.github.io' }), false, 'GitHub Pages: the box links to the Notes site');
});

test('the Worker files a lore note with its title from the first line and the lore page\'s footer', async () => {
  const origin = 'https://notebook.example', now = Date.UTC(2026, 9, 13);
  const allow = { limit: async () => ({ success: true }) };
  const env = { HIRAETH_ISSUES_TOKEN: 'test-github-token', HIRAETH_NOTES_PASSWORD: 'testpw', NOTES_LOGIN_LIMITER: allow, NOTES_WRITE_LIMITER: allow };
  const post = (path, body, cookie) => new Request(`${origin}/api/notes/${path}`, { method: 'POST', body: JSON.stringify(body), headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) } });
  const login = await handleIssues(post('session', { password: 'testpw' }), env, () => { throw new Error('no GitHub'); }, now);
  const cookie = login.headers.get('Set-Cookie').split(';')[0];
  const ref = { anchor: 'item-hook', label: 'Grappling hook' };
  const sent = [];
  const github = async (url, options) => { sent.push(JSON.parse(options.body)); return Response.json({ number: 7, title: 'x', labels: [] }, { status: 201 }); };
  const r = await handleIssues(post('issues', noteRequest('The hook should reach further\nIt stops short of the ledges.', ref), cookie), env, github, now);
  assert.equal(r.status, 201);
  assert.equal(sent[0].title, 'The hook should reach further');
  assert.equal(sent[0].body, `${noteText('The hook should reach further\nIt stops short of the ledges.', ref)}\n\n${FOOTERS.lore}`);
  assert.equal(FOOTERS.lore, 'Added from the Hiraeth lore page.');
  // the notebook's own notes keep theirs; an unknown source is the notebook's
  for (const source of [undefined, 'constructor', 'nope']) {
    await handleIssues(post('issues', { text: 'A plain note', ...(source ? { source } : {}) }, cookie), env, github, now);
    assert.equal(sent.at(-1).body, 'A plain note\n\nAdded from the Hiraeth notebook.');
  }
});
