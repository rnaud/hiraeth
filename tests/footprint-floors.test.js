// The Footprint across four floors (issue #401, the author: "1 temple should have more verticality, like be on multiple
// levels so that the non linear path is not just about the horizontal layout"; docs/design/temple-best-practices.md part
// 4): the house walked through with a real traveller, every drop fallen and every climb climbed with his own movement,
// room by room, floor by floor. The house's state machine and its play-through by hits are tests/temples.test.js's and
// tests/temple-playthrough.test.js's; this is the feet.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLES, TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { WELL, AT, LIFT, SPIRAL, SOUNDING, ROOMS, LODGE, POOL, CATCH, STONES, round } from '../src/temples/spheres.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { Player, FALL } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { bestInteractable } from '../src/interact.js';
import { updateHazards } from '../src/hazards.js';
import { LENS_VIEW } from '../src/gadgets/hidden.js';
import { solve } from '../src/temples/logic.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const [F0, F1, F2, F3] = WELL.floors, WZ = WELL.z;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };

/** The Footprint built in its world, a traveller at its door, and his hands: walk, wait, look through the lens. */
function house() {
  game.reset();
  own('backpack', 'gun', 'doublejump');
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME.spheres ?? 'spheres').create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, 'spheres') ?? level.temple;
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = P.heading ?? 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  /** Walk (run) to `to` (world) until within tol in plan and dy in height; true if he got there. */
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s, until = () => false) => { for (let i = 0; i < s / DT; i++) { if (until()) return true; frame(); } return until(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const said = (re) => notes.some((s) => re.test(s));
  const look = (at) => { LENS_VIEW.k = 1; LENS_VIEW.eye.copy(P.pos).add(V(0, 1.7, 0)); LENS_VIEW.dir.subVectors(at, LENS_VIEW.eye).normalize(); frame(); };
  const lower = () => { LENS_VIEW.k = 0; frame(); };
  const local = () => rt.kit.local(P.pos);
  /** Walk on toward `to` until he falls, then until he lands: { fell (m), hurt (hearts), down (knocked over) }. */
  const fall = (to, { max = 12 } = {}) => {
    const y0 = P.pos.y, h0 = P.hearts;
    let top = P.pos.y, down = false;
    for (let i = 0; i < max / DT && P.onGround; i++) frame({ KeyW: true }, toward(to));
    for (let i = 0; i < 12 / DT && !P.onGround; i++) { frame(); top = Math.max(top, P.pos.y); down ||= !!P.down; }
    wait(0.5);
    down ||= !!P.down;
    return { fell: +(top - P.pos.y).toFixed(1), from: y0, hurt: +(h0 - P.hearts).toFixed(2), down };
  };
  return { rt, P, L, frame, walk, wait, where, said, look, lower, local, fall, notes, level, physics };
}

test('the Footprint across four floors (issue #401): every floor 18 m under the last round the Heel Well, its balconies, its great door seen from the rim', () => {
  const { rt, L } = house();
  assert.deepEqual(WELL.floors, [0, -18, -36, -54]);
  // the rim and the great door at the bottom of the well, in sight from the rim's edge as you come in
  const eye = L(3, F0 + 1.7, WZ - WELL.inner - 0.3), door = rt.piece('dG').group.position.clone().add(V(0, 4, 0));
  const dir = door.clone().sub(eye), d = dir.length();
  assert.ok(!(rt.physics?.rayDistance?.(eye, dir.normalize(), d) < d - 1), 'nothing in the way of the great door from the rim beside the pier');
  // the house's state machine: solved, eleven steps and more
  const r = solve(TEMPLES.spheres.def.logic, { items: ['backpack', 'gun', 'doublejump'] });
  assert.equal(r.done, true, r.log.join(' / '));
});

test('the three drops (issue #401): through the rim’s iris onto F1’s pool, through the rim’s open hole and F1’s onto F2’s pool, off the rim into the heel’s pool: no fall hurts or knocks him over; off a balcony’s edge where no pool waits, it does', () => {
  const H = house();
  const { rt, P, L, walk, wait, where, fall, said } = H;
  const at = (a, r, y) => { const [x, z] = round(a, r); return L(x, y, z); };
  const stand = (p) => { P.teleport(p.clone().add(V(0, 0.05, 0)), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0); wait(0.6); };
  // the first drop: the iris shut is floor; open (the Hall of Spheres answered), a hole over F1's pool
  stand(at(AT.dropA + 0.24, AT.poolR, F0));
  assert.equal(walk(at(AT.dropA, AT.poolR, F0), { tol: 0.4, max: 5 }), true, `onto the shut iris (${where()})`);
  wait(0.5);
  assert.ok(P.onGround && Math.abs(H.local().y - F0) < 0.3, `the shut iris holds him (${where()})`);
  rt.logic.store.set('open.d1', true); rt.applyDoors(); wait(2.5);
  stand(at(AT.dropA + 0.24, AT.poolR, F0));
  let f = fall(at(AT.dropA, AT.poolR, F0));
  assert.ok(f.fell > 16 && Math.abs(H.local().y - F1) < 0.5, `down to F1 (${f.fell} m, at ${where()})`);
  assert.ok(f.hurt === 0 && !f.down, `the pool breaks the fall (${f.hurt} hearts, ${f.down ? 'knocked over' : 'on his feet'})`);
  assert.ok(said(/breaks your fall/), 'it says so');
  // the second drop: the rim's open hole, through F1's, onto F2's pool (36 m)
  stand(at(AT.dropB + 0.24, AT.poolR, F0));
  f = fall(at(AT.dropB, AT.poolR, F0));
  assert.ok(f.fell > 34 && Math.abs(H.local().y - F2) < 0.5, `down to F2 (${f.fell} m, at ${where()})`);
  assert.ok(f.hurt === 0 && !f.down, `the pool breaks the fall (${f.hurt}, ${f.down})`);
  // and from F1, through its hole
  stand(at(AT.dropB + 0.24, AT.poolR, F1));
  f = fall(at(AT.dropB, AT.poolR, F1));
  assert.ok(f.fell > 16 && Math.abs(H.local().y - F2) < 0.5 && f.hurt === 0 && !f.down, `F1 to F2's pool (${f.fell} m, ${f.hurt}, ${where()})`);
  // the third: off the rim into the well, the heel's pool (54 m)
  stand(at(Math.PI / 2 + 0.6, WELL.inner + 1.5, F0));
  f = fall(at(Math.PI / 2 + 0.6, 6, F0));
  assert.ok(f.fell > 52 && Math.abs(H.local().y - (F3 - 0.5)) < 0.6, `down into the heel (${f.fell} m, at ${where()})`);
  assert.ok(f.hurt === 0 && !f.down, `its pool breaks the fall (${f.hurt}, ${f.down})`);
  // out of the heel's pool onto F3's floor (a step up)
  assert.equal(walk(at(Math.PI / 2 + 0.6, 17, F3), { tol: 0.6, max: 8, dy: 0.4 }), true, `out of the pool onto the heel's floor (${where()})`);
  // off F1's balcony where no pool waits, onto F2's: a hard landing (18 m)
  stand(at(-Math.PI / 2, WELL.inner + 0.8, F1));
  const h0 = P.hearts;
  for (let i = 0; i < 60 && P.onGround; i++) H.frame({ KeyW: true }, Math.atan2(0, 0) + rt.kit.heading(Math.PI / 2) - Math.PI);
  wait(3);
  // (where he lands depends on how far he ran: the balcony below, or the heel's pool; either way he gets up)
  assert.ok(H.local().y < F1 - 10, `he fell (${where()})`);
  assert.ok(P.hearts <= h0, 'never healed by it');
});

test('the Footprint on foot, floor by floor (issue #401): the Hall of Spheres opens the first drop; F1’s bridges while the great sphere is up, the Sounding Toe’s sphere pushed from the walker’s print through its hatch onto the plate below, the Still Pool’s berth; the second drop; the lens, the spiral it shows climbed to the rim and the Lodge’s eye on the way; the Lodge’s key; the great lift ridden down; the Hall of the Unseen and its far door; the great key; the last lift; the great door and the Echo', () => {
  const H = house();
  const { rt, P, L, walk, wait, where, said, look, lower, fall, frame } = H;
  const at = (a, r, y) => { const [x, z] = round(a, r); return L(x, y, z); };
  const DEG = Math.PI / 180;
  /** Round a balcony at r 17 from angle a0 to a1 (degrees), a waypoint every 15°. */
  const roundTo = (a0, a1, y, r = 17) => { const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 15)); for (let i = 1; i <= n; i++) if (!walk(at((a0 + ((a1 - a0) * i) / n) * DEG, r, y), { tol: 0.8, max: 10 })) return false; return true; };
  const logic = rt.logic;
  wait(0.5);
  // ---- F0: in from the threshold onto the rim, the great sphere ahead on its lift
  assert.equal(walk(L(0, F0, 16)) && walk(L(0, F0, WZ - 17)), true, `onto the rim (${where()})`);
  wait(0.4);
  assert.equal(rt.checkpoint?.room, 'rim');
  // ---- the Hall of Spheres: the sphere on the walker's print and you on the walker's print beside it
  assert.equal(roundTo(180, 270, F0) && walk(L(-22, F0, WZ)) && walk(L(-30, F0, WZ)), true, `into the Hall of Spheres (${where()})`);
  const ball1 = rt.piece('ball1');
  const pushTo = (b, eid, plate, strength) => {
    for (let k = 0; k < 8 && !logic.drumOn(eid, plate); k++) {
      const sign = Math.sign(logic.el(eid).stops[plate] - b.t) || 1;
      walk(b.center.clone().addScaledVector(b.dir, -sign * (b.r + 1.3)).setY(b.group.position.y), { tol: 0.5 });
      b.hit('push', b.dir.clone().multiplyScalar(sign), { strength });
      for (let i = 0; i < 6 / DT && !b.rest; i++) frame();
    }
    return logic.drumOn(eid, plate);
  };
  assert.equal(pushTo(ball1, 'ball1', 'pb', 1), true, `the sphere on the four-toed print (${ball1.t.toFixed(2)})`);
  assert.equal(walk(rt.piece('pW').pos, { tol: 0.5 }), true, 'onto the walker’s print');
  wait(1);
  assert.equal(logic.isOpen('d1'), false, 'the sphere is on the wrong print: the iris stays shut');
  assert.equal(pushTo(ball1, 'ball1', 'p1', 0.3), true, `the sphere on the walker's print (${ball1.t.toFixed(2)})`);
  assert.equal(walk(rt.piece('pW').pos, { tol: 0.5 }), true, 'onto the walker’s print');
  wait(1);
  assert.equal(logic.isOpen('d1'), true, 'both where the walker was: the iris in the rim opens');
  // ---- the first drop: out on the rim, into the iris, onto F1's pool
  assert.equal(walk(L(-30, F0, WZ)) && walk(L(-22, F0, WZ)) && walk(at(-105 * DEG, 17, F0)), true, `back on the rim (${where()})`);
  wait(2);
  let f = fall(at(AT.dropA, AT.poolR, F0));
  assert.ok(Math.abs(H.local().y - F1) < 0.5 && f.hurt === 0 && !f.down, `down the first drop onto F1's pool (${f.fell} m, ${f.hurt} hearts, ${where()})`);
  // ---- F1: round to the east arc, over a bridge (the great sphere is up), into the Sounding Toe
  assert.ok(logic.isOpen('bW') && logic.drumOn('lift', 'pUp'), 'the great sphere up: F1’s bridges stand');
  assert.equal(walk(at(-130 * DEG, 17, F1)) && roundTo(230, 135, F1) && roundTo(135, 90, F1), true, `over the bridge onto the east arc (${where()})`);
  assert.equal(walk(L(23, F1, WZ)) && walk(L(30, F1, WZ)), true, `into the Sounding Toe (${where()})`);
  const ballT = rt.piece('ballT');
  const pushT = (from) => {
    assert.equal(walk(from, { tol: 0.4, max: 8 }), true, `onto the print (${where()})`);
    wait(0.6);
    const d = ballT.center.clone().sub(P.pos.clone().add(V(0, 1.15, 0)));
    ballT.hit('push', d.clone().setY(0).normalize(), { strength: Math.max(0, 1 - d.length() / 6) });
    for (let i = 0; i < 12 / DT && !(ballT.rest && i > 30); i++) frame();
  };
  // pushed from a plain print: the hatch shut, it comes back off it
  pushT(rt.piece('pH2').pos);
  assert.ok(!logic.isOpen('hT') && !logic.drumOn('ballT', 'pT') && !ballT.fell, `the hatch shut: it stays up (${ballT.t.toFixed(2)})`);
  // (rolled back to its start, from beyond it)
  for (let k = 0; k < 6 && ballT.t > 0.05; k++) {
    walk(ballT.center.clone().addScaledVector(ballT.dir, ballT.r + 1.2).setY(ballT.group.position.y), { tol: 0.6 });
    ballT.hit('push', ballT.dir.clone().negate(), { strength: 1 });
    for (let i = 0; i < 8 / DT && !(ballT.rest && i > 30); i++) frame();
  }
  // from the walker's print the hatch opens: pushed from there it drops through onto the plate below
  pushT(rt.piece('pH').pos);
  assert.ok(ballT.fell && logic.drumOn('ballT', 'pT'), `through the hatch, onto the plate below (${ballT.t.toFixed(2)})`);
  assert.ok(said(/drops through the floor/), 'it says so');
  wait(1.5);
  assert.equal(logic.isOpen('dT'), true, 'the Hall of the Unseen’s door opens, a floor down');
  // ---- the Still Pool: back over the bridge, north round the balcony
  assert.equal(walk(L(23, F1, WZ)) && walk(at(90 * DEG, 17, F1)) && roundTo(90, 0, F1), true, `round to the north (${where()})`);
  const PL = ROOMS.pool;
  assert.equal(walk(L(0, F1, WZ + 23)) && walk(L(-2.5, F1, PL.z0 + 7.2)), true, `to the pool (${where()})`);
  const ball3 = rt.piece('ball3');
  assert.equal(walk(L(-4.5, F1, PL.z0 + 6.0), { tol: 0.4 }), true, 'onto the stilling stone');
  wait(0.4);
  ball3.hit('push', ball3.dir.clone(), { strength: 1 });
  for (let i = 0; i < 14 / DT && !logic.drumOn('ball3', 'p3'); i++) frame();
  for (let i = 0; i < 4 / DT && !ball3.rest; i++) frame();
  assert.ok(logic.drumOn('ball3', 'p3'), `over the still water into its berth (${ball3.t.toFixed(2)})`);
  wait(2);
  assert.ok(logic.isOpen('stones') && logic.isOpen('dL'), 'the stepping stones rise, and the Lens Chamber opens below');
  const Fz = PL.z0 + PL.near + PL.pit;
  assert.equal(walk(L(3.5, F1, PL.z0 + 7.4)) && walk(L(3.5, F1, Fz + 1.0)), true, `over the stones (${where()})`);
  assert.ok(P.pos.y > L(0, F1 - 1, 0).y, 'not in the pool');
  const coffer = bestInteractable(P);
  assert.equal(coffer?.entry?.id, 'temple.spheres.cF', 'the coffer on the far ledge');
  coffer.entry.use(P);
  // ---- the second drop: back over the stones and out, round to the hole in F1's balcony, onto F2's pool
  assert.equal(walk(L(3.5, F1, PL.z0 + 7.4)) && walk(L(0, F1, WZ + 23)) && walk(at(0, 17, F1)) && roundTo(0, -45, F1), true, `round to the second drop (${where()})`);
  f = fall(at(AT.dropB, AT.poolR, F1));
  assert.ok(Math.abs(H.local().y - F2) < 0.5 && f.hurt === 0 && !f.down, `down onto F2's pool (${f.fell} m, ${f.hurt}, ${where()})`);
  // ---- the Lens Chamber: the seeing lens
  assert.equal(roundTo(-60, -90, F2) && walk(L(-23, F2, WZ)) && walk(L(-38, F2, WZ)), true, `into the Lens Chamber (${where()})`);
  assert.equal(rt.piece('mural').mesh.visible, false, 'no mural to see');
  items.grant('monocle'); game.emit('box:opened', { id: 'spheres.temple.lens' });
  wait(0.3);
  look(L(ROOMS.lens.x - 7, F2 + 3.6, WZ));
  assert.equal(rt.piece('mural').mesh.visible, true, 'through the lens, the walker’s print on the stele');
  lower();
  // ---- the spiral: the lens raised over the well shows it; climbed with his own feet to the rim
  assert.equal(walk(L(-23, F2, WZ)) && walk(at(-90 * DEG, 17, F2)) && roundTo(-90, -15, F2), true, `back on F2's balcony (${where()})`);
  const sp = rt.piece('spiral');
  assert.equal(sp.root.visible, false, 'nothing in the well to the eye');
  look(L(0, (F0 + F2) / 2, WZ));
  lower();
  assert.ok(sp.root.visible && logic.store.get('seen.spiral'), 'through the lens, the spiral; and it stays');
  const [bx, bz] = sp.ends[0];
  assert.equal(walk(L(bx, F2, bz), { tol: 0.5 }), true, `onto its first landing (${where()})`);
  let eye = false;
  for (const [k, s] of sp.steps.entries()) {
    assert.equal(walk(L(s.x, s.top, s.z), { tol: 0.55, max: 6, dy: 0.5 }), true, `up onto stone ${k} (${s.top.toFixed(1)} m: ${where()})`);
    // under the rim's pier on the way up: the Lodge's eye, only the lens shows
    if (!eye && Math.abs(Math.atan2(Math.sin(s.a - Math.PI), Math.cos(s.a - Math.PI))) < 0.09 && s.top > F1) {
      const sL = rt.piece('sL');
      assert.equal(sL.seen(), false, 'no eye to see');
      look(sL.center); lower();
      assert.equal(sL.seen(), true, 'the Lodge’s eye under the pier, seen through the lens from the spiral');
      sL.hit('shoot');
      eye = true;
    }
  }
  const [tx, tz] = sp.ends[1];
  assert.equal(walk(L(tx, F0, tz), { tol: 0.5, dy: 0.5 }) && walk(at(5 * DEG, 17, F0), { dy: 0.5 }), true, `off the spiral onto the rim (${where()})`);
  assert.ok(eye && logic.isLit('sL'), 'the eye woken on the way up');
  wait(1);
  assert.ok(logic.isOpen('dR'), 'the eye, and the great sphere up: the Lodge’s door opens');
  // ---- the Keepers' Lodge: its door shuts behind you while its keepers stand; won, the small key
  const keepers = [{ room: 'lodge', alive: true }, { room: 'lodge', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(roundTo(5, 90, F0) && walk(L(23, F0, WZ)) && walk(L(32, F0, LODGE.z)), true, `into the Lodge (${where()})`);
  wait(0.3);
  assert.equal(logic.isOpen('dR'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(logic.isLit('arL') && logic.isOpen('dR'), 'beaten: won, and the door lets go');
  assert.equal(walk(rt.piece('kS').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  bestInteractable(P).entry.use(P);
  wait(1.5);
  assert.equal(logic.isFound('kS'), true, 'a small key');
  // ---- the great lift, ridden down: F1's bridges sink behind it
  assert.equal(walk(L(23, F0, WZ)) && roundTo(90, 175, F0) && walk(L(0, F0, WZ - 12)) && walk(L(0, F0, WZ - 3), { tol: 0.4 }), true, `onto the great lift's disc (${where()})`);
  assert.ok(wait(25, () => logic.drumOn('lift', 'pDown')), `it carries him down (${where()})`);
  wait(0.5);
  assert.ok(Math.abs(H.local().y - F2) < 0.4 && P.hearts > 0, `down on F2 with it (${where()})`);
  assert.equal(logic.isOpen('bW'), false, 'and F1’s bridges have sunk');
  // ---- the Hall of the Unseen: its stones only the lens shows, a wrong print crumbles
  assert.equal(walk(L(0, F2, WZ - 11)) && walk(at(170 * DEG, 17, F2)) && roundTo(170, 90, F2) && walk(L(23, F2, WZ)) && walk(L(29, F2, WZ - 6)), true, `into the Hall of the Unseen (${where()})`);
  const U0 = ROOMS.unseen.x0, rowX = (r) => U0 + 7.6 + r * 3.35, row = (r) => rt.piece('br1').cells.filter((c) => Math.abs(c.x - rowX(r)) < 0.1);
  wait(0.5);
  assert.equal(rt.checkpoint?.room, 'unseen');
  look(L(42, F2, WZ)); lower();
  assert.equal(rt.piece('br1').root.visible, true, 'the stones, once seen');
  const wrong = row(0).find((c) => !c.real);
  walk(L(wrong.x, F2, wrong.z), { tol: 0.5, max: 4 });
  wait(1.5);
  assert.ok(said(/not the walker’s/), `a wrong print crumbles under him (${where()})`);
  wait(4.5);
  for (let r = 0; r < 6; r++) {
    const c = row(r).find((q) => q.real);
    assert.equal(walk(L(c.x, F2, c.z), { tol: 0.4, max: 6 }), true, `onto row ${r}'s walker’s stone (${where()})`);
    wait(0.4);
    assert.ok(P.pos.y > L(0, F2 - 0.6, 0).y, `it holds (${r})`);
  }
  assert.equal(walk(L(ROOMS.unseen.x0 + 31.5, F2, WZ - 5)), true, `onto the far landing (${where()})`);
  assert.ok(logic.drumOn('ballT', 'pT'), 'the Sounding Toe’s sphere lies on its plate here');
  // the far landing: the walker's print only the lens shows, the eye across the chasm
  const ball4 = rt.piece('ball4');
  const pushOn = () => { walk(ball4.center.clone().addScaledVector(ball4.dir, -(ball4.r + 1.4)).setY(ball4.group.position.y), { tol: 0.6, max: 6 }); ball4.hit('push', ball4.dir.clone(), { strength: 1 }); for (let i = 0; i < 6 / DT && !(ball4.rest && i > 30); i++) frame(); };
  for (let k = 0; k < 3 && !logic.drumOn('ball4', 'p4'); k++) pushOn();
  assert.ok(logic.drumOn('ball4', 'p4'), `the sphere on the walker's print (${ball4.t.toFixed(2)})`);
  look(rt.piece('s2').center); lower();
  rt.piece('s2').hit('shoot');
  assert.ok(logic.isLit('s2'));
  // the far door: the eye, the print, the great sphere down, and the Lodge's key
  assert.equal(walk(L(ROOMS.unseen.x1 - 1.6, F2, WZ)), true, `before the far door (${where()})`);
  wait(2.6);
  assert.equal(logic.keysIn('d4'), 1, 'the Lodge’s key in it');
  assert.equal(logic.isOpen('d4'), true, 'the far door opens');
  assert.equal(walk(L(ROOMS.vault.x1 - 4.4, F2, WZ)), true, `into the vault (${where()})`);
  wait(0.3);
  bestInteractable(P).entry.use(P);
  wait(1.5);
  assert.equal(logic.isFound('kG'), true, 'the great key');
  // ---- the last lift, down to the heel's floor
  assert.equal(walk(L(ROOMS.unseen.x1 - 1.6, F2, WZ)), true, `back to the far door (${where()})`);
  const real = (r) => row(r).find((q) => q.real);
  for (let r = 5; r >= 0; r--) assert.equal(walk(L(real(r).x, F2, real(r).z), { tol: 0.4, max: 6 }), true, `back over row ${r} (${where()})`);
  assert.equal(walk(L(ROOMS.unseen.x0 + 3, F2, WZ - 6)) && walk(L(23, F2, WZ)) && walk(at(90 * DEG, 17, F2)) && roundTo(90, 175, F2) && walk(L(0, F2, WZ - WELL.r - 2.5)), true, `onto the last lift's landing (${where()})`);
  const L3 = rt.pieces.find((p) => p.path && p.path.length === 2 && Math.abs(rt.kit.local(p.path[0]).y - F3) < 0.1);
  assert.ok(L3, 'the last lift');
  assert.ok(wait(20, () => Math.abs(rt.kit.local(L3.group.position).y - F2) < 0.05 && L3.wait > 0.5), 'it comes up');
  assert.equal(walk(L3.group.position.clone(), { tol: 0.8, max: 4 }), true, `onto it (${where()})`);
  assert.ok(wait(20, () => Math.abs(H.local().y - F3) < 0.3), `it carries him down (${where()})`);
  assert.equal(walk(L(0, F3, WZ - WELL.r + 1)) && walk(at(170 * DEG, 17, F3)) && roundTo(170, 10, F3) && walk(L(0, F3, WZ + 18.5)), true, `round the heel to the great door (${where()})`);
  wait(2.8);
  assert.ok(logic.unlocked('dG') && logic.isOpen('dG'), 'the great key in the great door: it opens');
  // ---- the Echo's Hall: answer each note; through the lens the one that answers wears the walker's print
  const CH = rt.kit.local(rt.guardian.arena.center).z;
  assert.equal(walk(L(0, F3, CH - 15)), true, `into the hall (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  for (let n = 0; n < 16 && G.state !== 'weary'; n++) {
    assert.ok(wait(40, () => G.state === 'open'), `it sings (${n})`);
    assert.ok(rt.sing >= 0, 'one sphere answers its note');
    wait(0.1);
    // (the lens sees 34 m: the far sphere stood 34.3–34.5 m from where the hall's walk left him, so a step toward it first)
    if (G.phaseIndex >= 1) { const c = rt.resonators[rt.sing].center, d = Math.hypot(c.x - P.pos.x, c.z - P.pos.z); if (d > 30) walk(P.pos.clone().lerp(c.clone().setY(P.pos.y), (d - 28) / d), { tol: 0.8, max: 4 }); }
    if (G.phaseIndex >= 1) { look(rt.resonators[rt.sing].center); assert.ok(rt.resonators[rt.sing].print.visible, 'the walker’s print on the one that answers'); }
    LENS_VIEW.k = 0;
    rt.resonators[rt.sing].hit('shoot');
  }
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  for (let i = 0; i < 20 / DT && Math.hypot(G.model.pos.x - G.model.rest.x, G.model.pos.z - G.model.rest.z) > 0.6; i++) frame();
  wait(2);
  P.teleport(G.model.mouth.clone().setY(L(0, F3, 0).y).add(V(0, 0.1, -2.6)), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, 'temple.spheres.touch', 'a hand held out to it');
  near.entry.use(P);
  assert.equal(game.flag('temple.spheres.done'), true);
  game.reset();
  own();
});
