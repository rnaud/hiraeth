// The Clock-House round its great hall (issue #414, docs/design/temple-best-practices.md G1, G2, G4, G6): the hour is the
// house's state. The great clock's hand turns the Escapement's stair in the middle of the Winding Well, the great hall, so
// that its arm meets a different dock high on the walls at two (the north door, to the chest), four (the Pendulum Hall's
// high door) and six (the Striking Room's loft); a clock face in every room says the hour, a lever by the stair's foot, on
// its crown, on every dock and on the Escapement's far landing turns the hand on; the counterweight on the hall's floor
// winds the clock; the Striking Room's ball goes on the hour the clock says; the Clockmaker's clock wakes only at four;
// the gallery's six eyes count from the hour, behind shutters the grappling hook opens with the boomerang (an older tool
// and the house's own, G2); every dock's edge a drop back to the hall's floor (G6). The house walked through with a real
// traveller, a real boomerang and the use button on every lever. Its state machine is tests/temples.test.js's, its
// play-through by hits tests/temple-playthrough.test.js's; this is the feet.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLE_HOME, templeOf, nextSpot } from '../src/temples/index.js';
import { WELL, UP, STAIR, HOUR, DOCKS, COUNTER, WING, COIL, WIND, GALLERY, CUPBOARD, MAINSPRING, VOLLEY, FROM_FOUR, ESC, TWO, FOUR, SIX, WOUND, dockTip, hourAngle, galleryOrder, GreatClock } from '../src/temples/garage.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { Player, FALL } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { bestInteractable } from '../src/interact.js';
import { updateHazards } from '../src/hazards.js';
import { allTargets } from '../src/targets.js';
import { Reserve } from '../src/fluid-tool.js';
import { resources } from '../src/resources.js';
import { HOOK } from '../src/gadgets/hook.js';
import boomGadget from '../src/gadgets/boomerang.js';
import { answerAsks } from './guardian-asks.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };
const C2 = WELL.z, HW = WELL.half;

/** Shoot `n` times as fast as the real magic bar lets you (tests/temples.test.js's), frames between; the seconds it took. */
function tankShots(frame, n, hit) {
  const R = new Reserve(3);
  let shots = 0, cool = 0, t = 0, first = -1;
  for (let i = 0; i < 20 / DT && shots < n; i++) {
    const pace = resources.magicPace;
    R.max = resources.maxMagic; R.delay = pace.delay; R.rate = pace.rate;
    if (cool <= 0 && R.use()) { if (first < 0) first = t; hit(shots++); cool = 0.28; }
    cool -= DT; t += DT; R.update(DT); frame();
  }
  return t - first;
}

