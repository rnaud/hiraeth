// The wood cutter's two trial bodies (issue #800 phase 2b): the direct one (src/enemies/plans/woodcutter.js) and the
// Tripo one (references/enemy-redesign-2026-10-30/trials/woodcutter-tripo/). Both keep the brute's model contract at the
// author's 2.2–2.6 m, its attacks with their windows and its reach scaled, the tool on the ground where the slam
// lands, its gaze, plates, weak point and pieces; and stay out of the game (TRIAL_BUILDERS is empty in the game).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { TRIAL_BUILDERS, archetypeModel } from '../src/enemies/plans/index.js';
import { woodcutterModel, woodcutterDef, woodcutterArchetype, WOODCUTTER, WOODCUTTER_ID } from '../src/enemies/plans/woodcutter.js';
import { lowestIn } from '../src/enemies/plans/kit.js';
import { tripoWoodcutterModel, partsOf, PARTS, BONES, BLEND } from '../references/enemy-redesign-2026-10-30/trials/woodcutter-tripo/model.js';
import { nodeSource } from '../references/enemy-redesign-2026-10-30/trials/woodcutter-tripo/source-node.mjs';

const SRC = nodeSource(new URL('../references/enemy-redesign-2026-10-30/trials/woodcutter-tripo/', import.meta.url));
const BUILD = { direct: woodcutterModel, tripo: (skin) => tripoWoodcutterModel(skin, SRC) };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const world = () => new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(0, 0, 40), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });

test('the game builds its own brute: no trial body stands in, its def untouched (#800)', () => {
  assert.deepEqual(Object.keys(TRIAL_BUILDERS).filter((k) => k === 'brute'), []);
  const M = archetypeModel('brute', 'perdide2');
  assert.equal(M.trial, undefined); assert.equal(M.trialDef, undefined);
  M.dispose();
});

test('its own enemy, keyed `woodcutter`: the brute untouched, in no roster yet (the author, 2026-10-30)', () => {
  assert.equal(WOODCUTTER_ID, 'woodcutter');
  assert.equal(ARCHETYPES.woodcutter, undefined, 'not registered until it is placed');
  assert.equal(SKINS.woodcutter, undefined);
  const before = JSON.stringify(ARCHETYPES.brute), A = woodcutterArchetype(ARCHETYPES.brute);
  assert.equal(JSON.stringify(ARCHETYPES.brute), before, 'the brute\'s archetype unchanged');
  assert.equal(A.kind, WOODCUTTER_ID); assert.equal(A.name, 'wood cutter'); assert.equal(A.def.name, 'wood cutter');
  assert.equal(A.plan, 'brute', 'on the brute\'s rig family'); assert.equal(A.sound, ARCHETYPES.brute.sound);
  assert.equal(A.def.radius, WOODCUTTER.radius);
  for (const [v, build] of Object.entries(BUILD)) { const M = build(skinOf('brute', 'perdide2')); assert.equal(M.archetype, WOODCUTTER_ID, v); M.dispose(); }
});

test('its def: the brute\'s windows kept, the reach scaled to the body', () => {
  const B = ARCHETYPES.brute.def, D = woodcutterDef(B);
  for (const a of B.attacks) {
    const d = D.attacks.find((x) => x.id === a.id);
    for (const k of ['wind', 'strike', 'contact', 'damage', 'track', 'min', 'onParry', 'dodge']) assert.deepEqual(d[k], a[k], `${a.id}.${k}`);
    if (a.wave) assert.deepEqual(d.wave, a.wave, 'the quake is the brute\'s');
    for (const k of ['radius', 'range', 'max', 'ahead']) if (a[k] != null && a.id !== 'hurl') assert.ok(d[k] < a[k], `${a.id}.${k} nearer`);
  }
  for (const k of ['hp', 'stout', 'heavy', 'breaks', 'speed', 'recover', 'cool', 'sound', 'calm']) assert.deepEqual(D[k], B[k], k);
  assert.equal(D.guard.hold, B.guard.hold); assert.equal(D.guard.blocks, B.guard.blocks);
  assert.equal(D.attack, D.attacks[0]);
  assert.ok(D.radius < B.radius && D.height < B.height);
});

