// The house's map (issue #405, recommendation G5 of docs/design/temple-best-practices.md; src/house-map.js,
// src/temples/house-plan.js): a little chest in every makers' house holds its map, off the way on in the first third of
// the house; the Start menu's House map shows the house floor by floor from its own plan (the rooms stood in solid, the
// rest faint once the map is yours, none before), the traveller, the doors and the guardian's; what is seen is saved.
// The scout's ping is as it was: it never points at the map's chest. The engines' menus (engine/menus.js) show the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import './playthrough-agent.js';   // (its little DOM: a temple's pieces draw their glyphs on a canvas)
import * as THREE from 'three';
import { TEMPLES } from '../src/temples/index.js';
import { solve, TempleLogic, memoryStore } from '../src/temples/logic.js';
import { MapChest, MAP_CHEST } from '../src/temples/pieces.js';
import { buildTemple } from '../src/temple-maps/record.js';
import { MAKERS, makersMap, carriedInto } from '../src/temple-maps/makers.js';
import { housePlan, roomAt, floorsOf } from '../src/temples/house-plan.js';
import { houseView, houseHere, floorTabs, shapeState, drawHouseMap, HouseMapPage, HOUSE_MAP, mapElement, seenRooms, floorLabel } from '../src/house-map.js';
import { PixelCanvas } from '../engine/raster.js';
import { parseLine, TONES } from '../src/story/tone.js';
import { meetsWith } from '../src/resources.js';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const { EngineMenus, HOUSE_SIDE, START_SIDE } = await import('../engine/menus.js');

const memGame = () => { const flags = {}; const ev = []; return { flags, ev, flag: (k) => flags[k], set: (k, v) => { flags[k] = v; }, emit: (e, p) => ev.push([e, p]), on: () => () => {} }; };
const built = new Map();
const build = (id) => { if (!built.has(id)) built.set(id, buildTemple(TEMPLES[id].def)); return built.get(id); };

test('a map chest in every makers\' house: one, early (the first third), off the way on (an extra the house solves without), taken by the solver', () => {
  assert.equal(MAKERS.length, 14);
  for (const id of MAKERS) {
    const logic = TEMPLES[id].def.logic, E = logic.elements;
    const maps = Object.entries(E).filter(([, e]) => e.type === 'map');
    assert.equal(maps.length, 1, `${id}: one map chest`);
    const [mid, me] = maps[0];
    assert.equal(mapElement(logic), mid);
    assert.ok(logic.rooms[me.room], `${id}: its room (${me.room}) is one of the house's`);
    assert.ok(Array.isArray(me.at) && me.at.length === 3, `${id}: where it stands`);
    assert.ok(!logic.rooms[me.room].boss && me.room !== logic.entry, `${id}: not in the way in nor the guardian's hall`);
    // the solver opens it, and the house solves without it (nothing waits on it)
    const items = carriedInto(id);
    const S = solve(logic, { items });
    assert.ok(S.done && S.log.includes(`take ${mid}`), `${id}: solved, the map taken on the way`);
    assert.ok(solve(logic, { items, forbid: [mid] }).done, `${id}: solved without it`);
    // the Temple maps page: an extra, never a step; in the first third of the house's stages
    const m = makersMap(id, { sight: false, built: build(id) });
    assert.ok(m.extras.some((x) => x.element === mid), `${id}: the page lists it as an extra`);
    const stage = m.rooms.find((r) => r.id === me.room).stage, last = Math.max(...m.rooms.map((r) => r.stage));
    assert.ok(stage >= 0 && stage <= Math.ceil(last / 3), `${id}: early (stage ${stage} of ${last})`);
    // off the way on: no step's walk passes within 5 m of it
    // (where the page's solution goes to it, the Warden's Well's, which lists its extras among its steps: not that walk)
    const at = (p) => Math.hypot(p[0] - me.at[0], p[1] - me.at[1], p[2] - me.at[2]) < 0.6;
    const near = Math.min(...m.steps.filter((s) => s.element !== mid).flatMap((s) => s.path.slice(1).map((p, i) => (at(p) || at(s.path[i]) ? Infinity : segDist(me.at, s.path[i], p)))));
    assert.ok(near > 5, `${id}: off the way on (${near.toFixed(1)} m from the solution's walk)`);
  }
});
function segDist(p, a, b) {
  const dx = b[0] - a[0], dz = b[2] - a[2], L2 = dx * dx + dz * dz || 1;
  const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / L2));
  return Math.hypot(p[0] - a[0] - dx * k, p[2] - a[2] - dz * k) + (Math.abs(p[1] - (a[1] + (b[1] - a[1]) * k)) > 3 ? 100 : 0);
}

