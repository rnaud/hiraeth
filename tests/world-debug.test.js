// The dev menu's world (src/world-debug.js; docs/systems/dev-tools.md "The dev menu"): what it gathers from a world's
// own data, where a teleport sets you down, the quest jump's flags, the cinematics it lists, the tabs it makes, and
// L3 + R3 opening it. The menu itself (its tabs, pausing, god mode, the engines'): tests/dev-menu.test.js. Every route
// world built, gathered and landed on: tests/world-debug-worlds.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { gatherPoints, groupPoints, landingSpot, questJump, applyQuestJump, questList, cinematicsFor, devTabs, keyPlaces, xyz, words, KINDS } from '../src/world-debug.js';
import { CINEMATICS } from '../src/cinematics-page/catalog.js';
import { WORLD_MOMENTS } from '../src/story/film.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { Quests } from '../src/story/quests.js';
import { GameState } from '../src/game-state.js';
import { Physics } from '../src/physics.js';
import { Controller } from '../src/controller.js';
import { BINDINGS } from '../src/bindings.js';
import { partOf, isDismissed } from '../src/levels/names.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

/** A world in miniature, as main.js has it: a level, its temple, quests with locators, people, boxes, the ship. */
function miniWorld() {
  const game = new GameState(null);
  const quests = new Quests({ game });
  quests.define({ id: 'mini.main', title: 'The well', world: 'mini', main: true, stages: [
    { id: 'go', text: 'Go to the well', goto: [10, 0, 10] },
    { id: 'talk', text: 'Talk to Ama', talk: 'ama', flag: 'mini.talked' },
    { id: 'lever', text: 'Pull the lever', flag: 'mini.lever', value: 2, at: 'lever' },
    { id: 'nowhere', text: 'Think about it' },
  ] });
  quests.define({ id: 'other.q', title: 'Elsewhere', world: 'other', stages: [{ id: 'a', text: 'a', goto: [0, 0, 0] }] });
  quests.locate('ama', () => V(5, 0, -5));
  quests.locate('lever', () => V(-20, 3, 0));
  const temple = {
    def: { name: 'the Well-House' }, doorOut: V(30, 0, 30), outside: { door: { at: V(30, 0, 27), heading: 0 } },
    arrival: { pos: V(0, 1500, 0), heading: 1 }, marks: [{ room: 'firesFar', spot: V(10, 1500, 0), heading: 0.5 }],
    gadgetSite: { at: [4, 1500, 4] }, guardian: { arena: { center: V(0, 1500, 40), r: 10, y: 1500 } },
    inside: (p) => p.y > 1400,
  };
  const level = {
    spawn: V(1, 0, 1), spawnHeading: 0.3, temple,
    sights: () => [{ name: 'the cairn', at: V(50, 0, 0) }],
    beacons: [{ name: 'the mast', top: [60, 20, 0], height: 20 }],
    lines: [{ name: 'the stones', points: [[70, 0], [80, 0]] }],
    portals: [{ at: V(90, 0, 0), r: 1.5, to: V(90, 1000, 0), heading: 0, label: 'the cave mouth' }, { at: V(90, 1000, 4), r: 1.5, to: V(90, 0, 3), toUp: V(0, 1, 0), label: 'way out' }],
    shops: [{ label: 'Chimes & Cures', def: { keeper: 'ommi' }, portals: [{ at: V(-40, 0, 0), to: V(0, 3000, 0) }, { at: V(0, 3000, 3), to: V(-40, 0, 3), toUp: V(0, 1, 0) }], counter: { at: V(0, 3000, -1) } }],
    ground: { heightAt: () => 0 },
  };
  const npcs = [{ def: { id: 'ama', name: 'Ama', title: 'by the fires' }, pos: V(5, 0, -5) }, { def: { id: 'ama', name: 'Ama' }, pos: V(6, 0, -5) }, { pooled: true, def: { id: 'walker' }, pos: V() }, { pos: V() }];
  const boxes = { list: [{ id: 'mini.box', item: 'glider', pos: V(-7, 0, 7) }] };
  const ship = { arrivalSpot: () => ({ pos: V(-3, 0, -3), heading: 2 }) };
  return { game, quests, level, npcs, boxes, ship, w: { levelId: 'mini', level, quests, npcs, boxes, ship, content: { story: { title: 'MINI', label: 'the well top', goal: [12, 'ground', 12] } } } };
}

