import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { registerHazard, cylinderHazard, flameHazard, updateHazards, clearHazards, resetHazardNotes } from '../src/hazards.js';
import { SPECIES } from '../src/flora-species.js';

const body = (x, y, z) => ({ pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), health: 1, hurts: [], hurt(k, why) { this.health -= k; this.hurts.push(why); } });

test('the flame burns while you stay in it; outside it nothing happens', () => {
  clearHazards(); resetHazardNotes();
  registerHazard(flameHazard({ x: 0, z: 0, y0: 10, y1: 60, rMax: 15, dps: 0.3 }));
  const notes = [];
  const p = body(40, 0, 0);
  for (let i = 0; i < 60; i++) updateHazards(1 / 60, p, { notice: (t) => notes.push(t) });
  assert.equal(p.health, 1, 'on the ground far off: fine');
  p.pos.set(3, 25, 0);
  for (let i = 0; i < 60 * 2; i++) updateHazards(1 / 60, p, { notice: (t) => notes.push(t) });
  assert.ok(p.health < 0.5 && p.health > 0.2, `two seconds in the fire hurt (${p.health.toFixed(2)})`);
  assert.deepEqual(notes, ['It burns! Get out of the flames.'], 'said once');
  assert.ok(p.hurts.every((w) => w === 'fire'));
});

test('spines prick and push you off; the desert and Hangar cacti carry them', () => {
  clearHazards(); resetHazardNotes();
  registerHazard(cylinderHazard({ kind: 'spikes', x: 0, z: 0, y0: 0, y1: 5, r: 1, dps: 0.12 }));
  const p = body(0.5, 0, 0);
  updateHazards(1 / 60, p);
  assert.ok(p.health < 1 && p.vel.x > 3, 'a prick, and pushed away');
  assert.ok(Object.values(SPECIES).flat().filter((s) => s.hurts === 'spikes').map((s) => s.id).includes('desert.sentinel'));
  clearHazards();
});
