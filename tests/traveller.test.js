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
import { TRAVELLER } from '../src/traveller.js';

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

test('the suit is painted by the outfit shader: lavender, salmon gloves and boots, folds at the human\'s joints', () => {
  const h = traveller(), u = h.body.material.uniforms;
  assert.equal(u.uMode.value, MODE_OUTFIT);
  assert.equal('#' + u.uColor.value.getHexString(), TRAVELLER_PALETTE.suit);
  assert.equal('#' + u.uColor3.value.getHexString(), TRAVELLER_PALETTE.boot);
  assert.equal(u.uGlove.value.w, 1, 'gloved hands');
  assert.equal('#' + new THREE.Color(u.uGlove.value.x, u.uGlove.value.y, u.uGlove.value.z).getHexString(), TRAVELLER_PALETTE.glove);
  assert.equal(u.uCreases.value, 1);
  const limbs = u.uLimbs.value, B = h.b;
  // the folds sit on the human's own shoulders, elbows, hips and knees
  assert.ok(limbs[0].distanceTo(h.rest.get(B.upperarm_l).p) < 1e-4, 'left shoulder');
  assert.ok(limbs[2].distanceTo(h.rest.get(B.lowerarm_l).p) < 1e-4 || limbs[1].distanceTo(h.rest.get(B.lowerarm_l).p) < 1e-4, 'left elbow');
  assert.ok(limbs.some((p) => p.distanceTo(h.rest.get(B.calf_l).p) < 1e-4), 'left knee');
});

test('the fit at rest: helmet centred on the head, headphones on the ears, gloves on the hands, pack on the back, soles on the ground', () => {
  const h = traveller();
  h.update(true); h.model.updateMatrixWorld(true);
  // the head inside the bubble, centred, the face clear of the glass
  const headBox = new THREE.Box3(), P = h.body.geometry.attributes.position, J = h.body.geometry.attributes.skinIndex, W = h.body.geometry.attributes.skinWeight;
  const head = h.body.skeleton.bones.indexOf(h.b.Head);
  for (let i = 0; i < P.count; i++) if (J.getX(i) === head && W.getX(i) > 0.6) headBox.expandByPoint(h.body.localToWorld(h.body.getVertexPosition(i, V())));
  const helmet = boxOf(h, /^Bubble_helmet$/), hc = headBox.getCenter(V()), bc = helmet.getCenter(V());
  assert.ok(Math.abs(bc.x - hc.x) < 0.005 && Math.abs(bc.z - hc.z) < 0.03 && Math.abs(bc.y - hc.y) < 0.04, `the bubble centred on the head (${bc.toArray().map((x) => x.toFixed(3))} / ${hc.toArray().map((x) => x.toFixed(3))})`);
  assert.ok(helmet.min.x < headBox.min.x - 0.06 && helmet.max.x > headBox.max.x + 0.06, 'room each side');
  assert.ok(helmet.max.z > headBox.max.z + 0.04 && helmet.max.y > headBox.max.y + 0.05, 'room before the face and over the head');
  assert.ok(helmet.min.y < headBox.min.y, 'the chin inside');
  assert.ok(helmet.max.x - helmet.min.x < 0.4, 'a head-sized helmet');
  // the cups just off each side of the head, at ear height
  for (const [name, sign] of [['Headphone_1', 1], ['Headphone_-1', -1]]) {
    const cup = boxOf(h, new RegExp(`^${name}$`));
    const inner = sign > 0 ? cup.min.x : -cup.max.x, side = sign > 0 ? headBox.max.x : -headBox.min.x;
    assert.ok(inner > side - 0.01 && inner < side + 0.02, `${name} on the ear (${inner.toFixed(3)} / ${side.toFixed(3)})`);
    assert.ok(cup.min.y < hc.y + 0.02 && cup.max.y > hc.y, 'at ear height');
  }
  // gloves: the hands are painted (above), the cuffs end at the wrists
  for (const s of ['l', 'r']) {
    const cuff = boxOf(h, new RegExp(`^Glove_cuff_${s}$`)), wrist = at(h.b[`hand_${s}`]);
    assert.ok(cuff.distanceToPoint(wrist) < 0.03, `the cuff at wrist ${s}`);
  }
  // the pack on the back: behind the suit, touching it, centred
  const pack = boxOf(h, /^Equipment_(ivory_radio|blue_metal)$/), back = h.kit.backZ;
  assert.ok(pack.max.z <= back + 0.012 && pack.max.z > back - 0.03, `the pack against the back (${pack.max.z.toFixed(3)} / ${back.toFixed(3)})`);
  assert.ok(Math.abs(pack.getCenter(V()).x) < 0.03 && pack.min.y > 0.9 && pack.max.y < 1.75);
  // boots round the feet, soles just under the ground; no part of the body below them
  const soles = boxOf(h, /^Equipment_rubber_soles/), boots = boxOf(h, /^Equipment_dusty_pink_boots/);
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
  const soles = boxOf(h, /^Equipment_rubber_soles/);
  assert.ok(soles.min.y > -0.04 && soles.min.y < 0.02, `soles on the ground in idle (${soles.min.y.toFixed(3)})`);
  const helmet = boxOf(h, /^Bubble_helmet$/);
  assert.ok(helmet.containsPoint(at(h.b.Head).add(new THREE.Vector3(0, 0.08, 0))), 'the helmet round the head');
  assert.ok(at(h.b.pelvis).y > 0.85, 'standing upright');
});

