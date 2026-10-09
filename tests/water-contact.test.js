// The water's contact foam: little waves lapping round whatever stands in the water (src/water-shader.js CONTACT,
// src/water.js renderGBuffer). The band's width by distance, the fades, the quality toggle, the screen rectangle the
// depth copy is cut to, the two-step G-buffer pass, and the shader's intersection term and its gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeMaterial, MODE_WATER } from '../src/materials.js';
import { Waters, screenRect, CONTACT_SINK } from '../src/water.js';
import { CONTACT, contactBand, contactFade, waterShared, WATER_GLSL } from '../src/water-shader.js';
import { QUALITY_PRESETS, waterContactOn } from '../src/perf.js';

test('the band is CONTACT.band close up, never under minPx on screen, at most maxBand', () => {
  assert.equal(contactBand(0.005), CONTACT.band);
  const mid = 0.08;
  assert.ok(Math.abs(contactBand(mid) - CONTACT.minPx * mid) < 1e-9, 'past the near band it is minPx pixels wide');
  assert.equal(contactBand(5), CONTACT.maxBand);
  let last = 0;
  for (let px = 0.001; px < 1; px *= 1.3) { const b = contactBand(px); assert.ok(b >= last - 1e-12, 'grows with distance'); last = b; }
  for (let px = 0.001; px < CONTACT.maxBand / CONTACT.minPx; px *= 1.3) assert.ok(contactBand(px) / px >= CONTACT.minPx - 1e-9, `at least ${CONTACT.minPx} px at ${px}`);
  assert.ok(contactBand(0.08, 2) > contactBand(0.08, 1), 'scaled by the pixel ratio like the ink lines');
});

test('the detail fades before the band, the band is gone by CONTACT.far', () => {
  assert.deepEqual(contactFade(0.001), { all: 1, detail: 1 });
  assert.equal(contactFade(CONTACT.far[1] + 0.01).all, 0);
  assert.equal(contactFade(CONTACT.detail[1]).detail, 0);
  assert.ok(contactFade(CONTACT.detail[1]).all > 0.99, 'the band stays where its detail has gone');
  assert.ok(CONTACT.detail[1] <= CONTACT.far[0]);
  // where it goes, it is still minPx wide (no doubled line round the object's own outline)
  assert.ok(contactBand(CONTACT.far[0]) / CONTACT.far[0] >= CONTACT.minPx - 1e-9);
});

test('the sunk depth lies deeper than the band and its wavelets reach where they are drawn', () => {
  // the ray's run through the water is at least the depth under the surface: past CONTACT_SINK it meets the sunk
  // water, so the band must be done by then wherever its detail shows, and the band alone to the far fade
  const reach = (px) => contactBand(px) * (1 + CONTACT.breathe) + Math.max(CONTACT.gap, CONTACT.gapPx * px) * 4;
  assert.ok(reach(CONTACT.detail[1]) < CONTACT_SINK, `${reach(CONTACT.detail[1])}`);
  assert.ok(reach(0.001) < CONTACT_SINK);
});

test('every preset says whether it draws the contact foam', () => {
  for (const [id, p] of Object.entries(QUALITY_PRESETS)) assert.equal(typeof waterContactOn(p), 'boolean', id);
  assert.equal(waterContactOn(QUALITY_PRESETS.high), true);
  assert.equal(waterContactOn(QUALITY_PRESETS.handheld), false, 'the handheld keeps one plain pass (a tiled GPU stores the depth for it)');
  assert.equal(waterContactOn({ ...QUALITY_PRESETS.high, waterContact: false }), false);
});

test('screenRect: the pixels the water covers, whole target when behind, null off screen', () => {
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  cam.position.set(0, 5, 10); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const small = new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 0, 1));
  const r = screenRect([small], vp, 1600, 900);
  assert.ok(r.x > 600 && r.x + r.w < 1000 && r.y > 200 && r.y + r.h < 700, JSON.stringify(r));
  const huge = new THREE.Box3(new THREE.Vector3(-500, 0, -500), new THREE.Vector3(500, 0, 500));
  assert.deepEqual(screenRect([huge], vp, 1600, 900), { x: 0, y: 0, w: 1600, h: 900 });
  const aside = new THREE.Box3(new THREE.Vector3(200, 0, -1), new THREE.Vector3(202, 0, 1));
  assert.equal(screenRect([aside], vp, 1600, 900), null);
});

function pond() {
  const scene = new THREE.Scene();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2), makeMaterial({ color: '#4c8fb0', color2: '#8fc7d9', mode: MODE_WATER }));
  scene.add(water);
  const rock = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), makeMaterial({ color: '#888888' }));
  scene.add(rock);
  const waters = new Waters(scene, { drops: false });
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  cam.position.set(0, 14, 45); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  const target = new THREE.WebGLRenderTarget(320, 180, { count: 3 });
  const calls = [];
  const renderer = {
    render(o, c) { calls.push({ o, material: o.material, depthWrite: o.material?.depthWrite, visible: water.visible, contact: waterShared.uWaterContact.value, scissor: o.isMesh && c.isOrthographicCamera ? this.target?.scissor.clone() : null }); },
    setRenderTarget(t) { this.target = t; },
  };
  return { scene, water, waters, cam, target, renderer, calls };
}

