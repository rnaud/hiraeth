import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foe, Foes, FOES, PRESSURE, BURROW, FLICK, KNOCKED_LOW } from '../src/foes.js';
import { closeInSpeed, MAGNET, BLADE, RISE, riseTo } from '../src/fluid-blade.js';
import { GRAVITY } from '../src/player.js';
import { feelDt, slowMo, hitStop, resetFeel } from '../src/feel.js';
import { reticleLook, chevronSpread, RETICLE } from '../src/lock-reticle.js';
import { clearTargets, registerTarget } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { FluidTool } from '../src/fluid-tool.js';
import { items } from '../src/items.js';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';

// How the fight feels and reads (docs/systems/foes.md, "Staying in the fight", "The lock-on"): foes press you rather
// than run, the lock reads the foe, the blade meets you halfway.

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const env = { ground: () => 0, seen: () => true };
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const player = (at = v(), o = {}) => ({ pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {}, ...o });
const runFor = (f, P, secs, e = env) => { const ev = []; for (let i = 0; i < secs / DT; i++) ev.push(...f.update(DT, P, e)); return ev; };

test('knocked down, the foes wait round you (no going home), and come on again as you rise', () => {
  const f = new Foe('blot', v(), { rng: () => 0.5 }), P = player(v(0, 0, 6));
  runFor(f, P, 0.2);
  assert.equal(f.state, 'chase');
  P.down = { t: 1 };
  const ev = runFor(f, P, 2);
  assert.ok(!ev.includes('home') && f.state === 'chase', 'it stays in the fight');
  assert.ok(Math.abs(f.pos.distanceTo(P.pos) - (FOES.blot.reach + PRESSURE.hold)) < 0.6, 'holding a step off, round you');
  assert.ok(!ev.some((e) => e === 'warn'), 'and never strikes you on the ground');
  P.down = null;
  assert.ok(runFor(f, P, 4).includes('warn'), 'up again: it comes on');
});

test('led past its leash it stays while you are still fighting there; it goes home once you leave too', () => {
  const f = new Foe('machine', v(), { rng: () => 0.5 }), P = player(v(0, 0, 4));
  runFor(f, P, 0.2);
  // you stand just past its leash from home, and it is out there with you
  f.pos.set(0, 0, FOES.machine.giveUp + 1); P.pos.set(0, 0, FOES.machine.giveUp + 3);
  assert.ok(!runFor(f, P, 0.5).includes('home'), 'you are still there: it fights on');
  P.pos.set(0, 0, FOES.machine.giveUp + PRESSURE.leave + 6); f.pos.set(0, 0, FOES.machine.giveUp + PRESSURE.leave + 3); f.state = 'chase'; f.cool = 99;
  assert.ok(runFor(f, P, 0.5).includes('home'), 'you left: home it goes');
});

test('a spitter backs off a step, then stands its ground and fights instead of running from you', () => {
  const s = new Foe('spitter', v(0, 0, 0), { rng: () => 0.5 }), P = player(v(0, 0, 3));
  s.cool = 99;   // (no strike yet: only the backing off)
  runFor(s, P, PRESSURE.retreat + 0.1);
  const after = s.pos.distanceTo(P.pos);
  assert.ok(after > 3.5, 'it backed off');
  runFor(s, P, 2);
  assert.ok(Math.abs(s.pos.distanceTo(P.pos) - after) < 0.05, 'then held its ground');
  s.cool = 0;
  let warned = false; for (let i = 0; i < 3 / DT && !warned; i++) warned = s.update(DT, P, env).includes('warn');
  assert.ok(warned, 'and struck from there');
  assert.equal(s.retreat, PRESSURE.retreat, 'striking let it back off again after');
});

