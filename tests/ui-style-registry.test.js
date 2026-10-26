import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerStyles, styleText } from '../src/ui-style-registry.js';
import box from '../src/hud-styles/box-card.js';
import cinema from '../src/hud-styles/cinema.js';
import gadget from '../src/hud-styles/gadget.js';
import spell from '../src/hud-styles/spell.js';
import charge from '../src/hud-styles/charge.js';
import fishing from '../src/hud-styles/fishing.js';
import hunt from '../src/hud-styles/sketchhunt.js';
import labels from '../src/hud-styles/labels.js';
import drums from '../src/hud-styles/drums.js';

test('headless consumers need no browser styles; invalid registered values fail', () => {
  assert.equal(styleText('not-registered'), '');
  assert.throws(() => registerStyles({ invalid: null }), TypeError);
});

test('browser bootstrap registers every exact stylesheet before gameplay, without touching the DOM', async () => {
  assert.equal(typeof document, 'undefined');
  await import('../src/hud-styles.js');
  const expected = {'boxcard-css':box,'cine-css':cinema,'gadget-css':gadget,'spell-css':spell,'charge-card-css':charge,'fishing-css':fishing,'hunt-css':hunt,'mg-words-css':labels,'drum-label':drums};
  for (const [id, css] of Object.entries(expected)) {
    assert.ok(css.length > 100, id);
    assert.equal(styleText(id), css, id);
  }
  const boot = readFileSync(new URL('../src/boot.js', import.meta.url), 'utf8');
  assert.match(boot, /^import '\.\/hud-styles\.js';/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<script type="module" src="\/src\/boot\.js"><\/script>/);
});
