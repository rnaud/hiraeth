import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FluidTool, FLUID, FLUID_TONES, Glob, Reserve, boostVelocity, clearLine, fluidTones, shotDir, toolInput, traceShot } from '../src/fluid-tool.js';
import { clearTargets, hitTarget, registerTarget, targetsInCone } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { ReactiveWorld } from '../src/reactive-world.js';
import { Player } from '../src/player.js';
import { Physics } from '../src/physics.js';
import { NPC } from '../src/npc.js';
import { items } from '../src/items.js';

// everything runs on the backpack (src/items.js): these tests wear it (tests/abilities.test.js covers going without)
items.grant('backpack');

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;

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
  registerTarget({ kind, radius, position: () => pos, onHit: (mode, point, dir, info) => hits.push({ mode, point, dir, info }) });
  return hits;
}
function stubPlayer() {
  const frame = { up: v(0, 1, 0), fwd: v(0, 0, 1), right: v(1, 0, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) };
  return { pos: v(), vel: v(), heading: Math.PI, frame, vehicles: [], object: { visible: true }, ride: null, gliding: false, climbing: false, mantle: null, thrusting: false, onGround: true, aim: null, opts: {} };
}
function makeTool(o = {}) {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0.8, 1.6, 3.4); camera.lookAt(0.8, 1.6, -30); camera.updateMatrixWorld();
  const state = new GameState(null);
  const player = o.player ?? stubPlayer();
  const tool = new FluidTool({ scene: new THREE.Scene(), player, physics: o.physics ?? open, camera, rig: { aimK: 0 }, state, level: o.level });
  return { tool, player, camera, state };
}
const frames = (tool, n, ctl = {}) => { for (let i = 0; i < n; i++) tool.update(DT, ctl); };

test('the shared reserve: three uses, then none, then all three back exactly 2 s after the last use', () => {
  const r = new Reserve();
  assert.equal(r.charges, 3);
  assert.ok(r.use() && r.use());
  r.update(1.5);                      // a wait shorter than the delay…
  assert.equal(r.charges, 1);
  assert.ok(r.use());                 // …and the last use restarts the clock
  assert.equal(r.use(), false, 'empty');
  assert.equal(r.charges, 0);
  for (let i = 0; i < Math.round(2 / DT) - 1; i++) assert.equal(r.update(DT), false);
  assert.equal(r.charges, 0, 'still empty just before 2 s');
  assert.ok(Math.abs(r.refillIn - DT) < 1e-6);
  assert.equal(r.update(DT), true, 'refilled at 2 s');
  assert.equal(r.charges, 3, 'all three at once');
  assert.equal(r.update(10), false, 'nothing more to do when full');
  assert.equal(FLUID.charges, 3); assert.equal(FLUID.refillDelay, 2);
});

test('controls: aim, shoot and push from keyboard, mouse, pad or touch; a shot only while aiming', () => {
  const none = { aim: false, shoot: false, fire: false, quick: false, push: false, mode: false, modeBack: false };
  assert.deepEqual(toolInput({ KeyR: true, KeyG: true }), { ...none, aim: true, shoot: true, fire: true });
  assert.deepEqual(toolInput({ MouseRight: true, MouseLeft: true, MouseMiddle: true }), { ...none, aim: true, shoot: true, fire: true, push: true });
  assert.deepEqual(toolInput({ PadAim: true, PadFire: true, PadPush: true }), { ...none, aim: true, shoot: true, fire: true, push: true });
  assert.deepEqual(toolInput({ PadFire: true }), { ...none, fire: true }, 'RT without LT does not shoot (it fires the jets: player.js)');
  assert.deepEqual(toolInput({ KeyG: true }), { ...none, fire: true }, 'nor G without R');
  assert.deepEqual(toolInput({ TouchFire: true }), { ...none, quick: true }, 'the touch button: a quick shot');
  assert.deepEqual(toolInput({ KeyC: true }), { ...none, push: true });
  assert.deepEqual(toolInput({ KeyX: true, KeyF: true, KeyE: true }), { ...none, mode: true }, 'X switches the gun mode; F and E do nothing to the tool');
  assert.deepEqual(toolInput({ PadModeNext: true }), { ...none, mode: true }, 'D-pad right');
  assert.deepEqual(toolInput({ PadModePrev: true }), { ...none, modeBack: true }, 'D-pad left');
});

