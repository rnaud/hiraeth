import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GADGETS, registerGadget } from '../src/gadgets/registry.js';
import hook from '../src/gadgets/hook.js';
import bomb from '../src/gadgets/bomb.js';
import bubble, { BUBBLE, heavyWords, riseSpeed, bubbleRadius, wantsSelf, selfPhase, selfLift } from '../src/gadgets/bubble.js';
import fan, { FAN, gustStrength, gustDirection, hoverLift, sailPush, pinwheelCatch } from '../src/gadgets/fan.js';
import { GadgetWorld } from '../src/gadgets/world.js';
import { ITEMS } from '../src/items.js';
import { buildItemModel } from '../src/boxes/model.js';
import { Physics } from '../src/physics.js';
import { clearTargets, registerTarget, raycastTargets } from '../src/targets.js';
import { registerHazard, cylinderHazard, clearHazards, hazardAt } from '../src/hazards.js';
import { Foe } from '../src/foes.js';
import { Flammables } from '../src/flammable.js';

registerGadget(hook); registerGadget(bomb); registerGadget(bubble); registerGadget(fan);
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = v(0, 1, 0);
const DT = 1 / 60;

function physicsOf(...meshes) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial()));
  for (const m of meshes) scene.add(m);
  return new Physics(scene);
}
function player(at = v()) {
  const frame = { up: v(0, 1, 0), dir: (h, out = v()) => out.set(Math.sin(h), 0, Math.cos(h)), headingOf: (d) => Math.atan2(d.x, d.z) };
  return { pos: at, vel: v(), heading: 0, frame, object: { visible: true }, ride: null, onGround: true, climbing: false, hurtAt: 0, endJets() {} };
}
function ctxOf(P, physics, extra = {}) {
  const notes = [];
  const ctx = { player: P, physics, camera: null, tool: null, sound: null, world: null, hud: { reticle() {} }, sfx: { equip() {} }, fx: new THREE.Group(), aimAt() {}, notice: (t) => notes.push(t), game: { emit() {} }, bursts: { add() {} }, ...extra };
  ctx.notes = notes;
  return ctx;
}
/** The traveller's own step, as the tests stand in for it: his velocity, gravity, the ground. */
function step(P, dt = DT) {
  P.pos.addScaledVector(P.vel, dt); P.vel.y -= 32 * dt;
  if (P.pos.y <= 0) { P.pos.y = 0; if (P.vel.y < 0) P.vel.y = 0; P.onGround = true; } else P.onGround = false;
}

// ------------------------------------------------------------------ both

test('the bubble wand and the gust fan are gadgets: items with models of their own, prompts in pad form, after the hook and the bombs', () => {
  assert.deepEqual(GADGETS.map((g) => g.id), ['hook', 'bomb', 'bubble', 'fan']);
  for (const id of ['bubble', 'fan']) {
    assert.equal(ITEMS[id].kind, 'gadget');
    assert.ok(ITEMS[id].use.includes('Y / △'));
    const m = buildItemModel(id), size = new THREE.Box3().setFromObject(m).getSize(v());
    assert.ok(m.children.length >= 3 && Math.max(size.x, size.y, size.z) < 0.6, `${id}: an item-sized model`);
  }
});

// ------------------------------------------------------------------ the bubble's maths

test('a bubble rises at its speed low down and hovers at its top; it wraps the traveller in the air or aimed at his feet', () => {
  assert.equal(riseSpeed(0), BUBBLE.rise);
  assert.equal(riseSpeed(BUBBLE.maxRise), 0);
  assert.ok(riseSpeed(BUBBLE.maxRise - 0.5) > 0 && riseSpeed(BUBBLE.maxRise - 0.5) < BUBBLE.rise, 'easing over the last metre and a half');
  assert.equal(riseSpeed(BUBBLE.maxRise + 2), 0, 'never pushed down');
  assert.ok(bubbleRadius('prop', 0.5) > 0.5 && bubbleRadius('self') > 1);
  assert.equal(wantsSelf(v(0, 0, -1), UP, false), false);
  assert.equal(wantsSelf(v(0, -0.9, -0.3).normalize(), UP, false), true, 'aimed at your feet');
  assert.equal(wantsSelf(v(0, 0, -1), UP, true), true, 'in the air');
  const S = BUBBLE.self;
  assert.equal(selfPhase(1), 'rise'); assert.equal(selfPhase(S.life + 1), 'sink'); assert.equal(selfPhase(S.life + S.sinkFor + 0.1), 'pop');
  assert.equal(selfLift(0, 'sink'), -S.sink, 'time up: down, gently');
});

