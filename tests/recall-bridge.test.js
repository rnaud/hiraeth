import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { registerGadget, GADGETS } from '../src/gadgets/registry.js';
import bomb from '../src/gadgets/bomb.js';
import recall, { RECALL, propAdapter, localBox, outlineGeometry } from '../src/gadgets/recall.js';
import bridge, { PEN, penPitch, turnToward, refillInk, fadeOrder, pathFrames, extentsOf, colliderGeometry, inkGeometry, headingDir } from '../src/gadgets/bridge.js';
import { Track, MotionHistory, Rewind, HISTORY } from '../src/gadgets/history.js';
import { GadgetWorld } from '../src/gadgets/world.js';
import { addScreen, screened } from '../src/wind-screens.js';
import { Physics } from '../src/physics.js';
import { clearTargets } from '../src/targets.js';
import { ITEMS } from '../src/items.js';
import { buildItemModel } from '../src/boxes/model.js';

registerGadget(bomb); registerGadget(recall); registerGadget(bridge);
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;

function physicsOf(...meshes) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial()));
  for (const m of meshes) scene.add(m);
  return new Physics(scene);
}
const block = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial()); m.position.set(x, y, z); m.updateMatrixWorld(true); return m; };
function player(at = v()) {
  const frame = { up: v(0, 1, 0), dir: (h, out = v()) => out.set(Math.sin(h), 0, Math.cos(h)) };
  return { pos: at, vel: v(), heading: 0, frame, object: { visible: true }, ride: null, onGround: true, vehicles: [] };
}
/** A camera behind the traveller at `pos`, looking along (yaw, pitch). */
function cameraAt(P, yaw, pitch) {
  const c = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  const d = v(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  c.position.copy(P.pos).add(v(0, 1.8, 0)).addScaledVector(d, -3);
  c.lookAt(c.position.clone().add(d));
  c.updateMatrixWorld(true);
  return c;
}
const flagged = (id) => ({ flag: (k) => (k === 'gadget.equipped' ? id : undefined), emit() {} });
function ctxOf(P, physics, extra = {}) {
  return { player: P, physics, camera: null, tool: null, sound: null, world: null, hud: { reticle() {} }, sfx: { equip() {} }, fx: new THREE.Group(), scene: new THREE.Scene(), aimAt() {}, notice() {}, bursts: { add() {} }, ...extra };
}

// ------------------------------------------------------------------ the two gadgets are whole

test('the hourglass and the pen are gadgets with models, prompts in pad form and a bay each', () => {
  for (const id of ['recall', 'bridge']) {
    assert.equal(ITEMS[id].kind, 'gadget');
    assert.ok(ITEMS[id].use.includes('Y / △'));
    const m = buildItemModel(id), s = new THREE.Box3().setFromObject(m).getSize(v());
    assert.ok(m.children.length >= 2 && Math.max(s.x, s.y, s.z) < 0.6, `${id}: an item-sized model of its own`);
    assert.equal(typeof GADGETS.find((g) => g.id === id).yard, 'function');
  }
});

// ------------------------------------------------------------------ motion history

test('a track is a ring buffer: newest first, wraps round, lets old samples go', () => {
  const t = new Track(4);
  for (let i = 0; i < 6; i++) t.push(i, 0, 0, 0, i * 0.5);
  assert.equal(t.len, 4, 'kept at its size');
  assert.equal(t.get(0).pos.x, 5); assert.equal(t.get(3).pos.x, 2);
  assert.equal(t.length(), 3);
  t.expire(2.6, 1);
  assert.equal(t.len, 2, 'only the last second');
  assert.equal(t.get(t.len - 1).pos.x, 4);
});

test('the history follows only what moves, at most `cap` things, forgets what stays still, and holds a frozen track', () => {
  const H = new MotionHistory({ cap: 2 });
  const a = { key: 'a', pos: v(), moving: () => true }, b = { key: 'b', pos: v(), moving: () => false }, c = { key: 'c', pos: v(), go: true, moving: () => c.go };
  for (let i = 0; i < 20; i++) { a.pos.x += 0.1; H.update(1 / HISTORY.rate, [a, b]); }
  assert.ok(H.has('a') && !H.track('b'), 'a moved, b never did');
  assert.ok(H.track('a').len > 15);
  // a third thing that moves: the one still longest makes room (a stops moving now)
  for (let i = 0; i < 10; i++) H.update(1 / HISTORY.rate, [a, b]);
  for (let i = 0; i < 5; i++) { c.pos.z += 0.2; H.update(1 / HISTORY.rate, [a, b, c]); }
  assert.ok(H.has('c'));
  c.go = false;
  H.freeze('a');
  for (let i = 0; i < 10 * HISTORY.rate; i++) H.update(1 / HISTORY.rate, [a, b, c]);
  assert.ok(H.track('a'), 'frozen: kept however long');
  assert.ok(!H.track('c'), 'still for longer than the window: forgotten');
  H.freeze('a', false);
  H.update(1 / HISTORY.rate, [b]);
  assert.ok(!H.track('a'), 'gone from the items: forgotten');
});

test('a rewind goes back along the path at the pace it went, and says when it is at the start', () => {
  const path = Array.from({ length: 21 }, (_, i) => ({ pos: v(20 - i, 0, 0), yaw: 0, t: 0 }));   // newest (x 20) first
  const R = new Rewind(path, { rate: 20 });
  const out = v();
  assert.ok(Math.abs(R.left - 1) < 1e-9, 'a second of it');
  R.step(0.5, out);
  assert.ok(Math.abs(out.x - 10) < 1e-6, `half way back (${out.x})`);
  assert.ok(Math.abs(R.vel.x + 20) < 1e-6, 'its speed, backward');
  assert.ok(!R.done);
  R.step(0.6, out);
  assert.ok(R.done && out.x === 0, 'at the oldest end');
});

// ------------------------------------------------------------------ the hourglass

test('a crate knocked off a ledge is sent back up onto it, held against gravity on the way', () => {
  clearTargets();
  const ph = physicsOf(block(4, 6, 4, 0, 3, -10));
  const P = player(v(0, 0, 0));
  const W = new GadgetWorld({ physics: ph, player: P });
  const crate = W.addProp({ object: new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9)), r: 0.56, h: 0.45 });
  crate.pos.set(0, 6.45, -8.5); crate.object.updateMatrixWorld();
  const ctx = ctxOf(P, ph, { world: W, game: flagged('recall'), camera: cameraAt(P, Math.PI, 0.3) });
  const R = recall.create(ctx);
  // it rests up there; then a shove off the lip
  for (let t = 0; t < 0.5; t += DT) { R.update(DT); W.update(DT); }
  crate.impulse(v(0, 2, 5));
  for (let t = 0; t < 2.5; t += DT) { R.update(DT); W.update(DT); }
  assert.ok(crate.pos.y < 1 && crate.resting, `it fell and lies on the ground (${crate.pos.toArray().map((x) => x.toFixed(2))})`);
  assert.ok(R.history.has(crate), 'its fall was kept');
  const fell = R.history.track(crate).seconds();
  assert.ok(fell > 0.3 && fell < HISTORY.window, `${fell.toFixed(2)} s of motion`);
  // the hourglass: sent back
  assert.ok(R.begin(propAdapter(crate), false));
  assert.equal(crate.held, 'recall');
  let t = 0, highest = 0;
  while (R.recalling && t < 6) { R.update(DT); W.update(DT); t += DT; highest = Math.max(highest, crate.pos.y); }
  assert.ok(!R.recalling, 'it got there');
  assert.ok(Math.abs(crate.pos.y - 6.45) < 0.15 && crate.pos.z < -8, `back on the ledge (${crate.pos.toArray().map((x) => x.toFixed(2))})`);
  assert.ok(t < fell + 0.6, `at the pace it fell (${t.toFixed(2)} s)`);
  assert.equal(crate.held, null, 'let go there');
  for (let k = 0; k < 60; k++) W.update(DT);
  assert.ok(crate.pos.y > 6.3, 'and it stays up there');
});