test('each ability spends a charge from the one reserve; empty, nothing fires until the refill', () => {
  clearTargets();
  const { tool, player, state } = makeTool();
  const fired = [];
  state.on('tool:fire', (e) => fired.push(e.mode));
  // shoot: aim, then a press
  frames(tool, 30, { KeyR: true });
  assert.ok(tool.aiming && player.aim?.k > 0.9);
  tool.update(DT, { KeyR: true, KeyG: true });
  assert.equal(tool.charges, 2); assert.equal(tool.globs.length, 1);
  frames(tool, 30, { KeyR: true });
  // push: a press, no aiming needed
  tool.update(DT, { KeyC: true }); frames(tool, 10);
  assert.equal(tool.charges, 1);
  // boost: the player asks on a fresh press of jump in the air
  player.onGround = false; player.vel.set(0, -3, 0);
  assert.equal(player.onAirJump(1), true);
  assert.equal(tool.charges, 0);
  assert.ok(player.vel.y > 10, 'up it goes');
  assert.deepEqual(fired, ['shoot', 'push', 'boost']);
  // nothing left: a press only sputters, and the boost declines (the player just glides)
  frames(tool, 25, { KeyR: true });
  tool.update(DT, { KeyR: true, KeyG: true }); frames(tool, 20, { KeyR: true });
  assert.equal(tool.globs.filter((g) => g.state === 'fly').length <= 1, true);
  assert.equal(fired.length, 3);
  assert.equal(player.onAirJump(1), false);
  // 2 s after the last use, the tank is full again
  const until = FLUID.refillDelay - tool.reserve.since;
  frames(tool, Math.floor(until / DT) - 2);
  assert.equal(tool.charges, 0);
  frames(tool, 4);
  assert.equal(tool.charges, 3);
  // disabled (the ship prologue): nothing comes out
  tool.enabled = false;
  tool.update(DT, { KeyC: true }); frames(tool, 10);
  assert.equal(tool.charges, 3); assert.equal(player.onAirJump(1), false);
  state.emit('tool:enable', { on: true });
  assert.equal(tool.enabled, true);
  tool.dispose();
});

test('an empty tank (the desert’s backpack, until the giant’s pool) holds nothing and never refills by itself; the first water fills it for good', () => {
  clearTargets();
  const { tool, player, state } = makeTool();
  state.set('tool.empty', true);
  const fired = [], dry = [];
  state.on('tool:fire', (e) => fired.push(e.mode));
  state.on('tool:dry', () => dry.push(1));
  frames(tool, 10);
  assert.equal(tool.dry, true);
  assert.equal(tool.charges, 0, 'no charges');
  // shoot, push, boost: nothing comes out, a press only sputters (and says why)
  frames(tool, 30, { KeyR: true });
  tool.update(DT, { KeyR: true, KeyG: true }); frames(tool, 20, { KeyR: true });
  tool.update(DT, { KeyC: true }); frames(tool, 10);
  player.onGround = false;
  assert.equal(player.onAirJump(1), false, 'no boost');
  player.onGround = true;
  assert.deepEqual(fired, []);
  assert.ok(dry.length >= 1, 'the story hears the tank is dry');
  assert.match(tool.hudText(), /empty/);
  // it does not refill on its own, however long you wait
  frames(tool, Math.round(5 / DT));
  assert.equal(tool.charges, 0);
  assert.ok(tool.fill < 0.05, 'the glass is empty');
  // magical water: full, a colour band, and the flag cleared for good
  tool.refill({ addColour: true });
  assert.equal(state.flag('tool.empty'), false);
  assert.equal(tool.dry, false);
  assert.equal(tool.charges, 3);
  assert.equal(tool.colours, 2, 'cyan, violet and the pool’s band');
  tool.update(DT, { KeyC: true }); frames(tool, 10);
  assert.deepEqual(fired, ['push'], 'now it pushes');
  frames(tool, Math.round(2.2 / DT));
  assert.equal(tool.charges, 3, 'and refills as ever');
  tool.dispose();
});

