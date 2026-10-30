// The dune mummer's two trial bodies (issue #800 phase 2): the direct one (src/enemies/plans/dune-mummer.js) and the
// Tripo one (references/enemy-redesign-2026-10-30/trials/mummer-tripo/). Both keep the mummer's model contract, its rig
// (the humanoid clip rig, #724), weapons, mask, look and ragdoll, and stay out of the game until the author picks one
// (TRIAL_BUILDERS is empty in the game); the Tripo skin is Tripo's own weights on the rig's joints, posed directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { TRIAL_BUILDERS, archetypeModel } from '../src/enemies/plans/index.js';
import { duneMummerModel, gourdGeometry } from '../src/enemies/plans/dune-mummer.js';
import { tripoMummerModel } from '../references/enemy-redesign-2026-10-30/trials/mummer-tripo/model.js';
import { tripoMummerSource } from '../references/enemy-redesign-2026-10-30/trials/mummer-tripo/node-source.mjs';

const SRC = tripoMummerSource();
const BUILD = { direct: duneMummerModel, tripo: (skin) => tripoMummerModel(skin, SRC) };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const skinnedOf = (M, name) => { let sm = null; M.group.traverse((o) => { if (o.isSkinnedMesh && o.name === name) sm = o; }); return sm; };

test('the game builds its own mummer: no trial body stands in (#800)', () => {
  assert.equal(TRIAL_BUILDERS.mummer, undefined);
  const M = archetypeModel('mummer', 'desert');
  assert.equal(M.trial, undefined, 'the mummer of plans/mummer.js');
  M.dispose();
});

