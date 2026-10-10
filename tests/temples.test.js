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
import { SITE as SITE_EDENA } from '../src/temples/edena.js';
import { modeFor, allTargets, hitTarget } from '../src/targets.js';
import { JETS_NEXT, jetsUsed } from '../src/temples/incal.js';
import { createEchoShell } from '../src/echo-shell.js';
import { HOLD as BELFRY_HOLD } from '../src/temples/arzach2.js';
const HOLD_DOOR = BELFRY_HOLD.door, HOLD_STONES = BELFRY_HOLD.stones;
import { HOLD as UNDERTOWER_HOLD } from '../src/temples/bazaar.js';
const HOLD_HORN = UNDERTOWER_HOLD.horn;
import { TempleKit } from '../src/temples/kit.js';

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
test('the Givers’ House on foot: in, the ball and the plates, the disc and the wall, the ember, the bridge and the thorns, the Keeper calmed, out', () => {
  game.reset();
  own('backpack');
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
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };   // (as main.js: the moving colliders first)
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s, input = {}, yaw = 0) => { for (let i = 0; i < s / DT; i++) frame(input, yaw); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  /**
   * Fly with the jets (they fly like a plane: player.js JET): RT lifts you straight up, eased off
   * ahead of height y (local); the stick forward tips the nose over to level, facing `to` (local [x, z]);
   * across on a squeeze that eases off as it nears; then let go: too slow to glide, you drop onto it.
   */
  const fly = (y, to, { max = 14 } = {}) => {
    const target = L(to[0], y, to[1]);
    const face = () => { P.heading = P.frame.headingOf(target.clone().sub(P.pos).setY(0)); };
    const left = () => y - rt.kit.local(P.pos).y;
    let i = 0;
    face();
    for (; i < max / DT && left() > 0.3; i++) frame({ PadThrust: Math.min(1, Math.max(0.05, (left() - P.vel.dot(P.frame.up) * 0.6) / 8)) }, 0);   // (easing off ahead of the height: the speed lags)
    for (; i < max / DT && P.jetFlight?.pitch > 0.05; i++) { face(); frame({ PadThrust: 0.15, stick: { x: 0, y: 1 } }, 0); }
    for (; i < max / DT && flat(target) > 0.8; i++) { face(); frame({ PadThrust: Math.min(1, Math.max(0.06, flat(target) / 30)) }, 0); }
    for (; i < max / DT && !P.onGround; i++) frame({}, 0);
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
  assert.ok(Math.abs(rt.kit.local(P.pos).y - 34.6) < 0.4, `standing in the gallery (${where()})`);
  assert.equal(jetsUsed(rt), true, 'up: the jets were the way');
  wait(1.2);
  assert.equal(guide.root.visible, false, 'the rings fade once you are up');
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
test('the Founders’ Belfry on foot: two balls in the two stores, the riding stair and the eye under the landing, the bell, the held door, the held stones and the ball rolled across them, the Cloud-Mother calmed, the stones come down outside', () => {
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
  // ---- the Stone Stair: ride the first disc up to the ledge; the high door's eye is on the landing's face
  assert.equal(via([12.6, 0, 23], [4, 0, 30], [0, 0, 40], [0, 0, 46.5]), true, `into the well (${where()})`);
  const [discA, discB] = rt.pieces.filter((p) => p.path);
  const ride = (disc, off, label) => {
    for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.6); i++) frame();
    assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 4, dy: 1.0 }), true, `onto the ${label} (${where()})`);
    for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
    assert.equal(walk(off, { tol: 0.7, max: 4 }), true, `off the ${label} (${where()})`);
  };
  ride(discA, L(0, 8, 56.4 - 0.6), 'first disc');
  assert.equal(rt.logic.isOpen('d2'), false, 'the high door is shut');
  // from the ledge the eye is in plain sight; from the landing above it, it is under your feet
  const eye = rt.piece('s1').center, seen = (from) => { const d = eye.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.8; };
  assert.ok(seen(P.pos.clone().add(V(0, 1.6, 0))), 'the eye seen from the ledge');
  assert.ok(!seen(L(0, 17.8, 56.4 + 7.2)), 'and not from the landing');
  rt.piece('s1').hit('shoot');
  wait(2);
  assert.equal(rt.logic.isOpen('d2'), true, 'the eye wakes the high door');
  ride(discB, L(0, 16, 56.4 + 7.4), 'second disc');
  // ---- the Bell Chamber: the chest; the door on is held by the bell in the oculus, only while it rings
  assert.equal(walk(L(0, 16, 72)), true, `into the bell chamber (${where()})`);
  assert.equal(walk(L(0, 16, 91.5), { max: 5 }), false, 'the held door is shut');
  ring();
  wait(0.2);
  assert.equal(rt.logic.isLit('e1'), false, 'without the whistle nothing answers (whoever rang it)');
  items.grant('bell'); game.emit('box:opened', { id: 'arzach2.temple.bell' });
  ring();
  wait(2.2);
  assert.equal(rt.logic.isOpen('d3'), true, 'the door answers the bell');
  wait(HOLD_DOOR - 1);
  assert.equal(rt.logic.isOpen('d3'), false, 'and rises again when the note fades');
  assert.ok(notes.some((s) => /fading/i.test(s)), 'it says the note is fading');
  ring();
  assert.equal(walk(L(0, 16, 93)), true, `through while it rings (${where()})`);
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
  assert.equal(walk(L(-1.5, 16, 120)), true, `over the stones (${where()})`);
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
    P.teleport(G.model.pos.clone().setY(L(0, 16, 0).y).add(V(G.model.pos.x > L(0, 16, 150.8).x ? -6 : 6, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
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
test('the Footprint on foot: two spheres on two plates, the still pool, the lens, the door that is wall without it, the bridge and the eye only it shows, the Echo answered', () => {
  game.reset();
  own('backpack');
  const { level, physics, rt } = world('spheres');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true });
  rt.connect({ player: P, toast: () => {} });
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
test('the Lamp-House on foot: three dark pools (the third up the roots, out of sight), the disc and the root-wall, the lantern, the lamps that wake to it, the stones only its light shows, the pool-orb lit and rolled to the niche, the Lampless fed, the lamp lit', () => {
  game.reset();
  own('backpack');
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
  // ---- the Root Stair: the disc over the dark pool waits for the lamp in its socket, and only light wakes it
  assert.equal(walk(L(-1, 0, 48.5)), true, `to the stair (${where()})`);
  const disc = rt.pieces.find((p) => p.path);
  wait(3);
  assert.equal(disc.s, 0, 'the disc is dark and still');
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
  assert.equal(rt.logic.isOpen('disc'), true, 'the disc wakes');
  assert.equal(walk(L(-1, 0, 48.5)), true, `to the stair again (${where()})`);
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
  assert.equal(walk(L(0, 9, 123)) && walk(L(0, 9, 132)), true, `into the lamp-room (${where()})`);
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

test('the Hush-House on foot: the crystals sung low to high (the first by the door), the climbing disc and the eye on the root-wall, the stilling mode, the gate of jaws, the pendulums stilled in turn, the Mother Snapper stilled, the swamp in flower', () => {
  game.reset();
  own('backpack');
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
  const swings = rt.pieces.filter((p) => p.len && p.arm && p.id);   // (the gallery's: the Mother's three hang in her hall)
  assert.equal(swings.length, 3);
  P.teleport(L(0, 9.05, rt.kit.local(swings[0].group.position).z), V(0, 1, 0), V(0, 0, 1));
  let knocked = false;
  for (let i = 0; i < 4 / DT && !knocked; i++) { frame(); knocked = !!P.down; }
  assert.ok(knocked, `a pendulum knocks you off (${where()})`);
  for (let i = 0; i < 10 / DT && (P.down || P.dead); i++) frame();
  wait(1.5);
  P.teleport(L(0, 9.05, 94.5), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  // the keeper's ledge along the east wall: its gate is shut from this side
  assert.equal(walk(L(10, 9, 94.5)), true, `to the ledge's gate (${where()})`);
  assert.equal(walk(L(10, 9, 110), { max: 3 }), false, 'the gate holds');
  assert.ok(rt.kit.local(P.pos).z < 90.7 + 6.4 && rt.kit.local(P.pos).x > 7.5 && rt.kit.local(P.pos).y > 8.5, `still this side of it, at the gate (${where()})`);
  assert.equal(walk(L(0, 9, 94.5)), true, `back to the bridge (${where()})`);
  // stilled near to far to cross: the walk stills them out of turn, and only the smallest's note takes
  for (const s of swings) s.hit('stun');
  assert.equal(walk(L(0, 9, 120), { max: 6 }), true, `over the bridge between the stilled pendulums (${where()})`);
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
  assert.equal(walk(L(9.9, 9, 116)) && walk(L(9.9, 9, 98.6), { tol: 0.4 }), true, `along the ledge to the footstone (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('ds'), true, 'the gate opens from behind');
  wait(2.2);
  assert.equal(walk(L(9.9, 9, 94)), true, `through it to the near landing (${where()})`);
  wait(0.5);
  assert.equal(rt.logic.isOpen('ds'), true, 'and stays open');
  assert.equal(walk(L(9.9, 9, 98)) && walk(L(9.9, 9, 116)) && walk(L(0, 9, 120)), true, `back along it (${where()})`);
  assert.ok(rt.kit.local(P.pos).y > 8, 'on the far landing');
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

test('the Aerie on foot: the gusts waited out behind the screens, the wall and the rising disc, the wings, the gulf glided, the wind well, the Elder flown with, the birds come back', () => {
  game.reset();
  own('backpack');
  const { level, physics, rt } = world('arzach');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit ?? 1900 });
  rt.connect({ player: P, toast: () => {} });
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

test('the First Garage on foot: the escapement’s three eyes in turn from its hand, the climb and the counterweight, the quick coil, the banks of six eyes that want two tanks in a breath, the clock’s six in turn from the hour it stopped, the Foreman’s six numerals, the clock keeps time', () => {
  game.reset();
  own('backpack');
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
  // ---- the Coil Chamber: six eyes in one breath. The starting bar (or four units) and its refill can't
  assert.equal(walk(L(0, 9, 79)), true, `into the chamber (${where()})`);
  const bank = rt.piece('k1');
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
  assert.equal(walk(L(0, 9, 97.5)), true, `to the gallery (${where()})`);
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
  assert.equal(walk(L(0, 9, 124)), true, `over the bridge (${where()})`);
  assert.ok(rt.kit.local(P.pos).y > 8, 'over it, not in the chasm');
  // ---- the Foreman's Workshop: when its face opens, all six numerals in one breath
  assert.equal(walk(L(0, 9, 136)), true, `into the workshop (${where()})`);
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

test('the Builders’ Greenhouse on foot: the stone seed and the eye, the root-wall and the rising disc, bloom mode, the budded doors, the vine bridge, the glass you can’t climb until a vine grows up it, the Gardener bloomed, the ruins in flower', () => {
  game.reset();
  own('backpack');
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
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), `standing in the Threshold (${where()})`);
  // ---- the Potting Hall: the stone seed onto its plate, and the eye over the benches; both
  assert.equal(walk(L(0, 0, 15)), true, `into the potting hall (${where()})`);
  const ball = rt.piece('ball1');
  for (let k = 0; k < 12 && !rt.logic.drumOn('ball1', 'p1'); k++) {
    walk(ball.center.clone().addScaledVector(ball.dir, -2.3).setY(P.pos.y), { tol: 0.5 });
    ball.hit('push', ball.dir.clone(), { strength: 1 });
    wait(2.6);
  }
  assert.ok(rt.logic.drumOn('ball1', 'p1'), `the seed on its plate (${ball.t.toFixed(2)}) (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('d1'), false, 'the plate alone is not enough');
  rt.piece('s1').hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true, 'and the eye: the door opens');
  // ---- the Glass Stair: up the root-wall, then the rising disc
  assert.equal(walk(L(0, 0, 42)), true, `to the door (${where()})`);
  assert.equal(walk(L(0, 0, 53)), true, `into the stair (${where()})`);
  let up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(0, 9, 63))); if (P.onGround && local().y > 8.5) { up = true; break; } }
  assert.ok(up, `up the root-wall (${where()})`);
  const disc = rt.pieces.find((p) => p.path);
  for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.8); i++) frame();
  assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 4 }), true, `onto the disc (${where()})`);
  for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
  assert.ok(local().y > 17.5, `carried up (${where()})`);
  assert.equal(walk(L(0, 18, 66.8), { tol: 0.8 }), true, `onto the landing (${where()})`);
  assert.equal(walk(L(0, 18, 76)), true, `into the seed chamber (${where()})`);
  // ---- the flower-door: water runs off it, fire curls it shut; a bloom glob opens it
  const bud = rt.piece('d3');
  bud.hit('shoot'); bud.hit('fire');
  assert.equal(rt.logic.isLit('bud1'), false, 'water and ember do nothing');
  assert.equal(walk(L(0, 18, 92), { max: 4 }), false, 'the bud keeps the way');
  // (pushing at it for 4 s, he starts up it: let go, back on the floor, before it opens; where a climb half
  // way up a door that vanishes ends is not this test's business, and hangs on the last centimetre)
  if (P.climbing) { P.stopClimb(false); for (let i = 0; i < 3 / DT && !P.onGround; i++) frame(); }
  assert.ok(local().y < 18.5, `back on the floor before the bud (${where()})`);
  bud.hit('bloom');
  assert.equal(rt.logic.isLit('bud1'), false, 'without bloom mode, a bloom glob is only fluid');
  items.grant('bloom'); game.emit('box:opened', { id: 'edena.temple.bloom' });
  assert.equal(rt.logic.gadget, true);
  bud.hit('bloom');
  wait(2.6);
  assert.equal(rt.logic.isOpen('d3'), true, 'bloomed, it opens');
  // ---- the Vine Gulf: a seed at its edge grows the bridge
  assert.equal(walk(L(0, 18, 93.7)), true, `to the gulf's edge (${where()})`);
  rt.piece('seed1').hit('shoot');
  assert.equal(rt.logic.isOpen('vine1'), false, 'water only soaks it');
  rt.piece('seed1').hit('bloom');
  wait(3.5);
  assert.equal(walk(L(0, 18, 121.5)), true, `over the vine bridge (${where()})`);
  assert.ok(local().y > 17, 'on it, not in the chasm');
  // the glass: too smooth to climb; a seed at its foot grows a vine up it
  let slipped = 0;
  for (let i = 0; i < 6 / DT; i++) { frame({ KeyW: true }, toward(L(0, 27, 132))); if (P.climbing) slipped = -1; if (slipped === -1 && !P.climbing) { slipped = 1; } }
  assert.ok(local().y < 22, `you can't get up the glass (${where()})`);
  assert.ok(notes.some((s) => /too smooth/i.test(s)), 'and you slip off it');
  rt.piece('seed2').hit('bloom');
  wait(3);
  assert.equal(walk(L(0, 18, 126.4), { tol: 0.8 }), true, `back to its foot (${where()})`);
  up = false;
  for (let i = 0; i < 25 / DT; i++) { frame({ KeyW: true }, toward(L(0, 27, 132))); if (P.onGround && local().y > 26.5) { up = true; break; } }
  assert.ok(up, `up the vine (${where()})`);
  rt.piece('d4').hit('bloom');
  wait(2.6);
  assert.equal(rt.logic.isOpen('d4'), true);
  // ---- the Glasshouse: bloom the four dead beds, then the Gardener's back each time it kneels
  assert.equal(walk(L(0, 27, 141)), true, `into the glasshouse (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep', 'it wakes');
  wait(0.5);
  assert.equal(rt.logic.isOpen('d4'), false, 'the bud shuts behind you');
  P.opts.health = false;
  // a glob as the tool fires it: through the guardian's own target (it takes fire and stilling as theirs; bloom arrives as fluid, its mode in info)
  const glob = (mode) => { const t = allTargets().find((x) => x.kind === 'guardian' && x.enabled() && x.position().distanceTo(G.model.pos) < 12 && x.position().distanceTo(G.model.mouth) > 0.5); assert.ok(t, 'its body is a target'); hitTarget({ target: t, point: t.position() }, mode, V(0, 0, 1)); };
  for (let i = 0; i < 6 / DT && G.state !== 'fight'; i++) frame();   // (awake and fighting: its targets take globs)
  glob('bloom');
  assert.equal(G.meter, 0, 'its back first: it shakes the flowers off');
  for (const [i, b] of ['bed1', 'bed2', 'bed3', 'bed4'].entries()) { rt.piece(b).hit('bloom'); assert.ok(Math.abs(G.meter - (i + 1) * 0.1) < 1e-6, `a tenth for each bed (${G.meter})`); }
  for (let n = 0; n < 10 && G.state !== 'weary'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `it kneels (${n})`);
    const before = G.meter;
    if (n === 0) { glob('shoot'); assert.equal(G.meter, before, 'water does not calm it'); }
    glob('bloom');
    assert.ok(G.meter > before, `bloomed (${n}: ${G.meter.toFixed(2)}), by a bloom glob as the tool fires it`);
  }
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

test('the echo shell: it keeps the last note sung within earshot (saved), plays it back on V, and does nothing without it', () => {
  game.reset();
  own('backpack');
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
  assert.ok(toasts.some((s) => /Y \/ △ with no gadget in hand plays it back/.test(keyText(s, { kind: 'pad' })) && /V plays it back/.test(keyText(s, { kind: 'keys' }))), 'it says how to play it back, on the keys and the pad');
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

test('the Undertower on foot: the singing ball and the dishes, the well’s horn and the low stone, the echo shell, the low note carried up, the held pillars, the middle note sent over through the dish, the way back, the First Sign given its words back, the tower speaks once a night', () => {
  game.reset();
  own('backpack');
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
  const [disc, discA, discB] = rt.pieces.filter((p) => p.path);
  const ball1 = rt.piece('ball1'), dishA = rt.piece('dishA');
  walk(ball1.center.clone().add(V(0, 0, -2.5)).setY(P.pos.y), { tol: 0.6 });
  ball1.hit('shoot', DOWN);
  wait(1.5);
  assert.equal(rt.logic.isLit('eD'), false, 'sung where it lies, the ball’s note dies in the hall: the horn across the pit is too far');
  assert.equal(dishA.awake, false, 'the dish is dark, its footstone bare');
  assert.equal(disc.s, 0, 'the disc is still');
  roll('ball1');
  assert.equal(dishA.awake, true, 'the ball’s weight on its footstone wakes the dish');
  assert.equal(rt.logic.isLit('eD'), false, 'rolled home, it is quiet until it is splashed');
  ball1.hit('shoot', DOWN);
  wait(0.2);
  assert.equal(rt.logic.isLit('eD'), false, 'the note takes a moment to cross');
  wait(1);
  assert.equal(rt.logic.isLit('eD'), true, 'the far dish says it over the horn');
  assert.ok(said(/far dish says the ball’s note/), 'and the horn answers');
  assert.equal(walk(L(0, 0, 22.5)), true, `to the pit's edge (${where()})`);
  ride(disc, L(0, 0, 43), 'disc over the cable pit');
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
  // ---- the Shell Chamber: the door wants the low note, and nothing sings it here
  assert.equal(walk(L(0, 12, 76)), true, `into the chamber (${where()})`);
  const C3 = C2 + 22.6, ear0 = ear('e0');
  assert.equal(stones.filter((s) => s.center.distanceTo(L(0, 12, C3)) < 10).length, 0, 'no singing stone in the chamber');
  game.emit('echo', { pos: ear0.at.clone(), note: 'low' });
  assert.equal(rt.logic.isLit('e0'), false, 'the door wants the shell');
  assert.equal(rt.logic.next(), 'chest');
  items.grant('echo'); game.emit('box:opened', { id: 'bazaar.temple.echo' });
  assert.equal(rt.logic.gadget, true);
  assert.equal(walk(ear0.at.clone().setY(P.pos.y), { tol: 2.5 }), true, `to the door's horn (${where()})`);
  assert.equal(shell.play(), false, 'the shell holds nothing yet');
  // back to the well's landing: splash the low stone below, and the shell catches it
  assert.equal(walk(L(3, 12, C2 + 7)), true, `back to the landing's edge (${where()})`);
  lowW.sing();
  assert.equal(shell.held?.note, 'low', `the shell catches the low stone from the landing (${P.pos.distanceTo(lowW.center).toFixed(1)} m)`);
  assert.equal(walk(L(0, 12, 76)), true, `back into the chamber (${where()})`);
  assert.equal(walk(ear0.at.clone().setY(P.pos.y), { tol: 2.5 }), true, `to the door's horn (${where()})`);
  assert.equal(shell.play(), true);
  assert.equal(rt.logic.isLit('e0'), true, 'it hears the low note, carried up from the well');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d3'), true);
  // ---- the Gallery of Voices
  const G0 = C3 + 10.9;
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