test('pressed again it stops where it is; something still has nothing to send back', () => {
  clearTargets();
  const ph = physicsOf();
  const P = player(v(0, 0, 0));
  const W = new GadgetWorld({ physics: ph, player: P });
  const crate = W.addProp({ object: new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9)), r: 0.56, h: 0.45 });
  crate.pos.set(0, 0.45, -6);
  const R = recall.create(ctxOf(P, ph, { world: W, game: flagged('recall'), camera: cameraAt(P, Math.PI, -0.08) }));
  for (let k = 0; k < 10; k++) { R.update(DT); W.update(DT); }
  assert.equal(R.begin(propAdapter(crate), false), false, 'it never moved');
  crate.impulse(v(0, 0, -12));
  for (let t = 0; t < 2; t += DT) { R.update(DT); W.update(DT); }
  const far = crate.pos.z;
  // aimed at (the camera looks down the line it slid along), a press starts it, another stops it
  R.update(DT);
  assert.ok(R.hover?.key === crate, 'the aim finds it');
  R.press();
  assert.ok(R.recalling);
  for (let k = 0; k < 10; k++) { R.update(DT); W.update(DT); }
  R.release();
  assert.ok(R.recalling, 'a tap: it goes on by itself');
  R.press(); R.release();
  assert.ok(!R.recalling, 'pressed again: stopped');
  assert.ok(crate.pos.z > far + 0.03 && crate.pos.z < -6.1, `part of the way back (${crate.pos.z.toFixed(2)} from ${far.toFixed(2)})`);
  // held from the start, letting go stops it
  crate.impulse(v(0, 0, -10));
  for (let t = 0; t < 2; t += DT) { R.update(DT); W.update(DT); }
  R.update(DT); R.cool = 0;
  R.press(); for (let k = 0; k < 30; k++) { R.hold(DT); R.update(DT); W.update(DT); }
  R.release();
  assert.ok(!R.recalling, 'let go: stopped');
});

