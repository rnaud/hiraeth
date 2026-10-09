import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { registerHazard, cylinderHazard, flameHazard, updateHazards, clearHazards, resetHazardNotes, HAZARD_DPS } from '../src/hazards.js';
import { SPECIES } from '../src/flora-species.js';

const body = (x, y, z) => ({ pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), hearts: 3, hurts: [], bites: [], hurt(k, why) { this.hearts -= k; this.hurts.push(why); this.bites.push(k); } });

test('the flame burns while you stay in it; outside it nothing happens', () => {
  clearHazards(); resetHazardNotes();
  registerHazard(flameHazard({ x: 0, z: 0, y0: 10, y1: 60, rMax: 15 }));
  const notes = [];
  const p = body(40, 0, 0);
  for (let i = 0; i < 60; i++) updateHazards(1 / 60, p, { notice: (t) => notes.push(t) });
  assert.equal(p.hearts, 3, 'on the ground far off: fine');
  p.pos.set(3, 25, 0);
  for (let i = 0; i < 60 * 2; i++) updateHazards(1 / 60, p, { notice: (t) => notes.push(t) });
  assert.ok(p.hearts <= 1.25 && p.hearts >= 0.75, `two seconds in the fire: about two hearts (${p.hearts} left)`);
  assert.ok(p.bites.every((k) => k === 0.25), 'in quarter-heart bites');
  assert.equal(HAZARD_DPS.fire, 1, 'a heart a second');
  assert.deepEqual(notes, ['It burns! Get out of the flames.'], 'said once');
  assert.ok(p.hurts.every((w) => w === 'fire'));
});

test('spines prick and push you off; the desert and Hangar cacti carry them', () => {
  clearHazards(); resetHazardNotes();
  registerHazard(cylinderHazard({ kind: 'spikes', x: 0, z: 0, y0: 0, y1: 5, r: 1, dps: HAZARD_DPS.spikes }));
  const p = body(0.5, 0, 0);
  updateHazards(1 / 60, p);
  assert.ok(p.hearts === 2.75 && p.vel.x > 3, 'a prick (a quarter heart), and pushed away');
  // pushed out and straight back in: no second prick for a moment (spines don't bite on every touch)
  p.pos.set(5, 0, 0); updateHazards(1 / 60, p); p.pos.set(0.5, 0, 0); updateHazards(1 / 60, p);
  assert.equal(p.hearts, 2.75, 'a step back in at once: not again yet');
  p.pos.set(5, 0, 0); for (let i = 0; i < 60; i++) updateHazards(1 / 60, p);
  p.pos.set(0.5, 0, 0); updateHazards(1 / 60, p);
  assert.equal(p.hearts, 2.5, 'a moment later: another prick');
  assert.ok(Object.values(SPECIES).flat().filter((s) => s.hurts === 'spikes').map((s) => s.id).includes('desert.sentinel'));
  clearHazards();
});
