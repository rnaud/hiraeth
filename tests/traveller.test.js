import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Humanoid, prepareHuman } from '../src/humanoid.js';
import { buildCharacter, Player } from '../src/player.js';
import { Physics } from '../src/physics.js';
import { Gear } from '../src/gear.js';
import { MODE_OUTFIT, MODE_EYE } from '../src/materials.js';
import { TRAVELLER_PALETTE } from '../src/traveller-style.js';
import { TRAVELLER_IRIS } from '../src/eyes.js';
import { TRAVELLER, travellerHair as TRAVELLER_HAIR } from '../src/traveller.js';
import { skullPoint as SKULL_POINT } from '../src/costumes.js';

// The traveller is a normal 3D character: the people's own body, skeleton and face (Quaternius'
// human, as every NPC), in its natural proportions, with the suit painted on a baggy copy of the
// body and the gear of traveller.glb worn on top, each piece skinned to one of its bones (traveller.js).
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
async function glb(name) {
  const bytes = await readFile(new URL(`../public/anim/${name}`, import.meta.url));
  const length = bytes.readUInt32LE(12);
  const asset = JSON.parse(bytes.subarray(20, 20 + length));
  const json = structuredClone(asset);
  json.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + length).toString('base64')}`;
  return { asset, scene: (await new GLTFLoader().parseAsync(JSON.stringify(json), '')).scene };
}
const { asset, scene: template } = await glb('traveller.glb');
const human = prepareHuman((await glb('human_m.glb')).scene, 'm');
const traveller = (char = buildCharacter()) => new Humanoid(human, char, 'm', { outfit: template });
const npc = (char = buildCharacter()) => new Humanoid(human, char, 'm');
const V = () => new THREE.Vector3();
const at = (b) => b.getWorldPosition(V());
/** World-space box of the pieces of the outfit named by `re` (each mesh holds several, see userData.pieces). */
function boxOf(h, re) {
  const out = new THREE.Box3();
  for (const m of h.outfitMeshes) {
    m.skeleton.update();
    for (const [name, [first, count]] of Object.entries(m.userData.ranges)) {
      if (!re.test(name)) continue;
      for (let i = first; i < first + count; i++) out.expandByPoint(m.localToWorld(m.getVertexPosition(i, V())));
    }
  }
  return out;
}
const piece = (h, name) => h.outfitMeshes.find((m) => m.userData.pieces.includes(name));

test('the gear asset is image-free and its rigid pieces follow one bone each', () => {
  assert.equal(asset.images, undefined);
  assert.equal(asset.textures, undefined);
  assert.ok(asset.materials.every((m) => !m.pbrMetallicRoughness?.baseColorTexture));
  for (const name of ['Bubble_helmet', 'Headphone_1', 'Headphone_-1', 'Blue_headphone_band', 'Scarf_fold', 'Equipment_blue_metal', 'Equipment_tan_pouches', 'Equipment_rubber_soles']) {
    const m = template.getObjectByName(name);
    assert.ok(m?.isSkinnedMesh, name);
    const W = m.geometry.attributes.skinWeight;
    for (let i = 0; i < W.count; i++) assert.ok(Math.max(W.getX(i), W.getY(i), W.getZ(i), W.getW(i)) > 0.99, `${name} is rigid`);
  }
});

test('the traveller is the NPC body: the same skeleton, bind pose, weights and face, drawn', () => {
  const h = traveller(), n = npc();
  const names = (x) => { const out = []; x.model.traverse((o) => { if (o.isBone) out.push(o.name); }); return out; };
  assert.deepEqual(names(h), names(n));
  assert.equal(names(h).length, 65);
  // the body is visible, skinned exactly like an NPC's, only its vertices stand off for the baggy suit
  assert.ok(h.body.visible);
  // his own face (TRAVELLER.face) is the NPC's head warped (morph.js warpFace): younger, fuller; without it, the NPC's own
  const own = h.body.geometry;
  assert.deepEqual(h.ownFace, TRAVELLER.face);
  h.setFace(null);
  const A = h.body.geometry, B = n.body.geometry;
  {
    const head = h.body.skeleton.bones.findIndex((b) => b.name === 'Head');
    let warped = 0, most = 0;
    for (let i = 0; i < A.attributes.position.count; i++) {
      if (!(A.attributes.skinIndex.getX(i) === head && A.attributes.skinWeight.getX(i) > 0.99)) continue;
      const d = new THREE.Vector3().fromBufferAttribute(own.attributes.position, i).distanceTo(new THREE.Vector3().fromBufferAttribute(A.attributes.position, i));
      if (d > 0.001) warped++;
      most = Math.max(most, d);
    }
    assert.ok(warped > 100 && most < 0.02, `his own face: ${warped} head vertices moved, at most ${most.toFixed(4)} m`);
  }
  assert.equal(A.attributes.position.count, B.attributes.position.count);
  const same = (k) => { const a = A.attributes[k], b = B.attributes[k]; for (let i = 0; i < a.count; i++) for (let c = 0; c < 4; c++) if (a.getComponent(i, c) !== b.getComponent(i, c)) return false; return true; };
  assert.ok(same('skinIndex') && same('skinWeight'), 'the NPC\'s own weights');
  h.body.skeleton.boneInverses.forEach((m, i) => assert.ok(m.equals(n.body.skeleton.boneInverses[i]), 'the same bind pose'));
  const maxSwell = Math.max(...Object.values(TRAVELLER.swell));
  const head = h.body.skeleton.bones.findIndex((b) => b.name === 'Head');
  let moved = 0;
  for (let i = 0; i < A.attributes.position.count; i++) {
    const d = new THREE.Vector3().fromBufferAttribute(A.attributes.position, i).distanceTo(new THREE.Vector3().fromBufferAttribute(B.attributes.position, i));
    assert.ok(d <= maxSwell + 1e-6, 'nothing is stretched, only padded');
    if (d > 0.01) moved++;
    if (A.attributes.skinIndex.getX(i) === head && A.attributes.skinWeight.getX(i) > 0.99) assert.ok(d < 1e-6, 'the face is the NPC face');
  }
  assert.ok(moved > A.attributes.position.count * 0.25, `the suit stands off the trunk and limbs (${moved} / ${A.attributes.position.count})`);
  // the rest pose is the people's own (T-pose arms, the body's own joints)
  for (const b of Object.keys(h.b)) assert.ok(h.rest.get(h.b[b]).p.distanceTo(n.rest.get(n.b[b]).p) < 1e-6, `${b} rests where an NPC's does`);
  // the eyes: the people's eyeballs with the traveller's slate-blue iris; they glance and blink
  assert.equal(h.eyeMesh.material.uniforms.uMode.value, MODE_EYE);
  assert.equal('#' + h.eyeMesh.material.uniforms.uColor2.value.getHexString(), TRAVELLER_IRIS);
  h.update(); h.updateEyes(1 / 60, new THREE.Vector3(2, 1.7, 2));
  assert.ok(h.eyeMesh.material.uniforms.uEyeLook.value.toArray().every(Number.isFinite));
  // and at rest a little smile; his face's drawing: hardly a line, a few freckles
  h.setFace(h.ownFace);
  assert.ok(h.expression.smile > 0.1 && h.body.material.uniforms.uMood.value.x > 0.1);
  assert.ok(h.body.material.uniforms.uFaceKit.value.x < 0.5 && h.body.material.uniforms.uFaceKit.value.z > 0);
});