// ------------------------------------------------------------------ the bubble's behaviour

test('a bubble blown at a crate catches it and floats it up; when it pops the crate falls back down', () => {
  clearTargets();
  const ph = physicsOf(), P = player(v(0, 0, 8));
  const world = new GadgetWorld({ physics: ph, player: P });
  const box = new THREE.Group(); box.position.set(0, 0.45, 0);
  const crate = world.addProp({ object: box, r: 0.55, h: 0.45 });
  const W = bubble.create(ctxOf(P, ph, { world }));
  W.ray.dir.set(0, 0, -1);
  W.blowAt({ point: crate.pos.clone(), target: { kind: 'prop', prop: crate, position: () => crate.pos }, ok: true });
  let t = 0;
  while (W.bubble?.kind === 'free' && t < 2) { W.update(DT); world.update(DT); t += DT; }
  assert.equal(W.bubble?.kind, 'prop', `caught in ${t.toFixed(2)} s`);
  assert.equal(crate.held, W);
  let top = 0;
  for (let i = 0; i < 60 * 5; i++) { W.update(DT); world.update(DT); top = Math.max(top, crate.pos.y); }
  assert.ok(top > 5 && top < 0.45 + BUBBLE.maxRise + 0.4, `floated up to ${top.toFixed(2)} m`);
  assert.ok(Math.abs(crate.pos.z) < 6, 'drifting slowly, not flying off');
  for (let i = 0; i < 60 * 3 && W.bubble; i++) { W.update(DT); world.update(DT); }
  assert.equal(W.bubble, null, 'popped after its time');
  assert.equal(crate.held, null);
  for (let i = 0; i < 60 * 3; i++) world.update(DT);
  assert.ok(Math.abs(crate.pos.y - 0.45) < 0.05, 'back on the ground');
  clearTargets();
});

test('a foe in a bubble is helpless and floats up; dropped from high it lands hard; a machine is too heavy', () => {
  clearTargets();
  const ph = physicsOf(), P = player(v(0, 0, 6));
  const f = new Foe('blot', v(0, 0, 0), { rng: () => 0.5 });
  const env = { ground: () => 0 };
  const W = bubble.create(ctxOf(P, ph, { foes: { list: [f], hurt: (x, m, d, i) => x.hit(m, d, i) } }));
  W.spawn('free', v(0, 1, 1));
  assert.ok(W.engulf({ kind: 'foe', foe: f }));
  for (let i = 0; i < 60 * 4.5; i++) { W.update(DT); const ev = f.update(DT, P, env); assert.equal(ev.length, 0, 'it does nothing inside'); }
  assert.ok(f.pos.y > 4, `up at ${f.pos.y.toFixed(1)} m`);
  assert.ok(f.stunned > 0);
  const hp = f.hp;
  W.press();   // popped early
  assert.equal(W.bubble, null);
  for (let i = 0; i < 60 * 2; i++) W.update(DT);
  assert.ok(Math.abs(f.pos.y) < 1e-9, `fell back to the ground (${f.pos.y})`);   // (the ground found along `up` may be a hair off 0)
  assert.ok(f.hp < hp, 'and landed hard');
  const m = new Foe('machine', v(0, 0, 0));
  W.cool = 0;
  W.spawn('free', v(0, 1, 1));
  assert.equal(W.engulf({ kind: 'foe', foe: m }), false);
  assert.equal(W.bubble, null, 'it burst on the machine');
  assert.match(W.ctx?.notes?.at(-1) ?? '', /machine’s shell/);
  // the worlds' heavy foes: each worded for what it burst on, never "the machine's shell"
  for (const [kind, word] of [['golem', /golem’s sharp glass/], ['crab', /crab’s salt-crusted shell/], ['slag', /slag walker’s hot crust/]]) {
    const ctx = ctxOf(P, ph, { foes: { list: [], hurt() {} } }), B = bubble.create(ctx);
    B.spawn('free', v(0, 1, 1));
    assert.equal(B.engulf({ kind: 'foe', foe: new Foe(kind, v(0, 0, 0)) }), false, `a ${kind} is too heavy`);
    assert.equal(B.bubble, null);
    assert.match(ctx.notes.at(-1), word, kind);
    assert.doesNotMatch(ctx.notes.at(-1), /machine/);
  }
  assert.equal(heavyWords('nothing', 'odd thing'), 'Too heavy for a bubble: it bursts on the odd thing.');
  clearTargets();
});