test('renderGBuffer: the scene without the water, its depth copied, then the water reading it', () => {
  const { scene, water, waters, cam, target, renderer, calls } = pond();
  assert.equal(waters.renderGBuffer(renderer, scene, cam, target), 'fresh', 'no depth texture: never reused');
  assert.equal(calls.length, 4);
  assert.equal(calls[0].o, water); assert.equal(calls[0].material.colorWrite, false, 'first the water\'s depth alone, sunk');
  assert.equal(calls[0].material.uniforms.uSink.value, CONTACT_SINK);
  assert.equal(calls[1].o, scene); assert.equal(calls[1].visible, false, 'the scene drawn without the water');
  assert.ok(calls[2].scissor && calls[2].scissor.z < 320, 'the depth copy cut to the water on screen');
  assert.equal(calls[3].o, water); assert.equal(calls[3].contact, 1, 'the water drawn with the contact term on');
  assert.equal(calls[3].material, water.material, 'its own material back');
  assert.equal(calls[3].depthWrite, false, 'the water writes no depth: the buffer keeps the scene\'s for the next frame');
  assert.equal(water.material.depthWrite, true);
  assert.equal(water.visible, true);
  assert.equal(waterShared.uWaterContact.value, 0, 'off again for every other draw (portraits, the studio)');
  assert.equal(waterShared.uSceneDepth.value, waters.depthCopy.texture);
  assert.equal(waterShared.uSceneNearFar.value.z, 0, 'no depth texture: RT1.w copied, a view depth already');
  waters.dispose();
});

test('renderGBuffer: a G-buffer with a depth texture has its depth blitted, the rectangle only', () => {
  const { scene, waters, cam, renderer, calls } = pond();
  const target = new THREE.WebGLRenderTarget(320, 180, { count: 3, depthTexture: new THREE.DepthTexture(320, 180, THREE.UnsignedIntType) });
  const blits = [];
  renderer.copyTextureToTexture = (src, dst, box, at) => blits.push({ src, dst, box: box.clone(), at: at.clone() });
  renderer.initRenderTarget = () => {};
  waters.renderGBuffer(renderer, scene, cam, target);
  assert.equal(blits.length, 1);
  assert.equal(blits[0].src, target.depthTexture);
  assert.equal(blits[0].dst, waterShared.uSceneDepth.value);
  assert.ok(blits[0].box.max.x - blits[0].box.min.x < 320 && blits[0].at.x === blits[0].box.min.x);
  assert.deepEqual(waterShared.uSceneNearFar.value.toArray(), [cam.near, cam.far, 1]);
  assert.equal(calls.length, 3, 'the sunk depth, the scene, the water: no shader copy');
  // the next frame, the camera barely moved: last frame's depth reprojected, the copy after the water
  calls.length = 0; blits.length = 0;
  const vp0 = waterShared.uScenePrevVP.value.clone();
  cam.position.x += 0.2; cam.updateMatrixWorld();
  assert.equal(waters.renderGBuffer(renderer, scene, cam, target), 'reused');
  assert.deepEqual(waterShared.uScenePrevVP.value.toArray(), vp0.toArray(), 'the water reads with the camera the depth was taken with');
  assert.equal(blits.length, 1);
  // a cut: this frame's copied in the middle of the pass
  cam.position.set(30, 14, 45); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  assert.equal(waters.renderGBuffer(renderer, scene, cam, target), 'fresh');
  cam.rotateY(0.3); cam.updateMatrixWorld();
  assert.equal(waters.renderGBuffer(renderer, scene, cam, target), 'fresh', 'a quick turn too');
  waters.dispose();
});

test('renderGBuffer: one plain pass when the preset turns it off, under water, or with no water in view', () => {
  const { scene, waters, cam, target, renderer, calls } = pond();
  waters.contact = false;
  assert.equal(waters.renderGBuffer(renderer, scene, cam, target), false);
  waters.contact = true;
  waters.camUnder = { y: 0 };
  assert.equal(waters.renderGBuffer(renderer, scene, cam, target), false);
  waters.camUnder = null;
  cam.lookAt(0, 30, 100); cam.updateMatrixWorld();   // (looking away, up)
  assert.equal(waters.renderGBuffer(renderer, scene, cam, target), false);
  assert.deepEqual(calls.map((c) => c.o), [scene, scene, scene]);
  assert.ok(calls.every((c) => c.visible && c.contact === 0));
});

test('the shader: the depth-difference term, read only behind its gate, its noise in the world', () => {
  const fn = WATER_GLSL.slice(WATER_GLSL.indexOf('float contactFoam('), WATER_GLSL.indexOf('WaterLook waterLook('));
  assert.match(WATER_GLSL, /uniform highp sampler2D uSceneDepth;/);
  assert.match(WATER_GLSL, /uniform float uWaterContact;/);
  const gate = fn.indexOf('if (uWaterContact < 0.5) return 0.0;'), read = fn.indexOf('texelFetch(uSceneDepth');
  assert.ok(gate > 0 && read > gate, 'the scene depth is read only past the gate');
  assert.match(fn, /vec4 pc = uScenePrevVP \* vec4\(p, 1\.0\)/, 'the water point seen by the camera the depth was taken with (reprojected)');
  assert.match(fn, /float run = sd - pc\.w;/, 'the intersection: the scene behind against the water fragment');
  assert.match(fn, /uSceneNearFar\.x \* uSceneNearFar\.y \/ \(uSceneNearFar\.y - sd \* \(uSceneNearFar\.y - uSceneNearFar\.x\)\)/, 'the depth buffer made a view depth');
  assert.match(fn, /run < -\(/, 'something in front of the point when the depth was taken (moved off since): no contact, not a flash of foam');
  assert.doesNotMatch(fn, /gl_FragCoord/, 'nothing on the screen: the noise on p.xz, the depth found by reprojecting p');
  assert.match(fn, /vnoise\(p\.xz/);
  assert.match(WATER_GLSL, /contactFoam\(p, t, px, wd, foam\)/, 'called from the water look');
  for (const v of Object.values(CONTACT).flat()) assert.ok(Number.isFinite(v));
});