test('shoot: a glob flies straight onto the crosshair, hits the nearest target and the world occludes it', () => {
  clearTargets();
  const near = target(v(0, 0, -10)), far = target(v(0, 0, -20)), aside = target(v(3, 0, -5));
  const fly = (physics, from = v(), vel = v(0, 0, -FLUID.shoot.speed), up = v(0, 1, 0), gravity = 0) => {
    const g = new Glob(from, vel);
    for (let i = 0; i < 400; i++) { const e = g.step(DT, { physics, up, gravity }); if (e) return { g, e }; }
    return { g, e: null };
  };
  let { e } = fly(open);
  assert.equal(e.type, 'target');
  hitTarget(e.hit, 'shoot', e.dir, { colours: fluidTones(1) });
  assert.equal(near.length, 1); assert.equal(near[0].mode, 'shoot');
  assert.deepEqual(near[0].info.colours, FLUID_TONES.slice(0, 2));
  assert.equal(far.length, 0); assert.equal(aside.length, 0);
  // a wall in front of the target takes the glob (a splat on the wall)
  ({ e } = fly(planePhysics(v(0, 0, -6), v(0, 0, 1))));
  assert.equal(e.type, 'world'); assert.ok(Math.abs(e.point.z + 6) < 1e-6); assert.ok(e.normal.z > 0.99);
  // a wall behind it doesn't
  ({ e } = fly(planePhysics(v(0, 0, -15), v(0, 0, 1))));
  assert.equal(e.type, 'target');
  // the crosshair trace agrees
  assert.equal(traceShot(planePhysics(v(0, 0, -6), v(0, 0, 1)), v(), v(0, 0, -1)).kind, 'world');
  // straight: no gravity on the glob, so it keeps to the line from the nozzle to the crosshair, whichever way gravity points
  assert.equal(FLUID.shoot.gravity, 0, 'a straight shot');
  for (const up of [v(0, 1, 0), v(1, 0, 0), v(0, -0.6, 0.8)]) {
    clearTargets();
    const aimAt = v(4, -2, -40), got = target(aimAt, 0.4);
    const dir = shotDir(v(), aimAt, v(0, 0, -1));
    const g = new Glob(v(), dir.clone().multiplyScalar(FLUID.shoot.speed));
    let hit = null, off = 0;
    for (let i = 0; i < 400 && !hit; i++) {
      hit = g.step(DT, { physics: open, up });
      off = Math.max(off, g.pos.clone().sub(dir.clone().multiplyScalar(g.pos.dot(dir))).length());
    }
    assert.equal(hit?.type, 'target', `gravity along ${up.toArray()}`);
    assert.ok(off < 1e-6, `on the line all the way (${off})`);
    assert.equal(got.length, 0);
  }
  // a target right beside the nozzle: along the camera's aim instead
  assert.ok(shotDir(v(), v(0, 0, -1), v(1, 0, 0)).distanceTo(v(1, 0, 0)) < 1e-9);
  // through the tool: aimed at a target, the glob flies there and calls onHit('shoot')
  clearTargets();
  const hits = target(v(0.8, 1.6, -20), 0.8);
  const { tool } = makeTool();
  // not aiming: the fire button does nothing (no quick shot any more)
  tool.update(DT, { KeyG: true }); frames(tool, 30, { KeyG: true });
  assert.equal(tool.globs.length, 0, 'no shot without aiming');
  assert.equal(tool.charges, 3);
  // aiming with the fire button still held from before: no shot until a fresh press
  frames(tool, 30, { KeyR: true, KeyG: true });
  assert.equal(tool.globs.length, 0, 'a press held from before the aim does not shoot');
  frames(tool, 2, { KeyR: true });
  assert.ok(tool.aimPoint.distanceTo(v(0.8, 1.6, -19.2)) < 0.05, 'the crosshair sits on the target');
  tool.update(DT, { KeyR: true, KeyG: true });
  assert.equal(tool.globs.length, 1, 'a fresh press while aiming shoots');
  const g0 = tool.globs[0], line = shotDir(g0.pos, tool.aimPoint, tool.aimDir);
  for (let i = 0; i < 90 && !hits.length; i++) tool.update(DT, { KeyR: true });
  assert.equal(hits.length, 1); assert.equal(hits[0].mode, 'shoot');
  assert.ok(g0.dir.distanceTo(line) < 1e-6, 'it flew straight, without bending');
  assert.equal(tool.arc, undefined, 'no trajectory preview');
  // a glob on the world leaves a splat that fades away
  clearTargets();
  const wall = makeTool({ physics: planePhysics(v(0, 0, -12), v(0, 0, 1)) }).tool;
  frames(wall, 30, { KeyR: true });
  wall.update(DT, { KeyR: true, KeyG: true });
  for (let i = 0; i < 60 && !wall.splats.list.length; i++) wall.update(DT, { KeyR: true });
  assert.equal(wall.splats.list.length, 2, 'a two-tone splat');
  frames(wall, Math.ceil(FLUID.shoot.splatLife / DT) + 2);
  assert.equal(wall.splats.list.length, 0, 'short-lived');
  tool.dispose(); wall.dispose();
});

