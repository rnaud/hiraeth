// Issue #550: Anselm Thrum's arrival on the first fragment, filmed (src/story/scientist-arrival.js), in the engines too:
// engine/game.js (the bundle Unity and Godot run) attaches the ship and its cinema as main.js does, so the moment plays
// there on the same stage, its letterbox the screen's 'cine' (BridgeHud.cs draws it), and the talk opens after it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../engine/game-test-runtime.mjs';
import { loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const menusStub = () => ({ open: false, mode: null, show() {}, openShop() { return true; }, changed() {}, action() {} });
const hush = (f) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return f(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };

test('the engines: the first fragment brings Anselm at a run, filmed and letterboxed, then his talk (issue #550)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-thrum-${process.pid}.js`));
  await bundle('unity', { input: 'engine/game.js', out: [file] });
  const g = await hush(() => loadBundle(file).exports.createGame({ levelId: 'desert', backend, menus: menusStub() }));
  const scr = g.screen();
  hush(() => { for (let i = 0; i < 40; i++) g.frame(1 / 20); });
  const f = g.fragments.list[5];
  // (walked into: the traveller on its spot)
  g.player.pos.copy(f.pos).y -= 0.9;
  let seen = null, bars = false, opened = null;
  hush(() => {
    for (let i = 0; i < 20 * 14 && !opened; i++) {
      g.frame(1 / 20);
      const m = g.story.moments?.current;
      if (m?.id === 'thrum.arrival') { seen ??= { start: g.story.scientist.field?.pos.distanceTo(g.player.pos) }; if (scr.state.cine?.bars) bars = true; }
      if (scr.state.dialogue?.name === 'Anselm Thrum') opened = scr.state.dialogue;
    }
  });
  assert.ok(f.found, 'taken');
  assert.ok(seen, 'the arrival played');
  assert.ok(seen.start > 8, `he started well off (${seen.start?.toFixed(1)} m)`);
  assert.ok(bars, 'letterboxed, as the page');
  assert.ok(opened, 'then his talk');
  assert.match(opened.text, /Don’t drop it!/);
  const d = g.story.scientist.field.pos.distanceTo(g.player.pos);
  assert.ok(d > 2 && d < 7, `beside you (${d.toFixed(1)} m)`);
});