/** The house built in its world, a traveller at its door, a real boomerang in his hand. */
function house() {
  game.reset();
  own('backpack', 'gun', 'hook', 'glider');
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME.garage).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, 'garage');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: Infinity });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  const boom = boomGadget.create({ player: P, physics, camera: cam, tool: null, sound: null, world: null, relics: null, hud: { reticle() {}, marks() {} }, sfx: { equip() {} }, fx: new THREE.Group(), aimAt() {}, notice: (s) => notes.push(s), game, bursts: { add() {} } });
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); boom.update(DT); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const path = (...pts) => pts.every((p) => walk(L(...p)));
  const wait = (s, until = () => false) => { for (let i = 0; i < s / DT; i++) { if (until()) return true; frame(); } return until(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const sight = (to, from = P.pos.clone().add(V(0, 1.5, 0))) => { const d = to.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.9; };
  /** Lock on to the targets at `ats` (world points), in that order, and throw: frames till it is back. */
  const throwAt = (ats) => {
    const tg = ats.map((at) => allTargets().find((x) => x.enabled() && x.position().distanceTo(at) < 0.05));
    assert.ok(tg.every(Boolean), 'each lock a target');
    cam.position.copy(P.pos).add(V(0, 2, 0)); cam.lookAt(ats[0]); cam.updateMatrixWorld();
    boom.locks = tg.map((x) => ({ key: x, kind: x.kind, target: x, pos: () => x.position() }));
    boom.throw();
    for (let i = 0; i < 6 / DT && boom.flight; i++) frame();
  };
  /** Three eyes of a bank on the boomerang, in the order given, then the other three splashed as fast as the bar lets. */
  const throwAndShoot = (bank, order = [0, 1, 2, 3, 4, 5]) => { throwAt(order.slice(0, 3).map((i) => bank.eyes[i].center)); return tankShots(frame, 3, (i) => bank.hit(order[3 + i])); };
  /** The use button where he stands: what it offers, used (its return). */
  const use = (id) => { const near = bestInteractable(P); assert.equal(near?.entry.id, `temple.garage.${id}`, `by ${id}, the button works it (${where()})`); return near.entry.use(P); };
  const C = rt.greatClock;
  /** The Escapement's stair as it stands: the middle of step i (world), on the crown by its arbor, out along the arm. */
  const N = STAIR.steps, Hs = STAIR.crownSpan / 2, D = STAIR.sweep / (N - 1), rise = UP / N, rm = (STAIR.r + STAIR.out) / 2;
  const stepAt = (i) => { const c = C.a + Hs + D / 2 + (N - 2 - i) * D; return L(Math.sin(c) * rm, (i + 1) * rise, C2 + Math.cos(c) * rm); };
  const onArm = (r, a = C.a) => L(Math.sin(a) * r, UP, C2 + Math.cos(a) * r);
  /** Up the Escapement's stair from its foot, step by step, to its crown; out along the arm to the dock it meets. */
  const climbStair = () => {
    const c0 = C.a + Hs + D / 2 + (N - 2) * D, before = L(Math.sin(c0 - 0.35) * 9, 0, C2 + Math.cos(c0 - 0.35) * 9);   // (round to the foot from outside its sweep)
    if (!walk(before, { tol: 1.0 }) || !walk(stepAt(0), { tol: 1.0, run: false })) return `the stair's foot (${where()})`;
    for (let i = 1; i < N - 1; i++) if (!walk(stepAt(i), { tol: 0.9, max: 6, run: false })) return `step ${i} (${where()})`;
    if (!walk(L(Math.sin(C.a + Hs * 0.6) * 4.5, UP, C2 + Math.cos(C.a + Hs * 0.6) * 4.5), { tol: 0.8, max: 6, run: false })) return `the crown (${where()})`;
    return null;
  };
  const outTo = (hour) => {
    const tip = dockTip(hour);
    return walk(onArm(9), { tol: 0.8, max: 8 }) && walk(onArm(20), { tol: 0.8, max: 8 }) && walk(L(tip[0], UP, tip[1]), { tol: 0.8, max: 8 });
  };
  /** Back from a dock's tip, along the arm to the crown, down the stair to the floor. */
  const downStair = () => {
    if (!walk(onArm(20), { tol: 0.8, max: 8 }) || !walk(onArm(8), { tol: 0.8, max: 8 })) return `the arm (${where()})`;
    if (!walk(L(Math.sin(C.a + Hs * 0.9) * 4.2, UP, C2 + Math.cos(C.a + Hs * 0.9) * 4.2), { tol: 0.8, max: 6, run: false })) return `the crown's edge (${where()})`;
    for (let i = N - 2; i >= 0; i--) if (!walk(stepAt(i), { tol: 0.9, max: 6, run: false })) return `step ${i} going down (${where()})`;
    return walk(L(Math.sin(C.a + Hs + 0.4) * 8, 0, C2 + Math.cos(C.a + Hs + 0.4) * 8), { tol: 0.8, max: 6 }) ? null : `off the foot (${where()})`;
  };
  /** By a lever (its foot local [x, y, z], facing yaw): stand in front of it. */
  const toLever = (o) => { const [x, y, z] = o.at, s = Math.sin(o.yaw ?? 0), c = Math.cos(o.yaw ?? 0); return walk(L(x + s * 1.3, y, z + c * 1.3), { tol: 0.45 }); };
  const lever = (id) => rt.piece(id);
  return { level, physics, rt, P, notes, L, frame, walk, path, wait, where, sight, throwAt, throwAndShoot, use, C, stepAt, onArm, climbStair, outTo, downStair, toLever, lever, toward, flat };
}

test('the Clock-House on foot (issue #414): the pit’s three eyes, the great hall and its stair, the clock wound, the stair at four to the Pendulum Hall, the hour track on the hour, six to the loft, the drop, two to the north door; the boomerang, the gallery’s eyes from the hour behind shutters the hook opens, the drop off the north dock, the Clockmaker’s clock at four, the Foreman', (t) => {
  const H = house();
  t.after(() => H.rt.dispose());
  const { rt, P, notes, L, frame, walk, path, wait, where, sight, throwAt, throwAndShoot, use, C, climbStair, outTo, downStair, toLever, lever, toward } = H;
  const hourIs = (h) => rt.logic.check({ two: TWO, four: FOUR, six: SIX }[h]) && !C.turning;
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), `standing in the Threshold (${where()})`);
  assert.ok(C instanceof GreatClock && C.hour === 'four', 'every clock in the house stopped at four: the great clock says four');
  // ---- the Escapement's pit: its three eyes in turn from its hand (eight), then the disc across
  assert.equal(walk(L(0, 0, 16.6)), true, `to the pit's edge (${where()})`);
  const disc = rt.pieces.find((p) => p.path);
  rt.piece('s2').hit('shoot');
  assert.equal(rt.logic.isLit('s2'), false, 'twelve first: it only ticks');
  for (const id of ['s1', 's2', 's3']) rt.piece(id).hit('shoot');
  wait(0.1);
  assert.equal(rt.logic.isOpen('discs'), true, 'eight, twelve, four');
  for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.5); i++) frame();
  assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 4 }), true, `onto the disc (${where()})`);
  for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
  assert.equal(walk(L(0, 0, 43), { tol: 0.8 }), true, `off onto the far landing (${where()})`);
  // the Clockmaker's clock: stopped
  rt.piece('c1').hit('shoot');
  assert.equal(rt.logic.isLit('c1'), false, 'its clock stopped');
  assert.ok(notes.some((s) => /little clock has stopped/.test(s)), 'and it says why');
  // ---- the great hall (G4): 64 m across under 36, the stair in its middle, the three docks seen from its floor at once
  assert.equal(path([0, 0, 60], [0, 0, C2 - 26]), true, `into the great hall (${where()})`);
  assert.ok(2 * HW >= 60 && WELL.h >= 30, 'a great hall: 60 m and more');
  const floorEye = L(-12, 1.7, C2 - 26);
  for (const h of ['two', 'four', 'six']) { const [x, z] = dockTip(h); assert.ok(sight(L(x, UP + 3, z), floorEye), `the dock at ${h} seen from the way in`); }
  assert.ok(sight(L(-HW + 0.6, 21, C2), floorEye), 'and the great clock on the west wall');
  // a clock face in every room but the guardian's (G1: readable everywhere), and the hall's lamps in the hour's colour
  const gauged = new Set(rt.placed.filter((p) => p.cls === 'HourGauge').map((p) => p.o.room));
  for (const r of ['esc', 'escFar', 'well', 'pend', 'springs', 'strikeLoft', 'mainspring', 'cupboard', 'coil', 'wind', 'gallery']) assert.ok(gauged.has(r), `a clock face in ${r}`);
  wait(0.5);
  assert.equal('#' + C.lamp.uniforms.uColor.value.getHexString(), HOUR.colors.four, 'the hour’s lamps: four’s gold');
  // ---- the floor's lever: the hand won't turn, the clock unwound (its counterweight slack in its groove on the floor)
  assert.equal(toLever(lever('lever.well').o), true, `to the floor's lever (${where()})`);
  assert.equal(use('lever.well'), 'slack');
  assert.ok(notes.some((s) => /counterweight lies slack/.test(s)), 'it says why');
  assert.ok(C.raised === 1 && !rt.logic.isOpen('st2') && !rt.logic.isOpen('st4') && !rt.logic.isOpen('st6'), 'unwound, the stair’s arm stands upright: no dock');
  const armTip = () => C.arm.localToWorld(V(0, 0, STAIR.arm - 6.4));
  assert.ok(armTip().y > L(0, UP + 12, 0).y, 'its hand pointing up at the roof');
  // the counterweight rolled home: the clock wound
  const ball = rt.piece('ball1');
  for (let k = 0; k < 12 && !rt.logic.check(WOUND); k++) {
    walk(ball.center.clone().addScaledVector(ball.dir, -2.2).setY(P.pos.y), { tol: 0.6 });
    ball.hit('push', ball.dir.clone(), { strength: 1 });
    for (let i = 0; i < 6 / DT && !ball.rest; i++) frame();
  }
  assert.ok(rt.logic.check(WOUND), `the counterweight home in its socket: the clock wound (${ball.t.toFixed(2)})`);
  assert.ok(wait(5, () => C.raised === 0) && rt.logic.isOpen('st4'), 'its hand comes down level, pointing at four');
  assert.ok(Math.abs(armTip().y - L(0, UP, 0).y) < 0.2 && notes.some((s) => /hand comes down, pointing at four/.test(s)), 'and says so');
  // ---- up the Escapement's stair at four: its arm meets the Pendulum Hall's dock
  const keepers = [{ room: 'pend', alive: true }, { room: 'pend', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(climbStair(), null, 'up the stair round its column to the crown');
  assert.equal(H.outTo('four'), true, `out along the arm to the dock at four (${where()})`);
  assert.equal(walk(L(30, UP, WING.pend.z), { tol: 0.8 }), true, `onto the dock, by the Pendulum Hall's high door (${where()})`);
  // ---- the Pendulum Hall (an arena), in by its high door: shut behind you; won, the key's cage sinks and its floor door opens
  const PX0 = WING.pend.x - WING.pend.w / 2;
  assert.equal(walk(L(PX0 + 3, UP, WING.pend.z), { tol: 0.8 }), true, `in onto its landing (${where()})`);
  wait(0.4);
  assert.ok(!rt.logic.isOpen('dW') && !rt.logic.isOpen('dWo'), 'its doors shut behind you');
  keepers[0].alive = false; keepers[1].alive = false; wait(2.5);
  assert.equal(rt.logic.isLit('arW'), true, 'its keepers beaten: won');
  assert.ok(rt.logic.isOpen('dWo'), 'its floor door opens');
  const kW = rt.piece('kW');
  assert.equal(walk(kW.pos, { tol: 1.2, dy: 1 }), true, `to the key (${where()})`);
  wait(0.3);
  use('kW');
  assert.equal(rt.logic.isFound('kW'), true, 'a small key');
  assert.equal(walk(L(PX0 + 6, UP, WING.stairZ), { dy: 1 }) && walk(L(PX0 + 23.5, 0, WING.stairZ), { dy: 1 }) && walk(L(PX0 + 8, 0, WING.pend.z - WING.low)) && walk(L(26, 0, WING.pend.z - WING.low)), true, `down its stair and out by its floor door onto the hall (${where()})`);
  // ---- the Striking Room: the ball on the hour the great clock says (four now), the striking eye, the key up on the loft
  const S = WING.strike, sS = rt.piece('sS'), ballS = rt.piece('ballS');
  assert.equal(walk(L(26, 0, S.z + WING.low)) && walk(L(S.x - 6, 0, S.z + WING.low)), true, `into the Striking Room (${where()})`);
  sS.hit('shoot');
  assert.equal(rt.logic.isLit('sS'), false, 'its lids are shut');
  assert.ok(notes.some((s) => /not at the hour the great clock says/.test(s)), 'and it says why');
  const onHour = (p) => rt.logic.drumOn('ballS', p);
  for (let k = 0; k < 16 && !onHour('pS4'); k++) {
    const back = rt.logic.drumT('ballS') > 2 / 3;
    walk(ballS.center.clone().addScaledVector(ballS.dir, back ? 2.4 : -2.4).addScaledVector(ballS.axis, 1.2).setY(P.pos.y), { tol: 0.7 });
    ballS.hit('push', ballS.dir.clone().multiplyScalar(back ? -1 : 1), { strength: 0.15 });
    for (let i = 0; i < 6 / DT && !ballS.rest; i++) frame();
  }
  assert.ok(onHour('pS4'), `the ball on four (${ballS.t.toFixed(2)})`);
  wait(1);
  sS.hit('shoot');
  assert.equal(rt.logic.isLit('sS'), true, 'four, as the clock says: the lids open, and it wakes');
  const kE = rt.piece('kE');
  assert.ok(rt.kit.local(kE.pos).y > UP - 0.5, 'its key comes out of its cage up on the loft');
  // ---- the floor's lever, now the clock is wound: the hand on to six, the stair turning round to the loft's dock
  assert.equal(walk(L(S.x - 8, 0, S.z + WING.low)) && walk(L(26, 0, S.z + WING.low)) && toLever(lever('lever.well').o), true, `back to the floor's lever (${where()})`);
  assert.equal(use('lever.well'), 'six');
  assert.ok(C.turning && rt.logic.isOpen('st6') && !rt.logic.isOpen('st4'), 'the logic at six at once, the stair turning');
  wait(20, () => !C.turning);
  assert.ok(hourIs('six'), 'it comes round to six');
  assert.equal('#' + C.lamp.uniforms.uColor.value.getHexString(), HOUR.colors.six, 'the hour’s lamps: six’s coral');
  assert.equal(climbStair(), null, 'up the stair again');
  assert.equal(H.outTo('six'), true, `out along the arm to the dock at six (${where()})`);
  const LF = WING.loft;
  assert.equal(walk(L(30, UP, S.z), { tol: 0.8 }) && walk(L(LF.x0 + 2, UP, S.z)) && walk(kE.pos, { tol: 1.2, dy: 1 }), true, `into the loft, to the key (${where()})`);
  wait(0.3);
  use('kE');
  assert.equal(rt.logic.isFound('kE'), true, 'the second small key');
  // the loft's edge: a drop to the Striking Room's floor, unhurt (G6)
  const hearts = P.hearts;
  for (let i = 0; i < 4 / DT && rt.kit.local(P.pos).y > 1; i++) frame({ KeyW: true }, toward(L(LF.x1 + 6, 0, S.z + 1)));
  wait(1, () => P.onGround);
  assert.ok(P.onGround && rt.kit.local(P.pos).y < 1 && P.hearts === hearts, `down on its floor, unhurt (${where()}, ${P.hearts})`);
  // ---- on to two: the north dock and its door with both keys
  assert.equal(walk(L(S.x - 6, 0, S.z + WING.low)) && walk(L(24, 0, S.z + WING.low)) && toLever(lever('lever.well').o), true, `to the floor's lever (${where()})`);
  assert.equal(use('lever.well'), 'two');
  wait(30, () => !C.turning);
  assert.ok(hourIs('two') && rt.logic.isOpen('st2'), 'six on round to two');
  assert.equal(climbStair(), null, 'up the stair');
  assert.equal(H.outTo('two'), true, `out along the arm to the north dock (${where()})`);
  // from the north dock the counterweight's socket is in sight below: what winds the clock that turns the stair
  assert.ok(sight(rt.piece('p1').pos.clone().add(V(0, 0.8, 0)), L(-6, UP + 1.7, C2 + 27.5)), 'the counterweight home in its socket, seen from the north dock');
  assert.equal(walk(L(0, UP, C2 + 30.6), { tol: 0.5 }), true, `to the north door (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.keysIn('d2'), 2, 'both keys go in');
  assert.equal(rt.logic.isOpen('d2'), true, 'it opens');
  // ---- the Coil Chamber, the boomerang; the Winding Passage's six eyes in a breath
  const C3 = COIL.z, A = WIND.z, AZ0 = A - WIND.d / 2, F0G = GALLERY.z0;
  assert.equal(walk(L(0, UP, C3 - 8)), true, `into the chamber (${where()})`);
  assert.equal(rt.logic.next(), 'chest');
  items.grant('boomerang'); game.emit('box:opened', { id: 'garage.temple.coil' });
  wait(2.5);
  assert.equal(rt.logic.isOpen('dP'), true, 'the boomerang in hand: the door sinks');
  assert.equal(walk(L(0, UP, AZ0 + 3)), true, `into the passage (${where()})`);
  wait(3);
  throwAndShoot(rt.piece('k1'));
  assert.equal(rt.logic.isLit('k1'), true, 'six in a breath');
  wait(2.2);
  // ---- the Clock Gallery (G2): six eyes round the handless clock, in turn from the house's hour, under shutters the
  // striking train lifts while it runs: the hook at its ring under the clock, then the boomerang
  assert.equal(walk(L(-7, UP, A)) && walk(L(-7, UP, A + 9)) && walk(L(0, UP, F0G + 2.8)), true, `round the spring to the gallery (${where()})`);
  const k2 = rt.piece('k2'), order = galleryOrder('two');
  assert.deepEqual(k2.o.order(), order, 'the order from two, as the clock over the way in says');
  assert.deepEqual(galleryOrder('four'), [4, 3, 2, 1, 0, 5], 'from four it was four, six, eight, ten, twelve, two');
  wait(5.5);
  throwAndShoot(k2, order);
  assert.equal(rt.logic.isLit('k2'), false, 'the train is still: the eyes ring under their shutters');
  assert.ok(notes.some((s) => /striking train is not running/.test(s)), 'and say why');
  const ring = rt.piece('hb.train'), from = L(...ring.o.from);
  assert.equal(walk(from, { tol: 0.5 }), true, `to where the ring is hooked from (${where()})`);
  for (let i = 0; i < 10 / DT && !sight(ring.at); i++) frame();   // (the great pendulum swings through the line)
  assert.ok(ring.at.distanceTo(P.pos) <= HOOK.range && sight(ring.at), `the ring in the hook's reach and sight (${ring.at.distanceTo(P.pos).toFixed(1)} m)`);
  ring.hit('push', { mode: 'hook' });
  assert.equal(rt.logic.isLit('train'), true, 'hooked: the train runs');
  wait(1.5);
  throwAndShoot(k2, order);
  assert.equal(rt.logic.isLit('k2'), true, 'two, four, six on the boomerang’s locks, eight, ten, twelve splashed, while the train runs');
  wait(2.5);
  assert.equal(rt.logic.isOpen('br1'), true, 'the bridge');
  // the great lock wants the great key: back down (the north dock's edge a drop to the hall's floor, G6)
  assert.equal(walk(L(0, UP, F0G + 2.8), { dy: 1 }) && walk(L(-7, UP, A + 9), { dy: 1 }) && walk(L(-7, UP, A), { dy: 1 }) && walk(L(0, UP, AZ0 + 3), { dy: 1 }) && walk(L(0, UP, C3 - 8), { dy: 1 }) && walk(L(0, UP, C2 + 30.6), { tol: 0.6, dy: 1 }), true, `back past the chest to the north dock (${where()})`);
  const h0 = P.hearts;
  assert.equal(walk(L(-5, UP, C2 + 27.5), { dy: 1 }), true, `to the dock's west edge (${where()})`);
  for (let i = 0; i < 4 / DT && rt.kit.local(P.pos).y > 1; i++) frame({ KeyW: true }, toward(L(-14, 0, C2 + 26)));
  wait(1, () => P.onGround);
  assert.ok(P.onGround && rt.kit.local(P.pos).y < 1 && P.hearts === h0, `down on the hall's floor, unhurt (${where()})`);
  // ---- the Mainspring Room, then the Clockmaker's clock: its lids lift only at four
  const Z = CUPBOARD.z, ballM = rt.piece('ballM'), k3 = rt.piece('k3');
  assert.equal(walk(L(-10, 0, C2 - 20)) && walk(L(0, 0, C2 - 28)) && walk(L(0, 0, 66)) && walk(L(MAINSPRING.x - 12, 0, Z), { tol: 0.8 }), true, `to the Mainspring Room (${where()})`);
  for (let k = 0; k < 12 && !rt.logic.drumOn('ballM', 'pM'); k++) {
    walk(ballM.center.clone().addScaledVector(ballM.dir, -2.2).setY(P.pos.y), { tol: 0.6, dy: 1 });
    ballM.hit('push', ballM.dir.clone(), { strength: 1 });
    for (let i = 0; i < 6 / DT && !ballM.rest; i++) frame();
  }
  assert.ok(rt.logic.drumOn('ballM', 'pM'), 'the weight home under the spring');
  wait(5.5);
  throwAndShoot(k3);
  assert.equal(rt.logic.isLit('k3'), true, 'six round the spring in one breath');
  assert.equal(walk(L(MAINSPRING.x - 12, 0, Z), { tol: 0.8 }) && walk(L(-8, 0, Z)), true, `back to the Cupboard's door (${where()})`);
  rt.piece('c1').hit('shoot');
  assert.equal(rt.logic.isLit('c1'), false, 'two: its lids stay shut');
  assert.ok(notes.some((s) => /eyes begin at four/.test(s)), 'it says it counts from four');
  const lv = lever('lever.escFar');
  assert.equal(toLever(lv.o), true, `to the landing's lever (${where()})`);
  assert.equal(use('lever.escFar'), 'four');
  wait(20, () => !C.turning);
  assert.ok(hourIs('four'), 'the great clock says four again, turned from the landing');
  assert.equal(walk(L(-8, 0, Z)), true);
  for (const id of ['c1', 'c2', 'c3']) rt.piece(id).hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('dC'), true, 'four, eight, twelve');
  const kB = rt.piece('kB');
  assert.equal(walk(L(CUPBOARD.x + 5, 0, Z)) && walk(kB.pos, { tol: 1.2, dy: 1 }), true, `into the cupboard, to the great key (${where()})`);
  wait(0.3);
  use('kB');
  assert.equal(rt.logic.isFound('kB'), true, 'the great key');
  // ---- back up at two: the landing's lever, the hall, the stair, the north door, the gallery's bridge, the great lock
  assert.equal(walk(L(-8, 0, Z)) && toLever(lv.o), true);
  assert.equal(use('lever.escFar'), 'six');
  wait(0.4);
  assert.equal(use('lever.escFar'), 'two');
  wait(30, () => !C.turning);
  assert.ok(hourIs('two'), 'on round to two');
  assert.equal(walk(L(0, 0, 66)) && walk(L(0, 0, C2 - 24)), true, `into the hall (${where()})`);
  assert.equal(climbStair(), null, 'up the stair');
  assert.equal(H.outTo('two') && walk(L(0, UP, C2 + 30.6), { tol: 0.6 }) && walk(L(0, UP, C3 - 8)) && walk(L(0, UP, AZ0 + 3)) && walk(L(-7, UP, A)) && walk(L(-7, UP, A + 9)) && walk(L(0, UP, F0G + 2.8)), true, `up past the chest to the gallery (${where()})`);
  const bob = rt.pieces.find((p) => p.o?.bob === 'disc'), midZ = F0G + 16, bz = () => rt.kit.local(bob.center).z;
  assert.equal(walk(L(0, UP, midZ - 10.5), { dy: 1 }), true);
  for (let i = 0; i < 14 / DT; i++) { const z0 = bz(); frame(); if (bz() > z0 && bz() - midZ > -4.2 && bz() - midZ < -2.5) break; }
  assert.equal(walk(L(0, UP, F0G + 29.3), { dy: 1 }) && rt.kit.local(P.pos).y > UP - 1, true, `over the bridge in the pendulum's beat (${where()})`);
  assert.equal(walk(L(0, UP, F0G + 33.3), { tol: 0.5 }), true, `to the Foreman's door (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.isOpen('d4'), true, 'the great key turns');
  // ---- the Foreman: six numerals in a breath, three on the boomerang, round from four
  assert.equal(walk(L(0, UP, F0G + 45.3)), true, `into the workshop (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  P.opts.health = false;
  for (let n = 0; n < 8 && G.state !== 'resolved'; n++) {
    answerAsks({ G, P, frame }, { keep: true });
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `its face opens (${n})`);
    throwAt(FROM_FOUR.slice(0, 3).map((i) => G.model.vent(i, V())));
    tankShots(frame, 3, (i) => rt.volley(FROM_FOUR[3 + i]));
  }
  assert.equal(G.state, 'resolved', `set right (${G.meter})`);
  assert.equal(game.flag('temple.garage.done'), true);
  game.reset();
  own();
});

test('the Clock-House’s stair carries whoever rides it round, and its arm only ever meets the dock of the hour (issue #414)', (t) => {
  const H = house();
  t.after(() => H.rt.dispose());
  const { rt, P, L, wait, walk, where, use, C, climbStair, outTo, toLever, lever } = H;
  rt.logic.moveDrum('ball1', 1); rt.applyDoors();   // (the clock wound)
  P.teleport(L(-6, 0.1, C2 - 12), V(0, 1, 0), V(0, 0, 1)); wait(0.5);
  assert.equal(climbStair(), null, 'up the stair');
  // the crown's lever, at the arbor in its middle: pulled, the stair turns with him on it, and he stays on it
  assert.equal(walk(L(Math.sin(C.a + 0.5) * 1.3, UP, C2 + Math.cos(C.a + 0.5) * 1.3), { tol: 0.5 }), true, `by the arbor (${where()})`);
  assert.equal(use('lever.crown'), 'six');
  const y0 = P.pos.y;
  wait(20, () => !C.turning);
  assert.ok(P.onGround && Math.abs(P.pos.y - y0) < 0.3 && rt.kit.local(P.pos).distanceTo(V(0, UP, C2)) < 3.5, `ridden round on the crown (${where()})`);
  const trail = []; const ok6 = (() => { const tip = dockTip('six'); return [H.onArm(9), H.onArm(20), L(tip[0], UP, tip[1])].every((p) => { const r = walk(p, { tol: 0.8, max: 8 }); trail.push(where()); return r; }); })();
  assert.equal(ok6, true, `the arm at the dock at six (${trail.join(' → ')})`);
  // a dock's lever brings the arm round to it: from six, the four dock's lever
  const tip4 = dockTip('four');
  assert.ok(Math.hypot(...[0, 2].map((i) => C.stair.localToWorld(V(0, UP, STAIR.arm)).toArray()[i] - L(tip4[0], UP, tip4[1]).toArray()[i])) > 10, 'the arm is not at four');
  for (const h of ['two', 'four', 'six']) { const tip = dockTip(h), a = hourAngle(HOUR.hours[h]); assert.ok(Math.abs(Math.hypot(tip[0], tip[1] - C2) - STAIR.tip) < 0.01 && Math.abs(Math.atan2(tip[0], tip[1] - C2) - Math.atan2(Math.sin(a), Math.cos(a))) < 1e-6, `${h}'s dock on the hand's line`); }
  game.reset();
  own();
});
