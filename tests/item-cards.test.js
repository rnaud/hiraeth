// Each item and gadget has one short description, a line or two (issue #165): what it is and what it does together,
// its buttons inline as {key:verb}. No "what it is / what it does" split anywhere: the card, the items page, the game
// menu and the gear list show the one line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './register-gadgets.js';
import { ITEMS } from '../src/items.js';
import { keyText } from '../src/prompt-keys.js';

export const MAX_DESC = 180;

test('every item and gadget has one description of at most 180 letters, and no second field', () => {
  const ids = Object.keys(ITEMS);
  assert.ok(ids.length >= 60, `the items and the gadgets (${ids.length})`);
  for (const [id, it] of Object.entries(ITEMS)) {
    assert.equal(typeof it.text, 'string', `${id}: a description`);
    assert.ok(it.text.length >= 40, `${id}: says what it is and does (${it.text.length})`);
    assert.ok(it.text.length <= MAX_DESC, `${id}: ${it.text.length} letters, at most ${MAX_DESC}: “${it.text}”`);
    assert.equal(it.use, undefined, `${id}: no “what it does” of its own`);
    assert.ok(!it.text.includes('\n'), `${id}: one paragraph`);
    // shown with the player's own buttons, it stays a line or two (the keyboard's are the longest)
    for (const kind of ['pad', 'keys', 'touch']) {
      const shown = keyText(it.text, { kind, teach: true });
      assert.ok(!shown.includes('{key:'), `${id} (${kind}): every placeholder resolves`);
      assert.ok(shown.length <= MAX_DESC + 40, `${id} (${kind}): ${shown.length}`);
    }
  }
});

test('a gadget or a gun mode names its button in its one line', () => {
  for (const [id, it] of Object.entries(ITEMS)) {
    if (it.kind !== 'gadget' && it.kind !== 'mode') continue;
    assert.match(it.text, /\{key:(fire|use|aim|mode)\}/, `${id}: its button, inline`);
  }
});

test('the card, the items page and the trials show the one description, no headings, no columns', () => {
  const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  const card = read('boxes/card.js');
  assert.doesNotMatch(card, /What it is|What it does|grid-template-columns/);
  assert.match(card, /querySelector\('\.desc'\)\.innerHTML = keyText\(esc\(def\.text\), \{ html: true, teach: true \}\)/);
  for (const p of ['boxes/card.js', 'items-page/view.js', 'items-page/main.js', 'trials/index.js', 'game-menu.js', 'game-menu-data.js', 'items.js', 'gadgets/registry.js']) {
    assert.doesNotMatch(read(p), /\b(it|def|d|g|reward|ITEMS\[\w+\]|ITEMS\.\w+\??)\.use\b/, `${p}: no use field read`);
  }
});
