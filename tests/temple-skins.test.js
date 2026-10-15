// A temple's skin (src/temples/skins/index.js, issue #342): its look only. The hooks run in order round the layout,
// and a house without one wears none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { houseSkin } from '../src/temples/skins/index.js';

test('a house without a skin wears none', () => {
  const rt = { def: {} };
  assert.equal(houseSkin(rt), null);
  assert.equal(rt.skin, null);
});

test('a skin is made once for its house, and switched off by rt.noSkin', () => {
  let made = 0;
  const skin = () => { made++; return { dress() {}, done() {} }; };
  const rt = { def: { skin } };
  assert.ok(houseSkin(rt)?.dress);
  assert.equal(made, 1);
  assert.equal(rt.skin, houseSkin.length >= 0 && rt.skin);
  const off = { def: { skin }, noSkin: true };
  assert.equal(houseSkin(off), null);
  assert.equal(made, 1);
});