test('cream clothes and bare forearms/ankles retain folds at the human\'s joints', () => {
  const h = traveller(), u = h.body.material.uniforms;
  assert.equal(u.uMode.value, MODE_OUTFIT);
  assert.equal('#' + u.uColor.value.getHexString(), TRAVELLER_PALETTE.suit);
  assert.equal('#' + u.uColor3.value.getHexString(), TRAVELLER_PALETTE.skin);
  assert.equal(u.uGlove.value.w, 0, 'bare hands; the owned tool supplies the right bracer');
  assert.equal(u.uCreases.value, 1);
  const limbs = u.uLimbs.value, B = h.b;
  // the folds sit on the human's own shoulders, elbows, hips and knees
  assert.ok(limbs[0].distanceTo(h.rest.get(B.upperarm_l).p) < 1e-4, 'left shoulder');
  assert.ok(limbs[2].distanceTo(h.rest.get(B.lowerarm_l).p) < 1e-4 || limbs[1].distanceTo(h.rest.get(B.lowerarm_l).p) < 1e-4, 'left elbow');
  assert.ok(limbs.some((p) => p.distanceTo(h.rest.get(B.calf_l).p) < 1e-4), 'left knee');
});

test('the fit at rest: bare head, rolled sleeves, open jacket, satchel, cropped trousers and grounded boots', () => {
  const h = traveller();
  h.update(true); h.model.updateMatrixWorld(true);
  // the head inside the bubble, centred, the face clear of the glass
  const headBox = new THREE.Box3(), P = h.body.geometry.attributes.position, J = h.body.geometry.attributes.skinIndex, W = h.body.geometry.attributes.skinWeight;
  const head = h.body.skeleton.bones.indexOf(h.b.Head);
  for (let i = 0; i < P.count; i++) if (J.getX(i) === head && W.getX(i) > 0.6) headBox.expandByPoint(h.body.localToWorld(h.body.getVertexPosition(i, V())));
  const hair = boxOf(h, /^Traveller_hair$/);
  assert.ok(hair.max.y > headBox.max.y && hair.max.y < headBox.max.y + 0.1, `loose hair above the crown (${(hair.max.y - headBox.max.y).toFixed(3)} m)`);
  // casual clothes: nothing of the old space suit is worn (helmet, headset, radio pack, suit seams, boot buckles, ringed collar)
  for (const n of ['Bubble_helmet', 'Helmet_liner', 'Headphone_1', 'Backpack_antenna', 'Equipment_ivory_radio', 'Equipment_blue_metal', 'Equipment_cyan_glass',
    'Equipment_seam_ink_l', 'Boot_buckles_l', 'Boot_buckles_r', 'Scarf_fold_0', 'Scarf_cowl', 'Equipment_tan_pouches', 'Equipment_dusty_pink_boots_l', 'Boot_cuff_l']) assert.equal(piece(h, n), undefined, n + ' removed');
  for (const side of ['l', 'r']) {
    const cuff = boxOf(h, new RegExp(`^Rolled_sleeve_${side}$`));
    const elbow = at(h.b[`lowerarm_${side}`]), wrist = at(h.b[`hand_${side}`]);
    assert.ok(cuff.distanceToPoint(elbow) < 0.13 && cuff.distanceToPoint(wrist) > 0.07, 'rolled sleeve leaves the forearm bare');
    const hem = boxOf(h, new RegExp(`^Trouser_cuff_${side}$`)), boot = boxOf(h, new RegExp(`^Boot_${side}$`));
    assert.ok(hem.min.y > boot.max.y + 0.025, 'bare ankle between cropped trouser and boot');
  }
  const jacket = boxOf(h, /^Coral_overshirt$/), bag = boxOf(h, /^Round_satchel$/);
  assert.ok(jacket.min.y < 0.8 && jacket.max.y > 1.4, 'overshirt reaches the thighs');
  assert.ok(bag.max.z > jacket.max.z && bag.getCenter(V()).y < 1.05, 'satchel outside the jacket at the hip');
  // the canvas rucksack on the back: behind the jacket, touching it, centred, between the waist and the shoulders
  const pack = boxOf(h, /^Rucksack$/), back = jacket.min.z;
  assert.ok(pack.max.z <= back + 0.012 && pack.max.z > back - 0.04, `the rucksack against the back (${pack.max.z.toFixed(3)} / ${back.toFixed(3)})`);
  assert.ok(Math.abs(pack.getCenter(V()).x) < 0.03 && pack.min.y > 0.9 && pack.max.y < h.rest.get(h.b.neck_01).p.y);
  assert.ok(pack.max.z - pack.min.z < 0.13, `a slim rucksack (${(pack.max.z - pack.min.z).toFixed(3)} m deep)`);
  // boots round the feet, soles just under the ground; no part of the body below them
  const soles = boxOf(h, /^Boot_sole_/), boots = boxOf(h, /^Boot_[lr]$/);
  assert.ok(soles.min.y > -0.03 && soles.min.y < 0.0, `soles on the ground (${soles.min.y.toFixed(3)})`);
  const feet = new THREE.Box3();
  h.body.skeleton.update();
  for (let i = 0; i < P.count; i++) { const p = h.body.localToWorld(h.body.getVertexPosition(i, V())); if (p.y < 0.12) feet.expandByPoint(p); }
  assert.ok(feet.min.y >= soles.min.y && boots.containsBox(new THREE.Box3(feet.min.clone().setY(boots.min.y + 0.01), feet.max.clone().setY(Math.min(feet.max.y, boots.max.y - 0.01)))), 'the feet inside the boots');
  // nothing torn: every piece finite and on the character
  for (const m of h.outfitMeshes) {
    m.skeleton.update();
    for (let i = 0; i < m.geometry.attributes.position.count; i += 7) {
      const p = m.getVertexPosition(i, V());
      assert.ok(p.toArray().every(Number.isFinite) && p.length() < 2.4, m.name);
    }
  }
});

