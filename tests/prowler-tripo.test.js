// The prowler on its Tripo body (issue #800, family H): the pod stalker, the rebuild's approved image, on Tripo's biped
// rig posed directly by the clips (src/enemies/plans/prowler-tripo.js on public/enemies/prowler/, loaded by
// src/enemies/foe-assets.js; the legacy lizard, monster.js legacyProwlerModel, stands in while it loads). It keeps the
// prowler's id, skin, def, moves, holds, blade, tail, ragdoll and sounds; its own: four flat colours with clean cut
// borders, the hips at its origin, a tail of five joints added after Tripo's 23, the look on Tripo's head bone with its
// dot eyes sliding, its broad pads flat on the ground while planted.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { SKINS, skinOf } from '../src/enemies/skins.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { TRIAL_BUILDERS, archetypeModel } from '../src/enemies/plans/index.js';
import { legacyProwlerModel, PROWLER_HOLD } from '../src/enemies/plans/monster.js';
import { tripoProwlerModel } from '../src/enemies/plans/prowler-tripo.js';
import { foeSource, FOE_ASSETS } from '../src/enemies/foe-assets.js';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { libraryFrom } from '../src/animator.js';
import { attachMotion } from '../src/motion-match.js';
import { setFoeClips } from '../src/enemies/humanoid-rig.js';

const SRC = foeSource('prowler');
const drawn = (g) => { let n = 0; g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
const skinnedOf = (M, name) => { let sm = null; M.group.traverse((o) => { if (o.isSkinnedMesh && o.name === name) sm = o; }); return sm; };
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
function arena(player = new THREE.Vector3(6, 0, 4)) {
  clearTargets();
  return new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: player, heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: seeded(11) });
}

test('the game builds the prowler on its Tripo body (#800), the legacy lizard kept as its stand-in', () => {
  assert.equal(TRIAL_BUILDERS.prowler, undefined);
  assert.deepEqual(FOE_ASSETS.prowler, { folder: 'enemies/prowler/', rig: 'skeleton.json' });
  const M = archetypeModel('prowler', 'desert');
  assert.match(M.group.name, /Tripo/); assert.equal(M.archetype, 'prowler'); assert.equal(M.body3d, 'tripo');
  let maps = 0; M.group.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.uniforms?.uMap?.value || m.map) maps++; });
  assert.equal(maps, 0, 'no texture: its vertex colours');
  M.dispose();
  const L = legacyProwlerModel(skinOf('prowler', 'desert'));
  assert.ok(L.driver && L.tail && !L.tripo, 'the legacy lizard builds, on the same rig, with its tail');
  L.dispose();
});

test('every skin and tier builds, keeps the model contract and the rig, in 3 meshes (the body, the blade and mouth, the eyes)', () => {
  for (const id of Object.keys(SKINS.prowler)) for (const tier of [0, 1]) {
    const M = tripoProwlerModel(skinOf('prowler', id, tier), SRC);
    for (const k of ['group', 'body', 'parts', 'eyeMat', 'size', 'tones', 'tell', 'anim', 'dispose', 'driver', 'joints', 'wield', 'gaze', 'tail']) assert.ok(M[k] !== undefined, `${id}~${tier}: ${k}`);
    for (const a of ARCHETYPES.prowler.def.attacks) assert.ok(M.tell(a.id)?.isObject3D, `a tell for ${a.id}`);
    assert.equal(drawn(M.group), 3, `${id}~${tier}: three meshes`);
    M.dispose();
  }
});

