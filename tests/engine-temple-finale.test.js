// Issue #366 in the engines: a temple's ending plays in Unity as on the page (engine/game.js runs the same story, its
// moments on the ship's cinema: the letterbox as the screen's 'cine', src/platform.js; BridgeHud.cs draws it), the world's
// recorded theme cued under it, the way out held for its last panel, the world's closing page waiting for its end.
// engine/game.js in a bare V8 context (the bundle the engines run).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { finaleLength, finaleFlag } from '../src/temples/finale.js';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const menusStub = () => ({ shown: [], open: false, mode: null, show(m, p) { this.shown.push([m, p]); }, openShop() { return true }, changed() {}, action() {}, navigate() {} });
const hushed = async (fn) => {
  const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {};
  try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; }
};

test('the engine films a temple’s ending: the letterbox, the theme cued, the way out at its panel, then back to play (issue #366)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-finale-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const g = await hushed(() => loadBundle(file).exports.createGame({ levelId: 'arzach', backend, menus: menusStub() }));
  const rt = g.level.temples.find((t) => t.id === 'arzach');
  assert.ok(rt?.guardian && rt.onFinale, 'the Aerie, its ending hooked to the story');
  const G = rt.guardian, scr = g.screen();
  // in its arena, by the Elder
  const at = G.model.pos.clone(); at.z += 6; at.y = G.arena.y + 0.3;
  g.player.teleport(at, g.player.frame.up.clone(), g.player.frame.fwd.clone());
  await hushed(() => { for (let i = 0; i < 20; i++) g.frame(1 / 20); });
  G.state = 'weary';
  await hushed(() => G.resolve());
  assert.ok(g.story.moments.playing, 'its ending plays');
  assert.equal(rt.finaleLog?.started, true);
  assert.ok(rt.finaleLog.music?.cued, 'the world’s theme cued under it (Sound.musicCue: the engine’s own sound, a stand-in here)');
  const door = rt.finaleLog.door;
  let bars = false, shutAt = 0, t = 0;
  await hushed(() => {
    for (; t < finaleLength() + 2 && (g.story.moments.playing || t < 0.2); t += 1 / 20) {
      g.frame(1 / 20);
      bars ||= !!scr.state.cine?.bars;
      if (!rt.logic.isOpen(door)) shutAt = t;
    }
  });
  assert.ok(bars, 'in the letterbox (the screen’s cine)');
  assert.ok(shutAt > finaleLength() * 0.6, `the way out held for its panel (${shutAt.toFixed(1)} s)`);
  assert.ok(!g.story.moments.playing && rt.logic.isOpen(door), 'over: the way out open');
  assert.equal(g.story.quests.game.flag(finaleFlag('arzach')), true, 'once per save');
  await hushed(() => { for (let i = 0; i < 40; i++) g.frame(1 / 20); });
  assert.ok(!scr.state.cine?.bars, 'back to play');
});
