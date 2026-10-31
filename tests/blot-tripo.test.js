// The ink blot (issue #800): the Tripo body is the game's blot (src/enemies/plans/blot-tripo.js, its shipped asset
// public/enemies/blot/body.glb), the legacy blot (plans/blob-legacy.js) its stand-in where the body is not loaded, kept so
// its look can come back. Every one of its 22 skins builds and keeps its palette and props, its weights are sound, its
// pupils look at the traveller, it pools when calm and stands as he comes, and it fights as the teacher always did.
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
import { blotLegacyModel } from '../src/enemies/plans/blob-legacy.js';
import { tripoBlotModel, blotSource, BLOT_BODY, BLOT_ROLES } from '../src/enemies/plans/blot-tripo.js';
import { parseTripoBody } from '../src/enemies/plans/tripo-body.js';
import { nextRigSeed } from '../src/motion-kit/rig.js';

THREE.ColorManagement.enabled = false;
const SRC = blotSource();
const BUILD = { legacy: blotLegacyModel, tripo: (skin) => tripoBlotModel(skin, SRC) };
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const skinnedOf = (M) => { const out = []; M.group.traverse((o) => { if (o.isSkinnedMesh) out.push(o); }); return out; };
const named = (M, name) => { let out = null; M.group.traverse((o) => { if (o.name === name) out = o; }); return out; };
const hex = (m) => `#${m.uniforms.uColor.value.getHexString()}`;
const top = (M) => new THREE.Box3().setFromObject(M.group).max.y;

