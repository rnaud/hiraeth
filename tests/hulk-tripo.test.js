// The hulk (issue #800, family G): its approved redesign, the root crusher, as its body (Tripo, src/enemies/plans/
// hulk-tripo.js on public/enemies/hulk/, loaded by src/enemies/foe-assets.js; the slate-blue horned hulk,
// plans/monster.js legacyHulkModel, kept and standing in while the mesh loads). Tripo's v2.5 rig (its v1.0 biped rig put
// the joints wrong) named as the Mixamo one and posed directly by the clips (plans/tripo-biped.js), its fists whole on
// its hands. It keeps the hulk's id, def, attacks and windows (smash, sweep, the stomp a jump clears, the thrown grunt),
// stout and heavy, its Arena-only skin, the ragdoll (tests/foe-ragdoll.test.js) and its look at the traveller.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { legacyHulkModel } from '../src/enemies/plans/monster.js';
import { tripoHulkModel, HULK_TRIPO_HOLD, HULK_CLUB } from '../src/enemies/plans/hulk-tripo.js';
import { foeSource, FOE_ASSETS } from '../src/enemies/foe-assets.js';

const SRC = foeSource('hulk');
const seeded = (s = 7) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const arena = () => { clearTargets(); return new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(6, 0, 4), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: seeded() }); };
const body = (M) => { let s = null; M.group.traverse((o) => { if (o.isSkinnedMesh && o.name === 'tripo body') s = o; }); return s; };
const hexOf = (c, v) => '#' + [c.getX(v), c.getY(v), c.getZ(v)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');

test('the hulk is the approved root crusher: its Tripo body by default, the horned hulk kept as legacyHulkModel', () => {
  assert.ok(FOE_ASSETS.hulk && SRC, 'its asset is read at once in node');
  const M = archetypeModel('hulk', 'desert');
  assert.match(M.group.name, /hulk \(Tripo\)/); assert.ok(M.tripo);
  M.dispose();
  const L = legacyHulkModel(skinOf('hulk', 'desert'));
  assert.ok(L.group.getObjectByName('club') && L.group.getObjectByName('hem'), 'the old hulk still builds');
  L.dispose();
});

test('it keeps the hulk\'s fight: smash, sweep, the stomp a jump clears, the thrown grunt and their windows; stout, heavy, Arena-only', () => {
  const D = FOES.hulk;
  assert.deepEqual(D.attacks.map((a) => a.id), ['smash', 'sweep', 'stomp', 'throw']);
  const A = Object.fromEntries(D.attacks.map((a) => [a.id, a]));
  assert.deepEqual([A.smash.wind, A.smash.strike, A.smash.range, A.sweep.wind, A.sweep.range, A.stomp.wind, A.stomp.radius, A.stomp.ground, A.throw.throwsAlly], [1.15, 0.3, 4, 1.1, 4.2, 1.0, 3, true, 'grunt']);
  assert.deepEqual([D.hp, D.radius, D.height, D.heavy, D.stout, D.throws, D.answerMash.attack], [8, 1.0, 2.7, true, true, 'grunt', 'stomp']);
  assert.deepEqual(Object.keys(SKINS.hulk), ['desert']); assert.ok(SKINS.hulk.desert.arena, 'Arena-only');
  assert.ok(HULK_CLUB < 1.75 && HULK_TRIPO_HOLD.club.carry.fore, 'its club shorter, carried with its forearm brought forward');
});

test('its skin and tier build the contract in 3 draws: the body, its rigid parts, the slits; its rig the v2.5 one named', () => {
  assert.equal(SRC.rig.joints.length, 33, 'Tripo\'s v2.5 rig');
  for (const n of ['Hips', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightUpLeg', 'RightLeg', 'RightFoot']) assert.ok(SRC.rig.joints.some((j) => j.name === n), n);
  assert.ok(SRC.rig.joints.find((j) => j.name === 'LeftArm').at[0] > 0.3 && SRC.rig.joints.find((j) => j.name === 'RightHand').at[0] < -1, 'each arm on its own side');
  for (const tier of [0, 1]) {
    const M = tripoHulkModel(skinOf('hulk', 'desert', tier), SRC);
    for (const k of ['group', 'body', 'parts', 'eyeMat', 'tell', 'anim', 'dispose', 'driver', 'joints', 'wield', 'gaze']) assert.ok(M[k] !== undefined, `${tier}: ${k}`);
    for (const a of FOES.hulk.attacks) assert.ok(M.tell(a.id)?.isObject3D, `a tell for ${a.id}`);
    let n = 0; M.group.traverseVisible((o) => { if (o.isMesh) n++; });
    assert.equal(n, 3, `${tier}: ${n} meshes`);
    const top = new THREE.Box3().setFromObject(M.group).max.y;
    assert.ok(top > 2.4 && top < 2.75, `${top.toFixed(2)} m to its hump (the old hulk's 2.66)`);
    M.dispose();
  }
});

test('the Tripo skin: 10–15k triangles, flat colours (teal, cream belly, rust fists), normalised weights, a knee bent moves its leg', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  const pal = SRC.rig.palette, col = SRC.geometry.attributes.color, seen = new Map();
  for (let v = 0; v < col.count; v++) { const h = hexOf(col, v); seen.set(h, (seen.get(h) ?? 0) + 1); }
  assert.deepEqual([...seen.keys()].filter((h) => !Object.values(pal).includes(h)), []);
  for (const k of ['skin', 'belly', 'fist', 'toe']) assert.ok(seen.get(pal[k]) > 40, `${k}: ${seen.get(pal[k])}`);
  assert.ok(seen.get(pal.skin) > seen.get(pal.belly), 'teal the most');
  const M = tripoHulkModel(skinOf('hulk', 'desert'), SRC), sm = body(M), P = sm.geometry.attributes.position, W = sm.geometry.attributes.skinWeight;
  for (let i = 0; i < W.count; i++) { const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5); }
  M.group.updateMatrixWorld(true); sm.skeleton.update();
  const v = new THREE.Vector3(), at = (i) => sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld).clone();
  const before = Array.from({ length: P.count }, (_, i) => at(i));
  M.joints.knees[0].rotateX(-0.8); M.group.updateMatrixWorld(true); sm.skeleton.update();
  let moved = 0; const wrong = [];
  for (let i = 0; i < P.count; i++) { const d = at(i).distanceTo(before[i]); if (d > 1e-3) { moved++; if ((before[i].x > 0.1 && d > 0.01) || before[i].y > 1.2) wrong.push(before[i].toArray().map((x) => +x.toFixed(2))); } }
  assert.ok(moved > 100, `the knee moved ${moved}`);
  assert.deepEqual(wrong.slice(0, 5), [], 'nothing on the left or over the hips moved');
  M.dispose();
});

test('in the fight: it looks at the traveller (its low head and slits), the club in its fist, the stomp\'s foot raised high', () => {
  const foes = arena();
  const f = foes.add('hulk@desert', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  for (let i = 0; i < 45; i++) { f.dist = 7; foes.look(f, 1 / 30); }
  const M = f.model, fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(M.gaze[0].node.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(fwd.x > 0.25, `the head turns to the traveller (${fwd.x.toFixed(2)})`);
  assert.equal(M.group.getObjectByName('eyes').parent, M.gaze[0].node);
  const foot = () => M.joints.feet[0].getWorldPosition(new THREE.Vector3()).y, rest = foot();
  const stomp = FOES.hulk.attacks.find((a) => a.id === 'stomp');
  for (let t = 0; t < stomp.wind * 0.8; t += 1 / 30) { f.atk = stomp; f.state = 'wind'; f.k = t / stomp.wind; f.dist = 2; foes.look(f, 1 / 30); }
  assert.ok(foot() > rest + 0.25, `the stomp's foot raised over its other shin (${rest.toFixed(2)} → ${foot().toFixed(2)} m)`);
  assert.ok(M.group.getObjectByName('club').scale.x > 0.5, 'the club in its fist');
  foes.dispose(); clearTargets();
});
