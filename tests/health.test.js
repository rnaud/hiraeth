import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player, FALL, fallDamage } from '../src/player.js';

const flat = { heightAbove: (p) => p.y, groundAt: () => 0, rayDistance: () => Infinity, pushCapsule: () => false, groundNormal: () => new THREE.Vector3(0, 1, 0) };
const drop = (p, h) => { p.pos.set(0, h, 0); p.vel.set(0, 0, 0); p.onGround = false; for (let i = 0; i < 400 && !p.onGround; i++) p.update(1 / 60, {}, 0); };

test('falls: a hop or a short drop costs nothing, a long one hurts, a very long one knocks you out', () => {
  assert.equal(fallDamage(10), 0);
  assert.equal(fallDamage(FALL.lethal + 5), 1);
  const outs = [], hurts = [];
  const p = new Player(flat, { onHurt: (a) => hurts.push(a), onKnockout: () => outs.push(1) });
  drop(p, 3);
  assert.equal(p.health, 1, 'a 3 m drop is nothing');
  drop(p, 12);
  assert.ok(p.health < 0.9 && p.health > 0.1, `a 12 m drop hurts: ${p.health.toFixed(2)}`);
  p.lastSafe.set(5, 0, 5);
  drop(p, 40);
  p.update(1 / 60, {}, 0);   // (you come round on the next frame)
  assert.equal(outs.length, 1, 'knocked out');
  assert.equal(p.health, 1, 'whole again');
  assert.ok(p.pos.distanceTo(new THREE.Vector3(5, 0, 5)) < 1, 'back where you last stood safely');
  assert.equal(hurts.length, 2);
});

test('health comes back after a while without a hurt', () => {
  const p = new Player(flat);
  p.hurt(0.5);
  for (let i = 0; i < 60 * (FALL.wait - 0.5); i++) p.update(1 / 60, {}, 0);
  assert.equal(p.health, 0.5, 'not yet');
  for (let i = 0; i < 60 * 6; i++) p.update(1 / 60, {}, 0);
  assert.equal(p.health, 1, 'healed');
});
