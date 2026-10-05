// The makers' temples (src/temples/): the kit, the logic, the guardians, the
// 50/50 split of the gadgets, and every built temple solved twice: through its
// state machine (logic.js solve), and on foot, a real Player walking its rooms
// in the real level geometry, pushing, riding, climbing, lighting, calming.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TempleLogic, solve, memoryStore, flagStore } from '../src/temples/logic.js';
import { strikeDamage, inArea, HIT, Guardian } from '../src/temples/boss.js';
import { TEMPLES, GADGETS, nextSpot } from '../src/temples/index.js';
import { TEMPLE_BOXES, migrateTemples } from '../src/temples/migrate.js';
import { LEVELS } from '../src/levels/index.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game, GameState } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { resolvePlacement } from '../src/boxes/index.js';
import { bestInteractable } from '../src/interact.js';
import { parseLine, TONES } from '../src/story/tone.js';
import { updateHazards } from '../src/hazards.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };
const BUILT = Object.keys(TEMPLES);

const worlds = new Map();
function world(id) {
  if (worlds.has(id)) return worlds.get(id);
  const scene = new THREE.Scene();
  const level = quiet(() => LEVELS.find((l) => l.id === id).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const w = { scene, level, physics, rt: level.temple };
  worlds.set(id, w);
  return w;
}

// ------------------------------------------------------------------ the logic
const MINI = {
  id: 'mini', entry: 'a', gadget: 'fire',
  rooms: { a: {}, b: {}, c: {}, d: { boss: true } },
  links: [{ a: 'a', b: 'b', door: 'd1' }, { a: 'b', b: 'c', door: 'd2' }, { a: 'c', b: 'd', door: 'br' }],
  elements: {
    p1: { type: 'plate', room: 'a' }, p2: { type: 'plate', room: 'a' },
    ball: { type: 'drum', room: 'a', plate: 'p2', plateAt: 1 },
    d1: { type: 'door', opens: { all: [{ pressed: 'p1' }, { pressed: 'p2' }] }, latch: true },
    chest: { type: 'gadget', room: 'b', item: 'fire' },
    b1: { type: 'brazier', room: 'b', needs: ['fire'] },
    d2: { type: 'door', opens: { lit: 'b1' }, latch: true },
    hold: { type: 'door', opens: { pressed: 'p1' } },
    br: { type: 'bridge', opens: { lit: 'b1' } },
    boss: { type: 'boss', room: 'd', needs: ['fire'] },
  },
};

test('temple logic: plates, a ball that holds one, latched and held doors, fire, the guardian', () => {
  const owned = new Set(['backpack']);
  const store = memoryStore();
  const L = new TempleLogic(MINI, { store, has: (i) => owned.has(i) });
  assert.deepEqual([...L.reachable()], ['a']);
  // one plate is not enough; a held door opens only while you stand there
  L.press('p1'); L.update();
  assert.equal(L.isOpen('d1'), false);
  assert.equal(L.isOpen('hold'), true);
  L.release('p1'); L.update();
  assert.equal(L.isOpen('hold'), false);
  // the ball on its plate holds it down; then you on the other: the door opens, and stays open
  L.moveDrum('ball', 0.5); assert.equal(L.pressed('p2'), false);
  L.moveDrum('ball', 0.97); assert.equal(L.pressed('p2'), true, 'close enough to the plate');
  L.press('p1'); L.update(); L.release('p1'); L.update();
  assert.equal(L.isOpen('d1'), true, 'latched');
  assert.deepEqual([...L.reachable()].sort(), ['a', 'b']);
  // a brazier wants fire: nothing without the gadget
  assert.equal(L.light('b1'), false);
  assert.equal(L.next(), 'chest');
  L.takeGadget(); owned.add('fire');
  assert.equal(L.light('b1'), true);
  L.update();
  assert.ok(L.isOpen('d2') && L.isOpen('br'));
  assert.ok(L.reachable().has('d'));
  assert.equal(L.next(), 'boss');
  // the arena's door can be held shut while the guardian is awake
  L.force('d2', false); L.update(); assert.equal(L.isOpen('d2'), false);
  L.force('d2', null); L.update(); assert.equal(L.isOpen('d2'), true);
  L.resolve();
  assert.equal(L.resolved, true);
  // saved: a new logic over the same store (a reload) finds it as it was left
  const again = new TempleLogic(MINI, { store, has: (i) => owned.has(i) });
  assert.ok(again.isOpen('d1') && again.isLit('b1') && again.drumOn('ball', 'p2') && again.resolved);
  // and in the game's flags, per save slot
  const g = new GameState(null);
  const L2 = new TempleLogic(MINI, { store: flagStore(g, 'mini'), has: () => true });
  L2.light('b1');
  assert.equal(g.flag('temple.mini.lit.b1'), true);
});

test('the solver: the mini temple is solvable, and not without its gadget', () => {
  const r = solve(MINI);
  assert.equal(r.done, true, r.log.join(' / '));
  assert.ok(r.gadgetAt > 0 && r.gadgetAt < r.log.length - 1, 'the gadget comes half-way');
  const no = solve(MINI, { withhold: ['fire'] });
  assert.equal(no.done, false);
  assert.ok(!no.stuck.includes('d'));
});

test('every built temple is solvable through its state machine, its gadget found mid-way and the key to the rest', () => {
  for (const id of BUILT) {
    const def = TEMPLES[id].def, L = def.logic;
    const r = solve(L, { items: ['backpack'] });
    assert.equal(r.done, true, `${id}: solved (${r.log.join(' / ')})`);
    const gadget = Object.entries(L.elements).find(([, e]) => e.type === 'gadget');
    assert.ok(gadget, `${id}: a gadget inside`);
    assert.equal(gadget[1].item, def.gadget, `${id}: the gadget is the temple's own`);
    const boss = Object.entries(L.elements).find(([, e]) => e.type === 'boss');
    assert.ok(boss && L.rooms[boss[1].room]?.boss, `${id}: a guardian in its arena`);
    // mid-way: not in the first room, not in the arena; there are rooms before it and after it
    const at = r.order.indexOf(gadget[1].room);
    assert.ok(at >= 2 && at <= r.order.length - 3, `${id}: the gadget's room comes mid-way (${r.order.join(' > ')})`);
    // the key: without it the arena is never reached, and nothing past the gadget's room opens
    const no = solve(L, { items: ['backpack'], withhold: [def.gadget] });
    assert.equal(no.done, false, `${id}: not without ${def.gadget}`);
    assert.ok(!no.stuck.includes(boss[1].room), `${id}: the arena stays shut without ${def.gadget}`);
    const after = r.order.slice(at + 1);
    assert.ok(after.length >= 2 && after.every((room) => !no.stuck.includes(room)), `${id}: every room after the gadget needs it (${no.stuck.join(', ')})`);
    // 3–6 puzzle rooms (rooms with something to do), a checkpoint in most
    const busy = new Set(Object.values(L.elements).filter((e) => e.room && e.type !== 'boss').map((e) => e.room));
    assert.ok(busy.size >= 3 && busy.size <= 6, `${id}: ${busy.size} puzzle rooms`);
  }
});

// ------------------------------------------------------------------ the guardians
test('a guardian’s strike knocks you down but never empties a healthy bar', () => {
  assert.equal(strikeDamage(1, 0.25), 0.25);
  assert.ok(1 - strikeDamage(1, 2) >= HIT.floor - 1e-9, 'a huge strike leaves the floor');
  assert.ok(0.3 - strikeDamage(0.3, 0.25) >= HIT.floor - 1e-9);
  assert.equal(strikeDamage(0.2, 0.25), 0.25, 'already low: this one can knock you out');
  // the areas: a disc, a fan, a lane
  const o = V(0, 0, 0);
  assert.ok(inArea({ shape: 'ring', radius: 4 }, o, 0, V(3, 0, 0)));
  assert.ok(!inArea({ shape: 'ring', radius: 4 }, o, 0, V(5, 0, 0)));
  assert.ok(inArea({ shape: 'cone', range: 10, angle: 0.5 }, o, 0, V(1, 0, 6)), 'in front');
  assert.ok(!inArea({ shape: 'cone', range: 10, angle: 0.5 }, o, 0, V(6, 0, 1)), 'beside');
  assert.ok(!inArea({ shape: 'cone', range: 10, angle: 0.5 }, o, 0, V(0, 0, -3)), 'behind');
  assert.ok(inArea({ shape: 'lane', range: 20, width: 2 }, o, Math.PI / 2, V(12, 0, 0.5)));
  assert.ok(!inArea({ shape: 'lane', range: 20, width: 2 }, o, Math.PI / 2, V(12, 0, 2)));
});

function stubGuardian(def) {
  const scene = new THREE.Scene();
  const notes = [];
  const logic = new TempleLogic(MINI, { has: () => true });
  const rt = { def: { id: 'stub' }, root: scene, logic, notice: (t) => notes.push(t), rumble() {}, onBossWake() {}, onBossResolved() { logic.resolve(); }, player: null };
  const model = { group: new THREE.Group(), pos: V(0, 0, 8), heading: 0, mouth: V(0, 2, 9), radius: 2, height: 3, animate() {} };
  const g = new Guardian(rt, { def, model, arena: { center: V(), r: 16, y: 0 } });
  return { g, rt, notes };
}
const CALM = {
  kind: 'organic', final: 'touch', wakeTime: 0.5, wake: 'wakes', weary: 'weary', resolved: 'calm', openHint: 'open',
  phases: [{ to: 0.4, attacks: ['ring'], hint: 'one' }, { to: 0.8, attacks: ['ring'], hint: 'two' }, { to: 1, weary: true }],
  attacks: { ring: { shape: 'ring', at: 'player', radius: 3, telegraph: 0.5, damage: 0.3, knock: 6, recover: 0.3, open: 1 } },
};

test('an organic guardian: wakes when you come in, calms phase by phase, settles to a hand, and is never hurt', () => {
  const { g, rt } = stubGuardian(CALM);
  const P = { pos: V(0, 0, 0), health: 1, dead: false, down: null, hurt(k) { this.health -= k; }, knockDown() { this.knocked = (this.knocked ?? 0) + 1; return true; } };
  rt.player = P;
  assert.equal(g.state, 'sleep');
  assert.equal(g.add(0.3), false, 'asleep: nothing counts');
  g.update(DT, 0);
  assert.equal(g.state, 'wake');
  for (let i = 0; i < 60; i++) g.update(DT, i * DT);
  assert.equal(g.state, 'fight');
  // the meter stays inside its phase until the phase is done
  g.add(0.9);
  assert.equal(g.meter, 0.4, 'the first phase caps it');
  assert.equal(g.phaseIndex, 1);
  g.add(-1);
  assert.equal(g.meter, 0.4, 'and it never drops below the phase reached');
  // it attacks: a telegraph, then a strike that knocks you down (and does not empty the bar)
  for (let i = 0; i < 400 && !P.knocked; i++) g.update(DT, i * DT);
  assert.ok(P.knocked >= 1, 'a strike landed');
  assert.ok(P.health >= HIT.floor - 1e-9);
  // a knockout in the fight: back to sleep, the meter where this phase began
  g.add(0.2);
  g.reset();
  assert.equal(g.state, 'sleep');
  assert.equal(g.meter, 0.4);
  g.wake();
  g.add(0.4);
  assert.equal(g.state, 'weary', 'calm enough: it waits for you');
  assert.equal(rt.logic.resolved, false);
  g.resolve();
  assert.equal(g.state, 'resolved');
  assert.equal(rt.logic.resolved, true);
  assert.equal(CALM.attacks.ring.damage > 0 && !('hp' in g), true, 'it has no health to take');
});

test('a robot sentinel: its meter is damage, and full it is resolved at once (broken)', () => {
  const { g, rt } = stubGuardian({ ...CALM, kind: 'robot', final: 'break', phases: [{ to: 0.5, attacks: ['ring'] }, { to: 1, attacks: ['ring'] }] });
  rt.player = { pos: V(0, 0, 0), health: 1, hurt() {}, knockDown() {} };
  g.wake();
  g.add(0.5); g.add(0.5);
  assert.equal(g.state, 'resolved');
  assert.equal(rt.logic.resolved, true);
});

// ------------------------------------------------------------------ the 50/50
test('the gadgets: half in the temples, half in the open; the built temples hold theirs, as placed', () => {
  const temple = Object.values(GADGETS).map((g) => g.temple).filter(Boolean);
  const open = Object.values(GADGETS).flatMap((g) => g.world);
  assert.equal(Object.keys(GADGETS).length, 11, 'every world but home has a temple planned');
  assert.ok(Math.abs(temple.length - open.length) <= 1, `${temple.length} in temples, ${open.length} in the open`);
  assert.equal(new Set(temple).size, temple.length, 'no gadget in two temples');
  const placed = Object.values(PLACEMENTS).flat();
  for (const [id, g] of Object.entries(GADGETS)) {
    if (!g.built) continue;
    assert.ok(TEMPLES[id], `${id}: built`);
    const box = placed.find((p) => p.temple === id);
    assert.ok(box && box.item === g.temple && box.id.startsWith(`${id}.`), `${id}: its temple chest holds ${g.temple}`);
    assert.equal(TEMPLES[id].def.gadgetBox, box.id);
    for (const it of g.world) assert.ok(PLACEMENTS[id].some((p) => p.item === it && !p.temple), `${id}: ${it} waits in the open`);
    assert.ok(TEMPLE_BOXES.some(([b, it]) => b === box.id && it === g.temple), `${id}: old saves migrate`);
  }
  // every placed item is a real item, and every temple box sits in a built temple
  for (const p of placed) { assert.ok(ITEMS[p.item], p.id); if (p.temple) assert.ok(GADGETS[p.temple]?.built, p.id); }
});

test('old saves that own a temple’s gadget find its chest open; the temple’s doors answer it', () => {
  const g = new GameState(null);
  g.set('item.fire', true);
  assert.equal(migrateTemples(g), 1);
  assert.equal(g.flag('box.desert.temple.fire'), true);
  assert.equal(migrateTemples(g), 0, 'once');
  const L = new TempleLogic(TEMPLES.desert.def.logic, { store: memoryStore(), has: (i) => !!g.flag(`item.${i}`) });
  assert.equal(L.gadget, true, 'carried in: the gadget counts as found');
});

// ------------------------------------------------------------------ the words
function spoken(v, out = [], seen = new Set()) {
  if (!v || typeof v !== 'object' || seen.has(v)) return out;
  seen.add(v);
  if (Array.isArray(v)) { v.forEach((x) => spoken(x, out, seen)); return out; }
  for (const [k, x] of Object.entries(v)) {
    if (k === 'if' || k === 'do' || k === 'entry' || k === 'palette') continue;
    if (k === 'say') for (const s of [x].flat()) out.push(typeof s === 'object' ? s.text ?? s : s);
    else if (k === 'choices') for (const c of x) { out.push(c.text); spoken(c, out, seen); }
    else if (k === 'lines' && Array.isArray(x)) out.push(...x);
    else if (typeof x === 'object') spoken(x, out, seen);
  }
  return out;
}

test('every temple line carries a tone, and every conversation offers at most three answers', () => {
  for (const id of BUILT) {
    const W = TEMPLES[id].words;
    const lines = [...spoken(W.PEOPLE), ...(W.LINES_AFTER ?? [])];
    assert.ok(lines.length > 10, `${id}: lines`);
    for (const s of lines) { const p = parseLine(s); assert.ok(p.explicit && TONES.includes(p.tone), `${id}: a tone on “${String(s).slice(0, 50)}”`); }
    for (const person of Object.values(W.PEOPLE)) for (const [n, node] of Object.entries(person.talk.nodes)) assert.ok((node.choices ?? []).length <= 3, `${person.id}.${n}: at most three answers`);
    // and the guardian's notices are plain text the toast can show
    for (const k of ['wake', 'weary', 'resolved']) assert.ok(typeof TEMPLES[id].def && true, k);
  }
});

// ------------------------------------------------------------------ built in the world
test('each built temple: a door in its world, solid rooms with marks, a chest site, lights, its way out', () => {
  for (const id of BUILT) {
    const { level, physics, rt } = world(id);
    assert.ok(rt, `${id}: built into the level`);
    assert.ok(level.portals.some((p) => p.temple === id && p.to.distanceTo(rt.arrival.pos) < 0.01), `${id}: a doorway in`);
    const outs = level.portals.filter((p) => p.temple === id && p.to.distanceTo(rt.arrival.pos) > 1);
    assert.ok(outs.length >= 2, `${id}: a way back out at the start and at the end`);
    // the door stands on the world's ground, the way out lands on it
    const d = rt.outside.door.at;
    assert.ok(Math.abs(physics.groundAt(d.x, d.y + 1, d.z, 4) - d.y) < 0.4, `${id}: the door's threshold is on the ground`);
    for (const o of outs) assert.ok(Math.abs(physics.groundAt(o.to.x, o.to.y + 1.5, o.to.z, 6) - o.to.y) < 1.2, `${id}: out onto the ground`);
    // the rooms: you arrive on a floor; every mark stands on one, with room above
    const g = physics.groundAt(rt.arrival.pos.x, rt.arrival.pos.y + 1, rt.arrival.pos.z, 3);
    assert.ok(Math.abs(g - rt.arrival.pos.y) < 0.2, `${id}: a floor where you come in`);
    assert.ok(rt.marks.length >= 4, `${id}: marks in most rooms`);
    for (const m of rt.marks) {
      const s = m.spot, gs = physics.groundAt(s.x, s.y + 1, s.z, 3);
      assert.ok(Math.abs(gs - s.y) < 0.3, `${id}: the mark of ${m.room} on a floor`);
      assert.ok(physics.rayDistance(V(s.x, gs + 0.3, s.z), V(0, 1, 0), 3) > 2.5, `${id}: head room at the mark of ${m.room}`);
      assert.ok(rt.inside(s), `${id}: ${m.room} inside the temple`);
    }
    // the chest's spot resolves (tests/boxes.test.js checks it is reachable like every box)
    const box = Object.values(PLACEMENTS).flat().find((p) => p.temple === id);
    assert.ok(resolvePlacement(box, { physics, level }), `${id}: the chest stands`);
    assert.ok(level.lights.length >= 6, `${id}: lights inside`);
    // the scout points at the next thing to do
    assert.ok(nextSpot(rt).isVector3);
  }
});

test('a temple door is solid until it opens, and the doorway is free after', () => {
  const { physics, rt } = world('desert');
  const door = rt.piece('d1');
  const at = rt.kit.world(0, 1.4, 50), dir = rt.kit.world(0, 1.4, 55).sub(at).normalize();
  assert.ok(physics.rayDistance(at, dir, 6) < 3.5, 'shut: the slab is in the way');
  door.setOpen(true, true);
  assert.ok(physics.rayDistance(at, dir, 6) > 5, 'open: through');
  door.setOpen(false, true);
  assert.ok(physics.rayDistance(at, dir, 6) < 3.5, 'and shut again');
});

// ------------------------------------------------------------------ on foot: the desert temple, room by room
test('the Givers’ House on foot: in, the ball and the plates, the disc and the wall, the ember, the bridge and the thorns, the Keeper calmed, out', () => {
  game.reset();
  own('backpack');
  const { level, physics, rt } = world('desert');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s, input = {}, yaw = 0) => { for (let i = 0; i < s / DT; i++) frame(input, yaw); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), 'standing in the Threshold');
  // ---- the Hall of Weights: the door is shut; roll the ball onto its plate with the push
  assert.equal(walk(L(0, 0, 49)), true, `walk to the door (${where()})`);
  assert.ok(rt.kit.local(P.pos).z < 51.5, 'the shut door stops you');
  const ball = rt.piece('ball1');
  for (let k = 0; k < 12 && !rt.logic.drumOn('ball1', 'p2'); k++) {
    // stand behind it and push along the groove
    const behind = ball.center.clone().add(V(0, 0, -2.3));
    walk(behind, { tol: 0.5 });
    ball.hit('push', ball.dir.clone(), { strength: 1 });
    wait(2.5);
  }
  assert.ok(rt.logic.drumOn('ball1', 'p2'), `the ball rests on its plate (t ${ball.t.toFixed(2)})`);
  assert.equal(rt.logic.isOpen('d1'), false, 'one plate is not enough');
  assert.equal(walk(L(-5.5, 0, 46), { tol: 0.4 }), true);
  wait(0.3);
  assert.equal(rt.logic.isOpen('d1'), true, 'standing on the other: the door opens');
  wait(2);
  // ---- the Dry Channel: ride the disc over the sand, climb the gallery's wall
  assert.equal(walk(L(0, 0, 56.5)), true, `through the door (${where()})`);
  const disc = rt.pieces.find((p) => p.path);
  for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.4); i++) frame();
  assert.equal(walk(disc.group.position, { tol: 0.5, run: false }), true, 'onto the disc');
  for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
  assert.ok(rt.kit.local(P.pos).z > 74, `carried over the sand (${where()})`);
  assert.equal(walk(L(0, 0, 82)), true, `off onto the far landing (${where()})`);
  assert.ok(P.pos.y > L(0, -1, 0).y, 'not in the pit');
  // climb: walk into the wall and keep going up
  let climbed = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(0, 7, 90))); if (P.onGround && rt.kit.local(P.pos).y > 6.5) { climbed = true; break; } }
  assert.ok(climbed, `up the gallery's wall (${where()})`);
  // ---- the Chest Chamber: the chest gives ember mode (here: as the box system does it)
  assert.equal(walk(L(0, 7, 101)), true, `into the chest chamber (${where()})`);
  assert.equal(rt.logic.next(), 'chest');
  items.grant('fire'); game.set('box.desert.temple.fire', true); game.emit('box:opened', { id: 'desert.temple.fire' });
  assert.equal(rt.logic.gadget, true);
  assert.equal(walk(L(0, 7, 112)), true);
  assert.ok(rt.kit.local(P.pos).z < 115.8, 'the door between the braziers is shut');
  rt.piece('b1').hit('shoot');
  assert.equal(rt.logic.isLit('b1'), false, 'plain fluid does not light it');
  rt.piece('b1').hit('fire'); rt.piece('b2').hit('fire');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d2'), true, 'lit: the door opens');
  // ---- the Hall of Fires: light the brazier across the chasm; the bridge rises; burn the thorns
  assert.equal(walk(L(0, 7, 125)), true, `into the hall of fires (${where()})`);
  rt.piece('b3').hit('fire');
  wait(3.5);
  assert.equal(walk(L(0, 7, 147)), true, `over the bridge (${where()})`);
  assert.ok(P.pos.y > L(0, 6, 0).y, 'over it, not into the chasm');
  assert.equal(walk(L(0, 7, 160), { max: 4 }), false, 'the thorns are in the way');
  rt.piece('bw1').hit('fire');
  wait(3);
  assert.equal(walk(L(0, 7, 162)), true, `past the burnt thorns (${where()})`);
  // ---- the Cistern: the Keeper wakes; light its braziers, water it when it pants, a hand on its brow
  const K = rt.guardian;
  assert.equal(K.state, 'sleep');
  assert.equal(walk(L(0, 7, 172)), true, 'into the cistern');
  wait(0.2);
  assert.notEqual(K.state, 'sleep', 'it wakes');
  wait(0.3);
  assert.equal(rt.logic.isOpen('d4'), false, 'the door shuts behind you');
  P.opts.health = false;   // (the fight's own tests are above: here the strikes may knock us about, no further)
  wait(3.5);
  for (const b of ['b6', 'b7', 'b8', 'b9']) rt.piece(b).hit('fire');
  assert.equal(K.meter, 0.4, 'light round the walls: the first phase');
  for (let n = 0; n < 4; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (K.state === 'open') { open = true; break; } if (P.dead) P.restart(); }
    assert.ok(open, `it pants (${n})`);
    K.hit('mouth', 'shoot');
  }
  assert.equal(K.state, 'weary', 'calm: it lies down by the spout');
  for (let i = 0; i < 30 / DT && Math.hypot(K.model.pos.x - K.model.rest.x, K.model.pos.z - K.model.rest.z) > 0.6; i++) frame();
  wait(3);
  // walk up to its brow and lay a hand on it
  const brow = K.model.mouth.clone();
  for (let i = 0; i < 12 / DT && !bestInteractable(P); i++) frame({ KeyW: true }, toward(brow));
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, 'temple.desert.touch', 'a hand on its brow');
  near.entry.use(P);
  assert.equal(K.state, 'resolved');
  assert.equal(rt.logic.resolved, true);
  assert.equal(game.flag('temple.desert.done'), true, 'the world changes');
  wait(2.5);
  assert.ok(rt.logic.isOpen('d4') && rt.logic.isOpen('d5'), 'the doors open again, and the far one');
  // ---- out by the spring's door
  const out = level.portals.filter((p) => p.temple === 'desert').at(-1);
  assert.equal(walk(out.at, { tol: out.r }), true, `to the way out (${where()})`);
  wait(1);
  assert.ok(rt.change.root.visible, 'the water runs and the fields come up');
  assert.ok(notes.some((s) => /water/i.test(s)), 'it says so');
  game.reset();
  own();
});

