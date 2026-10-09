import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputMode, INPUT_MODE_KEY, rememberInput } from '../src/input-mode.js';

const memory = (init = {}) => {
  const m = { ...init };
  return { m, get: (k) => m[k] ?? null, set: (k, v) => { m[k] = v; } };
};
const key = (o = {}) => ({ type: 'keydown', code: 'KeyW', isTrusted: true, ...o });
const classes = () => {
  const set = new Set();
  return { set, toggle: (n, on) => (on ? set.add(n) : set.delete(n)), contains: (n) => set.has(n) };
};

test('a phone with nothing remembered shows the touch buttons; a desktop has none', () => {
  const phone = new InputMode({ touchDevice: true, storage: memory() });
  assert.equal(phone.kind, 'touch');
  assert.equal(phone.touchButtons, true);
  const desk = new InputMode({ touchDevice: false, storage: memory() });
  assert.equal(desk.kind, 'keys');
  assert.equal(desk.touchButtons, false);
});

test('bug: loading a new world brought the touch buttons back while a controller was in use', () => {
  const s = memory();
  const before = new InputMode({ touchDevice: true, storage: s });
  before.pad();
  assert.equal(s.m[INPUT_MODE_KEY], 'pad');
  // the next world: a new page, where the browser lists no pad until it is pressed again
  const after = new InputMode({ touchDevice: true, storage: s });
  assert.equal(after.kind, 'pad', 'remembered from the world before');
  const cl = classes();
  after.apply(cl);
  assert.ok(cl.contains('controller') && !cl.contains('touch'), 'no touch buttons from the first frame');
  for (let i = 0; i < 100; i++) after.frame(false);
  assert.equal(after.kind, 'pad', 'still hidden while the pad is not listed yet');
  after.frame(true);
  assert.equal(after.kind, 'pad');
  after.frame(false);
  assert.equal(after.kind, 'touch', 'once listed, a pad that goes gives the screen back');
});

test('bug: the keyboard on a touch screen kept the touch buttons up, and a new world kept it so', () => {
  const s = memory();
  const m = new InputMode({ touchDevice: true, storage: s });
  m.event(key());
  assert.equal(m.kind, 'keys');
  assert.equal(m.touchButtons, false);
  const next = new InputMode({ touchDevice: true, storage: s });
  assert.equal(next.touchButtons, false, 'the next world opens without them');
  next.frame(true);
  assert.equal(next.kind, 'keys', 'a connected pad nobody pressed does not take over from the keys chosen before');
  next.event({ type: 'touchstart' });
  assert.equal(next.touchButtons, true, 'a finger on the screen brings them back');
});

test('the touch buttons\' own key presses, typing in a field and a handheld\'s code-less keys change nothing', () => {
  const m = new InputMode({ touchDevice: true, storage: memory() });
  m.event(key({ isTrusted: false }));
  m.event(key({ target: { closest: (sel) => (sel.includes('input') ? {} : null) } }));
  m.event(key({ code: '' }));
  assert.equal(m.kind, 'touch');
});

test('a tap is a touch, a click is the mouse', () => {
  const m = new InputMode({ touchDevice: true, storage: memory() });
  m.event({ type: 'pointerdown', pointerType: 'mouse' });
  assert.equal(m.kind, 'keys');
  m.event({ type: 'pointerdown', pointerType: 'touch' });
  assert.equal(m.kind, 'touch');
});

test('a connected handheld pad counts as in use from the start, until the screen is touched', () => {
  const m = new InputMode({ touchDevice: true, storage: memory() });
  assert.equal(m.frame(true), 'pad');
  m.event({ type: 'touchstart' });
  assert.equal(m.frame(true), 'touch', 'the screen took over');
  m.pad();
  assert.equal(m.frame(true), 'pad', 'and back on the pad\'s next press');
});

test('a desktop never gets the touch kind; the worlds list remembers a pad for the world it opens', () => {
  const s = memory({ [INPUT_MODE_KEY]: 'touch' });
  assert.equal(new InputMode({ touchDevice: false, storage: s }).kind, 'keys');
  const s2 = memory();
  rememberInput('pad', s2);
  rememberInput('nonsense', s2);
  assert.equal(new InputMode({ touchDevice: true, storage: s2 }).kind, 'pad');
});
