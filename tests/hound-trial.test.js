// The broad-pawed hound's two trial bodies (issue #800 phase 2b): the direct one (src/enemies/plans/broad-hound.js) and
// the Tripo one (references/enemy-redesign-2026-10-30/trials/hound-tripo/). Both keep the hound's model contract, its
// shadow form and its look at the traveller, and stay out of the game until the author picks one (TRIAL_BUILDERS is
// empty in the game); the Tripo skin's weights (Tripo's own, gathered onto the game's bones) are sound.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { TRIAL_BUILDERS, archetypeModel } from '../src/enemies/plans/index.js';
import { broadHoundModel } from '../src/enemies/plans/broad-hound.js';
import { PLANS } from '../src/motion-kit/plans.js';
import { lyingBody } from '../src/enemies/defeat.js';
import { tripoHoundModel } from '../references/enemy-redesign-2026-10-30/trials/hound-tripo/model.js';
import { nodeSource } from '../references/enemy-redesign-2026-10-30/trials/hound-tripo/node-source.mjs';

const SRC = nodeSource();
const BUILD = { direct: broadHoundModel, tripo: (skin) => tripoHoundModel(skin, SRC) };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const arena = (player) => new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });

test('the game builds its own hound: no trial body stands in (#800)', () => {
  assert.equal(TRIAL_BUILDERS.hound, undefined);
  const M = archetypeModel('hound', 'eclipse');
  assert.equal(M.trial, undefined, 'the hound of plans/quadruped.js');
  M.dispose();
});

test('both trial hounds build in every hound skin, keep the model contract and the quadruped rig, and draw a handful of meshes', () => {
  const hound = ARCHETYPES.hound.def;
  for (const [v, build] of Object.entries(BUILD)) for (const id of Object.keys(SKINS.hound)) {
    const M = build(skinOf('hound', id));
    for (const k of ['group', 'body', 'rig', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'gaze']) assert.ok(M[k] !== undefined, `${v}@${id}: ${k}`);
    assert.equal(M.trial, v);
    assert.equal(M.shadowy, true, `${v}: its shadow form`);
    assert.equal(M.rig.legs.length, 4, `${v}: four legs on the kit`);
    assert.equal(M.rig.plan.gait, PLANS.quadruped.gait, `${v}: on the hound's rig family, the quadruped plan`);
    for (const a of hound.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${v}: a tell for ${a.id}`);
    // (standing: its body and eyes, the pool's pieces hidden once it has stood a frame)
    assert.ok(drawn(M.group) <= 10, `${v}@${id}: ${drawn(M.group)} meshes`);
    M.dispose();
  }
});

test('in the fight both stand at least to the traveller\'s hip, pounce, phase into a pool, go down and leave a body (#741, #797)', () => {
  clearTargets();
  for (const [v, build] of Object.entries(BUILD)) {
    TRIAL_BUILDERS.hound = build;
    const foes = arena({ pos: new THREE.Vector3(0, 0, 40), heading: Math.PI });
    // (lit: an ember's light holds it solid however far he is, foes.js phased)
    const f = foes.add('hound@eclipse', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true; f.lit = 99;
    assert.equal(f.model.trial, v);
    for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
    const top = new THREE.Box3().setFromObject(f.model.group).max.y;
    assert.ok(top >= 0.955 && top < 2.2, `${v}: ${top.toFixed(2)} m`);
    // the pounce through its wind-up: it crouches (the head goes down), then the leap lifts it
    const pounce = f.def.attacks.find((a) => a.id === 'pounce'), head = f.model.tell('pounce'), y0 = head.getWorldPosition(new THREE.Vector3()).y;
    f.atk = pounce; f.state = 'wind';
    for (let i = 0; i <= 30; i++) { f.k = i / 30; foes.look(f, 1 / 30); }
    assert.ok(head.getWorldPosition(new THREE.Vector3()).y < y0 - 0.15, `${v}: the pounce's crouch`);
    f.state = 'strike'; let up = 0;
    for (let i = 0; i <= 8; i++) { f.k = i / 8; foes.look(f, 1 / 30); up = Math.max(up, f.model.group.position.y); }
    assert.ok(up > 0.3, `${v}: the leap leaves the ground (${up.toFixed(2)} m)`);
    // phased (a hit sends it into its pool): the body goes, the pool shows
    f.atk = null; f.state = 'chase'; f.k = 0; f.lit = 0;
    for (let i = 0; i < 30; i++) foes.look(f, 1 / 30);
    assert.ok(f.phased, `${v}: phased, far from him and unlit`);
    assert.equal(f.model.body.visible, false, `${v}: phased, no body`);
    let skinShown = 0; f.model.group.traverseVisible((o) => { if (o.isSkinnedMesh) skinShown++; });
    assert.equal(skinShown, 0, `${v}: phased, no skinned body drawn (squashed under the pool)`);
    f.lit = 99; f.state = 'idle'; for (let i = 0; i < 30; i++) foes.look(f, 1 / 30);
    assert.equal(f.model.body.visible, true, `${v}: risen again`);
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 40; i++) foes.update(1 / 30);
    assert.ok(f.dying, `${v}: down`);
    assert.ok(lyingBody(f)?.r > 0.3, `${v}: a lying body the traveller can't walk through (#797)`);
    foes.dispose();
    delete TRIAL_BUILDERS.hound;
  }
  clearTargets();
});

