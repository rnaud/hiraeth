// The Sightings (src/story/sightings.js): every trace of the singing light, the makers' sign and the
// father's signal, written down as it is met and kept in the save; the game menu's page of them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { SIGHTINGS, THREADS, seen, sightingsOf, recordSightings, sightingsData, sightingFlag } = await import('../src/story/sightings.js');
const { Dialogue } = await import('../src/story/dialogue.js');
const { sketchesPanel, SIGHT_COLS } = await import('../src/game-menu.js');
const { sketchesData } = await import('../src/game-menu-data.js');
const { ORDER, SIDE } = await import('../src/levels/names.js');
const { parseLine } = await import('../src/story/tone.js');

/** A save of its own (the GameState of src/game-state.js, on a storage we hold). */
async function freshGame(store = new Map()) {
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const mod = await import('../src/game-state.js');
  return { game: new mod.game.constructor(storage), store };
}

/** Every person of the route's worlds (their talk), by id: the story data and the level content. */
async function everyone() {
  const out = new Map();
  const walk = (o, seenSet = new Set()) => {
    if (!o || typeof o !== 'object' || seenSet.has(o)) return;
    seenSet.add(o);
    if (o.talk && o.id) { if (!out.has(o.id)) out.set(o.id, []); out.get(o.id).push(o.talk); }
    for (const [k, v] of Object.entries(o)) if (k !== 'palette') walk(v, seenSet);
  };
  for (const w of ['desert', 'arzach', 'arzach2', 'perdide', 'perdide2', 'edena', 'incal', 'garage', 'buried', 'spheres', 'bazaar']) walk(await import(`../src/story/${w}-data.js`));
  walk((await import('../src/levels/content.js')).CONTENT);
  return out;
}
const text = (say) => [].concat(say ?? []).map((x) => (typeof x === 'string' ? x : x?.text ?? '')).join(' ');

test('every sighting is in a thread, unique, short, and every route world has some', () => {
  const ids = new Set();
  for (const s of SIGHTINGS) {
    assert.ok(!ids.has(s.id), `unique: ${s.id}`); ids.add(s.id);
    assert.ok(THREADS.some((t) => t.id === s.thread), `${s.id}: a thread`);
    assert.ok([...ORDER, ...SIDE].includes(s.world), `${s.id}: a world`);
    assert.ok(s.line && s.line.length <= 140 && s.who, `${s.id}: a short line and who`);
    assert.doesNotMatch(s.line, /\bsister\b/i, 'it hints, it never says');
  }
  for (const w of ORDER) assert.ok(SIGHTINGS.some((s) => s.world === w), `a sighting in ${w}`);
});

