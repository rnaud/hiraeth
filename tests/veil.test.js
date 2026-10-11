// See-through surfaces (src/veil.js, makeMaterial({ veil }), docs/systems/rendering.md "Half-transparent surfaces"):
// Lorn II's giant mushrooms are drawn as a rim in the G-buffer and a pale wash over the finished picture.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeMaterial, surfaceDefines } from '../src/materials.js';
import { Veils, VEIL, LightShaft } from '../src/veil.js';

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

test('a soft shaft of light (issue #116): two open cones drawn only as washes (layer 31), from ring to ring, fading; added after bind it takes the light', () => {
  const v = new Veils();
  const U = { uLightTint: { value: new THREE.Color() }, uHazeLayers: { value: [25, 1.7, 0.14, 5] } };
  v.bind({ tNormal: new THREE.Texture(), uniforms: U });
  const root = new THREE.Group();
  const s = new LightShaft(v, root, { alpha: [0.12, 0.14] });
  assert.equal(s.meshes.length, 2);
  assert.equal(v.list.length, 2);
  for (const m of s.meshes) {
    assert.ok(!m.layers.test(new THREE.Layers()), 'never in the G-buffer');
    assert.ok(m.userData.noCollide && !m.castShadow && m.material.visible === false);
  }
  assert.equal(v.list[0].material.uniforms.uLightTint, U.uLightTint, 'a wash added after bind shares the light');
  // a slanted shaft from a 2 m ring overhead to a 3 m pool on the floor: its foot on the floor's plane
  const top = new THREE.Vector3(0, 10, 0), bot = new THREE.Vector3(4, 0, 0);
  s.set(top, 2, bot, 3, { topN: new THREE.Vector3(0, 1, 0), bottomN: new THREE.Vector3(0, 1, 0) });
  const pos = s.meshes[0].geometry.attributes.position, n = pos.count / 2;
  for (let j = 0; j < n; j++) {
    assert.ok(Math.abs(pos.getY(j) - 10) < 1e-5 && Math.abs(Math.hypot(pos.getX(j), pos.getZ(j)) - 2) < 1e-4, 'the top ring');
    assert.ok(Math.abs(pos.getY(n + j)) < 1e-5 && Math.abs(Math.hypot(pos.getX(n + j) - 4, pos.getZ(n + j)) - 3) < 1e-4, 'the foot, flat on the floor');
  }
  const inner = s.meshes[1].geometry.attributes.position;
  assert.ok(Math.abs(Math.hypot(inner.getX(n) - 4, inner.getZ(n)) - 3 * 0.55) < 1e-4, 'the inner cone narrower');
  s.fade(0.5);
  assert.ok(Math.abs(v.list[0].material.uniforms.uWash.value.x - 0.06) < 1e-6 && Math.abs(v.list[1].material.uniforms.uWash.value.x - 0.07) < 1e-6);
  let drawn = 0;
  const renderer = { setRenderTarget() {}, render(scene) { drawn += scene.children.filter((c) => c.visible).length; } };
  s.visible = false;
  v.render(renderer, new THREE.PerspectiveCamera(), { width: 64, height: 36 });
  assert.equal(drawn, 0, 'hidden: no wash');
});
