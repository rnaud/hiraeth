// A city's space port, the stand-in (issue #397; src/levels/port-pad.js; docs/design/space-ports.md): the City Floating
// in Space's port on the Pier: the pad round the ship's site, the docks out over the void, the craft over the city.
// Nothing of it is solid, the ship lands where it did, the way off the Pier stays clear, and the craft keep flying.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RoomKit } from '../src/levels/lab-kit.js';
import { buildPortPad, PAD_LIFT } from '../src/levels/port-pad.js';
import { Physics } from '../src/physics.js';
import { createSpaceCity, SC_PORT, SHIP_SITE, ISLANDS } from '../src/levels/space-city.js';

const mats = () => Object.fromEntries(['paint', 'trim', 'iron', 'lamp', 'cable'].map((k) => [k, new THREE.MeshBasicMaterial()]));

test('the port is data: a pad, docks and traffic built from kit pieces, nothing walked on, the parked craft baked into the kit', () => {
  const group = new THREE.Group(), kit = new RoomKit({ group, centre: new THREE.Vector3(), seed: 1 });
  const port = buildPortPad(kit, mats(), SC_PORT);
  kit.finish();
  assert.ok(group.children.length > 0);
  for (const m of group.children) assert.equal(m.userData.noCollide, true, `${m.material.type}: nothing of the port is solid`);
  // a handful of merged meshes for the whole pad and both docks, the two parked craft among them (no draw call of their own)
  assert.ok(group.children.length <= 16, `${group.children.length} meshes`);
  assert.equal(port.craft.length, SC_PORT.traffic.length);
  assert.equal(port.sights.length, 1);
  assert.ok(PAD_LIFT > 0.02 && PAD_LIFT < 0.1, 'the paint just over the deck');
});

test('the craft fly their loops: moving each frame, at their heights, nose along the way', () => {
  const kit = new RoomKit({ group: new THREE.Group(), centre: new THREE.Vector3(), seed: 1 });
  const port = buildPortPad(kit, mats(), SC_PORT);
  const start = port.craft.map((c) => c.position.clone());
  for (let i = 0; i < 60; i++) port.update(1 / 30);
  port.craft.forEach((c, i) => {
    const T = SC_PORT.traffic[i], moved = c.position.distanceTo(start[i]);
    assert.ok(moved > (T.speed ?? 12) * 1.5 && moved < (T.speed ?? 12) * 2.5, `craft ${i} moved ${moved.toFixed(1)} m in 2 s`);
    assert.ok(Math.abs(c.position.y - (T.centre[1] + T.h)) < 1, `craft ${i} at its height`);
  });
});

test('in the city: the ship lands on the pad, the docks over the void, the way off the Pier clear', () => {
  const scene = new THREE.Scene(), w = console.warn; console.warn = () => {};
  let level; try { level = createSpaceCity(scene); } finally { console.warn = w; }
  const physics = new Physics(scene, level.ground);
  assert.deepEqual([SC_PORT.pad.x, SC_PORT.pad.z], [SHIP_SITE.x, SHIP_SITE.z], 'the pad round the ship\'s site');
  assert.deepEqual([level.shipSite.x, level.shipSite.z], [SHIP_SITE.x, SHIP_SITE.z], 'the ship lands where it did');
  const P = ISLANDS.pier;
  for (const D of SC_PORT.docks) {
    const end = [D.x + Math.sin(D.yaw) * D.len, D.z + Math.cos(D.yaw) * D.len];
    assert.ok(Math.hypot(end[0] - P.x, end[1] - P.z) > P.w / 2 + 4, 'each dock reaches out past the rim');
    assert.ok(!Number.isFinite(physics.groundAt(end[0], 5, end[1], 30)) || physics.groundAt(end[0], 5, end[1], 30) < -5, 'nothing to stand on at its end: the void');
  }
  assert.ok(level.sights.some((s) => s.name === 'the Pier’s docks'));
  // the craft over the city are in the scene, and the level moves them
  const flyer = scene.getObjectByName('port traffic 0'), was = flyer.position.clone();
  level.update(0.5);
  assert.ok(flyer.position.distanceTo(was) > 1);
});
