import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SlotStore, slotKey, PROGRESS_KEYS, SLOT_KEY, SLOTS_VERSION_KEY, formatPlaytime, formatDate, progressLine } from '../src/save-slots.js';
import { GameState } from '../src/game-state.js';

const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const legacy = () => mem({
  'moebius.game.v1': JSON.stringify({ flags: { 'prologue.done': true, 'world.desert.done': true, 'item.backpack': true, 'item.glider': true, 'item.jar': 2, 'ship.level': 'incal' }, keepsakes: [] }),
  'moebius.journal.v1': JSON.stringify({ relics: { desert: { 0: {}, 3: {} }, incal: { 1: {} } }, stories: { desert: {}, incal: {} }, seen: {} }),
  'moebius.save.v1': JSON.stringify({ level: 'incal', pos: [1, 2, 3], t: 1759000000000 }),
  'moebius.encounters.v1': '{"seen":[]}',
  'moebius.settings.v1': '{"music":0.5}',
  'moebius.muted': '1',
});

test('slot keys: every progress key is filed under its slot', () => {
  assert.equal(slotKey('moebius.game.v1', 3), 'moebius.s3.game.v1');
  assert.deepEqual(PROGRESS_KEYS.map((k) => slotKey(k, 1)), ['moebius.s1.game.v1', 'moebius.s1.journal.v1', 'moebius.s1.save.v1', 'moebius.s1.encounters.v1']);
});

test('the single save from before the slots becomes slot 1, once, and the old keys stay', () => {
  const st = mem(Object.fromEntries(legacy().m));
  const slots = new SlotStore(st);
  assert.equal(slots.active, 1);   // (reading the slot runs the migration)
  for (const k of PROGRESS_KEYS) assert.equal(st.getItem(slotKey(k, 1)), st.getItem(k), k);
  assert.equal(st.getItem(SLOTS_VERSION_KEY), '1');
  assert.equal(slots.meta(1).lastPlayed, 1759000000000);
  // settings and mute stay global
  assert.equal(st.getItem('moebius.s1.settings.v1'), null);
  assert.equal(st.getItem('moebius.s1.muted'), null);
  // once: a later run doesn't copy the (stale) old save over slot 1 again
  st.setItem(slotKey('moebius.game.v1', 1), '{"flags":{}}');
  assert.equal(new SlotStore(st).migrate(), false);
  assert.equal(st.getItem(slotKey('moebius.game.v1', 1)), '{"flags":{}}');
});

test('a fresh install has three empty slots and nothing to continue', () => {
  const slots = new SlotStore(mem());
  assert.equal(slots.migrate(), false);
  assert.equal(slots.list().length, 3);
  assert.ok(slots.list().every((s) => s.empty));
  assert.equal(slots.latest(), null);
  assert.equal(slots.firstEmpty(), 1);
});

test('the summary: world, worlds done, relics, items, playtime, last played', () => {
  const slots = new SlotStore(mem(Object.fromEntries(legacy().m)));
  const s = slots.summary(1);
  assert.equal(s.empty, false);
  assert.equal(s.level, 'incal');
  assert.equal(s.world, 'The City-Shaft');
  assert.equal(s.worldsDone, 2);   // world.desert.done, and the City-Shaft's story page
  assert.equal(s.relics, 3);
  assert.equal(s.items, 2);        // the backpack and the glider; the jar is a carried count
  assert.equal(s.prologue, false);
  assert.equal(progressLine(s), '2 / 11 worlds · 3 relics · 2 items');
  assert.equal(progressLine(slots.summary(2)), 'New game');
  slots.touch(1, { addSeconds: 125, now: 1759100000000 });
  slots.touch(1, { addSeconds: 60, now: 1759200000000 });
  assert.equal(slots.summary(1).playtime, 185);
  assert.equal(slots.summary(1).lastPlayed, 1759200000000);
});

test('each slot is its own game: the game state reads and writes the active slot only', () => {
  const st = mem();
  const slots = new SlotStore(st);
  slots.setActive(2);
  const g2 = new GameState(slots.view());
  g2.set('prologue.done', true);
  assert.ok(st.getItem('moebius.s2.game.v1').includes('prologue.done'));
  assert.equal(st.getItem('moebius.game.v1'), null);
  assert.equal(st.getItem(SLOT_KEY), '2');
  // the next page (a new world) reads the slot back
  const again = new SlotStore(st);
  assert.equal(again.active, 2);
  assert.equal(new GameState(again.view()).flag('prologue.done'), true);
  assert.equal(new GameState(again.view(3)).flag('prologue.done'), undefined);
  assert.throws(() => slots.setActive(6), RangeError);
});

test('the active slot is pinned for the page: another tab choosing a slot does not move it', () => {
  const st = mem({ [SLOT_KEY]: '3' });
  const slots = new SlotStore(st);
  assert.equal(slots.active, 3);
  st.setItem(SLOT_KEY, '1');
  assert.equal(slots.active, 3);
  assert.equal(new SlotStore(mem({ [SLOT_KEY]: 'nonsense' })).active, 1);
});

test('deleting a slot forgets it, and leaves the others and the settings alone', () => {
  const st = mem(Object.fromEntries(legacy().m));
  const slots = new SlotStore(st);
  slots.migrate();
  slots.setActive(3);
  new GameState(slots.view()).set('prologue.done', true);
  slots.touch(3, { addSeconds: 30 });
  assert.equal(slots.latest(), 3);
  slots.remove(3);
  assert.equal(slots.summary(3).empty, true);
  assert.equal(st.getItem('moebius.s3.meta.v1'), null);
  assert.equal(slots.summary(1).empty, false);
  assert.equal(slots.latest(), 1);
  assert.equal(st.getItem('moebius.settings.v1'), '{"music":0.5}');
  slots.remove(1);
  assert.equal(slots.latest(), null);
  // the old pre-slot keys were kept (for an older build), but never come back into slot 1
  assert.ok(st.getItem('moebius.game.v1'));
  assert.equal(new SlotStore(st).summary(1).empty, true);
});

test('Continue picks the slot played last', () => {
  const slots = new SlotStore(mem());
  for (const [n, t] of [[1, 100], [2, 300]]) { slots.setActive(n); new GameState(slots.view()).set('prologue.done', true); slots.touch(n, { now: t }); }
  assert.equal(slots.latest(), 2);
  assert.equal(slots.firstEmpty(), 3);
});

test('a new game in a slot reads as the prologue until it is played through', () => {
  const slots = new SlotStore(mem());
  slots.setActive(3);
  new GameState(slots.view()).set('objective', 'Find a new source of power.');
  const s = slots.summary(3);
  assert.equal(s.empty, false);
  assert.equal(s.prologue, true);
  assert.equal(s.world, 'The Desert');
  assert.equal(progressLine(s), 'Prologue');
});

test('playtime and dates, worded for the selector', () => {
  assert.equal(formatPlaytime(20), 'under a minute');
  assert.equal(formatPlaytime(12 * 60 + 5), '12 min');
  assert.equal(formatPlaytime(3600 + 5 * 60), '1 h 05');
  const now = new Date(2026, 9, 4, 18, 30).getTime();
  assert.equal(formatDate(new Date(2026, 9, 4, 9, 5).getTime(), now), 'today 09:05');
  assert.equal(formatDate(new Date(2026, 9, 3, 22, 0).getTime(), now), 'yesterday 22:00');
  assert.equal(formatDate(new Date(2026, 8, 12, 10, 0).getTime(), now), '12 Sep 2026');
  assert.equal(formatDate(null, now), '');
});