// The shipped motion library
const motionBytes = await readFile(new URL('../public/anim/ual.glb', import.meta.url));
const motion = await new GLTFLoader().parseAsync(motionBytes.buffer.slice(motionBytes.byteOffset, motionBytes.byteOffset + motionBytes.byteLength), '');
const { Animator } = await import('../src/animator.js');
const clip = (name) => motion.animations.find((c) => c.name === name);
const pose = (a, h, char, name, t) => {
  for (const [k, action] of Object.entries(a.actions)) { action.setEffectiveWeight(k === name ? 1 : 0); action.time = t * a.lib.clips[k].duration; }
  a.mixer.update(0); a.src.updateMatrixWorld(true); a.apply(char.root); h.update(); h.poseHands(a);
};

test('idle: the natural stance of the people, feet flat on the ground', () => {
  const lib = { scene: motion.scene, clips: { idle: clip('Idle_Loop') }, native: {} };
  const ct = buildCharacter(), cn = buildCharacter(), h = traveller(ct), n = npc(cn);
  const at_ = new Animator(lib, ct), an = new Animator(lib, cn);
  const flat = { heightAbove: (p) => p.y, groundNormal: (x, y, z, out) => out.set(0, 1, 0) }, up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(0, 0, 1);
  for (let f = 0; f < 40; f++) {
    for (const [a, x, c] of [[at_, h, ct], [an, n, cn]]) { pose(a, x, c, 'idle', f / 40); x.plantFeet(1 / 30, flat, up, c.root.position, fwd); }
    // exactly the NPC's pose, bone for bone
    for (const k of Object.keys(h.b)) assert.ok(at(h.b[k]).distanceTo(at(n.b[k])) < 1e-5, `${k} stands as an NPC's does`);
  }
  h.model.updateMatrixWorld(true);
  const soles = boxOf(h, /^Boot_sole_/);
  assert.ok(soles.min.y > -0.04 && soles.min.y < 0.02, `soles on the ground in idle (${soles.min.y.toFixed(3)})`);
  assert.ok(boxOf(h, /^Traveller_hair$/).distanceToPoint(at(h.b.Head)) < 0.13, 'hair follows the head');
  assert.ok(at(h.b.pelvis).y > 0.85, 'standing upright');
});

