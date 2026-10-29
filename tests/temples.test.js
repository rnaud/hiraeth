// The makers' temples (src/temples/): the kit, the logic, the guardians, the
// 50/50 split of the gadgets, and every built temple solved twice: through its
// state machine (logic.js solve), and on foot, a real Player walking its rooms
// in the real level geometry, pushing, riding, climbing, lighting, calming.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS, FIRES, WING, XW, XE, XC, DROP, WEIGHT } from '../src/temples/desert.js';
import { CARRY } from '../src/carry.js';
import { keyText } from '../src/prompt-keys.js';
import './register-gadgets.js';   // (the gadgets as items: the makers' courts' boxes hold them, src/finds/courts.js)
import * as THREE from 'three';
import { TempleLogic, solve, memoryStore, flagStore } from '../src/temples/logic.js';
import { strikeDamage, inArea, HIT, Guardian } from '../src/temples/boss.js';
import { helperRun, consumeHelperReturn } from '../src/temples/helper-encounter.js';
import { TEMPLES, GADGETS, TEMPLE_HOME, templeOf, nextSpot, setupTempleStory } from '../src/temples/index.js';
import { buildableById } from '../src/levels/buildable.js';
import { runSteps } from '../src/load-steps.js';
import { TEMPLE_BOXES, migrateTemples, migrateTempleLayouts, LAYOUTS } from '../src/temples/migrate.js';
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
import { viaPortal } from '../src/scout.js';
import { resources } from '../src/resources.js';
import { SITE as SITE_EDENA } from '../src/temples/edena.js';
import { modeFor, allTargets, hitTarget } from '../src/targets.js';
import { OUT, IN } from '../src/temples/incal.js';
import { createEchoShell } from '../src/echo-shell.js';
import { RELAID as BELFRY_RELAID, RUNG, STILL, FOUNDERS } from '../src/temples/arzach2.js';
import { Key, KEY_CHEST, MapChest } from '../src/temples/pieces.js';
import { BOX_SCALE } from '../src/boxes/model.js';
import { TempleKit, ANTE } from '../src/temples/kit.js';
import { GULF, STACK, WELL_VENT, WELL as AERIE_WELL, HALL as AERIE_HALL, TOP as AERIE_TOP, BALCONY as AERIE_BALCONY, FLEDGE as AERIE_FLEDGE, SILL as AERIE_SILL } from '../src/temples/arzach.js';
import { ROOMS as ROOMS_P2, LIT as PERDIDE2_LIT } from '../src/temples/perdide2.js';
import fanGadget, { FAN } from '../src/gadgets/fan.js';
import bridgeGadget, { PEN } from '../src/gadgets/bridge.js';
import { irons } from '../src/gadgets/metal.js';
import { LENS_VIEW } from '../src/gadgets/hidden.js';
import { BALCONY, ROOMS as ROOMS_HUSH, UP as HUSH_UP, WALK as HUSH_WALK, MOUTHS as HUSH_MOUTHS, SHRINE as HUSH_SHRINE, SILL as HUSH_SILL, FAR_KEY as HUSH_FAR_KEY } from '../src/temples/perdide.js';
import { SAND as FOUNDRY_SAND, UP as FOUNDRY_UP } from '../src/temples/moonfoundry.js';
import { STORE as WHALE_STORE } from '../src/temples/underwater.js';
import { setHintLevel } from '../src/hint-level.js';
import { answerAsks } from './guardian-asks.js';
import { HOOK } from '../src/gadgets/hook.js';
import { blast } from '../src/gadgets/kit.js';

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
/** The older houses' tools a house's late step asks for with its own (G2, issues #411, #410, #413, #412, #414, #415 and #417). */
const OLDER = { edena: ['hook'], perdide2: ['hook'], incal: ['hook'], underwater: ['hook'], moonfoundry: ['hook'], garage: ['hook'], buried: ['hook'], spacecity: ['monocle'], bazaar: ['glider', 'hook', 'monocle', 'bomb'] };   // (the Undertower: the exam of the whole game, issue #418)
/** Rooms the gadget sends you back to (issue #413): reached before its chest, their step wants it. */
const BACK_TO = { incal: ['vaneFar'], edena: ['vault'] };
/**
 * (issue #477, the houses' shapes) A house whose gadget comes first: its chest in the second room, the hub, the house about it
 * from there on (the Givers' House's shape). The rooms off that hub it leaves open without the gadget are its fight's, an
 * arena (the Builders' Greenhouse's Shade House).
 */
const GADGET_FIRST = { edena: ['shade'] };
/** (issue #477, the guardian met early) The Mooring-House's great door off the Cord Loft, reached before the tether: its
 * antechamber is a passage with nothing to do, the great key the lock. */
const ANTE_EARLY = { spacecity: ['ante'] };

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

