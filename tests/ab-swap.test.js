import test from 'node:test';
import assert from 'node:assert/strict';
import { padText, setSwapAB, swapAB, watchLabels } from '../src/native-pad.js';
import { Controller } from '../src/controller.js';

const pad = (pressed) => ({ index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) });

function rig(swap, ctx = 'game') {
  let current = pad([]);
  const actions = [];
  const c = new Controller({ pads: () => [current], context: () => ctx, action: (a) => actions.push(a), look() {}, navigate() {}, scroll() {}, swapAB: () => swap });
  return { actions, press: (...b) => { current = pad(b); return c.update(1 / 60); }, release: () => { current = pad([]); return c.update(1 / 60); } };
}

test('default: A (button 0) jumps and confirms, B (button 1) pushes and goes back', () => {
  const g = rig(false);
  assert.ok(g.press(0).Space); g.release();
  assert.ok(g.press(1).PadPush);
  const m = rig(false, 'menu');
  m.press(0); m.release(); m.press(1);
  assert.deepEqual(m.actions, ['confirm', 'back']);
});

test('swapped: B jumps and confirms, A pushes and goes back', () => {
  const g = rig(true);
  let h = g.press(1);
  assert.ok(h.Space && !h.PadPush, 'B jumps'); g.release();
  h = g.press(0);
  assert.ok(h.PadPush && !h.Space, 'A pushes');
  const m = rig(true, 'menu');
  m.press(1); m.release(); m.press(0);
  assert.deepEqual(m.actions, ['confirm', 'back']);
  const p = rig(true, 'photo');
  p.press(1); p.release(); p.press(0);
  assert.deepEqual(p.actions, ['capture', 'photo'], 'photo mode: B saves, A exits');
});

test('swapped prompts name the other button', () => {
  const hint = 'A / × jump · X / □ use · B / ○ push · A/× confirm, B/○ back';
  assert.equal(padText(hint, 'android', true), 'B jump · X use · A push · B confirm, A back');
  assert.equal(padText(hint, 'standard', true), 'B / ○ jump · X / □ use · A / × push · B/○ confirm, A/× back');
  assert.equal(padText(hint, 'android', false), 'A jump · X use · B push · A confirm, B back');
  assert.equal(padText('A small box. B-side.', 'android', true), 'A small box. B-side.', 'ordinary words stay');
});

test('the page relabels when the setting changes, and back', () => {
  const text = (v) => ({ nodeType: 3, nodeValue: v });
  const nodes = [text('A / × jump · B / ○ push'), text('Menu of the day')];
  const body = { nodeType: 1, tagName: 'BODY', childNodes: nodes };
  let observed = 0;
  const win = { document: { body }, location: { search: '' }, localStorage: { getItem: () => 'standard' }, navigator: {},
    MutationObserver: class { observe() { observed++; } } };
  watchLabels(win);
  assert.equal(observed, 0, 'standard layout, no swap: nothing to watch');
  assert.equal(swapAB(), false);
  setSwapAB(true, win);
  assert.equal(nodes[0].nodeValue, 'B / ○ jump · A / × push');
  assert.equal(observed, 1);
  watchLabels(win);   // (as when the observer sees its own change) must not swap it back
  assert.equal(nodes[0].nodeValue, 'B / ○ jump · A / × push');
  setSwapAB(false, win);
  assert.equal(nodes[0].nodeValue, 'A / × jump · B / ○ push', 'the prompt as the game wrote it');
  assert.equal(nodes[1].nodeValue, 'Menu of the day');
});