test('a point is [x, y, z] whatever form the world keeps it in (y null: on the ground there)', () => {
  assert.deepEqual(xyz(V(1, 2, 3)), [1, 2, 3]);
  assert.deepEqual(xyz([4, 5]), [4, null, 5]);
  assert.deepEqual(xyz([1, 'ground', 2]), [1, null, 2]);
  assert.deepEqual(xyz([1, null, 2]), [1, null, 2]);
  assert.deepEqual(xyz({ x: 1, z: 2, r: 9 }), [1, null, 2]);
  assert.deepEqual(xyz({ at: [1, 2, 3] }), [1, 2, 3]);
  assert.deepEqual(xyz({ pos: V(7, 8, 9) }), [7, 8, 9]);
  assert.equal(xyz(null), null);
  assert.equal(words('firesFar'), 'fires far');
});

test('the points are gathered from the world\'s own data, by kind, rooms and exact spots marked', () => {
  const { w } = miniWorld();
  const pts = gatherPoints(w);
  const of = (kind) => pts.filter((p) => p.kind === kind).map((p) => p.label);
  assert.deepEqual(of('landing'), ['the ship', 'the start']);
  assert.deepEqual(pts.find((p) => p.label === 'the ship').heading, 2, 'the ship: facing as you come down its ramp');
  // every stage of this world's quests that has a place (a stage with none, and another world's quest, left out)
  assert.deepEqual(of('quest'), ['Go to the well', 'Talk to Ama', 'Pull the lever']);
  assert.deepEqual(pts.find((p) => p.label === 'Pull the lever').pos, [-20, 3, 0], 'a locator, resolved');
  assert.deepEqual(of('people'), ['Ama'], 'each person once; the crowd\'s walkers are not people to find');
  assert.deepEqual(of('temple'), ['outside the Well-House', 'inside the door', 'the fires far room', 'the gadget\'s chest', 'the guardian\'s arena']);
  const mark = pts.find((p) => p.label === 'the fires far room');
  assert.ok(mark.room && mark.exact, 'a room\'s mark: in the temple, landed on as it is');
  assert.ok(!pts.find((p) => p.label === 'outside the Well-House').room);
  const arena = pts.find((p) => p.label === 'the guardian\'s arena');
  assert.ok(arena.room && Math.hypot(arena.pos[0], arena.pos[2] - 40) > 6, 'at the arena\'s edge, not on the guardian');
  assert.deepEqual(of('shop'), ['outside Chimes & Cures', 'Chimes & Cures: the counter']);
  assert.deepEqual(pts.find((p) => p.label === 'outside Chimes & Cures').pos, [-40, 0, 3], 'where its way out lands');
  assert.ok(pts.find((p) => p.label === 'Chimes & Cures: the counter').room);
  assert.deepEqual(of('sight'), ['the cairn', 'the mast', 'the stones: its start']);
  assert.deepEqual(pts.find((p) => p.label === 'the mast').pos, [60, 0, 0], 'a beacon: at its foot');
  assert.deepEqual(of('place'), ['the cave mouth', 'the cave mouth: inside', 'the well top'], 'the doors in (not the ways out, not the shop\'s), the story\'s goal');
  assert.ok(pts.find((p) => p.label === 'the cave mouth: inside').room, 'a room off the map');
  assert.deepEqual(of('find'), ['box: glider'], 'the boxes (the relics went: issue #732)');
  assert.deepEqual(groupPoints(pts).map((g) => g.key), KINDS.map(([k]) => k).filter((k) => k !== 'run'), 'in KINDS\' order, the empty kinds left out');
});