test('a foe off the screen waits its turn while one you can see is striking', () => {
  clearTargets();
  const P = player(v());
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  camera.position.set(0, 2, -4); camera.lookAt(0, 1, 4); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), camera });
  foes.waveRest = 1e9;
  const seen = foes.add('blot', v(0, 0, 2)), behind = foes.add('blot', v(0, 0, -8));
  assert.ok(foes.onScreen(seen) && !foes.onScreen(behind));
  assert.ok(foes.env.mayStrike(behind), 'nobody striking: it may');
  seen.state = 'wind';
  assert.equal(foes.env.mayStrike(behind), false, 'one in view is striking: the one behind waits');
  const beside = foes.add('blot', v(1, 0, 3));
  assert.ok(foes.env.mayStrike(beside), 'another in view may still take the second turn');
  foes.dispose(); clearTargets();
});

test('the dune ray: a cut at its fin flushes it; up, it stays up to fight for a while', () => {
  const r = new Foe('ray', v(), { rng: () => 0.5 });
  assert.equal(r.buried, true);
  assert.equal(r.hit('blade', v(0, 0, 1), { damage: 1 }), 'flushed');
  assert.ok(!r.buried && r.upFor === BURROW.up && r.stunned === BURROW.flush);
});

test('the lock: cut down, it moves on to the next foe in reach; the reticle reads the foe', () => {
  clearTargets();
  const P = player(v());
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });
  foes.waveRest = 1e9;
  const a = foes.add('blot', v(0, 0, 3)), b = foes.add('blot', v(0, 0, 6)), far = foes.add('blot', v(0, 0, 40));
  assert.equal(foes.cycleLock(), a);
  a.hit('blade', v(0, 0, 1), { damage: 9 }); foes.burst(a);
  foes.updateLock();
  assert.equal(foes.lock, b, 'on to the next');
  b.hit('blade', v(0, 0, 1), { damage: 9 }); foes.burst(b);
  foes.updateLock();
  assert.equal(foes.lock, null, 'none left in reach: it lets go');
  assert.ok(far.alive);
  // what the reticle shows
  const f = new Foe('machine', v());
  assert.equal(reticleLook(f).mode, 'calm');
  f.state = 'wind'; f.k = 0.5;
  assert.equal(reticleLook(f).mode, 'wind');
  assert.ok(chevronSpread(reticleLook(f)) < 1, 'winding up: the chevrons close in');
  f.k = 1; assert.ok(Math.abs(chevronSpread(reticleLook(f)) - RETICLE.close) < 1e-6, 'and meet at the strike');
  f.staggered(true);
  assert.equal(reticleLook(f).mode, 'open', 'parried: open');
  assert.ok(chevronSpread(reticleLook(f)) > 1.1);
  const ray = new Foe('ray', v());
  assert.equal(reticleLook(ray).mode, 'veiled', 'under the sand: dimmed');
  f.hp = 2; assert.deepEqual([reticleLook(f).hp, reticleLook(f).max], [2, FOES.machine.hp]);
  resetFeel();
  foes.dispose(); clearTargets();
});

test('feel: the last foe of a fight falls in slow motion, then the world runs at full speed again', () => {
  resetFeel();
  slowMo(0.3, 0.25);
  assert.ok(Math.abs(feelDt(0.01) - 0.0025) < 1e-6, 'slowed');
  for (let i = 0; i < 40; i++) feelDt(0.01);
  assert.equal(feelDt(0.01), 0.01, 'and back');
  hitStop(0.05); slowMo(0.3);
  assert.ok(feelDt(0.01) < 1e-4, 'a hit-stop comes first');
  resetFeel();
});

test('the cut meets you halfway: a foe just out of reach is stepped to, one in reach or far off is not', () => {
  const time = 0.38;
  assert.equal(closeInSpeed(1.5, 0.6, time), 0, 'in reach');
  assert.ok(closeInSpeed(3, 0.6, time) > 0, 'a little out: stepped in');
  assert.ok(Math.abs(closeInSpeed(3, 0.6, time) * time - (3 - 0.6 - MAGNET.ideal)) < 1e-9, 'to stand MAGNET.ideal off its body');
  assert.equal(closeInSpeed(0.6 + MAGNET.ideal + MAGNET.max + 0.1, 0.6, time), 0, 'too far: no flying across the field');
});

