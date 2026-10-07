import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player, JET, JUMP_OFF, FALL } from '../src/player.js';
import { Bird } from '../src/bird.js';
import { Hoverbike } from '../src/bike.js';
import { Taxi } from '../src/taxi.js';
import { Controller } from '../src/controller.js';

// The controls of 2026-10-05: the jets on RT (flown like Superman where the camera looks, the
// stick neutral hovers, the jump held climbs), the bottom button jumps off whatever you ride.

const DT = 1 / 60;
const flat = { heightAbove: (p) => p.y, groundAt: () => 0, rayDistance: () => Infinity, pushCapsule: () => false, groundNormal: () => new THREE.Vector3(0, 1, 0) };
const owning = (...ids) => { const s = new Set(ids); return { has: (id) => s.has(id) }; };
const horizontal = (v) => Math.hypot(v.x, v.z);
const run = (p, secs, input = {}, yaw = 0, also) => { for (let i = 0; i < secs * 60; i++) { also?.(); p.update(DT, input, yaw); } };

test('the jets fly like Superman: RT goes where the camera looks (up, level or down), neutral hovers, jump held climbs', () => {
  const jetter = () => { const p = new Player(flat, { items: owning('backpack', 'jetpack'), health: false }); p.pos.set(0, 30, 0); p.onGround = false; return p; };
  const fly = (p, secs, input, pitch = JET.level, yaw = 0) => { for (let i = 0; i < secs * 60; i++) p.update(DT, input, yaw, pitch); };
  // neutral: a hover, even out of a fall, holding its height and its place
  const u = jetter(); u.vel.set(0, -12, 0);
  fly(u, 1.5, { PadFire: true });
  assert.ok(u.thrusting, 'thrusting');
  assert.ok(Math.abs(u.vel.y) < 1, `hovering (${u.vel.y.toFixed(2)} m/s)`);
  const y0 = u.pos.y; fly(u, 1, { PadFire: true });
  assert.ok(Math.abs(u.pos.y - y0) < 1, `holding its height (${(u.pos.y - y0).toFixed(2)} m)`);
  assert.ok(horizontal(u.vel) < 0.5, 'and its place');
  assert.ok(u.char.body.rotation.x < 0.4, `upright while hovering (${u.char.body.rotation.x.toFixed(2)})`);
  // the stick at the follow camera's usual tilt: level flight that way, relative to the camera
  const dirs = {};
  for (const [name, stick] of Object.entries({ fwd: { x: 0, y: 1 }, back: { x: 0, y: -1 }, right: { x: 1, y: 0 }, left: { x: -1, y: 0 } })) {
    const p = jetter(); fly(p, 2, { PadFire: true, stick });
    assert.ok(Math.abs(horizontal(p.vel) - JET.speed) < 1, `${name}: ${horizontal(p.vel).toFixed(1)} m/s`);
    assert.ok(Math.abs(p.vel.y) < 1 && Math.abs(p.pos.y - 30) < 2.5, `${name}: level (${p.vel.y.toFixed(2)} m/s, ${p.pos.y.toFixed(1)} m)`);
    dirs[name] = new THREE.Vector3(p.vel.x, 0, p.vel.z).normalize();
    if (name === 'fwd') {
      assert.ok(p.char.body.rotation.x > 1.2, `flat out along the flight (${p.char.body.rotation.x.toFixed(2)})`);
      assert.ok(Math.abs(Math.sin(p.heading - Math.atan2(p.vel.x, p.vel.z))) < 0.1, 'facing where it flies');
    }
  }
  assert.ok(dirs.fwd.dot(dirs.back) < -0.99 && dirs.left.dot(dirs.right) < -0.99 && Math.abs(dirs.fwd.dot(dirs.right)) < 0.05, 'forward / back / left / right');
  const turned = jetter(); fly(turned, 2, { PadFire: true, stick: { x: 0, y: 1 } }, JET.level, Math.PI / 2);
  assert.ok(Math.abs(new THREE.Vector3(turned.vel.x, 0, turned.vel.z).normalize().dot(dirs.fwd)) < 0.05, 'relative to the camera');
  // look up and push forward: a climb that way; look down: a dive; all the way down: straight down, head first
  const climb = jetter(); fly(climb, 2, { PadFire: true, stick: { x: 0, y: 1 } }, -0.6);
  assert.ok(climb.vel.y > 5 && horizontal(climb.vel) > 2 && climb.pos.y > 40, `climbing that way (${climb.vel.y.toFixed(1)} up, ${horizontal(climb.vel).toFixed(1)} across)`);
  const dive = jetter(); dive.pos.y = 200; fly(dive, 2, { PadFire: true, stick: { x: 0, y: 1 } }, 0.9);
  assert.ok(dive.thrusting && dive.vel.y < -6 && horizontal(dive.vel) > 2, `diving that way (${dive.vel.y.toFixed(1)} up, ${horizontal(dive.vel).toFixed(1)} across)`);
  assert.ok(dive.char.body.rotation.x > Math.PI / 2, `head first (${dive.char.body.rotation.x.toFixed(2)})`);
  const down = jetter(); down.pos.y = 200; fly(down, 2, { PadFire: true, stick: { x: 0, y: 1 } }, 1.3);
  assert.ok(down.vel.y < -JET.speed && horizontal(down.vel) < 2, `straight down (${down.vel.y.toFixed(1)} m/s, ${horizontal(down.vel).toFixed(1)} across)`);
  assert.ok(down.vel.y > -JET.speed * (1 + JET.dive) - 1, 'braked at the dive\'s speed, not falling free');
  // jump held as well: straight up at JET.rise, and no boost
  const h = jetter(); let boosts = 0; h.onAirJump = () => { boosts++; return true; }; h.vel.set(0, -12, 0);
  fly(h, 0.1, { PadFire: true });
  fly(h, 1.5, { PadFire: true, Space: true, PadJump: true });
  assert.equal(boosts, 0, 'pressing jump while the jets fire climbs, it does not boost (nor spend a charge)');
  assert.ok(h.thrusting && Math.abs(h.vel.y - JET.rise) < 1, `climbing (${h.vel.y.toFixed(2)} m/s)`);
  assert.ok(horizontal(h.vel) < 0.5, 'straight up');
  // let go: the jets stop, you fall
  fly(h, 0.5, {});
  assert.ok(!h.thrusting && h.vel.y < 0, 'falling once let go');
  // aiming: RT shoots, the jets stay off; nor without the item
  const a = jetter(); run(a, 0.3, { PadFire: true, PadAim: true });
  assert.equal(a.thrusting, false, 'LT held: no jets');
  const none = new Player(flat, { items: owning('backpack'), health: false }); none.pos.set(0, 30, 0); none.onGround = false;
  run(none, 0.3, { PadFire: true });
  assert.equal(none.thrusting, false);
  // from the ground RT lifts you off (and flies off level); the mouse's left button too, when not aiming
  for (const input of [{ PadFire: true }, { MouseLeft: true }, { PadFire: true, stick: { x: 0, y: 1 } }]) {
    const g = new Player(flat, { items: owning('backpack', 'jetpack'), health: false });
    run(g, 0.2); assert.ok(g.onGround);
    fly(g, 1, input);
    assert.ok(!g.onGround && g.thrusting && g.pos.y > 0.3, `${JSON.stringify(input)}: off the ground (${g.pos.y.toFixed(2)} m)`);
  }
  // a dive into the ground lands you (and you stay down, walking, while you keep diving)
  const l = jetter(); l.pos.y = 6;
  fly(l, 1.5, { PadFire: true, stick: { x: 0, y: 1 } }, 1.0);
  assert.ok(l.onGround && !l.thrusting, `landed (${l.pos.y.toFixed(2)} m)`);
  // flying level low over rising ground: it skims up the slope at the jets' speed (it used to drop to a walk at every touch)
  const hill = (q) => 0.2 * (Math.abs(q.x) + Math.abs(q.z));
  const rise = { ...flat, heightAbove: (q) => q.y - hill(q), groundAt: (x, y, z) => hill({ x, z }) };
  const sk = new Player(rise, { items: owning('backpack', 'jetpack'), health: false }); sk.pos.set(0, 0.5, 0); sk.onGround = false;
  fly(sk, 0.5, { PadFire: true });
  const from = sk.pos.clone();
  fly(sk, 3, { PadFire: true, stick: { x: 0, y: 1 } });
  const went = Math.hypot(sk.pos.x - from.x, sk.pos.z - from.z);
  assert.ok(went > JET.speed * 3 * 0.75, `skimming up the slope (${went.toFixed(1)} m in 3 s)`);
  assert.ok(sk.pos.y >= hill(sk.pos) - 0.05, 'over it, not in it');
  // under a low ceiling (a tube, a temple): looking up and flying presses along it, never through
  const lid = { ...flat, pushCapsule: (pos, r, bottom, top, out) => { const over = pos.y + top - 6; if (over <= 0) return null; pos.y -= over; return out.set(0, -over, 0); } };
  const c = new Player(lid, { items: owning('backpack', 'jetpack'), health: false }); c.pos.set(0, 1, 0); c.onGround = false;
  fly(c, 2, { PadFire: true, stick: { x: 0, y: 1 } }, -0.3);
  assert.ok(c.pos.y + 2.2 <= 6.01 && horizontal(c.vel) > 4, `along the ceiling (${c.pos.y.toFixed(2)} m, ${horizontal(c.vel).toFixed(1)} m/s)`);
  // the gauge burns as before, and runs dry
  const f = jetter(); run(f, 3, { PadFire: true });
  assert.ok(f.fuel < 0.75 && f.fuel > 0.6, `the gauge (${f.fuel.toFixed(2)})`);
});

test('the jets on the keyboard: Space held in the air climbs as before; the pad\'s jump alone never fires them', () => {
  const p = new Player(flat, { items: owning('backpack', 'jetpack'), health: false }); p.pos.set(0, 30, 0); p.onGround = false;
  run(p, 1.5, { Space: true });
  assert.ok(p.thrusting && p.pos.y > 38, `Space: up (${p.pos.y.toFixed(1)} m)`);
  const q = new Player(flat, { items: owning('backpack', 'jetpack'), health: false }); q.pos.set(0, 30, 0); q.onGround = false;
  run(q, 1, { Space: true, PadJump: true });
  assert.equal(q.thrusting, false, 'the pad\'s jump: no jets');
  // with the wings, the pad's jump held in the air opens them, fluid or not
  const w = new Player(flat, { items: owning('backpack', 'jetpack', 'glider'), health: false }); w.pos.set(0, 60, 0); w.onGround = false;
  run(w, 1, { Space: true, PadJump: true });
  assert.ok(w.gliding && !w.thrusting, 'the wings');
});

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
