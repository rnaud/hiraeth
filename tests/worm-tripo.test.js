// The dune worm (issue #800): the Tripo body is the game's worm (src/enemies/plans/worm-tripo.js, its shipped asset
// public/enemies/worm/body.glb), the legacy mound worm (plans/burrower-legacy.js) its stand-in where the body is not
// loaded, kept so its look can come back. Every skin builds and keeps its palette and props, its spine's weights are
// sound, its head turns to the traveller, it stands out of its hole and goes back under, and it fights as before.
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
import { wormLegacyModel } from '../src/enemies/plans/burrower-legacy.js';
import { tripoWormModel, wormSource, WORM_BODY, WORM_ROLES } from '../src/enemies/plans/worm-tripo.js';
import { parseTripoBody } from '../src/enemies/plans/tripo-body.js';
import { nextRigSeed } from '../src/motion-kit/rig.js';

THREE.ColorManagement.enabled = false;
const SRC = wormSource();
const BUILD = { legacy: wormLegacyModel, tripo: (skin) => tripoWormModel(skin, SRC) };
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const skinnedOf = (M) => { const out = []; M.group.traverse((o) => { if (o.isSkinnedMesh) out.push(o); }); return out; };
const named = (M, name) => { let out = null; M.group.traverse((o) => { if (o.name === name) out = o; }); return out; };
const hex = (m) => `#${m.uniforms.uColor.value.getHexString()}`;
/** The skinned body's posed box (its drawn vertices, where its bones put them). */
function posed(M) {
  M.group.updateMatrixWorld(true);
  const b = new THREE.Box3(), v = new THREE.Vector3();
  for (const sm of skinnedOf(M)) { if (!sm.visible) continue; sm.skeleton.update(); const P = sm.geometry.attributes.position; for (const i of new Set(sm.geometry.index.array)) b.expandByPoint(sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld)); }
  return b;
}

