// The lamp moth (issue #800, family B: src/enemies/plans/lamp-moth-tripo.js): Tripo's body, shipped as
// public/enemies/lamp-moth/body.glb, is the game's moth in every skin; the signal moth it replaced is kept and stands in
// where the body is not loaded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { lampMoth, lampMothSource, setLampMothSource, tripoMothModel, LAMP_MOTH_BODY } from '../src/enemies/plans/lamp-moth-tripo.js';
import { mothModel as signalMothModel } from '../src/enemies/plans/signal-moth-legacy.js';
import { parseTripoBody } from '../src/enemies/plans/tripo-body.js';
// (the fights' picks seeded: unseeded, a rare draw failed a test as the bodies changed, #800)
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };

const make = () => new Foes({ scene: new THREE.Scene(), level: {}, levelId: 'arena', physics: { groundAt: () => 0 }, player: { pos: new THREE.Vector3(0, 0, 6), chest: new THREE.Vector3(0, 1.2, 6) }, rng: seeded() });
const run = (foes, f, n = 30) => { for (let i = 0; i < n; i++) foes.look(f, 1 / 60); f.model.group.updateMatrixWorld(true); };

test('the shipped body: 10–15k triangles in its parts (body, head, wings, eye-spots), 16-bit indices, its colours and landmarks', () => {
  const bytes = readFileSync(new URL(`../public/${LAMP_MOTH_BODY}`, import.meta.url));
  assert.ok(bytes.length < 600e3, `${bytes.length} bytes`);
  const src = parseTripoBody(bytes), L = src.landmarks, tris = src.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  assert.ok(src.geometry.index.array instanceof Uint16Array && src.geometry.attributes.color);
  assert.deepEqual(Object.keys(L.parts), ['body', 'head', 'wings', 'spots']);
  assert.equal(Object.values(L.parts).reduce((t, [, n]) => t + n, 0), tris, 'every triangle in a part');
  assert.equal(L.eyes.filter(Boolean).length, 2, 'both painted eyes found (and painted out)');
  assert.equal(L.antennae.filter(Boolean).length, 2);
  for (const s of L.spots) assert.ok(s.radii[0] > 0.1 && s.radii[0] < 0.25, `an eye-spot's size ${s.radii}`);
});

test('the moth is the lamp moth in every skin, three together; the signal moth stands in without the body', () => {
  const foes = make();
  assert.equal(FOES.moth.group, 3, 'in threes');
  for (const skin of Object.keys(SKINS.moth)) {
    const f = foes.add(`moth@${skin}`, new THREE.Vector3());
    assert.equal(f.model.tripo, 'lamp moth', skin);
    for (const k of ['group', 'body', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'gaze', 'defeat']) assert.ok(f.model[k] !== undefined, `${skin}: ${k}`);
    run(foes, f);
    foes.remove(f);
  }
  foes.dispose();
  // (no source: the signal moth)
  setLampMothSource(null);
  try { const m = lampMoth(skinOf('moth', 'perdide2')); assert.equal(m.tripo, undefined); m.dispose(); } finally { setLampMothSource(undefined); }
  const old = signalMothModel(skinOf('moth', 'bazaar')); assert.ok(old.group.children.length > 0, 'the signal moth is kept'); old.dispose();
});

test('the wings: weights normalised, the bind exact, the roots held on the body through the beat; open flat for the flash, folded for the dart', () => {
  const m = tripoMothModel(skinOf('moth', 'perdide2'), lampMothSource());
  const [wings] = m.skinned, W = wings.geometry.attributes.skinWeight, P = wings.geometry.attributes.position;
  for (let i = 0; i < W.count; i++) assert.ok(Math.abs(W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i) - 1) < 1e-5);
  m.group.updateMatrixWorld(true); wings.skeleton.update();
  const v = new THREE.Vector3(), b = new THREE.Vector3(); let worst = 0;
  for (let i = 0; i < P.count; i += 5) { wings.getVertexPosition(i, v); worst = Math.max(worst, v.distanceTo(b.fromBufferAttribute(P, i))); }
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  // (a beat swept far back: the vertices behind the body, within its half-width, do not move)
  const L = lampMothSource().landmarks, still = [];
  for (let i = 0; i < P.count; i++) { b.fromBufferAttribute(P, i); if (Math.abs(b.x) < L.body.radii[0] * 0.6 && b.y > 0.2 && b.y < 0.8) still.push([i, b.clone()]); }
  for (const w of m.wingBones) w.inner.rotation.y = w.side * 1.2;
  m.group.updateMatrixWorld(true); wings.skeleton.update();
  assert.ok(still.length > 20 && still.every(([i, p]) => wings.getVertexPosition(i, v).distanceTo(p) < 1e-3), `the body's back holds (${still.length})`);
  m.dispose();
  // the flash opens them toward you; the dart folds them back
  const foes = make(), f = foes.add('moth@perdide2', new THREE.Vector3());
  const pose = (id, state, k) => { f.atk = f.def.attacks.find((a) => a.id === id); f.state = state; f.k = k; run(foes, f, 40); return f.model.wingBones[1].inner.rotation.y; };
  const idle = (f.state = 'idle', f.atk = null, run(foes, f, 40), Math.abs(f.model.wingBones[1].inner.rotation.y));
  assert.ok(Math.abs(pose('flash', 'wind', 0.95)) < idle * 0.6, 'flash: open flat toward him');
  const dart = Math.abs(pose('dart', 'wind', 0.9)); assert.ok(dart > 1.4 && dart > idle, `dart: folded back (${dart.toFixed(2)} against ${idle.toFixed(2)})`);
  foes.dispose();
});
