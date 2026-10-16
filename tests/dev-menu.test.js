// The dev menu (src/dev-menu.js, issue #387; docs/systems/dev-tools.md "The dev menu"): one menu on L3 + R3, F2 or `,
// the game paused under it; its tabs turned with LB / RB and its rows gone through (DevNav), the old dev menu's acts
// in it, god mode (src/player.js GOD: flying, through walls, nothing hurts) and its safe landing (godLanding), and the
// engines' sheet of the same tabs (engine/menus.js 'dev', BridgeMenu.cs). What it gathers and the tabs it makes from a
// world: tests/world-debug.test.js; every route world's key places landed on: tests/world-debug-worlds.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player, GOD, JET } from '../src/player.js';
import { DevNav, devTabs, godLanding, tabWindow } from '../src/world-debug.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const { DevMenu, STORY_FLAGS, TAB_STRIP, verb } = await import('../src/dev-menu.js');
const { EngineMenus } = await import('../engine/menus.js');

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const POINTS = [
  { kind: 'landing', label: 'the ship', pos: [0, 0, 0], key: 'ship', heading: 1 },
  { kind: 'temple', label: 'outside the Well-House', pos: [40, 0, 0], key: 'temple' },
  { kind: 'people', label: 'Ama', pos: [5, 0, 5] },
];
const menu = (o = {}) => {
  const acts = [];
  const dev = new DevMenu({ levelId: 'mini', levels: [{ id: 'mini', title: 'Mini' }, { id: 'desert', title: 'The Desert' }], doc: null,
    world: () => ({ world: 'Mini', points: POINTS, toggles: o.toggles ?? {} }), onAct: (a) => acts.push(a), onTravel: (id) => acts.push({ travelled: id }), ...o });
  return { dev, acts };
};

test('one menu: World first (its name, its key places), then Cheats, a tab a kind, Toggles, Items, Story, Travel', () => {
  const { dev } = menu();
  dev.toggle(true);
  assert.equal(dev.open, true);
  assert.deepEqual(dev.tabs.map((t) => t.id), ['world', 'cheats', 'tp-landing', 'tp-people', 'tp-temple', 'toggles', 'items', 'story', 'travel']);
  assert.equal(dev.tab.title, 'Mini');
  assert.deepEqual(dev.tab.rows.map((r) => r.label), ['the ship', 'outside the Well-House']);
  assert.deepEqual(dev.tabs[1].rows.slice(0, 2).map((r) => r.act.key), ['fps', 'god'], 'Cheats: the frame readout and god mode first');
  // the old dev menu's: every item a switch, the boxes, the story's switches, every world
  const it = dev.tabs.find((t) => t.id === 'items');
  assert.equal(it.rows.filter((r) => r.act.do === 'item').length, Object.keys(ITEMS).length);
  const story = dev.tabs.find((t) => t.id === 'story');
  assert.deepEqual(story.rows.filter((r) => r.act.do === 'flag').map((r) => r.act.key), STORY_FLAGS.map(([k]) => k));
  assert.ok(story.rows.some((r) => r.act.do === 'boxes' && r.act.open) && story.rows.some((r) => r.act.do === 'boxes' && !r.act.open) && story.rows.some((r) => r.act.do === 'complete'));
  assert.deepEqual(dev.tabs.at(-1).rows.filter((r) => r.act.do === 'travel').map((r) => r.act.id), ['mini', 'desert']);
  dev.toggle(false);
  assert.equal(dev.open, false);
});

