// E picks what the traveller faces (src/interact.js): among the same tier, the nearest by a distance weighed
// by how far off his heading it lies; the prompt is always the one E will use.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { registerInteractable, clearInteractables, bestInteractable, updateInteract, PRIORITY, facingWeight } from '../src/interact.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const frame = { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) };
const player = (heading) => ({ pos: V(0, 0, 0), heading, frame, riding: false });

test('E boards the cab you face, not the passer-by at your shoulder, and the prompt says so', () => {
  clearInteractables();
  const used = [];
  // a cab 2.4 m ahead (+z), a shopper 1.5 m to the right (+x)
  const cab = V(0, 0, 2.4), shopper = V(1.5, 0, 0);
  registerInteractable({ id: 'vehicle', priority: PRIORITY.vehicle, range: 9, prompt: 'get in the cab', at: () => cab, distance: (p) => p.pos.distanceTo(cab), use: () => used.push('cab') });
  registerInteractable({ id: 'talk.shopper', priority: PRIORITY.talk, range: 3.4, prompt: 'talk to the shopper', at: () => shopper, distance: (p) => p.pos.distanceTo(shopper), use: () => used.push('talk') });
  const ahead = player(0);
  assert.equal(bestInteractable(ahead).entry.id, 'vehicle', 'facing the cab');
  const r = updateInteract(ahead, true);
  assert.equal(r.prompt, 'get in the cab', 'the prompt is what E does');
  assert.deepEqual(used, ['cab']);
  // turned to the shopper: the talk
  const turned = player(Math.PI / 2);
  assert.equal(bestInteractable(turned).entry.id, 'talk.shopper');
  assert.equal(updateInteract(turned, false).prompt, 'talk to the shopper');
  // with the cab behind and the shopper to the side, the shopper; with both at the same angle, the nearer
  assert.equal(bestInteractable(player(Math.PI)).entry.id, 'talk.shopper');
  assert.equal(bestInteractable(player(Math.atan2(1.5, 2.4) / 1)).entry.id, 'talk.shopper', 'between them, the nearer wins');
  // a higher tier still wins wherever it is
  registerInteractable({ id: 'ship', priority: PRIORITY.ship, range: 5, prompt: 'go aboard', at: () => V(-3, 0, -1), distance: () => 3.2, use: () => {} });
  assert.equal(bestInteractable(ahead).entry.id, 'ship');
  clearInteractables();
});

test('the facing weight: 1 ahead, 2 to the side, 3 behind; as it is without a place or a heading', () => {
  const e = (at) => ({ at: () => at });
  assert.ok(Math.abs(facingWeight(player(0), e(V(0, 0, 3))) - 1) < 1e-9);
  assert.ok(Math.abs(facingWeight(player(0), e(V(3, 0, 0))) - 2) < 1e-9);
  assert.ok(Math.abs(facingWeight(player(0), e(V(0, 0, -3))) - 3) < 1e-9);
  assert.equal(facingWeight(player(0), {}), 1);
  assert.equal(facingWeight({ pos: V() }, e(V(3, 0, 0))), 1);
  assert.equal(facingWeight(player(0), e(V(0.1, 0, 0.1))), 1, 'right on top of it');
});