test('a straight shot: a lip in front of the nozzle that the crosshair sees past does not take it; the shot leaves on the crosshair\'s ray', () => {
  clearTargets();
  // a shelf's edge (y = 0, from z -1 to -3) just above the nozzle, the target beyond and above it; the camera looks over the shelf
  const shelf = { rayHit(origin, dir, far) {
    if (Math.abs(dir.y) < 1e-9) return null;
    const t = -origin.y / dir.y, p = origin.clone().addScaledVector(dir, t);
    return t >= 0 && t <= far && p.z <= -1 && p.z >= -3 ? { distance: t, point: p, normal: v(0, 1, 0) } : null;
  }, rayDistance: () => Infinity };
  const at = v(0, 0.6, -12), got = target(at, 0.5);
  const cam = v(0, 0.45, 2), rayDir = at.clone().sub(cam).normalize();
  assert.equal(traceShot(shelf, cam, rayDir).kind, 'target', 'the crosshair sees it');
  const muzzle = v(0.3, -0.1, -0.4), dir = shotDir(muzzle, at, rayDir);
  assert.ok(shelf.rayHit(muzzle, dir, muzzle.distanceTo(at)), 'the straight line from the nozzle clips the shelf');
  const from = muzzle.clone();
  assert.equal(clearLine(shelf, from, dir, at, cam, rayDir, 'target'), true);
  assert.ok(dir.distanceTo(rayDir) < 1e-9 && from.clone().sub(cam).cross(rayDir).length() < 1e-6, 'on the crosshair\'s ray');
  assert.ok(from.distanceTo(muzzle) < 1, `beside the nozzle (${from.distanceTo(muzzle).toFixed(2)} m)`);
  const g = new Glob(from, dir.clone().multiplyScalar(FLUID.shoot.speed));
  let e = null;
  for (let i = 0; i < 200 && !e; i++) e = g.step(DT, { physics: shelf, up: v(0, 1, 0) });
  assert.equal(e?.type, 'target');
  hitTarget(e.hit, 'shoot', e.dir, {});
  assert.equal(got.length, 1);
  // an open line: the shot leaves the nozzle as it is
  const f2 = muzzle.clone(), d2 = shotDir(f2, at, rayDir);
  assert.equal(clearLine(open, f2, d2, at, cam, rayDir, 'target'), false);
  assert.ok(f2.equals(muzzle));
});

