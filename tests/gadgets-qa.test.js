import test from 'node:test';
import { MAGIC_COST } from '../src/resources.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { registerGadget } from '../src/gadgets/registry.js';
import hook from '../src/gadgets/hook.js';
import bomb, { BOMB, lostBomb } from '../src/gadgets/bomb.js';
import boomerang, { inSight, ownReach } from '../src/gadgets/boomerang.js';
import magnet, { fieldWidth } from '../src/gadgets/magnet.js';
import recall, { bombAdapter } from '../src/gadgets/recall.js';
import bridge, { PEN } from '../src/gadgets/bridge.js';
import springs from '../src/gadgets/springs.js';
import bubble, { BUBBLE } from '../src/gadgets/bubble.js';
import { Gadgets } from '../src/gadgets/index.js';
import { GadgetWorld } from '../src/gadgets/world.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { clearTargets, registerTarget } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
import { Foe } from '../src/foes.js';
import { Reserve } from '../src/fluid-tool.js';

// The gadgets played together (docs/systems/gadgets.md): what one leaves behind when another is taken, a
// pause, a fall off the world, and the fixes of the QA pass over all ten.

for (const g of [hook, bomb, boomerang, magnet, recall, bridge, springs, bubble]) registerGadget(g);
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;

function sceneOf(...meshes) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial()));
  for (const m of meshes) scene.add(m);
  return scene;
}
const physicsOf = (...meshes) => new Physics(sceneOf(...meshes));
const box = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial()); m.position.set(x, y, z); m.updateMatrixWorld(true); return m; };
function player(at = v()) {
  const frame = { up: v(0, 1, 0), dir: (h, out = v()) => out.set(Math.sin(h), 0, Math.cos(h)), headingOf: (d) => Math.atan2(d.x, d.z) };
  return { pos: at, vel: v(), heading: 0, frame, object: { visible: true }, ride: null, onGround: true, climbing: false, hurtAt: 0, vehicles: [], endJets() {} };
}
function cameraLooking(eye, look) {
  const c = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  c.position.copy(eye); c.lookAt(look); c.updateMatrixWorld(true);
  return c;
}
const flagged = (id) => ({ flag: (k) => (k === 'gadget.equipped' ? id : undefined), emit() {} });
function ctxOf(P, physics, extra = {}) {
  const notes = [];
  const ctx = { player: P, physics, camera: null, tool: null, sound: null, world: null, hud: { reticle() {}, marks() {} }, sfx: { equip() {} }, fx: new THREE.Group(), scene: new THREE.Scene(), aimAt() {}, notice: (t) => notes.push(t), game: { emit() {} }, bursts: { add() {} }, ...extra };
  ctx.notes = notes;
  return ctx;
}

// ------------------------------------------------------------------ ink bombs

test('a bomb that falls off the world is gone once it is well under where it was thrown with nothing below', () => {
  assert.equal(lostBomb(-5, 10, -10, Infinity), true, 'fallen 15 m into nothing');
  assert.equal(lostBomb(-5, 10, -10, 12), false, 'the floor of a pit within reach under it');
  assert.equal(lostBomb(2, 10, -10, Infinity), false, 'not far enough under the hand yet');
  assert.equal(lostBomb(-5, 10, 4, Infinity), false, 'still rising');
  assert.equal(lostBomb(-5, 10, -10, Infinity, true), false, 'held (a bubble, the hourglass)');
  assert.equal(lostBomb(-150, 10, -1, 2), true, 'far, far under: gone whatever is there');
  // thrown off a ledge over a chasm (the ground 300 m down): gone well before y −200, and with no blast
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2).translate(0, -300, 0), new THREE.MeshBasicMaterial()));
  const ph = new Physics(scene), P = player(v(0, 0, 0)), blasts = [];
  const B = bomb.create(ctxOf(P, ph, { game: { emit: (e) => blasts.push(e) } }));
  const b = B.spawn(v(0, 1.4, 0), v(0, 3, -10), 999);
  let t = 0;
  while (B.live.includes(b) && t < 10) { B.update(DT); t += DT; }
  assert.ok(!B.live.includes(b), 'taken away');
  assert.ok(b.pos.y > -60, `before it fell far (${b.pos.y.toFixed(1)})`);
  assert.equal(b.mesh.parent, null);
  assert.deepEqual(blasts, [], 'no blast in the void');
  // one that lands goes off as before
  const ph2 = physicsOf(), B2 = bomb.create(ctxOf(P, ph2, { game: { emit: (e) => blasts.push(e) } }));
  B2.spawn(v(0, 1.4, 0), v(0, 3, -10));
  for (let i = 0; i < (BOMB.fuse + 0.2) / DT; i++) B2.update(DT);
  assert.deepEqual(blasts, ['gadget:blast']);
});

