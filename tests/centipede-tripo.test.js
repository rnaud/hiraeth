// The drill-head centipede (issue #800): the Tripo body is the game's centipede (src/enemies/plans/centipede-tripo.js, its
// shipped asset public/enemies/centipede/body.glb), the legacy ring centipede (plans/centipede-legacy.js) its stand-in
// where the body is not loaded, kept so its look can come back. The Tripo skin's weights are sound, the body follows the
// head's path with its neck reared, its halves open and shut, it looks at the traveller, every skin builds, and it fights
// as the ring centipede always did.
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
import { centipedeLegacyModel } from '../src/enemies/plans/centipede-legacy.js';
import { tripoCentipedeModel, centipedeSource, CENTIPEDE_BODY, CENTIPEDE_ROLES } from '../src/enemies/plans/centipede-tripo.js';
import { parseTripoBody } from '../src/enemies/plans/tripo-body.js';
import { lyingBody } from '../src/enemies/defeat.js';

THREE.ColorManagement.enabled = false;
const SRC = centipedeSource();
const BUILD = { legacy: centipedeLegacyModel, tripo: (skin) => tripoCentipedeModel(skin, SRC) };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const skinnedOf = (M) => { const out = []; M.group.traverse((o) => { if (o.isSkinnedMesh) out.push(o); }); return out; };
const hexAt = (C, i) => '#' + [C.getX(i), C.getY(i), C.getZ(i)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');

test('the game\'s centipede is the Tripo drill-head centipede, from its shipped body, in every skin; the legacy kept (#800)', () => {
  assert.deepEqual(Object.keys(TRIAL_BUILDERS), []);
  for (const id of Object.keys(SKINS.centipede)) { const M = archetypeModel('centipede', id); assert.equal(M.tripo, 'tripo', id); M.dispose(); }
  const T = parseTripoBody(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyA-tripo/centipede-lod.glb', import.meta.url)));
  assert.deepEqual(Array.from(SRC.geometry.attributes.position.array), Array.from(T.geometry.attributes.position.array));
  assert.deepEqual(Array.from(SRC.geometry.index.array), Array.from(T.geometry.index.array));
  assert.ok(SRC.geometry.index.array instanceof Uint16Array);
  assert.equal(SRC.image, null, 'no picture');
  assert.deepEqual(SRC.landmarks, JSON.parse(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyA-tripo/centipede-landmarks.json', import.meta.url), 'utf8')));
  assert.ok(readFileSync(new URL(`../public/${CENTIPEDE_BODY}`, import.meta.url)).length < 400 * 1024, 'under 400 KB');
  for (const id of Object.keys(SKINS.centipede)) { const M = centipedeLegacyModel(skinOf('centipede', id)); assert.equal(M.tripo, undefined); assert.ok(drawn(M.group) > 50); M.dispose(); }
});

test('its parts: one flat colour a part, the reference\'s, the triangles grouped by part', () => {
  const C = SRC.geometry.attributes.color, I = SRC.geometry.index.array, parts = SRC.landmarks.parts;
  assert.deepEqual(Object.keys(parts), ['plate', 'head', 'dark', 'under']);
  let total = 0;
  for (const [part, [first, count]] of Object.entries(parts)) { total += count; assert.ok(count > 100, `${part}: ${count} triangles`); }
  assert.equal(total * 3, I.length);
  const [hf, hc] = parts.head, P = SRC.geometry.attributes.position;
  for (let t = hf * 3; t < (hf + hc) * 3; t++) assert.ok(P.getY(I[t]) > 1.2, 'the head over the neck');
  for (const k of Object.keys(CENTIPEDE_ROLES)) assert.equal(skinOf('centipede', 'buried').palette[k === 'dark' ? 'dark' : k], CENTIPEDE_ROLES[k], `the home skin's ${k}: the reference's`);
});

test('every world\'s skin builds on the Tripo body: its colours, its painted surface, its dress; a handful of meshes', () => {
  const want = { buried: ['drill'], spheres: ['dress'], fallenring: [], eclipse: [], waterfall: ['dress'], antennas: ['dress'] };
  for (const [id, dress] of Object.entries(want)) {
    const M = tripoCentipedeModel(skinOf('centipede', id), SRC);
    for (const k of ['group', 'body', 'rig', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'spine']) assert.ok(M[k] !== undefined, `${id}: ${k}`);
    const sms = skinnedOf(M);
    assert.ok(sms.length >= 4, `${id}: its four parts skinned`);
    assert.equal(new Set(sms.map((s) => s.skeleton)).size, 1, `${id}: one skeleton`);
    assert.ok(sms.some((s) => s.material.defines?.FOE_SURFACE), `${id}: a painted surface`);
    for (const name of dress) { let found = false; M.group.traverse((o) => { if (o.name === name || o.name === `centipede ${name}`) found = true; }); assert.ok(found, `${id}: its ${name}`); }
    assert.ok(drawn(M.group) <= 10, `${id}: ${drawn(M.group)} meshes`);
    assert.equal(M.rig.legs.length, 10, `${id}: five pairs of legs`);
    assert.equal(M.spine.length, 13, `${id}: the corral's wall, the head and twelve points`);
    for (const a of ARCHETYPES.centipede.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${id}: a tell for ${a.id}`);
    M.dispose();
  }
});

test('the Tripo skin: 10–15k triangles, normalised weights, an exact bind, every bone carrying vertices', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  const M = tripoCentipedeModel(skinOf('centipede', 'buried'), SRC), sms = skinnedOf(M), sk = sms[0].skeleton;
  M.group.updateMatrixWorld(true); sk.update();
  const v = new THREE.Vector3(), rest = new THREE.Vector3(), carried = new Set();
  let worst = 0;
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
  assert.ok(carried.size >= sk.bones.length - 2, `${carried.size} of ${sk.bones.length} bones carry vertices`);
  M.dispose();
});

function fight(build, id = 'centipede@buried') {
  clearTargets(); TRIAL_BUILDERS.centipede = build;
  const player = { pos: new THREE.Vector3(0, 0, 6), heading: Math.PI };
  const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
  const f = foes.add(id, new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  return { foes, f, player, done() { foes.dispose(); delete TRIAL_BUILDERS.centipede; clearTargets(); } };
}

test('it follows its head\'s path, its neck reared and its feet planted; nothing far from its bind when it stands', () => {
  const { foes, f, done } = fight(BUILD.tripo);
  for (let i = 0; i < 30; i++) { f.state = 'idle'; foes.look(f, 1 / 30); }
  // standing straight: every vertex near its bind (the path is straight behind it; the foe's spot is its head's base)
  const g = f.model.group, hz = SRC.landmarks.head.base[2]; g.updateMatrixWorld(true);
  for (const sm of skinnedOf(f.model)) {
    sm.skeleton.update(); const P = sm.geometry.attributes.position, v = new THREE.Vector3(), r = new THREE.Vector3();
    // (the body's own vertices; the legs stand where the wave last planted them, a stride's share off their homes)
    const J = sm.geometry.attributes.skinIndex, legBone = (i) => /^leg/.test(sm.skeleton.bones[J.getX(i)].name);
    let worst = 0, legs = 0;
    for (const i of new Set(sm.geometry.index.array)) { r.fromBufferAttribute(P, i); r.z -= hz; r.applyMatrix4(g.matrixWorld); const d = sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld).distanceTo(r); if (legBone(i)) legs = Math.max(legs, d); else worst = Math.max(worst, d); }
    assert.ok(worst < 0.2, `${sm.name}: ${worst.toFixed(3)} m from its bind standing`);
    assert.ok(legs < 0.3, `${sm.name}: its legs ${legs.toFixed(3)} m from theirs`);
  }
  // walking a curve: the head's path kept, the tail behind it on the path; the head stays over the ground at its height
  for (let i = 0; i < 120; i++) { f.state = 'chase'; f.heading += 0.02; f.pos.x += Math.sin(f.heading) * 0.05; f.pos.z += Math.cos(f.heading) * 0.05; foes.look(f, 1 / 60); }
  const head = f.model.tell('lunge').getWorldPosition(new THREE.Vector3());
  assert.ok(head.y > 1.5, `the head reared (${head.y.toFixed(2)} m)`);
  assert.ok(f.model.spine[12].distanceTo(f.model.spine[0]) > 2.5, 'its body stretched out behind it');
  done();
});

test('in the fight both centipedes ring, lunge, open and shut their jaws, go down and leave a body', () => {
  for (const [v, build] of Object.entries(BUILD)) {
    const { foes, f, done } = fight(build);
    for (let i = 0; i < 30; i++) foes.look(f, 1 / 30);
    const tip = f.model.tell('lunge'), at0 = tip.getWorldPosition(new THREE.Vector3());
    f.atk = f.def.attacks.find((a) => a.id === 'lunge'); f.state = 'wind';
    for (let i = 0; i <= 20; i++) { f.k = i / 20; foes.look(f, 1 / 30); }
    assert.ok(tip.getWorldPosition(new THREE.Vector3()).distanceTo(at0) > 0.1, `${v}: the head rears for the lunge`);
    if (v === 'tripo') {
      const lobes = []; f.model.group.traverse((o) => { if (/^lobe/.test(o.name)) lobes.push(o); });
      assert.equal(lobes.length, 2, 'its two halves');
      const open = Math.abs(lobes[0].rotation.y) + Math.abs(lobes[1].rotation.y);
      f.state = 'strike'; f.k = 0.5; for (let i = 0; i < 6; i++) foes.look(f, 1 / 60);
      const shut = Math.abs(lobes[0].rotation.y) + Math.abs(lobes[1].rotation.y);
      assert.ok(open > 0.5 && shut < open * 0.6, `the halves open (${open.toFixed(2)}) and snap shut (${shut.toFixed(2)})`);
    }
    f.atk = null; f.state = 'idle'; f.k = 0;
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 40; i++) foes.update(1 / 30);
    assert.ok(f.dying, `${v}: down`);
    assert.ok(lyingBody(f)?.r > 0.3, `${v}: a lying body (#797)`);
    done();
  }
});

test('it looks at the traveller: the head turns his way, the eyes slide on (#800, the author\'s)', () => {
  const at = {};
  for (const side of [1, -1]) {
    const { foes, f, player, done } = fight(BUILD.tripo);
    player.pos.set(side * 4, 0, 3);
    for (let i = 0; i < 90; i++) { f.dist = player.pos.distanceTo(f.pos); f.state = 'idle'; foes.look(f, 1 / 60); f.model.group.updateMatrixWorld(true); }
    assert.ok(f.gaze.watching, 'it has noticed him');
    at[side] = f.model.gaze[0].yaw;
    done();
  }
  assert.ok(at[1] > 0.15 && at[-1] < -0.15, `the head turns his way (${at[1].toFixed(2)}, ${at[-1].toFixed(2)})`);
});
