// The Mooring-House round its moored room (issue #417, docs/design/temple-best-practices.md): a round room of the makers
// hung on the house's great cable in the Mooring Hall, docked low at the east landing or high between the gallery's
// halves, is the house's one state. A lever in the Capstan Hall, the room's own capstan and a lever on the west landing
// send it to the other dock; the tether at a dock's moorers' ring calls it home there. Every counterweight in the house
// hangs on the same cable: the room low, they rise (the Lamp Shaft's breath blows, the loft's ring is hauled out of reach,
// the Rope Store's and the Chain Locker's shutters rise, the Cable Walk hangs level); the room high, they sink (the loft's
// ring comes down, the gangway draws taut, the coffer's cage can sink). A gauge and a lamp in every room say which. The
// house walked through with a real traveller: every lever pulled and every capstan turned with the use button, every ring
// pulled from where he stands, the room ridden both ways and called home, the drop off the gallery, the lens's ring, the
// Anchor-Warden. Its state machine is tests/temples.test.js's, its play-through by hits tests/temple-playthrough.test.js's.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { MH, GALLERY, EAST, WEST, ROOM, LOCKER, LOFT, FLOOR, MOOR, MOOR_A, PERCH, STORE, SHAFT_PIER, WING, LEVERS, DRIFT, STATE_LOOK, MooringGauge, ShaftWeight } from '../src/temples/spacecity.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { bestInteractable } from '../src/interact.js';
import { updateHazards } from '../src/hazards.js';
import { allTargets } from '../src/targets.js';
import { LENS_VIEW } from '../src/gadgets/hidden.js';
import { makeMaterial } from '../src/materials.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };

/** The Mooring-House built in its world, a traveller at its door, and his hands. */
function house(flags = {}) {
  game.reset();
  for (const [k, v] of Object.entries(flags)) game.set(`temple.spacecity.${k}`, v);
  own('backpack', 'gun', 'glider', 'doublejump', 'monocle');
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME.spacecity ?? 'spacecity').create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, 'spacecity');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit ?? 1900 });
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
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const local = () => rt.kit.local(P.pos);
  const via = (...pts) => pts.every((q) => walk(L(...q)));
  const stand = (x, y, z) => { P.teleport(L(x, y + 0.05, z), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0); };
  /** The use button by a lever or the room's capstan. */
  const use = (id) => { P.heading = toward(id === 'mooring' ? rt.mooring.capAt : rt.piece(id).top) + Math.PI; frame(); const near = bestInteractable(P); assert.equal(near?.entry.id, `temple.spacecity.${id}`, `by ${id}, the button works it (${where()})`); return near.entry.use(P); };
  const R = () => rt.mooring;
  const docked = (at) => wait(14, () => R().dest == null && R().at === at);
  /** Push a ball along its groove (way +1: toward its b end) from behind it, until it rests on `plate`. */
  const roll = (id, plate, way = 1, n = 10) => {
    const ball = rt.piece(id);
    for (let k = 0; k < n && !rt.logic.drumOn(id, plate); k++) {
      const d = ball.dir.clone().multiplyScalar(way);
      walk(ball.center.clone().addScaledVector(d, -1.9).setY(P.pos.y), { tol: 0.5, max: 4 });
      ball.hit('push', d, { strength: 0.8 });
      wait(0.5); for (let i = 0; i < 8 / DT && !ball.rest; i++) frame();
    }
    return rt.logic.drumOn(id, plate);
  };
  /** The tether from where you stand: the cone's way back to the hand, its strength by the distance (src/fluid-tool.js push). */
  const tether = (target) => {
    const c = target.center, from = P.pos.clone().add(V(0, 1.15, 0)), d = from.distanceTo(c) - (target.r ?? 0.8) - 0.15;
    if (d > 6) return false;
    return target.hit('tether', from.clone().sub(c).normalize(), { strength: 1 - Math.max(0, d) / 6 });
  };
  const pull = (id, plate, n = 8) => {
    const ball = rt.piece(id);
    for (let k = 0; k < n && !rt.logic.drumOn(id, plate); k++) { tether(ball); wait(0.5); for (let i = 0; i < 8 / DT && !ball.rest; i++) frame(); }
    return rt.logic.drumOn(id, plate);
  };
  return { level, physics, rt, P, notes, L, frame, walk, wait, where, local, via, stand, use, R, docked, roll, tether, pull, toward, said: (re) => notes.some((n) => re.test(n)) };
}

