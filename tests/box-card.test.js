// The box card puts the item first (issue #82): a low strip at the foot of the screen, the name first and largest,
// the words small under it, never in the middle over what the scene holds up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARD_MAX_SHARE } from '../src/boxes/card.js';

const card = readFileSync(new URL('../src/boxes/card.js', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/hud-styles/box-card.js', import.meta.url), 'utf8');
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
test('the card is the name and one line, no subtitle; about half the screen wide (BotW\'s), never past its edges, centred', async () => {
  const { CARD_VW, CARD_MAX_PX } = await import('../src/boxes/card.js');
  assert.doesNotMatch(card, /AN ARTIFACT OF THE MAKERS|class="k"/, 'no subtitle');
  const html = card.match(/<div id="boxcard"[\s\S]*?<\/div><\/div>`/)?.[0] ?? '';
  assert.deepEqual([...html.matchAll(/class="(name|found|desc|go)"/g)].map((m) => m[1]), ['name', 'found', 'desc', 'go'], 'the name, the line (or the find\'s line), the button');
  const box = rule('#boxcard');
  // (issue #695, the author: "Why is it so narrow and with so little padding?")
  assert.ok(box.includes(`width: min(${CARD_VW}vw, ${CARD_MAX_PX}px)`), 'about half a 16:9 screen');
  assert.ok(box.includes('max-width: calc(100vw - 24px)'), 'never the whole screen');
  assert.match(card, /\$\{enamelCard\(\)\} padding: 1\.2em 1\.6em;/, 'generous inner margins');
  assert.match(box, /left: 50%/);
  assert.match(card, /translate\(-50%, 0\)/, 'centred');
  assert.match(rule('#boxcard .pic'), /width: 6em; height: 6em/);
  assert.match(rule('#boxcard p.desc'), /line-height: 1\.45/);
});

// issue #695: "a neater item card like BotW": the item's picture at the left (the Items page's own), its name, its line,
// and at the bottom right the prompt, the button's glyph and its word, no box (src/hud-look.js enamelPrompt)
test('the card as BotW\'s item card: the picture at the left, the name, the line, the prompt at the bottom right', async () => {
  const { itemPicture, cardState } = await import('../src/boxes/card.js');
  const { PIC_PAPER } = await import('../src/hud-look.js');
  const { ICON_PAPER } = await import('../src/item-icons.js');
  const { existsSync } = await import('node:fs');
  assert.equal(PIC_PAPER, ICON_PAPER, 'the disc is the pictures\' own paper');
  assert.equal(itemPicture('doublejump'), 'item-pictures/doublejump.webp');
  assert.ok(existsSync(new URL('../public/item-pictures/doublejump.webp', import.meta.url)));
  assert.equal(itemPicture(null), '', 'a find with no item (a temple\'s map): no picture');
  assert.ok(card.indexOf('class="pic"') < card.indexOf('class="name"'), 'the picture before the name');
  assert.match(rule('#boxcard.nopic .pic'), /display: none/, 'none rather than one invented');
  assert.match(rule('#boxcard.nopic h2 .star'), /display: inline-block/, 'the makers\' star only where there is no picture');
  assert.match(rule('#boxcard .gorow'), /justify-content: flex-end/, 'the prompt at the bottom right');
  assert.match(card, /\$\{enamelPrompt\('#boxcard \.go'\)\}/);
  assert.equal(cardState({ def: { name: 'Lift valve' }, item: 'doublejump', kind: 'pad' }).id, 'doublejump', 'the engines\' card names its picture');
  assert.equal(cardState({ def: { name: 'The house map' }, kind: 'pad' }).id, '');
  assert.match(readFileSync(new URL('../src/boxes/scene.js', import.meta.url), 'utf8'), /item: this\.item \}/, 'the scene says which item');
});
