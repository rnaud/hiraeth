// The reed knot (issue #800): the Tripo body is the game's root knot (src/enemies/plans/rootknot-tripo.js, its shipped
// asset public/enemies/rootknot/body.glb), the legacy root knot (plans/tentacled-legacy.js) its stand-in where the body is
// not loaded, kept so its look can come back. Every skin builds and keeps its palette and props, its legs' weights are
// sound, its eyes look at the traveller, it lobs its pod and seeds, wilts and sinks, and fights as before.
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
import { rootknotLegacyModel } from '../src/enemies/plans/tentacled-legacy.js';
import { tripoRootknotModel, rootknotSource, ROOTKNOT_BODY, ROOTKNOT_ROLES } from '../src/enemies/plans/rootknot-tripo.js';
import { parseTripoBody } from '../src/enemies/plans/tripo-body.js';
import { PLANS } from '../src/motion-kit/plans.js';
import { nextRigSeed } from '../src/motion-kit/rig.js';

THREE.ColorManagement.enabled = false;
const SRC = rootknotSource();
const BUILD = { legacy: rootknotLegacyModel, tripo: (skin) => tripoRootknotModel(skin, SRC) };
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const skinnedOf = (M) => { const out = []; M.group.traverse((o) => { if (o.isSkinnedMesh) out.push(o); }); return out; };
const named = (M, name) => { let out = null; M.group.traverse((o) => { if (o.name === name) out = o; }); return out; };
const hex = (m) => `#${m.uniforms.uColor.value.getHexString()}`;
function posed(M) {
  M.group.updateMatrixWorld(true);
  const b = new THREE.Box3(), v = new THREE.Vector3();
  for (const sm of skinnedOf(M)) { sm.skeleton.update(); const P = sm.geometry.attributes.position; for (const i of new Set(sm.geometry.index.array)) b.expandByPoint(sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld)); }
  return b;
}

