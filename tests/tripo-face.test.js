import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { tripoFaceState, TRIPO_FACE, TRIPO_FACE_GLSL } from '../src/characters/tripo-face.js';
import { cleanExpression, TONE_EXPRESSIONS } from '../src/expression.js';
import { TalkFace } from '../src/talk-face.js';
import { markHero } from '../src/materials.js';

// The coral-shirt traveller's drawn face (src/characters/tripo-face.js): the expression channels move
// his brows, lids, iris and mouth; the blink shuts the lids; talking opens and shuts the mouth.

const state = (e, o) => tripoFaceState(cleanExpression(e), o);
const rest = state({});

test('the face at neutral is drawn where the paint had it', () => {
  const B = TRIPO_FACE.brow;
  assert.deepEqual(rest.brow.slice(0, 6), [...B.inner, ...B.peak, ...B.outer]);
  assert.deepEqual(rest.eye, [0, 0, 0, 0]);
  assert.equal(rest.mouth[0], TRIPO_FACE.mouth.w);
  assert.equal(rest.mouth[1], 0);
  assert.equal(rest.mouth[2], 0);
});

test('each channel moves its part of the face', () => {
  const smile = state({ smile: 0.8 }), frown = state({ smile: -0.6 });
  assert.ok(smile.mouth[1] > 0.002 && frown.mouth[1] < -0.002, 'the corners up with a smile, down with a frown');
  assert.ok(smile.mouth[0] > rest.mouth[0], 'a smile widens the mouth');
  assert.ok(smile.eye[1] > 0.3, 'and lifts the lower lids');
  const open = state({ open: 0.8 });
  assert.ok(open.mouth[2] > 0.01 && open.mouth[3] > 0, 'open: the lower lip drops, the upper lifts');
  const up = state({ brow: 1 }), down = state({ brow: -1 });
  for (const i of [1, 3, 5]) assert.ok(up.brow[i] > rest.brow[i] + 0.003 && down.brow[i] < rest.brow[i], 'the brows raised and lowered');
  assert.ok(down.brow[0] < rest.brow[0] - 0.002, 'lowered brows are drawn together');
  assert.ok(up.eye[0] < 0, 'raised brows open the eyes wider');
  const worry = state({ browTilt: 1 }), anger = state({ browTilt: -1 });
  const lift = (s) => (s.brow[1] - rest.brow[1]) - (s.brow[5] - rest.brow[5]);
  assert.ok(lift(worry) > 0.004 && lift(anger) < -0.004, 'the inner ends up for worry, down for anger');
  const squint = state({ squint: 1 });
  assert.ok(squint.eye[0] > 0.4 && squint.eye[0] < 0.6 && squint.eye[1] > 0.4, 'a squint narrows both lids');
  // every tone draws a different face from rest (but neutral)
  for (const [tone, e] of Object.entries(TONE_EXPRESSIONS)) {
    const s = state(e), moved = [...s.brow, ...s.eye, ...s.mouth].some((v, i) => Math.abs(v - [...rest.brow, ...rest.eye, ...rest.mouth][i]) > 1e-4);
    assert.equal(moved, Object.keys(e).some((k) => k !== 'gaze'), `the ${tone} face`);
  }
});

test('the blink shuts the lids and the gaze moves the irises, within the eye', () => {
  assert.equal(state({}, { blink: 1 }).eye[0], 1);
  assert.equal(state({ brow: 1 }, { blink: 1 }).eye[0], 1, 'a blink shuts even wide eyes');
  assert.ok(Math.abs(state({}, { blink: 0.5 }).eye[0] - 0.5) < 1e-9);
  const right = state({}, { look: [0.3, 0] }), down = state({}, { look: [0, -0.2] }), far = state({}, { look: [0.99, 0.9] });
  assert.ok(right.eye[2] > 0.002 && right.eye[3] === 0);
  assert.ok(down.eye[3] < -0.001);
  assert.ok(far.eye[2] <= 0.0046 + 1e-9 && far.eye[3] <= 0.0022 + 1e-9, 'clamped: the iris stays in the eye');
});