test('both trial mummers build in every mummer skin, keep the model contract and the rig, in 3 meshes', () => {
  for (const [v, build] of Object.entries(BUILD)) for (const id of Object.keys(SKINS.mummer)) {
    const M = build(skinOf('mummer', id));
    for (const k of ['group', 'body', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'driver', 'joints', 'wield', 'gaze']) assert.ok(M[k] !== undefined, `${v}@${id}: ${k}`);
    assert.equal(M.trial, v);
    for (const a of ARCHETYPES.mummer.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${v}: a tell for ${a.id}`);
    assert.equal(drawn(M.group), 3, `${v}@${id}: the body, the rigid parts, the eyes`);
    M.dispose();
  }
});

test('the gourd faces outward (its normals point away from its axis)', () => {
  const g = gourdGeometry(), P = g.attributes.position, N = g.attributes.normal;
  let out = 0, n = 0;
  for (let i = 0; i < P.count; i++) { if (P.getY(i) < 0.35 || P.getY(i) > 1.1) continue; n++; if (P.getX(i) * N.getX(i) + P.getZ(i) * N.getZ(i) > 0) out++; }
  assert.ok(out / n > 0.99, `${out}/${n}`);
});

function arena() {
  clearTargets();
  return new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(6, 0, 4), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
}

test('in the fight: 1.8 m (#741), the head looks at the traveller, the mask flies off, it ragdolls (#750)', () => {
  for (const [v, build] of Object.entries(BUILD)) {
    TRIAL_BUILDERS.mummer = build;
    const foes = arena();
    const f = foes.add('mummer@desert', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
    assert.equal(f.model.trial, v);
    for (let i = 0; i < 45; i++) { f.dist = 7; foes.look(f, 1 / 30); }
    const M = f.model, body = skinnedOf(M, v === 'tripo' ? 'tripo body' : 'gourd');
    const top = body.boundingBox.clone().applyMatrix4(body.matrixWorld).max.y;
    assert.ok(top > 1.7 && top < 1.95, `${v}: the gourd's top at ${top.toFixed(2)} m`);
    // the look: the traveller off to its left (+x): the head turned toward him, the mask's eyes with it
    const look = M.gaze[0].node, fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(look.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(fwd.x > 0.3, `${v}: the head turns to the traveller (${fwd.x.toFixed(2)})`);
    const eyes = M.group.getObjectByName('eyes').getWorldPosition(new THREE.Vector3()), head = look.getWorldPosition(new THREE.Vector3());
    assert.ok(eyes.x - head.x > 0.03, `${v}: the eyes went round with it`);
    // the mask knocked off: gone from its face, flying; the club dropped
    f.weapon = 'club'; foes.unmask(f);
    for (let i = 0; i < 10; i++) foes.look(f, 1 / 30);
    assert.ok(M.group.getObjectByName('mask').scale.x < 0.01, `${v}: the mask is off`);
    assert.ok(M.group.getObjectByName('dropped mask').scale.x > 0.5, `${v}: the mask flies`);
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 20; i++) foes.update(1 / 30);
    assert.ok(f.dying?.rag, `${v}: it ragdolls on the rig's joints`);
    foes.dispose();
    delete TRIAL_BUILDERS.mummer;
  }
  clearTargets();
});

test('weapons per spawn: club, spear and bow each held in its own fist', () => {
  for (const [v, build] of Object.entries(BUILD)) {
    TRIAL_BUILDERS.mummer = build;
    const foes = arena();
    for (const w of ['club', 'spear', 'bow']) {
      const f = foes.add('mummer@desert', new THREE.Vector3(), { tier: 0 }); f.weapon = w; f.provoked = true;
      for (let i = 0; i < 10; i++) foes.look(f, 1 / 30);
      for (const k of ['club', 'spear', 'bow']) assert.equal(f.model.group.getObjectByName(k).scale.x > 0.5, k === w, `${v}: ${w} shown, ${k}`);
      const hand = f.model.joints.hands[w === 'bow' ? 1 : 0].getWorldPosition(new THREE.Vector3()), at = f.model.group.getObjectByName(w).getWorldPosition(new THREE.Vector3());
      assert.ok(hand.distanceTo(at) < 0.25, `${v}: the ${w} in the hand (${hand.distanceTo(at).toFixed(2)} m)`);
      foes.remove(f);
    }
    foes.dispose();
    delete TRIAL_BUILDERS.mummer;
  }
  clearTargets();
});

test('the Tripo skin: 10–15k triangles, normalised weights on the rig\'s joints, a knee bent moves only its leg', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  assert.equal(SRC.skeleton.joints.length, 23, 'Tripo\'s biped rig');
  const M = tripoMummerModel(skinOf('mummer', 'desert'), SRC), sm = skinnedOf(M, 'tripo body');
  assert.ok(M.joints.torso && sm.skeleton.bones.includes(M.gaze[0].node), 'the head bone is the look');
  const W = sm.geometry.attributes.skinWeight, I = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position, used = new Set(sm.geometry.index.array);
  for (const i of used) { const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i}: weights ${s}`); }
  M.group.updateMatrixWorld(true); sm.skeleton.update();
  const v = new THREE.Vector3(), skinned = (i) => sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld).clone();
  // at the rig's rest the arms hang: the mittens well under the shoulders
  const hand = sm.skeleton.bones.indexOf(M.joints.hands[1]);
  let low = 0, n = 0; for (const i of used) if (I.getX(i) === hand && W.getX(i) > 0.9) { n++; if (skinned(i).y < 0.45) low++; }
  assert.ok(n > 50 && low / n > 0.9, `the left mitten hangs (${low}/${n})`);
  // the right knee bent alone: the right shin's and boot's vertices move, nothing on the left or over the hips (Tripo's
  // crotch blend carries a few vertices just left of the middle by under 5 mm)
  const before = [...used].map((i) => skinned(i));
  M.joints.knees[0].rotateX(-0.8); M.group.updateMatrixWorld(true); sm.skeleton.update();
  let moved = 0; const wrong = [];
  [...used].forEach((i, k) => { const d = skinned(i).distanceTo(before[k]); if (d > 1e-3) { moved++; if ((before[k].x > 0.02 && d > 0.005) || before[k].x > 0.08 || before[k].y > 0.45) wrong.push([...before[k].toArray().map((x) => +x.toFixed(3)), +d.toFixed(4)]); } });
  assert.ok(moved > 100, `the knee moved ${moved} vertices`);
  assert.deepEqual(wrong, [], 'nothing on the left (past the crotch\'s few mm of blend) or above the hips moved');
  M.dispose();
});
