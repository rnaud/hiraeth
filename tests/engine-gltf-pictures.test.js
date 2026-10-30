// Issue #537: the engines' VM decodes no picture, and three's GLTFLoader, given a model's own JPEG, failed on the Blob it
// builds the picture's URL from and logged "THREE.GLTFLoader: Couldn't load texture [object Promise]" (the Retroid's
// Unity build, for the coral-shirt traveller's body and his portrait head; the Keeper's skin too in node). Every model
// with a picture of its own is now named in engine/boot.js: ENCODED_PICTURES (kept encoded for Unity to decode, the
// father's) or COLOURED_PICTURES (drawn by the colours sampled from it, colors.json beside it, its picture left out).
// engine/game.js in a bare V8 context (the bundle the engines run).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { PUBLIC_MODELS, readPublicModel } from './public-model-inputs.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../engine/game-test-runtime.mjs';
import { loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

const PUBLIC = join(import.meta.dirname, '..', 'public');
/** Every model of the game's, with its glTF images. */
const MODELS = PUBLIC_MODELS.map((f) => {
  const b = readPublicModel(f), json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  return { file: f, images: json.images ?? [], colour0: (json.meshes ?? []).every((m) => m.primitives.every((p) => p.attributes.COLOR_0 !== undefined)) };
});

let built = null;
const theBundle = () => (built ??= (async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-gltf-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  return loadBundle(file);
})());

/** fn's console.error / warn lines that are the GLTFLoader's (or about a texture), the rest kept quiet. */
async function loaderErrors(fn) {
  const hits = [], keep = { e: console.error, w: console.warn, l: console.log, i: console.info };
  const grab = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : x?.message ?? String(x))).join(' '); if (/GLTFLoader|texture/i.test(s)) hits.push(s); };
  console.error = console.warn = grab; console.log = console.info = () => {};
  try { await fn(); await new Promise((r) => setTimeout(r, 50)); } finally { console.error = keep.e; console.warn = keep.w; console.log = keep.l; console.info = keep.i; }
  return hits;
}

test('every model with a picture of its own is named, kept encoded or drawn by its colours (issue #537)', async () => {
  const { exports: B } = await theBundle();
  const named = (f, list) => list.some((p) => f.includes(p));
  const pictured = MODELS.filter((m) => m.images.length);
  assert.ok(pictured.length >= 5, `the Tripo models found: ${pictured.length}`);
  for (const m of pictured) {
    const enc = named(m.file, B.ENCODED_PICTURES), col = named(m.file, B.COLOURED_PICTURES);
    assert.ok(enc !== col, `${m.file}: in one of ENCODED_PICTURES, COLOURED_PICTURES`);
    // (its colours beside it, colors.json; or in its own COLOR_0, the shellback crab's body, #800)
    if (col) assert.ok(m.colour0 || existsSync(join(PUBLIC, m.file, '..', 'colors.json')), `${m.file}: its colours beside it or on its vertices`);
  }
});

test('the engines load every model without a GLTFLoader texture error; the coloured go without their map (issue #537)', async () => {
  const { exports: B } = await theBundle();
  for (const m of MODELS) {
    let gltf = null, err = null;
    const hits = await loaderErrors(async () => { gltf = await new B.GLTFLoader().loadAsync(m.file).catch((e) => { err = e; }); });
    assert.equal(err, null, `${m.file} loaded`);
    assert.deepEqual(hits, [], `${m.file}: no loader error`);
    if (!m.images.length) continue;
    const maps = [];
    gltf.scene.traverse((o) => { if (o.isMesh) for (const mat of [o.material].flat()) maps.push(mat.map); });
    if (B.ENCODED_PICTURES.some((p) => m.file.includes(p))) assert.ok(maps.some((t) => t?.userData?.encoded?.bytes?.length > 1000), `${m.file}: its picture kept encoded`);
    else assert.ok(maps.every((t) => !t), `${m.file}: no map, its colours drawn instead`);
  }
});

test('a loader that loads two models reads each one\'s pictures by its own name (issue #537)', async () => {
  const { exports: B } = await theBundle();
  const L = new B.GLTFLoader();
  const father = MODELS.find((m) => m.file.includes('father-v1')), keeper = MODELS.find((m) => m.file.includes('keeper-v1'));
  const hits = await loaderErrors(async () => {
    const k = await L.loadAsync(keeper.file), f = await L.loadAsync(father.file);
    const map = (g) => { let t = null; g.scene.traverse((o) => { if (o.isMesh && o.material?.map) t = o.material.map; }); return t; };
    assert.equal(map(k), null, 'the Keeper: no map');
    assert.ok(map(f)?.userData?.encoded, 'the father: encoded');
  });
  assert.deepEqual(hits, []);
});

test('the desert built in the engines logs no GLTFLoader texture error (the traveller, his portrait head, the Keeper: issue #537)', async () => {
  const { exports: B } = await theBundle();
  const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
  const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
  let g = null;
  const hits = await loaderErrors(async () => { g = await B.createGame({ levelId: 'desert', backend, fight: true }); for (let i = 0; i < 30; i++) g.frame(1 / 30); });
  assert.ok(g?.player, 'the desert built');
  assert.deepEqual(hits, []);
});