test('a bomb in flight goes back along its arc, its fuse held while it does', () => {
  clearTargets();
  const ph = physicsOf();
  const P = player(v(0, 0, 10));
  const W = new GadgetWorld({ physics: ph, player: P });
  const base = ctxOf(P, ph, { world: W, game: { flag: () => 'recall', emit() {} } });
  const B = bomb.create(base);
  const ctx = { ...base, gadget: (id) => (id === 'bomb' ? B : null) };
  const R = recall.create(ctx);
  const b = B.spawn(v(0, 1.5, 0), v(0, 6, -8), 9);
  for (let t = 0; t < 0.8; t += DT) { B.update(DT); R.update(DT); }
  const fuse = b.fuse, at = b.pos.clone();
  const a = R.candidates().find((x) => x.key === b);
  assert.ok(a && R.history.has(b), 'followed in flight');
  R.begin(a, false);
  for (let t = 0; t < 0.4; t += DT) { B.update(DT); R.update(DT); }
  assert.equal(b.fuse, fuse, 'the fuse waits');
  assert.ok(b.pos.distanceTo(v(0, 1.5, 0)) < at.distanceTo(v(0, 1.5, 0)) - 2, 'on its way back to the hand');
  R.stop();
  assert.ok(!b.held);
});

test('a ghost is an outline of the thing’s own box', () => {
  const m = new THREE.Group(); const box = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1)); box.position.y = 1; m.add(box);
  const b = localBox(m);
  assert.ok(Math.abs(b.min.y) < 1e-6 && Math.abs(b.max.y - 2) < 1e-6);
  const g = outlineGeometry(b); g.computeBoundingBox();
  assert.ok(g.boundingBox.max.y > 1.99 && g.boundingBox.min.x < -0.49 && g.attributes.aThin, 'twelve thin bars round it');
  assert.ok(RECALL.range >= 25);
});

// ------------------------------------------------------------------ the pen: its maths

test('the pen’s line: tipped a little up, never steeper than its cap; it bends at most so fast; the ink flows back', () => {
  assert.equal(penPitch(0), PEN.bias);
  assert.equal(penPitch(1.2), PEN.climb, 'a ramp no steeper than 28°');
  assert.ok(PEN.climb <= 0.5);
  assert.equal(penPitch(-1), PEN.dive);
  assert.ok(Math.abs(turnToward(0, 1, 0.1) - 0.1) < 1e-9);
  assert.ok(Math.abs(turnToward(3, -3, 0.5) - (3 + 2 * Math.PI - 6)) < 1e-9, 'the short way round');
  const d = headingDir(Math.PI / 2, 0.3);
  assert.ok(Math.abs(d.length() - 1) < 1e-9 && d.x > 0.9 && d.y > 0.29);
  let s = { ink: 5, wait: 0.5 };
  s = refillInk(s.ink, s.wait, 0.4); assert.equal(s.ink, 5, 'it waits after drawing');
  s = refillInk(s.ink, s.wait, 0.2); s = refillInk(s.ink, s.wait, 1);
  assert.ok(Math.abs(s.ink - (5 + PEN.refill)) < 1e-9);
  assert.equal(refillInk(PEN.ink - 0.1, 0, 10).ink, PEN.ink);
});

test('a plank wears away from both ends together', () => {
  const o = fadeOrder(7);
  assert.equal(o.length, 7);
  assert.deepEqual(o.slice(-2).sort(), [0, 6], 'the two ends go first');
  assert.deepEqual(o.slice(-4, -2).sort(), [1, 5]);
  assert.equal(o[0], 3, 'the middle last');
  assert.deepEqual([...o].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);
});

