import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Ship } from '../src/ship/ship.js';
import { DECK, HATCH, HALF_W, WALL_IN, halfWidthAt } from '../src/ship/hull.js';
import { TABLE, BLOCK_H, ROOMS, inRooms, GALLEY_X } from '../src/ship/interior.js';
import { PLANETS } from '../src/ship/planets.js';

// The ship's deck, from player feedback: "the floor on the ship must be flat: the traveller moves up
// and down walking it" (anything under a step's height you could walk onto lifted him); the middle of
// the main room is open round a small holo table showing the planet you are on. Since the angular hull
// (docs/systems/ship.md) the deck runs from the cockpit to the hold, one flat plane.

globalThis.window ??= { addEventListener() {} };
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

function world({ levelId = 'test', prologue = false } = {}) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: v(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId, content: { npcs: [], relics: { spots: [] } }, prologue }));
  return { physics, ship };
}

test('the deck is one flat plane: nothing under a step\'s height can be walked onto anywhere aboard', () => {
  const { physics, ship } = world();
  const m = ship.parked, deckY = ship.world(m, v(0, DECK, 0)).y;
  let floor = 0, raised = 0;
  for (let x = -3.2; x <= 3.2; x += 0.2) for (let z = ROOMS.cockpit.z0; z <= ROOMS.hold.z1; z += 0.2) {
    if (!inRooms(v(x, DECK + 0.1, z), { margin: -0.1 })) continue;
    const p = ship.world(m, v(x, DECK, z));
    // the first surface under the traveller's step (0.6 m): the deck itself, or something low
    const g = physics.groundAt(p.x, deckY + 0.59, p.z, 2);
    if (Math.abs(g - deckY) < 0.002) { floor++; continue; }
    assert.ok(g < deckY + 0.6, `(${x.toFixed(1)}, ${z.toFixed(1)}): a surface at ${(g - deckY).toFixed(2)} m`);
    // a low surface: the traveller (a capsule over his step) must not fit there, so he walks round it
    const push = physics.pushCapsule(p.clone().setY(deckY), 0.45, 0.6, 2.2);
    assert.ok(push, `(${x.toFixed(2)}, ${z.toFixed(2)}): ${(g - deckY).toFixed(2)} m up, and you could stand on it`);
    raised++;
  }
  assert.ok(floor > 1500, `plenty of open deck (${floor} spots, ${raised} under furniture)`);
});

test('walking across the deck keeps the traveller at one height: no bobbing over seams, rugs, doorways or furniture', () => {
  const { physics, ship } = world();
  const m = ship.parked, deckY = ship.world(m, v(0, DECK, 0)).y, P0 = m.interior.points;
  const walks = [
    [P0.cockpit, P0.bunkStand],                 // the cockpit to the bed, past the table and through the cabin's doorway
    [P0.hatchIn, v(GALLEY_X - 0.6, DECK, -3.0)], // the hatch to the galley counter
    [v(-1.2, DECK, -4.5), v(0, DECK, 8.6)],      // the main room to the hold, into its crates
    [v(-0.6, DECK, -0.4), v(2.0, DECK, 1.35)],   // into the small table and its seats
    [P0.hatchIn, v(-2.8, DECK, 1.6)],            // into the sofa
    [v(2.0, DECK, -2.6), v(-1.2, DECK, -2.6)],   // into the holo table and round it
  ];
  for (const [a, b] of walks) {
    const P = new Player(physics);
    P.opts.climb = false;
    P.respawn(ship.world(m, a));
    const target = ship.world(m, b);
    let lo = Infinity, hi = -Infinity;
    const start = P.pos.clone();
    for (let i = 0; i < 60 * 8; i++) {
      const h = Math.atan2(target.x - P.pos.x, target.z - P.pos.z);
      P.update(1 / 60, { KeyW: true }, h + Math.PI);
      if (i > 20) { lo = Math.min(lo, P.pos.y); hi = Math.max(hi, P.pos.y); }
    }
    assert.ok(P.pos.distanceTo(start) > 0.5, `it walked from ${a.toArray().map((n) => n.toFixed(1))}: ${P.pos.distanceTo(start).toFixed(2)} m`);
    assert.ok(hi - lo < 0.005 && Math.abs(lo - deckY) < 0.005, `${a.toArray().map((n) => n.toFixed(1))} → ${b.toArray().map((n) => n.toFixed(1))}: height ${(lo - deckY).toFixed(3)} .. ${(hi - deckY).toFixed(3)}`);
  }
});

