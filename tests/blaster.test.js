import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Blaster, Dart, MODES, TOOL, launchDir, predictArc, toolInput, traceShot } from '../src/blaster.js';
import { clearTargets, hitTarget, registerTarget } from '../src/targets.js';
import { ReactiveWorld } from '../src/reactive-world.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Collision stub: one infinite plane (point p, normal n), hit from either side. */
function planePhysics(p, n) {
  return {
    rayHit(origin, dir, far) {
      const denom = dir.dot(n);
      if (Math.abs(denom) < 1e-9) return null;
      const t = p.clone().sub(origin).dot(n) / denom;
      if (t < 0 || t > far) return null;
      return { distance: t, point: origin.clone().addScaledVector(dir, t), normal: denom > 0 ? n.clone().negate() : n.clone() };
    },
    rayDistance(origin, dir, far) { return this.rayHit(origin, dir, far)?.distance ?? Infinity; },
  };
}
const open = { rayHit: () => null, rayDistance: () => Infinity };

function target(pos, radius = 0.6, kind = 'wildlife') {
  const hits = [];
  registerTarget({ kind, radius, position: () => pos, onHit: (mode, point, dir) => hits.push({ mode, point, dir }) });
  return hits;
}

test('the ray hits the nearest target along it, and the world occludes', () => {
  clearTargets();
  const near = target(v(0, 0, -10)), far = target(v(0, 0, -20)), aside = target(v(3, 0, -5));
  const dir = v(0, 0, -1);
  const shot = traceShot(open, v(), dir);
  assert.equal(shot.kind, 'target');
  assert.ok(Math.abs(shot.distance - 9.4) < 1e-6);
  hitTarget(shot.hit, 'stun', dir);
  assert.equal(near.length, 1); assert.equal(near[0].mode, 'stun');
  assert.equal(far.length, 0); assert.equal(aside.length, 0);
  // a wall in front of the nearest target blocks the ray
  const blocked = traceShot(planePhysics(v(0, 0, -6), v(0, 0, 1)), v(), dir);
  assert.equal(blocked.kind, 'world');
  assert.ok(Math.abs(blocked.point.z + 6) < 1e-6);
  // a wall behind it doesn't
  assert.equal(traceShot(planePhysics(v(0, 0, -15), v(0, 0, 1)), v(), dir).target, traceShot(open, v(), dir).target);
  // out of range: nothing
  clearTargets(); target(v(0, 0, -60));
  assert.equal(traceShot(open, v(), dir).kind, 'none');
  assert.equal(traceShot(open, v(), dir).distance, TOOL.range);
});

test('a dart arcs under rotated gravity and hits the target it was lobbed at', () => {
  clearTargets();
  // gravity pulls toward -x in this level; after 1 s at 20 m/s the dart is 20 m out and 7 m "down"
  const up = v(1, 0, 0), g = 14;
  const hits = target(v(-7, 0, -20), 0.6, 'switch');
  const dart = new Dart(v(), v(0, 0, -20));
  let event = null;
  for (let i = 0; i < 200 && !event; i++) event = dart.step(1 / 60, { physics: open, up, gravity: g });
  assert.equal(event?.type, 'target');
  assert.equal(dart.state, 'stuck');
  assert.ok(Math.abs(dart.pos.y) < 1e-9, 'no drift along the old up');
  hitTarget(event.hit, 'dart', event.dir);
  assert.equal(hits.length, 1); assert.equal(hits[0].mode, 'dart');
  // the same shot under ordinary gravity falls along -y and misses it
  const straight = new Dart(v(), v(0, 0, -20));
  let other = null;
  for (let i = 0; i < 200 && !other; i++) other = straight.step(1 / 60, { physics: open, up: v(0, 1, 0), gravity: g });
  assert.equal(other, null);
  // the preview arc agrees with the flight
  const { end } = predictArc(v(), v(0, 0, -20), { physics: open, up, gravity: g, dt: 1 / 60, steps: 200 });
  assert.equal(end?.type, 'target');
  // the launch solve lobs the dart onto the crosshair point, whichever way gravity points
  for (const gup of [v(0, 1, 0), v(1, 0, 0), v(0, -0.6, 0.8)]) {
    clearTargets();
    const aimAt = v(4, -2, -25), got = target(aimAt, 0.4);
    const d = new Dart(v(), launchDir(v(), aimAt, TOOL.dartSpeed, TOOL.dartGravity, gup).multiplyScalar(TOOL.dartSpeed));
    let e = null;
    for (let i = 0; i < 300 && !e; i++) e = d.step(1 / 120, { physics: open, up: gup });
    assert.equal(e?.type, 'target', `gravity along ${gup.toArray()}`);
    assert.equal(got.length, 0);
  }
});

