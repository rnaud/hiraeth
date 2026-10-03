import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBazaar } from '../src/levels/bazaar.js';
import { createIncal } from '../src/levels/incal.js';
import { Physics } from '../src/physics.js';
import { Crowd, CROWD_BUDGET, CROWD_TIER, figureGeometry, SPLASH_LINES, SHOVE_LINES } from '../src/crowd.js';
import { CROWD_POSES } from '../src/crowd-shader.js';
import { allTargets, clearTargets, raycastTargets, hitTarget, targetsInCone } from '../src/targets.js';
import { registerNPCTargets } from '../src/npc.js';

const cities = {};
function city(id) {
  if (!cities[id]) {
    const scene = new THREE.Scene();
    const level = (id === 'bazaar' ? createBazaar : createIncal)(scene);
    const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
    cities[id] = { scene, level, physics };
  }
  return cities[id];
}
// a stand-in for the pooled NPC bodies (the real ones need a DOM and the human models)
const fakeNPC = (kind) => ({ kind, pooled: true, person: null, assign(p) { this.person = p; }, release() { this.person = null; } });
const UP = new THREE.Vector3(0, 1, 0);
const DIRS = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(Math.cos(i * Math.PI / 4), 0, Math.sin(i * Math.PI / 4)));
function camAt(pos, look) {
  const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000);
  cam.position.copy(pos); cam.lookAt(look); cam.updateMatrixWorld();
  return cam;
}
function makeCrowd(id, o = {}) {
  clearTargets();
  const { scene, level, physics } = city(id);
  return new Crowd(scene, physics, { spots: level.crowdSpots(), makeNPC: fakeNPC, ...o });
}

for (const id of ['bazaar', 'incal']) {
  test(`${id}: crowd stands on walkable ground, clear of walls, never on roofs`, () => {
    const crowd = makeCrowd(id), { physics } = city(id);
    const o = new THREE.Vector3();
    let checked = 0;
    for (const p of crowd.people) {
      if (p.walk) continue;
      const g = physics.groundAt(p.pos.x, p.pos.y + 1.6, p.pos.z, 3.5);
      assert.ok(Math.abs(g - p.pos.y) < 0.05, `person ${p.id} floats or sinks: ${p.pos.toArray()} ground ${g}`);
      // room to stand: nothing overhead, no wall through the body
      assert.ok(physics.rayDistance(o.set(p.pos.x, p.pos.y + 0.15, p.pos.z), UP, 1.6) > 1.6, `person ${p.id} is under a ceiling`);
      if (p.pose !== CROWD_POSES.sit && p.pose !== CROWD_POSES.kerb) for (const d of DIRS)
        assert.ok(physics.rayDistance(o.set(p.pos.x, p.pos.y + 1.0, p.pos.z), d, 0.18) > 0.18, `person ${p.id} stands in a wall`);
      checked++;
    }
    // the walkers' routes run along the ground too
    for (const r of crowd.routes) for (const q of r.pts) assert.ok(Math.abs(physics.groundAt(q.x, q.y + 1, q.z, 3) - q.y) < 1e-4);
    assert.ok(checked > 200);
    // conversation circles of two to five, facing in
    for (const g of crowd.groups) {
      assert.ok(g.members.length >= 2 && g.members.length <= 5);
      for (const m of g.members) {
        const toC = Math.atan2(g.center.x - m.home.x, g.center.z - m.home.z);
        assert.ok(Math.abs(Math.atan2(Math.sin(toC - m.homeHeading), Math.cos(toC - m.homeHeading))) < 0.4, 'members face the circle');
      }
    }
  });
}

test('people counts: several hundred per city, mostly in groups, some walking or perched', () => {
  for (const [id, lo, hi] of [['bazaar', 400, 900], ['incal', 700, 1700]]) {
    const crowd = makeCrowd(id);
    const n = crowd.people.length, grouped = crowd.people.filter((p) => p.group).length, walking = crowd.people.filter((p) => p.walk).length;
    const perched = crowd.people.filter((p) => p.perch).length;
    assert.ok(n >= lo && n <= hi, `${id}: ${n} people`);
    assert.ok(grouped / n > 0.45, `${id}: mostly in groups (${grouped}/${n})`);
    assert.ok(walking > 60 && perched > 30, `${id}: ${walking} walking, ${perched} perched`);
    // the instanced figures stay low-poly
    assert.ok(figureGeometry('mid').index.count / 3 < 1200 && figureGeometry('far').index.count / 3 < 300);
  }
});

test('promotion and demotion respect the pool and the per-frame budget', () => {
  const crowd = makeCrowd('bazaar');
  const g = crowd.groups.find((q) => q.members.length >= 4 && q.center.z < 90 && q.center.z > 0) ?? crowd.groups[0];
  const player = { pos: g.center.clone().add(new THREE.Vector3(0, 0, 3)), vel: new THREE.Vector3() };
  const cam = camAt(player.pos.clone().add(new THREE.Vector3(0, 2, 4)), g.center);
  let last = { p: 0, d: 0 };
  const active = () => crowd.pool.filter((e) => e.person).length;
  for (let f = 0; f < 30; f++) {
    crowd.update(1 / 60, f / 60, player, cam);
    const S = crowd.stats, swaps = S.promoted - last.p + S.demoted - last.d;
    last = { p: S.promoted, d: S.demoted };
    assert.ok(swaps <= CROWD_BUDGET.swapsPerFrame, `frame ${f}: ${swaps} swaps`);
    assert.ok(active() <= CROWD_BUDGET.pool);
    for (const e of crowd.pool) if (e.person) {
      assert.equal(e.person.tier, CROWD_TIER.near);
      assert.equal(e.npc.person, e.person);
      assert.equal(e.kind, e.person.kind);
    }
  }
  assert.ok(active() >= 2, 'the closest people became full NPCs');
  assert.ok(crowd.mid.n > 0 && crowd.far.n > 0, 'the rest are instanced');
  // promoted people are drawn by their NPC only
  const near = new Set(crowd.pool.filter((e) => e.person).map((e) => e.person));
  assert.equal(crowd.stats.mid + near.size <= crowd.people.length, true);
  // walk away: everyone goes back to the instanced tiers, a couple per frame
  player.pos.set(0, 60, 260);
  const cam2 = camAt(new THREE.Vector3(0, 62, 266), new THREE.Vector3(0, 60, 200));
  for (let f = 0; f < 8; f++) {
    const before = active();
    crowd.update(1 / 60, 1 + f / 60, player, cam2);
    assert.ok(before - active() <= CROWD_BUDGET.swapsPerFrame);
  }
  assert.equal(active(), 0);
});

