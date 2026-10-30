// Coming back in the same room (issue #783, the author: "Remove all the tiny checkpoint pillars in temples. If I die or
// drop into a pit just bring me back in the same room"): no glyph stone is drawn in any house; every room of every
// house has a place to come back to on a floor, with room for the traveller, out of the pits and the walls; walked into
// a room through a doorway, a fall into its pit or a knock-out has him back at that doorway, facing in, the room's
// puzzles as they were; and a save from the days of the stones loads and comes back where it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLES, TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { DAMAGE } from '../src/resources.js';
import { roomAt } from '../src/temples/house-plan.js';
import { Mark } from '../src/temples/pieces.js';
import { ENTRY } from '../src/temples/runtime.js';
import { quiet, own, sides, piecesOf, BODY } from './house-walk.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const IDS = Object.keys(TEMPLES);
const worlds = new Map();
function world(id) {
  if (!worlds.has(id)) {
    const scene = new THREE.Scene();
    const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
    const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
    quiet(() => level.init?.(physics));
    const rt = templeOf(level, id) ?? level.temple;
    if (!rt.physics) rt.init(physics);
    worlds.set(id, { scene, level, physics, rt });
  }
  return worlds.get(id);
}
const fmt = (rt, p) => rt.kit.local(p).toArray().map((v) => v.toFixed(1)).join(', ');
/** A floor with room for the traveller's body: solid under, head room, no wall pushing him out, no pit. */
function standsAt(W, p) {
  const { physics, rt } = W;
  const g = physics.groundAt(p.x, p.y + 1, p.z, 2);
  if (!Number.isFinite(g) || Math.abs(g - p.y) > 0.45) return 'no floor';
  if (physics.rayDistance(V(p.x, g + 0.3, p.z), V(0, 1, 0), 2) < 1.7) return 'no head room';
  const push = physics.pushCapsule(V(p.x, g, p.z), BODY.r * 0.9, BODY.bottom, BODY.top, V());
  if (push && push.length() > 0.15) return `in a wall (pushed ${push.length().toFixed(2)} m)`;
  if (rt.pits.some((pit) => pit.contains(p) || pit.contains(p.clone().add(V(0, -1, 0))))) return 'over a pit';
  if (!rt.inside(p)) return 'outside the house';
  return null;
}

test('no glyph stone stands in any house: the marks are only where the rooms are, nothing drawn, nothing to wake', () => {
  let n = 0;
  for (const id of IDS) {
    const { rt } = world(id);
    assert.ok(rt.marks.length >= 4, `${id}: its rooms' anchors kept (the map and the machines read them)`);
    for (const m of rt.marks) {
      assert.ok(m instanceof Mark && !m.group && !m.glow, `${id}: the ${m.room} mark draws nothing`);
      n++;
    }
    let stones = 0;
    rt.root.traverse((o) => { if (o.isMesh && o.geometry?.type === 'LatheGeometry' && o.parent?.parent === rt.root && o.parent.children.length === 2 && o.parent.children[1].material?.uniforms?.uGlow && rt.marks.some((m) => m.pos.distanceTo(o.parent.position) < 0.01)) stones++; });
    assert.equal(stones, 0, `${id}: no stone at a mark`);
  }
  assert.ok(n > 150, `every house's (${n})`);
});

