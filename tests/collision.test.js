import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBazaar } from '../src/levels/bazaar.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Hoverbike } from '../src/bike.js';
import { Bird } from '../src/bird.js';
import { Taxi } from '../src/taxi.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const bazaarScene = new THREE.Scene(), bazaar = createBazaar(bazaarScene), city = new Physics(bazaarScene, bazaar.ground);
const blockScene = (...boxes) => {
  const scene = new THREE.Scene();
  for (const [x, y, z, w, h, d] of boxes) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y, z); scene.add(m); }
  return new Physics(scene);
};
const inside = (physics, p) => physics.embedded(p.clone().add(v(0, 1.1, 0)));

test('embedded tells solid buildings from open air and rooms', () => {
  const physics = blockScene([0, 5, 0, 10, 10, 10], [0, -0.5, 0, 200, 1, 200]);
  assert.equal(physics.embedded(v(0, 5, 0)), true);
  assert.equal(physics.embedded(v(20, 1, 0)), false);
  assert.equal(physics.embedded(v(0, 12, 0)), false);
  // a hollow room built from wall slabs is a place, not a solid
  const room = blockScene([0, 0, 0, 12, 0.4, 12], [0, 6, 0, 12, 0.4, 12], [6, 3, 0, 0.4, 6, 12], [-6, 3, 0, 0.4, 6, 12], [0, 3, 6, 12, 6, 0.4], [0, 3, -6, 12, 6, 0.4]);
  assert.equal(room.embedded(v(0, 2, 0)), false);
  // a city tower whose floor lies flush on the street (coplanar faces)
  assert.equal(city.embedded(v(-54, 14, 105)), true);
  assert.equal(city.embedded(v(-20, 14, 105)), false);
  const out = physics.escape(v(3, 2, 0), 0.45, v(0, 1, 0), 1.1);
  assert.ok(out && out.x > 5.4 && !physics.embedded(out), `escapes through the nearest wall: ${out?.toArray()}`);
});

test('sprinting, gliding and the jetpack into a city tower never end up inside it', () => {
  // the first tower face west of the avenue, at balcony-free height
  const from = v(-20, 0, 105), dir = v(-1, 0, 0);
  for (const y of [1, 12, 40]) {
    from.y = y + 1.1;
    const hit = city.rayHit(from, dir, 80);
    assert.ok(hit, `a wall west of the avenue at ${y}`);
    for (const [speed, dt] of [[7.2, 1 / 60], [30, 1 / 60], [30, 1 / 20], [60, 1 / 20], [120, 1 / 20]]) {
      const p = new Player(city);
      p.opts.climb = false;
      p.pos.set(hit.point.x + 4, y, 105);
      p.onGround = y < 2;
      for (let i = 0; i < 30; i++) {
        p.vel.set(-speed, p.vel.y, 0);
        p.update(dt, {}, 0);
        assert.ok(!inside(city, p.pos), `inside the tower at ${speed} m/s, dt ${dt.toFixed(3)}, y ${y}: ${p.pos.toArray().map(n => n.toFixed(2))}`);
        assert.ok(p.pos.x > hit.point.x + 0.3, `passed the wall at ${speed} m/s, dt ${dt.toFixed(3)}, y ${y}: x ${p.pos.x.toFixed(2)} vs ${hit.point.x.toFixed(2)}`);
      }
    }
  }
});

test('a long fall lands on a thin roof instead of dropping through it', () => {
  const physics = blockScene([0, 20, 0, 10, 0.3, 10], [0, -0.5, 0, 200, 1, 200]);
  for (const dt of [1 / 60, 1 / 20]) for (const y of [60, 60.4, 60.9, 61.3]) {
    const p = new Player(physics, { health: false });   // (95 m/s would knock you out: this is about the roof)
    p.pos.set(0, y, 0); p.vel.set(0, -95, 0); p.onGround = false;
    for (let i = 0; i < 60; i++) p.update(dt, {}, 0);
    assert.ok(Math.abs(p.pos.y - 20.15) < 0.05, `stands on the roof (from ${y}, dt ${dt.toFixed(3)}): ${p.pos.y}`);
  }
});

