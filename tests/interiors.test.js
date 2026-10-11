// The interior kit (src/interior-kit.js; docs/systems/interiors.md): a door in the world, the room it opens on
// (far overhead, at a fixed slot), the portals both ways, and a save made inside that loads inside.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { inTightRoom } from '../src/interiors.js';
import { INTERIOR, interiorSlot, interiorAt, interiors, buildInterior, buildShopfront, wallBoxes } from '../src/interior-kit.js';
import { viaPortal } from '../src/scout.js';
import { PlaceName } from '../src/hud.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** A level's portal list walked as main.js does: inside one's radius, you are carried to its `to`. */
function through(portals, p) {
  for (const pt of portals) if (p.distanceTo(pt.at) < pt.r) return pt;
  return null;
}
/** A flat street with an interior on it. */
function street(slot = 3, heading = 0.7) {
  const scene = new THREE.Scene();
  const ground = new THREE.Mesh(new THREE.BoxGeometry(400, 1, 400).translate(0, -0.5, 0));
  scene.add(ground);
  const door = { at: v(40, 0, -25), heading };
  const it = buildInterior(scene, { id: 'test.shop', label: 'The Test Shop', doorLabel: 'shop door', slot, door, front: { sign: 'TEST SHOP' } });
  return { scene, it, door, physics: new Physics(scene) };
}

test('the slots: fixed places high over every temple\'s rooms, one per interior', () => {
  assert.ok(INTERIOR.y >= 2900, 'over the temples (their origins reach 2400 m)');
  assert.deepEqual(interiorSlot(0).toArray(), interiorSlot(0).toArray(), 'the same slot, the same place');
  const a = interiorSlot(0), b = interiorSlot(1), c = interiorSlot(INTERIOR.row);
  assert.ok(a.distanceTo(b) >= 60 && a.distanceTo(c) >= 60, 'rooms far enough apart not to see each other');
  assert.equal(a.y, INTERIOR.y);
});

test('a wall\'s boxes leave its holes open', () => {
  const boxes = wallBoxes(6, 4, 0.5, [{ x0: 2.2, x1: 3.8, y0: 0, y1: 2.6 }]);
  const inHole = (x, y) => boxes.some((g) => { g.computeBoundingBox(); const b = g.boundingBox; return x > b.min.x && x < b.max.x && y > b.min.y && y < b.max.y; });
  assert.ok(!inHole(0, 1.2), 'the door hole (its middle, x 0 from the wall\'s middle) is open');
  assert.ok(inHole(0, 3.3), 'the lintel over it is wall');
  assert.ok(inHole(-2.5, 1.2) && inHole(2.5, 1.2), 'and either side');
});

test('enter and exit: in at the door, into the room facing in; out through its door, back in front of the same door facing out', () => {
  const { it, door } = street();
  assert.equal(it.portals.length, 2);
  // standing in front of the door, walking into it
  const fwd = v(Math.sin(door.heading), 0, Math.cos(door.heading));
  const P = door.at.clone().addScaledVector(fwd, 0.6);
  const inWay = through(it.portals, P);
  assert.ok(inWay, 'a step from the door: the way in');
  assert.equal(inWay.label, 'shop door', 'named for the scout');
  assert.ok(inWay.to.y > 2900, 'the room is far overhead');
  assert.equal(interiorAt(inWay.to), it, 'landing inside it');
  assert.ok(inTightRoom(inWay.to), 'the camera frames it tight (src/player.js), no rain falls in it');
  // facing into the room (the room is built unturned: its door in its +z wall, so in is -z)
  assert.ok(Math.abs(Math.cos(inWay.heading) + 1) < 1e-6, 'facing in');
  // and the way out: the room's own door
  const outWay = it.portals[1];
  assert.equal(interiorAt(outWay.at), it, 'the way out is at the room\'s door');
  const back = outWay.to;
  assert.equal(interiorAt(back), null, 'out in the street');
  assert.ok(back.distanceTo(door.at) < 3 && back.distanceTo(door.at) > 2, 'in front of the same door');
  assert.ok(Math.abs(outWay.heading - door.heading) < 1e-9, 'facing out, the way the door does');
  assert.equal(through([inWay], back), null, 'not straight back in again');
  // main.js finds the rooms off the map from the portals: the room more than 200 m over the ground
  assert.ok(inWay.to.y - 0 > 200);
});