test('the runs: a world\'s trial and makers\' runs come from their own tables', () => {
  const pts = gatherPoints({ levelId: 'desert', level: {} });
  assert.ok(pts.some((p) => p.kind === 'run' && /^trial: /.test(p.label)));
  assert.ok(pts.some((p) => p.kind === 'run' && /^makers' run: /.test(p.label)));
  assert.ok(pts.some((p) => p.kind === 'place' && p.label === 'the giant'), 'the desert\'s named places (src/desert-sites.js)');
  assert.ok(!pts.some((p) => p.label === 'the cave'), 'not the cave\'s origin, far overhead: its door takes you in');
});

test('a teleport sets you on the ground near the point, out of a doorway\'s disc, with room to stand', () => {
  const scene = new THREE.Scene();
  const box = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y, z); scene.add(m); };
  box(200, 1, 200, 0, -0.5, 0);    // the floor, its top at 0
  box(6, 0.4, 6, 40, 10.2, 0);     // a slab at 10.4, over the floor
  box(4, 1, 4, -30, 1.95, 0);      // a low ceiling at 1.45 over the floor
  const physics = new Physics(scene, null);
  // on the floor, as it is
  let s = landingSpot(physics, { pos: [5, 0, 5] });
  assert.ok(s.ok); assert.deepEqual(s.pos.map((v) => +v.toFixed(2)), [5, 0.05, 5]);
  // a point with no height: whatever is under it
  s = landingSpot(physics, { pos: [40, null, 0] });
  assert.ok(s.ok && Math.abs(s.pos[1] - 10.45) < 0.01, 'on the slab');
  // a doorway's disc: set down beside it (it would send you through), facing the point
  const portals = [{ at: V(0, 0, 20), r: 1.5 }];
  s = landingSpot(physics, { pos: [0, 0, 20] }, { portals });
  assert.ok(s.ok && Math.hypot(s.pos[0], s.pos[2] - 20) > 2.9, 'out of the disc');
  assert.ok(Number.isFinite(s.heading));
  // no room to stand under the low ceiling: beside it
  s = landingSpot(physics, { pos: [-30, 0, 0] });
  assert.ok(s.ok && (Math.abs(s.pos[0] + 30) > 2 || Math.abs(s.pos[2]) > 2), 'clear of the ceiling');
  // in the air: the floor under it
  s = landingSpot(physics, { pos: [-60, 30, -60] });
  assert.ok(s.ok && Math.abs(s.pos[1] - 0.05) < 0.01);
  // an exact spot (a mark in a room) is taken as it is, on its floor
  s = landingSpot(physics, { pos: [7, 0.5, 7], exact: true, heading: 1 });
  assert.deepEqual([s.ok, +s.pos[0].toFixed(2), +s.pos[1].toFixed(2), s.heading], [true, 7, 0.05, 1]);
  // nothing anywhere near, or only under the world's floor: not ok (main.js says so and stays)
  assert.equal(landingSpot(physics, { pos: [500, 0, 500] }).ok, false);
  assert.equal(landingSpot(physics, { pos: [5, 0, 5] }, { killY: 5 }).ok, false);
});