test('the game\'s blot is the Tripo ink blot, from its shipped body, in all 22 skins; the legacy kept (#800)', () => {
  assert.deepEqual(Object.keys(TRIAL_BUILDERS), []);
  assert.equal(Object.keys(SKINS.blot).length, 22);
  for (const id of Object.keys(SKINS.blot)) { const M = archetypeModel('blot', id); assert.equal(M.tripo, 'tripo', id); M.dispose(); }
  const T = parseTripoBody(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyF-tripo/blot-lod.glb', import.meta.url)));
  assert.deepEqual(Array.from(SRC.geometry.attributes.position.array), Array.from(T.geometry.attributes.position.array));
  assert.deepEqual(Array.from(SRC.geometry.index.array), Array.from(T.geometry.index.array));
  assert.equal(SRC.geometry.attributes.uv, undefined, 'no picture (no UVs)');
  assert.deepEqual(SRC.landmarks, JSON.parse(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyF-tripo/blot-landmarks.json', import.meta.url), 'utf8')));
  assert.ok(readFileSync(new URL(`../public/${BLOT_BODY}`, import.meta.url)).length < 250 * 1024, 'under 250 KB');
  for (const id of Object.keys(SKINS.blot)) { const M = blotLegacyModel(skinOf('blot', id)); assert.equal(M.tripo, undefined); M.dispose(); }
  const home = skinOf('blot', 'desert').palette;
  assert.deepEqual([home.ink, home.shine, home.belly], [BLOT_ROLES.ink, BLOT_ROLES.shine, BLOT_ROLES.belly], 'the home skin the reference\'s');
});

test('every world\'s skin builds on the Tripo body: its palette on its parts, its pool in its world\'s colour, its props, its tells', () => {
  for (const id of Object.keys(SKINS.blot)) {
    const skin = skinOf('blot', id), P = skin.palette, M = tripoBlotModel(skin, SRC);
    for (const k of ['group', 'body', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose']) assert.ok(M[k] !== undefined, `${id}: ${k}`);
    const sms = skinnedOf(M);
    assert.equal(sms.length, 3, `${id}: the ink, the flank, the belly`);
    assert.equal(new Set(sms.map((s) => s.skeleton)).size, 1, `${id}: one skeleton`);
    assert.ok(sms.some((s) => s.material.defines?.FOE_SURFACE), `${id}: a painted surface`);
    assert.equal(hex(named(M, 'blot ink').material), P.ink, `${id}: its ink`);
    assert.equal(hex(named(M, 'blot belly').material), P.belly, `${id}: its belly`);
    assert.equal(hex(named(M, 'blot shine').material), P.shine, `${id}: its light`);
    // (its pool's rim: the world's own colour, as the legacy's; the belly too, but the Desert's the reference's tan)
    assert.equal(hex(named(M, 'pool').children[0].material), P.edge, `${id}: its rim`);
    if (id !== 'desert') assert.equal(P.belly, P.edge, `${id}: its belly the world's colour`);
    assert.equal(!!named(M, 'shavings'), (skin.props ?? []).includes('shavings'), `${id}: its shavings`);
    assert.ok(drawn(M.group) <= 9, `${id}: ${drawn(M.group)} meshes`);
    for (const a of ARCHETYPES.blot.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${id}: a tell for ${a.id}`);
    M.dispose();
  }
});

test('the Tripo skin: its triangles, normalised weights, an exact bind, the hook on its own bone', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 5000 && tris <= 9000, `${tris} triangles`);
  const M = tripoBlotModel(skinOf('blot', 'desert'), SRC), sms = skinnedOf(M), sk = sms[0].skeleton;
  M.group.updateMatrixWorld(true); sk.update();
  const v = new THREE.Vector3(), rest = new THREE.Vector3(), carried = new Set();
  let worst = 0;
  for (const sm of sms) {
    const W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex, Pp = sm.geometry.attributes.position;
    for (const i of new Set(sm.geometry.index.array)) {
      const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i}: weights ${s}`);
      if (W.getX(i) > 0) carried.add(J.getX(i)); if (W.getY(i) > 0) carried.add(J.getY(i));
      rest.fromBufferAttribute(Pp, i).applyMatrix4(sm.matrixWorld);
      worst = Math.max(worst, sm.applyBoneTransform(i, v.fromBufferAttribute(Pp, i)).applyMatrix4(sm.matrixWorld).distanceTo(rest));
    }
  }
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  assert.equal(carried.size, sk.bones.length, 'both bones carry vertices');
  // (the hook bent alone moves only what is above the eyes)
  sk.bones[1].rotation.x = 0.5; M.group.updateMatrixWorld(true); sk.update();
  let low = 0;
  for (const sm of sms) { const Pp = sm.geometry.attributes.position; for (const i of new Set(sm.geometry.index.array)) { if (Pp.getY(i) > 0.7) continue; rest.fromBufferAttribute(Pp, i); low = Math.max(low, sm.applyBoneTransform(i, v.fromBufferAttribute(Pp, i)).distanceTo(rest)); } }
  assert.ok(low < 1e-4, `the hook moves the drop under the eyes ${low}`);
  M.dispose();
});

function fight(build, id = 'blot@desert') {
  clearTargets(); TRIAL_BUILDERS.blot = build; nextRigSeed(11);
  const player = { pos: new THREE.Vector3(0, 0, 6), heading: Math.PI };
  const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player, physics: { groundAt: () => 0 }, game: new GameState(null), rng: seeded() });
  const f = foes.add(id, new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  return { foes, f, player, done() { foes.dispose(); delete TRIAL_BUILDERS.blot; clearTargets(); } };
}

test('it stands at the traveller\'s thigh, pools when calm and stands up as he comes, coils, rears and goes down', () => {
  for (const [v, build] of Object.entries(BUILD)) {
    const { foes, f, done } = fight(build);
    for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
    const tall = top(f.model);
    assert.ok(tall >= 0.85 && tall < 1.3, `${v}: ${tall.toFixed(2)} m`);
    // calm and alone, it melts into a stain (its drop's height: the legacy's parts are drawn by the foes' batches)
    const sy = () => f.model.body.scale.y;
    f.provoked = false; f.state = 'idle';
    for (let i = 0; i < 120; i++) foes.look(f, 1 / 30);
    assert.ok(sy() < 0.6, `${v}: pooled to ${sy().toFixed(2)} of its height`);
    f.provoked = true;
    for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
    assert.ok(sy() > 0.9, `${v}: up again`);
    // the lunge's coil: down into its rings
    f.atk = f.def.attacks.find((a) => a.id === 'lunge'); f.state = 'wind';
    for (let i = 0; i <= 20; i++) { f.k = i / 20; foes.look(f, 1 / 30); }
    assert.ok(sy() < 0.8, `${v}: it coils down`);
    // the spit: up tall and thin
    f.atk = f.def.attacks.find((a) => a.id === 'spit'); f.state = 'wind';
    for (let i = 0; i <= 30; i++) { f.k = i / 30; foes.look(f, 1 / 30); }
    assert.ok(sy() > 1.2, `${v}: it rears up`);
    if (v === 'tripo') assert.ok(top(f.model) > tall * 1.15, `${v}: its hook up high`);
    f.atk = null; f.state = 'idle'; f.k = 0;
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 40; i++) foes.update(1 / 30);
    assert.ok(f.dying || !f.alive, `${v}: down`);
    done();
  }
});

test('the Tripo blot standing is a drop of its own: no pool under it (the approved design), the pool as it melts', () => {
  const { foes, f, done } = fight(BUILD.tripo);
  for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
  const pool = (() => { let p = null; f.model.group.traverse((o) => { if (o.name === 'pool') p = o; }); return p; })();
  assert.equal(pool.visible, false, 'standing: no pool');
  f.provoked = false; f.state = 'idle';
  for (let i = 0; i < 120; i++) foes.look(f, 1 / 30);
  assert.equal(pool.visible, true, 'pooled: the pool');
  done();
});

test('it looks at the traveller: its slit pupils slide his way (#800, the author\'s)', () => {
  const at = {};
  for (const side of [1, -1]) {
    const { foes, f, player, done } = fight(BUILD.tripo);
    player.pos.set(side * 4, 0, 3);
    for (let i = 0; i < 90; i++) { f.dist = player.pos.distanceTo(f.pos); f.state = 'idle'; foes.look(f, 1 / 60); f.model.group.updateMatrixWorld(true); }
    assert.ok(f.gaze.watching, 'it has noticed him');
    at[side] = f.model.gaze[0].node.position.x - f.model.gaze[0].rest.x;
    done();
  }
  assert.ok(at[1] > 0.004 && at[-1] < -0.004, `the pupils slide his way (${at[1].toFixed(3)}, ${at[-1].toFixed(3)})`);
});
