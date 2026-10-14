import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './register-gadgets.js';
import { attachCourt, COURTS, BAYS, COURT } from '../src/finds/courts.js';
import { ITEMS } from '../src/items.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { CHARM_TUNES, syncUpgrades } from '../src/trials/upgrades.js';

// The makers' courts of the three worlds of v1.40 (v1.48, issue #101): a gadget found worlds before, a bay of its own
// (src/finds/courts.js BAYS), and the box behind the gate its puzzle holds open, a charm for that gadget in it.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const OWN = ['underwater', 'moonfoundry', 'spacecity'];

for (const id of OWN) {
  test(`${id}: its court, a puzzle of its gadget’s, the box behind the gate it opens`, () => {
    const C = COURTS[id];
    assert.ok(BAYS[C.bay], `${id}: a bay of its own (${C.bay})`);
    const scene = new THREE.Scene();
    const level = { spawn: V(0, 0, 0), ground: { baseAt: () => 0 } };
    const court = attachCourt(id, scene, level);
    assert.ok(court, 'built');
    assert.equal(court.gadget, C.gadget);
    const W = level.gadgetWorld;
    assert.equal(W.plates.length, 1, 'one plate');
    assert.equal(W.gates.length, 1, 'one gate');
    assert.deepEqual(W.gates[0].plates, [0], 'the gate is the plate’s');
    assert.ok(W.plates[0].things, 'only a thing presses it: you cannot stand the gate open');
    // the box in the alcove behind the gate, facing out of it
    const inv = new THREE.Matrix4().makeRotationY(court.frame.yaw).setPosition(court.frame.origin).invert();
    const box = V(...court.box.at).applyMatrix4(inv), gate = W.gates[0].object.position;
    assert.ok(box.z < gate.z - 1, `behind the gate (${box.z.toFixed(1)} vs ${gate.z.toFixed(1)})`);
    assert.ok(Math.abs(box.x - gate.x) < 1, 'in line with it');
    assert.ok(Math.abs(box.y) < 0.05, 'on the pavement');
    assert.ok(Math.abs(box.x) < COURT.w / 2 && box.z > -COURT.back, 'on the court');
    // its gadget's things: a crate to carry to the plate (an iron one for the magnet)
    assert.ok(W.props.some((p) => (C.gadget === 'magnet' ? p.metal : true)), 'something to carry to the plate');
    if (C.gadget === 'magnet') assert.ok(W.plates[0].mass > 1, 'only iron presses it');
    // and its box: a charm for that gadget, with a hint, never a gadget
    const placed = PLACEMENTS[id].find((p) => p.id === `${id}.court`);
    assert.ok(placed?.hint && !placed.gadget, 'a box with a hint, not a gadget’s');
    assert.equal(ITEMS[placed.item]?.kind, 'charm');
    assert.ok(CHARM_TUNES[placed.item], `${placed.item}: does something for the ${C.gadget}`);
  });
}

test('the courts’ charms: each a little more for its gadget while owned, on a key no trial touches', () => {
  const was = Object.fromEntries(Object.entries(CHARM_TUNES).map(([id, [t, k]]) => [id, t[k]]));
  syncUpgrades((id) => id in CHARM_TUNES);
  for (const [id, [t, k, v]] of Object.entries(CHARM_TUNES)) { assert.equal(t[k], v, `${id}: on`); assert.ok(v > was[id], `${id}: more`); }
  syncUpgrades(() => false);
  for (const [id, [t, k]] of Object.entries(CHARM_TUNES)) assert.equal(t[k], was[id], `${id}: off again`);
});


test('the relocated Engine-House court rests on level sand, with its box above the pavement', async () => {
  const A = await import('./playthrough-agent.js');
  globalThis.location = { search: '?level=buried' };
  const W = A.loadWorld('buried');
  try {
    const C = W.level.finds.court, F = C.frame;
    for (const x of [-10, 0, 10]) for (const z of [-14, -4, 10]) {
      const p = V(x, 0, z).applyAxisAngle(V(0, 1, 0), F.yaw).add(F.origin);
      const gap = p.y - W.level.ground.heightAt(p.x, p.z);
      assert.ok(gap > .15 && gap < .5, 'sand meets the plinth without burying or floating a corner');
    }
    const [x, y, z] = C.box.at;
    assert.ok(Math.abs(W.physics.groundAt(x, y + .8, z, 2) - y) < .05, 'box on the court floor');
  } finally { W.dispose(); }
});
