// Issue #264: what four games draw on a canvas or a panel of their own on the page, as the screen's parts an engine
// draws (src/platform.js; BridgeHud.Games.cs): the drum circle's ring and glyphs ('drums', drums.js drumsPart), the
// sketch hunt's list and viewfinder ('hunt'), the fishing's journal, line meter and catch ('fishing'), the chime
// pirates' reticle and comms ('pirates'). Played in engine/game.js in a bare V8 context (the bundle the engines run),
// where the page's canvases are not drawn (engine/platform.js hudIsData).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../engine/game-test-runtime.mjs';
import { loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const { EngineMenus } = await import('../engine/menus.js');

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const run = (g, frames, keys = {}) => quietly(() => { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 30); } });
const plain = (x) => JSON.parse(JSON.stringify(x ?? null));   // (the VM's objects, as plain ones: another realm's prototypes)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Frames a little apart on the page's clock (the drum circle's song is timed by it). */
const runFor = async (g, frames, ms) => { for (let i = 0; i < frames; i++) { await run(g, 1); await sleep(ms); } };
/** The run left (its session's end: the drum circle's scheduling interval with it, which would keep the test alive). */
const leave = (g) => quietly(() => g.trials.runner.end());

let B = null;
async function load() {
  if (B) return B;
  const file = tempPath(join(tmpdir(), `hiraeth-engine-games-hud-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  B = loadBundle(file, { pads: () => [] });
  return B;
}
/** A game on its own page, its start card taken (Enter), the 3-2-1 over. */
async function started(id, from) {
  const { exports: X } = await load();
  const menus = new EngineMenus({});
  const g = await quietly(() => X.createGame({ levelId: from, game: id, from, backend, menus }));
  await run(g, 2);
  if (menus.mode === 'card') menus.key('Enter');
  await run(g, 120);
  assert.equal(g.trials.runner.phase, 'play', `${id} under way`);
  return g;
}

test('the drum circle publishes its ring: the glyphs near, the song\'s time sent and run on, a hit by its id (drums.js drumsPart)', async () => {
  const g = await started('drums', 'desert');
  let D = null;
  try {
  for (let i = 0; i < 200 && !(D?.notes?.length); i++) { await runFor(g, 1, 20); D = plain(g.screen().state.drums); }
  assert.ok(D, 'the part is up');
  assert.ok(D.lanes >= 3 && D.ap > 0 && D.spb > 0 && D.len > 10, JSON.stringify({ ...D, notes: D.notes.length }));
  assert.ok(D.notes.length > 0 && D.notes.every(([i, t, lane, missed]) => Number.isInteger(i) && t - D.t <= D.ap + 1.05 && lane < D.lanes && (missed === 0 || missed === 1)), JSON.stringify(D.notes));
  assert.equal(D.labels.length, D.lanes);
  assert.equal(D.run, true);
  // (the time is sent at least four times a second, not every frame: the engine runs it on between)
  const n0 = D.n;
  await runFor(g, 30, 25);
  const D2 = plain(g.screen().state.drums);
  assert.ok(D2.n > n0 && D2.n - n0 < 30, `sent ${D2.n - n0} times in 30 frames`);
  assert.ok(D2.t > D.t, 'the song goes on');
  // the pictures' pose plays the glyphs on their beats: a hit on a socket, by its id, the combo counting
  assert.equal(g.trials.runner.session.pose(), true);
  let D3 = null;
  for (let i = 0; i < 200 && !(D3?.fx?.length); i++) { await runFor(g, 1, 15); D3 = plain(g.screen().state.drums); }
  assert.ok(D3.fx.some((f) => f.kind === 'perfect' && f.id > 0 && f.lane < D3.lanes), JSON.stringify(D3.fx));
  assert.ok(D3.combo >= 1);
  } finally { await leave(g); }
  assert.equal(g.screen().state.drums, null, 'gone with the run');
});

test('the sketch hunt publishes its list, the viewfinder raised and its readout, the flash (sketchhunt.js)', async () => {
  const g = await started('sketchhunt', 'bazaar');
  let H = plain(g.screen().state.hunt);
  assert.ok(H?.list, 'the list');
  assert.match(H.list.title, /^To sketch · 0 of 6$/);
  assert.equal(H.list.items.length, 6);
  assert.ok(H.list.items.every((x) => x.name && x.sub && !x.done), JSON.stringify(H.list.items));
  assert.equal(H.view, null);
  assert.ok(H.hint.length > 0, 'the hint');
  // the sketchbook up (R held): the viewfinder, its zoom and readout
  await run(g, 10, { KeyR: true });
  H = plain(g.screen().state.hunt);
  assert.ok(H.view && H.dim, 'raised');
  assert.match(H.view.zoom, /×$/);
  assert.ok(H.view.read?.text, JSON.stringify(H.view));
  const f0 = H.flash;
  await quietly(() => g.trials.runner.session.sketch());
  await run(g, 1, { KeyR: true });
  assert.equal(plain(g.screen().state.hunt).flash, f0 + 1, 'the flash');
  g.key('KeyR', false);
  await leave(g);
  assert.equal(g.screen().state.hunt, null);
});

test('the fishing publishes its journal, the cast\'s meter and the hint (fishing.js)', async () => {
  const g = await started('fishing', 'desert');
  let F = plain(g.screen().state.fishing);
  assert.ok(F?.journal?.rows?.length >= 5, JSON.stringify(F));
  assert.match(F.journal.title, /^Journal · \d+ of \d+$/);
  assert.match(F.hint.text, /cast/);
  assert.equal(F.meter, null);
  // Space held: the cast's meter
  await run(g, 12, { Space: true });
  F = plain(g.screen().state.fishing);
  assert.ok(F.meter && !F.meter.tension && F.meter.k > 0, JSON.stringify(F.meter));
  assert.match(F.meter.label, /^cast \d+ m$/);
  g.key('Space', false);
  await leave(g);
  assert.equal(g.screen().state.fishing, null);
});

test('the chime pirates publish their reticle in the half-size canvas\' px (pirates.js drawHud)', async () => {
  const g = await started('pirates', 'desert');
  let P = null;
  for (let i = 0; i < 60 && !P?.ret; i++) { await run(g, 2); P = plain(g.screen().state.pirates); }
  assert.ok(P?.ret, JSON.stringify(P));
  assert.ok(P.W > 100 && P.H > 100, 'the canvas size');
  assert.ok(P.ret.x > 0 && P.ret.x < P.W && P.ret.y > 0 && P.ret.y < P.H && P.ret.r > 5, JSON.stringify(P.ret));
  assert.match(P.ret.hot, /^#[0-9a-f]{6}$/);
  // (issue #495) the gun's tier and the boost's gauge beside the missiles, in the hint row's rich text
  const note = () => plain(g.screen().state.minigame)?.hints?.note ?? '';
  assert.match(note(), /MISSILES .*GUN .*Twin bolts.*BOOST/, note());
  const full = (note().match(/#71d7cf>/g) ?? []).length;
  await run(g, 40, { ShiftLeft: true });   // (Shift boosts: the gauge drains)
  g.key('ShiftLeft', false);
  const left = (note().match(/#71d7cf>/g) ?? []).length;
  assert.ok(full === 6 && left < full, `the gauge ${full} → ${left} cells`);
  await leave(g);
  assert.equal(g.screen().state.pirates, null);
});