test('LB / RB turn the tabs (round), up / down the rows (round, over the headings), each tab keeps its row', () => {
  const tabs = devTabs({ points: POINTS, quests: [{ id: 'q', title: 'Q', main: true, now: null, stages: [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }] }] });
  const n = new DevNav().fit(tabs);
  assert.equal(n.tab, 0);
  n.turn(tabs, -1);
  assert.equal(tabs[n.tab].id, 'story', 'LB on the first: the last');
  n.turn(tabs, 1); n.step(tabs, 1);
  assert.equal(n.row, 1);
  n.turn(tabs, 1); n.turn(tabs, -1);
  assert.equal(n.row, 1, 'back on the row it was left at');
  n.step(tabs, 1);
  assert.equal(n.row, 0, 'round');
  n.show(tabs, 'quests');
  assert.ok(!tabs[n.tab].rows[n.row].head, 'never on a heading');
  for (let i = 0; i < 8; i++) { n.step(tabs, 1); assert.ok(!tabs[n.tab].rows[n.row].head); }
  assert.ok(['quest', 'reload'].includes(n.current(tabs).act.do), 'a stage, or the reload above them');
  // the strip: five tabs round the open one
  assert.deepEqual(tabWindow(17, 0, 5), [0, 5]);
  assert.deepEqual(tabWindow(17, 8, 5), [6, 11]);
  assert.deepEqual(tabWindow(17, 16, 5), [12, 17]);
  assert.deepEqual(tabWindow(3, 1, 5), [0, 3]);
  assert.equal(TAB_STRIP, 5);
});

test('A / × does the row: the world\'s go to the host, the old dev menu\'s are its own (items, boxes, the story, travel)', () => {
  game.reset();
  const { dev, acts } = menu();
  dev.toggle(true);
  dev.choose();
  assert.deepEqual(acts.map((a) => [a.do, a.point?.label]), [['tp', 'the ship']], 'a teleport, handed over');
  assert.equal(verb(dev.nav.current(dev.tabs)), 'Teleport');
  dev.turn(1); dev.move(1);
  assert.equal(dev.nav.current(dev.tabs).act.key, 'god');
  dev.choose();
  assert.deepEqual(acts.at(-1), { do: 'toggle', key: 'god' });
  // the items: one on and off, all, none
  dev.nav.show(dev.tabs, 'items');
  dev.act({ do: 'item', id: 'glider' });
  assert.equal(items.has('glider'), true);
  assert.equal(dev.tab.rows.find((r) => r.act.id === 'glider').state, true, 'drawn again with its state');
  dev.act({ do: 'item', id: 'glider' });
  assert.equal(items.has('glider'), false);
  dev.act({ do: 'items', all: true });
  assert.deepEqual(items.owned().sort(), Object.keys(ITEMS).sort());
  dev.act({ do: 'boxes', open: false });
  assert.deepEqual(items.owned(), [], 'reset boxes takes the items back');
  dev.act({ do: 'flag', key: 'prologue.done' });
  assert.equal(game.flag('prologue.done'), true);
  dev.act({ do: 'complete' });
  assert.equal(game.flag('world.mini.done'), true);
  dev.act({ do: 'travel', id: 'desert' });
  assert.deepEqual(acts.at(-1), { travelled: 'desert' });
  assert.equal(dev.open, false, 'travel closes it');
  game.reset();
});