test('the fluid tool: nearby people are targets; a glob splashes and startles, the push shoves a group', () => {
  const crowd = makeCrowd('bazaar');
  const g = crowd.groups.find((q) => q.members.length >= 3 && q.center.z < 80 && q.center.z > 0) ?? crowd.groups[0];
  const player = { pos: g.center.clone().add(new THREE.Vector3(0, 0, 7)), vel: new THREE.Vector3() };
  const cam = camAt(player.pos.clone().add(new THREE.Vector3(0, 2, 5)), g.center);
  for (let f = 0; f < 12; f++) crowd.update(1 / 60, f / 60, player, cam);
  const targets = allTargets().filter((t) => t.kind === 'npc');
  assert.ok(targets.length > 10 && targets.length < crowd.people.length, `${targets.length} targets`);
  for (const t of targets) assert.ok(t.position().distanceTo(player.pos) < 62);
  // a glob splashes someone in the group
  const victim = g.members[0];
  const eye = player.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
  const dir = crowd.chest(victim).clone().sub(eye).normalize();
  const hit = raycastTargets(eye, dir, 80);
  assert.ok(hit && hit.target.person, 'the glob finds a person');
  const who = hit.target.person;
  assert.ok(hitTarget(hit, 'shoot', dir, { colours: ['#52c8cf', '#966ede'] }));
  assert.equal(who.startleT, crowd.time);
  assert.ok(SPLASH_LINES.includes(who.say), 'they complain about the splash');
  if (who.group) assert.ok(who.group.lookUntil > crowd.time && who.group.pauseUntil > crowd.time, 'the group looks round');
  // the startled person turns to face the player
  for (let f = 0; f < 60; f++) crowd.update(1 / 60, 0.2 + f / 60, player, cam);
  const toPlayer = Math.atan2(player.pos.x - who.pos.x, player.pos.z - who.pos.z);
  assert.ok(Math.abs(Math.atan2(Math.sin(toPlayer - who.heading), Math.cos(toPlayer - who.heading))) < 0.5);
  // the push: everyone in the cone is shoved away from the traveller, stumbling; the rest of the group jumps
  const standing = g.members.filter((m) => m.pose === CROWD_POSES.stand && !m.walk);
  const shoved = standing[0] ?? who, t0 = crowd.time;
  const from = shoved.pos.clone();
  const away = shoved.pos.clone().sub(player.pos).setY(0).normalize();
  const cone = targetsInCone(eye, crowd.chest(shoved).clone().sub(eye).normalize(), 12, 0.2);
  const entry = cone.find((h) => h.target.person === shoved);
  assert.ok(entry, 'the shoved person is in the cone');
  hitTarget(entry, 'push', entry.dir, { strength: 1 });
  assert.ok(crowd.time < shoved.stumbleUntil, 'stumbling');
  assert.ok(SHOVE_LINES.includes(shoved.say));
  for (const m of g.members) if (m !== shoved) assert.ok(m.startleT > t0 - 1e-9 && m.lookUntil > t0, 'the group reacts');
  for (let f = 0; f < 30; f++) crowd.update(1 / 60, 1.3 + f / 60, player, cam);
  const moved = shoved.pos.clone().sub(from).setY(0);
  assert.ok(moved.length() > 0.8, `knocked back ${moved.length().toFixed(2)} m`);
  assert.ok(moved.normalize().dot(away) > 0.7, 'away from the traveller');
  // and then they walk back to their place
  for (let f = 0; f < 300; f++) crowd.update(1 / 60, 1.8 + f / 60, player, cam);
  assert.ok(shoved.pos.distanceTo(from) < 0.6, 'back at their place');
  assert.ok(crowd.time > shoved.stumbleUntil);
  // unregistered once the player is far away
  player.pos.set(0, 0, -330);
  for (let f = 0; f < 12; f++) crowd.update(1 / 60, 3 + f / 60, player, camAt(new THREE.Vector3(0, 3, -335), new THREE.Vector3(0, 0, -400)));
  assert.ok(!allTargets().some((t) => t.person === who));
  crowd.dispose();
  // quest NPCs register too, and react to hits
  clearTargets();
  const hits = [];
  const npc = { pooled: false, object: { visible: true }, chest: (v) => v.set(0, 1.2, 0), hit: (mode) => hits.push(mode) };
  registerNPCTargets([npc, { pooled: true }]);
  assert.equal(allTargets().length, 1);
  const h = raycastTargets(new THREE.Vector3(0, 1.2, 5), new THREE.Vector3(0, 0, -1));
  hitTarget(h, 'shoot', new THREE.Vector3(0, 0, -1));
  assert.deepEqual(hits, ['shoot']);
  clearTargets();
});