test('a dart bounces off the world, comes to rest and never triggers a target behind the wall', () => {
  clearTargets();
  const hits = target(v(0, 0, -12));
  const dart = new Dart(v(), v(0, 0, -20));
  const physics = planePhysics(v(0, 0, -6), v(0, 0, 1));
  const events = [];
  for (let i = 0; i < 400; i++) { const e = dart.step(1 / 60, { physics, up: v(0, 1, 0) }); if (e) events.push(e); }
  assert.ok(events.length >= 1);
  assert.equal(events[0].type, 'world'); assert.equal(events[0].first, true);
  assert.ok(dart.vel.z >= 0, 'bounced back off the wall');
  assert.equal(hits.length, 0);
});

function stubPlayer() {
  const frame = { up: v(0, 1, 0), fwd: v(0, 0, 1), right: v(1, 0, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) };
  return { pos: v(), heading: Math.PI, frame, vehicles: [], object: { visible: true }, ride: null, gliding: false, climbing: false, mantle: null, thrusting: false, aim: null };
}

test('the mode switches on a press (keyboard, mouse or pad) and stays put while held', () => {
  clearTargets();
  const b = new Blaster({ scene: new THREE.Scene(), player: stubPlayer(), physics: open, camera: new THREE.PerspectiveCamera() });
  assert.equal(b.mode, 'stun');
  b.update(1 / 60, { KeyX: true }); assert.equal(b.mode, 'dart');
  b.update(1 / 60, { KeyX: true }); assert.equal(b.mode, 'dart');
  b.update(1 / 60, {}); b.update(1 / 60, { PadMode: true }); assert.equal(b.mode, 'stun');
  b.update(1 / 60, {}); b.update(1 / 60, { MouseMiddle: true }); assert.equal(b.mode, 'dart');
  // in menus / photo mode / riding nothing switches
  b.update(1 / 60, {}); b.update(1 / 60, { KeyX: true }, true); assert.equal(b.mode, 'dart');
  b.player.ride = {}; b.update(1 / 60, {}); b.update(1 / 60, { KeyX: true }); assert.equal(b.mode, 'dart');
  assert.deepEqual(MODES, ['stun', 'dart']);
  assert.deepEqual(toolInput({ KeyR: true, KeyG: true }), { aim: true, fire: true, mode: false });
  assert.deepEqual(toolInput({ PadAim: true, PadFire: true, PadMode: true }), { aim: true, fire: true, mode: true });
});

test('aiming raises the tool, sets the pose and fires the ray at the crosshair', () => {
  clearTargets();
  const player = stubPlayer();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0.8, 1.6, 3.4); camera.lookAt(0.8, 1.6, -30); camera.updateMatrixWorld();
  const hits = target(v(0.8, 1.6, -20), 0.8);
  const rig = { aimK: 0 };
  const b = new Blaster({ scene: new THREE.Scene(), player, physics: open, camera, rig });
  for (let i = 0; i < 30; i++) b.update(1 / 60, { KeyR: true });
  assert.ok(b.aiming && player.aim?.k > 0.9 && rig.aimK > 0.9);
  assert.ok(player.aim.point.distanceTo(v(0.8, 1.6, -19.2)) < 0.05, 'the crosshair sits on the target');
  b.update(1 / 60, { KeyR: true, KeyG: true });
  assert.equal(hits.length, 1); assert.equal(hits[0].mode, 'stun');
  assert.ok(b.energy < 1 && b.beams.length === 1);
  // the gauge empties: no more hits until it refills
  for (let i = 0; i < 300; i++) b.update(1 / 60, { KeyR: true, KeyG: true });
  const fired = hits.length;
  assert.ok(fired > 1 && fired <= Math.ceil(1 / TOOL.stunCost) + 6);
  // letting go puts it away
  for (let i = 0; i < 90; i++) b.update(1 / 60, {});
  assert.equal(player.aim, null); assert.equal(b.k, 0);
  // a dart, fired at the same target, flies there and hits it
  b.setMode('dart', true);
  hits.length = 0;
  for (let i = 0; i < 20; i++) b.update(1 / 60, { KeyR: true });
  b.update(1 / 60, { KeyR: true, KeyG: true });
  for (let i = 0; i < 120 && !hits.length; i++) b.update(1 / 60, { KeyR: true });
  assert.equal(hits.length, 1); assert.equal(hits[0].mode, 'dart');
});