test('the room is a closed room: floor, walls and the door; the shopfront is solid with a lit recess for its door', () => {
  const { it, physics, door } = street();
  const p = it.inside.clone();
  const floor = physics.groundAt(p.x, p.y + 1.5, p.z);
  assert.ok(Math.abs(floor - it.room.group.position.y) < 0.2, `standing on its floor (${floor})`);
  const head = p.clone().add(v(0, 1.4, 0));
  for (const d of [v(1, 0, 0), v(-1, 0, 0), v(0, 0, -1)]) assert.ok(physics.rayDistance(head, d, 30) < 10, 'a wall that way');
  assert.ok(physics.rayDistance(head, v(0, 1, 0), 30) < 5, 'a ceiling');
  // out through the door (+z): open, past the door's frame
  const doorWay = it.local(0, 1.2, it.size.d / 2 - 1);
  assert.ok(physics.rayDistance(doorWay, v(0, 0, 1), 1.8) === Infinity || physics.rayDistance(doorWay, v(0, 0, 1), 1.8) > 1.7, 'the door is open');
  // the shopfront: its front wall stops you either side of the door, the recess lets you up to the way in
  const fwd = v(Math.sin(door.heading), 0, Math.cos(door.heading)), side = v(fwd.z, 0, -fwd.x);
  const before = door.at.clone().addScaledVector(fwd, 2).add(v(0, 1.2, 0));
  const back = fwd.clone().negate();
  assert.ok(physics.rayDistance(before.clone().addScaledVector(side, 3.2), back, 6) < 2.5, 'wall beside the door');
  assert.ok(physics.rayDistance(before, back, 6) > 2.3, 'the door recess');
  assert.ok(it.front.group.children.some((m) => m.userData.noCollide), 'the lit recess and the sign never stop you');
});

test('a save made inside loads inside: the same slot, the same room, its floor under you', () => {
  const a = street(5);
  const saved = JSON.parse(JSON.stringify({ pos: a.it.inside.toArray() }));
  // the world unloads (the room leaves the scene) and is built again on the next load
  a.scene.remove(a.it.room.group);
  assert.equal(interiorAt(new THREE.Vector3(...saved.pos)), null, 'gone with its level');
  const b = street(5);
  const p = new THREE.Vector3(...saved.pos);
  assert.equal(interiorAt(p), b.it, 'the save\'s place is in the room again');
  assert.ok(Math.abs(b.physics.groundAt(p.x, p.y + 1.5, p.z) - b.it.room.group.position.y) < 0.2, 'with its floor under you');
  assert.ok(interiors().includes(b.it) && !interiors().includes(a.it));
});

test('the scout routes a find through the door either way', () => {
  const { it } = street(7);
  const outside = { id: 'well', label: 'The well', position: v(120, 0, 60) };
  const r = viaPortal(it.inside, outside, it.portals);
  assert.match(r.label, /^Through the door/);
  const inside = { id: 'counter', label: 'The counter', position: it.local(0, 1, -1) };
  const r2 = viaPortal(v(60, 0, -10), inside, it.portals);
  assert.equal(r2.label, 'Through the shop door');
});

test('a shopfront alone: a door on the ground, facing its heading, its lantern among the lights', () => {
  const scene = new THREE.Scene();
  const f = buildShopfront(scene, { at: v(5, 2, 5), heading: Math.PI / 2, sign: 'CHIMES' });
  assert.ok(f.door.distanceTo(v(5, 2, 5)) < 1e-6);
  assert.equal(f.lights.length, 1);
  const out = f.local(0, 0, 1).sub(f.door);
  assert.ok(Math.abs(out.x - 1) < 1e-6, 'out of the door along its heading');
});

test('main.js: inside a building the air and the place name are the door\'s; the panel takes the controller', () => {
  const m = src('src/main.js');
  assert.match(m, /placeName\.update\(indoors\?\.label \?\? atmo\?\.name, now, \{ quiet: !indoors && placeName\.wasIndoors, hold: /, 'the cue names the shop as you step in, and not the street as you step out');
  assert.match(m, /const indoorAt = interiorAt\(player\.pos\)\?\.door\.at/, 'the street\'s light and air inside');
  assert.match(m, /altitude: interiorAt\(player\.pos\) \? 0/, 'no high-altitude wind indoors');
});

test('the place name: the shop\'s as you step in, nothing as you step back out into the street', () => {
  const p = new PlaceName({ settle: 1000, show: 3000 });
  p.update('Rose canyons', 0); p.update('Rose canyons', 3500);   // (where you arrive: named first, issue #78)
  assert.equal(p.update('The Test Shop', 4000), '');
  assert.equal(p.update('The Test Shop', 5100), 'The Test Shop', 'inside: named');
  assert.equal(p.update('Rose canyons', 9000, { quiet: true }), '', 'out again: the street is not news');
  assert.equal(p.update('Rose canyons', 12000), '');
});