test('every route sighting is keyed on a real line: the person, the node, the words', async () => {
  const people = await everyone();
  const src = readdirSync(new URL('../src/story/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => readFileSync(new URL(`../src/story/${f}`, import.meta.url), 'utf8')).join('\n');
  for (const s of SIGHTINGS) {
    if (s.flag) { assert.ok(src.includes(`'${s.flag}'`), `${s.id}: its flag ${s.flag} is set by the story`); continue; }
    if (!s.heard) continue;   // (a detour's: its own flag)
    const talks = people.get(s.heard.who);
    assert.ok(talks, `${s.id}: ${s.heard.who} exists`);
    if (s.heard.node === 'listen') {
      const entries = talks.flatMap((t) => t.listen ?? []);
      assert.ok(entries.some((e) => text(e?.say ?? e).includes(s.heard.has)), `${s.id}: ${s.heard.who} says “${s.heard.has}”`);
    } else {
      const n = talks.map((t) => t.nodes?.[s.heard.node]).find(Boolean);
      assert.ok(n, `${s.id}: ${s.heard.who} has the node ${s.heard.node}`);
      if (s.heard.has) assert.ok(text(n.say).includes(s.heard.has));
    }
  }
});

test('a conversation writes it down, once, with a word; the save keeps it', async () => {
  const { game, store } = await freshGame();
  const toasts = [];
  const off = recordSightings(game, { toast: (t) => toasts.push(t) });
  const oum = { id: 'oum', name: 'Oum', talk: { nodes: { light: { say: ['~solemn~ A light crossed the dunes.'], choices: [{ text: '~neutral~ Bye.', end: true }] } } } };
  const d = new Dialogue({ game, quests: null });
  assert.equal(seen('desert.oum', game), false);
  d.start({ ...oum, talk: { entry: [{ node: 'light' }], nodes: oum.talk.nodes } });
  assert.equal(seen('desert.oum', game), true, 'heard: written down');
  assert.equal(toasts.length, 1);
  assert.match(toasts[0], /Sightings/);
  d.close(); d.start({ ...oum, talk: { entry: [{ node: 'light' }], nodes: oum.talk.nodes } }); d.close();
  assert.equal(toasts.length, 1, 'said once');
  // a listen-only person: the words say which entry it was
  assert.deepEqual(sightingsOf({ id: 'tamsin', node: 'listen', say: '~neutral~ When the stones hum, get behind something.' }), []);
  assert.deepEqual(sightingsOf({ id: 'tamsin', node: 'listen', say: '~curious~ But the night before you came down, they hummed.' }).map((s) => s.id), ['desert.dalia']);
  // a line's own effect (a detour's), and a flag the story sets
  game.set(sightingFlag('desert.nour'), true);
  assert.equal(toasts.length, 2, 'a sighting set by a line is said too');
  game.set('signature.told', true);
  assert.equal(seen('ship.signature', game), true);
  off();
  // the save: read again, all still met
  const again = (await freshGame(store)).game;
  for (const id of ['desert.oum', 'desert.nour', 'ship.signature']) assert.equal(seen(id, again), true, `kept: ${id}`);
  assert.equal(seen('bazaar.voice', again), false);
});

test('an old save: what it already holds is written down quietly', async () => {
  const { game } = await freshGame();
  game.set('signature.told', true);
  const toasts = [];
  recordSightings(game, { toast: (t) => toasts.push(t) });
  assert.equal(game.flag(sightingFlag('ship.signature')), true);
  assert.deepEqual(toasts, []);
});

test('the Sightings page: a block a thread, a ? for each still to find, the world named once you know it', async () => {
  const { game } = await freshGame();
  game.set(sightingFlag('desert.oum'), true);
  const titles = { desert: 'The Desert', arzach: 'Vael' };
  const data = sightingsData({ game, known: (id) => id === 'desert' || id === 'arzach', titles });
  assert.deepEqual(data.map((t) => t.id), THREADS.map((t) => t.id));
  const light = data.find((t) => t.id === 'light');
  assert.equal(light.found, 1);
  assert.equal(light.entries[0].id, 'desert.oum', 'the ones met first');
  assert.equal(light.entries[0].who, 'Oum');
  const senn = light.entries.find((e) => e.id === 'arzach.senn');
  assert.deepEqual([senn.found, senn.line, senn.world], [false, '?', 'Vael'], 'not met: a ?, its world known');
  assert.equal(light.entries.find((e) => e.id === 'bazaar.ferro').world, '', 'a world not known yet stays unnamed');
  // the panel: the notes in a grid of SIGHT_COLS, as the cursor moves, then the worlds' rows
  const sk = sketchesData({ data: { stories: {} }, levels: [{ id: 'desert', title: 'The Desert', relicNames: ['r'] }], sightings: data });
  const { html, rows } = sketchesPanel(sk);
  const notes = rows.filter((r) => r[0].kind === 'sighting');
  assert.equal(notes.flat().length, data.reduce((n, t) => n + t.of, 0), 'a cell for every sighting');
  assert.ok(notes.every((r) => r.length <= SIGHT_COLS && r.every((c, i) => c.col === i)));
  assert.equal(rows.at(-1)[0].kind, 'story', 'the worlds after');
  assert.equal(notes[0][0].name, light.entries[0].line);
  assert.match(notes[0][0].sub, /The Desert · Oum/);
  assert.match(html, /class="sightings"/);
  assert.match(html, /<i>\?<\/i>/);
  // no sightings given (an old caller): the sketchbook as it was
  assert.ok(!sketchesPanel({ worlds: sk.worlds }).html.includes('sightings'));
});

test('every sighting line reads in plain words (no tone tags: they are notes, not dialogue)', () => {
  for (const s of SIGHTINGS) assert.equal(parseLine(s.line).text, s.line, s.id);
});
