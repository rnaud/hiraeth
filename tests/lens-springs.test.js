import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { registerGadget, GADGETS } from '../src/gadgets/registry.js';
import hook from '../src/gadgets/hook.js';
import bomb from '../src/gadgets/bomb.js';
import monocle, { LENS, MARK, lensMeter, lensRaise, revealAt, lensMarks, ghostGrace } from '../src/gadgets/lens.js';
import springs, { SPRING, BOUNCE, STOMP, launchHeight, launchVelocity, timeToLand, airPress, coilWobble } from '../src/gadgets/springs.js';
import { HIDDEN, revealable, ghostPath, ghostBridge, hiddenWriting, buried, hiddenIn, unearth, riseHeight } from '../src/gadgets/hidden.js';
import { GadgetWorld } from '../src/gadgets/world.js';
import { Physics } from '../src/physics.js';
import { clearTargets, registerTarget } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { Foe } from '../src/foes.js';
import { createPost } from '../src/post.js';
import { ITEMS } from '../src/items.js';

registerGadget(hook); registerGadget(bomb); registerGadget(monocle); registerGadget(springs);
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = v(0, 1, 0);
const DT = 1 / 60;

function sceneWithGround() {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial()));
  return scene;
}
function player(at = v()) {
  const frame = { up: v(0, 1, 0), dir: (h, out = v()) => out.set(Math.sin(h), 0, Math.cos(h)), headingOf: (d) => Math.atan2(d.x, d.z) };
  return { pos: at, vel: v(), heading: 0, frame, object: { visible: true }, ride: null, onGround: true, climbing: false, health: 1 };
}
/** The traveller's own step, as player.js does it on flat ground: gravity, the ground; a landing faster than the guard allows is a knock-down. */
function step(P, dt = DT) {
  P.vel.y -= 32 * dt;
  P.pos.addScaledVector(P.vel, dt);
  P._groundH = P.pos.y;
  if (P.pos.y <= 0) {
    if (!P.onGround && -P.vel.y > 32 * (P.fallGuard ?? 1)) P.knocked = (P.knocked ?? 0) + 1;
    P.pos.y = 0; P.vel.y = 0; P.onGround = true; P._groundH = 0;
  } else P.onGround = false;
}
const ctxOf = (P, physics, extra = {}) => ({ player: P, physics, camera: null, tool: null, sound: null, world: null, fx: new THREE.Group(), sfx: { equip() {} }, aimAt() {}, game: new GameState(null), ...extra });

// ------------------------------------------------------------------ registry

test('the seeing lens and the spring boots are gadgets (items with models), in the yard after the hook and the bombs', () => {
  const ids = GADGETS.map((g) => g.id);
  assert.ok(ids.indexOf('monocle') > ids.indexOf('bomb') && ids.indexOf('springs') > ids.indexOf('monocle'));
  for (const id of ['monocle', 'springs']) {
    assert.equal(ITEMS[id].kind, 'gadget');
    assert.ok(/RT \/ R2|LT \/ L2/.test(ITEMS[id].use));
  }
  assert.equal(ITEMS.lens.kind, 'charm', 'the old glyph-lens charm is still its own item');
});

// ------------------------------------------------------------------ the lens

test('the lens: its meter drains while up and comes back after a moment down; the raise eases both ways', () => {
  let s = { meter: 1, idle: 0 };
  for (let t = 0; t < 7; t += DT) s = lensMeter(s.meter, s.idle, DT, true);
  assert.ok(Math.abs(s.meter - (1 - 7 * LENS.drain)) < 0.01, `half gone in 7 s: ${s.meter}`);
  const low = s.meter;
  s = lensMeter(s.meter, 0, LENS.wait * 0.5, false);
  assert.equal(s.meter, low, 'nothing back at once');
  for (let t = 0; t < 10; t += DT) s = lensMeter(s.meter, s.idle, DT, false);
  assert.equal(s.meter, 1, 'clear again');
  let k = 0;
  for (let i = 0; i < 50; i++) k = lensRaise(k, true, DT);
  assert.equal(k, 1);
  for (let i = 0; i < 60; i++) k = lensRaise(k, false, DT);
  assert.equal(k, 0);
});

