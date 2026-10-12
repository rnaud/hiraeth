// Button glyphs and prompts follow the screen (issue #150, docs/systems/ui.md "Type"): the use prompt's badge, the
// cue's, the conversation's answers and page turn, and the menus' and cards' glyphs are sized from the screen's
// height (index.html --type-key, --glyph-min), as the words beside them are, so the Deck's 1280 x 800 gets a badge
// as easy to see as a 1440p screen's, and the Retroid's 730 x 410 one that still fits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glyphCss } from '../src/pad-glyphs.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/** A root size of index.html, as px for a screen `h` CSS px tall: calc(clamp(Apx, Bvh, Cpx) * var(--ts, 1)). */
function rootPx(name, h, ts = 1) {
  const m = html.match(new RegExp(`${name}:\\s*calc\\(clamp\\((\\d+(?:\\.\\d+)?)px,\\s*(\\d+(?:\\.\\d+)?)vh,\\s*(\\d+(?:\\.\\d+)?)px\\)\\s*\\*\\s*var\\(--ts, 1\\)\\)`));
  assert.ok(m, `${name} is a clamp of the screen's height under the text size`);
  const [lo, vh, hi] = m.slice(1).map(Number);
  return Math.min(hi, Math.max(lo, (vh * h) / 100)) * ts;
}

const SCREENS = { retroid: 410, '720p': 720, deck: 800, '1440p': 1440 };

test('a badge\'s letter grows with the screen and is never small on the Deck', () => {
  const key = Object.fromEntries(Object.entries(SCREENS).map(([k, h]) => [k, rootPx('--type-key', h)]));
  assert.ok(key.retroid >= 14, `the Retroid: ${key.retroid} px`);
  assert.ok(key.deck >= 17, `the Deck: ${key.deck} px (a badge ${(key.deck * 1.75).toFixed(0)} px round)`);
  assert.ok(key['720p'] < key.deck && key.deck < key['1440p'], 'larger on a taller screen');
  assert.ok(key['1440p'] / key['720p'] > 1.8, 'a 1440p screen gets twice the 720p badge, as its words are');
  // the text size setting scales it too
  assert.ok(rootPx('--type-key', 800, 1.45) > key.deck * 1.4);
  const glyph = rootPx('--glyph-min', 800);
  assert.ok(glyph >= 12.5, `a menu's glyph letter on the Deck: ${glyph} px`);
});

test('every prompt\'s badge takes its size from --type-key', () => {
  const rule = (sel) => html.match(new RegExp(`\\n\\s*${sel.replace(/[.#()]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
  assert.match(rule('.key'), /font-size:\s*var\(--type-key/, 'the round badge (the use prompt, the cue)');
  assert.match(rule('#cue .key'), /font-size:\s*var\(--type-key\)/);
  assert.match(rule('#prompt.glyph .key'), /var\(--type-key\)/, 'the button alone over someone: --type-key, larger');
  assert.doesNotMatch(rule('#prompt.glyph'), /font-size:\s*calc\(\d+px/, 'no px size for the quiet prompt');
});

test('the conversation\'s page turn names its button, in the panel\'s own type', async () => {
  assert.match(html, /body\.controller #dialogue\.more \.dlg-next \{ display: block; \}/);
  assert.match(html, /#dialogue \.dlg-next \.key \{ font-size: [\d.]+em/, 'em of the panel\'s --dlg: the screen\'s height');
  const src = readFileSync(new URL('../src/story/dialogue.js', import.meta.url), 'utf8');
  assert.match(src, /class="dlg-next"/);
  assert.match(src, /keyBadge\(key\)/);
});

test('a menu\'s or a card\'s glyph is at least --glyph-min (10 px where a page has none)', () => {
  const css = glyphCss();
  assert.match(css, /font: 700 max\(var\(--glyph-min, 10px\), \.68em\)/);
  assert.match(css, /font-size: max\(calc\(var\(--glyph-min, 10px\) \* 1\.1\), \.74em\)/);
  assert.doesNotMatch(css, /max\(1[01]px/, 'no fixed floor left');
});