test('the scout\'s ping is as it was: logic.next never points at the map\'s chest, the whole way through', () => {
  for (const id of MAKERS) {
    const logic = TEMPLES[id].def.logic, items = new Set(carriedInto(id));
    const L = new TempleLogic(logic, { store: memoryStore(), has: (i) => meetsWith((x) => items.has(x), i) });
    let n = 0;
    solve(logic, { items: [...items], each: (l) => { n++; assert.notEqual(l.next(), mapElement(logic), `${id}: the scout never sends you to the map`); } });
    L.update();
    assert.notEqual(L.next(), mapElement(logic));
    assert.ok(n > 3);
  }
});

test('the map chest: a little makers\' chest with a rolled map, opened it is yours (saved), says so in a toned line, never counted with the keys', () => {
  const { rt } = build('desert');
  const chest = rt.pieces.find((p) => p instanceof MapChest);
  assert.ok(chest && chest.id === 'map');
  assert.equal(chest.flying, false);
  const { tone, text } = parseLine(MAP_CHEST.line);
  assert.ok(TONES.includes(tone) && tone !== 'neutral', 'a tone of its own');
  assert.ok(text.length < 60 && !/~/.test(text), `short (${text})`);
  const said = [], events = [];
  rt.toast = (x) => said.push(x);
  const emit = rt.game.emit;
  rt.game.emit = (e, p) => { events.push(e); return emit?.call(rt.game, e, p); };
  try {
    assert.equal(rt.logic.isFound('map'), false);
    assert.ok(chest.openIt(), 'opened');
    assert.ok(rt.logic.isFound('map'), 'the map is yours (temple.<id>.found.map)');
    assert.ok(events.includes('temple:map') && !events.includes('temple:key'));
    for (let t = 0; t < 3; t += 1 / 30) chest.update(1 / 30, t);
    assert.deepEqual(said, [text], 'its line, the tone left off');
    assert.equal(rt.keyCount().small, 0, 'not a key');
  } finally { rt.game.emit = emit; }
});

test('the plan: floors from the rooms, every shape on one, rooms where they are; a point in a room is in that room', () => {
  assert.deepEqual(floorsOf([0, 0.4, 11, -24]).map((f) => f.name), ['down 24 m', 'ground floor', 'up 11 m']);
  for (const id of MAKERS) {
    const { rt } = build(id), plan = rt.housePlan();
    assert.equal(rt.housePlan(), plan, `${id}: read once`);
    assert.ok(plan.floors.length >= 1 && plan.shapes.length > 30, `${id}: a plan (${plan.shapes.length} shapes)`);
    const ids = new Set(plan.floors.map((f) => f.id));
    for (const s of plan.shapes) assert.ok(ids.has(s.floor) && s.room, `${id}: ${s.kind} on a floor, of a room`);
    for (const r of plan.rooms) assert.ok(ids.has(r.floor), `${id}: ${r.id} on a floor`);
    // the marks (each room's glyph stone): where you stand by one, you are in its room
    for (const m of rt.marks) {
      if (!rt.def.logic.rooms[m.room]) continue;
      const l = rt.kit.local(m.spot.clone());
      assert.equal(roomAt(plan, [l.x, l.y + 0.05, l.z]), m.room, `${id}: by the mark of ${m.room}`);
    }
    // the great key's door and the guardian's
    if (Object.values(rt.def.logic.elements).some((e) => e.lock === 'big')) assert.ok(plan.doors.some((d) => d.lock === 'big'), `${id}: the great key's door`);
    assert.ok(plan.doors.some((d) => d.guardian), `${id}: the guardian's door`);
    assert.ok(plan.rooms.some((r) => r.boss), `${id}: the guardian's hall`);
  }
  // the same plan the Temple maps page draws (its floors and shapes: the kit's chart, issue #396)
  const m = makersMap('incal', { sight: false, built: build('incal') });
  assert.deepEqual(m.floors, build('incal').rt.housePlan().floors);
});