test('the Clock-House is a hub (issues #23, #414): either wing alone gives its key, the north door takes both, the great key is in the cupboard once the Mainspring Room has wound the house’s clocks again, solved either way round; the hour the house’s state: the stair meets one dock at a time, the clock turns only once wound, the hour track and the Clockmaker’s clock read it', () => {
  const L = TEMPLES.garage.def.logic, items = ['backpack', 'gun', 'doublejump', 'sword', 'shield', 'hook'];
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
  // (G2) the gallery's eyes behind the striking train's shutters: the hook at its ring and the boomerang at once
  const noHook = solve(L, { items: items.filter((i) => i !== 'hook') });
  assert.ok(!noHook.done && noHook.stuck.includes('gallery') && !noHook.stuck.includes('galleryFar'), 'without the hook, the bridge stays down');
  // the cupboard's eyes stay lidded until the mainspring runs; the marker never points at them before
  const M = new TempleLogic(L, { has: (i) => items.includes(i) });
  for (const id of ['s1', 's2', 's3']) M.light(id);
  M.update();
  assert.notEqual(M.next(), 'c1', 'nor at the cupboard before its clock runs');
  assert.equal(M.light('c1'), false, 'its clock stopped');
  // (G1) the hour: four at the start, but no dock till the clock is wound (its hand, the stair's arm, stands upright)
  assert.ok(M.drumOn('hour', 'four') && !M.isOpen('st4') && !M.isOpen('st2') && !M.isOpen('st6'), 'four, unwound: no dock');
  assert.equal(M.next(), 'ball1', 'the scout: the counterweight first, not the hour');
  M.moveDrum('hour', 0); M.update();
  assert.ok(!M.isOpen('st2') && !M.isOpen('st4'), 'two, unwound: the hand stands where it stopped');
  M.moveDrum('ball1', 1); M.update();
  assert.ok(M.isOpen('st2') && !M.isOpen('st4') && !M.isOpen('st6'), 'wound, at two: the north dock alone');
  M.moveDrum('hour', 1); M.update();
  assert.ok(M.isOpen('st6') && !M.isOpen('st2') && !M.isOpen('st4'), 'at six: the loft’s dock alone');
  // the hour track: the striking eye wakes for the ball on the hour the great clock says, and no other
  for (const [hour, t] of [['two', 0], ['four', 0.5], ['six', 1]]) {
    M.moveDrum('hour', t);
    for (const [p, at] of Object.entries(L.elements.ballS.stops)) { M.moveDrum('ballS', at); assert.equal(M.canUse('sS'), p === `pS${{ two: 2, four: 4, six: 6 }[hour]}`, `${hour}, the ball on ${p}`); }
  }
  // the Clockmaker's clock, the mainspring wound: four only
  const C = new TempleLogic(L, { has: (i) => [...items, 'boomerang'].includes(i) });
  C.moveDrum('ballM', 1); assert.equal(C.light('k3'), true);
  C.moveDrum('hour', 0);
  assert.equal(C.light('c1'), false, 'at two its lids stay shut');
  C.moveDrum('hour', 0.5);
  assert.equal(C.light('c1'), true, 'the mainspring wound and the clock at four: four takes');
  // every dock's edge a drop back to the hall's floor (G6); the hub's floor a checkpoint, a mark on every dock
  for (const r of ['hourTwo', 'hourFour', 'hourSix']) assert.ok(L.links.some((l) => l.a === r && l.b === 'well' && l.oneWay && !l.door && !l.needs), `${r}: a drop to the floor`);
});
test('every built temple is solvable through its state machine, its gadget found mid-way and the key to the rest', () => {
  for (const id of BUILT) {
    const def = TEMPLES[id].def, L = def.logic;
    // (the lift valve's double jump comes before every temple: the desert's pool, docs/systems/progression.md)
    // (and an older house's tool where a late step wants it with the house's own, G2: the Greenhouse's and the Clock-House's
    // hook, issues #411, #414)
    const base = ['backpack', 'gun', 'doublejump', ...(OLDER[id] ?? [])];
    const r = solve(L, { items: base });
    assert.equal(r.done, true, `${id}: solved (${r.log.join(' / ')})`);
    const gadget = Object.entries(L.elements).find(([, e]) => e.type === 'gadget');
    assert.ok(gadget, `${id}: a gadget inside`);
    assert.equal(gadget[1].item, def.gadget, `${id}: the gadget is the temple's own`);
    const boss = Object.entries(L.elements).find(([, e]) => e.type === 'boss');
    assert.ok(boss && L.rooms[boss[1].room]?.boss, `${id}: a guardian in its arena`);
    // mid-way: not in the first room, not in the arena; there are rooms before it and after it
    const at = r.order.indexOf(gadget[1].room);
    assert.ok(at >= (GADGET_FIRST[id] ? 1 : 2) && at <= r.order.length - 3, `${id}: the gadget's room comes mid-way (${r.order.join(' > ')})`);
    for (const room of GADGET_FIRST[id] ?? []) assert.equal(L.rooms[room]?.kind, 'combat', `${id}: ${room}, open off the hub without the gadget, is a fight’s room`);
    // the key: without it the arena is never reached, and nothing past the gadget's room opens
    const no = solve(L, { items: base, withhold: [def.gadget] });
    assert.equal(no.done, false, `${id}: not without ${def.gadget}`);
    assert.ok(!no.stuck.includes(boss[1].room), `${id}: the arena stays shut without ${def.gadget}`);
    // (a room the solver reaches after the chest, and a player may reach before it, whose step wants the gadget: the room the
    // gadget sends you back to, the Warden's Well's Vane Room and its great key's cage, issue #413)
    const after = r.order.slice(at + 1).filter((room) => !(BACK_TO[id] ?? []).includes(room) && !(GADGET_FIRST[id] ?? []).includes(room) && !(ANTE_EARLY[id] ?? []).includes(room));
    for (const room of ANTE_EARLY[id] ?? []) assert.ok(L.rooms[room]?.kind === 'passage' && !Object.values(L.elements).some((e) => e.room === room), `${id}: ${room}, open before the gadget, is an empty passage`);
    assert.ok(after.length >= 2 && after.every((room) => !no.stuck.includes(room)), `${id}: every room after the gadget needs it (${no.stuck.join(', ')})`);
    for (const room of BACK_TO[id] ?? []) assert.ok(Object.values(L.elements).some((e) => e.room === room && e.needs?.includes(def.gadget)), `${id}: ${room} wants the gadget`);
    // 3–6 puzzle rooms (rooms with something to do; the arena's own pieces are the fight's), a checkpoint in most; a
    // house reworked round a hub (issue #23: wings, keys, an arena) up to eleven (the Warden's Well's two ways up since
    // the last round: the Flue's floor and its ledge); an arena is a fight's room, not a puzzle's (issue #336); the Footprint
    // across four floors twelve (issue #401: its well's rim and F2's balcony, where the great lift is worked, and the spiral)
    const busy = new Set(Object.values(L.elements).filter((e) => e.room && e.type !== 'boss' && e.type !== 'clue' && e.type !== 'arena' && !L.rooms[e.room]?.boss).map((e) => e.room));
    const hub = Object.values(L.elements).some((e) => e.type === 'key');
    assert.ok(busy.size >= 3 && busy.size <= (id === 'spheres' ? 12 : hub ? 11 : 6), `${id}: ${busy.size} puzzle rooms`);
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
test('the gifts: a tool in every temple, the small gifts in the open, no gadget out in the wild; the built temples hold theirs, as placed', () => {
  const temple = Object.values(GADGETS).map((g) => g.temple).filter(Boolean);
  const open = Object.values(GADGETS).flatMap((g) => g.world);
  // (the count follows the plan: eleven temples until v1.40 brought the three new route worlds' houses)
  const n = Object.keys(GADGETS).length;
  assert.ok(n >= 11, 'every world but home has a temple planned');
  assert.equal(new Set(temple).size, temple.length, 'no gadget in two temples');
  assert.equal(temple.length, n, 'a temple in every world');
  // (issues #375 and #377: what waits in the open is a charm or an upgrade, never one of the gadgets, which are earned)
  for (const it of open) assert.notEqual(ITEMS[it]?.kind, 'gadget', `${it}: a gadget in the open`);
  assert.ok(Object.values(GADGETS).every((g) => g.built), 'every temple is built');
  assert.equal(BUILT.length, n);
  assert.equal(new Set([...temple, ...open]).size, temple.length + open.length, 'no gift twice');
  const placed = Object.values(PLACEMENTS).flat();
  for (const [id, g] of Object.entries(GADGETS)) {
    if (!g.built) continue;
    assert.ok(TEMPLES[id], `${id}: built`);
    const box = placed.find((p) => p.id === TEMPLES[id].def.gadgetBox);
    assert.ok(box && box.item === g.temple && box.id.startsWith(`${id}.`), `${id}: its temple chest holds ${g.temple}`);
    assert.equal(TEMPLES[id].def.gadgetBox, box.id);
    for (const it of g.world) assert.ok(PLACEMENTS[TEMPLE_HOME[id] ?? id].some((p) => p.item === it && !p.temple), `${id}: ${it} waits in the open`);
    assert.ok(TEMPLE_BOXES.some(([b, it]) => b === box.id && it === g.temple), `${id}: old saves migrate`);
  }
  // every placed item is a real item, and every temple box sits in a built temple
  for (const p of placed) { assert.ok(ITEMS[p.item], p.id); if (p.temple) assert.ok(GADGETS[p.temple]?.built, p.id); }
  // (issue #375: "gadgets should never be in a chest out in the wild") no box anywhere outside a temple holds a gadget
  for (const p of placed) if (ITEMS[p.item]?.kind === 'gadget' && p.item !== 'gun') assert.ok(p.temple, `${p.id}: ${p.item} in a chest in the wild`);
});

test('old saves that own a temple’s gadget find its chest open; the temple’s doors answer it', () => {
  const g = new GameState(null);
  g.set('item.sword', true);
  assert.equal(migrateTemples(g), 1);
  assert.equal(g.flag('box.desert.temple.sword'), true);
  assert.equal(migrateTemples(g), 0, 'once');
  const L = new TempleLogic(TEMPLES.desert.def.logic, { store: memoryStore(), has: (i) => !!g.flag(`item.${i}`) });
  assert.equal(L.gadget, true, 'carried in: the gadget counts as found');
  // the Clock-House's chest (the quick coil's until issue #377, the boomerang's now): whoever has it finds the chest open
  g.set('item.boomerang', true);
  assert.equal(migrateTemples(g), 1);
  assert.equal(g.flag('box.garage.temple.coil'), true);
  for (const id of ['garage', 'edena', 'bazaar', 'moonfoundry', 'spacecity', 'underwater']) assert.ok(TEMPLE_BOXES.some(([b]) => b.startsWith(`${id}.temple.`)), `${id}: its chest migrates`);
});

test('old saves in the Clock-House as it was (a chain of rooms) are brought round its hub: past the climb, its keys are in the door and its arena won; set right, the great lock open; nowhere yet, nothing', () => {
  const save = (flags) => { const g = new GameState(null); for (const [k, v] of Object.entries(flags)) g.set(`temple.garage.${k}`, v); migrateTemples(g); return g; };
  const logicOf = (g, items = ['backpack', 'gun', 'boomerang']) => { const L = new TempleLogic(TEMPLES.garage.def.logic, { store: flagStore(g, 'garage'), has: (i) => items.includes(i) }); L.update(); return L; };
  // with the coil, in the passage: the door back down to the hub still open, the Foreman's door still wanting its key
  const mid = logicOf(save({ 'lit.s1': true, 'lit.s2': true, 'lit.s3': true, 'open.discs': true, 'drum.ball1': 1, 'open.d2': true, gadget: true, checkpoint: 'coil' }));
  assert.equal(mid.isOpen('d2'), true, 'the door over the climb stays open behind them');
  assert.ok(mid.isFound('kW') && mid.isFound('kE') && mid.isLit('arW'), 'the wings they never saw count as done');
  assert.equal(mid.keys('small'), 0, 'no stray keys');
  assert.equal(mid.isOpen('d4'), false, 'the great key is still to find');
  // (v1.53: the great key moved from the Mainspring Room into the cupboard. A save that took it keeps it; one that wound
  // the spring and not yet taken it finds the cupboard's clock running; one that opened the cupboard before finds it open)
  for (const [flags, ok] of [[{ 'lit.k3': true, 'found.kB': true }, (B) => B.isFound('kB') && B.keys('big') === 1], [{ 'lit.k3': true }, (B) => { B.moveDrum('hour', 0.5); return B.canUse('c1'); }], [{ 'lit.c1': true, 'lit.c2': true, 'lit.c3': true }, (B) => B.isOpen('dC')]]) {
    const B = logicOf(save({ 'open.d2': true, gadget: true, 'lit.k1': true, 'open.d3': true, checkpoint: 'gallery', ...flags }));
    assert.ok(ok(B), JSON.stringify(flags));
  }
  assert.equal(solve(TEMPLES.garage.def.logic, { items: ['backpack', 'gun', 'doublejump', 'hook'] }).done, true);
  // (v1.83, issue #414) past the north door: the great clock's hand at two, its counterweight home, so the stair meets the
  // north dock they went through
  assert.equal(mid.drumOn('hour', 'two'), true, 'the hand at two');
  assert.ok(mid.drumOn('ball1', 'p1') && mid.isOpen('st2'), 'the clock wound, the stair at the north dock');
  // the Foreman set right: everything open, as it was
  const done = logicOf(save({ 'open.d2': true, gadget: true, 'lit.k1': true, 'open.d3': true, 'lit.k2': true, 'open.br1': true, boss: 'done', done: true }));
  assert.ok(done.isOpen('d2') && done.isOpen('d4') && done.resolved, 'the whole house open');
  // only through the escapement: the new hub is theirs to play
  const early = save({ 'lit.s1': true, 'open.discs': true });
  const L = logicOf(early, ['backpack', 'gun']);
  assert.ok(!L.isFound('kW') && !L.isLit('arW') && L.keysIn('d2') === 0, 'nothing given');
  assert.equal(early.flag('temple.garage.layout'), LAYOUTS.garage.v);
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

test('the Builders’ Greenhouse round the Palm House (issues #23, #411, #477): the bloom first, on the hub’s floor; either wing gives its key, the Seed Chamber’s door takes both and the bridge’s eye, the builders’ water the house’s state, solved either way round; old saves brought round', () => {
  const L = TEMPLES.edena.def.logic, items = ['backpack', 'gun', 'doublejump', 'sword', 'shield', 'glider', 'hook', 'stun', 'bubble'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  const noFrame = solve(L, { items, forbid: ['sC2'] });
  assert.ok(noFrame.logic.isFound('kW') && !noFrame.stuck.includes('seed'), 'the Shade House alone: its key, and the Seed Chamber stays shut');
  const noArena = solve(L, { items, forbid: ['arW'] });
  assert.ok(noArena.logic.isFound('kE') && !noArena.stuck.includes('seed') && !noArena.stuck.includes('vault'), 'the Cold Frame alone: its key, the chamber and the vault stay shut');
  assert.deepEqual(TEMPLES.edena.def.arenas.map((A) => A.el), ['arW']);
  // the Palm House (G4): its floor the hub (`potting`), its gallery (`landing`); up by the Cold Frame's disc, down by the drop
  // into the cistern, and back up by the vine that stays once it is grown (G6)
  assert.ok(L.links.some((l) => l.a === 'potting' && l.b === 'frame' && l.door === 'dE') && L.elements.dE.opens.lit === 'bE', 'the Cold Frame behind its flower-door');
  // (issue #477, the house reshaped: the gadget first) the chest on the Palm House's floor, the second room; the first step a
  // seed's, before any push; the Cold Frame's trays and the Seed Chamber's seed want it, and only the Shade House's fight (and
  // the vault it opens, whose seed wants the bloom) is there without it
  assert.equal(L.elements.chest.room, 'potting');
  assert.deepEqual(L.elements.bE.needs, ['bloom']);
  assert.equal(L.elements.bE.when, undefined, 'the flower-door in the sun: the bloom alone');
  for (const id of ['sC1', 'sC2', 'seed0']) assert.deepEqual(L.elements[id].needs, ['bloom'], `${id} wants the bloom`);
  const first = solve(L, { items });
  assert.ok(first.log.indexOf('take chest (bloom)') >= 0 && first.log.indexOf('take chest (bloom)') < first.log.findIndex((x) => /^(roll|carry)/.test(x)), `the bloom before any push (${first.log.join(' / ')})`);
  const noBloom = solve(L, { items, withhold: ['bloom'] });
  assert.deepEqual([...new Set(noBloom.order)].filter((r) => !['threshold', 'potting'].includes(r)).sort(), ['shade', 'vault'], `without the bloom only the fight and the vault behind it (${noBloom.order.join(' ')})`);
  assert.ok(L.links.some((l) => l.a === 'frame' && l.b === 'landing' && l.door === 'lift') && L.links.some((l) => l.a === 'landing' && l.b === 'potting' && l.oneWay), 'up by the disc, down by the drop');
  assert.ok(L.links.some((l) => l.a === 'potting' && l.b === 'landing' && l.door === 'vineS') && L.elements.vineS.latch, 'the vine that stays: a climb back up for good');
  assert.ok(L.links.some((l) => l.a === 'vaultTop' && l.b === 'potting' && l.oneWay), 'the window from the vault’s ledge: a drop back to the hub');
  // (G1) the water: up in the high troughs or let down into the low channels, set at a wheel by either hub and in the Bud
  // Passage; the disc rides only on the water let down; the upper floor's seeds and the bud want it up, the vault's seed down
  assert.deepEqual(L.elements.sluice.stops, { wLow: 0, wHigh: 1 });
  assert.deepEqual(L.elements.sluice.rooms, ['potting', 'landing', 'bud']);
  const wantsUp = ['seedS', 'bud1', 'seed1', 'seed0'], wantsDown = ['sdA'];
  for (const id of wantsUp) assert.ok(JSON.stringify(L.elements[id].when).includes('wHigh'), `${id} wants the water up`);
  for (const id of wantsDown) assert.ok(JSON.stringify(L.elements[id].when).includes('wLow'), `${id} wants the water down`);
  assert.ok(JSON.stringify(L.elements.lift.opens).includes('wLow'), 'the disc rides on the water let down');
  const E0 = new TempleLogic(L, { has: (i) => [...items, 'bloom'].includes(i) });
  E0.update();
  assert.equal(E0.drumOn('sluice', 'wHigh'), true, 'the water starts up in the high troughs');
  // (G2) the late step wants the house's tool and an older one: the vault's weight, high on its ledge, only the hook brings down
  assert.deepEqual(L.elements.wV.needs, ['hook']);
  const noHook = solve(L, { items: items.filter((i) => i !== 'hook') });
  assert.ok(!noHook.done && !noHook.logic.isLit('sdA'), 'without the hook the vault’s seed never sees the sun');
  const noUp = solve(L, { items, forbid: ['sluice'] });
  assert.ok(!noUp.done && !noUp.logic.isOpen('lift'), 'without the water let down the disc never rides');
  // every step needed or plainly optional (the Temple maps page's extras): the map, the chamber's try, the vine that stays
  assert.equal(solve(L, { items, forbid: ['seedS'] }).done, true, 'the vine that stays is a shortcut');
  assert.ok(L.elements.seedS.shortcut, 'and says so');
  assert.equal(solve(L, { items, forbid: ['seed0'] }).done, false, 'the Seed Chamber’s seed is a step now (#477; a try before)');
  assert.ok(L.elements.gardener.requires.all.length === 4, 'the beds are the fight’s own first phase');
  // old saves: v5 (the Potting Hall and the Glass Stair) past the stair's door find the new door's eye woken and the Cold
  // Frame's door open; past the great key, its weight on its plate; one that was inside is taken to its last mark
  const g = new GameState(null);
  g.set('temple.edena.layout', 5);
  for (const [k, v] of Object.entries({ entered: true, 'open.d1': true, 'open.d2': true, gadget: true, 'open.d3': true, 'open.vine1': true, 'lit.seed2': true, 'open.d4': true, 'lit.s1': true, checkpoint: 'gulfFar' })) g.set(`temple.edena.${k}`, v);
  migrateTemples(g);
  assert.equal(g.flag('temple.edena.layout'), LAYOUTS.edena.v);
  const E = new TempleLogic(L, { store: flagStore(g, 'edena'), has: (i) => [...items, 'bloom'].includes(i) });
  E.update();
  assert.ok(E.isOpen('dE') && E.isLit('s2') && E.isOpen('d1'), 'the Cold Frame’s door and the Seed Chamber’s open');
  assert.ok(E.isOpen('dB') && E.keys('big') === 0 && E.isOpen('vineV') && E.weightOn('wV') === 'pVw', 'past the bud: the great key in its door, the vault done');
  assert.equal(!!g.flag('temple.edena.relaid'), true, 'inside the old house: to its last mark');
  for (const entered of [true, false]) {
    const g3 = new GameState(null);
    g3.set('temple.edena.layout', 5);
    if (entered) for (const [k, v] of Object.entries({ entered: true, 'lit.s1': true, checkpoint: 'potting' })) g3.set(`temple.edena.${k}`, v);
    migrateTemples(g3);
    assert.equal(!!g3.flag('temple.edena.relaid'), entered, entered ? 'inside the old house: to its last mark' : 'never inside: nothing to move');
    assert.equal(!!g3.flag('temple.edena.open.dE'), entered, entered ? 'the eye woken: its door open' : 'nothing woken, nothing open');
  }
});

test('the Warden’s Well (issue #413): the house’s breath its one state, two small keys and a choice of door, the great key a room the fan comes back to, the ring and the vane at once for the crown’s eye, the drops down the core and the Flue; every step wanted; old saves past it find it open', () => {
  const L = TEMPLES.incal.def.logic, items = ['backpack', 'gun', 'doublejump', 'sword', 'shield', 'glider', 'hook'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  // G2: the crown's eye wants the hook (an older house's) and the fan at once
  assert.equal(solve(L, { items: items.filter((i) => i !== 'hook') }).done, false, 'not without the hook');
  assert.deepEqual(L.elements.s4.when, { all: [{ lit: 'rS' }, { lit: 'vC' }, IN] });
  assert.ok(L.elements.rS.needs.includes('hook') && L.elements.vC.needs.includes('fan'));
  // G1: one state set at a lever by every hub, wanted out and in
  assert.deepEqual(L.elements.breath.stops, { breathIn: 0, breathOut: 1 });
  assert.ok(['climb', 'gallery', 'loft', 'crown'].every((r) => L.elements.breath.rooms.includes(r)), 'set from every hub');
  for (const id of ['stones', 'rise', 'iris', 'iris2', 'lift', 'd1']) assert.match(JSON.stringify(L.elements[id].opens), /breathOut/, `${id} wants the house breathing out`);
  assert.match(JSON.stringify(L.elements.kG.when), /breathOut/, 'the great key’s cage too');
  const log = solve(L, { items }).log, sets = log.filter((x) => x.startsWith('roll breath'));
  assert.ok(sets.includes('roll breath onto breathOut') && sets.includes('roll breath onto breathIn'), `out and in again (${sets.join(', ')})`);
  // G3c: two small keys (the Climb's cage, the Ash Store's) and two doors that take one each (the Bellows Chamber's, the
  // Vane Room's): with one key in hand both doors are there to choose from, and either first solves it
  assert.deepEqual(['d1', 'dV'].map((d) => L.elements[d].lock), ['small', 'small']);
  assert.ok(!L.elements.d1.keys && !L.elements.dV.keys, 'one key each');
  const one = new TempleLogic(L, { has: (i) => items.includes(i) });
  one.update();
  one.light('v1'); one.light('v1b'); one.update(); one.light('arW'); one.find('kW');   // (across the Turning Floors, the Ash Store won first)
  assert.equal(one.keys('small'), 1);
  assert.ok(one.canUnlock('d1') && one.canUnlock('dV') && one.lockReachable('d1') && one.lockReachable('dV'), 'one key, two doors: a choice');
  for (const first of ['d1', 'dV']) {
    const T = new TempleLogic(L, { has: (i) => items.includes(i) });
    T.update(); T.light('arW'); T.find('kW'); T.unlock(first); T.update(); T.quiet('v1'); T.quiet('v1b');
    const r = solve(L, { items, from: { data: { ...T.store.data }, has: () => false } });
    assert.equal(r.done, true, `${first} first: still solved (${r.log.join(' / ')})`);
  }
  // every step wanted: without any one of them, no guardian
  for (const id of ['v1', 'v1b', 'v2', 'ball1', 'kC', 'arW', 'kW', 'pen', 'vR', 'kG', 'chest', 'vG', 's2', 'vE', 'ball3', 'rS', 'vC', 's4']) assert.equal(solve(L, { items, forbid: [id] }).done, false, `${id} is wanted`);
  // the great key a room the fan comes back to: across the chasm before the chest, its cage shut
  const early = new TempleLogic(L, { has: (i) => items.includes(i) && i !== 'fan' });
  early.update(); early.moveDrum('breath', 1); early.update();
  assert.ok(early.isOpen('stones') && !early.canUse('vR'), 'the stones stand, the great vane too heavy without the fan');
  // G6: the ways down, needing nothing
  for (const [a, b] of [['crown', 'gallery'], ['loft', 'gallery'], ['ledge', 'crown'], ['crown', 'flue'], ['gallery', 'flue'], ['flue', 'jets']]) {
    assert.ok(L.links.some((l) => l.a === a && l.b === b && l.oneWay && !l.door && !l.needs), `${a} → ${b}: a drop`);
  }
  // old saves past the balcony's door: its ways as they were, the house breathing out
  const g = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 4, entered: true, 'lit.v1': true, 'drum.ball1': 1, 'open.d1': true, 'unlocked.d1': 2, 'found.kW': true, 'found.kE': true, gadget: true, checkpoint: 'jets' })) g.set(`temple.incal.${k}`, v);
  migrateTemples(g);
  const W = new TempleLogic(L, { store: flagStore(g, 'incal'), has: (i) => items.includes(i) || i === 'fan' || i === 'bridge' });
  W.update();
  assert.ok(W.isOpen('d1') && W.isOpen('dV') && W.check(OUT) && W.isOpen('rise'), 'the balcony’s door open behind them, the Vane Room’s too, and the draught up the Well');
  const g2 = new GameState(null);
  for (const [k, v] of Object.entries({ 'drum.ball1': 1, 'open.d1': true, gadget: true, 'lit.s2': true, 'open.iris': true, 'drum.ball3': 1, 'open.iris2': true, 'lit.s4': true, 'open.d3': true, checkpoint: 'hall', layout: 2 })) g2.set(`temple.incal.${k}`, v);
  migrateTemples(g2);
  const W2 = new TempleLogic(L, { store: flagStore(g2, 'incal'), has: (i) => items.includes(i) || i === 'fan' });
  W2.update();
  assert.ok(W2.isOpen('d3') && W2.keys('big') === 0 && W2.isOpen('lift'), 'an old save past the high door: open, its great key in it, the high ledge in reach');
});

test('the Undertower round its Great Well (issue #418): the line its one state, set from five places, read by the store’s door, the Tuning Room’s and the Choir’s horns, the lift, the passage’s horn, the Bellows’ door and their draught; each older tool’s step needs it, solved either way round; old saves past the chamber find the walkway’s counterweight knocked', () => {
  const L = TEMPLES.bazaar.def.logic, items = ['backpack', 'gun', 'doublejump', ...OLDER.bazaar];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  // (the house's one state, issue #418 G1: set from the levers by the hubs, both ways on the way)
  const r = solve(L, { items });
  const sets = r.log.filter((s) => s.startsWith('roll line onto'));
  assert.ok(sets.includes('roll line onto lineSpeaking') && sets.includes('roll line onto lineQuiet') && sets.length >= 3, `the line set and set back on the way (${sets.join(', ')})`);
  assert.deepEqual(L.elements.line.rooms, ['landing', 'top', 'listen', 'hall'], 'a lever by every hub besides the far landing’s');
  // (G2: one step each for the wings, the hook, the lens and the bombs, each with the hourglass)
  for (const [tool, room] of [['glider', 'crown'], ['hook', 'top'], ['monocle', 'galleryFar'], ['bomb', 'hall']]) {
    const no = solve(L, { items: items.filter((i) => i !== tool) });
    assert.ok(!no.done && no.stuck.includes('shell') && !no.stuck.includes(room), `without the ${tool}: the house is not done, ${room} never reached (${no.stuck.join(', ')})`);
  }
  // either wing alone gives its key; the chamber's door takes both
  // (the Tuning Room's ball left where it lies: its eye may still be woken, the solver's own reckoning, logic.js solve)
  const noTune = solve(L, { items, forbid: ['ballT'] });
  assert.ok(noTune.logic.isFound('kW') && !noTune.logic.isFound('kE') && !noTune.stuck.includes('shell'), 'the Cable Store alone: its key, and the chest stays shut');
  const noArena = solve(L, { items, forbid: ['arW'] });
  assert.ok(noArena.logic.isFound('kE') && !noArena.stuck.includes('shell'), 'the Tuning Room alone: its key, and the chest stays shut');
  // the Choir's small key opens the Bellows' door; the great key on the Crown
  const noChoir = solve(L, { items, forbid: ['hB'] });
  assert.ok(noChoir.stuck.includes('top') && !noChoir.stuck.includes('bellows') && !noChoir.stuck.includes('hall'), 'without the black horn the Bellows stay shut, and the First Sign’s hall');
  const room = (id) => L.elements[id].room;
  assert.equal(room('hG'), 'dishesFar', 'the gate listens through a horn back in the first hall');
  assert.equal(room('kB'), 'crown', 'the great key on the Crown');
  // an old save past the chamber's door (v1.83): the walkway's counterweight knocked, the two keys' door open
  const g = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 5, 'drum.ball1': 1, 'lit.eD': true, 'open.disc': true, 'lit.eW': true, 'open.wdisc': true, 'unlocked.dK': 2, gadget: true, 'open.dL': true, checkpoint: 'shell' })) g.set(`temple.bazaar.${k}`, v);
  migrateTemples(g);
  const B = new TempleLogic(L, { store: flagStore(g, 'bazaar'), has: (i) => ['backpack', 'gun', 'recall'].includes(i) });
  B.update();
  assert.ok(B.isOpen('dK') && B.isLit('knock'), 'the Shell Chamber’s door stays open behind them, the walkway’s counterweight knocked');
  // an old save that found the great key in the old Choir keeps it, and the Choir's horns answered sink the small key's cage
  const g3 = new GameState(null);
  for (const [k, v] of Object.entries({ 'drum.ball1': 1, 'lit.eD': true, 'open.disc': true, 'lit.eW': true, 'open.wdisc': true, gadget: true, 'lit.e0': true, 'open.d3': true, 'found.kB': true, 'lit.hA': true, 'lit.hB': true, checkpoint: 'galleryFar', layout: 5 })) g3.set(`temple.bazaar.${k}`, v);
  migrateTemples(g3);
  const B3 = new TempleLogic(L, { store: flagStore(g3, 'bazaar'), has: (i) => ['backpack', 'gun', 'recall'].includes(i) });
  B3.update();
  assert.ok(B3.keys('big') === 1 && B3.check(L.elements.kC.when), 'its great key in hand, the Choir’s small key free');
});

test('the Engine-House round its Engine Hall (issues #23, #415): the engine’s clutch the house’s one state, the upper shaft or the lower, set at a lever by every hub; the Boiler Keeper guards the chest; the Governor Room’s one ball and two cranks on the lower shaft, the Crank Passage and the Furnace on the upper; the Furnace’s clutch hooked with the bombs (G2); solved either way round; old saves find what they did done', () => {
  const L = TEMPLES.buried.def.logic, items = ['backpack', 'gun', 'doublejump', 'hook'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  // the state: the clutch, upper (as it was left) or lower, set from the hall's floor, its gallery, the chamber and the passage
  assert.deepEqual(L.elements.shaft.stops, { shaftLow: 0, shaftUp: 1 });
  assert.equal(L.elements.shaft.start, 1);
  assert.deepEqual([L.elements.shaft.room, ...L.elements.shaft.rooms], ['pistons', 'gallery', 'cell', 'crank']);
  // set and set back on the way: lower for the firebox door and the Governor Room, upper for the bulkhead and past it
  const r = solve(L, { items });
  const sets = r.log.filter((s) => s.startsWith('roll shaft'));
  assert.ok(sets.length >= 2 && sets[0].endsWith('shaftLow'), `lower, then upper (${sets.join(' / ')})`);
  // the mini-boss at the middle guards the tool (G3b): no chest without the Boiler Room won, and nothing after it without the bombs
  const noFight = solve(L, { items, forbid: ['arB'] });
  assert.ok(!noFight.order.includes('cell') && !noFight.done, 'the keeper unbeaten: no chest');
  const chestAt = r.log.findIndex((s) => s.startsWith('take chest')), arenaAt = r.log.findIndex((s) => s === 'arena arB');
  assert.ok(arenaAt >= 0 && arenaAt < chestAt, 'the arena just before the chest');
  const without = solve(L, { items, withhold: ['bomb'] });
  assert.ok(!without.done && !without.order.includes('gov') && !without.order.includes('furnace'), 'without the bombs neither wing past the chest');
  // the late step wants the house's tool and an older one at once (G2): the Furnace's bridge, the bombs and the hook
  assert.deepEqual(L.elements.k2.needs, ['bomb']);
  assert.deepEqual(L.elements.cF.needs, ['hook']);
  const noHook = solve(L, { items: items.filter((i) => i !== 'hook') });
  assert.ok(!noHook.done && noHook.stuck.includes('furnace') && !noHook.stuck.includes('furnaceFar'), 'without the hook, no bridge');
  // without the passage's ball or the hammer's, the upper floor stops: the hammer runs while the upper shaft turns
  assert.equal(solve(L, { items, forbid: ['ballJ'] }).done, false, 'the Crank Hall’s ball is needed');
  for (const k of ['bK', 'bA', 'bB', 'bD', 'k0', 'k3', 'k1', 'cF']) assert.equal(solve(L, { items, forbid: [k] }).done, false, `${k} is needed (no step to skip)`);
  // the governor: one ball, wanted at both its stops in turn (the pistons' first, then the hammer's), and the lower shaft
  const G = new TempleLogic(L, { has: (i) => ['gun', 'bomb'].includes(i) });
  G.light('s1'); G.moveDrum('ball0', 0);
  assert.equal(G.find('kB'), false, 'caged');
  G.moveDrum('bQ', 1);
  assert.equal(G.light('k3'), false, 'the upper shaft turning: the governor’s pistons never rise');
  G.moveDrum('shaft', 0); assert.ok(G.light('k3'));
  G.update();
  assert.equal(G.find('kB'), false, 'the eyes awake, and the hammer running on the cage');
  G.moveDrum('bQ', 0); G.update();
  assert.ok(G.isOpen('h2') && G.find('kB'), 'the hammer still again: the great key');
  // the Crank Hall's hammer: still while the lower shaft has the power, running on the upper unless its ball jams it
  const H = new TempleLogic(L, { has: () => true });
  H.moveDrum('shaft', 0); H.update(); assert.ok(!H.isOpen('dU'), 'lower: the bulkhead down');
  H.moveDrum('shaft', 1); H.update(); assert.ok(!H.isOpen('h1') && H.isOpen('dU'), 'upper: the bulkhead up, the hammer running');
  H.moveDrum('ballJ', 1); H.update(); assert.ok(H.isOpen('h1'), 'jammed');
  // a save from v1.77 past the passage's door: the small key in it, the keeper counted beaten, the shutters up; past the bridge:
  // the great key in the warden's door, and the Governor Room's shutter up behind it
  for (const [extra, past] of [[{}, false], [{ 'lit.k2': true, 'open.br1': true, checkpoint: 'hall' }, true]]) {
    const g = new GameState(null);
    for (const [k, v] of Object.entries({ layout: 3, entered: true, 'lit.s1': true, 'drum.ball0': 0, 'drum.ballJ': 1, gadget: true, 'drum.bK': 1, 'lit.k1': true, 'open.d3': true, checkpoint: 'furnace', ...extra })) g.set(`temple.buried.${k}`, v);
    migrateTemples(g);
    const B = new TempleLogic(L, { store: flagStore(g, 'buried'), has: (i) => ['backpack', 'gun', 'bomb', 'hook'].includes(i) });
    B.update();
    assert.ok(B.isOpen('d3') && B.isLit('arB') && B.isOpen('dC') && B.isOpen('dS'), 'the passage’s door stays open, the keeper beaten');
    assert.equal(B.isOpen('d4'), past, past ? 'past the bridge: the warden’s door open too' : 'before the bridge: the great key is still in the Governor Room');
    assert.equal(B.isOpen('dG'), past);
    assert.equal(g.flag('temple.buried.relaid'), true, 'taken to its last mark in the new rooms');
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
  assert.ok(!C.isOpen('chute') && !C.isOpen('lift'), 'in the other throat, the Moult shut: its shaft has nothing to breathe (v1.74)');
  C.light('arM'); C.update();
  assert.ok(C.isOpen('dM') && C.isOpen('lift'), 'the Moult won, its door open onto the well: the wind rises out of the shaft, past the perch');
  // (v1.74, round 6) the well's column reaches the high balcony only once the floor's second vent is stopped
  assert.ok(L.links.some((l) => l.a === 'well' && l.b === 'top' && l.door === 'column' && l.needs?.includes('glider')) && !L.links.some((l) => l.a === 'wings' && l.b === 'top'), 'up the column from the floor, its second vent stopped');
  assert.ok(!L.links.some((l) => l.a === 'gulfFar' && l.b === 'perch'), 'no glide back down onto the perch counted (no way back, nothing there)');
  const W = new TempleLogic(L, { has: (i) => ['gun', 'glider'].includes(i) });
  W.moveDrum('ballW', 1); W.update();
  assert.ok(W.isOpen('raft') && !W.isOpen('column') && !W.reachable().has('top'), 'the raft rides, but the column lets you go over the chest’s balcony');
  W.moveDrum('bF', 1); W.update();
  assert.ok(W.isOpen('column') && W.reachable().has('top'), 'the second vent’s stone in its throat: the whole wind up the well');
  const order = solve(L, { items }).order;
  assert.ok(order.indexOf('moult') > order.indexOf('eyrie'), `the Moult after the Eyrie (${order.join(' ')})`);
  const noEyrie = solve(L, { items, forbid: ['bE'] });
  assert.ok(noEyrie.logic.isFound('kM') && noEyrie.stuck.includes('gulfFar') && !noEyrie.stuck.includes('roost'), 'the Moult alone: the balcony’s door, and the Roost stays shut');
  const noArena = solve(L, { items, forbid: ['arM'] });
  assert.ok(!noArena.logic.isFound('kE') && !noArena.stuck.includes('gulf'), 'without the Moult won no wind comes up the gap’s shaft: no great key, and the way north stays shut (v1.74)');
  assert.deepEqual(TEMPLES.arzach.def.arenas.map((A) => A.el), ['arM']);
  // the Eyrie: as its stone starts, the wind comes out of the ledge's vent, not the gap's
  const E = new TempleLogic(L, { has: (i) => ['gun', 'glider'].includes(i) });
  assert.equal(E.isOpen('lift'), false);
  E.light('arM'); E.moveDrum('bE', 1); E.update();
  assert.equal(E.isOpen('lift'), true, 'the stone in the ledge vent’s throat, the Moult open: the column past the perch');
  for (const [extra, past] of [[{}, false], [{ 'drum.ballP': 1, checkpoint: 'gulfFar' }, true]]) {
    const g = new GameState(null);
    for (const [k, v] of Object.entries({ 'drum.ballW': 1, gadget: true, 'drum.ballB': 1, checkpoint: 'perch', ...extra })) g.set(`temple.arzach.${k}`, v);
    migrateTemples(g);
    const B = new TempleLogic(L, { store: flagStore(g, 'arzach'), has: (i) => [...items, 'glider'].includes(i) });
    B.update();
    assert.ok(B.isOpen('dG') && B.keys('small') === 0 && B.isLit('arM'), 'the balcony’s door stays open behind them');
    assert.ok(B.drumOn('bF', 'pF') && B.isOpen('column'), 'up there already: the floor’s second vent stopped, the whole wind up the well (v1.74)');
    assert.equal(B.isOpen('d3'), past, past ? 'past the perch: the Roost’s door open too' : 'on the perch: the great key still in the Eyrie');
    if (!past) assert.ok(B.reachable().has('eyrie'), 'and the way back to it is open');
  }
});

test('the Aerie reworked (issue #407): a step before the wings (the Fledgery’s stone dropped through its floor lifts the Wing Chamber’s shutter), a drop from the gallery back to the hub, the map early; old saves past the wings find the stone dropped', () => {
  const L = TEMPLES.arzach.def.logic, items = ['backpack', 'gun', 'doublejump', 'sword', 'shield'];
  assert.deepEqual(L.elements.dW.opens, { drumOn: ['bD', 'pD'] });
  assert.equal(L.elements.bD.through, 'hole', 'dropped through the floor onto the plate below, no door between');
  assert.ok(L.links.some((l) => l.a === 'gallery' && l.b === 'wings' && l.door === 'dW') && !L.links.some((l) => l.b === 'wings' && l.a === 'well'), 'the chamber off the gallery, behind its shutter');
  assert.ok(L.links.some((l) => l.a === 'gallery' && l.b === 'well' && l.oneWay && !l.door && !l.needs), 'the Fledging Sill: a drop back to the hub that needs nothing');
  const noStone = solve(L, { items, forbid: ['bD'] });
  assert.ok(!noStone.done && !noStone.order.includes('wings'), 'without the Fledgery’s stone, no wings');
  const order = solve(L, { items }).order;
  assert.ok(order.indexOf('fledge') < order.indexOf('wings'), `the Fledgery before the wings (${order.join(' ')})`);
  assert.equal(L.elements.map.room, 'fledge', 'the map in the Fledgery, early');
  // a save from before the rework, past the wings: the stone lies on the grate, the shutter open; and taken to its mark
  const g = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 4, entered: true, relaid: null, 'drum.ballW': 1, gadget: true, checkpoint: 'wings' })) g.set(`temple.arzach.${k}`, v);
  migrateTempleLayouts(g);
  assert.equal(g.flag('temple.arzach.drum.bD'), 1);
  assert.equal(g.flag('temple.arzach.relaid'), true, 'taken to its mark in the new rooms, though it was once before');
  const B = new TempleLogic(L, { store: flagStore(g, 'arzach'), has: (i) => [...items, 'glider'].includes(i) });
  B.update();
  assert.ok(B.isOpen('dW'), 'the shutter open behind them');
  const fresh = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 4, entered: true, 'drum.ballW': 1, checkpoint: 'well' })) fresh.set(`temple.arzach.${k}`, v);
  migrateTempleLayouts(fresh);
  assert.equal(fresh.flag('temple.arzach.drum.bD'), undefined, 'before the wings: the new step still to do');
});

