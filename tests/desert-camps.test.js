// The way through the pilgrims' camps (v1.42, src/desert-city.js CAMP_WAY; the author: "the tent area in the desert feels
// too crowded, unsure where to go"): a clear lane from where you come in over the dunes to Qanat's main gate, past the big
// fire, between two rows of banners; no tent, rug or circle of people in it, and the gate in sight all along it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadWorld } from './playthrough-agent.js';
import { CAMP_WAY } from '../src/desert-city.js';

const { level, physics } = loadWorld('desert');
const Q = level.qanat, C = Q.camps, gate = Q.city.gate;
const toGate = gate.clone().sub(C.center).setY(0).normalize(), across = new THREE.Vector3(-toGate.z, 0, toGate.x);
/** camp-local: x across the way, z along it (+z toward the landing) */
const local = (p) => { const d = p.clone().sub(C.center); return { x: d.dot(across), z: -d.dot(toGate) }; };
const onWay = (z, x = 0, lift = 1) => {
  const p = C.center.clone().addScaledVector(toGate, -z).addScaledVector(across, x);
  const g = physics.groundAt(p.x, p.y + 20, p.z, 60);
  p.y = (Number.isFinite(g) ? g : p.y) + lift;
  return p;
};

test('the way runs from the dunes to the gate, along the line from the landing', () => {
  assert.ok(Math.abs(local(gate).x) < 2 && local(gate).z < CAMP_WAY.to + 10, 'the gate at its end');
  assert.ok(Math.abs(local(level.spawn).x) < 10 && local(level.spawn).z > 140, `the landing behind you as you come in (${local(level.spawn).x.toFixed(1)}, ${local(level.spawn).z.toFixed(0)}; 160 m out since the landing moved closer, issue #71)`);
  const line = level.lines().find((l) => l.name === 'the camps’ banners');
  assert.ok(line && line.points.length >= 2, 'the level design audit reads it as a leading line');
});

test('nothing stands in the way: no tent, crate or jar across it, no circle of people in it', () => {
  for (let z = CAMP_WAY.from - 2; z >= CAMP_WAY.to + 2; z -= 2) {
    if (Math.abs(z) < 6) continue;   // (the big fire at its heart: you pass it)
    for (const lift of [0.4, 1.4]) assert.equal(physics.rayHit(onWay(z, -CAMP_WAY.half, lift), across, 2 * CAMP_WAY.half), null, `something across the way ${z} m along it`);
  }
  const circles = level.crowdSpots().groups.filter((g) => g.id === 'camp');
  assert.ok(circles.length >= 5 && circles.length <= 8, `${circles.length} circles of people (13 before v1.42)`);
  for (const g of circles) {
    const l = local(g.at);
    assert.ok(!(Math.abs(l.x) < CAMP_WAY.half && l.z < CAMP_WAY.from && l.z > CAMP_WAY.to), `a circle in the way at ${l.x.toFixed(1)}, ${l.z.toFixed(1)}`);
  }
});

test('the gate is in sight from all along the way in, and the banners flank it', () => {
  const top = gate.clone(); top.y += 7;
  for (let z = 60; z >= -40; z -= 4) {
    const e = onWay(z, 0, 1.6), d = top.clone().sub(e), L = d.length();
    assert.equal(physics.rayHit(e, d.normalize(), L - 1), null, `the gate hidden ${z} m along the way`);
  }
  for (const [x, z] of CAMP_WAY.banners) assert.ok(Math.abs(x) > CAMP_WAY.half && Math.abs(x) < CAMP_WAY.half + 4 && z < CAMP_WAY.from && z > CAMP_WAY.to, `a banner off the way's edge (${x}, ${z})`);
  // each banner's pole stands where it should, beside the way
  for (const [x, z] of CAMP_WAY.banners) assert.ok(physics.rayHit(onWay(z, x - Math.sign(x) * 1, 3), across.clone().multiplyScalar(Math.sign(x)), 2), `the pole at ${x}, ${z}`);
});
