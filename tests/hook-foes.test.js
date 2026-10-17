// Issue #399: the grappling hook on a locked foe (src/hook-foes.js, src/gadgets/hook.js fireAtLock / catchFoe, the Foe's
// hookYank / hookPin / hookDown in src/foes.js, the routing of RT / R2 in src/gadgets/index.js). A class per foe in its
// data decides it: light ones are yanked to the traveller, heavy ones pinned, flyers pulled down, armoured ones clank it
// off; a cooldown between catches; a reach; a line of sight from the glove.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import hook from '../src/gadgets/hook.js';
import { registerGadget } from '../src/gadgets/registry.js';
import { Gadgets } from '../src/gadgets/index.js';
import { HOOK_FOE, HOOK_CLASSES, hookClass, hookOutcome, lockShot, yankTime, lockLesson } from '../src/hook-foes.js';
import { FOES, Foe } from '../src/foes.js';
import { Physics } from '../src/physics.js';
import { GameState } from '../src/game-state.js';

registerGadget(hook);
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;

function physicsOf(...meshes) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial()));
  for (const m of meshes) scene.add(m);
  return new Physics(scene);
}
function player(at = v()) {
  const frame = { up: v(0, 1, 0), fwd: v(0, 0, 1), right: v(1, 0, 0), dir: (h, out = v()) => out.set(Math.sin(h), 0, Math.cos(h)), headingOf: (d) => Math.atan2(d.x, d.z) };
  return { pos: at, vel: v(), heading: Math.PI, frame, object: { visible: true }, ride: null, onGround: true, opts: { climb: true }, stamina: 1, wallN: v(), aim: null, climbing: false, endJets() {} };
}
const hookCtx = (P, physics) => ({ player: P, physics, camera: null, tool: null, sound: null, world: null, hud: { reticle() {} }, sfx: { equip() {} }, fx: new THREE.Group(), aimAt() {} });
const env = (physics) => ({ ground: (x, y, z) => { const g = physics.groundAt?.(x, y, z, 6); return Number.isFinite(g) ? g : null; } });
/** A foe of `kind` d metres ahead of the traveller (−z), facing him, calm in the Arena's way (it comes for you). */
function foeAt(kind, d) { const f = new Foe(kind, v(0, 0, -d)); f.heading = 0; f.cool = 99; return f; }

/** Run the hook and the foe together (the foe's own mind as the game runs it, each frame). */
function run(H, f, P, ph, secs, each = null) {
  const E = env(ph);
  for (let t = 0; t < secs; t += DT) { H.update(DT); f.update(DT, P, E); each?.(t); }
}

test('every foe has a hook class in its data (light, heavy, flyer, armoured), and the rules follow from it, not from names', () => {
  for (const [k, D] of Object.entries(FOES)) assert.ok(HOOK_CLASSES.includes(D.hook), `${k}: hook class '${D.hook}'`);
  // (a few by their bodies: the small and light are yanked, the big and heavy pinned, the flyers pulled down)
  assert.equal(FOES.blot.hook, 'light'); assert.equal(FOES.skitter.hook, 'light');
  assert.equal(FOES.brute.hook, 'heavy'); assert.equal(FOES.machine.hook, 'heavy');
  assert.equal(FOES.ray.hook, 'flyer'); assert.equal(FOES.drone.hook, 'flyer');
  for (const [k, D] of Object.entries(FOES)) if (D.hover) assert.equal(D.hook, 'flyer', `${k} flies`);
  // a kind without a class is judged by its body
  assert.equal(hookClass({ hover: 2 }), 'flyer'); assert.equal(hookClass({ heavy: true }), 'heavy'); assert.equal(hookClass({}), 'light');
  // the outcome: by the class, and by the moment
  const out = (def, o = {}, dir = null) => hookOutcome({ alive: true, def, ...o }, dir);
  assert.equal(out({ hook: 'light' }), 'yank');
  assert.equal(out({ hook: 'heavy' }), 'pin');
  assert.equal(out({ hook: 'flyer' }), 'down');
  assert.equal(out({ hook: 'armoured' }), 'clank');
  assert.equal(out({ hook: 'heavy' }, { buried: true }), 'miss', 'under the sand: nothing to bite');
  assert.equal(out({ hook: 'light' }, { phased: true }), 'miss', 'a running shadow: it passes through');
  assert.equal(out({ hook: 'light' }, { rolling: true }), 'clank', 'rolled up');
  assert.equal(hookOutcome({ guardian: true, alive: true, def: { radius: 2 } }), 'shrug', 'a guardian shrugs it off');
  assert.equal(hookOutcome({ alive: false, def: { hook: 'light' } }), 'none');
  // a shell faced clanks it off; from behind, or on its back, the crab is pinned
  const crab = new Foe('crab', v(0, 0, -5)); crab.heading = 0;   // (facing +z: toward a traveller at the origin)
  assert.equal(hookOutcome(crab, v(0, 0, -1)), 'clank', 'its shell to the hook');
  crab.heading = Math.PI;
  assert.equal(hookOutcome(crab, v(0, 0, -1)), 'pin', 'its back to the hook');
  crab.heading = 0; crab.flipped = 1;
  assert.equal(hookOutcome(crab, v(0, 0, -1)), 'pin', 'on its back');
});