test('the shader draws over the painted face, on the front of the head only', () => {
  assert.match(TRIPO_FACE_GLSL, /vec3 tripoFace\(vec3 albedo, vec3 b, float aa\)/);
  for (const u of ['uTfBrowA', 'uTfBrowB', 'uTfEye', 'uTfMouth']) assert.ok(TRIPO_FACE_GLSL.includes(`uniform vec4 ${u};`));
  assert.ok(TRIPO_FACE_GLSL.includes(`b.z < ${TRIPO_FACE.front}`), 'not on the back of the head');
});

// the real body (as glove.test.js loads it)
const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
async function traveller() {
  const { parseBody } = await import('../src/makehuman/body.js');
  const { createTravellerV1 } = await import('../src/characters/traveller-v1.js');
  const { buildCharacter } = await import('../src/player.js');
  const b = readFileSync('public/anim/mh/body.bin'), data = parseBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const dir = 'public/characters/traveller-v1/';
  const report = JSON.parse(readFileSync(dir + 'rig.json')), colors = JSON.parse(readFileSync(dir + 'colors.json'));
  const g = readFileSync(dir + 'model.glb'), n = g.readUInt32LE(12), json = JSON.parse(g.toString('utf8', 20, 20 + n)), bin = g.subarray(28 + n);
  json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
  delete json.images; delete json.textures; delete json.materials; for (const m of json.meshes) for (const p of m.primitives) delete p.material;
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  const char = buildCharacter();
  return { char, ...createTravellerV1(char, { gltf, data, report, colors }) };
}

test('on his body: the expression, the blink and the talking mouth reach his material', async () => {
  const { char, humanoid: h, mesh } = await traveller();
  assert.ok(h.drawnFace, 'his humanoid draws a face');
  assert.ok(mesh.material.fragmentShader.includes('albedo = tripoFace(albedo, vBind'), 'his body\'s shader draws it');
  assert.ok(!mesh.material.vertexShader.includes('tripoFace'));
  assert.ok(h.restExpression.smile > 0, 'resting with a little smile');
  // the player's copies of his materials (markHero) still get the face
  markHero(char.root);
  const u = () => mesh.material.uniforms;
  h.setExpression(TONE_EXPRESSIONS.angry);
  assert.ok(u().uTfMouth.value.y < 0 && u().uTfBrowA.value.y < TRIPO_FACE.brow.inner[1] - 0.003, 'angry: the corners down, the inner brows down');
  h.setExpression(TONE_EXPRESSIONS.happy);
  assert.ok(u().uTfMouth.value.y > 0.002 && u().uTfEye.value.y > 0.3, 'happy: the corners up, the cheeks lift the lids');
  // the blink (Humanoid.updateEyes, the eyes' own clock)
  char.root.updateMatrixWorld(true);
  h.eyeLook.update = function () { this.blink = 1; };
  h.updateEyes(1 / 60, null);
  assert.equal(u().uTfEye.value.x, 1, 'the lids shut on a blink');
  h.eyeLook.update = function () { this.blink = 0; };
  h.updateEyes(1 / 60, null);
  assert.ok(u().uTfEye.value.x < 0.2, 'and open again');
  // talking: the mouth opens and shuts on the syllables, and closes after the line
  const f = new TalkFace(h);
  let lo = Infinity, hi = 0;
  for (let i = 0; i < 90; i++) {
    const mouth = i % 12 < 6 ? 0.9 : 0;   // syllables
    f.update(1 / 60, { speaking: true, tone: 'neutral', mouth });
    if (i > 30) { lo = Math.min(lo, u().uTfMouth.value.z); hi = Math.max(hi, u().uTfMouth.value.z); }
  }
  assert.ok(hi > 0.004 && lo < hi * 0.5, `the mouth moves while he talks (${lo.toFixed(4)}..${hi.toFixed(4)})`);
  for (let i = 0; i < 400; i++) f.update(1 / 60, {});
  assert.ok(u().uTfMouth.value.z < 1e-4, 'shut after the line');
});