test('both look at the traveller: with him off to one side its head turns to him (#508; the author\'s rule for every Tripo body)', () => {
  clearTargets();
  for (const [v, build] of Object.entries(BUILD)) for (const side of [-1, 1]) {
    TRIAL_BUILDERS.hound = build;
    const player = { pos: new THREE.Vector3(side * 4, 0, 3), heading: Math.PI };
    const foes = arena(player);
    const f = foes.add('hound@eclipse', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true; f.state = 'chase'; f.lit = 99;
    for (let i = 0; i < 60; i++) { f.state = 'chase'; f.dist = 5; foes.look(f, 1 / 30); }
    const E = f.model.gaze[0];
    assert.ok(Math.sign(E.yaw) === side && Math.abs(E.yaw) > 0.3, `${v}, him to the ${side > 0 ? 'left' : 'right'}: the head's yaw ${E.yaw.toFixed(2)} rad`);
    // (the eyes ride on what turns: their world position moves to his side)
    const eyes = []; f.model.group.traverse((o) => { if (o.isMesh && o.material === f.model.eyeMat && o.visible) eyes.push(o); });
    assert.ok(eyes.length >= 1, `${v}: eyes of their own`);
    f.model.group.updateMatrixWorld(true);
    const e = new THREE.Box3().setFromObject(eyes[0]).getCenter(new THREE.Vector3()), h = f.model.body.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.sign(e.x - h.x) === side, `${v}: its eyes turned his way`);
    foes.dispose();
    delete TRIAL_BUILDERS.hound;
  }
  clearTargets();
});

test('the Tripo skin: 10–15k triangles, normalised weights, an exact bind, a shin bent alone moving only its own leg', () => {
  assert.ok(SRC.triangles >= 10000 && SRC.triangles <= 15000, `${SRC.triangles} triangles`);
  const M = tripoHoundModel(skinOf('hound', 'eclipse'), SRC);
  let sm = null; M.group.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
  const W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position;
  const used = new Set(sm.geometry.index.array), per = new Map();
  for (const i of used) { const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-4, `vertex ${i}: weights ${s}`); per.set(J.getX(i), (per.get(J.getX(i)) ?? 0) + 1); }
  assert.equal(per.size, sm.skeleton.bones.length, 'every bone carries vertices');
  M.group.updateMatrixWorld(true); sm.skeleton.update();
  const rest = new THREE.Vector3(), v = new THREE.Vector3();
  const skinned = (i) => sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld);
  let worst = 0; for (const i of used) { rest.fromBufferAttribute(P, i).applyMatrix4(sm.matrixWorld); worst = Math.max(worst, skinned(i).distanceTo(rest)); }
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  const bone = sm.skeleton.bones.find((b) => b.name === 'leg0_shin'), before = [...used].map((i) => skinned(i).clone());
  bone.rotateX(0.5); M.group.updateMatrixWorld(true); sm.skeleton.update();
  const k0 = new THREE.Vector3(...SRC.landmarks.legs[0].knee);
  let moved = 0, far = 0;
  [...used].forEach((i, j) => { const d = skinned(i).distanceTo(before[j]); if (d > 1e-3) { moved++; if (before[j].distanceTo(k0) > 0.8) far++; } });
  assert.ok(moved > 50, `the shin moved ${moved} vertices`);
  assert.equal(far, 0, 'nothing far from that leg moved');
  M.dispose();
});