test('what the lens shows: a ghost path only up (and solid past halfway), a false floor only down, a buried cache once unearthed', () => {
  const path = { solidWhenSeen: true, kind: 'path' }, ill = { illusion: true, kind: 'illusion' }, cache = { kind: 'buried', unearthed: false };
  assert.deepEqual(revealAt(path, 0), { shown: false, solid: false });
  assert.deepEqual(revealAt(path, LENS.see), { shown: true, solid: false });
  assert.deepEqual(revealAt(path, 1), { shown: true, solid: true });
  assert.deepEqual(revealAt(ill, 0), { shown: true, solid: false });
  assert.deepEqual(revealAt(ill, 1), { shown: false, solid: false });
  assert.equal(revealAt(cache, 1).solid, false);
  assert.equal(revealAt({ ...cache, unearthed: true }, 0).shown, true);
});

test('revealable: hidden, kept out of the baked collision; the lens adopts only those in its own scene', () => {
  const scene = sceneWithGround(), other = new THREE.Scene();
  const n0 = HIDDEN.length;
  const e = ghostBridge(scene, v(-4, 3, 0), v(4, 3, 0));
  const f = ghostPath(other, [[0, 1, 0], [0, 1, 2]]);
  assert.equal(HIDDEN.length, n0 + 2);
  assert.equal(e.object.visible, false);
  e.object.traverse((m) => assert.ok(m.userData.noCollide));
  assert.ok(hiddenIn(scene).includes(e) && !hiddenIn(scene).includes(f));
  const ph = new Physics(scene);
  assert.equal(ph.groundAt(0, 10, 0), 0, 'not in the collision: the ground under it');
});

test('a ghost bridge holds you up only while the lens is up; a false floor is never solid and goes under the lens', () => {
  const scene = sceneWithGround();
  const e = ghostBridge(scene, v(-4, 3, 0), v(4, 3, 0), { sag: 0 });
  const fake = ghostPath(scene, [[0, 2, 6]], { illusion: true });
  const ph = new Physics(scene);
  const P = player(v(0, 3, 9));   // (beside it, not on it: lowered, it goes at once)
  const L = monocle.create(ctxOf(P, ph, { scene }));
  L.update(DT);
  assert.equal(e.object.visible, false); assert.equal(fake.object.visible, true);
  L.press();
  for (let i = 0; i < 20; i++) L.update(DT);
  assert.ok(L.k > 0.95);
  assert.equal(e.object.visible, true); assert.equal(fake.object.visible, false);
  assert.ok(Math.abs(ph.groundAt(0, 10, 0) - 3) < 0.05, 'stood on: the bridge');
  assert.equal(ph.groundAt(0, 10, 6), 0, 'the false floor: nothing');
  L.release();
  for (let i = 0; i < 40; i++) L.update(DT);
  assert.equal(e.object.visible, false);
  assert.equal(ph.groundAt(0, 10, 0), 0, 'lowered: gone again');
  // up again: the same collider back
  L.press(); for (let i = 0; i < 20; i++) L.update(DT);
  assert.ok(Math.abs(ph.groundAt(0, 10, 0) - 3) < 0.05);
  L.dispose();
  assert.equal(ph.groundAt(0, 10, 0), 0);
});

test('lowered while you stand on a ghost bridge, it holds LENS.grace s, flickering, then goes; raised again in time it stays', () => {
  const scene = sceneWithGround();
  const e = ghostBridge(scene, v(-4, 3, 0), v(4, 3, 0), { sag: 0 });
  const ph = new Physics(scene);
  const P = player(v(0, 3, 0)), notes = [];
  const L = monocle.create(ctxOf(P, ph, { scene, notice: (t) => notes.push(t) }));
  L.press(); for (let i = 0; i < 20; i++) L.update(DT);
  assert.ok(Math.abs(ph.groundAt(0, 10, 0) - 3) < 0.05, 'up: stood on');
  L.release();
  for (let t = 0; t < LENS.grace - 0.2; t += DT) L.update(DT);
  assert.ok(Math.abs(ph.groundAt(0, 10, 0) - 3) < 0.05, 'still holding you');
  assert.ok(notes.some((n) => n.includes('fades')), 'a warning');
  for (let t = 0; t < 0.4; t += DT) L.update(DT);
  assert.equal(ph.groundAt(0, 10, 0), 0, 'then gone: you fall');
  assert.equal(e.object.visible, false);
  // up again on it, lowered, raised again within the grace: it never goes
  L.idle = 0; L.meter = 1;
  L.press(); for (let i = 0; i < 20; i++) L.update(DT);
  L.release(); for (let t = 0; t < 0.8; t += DT) L.update(DT);
  L.press(); for (let i = 0; i < 30; i++) { L.update(DT); assert.ok(Math.abs(ph.groundAt(0, 10, 0) - 3) < 0.05); }
  assert.equal(e.grace ?? null, null, 'the grace is over: up again');
  L.dispose();
});