test('rooms seen are kept (temple.<id>.been.<room>): before the map only they are drawn, after it the rest faint; the tabs are the floors', () => {
  const { rt } = build('incal'), plan = rt.housePlan();
  const game = memGame();
  rt.game = game;
  const P = { pos: new THREE.Vector3(), heading: 0 };
  // stood by the first marks: their rooms are seen (a few times a second)
  const walked = rt.marks.filter((m) => rt.def.logic.rooms[m.room]).slice(0, 3);
  for (const m of walked) { P.pos.copy(m.spot); rt.roomClock = 0; rt.trackRooms(0.3, P.pos); }
  for (const m of walked) assert.equal(game.flag(`temple.incal.been.${m.room}`), true, `${m.room} kept`);
  const seen = seenRooms(rt, game);
  for (const m of walked) assert.ok(seen.has(m.room));
  assert.ok(seen.has(plan.entry), 'the way in always');
  // before the map: only what was seen; the tabs only the floors seen on (and yours)
  let v = houseView(rt, { game, player: P });
  assert.equal(v.has, false);
  const unseen = plan.shapes.find((s) => s.kind === 'hall' && !seen.has(s.room));
  assert.equal(shapeState(unseen, v.seen, v.has, 'floor'), null, 'an unseen room: not drawn');
  assert.ok(v.floors.length < plan.floors.length, 'only the floors seen on');
  // the map found: every floor a tab, the unseen faint
  rt.logic.find('map');
  v = houseView(rt, { game, player: P });
  assert.equal(v.has, true);
  assert.deepEqual(v.floors.map((f) => f.id), plan.floors.map((f) => f.id), 'a tab a floor of the house');
  assert.equal(v.floors.length, 5, 'the Warden\'s Well: five floors');
  assert.deepEqual(v.floors.map((f) => f.label), ['1F', '2F', '3F', '4F', '5F']);
  assert.equal(shapeState(unseen, v.seen, v.has, 'floor'), 'faint');
  assert.equal(shapeState(plan.shapes.find((s) => s.kind !== 'wall' && seen.has(s.room)), v.seen, v.has, 'floor'), 'seen');
  assert.equal(v.here, plan.rooms.find((r) => r.id === walked.at(-1).room).floor, 'the floor you stand on');
  assert.ok(v.me && Number.isFinite(v.me.dx), 'you, and the way you face');
  // doors open and shut, from the house's logic
  assert.ok(v.doors.every((d) => d.open === rt.logic.isOpen(d.id)));
  assert.equal(floorLabel([{ id: 'f0', name: 'down 24 m' }, { id: 'f1', name: 'ground floor' }], 'f0'), 'B1');
});

test('the House map page: LB / RB a floor, held at the ends, back on yours each time it opens; drawn on a 2D canvas (the web\'s, the engines\')', () => {
  const { rt } = build('incal');
  const game = memGame();
  rt.game = game;
  rt.logic.find('map');
  const m = rt.marks.find((k) => k.room === rt.def.logic.entry);
  const v = houseView(rt, { game, player: { pos: m.spot.clone(), heading: 0 } });
  const page = new HouseMapPage();
  assert.equal(page.floor(v), v.here);
  assert.equal(page.turn(v, -1), false, 'no floor under the ground floor here');
  assert.ok(page.turn(v, 1) && page.turn(v, 1));
  assert.equal(page.floor(v), v.floors[2].id);
  for (let i = 0; i < 9; i++) page.turn(v, 1);
  assert.equal(page.floor(v), v.floors.at(-1).id, 'held at the top');
  page.reset(v);
  assert.equal(page.floor(v), v.here);
  // drawn: the paper, ink, the traveller's red arrow on his floor
  const c = new PixelCanvas(HOUSE_MAP.w, HOUSE_MAP.h);
  drawHouseMap(c.getContext('2d'), v, v.here);
  let red = 0, ink = 0;
  for (let i = 0; i < c.data.length; i += 4) {
    const [r, g, b] = [c.data[i], c.data[i + 1], c.data[i + 2]];
    if (r > 170 && g < 110 && b < 100) red++;
    if (r < 70 && g < 60 && b < 60) ink++;
  }
  assert.ok(red > 40, `the traveller drawn (${red} px)`);
  assert.ok(ink > 2000, `walls inked (${ink} px)`);
});