// ------------------------------------------------------------------ the boomerang

test('the boomerang carrying an ember spends a unit of the magic bar; with none left it flies plain', () => {
  clearTargets();
  const P = player(v(0, 0, 0)), reserve = new Reserve(3), tool = { mode: 'fire', reserve };
  const camera = cameraLooking(v(0, 2, 4), v(0, 1.5, -20));
  const B = boomerang.create(ctxOf(P, physicsOf(), { tool, camera }));
  B.press(); B.release();
  assert.equal(B.flight.mode, 'fire');
  assert.equal(reserve.level, 3 - MAGIC_COST.gadget, 'a unit spent (a third of the starting bar)');
  B.flight = null; B.cool = 0;
  reserve.level = 0;
  B.press(); B.release();
  assert.equal(B.flight.mode, null, 'no magic: plain');
  assert.ok(B.ctx.notes.some((n) => n.includes('magic')));
  B.flight = null; B.cool = 0;
  tool.mode = 'shoot'; reserve.fill();
  B.press(); B.release();
  assert.equal(reserve.charges, 3, 'plain fluid carries nothing and spends nothing');
});

test('the boomerang locks only on what is in sight: a lantern hidden behind a post is not locked on to', () => {
  clearTargets();
  // a post 0.7 m in front of the lantern, between it and the glove and the eye
  const post = box(0.4, 4, 0.4, 0, 2, -9.3);
  const physics = physicsOf(post);
  const lantern = v(0, 1.6, -10);
  registerTarget({ kind: 'flammable', accepts: ['fire'], radius: 0.6, position: () => lantern, onHit: () => true });
  const P = player(v(0, 0, 0));
  const camera = cameraLooking(v(0, 1.7, 4), lantern);
  const B = boomerang.create(ctxOf(P, physics, { camera }));
  B.press();
  for (let i = 0; i < 6; i++) B.update(DT);
  assert.equal(B.locks.length, 0, 'behind the post: no lock');
  // stepped aside: it is seen, and locked
  B.cancel();
  P.pos.set(6, 0, 0);
  B.ctx.camera = cameraLooking(v(7, 1.7, 4), lantern);
  B.press();
  for (let i = 0; i < 6; i++) B.update(DT);
  assert.equal(B.locks.length, 1, 'in sight: locked');
  // its own solid (a cage round its middle) does not hide it
  assert.ok(inSight(physicsOf(box(0.4, 0.4, 0.4, 0, 1.6, -10)), [v(0, 1.6, 0)], lantern, ownReach(0.6)));
  assert.ok(!inSight(physics, [v(0, 1.6, 0)], lantern, ownReach(0.6)));
  clearTargets();
});

// ------------------------------------------------------------------ the ink pen

function drawToward(pen, P, at, secs) {
  const d = v().subVectors(at, P.pos).setY(0).normalize();
  pen.ctx.camera = cameraLooking(P.pos.clone().add(v(0, 1.8, 0)).addScaledVector(d, -3), at);
  pen.press();
  for (let t = 0; t < secs; t += DT) { pen.hold(DT); pen.update(DT); }
  pen.release();
}

