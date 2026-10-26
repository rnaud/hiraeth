// Every message on the screen in the enamel HUD (issue #687, src/hud-look.js; docs/systems/ui.md "One look for every
// message"): the tokens in index.html's :root as hud-look.js writes them, every message's box built from them (none
// left on the old cream paper with an ink edge and a hard offset shadow), and the Unity bridge drawing the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENAMEL, ENAMEL_VARS, ENAMEL_ENGINE, HUD_MESSAGES, en, enamelCard, enamelStrip } from '../src/hud-look.js';
import { HINT } from '../src/hint-look.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const ENAMEL_EXPR = /^(en|enamel\w+)\(/;
/** A file's CSS with its template expressions put in: an enamel helper as the variable it writes, anything else as X. */
const cssOf = (f) => read(f).replace(/\$\{([^}]*)\}/g, (_, e) => (ENAMEL_EXPR.test(e.trim()) ? 'var(--en-token)' : 'X')).replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of every block whose selector list has `sel` itself. */
function rules(css, sel) {
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (m[1].split(',').map((x) => x.trim().split('\n').pop().replace(/^.*`/, '').trim()).includes(sel)) out.push(m[2]);
  return out.join(';');
}
const OLD_PAPER = /background:\s*(#f7ecd2|#fff6dc|#fbf4e2|#fffaf0|rgba\((247, 236, 210|255, 246, 220|255, 250, 240), 0\.9)/;
const HARD_SHADOW = /box-shadow:\s*\d+px \d+px 0 (#2b211f|X)/;

test('the tokens: index.html carries ENAMEL_VARS, the strip is the hints\' own, the engine numbers match', () => {
  assert.ok(read('index.html').includes(ENAMEL_VARS), 'the --en-* variables in :root as src/hud-look.js writes them');
  assert.equal(ENAMEL.strip, HINT.bg); assert.equal(ENAMEL.ink, HINT.ink); assert.equal(ENAMEL.accent, HINT.accent);
  assert.deepEqual(ENAMEL_ENGINE.panel.slice(0, 3).map((x) => Math.round(x * 255)), [22, 29, 29]);
  assert.match(en('brassInk'), /^var\(--en-brass-ink, #edbc76\)$/);
  assert.match(enamelCard(), /border: 1\.5px solid var\(--en-brass/);
  assert.doesNotMatch(enamelStrip() + enamelCard(), /\d+px \d+px 0 /, 'no hard offset shadow');
});

test('every message is drawn from the enamel tokens, none on the old cream paper with a hard shadow', () => {
  for (const m of HUD_MESSAGES) {
    const r = rules(cssOf(m.file), m.sel);
    assert.ok(r.length, `${m.sel} has rules in ${m.file}`);
    assert.match(r, /var\(--en-/, `${m.id} (${m.what}): built from the enamel tokens`);
    assert.doesNotMatch(r, OLD_PAPER, `${m.id}: no cream paper`);
    assert.doesNotMatch(r, HARD_SHADOW, `${m.id}: no hard ink shadow`);
  }
});

test('the voicemail charge: one line, its mark in its own column, on the dark panel', async () => {
  const { showChargeCard, chargeCardLine } = await import('../src/story/charge.js');
  assert.equal(chargeCardLine(), 'BRING BACK SOMETHING OF VALUE');
  const src = read('src/story/charge.js');
  assert.match(src, /class="mark" aria-hidden="true">\$\{CHARGE\.mark\}/);
  assert.doesNotMatch(src, /class="from"/, 'no kicker over it (issue #222: one line)');
  assert.equal(typeof showChargeCard, 'function');
});

test('Unity draws the same: the palette, and each message built as an enamel card or strip', () => {
  const hints = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.Hints.cs');
  for (const hex of ['#161d1d', ENAMEL.brass, ENAMEL.brassInk, ENAMEL.gold, ENAMEL.keyInk]) assert.ok(hints.includes(hex), `BridgeHud.Hints.cs has ${hex}`);
  const hud = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.cs');
  for (const name of ['card', 'cine sub', 'title', 'restart', 'box card']) assert.match(hud, new RegExp(`EnamelCard\\([^,]+, "${name}"\\)`), `${name}: an enamel card`);
  for (const name of ['cine skip', 'box skip', 'mg timer', 'mg score', 'mg flash']) assert.match(hud, new RegExp(`EnamelStrip\\([^,]+, "${name}"`), `${name}: an enamel strip`);
  assert.doesNotMatch(hud, /ChargePaper|SubPaper/, 'no paper band left');
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.Parts.cs'), /EnamelCard\(balloonRoot, "balloon"\)/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.cs'), /Ui\.Panel\(root, "game card", CardPanel, CardBrass/);
});