test('the quest jump: the stages before it count as done (their flags, as the debug save sets them), the ones after it not', () => {
  const { quests, game } = miniWorld();
  const def = quests.def('mini.main');
  assert.deepEqual(questJump(def, 'go'), { 'mini.talked': undefined, 'mini.lever': undefined, 'quest.mini.main': 'go' });
  assert.deepEqual(questJump(def, 'lever'), { 'mini.talked': true, 'mini.lever': undefined, 'quest.mini.main': 'lever' });
  assert.deepEqual(questJump(def, 'done'), { 'mini.talked': true, 'mini.lever': 2, 'quest.mini.main': 'done' }, 'a stage\'s own value');
  assert.throws(() => questJump(def, 'nope'));
  // in the game: the flags, then the stage through quests.set (its hooks run, it is tracked)
  let entered = 0;
  def.stages[2].onEnter = () => entered++;
  applyQuestJump(quests, game, 'mini.main', 'lever');
  assert.equal(game.flag('quest.mini.main'), 'lever');
  assert.equal(game.flag('mini.talked'), true);
  assert.equal(entered, 1, 'the stage\'s own hook ran');
  assert.equal(game.flag('quest.tracked'), 'mini.main');
  // back to an earlier stage: the later flags cleared, so it doesn't move straight on
  applyQuestJump(quests, game, 'mini.main', 'go');
  assert.equal(game.flag('quest.mini.main'), 'go');
  assert.equal(game.flag('mini.talked'), undefined);
  // done, and out of failed (set() alone keeps a failed quest failed)
  applyQuestJump(quests, game, 'mini.main', 'done');
  assert.equal(game.flag('quest.mini.main'), 'done');
  assert.equal(game.flag('mini.lever'), 2);
  quests.fail('mini.main'); game.set('quest.mini.main', 'failed');
  applyQuestJump(quests, game, 'mini.main', 'talk');
  assert.equal(game.flag('quest.mini.main'), 'talk');
  // the list the menu draws: this world's quests, main first, where each stands now
  assert.deepEqual(questList(quests, 'mini').map((q) => [q.id, q.main, q.now, q.stages.length]), [['mini.main', true, 'talk', 4]]);
});

test('the cinematics: each of this world\'s on the Cinematics page, how it plays; the ship\'s only with the ship', () => {
  // (by the world a part's moments and boxes play in: Vael carries the sky stones'; a dismissed world's are not played)
  for (const part of Object.keys(WORLD_MOMENTS).filter((w) => !isDismissed(w))) {
    const world = partOf(part);
    const films = cinematicsFor(world);
    for (const m of WORLD_MOMENTS[part]) assert.equal(films.find((e) => e.id === m.id)?.how, 'here', `${world}: ${m.id} played in place`);
    for (const b of PLACEMENTS[part] ?? []) assert.ok(films.some((e) => e.id === `box.${b.id}`), `${world}: the box ${b.id}`);
    assert.equal(films.find((e) => e.id === `arrival.${world}`)?.how, 'reload', 'an arrival: the world again, by ship');
    assert.ok(films.some((e) => e.id === 'takeoff') && films.some((e) => e.id === 'call.1'), 'the ship\'s recordings and takeoff');
    assert.ok(!films.some((e) => e.id === 'trailer'));
    assert.ok(films.every((e) => e.world === world || e.id.startsWith('call.') || e.id === 'takeoff'), 'nothing of another world');
  }
  assert.equal(cinematicsFor('desert').find((e) => e.id === 'prologue')?.how, 'page', 'the prologue: on the Cinematics page');
  assert.ok(!cinematicsFor('desert', { ship: false }).some((e) => e.id.startsWith('call.') || e.id === 'takeoff'));
  // the list is the review page's: nothing invented
  assert.ok(cinematicsFor('arzach').every((e) => CINEMATICS.some((c) => c.id === e.id)));
});