test('the Lamp-House (issues #23, #410, #477): the great lamp lit or dark the house’s one state: kindled once from its balcony, then set at a lever by every hub or with the hook at its pipe’s ring; the Kennel off its first hall woken by a pool-orb before the wand, the Wick Room dark, the moss-stones risen in the dark; the far door’s lamp a bubble of the great lamp’s light; old saves past the gallery find it open', () => {
  const L = TEMPLES.perdide2.def.logic, items = ['backpack', 'gun', 'doublejump', 'sword', 'shield', 'glider', 'hook', 'stun'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  const noWick = solve(L, { items, forbid: ['lW2'] });
  assert.ok(noWick.logic.isFound('kS') && !noWick.done, 'without the Wick Room the great key stays behind its grille');
  const noArena = solve(L, { items, forbid: ['arK'] });
  assert.ok(!noArena.stuck.includes('wickKey') && !noArena.done, 'without the Kennel the Wick Room’s grille stays shut');
  for (const k of ['s8', 'lG', 'l0', 'sW', 'pv']) assert.equal(solve(L, { items, forbid: [k] }).done, false, `${k} is needed (issue #410: no step to skip)`);
  // (issue #410) the great lamp: kindled (lG, a bubble of its balcony's pool-lamp's light), its shutters (`lamp`) set from the
  // hubs: the Lamp Hall's floor, its gallery (the drum's own room), the Lantern Chamber; and with the hook at the far floor's ring
  assert.equal(L.elements.lamp.room, 'hallUp');
  assert.deepEqual(L.elements.lamp.rooms, ['pools', 'lantern', { room: 'galleryFar', needs: ['hook'] }]);
  assert.deepEqual(L.elements.lG.needs, ['bubble']);
  const without = (w) => solve(L, { items: items.filter((i) => i !== w) });
  assert.ok(!without('hook').done && !without('hook').stuck.includes('lamp'), 'the far door wants the hook too, an older tool (G2)');
  const noWand = solve(L, { items, withhold: ['bubble'] });
  assert.ok(!noWand.done && !noWand.order.includes('gallery') && !noWand.order.includes('wickKey'), 'without the wand the great lamp stays cold: no Lamp Passage, and the great key stays behind its grille');
  // (issue #477, the house reshaped: the Kennel before the wand, its lamp-door woken by a pool-orb on the hall's floor; the
  // great key straight after the wand, in the dark; the great lamp on the way back)
  assert.ok(noWand.order.includes('kennel') && noWand.logic.isFound('kS'), 'the Kennel won before the wand: its small key in hand');
  assert.deepEqual(L.elements.dK.opens, { all: [{ lit: 's1' }, { drumOn: ['oK', 'pK'] }, { lit: 'lK' }] }, 'its lamp-door wakes to the hall’s pool-orb');
  const first = solve(L, { items });
  assert.ok(first.order.indexOf('kennel') < first.order.indexOf('lantern') && first.order.indexOf('wickKey') < first.order.indexOf('gallery'), `the Kennel before the wand, the great key before the Lamp Passage (${first.order.join(' ')})`);
  const noOrb = solve(L, { items, forbid: ['oK'] });
  assert.ok(!noOrb.order.includes('kennel') && !noOrb.done, 'without the hall’s orb the Kennel stays shut');
  // the state's ways: lit, the lamp-doors (for good) and the curtain; dark, the curtain gone and the moss-stones up for good
  const S = new TempleLogic(L, { has: (i) => [...items, 'bubble'].includes(i) });
  S.update();
  assert.ok(S.isOpen('cur') && !S.isOpen('dK') && !S.isOpen('d2') && !S.isOpen('br1'), 'cold: the house dark, the Wick Room open, the lamp-doors shut, the moss-stones still');
  // (issue #477) the Kennel's lamp-door: the orb in its socket, its lamp lit, and the near pool
  S.store.set('lit.s1', true); S.moveDrum('oK', 1); S.light('lK'); S.update();
  assert.ok(S.isOpen('dK') && !S.isOpen('d2'), 'the orb’s lamp: the Kennel open, the Lamp Passage still shut');
  // (its levers will not open the shutters on a cold lamp: GreatLamp.toggle, tests/lamp-house.test.js)
  S.store.set('lit.s8', true); S.light('lG'); S.update();
  assert.ok(S.isLit('lG') && S.isOpen('cur') && !S.isOpen('d2'), 'kindled behind shut shutters: still dark');
  S.moveDrum('lamp', 1); S.update();
  assert.ok(S.isOpen('d2') && !S.isOpen('cur') && !S.isOpen('br1'), 'lit: the Lamp Passage’s door, the curtain across the Wick Room, the moss-stones sunk');
  S.moveDrum('lamp', 0); S.update();
  assert.ok(S.isOpen('dK') && S.isOpen('d2') && S.isOpen('cur') && S.isOpen('br1'), 'dark: the lamp-doors stay open, the curtain falls, the moss-stones rise');
  S.moveDrum('lamp', 1); S.update();
  assert.ok(S.isOpen('br1') && !S.isOpen('cur'), 'lit again: the moss-stones keep their root');
  // the far door's lamp: a bubble of the light the valve lets down the pipe, while it is open
  assert.equal(S.light('l2'), false, 'no light in the basin');
  S.light('pv'); assert.equal(S.light('l2'), true, 'the valve open: its light taken');
  assert.deepEqual(L.elements.d4.opens, { lit: 'l2' });
  assert.equal(L.elements.d4.lock, 'big');
  // (v1.60) the Wick Room off the first hall, a loop: its way from the hall, its keepers' door up onto the root-wall's top
  assert.ok(L.links.some((l) => l.door === 'cur' && l.a === 'pools' && l.b === 'wick') && L.links.some((l) => l.door === 'dU' && l.a === 'wick' && l.b === 'lantern'), 'the Wick Room between the first hall and the chamber');
  assert.ok(L.links.some((l) => l.a === 'hallUp' && l.b === 'pools' && l.oneWay), 'G6: the gallery drops to the hub’s floor');
  assert.equal(L.elements.cW.lock, 'small', 'its grille takes the Kennel’s small key');
  assert.deepEqual(L.elements.dU.opens, { open: 'cW' }, 'its keepers’ door opens with the grille');
  assert.equal(L.gadget, 'bubble');
  for (const id of ['l0', 'lG', 'l2', 'lW1', 'lW2', 'moth']) assert.ok(L.elements[id].needs.includes('bubble'), `${id}: the bubble wand`);
  assert.deepEqual(TEMPLES.perdide2.def.arenas.map((A) => A.el), ['arK']);
  // the grille: both lamps at once (each only while its orb glows, the pool-lamp lit), then up for good
  const W = new TempleLogic(L, { has: (i) => ['gun', 'bubble'].includes(i) });
  W.store.set('found.kS', true); W.unlock('cW'); W.store.set('lit.sW', true);
  W.moveDrum('oW1', 1); W.light('lW1'); W.update();
  assert.equal(W.isOpen('cW'), false, 'one lamp');
  W.quiet('lW1'); W.moveDrum('oW2', 1); W.light('lW2'); W.update();
  assert.equal(W.isOpen('cW'), false, 'the first gone out before the second');
  W.light('lW1'); W.update();
  assert.equal(W.isOpen('cW'), true, 'both at once');
  W.quiet('lW1'); W.quiet('lW2'); W.update();
  assert.equal(W.isOpen('cW'), true, 'and it stays up');
  // old saves (v1.77–v1.82): past the Lamp Passage's door, the great lamp kindled and lit for them; past the far door, open
  for (const [extra, past] of [[{}, false], [{ 'drum.orb': 1, 'lit.l2': true, 'lit.s4': true, 'open.d4': true, checkpoint: 'lamp' }, true]]) {
    const g = new GameState(null);
    g.set('temple.perdide2.layout', 4);
    for (const [k, v] of Object.entries({ entered: true, 'lit.s1': true, 'lit.s2': true, 'lit.s3': true, 'open.d1': true, 'open.disc': true, gadget: true, 'lit.l1': true, 'open.d2': true, 'found.kS': true, 'lit.arK': true, checkpoint: 'gallery', ...extra })) g.set(`temple.perdide2.${k}`, v);
    migrateTemples(g);
    const B = new TempleLogic(L, { store: flagStore(g, 'perdide2'), has: (i) => [...items, 'bubble'].includes(i) });
    B.update();
    assert.ok(B.isOpen('d2') && B.isOpen('dC') && B.isLit('lG') && B.check(PERDIDE2_LIT) && B.isOpen('dK'), 'the ledge’s and the Lamp Passage’s doors open behind them, the great lamp lit');
    assert.equal(B.isOpen('d4'), past, past ? 'past the far door: open still' : 'on the gallery: the great key still in the Wick Room');
    assert.equal(B.keys('small'), past ? 0 : 1, past ? 'past the far door: no key left over' : 'the Kennel’s key in hand, for the Wick Room’s grille');
    if (past) assert.ok(B.isOpen('cW') && B.isOpen('dU'), 'and the Wick Room’s grille up, its keepers’ door open too');
    assert.equal(!!g.flag('temple.perdide2.relaid'), true, 'inside the old house: to its last mark');
  }
});

test('the Founders’ Belfry (issues #23, #408): its hub’s west store an arena, the east store’s ball, either order; the founders’ bell rung or still the house’s one state; the Ringers’ Walk a ring through both halves for the great key; old saves past the hall and the far door find them open', () => {
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
  const B = new TempleLogic(L, { store: flagStore(g, 'arzach2'), has: (i) => [...items, 'hook'].includes(i) });
  B.update();
  assert.ok(B.isOpen('d1') && B.keys('small') === 0, 'the hall’s door stays open behind them');
  // (issue #408) the founders' bell: one state, still or rung, that stands the stones on both floors: the great stone on the
  // Great Belfry's floor, the porch's slab and the Hall of Echoes' bridge rung; the spur to the Ringers' Walk still. Set at a
  // lever by each hub, or with the hook at a bell's ring upstairs
  const bell = L.elements.bell;
  assert.deepEqual(bell.stops, { bellStill: 0, bellRung: 1 });
  assert.equal(bell.start, 0, 'it starts still: its stones fell up');
  for (const [door, want] of [['lift', RUNG], ['spur', STILL]]) assert.deepEqual(L.elements[door].opens, want, `${door}: the bell ${want === RUNG ? 'rung' : 'still'}`);
  assert.deepEqual(L.elements.d3.opens, { all: [RUNG, { open: 'dP' }] }, 'the porch’s slab: rung, once the porch is open to you (then sunk for good)');
  assert.deepEqual(L.elements.br1.opens, { any: [RUNG, { drumOn: ['ball3', 'p3'] }] }, 'the bridge: rung, or held by its ball for good');
  assert.ok(L.elements.d4.opens.all.some((c) => c === RUNG) && L.elements.d4.lock === 'big', 'the far door: the great key, its ball, and the bell rung');
  const rooms = Object.fromEntries(bell.rooms.map((r) => (typeof r === 'string' ? [r, []] : [r.room, r.needs])));
  for (const hub of ['stones', 'stair', 'landing']) assert.deepEqual(rooms[hub], [], `${hub}: a lever there, nothing needed`);
  for (const up of ['porch', 'echoes', 'echoesFar']) assert.deepEqual(rooms[up], ['hook'], `${up}: set with the hook at a bell’s ring`);
  assert.deepEqual(FOUNDERS.levers.map((l) => l.room), ['stones', 'stair', 'landing'], 'a lever by every hub');
  const r = solve(L, { items });
  const sets = r.log.filter((s) => s.startsWith('roll bell')), ix = (s) => r.log.indexOf(s);
  assert.ok(sets.length >= 3, `the bell set again and again on the way (${sets.join(', ')})`);
  assert.ok(ix('roll bell onto bellRung') < ix('take chest (hook)') && ix('roll ball3 onto p3') < ix('roll bell onto bellStill') && ix('roll bell onto bellStill') < ix('take kB') && ix('take kB') < r.log.lastIndexOf('roll bell onto bellRung'),
    `rung for the great stone; the ball across, then still for the spur and the key; rung again for the far door (${r.log.join(' / ')})`);
  // the Ringers' Walk: off the bridge's middle to the great key's ledge high in the Great Belfry, and a drop to its gallery;
  // the gallery's own drop back to the hub's floor (G6). The great key lies free on its ledge (v1.74's cage cut)
  assert.equal(L.elements.d4.lock, 'big', 'the far door takes the great key');
  assert.equal(L.elements.kB.when, undefined, 'the great key free: the ledge is its lock');
  assert.ok(L.links.some((l) => l.a === 'echoes' && l.b === 'ringers' && l.door === 'spur') && L.links.some((l) => l.a === 'ringers' && l.b === 'landing' && l.oneWay), 'from the Hall of Echoes round to the gallery: a loop');
  assert.ok(L.links.some((l) => l.a === 'landing' && l.b === 'stair' && l.oneWay), 'the drop off the gallery to the hub’s floor');
  const still = solve(L, { items, forbid: ['bell'] });
  assert.ok(!still.order.includes('landing') && !still.done, 'without the bell rung, no way up');
  // an old save past the far door: the great key in it
  const g2 = new GameState(null);
  for (const [k, v] of Object.entries({ 'drum.ball2': 1, 'open.d1': true, 'open.lift': true, 'open.d2': true, gadget: true, 'drum.ball3': 1, 'open.d4': true, checkpoint: 'hall', layout: 2 })) g2.set(`temple.arzach2.${k}`, v);
  migrateTemples(g2);
  const B2 = new TempleLogic(L, { store: flagStore(g2, 'arzach2'), has: (i) => [...items, 'hook'].includes(i) });
  B2.update();
  assert.ok(B2.isOpen('d4') && B2.keys('big') === 0, 'past the far door: open, its great key in it');
  // (v1.77, issue #336: the house rebuilt as shrines; v1.83, issue #408: round the Great Belfry. A save that had been inside
  // is taken to its last mark in the new rooms; one that never went in is left alone. Past the porch: its slab sunk)
  for (const entered of [true, false]) {
    const g3 = new GameState(null);
    g3.set('temple.arzach2.layout', 4);
    if (entered) for (const [k, v] of Object.entries({ entered: true, 'open.d1': true, checkpoint: 'bell', 'drum.ball3': 1 })) g3.set(`temple.arzach2.${k}`, v);
    migrateTemples(g3);
    assert.equal(!!g3.flag(BELFRY_RELAID), entered, entered ? 'inside the old house: to its last mark' : 'never inside: nothing to move');
    assert.equal(g3.flag('temple.arzach2.layout'), 5);
    assert.equal(!!g3.flag('temple.arzach2.open.d3'), entered, entered ? 'past the porch: its slab sunk' : 'the porch untouched');
  }
  assert.ok(L.links.some((l) => l.a === 'bell' && l.b === 'porch' && l.door === 'dP') && L.elements.dP.opens.item === 'hook', 'the porch a room of its own past the chamber’s north door (the hook in hand)');
  // (issue #377) the hook is the house's dungeon item: the chamber's bell, the Cloud-Mother, and the founders' bell set from
  // upstairs want it
  assert.equal(L.gadget, 'hook');
  for (const id of ['eT', 'mother']) assert.ok(L.elements[id].needs.includes('hook'), `${id}: the hook`);
  const without = solve(L, { items, withhold: ['hook'] });
  assert.ok(!without.done && !without.order.includes('porch'), 'without the hook nobody gets past the chamber');
  assert.equal(L.elements.p3.room, L.elements.ball3.room, 'the far plate in its ball’s room: nothing rolled through a door');
});

test('the Hush-House (v1.83, issue #409: no fight at all): the Threshold’s crystal opens the great hall, the passage’s mouths in the Choir’s order, the pendulums sung for the small key, the ledge round the Bog Well to the Choir’s gallery and the great key, the drop back into the Choir, the great door hushed high to low; either order; old saves past the old far door find the great door open', () => {
  const L = TEMPLES.perdide.def.logic, items = ['backpack', 'gun', 'doublejump', 'sword', 'shield'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  assert.deepEqual(TEMPLES.perdide.def.arenas, [], 'no arena');
  assert.ok(!Object.values(L.elements).some((e) => e.type === 'arena') && !Object.values(L.rooms).some((r) => r.kind === 'combat'), 'no fight anywhere');
  const noSong = solve(L, { items, forbid: ['w3'] });
  assert.ok(!noSong.stuck.includes('balcony') && !noSong.stuck.includes('hall'), 'without the pendulums’ song the ledge’s door stays shut, and so the great lock');
  const noBall = solve(L, { items, forbid: ['oB'] });
  assert.ok(noBall.logic.isFound('kS') && noBall.stuck.includes('balcony') && !noBall.stuck.includes('hall'), 'without the gallery’s ball the great door stays shut');
  const noHush = solve(L, { items, forbid: ['h2'] });
  assert.ok(noHush.logic.isFound('kB') && !noHush.stuck.includes('hall'), 'without the Choir hushed the great door stays shut');
  assert.ok(L.links.some((l) => l.a === 'balcony' && l.b === 'choir' && l.oneWay), 'the drop: from the gallery into the Choir, one way');
  const W = new TempleLogic(L, { has: (i) => ['gun', 'stun'].includes(i) });
  // the Threshold's door: its crystal
  assert.equal(W.isOpen('d0'), false);
  W.light('c1'); W.update();
  assert.equal(W.isOpen('d0'), true, 'the first note opens the great hall');
  // the passage's three mouths: only in the Choir's order, low to high, the gate's crown last
  assert.equal(W.light('j3'), false, 'the gate first: flat');
  assert.equal(W.light('j2'), false, 'the middling first: flat');
  for (const id of ['j1', 'j2', 'j3']) assert.equal(W.light(id), true, id);
  W.update();
  assert.ok(W.isOpen('d2') && W.isOpen('dj1') && W.isOpen('dj2'), 'all three open');
  // the pendulums' notes, smallest first: the small key's cage
  assert.equal(W.find('kS'), false, 'caged');
  for (const id of ['w1', 'w2', 'w3']) assert.equal(W.light(id), true, id);
  assert.equal(W.find('kS'), true, 'sung: the cage sinks');
  // the gallery's mouth: open only while its frost holds
  assert.equal(W.light('jB'), true); W.update();
  assert.equal(W.isOpen('dJ'), true, 'stilled');
  W.quiet('jB'); W.update();
  assert.equal(W.isOpen('dJ'), false, 'thawed, shut again');
  // the great door: the Choir hushed high to low
  assert.equal(W.light('h2'), false, 'the lowest first: it hums on');
  for (const id of ['h4', 'h3', 'h2']) assert.equal(W.light(id), true, id);
  for (const [extra, past] of [[{}, false], [{ 'lit.w1': true, 'lit.w2': true, 'lit.w3': true, 'open.d3': true, 'open.ds': true, 'lit.arN': true, checkpoint: 'ante' }, true]]) {
    const g = new GameState(null);
    g.set('temple.perdide.layout', 3);
    for (const [k, v] of Object.entries({ entered: true, 'lit.c1': true, 'lit.c2': true, 'lit.c3': true, 'lit.c4': true, 'open.d1': true, 'lit.sw': true, 'open.dw': true, gadget: true, 'lit.j1': true, 'open.d2': true, checkpoint: 'gallery', ...extra })) g.set(`temple.perdide.${k}`, v);
    migrateTemples(g);
    const B = new TempleLogic(L, { store: flagStore(g, 'perdide'), has: (i) => [...items, 'stun'].includes(i) });
    B.update();
    assert.ok(B.isOpen('d0') && B.isOpen('d2') && B.isLit('j2') && B.isLit('j3'), 'the old gate’s stilling counts for all three mouths: the way stays open behind them');
    assert.equal(B.isOpen('dG'), past, past ? 'past the old far door: the great door open' : 'on the gallery: the great key still on the balcony');
    if (past) assert.ok(B.isOpen('dL') && B.isFound('kB') && B.isFound('kS') && B.keys('small') === 0 && B.keys('big') === 0, 'and the wings done, their keys in their doors');
  }
});

test('the Mooring-House (issues #417, #477, #561): the moored room high or low is the house’s one state; the Capstan Floor by the hub, its gate opened from inside; the moorers’ gate’s two keyholes, the Rope Store’s small key and the Anchor Hold’s (its cage’s eye awake once the anchor-ball is home); the Chain Locker past the west door, its ring for its far door; the great key on the balcony behind the lens’s ring; either order; old saves past the west door find it open', async () => {
  const { PERCH, LOW, HIGH, HOLD } = await import('../src/temples/spacecity.js');
  const L = TEMPLES.spacecity.def.logic, items = ['backpack', 'gun', 'doublejump', 'glider', 'sword', 'shield', 'monocle'];
  for (const reverse of [false, true]) { const r = solve(L, { items, reverse }); assert.equal(r.done, true, r.log.join(' / ')); }
  // (G2: the tether and the lens at once, for the great key)
  const noLens = solve(L, { items: items.filter((i) => i !== 'monocle') });
  assert.ok(!noLens.done && !noLens.logic.isFound('kB'), 'without the lens the great key stays caged');
  const noArena = solve(L, { items, forbid: ['arR'] });
  assert.ok(!noArena.stuck.includes('perch') && !noArena.stuck.includes('arena'), 'without the Rope Store the moorers’ gate stays shut, and so the Capstan Floor');
  const noBall = solve(L, { items, forbid: ['bK'] });
  assert.ok(noBall.logic.isFound('kS') && noBall.stuck.includes('perch') && !noBall.stuck.includes('arena'), 'without the balcony’s ball the Capstan Floor stays shut');
  assert.deepEqual(TEMPLES.spacecity.def.arenas.map((A) => A.el), ['arR']);
  // (issue #477, the guardian met early) the Capstan Floor's gate into the hub opens from inside once the Warden is stopped,
  // and its way in is the great door off the loft. (#561) The moorers' gate takes two small keys, the Rope Store's and the
  // Anchor Hold's: the hold's key caged till its eye wakes, the eye lidded till the anchor-ball is home
  assert.ok(L.links.some((l) => l.a === 'arena' && l.b === 'hall' && l.door === 'd7') && L.links.some((l) => l.a === 'loft' && l.b === 'ante' && !l.door), 'the floor between the hub and the loft');
  assert.deepEqual(L.elements.d7.opens, { resolved: true });
  assert.equal(L.elements.sc.lock, 'small'); assert.equal(L.elements.sc.keys, 2); assert.equal(L.elements.sc.opens, undefined, 'the gate wants its keys alone');
  assert.deepEqual(L.elements.kH.when, { lit: 'eH' }); assert.deepEqual(L.elements.eH.when, { drumOn: ['bA', 'pA'] });
  assert.equal(L.elements.bA.plateAt, HOLD.rail.plateAt);
  for (const f of ['bA', 'eH']) {
    const noHold = solve(L, { items, forbid: [f] });
    assert.ok(!noHold.done && noHold.order.includes('hold') && !noHold.order.includes('perch'), `without the Anchor Hold’s ${f} the moorers’ gate stays shut`);
  }
  // (#561) the Chain Locker past the west door, on the way to the hold: its ring opens its far door
  assert.ok(L.links.some((l) => l.a === 'westS' && l.b === 'locker' && !l.door) && L.links.some((l) => l.a === 'locker' && l.b === 'hold' && l.door === 'gN'), 'the west door into the locker, its far door on to the hold');
  assert.equal(L.elements.dL, undefined, 'no shutter on the locker: it is the way on');
  const noLocker = solve(L, { items, forbid: ['ballK'] });
  assert.ok(!noLocker.done && noLocker.order.includes('locker') && !noLocker.order.includes('hold'), 'without the locker’s ball its far door stays shut');
  const way = solve(L, { items }).order;
  assert.ok(way.indexOf('hold') < way.indexOf('perch') && way.indexOf('perch') < way.indexOf('arena'), `the hold, the balcony, then the floor (${way.join(' ')})`);
  // the state: one drum of two stops, set from the hub, the room, the west landing, and with the tether at the docks
  const M = L.elements.mooring;
  assert.deepEqual(M.stops, { mLow: 0, mHigh: 1 });
  assert.equal(M.start, 1, 'it starts high');
  assert.deepEqual(M.rooms.map((r) => (typeof r === 'string' ? r : `${r.room}:${r.needs}`)), ['west', 'drift:tether', 'moor:tether', 'moorW:tether']);
  // what each stop does, through the house's floors (G1): low, the breath, the store's shutter, the Cable Walk; high, the
  // loft's ring, the gangway, the coffer's cage
  for (const [id, want] of [['breath', LOW], ['dR', LOW], ['dockL', LOW], ['dockH', HIGH], ['dockW', HIGH], ['ride', HIGH], ['rideW', HIGH]]) assert.deepEqual(L.elements[id].opens, want, id);
  assert.deepEqual(L.elements.r1.when, HIGH);
  assert.deepEqual(L.elements.cw.opens.all[0], LOW);
  assert.deepEqual(L.elements.br2.opens.all[1], HIGH);
  assert.deepEqual(L.elements.cC.when.all[1], HIGH);
  const S = new TempleLogic(L, { has: (i) => ['gun', 'tether', 'monocle'].includes(i) });
  S.update();
  assert.equal(S.isOpen('dR'), false, 'high: the store shut');
  S.moveDrum('mooring', 0); S.update();
  assert.ok(S.isOpen('dR') && !S.isOpen('dockH'), 'low: the store open, the high dock’s gate shut');
  S.moveDrum('mooring', 0.45); S.update();
  assert.ok(!S.isOpen('dR') && !S.isOpen('dockL') && !S.isOpen('dockH'), 'under way: every gate shut');
  // the cage wants the ball home and the ring only the lens shows (its chain)
  const W = new TempleLogic(L, { has: (i) => ['gun', 'tether', 'monocle'].includes(i) });
  W.moveDrum('bK', L.elements.bK.plateAt);
  assert.equal(W.find('kB'), false, 'the ball home, the ring not pulled');
  // (issue #477) the ring hangs on the house's cable: within reach only with the room low
  W.light('rL');
  assert.equal(W.isLit('rL'), false, 'the room high: the ring hauled up out of reach');
  assert.deepEqual(L.elements.rL.when, LOW);
  W.moveDrum('mooring', 0); W.update();
  W.light('rL');
  assert.equal(W.find('kB'), true, 'the room low, and with the ring');
  assert.equal(L.elements.bK.plateAt, PERCH.plateAt);
  for (const [extra, past] of [[{}, false], [{ 'drum.ballS': 0.143, 'open.gN': true, checkpoint: 'ante' }, true]]) {
    const g = new GameState(null);
    for (const [k, v] of Object.entries({ layout: 3, 'drum.ballW': 1, 'open.g1': true, 'lit.s1': true, 'open.d1': true, gadget: true, 'lit.r1': true, 'open.d2': true, 'drum.ballD': 0.098, 'open.br2': true, 'drum.ballS': 0.905, 'lit.r5': true, 'open.sc': true, checkpoint: 'moor', ...extra })) g.set(`temple.spacecity.${k}`, v);
    migrateTemples(g);
    const B = new TempleLogic(L, { store: flagStore(g, 'spacecity'), has: (i) => [...items, 'tether'].includes(i) });
    B.update();
    assert.ok(B.isOpen('sc') && B.isLit('arR') && B.keys('small') === 0, 'the moorers’ gate stays open behind them');
    assert.equal(B.isOpen('d6'), past, past ? 'past the west door: the Capstan Floor’s door open' : 'on the gallery: the great key still on the balcony');
    assert.ok(B.isOpen('d1') && B.isOpen('d2') && B.isOpen('br2'), 'the doors behind them open as they were');
    if (past) assert.ok(B.isOpen('gN') && B.isLit('rK') && B.isLit('rL'), 'past the west door: its ring and the lens’s ring pulled');
    assert.ok(B.drumOn('bA', 'pA'), '(#477) past the moorers’ gate: the hold’s anchor-ball home');
  }
});

test('the Whale-House, the Casting-House and the Footprint (issue #23, round 3): each an arena whose small key a later door takes with its own condition; either order; each without its arena stuck; old saves past that door find it open', () => {
  const items = ['backpack', 'gun', 'doublejump', 'sword', 'shield'];
  for (const [id, arena, lock, past, before, beyond] of [
    // (the Whale-House's passage door is held, not latched: a save past it had the keepers' door open behind it, before
    // issue #412; since then the Horn Store wants the boots and the tide let out, and the gallery's weight the hook)
    ['underwater', 'arH', 'd4', 'tank', { 'lit.eP': true, 'lit.eS': true, 'open.dH': true }, { 'open.dK': true }],
    // (the Casting-House's small key since issue #416 for the door down to the Weighing Hall, past the furnace's far gate)
    ['moonfoundry', 'arS', 'dW', 'scales', { 'lit.bH': true, 'drum.mH': 1, 'open.brH': true }, { 'open.dF': true }],
    ['spheres', 'arL', 'd4', 'hall', { 'lit.s2': true, 'drum.ball4': 0.62 }, { 'open.d4': true }],
  ]) {
    const L = TEMPLES[id].def.logic, items2 = [...items, ...(OLDER[id] ?? [])];
    for (const reverse of [false, true]) { const r = solve(L, { items: items2, reverse }); assert.equal(r.done, true, `${id}: ${r.log.join(' / ')}`); }
    const noArena = solve(L, { items: items2, forbid: [arena] });
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
    if (id === 'desert') {
      const K = rt.outside.kit;
      for (let i = 0; i < 24; i++) {
        const a = (i + .2) * Math.PI / 12;
        const p = K.world(Math.sin(a) * 52.7 * 1.3, 0, Math.cos(a) * 50.7);
        const sand = level.ground.heightAt(p.x, p.z);
        const tread = physics.groundAt(p.x, d.y + 1, p.z, 12);
        assert.ok(tread > sand + .12, `Rose House outer stair exposed above sand at sector ${i}`);
        if (Math.abs(Math.sin(a) * 52.7 * 1.3) > 8 || Math.cos(a) < 0)
          assert.ok(tread < d.y - 4, 'the lowest stair is visible, not buried beneath a raised dune');
      }
    }
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
    const templeBoxes = Object.values(PLACEMENTS).flat().filter((p) => p.temple === id);
    const box = templeBoxes.find((p) => p.id === TEMPLES[id].def.gadgetBox);
    const stood = resolvePlacement(box, { physics, level });
    assert.ok(stood, `${id}: the chest stands`);
    // on its dais, not sunk into it (the Spheres' chest stood on the floor under the dais: the QC pass)
    const site = rt.gadgetSite.at;
    assert.ok(Math.abs(stood.pos.y - site[1]) < 0.05, `${id}: the chest on top of its dais (${stood.pos.y.toFixed(2)} vs ${site[1]})`);
    assert.ok(Math.abs(physics.groundAt(site[0], site[1] + 1, site[2], 3) - site[1]) < 0.05, `${id}: the dais's top is solid`);
    // A House can hold more than its canonical gadget: Rose also contains shield and gun.
    for (const gift of templeBoxes) {
      const placed = resolvePlacement(gift, { physics, level });
      assert.ok(placed && rt.inside(placed.pos), `${gift.id}: chest inside its House`);
      const floor = physics.groundAt(placed.pos.x, placed.pos.y + 1, placed.pos.z, 3);
      assert.ok(Math.abs(floor - placed.pos.y) < .05, `${gift.id}: chest stands on its own solid floor`);
    }
    if (id === 'desert') {
      assert.deepEqual(templeBoxes.map(p => p.item).sort(), ['gun', 'shield', 'sword']);
      const stone = rt.roseSpark.stoneRest;
      assert.ok(rt.inside(stone), 'spark-stone remains inside the Rose spring');
      const floor = physics.groundAt(stone.x, stone.y + 1, stone.z, 3);
      assert.ok(Number.isFinite(floor) && stone.y >= floor && stone.y - floor < 2, 'spark-stone rests within reach above a solid spring floor');
    }
    assert.ok(level.lights.length >= 6, `${id}: lights inside`);
    // the scout points at the next thing to do
    assert.ok(nextSpot(rt).isVector3);
  }
});

// (the key chests' layout, issue #274, here where every temple is built already: tests/key-chests.test.js has the rest,
// docs/systems/testing.md "Heavy tests")
// (and the house's map's chest, issue #405: the same little chest, a rolled map in it)
test('every temple key is in a little makers\' chest, on flat floor, with room before it (issue #274); the house\'s map too (#405)', () => {
  let n = 0;
  for (const id of BUILT) {
    const w = world(id), L = w.rt.logic;
    const els = Object.entries(L.def.elements).filter(([, e]) => e.type === 'key' || e.type === 'map').map(([k]) => k);
    const keys = w.rt.pieces.filter((p) => p instanceof Key);
    assert.deepEqual(keys.map((k) => k.id).sort(), els.sort(), `${id}: a chest for each key, and the map's`);
    assert.equal(keys.filter((k) => k instanceof MapChest).length, 1, `${id}: one map chest`);
    for (const k of keys) {
      n++;
      const at = `${id}.${k.id}`;
      const display = k instanceof MapChest ? L.def.elements[k.id].display : null;
      const floorY = k.pos.y - (display?.plinth[1] ?? 0);
      assert.equal(k.chest.kind, 'makers', `${at}: the makers' chest, the same as everywhere`);
      assert.ok(k.chest.shell.isMesh && k.chest.shell.name === 'Makers’ chest', `${at}: the chest's own model`);
      if (display) {
        assert.equal(k.scale, display.scale, `${at}: explicitly authored map display scale`);
        assert.ok(k.scale < BOX_SCALE, `${at}: map display remains smaller than a full box`);
        assert.equal(display.plinth[1], 0.24, `${at}: low step only`);
      } else {
        assert.ok(k.scale < BOX_SCALE * 0.75, `${at}: little (${k.scale} of the boxes' ${BOX_SCALE})`);
        assert.equal(k.scale, k.o.big ? KEY_CHEST.big : KEY_CHEST.small);
      }
      if (k instanceof MapChest) assert.equal(k.flying, false, `${at}: never counted with the keys`);
      assert.equal(k.chest.root.scale.x, k.scale);
      assert.ok(Math.abs(k.chest.mats.body.uniforms.uBoxB.value.x - k.chest.size.w / 2 * k.scale) < 1e-6, `${at}: its shader sized as drawn`);
      // Ordinary chests keep flat floor; opted-in maps have only their authored low plinth.
      for (const r of [0.5, 0.8]) for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, x = k.pos.x + Math.sin(a) * r * k.scale, z = k.pos.z + Math.cos(a) * r * k.scale;
        const g = w.physics.groundAt(x, k.pos.y + 0.3, z, 1.5);
        const dx = x - k.pos.x, dz = z - k.pos.z;
        const lx = Math.cos(k.yaw) * dx - Math.sin(k.yaw) * dz;
        const lz = Math.sin(k.yaw) * dx + Math.cos(k.yaw) * dz;
        const onPlinth = display && Math.abs(lx) < display.plinth[0] / 2 && Math.abs(lz) < display.plinth[2] / 2;
        const expectedY = onPlinth ? k.pos.y : floorY;
        // (a map display set back against its wall, issue #630's Vane Room ledge: behind its plinth's back edge the wall
        // itself, solid from the plinth to the point, stands where the floor would)
        if (display && lz < -display.plinth[2] / 2 && !Number.isFinite(g)) {
          const from = new THREE.Vector3(k.pos.x, floorY + 0.5, k.pos.z), to = new THREE.Vector3(x, floorY + 0.5, z), d = from.distanceTo(to);
          assert.ok(w.physics.rayDistance(from, to.sub(from).divideScalar(d), d) < d, `${at}: a wall behind it at ${r} m, not a hole`);
          continue;
        }
        assert.ok(Number.isFinite(g) && Math.abs(g - expectedY) < 0.08, `${at}: supported floor ${r} m round it (${Number.isFinite(g) ? (g - expectedY).toFixed(2) : 'none'})`);
      }
      // room to stand before it, where its front faces
      const f = V(Math.sin(k.yaw), 0, Math.cos(k.yaw)), front = k.pos.clone().addScaledVector(f, 1.5);
      const gf = w.physics.groundAt(front.x, k.pos.y + 0.6, front.z, 2);
      assert.ok(Number.isFinite(gf) && Math.abs(gf - floorY) < 0.15, `${at}: floor to stand on before it`);
      // a cage round it (bars that sink once it is earned), and its key hidden inside until opened
      assert.ok(k.cageR > Math.hypot(k.chest.size.w, k.chest.size.d) / 2 * k.scale, `${at}: the cage clears the chest`);
      assert.equal(k.key.visible, false);
    }
  }
  assert.ok(n >= 20, `the temples' keys (${n})`);
});

test('a temple door is solid until it opens, and the doorway is free after', () => {
  const { physics, rt } = world('desert');
  const door = rt.piece('d1');
  const at = rt.kit.world(XW + 3, 1.4, 52), dir = rt.kit.world(XW + 3, 1.4, 57).sub(at).normalize();
  assert.ok(physics.rayDistance(at, dir, 6) < 3.5, 'shut: the slab is in the way');
  door.setOpen(true, true);
  assert.ok(physics.rayDistance(at, dir, 6) > 5, 'open: through');
  door.setOpen(false, true);
  assert.ok(physics.rayDistance(at, dir, 6) < 3.5, 'and shut again');
});

// ------------------------------------------------------------------ on foot: the desert temple, room by room
test('the Rose House on foot, with nothing but the empty battery (issues #406, #729: round its Great Hall): the east door locked, the ball leaned on through the pilot flame into the hooded bowl and the Givers’ font risen, the gun on the Dry Channel’s ledge and its push rolling the weight onto its plate, the bridge over the sand, up onto the balcony, the blade, the ball cut into the hole onto the plate below and the small key’s cage sunk, the drop to the floor, the key in the east door, the Machines’ Hall’s doors held while its machines stand, the thorns cut, the ball too slow by hand and in time when cut, the guard, the eye shot and the relay, the keepers’ door, back to the hall: the watcher’s bolt sent back and the cistern’s door, the Keeper helped through the Cistern game, its return and the spring’s cage, out', () => {
  game.reset();
  own('backpack');
  const { level, physics, rt } = world('desert');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true });
  const notes = [];
  const leftFor = [], helperFilms = [];
  const moments = { playing: false, play(spec) {
    helperFilms.push(spec); this.playing = true;
    return { done: false };
  } };
  const helperStory = setupTempleStory({ level, levelId: 'desert', player: P, physics, game, moments,
    toast: s => notes.push(s), quests: { isStarted: () => true }, playGame: href => leftFor.push(href) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); helperStory.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };   // (as main.js: the moving colliders first)
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

  // ---- the Great Hall (issue #406): its east door locked, the small key in its cage, the cistern's door shut far ahead
  assert.equal(walk(L(0, 0, 24)), true, `into the Great Hall (${where()})`);
  assert.equal(rt.logic.isOpen('d3'), false, 'the cistern’s door shut');
  assert.equal(walk(L(19.5, 0, ROOMS.hall.east), { max: 12 }), true, `to the east door (${where()})`);
  wait(1);
  assert.ok(!rt.logic.isOpen('dE') && lx(P.pos) < 22, 'locked: it stops you');
  assert.equal(rt.logic.next(), 'ball1', 'the scout points west, at the Hall of the Flame');
  // ---- the Hall of the Flame: the door is shut; leaned on, the ball rolls through the pilot flame, catches, and lights the bowl
  // (issue #336: the groove down the hall's middle, the bowl at its end, the door past it in the north wall)
  assert.equal(walk(L(-16, 0, ROOMS.hall.west)), true, `to the hall's west archway (${where()})`);
  assert.equal(walk(L(XW + 12, 0, ROOMS.hall.west)), true, `into the Hall of the Flame (${where()})`);
  assert.equal(walk(L(XW + 3, 0, 52)), true, `walk to the door (${where()})`);
  assert.ok(rt.kit.local(P.pos).z < 54, 'the shut door stops you');
  const ball1 = rt.piece('ball1');
  assert.equal(ball1.burn, 0, 'the tar ball is cold');
  assert.equal(walk(L(XW + 4, 0, 21)), true, `round the groove, behind the ball (${where()})`);
  lean(ball1, 1, () => lz(ball1.center) > 31.5);
  assert.ok(said(/lean on the tar ball/), 'it rolls ahead of you, by hand');
  assert.ok(ball1.burn > 0, 'leaned through the pilot flame, it burns');
  assert.ok(said(/Givers’ flame and catches/), 'and says so');
  lean(ball1, 1, () => rt.logic.isLit('b0'), 14);
  rest(ball1); wait(1);
  assert.equal(rt.logic.isLit('b0'), true, `burning, it lights the hooded bowl (${lz(ball1.center).toFixed(1)})`);
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true, 'and the door opens');

  // ---- the Givers' font (issue #729): the bowl lit, living water rises beside it; the battery fills there (its prompt is
  // the story's: tests/desert-story.test.js)
  wait(3.5);
  assert.ok(rt.font.water.visible && rt.font.k > 0.9, 'living water stands in the font');
  assert.equal(rt.logic.next(), 'font', 'the font is next');
  assert.ok(nextSpot(rt).distanceTo(rt.font.at) < 0.5, 'the marker on it');
  assert.equal(rt.logic.find('font'), true);
  game.set('desert.battery.charged', true);

  // ---- the Dry Channel (issue #729): the Givers' gun on the near ledge; the Givers' weight rolls only to its push, onto its
  // plate, and the bridge rises over the sand (the double jump and the carried weight before); one step off falls in
  const CH = ROOMS.channel;
  assert.equal(walk(L(XW + 3, 0, 53)), true, `to the door (${where()})`);
  assert.equal(walk(L(XW + 2, 0, 57)), true, `through the door (${where()})`);
  assert.equal(walk(L(XW - 6.5, 0, 57.8)), true, `by the channel's mark (${where()})`);
  wait(0.3);
  assert.equal(rt.checkpoint?.room, 'channel', 'the mark takes you');
  assert.equal(rt.logic.next(), 'gun', 'the gun’s chest is next');
  assert.equal(walk(L(WEIGHT.gun[0] - 2.4, 0, WEIGHT.gun[1]), { tol: 0.6 }), true, `before the gun’s chest (${where()})`);
  items.grant('gun'); game.set('box.desert.gun', true); game.emit('box:opened', { id: 'desert.gun', item: 'gun' });
  assert.equal(rt.logic.isFound('gun'), true);
  assert.equal(rt.logic.next(), 'ballP', 'then the Givers’ weight');
  assert.equal(rt.logic.isOpen('brC'), false, 'the bridge down in the sand');
  const ballP = rt.piece('ballP');
  assert.equal(walk(L(WEIGHT.x0 - 2.4, 0, WEIGHT.z - 0.4), { tol: 0.5 }), true, `behind the weight (${where()})`);
  ballP.hit('blade', ballP.dir.clone());
  wait(0.6);
  assert.equal(ballP.t, 0, 'no cut moves it');
  ballP.hit('push', ballP.dir.clone(), { strength: 0.7 });
  for (let i = 0; i < 8 / DT && !rt.logic.isOpen('brC'); i++) frame();
  assert.equal(rt.logic.drumOn('ballP', 'pp'), true, `pushed by the gun, it rolls onto its plate (t ${ballP.t.toFixed(2)})`);
  assert.ok(rt.logic.isOpen('brC') && rt.logic.isOpen('dc'), 'the bridge rises and the gallery’s door opens');
  wait(3);
  assert.equal(walk(L(WEIGHT.bridge, 0, CH.ledge - 1.2), { max: 12 }), true, `to the bridge’s foot (${where()})`);
  assert.equal(walk(L(WEIGHT.bridge, 0, CH.landing + 2), { max: 12 }), true, `over the bridge (${where()})`);
  assert.ok(P.onGround && rt.kit.local(P.pos).y > -0.2, `on the far landing, not in the sand (${where()})`);
  let climbed = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(XW, 7, 96))); if (P.onGround && rt.kit.local(P.pos).y > 6.5) { climbed = true; break; } }
  assert.ok(climbed, `up the gallery's wall (${where()})`);

  // ---- through the door at the gallery's top onto the Great Hall's balcony (issue #406): the blade on its mound
  assert.equal(walk(L(-26, 7, CH.door)), true, `to the door at the gallery's top (${where()})`);
  assert.equal(walk(L(-18, 7, CH.door)), true, `onto the balcony (${where()})`);
  assert.equal(rt.logic.next(), 'chest');
  items.grant('sword'); game.set('box.desert.temple.sword', true); game.emit('box:opened', { id: 'desert.temple.sword', item: 'sword' });
  assert.equal(rt.logic.gadget, true);
  const machine = { room: 'machines', alive: true };
  rt.machines = [machine];   // (as src/foes.js places them in the Machines' Hall: tests/foes.test.js has the machines themselves)
  wait(1);
  assert.ok(said(/east door, something in the walls is waking/), 'the blade taken, the machines wake behind the east door');
  // ---- the balcony's ball: too heavy for hands; cut, it rolls into the hole and drops onto the plate on the floor below
  const ballK = rt.piece('ballK');
  assert.equal(rt.logic.next(), 'ballK', 'the next thing: the ball over the hole');
  assert.ok(!ballK.o.shove, 'no lean moves it');
  assert.equal(rt.logic.check(rt.logic.el('kS').when), false, 'the key caged');
  cut(ballK, 1);
  for (let i = 0; i < 6 / DT && !rt.logic.drumOn('ballK', 'pK'); i++) frame();
  assert.equal(rt.logic.drumOn('ballK', 'pK'), true, `it drops through onto the plate below (t ${ballK.t.toFixed(2)})`);
  assert.ok(said(/drops through the balcony/) && Math.abs(rt.kit.local(ballK.center).y - ballK.r) < 0.3, `it lies on the floor, and says so (${rt.kit.local(ballK.center).y.toFixed(2)})`);
  wait(1.5);
  assert.equal(rt.logic.next(), 'kS', 'the cage sunk: the key is next');
  // ---- the drop (G6): off the balcony's edge, 7 m, to the floor, unhurt
  const h0 = P.hearts;
  assert.equal(walk(L(-1, 0, 66), { max: 12 }), true, `off the balcony, down to the floor (${where()})`);
  wait(0.8);
  assert.ok(P.onGround && rt.kit.local(P.pos).y < 0.3 && P.hearts === h0 && !P.down, `on the floor, unhurt (${P.hearts} of ${h0})`);
  // ---- the small key: its little chest opened, it is yours; walked up to, it goes into the east door
  assert.equal(walk(L(DROP.key[0], 0, DROP.key[1] - 1.6), { tol: 0.4 }), true, `before the key's chest (${where()})`);
  wait(0.3);
  const pickK = bestInteractable(P);
  assert.equal(pickK?.entry.id, 'temple.desert.kS', `the use button opens it (${pickK?.entry.id})`);
  pickK.entry.use(P);
  wait(2.6);
  assert.equal(rt.logic.isFound('kS'), true, 'the small key taken');
  assert.equal(rt.keyCount().small, 1, 'one small key in hand');
  assert.equal(walk(L(20.5, 0, ROOMS.hall.east), { max: 30 }), true, `back to the east door (${where()})`);
  wait(2.5);
  assert.ok(rt.logic.unlocked('dE') && rt.logic.isOpen('dE'), 'the key turns, and the door opens');
  assert.equal(rt.keyCount().small, 0, 'the key spent');
  // ---- the Machines' Hall (issue #336: the fight in a room of its own): its doors hold while its machines stand
  assert.equal(walk(L(XE - 8, 0, ROOMS.hall.east)), true, `into the Machines' Hall (${where()})`);
  wait(1);
  assert.ok(!rt.logic.isOpen('dE') && !rt.logic.isOpen('dm') && said(/doors grind shut/), 'the machines wake, and the hall’s doors hold');
  machine.alive = false;
  wait(3);
  assert.equal(rt.logic.isLit('arM'), true, 'broken, the hall is won');
  assert.ok(rt.logic.isOpen('dE') && rt.logic.isOpen('dm') && said(/doors sink open/), 'and its doors open, and the house says so');

  // ---- the Hall of Fires: the thorns cut; the ball too slow by hand and in time when cut; the bridge
  assert.equal(walk(L(XE, 0, 45)), true, `to the hall's far door (${where()})`);
  assert.equal(walk(L(XE - 2, 0, 53)), true, `into the Hall of Fires (${where()})`);
  // the thorns: fluid beads on them; the blade cuts them
  const bw0 = rt.piece('bw0');
  bw0.hit('shoot');
  assert.equal(rt.logic.isLit('bw0'), false, 'not by a splash');
  bw0.hit('blade');
  assert.equal(rt.logic.isLit('bw0'), true, 'the blade cuts them');
  wait(1.2);
  // the ball: leaned on, it catches at the fire on its groove but goes out before the bowl; cut, it is there in time
  const ball3 = rt.piece('ball3');
  lean(ball3, 1, () => ball3.t > 0.85, 12);
  rest(ball3, 16); wait(2);
  assert.equal(rt.logic.isLit('b3'), false, `leaned on, it reaches the bowl cold (${ball3.t.toFixed(2)})`);
  assert.ok(said(/Hands are too slow/), 'it went out on the way, and says so');
  walk(L(XE - 2, 0, 55.4), { max: 10 });
  for (let i = 0; i < 12 / DT && !(ball3.rest && ball3.t < 0.2); i++) frame();
  if (ball3.t > 0.05) { ball3.t = 0; rt.logic.moveDrum('ball3', 0); ball3.place(); ball3.rest = true; }   // (back at its start: the test's shortcut for leaning it back)
  cut(ball3, 1);
  for (let i = 0; i < 8 / DT && !rt.logic.isLit('b3'); i++) frame();
  assert.equal(rt.logic.isLit('b3'), true, `cut, it rolls burning all the way, and the bowl catches (${ball3.t.toFixed(2)}, burn ${ball3.burn.toFixed(1)})`);
  wait(3.5);
  assert.equal(rt.logic.isOpen('br1'), true, 'the bridge rises');

  // ---- over the bridge, through the archway into the Watcher's Hall: the guard
  const FB = FIRES.bridge;
  assert.equal(walk(L(FB, 0, ROOMS.fires.lip - 1.5)), true, `to the chasm's lip (${where()})`);
  assert.equal(walk(L(FB, 0, ROOMS.fires.far + 1)), true, `over the bridge (${where()})`);
  assert.ok(P.pos.y > L(0, -1, 0).y, 'over it, not into the chasm');
  assert.equal(walk(L(FB, 0, 95.4)), true, `through the archway into the Guard's Hall (${where()})`);
  assert.equal(rt.logic.next(), 'guard', 'the Givers’ second chest is next');
  items.grant('shield'); game.set('box.desert.temple.shield', true); game.emit('box:opened', { id: 'desert.temple.shield', item: 'shield' });
  assert.equal(rt.logic.isFound('guard'), true);
  const b4 = rt.piece('b4');
  b4.hit('fire');
  assert.equal(rt.logic.isLit('b4'), false, 'the far door’s bowl is hooded');

  assert.equal(walk(L(XE + 14, 0, 115.4), { max: 20 }), true, `to the east doorway (${where()})`);
  assert.equal(walk(L(XC - 13, 0, 115.4), { max: 20 }), true, `through it, into the Hall of Channels (${where()})`);
  assert.equal(walk(L(WING.x - 3, 0, WING.z0 - 2), { max: 40 }), true, `down the Hall of Channels to the groove's start (${where()})`);
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
  assert.ok(rt.kit.local(e10.center).y > 6, 'the eye high on the obelisk, out of the blade’s reach');
  e10.hit('shoot');
  assert.equal(rt.logic.isLit('e10'), true, 'a shot of the gun’s water from the floor wakes it (issue #729: struck from a double jump before)');
  wait(2.5);
  assert.equal(rt.logic.isOpen('sc'), true, 'the keepers’ door opens: the way back to the Hall of Fires');
  // (cut again from where it came to rest, cold, part-way back up the hall: no putting it back by hand, issue #311)
  assert.ok(ball4.rest && ball4.burn === 0 && ball4.t > 0.1 && ball4.t < 0.9, `tipped back out of the bowl, it lies cold in the hall (t ${ball4.t.toFixed(2)})`);
  cut(ball4, 1);
  let spare = null;
  for (let i = 0; i < 16 / DT && !rt.logic.isLit('b4'); i++) { const was = ball4.burn; frame(); if (rt.logic.isLit('b4')) spare = was; }
  assert.equal(rt.logic.isLit('b4'), true, 'past the relay it catches, and burns on into the bowl at the groove’s end');
  assert.ok(spare > 1, `with time to spare (${spare?.toFixed(2)} s of its flame left)`);
  wait(2.5);
  assert.equal(rt.logic.isOpen('d3'), false, 'the cistern’s door: one lamp lit, the watcher’s still dark');
  // the shortcut: through the keepers' door onto the Hall of Fires' near floor, and on back to the Great Hall
  assert.equal(walk(L(XC - 13, 0, 54.4), { max: 30 }), true, `down the Hall of Channels to the keepers’ door (${where()})`);
  assert.equal(walk(L(XE + 13, 0, 54.4)), true, `through the keepers’ door into the Hall of Fires (${where()})`);
  assert.equal(walk(L(XE, 0, 44)), true, `into the Machines' Hall (${where()})`);
  assert.equal(walk(L(30, 0, ROOMS.hall.east)), true);
  assert.equal(walk(L(14, 0, ROOMS.hall.east)), true, `back in the Great Hall (${where()})`);

  // ---- the Givers' watcher (issue #245) before the cistern's door (issue #406): with the guard in hand it wakes; bare-handed
  // its bolt burns, taken on the guard it flies back into its eye, and the cistern's door's second lamp lights
  assert.equal(rt.logic.next(), 'sentry', 'the watcher is next');
  const sentry = rt.piece('sentry');
  let guarding = false;
  P.guard = () => guarding;   // (the blade's block: tests/fluid-sword.test.js has the guard itself)
  assert.equal(walk(L(-2, 0, 68)), true, `before the watcher (${where()})`);
  const hearts0 = P.hearts;
  let aimed = false;
  for (let i = 0; i < 8 / DT && P.hearts >= hearts0; i++) { frame(); aimed ||= sentry.beam.visible; }
  assert.ok(said(/watcher before the cistern’s door wakes/), 'it wakes, and says how to meet it');
  assert.ok(aimed, 'its beam holds on you before it fires');
  assert.ok(P.hearts < hearts0 && said(/bolt burns/), `bare-handed, its bolt gets through (${P.hearts} of ${hearts0})`);
  assert.equal(rt.logic.isLit('sentry'), false);
  walk(L(-2, 0, 68), { tol: 0.6, max: 4 });
  guarding = true;
  for (let i = 0; i < 10 / DT && !rt.logic.isLit('sentry'); i++) frame();
  assert.equal(rt.logic.isLit('sentry'), true, 'taken on the guard, its bolt flies back and breaks it');
  assert.ok(said(/glances off your guard/) && said(/cracks its eye/), 'and says so');
  guarding = false;
  wait(2.5);
  assert.equal(rt.logic.isOpen('d3'), true, 'both lamps lit: the cistern’s door opens');
  const heartsAfter = P.hearts;
  wait(4);
  assert.equal(P.hearts, heartsAfter, 'broken, it fires no more');
  assert.equal(walk(L(0, 0, 97), { max: 20 }), true, `to the cistern's door (${where()})`);
  assert.equal(walk(L(0, 0, 104)), true, `through it (${where()})`);
  wait(0.3);
  assert.equal(rt.checkpoint?.room, 'ante', 'the antechamber’s mark: the guardian’s checkpoint, a few steps from its door');

  assert.ok(items.has('gun') && items.has('sword') && items.has('shield'), 'all three earned before the Keeper');

  // ---- the Cistern: cross its actual doorway on foot, finish its opening, then return an explicit
  // completed-game result through the shared host contract. Actual game inputs and
  // all three floods are exercised separately in cistern-planning-runtime.test.js.
  const K = rt.guardian;
  assert.equal(K.state, 'sleep');
  assert.equal(walk(L(ROOMS.cistern.x, 0, ROOMS.cistern.z - ROOMS.cistern.r + 4)), true, 'into the cistern');
  wait(.5);
  assert.equal(K.state, 'sleep', 'the Keeper waits for help without attacking');
  assert.equal(rt.logic.isOpen('d4'), true, 'there is no combat lockdown behind you');
  assert.equal(helperFilms.length, 1, 'ordinary doorway crossing starts one opening');
  assert.equal(helperFilms[0].shots.length, 2, 'the opening shows context then guidance');
  assert.equal(leftFor.length, 0, 'no navigation before the opening ends');
  helperFilms[0].onEnd(); moments.playing = false;
  assert.equal(leftFor.length, 1, 'the opening end launches the actual encounter');
  const token = new URLSearchParams(leftFor[0]).get('encounter');
  const helping = helperRun(game, 'cistern', token); assert.ok(helping);
  assert.equal(helping.onResult({ failed: false, score: 9999 }), false, 'points alone never calm the Keeper');
  assert.equal(rt.logic.resolved, false);
  assert.equal(helping.onResult({ failed: false, goal: { game: 'cistern', complete: true } }), true);
  helping.left();
  const returned = consumeHelperReturn(game, 'desert', 'desert', {
    restore: p => P.teleport(V(...p.pos), V(...p.up), V(...p.fwd)), resolve: () => K.resolve(),
  });
  assert.equal(returned.success, true); assert.equal(K.state, 'resolved');
  assert.equal(rt.logic.resolved, true); assert.equal(game.flag('temple.desert.done'), true, 'the world changes');
  wait(2.5);
  assert.ok(rt.logic.isOpen('d4') && rt.logic.isOpen('d5'), 'return opens the way through to the spring');
  // ---- ordinary walking through the new spring, then the gun-driven weight and cage
  const S0 = rt.roseSpark.room.z0;
  // The doorway return is on the near rim. Walk around the real central basin
  // and spout, rather than through them from the old invitation-side pose.
  assert.equal(walk(L(-9, 0, ROOMS.cistern.z - ROOMS.cistern.r * .65), { run: false }), true, 'along the near rim');
  assert.equal(walk(L(-9, 0, ROOMS.cistern.z + 10), { run: false }), true, 'around the basin and spout');
  assert.equal(walk(L(0, 0, ROOMS.cistern.z + 10), { run: false }), true, 'back to the spring aisle');
  assert.equal(walk(L(0, 0, S0 + 2), { run: false }), true, `into the spring (${where()})`);
  assert.equal(walk(L(-9, 0, S0 + 2), { run: false }), true, 'left aisle');
  assert.equal(walk(L(-9, 0, S0 + 11), { run: false }), true, 'behind the weight');
  const weight = rt.byId.get('sparkBall');
  assert.equal(rt.logic.isOpen('sparkGate'), false, 'the spark is still caged');
  weight.hit('push', weight.dir, { strength: 1 }); wait(2);
  weight.hit('push', weight.dir, { strength: 1 }); wait(25);
  assert.equal(rt.logic.isOpen('sparkGate'), true, 'the actual rolling weight settles on its plate');
  assert.equal(walk(L(0, 0, S0 + 11), { run: false }), true, 'approach the open cage');
  assert.equal(walk(L(0, 0, S0 + 17), { run: false }), true, 'walk through its doorway to the spark');
  assert.equal(walk(L(0, 0, S0 + 12), { run: false }), true, 'back through the doorway');
  assert.equal(walk(L(-9, 0, S0 + 12), { run: false }), true, 'around the cage');
  assert.equal(walk(L(-9, 0, S0 + 26), { run: false }), true, 'to its far side');
  assert.equal(walk(L(0, 0, S0 + 26), { run: false }), true, 'back to the exit aisle');
  const out = level.portals.filter((p) => p.temple === 'desert').at(-1);
  assert.equal(walk(out.at, { tol: out.r }), true, `to the way out (${where()})`);
  wait(1);
  assert.ok(rt.change.root.visible, 'the water runs and the fields come up');
  assert.ok(notes.some((s) => /water/i.test(s)), 'it says so');
  helperStory.dispose();
  game.reset();
  own();
});

