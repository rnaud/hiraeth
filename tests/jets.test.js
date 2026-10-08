import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player, CameraRig, JET, jetNose, jetSteer, jetSpeed, jetStep, jetDroop, jetPose, jetCameraPitch, OPEN_PITCH, PITCH_SETTLE } from '../src/player.js';
import { triggers, Controller } from '../src/controller.js';

// The jets fly like a plane (v0.89; docs/systems/movement-and-camera.md): RT / R2 the throttle,
// the left stick the nose (forward dives, back climbs, left / right bank and turn), a glide once
// you let go, aiming holds you.

const DT = 1 / 60;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const U = V(0, 1, 0);
const flat = { heightAbove: (p) => p.y, groundAt: () => 0, rayDistance: () => Infinity, pushCapsule: () => false, groundNormal: () => V(0, 1, 0) };
const owning = (...ids) => { const s = new Set(ids); return { has: (id) => s.has(id) }; };
const horizontal = (v) => Math.hypot(v.x, v.z);
const jetter = ({ at = 0, items = ['backpack', 'jetpack'], physics = flat } = {}) => {
  const p = new Player(physics, { items: owning(...items), health: false });
  p.pos.set(0, at, 0); p.onGround = at === 0;
  return p;
};
/** Fly `p` for `secs` with `input` (the gauge kept full unless `fuel`), recording where it was. */
const fly = (p, secs, input = {}, { fuel = true, track } = {}) => {
  for (let i = 0; i < Math.round(secs / DT); i++) { if (fuel) p.fuel = 1; p.update(DT, input, 0); track?.push(p.pos.clone()); }
  return p;
};

// ---------------------------------------------------------------- the pure flight model

test('jetNose: the heading tipped by the pitch', () => {
  const fwd = V(0, 0, -1);
  assert.ok(jetNose(fwd, U, 0).distanceTo(fwd) < 1e-9, 'level');
  assert.ok(jetNose(fwd, U, Math.PI / 2).distanceTo(U) < 1e-9, 'straight up');
  const d = jetNose(fwd, U, -Math.PI / 4);
  assert.ok(Math.abs(d.length() - 1) < 1e-9 && d.y < -0.7 && d.z < -0.7, 'half way down');
});

test('jetSteer: forward tips the nose down, back pulls it up (invert swaps), the bank turns you', () => {
  const J = { pitch: 0, bank: 0 };
  for (let i = 0; i < 30; i++) jetSteer(J, 1, 0, DT);
  assert.ok(Math.abs(J.pitch + JET.pitchRate * 0.5) < 1e-6, `forward: nose down (${J.pitch.toFixed(2)})`);
  for (let i = 0; i < 60; i++) jetSteer(J, -1, 0, DT);
  assert.ok(J.pitch > 0.8, `back: nose up (${J.pitch.toFixed(2)})`);
  for (let i = 0; i < 300; i++) jetSteer(J, -1, 0, DT);
  assert.equal(J.pitch, JET.maxPitch, 'never over the top');
  const I = { pitch: 0, bank: 0 };
  jetSteer(I, 1, 0, 0.5, true);
  assert.ok(I.pitch > 0, 'inverted: forward climbs');
  // right banks right and turns right (the heading falls); the bank eases in, and back out
  const B = { pitch: 0, bank: 0 };
  let turned = 0;
  const first = -jetSteer(B, 0, 1, DT);
  for (let i = 0; i < 60; i++) turned += -jetSteer(B, 0, 1, DT);
  assert.ok(first < JET.turnRate * DT * 0.2, 'the bank eases in, so does the turn');
  assert.ok(B.bank > JET.bank * 0.95, `banked right (${B.bank.toFixed(2)})`);
  assert.ok(turned > JET.turnRate * 0.8 && turned < JET.turnRate, `turned right ${turned.toFixed(2)} rad in a second`);
  for (let i = 0; i < 60; i++) jetSteer(B, 0, 0, DT);
  assert.ok(Math.abs(B.bank) < 0.01, 'rolls level again');
  const L = { pitch: 0, bank: 0 };
  let left = 0;
  for (let i = 0; i < 60; i++) left += jetSteer(L, 0, -1, DT);
  assert.ok(L.bank < 0 && left > 0, 'left banks and turns left');
});

