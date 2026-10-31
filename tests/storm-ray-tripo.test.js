// The storm ray (issue #800, family B: src/enemies/plans/storm-ray-tripo.js): Tripo's body, shipped as
// public/enemies/storm-ray/body.glb (loaded by src/enemies/foe-assets.js), is the game's ray in every skin; the sky ray it
// replaced is kept and stands in where the body is not loaded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { stormRay, stormRaySource, setStormRaySource, tripoRayModel, STORM_RAY_BODY, WING_DOWN } from '../src/enemies/plans/storm-ray-tripo.js';
import { rayModel as skyRayModel } from '../src/enemies/plans/sky-ray-legacy.js';
import { parseTripoBody } from '../src/enemies/plans/tripo-body.js';
// (the fights' picks seeded: unseeded, a rare draw failed a test as the bodies changed, #800)
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };

const make = () => new Foes({ scene: new THREE.Scene(), level: {}, levelId: 'arena', physics: { groundAt: () => 0 }, player: { pos: new THREE.Vector3(0, 0, 6), chest: new THREE.Vector3(0, 1.2, 6) }, rng: seeded() });
const run = (foes, f, n = 30) => { for (let i = 0; i < n; i++) foes.look(f, 1 / 60); f.model.group.updateMatrixWorld(true); };

test('the shipped body: 10–15k triangles in its parts (the body with its wings, the tail), its landmarks beside it, the drawn shadow dropped', () => {
  const bytes = readFileSync(new URL(`../public/${STORM_RAY_BODY}`, import.meta.url));
  const src = parseTripoBody(bytes), L = src.landmarks, tris = src.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  assert.deepEqual(Object.keys(L.parts), ['body', 'tail']);
  assert.equal(L.parts.body[1] + L.parts.tail[1], tris);
  assert.deepEqual(JSON.parse(readFileSync(new URL('../public/enemies/storm-ray/landmarks.json', import.meta.url), 'utf8')).parts, L.parts);
  let lo = Infinity; const P = src.geometry.attributes.position; for (let i = 0; i < P.count; i++) lo = Math.min(lo, P.getY(i));
  assert.ok(lo > -0.01, 'nothing under its belly: the shadow disc is gone');
  assert.equal(L.eyes.filter(Boolean).length, 2);
  assert.ok(L.wings.every((w) => w.tip[1] > w.root[1] + 0.6), 'its wings raised in the reference\'s V');
});

test('the ray is the storm ray in every skin; the sky ray stands in without the body', () => {
  const foes = make();
  for (const skin of Object.keys(SKINS.ray)) {
    const f = foes.add(`ray@${skin}`, new THREE.Vector3());
    assert.equal(f.model.tripo, 'storm ray', skin);
    for (const k of ['group', 'body', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'gaze', 'wave']) assert.ok(f.model[k] !== undefined, `${skin}: ${k}`);
    run(foes, f);
    foes.remove(f);
  }
  foes.dispose();
  setStormRaySource(null);
  try { const m = stormRay(skinOf('ray', 'arzach')); assert.equal(m.tripo, undefined); m.dispose(); } finally { setStormRaySource(undefined); }
  const old = skyRayModel(skinOf('ray', 'garage')); assert.ok(old.group.children.length > 0, 'the sky ray is kept'); old.dispose();
});

test('the skin: weights normalised, the bind exact, a wing bent alone moving none of the body; the tail its own', () => {
  const m = tripoRayModel(skinOf('ray', 'arzach'), stormRaySource());
  const [sm, tail] = m.skinned;
  for (const mesh of [sm, tail]) { const W = mesh.geometry.attributes.skinWeight; for (let i = 0; i < W.count; i++) assert.ok(Math.abs(W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i) - 1) < 1e-5); }
  // (built gliding: the bind is the reference's raised V)
  for (const w of m.wingBones) w.inner.rotation.z = w.bind;
  m.group.updateMatrixWorld(true); sm.skeleton.update();
  const P = sm.geometry.attributes.position, J = sm.geometry.attributes.skinIndex, Wt = sm.geometry.attributes.skinWeight, v = new THREE.Vector3(), b = new THREE.Vector3();
  let worst = 0; for (let i = 0; i < P.count; i += 5) worst = Math.max(worst, sm.getVertexPosition(i, v).distanceTo(b.fromBufferAttribute(P, i)));
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  const before = Array.from({ length: P.count }, (_, i) => sm.getVertexPosition(i, new THREE.Vector3()));
  const w = m.wingBones[1].inner; w.rotation.z -= 0.6; m.group.updateMatrixWorld(true); sm.skeleton.update();
  const bone = sm.skeleton.bones.indexOf(w);
  let moved = 0, stray = 0;
  for (let i = 0; i < P.count; i++) { const on = [0, 1, 2, 3].some((c) => [bone, bone + 1].includes(J.getComponent(i, c)) && Wt.getComponent(i, c) > 0); if (sm.getVertexPosition(i, v).distanceTo(before[i]) > 1e-4) on ? moved++ : stray++; }
  assert.ok(moved > 200 && stray === 0, `the wing: ${moved} moved, ${stray} not its own`);
  m.dispose();
});

test('it glides with its wings let down, raises them for the draft, sweeps them back for the skim, lifts its tail for the lash', () => {
  const foes = make(), f = foes.add('ray@arzach', new THREE.Vector3());
  const W = f.model.wingBones[1], tail = f.model.group.getObjectByName('tail');
  f.state = 'idle'; run(foes, f, 120);
  const turn = () => W.inner.rotation.z - W.bind, glide = Math.abs(turn());
  assert.ok(Math.abs(glide - WING_DOWN) < 0.45, `gliding: let down about ${WING_DOWN} (${glide.toFixed(2)})`);
  const pose = (id, state, k, n = 60) => { f.atk = f.def.attacks.find((a) => a.id === id) ?? { id, wind: 1 }; f.state = state; f.k = k; run(foes, f, n); };
  // (the left wing's turn about its root, signed: let down is negative, raised toward the reference's V and past it, up)
  pose('draft', 'wind', 0.95); assert.ok(turn() > -glide + 0.3, `draft: raised (${turn().toFixed(2)} from ${(-glide).toFixed(2)})`);
  pose('skim', 'wind', 0.95); assert.ok(Math.abs(W.inner.rotation.y) > 0.3, 'skim: swept back');
  pose('lash', 'wind', 0.95); assert.ok(tail.rotation.x < -0.5, `lash: the tail lifted (${tail.rotation.x.toFixed(2)})`);
  foes.dispose();
});