test('the game: L3 + R3, F2 and ` open it, it pauses the world as the other menus do, and the old panel is gone', () => {
  const main = src('src/main.js'), dm = src('src/dev-menu.js'), ui = src('src/ui.js');
  assert.match(main, /const paused = \(\) =>[^\n]*devMenu\.open/, 'paused: frame() skips the world, the menu music plays');
  assert.match(main, /const panels = \[menu, journal, changelog, devMenu\];/, 'one full-screen menu at a time');
  assert.match(main, /name === 'worldDebug' && \(devMenu\.open \|\| !busy\(\)/);
  assert.match(main, /root === devMenu\.el\) devMenu\.pad\('navigate', x, y\)/, 'the pad\'s directions');
  assert.match(main, /menuRoot\(\) === devMenu\.el\) devMenu\.pad\(name\)/, 'LB / RB');
  assert.match(main, /root === devMenu\.el\) devMenu\.pad\('confirm'\)/, 'A / ×');
  assert.match(main, /class="devopen">dev menu</, 'a touch screen opens it from the Debug menu');
  assert.match(dm, /e\.code === 'F2' \|\| e\.code === 'Backquote'/);
  assert.match(dm, /className = 'gamemenu'/, 'drawn in the game menu\'s frame');
  assert.match(src('src/game-menu.css'), /:is\(#journal, #devmenu\) \.gm-tabs \{/, 'the same tab strip');
  assert.ok(!/WorldDebugMenu|#wdebug/.test(main + src('src/world-picker.css')), 'the world debug menu\'s page is gone');
  assert.ok(!/data-a="dev"|onDev/.test(ui), 'the settings\' button to the old panel is gone');
  assert.ok(!/<h1>DEV MENU|const CSS = /.test(dm), 'the old panel\'s DOM and CSS are gone');
  // god mode is never saved, takes no doorway, and the triggers are its own
  assert.match(main, /const writeSave = \(\) => [^\n]*!player\.god/);
  assert.match(main, /!player\.god && level\.portals/);
  assert.match(src('engine/game.js'), /player\.dead \|\| player\.god \|\| \(shipOn && ship\.playing\)/, 'nor in the engines');
});

// a floor, a wall across the way and a slab over the floor
function ground() {
  const scene = new THREE.Scene();
  const box = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y, z); scene.add(m); };
  box(400, 1, 400, 0, -0.5, 0);    // the floor, its top at 0
  box(40, 30, 2, 0, 15, -20);      // a wall 30 m high across -z
  box(10, 1, 10, 60, 7.5, 0);      // a slab, its top at 8
  box(20, 20, 20, -60, 10, 0);     // a solid block, 0..20
  return new Physics(scene, null);
}
const run = (p, secs, input = {}, yaw = 0) => { for (let i = 0; i < secs * 60; i++) p.update(1 / 60, input, yaw); };

test('god mode: fast, several times the jets, up and down on the triggers, a boost, through walls, nothing hurts', () => {
  assert.ok(GOD.speed >= 3 * JET.speed && GOD.boost > 1, 'several times the jets\' speed, and a boost');
  const physics = ground();
  const p = new Player(physics, {});
  p.teleport(V(0, 0.05, 0), V(0, 1, 0), V(0, 0, 1));
  run(p, 0.5);
  p.setGod(true);
  // up on RT (PadFire), then forward (camera yaw 0: the stick forward goes -z) straight through the wall
  run(p, 1, { PadFire: true });
  assert.ok(p.pos.y > 20, `up on the trigger: ${p.pos.y.toFixed(1)}`);
  const y0 = p.pos.y;
  run(p, 0.5, { PadAim: true });
  assert.ok(p.pos.y < y0 - 5, 'down on the other');
  p.pos.y = 5; p.vel.set(0, 0, 0);
  run(p, 1, { KeyW: true });
  assert.ok(p.pos.z < -30, `through the wall: z ${p.pos.z.toFixed(1)}`);
  const slow = -p.pos.z;
  p.pos.set(0, 5, 0); p.vel.set(0, 0, 0);
  run(p, 1, { KeyW: true, ShiftLeft: true });
  assert.ok(-p.pos.z > 2.5 * slow, `boost: ${(-p.pos.z).toFixed(0)} m against ${slow.toFixed(0)}`);
  // nothing hurts, nothing knocks him down, he stays up
  const h = p.hearts;
  p.hurt(2, 'foe');
  assert.equal(p.hearts, h);
  assert.equal(p.knockDown(V(0, -40, 0), { dead: true }), false);
  p.pos.set(0, 50, 0); p.vel.set(0, 0, 0);
  run(p, 1);
  assert.ok(Math.abs(p.pos.y - 50) < 1, 'no gravity: hovering');
  assert.equal(p.god, true, 'on until turned off');
});

