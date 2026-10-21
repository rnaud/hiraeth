// Issue #430: every player-facing piece the page draws as its own HTML is published as a screen part too (src/platform.js
// screen), which the engines draw (BridgeHud.Parts.cs, BridgeMenu.cs): the speech balloons over people, the objective card,
// the breath meter, the brass level, the Arcade's board (the cargo check and the end card: tests/engine-finishable.test.js).
// Played in engine/game.js in a bare V8 context (the bundle the engines run), as tests/engine-games-hud.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const { EngineMenus } = await import('../engine/menus.js');
const { screen } = await import('../src/platform.js');
const { BreathMeter, breathShown } = await import('../src/water.js');
const { balloonData, pickBalloon, publishBalloons } = await import('../src/balloon-part.js');
const { ArcadeBoard, ARCADE_BOARD } = await import('../src/levels/arcade-board.js');

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const run = (g, frames, keys = {}) => quietly(() => { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 30); } });
const plain = (x) => JSON.parse(JSON.stringify(x ?? null));

let B = null;
async function load() {
  if (B) return B;
  const file = tempPath(join(tmpdir(), `hiraeth-engine-ui-parts-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  B = loadBundle(file, { pads: () => [] });
  return B;
}

test('a balloon as data: its words without the tone\'s tag, *highlights* kept, the point over the head, the lift (src/balloon-part.js)', () => {
  const b = balloonData('~happy~ The *well* is dry.', new THREE.Vector3(1.234, 2.5, -3), { lift: 30 });
  assert.deepEqual(b, { text: 'The *well* is dry.', at: [1.23, 2.5, -3], lift: 30, kind: '' });
  // the nearest who talks; a shout over a filmed moment, no greeting
  const me = { pos: new THREE.Vector3() };
  const a = { talking: true, pos: new THREE.Vector3(5, 0, 0), time: 0 }, c = { talking: true, pos: new THREE.Vector3(2, 0, 0), time: 0 }, d = { talking: false, pos: new THREE.Vector3(1, 0, 0) };
  assert.equal(pickBalloon([a, c, d], { player: me }), c);
  assert.equal(pickBalloon([a, c], { player: me, talk: false }), null);
  a.shout = { until: 3 };
  assert.equal(pickBalloon([a, c], { player: me, filming: true }), a);
  assert.equal(pickBalloon([a, c], { player: me, greet: false }), a);
  // published: every one up, or none
  publishBalloons([{ balloonUp: b }, { balloonUp: null }, null]);
  assert.deepEqual(plain(screen.state.balloons), [b]);
  publishBalloons([{ balloonUp: null }]);
  assert.equal(screen.state.balloons, null);
});

test('the breath meter as data: its bubbles, those left, null when down; shown under the same rule on the page and in the engines', () => {
  const m = new BreathMeter(null);
  m.update(0.5, true);
  assert.deepEqual(plain(screen.state.breath), { n: 8, full: 4 });
  m.update(0, true);
  assert.deepEqual(plain(screen.state.breath), { n: 8, full: 0 });
  m.update(1, false);
  assert.equal(screen.state.breath, null);
  assert.equal(breathShown({ swim: { under: true }, breath: 0.6 }, {}), true);
  assert.equal(breathShown({ swim: { under: true }, breath: 0.6 }, {}, true), false, 'not over a conversation or a menu');
  assert.equal(breathShown({ swim: { under: true, sea: true }, breath: 1 }, {}), false, 'a sea gives air');
  assert.equal(breathShown({ swim: null, breath: 1 }, {}), false);
});

test('the speech balloons over people in the engine: the nearest one\'s line over their head, as the page places its .balloon', async () => {
  const { exports: X } = await load();
  const g = await quietly(() => X.createGame({ levelId: 'desert', backend, menus: new EngineMenus({}) }));
  await run(g, 3);
  const n = g.npcs.find((p) => !p.pooled && p.def?.id === 'ama' && p.object?.visible);
  assert.ok(n, 'Ama is visible in the desert camp');
  g.player.pos.copy(n.pos).add(new THREE.Vector3(2.5, 0, 0));
  // Enter the camp first: its story update gives Ama a welcome shout. Inject the
  // balloon under test afterwards, so that legitimate entry cue cannot replace it.
  await run(g, 3);
  // Beside her, a shout (always shown: not a greeting).
  n.shout = { text: 'Over *here*!', until: n.time + 30 };
  let b = null;
  for (let i = 0; i < 30 && !b?.length; i++) { await run(g, 1); b = plain(g.screen().state.balloons); }
  assert.ok(b?.length, 'a balloon up');
  const mine = b.find((x) => x.text === 'Over *here*!');
  assert.ok(mine, JSON.stringify(b));
  assert.ok(mine.at.length === 3 && mine.at[1] > n.pos.y + 1.4, `over the head: ${mine.at} (they stand at ${n.pos.y.toFixed(2)})`);
  // the shout over: no balloon
  n.shout = null; n.greeted = 0;
  await run(g, 3);
  assert.ok(!(plain(g.screen().state.balloons) ?? []).some((x) => x.text === 'Over *here*!'), 'down again');
});

test('the objective card as the screen\'s part: the step, an id a card, gone after its time (cinema.objective)', async () => {
  const { exports: X } = await load();
  const g = await quietly(() => X.createGame({ levelId: 'desert', backend, menus: new EngineMenus({}) }));
  await run(g, 2);
  const C = g.ship?.cinema;
  assert.ok(C, 'the ship\'s cinema');
  C.objective('Follow the light to the stone');
  const o = plain(g.screen().state.objective);
  assert.deepEqual({ text: o?.text, secs: o?.secs }, { text: 'Follow the light to the stone', secs: 6.5 });
  C.objective('The ship is ready whenever you are');
  assert.ok(plain(g.screen().state.objective).id > o.id, 'a new card, a new id');
});

test('the brass level as the screen\'s part: the floor\'s line turned and raised where down has turned (src/boxes/effects.js)', async () => {
  const { createItemEffects } = await import('../src/boxes/effects.js');
  const { items } = await import('../src/items.js');
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(0, 2, 5); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  const up = new THREE.Vector3(1, 1, 0).normalize();
  const player = { frame: { up }, pos: new THREE.Vector3(), hidden: false, items: null };
  const had = items.has('level');
  items.grant('level');
  try {
    const fx = await quietly(() => createItemEffects({ player, camera: cam, keys: null }));
    await quietly(() => fx.update(1 / 30, 0));
    const l = plain(screen.state.level);
    assert.ok(l && Number.isFinite(l.roll) && Number.isFinite(l.dy), JSON.stringify(l));
    assert.ok(Math.abs(l.roll) > 10, `turned: ${l.roll}°`);
    up.set(0, 1, 0);
    await quietly(() => fx.update(1 / 30, 0));
    assert.equal(screen.state.level, null, 'down is down again: none');
  } finally { if (!had) items.revoke('level'); }
});

test('the Arcade\'s board in the engines\' menus: the games in a grid of rows, the pad moves, A plays the one chosen (engine/menus.js openArcade)', () => {
  const games = [{ id: 'a', name: 'Alpha', blurb: 'first', color: '#f00' }, { id: 'b', name: 'Beta', blurb: 'second' }, { id: 'c', name: 'Gamma', blurb: 'third' }, { id: 'd', name: 'Delta', blurb: 'fourth' }];
  const went = [];
  const board = new ArcadeBoard({ games, best: (g) => (g.id === 'b' ? '12' : ''), go: (h) => went.push(h), win: null, doc: null });
  const menus = new EngineMenus({ screen: () => ({ w: 1280, h: 720 }) });
  assert.ok(menus.openArcade(board));
  let v = menus.view();
  assert.equal(v.kind, 'arcade');
  assert.deepEqual({ kicker: v.kicker, head: v.head, hint: v.hint }, { kicker: ARCADE_BOARD.kicker, head: ARCADE_BOARD.title, hint: ARCADE_BOARD.pad });
  assert.equal(v.rows.length, 2, 'three across');
  assert.deepEqual(v.rows[0].map((c) => c.text), ['Alpha', 'Beta', 'Gamma']);
  assert.equal(v.rows[0][1].sub, 'second\nbest 12');
  assert.equal(v.rows[0][2].sub, 'third\nno best yet');
  assert.equal(v.rows[0][0].color, '#f00');
  assert.ok(v.rows[0][0].on);
  menus.navigate(0, 1);   // (down: the one under it)
  v = menus.view();
  assert.ok(v.rows[1][0].on, 'Delta');
  menus.action('confirm');
  assert.equal(menus.mode, null, 'closed');
  assert.equal(went.length, 1);
  assert.match(went[0], /game=d/);
  // B closes it
  menus.openArcade(board); menus.action('back');
  assert.equal(menus.mode, null);
});

test('the Arcade in the engine: Tab opens its board, a game chosen goes to its page (onGame)', async () => {
  const { exports: X } = await load();
  const menus = new EngineMenus({});
  const pages = [];
  const g = await quietly(() => X.createGame({ levelId: 'arcade', backend, menus, onGame: (h) => pages.push(h) }));
  await run(g, 3);
  await quietly(() => { g.key('Tab', true); g.key('Tab', false); });
  assert.equal(menus.mode, 'arcade', 'Tab opens the board');
  menus.action('confirm');
  assert.equal(menus.mode, null);
  assert.equal(pages.length, 1);
  assert.match(pages[0], /game=/);
});