test('both trial wood cutters build in every brute skin, keep the model contract, and are few draws', () => {
  for (const [v, build] of Object.entries(BUILD)) for (const id of Object.keys(SKINS.brute)) {
    const M = build(skinOf('brute', id));
    for (const k of ['group', 'body', 'rig', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'weak', 'gaze', 'trialDef']) assert.ok(M[k] !== undefined, `${v}@${id}: ${k}`);
    assert.equal(M.trial, v);
    assert.equal(M.rig.legs.length, 2, `${v}: two legs on the kit`);
    assert.equal(M.rig.plan.gait.gait, 'alternate'); assert.equal(M.rig.plan.knee.pole, 'forward');
    assert.equal(M.plates.length, 3, `${v}: two pauldrons and a breastplate (#722)`);
    for (const a of ARCHETYPES.brute.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${v}: a tell for ${a.id}`);
    assert.ok(drawn(M.group) <= 15, `${v}@${id}: ${drawn(M.group)} meshes`);
    M.dispose();
  }
});

test('in the fight: 2.2–2.6 m, over the traveller; the slam\'s tools meet the ground at its ring; it looks at you; it comes apart', () => {
  clearTargets();
  for (const [v, build] of Object.entries(BUILD)) {
    TRIAL_BUILDERS.brute = build;
    const foes = world();
    const f = foes.add('brute@perdide2', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
    assert.equal(f.model.trial, v);
    assert.equal(f.def.radius, WOODCUTTER.radius, `${v}: its own def (trialDef)`);
    for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
    const top = new THREE.Box3().setFromObject(f.model.group).max.y;
    assert.ok(top >= 2.2 && top <= 2.6, `${v}: ${top.toFixed(2)} m`);
    const arms = f.model.wcJoints.arms, low = (a) => lowestIn(f.model.group, a.fist, a.reach);
    for (const a of arms) assert.ok(low(a) > 0.02, `${v}: its hands clear the ground at rest`);
    // the slam: up over its head, then down; from its contact on, the saw's edge and the clamp on the ground
    const slam = f.def.attacks.find((a) => a.id === 'slam');
    f.atk = slam; f.state = 'wind';
    for (let i = 0; i <= 30; i++) { f.k = i / 30; foes.look(f, slam.wind / 30); }
    f.model.group.updateMatrixWorld(true);
    assert.ok(arms[0].fist.getWorldPosition(new THREE.Vector3()).y > WOODCUTTER.height, `${v}: the saw raised over its head`);
    f.state = 'strike';
    for (let i = 0; i <= 20; i++) { f.k = i / 20; foes.look(f, slam.strike / 20); }
    f.model.group.updateMatrixWorld(true);
    for (const [k, a] of arms.entries()) {
      assert.ok(Math.abs(low(a)) < 0.03, `${v}: arm ${k} on the ground (${low(a).toFixed(3)})`);
      // (where it bites: inside the slam's ring, ahead)
      let best = null; for (const p of a.reach) { const w = p.clone().applyMatrix4(a.fist.matrixWorld); if (!best || w.y < best.y) best = w; }
      assert.ok(Math.hypot(best.x, best.z - slam.ahead) < slam.radius, `${v}: arm ${k} bites at ${best.z.toFixed(2)} m ahead, the ring at ${slam.ahead}`);
    }
    f.atk = null; f.state = 'idle'; f.k = 0;
    // the gaze: the traveller off to its right, its head turns to him
    foes.player.pos.set(-5, 0, 4);
    const head = f.model.wcJoints.head, fwd0 = new THREE.Vector3(0, 0, 1).applyQuaternion(head.children[0].getWorldQuaternion(new THREE.Quaternion()));
    for (let i = 0; i < 60; i++) { f.dist = 6; foes.look(f, 1 / 30); }
    const fwd1 = new THREE.Vector3(0, 0, 1).applyQuaternion(head.children[0].getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(fwd1.x < fwd0.x - 0.15, `${v}: its head turns toward him (${fwd0.x.toFixed(2)} → ${fwd1.x.toFixed(2)})`);
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 40; i++) foes.update(1 / 30);
    assert.ok(f.dying, `${v}: down`);
    if (v === 'tripo') { let sm = null; f.model.group.traverse((o) => { if (o.isSkinnedMesh) sm = o; }); if (!sm) foes.group?.traverse((o) => { if (o.isSkinnedMesh && o.name === 'tripo skin') sm = o; });
      const w = sm.geometry.attributes.skinWeight; let soft = 0; for (let i = 0; i < w.count; i++) if (w.getX(i) < 1) soft++; assert.equal(soft, 0, 'tripo: rigid as it comes apart (no stretched cuts)'); }
    foes.dispose();
    delete TRIAL_BUILDERS.brute;
  }
  clearTargets();
});

test('the Tripo machine rig: 10–15k triangles, every vertex on one joint (two only across a limb\'s cut), an exact bind, a joint moves only its parts', () => {
  assert.ok(SRC.triangles >= 10000 && SRC.triangles <= 15000, `${SRC.triangles} triangles`);
  const M = tripoWoodcutterModel(skinOf('brute', 'perdide2'), SRC);
  let sm = null; M.group.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
  const W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position, n = P.count, per = new Map();
  // (rigid but for a band BLEND either side of each limb's cut, where a vertex is shared by the two bones: the joint
  //  bends closed. Its two weights sum to 1 and it lies within BLEND of a cut)
  let blended = 0;
  for (let i = 0; i < n; i++) {
    assert.ok(Math.abs(W.getX(i) + W.getY(i) - 1) < 1e-6 && W.getZ(i) === 0, 'one joint a vertex, or two');
    if (W.getX(i) < 1) { blended++; const near = Object.values(SRC.landmarks.cuts).some((c) => Math.abs((P.getX(i) - c.at[0]) * c.n[0] + (P.getY(i) - c.at[1]) * c.n[1] + (P.getZ(i) - c.at[2]) * c.n[2]) < BLEND + 1e-4); assert.ok(near, 'blended only at a cut'); }
    per.set(J.getX(i), (per.get(J.getX(i)) ?? 0) + 1);
  }
  assert.ok(blended > 200 && blended < n * 0.25, `${blended} vertices blended across the cuts`);
  assert.equal(per.size, sm.skeleton.bones.length, 'every joint carries a part');
  for (const [b, c] of per) assert.ok(c > 30, `${sm.skeleton.bones[b].name}: ${c} vertices`);
  M.group.updateMatrixWorld(true); sm.skeleton.update();
  const v = new THREE.Vector3(), rest = new THREE.Vector3(), skinned = (i) => sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld);
  let worst = 0; for (let i = 0; i < n; i++) { rest.fromBufferAttribute(P, i).applyMatrix4(sm.matrixWorld); worst = Math.max(worst, skinned(i).distanceTo(rest)); }
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  // the clamp arm's elbow bent alone: only its forearm and hand move
  const el = M.wcJoints.arms[1].el, ids = new Set([sm.skeleton.bones.indexOf(el), sm.skeleton.bones.indexOf(M.wcJoints.arms[1].fist)]);
  const before = Array.from({ length: n }, (_, i) => skinned(i).clone());
  el.rotateX(-0.8); M.group.updateMatrixWorld(true); sm.skeleton.update();
  let moved = 0, wrong = 0;
  for (let i = 0; i < n; i++) { if (skinned(i).distanceTo(before[i]) > 1e-3) { moved++; if (!ids.has(J.getX(i)) && !(ids.has(J.getY(i)) && W.getY(i) > 0)) wrong++; } }
  assert.ok(moved > 100, `the elbow moved ${moved}`); assert.equal(wrong, 0, 'nothing else moved');
  // a bent elbow opens no gap: the corners the upper arm and the forearm both have at its cut stay together
  {
    const arm = new Set(['upper1', 'fore1'].map((x) => BONES.indexOf(x))), key = (i) => `${P.getX(i).toFixed(4)},${P.getY(i).toFixed(4)},${P.getZ(i).toFixed(4)}`, groups = new Map();
    for (let i = 0; i < n; i++) { if (!arm.has(J.getX(i))) continue; const k = key(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
    let gap = 0, shared = 0;
    for (const g of groups.values()) { if (new Set(g.map((i) => J.getX(i))).size < 2) continue; shared++; const a = skinned(g[0]).clone(); for (const i of g) gap = Math.max(gap, skinned(i).distanceTo(a)); }
    assert.ok(shared > 10, `${shared} corners shared across the elbow's cut`);
    assert.ok(gap < 1e-4, `the elbow bent: the widest seam ${gap.toFixed(4)} m`);
  }
  // the parts by name: the head its own (the gaze turns it), the pauldrons, the boots; Tripo's saw hand dropped, the
  // disc the model's own on its own joint (it spins), with the clamp and bracket on the fist
  const prep = partsOf(SRC), count = (name) => prep.tri.filter((t) => t === PARTS.indexOf(name)).length;
  for (const name of ['head', 'pauldron0', 'pauldron1', 'foot0', 'foot1', 'hand1']) assert.ok(count(name) > 50, `${name}: ${count(name)} triangles`);
  assert.equal(count('hand0') + count('saw'), 0, 'no Tripo saw hand');
  for (const name of ['fist0', 'saw']) assert.ok(per.get(BONES.indexOf(name)) > 60, `${name}: the model's own tool (${per.get(BONES.indexOf(name))} vertices)`);
  M.dispose();
});