test('jetSpeed: the throttle\'s travel, boosted, faster nose down', () => {
  assert.equal(jetSpeed(0), 0);
  assert.equal(jetSpeed(1), JET.speed);
  assert.ok(Math.abs(jetSpeed(0.5) - JET.speed / 2) < 1e-9, 'analog');
  assert.ok(Math.abs(jetSpeed(1, 0, true) - JET.speed * JET.boost) < 1e-9, 'L3 / Shift');
  assert.ok(Math.abs(jetSpeed(1, -1) - JET.speed * (1 + JET.dive)) < 1e-9, 'straight down');
  assert.equal(jetSpeed(1, 1), JET.speed, 'no extra climbing');
});

test('jetStep: thrust builds speed along the nose with momentum; a slip turns into the nose\'s way; unpowered it glides', () => {
  const nose = V(0, 0, -1), vel = V();
  jetStep(vel, nose, U, 1, 0.1);
  assert.ok(vel.length() > 1 && vel.length() < JET.speed * 0.5, `eases in (${vel.length().toFixed(1)} m/s after 0.1 s)`);
  for (let i = 0; i < 300; i++) jetStep(vel, nose, U, 1, DT);
  assert.ok(Math.abs(vel.z + JET.speed) < 0.1 && Math.abs(vel.y) < 1e-6, 'full throttle: JET.speed along the nose, held up');
  // turn the nose 90°: the speed swings round into it (a plane's grip), it is not lost
  const side = V(-1, 0, 0);
  for (let i = 0; i < 30; i++) jetStep(vel, side, U, 1, DT);
  assert.ok(vel.length() > JET.speed * 0.6, `the speed carried through the turn (${vel.length().toFixed(1)})`);
  assert.ok(vel.x < -10 && Math.abs(vel.z) < 6, 'heading the new way');
  // half throttle: half the speed
  for (let i = 0; i < 300; i++) jetStep(vel, side, U, 0.5, DT);
  assert.ok(Math.abs(vel.length() - JET.speed / 2) < 0.2);
  // unpowered, level and fast: a gentle sink, not a fall
  const g = V(0, 0, -20);
  for (let i = 0; i < 60; i++) jetStep(g, nose, U, 0, DT);
  assert.ok(g.y < 0 && g.y > -4, `a glide's sink (${g.y.toFixed(2)} m/s after 1 s; a fall would be -32)`);
  assert.ok(-g.z > 14 && -g.z < 20, `slowing a little (${(-g.z).toFixed(1)} m/s)`);
  // a long glide nose down settles at a speed (the drag grows with it), it does not run away
  const settle = V(0, 0, -20), slope = jetNose(V(0, 0, -1), U, -0.33);
  for (let i = 0; i < 1200; i++) jetStep(settle, slope, U, 0, DT);
  assert.ok(settle.length() > 18 && settle.length() < 32, `settled at ${settle.length().toFixed(1)} m/s`);
  // unpowered nose up: gravity takes the speed away; nose down: it gives it
  const up = V(0, 15, 0), down = V(0, -15, 0);
  for (let i = 0; i < 30; i++) { jetStep(up, U, U, 0, DT); jetStep(down, V(0, -1, 0), U, 0, DT); }
  assert.ok(up.y < 2, `a climb runs out (${up.y.toFixed(1)})`);
  assert.ok(down.y < -24, `a dive gains (${down.y.toFixed(1)})`);
});

test('jetDroop: unpowered the nose follows the fall, slowly while fast, quickly in a stall', () => {
  const slow = jetDroop(0, V(0, -6, -6), U, 0.5, 8), fast = jetDroop(0, V(0, -20, -20), U, 0.5, 28);
  assert.ok(slow < -0.2, `slow: it drops (${slow.toFixed(2)})`);
  assert.ok(fast < 0 && fast > slow, `fast: it holds better (${fast.toFixed(2)})`);
  const stall = jetDroop(0, V(0, -6, -6), U, 0.5, 1);
  assert.ok(stall < slow, `a stall: it falls fastest (${stall.toFixed(2)})`);
  assert.ok(jetDroop(Math.PI / 2, V(), U, 0.5) < Math.PI / 2 - 1, 'hanging still nose up: it tips over');
});