test('a plank’s collision is a box per segment, its top on the line; a wall’s stands up across it', () => {
  const pts = Array.from({ length: 9 }, (_, i) => v(0, 4, -i * 0.5));
  const fr = pathFrames(pts), ext = extentsOf('bridge');
  assert.ok(fr.every((f) => Math.abs(f.b.y - 1) < 1e-9 && Math.abs(Math.abs(f.a.x) - 1) < 1e-9), 'flat plank: its up is up');
  const g = colliderGeometry(pts, fr, ext); g.computeBoundingBox();
  const bb = g.boundingBox;
  assert.ok(Math.abs(bb.max.y - 4) < 1e-6 && Math.abs(bb.min.y - (4 - PEN.thick)) < 1e-6, 'top on the line');
  assert.ok(Math.abs(bb.max.x - PEN.width / 2) < 1e-6 && bb.min.z < -3.99);
  const some = colliderGeometry(pts, fr, ext, fadeOrder(8), 2); some.computeBoundingBox();
  assert.ok(some.boundingBox.min.z > -3 && some.boundingBox.max.z < -1, 'only the middle left');
  const wp = Array.from({ length: 5 }, (_, i) => v(i * 0.5, 0, 0));
  const w = colliderGeometry(wp, pathFrames(wp, undefined, 'wall'), extentsOf('wall')); w.computeBoundingBox();
  assert.ok(w.boundingBox.max.y > PEN.wallH - 0.01 && Math.abs(w.boundingBox.max.z - PEN.wallT / 2) < 1e-6, 'a wall');
  // the drawn plank: one run of the index per segment, its ink strokes beside it
  const ink = inkGeometry(pts, fr, ext);
  assert.equal(ink.deck.userData.runs.length, 8); assert.equal(ink.strokes.userData.runs.length, 8);
  ink.deck.computeBoundingBox();
  assert.ok(Math.abs(ink.deck.boundingBox.max.y - 4) < 0.05, 'drawn where it is solid (a wobble of a few cm)');
});

// ------------------------------------------------------------------ the pen: drawing

/** Two towers 4 m high with a gap between (x -2 … 6 m). */
function gapWorld() { return physicsOf(block(4, 4, 4, -4, 2, 0), block(4, 4, 4, 8, 2, 0)); }

/** A camera behind the traveller looking at a point (the reticle on it). */
function cameraOn(P, at) {
  const c = cameraAt(P, Math.atan2(at.x - P.pos.x, at.z - P.pos.z), 0);
  c.position.copy(P.pos).add(v(0, 1.8, 0)).addScaledVector(v().subVectors(at, P.pos).setY(0).normalize(), -3);
  c.lookAt(at); c.updateMatrixWorld(true);
  return c;
}
function drawWith(pen, P, physics, yaw, pitch, secs) {
  pen.ctx.camera = yaw?.isVector3 ? cameraOn(P, yaw) : cameraAt(P, yaw, pitch);
  pen.press();
  for (let t = 0; t < secs; t += DT) { pen.hold(DT); pen.update(DT); }
  pen.release();
}

test('drawn across a gap, the line sets into a plank you can stand on; it wears away after its time', () => {
  const ph = gapWorld();
  const P = player(v(-2.3, 4, 0));
  const pen = bridge.create(ctxOf(P, ph, { game: flagged('bridge') }));
  // the reticle on the far tower's top, just past its edge: the line heads there
  drawWith(pen, P, ph, v(6.6, 4, 0), 0, 1.2);
  assert.equal(pen.bridges.length, 1, 'set');
  const b = pen.bridges[0], end = b.points[b.points.length - 1];
  assert.ok(end.x > 5.9 && end.x < 6.8, `it ran across and stopped at the far tower (${end.x.toFixed(2)})`);
  assert.ok(Math.abs(ph.groundAt(2, 6, 0) - 4) < 0.05, `solid in the middle of the gap (${ph.groundAt(2, 6, 0).toFixed(2)})`);
  assert.ok(ph.groundAt(2, 6, 1) < 0.1, 'and only as wide as the plank');
  assert.ok(pen.ink < PEN.ink - 7 && pen.ink > PEN.ink - 10, `ink spent (${pen.ink.toFixed(1)} left)`);
  // a foe walks across it as onto any ground
  for (let t = 0; t < PEN.life - 0.5; t += DT) pen.update(DT);
  assert.ok(Math.abs(ph.groundAt(2, 6, 0) - 4) < 0.05, 'still standing just before its time');
  for (let t = 0; t < PEN.fade * 0.6; t += DT) pen.update(DT);
  assert.ok(ph.groundAt(5.6, 6, 0) < 0.1 || ph.groundAt(5.6, 6, 0) > 3.9, 'worn from the far end');
  assert.ok(Math.abs(ph.groundAt(2, 6, 0) - 4) < 0.05, 'the middle goes last');
  for (let t = 0; t < PEN.fade; t += DT) pen.update(DT);
  assert.equal(pen.bridges.length, 0, 'gone');
  assert.ok(ph.groundAt(2, 6, 0) < 0.1, 'nothing left to stand on');
  assert.ok(pen.ink > PEN.ink - 0.01, 'the ink came back meanwhile');
});