test('the tabs: World, Cheats, a tab a kind, the cinematics, the quests with the save warning, Notes, Toggles, then the old dev menu\'s; each row says what it does', () => {
  const { w, quests } = miniWorld();
  const pts = gatherPoints(w);
  const tabs = devTabs({ world: 'Mini', points: pts, films: cinematicsFor('desert'), quests: questList(quests, 'mini'), toggles: { hitboxes: true, god: false }, save: 'the debug save',
    notes: { paired: true }, items: [{ id: 'glider', name: 'Glider', kind: 'gear', on: true }], flags: [['prologue.done', 'Prologue done', false]], levels: [{ id: 'mini', title: 'Mini' }, { id: 'desert', title: 'The Desert' }], levelId: 'mini' });
  assert.deepEqual(tabs.map((t) => t.id), ['world', 'cheats', 'tp-landing', 'tp-quest', 'tp-people', 'tp-temple', 'tp-shop', 'tp-sight', 'tp-place', 'tp-find', 'films', 'quests', 'notes', 'toggles', 'items', 'story', 'travel']);
  assert.equal(tabs[0].title, 'Mini', 'the first tab: the world\'s name');
  assert.deepEqual(tabs[0].rows.map((r) => r.label), ['the ship', 'outside the Well-House', 'the mast'], 'its key places, few (the start and the well by the ship, the cairn by the mast: once)');
  for (const t of tabs) for (const r of t.rows) assert.ok(r.head || (r.act && r.act.do), `${t.id}: ${r.label} does something`);
  const kinds = tabs.filter((t) => t.id.startsWith('tp-'));
  assert.equal(kinds.reduce((n, t) => n + t.rows.length, 0), pts.length, 'every point on its kind\'s tab');
  assert.match(tabs.find((t) => t.id === 'quests').note, /changes the save being played \(the debug save\)/);
  assert.ok(tabs.find((t) => t.id === 'quests').rows.some((r) => r.act?.do === 'quest' && r.act.id === 'mini.main' && r.act.stage === 'done'));
  const cheats = tabs.find((t) => t.id === 'cheats').rows;
  assert.deepEqual(cheats.filter((r) => r.state !== undefined).map((r) => r.act.key), ['fps', 'god', 'potions', 'jets'], 'the readout and god mode first');
  const toggles = tabs.find((t) => t.id === 'toggles').rows;
  assert.equal(toggles.find((r) => r.act.key === 'hitboxes').state, true, 'the hitbox overlay: on, as it is');
  for (const d of ['heal', 'hour', 'picker', 'item', 'items', 'boxes', 'flag', 'complete', 'travel']) assert.ok(tabs.some((t) => t.rows.some((r) => r.act?.do === d)), d);
  assert.ok(tabs.find((t) => t.id === 'tp-temple').rows.some((r) => r.tag === 'room'), 'a room is tagged');
  assert.equal(tabs.find((t) => t.id === 'travel').rows.find((r) => r.act.id === 'mini').tag, 'here');
  // an engine without the page's rows: no films, no screenshot, no overlays, no Debug menu, no reload
  const eng = devTabs({ points: pts, films: cinematicsFor('desert'), quests: questList(quests, 'mini'), notes: { paired: true }, levels: [{ id: 'mini', title: 'Mini' }], caps: new Set(['quest']) });
  assert.ok(!eng.some((t) => t.id === 'films' || t.id === 'notes'));
  assert.ok(!eng.some((t) => t.rows.some((r) => ['film', 'shot', 'picker', 'page', 'reload'].includes(r.act?.do) || ['hitboxes', 'inputs', 'clock'].includes(r.act?.key))));
});

test('the key places: the ship, the start, the temples and the fight temple, then a few landmarks, from the world\'s own data', () => {
  const { w } = miniWorld();
  const fight = { name: 'The Sunken Hall', fightTemple: 'mini', markers: [{ level: 'mini', at: [100, null, 100], heading: 1 }] };
  const sign = { name: 'Rings', markers: [{ level: 'mini', at: [120, null, 0] }, { level: 'other', at: [0, null, 0] }] };
  const pts = gatherPoints({ ...w, games: [fight, sign] });
  assert.deepEqual(pts.filter((p) => p.label.startsWith('fight temple') || p.label.startsWith('game:')).map((p) => [p.kind, p.label, p.face]), [['temple', 'fight temple: The Sunken Hall', true], ['run', 'game: Rings', true]], 'a game\'s sign in this world only');
  assert.deepEqual(keyPlaces(pts, { near: 0 }).map((p) => p.label), ['the ship', 'the start', 'outside the Well-House', 'fight temple: The Sunken Hall', 'the well top', 'the mast', 'the cairn'], 'in that order');
  assert.equal(keyPlaces(pts, { near: 0, landmarks: 1 }).length, 5, 'a few landmarks at most');
  assert.deepEqual(keyPlaces(pts).map((p) => p.label), ['the ship', 'outside the Well-House', 'fight temple: The Sunken Hall', 'the mast'], 'a place within 30 m of one listed: left out');
  // two temples (a merged world's): each one's door
  const two = gatherPoints({ levelId: 'mini', level: { temples: [{ def: { name: 'A' }, doorOut: V(1, 0, 1) }, { def: { name: 'B' }, doorOut: V(9, 0, 9) }] } });
  assert.deepEqual(keyPlaces(two).map((p) => p.label), ['outside A', 'outside B']);
  // a thing to look at: set down off it, facing it
  const scene = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(200, 1, 200)); floor.position.y = -0.5; scene.add(floor);
  const physics = new Physics(scene, null);
  const s = landingSpot(physics, pts.find((p) => p.label === 'game: Rings'));
  const dx = s.pos[0] - 120, dz = s.pos[2];
  assert.ok(s.ok && Math.hypot(dx, dz) > 3, 'off the sign');
  assert.ok(Math.abs(Math.atan2(Math.sin(s.heading - Math.atan2(-dx, -dz)), Math.cos(s.heading - Math.atan2(-dx, -dz)))) < 1e-6, 'facing it');
});