test('a bomb in a bubble rises with its fuse sealed, and goes off just after the bubble pops', () => {
  clearTargets();
  const ph = physicsOf(), P = player(v(0, 0, 20));
  const blasts = [];
  const ctx = ctxOf(P, ph, { world: new GadgetWorld({ physics: ph, player: P }), bursts: { add: (at) => blasts.push(at.clone()) } });
  const B = bomb.create(ctx);
  const W = bubble.create(ctx);
  ctx.gadget = (id) => (id === 'bomb' ? B : id === 'bubble' ? W : null);
  const b = B.spawn(v(0, 0.2, 0), v(), 1.0);
  W.spawn('free', v(0, 1, 1));
  assert.ok(W.engulf({ kind: 'bomb', bomb: b }));
  for (let i = 0; i < 60 * 4; i++) { B.update(DT); W.update(DT); }
  assert.equal(blasts.length, 0, 'four seconds and not gone off');
  assert.ok(b.pos.y > 4, `carried up to ${b.pos.y.toFixed(1)} m`);
  W.press();
  let t = 0;
  while (!blasts.length && t < 1) { B.update(DT); W.update(DT); t += DT; }
  assert.equal(blasts.length, 1);
  assert.ok(t <= BUBBLE.fuse + 0.05 && blasts[0].y > 3, `off ${t.toFixed(2)} s after, still high (${blasts[0].y.toFixed(1)} m)`);
  clearTargets();
});

test('wrapped in his own bubble the traveller floats up, drifts slowly, pops on spikes, and at the end sinks gently to the ground', () => {
  clearTargets(); clearHazards();
  const ph = physicsOf(), P = player(v(0, 0, 0));
  const W = bubble.create(ctxOf(P, ph));
  W.wrapSelf();
  let top = 0;
  for (let i = 0; i < 60 * 4; i++) { W.control(DT, {}); P.vel.x = 9; step(P); W.update(DT); top = Math.max(top, P.pos.y); }
  assert.ok(top > 4.5 && top < BUBBLE.self.maxRise + 0.3, `up to ${top.toFixed(2)} m`);
  assert.ok(P.vel.x <= BUBBLE.self.drift + 1e-6, 'drifting no faster than the bubble lets him');
  // the end: down again, gently, and it pops on the ground
  let land = 0;
  for (let i = 0; i < 60 * 12 && W.bubble; i++) { W.control(DT, {}); P.vel.x = 0; const vy = P.vel.y; step(P); if (P.onGround) land = Math.min(land, vy); W.update(DT); }
  assert.equal(W.bubble, null, 'popped when he touched down');
  assert.ok(land > -3, `a soft landing (${land.toFixed(2)} m/s)`);
  // spikes pop it; so does jump from inside
  P.pos.set(0, 0, 0); P.onGround = true; W.cool = 0;
  W.wrapSelf();
  for (let i = 0; i < 30; i++) { W.control(DT, {}); step(P); W.update(DT); }
  const off = registerHazard(cylinderHazard({ kind: 'spikes', x: 0, z: 0, y0: -1, y1: 9, r: 1, dps: 0.1 }));
  assert.ok(hazardAt(P.pos));
  W.update(DT);
  assert.equal(W.bubble, null, 'popped on the spikes');
  off();
  W.cool = 0; W.wrapSelf();
  W.control(DT, { Space: true });
  assert.equal(W.bubble, null, 'jump pops it');
  // pressed in the air: round yourself at once
  P.onGround = false; W.cool = 0;
  W.press();
  assert.equal(W.bubble?.kind, 'self');
  clearTargets();
});