test('ghostGrace: starts only under you, runs down, ends when you step off or the glass is up', () => {
  assert.deepEqual(ghostGrace(null, { solidNow: true, wasSolid: true, standing: true, dt: 0.1 }), { grace: null, solid: true });
  assert.deepEqual(ghostGrace(null, { solidNow: false, wasSolid: true, standing: false, dt: 0.1 }), { grace: null, solid: false });
  const g = ghostGrace(null, { solidNow: false, wasSolid: true, standing: true, dt: 0.1 });
  assert.ok(g.solid && Math.abs(g.grace - (LENS.grace - 0.1)) < 1e-9);
  assert.deepEqual(ghostGrace(g.grace, { solidNow: false, wasSolid: true, standing: false, dt: 0.1 }), { grace: null, solid: false }, 'stepped off');
  assert.deepEqual(ghostGrace(0.05, { solidNow: false, wasSolid: true, standing: true, dt: 0.1 }), { grace: null, solid: false }, 'run out');
  assert.deepEqual(ghostGrace(null, { solidNow: false, wasSolid: false, standing: true, dt: 0.1 }), { grace: null, solid: false }, 'never up: nothing to hold');
});

test('a conversation or a scene (paused) brings the glass down and its view off the composite', () => {
  const post = { uLens: { value: new THREE.Vector4() }, uLensMarks: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) } };
  const L = monocle.create(ctxOf(player(), new Physics(sceneWithGround()), { post }));
  L.press(); for (let i = 0; i < 20; i++) L.update(DT);
  assert.ok(post.uLens.value.x > 0.95);
  for (let i = 0; i < 60; i++) L.update(DT, true);
  assert.equal(L.up, false);
  assert.equal(post.uLens.value.x, 0, 'the post step off');
  assert.equal(L.held.visible, false);
});

test('the lens clouds over: it lowers itself when the meter is empty and will not rise again until it has cleared a little', () => {
  const P = player(), notes = [];
  const L = monocle.create(ctxOf(P, new Physics(sceneWithGround()), { notice: (t) => notes.push(t) }));
  L.press();
  let t = 0;
  while (L.up && t < 30) { L.update(DT); t += DT; }
  assert.ok(Math.abs(t - 1 / LENS.drain) < 0.2, `up for ${t.toFixed(1)} s`);
  assert.ok(notes.some((n) => n.includes('clouded')));
  L.press();
  assert.equal(L.up, false, 'still clouded');
  for (let i = 0; i < 4 * 60; i++) L.update(DT);
  L.press();
  assert.equal(L.up, true);
  assert.equal(L.hud().max, LENS.pips);
});

test('writing for the glass is read once, when seen up close and looked at', () => {
  const scene = sceneWithGround();
  const w = hiddenWriting(scene, v(0, 1.5, -6), 0, 'HELLO', { id: 'test.words', message: 'Words: hello.' });
  const ph = new Physics(scene);
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  cam.position.set(0, 1.6, 2); cam.lookAt(0, 1.5, -6); cam.updateMatrixWorld();
  const notes = [], ctx = ctxOf(player(v(0, 0, 2)), ph, { scene, camera: cam, notice: (t) => notes.push(t) });
  const L = monocle.create(ctx);
  L.update(DT);
  assert.equal(notes.length, 0, 'not without the glass');
  L.press(); for (let i = 0; i < 30; i++) L.update(DT);
  assert.deepEqual(notes, ['Words: hello.']);
  assert.equal(ctx.game.flag('lens.read.test.words'), true);
  for (let i = 0; i < 30; i++) L.update(DT);
  assert.equal(notes.length, 1, 'once');
  assert.ok(w.object.visible);
});

