// The Undertower round its Great Well (issue #418, docs/design/temple-best-practices.md): the last house as the exam of the
// whole game. The line, the First Sign's word let into the makers' cables (the house speaks: its lift wakes, its cable doors
// and its bellows run, every horn on a cable hears only the word) or shut out (quiet), is the house's one state, set at a
// relay lever by every hub and read on a lamp in every room. One step each for the wings, the hook, the lens and the bombs,
// joined with the hourglass: the bellows' draught, blown for the First Sign's word played back; the high counterweight
// hooked down and ridden back up; the listening pillars, there only through the lens; the Choir's black horn, a blast's boom
// played back. The drops back to the hub (G6), the First Sign's puzzle between its two fights (G3d). The house walked
// through with a real traveller: every lever pulled with the use button, every ball rolled, every ride ridden, every drop
// fallen. Its state machine is tests/temples.test.js's, its play-through by hits tests/temple-playthrough.test.js's.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { ROOMS, WELL, SHELF, BELLOWS, LINE, LINE_LOOK, WEIGHTS, F1, F2, LineLamp } from '../src/temples/bazaar.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { bestInteractable } from '../src/interact.js';
import { updateHazards } from '../src/hazards.js';
import { createEchoShell } from '../src/echo-shell.js';
import { LENS_VIEW } from '../src/gadgets/hidden.js';
import { GADGETS } from '../src/gadgets/registry.js';
import { HOOK } from '../src/gadgets/hook.js';
import { HISTORY } from '../src/gadgets/history.js';
import { allTargets } from '../src/targets.js';
import { answerAsks } from './guardian-asks.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };
const gadget = (id) => GADGETS.find((g) => g.id === id);

/** The Undertower built in its world, a traveller at its door, his hands, the hook, the hourglass and its sand. */
function house() {
  game.reset();
  // (what the route has given by the last house: every older tool; the exam asks for the wings, the hook, the lens, the bombs)
  own('backpack', 'gun', 'doublejump', 'glider', 'hook', 'monocle', 'bomb');
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME.bazaar ?? 'bazaar').create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, 'bazaar');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, unsafe: level.unsafe });
  const notes = [];
  const toast = (s) => notes.push(s);
  rt.connect({ player: P, toast, isNight: () => false });
  const shell = createEchoShell({ player: P, game, items, toast });
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  const ctx = { player: P, physics, camera, tool: null, sound: null, world: null, level, game, hud: { reticle() {} }, sfx: { equip() {} }, fx: new THREE.Group(), scene, aimAt() {}, notice: toast, bursts: { add() {} }, gadget: () => null };
  const H = gadget('hook').create(ctx), R = gadget('recall').create(ctx);
  let t = 0, hurt = 0;
  const h0 = () => P.hearts;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = P.heading ?? 0) => { t += DT; physics.syncMovers?.(DT); rt.update(DT, t); const was = P.hearts; P.update(DT, input, yaw); H.update(DT); R.update(DT); updateHazards(DT, P); shell.update(DT); level.update(DT, t, {}); if (P.hearts < was) hurt += was - P.hearts; };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    // (a target close by and off to the side: he turns to it on the spot first, as a player does, not round it in a circle)
    const want = Math.atan2(to.x - P.pos.x, to.z - P.pos.z);
    if (flat(to) < 9 && Math.abs(Math.atan2(Math.sin(want - P.heading), Math.cos(want - P.heading))) > 0.9) P.heading = want;
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run && flat(to) > 4 }, toward(to)); }
    return false;
  };
  const wait = (s, until = () => false) => { for (let i = 0; i < s / DT; i++) { if (until()) return true; frame(); } return until(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const local = () => rt.kit.local(P.pos);
  const via = (...pts) => pts.every((q) => walk(L(...q)));
  const sight = (to, from = P.pos.clone().add(V(0, 1.5, 0))) => { const d = to.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.9; };
  /** The use button by a relay lever: pulled. */
  const pull = (room) => { const near = bestInteractable(P); assert.equal(near?.entry.id, `temple.bazaar.lever.${room}`, `by the ${room}'s lever, the button pulls it (${where()})`); return near.entry.use(P); };
  const speaking = () => rt.logic.drumOn('line', 'lineSpeaking');
  /** Push a ball along its groove until it rests on its plate. */
  const roll = (id, n = 12) => {
    const ball = rt.piece(id), plate = rt.logic.el(id).plate;
    for (let k = 0; k < n && !rt.logic.drumOn(id, plate); k++) {
      walk(ball.center.clone().addScaledVector(ball.dir, -2.3).setY(P.pos.y), { tol: 0.5, max: 8 });
      ball.hit('push', ball.dir.clone(), { strength: 1 });
      wait(2.8);
    }
    return rt.logic.drumOn(id, plate);
  };
  /** Stand on a counterweight (a hop up onto it) and turn the hourglass on it: ridden back up along its path. */
  const ride = (cw, label, from = null) => {
    const top = () => cw.prop.pos.y + cw.size / 2;
    if (from) walk(cw.prop.pos.clone().add(from).setY(P.pos.y), { tol: 0.5, max: 6 });
    for (let i = 0; i < 4 / DT && !(P.onGround && Math.abs(P.pos.y - top()) < 0.3 && flat(cw.prop.pos) < 0.6); i++) {
      const jump = flat(cw.prop.pos) < 2.2 && P.pos.y < top() - 0.2;
      frame({ KeyW: flat(cw.prop.pos) > 0.3, Space: jump }, toward(cw.prop.pos));
    }
    assert.ok(P.onGround && Math.abs(P.pos.y - top()) < 0.35, `on the ${label} (${where()}, its top ${rt.kit.local(V(0, top(), 0)).y.toFixed(1)})`);
    assert.ok(R.history.has(cw.prop), `its way down kept in the sand (${R.history.track(cw.prop)?.seconds().toFixed(2)} s)`);
    assert.ok(R.begin(cw.adapter, false), 'the hourglass turned on it');
    for (let i = 0; i < 12 / DT && R.recalling; i++) frame();
    wait(0.4);
    assert.equal(cw.state, 'home', `the ${label} back on its ledge`);
  };
  return { level, physics, rt, P, notes, shell, H, R, L, frame, walk, wait, where, local, via, sight, pull, speaking, roll, ride, camera, hurt: () => hurt, said: (re) => notes.some((n) => re.test(n)) };
}

function openChest(rt, id, P) {
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, `temple.${rt.id}.${id}`, `by the chest of ${id}, the button opens it`);
  near.entry.use(P);
  assert.equal(rt.logic.isFound(id), true, `${id} taken`);
}

