import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FluidTool, FLUID } from '../src/fluid-tool.js';
import { MODES, HANDOFF, nextMode, ownedModes, STUN_SECONDS } from '../src/fluid-kit.js';
import { clearTargets, hitTarget, registerTarget, modeFor, raycastTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { Player } from '../src/player.js';
import { Physics } from '../src/physics.js';
import { Hoverbike } from '../src/bike.js';
import { Flammables, flammableSpots } from '../src/flammable.js';
import { NPC } from '../src/npc.js';
import { items, ITEMS } from '../src/items.js';

// Everything runs on the magic-fluid backpack (src/items.js): the tool, the jets,
// the wings, the gun modes and the powered vehicles.

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };

/** Flat ground (a big slab at y = 0), real collision. */
function ground() {
  const scene = new THREE.Scene();
  const m = new THREE.Mesh(new THREE.BoxGeometry(400, 1, 400)); m.position.set(0, -0.5, 0); scene.add(m);
  return new Physics(scene);
}
/** Just enough of a humanoid for the tool to wear its tank (chest anchor, both arms). */
function rig(p) {
  const bone = (parent, x, y, z) => { const b = new THREE.Object3D(); b.position.set(x, y, z); parent.add(b); return b; };
  const chest = bone(p.object, 0, 1.0, 0);
  const B = {};
  for (const [s, x] of [['r', -0.2], ['l', 0.2]]) {
    B[`upperarm_${s}`] = bone(chest, x, 0.7, 0);
    B[`lowerarm_${s}`] = bone(B[`upperarm_${s}`], 0, -0.3, 0.05);
    B[`hand_${s}`] = bone(B[`lowerarm_${s}`], 0, -0.26, 0.04);
  }
  B.spine_03 = chest;
  const calls = { handOff: 0 };
  p.humanoid = { chestAnchor: chest, b: B, noShadow: [], imported: false, update() {}, resetFeet() {}, plantFeet() {}, reach() {}, capsules: () => [], handOff() { calls.handOff++; } };
  return calls;
}
function setup({ up = null, physics = ground(), mount = null } = {}) {
  clearTargets();
  const scene = new THREE.Scene();
  const p = new Player(physics, { mount: mount ? () => mount : null, ...(up ? { gravityAt: () => up } : {}) });
  p.pos.set(0, 0, 0);   // on the slab (its ground query from far above finds nothing)
  if (up) p.frame.set(up, Math.abs(up.y) > 0.5 ? v(0, 0, 1) : v(0, 1, 0));
  const calls = rig(p);
  scene.add(p.object);
  const camera = new THREE.PerspectiveCamera();
  camera.position.copy(p.pos).add(v(0.8, 1.6, 3.4)); camera.lookAt(0.8, 1.6, -30); camera.updateMatrixWorld();
  const state = new GameState(null);
  const tool = new FluidTool({ scene, player: p, physics, camera, rig: { aimK: 0 }, state });
  const step = (n, ctl = {}) => { for (let i = 0; i < n; i++) { p.update(DT, ctl, 0); scene.updateMatrixWorld(); tool.update(DT, ctl); } };
  return { p, tool, scene, camera, state, step, calls };
}

