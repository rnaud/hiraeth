// The coral-shirt traveller's overshirt done by an engine (src/characters/tripo-cloth.js CLOTH_HOST, engine/cloth.js):
// the packet the module sends a frame, stepped and mapped apart, gives the garment the module gives it itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { parseBody } = await import('../src/makehuman/body.js');
const { buildCharacter } = await import('../src/player.js');
const { createTravellerV1 } = await import('../src/characters/traveller-v1.js');
const { CLOTH_HOST } = await import('../src/characters/tripo-cloth.js');
const { clothState, clothFrame, packClothDesc } = await import('../engine/cloth.js');
const b = readFileSync('public/anim/mh/body.bin'), data = parseBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const dir = 'public/characters/traveller-v1/';
const report = JSON.parse(readFileSync(dir + 'rig.json')), colors = JSON.parse(readFileSync(dir + 'colors.json'));
const g = readFileSync(dir + 'model.glb'), n = g.readUInt32LE(12), json = JSON.parse(g.toString('utf8', 20, 20 + n)), bin = g.subarray(28 + n);
json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
delete json.images; delete json.textures; delete json.materials; for (const m of json.meshes) for (const p of m.primitives) delete p.material;
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');

function traveller(offload) {
  const char = buildCharacter();
  char.root.position.set(12, 3, -40); char.root.rotation.y = 0.7;
  CLOTH_HOST.offload = offload;
  try { return { char, ch: createTravellerV1(char, { gltf, data, report, colors }) }; } finally { CLOTH_HOST.offload = null; }
}

test('the overshirt done apart (engine/cloth.js) is the overshirt the module does itself, frame after frame', () => {
  const plain = traveller(null), plain2 = traveller(null);   // (two of the module's own: how far two runs of it differ)
  let desc = null, st = null, out = null, nrm = null, frames = 0;
  const off = traveller({
    init(d) { desc = d; st = clothState(d); out = new Float32Array(d.vertices * 3); nrm = new Float32Array(d.vertices * 3); },   // (floats, as the engines hold them)
    frame(p) { clothFrame(desc, st, p, out, nrm); frames++; },
  });
  assert.ok(desc && desc.N > 100 && desc.map.count > 1000, 'the description, once');
  assert.ok(off.ch.cloth.garment === desc.garment);
  const buf = packClothDesc(desc), u = new Uint32Array(buf, 0, 7);
  assert.deepEqual(Array.from(u), [desc.N, desc.constants.edgeA.length, desc.map.count, desc.vertices, desc.index.length, desc.caps, desc.bones], 'the layout\'s header');
  const garmentBefore = off.ch.cloth.garment.geometry.attributes.position.array.slice();
  // the same walk on both: the hips swing, the root travels (a few steps of the cage a frame)
  const pose = (t, { char, ch }) => {
    char.root.position.x += 0.02; char.root.rotation.y += 0.01;
    for (const bone of ch.humanoid.body.skeleton.bones) if (/thigh_l|thigh_r/.test(bone.name)) bone.rotation.x = Math.sin(t * 6) * (bone.name.endsWith('l') ? 0.5 : -0.5);
    char.root.updateMatrixWorld(true);
  };
  for (let i = 0; i < 40; i++) {
    for (const s of [plain, plain2, off]) { pose(i / 60, s); s.ch.updateCloth(1 / 60); }
  }
  assert.equal(frames, 40, 'a packet a frame');
  const a = plain.ch.cloth.garment.geometry.attributes.position.array, a2 = plain2.ch.cloth.garment.geometry.attributes.position.array;
  let max = 0, moved = 0, base = 0;
  for (let i = 0; i < a.length; i++) { max = Math.max(max, Math.abs(a2[i] - out[i])); base = Math.max(base, Math.abs(a[i] - a2[i])); moved = Math.max(moved, Math.abs(a[i] - garmentBefore[i])); }
  assert.ok(moved > 0.01, `the shirt moved (${moved.toFixed(3)} m)`);
  // (two travellers made one after the other already differ by a hair, 2e-5 m: no further apart than that)
  assert.ok(max < 1e-4 && max <= base * 1.5 + 1e-6, `the same garment: ${max} (two of the module's own: ${base})`);
  const na = plain2.ch.cloth.garment.geometry.attributes.normal.array;
  const nb = plain.ch.cloth.garment.geometry.attributes.normal.array;
  const apart = (x, y) => { let c = 0; for (let i = 0; i < x.length; i += 3) if (Math.hypot(x[i] - y[i], x[i + 1] - y[i + 1], x[i + 2] - y[i + 2]) > 1e-3) c++; return c; };
  const nOff = apart(na, nrm), nBase = apart(na, nb);
  assert.ok(nOff <= nBase * 1.5 + 5, `the same normals: ${nOff} apart (two of the module's own: ${nBase})`);
  // and the module left the offloaded garment's own geometry alone (nothing for the mirror to send)
  assert.deepEqual(Array.from(off.ch.cloth.garment.geometry.attributes.position.array), Array.from(garmentBefore));
});