function openChest(rt, id, P) {
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, `temple.${rt.id}.${id}`, `by the chest of ${id}, the button opens it`);
  near.entry.use(P);
  assert.equal(rt.logic.isFound(id), true, `${id} taken`);
}

test('the Mooring-House on foot (issue #417): the capstan’s lever for the Lamp Shaft’s breath and the loft’s ring, the moored room called home and ridden, the gallery’s halves bridged, the Rope Store with the room sent down, the drop, the lens’s ring and the great key, the Chain Locker, the gangway, the Cable Walk, the west door and the Anchor-Warden', () => {
  const H = house(), { rt, P, L, walk, wait, where, local, via, stand, use, R, docked, roll, tether, pull, said, frame } = H;
  const G = GALLERY, BS = G.y, hall = (a, d, y = 0) => L(Math.sin(a) * d, y, 30 + Math.cos(a) * d);
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), `standing on the Landing Stage (${where()})`);
  // ---- G1: one state, readable everywhere: the room starts high, a gauge in every room but the guardian's
  assert.ok(R() && R().at === 1 && rt.logic.drumOn('mooring', 'mHigh'), 'the moored room starts docked high');
  const gauged = new Set(rt.pieces.filter((p) => p instanceof MooringGauge).map((p) => p.o.room));
  for (const room of Object.keys(rt.def.logic.rooms)) if (!['arena', 'out', 'stairTop'].includes(room)) assert.ok(gauged.has(room), `a gauge of the room in ${room}`);
  const lamp = makeMaterial({ color: STATE_LOOK.high, glow: STATE_LOOK.glow[0], flat: true, key: 'temple.spacecity.state' });
  assert.ok(lamp.uniforms.uColor.value.equals(new THREE.Color(STATE_LOOK.high)), 'the house’s lamps burn starlight blue while it is high');
  // ---- G4: the Mooring Hall, 57 by 73 m, its floors (0, 6 and 11 m) seen at once
  assert.ok(MH.z1 - MH.z0 >= 60 && MH.x1 - MH.x0 >= 50 && MH.h >= 30, 'a great hall');

  // ---- the Capstan Hall and the Winch Room: the counterweight rolled into its socket, the shaft's gate rises
  assert.equal(walk(L(0, 0, 18)), true, `into the hall (${where()})`);
  assert.equal(walk(hall(-Math.PI * 3 / 4, 10)) && walk(hall(-Math.PI * 3 / 4, WING.d - 10)), true, `into the winch room (${where()})`);
  assert.equal(roll('ballW', 'pG'), true, `the counterweight in its socket (${where()})`);
  assert.equal(rt.logic.isOpen('g1'), true, 'the shaft’s gate rises');
  // ---- the Lamp Shaft: the room high, its counterweight sits on the grating: no breath
  assert.equal(walk(hall(-Math.PI * 3 / 4, 10)) && walk(hall(Math.PI * 3 / 4, 12)) && walk(hall(Math.PI * 3 / 4, 26)), true, `through the gate (${where()})`);
  const shaft = hall(Math.PI * 3 / 4, SHAFT_PIER.draught);
  const weight = rt.pieces.find((p) => p instanceof ShaftWeight);
  assert.ok(Math.abs(rt.kit.local(weight.group.position).y) < 0.5, 'the shaft’s counterweight rests on the grating');
  const edge = shaft.clone().add(hall(Math.PI * 3 / 4, 1).sub(hall(Math.PI * 3 / 4, 0)).multiplyScalar(-3.1));
  assert.equal(walk(edge, { tol: 0.4 }), true, `on the grating, by the counterweight (${where()})`);
  let rose = false;
  for (let i = 0; i < 4 / DT; i++) { frame({ Space: true }, H.toward(shaft)); if (local().y > 9) rose = true; }
  assert.equal(rose, false, `no breath lifts the wings past the counterweight (${where()})`);
  assert.ok(said(/counterweight sits on the grating/), 'it says why');
  // ---- back to the capstan's lever: the room sent down; every counterweight rises
  stand(...rt.kit.local(hall(Math.PI * 3 / 4, 12)).toArray());
  const [lx, , lz] = LEVERS[0].at;
  assert.equal(walk(L(lx + 1.4, 0, lz), { tol: 0.5 }), true, `to the capstan’s lever (${where()})`);
  assert.equal(use('lvH'), 'sent', 'pulled, it sends the room');
  wait(1.2);
  assert.ok(!rt.logic.drumOn('mooring', 'mHigh') && !rt.logic.drumOn('mooring', 'mLow'), 'under way, it is at neither dock');
  assert.ok(docked(0), 'the room docks low');
  assert.ok(lamp.uniforms.uColor.value.equals(new THREE.Color(STATE_LOOK.low)), 'and the lamps burn amber');
  wait(0.5);
  assert.ok(rt.kit.local(weight.group.position).y > 20, 'the shaft’s counterweight hauled up the shaft');
  // ---- the Lamp Shaft: the breath lifts the wings to the pier's top, the lamp-eye there
  stand(...rt.kit.local(hall(Math.PI * 3 / 4, 26)).toArray());
  assert.equal(walk(shaft, { tol: 0.8 }), true, `onto the grating (${where()})`);
  let up = false;
  for (let i = 0; i < 14 / DT; i++) { frame({ Space: true }, 0); if (local().y > 14.6) { up = true; break; } }
  assert.ok(up, `the breath lifts the wings up the shaft (${where()})`);
  const top = hall(Math.PI * 3 / 4, SHAFT_PIER.draught + 4.6, SHAFT_PIER.top);
  for (let i = 0; i < 6 / DT && !(P.onGround && i > 5); i++) { P.heading = Math.atan2(top.x - P.pos.x, top.z - P.pos.z); frame({ Space: Math.hypot(top.x - P.pos.x, top.z - P.pos.z) > 2.6, KeyW: Math.hypot(top.x - P.pos.x, top.z - P.pos.z) > 0.8 }, H.toward(top)); }
  assert.ok(P.onGround && Math.abs(local().y - SHAFT_PIER.top) < 0.5, `onto the pier's top (${where()})`);
  rt.piece('s1').hit('shoot');
  wait(0.2);
  assert.equal(rt.logic.isOpen('d1'), true, 'the lamp-eye wakes, and the great door opens');

  // ---- the Cord Loft: tether mode; the ring on the house's cable is hauled up out of reach while the room is low
  stand(...rt.kit.local(hall(Math.PI * 3 / 4, 12)).toArray());
  assert.equal(walk(L(0, 0, 44)) && walk(L(0, 0, LOFT.z - 12)), true, `into the loft (${where()})`);
  items.grant('tether'); game.emit('box:opened', { id: 'spacecity.temple.tether' });
  assert.equal(rt.logic.gadget, true);
  assert.equal(walk(L(-6, 0, LOFT.z - 7)) && walk(L(-7, 0, LOFT.z)), true, `under the ring (${where()})`);
  const r1 = rt.piece('r1');
  assert.ok(rt.kit.local(r1.center).y > LOFT.ring[1] - 0.5, 'the ring hangs high under the roof');
  assert.equal(tether(r1), false, 'out of the tether’s reach');
  // the room sent back up from the hub's lever, a room away: the counterweights sink, the ring comes down
  assert.equal(walk(L(0, 0, LOFT.z - 12)) && walk(L(0, 0, 40)) && walk(L(lx + 1.4, 0, lz), { tol: 0.5 }), true, `back to the lever (${where()})`);
  assert.equal(use('lvH'), 'sent');
  assert.ok(docked(1), 'the room docks high again');
  assert.equal(walk(L(0, 0, 44)) && walk(L(0, 0, LOFT.z - 12)) && walk(L(-6, 0, LOFT.z - 7)) && walk(L(-7, 0, LOFT.z)), true, `under the ring again (${where()})`);
  wait(2.6);
  assert.ok(Math.abs(rt.kit.local(r1.center).y - LOFT.ring[0]) < 0.3, 'the ring has come down');
  assert.ok(tether(r1), 'pulled');
  wait(0.3);
  assert.equal(rt.logic.isOpen('d2'), true, 'the door into the Mooring Hall opens');

  // ---- the Mooring Hall's east landing: the room up between the gallery's halves, its gate here shut
  assert.equal(walk(L(MH.x1 - 3, 0, LOFT.z)), true, `into the Mooring Hall (${where()})`);
  assert.equal(rt.logic.isOpen('dockL'), false, 'the low dock’s gate is shut: the room is high');
  // the east landing's ball pulled home off its cable-rail: with the room high, the gangway draws taut (and holds)
  assert.equal(walk(L(EAST.lip + 0.8, 0, DRIFT.z + 1.9), { tol: 0.4 }), true, `to the lip beside the cable-rail (${where()})`);
  assert.equal(pull('ballD', 'pD'), true, `the ball pulled home (${where()})`);
  wait(1);
  assert.equal(rt.logic.isOpen('br2'), true, 'the gangway draws taut');
  // the low dock's ring: the tether calls the room home
  const ringL = rt.piece('rgL');
  assert.equal(via([-30, 0, 66], [-30, 0, 40]) && walk(L(G.e + 3.2, 0, ROOM.z + 5.4), { tol: 0.5 }), true, `to the low dock’s ring (${where()})`);
  rt.piece('rgL').hit('push');
  assert.ok(said(/Its line runs to the room/) && R().at === 1, 'a push only rings it');
  assert.ok(tether(ringL), 'pulled');
  assert.ok(docked(0), 'the room comes home to the low dock');
  assert.equal(rt.logic.isOpen('dockL'), true, 'its gate opens');
  // in through the gate, to its capstan; turned, it waits a breath and climbs with him
  assert.equal(walk(L(G.e + 2, 0, ROOM.z), { tol: 0.5 }) && walk(L(ROOM.x + 1.3, 0, ROOM.z), { tol: 0.4 }), true, `into the room (${where()})`);
  // (its walls: no way out west, over the void, while it is docked low)
  for (let i = 0; i < 1.5 / DT; i++) frame({ KeyW: true }, H.toward(L(ROOM.x - 12, 0, ROOM.z)));
  assert.ok(Math.hypot(local().x - ROOM.x, local().z - ROOM.z) < ROOM.wall && P.onGround, `its ribs keep him in (${where()})`);
  assert.equal(walk(L(ROOM.x + 1.3, 0, ROOM.z), { tol: 0.4 }), true);
  assert.equal(use('mooring'), 'up', 'its capstan sends it up');
  assert.ok(docked(1), 'docked high');
  assert.ok(Math.abs(local().y - BS) < 0.5 && P.onGround, `he rode up in it (${where()})`);
  assert.ok(rt.logic.isOpen('dockH') && rt.logic.isOpen('dockW'), 'both the gallery’s gates open: it bridges the halves');
  // ---- the gallery's west half: the Rope Store's shutter rises only with the room sent down; he stays behind
  assert.equal(walk(L(G.w - 3, BS, ROOM.z), { tol: 0.5 }), true, `out onto the west half (${where()})`);
  assert.equal(rt.logic.isOpen('dR'), false, 'the store’s shutter is down');
  assert.equal(walk(L(ROOM.x - 1.3, BS, ROOM.z), { tol: 0.4 }), true, `back in to the capstan (${where()})`);
  assert.equal(use('mooring'), 'down', 'turned');
  assert.equal(walk(L(G.w - 3.5, BS, ROOM.z), { tol: 0.5, max: 3 }), true, `stepped off before it goes (${where()})`);
  assert.ok(docked(0), 'it sinks to the low dock without him');
  assert.equal(rt.logic.isOpen('dockW'), false, 'his gate shuts over the empty shaft');
  wait(1);
  assert.equal(rt.logic.isOpen('dR'), true, 'the store’s shutter rises');
  // the Rope Store (an arena): its shutter shuts behind him while its keepers stand
  const keepers = [{ room: 'store', alive: true }, { room: 'store', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  const storeDoor = STORE.z + STORE.d / 2 + 0.6;
  assert.equal(walk(L(STORE.x, BS, storeDoor + 3)) && walk(L(STORE.x, BS, storeDoor - 2)) && walk(L(STORE.x, BS, STORE.z + 4)), true, `into the Rope Store (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dR'), false, 'the shutter shuts behind him');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arR') && rt.logic.isOpen('dR'), 'beaten: won, and the shutter lets go');
  assert.equal(walk(rt.piece('kS').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kS', P);
  assert.equal(walk(L(STORE.x, BS, storeDoor - 2)) && walk(L(STORE.x, BS, storeDoor + 3.2)), true, `back onto the west half (${where()})`);
  // the only way back east: the high dock's ring on this side calls the room home
  assert.equal(walk(L(G.w - 3.2, BS, ROOM.z + 5.4), { tol: 0.5 }), true, `to the west half’s ring (${where()})`);
  assert.ok(tether(rt.piece('rgW')), 'pulled');
  assert.ok(docked(1), 'the room comes up to bridge the halves');
  assert.equal(walk(L(G.w - 2, BS, ROOM.z), { tol: 0.5 }) && walk(L(ROOM.x, BS, ROOM.z + 2.4), { tol: 0.5 }) && walk(L(G.e + 3, BS, ROOM.z), { tol: 0.5 }), true, `through the room to the east half (${where()})`);
  // ---- G6: the drop off the east half onto the void's breath on the east landing, unhurt
  const hearts = P.hearts;
  const [dx] = G.drop, [cx, cz] = G.catch;
  assert.equal(walk(L(dx, BS, G.z1 - 1.5), { tol: 0.5 }), true, `to the drop (${where()})`);
  for (let i = 0; i < 6 / DT && !(P.onGround && local().y < 1); i++) frame({ KeyW: i < 40 }, H.toward(L(cx, 0, cz)));
  assert.ok(P.onGround && Math.abs(local().y) < 0.5, `down on the east landing (${where()})`);
  wait(0.2);
  assert.ok(P.hearts === hearts && !P.down, 'unhurt');
  assert.ok(said(/billows up under the gallery/), `the breath took the fall (${where()}, ${P.lastLanding})`);
  // and back up the cheap way: the room called home and ridden
  assert.equal(walk(L(G.e + 3.2, 0, ROOM.z + 5.4), { tol: 0.5 }), true, `to the low dock’s ring again (${where()})`);
  assert.ok(tether(ringL) && docked(0), 'the room comes down');
  assert.equal(walk(L(G.e + 2, 0, ROOM.z), { tol: 0.5 }) && walk(L(ROOM.x + 1.3, 0, ROOM.z), { tol: 0.4 }), true);
  assert.equal(use('mooring'), 'up');
  assert.ok(docked(1));
  // ---- the moorers' gate (its small key), the Capstan Hall's balcony: the great key's cage
  const moor = (x) => L(x, BS, MOOR.z);
  assert.equal(walk(L(G.e + 3, BS, ROOM.z), { tol: 0.5 }) && walk(L(MH.x1 - 3, BS, MOOR.z)) && walk(moor(MOOR.gate - 1.6)), true, `to the moorers' gate (${where()})`);
  wait(2.4);
  assert.equal(rt.logic.keysIn('sc'), 1, 'the small key in it');
  const perch = (d, s = 0) => L(Math.sin(MOOR_A) * d + Math.cos(MOOR_A) * s, BS, 30 + Math.cos(MOOR_A) * d - Math.sin(MOOR_A) * s);
  assert.equal(walk(moor(-14), { max: 10 }) && walk(perch(13), { max: 10 }), true, `through it to the balcony (${where()})`);
  assert.equal(walk(perch(PERCH.lip + 0.6, PERCH.side + 1.9), { tol: 0.5 }), true, `to the lip beside the cable-rail (${where()})`);
  assert.equal(pull('bK', 'pK'), true, `the ball pulled home onto the cage's footstone (${where()})`);
  wait(1.5);
  assert.equal(rt.logic.isFound('kB') || rt.logic.check(rt.logic.el('kB').when), false, 'the cage still holds: its chain runs up to the roof and ends in nothing');
  // G2: the tether and the lens at once: the ring only the lens shows
  const rL = rt.piece('rL');
  assert.equal(walk(perch(11.5, 0.5), { tol: 0.5 }) && walk(perch(PERCH.lip + 0.7, PERCH.ring[1]), { tol: 0.5 }), true, `under the chain (${where()})`);
  const ringTarget = allTargets().find((x) => x.position?.() === rL.center);
  assert.equal(ringTarget.enabled(), false, 'nothing there for the tether to catch without the lens');
  LENS_VIEW.k = 1; LENS_VIEW.eye.copy(P.pos).add(V(0, 1.7, 0)); LENS_VIEW.dir.subVectors(rL.center, LENS_VIEW.eye).normalize();
  frame(); LENS_VIEW.k = 0; frame();
  assert.ok(said(/Through the lens/) && ringTarget.enabled(), 'the lens shows it, and it stays');
  // (issue #477, the twist: the ring hangs on the house's cable the other way round from the loft's: hauled up under the
  // roof while the room is high, so he sends the room down without him from the gallery, and comes back)
  assert.ok(rt.kit.local(rL.center).y > PERCH.ringUp - 0.5, 'the ring hangs high under the roof: the room is high');
  assert.equal(tether(rL), false, 'out of the tether’s reach');
  assert.equal(walk(perch(13), { max: 10 }) && walk(moor(-14), { max: 10 }) && walk(L(G.e + 3, BS, ROOM.z), { tol: 0.5 }) && walk(L(ROOM.x + 1.3, BS, ROOM.z), { tol: 0.4 }), true, `back to the room’s capstan (${where()})`);
  assert.equal(use('mooring'), 'down', 'turned');
  assert.equal(walk(L(G.e + 3.5, BS, ROOM.z), { tol: 0.5, max: 3 }), true, `stepped off before it goes (${where()})`);
  assert.ok(docked(0), 'it sinks to the low dock without him');
  assert.equal(walk(L(MH.x1 - 3, BS, MOOR.z)) && walk(moor(-14), { max: 10 }) && walk(perch(13), { max: 10 }) && walk(perch(11.5, 0.5), { tol: 0.5 }) && walk(perch(PERCH.lip + 0.7, PERCH.ring[1]), { tol: 0.5 }), true, `under the chain again (${where()})`);
  wait(2.6);
  assert.ok(Math.abs(rt.kit.local(rL.center).y - PERCH.ring[2]) < 0.3, 'the ring has come down');
  assert.ok(tether(rL), 'pulled');
  wait(1.5);
  assert.equal(walk(rt.piece('kB').pos, { tol: 1.2 }), true, `to the great key (${where()})`);
  wait(0.3);
  openChest(rt, 'kB', P);
  // ---- the cradle down to the hub
  const cradle = rt.piece('cradle');
  const [qx, qz] = [Math.sin(MOOR_A) * PERCH.cradle[0] + Math.cos(MOOR_A) * PERCH.cradle[1], 30 + Math.cos(MOOR_A) * PERCH.cradle[0] - Math.sin(MOOR_A) * PERCH.cradle[1]];
  wait(30, () => cradle.s < 0.2 && cradle.wait > 0.8);
  assert.equal(walk(L(qx, BS, qz), { tol: 0.5, run: false, max: 6 }), true, `onto the cradle (${where()})`);
  assert.ok(wait(20, () => P.onGround && local().y < 1), `ridden down to the hall’s floor (${where()})`);
  // ---- the Chain Locker: its shutter wants the room low (sent down for the great key's ring: still low)
  assert.equal(walk(L(0, 0, 44)) && walk(L(0, 0, LOFT.z - 12)) && walk(L(-14, 0, LOFT.z)) && walk(L(MH.x1 - 3, 0, LOFT.z)), true, `back through the loft (${where()})`);
  assert.ok(docked(0) && rt.logic.isOpen('dL'), 'the room low: the locker’s shutter is up');
  assert.equal(walk(L(LOCKER.door, 0, MH.z1 - 3)) && walk(L(LOCKER.door, 0, MH.z1 + 4)), true, `into the Chain Locker (${where()})`);
  // push the ball OUT along its rail over the well into the far cup: its weight brings the west door's ring down
  const rK = rt.piece('rK');
  assert.ok(rt.kit.local(rK.center).y > LOCKER.up - 0.5, 'the ring hangs high over the well');
  assert.equal(roll('ballK', 'pK2'), true, `the ball out in the far cup (${where()})`);
  wait(2.6);
  assert.ok(Math.abs(rt.kit.local(rK.center).y - LOCKER.down) < 0.3, 'the ring has come down');
  assert.equal(walk(L(LOCKER.well[2] + 1.2, 0, LOCKER.ring[1]), { tol: 0.5 }), true, `to the well's lip under the ring (${where()})`);
  assert.ok(tether(rK), 'pulled');
  wait(0.3);
  assert.equal(rt.logic.isOpen('gN'), true, 'the west door’s chain lets go');
  // ---- the gangway (taut since the ball came home with the room high: it holds) to the west landing
  assert.equal(walk(L(LOCKER.door, 0, MH.z1 - 3)) && walk(L(EAST.lip + 2, 0, WEST.gang)), true, `to the gangway (${where()})`);
  assert.equal(walk(L(EAST.lip - 2, 0, WEST.gang), { tol: 0.6 }) && walk(L(WEST.lip - 3, 0, WEST.gang), { tol: 0.8, max: 16 }), true, `across it to the west landing (${where()})`);
  // ---- the Cable Walk: its catch pulled, and the room low: it hangs level up to the upper landing
  const [kx, , kz] = WEST.catch;
  assert.equal(walk(L(kx, 0, WEST.zN[0] + 1.2), { tol: 0.5 }), true, `to the walk's foot (${where()})`);
  assert.ok(tether(rt.piece('rW')), 'its catch pulled');
  wait(0.3);
  assert.equal(rt.logic.isOpen('cw'), true, 'the room low: the walk hangs level');
  // the west landing's lever: up, and the walk swings away; down again, and it is back
  const [wx, , wz] = LEVERS[1].at;
  assert.equal(walk(L(wx - 1.4, 0, wz), { tol: 0.5 }), true, `to the west landing's lever (${where()})`);
  assert.equal(use('lvW'), 'sent');
  assert.ok(docked(1) && !rt.logic.isOpen('cw'), 'the room high: the walk hangs slack');
  assert.equal(use('lvW'), 'sent');
  assert.ok(docked(0) && rt.logic.isOpen('cw'), 'low again: level');
  wait(2.5);
  assert.equal(walk(L(WEST.walk, 0, WEST.zN[0] + 1.5)) && walk(L(WEST.walk, WEST.yS, WEST.zS[1] - 2), { max: 12 }), true, `up the Cable Walk (${where()})`);
  // ---- the west door, the ante, the Capstan Floor: the Anchor-Warden
  assert.equal(walk(L(MH.x0 + 1.6, WEST.yS, FLOOR.z)) && walk(L(MH.x0 - 5, FLOOR.y, FLOOR.z)) && walk(L(FLOOR.x + FLOOR.r + 3, FLOOR.y, FLOOR.z)), true, `to the Capstan Floor's door (${where()})`);
  wait(2.4);
  assert.equal(rt.logic.keysIn('d6'), 1, 'the great key in it');
  assert.equal(walk(L(FLOOR.x + 10, FLOOR.y, FLOOR.z)), true, `onto the Capstan Floor (${where()})`);
  const Gd = rt.guardian;
  wait(0.3);
  assert.notEqual(Gd.state, 'sleep', 'it wakes');
  P.opts.health = false;
  const anchorTarget = () => allTargets().find((x) => x.accepts?.includes('tether') && x.kind === 'sentinel');
  for (let n = 0; n < 16 && Gd.state !== 'resolved'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (Gd.state === 'open') { open = true; break; } }
    assert.ok(open, `its drum stalls, an anchor out (${n})`);
    const an = rt.anchor;
    if (an.far > 0) for (let k = 0; k < 4 && an.far > 0; k++) Gd.hit('body', 'push');
    const dir = an.at.clone().sub(Gd.arena.center).setY(0).normalize();
    P.teleport(an.at.clone().addScaledVector(dir, -2.4).setY(Gd.arena.y + 0.1), V(0, 1, 0), V(0, 0, 1));
    wait(0.1);
    if (Gd.state !== 'open') continue;
    anchorTarget().onHit('tether');
  }
  assert.equal(Gd.state, 'resolved', `stopped (${Gd.meter.toFixed(2)})`);
  assert.equal(game.flag('temple.spacecity.done'), true);
  game.reset();
  own();
});

