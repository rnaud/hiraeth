// Issue #394: the opening in Unity showed no father over the dash. The recordings' hologram (src/ship/hologram.js) is a
// scene of its own that the page draws over its finished picture (HOLO.render), so the engines' mirror, which walks the
// game's scene, never saw it. engine/game.js now hangs it in the mirrored scene; its figures' materials cross as the
// bridge's 'holo' (engine/unity/port-format.js, Hiraeth/HoloFigure), what moves on them as three live vectors (uHoloA..C,
// engine/mirror.js LIVE_VECTORS), the beam (which the page draws nothing with) as 'hidden'; the father's generated body
// keeps its picture, encoded, for Unity to decode (engine/boot.js engineImages). And the voicemail's E floats over its
// button through the walk (the screen's prompt, which BridgeHud now draws in a scene walked through).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../engine/game-test-runtime.mjs';
import { loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { portMaterial } from '../engine/unity/port-format.js';
import { LIVE_VECTORS } from '../engine/mirror.js';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'vertices', 'then']);
const mats = new Map(), nodes = new Map(), shown = new Map(), vecs = [];
const backend = new Proxy({}, {
  get: (t, k) => (k === 'material' ? (mid, spec, m) => mats.set(mid, { spec, m, port: portMaterial(spec, mid) })
    : k === 'create' ? (id, d) => nodes.set(id, d)
      : k === 'visible' ? (id, on) => shown.set(id, on)
        : k === 'materialVec' ? (mid, w, v) => vecs.push({ mid, w, v })
          : UNSET.has(k) ? undefined : () => {}),
});
const menusStub = () => ({ shown: [], open: false, mode: null, show() {}, openShop() { return true; }, changed() {}, action() {}, navigate() {} });
const quiet = (f) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return f(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const run = (g, frames, keys = {}) => quiet(() => { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 20); } });
const tick = () => new Promise((r) => setTimeout(r, 20));

test('the father\'s message is drawn by the engines: the hologram mirrored, its figures in light, the button\'s E (issue #394)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-holo-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const g = await quiet(() => loadBundle(file).exports.createGame({ levelId: 'desert', backend, menus: menusStub(), prologue: true }));
  // waking: the eyes' opening drives the letterbox over the shut lids until he rises (the screen's cine.eyes); Unity drew
  // the lids shut through the whole wake, black, because they were still "lids"
  for (let i = 0; i < 40 && !(g.ship.cinematic.stage === 'wake' && g.ship.prologue.t > 4.5); i++) { run(g, 5); await tick(); }
  const lidsUp = g.screen().state.cine;
  assert.ok(lidsUp?.lids && lidsUp.eyes && lidsUp.lid > 0.9, `his eyes open: ${JSON.stringify(lidsUp)}`);
  // no sword on his back before the Rose House gives it (main.js armTool: the engines left it unset, so it was there)
  assert.equal(g.tool.swordOn, false);
  for (let i = 0; i < 40 && g.ship.cinematic.stage !== 'walk'; i++) { run(g, 20); await tick(); }
  assert.equal(g.screen().state.cine?.eyes, false, 'the lids let go as he rises');
  assert.equal(g.ship.cinematic.stage, 'walk');
  // the walk: at the console, the button's E over it (the screen's prompt, drawn through the scene)
  const m = g.ship.modelOf(g.player.pos);
  g.player.pos.copy(g.ship.world(m, m.interior.points.cockpit));
  run(g, 6);
  const scr = g.screen();
  assert.equal(scr.state.prompt?.text, 'voicemail');
  assert.ok(scr.state.cine?.walk && scr.state.cine?.hud === false, 'a scene walked through, the HUD hidden but for the walk\'s pieces');
  run(g, 2, { KeyE: true }); run(g, 2, { KeyE: false });
  assert.equal(g.ship.cinematic.stage, 'call');
  // the father's body loads (his generated model, its picture kept encoded), then the picture rises
  for (let i = 0; i < 30; i++) { run(g, 4); await tick(); }
  assert.ok(g.ship.holo?.visible, 'the hologram up');
  const holo = [...mats.values()].filter((x) => x.port.port === 'holo');
  assert.ok(holo.length >= 1, `a figure in light: ${[...mats.values()].map((x) => x.port.port ?? x.spec.type).join(' ')}`);
  const father = holo.find((x) => x.port.kind === 4);
  assert.ok(father, `the father's own picture (kinds: ${holo.map((x) => x.port.kind)})`);
  const pic = father.m.uniforms.uMap.value;
  assert.ok(pic?.userData?.encoded?.bytes?.length > 10000 && /jpeg/.test(pic.userData.encoded.mime), 'his picture, encoded, for the engine to decode');
  assert.ok([...mats.values()].some((x) => x.port.port === 'hidden'), 'the beam drawn by nothing');
  // his body drawn: a skinned node on a 'holo' material, shown
  const holoMids = new Set([...mats].filter(([, x]) => x.port.port === 'holo').map(([mid]) => mid));
  const drawn = [...nodes].filter(([id, d]) => d.mids.some((mm) => holoMids.has(mm)) && shown.get(id));
  assert.ok(drawn.some(([, d]) => d.kind === 'skinned'), 'his body shown');
  // and it moves: risen, the span and his feet sent as the live vectors
  const A = LIVE_VECTORS.indexOf('uHoloA'), C = LIVE_VECTORS.indexOf('uHoloC');
  const risen = vecs.filter((v) => holoMids.has(v.mid) && v.w === A).at(-1);
  assert.ok(risen && risen.v[0] > 0.9, `risen: ${JSON.stringify(risen?.v)}`);
  // (sent with the material when it was first seen, then each time it moves)
  const feet = vecs.filter((v) => v.mid === father.port.id && v.w === C).at(-1)?.v ?? father.port.holoC;
  assert.ok(feet[1] > 1000 && feet[3] > 1, `his feet in orbit, a little under life size: ${JSON.stringify(feet)}`);
  // nothing drawn of it on a later wake (skipped): the picture folds away
  run(g, 30, { Escape: true }); run(g, 20 * 3, { Escape: false });
  assert.ok(!g.ship.holo.visible, 'gone with the scene');
});
