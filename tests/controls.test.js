import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player, JUMP_OFF, FALL } from '../src/player.js';
import { Bird } from '../src/bird.js';
import { Hoverbike } from '../src/bike.js';
import { Taxi } from '../src/taxi.js';
import { Controller } from '../src/controller.js';

// The controls of 2026-10-05: the bottom button jumps off whatever you ride.

const DT = 1 / 60;
const flat = { heightAbove: (p) => p.y, groundAt: () => 0, rayDistance: () => Infinity, pushCapsule: () => false, groundNormal: () => new THREE.Vector3(0, 1, 0) };
const owning = (...ids) => { const s = new Set(ids); return { has: (id) => s.has(id) }; };
const horizontal = (v) => Math.hypot(v.x, v.z);
const run = (p, secs, input = {}, yaw = 0, also) => { for (let i = 0; i < secs * 60; i++) { also?.(); p.update(DT, input, yaw); } };

// (the jets: tests/jets.test.js, since they fly like a plane, v0.89)

/** A player riding `v` (made its mount if it is the bird), `h` m up, flying at `speed`. */
function riding(v, { items = owning('backpack'), mount = false } = {}) {
  const p = new Player(flat, { items, mount: mount ? () => v : undefined });
  if (!mount) p.vehicles.push(v);
  p.mount_(v);
  return p;
}
const flyBird = (b, y, speed = 24) => { b.mode = 'ridden'; b.landed = false; b.speed = speed; b.pos.set(0, y, 0); b.heading = 0; b.update(DT, { stick: { x: 0, y: 0 } }); };

test('B (the bottom button) jumps off the bird in flight: a hop, her speed carried; she glides down', () => {
  const t = { pad: { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) } };
  const ctl = new Controller({ pads: () => [t.pad], context: () => 'ride', action() {}, look() {}, navigate() {}, scroll() {} });
  t.pad.buttons[0] = { pressed: true, value: 1 };
  const held = ctl.update(DT);
  assert.ok(held.JumpOff && !held.Space, 'riding, the bottom button is the jump off');
  const bird = new Bird(flat);
  const p = riding(bird, { mount: true });
  flyBird(bird, 18);
  const along = new THREE.Vector3(bird.vel.x, 0, bird.vel.z);
  p.update(DT, held, 0);
  assert.equal(p.ride, null, 'off');
  assert.equal(bird.mode, 'glide-down', 'she circles down');
  assert.ok(p.vel.y > JUMP_OFF.hop * 0.5, `a hop (${p.vel.y.toFixed(1)} m/s)`);
  assert.ok(new THREE.Vector3(p.vel.x, 0, p.vel.z).dot(along.normalize()) > 15, 'her speed carries you on');
  // held B does not also jump or boost on the way down; you fall and land (18 m: a tumble, no worse)
  for (let i = 0; i < 400 && !p.onGround && !p.down; i++) { bird.update(DT, null); p.update(DT, { JumpOff: true }, 0); }
  assert.ok(p.onGround || p.down, 'down on the ground');
  assert.ok(!p.dead && p.health > 0.5, 'not much hurt');
});

test('B off the bird far up, with nothing to break the fall: she swoops in and catches you', () => {
  const bird = new Bird(flat);
  const p = riding(bird, { mount: true });
  flyBird(bird, 120);
  assert.equal(p.jumpOff(), true, 'you may: she is yours');
  let caught = false;
  for (let i = 0; i < 60 * 8 && !caught && !p.down; i++) { bird.update(DT, p.ride === bird ? {} : null); p.update(DT, {}, 0); caught = p.ride === bird; }
  assert.ok(caught, `caught (mode ${bird.mode}, ${p.pos.y.toFixed(1)} m up)`);
  assert.ok(!p.down && p.health === 1);
});

