import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chipHtml } from '../src/gadgets/hud.js';
import { OBSTACLES } from '../src/ship/cinema.js';

// Issue #240: "The UI showing the currently equipped gadget should be smaller and at the top right corner of the
// screen. Just show the gadget itself, no text."
const css = readFileSync(new URL('../src/gadgets/hud.js', import.meta.url), 'utf8');
const rule = css.slice(css.indexOf('#gadget-chip { position'), css.indexOf('}', css.indexOf('#gadget-chip { position')));

test('the chip is the gadget\'s picture alone: no name, no count, no button', () => {
  const html = chipHtml({ def: { id: 'bomb', name: 'Bomb bag', glyph: '●' }, icon: 'data:image/webp;base64,x', count: 2, max: 3, key: 'RT / R2' });
  assert.equal(html, '<img src="data:image/webp;base64,x" alt="">');
  assert.doesNotMatch(html, /Bomb bag|RT|●●/);
  // (its mark until the picture is drawn)
  assert.equal(chipHtml({ def: { id: 'hook', name: 'Hook', glyph: '⚓' } }), '<span class="g">⚓</span>');
});

test('small, round, in the top right corner, clear of the frame readout and the menu\'s button; notices keep off it', () => {
  assert.match(rule, /right: calc\(14px \+ var\(--safe-right, 0px\)\); top: calc\(12px \+ var\(--safe-top, 0px\)\)/);
  assert.doesNotMatch(rule, /bottom:|left:/);
  assert.match(rule, /width: clamp\(30px, 6vh, 42px\); height: clamp\(30px, 6vh, 42px\)/, 'at most 42 px');
  assert.match(css, /#fps:not\(:empty\) ~ #gadget-chip \{ top: calc\(48px/);
  assert.match(css, /body\.touch #gadget-chip \{ pointer-events: auto; right: calc\(56px/);
  assert.ok(OBSTACLES.includes('#gadget-chip.on'));
});

test('a count is a ring round it, none left fades it, and a change of gadget pops it with a gold ring (still with Reduce motion)', () => {
  assert.match(css, /#gadget-chip\.gauge::before \{[^}]*conic-gradient\(\$\{en\('accent'\)\} calc\(var\(--k, 1\) \* 360deg\)/);   // (the enamel's turquoise: issue #687)
  assert.match(css, /#gadget-chip\.empty \{ opacity: 0\.5; \}/);
  assert.match(css, /@keyframes gchip \{ 0% \{ transform: scale\(1\.35\); box-shadow: 0 0 0 5px #f2c54b; \}/);
  assert.match(css, /html\.reduce-motion #gadget-chip\.flash \{ animation: gchip-still/);
  assert.match(css, /if \(changed\) \{ this\.chipEl\.classList\.remove\('flash'\)/, 'on every change of gadget, whatever chose it');
});
