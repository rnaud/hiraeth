// The Founders' Belfry round its Great Belfry (issue #408, docs/design/temple-best-practices.md): the founders' bell rung
// or still is the house's one state, set at a lever by every hub or with the hook at a bell's ring upstairs, and it stands
// the stones on both floors; the great hall seen on both floors at once; the drop from the gallery back to the hub's floor.
// The house walked through with a real traveller: every lever pulled with the use button, every ring hooked from where he
// stands, the great stone ridden, every drop fallen. Its state machine and its play-through by hits are
// tests/temples.test.js's and tests/temple-playthrough.test.js's; this is the feet.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { templeOf, nextSpot } from '../src/temples/attachment.js';
import { ROOMS, UP, RING, GALLERY, FOUNDERS, HOLD, FallUpStone, STATE_LOOK } from '../src/temples/arzach2.js';
import { createArzach2 } from '../src/levels/arzach2.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { bestInteractable } from '../src/interact.js';
import { updateHazards } from '../src/hazards.js';
import { HOOK } from '../src/gadgets/hook.js';
import { answerAsks } from './guardian-asks.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };

/** The belfry built in its world, a traveller at its door, and his hands. */
function house() {
  game.reset();
  own('backpack', 'gun');
  const scene = new THREE.Scene();
  const level = quiet(() => createArzach2(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, 'arzach2');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, unsafe: level.unsafe });
  // (these hands sprint to a mark and stand on it at once: the old crisp stop. A player's carried stop from a run, two
  // strides on, is the game's default and has its own tests: tests/stop-feel.test.js, issue #702)
  P.stopFeel = 'snap';
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers?.(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); level.update(DT, t, {}); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s, until = () => false) => { for (let i = 0; i < s / DT; i++) { if (until()) return true; frame(); } return until(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const via = (...pts) => pts.every((q) => walk(L(...q)));
  const sight = (to, from = P.pos.clone().add(V(0, 1.5, 0))) => { const d = to.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.9; };
  /** A ring hooked from where he stands (src/gadgets/hook.js: its bite on a target, mode 'hook'), if in the hook's reach and sight. */
  const hook = (id) => { const b = rt.piece(id); assert.ok(b && b.at.distanceTo(P.pos) <= HOOK.range && sight(b.at), `${id} in the hook’s reach and sight (${where()})`); b.hit('push', { mode: 'hook' }); };
  /** The use button by a lever: pulled. */
  const pull = (lever) => { const near = bestInteractable(P); assert.equal(near?.entry.id, `temple.arzach2.${lever}`, `by ${lever}, the button pulls it (${where()})`); return near.entry.use(P); };
  const rung = () => rt.logic.drumOn('bell', 'bellRung'), still = () => rt.logic.drumOn('bell', 'bellStill');
  return { level, physics, rt, P, notes, L, frame, walk, wait, where, via, sight, hook, pull, rung, still, time: () => t };
}

test('the Founders’ Belfry on foot (issue #408): the founders’ bell rung and still at the levers and the rings, the great stone ridden, the porch’s slab, the Hall of Echoes’ bridge and spur, the great key’s ledge and the drops back to the hub, the far door rung open, the Cloud-Mother calmed', () => {
  const H = house(), { rt, P, L, walk, wait, where, via, pull, hook, rung, still, physics, sight, frame } = H;
  const R = ROOMS, NV = R.nave, AZ = (R.stones.z0 + R.stones.z1) / 2 - 5.2, C3 = R.bell.z, PZ = (R.porch.z0 + R.porch.z1) / 2, E0 = R.echoes.z0, CH = R.hall.z;
  const B = rt.foundersBell;
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), 'in the belfry');
  assert.ok(still() && B, 'the founders’ bell still: its stones fell up');
  // ---- the Hall of Stones, a hub: the door's lamp wants the east store's ball, its keyhole the west store's key; the
  // founders' bell's lever by the door (issue #408): it rings the bell beyond, and stills it again once its hum fades
  assert.equal(walk(L(FOUNDERS.levers[0].at[0], 0, FOUNDERS.levers[0].at[2] - 1.6), { tol: 0.5 }), true, `to the hall's lever (${where()})`);
  pull('lever.stones');
  wait(0.3);
  assert.ok(rung(), 'pulled: the bell rings at once');
  assert.equal(pull('lever.stones'), 'stilling');
  wait(HOLD.fade - 1.5);
  assert.ok(rung(), 'stilled: its hum still holds the stones a while');
  wait(2.5);
  assert.ok(still(), `then its stones fall up (${HOLD.fade} s)`);
  const roll = (id, plate) => {
    const ball = rt.piece(id);
    for (let k = 0; k < 10 && !rt.logic.drumOn(id, plate); k++) {
      walk(ball.center.clone().addScaledVector(ball.dir, -(ball.r + 1.3)), { tol: 0.5 });
      ball.hit('push', ball.dir.clone(), { strength: 1 });
      wait(2.6);
    }
    return rt.logic.drumOn(id, plate);
  };
  const keepers = [{ room: 'storeW', alive: true }, { room: 'storeW', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(via([-6, 0, AZ], [-24, 0, AZ]), true, `into the west store (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dSW'), false, 'the archway shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arW') && rt.logic.isOpen('dSW'), 'beaten: won, and the archway lets go');
  assert.equal(walk(rt.piece('kW').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  pullChest(rt, 'kW', P);
  assert.equal(via([-24, 0, AZ], [-6, 0, AZ], [6, 0, AZ], [24, 0, AZ]), true, `into the east store (${where()})`);
  assert.equal(roll('ball2', 'p2'), true, `the east ball home (${rt.piece('ball2').t.toFixed(2)})`);
  assert.equal(via([24, 0, AZ], [6, 0, AZ], [0, 0, 40], [0, 0, R.stones.z1 - 1.6]), true, `to the door (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.isOpen('d1'), true, 'the small key in, the ball home: the door');
  // ---- the Great Belfry (G4): 66 m long, its gallery round three sides 8 m up, both floors seen at once
  assert.ok(NV.z1 - NV.z0 >= 60 && NV.x1 - NV.x0 >= 36 && NV.top - NV.y >= 30, 'a great hall: 60 m and more');
  assert.equal(walk(L(0, 0, NV.z0 + 3)), true, `into the Great Belfry (${where()})`);
  const floorEye = L(0, 1.7, NV.z0 + 4);
  // (the head of someone standing at the gallery’s edge, on all three sides, seen from the floor at the way in)
  for (const [x, z] of [[GALLERY.w - 1, (GALLERY.s + GALLERY.n) / 2], [GALLERY.e + 1, (GALLERY.s + GALLERY.n) / 2], [8, GALLERY.n + 1]]) assert.ok(sight(L(x, UP + 2.0, z), floorEye), `the gallery seen from the floor, both floors at once (${x}, ${z})`);
  const stone = rt.pieces.find((p) => p instanceof FallUpStone);
  assert.ok(stone.s > stone.total - 0.01, 'the great stone up at the gallery: the bell is still');
  // the eye on the gallery's north band, seen from the floor (not from the band: under your feet)
  const eye = rt.piece('s1').center;
  assert.ok(sight(eye, L(2, 1.7, 90)) && !sight(eye, L(0, UP + 1.8, GALLERY.n + 3)), 'the eye under the gallery seen from the floor, not from above');
  rt.piece('s1').hit('shoot');
  wait(1);
  assert.ok(rt.logic.isOpen('d2'), 'the eye wakes the high door');
  // the floor's lever by the way in: rung, the great stone comes down; stilled, it falls up again once the hum fades, and
  // whoever stands on it goes up with it: a run the length of the hall
  const lv = rt.piece('lever.stair');
  assert.equal(walk(L(lv.o.at[0], 0, lv.o.at[2] + 1.6), { tol: 0.5 }), true, `to the floor's lever (${where()})`);
  pull('lever.stair');
  for (let i = 0; i < 8 / DT && stone.s > 0.02; i++) frame();
  assert.ok(rung() && stone.s < 0.05, 'rung: the great stone down on the floor at the far end');
  pull('lever.stair');
  const t0 = H.time();
  assert.equal(walk(stone.group.position, { tol: 0.8, max: HOLD.fade, dy: 1.0 }), true, `onto the great stone before the hum fades (${where()})`);
  assert.ok(H.time() - t0 < HOLD.fade, `a run of ${(H.time() - t0).toFixed(1)} s, inside the fade`);
  for (let i = 0; i < 25 / DT && stone.s < stone.total - 0.05; i++) frame();
  assert.ok(still() && P.pos.y > L(0, UP - 0.5, 0).y, `stilled, the stone fell up with him to the gallery (${where()})`);
  assert.equal(walk(L(-4, UP, GALLERY.n + 3), { tol: 0.7, max: 4 }), true, `off onto the gallery (${where()})`);
  // ---- the Bell Chamber: the hook
  assert.equal(walk(L(0, UP, C3 - 10)), true, `into the bell chamber (${where()})`);
  items.grant('hook'); game.emit('box:opened', { id: 'arzach2.temple.bell' });
  hook('hb.eT');   // (the chamber's own bell, a try: three stones come down round the dais while it rings)
  wait(1);
  assert.ok(rt.logic.isOpen('heap') && still(), 'the chamber’s bell brings its stones down a while: not the founders’ bell');
  // ---- the Bell Porch: its door's slab one of the founders' stones; the porch's bell answers the founders' bell
  assert.equal(walk(L(0, UP, PZ - 6)), true, `into the porch (${where()})`);
  assert.equal(rt.logic.isOpen('d3'), false, 'the bell still: the slab stands in the door');
  hook('hb.e1');
  wait(0.5);
  assert.ok(rung() && rt.logic.isOpen('d3'), 'its bell hooked: the founders’ bell rings, and the slab sinks');
  // ---- the Hall of Echoes: rung, the bridge's stones are down; the ball rolled across holds them for good
  assert.equal(walk(L(0, UP, E0 + 2.5)), true, `into the Hall of Echoes (${where()})`);
  assert.ok(rt.logic.isOpen('br1') && !rt.logic.isOpen('spur'), 'rung: the bridge down, the spur in the chasm');
  const ball = rt.piece('ball3');
  walk(ball.center.clone().addScaledVector(ball.dir, -(ball.r + 1.3)), { tol: 0.5 });
  ball.hit('push', ball.dir.clone(), { strength: 1 });
  for (let i = 0; i < 14 / DT && !rt.logic.drumOn('ball3', 'p3'); i++) frame();
  assert.equal(rt.logic.drumOn('ball3', 'p3'), true, `the ball across, on the far plate (${ball.t.toFixed(3)})`);
  // still (the Hall of Echoes' bell hooked from the near lip): the spur falls up level with the bridge, which the ball holds
  assert.equal(walk(L(5, UP, E0 + 8), { tol: 0.6 }), true, `back on the near lip (${where()})`);
  hook('hb.e2');
  assert.ok(B.fading > 0, 'the hum begins to fade');
  wait(HOLD.fade + 2);
  assert.ok(still() && rt.logic.isOpen('spur') && rt.logic.isOpen('br1'), 'still: the spur up, the bridge held by its ball');
  assert.ok([[0, UP, RING.z], [-8, UP, RING.z], [-15, UP, RING.z], [RING.x, UP, RING.z]].every((q) => walk(L(...q), { max: 8 })), `over the bridge and the spur into the Ringers’ Walk (${where()})`);
  assert.ok(P.pos.y > L(0, UP - 0.5, 0).y, 'on its floor');
  // back along it outside the house, up its stair, and east onto the ledge high in the Great Belfry: the great key, free
  assert.ok([[RING.x, UP, RING.stairs[0] + 2], [RING.x, RING.y, RING.stairs[1] - 1], [RING.x, RING.y, RING.in], [RING.ledge.x0 - 1.5, RING.y, RING.in], [-17, RING.y, RING.in]].every((q) => walk(L(...q), { max: 30, dy: 1.2 })), `along the walk, up its stair, onto the ledge (${where()})`);
  const kB = rt.piece('kB');
  assert.ok(sight(kB.pos.clone().add(V(0, 1, 0)), L(12, 1.7, 100)), 'the great key’s chest seen from the floor across the hall');
  assert.ok(sight(B.at) && kB.pos.distanceTo(B.at) < 20, 'the founders’ bell in sight from the ledge, under 20 m');
  assert.equal(walk(kB.pos, { tol: 1.2, max: 8 }), true, `to the great key (${where()})`);
  wait(0.3);
  pullChest(rt, 'kB', P);
  // ---- the drops (G6): off the ledge's end onto the gallery, and off the gallery's open edge to the hub's floor, unhurt
  const hearts0 = P.hearts;
  assert.equal(walk(L(-17.5, RING.y, RING.ledge.z0 + 1.5), { tol: 0.8, max: 6 }), true, `to the ledge's end (${where()})`);
  assert.equal(walk(L(-17.5, UP, RING.ledge.z0 - 4), { tol: 1.0, max: 6, dy: 0.8 }), true, `down onto the gallery (${where()})`);
  assert.equal(walk(L(-15, UP, 86), { tol: 0.8, max: 6, dy: 0.8 }), true, `along the gallery to its open edge (${where()})`);
  assert.equal(walk(L(-8, 0, 86), { tol: 1.0, max: 6, dy: 0.8 }), true, `down to the hub's floor (${where()})`);
  assert.equal(P.hearts, hearts0, 'unhurt by either drop');
  // ---- up again, round to the far door: the floor's lever, the stone, the gallery, the porch's slab sunk for good
  assert.equal(walk(L(lv.o.at[0], 0, lv.o.at[2] + 1.6), { tol: 0.5 }), true, `back to the floor's lever (${where()})`);
  pull('lever.stair');
  for (let i = 0; i < 8 / DT && stone.s > 0.02; i++) frame();
  pull('lever.stair');
  assert.equal(walk(stone.group.position, { tol: 0.8, max: HOLD.fade, dy: 1.0 }), true, `onto the great stone again (${where()})`);
  for (let i = 0; i < 25 / DT && stone.s < stone.total - 0.05; i++) frame();
  assert.ok(P.pos.y > L(0, UP - 0.5, 0).y, `up again (${where()})`);
  assert.ok(via([-4, UP, GALLERY.n + 3], [0, UP, C3 - 10], [0, UP, PZ - 6], [0, UP, E0 + 2.5]), `through the chamber and the porch, its slab sunk for good though the bell is still (${where()})`);
  assert.ok(still() && rt.logic.isOpen('d3'));
  assert.equal(walk(L(-1.5, UP, E0 + 37), { max: 10 }), true, `over the stones the ball holds (${where()})`);
  assert.equal(walk(L(0, UP, R.echoes.z1 - 1.5), { max: 4 }), true, `up to the far door (${where()})`);
  wait(2.2);
  assert.equal(rt.logic.keysIn('d4'), 1, 'the great key goes in');
  assert.equal(rt.logic.isOpen('d4'), false, 'but its slab stands while the bell is still');
  // (the scout: the bell, at the nearest place it is set from: the Hall of Echoes' ring, from the far lip)
  assert.ok(nextSpot(rt).distanceTo(rt.piece('hb.e2').at) < 0.1, `the scout points at the Hall of Echoes’ bell (${rt.logic.next()} at ${rt.kit.local(nextSpot(rt)).toArray().map((v) => v.toFixed(1))})`);
  assert.equal(walk(L(0, UP, R.echoes.z1 - 8), { max: 4 }), true, `back a step on the far lip (${where()})`);
  hook('hb.e2');
  wait(0.5);
  assert.ok(rung() && rt.logic.isOpen('d4'), 'rung from the far lip: the far door opens');
  // ---- the Cloud-Mother's hall
  assert.equal(walk(L(0, UP, CH - 14)), true, `into her hall (${where()})`);
  const G = rt.guardian;
  wait(0.4);
  assert.notEqual(G.state, 'sleep', 'she wakes');
  P.opts.health = false;
  const rising = () => G.phaseIndex >= 1 && G.attack?.over && !G.struck && G.at > 0.15 && G.at < G.windFor * 0.5;
  const hallBell = () => { const bs = rt.pieces.filter((p) => p.id?.startsWith?.('hb.hall.')).sort((a, b) => a.at.distanceTo(G.model.pos) - b.at.distanceTo(G.model.pos)); const b = bs.find((q) => q.at.distanceTo(P.pos) <= HOOK.range && sight(q.at)); assert.ok(b, `a hall bell in reach (${where()})`); b.hit('push', { mode: 'hook' }); };
  let landed = 0;
  for (let n = 0; n < 16 && G.state !== 'weary'; n++) {
    answerAsks({ G, P, frame }, { keep: true });
    let ready = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open' || rising()) { ready = true; break; } }
    assert.ok(ready, `she cries, or rises to dive (${n}, phase ${G.phaseIndex})`);
    if (G.state !== 'open') {
      hallBell();
      assert.ok(rt.hallStones.list.some((s) => s.held > 0), `a stone comes down where she will dive (${n}: ${G.state}, ${G.attack?.id}, struck ${G.struck}, at ${G.at?.toFixed(2)}/${G.windFor?.toFixed(2)}, held ${rt.hallStones.list.map((s) => s.held.toFixed(1))}, phase ${G.phaseIndex})`);
      let lay = false;
      for (let i = 0; i < 6 / DT; i++) { frame(); if (G.state === 'open') { lay = true; break; } }
      assert.ok(lay, `she dives onto it and lies there, crying (${n})`);
      landed++;
    }
    P.teleport(G.model.pos.clone().setY(L(0, UP, 0).y).add(V(G.model.pos.x > L(0, UP, CH).x ? -6 : 6, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
    hallBell();
  }
  assert.ok(landed > 0, 'a stone brought down under her at least once');
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  for (let i = 0; i < 30 / DT && Math.hypot(G.model.pos.x - G.model.rest.x, G.model.pos.z - G.model.rest.z) > 0.6; i++) frame();
  wait(2);
  P.teleport(G.model.mouth.clone().setY(L(0, UP, 0).y).add(V(2.2, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, 'temple.arzach2.touch', 'a hand on her brow');
  near.entry.use(P);
  assert.equal(G.state, 'resolved');
  assert.equal(game.flag('temple.arzach2.done'), true);
  // ---- outside: the stones that fell up come down
  const stones = H.level.arzach2.floaters.children;
  const before = stones.map((g) => g.getWorldPosition(V()).y);
  wait(20);
  const after = stones.map((g) => g.getWorldPosition(V()).y);
  assert.ok(after.every((y, i) => y < before[i] - 5), `every floating stone came down (${after.map((y, i) => (before[i] - y).toFixed(0)).join(', ')})`);
  game.reset();
  own();
});

test('the founders’ bell is readable everywhere (G1): a bell-lamp in every room but the guardian’s, every lamp of the house warm while it rings and cold while it is still; a pull while it fades rings it on', () => {
  const H = house(), { rt, wait } = H, B = rt.foundersBell;
  const lamps = rt.placed.filter((p) => p.cls === 'BellGauge' || p.cls === 'BellLever');
  const rooms = new Set(lamps.map((p) => p.o.room));
  for (const r of Object.keys(rt.def.logic.rooms)) if (!['hall', 'out', 'landing', 'stair'].includes(r)) assert.ok(rooms.has(r), `a bell-lamp or a lever in ${r}`);
  assert.ok(rooms.has('stair') && rooms.has('landing'), 'and a lever on both floors of the Great Belfry');
  const color = () => B.lamp.uniforms.uColor.value.clone();
  wait(1);
  const cold = color();
  B.toggle('test');
  wait(2);
  const warm = color();
  assert.ok(warm.r > cold.r + 0.2 && warm.b < cold.b, `rung, the lamps go warm (${warm.getHexString()} from ${cold.getHexString()})`);
  assert.equal(new THREE.Color(STATE_LOOK.rung).getHexString().length, 6);
  assert.equal(B.toggle('test'), 'stilling');
  wait(2);
  assert.equal(B.toggle('test'), 'rung', 'a pull while it fades: it rings on');
  wait(HOLD.fade + 1);
  assert.ok(H.rung(), 'and stays rung');
  game.reset();
});

/** A key's little chest, stood by: the use button opens it. */
function pullChest(rt, id, P) {
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, `temple.${rt.id}.${id}`, `by the chest of ${id}, the button opens it`);
  near.entry.use(P);
  assert.equal(rt.logic.isFound(id), true, `${id} taken`);
}