test('the engines\' Start menu: House map after Map inside a house only, its page a floor\'s picture by key, LB / RB a floor (engine/menus.js)', () => {
  const { rt } = build('incal');
  const game = memGame();
  rt.game = game;
  rt.logic.find('map');
  const m = rt.marks.find((k) => k.room === rt.def.logic.entry);
  let inside = true;
  const menus = new EngineMenus({ store: { list: () => [] }, house: () => (inside ? houseView(rt, { game, player: { pos: m.spot.clone(), heading: 0 } }) : null) });
  menus.show('start');
  let view = menus.view();
  const names = view.side.map((e) => e.text);
  assert.equal(names[names.indexOf(START_SIDE.find((e) => e.id === 'map').label()) + 1], HOUSE_SIDE.label(), 'after Map');
  // onto it: its page
  const at = names.indexOf(HOUSE_SIDE.label());
  for (let i = 0; i < at; i++) menus.navigate(0, 1);
  view = menus.view();
  const H = view.page.house;
  assert.ok(H, 'the House map page');
  assert.deepEqual(H.tabs, ['1F', '2F', '3F', '4F', '5F']);
  assert.equal(H.i, 0);
  const pic = menus.housePicture(H.key);
  assert.ok(pic && pic.width === HOUSE_MAP.w && pic.height === HOUSE_MAP.h && pic.data.length === HOUSE_MAP.w * HOUSE_MAP.h * 4, 'its picture');
  assert.match(view.hint, /LB \/ RB/);
  menus.action('tabNext');
  view = menus.view();
  assert.equal(view.page.house.i, 1, 'RB: the floor above');
  assert.notEqual(view.page.house.key, H.key, 'its own picture');
  menus.action('tabPrev');
  assert.equal(menus.view().page.house.i, 0);
  menus.close();
  // outside a house: no entry
  inside = false;
  menus.show('start');
  assert.ok(!menus.view().side.some((e) => e.text === HOUSE_SIDE.label()));
});

test('the traveller is inside a house: houseHere finds it; outside none', () => {
  const { rt } = build('desert');
  const m = rt.marks[0];
  assert.equal(houseHere({ temples: [rt] }, { pos: m.spot.clone() }), rt);
  assert.equal(houseHere({ temples: [rt] }, { pos: new THREE.Vector3(1e5, 0, 1e5) }), null);
  assert.equal(houseHere({}, { pos: m.spot.clone() }), null);
});

test('the plan is read from the kit\'s chart and pieces, nothing by hand (a made-up house)', () => {
  const logic = { entry: 'a', rooms: { a: {}, b: {}, c: { boss: true } }, links: [{ a: 'a', b: 'b', door: 'd1' }, { a: 'b', b: 'c', door: 'd2' }],
    elements: { d1: { type: 'door', opens: { lit: 's' }, lock: 'big' }, d2: { type: 'door', opens: null }, s: { type: 'switch', room: 'b' }, boss: { type: 'boss', room: 'c' } } };
  const chart = [{ kind: 'hall', x: 0, z: 0, w: 20, d: 20, y: 0, h: 10 }, { kind: 'hall', x: 0, z: 30, w: 20, d: 20, y: 0, h: 10 }, { kind: 'round', x: 0, z: 60, y: 12, r: 10, h: 10, t: 1.4, gaps: [] }, { kind: 'stairs', a: [0, 0, 42], b: [0, 12, 50], w: 4 }];
  const pieces = [{ cls: 'Mark', o: { room: 'a', at: [0, 0, 0] } }, { cls: 'Mark', o: { room: 'b', at: [0, 0, 30] } }, { cls: 'Door', o: { id: 'd1', at: [0, 0, 15] } }, { cls: 'Switch', o: { id: 's', at: [3, 0, 30] } }, { cls: 'Mark', o: { room: 'c', at: [0, 12, 55] } }];
  const plan = housePlan({ logic, chart, pieces, arena: [0, 12, 60] });
  assert.deepEqual(plan.floors.map((f) => f.name), ['ground floor', 'up 12 m']);
  assert.deepEqual(plan.shapes.map((s) => s.room), ['a', 'b', 'c', 'b']);
  assert.equal(plan.doors.find((d) => d.id === 'd1').lock, 'big');
  assert.ok(plan.doors.find((d) => d.id === 'd2').guardian, 'the door into the guardian\'s hall');
  assert.equal(roomAt(plan, [2, 0.1, 31]), 'b');
  assert.equal(roomAt(plan, [0, 12.1, 61]), 'c');
  assert.deepEqual(floorTabs(plan, new Set(['a']), false).map((f) => f.label), ['1F']);
  assert.deepEqual(floorTabs(plan, new Set(['a']), true).map((f) => f.label), ['1F', '2F']);
});