test('rigid pieces stay rigid in any pose: hair, pack and boots', () => {
  const char = buildCharacter(), h = traveller(char);
  const spans = (name) => {
    const m = piece(h, name);
    m.skeleton.update();
    const n = m.geometry.attributes.position.count;
    return [0, 1, 2, 3].map((k) => m.getVertexPosition(Math.floor(k * n / 4), V()).distanceTo(m.getVertexPosition(Math.floor(k * n / 4 + n / 8), V())));
  };
  const names = ['Traveller_hair', 'Rucksack', 'Rucksack_lid'];
  h.update();
  const before = names.map(spans);
  char.head.rotation.set(0.5, 0.8, 0.2); char.arms[0].rotation.set(-1.2, 0.3, 0); char.elbows[0].rotation.x = -1.4; char.torso.rotation.set(0.3, 0.4, 0);
  char.legs[0].rotation.x = 0.9; char.knees[0].rotation.x = -1.2;
  h.update();
  names.map(spans).forEach((after, k) => after.forEach((d, i) => assert.ok(Math.abs(d - before[k][i]) < 1e-4, `${names[k]} keeps its shape`)));
  assert.ok(boxOf(h, /^Traveller_hair$/).distanceToPoint(at(h.b.Head)) < 0.13, 'hair goes with the tilted head');
});

for (const gait of ['walk', 'jog', 'sprint']) test(`${gait}: arms, legs and hands match all 120 phases of the source motion, as on the NPCs`, () => {
  const clips = { walk: clip('Walk_Loop'), jog: clip('Jog_Fwd_Loop'), sprint: clip('Sprint_Loop') };
  const char = buildCharacter(), h = traveller(char);
  const a = new Animator({ scene: motion.scene, clips, native: { walk: 1, jog: 3, sprint: 6 } }, char);
  const rootQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.7, -0.4));
  char.root.quaternion.copy(rootQ);
  const direction = (x, y) => at(y).sub(at(x)).normalize();
  let first;
  for (let frame = 0; frame <= 120; frame++) {
    pose(a, h, char, gait, (frame % 120) / 120);
    const B = h.b;
    for (const s of ['r', 'l']) {
      for (const [parent, child] of [['upperarm', 'lowerarm'], ['lowerarm', 'hand'], ['thigh', 'calf'], ['calf', 'foot']]) {
        const from = `${parent}_${s}`, to = `${child}_${s}`;
        const want = direction(a.bone(from), a.bone(to)).applyQuaternion(rootQ);
        assert.ok(direction(B[from], B[to]).dot(want) > 0.99999, `${gait} ${frame}: ${from} follows its own source limb`);
        assert.ok(Math.abs(at(B[from]).distanceTo(at(B[to])) - h.rest.get(B[from]).p.distanceTo(h.rest.get(B[to]).p)) < 1e-4, 'limb length stays fixed');
      }
      const ours = B[`hand_${s}`].getWorldQuaternion(new THREE.Quaternion()).premultiply(rootQ.clone().invert()).multiply(h.rest.get(B[`hand_${s}`]).q.clone().invert());
      const theirs = a.bone(`hand_${s}`).getWorldQuaternion(new THREE.Quaternion()).multiply(a.restHands[s].clone().invert());
      assert.ok(ours.angleTo(theirs) < 1e-3, `${gait} ${frame}: the wrist follows the source wrist`);
    }
    const q = Object.values(h.b).map((b) => b.quaternion.clone());
    if (!first) first = q;
    if (frame === 120) q.forEach((x, i) => assert.ok(x.angleTo(first[i]) < 0.001, 'no jump at the loop boundary'));
  }
});