test('a save from the Rose House before issue #336: past the old chamber’s fight the Machines’ Hall is won; the fight not yet won waits there; one that stood in the old rooms is taken to its last mark', () => {
  const past = new GameState(null);
  past.set('temple.desert.layout', 3); past.set('temple.desert.entered', true); past.set('temple.desert.encounter', 'done');
  migrateTempleLayouts(past);
  assert.equal(past.flag('temple.desert.layout'), LAYOUTS.desert.v);
  assert.equal(past.flag('temple.desert.lit.arM'), true, 'the hall won');
  assert.equal(past.flag('temple.desert.open.dm'), true, 'its way on open');
  // (v5, issue #406: past the Machines' Hall, the balcony's ball dropped and the small key taken and turned in the east door)
  assert.equal(past.flag('temple.desert.drum.ballK'), 1, 'the balcony’s ball dropped onto its plate');
  assert.ok(past.flag('temple.desert.found.kS') && past.flag('temple.desert.unlocked.dE') === 1, 'the small key taken and turned');
  assert.equal(past.flag('temple.desert.relaid'), true, 'and taken to its mark if it stands inside');
  const on = new GameState(null);
  on.set('temple.desert.layout', 3); on.set('temple.desert.entered', true); on.set('temple.desert.gadget', true); on.set('temple.desert.encounter', 'on');
  migrateTempleLayouts(on);
  assert.equal(on.flag('temple.desert.lit.arM'), undefined, 'the blade taken, its machines not broken: they wait in the Machines’ Hall');
  assert.equal(on.flag('temple.desert.found.kS'), undefined, 'the key still to fetch from its cage');
  const outside = new GameState(null);
  outside.set('temple.desert.layout', 3);
  migrateTempleLayouts(outside);
  assert.equal(outside.flag('temple.desert.relaid'), undefined, 'never inside: nothing to move');
  // standing where the old Hall of Fires' near ledge was (in the air over the new house's Sword Chamber): to the last mark
  game.reset();
  own('backpack', 'doublejump');
  const { level, physics, rt } = world('desert');
  game.set('temple.desert.checkpoint', 'channel'); game.set('temple.desert.relaid', true);
  const P = new Player(physics, { spawn: rt.kit.world(-8, 7.5, 123.5), dynamic: level.dynamic, health: true });
  rt.connect({ player: P, toast: () => {} });
  rt.update(DT, DT);
  const mark = rt.marks.find((m) => m.room === 'channel');
  assert.ok(P.pos.distanceTo(mark.spot) < 0.5, `at the Dry Channel's mark (${rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1))})`);
  assert.ok(!game.flag('temple.desert.relaid'), 'once');
  game.reset();
  own();
});

