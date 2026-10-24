import { HINT, HINT_VARS } from '../src/hint-look.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NoticePace, PACE, isHint } from '../src/notice-pace.js';

// Issue #221: the hints at the top "appear too often".
test('a hint is a teaching line or one naming a control; a quest\'s start never is', () => {
  assert.equal(isHint({ text: 'Jump with {key:jump}' }), true);
  assert.equal(isHint({ text: 'Plain words.', kind: 'hint' }), true);
  assert.equal(isHint({ text: 'Done: The Drum' }), false);
  assert.equal(isHint({ text: 'Quest {key:x}', kind: 'quest' }), false);
});

test('hints are spaced out; the other notices go ahead meanwhile', () => {
  const p = new NoticePace();
  const q = [{ text: 'Cut with {key:blade}.', at: 0 }, { text: 'Guard with {key:guard}.', at: 0 }, { text: 'The bell rings.', at: 0 }];
  let i = p.next(q, 0); assert.equal(i, 0); p.shown(q.splice(i, 1)[0], 0);
  i = p.next(q, 1); assert.equal(q[i].text, 'The bell rings.', 'a plain notice may pass the waiting hint'); p.shown(q.splice(i, 1)[0], 1);
  assert.equal(p.next(q, 5), -1, 'the second hint waits');
  assert.equal(p.next(q, PACE.gap), 0, 'until the gap is past');
});

test('a hint left waiting too long, or already done, or with hints off, goes unsaid', () => {
  const p = new NoticePace();
  const stale = [{ text: 'Old {key:jump}', at: 0 }];
  assert.equal(p.next(stale, PACE.stale + 1), -1); assert.equal(stale.length, 0);
  let did = false;
  const done = [{ text: 'Shove it.', kind: 'hint', at: 0, done: () => did }];
  did = true; assert.equal(p.next(done, 1), -1); assert.equal(done.length, 0, 'the player found the move on their own');
  const off = [{ text: 'A tip.', kind: 'hint', at: 0 }, { text: 'A find.', at: 0 }];
  assert.equal(off[p.next(off, 1, 'off')].text, 'A find.'); assert.equal(off.length, 1, 'hints off: none');
});

test('the same words twice in a few minutes: said once (a quest\'s start excepted)', () => {
  const p = new NoticePace();
  p.shown({ text: 'It needs power.' }, 10);
  const q = [{ text: 'It needs power.', at: 20 }];
  assert.equal(p.next(q, 20), -1); assert.equal(q.length, 0);
  const later = [{ text: 'It needs power.', at: 300 }];
  assert.equal(p.next(later, 10 + PACE.again + 1), 0, 'long after: again');
  p.shown({ text: 'Quest: X', kind: 'quest' }, 0);
  assert.equal(p.next([{ text: 'Quest: X', kind: 'quest', at: 1 }], 1), 0);
});

test('the notices\' queue goes through the pace, and the strip is dark and narrow', () => {
  const cine = readFileSync(new URL('../src/ship/cinema.js', import.meta.url), 'utf8');
  assert.match(cine, /this\.pace\.next\(this\.toasts, now\(\), hintLevel\(\)\)/);
  assert.match(cine, /this\.pace\.shown\(item, now\(\)\)/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const rule = html.slice(html.indexOf('      #toast {'), html.indexOf('}', html.indexOf('      #toast {')));
  assert.match(rule, /color: var\(--hint-ink\); background: var\(--hint-bg\)/, 'cream on ink: the hints\' strip (issue #306, src/hint-look.js)');
  assert.ok(html.includes(HINT_VARS));
  assert.match(html, /#toast \{ width: max-content; max-width: min\(32em/, 'narrower: 32em, it was 40');
});

test('cream on ink is easy to read: well over WCAG\'s 4.5 : 1 (and the gold of a named button too)', () => {
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  // the strip (src/hint-look.js HINT: 92 %) over the brightest ground (white) is at worst this
  const [r, g, b, alpha] = HINT.bg.match(/[\d.]+/g).map(Number);
  const strip = [r, g, b].map(c => Math.round(c * alpha + 255 * (1 - alpha)));
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  assert.ok(ratio(rgb(HINT.ink), strip) > 7, `cream: ${ratio(rgb(HINT.ink), strip).toFixed(1)}`);
  assert.ok(ratio(rgb(HINT.accent), strip) > 4.5, `gold: ${ratio(rgb(HINT.accent), strip).toFixed(1)}`);
});
