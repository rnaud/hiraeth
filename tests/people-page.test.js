import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOOK, EVERYONE, PERSON, WORLD_ORDER, metPeople, personStory, personNow, interactions, test as holds, QUEST_BY_ID, QUESTS_OF, ERRAND_PEOPLE, KEEPSAKE_FROM } from '../src/story/people-book.js';
import { peopleData, menuSources } from '../src/game-menu-data.js';
import { GameMenu, PANELS, peoplePanel, ACT } from '../src/game-menu.js';
import { PortraitCache } from '../src/portrait-cache.js';
import { CONTENT, ERRANDS, ERRAND_PLACES } from '../src/levels/content.js';
import { ORDER, partsOf } from '../src/levels/names.js';
import * as arzach from '../src/story/arzach-data.js';
import * as arzach2 from '../src/story/arzach2-data.js';
import * as perdide2 from '../src/story/perdide2-data.js';
import * as garage from '../src/levels/dismissed/hangar/story-data.js';
import * as incal from '../src/story/incal-data.js';
import { SHOPKEEPERS } from '../src/story/shop-data.js';
import { SHOPS } from '../src/shop.js';
import { TANSY, STOPS as FELLOW_STOPS } from '../src/story/fellow-data.js';

// The game menu's People page (src/story/people-book.js, src/game-menu.js peoplePanel): who the people of the
// route are, as far as the save says the traveller knows them. Spoiler-safe: only people met, and only the
// parts of their story heard.

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

/** Every talking person of a world, from the story's own data (as the conversation panel sees them). */
async function peopleOf(world) {
  // (a merged world's: each of its parts' story data, src/levels/names.js PARTS; the Glass Dunes' are its people's file)
  const out = new Map();
  for (const part of partsOf(world)) {
    const m = await import(part === 'glassdunes' ? '../src/story/glassdunes-people.js' : `../src/story/${part}-data.js`);
    // (and the keepers of the world's shops: src/story/shop-data.js, placed by src/story/shops.js)
    const keepers = Object.values(SHOPS).filter((s) => s.world === part).map((s) => SHOPKEEPERS[s.keeper]);
    // (and the fellow traveller, listed where the route first puts her: src/story/fellow-data.js)
    const fellow = part === FELLOW_STOPS[0] ? [TANSY] : null;
    for (const list of [m.PEOPLE, m.LOCALS, m.KEEPERS, CONTENT[part]?.npcs, m.WREN ? [m.WREN] : null, keepers, fellow]) {
      for (const p of Array.isArray(list) ? list : Object.values(list ?? {})) if (p?.id && p.talk && !out.has(p.id)) out.set(p.id, p);
    }
  }
  return out;
}

test('the book: every talking person of the route, under their own world, by the name their conversation gives', async () => {
  assert.deepEqual(WORLD_ORDER, [...ORDER, 'home', 'lantern']);
  assert.equal(new Set(EVERYONE.map((p) => p.id)).size, EVERYONE.length, 'one entry a person');
  for (const world of WORLD_ORDER) {
    const real = await peopleOf(world);
    const listed = new Map(partsOf(world).flatMap((part) => BOOK[part] ?? []).map((p) => [p.id, p]));
    for (const [id, p] of real) {
      assert.ok(listed.has(id), `${world}: ${p.name} (${id}) is in the book`);
      assert.equal(listed.get(id).name, p.name, `${id}: the name they say`);
    }
    for (const id of listed.keys()) assert.ok(real.has(id), `${world}: ${id} talks in that world`);
  }
  for (const p of EVERYONE) {
    assert.ok(p.role && p.story.length && typeof p.story[0] === 'string', `${p.id}: a role, and what meeting them tells`);
    assert.ok(personNow(p, {}), `${p.id}: where they are`);
    for (const x of [...p.story, ...p.now]) assert.ok(typeof x === 'string' || (Array.isArray(x) && x.length === 2 && typeof x[1] === 'string'), `${p.id}: a part is text or [cond, text]`);
  }
});

