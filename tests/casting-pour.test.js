// The Casting-House round its Pouring Hall (issue #416, docs/design/temple-best-practices.md): the pour is the house's one
// state, the great crucible's iron let into the runnels or stopped at a tap by every hub, read on a gauge, a lamp's colour
// and the runnels' own glow in every room. Poured, the runnels burn and throw you out, the heat-gates shut (the iron
// spilling down them) and the moulds are cast; cold, the gates open and the runnels are dry. The house walked straight
// through with a real traveller (src/player.js): every tap turned with the use button, every moon rolled or drawn in the
// glove's field, the hoist ridden, the press waited out, the weight hooked off its capital and carried, the sill dropped
// from into the sand. Its state machine is tests/temples.test.js's, its play-through by hits
// tests/temple-playthrough.test.js's; this is the feet.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { templeOf } from '../src/temples/attachment.js';
import { HALL, RUN, RUNS, SILL, POUR, UP, SAND, SCALE, CRUCIBLE, PourGauge, PourTap } from '../src/temples/moonfoundry.js';
import { createMoonFoundry } from '../src/levels/moon-foundry.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { bestInteractable } from '../src/interact.js';
import { updateHazards, hazardAt } from '../src/hazards.js';
import { HOOK } from '../src/gadgets/hook.js';
import { pickUp } from '../src/carry.js';
import { irons } from '../src/gadgets/metal.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
/** The button by a key's little chest: opened. */
function openChest(rt, id, P) {
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, `temple.${rt.id}.${id}`, `by the chest of ${id}, the button opens it`);
  near.entry.use(P);
}
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };

/** The Casting-House built in its world, a traveller at its door, and his hands. */
function house() {
  game.reset();
  own('backpack', 'gun', 'hook', 'doublejump');
  const scene = new THREE.Scene();
  const level = quiet(() => createMoonFoundry(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, 'moonfoundry');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers?.(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s, until = () => false) => { for (let i = 0; i < s / DT; i++) { if (until()) return true; frame(); } return until(); };
  const local = () => rt.kit.local(P.pos.clone());
  const where = () => local().toArray().map((v) => v.toFixed(1)).join(', ');
  const via = (...pts) => pts.every((q) => walk(L(...q)));
  const sight = (to, from) => { const d = to.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.9; };
  /** The use button by a tap: turned (the tap's id: `tap.<its room>`). */
  const turn = (room) => {
    const T = POUR.taps.find((x) => x.room === room), f = [Math.sin(T.yaw), Math.cos(T.yaw)];
    assert.equal(walk(L(T.at[0] + f[0] * 1.6, T.at[1], T.at[2] + f[1] * 1.6), { tol: 0.4, run: false }), true, `to the tap in ${room} (${where()})`);
    const near = bestInteractable(P);
    assert.equal(near?.entry.id, `temple.moonfoundry.tap.${room}`, `by the tap in ${room}, the button turns it (${where()})`);
    const r = near.entry.use(P);
    wait(POUR.run + 0.3);
    return r;
  };
  const poured = () => rt.logic.drumOn('pour', 'pourOn'), cold = () => rt.logic.drumOn('pour', 'pourCold');
  /** Push a stone moon along its groove (toward its b end) until it rests on `plate`. */
  const roll = (id, plate, n = 12) => {
    const ball = rt.piece(id);
    for (let k = 0; k < n && !rt.logic.drumOn(id, plate); k++) {
      walk(ball.center.clone().addScaledVector(ball.dir, -2.3).setY(P.pos.y), { tol: 0.5, max: 8 });
      ball.hit('push', ball.dir.clone(), { strength: 1 });
      wait(2.8);
    }
    return rt.logic.drumOn(id, plate);
  };
  /** An iron moon drawn along its rail in the magnet glove's field (src/gadgets/metal.js irons), toward its far end, till on `plate`. */
  const draw = (id, plate, s = 12) => {
    const ball = rt.piece(id), x = irons().find((i) => i.pos() === ball.center);
    assert.ok(x, `${id}: the glove takes hold of it`);
    const goal = ball.b.clone().addScaledVector(ball.dir, 1.5);
    walk(ball.center.clone().addScaledVector(ball.dir, -5).setY(P.pos.y), { tol: 0.6, max: 10 });
    const done = () => rt.logic.drumOn(id, plate) && ball.rest;
    for (let i = 0; i < s / DT && !done(); i++) { x.follow(goal, DT); frame(); }
    wait(3, done);
    return rt.logic.drumOn(id, plate);
  };
  return { level, physics, rt, P, notes, L, frame, toward, walk, wait, local, where, via, sight, turn, poured, cold, roll, draw, said: (re) => notes.some((n) => re.test(n)) };
}

test('the Casting-House on foot (issue #416): the pour stopped at the hall’s tap and the west gate, the stone moon cast in the Mould Room, the Sand Room’s gate and key, the hoist, the landing’s cast, the glove, the furnace’s bridge cast by the pour, the far gate, the small key’s door, the iron moon on the pier, the weight hooked off its capital, the great key, the keepers’ door and the east gate, the pour let in for the founders’ moon, the Founders’ Door', () => {
  const H = house(), { rt, P, L, walk, wait, where, local, via, sight, turn, poured, cold, roll, draw, said, frame, toward } = H;
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), `standing in the Porch (${where()})`);
  assert.ok(poured() && rt.pour, 'the house pours by itself at the start');
  // ---- G4: the Pouring Hall, 72 m long under 34, its floor, gallery, crucible and the Founders' Door seen from the way in
  assert.ok(HALL.z1 - HALL.z0 >= 60 && HALL.h >= 30, 'a great hall: 60 m and more');
  assert.equal(walk(L(0, 0, 19.5)), true, `into the Pouring Hall (${where()})`);
  const eye = L(0, 1.7, 21);
  for (const [x, y, z] of [[-18, UP + 5, 70], [18, UP + 5, 70], [0, CRUCIBLE.y - 2, CRUCIBLE.z], [0, 3, HALL.z1 - 1], [-3, -0.1, RUN.z]]) assert.ok(sight(L(x, y, z), eye), `seen from the way in (${x}, ${y}, ${z})`);
  // (G1, readable everywhere: a gauge in every room but the guardian's and the short passages)
  const gauges = new Set(rt.placed.filter((p) => p.cls === 'PourGauge').map((p) => p.o.room));
  for (const r of Object.keys(rt.def.logic.rooms)) if (!['hall', 'out', 'keepers', 'scalesWay'].includes(r)) assert.ok(gauges.has(r), `a gauge in ${r}`);
  const taps = new Set(rt.placed.filter((p) => p.cls === 'PourTap').map((p) => p.o.room));
  for (const r of ['floor', 'gallery', 'landing', 'moulds', 'sand', 'furnace', 'scales']) assert.ok(taps.has(r), `a tap in ${r}`);
  // ---- poured: the west gate shut, its iron spilling; the runnel burns and throws him out, a little hurt, never killed
  assert.equal(rt.logic.isOpen('gW'), false, 'the west gate shut while it pours');
  const h0 = P.health ?? P.hp;
  P.teleport(L(-4, 0.1, RUN.z - 0.6), V(0, 1, 0), V(0, 0, 1));
  let burnt = false, out = false;
  for (let i = 0; i < 3 / DT; i++) { frame(); burnt ||= hazardAt(P.pos)?.kind === 'fire'; if (burnt && P.onGround && local().y > -0.2 && Math.abs(local().z - RUN.z) > RUN.w / 2) { out = true; break; } }
  assert.ok(burnt && out, `in the Runner it burns, and throws him out onto the floor (${where()})`);
  assert.ok(!P.dead, 'not killed');
  wait(1);
  // ---- the hall's tap: the pour stopped; the runnels dry, the west gate open
  assert.equal(turn('floor'), 'cold');
  assert.ok(cold() && rt.logic.isOpen('gW') && rt.logic.isOpen('gE') && rt.pour.k === 0, 'cold: the runnels drained, both gates open');
  P.teleport(L(-4, 0.1, RUN.z - 0.6), V(0, 1, 0), V(0, 0, 1));
  wait(1);
  assert.ok(!hazardAt(P.pos) && local().y < -0.8, `cold, the Runner is a dry lane to stand in (${where()})`);
  assert.equal(walk(L(4.7, -RUN.depth, RUN.z + 0.6), { max: 6 }) && walk(L(2.3, -0.3, RUN.z - 0.9), { max: 6, run: false }) && walk(L(2.3, 0, RUN.z - 3.4), { max: 6, run: false }), true, `along it and up its steps (${where()})`);
  // ---- the Mould Room: the stone moon into the great mould; the pour let in from its own tap: cast, the north door
  assert.equal(via([4, 0, 25], [-14, 0, 26], [-26, 0, 30], [-34, 0, 30]), true, `through the west gate into the Mould Room (${where()})`);
  assert.equal(roll('m1', 'pM'), true, `the stone moon into the great mould (${where()})`);
  assert.equal(rt.logic.isOpen('dM'), false, 'nothing cast while the house is cold');
  assert.equal(turn('moulds'), 'poured');
  wait(2.5);
  assert.ok(rt.logic.isOpen('dM') && said(/Cast: the north door/), 'the iron round the moon: cast, the north door grinds down');
  assert.equal(rt.logic.isOpen('gW'), false, 'and the west gate shut behind him');
  // ---- the Sand Room behind its gate (cold): its keepers, its small key
  assert.equal(rt.logic.isOpen('dR'), false, 'the Sand Room’s gate shut while it pours');
  assert.equal(turn('moulds'), 'cold');
  const keepers = [{ room: 'sand', alive: true }, { room: 'sand', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  const sandDoor = SAND.z + SAND.d / 2 + 0.6;
  assert.equal(walk(L(SAND.x, 0, sandDoor + 4)) && walk(L(SAND.x, 0, sandDoor)) && walk(L(SAND.x, 0, sandDoor - 5)), true, `into the Sand Room (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dR'), false, 'the gate shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arS') && rt.logic.isOpen('dR'), 'beaten: won, and the gate lets go (the house cold)');
  assert.equal(walk(rt.piece('kS').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kS', P);
  wait(3);
  assert.equal(rt.logic.isFound('kS'), true, 'a small key');
  assert.equal(walk(L(SAND.x, 0, sandDoor)) && walk(L(SAND.x, 0, sandDoor + 4)), true, `back into the Mould Room (${where()})`);
  // ---- the hoist's pan: the stone moon for him; the hoist up to the landing
  const hoist = rt.pieces.find((p) => p.path && p.o.when?.pressed === 'pK');
  P.teleport(L(-46 + 3.5, 4.6, 36), V(0, 1, 0), V(0, 0, 1));
  wait(0.5);
  assert.equal(roll('m2', 'pK'), true, `the stone moon into the hoist's pan (${where()})`);
  P.teleport(L(-44, 0.1, 40), V(0, 1, 0), V(0, 0, 1));
  wait(0.5);
  assert.equal(walk(L(-44, 0, 50)), true, `through the cast door to the stair (${where()})`);
  for (let i = 0; i < 30 / DT && !(hoist.s < 0.1 && hoist.wait > 0.4); i++) frame();
  assert.equal(walk(hoist.group.position, { tol: 0.6, run: false, max: 4, dy: 0.9 }), true, `onto the hoist (${where()})`);
  for (let i = 0; i < 20 / DT && hoist.s < hoist.total - 0.05; i++) frame();
  assert.equal(walk(L(-44, UP, 62)), true, `onto the landing (${where()})`);
  // ---- the landing: its stone moon into the counterweight mould; the pour let in at the landing's tap: the north door
  assert.equal(roll('mL', 'pL'), true, `the landing's moon into the counterweight mould (${where()})`);
  assert.equal(rt.logic.isOpen('gT'), false, 'cold: nothing cast');
  assert.equal(turn('landing'), 'poured');
  wait(2.5);
  assert.ok(rt.logic.isOpen('gT') && said(/north door rises/), 'cast: the north door rises');
  // ---- the Tong Chamber: the magnet glove; the east door's cradle
  assert.equal(walk(L(-44, UP, 80)) && walk(L(-44, UP, 100)), true, `through the north door into the Tong Chamber (${where()})`);
  items.grant('magnet'); game.emit('box:opened', { id: 'moonfoundry.temple.tongs' });
  wait(0.3);
  assert.equal(rt.logic.gadget, true);
  assert.equal(draw('mP', 'pP'), true, 'the cradle’s moon home');
  wait(2.5);
  assert.equal(rt.logic.isOpen('dP'), true, 'the chamber’s east door');
  assert.equal(walk(L(-20, UP, 112)) && walk(L(-5, UP, 112)), true, `through it onto the furnace's near lip (${where()})`);
  // ---- the Casting Furnace: the iron moon through the pilot flame, hot into the hooded mould; poured, the bridge is cast
  assert.equal(draw('mH', 'pH'), true, 'the iron moon into the mould’s mouth');
  wait(1.5);
  assert.ok(said(/comes out glowing/) && rt.logic.isLit('bH'), 'hot from the pilot flame, it lights the hooded mould');
  wait(3);
  assert.ok(rt.logic.isOpen('brH') && said(/stones rise from the iron/), 'the house pouring, the bridge is cast');
  assert.equal(rt.logic.isOpen('cF'), false, 'the far gate shut while it pours');
  assert.equal(turn('furnace'), 'cold');
  assert.ok(rt.logic.isOpen('brH') && rt.logic.isOpen('cF'), 'cold: the bridge stays; the far gate opens');
  const press = rt.piece('hm');
  P.teleport(L(6.3, UP + 0.1, 107), V(0, 1, 0), V(0, 0, 1));
  wait(0.5);
  for (let i = 0; i < 8 / DT && !(press.phase > 0.45 && press.phase < 0.5); i++) frame();
  assert.equal(walk(L(19.8, UP, 107), { max: 6 }), true, `over the bridge under the press (${where()})`);
  assert.ok(P.pos.y > L(0, UP - 1, 0).y, 'over it, not in the channel');
  // ---- the far gate's passage; the small key in its door; onto the Weighing Hall's gallery
  assert.equal(via([31, UP, 100], [31, UP, 92], [31, UP, 64.2]), true, `through the far gate and down its passage (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.keysIn('dW'), 1, 'the small key goes in');
  assert.equal(walk(L(31, UP, 60)), true, `onto the Weighing Hall's gallery (${where()})`);
  // ---- the Weighing Hall: the iron moon out along the pier into its pan; the keepers' eye; the weight hooked down
  assert.equal(draw('mB', 'pB'), true, 'the iron moon into the pier’s pan');
  wait(1);
  assert.ok(rt.piece('eS').lidsOpen() && said(/The beam tips/), 'the keepers’ eye unlids, and the beam tips toward the pier');
  rt.piece('eS').hit('shoot');
  wait(2.5);
  assert.equal(rt.logic.isOpen('dS'), true, 'the keepers’ door');
  assert.equal(rt.logic.isFound('kG'), false);
  const w = rt.piece('wS');
  assert.equal(walk(L(SCALE.column[0], UP, 56)), true, `along the gallery, across from the column (${where()})`);
  const hand = P.pos.clone().add(V(0, 1.3, 0));
  assert.ok(w.prop.pos.distanceTo(hand) <= HOOK.range && sight(w.prop.pos, hand), 'the weight on its capital in the hook’s reach and sight');
  assert.ok(w.prop.pos.y - P.pos.y > 7, 'and far out of any jump’s');
  assert.ok(pickUp(P, w.prop, { from: 'hook' }), 'the hook brings it down into his hands');
  assert.equal(via([55, UP, 57], [59, UP, 52], [59, 0, 27]), true, `down the gallery's stair, carrying it (${where()})`);
  const plate = rt.piece('pS'), dir = plate.pos.clone().sub(P.pos).setY(0).normalize();
  assert.equal(walk(plate.pos.clone().addScaledVector(dir, -4.5), { tol: 0.5 }) && walk(plate.pos.clone().addScaledVector(dir, -1.6), { tol: 0.4, run: false }), true, `up to the scale's floor pan (${where()})`);
  const put = bestInteractable(P);
  assert.equal(put?.entry.id, 'carry.put', 'the button puts it down');
  put.entry.use(P);
  wait(2);
  assert.equal(rt.logic.weightOn('wS'), 'pS', 'the weight in the floor pan');
  assert.ok(rt.logic.check(rt.logic.el('kG').when), 'both pans weighed: the beam levels, the great key’s cage sinks');
  assert.equal(walk(rt.piece('kG').pos, { tol: 1.2 }), true, `to the great key (${where()})`);
  openChest(rt, 'kG', P);
  wait(3);
  assert.equal(rt.logic.isFound('kG'), true, 'the great key');
  // ---- out through the keepers' door and the east gate (cold) onto the Pouring Hall
  assert.equal(via([34, 0, 30], [26, 0, 30], [18, 0, 30.5]), true, `through the keepers' door and the east gate (${where()})`);
  assert.equal(walk(L(14, 0, 36)), true, `onto the hall's floor (${where()})`);
  // ---- the pour let in again at the hall's tap: the founders' moon drawn over the spine's heat into the great cradle
  assert.equal(via([9, 0, 34], [9, 0, 25]), true, `over the Runner by a plate (${where()})`);
  assert.equal(turn('floor'), 'poured');
  assert.equal(draw('mG', 'pG'), true, 'the founders’ moon drawn across the spine into its cradle');
  wait(1.5);
  assert.ok(said(/round the founders’ moon/), 'the pour runs round it: the founders’ last cast');
  // ---- the Founders' Door: the great key, and the cradle hot
  assert.equal(via([8, 0, 74], [0, 0, HALL.z1 - 1.6]), true, `round the basin to the Founders' Door (${where()})`);
  wait(2.5);
  assert.ok(rt.logic.keysIn('dF') === 1 && rt.logic.isOpen('dF'), `the great key in it: the Founders’ Door (keys ${rt.logic.keysIn('dF')}, big ${rt.logic.keys('big')}, at ${where()})`);
  assert.equal(walk(L(0, 0, HALL.z1 + 10)) && walk(L(0, 0, 126)), true, `down the cold passage under the furnace (${where()})`);
  const mark = rt.marks.find((m) => m.room === 'ante');
  assert.ok(mark && mark.pos.distanceTo(rt.piece('dA').group.position) < 10, 'the guardian’s checkpoint a short walk from its door (G6)');
  game.reset();
  own();
});

test('the Casting-House’s sill (issue #416, G6): off the gallery into the bed of moulding sand on the hall’s floor, unhurt', () => {
  const H = house(), { rt, P, L, walk, wait, where, local, frame, toward } = H;
  wait(0.3);
  P.teleport(L(SILL.x - 3, UP + 0.1, (SILL.z0 + SILL.z1) / 2), V(0, 1, 0), V(0, 0, 1));
  wait(0.5);
  assert.ok(P.onGround && Math.abs(local().y - UP) < 0.5, `on the gallery by the sill (${where()})`);
  const h0 = P.health;
  const bed = L(SILL.bed[0], 0, SILL.bed[1]);
  let landed = false;
  for (let i = 0; i < 8 / DT; i++) { frame({ KeyW: true }, toward(bed)); if (P.onGround && local().y < 1) { landed = true; break; } }
  assert.ok(landed, `down on the hall's floor (${where()})`);
  wait(0.5);
  assert.equal(P.health, h0, 'unhurt');
  assert.ok(Math.hypot(local().x - SILL.bed[0], local().z - SILL.bed[1]) < SILL.r + 1.5, 'in the bed of sand');
  game.reset();
  own();
});

test('the pour reads the same everywhere (G1): every gauge and tap lamp follows it, the gates’ sheets fall only while it pours, the crucible tips', () => {
  const H = house(), { rt, wait } = H;
  wait(0.3);
  const lamp = rt.pour.lamp.uniforms.uColor.value.clone();
  const gauges = rt.pieces.filter((p) => p instanceof PourGauge), top = () => rt.pour.irons.geometry.boundingSphere;
  assert.ok(gauges.length >= 12 && rt.pour.columns.length === gauges.length && rt.pour.irons.visible, `poured: the iron up in all ${gauges.length} gauges (one mesh)`);
  rt.pour.toggle();
  wait(POUR.run + 0.5);
  assert.ok(rt.pour.k === 0 && !rt.pour.irons.visible, 'cold: every gauge’s iron gone');
  assert.ok(!rt.pour.lamp.uniforms.uColor.value.equals(lamp), 'the lamps’ colour changes');
  assert.ok(rt.pieces.filter((p) => p.sheet).every((p) => !p.sheet.visible), 'no iron down the gates');
  const C = rt.pieces.find((p) => p.stream);
  assert.ok(C && !C.stream.visible && Math.abs(C.bowl.rotation.x) < 1e-3, 'the crucible upright, no stream');
  rt.pour.toggle();
  wait(POUR.run + 0.5);
  assert.ok(C.stream.visible && C.bowl.rotation.x < -0.5, 'poured: the crucible tipped, its stream falling');
  assert.ok(rt.pieces.filter((p) => p.sheet).every((p) => p.sheet.visible), 'iron down every shut gate');
  assert.equal(rt.pieces.filter((p) => p instanceof PourTap).length, POUR.taps.length);
  game.reset();
  own();
});