test('B off the bird far up with the wings: they open by themselves and you glide down unhurt', () => {
  const bird = new Bird(flat);
  const p = riding(bird, { mount: true, items: owning('backpack', 'glider') });
  flyBird(bird, 80);
  assert.equal(p.jumpOff(), true);
  let glided = false;
  for (let i = 0; i < 60 * 60 && !p.onGround && !p.down; i++) { bird.update(DT, null); p.update(DT, {}, 0); glided ||= p.gliding; }
  assert.ok(glided, 'the wings opened');
  assert.ok(p.onGround && !p.down && p.health === 1, 'landed on your feet');
  assert.ok(p.ride !== bird, 'she did not need to catch you');
});

test('off a cab on its way, far up, without wings or jets: not allowed (a notice); with the jets, off you go', () => {
  const taxi = new Taxi(flat, '#fff', 1, () => {});
  taxi.pos.set(0, 90, 0); taxi.object.updateMatrixWorld(true);
  const p = riding(taxi);
  assert.ok(taxi.goTo({ id: 'far', name: 'Far away', at: new THREE.Vector3(0, 90, 2000), heading: 0, step: new THREE.Vector3(0, 0, 2000) }), 'on its way');
  const notes = []; p.onNotice = (t) => notes.push(t);
  p.update(DT, { JumpOff: true }, 0);
  assert.equal(p.ride, taxi, 'still aboard');
  assert.deepEqual(notes, ['Too high to jump.']);
  // E, the right button, as well: up there it is a jump off, refused the same way
  p.update(DT, {}, 0); p.update(DT, { KeyE: true }, 0);
  assert.equal(p.ride, taxi);
  const q = riding(taxi, { items: owning('backpack', 'jetpack') });
  q.update(DT, { JumpOff: true }, 0);
  assert.equal(q.ride, null, 'the jets will hold you');
});

test('B off the hoverbike at speed: you fly on with some of its speed and land on your feet', () => {
  const bike = new Hoverbike(flat);
  bike.place(0, 0, 0, new THREE.Vector3());
  const p = riding(bike);
  for (let i = 0; i < 180; i++) p.update(DT, { KeyW: true }, 0);
  const speed = horizontal(bike.vel);
  assert.ok(speed > 20, `going (${speed.toFixed(1)} m/s)`);
  const at = p.pos.clone();
  p.update(DT, { JumpOff: true }, 0);
  assert.equal(p.ride, null);
  assert.ok(horizontal(p.vel) > speed * 0.7 && p.vel.y > 5, `carried on (${horizontal(p.vel).toFixed(1)} m/s) with a hop`);
  for (let i = 0; i < 300 && !(p.onGround && horizontal(p.vel) < 1); i++) p.update(DT, { JumpOff: true }, 0);
  assert.ok(!p.down && p.health === 1, 'on your feet');
  assert.ok(p.pos.distanceTo(at) > 8, `carried ${p.pos.distanceTo(at).toFixed(1)} m`);
  // standing still, E steps off beside it as before (no hop)
  const still = new Hoverbike(flat); still.place(0, 0, 0, new THREE.Vector3());
  const s = riding(still);
  s.update(DT, {}, 0); s.update(DT, { KeyE: true }, 0);
  assert.equal(s.ride, null);
  assert.ok(Math.abs(s.vel.y) < 0.5, 'a step off');
});

test('the ragdoll waits for a harder landing: ~16 m (it was ~10 m); a fatal fall is still ~36 m', () => {
  assert.equal(FALL.tumble, 32);
  assert.equal(FALL.lethal, 48);
  const drop = (h) => { const p = new Player(flat, {}); p.pos.set(0, h, 0); p.onGround = false; for (let i = 0; i < 400 && !p.onGround && !p.down; i++) p.update(DT, {}, 0); return p; };
  assert.ok(!drop(12).down, '12 m: you land it');
  assert.ok(!drop(15).down, '15 m too');
  assert.ok(drop(18).down, '18 m: over you go');
  assert.ok(drop(40).dead, '40 m: fatal');
});