test('the throw: a cooldown, a reach, the world in the way', () => {
  assert.equal(lockShot({ d: 5 }), 'ok');
  assert.equal(lockShot({ d: 5, cool: 0.4 }), 'cool');
  assert.equal(lockShot({ d: HOOK_FOE.range + 0.5 }), 'far');
  assert.equal(lockShot({ d: 5, blocked: true }), 'blocked');
  assert.equal(lockShot({ d: NaN }), 'far');
  assert.ok(yankTime(1) >= 0.18 && yankTime(30) === HOOK_FOE.yank && yankTime(8) < HOOK_FOE.yank + 1e-9);
  assert.equal(lockLesson({}), 'hint.hop', 'the hops first');
  assert.equal(lockLesson({ taught: (k) => k === 'hint.hop', hook: true }), 'hint.hookLock', 'then the hook, once owned');
  assert.equal(lockLesson({ taught: (k) => k === 'hint.hop', hook: false }), null);
  assert.equal(lockLesson({ taught: () => true, hook: true }), null);
});

test('a light foe locked on is yanked to the traveller in an arc, lands in front of him dazed; a second throw waits for the cooldown', () => {
  const ph = physicsOf(), P = player(v()), H = hook.create(hookCtx(P, ph));
  const f = foeAt('blot', 9);
  assert.equal(H.fireAtLock(f), 'ok');
  assert.equal(H.state, 'out');
  let top = 0, caught = false;
  run(H, f, P, ph, 1.2, () => { top = Math.max(top, f.lift); caught ||= H.state === 'yank'; });
  assert.ok(caught, 'caught and yanked');
  assert.ok(top > 0.5, `an arc through the air (${top.toFixed(2)} m high)`);
  const d = Math.hypot(f.pos.x, f.pos.z);
  assert.ok(d > 1 && d < HOOK_FOE.before + f.def.radius + 0.4, `landed in front of him (${d.toFixed(2)} m)`);
  assert.ok(f.pos.z < 0, 'on his side of the line, not past him');
  assert.equal(f.lift, 0, 'on its feet');
  assert.ok(f.stunned > 0, 'dazed: set up for a cut (a cut lands double)');
  assert.ok(H.foeCool > 0, 'the cooldown runs');
  // too soon: a dry click, nothing thrown
  H.state = 'idle';
  assert.equal(H.fireAtLock(f), 'cool');
  assert.equal(H.state, 'idle');
  for (let t = 0; t < HOOK_FOE.cool + 0.1; t += DT) H.update(DT);
  assert.notEqual(H.fireAtLock(f), 'cool', 'ready again after HOOK_FOE.cool');
});

test('a heavy foe is pinned where it stands for HOOK_FOE.pin s, the rope taut, then free; a flyer is pulled down', () => {
  const ph = physicsOf(), P = player(v()), H = hook.create(hookCtx(P, ph));
  const f = foeAt('brute', 8);
  f.cool = 0;   // (it would strike if it could)
  H.fireAtLock(f);
  let pinnedAt = null, moved = 0, wound = false, held = 0;
  run(H, f, P, ph, 0.6 + HOOK_FOE.pin, () => {
    if (f.pin && !pinnedAt) pinnedAt = f.pos.clone();
    if (f.pin) { moved = Math.max(moved, f.pos.distanceTo(pinnedAt)); wound ||= f.state === 'wind' || f.state === 'strike'; held += DT; }
  });
  assert.ok(pinnedAt, 'pinned');
  assert.ok(moved < 1e-6, 'held in place');
  assert.ok(!wound, 'no blow while pinned');
  assert.ok(Math.abs(held - HOOK_FOE.pin) < 0.1, `held ${held.toFixed(2)} s`);
  run(H, f, P, ph, 0.3);
  assert.equal(f.pin, null, 'free again');
  assert.ok(H.state === 'back' || H.state === 'idle', 'the hook comes back');

  const Q = player(v()), R = hook.create(hookCtx(Q, ph));
  const ray = foeAt('ray', 7);
  const E = env(ph);
  for (let t = 0; t < 1; t += DT) ray.update(DT, Q, E);   // (up at its height)
  const high = ray.alt;
  assert.ok(high > 2);
  ray.cool = 99; ray.state = 'chase';
  R.fireAtLock(ray);
  run(R, ray, Q, ph, 0.6);
  assert.ok(ray.alt < high * 0.3, `pulled down (${high.toFixed(1)} → ${ray.alt.toFixed(1)} m)`);
  assert.ok(ray.stunned > 0, 'dazed on the ground');
});