test('the Tripo skin: 10–15k triangles, the hips at its origin, normalised weights, a knee bent moves only its leg, the tail on its own bones', () => {
  const tris = SRC.geometry.index.count / 3;
  assert.ok(tris >= 10000 && tris <= 15000, `${tris} triangles`);
  const names = SRC.rig.joints.map((j) => j.name);
  assert.equal(names.length, 28, 'Tripo\'s 23 and five of its tail');
  const hips = SRC.rig.joints.find((j) => j.name === 'Hips').at;
  assert.ok(Math.hypot(hips[0], hips[2]) < 0.005, `the hips over its origin (${hips})`);
  const M = tripoProwlerModel(skinOf('prowler', 'desert'), SRC), sm = skinnedOf(M, 'tripo body');
  assert.ok(sm.skeleton.bones.includes(M.gaze[0].node), 'the head bone is the look');
  for (const s of M.tail.segs) assert.ok(sm.skeleton.bones.includes(s), `${s.name}: a bone of the skin`);
  const W = sm.geometry.attributes.skinWeight, I = sm.geometry.attributes.skinIndex, P = sm.geometry.attributes.position, used = new Set(sm.geometry.index.array);
  for (const i of used) { const s = W.getX(i) + W.getY(i) + W.getZ(i) + W.getW(i); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i}: weights ${s}`); }
  // every vertex well behind the rump on the tail's bones, none left on the hips (they stretched off it as it lay)
  const tailBones = new Set(M.tail.segs.map((s) => sm.skeleton.bones.indexOf(s)));
  let behind = 0, onTail = 0;
  for (const i of used) if (P.getZ(i) < -0.6) { behind++; let b = 0; for (let k = 1; k < 4; k++) if (W.getComponent(i, k) > W.getComponent(i, b)) b = k; if (tailBones.has(I.getComponent(i, b))) onTail++; }
  assert.ok(behind > 300 && onTail === behind, `${onTail} of the ${behind} vertices behind its rump on the tail`);
  M.group.updateMatrixWorld(true); sm.skeleton.update();
  const v = new THREE.Vector3(), skinned = (i) => sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld).clone();
  const before = [...used].map((i) => skinned(i));
  M.joints.knees[0].rotateX(-0.8); M.group.updateMatrixWorld(true); sm.skeleton.update();
  let moved = 0; const wrong = [];
  [...used].forEach((i, k) => { const d = skinned(i).distanceTo(before[k]); if (d > 1e-3) { moved++; if ((before[k].x > 0.03 && d > 0.005) || before[k].y > 0.75) wrong.push([...before[k].toArray().map((x) => +x.toFixed(3)), +d.toFixed(4)]); } });
  assert.ok(moved > 100, `the knee moved ${moved} vertices`);
  assert.deepEqual(wrong, [], 'nothing on the left or above the hips moved');
  // a tail joint bent alone moves only the tail behind it
  M.joints.knees[0].rotateX(0.8); M.group.updateMatrixWorld(true); sm.skeleton.update();
  const rest = [...used].map((i) => skinned(i));
  M.tail.segs[2].rotateY(0.6); M.group.updateMatrixWorld(true); sm.skeleton.update();
  let far = 0; [...used].forEach((i, k) => { if (skinned(i).distanceTo(rest[k]) > 1e-3 && rest[k].z > M.tail.segs[2].getWorldPosition(new THREE.Vector3()).z + M.tail.len * 0.5) far++; });
  assert.equal(far, 0, 'the tail\'s middle joint moved nothing ahead of it');
  M.dispose();
});

const hexOf = (c, v) => '#' + [c.getX(v), c.getY(v), c.getZ(v)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
test('painted flat by part: the reference\'s mauve skin, cream muzzle and sage belly; the painted eyes and mouth out, its own parts', () => {
  const pal = SRC.rig.palette, col = SRC.geometry.attributes.color, used = new Set(SRC.geometry.index.array);
  const seen = new Map(); for (const v of used) { const h = hexOf(col, v); seen.set(h, (seen.get(h) ?? 0) + 1); }
  assert.deepEqual([...seen.keys()].filter((h) => !Object.values(pal).includes(h)), [], 'COLOR_0 holds only the palette');
  for (const k of ['skin', 'muzzle', 'belly']) assert.ok((seen.get(pal[k]) ?? 0) > 200, `${k}: ${seen.get(pal[k]) ?? 0}`);
  assert.ok(!seen.has(pal.ink), 'no ink left on the body: the eyes and the mouth are their own parts');
  assert.ok(seen.get(pal.skin) > seen.get(pal.belly) && seen.get(pal.belly) > seen.get(pal.muzzle), 'the skin the most, then the belly, then the muzzle');
  assert.equal(SRC.rig.eyes.filter(Boolean).length, 2, 'two painted eyes measured');
  assert.ok(SRC.rig.marks.mouth.length > 15, 'the mouth line measured across the muzzle');
});

test('in the fight: the traveller\'s height and more, its head looks at him on either side, its tail on the ground, it ragdolls', () => {
  for (const side of [1, -1]) {
    const foes = arena(new THREE.Vector3(6 * side, 0, 4));
    const f = foes.add('prowler@desert', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
    for (let i = 0; i < 45; i++) { f.dist = 7; foes.look(f, 1 / 30); }
    const M = f.model, body = skinnedOf(M, 'tripo body');
    const top = body.boundingBox.clone().applyMatrix4(body.matrixWorld).max.y;
    assert.ok(top > 1.75 && top < 2.1, `its crown at ${top.toFixed(2)} m`);
    const look = M.gaze[0].node, fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(look.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(fwd.x * side > 0.25, `the head turns to the traveller (${fwd.x.toFixed(2)})`);
    const eyes = M.gaze[1].node;
    assert.ok((eyes.position.x - M.gaze[1].rest.x) * side > 0.002, 'its eyes slide the rest of the way');
    const tip = new THREE.Vector3(0, 0, -M.tail.len).applyMatrix4(M.tail.segs.at(-1).matrixWorld);
    assert.ok(tip.y > 0 && tip.y < 0.3 && tip.z < -0.9, `its tail's tip behind it on the ground (${tip.toArray().map((x) => x.toFixed(2))})`);
    foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 99, source: 'charge', breaks: true });
    for (let i = 0; i < 20; i++) foes.update(1 / 30);
    assert.ok(f.dying?.rag, 'it ragdolls (#750/#794)');
    foes.dispose();
  }
  clearTargets();
});

