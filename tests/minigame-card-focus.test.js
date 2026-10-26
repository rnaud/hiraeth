// Issue #507 (and #695: the buttons are prompts since): "During minigames menus the first button is always yellow? So it's not clear which one is selected."
// A game's cards (the start card, the pause, the results: src/minigames/kit/runner.js) mark their main button (what
// Enter does) only by a red edge at its left, and the focused one (the pad's, the arrows') is the one highlight, filled
// red: the main menus' look (src/menus.css .fullmenu .menu-nav). The engines draw the same (engine/menus.js cardView,
// BridgeMenu.cs BuildCard).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const { EngineMenus } = await import('../engine/menus.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of the rule whose selector list is exactly `sel` (or null). */
function rule(css, sel) {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (m[1].split(',').map((s) => s.trim()).includes(sel)) return m[2];
  return null;
}
const bg = (decl) => decl?.match(/background(?:-color)?:\s*([^;]+)/)?.[1].trim() ?? null;

// (since issue #695 the buttons are prompts, the button's glyph and its word, no box: src/hud-look.js enamelPrompt)
test('the card\'s buttons are prompts: none filled, the main one marked only by its glyph (Enter, A / ×)', () => {
  const css = read('src/minigames/kit/minigames.css');
  const base = rule(css, '#minigame .sheet .buttons button');
  assert.ok(base, 'a rule for the buttons');
  assert.equal(bg(base), 'none', 'no fill');
  assert.equal(rule(css, '#minigame .sheet button.main'), null, 'no edge for the main one');
  const runner = readFileSync(new URL('../src/minigames/kit/runner.js', import.meta.url), 'utf8');
  assert.match(runner, /promptRole\(b, \{ paused: this\.paused, links: this\.host\.links \}\)/, 'each its button\'s glyph');
});

test('the focused button is the one underlined; no other mark', () => {
  const css = read('src/minigames/kit/minigames.css');
  assert.match(css, /#minigame \.sheet \.buttons button:not\(:only-of-type\):focus > \.lbl[^{]*\{ text-decoration: underline/);
  const focus = rule(css, '#minigame .sheet .buttons button:focus');
  assert.equal(bg(focus), 'none', 'not filled');
  // (the pad on another button: the main one's A goes, the other's shows: A presses the focused one)
  assert.match(css, /body\.controller #minigame \.sheet \.buttons:has\(button:not\(\.main\):focus\) button\.main > \.glyph\[data-glyph="ok"\] \{ visibility: hidden; \}/);
});

test('the prompts\' buttons: Enter / A the main one, Esc / B Quit where back quits, R / Menu Retry, [ ] / LB RB the links', async () => {
  const { promptRole, promptKey } = await import('../src/minigames/kit/flow.js');
  const links = { extra: [{ id: 'prev', step: -1 }, { id: 'next', step: 1 }] };
  assert.equal(promptRole({ act: 'start', main: true }), 'ok');
  assert.equal(promptRole({ act: 'quit' }), 'back');
  assert.equal(promptRole({ act: 'quit' }, { paused: true }), null, 'on the pause back resumes');
  assert.equal(promptRole({ act: 'retry' }), 'menu');
  assert.equal(promptRole({ act: 'retry' }, { paused: true }), 'r');
  assert.equal(promptRole({ act: 'link:prev' }, { links }), 'lb');
  assert.equal(promptRole({ act: 'link:next' }, { links }), 'rb');
  assert.equal(promptKey('ok', 'keys'), 'Enter');
  assert.equal(promptKey('back', 'pad'), 'B / ○');
  assert.equal(promptKey('menu', 'pad'), 'Menu');
  assert.equal(promptKey('r', 'pad'), '');
  assert.equal(promptKey('ok', 'touch'), '');
});

test('the engines\' card: one button on, wherever the pad is; the main one still says it is main', () => {
  const runner = {
    cardV: 1, phase: 'results',
    cardModel: { kind: 'results', title: 'Your time', buttons: [{ act: 'retry', label: 'Retry', main: true }, { act: 'quit', label: 'Quit' }] },
    act() {}, padAction() {}, stepCardOption() {},
  };
  const m = new EngineMenus({});
  m.openCard(runner);
  let b = m.view().card.buttons;
  assert.deepEqual(b.map((x) => x.on), [true, false], 'on Retry first');
  m.navigate(1, 0);
  b = m.view().card.buttons;
  assert.deepEqual(b.map((x) => x.on), [false, true], 'on Quit: Retry not on');
  assert.equal(b[0].main, true);
});

test('Unity draws them as prompts: the badge and the word, the pad\'s one underlined (BridgeMenu.cs DrawCard)', () => {
  const cs = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.cs', import.meta.url), 'utf8');
  const draw = cs.slice(cs.indexOf('void DrawCard('), cs.indexOf('// ------------------------------------------------------------------ the Arena'));
  assert.match(draw, /BridgeHud\.CardPrompt\(cp, KeyOf\(b\), b\.S\("label"\) \?\? "", bx, y, on \|\| over/, 'underlined where the pad is (or the mouse)');
  assert.doesNotMatch(draw, /SetFill\(on \? CardInk/, 'no filled button');
  assert.match(draw, /Show\(cHint, false\)/, 'no line of keys under them');
});
