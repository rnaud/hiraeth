// The shellback's two trial bodies (issue #800 phase 2a): the direct one (src/enemies/plans/shellback.js) and the Tripo
// one (references/enemy-redesign-2026-10-30/trials/shellback-tripo/). Both keep the crab's model contract and stay out
// of the game until the author picks one (TRIAL_BUILDERS is empty in the game); the Tripo skin's weights are sound.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { TRIAL_BUILDERS, archetypeModel } from '../src/enemies/plans/index.js';
import { shellbackModel } from '../src/enemies/plans/shellback.js';
import { PLANS } from '../src/motion-kit/plans.js';
import { lyingBody } from '../src/enemies/defeat.js';
import { tripoShellbackModel } from '../references/enemy-redesign-2026-10-30/trials/shellback-tripo/model.js';

const HERE = new URL('../references/enemy-redesign-2026-10-30/trials/shellback-tripo/', import.meta.url);
function tripoSource() {
  const b = readFileSync(new URL('tripo-lod.glb', HERE)), jn = b.readUInt32LE(12), j = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
  const TY = { 5126: Float32Array, 5125: Uint32Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const acc = (i) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], A = TY[a.componentType], off = v.byteOffset + (a.byteOffset ?? 0); return new THREE.BufferAttribute(new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)), CO[a.type], !!a.normalized); };
  const p = j.meshes[0].primitives[0], g = new THREE.BufferGeometry();
  g.setAttribute('position', acc(p.attributes.POSITION)); g.setAttribute('normal', acc(p.attributes.NORMAL)); g.setAttribute('uv', acc(p.attributes.TEXCOORD_0)); g.setAttribute('color', acc(p.attributes.COLOR_0));
  g.setIndex(acc(p.indices));
  return { geometry: g, map: null, landmarks: JSON.parse(readFileSync(new URL('landmarks.json', HERE), 'utf8')), triangles: j.meshes[0].extras.triangles };
}
const SRC = tripoSource();
const BUILD = { direct: shellbackModel, tripo: (skin) => tripoShellbackModel(skin, SRC) };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };

test('the game builds its own crab: no trial body stands in (#800)', () => {
  assert.deepEqual(Object.keys(TRIAL_BUILDERS), []);
  const M = archetypeModel('crab', 'arzach2');
  assert.equal(M.trial, undefined, 'the crab of plans/walker.js');
  M.dispose();
});

test('both trial shellbacks build in every crab skin, keep the model contract and cut the crab\'s 67 meshes to a handful', () => {
  const crab = ARCHETYPES.crab.def;
  for (const [v, build] of Object.entries(BUILD)) for (const id of Object.keys(SKINS.crab)) {
    const M = build(skinOf('crab', id));
    for (const k of ['group', 'body', 'rig', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose']) assert.ok(M[k] !== undefined, `${v}@${id}: ${k}`);
    assert.equal(M.trial, v);
    assert.equal(M.rig.legs.length, 6, `${v}: six legs on the kit`);
    assert.equal(M.rig.plan, PLANS.walker, `${v}: on the crab's rig family, the walker plan`);
    assert.equal(M.plates.length, 2, `${v}: its two scutes of armour (#722)`);
    for (const a of crab.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${v}: a tell for ${a.id}`);
    assert.ok(drawn(M.group) <= 9, `${v}@${id}: ${drawn(M.group)} meshes`);
    M.dispose();
  }
});

test('in the fight both stand at least to the traveller\'s hip, snap, guard, go down and leave a body (#741, #797)', () => {
  clearTargets();
  for (const [v, build] of Object.entries(BUILD)) {
    TRIAL_BUILDERS.crab = build;
    const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(0, 0, 40), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
    const f = foes.add('crab@arzach2', new THREE.Vector3(), { tier: 0 }); f.heading = 0;
    assert.equal(f.model.trial, v);
    for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
    const top = new THREE.Box3().setFromObject(f.model.group).max.y;
    assert.ok(top >= 0.955 && top < 2.2, `${v}: ${top.toFixed(2)} m`);
    // the snap through its wind-up and strike: the pincer moves
    const snap = f.def.attacks.find((a) => a.id === 'snap'), tip = f.model.tell('snap'), at0 = tip.getWorldPosition(new THREE.Vector3());
    f.atk = snap; f.state = 'wind';
    for (let i = 0; i <= 20; i++) { f.k = i / 20; foes.look(f, 1 / 30); }
    assert.ok(tip.getWorldPosition(new THREE.Vector3()).distanceTo(at0) > 0.2, `${v}: the snap's pincer rears`);
    f.atk = null; f.state = 'idle'; f.k = 0;
    f.guardK = 1; for (let i = 0; i < 20; i++) foes.look(f, 1 / 30); f.guardK = 0;
    for (const x of [f.model.group]) x.updateMatrixWorld(true);
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 40; i++) foes.update(1 / 30);
    assert.ok(f.dying, `${v}: down`);
    assert.ok(lyingBody(f)?.r > 0.3, `${v}: a lying body the traveller can't walk through (#797)`);
    foes.dispose();
    delete TRIAL_BUILDERS.crab;
  }
  clearTargets();
});

test('the Tripo skin: 10–15k triangles, normalised weights, an exact bind, every part moving only its own vertices', () => {
  assert.ok(SRC.triangles >= 10000 && SRC.triangles <= 15000, `${SRC.triangles} triangles`);
  const M = tripoShellbackModel(skinOf('crab', 'arzach2'), SRC);
  let sm = null; M.group.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
  const W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position, n = P.count;
  const used = new Set(sm.geometry.index.array);
  const per = new Map();
  for (const i of used) { const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i}: weights ${s}`); per.set(J.getX(i), (per.get(J.getX(i)) ?? 0) + 1); }
  assert.equal(per.size, sm.skeleton.bones.length, 'every bone carries vertices');
  M.group.updateMatrixWorld(true); sm.skeleton.update();
  const rest = new THREE.Vector3(), v = new THREE.Vector3();
  const skinned = (i) => sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld);
  let worst = 0; for (const i of used) { rest.fromBufferAttribute(P, i).applyMatrix4(sm.matrixWorld); worst = Math.max(worst, skinned(i).distanceTo(rest)); }
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  // a shin bent alone: its own leg's vertices move, no vertex of another leg or of the dome's side
  const bone = sm.skeleton.bones.find((b) => b.name === 'leg0_shin'), before = [...used].map((i) => skinned(i).clone());
  bone.rotateX(0.5); M.group.updateMatrixWorld(true); sm.skeleton.update();
  const k0 = SRC.landmarks.legs[0].knee;
  let moved = 0, far = 0;
  [...used].forEach((i, j) => { const d = skinned(i).distanceTo(before[j]); if (d > 1e-3) { moved++; if (before[j].distanceTo(new THREE.Vector3(...k0)) > 0.75) far++; } });
  assert.ok(moved > 50, `the shin moved ${moved} vertices`);
  assert.equal(far, 0, 'nothing far from that leg moved');
  M.dispose();
});