test('the glass marks what it finds on the screen: nearest first, never behind, at most eight', () => {
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  cam.position.set(0, 0, 0); cam.lookAt(0, 0, -1); cam.updateMatrixWorld();
  const cands = [{ pos: v(0, 0, -10), kind: MARK.find }, { pos: v(0, 0, 10), kind: MARK.find }, { pos: v(2, 0, -4), kind: MARK.weak }];
  for (let i = 0; i < 12; i++) cands.push({ pos: v(0, 1, -20 - i), kind: MARK.writing });
  const m = lensMarks(cands, cam);
  assert.equal(m.length, LENS.marks);
  assert.equal(m[0].kind, MARK.weak, 'the nearest first');
  assert.ok(m[0].x > 0.5 && Math.abs(m[0].y - 0.5) < 1e-6);
  assert.ok(Math.abs(m[1].x - 0.5) < 1e-6 && Math.abs(m[1].y - 0.5) < 1e-6, 'straight ahead in the middle');
  assert.ok(!m.some((x) => x.d > 5 && x.d < 15 && x.y === 0.5 && x.kind === MARK.find && x.x !== 0.5));
  assert.ok(m.every((x) => x.size >= 0.014 && x.size <= 0.075));
  assert.ok(m[0].size > m[7].size, 'nearer, larger');
});

test('seen through the lens, a foe is exposed: a cut there bites twice as deep, for a moment after', () => {
  const f = new Foe('blot', v(0, 0, -5), { rng: () => 0.5 });
  const hp = f.hp;
  f.hit('blade', v(0, 0, -1), { damage: 1 });
  const plain = hp - f.hp;
  const g = new Foe('blot', v(0, 0, -5), { rng: () => 0.5 });
  const P = player(v(0, 0, 0));
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500); cam.lookAt(0, 0, -1); cam.updateMatrixWorld();
  const L = monocle.create(ctxOf(P, new Physics(sceneWithGround()), { foes: { list: [g] }, camera: cam, post: createPost().uniforms }));
  L.press(); for (let i = 0; i < 20; i++) L.update(DT);
  assert.ok(g.exposed > 0, 'exposed');
  assert.ok(L.marks.some((m) => m.kind === MARK.weak), 'its weak point marked');
  g.hit('blade', v(0, 0, -1), { damage: 1 });
  assert.equal(hp - g.hp, plain * 2);
  L.release(); for (let i = 0; i < 2 * 60; i++) L.update(DT);
  assert.equal(g.exposed, 0, 'not for long');
});