test('a player buried in a building steps out to the nearest free spot', () => {
  const physics = blockScene([0, 15, 0, 10, 30, 30], [0, -0.5, 0, 200, 1, 200]);
  const p = new Player(physics);
  p.lastSafe.set(50, 0, 0);
  p.pos.set(3, 0.2, 0); p.vel.set(0, 0, 0);
  p.update(1 / 60, {}, 0);
  assert.ok(!inside(physics, p.pos), `out: ${p.pos.toArray()}`);
  assert.ok(Math.abs(p.pos.x - 5.45) < 0.2, `through the near wall, not the far one or the roof: ${p.pos.toArray()}`);
  for (let i = 0; i < 30; i++) p.update(1 / 60, {}, 0);
  assert.ok(p.onGround && Math.abs(p.pos.y) < 0.05);
  // inside a bazaar tower (standing on its floor, flush with the street)
  const q = new Player(city);
  q.pos.set(-40, 0, 105); q.lastSafe.set(0, 0, 88);
  for (let i = 0; i < 30; i++) q.update(1 / 60, {}, 0);
  // (out through the near face, past the shop built against it)
  assert.ok(!inside(city, q.pos) && q.pos.x > -34.1 && q.pos.x < -20, `out of the tower's near face: ${q.pos.toArray()}`);
  const push = city.pushCapsule(q.pos.clone(), 0.45, 0.6, 2.2);
  assert.ok(!push || Math.hypot(push.x, push.z) < 0.05, 'with room to stand (no wall pushing in)');
});

test('dismounting beside a wall or a building never leaves you inside it', () => {
  // the vehicle drives along a wall on its left (its usual exit side)
  const physics = blockScene([-3, 10, 0, 2, 20, 40], [0, -0.5, 0, 200, 1, 200]);
  for (const make of [() => new Hoverbike(physics), () => new Bird(physics), () => { const t = new Taxi(physics, '#fff', 1, () => {}); t.mode = 'parked'; return t; }]) {
    const p = new Player(physics), veh = make();
    veh.pos.set(-0.6, 1.2, 0); veh.heading = 0; veh.vel.set(0, 0, 20);
    p.vehicles = [veh];
    p.mount_(veh);
    p.dismount();
    assert.ok(!inside(physics, p.pos), `${veh.kind}: inside the wall at ${p.pos.toArray()}`);
    assert.ok(p.pos.x > -1.9 && !physics.pushCapsule(p.pos.clone(), 0.45, 0.6, 2.2), `${veh.kind}: body overlaps the wall at ${p.pos.toArray()}`);
  }
});

test('vehicles at full speed stop at walls instead of passing through', () => {
  const physics = blockScene([0, 10, 40, 40, 20, 1.2], [0, -0.5, 0, 400, 1, 400]);
  const bike = new Hoverbike(physics);
  bike.place(0, 0, 0, v());
  for (let i = 0; i < 80; i++) bike.update(1 / 20, { KeyW: true, ShiftLeft: true });
  assert.ok(bike.pos.z < 40, `bike z ${bike.pos.z}`);
  const bird = new Bird(physics);
  bird.mode = 'ridden'; bird.landed = false; bird.speed = 55; bird.heading = 0; bird.pos.set(0, 8, 0);
  for (let i = 0; i < 40; i++) bird.update(1 / 20, { KeyW: true });
  assert.ok(bird.pos.z < 40, `bird z ${bird.pos.z}`);
  // a cab drives itself: sent past the wall, it flies over it (the first clear way it knows), never through
  const taxi = new Taxi(physics, '#fff', 1, () => {});
  taxi.pos.set(0, 6, 0); taxi.heading = 0; taxi.board();
  assert.ok(taxi.goTo({ id: 'past', name: 'Past the wall', at: new THREE.Vector3(0, 6, 80), heading: 0, step: new THREE.Vector3(0, 0, 80) }));
  let lowest = Infinity;
  for (let i = 0; i < 20 * 30 && taxi.mode === 'route'; i++) {
    const z0 = taxi.pos.z;
    taxi.update(1 / 20, {}, i / 20);
    if ((z0 - 40) * (taxi.pos.z - 40) <= 0) lowest = Math.min(lowest, taxi.pos.y);
  }
  assert.equal(taxi.mode, 'aboard', 'it got there');
  assert.ok(taxi.pos.distanceTo(new THREE.Vector3(0, 6, 80)) < 0.6, `at the stop (${taxi.pos.toArray().map((x) => x.toFixed(1))})`);
  assert.ok(lowest > 20 + 0.6, `over the wall, not through it (${lowest.toFixed(1)} m up as it crossed)`);
  // a stop with no clear way to it (inside the wall): it says so and stays
  const why = [];
  taxi.onBlocked = (t, s, w) => why.push(w);
  assert.equal(taxi.goTo({ id: 'in', name: 'In the wall', at: new THREE.Vector3(0, 10, 40), heading: 0 }), false);
  assert.deepEqual(why, ['none']);
  assert.equal(taxi.mode, 'aboard');
});