test('the main room is open round a small holo table', () => {
  const { physics, ship } = world();
  const m = ship.parked, tp = m.interior.points.table;
  // from beside the table, chest-high rays go out a good way in every direction
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, d = v(Math.sin(a), 0, Math.cos(a));
    const from = ship.world(m, v(tp.x, DECK + 1.3, tp.z).addScaledVector(d, 1.0));
    const dir = d.clone().applyQuaternion(m.group.quaternion);
    assert.ok(physics.rayDistance(from, dir, 0.9) >= 0.9 - 1e-6, `open at ${a.toFixed(2)}`);
  }
  // the table itself is solid and small
  const over = ship.world(m, v(tp.x + 0.2, DECK + 2, tp.z + 0.1)), deckY = ship.world(m, v(0, DECK, 0)).y;
  const top = physics.groundAt(over.x, over.y, over.z, 3) - deckY;
  assert.ok(top > TABLE.h - 0.05 && top < BLOCK_H + 0.01, `the table (or its block) is solid: ${top.toFixed(2)} m`);
  assert.ok(TABLE.r < 0.8);
  // the galley counter stands along the starboard wall, before the hull
  const out = ship.world(m, v(1.0, DECK + 0.8, -4.2)), dir = v(1, 0, 0).applyQuaternion(m.group.quaternion);
  assert.ok(Math.abs(physics.rayDistance(out, dir, 4) - (GALLEY_X - 1.0)) < 0.08, `the galley counter: ${physics.rayDistance(out, dir, 4).toFixed(2)}`);
});

test('the holo table shows the planet the ship is at, in the galactic map\'s colours', () => {
  const { ship } = world({ levelId: 'garage' });
  const t = ship.parked.holoTable;
  assert.ok(t, 'a holo table');
  assert.equal('#' + t.body.material.uniforms.uBody.value.getHexString(), PLANETS.garage.body);
  assert.ok(t.face.children.length >= 3, 'the garage world has its ring');
  t.update(1 / 60, null);
  assert.ok(t.face.visible);
  t.power('dead'); t.update(1 / 60, null);
  assert.equal(t.face.visible, false, 'dark when the ship is dead');
  // the prologue's ship out in space: the desert below it
  const pro = world({ levelId: 'desert', prologue: true }).ship;
  assert.equal('#' + pro.spaceCopy.model.holoTable.body.material.uniforms.uBody.value.getHexString(), PLANETS.desert.body);
});

test('everything aboard stays inside the hull (nothing pokes out through it)', () => {
  const { ship } = world();
  const m = ship.parked;
  const keys = ['wood', 'cream', 'locker', 'metal', 'crate', 'panel', 'floor', 'wall', 'ceiling', 'pot', 'leaf', 'blanket', 'cushion', 'pillow', 'collider', 'wallIn', 'rug'];
  const meshes = [...keys.map((k) => m.meshes[k]).filter(Boolean), m.interior.props];
  for (const mesh of meshes) {
    const p = mesh.geometry.attributes.position, q = v();
    let worst = -Infinity, at = null;
    for (let i = 0; i < p.count; i++) {
      q.fromBufferAttribute(p, i);
      const y = THREE.MathUtils.clamp(q.y, DECK - 0.3, 3.2);   // (the deck's slab and the walls run into the hull's thickness)
      const over = Math.abs(q.x) - halfWidthAt(q.z, y);
      if (over > worst) { worst = over; at = q.clone(); }
    }
    assert.ok(worst < 0, `${mesh.name}: ${worst.toFixed(3)} m out through the hull at ${at?.toArray().map((n) => n.toFixed(2))}`);
  }
});

test('the doorway\'s floor is drawn once: no two surfaces in the same plane to flicker between as the camera moves', () => {
  const { ship } = world();
  const m = ship.parked;
  m.group.updateMatrixWorld(true);
  const drawn = [];
  m.group.traverse((o) => { if (o.isMesh && o.visible && o.parent.visible) drawn.push(o); });
  const ray = new THREE.Raycaster();
  let checked = 0;
  // across the hatch's doorway, from the main room over the wall's thickness and the threshold to the hinge
  for (let x = -(WALL_IN - 0.6); x >= -(HALF_W + 0.04); x -= 0.05) for (let z = HATCH.z0 + 0.05; z <= HATCH.z1 - 0.05; z += 0.2) {
    const p = ship.world(m, v(x, DECK + 0.4, z));
    ray.set(p, v(0, -1, 0));
    ray.far = 0.6;
    const hits = ray.intersectObjects(drawn, false);
    const floor = hits.filter((h) => Math.abs(h.distance - hits[0].distance) < 0.004);
    assert.ok(floor.length <= 1, `x ${x.toFixed(2)}: ${floor.map((h) => h.object.name).join(' + ')} in one plane`);
    checked++;
  }
  assert.ok(checked > 50);
});
