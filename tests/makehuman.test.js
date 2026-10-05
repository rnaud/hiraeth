import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync, statSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The MakeHuman prototype (docs/makehuman.md): the people of scripts/makehuman/build.py
// (public/anim/mh/), prepared as Humanoid templates (src/makehuman/body.js), their faces on shape
// keys (src/makehuman/face-keys.js), in the character studio only (src/studio/makehuman.js), and
// the game's own Quaternius bodies left exactly as they were.

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { prepareMakeHuman, headScale, BONES } = await import('../src/makehuman/body.js');
const { keyWeights, inkShare, INK_SHARE } = await import('../src/makehuman/face-keys.js');
const { Humanoid, prepareHuman, FACE } = await import('../src/humanoid.js');
const { EAR_Z } = await import('../src/face-ink.js');
const { buildCharacter } = await import('../src/player.js');
const { TONE_EXPRESSIONS, cleanExpression } = await import('../src/expression.js');
const { BLANK } = await import('../src/studio/people.js');
const { mhLineup, mhEntry, mhDef, likeDef } = await import('../src/studio/makehuman.js');
const { DEFAULTS, encodeState, decodeState } = await import('../src/studio/state.js');

const url = (p) => new URL(`../public/anim/${p}`, import.meta.url);
const manifest = JSON.parse(readFileSync(url('mh/people.json'), 'utf8'));
const parse = async (p) => {
  const b = await readFile(url(p));
  return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene;
};
const KEYS = ['smile', 'frown', 'jawOpen', 'browInnerUp', 'browDown', 'browOuterUp', 'blink', 'squint'];

test('the MakeHuman people: every age, both sexes, a game-sized mesh with face keys, files of a reasonable size', () => {
  const P = manifest.people;
  assert.ok(P.length >= 6 && P.length <= 8);
  const years = P.map((p) => p.years);
  assert.ok(Math.min(...years) <= 8 && Math.max(...years) >= 70, 'a child and an elder');
  assert.ok(years.some((y) => y >= 13 && y <= 17), 'a teenager');
  assert.deepEqual([...new Set(P.map((p) => p.kind))].sort(), ['f', 'm']);
  for (const p of P) {
    assert.ok(p.triangles.body >= 8000 && p.triangles.body <= 15000, `${p.id}: ${p.triangles.body} triangles`);
    for (const k of KEYS) assert.ok(p.keys.Body.includes(k), `${p.id} has the key ${k}`);
    assert.ok(p.keys.Eyebrows.includes('browInnerUp'), 'the brows move with the face');
    assert.ok(existsSync(url(`mh/${p.id}.glb`)));
    assert.ok(statSync(url(`mh/${p.id}.glb`)).size < 1.2e6, `${p.id}.glb under 1.2 MB`);
    // the game's frame: the hips where the Quaternius man's are, the face ink's landmarks in order
    assert.ok(Math.abs(p.bones.thigh_l[1] - manifest.hipY) < 0.002);
    const [eyeY, eyeX, noseY, noseZ, chinY] = p.face;
    assert.ok(eyeY > noseY && noseY > chinY && eyeX > 0.02 && eyeX < 0.05 && noseZ > 0.05, `${p.id}: ${p.face}`);
    assert.ok(p.scale > 0.6 && p.scale < 1.15 && p.scale * p.height > 1.1, `${p.id} stands ${(p.scale * p.height).toFixed(2)} m`);
  }
});

