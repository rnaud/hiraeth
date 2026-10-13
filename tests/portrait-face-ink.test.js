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
import { TONE_EXPRESSIONS } from '../src/expression.js';
import { faceLandmarks } from '../scripts/tripo/face-landmarks.mjs';

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

// Issue #266: the portrait's nose and mouth lines on the mesh's own nose and mouth (scripts/tripo/face-landmarks.mjs),
// not where the portrait has them. Millimetres on the game's head (1 source unit = PORTRAIT_HEAD.scale m).
const MM = F.scale * 1000, L = faceLandmarks(source.geometry);
const creaseY = (crease, x) => { const i = crease.findIndex((q) => q[0] >= x); const a = crease[i - 1], b = crease[i]; return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]); };
/** The mouth's ink, column by column (0.005 wide), against the valley between the lips: its middle's offset, mm. */
function mouthOffsets(points, crease, corners, stomion) {
  const cols = new Map();
  for (const [x, y] of points) if (y > stomion - 0.03 && y < stomion + 0.03 && x > corners[0] && x < corners[1]) { const k = Math.round(x / 0.005); (cols.get(k) ?? cols.set(k, []).get(k)).push(y); }
  return [...cols].filter(([, ys]) => ys.length >= 2).map(([k, ys]) => (ys.reduce((a, b) => a + b) / ys.length - creaseY(crease, k * 0.005)) * MM);
}
const red = inked.filter(({ major }) => major).map(({ p }) => p);

test('the mouth line lies on the parting of the lips, corner to corner', () => {
  const off = mouthOffsets(red, L.mouth.crease, L.mouth.corners, L.mouth.stomion);
  assert.ok(off.length >= 30, `${off.length} columns of mouth`);
  const mean = off.reduce((a, b) => a + b) / off.length, worst = Math.max(...off.map(Math.abs));
  // (the unmoved portrait's line sat 4.0 mm above it on average, 5.6 at worst: on the upper lip)
  assert.ok(Math.abs(mean) < 0.5 && worst < 1.0, `mean ${mean.toFixed(2)} mm, worst ${worst.toFixed(2)} mm`);
  const xs = red.filter(([, y]) => Math.abs(y - L.mouth.stomion) < 0.02).map(([x]) => x);
  assert.ok(Math.min(...xs) < L.mouth.corners[0] + 0.01 && Math.max(...xs) > L.mouth.corners[1] - 0.01, 'the line reaches both corners');
});

test('the nose base is on the nose: wings on their grooves, nostrils above its lower outline, nothing on its front', () => {
  const nose = red.filter(([x, y]) => y > L.subnasale[1] - 0.01 && y < L.wings.top + 0.005 && x > L.wings.left - 0.02 && x < L.wings.right + 0.02);
  const left = Math.min(...nose.map(([x]) => x)), right = Math.max(...nose.map(([x]) => x)), low = Math.min(...nose.map(([, y]) => y));
  assert.ok(Math.abs(left - L.wings.left) * MM < 1 && Math.abs(right - L.wings.right) * MM < 1, `wings ${((left - L.wings.left) * MM).toFixed(2)}, ${((right - L.wings.right) * MM).toFixed(2)} mm off their grooves`);
  assert.ok(Math.abs(low - L.wings.foot) * MM < 1, `the nose base ${((low - L.wings.foot) * MM).toFixed(2)} mm off the outline under the wings`);
  const nostrils = nose.filter(([x, y]) => Math.abs(x - L.ridge) < 0.04 && y < L.tip[1]);
  const cy = nostrils.reduce((s, p) => s + p[1], 0) / nostrils.length, cx = nostrils.reduce((s, p) => s + p[0], 0) / nostrils.length;
  // (unmoved, they sat 5.4 mm above the outline, on the nose's front)
  assert.ok(nostrils.length > 150 && (cy - L.wings.foot) * MM > 1 && (cy - L.wings.foot) * MM < 4, `nostrils ${((cy - L.wings.foot) * MM).toFixed(2)} mm above the outline`);
  assert.ok(Math.abs(cx - L.ridge) * MM < 1, 'the nostrils either side of the nose’s own centre line');
  assert.ok(!red.some(([x, y]) => Math.abs(x - L.ridge) < 0.012 && y > L.wings.foot + 0.012 && y < L.tip[1] + 0.02), 'nothing on the tip of the nose');
});

test('under the mouth: the lower lip’s stroke on its lower edge, the chin’s mark just under the hollow', () => {
  const green = inked.filter(({ major }) => !major).map(({ p }) => p);
  const edge = L.lowerLip[2][1], lip = green.filter(([x, y]) => Math.abs(x - L.ridge) < 0.05 && y < L.mouth.stomion - 0.008 && y > L.fold[1]);
  const chin = green.filter(([x, y]) => Math.abs(x - L.ridge) < 0.06 && y <= L.fold[1] && y > L.fold[1] - 0.03);
  const mean = (a) => a.reduce((s, p) => s + p[1], 0) / a.length;
  // (unmoved, the lip's stroke sat 7.7 mm up on the lip itself and the chin's mark 4 mm above the hollow)
  assert.ok(lip.length > 80 && Math.abs(mean(lip) - edge) * MM < 1, `the lip's stroke ${((mean(lip) - edge) * MM).toFixed(2)} mm off its edge`);
  assert.ok(chin.length > 30 && (L.fold[1] - mean(chin)) * MM > 0.5 && (L.fold[1] - mean(chin)) * MM < 3.5, `the chin's mark ${((L.fold[1] - mean(chin)) * MM).toFixed(2)} mm under the hollow`);
  assert.ok(inked.every(({ p }) => p[1] > 0.17), 'nothing baked under the jaw: the geometry draws it');
});

