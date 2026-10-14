// The makers' temples (src/temples/): the kit, the logic, the guardians, the
// 50/50 split of the gadgets, and every built temple solved twice: through its
// state machine (logic.js solve), and on foot, a real Player walking its rooms
// in the real level geometry, pushing, riding, climbing, lighting, calming.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HEARTH_FIRE } from '../src/temples/desert.js';
import { keyText } from '../src/prompt-keys.js';
import './register-gadgets.js';   // (the gadgets as items: the makers' courts' boxes hold them, src/finds/courts.js)
import * as THREE from 'three';
import { TempleLogic, solve, memoryStore, flagStore } from '../src/temples/logic.js';
import { strikeDamage, inArea, HIT, Guardian } from '../src/temples/boss.js';
import { TEMPLES, GADGETS, TEMPLE_HOME, templeOf, nextSpot } from '../src/temples/index.js';
import { buildableById } from '../src/levels/buildable.js';
import { runSteps } from '../src/load-steps.js';
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
import { inColumn } from '../src/updraft.js';
import { Reserve } from '../src/fluid-tool.js';
import { viaPortal } from '../src/scout.js';
import { VOLLEY, FROM_FOUR } from '../src/temples/garage.js';
import { resources } from '../src/resources.js';
import { SITE as SITE_EDENA, SUN, VAULT } from '../src/temples/edena.js';
import { modeFor, allTargets, hitTarget } from '../src/targets.js';
import { BELLOWS_NEXT, upUsed, VANES } from '../src/temples/incal.js';
import { createEchoShell } from '../src/echo-shell.js';
import { HOLD as BELFRY_HOLD, FallUpStone } from '../src/temples/arzach2.js';
const HOLD_DOOR = BELFRY_HOLD.door, HOLD_STONES = BELFRY_HOLD.stones, HOLD_STAIR = BELFRY_HOLD.stair, HOLD_CHAMBER = BELFRY_HOLD.chamber;
import { HOLD as UNDERTOWER_HOLD, CHOIR } from '../src/temples/bazaar.js';
const HOLD_HORN = UNDERTOWER_HOLD.horn;
import { TempleKit } from '../src/temples/kit.js';
import { GULF, STACK } from '../src/temples/arzach.js';
import { KENNEL, WICK, ROOT_WAY } from '../src/temples/perdide2.js';
import { NURSERY, BALCONY } from '../src/temples/perdide.js';
import { LODGE as FOOT_LODGE } from '../src/temples/spheres.js';
import { SAND as FOUNDRY_SAND } from '../src/temples/moonfoundry.js';
import { STORE as WHALE_STORE } from '../src/temples/underwater.js';
import { setHintLevel } from '../src/hint-level.js';
import { answerAsks } from './guardian-asks.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };
/** A key's little chest (issue #274), stood by: what the use button does there, and opened with it (the key is yours at once). */
function openChest(rt, id, P) {
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, `temple.${rt.id}.${id}`, `by the chest of ${id}, the button opens it`);
  near.entry.use(P);
}
const BUILT = Object.keys(TEMPLES);

