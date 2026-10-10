// The playtest of 2026-10-08, HUD and prompts: notices that covered the health bar, a quest's start
// that looked like any other notice, and the errand's toast.
import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutCinema, overlaps, questToastHtml, OBSTACLES, Cinema } from '../src/ship/cinema.js';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';
import { Errands } from '../src/quest.js';
import { setHintLevel } from '../src/hint-level.js';

const HEALTH = (top = 0) => ({ x0: 16, y0: 14 + top, x1: 170, y1: 31 + top });   // index.html #health, with its border and shadow

test('bug: a wide notice covered the health bar; the bar is always kept clear', () => {
  assert.ok(OBSTACLES.includes('#health'), 'measured whether it shows or not: it comes up the moment you are hurt');
  for (const [w, h, tw] of [[1280, 720, 560], [812, 375, 560], [667, 375, 560], [375, 812, 343]]) {
    const L = layoutCinema({ w, h, items: [{ id: 'toast', w: tw, h: 30, place: 'top' }, { id: 'hint', w: 300, h: 26, place: 'top' }], obstacles: [HEALTH()] });
    const all = { ...L.rects, health: HEALTH() };
    assert.deepEqual(overlaps(all), [], `${w}x${h}: nothing on the health bar`);
    assert.ok(L.fits, `${w}x${h}: all on screen`);
  }
  // a narrow notice stays at the top, beside the bar
  const L = layoutCinema({ w: 1280, h: 720, items: [{ id: 'toast', w: 400, h: 30, place: 'top' }], obstacles: [HEALTH()] });
  assert.equal(L.rects.toast.y0, 12);
});

test('bug: on a phone on its side a notice was pushed under the touch buttons, off the screen; it slides left of them', () => {
  // 812 x 375: the health bar top left, the gear top right, the touch buttons down the right half (as measured in the game)
  const buttons = [[552, 30, 606, 85], [552, 93, 606, 147], [476, 155, 530, 209], [548, 161, 612, 225], [636, 110, 700, 174], [724, 125, 788, 189],
    [636, 191, 700, 255], [710, 207, 788, 285], [636, 271, 700, 335], [538, 241, 612, 315], [768, 12, 800, 44]].map(([x0, y0, x1, y1]) => ({ x0, y0, x1, y1 }));
  const obstacles = [HEALTH(), ...buttons];
  const L = layoutCinema({ w: 812, h: 375, items: [{ id: 'toast', w: 487, h: 50, place: 'top' }], obstacles });
  assert.ok(L.fits, 'on the screen');
  assert.deepEqual(overlaps({ ...Object.fromEntries(obstacles.map((o, i) => [`o${i}`, o])), toast: L.rects.toast }).filter((p) => p.includes('toast')), []);
  assert.ok(L.rects.toast.y1 < 120, `near the top (${L.rects.toast.y0})`);
});

test('a quest\'s start has its own card: a head, the title, the first step', () => {
  const html = questToastHtml({ head: 'New quest', title: 'The bell <of> stone', step: 'Find the clapper' });
  assert.match(html, /class="qk">◆ New quest</);
  assert.match(html, /class="qt">The bell &lt;of&gt; stone</, 'escaped');
  assert.match(html, /class="qs">Find the clapper</);
  assert.doesNotMatch(questToastHtml({ title: 'Alone' }), /qs/, 'no step, no empty line');
});

test('the toast queue keeps a quest\'s look with it (and plain notices stay plain)', () => {
  const c = new Cinema();   // (no DOM in node: the queue alone)
  c.toast('Picked up a feather');
  c.toast('Quest: Bells · ring them', { kind: 'quest', head: 'New quest', title: 'Bells', step: 'ring them' });
  c.toast('Quest: Bells · ring them', { kind: 'quest', head: 'New quest', title: 'Bells', step: 'ring them' });
  assert.equal(c.toasts.length, 2, 'the same line twice in a row is queued once');
  assert.deepEqual(c.toasts[0], { text: 'Picked up a feather' });
  assert.equal(c.toasts[1].kind, 'quest');
  assert.equal(c.toasts[1].title, 'Bells');
  c.toast('Something', { kind: 'other', title: 'x' });
  assert.deepEqual(c.toasts[2], { text: 'Something' }, 'only the quest kind is kept');
});

const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('hints full: starting a quest asks for the quest card; its later steps and its end are plain notices', (t) => {
  setHintLevel('full'); t.after(() => setHintLevel('subtle'));
  const said = [];
  const q = new Quests({ game: new GameState(store()), toast: (text, o) => said.push({ text, o }) });
  q.define({ id: 'bells', title: 'The bells', main: true, stages: [{ id: 'a', text: 'Find the clapper' }, { id: 'b', text: 'Ring it' }] });
  q.define({ id: 'pot', title: 'A pot', stages: [{ id: 'a', text: 'Bring it back' }] });
  q.start('bells');
  assert.equal(said[0].text, 'Quest: The bells · Find the clapper');
  assert.deepEqual(said[0].o, { kind: 'quest', head: 'New quest', title: 'The bells', step: 'Find the clapper' });
  q.advance('bells');
  assert.equal(said[1].o, undefined, 'the next step: an ordinary notice');
  q.complete('bells');
  assert.equal(said[2].o, undefined);
  q.start('pot');
  assert.equal(said[3].o.head, 'New errand');
  // the quest a conversation opens says so at the talk's end, as a quest card too
  q.define({ id: 'talk', title: 'Ask around', stages: [{ id: 'a', text: 'Ask Teo' }] });
  q.opener = { id: 'talk', who: ['teo'], label: null, at: null };
  q.opening('teo');
  assert.equal(said.length, 4, 'quiet during the talk');
  q.opened();
  assert.equal(said[4].o.kind, 'quest');
});

test('hints subtle (the default): a quest\'s card is its title alone; its later steps are not pushed on the screen (the chime, the quest log); its end still is', () => {
  const said = [];
  const q = new Quests({ game: new GameState(store()), toast: (text, o) => said.push({ text, o }) });
  q.define({ id: 'bells', title: 'The bells', main: true, stages: [{ id: 'a', text: 'Find the clapper' }, { id: 'b', text: 'Ring it' }] });
  q.start('bells');
  assert.equal(said[0].text, 'Quest: The bells');
  assert.deepEqual(said[0].o, { kind: 'quest', head: 'New quest', title: 'The bells', step: '' });
  q.advance('bells');
  assert.equal(said.length, 1, 'the next step: no notice');
  assert.equal(q.stage('bells'), 'b', 'the quest moved on all the same');
  q.complete('bells');
  assert.equal(said[1].text, 'Completed: The bells');
});

test('an errand handed over by a villager is a quest card too', () => {
  const said = [];
  const npc = { greeted: true, lines: ['hi'], pos: { x: 0, y: 0, z: 0 }, heading: 0 };
  const journal = { errands: {}, errand(id) { return this.errands[id]; }, setErrand(id, v) { this.errands[id] = v; } };
  const e = new Errands({ levelId: 'w1', defs: [{ id: 'jar', item: 'a jar', from: ['w1', 'ama'], to: ['w2', 'teo'], ask: 'Take it?', wait: '…', thanks: 'Thanks' }],
    npcs: { ama: npc }, journal, titles: { w2: 'Salt Harbour' }, toast: (text, o) => said.push({ text, o }) });
  e.update();
  assert.equal(said[0].text, 'Errand: carry a jar to Salt Harbour');
  assert.deepEqual(said[0].o, { kind: 'quest', head: 'New errand', title: 'Carry a jar', step: 'to Salt Harbour' });
});