test('an empty bubble pops on a wall; a blade or an ember glob pops a carried one, a push only blows it along', () => {
  clearTargets();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.5), new THREE.MeshBasicMaterial()); wall.position.set(0, 3, -4);
  const ph = physicsOf(wall), P = player(v(0, 0, 4));
  const world = new GadgetWorld({ physics: ph, player: P });
  const W = bubble.create(ctxOf(P, ph, { world }));
  const b = W.spawn('free', v(0, 1.5, 0)); b.vel.set(0, 0, -BUBBLE.speed);
  for (let i = 0; i < 60 && W.bubble; i++) W.update(DT);
  assert.equal(W.bubble, null, 'popped on the wall');
  const box = new THREE.Group(); box.position.set(3, 0.45, 2);
  const crate = world.addProp({ object: box, r: 0.55, h: 0.45 });
  W.spawn('free', v(3, 1, 2)); W.engulf({ kind: 'prop', prop: crate });
  for (let i = 0; i < 30; i++) { W.update(DT); world.update(DT); }
  const hit = raycastTargets(v(3, crate.pos.y, 6), v(0, 0, -1), 10);
  assert.equal(hit?.target.kind, 'bubble', 'the bubble is a target');
  hit.target.onHit('push', hit.point, v(1, 0, 0), { strength: 1 });
  assert.ok(W.bubble && W.bubble.vel.x > 2, 'pushed along');
  hit.target.onHit('blade', hit.point, v(0, 0, -1), {});
  assert.equal(W.bubble, null, 'cut: popped');
  clearTargets();
});

// ------------------------------------------------------------------ the fan's maths

test('a gust is strong near the fan and gone past its reach; on foot it goes along the ground, from the wings down', () => {
  assert.equal(gustStrength(0), 1);
  assert.ok(gustStrength(FAN.range * 0.5) < 1 && gustStrength(FAN.range) > 0.25);
  assert.equal(gustStrength(FAN.range + 0.1), 0);
  const d = gustDirection(v(0, -0.5, -1).normalize(), UP);
  assert.ok(Math.abs(d.length() - 1) < 1e-9 && d.y > -0.25 && d.z < -0.9, 'flattened toward the ground');
  const a = gustDirection(v(0, 0, -1), UP, { air: true });
  assert.ok(a.y < -0.9 && a.z < 0, 'down at the ground, a little forward');
  assert.equal(hoverLift(-5, true), FAN.hover.glide);
  assert.equal(hoverLift(-5, false), FAN.hover.air);
  assert.equal(hoverLift(12, true), 12, 'never slows a climb');
  assert.ok(sailPush([0, 1], v(0, 0, 1)).speed === FAN.sail && sailPush([0, 1], v(0, 0, -1)).speed < 0, 'along the keel');
  assert.equal(pinwheelCatch(v(0, 0, -1), v(0, 0, 1)), 1, 'blown into its face');
  assert.equal(pinwheelCatch(v(1, 0, 0), v(0, 0, 1)), 0, 'past its edge');
});

// ------------------------------------------------------------------ the fan's behaviour