test('climbing under rotated gravity: fingers up the wall, toes into it, rolled sleeves follow the forearms', () => {
  for (const angle of [0, Math.PI / 2]) {
    const char = buildCharacter(), h = traveller(char);
    char.root.rotation.z = angle;
    const up = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), angle), wallN = new THREE.Vector3(0, 0, -1);
    h.update();
    const B = h.b;
    h.reach({ hands: ['r', 'l'].map((s) => at(B[`hand_${s}`])), feet: ['r', 'l'].map((s) => at(B[`foot_${s}`])), wallN, up, wallContact: true });
    for (const s of ['r', 'l']) {
      assert.ok(at(B[`ball_${s}`]).sub(at(B[`foot_${s}`])).normalize().dot(wallN) < -0.9, 'toes into the wall');
      assert.ok(at(B[`middle_01_${s}`]).sub(at(B[`hand_${s}`])).normalize().dot(up) > 0.99, 'fingers up the wall');
      assert.ok(boxOf(h, new RegExp(`^Rolled_sleeve_${s}$`)).distanceToPoint(at(B[`lowerarm_${s}`])) < 0.13, 'the sleeve stays at the elbow');
    }
  }
});

test('the gear hooks: the head and chest anchors, the scout on the pack, the bracer round the sleeve, the glass out of shadows', () => {
  const char = buildCharacter(), h = traveller(char);
  const g = new Gear(new THREE.Scene(), h, char);
  h.update(true); h.model.updateMatrixWorld(true); g.update(1 / 60, V(), 0, 0, true);
  assert.equal(g.springs.length, 0);
  assert.deepEqual(g.noShadow, []);
  assert.ok(at(h.headAnchor).distanceTo(boxOf(h, /^Traveller_hair$/).getCenter(V())) < 0.1, 'head anchor remains in the skull');
  // the scout docks on the rucksack's lid; the outer pocket is apart (the flask hides it)
  const pack = boxOf(h, /^Rucksack_lid$/), dock = at(g.scoutDock);
  assert.ok(dock.y > pack.max.y && dock.y < pack.max.y + 0.15 && dock.z > pack.min.z && dock.z < pack.max.z, 'the scout on the lid');
  assert.deepEqual(h.packPocket.flatMap((m) => m.userData.pieces).sort(), ['Rucksack_pocket', 'Rucksack_pocket_flap']);
  // the bracer's frame: +y down the forearm, -x toward the thumb, scaled out round the sleeve
  const f = h.forearm.r;
  assert.equal(f.parent, h.b.lowerarm_r);
  const q = f.getWorldQuaternion(new THREE.Quaternion());
  const along = new THREE.Vector3(0, 1, 0).applyQuaternion(q), thumb = new THREE.Vector3(-1, 0, 0).applyQuaternion(q);
  assert.ok(along.dot(at(h.b.hand_r).sub(at(h.b.lowerarm_r)).normalize()) > 0.999, 'along the forearm');
  assert.ok(thumb.dot(at(h.b.thumb_01_r).sub(at(h.b.hand_r)).normalize()) > 0.5, 'the thumb side');
  assert.ok(f.getWorldScale(V()).x >= 1, 'not smaller than the bracer was made');
  // nothing in the hand: the old handheld device (a screen in the fist, read as a phone) is gone
  assert.equal(g.device, undefined);
});

test('kneeling (a box, getting up): the knee down to the ground, every piece whole and on the body', () => {
  const h = traveller(), n = npc(), o = { up: new THREE.Vector3(0, 1, 0), fwd: new THREE.Vector3(0, 0, 1), ground: 0, look: new THREE.Vector3(0, 0.3, 0.6) };
  for (const x of [h, n]) { x.update(); x.kneel(1, o); x.model.updateMatrixWorld(true); }
  for (const k of Object.keys(h.b)) assert.ok(at(h.b[k]).distanceTo(at(n.b[k])) < 1e-5, `${k} kneels as an NPC's does`);
  assert.ok(at(h.b.pelvis).y < 0.6 && at(h.b.calf_l).y < 0.3, `down on one knee (${at(h.b.calf_l).y.toFixed(3)})`);
  const boots = boxOf(h, /^Boot_r$/);
  assert.ok(boots.min.y > -0.05 && boots.distanceToPoint(at(h.b.foot_r)) < 0.01, 'the right boot on its foot, on the ground');
  assert.ok(boxOf(h, /^Traveller_hair$/).distanceToPoint(at(h.b.Head)) < 0.13, 'hair on the bowed head');
  for (const m of h.outfitMeshes) for (let i = 0; i < m.geometry.attributes.position.count; i += 13) assert.ok(m.getVertexPosition(i, V()).toArray().every(Number.isFinite));
});