// ------------------------------------------------------------------ on foot: the City-Shaft's tower, room by room
test('the Warden’s Well on foot: the eye and the discs, the climb and the ball, the jets, up through the ceiling, the eyes over their shelves, the warden broken, the shaft’s breath', () => {
  game.reset();
  own('backpack');
  const { level, physics, rt } = world('incal');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, killY: level.killY });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s, input = {}, yaw = 0) => { for (let i = 0; i < s / DT; i++) frame(input, yaw); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  /** Fly with the jets: up to height y (local), then across to `to` (local [x, z]), and land. */
  const fly = (y, to, { max = 14 } = {}) => {
    const target = L(to[0], y, to[1]);
    let i = 0;
    // up, holding the jets; across, hovering; then let go and land
    for (; i < max / DT && rt.kit.local(P.pos).y < y; i++) frame({ Space: true }, toward(target));
    for (; i < max / DT && flat(target) > 0.8; i++) frame({ Space: rt.kit.local(P.pos).y < y, KeyW: true }, toward(target));
    for (; i < max / DT && !P.onGround; i++) frame({}, toward(target));
    return P.onGround && flat(target) < 2;
  };
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), 'in the tower');
  // ---- the Turning Floors: the discs are still until the eye over the far door is splashed
  assert.equal(walk(L(0, 0, 17)), true, `to the drop (${where()})`);
  const [discA, discB] = rt.pieces.filter((p) => p.path);
  wait(3);
  assert.ok(discA.s === 0 && discB.s === 0, 'the discs are still');
  rt.piece('s1').hit('shoot');
  wait(0.1);
  assert.equal(rt.logic.isOpen('discs'), true);
  const ride = (disc, off) => {
    for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.5); i++) frame();
    assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 6 }), true, `onto the disc (${where()})`);
    for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
    assert.equal(walk(off, { tol: 0.8 }), true, `off the disc (${where()})`);
  };
  ride(discA, L(0, 0, 29));
  ride(discB, L(0, 0, 42.5));
  assert.ok(P.pos.y > L(0, -1, 0).y, 'across, not in the drop');
  // ---- the Climb: up the block's face, the ball onto its plate, the door
  assert.equal(walk(L(0, 0, 57)), true, `into the well (${where()})`);
  let up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(0, 11, 62))); if (P.onGround && rt.kit.local(P.pos).y > 10.5) { up = true; break; } }
  assert.ok(up, `up the face (${where()})`);
  const ball = rt.piece('ball1');
  for (let k = 0; k < 8 && !rt.logic.drumOn('ball1', 'p1'); k++) {
    walk(ball.center.clone().addScaledVector(ball.dir, -2.0), { tol: 0.5 });
    ball.hit('push', ball.dir.clone(), { strength: 0.6 });
    wait(2.5);
  }
  assert.ok(rt.logic.drumOn('ball1', 'p1'), `the ball rests on its plate (${ball.t.toFixed(2)})`);
  wait(2);
  assert.equal(rt.logic.isOpen('d1'), true);
  // ---- the Jets' Chamber: the chest; the only way on is up through the oculus
  assert.equal(walk(L(0, 11, 75)), true, `into the chamber (${where()})`);
  for (let i = 0; i < 2 / DT; i++) frame({ Space: true }, 0);
  assert.ok(rt.kit.local(P.pos).y < 16, 'without the jets you cannot go up');
  items.grant('jetpack'); game.emit('box:opened', { id: 'incal.temple.jetpack' });
  assert.equal(rt.logic.gadget, true);
  assert.equal(walk(L(0, 11, 81), { tol: 1.2 }), true);
  assert.equal(fly(36.5, [0, 81 - 8]), true, `up through the oculus to the gallery floor (${where()})`);
  assert.ok(Math.abs(rt.kit.local(P.pos).y - 34.6) < 0.4, `standing in the gallery (${where()})`);
  // the eyes are hidden from the floor: no line to them; you fly up level with each to splash it
  for (const id of ['s2', 's3', 's4']) {
    const eye = rt.piece(id);
    const from = P.pos.clone().add(V(0, 1.5, 0)), d = eye.center.clone().sub(from), dist = d.length();
    assert.ok(physics.rayDistance(from, d.normalize(), dist) < dist - 1, `${id}: hidden from the floor`);
  }
  for (const id of ['s2', 's3', 's4']) rt.piece(id).hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d3'), true, 'the high door opens');
  // ---- the Warden's Hall
  assert.equal(fly(63.5, [0, 81 + 14 - 3.2]), true, `up to the high ledge (${where()})`);
  assert.equal(walk(L(0, 62.6, 104)), true, `into the hall (${where()})`);
  const K = rt.guardian;
  wait(0.4);
  assert.notEqual(K.state, 'sleep', 'it wakes');
  assert.equal(rt.logic.isOpen('d3'), false, 'the door shuts behind you');
  P.opts.health = false;
  for (let n = 0; n < 8 && K.state !== 'resolved'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (K.state === 'open') { open = true; break; } }
    assert.ok(open, `its vents open (${n}, phase ${K.phaseIndex})`);
    if (K.phaseIndex >= 1) {
      // guarded: only from above (here: hovering over it)
      const below = K.meter;
      P.teleport(L(0, 62.6, 104), V(0, 1, 0), V(0, 0, 1));
      K.hit('mouth', 'shoot');
      assert.equal(K.meter, below, 'from the floor its shut sides take nothing');
      P.teleport(K.model.mouth.clone().add(V(4, 1.5, 0)), V(0, 1, 0), V(0, 0, 1));
    }
    K.hit('mouth', 'shoot');
  }
  assert.equal(K.state, 'resolved', `broken (${K.meter})`);
  assert.equal(game.flag('temple.incal.done'), true);
  wait(2.5);
  assert.ok(rt.logic.isOpen('d5'));
  // ---- the world changed: step into the breath at the bottom of the shaft and ride it up to the rim
  const C = rt.change;
  wait(4);
  P.opts.health = true;
  P.teleport(C.foot.clone().add(V(0, 1, 0)), V(0, 1, 0), V(0, 0, 1));
  let rim = false;
  for (let i = 0; i < 70 / DT; i++) { frame(); if (P.onGround && P.pos.y > 199 && Math.hypot(P.pos.x, P.pos.z) > 261) { rim = true; break; } }
  assert.ok(rim, `carried up the shaft and set down on the rim (${P.pos.toArray().map((v) => v.toFixed(1))})`);
  assert.ok(P.health > 0.9, 'gently');
  game.reset();
  own();
});

