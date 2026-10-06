// Nothing in the composite is fixed to the screen (docs/systems/rendering.md, "Nothing fixed to the screen"):
// the paper's grain and tooth and the vignette are gone, and the ink lines' wobble and pressure are read on the
// view's direction in the world (post.js LINE_NOISE), so they turn with the world as the camera turns.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPost, PRESETS, LINE_NOISE, lineNoiseTexture } from '../src/post.js';

const shaderOf = (post) => post.scene.children[0].material.fragmentShader;
const mainBody = (src) => src.slice(src.indexOf('void main()'));

test('no paper grain, paper tooth or vignette: nothing laid over the frame by its screen position', () => {
  const post = createPost(), src = shaderOf(post), main = mainBody(src);
  assert.ok(!/vnoise\(fc\b/.test(main), 'no value noise of the screen position');
  assert.ok(!/tScreen|uNoiseBaked|uPaper|uGrain/.test(src), 'no baked screen noise, no paper');
  assert.ok(!/length\(q\)/.test(main), 'no vignette');
  for (const k of ['uPaper', 'uGrain', 'tScreenA', 'tScreenB']) assert.equal(post.uniforms[k], undefined, k);
  for (const [name, p] of Object.entries(PRESETS)) {
    assert.equal(p.uPaper, undefined, `${name}: no paper`);
    assert.equal(p.uGrain, undefined, `${name}: no grain`);
  }
});

test("the ink lines' noise is read on the view's direction, at the old field's size a pixel, whatever the field of view", () => {
  const src = shaderOf(createPost()), main = mainBody(src);
  assert.match(main, /vec4 sn = lineNoise\(rd, boilT\);/);
  assert.match(src, new RegExp(`float s = ${LINE_NOISE.cells} \\* 0\\.5 \\* uRes\\.y \\* uProj11 / uPixelRatio;`));
  // three planar taps on the direction, blended toward the facing axis, the contrast put back
  assert.equal((src.match(/lineTap\(d\.(yz|zx|xy) \* s/g) ?? []).length, 3);
  assert.match(src, /inversesqrt\(dot\(w, w\)\)/);
  // boiling lines re-roll it, within the tile
  assert.match(src, /mod\(boilT \* vec2\(17\.3, 11\.1\), /);
  // a cell a pixel: one radian is the focal length in CSS px (720 px tall at 60°: 623 px), so 0.06 cells a px
  const focal = 0.5 * 720 / Math.tan(Math.PI / 6);
  assert.ok(Math.abs((LINE_NOISE.cells * 0.5 * 720 * (1 / Math.tan(Math.PI / 6))) / focal - LINE_NOISE.cells) < 1e-9);
});

test("the lines' noise texture: tiling random texels, smooth between them, the same on every run", () => {
  const a = lineNoiseTexture(), b = lineNoiseTexture();
  const n = LINE_NOISE.size;
  assert.equal(a.image.width, n); assert.equal(a.image.height, n);
  assert.deepEqual(a.image.data, b.image.data, 'deterministic');
  assert.equal(a.wrapS, THREE.RepeatWrapping); assert.equal(a.wrapT, THREE.RepeatWrapping);
  assert.equal(a.magFilter, THREE.LinearFilter); assert.equal(a.minFilter, THREE.LinearFilter);
  assert.equal(a.generateMipmaps, false);
  // spread over the whole range in every channel, centred
  for (let c = 0; c < 4; c++) {
    let s = 0, lo = 255, hi = 0;
    for (let i = c; i < a.image.data.length; i += 4) { const v = a.image.data[i]; s += v; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const mean = s / (n * n);
    assert.ok(Math.abs(mean - 127.5) < 4, `channel ${c} mean ${mean}`);
    assert.ok(lo < 3 && hi > 252, `channel ${c} range`);
  }
});
