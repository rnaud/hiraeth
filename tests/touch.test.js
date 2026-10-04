import { test } from 'node:test';
import assert from 'node:assert/strict';

// Exercise the real touch bindings, including events bubbling from a menu.
test('menu swipes remain native while canvas gestures move and look', async () => {
  const canvas = new EventTarget(), win = new EventTarget();
  const stick = { style: {}, classList: { add() {}, remove() {} } };
  const nub = { style: {} };
  const root = { querySelector: s => s === '.stick' ? stick : nub, querySelectorAll: () => [] };
  globalThis.window = win;
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.innerWidth = 400;
  globalThis.document = {
    body: { classList: { add() {} } },
    getElementById: () => root,
    querySelector: () => canvas,
  };
  try {
    const { TouchControls } = await import('../src/ui.js');
    const input = {}, looks = [];
    new TouchControls(input, { look: (...args) => looks.push(args) });
    // the fluid tool's buttons: aim (toggle), shoot and push (held keys); jump boosts in the air
    assert.match(root.innerHTML, /data-toggle="KeyR" class="b-aim"/);
    assert.match(root.innerHTML, /data-key="KeyG" class="b-fire"/);
    assert.match(root.innerHTML, /data-key="KeyC" class="b-push"/);
    assert.doesNotMatch(root.innerHTML, /KeyX|b-mode/, 'no mode switch any more');
    const touch = (identifier, clientX, clientY) => ({ identifier, clientX, clientY, target: canvas });
    const fire = (target, type, changedTouches) => {
      const event = new Event(type, { cancelable: true });
      event.changedTouches = changedTouches;
      target.dispatchEvent(event);
      return event;
    };
    assert.equal(fire(win, 'touchmove', [touch(9, 200, 150)]).defaultPrevented, false);
    fire(canvas, 'touchstart', [touch(1, 50, 200), touch(2, 300, 200)]);
    assert.equal(fire(canvas, 'touchmove', [touch(1, 50, 140), touch(2, 320, 210)]).defaultPrevented, true);
    assert.equal(input.KeyW, true);
    assert.deepEqual(looks, [[32, 16]]);
    // An independent menu finger must still be free to scroll during a held stick.
    assert.equal(fire(win, 'touchmove', [touch(9, 200, 100)]).defaultPrevented, false);
    fire(win, 'touchend', [touch(1, 50, 140), touch(2, 320, 210)]);
    assert.equal(input.stick, null);
    assert.equal(input.KeyW, false);
  } finally {
    for (const name of ['window', 'document', 'matchMedia', 'innerWidth']) delete globalThis[name];
  }
});
