// The cloud jelly (issue #800, family B: src/enemies/plans/cloud-jelly-tripo.js): Tripo's body, shipped as
// public/enemies/cloud-jelly/body.glb, is the game's jelly in every skin; the lantern jelly it replaced is kept and
// stands in where the body is not loaded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { cloudJelly, cloudJellySource, setCloudJellySource, tripoJellyModel, CLOUD_JELLY_BODY } from '../src/enemies/plans/cloud-jelly-tripo.js';
import { jellyModel as lanternJellyModel } from '../src/enemies/plans/lantern-jelly-legacy.js';
import { parseTripoBody } from '../src/enemies/plans/tripo-body.js';

const make = () => new Foes({ scene: new THREE.Scene(), level: {}, levelId: 'arena', physics: { groundAt: () => 0 }, player: { pos: new THREE.Vector3(0, 0, 6), chest: new THREE.Vector3(0, 1.2, 6) } });
const run = (foes, f, n = 30) => { for (let i = 0; i < n; i++) foes.look(f, 1 / 60); f.model.group.updateMatrixWorld(true); };

test('the shipped body: one mesh, 10–15k triangles in its parts (the cap, three bulbs, the skin), 16-bit indices, its colours and landmarks', () => {
  const bytes = readFileSync(new URL(`../public/${CLOUD_JELLY_BODY}`, import.meta.url));
  assert.ok(bytes.length < 600e3, `${bytes.length} bytes`);
  const src = parseTripoBody(bytes), L = src.landmarks, tris = src.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  assert.ok(src.geometry.index.array instanceof Uint16Array, '16-bit indices');
  assert.ok(src.geometry.attributes.color, 'COLOR_0: the engines draw it');
  assert.equal(Object.values(L.parts).reduce((t, [, n]) => t + n, 0), tris, 'every triangle in a part');
  assert.deepEqual(Object.keys(L.parts), ['cap', 'bulb0', 'bulb1', 'bulb2', 'skin']);
  assert.equal(L.lanterns.length, 3); assert.equal(L.arms.length, 2);
  assert.equal(L.eyes.filter(Boolean).length, 2, 'both painted eyes found (and painted out)');
  for (const e of L.eyes) assert.ok(e.size[0] < 0.08 && e.size[1] < 0.15, `an eye's size ${e.size}`);
  assert.ok(src.image, 'its flat texture');
});

test('the jelly is the cloud jelly in every skin; the lantern jelly stands in without the body', () => {
  const foes = make();
  for (const skin of Object.keys(SKINS.jelly)) {
    const f = foes.add(`jelly@${skin}`, new THREE.Vector3());
    const M = f.model;
    assert.equal(M.tripo, 'cloud jelly', skin);
    for (const k of ['group', 'body', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'gaze', 'lanternAt']) assert.ok(M[k] !== undefined, `${skin}: ${k}`);
    run(foes, f);
    const at = M.lanternAt(1); assert.ok(Number.isFinite(at.y) && at.y > 0, `${skin}: a lantern hangs over the ground (${at.y.toFixed(2)})`);
    foes.remove(f);
  }
  foes.dispose();
  const src = cloudJellySource();
  setCloudJellySource(null);
  try {
    // (no source and none to read: the lantern jelly's bell on its threads)
    const keep = globalThis.process.getBuiltinModule; globalThis.process.getBuiltinModule = () => null;
    try { const m = cloudJelly(skinOf('jelly', 'arzach2')); assert.equal(m.tripo, undefined); m.dispose(); } finally { globalThis.process.getBuiltinModule = keep; }
  } finally { setCloudJellySource(src); }
  const old = lanternJellyModel(skinOf('jelly', 'spheres')); assert.ok(old.group.children.length > 0, 'the lantern jelly is kept'); old.dispose();
});

test('the skin: weights normalised, the bind exact, each arm and lantern moving only its own vertices', () => {
  const m = tripoJellyModel(skinOf('jelly', 'arzach2'), cloudJellySource());
  const sm = m.skinned, W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position;
  for (let i = 0; i < W.count; i++) assert.ok(Math.abs(W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i) - 1) < 1e-5, `vertex ${i} normalised`);
  m.group.updateMatrixWorld(true); sm.skeleton.update();
  const v = new THREE.Vector3(), b = new THREE.Vector3();
  let worst = 0;
  for (let i = 0; i < P.count; i += 7) { sm.getVertexPosition(i, v); b.fromBufferAttribute(P, i); worst = Math.max(worst, v.distanceTo(b)); }   // (both in the mesh's own frame)
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  const before = Array.from({ length: P.count }, (_, i) => sm.getVertexPosition(i, new THREE.Vector3()));
  const bones = sm.skeleton.bones;
  for (const k of [1, 2, 3, 4, 5]) {
    bones[k].rotation.x += 0.4; m.group.updateMatrixWorld(true); sm.skeleton.update();
    let moved = 0, stray = 0;
    for (let i = 0; i < P.count; i++) {
      const on = [0, 1, 2, 3].some((c) => J.getComponent(i, c) === k && W.getComponent(i, c) > 0);
      const d = sm.getVertexPosition(i, v).distanceTo(before[i]);
      if (d > 1e-4) { if (on) moved++; else stray++; }
    }
    assert.ok(moved > 30 && stray === 0, `bone ${bones[k].name}: ${moved} moved, ${stray} not its own`);
    bones[k].rotation.x -= 0.4;
  }
  m.dispose();
});

test('a shot pops a lantern: its bulb and stem go; the curtain shows its threads only while it falls', () => {
  const foes = make();
  const f = foes.add('jelly@arzach2', new THREE.Vector3());
  run(foes, f);
  const bulbs = f.model.parts.filter((p) => /^lantern \d$/.test(p.name) && p.isMesh);
  assert.equal(bulbs.filter((b) => b.visible).length, 3);
  f.lanterns = 2; run(foes, f, 3);
  assert.equal(bulbs.filter((b) => b.visible).length, 2, 'one popped');
  const threads = []; f.model.group.traverse((o) => { if (o.isMesh && o.parent?.name === 'threads (foes space)' && o.geometry.parameters?.radiusTop === 0.02) threads.push(o); });
  assert.ok(threads.length >= 8 && threads.every((t) => !t.visible), 'the threads hidden');
  f.atk = f.def.attacks.find((a) => a.id === 'curtain'); f.state = 'strike'; f.k = 0.5;
  run(foes, f, 20);
  assert.ok(threads.every((t) => t.visible), 'shown in the curtain');
  f.state = 'idle'; f.atk = null; run(foes, f, 120);
  assert.ok(threads.every((t) => !t.visible), 'gone again');
  foes.dispose();
});

// (its eyes on him from either side, within their reach: tests/foe-gaze.test.js, which builds every kind, the jelly too)
