// The bellows toad (issue #800): the Tripo body is the game's toad (src/enemies/plans/toad-tripo.js, its shipped asset
// public/enemies/bellows-toad/body.glb), the legacy toad (plans/hopper-legacy.js) its stand-in where the body is not
// loaded, kept so its look can come back. The Tripo skin's weights are sound, its parts cut by geometry, its eyes look at
// the traveller, its bellows swells; every world's skin builds, and it fights as the toad always did.
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
import { toadLegacyModel } from '../src/enemies/plans/hopper-legacy.js';
import { tripoToadModel, toadSource, TOAD_BODY, TOAD_ROLES } from '../src/enemies/plans/toad-tripo.js';
import { parseTripoBody } from '../src/enemies/plans/tripo-body.js';
import { PLANS } from '../src/motion-kit/plans.js';
import { lyingBody } from '../src/enemies/defeat.js';

THREE.ColorManagement.enabled = false;   // (as the game: colours are display values, src/main.js)
const SRC = toadSource();
const BUILD = { legacy: toadLegacyModel, tripo: (skin) => tripoToadModel(skin, SRC) };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const skinnedOf = (M) => { const out = []; M.group.traverse((o) => { if (o.isSkinnedMesh) out.push(o); }); return out; };
const hexAt = (C, i) => '#' + [C.getX(i), C.getY(i), C.getZ(i)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');

test('the game\'s toad is the Tripo bellows toad, from its shipped body, in every skin; the legacy toad kept (#800)', () => {
  assert.deepEqual(Object.keys(TRIAL_BUILDERS), []);
  for (const id of Object.keys(SKINS.toad)) { const M = archetypeModel('toad', id); assert.equal(M.toad, 'tripo', id); M.dispose(); }
  // (the shipped file: the trial's mesh as it is, 16-bit indices, no picture, the landmarks in its extras)
  const T = parseTripoBody(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyA-tripo/toad-lod.glb', import.meta.url)));
  assert.deepEqual(Array.from(SRC.geometry.attributes.position.array), Array.from(T.geometry.attributes.position.array));
  assert.deepEqual(Array.from(SRC.geometry.index.array), Array.from(T.geometry.index.array));
  assert.ok(SRC.geometry.index.array instanceof Uint16Array);
  assert.equal(SRC.image, null, 'no picture: each part one flat colour');
  assert.deepEqual(SRC.landmarks, JSON.parse(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyA-tripo/toad-landmarks.json', import.meta.url), 'utf8')));
  assert.ok(readFileSync(new URL(`../public/${TOAD_BODY}`, import.meta.url)).length < 400 * 1024, 'under 400 KB');
  // the legacy body still builds in every skin, its own way
  for (const id of Object.keys(SKINS.toad)) { const M = toadLegacyModel(skinOf('toad', id)); assert.equal(M.toad, undefined); assert.ok(drawn(M.group) > 20); M.dispose(); }
});

test('its parts are cut by geometry: one flat colour a part, the reference\'s, the triangles grouped by part', () => {
  const C = SRC.geometry.attributes.color, I = SRC.geometry.index.array, parts = SRC.landmarks.parts;
  assert.deepEqual(Object.keys(parts), ['skin', 'belly', 'toe']);
  let total = 0;
  for (const [part, [first, count]] of Object.entries(parts)) {
    total += count;
    const seen = new Set(); for (let t = first * 3; t < (first + count) * 3; t++) seen.add(hexAt(C, I[t]));
    assert.deepEqual([...seen], [TOAD_ROLES[part]], `${part}: one flat colour, the reference's`);
  }
  assert.equal(total * 3, I.length);
  // the toes all under the feet's plane, the belly on the front, over it
  const P = SRC.geometry.attributes.position, [bf, bc] = parts.belly, [tf, tc] = parts.toe;
  for (let t = tf * 3; t < (tf + tc) * 3; t++) assert.ok(P.getY(I[t]) <= SRC.landmarks.footTop + 1e-4, 'a toe under the plane');
  let front = 0; for (let t = bf * 3; t < (bf + bc) * 3; t++) if (P.getZ(I[t]) > 0) front++;
  assert.ok(front / (bc * 3) > 0.8, 'the belly on its front');
});

test('every world\'s skin builds on the Tripo body: its palette, its painted surface, its dress; a handful of meshes', () => {
  const want = { perdide: [], incal: ['valve', 'gauge'], waterfall: ['jet'], home: ['flower'] };
  for (const [id, dress] of Object.entries(want)) {
    const skin = skinOf('toad', id), M = tripoToadModel(skin, SRC);
    for (const k of ['group', 'body', 'rig', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose']) assert.ok(M[k] !== undefined, `${id}: ${k}`);
    const sms = skinnedOf(M);
    assert.equal(sms.length, 3, `${id}: three skinned parts`);
    assert.equal(new Set(sms.map((s) => s.skeleton)).size, 1, `${id}: one skeleton`);
    assert.equal(sms.find((s) => s.name === 'toad skin').material.uniforms.uColor.value.getHexString(), new THREE.Color(skin.palette.skin).getHexString(), `${id}: its skin's colour`);
    assert.ok(sms.some((s) => s.material.defines?.FOE_SURFACE), `${id}: a painted surface`);
    for (const name of dress) { let found = false; M.group.traverse((o) => { if (o.name === name) found = true; }); assert.ok(found, `${id}: its ${name}`); }
    assert.ok(drawn(M.group) <= 12, `${id}: ${drawn(M.group)} meshes`);
    assert.equal(M.rig.legs.length, 4, `${id}: four legs on the kit`);
    assert.equal(M.rig.plan.hop, PLANS.hopper.hop, `${id}: the hopper's plan (its feet kept nearer home)`);
    for (const a of ARCHETYPES.toad.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${id}: a tell for ${a.id}`);
    M.dispose();
  }
  // the home skin: the reference's colours
  assert.equal(skinOf('toad', 'perdide').palette.skin, TOAD_ROLES.skin);
  assert.equal(skinOf('toad', 'perdide').palette.belly, TOAD_ROLES.belly);
});

test('the Tripo skin: 10–15k triangles, normalised weights, an exact bind, a leg bent alone moving only its own vertices', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  const M = tripoToadModel(skinOf('toad', 'perdide'), SRC), sms = skinnedOf(M), sk = sms[0].skeleton;
  M.group.updateMatrixWorld(true); sk.update();
  const v = new THREE.Vector3(), rest = new THREE.Vector3();
  let worst = 0;
  const carried = new Set();
  for (const sm of sms) {
    const W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position;
    for (const i of new Set(sm.geometry.index.array)) {
      const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i}: weights ${s}`);
      carried.add(J.getX(i));
      rest.fromBufferAttribute(P, i).applyMatrix4(sm.matrixWorld);
      worst = Math.max(worst, sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld).distanceTo(rest));
    }
  }
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  assert.equal(carried.size, sk.bones.length, 'every bone carries vertices');
  // a hind shin bent alone: its own leg's vertices move; nothing on the other side, the head or the arms
  const sm = sms[0], P = sm.geometry.attributes.position, used = [...new Set(sm.geometry.index.array)];
  const before = used.map((i) => sm.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(P, i)));
  sk.bones.find((b) => b.name === 'leg2_shin').rotateX(0.5); M.group.updateMatrixWorld(true); sk.update();
  // (leg 2 is on the −x side: nothing over the middle, nothing of the head's height)
  let moved = 0, far = 0;
  used.forEach((i, j) => { const d = sm.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(P, i)).distanceTo(before[j]); if (d > 1e-3) { moved++; if (before[j].x > -0.2 || before[j].y > 1.3) far++; } });
  assert.ok(moved > 50, `the shin moved ${moved} vertices`);
  assert.equal(far, 0, 'nothing of the other side or the head moved');
  M.dispose();
});

/** A toad in a bare fight, the traveller in front. */
function fight(build, id = 'toad@perdide') {
  clearTargets(); TRIAL_BUILDERS.toad = build;
  const player = { pos: new THREE.Vector3(0, 0, 6), heading: Math.PI };
  const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
  const f = foes.add(id, new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  return { foes, f, player, done() { foes.dispose(); delete TRIAL_BUILDERS.toad; clearTargets(); } };
}

test('it sits on its own feet at its bind: the kit\'s first stance squared, no leg stretched', () => {
  const { foes, f, done } = fight(BUILD.tripo);
  for (let i = 0; i < 45; i++) { f.state = 'idle'; foes.look(f, 1 / 30); }
  const g = f.model.group; g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  for (const sm of skinnedOf(f.model)) {
    sm.skeleton.update(); const P = sm.geometry.attributes.position, v = new THREE.Vector3(), r = new THREE.Vector3();
    let worst = 0; for (const i of new Set(sm.geometry.index.array)) { r.fromBufferAttribute(P, i); worst = Math.max(worst, sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld).applyMatrix4(inv).distanceTo(r)); }
    assert.ok(worst < 0.06, `${sm.name}: ${worst.toFixed(3)} m from its bind sitting`);
  }
  done();
});

test('in the fight both toads stand over the traveller, lob, swell, flop, go down and leave a body (#741, #797)', () => {
  for (const [v, build] of Object.entries(BUILD)) {
    const { foes, f, done } = fight(build);
    for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
    const top = new THREE.Box3().setFromObject(f.model.body).max.y;
    assert.ok(top > 1.75 && top < 2.8, `${v}: ${top.toFixed(2)} m`);
    // the lob: the throat swells, the glob shows inside it, it rears back
    f.atk = f.def.attacks.find((a) => a.id === 'lob'); f.state = 'wind'; f.attackAt = new THREE.Vector3(0, 0, 6);
    for (let i = 0; i <= 30; i++) { f.k = Math.min(0.6, i / 30); foes.look(f, 1 / 30); }
    let bag = null; f.model.group.traverse((o) => { if (o.isMesh && o.visible && o.material?.uniforms?.uVeil?.value > 0.5) bag = o; });
    assert.ok(bag?.visible, `${v}: the throat see-through`);
    if (v === 'tripo') { let b = null; f.model.group.traverse((o) => { if (o.name === 'bellows') b = o; }); assert.ok(b.scale.z > 1.12, `the bellows swells (${b.scale.z.toFixed(2)})`); }
    assert.ok(f.model.body.rotation.x < -0.1, `${v}: rears back`);
    f.atk = null; f.state = 'idle'; f.k = 0;
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 40; i++) foes.update(1 / 30);
    assert.ok(f.dying, `${v}: down`);
    assert.ok(lyingBody(f)?.r > 0.3, `${v}: a lying body the traveller can't walk through (#797)`);
    done();
  }
});

test('it looks at the traveller: the head turns his way, the eyes slide on (#800, the author\'s)', () => {
  const at = {};
  for (const side of [1, -1]) {
    const { foes, f, player, done } = fight(BUILD.tripo);
    player.pos.set(side * 4, 0, 3);
    for (let i = 0; i < 90; i++) { f.dist = player.pos.distanceTo(f.pos); f.state = 'chase'; foes.look(f, 1 / 60); f.model.group.updateMatrixWorld(true); }
    assert.ok(f.gaze.watching, 'it has noticed him');
    let eyes = null; f.model.group.traverse((o) => { if (o.name === 'eyes' && o.isMesh) eyes = o; });
    at[side] = { yaw: f.model.gaze[0].yaw, eyes: new THREE.Box3().setFromObject(eyes).getCenter(new THREE.Vector3()).x - f.pos.x };
    done();
  }
  assert.ok(at[1].yaw > 0.15 && at[-1].yaw < -0.15, `the head turns his way (${at[1].yaw.toFixed(2)}, ${at[-1].yaw.toFixed(2)})`);
  assert.ok(at[1].eyes - at[-1].eyes > 0.15, `the eyes go his way (${(at[1].eyes - at[-1].eyes).toFixed(3)} m)`);
});
