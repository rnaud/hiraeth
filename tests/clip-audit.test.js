import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics, dropBuriedInstances, dropBuriedFlora } from '../src/physics.js';
import { auditClipping, formatAudit } from '../src/clip-audit.js';
import { settle } from '../src/boxes/index.js';
import { BOX, BOX_SCALE } from '../src/boxes/model.js';
import { createBazaar } from '../src/levels/bazaar.js';
import { buildPeople } from '../src/crowd.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const box = (scene, [x, y, z, w, h, d], { free = false, name = '' } = {}) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d));
  m.position.set(x, y, z); m.name = name;
  if (free) m.userData.noCollide = true;
  scene.add(m);
  return m;
};

test('the audit finds what floats, what is buried, and who stands in a wall', () => {
  const scene = new THREE.Scene();
  box(scene, [0, -0.5, 0, 200, 1, 200], { name: 'floor' });
  box(scene, [20, 3, 0, 6, 6, 6], { name: 'house' });
  box(scene, [0, 0.5, 0, 1, 1, 1], { name: 'crate' });                       // on the floor
  box(scene, [5, 2.5, 0, 1, 1, 1], { name: 'kite' });                        // in the air
  box(scene, [-5, 2.5, 0, 1, 1, 1], { name: 'lantern' }).userData.floats = true;   // in the air, on purpose
  box(scene, [20, 2.5, 0, 0.4, 3, 0.4], { free: true, name: 'tree in the house' });
  box(scene, [10, 1.5, 0, 0.4, 3, 0.4], { free: true, name: 'tree outside' });
  const physics = new Physics(scene);
  const npcs = [
    { def: { id: 'ok' }, pos: V(0, 0, 5) },
    { def: { id: 'sunk' }, pos: V(0, -0.4, 8) },
    { def: { id: 'hovering' }, pos: V(0, 0.5, 11) },
    { def: { id: 'in the wall' }, pos: V(16.85, 0, 0) },
  ];
  const r = auditClipping({ physics, scene, npcs });
  const issue = (name) => r.offenders.filter((o) => o.name === name).map((o) => o.issue);
  assert.deepEqual(issue('kite'), ['floats']);
  assert.deepEqual(issue('crate'), []);
  assert.deepEqual(issue('lantern'), [], 'marked to hang in the air');
  assert.deepEqual(issue('tree in the house'), ['stands inside a solid']);
  assert.deepEqual(issue('tree outside'), []);
  assert.deepEqual(issue('ok'), []);
  assert.deepEqual(issue('sunk'), ['feet sunk into the ground']);
  assert.deepEqual(issue('hovering'), ['hovers above the ground']);
  assert.deepEqual(issue('in the wall'), ['body in a wall']);
  assert.match(formatAudit(r), /offenders npc 3, prop 2/);
});

test('trees planted inside a house are left out; the ones outside, and one with its own collider, stay', () => {
  const scene = new THREE.Scene();
  box(scene, [0, -0.5, 0, 200, 1, 200]);
  box(scene, [0, 4, 0, 8, 8, 8]);                                          // a house
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 6).translate(0, 1.5, 0));   // an invisible trunk collider at x = 20
  trunk.position.set(20, 0, 0); trunk.visible = false; scene.add(trunk);
  const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 6, 6).translate(0, 3, 0), new THREE.MeshBasicMaterial(), 3);
  trees.userData.noCollide = true;
  [V(0, 0, 0), V(10, 0, 0), V(20, 0, 0)].forEach((p, i) => trees.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
  scene.add(trees);
  const physics = new Physics(scene);
  assert.equal(dropBuriedFlora(scene, physics), 1);
  const m = new THREE.Matrix4(), s = V();
  const scaleOf = (i) => { trees.getMatrixAt(i, m); return s.setFromMatrixScale(m).y; };
  assert.equal(scaleOf(0), 0, 'the one in the house is gone');
  assert.equal(scaleOf(1), 1);
  assert.equal(scaleOf(2), 1, 'inside only its own collider');
  assert.equal(dropBuriedInstances(trees, physics, [1, 3]), 0, 'nothing left to drop');
});

test('a box on the edge of a ledge moves back onto the ledge, all four corners on the ground', () => {
  const scene = new THREE.Scene();
  box(scene, [0, -0.5, 0, 200, 1, 200]);
  box(scene, [0, 1, 0, 4, 2, 4]);                                          // a ledge 2 m up, edges at x, z = ±2
  const physics = new Physics(scene);
  const s = settle(physics, 1.6, 0, 2, 0);                                  // its +x half hangs over the edge
  const hw = (BOX.w / 2) * BOX_SCALE, hd = (BOX.d / 2) * BOX_SCALE;   // (the box's footprint)
  assert.ok(Math.abs(s.y - 2) < 0.01 && s.x + hw <= 2.01, `on the ledge: ${JSON.stringify(s)}`);
  for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) assert.ok(Math.abs(physics.groundAt(s.x + lx, 3, s.z + lz) - 2) < 0.01, 'every corner on it');
});

test('the Signal Market: its crowd stands clear of walls, nothing floats or is buried', () => {
  const scene = new THREE.Scene(), level = createBazaar(scene), physics = new Physics(scene, level.ground);
  const { people } = buildPeople(physics, level.crowdSpots());
  const r = auditClipping({ physics, scene, crowd: { people } });
  assert.ok(r.checked.crowd > 300 && r.checked.prop > 10, JSON.stringify(r.checked));
  assert.ok((r.counts.crowd ?? 0) <= 1, formatAudit(r));
  assert.ok((r.counts.prop ?? 0) <= 2, formatAudit(r));
});
