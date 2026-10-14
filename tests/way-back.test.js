// The way back (issue #275: "If I cross the chasm to go to a door and I don't have the key I can't go back?"). No temple
// may strand you: from every room you can get to, at every step of every way through it (in order, the other way round,
// and each key left where it lies), the way back to the entrance stays open (logic.js stranded: the links walked the way
// they go, a crossing that doesn't come back marked `oneWay`). And the Aerie's gulf, where it happened, walked: off the
// higher ledge through its east doorway, down into the passage outside the gulf's wall, back along it and up onto the
// near lip; the other way, the drop at its end is out of any jump's reach (a way back only).
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { solve, stranded, TempleLogic } from '../src/temples/logic.js';
import { TEMPLES, TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { GULF } from '../src/temples/arzach.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };
const CARRY = ['backpack', 'gun', 'doublejump'];

// a made-up house: a glide across a chasm (one way) to the guardian's great lock; its great key in a room off the hall
const CHASM = {
  id: 'chasm', entry: 'hall', gadget: 'glider',
  rooms: { hall: {}, side: {}, far: {}, arena: { boss: true }, out: {} },
  links: [
    { a: 'hall', b: 'side' },
    { a: 'hall', b: 'far', needs: ['glider'], oneWay: true },
    { a: 'far', b: 'arena', door: 'dB' },
    { a: 'arena', b: 'out', door: 'd5' },
  ],
  elements: {
    chest: { type: 'gadget', room: 'hall', item: 'glider' },
    kB: { type: 'key', kind: 'big', room: 'side' },
    dB: { type: 'door', lock: 'big' },
    boss: { type: 'boss', room: 'arena' },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

/** Every room a solve of `def` was ever stranded in, step by step: [{ step, rooms }]. */
function strandings(def, o = {}) {
  const out = [];
  const L0 = new TempleLogic(def, { has: (i) => CARRY.includes(i) });
  if (stranded(L0).length) out.push({ step: '(the start)', rooms: stranded(L0) });
  solve(def, { items: CARRY, ...o, each: (L, step) => { const s = stranded(L); if (s.length) out.push({ step, rooms: s }); } });
  return out;
}
/** The ways through a house the check walks: in order, the other way round, and each of its keys (and finds) never taken. */
function ways(def) {
  const keys = Object.entries(def.elements).filter(([, e]) => e.type === 'key' || e.type === 'find').map(([id]) => id);
  return [{}, { reverse: true }, ...keys.map((k) => ({ forbid: [k] })), ...keys.map((k) => ({ forbid: [k], reverse: true }))];
}

test('the check: over a one-way chasm without the great key you are stranded; a way back clears it', () => {
  const bad = strandings(CHASM, { forbid: ['kB'] });
  assert.ok(bad.some((b) => b.rooms.includes('far')), `stranded on the far side (${JSON.stringify(bad)})`);
  assert.ok(strandings(CHASM).some((b) => b.rooms.includes('far') && b.step === 'take chest (glider)'), 'and in order too: the wings in hand, the far side is in reach before its key');
  const fixed = { ...CHASM, links: [...CHASM.links, { a: 'far', b: 'hall', oneWay: true }] };
  for (const o of ways(fixed)) assert.deepEqual(strandings(fixed, o), [], `with a way back (${JSON.stringify(o)})`);
});

test('no temple strands you: from every room you can get to, at every step (in order, reversed, each key left), the entrance stays in reach', () => {
  for (const [id, { def }] of Object.entries(TEMPLES)) {
    for (const o of ways(def.logic)) {
      const bad = strandings(def.logic, o);
      assert.deepEqual(bad, [], `${id} (${JSON.stringify(o)}): stranded in ${bad.map((b) => `${b.rooms.join(', ')} after "${b.step}"`).join('; ')}`);
    }
  }
});

test('the Aerie: its gulf’s crossings go one way, and without the way back a traveller over it without the great key was stranded (issue #275)', () => {
  const L = TEMPLES.arzach.def.logic;
  for (const [a, b] of [['gulf', 'perch'], ['perch', 'gulfFar']]) assert.ok(L.links.find((l) => l.a === a && l.b === b)?.oneWay, `${a} → ${b}: one way`);
  const before = { ...L, links: L.links.filter((l) => l.a !== 'gulfWay' && l.b !== 'gulfWay') };
  const bad = strandings(before, { forbid: ['kE'] });
  assert.ok(bad.some((b) => b.rooms.includes('gulfFar')), `stranded on the higher ledge, as it was (${JSON.stringify(bad)})`);
  assert.deepEqual(strandings(L, { forbid: ['kE'] }), [], 'and with it, never');
});

test('the Aerie’s way back, walked: off the higher ledge through its east doorway, down into the passage, back along it and up onto the near lip; the other way the drop is out of reach', () => {
  game.reset();
  own(...CARRY);
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME.arzach ?? 'arzach').create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const rt = templeOf(level, 'arzach') ?? level.temple;
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit ?? 1900 });
  rt.connect({ player: P, toast: () => {} });
  let t = 0;
  const W = (x, y, z) => rt.kit.world(x, y, z);
  const local = () => rt.kit.local(P.pos.clone());
  const where = () => local().toArray().map((v) => v.toFixed(1)).join(', ');
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const walk = (to, { tol = 0.6, max = 30, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (Math.hypot(P.pos.x - to.x, P.pos.z - to.z) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: true }, toward(to)); }
    return false;
  };
  const stand = (x, y, z) => { P.teleport(W(x, y + 0.05, z), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0); for (let i = 0; i < 20; i++) frame(); };
  // (where the gulf's ledges are: their marks, 3 m into the near lip and 6 m into the higher ledge)
  const markZ = (room) => rt.kit.local(rt.marks.find((m) => m.room === room).pos.clone()).z;
  const G0 = markZ('gulf') - 3, FZ = markZ('gulfFar') - 6, WB = GULF.way, xm = (WB.x[0] + WB.x[1]) / 2;
  const zN = G0 + WB.near, zF = FZ + WB.far;
  // over there, the great lock shut
  stand(4, GULF.farY, zF);
  assert.ok(P.onGround && Math.abs(local().y - GULF.farY) < 0.3, `on the higher ledge (${where()})`);
  assert.equal(walk(W(GULF.half + 2.4, GULF.farY, zF)), true, `through the east doorway onto the sill (${where()})`);
  assert.equal(walk(W(xm + 1, WB.y, zF), { dy: 0.8 }), true, `down off the sill into the passage (${where()})`);
  for (let i = 0; i < 90 && !P.onGround; i++) frame();
  assert.ok(P.onGround && Math.abs(local().y - WB.y) < 0.3, `on its floor (${where()})`);
  assert.equal(walk(W(xm, WB.y, zN + 2.2 + WB.stairs + 1.5), { max: 40 }), true, `back along it (${where()})`);
  assert.equal(walk(W(xm, 32, zN), { dy: 0.5 }), true, `up its stairs to the landing (${where()})`);
  assert.equal(walk(W(6, 32, zN), { dy: 0.5 }), true, `through the doorway onto the near lip (${where()})`);
  assert.ok(P.onGround && Math.abs(local().y - 32) < 0.3 && local().x < 10, `back on the near side (${where()})`);
  // the other way: down into the passage and along it to the drop, and every jump at the sill falls short
  assert.equal(walk(W(xm, 32, zN)) && walk(W(xm, WB.y, zN + 2.2 + WB.stairs + 1.5), { dy: 0.5 }) && walk(W(xm + 1, WB.y, zF - 0.5), { max: 40, dy: 0.5 }), true, `down and along the passage (${where()})`);
  let best = -Infinity, high = -Infinity;
  for (let k = 0; k < 6; k++) {
    stand(xm + 1.2 - k * 0.15, WB.y, zF - 1 + (k % 3));
    const to = W(WB.x[0] + 0.6, GULF.farY, zF);
    for (let i = 0; i < 3 / DT; i++) {
      const input = { KeyW: true, Space: i === 2 || (i > 20 && i < 24) };
      frame(input, toward(to));
      if (P.onGround) best = Math.max(best, local().y); else high = Math.max(high, local().y);
    }
  }
  assert.ok(high > WB.y + 3, `the jumps went up (${(high - WB.y).toFixed(1)} m)`);
  assert.ok(best < GULF.farY - 1, `no jump makes the sill: stood ${(best - WB.y).toFixed(1)} m up at most, jumped ${(high - WB.y).toFixed(1)} m (${where()})`);
});
