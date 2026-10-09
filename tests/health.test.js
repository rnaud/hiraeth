import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player, FALL, fallDamage } from '../src/player.js';
import { HEARTS, POTION } from '../src/resources.js';

const flat = { heightAbove: (p) => p.y, groundAt: () => 0, rayDistance: () => Infinity, pushCapsule: () => false, groundNormal: () => new THREE.Vector3(0, 1, 0) };
const drop = (p, h) => { p.pos.set(0, h, 0); p.vel.set(0, 0, 0); p.onGround = false; for (let i = 0; i < 400 && !p.onGround && !p.down; i++) p.update(1 / 60, {}, 0); };
const run = (p, secs, input = {}) => { for (let i = 0; i < secs * 60; i++) p.update(1 / 60, input, 0); };
const metres = (h) => Math.sqrt(2 * 32 * h);   // landing speed after a drop of h m

test('falls: a short drop costs nothing; a hard landing knocks you over, you lie a moment and get up, a little hurt', () => {
  assert.equal(fallDamage(metres(8)), 0, 'an 8 m drop costs nothing');
  assert.equal(fallDamage(metres(15)), 0, 'nor a 15 m one');
  assert.ok(fallDamage(metres(20)) < 0.25, 'a 20 m drop hardly anything (counted, a quarter heart)');
  assert.ok(FALL.tumble > metres(15) && FALL.tumble < metres(17), 'the tumble starts at ~16 m (it used to be ~10 m)');
  assert.ok(fallDamage(metres(33)) <= FALL.worst && FALL.worst === 2, 'even 33 m is not all of it: two hearts at the very worst');
  assert.ok(fallDamage(metres(30)) >= 1, 'a long fall takes a heart or more');
  assert.equal(fallDamage(FALL.lethal), Infinity, 'a fatal one takes them all');
  assert.ok(FALL.lethal > metres(34) && FALL.lethal < metres(40), 'only ~35-40 m and more is fatal');
  const downs = [], hurts = [];
  const p = new Player(flat, { onHurt: (a) => hurts.push(a), onKnockdown: (dead) => downs.push(dead) });
  drop(p, 3);
  assert.equal(p.health, 1, 'a 3 m drop is nothing');
  assert.equal(p.down, undefined, 'and you stay on your feet');
  drop(p, 14);
  assert.equal(p.down, undefined, 'a 14 m drop: you land it');
  assert.equal(p.health, 1);
  drop(p, 20);
  assert.ok(p.down, 'a 20 m drop knocks you over');
  assert.deepEqual(downs, [false]);
  assert.ok(p.health > 0.9, `and hardly hurts: ${p.health.toFixed(2)}`);
  assert.equal(p.hearts, 2.75, 'a quarter heart');
  // no control while down: the stick does nothing
  const at = p.pos.clone();
  run(p, 0.5, { KeyW: true });
  assert.ok(p.pos.distanceTo(at) < 0.5, 'no walking off while down');
  run(p, 6);
  assert.ok(!p.down, 'back up after a few seconds');
  run(p, 1, { KeyW: true });
  assert.ok(p.pos.distanceTo(at) > 1, 'and walking again');
});

test('falls: high falls hurt more but never kill; only a fatal one keeps you down until you restart', () => {
  const outs = [], restarts = [];
  const p = new Player(flat, { onKnockout: () => outs.push(1), onRestart: () => restarts.push(1) });
  for (let i = 0; i < 4; i++) { drop(p, 33); run(p, 6); }
  assert.ok(p.health > 0 && !p.down, `four 33 m falls in a row: still standing (${p.health.toFixed(2)})`);
  assert.equal(outs.length, 0);
  p.lastSafe.set(5, 0, 5);
  drop(p, 40);
  assert.ok(p.dead, 'a 40 m fall is fatal');
  assert.equal(p.health, 0);
  run(p, 10);
  assert.ok(p.dead, 'and you stay down: the game asks');
  assert.equal(outs.length, 1, 'knocked out once');
  p.hurt(0.5, 'fire');
  assert.equal(outs.length, 1, 'nothing hurts the dead');
  p.restart();
  assert.ok(!p.down && p.health === 1, 'whole again');
  assert.ok(p.pos.distanceTo(new THREE.Vector3(5, 0, 5)) < 1, 'back where you last stood safely');
  assert.equal(restarts.length, 1);
});

test('a burn or a prick that takes the last of the bar knocks you out too (no tumble for small hurts)', () => {
  const p = new Player(flat);
  run(p, 0.2);
  p.hurt(0.05, 'fire');
  run(p, 0.1);
  assert.ok(!p.down, 'a small hurt is no knockdown');
  assert.equal(p.hearts, 2.75, 'any hurt is at least a quarter heart');
  p.hurt(p.hearts, 'spikes');
  run(p, 0.1);
  assert.ok(p.dead, 'out');
  p.restart();
  assert.ok(!p.down);
});

test('without health (physics tests) a long fall is only a landing', () => {
  const p = new Player(flat, { health: false });
  drop(p, 60);
  assert.ok(!p.down && p.onGround);
});

test('hearts: three to start, hurts counted in quarters, and they never come back by themselves', () => {
  const p = new Player(flat);
  assert.equal(p.hearts, HEARTS.start); assert.equal(HEARTS.start, 3); assert.equal(p.health, 1);
  p.hurt(0.5);
  assert.equal(p.hearts, 2.5, 'half a heart');
  p.hurt(0.3);
  assert.equal(p.hearts, 2.25, 'rounded to the nearest quarter');
  p.hurt(0.6);
  assert.equal(p.hearts, 1.75);
  for (let i = 0; i < 60 * 30; i++) p.update(1 / 60, {}, 0);
  assert.equal(p.hearts, 1.75, 'thirty seconds later: still hurt (no regeneration)');
  assert.equal(FALL.regen, 0);
  p.health = 1;
  assert.equal(p.hearts, 3, 'the share sets the hearts (the old callers: a game\'s retry)');
});

test('a healing potion: two hearts back half-way through a short drink; not at full hearts, not while down', () => {
  const drunk = [];
  const p = new Player(flat, { onDrink: (h) => drunk.push(h) });
  run(p, 0.1);
  assert.equal(p.cantDrink(), 'full');
  assert.equal(p.drinkPotion(), false, 'full hearts: kept');
  p.hurt(2.5);
  assert.equal(p.hearts, 0.5);
  assert.equal(p.drinkPotion(), true);
  assert.equal(p.cantDrink(), 'busy', 'one at a time');
  run(p, POTION.at - 0.1);
  assert.equal(p.hearts, 0.5, 'the flask still on its way up');
  run(p, 0.2);
  assert.equal(p.hearts, 0.5 + POTION.heal, `${POTION.heal} hearts back`);
  assert.deepEqual(drunk, [POTION.heal]);
  run(p, POTION.time);
  assert.equal(p.drinking, null, 'done');
  p.drinkPotion(); run(p, POTION.time + 0.1);
  assert.equal(p.hearts, 3, 'never past the containers');
  p.hurt(p.hearts); run(p, 0.1);
  assert.equal(p.cantDrink(), 'down', 'knocked out: no drinking');
  p.restart();
  p.setMaxHearts(4);
  assert.equal(p.hearts, 4, 'a new container: full hearts stay full');
  p.hurt(1); p.setMaxHearts(5);
  assert.equal(p.hearts, 3, 'a hurt keeps what it took');
});
