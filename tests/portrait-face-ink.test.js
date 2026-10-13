// The traveller's face ink (issue #198): the approved portrait's own pen lines, baked once into a small
// red/green mask in head-v3's source-front space (scripts/tripo/bake-face-ink.mjs) and drawn by the face
// shader (src/characters/portrait-head.js) into the ink detail channel, with the jaw and the hatching
// under it from the geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import sharp from 'sharp';
import { readFileSync, statSync } from 'node:fs';
import { travellerV1, tripoHead } from './gait-sim.js';
import { createTravellerV1 } from '../src/characters/traveller-v1.js';
import { buildCharacter } from '../src/player.js';
import { PORTRAIT_HEAD as F, PORTRAIT_FACE_INK as FI } from '../src/characters/portrait-head.js';
import { loadClothInk } from '../src/characters/traveller-cloth-ink.js';

const FILE = 'public/characters/traveller-v1/head-v3/face-ink.png';
const assets = { ...await travellerV1(), head: await tripoHead() };
const source = assets.head.scene.children.find((o) => o.isMesh), raw = source.geometry.attributes.position, hair = source.geometry.attributes._portrait_hair;
const { data, info } = await sharp(FILE).raw().toBuffer({ resolveWithObject: true });
const at = (i, j) => [FI.box[0] + ((i + 0.5) / info.width) * (FI.box[2] - FI.box[0]), FI.box[3] - ((j + 0.5) / info.height) * (FI.box[3] - FI.box[1])];
const inked = [];
for (let j = 0; j < info.height; j++) for (let i = 0; i < info.width; i++) {
  const k = (j * info.width + i) * info.channels;
  if (data[k] > 128 || data[k + 1] > 128) inked.push({ p: at(i, j), major: data[k] > 128 });
}

test('the face-ink mask is small: its size, its bytes and its memory on the GPU with mipmaps', () => {
  assert.deepEqual([info.width, info.height], FI.size);
  assert.ok(statSync(FILE).size < 40e3, `${statSync(FILE).size} bytes`);
  const mib = (FI.size[0] * FI.size[1] * 2 * 4) / 3 / 2 ** 20;   // RG8 with its mip chain
  assert.ok(mib < 0.8, `${mib.toFixed(2)} MiB`);
  assert.ok(inked.length > 1500 && inked.length < 12000, `${inked.length} inked texels`);
});

test('every line of the portrait lands on the head’s skin in front, none on the hair, the painted eyes or the brows', () => {
  // the frontmost vertex under each inked point (source-front projection, as the shader samples it)
  const cell = 0.008, grid = new Map();
  for (let v = 0; v < raw.count; v++) {
    const key = `${Math.round(raw.getX(v) / cell)},${Math.round(raw.getY(v) / cell)}`, z = raw.getZ(v);
    const was = grid.get(key);
    if (!was || z > raw.getZ(was)) grid.set(key, v);
  }
  let onHair = 0, front = 0, missing = 0;
  for (const { p: [x, y] } of inked) {
    let v;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const u = grid.get(`${Math.round(x / cell) + a},${Math.round(y / cell) + b}`); if (u !== undefined && (v === undefined || raw.getZ(u) > raw.getZ(v))) v = u; }
    if (v === undefined) { missing++; continue; }
    if (hair.getX(v) > 0.5) onHair++;
    if (raw.getZ(v) > 0.18) front++;
    for (const [ex, ey] of F.eyes) assert.ok(!(Math.abs(x - ex) < 0.08 && Math.abs(y - ey) < 0.04), `ink in an eye at ${x.toFixed(3)},${y.toFixed(3)}`);
    assert.ok(!(y > 0.56 && Math.abs(x) > 0.035), `ink on a brow at ${x.toFixed(3)},${y.toFixed(3)}`);
  }
  assert.equal(missing, 0);
  assert.ok(onHair < inked.length * 0.01, `${onHair} of ${inked.length} on the hair`);
  assert.ok(front > inked.length * 0.97, `${front} of ${inked.length} on the face's front`);
});

test('the lines are where the face has them: the mouth across the measured lips, the nose base above it', () => {
  const near = (y, h) => inked.filter(({ p, major }) => major && Math.abs(p[1] - y) < h);
  const mouth = near(F.mouthY + 0.012, 0.012), xs = mouth.map(({ p }) => p[0]);
  assert.ok(mouth.length > 150, `${mouth.length} mouth texels`);
  assert.ok(Math.min(...xs) < -F.mouthWidth * 0.9 && Math.max(...xs) > F.mouthWidth * 0.9, 'the mouth line spans the lips');
  const nose = near(0.39, 0.02);
  assert.ok(nose.length > 150 && nose.every(({ p }) => Math.abs(p[0]) < 0.08), 'nostrils and wings under the nose');
  assert.ok(inked.every(({ p }) => p[1] > 0.17), 'nothing baked under the jaw: the geometry draws it');
});

test('the face shader draws the mask and the jaw into the detail channel; without the mask (native VMs) it is off', () => {
  const ink = new T.DataTexture(new Uint8Array(4), 1, 1, T.RGFormat);
  const { head, humanoid: h } = createTravellerV1(buildCharacter(), { ...assets, faceInk: ink });
  const u = head.material.uniforms, fs = head.material.fragmentShader;
  assert.equal(u.uPortraitFaceInk.value, ink); assert.equal(u.uPortraitFaceAmount.value, 1);
  for (const s of ['texture(uPortraitFaceInk', 'phMajor', 'phMinor', 'phJaw', 'phHatch', 'float detail = max(']) assert.ok(fs.includes(s), s);
  assert.ok(!fs.includes('phFeatureInk'), 'the painted nose/lip marks no longer feed the ink');
  // expressions still drive the morphs over the drawn lines
  h.setExpression({ smile: 1 }); assert.ok(head.morphTargetInfluences[1] > 0);
  h.drawnFace.eyes(1, 0, null); assert.equal(head.morphTargetInfluences[0], 1);
  h.setExpression({}); h.drawnFace.eyes(0, 0, null); assert.ok(head.morphTargetInfluences.every((v) => v === 0));
  const bare = createTravellerV1(buildCharacter(), assets).head.material.uniforms;
  assert.equal(bare.uPortraitFaceAmount.value, 0);
});

test('native engine loading skips the face mask too', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { protocol: 'engine:' } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'location', previous); else delete globalThis.location; });
  assert.equal(await loadClothInk(FILE.replace('public/', ''), 2), null);
});

test('the bake is reproducible from the approved reference', () => {
  assert.ok(readFileSync('scripts/tripo/bake-face-ink.mjs', 'utf8').includes('head-v3/reference/front.png'));
});