test('no backpack: no tank, hose or bracer, nothing fires, nothing throws; found, it shimmers onto the back and works', () => {
  own();
  const { p, tool, step } = setup();
  step(5);
  assert.equal(tool.owned, false);
  assert.equal(tool.tank.group.visible, false, 'a bare back');
  assert.equal(tool.hose.mesh.visible, false);
  assert.equal(tool.bracer.group.visible, false);
  assert.deepEqual(tool.modes, [], 'no gun modes');
  step(30, { KeyR: true }); step(1, { KeyR: true, KeyG: true }); step(1, { KeyC: true }); step(10);
  assert.equal(tool.k, 0, 'the arm never comes up');
  assert.equal(tool.globs.length, 0); assert.equal(tool.charges, 3);
  p.pos.set(0, 20, 0); p.onGround = false;
  assert.equal(p.onAirJump(1), false, 'no boost');
  // found (a box, a quest, the dev menu): live
  items.grant('backpack');
  assert.equal(tool.appear, 0, 'the shimmer starts');
  step(1);
  assert.equal(tool.tank.group.visible, true);
  assert.ok(tool.tank.group.scale.x < 0.9, 'it grows in');
  assert.ok(tool.glow.list.length > 10, 'a shimmer of fluid');
  step(70);
  assert.ok(Math.abs(tool.tank.group.scale.x - 1) < 1e-6 && tool.appear === 1);
  assert.equal(tool.bracer.group.visible, true); assert.equal(tool.hose.mesh.visible, true);
  p.pos.set(0, 0, 0); p.onGround = true; step(5);
  step(1, { KeyC: true }); step(12);
  assert.equal(tool.charges, 2, 'the push works now');
  tool.dispose();
});

test('the jets: only with the item; thrust burns the tank as a smooth gauge that recovers once you land', () => {
  own('backpack');
  let { p, tool, step } = setup();
  p.pos.set(0, 30, 0); p.onGround = false; step(1);
  step(1, { Space: true }); step(60, { Space: true });
  assert.equal(p.thrusting, false, 'no jets without the item');
  tool.dispose();
  own('jetpack');
  ({ p, tool, step } = setup());
  p.pos.set(0, 30, 0); p.onGround = false; step(1);
  step(1, { Space: true }); step(30, { Space: true });
  assert.equal(p.thrusting, false, 'the jets need the backpack too');
  tool.dispose();

  own('backpack', 'jetpack');
  ({ p, tool, step } = setup());
  step(5);
  assert.equal(tool.jets.group.visible, true, 'two nozzles under the tank');
  assert.equal(p.char.jetpack.children.length, 0, 'the old canisters are gone');
  p.pos.set(0, 30, 0); p.onGround = false; step(1);
  const u0 = p.pos.y;
  step(1, { Space: true });
  step(120, { Space: true });   // 2 s of thrust
  assert.ok(p.thrusting && p.pos.y > u0 + 10, `it flies: ${(p.pos.y - u0).toFixed(1)} m up`);
  const burnt = FLUID.charges - tool.reserve.level;
  assert.ok(Math.abs(burnt - FLUID.jet.drain * 2) < 0.06, `${FLUID.jet.drain} charges a second: ${burnt.toFixed(3)} in 2 s`);
  assert.equal(tool.jets.flames[0].flame.visible, true, 'fluid flames');
  assert.ok(tool.fill < 1 && tool.fill > 0.7, 'the tank shows it draining');
  assert.ok(Math.abs(p.jetFuel - tool.reserve.level / 3) < 1e-9, 'the HUD gauge is the tank');
  // off the jets, still airborne: the refill clock waits for the ground
  for (let i = 0; i < 400 && !p.onGround; i++) step(1);
  assert.equal(p.onGround, true);
  assert.ok(tool.reserve.level < 3, 'not refilled in the air');
  step(Math.ceil(FLUID.refillDelay / DT) + 2);
  assert.equal(tool.reserve.level, 3, 'full again two seconds after landing');
  // burnt dry it stops (and drops), a whole charge left still shoots
  tool.reserve.drain(2.95); p.pos.set(0, 30, 0); p.onGround = false; step(1);
  step(1, { Space: true }); step(30, { Space: true });
  assert.equal(p.thrusting, false, 'empty: no thrust');
  tool.dispose();
});