test('the blade stays through its right hand\'s centre through every clip: idle, walk, run, each attack, hurt', () => {
  const foes = arena();
  const f = foes.add('prowler@desert', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
  const M = f.model, sm = skinnedOf(M, 'tripo body'), hand = sm.skeleton.bones.indexOf(M.joints.hands[0]);
  const P = sm.geometry.attributes.position, SI = sm.geometry.attributes.skinIndex, SW = sm.geometry.attributes.skinWeight, mitt = [];
  for (let i = 0; i < P.count; i++) { let b = 0; for (let k = 1; k < 4; k++) if (SW.getComponent(i, k) > SW.getComponent(i, b)) b = k; if (SI.getComponent(i, b) === hand && SW.getComponent(i, b) > 0.5) mitt.push(i); }
  const v = new THREE.Vector3(), worst = { off: 0, at: '' }, grip = M.tell('slash');
  const check = (what) => {
    M.group.updateMatrixWorld(true); sm.skeleton.update();
    const pts = mitt.map((i) => sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld).clone());
    const c = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(pts.length);
    const o = grip.getWorldPosition(new THREE.Vector3()), ax = new THREE.Vector3(0, 1, 0).applyQuaternion(grip.getWorldQuaternion(new THREE.Quaternion()));
    const d = c.clone().sub(o), off = d.sub(ax.clone().multiplyScalar(d.dot(ax))).length();
    const r = pts.map((p) => p.distanceTo(c)).sort((a, b) => a - b)[pts.length >> 1];
    if (off / r > worst.off) { worst.off = off / r; worst.at = `${what}: ${off.toFixed(3)} m off the centre, the hand ${r.toFixed(3)} m`; }
  };
  const run = (secs, set, what) => { for (let t = 0; t < secs; t += 1 / 30) { set(t); foes.look(f, 1 / 30); if (Math.round(t * 30) % 3 === 0) check(`${what} ${t.toFixed(2)} s`); } };
  run(1.5, () => { f.state = 'idle'; f.atk = null; f.dist = 7; }, 'idle');
  for (const pace of [1, 3]) run(1.5, () => { f.state = 'chase'; f.atk = null; f.dist = 7; f.pos.z += pace / 30; }, pace > 2 ? 'run' : 'walk');
  for (const a of FOES.prowler.attacks) {
    const cyc = a.wind + (a.strike ?? 0.3) + 0.5;
    run(cyc, (t) => { f.atk = a; f.dist = 2; f.state = t < a.wind ? 'wind' : t < a.wind + (a.strike ?? 0.3) ? 'strike' : 'recover'; f.k = f.state === 'wind' ? t / a.wind : f.state === 'strike' ? (t - a.wind) / (a.strike ?? 0.3) : 0; }, a.id);
    f.atk = null; f.state = 'idle';
  }
  foes.hurt(f, 'blade', new THREE.Vector3(-1, 0, 0), { damage: 0.1, source: 'combo', combo: 0 });
  run(0.6, () => {}, 'hurt');
  assert.ok(worst.off < 0.35, `worst ${worst.at} (the haft through the middle: under 0.35 of its radius)`);
  assert.ok(PROWLER_HOLD.blade, 'the legacy hold, kept');
  foes.dispose(); clearTargets();
});

const parse = async (n) => { const b = await readFile(new URL(`../public/anim/${n}`, import.meta.url)); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
test('with the clips, its broad pads stand on the ground, not in it, while it stands (humanoid-rig.js ballOnGround, flatFeet)', async () => {
  const [u, m, g] = await Promise.all([parse('ual.glb'), parse('moves.glb'), parse('gestures.glb')]);
  const lib = libraryFrom(u); attachMotion(lib, m); attachMotion(lib, g);
  setFoeClips(lib);
  const foes = arena();
  const f = foes.add('prowler@desert', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true; f.state = 'idle';
  for (let i = 0; i < 60; i++) { f.dist = 7; foes.look(f, 1 / 60); }
  const M = f.model, sm = skinnedOf(M, 'tripo body'), P = sm.geometry.attributes.position, v = new THREE.Vector3();
  M.group.updateMatrixWorld(true); sm.skeleton.update();
  let lo = Infinity, who = null; for (const i of new Set(sm.geometry.index.array)) { const y = sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld).y; if (y < lo) { lo = y; who = sm.skeleton.bones[sm.geometry.attributes.skinIndex.getX(i)].name; } }
  assert.ok(lo > -0.02, `its lowest point ${(lo * 100).toFixed(1)} cm on ${who} (the clip's narrow foot, tipped, put a pad's edge 5.6 cm in)`);
  foes.dispose(); clearTargets();
});