test('the composite draws the lens only while it is up (a uniform branch, off by default)', () => {
  const post = createPost();
  assert.equal(post.uniforms.uLens.value.x, 0);
  assert.equal(post.uniforms.uLensMarks.value.length, LENS.marks);
  const src = readFileSync(new URL('../src/post.js', import.meta.url), 'utf8');
  assert.match(src, /if \(uLens\.x > 0\.0\) \{/);
  const P = player(), U = post.uniforms;
  const L = monocle.create(ctxOf(P, null, { post: U, camera: new THREE.PerspectiveCamera() }));
  L.press(); for (let i = 0; i < 10; i++) L.update(DT);
  assert.ok(U.uLens.value.x > 0.5 && U.uLens.value.y === LENS.radius);
  L.release(); for (let i = 0; i < 60; i++) L.update(DT);
  assert.equal(U.uLens.value.x, 0, 'off again: nothing drawn');
});

test('a buried cache: hidden under its spot, marked, and brought up by a stomp near it', () => {
  const scene = sceneWithGround(), obj = new THREE.Group();
  scene.add(obj);
  const e = buried(obj, v(3, 0.3, 3), { id: 'test.cache' });
  assert.equal(obj.visible, false);
  assert.ok(obj.position.y < 0);
  assert.equal(unearth([e], v(10, 0, 10)).length, 0, 'too far');
  assert.equal(unearth([e], v(3.5, 0, 3)).length, 1);
  assert.ok(e.unearthed && obj.visible);
  assert.ok(Math.abs(riseHeight(1, e.depth)) < 1e-9 && riseHeight(0, e.depth) === -e.depth);
});

// ------------------------------------------------------------------ the spring boots

test('spring boots: a full wind springs 14 m, a tap a hop; a bounce goes higher; the forward arc is lower and goes along', () => {
  assert.ok(launchHeight(1) >= 14 && launchHeight(1) < 15);
  assert.ok(launchHeight(0) < 3);
  assert.ok(launchHeight(1, 1) > launchHeight(1) && launchHeight(1, 3) === launchHeight(1, 9), 'up to three bounces');
  const up = launchVelocity(1, null, UP);
  assert.ok(Math.abs(up.y ** 2 / 64 - launchHeight(1)) < 1e-6 && up.x === 0 && up.z === 0, 'straight up: v² = 2 g h');
  const fw = launchVelocity(1, v(0, 0, -1), UP);
  assert.ok(fw.z < -8 && fw.y < up.y && Math.abs(fw.y ** 2 / 64 - launchHeight(1) * SPRING.arc) < 1e-6);
  assert.ok(Math.abs(timeToLand(14, 0) - Math.sqrt(28 / 32)) < 1e-9);
  assert.ok(Math.abs(timeToLand(0.5, -10) - (-10 + Math.sqrt(100 + 32)) / 32) < 1e-9);
  assert.equal(airPress(0.2, 3, true), 'bounce');
  assert.equal(airPress(0.9, 8, true), 'stomp');
  assert.equal(airPress(0.9, 8, false), 'stomp');
  assert.equal(airPress(0.2, 0.8, false), null, 'a normal jump near the ground: nothing');
  const s = { x: 0, v: 9 };
  let peak = 0;
  for (let i = 0; i < 120; i++) { coilWobble(s, DT); peak = Math.max(peak, Math.abs(s.x)); }
  assert.ok(peak > 0.1 && Math.abs(s.x) < 0.01, 'the coil wobbles and settles');
});

function springRig({ world = null, scene = new THREE.Scene() } = {}) {
  const P = player(v(0, 0, 0));
  const S = springs.create(ctxOf(P, null, { world, scene }));
  const run = (frames, input = {}) => { const tops = []; for (let i = 0; i < frames; i++) { S.control(DT, { ...input }); step(P); S.update(DT); tops.push(P.pos.y); } return tops; };
  return { P, S, run };
}

test('winding then letting go springs him up about 14 m, he lands unhurt and the guard on his landing is given back', () => {
  const { P, S, run } = springRig();
  P.fallGuard = 1.3;   // (the soft-fall soles)
  S.press();
  for (let i = 0; i < 60; i++) { S.hold(DT); run(1); }
  assert.equal(S.charge, 1);
  assert.equal(P.pos.y, 0, 'he stands while winding');
  S.release();
  assert.equal(S.state, 'air');
  assert.ok(P.fallGuard >= SPRING.guard, 'no landing hurts while they carry him');
  const ys = run(150);
  const top = Math.max(...ys);
  assert.ok(top > 13.8 && top < 14.6, `up ${top.toFixed(2)} m`);
  assert.equal(S.state, 'idle');
  assert.equal(P.knocked ?? 0, 0);
  assert.equal(P.fallGuard, 1.3, 'the soles\' guard back');
});

test('pressed just before touching down they bounce him on, higher each time, three times at most', () => {
  const { P, S, run } = springRig();
  S.press(); for (let i = 0; i < 60; i++) S.hold(DT); S.release();
  const tops = [];
  let top = 0;
  for (let f = 0; f < 60 * 12 && tops.length < 5; f++) {
    const was = S.chain, st = S.state;
    if (S.state === 'air' && P.vel.y < 0 && !S.armed && S.air().tLand < 0.2) S.press();
    run(1);
    top = Math.max(top, P.pos.y);
    if ((S.chain !== was && st === 'air') || (st === 'air' && S.state === 'idle')) { tops.push(top); top = 0; }
    if (S.state === 'idle') break;
  }
  assert.equal(tops.length, 4, `four flights: ${tops.map((t) => t.toFixed(1))}`);
  for (let i = 1; i < 4; i++) assert.ok(tops[i] > tops[i - 1] + 2, 'higher each time');
  assert.ok(tops[3] > 22, `the third bounce reaches ${tops[3].toFixed(1)} m`);
  assert.equal(P.knocked ?? 0, 0, 'never hurt');
});

test('a press high in the air stomps: a hang, a drop, cracked floors break, foes are thrown back, crates fly, the buried comes up', () => {
  clearTargets();
  const scene = new THREE.Scene();
  const slab = new THREE.Group(); slab.add(new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 3)));
  const world = new GadgetWorld({ physics: null, spec: { breakables: [{ object: slab, center: v(0, -0.2, 0), radius: 1.5, regrow: Infinity }] } });
  const foe = { alive: true, kind: 'blot', vel: v(), stunned: 0, pos: v(3, 0, 0) };
  const hits = [];
  const off = registerTarget({ kind: 'foe', foe, radius: 0.5, position: () => v(3, 0.5, 0), onHit: (mode, p, dir, info) => { hits.push([mode, info.source]); return true; } });
  const cacheObj = new THREE.Group(); scene.add(cacheObj);
  const cache = buried(cacheObj, v(1, 0, 0));
  const events = [];
  const { P, S, run } = springRig({ world, scene });
  S.ctx.game.on?.('gadget:stomp', (e) => events.push(e));
  P.pos.set(0, 6, 0); P.onGround = false; P.vel.set(0, 0, 0); P._groundH = 6;
  S.press();
  assert.equal(S.state, 'hang');
  run(4);
  assert.ok(Math.abs(P.pos.y - 6) < 0.1, 'held still a moment');
  run(40);
  assert.equal(S.state, 'idle');
  assert.equal(P.knocked ?? 0, 0, 'a stomp does not hurt him');
  assert.equal(world.breakables[0].broken, true, 'the cracked floor broke');
  assert.deepEqual(hits[0], ['push', 'stomp']);
  assert.ok(foe.vel.x > 3, 'the foe thrown back, away');
  assert.ok(cache.unearthed, 'the cache brought up');
  off();
});