test('the wings: only with the glider; they bloom out of the tank while gliding and fold away on landing', () => {
  own('backpack');
  let { p, tool, step } = setup();
  step(1, { Space: true }); p.pos.set(0, 40, 0); p.onGround = false; p.vel.set(0, 0, 0);
  step(90, { Space: true });
  assert.equal(p.gliding, false, 'holding jump while falling does nothing without the glider');
  assert.equal(tool.wings.group.visible, false);
  tool.dispose();

  own('backpack', 'glider');
  ({ p, tool, step } = setup());
  step(1, { Space: true }); p.pos.set(0, 40, 0); p.onGround = false; p.vel.set(0, 0, 0);
  step(14, { Space: true });   // a fresh fall: the wings open as it starts
  assert.equal(p.gliding, true);
  const mid = p.wingK;
  assert.ok(mid > 0 && mid < 1, `unfolding: ${mid.toFixed(2)}`);
  assert.equal(tool.wings.group.visible, true);
  const lobe = tool.wings.lobes[2], half = lobe.mesh.scale.y;   // the last to bloom
  step(36, { Space: true });
  assert.equal(p.wingK, 1, 'open');
  assert.ok(lobe.mesh.scale.y > half * 1.3 && Math.abs(lobe.mesh.scale.y / lobe.len - 1) < 0.15, `the lobes grow out to full length: ${half.toFixed(2)} -> ${lobe.mesh.scale.y.toFixed(2)} of ${lobe.len}`);
  assert.ok(lobe.mesh.parent.quaternion.angleTo(lobe.folded) > 0.8, 'swung out of the tank');
  assert.equal(tool.wings.material.uniforms.uFluidA.value.w, 3, 'the fluid material, as a membrane');
  // the glide still works as before: forward, a gentle sink, turning with A / D
  const vy = p.vel.y, h0 = p.heading;
  assert.ok(vy < 0 && vy > -4 && Math.hypot(p.vel.x, p.vel.z) > 10, `gliding: sink ${vy.toFixed(2)}`);
  step(40, { Space: true, KeyA: true });
  assert.ok(Math.abs(p.heading - h0) > 0.3, 'banking round');
  // land (still holding jump): they fold back into the tank
  p.pos.set(p.pos.x * 0.2, 2, p.pos.z * 0.2);
  for (let i = 0; i < 300 && !p.onGround; i++) step(1, { Space: true });
  assert.equal(p.onGround, true);
  step(30);
  assert.equal(p.wingK, 0); assert.equal(tool.wings.group.visible, false);
  tool.dispose();
});

test('gun modes cycle through the owned ones only; the tank retints; all share the charges', () => {
  assert.deepEqual(ownedModes(() => false), []);
  assert.equal(nextMode('shoot', ['shoot'], 1), 'shoot');
  assert.equal(nextMode('fire', ['shoot', 'stun', 'fire'], 1), 'shoot');
  assert.equal(nextMode('shoot', ['shoot', 'stun', 'fire'], -1), 'fire');
  own('backpack');
  const { tool, step, state } = setup();
  const events = [];
  state.on('tool:mode', (e) => events.push(e.mode));
  assert.deepEqual(tool.modes, ['shoot']);
  step(1, { KeyX: true }); step(1);
  assert.equal(tool.mode, 'shoot', 'nothing to switch to');
  items.grant('fire');
  step(1, { KeyX: true }); step(1);
  assert.equal(tool.mode, 'fire');
  step(1, { KeyX: true }); step(1);
  assert.equal(tool.mode, 'shoot', 'round again (stun is not owned)');
  items.grant('stun');
  step(1, { KeyX: true }); step(1);
  assert.equal(tool.mode, 'stun');
  assert.equal('#' + tool.tankU.uFluidTones.value[0].getHexString(), MODES.stun.tones[0], 'cold blue in the tank');
  assert.equal('#' + tool.bracer.lens.material.uniforms.uColor.value.getHexString(), MODES.stun.tones[0], 'and on the bracer');
  step(1, { PadModeNext: true }); step(1);
  assert.equal(tool.mode, 'fire', 'D-pad right');
  assert.equal('#' + tool.tankU.uFluidTones.value[0].getHexString(), MODES.fire.tones[0], 'ember orange');
  step(1, { PadModePrev: true }); step(1);
  assert.equal(tool.mode, 'stun', 'D-pad left goes back');
  // the lava nearly stops in stilling mode (the pattern changes too)
  step(90); const t0 = tool.fluidTime; step(60); assert.ok(tool.fluidTime - t0 < 0.2, 'stilling: nearly still');
  tool.setMode('fire'); step(60); const t1 = tool.fluidTime; step(60); assert.ok(tool.fluidTime - t1 > 2, 'ember: boiling');
  assert.deepEqual(events, ['fire', 'shoot', 'stun', 'fire', 'stun', 'fire']);
  // a mode lost (the dev menu) falls back to shoot
  items.revoke('fire'); step(1);
  assert.equal(tool.mode, 'shoot');
  // every mode spends the same charges
  tool.setMode('stun');
  step(30, { KeyR: true }); step(1, { KeyR: true, KeyG: true }); step(20, { KeyR: true });
  assert.equal(tool.charges, 2);
  assert.equal(tool.globs[0]?.mode ?? 'stun', 'stun');
  tool.dispose();
});

