import test from 'node:test';
import assert from 'node:assert/strict';
import { screen } from '../src/platform.js';
import { Cue, questCueHtml, findSummary } from '../src/hud.js';
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


test('enamel quest column preserves one-line scout content and existing two-line payloads', () => {
  const single = questCueHtml(findSummary({ goal: 'Do not invent a title', step: 'Find the stair · 120 m' }));
  assert.doesNotMatch(single, /class="goal"|Do not invent/);
  assert.equal((single.match(/◆/g) ?? []).length, 1);
  assert.match(single, /class="qi" aria-hidden="true"/);
  assert.match(single, /class="step">Find the stair · 120 m/);
  const pair = questCueHtml('The silent tower\nFind the eastern stair');
  assert.match(pair, /class="goal">The silent tower/);
  assert.match(pair, /class="step">Find the eastern stair/);
  assert.match(questCueHtml('<tower>\n<E>'), /&lt;tower&gt;/);
  const toast = questToastHtml({head:'New errand', title:'Parcel'});
  assert.match(toast, /class="qk errand" aria-hidden="true">◇/);
  assert.match(toast, /class="qcopy"><span class="qh">New errand/);
  assert.doesNotMatch(toast, /class="qs"/);
});

test('cue button column retains platform key and wrapped words without changing the screen payload', () => {
  const el = {innerHTML:'',classList:{toggle(){}}}, c = new Cue(el);
  c.set('X / □ Inspect the mechanism');
  assert.equal(screen.state.cue.key, 'X / □');
  assert.equal(screen.state.cue.rest, 'Inspect the mechanism');
  assert.match(el.innerHTML, /class="key">X \/ □/);
  assert.match(el.innerHTML, /class="hint-copy">Inspect the mechanism/);
  c.set('E'); assert.doesNotMatch(el.innerHTML, /hint-copy/);
  c.set('Old market','place'); assert.doesNotMatch(el.innerHTML, /qi|hint-copy/);
  c.set(''); assert.equal(screen.state.cue,null); c.dispose();
});


test('column widths reserve actual badges and retain contextual touch caps', () => {
  const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  const css = read('index.html'), glyph = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.Glyph.cs'), native = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.cs');
  assert.match(css, /min-width: min\(19em, var\(--enamel-width-cap/);
  assert.match(css, /--enamel-width-cap: calc\(100vw - 96px\)/);
  assert.match(css, /--enamel-width-cap: min\(32em, 60vw\)/);
  assert.ok(glyph.indexOf('var k = PlaceBadge(cueBadge, 12, 10') < glyph.indexOf('W - 32 - k.x - 52'));
  assert.match(native, /W - 16 - kw - 52/);
  for (const W of [390, 640, 1280]) for (const badge of [28, 56, 91]) {
    const textWidth = Math.min(860, W - 32 - badge - 52);
    assert.ok(badge + 52 + textWidth <= W - 32);
  }
});
