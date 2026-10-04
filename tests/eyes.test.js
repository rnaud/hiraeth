import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mulberry32 } from '../src/noise.js';
import { EyeLook, EYE_REACH, EYE_TILT, BLINK, IRIS, irisFor, eyeballOf } from '../src/eyes.js';
import { dressFor, namedLook, packBody } from '../src/costumes.js';
import { Humanoid, prepareHuman, FACE } from '../src/humanoid.js';
import { buildCharacter } from '../src/player.js';
import { figureGeometry } from '../src/crowd.js';
import { CROWD_ZONES } from '../src/crowd-shader.js';
import { MODE_EYE } from '../src/materials.js';
import { PORTRAIT_GLSL, FaceExpression } from '../src/face.js';

// Eyes with a white, a coloured iris, a pupil and lids that blink (src/eyes.js).

test('iris colours: seeded, from browns to blues, and part of every look', () => {
  const rng = mulberry32(3);
  const seen = new Set(Array.from({ length: 400 }, () => irisFor(rng)));
  assert.ok(seen.size >= 9, `${seen.size} colours`);
  for (const c of seen) assert.ok(IRIS.some(([k]) => k === c));
  // the same person, the same eyes; their look otherwise unchanged by having eyes (drawn last)
  const a = namedLook({ world: 'desert', id: 'nour', kind: 'f' }), b = namedLook({ world: 'desert', id: 'nour', kind: 'f' });
  assert.equal(a.eyes, b.eyes);
  assert.ok(IRIS.some(([k]) => k === a.eyes));
  const story = dressFor('desert', mulberry32(9), { palette: { eyes: '#123456' } });
  assert.equal(story.eyes, '#123456', 'a story can set them');
  // having eyes draws nothing from the stream: a crowd's later looks are unchanged
  const r1 = mulberry32(21), r2 = mulberry32(21);
  dressFor('bazaar', r1, { kind: 'm' });
  dressFor('bazaar', r2, { kind: 'm', palette: { eyes: '#123456' } });
  assert.equal(r1(), r2());
  // and they vary from person to person
  const crowd = mulberry32(4), mix = new Set(Array.from({ length: 60 }, () => dressFor('bazaar', crowd, { kind: 'f' }).eyes));
  assert.ok(mix.size >= 6, `${mix.size} colours in a crowd`);
  // the crowd shader gets them packed in aBody.w
  assert.equal(packBody(a)[3], new THREE.Color(a.eyes).getHex());
});

test('the eyes follow what they look at, within their reach, and look around otherwise', () => {
  const e = new EyeLook(mulberry32(1));
  for (let i = 0; i < 30; i++) e.update(1 / 60, new THREE.Vector3(0.2, 0.05, 1));
  assert.ok(e.look.x > 0.15 && e.look.y > 0.03, 'toward a point ahead and to the left');
  for (let i = 0; i < 30; i++) e.update(1 / 60, new THREE.Vector3(3, 0, 1));
  assert.ok(Math.abs(Math.atan2(e.look.x, e.look.z) - EYE_REACH.yaw) < 0.02, 'clamped to the corner of the eye');
  for (let i = 0; i < 30; i++) e.update(1 / 60, new THREE.Vector3(0, -1, 0.5));
  assert.ok(Math.asin(e.look.y) > -EYE_REACH.down - 0.02, 'never rolled out of sight');
  // behind them: not with the eyes alone; they glance about near straight ahead
  for (let i = 0; i < 120; i++) e.update(1 / 60, new THREE.Vector3(0, 0, -1));
  assert.ok(e.look.z > 0.9);
  assert.ok(Math.abs(e.look.length() - 1) < 1e-6);
});

test('they blink every few seconds: a quick close, a slower open', () => {
  const e = new EyeLook(mulberry32(7));
  let shut = 0, blinks = 0, was = 0, longest = 0, run = 0;
  for (let i = 0; i < 60 * 60; i++) {
    e.update(1 / 60);
    if (e.blink > 0.95) { shut++; run++; longest = Math.max(longest, run); } else run = 0;
    if (was === 0 && e.blink > 0) blinks++;
    was = e.blink > 0 ? 1 : 0;
    assert.ok(e.blink >= 0 && e.blink <= 1);
  }
  assert.ok(blinks >= 60 / BLINK.max && blinks <= 60 / BLINK.min * 1.4 + 2, `${blinks} blinks a minute`);
  assert.ok(longest <= 3, 'shut only for a moment');
});

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const load = async (kind) => {
  const bytes = await readFile(new URL(`../public/anim/human_${kind}.glb`, import.meta.url));
  return prepareHuman((await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene, kind);
};

test('a person\'s eyeballs: found after the reshape, shaded as eyes, aimed at a point in world space', async () => {
  for (const kind of ['m', 'f']) {
    const tpl = await load(kind);
    const h = new Humanoid(tpl, buildCharacter(), kind);
    const m = h.eyeMesh;
    assert.ok(m && /eye/i.test(m.name) && !/brow/i.test(m.name), 'the eye mesh');
    const u = m.material.uniforms;
    assert.equal(u.uMode.value, MODE_EYE);
    // the eyeball: centred on the eye line, about 3 cm across, a little narrower than tall
    const eb = eyeballOf(m.geometry, FACE[kind][0]);
    assert.ok(Math.abs(u.uEyeC.value.x - eb.center[0]) < 1e-6 && Math.abs(u.uEyeC.value.y - FACE[kind][0]) < 1e-6);
    const [rx, up, down] = eb.radii;
    assert.ok(rx > 0.011 && rx < 0.016 && up > 0.012 && down > up, `${kind}: radii ${eb.radii}`);
    // at rest the person faces +z: a point off to their left (+x) and above pulls the iris that way
    h.char.root.updateMatrixWorld(true);
    h.update(true);
    for (let i = 0; i < 40; i++) h.updateEyes(1 / 60, new THREE.Vector3(0.6, 2.2, 2));
    const L = h.eyeLook.look;
    assert.ok(L.x > 0.1 && L.y > 0.05 && L.z > 0.8, `${kind}: looks left and up ${L.toArray()}`);
    // the shader's gaze is that, turned down onto the model's eye opening
    const G = u.uEyeLook.value;
    assert.ok(Math.abs(G.x - L.x) < 1e-6 && Math.abs(Math.atan2(G.y, G.z) - (Math.atan2(L.y, L.z) - EYE_TILT)) < 1e-4);
    for (let i = 0; i < 40; i++) h.updateEyes(1 / 60, new THREE.Vector3(-0.6, 1.2, 2));
    assert.ok(L.x < -0.1 && L.y < 0, `${kind}: then right and down`);
  }
});

test('crowd figures have almond eyes, the traveller\'s drawn face a coloured iris', () => {
  const g = figureGeometry('mid', 'bazaar');
  const rig = g.attributes.aRig;
  let eyes = 0;
  for (let i = 0; i < rig.count; i++) if (Math.round(rig.getY(i)) === CROWD_ZONES.eye) eyes++;
  assert.ok(eyes >= 20, `${eyes} eye vertices`);
  assert.match(PORTRAIT_GLSL, /portraitEyes/);
  assert.ok(new FaceExpression().uniforms.uIris.value.isColor);
});
