// The seedpod skitter (issue #800): the Tripo body is the game's skitter (src/enemies/plans/skitter-tripo.js, its shipped
// asset public/enemies/skitter/body.glb), the legacy skitter (plans/skitterers-legacy.js) its stand-in where the body is
// not loaded, kept so its look can come back. The Tripo skin's weights are sound, it stands at the traveller's hip grown,
// its head plate looks at him, every skin builds, and it fights as the swarm always did.
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
import { skitterLegacyModel } from '../src/enemies/plans/skitterers-legacy.js';
import { tripoSkitterModel, skitterSource, SKITTER_BODY, SKITTER_ROLES } from '../src/enemies/plans/skitter-tripo.js';
import { parseTripoBody } from '../src/enemies/plans/tripo-body.js';
import { PLANS } from '../src/motion-kit/plans.js';

THREE.ColorManagement.enabled = false;
const SRC = skitterSource();
const BUILD = { legacy: skitterLegacyModel, tripo: (skin) => tripoSkitterModel(skin, SRC) };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const skinnedOf = (M) => { const out = []; M.group.traverse((o) => { if (o.isSkinnedMesh) out.push(o); }); return out; };

test('the game\'s skitter is the Tripo seedpod skitter, from its shipped body, in every skin; the legacy kept (#800)', () => {
  assert.deepEqual(Object.keys(TRIAL_BUILDERS), []);
  for (const id of Object.keys(SKINS.skitter)) { const M = archetypeModel('skitter', id); assert.equal(M.tripo, 'tripo', id); M.dispose(); }
  const T = parseTripoBody(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyA-tripo/skitter-lod.glb', import.meta.url)));
  assert.deepEqual(Array.from(SRC.geometry.attributes.position.array), Array.from(T.geometry.attributes.position.array));
  assert.deepEqual(Array.from(SRC.geometry.index.array), Array.from(T.geometry.index.array));
  assert.equal(SRC.geometry.attributes.uv, undefined, 'no picture (no UVs)');
  assert.deepEqual(SRC.landmarks, JSON.parse(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyA-tripo/skitter-landmarks.json', import.meta.url), 'utf8')));
  assert.ok(readFileSync(new URL(`../public/${SKITTER_BODY}`, import.meta.url)).length < 300 * 1024, 'under 300 KB');
  for (const id of Object.keys(SKINS.skitter)) { const M = skitterLegacyModel(skinOf('skitter', id)); assert.equal(M.tripo, undefined); M.dispose(); }
  assert.equal(skinOf('skitter', 'desert').palette.dome, SKITTER_ROLES.shell, 'the home skin the reference\'s');
});

test('every world\'s skin builds on the Tripo body: a handful of meshes, eight legs on the kit, its tells', () => {
  for (const id of Object.keys(SKINS.skitter)) {
    const M = tripoSkitterModel(skinOf('skitter', id), SRC);
    for (const k of ['group', 'body', 'rig', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose']) assert.ok(M[k] !== undefined, `${id}: ${k}`);
    const sms = skinnedOf(M);
    assert.equal(new Set(sms.map((s) => s.skeleton)).size, 1, `${id}: one skeleton`);
    assert.ok(sms.some((s) => s.material.defines?.FOE_SURFACE), `${id}: a painted surface`);
    assert.ok(drawn(M.group) <= 6, `${id}: ${drawn(M.group)} meshes`);
    assert.equal(M.rig.legs.length, 8, `${id}: eight legs`);
    assert.equal(M.rig.plan, PLANS.skitterers, `${id}: the skitterers' plan`);
    for (const a of ARCHETYPES.skitter.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${id}: a tell for ${a.id}`);
    if (skinOf('skitter', id).props.includes('seam')) { let seam = false; M.group.traverse((o) => { if (o.name === 'seam') seam = true; }); assert.ok(seam, `${id}: its glowing seam`); }
    M.dispose();
  }
});

test('the Tripo skin: a flock\'s budget of triangles, normalised weights, an exact bind, every bone carrying vertices', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 5000 && tris <= 9000, `${tris} triangles`);
  const M = tripoSkitterModel(skinOf('skitter', 'desert'), SRC), sms = skinnedOf(M), sk = sms[0].skeleton;
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
  assert.equal(carried.size, sk.bones.length, 'every bone carries vertices');
  M.dispose();
});

function fight(build, id = 'skitter@desert') {
  clearTargets(); TRIAL_BUILDERS.skitter = build;
  const player = { pos: new THREE.Vector3(0, 0, 6), heading: Math.PI };
  const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
  const f = foes.add(id, new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  return { foes, f, player, done() { foes.dispose(); delete TRIAL_BUILDERS.skitter; clearTargets(); } };
}

test('grown, it stands at the traveller\'s hip, rears for its rush and goes down (#741)', () => {
  for (const [v, build] of Object.entries(BUILD)) {
    const { foes, f, done } = fight(build);
    for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
    const top = new THREE.Box3().setFromObject(f.model.group).max.y;
    assert.ok(top >= 0.955 && top < 1.4, `${v}: ${top.toFixed(2)} m`);
    const eyes = f.model.tell('rush'), at0 = eyes.getWorldPosition(new THREE.Vector3());
    f.atk = f.def.attacks.find((a) => a.id === 'rush'); f.state = 'wind';
    for (let i = 0; i <= 20; i++) { f.k = i / 20; foes.look(f, 1 / 30); }
    assert.ok(eyes.getWorldPosition(new THREE.Vector3()).y > at0.y + 0.05, `${v}: it rears up`);
    f.atk = null; f.state = 'idle'; f.k = 0;
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 40; i++) foes.update(1 / 30);
    assert.ok(f.dying || !f.alive, `${v}: down`);
    done();
  }
});

test('it looks at the traveller: the head plate turns his way (#800, the author\'s)', () => {
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
