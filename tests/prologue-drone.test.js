// Plumb in the prologue (issue #434): it wakes in its charging cradle after the landing and comes to the traveller's
// shoulder (the 'drone' beat), rides at his shoulder as he walks, not runs, down the ramp the first time, and is handed
// over to the scout where it is (game 'drone:out').
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { GameState, game as gameState } from '../src/game-state.js';
import { Ship, AUTO_WALK } from '../src/ship/ship.js';
import { Prologue, PROLOGUE_STAGES } from '../src/ship/prologue.js';
import { DOCK } from '../src/ship/interior.js';
import { WAKE, shoulderSpot, PrologueDrone } from '../src/ship/prologue-drone.js';
import { OPENING_BEATS } from '../engine/opening-beats.js';

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

test('the opening has the drone\'s beat: after the dust settles, before the hatch opens; the step out is a walk', () => {
  const ids = PROLOGUE_STAGES.map((s) => s.id);
  assert.equal(ids.indexOf('drone'), ids.indexOf('settle') + 1);
  assert.equal(ids.indexOf('hatch'), ids.indexOf('drone') + 1);
  const drone = PROLOGUE_STAGES.find((s) => s.id === 'drone');
  assert.ok(drone.dur >= WAKE.arrive + 0.5, 'long enough to arrive and be seen at his shoulder');
  assert.ok(PROLOGUE_STAGES.find((s) => s.id === 'stepout').dur >= 20, 'a walk down the ramp fits in the step out\'s safety net');
  // (the beats the engines compare it by: engine/opening-beats.js)
  for (const n of ['drone-wake', 'drone-lift', 'drone-shoulder', 'stepout-walk']) assert.ok(OPENING_BEATS.some((b) => b.name === n), n);
  assert.ok(AUTO_WALK > 0 && AUTO_WALK < 0.15);
  // the cradle stands in the cabin, on the port wall forward of the hatch, at chest height
  assert.ok(DOCK.shelf > 0.9 && DOCK.shelf < 1.6);
});

test('the prop: asleep in the cradle, then out of it and over to his shoulder; it keeps up as he walks', () => {
  const bot = new PrologueDrone(new THREE.Scene());
  const seat = v(0, 1.3, 0), feet = v(2, 0, 1), shoulder = shoulderSpot(feet, Math.PI, undefined, true);
  bot.dock(seat);
  assert.equal(bot.fold.eye, 0, 'its eye shut');
  const dt = 1 / 60;
  let t = 0;
  for (; t < WAKE.lift - 0.05; t += dt) bot.wake(t, dt, seat, shoulder, v(2, 1.6, -4));
  assert.ok(bot.position.distanceTo(seat) < 0.01, 'still in the cup before the lift');
  assert.ok(bot.fold.eye > 0.9 && bot.fold.petals > 0.5, 'awake and blooming');
  for (; t < WAKE.arrive + 0.5; t += dt) bot.wake(t, dt, seat, shoulder, v(2, 1.6, -4));
  assert.ok(bot.position.distanceTo(shoulder) < 0.05, 'at his shoulder');
  // he walks off at 1.5 m/s: it rides with him, never more than a metre behind
  const p = feet.clone();
  let worst = 0;
  for (let i = 0; i < 600; i++) {
    p.z -= 1.5 * dt;
    bot.follow(dt, shoulderSpot(p, Math.PI), p.clone().add(v(0, 1.4, -5)));
    if (i > 60) worst = Math.max(worst, bot.position.distanceTo(shoulderSpot(p, Math.PI)));
  }
  assert.ok(worst < 1, `keeps up (${worst.toFixed(2)} m)`);
});

test('the real director: the beat wakes it in the parked ship\'s cradle, he walks down the ramp, and it is handed over', async () => {
  const { PrologueDirector } = await import('../src/ship/cinematics.js');
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: v(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } }, prologue: true }));
  ship.site.crash ??= { travel: 0, length: 60 };
  ship.player = new Player(physics);
  ship.sound = {};
  ship.rig = { yaw: 0, pitch: 0.2, indoor: false, indoorK: 0, target: v(), clearYaw: (p, yaw) => yaw, snapTight() {} };
  const g = new GameState({ getItem: () => null, setItem: () => {} });
  const director = new PrologueDirector(ship);
  const prologue = new Prologue({ director, game: g });
  ship.cinematic = prologue;
  prologue.start();
  // (straight to the glide: the landing, the drone's beat, the hatch and the step out are what this is about)
  prologue.i = PROLOGUE_STAGES.findIndex((s) => s.id === 'glide') - 1;
  prologue.next();
  const dt = 1 / 30, P = ship.player, pk = ship.parked;
  const tick = () => { const ctl = ship.input({}); P.update(dt, ctl, 0); prologue.update(dt); };
  let t = 0;
  while (prologue.stage !== 'drone' && t < 30) { tick(); t += dt; }
  assert.equal(prologue.stage, 'drone');
  const seat = ship.world(pk, pk.interior.points.dock);
  assert.ok(director.bot.object.visible && director.bot.position.distanceTo(seat) < 0.05, 'asleep in its cradle as the beat begins');
  while (prologue.stage === 'drone') tick();
  const head = P.pos.clone().add(v(0, 1.6, 0));
  assert.ok(director.bot.position.distanceTo(head) < 1, `at his shoulder by the hatch (${director.bot.position.distanceTo(head).toFixed(2)} m from his head)`);
  // the step out: a walk, with the drone at his shoulder
  let out = null;
  const off = gameState.on('drone:out', (e) => { out = e; });
  while (prologue.stage !== 'stepout' && t < 60) { tick(); t += dt; }
  const speeds = [];
  let near = Infinity;
  for (let i = 0; i < 30 / dt && prologue.stage === 'stepout'; i++) {
    tick();
    const h = Math.hypot(P.vel.x, P.vel.z);
    if (i > 15 && ship.auto && P.onGround) speeds.push(h);   // (on his feet: in this bare test world the ramp ends in the air, and a drop is no gait)
    near = Math.min(near, director.bot.position.distanceTo(P.pos.clone().add(v(0, 1.6, 0))));
  }
  assert.ok(speeds.length > 30, 'he walked a while');
  const sorted = [...speeds].sort((a, b) => a - b), top = sorted[Math.floor(sorted.length * 0.9)], mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;   // (top: the 90th percentile; a landing's last momentum is no gait)
  assert.ok(top < 1.7 && mean > 1, `a walk, not a run: ${mean.toFixed(2)} m/s on average, ${top.toFixed(2)} at the 90th percentile`);
  assert.ok(near < 1.2, 'the drone rode with him');
  while (!prologue.done && t < 200) { tick(); t += dt; }
  off?.();
  assert.ok(prologue.done);
  assert.ok(out?.pos, 'handed over where it is');
  assert.ok(out.pos.distanceTo(P.pos) < 3, 'by him');
  assert.equal(director.bot.object.visible, false, 'the prologue\'s drone gone: the scout carries on');
});
