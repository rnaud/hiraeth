// The Unity gaps of issue #264 found by #429's sequences, fixed on the script's side: the traveller's colours in the
// engines (engine/traveller-paint.js), a foe's flash given back after its draw (engine/mirror.js calls onAfterRender), and
// the ship leaving the lens alone when it isn't filming (src/ship/ship.js applyCamera: a flying game's widening shows).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { fillUnfound, portraitPaint } from '../engine/traveller-paint.js';
import { SceneMirror } from '../engine/mirror.js';
import { makeMaterial } from '../src/materials.js';
import { installFlash, REACT } from '../src/foe-react.js';
import { Ship } from '../src/ship/ship.js';

test('fillUnfound: the vertices with no place in the skin take their neighbours\' colour, never black', () => {
  // a strip of four triangles; vertices 2 and 3 unknown (black), the others grey
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 3), 3));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]);
  const c = new Float32Array(6 * 3);
  for (const i of [0, 1, 4, 5]) c.set([0.5, 0.4, 0.3], i * 3);
  fillUnfound(g, c, (i) => ![2, 3].includes(i));
  for (const i of [2, 3]) assert.deepEqual(Array.from(c.slice(i * 3, i * 3 + 3)).map((v) => +v.toFixed(3)), [0.5, 0.4, 0.3]);
});

test('portraitPaint: the black hatch under the chin and the baked shading go to the flat skin, the hair to ink', () => {
  const F = { scale: 0.28, offset: [0, 1.5, 0], mouthY: 0.293 };
  const at = (x, y, z) => [F.offset[0] + x * F.scale, F.offset[1] + y * F.scale, F.offset[2] + z * F.scale];
  // 0: the neck under the chin, painted black; 1: a cheek in baked shade; 2: hair; 3: the pupil, kept
  const P = [at(0.05, 0.1, 0.15), at(0.12, 0.4, 0.2), at(0, 0.8, 0), at(0.125, 0.522, 0.2)];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P.flat()), 3));
  const lin = (r, gg, b) => new THREE.Color().setRGB(r, gg, b, THREE.SRGBColorSpace).toArray();
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array([...lin(0.08, 0.06, 0.05), ...lin(0.45, 0.28, 0.2), ...lin(0.3, 0.2, 0.15), ...lin(0.08, 0.05, 0.04)]), 3));
  g.setAttribute('_portrait_hair', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0]), 1));
  const head = { geometry: g, userData: { portraitHeadFit: F } };
  assert.equal(portraitPaint(head), true);
  const disp = (i) => new THREE.Color().fromArray(g.attributes.color.array, i * 3).convertLinearToSRGB();
  const skin = new THREE.Color(0.79, 0.525, 0.37);
  assert.ok(disp(0).r > 0.7, 'the neck is skin, not ink');
  assert.ok(Math.abs(disp(1).r - skin.r) < 0.05, 'the cheek is the flat skin');
  assert.ok(disp(2).r < 0.05, 'the hair is ink');
  assert.ok(disp(3).r < 0.2, 'the painted eye is kept');
});

test('the mirror gives a foe\'s flash back after reading it: sent warm, the material its own colour again', () => {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera();
  const mat = makeMaterial({ color: '#3b3350' });
  const own = mat.uniforms.uColor.value.clone();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), mat), group = new THREE.Group();
  group.add(mesh); scene.add(group);
  const react = { flashK: 0, flashT: 0, family: 'creature' };
  installFlash({ group }, react);
  const sent = [];
  const B = new Proxy({ materialLive: (mid, c) => { if (c) sent.push(c); } }, { get: (t, k) => t[k] ?? (() => {}) });
  const mirror = new SceneMirror(B);
  mirror.sync(scene, cam);   // (sent as it is)
  react.flashK = 1; react.flashT = 0.18;   // (struck)
  for (let f = 0; f < 4; f++) {
    mirror.sync(scene, cam);
    assert.ok(own.equals(mat.uniforms.uColor.value), `frame ${f}: the material's own colour after the frame`);
  }
  const expected = own.clone().lerp(new THREE.Color(REACT.tone.creature), REACT.flash.white);
  assert.ok(sent.length > 0, 'the warm flash was sent');
  for (const [i, channel] of ['r', 'g', 'b'].entries()) assert.ok(Math.abs(sent[0][i] - expected[channel]) < 1e-4, `the configured flash reaches Unity: ${channel}`);
  // its flash over: the colour sent goes back to its own, it doesn't creep paler frame after frame
  react.flashK = 0; react.flashT = 0;
  mirror.sync(scene, cam); mirror.sync(scene, cam);
  const last = sent.at(-1);
  assert.ok(Math.abs(last[0] - own.r) < 1e-4, 'its own colour once the flash is over');
});

test('the ship leaves the lens alone when it isn\'t filming: a flying game\'s fov holds', () => {
  const camera = new THREE.PerspectiveCamera(60);
  const self = { camera, cam: null, blend: null, rig: { indoorK: 0 }, shakeK: 0 };
  camera.fov = 74.4;
  Ship.prototype.applyCamera.call(self, 1 / 60);
  assert.equal(camera.fov, 74.4);
  // filming: its own lens; then the base given back once, and left alone after
  self.cam = { pos: new THREE.Vector3(0, 0, 5), look: new THREE.Vector3(), fov: 40 };
  Ship.prototype.applyCamera.call(self, 1 / 60);
  assert.equal(camera.fov, 40);
  self.cam = null;
  Ship.prototype.applyCamera.call(self, 1 / 60);
  assert.equal(camera.fov, camera.userData.baseFov);
  camera.fov = 66;
  Ship.prototype.applyCamera.call(self, 1 / 60);
  assert.equal(camera.fov, 66);
});