test('a gust shoves a crate, knocks a blot back, blows a skitter away, rolls a bomb and blows a bubble along', () => {
  clearTargets();
  const ph = physicsOf(), P = player(v(0, 0, 0));
  const world = new GadgetWorld({ physics: ph, player: P });
  const box = new THREE.Group(); box.position.set(0.5, 0.45, -3);
  const crate = world.addProp({ object: box, r: 0.55, h: 0.45 });
  const blot = new Foe('blot', v(-0.8, 0, -4)), swarm = new Foe('skitter', v(0.3, 0, -5)), far = new Foe('blot', v(0, 0, -20));
  for (const f of [blot, swarm, far]) registerTarget({ kind: 'foe', foe: f, radius: f.def.radius + 0.15, position: () => f.chest, enabled: () => f.alive, onHit: (m, p, d, i) => f.hit(m, d, i) });
  const ctx = ctxOf(P, ph, { world });
  const B = bomb.create(ctx), F = fan.create(ctx), W = bubble.create(ctx);
  ctx.gadget = (id) => ({ bomb: B, fan: F, bubble: W })[id];
  const bb = B.spawn(v(-0.4, 0.2, -2), v(), 9);
  const crateB = new THREE.Group(); crateB.position.set(2.6, 0.45, -5);
  const c2 = world.addProp({ object: crateB, r: 0.55, h: 0.45 });
  W.spawn('free', v(2.6, 1, -5)); W.engulf({ kind: 'prop', prop: c2 });
  for (let i = 0; i < 15; i++) { W.update(DT); world.update(DT); }
  const res = F.gust(v(0, 1.2, 0), v(0, 0, -1));
  assert.ok(crate.vel.z < -5, `the crate slides away (${crate.vel.z.toFixed(1)} m/s)`);
  assert.ok(blot.alive && blot.vel.z < -4 && blot.stunned > 0, 'the blot is knocked back, reeling');
  assert.equal(swarm.alive, false, 'the skitter is blown away');
  assert.equal(far.vel.length(), 0, 'past its reach, nothing');
  assert.ok(bb.vel.z < -4, 'the bomb rolls');
  assert.ok(W.bubble.vel.z < -1, 'the bubble drifts on');
  assert.ok(res.foes === 2 && res.bombs === 1);
  clearTargets();
});

test('the wings open, a gust at the ground lifts the traveller: three times, then not until he lands', () => {
  clearTargets();
  const P = player(v(0, 6, 0)); P.onGround = false; P.gliding = true; P.vel.set(0, -3, 8);
  const F = fan.create(ctxOf(P, physicsOf()));
  const lifts = [];
  for (let i = 0; i < 4; i++) { F.cool = 0; F.swing(); lifts.push(P.vel.y); P.vel.y = -3; }
  assert.deepEqual(lifts, [FAN.hover.glide, FAN.hover.glide, FAN.hover.glide, -3]);
  assert.ok(P.vel.z > 7, 'his glide carries on');
  P.onGround = true; F.update(DT);
  assert.equal(F.hovers, FAN.hover.gusts, 'landed: three more');
  clearTargets();
});

test('a gust fills a skiff\'s sail: from the shore it sails off, ridden it is the rider\'s own push', () => {
  clearTargets();
  const P = player(v(0, 0, 0));
  const m = { kind: 'skiff', speed: 0, yawRate: 0, forward: [0, -1], pos: v(0, 0, -4) };
  P.mount = m;
  registerTarget({ kind: 'mount', radius: 1.3, position: () => v(0, 0.6, -4), onHit: () => assert.fail('the gust fills the sail itself') });
  const F = fan.create(ctxOf(P, physicsOf()));
  F.gust(v(0, 1.2, 0), v(0, 0, -1));
  assert.ok(m.speed > 4, `it sails off (${m.speed.toFixed(1)} m/s)`);
  clearTargets();
  P.ride = m; m.speed = 5; F.cool = 0;
  F.swing();
  assert.equal(m.speed, 5 + FAN.sail);
});