test('a press during an evade is kept, and the blade swings as the evade ends', async () => {
  clearTargets();
  items.grant('backpack');
  const scene = course(), p = await traveller(scene, v(0, 0, -60), { moves: true, body: 'v1' });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, -65); camera.lookAt(0, 1, -55); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const tick = (input = {}) => { p.update(DT, input, CAM_PLUS_Z); tool.update(DT, input); };
  for (let i = 0; i < 5; i++) tick({});
  tick({ AltLeft: true });
  assert.ok(tool.blade.evadeT > 0, 'evading');
  for (let i = 0; i < 6; i++) tick({});
  tick({ KeyF: true });   // (pressed inside the evade's last BLADE.buffer)
  assert.equal(tool.blade.swinging, false, 'not while it evades');
  let swung = false;
  for (let i = 0; i < 20 && !swung; i++) { tick({}); swung = tool.blade.swinging; }
  assert.ok(swung, 'it swings as soon as the evade is over');
  assert.ok(BLADE.buffer > 0.1);
  tool.dispose(); clearTargets();
});

const arena = (P, o = {}) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), ...o });

test('locked on, a quick flick of the look switches to the nearest foe that way; a slow push does not', () => {
  clearTargets();
  const P = player(v()), foes = arena(P);
  foes.waveRest = 1e9;
  // ahead of the traveller (+z): one straight on, one a little to the right (−x seen from behind), one far right, one left
  const mid = foes.add('blot', v(0, 0, 6)), right = foes.add('blot', v(-2, 0, 6)), farRight = foes.add('blot', v(-6, 0, 5)), left = foes.add('blot', v(3, 0, 6));
  foes.lock = mid;
  const name = (f) => ({ [mid.id]: 'mid', [right.id]: 'right', [farRight.id]: 'farRight', [left.id]: 'left' })[f?.id] ?? String(f?.id);
  [mid, right, farRight, left].forEach((f, i) => { f.id = `f${i}`; });
  let t = 0;
  for (let i = 0; i < 120; i++) foes.flickLook(4, (t += DT));   // (a third of the stick's tilt, held two seconds)
  assert.equal(name(foes.lock), name(mid), 'a slow push: no switch');
  for (let i = 0; i < 8; i++) foes.flickLook(15, (t += DT));     // (full tilt, a flick)
  assert.equal(name(foes.lock), name(right), 'a flick right: the nearest on the right');
  foes.flickLook(200, (t += DT));
  assert.equal(name(foes.lock), name(right), 'resting a moment after a switch');
  t += FLICK.rest;
  foes.flickLook(200, (t += DT));
  assert.equal(name(foes.lock), name(farRight), 'then on again');
  foes.flickLook(200, (t += FLICK.rest + DT));
  assert.equal(name(foes.lock), name(farRight), 'none further: it stays');
  foes.flickLook(-200, (t += FLICK.rest + DT));
  assert.equal(name(foes.lock), name(right), 'and back left');
  assert.equal(foes.flickLook(5), true, 'locked: the sideways look is the lock\'s');
  foes.lock = null;
  assert.equal(foes.flickLook(5), false, 'not locked: the camera turns as ever');
  assert.ok(left.alive);
  foes.dispose(); clearTargets();
});