test('which people appear: only the ones met, grouped by world in the route\'s order', () => {
  assert.deepEqual(metPeople({}), [], 'nobody before a conversation');
  const flags = { 'met.dov': true, 'met.ama': true, 'met.nour': true, 'met.hollin.perdide2': true, 'quest.incal.light': 'done', 'met.nobody': true };
  const groups = metPeople(flags);
  assert.deepEqual(groups.map((g) => g.world), ['desert', 'perdide', 'incal'], 'the route\'s order, not the order met (the Deep Wood’s Hollin under Lorn: src/levels/names.js PARTS)');
  assert.deepEqual(groups[0].people.map((p) => p.id), ['ama', 'nour'], 'in the book\'s order within a world');
  assert.ok(!groups.flatMap((g) => g.people).some((p) => p.id === 'nima'), 'a quest done says nothing of someone not met');
  const data = peopleData({ flags, titles: { desert: 'The Desert' } });
  assert.equal(data.groups[0].title, 'The Desert');
  assert.equal(data.groups[2].title, 'The City-Shaft', 'a title the game did not pass: the route\'s names');
  assert.equal(data.person, null, 'no page open');
  // the page shows no silhouettes: the html has the people met and nobody else
  const { html, rows } = peoplePanel(data);
  assert.equal(rows.flat().length, 4);
  for (const name of ['Ama', 'Nour', 'Hollin', 'Dov']) assert.ok(html.includes(name), name);
  assert.ok(!html.includes('Nima') && !html.includes('?</'), 'nobody unmet, no question marks');
  assert.match(html, /data-grid-nav/, 'the cards move by where they are drawn');
  assert.match(peoplePanel({ groups: [] }).html, /Nobody yet/);
});

test('the story unlocks part by part as the save hears it, and says where they are now', () => {
  const dov = PERSON.get('dov');
  assert.equal(personStory(dov, { 'met.dov': true }).length, 1, 'met: what he says first');
  const later = personStory(dov, { 'met.dov': true, 'incal.dov.allowed': true });
  assert.equal(later.length, 2);
  assert.match(later[1], /bottom/, 'the splinter: where he grew up');
  assert.ok(!later.join(' ').includes('Pip'), 'not his nephew until the ration tin');
  assert.match(personStory(dov, { 'incal.dov.allowed': true, 'incal.dov.fed': true }).join(' '), /Pip is his nephew/);
  assert.match(personNow(dov, { 'incal.token': 'returned' }), /rest day/);
  assert.match(personNow(dov, {}), /palace gate/);
  // a quest's stage reached (past) and a failed one
  const ondine = PERSON.get('ondine');
  assert.equal(personStory(ondine, { 'quest.arzach2.letter': 'carry' }).length, 1, 'the letter not given yet');
  assert.equal(personStory(ondine, { 'quest.arzach2.letter': 'lamp' }).length, 2, 'given: she read it');
  const esk = PERSON.get('esk');
  assert.ok(!personStory(esk, { 'quest.edena.terraces': 'gate' }).join(' ').includes('hollow'), 'the flood is not told before it happens');
  assert.match(personStory(esk, { 'quest.edena.terraces': 'failed' }).join(' '), /hollow/);
  // Ilen: what the light was, only once she has told it (the talk that ends with her coming home)
  const ilen = PERSON.get('ilen');
  assert.ok(!personStory(ilen, { 'met.ilen': true }).join(' ').includes('drained'));
  assert.match(personStory(ilen, { 'met.ilen': true, 'finale.met': true }).join(' '), /passed your ship and drained it/);
  // the conditions read the save's own shapes
  assert.equal(holds({ quest: 'desert.drum', done: true }, { 'quest.desert.drum': 'done' }), true);
  assert.equal(holds({ quest: 'desert.drum', past: 'free' }, { 'quest.desert.drum': 'find' }), false);
  assert.equal(holds({ quest: 'desert.drum', past: 'free' }, { 'quest.desert.drum': 'return' }), true);
  assert.equal(holds({ any: [{ flag: 'a' }, { not: { flag: 'b' } }] }, { b: 1 }), false);
  // every condition names a real quest and stage
  const walk = (c, who) => {
    if (!c || typeof c !== 'object') return;
    for (const k of ['all', 'any']) c[k]?.forEach((x) => walk(x, who));
    if (c.not) walk(c.not, who);
    if (c.quest) {
      const q = QUEST_BY_ID.get(c.quest);
      assert.ok(q, `${who}: quest ${c.quest}`);
      if (c.past) assert.ok(q.stages.some((s) => s.id === c.past), `${who}: stage ${c.past}`);
    }
  };
  for (const p of EVERYONE) for (const x of [...p.story, ...p.now]) if (Array.isArray(x)) walk(x[0], p.id);
  // (the Sealed Hangar's people stay in the book, unlisted: the world was dismissed in October 2026)
  const hangar = new Set((BOOK.garage ?? []).map((p) => p.id));
  for (const [id, list] of Object.entries(QUESTS_OF)) { assert.ok(PERSON.has(id) || hangar.has(id), id); for (const q of list) assert.ok(QUEST_BY_ID.has(q), q); }
});

