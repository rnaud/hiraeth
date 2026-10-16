// Issue #264: the fight in the engines (engine/combat.js, as main.js wires src/foes.js): the foes are made when the
// engine is played or a plan asks (`fight`), never in a bench's views; a blot set down ahead of the traveller is locked
// on with Tab (the rig locked, the reticle's arrows on the screen's state), cut down with F (its burst scatters chimes,
// walked into the wallet), and the hearts, potions and wallet are the health HUD's; knocked out, the restart card, and
// Enter gets him up. In the desert's temple the Keeper wakes as he steps into its arena, and the lock frames it with him
// (rig.frameWith). engine/game.js in a bare V8 context (the bundle the engines run).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });

async function makeGame(file, o) {
  const warn = console.warn, info = console.info, log = console.log, error = console.error; console.warn = console.info = console.log = console.error = () => {};
  try { return await loadBundle(file).exports.createGame({ levelId: 'desert', backend, ...o }); } finally { console.warn = warn; console.info = info; console.log = log; console.error = error; }
}
function run(g, frames, keys = {}) {
  const warn = console.warn; console.warn = () => {};
  try { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 30); } } finally { console.warn = warn; }
}
const tap = (g, code) => { run(g, 1, { [code]: true }); run(g, 1, { [code]: false }); };

test('the engine plays the fight: lock-on, a cut, the drops, the hearts, the knock-out and a guardian (issue #264)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-combat-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });

  // a bench's views: no foes (their numbers stay comparable)
  const bench = await makeGame(file, { flags: { bench: true } });
  assert.equal(bench.combat, null);

  const g = await makeGame(file, { fight: true });
  const S = g.screen();
  assert.ok(g.combat && g.foes?.on, 'the foes are on');
  run(g, 30);
  const [foe] = g.foes.spawnKind('blot', { n: 1, dist: 5 });
  assert.ok(foe, 'a blot set down');
  run(g, 10);
  tap(g, 'Tab'); run(g, 5);
  assert.equal(g.foes.lock, foe, 'locked on');
  assert.ok(g.rig.locked && g.player.lockOn, 'the camera and the traveller on it');
  assert.equal(S.state.lock?.arrows?.length, 4, JSON.stringify(S.state.lock));
  assert.ok(S.state.lock.x > 0.2 && S.state.lock.x < 0.8 && S.state.lock.y > 0.2 && S.state.lock.y < 0.9, 'the reticle over it');
  const before = g.chimes;   // (the wallet before the cut: chimes may walk in during it)
  let bursts = 0; const off = g.foes.game.on('foe:burst', () => bursts++);
  for (let k = 0; k < 40 && foe.alive && foe.dead === undefined; k++) { run(g, 2, { KeyF: true }); run(g, 10, { KeyF: false }); }
  // (the wallet read as the frames go: the health HUD shows a few seconds of the real clock after a pickup, and on a
  // slow runner 120 frames outlast it, so a read at the end alone found it hidden)
  let walleted = 0;
  // (the fight steps on the real clock, engine/game.js feelDt(realDt): a fast runner's 120 frames are a fraction of a
  // second, too short for the chimes to walk in; run until they have, up to 1500 frames)
  // (the wallet itself, g.chimes, not the HUD's copy: the HUD hides after a few seconds of the real clock, which a slow
  // runner's frames outlast)
  for (let k = 0; k < 1500 && !walleted; k++) { run(g, 1); walleted = g.chimes - before; }
  off();
  assert.ok(!foe.alive, 'cut down');
  assert.equal(bursts, 1, 'its burst');
  assert.equal(S.state.lock, null, 'nothing locked, no reticle');
  assert.ok(walleted > 0, `the chimes it dropped walked into the wallet (${g.chimes} chimes, ${JSON.stringify(S.state.health)})`);
  assert.equal(S.state.health.max, g.player.maxHearts);

  // knocked out: the card, then up again
  g.player.hearts = 0.25; g.player.hurt(1, 'foe');
  run(g, 60);
  assert.ok(g.player.dead && S.state.restart?.text, JSON.stringify(S.state.restart));
  tap(g, 'Enter'); run(g, 5);
  assert.ok(!g.player.dead && g.player.hearts === g.player.maxHearts && S.state.restart === null, 'up again, the card gone');

  // the desert's temple guardian: it wakes as he steps into its arena, and the lock frames it with him
  const T = (g.level.temples ?? []).find((t) => t.guardian);
  assert.ok(T, 'a temple with its guardian');
  const G = T.guardian, c = G.arena.center, V = c.constructor;
  g.player.teleport(c.clone().add(new V(0, 0.5, G.arena.r * 0.6)), new V(0, 1, 0), new V(0, 0, 1));
  const states = new Set();
  for (let k = 0; k < 12; k++) { run(g, 30); states.add(G.state); }
  assert.ok(states.has('fight'), [...states].join(' '));
  // its bar (the page's .temple-meter, src/temples/runtime.js meterHud): the screen's 'guardian', BridgeHud.cs draws it
  const bar = S.state.guardian;
  assert.ok(bar && /·/.test(bar.label) && bar.fill > 0 && bar.fill <= 1 && /^#/.test(bar.color), JSON.stringify(bar));
  tap(g, 'Tab'); run(g, 10);
  assert.ok(g.foes.lock?.guardian, 'locked on the guardian');
  assert.ok(g.rig.frameWith, 'framed with him');
  // its fitted skin in its own colours (its texture a JPEG the VM can't decode: colors.json as vertex colours; it was white)
  let skin = null; G.model.group.traverse((o) => { if (o.isSkinnedMesh) skin = o; });
  assert.ok(G.model.generated && skin, 'the Keeper on its fitted skin');
  assert.ok(skin.geometry.attributes.color && skin.material.vertexColors, 'its colours as vertex colours');
});

test('the Arena in the engine: its list of foes is the menus\' page (K, D-pad ↓), a foe chosen comes in to fight, the FOES tab on the screen (issue #264)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-arena-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  // (the menus made here, in Node, as the Unity bundle makes them in its VM: src/ui.js reads the page's matchMedia)
  globalThis.matchMedia ??= () => ({ matches: false });
  globalThis.window ??= new EventTarget();
  const { EngineMenus } = await import('../engine/menus.js');
  const { SlotStore } = await import('../src/save-slots.js');
  const menus = new EngineMenus({ store: new SlotStore(new Map()), screen: () => ({ w: 1280, h: 720 }) });
  const g = await makeGame(file, { levelId: 'arena', menus, saves: false });
  const S = g.screen();
  assert.ok(g.foeList && g.combat, 'the list attached to the fight\'s foes');
  run(g, 20);
  assert.equal(JSON.stringify(S.state.foeTab), JSON.stringify({ text: 'FOES ▸', key: 'K' }), 'the tab says how to open it');
  tap(g, 'KeyK');
  assert.equal(menus.mode, 'foes', 'K opens it');
  const v = menus.view();
  assert.ok(v.rows.length > 10 && v.rows[1][0].kind === 'foe', JSON.stringify(v.rows[1]));
  menus.action('confirm');
  const kind = g.foes.practice?.kind;
  assert.ok(kind, 'the first foe practised');
  menus.key('KeyK');
  assert.equal(menus.open, false);
  for (let i = 0; i < 20 && !g.foes.list.some((f) => f.alive); i++) run(g, 15);
  assert.ok(g.foes.list.some((f) => f.alive), `a foe come in: ${g.foes.list.map((f) => f.kind).join(', ')}`);
});