test('vehicle animation reaches the skin on the first frame and releases foot locks', () => {
  const p = new Player(new Physics(new THREE.Scene()));
  p.ride = { speed: 0, pos: V(), update() {}, seatTransform(pos, q) { pos.set(0, 2, 0); q.identity(); } };
  p.humanoid = traveller(p.char);
  p.humanoid._feet = { l: { locked: true }, r: { locked: true } };
  p.updateCloth = () => {};
  const before = p.humanoid.b.thigh_r.quaternion.clone();
  p.update(1 / 60, {}, 0);
  assert.ok(before.angleTo(p.humanoid.b.thigh_r.quaternion) > 0.5);
  assert.equal(p.humanoid._feet.r.locked, false);
});

test('every clothing piece has valid normalized weights, including the interleaved body-derived sleeves', () => {
  const h = traveller();
  for (const m of h.outfitMeshes) {
    const { position: P, normal: N, skinIndex: J, skinWeight: W } = m.geometry.attributes;
    for (let i = 0; i < P.count; i++) {
      assert.ok([P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i)].every(Number.isFinite), m.name);
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        const j = J.getComponent(i, k), w = W.getComponent(i, k);
        assert.ok(Number.isInteger(j) && j >= 0 && j < h.body.skeleton.bones.length, 'valid bone index');
        assert.ok(Number.isFinite(w) && w >= 0 && w <= 1, 'valid bone weight'); sum += w;
      }
      assert.ok(Math.abs(sum - 1) < 1e-5, 'normalized skin weights');
    }
  }
});

test('dark scruffy hair leaves the eyes clear; the earned star attaches to the coral lapel', async () => {
  const { TRAVELLER_STAR, createItemEffects } = await import('../src/boxes/effects.js');
  const h = traveller(); h.char.root.updateMatrixWorld(true); h.update(true);
  const hair = piece(h, 'Traveller_hair');
  assert.equal('#' + hair.material.uniforms.uColor.value.getHexString(), TRAVELLER_PALETTE.hair);
  const eyes = h.rest.get(h.b.Head).p.y + 0.1, front = h.rest.get(h.b.Head).p.z + 0.07;
  let fringe = Infinity;
  const [first, count] = hair.userData.ranges.Traveller_hair;
  for (let i = first; i < first + count; i++) { const p = hair.localToWorld(hair.getVertexPosition(i, V())); if (Math.abs(p.x) < 0.03 && p.z > front) fringe = Math.min(fringe, p.y); }
  assert.ok(fringe > eyes + 0.005 && fringe < eyes + 0.08, 'fringe above the eyes');
  const before = new Set(h.chestAnchor.children);
  const effects = createItemEffects({ player: { humanoid: h }, keys: null });
  const star = h.chestAnchor.children.find((o) => !before.has(o) && o.geometry?.type === 'ExtrudeGeometry');
  assert.ok(star, 'star is attached to the chest, not floating over bare hair');
  assert.ok(star.position.equals(TRAVELLER_STAR.at));
  assert.ok(boxOf(h, /^Lapel/).distanceToPoint(star.getWorldPosition(V())) < 0.08, 'star sits on the lapel');
  effects.dispose();
});