test('a stilling glob freezes people; an ember glob lights a lamp and burns a bramble away; others get plain shoot', () => {
  own('backpack', 'stun', 'fire');
  const hadDoc = 'document' in globalThis;
  if (!hadDoc) globalThis.document = { createElement: () => ({ className: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } }), body: { appendChild() {} } };
  // the fallback: a target that doesn't accept a mode gets 'shoot' (with info.mode)
  const got = [];
  const plain = { onHit: (m, pt, d, info) => got.push([m, info.mode]) };
  hitTarget({ target: plain, point: v() }, 'fire', v(), {});
  hitTarget({ target: { ...plain, accepts: ['fire'] }, point: v() }, 'fire', v(), {});
  assert.deepEqual(got, [['shoot', 'fire'], ['fire', 'fire']]);
  assert.equal(modeFor({}, 'push'), 'push');

  const { p, tool, step, scene } = setup();
  const npc = new NPC(scene, ground(), { route: [v(0, 0, -12)], palette: {}, lines: ['…'] });
  npc.pos.set(0.8, 0, -12);
  const off = registerTarget({ kind: 'npc', radius: 0.6, npc, accepts: ['stun', 'fire'], position: () => npc.chest(new THREE.Vector3()), onHit: (m, pt, d, info) => npc.hit(m, d, info) });
  const cam = tool.camera;
  cam.position.set(0.8, 1.6, 3); cam.lookAt(npc.chest(new THREE.Vector3())); cam.updateMatrixWorld();
  tool.setMode('stun');
  step(30, { KeyR: true }); step(1, { KeyR: true, KeyG: true });
  for (let i = 0; i < 90 && !npc.stunned(); i++) { step(1, { KeyR: true }); npc.update(DT, p, cam); }
  assert.equal(npc.stunned(), true, 'stilled');
  const at = npc.pos.clone();
  for (let i = 0; i < 120; i++) npc.update(DT, p, cam);
  assert.ok(npc.pos.distanceTo(at) < 1e-6 && npc.stunned(), 'frozen in place for a few seconds');
  for (let i = 0; i < 120; i++) npc.update(DT, p, cam);
  assert.equal(npc.stunned(), false, `awake again after ${STUN_SECONDS} s`);
  // an ember glob on someone: a jump and a yelp, no harm
  npc.hit('fire', v(0, 0, -1), {});
  assert.ok(npc.shout?.text && !npc.stunned());
  off();

  // flammable things (src/flammable.js)
  const lights = [];
  const fl = new Flammables(scene, [{ at: v(0.8, 1.6, -14), kind: 'lantern', r: 0.7 }, { at: v(30, 0, 0), kind: 'bramble' }], { lights });
  fl.update(0, 0, p.pos);
  const lamp = fl.spots[0];
  tool.setMode('shoot'); tool.refill();
  cam.lookAt(lamp.centre); cam.updateMatrixWorld();
  step(30, { KeyR: true }); step(1, { KeyR: true, KeyG: true });
  for (let i = 0; i < 90 && tool.globs.some((g) => g.state === 'fly'); i++) step(1, { KeyR: true });
  assert.equal(lamp.lit, false, 'plain fluid only splashes on a lamp');
  step(30, { KeyR: true });
  tool.setMode('fire');
  step(1, { KeyR: true, KeyG: true });
  for (let i = 0; i < 90 && !lamp.lit; i++) { step(1, { KeyR: true }); fl.update(DT, 0, p.pos); }
  assert.equal(lamp.lit, true, 'the ember glob lights it');
  assert.equal(lights.length, 1, 'and it lights the street');
  assert.equal(fl.burning.length, 1);
  for (let i = 0; i < 50; i++) fl.update(1, 0, p.pos);
  assert.equal(lamp.lit, false, 'it burns for a while, then goes out');
  assert.equal(lights.length, 0);
  // a bramble burns away and grows back
  const br = fl.spots[1];
  fl.focus.copy(br.at);
  const t = raycastTargets(br.centre.clone().add(v(0, 0, 5)), v(0, 0, -1), 10);
  assert.equal(t?.target.kind, 'flammable');
  hitTarget(t, 'fire', v(0, 0, -1), {});
  for (let i = 0; i < 40; i++) fl.update(0.1, 0, br.at);
  assert.equal(br.mesh.visible, false, 'burnt away');
  assert.equal(t.target.enabled(), false);
  for (let i = 0; i < 70; i++) fl.update(1, 0, br.at);
  assert.equal(br.mesh.visible, true, 'grown back');
  fl.dispose();
  // the desert's camp fires (level.qanat.fires) become flammable spots, with brambles by them
  const spots = flammableSpots({ qanat: { fires: [v(10, 1.5, 10)] }, ground: { heightAt: () => 0 }, flammables: [{ at: v(), kind: 'lamp' }] });
  assert.deepEqual(spots.map((s) => s.kind), ['lamp', 'campfire', 'bramble', 'bramble', 'bramble']);
  tool.dispose();
  if (!hadDoc) delete globalThis.document;
});

