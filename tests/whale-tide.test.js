// The Whale-House round its Sounding Hall (issue #412, docs/design/temple-best-practices.md): the tide is the house's one
// state, the sea let in or out at a valve by every hub (and in the Shell Room and the Tank Hall), read on a gauge, a lamp's
// colour and the water's own line in every room. High, it lifts you to ledges and fills the tank behind its glass; low, it
// bares the deep floor and the doors in it, which hold the sea back while it is in. The house walked through with a real
// traveller who swims (src/swim.js, the world's water: src/water.js): every valve turned with the use button, every ball
// rolled, the water ridden up, the Sound swum, the dais's edge and the gallery's Drop fallen into the water, the rungs
// climbed, the weight hooked off its post and carried, the Listener calmed. The spring boots' stomp is its event (as the
// house hears it: underwater.js onConnect). Its state machine is tests/temples.test.js's, its play-through by hits
// tests/temple-playthrough.test.js's; this is the feet.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { HALL, SOUND, GALLERY, DEEP, ROOMS, TIDE, COLUMN, STORE, TideGauge, TideWater, TideValve, TideGlass } from '../src/temples/underwater.js';
import { Dish } from '../src/temples/pieces.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Waters, breathShown } from '../src/water.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { bestInteractable } from '../src/interact.js';
import { updateHazards } from '../src/hazards.js';
import { HOOK } from '../src/gadgets/hook.js';
import { pickUp } from '../src/carry.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };
const TK = ROOMS.tank, TZ = (TK.z0 + TK.z1) / 2, HC = ROOMS.horn, WZ = ROOMS.wing.z, LO = TIDE.hall[0], HI = TIDE.hall[1];

/** The Whale-House built in its world, its water found as the game finds it, a traveller at its door who swims, and his hands. */
function house() {
  game.reset();
  own('backpack', 'gun', 'hook');
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME.underwater ?? 'underwater').create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const waters = new Waters(scene, { physics, drops: false });
  const rt = templeOf(level, 'underwater');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, water: waters });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers?.(DT); rt.update(DT, t); waters.update(DT, t, { player: P, bake: false }); P.update(DT, input, yaw); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s, until = () => false) => { for (let i = 0; i < s / DT; i++) { if (until()) return true; frame(); } return until(); };
  const local = () => rt.kit.local(P.pos);
  const where = () => local().toArray().map((v) => v.toFixed(1)).join(', ');
  const via = (...pts) => pts.every((q) => walk(L(...q)));
  /** Swim (or walk) toward a point until standing on dry ground at its height (a mantle out of the water), or `s` seconds. */
  const out = (q, s = 40) => { const to = L(...q); for (let i = 0; i < s / DT; i++) { if (P.onGround && !P.swim && Math.abs(local().y - q[1]) < 0.6) return true; frame({ KeyW: true }, toward(to)); } return false; };
  /** Walk off an edge toward a point below it until in the water. */
  const into = (q, s = 12) => { const to = L(...q); for (let i = 0; i < s / DT; i++) { if (P.swim) return true; frame({ KeyW: true }, toward(to)); } return !!P.swim; };
  const sight = (to, from) => { const d = to.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.9; };
  /** The use button by a valve: turned (the valve's id: `valve.<its room or name>`). */
  const turn = (id) => { const near = bestInteractable(P); assert.equal(near?.entry.id, `temple.underwater.${id}`, `by ${id}, the button turns it (${where()})`); return near.entry.use(P); };
  const high = () => rt.logic.drumOn('tide', 'tHigh'), low = () => rt.logic.drumOn('tide', 'tLow');
  /** The spring boots' stomp where he stands (or at `at`): the deep note, as the house hears it. */
  const stomp = (at = P.pos) => game.emit('gadget:stomp', { at: at.clone() });
  /** Push a ball along its groove (toward its b end) until it rests on `plate`. */
  const roll = (id, plate, n = 12) => {
    const ball = rt.piece(id);
    for (let k = 0; k < n && !rt.logic.drumOn(id, plate); k++) {
      walk(ball.center.clone().addScaledVector(ball.dir, -2.3).setY(P.pos.y), { tol: 0.5, max: 8 });
      ball.hit('push', ball.dir.clone(), { strength: 1 });
      wait(2.8);
    }
    return rt.logic.drumOn(id, plate);
  };
  return { level, physics, waters, rt, P, notes, L, frame, toward, walk, wait, local, where, via, out, into, sight, turn, high, low, stomp, roll, said: (re) => notes.some((n) => re.test(n)) };
}

