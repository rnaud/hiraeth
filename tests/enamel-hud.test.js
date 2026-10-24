import test from 'node:test';
import assert from 'node:assert/strict';
import { screen } from '../src/platform.js';
import { Cue } from '../src/hud.js';
import { Cinema, questToastHtml, layoutCinema } from '../src/ship/cinema.js';
import { readFileSync } from 'node:fs';

test('quest notices carry only existing semantic heading/title and suppress automatic steps', () => {
  screen.reset();
  screen.toast('Quest: A room', 4, { kind: 'quest', title: 'A room', step: 'Unrequested advice', id: -1, callback() {} });
  assert.equal(screen.state.toast.head, 'New quest');
  assert.equal(screen.state.toast.title, 'A room');
  assert.equal(screen.state.toast.step, '');
  assert.equal(screen.state.toast.mark, '◆');
  screen.toast('Errand', 4, {kind: 'quest', head: 'New errand', title: 'Parcel'});
  assert.equal(screen.state.toast.mark, '◇');
  assert.ok(screen.state.toast.id > 0);
  assert.equal(screen.state.toast.callback, undefined);
  screen.toast('Found a key', 3);
  assert.deepEqual(Object.keys(screen.state.toast).sort(), ['id', 'secs', 'text']);
});

test('real Cinema queue forwards quest metadata without restoring suppressed advice', () => {
  screen.reset(); const c = new Cinema();
  c.toast('Quest: A room', { kind: 'quest', head: 'New quest', title: 'A room', step: 'Do not display this' });
  assert.equal(c.toasts.length, 1); assert.equal(c.toasts[0].step, '');
  c.toastEl = { innerHTML: '', style: {}, classList: { toggle() {}, remove() {}, add() {}, contains() { return false; } }, offsetWidth: 100 };
  c.dom = true; c.dark = () => false; c.layout = () => {};
  const oldDocument = globalThis.document; globalThis.document = { getElementById: () => null };
  try { c._pumpToasts(); } finally { globalThis.document = oldDocument; }
  assert.equal(c.toasts.length, 0);
  assert.equal(screen.state.toast.kind, 'quest'); assert.equal(screen.state.toast.title, 'A room');
  assert.equal(screen.state.toast.step, '');
  assert.match(c.toastEl.innerHTML, /class="qh">New quest/);
  assert.doesNotMatch(c.toastEl.innerHTML, /Do not display/);
  assert.match(c.toastEl.innerHTML, /aria-hidden="true"/);
  assert.doesNotMatch(c.toastEl.innerHTML, /aria-label="New quest"/);
  c.dom = false; c.toast('Unsolicited advice', { kind: 'hint' }); assert.equal(c.toasts.length, 0);
  c.objective('Unsolicited objective'); c.hint('Unsolicited hint');
  assert.equal(screen.state.objective, null); assert.ok(!screen.state.cine?.hint);
});

test('quest heading and title remain escaped, empty step creates no next action', () => {
  const html = questToastHtml({ head: '<new>', title: '<room>', step: '' });
  assert.match(html, /&lt;new&gt;/); assert.match(html, /&lt;room&gt;/);
  assert.doesNotMatch(html, /class="qs"/);
});

test('actual cue size changes reflow notices and observer disposal stops ownership', () => {
  const old = globalThis.ResizeObserver; let observer;
  globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb; observer = this; } observe(el) { this.el = el; } disconnect() { this.disconnected = true; } };
  try {
    const el = { innerHTML: '', classList: { toggle() {} } }, c = new Cue(el); let calls = 0;
    c.onChange = () => calls++; c.set('Short', 'quest'); assert.equal(calls, 1);
    c.set('A much longer line that wraps', 'quest'); assert.equal(calls, 1);
    observer.cb(); assert.equal(calls, 2); assert.equal(observer.el, el);
    const L = layoutCinema({ w: 390, h: 620, items: [{ id: 'cue', w: 358, h: 110, place: 'top' }, { id: 'toast', w: 350, h: 70, place: 'top' }] });
    assert.ok(L.rects.toast.y0 >= L.rects.cue.y1);
    c.dispose(); assert.equal(observer.disconnected, true);
  } finally { globalThis.ResizeObserver = old; }
});

test('enamel exceptions and native cleanup preserve glyph, place and plain solid modes', () => {
  const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  const css = read('index.html'), native = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.Hints.cs'), glyph = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.Glyph.cs');
  assert.match(css, /#cue:not\(\.glyph\):not\(\.place\)::before/);
  assert.match(css, /html\.speech-solid #cue::before/);
  assert.match(native, /decorated && !solid/);
  assert.match(native, /TryGetValue/);
  assert.match(glyph, /HintTrim\(prompt, false\)/); assert.match(glyph, /HintTrim\(cue, false\)/);
});
