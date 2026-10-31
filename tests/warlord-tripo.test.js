// The warlord on its Tripo body (issue #800, family H): the resonator chief, the rebuild's approved image, on Tripo's
// biped rig posed directly by the clips (src/enemies/plans/warlord-tripo.js on public/enemies/warlord/, loaded by
// src/enemies/foe-assets.js; the legacy crimson lion, monster.js legacyWarlordModel, stands in while it loads). It keeps
// the warlord's id, skin, def (hp 12; sweep, overhead, charge, the roar that wakes its band, the last stand's whirl),
// windows, holds, its four bronze plates, ragdoll and sounds; what it wields is the approved picture's forked iron staff.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Foes, FOES, WAVES } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { ARMOUR } from '../src/enemies/fight.js';
import { TRIAL_BUILDERS, archetypeModel } from '../src/enemies/plans/index.js';
import { legacyWarlordModel } from '../src/enemies/plans/monster.js';
import { tripoWarlordModel, STAFF } from '../src/enemies/plans/warlord-tripo.js';
import { foeSource, FOE_ASSETS } from '../src/enemies/foe-assets.js';
import { libraryFrom } from '../src/animator.js';
import { attachMotion } from '../src/motion-match.js';
import { setFoeClips, HOLD_AT } from '../src/enemies/humanoid-rig.js';

const SRC = foeSource('warlord');
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const skinnedOf = (M, name) => { let sm = null; M.group.traverse((o) => { if (o.isSkinnedMesh && o.name === name) sm = o; }); return sm; };
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
function arena(player = new THREE.Vector3(6, 0, 4)) {
  clearTargets();
  return new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: player, heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: seeded(13) });
}

test('the game builds the warlord on its Tripo body (#800), the legacy lion kept as its stand-in; its def and band as they were', () => {
  assert.equal(TRIAL_BUILDERS.warlord, undefined);
  assert.deepEqual(FOE_ASSETS.warlord, { folder: 'enemies/warlord/', rig: 'skeleton.json' });
  const M = archetypeModel('warlord', 'desert');
  assert.match(M.group.name, /Tripo/); assert.equal(M.archetype, 'warlord'); assert.equal(M.body3d, 'tripo');
  let maps = 0; M.group.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.uniforms?.uMap?.value || m.map) maps++; });
  assert.equal(maps, 0, 'no texture: its vertex colours');
  M.dispose();
  const L = legacyWarlordModel(skinOf('warlord', 'desert'));
  assert.ok(L.driver && L.plates.length === 4 && !L.tripo, 'the legacy lion builds, on the same rig, with its plates');
  L.dispose();
  assert.equal(FOES.warlord.hp, 12);
  assert.deepEqual(FOES.warlord.attacks.map((a) => a.id), ['sweep', 'overhead', 'charge', 'roar', 'whirl']);
  assert.ok(WAVES.some((w) => w[0] === 'warlord' && w.filter((k) => k === 'grunt').length === 2), 'its band of grunts in the Arena\'s run');
});

test('every skin and tier builds, keeps the model contract, its four plates and the rig, in at most 9 meshes', () => {
  for (const id of Object.keys(SKINS.warlord)) for (const tier of [0, 1]) {
    const M = tripoWarlordModel(skinOf('warlord', id, tier), SRC);
    for (const k of ['group', 'body', 'parts', 'plates', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'driver', 'joints', 'wield', 'gaze']) assert.ok(M[k] !== undefined, `${id}~${tier}: ${k}`);
    for (const a of ARCHETYPES.warlord.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `a tell for ${a.id}`);
    assert.equal(M.plates.length, ARMOUR.warlord.plates, 'its four plates');
    assert.deepEqual(M.plates.map((p) => p.parent.name), ['shoulder r', 'shoulder l', 'knee', 'knee'], 'the shoulders, then the shins');
    assert.equal(drawn(M.group), 7, `${id}~${tier}: the body, the staff, the eyes, four plates`);
    M.dispose();
  }
});

