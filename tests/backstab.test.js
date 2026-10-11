// The dash cut through a foe's back (issue #35; src/foes.js BACKSTAB, Foe.fromBehind; src/fluid-blade.js DASH): double
// from behind, as ever from the front or the side; only the dash cut.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foe, BACKSTAB } from '../src/foes.js';
import { DASH } from '../src/fluid-blade.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const cut = (dir, info) => { const f = new Foe('lizard', v(), { rng: () => 0.5 }); f.heading = 0; f.hp = 20; f.hit('blade', dir, { damage: DASH.damage, ...info }); return { lost: 20 - f.hp, f }; };

test('the dash cut lands double through a foe\'s back, single from its front or side', () => {
  assert.equal(BACKSTAB.k, 2);
  // (the foe faces +z: a blow travelling +z comes from behind it)
  const back = cut(v(0, 0, 1), { dash: true, source: 'dash' });
  assert.equal(back.lost, DASH.damage * 2, 'from behind: double');
  const flank = cut(v(0.6, 0, 0.8).normalize(), { dash: true, source: 'dash' });
  assert.equal(flank.lost, DASH.damage * 2, 'from behind its flank (37° off): double');
  assert.equal(cut(v(1, 0, 0), { dash: true, source: 'dash' }).lost, DASH.damage, 'from its side: single');
  assert.equal(cut(v(0, 0, -1), { dash: true, source: 'dash' }).lost, DASH.damage, 'from its front: single');
  assert.equal(cut(v(0, 0, 1), { combo: 2 }).lost, DASH.damage, 'another blow from behind: single');
});

test('the dash cut comes round sooner (v1.47: 1.1 s, was 1.5)', () => {
  assert.ok(DASH.cooldown <= 1.1 + 1e-9);
});