test('drawn on along a plank already standing, the line runs on past its end (it no longer stops after 1.4 m)', () => {
  const ph = physicsOf(box(4, 4, 4, -4, 2, 0), box(4, 4, 4, 18, 2, 0));
  const P = player(v(-2.3, 4, 0));
  const pen = bridge.create(ctxOf(P, ph, { game: flagged('bridge') }));
  const far = v(16.6, 4, 0);
  drawToward(pen, P, far, 0.6);
  assert.equal(pen.bridges.length, 1);
  const first = pen.bridges[0].points.at(-1).x;
  assert.ok(first > 2 && first < 6, `a first plank out over the gap (to ${first.toFixed(1)})`);
  // standing on it, a few metres short of its end: drawn on the same way
  P.pos.set(first - 3, 4, 0);
  assert.ok(Math.abs(ph.groundAt(P.pos.x, 6, 0) - 4) < 0.05, 'stood on the first plank');
  pen.ink = PEN.ink;
  drawToward(pen, P, far, 1.8);
  assert.equal(pen.bridges.length, 2);
  const end = pen.bridges[1].points.at(-1).x;
  assert.ok(end > 15.5, `on across the gap to the far tower (${end.toFixed(1)})`);
  // drawn on a floor it runs on too (it ends at a ledge only once it has left the ground it started on)
  const ph2 = physicsOf(), P2 = player(v(0, 0, 0)), pen2 = bridge.create(ctxOf(P2, ph2, { game: flagged('bridge') }));
  drawToward(pen2, P2, v(0, 0, -20), 0.6);
  const L = pen2.bridges[0].points[0].distanceTo(pen2.bridges[0].points.at(-1));
  assert.ok(L > 4, `${L.toFixed(1)} m along the floor`);
});

test('an ink wall stops you, but you cannot take hold of it and climb it; a stone wall you can', () => {
  const scene = sceneOf(box(6, 4, 0.6, 12, 2, 0));
  const ph = new Physics(scene);
  const P0 = player(v(0, 0, 0));
  const pen = bridge.create(ctxOf(P0, ph, { game: flagged('bridge') }));
  pen.set([v(-3, 0, PEN.wallAt), v(-1, 0, PEN.wallAt), v(1, 0, PEN.wallAt), v(3, 0, PEN.wallAt)], 'wall');
  assert.ok(ph.noClimbNear(v(0, 1.2, PEN.wallAt - 0.5), 0.8), 'the pen\'s wall is flagged');
  assert.ok(!ph.noClimbNear(v(12, 1.2, -0.8), 0.8), 'the stone one is not');
  const walk = (start, heading) => {
    const p = new Player(ph, { health: false });
    p.pos.copy(start); p.heading = heading; p.onGround = true;
    let climbed = false;
    // (pressing into it, as a traveller who wants up does: a moment against it on foot takes hold)
    for (let i = 0; i < 90; i++) { p.update(DT, { KeyW: true }, heading + Math.PI); climbed ||= p.climbing; }
    return { climbed, p };
  };
  const ink = walk(v(0, 0, PEN.wallAt - 1.2), 0);
  assert.equal(ink.climbed, false, 'never on the ink wall');
  assert.ok(ink.p.pos.z < PEN.wallAt, 'held back by it');
  const stone = walk(v(12, 0, -1.4), 0);
  assert.equal(stone.climbed, true, 'the stone wall is climbed');
  // the hook reeling you to it does not start a climb either
  const p = new Player(ph, { health: false });
  p.pos.set(0, 0.5, PEN.wallAt - 0.6);
  assert.equal(p.startClimb(v(0, 0, -1)), false);
  assert.equal(p.climbing, false);
});

// ------------------------------------------------------------------ the bubble wand

test('the bubble finds a foe, a crate or a bomb a little off the aim, but not one behind a wall', () => {
  clearTargets();
  const wall = box(4, 4, 0.4, 6, 2, -6);
  const ph = physicsOf(wall), P = player(v(0, 0, 0));
  const near = new Foe('blot', v(0.9, 0, -8)), hidden = new Foe('blot', v(6, 0, -8));
  const camera = cameraLooking(v(0, 1.7, 3), v(0, 1, -8));
  const W = bubble.create(ctxOf(P, ph, { camera, foes: { list: [near, hidden] } }));
  let h = W.trace();
  assert.equal(h.kind, 'foe', 'a foe a metre off the line');
  assert.equal(h.target.foe, near);
  // aimed at the one behind the wall: the wall is what it meets
  W.ctx.camera = cameraLooking(v(0, 1.7, 3), v(6, 1, -8));
  h = W.trace();
  assert.notEqual(h.target?.foe, hidden, 'not through the wall');
  assert.ok(BUBBLE.assist.cone > 0.12 && BUBBLE.assist.near > 1, 'wider than it was');
  clearTargets();
});