test('what passed between you, from the save: talks, quests, things given, keepsakes, errands, choices', () => {
  const flags = { 'met.dov': true, 'talks.dov': 3, 'quest.incal.light': 'palace', 'quest.incal.ration': 'done', 'incal.dov.fed': true, 'incal.token': 'returned' };
  const dov = interactions(PERSON.get('dov'), { flags, keepsakes: [{ id: 'incal.token', name: 'Dov’s lift token' }] });
  assert.equal(dov.talks, 3);
  assert.deepEqual(dov.quests.map((q) => [q.id, q.state]), [['incal.light', 'active'], ['incal.ration', 'done']]);
  assert.ok(dov.things.includes('You gave him Pip’s ration tin.'));
  assert.ok(dov.things.includes('Keepsake: Dov’s lift token.'));
  assert.match(dov.choices[0], /back into his hand/, 'Dov\'s token, given back');
  assert.match(interactions(PERSON.get('dov'), { flags: { 'incal.token': 'kept' } }).choices[0], /kept the lift token/);
  // Hollin's promise, and kept
  const hollin = (f) => interactions(PERSON.get('hollin.perdide2'), { flags: f }).choices[0] ?? '';
  assert.match(hollin({ 'perdide2.promise': 'yes' }), /^You promised to come back\.$/);
  assert.match(hollin({ 'perdide2.promise': 'yes', 'perdide2.promise.kept': true }), /and you came back/);
  assert.match(hollin({ 'perdide2.promise': 'maybe' }), /would not promise/);
  // Esk's hill
  const esk = interactions(PERSON.get('esk'), { flags: { 'met.esk': true, 'quest.edena.terraces': 'failed' } });
  assert.deepEqual(esk.quests.map((q) => q.state), ['failed']);
  assert.match(esk.choices[0], /hollow/);
  // someone met before the talks were counted: once; quests not started are not listed
  const nima = interactions(PERSON.get('nima'), { flags: { 'met.nima': true } });
  assert.equal(nima.talks, 1);
  assert.deepEqual(nima.quests, []);
  // errands: the giver and the receiver
  assert.match(interactions(PERSON.get('pell'), { errands: { sand: { item: 'a jar of singing sand', done: false } } }).things.join(), /gave you a jar of singing sand/);
  assert.match(interactions(PERSON.get('senn'), { errands: { sand: { item: 'a jar of singing sand', done: true } } }).things.join(), /delivered a jar of singing sand/);
  assert.deepEqual(interactions(PERSON.get('senn'), { errands: { sand: { item: 'x', done: false } } }).things, [], 'not delivered yet');
});