test('a MakeHuman body is a Humanoid template: the game bones, its own landmarks, a face on shape keys', async () => {
  const e = manifest.people.find((p) => p.id === 'man');
  const scene = prepareMakeHuman(await parse('mh/man.glb'), e);
  const names = new Set();
  scene.traverse((o) => { if (o.isBone) names.add(o.name); });
  for (const b of BONES) assert.ok(names.has(b), b);
  const h = new Humanoid(scene, buildCharacter(), 'm');
  assert.equal(h.profile.id, 'mh:man');
  assert.deepEqual(h.faceRest, e.face);
  assert.deepEqual(h.outfitRest, e.outfit);
  assert.equal(h.earZ, e.earZ);
  assert.ok(h.eyeMesh?.userData.eyeball, 'the eyeballs measured for eyes.js');
  assert.ok(h.faceKeys && h.faceKeys.brows, 'shape keys on the face and the brows');
  const body = h.body, smile = body.morphTargetDictionary.smile;
  h.setExpression(TONE_EXPRESSIONS.happy);
  assert.ok(body.morphTargetInfluences[smile] > 0.5, 'a happy face smiles on its shape key');
  assert.ok(Math.abs(body.material.uniforms.uMood.value.x - TONE_EXPRESSIONS.happy.smile * INK_SHARE.smile) < 1e-6, 'the ink draws its share');
  h.setExpression(TONE_EXPRESSIONS.surprised);
  assert.equal(body.morphTargetInfluences[smile], 0);
  assert.ok(body.morphTargetInfluences[body.morphTargetDictionary.browOuterUp] > 0.5);
  assert.ok(h.browMesh.morphTargetInfluences[h.browMesh.morphTargetDictionary.browOuterUp] > 0.5, 'the brows go up with the skin');
  // a face morph keeps the brows' keys; a build keeps the body's
  h.setFace({ lines: 0.5, eyeSize: 1.1 });
  assert.ok(h.browMesh.geometry.morphAttributes.position?.length);
  h.setBuild('heavy');
  assert.ok(h.body.geometry.morphAttributes.position?.length);
  // dressed by the costumes, its hair fitted to its skull and cached apart from the Quaternius bodies'
  h.dress({ ...BLANK('m'), head: 'curls' });
  assert.ok(h._costume.length);
  const s = headScale(e.skull, 'm');
  assert.ok(s.every((k) => k > 0.7 && k < 1.3), `${s}`);
  assert.ok([...Humanoid._costumes.keys()].some((k) => k.startsWith('mh:man|')));
});

test('the game\'s own bodies are as they were: no profile, the per-kind tables, no shape keys', async () => {
  const h = new Humanoid(prepareHuman(await parse('human_f.glb'), 'f'), buildCharacter(), 'f');
  assert.equal(h.profile, null);
  assert.equal(h.faceKeys, null);
  assert.equal(h.earZ, EAR_Z.f);
  assert.equal(h.faceRest[0], FACE.f[0]);
  h.setExpression(TONE_EXPRESSIONS.happy);
  assert.equal(h.body.material.uniforms.uMood.value.x, TONE_EXPRESSIONS.happy.smile, 'the ink draws the whole expression');
  h.setExpression({ brow: 1 });
  assert.ok(h._browBase, 'the brows posed on the CPU as before');
  // (the material's shape keys only switch on for meshes that have them)
  const src = readFileSync(new URL('../src/materials.js', import.meta.url), 'utf8');
  assert.match(src, /#include <morphtarget_vertex>/);
});

test('expressions become shape keys: each tone pulls its own', () => {
  const w = (tone) => keyWeights(cleanExpression(TONE_EXPRESSIONS[tone]));
  assert.deepEqual(keyWeights(cleanExpression({})), { blink: 0 });
  assert.ok(w('happy').smile > 0.5 && !w('happy').frown);
  assert.ok(w('sad').frown > 0.4 && w('sad').browInnerUp > 0.6);
  assert.ok(w('angry').browDown > 0.8 && w('angry').squint > 0);
  assert.ok(w('surprised').jawOpen > 0.2 && w('surprised').browOuterUp > 0.6);
  assert.equal(keyWeights({}, 1).blink, 1);
  for (const t of Object.keys(TONE_EXPRESSIONS)) for (const v of Object.values(w(t))) assert.ok(v >= 0 && v <= 1.2);
  const ink = inkShare(cleanExpression({ smile: 1, brow: -1 }));
  assert.equal(ink.smile, INK_SHARE.smile);
  assert.equal(ink.brow, -1, 'the frown creases stay the ink\'s');
});

test('the studio: MakeHuman a body source of its own, the comparison lineup in pairs', () => {
  assert.equal(DEFAULTS.source, 'quaternius');
  assert.equal(encodeState(DEFAULTS), '');
  assert.equal(decodeState('source=makehuman&mh=child&lineup=makehuman').mh, 'child');
  const pairs = mhLineup(manifest, 8);
  assert.equal(pairs.length, manifest.people.length * 2);
  assert.ok(pairs[0].twinOf && pairs[1].mh && pairs[0].twinOf === pairs[1].mh, 'the Quaternius twin first, then the MakeHuman person');
  assert.equal(mhLineup(manifest, 8, 'child,man').length, 4);
  assert.equal(mhEntry(manifest, '', 'f').kind, 'f');
  const child = manifest.people.find((p) => p.id === 'child');
  assert.equal(mhDef(child).scale, child.scale);
  assert.equal(likeDef(child).morph.headSize, child.like.morph.headSize);
});