// the controller: both sticks open it in play and close it in a menu; R3 alone still locks on, L3 alone runs
function virtualPad(ctx) {
  const pad = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const actions = [];
  const c = new Controller({ pads: () => [pad], context: () => ctx, action: (a) => actions.push(a), look() {}, navigate() {}, scroll() {} });
  const set = (i, d) => { pad.buttons[i] = { pressed: d, value: +d }; };
  return { c, set, actions };
}
test('L3 + R3 opens the dev menu (in play, riding) and closes it (in the menu), and never locks on', () => {
  const dt = 1 / 60;
  for (const ctx of ['game', 'ride', 'menu']) {
    const { c, set, actions } = virtualPad(ctx);
    set(10, true); c.update(dt); set(11, true); c.update(dt); set(10, false); set(11, false); c.update(dt);
    assert.equal(actions.filter((a) => a === 'worldDebug').length, 1, `${ctx}: once`);
    assert.ok(!actions.includes('lock') && !actions.includes('hitboxes'), ctx);
    // the other order
    actions.length = 0; set(11, true); c.update(dt); set(10, true); c.update(dt); set(10, false); set(11, false); c.update(dt);
    assert.equal(actions.filter((a) => a === 'worldDebug').length, 1, `${ctx}: R3 then L3`);
  }
  const { c, set, actions } = virtualPad('game');
  set(11, true); c.update(dt); set(11, false); c.update(dt);
  assert.deepEqual(actions, ['lock'], 'R3 alone still locks on');
  assert.equal(BINDINGS.foot.find(([b]) => b === 'L3 + R3')[1].includes('the dev menu'), true, 'the layout\'s table says so');
});

test('the game opens it on L3 + R3, F2 and ` (F4 keeps the hitboxes), with the cinematics staged as the review page stages them', () => {
  const main = src('src/main.js'), dm = src('src/dev-menu.js');
  assert.match(main, /name === 'worldDebug'[^\n]*devMenu\.toggle\(\)/);
  assert.match(dm, /e\.code === 'F2' \|\| e\.code === 'Backquote'/);
  assert.match(main, /e\.code === 'F4'[^\n]*toggleHitboxes/);
  assert.match(main, /devMenu\.open \? devMenu\.el :/, 'the controller\'s menu root: B, LB / RB, A reach it');
  assert.match(main, /const busy = \(\) =>[^\n]*devMenu\.open/, 'the world waits while it is open');
  assert.match(src('src/cinematics-page/runtime.js'), /export async function stageCinematic\(w, e\)/);
  assert.match(src('src/cinematics-page/runtime.js'), /const ok = await stageCinematic\(w, e\);/, 'the review page plays them through the same staging');
  // F2 was free: no other key of the game's is on it
  assert.ok(!/code === 'F2'/.test(main));
});