test('in every expression the mouth line stays on the lips: talking, happy, sad, angry', () => {
  // the face's shape keys (portrait-head.js) moved over the source mesh, the ink carried on the skin it was laid on
  const { head, humanoid: h } = createTravellerV1(buildCharacter(), assets);
  const keys = head.geometry.morphAttributes.position;
  const atRest = red.filter(([x, y]) => Math.abs(y - L.mouth.stomion) < 0.03).map(([x, y]) => L.surface(x, y)).filter(Boolean);
  for (const [name, e] of [['talking', { open: 0.45 }], ['happy', TONE_EXPRESSIONS.happy], ['sad', TONE_EXPRESSIONS.sad], ['angry', TONE_EXPRESSIONS.angry]]) {
    h.setExpression(e);
    const w = head.morphTargetInfluences, g = source.geometry.clone(), q = g.attributes.position;
    for (let v = 0; v < q.count; v++) for (let k = 0; k < keys.length; k++) if (w[k]) {
      q.setXYZ(v, q.getX(v) + (w[k] * keys[k].getX(v)) / F.scale, q.getY(v) + (w[k] * keys[k].getY(v)) / F.scale, q.getZ(v) + (w[k] * keys[k].getZ(v)) / F.scale);
    }
    g.computeVertexNormals();
    assert.ok(w.some((v) => v > 0.1), `${name} moves the face`);
    const moved = atRest.map(({ face, bary }) => [0, 1].map((c) => face.reduce((s, v, i) => s + bary[i] * (c ? q.getY(v) : q.getX(v)), 0)));
    const M = faceLandmarks(g), off = mouthOffsets(moved, M.mouth.crease, M.mouth.corners, M.mouth.stomion);
    const mean = off.reduce((a, b) => a + b) / off.length, worst = Math.max(...off.map(Math.abs));
    if (process.env.FACE_DIAG) console.log(name, mean.toFixed(2), worst.toFixed(2), off.length);
    assert.ok(off.length >= 20 && Math.abs(mean) < 0.8 && worst < 1.6, `${name}: mean ${mean.toFixed(2)} mm, worst ${worst.toFixed(2)} mm (${off.length} columns)`);
    g.dispose();
  }
  h.setExpression({});
});

test('the face shader draws the mask and the jaw into the detail channel; without the mask (native VMs) it is off', () => {
  const ink = new T.DataTexture(new Uint8Array(4), 1, 1, T.RGFormat);
  const { head, humanoid: h } = createTravellerV1(buildCharacter(), { ...assets, faceInk: ink });
  const u = head.material.uniforms, fs = head.material.fragmentShader;
  assert.equal(u.uPortraitFaceInk.value, ink); assert.equal(u.uPortraitFaceAmount.value, 1);
  for (const s of ['texture(uPortraitFaceInk', 'phMajor', 'phMinor', 'phJaw', 'phHatch', 'float detail = max(']) assert.ok(fs.includes(s), s);
  // the jaw line keeps to the skull, the hatching to the throat behind it (never the chin: it read as stubble)
  assert.match(fs, /phJawZone=[^;]*phSkull/); assert.match(fs, /phThroat=\(1\.0-phSkull\)/);
  assert.ok(!fs.includes('phFeatureInk'), 'the painted nose/lip marks no longer feed the ink');
  // (#266) lines laid on skin the view sees more squarely than the front does stay pen lines; the near nostril's
  // outer end gives way once the view is round to its side: the view's direction in the head's own frame, each draw
  assert.ok(fs.includes('fiStretch') && fs.includes('phNostril') && fs.includes('uniform vec3 uHeadView'));
  const side = new T.PerspectiveCamera(), at = h.drawnFace.at(h.b.Head, new T.Vector3());
  side.position.copy(at).add(new T.Vector3(1, 0, 0.2)); side.updateMatrixWorld();
  head.onBeforeRender(null, null, side, head.geometry, head.material);
  const view = u.uHeadView.value;
  assert.ok(Math.abs(view.x) > 0.9 && Math.abs(view.length() - 1) < 1e-6, `the view from the side, in the head's frame: ${view.toArray().map((v) => v.toFixed(2))}`);
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

test('the throat is where the jaw line and the hatching part: behind the chin, in front of the neck’s sides', () => {
  // the frontmost skin at the chin's middle (y 0.16) is the skull's side, the throat under it (y 0.08) the hatching's
  const front = (x, y) => { let z = -9; for (let v = 0; v < raw.count; v++) if (hair.getX(v) < 0.5 && Math.abs(Math.abs(raw.getX(v)) - x) < 0.01 && Math.abs(raw.getY(v) - y) < 0.01) z = Math.max(z, raw.getZ(v)); return z; };
  const limit = (x) => FI.throat[0] - FI.throat[1] * x;
  for (const x of [0, 0.04, 0.08]) {
    assert.ok(front(x, 0.16) > limit(x) + 0.03, `chin at x ${x}: ${front(x, 0.16).toFixed(3)}`);
    assert.ok(front(x, 0.08) < limit(x) - 0.02, `throat at x ${x}: ${front(x, 0.08).toFixed(3)}`);
  }
});

test('the freckles are a few small dots on the cheek, not the shadow shape’s edge', () => {
  // (outside the nose's wings, which reach 0.072 on the mesh's own nose since #266)
  const cheek = inked.filter(({ p: [x, y] }) => Math.abs(x) > 0.085 && Math.abs(x) < 0.2 && y > 0.38 && y < 0.52);
  assert.ok(cheek.length >= 8 && cheek.length < 120, `${cheek.length} cheek texels`);
});

test('the bake is reproducible from the approved reference', () => {
  assert.ok(readFileSync('scripts/tripo/bake-face-ink.mjs', 'utf8').includes('head-v3/reference/front.png'));
});