test('jetPose and the camera: upright slow or nose up, flat out level, head first diving; the camera tips with the nose', () => {
  assert.ok(jetPose(0, 0).lean < 0.2, 'hovering: upright');
  assert.ok(jetPose(JET.speed, JET.takeoff).lean < 0.2, 'climbing straight up: upright, like a rocket');
  assert.ok(Math.abs(jetPose(JET.speed, 0).lean - Math.PI / 2) < 0.05, 'level: flat out');
  assert.ok(jetPose(JET.speed, -1.2).lean > 2.5, 'diving: head first');
  assert.ok(jetPose(JET.speed, 0).reach > 0.95 && jetPose(1, 0).reach < 0.1);
  assert.ok(jetCameraPitch(JET.takeoff) < 0, 'nose up: the camera looks up');
  assert.ok(Math.abs(jetCameraPitch(0) - (OPEN_PITCH + 0.12)) < 1e-9, 'level: a little down, as on foot');
  assert.ok(jetCameraPitch(-1.2) > 0.6, 'diving: it looks down the dive');
});

test('triggers: RT\'s travel is the jets\' throttle (analog); the mouse button is the blade, not the jets; aiming takes it', () => {
  assert.equal(triggers({ PadThrust: 0.4, PadFire: false }).thrust, 0.4);
  assert.equal(triggers({ PadFire: true }).thrust, 1, 'a pad without the analog value');
  assert.equal(triggers({ MouseLeft: true }).thrust, 0, 'a left click swings the blade (SPACE held in the air is the keyboard\'s thrust)');
  assert.equal(triggers({ PadThrust: 1, PadFire: true, PadAim: true }).thrust, 0, 'LT held: RT shoots');
  // the controller reports the analog travel, and a held RT from a menu stays blocked
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  const pad = { connected: true, mapping: 'standard', index: 0, buttons, axes: [0, 0, 0, 0] };
  let ctx = 'game';
  const c = new Controller({ pads: () => [pad], context: () => ctx, action() {}, look() {}, navigate() {}, scroll() {} });
  buttons[7] = { pressed: false, value: 0.3 };
  const h = c.update(DT);
  assert.ok(h.PadThrust > 0.2 && h.PadThrust < 0.35 && !h.PadFire, `a light squeeze (${h.PadThrust.toFixed(2)})`);
  buttons[7] = { pressed: true, value: 1 };
  assert.equal(c.update(DT).PadThrust, 1);
  ctx = 'menu'; c.update(DT); ctx = 'game';
  assert.equal(c.update(DT).PadThrust, 0, 'held through a menu: nothing until let go');
});

// ---------------------------------------------------------------- the traveller on the jets

test('RT from the ground: off at once and high fast, straight up', () => {
  const p = jetter();
  fly(p, 0.2);
  assert.ok(p.onGround);
  const track = [];
  fly(p, 3, { PadThrust: 1 }, { track });
  assert.ok(p.jetFlight && p.thrusting && !p.onGround, 'flying');
  assert.ok(track[Math.round(1 / DT) - 1].y > 8, `${track[59].y.toFixed(1)} m up after 1 s`);
  assert.ok(p.pos.y > 45, `${p.pos.y.toFixed(1)} m up after 3 s`);
  assert.ok(horizontal(p.pos) < 6, `straight up (${horizontal(p.pos).toFixed(1)} m across)`);
  assert.ok(p.char.body.rotation.x < 0.3, 'standing in the climb, like a rocket');
  // a light squeeze climbs slowly
  const q = jetter(); fly(q, 0.2); fly(q, 3, { PadThrust: 0.2 });
  assert.ok(q.pos.y > 3 && q.pos.y < p.pos.y / 3, `a light squeeze: ${q.pos.y.toFixed(1)} m`);
  // not the mouse's left button (it swings the blade); aiming on the ground, RT shoots and you stay put
  const m = jetter(); fly(m, 0.2); fly(m, 1, { MouseLeft: true });
  assert.ok(m.onGround && !m.jetFlight, 'the mouse: no jets');
  const a = jetter(); fly(a, 0.2); fly(a, 1, { PadThrust: 1, PadFire: true, PadAim: true });
  assert.ok(a.onGround && !a.jetFlight, 'aiming: no jets');
  // nor without the item, nor without the backpack
  for (const items of [['backpack'], ['jetpack']]) { const n = jetter({ items }); fly(n, 0.2); fly(n, 1, { PadThrust: 1 }); assert.ok(n.onGround && !n.thrusting, items.join()); }
});

