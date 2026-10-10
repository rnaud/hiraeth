// Potions a foe leaves now and then (src/potion-drops.js; v1.41, the author: "enemies sometimes drop potions"), and the
// low-health cue (src/low-health.js; "a visual and audio low-health cue at one heart or less, tasteful and not nagging").
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { POTION_DROP, potionChance, PotionDrops } from '../src/potion-drops.js';
import { LOW_HEALTH, lowHealthStep } from '../src/low-health.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

test('the chance: now and then, more when hurt or out of potions; never with a full pack, endless ones, a game\'s waves', () => {
  assert.equal(potionChance({ hearts: 3, max: 3, potions: 2 }), POTION_DROP.chance);
  assert.ok(potionChance({ hearts: 1, max: 3, potions: 2 }) > POTION_DROP.chance, 'hurt: likelier');
  assert.ok(potionChance({ hearts: 3, max: 3, potions: 0 }) > POTION_DROP.chance, 'none left: likelier');
  assert.ok(potionChance({ hearts: 1, max: 3, potions: 0 }) < 0.5, 'still only sometimes');
  assert.equal(potionChance({ potions: 5, cap: 5 }), 0, 'a full pack');
  assert.equal(potionChance({ infinite: true }), 0);
  assert.equal(potionChance({ waves: true }), 0); assert.equal(potionChance({ lost: true }), 0);
  assert.equal(potionChance({ since: POTION_DROP.pity }), 1, 'a long run with none: the next one surely');
});

test('a drop pops out of the foe, lands, bobs, is taken walking over it, and fades if left', () => {
  const scene = new THREE.Scene(), taken = [];
  let r = 0;
  const drops = new PotionDrops(scene, { groundAt: () => 0, onTake: (d) => taken.push(d), rng: () => r });
  // rng 0: under any chance, a drop
  const d = drops.maybe({ pos: v(2, 0, 2) }, { hearts: 3, max: 3, potions: 1, cap: 5 });
  assert.ok(d && scene.children.includes(d.g));
  for (let i = 0; i < 120; i++) drops.update(1 / 60, v(20, 0, 20));
  assert.ok(d.landed && Math.abs(d.pos.y) < 1e-6, 'on the ground');
  drops.update(1 / 60, v(d.pos.x + 0.5, 0, d.pos.z));
  assert.equal(taken.length, 1); assert.equal(drops.list.length, 0); assert.ok(!scene.children.includes(d.g));
  // a full pack: none
  assert.equal(drops.maybe({ pos: v() }, { potions: 5, cap: 5 }), null);
  // rng high: none, and the pity counts up to a sure one
  r = 0.99;
  for (let i = 0; i < POTION_DROP.pity; i++) assert.equal(drops.maybe({ pos: v() }, { potions: 1, cap: 5 }), null);
  assert.ok(drops.maybe({ pos: v() }, { potions: 1, cap: 5 }), 'after the pity run');
  // left alone: gone after its life
  for (let t = 0; t < POTION_DROP.life + 1; t += 0.5) drops.update(0.5, null);
  assert.equal(drops.list.length, 0);
});

test('the low-health cue: a short heartbeat spell when you fall to one heart, again when hit there, then only a faint edge', () => {
  const S = {}, dt = 1 / 60, period = 60 / LOW_HEALTH.bpm;
  let beats = 0, peak = 0;
  for (let i = 0; i < 60; i++) { const r = lowHealthStep(S, dt, { hearts: 3, max: 3 }); assert.equal(r.k, 0); assert.ok(!r.beat); }
  for (let t = 0; t < LOW_HEALTH.beats * period + 3; t += dt) { const r = lowHealthStep(S, dt, { hearts: 1, max: 3 }); if (r.beat) beats++; peak = Math.max(peak, r.k); }
  assert.equal(beats, LOW_HEALTH.beats, `${beats} beats, then quiet`);
  assert.ok(peak > LOW_HEALTH.rest * 2 && peak <= LOW_HEALTH.edge + 1e-6, `the edges pulse (${peak.toFixed(2)})`);
  const rest = lowHealthStep(S, dt, { hearts: 1, max: 3 });
  assert.ok(Math.abs(rest.k - LOW_HEALTH.rest) < 0.02 && !rest.beat, 'then a faint edge, no beat: it never nags');
  // hit again while there: a new spell
  assert.ok(lowHealthStep(S, dt, { hearts: 0.5, max: 3 }).beat);
  // healed: it eases out
  for (let i = 0; i < 120; i++) lowHealthStep(S, dt, { hearts: 3, max: 3 });
  assert.equal(S.k, 0);
  // a one-heart maximum is no warning; dead, nothing; a menu up, nothing
  const T = {};
  assert.ok(!lowHealthStep(T, dt, { hearts: 1, max: 1 }).beat);
  assert.ok(!lowHealthStep(T, dt, { hearts: 1, max: 3, dead: true }).beat);
  assert.ok(!lowHealthStep(T, dt, { hearts: 1, max: 3, paused: true }).beat);
});