test('no launch from the air or a ride; winding holds him still; a knock-down ends a flight', () => {
  const { P, S, run } = springRig();
  P.ride = {}; S.press(); assert.equal(S.state, 'idle'); P.ride = null;
  S.press();
  const input = { KeyW: true, Space: true };
  S.control(DT, input);
  assert.equal(input.KeyW, false, 'the stick only aims the launch');
  assert.equal(input.Space, false);
  S.release();
  run(10);
  P.down = {}; run(1);
  assert.equal(S.state, 'idle');
});

test('the Gadget Yard has the lens\'s towers, false bridge and ghost path, and the springs\' course and cracked roof', async () => {
  const { LEVELS } = await import('../src/levels/index.js');
  const scene = new THREE.Scene();
  const warn = console.warn; console.warn = () => {};
  let level;
  try { level = LEVELS.find((l) => l.id === 'gadgetyard').create(scene); } finally { console.warn = warn; }
  const mine = hiddenIn(scene);
  assert.ok(mine.some((e) => e.kind === 'path' && e.solidWhenSeen), 'a ghost path');
  assert.ok(mine.some((e) => e.illusion), 'a false bridge');
  assert.ok(mine.some((e) => e.kind === 'writing' && e.message), 'writing for the glass');
  assert.ok(mine.some((e) => e.kind === 'buried'), 'a buried cache');
  const lay = level.gadgetYard.breakables.find((b) => Math.abs(b.object.rotation.x + Math.PI / 2) < 1e-6);
  assert.ok(lay, 'a cracked floor, laid flat');
});

test('real worlds carry secrets for the glass: Qanat\'s gate, the Buried canyon\'s bridge', () => {
  const city = readFileSync(new URL('../src/desert-city.js', import.meta.url), 'utf8');
  assert.match(city, /hiddenWriting\(root, city\.world\(/);
  assert.match(city, /ghostPath\(root, stair/);
  const buriedSrc = readFileSync(new URL('../src/levels/buried.js', import.meta.url), 'utf8');
  assert.match(buriedSrc, /ghostBridge\(scene,/);
});

test('standing on a ghost path the glass clouds over three times slower', () => {
  const scene = sceneWithGround();
  ghostBridge(scene, v(-4, 3, 0), v(4, 3, 0), { sag: 0 });
  const ph = new Physics(scene);
  const P = player(v(0, 3, 0));
  const L = monocle.create(ctxOf(P, ph, { scene }));
  L.press();
  for (let i = 0; i < 20; i++) L.update(DT);
  const m0 = L.meter;
  for (let i = 0; i < 60; i++) L.update(DT);
  assert.ok(Math.abs((m0 - L.meter) - LENS.drain * LENS.steady) < 1e-3, `on the bridge: ${(m0 - L.meter).toFixed(4)} a second`);
  P.pos.set(20, 0, 0);
  const m1 = L.meter;
  for (let i = 0; i < 60; i++) L.update(DT);
  assert.ok(Math.abs((m1 - L.meter) - LENS.drain) < 1e-3, 'off it: the usual');
});