test('the game\'s root knot is the Tripo reed knot, from its shipped body, in every skin; the legacy kept (#800)', () => {
  assert.deepEqual(Object.keys(TRIAL_BUILDERS), []);
  for (const id of Object.keys(SKINS.rootknot)) { const M = archetypeModel('rootknot', id); assert.equal(M.tripo, 'tripo', id); M.dispose(); }
  const T = parseTripoBody(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyF-tripo/rootknot-lod.glb', import.meta.url)));
  assert.deepEqual(Array.from(SRC.geometry.attributes.position.array), Array.from(T.geometry.attributes.position.array));
  assert.deepEqual(Array.from(SRC.geometry.index.array), Array.from(T.geometry.index.array));
  assert.equal(SRC.geometry.attributes.uv, undefined, 'no picture (no UVs)');
  assert.deepEqual(SRC.landmarks, JSON.parse(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyF-tripo/rootknot-landmarks.json', import.meta.url), 'utf8')));
  assert.ok(readFileSync(new URL(`../public/${ROOTKNOT_BODY}`, import.meta.url)).length < 400 * 1024, 'under 400 KB');
  for (const id of Object.keys(SKINS.rootknot)) { const M = rootknotLegacyModel(skinOf('rootknot', id)); assert.equal(M.tripo, undefined); M.dispose(); }
  const home = skinOf('rootknot', 'perdide').palette;
  assert.deepEqual([home.cap, home.bulb, home.root], [ROOTKNOT_ROLES.cap, ROOTKNOT_ROLES.bulb, ROOTKNOT_ROLES.leg], 'the home skin the reference\'s');
});

test('every world\'s skin builds on the Tripo body: five legs on the tentacled plan, its palette, its tells', () => {
  for (const id of Object.keys(SKINS.rootknot)) {
    const skin = skinOf('rootknot', id), P = skin.palette, M = tripoRootknotModel(skin, SRC);
    for (const k of ['group', 'body', 'rig', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose']) assert.ok(M[k] !== undefined, `${id}: ${k}`);
    const sms = skinnedOf(M);
    assert.equal(new Set(sms.map((s) => s.skeleton)).size, 1, `${id}: one skeleton`);
    assert.ok(sms.some((s) => s.material.defines?.FOE_SURFACE), `${id}: a painted surface`);
    assert.equal(hex(named(M, 'rootknot cap').material), P.cap, `${id}: its cap`);
    assert.equal(hex(named(M, 'rootknot bulb').material), P.bulb, `${id}: its bulb`);
    assert.equal(hex(named(M, 'rootknot leg').material), P.root, `${id}: its legs`);
    assert.equal(M.rig.legs.length, 5, `${id}: five legs`);
    assert.equal(M.rig.plan, PLANS.tentacled, `${id}: the tentacled plan`);
    assert.ok(drawn(M.group) <= 9, `${id}: ${drawn(M.group)} meshes`);
    assert.ok(M.spore, `${id}: its spores' colour`);
    for (const a of ARCHETYPES.rootknot.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${id}: a tell for ${a.id}`);
    M.dispose();
  }
});

test('the Tripo skin: its triangles, normalised weights, an exact bind, every bone carrying vertices', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  const M = tripoRootknotModel(skinOf('rootknot', 'perdide'), SRC), sms = skinnedOf(M), sk = sms[0].skeleton;
  M.group.updateMatrixWorld(true); sk.update();
  const v = new THREE.Vector3(), rest = new THREE.Vector3(), carried = new Set();
  let worst = 0;
  for (const sm of sms) {
    const W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex, Pp = sm.geometry.attributes.position;
    for (const i of new Set(sm.geometry.index.array)) {
      const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i}: weights ${s}`);
      for (const [j, w] of [[J.getX(i), W.getX(i)], [J.getY(i), W.getY(i)], [J.getZ(i), W.getZ(i)]]) if (w > 0) carried.add(j);
      rest.fromBufferAttribute(Pp, i).applyMatrix4(sm.matrixWorld);
      worst = Math.max(worst, sm.applyBoneTransform(i, v.fromBufferAttribute(Pp, i)).applyMatrix4(sm.matrixWorld).distanceTo(rest));
    }
  }
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  assert.equal(carried.size, sk.bones.length, 'every bone carries vertices');
  M.dispose();
});

function fight(build, id = 'rootknot@perdide') {
  clearTargets(); TRIAL_BUILDERS.rootknot = build; nextRigSeed(17);
  const player = { pos: new THREE.Vector3(0, 0, 8), heading: Math.PI };
  const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player, physics: { groundAt: () => 0 }, game: new GameState(null), rng: seeded() });
  const f = foes.add(id, new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  return { foes, f, player, done() { foes.dispose(); delete TRIAL_BUILDERS.rootknot; clearTargets(); } };
}

test('it stands about 3.2 m on its feet, tips its cap back for the pod, rises for the seeds, keeps its feet out of the ground, and goes down', () => {
  for (const [v, build] of Object.entries(BUILD)) {
    const { foes, f, done } = fight(build);
    for (let i = 0; i < 60; i++) foes.look(f, 1 / 30);
    if (v === 'tripo') {
      const b = posed(f.model);
      assert.ok(b.max.y > 2.9 && b.max.y < 3.6 && b.min.y > -0.03, `${v}: ${b.min.y.toFixed(2)}–${b.max.y.toFixed(2)} m`);
      const cap = f.model.tell('seeds'), x0 = cap.rotation.x;
      f.atk = f.def.attacks.find((a) => a.id === 'pod'); f.state = 'wind';
      for (let i = 0; i <= 20; i++) { f.k = (i / 20) * 0.6; foes.look(f, 1 / 30); }
      assert.ok(cap.rotation.x < x0 - 0.2, `${v}: its cap tips back (${x0.toFixed(2)} → ${cap.rotation.x.toFixed(2)})`);
      assert.ok(f.model.tell('pod').visible, `${v}: the pod under its rim`);
      f.atk = f.def.attacks.find((a) => a.id === 'seeds');
      for (let i = 0; i <= 30; i++) { f.k = (i / 30) * 0.6; foes.look(f, 1 / 30); }
      const s = posed(f.model);
      assert.ok(s.min.y > -0.05, `${v}: its feet out of the ground as it rises (${s.min.y.toFixed(2)})`);
      f.atk = null; f.state = 'idle'; f.k = 0;
    }
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 60; i++) foes.update(1 / 30);
    assert.ok(f.dying || !f.alive, `${v}: down`);
    done();
  }
});

test('it looks at the traveller: its eyes slide his way (#800, the author\'s)', () => {
  const at = {};
  for (const side of [1, -1]) {
    const { foes, f, player, done } = fight(BUILD.tripo);
    player.pos.set(side * 5, 0, 5);
    for (let i = 0; i < 90; i++) { f.dist = player.pos.distanceTo(f.pos); f.state = 'idle'; foes.look(f, 1 / 60); f.model.group.updateMatrixWorld(true); }
    assert.ok(f.gaze.watching, 'it has noticed him');
    at[side] = f.model.gaze[0].node.position.x - f.model.gaze[0].rest.x;
    done();
  }
  assert.ok(at[1] > 0.005 && at[-1] < -0.005, `the eyes slide his way (${at[1].toFixed(3)}, ${at[-1].toFixed(3)})`);
});
