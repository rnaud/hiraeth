// See-through surfaces (src/veil.js, makeMaterial({ veil }), docs/systems/rendering.md "Half-transparent surfaces"):
// Lorn II's giant mushrooms are drawn as a rim in the G-buffer and a pale wash over the finished picture.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeMaterial, surfaceDefines } from '../src/materials.js';
import { Veils, VEIL } from '../src/veil.js';

test('a veiled material compiles the rim cut; others do not, and the fallback never cuts', () => {
  assert.equal(surfaceDefines({ color: '#fff', veil: VEIL.cap }).S_VEIL, 1);
  assert.equal(surfaceDefines({ color: '#fff' }).S_VEIL, undefined);
  const m = makeMaterial({ color: '#c9c1ea', veil: VEIL.cap, key: 'veil-test' });
  assert.equal(m.uniforms.uVeil.value, VEIL.cap);
  assert.match(m.fragmentShader, /#ifdef S_VEIL\s+if \(uVeil > 0\.0 &&/);   // (a shader with everything compiled: uVeil 0 keeps it whole)
  assert.ok(VEIL.cap > 0 && VEIL.cap < 1 && VEIL.stalk > 0 && VEIL.stalk < 1);
});

test('the wash: one draw per veiled mesh, sharing its geometry, bound to the ink pass\'s uniforms, drawn only while its mesh shows', () => {
  const v = new Veils();
  const geo = new THREE.SphereGeometry(1, 8, 6);
  const parent = new THREE.Group(), mesh = new THREE.Mesh(geo, makeMaterial({ color: '#c9c1ea', veil: VEIL.cap }));
  parent.add(mesh);
  const w = v.add(mesh, { color: '#c9c1ea', glow: 0.45 });
  assert.equal(w.geometry, geo, 'no copy of the geometry');
  assert.equal(w.material.uniforms.uWash.value.x, VEIL.glowAlpha);
  assert.equal(v.add(mesh, { color: '#c9c1ea' }).material.uniforms.uWash.value.x, VEIL.alpha);
  assert.ok(w.material.transparent && !w.material.depthWrite && !w.material.depthTest);
  const U = { uLightTint: { value: new THREE.Color() }, uHazeLayers: { value: [25, 1.7, 0.14, 5] } };
  const tNormal = new THREE.Texture();
  v.bind({ tNormal, uniforms: U });
  assert.equal(w.material.uniforms.uLightTint, U.uLightTint, 'the same uniform objects: the light and haze follow the day');
  assert.equal(w.material.uniforms.tNormal.value, tNormal);
  let drawn = 0;
  const renderer = { setRenderTarget() {}, render(scene) { drawn += scene.children.filter((c) => c.visible).length; } };
  v.render(renderer, new THREE.PerspectiveCamera(), { width: 640, height: 360 });
  assert.equal(drawn, 2);
  assert.deepEqual(v.uniforms.uRes.value.toArray(), [640, 360]);
  parent.visible = false; drawn = 0;
  v.render(renderer, new THREE.PerspectiveCamera(), { width: 640, height: 360 });
  assert.equal(drawn, 0, 'its mesh hidden: nothing drawn');
});