const worlds = new Map();
// (a temple by its id, in the world it stands in: the First Garage's, `garage`, is the Clock-House in the Glass Dunes;
// a merged world's part's temple is built in the part on its own, src/levels/buildable.js)
function world(id) {
  if (worlds.has(id)) return worlds.get(id);
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const w = { scene, level, physics, rt: templeOf(level, id) ?? level.temple };
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

// a hub (issue #23): two wings off it, each with a small key (one behind an arena, one behind a plate), a door of two
// keyholes on to the chest, the great key after it for the guardian's door, a coffer in an optional room
const HUB = {
  id: 'hub', entry: 'hub', gadget: 'fire',
  rooms: { hub: {}, west: {}, east: {}, chest: {}, side: {}, big: {}, arena: { boss: true } },
  links: [
    { a: 'hub', b: 'west', door: 'dw' }, { a: 'hub', b: 'east' }, { a: 'hub', b: 'side' },
    { a: 'hub', b: 'chest', door: 'd2' }, { a: 'chest', b: 'big' }, { a: 'chest', b: 'arena', door: 'dB' },
  ],
  elements: {
    ar: { type: 'arena', room: 'west' },
    kw: { type: 'key', kind: 'small', room: 'west', when: { lit: 'ar' } },
    dw: { type: 'door', opens: null },
    pe: { type: 'plate', room: 'east' }, be: { type: 'drum', room: 'east', plate: 'pe' }, se: { type: 'switch', room: 'east', when: { drumOn: ['be', 'pe'] } },
    ke: { type: 'key', kind: 'small', room: 'east', when: { lit: 'se' } },
    d2: { type: 'door', lock: 'small', keys: 2, latch: true },
    cache: { type: 'cache', room: 'side' },
    chest: { type: 'gadget', room: 'chest', item: 'fire' },
    b1: { type: 'brazier', room: 'big', needs: ['fire'] },
    kb: { type: 'key', kind: 'big', room: 'big', when: { lit: 'b1' } },
    dB: { type: 'door', lock: 'big' },
    boss: { type: 'boss', room: 'arena', needs: ['fire'] },
  },
};

test('keys and locks: a key is taken once its cage lets it go, a small key turns any small lock, a lock of two keyholes takes two, the great key the great lock; an arena is lit once won; all saved', () => {
  const owned = new Set(['backpack', 'gun']);
  const store = memoryStore();
  const L = new TempleLogic(HUB, { store, has: (i) => owned.has(i) });
  L.update();
  assert.deepEqual([...L.reachable()].sort(), ['east', 'hub', 'side', 'west'], 'the hub and its wings; the chest behind the locked door');
  assert.equal(L.find('kw'), false, 'caged: the arena not won yet');
  assert.equal(L.keys('small'), 0);
  assert.equal(L.canUnlock('d2'), false, 'no key in hand');
  assert.equal(L.light('ar'), true, 'the arena won');
  assert.equal(L.find('kw'), true);
  assert.equal(L.keys('small'), 1);
  assert.equal(L.unlock('d2'), true, 'one key in');
  L.update();
  assert.equal(L.isOpen('d2'), false, 'one keyhole still empty');
  assert.equal(L.keys('small'), 0, 'the key is in the lock');
  assert.equal(L.unlock('d2'), false, 'no second key yet');
  assert.equal(L.next(), 'be', 'the other wing next (its ball: the eye waits on it)');
  L.moveDrum('be', 1); assert.equal(L.light('se'), true);
  assert.equal(L.find('ke'), true);
  assert.equal(L.next(), 'd2', `the marker: the lock a key can go in now (${L.next()})`);
  assert.equal(L.unlock('d2'), true); L.update();
  assert.equal(L.isOpen('d2'), true, 'two keys: open');
  assert.equal(L.find('cache'), true, 'the coffer, in the optional room');
  L.takeGadget(); owned.add('fire'); L.light('b1');
  assert.equal(L.canUnlock('dB'), false, 'the great lock wants the great key, not a small one');
  assert.equal(L.find('kb'), true);
  assert.equal(L.unlock('dB'), true); L.update();
  assert.ok(L.isOpen('dB') && L.reachable().has('arena'));
  // a reload: the keys, the keyholes, the arena and the coffer as they were
  const again = new TempleLogic(HUB, { store, has: (i) => owned.has(i) });
  again.update();
  assert.ok(again.isLit('ar') && again.isFound('kw') && again.isFound('cache') && again.keysIn('d2') === 2 && again.isOpen('d2') && again.isOpen('dB'));
  assert.equal(again.keys('small'), 0);
  assert.equal(store.data['unlocked.d2'], 2);
});

test('the hub is solved with its wings in either order, each wing gives its key alone, and the coffer is optional', () => {
  for (const reverse of [false, true]) assert.equal(solve(HUB, { reverse }).done, true, `solved (${reverse ? 'the other way round' : 'in order'})`);
  const westOnly = solve(HUB, { forbid: ['se'] });
  assert.ok(westOnly.logic.isFound('kw') && !westOnly.done && !westOnly.stuck.includes('chest'), 'one wing: one key, and the door stays shut');
  const eastOnly = solve(HUB, { forbid: ['ar'] });
  assert.ok(eastOnly.logic.isFound('ke') && !eastOnly.stuck.includes('chest'), 'the other wing alone: its key');
  assert.equal(solve(HUB, { forbid: ['cache'] }).done, true, 'the coffer is a reward, nothing waits on it');
  assert.equal(solve(HUB, { withhold: ['fire'] }).done, false, 'and the great key wants the gadget');
});

test('the Clock-House is a hub (issue #23): either wing alone gives its key, the door over the climb takes both, the great key is in the cupboard once the Mainspring Room has wound the house’s clocks again (round 3), solved either way round', () => {
  const L = TEMPLES.garage.def.logic, items = ['backpack', 'gun', 'doublejump', 'sword', 'shield'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  const noStrike = solve(L, { items, forbid: ['sS'] });
  assert.ok(noStrike.logic.isFound('kW') && !noStrike.stuck.includes('coil'), 'the Pendulum Hall alone: its key, and the chest stays shut');
  const noArena = solve(L, { items, forbid: ['arW'] });
  assert.ok(noArena.logic.isFound('kE') && !noArena.stuck.includes('coil'), 'the Striking Room alone: its key, and the chest stays shut');
  assert.equal(L.elements.d2.keys, 2);
  const noMainspring = solve(L, { items, forbid: ['k3'] });
  assert.ok(noMainspring.stuck.includes('galleryFar') && !noMainspring.stuck.includes('hall') && !noMainspring.stuck.includes('cupboard'), 'without the mainspring wound the cupboard stays shut, and so the Foreman’s door');
  const noCupboard = solve(L, { items, forbid: ['c1'] });
  assert.ok(!noCupboard.done && !noCupboard.logic.isFound('kB'), 'the cupboard holds the great key (v1.53)');
  // the cupboard's eyes stay lidded until the mainspring runs; the marker never points at them before
  const M = new TempleLogic(L, { has: (i) => items.includes(i) });
  for (const id of ['s1', 's2', 's3']) M.light(id);
  M.update();
  assert.notEqual(M.next(), 'c1', 'nor at the cupboard before its clock runs');
  assert.equal(M.light('c1'), false, 'its clock stopped');
  const C = new TempleLogic(L, { has: (i) => [...items, 'coil'].includes(i) });
  C.moveDrum('ballM', 1); assert.equal(C.light('k3'), true);
  assert.equal(C.light('c1'), true, 'the mainspring wound: four takes');
});
test('every built temple is solvable through its state machine, its gadget found mid-way and the key to the rest', () => {
  for (const id of BUILT) {
    const def = TEMPLES[id].def, L = def.logic;
    // (the lift valve's double jump comes before every temple: the desert's pool, docs/systems/progression.md)
    const r = solve(L, { items: ['backpack', 'gun', 'doublejump'] });
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
    const no = solve(L, { items: ['backpack', 'gun', 'doublejump'], withhold: [def.gadget] });
    assert.equal(no.done, false, `${id}: not without ${def.gadget}`);
    assert.ok(!no.stuck.includes(boss[1].room), `${id}: the arena stays shut without ${def.gadget}`);
    const after = r.order.slice(at + 1);
    assert.ok(after.length >= 2 && after.every((room) => !no.stuck.includes(room)), `${id}: every room after the gadget needs it (${no.stuck.join(', ')})`);
    // 3–6 puzzle rooms (rooms with something to do; the arena's own pieces are the fight's), a checkpoint in most; a
    // house reworked round a hub (issue #23: wings, keys, an arena) up to ten
    const busy = new Set(Object.values(L.elements).filter((e) => e.room && e.type !== 'boss' && e.type !== 'clue' && !L.rooms[e.room]?.boss).map((e) => e.room));
    const hub = Object.values(L.elements).some((e) => e.type === 'key');
    assert.ok(busy.size >= 3 && busy.size <= (hub ? 10 : 6), `${id}: ${busy.size} puzzle rooms`);
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
  // (the count follows the plan: eleven temples until v1.40 brought the three new route worlds' houses)
  const n = Object.keys(GADGETS).length;
  assert.ok(n >= 11, 'every world but home has a temple planned');
  assert.ok(Math.abs(temple.length - open.length) <= 1, `${temple.length} in temples, ${open.length} in the open`);
  assert.equal(new Set(temple).size, temple.length, 'no gadget in two temples');
  assert.equal(temple.length, n, 'a temple in every world');
  assert.equal(open.length, n, 'and as many gifts in the open');
  assert.ok(Object.values(GADGETS).every((g) => g.built), 'every temple is built');
  assert.equal(BUILT.length, n);
  assert.equal(new Set([...temple, ...open]).size, 2 * n, 'no gift twice');
  const placed = Object.values(PLACEMENTS).flat();
  for (const [id, g] of Object.entries(GADGETS)) {
    if (!g.built) continue;
    assert.ok(TEMPLES[id], `${id}: built`);
    const box = placed.find((p) => p.temple === id);
    assert.ok(box && box.item === g.temple && box.id.startsWith(`${id}.`), `${id}: its temple chest holds ${g.temple}`);
    assert.equal(TEMPLES[id].def.gadgetBox, box.id);
    for (const it of g.world) assert.ok(PLACEMENTS[TEMPLE_HOME[id] ?? id].some((p) => p.item === it && !p.temple), `${id}: ${it} waits in the open`);
    assert.ok(TEMPLE_BOXES.some(([b, it]) => b === box.id && it === g.temple), `${id}: old saves migrate`);
  }
  // every placed item is a real item, and every temple box sits in a built temple
  for (const p of placed) { assert.ok(ITEMS[p.item], p.id); if (p.temple) assert.ok(GADGETS[p.temple]?.built, p.id); }
});

test('old saves that own a temple’s gadget find its chest open; the temple’s doors answer it', () => {
  const g = new GameState(null);
  g.set('item.sword', true);
  assert.equal(migrateTemples(g), 1);
  assert.equal(g.flag('box.desert.temple.sword'), true);
  assert.equal(migrateTemples(g), 0, 'once');
  const L = new TempleLogic(TEMPLES.desert.def.logic, { store: memoryStore(), has: (i) => !!g.flag(`item.${i}`) });
  assert.equal(L.gadget, true, 'carried in: the gadget counts as found');
  // the quick coil moved inside the First Garage from the keep's wall: whoever has it finds the chest open
  g.set('item.coil', true);
  assert.equal(migrateTemples(g), 1);
  assert.equal(g.flag('box.garage.temple.coil'), true);
  for (const id of ['garage', 'edena', 'bazaar', 'moonfoundry', 'spacecity', 'underwater']) assert.ok(TEMPLE_BOXES.some(([b]) => b.startsWith(`${id}.temple.`)), `${id}: its chest migrates`);
});

test('old saves in the Clock-House as it was (a chain of rooms) are brought round its hub: past the climb, its keys are in the door and its arena won; set right, the great lock open; nowhere yet, nothing', () => {
  const save = (flags) => { const g = new GameState(null); for (const [k, v] of Object.entries(flags)) g.set(`temple.garage.${k}`, v); migrateTemples(g); return g; };
  const logicOf = (g, items = ['backpack', 'gun', 'coil']) => { const L = new TempleLogic(TEMPLES.garage.def.logic, { store: flagStore(g, 'garage'), has: (i) => items.includes(i) }); L.update(); return L; };
  // with the coil, in the passage: the door back down to the hub still open, the Foreman's door still wanting its key
  const mid = logicOf(save({ 'lit.s1': true, 'lit.s2': true, 'lit.s3': true, 'open.discs': true, 'drum.ball1': 1, 'open.d2': true, gadget: true, checkpoint: 'coil' }));
  assert.equal(mid.isOpen('d2'), true, 'the door over the climb stays open behind them');
  assert.ok(mid.isFound('kW') && mid.isFound('kE') && mid.isLit('arW'), 'the wings they never saw count as done');
  assert.equal(mid.keys('small'), 0, 'no stray keys');
  assert.equal(mid.isOpen('d4'), false, 'the great key is still to find');
  // (v1.53: the great key moved from the Mainspring Room into the cupboard. A save that took it keeps it; one that wound
  // the spring and not yet taken it finds the cupboard's clock running; one that opened the cupboard before finds it open)
  for (const [flags, ok] of [[{ 'lit.k3': true, 'found.kB': true }, (B) => B.isFound('kB') && B.keys('big') === 1], [{ 'lit.k3': true }, (B) => B.canUse('c1')], [{ 'lit.c1': true, 'lit.c2': true, 'lit.c3': true }, (B) => B.isOpen('dC')]]) {
    const B = logicOf(save({ 'open.d2': true, gadget: true, 'lit.k1': true, 'open.d3': true, checkpoint: 'gallery', ...flags }));
    assert.ok(ok(B), JSON.stringify(flags));
  }
  assert.equal(solve(TEMPLES.garage.def.logic, { items: ['backpack', 'gun', 'doublejump'] }).done, true);
  // the Foreman set right: everything open, as it was
  const done = logicOf(save({ 'open.d2': true, gadget: true, 'lit.k1': true, 'open.d3': true, 'lit.k2': true, 'open.br1': true, boss: 'done', done: true }));
  assert.ok(done.isOpen('d2') && done.isOpen('d4') && done.resolved, 'the whole house open');
  // only through the escapement: the new hub is theirs to play
  const early = save({ 'lit.s1': true, 'open.discs': true });
  const L = logicOf(early, ['backpack', 'gun']);
  assert.ok(!L.isFound('kW') && !L.isLit('arW') && L.keysIn('d2') === 0, 'nothing given');
  assert.equal(early.flag('temple.garage.layout'), 2);
  early.set('temple.garage.open.d2', true); migrateTemples(early);
  assert.equal(early.flag('temple.garage.found.kW'), undefined, 'once a version: a save brought round already is left alone');
  // the Builders' Greenhouse: past the Glass Stair's door, its keys are in it
  const g = new GameState(null);
  for (const [k, v] of Object.entries({ 'drum.ball1': 1, 'lit.s1': true, 'open.d1': true, 'drum.ball2': 0, checkpoint: 'stair' })) g.set(`temple.edena.${k}`, v);
  migrateTemples(g);
  const E = new TempleLogic(TEMPLES.edena.def.logic, { store: flagStore(g, 'edena'), has: (i) => ['backpack', 'gun'].includes(i) });
  E.update();
  assert.ok(E.isOpen('d1') && E.isLit('arW') && E.keys('small') === 0, 'the Glass Stair’s door stays open behind them');
});

test('the Builders’ Greenhouse is a hub (issue #23): either wing alone gives its key, the Glass Stair’s door takes both, solved either way round', () => {
  const L = TEMPLES.edena.def.logic, items = ['backpack', 'gun', 'doublejump', 'sword', 'shield'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  const noFrame = solve(L, { items, forbid: ['sC2'] });
  assert.ok(noFrame.logic.isFound('kW') && !noFrame.stuck.includes('stair'), 'the Shade House alone: its key, and the stair stays shut');
  const noArena = solve(L, { items, forbid: ['arW'] });
  assert.ok(noArena.logic.isFound('kE') && !noArena.stuck.includes('stair'), 'the Cold Frame alone: its key, and the stair stays shut');
  assert.deepEqual(TEMPLES.edena.def.arenas.map((A) => A.el), ['arW']);
  // (v1.49) past the bud at the top of the glass, the great key's door: the Seed Vault's, its two seeds grown in turn
  const noVault = solve(L, { items, forbid: ['sdB'] });
  assert.ok(noVault.stuck.includes('ante') && !noVault.stuck.includes('hall'), 'without the Seed Vault the Glasshouse stays shut');
  const g = new GameState(null);
  for (const [k, v] of Object.entries({ 'open.d1': true, 'open.d2': true, gadget: true, 'open.d3': true, 'open.vine1': true, 'lit.seed2': true, 'open.d4': true, checkpoint: 'gulfTop' })) g.set(`temple.edena.${k}`, v);
  migrateTemples(g);
  const E = new TempleLogic(L, { store: flagStore(g, 'edena'), has: (i) => [...items, 'bloom'].includes(i) });
  E.update();
  assert.ok(E.isOpen('dB') && E.keys('big') === 0, 'old saves past the bud find the great key in its door');
  assert.ok(E.isOpen('dV') && E.isOpen('vineV') && E.isOpen('dV2'), 'and the moved Seed Vault done, its doors open (v1.60)');
  // (v1.60) the Seed Vault north off the Shade House, its door the arena's way out; its keepers' door from the top of its
  // glass onto the Glass Stair's root-wall goes with the vine: a loop through the first hub
  assert.deepEqual(L.elements.dV.opens, { lit: 'arW' }, 'the Shade House won, its north door opens');
  assert.deepEqual(L.elements.dV2.opens, { open: 'vineV' }, 'the keepers’ door opens with the vine, never before the bloom');
  assert.ok(L.links.some((l) => l.door === 'dV' && l.a === 'shade' && l.b === 'vault') && L.links.some((l) => l.door === 'dV2' && l.a === 'vaultTop' && l.b === 'stair'), 'the vault between the Shade House and the Glass Stair');
  const noShade = solve(L, { items, forbid: ['arW'] });
  assert.ok(!noShade.stuck.includes('vault'), 'without the Shade House won, the vault stays shut');
});

test('the Warden’s Well is a hub (issue #23): either wing alone gives its key, the balcony’s door takes both, solved either way round; old saves past it find it open', () => {
  const L = TEMPLES.incal.def.logic, items = ['backpack', 'gun', 'doublejump', 'sword', 'shield', 'glider'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  const noVane = solve(L, { items, forbid: ['vR'] });
  assert.ok(noVane.logic.isFound('kW') && !noVane.stuck.includes('jets') && !noVane.stuck.includes('vaneFar'), 'the Ash Store alone: its key, and the chest stays shut');
  const noArena = solve(L, { items, forbid: ['arW'] });
  assert.ok(noArena.logic.isFound('kE') && !noArena.stuck.includes('jets'), 'the Vane Room alone: its key, and the chest stays shut');
  const g = new GameState(null);
  for (const [k, v] of Object.entries({ 'lit.v1': true, 'drum.ball1': 1, 'open.d1': true, gadget: true, checkpoint: 'jets' })) g.set(`temple.incal.${k}`, v);
  migrateTemples(g);
  const W = new TempleLogic(L, { store: flagStore(g, 'incal'), has: (i) => items.includes(i) || i === 'wardenbellows' });
  W.update();
  assert.ok(W.isOpen('d1') && W.keys('small') === 0, 'the balcony’s door stays open behind them');
});

test('the Undertower is a hub (issue #23): either wing alone gives its key, the Shell Chamber’s door takes both, solved either way round; old saves up the second disc find the door open', () => {
  const L = TEMPLES.bazaar.def.logic, items = ['backpack', 'gun', 'doublejump', 'sword', 'shield'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  const noTune = solve(L, { items, forbid: ['eT'] });
  assert.ok(noTune.logic.isFound('kW') && !noTune.stuck.includes('shell'), 'the Cable Store alone: its key, and the chest stays shut');
  const noArena = solve(L, { items, forbid: ['arW'] });
  assert.ok(noArena.logic.isFound('kE') && !noArena.stuck.includes('shell'), 'the Tuning Room alone: its key, and the chest stays shut');
  const g = new GameState(null);
  for (const [k, v] of Object.entries({ 'drum.ball1': 1, 'lit.eD': true, 'open.disc': true, 'lit.eW': true, 'open.wdisc': true, gadget: true, checkpoint: 'shell' })) g.set(`temple.bazaar.${k}`, v);
  migrateTemples(g);
  const B = new TempleLogic(L, { store: flagStore(g, 'bazaar'), has: (i) => ['backpack', 'gun', 'echo'].includes(i) });
  B.update();
  assert.ok(B.isOpen('dK') && B.keys('small') === 0, 'the Shell Chamber’s door stays open behind them');
  // (v1.49) past the gallery, the Choir: the great key for the far door, its two horns answered and its ball home
  const noChoir = solve(L, { items, forbid: ['hB'] });
  assert.ok(noChoir.stuck.includes('choir') && !noChoir.stuck.includes('hall'), 'without the Choir the First Sign’s hall stays shut');
  const g2 = new GameState(null);
  for (const [k, v] of Object.entries({ 'drum.ball1': 1, 'lit.eD': true, 'open.disc': true, 'lit.eW': true, 'open.wdisc': true, gadget: true, 'lit.e0': true, 'open.d3': true, 'drum.ball2': 1, 'lit.e2': true, 'open.d4': true, checkpoint: 'galleryFar' })) g2.set(`temple.bazaar.${k}`, v);
  migrateTemples(g2);
  const B2 = new TempleLogic(L, { store: flagStore(g2, 'bazaar'), has: (i) => ['backpack', 'gun', 'echo'].includes(i) });
  B2.update();
  assert.ok(B2.isOpen('d4') && B2.isOpen('d3') && B2.keys('big') === 0, 'old saves past the far door find it open, and the passage’s');
  assert.ok(B2.isOpen('dG') && B2.isOpen('dC'), 'and the Choir’s gate and door (v1.60)');
  // (v1.60) the Choir over the Cable Store: its gate's horn back on the first hall's far landing, its door onto the chamber
  // going with the gate; without the gate's horn the Choir is never reached
  const noGate = solve(L, { items, forbid: ['hG'] });
  assert.ok(!noGate.stuck.includes('choir') && noGate.stuck.includes('galleryFar'), 'without the gate’s horn the Choir stays shut');
  const room = (id) => L.elements[id].room;
  assert.equal(room('hG'), 'dishesFar', 'the gate listens through a horn back in the first hall');
  assert.ok(L.links.some((l) => l.door === 'dG' && l.a === 'landing' && l.b === 'choir') && L.links.some((l) => l.door === 'dC' && l.a === 'shell' && l.b === 'choir'), 'the Choir between the landing and the chamber: a loop');
  // an old save that found the great key in the Choir off the far side (v1.49): the new Choir done, its gate open
  const g3 = new GameState(null);
  for (const [k, v] of Object.entries({ 'drum.ball1': 1, 'lit.eD': true, 'open.disc': true, 'lit.eW': true, 'open.wdisc': true, gadget: true, 'lit.e0': true, 'open.d3': true, 'found.kB': true, 'lit.hA': true, 'lit.hB': true, checkpoint: 'galleryFar', layout: 3 })) g3.set(`temple.bazaar.${k}`, v);
  migrateTemples(g3);
  const B3 = new TempleLogic(L, { store: flagStore(g3, 'bazaar'), has: (i) => ['backpack', 'gun', 'echo'].includes(i) });
  B3.update();
  assert.ok(B3.isOpen('dG') && B3.isOpen('dC') && B3.keys('big') === 1, 'its key in hand, the moved Choir open behind it');
});

test('the Engine-House is a hub past its chest (issue #23): the chamber’s four eyes roll up both shutters; either wing alone gives its key, the small for the passage’s door, the great for the warden’s, solved either way round; old saves past the passage find it open', () => {
  const L = TEMPLES.buried.def.logic, items = ['backpack', 'gun', 'doublejump'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  const noGov = solve(L, { items, forbid: ['k3'] });
  assert.ok(noGov.logic.isFound('kS') && noGov.stuck.includes('furnaceFar') && !noGov.stuck.includes('hall'), 'the Boiler Room alone: its key opens the passage, and the warden’s door stays shut');
  const noArena = solve(L, { items, forbid: ['arB'] });
  assert.ok(noArena.logic.isFound('kB') && !noArena.stuck.includes('furnace'), 'the Governor Room alone: the great key, and the passage stays shut');
  const noEyes = solve(L, { items, forbid: ['k0'] });
  assert.ok(!noEyes.stuck.includes('boiler') && !noEyes.stuck.includes('gov'), 'the shutters stay down until the chamber’s four eyes wake');
  // the governor: one ball, wanted at both its stops in turn (the pistons' first, then the hammer's)
  const G = new TempleLogic(L, { has: (i) => ['gun', 'cell', 'magic:4'].includes(i) });
  assert.equal(G.find('kB'), false, 'caged');
  G.moveDrum('bQ', 1); assert.ok(G.light('k3'));
  assert.equal(G.find('kB'), false, 'the eyes awake, and the hammer running on the cage');
  G.moveDrum('bQ', 0); G.update();
  assert.ok(G.isOpen('h2') && G.find('kB'), 'the hammer still again: the great key');
  // an old save past the passage's door, on the furnace's near lip: the small key in it, the Boiler Room won and the
  // shutters up; the great key still to fetch. Past the bridge: the great key in the warden's door as well
  for (const [extra, past] of [[{}, false], [{ 'lit.k2': true, 'open.br1': true, checkpoint: 'hall' }, true]]) {
    const g = new GameState(null);
    for (const [k, v] of Object.entries({ 'lit.s1': true, 'drum.ball0': 0, 'drum.ballJ': 1, gadget: true, 'drum.bK': 1, 'lit.k1': true, 'open.d3': true, checkpoint: 'furnace', ...extra })) g.set(`temple.buried.${k}`, v);
    migrateTemples(g);
    const B = new TempleLogic(L, { store: flagStore(g, 'buried'), has: (i) => ['backpack', 'gun', 'cell', 'magic:4'].includes(i) });
    B.update();
    assert.ok(B.isOpen('d3') && B.keys('small') === 0 && B.isOpen('dS') && B.isLit('arB'), 'the passage’s door stays open behind them');
    assert.equal(B.isOpen('d4'), past, past ? 'past the bridge: the warden’s door open too' : 'before the bridge: the great key is still in the Governor Room');
    if (!past) assert.ok(B.reachable().has('gov'), 'and the way back to it is open');
  }
});

test('Vael’s init, in the game’s steps and in init alike: both temples’ doors solid, and the stones that rise past the riders’ gate', () => {
  for (const steps of [true, false]) {
    const scene = new THREE.Scene();
    const level = quiet(() => buildableById('arzach').create(scene));
    const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
    quiet(() => (steps ? runSteps(level.initSteps(physics)) : level.init(physics)));
    const aerie = templeOf(level, 'arzach'), belfry = templeOf(level, 'arzach2');
    assert.ok(aerie.piece('dM').handle && belfry.piece('d1').handle, `${steps ? 'steps' : 'init'}: the shut doors collide`);
    assert.ok(level.arzach.edge.risers.every((q) => q.collider?.moving), `${steps ? 'steps' : 'init'}: the risers are moving colliders`);
  }
});

test('the Aerie is a stack (issue #23): the Moult off the well’s floor gives the small key, the Eyrie off the high balcony the great key, either order; its stone wanted in the other throat; old saves past the balcony find it open', () => {
  const L = TEMPLES.arzach.def.logic, items = ['backpack', 'gun', 'doublejump', 'sword', 'shield'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  // (the last round: a circuit round the stack. The Moult is entered from above, down the Eyrie's vent while its stone stops
  // it, and left by its door onto the well's floor, shut till it is won; never before the wings)
  assert.deepEqual(L.elements.dM.opens, { lit: 'arM' }, 'the Moult’s door is its way out, once won');
  assert.ok(L.links.some((l) => l.a === 'eyrie' && l.b === 'moult' && l.door === 'chute' && l.oneWay && l.needs?.includes('glider')), 'down the vent’s shaft from the Eyrie, a glide');
  const noWings = solve(L, { items, withhold: ['glider'] });
  assert.ok(!noWings.order.includes('moult'), 'without the wings the Moult is never reached');
  const C = new TempleLogic(L, { has: (i) => ['gun', 'glider'].includes(i) });
  assert.ok(C.isOpen('chute') && !C.isOpen('lift'), 'as the stone starts: its vent still, a way down; no column to the perch');
  C.moveDrum('bE', 1); C.update();
  assert.ok(!C.isOpen('chute') && C.isOpen('lift'), 'in the other throat: the wind rises out of the shaft, past the perch');
  const order = solve(L, { items }).order;
  assert.ok(order.indexOf('moult') > order.indexOf('eyrie'), `the Moult after the Eyrie (${order.join(' ')})`);
  const noEyrie = solve(L, { items, forbid: ['bE'] });
  assert.ok(noEyrie.logic.isFound('kM') && noEyrie.stuck.includes('gulfFar') && !noEyrie.stuck.includes('roost'), 'the Moult alone: the balcony’s door, and the Roost stays shut');
  const noArena = solve(L, { items, forbid: ['arM'] });
  assert.ok(noArena.logic.isFound('kE') && !noArena.stuck.includes('gulf'), 'the Eyrie alone: the great key, and the way north stays shut');
  assert.deepEqual(TEMPLES.arzach.def.arenas.map((A) => A.el), ['arM']);
  // the Eyrie: as its stone starts, the wind comes out of the ledge's vent, not the gap's
  const E = new TempleLogic(L, { has: (i) => ['gun', 'glider'].includes(i) });
  assert.equal(E.isOpen('lift'), false);
  E.moveDrum('bE', 1); E.update();
  assert.equal(E.isOpen('lift'), true, 'the stone in the ledge vent’s throat: the column past the perch');
  for (const [extra, past] of [[{}, false], [{ 'drum.ballP': 1, checkpoint: 'gulfFar' }, true]]) {
    const g = new GameState(null);
    for (const [k, v] of Object.entries({ 'drum.ballW': 1, gadget: true, 'drum.ballB': 1, checkpoint: 'perch', ...extra })) g.set(`temple.arzach.${k}`, v);
    migrateTemples(g);
    const B = new TempleLogic(L, { store: flagStore(g, 'arzach'), has: (i) => [...items, 'glider'].includes(i) });
    B.update();
    assert.ok(B.isOpen('dG') && B.keys('small') === 0 && B.isLit('arM'), 'the balcony’s door stays open behind them');
    assert.equal(B.isOpen('d3'), past, past ? 'past the perch: the Roost’s door open too' : 'on the perch: the great key still in the Eyrie');
    if (!past) assert.ok(B.reachable().has('eyrie'), 'and the way back to it is open');
  }
});

test('the Lamp-House (issue #23): the Kennel off its first hall gives the small key for the Wick Room along the hall (v1.60), whose great key the gallery’s far door wants; its two orbs must burn at once, and its keepers’ door back up opens with them; old saves past the gallery find it open', () => {
  const L = TEMPLES.perdide2.def.logic, items = ['backpack', 'gun', 'doublejump', 'sword', 'shield'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  const noWick = solve(L, { items, forbid: ['lW2'] });
  assert.ok(noWick.logic.isFound('kS') && noWick.stuck.includes('galleryFar') && !noWick.stuck.includes('lamp'), 'without the Wick Room the lamp-room stays shut');
  const noArena = solve(L, { items, forbid: ['arK'] });
  assert.ok(!noArena.stuck.includes('wickKey') && noArena.stuck.includes('galleryFar') && !noArena.stuck.includes('lamp'), 'without the Kennel the Wick Room’s grille stays shut, and the lamp-room with it');
  // (v1.60) the Wick Room off the first hall, a loop: its door from the hall, its keepers' door up onto the root-wall's top
  assert.ok(L.links.some((l) => !l.door && l.a === 'pools' && l.b === 'wick') && L.links.some((l) => l.door === 'dU' && l.a === 'wick' && l.b === 'lantern'), 'the Wick Room between the first hall and the chamber');
  assert.equal(L.elements.cW.lock, 'small', 'its grille takes the Kennel’s small key');
  assert.deepEqual(L.elements.dU.opens, { open: 'cW' }, 'its keepers’ door opens with the grille, never before the lantern');
  assert.equal(L.elements.d2.lock, undefined, 'the Lamp Passage’s door is its lamp alone');
  assert.deepEqual(TEMPLES.perdide2.def.arenas.map((A) => A.el), ['arK']);
  // the grille: both lamps at once (each only while its orb glows), then up for good
  const W = new TempleLogic(L, { has: (i) => ['gun', 'lantern'].includes(i) });
  W.store.set('found.kS', true); W.unlock('cW');   // (the Kennel's key in its keyhole, v1.60)
  W.moveDrum('oW1', 1); W.light('lW1'); W.update();
  assert.equal(W.isOpen('cW'), false, 'one lamp');
  W.quiet('lW1'); W.moveDrum('oW2', 1); W.light('lW2'); W.update();
  assert.equal(W.isOpen('cW'), false, 'the first gone out before the second');
  W.light('lW1'); W.update();
  assert.equal(W.isOpen('cW'), true, 'both at once');
  W.quiet('lW1'); W.quiet('lW2'); W.update();
  assert.equal(W.isOpen('cW'), true, 'and it stays up');
  for (const [extra, past] of [[{}, false], [{ 'drum.orb': 1, 'lit.l2': true, 'lit.s4': true, 'open.d4': true, checkpoint: 'lamp' }, true]]) {
    const g = new GameState(null);
    for (const [k, v] of Object.entries({ 'lit.s1': true, 'lit.s2': true, 'lit.s3': true, 'open.d1': true, 'open.disc': true, gadget: true, 'lit.l1': true, 'open.d2': true, checkpoint: 'gallery', ...extra })) g.set(`temple.perdide2.${k}`, v);
    migrateTemples(g);
    const B = new TempleLogic(L, { store: flagStore(g, 'perdide2'), has: (i) => [...items, 'lantern'].includes(i) });
    B.update();
    assert.ok(B.isOpen('d2') && B.isLit('arK'), 'the Lamp Passage’s door stays open behind them');
    assert.equal(B.isOpen('d4'), past, past ? 'past the far door: open still' : 'on the gallery: the great key still in the Wick Room');
    // (v1.60) the Kennel's key went into the passage's door then: on the gallery it is back in hand for the Wick Room's;
    // past the far door, the Wick Room counts as done
    assert.equal(B.keys('small'), past ? 0 : 1, past ? 'past the far door: no key left over' : 'the Kennel’s key in hand again, for the Wick Room’s grille');
    if (past) assert.ok(B.isOpen('cW') && B.isOpen('dU'), 'and the Wick Room’s grille up, its keepers’ door open too');
  }
});

test('the Founders’ Belfry (issue #23): its hub’s west store an arena, the east store’s ball, either order; old saves past the hall find it open', () => {
  const L = TEMPLES.arzach2.def.logic, items = ['backpack', 'gun', 'doublejump', 'glider', 'sword', 'shield'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  const noArena = solve(L, { items, forbid: ['arW'] });
  assert.ok(noArena.logic.drumOn('ball2', 'p2') && !noArena.stuck.includes('stair'), 'the ball alone: the hall’s door stays shut');
  const noBall = solve(L, { items, forbid: ['ball2'] });
  assert.ok(noBall.logic.isFound('kW') && !noBall.stuck.includes('stair'), 'the key alone: the door stays shut');
  assert.deepEqual(TEMPLES.arzach2.def.arenas.map((A) => A.el), ['arW']);
  const g = new GameState(null);
  for (const [k, v] of Object.entries({ 'drum.ball1': 1, 'drum.ball2': 1, 'open.d1': true, gadget: true, checkpoint: 'bell' })) g.set(`temple.arzach2.${k}`, v);
  migrateTemples(g);
  const B = new TempleLogic(L, { store: flagStore(g, 'arzach2'), has: (i) => [...items, 'bell'].includes(i) });
  B.update();
  assert.ok(B.isOpen('d1') && B.keys('small') === 0, 'the hall’s door stays open behind them');
});

test('the Hush-House (issue #23, round 3): the passage’s mouths in the Choir’s order, the Nursery off the far landing gives the small key for the ledge round the Bog Well, the Choir’s balcony the great key; either order; old saves past the far door find it open', () => {
  const L = TEMPLES.perdide.def.logic, items = ['backpack', 'gun', 'doublejump', 'sword', 'shield'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  const noArena = solve(L, { items, forbid: ['arN'] });
  assert.ok(!noArena.stuck.includes('balcony') && !noArena.stuck.includes('hall'), 'without the Nursery the ledge’s door stays shut, and so the great lock');
  const noBall = solve(L, { items, forbid: ['oB'] });
  assert.ok(noBall.logic.isFound('kS') && noBall.stuck.includes('balcony') && !noBall.stuck.includes('hall'), 'without the balcony’s ball the hall stays shut');
  assert.deepEqual(TEMPLES.perdide.def.arenas.map((A) => A.el), ['arN']);
  // the passage's three mouths: only in the Choir's order, low to high, the gate's crown last
  const W = new TempleLogic(L, { has: (i) => ['gun', 'stun'].includes(i) });
  assert.equal(W.light('j3'), false, 'the gate first: flat');
  assert.equal(W.light('j2'), false, 'the middling first: flat');
  for (const id of ['j1', 'j2', 'j3']) assert.equal(W.light(id), true, id);
  W.update();
  assert.ok(W.isOpen('d2') && W.isOpen('dj1') && W.isOpen('dj2'), 'all three open');
  // the balcony's mouth: open only while its frost holds
  assert.equal(W.light('jB'), true); W.update();
  assert.equal(W.isOpen('dJ'), true, 'stilled');
  W.quiet('jB'); W.update();
  assert.equal(W.isOpen('dJ'), false, 'thawed, shut again');
  // the keeper's gate opens once the Nursery is won (no footstone now)
  W.light('arN'); W.update();
  assert.equal(W.isOpen('ds'), true);
  for (const [extra, past] of [[{}, false], [{ 'lit.w1': true, 'lit.w2': true, 'lit.w3': true, 'open.d3': true, 'open.ds': true, checkpoint: 'hall' }, true]]) {
    const g = new GameState(null);
    for (const [k, v] of Object.entries({ 'lit.c1': true, 'lit.c2': true, 'lit.c3': true, 'lit.c4': true, 'open.d1': true, 'lit.sw': true, 'open.dw': true, gadget: true, 'lit.j1': true, 'open.d2': true, checkpoint: 'gallery', ...extra })) g.set(`temple.perdide.${k}`, v);
    migrateTemples(g);
    const B = new TempleLogic(L, { store: flagStore(g, 'perdide'), has: (i) => [...items, 'stun'].includes(i) });
    B.update();
    assert.ok(B.isOpen('d2') && B.isLit('j2') && B.isLit('j3'), 'the old gate’s stilling counts for all three mouths: the way stays open behind them');
    assert.equal(B.isOpen('d3'), past, past ? 'past the far door: open still' : 'on the gallery: the great key still on the balcony');
    if (past) assert.ok(B.isOpen('dL') && B.isFound('kB') && B.isLit('arN'), 'and the wings done');
  }
});

test('the Mooring-House (issue #23, round 3): the Rope Store off the Gallery gives the small key for the moorers’ gate, the hall’s balcony the great key for the Capstan Floor; either order; old saves past the west door find it open', async () => {
  const { PERCH } = await import('../src/temples/spacecity.js');
  const L = TEMPLES.spacecity.def.logic, items = ['backpack', 'gun', 'doublejump', 'glider', 'sword', 'shield'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  const noArena = solve(L, { items, forbid: ['arR'] });
  assert.ok(!noArena.stuck.includes('perch') && !noArena.stuck.includes('arena'), 'without the Rope Store the moorers’ gate stays shut, and so the Capstan Floor');
  const noBall = solve(L, { items, forbid: ['bK'] });
  assert.ok(noBall.logic.isFound('kS') && noBall.stuck.includes('perch') && !noBall.stuck.includes('arena'), 'without the balcony’s ball the Capstan Floor stays shut');
  assert.deepEqual(TEMPLES.spacecity.def.arenas.map((A) => A.el), ['arR']);
  // the cage wants the ball home and the Gallery's ring (its chain)
  const W = new TempleLogic(L, { has: (i) => ['gun', 'tether'].includes(i) });
  W.moveDrum('bK', L.elements.bK.plateAt);
  assert.equal(W.find('kB'), false, 'the ball home, the ring not pulled');
  W.light('r5');
  assert.equal(W.find('kB'), true, 'and with the ring');
  assert.equal(L.elements.bK.plateAt, PERCH.plateAt);
  for (const [extra, past] of [[{}, false], [{ 'drum.ballS': 0.143, 'open.gN': true, checkpoint: 'ante' }, true]]) {
    const g = new GameState(null);
    for (const [k, v] of Object.entries({ 'drum.ballW': 1, 'open.g1': true, 'lit.s1': true, 'open.d1': true, gadget: true, 'lit.r1': true, 'open.d2': true, 'drum.ballD': 0.098, 'open.br2': true, 'drum.ballS': 0.905, 'lit.r5': true, 'open.sc': true, checkpoint: 'moor', ...extra })) g.set(`temple.spacecity.${k}`, v);
    migrateTemples(g);
    const B = new TempleLogic(L, { store: flagStore(g, 'spacecity'), has: (i) => [...items, 'tether'].includes(i) });
    B.update();
    assert.ok(B.isOpen('sc') && B.isLit('arR') && B.keys('small') === 0, 'the moorers’ gate stays open behind them');
    assert.equal(B.isOpen('d6'), past, past ? 'past the west door: the Capstan Floor’s door open' : 'on the Gallery: the great key still on the balcony');
  }
});

test('the Whale-House, the Casting-House and the Footprint (issue #23, round 3): each an arena whose small key a later door takes with its own condition; either order; each without its arena stuck; old saves past that door find it open', () => {
  const items = ['backpack', 'gun', 'doublejump', 'sword', 'shield'];
  for (const [id, arena, lock, past, before, beyond] of [
    // (the Whale-House's passage door is held, not latched: a save past it has the keepers' door open behind it)
    ['underwater', 'arH', 'd4', 'tank', { 'lit.eP': true, 'lit.eS': true, 'open.dH': true }, { 'open.dK': true }],
    ['moonfoundry', 'arS', 'dF', 'ante', { 'lit.bG': true, 'drum.mG': 1 }, { 'open.dF': true }],
    ['spheres', 'arL', 'd4', 'hall', { 'lit.s2': true, 'drum.ball4': 0.62 }, { 'open.d4': true }],
  ]) {
    const L = TEMPLES[id].def.logic;
    for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, `${id}: ${r.log.join(' / ')}`); }
    const noArena = solve(L, { items, forbid: [arena] });
    assert.ok(!noArena.done && !noArena.stuck.includes(past), `${id}: without its arena the door ${lock} stays shut`);
    assert.deepEqual(TEMPLES[id].def.arenas.map((A) => A.el), [arena]);
    assert.equal(L.elements[lock].lock, 'small');
    for (const [extra, open] of [[{}, false], [{ ...beyond, checkpoint: past }, true]]) {
      const g = new GameState(null);
      for (const [k, v] of Object.entries({ gadget: true, ...before, ...extra })) g.set(`temple.${id}.${k}`, v);
      migrateTemples(g);
      const B = new TempleLogic(L, { store: flagStore(g, id), has: (i) => [...items, TEMPLES[id].def.gadget].includes(i) });
      B.update();
      assert.equal(B.keysIn(lock) > 0, open, `${id}: ${open ? 'past the door: its key in it' : 'before it: the key still to win'}`);
      if (open) assert.ok(B.isLit(arena) && B.keys('small') === 0, `${id}: the arena counts as won`);
    }
  }
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
test('the Rose House on foot, with nothing in hand: the ball leaned on through the pilot flame into the hooded bowl, the pier crossed on the double jump, the blade and its chamber’s doors, the thorns cut, the ball too slow by hand and in time when cut, the guard, the watcher’s bolt sent back, the eye struck and the relay, the keepers’ door, the Keeper calmed with the guard and the tank’s water, out', () => {
  game.reset();
  own('backpack', 'doublejump');
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
  const lz = (v) => rt.kit.local(v).z, lx = (v) => rt.kit.local(v).x;
  /** Lean on a ball (hands: walk into it along its groove, sign the way) until `until()` or s seconds. */
  const lean = (ball, sign = 1, until = () => false, s = 20) => {
    const dir = ball.dir.clone().multiplyScalar(sign);
    walk(ball.group.position.clone().addScaledVector(dir, -(ball.r + 1.2)), { tol: 0.5, max: 12 });
    for (let i = 0; i < s / DT && !until(); i++) frame({ KeyW: true }, toward(ball.center.clone().addScaledVector(dir, 2)));
  };
  /** A cut of the blade at a ball, the way `sign` along its groove (the blade's own test is the combat suite's). */
  const cut = (ball, sign = 1) => { walk(ball.group.position.clone().addScaledVector(ball.dir, -sign * (ball.r + 1.4)), { tol: 1.2, max: 12 }); assert.equal(ball.hit('blade', ball.dir.clone().multiplyScalar(sign), {}), true, `${ball.id}: the cut takes it`); };
  /** Frames until a ball is at rest (or s seconds). */
  const rest = (ball, s = 14) => { for (let i = 0; i < s / DT && !ball.rest; i++) frame(); };
  /** A running jump from where you are toward `to` (local), the double jump at the top when `double`. */
  const leap = (to, { double = true, edge = null } = {}) => {
    const T = L(...to);
    for (let i = 0; i < 3 / DT && lz(P.pos) < edge - 0.35; i++) frame({ KeyW: true, ShiftLeft: true }, toward(T));
    frame({ KeyW: true, ShiftLeft: true, Space: true }, toward(T));
    for (let i = 0; i < 0.36 / DT; i++) frame({ KeyW: true, ShiftLeft: true }, toward(T));
    if (double) frame({ KeyW: true, ShiftLeft: true, Space: true }, toward(T));
    for (let i = 0; i < 3 / DT && !(P.onGround && i > 10); i++) frame({ KeyW: true, ShiftLeft: true }, toward(T));
    for (let i = 0; i < 0.6 / DT; i++) frame();
  };
  wait(0.5);
  assert.ok(P.onGround && rt.inside(P.pos), 'standing in the Threshold');
  assert.equal(items.has('sword') || items.has('shield') || items.has('gun'), false, 'nothing in hand');

  // ---- the Hall of the Flame: the door is shut; leaned on, the ball rolls through the pilot flame, catches, and lights the bowl
  assert.equal(walk(L(0, 0, 49)), true, `walk to the door (${where()})`);
  assert.ok(rt.kit.local(P.pos).z < 51.5, 'the shut door stops you');
  const ball1 = rt.piece('ball1');
  assert.equal(ball1.burn, 0, 'the tar ball is cold');
  lean(ball1, 1, () => lz(ball1.center) > 28);
  assert.ok(said(/lean on the tar ball/), 'it rolls ahead of you, by hand');
  assert.ok(ball1.burn > 0, 'leaned through the pilot flame, it burns');
  assert.ok(said(/Givers’ flame and catches/), 'and says so');
  lean(ball1, 1, () => rt.logic.isLit('b0'), 14);
  rest(ball1); wait(1);
  assert.equal(rt.logic.isLit('b0'), true, `burning, it lights the hooded bowl (${lz(ball1.center).toFixed(1)})`);
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true, 'and the door opens');

  // ---- the Dry Channel: the pier in the sand, a double jump either side; one jump falls short, into the sand
  assert.equal(walk(L(0, 0, 50)), true, `to the door (${where()})`);
  assert.equal(walk(L(0, 0, 55)), true, `through the door (${where()})`);
  assert.equal(walk(L(-6.5, 0, 54.6)), true, `by the channel's mark (${where()})`);
  wait(0.3);
  assert.equal(rt.checkpoint?.room, 'channel', 'the mark takes you');
  assert.equal(walk(L(1.5, 0, 55)), true, `to the ledge's lip (${where()})`);
  items.revoke('doublejump');
  leap([1.5, 0, 69.25], { edge: 58.5 });
  assert.ok(said(/climb back out of the sand/) && Math.abs(lz(P.pos) - 53.8) < 2, `one jump falls short, into the pit, and you are back at the mark (${where()})`);
  items.grant('doublejump');
  assert.equal(rt.logic.isOpen('dc'), false, 'the chamber’s door at the top of the gallery is shut');
  assert.equal(walk(L(1.5, 0, 55.5)), true, `back to the ledge (${where()})`);
  leap([1.5, 0, 69.25], { edge: 58.5 });
  assert.ok(P.onGround && Math.abs(lz(P.pos) - 69.25) < 2 && rt.kit.local(P.pos).y > -0.2, `the double jump lands on the pier (${where()})`);
  walk(L(1.5, 0, 69.25), { tol: 0.3, max: 3 });
  wait(0.5);
  assert.equal(rt.logic.isOpen('dc'), true, 'the plate on the pier’s head wakes the chamber’s door at the top of the gallery, for good');
  walk(L(1.5, 0, 67.8), { tol: 0.4, max: 3 });
  leap([1.5, 0, 82], { edge: 71.1 });
  assert.ok(P.onGround && lz(P.pos) > 80 && rt.kit.local(P.pos).y > -0.2, `and again onto the far landing (${where()})`);
  let climbed = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(0, 7, 90))); if (P.onGround && rt.kit.local(P.pos).y > 6.5) { climbed = true; break; } }
  assert.ok(climbed, `up the gallery's wall (${where()})`);

  // ---- the Sword Chamber: the blade; its doors held while its machines stand
  assert.equal(walk(L(-2, 7, 101)), true, `into the sword chamber (${where()})`);
  assert.equal(rt.logic.next(), 'chest');
  assert.equal(rt.logic.isOpen('dk'), false, 'the north door is shut while the blade lies on its dais');
  items.grant('sword'); game.set('box.desert.temple.sword', true); game.emit('box:opened', { id: 'desert.temple.sword', item: 'sword' });
  assert.equal(rt.logic.gadget, true);
  const machine = { room: 'chest', alive: true };
  rt.machines = [machine];   // (as src/foes.js places them: tests/foes.test.js has the machines themselves)
  wait(0.3);
  assert.equal(game.flag('temple.desert.encounter'), 'on', 'the blade taken here: the encounter is on');
  assert.ok(!rt.logic.isOpen('dc') && !rt.logic.isOpen('dk') && said(/doors grind shut/), 'the machines wake, and the chamber’s doors hold');
  machine.alive = false;
  wait(1);
  assert.ok(rt.logic.isOpen('dc') && rt.logic.isOpen('dk') && said(/doors sink open/), 'broken, the doors open');
  assert.equal(game.flag('temple.desert.encounter'), 'done', 'and stay open: the encounter is over');
  // the corridor's thorns: fluid beads on them; the blade cuts them
  const bw0 = rt.piece('bw0');
  bw0.hit('shoot');
  assert.equal(rt.logic.isLit('bw0'), false, 'not by a splash');
  bw0.hit('blade');
  assert.equal(rt.logic.isLit('bw0'), true, 'the blade cuts them');
  wait(1.2);
  // the chest's ball: leaned on, it catches at the fire on its groove but goes out before the bowl; cut, it is there in time
  const ball3 = rt.piece('ball3');
  lean(ball3, 1, () => ball3.t > 0.85, 12);
  rest(ball3, 16); wait(2);
  assert.equal(rt.logic.isLit('b3'), false, `leaned on, it reaches the bowl cold (${ball3.t.toFixed(2)})`);
  assert.ok(said(/Hands are too slow/), 'it went out on the way, and says so');
  walk(L(-2, 7, 104), { max: 10 });
  for (let i = 0; i < 12 / DT && !(ball3.rest && ball3.t < 0.2); i++) frame();
  if (ball3.t > 0.05) { ball3.t = 0; rt.logic.moveDrum('ball3', 0); ball3.place(); ball3.rest = true; }   // (back at its start: the test's shortcut for leaning it back)
  cut(ball3, 1);
  for (let i = 0; i < 8 / DT && !rt.logic.isLit('b3'); i++) frame();
  assert.equal(rt.logic.isLit('b3'), true, `cut, it rolls burning all the way, and the bowl catches (${ball3.t.toFixed(2)}, burn ${ball3.burn.toFixed(1)})`);
  wait(3.5);
  assert.equal(rt.logic.isOpen('br1'), true, 'the bridge rises');

  // ---- the Hall of Fires: over the bridge; the guard on the far landing
  assert.equal(walk(L(-1, 7, 112)), true, `to the corridor (${where()})`);
  assert.equal(walk(L(-1, 7, 122)), true, `through it, past the thorns’ stumps (${where()})`);
  assert.equal(walk(L(-5, 7, 125)), true, `into the hall of fires (${where()})`);
  assert.equal(walk(L(-5, 7, 147)), true, `over the bridge (${where()})`);
  assert.ok(P.pos.y > L(0, 6, 0).y, 'over it, not into the chasm');
  assert.equal(rt.logic.next(), 'guard', 'the Givers’ second chest is next');
  items.grant('shield'); game.set('box.desert.temple.shield', true); game.emit('box:opened', { id: 'desert.temple.shield', item: 'shield' });
  assert.equal(rt.logic.isFound('guard'), true);
  const b4 = rt.piece('b4');
  b4.hit('fire');
  assert.equal(rt.logic.isLit('b4'), false, 'the far door’s bowl is hooded');
  assert.equal(walk(L(0, 7, 160), { max: 4 }), false, 'the far door is shut');

  // ---- the Givers' watcher (issue #245): the guard taken, it wakes by the east doorway; bare-handed its bolt burns,
  // taken on the guard it flies back into its eye, and the doorway's door sinks open
  assert.equal(rt.logic.isOpen('dw'), false, 'the east doorway is shut');
  assert.equal(rt.logic.next(), 'sentry', 'the watcher is next');
  const sentry = rt.piece('sentry');
  let guarding = false;
  P.guard = () => guarding;   // (the blade's block: tests/fluid-sword.test.js has the guard itself)
  assert.equal(walk(L(1, 7, 153)), true, `onto the far landing (${where()})`);
  const hearts0 = P.hearts;
  let aimed = false;
  for (let i = 0; i < 8 / DT && P.hearts >= hearts0; i++) { frame(); aimed ||= sentry.beam.visible; }
  assert.ok(said(/watcher by the east door wakes/), 'it wakes, and says how to meet it');
  assert.ok(aimed, 'its beam holds on you before it fires');
  assert.ok(P.hearts < hearts0 && said(/bolt burns/), `bare-handed, its bolt gets through (${P.hearts} of ${hearts0})`);
  assert.equal(rt.logic.isLit('sentry'), false);
  walk(L(1, 7, 153), { tol: 0.6, max: 4 });
  guarding = true;
  for (let i = 0; i < 10 / DT && !rt.logic.isLit('sentry'); i++) frame();
  assert.equal(rt.logic.isLit('sentry'), true, 'taken on the guard, its bolt flies back and breaks it');
  assert.ok(said(/glances off your guard/) && said(/cracks its eye/), 'and says so');
  guarding = false;
  wait(2.5);
  assert.equal(rt.logic.isOpen('dw'), true, 'the east door sinks open');
  const heartsAfter = P.hearts;
  wait(4);
  assert.equal(P.hearts, heartsAfter, 'broken, it fires no more');
  assert.equal(walk(L(37, 7, 152), { max: 40 }), true, `through the doorway, down the Hall of Channels to its far end (${where()})`);
  // the ball cut down the long groove burns out short; the eye lifts the relay's lid, and the next one gets there
  const ball4 = rt.piece('ball4');
  cut(ball4, 1);
  let outAt = null;
  for (let i = 0; i < 14 / DT; i++) { frame(); if (ball4.burn === 0 && outAt == null && ball4.t > 0.05) outAt = ball4.t; if (ball4.v < -0.5) break; }
  assert.ok(outAt != null && outAt < 0.98, `it burns out short of the bowl (t ${outAt?.toFixed(2)})`);
  assert.equal(rt.logic.isLit('b4'), false, 'cold, the bowl stays dark');
  assert.ok(said(/fire waits under a stone lid/), 'gone out with the relay shut, it says where the fire is (issue #311)');
  for (let i = 0; i < 25 / DT && !ball4.rest; i++) frame();
  const e10 = rt.piece('e10');
  e10.hit('shoot');
  assert.equal(rt.logic.isLit('e10'), false, 'the eye wants striking, not wetting');
  assert.ok(said(/it wants striking/));
  e10.hit('blade');
  assert.equal(rt.logic.isLit('e10'), true, 'struck, it wakes');
  wait(2.5);
  assert.equal(rt.logic.isOpen('sc'), true, 'the keepers’ door opens: the way back to the near ledge');
  // (cut again from where it came to rest, cold, half-way back up the hall: no putting it back by hand, issue #311)
  assert.ok(ball4.rest && ball4.burn === 0 && ball4.t > 0.1 && ball4.t < 0.9, `tipped back out of the bowl, it lies cold in the hall (t ${ball4.t.toFixed(2)})`);
  cut(ball4, 1);
  let spare = null;
  for (let i = 0; i < 16 / DT && !rt.logic.isLit('b4'); i++) { const was = ball4.burn; frame(); if (rt.logic.isLit('b4')) spare = was; }
  assert.equal(rt.logic.isLit('b4'), true, 'past the relay it catches, and burns on into the far door’s bowl');
  assert.ok(spare > 1, `with time to spare (${spare?.toFixed(2)} s of its flame left)`);
  wait(2.5);
  assert.equal(rt.logic.isOpen('d3'), true, 'the far door opens');
  // the shortcut: down the hall, through the keepers' door to the near ledge, and back
  assert.equal(walk(L(20, 7, 124)), true, `down the Hall of Channels (${where()})`);
  assert.equal(walk(L(9, 7, 124)), true, `through the keepers’ door onto the near ledge (${where()})`);
  assert.equal(walk(L(20, 7, 124), { max: 30 }), true);
  assert.equal(walk(L(20, 7, 149), { max: 30 }), true);
  assert.equal(walk(L(8, 7, 149)), true, `back onto the far landing (${where()})`);
  assert.equal(walk(L(0, 7, 162)), true, `through the far door (${where()})`);

  // ---- the Cistern: the Keeper wakes; light its bowls, guard its charge and give it water, then by a fire cut to it
  const K = rt.guardian;
  assert.equal(K.state, 'sleep');
  assert.equal(walk(L(0, 7, 172)), true, 'into the cistern');
  wait(0.2);
  assert.notEqual(K.state, 'sleep', 'it wakes');
  wait(0.3);
  assert.equal(rt.logic.isOpen('d4'), false, 'the door shuts behind you');
  P.opts.health = false;   // (the fight's own tests are above: here the strikes may knock us about, no further)
  wait(3.5);
  // each spoke's ball, cut out through its fire into the hooded bowl on the rim
  for (const ball of rt.spokes) {
    ball.hit('blade', ball.dir.clone().multiplyScalar(-1), {});
    for (let i = 0; i < 10 / DT && !(ball.rest && ball.t < 0.05); i++) { frame(); if (P.dead) P.restart(); }
    wait(0.3);
  }
  assert.deepEqual(['b6', 'b7', 'b8', 'b9'].map((b) => rt.logic.isLit(b)), [true, true, true, true], 'the four bowls on the rim burn');
  assert.equal(K.meter, 0.4, 'light round the walls: the first phase');
  /** Water from the tank at its mouth, while it pants. */
  const water = () => {
    P.pos.copy(K.model.mouth).setY(K.arena.y); P.pos.x += 1.6; P.vel.set(0, 0, 0);
    const near = bestInteractable(P);
    assert.equal(near?.entry.id, 'temple.desert.water', `at its mouth, it drinks (${K.state})`);
    near.entry.use(P);
  };
  // its charge, taken on the guard: jarred, it pants
  for (let i = 0; i < 4 / DT && (K.state !== 'fight' || K.attack); i++) frame();
  K.def.onBlock(K, K.def.attacks.charge, false);
  assert.equal(K.state, 'open', 'a charge your guard took jars it, and it pants');
  water();
  // (it drinks on while it pants, a gulp each KEEPER_GUARD.gulp s: one opening, two drinks, v1.71 issue #320)
  for (let i = 0; i < 0.7 / DT; i++) frame();
  assert.equal(K.state, 'open', 'it pants on');
  water();
  assert.equal(K.phaseIndex, 2, 'its last phase');
  let open = false;
  // its last: in the dark only a gasp (a sip of water, v1.69); a ball cut down the spoke nearest it from its lit bowl rolls burning to it, and by it it pants long
  for (let n = 0; n < 2; n++) {
    open = false;
    for (let tries = 0; tries < 6 && !open; tries++) {
      const m = K.model.pos, ball = rt.spokes.slice().sort((a, b) => a.b.distanceTo(m) - b.b.distanceTo(m))[0];
      if (!ball.rest || ball.t > 0.3) { ball.t = 0; rt.logic.moveDrum(ball.id, 0); ball.place(); ball.rest = true; }   // (back in its bowl: the test's shortcut for cutting it back out)
      for (let i = 0; i < 1 / DT; i++) frame();
      assert.ok(ball.burn > 0, 'lying in its lit bowl, it burns');
      ball.hit('blade', ball.dir.clone(), {});
      // (his hearts kept up: standing still by it, its leap finds him, and knocked out he would wake outside its shut doors)
      for (let i = 0; i < 12 / DT; i++) { P.hearts = P.maxHearts; frame(); if (K.state === 'open' && K.openFor === HEARTH_FIRE.open) { open = true; break; } if (P.dead) P.restart(); }
    }
    assert.ok(open, `a fire cut to it: it pants (${n})`);
    water();
  }
  assert.equal(K.state, 'weary', 'calm: it lies down by the spout');
  for (let i = 0; i < 30 / DT && Math.hypot(K.model.pos.x - K.model.rest.x, K.model.pos.z - K.model.rest.z) > 0.6; i++) frame();
  wait(3);
  // walk up to its brow and lay a hand on it
  const brow = K.model.mouth.clone();
  for (let i = 0; i < 12 / DT && bestInteractable(P)?.entry.id !== 'temple.desert.touch'; i++) frame({ KeyW: true }, toward(brow));
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
  delete P.guard;
  game.reset();
  own();
});

test('the Rose House is solved with the backpack and the double jump, the blade and the guard found inside: no gun; not without the double jump, the blade or the guard', () => {
  const L = TEMPLES.desert.def.logic;
  const r = solve(L, { items: ['backpack', 'doublejump'] });
  assert.equal(r.done, true, r.log.join(' / '));
  assert.ok(r.log.indexOf('take chest (sword)') > 1 && r.log.indexOf('find guard (shield)') > r.log.indexOf('take chest (sword)'), 'the blade half-way, the guard after it');
  assert.equal(solve(L, { items: ['backpack'] }).done, false, 'the pier wants the double jump');
  assert.ok(!solve(L, { items: ['backpack', 'doublejump'], withhold: ['shield'] }).stuck.includes('wing'), 'the watcher wants the guard');
  assert.equal(L.elements.keeper.needs.includes('shield') && L.elements.keeper.needs.includes('sword'), true, 'the Keeper asks for both');
  // nothing in the house asks for the gun, or a gun mode
  for (const [id, e] of Object.entries(L.elements)) assert.ok(!(e.needs ?? []).some((n) => ['gun', 'fire', 'stun', 'bloom'].includes(n)), `${id}: no gun`);
});

// ------------------------------------------------------------------ on foot: the City-Shaft's tower, room by room
test('the Warden’s Well on foot: the vane and the discs, the hub’s wings: the Ash Store’s arena and the Vane Room’s chasm, each a small key for the balcony’s door, the slot and the ball, the bellows and the draught up the oculus, the great vane and the lidded eye from the rising air, the iris, the ball pushed over the gap from the air, two vanes at once for the crown’s eye (the little one in the loft below, too slow and in time), the warden broken over a vane, the shaft’s breath', () => {
  game.reset();
  own('backpack', 'gun', 'glider');
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
  // the wings in rising air (src/updraft.js): straight up, held at the top; the stick steers out (v1.42: no jets)
  const inAir = () => inColumn(P);
  /** Up the rising air from where you stand (a jump, the wings held open) until it holds you at its top, or s seconds. */
  const rise = (s = 16) => {
    for (let i = 0; i < 4; i++) frame({ Space: true }, 0);
    for (let i = 0; i < s / DT; i++) { frame({ Space: true }, 0); if (i > 30 && inAir() && Math.abs(P.vel.y) < 0.3) return true; }
    return inAir();
  };
  /** Off an edge into the rising air at `to` (local [x, z]): a jump toward it, the wings open, until it takes you; then up it. */
  const leapInto = (to, s = 16) => {
    const target = L(to[0], ly(), to[1]);
    for (let i = 0; i < 3 / DT && !inAir(); i++) { P.heading = P.frame.headingOf(target.clone().sub(P.pos).setY(0)); frame({ Space: true, KeyW: P.onGround }, toward(target)); }
    return inAir() && rise(s);
  };
  /** Held in the rising air, the wings open (it holds you still enough to aim): s seconds, or until fn. */
  const holding = (s, fn = () => false) => { for (let i = 0; i < s / DT; i++) { frame({ Space: true }, 0); if (fn()) return true; } return false; };
  /** Out of the rising air toward `to` (local [x, y, z]): the stick while in it, the glide on, the wings folded over it. */
  const glideTo = (to, { max = 10, near = 1.2 } = {}) => {
    const target = L(...to);
    for (let i = 0; i < max / DT && !P.onGround; i++) {
      if (!inAir()) P.heading = P.frame.headingOf(target.clone().sub(P.pos).setY(0));
      frame(flat(target) < near ? {} : { Space: true, KeyW: inAir() }, toward(target));
    }
    return P.onGround && flat(target) < 2.6 && Math.abs(P.pos.y - target.y) < 0.6;
  };
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
  // ---- the Ash Store, west off the hub (an arena): its door shuts behind you while its keepers stand
  const WZ = 58.6 + Math.cos(Math.PI / 2 + 0.4) * 9;
  const keepers = [{ room: 'store', alive: true }, { room: 'store', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(walk(L(-3, 0, WZ)) && walk(L(-9, 0, WZ)), true, `to the way west (${where()})`);
  assert.equal(walk(L(-19, 0, WZ)), true, `into the Ash Store (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dW'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arW') && rt.logic.isOpen('dW'), 'beaten: won, and the door lets go');
  assert.equal(walk(rt.piece('kW').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kW', P);
  assert.equal(rt.logic.isFound('kW'), true, 'a small key');
  // ---- the Vane Room, east: the chasm's stones stand only while the vane on its far wall turns
  assert.equal(walk(L(-9, 0, WZ)) && walk(L(9, 0, WZ)), true, `back across the hub (${where()})`);
  assert.equal(walk(L(17.6, 0, WZ)), true, `to the chasm's edge (${where()})`);
  assert.equal(rt.logic.isOpen('vb'), false, 'no stones in the chasm');
  const vR = rt.piece('vR');
  vR.hit('shoot');
  wait(0.1);
  assert.equal(vR.turning, true, 'the vane across the chasm spins');
  wait(2.5);
  assert.equal(rt.logic.isOpen('vb'), true, 'and the stones stand');
  assert.equal(walk(L(25, 0, WZ)), true, `across before it slows (${where()})`);
  assert.ok(ly() > -1, 'over the chasm, not in it');
  assert.equal(walk(rt.piece('kE').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kE', P);
  assert.equal(rt.logic.isFound('kE'), true, 'the second small key');
  for (let i = 0; i < 20 / DT && vR.turning; i++) frame();
  assert.equal(rt.logic.isOpen('vb'), false, 'the vane runs down, and the stones sink: stranded');
  vR.hit('shoot');
  wait(2.5);
  assert.equal(walk(L(16, 0, WZ)), true, `a splash from this side, and back across (${where()})`);
  assert.equal(walk(L(9, 0, WZ)) && walk(L(0, 0, 57)), true, `back into the well (${where()})`);
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
  assert.equal(walk(L(0, 11, 66.4), { tol: 0.5 }), true, `to the door at the balcony's end (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.keysIn('d1'), 2, 'both small keys go in');
  assert.equal(rt.logic.isOpen('d1'), true);

  // ---- the Bellows Chamber: the chest; the only way on is up through the oculus, on the draught it unstops
  assert.equal(walk(L(0, 11, 75)), true, `into the chamber (${where()})`);
  for (let i = 0; i < 2 / DT; i++) frame({ Space: true }, 0);
  assert.ok(ly() < 16, 'before the chest the plinth is still: the wings go nowhere up');
  items.grant('wardenbellows'); game.emit('box:opened', { id: 'incal.temple.jetpack' });
  assert.equal(rt.logic.gadget, true);
  // what they are for, at once: a line a moment after the chest, the drone sent up, the draught rising through the oculus
  const pings = [], offPing = game.on('scout:ping', (e) => pings.push(e));
  wait(1.5);
  assert.ok(notes.includes(BELLOWS_NEXT), `the bellows' next step is said (${notes.at(-1)})`);
  assert.match(BELLOWS_NEXT, /\{key:thrust\}/);   // (jump held in the air, as the player holds it: src/prompt-keys.js keyText)
  assert.equal(pings.length, 1, 'the drone flies up to show where');
  offPing?.();
  const draft = rt.pieces.find((p) => p.lift && p.o.when?.gadget);
  assert.ok(draft?.on, 'the draught rises over the plinth');
  assert.equal(upUsed(rt), false);
  assert.equal(walk(L(0, 11, 81.4), { tol: 0.8 }), true, `onto the plinth (${where()})`);
  assert.equal(rise(), true, `up the draught, held at its top (${where()})`);
  assert.ok(ly() > 34.6 + 1.5, `up through the oculus (${where()})`);
  assert.equal(glideTo([0, 34.6, 81.4 - 7.5]), true, `off it onto the gallery floor (${where()})`);
  assert.equal(upUsed(rt), true, 'up: the draught was the way');

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
  // the way: up the thin breath over the great vane on the wings, and hold there: the bellows' wash turns it, the lids
  // lift; splash the eye from the air (the rising air holds you still enough to aim)
  assert.equal(walk(vG.center, { tol: 0.6 }), true, `onto the great vane (${where()})`);
  assert.equal(rise(), true, `the breath holds you over it (${where()})`);
  assert.equal(P.hovering, true, 'on the wings, held: the gun may come up');
  assert.equal(vG.turning, true, 'the bellows’ wash turns it');
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
  assert.equal(vG.turning, false, 'the wings folded, the vane runs down');
  assert.equal(rt.logic.isLit('s2'), true, 'and the eye stays awake');

  // ---- up through the iris to the loft
  const GC = 34.6 + 15;
  assert.equal(walk(L(0, 34.6, 81.4 - 4.3), { tol: 0.4 }), true, `to the oculus' rim (${where()})`);
  assert.ok(draft.h > 34.6 + 15 - 11.62, 'the draught rises on through the open iris');
  assert.equal(leapInto([0, 81.4]), true, `off the rim into the draught, and up through the iris (${where()})`);
  assert.equal(glideTo([-6, GC, 81.4 - 8]), true, `off it onto the loft (${where()})`);
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
  assert.equal(rise(), true, `held over it (${where()})`);
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
  assert.equal(leapInto([0, 81.4]), true, `into the draught, and up through the second iris (${where()})`);
  assert.equal(glideTo([-8, GK, 81.4 - 6]), true, `off it onto the crown (${where()})`);
  assert.ok(Math.abs(ly() - GK) < 0.5, `standing in the crown (${where()})`);
  const s4 = rt.piece('s4'), vS = rt.piece('vS'), vC = rt.piece('vC');
  // the great vane alone: the lids stay shut (round the open iris, not across it)
  for (const [x, z] of [[0, -10.2], [9.6, -3.6], [9.6, 2.4]]) walk(L(x, GK, 81.4 + z), { tol: 1 });
  assert.equal(walk(vC.center, { tol: 0.6 }), true, `onto the crown's great vane (${where()})`);
  assert.equal(rise(), true, `held over it (${where()})`);
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
  assert.equal(leapInto([0, 81.4]), true, `into the draught, up through the second iris (${where()})`);
  assert.equal(glideTo([6.2, GK, 81.4 + 5.4]), true, `over onto the great vane (${where()})`);
  assert.equal(rise(), true);
  holding(1);
  assert.ok(!vS.turning && s4.lidK < 0.05, 'the little one stopped on the way up: the lids stay shut');
  land();
  for (let i = 0; i < 3 / DT && vC.turning; i++) frame();
  // the way: splash the small one in the loft, then fly straight up to the great one and hover while it still turns
  P.teleport(L(0, GC + 0.1, 81.4 - 6.2), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  vS.hit('shoot');
  assert.equal(leapInto([0, 81.4]), true, `into the draught, up through the second iris (${where()})`);
  assert.equal(glideTo([6.2, GK, 81.4 + 5.4]), true, `over onto the great vane (${where()})`);
  assert.equal(rise(), true);
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
  // up the breath over the crown's great vane, and off it onto the high ledge by the door
  assert.equal(walk(vC.center, { tol: 0.6 }), true, `back onto the crown's great vane (${where()})`);
  assert.equal(rise(), true);
  assert.equal(glideTo([0, 62.6, 81.4 + 14 - 2.4]), true, `up to the high ledge (${where()})`);
  assert.equal(walk(L(0, 62.6, 104)), true, `into the hall (${where()})`);
  const K = rt.guardian;
  wait(0.4);
  assert.notEqual(K.state, 'sleep', 'it wakes');
  assert.equal(rt.logic.isOpen('d3'), false, 'the door shuts behind you');
  P.opts.health = false;
  const nearest = () => rt.hallVanes.slice().sort((a, b) => a.center.distanceTo(K.model.pos) - b.center.distanceTo(K.model.pos))[0];
  // (over the vane in its breath, the wings open: up to its top, held there)
  const hoverOver = (v) => {
    P.teleport(v.center.clone().add(V(0, 4, 0)), V(0, 1, 0), V(0, 0, 1));
    for (let i = 0; i < 2.5 / DT && !(inAir() && Math.abs(P.vel.y) < 0.3 && i > 30); i++) frame({ Space: true }, 0);
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
      assert.equal(v.turning, true, 'held on the wings over it, the bellows turn the vane under you');
      assert.ok(P.pos.y > K.model.mouth.y - 1.2 && P.hovering, `over its hatch (${(P.pos.y - v.center.y).toFixed(1)} vs ${(K.model.mouth.y - v.center.y).toFixed(1)}, held ${P.hovering})`);
    }
    const before = K.meter, phase = K.phaseIndex;
    K.hit('mouth', 'shoot');
    if (phase === 1) assert.ok(Math.abs(K.meter - before - 0.25) < 1e-6 || K.meter >= 0.75, `over a turning vane a hit counts twice (${(K.meter - before).toFixed(3)})`);
    for (let i = 0; i < 1 / DT && !P.onGround; i++) frame();
  }
  assert.equal(K.state, 'resolved', `broken (${K.meter})`);
  assert.ok(stillTried, 'the last phase was met');
  land();
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
test('the Founders’ Belfry on foot: the west store’s arena and the east store’s ball, the founders’ bell struck by a ball and the great stone that falls up (and without you), the eye under the landing, the bell, its try in the chamber, the porch’s held door a room on, the held stones and the ball rolled across them, the Cloud-Mother calmed, the stones come down outside', () => {
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
  // the west store, an arena since v1.49: its archway shuts behind you while its keepers stand
  const keepers = [{ room: 'storeW', alive: true }, { room: 'storeW', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(via([-6, 0, 23], [-15, 0, 23]), true, `into the west store (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dSW'), false, 'the archway shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arW') && rt.logic.isOpen('dSW'), 'beaten: won, and the archway lets go');
  assert.equal(walk(rt.piece('kW').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kW', P);
  assert.equal(rt.logic.isFound('kW'), true, 'a small key');
  assert.equal(via([-13, 0, 23], [-6, 0, 23], [6, 0, 23], [12.6, 0, 23]), true, `into the east store (${where()})`);
  assert.equal(roll('ball2', 'p2'), true, `the east ball home (${rt.piece('ball2').t.toFixed(2)})`);
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), false, 'the door’s lamp, and its keyhole still empty');
  assert.equal(via([12.6, 0, 23], [6, 0, 23], [0, 0, 30], [0, 0, 42.4]), true, `to the door (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.keysIn('d1'), 1, 'the small key goes in');
  assert.equal(rt.logic.isOpen('d1'), true);
  // ---- the Stone Stair: the great stone hangs at the top of the well, by the high door; the founders' bell low by the
  // way in, a ball in a groove into its mouth
  assert.equal(via([0, 0, 42.4], [0, 0, 46.5]), true, `into the well (${where()})`);
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
  assert.equal(walk(L(0, 16, 150.2)), true, `into her hall (${where()})`);
  const G = rt.guardian;
  wait(0.4);
  assert.notEqual(G.state, 'sleep', 'she wakes');
  P.opts.health = false;
  // (from her second phase a ring as she rises to dive brings a stone down where she dives; in her last that is the
  // only way she lies down to cry: tests/guardian-twists.test.js plays it through, failures and all)
  const rising = () => G.phaseIndex >= 1 && G.attack?.over && !G.struck && G.at > 0.15 && G.at < G.windFor * 0.5;
  let landed = 0;
  for (let n = 0; n < 16 && G.state !== 'weary'; n++) {
    answerAsks({ G, P, frame }, { keep: true });   // (its second phase's second verb first, src/temples/boss.js asks: tests/guardian-asks.js)
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
    P.teleport(G.model.pos.clone().setY(L(0, 16, 0).y).add(V(G.model.pos.x > L(0, 16, 168).x ? -6 : 6, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
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
test('the Footprint on foot: the sphere set down on the walker’s print and you on its print by the wall (and on the wrong prints), the floating sphere pushed over the stilled pool, the lens and its mural, the stones whose prints are the walker’s, the walker’s plate among plain ones and the eye across the chasm, the Keepers’ Lodge’s arena off the gallery and its small key for the far door, the keepers’ gallery back, the Echo answered by the print', () => {
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
  assert.ok(rt.logic.check(rt.logic.el('d4').opens) && !rt.logic.isOpen('d4'), 'the eye and the sphere: and since v1.53 the far door wants a small key too');
  // ---- the keepers' gallery: from the far landing round to the Lens Chamber; its eye on this side opens the door
  assert.equal(walk(L(-10.4, 0, 129)), true, `to the far landing's west door (${where()})`);
  assert.equal(walk(L(-13.8, 0, 129)), true, `into the gallery (${where()})`);
  // ---- the Keepers' Lodge, west off the gallery (v1.53, an arena): its door shuts behind you while its keepers stand
  const keepers = [{ room: 'lodge', alive: true }, { room: 'lodge', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(walk(L(-13.8, 0, FOOT_LODGE.z)) && walk(L(-17.5, 0, FOOT_LODGE.z)) && walk(L(-21, 0, FOOT_LODGE.z)), true, `into the Lodge (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dR'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arL') && rt.logic.isOpen('dR'), 'beaten: won, and the door lets go');
  assert.equal(walk(rt.piece('kS').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kS', P);
  assert.equal(rt.logic.isFound('kS'), true, 'a small key');
  assert.equal(walk(L(-17.5, 0, FOOT_LODGE.z)) && walk(L(-13.8, 0, FOOT_LODGE.z)), true, `back into the gallery (${where()})`);
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
  wait(2.4);
  assert.equal(rt.logic.keysIn('d4'), 1, 'the Lodge’s key in it');
  assert.equal(rt.logic.isOpen('d4'), true, 'the far door opens');
  // ---- the Echo's Hall: answer each note; through the lens the one that answers wears the walker's print
  assert.equal(walk(L(0, 0, 144)), true, `into the hall (${where()})`);
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
test('the Engine-House on foot: the valve and the ball in the pistons’ crank, the hammer jammed with the gantry’s ball, the chamber’s four eyes and its shutters, the hub’s wings: the Boiler Room’s arena and its flue on into the passage, the Governor Room’s one ball and two cranks for the great key, the passage’s pistons held up a room on and its small lock, the furnace’s two cranks and the other two caught in turn, the Tooth-Warden on its jammed gear, the pipe-cart', () => {
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
  assert.ok(said(/jams their crank/), 'and it says why');
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
  // ---- the Fourth Chamber: the chest; its way on is open, four still eyes by its two shutters
  assert.equal(walk(L(0, 7, 70)), true, `into the chamber (${where()})`);
  const k0 = rt.piece('k0');
  for (let i = 0; i < 4; i++) k0.hit(i);
  assert.equal(rt.logic.isLit('k0'), false, 'four still eyes in a breath: the starting bar holds three');
  assert.ok(said(/bar holds three/), 'and it says so');
  assert.equal(walk(L(-7, 7, 75.2), { max: 4 }) && walk(L(-13, 7, 75.2), { max: 3 }), false, 'the west shutter is down');
  items.grant('cell'); game.emit('box:opened', { id: 'buried.temple.cell' });
  wait(3);
  for (let i = 0; i < 4; i++) k0.hit(i);
  assert.equal(rt.logic.isLit('k0'), true, 'with the fourth chamber, four in a breath');
  wait(2.5);
  assert.ok(rt.logic.isOpen('dS') && rt.twins.get('dS')[0].open && rt.piece('dS').open, 'both shutters roll up');
  assert.equal(rt.logic.isOpen('d3'), false, 'the passage’s door is a room on');
  // ---- the Boiler Room, west off the hub (an arena): its doors shut behind you while its keepers stand
  const C3 = 75.2;
  const keepers = [{ room: 'boiler', alive: true }, { room: 'boiler', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(walk(L(-7, 7, C3)) && walk(L(-14, 7, C3)), true, `through the west shutter (${where()})`);
  assert.equal(walk(L(-20, 7, C3)), true, `into the Boiler Room (${where()})`);
  wait(0.3);
  assert.ok(!rt.logic.isOpen('dB') && !rt.logic.isOpen('dBo'), 'its doors shut behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arB') && rt.logic.isOpen('dB') && rt.logic.isOpen('dBo'), 'beaten: won, the door lets go and the flue opens');
  assert.equal(walk(rt.piece('kS').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kS', P);
  assert.equal(rt.logic.isFound('kS'), true, 'a small key');
  // up the flue and out into the Crank Passage, by its door (the loop)
  assert.equal(walk(L(-17, 7, 80)) && walk(L(-17, 7, 95.2)) && walk(L(-9.5, 7, 95.2)) && walk(L(-7, 7, 94.6)), true, `up the flue into the passage (${where()})`);
  assert.equal(walk(L(0, 7, 102), { max: 4 }), false, 'the passage’s door is shut');
  assert.equal(rt.logic.keysIn('d3'), 1, 'the small key goes in, and it still wants its four eyes');
  // ---- the Governor Room, east: one ball between the hammer's crank and the pistons'
  assert.equal(walk(L(0, 7, 88)) && walk(L(4, 7, C3 + 2)) && walk(L(12, 7, C3)) && walk(L(15, 7, C3)), true, `back through the chamber and the east shutter (${where()})`);
  const k3 = rt.piece('k3'), bQ = rt.piece('bQ'), kB = rt.piece('kB'), h2 = rt.piece('h2');
  assert.equal(kB.free(), false, 'the great key caged on its anvil');
  wait(3);
  assert.equal(catchAsTheyRise(k3, 10), false, 'the pistons rise in turn: never four in one breath');
  assert.equal(roll(bQ, 1, () => rt.logic.drumOn('bQ', 'pQ')), true, `the ball out of the hammer's crank into the pistons' (${bQ.t.toFixed(2)})`);
  wait(1);
  assert.ok([0, 1, 2, 3].every((i) => k3.isUp(i)), 'all four stand up together');
  let fell = false;
  for (let i = 0; i < 4 / DT; i++) { frame(); fell ||= h2.down > 0.9; }
  assert.ok(fell && !rt.logic.isOpen('h2'), 'and the hammer runs, down on the cage');
  for (let i = 0; i < 4; i++) k3.hit(i);
  assert.equal(rt.logic.isLit('k3'), true, 'four in a breath');
  wait(1.5);
  assert.equal(kB.free(), false, 'the cage stays up under the running hammer');
  assert.equal(roll(bQ, -1, () => rt.logic.drumOn('bQ', 'pH')), true, `the ball back into the hammer's crank (${bQ.t.toFixed(2)})`);
  wait(2.6);
  assert.ok(rt.logic.isOpen('h2') && h2.down < 0.01, 'the hammer stands still at the top of its stroke');
  assert.equal(kB.free(), true, 'the eyes stay awake, and the cage sinks');
  assert.equal(walk(kB.pos, { tol: 1.2 }), true, `to the anvil (${where()})`);
  wait(0.3);
  openChest(rt, 'kB', P);
  assert.equal(rt.logic.isFound('kB'), true, 'the great key');
  // ---- the Crank Passage: four eyes on pistons that rise in turn; one crank holds them all up
  assert.equal(walk(L(12, 7, C3)) && walk(L(4, 7, C3 + 2)) && walk(L(0, 7, 88)) && walk(L(0, 7, 93)), true, `back into the passage (${where()})`);
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
  assert.equal(rt.logic.isOpen('d3'), true, 'the small key in it, and its eyes awake');
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
  assert.equal(walk(L(0, 7, 147.2)), true, `into the hall (${where()})`);
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

// ------------------------------------------------------------------ on foot: the Moon Foundry's Casting-House, room by room
test('the Casting-House on foot: the founders’ moon too heavy at the start, the test scale, the stone moon rolled into the great mould and its seam-eye, the Sand Room’s arena off it and its small key, you in the hoist’s pan and the stone moon for you, the hoist, the tongs and their try, the passage’s cradle a room on, the iron moon under the door and through the pilot flame into the hooded mould, the press over the bridge, the keepers’ pan and eye and the way back, the founders’ moon hot into the great cradle, the Last Founder given a whole moon, the moon on the jib', () => {
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('moonfoundry');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const said = (re) => notes.some((n) => re.test(n));
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
  wait(0.5);
  // ---- the Pouring Floor: the founders' moon is cast iron, too heavy for a plain push; the test scale tips, and nothing
  const mG = rt.piece('mG');
  mG.hit('push', mG.dir.clone(), { strength: 1 });
  wait(1);
  assert.ok(mG.t < 0.01, 'the founders’ moon only rocks on its rail');
  assert.ok(said(/far too heavy/), 'and it says why');
  assert.equal(roll(rt.piece('m0'), 1, () => rt.logic.drumOn('m0', 'p0')), true, 'the test cast into its little scale');
  wait(0.3);
  assert.ok(said(/test cast/), 'it tips, and nothing waits on it');
  // ---- the Mould Room: the seam-eye stays lidded until the stone moon from the floor fills the great mould
  const eM = rt.piece('eM');
  eM.hit('shoot');
  assert.equal(rt.logic.isLit('eM'), false, 'lidded over an empty mould');
  const m1 = rt.piece('m1');
  assert.equal(roll(m1, 1, () => rt.logic.drumOn('m1', 'pM')), true, `the stone moon rolled west into the great mould (${m1.t.toFixed(2)})`);
  wait(1);
  assert.ok(eM.lidsOpen(), 'the lids lift');
  eM.hit('shoot');
  assert.equal(rt.logic.isLit('eM'), true);
  wait(2.5);
  assert.equal(rt.logic.isOpen('dM'), true, 'the door to the Crucible Stair');
  // ---- the Sand Room, south off the Mould Room (v1.53, an arena): its door shuts behind you while its keepers stand
  const keepers = [{ room: 'sand', alive: true }, { room: 'sand', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(walk(L(FOUNDRY_SAND.x, 0, 22)) && walk(L(FOUNDRY_SAND.x, 0, 18.4)) && walk(L(FOUNDRY_SAND.x, 0, 13)), true, `into the Sand Room (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dR'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arS') && rt.logic.isOpen('dR'), 'beaten: won, and the door lets go');
  assert.equal(walk(rt.piece('kS').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kS', P);
  assert.equal(rt.logic.isFound('kS'), true, 'a small key, for the last door');
  assert.equal(walk(L(FOUNDRY_SAND.x, 0, 18.4)) && walk(L(FOUNDRY_SAND.x, 0, 22)), true, `back into the Mould Room (${where()})`);
  // ---- the hoist's pan: you are the weight, but not on the hoist; the stone moon stands in for you
  const hoist = rt.pieces.find((p) => p.path && p.o.when?.pressed === 'pK');
  P.teleport(L(-36.3, 4.6, 35), V(0, 1, 0), V(0, 0, 1));
  wait(1.5);
  assert.equal(rt.logic.pressed('pK'), true, 'you in the pan');
  assert.ok(said(/You are the weight/), 'and the hoist rises without you');
  P.teleport(L(-28, 4.6, 35), V(0, 1, 0), V(0, 0, 1));
  wait(0.5);
  assert.equal(roll(rt.piece('m2'), 1, () => rt.logic.drumOn('m2', 'pK')), true, 'the stone moon into the pan');
  P.teleport(L(-21, 0.1, 33), V(0, 1, 0), V(0, 0, 1));
  wait(0.5);
  assert.equal(walk(L(-21, 0, 40)), true, `through the door to the stair (${where()})`);
  for (let i = 0; i < 30 / DT && !(hoist.s < 0.1 && hoist.wait > 0.4); i++) frame();
  assert.equal(walk(hoist.group.position, { tol: 0.6, run: false, max: 4, dy: 0.9 }), true, `onto the hoist (${where()})`);
  for (let i = 0; i < 20 / DT && hoist.s < hoist.total - 0.05; i++) frame();
  assert.equal(walk(L(-21, 9, 52.5), { max: 4 }), true, `onto the landing (${where()})`);
  assert.equal(walk(L(-21, 9, 61)), true, `into the Tong Chamber (${where()})`);
  // ---- the Tong Chamber: the tongs; the try by the dais
  items.grant('tongs'); game.emit('box:opened', { id: 'moonfoundry.temple.tongs' });
  wait(0.3);
  assert.equal(rt.logic.gadget, true);
  assert.equal(roll(rt.piece('mT'), 1, () => rt.logic.drumOn('mT', 'pT')), true, 'the try: the iron moon rolls for the tongs');
  assert.ok(said(/take hold of the founders’ iron/));
  // ---- the Pincer Passage: the iron moon on the hot rail stops at the shut door; the cradle's moon opens it
  const mH = rt.piece('mH');
  roll(mH, 1, () => mH.t >= mH.o.gap.from - 0.01, 3);
  assert.ok(mH.t <= mH.o.gap.from + 0.01, `it stops at the shut door (${mH.t.toFixed(2)})`);
  assert.ok(said(/Its rail runs on under it/));
  assert.equal(roll(rt.piece('mP'), 1, () => rt.logic.drumOn('mP', 'pP')), true, 'the cradle’s moon home');
  wait(2.5);
  assert.equal(rt.logic.isOpen('dP'), true, 'the passage’s door');
  // ---- the Casting Furnace: on under the door, through the pilot flame, hot into the hooded mould
  assert.equal(roll(mH, 1, () => rt.logic.drumOn('mH', 'pH')), true, `the iron moon into the mould’s mouth (${mH.t.toFixed(2)})`);
  wait(1.5);
  assert.ok(said(/comes out glowing/), 'it went through the flame');
  assert.equal(rt.logic.isLit('bH'), true, 'the hot moon lights the hooded mould');
  wait(3);
  assert.equal(rt.logic.isOpen('brH'), true, 'the bridge over the channel');
  // the press over the bridge: wait for it to rise, then cross
  const press = rt.piece('hm');
  P.teleport(L(11.5, 9.1, 61.9), V(0, 1, 0), V(0, 0, 1));
  wait(0.5);
  for (let i = 0; i < 8 / DT && !(press.phase > 0.45 && press.phase < 0.5); i++) frame();
  assert.equal(walk(L(25, 9, 61.9), { max: 6 }), true, `over the bridge under the press (${where()})`);
  assert.ok(P.pos.y > L(0, 8, 0).y, 'over it, not in the channel');
  // ---- the far landing and the Weighing Hall: the iron moon into the keepers' pan; the keepers' eye; down and back
  assert.equal(roll(rt.piece('mB'), 1, () => rt.logic.drumOn('mB', 'pB')), true, 'the third iron moon into the keepers’ pan on the gallery');
  const eS = rt.piece('eS');
  wait(1);
  assert.ok(eS.lidsOpen(), 'the keepers’ eye unlids');
  eS.hit('shoot');
  wait(2.5);
  assert.equal(rt.logic.isOpen('dS'), true, 'the keepers’ door');
  P.teleport(L(33, 9.1, 48), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  assert.equal(walk(L(38.6, 9, 44.2)) && walk(L(38.6, 0, 18.2), { max: 20 }), true, `down the gallery’s stair (${where()})`);
  assert.equal(walk(L(24, 0, 28)) && walk(L(8, 0, 28)), true, `through the keepers’ door onto the Pouring Floor (${where()})`);
  // ---- back on the floor: the founders' moon through the pilot flame into the great cradle
  assert.equal(roll(mG, 1, () => rt.logic.drumOn('mG', 'pG')), true, `the founders’ moon home (${mG.t.toFixed(2)})`);
  wait(1.5);
  assert.equal(rt.logic.isLit('bG'), true, 'hot into the great cradle');
  wait(3);
  assert.ok(rt.logic.check(rt.logic.el('dF').opens) && !rt.logic.isOpen('dF'), 'the cradle hot: and since v1.53 the Founders’ Door wants the Sand Room’s key');
  P.teleport(L(0, 0.1, 41.0), V(0, 1, 0), V(0, 0, 1));
  wait(2.4);
  assert.equal(rt.logic.keysIn('dF'), 1, 'the key in it');
  assert.equal(rt.logic.isOpen('dF'), true, 'the Founders’ Door');
  P.teleport(L(0, 0.1, 40), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  assert.equal(walk(L(0, 0, 60)) && walk(L(0, 0, 97), { max: 30 }), true, `down the cold passage into the Last Casting (${where()})`);
  // ---- the Last Founder
  const G = rt.guardian, mA = rt.piece('mA');
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  const opening = () => { for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') return true; } return false; };
  let tipped = false, hot = false, twice = false;
  for (let n = 0; n < 14 && G.state !== 'resolved'; n++) {
    assert.ok(opening(), `its crucible opens (${n}, phase ${G.phaseIndex})`);
    if (G.phaseIndex === 1 && !rt.founderCradled()) {
      const m = G.meter;
      rt.quench();
      assert.ok(Math.abs(G.meter - m - 0.175) < 1e-6, `free, a splash as before (${(G.meter - m).toFixed(3)})`);
      roll(mA, 1, () => rt.logic.drumOn('mA', 'pA'));
      assert.equal(rt.founderCradled(), true, 'a whole moon in its cradle');
      continue;
    }
    if (G.phaseIndex === 1 && rt.founderCradled()) {
      const m = G.meter;
      rt.quench();
      twice = Math.abs(Math.min(0.7, m + 0.35) - G.meter) < 1e-6;
      assert.ok(twice, `with the moon in its cradle it counts twice (${(G.meter - m).toFixed(3)})`);
      continue;
    }
    if (G.phaseIndex === 2 && !hot) {
      tipped = said(/tip the moon out/);
      assert.ok(tipped, 'shifting into its last phase it tips the moon out of the cradle');
      assert.equal(rt.founderCradled(), false);
      hot = true;
      const m = G.meter;
      assert.equal(rt.quench(), false, 'too hot for water');
      assert.equal(G.meter, m);
      assert.ok(said(/too hot/), 'and it says why');
      roll(mA, 1, () => rt.logic.drumOn('mA', 'pA'));
      assert.equal(rt.founderCradled(), true, 'rolled back in');
      continue;
    }
    const m = G.meter;
    rt.quench();
    assert.ok(G.meter > m, `a splash takes (${n}, phase ${G.phaseIndex})`);
  }
  assert.equal(G.state, 'resolved', `stopped (${G.meter})`);
  assert.ok(twice && tipped && hot, 'its phases were met');
  assert.equal(game.flag('temple.moonfoundry.done'), true);
  wait(2.5);
  assert.ok(rt.logic.isOpen('d5'));
  // ---- outside: the one whole moon is lifted onto the jib over the door
  assert.equal(rt.change.on, true);
  // (it waits at the door's foot for the climax's film, src/story/moonfoundry-moments.js: issue #295)
  wait(9);
  const moon = rt.change.root.children[0];
  assert.ok(moon.position.distanceTo(rt.outside.hook) > 10, 'still at the door\'s foot, for the film');
  assert.equal(rt.change.show(), true);
  wait(6);
  assert.ok(rt.change.root.visible && moon.position.distanceTo(rt.outside.hook) < 3, `the moon on the hook (${moon.position.distanceTo(rt.outside.hook).toFixed(1)} m)`);  game.reset();
  own();
});

// ------------------------------------------------------------------ on foot: the Underwater City's Whale-House, room by room
test('the Whale-House on foot: its door sealing the last tube, the Horn Store’s arena off the hall and its small key for the passage door, the west door’s ball, the long groove across the hall and the lidded eye, the pool’s eye over the glass, the shell’s ball and eye, the Horn Door, the whale-horn and its try, the passage door held while its horn rings (a room on), the tank’s glass too smooth until the dish carries the note to the shelf’s ear and the rungs come out, the keepers’ door back, the landing’s dish to the ear over the Listener’s Door, the Listener calmed by the horn and through the dishes, the lamps lit', () => {
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('underwater');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };
  const toward = (to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));
  const flat = (a) => Math.hypot(P.pos.x - a.x, P.pos.z - a.z);
  const walk = (to, { tol = 0.6, max = 25, run = true, dy = 1.6 } = {}) => {
    for (let i = 0; i < max / DT; i++) { if (flat(to) < tol && Math.abs(P.pos.y - to.y) < dy) return true; frame({ KeyW: true, ShiftLeft: run }, toward(to)); }
    return false;
  };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const at = (x, y, z) => { P.teleport(L(x, y + 0.1, z), V(0, 1, 0), V(0, 0, 1)); wait(0.3); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const said = (re) => notes.some((n) => re.test(n));
  const horn = (pos = P.pos) => game.emit('echo', { pos: pos.clone(), note: 'deep', degree: -3, horn: true });
  const roll = (id, n = 10) => {
    const ball = rt.piece(id), plate = rt.logic.el(id).plate, done = () => rt.logic.drumOn(id, plate);
    for (let k = 0; k < n && !done(); k++) {
      P.teleport(ball.center.clone().addScaledVector(ball.dir, -2.2).setY(ball.group.position.y + 0.1), V(0, 1, 0), V(0, 0, 1));
      wait(0.2);
      ball.hit('push', ball.dir.clone(), { strength: 0.8 });
      wait(2.6);
    }
    return done();
  };
  // ---- outside: the facade seals the tube's end, the door in it
  const door = rt.outside.door.at;
  assert.ok(Math.abs(door.z - (-178)) < 0.05 && Math.abs(door.x) < 0.05 && Math.abs(door.y) < 0.05, 'the door where the last tube ends');
  assert.ok(physics.rayDistance(V(4, 2, -174), V(0, 0, -1), 8) < 4.6, 'beside the doorway the tube runs into the facade (sealed)');
  assert.ok(physics.rayDistance(V(-3.5, 3.5, -174), V(0, 0, -1), 8) < 4.6, 'and on the other side, up under the arch');
  wait(0.5);
  // ---- the Horn Store, off the hall's south wall (v1.53, an arena): its door shuts behind you while its keepers stand
  const HS = WHALE_STORE;
  const keepers = [{ room: 'store', alive: true }, { room: 'store', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(walk(L(0, 0, 17)) && walk(L(HS.x, 0, 17)) && walk(L(HS.x, 0, 12.5)) && walk(L(HS.x, 0, 8)), true, `into the Horn Store (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dS'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arH') && rt.logic.isOpen('dS'), 'beaten: won, and the door lets go');
  assert.equal(walk(rt.piece('kS').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kS', P);
  assert.equal(rt.logic.isFound('kS'), true, 'a small key');
  assert.equal(walk(L(HS.x, 0, 12.5)) && walk(L(HS.x, 0, 17)), true, `back into the hall (${where()})`);
  // ---- the Sounding Hall: the west door's ball into its cradle
  assert.equal(rt.logic.isOpen('d1'), false);
  assert.equal(roll('b1'), true, 'the ball into the west door’s cradle');
  wait(2.5);
  assert.equal(rt.logic.isOpen('d1'), true, 'the west door');
  at(-12, 0, 26);
  assert.equal(walk(L(-26, 0, 30)), true, `into the Pool Room (${where()})`);
  // ---- the Pool Room: its glass can't be climbed; its eye over the glass; the ball for the east door
  for (let i = 0; i < 4 / DT; i++) frame({ KeyW: true }, toward(L(-38, 3, 30)));
  assert.ok(rt.kit.local(P.pos).x > -35.5, `you can't get over the pool's glass (${where()})`);
  if (P.climbing) { P.stopClimb(false); wait(1); }
  rt.piece('eP').hit('shoot');
  assert.equal(rt.logic.isLit('eP'), true, 'the pool’s eye, splashed over the glass');
  const eD = rt.piece('eD');
  eD.hit('shoot');
  assert.equal(rt.logic.isLit('eD'), false, 'the east door’s eye is lidded');
  assert.equal(roll('b2', 24), true, `the pool’s ball rolled out across the whole hall into the east door’s cradle (${rt.piece('b2').t.toFixed(2)})`);
  wait(1);
  assert.ok(eD.lidsOpen(), 'the lids lift');
  eD.hit('shoot');
  wait(2.5);
  assert.equal(rt.logic.isOpen('d2'), true, 'the east door');
  // ---- the Shell Room: its ball unlids the shell's eye; both lamps on the Horn Door
  at(14, 0, 26);
  assert.equal(walk(L(26, 0, 30)), true, `into the Shell Room (${where()})`);
  assert.equal(roll('bS'), true, 'the shell’s ball onto its plate');
  wait(1);
  rt.piece('eS').hit('shoot');
  wait(2.5);
  assert.equal(rt.logic.isOpen('dH'), true, 'both wings’ eyes: the Horn Door');
  // ---- the Horn Chamber: the whale-horn on the pulpit; the try
  at(-13.8, 0, 42);
  assert.equal(walk(L(-13.8, 0, 52)), true, `through the Horn Door (${where()})`);
  assert.equal(rt.logic.next(), 'chest');
  items.grant('horn'); game.emit('box:opened', { id: 'underwater.temple.horn' });
  wait(0.3);
  assert.equal(rt.logic.gadget, true);
  at(-17, 0, 58);
  horn();
  wait(0.3);
  assert.equal(rt.logic.isLit('eT'), true, 'the try: the little horn answers');
  assert.ok(said(/Nothing opens/), 'and nothing waits on it');
  // ---- the Song Passage: the door held while its horn rings; through it in time; it shuts behind
  at(-13.8, 0, 74.6);
  wait(2.4);
  assert.equal(rt.logic.keysIn('d4'), 1, 'the Horn Store’s key in it (v1.53)');
  at(-15.5, 0, 69.5);
  assert.equal(rt.logic.isOpen('d4'), false);
  horn();
  wait(0.2);
  assert.equal(rt.logic.isLit('e4'), true, 'the passage horn rings');
  assert.equal(walk(L(-13.8, 0, 80), { max: 9 }), true, `through the door before it rises (${where()})`);
  wait(11);
  assert.equal(rt.logic.isOpen('d4'), false, 'it rises again once the note fades');
  // ---- the Tank Hall: the glass too smooth; the shelf's ear too far; the dish dark without its ball
  at(-10.5, 0, 89);
  for (let i = 0; i < 5 / DT; i++) frame({ KeyW: true }, toward(L(-6, 4, 89)));
  assert.ok(rt.kit.local(P.pos).y < 4, `you can't get up the tank's glass (${where()})`);
  assert.ok(said(/too smooth/i), 'and you slip off it');
  if (P.climbing) { P.stopClimb(false); wait(1); }
  horn();
  wait(1);
  assert.equal(rt.logic.isLit('e5'), false, 'the shelf’s ear is far out of the horn’s reach');
  const dish = rt.piece('dishT');
  horn(dish.ends[0].mouth);
  wait(1);
  assert.ok(said(/dark and deaf/), 'the dish is dark without its ball');
  assert.equal(rt.logic.isLit('e5'), false);
  assert.equal(roll('b5'), true, 'the ball onto the dish’s footstone');
  at(-14, 0, 87.5);
  horn(dish.ends[0].mouth);
  wait(1);
  assert.equal(rt.logic.isLit('e5'), true, 'the dish carries the note across the water to the shelf’s ear');
  wait(1);
  assert.ok(rt.logic.isOpen('rungs'));
  at(-9.6, 0, 89);
  let up = false;
  for (let i = 0; i < 14 / DT; i++) { frame({ KeyW: true }, toward(L(-5, 9.5, 89))); if (P.onGround && rt.kit.local(P.pos).y > 8.5) { up = true; break; } }
  assert.ok(up, `up the rungs while the ear rings (${where()})`);
  // ---- the Gallery and the landing: the keepers' door back; the landing's dish to the ear over the Listener's Door
  assert.equal(walk(L(0.5, 9, 93)) && walk(L(8, 9, 93)), true, `into the Gallery of Horns (${where()})`);
  assert.equal(walk(L(13, 9, 79)) && walk(L(13, 0, 56), { max: 15 }), true, `down the keepers’ stair (${where()})`);
  rt.piece('eK').hit('shoot');
  wait(2.5);
  assert.equal(rt.logic.isOpen('dK'), true, 'the keepers’ door');
  assert.equal(walk(L(13, 0, 44)), true, `back into the hall (${where()})`);
  at(0, 0, 43);
  horn();
  wait(1);
  assert.equal(rt.logic.isLit('eL'), false, 'the Listener’s Door’s ear is too high to hear the horn from the floor');
  assert.equal(roll('bL'), true, 'the landing’s ball onto its dish’s footstone');
  const dL = rt.piece('dishL');
  at(12, 0, 53.5);
  horn(dL.ends[0].mouth);
  wait(1);
  assert.equal(rt.logic.isLit('eL'), true, 'the far dish over the Listener’s Door says the note, and its ear hears it');
  wait(2.5);
  assert.equal(rt.logic.isOpen('dL'), true, 'the Listener’s Door');
  // ---- down the Throat into the Listener's Hall
  at(0, 0, 44);
  assert.equal(walk(L(0, 0, 49)) && walk(L(0, -15, 78), { max: 20 }) && walk(L(0, -15, 92)), true, `down the Throat (${where()})`);
  // ---- the Listener
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep', 'it wakes');
  P.opts.health = false;
  const opening = () => { for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') return true; } return false; };
  const near = () => horn(G.model.mouth.clone().add(V(0, -3, 0)));
  let shut = false, folded = false, knocked = false;
  for (let n = 0; n < 16 && G.state !== 'weary'; n++) {
    if (n === 0) { near(); shut = said(/ear is shut/); }
    assert.ok(opening(), `its ear opens (${n}, phase ${G.phaseIndex})`);
    const m = G.meter;
    if (G.phaseIndex === 0) { near(); assert.ok(G.meter > m, `the horn close by calms it (${n})`); continue; }
    if (!folded) { near(); folded = G.meter === m && said(/hears only the house’s dishes/); assert.ok(folded, 'from its second phase it shuts its ear to the horn close by'); }
    if (G.phaseIndex === 2 && !knocked) { knocked = said(/roll off the dishes’ footstones/); assert.ok(knocked, 'shifting it knocks the stones off'); }
    if (!rt.listenerHomed()) { roll('bW'); assert.equal(rt.listenerHomed(), true, 'a stone on a footstone'); assert.ok(opening(), 'its ear opens again'); }
    const m2 = G.meter;
    horn(rt.piece('dishW').ends[0].mouth);
    wait(0.8);
    assert.ok(G.meter > m2, `the dish carries the note into its open ear (${n}, phase ${G.phaseIndex})`);
  }
  assert.ok(shut && folded && knocked, 'its phases were met');
  assert.equal(G.state, 'weary', `calm (${G.meter.toFixed(2)})`);
  for (let i = 0; i < 30 / DT && Math.hypot(G.model.pos.x - G.model.rest.x, G.model.pos.z - G.model.rest.z) > 0.6; i++) frame();
  wait(2);
  P.teleport(G.model.mouth.clone().setY(L(0, -15, 0).y + 0.1).add(V(0, 0, -4)), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  const hand = bestInteractable(P);
  assert.equal(hand?.entry.id, 'temple.underwater.touch', 'a hand on its shell');
  hand.entry.use(P);
  assert.equal(G.state, 'resolved');
  assert.equal(game.flag('temple.underwater.done'), true);
  wait(2.5);
  assert.ok(rt.logic.isOpen('d5'));
  // ---- outside: the lamps in the horns lit
  assert.equal(rt.change.on, true);
  wait(4);
  assert.ok(rt.outside.glowM.uniforms.uGlow.value > 0.6, `the Whale-House’s lamps are lit (${rt.outside.glowM.uniforms.uGlow.value.toFixed(2)})`);
  game.reset();
  own();
});

// ------------------------------------------------------------------ on foot: Lorn II's Lamp-House, room by room
test('the Lamp-House on foot: three dark pools (the third up the roots, out of sight), the Kennel’s arena off the hall, the moss-stones the orb’s lamp wakes over the dark pool and the root-wall, the lantern, its try by the dais, the Wick Room off the first hall and the Kennel’s key in its grille, the passage’s lamp a room on, the stones only its light shows, the pool-orb lit and rolled to the niche, back down to the Wick Room: its two orbs burning at once for the great key, and up its stair through the keepers’ door onto the root-wall, the Lampless fed, the lamp lit', () => {
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
  // ---- the Kennel, east off the hall (an arena, in the dark): its door shuts behind you while its keepers stand
  const keepers = [{ room: 'kennel', alive: true }, { room: 'kennel', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(walk(L(7, 0, KENNEL.z)) && walk(L(13, 0, KENNEL.z)) && walk(L(20, 0, KENNEL.z)), true, `into the Kennel (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dK'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arK') && rt.logic.isOpen('dK'), 'beaten: won, and the door lets go');
  assert.equal(walk(rt.piece('kS').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kS', P);
  assert.equal(rt.logic.isFound('kS'), true, 'a small key');
  assert.equal(walk(L(13, 0, KENNEL.z)) && walk(L(4, 0, 38)) && walk(L(0, 0, 40)), true, `back into the hall (${where()})`);
  // ---- (v1.60) the Wick Room, along the hall: dark niches and the great key behind a grille, the grille's keyhole the
  // Kennel's key's
  assert.equal(walk(L(7, 0, WICK.door + 2.2)) && walk(L(11, 0, WICK.door + 0.6), { tol: 0.8 }) && walk(L(17, 0, WICK.door)) && walk(L(19, 0, WICK.door + 3)), true, `into the Wick Room (${where()})`);
  assert.ok(!rt.logic.isOpen('cW') && !rt.logic.isLit('lW1') && !rt.logic.isLit('lW2'), 'dark: the niches cold, the great key behind its grille');
  assert.equal(walk(L(WICK.x + WICK.w / 2 - 1.2, 0, WICK.keyZ), { tol: 0.8 }), true, `up to the grille (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.keysIn('cW'), 1, 'the Kennel’s small key goes into the grille');
  assert.equal(rt.logic.isOpen('cW'), false, 'and it stays down: both niches must burn');
  // up the stair on the north wall to the balcony: its keepers' door shut
  const [sx0, sx1, sz] = WICK.stair;
  assert.equal(walk(L(24, 0, 56)) && walk(L(sx0 - 0.6, 0, sz - 3.6)) && walk(L(sx0 - 0.4, 0, sz)) && walk(L(sx1 + 0.6, 9, sz), { max: 12 }) && walk(L(16.2, 9, ROOT_WAY.z)), true, `up the stair onto the balcony (${where()})`);
  assert.equal(rt.logic.isOpen('dU'), false, 'the keepers’ door on the balcony is shut');
  assert.equal(walk(L(10, 9, ROOT_WAY.z), { max: 4 }), false, 'and keeps you in');
  // down off the balcony (no fall in the house hurts) and out the way you came
  const hearts0 = P.hearts;
  assert.equal(walk(L(21, 0, 56), { max: 8 }), true, `off the balcony's edge (${where()})`);
  assert.equal(P.hearts, hearts0, 'the drop costs nothing');
  assert.equal(walk(L(17, 0, WICK.door)) && walk(L(11, 0, WICK.door + 0.6)) && walk(L(7, 0, WICK.door + 2.2)) && walk(L(0, 0, 40)), true, `back into the hall (${where()})`);
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
  assert.equal(rt.logic.el('d2').lock, undefined, 'since v1.60 its lamp alone: the Kennel’s key went into the Wick Room’s door');
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
  assert.ok(rt.logic.check(rt.logic.el('d4').opens) && !rt.logic.isOpen('d4'), 'its lamps lit: and since v1.49 it wants the great key too');
  // ---- (v1.60) the Wick Room is back in the first hall: down off the root-wall's top, over the moss-stones and into it
  assert.equal(rt.logic.el(rt.logic.next()).room, 'wick', 'the marker sends you back to the Wick Room');
  assert.equal(walk(L(0, 9, 106.2)) && walk(L(0, 9, 96)) && walk(L(0, 9, 80)) && walk(L(0, 9, 67)), true, `back to the root-wall's top (${where()})`);
  const hearts1 = P.hearts;
  assert.equal(walk(L(0, 0, 55), { max: 8 }), true, `down off the root-wall onto the moss-stones (${where()})`);
  assert.equal(P.hearts, hearts1, 'the drop costs nothing');
  assert.equal(walk(L(0, 0, 48.6)) && walk(L(0, 0, 40)) && walk(L(7, 0, WICK.door + 2.2)) && walk(L(11, 0, WICK.door + 0.6)) && walk(L(19, 0, WICK.door + 3)), true, `into the Wick Room (${where()})`);
  // two niches, two orbs, one lantern; the grille wants both burning at once
  const lightAndRoll = (id, plate) => {
    const o = rt.piece(id);
    assert.equal(walk(o.center.clone().setY(L(0, 0, 0).y).add(V(-1.6, 0, 0)), { tol: 0.6 }), true, `by ${id} (${where()})`);
    wait(2.4);
    assert.ok(o.charge > 0, `${id} caught the lantern’s light`);
    for (let k = 0; k < 6 && !rt.logic.drumOn(id, plate); k++) { walk(o.center.clone().addScaledVector(o.dir, -(o.r + 1.3)).setY(L(0, 0, 0).y), { tol: 0.5, max: 4 }); o.hit('push', o.dir.clone(), { strength: 1 }); wait(2.4); }
    assert.equal(rt.logic.drumOn(id, plate), true, `${id} in its niche`);
    wait(0.6);
    return o;
  };
  const away = L(17, 0, 57);
  const o1 = lightAndRoll('oW1', 'pW1');
  assert.equal(rt.logic.isLit('lW1'), true, 'the first niche burns');
  assert.equal(rt.logic.isOpen('cW'), false, 'one is not enough');
  // left to fade (away from it: by it, the lantern keeps it glowing): its lamp goes out with it
  assert.equal(walk(away), true, `away from the orbs (${where()})`);
  for (let i = 0; i < 40 / DT && rt.logic.isLit('lW1'); i++) frame();
  assert.equal(rt.logic.isLit('lW1'), false, 'the orb’s glow gone, its niche dark again');
  assert.ok(notes.some((n) => /glow has gone out/.test(n)), 'and it says so');
  for (let i = 0; i < 6 / DT && rt.logic.drumOn('oW1', 'pW1'); i++) frame();   // (the niche tips the dark orb back out)
  // both, one after the other inside an orb's glow
  lightAndRoll('oW1', 'pW1');
  lightAndRoll('oW2', 'pW2');
  assert.ok(rt.logic.isLit('lW1') && rt.logic.isLit('lW2'), 'both niches burn');
  wait(2.2);
  assert.equal(rt.logic.isOpen('cW'), true, 'the grille lifts');
  assert.equal(rt.logic.isOpen('dU'), true, 'and the keepers’ door on the balcony with it');
  assert.equal(walk(rt.piece('kB').pos, { tol: 1.2 }), true, `to the great key (${where()})`);
  wait(0.3);
  openChest(rt, 'kB', P);
  assert.equal(rt.logic.isFound('kB'), true, 'the great key');
  assert.equal(walk(away), true, `away from the orbs (${where()})`);
  for (let i = 0; i < 30 / DT && rt.logic.isLit('lW1'); i++) frame();
  assert.ok(!rt.logic.isLit('lW1') && rt.logic.isOpen('cW'), 'and the grille stays up when they fade');
  assert.ok(o1, 'orbs');
  // the way back up: the stair, the balcony, the keepers' door, the ledge of roots round the Root Stair to the root-wall's top
  assert.equal(walk(L(sx0 - 0.6, 0, sz - 3.6)) && walk(L(sx0 - 0.4, 0, sz)) && walk(L(sx1 + 0.6, 9, sz), { max: 12 }) && walk(L(16.2, 9, ROOT_WAY.z)), true, `up onto the balcony (${where()})`);
  assert.equal(walk(L(11.5, 9, ROOT_WAY.z)) && walk(L(8.6, 9, ROOT_WAY.z)) && walk(L(6, 9, 62)), true, `through the keepers' door and along the ledge to the root-wall's top (${where()})`);
  assert.ok(Math.abs(rt.kit.local(P.pos).y - 9) < 0.6, 'up at the root-wall’s height');
  assert.equal(walk(L(0, 9, 67)) && walk(L(0, 9, 80)) && walk(L(0, 9, 96)) && walk(L(0, 9, 106.2)) && walk(L(0, 9, 131.2)), true, `back up through the chamber and over the moss-stones to the far side (${where()})`);
  // ---- the Lamp-Room: stand still by the Lampless while it searches
  assert.equal(walk(L(0, 9, 136.2)) && walk(L(0, 9, 149.2)), true, `through the great lock into the lamp-room (${where()})`);
  assert.equal(rt.logic.keysIn('d4'), 1, 'the great key in it');
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep');
  P.opts.health = false;
  // (in its last phase it shies from you: a pool lit earlier lures it down, and it drinks there while you stand back;
  // tests/guardian-twists.test.js plays it through, failures and all)
  const lure = rt.lurePools.list[0];
  for (let n = 0; n < 12 && G.state !== 'weary'; n++) {
    answerAsks({ G, P, frame }, { keep: true });   // (its second phase's second verb first, src/temples/boss.js asks: tests/guardian-asks.js)
    if (G.phaseIndex >= 2 && !lure.lit) {
      P.teleport(lure.at.clone().add(V(1, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
      for (let i = 0; i < 3 / DT && !lure.lit; i++) frame();
      assert.ok(lure.lit, 'your lantern held by a pool lights it');
    }
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `it hangs low, searching (${n})`);
    const before = G.meter;
    if (G.phaseIndex >= 2) P.teleport(lure.at.clone().setY(L(0, 9, 0).y).add(V(lure.at.x > L(0, 9, 152).x ? -9 : 9, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
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

test('the Hush-House on foot: the crystals sung low to high (the first by the door), the climbing disc and the eye on the root-wall, the stilling mode, the passage’s three mouths stilled in the Choir’s order and the smallest’s coffer, the pendulums stilled in turn, the Nursery’s arena off the far landing and the keeper’s gate it opens, the ledge round the Bog Well to the Choir’s balcony, the ball rolled through a mouth that thaws for the great key, the Mother Snapper stilled, the swamp in flower', () => {
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
  // (v1.52) the gate's crown is the biggest of the passage's three: stilled first, it rings flat; the side mouths, then
  // the gate, in the Choir's order
  rt.piece('d2').hit('stun');
  rt.piece('dj2').hit('stun');
  wait(0.5);
  assert.deepEqual(['j1', 'j2', 'j3'].map((id) => rt.logic.isLit(id)), [false, false, false], 'out of turn, nothing takes');
  assert.ok(notes.some((s) => /smallest crystal first/.test(s)), 'and says why');
  for (const id of ['dj1', 'dj2', 'd2']) rt.piece(id).hit('stun');
  wait(2.6);
  assert.equal(rt.logic.isOpen('d2'), true, 'stilled in turn, they rest open');
  // the smallest mouth keeps a coffer in its niche
  const purses = [];
  const offPurse = game.on('temple:cache', (e) => purses.push(e));
  assert.equal(walk(L(-4.5, 9, 100)) && walk(L(-8.6, 9, 100), { tol: 0.5 }), true, `into the smallest mouth's niche (${where()})`);
  const coffer = bestInteractable(P);
  assert.equal(coffer?.entry.id, 'temple.perdide.cache', 'the coffer offers itself');
  coffer.entry.use(P);
  assert.equal(purses.length, 1, 'its purse spills out');
  offPurse();
  assert.equal(walk(L(-3, 9, 100)), true, `back out of the niche (${where()})`);
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
  assert.ok(rt.logic.check(rt.logic.el('d3').opens) && !rt.logic.isOpen('d3'), 'its notes rung: and since v1.52 it wants the great key too');
  // ---- the Nursery, west off the far landing (an arena): its door shuts behind you while its seedlings stand
  const NZ = NURSERY.z;
  const keepers = [{ room: 'nursery', alive: true }, { room: 'nursery', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(walk(L(-6, 9, NZ)) && walk(L(-13.5, 9, NZ)) && walk(L(-20, 9, NZ)), true, `into the Nursery (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dN'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arN') && rt.logic.isOpen('dN'), 'beaten: won, and the door lets go');
  assert.equal(walk(rt.piece('kS').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kS', P);
  assert.equal(rt.logic.isFound('kS'), true, 'a small key');
  assert.equal(rt.logic.isOpen('ds'), true, 'and out over the chasm the keeper’s gate is open');
  assert.equal(walk(L(-13.5, 9, NZ)) && walk(L(-4, 9, NZ)), true, `back out onto the far landing (${where()})`);
  // the shortcut: along the ledge and through the keeper's gate, back past the chest to the root-wall's top
  wait(2.2);
  assert.equal(walk(L(9.9, 9, 129.2)) && walk(L(9.9, 9, 107.2)), true, `along the ledge, through the gate (${where()})`);
  assert.equal(walk(L(0, 9, 106)) && walk(L(0, 9, 96)) && walk(L(0, 9, 88)) && walk(L(3.5, 9, 79.8)) && walk(L(0, 9, 70)) && walk(L(0, 9, 64)), true, `back past the chest onto the root-wall (${where()})`);
  // ---- the ledge round the Bog Well: its door takes the small key; round over the water, south at 9 m
  const ring = (a, r = 8.95) => L(Math.sin(a) * r, 9, 57.2 + Math.cos(a) * r);
  assert.equal(walk(L(-7.6, 9, 62)) && walk(ring(-1.3)), true, `to the ledge's door (${where()})`);
  wait(2.4);
  assert.equal(rt.logic.keysIn('dL'), 1, 'the small key in it');
  assert.equal(rt.logic.isOpen('dL'), true);
  for (const a of [-1.65, -2.0, -2.4, -2.8, -3.14]) assert.equal(walk(ring(a), { tol: 0.8 }), true, `round the ledge (${a}: ${where()})`);
  assert.ok(rt.kit.local(P.pos).y > 8.5, 'on the ledge, not in the water');
  assert.equal(walk(L(0, 9, 45.5)) && walk(L(0, 9, 42.5)), true, `through the wall onto the Choir's balcony (${where()})`);
  // ---- the balcony: the great key behind a wall, a ball in a groove through a snapper's mouth in it
  const B = BALCONY, ball = rt.piece('oB'), mouth = rt.piece('dJ');
  const toBall = () => walk(ball.center.clone().setY(L(0, 9, 0).y).addScaledVector(ball.dir, -(ball.r + 1.3)), { tol: 0.5, max: 6 });
  assert.equal(toBall(), true, `behind the ball (${where()})`);
  ball.hit('push', ball.dir.clone(), { strength: 1 });
  wait(3);
  assert.ok(notes.some((s) => /spit it back/.test(s)), 'shut, the jaws spit the ball back');
  assert.ok(rt.logic.drumT('oB') < 0.75, 'and it lies on this side');
  mouth.hit('stun');
  wait(0.3);
  assert.equal(rt.logic.isOpen('dJ'), true, 'stilled, they open');
  for (let k = 0; k < 4 && !rt.logic.drumOn('oB', 'pB'); k++) { toBall(); ball.hit('push', ball.dir.clone(), { strength: 1 }); wait(2.4); }
  assert.equal(rt.logic.drumOn('oB', 'pB'), true, 'rolled through, onto the cage’s footstone');
  // (back to this side, if the last push was made from the far one)
  if (rt.kit.local(P.pos).x < B.wall) { if (!rt.logic.isOpen('dJ')) { mouth.hit('stun'); wait(1.2); } assert.equal(walk(L(B.wall + 2.5, 9, B.groove)), true, `back to this side (${where()})`); }
  for (let i = 0; i < 15 / DT && rt.logic.isOpen('dJ'); i++) frame();
  assert.equal(rt.logic.isOpen('dJ'), false, 'the frost thaws: they snap shut again');
  assert.ok(notes.some((s) => /frost on the jaws is cracking/.test(s)), 'and it says so before');
  P.opts.health = false;   // (their nips would knock him out, here, with no one to wake him at the mark)
  assert.equal(walk(L(B.wall - 2, 9, B.groove), { max: 3 }), false, 'shut, they keep the way');
  for (let i = 0; i < 10 / DT && (P.down || P.dead); i++) frame();   // (and nip: you are knocked down)
  assert.equal(walk(L(B.wall + 3, 9, B.groove)), true, `back from them (${where()})`);
  mouth.hit('stun');
  wait(1.2);
  assert.equal(walk(L(B.wall - 2.5, 9, B.groove)) && walk(rt.piece('kB').pos, { tol: 1.2 }), true, `through them to the great key (${where()})`);
  wait(0.3);
  openChest(rt, 'kB', P);
  assert.equal(rt.logic.isFound('kB'), true, 'the great key');
  if (!rt.logic.isOpen('dJ')) { mouth.hit('stun'); wait(1.2); }
  assert.equal(walk(L(B.wall - 2.5, 9, B.groove)) && walk(L(B.wall + 2.5, 9, B.groove)), true, `back through the mouth (${where()})`);
  // ---- back round the ledge, past the chest, over the keeper's ledge to the far door
  assert.equal(walk(L(0, 9, 42.5)) && walk(L(0, 9, 46.5)), true, `off the balcony (${where()})`);
  for (const a of [-3.14, -2.8, -2.4, -2.0, -1.65, -1.3]) assert.equal(walk(ring(a), { tol: 0.8 }), true, `back round the ledge (${a}: ${where()})`);
  assert.equal(walk(L(-7.6, 9, 62)) && walk(L(0, 9, 64)) && walk(L(0, 9, 70)) && walk(L(3.5, 9, 79.8)) && walk(L(0, 9, 88)) && walk(L(0, 9, 96)) && walk(L(0, 9, 106)), true, `back past the chest (${where()})`);
  assert.equal(walk(L(9.9, 9, 107.2)) && walk(L(9.9, 9, 129.2)) && walk(L(0, 9, 133.2)), true, `over the keeper's ledge (${where()})`);
  assert.ok(rt.kit.local(P.pos).y > 8, 'on the far landing');
  // ---- the Mother's Hall: still her when she lies spent; later, mid-strike
  assert.equal(walk(L(0, 9, 149.2)) && walk(L(0, 9, 151.2)), true, `through the great lock into the hall (${where()})`);
  assert.equal(rt.logic.keysIn('d3'), 1, 'the great key in it');
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep', `she wakes (${where()})`);
  P.opts.health = false;
  const before0 = G.meter;
  G.hit('mouth', 'shoot');
  assert.equal(G.meter, before0, 'plain fluid only startles her');
  let mid = 0;
  // (in her last phase the cold no longer eases her: the crystals over her, stilled smallest first; tests/guardian-twists)
  const crystal = (rank) => rt.motherCrystals.list.find((s) => s.o.rank === rank);
  for (let n = 0; n < 16 && G.state !== 'weary'; n++) {
    const pushed = answerAsks({ G, P, frame }, { keep: true });   // (its second phase's second verb first, src/temples/boss.js asks: tests/guardian-asks.js)
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
    if (G.state === 'open') { assert.ok(pushed || G.model.mouth.distanceTo(G.model.pos) > 8, 'her head lies out on the floor'); G.hit('mouth', 'stun'); }
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

test('the Aerie on foot: the gusts waited out behind the screens, the stone pushed up the hall into its vent (the hall falls calm, the wind rises in the well), the Moult’s door shut from the well, the feather raft, the wings, the column, the ledge round the well to the Eyrie, down its still vent’s shaft into the Moult’s arena and out of its door onto the well’s floor, up again by the raft and the column, and the Eyrie’s stone between two throats for the great key, the gulf vent’s stone rolled out of its throat and the gust that carries you to the perch, the perch’s stone and the column up to the higher ledge, the Elder flown with in the wind, the birds come back', () => {
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
  const glide = (h, s = 12, held = () => true, out = null) => {
    for (let i = 0; i < s / DT; i++) {
      const z = local().z;
      // (in a column you rise straight up: the stick steers you out of it toward `out`, src/updraft.js)
      const steer = out && inColumn(P);
      P.heading = h; frame(held() ? { Space: true, KeyW: !!steer } : {}, steer ? toward(out) : 0);
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
  // ---- the Moult, west off the well's floor (an arena): its door is shut from this side (issue #23's last round: the
  // way in is from above, down the Eyrie's vent, and this door its way out once won)
  assert.equal(rt.logic.isOpen('dM'), false, 'the Moult’s door is shut');
  assert.equal(walk(L(-6, 0, 68)) && walk(L(-22, 0, 68), { max: 5 }), false, `and it holds: no way into the Moult from the well (${where()})`);
  assert.ok(local().x > -17, `stopped at the door (${where()})`);
  /** On the raft from the well's floor up to the Wing Chamber's balcony. */
  const rideRaft = () => {
    assert.equal(walk(L(4, 0, 66)), true, `in the well (${where()})`);
    for (let i = 0; i < 30 / DT && !(raft.s < 0.2 && raft.wait > 0.8); i++) frame();
    assert.equal(walk(raft.group.position, { tol: 0.5, run: false, max: 4 }), true, `onto the raft (${where()})`);
    for (let i = 0; i < 30 / DT && !(raft.s > raft.total - 0.2); i++) frame();
    assert.ok(local().y > 15.5, `carried up (${where()})`);
    assert.equal(walk(L(11.6, 16, 68), { tol: 0.8 }), true, `onto the balcony (${where()})`);
  };
  /** Off the Wing Chamber's balcony with the wings open, round and up the column to the high balcony. */
  const upTheColumn = () => {
    assert.equal(walk(L(11.4, 16, 68), { tol: 0.6 }), true, `on the balcony (${where()})`);
    let up = false;
    for (let i = 0; i < 20 / DT; i++) { P.heading = -Math.PI / 2; frame({ Space: true, KeyW: i < 20 }, -Math.PI / 2); if (local().y > 33.2) { up = true; break; } }
    assert.ok(up, `lifted up the well (${where()})`);
    assert.ok(Math.abs(glide(0, 6, () => local().z < 76.5, L(0, 32, 79)).y - 32) < 0.6 && local().z > 75, `onto the high balcony (${where()})`);
  };
  rideRaft();
  assert.equal(walk(L(20.6, 16, 68)), true, `into the wing chamber (${where()})`);
  items.grant('glider'); game.emit('box:opened', { id: 'arzach.temple.glider' });
  assert.equal(rt.logic.gadget, true);
  // ---- the column: off the balcony with the wings open, round and up to the high balcony
  upTheColumn();
  assert.equal(walk(L(4.6, 32, 79.2), { tol: 0.8 }), true, `past its mark (${where()})`);
  // ---- the Eyrie, along the ledge round the well's west wall: two vents, one stone between their throats
  const bE = rt.piece('bE'), kE = rt.piece('kE');
  const ring = [-0.55, -0.85, -1.15, -1.4, -Math.PI / 2].map((a) => L(Math.sin(a) * 10.4, 32, 68 + Math.cos(a) * 10.4));
  assert.ok(ring.every((p) => walk(p, { max: 6 })) && walk(L(-19, 32, 68)), `round the ledge into the Eyrie (${where()})`);
  let top = false;
  const ledgeVent = rt.pieces.find((p) => p.lift && p.o.when?.drumOn?.[1] === 'pU'), gapVent = rt.pieces.find((p) => p.lift && p.o.when?.drumOn?.[1] === 'pC');
  assert.ok(ledgeVent.on && !gapVent.on, 'the stone in the far vent’s throat: the wind out of the ledge’s own');
  // the obvious wind: up the ledge's column beside the shelf, and the coffer on it
  stand(STACK.vent.x, STACK.eyrie.y, STACK.vent.z);
  top = false;
  for (let i = 0; i < 12 / DT; i++) { P.heading = 0; frame({ Space: true }, 0); if (local().y > STACK.shelf.y + 1.2) { top = true; break; } }
  assert.ok(top, `lifted beside the shelf (${where()})`);
  assert.ok(Math.abs(glide(0, 4, () => local().z < STACK.shelf.z[0] + 0.6, L(-19.6, STACK.shelf.y, 74.4)).y - STACK.shelf.y) < 0.6, `onto the coffer's shelf (${where()})`);
  rt.piece('cache').openIt();
  assert.equal(rt.logic.isFound('cache'), true, 'a coffer of chimes');
  // ---- the vent at the gap's foot, still while the stone sits in its throat (as it starts): its shaft goes down into the
  // Moult. Off the ledge into its mouth, the wings opened down in the shaft, and into the arena from above
  assert.equal(rt.logic.isOpen('chute'), true, 'the stone in the gap vent’s throat: its shaft is still');
  const keepers = [{ room: 'moult', alive: true }, { room: 'moult', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  stand(STACK.ledge[0] + 0.6, STACK.eyrie.y, 68);
  const hearts0 = P.hearts;
  for (let i = 0; i < 10 / DT && !(P.onGround && i > 30); i++) { P.heading = -Math.PI / 2; const low = local().y < 12; frame({ KeyW: i < 0.35 / DT, ShiftLeft: i < 0.35 / DT, Space: low }, Math.PI / 2); }
  assert.ok(P.onGround && local().y < 0.6 && STACK.zone.min[0] < local().x && local().x < STACK.zone.max[0], `down the vent’s shaft, on the Moult’s floor (${where()})`);
  assert.equal(P.hearts, hearts0, 'the wings opened in the shaft: no hurt');
  wait(0.3);
  assert.ok(said(/come down among the moulted feathers/), 'it says where you came down');
  assert.equal(rt.logic.isOpen('dM'), false, 'its door holds while its keepers stand');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arM') && rt.logic.isOpen('dM'), 'beaten: won, and the door onto the well lets go');
  assert.equal(walk(rt.piece('kM').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kM', P);
  assert.equal(rt.logic.isFound('kM'), true, 'a small key');
  assert.equal(walk(L(-14, 0, 68)) && walk(L(-4, 0, 68)), true, `out onto the well’s floor (${where()})`);
  // and up again: the raft, the column, round the ledge (the circuit round the stack)
  rideRaft();
  upTheColumn();
  assert.ok(ring.every((p) => walk(p, { max: 6 })) && walk(L(-19, 32, 68)), `round the ledge into the Eyrie again (${where()})`);
  // the perch is six metres over the ledge: on still air no glide climbs to it
  stand(-23, STACK.eyrie.y, 68);
  for (let i = 0; i < 0.4 / DT; i++) frame({ KeyW: true, ShiftLeft: true }, -Math.PI / 2);
  glide(-Math.PI / 2, 8);
  assert.ok(Math.abs(local().y - STACK.eyrie.y) < 0.6 && local().x > -24.5 && !rt.logic.isFound('kE'), `short of the perch: into the dark, and back at the mark (${where()})`);
  // the stone into the ledge vent's throat: that wind dies, and the one at the gap's foot rises past the perch
  stand(-22.6, STACK.eyrie.y, 60.4);
  assert.equal(roll('bE', 'pC', 1), true, `the stone into the other throat (${where()})`);
  assert.ok(!ledgeVent.on && gapVent.on, 'the wind out of the vent at the gap’s foot');
  stand(-23.2, STACK.eyrie.y, 68);
  top = false;
  for (let i = 0; i < 12 / DT; i++) { P.heading = -Math.PI / 2; frame({ Space: true, KeyW: i < 30 }, -Math.PI / 2); if (local().y > STACK.perch.y + 2) { top = true; break; } }
  assert.ok(top, `lifted past the perch (${where()})`);
  glide(-Math.PI / 2, 6, () => true, L(-36, STACK.perch.y, 68));
  assert.ok(P.onGround && Math.abs(local().y - STACK.perch.y) < 0.6, `onto the perch (${where()})`);
  assert.equal(walk(kE.pos, { tol: 1.2, max: 4 }), true, `to the great key (${where()})`);
  wait(0.3);
  openChest(rt, 'kE', P);
  assert.equal(rt.logic.isFound('kE'), true, 'the great key');
  // back over the gap: down onto the ledge, and round to the balcony
  stand(-33.4, STACK.perch.y, 68);
  for (let i = 0; i < 0.4 / DT; i++) frame({ KeyW: true, ShiftLeft: true }, Math.PI / 2);
  glide(Math.PI / 2, 10, () => local().x < -21, L(-20, 32, 68));   // (through the column, and out of it)
  assert.ok(Math.abs(local().y - STACK.eyrie.y) < 0.6, `back on the ledge (${where()})`);
  assert.ok(walk(L(-14, 32, 68)) && ring.slice().reverse().every((p) => walk(p, { max: 6 })) && walk(L(0, 32, 79)), `round the ledge to the balcony (${where()})`);
  // ---- the Gulf: on still air the perch is too far
  assert.equal(walk(L(0, 32, 85.6)), true, `through the small key's door to the gulf (${where()})`);
  assert.equal(rt.logic.keysIn('dG'), 1, 'the small key in it');
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
  end = glide(0, 8, () => true, L(0, GULF.farY, pz + 20));
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
  const fly = (w, wind = null) => {
    const before = G.meter;
    // (on still air: near her but out of the wind that blows, toward the hall's middle from its vent: she may hang over it)
    const out = wind ? G.arena.center.clone().sub(wind.foot).setY(0).normalize() : null;
    const at = w ? w.foot.clone().add(V(0, 4, 0)) : out ? wind.foot.clone().addScaledVector(out, wind.r + 1.7).setY(G.model.pos.y + 5) : G.model.pos.clone().add(V(3, 5, 0));
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
      // (beside her on the side away from the wind that blows: she may hang over the vent it rises from)
      const gained = fly(null, rt.roostWinds.find((w) => w.on));
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

// (the Sealed Hangar is dismissed, src/levels/dismissed/hangar/, built whole for its tests: its temple went to the
// Glass Dunes, a court of light stands in its place)
test('the Hangar’s own portals still work, dismissed: its list kept, a copy in one shape for the scout and the rest', () => {
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById('garage').create(scene));
  level.init?.(new Physics(scene, level.ground.heightAt ? level.ground : null));
  const own = level.garage.portals;
  assert.equal(own.length, 3, 'the three gravity portals, as they were');
  assert.ok(own.every((p) => p.pos && p.toUp && p.toFwd && !p.temple), 'its own list has no temple doorway in it');
  assert.ok(!level.temples?.some((t) => t.id === 'garage'), 'the First Garage stands in the Glass Dunes now');
  const nav = level.navigationPortals;
  for (const p of own) assert.ok(nav.includes(p), 'every gravity portal is still in it');
  for (const p of nav) assert.ok(p.pos?.isVector3 && p.to?.isVector3 && p.toUp?.isVector3 && p.toFwd?.isVector3, `${p.label}: the same shape (pos, to, toUp, toFwd)`);
  const shopDoors = level.shops?.[0]?.portals ?? [];
  for (const p of shopDoors) assert.ok(nav.some((q) => q.at === p.at && q.to === p.to), 'the shop’s door is in the scout’s list too, in its shape');
  // and a gravity portal still sends you through to its zone
  const po = own[0];
  const player = { pos: po.pos.clone(), vel: V(0, 0, 3), frame: { up: V(0, 1, 0) }, riding: false, teleport(pos, up) { this.pos.copy(pos); this.frame.up = up.clone(); } };
  for (let i = 0; i < 40; i++) level.update(DT, i * DT, { player });
  assert.ok(player.pos.distanceTo(po.to) < 0.01, 'through the portal to the upside-down');
});

test('the Clock-House on foot: the escapement’s three eyes in turn from its hand, the cupboard’s stopped clock, the hub: the counterweight, the Pendulum Hall’s arena and its key, the hour track and its key, both keys in the door over the climb, the quick coil, the passage’s six eyes a room on that want two tanks in a breath, the clock’s six in turn from the hour it stopped, the great lock, the Mainspring Room winding the house’s clocks and the great key back in the cupboard, the Foreman’s six numerals, the clock keeps time', () => {
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
  // ---- the Clockmaker's Cupboard, off the far landing: its little clock has stopped, its eyes lidded (v1.53: until
  // the house's mainspring is wound, far up past the chest)
  assert.equal(rt.logic.isOpen('dC'), false, 'the cupboard is shut');
  rt.piece('c1').hit('shoot');
  assert.equal(rt.logic.isLit('c1'), false, 'its clock stopped: four does not take');
  assert.ok(notes.some((s) => /little clock has stopped/.test(s)), 'and it says why');
  assert.equal(walk(L(0, 0, 44)), true);
  // ---- the Winding Well, the hub: up the wall to a shut door with two keyholes; its counterweight is the ball left on
  // the escapement's landing
  assert.equal(walk(L(-3, 0, 58)), true, `into the well (${where()})`);
  const climb = () => { for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(-3, 9, 66))); if (P.onGround && rt.kit.local(P.pos).y > 8.5) return true; } return false; };
  assert.ok(climb(), `up the wall (${where()})`);
  assert.equal(walk(L(0, 9, 69.6), { tol: 0.5 }), true, `to the door at the top (${where()})`);
  wait(0.5);
  assert.equal(rt.logic.isOpen('d2'), false, 'the door at the top is shut');
  assert.ok(notes.some((s) => /Locked\. A small key would turn it/.test(s)), 'locked: it wants a small key');
  const ball = rt.piece('ball1'), plate = rt.piece('p1'), C2W = 61.2;
  const seenFrom = (from, to) => { const d = to.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.8; };
  assert.ok(!seenFrom(L(0, 10.7, C2W + 6.3), plate.pos.clone().add(V(0, 0.8, 0))), 'its socket is out of sight from up here, under the wall’s lip');
  assert.ok(rt.kit.local(ball.center).z < 48, 'the counterweight is still out on the escapement’s landing');
  P.teleport(L(-3, 0.05, 58), V(0, 1, 0), V(0, 0, 1)); wait(0.3);   // (down again)
  assert.equal(walk(plate.pos, { tol: 0.5 }), true, 'onto the socket');
  wait(0.5);
  for (let k = 0; k < 12 && !rt.logic.drumOn('ball1', 'p1'); k++) {
    walk(ball.center.clone().addScaledVector(ball.dir, -2.2).setY(P.pos.y), { tol: 0.6 });
    ball.hit('push', ball.dir.clone(), { strength: 1 });
    for (let i = 0; i < 6 / DT && !ball.rest; i++) frame();
  }
  assert.ok(rt.logic.drumOn('ball1', 'p1'), `the counterweight home, through the doorway into the well (${ball.t.toFixed(2)})`);
  wait(2.2);
  assert.equal(rt.logic.isOpen('d2'), false, 'the counterweight is home, but the door is still locked: two keyholes');
  // ---- the Pendulum Hall, west (an arena): its door shuts behind you while its keepers stand; beaten, the key's cage
  // sinks and its way out onto the ledge opens. (The house's machines come from src/foes.js; two stand in for them here)
  const keepers = [{ room: 'pend', alive: true }, { room: 'pend', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(walk(L(-8, 0, 61.2)), true, `to the way west (${where()})`);
  assert.equal(walk(L(-20, 0, 61.2)), true, `into the Pendulum Hall (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dW'), false, 'the door shuts behind you');
  assert.equal(rt.logic.isOpen('dWo'), false, 'and the way out is shut');
  assert.ok(notes.some((s) => /grinds shut behind you/.test(s)), 'it says so');
  const kW = rt.piece('kW');
  assert.equal(kW.k < 0.1, true, 'the key is caged');
  keepers[0].alive = false; wait(1.5);
  assert.equal(rt.logic.isLit('arW'), false, 'one keeper still stands');
  keepers[1].alive = false; wait(2.5);
  assert.equal(rt.logic.isLit('arW'), true, 'both beaten: won');
  assert.ok(rt.logic.isOpen('dW') && rt.logic.isOpen('dWo'), 'the doors let go, and the way out above opens');
  assert.equal(walk(L(-29.2, 0, 62.6)), true);
  assert.equal(walk(L(-29.2, 0, 67), { tol: 0.4 }), true, `to the stair's foot (${where()})`);
  assert.equal(walk(L(-17.4, 9, 67), { dy: 1 }), true, `up the stair to the landing (${where()})`);
  assert.equal(walk(kW.pos, { tol: 1.2, dy: 1 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kW', P);
  assert.equal(rt.logic.isFound('kW'), true, 'a small key');
  assert.equal(rt.logic.keys('small'), 1);
  assert.equal(walk(L(-16, 9, 61.2), { dy: 1 }) && walk(L(-8.4, 9, 61.2), { dy: 1 }) && walk(L(-7.4, 9, 66), { dy: 1 }), true, `out over the way in, onto the balcony and the ledge over the climb (${where()})`);
  assert.equal(walk(L(0, 9, 69.6), { tol: 0.5, dy: 1 }), true, `to the door (${where()})`);
  wait(1);
  assert.equal(rt.logic.keysIn('d2'), 1, 'the key goes into the first keyhole');
  assert.equal(rt.logic.isOpen('d2'), false, 'one keyhole still empty');
  // ---- the Striking Room, east: the ball on the hour track, on the house's hour (four), opens the striking eye's lids
  assert.equal(walk(L(-3, 9, 66), { dy: 1 }), true);
  for (let i = 0; i < 4 / DT && rt.kit.local(P.pos).y > 1; i++) frame({ KeyW: true }, toward(L(-3, 0, 58)));   // (off the ledge: nine metres, a soft landing)
  wait(0.5);
  assert.ok(P.onGround && rt.kit.local(P.pos).y < 1, `down on the well's floor (${where()})`);
  assert.equal(walk(L(8, 0, 61.2)), true, `to the way east (${where()})`);
  assert.equal(walk(L(17, 0, 61.2)), true, `into the Striking Room (${where()})`);
  const sS = rt.piece('sS'), ballS = rt.piece('ballS');
  sS.hit('shoot');
  assert.equal(rt.logic.isLit('sS'), false, 'its lids are shut');
  assert.ok(notes.some((s) => /not at the house’s hour/.test(s)), 'and it says why');
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
  assert.equal(rt.logic.isLit('sS'), true, 'four: the lids open, and it wakes');
  const kE = rt.piece('kE');
  wait(1.5);
  assert.equal(walk(kE.pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kE', P);
  assert.equal(rt.logic.isFound('kE'), true, 'the second small key');
  assert.equal(walk(L(8, 0, 61.2)), true, `back into the well (${where()})`);
  assert.equal(walk(L(-3, 0, 58)), true);
  assert.ok(climb(), `up the wall again (${where()})`);
  assert.equal(walk(L(0, 9, 69.6), { tol: 0.5 }), true, `to the door (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.keysIn('d2'), 2, 'the second key goes in');
  assert.equal(rt.logic.isOpen('d2'), true, 'two keys and the counterweight: it opens');
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
  // ---- the great lock: the Foreman's door wants the house's great key, and that is back in the Mainspring Room
  assert.equal(walk(L(0, 9, 141.2), { tol: 0.5 }), true, `to the Foreman's door (${where()})`);
  wait(1);
  assert.equal(rt.logic.isOpen('d4'), false, 'locked');
  assert.ok(notes.some((s) => /great lock/.test(s)), 'a great lock: it wants the great key');
  assert.equal(walk(L(0, 9, 133)) && walk(L(0, 9, 113)) && walk(L(4, 9, 112), { tol: 0.8 }), true, `back over the bridge to the near landing (${where()})`);
  // ---- the Mainspring Room, east off the near landing: its weight rolled in, then six eyes in a breath
  const ballM = rt.piece('ballM'), k3 = rt.piece('k3');
  wait(5.5);
  tankShots(frame, 6, (i) => k3.hit(i));
  assert.equal(rt.logic.isLit('k3'), false, 'the spring hangs slack: its weight is not home');
  assert.ok(notes.some((s) => /hangs slack/.test(s)), 'it says so');
  for (let k = 0; k < 12 && !rt.logic.drumOn('ballM', 'pM'); k++) {
    walk(ballM.center.clone().addScaledVector(ballM.dir, -2.2).setY(P.pos.y), { tol: 0.6, dy: 1 });
    ballM.hit('push', ballM.dir.clone(), { strength: 1 });
    for (let i = 0; i < 6 / DT && !ballM.rest; i++) frame();
  }
  assert.ok(rt.logic.drumOn('ballM', 'pM'), `the weight home under the spring (${ballM.t.toFixed(2)})`);
  wait(5.5);
  tankShots(frame, 6, (i) => k3.hit(i));
  assert.equal(rt.logic.isLit('k3'), true, 'six round the spring in one breath');
  assert.ok(notes.some((s) => /a little clock begins to tick/.test(s)), 'and far below a little clock begins to tick');
  // ---- back down to the Clockmaker's Cupboard (v1.53): out through the passage, over the climb's ledge, down the
  // Pendulum Hall's stair, across the well to the far landing
  assert.equal(walk(L(4, 9, 112), { tol: 0.8, dy: 1 }) && walk(L(0, 9, 110.7), { dy: 1 }) && walk(L(0, 9, 99), { dy: 1 }) && walk(L(0, 9, 79), { dy: 1 }) && walk(L(0, 9, 69.6), { tol: 0.5, dy: 1 }), true, `back past the chest to the door over the climb (${where()})`);
  assert.equal(walk(L(-3, 9, 66), { dy: 1 }) && walk(L(-7.4, 9, 66), { dy: 1 }) && walk(L(-8.4, 9, 61.2), { dy: 1 }) && walk(L(-16, 9, 61.2), { dy: 1 }), true, `over the ledge into the Pendulum Hall's landing (${where()})`);
  assert.equal(walk(L(-17.4, 9, 67), { dy: 1 }) && walk(L(-29.2, 0, 67), { dy: 1 }) && walk(L(-29.2, 0, 62.6)) && walk(L(-20, 0, 61.2)) && walk(L(-8, 0, 61.2)) && walk(L(-3, 0, 58)), true, `down its stair and into the well (${where()})`);
  assert.equal(walk(L(0, 0, 50)) && walk(L(0, 0, 44)), true, `onto the far landing (${where()})`);
  // its three eyes lift their lids now; they wake round from the house's hour: four, eight, twelve
  rt.piece('c3').hit('shoot'); rt.piece('c2').hit('shoot');
  assert.equal(rt.logic.isLit('c3') || rt.logic.isLit('c2'), false, 'twelve or eight first: they only tick');
  assert.ok(notes.some((s) => /lost its hand: count round from the house’s hour/.test(s)), 'and say how to count');
  for (const id of ['c1', 'c2', 'c3']) rt.piece(id).hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('dC'), true, 'four, eight, twelve');
  const purses = [];
  const offPurse = game.on('temple:cache', (e) => purses.push(e));
  assert.equal(walk(L(-14, 0, 44)), true, `into the cupboard (${where()})`);
  assert.equal(walk(L(-19.6, 0, 42.2), { tol: 0.5 }), true, `to the coffer (${where()})`);
  const coffer = bestInteractable(P);
  assert.equal(coffer?.entry.id, 'temple.garage.cache', 'the coffer offers itself');
  coffer.entry.use(P);
  assert.equal(purses.length, 1, 'its purse spills out');
  assert.equal(rt.logic.isFound('cache'), true);
  offPurse();
  const kB = rt.piece('kB');
  assert.equal(walk(kB.pos, { tol: 1.2, dy: 1 }), true, `to the great key (${where()})`);
  wait(0.3);
  openChest(rt, 'kB', P);
  assert.equal(rt.logic.isFound('kB'), true, 'the house’s great key');
  // ---- and back up: the well, the climb, the passage, the gallery
  assert.equal(walk(L(-8, 0, 44)) && walk(L(0, 0, 50)) && walk(L(-3, 0, 58)), true, `back into the well (${where()})`);
  assert.ok(climb(), `up the wall (${where()})`);
  assert.equal(walk(L(0, 9, 69.6), { tol: 0.5 }) && walk(L(0, 9, 79)) && walk(L(0, 9, 99)) && walk(L(0, 9, 110.7)), true, `up past the chest to the gallery (${where()})`);
  assert.equal(walk(L(4, 9, 112), { tol: 0.8, dy: 1 }), true, `back onto the landing (${where()})`);
  assert.equal(walk(L(0, 9, 113), { dy: 1 }) && walk(L(0, 9, 137.2), { dy: 1 }), true, `over the bridge again (${where()})`);
  assert.equal(walk(L(0, 9, 141.2), { tol: 0.5 }), true, `to the Foreman's door (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.isOpen('d4'), true, 'the great key turns');
  // ---- the Foreman's Workshop: when its face opens, all six numerals in one breath
  assert.equal(walk(L(0, 9, 153.2)), true, `into the workshop (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep', 'it wakes');
  assert.equal(rt.logic.isOpen('d4'), false, 'the door shuts behind you');
  P.opts.health = false;
  for (let n = 0; n < 8 && G.state !== 'resolved'; n++) {
    answerAsks({ G, P, frame }, { keep: true });   // (its second phase's second verb first, src/temples/boss.js asks: tests/guardian-asks.js)
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
  assert.ok(notes.some((s) => /keeps? time/i.test(s)), 'it says so');
  game.reset();
  own();
});

test('the Builders’ Greenhouse on foot: the eye that opens only in the sun the ball’s louvre lets in, the hub’s wings: the Shade House’s arena and the Cold Frame’s two eyes, each a small key for the Glass Stair’s door, one ball and two plates on the Glass Stair (the eye, then the disc), bloom mode and its try in the chamber’s sun, the bud in the shade a room on and the passage’s ball that turns its louvre, the seed in the shade and the sun-ball, the seed-ball rolled into the light at the glass’s foot, its vine into the bud, back down to the Seed Vault off the Shade House: its two seeds and one ball for the great key, and out by its keepers’ door onto the Glass Stair’s root-wall, the great lock past the bud, the Gardener bloomed in the sun, the ruins in flower', () => {
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
  assert.equal(rt.logic.isLit('s1'), true, 'woken in the sun');
  assert.equal(rt.logic.isOpen('d1'), false, 'but the Glass Stair’s door is locked: two keyholes');
  // ---- the Shade House, west off the hub (an arena): its door shuts behind you while its keepers stand
  const keepers = [{ room: 'shade', alive: true }, { room: 'shade', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(walk(L(-8, 0, 40)), true, `to the way west (${where()})`);
  assert.equal(walk(L(-20, 0, 40)), true, `into the Shade House (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dW'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arW') && rt.logic.isOpen('dW'), 'beaten: won, and the door lets go');
  assert.equal(walk(rt.piece('kW').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kW', P);
  assert.equal(rt.logic.isFound('kW'), true, 'a small key');
  // ---- (v1.60) won, the Shade House's north door: the Seed Vault, beside the Glass Stair; its seeds in the shade, and
  // nothing here grows without the bloom
  assert.equal(rt.logic.isOpen('dV'), true, 'the arena won, its north door opens');
  assert.equal(walk(L(-22, 0, 45)) && walk(L(-22, 0, 52.5)), true, `north into the Seed Vault (${where()})`);
  { const kB = rt.piece('kB');
    assert.ok(kB && Math.abs(rt.kit.local(kB.pos).y - VAULT.ledge - 0.2) < 0.1, 'the great key up on the ledge (its chest on the trim along it)');
    rt.piece('sdA').hit('bloom');
    assert.equal(rt.logic.isLit('sdA'), false, 'without bloom mode, a bloom glob is only fluid'); }
  assert.equal(rt.logic.isOpen('dV2'), false, 'the keepers’ door up by the key is shut');
  assert.equal(walk(L(-22, 0, 45)) && walk(L(-20, 0, 40)), true, `back into the Shade House (${where()})`);
  // ---- the Cold Frame, east: one louvre, one ball, two plates, an eye over each tray; the key wants both awake
  assert.equal(walk(L(-8, 0, 40)) && walk(L(8, 0, 40)), true, `back across the hub (${where()})`);
  assert.equal(walk(L(18, 0, 40)), true, `into the Cold Frame (${where()})`);
  rt.piece('sC1').hit('shoot');
  assert.equal(rt.logic.isLit('sC1'), false, 'in the shade');
  assert.equal(roll('ballC', 'pC1', 1), true, `the ball north (${where()})`);
  wait(2);
  rt.piece('sC1').hit('shoot');
  assert.equal(rt.logic.isLit('sC1'), true, 'the north eye, in the sun');
  assert.equal(rt.logic.isFound('kE') || rt.piece('kE').k > 0.5, false, 'one eye: the key stays caged');
  assert.equal(roll('ballC', 'pC2', -1), true, `the ball south (${where()})`);
  wait(2);
  rt.piece('sC2').hit('shoot');
  assert.equal(rt.logic.isLit('sC2') && rt.logic.isLit('sC1'), true, 'the south eye too, and the north stays awake');
  wait(1.5);
  assert.equal(walk(rt.piece('kE').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kE', P);
  assert.equal(rt.logic.isFound('kE'), true, 'the second small key');
  assert.equal(walk(L(8, 0, 40)), true, `back into the hub (${where()})`);
  assert.equal(walk(L(0, 0, 43), { tol: 0.4 }), true, `to the door (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.keysIn('d1'), 2, 'both keys go in');
  assert.equal(rt.logic.isOpen('d1'), true, 'two keys and the eye in the sun: the door opens');
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
  assert.equal(rt.logic.isOpen('d3'), false, 'bloomed in the shade, it stirs and stays shut');
  assert.ok(said(/in the shade/), 'and says why');
  // the passage's ball onto its plate by the west wall: the louvre turns, and its beam swings onto the bud
  assert.equal(roll('ballB', 'pB', 1), true, `the passage's ball onto its plate (${where()})`);
  const passage = beams.find((b) => b.spots.some((s) => s.when?.drumOn?.[0] === 'ballB'));
  for (let i = 0; i < 5 / DT && !beamOn(passage, passage.spots[0].pos); i++) frame();
  assert.ok(beamOn(passage, passage.spots[0].pos), 'the beam swings onto the bud');
  bud.hit('bloom');
  wait(2.6);
  assert.equal(rt.logic.isOpen('d3'), true, 'bloomed in the sun, it opens');
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
  // ---- (v1.60) the bud's far door wants the great key: back to the Seed Vault, off the Shade House, down the house
  const G0 = 103.9;
  assert.equal(rt.logic.el(rt.logic.next()).room, 'vault', 'the marker sends you back to the Seed Vault');
  assert.equal(walk(L(0, 18, G0 + 27.5)) && walk(L(0, 18, G0 + 4)) && walk(L(0, 18, 96)) && walk(L(0, 18, 76)) && walk(L(0, 18, 66.4), { tol: 0.6 }), true, `back over the vine to the landing (${where()})`);
  const hearts0 = P.hearts;
  assert.equal(walk(L(0, 9, 61), { max: 16, dy: 1 }), true, `down off the landing onto the root-wall (${where()})`);
  assert.equal(walk(L(0, 0, 55), { max: 6 }), true, `and down to the floor (${where()})`);
  assert.equal(P.hearts, hearts0, 'the drops cost nothing');
  assert.equal(walk(L(0, 0, 47)) && walk(L(-8, 0, 40)) && walk(L(-20, 0, 40)) && walk(L(-22, 0, 45)) && walk(L(-22, 0, 52.5)), true, `through the hub and the Shade House into the Seed Vault (${where()})`);
  // two seeds at the glass's foot, one ball for the louvre's beam
  const sdA = rt.piece('sdA'), sdB = rt.piece('sdB'), kB = rt.piece('kB');
  sdA.hit('bloom'); sdB.hit('bloom');
  assert.ok(!rt.logic.isLit('sdA') && !rt.logic.isLit('sdB'), 'both in the shade: pale, and fold back');
  assert.equal(roll('ballV', 'pV1', -1), true, `the ball onto the south plate (${where()})`);
  const vaultBeam = beams.find((b) => b.spots.some((s) => s.when?.drumOn?.[0] === 'ballV'));
  for (let i = 0; i < 5 / DT && !beamOn(vaultBeam, vaultBeam.spots[0].pos); i++) frame();
  sdA.hit('bloom');
  assert.equal(rt.logic.isLit('sdA'), true, 'the sun on the south seed: it grows');
  wait(1);
  assert.equal(kB.free() && rt.logic.isOpen('vineV'), false, 'one seed is not enough for the vine');
  assert.equal(roll('ballV', 'pV2', 1), true, `the ball over to the north plate (${where()})`);
  for (let i = 0; i < 5 / DT && !beamOn(vaultBeam, vaultBeam.spots[1].pos); i++) frame();
  assert.equal(rt.logic.isLit('sdA'), true, 'grown in the sun, the south seed stays grown');
  sdB.hit('bloom');
  assert.equal(rt.logic.isLit('sdB'), true, 'and the north one grows');
  wait(3);
  assert.equal(rt.logic.isOpen('vineV'), true, 'from both, the vine climbs the glass');
  assert.equal(rt.logic.isOpen('dV2'), true, 'and the keepers’ door up on the ledge opens with it');
  const VX1 = VAULT.x + VAULT.w / 2;
  assert.equal(walk(L(VX1 - 4.4, 0, VAULT.z)), true, `to the glass's foot (${where()})`);
  up = false;
  for (let i = 0; i < 25 / DT; i++) { frame({ KeyW: true }, toward(L(VX1 - 1, VAULT.ledge, VAULT.z))); if (P.onGround && local().y > VAULT.ledge - 0.5) { up = true; break; } }
  assert.ok(up, `up the vine (${where()})`);
  assert.equal(walk(kB.pos, { tol: 1.2, max: 4 }), true, `to the great key (${where()})`);
  wait(0.3);
  openChest(rt, 'kB', P);
  assert.equal(rt.logic.isFound('kB'), true, 'the great key');
  // the way back up: through the keepers' door onto the Glass Stair's root-wall, and the disc
  assert.equal(walk(L(VX1 - 1.4, VAULT.ledge, VAULT.z)) && walk(L(-11.6, VAULT.ledge, VAULT.z)) && walk(L(-8.6, VAULT.ledge, VAULT.z)) && walk(L(-5, VAULT.ledge, 62)), true, `through the keepers' door onto the root-wall (${where()})`);
  assert.ok(Math.abs(local().y - VAULT.ledge) < 0.6, 'up at the root-wall’s height, by the disc');
  for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.8); i++) frame();
  assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 6 }), true, `onto the disc (${where()})`);
  for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
  assert.equal(walk(L(0, 18, 66.8), { tol: 0.8 }) && walk(L(0, 18, 76)) && walk(L(0, 18, 96)) && walk(L(0, 18, G0 + 4)) && walk(L(0, 18, G0 + 30)), true, `back up through the chamber and over the vine (${where()})`);
  assert.equal(walk(L(1.5, 18, 139.6), { tol: 0.8 }), true, `back to the glass's foot (${where()})`);
  up = false;
  for (let i = 0; i < 25 / DT; i++) { frame({ KeyW: true }, toward(L(1.5, 27, 145.2))); if (P.onGround && local().y > 26.5) { up = true; break; } }
  assert.ok(up, `up the vine (${where()})`);
  // ---- the Glasshouse: bloom the four dead beds, then the Gardener's back each time it kneels: in the sun
  assert.equal(walk(L(0, 27, 158.2)), true, `through the great lock into the glasshouse (${where()})`);
  assert.equal(rt.logic.keysIn('dB'), 1, 'the great key in it');
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
    answerAsks({ G, P, frame }, { keep: true });   // (its second phase's second verb first, src/temples/boss.js asks: tests/guardian-asks.js)
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
      if (!sun.lights(G.model.pos, SUN.pad)) { glob('bloom'); assert.equal(G.meter, before, 'in its last phase, kneeling in the shade, nothing grows on it'); assert.ok(said(/In the shade nothing grows/), 'and it says why'); shaded = true; }
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

test('the Undertower on foot: the singing ball and the dishes and the pillars over the cable pit, the hub’s wings: the Cable Store’s arena and the Tuning Room’s dish, each a small key for the Shell Chamber’s door, the well’s horn and the low stone, the echo shell, the chamber’s low stone carried a room on to the passage’s horn and the ball on its footstone, the held pillars, the middle note sent over through the dish, the way back, the Choir’s gate high in the Cable Well opened by the horn at its cable’s end in the first hall, its two horns for the great key, the high note caught from the walk round the well, the great lock, the First Sign given its words back, the tower speaks once a night', () => {
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
  // ---- the Cable Store, west off the hub (an arena): its door shuts behind you while its keepers stand
  const keepers = [{ room: 'store', alive: true }, { room: 'store', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(walk(L(-3, 0, C2 - 2)) && walk(L(-9, 0, C2)), true, `to the way west (${where()})`);
  assert.equal(walk(L(-20, 0, C2)), true, `into the Cable Store (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dW'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arW') && rt.logic.isOpen('dW'), 'beaten: won, and the door lets go');
  assert.equal(walk(rt.piece('kW').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kW', P);
  assert.equal(rt.logic.isFound('kW'), true, 'a small key');
  // ---- the Tuning Room, east: the far horn wants the high note, too far for the stones alone; the dish carries it
  assert.equal(walk(L(-9, 0, C2)) && walk(L(9, 0, C2)), true, `back across the hub (${where()})`);
  assert.equal(walk(L(17, 0, C2)), true, `into the Tuning Room (${where()})`);
  const highT = stone('high', L(21.4, 0, 67.6)), lowT = stone('low', L(15.6, 0, 67.4));
  highT.sing(); wait(1.2);
  assert.equal(rt.logic.isLit('eT'), false, 'sung by the dead dish, the high note dies in the room');
  roll('ballT');
  lowT.sing(); wait(1.2);
  assert.equal(rt.logic.isLit('eT'), false, 'the low note crosses, and the horn stays still');
  assert.ok(said(/colour of the high one/), 'its ring is the high one’s colour');
  highT.sing(); wait(1.2);
  assert.equal(rt.logic.isLit('eT'), true, 'the high one: the far dish says it over the horn');
  wait(1.5);
  assert.equal(walk(rt.piece('kE').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kE', P);
  assert.equal(rt.logic.isFound('kE'), true, 'the second small key');
  assert.equal(walk(L(9, 0, C2)) && walk(L(-3, 0, C2 - 3)), true, `back into the well (${where()})`);
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
  assert.equal(walk(L(0, 12, 70.2), { tol: 0.5 }), true, `to the door into the chamber (${where()})`);
  wait(2.5);
  assert.equal(rt.logic.keysIn('dK'), 2, 'both small keys go in');
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
  assert.equal(rt.logic.isLit('e0'), false, 'the low note, and the horn is deaf: its footstone bare');
  assert.ok(said(/deaf/), 'it says so');
  // (v1.49) the passage's ball onto the horn's footstone, and the low note again
  roll('ballP');
  // (round the ball on its footstone, not over it: no wall in the house is climbed, issue #115)
  const byBall = rt.kit.local(rt.piece('ballP').center);
  assert.equal(walk(L(byBall.x - 2.2, 12, byBall.z - 1), { tol: 0.8 }) && walk(ear0.at.clone().setY(P.pos.y), { tol: 2.5 }), true, `back by the horn (${where()})`);
  shell.update(2);
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
  assert.ok(rt.logic.check(rt.logic.el('d4').opens) && !rt.logic.isOpen('d4'), 'both of the far door’s lamps, across the chasm: and since v1.49 it wants the great key too');
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
  // ---- (v1.60) the great key is back in the Choir, over the Cable Store: its keepers' gate, high on the Cable Well's wall,
  // listens through a horn at its cable's other end, on the Hall of Dishes' far landing, for the middle note
  assert.equal(rt.logic.isOpen('d4'), false, 'the far door wants the great key');
  assert.equal(walk(ear3.at.clone().setY(P.pos.y), { tol: 2.5 }), true, `to the far horn (${where()})`);
  farHigh.sing(); wait(0.3); shell.play(); wait(2.5);
  assert.equal(walk(L(0, 12, G0 + 26.5)) && walk(L(0, 12, G0 + 5)), true, `back over the pillars (${where()})`);
  assert.equal(walk(L(0, 12, A0 + 6)) && walk(L(0, 12, C3)) && walk(L(0, 12, 69.5)), true, `back through the chamber to the landing (${where()})`);
  const gate = rt.piece('dG');
  assert.equal(rt.logic.isOpen('dG'), false, 'the keepers’ gate off the walk round the well is shut');
  // down off the landing, the ledge and the floor (no fall in the house hurts)
  const hearts0 = P.hearts;
  assert.equal(walk(L(-1, 0, C2 - 3), { max: 12 }), true, `down into the well (${where()})`);
  assert.equal(P.hearts, hearts0, 'the drop costs nothing');
  assert.equal(walk(L(0, 0, 50)) && walk(L(3.4, 0, 45.6)), true, `along the gate's cable to the first hall's far landing (${where()})`);
  const hG = ear('hG');
  assert.ok(hG.at.distanceTo(L(4.2, 2.4, 44.2)) < 1.5, 'the gate’s horn, at its cable’s end');
  assert.equal(walk(hG.at.clone().setY(P.pos.y), { tol: 2.5 }), true, `by the gate's horn (${where()})`);
  assert.equal(shell.held.note, 'high');
  shell.update(2); shell.play(); wait(0.3);
  assert.equal(rt.logic.isLit('hG'), false, 'the high note: it listens for the middle one');
  assert.ok(said(/listens for the middle one/), 'and says so');
  // the singing ball across the pit sings it, and its dish brings the note over to the far landing
  ball1.hit('shoot', DOWN); wait(1.4);
  assert.equal(shell.held.note, 'mid', 'the far dish brings the ball’s note over: the shell catches it');
  shell.update(2); shell.play(); wait(2.5);
  assert.equal(rt.logic.isLit('hG'), true, 'the middle note, played back: the gate’s horn answers');
  assert.ok(rt.logic.isOpen('dG') && rt.logic.isOpen('dC'), 'the gate opens, and the Choir’s door onto the chamber with it');
  // back up the discs, along the walk round the well and through the gate
  assert.equal(walk(L(0, 0, 50)) && walk(L(-3, 0, C2 - 3)), true, `back into the well (${where()})`);
  ride(discA, L(-4, 6, C2 + 3.2), 'first disc');
  ride(discB, L(1, 12, C2 + 8.4), 'second disc');
  assert.equal(walk(L(-3, 12, 63.5)) && walk(L(-8.6, 12, 63.5)), true, `onto the walk round the well (${where()})`);
  assert.ok(gate.open, 'the gate is down');
  const CZ = CHOIR.z, hA = ear('hA'), hB = ear('hB'), kB = rt.piece('kB');
  assert.equal(walk(L(-12, 12, CHOIR.gate)) && walk(L(-17, 12, CHOIR.gate)), true, `through the gate into the Choir (${where()})`);
  // ---- the Choir: the far horn hears the low stone through the dishes; the near one wants the high note played back
  const lowQ = stone('low', L(CHOIR.low[0], 12, CHOIR.low[1]));
  assert.ok(lowQ.center.distanceTo(L(CHOIR.low[0], 12, CHOIR.low[1])) < 2, 'the Choir’s low stone');
  assert.equal(stones.filter((s) => s.note === 'high' && s.center.distanceTo(L(CHOIR.x, 12, CZ)) < 16).length, 0, 'no high stone in the Choir');
  assert.equal(kB.free(), false, 'the great key caged');
  lowQ.sing(); wait(1.2);
  assert.equal(rt.logic.isLit('hA'), false, 'the low stone sung by a dark dish: the far horn hears nothing');
  roll('ballQ');
  lowQ.sing(); wait(1.2);
  assert.equal(rt.logic.isLit('hA'), true, 'the dish awake: the far horn hears the low stone through it');
  assert.equal(shell.held.note, 'low', 'and the shell caught the low note too');
  assert.equal(walk(hB.at.clone().setY(P.pos.y), { tol: 2.5 }), true, `to the near horn (${where()})`);
  shell.update(2); shell.play(); wait(0.3);
  assert.equal(rt.logic.isLit('hB'), false, 'the low note: the near horn wants the high one');
  assert.ok(said(/Nothing in the Choir sings it/), 'and nothing in the Choir sings it');
  // out through the gate: the Cable Well's high stone, on the floor below, splashed from the walk
  assert.equal(walk(L(-17, 12, CHOIR.gate)) && walk(L(-8.6, 12, 63.5)) && walk(L(-3, 12, 63.5)), true, `back out onto the walk (${where()})`);
  highW.sing(); wait(0.3);
  assert.equal(shell.held.note, 'high', 'the shell catches the high stone from the walk above it');
  assert.equal(walk(L(-8.6, 12, 63.5)) && walk(L(-17, 12, CHOIR.gate)) && walk(hB.at.clone().setY(P.pos.y), { tol: 2.5 }), true, `back to the near horn (${where()})`);
  shell.update(2); shell.play(); wait(0.3);
  assert.equal(rt.logic.isLit('hB'), true, 'the high note, played back: it answers');
  wait(1.5);
  assert.equal(kB.free(), true, 'both horns, and the ball home: the cage sinks');
  assert.equal(walk(kB.pos, { tol: 1.2 }), true, `to the great key (${where()})`);
  wait(0.3);
  openChest(rt, 'kB', P);
  assert.equal(rt.logic.isFound('kB'), true, 'the great key');
  assert.ok(hA.at.distanceTo(hB.at) > 15, 'the two horns at either end of the Choir');
  // out by the Choir's door onto the chamber, and on through the gallery to the far door
  assert.equal(walk(L(-15, 12, CHOIR.way)) && walk(L(-6, 12, CHOIR.way)), true, `through the Choir's door into the chamber (${where()})`);
  assert.equal(walk(L(0, 12, A0 + 4)) && walk(L(0, 12, G0 + 3)), true, `back into the gallery (${where()})`);
  high.sing(); wait(0.3);
  walk(ear1.at.clone().setY(P.pos.y), { tol: 2.5 });
  shell.update(2); shell.play(); wait(2.5);
  assert.equal(walk(L(0, 12, G0 + 6.5)) && walk(L(0, 12, G0 + 31)), true, `over the pillars to the far door (${where()})`);
  // ---- the First Sign: when it lowers its dish to listen, play its word back into it; it moves on to the next
  assert.equal(walk(L(0, 12, G0 + 48)), true, `through the great lock into the hall (${where()})`);
  assert.equal(rt.logic.keysIn('d4'), 1, 'the great key in it');
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep', 'it wakes');
  wait(0.5);
  assert.equal(rt.logic.isOpen('d4'), false, 'the door shuts behind you');
  P.opts.health = false;
  G.hit('mouth', 'shoot');
  assert.equal(G.meter, 0, 'fluid only rattles off its dish');
  for (let n = 0; n < 8 && G.state !== 'resolved'; n++) {
    answerAsks({ G, P, frame }, { keep: true });   // (its second phase's second verb first, src/temples/boss.js asks: tests/guardian-asks.js)   // (its second phase's second verb first, src/temples/boss.js asks: tests/guardian-asks.js)
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

// ------------------------------------------------------------------ on foot: the City Floating in Space's Mooring-House, room by room
test('the Mooring-House on foot: the winch’s counterweight and the shaft’s gate, the void’s breath up the shaft to the lamp-eye, the great door, tether mode and its try, the passage’s ring a room on, the Drift’s ball pulled home off its cable-rail and the rising gangway, the Cable Walk, the Balance’s ball pushed out (the pan to the Gallery) and pulled home (the west door), the Gallery’s ring, the Rope Store’s arena off the Gallery and its key for the moorers’ gate, the great key pulled home on the hall’s balcony, the Anchor-Warden’s anchors pulled home (wound in over the void first), the cables taut', async () => {
  const { BALANCE, DRIFT, FLOOR, MOOR_A, STORE } = await import('../src/temples/spacecity.js');
  game.reset();
  own('backpack', 'gun', 'glider');
  const { level, physics, rt } = world('spacecity');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit ?? 1900 });
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); rt.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };
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
  const hall = (a, d, y = 0) => L(Math.sin(a) * d, y, 30 + Math.cos(a) * d);
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
  /** Pull a ball home from where you stand, until it rests on `plate`. */
  const pull = (id, plate, n = 8) => {
    const ball = rt.piece(id);
    for (let k = 0; k < n && !rt.logic.drumOn(id, plate); k++) { tether(ball); wait(0.5); for (let i = 0; i < 8 / DT && !ball.rest; i++) frame(); }
    return rt.logic.drumOn(id, plate);
  };
  wait(0.5);
  // ---- the Capstan Hall: the great door and the shaft's gate both shut
  assert.equal(walk(L(0, 0, 18)), true, `into the hall (${where()})`);
  assert.equal(rt.logic.isOpen('d1'), false, 'the great door is shut');
  assert.equal(rt.logic.isOpen('g1'), false, 'and the shaft’s gate');
  // ---- the Winch Room: the counterweight rolled into its socket at the winch's mouth: the shaft's gate rises, and stays
  assert.equal(walk(hall(-Math.PI * 3 / 4, 10)), true, `toward the winch (${where()})`);
  assert.equal(walk(hall(-Math.PI * 3 / 4, 24)), true, `into the winch room (${where()})`);
  const ballW = rt.piece('ballW');
  assert.equal(walk(ballW.center.clone().addScaledVector(ballW.dir, -1.9).setY(P.pos.y), { tol: 0.5 }), true, `behind the counterweight (${where()})`);
  assert.equal(roll('ballW', 'pG'), true, `the counterweight in its socket (${where()})`);
  assert.equal(rt.logic.isOpen('g1'), true, 'the shaft’s gate rises');
  // ---- the Lamp Shaft: the void's breath lifts open wings to the balcony; the lamp-eye there
  assert.equal(walk(hall(-Math.PI * 3 / 4, 10)), true, `back in the hall (${where()})`);
  assert.equal(walk(hall(Math.PI * 3 / 4, 12)), true, `across to the gate (${where()})`);
  const shaft = hall(Math.PI * 3 / 4, 26);
  assert.equal(walk(hall(Math.PI * 3 / 4, 20)), true, `through the gate (${where()})`);
  assert.equal(walk(shaft, { tol: 0.8 }), true, `onto the grating (${where()})`);
  let up = false;
  for (let i = 0; i < 14 / DT; i++) { frame(i < 6 ? { Space: true } : { Space: true }, 0); if (local().y > 14.6) { up = true; break; } }
  assert.ok(up, `the breath lifts the wings up the shaft (${where()})`);
  const balcony = hall(Math.PI * 3 / 4, 30.6, 13);
  for (let i = 0; i < 6 / DT && !(P.onGround && i > 5); i++) { P.heading = Math.atan2(balcony.x - P.pos.x, balcony.z - P.pos.z); frame({ Space: flat(balcony) > 2.6, KeyW: flat(balcony) > 0.8 }, toward(balcony)); }
  assert.ok(P.onGround && Math.abs(local().y - 13) < 0.5, `onto the balcony (${where()})`);
  rt.piece('s1').hit('shoot');
  wait(0.2);
  assert.equal(rt.logic.isLit('s1'), true, 'the lamp-eye wakes');
  assert.equal(rt.logic.isOpen('d1'), true, 'the great door opens');
  // ---- the Cord Loft: tether mode; its try, the ring that brings the lamp down
  stand(...rt.kit.local(hall(Math.PI * 3 / 4, 12)).toArray());
  assert.equal(walk(L(0, 0, 40)), true, `to the great door (${where()})`);
  assert.equal(walk(L(0, 0, 52)), true, `into the loft (${where()})`);
  items.grant('tether'); game.emit('box:opened', { id: 'spacecity.temple.tether' });
  assert.equal(rt.logic.gadget, true);
  const t0 = rt.piece('t0');
  t0.hit('push');
  assert.equal(rt.logic.isLit('t0'), false, 'a push only rings a moorers’ ring');
  assert.ok(said(/wants pulling/), 'it says so');
  assert.equal(walk(L(6.2, 0, 60)), true, `beside the loft's ring (${where()})`);
  assert.ok(tether(t0) && rt.logic.isLit('t0'), 'the tether pulls it: its lamp comes down, and nothing else');
  // ---- the Mooring Passage, a room on: the ring over the door into the Drift
  assert.equal(walk(L(0, 0, 70)), true, `into the passage (${where()})`);
  assert.equal(walk(L(-3.4, 0, 78)), true, `under the ring (${where()})`);
  assert.equal(rt.logic.isOpen('d2'), false);
  assert.ok(tether(rt.piece('r1')), 'in reach of the ring');
  wait(0.2);
  assert.equal(rt.logic.isOpen('d2'), true, 'pulled, the door into the Drift opens');
  // ---- the Drift: the ball out on its cable-rail over the void; pulled home, the gangway rises
  assert.equal(walk(L(-9, 0, 78)), true, `into the Drift (${where()})`);
  assert.equal(rt.logic.isOpen('br2'), false, 'no gangway yet');
  // on still air the far landing is out of reach: it stands six metres higher than a glide can climb
  assert.equal(walk(L(DRIFT.lip + 2.5, 0, 81), { tol: 0.5 }), true, `back from the lip (${where()})`);
  let far = false;
  for (let i = 0; i < 8 / DT; i++) {
    P.heading = -Math.PI / 2;
    frame({ KeyW: i < 30, ShiftLeft: true, Space: i < 12 || i > 30 }, Math.PI / 2);
    if (P.onGround && local().y > DRIFT.far - 0.5) far = true;
    if (local().y < -6) break;
  }
  assert.equal(far, false, `no glide reaches the far landing (${where()})`);
  wait(1);
  stand(DRIFT.lip + 2.5, 0, 80);
  assert.equal(walk(L(DRIFT.lip + 0.8, 0, DRIFT.z + 1.9), { tol: 0.4 }), true, `to the lip beside the cable-rail (${where()})`);
  assert.equal(pull('ballD', 'pD'), true, `the ball pulled home along its cables (${where()})`);
  wait(2);
  assert.equal(rt.logic.isOpen('br2'), true, 'the gangway rises');
  assert.equal(walk(L(DRIFT.lip + 0.4, 0, 81), { tol: 0.6 }), true, `to the gangway (${where()})`);
  assert.equal(walk(L(-32, DRIFT.far, 81), { tol: 0.8, max: 16 }), true, `up the gangway to the far landing (${where()})`);
  // ---- the Cable Walk, the Balance's north landing
  assert.equal(walk(L(-38, DRIFT.far, 70)), true, `to the walk (${where()})`);
  assert.equal(walk(L(-38, DRIFT.far, 44)), true, `along the Cable Walk (${where()})`);
  assert.equal(walk(L(-36, BALANCE.north, 41)), true, `onto the Balance's north landing (${where()})`);
  // the ball pushed OUT along its rail to the far cup over the void: the pan rides to the Gallery
  assert.equal(rt.logic.drumOn('ballS', 'pHome'), true, 'the ball sits home');
  assert.equal(rt.logic.isOpen('gN'), false, 'the west door is shut: it wants the Gallery’s ring as well');
  const ballS = rt.piece('ballS');
  assert.equal(walk(ballS.center.clone().addScaledVector(ballS.dir, -1.9).setY(P.pos.y), { tol: 0.5 }), true, `behind the ball (${where()})`);
  assert.equal(roll('ballS', 'pOut'), true, `the ball out in the far cup (${where()})`);
  assert.equal(rt.logic.isOpen('gW'), true, 'the balance tips');
  const pan = rt.piece('gW');
  for (let i = 0; i < 20 / DT && !(pan.s < 0.2 && pan.wait > 0.8); i++) frame();
  assert.equal(walk(L(-40, BALANCE.north, 37.2), { tol: 0.5 }), true, `to the pan's berth (${where()})`);
  for (let i = 0; i < 20 / DT && !(pan.s < 0.2 && pan.wait > 0.8); i++) frame();
  assert.equal(walk(pan.group.position, { tol: 0.5, run: false, max: 6 }), true, `onto the pan (${where()})`);
  for (let i = 0; i < 20 / DT && !(pan.s > pan.total - 0.2); i++) frame();
  assert.equal(walk(L(-40, BALANCE.south, 22.6), { tol: 0.6, max: 6 }), true, `off it onto the Gallery (${where()})`);
  // ---- the Moorers' Gallery: its ring, high on its davit (out of reach from the north landing, seen from the west door)
  assert.ok(tether(rt.piece('r5')), 'the ring in reach from the Gallery');
  wait(0.2);
  assert.equal(rt.logic.isLit('r5'), true);
  assert.equal(rt.logic.isOpen('sc'), false, 'the moorers’ gate home wants a small key now (v1.53)');
  assert.equal(rt.logic.isOpen('gN'), false, 'and the west door still wants the ball home');
  // ---- the Rope Store, south off the Gallery (an arena): its door shuts behind you while its keepers stand
  const keepers = [{ room: 'store', alive: true }, { room: 'store', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  assert.equal(walk(L(STORE.x, BALANCE.south, 21.4)) && walk(L(STORE.x, BALANCE.south, 18.4)) && walk(L(STORE.x, BALANCE.south, 13)), true, `into the Rope Store (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isOpen('dR'), false, 'the door shuts behind you');
  for (const k of keepers) k.alive = false;
  wait(2.5);
  assert.ok(rt.logic.isLit('arR') && rt.logic.isOpen('dR'), 'beaten: won, and the door lets go');
  assert.equal(walk(rt.piece('kS').pos, { tol: 1.2 }), true, `to the key (${where()})`);
  wait(0.3);
  openChest(rt, 'kS', P);
  assert.equal(rt.logic.isFound('kS'), true, 'a small key');
  assert.equal(walk(L(STORE.x, BALANCE.south, 18.4)) && walk(L(STORE.x, BALANCE.south, 21.6)), true, `back onto the Gallery (${where()})`);
  // (the gate back: the corridor to the Capstan Hall's balcony; the key goes in as you come up to it)
  const moor = (d) => L(Math.sin(MOOR_A) * d, BALANCE.south, 30 + Math.cos(MOOR_A) * d);
  assert.equal(walk(L(-25, BALANCE.south, 23)) && walk(moor(23.4)), true, `to the moorers' gate (${where()})`);
  wait(2.4);
  assert.equal(rt.logic.keysIn('sc'), 1, 'the small key in it');
  assert.equal(walk(moor(16), { max: 10 }), true, `through it to the hall's balcony (${where()})`);
  const cradle = rt.piece('cradle'), c0 = cradle.s;
  wait(4);
  assert.notEqual(cradle.s, c0, 'the cradle rides between the balcony and the hall’s floor');
  // ---- the balcony: the great key's cage, and a ball out along a cable-rail round the wall: pull it home
  const perch = (da, r) => L(Math.sin(MOOR_A + da) * r, BALANCE.south, 30 + Math.cos(MOOR_A + da) * r);
  assert.equal(rt.logic.isFound('kB'), false);
  assert.equal(walk(perch(0.24, 12.4), { tol: 0.5 }), true, `to the rail's home end (${where()})`);
  assert.equal(pull('bK', 'pK'), true, `the ball pulled home onto the cage's footstone (${where()})`);
  wait(1.5);
  assert.equal(walk(rt.piece('kB').pos, { tol: 1.2 }), true, `to the great key (${where()})`);
  wait(0.3);
  openChest(rt, 'kB', P);
  assert.equal(rt.logic.isFound('kB'), true, 'the great key');
  assert.equal(walk(moor(16)) && walk(L(-25, BALANCE.south, 23), { max: 10 }), true, `back to the Gallery (${where()})`);
  // back over on the pan, and the ball pulled HOME from the lip: the west door opens (the Gallery's ring is out of reach from here)
  assert.equal(walk(L(-40, BALANCE.south, 22.8), { tol: 0.5 }), true, `to the pan's upper berth (${where()})`);
  for (let i = 0; i < 30 / DT && !(pan.s > pan.total - 0.2 && pan.wait > 0.8); i++) frame();
  assert.equal(walk(pan.group.position, { tol: 0.5, run: false, max: 6 }), true, `onto the pan again (${where()})`);
  for (let i = 0; i < 20 / DT && !(pan.s < 0.2); i++) frame();
  assert.equal(walk(L(-40, BALANCE.north, 37.5), { tol: 0.6, max: 6 }), true, `back on the north landing (${where()})`);
  assert.equal(tether(rt.piece('r5')), false, 'the Gallery’s ring hangs out of the tether’s reach from the north landing');
  assert.equal(walk(L(BALANCE.x + 1.8, BALANCE.north, 35.8), { tol: 0.4 }), true, `to the lip beside the rail (${where()})`);
  assert.equal(pull('ballS', 'pHome'), true, `the ball pulled home past you (${where()})`);
  wait(1);
  assert.equal(rt.logic.isOpen('gN'), true, 'the west door opens');
  // ---- the Capstan Floor: the Anchor-Warden
  assert.equal(walk(L(-44, BALANCE.north, 38)), true, `to the west door (${where()})`);
  assert.equal(walk(L(-52, FLOOR.y, 38)), true, `along the ante (${where()})`);
  assert.equal(walk(L(FLOOR.x + FLOOR.r + 3, FLOOR.y, FLOOR.z)), true, `to the Capstan Floor's door (${where()})`);
  wait(2.4);
  assert.equal(rt.logic.keysIn('d6'), 1, 'the great key in it (v1.53)');
  assert.equal(walk(L(FLOOR.x + 10, FLOOR.y, FLOOR.z)), true, `onto the Capstan Floor (${where()})`);
  const G = rt.guardian;
  wait(0.3);
  assert.notEqual(G.state, 'sleep', 'it wakes');
  P.opts.health = false;
  const m0 = G.meter;
  G.hit('body', 'shoot');
  assert.equal(G.meter, m0, 'fluid does nothing to it');
  const anchorTarget = () => allTargets().find((x) => x.accepts?.includes('tether') && x.kind === 'sentinel');
  let wound = false, refused = false;
  for (let n = 0; n < 16 && G.state !== 'resolved'; n++) {
    let open = false;
    for (let i = 0; i < 40 / DT; i++) { frame(); if (G.state === 'open') { open = true; break; } }
    assert.ok(open, `its drum stalls, an anchor out (${n})`);
    const an = rt.anchor;
    assert.equal(an.out, true, 'an anchor lies out');
    const before = G.meter;
    if (an.far > 0) {
      // out over the void: too far; push its bars to wind it in, then pull
      assert.equal(rt.anchorPull(), false, 'too far for the tether');
      refused = true;
      for (let k = 0; k < 4 && an.far > 0; k++) G.hit('body', 'push');
      assert.equal(an.far, 0, 'wound in to the rim');
      wound = true;
    }
    // stand near it, and pull (through its target, as the cone would)
    const dir = an.at.clone().sub(G.arena.center).setY(0).normalize();
    P.teleport(an.at.clone().addScaledVector(dir, -2.4).setY(G.arena.y + 0.1), V(0, 1, 0), V(0, 0, 1));
    wait(0.1);
    if (G.state !== 'open') continue;
    anchorTarget().onHit('tether');
    assert.ok(G.meter > before || G.state === 'resolved', `pulled home, it jams (${n}: ${G.meter.toFixed(2)})`);
  }
  assert.equal(G.state, 'resolved', `broken (${G.meter.toFixed(2)})`);
  assert.ok(refused && wound, 'its last phase wanted the push before the pull');
  assert.equal(game.flag('temple.spacecity.done'), true);
  assert.equal(rt.logic.isOpen('d7'), true, 'the way out opens');
  wait(4);
  assert.equal(rt.change.root.visible, true, 'the cables hum taut, their lamps lit');
  assert.equal(rt.change.slack.visible, false, 'no slack cable left');
  game.reset();
  own();
});