test('every room of every house has a place to come back to: on a floor, with head room, out of the walls and the pits', () => {
  const report = [];
  for (const id of IDS) {
    const W = world(id), { rt } = W, def = rt.def.logic, plan = rt.housePlan();
    // (the rooms as the house's logic joins them, walked from the way in: every one reached)
    const seen = new Set([def.entry]), todo = [def.entry];
    while (todo.length) { const r = todo.pop(); for (const l of def.links) for (const [x, y] of [[l.a, l.b], [l.b, l.a]]) if (x === r && !seen.has(y)) { seen.add(y); todo.push(y); } }
    assert.deepEqual([...seen].sort(), Object.keys(def.rooms).sort(), `${id}: every room on the way from the entrance`);
    for (const room of seen) {
      const c = rt.comeBack(room);
      assert.ok(c?.spot, `${id}: ${room} has somewhere to come back to`);
      const why = standsAt(W, c.spot);
      assert.equal(why, null, `${id}: ${room}'s place (${fmt(rt, c.spot)}, ${c.room}'s) ${why}`);
      assert.ok(Number.isFinite(c.heading), `${id}: ${room}: a way to face`);
      const l = rt.kit.local(c.spot), at = roomAt(plan, [l.x, l.y, l.z]);
      if (room === def.entry) assert.ok(c.spot.distanceTo(rt.arrival.pos) < 0.01, `${id}: the first room's is the house's entrance`);
      // (a room with a mark: its own; the guardian's hall: the room before it, never inside the ring that wakes it)
      if (rt.marks.some((m) => m.room === room) && !def.rooms[room].boss) assert.equal(c.room, room, `${id}: ${room} comes back in itself`);
      if (def.rooms[room].boss) assert.ok(!rt.inWakeRing(c.spot), `${id}: the guardian's hall: not inside the ring that wakes it`);
      if (c.room !== room) report.push(`${id}/${room}→${c.room}`);
      else assert.ok(at === room || rt.marks.some((m) => m.room === room) || room === def.entry, `${id}: ${room}'s floor is its own (${at})`);
    }
  }
  // (rooms with no anchor of their own and no floor found round their middle, a passage, a guardian's hall, the way out:
  // the room before; walked into, every one has its doorway)
  assert.ok(report.length < 40, `few come back elsewhere before a doorway is known: ${report.join(' ')}`);
});

/** A traveller in house `id`, connected, and the frame as main.js runs it. */
function traveller(id) {
  game.reset();
  own('backpack', 'gun', 'doublejump', 'glider', 'sword', 'shield');
  const W = world(id), { level, physics, rt } = W;
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit ?? 1900 });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.5, max = 8 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol) return true; frame({ KeyW: true }, Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z))); }
    return false;
  };
  return { ...W, P, notes, frame, wait, walk };
}

/** A doorway into a room with a pit: a link with a door piece between rooms a and b (b's pit), the door held open. */
function doorwayToPit(W) {
  const { rt, physics } = W, def = rt.def.logic, plan = rt.housePlan();
  const pitRooms = new Set(rt.pits.map((p) => p.room));
  for (const l of def.links) {
    for (const [a, b] of [[l.a, l.b], [l.b, l.a]]) {
      if (!l.door || !pitRooms.has(b) || def.rooms[b]?.boss || !piecesOf(rt, l.door)[0]?.slab) continue;
      rt.logic.force(l.door, true);
      for (const p of piecesOf(rt, l.door)) p.setOpen?.(true, true);
      const s = sides(rt, physics, l.door);
      if (!s?.from?.every(Boolean)) continue;
      const room = (p) => { const q = rt.kit.local(p); return roomAt(plan, [q.x, q.y, q.z]); };
      const [inA, inB] = room(s.from[0]) === b ? [s.from[1], s.from[0]] : [s.from[0], s.from[1]];
      if (room(inB) !== b || room(inA) === b) continue;
      return { link: l, a, b, from: inA, to: inB, door: s.at, pit: rt.pits.find((p) => p.room === b) };
    }
  }
  return null;
}

const flags = (id) => Object.fromEntries(Object.entries(game.data.flags).filter(([k]) => k.startsWith(`temple.${id}.`) && !/\.(checkpoint|been\.)/.test(k)));