test('rigid pieces stay rigid in any pose: the helmet, the pack, the boots', () => {
  const char = buildCharacter(), h = traveller(char);
  const spans = (name) => {
    const m = piece(h, name);
    m.skeleton.update();
    const n = m.geometry.attributes.position.count;
    return [0, 1, 2, 3].map((k) => m.getVertexPosition(Math.floor(k * n / 4), V()).distanceTo(m.getVertexPosition(Math.floor(k * n / 4 + n / 8), V())));
  };
  const names = ['Bubble_helmet', 'Equipment_blue_metal', 'Equipment_rubber_soles_l'];
  h.update();
  const before = names.map(spans);
  char.head.rotation.set(0.5, 0.8, 0.2); char.arms[0].rotation.set(-1.2, 0.3, 0); char.elbows[0].rotation.x = -1.4; char.torso.rotation.set(0.3, 0.4, 0);
  char.legs[0].rotation.x = 0.9; char.knees[0].rotation.x = -1.2;
  h.update();
  names.map(spans).forEach((after, k) => after.forEach((d, i) => assert.ok(Math.abs(d - before[k][i]) < 1e-4, `${names[k]} keeps its shape`)));
  // the helmet goes with the head
  const head = at(h.b.Head);
  assert.ok(boxOf(h, /^Bubble_helmet$/).containsPoint(head.add(new THREE.Vector3(0, 0.1, 0).applyQuaternion(h.b.Head.getWorldQuaternion(new THREE.Quaternion())))));
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

test('climbing under rotated gravity: fingers up the wall, toes into it, the gauntlets on the wrists', () => {
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
      assert.ok(boxOf(h, new RegExp(`^Glove_cuff_${s}$`)).distanceToPoint(at(B[`hand_${s}`])) < 0.03, 'the gauntlet stays on the wrist');
    }
  }
});

test('the gear hooks: the head and chest anchors, the scout on the pack, the bracer round the sleeve, the glass out of shadows', () => {
  const char = buildCharacter(), h = traveller(char);
  const g = new Gear(new THREE.Scene(), h, char);
  h.update(true); h.model.updateMatrixWorld(true); g.update(1 / 60, V(), 0, 0, true);
  assert.equal(g.springs.length, 0);
  assert.deepEqual(g.noShadow, [piece(h, 'Bubble_helmet')]);
  assert.ok(at(h.headAnchor).distanceTo(boxOf(h, /^Bubble_helmet$/).getCenter(V())) < 0.05, 'the head anchor in the bubble');
  // the scout docks on top of the radio pack
  const pack = boxOf(h, /^Equipment_ivory_radio$/), dock = at(g.scoutDock);
  assert.ok(dock.y > pack.max.y && dock.y < pack.max.y + 0.15 && dock.z > pack.min.z && dock.z < pack.max.z, 'the scout on the pack');
  assert.equal(h.radioPack.length, 3);
  // the bracer's frame: +y down the forearm, -x toward the thumb, scaled out round the sleeve
  const f = h.forearm.r;
  assert.equal(f.parent, h.b.lowerarm_r);
  const q = f.getWorldQuaternion(new THREE.Quaternion());
  const along = new THREE.Vector3(0, 1, 0).applyQuaternion(q), thumb = new THREE.Vector3(-1, 0, 0).applyQuaternion(q);
  assert.ok(along.dot(at(h.b.hand_r).sub(at(h.b.lowerarm_r)).normalize()) > 0.999, 'along the forearm');
  assert.ok(thumb.dot(at(h.b.thumb_01_r).sub(at(h.b.hand_r)).normalize()) > 0.5, 'the thumb side');
  assert.ok(f.getWorldScale(V()).x >= 1, 'not smaller than the bracer was made');
  // the device in the hand (until the bracer takes over)
  assert.ok(g.device.visible);
});