test('a conversation or a scene pops the bubble you float in; a crate in one waits', () => {
  clearTargets();
  const P = player(v(0, 2, 0)); P.onGround = false;
  const W = bubble.create(ctxOf(P, physicsOf()));
  W.press();
  assert.equal(W.bubble?.kind, 'self');
  W.update(DT, true);
  assert.equal(W.bubble, null, 'popped: let down');
  W.spawn('prop', v(0, 2, 0)); W.bubble.thing = { object: { visible: true }, vel: v(), pos: v(0, 2, 0) };
  const t = W.bubble.t;
  W.update(DT, true);
  assert.equal(W.bubble.t, t, 'held still meanwhile');
  clearTargets();
});

// ------------------------------------------------------------------ the magnet glove

test('the magnet\'s strokes are fine at their ends and close to the eye; a pause takes the field and the glove away', () => {
  assert.ok(fieldWidth(0.5) > 0.99 && fieldWidth(0) < 0.5 && fieldWidth(1) < 0.5, 'thinner at the ends');
  assert.ok(fieldWidth(0.5, 1) < 0.3, 'a hand from the eye: a fine line');
  assert.equal(fieldWidth(0.5, 20), 1, 'far: as drawn');
  clearTargets();
  const P = player(v(0, 0, 0)), camera = cameraLooking(v(0, 1.7, 3), v(0, 1, -8));
  const M = magnet.create(ctxOf(P, physicsOf(), { camera }));
  M.press();
  for (let i = 0; i < 5; i++) M.update(DT);
  assert.ok(M.field.mesh.count > 0 && M.glove.visible, 'searching: the field feels ahead');
  M.cancel(); M.update(DT, true);
  assert.equal(M.field.mesh.count, 0); assert.equal(M.glove.visible, false);
  clearTargets();
});

test('a metal crate held up over a floor plate (the magnet, a bubble) does not press it; set down on it, it does', () => {
  clearTargets();
  const W = new GadgetWorld({ physics: physicsOf(), player: player(v(9, 0, 9)), spec: { plates: [{ pos: v(0, 0, 0), radius: 1, things: true, mass: 3 }] } });
  const o = new THREE.Group(); o.position.set(0, 0.5, 0);
  const crate = W.addProp({ object: o, r: 0.5, h: 0.5, metal: true, mass: 3 });
  crate.held = { magnet: true };
  W.updatePlates(DT);
  assert.equal(W.plates[0].on, false, 'held: its weight is in the glove');
  crate.held = null;
  W.updatePlates(DT);
  assert.equal(W.plates[0].on, true, 'set down: pressed');
  clearTargets();
});

// ------------------------------------------------------------------ the hourglass

test('the hourglass never takes a bomb a bubble carries, and a pause clears its trail', () => {
  const B = { live: [] }, b = { pos: v(), vel: v(0, 1, 0), mesh: new THREE.Group(), held: null };
  B.live.push(b);
  const a = bombAdapter(b, B);
  assert.equal(a.can(), true);
  a.begin(); assert.equal(b.held, 'recall'); a.end(); assert.equal(b.held, null);
  b.held = { bubble: true };
  assert.equal(a.can(), false, 'in a bubble');
  a.end(); assert.ok(b.held, 'and letting go does not take it out of the bubble');
  const P = player(v(0, 0, 0)), R = recall.create(ctxOf(P, physicsOf(), { camera: cameraLooking(v(0, 1.7, 3), v(0, 1, -8)), game: flagged('recall') }));
  let hidden = 0;
  R.ctx.hud = { reticle: (p) => { if (!p) hidden++; } };
  R._ret = true; R.dots.count = 5;
  R.update(DT, true);
  assert.equal(R.dots.count, 0); assert.ok(hidden >= 1, 'its reticle taken away');
});

// ------------------------------------------------------------------ the spring boots

test('worn spring boots lift the figure by their length once, however many frames nothing else places it (photo mode)', () => {
  const P = player(v(0, 0, 0));
  P.object = new THREE.Group();
  const S = springs.create(ctxOf(P, physicsOf(), { game: flagged('springs') }));
  S.update(DT);
  const lift = P.object.position.y;
  assert.ok(lift > 0.02, 'stood on the coils');
  for (let i = 0; i < 120; i++) S.update(DT, true);   // (the traveller is not moved meanwhile: photo mode, a game)
  assert.ok(Math.abs(P.object.position.y - lift) < 0.02, `still ${P.object.position.y.toFixed(2)} m, not climbing`);
  P.object.position.copy(P.pos);   // (the traveller places his figure again: lifted from there)
  S.update(DT);
  assert.ok(Math.abs(P.object.position.y - lift) < 0.02);
});

