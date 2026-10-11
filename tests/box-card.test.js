// The box card puts the item first (issue #82): a low strip at the foot of the screen, the name first and largest,
// the words small under it, never in the middle over what the scene holds up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARD_MAX_SHARE } from '../src/boxes/card.js';

const card = readFileSync(new URL('../src/boxes/card.js', import.meta.url), 'utf8');
const rule = (sel) => card.match(new RegExp(`\\n${sel.replace(/[.#]/g, (c) => `\\${c}`)} \\{([^}]*)\\}`))?.[1] ?? '';

test('the card is a low strip along the foot of the screen at every size, the item clear above it', () => {
  assert.ok(CARD_MAX_SHARE <= 0.36, 'at most about a third of the screen\'s height');
  const box = rule('#boxcard');
  assert.match(box, /left: 50%; bottom: max\(6px, calc\(5\.5vh - 34px\)\)/, 'centred, down in the letterbox\'s bottom band');
  assert.doesNotMatch(card, /@media \(min-width: 980px\)/, 'no wide-screen placement of its own (the same strip everywhere)');
  assert.doesNotMatch(card, /bottom: calc\(11vh \+ 22px\)/, 'not standing over the bottom bar any more');
});

test('on the strip the item\'s name comes first and largest, the words after it, small', () => {
  const h2 = rule('#boxcard h2');
  const size = (s) => Number(s.match(/font-size: (\d+)px/)?.[1]);
  assert.ok(size(h2) >= 18, 'the name large');
  assert.match(rule('#boxcard'), /font: 12px/, 'the words small');
  assert.ok(card.indexOf('class="name"') < card.indexOf('class="text"') && card.indexOf('class="name"') < card.indexOf('class="use"'), 'the name before what it is and does');
  assert.match(rule('#boxcard .body'), /grid-template-columns: 1fr 1fr/, 'what it is and what it does side by side');
  assert.doesNotMatch(card, /Left by the makers for one who has come a long way/, 'one line fewer');
});