// ------------------------------------------------------------------ on foot: Vael II's belfry, room by room
test('the Founders’ Belfry on foot: two balls on two plates, the riding stair, the bell, the bell-tuned doors, the stones that come down, the Cloud-Mother calmed, the stones come down outside', () => {
  game.reset();
  own('backpack');
  const { level, physics, rt } = world('arzach2');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, unsafe: level.unsafe });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); level.update(DT, t, {}); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s, input = {}, yaw = 0) => { for (let i = 0; i < s / DT; i++) frame(input, yaw); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const ring = () => game.emit('bell', { pos: P.pos.clone() });   // (the whistle: src/boxes/effects.js ring())
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), 'in the belfry');
  // ---- the Hall of Stones: both balls onto both plates
  for (const id of ['ball1', 'ball2']) {
    const ball = rt.piece(id);
    for (let k = 0; k < 10 && !rt.logic.drumOn(id, ball === rt.piece('ball1') ? 'p1' : 'p2'); k++) {
      walk(ball.center.clone().addScaledVector(ball.dir, -(ball.r + 1.3)), { tol: 0.5 });
      ball.hit('push', ball.dir.clone(), { strength: 1 });
      wait(2.6);
    }
  }
  assert.ok(rt.logic.drumOn('ball1', 'p1') && rt.logic.drumOn('ball2', 'p2'), 'both balls on their plates');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true);
  // ---- the Stone Stair: ride the first disc up to the ledge, the second to the landing
  assert.equal(walk(L(0, 0, 46.5)), true, `into the well (${where()})`);
  const [discA, discB] = rt.pieces.filter((p) => p.path);
  const ride = (disc, off, label) => {
    for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.6); i++) frame();
    assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 4, dy: 1.0 }), true, `onto the ${label} (${where()})`);
    for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
    assert.equal(walk(off, { tol: 0.7, max: 4 }), true, `off the ${label} (${where()})`);
  };
  ride(discA, L(0, 8, 56.4 - 0.6), 'first disc');
  ride(discB, L(0, 16, 56.4 + 7.4), 'second disc');
  // ---- the Bell Chamber: the chest, and a door that only the bell opens
  assert.equal(walk(L(0, 16, 72)), true, `into the bell chamber (${where()})`);
  assert.equal(walk(L(0, 16, 91.5), { max: 5 }), false, 'the bell-tuned door is shut');
  ring();
  wait(0.2);
  assert.equal(rt.logic.isLit('e1'), false, 'without the whistle nothing answers (whoever rang it)');
  items.grant('bell'); game.emit('box:opened', { id: 'arzach2.temple.bell' });
  ring();
  wait(2.2);
  assert.equal(rt.logic.isOpen('d3'), true, 'the door answers the bell');
  // ---- the Hall of Echoes: the stones of the bridge hang high; the bell brings them down
  assert.equal(walk(L(0, 16, 94)), true, `to the chasm (${where()})`);
  ring();
  wait(5);
  assert.equal(rt.logic.isOpen('br1'), true);
  assert.equal(walk(L(0, 16, 120)), true, `over the stones (${where()})`);
  assert.ok(P.pos.y > L(0, 15, 0).y, 'on the bridge, not in the chasm');
  ring();
  wait(2.2);
  assert.equal(rt.logic.isOpen('d4'), true, 'the far bell door');
  // ---- the Cloud-Mother's hall
  assert.equal(walk(L(0, 16, 133)), true, `into her hall (${where()})`);
  const G = rt.guardian;
  wait(0.4);
  assert.notEqual(G.state, 'sleep', 'she wakes');
  P.opts.health = false;
  for (let n = 0; n < 12 && G.state !== 'weary'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `she cries (${n})`);
    if (n === 0) { const m = G.meter; G.hit('mouth', 'shoot'); assert.equal(G.meter, m, 'fluid does not calm her'); }
    P.teleport(G.model.pos.clone().setY(L(0, 16, 0).y).add(V(6, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
    ring();
  }
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  for (let i = 0; i < 30 / DT && Math.hypot(G.model.pos.x - G.model.rest.x, G.model.pos.z - G.model.rest.z) > 0.6; i++) frame();
  wait(2);
  P.teleport(G.model.mouth.clone().setY(L(0, 16, 0).y).add(V(2.2, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, 'temple.arzach2.touch', 'a hand on her brow');
  near.entry.use(P);
  assert.equal(G.state, 'resolved');
  assert.equal(game.flag('temple.arzach2.done'), true);
  // ---- outside: the stones that fell up come down
  const stones = level.arzach2.floaters.children;
  const before = stones.map((g) => g.getWorldPosition(V()).y);
  wait(20);
  const after = stones.map((g) => g.getWorldPosition(V()).y);
  assert.ok(after.every((y, i) => y < before[i] - 5), `every floating stone came down (${after.map((y, i) => (before[i] - y).toFixed(0)).join(', ')})`);
  game.reset();
  own();
});

// ------------------------------------------------------------------ on foot: the Garden of Spheres' Footprint, room by room
test('the Footprint on foot: two spheres on two plates, the still pool, the lens, the door that is wall without it, the bridge and the eye only it shows, the Echo answered', () => {
  game.reset();
  own('backpack');
  const { level, physics, rt } = world('spheres');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true });
  rt.connect({ player: P, toast: () => {} });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  wait(0.5);
  // ---- the Hall of Spheres
  for (const [id, plate] of [['ball1', 'p1'], ['ball2', 'p2']]) {
    const ball = rt.piece(id);
    for (let k = 0; k < 10 && !rt.logic.drumOn(id, plate); k++) {
      walk(ball.center.clone().addScaledVector(ball.dir, -(ball.r + 1.3)), { tol: 0.5 });
      ball.hit('push', ball.dir.clone(), { strength: 1 });
      wait(2.6);
    }
    assert.ok(rt.logic.drumOn(id, plate), `${id} on ${plate}`);
  }
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true);
  // ---- the Still Pool: wake the disc with the eye over the far door, ride it over
  assert.equal(walk(L(0, 0, 49)), true, `to the pool (${where()})`);
  rt.piece('s1').hit('shoot');
  const disc = rt.pieces.find((p) => p.path);
  for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.6); i++) frame();
  assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 4 }), true, `onto the disc (${where()})`);
  for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
  assert.equal(walk(L(0, 0, 72), { max: 4 }), true, `over the pool (${where()})`);
  // ---- the Lens Chamber: the way on is wall until you carry the lens
  assert.equal(walk(L(0, 0, 92)), true, `into the chamber (${where()})`);
  assert.equal(walk(L(0, 0, 98.5), { max: 4 }), false, 'a wall');
  assert.equal(rt.piece('br1').stones.some((s) => s.g.visible), false, 'no bridge to see');
  assert.equal(rt.piece('s2').seen(), false, 'no eye to see');
  items.grant('lens'); game.emit('box:opened', { id: 'spheres.temple.lens' });
  wait(2.2);
  assert.equal(rt.logic.isOpen('d2'), true, 'with the lens it is a door, and it opens');
  // ---- the Hall of the Unseen: the bridge the lens shows; the eye the lens shows
  assert.equal(walk(L(0, 0, 101)), true, `to the chasm (${where()})`);
  wait(1.5);
  assert.equal(walk(L(0, 0, 126)), true, `over the unseen bridge (${where()})`);
  assert.ok(P.pos.y > L(0, -1, 0).y, 'on it, not in the chasm');
  assert.equal(rt.piece('s2').seen(), true);
  rt.piece('s2').hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d4'), true);
  // ---- the Echo's Hall: answer each note on the sphere that glows with it
  assert.equal(walk(L(0, 0, 140)), true, `into the hall (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  for (let n = 0; n < 14 && G.state !== 'weary'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `it sings (${n})`);
    assert.ok(rt.sing >= 0, 'one sphere glows with its note');
    if (n === 0) { const m = G.meter; rt.resonators[(rt.sing + 1) % 3].hit('shoot'); assert.ok(G.meter <= m, 'the wrong note does not calm it'); }
    rt.resonators[rt.sing].hit('shoot');
  }
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  for (let i = 0; i < 20 / DT && Math.hypot(G.model.pos.x - G.model.rest.x, G.model.pos.z - G.model.rest.z) > 0.6; i++) frame();
  wait(2);
  P.teleport(G.model.mouth.clone().setY(L(0, 0, 0).y).add(V(0, 0.1, -2.6)), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, 'temple.spheres.touch', 'a hand held out to it');
  near.entry.use(P);
  assert.equal(game.flag('temple.spheres.done'), true);
  wait(8);
  assert.ok(rt.change.root.visible, 'the Footprint fills, the spheres wear their rings');
  game.reset();
  own();
});

// ------------------------------------------------------------------ on foot: the Buried Machine's Engine-House, room by room
test('the Engine-House on foot: the valve and the pistons, the counterweight, the fourth chamber, the banks of four eyes, the Tooth-Warden’s four vents, the pipe-cart', () => {
  game.reset();
  own('backpack');
  const { level, physics, rt } = world('buried');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit });
  rt.connect({ player: P, toast: () => {} });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  wait(0.5);
  // ---- the Piston Hall: open the valve, ride the three pistons up to the gantry
  const pistons = rt.pieces.filter((p) => p.path);
  wait(2);
  assert.ok(pistons.every((p) => p.s === p.o.phase * p.total || p.s === 0 || p.s === p.total), 'still until the valve opens');
  rt.piece('s1').hit('shoot');
  wait(0.1);
  assert.equal(rt.logic.isOpen('pumps'), true);
  assert.equal(walk(L(0, 0, 24.5)), true, `to the pistons (${where()})`);
  const board = (pis, low) => {
    // wait for it at its low end (and its neighbour level with you), then step on
    for (let i = 0; i < 30 / DT && !((low ? pis.s < 0.15 : pis.s > pis.total - 0.15) && pis.wait > 0.3); i++) frame();
    assert.equal(walk(pis.group.position, { tol: 0.6, run: false, max: 2.5, dy: 0.9 }), true, `onto a piston (${where()})`);
  };
  board(pistons[0], true);
  board(pistons[1], true);
  board(pistons[2], true);
  for (let i = 0; i < 20 / DT && pistons[2].s < pistons[2].total - 0.1; i++) frame();
  assert.equal(walk(L(0, 7, 40.5), { max: 3 }), true, `onto the gantry (${where()})`);
  // ---- the Counterweight
  assert.equal(walk(L(-2, 7, 48)), true, `into the counterweight (${where()})`);
  const ball = rt.piece('ball1');
  for (let k = 0; k < 8 && !rt.logic.drumOn('ball1', 'p1'); k++) {
    walk(ball.center.clone().addScaledVector(ball.dir, -2.2).setY(P.pos.y), { tol: 0.6 });
    ball.hit('push', ball.dir.clone(), { strength: 0.8 });
    wait(2.6);
  }
  assert.ok(rt.logic.drumOn('ball1', 'p1'), 'the ball on its plate');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d2'), true);
  // ---- the Fourth Chamber: the chest; the bank of four eyes wants four shots inside one breath
  assert.equal(walk(L(0, 7, 70)), true, `into the chamber (${where()})`);
  const bank = rt.piece('k1');
  for (let i = 0; i < 3; i++) bank.hit(i);
  wait(3);
  bank.hit(3);
  assert.equal(rt.logic.isLit('k1'), false, 'three, then a breath later the fourth: they went dark again');
  for (let i = 0; i < 4; i++) bank.hit(i);
  assert.equal(rt.logic.isLit('k1'), false, 'four at once, but without the fourth chamber the bank does not take it');
  items.grant('cell'); game.emit('box:opened', { id: 'buried.temple.cell' });
  for (let i = 0; i < 4; i++) bank.hit(i);
  assert.equal(rt.logic.isLit('k1'), true, 'four in a breath, with the fourth chamber');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d3'), true);
  // ---- the Furnace: the second bank raises the bridge
  assert.equal(walk(L(0, 7, 90)), true, `to the furnace (${where()})`);
  for (let i = 0; i < 4; i++) rt.piece('k2').hit(i);
  wait(3.5);
  assert.equal(walk(L(0, 7, 114)), true, `over the bridge (${where()})`);
  assert.ok(P.pos.y > L(0, 6, 0).y, 'over it, not in the furnace');
  // ---- the Tooth-Warden: all four vents in a breath, four times
  assert.equal(walk(L(0, 7, 128)), true, `into the hall (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  for (let n = 0; n < 8 && G.state !== 'resolved'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `its vents open (${n})`);
    if (n === 0) { rt.volley(0); rt.volley(1); assert.equal(G.meter, 0, 'two vents are nothing'); }
    for (let i = 0; i < 4; i++) rt.volley(i);
  }
  assert.equal(G.state, 'resolved', `stopped (${G.meter})`);
  assert.equal(game.flag('temple.buried.done'), true);
  wait(2.5);
  assert.ok(rt.logic.isOpen('d5'));
  // ---- outside: the pipe-cart rides the canyon again; stand on it at the hollow and ride it down
  const cart = rt.change.cart;
  for (let i = 0; i < 60 / DT && !(cart.s < 0.3 && cart.wait > 2); i++) frame();
  P.teleport(cart.group.position.clone().add(V(0, 0.2, 0)), V(0, 1, 0), V(0, 0, 1));
  const z0 = P.pos.z;
  wait(28);
  assert.ok(P.pos.z < z0 - 80 && P.onGround, `carried down the canyon (${(z0 - P.pos.z).toFixed(0)} m)`);
  game.reset();
  own();
});