test('push: only targets inside the cone (and in view) are pushed, away from the traveller', () => {
  clearTargets();
  const origin = v(0, 1.2, 0), dir = v(0, 0, -1);
  const ahead = target(v(0, 1.2, -4)), edge = target(v(2.4, 1.2, -4), 0.5), wide = target(v(4, 1.2, -2)), behind = target(v(0, 1.2, 3)), beyond = target(v(0, 1.2, -7.5));
  const hits = targetsInCone(origin, dir, FLUID.push.range, FLUID.push.angle, open);
  assert.equal(hits.length, 2);
  for (const h of hits) hitTarget(h, 'push', h.dir, { strength: 1 - h.distance / FLUID.push.range });
  assert.equal(ahead.length, 1); assert.equal(edge.length, 1, 'the radius counts at the edge of the cone');
  assert.equal(wide.length + behind.length + beyond.length, 0);
  assert.equal(ahead[0].mode, 'push');
  assert.ok(ahead[0].dir.distanceTo(v(0, 0, -1)) < 1e-6, 'pushed straight away');
  assert.ok(edge[0].dir.x > 0.4, 'pushed outward along its own line');
  // a wall between: nothing
  assert.equal(targetsInCone(origin, dir, FLUID.push.range, FLUID.push.angle, planePhysics(v(0, 0, -2), v(0, 0, 1))).length, 0);
  // through the tool: a quick push along the camera (flattened), one charge
  clearTargets();
  const front = target(v(0.4, 1.2, -4)), side = target(v(-5, 1.2, 0));
  const { tool, player } = makeTool();
  player.vel.set(0, 0, 0);
  tool.update(DT, { KeyC: true }); frames(tool, 12);
  assert.equal(front.length, 1); assert.equal(side.length, 0);
  assert.equal(tool.charges, 2);
  assert.ok(front[0].info.strength > 0.2 && front[0].info.strength < 1);
  assert.ok(player.vel.z > 0.5, 'a little recoil');
  tool.dispose();
});

test('boost: a strong burst up and a little forward, in any gravity; with the jets, a double tap boosts', () => {
  items.grant('glider');
  // the pure velocity change
  for (const up of [v(0, 1, 0), v(1, 0, 0), v(0, -0.6, 0.8).normalize()]) {
    const fwd = new THREE.Vector3(0, 0, 1).addScaledVector(up, -up.z).normalize();
    const vel = up.clone().multiplyScalar(-9).addScaledVector(fwd, 2);
    boostVelocity(vel, up, fwd);
    assert.ok(Math.abs(vel.dot(up) - FLUID.boost.up) < 1e-9, `falling: a fresh burst up (${up.toArray()})`);
    assert.ok(Math.abs(vel.dot(fwd) - 2 - FLUID.boost.forward) < 1e-9);
    const rising = up.clone().multiplyScalar(10);
    boostVelocity(rising, up, null);
    assert.ok(rising.dot(up) > FLUID.boost.up, 'keeps some of a jump still rising');
  }
  // the real player: jump, then press again in the air
  for (const up of [v(0, 1, 0), v(1, 0, 0)]) {
    const p = new Player(new Physics(new THREE.Scene()), { gravityAt: () => up });
    p.frame.set(up, up.y > 0.5 ? v(0, 0, 1) : v(0, 1, 0));
    p.pos.copy(up).multiplyScalar(20); p.onGround = false; p.vel.copy(up).multiplyScalar(-4);
    const { tool } = makeTool({ player: Object.assign(p, {}) });
    p.update(DT, {}, 0);
    const before = p.vel.dot(up);
    p.update(DT, { Space: true }, 0);
    assert.equal(tool.charges, 2, 'a charge spent');
    assert.ok(p.vel.dot(up) > before + 10, `boosted along ${up.toArray()}: ${p.vel.dot(up).toFixed(1)}`);
    assert.equal(p.gliding, false, 'the wing stays shut while rising');
    // holding on still opens the wings once falling (with the glider)
    for (let i = 0; i < 120 && !p.gliding; i++) p.update(DT, { Space: true }, 0);
    assert.equal(p.gliding, true);
    tool.dispose();
  }
  // a pad's jump never fires the jets (RT does): there one press in the air boosts, even with them
  items.grant('jetpack');
  {
    const q = new Player(new Physics(new THREE.Scene()), {});
    q.pos.set(0, 30, 0); q.onGround = false;
    const { tool: qt } = makeTool({ player: q });
    q.update(DT, {}, 0); q.update(DT, { Space: true, PadJump: true }, 0);
    assert.equal(qt.charges, 2, 'one press of the pad\'s jump: a boost');
    for (let i = 0; i < 20; i++) q.update(DT, { Space: true, PadJump: true }, 0);
    assert.equal(q.thrusting, false, 'holding the pad\'s jump does not fire the jets');
    qt.dispose();
  }
  // the keyboard's Space: one press in the air thrusts (burning the gauge, not a whole charge), a quick double tap boosts
  items.grant('jetpack');
  const p = new Player(new Physics(new THREE.Scene()), {});
  p.pos.set(0, 30, 0); p.onGround = false;
  const { tool } = makeTool({ player: p });
  p.update(DT, {}, 0); p.update(DT, { Space: true }, 0);
  for (let i = 0; i < 40; i++) p.update(DT, { Space: true }, 0);
  assert.ok(p.thrusting, 'holding thrusts');
  const burnt = 3 - tool.reserve.level;
  assert.ok(burnt > 0.15 && burnt < 0.25, `~0.2 of a charge burnt in 2/3 s: ${burnt.toFixed(3)}`);
  p.update(DT, {}, 0); p.update(DT, { Space: true }, 0);
  for (let i = 0; i < 40; i++) p.update(DT, {}, 0);
  const before = tool.reserve.level;
  assert.ok(before > 2 && before < 3, 'a slow second press does not boost (it thrusts a moment)');
  p.update(DT, { Space: true }, 0); p.update(DT, {}, 0); p.update(DT, {}, 0); p.update(DT, { Space: true }, 0);
  assert.ok(Math.abs(tool.reserve.level - (before - 1)) < 0.05, 'a double tap spends a whole charge');
  tool.dispose();
  items.revoke('jetpack'); items.revoke('glider');
});

