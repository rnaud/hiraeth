// The teaching lines and the toasts that teach an input are in the player's language (issue #96;
// docs/systems/localisation.md): the first steps, the ship's nudge, the tank's first fill, and every toast or
// notice that names an input ({key:verb}) go through t(), with French beside the English.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLanguage, missing } from '../src/i18n.js';
import { lookLine, jumpLine } from '../src/first-steps.js';
import { nudgeText } from '../src/ship/prologue.js';
import { keyText, verbKey } from '../src/prompt-keys.js';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });

test('no toast or notice that teaches an input passes literal English', () => {
  const bad = [];
  for (const f of walk(SRC)) {
    if (/[/\\](i18n|changelog)[/\\.]/.test(f) || f.endsWith('changelog.js') || f.endsWith('changelog-media.js')) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\b(?:toast|showToast|notice|hint|hoistHint)\??\.?\(([^\n;]*)/g)) {
      if (/(['"`])(?:(?!\1).)*\{key:/.test(m[1])) bad.push(`${f.slice(SRC.length)}: ${m[0].slice(0, 90)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the teaching lines speak French', () => {
  setLanguage('fr');
  try {
    assert.equal(lookLine('keys'), 'Regardez autour de vous avec la souris');
    assert.equal(lookLine('pad'), 'Regardez autour de vous avec le stick droit');
    assert.match(jumpLine('keys'), /^Sautez avec SPACE|^Sautez avec ESPACE/);
    assert.match(nudgeText({ moved: false, keys: (v) => verbKey(v, 'pad') }), /^Regardez autour de vous : déplacez-vous avec le stick gauche/);
    assert.match(nudgeText({ moved: true, keys: () => '' }), /^Un message clignote/);
    assert.equal(keyText('{key:aim}', { kind: 'keys', teach: true }), 'R ou le bouton droit de la souris');
    assert.equal(keyText('{key:thrust}', { kind: 'pad', teach: true }), 'A / × maintenu en l\'air');
  } finally { setLanguage('en'); }
  assert.equal(lookLine('keys'), 'Look around with the mouse');
  assert.equal(keyText('{key:fire}', { kind: 'keys', teach: true }), 'G or a left click');
});

test('every teaching key has its French', () => {
  assert.deepEqual(missing('fr').filter((k) => /^(teach|vk)\./.test(k)), []);
});
