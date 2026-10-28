// Issue #509 (the author: "when pressing lock on on an enemy in the world in Lorn the game crashed"): locked on a bellows
// toad by a rise in the ground, it chased and looked for the high ground (src/foe-height.js findPerch), and the sight test
// it asks from a spot it might climb to (a plain { x, y, z }) called `from.distanceTo` (src/foes.js Foes.env.seen): a
// TypeError in the foes' update. On the page (and the Android app) it ended the frame loop and the game froze; in the
// engines (engine/game.js catches the foes' update) the fight stalled a frame every 2.5 s. Here every foe kind in each skin
// Lorn fields (the swamp's and the Deep Wood's) is locked on with Tab beside the rise west of the landing, and fought a
// few seconds: nothing throws. engine/game.js in a bare V8 context (the bundle the engines run).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../engine/game-test-runtime.mjs';
import { loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { rosterOf, worldArchetypes } from '../src/foe-worlds.js';
import { skinFor } from '../src/enemies/skins.js';
import { archetypeOfKind, ARCHETYPES } from '../src/enemies/archetypes.js';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
/** Runs fn with the console quiet, but keeps what the game says went wrong ("… failed …"). */
const failures = [];
const quietly = (fn) => {
  const w = console.warn, i = console.info, l = console.log, e = console.error;
  const keep = (...a) => { const s = a.map((x) => x?.stack ?? String(x)).join(' '); if (/failed in|TypeError|ReferenceError/.test(s) && !/GLTFLoader|Blob/.test(s)) failures.push(s); };
  console.warn = console.error = keep; console.info = console.log = () => {};
  const back = () => { console.warn = w; console.info = i; console.log = l; console.error = e; };
  let r;
  try { r = fn(); } catch (x) { back(); throw x; }
  if (r?.then) return r.finally(back);   // (the game's making: its loaders say their piece after it returns)
  back(); return r;
};
const run = (g, frames, keys = {}) => quietly(() => { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 30); } });
const tap = (g, code) => { run(g, 1, { [code]: true }); run(g, 1, { [code]: false }); };

/** Every kind Lorn fields in each of its parts, in that part's skin (kind@skin). */
function lornKinds() {
  const out = new Set();
  for (const part of ['perdide', 'perdide2']) {
    const R = rosterOf(part);
    // (the packs', the fill's and the archetypes placed by hand: the Deep Wood's wood cutter)
    for (const k of [R.first, ...Object.keys(R.wild ?? {}), ...Object.keys(R.fill ?? {}), ...worldArchetypes(part).map((a) => ARCHETYPES[a]?.kind ?? a)]) {
      if (!k) continue;
      const a = archetypeOfKind(k), kind = a ? ARCHETYPES[a].kind ?? k : k;
      const skin = a && ARCHETYPES[a].status === 'built' ? skinFor(a, part) : null;
      out.add(skin ? `${kind}@${skin}` : kind);
    }
  }
  return [...out];
}

test('Lorn: every foe kind and skin locked on by the rise, fought a while, and nothing throws (issue #509)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-lock-lorn-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = loadBundle(file);
  const g = await quietly(() => B.exports.createGame({ levelId: 'perdide', backend, fight: true }));
  assert.ok(g.combat && g.foes?.on, 'the fight');
  run(g, 30);
  const F = g.foes, T = g.player.pos.constructor;
  // (the sight test from a plain point, as the toad's perch search asks it: it threw before #509)
  const at = (x, z) => new T(x, g.physics.groundAt(x, 40, z, 80), z);
  const you = at(-120, 46);
  assert.equal(typeof F.env.seen({ x: you.x + 7, y: you.y + 3, z: you.z }, you), 'boolean', 'a plain point seen from');
  const kinds = lornKinds();
  for (const k of ['toad@perdide', 'rootknot@perdide', 'heron@perdide', 'skitter@perdide', 'rootknot@perdide2', 'jelly@perdide2', 'moth@perdide2', 'wisp@perdide2', 'brute@perdide2']) assert.ok(kinds.includes(k), `${k} in Lorn's roster (${kinds.join(', ')})`);
  for (const kind of kinds) {
    for (const f of F.list.slice()) F.remove(f);
    F.lock = null; F.packRest = 999;
    g.player.pos.copy(you).setY(you.y + 0.3); g.player.vel?.set(0, 0, 0);
    run(g, 5);
    failures.length = 0;
    const f = F.add(kind, at(you.x + 7, you.z));
    run(g, 3);
    tap(g, 'Tab');
    assert.equal(F.lock, f, `${kind}: locked on`);
    // (a few seconds locked on, the toad's look for the high ground among them: PERCH.every 2.5 s; a few cuts)
    run(g, 60);
    for (let c = 0; c < 6; c++) { run(g, 2, { KeyF: true }); run(g, 10, { KeyF: false }); }
    run(g, 40);
    assert.deepEqual(failures, [], `${kind}: ${failures[0] ?? ''}`);
    assert.ok(!g._foesFailed, `${kind}: the foes' update threw`);
    assert.ok(Number.isFinite(g.rig.yaw) && Number.isFinite(g.camera.position.x), `${kind}: the lock camera`);
  }
});
