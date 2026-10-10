// The makers' temples (src/temples/): the kit, the logic, the guardians, the
// 50/50 split of the gadgets, and every built temple solved twice: through its
// state machine (logic.js solve), and on foot, a real Player walking its rooms
// in the real level geometry, pushing, riding, climbing, lighting, calming.
import test from 'node:test';
import assert from 'node:assert/strict';
import { keyText } from '../src/prompt-keys.js';
import './register-gadgets.js';   // (the gadgets as items: the makers' courts' boxes hold them, src/finds/courts.js)
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
import { Reserve } from '../src/fluid-tool.js';
import { viaPortal } from '../src/scout.js';
import { VOLLEY, FROM_FOUR } from '../src/temples/garage.js';
import { resources } from '../src/resources.js';
import { SITE as SITE_EDENA, SUN } from '../src/temples/edena.js';
import { modeFor, allTargets, hitTarget } from '../src/targets.js';
import { JETS_NEXT, jetsUsed, VANES } from '../src/temples/incal.js';
import { createEchoShell } from '../src/echo-shell.js';
import { HOLD as BELFRY_HOLD, FallUpStone } from '../src/temples/arzach2.js';
const HOLD_DOOR = BELFRY_HOLD.door, HOLD_STONES = BELFRY_HOLD.stones, HOLD_STAIR = BELFRY_HOLD.stair, HOLD_CHAMBER = BELFRY_HOLD.chamber;
import { HOLD as UNDERTOWER_HOLD } from '../src/temples/bazaar.js';
const HOLD_HORN = UNDERTOWER_HOLD.horn;
import { TempleKit } from '../src/temples/kit.js';
import { GULF } from '../src/temples/arzach.js';
import { setHintLevel } from '../src/hint-level.js';

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
  const owned = new Set(['backpack', 'gun']);
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
    const r = solve(L, { items: ['backpack', 'gun'] });
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
    const no = solve(L, { items: ['backpack', 'gun'], withhold: [def.gadget] });
    assert.equal(no.done, false, `${id}: not without ${def.gadget}`);
    assert.ok(!no.stuck.includes(boss[1].room), `${id}: the arena stays shut without ${def.gadget}`);
    const after = r.order.slice(at + 1);
    assert.ok(after.length >= 2 && after.every((room) => !no.stuck.includes(room)), `${id}: every room after the gadget needs it (${no.stuck.join(', ')})`);
    // 3–6 puzzle rooms (rooms with something to do; the arena's own pieces are the fight's), a checkpoint in most
    const busy = new Set(Object.values(L.elements).filter((e) => e.room && e.type !== 'boss' && !L.rooms[e.room]?.boss).map((e) => e.room));
    assert.ok(busy.size >= 3 && busy.size <= 6, `${id}: ${busy.size} puzzle rooms`);
  }
});