test('refill: magical water fills the tank and adds a colour band for good', () => {
  clearTargets();
  const { tool, state } = makeTool();
  const events = [];
  state.on('tool:refilled', (e) => events.push(e));
  assert.equal(tool.colours, 1);
  assert.deepEqual(tool.tones, ['#52c8cf', '#966ede'], 'two tones at the start');
  tool.reserve.use(); tool.reserve.use();
  assert.equal(tool.refill({ addColour: true }), 2);
  assert.equal(tool.charges, 3); assert.equal(state.flag('tool.colours'), 2);
  assert.equal(tool.tones.length, 3);
  assert.deepEqual(events.at(-1), { charges: 3, colours: 2, added: true });
  tool.refill();
  assert.equal(tool.colours, 2, 'a plain refill adds nothing');
  // the story can do it through the bus
  state.emit('tool:refill', { addColour: true });
  assert.equal(tool.colours, 3);
  // a world's own light can bring its own tone (the bazaar's lantern sun, the buried machine's oil-light)
  state.emit('tool:refill', { addColour: true, tone: '#e9a53c' });
  assert.equal(tool.colours, 4);
  assert.equal(tool.tones[4], '#e9a53c');
  assert.deepEqual(tool.tones.slice(0, 4), FLUID_TONES.slice(0, 4), 'the earlier bands keep their tones');
  tool.update(DT, {});
  assert.equal('#' + tool.globU.uFluidTones.value[4].getHexString(), '#e9a53c', 'the shader gets it');
  for (let i = 0; i < 9; i++) tool.refill({ addColour: true });
  assert.equal(tool.colours, FLUID.maxColours, 'up to the last tone');
  assert.equal(tool.tones.length, FLUID.maxColours + 1);
  tool.dispose();
});