test('a cut that lands and does not stop a foe is answered with its armour: a thunk, sparks, a note once', () => {
  clearTargets();
  const P = player(v()), notes = [], sounds = [];
  const foes = arena(P, { notice: (t) => notes.push(t), sound: { foeArmour: () => sounds.push('armour'), foeHurt: () => sounds.push('hurt') } });
  foes.waveRest = 1e9;
  const m = foes.add('machine', v(0, 0, 2));
  m.state = 'chase';
  foes.hurt(m, 'blade', v(0, 0, 1), { damage: 1 });
  assert.ok(m.shrugged && sounds.at(-1) === 'armour' && notes.length === 1, 'a heavy foe shrugs off a light cut');
  foes.hurt(m, 'blade', v(0, 0, 1), { damage: 1 });
  assert.equal(notes.length, 1, 'said once');
  m.state = 'wind'; m.k = 0.3;
  foes.hurt(m, 'blade', v(0, 0, 1), { damage: 1 });
  assert.ok(!m.shrugged && m.state === 'recover' && sounds.at(-1) === 'hurt', 'cut early in its wind-up: it reels');
  m.state = 'chase'; m.hp = 4;
  foes.hurt(m, 'stun', v(0, 0, 1));
  assert.equal(m.shrugged, false, 'stilling is no cut');
  const b = foes.add('blot', v(0, 0, 3)); b.state = 'strike';
  foes.hurt(b, 'blade', v(0, 0, 1), { damage: 1 });
  assert.ok(!b.shrugged, 'a blot always flinches');
  const s = foes.add('shade', v(0, 0, 3)); s.state = 'strike';
  foes.hurt(s, 'blade', v(0, 0, 1), { damage: 1 });
  assert.ok(s.shrugged, 'one committed to its strike comes on through the cut');
  foes.dispose(); clearTargets();
});

test('a hovering foe the blade cuts drops within reach a while', () => {
  const f = new Foe('flyer', v(), { rng: () => 0.5 }), P = player(v(0, 0, 12));
  runFor(f, P, 1);
  assert.ok(f.alt > 3);
  f.hit('blade', v(0, 0, 1), { damage: 1 });
  assert.equal(f.low, KNOCKED_LOW);
  runFor(f, P, 0.6);
  assert.ok(f.alt < 0.8, `knocked low (${f.alt.toFixed(2)})`);
  runFor(f, P, KNOCKED_LOW + 1.5);
  assert.ok(f.alt > 2, 'then up again');
});

test('the rising cut: a swing from the ground at a foe hovering over you leaps up to it and cuts it', async () => {
  assert.equal(RISE.gravity, GRAVITY, 'the leap uses the traveller\'s gravity');
  assert.equal(riseTo(0.4, 2, 0.4), null, 'level: no leap');
  assert.equal(riseTo(2, RISE.flat + 1, 0.4), null, 'too far off');
  const r = riseTo(2, 3, 0.4);
  assert.ok(Math.abs(r.up ** 2 / (2 * GRAVITY) - 2) < 1e-9 && r.speed > 0, 'up to its height');
  assert.ok(riseTo(9, 2, 0.4).up ** 2 / (2 * GRAVITY) <= RISE.max + 1e-9, 'never past RISE.max');
  clearTargets();
  items.grant('backpack');
  const scene = course(), p = await traveller(scene, v(0, 0, -60), { moves: true, body: 'v1' });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, -65); camera.lookAt(0, 1, -55); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const tick = (input = {}) => { p.update(DT, input, CAM_PLUS_Z); tool.update(DT, input); };
  for (let i = 0; i < 10; i++) tick({});
  const at = p.pos.clone().add(v(0, 4.1, 2.6));   // (a winged blot's chest, hovering)
  let hits = 0;
  registerTarget({ kind: 'foe', lock: true, radius: 0.75, accepts: ['blade'], position: () => at, onHit: () => hits++ });
  const y0 = p.pos.y;
  tick({ KeyF: true });
  let top = 0;
  for (let i = 0; i < 60; i++) { tick({}); top = Math.max(top, p.pos.y - y0); }
  assert.ok(top > 1.5, `it leapt (${top.toFixed(2)} m)`);
  assert.equal(hits, 1, 'and the cut found it');
  tool.dispose(); clearTargets();
});