// ------------------------------------------------------------------ the guardians
test('a guardian’s strike knocks you down but never takes you from more than a heart to nothing', () => {
  assert.equal(strikeDamage(3, 1), 1, 'a full heart off three');
  assert.ok(3 - strikeDamage(3, 5) >= HIT.floor - 1e-9, 'a huge strike leaves the floor (a quarter heart)');
  assert.equal(HIT.floor, 0.25);
  assert.ok(1.5 - strikeDamage(1.5, 2) >= HIT.floor - 1e-9, 'from a heart and a half: still standing');
  assert.equal(strikeDamage(1, 1), 1, 'one heart left: this one can knock you out');
  assert.equal(strikeDamage(0.5, 0.75), 0.75, 'already low: the full blow');
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
  assert.equal(temple.length, 11, 'a temple in every world');
  assert.equal(open.length, 11, 'and eleven gifts in the open');
  assert.ok(Object.values(GADGETS).every((g) => g.built), 'every temple is built');
  assert.equal(BUILT.length, 11);
  assert.equal(new Set([...temple, ...open]).size, 22, 'no gift twice');
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
  // the quick coil moved inside the First Garage from the keep's wall: whoever has it finds the chest open
  g.set('item.coil', true);
  assert.equal(migrateTemples(g), 1);
  assert.equal(g.flag('box.garage.temple.coil'), true);
  for (const id of ['garage', 'edena', 'bazaar']) assert.ok(TEMPLE_BOXES.some(([b]) => b.startsWith(`${id}.temple.`)), `${id}: its chest migrates`);
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
    const stood = resolvePlacement(box, { physics, level });
    assert.ok(stood, `${id}: the chest stands`);
    // on its dais, not sunk into it (the Spheres' chest stood on the floor under the dais: the QC pass)
    const site = rt.gadgetSite.at;
    assert.ok(Math.abs(stood.pos.y - site[1]) < 0.05, `${id}: the chest on top of its dais (${stood.pos.y.toFixed(2)} vs ${site[1]})`);
    assert.ok(Math.abs(physics.groundAt(site[0], site[1] + 1, site[2], 3) - site[1]) < 0.05, `${id}: the dais's top is solid`);
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
test('the Givers’ House on foot: the tar ball through the pilot flame into the hooded bowl, back through the flame and into the thorns, the ember, the chest’s ball through the corridor, the long groove and its relay, the keepers’ door, the Keeper panting by a fire rolled to it, out', () => {
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('desert');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };   // (as main.js: the moving colliders first)
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s, input = {}, yaw = 0) => { for (let i = 0; i < s / DT; i++) frame(input, yaw); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const said = (re) => notes.some((s) => re.test(s));
  /** Walk up behind a ball (sign: along its groove, or back) and push it that way. */
  const push = (ball, sign = 1) => {
    const dir = ball.dir.clone().multiplyScalar(sign);
    walk(ball.group.position.clone().addScaledVector(dir, -(ball.r + 1.4)), { tol: 1.2, max: 10 });
    ball.hit('push', dir, { strength: 1 });
  };
  /** Frames until a ball has slowed (or s seconds). */
  const settle = (ball, s = 8) => { for (let i = 0; i < s / DT; i++) { frame(); if (Math.abs(ball.v) < 0.3) return; } };
  /** Push a ball along until it rests on its plate (at most n pushes). */
  const roll = (ball, n = 6) => { for (let k = 0; k < n && !(ball.rest && rt.logic.drumOn(ball.id, rt.logic.el(ball.id).plate)); k++) { push(ball, 1); settle(ball); } for (let i = 0; i < 4 / DT && !ball.rest; i++) frame(); };
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), 'standing in the Threshold');

  // ---- the Hall of the Flame: the door is shut; the ball rolled through the pilot flame catches, and lights the bowl
  assert.equal(walk(L(0, 0, 49)), true, `walk to the door (${where()})`);
  assert.ok(rt.kit.local(P.pos).z < 51.5, 'the shut door stops you');
  const ball1 = rt.piece('ball1'), b0 = rt.piece('b0');
  assert.equal(ball1.burn, 0, 'the tar ball is cold');
  push(ball1); settle(ball1);
  assert.ok(ball1.burn > 0 && rt.kit.local(ball1.center).z > 27.5, 'rolled through the pilot flame, it burns');
  assert.ok(said(/Givers’ flame and catches/), 'and says so');
  // the failure: let it burn out before it reaches the bowl, and the bowl tips the cold ball back out
  wait(15);
  assert.equal(ball1.burn, 0, 'it burns out');
  roll(ball1);
  wait(2);
  assert.equal(rt.logic.isLit('b0'), false, 'cold, it lights nothing');
  assert.ok(said(/tips it back out/) && rt.kit.local(ball1.center).z < 44.5, 'the hooded bowl tips the cold ball back out');
  // back through the flame, and on into the bowl while it burns
  for (let k = 0; k < 4 && rt.kit.local(ball1.center).z > 25; k++) { push(ball1, -1); settle(ball1); }
  assert.ok(ball1.burn > 0, `pushed back through the flame, it burns again (${rt.kit.local(ball1.center).z.toFixed(1)})`);
  roll(ball1);
  wait(1);
  assert.equal(rt.logic.isLit('b0'), true, 'burning, it lights the hooded bowl');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true, 'and the door opens');

  // ---- the Dry Channel: the thorns over the bridge's sockets; the flame is behind the ball
  assert.equal(walk(L(0, 0, 56.5)), true, `through the door (${where()})`);
  const ball2 = rt.piece('ball2');
  push(ball2, 1); settle(ball2); roll(ball2);
  assert.ok(ball2.rest && rt.logic.drumOn('ball2', 'pb2'), 'the cold ball reaches the thorns');
  assert.equal(rt.logic.isLit('bw2'), false, 'and stops against them: they stand');
  assert.ok(said(/cold ball stops against the thorns/));
  assert.equal(rt.logic.isOpen('br0'), false, 'the bridge stays down');
  // back west through the flame, to the groove's end
  for (let k = 0; k < 4 && ball2.t > 0.02; k++) { push(ball2, -1); settle(ball2); }
  assert.ok(ball2.burn > 0, 'through the flame: it burns');
  roll(ball2);
  wait(3);
  assert.equal(rt.logic.isLit('bw2'), true, 'burning, it burns the thorns');
  assert.equal(rt.logic.isOpen('br0'), true, 'and the bridge rises');
  assert.equal(walk(L(9.5, 0, 56.4)), true, `to the bridge’s foot, where the thorns were (${where()})`);
  assert.equal(walk(L(9.5, 0, 82)), true, `over the bridge to the far landing (${where()})`);
  assert.ok(P.pos.y > L(0, -1, 0).y, 'not in the pit');
  let climbed = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(0, 7, 90))); if (P.onGround && rt.kit.local(P.pos).y > 6.5) { climbed = true; break; } }
  assert.ok(climbed, `up the gallery's wall (${where()})`);

  // ---- the Chest Chamber: ember mode; the corridor's thorns; the chest's tar ball
  assert.equal(walk(L(-2, 7, 101)), true, `into the chest chamber (${where()})`);
  assert.equal(rt.logic.next(), 'chest');
  items.grant('fire'); game.set('box.desert.temple.fire', true); game.emit('box:opened', { id: 'desert.temple.fire' });
  assert.equal(rt.logic.gadget, true);
  assert.equal(walk(L(-1.5, 7, 121), { max: 5 }), false, 'the thorns are in the way');
  const ball3 = rt.piece('ball3');
  roll(ball3, 3);
  assert.equal(rt.logic.isLit('bw0'), false, 'pushed cold, the ball stops against the thorns');
  assert.ok(ball3.t < 0.6, `(at ${ball3.t.toFixed(2)})`);
  rt.piece('bw0').hit('shoot');
  assert.equal(rt.logic.isLit('bw0'), false, 'plain fluid only beads on the thorns');
  // the ball lit and rolled: it burns through the thorns and on to the bowl on the near lip
  ball3.hit('fire');
  assert.ok(ball3.burn > 0, 'an ember glob lights the ball');
  roll(ball3);
  wait(1.5);
  assert.equal(rt.logic.isLit('bw0'), true, 'it burns through the thorns');
  assert.equal(rt.logic.isLit('b3'), true, 'and on into the hooded bowl, which catches');
  wait(3.5);
  assert.equal(rt.logic.isOpen('br1'), true, 'the bridge rises');
  // ---- the Hall of Fires: the hooded bowl takes no ember; over the bridge
  assert.equal(walk(L(-5, 7, 125)), true, `into the hall of fires (${where()})`);
  assert.equal(walk(L(-5, 7, 147)), true, `over the bridge (${where()})`);
  assert.ok(P.pos.y > L(0, 6, 0).y, 'over it, not into the chasm');
  const b4 = rt.piece('b4');
  b4.hit('fire');
  assert.equal(rt.logic.isLit('b4'), false, 'the far door’s bowl is hooded: an ember glob does nothing');
  assert.ok(said(/stone hood/), 'it says why');
  assert.equal(walk(L(0, 7, 160), { max: 4 }), false, 'the far door is shut');

  // ---- the Hall of Channels: the long groove burns the ball out short; the relay lights it again
  assert.equal(walk(L(12, 7, 149)), true, `to the far landing's east doorway (${where()})`);
  assert.equal(walk(L(30, 7, 149)), true, `into the Hall of Channels (${where()})`);
  const ball4 = rt.piece('ball4');
  ball4.hit('fire');
  walk(ball4.group.position.clone().add(V(1.6, 0, 0)), { tol: 1.0, max: 8 });
  ball4.hit('push', ball4.dir.clone(), { strength: 1 });
  let outAt = null;
  for (let i = 0; i < 14 / DT; i++) { frame(); if (ball4.burn === 0 && outAt == null) outAt = ball4.t; if (ball4.v < -0.5) break; }
  assert.ok(outAt != null && outAt < 0.98, `lit at the start, it burns out short of the bowl (t ${outAt?.toFixed(2)})`);
  assert.equal(rt.logic.isLit('b4'), false, 'cold, the bowl stays dark');
  for (let i = 0; i < 25 / DT && !ball4.rest; i++) frame();
  // the relay brazier beside the groove: lit, it wakes the keepers' door; the ball rolled past it catches
  assert.equal(rt.logic.isOpen('sc'), false, 'the keepers’ door is shut');
  rt.piece('b10').hit('fire');
  wait(2.5);
  assert.equal(rt.logic.isOpen('sc'), true, 'the relay wakes the keepers’ door: the way back to the near ledge');
  walk(ball4.group.position.clone().add(V(1.6, 0, 0)), { tol: 1.0, max: 20 });
  assert.equal(ball4.burn, 0, 'the ball is cold');
  ball4.hit('push', ball4.dir.clone(), { strength: 1 });
  for (let i = 0; i < 16 / DT && !rt.logic.isLit('b4'); i++) frame();
  assert.equal(rt.logic.isLit('b4'), true, 'pushed cold past the relay, it catches and burns on into the far door’s bowl');
  wait(2.5);
  assert.equal(rt.logic.isOpen('d3'), true, 'the far door opens');
  // the shortcut: through the keepers' door to the near ledge, and back
  assert.equal(walk(L(20, 7, 124)), true, `down the Hall of Channels (${where()})`);
  assert.equal(walk(L(9, 7, 124)), true, `through the keepers’ door onto the near ledge (${where()})`);
  assert.equal(walk(L(20, 7, 124)), true);
  assert.equal(walk(L(20, 7, 149)), true);
  assert.equal(walk(L(8, 7, 149)), true, `back onto the far landing (${where()})`);
  assert.equal(walk(L(0, 7, 162)), true, `through the far door (${where()})`);

  // ---- the Cistern: the Keeper wakes; light its braziers, water it when it pants, then by a fire rolled to it
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
  for (let n = 0; n < 2; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (K.state === 'open') { open = true; break; } if (P.dead) P.restart(); }
    assert.ok(open, `it pants (${n})`);
    K.hit('mouth', 'shoot');
  }
  assert.equal(K.phaseIndex, 2, 'its last phase');
  // its last: no panting in the dark; a burning ball rolled down the spoke nearest it, and it pants by the fire
  for (let n = 0; n < 2; n++) {
    let open = false;
    for (let tries = 0; tries < 6 && !open; tries++) {
      const m = K.model.pos, ball = rt.spokes.slice().sort((a, b) => a.b.distanceTo(m) - b.b.distanceTo(m))[0];
      if (!ball.rest || ball.t > 0.3) { ball.t = 0; rt.logic.moveDrum(ball.id, 0); ball.place(); ball.rest = true; }   // (back at its start: the test's shortcut for walking it back)
      ball.hit('push', ball.dir.clone(), { strength: 1 });
      for (let i = 0; i < 12 / DT; i++) { frame(); if (K.state === 'open') { open = true; break; } if (P.dead) P.restart(); }
    }
    assert.ok(open, `a fire rolled to it: it pants (${n})`);
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
test('the Warden’s Well on foot: the vane and the discs, the slot and the ball, the jets, the great vane and the lidded eye, the iris, the ball pushed over the gap from the air, two vanes at once for the crown’s eye (the little one in the loft below, too slow and in time), the warden broken over a vane, the shaft’s breath', () => {
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('incal');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, killY: level.killY });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };   // (as main.js: the moving colliders first)
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s, input = {}, yaw = 0) => { for (let i = 0; i < s / DT; i++) frame(input, yaw); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const said = (re) => notes.some((n) => re.test(n));
  const ly = () => rt.kit.local(P.pos).y;
  /**
   * Fly with the jets (they fly like a plane: player.js JET): RT lifts you straight up, eased off
   * ahead of height y (local); the stick forward tips the nose over to level, facing `to` (local [x, z]);
   * across on a squeeze that eases off as it nears; then let go: too slow to glide, you drop onto it.
   */
  // the jets' throttle t (0..1) as a player gives it on jump held, all or nothing since v1.38: held on the share t of the frames
  let acc = 0;
  const thr = (t, extra = {}) => { acc += t; const on = acc >= 1; if (on) acc -= 1; return on ? { Space: true, PadJump: true, ...extra } : { ...extra }; };
  const fly = (y, to, { max = 14 } = {}) => {
    const target = L(to[0], y, to[1]);
    const face = () => { P.heading = P.frame.headingOf(target.clone().sub(P.pos).setY(0)); };
    const left = () => y - ly();
    let i = 0;
    face();
    // (jump held: full throttle, let go a little short of the height, the speed carrying him on; then the nose tipped level)
    for (; i < max / DT && left() > Math.max(0.3, P.vel.dot(P.frame.up) * 0.3); i++) { frame(thr(1), 0); }
    for (; i < max / DT && P.jetFlight?.pitch > 0.05; i++) { face(); frame(thr(left() > 0 ? 0.3 : 0, { stick: { x: 0, y: 1 } }), 0); }
    // (on along at full throttle, the nose kept level with the stick (the throttle is all or nothing since v1.38), until near enough to stop)
    for (; i < max / DT && flat(target) > Math.max(0.8, Math.hypot(P.vel.x, P.vel.z) * 0.3) && !P.onGround; i++) {
      face();
      const pitch = P.jetFlight?.pitch ?? 0;
      frame({ Space: true, PadJump: true, stick: { x: 0, y: pitch > 0.04 ? 0.6 : pitch < -0.04 ? -0.6 : 0 } }, 0);
    }
    // (over it: aiming, the jets hold him and he sinks onto it)
    for (; i < max / DT && !P.onGround; i++) frame(P.jetFlight ? { PadAim: true } : {}, 0);
    return P.onGround && flat(target) < 2;
  };
  /** Straight up on the jets from where you stand to height y (local), then aim: the jets hold you there, sinking slowly. */
  const hover = (y) => {
    for (let i = 0; i < 8 / DT && y - ly() > Math.max(0.3, P.vel.dot(P.frame.up) * 0.3); i++) frame(thr(1), 0);   // (jump held, let go a little short: the speed carries him on)
    for (let i = 0; i < 0.6 / DT; i++) frame({ PadAim: true }, 0);
    return !!P.jetHold;
  };
  const holding = (s, fn = () => false) => { for (let i = 0; i < s / DT; i++) { frame({ PadAim: true }, 0); if (fn()) return true; } return false; };
  const land = () => { for (let i = 0; i < 8 / DT && !P.onGround; i++) frame({}, 0); return P.onGround; };
  const push = (ball, n = 8, until = () => false) => {
    for (let k = 0; k < n && !until(); k++) {
      walk(ball.center.clone().addScaledVector(ball.dir, -2.0), { tol: 0.5 });
      ball.hit('push', ball.dir.clone(), { strength: 0.6 });
      wait(2.5);
    }
  };
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), 'in the tower');

  // ---- the Turning Floors: the discs are still until the vane over the far door turns; a splash spins it a while
  assert.equal(walk(L(0, 0, 17)), true, `to the drop (${where()})`);
  const [discA, discB] = rt.pieces.filter((p) => p.path);
  wait(3);
  assert.ok(discA.s === 0 && discB.s === discB.total, 'the discs are still');
  const v1 = rt.piece('v1');
  v1.hit('shoot');
  wait(0.1);
  assert.equal(v1.turning, true, 'the vane spins');
  assert.equal(rt.logic.isOpen('discs'), true, 'and the discs ride');
  let splashes = 1;
  const ride = (disc, off) => {
    for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.3); i++) { frame(); if (!v1.turning) { v1.hit('shoot'); splashes++; } }
    assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 6 }), true, `onto the disc (${where()})`);
    for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) { frame(); if (!v1.turning) { v1.hit('shoot'); splashes++; } }
    assert.equal(walk(off, { tol: 0.8 }), true, `off the disc (${where()})`);
  };
  // (the far disc comes back for you from the far side: the two meet you at the island together)
  ride(discA, L(0, 0, 29));
  ride(discB, L(0, 0, 42.5));
  assert.ok(P.pos.y > L(0, -1, 0).y, 'across, not in the drop');
  assert.equal(splashes, 1, 'one splash carries you across');
  // it slows, and stops; and the discs stop with it
  assert.equal(walk(L(0, 0, 44)), true);
  for (let i = 0; i < 20 / DT && v1.turning; i++) frame();
  assert.equal(v1.turning, false, 'the vane runs down');
  assert.equal(rt.logic.isOpen('discs'), false);
  const s0 = [discA.s, discB.s];
  wait(2);
  assert.deepEqual([discA.s, discB.s], s0, 'the discs stop where they are');
  assert.ok(said(/slowing/), 'it says it is slowing');

  // ---- the Climb: up the block's face; the ball stops at the slot, until the vane in the well's floor turns
  assert.equal(walk(L(0, 0, 57)), true, `into the well (${where()})`);
  let up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(0, 11, 62))); if (P.onGround && ly() > 10.5) { up = true; break; } }
  assert.ok(up, `up the face (${where()})`);
  const ball = rt.piece('ball1'), gap = ball.o.gap;
  let most = 0;
  for (let k = 0; k < 3; k++) { push(ball, 1); most = Math.max(most, ball.t); }
  assert.ok(ball.t <= gap.from + 1e-3 && said(/slot’s lip/), `the ball stops at the slot's lip, and rolls back a little (${ball.t.toFixed(2)})`);
  assert.equal(rt.logic.drumOn('ball1', 'p1'), false);
  assert.ok(said(/drives them/), 'it says why');
  // from the lip, the vane far below: a splash, and the slot's stones stand while it turns
  const v2 = rt.piece('v2');
  {
    const eyeAt = L(0, 12.6, 58.9), to = v2.center.clone().add(V(0, 0.1, 0)), l = to.distanceTo(eyeAt);
    assert.ok(physics.rayDistance(eyeAt, to.clone().sub(eyeAt).normalize(), l) >= l - 0.3, 'the vane in sight from the balcony’s lip');
  }
  v2.hit('shoot');
  wait(0.2);
  assert.equal(rt.logic.isOpen('slot'), true, 'the slot stands');
  push(ball, 8, () => rt.logic.drumOn('ball1', 'p1'));
  assert.ok(rt.logic.drumOn('ball1', 'p1'), `over the slot, onto its plate (${ball.t.toFixed(2)})`);
  wait(2);
  assert.equal(rt.logic.isOpen('d1'), true);

  // ---- the Jets' Chamber: the chest; the only way on is up through the oculus
  assert.equal(walk(L(0, 11, 75)), true, `into the chamber (${where()})`);
  for (let i = 0; i < 2 / DT; i++) frame({ Space: true }, 0);
  assert.ok(ly() < 16, 'without the jets you cannot go up');
  items.grant('jetpack'); game.emit('box:opened', { id: 'incal.temple.jetpack' });
  assert.equal(rt.logic.gadget, true);
  // what they are for, at once: a line a moment after the chest, the drone sent up, rings rising through the oculus
  const pings = [], offPing = game.on('scout:ping', (e) => pings.push(e));
  wait(1.5);
  assert.ok(notes.includes(JETS_NEXT), `the jets' next step is said (${notes.at(-1)})`);
  assert.match(JETS_NEXT, /\{key:thrust\}/);   // (the thrust as the player holds it: src/prompt-keys.js keyText)
  assert.equal(pings.length, 1, 'the drone flies up to show where');
  offPing?.();
  const guide = rt.pieces.find((p) => p.constructor.name === 'JetGuide');
  assert.ok(guide?.root.visible, 'the way up shows');
  assert.equal(jetsUsed(rt), false);
  assert.equal(walk(L(0, 11, 81), { tol: 1.2 }), true);
  assert.equal(fly(36.5, [0, 81 - 8]), true, `up through the oculus to the gallery floor (${where()})`);
  assert.ok(Math.abs(ly() - 34.6) < 0.4, `standing in the gallery (${where()})`);
  assert.equal(jetsUsed(rt), true, 'up: the jets were the way');
  wait(1.2);
  assert.equal(guide.root.visible, false, 'the rings fade once you are up');

  // ---- the Lamp Gallery: the eye over the west shelf, hidden from the floor, its lids shut
  const eye = rt.piece('s2'), vG = rt.piece('vG');
  const from = P.pos.clone().add(V(0, 1.5, 0)), d = eye.center.clone().sub(from), dist = d.length();
  assert.ok(physics.rayDistance(from, d.normalize(), dist) < dist - 1, 'the eye is hidden from the floor');
  eye.hit('shoot');
  assert.equal(rt.logic.isLit('s2'), false, 'shut lids: the splash does nothing');
  assert.ok(said(/lids/), 'and it says they are shut');
  vG.hit('shoot');
  wait(0.2);
  assert.equal(vG.turning, false, 'a splash only rocks the great vane');
  assert.ok(said(/too heavy/), 'too heavy for a splash');
  assert.equal(rt.logic.isOpen('iris'), false, 'the iris is shut');
  // the way: up over the great vane on the jets, and hold there (aim): it turns, the lids lift; splash the eye
  assert.equal(walk(vG.center, { tol: 0.6 }), true, `onto the great vane (${where()})`);
  assert.equal(hover(34.6 + 7.8), true, `the jets hold you over it (${where()})`);
  assert.equal(vG.turning, true, 'the jets’ wash turns it');
  assert.ok(holding(0.8, () => eye.lidK > 0.95), 'the eye’s lids lift');
  {
    const f2 = P.pos.clone().add(V(0, 0.6, 0)), d2 = eye.center.clone().sub(f2), l2 = d2.length();
    assert.ok(physics.rayDistance(f2, d2.normalize(), l2) >= l2 - 1.2, `from the air the eye is in sight (${where()})`);
  }
  eye.hit('shoot');
  assert.equal(rt.logic.isLit('s2'), true, 'the eye wakes');
  holding(2.2);
  assert.equal(rt.logic.isOpen('iris'), true, 'the iris opens');
  land();
  wait(2);
  assert.equal(vG.turning, false, 'off the jets, the vane runs down');
  assert.equal(rt.logic.isLit('s2'), true, 'and the eye stays awake');

  // ---- up through the iris to the loft
  const GC = 34.6 + 15;
  assert.equal(walk(L(0, 34.6, 81.4 - 4.3), { tol: 0.4 }), true, `to the oculus' rim (${where()})`);
  assert.equal(fly(GC + 3, [-6, 81.4 - 8]), true, `up through the iris to the loft (${where()})`);
  assert.ok(Math.abs(ly() - GC) < 0.5, `standing in the loft (${where()})`);
  // the shelf's ball stops at the gap: its stones are down, and the great vane is too heavy for a splash
  const ball3 = rt.piece('ball3'), vE = rt.piece('vE'), g3 = ball3.o.gap;
  P.teleport(ball3.center.clone().addScaledVector(ball3.dir, -2.2).setY(ball3.group.position.y + 0.1), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  ball3.hit('push', ball3.dir.clone(), { strength: 1 });
  wait(3);
  assert.ok(ball3.t <= g3.from + 1e-3 && said(/stops at the gap/), `the ball stops at the gap (${ball3.t.toFixed(2)})`);
  vE.hit('shoot');
  wait(0.2);
  assert.equal(rt.logic.isOpen('span'), false, 'a splash does not turn it');
  // the way: hover over the loft's great vane, and push the ball over the gap from the air
  P.teleport(L(-7, GC + 0.1, 81.4 - 8.5), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  assert.equal(walk(vE.center, { tol: 0.6 }), true, `onto the loft's vane (${where()})`);
  assert.equal(hover(GC + 6.8), true, `held over it (${where()})`);
  assert.ok(holding(2, () => rt.logic.isOpen('span')), 'the gap’s stones stand while it turns');
  const aim = ball3.center.clone().sub(P.pos).normalize();
  assert.ok(Math.abs(aim.dot(ball3.dir)) > 0.5, `the ball pushed along its groove from the air (${aim.dot(ball3.dir).toFixed(2)})`);
  ball3.hit('push', aim, { strength: 1 });
  holding(4, () => ball3.t > g3.to + 0.05);
  assert.ok(ball3.t > g3.to, `over the gap (${ball3.t.toFixed(2)})`);
  holding(3, () => rt.logic.drumOn('ball3', 'p3'));
  land();
  for (let k = 0; k < 4 && !rt.logic.drumOn('ball3', 'p3'); k++) push(ball3, 1);
  assert.ok(rt.logic.drumOn('ball3', 'p3'), `onto its plate (${ball3.t.toFixed(2)})`);
  wait(2.2);
  assert.equal(rt.logic.isOpen('iris2'), true, 'the second iris opens');

  // ---- up through the second iris to the crown: the eye whose lids lift only while two vanes turn at once
  const GK = 34.6 + 24;
  P.teleport(L(0, GC + 0.1, 81.4 - 6.2), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  assert.equal(fly(GK + 3, [-8, 81.4 - 6]), true, `up through the second iris to the crown (${where()})`);
  assert.ok(Math.abs(ly() - GK) < 0.5, `standing in the crown (${where()})`);
  const s4 = rt.piece('s4'), vS = rt.piece('vS'), vC = rt.piece('vC');
  // the great vane alone: the lids stay shut (round the open iris, not across it)
  for (const [x, z] of [[0, -10.2], [9.6, -3.6], [9.6, 2.4]]) walk(L(x, GK, 81.4 + z), { tol: 1 });
  assert.equal(walk(vC.center, { tol: 0.6 }), true, `onto the crown's great vane (${where()})`);
  assert.equal(hover(GK + 6.6), true, `held over it (${where()})`);
  assert.equal(vC.turning, true);
  holding(1);
  assert.ok(s4.lidK < 0.05, 'one vane turning is not enough: the lids stay shut');
  s4.hit('shoot');
  assert.equal(rt.logic.isLit('s4'), false, 'and a splash on them does nothing');
  assert.ok(said(/two vanes/), 'it says what they want');
  land();
  for (let i = 0; i < 3 / DT && vC.turning; i++) frame();
  // the little vane is not in the crown: it stands on a post in the loft below, seen down through the second iris
  assert.ok(rt.kit.local(vS.center).y < GK - 1 && rt.logic.el('vS').room === 'loft', 'the little vane stands in the loft');
  {
    const f2 = L(0, GK + 1.7, 81.4 + 8.5), d2 = vS.center.clone().sub(f2), l2 = d2.length();
    assert.ok(physics.rayDistance(f2, d2.normalize(), l2) >= l2 - 1.2, 'seen from the crown by the high door, down through the iris');
  }
  // the small one alone: down in the loft, its splash, and it slows and stops before long
  P.teleport(L(0, GC + 0.1, 81.4 - 6.2), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  vS.hit('shoot');
  assert.equal(vS.turning, true, 'the little vane spins');
  assert.ok(!s4.lidsOpen(), 'still shut: the great one is still');
  for (let i = 0; i < 20 / DT && vS.turning; i++) frame();
  assert.equal(vS.turning, false, 'and it stops');
  // too slow: splashed, then a long look round before flying up; it has stopped by the time the great one turns
  vS.hit('shoot');
  wait(VANES.small - 3);
  assert.equal(fly(GK + 3, [6.2, 81.4 + 5.4]), true, `up through the second iris onto the great vane (${where()})`);
  walk(vC.center, { tol: 0.6, max: 2 });
  assert.equal(hover(GK + 6.6), true);
  holding(1);
  assert.ok(!vS.turning && s4.lidK < 0.05, 'the little one stopped on the way up: the lids stay shut');
  land();
  for (let i = 0; i < 3 / DT && vC.turning; i++) frame();
  // the way: splash the small one in the loft, then fly straight up to the great one and hover while it still turns
  P.teleport(L(0, GC + 0.1, 81.4 - 6.2), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  vS.hit('shoot');
  assert.equal(fly(GK + 3, [6.2, 81.4 + 5.4]), true, `up through the second iris onto the great vane (${where()})`);
  walk(vC.center, { tol: 0.6, max: 2 });
  assert.equal(hover(GK + 6.6), true);
  assert.ok(holding(1.2, () => s4.lidK > 0.95), `both turn: the lids lift (${vS.left.toFixed(1)} s of the little one left)`);
  {
    const f2 = P.pos.clone().add(V(0, 0.6, 0)), d2 = s4.center.clone().sub(f2), l2 = d2.length();
    assert.ok(physics.rayDistance(f2, d2.normalize(), l2) >= l2 - 1.2, `from the air the crown's eye is in sight (${where()})`);
  }
  s4.hit('shoot');
  assert.equal(rt.logic.isLit('s4'), true, 'the crown’s eye wakes');
  holding(2.2);
  assert.equal(rt.logic.isOpen('d3'), true, 'the high door opens');
  land();

  // ---- the Warden's Hall
  P.teleport(L(-8, GK + 0.1, 81.4 - 7.5), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  assert.equal(fly(63.5, [0, 81.4 + 14 - 3.2]), true, `up to the high ledge (${where()})`);
  assert.equal(walk(L(0, 62.6, 104)), true, `into the hall (${where()})`);
  const K = rt.guardian;
  wait(0.4);
  assert.notEqual(K.state, 'sleep', 'it wakes');
  assert.equal(rt.logic.isOpen('d3'), false, 'the door shuts behind you');
  P.opts.health = false;
  const nearest = () => rt.hallVanes.slice().sort((a, b) => a.center.distanceTo(K.model.pos) - b.center.distanceTo(K.model.pos))[0];
  const hoverOver = (v) => {
    P.teleport(v.center.clone().add(V(0, Math.max(6.5, K.model.mouth.y - v.center.y + 1.2), 0)), V(0, 1, 0), V(0, 0, 1));
    for (let i = 0; i < 3; i++) frame({ Space: true, PadJump: true }, 0);
    for (let i = 0; i < 0.5 / DT; i++) frame({ PadAim: true }, 0);
  };
  let stillTried = false;
  for (let n = 0; n < 10 && K.state !== 'resolved'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (K.state === 'open') { open = true; break; } }
    assert.ok(open, `its vents open (${n}, phase ${K.phaseIndex})`);
    if (K.phaseIndex >= 1) {
      // guarded: only from above
      const below = K.meter;
      P.teleport(L(0, 62.6, 104), V(0, 1, 0), V(0, 0, 1));
      K.hit('mouth', 'shoot');
      assert.equal(K.meter, below, 'from the floor its shut sides take nothing');
      wait(2.5);   // (it backs onto its nearest vane)
      const v = nearest();
      assert.ok(Math.hypot(v.center.x - K.model.pos.x, v.center.z - K.model.pos.z) < 8, 'it backs onto a vane');
      if (K.phaseIndex === 2 && !stillTried) {
        // the last phase: over it in still air, its hatch slams
        stillTried = true;
        P.teleport(K.model.mouth.clone().add(V(4, 1.5, 0)), V(0, 1, 0), V(0, 0, 1));
        K.hit('mouth', 'shoot');
        assert.equal(K.meter, below, 'in still air the hatch stays shut');
        assert.ok(said(/still air/), 'and it says so');
      }
      hoverOver(v);
      assert.equal(v.turning, true, 'hovering on the jets turns the vane under you');
      assert.ok(P.pos.y > K.model.mouth.y - 1.2, `over its hatch (${(P.pos.y - v.center.y).toFixed(1)} vs ${(K.model.mouth.y - v.center.y).toFixed(1)}, held ${P.jetHold})`);
    }
    const before = K.meter, phase = K.phaseIndex;
    K.hit('mouth', 'shoot');
    if (phase === 1) assert.ok(Math.abs(K.meter - before - 0.25) < 1e-6 || K.meter >= 0.75, `over a turning vane a hit counts twice (${(K.meter - before).toFixed(3)})`);
    for (let i = 0; i < 1 / DT && !P.onGround; i++) frame();
  }
  assert.equal(K.state, 'resolved', `broken (${K.meter})`);
  assert.ok(stillTried, 'the last phase was met');
  land();
  P.endJets();
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
test('the Founders’ Belfry on foot: two balls in the two stores, the founders’ bell struck by a ball and the great stone that falls up (and without you), the eye under the landing, the bell, its try in the chamber, the porch’s held door a room on, the held stones and the ball rolled across them, the Cloud-Mother calmed, the stones come down outside', () => {
  game.reset();
  own('backpack', 'gun');
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
  const via = (...pts) => pts.every((q) => walk(L(...q)));
  // ---- the Hall of Stones, a hub: the door's two lamps want the two balls in the two stores off the hall
  const roll = (id, plate) => {
    const ball = rt.piece(id);
    for (let k = 0; k < 10 && !rt.logic.drumOn(id, plate); k++) {
      walk(ball.center.clone().addScaledVector(ball.dir, -(ball.r + 1.3)), { tol: 0.5 });
      ball.hit('push', ball.dir.clone(), { strength: 1 });
      wait(2.6);
    }
    return rt.logic.drumOn(id, plate);
  };
  assert.equal(via([-6, 0, 23], [-13, 0, 23]), true, `into the west store (${where()})`);
  assert.equal(roll('ball1', 'p1'), true, `the west ball home (${rt.piece('ball1').t.toFixed(2)})`);
  wait(1);
  assert.equal(rt.logic.isOpen('d1'), false, 'one lamp of two');
  assert.equal(via([-13, 0, 23], [-6, 0, 23], [6, 0, 23], [12.6, 0, 23]), true, `into the east store (${where()})`);
  assert.equal(roll('ball2', 'p2'), true, `the east ball home (${rt.piece('ball2').t.toFixed(2)})`);
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true);
  // ---- the Stone Stair: the great stone hangs at the top of the well, by the high door; the founders' bell low by the
  // way in, a ball in a groove into its mouth
  assert.equal(via([12.6, 0, 23], [4, 0, 30], [0, 0, 40], [0, 0, 46.5]), true, `into the well (${where()})`);
  assert.equal(rt.pieces.filter((p) => p.path && !(p instanceof FallUpStone)).length, 0, 'no riding disc in the belfry');
  const stone = rt.pieces.find((p) => p instanceof FallUpStone);
  assert.ok(stone.s > stone.total - 0.01, 'the great stone hangs at the top');
  const eye = rt.piece('s1').center, seen = (from) => { const d = eye.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.8; };
  assert.ok(seen(L(2, 1.7, 50)), 'the eye under the landing is seen from the floor of the well');
  assert.ok(!seen(L(0, 17.8, 56.4 + 7.2)), 'and not from the landing');
  assert.equal(roll('ballS', 'pS'), true, `the ball rolled into the bell's mouth (${rt.piece('ballS').t.toFixed(2)})`);
  assert.equal(rt.logic.isLit('e0'), true, 'it strikes the founders’ bell');
  wait(6);
  assert.ok(stone.s < 0.05, `while it rings the great stone is down (${stone.s.toFixed(2)})`);
  // the catch: stay on the floor, and when the bell falls quiet the stone falls up again without you
  wait(HOLD_STAIR);
  assert.equal(rt.logic.isLit('e0'), false, 'the bell falls quiet');
  wait(10);
  assert.ok(stone.s > stone.total - 0.05 && P.pos.y < L(0, 1, 0).y, 'the stone went up without you');
  // a splash on the ball lying in its mouth strikes the bell again (no pushing it out)
  const ballS = rt.piece('ballS');
  ballS.hit('shoot', ballS.dir.clone().negate());
  wait(0.3);
  assert.equal(rt.logic.isLit('e0') && rt.logic.drumOn('ballS', 'pS'), true, 'a splash rocks the clapper, and the bell rings again');
  for (let i = 0; i < 8 / DT && stone.s > 0.02; i++) frame();
  assert.equal(walk(stone.group.position, { tol: 0.6, run: false, max: 6, dy: 1.0 }), true, `onto the great stone (${where()})`);
  // ride it up as the note fades; first without the eye: the landing's door stays shut
  for (let i = 0; i < 30 / DT && stone.s < stone.total - 0.05; i++) frame();
  assert.ok(P.pos.y > L(0, 15.5, 0).y, `carried up to the landing (${where()})`);
  assert.equal(walk(L(0, 16, 56.4 + 7.4), { tol: 0.7, max: 4 }), true, `off onto the landing (${where()})`);
  wait(0.5);
  assert.equal(rt.logic.isOpen('d2'), false, 'the high door is shut: its eye was not splashed');
  // down again (a drop to the floor costs nothing), ring, and splash the eye on the way up
  assert.equal(walk(L(0, 0, 56.4 + 1), { tol: 0.8, max: 6, dy: 20 }), true, `down to the floor (${where()})`);
  ballS.hit('shoot', ballS.dir.clone().negate());
  for (let i = 0; i < 8 / DT && stone.s > 0.02; i++) frame();
  assert.equal(walk(stone.group.position, { tol: 0.6, run: false, max: 6, dy: 1.0 }), true, `onto the great stone again (${where()})`);
  let splashed = false;
  for (let i = 0; i < 30 / DT && stone.s < stone.total - 0.05; i++) { frame(); if (!splashed && P.pos.y > L(0, 9, 0).y && seen(P.pos.clone().add(V(0, 1.6, 0)))) { rt.piece('s1').hit('shoot'); splashed = true; } }
  assert.ok(splashed, 'the eye splashed on the way up');
  wait(2);
  assert.equal(rt.logic.isOpen('d2'), true, 'the eye wakes the high door');
  assert.equal(walk(L(0, 16, 56.4 + 7.4), { tol: 0.7, max: 4 }), true, `off onto the landing (${where()})`);
  // ---- the Bell Chamber: the chest; its way on is open, and its own bell is a try
  assert.equal(walk(L(0, 16, 72)), true, `into the bell chamber (${where()})`);
  ring();
  wait(0.2);
  assert.equal(rt.logic.isLit('eT'), false, 'without the whistle nothing answers (whoever rang it)');
  items.grant('bell'); game.emit('box:opened', { id: 'arzach2.temple.bell' });
  ring();
  wait(2.5);
  assert.equal(rt.logic.isLit('eT') && rt.logic.isOpen('heap'), true, 'the chamber’s bell brings its stones down round the dais');
  wait(HOLD_CHAMBER);
  assert.equal(rt.logic.isOpen('heap'), false, 'and they fall up again when it falls quiet: nothing was locked');
  // ---- the Bell Porch, a room on: the door into the Hall of Echoes is held by the porch's own bell
  assert.equal(walk(L(0, 16, 95)), true, `through the open way into the porch (${where()})`);
  assert.equal(walk(L(0, 16, 104.5), { max: 4 }), false, 'the held door is shut');
  assert.equal(walk(L(0, 16, 84)), true, `back in the chamber (${where()})`);
  ring();
  wait(0.5);
  assert.equal(rt.logic.isLit('e1'), false, 'the porch’s bell does not hear the whistle from the chamber');
  assert.equal(walk(L(0, 16, 97)), true, `under the porch's bell (${where()})`);
  ring();
  wait(2.2);
  assert.equal(rt.logic.isOpen('d3'), true, 'the door answers the bell');
  wait(HOLD_DOOR - 1);
  assert.equal(rt.logic.isOpen('d3'), false, 'and rises again when the note fades');
  assert.ok(notes.some((s) => /fading/i.test(s)), 'it says the note is fading');
  ring();
  assert.equal(walk(L(0, 16, 106.2)), true, `through while it rings (${where()})`);
  // ---- the Hall of Echoes: a ball at the near edge, its groove over the chasm to the far door's plate
  const ball = rt.piece('ball3'), gap = ball.o.gap;
  wait(HOLD_STONES + 0.5);
  assert.equal(rt.logic.isOpen('br1'), false, 'the stones hang');
  walk(ball.center.clone().addScaledVector(ball.dir, -(ball.r + 1.3)), { tol: 0.5 });
  ball.hit('push', ball.dir.clone(), { strength: 1 });
  wait(3);
  assert.ok(ball.t <= gap.from + 1e-3, `while they hang the ball stops at the lip (${ball.t.toFixed(3)})`);
  // the catch: rung, the stones come down, but only while it rings; a ball still on them when they rise drops
  ring();
  wait(0.3);
  assert.equal(rt.logic.isOpen('br1'), true, 'the bell brings the stones down');
  wait(HOLD_STONES - 1.2);
  walk(ball.center.clone().addScaledVector(ball.dir, -(ball.r + 1.3)), { tol: 0.5, max: 3 });
  ball.hit('push', ball.dir.clone(), { strength: 0.4 });
  wait(1.5);
  assert.equal(rt.logic.isOpen('br1'), false, 'the note faded: the stones rise');
  wait(4);
  assert.ok(ball.t < 1e-3 && !ball.drop, `the ball dropped, and a new one waits at the near edge (${ball.t.toFixed(3)})`);
  // the revelation: ring, then roll the ball across at once; on its plate its weight holds the stones for good
  walk(ball.center.clone().addScaledVector(ball.dir, -(ball.r + 1.3)), { tol: 0.5 });
  ring();
  wait(0.2);
  ball.hit('push', ball.dir.clone(), { strength: 1 });
  for (let i = 0; i < 12 / DT && !rt.logic.drumOn('ball3', 'p3'); i++) frame();
  assert.equal(rt.logic.drumOn('ball3', 'p3'), true, `the ball across, on the far plate (${ball.t.toFixed(3)})`);
  wait(HOLD_STONES + 1);
  assert.equal(rt.logic.isOpen('br1'), true, 'the stones stay down');
  ball.hit('push', ball.dir.clone().negate(), { strength: 1 });
  wait(1);
  assert.equal(rt.logic.drumOn('ball3', 'p3'), true, 'settled in its socket: no pushing it back');
  assert.equal(walk(L(-1.5, 16, 133.2)), true, `over the stones (${where()})`);
  assert.ok(P.pos.y > L(0, 15, 0).y, 'on the bridge, not in the chasm');
  ring();
  wait(2.2);
  assert.equal(rt.logic.isOpen('d4'), true, 'the far bell door');
  // ---- the Cloud-Mother's hall
  assert.equal(walk(L(0, 16, 146.2)), true, `into her hall (${where()})`);
  const G = rt.guardian;
  wait(0.4);
  assert.notEqual(G.state, 'sleep', 'she wakes');
  P.opts.health = false;
  // (from her second phase a ring as she rises to dive brings a stone down where she dives; in her last that is the
  // only way she lies down to cry: tests/guardian-twists.test.js plays it through, failures and all)
  const rising = () => G.phaseIndex >= 1 && G.attack?.over && !G.struck && G.at > 0.15 && G.at < G.windFor * 0.5;
  let landed = 0;
  for (let n = 0; n < 16 && G.state !== 'weary'; n++) {
    let ready = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open' || rising()) { ready = true; break; } }
    assert.ok(ready, `she cries, or rises to dive (${n}, phase ${G.phaseIndex})`);
    if (n === 0) { const m = G.meter; G.hit('mouth', 'shoot'); assert.equal(G.meter, m, 'fluid does not calm her'); }
    if (G.state !== 'open') {
      ring();
      assert.ok(rt.hallStones.list.some((s) => s.held > 0), `a stone comes down where she will dive (${n})`);
      let lay = false;
      for (let i = 0; i < 6 / DT; i++) { frame(); if (G.state === 'open') { lay = true; break; } }
      assert.ok(lay, `she dives onto it and lies there, crying (${n})`);
      landed++;
    }
    P.teleport(G.model.pos.clone().setY(L(0, 16, 0).y).add(V(G.model.pos.x > L(0, 16, 164).x ? -6 : 6, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
    ring();
  }
  assert.ok(landed > 0, 'a stone brought down under her at least once');
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
test('the Footprint on foot: the sphere set down on the walker’s print and you on its print by the wall (and on the wrong prints), the floating sphere pushed over the stilled pool, the lens and its mural, the stones whose prints are the walker’s, the walker’s plate among plain ones and the eye across the chasm, the keepers’ gallery back, the Echo answered by the print', () => {
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('spheres');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };   // (as main.js: the moving colliders first)
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const said = (re) => notes.some((s) => re.test(s));
  wait(0.5);
  // ---- the Hall of Spheres: where the walker set the sphere down, and where it stood (three toes, like the Footprint)
  const ball1 = rt.piece('ball1');
  assert.equal(rt.pieces.filter((p) => p.dir && p.o?.a && p.o.a[1] < 1 && p.o.a[2] < 44).length, 1, 'one sphere in the hall, not two');
  const pushTo = (plate, strength) => {
    for (let k = 0; k < 8 && !rt.logic.drumOn('ball1', plate); k++) {
      const sign = Math.sign(rt.logic.el('ball1').stops[plate] - ball1.t) || 1;
      walk(ball1.center.clone().addScaledVector(ball1.dir, -sign * (ball1.r + 1.3)), { tol: 0.5 });
      ball1.hit('push', ball1.dir.clone().multiplyScalar(sign), { strength });
      for (let i = 0; i < 6 / DT && !ball1.rest; i++) frame();
    }
    return rt.logic.drumOn('ball1', plate);
  };
  // the wrong print: the sphere on the four-toed one, you on the walker's; the door does not stir
  assert.equal(pushTo('pb', 1), true, `the sphere on the four-toed print (${ball1.t.toFixed(2)})`);
  assert.equal(walk(rt.piece('pW').pos, { tol: 0.5 }), true, 'onto the walker’s print by the wall');
  wait(1);
  assert.equal(rt.logic.isOpen('d1'), false, 'the sphere is on the wrong print');
  // the sphere on the walker's print, and you on a two-toed one: still shut
  assert.equal(pushTo('p1', 0.3), true, `the sphere back on the walker's print (${ball1.t.toFixed(2)})`);
  assert.equal(walk(rt.piece('pY').pos, { tol: 0.5 }), true, 'onto a two-toed print');
  wait(1);
  assert.equal(rt.logic.isOpen('d1'), false, 'you stand on the wrong print');
  assert.equal(walk(rt.piece('pW').pos, { tol: 0.5 }), true, 'onto the walker’s print');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true, 'both where the walker was: the door sinks');
  assert.equal(walk(L(4, 0, 34)), true, `off the print (${where()})`);
  wait(0.5);
  assert.equal(rt.logic.isOpen('d1'), true, 'and stays open');
  // ---- the Still Pool: pushed while the water stirs, the sphere drifts back; from the stilling stone it crosses
  assert.equal(walk(L(-2.5, 0, 49.2)), true, `to the pool (${where()})`);
  const ball3 = rt.piece('ball3');
  ball3.hit('push', ball3.dir.clone(), { strength: 1 });
  let far = 0;
  for (let i = 0; i < 12 / DT; i++) { frame(); far = Math.max(far, ball3.t); }
  assert.ok(far > 0.3 && far < 0.9, `pushed in the stirring water it gets part way (${far.toFixed(2)})`);
  for (let i = 0; i < 15 / DT && !ball3.rest; i++) frame();
  assert.ok(ball3.t < 0.1, `and the water draws it back to you (${ball3.t.toFixed(2)})`);
  assert.ok(said(/water stirs/), 'it says so');
  assert.equal(rt.logic.isOpen('stones'), false, 'no stones');
  assert.equal(walk(L(-4.5, 0, 48), { tol: 0.4 }), true, 'onto the stilling stone');
  wait(0.4);
  assert.ok(rt.logic.pressed('pS') && said(/glassy still/), 'the pool goes still');
  ball3.hit('push', ball3.dir.clone(), { strength: 1 });
  for (let i = 0; i < 14 / DT && !rt.logic.drumOn('ball3', 'p3'); i++) frame();
  for (let i = 0; i < 4 / DT && !ball3.rest; i++) frame();
  assert.ok(rt.logic.drumOn('ball3', 'p3'), `over the still water into its berth (${ball3.t.toFixed(2)})`);
  wait(2);
  assert.equal(rt.logic.isOpen('stones'), true, 'the stepping stones rise');
  assert.equal(walk(L(3.5, 0, 49)), true);
  wait(0.5);
  for (let i = 0; i < 4 / DT && !ball3.rest; i++) frame();
  assert.ok(rt.logic.drumOn('ball3', 'p3'), 'off the stone, the sphere stays in its berth');
  assert.equal(walk(L(3.5, 0, 72)), true, `over the stones (${where()})`);
  assert.ok(P.pos.y > L(0, -1, 0).y, 'not in the pool');
  // ---- the Lens Chamber: plain wall and floor, until you carry the lens
  assert.equal(walk(L(0, 0, 84)), true, `into the chamber (${where()})`);
  wait(0.2);
  assert.equal(rt.piece('mural').mesh.visible, false, 'no mural to see');
  assert.equal(rt.piece('br1').root.visible, false, 'no stones to see');
  assert.equal(rt.piece('p4').group.visible, false, 'no walker’s plate to see');
  items.grant('lens'); game.emit('box:opened', { id: 'spheres.temple.lens' });
  wait(0.2);
  assert.equal(rt.piece('mural').mesh.visible, true, 'through the lens: the walker’s print on the wall, and on the floor');
  assert.equal(walk(L(-10.6, 0, 86.6), { max: 4 }), false, 'the keepers’ door will not open from this side');
  // ---- the Hall of the Unseen: the stones only the lens shows; a print not the walker's crumbles
  const S = rt.piece('br1');
  const U0 = 97, row = (r) => S.cells.filter((c) => Math.abs(c.z - (U0 + 7.6 + r * 3.35)) < 0.1);
  assert.equal(walk(L(0, 0, 100)), true, `to the chasm (${where()})`);
  assert.equal(walk(L(-5, 0, 100.5)), true, `past the hall's mark (${where()})`);
  wait(0.5);
  assert.equal(rt.checkpoint?.room, 'unseen');
  assert.equal(S.root.visible, true, 'the stones show through the lens');
  const wrong = row(0).find((c) => !c.real);
  assert.ok(wrong.toes !== 3, 'a stone whose print has two or four toes');
  walk(L(wrong.x, 0, wrong.z), { tol: 0.5, max: 4 });
  wait(1.5);
  assert.ok(said(/not the walker’s/), `it crumbles under you (${where()})`);
  assert.ok(rt.kit.local(P.pos).z < 103, `and you are back at the mark (${where()})`);
  wait(4.5);
  // the walker's prints, row by row
  for (let r = 0; r < 6; r++) {
    const c = row(r).find((q) => q.real);
    assert.equal(c.toes, 3);
    assert.equal(walk(L(c.x, 0, c.z), { tol: 0.4, max: 6 }), true, `onto row ${r}'s walker’s stone (${where()})`);
    wait(0.5);
    assert.ok(P.pos.y > L(0, -0.6, 0).y, `it holds (${r})`);
  }
  assert.equal(walk(L(0, 0, 128.5)), true, `onto the far landing (${where()})`);
  // ---- the far landing: a plain print is nothing; the walker's, which only the lens shows, and the eye across the chasm
  const ball4 = rt.piece('ball4');
  const pushOn = () => { walk(ball4.group.position.clone().add(V(-2.4, 0, 0)), { tol: 0.8, max: 6 }); ball4.hit('push', ball4.dir.clone(), { strength: 1 }); for (let i = 0; i < 6 / DT && !(ball4.rest && i > 30); i++) frame(); };
  pushOn();
  assert.ok(rt.logic.drumOn('ball4', 'pf1'), `the sphere settles on the two-toed print (${ball4.t.toFixed(2)})`);
  assert.equal(rt.logic.isOpen('d4'), false, 'nothing');
  pushOn();
  assert.ok(rt.logic.drumOn('ball4', 'p4'), `then on the walker’s, which only the lens shows (${ball4.t.toFixed(2)})`);
  assert.equal(rt.logic.isOpen('d4'), false, 'the far door wants its eye too');
  assert.equal(rt.piece('s2').seen(), true, 'the eye high on the near wall, across the chasm');
  rt.piece('s2').hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d4'), true, 'the far door opens');
  // ---- the keepers' gallery: from the far landing round to the Lens Chamber; its eye on this side opens the door
  assert.equal(walk(L(-10.4, 0, 129)), true, `to the far landing's west door (${where()})`);
  assert.equal(walk(L(-13.8, 0, 129)), true, `into the gallery (${where()})`);
  assert.equal(walk(L(-13.8, 0, 86.6)), true, `down the gallery (${where()})`);
  assert.equal(rt.logic.isOpen('sc'), false);
  rt.piece('ssc').hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('sc'), true, 'the eye by the door wakes it');
  assert.equal(walk(L(-6, 0, 86.6)), true, `through it into the Lens Chamber (${where()})`);
  assert.equal(walk(L(-13.8, 0, 86.6)), true);
  assert.equal(walk(L(-13.8, 0, 129)), true);
  assert.equal(walk(L(-6, 0, 129)), true, `back on the far landing (${where()})`);
  assert.equal(walk(L(0, 0, 129.5)), true, `before the far door (${where()})`);
  // ---- the Echo's Hall: answer each note; through the lens the one that answers wears the walker's print
  assert.equal(walk(L(0, 0, 140)), true, `into the hall (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  for (let n = 0; n < 16 && G.state !== 'weary'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `it sings (${n})`);
    assert.ok(rt.sing >= 0, 'one sphere answers its note');
    wait(0.1);
    if (G.phaseIndex >= 1) assert.ok(rt.resonators[rt.sing].print.visible && rt.resonators.filter((r) => r.print.visible).length === 1, 'the walker’s print on the one that answers');
    if (G.phaseIndex >= 2) assert.ok(rt.resonators.every((r) => r.k > 0.3), 'its last phase: all three glow');
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
test('the Engine-House on foot: the valve and the ball in the pistons’ crank, the hammer jammed with the gantry’s ball, the chamber’s four still eyes a try, the passage’s pistons held up a room on, the furnace’s two cranks and the other two caught in turn, the Tooth-Warden on its jammed gear, the pipe-cart', () => {
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('buried');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };   // (as main.js: the moving colliders first)
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const said = (re) => notes.some((n) => re.test(n));
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
  /** Splash each eye of a bank as it comes up, for s seconds (or until it wakes): the eyes hit and when. */
  const catchAsTheyRise = (bank, s, only = [0, 1, 2, 3]) => {
    const last = [-9, -9, -9, -9];
    for (let i = 0; i < s / DT && !rt.logic.isLit(bank.id); i++) {
      frame();
      for (const j of only) if (bank.isUp(j) && bank.time - last[j] > 2.7) { bank.hit(j); last[j] = bank.time; }
    }
    return rt.logic.isLit(bank.id);
  };
  wait(0.5);
  // ---- the Piston Hall: the valve hisses, but a ball sits in the pistons' crank: they stay still
  const pistons = rt.pieces.filter((p) => p.path);
  wait(2);
  const still = () => pistons.every((p) => p.s === p.o.phase * p.total || p.s === 0 || p.s === p.total);
  assert.ok(still(), 'still until the valve opens');
  rt.piece('s1').hit('shoot');
  wait(3);
  assert.equal(rt.logic.isOpen('pumps'), false, 'the valve alone does not run them');
  assert.ok(still(), 'they shudder and stay where they are');
  assert.ok(said(/teeth of their crank/), 'and it says why');
  // roll the ball out of the teeth: they run; back in, they stop where they are; out again
  const ball0 = rt.piece('ball0');
  assert.equal(roll(ball0, -1, () => rt.logic.drumOn('ball0', 'pY')), true, `out of the teeth (${ball0.t.toFixed(2)})`);
  wait(0.2);
  assert.equal(rt.logic.isOpen('pumps'), true, 'out of the teeth: the pistons run');
  wait(2);
  assert.ok(!still(), 'they rise and fall');
  assert.equal(roll(ball0, 1, () => rt.logic.drumOn('ball0', 'pZ')), true, 'rolled back in');
  const at0 = pistons.map((p) => p.s);
  wait(2);
  assert.deepEqual(pistons.map((p) => p.s), at0, 'jammed again, they stop where they are');
  assert.equal(roll(ball0, -1, () => rt.logic.drumOn('ball0', 'pY')), true, 'and out again');
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
  // ---- the Crank Hall: the hammer over the walkway throws you off; the gantry's ball rolled into its crank stops it
  const hammer = rt.piece('h1');
  assert.equal(walk(L(0, 7, 50)), true, `to the walkway (${where()})`);
  for (let i = 0; i < 6 / DT && hammer.down > 0.05; i++) frame();
  let thrown = false;
  for (let i = 0; i < 8 / DT && !thrown; i++) { frame({ KeyW: true }, toward(L(0, 7, 60))); thrown = !!P.down || said(/throws you off/); }
  assert.ok(thrown, `the hammer throws you off the walkway (${where()})`);
  for (let i = 0; i < 6 / DT && (P.down || rt.kit.local(P.pos).y < 6); i++) frame();
  const ballJ = rt.piece('ballJ');
  assert.equal(roll(ballJ, 1, () => rt.logic.drumOn('ballJ', 'pJ')), true, `the ball down the groove into the crank's teeth (${ballJ.t.toFixed(2)})`);
  wait(2.6);
  assert.equal(rt.logic.isOpen('h1'), true, 'jammed');
  assert.ok(hammer.down < 0.01, 'the hammer hangs up, still');
  const ph = hammer.phase;
  wait(1);
  assert.equal(hammer.phase, ph, 'and stays there');
  P.teleport(L(0, 7.1, 49.5), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  assert.equal(walk(L(0, 7, 60), { run: false }), true, `over the walkway under the still hammer (${where()})`);
  // ---- the Fourth Chamber: the chest; its way on is open, four still eyes on its wall a try
  assert.equal(walk(L(0, 7, 70)), true, `into the chamber (${where()})`);
  const k0 = rt.piece('k0');
  for (let i = 0; i < 4; i++) k0.hit(i);
  assert.equal(rt.logic.isLit('k0'), false, 'four still eyes in a breath: the starting bar holds three');
  assert.ok(said(/bar holds three/), 'and it says so');
  items.grant('cell'); game.emit('box:opened', { id: 'buried.temple.cell' });
  wait(3);
  for (let i = 0; i < 4; i++) k0.hit(i);
  assert.equal(rt.logic.isLit('k0'), true, 'with the fourth chamber, four in a breath');
  assert.equal(rt.logic.isOpen('d3'), false, 'nothing waits on them: the door is a room on');
  // ---- the Crank Passage: four eyes on pistons that rise in turn; one crank holds them all up
  assert.equal(walk(L(0, 7, 88)) && walk(L(0, 7, 93)), true, `through the open way into the passage (${where()})`);
  assert.equal(walk(L(0, 7, 102), { max: 4 }), false, 'the passage’s door is shut');
  walk(L(0, 7, 93));
  const bank = rt.piece('k1');
  wait(3);
  assert.equal(catchAsTheyRise(bank, 10), false, 'caught as they rise, never four in one breath');
  const bK = rt.piece('bK');
  assert.equal(roll(bK, 1, () => rt.logic.drumOn('bK', 'pK')), true, 'the ball into the crank');
  wait(1);
  assert.ok([0, 1, 2, 3].every((i) => bank.isUp(i)), 'all four stand up together');
  wait(3);
  for (let i = 0; i < 4; i++) bank.hit(i);
  assert.equal(rt.logic.isLit('k1'), true, 'four in a breath, with the fourth chamber');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d3'), true);
  // ---- the Furnace: two cranks for the two west pistons; jam those, and catch the other two as they rise in turn
  assert.equal(walk(L(0, 7, 105.2)), true, `to the furnace (${where()})`);
  const k2 = rt.piece('k2'), bA = rt.piece('bA'), bB = rt.piece('bB');
  assert.equal(roll(bA, 1, () => rt.logic.drumOn('bA', 'pA')), true, 'one crank jammed');
  assert.equal(catchAsTheyRise(k2, 10), false, 'one piston held up is not enough: the other three rise too far apart');
  assert.equal(roll(bB, 1, () => rt.logic.drumOn('bB', 'pB')), true, 'the second crank jammed');
  wait(1);
  assert.ok(k2.isUp(0) && k2.isUp(1), 'the two west eyes stand up');
  assert.equal(catchAsTheyRise(k2, 10), true, 'the other two caught one after the other: four in one breath');
  wait(3.5);
  assert.equal(walk(L(0, 7, 105.2)), true, `to the bridge's foot (${where()})`);
  assert.equal(walk(L(0, 7, 129.2)), true, `over the bridge (${where()})`);
  assert.ok(P.pos.y > L(0, 6, 0).y, 'over it, not in the furnace');
  // ---- the Tooth-Warden: four vents in a breath; then on its gear
  assert.equal(walk(L(0, 7, 143.2)), true, `into the hall (${where()})`);
  const G = rt.guardian, bG = rt.piece('bG');
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  const opening = () => { for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') return true; } return false; };
  let stamped = false, turned = false;
  for (let n = 0; n < 12 && G.state !== 'resolved'; n++) {
    assert.ok(opening(), `its vents open (${n}, phase ${G.phaseIndex})`);
    if (n === 0) { rt.volley(0); rt.volley(1); assert.equal(G.meter, 0, 'two vents are nothing'); }
    if (G.phaseIndex === 1 && !rt.gearJammed()) {
      // the second phase: free, a volley counts as before; then the gear jammed, twice
      const m = G.meter;
      for (let i = 0; i < 4; i++) rt.volley(i);
      assert.ok(Math.abs(G.meter - m - 0.125) < 1e-6, `the gear free: a volley as before (${(G.meter - m).toFixed(3)})`);
      roll(bG, 1, () => rt.logic.drumOn('bG', 'pG'));
      assert.equal(rt.gearJammed(), true, 'the ball in the gear’s teeth');
      continue;
    }
    if (G.phaseIndex === 2 && !turned) {
      stamped = said(/jumps out of its teeth/);
      assert.ok(stamped, 'shifting into its last phase it stamps the ball out of the gear');
      assert.equal(rt.gearJammed(), false);
      // the failure: it turns as it opens, one vent at a time: the four in a breath can't be done
      turned = true;
      const m = G.meter;
      for (let i = 0; i < 4; i++) rt.volley(i);
      assert.equal(G.meter, m, 'one vent faces out at a time: nothing');
      assert.ok(said(/turned away/), 'and it says why');
      roll(bG, 1, () => rt.logic.drumOn('bG', 'pG'));
      assert.equal(rt.gearJammed(), true, 'rolled back into the teeth');
      continue;
    }
    const m = G.meter;
    for (let i = 0; i < 4; i++) rt.volley(i);
    if (G.phaseIndex >= 1 || G.meter > 0.5) assert.ok(G.meter > m, `a volley takes (${n})`);
  }
  assert.equal(G.state, 'resolved', `stopped (${G.meter})`);
  assert.ok(turned, 'the last phase was met');
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
test('the Lamp-House on foot: three dark pools (the third up the roots, out of sight), the moss-stones the orb’s lamp wakes over the dark pool and the root-wall, the lantern, its try by the dais, the passage’s lamp a room on, the stones only its light shows, the pool-orb lit and rolled to the niche, the Lampless fed, the lamp lit', () => {
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('perdide2');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };   // (as main.js: the moving colliders first)
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
  // ---- the Hall of Dark Pools: two pools on the floor; the third up on the loft, hidden from the floor
  const seen = (from, to) => { const d = to.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.8; };
  const eye3 = rt.piece('s3').center;
  for (const [x, z] of [[-3, 22], [6, 30], [0, 40]]) assert.ok(!seen(L(x, 1.7, z), eye3), `the loft's pool hidden from the floor (${x}, ${z})`);
  for (const id of ['s1', 's2']) rt.piece(id).hit('shoot');
  wait(1);
  assert.equal(rt.logic.isOpen('d1'), false, 'two lamps of three');
  // the small pool-orb's groove runs through the shut door: it stops at the door
  { const o5 = rt.piece('orb5'); walk(o5.center.clone().addScaledVector(o5.dir, -2.2).setY(L(0, 0, 0).y), { tol: 0.5 });
    for (let k = 0; k < 3; k++) { o5.hit('push', o5.dir.clone(), { strength: 1 }); wait(2.5); }
    assert.ok(o5.t <= 0.48 && !o5.drop, `stopped at the shut door (${o5.t.toFixed(2)})`);
    for (let k = 0; k < 6 && o5.t > 0.05; k++) { walk(o5.center.clone().addScaledVector(o5.dir, o5.r + 1.3).setY(L(0, 0, 0).y), { tol: 0.5, max: 6 }); o5.hit('push', o5.dir.clone().negate(), { strength: 1 }); wait(2.2); } }
  // up the west roots to the loft
  assert.equal(walk(L(0, 0, 16)) && walk(L(-4.6, 0, 20)), true, `to the loft's foot (${where()})`);
  let loft = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(-9, 8, 20))); if (P.onGround && rt.kit.local(P.pos).y > 7.6) { loft = true; break; } }
  assert.ok(loft, `up onto the loft (${where()})`);
  assert.ok(seen(P.pos.clone().add(V(0, 1.6, 0)), eye3), 'there it is');
  rt.piece('s3').hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true);
  P.teleport(L(0, 0.05, 40), V(0, 1, 0), V(0, 0, 1));
  wait(0.5);
  // ---- the Root Stair: the moss-stones lie sunk in the dark pool, waiting for the lamp in their socket; only light wakes it
  assert.equal(walk(L(-1, 0, 48.5)), true, `to the stair (${where()})`);
  assert.equal(rt.pieces.filter((p) => p.path).length, 0, 'no riding disc in the Lamp-House');
  const moss = rt.piece('disc');
  wait(3);
  assert.equal(moss.open, false, 'the moss-stones are sunk and dark');
  assert.equal(walk(L(0, 0, 59.5), { max: 4 }), false, 'no way over the pool');
  P.teleport(L(-1, 0.05, 48.5), V(0, 1, 0), V(0, 0, 1)); wait(0.3);
  // the pool-orb by the small pool, back in the hall: rolled through dark, it wakes nothing, and is tipped back
  const orb5 = rt.piece('orb5');
  const behind5 = () => orb5.center.clone().addScaledVector(orb5.dir, -(orb5.r + 1.3)).setY(L(0, 0, 0).y);
  const roll5 = () => { for (let k = 0; k < 8 && !rt.logic.drumOn('orb5', 'p5'); k++) { walk(behind5(), { tol: 0.5, max: 6 }); orb5.hit('push', orb5.dir.clone(), { strength: 1 }); for (let i = 0; i < 5 / DT && !orb5.rest; i++) frame(); } };
  roll5();
  assert.equal(rt.logic.drumOn('orb5', 'p5'), true, `the dark orb in the socket (${orb5.t.toFixed(2)} ${rt.logic.drumT('orb5')} ${orb5.rest} ${orb5.v} ${where()})`);
  wait(1);
  assert.equal(rt.logic.isLit('l5'), false, 'dark, it wakes nothing');
  assert.ok(notes.some((s) => /disc’s lamp wants light/.test(s)), 'it says the lamp wants light');
  wait(5);
  assert.ok(orb5.t < 0.5, `tipped back out (${orb5.t.toFixed(2)})`);
  for (let k = 0; k < 6 && orb5.t > 0.05; k++) { walk(orb5.center.clone().addScaledVector(orb5.dir, orb5.r + 1.3).setY(L(0, 0, 0).y), { tol: 0.5, max: 6 }); orb5.hit('push', orb5.dir.clone().negate(), { strength: 1 }); wait(2.2); }
  assert.ok(orb5.t < 0.1, `back by the small pool (${orb5.t.toFixed(2)})`);
  // light the small pool: at rest beside it, the orb drinks its light; then roll it through before it fades
  rt.piece('s5').hit('shoot');
  wait(2.6);
  assert.ok(orb5.charge > 0, 'it caught the pool’s light');
  roll5();
  wait(0.5);
  assert.equal(rt.logic.isLit('l5'), true, 'the glowing orb wakes the disc’s lamp');
  assert.equal(rt.logic.isOpen('disc'), true, 'the moss-stones wake');
  wait(2);
  assert.equal(walk(L(-1, 0, 48.5)), true, `to the stair again (${where()})`);
  assert.equal(walk(L(0, 0, 59.6), { tol: 0.6 }), true, `over the glowing moss-stones (${where()})`);
  assert.ok(P.pos.y > L(0, -0.5, 0).y, 'on them, not in the pool');
  let up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(0, 9, 66))); if (P.onGround && rt.kit.local(P.pos).y > 8.5) { up = true; break; } }
  assert.ok(up, `up the root-wall (${where()})`);
  // ---- the Lantern Chamber: the chest; its way on is open, and the lamp by the dais is a try
  assert.equal(walk(L(0, 9, 75)), true, `into the chamber (${where()})`);
  assert.equal(walk(L(-5.4, 9, 79.8 + 2), { tol: 0.8 }), true, `by the chamber's lamp (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.isLit('l0'), false, 'nothing without the lantern');
  items.grant('lantern'); game.emit('box:opened', { id: 'perdide2.temple.lantern' });
  wait(2.5);
  assert.equal(rt.logic.isLit('l0'), true, 'it wakes to the lantern');
  assert.equal(rt.logic.isOpen('d2'), false, 'and nothing waits on it: the door is a room on');
  // ---- the Lamp Passage: the door into the gallery is a lamp at the passage's far end
  assert.equal(walk(L(0, 9, 96)), true, `through the open way into the passage (${where()})`);
  assert.equal(walk(L(-1.5, 9, 101.2), { tol: 0.6 }), true, `to the passage's door (${where()})`);
  wait(2);
  assert.equal(rt.logic.isOpen('d2'), false, 'the passage’s door is shut');
  assert.equal(walk(L(3.6, 9, 101.3), { tol: 0.8 }), true, `by its lamp (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.isLit('l1'), true, 'it wakes to the lantern');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d2'), true);
  // ---- the Dark Gallery: the moss-stones the lantern shows; the eye; the second lamp
  assert.equal(walk(L(0, 9, 106.2)), true, `to the chasm (${where()})`);
  wait(2);
  assert.equal(walk(L(0, 9, 131.2)), true, `over the moss-stones (${where()})`);
  assert.ok(P.pos.y > L(0, 8, 0).y, 'on them, not in the chasm');
  rt.piece('s4').hit('shoot');
  // the pool-orb: rolled into the niche dark, it wakes nothing
  const orb = rt.piece('orb');
  const behind = () => orb.center.clone().addScaledVector(orb.dir, -(orb.r + 1.3)).setY(L(0, 9, 0).y);
  const roll = () => { for (let k = 0; k < 6 && !rt.logic.drumOn('orb', 'p4'); k++) { walk(behind(), { tol: 0.5, max: 4 }); orb.hit('push', orb.dir.clone(), { strength: 1 }); wait(2.4); } };
  assert.ok(P.pos.distanceTo(orb.center) > 4, 'not standing by the orb yet');
  roll();
  assert.equal(rt.logic.drumOn('orb', 'p4'), true, `the orb in the niche (${orb.t.toFixed(2)})`);
  wait(1);
  assert.equal(rt.logic.isLit('l2'), false, 'dark, it wakes nothing');
  assert.ok(notes.some((s) => /dark/.test(s)), 'it says the lamp wants light');
  assert.equal(rt.logic.isOpen('d4'), false);
  // the niche tips it back out; lit by the lantern first, then rolled in again
  wait(7);
  assert.ok(orb.t < 0.4 && orb.rest, `rolled back out (${orb.t.toFixed(2)})`);
  assert.equal(walk(orb.center.clone().setY(L(0, 9, 0).y).add(V(1.6, 0, 0)), { tol: 0.6 }), true, `by the orb (${where()})`);
  wait(2.4);
  assert.ok(orb.charge > 0, 'it caught the lantern’s light');
  roll();
  wait(1);
  assert.equal(rt.logic.isLit('l2'), true, 'glowing, it wakes the niche’s lamp');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d4'), true);
  // ---- the Lamp-Room: stand still by the Lampless while it searches
  assert.equal(walk(L(0, 9, 136.2)) && walk(L(0, 9, 145.2)), true, `into the lamp-room (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  // (in its last phase it shies from you: a pool lit earlier lures it down, and it drinks there while you stand back;
  // tests/guardian-twists.test.js plays it through, failures and all)
  const lure = rt.lurePools.list[0];
  for (let n = 0; n < 12 && G.state !== 'weary'; n++) {
    if (G.phaseIndex >= 2 && !lure.lit) {
      P.teleport(lure.at.clone().add(V(1, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
      for (let i = 0; i < 3 / DT && !lure.lit; i++) frame();
      assert.ok(lure.lit, 'your lantern held by a pool lights it');
    }
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `it hangs low, searching (${n})`);
    const before = G.meter;
    if (G.phaseIndex >= 2) P.teleport(lure.at.clone().setY(L(0, 9, 0).y).add(V(lure.at.x > L(0, 9, 148).x ? -9 : 9, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
    else P.teleport(G.model.pos.clone().setY(L(0, 9, 0).y).add(V(4, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
    for (let i = 0; i < 8 / DT && G.meter === before && G.state === 'open'; i++) frame();
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

test('a rotunda’s oculus trim is solid where it lies on the ceiling, and the oculus is as wide to the collision as it is open', () => {
  const scene = new THREE.Scene(), root = new THREE.Group();
  scene.add(root);
  const mat = new THREE.MeshBasicMaterial(), M = new Proxy({}, { get: () => mat });
  const K = new TempleKit(root, 'test rotunda', new THREE.Vector3(), 0, M);
  const r = 10, h = 12, oc = 0.4;
  K.rotunda({ x: 0, z: 0, y: 0, r, h, oculus: oc });
  K.flush();
  const physics = new Physics(scene);
  const floor = physics.groundAt(0.3, h - 1, 0.2, 20);
  for (let a = 0; a < Math.PI * 2; a += 0.29) {
    const c = Math.cos(a), sn = Math.sin(a);
    // dropped through the oculus anywhere in its opening, to the trim's drawn lip: the floor
    for (const rr of [0.5, r * oc - 0.4, r * oc - 0.05]) assert.ok(Math.abs(physics.groundAt(c * rr, h + 20, sn * rr, 60) - floor) < 0.05, `through the oculus at ${rr.toFixed(2)} m out`);
    // on the trim, where it lies on the ceiling: its drawn top, 1.1 m over the ceiling's foot
    assert.ok(Math.abs(physics.groundAt(c * (r * oc + 0.2), h + 20, sn * (r * oc + 0.2), 60) - (h + 1.1)) < 0.05, 'on the trim');
  }
});

test('a shut gate of jaws collides as its two halves are drawn, snapping with them, and its slot keeps the way when they gape', () => {
  const { physics, rt } = world('perdide');
  const jaw = rt.pieces.find((p) => p.halves && p.id === 'd2');
  const wasOpen = jaw.open;
  if (wasOpen) jaw.setOpen(false, true);
  try {
    assert.equal(jaw.movers.length, 2, 'two moving halves');
    const ray = new THREE.Raycaster(), inv = jaw.group.matrixWorld.clone().invert();
    const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(jaw.group.matrixWorld);
    for (const ang of [0.12, 0.3, 0.5]) {
      for (const { g, side } of jaw.halves) g.rotation.y = side * ang;
      jaw.group.updateMatrixWorld(true);
      physics.syncMovers(1 / 60);
      let n = 0, worst = 0, gape = 0;
      // from the side you come at them (-z, the gallery), straight at the gate's plane (inside its jambs)
      for (let x = -1.8; x <= 1.8; x += 0.3) for (let y = 0.8; y <= jaw.h - 0.8; y += 0.8) {
        const o = toWorld(x, y, -4), d = toWorld(x, y, 0).sub(o).normalize();
        ray.set(o, d); ray.far = 8;
        const drawn = ray.intersectObject(jaw.group, true)[0];
        const hit = physics.rayHit(o, d, 8);
        const atSlot = hit && !hit.mover && Math.abs(new THREE.Vector3().copy(hit.point).applyMatrix4(inv).z) < 0.1;
        if (!drawn) { assert.ok(atSlot, `ang ${ang}: through the gape at x ${x.toFixed(1)}, y ${y.toFixed(1)} the slot stops you`); continue; }
        if (atSlot && hit.distance <= drawn.distance + 0.05) { gape++; continue; }   // (the slot, in the gape, before the inside of a half)
        n++;
        worst = Math.max(worst, hit ? Math.abs(hit.distance - drawn.distance) : 8);
      }
      assert.ok(n > 25 && worst < 0.05, `ang ${ang}: ${n} rays, the collision off the drawn halves by up to ${worst.toFixed(2)} m`);
      if (ang >= 0.3) assert.ok(gape > 0, `ang ${ang}: the slot meets rays through the gape`);
    }
  } finally { if (wasOpen) jaw.setOpen(true, true); }
});

test('the Hush-House on foot: the crystals sung low to high (the first by the door), the climbing disc and the eye on the root-wall, the stilling mode, the gate of jaws a room on, the pendulums stilled in turn, the Mother Snapper stilled, the swamp in flower', () => {
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('perdide');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit ?? 1900 });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };   // (as main.js: the moving colliders first)
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const seen = (from, to) => { const d = to.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.8; };
  wait(0.5);
  // ---- the Choir: its lowest crystal rings flat, and says where the first note was sung: at the door
  assert.equal(walk(L(0, 0, 20)), true, `into the Choir (${where()})`);
  rt.piece('c2').hit('shoot');
  assert.equal(rt.logic.isLit('c2'), false, 'not before the first note');
  assert.ok(notes.some((s) => /at the door/.test(s)), 'it says where the first note is');
  rt.piece('c3').hit('shoot');
  assert.equal(rt.logic.isLit('c3'), false, 'nor out of turn');
  assert.equal(walk(L(2.5, 0, 6.5)), true, `back to the door's crystal (${where()})`);
  rt.piece('c1').hit('shoot');
  assert.equal(walk(L(0, 0, 30)), true, `into the Choir again (${where()})`);
  for (const id of ['c2', 'c3', 'c4']) rt.piece(id).hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true);
  // ---- the Bog Well: the disc that climbs over the dark water, then up the root-wall
  assert.equal(walk(L(0, 0, 49)), true, `to the well (${where()})`);
  const disc = rt.pieces.find((p) => p.path);
  for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.6); i++) frame();
  assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 4 }), true, `onto the disc (${where()})`);
  for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
  assert.ok(rt.kit.local(P.pos).y > 2.5, `carried up on it (${where()})`);
  // the door at the top is shut; its eye is on the root-wall's face, in sight from the disc, not from the top
  const eye = rt.piece('sw').center;
  assert.ok(seen(P.pos.clone().add(V(0, 1.6, 0)), eye), 'the eye seen from the disc');
  assert.ok(!seen(L(-0.8, 10.7, 57.2 + 6.7), eye), 'not from the top of the wall');
  assert.equal(rt.logic.isOpen('dw'), false);
  rt.piece('sw').hit('shoot');
  wait(0.2);
  let up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(0, 9, 66))); if (P.onGround && rt.kit.local(P.pos).y > 8.5) { up = true; break; } }
  assert.ok(up, `up the root-wall (${where()})`);
  assert.equal(rt.logic.isOpen('dw'), true, 'the door at the top is open');
  // ---- the Stilling Chamber: the chest; its way on is open
  assert.equal(walk(L(0, 9, 75)), true, `into the chamber (${where()})`);
  items.grant('stun'); game.emit('box:opened', { id: 'perdide.temple.stun' });
  assert.equal(rt.logic.gadget, true);
  // ---- the Snapping Passage, a room on: the gate of jaws snaps at plain fluid and will not let you by
  assert.equal(walk(L(0, 9, 95)), true, `through the open way into the passage (${where()})`);
  rt.piece('d2').hit('shoot');
  assert.equal(walk(L(0, 9, 105.2), { max: 4 }), false, 'the jaws keep the way');
  assert.ok(rt.kit.local(P.pos).z < 102.2, `not through them (${where()})`);
  rt.piece('d2').hit('stun');
  wait(2.6);
  assert.equal(rt.logic.isOpen('d2'), true, 'stilled, they rest open');
  // ---- the Pendulum Gallery: a pendulum knocks you off the bridge; stilled, they let you by
  assert.equal(walk(L(0, 9, 106.7)), true, `to the bridge (${where()})`);
  const swings = rt.pieces.filter((p) => p.len && p.arm && p.id);   // (the gallery's: the Mother's three hang in her hall)
  assert.equal(swings.length, 3);
  P.teleport(L(0, 9.05, rt.kit.local(swings[0].group.position).z), V(0, 1, 0), V(0, 0, 1));
  let knocked = false;
  for (let i = 0; i < 4 / DT && !knocked; i++) { frame(); knocked = !!P.down; }
  assert.ok(knocked, `a pendulum knocks you off (${where()})`);
  for (let i = 0; i < 10 / DT && (P.down || P.dead); i++) frame();
  wait(1.5);
  P.teleport(L(0, 9.05, 107.7), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  // the keeper's ledge along the east wall: its gate is shut from this side
  assert.equal(walk(L(10, 9, 107.7)), true, `to the ledge's gate (${where()})`);
  assert.equal(walk(L(10, 9, 123.2), { max: 3 }), false, 'the gate holds');
  assert.ok(rt.kit.local(P.pos).z < 103.9 + 6.4 && rt.kit.local(P.pos).x > 7.5 && rt.kit.local(P.pos).y > 8.5, `still this side of it, at the gate (${where()})`);
  assert.equal(walk(L(0, 9, 107.7)), true, `back to the bridge (${where()})`);
  // stilled near to far to cross: the walk stills them out of turn, and only the smallest's note takes
  for (const s of swings) s.hit('stun');
  assert.equal(walk(L(0, 9, 133.2), { max: 6 }), true, `over the bridge between the stilled pendulums (${where()})`);
  assert.ok(rt.kit.local(P.pos).y > 8, 'on it, not in the chasm');
  assert.deepEqual(['w1', 'w2', 'w3'].map((id) => rt.logic.isLit(id)), [true, false, false], 'only the smallest crystal took');
  assert.ok(notes.some((s) => /smallest crystal first/.test(s)), 'the others rang flat, and say why');
  wait(1);
  assert.equal(rt.logic.isOpen('d3'), false, 'the far door wants all three notes');
  // from the far side, again, in turn: middle-sized, then the biggest
  for (const id of ['w2', 'w3']) rt.piece(id).hit('stun');
  wait(2.6);
  assert.equal(rt.logic.isOpen('d3'), true);
  // the shortcut: along the ledge from this side, onto the gate's footstone, and the way back is a walk
  assert.equal(walk(L(9.9, 9, 129.2)) && walk(L(9.9, 9, 111.8), { tol: 0.4 }), true, `along the ledge to the footstone (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('ds'), true, 'the gate opens from behind');
  wait(2.2);
  assert.equal(walk(L(9.9, 9, 107.2)), true, `through it to the near landing (${where()})`);
  wait(0.5);
  assert.equal(rt.logic.isOpen('ds'), true, 'and stays open');
  assert.equal(walk(L(9.9, 9, 111.2)) && walk(L(9.9, 9, 129.2)) && walk(L(0, 9, 133.2)), true, `back along it (${where()})`);
  assert.ok(rt.kit.local(P.pos).y > 8, 'on the far landing');
  // ---- the Mother's Hall: still her when she lies spent; later, mid-strike
  assert.equal(walk(L(0, 9, 145.2)), true, `into the hall (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  const before0 = G.meter;
  G.hit('mouth', 'shoot');
  assert.equal(G.meter, before0, 'plain fluid only startles her');
  let mid = 0;
  // (in her last phase the cold no longer eases her: the crystals over her, stilled smallest first; tests/guardian-twists)
  const crystal = (rank) => rt.motherCrystals.list.find((s) => s.o.rank === rank);
  for (let n = 0; n < 16 && G.state !== 'weary'; n++) {
    if (G.phaseIndex >= 2) {
      const before = G.meter;
      for (const r of [0, 1, 2]) crystal(r).hit('stun');
      assert.ok(G.meter > before, `the crystals in turn calm her (${G.meter.toFixed(2)})`);
      continue;
    }
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

test('the Aerie on foot: the gusts waited out behind the screens, the stone pushed up the hall into its vent (the hall falls calm, the wind rises in the well), the feather raft, the wings, the column, the gulf vent’s stone rolled out of its throat and the gust that carries you to the perch, the perch’s stone and the column up to the higher ledge, the Elder flown with in the wind, the birds come back', () => {
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('arzach');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit ?? 1900 });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };   // (as main.js: the moving colliders first)
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const local = () => rt.kit.local(P.pos);
  const said = (re) => notes.some((n) => re.test(n));
  const stand = (x, y, z) => { P.teleport(L(x, y + 0.05, z), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0); };
  /** Push a ball along its groove (way +1: toward its b end) until it rests on `plate`. */
  const roll = (id, plate, way = 1, n = 12, between = () => {}) => {
    const ball = rt.piece(id);
    for (let k = 0; k < n && !rt.logic.drumOn(id, plate); k++) {
      between();
      const d = ball.dir.clone().multiplyScalar(way);
      walk(ball.center.clone().addScaledVector(d, -2.3).setY(P.pos.y), { tol: 0.5, max: 4 });
      ball.hit('push', d, { strength: 1 });
      wait(2.4);
    }
    return rt.logic.drumOn(id, plate);
  };
  /** Glide (the wings open, heading h) until on the ground or fallen to a pit's mark; returns where it ended. */
  const glide = (h, s = 12, held = () => true) => {
    for (let i = 0; i < s / DT; i++) {
      const z = local().z;
      P.heading = h; frame(held() ? { Space: true } : {});
      if (Math.abs(local().z - z) > 5) { wait(1); break; }   // (fell in, and back at the mark)
      if (P.onGround && i > 10) break;
    }
    return local();
  };
  wait(0.5);
  // ---- the Hall of Winds: in the open a gust shoves you back; screen to screen, in the calms, you get through
  const gust = rt.pieces.find((p) => p.shelters);
  const calmStart = () => { for (let i = 0; i < 12 / DT; i++) { const before = gust.state; frame(); if (before === 1 && gust.state === 0) return true; } return false; };
  stand(0, 0, 26);
  for (let i = 0; i < 6 / DT && gust.state !== 1; i++) frame();
  const z0 = local().z;
  for (let i = 0; i < 1.2 / DT; i++) frame({ KeyW: true, ShiftLeft: true }, toward(L(0, 0, 50)));
  assert.ok(local().z < z0 - 2, `the gust shoves you back (${z0.toFixed(1)} -> ${where()})`);
  stand(0, 0, 10);
  for (const legs of [[[4.2, 20.4]], [[0, 23.2], [-4.2, 29.4]], [[0, 32.2], [4.2, 38.4]], [[0, 41.2], [0, 50]]]) {
    assert.ok(calmStart(), 'a calm');
    const t0 = t;
    for (const [x, z] of legs) assert.equal(walk(L(x, 0, z), { tol: 0.7, max: 3 }), true, `to the next screen in the calm (${where()})`);
    assert.ok(t - t0 < 3.2, `inside one calm (${(t - t0).toFixed(1)} s)`);
  }
  // the well beyond: still air, the raft on the floor
  assert.equal(walk(L(0, 0, 62)), true, `into the well (${where()})`);
  const raft = rt.piece('raft'), r0 = raft.s;
  wait(3);
  assert.equal(raft.s, r0, 'in still air the raft lies on the floor');
  assert.equal(rt.logic.isOpen('raft'), false);
  // the stone, too heavy for the gusts, pushed up the hall into its vent a push at a time (in the calms)
  stand(-1.5, 0, 13);
  assert.equal(roll('ballW', 'pH', 1, 16, () => calmStart()), true, `the stone in the hall's vent (${where()})`);
  wait(gust.calm + gust.blow + 0.5);
  assert.equal(gust.state, 0, 'the hall falls calm');
  // ---- the Wind Well: the wind rises; the raft rides it up to the Wing Chamber's balcony
  const column = rt.pieces.find((p) => p.lift && p.o.when?.drumOn?.[0] === 'ballW');
  assert.equal(column.on, true, 'the wind rises in the well');
  assert.equal(walk(L(4, 0, 66)), true, `back in the well (${where()})`);
  for (let i = 0; i < 30 / DT && !(raft.s < 0.2 && raft.wait > 0.8); i++) frame();
  assert.equal(walk(raft.group.position, { tol: 0.5, run: false, max: 4 }), true, `onto the raft (${where()})`);
  for (let i = 0; i < 30 / DT && !(raft.s > raft.total - 0.2); i++) frame();
  assert.ok(local().y > 15.5, `carried up (${where()})`);
  assert.equal(walk(L(11.6, 16, 68), { tol: 0.8 }), true, `onto the balcony (${where()})`);
  assert.equal(walk(L(20.6, 16, 68)), true, `into the wing chamber (${where()})`);
  items.grant('glider'); game.emit('box:opened', { id: 'arzach.temple.glider' });
  assert.equal(rt.logic.gadget, true);
  // ---- the column: off the balcony with the wings open, round and up to the high balcony
  assert.equal(walk(L(11.4, 16, 68), { tol: 0.6 }), true, `back on the balcony (${where()})`);
  let top = false;
  for (let i = 0; i < 20 / DT; i++) { P.heading = -Math.PI / 2; frame({ Space: true, KeyW: i < 20 }, -Math.PI / 2); if (local().y > 33.2) { top = true; break; } }
  assert.ok(top, `lifted up the well (${where()})`);
  assert.ok(Math.abs(glide(0, 6, () => local().z < 76.5).y - 32) < 0.6 && local().z > 75, `onto the high balcony (${where()})`);
  assert.equal(walk(L(4.6, 32, 79.2), { tol: 0.8 }), true, `past its mark (${where()})`);
  // ---- the Gulf: on still air the perch is too far
  assert.equal(walk(L(0, 32, 85.6)), true, `to the gulf (${where()})`);
  assert.equal(walk(L(6.5, 32, 86.6), { tol: 0.8 }), true, `past the mark (${where()})`);
  stand(0, 32, 88.6);
  const tail = rt.pieces.find((p) => p.o?.carry);
  assert.equal(tail.on, false, 'the gulf’s air is still');
  for (let i = 0; i < 0.5 / DT; i++) frame({ KeyW: true, ShiftLeft: true }, 0);
  let end = glide(0, 8);
  assert.ok(end.z < 85 || end.y > 30 && end.z < 92, `on still air you fall short, and are back at the mark (${where()})`);
  // the vent's stone, up on the balcony: rolled out of its throat, the gusts pour over the gulf
  assert.equal(walk(L(0, 32, 86.2), { max: 6 }), true, `to the gulf's door (${where()})`);
  assert.equal(walk(L(0, 32, 79), { max: 12 }), true, `back to the balcony (${where()})`);
  assert.equal(walk(L(-5.9, 32, 77.4), { max: 4 }), true, `round the stone (${where()})`);
  assert.equal(roll('ballB', 'pX', 1), true, `the stone out of the throat (${where()})`);
  assert.equal(tail.on, true, 'the gulf’s vent blows');
  assert.equal(walk(L(0, 32, 85.6), { max: 12 }), true, `to the gulf again (${where()})`);
  stand(0, 32, 88.6);
  for (let i = 0; i < 12 / DT && !(tail.state === 1 && tail.t % (tail.calm + tail.blow) < tail.calm + 0.15); i++) frame();
  for (let i = 0; i < 0.3 / DT; i++) frame({ KeyW: true, ShiftLeft: true }, 0);
  const pz = rt.kit.local(rt.piece('ballP').a).z;
  end = glide(0, 8, () => local().z < pz - 3);   // (the wings folded over the perch: down onto it)
  assert.ok(P.onGround && Math.abs(end.y - GULF.perchY) < 0.6, `the gust carries you to the perch (${where()})`);
  assert.ok(said(/carries you/), 'it says so');
  // ---- the perch: a ledge higher than it, no glide climbs; its stone out of the column's throat, the column lifts you
  wait(0.5);
  for (const [x, z] of [[3.6, pz + 2.2], [3.8, pz - 2.6], [0.6, pz - 3.2]]) assert.equal(walk(L(x, GULF.perchY, z), { tol: 0.8, max: 5 }), true, `round the perch, past its mark (${where()})`);
  stand(0, GULF.perchY, pz + 2.5);
  for (let i = 0; i < 0.4 / DT; i++) frame({ KeyW: true, ShiftLeft: true }, 0);
  end = glide(0, 8);
  assert.ok(Math.abs(end.y - GULF.perchY) < 0.6, `the higher ledge is out of a glide's reach: back on the perch (${where()})`);
  assert.equal(roll('ballP', 'pQ', 1), true, `the column's stone out of its throat (${where()})`);
  const riser = rt.pieces.find((p) => p.lift && p.o.when?.not?.drumOn?.[0] === 'ballP');
  assert.equal(riser.on, true, 'the column rises beside the perch');
  stand(4.4, GULF.perchY, pz);
  top = false;
  for (let i = 0; i < 20 / DT; i++) { P.heading = Math.PI / 2; frame({ Space: true, KeyW: i < 12 }, Math.PI / 2); if (local().y > GULF.farY + 6) { top = true; break; } }
  assert.ok(top, `lifted up past the perch (${where()})`);
  end = glide(0, 8);
  assert.ok(P.onGround && Math.abs(end.y - GULF.farY) < 0.6, `onto the higher ledge (${where()})`);
  // ---- the Roost: when she looks up, afraid, fly beside her (in her last phase, only in the wind: roll the stone so it rises by her)
  const fz = pz + GULF.perchR + GULF.leg2;
  assert.equal(walk(L(0, GULF.farY, fz + 10), { max: 8 }), true, `across the ledge to its door (${where()})`);
  assert.equal(walk(L(0, GULF.farY, fz + 30), { max: 12 }), true, `into the roost (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  const before0 = G.meter;
  G.hit('body', 'shoot');
  assert.equal(G.meter, before0, 'fluid does not calm her');
  const winds = rt.roostWinds;
  const ventNear = () => winds.slice().sort((a, b) => Math.hypot(a.foot.x - G.model.pos.x, a.foot.z - G.model.pos.z) - Math.hypot(b.foot.x - G.model.pos.x, b.foot.z - G.model.pos.z))[0];
  /** Into the column at w (or beside her if w is null), the wings open, until she takes heart or 2.5 s. */
  const fly = (w) => {
    const before = G.meter;
    const at = w ? w.foot.clone().add(V(0, 4, 0)) : G.model.pos.clone().add(V(3, 5, 0));
    P.teleport(at, V(0, 1, 0), V(0, 0, 1));
    P.heading = 0;
    for (let i = 0; i < 2.5 / DT && G.meter === before && G.state === 'open'; i++) frame({ Space: true });
    for (let i = 0; i < 5 / DT && !P.onGround; i++) frame();
    return G.meter - before;
  };
  let still = false, doubled = false;
  for (let n = 0; n < 14 && G.state !== 'weary'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `she looks up, afraid (${n})`);
    const phase = G.phaseIndex;
    if (phase >= 2 && !still) {
      // her last phase: beside her on still air, she does not follow
      const gained = fly(null);
      assert.equal(gained, 0, 'in her last phase, flown with on still air, she does not take heart');
      assert.ok(said(/still air/), 'and it says why');
      still = true;
      continue;
    }
    if (phase >= 1) {
      const w = ventNear();
      if (!w.on) {
        // the wind is on the far side: roll the stone across so it rises by her
        assert.equal(roll('ballR', rt.kit.local(w.foot).x > 0 ? 'pRW' : 'pRE', rt.kit.local(w.foot).x > 0 ? -1 : 1, 4), true, `the stone rolled into the other vent (${n})`);
        if (G.state !== 'open') continue;
      }
      const gained = fly(w);
      assert.ok(gained > 0, `flown with in the wind (${n}: ${G.meter.toFixed(2)}, ${G.state})`);
      if (phase === 1 && gained > 0.2) doubled = true;
    } else assert.ok(fly(null) > 0, `flown with (${n}: ${G.meter.toFixed(2)})`);
  }
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  assert.ok(still, 'her last phase was tried on still air once');
  assert.ok(doubled, 'in her second phase the wind doubled it');
  for (let i = 0; i < 20 / DT && Math.hypot(G.model.pos.x - G.model.rest.x, G.model.pos.z - G.model.rest.z) > 0.6; i++) frame();
  wait(2);
  const head = G.model.mouth.clone().setY(G.arena.y);
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

// ------------------------------------------------------------------ a real bar's pace (src/fluid-tool.js Reserve, src/resources.js)
/**
 * Shoot `n` times as fast as the real magic bar lets you (three units, four with the fourth chamber; it refills
 * like stamina, 1 s after the last shot, empty to full in 4 s; with the quick coil 0.5 s and 2 s; a shot every
 * 0.28 s), running frames between, and call hit(i) for each. Returns the seconds from the first shot to the last.
 */
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

test('the Hangar’s own portals still work round the temple’s: its list kept, a copy in one shape for the scout and the rest', () => {
  const { level } = world('garage');
  const own = level.garage.portals;
  assert.equal(own.length, 3, 'the three gravity portals, as they were');
  assert.ok(own.every((p) => p.pos && p.toUp && p.toFwd && !p.temple), 'its own list has no temple doorway in it');
  const nav = level.navigationPortals;
  assert.ok(nav.length >= own.length + 3, 'the temple’s doorways join the list the scout reads');
  for (const p of own) assert.ok(nav.includes(p), 'every gravity portal is still in it');
  for (const p of nav) assert.ok(p.pos?.isVector3 && p.to?.isVector3 && p.toUp?.isVector3 && p.toFwd?.isVector3, `${p.label}: the same shape (pos, to, toUp, toFwd)`);
  const shopDoors = level.shops?.[0]?.portals ?? [];
  assert.ok(level.portals.every((p) => (p.temple === 'garage' || shopDoors.includes(p)) && p.at && p.r), 'the doorways the game walks through are the temple’s (and Odo’s shop’s door)');
  for (const p of shopDoors) assert.ok(nav.some((q) => q.at === p.at && q.to === p.to), 'the shop’s door is in the scout’s list too, in its shape');
  // the scout routes into the temple through its door
  const rt = level.temple;
  const route = viaPortal(V(0, 0, 120), { id: 'in', label: 'inside', position: rt.kit.world(0, 9, 90) }, nav);
  assert.match(route.label, /First Garage/, `the scout goes by the door (${route.label})`);
  // and a gravity portal still sends you through to its zone
  const po = own[0];
  const player = { pos: po.pos.clone(), vel: V(0, 0, 3), frame: { up: V(0, 1, 0) }, riding: false, teleport(pos, up) { this.pos.copy(pos); this.frame.up = up.clone(); } };
  for (let i = 0; i < 40; i++) level.update(DT, i * DT, { player });
  assert.ok(player.pos.distanceTo(po.to) < 0.01, 'through the portal to the upside-down');
});

test('the First Garage on foot: the escapement’s three eyes in turn from its hand, the climb and the counterweight, the quick coil, the passage’s six eyes a room on that want two tanks in a breath, the clock’s six in turn from the hour it stopped, the Foreman’s six numerals, the clock keeps time', () => {
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('garage');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, gravityAt: level.gravityAt, limit: Infinity });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };   // (as main.js: the moving colliders first)
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), `standing in the Threshold (${where()})`);
  assert.ok(Math.abs(rt.outside.hourH.rotation.z + Math.PI * 2 / 3) < 0.05, 'the clock over the door stopped at four');
  // ---- the Escapement: the disc is still until the three eyes round the dial wake in turn, from where its hand
  // points (eight), round the way a clock goes: eight, twelve, four
  assert.equal(walk(L(0, 0, 16.6)), true, `to the pit's edge (${where()})`);
  const disc = rt.pieces.find((p) => p.path);
  wait(2);
  assert.equal(disc.s, 0, 'the disc is still');
  rt.piece('s2').hit('shoot');
  assert.equal(rt.logic.isLit('s2'), false, 'twelve first: it only ticks');
  assert.ok(notes.some((s) => /counts round from where its hand points/.test(s)), 'and says how the clock counts');
  rt.piece('s1').hit('shoot'); rt.piece('s3').hit('shoot');
  assert.deepEqual(['s1', 's2', 's3'].map((id) => rt.logic.isLit(id)), [true, false, false], 'eight, then four: four is out of turn');
  rt.piece('s2').hit('shoot'); rt.piece('s3').hit('shoot');
  wait(0.1);
  assert.equal(rt.logic.isOpen('discs'), true, 'eight, twelve, four');
  for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.5); i++) frame();
  assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 4 }), true, `onto the disc (${where()})`);
  for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
  assert.equal(walk(L(0, 0, 43), { tol: 0.8 }), true, `off onto the far landing (${where()})`);
  assert.ok(rt.kit.local(P.pos).y > -1, 'over the pit, not in it');
  // ---- the Winding Well: up the wall to a shut door; its counterweight is the ball left on the escapement's landing
  assert.equal(walk(L(-3, 0, 58)), true, `into the well (${where()})`);
  let up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(-3, 9, 66))); if (P.onGround && rt.kit.local(P.pos).y > 8.5) { up = true; break; } }
  assert.ok(up, `up the wall (${where()})`);
  wait(0.5);
  assert.equal(rt.logic.isOpen('d2'), false, 'the door at the top is shut');
  const ball = rt.piece('ball1'), plate = rt.piece('p1'), C2W = 61.2;
  const seenFrom = (from, to) => { const d = to.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.8; };
  assert.ok(!seenFrom(L(0, 10.7, C2W + 6.3), plate.pos.clone().add(V(0, 0.8, 0))), 'its socket is out of sight from up here, under the wall’s lip');
  assert.ok(rt.kit.local(ball.center).z < 48, 'the counterweight is still out on the escapement’s landing');
  P.teleport(L(-3, 0.05, 58), V(0, 1, 0), V(0, 0, 1)); wait(0.3);   // (down again)
  assert.equal(walk(plate.pos, { tol: 0.5 }), true, 'onto the socket');
  wait(0.5);
  assert.equal(rt.logic.isOpen('d2'), false, 'your own weight is not the counterweight');
  for (let k = 0; k < 12 && !rt.logic.drumOn('ball1', 'p1'); k++) {
    walk(ball.center.clone().addScaledVector(ball.dir, -2.2).setY(P.pos.y), { tol: 0.6 });
    ball.hit('push', ball.dir.clone(), { strength: 1 });
    for (let i = 0; i < 6 / DT && !ball.rest; i++) frame();
  }
  assert.ok(rt.logic.drumOn('ball1', 'p1'), `the counterweight home, through the doorway into the well (${ball.t.toFixed(2)})`);
  wait(2.2);
  assert.equal(rt.logic.isOpen('d2'), true);
  up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(-3, 9, 66))); if (P.onGround && rt.kit.local(P.pos).y > 8.5) { up = true; break; } }
  assert.ok(up, `up the wall again (${where()})`);
  // ---- the Coil Chamber: the chest, its way on open; the Winding Passage a room on: six eyes in one breath round its
  // door. The starting bar (or four units) and its refill can't
  assert.equal(walk(L(0, 9, 79)), true, `into the chamber (${where()})`);
  const bank = rt.piece('k1');
  assert.ok(bank.eyes[0].center.distanceTo(L(0, 9, 83.8)) > 20, 'the bank is a room on, not by the chest');
  assert.equal(walk(L(0, 9, 99)), true, `through the open way into the passage (${where()})`);
  const slow = tankShots(frame, 6, (i) => bank.hit(i));
  assert.ok(slow > VOLLEY, `without the coil the sixth comes too late (${slow.toFixed(2)} s)`);
  assert.equal(rt.logic.isLit('k1'), false, 'they went dark again');
  items.grant('cell');
  tankShots(frame, 6, (i) => bank.hit(i));
  assert.equal(rt.logic.isLit('k1'), false, 'nor with the fourth chamber: four, then a long wait');
  assert.equal(rt.logic.next(), 'chest');
  items.grant('coil'); game.emit('box:opened', { id: 'garage.temple.coil' });
  assert.equal(rt.logic.gadget, true);
  wait(5.5);
  items.revoke('cell');
  const quick = tankShots(frame, 6, (i) => bank.hit(i));
  assert.ok(quick < VOLLEY, `with the quick coil: three, a quick refill, three more (${quick.toFixed(2)} s)`);
  assert.equal(rt.logic.isLit('k1'), true, 'six in a breath');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d3'), true);
  // ---- the Clock Gallery: the six round the handless clock, in one breath and in turn from the hour it stopped
  assert.equal(walk(L(0, 9, 110.7)), true, `to the gallery (${where()})`);
  const k2 = rt.piece('k2'), ORDER = [4, 3, 2, 1, 0, 5];   // (four, six, eight, ten, twelve, two)
  assert.deepEqual(k2.o.order, ORDER);
  wait(5.5);
  tankShots(frame, 6, (i) => k2.hit(i));   // round from twelve, the way the eyes were made: out of turn
  assert.equal(rt.logic.isLit('k2'), false, 'from twelve, not four: out of turn');
  assert.ok(notes.some((s) => /lost its hands/.test(s)), 'they all go dark, and say why');
  wait(5.5);
  const late = tankShots(frame, 5, (i) => k2.hit(ORDER[i]));
  assert.equal(k2.seq, 5, `five in turn (${late.toFixed(2)} s)`);
  wait(VOLLEY + 0.5);
  assert.equal(k2.seq, 0, 'the first faded before the sixth: start again');
  tankShots(frame, 6, (i) => k2.hit(ORDER[i]));
  assert.equal(rt.logic.isLit('k2'), true, 'four, six, eight, ten, twelve, two, inside one breath');
  wait(3.5);
  assert.equal(walk(L(0, 9, 137.2)), true, `over the bridge (${where()})`);
  assert.ok(rt.kit.local(P.pos).y > 8, 'over it, not in the chasm');
  // ---- the Foreman's Workshop: when its face opens, all six numerals in one breath
  assert.equal(walk(L(0, 9, 149.2)), true, `into the workshop (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep', 'it wakes');
  assert.equal(rt.logic.isOpen('d4'), false, 'the door shuts behind you');
  P.opts.health = false;
  for (let n = 0; n < 8 && G.state !== 'resolved'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `its face opens (${n}, phase ${G.phaseIndex})`);
    const before = G.meter;
    if (n === 0) { for (let i = 0; i < 3; i++) rt.volley(i); assert.equal(G.meter, before, 'three numerals are nothing'); }
    // (round from four, where its hands stop as it opens: in its last phase only that order takes; tests/guardian-twists)
    tankShots(frame, 6, (i) => rt.volley(FROM_FOUR[i]));
    assert.ok(G.meter > before || G.state === 'resolved', `six in a breath set it back a little (${n}: ${G.meter})`);
  }
  assert.equal(G.state, 'resolved', `set right (${G.meter})`);
  assert.equal(game.flag('temple.garage.done'), true);
  wait(2.5);
  assert.ok(rt.logic.isOpen('d5'), 'the far door opens');
  // ---- out, onto the rim: the clock over the door keeps time, the cogs in the cliff turn
  const out = level.portals.filter((p) => p.temple === 'garage').at(-1);
  assert.equal(walk(out.at, { tol: out.r }), true, `to the way out (${where()})`);
  P.teleport(out.to.clone(), V(0, 1, 0), V(0, 0, 1));   // (main.js walks the doorways: through it)
  wait(1);
  assert.ok(!rt.inside(P.pos) && P.onGround && Math.abs(P.pos.y - rt.outside.door.at.y) < 1.5, `out on the rim (${P.pos.toArray().map((v) => v.toFixed(1))})`);
  wait(4);
  assert.equal(rt.change.root.visible, true, 'the pendulum swings in the porch');
  const cog = rt.outside.cogs[0], a0 = cog.m.rotation.z;
  wait(1);
  assert.notEqual(cog.m.rotation.z, a0, 'the cogs in the cliff turn');
  assert.ok(notes.some((s) => /keep time/i.test(s)), 'it says so');
  game.reset();
  own();
});

test('the Builders’ Greenhouse on foot: the eye that opens only in the sun the ball’s louvre lets in, one ball and two plates on the Glass Stair (the eye, then the disc), bloom mode and its try in the chamber’s sun, the bud in the sun a room on, the seed in the shade and the sun-ball, the seed-ball rolled into the light at the glass’s foot, its vine into the bud, the Gardener bloomed in the sun, the ruins in flower', () => {
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('edena');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };   // (as main.js: the moving colliders first)
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const local = () => rt.kit.local(P.pos);
  const said = (re) => notes.some((n) => re.test(n));
  /** Push a ball along its groove (way +1: toward its b end, -1: toward a) until it rests on `plate` (a few pushes). */
  const roll = (id, plate, way = 1, n = 12) => {
    const ball = rt.piece(id);
    for (let k = 0; k < n && !rt.logic.drumOn(id, plate); k++) {
      const d = ball.dir.clone().multiplyScalar(way);
      walk(ball.center.clone().addScaledVector(d, -2.3).setY(P.pos.y), { tol: 0.5, max: 8 });
      ball.hit('push', d, { strength: 1 });
      wait(2.8);
    }
    return rt.logic.drumOn(id, plate);
  };
  const beams = rt.pieces.filter((p) => p.spots);
  /** The sunbeam (in the room nearest `near`) has swung onto the spot whose condition is cond. */
  const beamOn = (b, at) => b.k > 0.9 && !b.moving && b.at.distanceTo(at) < 0.3;
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), `standing in the Threshold (${where()})`);
  // ---- the Potting Hall: the eye in the shade won't wake; the ball onto its plate turns the louvre, the sun swings onto the eye
  assert.equal(walk(L(0, 0, 15)), true, `into the potting hall (${where()})`);
  rt.piece('s1').hit('shoot');
  assert.equal(rt.logic.isLit('s1'), false, 'in the shade the eye stays shut');
  assert.ok(said(/in the shade/i), 'and says why');
  const beam1 = beams.find((b) => b.spots.some((s) => s.when?.drumOn?.[0] === 'ball1'));
  wait(1);
  assert.ok(beam1.at.distanceTo(rt.piece('s1').center) > 4, 'the sunbeam falls on the floor, not the eye');
  assert.equal(roll('ball1', 'p1'), true, `the ball on its plate (${where()})`);
  for (let i = 0; i < 4 / DT && !beamOn(beam1, beam1.spots[0].pos); i++) frame();
  assert.ok(beamOn(beam1, beam1.spots[0].pos), 'the louvre turns: the sun swings onto the eye');
  rt.piece('s1').hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true, 'woken in the sun: the door opens');
  // ---- the Glass Stair: one ball, two plates. East: the disc rides, but the landing's door wants the eye; west: the eye
  assert.equal(walk(L(0, 0, 42)), true, `to the door (${where()})`);
  assert.equal(walk(L(-2, 0, 51)), true, `into the stair (${where()})`);
  const disc = rt.piece('lift');
  const s0 = disc.s;
  wait(4);
  assert.equal(disc.s, s0, 'in the shade the disc does not ride');
  rt.piece('s2').hit('shoot');
  assert.equal(rt.logic.isLit('s2'), false, 'nor does the eye wake');
  assert.equal(roll('ball2', 'pE', 1), true, `the ball east (${where()})`);
  wait(3);
  assert.notEqual(disc.s, s0, 'in the sun the disc rides');
  rt.piece('s2').hit('shoot');
  assert.equal(rt.logic.isLit('s2'), false, 'the eye is still in the shade: the sun is on the disc');
  assert.equal(roll('ball2', 'pW', -1), true, `the ball west (${where()})`);
  wait(3);
  rt.piece('s2').hit('shoot');
  assert.equal(rt.logic.isLit('s2'), true, 'the sun on the eye: it wakes, and stays woken');
  assert.equal(roll('ball2', 'pE', 1), true, `and back east (${where()})`);
  assert.equal(rt.logic.isLit('s2'), true, 'the eye stays open with the sun gone');
  let up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(0, 9, 63))); if (P.onGround && local().y > 8.5) { up = true; break; } }
  assert.ok(up, `up the root-wall (${where()})`);
  for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.8); i++) frame();
  assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 4 }), true, `onto the disc (${where()})`);
  for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
  assert.ok(local().y > 17.5, `carried up (${where()})`);
  assert.equal(walk(L(0, 18, 66.8), { tol: 0.8 }), true, `onto the landing (${where()})`);
  wait(1.5);
  assert.equal(rt.logic.isOpen('d2'), true, 'the landing’s door, open on the eye');
  assert.equal(walk(L(0, 18, 76)), true, `into the seed chamber (${where()})`);
  // ---- the Seed Chamber: the chest; its way on is open, and a seed in the oculus's sun is a try
  const seed0 = rt.piece('seed0'), bud = rt.piece('d3');
  assert.ok(bud.group.position.distanceTo(L(0, 18, 82)) > 20, 'the bud is a room on, not by the chest');
  seed0.hit('bloom');
  assert.equal(rt.logic.isLit('seed0'), false, 'without bloom mode, a bloom glob is only fluid');
  items.grant('bloom'); game.emit('box:opened', { id: 'edena.temple.bloom' });
  assert.equal(rt.logic.gadget, true);
  seed0.hit('bloom');
  assert.equal(rt.logic.isLit('seed0'), true, 'in the sun the seed flowers');
  assert.equal(rt.logic.isOpen('d3'), false, 'and nothing waits on it');
  // ---- the Bud Passage: the flower-door in its sunbeam: water runs off it, fire curls it shut; a bloom glob opens it
  assert.equal(walk(L(0, 18, 96)), true, `through the open way into the passage (${where()})`);
  bud.hit('shoot'); bud.hit('fire');
  assert.equal(rt.logic.isLit('bud1'), false, 'water and ember do nothing');
  assert.equal(walk(L(0, 18, 105.2), { max: 4 }), false, 'the bud keeps the way');
  if (P.climbing) { P.stopClimb(false); for (let i = 0; i < 3 / DT && !P.onGround; i++) frame(); }
  assert.ok(local().y < 18.5, `back on the floor before the bud (${where()})`);
  bud.hit('bloom');
  wait(2.6);
  assert.equal(rt.logic.isOpen('d3'), true, 'bloomed, it opens');
  // ---- the Vine Gulf: the seed at the lip is in the shade; the sun-ball turns the great louvre onto it
  assert.equal(walk(L(0, 18, 106.9)), true, `to the gulf's edge (${where()})`);
  const seed1 = rt.piece('seed1');
  seed1.hit('shoot');
  seed1.hit('bloom');
  assert.equal(rt.logic.isOpen('vine1'), false, 'bloomed in the shade, it sprouts pale and folds back');
  assert.ok(said(/folds back/), 'and says so');
  const great = beams.find((b) => b.spots.some((s) => s.when?.drumOn?.[0] === 'sun'));
  assert.ok(great.at.y < L(0, 0, 0).y + 5, 'the great beam falls into the dark below');
  assert.equal(roll('sun', 'pS', 1), true, `the sun-ball onto its plate (${where()})`);
  for (let i = 0; i < 5 / DT && !beamOn(great, great.spots[0].pos); i++) frame();
  assert.ok(beamOn(great, great.spots[0].pos), 'the beam swings up onto the lip');
  seed1.hit('bloom');
  wait(3.5);
  assert.equal(rt.logic.isOpen('vine1'), true, 'in the sun the seed grows the bridge');
  assert.equal(walk(L(0, 18, 108.8)), true, `back to the lip (${where()})`);
  assert.equal(walk(L(0, 18, 134.7)), true, `over the vine bridge (${where()})`);
  assert.ok(local().y > 17, 'on it, not in the chasm');
  // the glass: too smooth to climb; the seed-ball beside it lies in the shade
  for (let i = 0; i < 5 / DT; i++) frame({ KeyW: true }, toward(L(0, 27, 145.2)));
  assert.ok(local().y < 22, `you can't get up the glass (${where()})`);
  assert.ok(said(/too smooth/i), 'and you slip off it');
  if (P.climbing) { P.stopClimb(false); for (let i = 0; i < 3 / DT && !P.onGround; i++) frame(); }
  const sb = rt.piece('sb');
  sb.hit('bloom', null);
  assert.equal(rt.logic.isLit('seed2'), false, 'bloomed where it lies, in the shade, the seed-ball only sprouts pale');
  assert.equal(roll('sb', 'pG', 1), true, `rolled into the sunbeam at the glass's foot (${where()})`);
  sb.hit('bloom', null);
  assert.equal(rt.logic.isLit('seed2'), true, 'bloomed in the sun, it roots and grows');
  sb.hit('push', sb.dir.clone().negate(), { strength: 1 });
  wait(1);
  assert.equal(rt.logic.drumOn('sb', 'pG'), true, 'rooted: it rolls no more');
  wait(3);
  assert.equal(rt.logic.isOpen('d4'), true, 'its vine climbs into the bud, and the bud opens');
  assert.equal(walk(L(1.5, 18, 139.6), { tol: 0.8 }), true, `back to the glass's foot (${where()})`);
  up = false;
  for (let i = 0; i < 25 / DT; i++) { frame({ KeyW: true }, toward(L(1.5, 27, 145.2))); if (P.onGround && local().y > 26.5) { up = true; break; } }
  assert.ok(up, `up the vine (${where()})`);
  // ---- the Glasshouse: bloom the four dead beds, then the Gardener's back each time it kneels: in the sun
  assert.equal(walk(L(0, 27, 154.2)), true, `into the glasshouse (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep', 'it wakes');
  wait(0.5);
  assert.equal(rt.logic.isOpen('d4'), false, 'the bud shuts behind you');
  P.opts.health = false;
  // a glob as the tool fires it: through the guardian's own target (it takes fire and stilling as theirs; bloom arrives as fluid, its mode in info)
  const glob = (mode) => { const tg = allTargets().find((x) => x.kind === 'guardian' && x.enabled() && x.position().distanceTo(G.model.pos) < 12 && x.position().distanceTo(G.model.mouth) > 0.5); assert.ok(tg, 'its body is a target'); hitTarget({ target: tg, point: tg.position() }, mode, V(0, 0, 1)); };
  for (let i = 0; i < 6 / DT && G.state !== 'fight'; i++) frame();   // (awake and fighting: its targets take globs)
  glob('bloom');
  assert.equal(G.meter, 0, 'its back first: it shakes the flowers off');
  for (const [i, b] of ['bed1', 'bed2', 'bed3', 'bed4'].entries()) { rt.piece(b).hit('bloom'); assert.ok(Math.abs(G.meter - (i + 1) * 0.1) < 1e-6, `a tenth for each bed (${G.meter})`); }
  // the sun on the quarter it kneels in: the footstone of that quarter (the one nearest it)
  const sun = rt.gardenSun;
  const sunOnIt = () => {
    const fs = ['fs1', 'fs2', 'fs3', 'fs4'].map((id) => rt.piece(id)).sort((a, b) => a.pos.distanceTo(G.model.pos) - b.pos.distanceTo(G.model.pos))[0];
    P.teleport(fs.pos.clone().add(V(0, 0.2, 0)), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0);
    for (let i = 0; i < 4 / DT && !sun.lights(G.model.pos, SUN.pad); i++) frame();
    P.teleport(G.arena.center.clone().add(V(0, 0.2, 0)).lerp(fs.pos, 0.3), V(0, 1, 0), V(0, 0, 1));
    return sun.lights(G.model.pos, SUN.pad);
  };
  let shaded = false;
  for (let n = 0; n < 14 && G.state !== 'weary'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `it kneels (${n})`);
    const before = G.meter, last = G.phaseIndex >= 2;
    if (n === 0) { glob('shoot'); assert.equal(G.meter, before, 'water does not calm it'); }
    if (last && !shaded) {
      // (its last phase: once, the sun turned away from it first, to see the bloom fail in the shade)
      const fs = ['fs1', 'fs2', 'fs3', 'fs4'].map((id) => rt.piece(id)).sort((a, b) => b.pos.distanceTo(G.model.pos) - a.pos.distanceTo(G.model.pos))[0];
      P.teleport(fs.pos.clone().add(V(0, 0.2, 0)), V(0, 1, 0), V(0, 0, 1)); P.vel.set(0, 0, 0);
      for (let i = 0; i < 3 / DT && sun.want() !== sun.spots[['fs1', 'fs2', 'fs3', 'fs4'].indexOf(fs.id)]; i++) frame();
      wait(1.6);
      if (!sun.lights(G.model.pos, SUN.pad)) { glob('bloom'); assert.equal(G.meter, before, 'in its last phase, kneeling in the shade, nothing grows on it'); assert.ok(said(/kneeling in the shade/), 'and it says why'); shaded = true; }
    }
    if (G.phaseIndex >= 1) assert.ok(sunOnIt(), `the sun brought onto it from the footstone (${n})`);
    const phase = G.phaseIndex;
    glob('bloom');
    assert.ok(G.meter > before, `bloomed (${n}: ${G.meter.toFixed(2)}, phase ${G.phaseIndex})`);
    if (phase === 1) assert.ok(G.meter - before > 0.2 || G.phaseIndex > 1, `in its second phase the sun doubles it (${(G.meter - before).toFixed(2)})`);
  }
  assert.ok(shaded, 'its last phase was tried in the shade once');
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  for (let i = 0; i < 20 / DT && Math.hypot(G.model.pos.x - G.model.rest.x, G.model.pos.z - G.model.rest.z) > 0.6; i++) frame();
  wait(2);
  const head = G.model.mouth.clone().setY(L(0, 27, 0).y);
  const out = head.clone().sub(G.model.pos).setY(0).normalize();
  P.teleport(head.clone().addScaledVector(out, 1.6).add(V(0, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, 'temple.edena.touch', 'a hand on its brow');
  near.entry.use(P);
  assert.equal(game.flag('temple.edena.done'), true);
  wait(6);
  assert.ok(rt.logic.isOpen('d4') && rt.logic.isOpen('d5'), 'the bud opens again, and the far door');
  // ---- the world changed: the white ruins flower
  const C = rt.change;
  assert.equal(C.root.visible, true, 'Viridel in flower');
  assert.ok(C.count.slabs > 20 && C.count.flowers > 200, `flowers on the ruins (${JSON.stringify(C.count)})`);
  assert.ok(C.root.children[0].count === C.count.flowers, 'all of them up');
  game.reset();
  own();
});

test('the Greenhouse stands clear of Esk’s tea terraces, and every bloom target answers the bloom mode only', () => {
  const { rt } = world('edena');
  const D = rt.outside.door.at;
  // the terraces and their hollow (src/levels/edena.js TERRACES), south-east of the landing
  for (const [x, z] of [[214, -122], [277, -78], [186, -98]]) assert.ok(Math.hypot(SITE_EDENA.x - x, SITE_EDENA.z - z) > 300, 'far from the terraces');
  assert.ok(D.z > 250, 'north of the white ruins');
  // a glob in another mode arrives as plain fluid (targets.js modeFor), bloom only where it is accepted
  const seed = rt.piece('seed1');
  assert.equal(modeFor({ accepts: ['bloom', 'fire'] }, 'bloom'), 'bloom');
  assert.equal(modeFor({}, 'bloom'), 'shoot');
  assert.ok(seed && rt.piece('d3') && rt.piece('bed1'));
});

test('the echo shell: it keeps the last note sung within earshot (saved), plays it back on V, and does nothing without it', (t) => {
  game.reset(); setHintLevel('full'); t.after(() => setHintLevel('subtle'));   // (it checks the words with their buttons, as hints full says them: subtle takes the button out, the card having taught it)
  own('backpack', 'gun');
  const P = { pos: V(0, 0, 0), hidden: false };
  const toasts = [], echoes = [];
  const shell = createEchoShell({ player: P, game, items, toast: (s) => toasts.push(s) });
  const off = game.on('echo', (e) => echoes.push(e));
  game.emit('note', { pos: V(3, 0, 0), note: 'low', label: 'the low stone’s note' });
  assert.equal(shell.held, null, 'not without the shell');
  assert.equal(shell.play(), false);
  items.grant('echo');
  game.emit('note', { pos: V(40, 0, 0), note: 'high', label: 'the high stone’s note' });
  assert.equal(shell.held, null, 'too far to hear');
  game.emit('note', { pos: V(10, 0, 0), note: 'low', label: 'the low stone’s note' });
  assert.equal(shell.held?.note, 'low', 'caught');
  assert.ok(toasts.some((s) => /Y \/ △ plays it back/.test(keyText(s, { kind: 'pad' })) && /V plays it back/.test(keyText(s, { kind: 'keys' }))), 'it says how to play it back, on the keys and the pad');
  assert.equal(game.flag('echo.held').note, 'low', 'kept in the save');
  P.pos.set(5, 0, 5);
  assert.equal(shell.play(), true);
  assert.equal(echoes.length, 1);
  assert.ok(echoes[0].note === 'low' && echoes[0].pos.distanceTo(P.pos) < 1e-6, 'played back where you stand');
  assert.equal(shell.play(), false, 'a breath between plays');
  shell.update(1.1);
  game.emit('note', { pos: V(5, 0, 8), note: 'mid', reach: 4 });
  assert.equal(shell.held.note, 'mid', 'it holds one note: the last');
  assert.ok(ITEMS.echo && ITEMS.echo.kind === 'charm');
  shell.dispose(); off();
  game.reset();
  own();
});

test('the Undertower on foot: the singing ball and the dishes and the pillars over the cable pit, the well’s horn and the low stone, the echo shell, the chamber’s low stone carried a room on to the passage’s horn, the held pillars, the middle note sent over through the dish, the way back, the First Sign given its words back, the tower speaks once a night', () => {
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('bazaar');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit, killY: level.killY });
  const notes = [];
  const toast = (s) => notes.push(s);
  rt.connect({ player: P, toast, isNight: () => false });
  const shell = createEchoShell({ player: P, game, items, toast });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); shell.update(DT); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const local = () => rt.kit.local(P.pos);
  const said = (re) => notes.some((s) => re.test(s));
  const ride = (disc, off, label) => {
    for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.5); i++) frame();
    assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 4, dy: 0.9 }), true, `onto the ${label} (${where()})`);
    for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
    assert.equal(walk(off, { tol: 0.8, max: 4 }), true, `off the ${label} (${where()})`);
  };
  const roll = (id) => {
    const ball = rt.piece(id), plate = rt.logic.el(id).plate;
    for (let k = 0; k < 10 && !rt.logic.drumOn(id, plate); k++) {
      walk(ball.center.clone().addScaledVector(ball.dir, -2.3).setY(P.pos.y), { tol: 0.5 });
      ball.hit('push', ball.dir.clone(), { strength: 1 });
      wait(2.6);
    }
    assert.ok(rt.logic.drumOn(id, plate), `${id} on its footstone (${ball.t.toFixed(2)})`);
  };
  const DOWN = V(0, -1, 0);   // (a splash from above: it sings, and does not roll it)
  const stones = rt.pieces.filter((p) => p.note && p.sing && !p.id);
  const stone = (note, at) => stones.filter((s) => s.note === note).sort((a, b) => a.center.distanceTo(at) - b.center.distanceTo(at))[0];
  const ear = (id) => rt.pieces.find((p) => p.id === id && p.reach);
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), `in the Threshold (${where()})`);
  // ---- the Hall of Dishes: the far horn hears a stone's own song, but only the dishes carry it that far
  assert.equal(walk(L(0, 0, 15)), true, `into the hall (${where()})`);
  const [discA, discB] = rt.pieces.filter((p) => p.path);
  const pillars = rt.piece('disc');
  assert.ok(pillars.span && !pillars.path, 'no disc over the cable pit: the makers’ pillars');
  const ball1 = rt.piece('ball1'), dishA = rt.piece('dishA');
  walk(ball1.center.clone().add(V(0, 0, -2.5)).setY(P.pos.y), { tol: 0.6 });
  ball1.hit('shoot', DOWN);
  wait(1.5);
  assert.equal(rt.logic.isLit('eD'), false, 'sung where it lies, the ball’s note dies in the hall: the horn across the pit is too far');
  assert.equal(dishA.awake, false, 'the dish is dark, its footstone bare');
  assert.equal(pillars.open, false, 'the pillars stay down in the cable');
  assert.equal(walk(L(0, 0, 33), { max: 4 }), false, 'no way over the pit');
  assert.ok(local().z < 25 || local().y < -1, 'the pit stops you');
  P.teleport(L(0, 0.1, 20), V(0, 1, 0), V(0, 0, 1)); wait(0.3);
  roll('ball1');
  assert.equal(dishA.awake, true, 'the ball’s weight on its footstone wakes the dish');
  assert.equal(rt.logic.isLit('eD'), false, 'rolled home, it is quiet until it is splashed');
  ball1.hit('shoot', DOWN);
  wait(0.2);
  assert.equal(rt.logic.isLit('eD'), false, 'the note takes a moment to cross');
  wait(1);
  assert.equal(rt.logic.isLit('eD'), true, 'the far dish says it over the horn');
  assert.ok(said(/far dish says the ball’s note/), 'and the horn answers');
  wait(2.5);
  assert.equal(pillars.open, true, 'the pillars rise out of the cable');
  assert.equal(walk(L(0, 0, 22.5)), true, `to the pit's edge (${where()})`);
  assert.equal(walk(L(0, 0, 43)), true, `over the pillars (${where()})`);
  assert.ok(local().y > -1, 'over the cables, not in them');
  // ---- the Cable Well: the second disc waits for the horn on the ledge, which listens for the low stone
  assert.equal(walk(L(0, 0, 52)), true, `into the well (${where()})`);
  const C2 = 61.2;
  ride(discA, L(-4, 6, C2 + 3.2), 'first disc');
  const s0 = discB.s;
  wait(2);
  assert.equal(discB.s, s0, 'the second disc waits');
  const lowW = stone('low', L(0, 0, C2)), highW = stone('high', L(0, 0, C2));
  highW.sing(); wait(0.3);
  assert.equal(rt.logic.isLit('eW'), false, 'the high stone is not its note');
  assert.ok(said(/colour of the low one/), 'and the horn says whose colour its ring is');
  lowW.sing(); wait(0.3);
  assert.equal(rt.logic.isLit('eW'), true, 'the low stone: the horn on the ledge answers');
  ride(discB, L(1, 12, C2 + 8.4), 'second disc');
  assert.ok(Math.abs(local().y - 12) < 0.6, `up on the landing (${where()})`);
  // ---- the Shell Chamber: the chest, its way on open; a low singing stone by the dais
  assert.equal(walk(L(0, 12, 76)), true, `into the chamber (${where()})`);
  const C3 = C2 + 22.6, A0 = C3 + 10.9, ear0 = ear('e0');
  const lowC = stone('low', L(0, 12, C3));
  assert.ok(lowC.center.distanceTo(L(0, 12, C3)) < 9, 'a low singing stone in the chamber');
  assert.ok(ear0.at.distanceTo(L(0, 12, C3)) > 17, 'and the door’s horn a room on, in the passage');
  assert.equal(rt.logic.next(), 'chest');
  items.grant('echo'); game.emit('box:opened', { id: 'bazaar.temple.echo' });
  assert.equal(rt.logic.gadget, true);
  // through the open way into the Listening Passage: the door's horn, and nothing to sing here
  assert.equal(walk(L(0, 12, A0 + 4)), true, `into the passage (${where()})`);
  assert.equal(stones.filter((s) => s.center.distanceTo(L(0, 12, A0 + 6)) < 7).length, 0, 'no singing stone in the passage');
  assert.equal(walk(ear0.at.clone().setY(P.pos.y), { tol: 2.5 }), true, `to the door's horn (${where()})`);
  assert.equal(shell.play(), false, 'the shell holds nothing yet');
  // the wrong note first: the middle one, played back by the horn
  game.emit('echo', { pos: ear0.at.clone(), note: 'mid' }); wait(0.3);
  assert.equal(rt.logic.isLit('e0'), false, 'the middle note: the horn listens for the low one');
  assert.ok(said(/colour of its ring/), 'and says whose colour its ring is');
  // back to the chamber's low stone: splash it, and the shell catches it; carry it a room on
  assert.equal(walk(lowC.center.clone().add(V(3, 0, 0)).setY(P.pos.y), { tol: 1.2 }), true, `by the chamber's low stone (${where()})`);
  lowC.sing();
  assert.equal(shell.held?.note, 'low', 'the shell catches the low stone');
  assert.equal(walk(ear0.at.clone().setY(P.pos.y), { tol: 2.5 }), true, `back to the door's horn (${where()})`);
  assert.equal(shell.play(), true);
  assert.equal(rt.logic.isLit('e0'), true, 'it hears the low note, carried a room on');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d3'), true);
  // ---- the Gallery of Voices
  const G0 = A0 + 13.2;
  assert.equal(walk(L(0, 12, G0 + 3)), true, `into the gallery (${where()})`);
  const high = stone('high', L(0, 12, G0)), mid = stone('mid', L(0, 12, G0)), farHigh = stone('high', L(0, 12, G0 + 36));
  const ear1 = ear('e1'), ear3 = ear('e3'), dishC = rt.piece('dishC'), bridge = rt.piece('br1');
  assert.ok(farHigh !== high && farHigh.center.distanceTo(L(0, 12, G0 + 32)) < 10, 'a high stone on the far side too');
  // the obvious way first: carry the high note to the great horn, and cross
  high.sing(); wait(1.2);
  assert.equal(shell.held.note, 'high');
  walk(ear1.at.clone().setY(P.pos.y), { tol: 2.5 });
  mid.sing(); wait(0.2); shell.play(); wait(0.5);
  assert.equal(rt.logic.isLit('e1'), false, 'the middle note: the great horn listens for the high one');
  high.sing(); wait(1.2); shell.play(); wait(0.2);
  assert.equal(rt.logic.isLit('e1'), true, 'the high note: the great horn holds it');
  wait(2.5);
  assert.equal(rt.logic.isOpen('br1'), true, 'the pillars rise');
  assert.equal(walk(L(0, 12, G0 + 6.5)), true, `to the bridge (${where()})`);
  assert.equal(walk(L(0, 12, G0 + 31)), true, `over the pillars (${where()})`);
  assert.ok(local().y > 11, 'over them, not in the chasm');
  assert.equal(rt.logic.isOpen('d4'), false, 'the far door wants the middle note through its dish, and the dish’s ball home');
  mid.sing(); wait(0.5);
  assert.equal(shell.held.note, 'high', 'from across the chasm the shell can’t catch the middle stone');
  shell.play(); wait(0.5);
  assert.equal(rt.logic.isLit('e2'), false, 'the door’s horn is up in the dish over it, out of the shell’s reach');
  wait(HOLD_HORN + 0.5);
  assert.equal(rt.logic.isOpen('br1'), false, 'the note fades, and the pillars sink behind you');
  assert.ok(said(/note is fading/), 'it said so before they sank');
  wait(2);
  assert.equal(bridge.open, false);
  // the way back: the far side's own high stone and horn
  assert.equal(walk(ear3.at.clone().setY(P.pos.y), { tol: 2.5 }), true, `to the far horn (${where()})`);
  farHigh.sing(); wait(0.3);
  assert.equal(shell.held.note, 'high');
  shell.play(); wait(2.5);
  assert.equal(rt.logic.isOpen('br1'), true, 'the far horn raises the pillars for the way back');
  assert.equal(walk(L(0, 12, G0 + 26.5)), true, `to the pillars (${where()})`);
  assert.equal(walk(L(0, 12, G0 + 5)), true, `back over (${where()})`);
  // the middle note played into the dish while its footstone is bare: it hears nothing
  mid.sing(); wait(0.3);
  assert.equal(shell.held.note, 'mid');
  assert.equal(walk(L(6.4, 12, G0 + 4.4)), true, `under the dish (${where()})`);
  shell.play(); wait(1.2);
  assert.equal(rt.logic.isLit('e2'), false, 'a dark dish carries nothing');
  assert.ok(said(/dark and deaf/), 'it says it is dark');
  // the ball onto its footstone: the dish wakes, and the middle note crosses the chasm
  roll('ball2');
  assert.equal(dishC.awake, true);
  wait(0.5);
  assert.equal(walk(L(6.4, 12, G0 + 4.4), { tol: 0.8 }), true, `beside the ball, under the dish (${where()})`);
  shell.update(2);
  assert.equal(shell.play(), true);
  wait(0.2);
  assert.equal(rt.logic.isLit('e2'), false, 'a moment on its way');
  wait(1);
  assert.equal(rt.logic.isLit('e2'), true, 'the dish over the far door says the middle note, and the door’s horn answers');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d4'), true, 'both of the far door’s lamps: it sinks, across the chasm');
  // then the high note to the great horn: and the pillars wait for whoever is on them
  high.sing(); wait(0.3);
  walk(ear1.at.clone().setY(P.pos.y), { tol: 2.5 });
  shell.play(); wait(2.5);
  assert.equal(walk(L(0, 12, G0 + 6.5)), true, `to the bridge (${where()})`);
  assert.equal(walk(L(0, 12, G0 + 18)), true, `onto the middle of the pillars (${where()})`);
  wait(HOLD_HORN + 0.5);
  assert.equal(rt.logic.isOpen('br1'), false, 'the note has faded');
  assert.equal(bridge.open, true, 'but the pillars wait for you to step off');
  assert.ok(local().y > 11, `still on them (${where()})`);
  assert.equal(walk(L(0, 12, G0 + 31)), true, `off the far end (${where()})`);
  wait(0.3);
  assert.equal(bridge.open, false, 'and then they sink');
  // ---- the First Sign: when it lowers its dish to listen, play its word back into it; it moves on to the next
  assert.equal(walk(L(0, 12, G0 + 44)), true, `into the hall (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep', 'it wakes');
  wait(0.5);
  assert.equal(rt.logic.isOpen('d4'), false, 'the door shuts behind you');
  P.opts.health = false;
  G.hit('mouth', 'shoot');
  assert.equal(G.meter, 0, 'fluid only rattles off its dish');
  for (let n = 0; n < 8 && G.state !== 'resolved'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `it lowers its dish to listen (${n})`);
    // come close (within its listening reach) and give it back the word it just said
    P.teleport(G.model.mouth.clone().setY(G.model.pos.y).add(V(4, 0.2, 0)), V(0, 1, 0), V(0, 0, 1));
    G.say();
    const before = G.meter;
    if (n === 1) { game.emit('echo', { pos: P.pos.clone(), note: 'sign.0' }); assert.equal(G.meter, before, 'its old word does nothing: it has moved on'); }
    assert.equal(shell.held?.note, `sign.${n}`, `the shell holds its word (${shell.held?.label})`);
    if (G.phaseIndex >= 2) {
      // (its last phase: it hears only through the low dishes on the wall; tests/guardian-twists.test.js)
      const dish = rt.piece('signDishW').ends[0].mouth;
      P.teleport(dish.clone().setY(G.model.pos.y).lerp(G.arena.center.clone().setY(G.model.pos.y), 0.06).add(V(0, 0.2, 0)), V(0, 1, 0), V(0, 0, 1));
    }
    shell.update(2);
    assert.equal(shell.play(), true);
    wait(1);
    assert.ok(G.meter > before || G.state === 'resolved', `its word back: retuned a little (${n}: ${G.meter})`);
  }
  assert.equal(G.state, 'resolved', `its whole line (${G.meter})`);
  assert.equal(game.flag('temple.bazaar.done'), true);
  wait(2.5);
  assert.ok(rt.logic.isOpen('d4') && rt.logic.isOpen('d5'), 'the doors open');
  // ---- the world changed: the tower has a lamp, and at night it speaks the line, once
  const C = rt.change;
  P.teleport(V(0, 0.2, -215), V(0, 1, 0), V(0, 0, 1));
  wait(2);
  assert.equal(C.root.visible, true, 'a lamp on the silent tower');
  assert.equal(C.spoken, 0, 'by day it is quiet');
  rt.isNight = () => true;
  wait(1);
  assert.equal(C.spoken, 1, 'at night it speaks');
  assert.ok(notes.some((s) => s.includes('SOMEBODY OUT THERE IS TALKING TO YOU')), 'the whole line');
  wait(3);
  assert.equal(C.spoken, 1, 'once a night');
  rt.isNight = () => false; wait(0.5);
  rt.isNight = () => true; wait(0.5);
  assert.equal(C.spoken, 2, 'and again the next night');
  shell.dispose();
  game.reset();
  own();
});