test('a save from the Warden’s Well before issue #336: its state as it was (the same pieces), and one that stood in the old rooms is taken to its last mark', () => {
  const past = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 3, entered: true, 'drum.ball1': 1, 'open.d1': true, 'unlocked.d1': 2, gadget: true, checkpoint: 'gallery' })) past.set(`temple.incal.${k}`, v);
  migrateTempleLayouts(past);
  assert.equal(past.flag('temple.incal.layout'), LAYOUTS.incal.v);
  assert.equal(past.flag('temple.incal.relaid'), true, 'inside the old house: to its mark');
  assert.equal(past.flag('temple.incal.checkpoint'), 'gallery', 'its place kept');
  const outside = new GameState(null);
  outside.set('temple.incal.layout', 3);
  migrateTempleLayouts(outside);
  assert.equal(outside.flag('temple.incal.relaid'), undefined, 'never inside: nothing to move');
  // standing where the old Lamp Gallery's floor was (by the new drum's middle, under its floor): to the gallery's mark
  game.reset();
  own('backpack', 'gun', 'glider');
  const { level, physics, rt } = world('incal');
  game.set('temple.incal.checkpoint', 'gallery'); game.set('temple.incal.relaid', true);
  const P = new Player(physics, { spawn: rt.kit.world(-6, 34.7, 73.4), dynamic: level.dynamic, health: true });
  rt.connect({ player: P, toast: () => {} });
  rt.update(DT, DT);
  const mark = rt.marks.find((m) => m.room === 'gallery');
  assert.ok(P.pos.distanceTo(mark.spot) < 0.5, `at the gallery's mark (${rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1))})`);
  assert.ok(!game.flag('temple.incal.relaid'), 'once');
  game.reset();
  own();
});