test('targets answer the new modes: reactive scenery blooms in the fluid, lenses, taxis and plants', async () => {
  clearTargets();
  const store = { value: null, getItem() { return this.value; }, setItem(k, val) { this.value = val; } };
  const ground = { rayHit: (origin) => ({ point: v(origin.x, 0, origin.z) }), rayDistance: () => Infinity };
  const scene = new THREE.Scene();
  const world = new ReactiveWorld(scene, { id: 'desert', spawn: v(), ground: { heightAt: () => 0 } }, ground, { npcs: [], story: { goal: [0, 0, -100] }, relics: { spots: [] } }, { storage: store });
  const node = world.field.nodes[0];
  const neighbour = world.field.nodes.find((n) => n !== node && n.cluster === node.cluster);
  // a glob from 25 m wakes it like walking up to it, and it takes the fluid's tones
  const from = node.pos.clone().add(v(25, 0, 0));
  const g = new Glob(from, node.pos.clone().sub(from).normalize().multiplyScalar(FLUID.shoot.speed));
  let e = null;
  for (let i = 0; i < 120 && !e; i++) e = g.step(DT, { physics: open, up: v(0, 1, 0), gravity: 0 });
  assert.equal(e?.type, 'target'); assert.equal(e.hit.target.kind, 'reactive');
  hitTarget(e.hit, 'shoot', e.dir, { colours: ['#ef7e62', '#f6c84e'] });
  assert.ok(world.field.seen.has(node.cluster), 'the encounter is remembered');
  assert.ok(Number.isFinite(neighbour.pulseAt), 'an echo runs through the cluster');
  const camera = new THREE.PerspectiveCamera(); camera.position.set(500, 2, 500); camera.updateMatrixWorld();
  const far = { pos: v(500, 0, 500), frame: { up: v(0, 1, 0) } };
  const quiet = node.obj.base.clone();
  for (let i = 0; i < 8; i++) world.update(0.25, i * 0.25, far, camera);
  const col = node.obj.m.uniforms.uColor.value;
  const toFluid = Math.min(col.clone().sub(new THREE.Color('#ef7e62')).toArray().reduce((s, c) => s + Math.abs(c), 0), col.clone().sub(new THREE.Color('#f6c84e')).toArray().reduce((s, c) => s + Math.abs(c), 0));
  assert.ok(toFluid < 0.35, 'it blooms in the fluid\'s colours');
  assert.ok(col.clone().sub(quiet).toArray().reduce((s, c) => s + Math.abs(c), 0) > 0.3);
  // the push only stirs it: a shimmer, no new encounter
  const other = world.field.nodes.find((n) => n.cluster !== node.cluster);
  other.obj.root.visible = true;   // (hidden while the traveller is far off)
  const cone = targetsInCone(other.pos.clone().add(v(0, 0, 3)), v(0, 0, -1), FLUID.push.range, FLUID.push.angle);
  const mine = cone.find((h) => h.target.kind === 'reactive' && h.point.distanceTo(other.pos) < 1e-6);
  assert.ok(mine);
  hitTarget(mine, 'push', mine.dir);
  assert.ok(!world.field.seen.has(other.cluster) && other.pulse > 0.4 && other.sway > 0);
  world.dispose();

  clearTargets();
  const { buildObservatory, ObservatoryQuest } = await import('../src/observatory.js');
  const s2 = new THREE.Scene(), model = buildObservatory(s2, { baseAt: () => 0 }); s2.updateMatrixWorld(true);
  const journal = { data: { observatory: { started: true, turns: [1, 0, 3], done: false, fragments: [] } }, save() {} };
  const quest = new ObservatoryQuest({ model, journal, traveler: { lines: [], pos: v(), greeted: false }, sound: { chime() {} } });
  const lens = model.dials[0].getWorldPosition(v());
  const aim = (fromP, at) => traceShot(open, fromP, at.clone().sub(fromP).normalize(), 60);
  const ledge = lens.clone().add(v(12, -1, 0));
  quest.update(0, { pos: ledge, riding: false }, {}, false);
  const shot = aim(ledge, lens);
  assert.equal(shot.target?.kind, 'lens');
  hitTarget(shot.hit, 'push', v());
  assert.deepEqual(quest.state.turns, [1, 0, 3], 'the push does not turn a lens');
  hitTarget(shot.hit, 'shoot', v());
  assert.deepEqual(quest.state.turns, [2, 0, 3]);
  quest.dispose();


  clearTargets();
  const hails = [], plant = [];
  const taxi = { pos: v(0, 10, -25), mode: 'lane', hail: (p) => hails.push(p.clone()) };
  const player = { ...stubPlayer(), vehicles: [taxi] };
  const { tool } = makeTool({ player, level: { targets: [{ kind: 'plant', radius: 2, position: () => v(20, 2, -20), onHit: (mode) => plant.push(mode) }] } });
  const t = aim(v(0, 10, 0), taxi.pos);
  assert.equal(t.target?.kind, 'vehicle');
  hitTarget(t.hit, 'push', v()); assert.equal(hails.length, 0, 'a push does not hail a cab');
  hitTarget(t.hit, 'shoot', v()); assert.equal(hails.length, 1);
  hitTarget(aim(v(0, 2, 0), v(20, 2, -20)).hit, 'shoot', v());
  assert.deepEqual(plant, ['shoot']);
  tool.dispose();
  assert.equal(aim(v(0, 2, 0), v(20, 2, -20)).kind, 'none');
});