for (const id of ['desert', 'arzach', 'garage', 'moonfoundry']) {
  test(`${id}: walked into a room through its doorway, a fall into its pit and a knock-out both bring you back at that doorway, facing in, the room as it was`, () => {
    const T = traveller(id), { rt, P, wait, walk } = T;
    const D = doorwayToPit(T);
    assert.ok(D, `${id}: a doorway into a room with a pit`);
    // through the doorway, from the room before into the pit's room
    P.teleport(D.from.clone(), V(0, 1, 0), V(0, 0, 1));
    wait(0.6);
    assert.equal(walk(D.to), true, `${id}: through the doorway of ${D.b} (${fmt(rt, P.pos)})`);
    wait(ENTRY.settle + 0.5);
    const e = rt.entries.get(D.b);
    assert.ok(e, `${id}: ${D.b}'s doorway remembered`);
    assert.ok(e.spot.distanceTo(D.door) < 7, `${id}: by its door (${fmt(rt, e.spot)} vs ${fmt(rt, D.door)})`);
    const into = V(D.to.x - D.from.x, 0, D.to.z - D.from.z).normalize();
    assert.ok(Math.sin(e.heading) * into.x + Math.cos(e.heading) * into.z > 0.6, `${id}: facing into the room`);
    assert.equal(game.flag(`temple.${id}.checkpoint`), D.b, 'the room is the save\'s');
    const before = flags(id);
    // ---- into the pit: back at the doorway, a graze taken, never knocked out
    const hearts = P.hearts;
    const c = D.pit.box.getCenter(V());
    P.teleport(rt.kit.world(c.x, c.y, c.z), V(0, 1, 0), V(0, 0, 1));
    T.frame();
    assert.ok(P.pos.distanceTo(e.spot) < 0.3, `${id}: out of the pit at ${D.b}'s doorway (${fmt(rt, P.pos)})`);
    assert.ok(Math.abs(P.heading - e.heading) < 1e-6, `${id}: facing in`);
    assert.ok(!P.dead && Math.abs(hearts - P.hearts - DAMAGE.graze) < 1e-6, `${id}: a graze, as before (${hearts} → ${P.hearts})`);
    assert.ok(T.notes.some((n) => /doorway you came in by/.test(n)), `${id}: and says where you are`);
    assert.ok(!T.notes.some((n) => /glyph stone|last mark/.test(n)), `${id}: no stone spoken of`);
    wait(0.5);
    // ---- knocked out somewhere else in the room: wakes at the same doorway
    P.teleport(e.spot.clone().add(V(0.6, 0.2, 0.6)), V(0, 1, 0), V(0, 0, 1));
    wait(0.4);
    P.hurt(Infinity, 'hit');
    wait(2.5);
    assert.ok(P.dead, `${id}: knocked out`);
    P.restart();
    T.frame();
    assert.ok(P.pos.distanceTo(e.spot) < 0.6, `${id}: awake at ${D.b}'s doorway (${fmt(rt, P.pos)} vs ${fmt(rt, e.spot)})`);
    assert.ok(Math.abs(P.heading - e.heading) < 0.3, `${id}: facing in`);
    assert.deepEqual(flags(id), before, `${id}: nothing in the house put back`);
    rt.logic.force(D.link.door, null);
    game.reset();
    own();
  });
}

test('a doorway a bridge has left (its floor gone): you come back at the room\'s own place, not over the drop', () => {
  const T = traveller('desert'), { rt, P } = T;
  const room = rt.marks[3].room;
  rt.entries.set(room, { spot: rt.kit.world(0, -40, 0), heading: 0, room, walked: true });   // (no floor there)
  rt.footRoom = room;
  const c = rt.comeBack();
  const m = rt.marks.find((k) => k.room === room);
  assert.ok(c.spot.distanceTo(m.spot) < 0.01, 'the room\'s anchor');
  assert.equal(c.room, room);
  game.reset();
  own();
  void P;
});

test('a save from the days of the glyph stones loads: its last stone\'s room is where it wakes, nothing else asked of it', () => {
  // (temple.markTold: the first stone had said what it was; temple.<id>.checkpoint: the room of the last stone woken)
  for (const [id, room] of [['desert', 'channel'], ['arzach', 'gusts'], ['incal', 'turning']]) {
    const past = { 'temple.markTold': true, [`temple.${id}.entered`]: true, [`temple.${id}.checkpoint`]: room };
    const T = traveller(id);
    for (const [k, v] of Object.entries(past)) game.set(k, v);
    const { rt, P } = T;
    const m = rt.marks.find((k) => k.room === room);
    assert.ok(m, `${id}: ${room} has its anchor still`);
    P.teleport(m.spot.clone().add(V(1, 0.3, 0)), V(0, 1, 0), V(0, 0, 1));
    rt.loaded = true;   // (main.js: where the save left him)
    T.wait(0.6);
    assert.equal(rt.checkpoint?.room, room, `${id}: its place kept`);
    assert.equal(rt.entries.size, 0, `${id}: no doorway taken for the room it was loaded in`);
    P.hurt(Infinity, 'hit');
    T.wait(2.5);
    P.restart();
    T.frame();
    assert.ok(P.pos.distanceTo(m.spot) < 0.6, `${id}: awake by where its stone stood, in ${room} (${fmt(rt, P.pos)})`);
    game.reset();
    own();
  }
});