test('never longer than 16 m, a ramp no steeper than its cap, too short is not kept', () => {
  const ph = physicsOf();
  const P = player(v(0, 10, 0));   // (high in the air over open ground: nothing to run into)
  const pen = bridge.create(ctxOf(P, ph, { game: flagged('bridge') }));
  drawWith(pen, P, ph, 0, -PEN.bias, 3);
  const b = pen.bridges[0];
  let L = 0; for (let i = 1; i < b.points.length; i++) L += b.points[i].distanceTo(b.points[i - 1]);
  assert.ok(L <= PEN.max + 1e-6 && L > PEN.max - 0.3, `${L.toFixed(2)} m`);
  pen.ink = PEN.ink;
  drawWith(pen, P, ph, 0, 0.5, 1);
  const r = pen.bridges[1], dy = r.points[r.points.length - 1].y - r.points[0].y, run = Math.hypot(r.points.at(-1).x - r.points[0].x, r.points.at(-1).z - r.points[0].z);
  assert.ok(dy > 1 && Math.atan2(dy, run) <= PEN.climb + 0.02, `a ramp up at ${(Math.atan2(dy, run) * 180 / Math.PI).toFixed(1)}°`);
  const n = pen.bridges.length, ink = pen.ink;
  drawWith(pen, P, ph, 0, 0, 0.05);
  assert.equal(pen.bridges.length, n, 'a tap: nothing set');
  assert.ok(Math.abs(pen.ink - ink) < 1e-6, 'its ink given back');
  pen.ink = 0.5;
  pen.press();
  assert.equal(pen.state, 'idle', 'a dry pen draws nothing');
});

test('aimed up steeply it draws a wall across the way: solid, and a gust behind it is kept off', () => {
  const ph = physicsOf();
  const P = player(v(0, 0, 0));
  const pen = bridge.create(ctxOf(P, ph, { game: flagged('bridge') }));
  drawWith(pen, P, ph, 0, 0.9, 1);
  const b = pen.bridges[0];
  assert.equal(b.mode, 'wall');
  const span = b.points[0].distanceTo(b.points.at(-1));
  assert.ok(span > 4 && span <= PEN.wallMax + 1e-6, `${span.toFixed(1)} m across`);
  assert.ok(Math.abs(b.points[0].z - PEN.wallAt) < 0.1, 'a few metres ahead');
  // it stops what walks into it (a foe's step test is a ray at knee height: src/foes.js canStep)
  assert.ok(ph.rayDistance(v(0, 0.5, 0), v(0, 0, 1), 6) < PEN.wallAt, 'solid');
  // a gust blowing toward you from beyond it: you are sheltered; beside it, not
  assert.ok(screened(v(0, 0, 1), v(0, 0, -1)), 'behind the wall');
  assert.ok(!screened(v(8, 0, 1), v(0, 0, -1)), 'out to the side');
  assert.ok(!screened(v(0, 0, 1), v(0, 0, 1)), 'the wind from behind you');
  for (let t = 0; t < PEN.life + PEN.fade + 0.2; t += DT) pen.update(DT);
  assert.ok(!screened(v(0, 0, 1), v(0, 0, -1)), 'gone with the wall');
});

test('a screen shelters only within reach and up to its height', () => {
  const off = addScreen({ a: v(-1, 0, -2), b: v(1, 0, -2), bottom: 0, top: 2 });
  assert.ok(screened(v(0, 0, 0), v(0, 0, 1)));
  assert.ok(!screened(v(0, 0, 9), v(0, 0, 1)), 'too far behind it');
  assert.ok(!screened(v(0, 3, 0), v(0, 0, 1)), 'above it');
  off();
  assert.ok(!screened(v(0, 0, 0), v(0, 0, 1)));
});