test('kneeling (a box, getting up): the knee down to the ground, every piece whole and on the body', () => {
  const h = traveller(), n = npc(), o = { up: new THREE.Vector3(0, 1, 0), fwd: new THREE.Vector3(0, 0, 1), ground: 0, look: new THREE.Vector3(0, 0.3, 0.6) };
  for (const x of [h, n]) { x.update(); x.kneel(1, o); x.model.updateMatrixWorld(true); }
  for (const k of Object.keys(h.b)) assert.ok(at(h.b[k]).distanceTo(at(n.b[k])) < 1e-5, `${k} kneels as an NPC's does`);
  assert.ok(at(h.b.pelvis).y < 0.6 && at(h.b.calf_l).y < 0.3, `down on one knee (${at(h.b.calf_l).y.toFixed(3)})`);
  const boots = boxOf(h, /^Equipment_dusty_pink_boots_r$/);
  assert.ok(boots.min.y > -0.05 && boots.distanceToPoint(at(h.b.foot_r)) < 0.01, 'the right boot on its foot, on the ground');
  assert.ok(boxOf(h, /^Bubble_helmet$/).containsPoint(at(h.b.Head).add(new THREE.Vector3(0, 0.08, 0).applyQuaternion(h.b.Head.getWorldQuaternion(new THREE.Quaternion())))), 'the helmet on the bowed head');
  for (const m of h.outfitMeshes) for (let i = 0; i < m.geometry.attributes.position.count; i += 13) assert.ok(m.getVertexPosition(i, V()).toArray().every(Number.isFinite));
});

test('vehicle animation reaches the skin on the first frame and releases foot locks', () => {
  const p = new Player(new Physics(new THREE.Scene()));
  p.ride = { speed: 0, pos: V(), update() {}, seatTransform(pos, q) { pos.set(0, 2, 0); q.identity(); } };
  p.humanoid = traveller(p.char);
  p.humanoid._feet = { l: { locked: true }, r: { locked: true } };
  p.gear = { device: { visible: true } };
  p.updateCloth = () => {};
  const before = p.humanoid.b.thigh_r.quaternion.clone();
  p.update(1 / 60, {}, 0);
  assert.ok(before.angleTo(p.humanoid.b.thigh_r.quaternion) > 0.5);
  assert.equal(p.humanoid._feet.r.locked, false);
  assert.equal(p.gear.device.visible, false);
});

test('his own hair under the liner, the fringe on the brow inside the helmet; the enamel star pinned inside the glass', async () => {
  const { TRAVELLER_STAR } = await import('../src/boxes/effects.js');
  const h = traveller();
  h.char.root.updateMatrixWorld(true);
  h.update(true);
  const hair = piece(h, 'Traveller_hair');
  assert.ok(hair, 'a hair piece');
  assert.equal('#' + hair.material.uniforms.uColor.value.getHexString(), TRAVELLER_PALETTE.hair);
  const glass = boxOf(h, /^Bubble_helmet$/), locks = boxOf(h, /^Traveller_hair$/);
  const centre = glass.getCenter(V()), r = Math.min(...glass.getSize(V()).toArray()) / 2;
  // the hair stays inside the bubble, and comes down over the brow (the fringe) but not to the eyes
  for (const c of [locks.min, locks.max]) assert.ok(c.distanceTo(centre) < r * 1.75, 'the hair inside the helmet');
  const eyes = h.rest.get(h.b.Head).p.y + 0.1, front = h.rest.get(h.b.Head).p.z + 0.07;   // (the eyes are at the head anchor's height)
  let fringe = Infinity;
  const [first, count] = hair.userData.ranges.Traveller_hair;
  for (let i = first; i < first + count; i++) { const p = hair.localToWorld(hair.getVertexPosition(i, V())); if (Math.abs(p.x) < 0.03 && p.z > front) fringe = Math.min(fringe, p.y); }
  assert.ok(fringe > eyes + 0.01 && fringe < eyes + 0.06, `the fringe ends over the eyes (${(fringe - eyes).toFixed(3)} m)`);
  // the star: every corner of it inside the glass (it used to stand out through the top)
  const star = new THREE.Object3D();
  h.headAnchor.add(star);
  star.position.copy(TRAVELLER_STAR.at); star.rotation.set(TRAVELLER_STAR.tilt, 0, 0); star.scale.setScalar(TRAVELLER_STAR.scale);
  star.updateMatrixWorld(true);
  for (const [x, y] of [[0.045, 0], [-0.045, 0], [0, 0.045], [0, -0.045]]) {
    const p = star.localToWorld(new THREE.Vector3(x, y, 0.008));
    assert.ok(p.distanceTo(centre) < r - 0.005, `a point of the star ${(p.distanceTo(centre) - r).toFixed(3)} m inside the glass`);
  }
});