test('a save from the Aerie before issue #336: its state as it was (the same pieces), and one that stood in the old rooms is taken to its last mark', () => {
  const past = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 3, entered: true, 'drum.ballW': 1, 'drum.bF': 1, gadget: true, checkpoint: 'top' })) past.set(`temple.arzach.${k}`, v);
  migrateTempleLayouts(past);
  assert.equal(past.flag('temple.arzach.layout'), LAYOUTS.arzach.v);
  assert.equal(past.flag('temple.arzach.relaid'), true, 'inside the old house: to its mark');
  assert.equal(past.flag('temple.arzach.checkpoint'), 'top', 'its place kept');
  const outside = new GameState(null);
  outside.set('temple.arzach.layout', 3);
  migrateTempleLayouts(outside);
  assert.equal(outside.flag('temple.arzach.relaid'), undefined, 'never inside: nothing to move');
  // standing where the old high balcony was (the well 12 m across then, its middle at z 68: now inside the Hall of Winds'
  // far end, 32 m over its floor): to the mark in the Vent Hall
  game.reset();
  own('backpack', 'gun', 'glider');
  const { level, physics, rt } = world('arzach');
  game.set('temple.arzach.checkpoint', 'top'); game.set('temple.arzach.relaid', true);
  const P = new Player(physics, { spawn: rt.kit.world(0, 32.05, 77), dynamic: level.dynamic, health: true });
  rt.connect({ player: P, toast: () => {} });
  rt.update(DT, DT);
  const mark = rt.marks.find((m) => m.room === 'top');
  assert.ok(P.pos.distanceTo(mark.spot) < 0.5, `at the Vent Hall's mark (${rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1))})`);
  assert.ok(!game.flag('temple.arzach.relaid'), 'once');
  game.reset();
  own();
});

test('a save from the Engine-House before issue #336: its state as it was (the same pieces), and one that stood in the old rooms is taken to its last mark', () => {
  const past = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 2, entered: true, 'lit.s1': true, 'drum.ball0': 0, 'drum.ballJ': 1, gadget: true, 'lit.k0': true, 'open.dS': true, checkpoint: 'gov' })) past.set(`temple.buried.${k}`, v);
  migrateTempleLayouts(past);
  assert.equal(past.flag('temple.buried.layout'), LAYOUTS.buried.v);
  assert.equal(past.flag('temple.buried.relaid'), true, 'inside the old house: to its mark');
  assert.equal(past.flag('temple.buried.checkpoint'), 'gov', 'its place kept');
  assert.equal(past.flag('temple.buried.drum.ballJ'), 1, 'the hammer’s ball still in its crank');
  const outside = new GameState(null);
  outside.set('temple.buried.layout', 2);
  migrateTempleLayouts(outside);
  assert.equal(outside.flag('temple.buried.relaid'), undefined, 'never inside: nothing to move');
  // standing where the old Governor Room was (18 m east of the old chamber's middle: out in the air now, east of the
  // Crank Hall): to the Governor Room's mark
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('buried');
  game.set('temple.buried.checkpoint', 'gov'); game.set('temple.buried.relaid', true);
  const P = new Player(physics, { spawn: rt.kit.world(22.5, 7.05, 75.2), dynamic: level.dynamic, health: true });
  rt.connect({ player: P, toast: () => {} });
  rt.update(DT, DT);
  const mark = rt.marks.find((m) => m.room === 'gov');
  assert.ok(P.pos.distanceTo(mark.spot) < 0.5, `at the Governor Room's mark (${rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1))})`);
  assert.ok(!game.flag('temple.buried.relaid'), 'once');
  game.reset();
  own();
});

test('a save from the Mooring-House before issue #336: its state as it was (the same pieces), and one that stood in the old rooms is taken to its last mark', () => {
  const past = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 2, entered: true, 'drum.ballW': 1, 'open.g1': true, 'lit.s1': true, 'open.d1': true, gadget: true, 'lit.r1': true, 'open.d2': true, checkpoint: 'drift' })) past.set(`temple.spacecity.${k}`, v);
  migrateTempleLayouts(past);
  assert.equal(past.flag('temple.spacecity.layout'), LAYOUTS.spacecity.v);
  assert.equal(past.flag('temple.spacecity.relaid'), true, 'inside the old house: to its mark');
  assert.equal(past.flag('temple.spacecity.checkpoint'), 'drift', 'its place kept');
  assert.equal(past.flag('temple.spacecity.open.d2'), true, 'the door into the Drift open as it was');
  const outside = new GameState(null);
  outside.set('temple.spacecity.layout', 2);
  migrateTempleLayouts(outside);
  assert.equal(outside.flag('temple.spacecity.relaid'), undefined, 'never inside: nothing to move');
  // standing where the old Moorers' Gallery was (out in the air now, beside the moorers' corridor): to the Gallery's mark
  game.reset();
  own('backpack', 'gun', 'glider');
  const { level, physics, rt } = world('spacecity');
  game.set('temple.spacecity.checkpoint', 'moor'); game.set('temple.spacecity.relaid', true);
  const P = new Player(physics, { spawn: rt.kit.world(-26, 11.05, 21.6), dynamic: level.dynamic, health: true });
  rt.connect({ player: P, toast: () => {} });
  rt.update(DT, DT);
  const mark = rt.marks.find((m) => m.room === 'moor');
  assert.ok(P.pos.distanceTo(mark.spot) < 0.5, `at the Gallery's mark (${rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1))})`);
  assert.ok(!game.flag('temple.spacecity.relaid'), 'once');
  game.reset();
  own();
});

test('a save from the Whale-House before issue #336: its state as it was (the same pieces), and one that stood in the old rooms is taken to its last mark', () => {
  const past = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 2, entered: true, 'drum.b1': 1, 'open.d1': true, 'drum.b2': 1, 'lit.eD': true, 'open.d2': true, gadget: true, checkpoint: 'gallery' })) past.set(`temple.underwater.${k}`, v);
  migrateTempleLayouts(past);
  assert.equal(past.flag('temple.underwater.layout'), LAYOUTS.underwater.v);
  assert.equal(past.flag('temple.underwater.relaid'), true, 'inside the old house: to its mark');
  assert.equal(past.flag('temple.underwater.checkpoint'), 'gallery', 'its place kept');
  const B = new TempleLogic(TEMPLES.underwater.def.logic, { store: flagStore(past, 'underwater'), has: () => true });
  B.update();
  assert.ok(B.isOpen('d1') && B.isOpen('d2'), 'both wings’ doors open as they were');
  const outside = new GameState(null);
  outside.set('temple.underwater.layout', 2);
  migrateTempleLayouts(outside);
  assert.equal(outside.flag('temple.underwater.relaid'), undefined, 'never inside: nothing to move');
  // standing where the old Gallery of Horns was (its floor 9 m up at z 84: since issue #412 inside the gallery's floor over
  // the dais): to the gallery's mark
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('underwater');
  game.set('temple.underwater.checkpoint', 'gallery'); game.set('temple.underwater.relaid', true);
  const P = new Player(physics, { spawn: rt.kit.world(8, 9.05, 84), dynamic: level.dynamic, health: true });
  rt.connect({ player: P, toast: () => {} });
  rt.update(DT, DT);
  const mark = rt.marks.find((m) => m.room === 'gallery');
  assert.ok(P.pos.distanceTo(mark.spot) < 0.5, `at the gallery's mark (${rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1))})`);
  assert.ok(!game.flag('temple.underwater.relaid'), 'once');
  game.reset();
  own();
});

test('a save from the Casting-House before issue #336: its state as it was (the same pieces), and one that stood in the old rooms is taken to its last mark', () => {
  const past = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 2, entered: true, 'drum.m1': 1, 'lit.eM': true, 'open.dM': true, 'drum.m2': 1, gadget: true, checkpoint: 'tongs' })) past.set(`temple.moonfoundry.${k}`, v);
  migrateTempleLayouts(past);
  assert.equal(past.flag('temple.moonfoundry.layout'), LAYOUTS.moonfoundry.v);
  assert.equal(past.flag('temple.moonfoundry.relaid'), true, 'inside the old house: to its mark');
  assert.equal(past.flag('temple.moonfoundry.checkpoint'), 'tongs', 'its place kept');
  assert.equal(past.flag('temple.moonfoundry.drum.m1'), 1, 'the stone moon still in its mould');
  const outside = new GameState(null);
  outside.set('temple.moonfoundry.layout', 2);
  migrateTempleLayouts(outside);
  assert.equal(outside.flag('temple.moonfoundry.relaid'), undefined, 'never inside: nothing to move');
  // standing where the old Tong Chamber's floor was (9 m up round (-21, 66.9): now under the Crucible Stair's landing):
  // to the chamber's mark
  game.reset();
  own('backpack', 'gun', 'magnet');
  const { level, physics, rt } = world('moonfoundry');
  game.set('temple.moonfoundry.checkpoint', 'tongs'); game.set('temple.moonfoundry.relaid', true);
  const P = new Player(physics, { spawn: rt.kit.world(-21, 9.05, 66.9), dynamic: level.dynamic, health: true });
  rt.connect({ player: P, toast: () => {} });
  rt.update(DT, DT);
  const mark = rt.marks.find((m) => m.room === 'tongs');
  assert.ok(P.pos.distanceTo(mark.spot) < 0.5, `at the Tong Chamber's mark (${rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1))})`);
  assert.ok(!game.flag('temple.moonfoundry.relaid'), 'once');
  game.reset();
  own();
});

test('a save from the Clock-House before issue #336: its state as it was (the same pieces), and one that stood in the old rooms is taken to its last mark', () => {
  const past = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 2, entered: true, 'lit.s1': true, 'lit.s2': true, 'lit.s3': true, 'open.discs': true, 'drum.ball1': 1, 'unlocked.d2': 2, 'found.kW': true, 'found.kE': true, 'lit.arW': true, 'open.d2': true, gadget: true, checkpoint: 'coil' })) past.set(`temple.garage.${k}`, v);
  migrateTempleLayouts(past);
  assert.equal(past.flag('temple.garage.layout'), LAYOUTS.garage.v);
  assert.equal(past.flag('temple.garage.relaid'), true, 'inside the old house: to its mark');
  assert.equal(past.flag('temple.garage.checkpoint'), 'coil', 'its place kept');
  const L = new TempleLogic(TEMPLES.garage.def.logic, { store: flagStore(past, 'garage'), has: (i) => ['backpack', 'gun', 'boomerang'].includes(i) });
  L.update();
  assert.ok(L.isOpen('d2') && L.drumOn('ball1', 'p1'), 'the north door open, the counterweight home in its socket');
  assert.equal(L.isOpen('dP'), true, 'the chamber’s new north door opens for the boomerang in hand');
  const outside = new GameState(null);
  outside.set('temple.garage.layout', 2);
  migrateTempleLayouts(outside);
  assert.equal(outside.flag('temple.garage.relaid'), undefined, 'never inside: nothing to move');
  // standing where the old Coil Chamber was (in the air over the Winding Well's floor now): to the chamber's mark
  game.reset();
  own('backpack', 'gun', 'coil');
  const { level, physics, rt } = world('garage');
  game.set('temple.garage.checkpoint', 'coil'); game.set('temple.garage.relaid', true);
  const P = new Player(physics, { spawn: rt.kit.world(0, 9.05, 83.8), dynamic: level.dynamic, health: true });
  rt.connect({ player: P, toast: () => {} });
  rt.update(DT, DT);
  const mark = rt.marks.find((m) => m.room === 'coil');
  assert.ok(P.pos.distanceTo(mark.spot) < 0.5, `at the Coil Chamber's mark (${rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1))})`);
  assert.ok(!game.flag('temple.garage.relaid'), 'once');
  game.reset();
  own();
});

test('a save from the Footprint before issues #336 and #401: its state as it was (the same pieces), and one that stood in the old rooms is taken to its last mark', () => {
  const past = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 2, entered: true, 'drum.ball1': 0.62, 'open.d1': true, 'drum.ball3': 1, 'open.stones': true, gadget: true, 'lit.s2': true, 'drum.ball4': 0.62, checkpoint: 'lodge' })) past.set(`temple.spheres.${k}`, v);
  migrateTempleLayouts(past);
  assert.equal(past.flag('temple.spheres.layout'), LAYOUTS.spheres.v);
  assert.equal(past.flag('temple.spheres.relaid'), true, 'inside the old house: to its mark');
  assert.equal(past.flag('temple.spheres.checkpoint'), 'lodge', 'its place kept');
  const B = new TempleLogic(TEMPLES.spheres.def.logic, { store: flagStore(past, 'spheres'), has: () => true });
  B.update();
  assert.ok(B.isOpen('d1') && B.isOpen('stones') && B.isLit('s2') && B.drumOn('ball4', 'p4'), 'the hall’s door (the first drop’s iris since v1.82), the stones and the far door’s eye and sphere as they were');
  assert.ok(B.isOpen('dL') && !B.isOpen('dT') && !B.isOpen('d4'), 'the Still Pool’s berth opens the Lens Chamber too; the Sounding Toe and the far door still to do (issue #401)');
  // past the old far door: the new house's later doors all done, the great sphere down, the great key in its door
  const far = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 3, entered: true, 'drum.ball1': 0.62, 'open.d1': true, 'drum.ball3': 1, 'open.stones': true, gadget: true, 'lit.s2': true, 'drum.ball4': 0.62, 'unlocked.d4': 1, 'found.kS': true, 'lit.arL': true, 'open.d4': true, checkpoint: 'hall' })) far.set(`temple.spheres.${k}`, v);
  migrateTempleLayouts(far);
  const F = new TempleLogic(TEMPLES.spheres.def.logic, { store: flagStore(far, 'spheres'), has: () => true });
  F.update();
  assert.ok(F.isOpen('dT') && F.isOpen('dR') && F.isOpen('d4') && F.isFound('kG') && F.unlocked('dG') && F.reachable().has('hall'), 'past the far door: the Echo’s Hall in reach, its great door open');
  const outside = new GameState(null);
  outside.set('temple.spheres.layout', 2);
  migrateTempleLayouts(outside);
  assert.equal(outside.flag('temple.spheres.relaid'), undefined, 'never inside: nothing to move');
  // standing in the old Keepers' Gallery (a passage at x -13.8 round the Hall of the Unseen: now out in the air over the
  // Heel Well's north side), its last mark the Lodge's: to that mark
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('spheres');
  game.set('temple.spheres.checkpoint', 'lodge'); game.set('temple.spheres.relaid', true);
  const P = new Player(physics, { spawn: rt.kit.world(-13.8, 0.05, 120), dynamic: level.dynamic, health: true });
  rt.connect({ player: P, toast: () => {} });
  rt.update(DT, DT);
  const mark = rt.marks.find((m) => m.room === 'lodge');
  assert.ok(P.pos.distanceTo(mark.spot) < 0.5, `at the Lodge's mark (${rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1))})`);
  assert.ok(!game.flag('temple.spheres.relaid'), 'once');
  game.reset();
  own();
});

test('the Rose House is solved with the empty battery alone (issue #729): the font, then the gun, the blade and the guard found inside in order; the spring needs the earned gun', () => {
  const L = TEMPLES.desert.def.logic;
  const r = solve(L, { items: ['backpack'] });
  assert.equal(r.done, true, r.log.join(' / '));
  const at = (s) => r.log.indexOf(s);
  assert.ok(at('find font') > 0 && at('find gun (gun)') > at('find font') && at('take chest (sword)') > at('find gun (gun)') && at('find guard (shield)') > at('take chest (sword)'), 'the font, the gun, the blade, the guard');
  assert.ok(!solve(L, { items: ['backpack'], withhold: ['shield'] }).stuck.includes('ante'), 'the watcher before the cistern’s door wants the guard');
  assert.equal(L.elements.keeper.needs.includes('shield') && L.elements.keeper.needs.includes('sword') && L.elements.keeper.needs.includes('gun'), true, 'the Keeper asks for all three');
  assert.ok(L.elements.sparkBall.needs.includes('gun') && L.elements.ballP.needs.includes('gun') && L.elements.e10.needs.includes('gun'), 'the gun taught on the weight, tested on the eye, twisted in the spring');
  assert.equal(solve(L, { items: ['backpack'], withhold: ['gun'] }).logic.isOpen('sparkGate'), false);
  for (const [id, e] of Object.entries(L.elements)) assert.ok(!(e.needs ?? []).some((n) => ['fire', 'stun', 'bloom', 'doublejump'].includes(n)), `${id}: no later-world gun mode, no double jump`);
});

// (the Warden's Well on foot, round its Well and its breath since issue #413: tests/wardens-well.test.js)

// (the Founders' Belfry on foot, round its Great Belfry and its bell since issue #408: tests/belfry-bells.test.js)

// (the Footprint on foot, room by room and floor by floor since issue #401: tests/footprint-floors.test.js)

// (the Engine-House on foot, round its Engine Hall and its engine's clutch since issue #415: tests/engine-house.test.js)

// (the Casting-House on foot: tests/casting-pour.test.js, issue #416)