test('the Undertower on foot (issue #418): the Great Well over three floors, the line quiet and speaking, the hourglass’s rides, the hook, the lens, the bombs and the wings each joined with it, the drops back to the hub, the First Sign’s puzzle between its fights', () => {
  const H = house(), { rt, P, L, walk, wait, where, local, via, sight, pull, speaking, roll, ride, shell, said, frame } = H;
  const WL = ROOMS.well, DI = ROOMS.dishes, P1 = DI.z0 + DI.near + DI.pit;
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), `standing in the Threshold (${where()})`);
  assert.ok(!speaking() && rt.line, 'the house starts quiet: the word shut out of the cables');
  // (G1, readable everywhere: a line lamp in every room but the Threshold, the antechamber's and the way out)
  const lamps = new Set(rt.placed.filter((p) => p.cls === 'LineLamp').map((p) => p.o.room));
  for (const r of Object.keys(rt.def.logic.rooms)) if (!['threshold', 'out', 'dishes', 'galleryFar', 'crown'].includes(r)) assert.ok(lamps.has(r), `a line lamp in ${r}`);
  // (G4: the Great Well, 64 m long, three floors seen at once)
  assert.ok(WL.z1 - WL.z0 >= 60 && WL.top - WL.y >= F2 + 16, 'a great hall: 60 m and more, three floors under 16 m and more');

  // ---- the Hall of Dishes: the singing ball onto its footstone, splashed: its note across the pit; the pillars rise
  assert.equal(walk(L(0, 0, 26)), true, `into the Hall of Dishes (${where()})`);
  assert.equal(roll('ball1'), true, `the singing ball on its footstone (${where()})`);
  rt.piece('ball1').hit('shoot', V(0, -1, 0));
  wait(1.5);
  assert.equal(rt.logic.isLit('eD'), true, 'the far dish says its note over the horn');
  wait(2.5);
  assert.equal(via([0, 0, DI.z0 + DI.near - 1.6], [0, 0, P1 + 4]), true, `over the pillars (${where()})`);

  // ---- the Great Well's floor: the gallery and the balcony seen from it; the Tuning Room first, the house quiet
  assert.equal(via([0, 0, 64], [0, 0, 74]), true, `into the Great Well (${where()})`);
  // (the head of someone at the gallery's parapet on its arms and its north band, and at the balcony's lip, seen from the floor)
  for (const [ex, ez, x, y, z] of [[8, 90, WL.x0 + WELL.arm - 0.3, F1 + 2.2, 110], [-8, 90, WL.x1 - WELL.arm + 0.3, F1 + 2.2, 96], [0, 100, 0, F1 + 2.2, WELL.band + 0.5], [0, 95, 6, F2 + 2.2, WELL.lip + 0.5]]) assert.ok(sight(L(x, y, z), L(ex, 1.7, ez)), `the gallery and the balcony seen from the floor, all floors at once (${x}, ${y}, ${z})`);
  const U = ROOMS.tune;
  assert.equal(via([12, 0, WELL.store], [U.x0 + 3, 0, WELL.store]), true, `into the Tuning Room (${where()})`);
  assert.equal(roll('ballT'), true, `the ball on the near dish's footstone (${where()})`);
  const stones = rt.pieces.filter((p) => p.note && p.sing && !p.id);
  const stone = (note, at) => stones.filter((s) => s.note === note).sort((a, b) => a.center.distanceTo(at) - b.center.distanceTo(at))[0];
  stone('high', rt.piece('eT').at).sing(); wait(1.5);
  assert.equal(rt.logic.isLit('eT'), true, 'the high stone through the dishes: the far horn answers');
  // (round the drum of cable lying between the stones and the key)
  assert.equal(walk(L(U.x1 - 6, 0, 90)) && walk(rt.piece('kE').pos, { tol: 1.2 }), true, `round the drum to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kE', P);

  // ---- the Cable Store: its cable door shut while the house is quiet; the relay by the way in lets the word into the cables
  const S = ROOMS.store;
  assert.equal(via([U.x0 + 3, 0, WELL.store], [-12, 0, WELL.store], [-40, 0, WELL.store]), true, `along the passage west (${where()})`);
  assert.equal(walk(L(S.x1 - 2, 0, WELL.store), { max: 6 }), false, 'the cable door stays shut: the house is quiet');
  assert.equal(via([-12, 0, WELL.store], [0, 0, 74], [0, 0, 66], [5.5, 0, 63]), true, `back to the far landing's lever (${where()})`);
  assert.equal(pull('dishesFar'), 'speaking');
  assert.ok(speaking() && rt.logic.isOpen('dS'), 'the word runs in the cables: the store’s door opens');
  wait(1);
  assert.ok(H.notes.some((n) => /runs in every cable/.test(n)), 'and it says so');
  const keepers = [{ room: 'store', alive: true }, { room: 'store', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(via([0, 0, 74], [-12, 0, WELL.store], [S.x1 - 4, 0, WELL.store]), true, `into the Cable Store (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dS'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arW') && rt.logic.isOpen('dS'), 'beaten: won, and the door lets go');
  assert.equal(walk(rt.piece('kW').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kW', P);

  // ---- the great lift, woken by the word: up to the gallery
  const lift = rt.piece('lift'), LF = WELL.lift;
  assert.equal(via([S.x1 - 3, 0, WELL.store], [-12, 0, WELL.store], [LF.x - 4, 0, LF.z]), true, `to the lift's foot (${where()})`);
  assert.ok(rt.logic.isOpen('lift'), 'the lift runs');
  wait(30, () => lift.s < 0.2 && lift.wait > 0.8);
  assert.equal(walk(lift.group.position, { tol: 0.5, run: false, max: 6 }), true, `onto the lift (${where()})`);
  wait(30, () => lift.s > lift.total - 0.1);
  assert.equal(walk(L(LF.x + 4.5, F1, LF.z), { max: 4 }), true, `off onto the gallery's east arm (${where()})`);
  assert.ok(Math.abs(local().y - F1) < 0.5, `up on the gallery (${where()})`);

  // ---- the two small keys' door, the Shell Chamber and the hourglass
  const C3 = ROOMS.shell.z;
  assert.equal(via([LF.x + 4.5, F1, WELL.band + 2], [0, F1, WELL.band + 4], [0, F1, WL.z1 + 4]), true, `to the door into the chamber (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.keysIn('dK'), 2, 'both small keys go in');
  assert.equal(walk(L(0, F1, C3 - 9)), true, `into the chamber (${where()})`);
  assert.equal(rt.logic.next(), 'chest');
  items.grant('recall'); game.emit('box:opened', { id: 'bazaar.temple.echo' });
  assert.equal(rt.logic.gadget, true);
  // the chamber's low stone, caught in the sand for the passage a room on
  const lowC = stone('low', L(0, F1, C3));
  assert.equal(walk(lowC.center.clone().add(V(3, 0, 0)).setY(P.pos.y), { tol: 1.2 }), true, `by the chamber's low stone (${where()})`);
  lowC.sing();
  assert.equal(shell.held?.note, 'low', 'the sand catches the low stone');
  // ---- the walkway's counterweight: knocked off with a shot, ridden back up under the hourglass (taught where failing is free)
  const cwS = rt.piece('cwShell');
  assert.equal(cwS.state, 'home');
  assert.equal(walk(L(-6, F1, SHELF.z), { tol: 0.8 }), true, `under the walkway (${where()})`);
  assert.equal(walk(L(0, F1, SHELF.z + 12), { max: 3 }) && local().y > F2 - 1, false, 'no way up to the walkway on foot');
  P.teleport(L(-6, F1 + 0.1, SHELF.z), V(0, 1, 0), V(0, 0, 1));   // (fwd +z: the frame the walking's yaw reads) wait(0.3);
  const shot = allTargetsNear(cwS.prop.pos);
  assert.ok(shot, 'the counterweight is a target');
  shot.onHit('shoot', cwS.prop.pos.clone(), V(1, 0, 0), { mode: 'shoot' });
  wait(4, () => cwS.state === 'down');
  assert.equal(cwS.state, 'down', 'it tips off the walkway and goes down its cable to the floor');
  assert.ok(Math.abs(rt.kit.local(cwS.prop.pos).y - WEIGHTS.size / 2 - F1) < 0.2, 'on the chamber’s floor');
  assert.equal(rt.logic.isLit('knock'), true);
  assert.equal(via([-6, F1, SHELF.z + 5], [cwS.o.at[0] + 4.6, F1, SHELF.z + 5]), true, `round the pier (${where()})`);
  ride(cwS, 'walkway’s counterweight', V(2.4, 0, 0));
  assert.ok(local().y > F2 + 1, `up on the walkway with it (${where()})`);
  assert.ok(H.hurt() === 0, 'nothing hurt');
  // ---- the Listening Passage: its relay lever by its door (the house speaks: its horn would be deaf); the ball on its
  // footstone, the low note played back by its horn: the door sinks
  const LI = ROOMS.listen;
  assert.equal(via([0, F2, SHELF.z + 4], [0, F2, C3 + ROOMS.shell.r + 2], [-2.6, F2, LI.z0 + 2.6]), true, `into the Listening Passage, by its lever (${where()})`);
  assert.equal(pull('listen'), 'quiet');
  assert.ok(!speaking(), 'the word shut out');
  assert.equal(roll('ballP'), true, 'the ball on its footstone');
  const e0 = rt.piece('e0');
  assert.equal(walk(e0.at.clone().setY(P.pos.y), { tol: 2.5 }), true, `to the door's horn (${where()})`);
  assert.equal(shell.held?.note, 'low', 'the low note still in the sand');
  assert.equal(shell.play(), true);
  wait(0.5);
  assert.equal(rt.logic.isLit('e0'), true, 'the horn hears the low note');
  wait(2);
  assert.equal(rt.logic.isOpen('d3'), true, 'and the door sinks');
  // ---- the Gallery of Voices (LENS + HOURGLASS): the high egg's note played back raises the pillars, and they are there only
  // through the lens
  const GA = ROOMS.gallery, Q0 = GA.z0 + GA.near, Q1 = Q0 + GA.pit, pillars = rt.piece('pillars');
  assert.equal(via([0, F2, LI.z1 - 2], [0, F2, GA.z0 + 4]), true, `into the gallery (${where()})`);
  // the far door's dish pair first: the ball on the near dish's footstone, the middle egg's note played into its mouth
  assert.equal(roll('ball2'), true, 'the ball on the near dish’s footstone');
  const mid = stone('mid', L(-8.7, F2, Q0 - 1.4));
  assert.equal(walk(mid.center.clone().add(V(3, 0, 0)).setY(P.pos.y), { tol: 1.2 }), true, `by the middle egg (${where()})`);
  mid.sing();
  assert.equal(shell.held?.note, 'mid');
  const dishC = rt.piece('dishC');
  assert.equal(walk(dishC.ends[0].mouth.clone().setY(P.pos.y).add(V(-2.4, 0, 0)), { tol: 0.8 }), true, `by the near dish's mouth (${where()})`);
  shell.update(1.1); shell.play(); wait(1.5);
  assert.equal(rt.logic.isLit('e2'), true, 'on its pillar over the far landing the dish says it, and the door’s horn answers');
  const high = stone('high', L(-8.9, F2, Q0 - 3.9));
  assert.equal(walk(high.center.clone().add(V(3, 0, 0)).setY(P.pos.y), { tol: 1.2 }), true, `by the high egg (${where()})`);
  high.sing();
  assert.equal(shell.held?.note, 'high');
  assert.equal(walk(L(0, F2, Q0 - 1.2), { tol: 0.5 }), true, `to the chasm's edge (${where()})`);
  shell.update(1.1); shell.play(); wait(1.2);
  assert.ok(pillars.stones.some((s) => s.left > 0) && pillars.up === 0, 'they rise for the note, but without the lens there is nothing to stand on');
  assert.ok(said(/Look through the lens/), 'and it says to look');
  const look = (at) => { LENS_VIEW.k = 1; LENS_VIEW.eye.copy(P.pos).add(V(0, 1.7, 0)); LENS_VIEW.dir.subVectors(at, LENS_VIEW.eye).normalize(); frame(); };
  look(pillars.mid); LENS_VIEW.k = 0;
  assert.ok(pillars.seen(), 'through the lens they are there, and they stay');
  shell.update(1.1); shell.play(); wait(1.2);
  assert.ok(pillars.up > 0, 'the nearest risen and solid');
  // over, playing the note again as he goes
  for (let k = 0; k < 8 && local().z < Q1 + 1; k++) {
    walk(L(0, F2, Math.min(Q1 + 2, local().z + 5)), { tol: 0.6, max: 3, run: false });
    shell.update(1.1); shell.play(); wait(0.9);
  }
  assert.ok(local().z > Q1 && local().y > F2 - 1, `over the chasm on the pillars (${where()})`);
  assert.equal(walk(L(0, F2, GA.z1 - 1.5), { tol: 0.8, max: 8 }), true, `to the great door (${where()})`);
  wait(0.5);
  assert.equal(rt.logic.isOpen('d4'), false, 'the great door: its dish has answered, and it wants the great key');
  // ---- back over (the far side's high egg), down off the walkway into the chamber, out to the gallery
  const highFar = stone('high', L(8.4, F2, Q1 + 3.6));
  assert.equal(walk(highFar.center.clone().add(V(-3, 0, 0)).setY(P.pos.y), { tol: 1.2 }), true, `by the far high egg (${where()})`);
  highFar.sing();
  for (let k = 0; k < 8 && local().z > Q0 - 1; k++) {
    if (k === 0) walk(L(0, F2, Q1 + 1.2), { tol: 0.6, max: 4, run: false });
    shell.update(1.1); shell.play(); wait(0.9);
    walk(L(0, F2, Math.max(Q0 - 2, local().z - 5)), { tol: 0.6, max: 3, run: false });
  }
  assert.ok(local().z < Q0 && local().y > F2 - 1, `back over (${where()})`);
  assert.equal(via([0, F2, GA.z0 + 2], [0, F2, LI.z1 - 2], [0, F2, LI.z0 + 2], [0, F2, C3 + ROOMS.shell.r + 1], [2.5, F2, C3 + 12]), true, `back to the walkway's landing (${where()})`);
  const hurt0 = H.hurt();
  assert.equal(walk(L(6, F1, C3 + 12), { max: 6, dy: 0.8 }), true, `off the landing's edge, 12 m down into the chamber (${where()})`);
  assert.equal(H.hurt(), hurt0, 'unhurt');
  // ---- the Choir's gate: its horn back on the Hall of Dishes' far landing wants the middle note played back
  assert.equal(via([0, F1, C3 - 9], [0, F1, WL.z1 + 4], [0, F1, WELL.band + 3], [WL.x0 + 3, F1, WELL.band - 3], [WL.x0 + 3, F1, (WELL.drop[0] + WELL.drop[1]) / 2]), true, `along the west arm to its drop (${where()})`);
  assert.equal(walk(L(-8, 0, (WELL.drop[0] + WELL.drop[1]) / 2), { max: 6, dy: 0.8 }), true, `off the west arm, 12 m down to the floor (${where()})`);
  assert.equal(H.hurt(), hurt0, 'unhurt: the drop back to the hub (G6)');
  assert.equal(via([0, 0, 74], [0, 0, 64], [0, 0, P1 + 2], [0, 0, DI.z0 + DI.near - 2], [0, 0, DI.z0 + DI.near - 5]), true, `back over the pillars to the singing ball (${where()})`);
  rt.piece('ball1').hit('shoot', V(0, -1, 0));
  wait(0.3);
  assert.equal(shell.held?.note, 'mid', 'the sand keeps the singing ball’s middle note');
  const hG = rt.piece('hG');
  assert.equal(via([0, 0, P1 + 2], [rt.kit.local(hG.at).x - 1.5, 0, rt.kit.local(hG.at).z]), true, `to the gate's horn on the far landing (${where()})`);
  shell.update(1.1); shell.play(); wait(0.5);
  assert.equal(rt.logic.isLit('hG'), true, 'the horn at the cable’s end hears it');
  wait(2);
  assert.equal(rt.logic.isOpen('dG'), true, 'and far off in the Great Well, the Choir’s gate opens');
  // ---- up the lift (woken for good) and through the gate into the Choir (BOMBS + HOURGLASS)
  assert.equal(via([0, 0, 66], [0, 0, 74], [LF.x - 4, 0, LF.z]), true, `to the lift (${where()})`);
  wait(30, () => lift.s < 0.2 && lift.wait > 0.8);
  assert.equal(walk(lift.group.position, { tol: 0.5, run: false, max: 6 }), true, `onto the lift (${where()})`);
  wait(30, () => lift.s > lift.total - 0.1);
  assert.equal(walk(L(LF.x + 4.5, F1, LF.z), { max: 4 }), true, `off onto the east arm (${where()})`);
  const CR = ROOMS.choir;
  assert.equal(via([LF.x + 4.5, F1, WELL.band + 2], [WL.x0 + 3, F1, WELL.band - 3], [WL.x0 + 3, F1, WELL.gate], [CR.x1 - 4, F1, WELL.gate]), true, `through the gate into the Choir (${where()})`);
  assert.equal(roll('ballQ'), true, 'the ball on the near dish’s footstone');
  const lowQ = stone('low', L(CR.x0 + 12.4, F1, 125.6));
  lowQ.sing(); wait(1.5);
  assert.equal(rt.logic.isLit('hA'), true, 'the low stone’s own song through the dishes: the far horn answers');
  // the black horn: a blast's boom, and only played back
  const hB = rt.piece('hB');
  assert.equal(walk(hB.at.clone().setY(P.pos.y).add(V(-3, 0, 0)), { tol: 0.8 }), true, `by the black horn (${where()})`);
  game.emit('gadget:blast', { at: hB.at.clone().add(V(-4, -2, 1)) });   // (an ink bomb gone off: src/gadgets/bomb.js explode)
  wait(0.5);
  assert.equal(rt.logic.isLit('hB'), false, 'the blast itself: it only shivers');
  assert.ok(said(/played back from the sand/), 'and it says what it wants');
  assert.equal(shell.held?.note, 'boom', 'the sand keeps the boom');
  shell.update(1.1); shell.play(); wait(0.5);
  assert.equal(rt.logic.isLit('hB'), true, 'the boom played back: the black horn answers');
  wait(1);
  assert.equal(walk(rt.piece('kC').pos, { tol: 1.2 }), true, `to the small key (${where()})`);
  wait(0.3);
  openChest(rt, 'kC', P);
  // ---- the high counterweight (HOOK + HOURGLASS): hooked down off the balcony's lip to the west arm, ridden back up
  const cwT = rt.piece('cwTop');
  assert.equal(via([CR.x1 - 4, F1, WELL.gate], [WL.x0 + 3, F1, WELL.gate], [WL.x0 + 3, F1, 106]), true, `onto the west arm under the balcony's lip (${where()})`);
  assert.equal(walk(L(-8, F2, 120), { max: 3 }) && local().y > F2 - 1, false, 'no way up to the balcony on foot');
  assert.equal(walk(L(WL.x0 + 3, F1, 106), { max: 6 }), true, `back along the arm (${where()})`);
  assert.ok(cwT.prop.pos.distanceTo(P.pos.clone().setY(P.pos.y + 1.45)) <= HOOK.range, 'the counterweight in the hook’s reach');
  H.camera.position.copy(P.pos).add(V(0, 1.6, 0)); H.camera.lookAt(cwT.prop.pos); H.camera.updateMatrixWorld(true);
  const hit = H.H.trace();
  assert.ok(hit.ok && hit.kind === 'target' && hit.target.prop === cwT.prop, `the hook's aim finds it (${hit.kind})`);
  H.H.fire(hit);
  wait(8, () => cwT.state === 'down' && H.H.state === 'idle');
  assert.equal(cwT.state, 'down', `dragged down to him on its cable (${rt.kit.local(cwT.prop.pos).toArray().map((v) => v.toFixed(1))})`);
  assert.ok(Math.abs(rt.kit.local(cwT.prop.pos).y - WEIGHTS.size / 2 - F1) < 0.3, `on the gallery by him (${rt.kit.local(cwT.prop.pos).toArray().map((v) => v.toFixed(1))}, he at ${where()})`);
  ride(cwT, 'high counterweight');
  assert.ok(Math.abs(local().y - F2) < 0.6, `up at the balcony's lip with it, level with the balcony (${where()})`);
  assert.equal(walk(L(-8, F2, 126), { max: 4 }), true, `off onto the high balcony (${where()})`);
  // ---- the Bellows' door: the small key, and a cable door (the house quiet: shut); the balcony's lever
  assert.ok(!speaking(), 'still quiet');
  assert.equal(via([8, F2, WELL.door], [ROOMS.bellows.x0 - 2.2, F2, WELL.door]), true, `into the passage east, up to its door (${where()})`);
  wait(2);
  assert.equal(rt.logic.keysIn('dB'), 1, 'the small key goes in');
  assert.equal(rt.logic.isOpen('dB'), false, 'and the cable door stays shut: the house is quiet');
  assert.equal(via([8, F2, WELL.door], [-12.3, F2, 130.4]), true, `back along the balcony to its lever by the davit (${where()})`);
  assert.equal(pull('top'), 'speaking');
  assert.ok(rt.logic.isOpen('dB'), 'the word runs in the cables: the Bellows’ door opens');
  // the great horn says the word: the sand keeps it
  wait(LINE_LOOK.every + 0.5, () => shell.held?.note === 'sign.0');
  assert.equal(shell.held?.note, 'sign.0', `the sand keeps the First Sign’s word, “${LINE[0]}”, from the great horn`);
  // ---- the Bellows (WINGS + HOURGLASS): the word played back by their horn, the draught, the wings up it to the Crown
  const B = ROOMS.bellows, hW = rt.piece('hW');
  assert.equal(via([WL.x1 + 2, F2, WELL.door], [B.x0 + 3, F2, WELL.door]), true, `into the Bellows (${where()})`);
  assert.equal(walk(hW.at.clone().setY(P.pos.y).add(V(-2, 0, -1)), { tol: 0.8 }), true, `by the bellows' horn (${where()})`);
  shell.update(1.1); shell.play(); wait(0.5);
  assert.equal(rt.logic.isLit('hW'), true, 'the bellows’ horn hears the word');
  assert.ok(rt.logic.isOpen('draught'), 'the bellows blow');
  // (the wings in the draught: a jump onto the vent, the wings opened, up the shaft; steered north off its top onto the Crown)
  const vent = L(BELLOWS.x, F2, BELLOWS.z);
  walk(vent, { tol: 1.0, run: false, max: 4 });
  let top = 0;
  for (let i = 0; i < 9 / DT; i++) { frame({ Space: true }, Math.PI); top = Math.max(top, local().y); if (local().y > BELLOWS.crown.y + 0.8) break; }
  assert.ok(top > BELLOWS.crown.y + 0.5, `up the draught on the wings (${top.toFixed(1)} m)`);
  for (let i = 0; i < 6 / DT && !(P.onGround && local().y > BELLOWS.crown.y - 0.5); i++) frame({ Space: !P.onGround, KeyW: true }, Math.PI);
  assert.ok(P.onGround && Math.abs(local().y - BELLOWS.crown.y) < 0.6, `onto the Crown (${where()})`);
  assert.equal(walk(rt.piece('kB').pos, { tol: 1.2, max: 10 }), true, `to the great key (${where()})`);
  wait(0.3);
  openChest(rt, 'kB', P);
  // ---- off the Crown onto the bellows' breath, out, and off the balcony's lip into the cable heap: the drops back (G6)
  const hurt1 = H.hurt();
  assert.equal(walk(L(BELLOWS.x, F2, BELLOWS.crown.z0 - 3), { max: 8, dy: 0.8 }), true, `off the Crown's edge (${where()})`);
  assert.equal(H.hurt(), hurt1, 'the bellows’ breath takes the fall');
  assert.equal(via([B.x0 + 3, F2, WELL.door], [WL.x1 + 2, F2, WELL.door], [0, F2, 122]), true, `back onto the balcony (${where()})`);
  assert.equal(walk(L(0, 0, 115), { max: 8, dy: 0.8 }), true, `off the lip's open stretch, 24 m down into the cable heap (${where()})`);
  assert.equal(H.hurt(), hurt1, 'unhurt: the heap takes it');
  wait(0.6);
  assert.ok(said(/cable heaped below takes your fall/), 'and it says so');
  // ---- back up (the lift, woken for good) and on to the great door: the walkway's counterweight again, the passage, the pillars
  assert.equal(via([0, 0, 108], [LF.x - 4, 0, LF.z]), true, `to the lift (${where()})`);
  wait(30, () => lift.s < 0.2 && lift.wait > 0.8);
  assert.equal(walk(lift.group.position, { tol: 0.5, run: false, max: 6 }), true, `onto the lift (${where()})`);
  wait(30, () => lift.s > lift.total - 0.1);
  assert.equal(via([LF.x + 4.5, F1, LF.z], [LF.x + 4.5, F1, WELL.band + 2], [0, F1, WELL.band + 4], [0, F1, WL.z1 + 4], [-6, F1, C3 - 6], [-6, F1, SHELF.z]), true, `back under the walkway (${where()})`);
  allTargetsNear(cwS.prop.pos).onHit('shoot', cwS.prop.pos.clone(), V(1, 0, 0), { mode: 'shoot' });
  wait(4, () => cwS.state === 'down');
  assert.equal(via([-6, F1, SHELF.z + 5], [cwS.o.at[0] + 4.6, F1, SHELF.z + 5]), true, `round the pier (${where()})`);
  ride(cwS, 'walkway’s counterweight', V(2.4, 0, 0));
  assert.equal(via([0, F2, SHELF.z + 4], [0, F2, C3 + ROOMS.shell.r + 2], [-2.6, F2, LI.z0 + 2.6]), true, `along the walkway into the passage, by its lever (${where()})`);
  assert.ok(speaking(), 'still speaking (the bellows)');
  assert.equal(pull('listen'), 'quiet', 'the word shut out again: the First Sign’s hall');
  assert.equal(via([0, F2, LI.z0 + 3], [0, F2, LI.z1 - 2], [0, F2, GA.z0 + 4]), true, `through the passage into the gallery (${where()})`);
  assert.equal(walk(high.center.clone().add(V(3, 0, 0)).setY(P.pos.y), { tol: 1.2 }), true, `by the high egg (${where()})`);
  high.sing();
  walk(L(0, F2, Q0 - 1.2), { tol: 0.5 });
  for (let k = 0; k < 8 && local().z < Q1 + 1; k++) {
    shell.update(1.1); shell.play(); wait(0.9);
    walk(L(0, F2, Math.min(Q1 + 2, local().z + 5)), { tol: 0.6, max: 3, run: false });
  }
  // ---- the First Sign (G3d): its first fight, its puzzle, its last fight
  const AN = GA.z1 + 0.6 + 7.4, G = rt.guardian, CW = AN + 1.2 + 20;
  assert.equal(via([0, F2, GA.z1 - 2], [0, F2, AN + 4]), true, `through the great lock into the hall (${where()})`);
  assert.equal(rt.logic.keysIn('d4'), 1, 'the great key in it');
  wait(0.8);
  assert.notEqual(G.state, 'sleep', 'it wakes');
  assert.equal(rt.logic.isOpen('d4'), false, 'the door shuts behind you');
  P.opts.health = false;
  const giveBack = (n) => {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `it lowers its dish to listen (${n})`);
    P.teleport(G.model.mouth.clone().setY(G.model.pos.y).add(V(4, 0.2, 0)), V(0, 1, 0), V(0, 0, 1));
    G.say();
    const before = G.meter;
    shell.update(2);
    assert.equal(shell.play(), true);
    wait(1);
    assert.ok(G.meter > before, `its word back: retuned a little (${n}: ${G.meter})`);
  };
  for (let n = 0; n < 2; n++) giveBack(n);
  assert.equal(G.phaseIndex, 1, 'into its puzzle');
  wait(3);
  // its puzzle: it floods the cables with its one word; it hears nothing until the word is shut out at its hall's relay
  assert.ok(speaking(), 'its word floods every cable: the house speaks');
  assert.ok(said(/floods every cable/), 'and it says so');
  assert.notEqual(G.state, 'open', 'its dish turned up: it does not listen');
  const words = rt.wordStones;
  assert.equal(words.length, 3, 'three stones round its hall sing the rest of its line');
  const at = (i) => words.find((w) => w.i === i);
  at(1).sing();
  P.teleport(G.model.mouth.clone().setY(G.model.pos.y).add(V(4, 0.2, 0)), V(0, 1, 0), V(0, 0, 1));
  shell.update(2); shell.play(); wait(0.5);
  assert.ok(said(/roars in the cables/), 'it hears nothing over its word');
  assert.equal(walk(L(-6.4, F2, CW - 20 + 4.6), { tol: 0.8, max: 12 }), true, `to the hall's relay lever (${where()})`);
  assert.equal(pull('hall'), 'quiet');
  wait(1);
  assert.equal(G.state, 'open', 'the word shut out: it listens');
  // it turns its dish to the stone of the word it wants: OUT THERE, IS TALKING, TO YOU, in order
  for (const i of [1, 2, 3]) {
    const want = at(i), turned = Math.atan2(want.center.x - G.model.pos.x, want.center.z - G.model.pos.z);
    wait(1.5);
    const dh = Math.abs(Math.atan2(Math.sin(G.model.heading - turned), Math.cos(G.model.heading - turned)));
    assert.ok(dh < 0.5, `it turns its dish to the stone of “${LINE[i]}” (${dh.toFixed(2)} rad off)`);
    if (i === 2) {
      // (the wrong word first: the next but one)
      at(3).sing(); P.teleport(G.model.mouth.clone().setY(G.model.pos.y).add(V(4, 0.2, 0)), V(0, 1, 0), V(0, 0, 1));
      const m = G.meter; shell.update(2); shell.play(); wait(0.5);
      assert.equal(G.meter, m, 'not that word, not yet');
      assert.ok(said(/not that word, not yet/));
    }
    walk(want.center.clone().setY(P.pos.y).add(V(0, 0, 0)).lerp(G.model.pos.clone().setY(P.pos.y), 0.25), { tol: 1.5, max: 8 });
    want.sing();
    assert.equal(shell.held?.note, `sign.${i}`, `the sand keeps “${LINE[i]}”`);
    P.teleport(G.model.mouth.clone().setY(G.model.pos.y).add(V(4, 0.2, 0)), V(0, 1, 0), V(0, 0, 1));
    const before = G.meter;
    shell.update(2); shell.play(); wait(0.6);
    assert.ok(G.meter > before, `it hears “${LINE[i]}” (${G.meter})`);
  }
  assert.equal(G.phaseIndex, 2, 'its puzzle done: its last fight');
  // its last fight: it hears only through its cables, the low dishes on the wall
  for (let n = 0; n < 6 && G.state !== 'resolved'; n++) {
    answerAsks({ G, P, frame }, { keep: true });
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `it lowers its dish to listen (${n})`);
    P.teleport(G.model.mouth.clone().setY(G.model.pos.y).add(V(4, 0.2, 0)), V(0, 1, 0), V(0, 0, 1));
    G.say();
    const dish = rt.piece('signDishW').ends[0].mouth;
    P.teleport(dish.clone().setY(G.model.pos.y).lerp(G.arena.center.clone().setY(G.model.pos.y), 0.06).add(V(0, 0.2, 0)), V(0, 1, 0), V(0, 0, 1));
    const before = G.meter;
    shell.update(2); assert.equal(shell.play(), true); wait(1);
    assert.ok(G.meter > before || G.state === 'resolved', `its word down the cable (${n}: ${G.meter})`);
  }
  assert.equal(G.state, 'resolved', `its whole line (${G.meter})`);
  assert.equal(game.flag('temple.bazaar.done'), true);
  wait(2.5);
  assert.ok(rt.logic.isOpen('d4') && rt.logic.isOpen('d5'), 'the doors open');
  H.shell.dispose();
  game.reset();
  own();
});
/** A registered target near a point (the counterweight's, for a shot). */
function allTargetsNear(p) { return allTargets().find((t) => t.kind === 'prop' && t.position?.().distanceTo(p) < 0.5); }
