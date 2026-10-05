import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Ship } from '../src/ship/ship.js';
import { DECK, R, FLOOR_R, HATCH_A } from '../src/ship/hull.js';
import { polar } from '../src/ship/geo.js';
import { TABLE, UNIT_R, BLOCK_H } from '../src/ship/interior.js';
import { PLANETS } from '../src/ship/planets.js';

// The ship's deck, from player feedback: "the floor on the ship must be flat: the traveller moves up
// and down walking it" (he stepped up 18 cm over the corridor's skirting at every doorway, and up onto
// the stools, the bench, the bed: anything under a step's height); "remove the big structure in the
// middle" (the reactor column and the ring corridor round it: now a small holo table showing the
// planet you are on); "make the deck a bit smaller, for one pilot" (built-in units round the hull).

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
  for (let x = -9; x <= 9; x += 0.25) for (let z = -9; z <= 9; z += 0.25) {
    if (Math.hypot(x, z) > FLOOR_R - 0.05) continue;
    const p = ship.world(m, v(x, DECK, z));
    // the first surface under the traveller's step (0.6 m): the deck itself, or something low
    const g = physics.groundAt(p.x, deckY + 0.59, p.z, 2);
    if (Math.abs(g - deckY) < 0.002) { floor++; continue; }
    assert.ok(g < deckY + 0.6, `(${x}, ${z}): a surface at ${(g - deckY).toFixed(2)} m`);
    // a low surface: the traveller (a capsule over his step) must not fit there, so he walks round it
    const at = p.clone().setY(deckY);
    const push = physics.pushCapsule(at, 0.45, 0.6, 2.2);
    assert.ok(push, `(${x.toFixed(2)}, ${z.toFixed(2)}): ${(g - deckY).toFixed(2)} m up, and you could stand on it`);
    raised++;
  }
  assert.ok(floor > 2500, `plenty of open deck (${floor} spots, ${raised} under furniture)`);
});

test('walking across the deck keeps the traveller at one height: no bobbing over seams, rugs or furniture', () => {
  const { physics, ship } = world();
  const m = ship.parked, deckY = ship.world(m, v(0, DECK, 0)).y;
  const walks = [
    [polar(5.6, 0.3, DECK), polar(5.0, Math.PI - 0.5, DECK)],     // the bunk to the cockpit, past the table
    [polar(6.0, HATCH_A, DECK), polar(5.4, Math.PI * 1.5, DECK)],  // the hatch to the galley
    [polar(5.8, 0.9, DECK), polar(5.8, 4.0, DECK)],               // corner to corner, into the table and round it
    [polar(1.2, 0, DECK), polar(6.6, 2.0, DECK)],                 // out from the table to the crates
    [polar(2.8, 4.95, DECK), polar(6.5, 4.75, DECK)],             // into the stools, the table and the counter
  ];
  for (const [a, b] of walks) {
    const P = new Player(physics);
    P.opts.climb = false;
    P.respawn(ship.world(m, a));
    const target = ship.world(m, b);
    let lo = Infinity, hi = -Infinity;
    const start = P.pos.clone();
    for (let i = 0; i < 60 * 6; i++) {
      const h = Math.atan2(target.x - P.pos.x, target.z - P.pos.z);
      P.update(1 / 60, { KeyW: true }, h + Math.PI);
      if (i > 20) { lo = Math.min(lo, P.pos.y); hi = Math.max(hi, P.pos.y); }
    }
    assert.ok(P.pos.distanceTo(start) > 2, 'it walked');
    assert.ok(hi - lo < 0.005 && Math.abs(lo - deckY) < 0.005, `${a.toArray().map((n) => n.toFixed(1))} → ${b.toArray().map((n) => n.toFixed(1))}: height ${(lo - deckY).toFixed(3)} .. ${(hi - deckY).toFixed(3)}`);
  }
});

test('the middle of the deck is open round a small holo table (no reactor column, no ring corridor)', () => {
  const { physics, ship } = world();
  const m = ship.parked;
  assert.ok(!m.meshes.ringWall && !m.group.getObjectByName('ship-ringWall'), 'no ring corridor');
  // from beside the table, chest-high rays go out freely in every direction
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, from = ship.world(m, polar(1.3, a, DECK + 1.3));
    const dir = ship.world(m, polar(3, a, DECK + 1.3)).sub(from).normalize();
    assert.ok(physics.rayDistance(from, dir, 4) >= 4 - 1e-6, `open at ${a.toFixed(2)}`);
  }
  // the table itself is solid and small
  const over = ship.world(m, v(0.2, DECK + 2, 0.1)), deckY = ship.world(m, v(0, DECK, 0)).y;
  const top = physics.groundAt(over.x, over.y, over.z, 3) - deckY;
  assert.ok(top > TABLE.h - 0.05 && top < BLOCK_H + 0.01, `the table (or its block) is solid: ${top.toFixed(2)} m`);
  assert.ok(TABLE.r < 0.8);
  // and the deck is smaller: the built-ins stand round it, the open floor about 13-14 m across
  assert.ok(UNIT_R < 7.5 && UNIT_R > 6.4);
  const out = ship.world(m, polar(5.6, 4.5, DECK + 0.8)), dir = ship.world(m, polar(9, 4.5, DECK + 0.8)).sub(out).normalize();
  assert.ok(physics.rayDistance(out, dir, 4) < UNIT_R - 5.6 + 0.05, "the galley counter stands before the hull");
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
  const keys = ['wood', 'cream', 'locker', 'metal', 'crate', 'panel', 'floor', 'wall', 'ceiling', 'pot', 'leaf', 'blanket', 'cushion', 'pillow', 'collider'];
  const meshes = [...keys.map((k) => m.meshes[k]).filter(Boolean), m.interior.props];
  for (const mesh of meshes) {
    const p = mesh.geometry.attributes.position, q = v();
    let worst = 0;
    for (let i = 0; i < p.count; i++) worst = Math.max(worst, q.fromBufferAttribute(p, i).length());
    assert.ok(worst < R - 0.01, `${mesh.name}: ${worst.toFixed(3)} m from the centre (hull ${R})`);
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
  // across the hatch's doorway, from the hall over the deck's edge and the threshold to the hinge
  for (let r = 7.6; r <= 10.0; r += 0.1) for (let da = -0.08; da <= 0.08; da += 0.04) {
    const p = ship.world(m, polar(r, HATCH_A + da, DECK + 0.4));
    ray.set(p, v(0, -1, 0));
    ray.far = 0.6;
    const hits = ray.intersectObjects(drawn, false);
    const floor = hits.filter((h) => Math.abs(h.distance - hits[0].distance) < 0.004);
    assert.ok(floor.length <= 1, `r ${r.toFixed(1)}: ${floor.map((h) => h.object.name).join(' + ')} in one plane`);
    checked++;
  }
  assert.ok(checked > 50);
});
