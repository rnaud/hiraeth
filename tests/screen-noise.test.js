// The composite's screen-fixed noise (post.js SCREEN_NOISE: the ink lines' wobble, pressure and inner
// weight, the paper's fibre and tooth), baked once per frame size instead of ten value-noise lookups a
// pixel (docs/systems/performance.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPost, noiseKey } from '../src/post.js';

const fakeRenderer = () => {
  const calls = [];
  let target = 'screen';
  return { calls, getRenderTarget: () => target, setRenderTarget: (t) => { target = t; }, render: (scene) => calls.push({ scene, target }) };
};
const sized = (post, w, h, pr, lite = 0) => { post.uniforms.uRes.value.set(w, h); post.uniforms.uPixelRatio.value = pr; post.uniforms.uPostLite.value = lite; };
const shaderOf = (post) => post.scene.children[0].material.fragmentShader;
const mainBody = (src) => src.slice(src.indexOf('void main()'));

test('the noise is baked once per size, pixel ratio and handheld mode, and the target is put back', () => {
  const post = createPost(), r = fakeRenderer();
  sized(post, 3456, 2234, 2);
  assert.equal(post.bakeNoise(r), true);
  assert.equal(r.calls.length, 2, 'the lines\' noise and the paper\'s');
  assert.ok(r.calls.every((c) => c.scene === post.bakeScene && c.target !== 'screen'));
  assert.equal(r.getRenderTarget(), 'screen');
  assert.equal(post.bakeNoise(r), false, 'the same frame: nothing to do');
  assert.equal(r.calls.length, 2);
  for (const [w, h, pr, lite] of [[2592, 1676, 1.5, 0], [2592, 1676, 1.5, 1], [2592, 1676, 2, 1]]) {
    sized(post, w, h, pr, lite);
    assert.equal(post.bakeNoise(r), true, `${w}x${h}@${pr} lite ${lite}`);
  }
  assert.equal(r.calls.length, 8);
  const [a, b] = [post.uniforms.tScreenA.value.image, post.uniforms.tScreenB.value.image];
  assert.deepEqual([a.width, a.height, b.width, b.height], [2592, 1676, 2592, 1676]);
});

test('the composite reads the bake only when it matches the frame (a portrait at another pixel ratio works it out)', () => {
  const post = createPost(), r = fakeRenderer(), quad = post.scene.children[0], U = post.uniforms;
  sized(post, 1920, 1080, 1.5);
  quad.onBeforeRender();
  assert.equal(U.uNoiseBaked.value, 0, 'not baked yet');
  post.bakeNoise(r);
  quad.onBeforeRender();
  assert.equal(U.uNoiseBaked.value, 1);
  U.uPixelRatio.value = 0.6;   // (captureView's portrait: drawn as if small)
  quad.onBeforeRender();
  assert.equal(U.uNoiseBaked.value, 0);
  U.uPixelRatio.value = 1.5;
  quad.onBeforeRender();
  assert.equal(U.uNoiseBaked.value, 1);
  assert.notEqual(noiseKey(U), (U.uPostLite.value = 1, noiseKey(U)));
});

test('no value noise of the screen position is left in the composite\'s main', () => {
  const src = shaderOf(createPost());
  assert.ok(!/vnoise\(fc\b/.test(mainBody(src)), 'main() reads the bake (or calls screenLines / screenPaper)');
  assert.match(mainBody(src), /uNoiseBaked > 0\.5 && boilT == 0\.0 \? texelFetch\(tScreenA/, 'boiling lines are worked out per frame');
  assert.match(mainBody(src), /uNoiseBaked > 0\.5 \? texelFetch\(tScreenB/);
});

test('the bake and the composite share the same noise code', () => {
  const post = createPost();
  const comp = shaderOf(post), bake = post.bakeScene.children[0].material.fragmentShader;
  for (const fn of ['float hash(vec2 p)', 'float vnoise(vec2 p)', 'vec4 screenLines(vec2 fc, float boilT)', 'vec2 screenPaper(vec2 fc, bool tooth)']) {
    const grab = (s) => { const i = s.indexOf(fn); assert.ok(i >= 0, fn); return s.slice(i, s.indexOf('\n  }', i)); };
    assert.equal(grab(bake), grab(comp), fn);
  }
  assert.match(bake, /gl_FragCoord\.xy \/ uPixelRatio/);
});