test('the Whale-House on foot (issue #412): the deep floor bare, the west wing, the Shell Room’s floor door, the water ridden up to its ledge and the Sound swum to the dais, the spring boots, the dais’s edge fallen into the Sound, the Horn Store with the tide out, the tide let in again and the Song Passage, the tank’s ear through its full water and the rungs, the High Walk, the weight hooked off its post, the dish, the tide let out and the Drop, the Listener’s door and the Listener calmed', () => {
  const H = house(), { rt, P, L, walk, wait, where, local, via, out, into, sight, turn, high, low, stomp, roll, said, frame, toward } = H;
  const G = GALLERY;
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), `standing in the Porch (${where()})`);
  assert.ok(low() && rt.tide, 'the tide starts out');
  // ---- G4: the Sounding Hall, 76 m long, its three floors seen at once from the south quay
  assert.ok(HALL.z1 - HALL.z0 >= 60 && HALL.top - SOUND.floor >= 40, 'a great hall: 60 m and more, 43 m high');
  assert.equal(walk(L(0, 0, 19)), true, `into the Sounding Hall (${where()})`);
  const eye = L(0, 1.7, 22);
  for (const [x, y, z] of [[6, DEEP + 1, 40], [0, 1.5, 70], [0, G.y + 2, 66]]) assert.ok(sight(L(x, y, z), eye), `the deep floor, the dais and the gallery seen from the quay (${x}, ${y}, ${z})`);
  // (G1, readable everywhere: a gauge in every room but the guardian's)
  const gauges = new Set(rt.placed.filter((p) => p.cls === 'TideGauge').map((p) => p.o.room));
  for (const r of Object.keys(rt.def.logic.rooms)) if (!['arena', 'out', 'threshold'].includes(r)) assert.ok(gauges.has(r), `a gauge in ${r}`);
  // ---- the deep floor: down the stair, the ball into the cradle, the pillar's eye: the west door
  assert.equal(via([-15, 0, 22], [-15, DEEP, 43.5]), true, `down the stair to the deep floor (${where()})`);
  assert.equal(roll('b1', 'p1'), true, `the ball into its cradle (${where()})`);
  wait(1);
  rt.piece('eD').hit('shoot');
  wait(1.5);
  assert.ok(rt.logic.isLit('eD') && rt.logic.isOpen('d1'), 'the eye wakes: the west door, up on the quay');
  // ---- the Pool Room: the pool's eye over the glass, the ball into its cradle: the Shell Room's floor door
  assert.equal(via([-15, DEEP, 43], [-15, 0, 23], [-21, 0, 30], [-21, 0, WZ], [-31, 0, WZ]), true, `up and into the Pool Room (${where()})`);
  rt.piece('eP').hit('shoot');
  assert.equal(roll('b2', 'p2'), true, `the pool room's ball (${where()})`);
  wait(1);
  assert.ok(rt.logic.isLit('eP') && rt.logic.isOpen('d2'), 'its eye lit; the floor door across the hall sinks with the tide out');
  // ---- the Shell Room, in at its floor door: its ball, its eye; its valve lets the sea in and the water lifts him out
  assert.equal(via([-31, 0, WZ], [-21, 0, WZ], [-21, 0, 26], [-15, 0, 23], [-15, DEEP, 43], [10, DEEP, WZ], [22, DEEP, WZ], [32, DEEP, WZ]), true, `through the floor door into the Shell Room (${where()})`);
  assert.equal(roll('bS', 'pS'), true, `the shell's ball (${where()})`);
  wait(1);
  rt.piece('eS').hit('shoot');
  wait(1.5);
  assert.ok(rt.logic.isLit('eS') && rt.logic.isOpen('dH') && rt.logic.isOpen('dE'), 'the shell’s eye: the Horn Door’s second lamp, and the ledge’s door onto the quay');
  const V0 = TIDE.valves.find((v) => v.room === 'shells');
  assert.equal(walk(L(V0.at[0] - 1.5, DEEP, V0.at[2]), { tol: 0.5 }), true, `to the Shell Room's valve (${where()})`);
  assert.equal(turn('valve.shells'), 'up');
  assert.ok(high() && !rt.logic.isOpen('d2'), 'the sea comes in: the floor door shuts against it');
  wait(TIDE.run + 1);
  assert.ok(P.swim && local().y > HI - 2, `the water rose and he floats on it (${where()})`);
  assert.equal(out([31, 0, WZ]), true, `swum to the ledge's stage and out onto it (${where()})`);
  // ---- the loop: the ledge's door onto the east quay; the Sound swum to the dais
  assert.equal(via([26, 0, WZ], [21, 0, WZ], [21, 0, SOUND.z0 - 2]), true, `onto the east quay (${where()})`);
  assert.equal(into([21, HI, SOUND.z0 + 4]), true, `into the Sound (${where()})`);
  assert.equal(out([21, 0, SOUND.z1 + 3]), true, `swum across and out onto the dais (${where()})`);
  // ---- the Horn Chamber: the spring boots; the try
  assert.equal(via([HC.x, 0, HALL.z1 - 3], [HC.x, 0, HALL.z1 + 4], [HC.x, 0, HC.z - 6]), true, `through the Horn Door (${where()})`);
  items.grant('springs'); game.emit('box:opened', { id: 'underwater.temple.horn' });
  wait(0.3);
  assert.equal(rt.logic.gadget, true);
  stomp(rt.piece('eT').at.clone().setY(L(0, 0, 0).y));
  wait(0.3);
  assert.ok(rt.logic.isLit('eT') && said(/Nothing opens/), 'the try: the little horn answers, nothing waits on it');
  // ---- the tide let out at the dais's valve; off the dais's edge into the Sound, unhurt; out onto the deep floor
  const VD = TIDE.valves.find((v) => v.room === 'dais');
  assert.equal(via([HC.x, 0, HALL.z1 + 4], [HC.x, 0, HALL.z1 - 3], [VD.at[0], 0, VD.at[2] - 1.5]), true, `to the dais's valve (${where()})`);
  assert.equal(turn('valve.dais'), 'down');
  wait(TIDE.run + 0.5);
  assert.ok(low() && rt.tide.k === 0, 'the sea has run out');
  const hearts0 = P.hearts;
  assert.equal(walk(L(8, 0, SOUND.z1 + 1)), true, `to the dais's edge (${where()})`);
  assert.equal(into([8, LO, SOUND.z0 + 3]), true, `off the edge, 11 m down into the Sound (${where()})`);
  assert.equal(P.hearts, hearts0, 'the water breaks the fall');
  assert.equal(out([8, DEEP, SOUND.z0 - 3]), true, `out of the Sound onto the deep floor (${where()})`);
  // ---- the Horn Store: its horn on the deep floor, a stomp; its door sinks with the tide out; its keepers; the key
  assert.equal(walk(rt.piece('eSt').at.clone().setY(L(0, DEEP, 0).y).add(V(0, 0, 1.5)), { tol: 0.8 }), true, `to the Horn Store's horn (${where()})`);
  stomp();
  wait(1.5);
  assert.ok(rt.logic.isLit('eSt') && rt.logic.isOpen('dS'), 'the horn wakes, and the Store’s door sinks');
  const keepers = [{ room: 'store', alive: true }, { room: 'store', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(via([STORE.door, DEEP, HALL.quayS + 2], [STORE.door, DEEP, 12], [STORE.door, DEEP, 4]), true, `into the Horn Store (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dS'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arH') && rt.logic.isOpen('dS'), 'won: the door lets go');
  assert.equal(walk(rt.piece('kS').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, 'temple.underwater.kS'); near.entry.use(P);
  assert.equal(rt.logic.isFound('kS'), true);
  // ---- the tide let in again at the deep floor's valve: it lifts him to the dais
  const VV = TIDE.valves.find((v) => v.name === 'deep');
  assert.equal(via([STORE.door, DEEP, 12], [STORE.door, DEEP, HALL.quayS + 3], [VV.at[0], DEEP, VV.at[2] - 1.5]), true, `to the deep floor's valve (${where()})`);
  assert.equal(turn('valve.deep'), 'up');
  wait(TIDE.run + 1);
  assert.ok(P.swim && local().y > HI - 2, `floated up on the sea (${where()})`);
  assert.equal(out([4, 0, SOUND.z1 + 3]), true, `swum to the dais (${where()})`);
  // ---- the Song Passage: the horn by the chamber's north door; the key in the door; through while it rings
  assert.equal(via([HC.x, 0, HALL.z1 - 3], [HC.x, 0, HALL.z1 + 4], [HC.x, 0, HC.z + 6]), true, `into the Horn Chamber (${where()})`);
  stomp(rt.piece('e4').at.clone().setY(L(0, 0, 0).y));
  wait(0.2);
  assert.equal(rt.logic.isLit('e4'), true, 'the passage horn rings');
  assert.equal(walk(L(HC.x, 0, TK.z0 + 4), { max: 9 }), true, `through the door before it rises (${where()})`);
  assert.equal(rt.logic.keysIn('d4'), 1, 'the Horn Store’s key in it');
  // ---- the way back: the dish by the door carries a stomp to the horn on the far side
  wait(11);
  assert.equal(rt.logic.isOpen('d4'), false, 'it rises behind him once the note fades');
  const back = rt.pieces.find((p) => p instanceof Dish && !p.id);
  stomp(back.ends[0].mouth.clone().add(V(0, -1.2, 0)));
  wait(1.2);
  assert.ok(rt.logic.isLit('e4') && rt.logic.isOpen('d4'), 'the dish by the door says the note to the passage horn: the way back');
  // ---- the Tank Hall: the tank full with the tide in; a stomp by the glass reaches its ear through the water; the rungs
  const glassX = TK.gw;
  assert.equal(walk(L(glassX - 1.6, 0, TZ - 4), { tol: 0.5 }), true, `to the glass (${where()})`);
  stomp();
  wait(1);
  assert.ok(rt.logic.isLit('e5') && rt.logic.isOpen('rungs') && rt.logic.isOpen('hatch'), 'the boom through the water: the rungs out and the hatch open');
  assert.equal(walk(L(glassX - 1.2, 0, TZ), { tol: 0.4, run: false }), true, `before the rungs (${where()})`);
  let up = false;
  for (let i = 0; i < 16 / DT; i++) { frame({ KeyW: true }, toward(L(glassX + 3, TK.shelf + 0.5, TZ))); if (P.onGround && local().y > TK.shelf - 0.5) { up = true; break; } }
  assert.ok(up, `up the rungs and through the hatch onto the shelf (${where()})`);
  // ---- the High Walk to the gallery: the weight hooked off its post, carried onto the footstone; the dish's note
  assert.equal(via([5, TK.shelf, TK.z0 + 3], [5, G.y, TK.z0 - 4], [5, G.y, HALL.z1 - 3], [-8, G.y, 66.5]), true, `along the High Walk onto the gallery (${where()})`);
  const w = rt.piece('wG');
  const hand = P.pos.clone().add(V(0, 1.3, 0));
  assert.ok(w.prop.pos.distanceTo(hand) <= HOOK.range && sight(w.prop.pos, hand), 'the weight on its post in the hook’s reach and sight');
  assert.ok(pickUp(P, w.prop, { from: 'hook' }), 'the hook brings it down into his hands');
  const plate = rt.piece('pG'), dir = plate.pos.clone().sub(P.pos).setY(0).normalize();
  assert.equal(walk(plate.pos.clone().addScaledVector(dir, -4.5), { tol: 0.5 }) && walk(plate.pos.clone().addScaledVector(dir, -1.6), { tol: 0.4, run: false }), true, `up to its footstone, facing it (${where()})`);
  const put = bestInteractable(P);
  assert.equal(put?.entry.id, 'carry.put', 'the button puts it down');
  put.entry.use(P);
  wait(1.5);
  assert.equal(rt.logic.weightOn('wG'), 'pG', `on the footstone: the dish wakes (the weight at ${rt.kit.local(w.prop.pos).toArray().map((v) => v.toFixed(2))}, held ${!!w.prop.held}, the plate at ${rt.kit.local(plate.pos).toArray().map((v) => v.toFixed(2))}, he at ${where()})`);
  stomp(rt.piece('dishG').ends[0].mouth.clone().add(V(0, -1.2, 0)));
  wait(1.2);
  assert.ok(rt.logic.isLit('eL'), 'the dish says the note down the hall to the ear on the Listener’s column');
  assert.ok(!rt.logic.isOpen('dL') && said(/holds the sea back/), 'the Listener’s door stays shut under the water, and says why');
  // ---- the tide let out at the gallery's valve; the Drop into the Sound; the Listener's door
  const VG = TIDE.valves.find((v) => v.room === 'gallery');
  assert.equal(walk(L(VG.at[0], G.y, VG.at[2] - 1.5), { tol: 0.5 }), true, `to the gallery's valve (${where()})`);
  assert.equal(turn('valve.gallery'), 'down');
  wait(TIDE.run + 0.5);
  assert.ok(rt.logic.isOpen('dL'), 'the sea out: the Listener’s door sinks');
  const hearts1 = P.hearts;
  assert.equal(walk(L(0, G.y, G.z0 + 1.2), { tol: 0.5 }), true, `to the Drop (${where()})`);
  assert.equal(into([0, LO, G.z0 - 4]), true, `through the Drop, 21 m down into the Sound (${where()})`);
  assert.equal(P.hearts, hearts1, 'the water breaks the fall (G6)');
  assert.equal(out([0, DEEP, SOUND.z0 - 3]), true, `out onto the deep floor, the hub (${where()})`);
  // ---- down the Throat into the Listener's Hall
  assert.equal(via([COLUMN.x + 2, DEEP, COLUMN.z - 3], [-17, DEEP, COLUMN.z], [-26, DEEP, COLUMN.z], [-56, -24, COLUMN.z], [-70, -24, COLUMN.z]), true, `through the Listener's door, down the Throat (${where()})`);
  // ---- the Listener
  const Gd = rt.guardian;
  wait(0.3);
  assert.notEqual(Gd.state, 'sleep', 'it wakes');
  P.opts.health = false;
  const at = (q) => { P.teleport(q.clone().add(V(0, 0.1, 0)), V(0, 1, 0), V(0, 0, 1)); wait(0.3); };
  const rollArena = (id) => {
    const ball = rt.piece(id), plate = rt.logic.el(id).plate, done = () => rt.logic.drumOn(id, plate);
    for (let k = 0; k < 10 && !done(); k++) { at(ball.center.clone().addScaledVector(ball.dir, -2.2).setY(ball.group.position.y)); ball.hit('push', ball.dir.clone(), { strength: 0.8 }); wait(2.6); }
    return done();
  };
  const opening = () => wait(40, () => Gd.state === 'open');
  const nearIt = () => stomp(Gd.model.mouth.clone().add(V(0, -3, 0)));
  for (let n = 0; n < 16 && Gd.state !== 'weary'; n++) {
    assert.ok(opening(), `its ear opens (${n}, phase ${Gd.phaseIndex})`);
    const m = Gd.meter;
    if (Gd.phaseIndex === 0) { nearIt(); assert.ok(Gd.meter > m, `the stomp close by calms it (${n})`); continue; }
    if (!rt.listenerHomed()) { assert.equal(rollArena('bW'), true, 'a stone on a footstone'); assert.ok(opening(), 'its ear opens again'); }
    const m2 = Gd.meter;
    stomp(rt.piece('dishW').ends[0].mouth.clone().add(V(0, -1.2, 0)));
    wait(0.8);
    assert.ok(Gd.meter > m2, `the dish carries the note into its open ear (${n}, phase ${Gd.phaseIndex})`);
  }
  assert.equal(Gd.state, 'weary', `calm (${Gd.meter.toFixed(2)})`);
  for (let i = 0; i < 30 / DT && Math.hypot(Gd.model.pos.x - Gd.model.rest.x, Gd.model.pos.z - Gd.model.rest.z) > 0.6; i++) frame();
  wait(2);
  const toEar = Gd.model.mouth.clone().setY(L(0, -24, 0).y).sub(Gd.model.pos).setY(0).normalize();
  at(Gd.model.mouth.clone().setY(L(0, -24, 0).y).addScaledVector(toEar, 2.5));
  const hand2 = bestInteractable(P);
  assert.equal(hand2?.entry.id, 'temple.underwater.touch', 'a hand on its shell');
  hand2.entry.use(P);
  assert.equal(Gd.state, 'resolved');
  assert.equal(game.flag('temple.underwater.done'), true);
  wait(2.5);
  assert.ok(rt.logic.isOpen('d5'), 'the way out');
  game.reset();
  own();
});

test('the Whale-House’s tide reads the same everywhere (G1): every water, gauge, lamp and the tank’s glass follow it as it runs; the tank’s ear is deaf with it out; under the water the camera keeps off the surface and the breath meter shows', () => {
  const { rt, P, L, wait, walk, where, frame, waters, stomp, said, local } = house();
  const T = rt.tide;
  const gauges = rt.pieces.filter((p) => p instanceof TideGauge), seas = rt.pieces.filter((p) => p instanceof TideWater);
  const valves = rt.pieces.filter((p) => p instanceof TideValve), glass = rt.pieces.find((p) => p instanceof TideGlass);
  assert.ok(gauges.length >= 10 && valves.length === TIDE.valves.length && seas.length === 2 && glass, `a gauge in every room (${gauges.length}), a valve by every hub (${valves.length})`);
  const water = (g) => g.water.scale.y, colour = (p) => p.lampM.uniforms.uColor.value.clone();
  const lo = gauges.map(water), cLo = colour(gauges[0]);
  const hall = seas[0];
  assert.ok(Math.abs(rt.kit.local(hall.mesh.position).y - TIDE.hall[0]) < 0.01, 'the hall’s water at its low mark: only the Sound');
  rt.logic.moveDrum('tide', 1); rt.applyDoors();
  wait(TIDE.run / 2);
  assert.ok(T.k > 0.2 && T.k < 0.8, `it runs (${T.k.toFixed(2)})`);
  wait(TIDE.run);
  assert.equal(T.k, 1, 'and has run');
  gauges.forEach((g, i) => assert.ok(water(g) > lo[i] + 1, 'every gauge’s column up to its high mark'));
  assert.ok(colour(gauges[0]).b > cLo.b + 0.2 && colour(valves[0]).b > cLo.b + 0.2, 'the lamps on the gauges and the valves turn from coral to the sea’s blue');
  for (const s of seas) assert.ok(Math.abs(rt.kit.local(s.mesh.position).y - TIDE.hall[1]) < 0.01, `${s.mesh.name}: at its high mark`);
  assert.ok(glass.air.scale.y < 1 && Math.abs(glass.line.position.y - TIDE.tank[1]) < 0.01, 'the tank full behind its glass');
  // (the world's water follows it: you swim where it stands now)
  const w = waters.surfaceAt(L(0, 0, 40).x, L(0, 0, 40).z, L(0, DEEP, 40).y);
  assert.ok(w && Math.abs(w.y - L(0, TIDE.hall[1], 0).y) < 0.05, 'the water the traveller swims in is at the high mark');
  // ---- under the water: the breath meter; the camera never on the surface
  P.teleport(L(0, TIDE.hall[1] - 1.5, 40), V(0, 1, 0), V(0, 0, 1));
  for (let i = 0; i < 1.2 / DT; i++) frame({ KeyZ: true });
  assert.ok(P.swim?.under && breathShown(P, rt.level), `dived under the tide: the breath meter shows (${where()})`);
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  cam.position.copy(L(0, TIDE.hall[1] + 0.05, 30)); cam.updateMatrixWorld();
  waters.keepCamera(cam, 'over');
  assert.ok(Math.abs(cam.position.y - L(0, TIDE.hall[1], 0).y) >= 0.2, 'the camera kept off the surface');
  cam.position.copy(L(0, TIDE.hall[1] - 3, 30));
  waters.keepCamera(cam, 'under');
  assert.ok(waters.camUnder, 'and under it, the water’s look on the view');
  for (let i = 0; i < 4 / DT && P.swim?.under; i++) frame();
  // ---- the tide out: the tank's ear lies dry and hears nothing
  rt.logic.moveDrum('tide', 0); rt.applyDoors();
  wait(TIDE.run + 0.5);
  items.grant('springs'); rt.logic.takeGadget();
  P.teleport(L(TK.gw - 1.6, 0.1, TZ - 4), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  stomp();
  wait(0.5);
  assert.ok(!rt.logic.isLit('e5') && said(/lies dry/), 'with the tank empty the ear is deaf, and says why');
  assert.ok(glass.air.scale.y > TK.shelf - 1, 'the tank’s glass dark above its low water');
  game.reset();
  own();
});