test('push: villagers stumble back a couple of metres and a parked hoverbike slides away', () => {
  clearTargets();
  const hadDoc = 'document' in globalThis;   // the speech balloon is a DOM element
  if (!hadDoc) globalThis.document = { createElement: () => ({ className: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } }), body: { appendChild() {} } };
  const scene = new THREE.Scene(), physics = new Physics(scene);
  const npc = new NPC(scene, physics, { route: [v(0, 0, -5)], palette: {}, lines: ['…'] });
  npc.pos.set(0, 0, -5);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, 6); camera.updateMatrixWorld();
  const walker = { pos: v(0, 0, 0), vel: v(), ride: null, riding: false, wind: v() };
  npc.update(DT, walker, camera);
  const from = npc.pos.clone();
  npc.hit('push', v(0, 0, -1), { strength: 1, shove: FLUID.push.shove });
  assert.ok(npc.time < npc.stumbleUntil, 'stumbling');
  assert.ok(npc.shout?.text, 'and says so');
  for (let i = 0; i < 60; i++) npc.update(DT, walker, camera);
  const moved = from.distanceTo(npc.pos);
  assert.ok(moved > 1.2 && moved < FLUID.push.shove + 0.3, `knocked back ${moved.toFixed(2)} m`);
  assert.ok(npc.pos.z < from.z - 1, 'away from the traveller');
  const n2 = new NPC(scene, physics, { route: [v(3, 0, -5)], palette: {}, lines: ['…'] });
  n2.hit('shoot', v(0, 0, -1), { colours: FLUID_TONES.slice(0, 2) });
  assert.ok(n2.shout?.text && n2.time >= n2.stumbleUntil, 'a glob startles, no stumble');

  // the mount
  const bike = { kind: 'bike', pos: v(0, 0, -4), speed: 0, yawRate: 0, heading: 0, get forward() { return [Math.sin(this.heading), Math.cos(this.heading)]; } };
  const rider = { ...stubPlayer(), mount: bike };
  const { tool } = makeTool({ player: rider });
  const hits = targetsInCone(v(0, 1.2, 0), v(0, 0, -1), FLUID.push.range, FLUID.push.angle);
  const h = hits.find((x) => x.target.kind === 'mount');
  assert.ok(h, 'the parked bike is in the cone');
  hitTarget(h, 'push', h.dir, { strength: 1 });
  assert.ok(bike.speed < -2, 'sliding away (backwards along its own axis)');
  rider.ride = bike;
  assert.equal(targetsInCone(v(0, 1.2, 0), v(0, 0, -1), FLUID.push.range, FLUID.push.angle).some((x) => x.target.kind === 'mount'), false, 'not while ridden');
  tool.dispose();
  if (!hadDoc) delete globalThis.document;
});