test('the Tripo skin: 10–15k triangles, the hips at its origin, normalised weights, a knee bent moves only its leg', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  assert.equal(SRC.rig.joints.length, 23, 'Tripo\'s biped rig');
  const hips = SRC.rig.joints.find((j) => j.name === 'Hips').at;
  assert.ok(Math.hypot(hips[0], hips[2]) < 0.005, `the hips over its origin (${hips})`);
  const M = tripoWarlordModel(skinOf('warlord', 'desert'), SRC), sm = skinnedOf(M, 'tripo body');
  assert.ok(sm.skeleton.bones.includes(M.gaze[0].node), 'the head bone is the look');
  const W = sm.geometry.attributes.skinWeight, P = sm.geometry.attributes.position, used = new Set(sm.geometry.index.array);
  for (const i of used) { const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i}: weights ${s}`); }
  M.group.updateMatrixWorld(true); sm.skeleton.update();
  const v = new THREE.Vector3(), skinned = (i) => sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld).clone();
  const before = [...used].map((i) => skinned(i));
  M.joints.knees[0].rotateX(-0.8); M.group.updateMatrixWorld(true); sm.skeleton.update();
  let moved = 0; const wrong = [];
  [...used].forEach((i, k) => { const d = skinned(i).distanceTo(before[k]); if (d > 1e-3) { moved++; if ((before[k].x > 0.05 && d > 0.005) || before[k].y > 0.8) wrong.push([...before[k].toArray().map((x) => +x.toFixed(3)), +d.toFixed(4)]); } });
  assert.ok(moved > 100, `the knee moved ${moved} vertices`);
  assert.deepEqual(wrong, [], 'nothing on the left or above the hips moved');
  M.dispose();
});

const hexOf = (c, v) => '#' + [c.getX(v), c.getY(v), c.getZ(v)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
test('painted flat by part: the brick egg, the cream throat chamber and hands, the salmon belly on its oval, the plum shoes; the painted eyes out', () => {
  const pal = SRC.rig.palette, col = SRC.geometry.attributes.color, P = SRC.geometry.attributes.position, used = new Set(SRC.geometry.index.array);
  const seen = new Map(); for (const v of used) { const h = hexOf(col, v); seen.set(h, (seen.get(h) ?? 0) + 1); }
  assert.deepEqual([...seen.keys()].filter((h) => !Object.values(pal).includes(h)), [], 'COLOR_0 holds only the palette');
  for (const k of ['body', 'belly', 'cream', 'shoe']) assert.ok((seen.get(pal[k]) ?? 0) > 150, `${k}: ${seen.get(pal[k]) ?? 0}`);
  // (the belly on the egg's front below the chamber; the shoes at the ground)
  let belly = 0, bellyOff = 0, shoe = 0, shoeOff = 0;
  for (const v of used) { const h = hexOf(col, v); if (h === pal.belly) { if (P.getZ(v) > 0.1 && P.getY(v) > 0.6 && P.getY(v) < 1.4) belly++; else bellyOff++; } if (h === pal.shoe) { if (P.getY(v) < 0.3) shoe++; else shoeOff++; } }
  assert.ok(belly > 150 && bellyOff === 0, `the belly on its front (${belly}, ${bellyOff} elsewhere)`);
  assert.ok(shoe > 150 && shoeOff === 0, `the shoes at its feet (${shoe}, ${shoeOff} elsewhere)`);
  assert.equal(SRC.rig.eyes.filter(Boolean).length, 2, 'two painted eyes measured');
});

const parse = async (n) => { const b = await readFile(new URL(`../public/anim/${n}`, import.meta.url)); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
test('with the clips: its head looks at the traveller on either side, its staff through its right hand, levelled for the charge, its plates on its shoulders and shins, it ragdolls', async () => {
  const [u, m, g] = await Promise.all([parse('ual.glb'), parse('moves.glb'), parse('gestures.glb')]);
  const lib = libraryFrom(u); attachMotion(lib, m); attachMotion(lib, g);
  setFoeClips(lib);
  for (const side of [1, -1]) {
    const foes = arena(new THREE.Vector3(7 * side, 0, 5));
    const f = foes.add('warlord@desert', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
    for (let i = 0; i < 60; i++) { f.dist = 8; foes.look(f, 1 / 30); }
    const M = f.model, body = skinnedOf(M, 'tripo body');
    const top = body.boundingBox.clone().applyMatrix4(body.matrixWorld).max.y;
    assert.ok(top > 2.3 && top < 2.7, `its top at ${top.toFixed(2)} m`);
    const look = M.gaze[0].node, fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(look.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(fwd.x * side > 0.25, `the head turns to the traveller (${fwd.x.toFixed(2)})`);
    assert.ok((M.gaze[1].node.position.x - M.gaze[1].rest.x) * side > 0.002, 'its eyes slide the rest of the way');
    // the staff in its right hand: its grip at the hand's centre, the shaft standing up beside it
    const hand = M.joints.hands[0].getWorldPosition(new THREE.Vector3()), grip = M.tell('sweep').getWorldPosition(new THREE.Vector3());
    assert.ok(hand.distanceTo(grip) < 0.35, `the grip in the hand (${hand.distanceTo(grip).toFixed(2)} m)`);
    // the plates where they are worn: the pauldrons over the shoulders, the greaves on the shins
    for (const [k, p] of M.plates.entries()) {
      const at = p.getWorldPosition(new THREE.Vector3()), joint = (k < 2 ? M.joints.arms[k] : M.joints.knees[k - 2]).getWorldPosition(new THREE.Vector3());
      assert.ok(at.distanceTo(joint) < 0.05, `${p.name} on its joint`);
    }
    if (side > 0) {
      const wind = (id) => { for (let i = 0; i < 20; i++) { f.state = 'wind'; f.atk = f.def.attacks.find((a) => a.id === id); f.k = HOLD_AT; f.dist = 3; foes.look(f, 1 / 30); } };
      wind('charge');
      const up = new THREE.Vector3(0, 1, 0).transformDirection(M.tell('charge').matrixWorld);
      assert.ok(up.z > 0.6, `the charge: its staff levelled at you (${up.z.toFixed(2)})`);
      wind('roar');
      assert.ok(Math.abs(M.joints.hands[0].getWorldPosition(new THREE.Vector3()).x - M.joints.hands[1].getWorldPosition(new THREE.Vector3()).x) > 1.4, 'the roar: its arms flung wide');
      f.state = 'idle'; f.atk = null;
    }
    f.hp = 0.1; f.state = 'recover'; f.timer = 0.5; f.atk = null;
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 9, combo: 2 }, f.chest.clone());
    for (let i = 0; i < 20; i++) foes.update(1 / 30);
    assert.ok(f.dying?.rag, 'it ragdolls (#750/#794)');
    foes.dispose();
  }
  assert.ok(STAFF.L > 2, 'its staff as long as the glaive was');
  clearTargets();
});