test('the game\'s worm is the Tripo dune worm, from its shipped body, in every skin; the legacy kept (#800)', () => {
  assert.deepEqual(Object.keys(TRIAL_BUILDERS), []);
  for (const id of Object.keys(SKINS.worm)) { const M = archetypeModel('worm', id); assert.equal(M.tripo, 'tripo', id); M.dispose(); }
  const T = parseTripoBody(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyF-tripo/worm-lod.glb', import.meta.url)));
  assert.deepEqual(Array.from(SRC.geometry.attributes.position.array), Array.from(T.geometry.attributes.position.array));
  assert.deepEqual(Array.from(SRC.geometry.index.array), Array.from(T.geometry.index.array));
  assert.equal(SRC.geometry.attributes.uv, undefined, 'no picture (no UVs)');
  assert.deepEqual(SRC.landmarks, JSON.parse(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyF-tripo/worm-landmarks.json', import.meta.url), 'utf8')));
  assert.ok(readFileSync(new URL(`../public/${WORM_BODY}`, import.meta.url)).length < 400 * 1024, 'under 400 KB');
  for (const id of Object.keys(SKINS.worm)) { const M = wormLegacyModel(skinOf('worm', id)); assert.equal(M.tripo, undefined); M.dispose(); }
  const home = skinOf('worm', 'desert').palette;
  assert.deepEqual([home.body, home.belly, home.mouth], [WORM_ROLES.body, WORM_ROLES.belly, WORM_ROLES.mouth], 'the home skin the reference\'s');
});

test('every world\'s skin builds on the Tripo body: its palette on its parts, its props, its mounds and fin, its tells', () => {
  for (const id of Object.keys(SKINS.worm)) {
    const skin = skinOf('worm', id), P = skin.palette, M = tripoWormModel(skin, SRC);
    for (const k of ['group', 'body', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'trail', 'mounds']) assert.ok(M[k] !== undefined, `${id}: ${k}`);
    const sms = skinnedOf(M);
    assert.equal(new Set(sms.map((s) => s.skeleton)).size, 1, `${id}: one skeleton`);
    assert.ok(sms.some((s) => s.material.defines?.FOE_SURFACE), `${id}: a painted surface`);
    assert.equal(hex(named(M, 'worm body').material), P.body, `${id}: its body`);
    assert.equal(hex(named(M, 'worm belly').material), P.belly, `${id}: its belly`);
    assert.equal(hex(named(M, 'worm mouth').material), P.mouth, `${id}: its mouth`);
    for (const prop of ['drill', 'crest']) assert.equal(!!named(M, prop), (skin.props ?? []).includes(prop), `${id}: its ${prop}`);
    assert.ok(M.mounds.length >= 4, `${id}: its mounds`);
    // (up: its body, eyes, teeth and hole; under: its mounds, fin and ripple; never both)
    const f = { pos: new THREE.Vector3(), heading: 0, state: 'idle', k: 0, atk: null, provoked: true, buried: false, home: new THREE.Vector3(), stunned: 0 };
    const c = { dt: 1 / 30, now: 0, wind: 0, moving: false, dust() {}, spray() {}, recovery: 0 };
    for (let i = 0; i < 60; i++) { c.now += 33; M.anim(f, c); }
    const up = drawn(M.group);
    f.buried = true; for (let i = 0; i < 90; i++) { c.now += 33; M.anim(f, c); }
    const under = drawn(M.group);
    assert.ok(up <= 9 && under <= 9, `${id}: ${up} meshes up, ${under} under`);
    for (const a of ARCHETYPES.worm.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${id}: a tell for ${a.id}`);
    M.dispose();
  }
});

test('the Tripo skin: its triangles, normalised weights, an exact bind, every bone carrying vertices', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  const M = tripoWormModel(skinOf('worm', 'desert'), SRC), sms = skinnedOf(M), sk = sms[0].skeleton;
  // (at its bind: its bones where the spine was measured)
  sk.bones.forEach((b, i) => { b.updateMatrixWorld(true); });
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

function fight(build, id = 'worm@desert') {
  clearTargets(); TRIAL_BUILDERS.worm = build; nextRigSeed(13);
  const player = { pos: new THREE.Vector3(0, 0, 6), heading: Math.PI };
  const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player, physics: { groundAt: () => 0 }, game: new GameState(null), rng: seeded() });
  const f = foes.add(id, new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  return { foes, f, player, done() { foes.dispose(); delete TRIAL_BUILDERS.worm; clearTargets(); } };
}

test('up, it stands out of its hole near 3 m, its tail down in the sand close under it; it rears to spit, leans to dive, and goes under', () => {
  const { foes, f, done } = fight(BUILD.tripo);
  f.buried = false;
  for (let i = 0; i < 90; i++) foes.look(f, 1 / 30);
  const up = posed(f.model);
  assert.ok(up.max.y > 2.6 && up.max.y < 3.6, `its crown at ${up.max.y.toFixed(2)} m`);
  assert.ok(up.min.y > -0.8, `under the sand it stays close under it (${up.min.y.toFixed(2)} m)`);
  const at = (id, extra) => { f.atk = { ...f.def.attacks.find((a) => a.id === id), ...extra }; f.state = 'wind'; for (let i = 0; i <= 30; i++) { f.k = (i / 30) * 0.8; foes.look(f, 1 / 30); } const b = posed(f.model); f.atk = null; f.state = 'idle'; f.k = 0; for (let i = 0; i < 30; i++) foes.look(f, 1 / 30); return b; };
  assert.ok(at('spit').min.z < up.min.z - 0.2, 'it rears back to spit');
  assert.ok(at('dive').max.z > up.max.z + 0.3, 'it leans over toward you to dive');
  f.buried = true;
  for (let i = 0; i < 90; i++) foes.look(f, 1 / 30);
  assert.ok(skinnedOf(f.model).every((s) => !s.visible), 'under: its body hidden');
  assert.ok(f.model.mounds.some((m) => m.visible), 'under: its mounds');
  done();
});

test('it looks at the traveller: its head turns his way (#800, the author\'s)', () => {
  const at = {};
  for (const side of [1, -1]) {
    const { foes, f, player, done } = fight(BUILD.tripo);
    f.buried = false; player.pos.set(side * 4, 0, 4);
    for (let i = 0; i < 90; i++) { f.dist = player.pos.distanceTo(f.pos); f.state = 'idle'; foes.look(f, 1 / 60); f.model.group.updateMatrixWorld(true); }
    assert.ok(f.gaze.watching, 'it has noticed him');
    at[side] = f.model.gaze[0].yaw;
    done();
  }
  assert.ok(at[1] > 0.12 && at[-1] < -0.12, `the head turns his way (${at[1].toFixed(2)}, ${at[-1].toFixed(2)})`);
});

test('both bodies go down as a burrower does (back under the sand)', () => {
  for (const [v, build] of Object.entries(BUILD)) {
    const { foes, f, done } = fight(build);
    f.buried = false;
    for (let i = 0; i < 30; i++) foes.look(f, 1 / 30);
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 50; i++) foes.update(1 / 30);
    assert.ok(f.dying || !f.alive, `${v}: down`);
    done();
  }
});