test('a dart wakes a reactive node from afar, with its echo wave and memory', () => {
  clearTargets();
  const store = { value: null, getItem() { return this.value; }, setItem(k, val) { this.value = val; } };
  const ground = { rayHit: (origin) => ({ point: v(origin.x, 0, origin.z) }), rayDistance: () => Infinity };
  const scene = new THREE.Scene();
  const world = new ReactiveWorld(scene, { id: 'desert', spawn: v(), ground: { heightAt: () => 0 } }, ground, { npcs: [], story: { goal: [0, 0, -100] }, relics: { spots: [] } }, { storage: store });
  const node = world.field.nodes[0];
  const neighbour = world.field.nodes.find((n) => n !== node && n.cluster === node.cluster);
  assert.equal(node.energy, 0);
  // fire from 25 m away, level, straight at it (no gravity drop over this short flight)
  const from = node.pos.clone().add(v(25, 0, 0));
  const dart = new Dart(from, node.pos.clone().sub(from).normalize().multiplyScalar(TOOL.dartSpeed));
  let event = null;
  for (let i = 0; i < 120 && !event; i++) event = dart.step(1 / 60, { physics: open, up: v(0, 1, 0), gravity: 0 });
  assert.equal(event?.type, 'target');
  assert.equal(event.hit.target.kind, 'reactive');
  hitTarget(event.hit, 'dart', event.dir);
  assert.ok(world.field.seen.has(node.cluster), 'the encounter is remembered');
  assert.ok(Number.isFinite(neighbour.pulseAt), 'an echo is on its way through the cluster');
  assert.equal(node.cooldown, 7);
  // the paralyze ray only makes it shimmer: no new encounter
  const other = world.field.nodes.find((n) => n.cluster !== node.cluster);
  const ray = traceShot(open, other.pos.clone().add(v(0, 20, 0)), v(0, -1, 0));
  assert.equal(ray.kind, 'target');
  hitTarget(ray.hit, 'stun', v(0, -1, 0));
  assert.ok(!world.field.seen.has(other.cluster) && other.pulse > 0.4);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(500, 2, 500); camera.updateMatrixWorld();
  const far = { pos: v(500, 0, 500), frame: { up: v(0, 1, 0) } };
  world.update(0.5, 0, far, camera);
  assert.ok(node.energy > 0.3, 'the node lights up although the traveller is far away');
  for (let i = 0; i < 20; i++) world.update(0.25, 0, far, camera);
  assert.ok(neighbour.energy > 0.1, 'the neighbour echoes');
  world.flush();
  assert.ok(JSON.parse(store.value).seen.includes(node.cluster));
  world.dispose();
});

test('darts turn observatory lenses from up on the tower, ring the gate, hail taxis and reach level targets', async () => {
  clearTargets();
  const { buildObservatory, ObservatoryQuest } = await import('../src/observatory.js');
  const { Gate } = await import('../src/quest.js');
  const scene = new THREE.Scene(), model = buildObservatory(scene, { baseAt: () => 0 }); scene.updateMatrixWorld(true);
  const journal = { data: { observatory: { started: true, turns: [1, 0, 3], done: false, fragments: [] } }, save() {} };
  const quest = new ObservatoryQuest({ model, journal, traveler: { lines: [], pos: v(), greeted: false }, sound: { chime() {} } });
  const lens = model.dials[0].getWorldPosition(v());
  const shoot = (from, at) => traceShot(open, from, at.clone().sub(from).normalize(), 60);
  // from the dunes below, the lens can't be reached
  quest.update(0, { pos: lens.clone().add(v(0, -50, 40)), riding: false }, {}, false);
  assert.notEqual(shoot(lens.clone().add(v(0, -50, 40)), lens).target?.kind, 'lens');
  // from a ledge 12 m away it turns, exactly like pressing E beside it
  const ledge = lens.clone().add(v(12, -1, 0));
  quest.update(0, { pos: ledge, riding: false }, {}, false);
  const shot = shoot(ledge, lens);
  assert.equal(shot.target?.kind, 'lens');
  hitTarget(shot.hit, 'dart', v());
  assert.deepEqual(quest.state.turns, [2, 0, 3]);
  assert.equal(quest.state.done, true);
  quest.dispose();

  clearTargets();
  const gate = new Gate(scene, { pos: v(0, 0, -30), heading: 0, sound: { chime() {} } });
  const g = shoot(v(0, 4, 0), v(0, 4, -30));
  assert.equal(g.target?.kind, 'gate');
  hitTarget(g.hit, 'dart', v(0, 0, -1));
  assert.ok(gate.ringT > 1);
  gate.update(0.1, 0, { pos: v() });
  assert.ok(gate.glyph.scale.x > 1.2 && gate.light.w > 14);

  clearTargets();
  const hails = [], plant = [];
  const taxi = { pos: v(0, 10, -25), mode: 'lane', hail: (p) => hails.push(p.clone()) };
  const player = { ...stubPlayer(), vehicles: [taxi] };
  const b = new Blaster({ scene, player, physics: open, camera: new THREE.PerspectiveCamera(),
    level: { targets: [{ kind: 'plant', radius: 2, position: () => v(20, 2, -20), onHit: (mode) => plant.push(mode) }] } });
  const t = shoot(v(0, 10, 0), taxi.pos);
  assert.equal(t.target?.kind, 'vehicle');
  hitTarget(t.hit, 'stun', v()); assert.equal(hails.length, 0, 'the ray does not hail a cab');
  hitTarget(t.hit, 'dart', v()); assert.equal(hails.length, 1);
  taxi.mode = 'driven'; assert.notEqual(shoot(v(0, 10, 0), taxi.pos).target?.kind, 'vehicle');
  hitTarget(shoot(v(0, 2, 0), v(20, 2, -20)).hit, 'dart', v());
  assert.deepEqual(plant, ['dart']);
  b.dispose();
  assert.equal(shoot(v(0, 2, 0), v(20, 2, -20)).kind, 'none');
});