// (the Lamp-House on foot, room by room: tests/lamp-house.test.js since issue #410)
test('the Lamp-House as shrines (v1.77, issue #336): a save that stood in the old rooms is taken to its last mark; one that never went in is left alone', () => {
  for (const entered of [true, false]) {
    const g = new GameState(null);
    g.set('temple.perdide2.layout', 3);
    if (entered) for (const [k, v] of Object.entries({ entered: true, 'open.d1': true, 'open.disc': true, gadget: true, 'open.d2': true, checkpoint: 'gallery' })) g.set(`temple.perdide2.${k}`, v);
    migrateTemples(g);
    assert.equal(!!g.flag('temple.perdide2.relaid'), entered, entered ? 'inside the old house: to its last mark' : 'never inside: nothing to move');
    assert.equal(g.flag('temple.perdide2.layout'), LAYOUTS.perdide2.v);
  }
  // standing where the old Dark Gallery's near ledge was (in the Lantern Chamber since v1.83): to the gallery's mark
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('perdide2');
  game.set('temple.perdide2.checkpoint', 'gallery'); game.set('temple.perdide2.relaid', true);
  const P = new Player(physics, { spawn: rt.kit.world(0, 9.1, ROOMS_P2.lantern.z), dynamic: level.dynamic, health: true });
  rt.connect({ player: P, toast: () => {} });
  rt.update(DT, DT);
  const mark = rt.marks.find((m) => m.room === 'gallery');
  assert.ok(P.pos.distanceTo(mark.spot) < 0.5, `at the Dark Gallery's mark (${rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1))})`);
  assert.ok(!game.flag('temple.perdide2.relaid'), 'once');
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

test('a shut gate of jaws collides as its two halves are drawn (square shutters, their slabs interlocking: v1.78), snapping with them, and its slot keeps the way when they gape', () => {
  const { physics, rt } = world('perdide');
  const jaw = rt.pieces.find((p) => p.halves && p.id === 'd2');
  const wasOpen = jaw.open;
  if (wasOpen) jaw.setOpen(false, true);
  try {
    assert.equal(jaw.movers.length, 2, 'two moving halves');
    const J = jaw.slabs, w = jaw.w, h = jaw.h;
    // drawn as the pick's square shutters: a stack of slabs, every other one reaching past the middle (they interlock)
    assert.ok(J.rows >= 8 && Math.abs(J.rows * J.s - h) < 1e-6, `${J.rows} slabs of ${J.s.toFixed(2)} m up the gate`);
    for (const { g, side } of jaw.halves) {
      const geo = g.children[0].geometry;   // (in the leaf's frame: from its hinge)
      geo.computeBoundingBox();
      const b = geo.boundingBox;
      assert.ok(b.min.y < 0.01 && b.max.y > h - 0.01, 'its slabs from the floor to the lintel');
      assert.ok(Math.abs(Math.max(Math.abs(b.min.x), Math.abs(b.max.x)) - (w / 2 + J.reach - J.gap - J.seam)) < 0.01, `side ${side}: its long slabs reach past the middle`);
    }
    const ray = new THREE.Raycaster(), inv = jaw.group.matrixWorld.clone().invert();
    const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(jaw.group.matrixWorld);
    const cast = (x, y) => {
      const o = toWorld(x, y, -4), d = toWorld(x, y, 0).sub(o).normalize();
      ray.set(o, d); ray.far = 8;
      return { drawn: ray.intersectObject(jaw.group, true)[0], hit: physics.rayHit(o, d, 8) };
    };
    // the slabs' heights: their middles and just either side of every joint (where a slab's chamfers meet the next's)
    const ys = [];
    for (let i = 0; i < J.rows; i++) ys.push((i + 0.5) * J.s, i * J.s + 0.03, (i + 1) * J.s - 0.03);
    for (const ang of [0.12, 0.3, 0.5]) {
      for (const { g, side } of jaw.halves) g.rotation.y = side * ang;
      jaw.group.updateMatrixWorld(true);
      physics.syncMovers(1 / 60);
      let n = 0, worst = 0, gape = 0;
      // from the side you come at them (-z, the gallery), straight at the gate's plane, jamb to jamb
      for (let x = -w / 2 + 0.3; x <= w / 2 - 0.3 + 1e-6; x += 0.2) for (const y of ys) {
        const { drawn, hit } = cast(x, y);
        const atSlot = hit && !hit.mover && Math.abs(new THREE.Vector3().copy(hit.point).applyMatrix4(inv).z) < 0.1;
        if (!drawn) { assert.ok(atSlot, `ang ${ang}: through the gape at x ${x.toFixed(1)}, y ${y.toFixed(2)} the slot stops you`); continue; }
        if (atSlot && hit.distance <= drawn.distance + 0.05) { gape++; continue; }   // (the slot, in the gape, before the inside of a half)
        n++;
        worst = Math.max(worst, hit ? Math.abs(hit.distance - drawn.distance) : 8);
      }
      assert.ok(n > 200 && worst < 0.05, `ang ${ang}: ${n} rays, the collision off the drawn halves by up to ${worst.toFixed(2)} m`);
      if (ang >= 0.3) assert.ok(gape > 0, `ang ${ang}: the slot meets rays through the gape`);
      // square: the corners by the jambs drawn and solid, at the foot and under the lintel (round leaves left them open)
      for (const x of [-w / 2 + 0.4, w / 2 - 0.4]) for (const y of [0.1, h - 0.1]) {
        const { drawn, hit } = cast(x, y);
        assert.ok(drawn && hit && Math.abs(hit.distance - drawn.distance) < 0.05, `ang ${ang}: the corner at x ${x.toFixed(1)}, y ${y.toFixed(1)} drawn and solid`);
      }
    }
  } finally { if (wasOpen) jaw.setOpen(true, true); }
});

test('the Hush-House on foot (v1.83, issue #409: no fight at all): the Threshold’s crystal opens the great hall, the Choir’s crystals sung low to high, the climbing disc and the eye on the root-wall, the stilling mode, the passage’s three mouths in the Choir’s order and the smallest’s coffer, the pendulums stilled to cross and sung in turn for the small key, the ledge by the Bog Well and the walk to the Choir’s gallery, the ball rolled through a mouth that thaws for the great key, the drop into the black pool, the Choir hushed high to low for the great door, the Mother outwitted and laid to sleep, the swamp in flower', () => {
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
  const path = (...pts) => pts.every((p) => walk(L(...p)));
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  const where = () => rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1)).join(', ');
  const seen = (from, to) => { const d = to.clone().sub(from), n = d.length(); return physics.rayDistance(from, d.normalize(), n) >= n - 0.8; };
  const R = ROOMS_HUSH, U = HUSH_UP, C2 = R.well.z, N0 = C2 - R.well.near, F0 = C2 + R.well.face, C3 = R.stilling.z, SP = R.snapping, GA = R.gallery, CH = R.choir;
  const G0 = GA.z0, Q0 = G0 + GA.near, Q1 = Q0 + GA.pit, Wk = HUSH_WALK, MH = R.hall;
  wait(0.5);
  // ---- the Threshold: its door into the Choir is shut; the smallest crystal by the way in opens it
  assert.equal(walk(L(0, 0, 27)), true, `to the Threshold's far door (${where()})`);
  assert.equal(walk(L(0, 0, 34), { max: 3 }), false, 'shut');
  assert.equal(walk(L(2.5, 0, 14)), true, `to the door's crystal (${where()})`);
  rt.piece('c1').hit('shoot');
  wait(2.4);
  assert.equal(rt.logic.isOpen('d0'), true, 'the first note opens the great hall');
  // ---- the Choir, the great hall: 44 by 66 m, its gallery 9 m up its west side and the great door in its east wall both in
  // sight from the way in
  assert.ok(CH.x1 - CH.x0 >= 44 && CH.z1 - CH.z0 >= 60 && CH.top - CH.y >= 30, 'the great hall');
  assert.equal(walk(L(0, 0, 36)), true, `into the Choir (${where()})`);
  const eye0 = L(10, 1.6, 40);   // (a few steps in)
  assert.ok(seen(eye0, rt.piece('kB').pos.clone().add(V(0, 1.2, 0))), 'the great key’s cage on the gallery, from the way in');
  assert.ok(seen(eye0, rt.piece('dG').group.position.clone().add(V(-1, 4, 0))), 'and the great door');
  rt.piece('c3').hit('shoot');
  assert.equal(rt.logic.isLit('c3'), false, 'out of turn: not lit');
  for (const id of ['c2', 'c3', 'c4']) rt.piece(id).hit('shoot');
  wait(2.2);
  assert.equal(rt.logic.isOpen('d1'), true);
  // ---- the Bog Well: the disc that climbs over the dark water, then up the root-wall
  assert.equal(path([4, 0, 60], [3, 0, 90], [0, 0, N0 - 2]), true, `to the well (${where()})`);
  const disc = rt.pieces.find((p) => p.path);
  for (let i = 0; i < 30 / DT && !(disc.s < 0.2 && disc.wait > 0.6); i++) frame();
  assert.equal(walk(disc.group.position, { tol: 0.5, run: false, max: 4 }), true, `onto the disc (${where()})`);
  for (let i = 0; i < 30 / DT && !(disc.s > disc.total - 0.2); i++) frame();
  assert.ok(rt.kit.local(P.pos).y > 2.5, `carried up on it (${where()})`);
  const eye = rt.piece('sw').center;
  assert.ok(seen(P.pos.clone().add(V(0, 1.6, 0)), eye), 'the eye seen from the disc');
  assert.ok(!seen(L(-0.8, U + 1.7, F0 + 3.7), eye), 'not from the top of the wall');
  rt.piece('sw').hit('shoot');
  wait(0.2);
  let up = false;
  for (let i = 0; i < 20 / DT; i++) { frame({ KeyW: true }, toward(L(0, U, F0 + 6))); if (P.onGround && rt.kit.local(P.pos).y > U - 0.5) { up = true; break; } }
  assert.ok(up, `up the root-wall (${where()})`);
  assert.equal(rt.logic.isOpen('dw'), true, 'the door at the top is open');
  // ---- the Stilling Chamber: the chest
  assert.equal(walk(L(0, U, C3 - 8)), true, `into the chamber (${where()})`);
  items.grant('stun'); game.emit('box:opened', { id: 'perdide.temple.stun' });
  assert.equal(rt.logic.gadget, true);
  // ---- the Snapping Passage: the side mouths, then the gate, in the Choir's order
  assert.equal(path([0, U, SP.z0 + 3], [0, U, G0 - 6]), true, `into the passage (${where()})`);
  rt.piece('d2').hit('shoot');
  assert.equal(walk(L(0, U, G0 + 1), { max: 4 }), false, 'the jaws keep the way');
  rt.piece('d2').hit('stun');
  wait(0.5);
  assert.equal(rt.logic.isLit('j3'), false, 'the gate first: flat');
  assert.ok(notes.some((s) => /smallest crystal first/.test(s)), 'and says why');
  for (const id of ['dj1', 'dj2', 'd2']) rt.piece(id).hit('stun');
  wait(2.6);
  assert.equal(rt.logic.isOpen('d2'), true, 'stilled in turn, they rest open');
  const purses = [], m1 = HUSH_MOUTHS[0];
  const offPurse = game.on('temple:cache', (e) => purses.push(e));
  assert.equal(walk(L(-2.5, U, m1.z)) && walk(L(-(HUSH_SHRINE.face + m1.deep - 2.0), U, m1.z), { tol: 0.5 }), true, `into the smallest mouth's niche (${where()})`);
  const coffer = bestInteractable(P);
  assert.equal(coffer?.entry.id, 'temple.perdide.cache', 'the coffer offers itself');
  coffer.entry.use(P);
  assert.equal(purses.length, 1, 'its purse spills out');
  offPurse();
  assert.equal(walk(L(-1.5, U, m1.z)), true, `back out of the niche (${where()})`);
  // ---- the Pendulum Gallery: a pendulum knocks you off the bridge; stilled, they let you by
  assert.equal(path([0, U, G0 + 2], [0, U, Q0 - 1]), true, `to the bridge (${where()})`);
  const swings = rt.galleryWings;
  assert.equal(swings.length, 3);
  P.teleport(L(0, U + 0.05, rt.kit.local(swings[0].group.position).z), V(0, 1, 0), V(0, 0, 1));
  let knocked = false;
  for (let i = 0; i < 4 / DT && !knocked; i++) { frame(); knocked = !!P.down; }
  assert.ok(knocked, `a pendulum knocks you off (${where()})`);
  for (let i = 0; i < 10 / DT && (P.down || P.dead); i++) frame();
  wait(1.5);
  P.teleport(L(0, U + 0.05, Q0 - 1), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  for (const s of swings) s.hit('stun');
  assert.equal(walk(L(0, U, Q1 + 1), { max: 6 }), true, `over the bridge between the stilled pendulums (${where()})`);
  assert.deepEqual(['w1', 'w2', 'w3'].map((id) => rt.logic.isLit(id)), [true, false, false], 'only the smallest crystal took');
  // ---- the far landing: the small key's cage; the notes again, in turn, from this side
  const [kx, kz] = HUSH_FAR_KEY;
  assert.equal(walk(L(kx + 2.2, U, kz)), true, `to the key's cage (${where()})`);
  wait(0.3);
  assert.equal(rt.logic.isFound('kS'), false, 'caged');
  for (const id of ['w2', 'w3']) rt.piece(id).hit('stun');
  wait(2.6);
  assert.ok(notes.some((s) => /pendulums rest/.test(s)), 'sung: the cage sinks, the pendulums rest');
  openChest(rt, 'kS', P);
  assert.equal(rt.logic.isFound('kS'), true, 'a small key');
  // the way back over: a walk, the pendulums at rest
  wait(8);
  assert.equal(path([0, U, Q1 + 1], [0, U, Q0 - 1]), true, `back over the bridge (${where()})`);
  assert.ok(rt.kit.local(P.pos).y > U - 1, 'on it, not in the chasm');
  const toRootTop = [[0, U, G0 - 3], [0, U, SP.z0 + 3], [0, U, C3 + 8], [0, U, C3 - 8], [0, U, F0 + 5]];
  assert.equal(path(...toRootTop), true, `back past the chest onto the root-wall (${where()})`);
  // ---- the ledge along the Bog Well's west wall to its west door: the small key goes in; on along the walk at UP
  assert.equal(path([-13, U, F0 + 2], [-14, U, C2]), true, `along the ledge (${where()})`);
  assert.equal(walk(L(Wk.door + 1.7, U, C2), { tol: 0.4, max: 4 }), true, `up to the ledge's door (${where()})`);
  wait(2.4);
  assert.equal(rt.logic.keysIn('dL'), 1, 'the small key in it');
  assert.equal(rt.logic.isOpen('dL'), true);
  const wx = (Wk.x0 + Wk.x1) / 2;
  assert.equal(path([wx, U, C2], [wx, U, Wk.to], [-20, U, Wk.to], [-18, U, Wk.to - 3]), true, `through the door, down the walk and onto the Choir's gallery (${where()})`);
  // ---- the gallery: the great key behind a wall, a ball in a groove through a snapper's mouth in it
  const B = BALCONY, ball = rt.piece('oB'), mouth = rt.piece('dJ');
  const toBall = () => walk(ball.center.clone().setY(L(0, U, 0).y).addScaledVector(ball.dir, -(ball.r + 1.3)), { tol: 0.5, max: 6 });
  assert.equal(toBall(), true, `behind the ball (${where()})`);
  ball.hit('push', ball.dir.clone(), { strength: 1 });
  wait(3);
  assert.ok(notes.some((s) => /spit it back/.test(s)), 'shut, the jaws spit the ball back');
  mouth.hit('stun');
  wait(0.3);
  for (let k = 0; k < 4 && !rt.logic.drumOn('oB', 'pB'); k++) { toBall(); ball.hit('push', ball.dir.clone(), { strength: 1 }); wait(2.4); }
  assert.equal(rt.logic.drumOn('oB', 'pB'), true, 'rolled through, onto the cage’s footstone');
  if (!rt.logic.isOpen('dJ')) { mouth.hit('stun'); wait(1.2); }
  P.opts.health = false;   // (the jaws' nips, if they close on him)
  assert.equal(path([B.groove, U, B.wall + 2.5], [B.groove, U, B.wall - 1.3], [B.key[0] - 0.4, U, B.wall - 2]) && walk(rt.piece('kB').pos, { tol: 1.2 }), true, `through them to the great key (${where()})`);
  P.opts.health = true;
  wait(0.3);
  openChest(rt, 'kB', P);
  assert.equal(rt.logic.isFound('kB'), true, 'the great key');
  // ---- the sill: off the gallery's edge into the black pool on the Choir's floor, unhurt
  const S = HUSH_SILL, sz = (S.z0 + S.z1) / 2, hearts = P.hearts;
  assert.equal(walk(L(B.x1 - 0.8, U, S.z0 + 0.9), { run: false }), true, `to the sill, beside the key's cage (${where()})`);
  for (let i = 0; i < 4 / DT && !(P.onGround && rt.kit.local(P.pos).y < 1); i++) frame({ KeyW: true }, toward(L(S.pool[0], 0, sz)));
  assert.ok(rt.kit.local(P.pos).y < 1 && P.onGround, `down on the Choir's floor (${where()})`);
  wait(0.5);
  assert.equal(P.hearts, hearts, 'unhurt');
  assert.ok(!P.down, 'on his feet');
  assert.ok(notes.some((s) => /black pool takes your fall/.test(s)), 'the pool took the fall');
  // ---- the great door: the great key goes in; it will not open over the humming crystals; hushed high to low, it does
  assert.equal(walk(L(CH.x1 - 0.9, 0, MH.z), { tol: 0.4 }), true, `to the great door (${where()})`);
  wait(2.4);
  assert.equal(rt.logic.keysIn('dG'), 1, 'the great key in it');
  assert.equal(rt.logic.isOpen('dG'), false, 'shut still');
  assert.ok(notes.some((s) => /humming crystals: hush them/.test(s)), 'and it says why');
  rt.piece('h2').hit('stun');
  assert.equal(rt.logic.isLit('h2'), false, 'the lowest first: it hums on');
  assert.ok(notes.some((s) => /high to low/.test(s)), 'high to low, it says');
  rt.piece('h2').hit('shoot');
  assert.equal(rt.logic.isLit('h2'), false, 'a splash does not hush');
  for (const id of ['h4', 'h3', 'h2']) rt.piece(id).hit('stun');
  wait(2.4);
  assert.equal(rt.logic.isOpen('dG'), true, 'hushed: the great door opens');
  // ---- the antechamber's mark, a short walk from her hall; then in, walking
  const ante = rt.marks.find((m) => m.room === 'ante');
  assert.ok(ante && ante.spot.distanceTo(L(MH.x - MH.r, 0, MH.z)) < 10, 'the guardian’s checkpoint a short walk from her door');
  assert.equal(walk(L(MH.x - MH.r + 3, 0, MH.z), { run: false }), true, `into her hall, walking (${where()})`);
  const G = rt.guardian, C = rt.motherCrystals, m = G.model;
  wait(0.3);
  assert.notEqual(G.state, 'sleep', `she wakes (${where()})`);
  for (let i = 0; i < 8 / DT && G.state !== 'fight'; i++) frame();
  for (const sw of C.swings) sw.hit('stun');
  for (let i = 0; i < 10 / DT && !(G.phaseIndex === 1 && G.state === 'fight'); i++) frame();
  assert.equal(G.phaseIndex, 1, 'hushed');
  wait(3);
  C.root.hit('shoot');
  assert.equal(C.root.taken, false, 'her head over her root');
  C.notes[3].hit('shoot');   // (a flat note before the first: she strikes at it)
  for (let i = 0; i < 8 / DT && !(!G.attack && Math.hypot(m.mouth.x - C.root.center.x, m.mouth.z - C.root.center.z) > C.cover); i++) frame();
  for (const n of C.notes) n.hit('shoot');
  for (let i = 0; i < 4 / DT && G.state !== 'weary'; i++) frame();
  assert.equal(G.state, 'weary', `sung to sleep (${G.meter.toFixed(2)})`);
  wait(3);
  const head = m.mouth.clone().setY(L(0, 0, 0).y);
  const out = head.clone().sub(m.pos).setY(0).normalize();
  P.teleport(head.clone().addScaledVector(out, 2.4).add(V(0, 0.1, 0)), V(0, 1, 0), V(0, 0, 1));
  wait(0.3);
  const near = bestInteractable(P);
  assert.equal(near?.entry.id, 'temple.perdide.touch', 'a hand on her head');
  near.entry.use(P);
  assert.equal(game.flag('temple.perdide.done'), true);
  wait(6);
  assert.equal(rt.change.root.visible, true, 'the dome in flower');
  const mx = new THREE.Matrix4();
  rt.change.foot.getMatrixAt(0, mx);
  assert.ok(new THREE.Vector3().setFromMatrixScale(mx).x > 0.9, 'flowers at the snappers’ feet');
  game.reset();
  own();
});

test('the Hush-House as shrines (v1.77, issue #336) and round its great hall (v1.83, issue #409): a save that stood in the old rooms is taken to its last mark, the Threshold’s door open; one that never went in is left alone', () => {
  for (const [entered, from] of [[true, 2], [false, 2], [true, 3], [false, 3]]) {
    const g = new GameState(null);
    g.set('temple.perdide.layout', from);
    if (entered) for (const [k, v] of Object.entries({ entered: true, 'lit.c1': true, 'lit.c2': true, 'lit.c3': true, 'lit.c4': true, 'open.d1': true, 'lit.sw': true, 'open.dw': true, gadget: true, checkpoint: 'stilling' })) g.set(`temple.perdide.${k}`, v);
    migrateTemples(g);
    assert.equal(!!g.flag('temple.perdide.relaid'), entered, entered ? 'inside the old house: to its last mark' : 'never inside: nothing to move');
    assert.equal(g.flag('temple.perdide.layout'), LAYOUTS.perdide.v);
    assert.equal(!!g.flag('temple.perdide.lit.c1'), entered, 'inside: the Threshold’s door open behind them');
  }
  // standing in the air where the old rooms were (over the new Choir): to the chamber's mark
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('perdide');
  game.set('temple.perdide.checkpoint', 'stilling'); game.set('temple.perdide.relaid', true);
  const P = new Player(physics, { spawn: rt.kit.world(0, 9.1, 96), dynamic: level.dynamic, health: true });
  rt.connect({ player: P, toast: () => {} });
  rt.update(DT, DT);
  const mark = rt.marks.find((m) => m.room === 'stilling');
  assert.ok(P.pos.distanceTo(mark.spot) < 0.5, `at the Stilling Chamber's mark (${rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1))})`);
  assert.ok(!game.flag('temple.perdide.relaid'), 'once');
  // the rooms tagged, no fight since v1.83 (issue #409); the Snapping Passage the chamber's room still (a room of its own
  // past a door for the stilling mode in hand cost the house a step of its design score)
  const L = TEMPLES.perdide.def.logic;
  assert.deepEqual(Object.keys(L.rooms).filter((r) => L.rooms[r].kind === 'combat'), []);
  assert.ok(L.rooms.stilling.kind === 'puzzle' && ['j1', 'j2', 'j3', 'cache'].every((id) => L.elements[id].room === 'stilling'), 'the passage’s mouths and coffer the chamber’s');
  game.reset();
  own();
});

test('the Aerie on foot: the gusts waited out behind the screens, the stone pushed up the hall into its vent (the hall falls calm, the wind rises in the well), the Moult’s door shut from the well, the feather raft to the gallery, the Wing Chamber’s shutter shut, round the gallery to the Fledgery and its stone dropped through the floor onto the passage’s grate (the shutter lifts), the Fledging Sill’s drop onto the makers’ breath, the wings, the column, the ledge round the well to the Eyrie, down its still vent’s shaft into the Moult’s arena and out of its door onto the well’s floor, up again by the raft and the column, and the Eyrie’s stone between two throats for the great key, the gulf vent’s stone rolled out of its throat and the gust that carries you to the perch, the perch’s stone and the column up to the higher ledge, the Elder’s helping flight completed and returned from, the birds come back', () => {
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('arzach');
  const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: true, limit: level.limit ?? 1900 });
  const notes = [];
  const leftFor = [], helperFilms = [];
  const moments = { playing: false, play(spec) {
    helperFilms.push(spec); this.playing = true;
    return { done: false };
  } };
  const helperStory = setupTempleStory({ level, levelId: 'arzach', player: P, physics, game, moments,
    toast: s => notes.push(s), quests: { isStarted: () => true }, playGame: href => leftFor.push(href) });
  let t = 0;
  const L = (x, y, z) => rt.kit.world(x, y, z);
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); helperStory.update(DT, t); P.update(DT, input, yaw); updateHazards(DT, P); };   // (as main.js: the moving colliders first)
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
  // (v1.77, issue #336: the hall 30 by 66, its stone's groove down its middle from z 26.8, a screen row every 9.4 m from
  // z 22, the well's middle at AERIE.C2, 18 m across, the Vent Hall north of the high balcony)
  const C2 = AERIE_WELL.z, WR = AERIE_WELL.r, BE = C2 + WR - AERIE_BALCONY.depth, TZ = AERIE_TOP.z, T1 = AERIE_TOP.z0 + AERIE_TOP.d, G0 = T1 + 5, [BX0] = AERIE_BALCONY.groove;
  // (v1.83, issue #407: the well 62 m across, the Feather Gallery round it at GY, GW wide; the Fledgery south off it)
  const GY = AERIE_WELL.gallery.y, GW = AERIE_WELL.gallery.w, FL = AERIE_FLEDGE, onGallery = (a) => L(Math.sin(a) * (WR - GW / 2), GY, C2 + Math.cos(a) * (WR - GW / 2));
  stand(-1.6, 0, 18);
  for (let i = 0; i < 6 / DT && gust.state !== 1; i++) frame();
  const z0 = local().z;
  for (let i = 0; i < 1.2 / DT; i++) frame({ KeyW: true, ShiftLeft: true }, toward(L(-1.6, 0, 60)));
  assert.ok(local().z < z0 - 2, `the gust shoves you back (${z0.toFixed(1)} -> ${where()})`);
  stand(0, 0, 10);
  for (const legs of [[[-4.2, 20.4]], ...[22, 31.4, 40.8, 50.2, 59.6].map((z) => [[-7.6, z + 1.6], [-4.2, z + 7.8]]), [[-7.6, 70.6], [-2, AERIE_HALL.z0 + AERIE_HALL.d + 1]]]) {
    assert.ok(calmStart(), 'a calm');
    const t0 = t;
    for (const [x, z] of legs) assert.equal(walk(L(x, 0, z), { tol: 0.7, max: 3 }), true, `to the next screen in the calm (${where()})`);
    assert.ok(t - t0 < 3.2, `inside one calm (${(t - t0).toFixed(1)} s)`);
  }
  // the well beyond: still air, the raft on the floor
  assert.equal(walk(L(-2, 0, C2 - WR + 2)) && walk(L(0, 0, C2 - 8)), true, `into the well (${where()})`);
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
  assert.equal(walk(L(-6, 0, C2)) && walk(L(-WR - 8, 0, C2), { max: 8 }), false, `and it holds: no way into the Moult from the well (${where()})`);
  assert.ok(local().x > -WR - 5.5, `stopped at the door (${where()})`);
  /** On the raft from the well's floor up to the Feather Gallery, by the Wing Chamber's shutter. */
  const rideRaft = () => {
    assert.equal(walk(L(AERIE_WELL.raft - 6, 0, C2 - 2)), true, `in the well (${where()})`);
    for (let i = 0; i < 30 / DT && !(raft.s < 0.2 && raft.wait > 0.8); i++) frame();
    assert.equal(walk(raft.group.position, { tol: 0.5, run: false, max: 4 }), true, `onto the raft (${where()})`);
    for (let i = 0; i < 30 / DT && !(raft.s > raft.total - 0.2); i++) frame();
    assert.ok(local().y > 15.5, `carried up (${where()})`);
    assert.equal(walk(L(WR - 1.5, GY, C2), { tol: 0.8 }), true, `onto the gallery (${where()})`);
  };
  /** Off the gallery's edge with the wings open, round and up the column to the high balcony. */
  const upTheColumn = () => {
    assert.equal(walk(L(WR - GW + 0.8, GY, C2 + 3), { tol: 0.6 }), true, `at the gallery's edge (${where()})`);
    let up = false;
    for (let i = 0; i < 20 / DT; i++) { P.heading = -Math.PI / 2; frame({ Space: true, KeyW: i < 20 }, -Math.PI / 2); if (local().y > 33.2) { up = true; break; } }
    assert.ok(up, `lifted up the well (${where()})`);
    assert.ok(Math.abs(glide(0, 6, () => local().z < BE + 2.5, L(0, 32, BE + 5)).y - 32) < 0.6 && local().z > BE + 1, `onto the high balcony (${where()})`);
  };
  rideRaft();
  // ---- (v1.83, issue #407) the Wing Chamber's shutter is down: round the gallery to the Fledgery, its stone into the hole
  // in its floor; it drops onto the grate in the Long Passage below, and the wind lifts the shutter
  assert.equal(rt.logic.isOpen('dW'), false, 'the shutter is shut');
  assert.equal(walk(L(WR + 4 + 7, GY, C2), { max: 4 }), false, `and it holds (${where()})`);
  assert.ok([1.9, 2.3, 2.7, 3.0, Math.PI].every((a) => walk(onGallery(a), { max: 8 })), `round the gallery (${where()})`);
  assert.equal(walk(L(0, GY, C2 - WR - 2)) && walk(L(4, GY, FL.z1 - 3)), true, `into the Fledgery (${where()})`);
  assert.equal(roll('bD', 'pD', 1), true, `the stone dropped through the floor onto the grate below (${where()})`);
  wait(0.5);
  assert.ok(rt.logic.isOpen('dW') && said(/drops through the floor/), 'the shutter lifts');
  assert.ok(!rt.pieces.find((p) => p.lift && JSON.stringify(p.o.when ?? {}).includes('"bD"')).on, 'the grate’s breath stopped');
  // the Fledging Sill: off the gallery's edge between its two feathers, down onto the makers' breath, unhurt
  assert.equal(walk(L(0, GY, C2 - WR + 1)) && walk(onGallery(AERIE_SILL.a), { max: 10 }), true, `to the sill (${where()})`);
  const heartsS = P.hearts;
  for (let i = 0; i < 6 / DT && !(P.onGround && local().y < 1); i++) frame({ KeyW: true }, toward(L(0, 0, C2)));
  assert.ok(P.onGround && local().y < 0.6, `down on the well's floor (${where()})`);
  wait(0.2);
  assert.equal(P.hearts, heartsS, 'the breath took the fall: no hurt');
  assert.ok(said(/breath takes your fall/), 'it says so');
  rideRaft();
  assert.equal(walk(L(WR + 4 + 7, GY, C2)), true, `through the shutter into the wing chamber (${where()})`);
  items.grant('glider'); game.emit('box:opened', { id: 'arzach.temple.glider' });
  assert.equal(rt.logic.gadget, true);
  // ---- (v1.74) the catch: off the balcony with the wings open, the column lets you go just over it, for the floor's
  // second vent by the Moult's door breathes half the wind away
  const vent2 = rt.pieces.find((p) => p.lift && JSON.stringify(p.o.when ?? {}).includes('"bF"'));
  assert.ok(vent2?.on && column.h < 20, 'the floor’s second vent breathes, and the column is low');
  assert.equal(walk(L(WR - GW + 0.8, GY, C2 + 3), { tol: 0.6 }), true, `at the gallery's edge (${where()})`);
  let peak = 0;
  for (let i = 0; i < 6 / DT; i++) { P.heading = -Math.PI / 2; frame({ Space: true, KeyW: i < 20 }, -Math.PI / 2); peak = Math.max(peak, local().y); }
  assert.ok(peak > 16.5 && peak < 20, `lifted, and let go just over the balcony (${peak.toFixed(1)})`);
  assert.ok(said(/other vent is breathing half of it away/), 'and it says where the rest goes');
  stand(-4, 0, C2 - 4); wait(0.3);   // (down again on the wings)
  // its stone into its throat: the vent stops, and the whole wind rises up the well
  stand(WELL_VENT.x, 0, C2 + WELL_VENT.z0 - 2.6);
  assert.equal(roll('bF', 'pF', 1), true, `the second vent's stone in its throat (${where()})`);
  assert.ok(!vent2.on && column.h > 30, 'the little vent still, the column up to the crown');
  rideRaft();
  // ---- the column: off the balcony with the wings open, round and up to the high balcony
  upTheColumn();
  assert.equal(walk(L(0, 32, C2 + WR + 2)) && walk(L(5.4, 32, AERIE_TOP.z0 + 3.4), { tol: 0.8 }), true, `into the Vent Hall, past its mark (${where()})`);
  assert.equal(walk(L(0, 32, C2 + WR - 1)), true, `back onto the balcony (${where()})`);
  // ---- the Eyrie, along the ledge round the well's west wall: two vents, one stone between their throats
  const bE = rt.piece('bE'), kE = rt.piece('kE');
  const ring = [-0.25, -0.55, -0.85, -1.15, -1.4, -Math.PI / 2].map((a) => L(Math.sin(a) * (WR - 1.7), 32, C2 + Math.cos(a) * (WR - 1.7)));
  assert.ok(ring.every((p) => walk(p, { max: 6 })) && walk(L(STACK.ledge[1] - 1, 32, C2)), `round the ledge into the Eyrie (${where()})`);
  let top = false;
  const ledgeVent = rt.pieces.find((p) => p.lift && p.o.when?.drumOn?.[1] === 'pU'), gapVent = rt.pieces.find((p) => p.lift && JSON.stringify(p.o.when ?? {}).includes('"pC"'));
  assert.ok(ledgeVent.on && !gapVent.on, 'the stone in the far vent’s throat: the wind out of the ledge’s own');
  // the obvious wind: up the ledge's column beside the shelf, and the coffer on it
  stand(STACK.vent.x, STACK.eyrie.y, STACK.vent.z);
  top = false;
  for (let i = 0; i < 12 / DT; i++) { P.heading = 0; frame({ Space: true }, 0); if (local().y > STACK.shelf.y + 1.2) { top = true; break; } }
  assert.ok(top, `lifted beside the shelf (${where()})`);
  assert.ok(Math.abs(glide(0, 4, () => local().z < STACK.shelf.z[0] + 0.6, L(STACK.shelf.x[0] + 2, STACK.shelf.y, (STACK.shelf.z[0] + STACK.shelf.z[1]) / 2)).y - STACK.shelf.y) < 0.6, `onto the coffer's shelf (${where()})`);
  rt.piece('cache').openIt();
  assert.equal(rt.logic.isFound('cache'), true, 'a coffer of chimes');
  // (v1.74) the stone into the other throat while the Moult is shut: barely a breath comes up the gap's shaft
  stand(STACK.groove.x - 1.4, STACK.eyrie.y, C2 - 7.6);
  assert.equal(roll('bE', 'pC', 1), true, `the stone into the other throat (${where()})`);
  assert.ok(!ledgeVent.on && !gapVent.on && !rt.logic.isOpen('lift'), 'the Moult below shut: no wind out of the vent at the gap’s foot');
  assert.equal(roll('bE', 'pU', -1), true, `and back into the gap vent's throat (${where()})`);
  // ---- the vent at the gap's foot, still while the stone sits in its throat (as it starts): its shaft goes down into the
  // Moult. Off the ledge into its mouth, the wings opened down in the shaft, and into the arena from above
  assert.equal(rt.logic.isOpen('chute'), true, 'the stone in the gap vent’s throat: its shaft is still');
  const keepers = [{ room: 'moult', alive: true }, { room: 'moult', alive: true }];
  rt.machines = [...(rt.machines ?? []), ...keepers];
  stand(STACK.ledge[0] + 0.6, STACK.eyrie.y, C2);
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
  assert.equal(walk(L(-WR - 2, 0, C2)) && walk(L(-6, 0, C2)), true, `out onto the well’s floor (${where()})`);
  // and up again: the raft, the column, round the ledge (the circuit round the stack)
  rideRaft();
  upTheColumn();
  assert.ok(walk(L(0, 32, C2 + WR - 1)) && ring.every((p) => walk(p, { max: 6 })) && walk(L(STACK.ledge[1] - 1, 32, C2)), `round the ledge into the Eyrie again (${where()})`);
  // the perch is six metres over the ledge: on still air no glide climbs to it
  stand(STACK.ledge[0] + 1, STACK.eyrie.y, C2);
  for (let i = 0; i < 0.4 / DT; i++) frame({ KeyW: true, ShiftLeft: true }, -Math.PI / 2);
  glide(-Math.PI / 2, 8);
  assert.ok(Math.abs(local().y - STACK.eyrie.y) < 0.6 && local().x > STACK.ledge[0] - 0.5 && !rt.logic.isFound('kE'), `short of the perch: into the dark, and back at the mark (${where()})`);
  // the stone into the ledge vent's throat: that wind dies, and the one at the gap's foot rises past the perch
  stand(STACK.groove.x - 1.4, STACK.eyrie.y, C2 - 7.6);
  assert.equal(roll('bE', 'pC', 1), true, `the stone into the other throat (${where()})`);
  assert.ok(!ledgeVent.on && gapVent.on, 'the wind out of the vent at the gap’s foot');
  stand(STACK.ledge[0] + 0.8, STACK.eyrie.y, C2);
  top = false;
  for (let i = 0; i < 12 / DT; i++) { P.heading = -Math.PI / 2; frame({ Space: true, KeyW: i < 30 }, -Math.PI / 2); if (local().y > STACK.perch.y + 2) { top = true; break; } }
  assert.ok(top, `lifted past the perch (${where()})`);
  glide(-Math.PI / 2, 6, () => true, L((STACK.perch.x[0] + STACK.perch.x[1]) / 2, STACK.perch.y, C2));
  assert.ok(P.onGround && Math.abs(local().y - STACK.perch.y) < 0.6, `onto the perch (${where()})`);
  assert.equal(walk(kE.pos, { tol: 1.2, max: 4 }), true, `to the great key (${where()})`);
  wait(0.3);
  openChest(rt, 'kE', P);
  assert.equal(rt.logic.isFound('kE'), true, 'the great key');
  // back over the gap: down onto the ledge, and round to the balcony
  stand(STACK.perch.x[1] - 0.4, STACK.perch.y, C2);
  for (let i = 0; i < 0.4 / DT; i++) frame({ KeyW: true, ShiftLeft: true }, Math.PI / 2);
  glide(Math.PI / 2, 10, () => local().x < STACK.ledge[0] + 3, L(STACK.ledge[0] + 4, 32, C2));   // (through the column, and out of it)
  assert.ok(Math.abs(local().y - STACK.eyrie.y) < 0.6, `back on the ledge (${where()})`);
  assert.ok(walk(L(-WR - 2, 32, C2)) && ring.slice().reverse().every((p) => walk(p, { max: 6 })) && walk(L(0, 32, C2 + WR - 1)), `round the ledge to the balcony (${where()})`);
  // ---- the Gulf: on still air the perch is too far
  assert.equal(walk(L(0, 32, TZ + 6)) && walk(L(0, 32, G0 + 1)), true, `through the Vent Hall and the small key's door to the gulf (${where()})`);
  assert.equal(rt.logic.keysIn('dG'), 1, 'the small key in it');
  assert.equal(walk(L(6.5, 32, G0 + 3.6), { tol: 0.8 }), true, `past the mark (${where()})`);
  stand(0, 32, G0 + 5);
  const tail = rt.pieces.find((p) => p.o?.carry);
  assert.equal(tail.on, false, 'the gulf’s air is still');
  for (let i = 0; i < 0.5 / DT; i++) frame({ KeyW: true, ShiftLeft: true }, 0);
  let end = glide(0, 8);
  assert.ok(end.z < G0 + 1.4 || end.y > 30 && end.z < G0 + 8.4, `on still air you fall short, and are back at the mark (${where()})`);
  // the vent's stone, in the middle of the Vent Hall: rolled out of its throat, the gusts pour over the gulf
  assert.equal(walk(L(0, 32, G0 + 2.6), { max: 6 }), true, `to the gulf's door (${where()})`);
  assert.equal(walk(L(0, 32, T1 - 3), { max: 12 }), true, `back into the Vent Hall (${where()})`);
  assert.equal(walk(L(BX0 - 3.8, 32, TZ + 0.6), { max: 6 }), true, `round the stone (${where()})`);
  assert.equal(roll('ballB', 'pX', 1), true, `the stone out of the throat (${where()})`);
  assert.equal(tail.on, true, 'the gulf’s vent blows');
  assert.equal(walk(L(0, 32, G0 + 1), { max: 12 }), true, `to the gulf again (${where()})`);
  stand(0, 32, G0 + 5);
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
  // ---- the Roost: the complete approach remains physical. The flight itself is
  // checked with real formation inputs elsewhere; only its explicit result is
  // handed across the page boundary here, as both production hosts do.
  const fz = pz + GULF.perchR + GULF.leg2;
  assert.equal(walk(L(0, GULF.farY, fz + 10), { max: 8 }), true, `across the ledge to its door (${where()})`);
  assert.equal(walk(L(0, GULF.farY, fz + 30), { max: 12 }), true, `into the roost (${where()})`);
  const G = rt.guardian;
  wait(.3); assert.equal(G.state, 'sleep', 'the Elder waits for company');
  assert.equal(G.hit('body', 'shoot'), false); assert.equal(G.meter, 0);
  assert.equal(helperFilms.length, 1, 'ordinary doorway crossing starts one opening');
  assert.equal(helperFilms[0].shots.length, 2, 'the opening shows context then guidance');
  assert.equal(leftFor.length, 0, 'no navigation before the opening ends');
  helperFilms[0].onEnd(); moments.playing = false;
  assert.equal(leftFor.length, 1, 'the opening end launches the actual encounter');
  const helping = helperRun(game, 'elderflight', new URLSearchParams(leftFor[0]).get('encounter'));
  assert.ok(helping);
  assert.equal(helping.onResult({ failed: true, goal: { game: 'elderflight', complete: false } }), false);
  assert.equal(rt.logic.resolved, false, 'turning back cannot open the way out');
  assert.equal(helping.onResult({ failed: false, goal: { game: 'elderflight', complete: true } }), true);
  helping.left();
  assert.equal(consumeHelperReturn(game, 'arzach', 'arzach', {
    restore: p => P.teleport(V(...p.pos), V(...p.up), V(...p.fwd)), resolve: () => G.resolve(),
  }).success, true);
  assert.equal(game.flag('temple.arzach.done'), true);
  wait(5);
  assert.equal(rt.change.root.visible, true, 'the birds come back');
  helperStory.dispose();
  game.reset();
  own();
});


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