test('the stick flies the nose: level out, turn left and right, dive, pull up, climb: every way', () => {
  const p = jetter(); fly(p, 0.2);
  fly(p, 1.5, { PadThrust: 1 });
  const start = p.pos.clone();
  // forward tips the nose over into level flight, which then goes the way the traveller faced
  fly(p, 0.85, { PadThrust: 1, stick: { x: 0, y: 1 } });
  assert.ok(Math.abs(p.jetFlight.pitch) < 0.15, `level (${p.jetFlight.pitch.toFixed(2)})`);
  fly(p, 1.5, { PadThrust: 1 });
  const fwd = V(p.vel.x, 0, p.vel.z).normalize();
  assert.ok(horizontal(p.vel) > JET.speed * 0.85 && Math.abs(p.vel.y) < 3, `cruising (${horizontal(p.vel).toFixed(1)} across, ${p.vel.y.toFixed(1)} up)`);
  assert.ok(p.char.body.rotation.x > 1.3, `flat out (${p.char.body.rotation.x.toFixed(2)})`);
  assert.ok(Math.abs(Math.sin(p.heading - Math.atan2(p.vel.x, p.vel.z))) < 0.1, 'facing where it flies');
  // right: banks right and comes round to the right
  const h0 = p.heading;
  fly(p, 0.8, { PadThrust: 1, stick: { x: 1, y: 0 } });
  const right = V(p.vel.x, 0, p.vel.z).normalize();
  assert.ok(p.heading < h0 - 1, `turned right (${(h0 - p.heading).toFixed(2)} rad)`);
  assert.ok(fwd.clone().cross(right).y < -0.5, 'to the right of where it went');
  const rollRight = p.char.body.rotation.y;
  // left: the other way
  fly(p, 1.6, { PadThrust: 1, stick: { x: -1, y: 0 } });
  const left = V(p.vel.x, 0, p.vel.z).normalize();
  assert.ok(right.clone().cross(left).y > 0.5, 'and round to the left');
  assert.ok(rollRight > 0.4 && p.char.body.rotation.y < -0.4, `banked into each turn (${rollRight.toFixed(2)}, ${p.char.body.rotation.y.toFixed(2)})`);
  // dive: forward again, down it goes, head first and faster
  fly(p, 1, { PadThrust: 1 });
  const y0 = p.pos.y;
  fly(p, 1.2, { PadThrust: 1, stick: { x: 0, y: 1 } });
  fly(p, 0.6, { PadThrust: 1 });
  assert.ok(p.vel.y < -JET.speed * 0.9 && p.pos.y < y0 - 10, `diving (${p.vel.y.toFixed(1)} m/s, ${(y0 - p.pos.y).toFixed(1)} m down)`);
  assert.ok(p.vel.length() > JET.speed * 1.1, `faster down (${p.vel.length().toFixed(1)} m/s)`);
  assert.ok(p.char.body.rotation.x > 2.2, `head first (${p.char.body.rotation.x.toFixed(2)})`);
  // pull up: back on the stick, up again
  fly(p, 1.4, { PadThrust: 1, stick: { x: 0, y: -1 } });
  fly(p, 0.6, { PadThrust: 1 });
  assert.ok(p.vel.y > 10, `climbing again (${p.vel.y.toFixed(1)} m/s)`);
  assert.ok(p.pos.distanceTo(start) > 50, 'and it went a long way');
  // L3 / Shift: faster
  const b = jetter({ at: 80 }); fly(b, 0.1, { PadThrust: 1 }); fly(b, 0.85, { PadThrust: 1, stick: { x: 0, y: 1 } }); fly(b, 3, { PadThrust: 1, ShiftLeft: true });
  assert.ok(b.vel.length() > JET.speed * 1.25, `boosted (${b.vel.length().toFixed(1)} m/s)`);
});