test('vehicles run on the backpack: refused without it; boarding swings the tank into the socket and back on dismount', () => {
  own();
  const physics = ground();
  const bike = new Hoverbike(physics);
  bike.place(2.5, 0, 0, v(0, 1, 0));
  for (let i = 0; i < 30; i++) bike.update(DT, null);
  let { p, tool, step } = setup({ physics, mount: bike });
  const notes = [];
  p.onNotice = (t) => notes.push(t);
  step(2);
  assert.equal(bike.powered, true);
  assert.ok(p.nearestVehicle() === bike);
  p.interact();
  assert.equal(p.riding, false, 'it won’t start');
  assert.deepEqual(notes, ['It needs power.']);
  // the whistle doesn't wake it either
  bike.place(80, 0, 80, v(80, 1, 80)); for (let i = 0; i < 5; i++) bike.update(DT, null);
  p.interact();
  assert.equal(bike.auto ?? null, null, 'no whistle');
  assert.equal(notes.length, 2);
  tool.dispose();

  // with it: the hand-off
  own('backpack');
  bike.place(2.5, 0, 0, v(0, 1, 0)); for (let i = 0; i < 30; i++) bike.update(DT, null);
  let calls;
  ({ p, tool, step, calls } = setup({ physics, mount: bike }));
  const frames = (n, ctl = {}) => { for (let i = 0; i < n; i++) { bike.update(DT, p.ride === bike ? ctl : null); p.update(DT, ctl, 0); p.object.parent?.updateMatrixWorld(); tool.update(DT, ctl); } };
  frames(5);
  const chest = p.humanoid.chestAnchor;
  assert.equal(tool.tank.group.parent, chest);
  p.interact();
  assert.ok(p.boarding, 'the hand-off starts');
  assert.equal(p.riding, false);
  frames(Math.round(HANDOFF.board * 0.35 / DT));
  assert.equal(tool.where, 'flight', 'swinging off the back');
  assert.ok(calls.handOff > 0, 'hands on the tank');
  assert.equal(tool.allowed(false), false, 'no tool meanwhile');
  frames(Math.round(HANDOFF.board * 0.4 / DT));
  assert.equal(tool.where, 'socket');
  assert.equal(tool.tank.group.parent, bike.socket, 'slotted into the socket');
  frames(Math.round(HANDOFF.board * 0.3 / DT) + 2);
  assert.equal(p.riding, true, 'and on');
  assert.equal(p.ride, bike);
  frames(60, { KeyW: true });
  assert.ok(bike.powerK > 0.5, 'the fluid lights its engine');
  assert.ok(bike.powerLights[0].mesh.material.uniforms.uGlow.value > 0.3);
  assert.equal(tool.allowed(false), false, 'no tool while riding');
  // off again: the pack comes back
  frames(120);
  p.interact();
  assert.equal(p.riding, false);
  assert.ok(p.unboarding);
  frames(Math.round(HANDOFF.unboard / DT) + 3);
  assert.equal(p.unboarding, null);
  assert.equal(tool.where, 'back');
  assert.equal(tool.tank.group.parent, chest, 'on the back again');
  assert.ok(tool.tank.group.position.distanceTo(v(0, 0.4, -0.33)) < 1e-6);
  assert.equal(tool.allowed(false), true);
  frames(120);
  assert.ok(bike.powerK < 0.1 && Math.abs(bike.speed) < 1, 'unpowered, it settles and stops');
  // moving skips the animation (you're on at once)
  bike.place(p.pos.x + 2.5, p.pos.z, 0, p.pos); for (let i = 0; i < 20; i++) bike.update(DT, null);
  p.interact();
  assert.ok(p.boarding);
  frames(1, { KeyW: true });
  assert.equal(p.riding, true, 'skipped');
  frames(1);
  assert.equal(tool.tank.group.parent, bike.socket);
  // respawning never strands it: the pack is simply back on
  p.respawn(v(0, 1, 0)); frames(2);
  assert.equal(tool.tank.group.parent, chest);
  tool.dispose();
});

