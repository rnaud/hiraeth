// The box card puts the item first (issue #82): a low strip at the foot of the screen, the name first and largest,
// the words small under it, never in the middle over what the scene holds up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARD_MAX_SHARE, CARD_MAX_CH } from '../src/boxes/card.js';

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
  const size = (s) => Number(s.match(/font: \d+ ([\d.]+)em/)?.[1]);
  assert.ok(size(h2) >= 1.5, 'the name large (in em of the words: the title face)');
  assert.match(h2, /var\(--face-title\)/, 'the name in the title face');
  assert.match(rule('#boxcard'), /font: var\(--type-s\)/, 'the words small (the small print, from the screen\'s height: issue #128)');
  assert.ok(card.indexOf('class="name"') < card.indexOf('class="desc"'), 'the name before what it is and does');
  // (issue #165: one description, what it is and does together; no two columns, no headings over them)
  assert.doesNotMatch(card, /grid-template-columns|What it is|What it does/, 'one description, no columns');
  assert.equal((card.match(/class="desc"/g) ?? []).length, 1);
  assert.doesNotMatch(card, /Left by the makers for one who has come a long way/, 'one line fewer');
});

// issue #329: "too much on it … just the name of the item and what it does. No subtitle … not 100% width"
test('the card is the name and one line, no subtitle, no wider than a readable measure, centred', () => {
  assert.doesNotMatch(card, /AN ARTIFACT OF THE MAKERS|class="k"/, 'no subtitle');
  const html = card.match(/<div id="boxcard"[\s\S]*?<\/div><\/div>`/)?.[0] ?? '';
  assert.deepEqual([...html.matchAll(/class="(name|found|desc|go)"/g)].map((m) => m[1]), ['name', 'found', 'desc', 'go'], 'the name, the line (or the find\'s line), the button');
  assert.ok(CARD_MAX_CH >= 36 && CARD_MAX_CH <= 44, `a measure of ${CARD_MAX_CH} ch`);
  const box = rule('#boxcard');
  assert.ok(box.includes(`max-width: min(${CARD_MAX_CH}ch, calc(100vw - 24px))`), 'at most the measure, never the screen\'s width');
  assert.match(box, /width: max-content/, 'as narrow as its words');
  assert.doesNotMatch(box, /900px/, 'not the old full strip');
  assert.match(box, /left: 50%/);
  assert.match(card, /translate\(-50%, 0\)/, 'centred');
});
