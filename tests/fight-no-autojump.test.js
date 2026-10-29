// Never a jump of his own in a fight (issue #747, the author: "Never auto jump when fighting enemies"): walked, backed or
// rolled into a wall while a fight is on he stays on his feet (out of one, a wall pushed into for a quarter second is
// climbed, as ever); the blade's rising cut never leaps at a foe (tests/combat-feel.test.js); walking off a ledge is a fall.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';

const scene = new THREE.Scene();
const floor = new THREE.Mesh(new THREE.BoxGeometry(80, 1, 80), new THREE.MeshBasicMaterial()); floor.position.set(0, -0.5, 0); scene.add(floor);
const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 1), new THREE.MeshBasicMaterial()); wall.position.set(0, 3, 4); scene.add(wall);
const ledge = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 10), new THREE.MeshBasicMaterial()); ledge.position.set(-25, 2, -20); scene.add(ledge);
const physics = new Physics(scene);
const CAM = Math.PI;   // (the camera behind him, looking +z: W walks +z)

function walkInto(fight) {
  const P = new Player(physics, { health: false, climb: true });
  P.pos.set(0, 0.05, 1); P.heading = 0;
  let climbed = false;
  for (let i = 0; i < 90; i++) { P.inFight = fight; P.update(1 / 60, { KeyW: true }, CAM); climbed ||= !!P.climbing || !!P.mantle; }
  return { climbed, P };
}

test('out of a fight, a wall walked into is climbed; in a fight he stays on his feet against it (#747)', () => {
  assert.equal(walkInto(false).climbed, true, 'out of a fight: the climb, as ever');
  const { climbed, P } = walkInto(true);
  assert.equal(climbed, false, 'in a fight: no climb of its own');
  assert.ok(P.onGround && P.pos.y < 0.3, `on his feet at the wall (y ${P.pos.y.toFixed(2)})`);
});

test('in a fight, walking off a ledge is still a fall (#747)', () => {
  const P = new Player(physics, { health: false, climb: true });
  P.pos.set(-25, 4.05, -20); P.heading = 0;
  let left = false;
  for (let i = 0; i < 200 && !left; i++) { P.inFight = true; P.update(1 / 60, { KeyW: true }, CAM); if (P.pos.y < 3) left = true; }
  assert.ok(left, 'off the edge and down');
});