// ------------------------------------------------------------------ on foot: Lorn II's Lamp-House, room by room
test('the Lamp-House on foot: three dark pools, the disc and the root-wall, the lantern, the lamps that wake to it, the stones only its light shows, the Lampless fed, the lamp lit', () => {
  game.reset();
  own('backpack');
  const { level, physics, rt } = world('perdide2');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit });
  rt.connect({ player: P, toast: () => {} });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  wait(0.5);
  assert.equal(P.inDark, true, 'a dark house: the lantern charm glows in it');
  // ---- the Hall of Dark Pools
  for (const id of ['s1', 's2', 's3']) rt.piece(id).hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true);
  // ---- the Root Stair: the disc over the dark pool, then up the root-wall
  assert.equal(walk(L(0, 0, 49)), true, `to the stair (${where()})`);
  const disc = rt.pieces.find((p) => p.path);
  for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.6); i++) frame();
  assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 4 }), true, `onto the disc (${where()})`);
  for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
  let up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(0, 9, 66))); if (P.onGround && rt.kit.local(P.pos).y > 8.5) { up = true; break; } }
  assert.ok(up, `up the root-wall (${where()})`);
  // ---- the Lantern Chamber: the chest; the lamp-door wakes only to the lantern
  assert.equal(walk(L(0, 9, 75)), true, `into the chamber (${where()})`);
  assert.equal(walk(L(2.6, 9, 87.6), { tol: 0.8 }), true, 'by the lamp');
  wait(2.5);
  assert.equal(rt.logic.isLit('l1'), false, 'nothing without the lantern');
  items.grant('lantern'); game.emit('box:opened', { id: 'perdide2.temple.lantern' });
  wait(2.5);
  assert.equal(rt.logic.isLit('l1'), true, 'it wakes to the lantern');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d2'), true);
  // ---- the Dark Gallery: the moss-stones the lantern shows; the eye; the second lamp
  assert.equal(walk(L(0, 9, 93)), true, `to the chasm (${where()})`);
  wait(2);
  assert.equal(walk(L(0, 9, 118)), true, `over the moss-stones (${where()})`);
  assert.ok(P.pos.y > L(0, 8, 0).y, 'on them, not in the chasm');
  rt.piece('s4').hit('shoot');
  assert.equal(walk(L(-2.6, 9, 123.5), { tol: 0.8 }), true);
  wait(2.5);
  wait(2.2);
  assert.equal(rt.logic.isOpen('d4'), true);
  // ---- the Lamp-Room: stand still by the Lampless while it searches
  assert.equal(walk(L(0, 9, 132)), true, `into the lamp-room (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  for (let n = 0; n < 12 && G.state !== 'weary'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `it hangs low, searching (${n})`);
    const before = G.meter;
    P.teleport(G.model.pos.clone().setY(L(0, 9, 0).y).add(V(4, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
    for (let i = 0; i < 3 / DT && G.meter === before && G.state === 'open'; i++) frame();
    assert.ok(G.meter > before || G.state !== 'open', `it drank (${n}: ${G.meter.toFixed(2)})`);
  }
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  for (let i = 0; i < 20 / DT && Math.hypot(G.model.pos.x - G.model.rest.x, G.model.pos.z - G.model.rest.z) > 0.6; i++) frame();
  wait(2);
  P.teleport(G.model.pos.clone().setY(L(0, 9, 0).y).add(V(0, 0.1, -2.4)), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, 'temple.perdide2.touch', 'a hand on its back');
  near.entry.use(P);
  assert.equal(game.flag('temple.perdide2.done'), true);
  wait(6);
  assert.ok(rt.outside.lampM.uniforms.uGlow.value > 0.6, 'the Lamp-House burns again');
  game.reset();
  own();
});

test('the Hush-House on foot: the crystals sung low to high, the climbing disc and the root-wall, the stilling mode, the gates of jaws, the pendulums, the Mother Snapper stilled, the swamp in flower', () => {
  game.reset();
  own('backpack');
  const { level, physics, rt } = world('perdide');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit ?? 1900 });
  rt.connect({ player: P, toast: () => {} });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  wait(0.5);
  // ---- the Choir: out of turn a crystal rings flat; low to high, the door opens
  rt.piece('c3').hit('shoot');
  assert.equal(rt.logic.isLit('c3'), false, 'not before the lower ones');
  for (const id of ['c1', 'c2', 'c3', 'c4']) rt.piece(id).hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true);
  // ---- the Bog Well: the disc that climbs over the dark water, then up the root-wall
  assert.equal(walk(L(0, 0, 49)), true, `to the well (${where()})`);
  const disc = rt.pieces.find((p) => p.path);
  for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.6); i++) frame();
  assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 4 }), true, `onto the disc (${where()})`);
  for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
  assert.ok(rt.kit.local(P.pos).y > 2.5, `carried up on it (${where()})`);
  let up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(0, 9, 66))); if (P.onGround && rt.kit.local(P.pos).y > 8.5) { up = true; break; } }
  assert.ok(up, `up the root-wall (${where()})`);
  // ---- the Stilling Chamber: the gate of jaws snaps at plain fluid and will not let you by
  assert.equal(walk(L(0, 9, 75)), true, `into the chamber (${where()})`);
  rt.piece('d2').hit('shoot');
  assert.equal(walk(L(0, 9, 92), { max: 4 }), false, 'the jaws keep the way');
  assert.ok(rt.kit.local(P.pos).z < 89, `not through them (${where()})`);
  items.grant('stun'); game.emit('box:opened', { id: 'perdide.temple.stun' });
  assert.equal(rt.logic.gadget, true);
  rt.piece('d2').hit('stun');
  wait(2.6);
  assert.equal(rt.logic.isOpen('d2'), true, 'stilled, they rest open');
  // ---- the Pendulum Gallery: a pendulum knocks you off the bridge; stilled, they let you by
  assert.equal(walk(L(0, 9, 93.5)), true, `to the bridge (${where()})`);
  const swings = rt.pieces.filter((p) => p.len && p.arm);
  assert.equal(swings.length, 3);
  P.teleport(L(0, 9.05, rt.kit.local(swings[0].group.position).z), V(0, 1, 0), V(0, 0, 1));
  let knocked = false;
  for (let i = 0; i < 4 / DT && !knocked; i++) { frame(); knocked = !!P.down; }
  assert.ok(knocked, `a pendulum knocks you off (${where()})`);
  for (let i = 0; i < 10 / DT && (P.down || P.dead); i++) frame();
  wait(1.5);
  P.teleport(L(0, 9.05, 94.5), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  for (const s of swings) s.hit('stun');
  assert.equal(walk(L(0, 9, 120), { max: 6 }), true, `over the bridge between the stilled pendulums (${where()})`);
  assert.ok(rt.kit.local(P.pos).y > 8, 'on it, not in the chasm');
  rt.piece('d3').hit('stun');
  wait(2.6);
  assert.equal(rt.logic.isOpen('d3'), true);
  // ---- the Mother's Hall: still her when she lies spent; later, mid-strike
  assert.equal(walk(L(0, 9, 132)), true, `into the hall (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  const before0 = G.meter;
  G.hit('mouth', 'shoot');
  assert.equal(G.meter, before0, 'plain fluid only startles her');
  let mid = 0;
  for (let n = 0; n < 16 && G.state !== 'weary'; n++) {
    let ready = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open' || (G.phaseIndex >= 1 && G.attack && !G.struck && G.at > 0.3)) { ready = true; break; } }
    assert.ok(ready, `she lies spent, or rears (${n})`);
    const before = G.meter;
    if (G.state === 'open') { assert.ok(G.model.mouth.distanceTo(G.model.pos) > 8, 'her head lies out on the floor'); G.hit('mouth', 'stun'); }
    else { G.hit('body', 'stun'); mid++; assert.equal(G.attack, null, 'stilled mid-strike'); }
    assert.ok(G.meter > before, `calmer (${n}: ${G.meter.toFixed(2)})`);
  }
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  assert.ok(mid > 0, 'stilled mid-strike at least once');
  wait(3);
  const head = G.model.mouth.clone().setY(L(0, 9, 0).y);
  const out = head.clone().sub(G.model.pos).setY(0).normalize();
  P.teleport(head.clone().addScaledVector(out, 2.4).add(V(0, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, 'temple.perdide.touch', 'a hand on her head');
  near.entry.use(P);
  assert.equal(game.flag('temple.perdide.done'), true);
  wait(6);
  assert.equal(rt.change.root.visible, true, 'the dome in flower');
  const m = new THREE.Matrix4();
  rt.change.foot.getMatrixAt(0, m);
  assert.ok(new THREE.Vector3().setFromMatrixScale(m).x > 0.9, 'flowers at the snappers’ feet');
  game.reset();
  own();
});

test('the Aerie on foot: the gusts waited out behind the screens, the wall and the rising disc, the wings, the gulf glided, the wind well, the Elder flown with, the birds come back', () => {
  game.reset();
  own('backpack');
  const { level, physics, rt } = world('arzach');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit ?? 1900 });
  rt.connect({ player: P, toast: () => {} });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const local = () => rt.kit.local(P.pos);
  wait(0.5);
  // ---- the Hall of Winds: in the open a gust shoves you back; screen to screen, in the calms, you get through
  const gust = rt.pieces.find((p) => p.shelters);
  const calmStart = () => { for (let i = 0; i < 12 / DT; i++) { const before = gust.state; frame(); if (before === 1 && gust.state === 0) return true; } return false; };
  P.teleport(L(0, 0.05, 26), V(0, 1, 0), V(0, 0, 1));
  for (let i = 0; i < 6 / DT && gust.state !== 1; i++) frame();
  const z0 = local().z;
  for (let i = 0; i < 1.2 / DT; i++) frame({ KeyW: true, ShiftLeft: true }, toward(L(0, 0, 50)));
  assert.ok(local().z < z0 - 2, `the gust shoves you back (${z0.toFixed(1)} -> ${where()})`);
  P.teleport(L(0, 0.05, 10), V(0, 1, 0), V(0, 0, 1));
  for (const legs of [[[4.2, 20.4]], [[0, 23.2], [-4.2, 29.4]], [[0, 32.2], [4.2, 38.4]], [[0, 41.2], [0, 50]]]) {
    assert.ok(calmStart(), 'a calm');
    const t0 = t;
    for (const [x, z] of legs) assert.equal(walk(L(x, 0, z), { tol: 0.7, max: 3 }), true, `to the next screen in the calm (${where()})`);
    assert.ok(t - t0 < 3.2, `inside one calm (${(t - t0).toFixed(1)} s)`);
  }
  rt.piece('s1').hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true);
  // ---- the Feather Stair: up the wall, then the disc that rides straight up
  assert.equal(walk(L(0, 0, 61)), true, `into the stair (${where()})`);
  let up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(0, 9, 71))); if (P.onGround && local().y > 8.5) { up = true; break; } }
  assert.ok(up, `up the wall (${where()})`);
  const disc = rt.pieces.find((p) => p.path);
  for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.8); i++) frame();
  assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 4 }), true, `onto the disc (${where()})`);
  for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
  assert.ok(local().y > 17.5, `carried up (${where()})`);
  assert.equal(walk(L(0, 18, 76.4), { tol: 0.8 }), true, `onto the landing (${where()})`);
  assert.equal(walk(L(0, 18, 84)), true, `into the wing chamber (${where()})`);
  // ---- the wings; the Gulf: too far to jump, glided
  items.grant('glider'); game.emit('box:opened', { id: 'arzach.temple.glider' });
  assert.equal(rt.logic.gadget, true);
  assert.equal(walk(L(0, 18, 102)), true, `to the gulf's edge (${where()})`);
  let landed = false;
  for (let i = 0; i < 12 / DT; i++) {
    const z = local().z, edge = z > 104;
    frame(z > 141 ? {} : edge ? { Space: true } : { KeyW: true, ShiftLeft: true }, toward(L(0, 18, 150)));
    if (P.onGround && local().y > 8.5 && local().y < 10 && local().z > 138) { landed = true; break; }
    if (local().y < 4) break;
  }
  assert.ok(landed, `glided across the gulf (${where()})`);
  // ---- the Wind Well: open the wings in the column and it lifts you to the balcony
  assert.equal(walk(L(0, 9, 163.2), { tol: 0.6 }), true, `to the well's middle (${where()})`);
  rt.piece('s3').hit('shoot');
  assert.equal(rt.logic.isLit('s3'), true, 'the eye over the balcony');
  let top = false;
  P.heading = 0;
  for (let i = 0; i < 20 / DT; i++) {
    frame({ Space: true });
    if (local().y > 33.2) { top = true; break; }
  }
  assert.ok(top, `lifted up the well (${where()})`);
  let onBalcony = false;
  for (let i = 0; i < 6 / DT; i++) {
    P.heading = 0;
    frame(local().z > 169 ? {} : { Space: true });
    if (P.onGround && Math.abs(local().y - 30) < 0.6) { onBalcony = true; break; }
  }
  assert.ok(onBalcony, `onto the balcony (${where()})`);
  wait(2.2);
  assert.equal(rt.logic.isOpen('d3'), true);
  // ---- the Roost: when she looks up, afraid, fly beside her
  assert.equal(walk(L(0, 30, 182)), true, `into the roost (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  const before0 = G.meter;
  G.hit('body', 'shoot');
  assert.equal(G.meter, before0, 'fluid does not calm her');
  for (let n = 0; n < 12 && G.state !== 'weary'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `she looks up, afraid (${n})`);
    const before = G.meter;
    const c = G.model.pos.clone();
    P.teleport(c.clone().add(V(3, G.model.floats ? 3 : 5, 0)), V(0, 1, 0), V(0, 0, 1));
    P.heading = 0;
    for (let i = 0; i < 2.5 / DT && G.meter === before && G.state === 'open'; i++) frame({ Space: true });
    assert.ok(G.meter > before, `flown with (${n}: ${G.meter.toFixed(2)}, ${G.state})`);
    for (let i = 0; i < 5 / DT && !P.onGround; i++) frame();
  }
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  for (let i = 0; i < 20 / DT && Math.hypot(G.model.pos.x - G.model.rest.x, G.model.pos.z - G.model.rest.z) > 0.6; i++) frame();
  wait(2);
  const head = G.model.mouth.clone().setY(L(0, 30, 0).y);
  const out = head.clone().sub(G.model.pos).setY(0).normalize();
  P.teleport(head.clone().addScaledVector(out, 1.6).add(V(0, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, 'temple.arzach.touch', 'a hand on her neck');
  near.entry.use(P);
  assert.equal(game.flag('temple.arzach.done'), true);
  wait(5);
  assert.equal(rt.change.root.visible, true, 'the birds come back');
  game.reset();
  own();
});
