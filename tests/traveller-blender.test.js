// The traveller rebuilt in Blender (issue #493; scripts/blender/traveller/build.py, not in the game yet):
// its GLB keeps the game's skeleton by name at the B3 fit, every part is its own mesh on that one skin,
// each garment names the body areas it hides, the face carries the game's six keys, and the whole stays
// within the current traveller's triangle budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { B3_JOINTS } from '../src/characters/traveller-b3-fit.js';

const DIR = 'data/characters/traveller-v2/';
const manifest = JSON.parse(readFileSync(DIR + 'manifest.json', 'utf8'));
const glb = readFileSync(DIR + 'traveller.glb');
const gltf = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)));

test('the GLB keeps every game bone by its own name, at the B3 fit', () => {
  const skin = gltf.skins[0];
  const names = skin.joints.map((j) => gltf.nodes[j].name);
  for (const [name, p] of Object.entries(B3_JOINTS)) {
    assert.ok(names.includes(name), `bone ${name}`);
    const head = manifest.skeleton[name].head;
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(head[k] - p[k]) < 1e-3, `${name} at ${head} not ${p}`);
  }
  assert.ok(names.includes('eye_l') && names.includes('eye_r'), 'the eyes turn on bones of their own');
  assert.equal(gltf.skins.length, 1, 'one skin: every part on the same skeleton');
});

test('every part is its own skinned mesh', () => {
  const meshNodes = gltf.nodes.filter((n) => n.mesh !== undefined);
  const names = meshNodes.map((n) => n.name);
  for (const part of ['Body', 'Head', 'Hair', 'Eye_L', 'Eye_R', 'Brows', 'Tee', 'Shirt', 'Trousers', 'Boots', 'Scarf']) {
    assert.ok(names.includes(part), `part ${part}`);
    const node = meshNodes.find((n) => n.name === part);
    assert.equal(node.skin, 0, `${part} skinned`);
    for (const prim of gltf.meshes[node.mesh].primitives) {
      assert.ok(prim.attributes.JOINTS_0 !== undefined && prim.attributes.WEIGHTS_0 !== undefined, `${part} weights`);
      assert.ok(prim.attributes.TEXCOORD_0 !== undefined, `${part} UVs`);
    }
  }
  const body = gltf.meshes[meshNodes.find((n) => n.name === 'Body').mesh];
  assert.ok(body.primitives.every((p) => p.attributes._AREA !== undefined), 'the body carries its areas');
});

test('the garments name the areas they hide; the face has the game keys', () => {
  for (const [name, part] of Object.entries(manifest.parts)) {
    if (part.kind !== 'garment') continue;
    assert.ok(Array.isArray(part.hides), `${name} hides`);
    for (const a of part.hides) assert.ok(manifest.areas.includes(a), `${name}: area ${a}`);
    assert.ok(part.layer >= 1, `${name} layer`);
    for (const key of Object.values(part.materials)) assert.ok(key, `${name}: every material has a palette key`);
  }
  assert.ok(manifest.parts.Shirt.hides.length > 0 && manifest.parts.Trousers.hides.length > 0);
  for (const key of ['blink', 'smile', 'brow', 'browTilt', 'asymmetry', 'open']) assert.ok(manifest.parts.Head.shapeKeys.includes(key), key);
});

test('the whole stays within the current traveller\'s triangles', () => {
  // docs/systems/characters.md, B3 playable integration: 94 222 triangles near the camera
  assert.ok(manifest.triangles < 94222, `${manifest.triangles} triangles`);
});
