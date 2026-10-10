// The traveller's face drawn over his generated head (src/characters/head-ink.js): the Moebius eye, the
// channels, the camera's side for the nose line, and the shader's parts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HEAD_INK, EYE_CHANGE, headInkState, headSide, HEAD_INK_GLSL } from '../src/characters/head-ink.js';
import { cleanExpression, expressionFor } from '../src/expression.js';

const E = HEAD_INK.eye;

test('a smaller, narrower eye than the paint\'s, its heavy lid cutting the top of the iris', () => {
  // the painted opening was 0.087 by 0.035 (2.5 : 1) round a whole iris of radius 0.016
  assert.ok(EYE_CHANGE.width < 0.97 && EYE_CHANGE.width > 0.85, `width ${EYE_CHANGE.width}`);
  assert.ok(EYE_CHANGE.height < 0.75 && EYE_CHANGE.height > 0.6, `height ${EYE_CHANGE.height}`);
  assert.ok(EYE_CHANGE.iris < 0.9, `iris ${EYE_CHANGE.iris}`);
  const aspect = (2 * E.w) / (E.up + E.lo);
  assert.ok(aspect > 3 && aspect < 3.8, `an almond of about 3.3 : 1, not a round anime eye (${aspect.toFixed(2)})`);
  // the upper lid over the iris's top; its foot on (or just under) the lower lid
  assert.ok(E.irisY + E.iris > E.up, 'the upper lid cuts the top of the iris');
  assert.ok(E.irisY - E.iris < -E.lo + 0.0005, 'the iris sits down on the lower lid');
  // the drawn eye lies inside the painted one it covers, so none of the paint's white is left round it
  const P = HEAD_INK.painted;
  assert.ok(E.x - E.w >= P.x - P.w && E.x + E.w <= P.x + P.w, 'within the covered width');
  assert.ok(E.y + E.up * 1.4 <= P.y + P.h && E.y - E.lo * 1.25 >= P.y - P.h, 'within the covered height, wide open too');
});

test('neutral: no shape key, the lids open, the iris ahead', () => {
  const s = headInkState(cleanExpression());
  assert.deepEqual(s.keys, [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(s.eye, [0, 0, 0, 0]);
  assert.deepEqual(s.speech, [0, 0]);
});

test('each channel: the blink shuts the drawn lids, raised brows open them wide, a smile lifts the lower lid', () => {
  const blink = headInkState(cleanExpression(), { blink: 1 });
  assert.equal(blink.eye[1], -1, 'shut');
  assert.equal(blink.keys[0], HEAD_INK.squeeze, 'the key only gathers the skin round the eye');
  assert.ok(HEAD_INK.squeeze > 0 && HEAD_INK.squeeze < 0.5);
  const half = headInkState(cleanExpression(), { blink: 0.5 });
  assert.equal(half.eye[1], -0.5);
  const gasp = headInkState(cleanExpression({ brow: 1 }));
  assert.equal(gasp.eye[1], 1, 'wide');
  assert.equal(headInkState(cleanExpression({ brow: 1 }), { blink: 1 }).eye[1], -1, 'a blink still shuts a wide eye');
  const smile = headInkState(cleanExpression({ smile: 1 }));
  assert.ok(smile.eye[0] > 0.4, 'the cheek lifts the lower lid');
  assert.equal(smile.keys[1], 1);
  const squint = headInkState(cleanExpression({ squint: 1 }));
  assert.ok(squint.eye[1] < -0.3 && squint.eye[1] > -0.6, 'a squint half shuts them');
  assert.ok(squint.eye[0] > 0.3, 'and lifts the lower lid');
  const talk = headInkState(expressionFor('happy', { talking: true, t: 0.1 }));
  assert.equal(talk.keys[5], talk.speech[0], 'the mouth key and the speech ink open together');
  for (const k of ['brow', 'browTilt', 'asymmetry']) {
    const x = headInkState(cleanExpression({ [k]: 0.7 }));
    assert.equal(x.keys[['blink', 'smile', 'brow', 'browTilt', 'asymmetry', 'open'].indexOf(k)], 0.7, k);
  }
});

test('the gaze moves the iris within its reach, into the same arrays every frame', () => {
  const out = headInkState(cleanExpression());
  const eye = out.eye;
  headInkState(cleanExpression(), { look: [10, -10] }, out);
  assert.equal(out.eye, eye, 'no new arrays');
  assert.equal(out.eye[2], HEAD_INK.gaze.x);
  assert.equal(out.eye[3], -HEAD_INK.gaze.y);
  headInkState(cleanExpression(), { look: [0.15, 0.1] }, out);
  assert.ok(Math.abs(out.eye[2] - HEAD_INK.gaze.x / 2) < 1e-9 && Math.abs(out.eye[3] - HEAD_INK.gaze.y / 2) < 1e-9);
  assert.ok(HEAD_INK.gaze.x < E.w - E.iris, 'the iris stays inside the eye');
});

test('the camera\'s side of his face', () => {
  assert.equal(headSide({ x: 0, y: 0, z: 1 }), 0);
  assert.ok(Math.abs(headSide({ x: 1, y: 0, z: 1 }) - Math.SQRT1_2) < 1e-9);
  assert.ok(headSide({ x: -3, y: 0.2, z: 0.1 }) < -0.9);
  assert.equal(headSide({ x: 0, y: 0, z: 0 }), 0);
});

test('the shader: the paint covered and evened out, the features drawn, no catchlight, detail by size', () => {
  const g = HEAD_INK_GLSL;
  for (const s of ['uniform vec4 uHeadEye', 'uniform float uHeadSide', 'vec3 headInk(vec3 albedo, vec3 hb, float ha)']) assert.ok(g.includes(s), s);
  assert.match(g, /the painted eyes covered/);
  assert.match(g, /one skin colour/);
  assert.match(g, /the upper lid: one heavy stroke/);
  assert.match(g, /the crease over the lid/);
  assert.match(g, /the nose: one line down its side/);
  assert.match(g, /the mouth: one line/);
  assert.doesNotMatch(g, /catchlight|highlight/i, 'no shine in the eye');
  // (GLSL's smoothstep is undefined with its edges reversed)
  for (const m of g.matchAll(/smoothstep\((-?[\d.]+), (-?[\d.]+),/g)) assert.ok(+m[1] < +m[2], `smoothstep(${m[1]}, ${m[2]})`);
  // the fine marks fade with the face's size on screen, before the mouth and the lids do
  assert.match(g, /float fine = 1\.0 - smoothstep\(([\d.]+), ([\d.]+), ha\), mid = 1\.0 - smoothstep\(([\d.]+), ([\d.]+), ha\)/);
});
