// Issue #507: "During minigames menus the first button is always yellow? So it's not clear which one is selected."
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

test('the card\'s main button is no longer filled: only an edge marks it (turquoise, the enamel\'s tab since issue #687)', () => {
  const css = read('src/minigames/kit/minigames.css');
  const main = rule(css, '#minigame .sheet button.main');
  assert.ok(main, 'a rule for the main button');
  assert.equal(bg(main), null, 'the main button keeps the paper of the others');
  assert.match(main, /border-left:\s*\d+px solid var\(--en-accent\)/, 'a turquoise edge at its left');
});

test('the focused button is the one filled, in a colour no other button has', () => {
  const css = read('src/minigames/kit/minigames.css');
  const focus = rule(css, '#minigame .sheet button:focus');
  assert.ok(focus);
  assert.equal(bg(focus), 'var(--en-ink)', 'filled ivory, as the conversation\'s confirm badge (issue #687; red before)');
  assert.notEqual(bg(rule(css, '#minigame .sheet button:hover')), bg(focus), 'the mouse over another button is not drawn as the focus');
  assert.notEqual(bg(rule(css, '#minigame .sheet button')), bg(focus));
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

test('Unity draws the pad\'s button filled and the main one only edged (BridgeMenu.cs BuildCard)', () => {
  const cs = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.cs', import.meta.url), 'utf8');
  const build = cs.slice(cs.indexOf('void BuildCard('), cs.indexOf('// ------------------------------------------------------------------ the Arena'));
  // (red follows the pad alone; the mouse over another only its :hover's paler paper, issue #574)
  assert.match(build, /cb\.box\.SetFill\(on \? CardInk : over \? CardButtonHover : CardButtonFill\)/, 'the fill follows the pad alone');
  assert.match(build, /bool over = !on && HoverOn\(b\.S\("pt"\)\);/);
  assert.doesNotMatch(build, /main \? Ui\.Gold/, 'no gold main button');
  assert.match(build, /Show\(cb\.accent, main\)/, 'the main one\'s red edge');
});