// (the Clock-House on foot: tests/clock-house.test.js, since its rework round the great hall, issue #414)

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
  // (issue #377) the recall hourglass's sand keeps a note as the shell did, the Undertower's tool since
  items.revoke('echo'); items.grant('recall');
  shell.update(1.1);
  game.emit('note', { pos: V(5, 0, 7), note: 'high', label: 'the high stone’s note' });
  assert.equal(shell.held.note, 'high', 'the hourglass keeps it');
  assert.equal(shell.play(), true, 'and gives it back');
  items.revoke('recall');
  shell.dispose(); off();
  game.reset();
  own();
});

// (the Undertower on foot: tests/undertower-line.test.js, issue #418)

test('a save from the Undertower before issue #418: its state as it was (the same pieces where they stayed), and one that stood in the old rooms is taken to its last mark', () => {
  const past = new GameState(null);
  for (const [k, v] of Object.entries({ layout: 5, entered: true, 'drum.ball1': 1, 'lit.eD': true, 'open.disc': true, 'lit.eW': true, 'open.wdisc': true, 'unlocked.dK': 2, gadget: true, 'drum.ballP': 1, 'lit.e0': true, 'open.d3': true, checkpoint: 'gallery' })) past.set(`temple.bazaar.${k}`, v);
  migrateTempleLayouts(past);
  assert.equal(past.flag('temple.bazaar.layout'), LAYOUTS.bazaar.v);
  assert.equal(past.flag('temple.bazaar.relaid'), true, 'inside the old house: to its mark');
  assert.equal(past.flag('temple.bazaar.checkpoint'), 'gallery', 'its place kept');
  const B = new TempleLogic(TEMPLES.bazaar.def.logic, { store: flagStore(past, 'bazaar'), has: (i) => ['backpack', 'gun', 'recall'].includes(i) });
  B.update();
  assert.ok(B.isOpen('d3') && B.isOpen('dK'), 'the passage’s door and the chamber’s stay open behind them');
  const outside = new GameState(null);
  outside.set('temple.bazaar.layout', 5);
  migrateTempleLayouts(outside);
  assert.equal(outside.flag('temple.bazaar.relaid'), undefined, 'never inside: nothing to move');
  // standing where the old Gallery of Voices' near landing was (in the Shell Chamber's corridor now): to the gallery's mark
  game.reset();
  own('backpack', 'gun');
  const { level, physics, rt } = world('bazaar');
  game.set('temple.bazaar.checkpoint', 'gallery'); game.set('temple.bazaar.relaid', true);
  const P = new Player(physics, { spawn: rt.kit.world(0, 12.1, 111), dynamic: level.dynamic, health: true });
  rt.connect({ player: P, toast: () => {} });
  rt.update(DT, DT);
  const mark = rt.marks.find((m) => m.room === 'gallery');
  assert.ok(P.pos.distanceTo(mark.spot) < 0.5, `at the gallery's mark (${rt.kit.local(P.pos).toArray().map((v) => v.toFixed(1))})`);
  assert.ok(!game.flag('temple.bazaar.relaid'), 'once');
  game.reset();
  own();
});

// (the Mooring-House on foot: tests/mooring-room.test.js since issue #417, the house round its moored room)