test('the invert setting: forward climbs', () => {
  const p = jetter({ at: 50 }); p.invertFlight = true;
  fly(p, 0.1, { PadThrust: 1 });
  fly(p, 0.85, { PadThrust: 1, stick: { x: 0, y: -1 } });   // (back, inverted: nose down from straight up to level)
  assert.ok(Math.abs(p.jetFlight.pitch) < 0.15, `back tips it over (${p.jetFlight.pitch.toFixed(2)})`);
  fly(p, 0.5, { PadThrust: 1, stick: { x: 0, y: 1 } });
  assert.ok(p.jetFlight.pitch > 0.6, 'forward pulls up');
});

test('let go: a glide that carries on and sinks gently, even out of a stall; the wings take over if you have them', () => {
  const p = jetter({ at: 100 });
  fly(p, 0.1, { PadThrust: 1 });
  fly(p, 0.85, { PadThrust: 1, stick: { x: 0, y: 1 } });
  fly(p, 2, { PadThrust: 1 });
  const from = p.pos.clone();
  fly(p, 3);
  assert.ok(p.jetFlight && !p.thrusting, 'gliding on the jets');
  const went = horizontal(p.pos.clone().sub(from)), fell = from.y - p.pos.y;
  assert.ok(went > 35, `carried on ${went.toFixed(1)} m`);
  assert.ok(fell < went / 2.5 && fell < 15, `sinking gently (${fell.toFixed(1)} m down in 3 s; a fall would be 144)`);
  assert.ok(p.char.body.rotation.x > 1, 'still flying, flat out');
  // let go climbing straight up: it runs out of speed, stalls, the nose drops through into a dive and
  // the dive into a glide, down to a landing on your feet, well away
  const q = new Player(flat, { items: owning('backpack', 'jetpack') }); q.pos.set(0, 100, 0); q.onGround = false;
  fly(q, 1, { PadThrust: 1 });
  const top = q.pos.clone();
  fly(q, 1.2);
  assert.ok(q.jetFlight && q.jetFlight.pitch < 0, `stalled: the nose down (${q.jetFlight.pitch.toFixed(2)})`);
  for (let i = 0; i < 1800 && !q.onGround; i++) fly(q, DT);
  assert.ok(q.onGround && !q.down && q.health === 1, 'down safely');
  assert.ok(horizontal(q.pos.clone().sub(top)) > 60, `glided ${horizontal(q.pos.clone().sub(top)).toFixed(0)} m off`);
  // the wings: a pad's jump held, unpowered, opens them
  const w = jetter({ at: 100, items: ['backpack', 'jetpack', 'glider'] });
  fly(w, 0.1, { PadThrust: 1 }); fly(w, 0.85, { PadThrust: 1, stick: { x: 0, y: 1 } }); fly(w, 1, { PadThrust: 1 });
  fly(w, 0.1); fly(w, 1, { Space: true, PadJump: true });
  assert.ok(w.gliding && !w.jetFlight, 'the wings');
  // a pad's jump while the throttle is on does nothing (no boost, no charge)
  const j = jetter({ at: 100 }); let boosts = 0; j.onAirJump = () => { boosts++; return true; };
  fly(j, 0.5, { PadThrust: 1 }); fly(j, 0.5, { PadThrust: 1, Space: true, PadJump: true });
  assert.equal(boosts, 0);
  assert.ok(j.thrusting);
});

