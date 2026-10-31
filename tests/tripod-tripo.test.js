// The inspection tripod (issue #800): the Tripo body is the game's tripod (src/enemies/plans/tripod-tripo.js, its shipped
// asset public/enemies/tripod/body.glb), the legacy lamp tripod (plans/piston-legacy.js) its stand-in where the body is
// not loaded, kept so its look can come back. Its rigid parts' weights are sound, a bent joint moves only its own part,
// it stands as tall as the old one with its lens as high, its lamp head looks at the traveller, every skin builds, and
// it fights as the lamp tripod always did (its beam's light, its armour, its weak lens).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { ARMOUR } from '../src/enemies/fight.js';
import { TRIAL_BUILDERS, archetypeModel } from '../src/enemies/plans/index.js';
import { tripodLegacyModel } from '../src/enemies/plans/piston-legacy.js';
import { tripoTripodModel, tripodSource, TRIPOD_BODY, TRIPOD_ROLES } from '../src/enemies/plans/tripod-tripo.js';
import { parseTripoBody } from '../src/enemies/plans/tripo-body.js';
import { nextRigSeed } from '../src/motion-kit/rig.js';

THREE.ColorManagement.enabled = false;
const SRC = tripodSource();
const BUILD = { legacy: tripodLegacyModel, tripo: (skin) => tripoTripodModel(skin, SRC) };
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const skinnedOf = (M) => { const out = []; M.group.traverse((o) => { if (o.isSkinnedMesh && o.name.startsWith('tripod ') && o.name !== 'tripod fittings') out.push(o); }); return out; };
/** A seeded random (the fights' own rng: tests that field foes are seeded, c5b8ab3c1). */
const seeded = (s = 7) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test('the game\'s tripod is the Tripo inspection tripod, from its shipped body, in every skin; the legacy kept (#800)', () => {
  assert.deepEqual(Object.keys(TRIAL_BUILDERS), []);
  for (const id of Object.keys(SKINS.tripod)) { const M = archetypeModel('tripod', id); assert.equal(M.tripo, 'tripo', id); M.dispose(); }
  const T = parseTripoBody(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyE-tripo/tripod-lod.glb', import.meta.url)));
  assert.deepEqual(Array.from(SRC.geometry.attributes.position.array), Array.from(T.geometry.attributes.position.array));
  assert.deepEqual(Array.from(SRC.geometry.index.array), Array.from(T.geometry.index.array));
  assert.equal(SRC.geometry.attributes.uv, undefined, 'no picture (no UVs)');
  assert.deepEqual(SRC.landmarks, JSON.parse(readFileSync(new URL('../references/enemy-redesign-2026-10-30/trials/familyE-tripo/tripod-landmarks.json', import.meta.url), 'utf8')));
  assert.ok(readFileSync(new URL(`../public/${TRIPOD_BODY}`, import.meta.url)).length < 450 * 1024, 'under 450 KB');
  for (const id of Object.keys(SKINS.tripod)) { const M = tripodLegacyModel(skinOf('tripod', id)); assert.equal(M.tripo, undefined); M.dispose(); }
  const home = skinOf('tripod', 'incal').palette;
  assert.equal(home.body, TRIPOD_ROLES.body, 'the home skin the reference\'s cream');
  assert.equal(home.limb, TRIPOD_ROLES.limb, 'and its sage');
});

test('every world\'s skin builds on the Tripo body: eight drawn meshes, three legs on the kit, its tells, its armour, its lamp', () => {
  for (const id of Object.keys(SKINS.tripod)) {
    const M = tripoTripodModel(skinOf('tripod', id), SRC);
    for (const k of ['group', 'body', 'rig', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'lamp', 'weak']) assert.ok(M[k] !== undefined, `${id}: ${k}`);
    const sms = skinnedOf(M);
    assert.equal(sms.length, 3, `${id}: the cream, the sage, the dark`);
    assert.equal(new Set(sms.map((s) => s.skeleton)).size, 1, `${id}: one skeleton`);
    assert.ok(sms.some((s) => s.material.defines?.FOE_SURFACE), `${id}: a painted surface`);
    assert.ok(drawn(M.group) <= 8, `${id}: ${drawn(M.group)} meshes`);
    assert.equal(M.rig.legs.length, 3, `${id}: three legs`);
    assert.equal(M.plates.length, ARMOUR.tripod.plates, `${id}: its armour plates`);
    for (const a of ARCHETYPES.tripod.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `${id}: a tell for ${a.id}`);
    assert.equal(M.weak.obj.name, 'lens', `${id}: the lens its weak point`);
    M.dispose();
  }
});

test('the Tripo skin: its triangles, normalised weights, an exact bind, every bone carrying vertices, a joint bent alone moves its own part', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  const M = tripoTripodModel(skinOf('tripod', 'incal'), SRC), sms = skinnedOf(M), sk = sms[0].skeleton;
  M.group.updateMatrixWorld(true); sk.update();
  const v = new THREE.Vector3(), rest = new THREE.Vector3(), carried = new Set();
  let worst = 0;
  const pos = (sm, i) => sm.applyBoneTransform(i, v.fromBufferAttribute(sm.geometry.attributes.position, i)).applyMatrix4(sm.matrixWorld);
  for (const sm of sms) {
    const W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position;
    for (const i of new Set(sm.geometry.index.array)) {
      const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i}: weights ${s}`);
      carried.add(J.getX(i));
      rest.fromBufferAttribute(P, i).applyMatrix4(sm.matrixWorld);
      worst = Math.max(worst, pos(sm, i).distanceTo(rest));
    }
  }
  assert.ok(worst < 1e-4, `bind round trip ${worst}`);
  assert.equal(carried.size, sk.bones.length, 'every bone carries vertices');
  // (the front-left shin bent alone at its knee: only the vertices weighted to it move, the hub and the other legs stay)
  const shin = sk.bones[M.group.children.length ? sk.bones.findIndex((b) => b.name === 'leg0_shin') : 0], si = sk.bones.indexOf(shin);
  shin.rotateX(0.4); M.group.updateMatrixWorld(true); sk.update();
  let stray = 0;
  for (const sm of sms) { const W = sm.geometry.attributes.skinWeight, J = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position;
    for (const i of new Set(sm.geometry.index.array)) { const mine = [0, 1, 2, 3].some((k) => J.getComponent(i, k) === si && W.getComponent(i, k) > 0); if (mine) continue; rest.fromBufferAttribute(P, i).applyMatrix4(sm.matrixWorld); stray = Math.max(stray, pos(sm, i).distanceTo(rest)); } }
  assert.ok(stray < 1e-4, `a vertex not on the shin moved ${stray}`);
  M.dispose();
});

function fight(build, id = 'tripod@incal') {
  clearTargets(); TRIAL_BUILDERS.tripod = build; nextRigSeed(31);
  const player = { pos: new THREE.Vector3(0, 0, 8), heading: Math.PI };
  const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player, physics: { groundAt: () => 0 }, game: new GameState(null), rng: seeded() });
  const f = foes.add(id, new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  return { foes, f, player, done() { foes.dispose(); delete TRIAL_BUILDERS.tripod; clearTargets(); } };
}

test('it stands as tall as the old tripod, its lens as high; it aims its beam, lifts a leg to stamp and goes down', () => {
  const tops = {};
  for (const [v, build] of Object.entries(BUILD)) {
    // (built, at rest: its lens's height)
    const R = build(skinOf('tripod', 'incal')); R.group.updateMatrixWorld(true); tops[v] = R.tell('beam').getWorldPosition(new THREE.Vector3()).y; R.dispose();
    const { foes, f, done } = fight(build);
    for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
    // the beam: its light on him, narrowing, the spot where it meets him
    f.atk = f.def.attacks.find((a) => a.id === 'beam'); f.state = 'wind'; f.dist = 8;
    for (let i = 0; i <= 30; i++) { f.k = i / 30; foes.look(f, 1 / 30); }
    assert.ok(f.model.lamp.on, `${v}: its light is on`);
    assert.ok(f.model.lamp.at.z > 3, `${v}: its spot is toward him (${f.model.lamp.at.z.toFixed(2)})`);
    // the stamp: its tell's foot lifted
    const foot = f.model.tell('stamp'), y0 = foot.getWorldPosition(new THREE.Vector3()).y;
    f.atk = f.def.attacks.find((a) => a.id === 'stamp'); f.state = 'wind';
    for (let i = 0; i <= 30; i++) { f.k = i / 30; foes.look(f, 1 / 30); }
    assert.ok(foot.getWorldPosition(new THREE.Vector3()).y > y0 + 0.3, `${v}: a leg lifts to stamp`);
    f.atk = null; f.state = 'idle'; f.k = 0;
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 40; i++) foes.update(1 / 30);
    assert.ok(f.dying || !f.alive, `${v}: down`);
    done();
  }
  assert.ok(tops.tripo > 2.3 && Math.abs(tops.tripo - tops.legacy) < 0.6, `its lens ${tops.tripo.toFixed(2)} m, the old lamp's ${tops.legacy.toFixed(2)} m`);
});

test('its lamp head looks at the traveller as it hunts: the head turns his way on its neck (#800, the author\'s)', () => {
  const at = {};
  for (const side of [1, -1]) {
    const { foes, f, player, done } = fight(BUILD.tripo);
    player.pos.set(side * 6, 0, 4);
    for (let i = 0; i < 90; i++) { f.dist = player.pos.distanceTo(f.pos); f.state = 'chase'; foes.look(f, 1 / 60); }
    f.model.group.updateMatrixWorld(true);
    const lens = f.model.tell('beam').getWorldPosition(new THREE.Vector3()), neck = f.model.head.getWorldPosition(new THREE.Vector3());
    at[side] = Math.atan2(lens.x - neck.x, lens.z - neck.z);
    done();
  }
  assert.ok(at[1] > 0.3 && at[-1] < -0.3, `the lens turns his way (${at[1].toFixed(2)}, ${at[-1].toFixed(2)})`);
});