test('rotated gravity: the jets push along up, the wings glide, the hand-off stays finite', () => {
  own('backpack', 'jetpack', 'glider');
  const up = v(1, 0, 0);
  const scene = new THREE.Scene();
  const physics = new Physics(scene);
  let { p, tool, step } = setup({ up, physics });
  p.pos.copy(up).multiplyScalar(30); p.onGround = false; p.vel.set(0, 0, 0);
  step(1);
  step(1, { Space: true }); step(60, { Space: true });
  assert.ok(p.thrusting, 'thrusting');
  assert.ok(p.vel.dot(up) > 5 && Math.abs(p.vel.y) < 3, `along up: ${p.vel.toArray().map((x) => x.toFixed(1))}`);
  // Shift + Space: the wings even with fluid left
  step(80);
  step(120, { Space: true, ShiftLeft: true });
  assert.equal(p.gliding, true, 'gliding sideways-down');
  assert.equal(p.wingK, 1);
  assert.ok(p.vel.dot(up) < 0 && p.vel.dot(up) > -4);
  tool.dispose();

  // a hand-off in a turned frame: the arc goes along the frame's up, and every pose is finite
  const flat = ground();
  const bike = new Hoverbike(flat);
  bike.place(2.5, 0, 0, v(0, 1, 0)); for (let i = 0; i < 30; i++) bike.update(DT, null);
  ({ p, tool } = setup({ physics: flat, mount: bike }));
  p.frame.set(v(0, 0.8, 0.6).normalize(), v(1, 0, 0));
  p.interact();
  for (let i = 0; i < 25; i++) { p.update(DT, {}, 0); p.object.parent?.updateMatrixWorld(); tool.update(DT, {}); assert.ok(tool.tank.group.getWorldPosition(v()).toArray().every(Number.isFinite)); }
  assert.equal(tool.where, 'flight');
  for (let i = 0; i < 40; i++) { p.update(DT, {}, 0); tool.update(DT, {}); }
  assert.equal(p.riding, true);
  assert.equal(tool.tank.group.parent, bike.socket);
  tool.dispose();
  own();
});