test('aim in flight (LT / L2): the jets hold you, sinking slowly; let go of it and you fly on', () => {
  const p = jetter({ at: 60 });
  fly(p, 0.1, { PadThrust: 1 }); fly(p, 0.85, { PadThrust: 1, stick: { x: 0, y: 1 } }); fly(p, 1, { PadThrust: 1 });
  fly(p, 2.5, { PadThrust: 1, PadFire: true, PadAim: true });
  assert.ok(p.jetHold && !p.thrusting && !p.onJets, 'holding');
  assert.ok(horizontal(p.vel) < 1 && p.vel.y < 0 && p.vel.y > -JET.hold.sink - 0.2, `nearly still (${horizontal(p.vel).toFixed(2)} across, ${p.vel.y.toFixed(2)} down)`);
  const y = p.pos.y; fly(p, 1, { PadAim: true });
  assert.ok(y - p.pos.y < 2, 'it holds without RT too');
  fly(p, 1.5, { PadThrust: 1 });
  assert.ok(p.thrusting && p.vel.length() > 10, 'flying on');
});

test('landing: nose down into the ground lands you softly; level under thrust skims; a held trigger lifts off again only on a fresh squeeze', () => {
  // a steep fast dive into the ground: down without a tumble (the jets brake it)
  const p = new Player(flat, { items: owning('backpack', 'jetpack') });
  p.pos.set(0, 60, 0); p.onGround = false;
  fly(p, 0.1, { PadThrust: 1 }); fly(p, 1.6, { PadThrust: 1, stick: { x: 0, y: 1 } });
  for (let i = 0; i < 400 && !p.onGround; i++) fly(p, DT, { PadThrust: 1 });
  assert.ok(p.onGround && !p.jetFlight && !p.down, `landed on his feet (${p.pos.y.toFixed(2)} m, down: ${!!p.down})`);
  fly(p, 1, { PadThrust: 1 });
  assert.ok(p.onGround, 'the trigger held through the landing: he stays down');
  fly(p, 0.1); fly(p, 0.5, { PadThrust: 1 });
  assert.ok(!p.onGround && p.jetFlight, 'a fresh squeeze: off again');
  // skimming low over rising ground at speed: up the slope, never into it, still flying
  const hill = (q) => 0.2 * Math.abs(q.z);
  const rise = { ...flat, heightAbove: (q) => q.y - hill(q), groundAt: (x, y, z) => hill({ x, z }) };
  const s = jetter({ physics: rise }); s.heading = Math.PI;
  fly(s, 0.2); fly(s, 0.15, { PadThrust: 1 }); fly(s, 0.9, { PadThrust: 1, stick: { x: 0, y: 1 } });
  fly(s, 3, { PadThrust: 1 });
  assert.ok(s.jetFlight && s.pos.y >= hill(s.pos) - 0.05 && Math.abs(s.pos.z) > 30, `over the slope (${s.pos.z.toFixed(1)} along, ${(s.pos.y - hill(s.pos)).toFixed(2)} m over it)`);
});

test('a low ceiling and the walls: pressed along them, never through, and no grabbing a wall to climb in flight', () => {
  const lid = { ...flat, pushCapsule: (pos, r, bottom, top, out) => { const over = pos.y + top - 6; if (over <= 0) return null; pos.y -= over; return out.set(0, -over, 0); } };
  const c = jetter({ physics: lid });
  fly(c, 0.2); fly(c, 0.5, { PadThrust: 1 }); fly(c, 0.6, { PadThrust: 1, stick: { x: 0, y: 1 } }); fly(c, 1.5, { PadThrust: 1 });
  assert.ok(c.pos.y + 2.2 <= 6.01 && horizontal(c.vel) > 8 && c.jetFlight, `along the ceiling (${c.pos.y.toFixed(2)} m, ${horizontal(c.vel).toFixed(1)} m/s)`);
  const wall = { ...flat, pushCapsule: (pos, r, bottom, top, out) => { const over = -pos.z - 10 + r; if (over <= 0) return null; pos.z += over; return out.set(0, 0, over); } };
  const w = jetter({ physics: wall, at: 20 }); w.heading = Math.PI;
  fly(w, 0.1, { PadThrust: 1 }); fly(w, 0.85, { PadThrust: 1, stick: { x: 0, y: 1 } }); fly(w, 1.5, { PadThrust: 1, stick: { x: 0.3, y: 0 } });
  assert.ok(-w.pos.z <= 10 && !w.climbing && w.jetFlight, `at the wall, still flying (${w.pos.z.toFixed(2)})`);
});