test('the errands\' and keepsakes\' people are the ones the content names', () => {
  // (by place, as written: a merged world's part's people by their index in the part, src/levels/content.js ERRAND_PLACES)
  assert.equal(ERRAND_PLACES.length, ERRANDS.length);
  for (const e of ERRAND_PLACES) {
    const [from, to] = ERRAND_PEOPLE[e.id] ?? [];
    assert.ok(from && to, e.id);
    const at = (world, i) => CONTENT[world].npcs[i]?.id ?? { arzach: arzach.LOCALS, arzach2: arzach2.LOCALS, garage: garage.LOCALS }[world]?.[i]?.id;
    assert.equal(at(...e.from), from, `${e.id}: giver`);
    assert.equal(at(...e.to), to, `${e.id}: receiver`);
  }
  for (const id of Object.values(KEEPSAKE_FROM)) assert.ok(PERSON.has(id), id);
  assert.equal(perdide2.keepsakeFor('yes').id, 'perdide2.person');
  assert.ok(incal.PEOPLE.dov, 'Dov');
});

test('the page in the menu: People is the fifth panel; A / × opens a person, B / ○ goes back, ← → steps along', () => {
  assert.equal(PANELS.at(-1).id, 'people');
  assert.equal(ACT.open, 'open');
  const flags = { 'met.ama': true, 'met.nour': true, 'met.dov': true, 'incal.dov.allowed': true };
  const game = { data: { flags }, keepsakes: () => [] };
  const m = new GameMenu(null, { sources: menuSources({ items: { owned: () => [] }, game, journal: { data: {} }, levels: [], order: [] }) });
  m.open('people');
  assert.equal(m.state.cell(m.rows).id, 'ama');
  m.navigate(1, 0);
  assert.equal(m.state.cell(m.rows).id, 'nour');
  m.confirm();
  assert.equal(m.person, 'nour', 'A / × opens the page');
  assert.equal(m.detail.name, 'Nour');
  assert.equal(m.detail.prevId, 'ama'); assert.equal(m.detail.nextId, 'dov');
  m.navigate(1, 0);
  assert.equal(m.person, 'dov', '→ the next person');
  assert.equal(m.detail.story.length, 2);
  assert.equal(m.back(), true, 'B / ○ goes back to the cards');
  assert.equal(m.person, null);
  assert.equal(m.state.cell(m.rows).id, 'dov', 'on the card of the one just read');
  assert.equal(m.back(), false, 'on the cards, B / ○ closes the menu');
  // turning away and back: the cards
  m.confirm(); assert.equal(m.person, 'dov');
  m.turn(1); assert.equal(m.panel, 'items'); m.turn(-1);
  assert.equal(m.person, null);
  // the wiring
  const main = src('src/main.js');
  assert.match(main, /portrait: \(id\) => portraits\.get\(id\)/, 'the menu gets the kept portraits');
  assert.match(main, /game\.on\('dialogue:start'[\s\S]{0,200}talks\.\$\{id\}/, 'each conversation counted');
  assert.match(src('src/game-menu.css'), /#journal \.gm-people \.pgrid \{ display: grid; grid-template-columns: repeat\(auto-fill/);
});

test('the portraits: kept small after a conversation, replaced by the next, read back', async () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const told = [];
  const c = new PortraitCache(storage, { shrink: async (s) => `small:${s}` });
  c.onChange = (id, e) => told.push([id, e.src]);
  assert.equal(c.get('dov'), null);
  await c.put('dov', { src: 'data:big', background: '#f00' });
  assert.deepEqual(c.get('dov'), { src: 'small:data:big', background: '#f00' });
  assert.deepEqual(told, [['dov', 'small:data:big']]);
  await c.put('dov', 'data:newer');
  assert.equal(c.get('dov').src, 'small:data:newer', 'the latest look');
  assert.equal(new PortraitCache(storage, { shrink: async () => null }).get('dov').src, 'small:data:newer', 'kept across a reload');
  assert.equal(await c.put('x', null), null);
});
