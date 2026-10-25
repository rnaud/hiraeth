// The Engine-House round its Engine Hall (issue #415, docs/design/temple-best-practices.md: G1, G2, G3b, G4, G6): the engine's
// clutch is the house's one state, its power up the upper shaft (the upper floor's pistons and hammer run) or down the lower
// (the lower floor's), set at a lever by every hub and shown by a gauge in every room; the Boiler Keeper, the house's
// mini-boss, guards the chest; the great hall seen on both floors at once and the drop from its gallery back to the floor;
// the Furnace's clutch hooked while the bombs wake its eyes. The house walked through with a real traveller: every lever
// pulled with the use button, every ball pushed along its groove, the drop fallen, the ring hooked from where he stands,
// the Tooth-Warden stopped. Its state machine is tests/temples.test.js's, its play-through by hits
// tests/temple-playthrough.test.js's; this is the feet.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { templeOf } from '../src/temples/attachment.js';
import { EH, GALLERY, ENGINE, PISTONS, LEVERS, BOILER, CHAMBER, WING, CRANK, PASSAGE, FURNACE, HALL, UP, KEEPER, POWER_LOOK, UPPER, LOWER, CLUTCH, GreatEngine } from '../src/temples/buried.js';
import { createBuried } from '../src/levels/buried.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { bestInteractable } from '../src/interact.js';
import { updateHazards } from '../src/hazards.js';
import { HOOK } from '../src/gadgets/hook.js';
import { blast } from '../src/gadgets/kit.js';
import { Foes } from '../src/foes.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };

/** The house built in its world, a traveller at its door and his hands. */
function house() {
  game.reset();
  own('backpack', 'gun', 'doublejump', 'hook');
  const scene = new THREE.Scene();
  const level = quiet(() => createBuried(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, 'buried');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const path = (...pts) => pts.every((p) => walk(L(...p)));
  const wait = (s, until = () => false) => { for (let i = 0; i < s / DT; i++) { if (until()) return true; frame(); } return until(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const said = (re) => notes.some((n) => re.test(n));
  const sight = (to, from = P.pos.clone().add(V(0, 1.5, 0))) => { const d = to.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.9; };
  /** Push a ball along its groove (way: +1 along it, -1 back), from behind it, until done() (or n pushes). */
  const roll = (ball, way, done, n = 8) => {
    const d = ball.dir.clone().multiplyScalar(way);
    for (let k = 0; k < n && !done(); k++) {
      P.teleport(ball.center.clone().addScaledVector(d, -2.2).setY(ball.group.position.y + 0.1), V(0, 1, 0), V(0, 0, 1));
      wait(0.2);
      ball.hit('push', d.clone(), { strength: 0.8 });
      wait(2.6);
    }
    return done();
  };
  /** The use button by a clutch lever: pulled (where the power went). */
  const toLever = (room) => { const lv = LEVERS.find((l) => l.room === room), [x, y, z] = lv.at, s = Math.sin(lv.yaw), c = Math.cos(lv.yaw); return walk(L(x - s * 1.3, y, z - c * 1.3), { tol: 0.45 }); };
  const pull = (room) => { const near = bestInteractable(P); assert.equal(near?.entry.id, `temple.buried.lever.${room}`, `by the ${room} lever, the button pulls it (${where()})`); return near.entry.use(P); };
  const board = (pis, low) => {
    for (let i = 0; i < 30 / DT && !((low ? pis.s < 0.15 : pis.s > pis.total - 0.15) && pis.wait > 0.3); i++) frame();
    assert.equal(walk(pis.group.position, { tol: 0.6, run: false, max: 2.5, dy: 0.9 }), true, `onto a piston (${where()})`);
  };
  /** Up the hall's three pistons onto the gallery's north arm. */
  const ride = () => {
    const pistons = rt.pieces.filter((p) => p.path && p.o.when);
    assert.equal(walk(L(0, 0, PISTONS[0] - 2.9)), true, `to the pistons (${where()})`);
    board(pistons[0], true); board(pistons[1], true); board(pistons[2], true);
    for (let i = 0; i < 20 / DT && pistons[2].s < pistons[2].total - 0.1; i++) frame();
    return walk(L(0, UP, GALLERY.north + 2.5), { max: 3 });
  };
  const openChest = (id) => { const near = bestInteractable(P); assert.equal(near?.entry.id, `temple.buried.${id}`, `by the chest of ${id} (${where()})`); near.entry.use(P); };
  const lamps = () => { const E = rt.greatEngine; return { up: E.up.uniforms.uGlow.value, low: E.low.uniforms.uGlow.value }; };
  return { level, physics, rt, P, notes, L, frame, walk, path, wait, where, said, sight, roll, toLever, pull, ride, openChest, lamps, toward };
}

test('the Engine-House on foot (issue #415): the engine woken, the clutch thrown at its levers, the gallery and the drop, the firebox door, the chest past the Boiler Room, the governor’s shutter held by its ball, the great key, the bulkhead and the hammer jammed, the passage’s pistons, the Furnace’s clutch hooked with the bombs, the Tooth-Warden stopped, the pipe-cart', () => {
  const H = house(), { rt, P, L, walk, path, wait, where, said, sight, roll, toLever, pull, ride, openChest, lamps, frame, toward } = H;
  const E = rt.greatEngine;
  wait(0.5);
  assert.ok(E instanceof GreatEngine && E.upper && !E.running, 'the engine still, its clutch on the upper shaft');
  // ---- the Engine Hall (G4): 44 by 70 m under 32, its gallery 7 m up round the north end and the west side, seen at once
  assert.ok(EH.z1 - EH.z0 >= 60 && EH.h >= 30, 'a great hall: 60 m and more');
  const floorEye = L(12, 1.7, 18);   // (by the way in, east of the engine)
  const seen = [[-17, 45], [-17, 60], [-10, 78], [10, 78]].filter(([x, z]) => sight(L(x, UP + 1.8, z), floorEye));
  assert.ok(seen.length >= 3, `the gallery seen from the floor, both floors at once (${JSON.stringify(seen)})`);
  assert.ok(sight(E.center0, floorEye), 'the engine seen from the way in');
  // ---- the engine: its valve's eye alone does nothing, a ball sits in its crank's teeth
  rt.piece('s1').hit('shoot');
  wait(1);
  assert.ok(!E.running && said(/jams its crank/), 'the valve hisses, and it says why');
  const ball0 = rt.piece('ball0');
  assert.equal(roll(ball0, -1, () => rt.logic.drumOn('ball0', 'pY')), true, `the ball out of the engine's teeth (${ball0.t.toFixed(2)})`);
  wait(1);
  assert.ok(E.running && said(/engine wakes/), 'the engine runs');
  ball0.hit('push', ball0.dir.clone(), { strength: 0.8 }); wait(2.5);
  assert.ok(rt.logic.drumOn('ball0', 'pY') && E.running, 'out of the teeth it stays out: the engine runs on');
  wait(1.5);
  assert.ok(lamps().up > 0.6 && lamps().low < 0.2, `the upper lamps lit, the lower dark (${JSON.stringify(lamps())})`);
  // ---- up the pistons, and the drop back down (G6): the gallery's west side open over the floor for 10 m, unhurt
  assert.equal(ride(), true, `onto the gallery (${where()})`);
  assert.equal(rt.logic.isOpen('dU'), true, 'the bulkhead up while the upper shaft turns');
  const hearts = P.health?.hp ?? P.hp;
  assert.equal(path([-10, UP, 77], [-18.5, UP, 70], [-18.5, UP, 49]), true, `along the gallery to the drop (${where()})`);
  for (let i = 0; i < 3 / DT && rt.kit.local(P.pos).y > 0.5; i++) frame({ KeyW: true }, toward(L(-8, 0, 49)));
  wait(1);
  assert.ok(rt.kit.local(P.pos).y < 0.5 && P.onGround && !P.dead, `down on the hall's floor (${where()})`);
  assert.equal(P.health?.hp ?? P.hp, hearts, 'unhurt');
  // ---- the floor's lever: the power down the lower shaft; the firebox door rises
  assert.equal(walk(L(-9, 0, 34)), true);
  assert.equal(rt.logic.isOpen('dF'), false, 'the firebox door down while the upper shaft turns');
  assert.equal(toLever('pistons'), true, `to the floor's lever (${where()})`);
  assert.equal(pull('pistons'), 'lower');
  wait(1.5);
  assert.ok(!E.upper && rt.logic.isOpen('dF') && !rt.logic.isOpen('dU'), 'lower: the firebox door up, the bulkhead down');
  assert.ok(lamps().low > 0.6 && lamps().up < 0.2, 'the lower lamps lit, the upper dark');
  // ---- the Boiler Room (G3b): its doors shut behind you while its keeper stands
  const keeper = [{ room: 'boiler', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keeper];
  assert.equal(path([14, 0, BOILER.z], [24, 0, BOILER.z], [BOILER.x - 8, 0, BOILER.z]), true, `into the Boiler Room (${where()})`);
  wait(0.3);
  assert.ok(!rt.logic.isOpen('dF') && !rt.logic.isOpen('dC'), 'its doors shut behind you');
  keeper[0].alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arB') && rt.logic.isOpen('dF') && rt.logic.isOpen('dC'), 'beaten: won, both doors let go');
  assert.equal(walk(rt.piece('kS').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3); openChest('kS');
  assert.equal(rt.logic.isFound('kS'), true, 'a small key');
  // ---- the Fourth Chamber: the chest, the four eyes, the shutter west
  const C3 = CHAMBER.z, CX = CHAMBER.x;
  assert.equal(path([BOILER.x, 0, BOILER.z + 10], [CX, 0, C3 - 16], [CX, 0, C3 - 6]), true, `into the chamber (${where()})`);
  items.grant('bomb'); game.emit('box:opened', { id: 'buried.temple.cell' });
  wait(2);
  const k0 = rt.piece('k0');
  blast({ physics: H.physics, player: P }, k0.eyes[0].center.clone().lerp(k0.eyes[1].center, 0.5).setY(L(0, 0.2, 0).y));
  assert.equal(k0.awake(), 2, 'the blast wakes the two eyes either side of it');
  k0.hit(2); k0.hit(3);
  assert.equal(rt.logic.isLit('k0'), true, 'with the bombs, four in a breath');
  wait(2.5);
  assert.ok(rt.logic.isOpen('dS'), 'the shutter west rolls up');
  // ---- the governor's shutter: wound up by the lower shaft, held by a ball in its crank
  assert.equal(rt.logic.isOpen('dG'), false);
  const bD = rt.piece('bD');
  assert.equal(roll(bD, 1, () => rt.logic.drumOn('bD', 'pD')), true, 'the ball into the shutter’s crank');
  wait(2.5);
  assert.equal(rt.logic.isOpen('dG'), true, 'held up');
  // ---- the Governor Room: one ball between the hammer's crank and the pistons', on the lower shaft
  const GV = WING.gov;
  assert.equal(path([CX + 5, 0, C3 + 6], [CX + 3, 0, C3 + 12], [CX, 0, C3 + CHAMBER.r + 2], [GV.x, 0, GV.z - 13], [GV.x + 6, 0, GV.z - 8]), true, `into the Governor Room (${where()})`);
  const k3 = rt.piece('k3'), bQ = rt.piece('bQ'), kB = rt.piece('kB'), h2 = rt.piece('h2');
  assert.equal(kB.free(), false, 'the great key caged on its anvil');
  assert.equal(roll(bQ, 1, () => rt.logic.drumOn('bQ', 'pQ')), true, 'the ball into the pistons’ crank');
  wait(1.5);
  assert.ok([0, 1, 2, 3].every((i) => k3.isUp(i)), 'all four stand up together');
  let fell = false;
  for (let i = 0; i < 4 / DT; i++) { frame(); fell ||= h2.down > 0.9; }
  assert.ok(fell, 'and the hammer runs, down on the cage');
  for (let i = 0; i < 4; i++) k3.hit(i);
  assert.equal(rt.logic.isLit('k3'), true, 'four in a breath');
  assert.equal(roll(bQ, -1, () => rt.logic.drumOn('bQ', 'pH')), true, 'the ball back into the hammer’s crank');
  wait(2.6);
  assert.equal(kB.free(), true, 'the cage sinks');
  assert.equal(walk(kB.pos, { tol: 1.2 }), true, `to the anvil (${where()})`);
  wait(0.3); openChest('kB');
  assert.equal(rt.logic.isFound('kB'), true, 'the great key');
  // ---- back through the chamber and its shutter into the hall (the loop), up the pistons (they ride either way)
  assert.equal(path([GV.x, 0, GV.z - 13], [CX, 0, C3 + 14], [CX - 6, 0, C3], [CX - CHAMBER.r - 1, 0, C3], [16, 0, C3]), true, `back into the hall (${where()})`);
  assert.equal(ride(), true, `onto the gallery again (${where()})`);
  assert.equal(walk(L(0, UP, EH.z1 + 3), { max: 4 }), false, 'the bulkhead keeps you out while the lower shaft turns');
  assert.ok(said(/./));
  assert.equal(toLever('gallery'), true, `to the gallery's lever by the drop (${where()})`);
  assert.equal(pull('gallery'), 'upper');
  wait(2);
  assert.ok(rt.logic.isOpen('dU'), 'upper: the bulkhead rises');
  // ---- the Crank Hall: the hammer runs on the upper shaft; the near landing's ball jams it
  const hammer = rt.piece('h1');
  assert.equal(path([-18.5, UP, 72], [-18.5, UP, 79], [0, UP, 79], [0, UP, CRANK.z0 + 3], [0, UP, CRANK.W0 - 1.4]), true, `to the walkway (${where()})`);
  let moved = false; const ph = hammer.phase;
  for (let i = 0; i < 2 / DT; i++) { frame(); moved ||= hammer.phase !== ph; }
  assert.ok(moved, 'the hammer runs');
  const ballJ = rt.piece('ballJ');
  assert.equal(roll(ballJ, 1, () => rt.logic.drumOn('ballJ', 'pJ')), true, 'the ball into its crank');
  wait(2.6);
  assert.ok(rt.logic.isOpen('h1') && hammer.down < 0.01, 'jammed at the top of its stroke');
  P.teleport(L(0, UP + 0.1, CRANK.W0 - 1.9), V(0, 1, 0), V(0, 0, 1)); wait(0.3);
  assert.equal(walk(L(0, UP, CRANK.W1 + 2.2), { run: false }), true, `over the walkway (${where()})`);
  // ---- the Crank Passage: four eyes on pistons that rise in turn on the upper shaft; its ball holds them all up
  assert.equal(path([0, UP, CRANK.z1 - 3], [0, UP, PASSAGE.z0 + 3], [-9, UP, PASSAGE.z0 + 6]), true, `into the passage (${where()})`);
  const k1 = rt.piece('k1'), bK = rt.piece('bK');
  assert.equal(roll(bK, 1, () => rt.logic.drumOn('bK', 'pK')), true, 'the ball into the crank');
  wait(2);
  assert.ok([0, 1, 2, 3].every((i) => k1.isUp(i)), 'all four stand up together');
  for (let i = 0; i < 4; i++) k1.hit(i);
  assert.equal(rt.logic.isLit('k1'), true);
  assert.equal(path([8, UP, PASSAGE.QZ + 3], [0, UP, PASSAGE.z1 - 3]), true, `to the passage's door (${where()})`);
  walk(L(0, UP, PASSAGE.z1 + 2), { max: 3 });
  wait(2.5);
  assert.equal(rt.logic.isOpen('d3'), true, 'the small key in it, its eyes awake');
  // ---- the Furnace: two balls hold the west pistons up; the east two only while the clutch, hooked, bites (G2)
  const F0 = FURNACE.z0, FL = F0 + FURNACE.lip, FG = FL + FURNACE.gap;
  assert.equal(path([0, UP, PASSAGE.z1 + 2], [0, UP, F0 + 4]), true, `to the furnace (${where()})`);
  const k2 = rt.piece('k2');
  for (const [id, plate] of [['bA', 'pA'], ['bB', 'pB']]) assert.equal(roll(rt.piece(id), 1, () => rt.logic.drumOn(id, plate)), true, `${id} into its crank`);
  wait(2);
  assert.ok(k2.isUp(0) && k2.isUp(1) && !(k2.isUp(2) && k2.isUp(3)), 'the west two stand; the east two never together');
  assert.equal(walk(L(FURNACE.ring[0], UP, FL - 1.5), { tol: 0.5 }), true, `to where the ring is hooked from (${where()})`);
  const ring = rt.piece('hb.clutch');
  assert.ok(ring.at.distanceTo(P.pos) <= HOOK.range && sight(ring.at), 'the clutch’s ring in the hook’s reach and sight');
  ring.hit('push', { mode: 'hook' });
  wait(1.5);
  assert.ok(rt.logic.isLit('cF') && [0, 1, 2, 3].every((i) => k2.isUp(i)), 'the clutch bites: all four stand up');
  // a bomb among the two east eyes, a splash each for the west ones
  blast({ physics: H.physics, player: P }, k2.eyes[2].center.clone().lerp(k2.eyes[3].center, 0.5).setY(L(0, UP + 0.2, 0).y + 3.2));
  k2.hit(0); k2.hit(1); k2.hit(2); k2.hit(3);
  assert.equal(rt.logic.isLit('k2'), true, 'four in a breath');
  wait(CLUTCH.hold);
  assert.equal(rt.logic.isLit('cF'), false, 'the clutch slips again in time');
  wait(2);
  assert.equal(walk(L(0, UP, FL - 2)) && walk(L(0, UP, FG + 2)), true, `over the bridge (${where()})`);
  // ---- the great door, the antechamber's mark (G6: the guardian's checkpoint a few steps from it), the Tooth-Warden
  const m = rt.marks.find((x) => x.room === 'ante');
  assert.ok(m && Math.abs(rt.kit.local(m.spot).z - (HALL.z - HALL.r)) < 8, 'the antechamber’s mark by the warden’s door');
  assert.equal(walk(L(0, UP, HALL.z - 17.7), { max: 40 }), true, `into the hall (${where()})`);
  const G = rt.guardian, bG = rt.piece('bG');
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  const opening = () => { for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') return true; } return false; };
  for (let n = 0; n < 14 && G.state !== 'resolved'; n++) {
    assert.ok(opening(), `its vents open (${n}, phase ${G.phaseIndex})`);
    if (G.phaseIndex >= 1 && !rt.gearJammed()) { roll(bG, 1, () => rt.logic.drumOn('bG', 'pG')); continue; }
    for (let i = 0; i < 4; i++) rt.volley(i);
  }
  assert.equal(G.state, 'resolved', `stopped (${G.meter})`);
  assert.equal(game.flag('temple.buried.done'), true);
  wait(2.5);
  assert.ok(rt.logic.isOpen('d5'));
  // ---- outside: the pipe-cart rides the canyon again
  const cart = rt.change.cart;
  for (let i = 0; i < 60 / DT && !(cart.s < 0.3 && cart.wait > 2); i++) frame();
  P.teleport(cart.group.position.clone().add(V(0, 0.2, 0)), V(0, 1, 0), V(0, 0, 1));
  const z0 = P.pos.z;
  wait(28);
  assert.ok(P.pos.z < z0 - 80 && P.onGround, `carried down the canyon (${(z0 - P.pos.z).toFixed(0)} m)`);
  game.reset();
  own();
});

test('the Boiler Keeper (issue #415, G3b): the Boiler Room’s one foe, a furnace brute grown huge; its slam winds up long, sends a quake you jump and leaves its fists stuck for the blade: the Tooth-Warden’s slam and open vents, a room early', () => {
  const H = house(), { rt, P, L, level, physics, wait } = H;
  const foes = new Foes({ scene: new THREE.Scene(), level, levelId: 'buried', physics, player: P, settings: { enemies: 'normal' }, game });
  foes.placeMachinesIn(rt);
  const ks = rt.machines.filter((f) => f.room === 'boiler');
  assert.equal(ks.length, 1, 'alone in its room');
  const K = ks[0];
  assert.equal(K.kind, 'brute');
  assert.ok(K.keeper && K.def.name === 'the Boiler Keeper' && K.hp === KEEPER.def.hp && K.hp >= 2 * 8, `stronger than a brute (${K.hp})`);
  assert.equal(K.model.size, KEEPER.size);
  assert.ok(!rt.machines.some((f) => f.room !== 'boiler'), 'no machine in a puzzle room');
  // its telegraphs: every move winds up a second or more; the slam the longest, and it opens after (the warden's lesson)
  const slam = K.def.attacks.find((a) => a.id === 'slam');
  for (const a of K.def.attacks) assert.ok(a.wind >= 1.0, `${a.id} winds up ${a.wind} s`);
  assert.ok(slam.wind >= 1.4 && slam.wave?.reach > 0 && slam.opens >= 2 && slam.stuck, 'the slam: a long wind-up, a quake, and stuck after');
  const warden = rt.guardian.def.attacks.slam;
  assert.ok(warden.wave && warden.open, 'the warden’s slam: a wave, and its vents open after');
  // in the arena: its door holds while it stands; after its slam it is stuck, and the blade lands double
  P.opts.health = false;
  P.teleport(L(BOILER.x - 1.5, 0.1, BOILER.z), V(0, 1, 0), V(0, 0, 1));   // (up close: its slam's reach)
  let wound = 0, stuck = 0, t = 0, maxWind = 0;
  for (let i = 0; i < 30 / DT && !stuck; i++) {
    t += DT; physics.syncMovers(DT); rt.update(DT, t); foes.update(DT);
    if (K.state === 'wind' && K.atk?.id === 'slam') wound += DT; else if (wound) { maxWind = Math.max(maxWind, wound); wound = 0; }
    if (K.reel === 'stuck' && K.stunned > 0) stuck = K.stunned;
  }
  assert.ok(!rt.logic.isOpen('dF') && !rt.logic.isLit('arB'), 'held shut while it stands');
  assert.ok(stuck >= 2, `its fists stuck after the slam (${stuck.toFixed(2)} s)`);
  assert.ok(maxWind >= 1.3, `its wind-up seen (${maxWind.toFixed(2)} s)`);
  const hp = K.hp;
  foes.hurt(K, 'blade', V(0, 0, 1), { damage: 1 });
  assert.equal(hp - K.hp, 2, 'the blade lands double while it is stuck');
  for (let i = 0; i < 40 && K.alive && K.dead === undefined; i++) { K.stunned = 2; foes.hurt(K, 'blade', V(0, 0, 1), { damage: 1 }); }
  for (let i = 0; i < 4 / DT; i++) { t += DT; rt.update(DT, t); foes.update(DT); }
  assert.ok(rt.logic.isLit('arB') && rt.logic.isOpen('dC'), 'beaten: the arena won, the door north to the chest opens');
  game.reset();
  own();
});

test('the engine’s power is shown in every room but the guardian’s: a gauge of two lamps (upper amber over lower blue) and the clutch levers by every hub', () => {
  const { rt } = house();
  const gauges = rt.pieces.filter((p) => p.constructor.name === 'PowerGauge').map((p) => p.o.room);
  for (const r of Object.keys(rt.def.logic.rooms)) if (!['threshold', 'hall', 'out'].includes(r)) assert.ok(gauges.includes(r), `a gauge in ${r}`);
  const levers = rt.pieces.filter((p) => p.constructor.name === 'PowerLever').map((p) => p.o.room);
  assert.deepEqual(levers.sort(), ['cell', 'crank', 'gallery', 'pistons']);
  assert.notEqual(POWER_LOOK.up, POWER_LOOK.low);
  assert.ok(UPPER.all && LOWER.all);
  game.reset();
  own();
});