test('the fan blows out what an ember lit (a lamp), and the yard\'s fire: out, no longer burning, alight again later', () => {
  clearTargets(); clearHazards();
  const fl = new Flammables(null, [{ at: v(0, 1, -3), kind: 'lamp', r: 0.4 }]);
  const s = fl.spots[0];
  fl.update(0, 0, v());   // (near the traveller: its target is on)
  fl.ignite(s);
  assert.ok(s.lit && s.burning === 1);
  const level = { gadgetYard: { embers: [{ at: v(3, 0, -4), r: 0.85, h: 2, regrow: 5 }] } };
  const P = player(v(0, 0, 0));
  const F = fan.create(ctxOf(P, physicsOf(), { level }));
  const x = F.embers[0];
  assert.ok(hazardAt(v(3, 0, -4)), 'the fire burns whoever walks into it');
  const res = F.gust(v(0, 1.2, 0), v(0, 0, -1), { angle: 0.9 });
  assert.equal(s.lit, false); assert.equal(s.burning, 0);
  assert.equal(x.lit, false, 'the yard\'s fire is out');
  assert.equal(res.doused, 2);
  for (let i = 0; i < 30; i++) F.update(DT);
  assert.equal(hazardAt(v(3, 0, -4)), null, 'and burns no more');
  for (let i = 0; i < 60 * 6; i++) F.update(DT);
  assert.equal(x.lit, true, 'it catches again after a while');
  F.dispose(); fl.dispose();
  clearTargets(); clearHazards();
});

test('the pinwheels turn only blown in the face; all three at once open their gate', () => {
  clearTargets();
  const wheels = [[v(-5, 2, 0), v(1, 0, 0)], [v(5, 2, 0), v(-1, 0, 0)], [v(0, 2, -5), v(0, 0, 1)]].map(([head, normal]) => ({ head, normal, blades: new THREE.Group(), lamp: new THREE.Mesh(), on: 'on', off: 'off' }));
  const gateObj = new THREE.Group();
  const ph = physicsOf(), P = player(v());
  const world = new GadgetWorld({ physics: ph, player: P, spec: { gates: [{ object: gateObj, plates: null, want: 0, travel: 3 }] } });
  const level = { gadgetYard: { pinwheels: wheels, windGates: [{ object: gateObj, wheels: [0, 1, 2] }] } };
  const F = fan.create(ctxOf(P, ph, { world, level }));
  F.gust(v(0, 2, 3), v(0, 0, -1));   // the third, into its face (and the others edge on, out of the cone)
  assert.ok(F.wheels[2].spin > 0.5 && F.wheels[0].spin === 0);
  F.gust(v(-5, 2, 4), v(0, 0, -1));   // the first, edge on
  assert.ok(F.wheels[0].spin < 0.15, 'edge on it barely stirs');
  F.update(DT);
  assert.equal(world.gates[0].want, 0);
  F.gust(v(-1, 2, 0), v(-1, 0, 0));
  F.gust(v(1, 2, 0), v(1, 0, 0));
  F.update(DT);
  assert.ok(F.wheels.every((w) => w.lit), 'all three turning, lamps lit');
  assert.equal(world.gates[0].want, 1, 'the gate opens');
  for (let i = 0; i < 60 * 10; i++) F.update(DT);
  assert.ok(F.wheels.every((w) => !w.lit), 'they wind down');
  assert.equal(world.gates[0].want, 1, 'the gate stays open a while');
  clearTargets();
});

test('the Gadget Yard has the bubble\'s and the fan\'s bays: a plate up a ledge, a boulder on a pillar, pinwheels, a fire in a doorway', async () => {
  const { LEVELS } = await import('../src/levels/index.js');
  const meta = LEVELS.find((l) => l.id === 'gadgetyard');
  const warn = console.warn; console.warn = () => {};
  let level;
  try { level = meta.create(new THREE.Scene()); } finally { console.warn = warn; }
  const Y = level.gadgetYard;
  assert.ok(Y.plates.some((p) => p.pos.y > 4.5), 'a floor plate up on the bubble\'s ledge');
  assert.ok(Y.breakables.some((b) => b.center.y > 7), 'a cracked boulder high on a pillar');
  assert.equal(Y.pinwheels.length, 3);
  assert.equal(Y.windGates.length, 1);
  assert.ok(Y.gates.some((g) => g.object === Y.windGates[0].object && g.plates === null), 'its gate is the wind\'s, not a plate\'s');
  assert.equal(Y.embers.length, 1);
  for (const p of Y.pinwheels) assert.ok(Math.abs(p.normal.length() - 1) < 1e-6);
  clearTargets(); clearHazards();
});