// ------------------------------------------------------------------ the runtime

function runtime(owned) {
  const game = new GameState(null), listeners = new Set();
  const its = { has: (id) => !!game.flag(`item.${id}`), grant(id) { game.set(`item.${id}`, true); for (const f of listeners) f(id, true); }, on(f) { listeners.add(f); return () => listeners.delete(f); } };
  const defs = ['hook', 'bomb', 'boomerang', 'magnet', 'recall', 'bridge', 'monocle', 'springs', 'bubble', 'fan'].map((id, i) => ({ id, name: id, glyph: '◆', order: i, text: '', use: '', model: () => new THREE.Group(), create: () => ({}) }));
  const drawn = [];
  const G = new Gadgets({ defs, scene: new THREE.Scene(), physics: physicsOf(), player: player(), game, items: its, icon: () => null, drawIcon: (id) => drawn.push(id) });
  for (const id of owned) its.grant(id);
  return { G, drawn };
}

test('B only chooses gadgets (never the guard); with nothing in hand the use button sounds the whistle, and the chip and the wheel say so', () => {
  const none = runtime([]), input = { KeyB: true };
  none.G.control(DT, input);
  assert.equal(input.KeyB, true, '(the input is left alone)');
  const game = new GameState(null), listeners = new Set();
  const its = { has: (id) => !!game.flag(`item.${id}`), grant(id) { game.set(`item.${id}`, true); for (const f of listeners) f(id, true); }, on(f) { listeners.add(f); return () => listeners.delete(f); } };
  let rang = 0;
  const G = new Gadgets({ defs: [{ id: 'hook', name: 'hook', text: '', use: '', model: () => new THREE.Group(), create: () => ({}) }], scene: new THREE.Scene(), physics: physicsOf(), player: player(), game, items: its, ring: () => { rang++; } });
  G.control(DT, { KeyT: true }); G.control(DT, {});
  assert.equal(rang, 1, 'nothing found: the button still asks (ring() itself does nothing without the whistle)');
  assert.equal(G.instrument(), null);
  its.grant('bell');
  assert.equal(G.instrument().name, 'Bell-note whistle');
  assert.match(G.wheelList()[0].name, /^Bell-note whistle/, 'the wheel\'s first slot is the whistle');
  its.grant('hook');
  assert.equal(G.equipped, 'hook');
  G.control(DT, { PadGadget: true }); G.control(DT, {});
  assert.equal(rang, 1, 'a gadget in hand: the button is its');
  G.equip(null);
  G.control(DT, { PadGadget: true }); G.control(DT, { PadGadget: true }); G.control(DT, {});
  assert.equal(rang, 2, 'once per press');
  its.grant('echo');
  assert.equal(G.instrument().name, 'Bell-note whistle · echo shell');
});

test('the gadget in hand gets its picture first; the wheel open draws the others, one a frame', () => {
  const { G, drawn } = runtime(['hook', 'bomb', 'boomerang', 'magnet']);
  G.equip('magnet');
  G.update(DT);
  assert.deepEqual(drawn, ['magnet']);
  G.wheelOn = true;
  for (let i = 0; i < 6; i++) G.update(DT);
  assert.deepEqual(drawn, ['magnet', 'hook', 'bomb', 'boomerang'], 'each once');
});

test('a game keeps the gadgets\' buttons; the wheel takes ten and "nothing" without its slots touching; the touch button hides in a game', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes('gadgets.control(dt, busy() ? noInput : ctl, busy() || ship.playing || (!!minigame && !minigame.def.trial))'), 'paused while a game runs (a trial in the world keeps them: src/trials/)');
  const hud = readFileSync(new URL('../src/gadgets/hud.js', import.meta.url), 'utf8');
  assert.ok(hud.includes('body.minigame #touch .b-gadget'));
  // eleven slots round the wider ring: the gap between two neighbours' edges, the highlighted one grown
  const n = 11, R = 136, slot = 50 * 1.18;
  assert.ok(2 * R * Math.sin(Math.PI / n) > slot, 'they never touch');
});