test('the moored room: its walls, its doorways and a save left under way', () => {
  // a save made while it was under way (between its stops) finishes the trip when the house is built again
  const H2 = house({ 'drum.mooring': 0.45 });
  H2.wait(0.3);
  assert.ok(H2.R().dest == null && H2.R().at === 0 && H2.rt.logic.drumOn('mooring', 'mLow'), 'left on its way down: docked low');
  // docked low, its west doorway faces the void: nobody walks out of it there; its ribs keep everyone out but at a doorway
  H2.stand(ROOM.x + 1, 0, ROOM.z);
  for (let i = 0; i < 2 / DT; i++) H2.frame({ KeyW: true }, H2.toward(H2.L(ROOM.x - 12, 0, ROOM.z)));
  const l = H2.local();
  assert.ok(Math.hypot(l.x - ROOM.x, l.z - ROOM.z) < ROOM.wall && H2.P.onGround, `kept in (${H2.where()})`);
  H2.stand(ROOM.x, 0, ROOM.z + ROOM.wall + 2);
  for (let i = 0; i < 2 / DT; i++) H2.frame({ KeyW: true }, H2.toward(H2.L(ROOM.x, 0, ROOM.z)));
  assert.ok(Math.hypot(H2.local().x - ROOM.x, H2.local().z - ROOM.z) > ROOM.wall, `kept out but at a doorway (${H2.where()})`);
  game.reset();
  own();
});