test('god mode let go: set down on the ground under you, a slab under you, out of a solid, never in the air', () => {
  const physics = ground();
  const at = (x, y, z) => godLanding(physics, V(x, y, z));
  let s = at(20, 40, 20);
  assert.ok(s.ok && Math.abs(s.pos[1] - 0.05) < 0.01 && Math.hypot(s.pos[0] - 20, s.pos[2] - 20) < 0.01, 'straight down onto the floor');
  s = at(60, 30, 0);
  assert.ok(s.ok && Math.abs(s.pos[1] - 8.05) < 0.01, 'onto the slab under you');
  s = at(-60, 10, 0);
  assert.ok(s.ok && Math.abs(s.pos[1] - 20.05) < 0.01, 'inside the block: on its top');
  s = at(20, 2000, 20);
  assert.ok(s.ok && Math.abs(s.pos[1] - 0.05) < 0.01, 'from very high');
  assert.equal(at(5000, 10, 5000).ok, false, 'nothing under you: not ok (the game puts you back where you last stood)');
  // the player off it, on his feet
  const p = new Player(physics, {});
  p.teleport(V(20, 40, 20), V(0, 1, 0), V(0, 0, 1));
  p.setGod(true); p.setGod(false);
  p.teleport(V(...godLanding(physics, p.pos).pos), V(0, 1, 0), V(0, 0, 1));
  run(p, 0.5);
  assert.ok(p.onGround && Math.abs(p.pos.y) < 0.1 && p.god === false);
});

test('the engines: the same tabs on the game menu\'s sheet (kind game, panel dev), LB / RB, A / ×, B / ○, F2 closes', () => {
  const { dev, acts } = menu();
  const m = new EngineMenus({ settings: null });
  assert.equal(m.openDev(dev), true);
  assert.equal(m.mode, 'dev');
  let v = m.view();
  assert.equal(v.kind, 'game');
  assert.equal(v.panel, 'dev');
  assert.deepEqual(v.tabs.names, dev.tabs.slice(0, TAB_STRIP).map((t) => t.name));
  assert.equal(v.tabs.i, 0);
  assert.deepEqual(v.rows.map((r) => r[0].text), ['the ship', 'outside the Well-House']);
  assert.equal(v.rows[0][0].on, true);
  assert.equal(v.strip.act, 'Teleport');
  m.action('tabNext');
  v = m.view();
  assert.equal(v.tabs.i, 1);
  assert.equal(v.rows[1][0].val, 'OFF', 'a switch\'s state at its right');
  m.navigate(0, 1);
  m.action('confirm');
  assert.deepEqual(acts.at(-1), { do: 'toggle', key: 'god' });
  // past the strip's end: the window moves with the open tab
  for (let i = 0; i < 4; i++) m.action('tabNext');
  v = m.view();
  assert.equal(v.tabs.names[v.tabs.i], dev.tabs[5].name);
  m.key('F2');
  assert.equal(m.open, false, 'F2 closes it, as it opened');
  assert.equal(dev.open, false);
  m.openDev(dev); m.action('back');
  assert.equal(m.open, false);
  m.openDev(dev); m.action('worldDebug');
  assert.equal(m.open, false, 'L3 + R3 again');
  // the engine opens it on L3 + R3, F2, ` and carries out its world rows
  const g = src('engine/game.js');
  assert.match(g, /if \(name === 'worldDebug'\) \{ openDev\(\); return; \}/);
  assert.match(g, /code === 'F2' \|\| code === 'Backquote'\)\) openDev\(\)/);
  assert.match(g, /new DevMenu\(\{ levelId, levels: LEVELS,/);
  for (const d of ["a.do === 'tp'", "a.key === 'god'", "a.key === 'fps'", "a.do === 'quest'"]) assert.ok(g.includes(d), d);
  // BridgeMenu draws the panel's rows, and the keys reach the script
  const cs = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.cs'), host = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs');
  assert.match(cs, /if \(panel == "dev"\)/);
  assert.match(host, /\{ Key\.F2, "F2" \}, \{ Key\.Backquote, "Backquote" \}/);
});