test('the burn: full throttle drains the gauge, a light squeeze less; dry, you glide on, or the wings open', () => {
  const p = jetter({ at: 200 }), q = jetter({ at: 200 });
  fly(p, 3, { PadThrust: 1 }, { fuel: false }); fly(q, 3, { PadThrust: 0.2 }, { fuel: false });
  assert.ok(p.fuel < 0.75 && p.fuel > 0.65, `full (${p.fuel.toFixed(2)})`);
  assert.ok(q.fuel > p.fuel + 0.1, `light (${q.fuel.toFixed(2)})`);
  p.fuel = 0.01; fly(p, 0.5, { PadThrust: 1 }, { fuel: false });
  assert.ok(!p.thrusting, 'dry');
  // dry with the wings: jump held (SPACE on a keyboard) or the trigger opens them, as off the jets
  for (const input of [{ Space: true }, { PadThrust: 1 }]) {
    const w = jetter({ at: 200, items: ['backpack', 'jetpack', 'glider'] });
    fly(w, 2, { PadThrust: 1 });
    w.fuel = 0.001; fly(w, 1.5, input, { fuel: false });
    assert.ok(w.gliding && !w.jetFlight, `dry, ${Object.keys(input)[0]}: the wings`);
  }
});

test('the keyboard and touch: SPACE held in the air is full throttle, WASD fly the nose', () => {
  const p = jetter(); fly(p, 0.2);
  fly(p, 0.1, { Space: true });
  fly(p, 1.5, { Space: true });
  assert.ok(p.thrusting && p.pos.y > 15, `up (${p.pos.y.toFixed(1)} m)`);
  fly(p, 0.85, { Space: true, KeyW: true });
  assert.ok(Math.abs(p.jetFlight.pitch) < 0.2, 'W tips the nose down');
  const h = p.heading; fly(p, 0.5, { Space: true, KeyD: true });
  assert.ok(p.heading < h - 0.4, 'D turns right');
  // touch: the stick's drag
  fly(p, 0.5, { Space: true, stick: { x: 0, y: -0.6 } });
  assert.ok(p.jetFlight.pitch > 0.3, 'dragged down: nose up');
  // a pad's jump alone never fires them
  const q = jetter({ at: 30 }); fly(q, 1, { Space: true, PadJump: true });
  assert.equal(q.thrusting, false);
});

// after a dive the view comes level again on foot (it stayed tipped looking down at the ground)
test('leaving the jets: the camera eases back to the on-foot pitch, unless you turn it', () => {
  globalThis.window ??= { addEventListener() {} };
  const dom = { addEventListener() {} };
  const rig = new CameraRig(new THREE.PerspectiveCamera(), dom, null);
  const tick = (shot, secs, riding = !!shot) => { for (let t = 0; t < secs; t += DT) { rig.follow(0, DT, riding, shot); rig._now += DT; } };
  const dive = { pitch: jetCameraPitch(-1.2) };
  tick(dive, 4);
  assert.ok(rig.pitch > 0.6, 'diving: looking down the dive');
  tick(null, 0.25);
  assert.ok(rig.pitch < 0.6 && rig.pitch > OPEN_PITCH + 0.05, 'landed: easing back, not snapping');
  tick(null, PITCH_SETTLE.time);
  assert.ok(Math.abs(rig.pitch - OPEN_PITCH) < 1e-6, 'within a second: the on-foot framing');
  // the same out of the jets into the wings' glide (riding, no pitch of its own)
  tick(dive, 4); tick(null, 1, true);
  assert.ok(Math.abs(rig.pitch - OPEN_PITCH) < 1e-6, 'gliding: levelled too');
  // turning the camera yourself as you land: it stays where you put it
  tick(dive, 4); tick(null, 0.1);
  rig.look(0, 40); const mine = rig.pitch;
  tick(null, 1.5);
  assert.equal(rig.pitch, mine, 'your own pitch is kept');
});