test('the hook needs a clear line and a reach: a wall in the way takes it, a far foe is out of reach; armour clanks it off', () => {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.5).translate(0, 1, -4), new THREE.MeshBasicMaterial());
  const ph = physicsOf(wall), P = player(v()), H = hook.create(hookCtx(P, ph));
  const f = foeAt('blot', 8);
  assert.equal(H.fireAtLock(f), 'blocked');
  let touched = false;
  run(H, f, P, ph, 1, () => { touched ||= !!f.yank || f.stunned > 0; });
  assert.ok(!touched, 'untouched behind the wall');
  assert.equal(H.foeCool, 0, 'no cooldown for a throw that caught nothing');

  const open = physicsOf(), Q = player(v()), F = hook.create(hookCtx(Q, open));
  const far = foeAt('blot', HOOK_FOE.range + 4);
  assert.equal(F.fireAtLock(far), 'far');
  run(F, far, Q, open, 1.5);
  assert.ok(!far.yank && far.pos.z < -HOOK_FOE.range, 'out of reach');

  const B = hook.create(hookCtx(Q, open)), bell = foeAt('bell', 7);
  B.fireAtLock(bell);
  let out = null; const catchFoe = B.catchFoe.bind(B); B.catchFoe = (x) => (out = catchFoe(x));
  run(B, bell, Q, open, 1);
  assert.equal(out, 'clank', 'the bronze rings it off');
  assert.ok(!bell.pin && !bell.yank);
});

test('RT / R2 locked on throws the hook at the lock: the hook in hand, or nothing in hand; another gadget keeps RT', () => {
  const game = new GameState(null);
  const its = { has: (id) => !!game.flag(`item.${id}`), grant(id) { game.set(`item.${id}`, true); }, on() { return () => {}; } };
  const log = [];
  const spy = (id) => ({ id, name: id, text: '', trigger: 'aim', model: () => new THREE.Group(),
    create: () => ({ press: () => log.push(`${id} press`), release: () => log.push(`${id} release`), lower() {}, cancel() {}, fireAtLock: id === 'hook' ? (L) => log.push(`hook at ${L.id}`) : undefined }) });
  const foes = { lock: null, list: [], on: false };
  const G = new Gadgets({ defs: [spy('hook'), spy('bomb')], scene: new THREE.Scene(), physics: physicsOf(), player: player(), game, items: its, foes });
  its.grant('hook'); its.grant('bomb');
  const tap = (k) => { G.control(DT, { [k]: true }); G.control(DT, {}); };
  G.equip('hook', { quiet: true });
  tap('PadFire');
  assert.deepEqual(log.splice(0), ['hook press', 'hook release'], 'not locked: a quick throw where the camera looks');
  foes.lock = { id: 'blot', alive: true };
  tap('PadFire');
  assert.deepEqual(log.splice(0), ['hook at blot'], 'locked: at the foe');
  G.equip(null);
  tap('PadFire');
  assert.deepEqual(log.splice(0), ['hook at blot'], 'nothing in hand: the hook all the same');
  G.equip('bomb', { quiet: true });
  tap('PadFire');
  assert.deepEqual(log.splice(0), ['bomb press', 'bomb release'], 'the bombs keep RT');
  G.equip('hook', { quiet: true });
  G.control(DT, { PadAim: true }); G.control(DT, { PadAim: true, PadFire: true }); G.control(DT, {});
  assert.deepEqual(log.splice(0), ['hook press', 'hook release'], 'LT aimed: the free throw');
});