// The third round of the author's notes: more casual (no space suit), a backpack as at first with the fluid
// tank slimmer, and closer to the coral-jacket sheets (thinner cheeks, scruffier hair).
test('an ordinary canvas rucksack with the slim fluid flask sunk into its outer face, the three bands in view from behind', async () => {
  const { TANK, TANK_RAIL, tankRadiusAt } = await import('../src/fluid-tool.js');
  const { RUCKSACK } = await import('../src/traveller.js');
  const h = traveller(); h.update(true); h.model.updateMatrixWorld(true);
  const inChest = (re) => {
    const out = new THREE.Box3(), inv = h.chestAnchor.matrixWorld.clone().invert();
    for (const m of h.outfitMeshes) for (const [name, [first, count]] of Object.entries(m.userData.ranges)) {
      if (!re.test(name)) continue;
      for (let i = first; i < first + count; i++) out.expandByPoint(m.localToWorld(m.getVertexPosition(i, V())).applyMatrix4(inv));
    }
    return out;
  };
  const sack = inChest(/^Rucksack$/), coat = inChest(/^Coral_overshirt$/);
  for (const n of ['Rucksack_lid', 'Rucksack_lid_straps', 'Rucksack_buckles', 'Bedroll', 'Rucksack_pocket']) assert.ok(piece(h, n), n);
  assert.equal(piece(h, 'Rucksack').material.uniforms.uColor.value.getHexString(), TRAVELLER_PALETTE.canvas.slice(1), 'canvas, not a radio box');
  // the flask (TANK, chest frame): flat and narrower than the rucksack, half sunk into its outer face
  const R = Math.max(...TANK.profile.map(([r]) => r)) * TANK.scale;
  const halfW = R * TANK.squash, halfD = R * TANK.depth, [, y0, z0] = TANK.at;
  assert.ok(halfD < 0.08 && halfW < 0.12, `a slim flask (${(2 * halfW).toFixed(2)} × ${(2 * halfD).toFixed(2)} m)`);
  assert.ok(halfW < (sack.max.x - sack.min.x) / 2 - 0.02, 'the canvas shows either side of it');
  const outer = RUCKSACK.back - RUCKSACK.depth;
  assert.ok(z0 + halfD > outer + 0.02 && z0 < outer, 'half sunk into the rucksack\'s outer face');
  assert.ok(coat.min.z - (z0 - halfD) < 0.24, `the whole pack stands ${(coat.min.z - (z0 - halfD)).toFixed(3)} m off his back (the old tank: 0.34)`);
  assert.ok(y0 > sack.min.y - 0.05 && y0 + TANK.height * TANK.scale < sack.max.y + 0.03, 'the glass within the rucksack\'s height, its neck out over the lid');
  // from behind, nothing of the rucksack, its lid or the flask's straps hides the glass between its first and its full mark
  for (const y of [0.02, TANK.full / 6, TANK.full / 2, TANK.full * 5 / 6, TANK.full - 0.03]) assert.ok(z0 - tankRadiusAt(y) * TANK.depth * TANK.scale < outer - 0.03, `the glass stands out of the rucksack at ${y.toFixed(2)}`);
  for (const y of [TANK.full / 6, TANK.full / 2, TANK.full * 5 / 6]) for (const s of TANK.straps) assert.ok(Math.abs(s - y) > 0.05, `a leather band over the middle of a charge's band at ${y.toFixed(2)}`);
  assert.ok(TANK.straps.every((s) => s < 0.06 || s > TANK.full - 0.015), 'the leather bands below the fluid and at its brim');
  // the uprights stand at the flask's sides, on the rucksack
  assert.ok(TANK_RAIL.x * TANK.scale < (sack.max.x - sack.min.x) / 2 + 0.01);
});

test('scruffier hair: broken, tousled locks with lighter edges; a leaner face with thinner cheeks', () => {
  // the outline: how far the hair reaches round the skull, sample to sample, is uneven
  const g = TRAVELLER_HAIR(), rel = [], around = [];
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), ray = new THREE.Raycaster();
  for (let el = 20; el <= 70; el += 10) for (let az = 0; az < 360; az += 10) {
    const s = new THREE.Vector3(...SKULL_POINT('m', az, el, 0));
    ray.set(V(), s.clone().normalize());
    const far = Math.max(0, ...ray.intersectObject(mesh).map((x) => x.distance)) / s.length();   // the hair's outermost surface
    rel.push(far);
    if (az >= 60 && az <= 300) around.push(far);
  }
  let bump = 0, n = 0;
  for (let i = 1; i < rel.length; i++) if (i % 36) { bump += Math.abs(rel[i] - rel[i - 1]); n++; }
  assert.ok(bump / n > 0.075, `a broken outline, not a cap of hair (${(bump / n).toFixed(3)}; the tidier mop was 0.060)`);
  assert.ok(Math.min(...around) > 1.05, `hair all over the top, the sides and the back (${Math.min(...around).toFixed(3)} at ${around.indexOf(Math.min(...around))})`);
  // each lock's edges print lighter than its middle (dark hair loses its own ink lines)
  const C = g.attributes.color;
  let lit = 0;
  for (let i = 0; i < C.count; i++) { assert.ok(C.getX(i) >= 1); if (C.getX(i) > 1.3) lit++; }
  assert.ok(lit > 100, `lighter lock edges (${lit} vertices)`);
  const h = traveller();
  assert.ok(piece(h, 'Traveller_hair').material.vertexColors, 'the outfit\'s hair takes them');
  // the face: thinner cheeks, a narrower jaw, a little longer
  const F = TRAVELLER.face;
  assert.ok(F.cheeks < 0 && F.jaw < 1 && F.faceLength >= 1, 'a lean young face');
  const n_ = npc(), width = (x) => {
    // the face's half-width at the cheeks: the head's own vertices a third of the way up from the chin, in front
    const A = x.body.geometry.attributes.position, J = x.body.geometry.attributes.skinIndex, W = x.body.geometry.attributes.skinWeight;
    const head = x.body.skeleton.bones.findIndex((b) => b.name === 'Head'), ids = [], box = new THREE.Box3();
    for (let i = 0; i < A.count; i++) if (J.getX(i) === head && W.getX(i) > 0.99) { ids.push(i); box.expandByPoint(V().fromBufferAttribute(A, i)); }
    const y = box.min.y + (box.max.y - box.min.y) * 0.3, zc = (box.min.z + box.max.z) / 2;
    let w = 0;
    for (const i of ids) if (Math.abs(A.getY(i) - y) < 0.01 && A.getZ(i) > zc) w = Math.max(w, Math.abs(A.getX(i)));
    return w;
  };
  assert.ok(width(h) < width(n_) - 0.005, `cheeks narrower than the people's own face (${width(h).toFixed(3)} / ${width(n_).toFixed(3)})`);
});

// The author's fourth round: the hair read as dreadlocks, he should wear an overshirt with a little scarf,
// and the boots were too big.
test('an open overshirt with a collar over the undershirt, a little neckerchief, slim low ankle boots', () => {
  const h = traveller(); h.update(true); h.model.updateMatrixWorld(true);
  const neck = at(h.b.neck_01), head = at(h.b.Head);
  // the collar stands round the back of the neck and its points lie open on the chest
  const collar = boxOf(h, /^Overshirt_collar$/), coat = boxOf(h, /^Coral_overshirt$/);
  assert.ok(collar.max.y > neck.y - 0.01 && collar.min.y < neck.y - 0.05, 'a collar from the neck down to its points');
  assert.ok(coat.min.y < 0.8 && coat.min.y > 0.6, `the hem hangs loose to the upper thigh (${coat.min.y.toFixed(2)})`);
  // the neckerchief: small, snug at the throat, under the chin
  const scarf = boxOf(h, /^Neckerchief/), size = scarf.getSize(V());
  assert.ok(size.x < 0.2 && size.y < 0.15, `a little neckerchief (${size.x.toFixed(2)} × ${size.y.toFixed(2)} m)`);
  assert.ok(scarf.max.y < head.y && scarf.min.y > neck.y - 0.13, 'round the neck, above the chest');
  for (const n of ['Scarf_cowl', 'Scarf_tail']) assert.equal(piece(h, n), undefined, `${n} gone`);
  // the boots: close round the foot and low (just over the ankle), the soles a thin line
  for (const s of ['l', 'r']) {
    const boot = boxOf(h, new RegExp(`^Boot_${s}$`)), sole = boxOf(h, new RegExp(`^Boot_sole_${s}$`)), b = boot.getSize(V());
    const foot = new THREE.Box3(), P = h.body.geometry.attributes.position, J = h.body.geometry.attributes.skinIndex, W = h.body.geometry.attributes.skinWeight;
    const ids = ['foot', 'ball'].map((n) => h.body.skeleton.bones.indexOf(h.b[`${n}_${s}`]));
    for (let i = 0; i < P.count; i++) if (ids.includes(J.getX(i)) && W.getX(i) > 0.6) foot.expandByPoint(h.body.localToWorld(h.body.getVertexPosition(i, V())));
    const f = foot.getSize(V());
    assert.ok(b.x < f.x + 0.03 && b.z < f.z + 0.05, `close-fitting (${b.x.toFixed(3)} × ${b.z.toFixed(3)} round a ${f.x.toFixed(3)} × ${f.z.toFixed(3)} foot)`);
    assert.ok(boot.max.y < 0.19, `a low ankle boot (${boot.max.y.toFixed(3)} m)`);
    assert.ok(sole.max.y - sole.min.y < 0.03, 'a thin sole');
  }
});

test('the hair stays a short mop round the head: nothing long hangs or sticks out', () => {
  const g = TRAVELLER_HAIR(), P = g.attributes.position, v = V();
  let far = 0;
  for (let i = 0; i < P.count; i++) far = Math.max(far, v.fromBufferAttribute(P, i).length());
  assert.ok(far < 0.2, `nothing hangs or sticks far off the head (${far.toFixed(3)} m from its centre)`);
  assert.ok(P.count < 9000, `a light mesh (${P.count} vertices)`);
});
