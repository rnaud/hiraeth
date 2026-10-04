import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Humanoid, prepareHuman } from '../src/humanoid.js';
import { buildCharacter, Player } from '../src/player.js';
import { Physics } from '../src/physics.js';
import { Gear } from '../src/gear.js';
import { TRAVELLER_PALETTE } from '../src/traveller-style.js';
import { OUTFIT_BONES } from '../src/outfit.js';

// The traveller is the people's own body and skeleton (Quaternius' human, the
// one every NPC uses) with the outfit of traveller.glb fitted on top (outfit.js).
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
const npcBones = (() => { const out = []; human.traverse((o) => { if (o.isBone) out.push(o.name); }); return out; })();

test('traveller asset is image-free, with flat printed colour zones and weighted humanoid skin', () => {
  assert.equal(asset.images, undefined);
  assert.equal(asset.textures, undefined);
  assert.ok(asset.materials.every(m => !m.pbrMetallicRoughness?.baseColorTexture));
  assert.equal(asset.skins[0].joints.length, 22);
  const inks = new Set(Object.values(TRAVELLER_PALETTE));
  let zoned = 0;
  template.traverse(o => {
    const color = o.isSkinnedMesh && o.geometry.attributes.color;
    if (!color) return;
    zoned++;
    const hex = i => '#' + [color.getX(i), color.getY(i), color.getZ(i)].map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
    for (let i = 0; i < color.count; i += 7) assert.ok(inks.has(hex(i)), 'every zone is a palette ink');
  });
  assert.equal(zoned, 1, 'the generated body carries the colour zones');
  template.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const weights = o.geometry.attributes.skinWeight;
    for (let i = 0; i < weights.count; i++) assert.ok(Math.abs(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1) < .002);
  });
});

test('sculpted face has a nose profile and visible eyes rigidly attached to the head', () => {
  const face = template.getObjectByName('Traveller_sculpted_face');
  assert.ok(face?.isSkinnedMesh);
  const positions = face.geometry.attributes.position;
  let nose = -Infinity, forehead = -Infinity;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    if (Math.abs(x) < .012 && y > 1.78 && y < 1.80) nose = Math.max(nose, z);
    if (Math.abs(x) < .012 && y > 1.88 && y < 1.90) forehead = Math.max(forehead, z);
  }
  assert.ok(nose > forehead + .025, 'nose is part of the head silhouette');
  template.updateMatrixWorld(true);
  for (const s of [-1, 1]) {
    const eye = template.getObjectByName(`Traveller_eye_${s}`);
    const p = new THREE.Vector3().fromBufferAttribute(eye.geometry.attributes.position, 0);
    const normal = new THREE.Vector3().fromBufferAttribute(eye.geometry.attributes.normal, 0);
    assert.ok(normal.z > .8, 'front-facing eye surface');
    const hit = new THREE.Raycaster(new THREE.Vector3(p.x, p.y, .5), new THREE.Vector3(0, 0, -1)).intersectObject(face, false)[0];
    assert.ok(hit && p.z > hit.point.z, 'eye sits outside the facial surface');
  }
  template.traverse(o => {
    if (!o.isSkinnedMesh || !o.name.startsWith('Traveller_')) return;
    const weights = o.geometry.attributes.skinWeight, indices = o.geometry.attributes.skinIndex;
    for (let i = 0; i < weights.count; i++) {
      assert.equal(weights.getX(i), 1);
      assert.equal(o.skeleton.bones[indices.getX(i)].name, 'head');
    }
  });
});

test('rebuilt gloves and soles bind to the correct limb; equipment stays batched', () => {
  const equipment=[]; template.traverse(o=>{if(o.isSkinnedMesh && o.name.startsWith('Equipment'))equipment.push(o);});
  assert.equal(equipment.length,9,'details are batched by material');
  for(const [label,material,bonePrefix] of [['gloves','Equipment orange leather','hand'],['soles','Equipment rubber soles','foot']]) {
    const mesh=equipment.find(o=>o.material.name===material);assert.ok(mesh,label);
    const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
    for(let i=0;i<position.count;i++) {
      assert.ok(Math.abs(skinWeight.getX(i)-1)<1e-6,`${label} stay rigid rather than stretching`);
      const side=position.getX(i)>0?'L':'R';
      assert.equal(mesh.skeleton.bones[skinIndex.getX(i)].name,`${bonePrefix}${side}`);
    }
  }
  for(const mesh of equipment) {
    for(const attribute of Object.values(mesh.geometry.attributes))
      assert.ok(Array.from(attribute.array).every(Number.isFinite),'no invalid exported geometry');
  }
});


test('the traveller wears its outfit on the same skeleton as the people', () => {
  const h = traveller();
  const bones = []; h.model.traverse((o) => { if (o.isBone) bones.push(o.name); });
  assert.deepEqual(bones, npcBones, 'exactly the NPC skeleton: no bone of the outfit rig is left');
  assert.equal(bones.length, 65);
  assert.ok(h.outfit && h.outfitMeshes.length >= 20);
  const body = h.body.skeleton.bones;
  for (const m of h.outfitMeshes) {
    assert.ok(m.skeleton.bones.every((b, i) => b === body[i]), `${m.name} is skinned to the body's own bones`);
    const J = m.geometry.attributes.skinIndex, W = m.geometry.attributes.skinWeight;
    for (let i = 0; i < J.count; i += 3) for (let k = 0; k < 4; k++) if (W.getComponent(i, k) > 0) assert.ok(Object.values(OUTFIT_BONES).includes(body[J.getComponent(i, k)].name));
  }
  // the human's own body, wholly under the suit, is not drawn
  for (const o of h.model.children) if (!h.outfitMeshes.includes(o)) o.traverse((m) => { if (m.isMesh) assert.equal(m.visible, false); });
  // the rest pose is the people's: T-pose arms, the body's own joints
  assert.ok(h.rest.get(h.b.hand_l).p.x > 0.6, 'arms out at rest (the NPC T-pose)');
});

test('the fit: boots on the ground, the helmet on the head, gloves on the hands, nothing torn', () => {
  const h = traveller();
  h.update(true);
  h.model.updateMatrixWorld(true);
  const box = (name) => {
    const m = h.outfitMeshes.find((o) => o.name === name), b = new THREE.Box3();
    m.skeleton.update();
    for (let i = 0; i < m.geometry.attributes.position.count; i += 3) b.expandByPoint(m.localToWorld(m.getVertexPosition(i, new THREE.Vector3())));
    return b;
  };
  const soles = box('Equipment_rubber_soles');
  assert.ok(Math.abs(soles.min.y) < 0.03, `soles on the ground (${soles.min.y.toFixed(3)})`);
  const head = h.b.Head.getWorldPosition(new THREE.Vector3()), helmet = box('Bubble_helmet');
  assert.ok(helmet.containsPoint(head.clone().add(new THREE.Vector3(0, 0.12, 0))), 'the bubble round the head');
  assert.ok(helmet.max.y < 2.05 && helmet.max.y - helmet.min.y < 0.48, 'a head-sized helmet');
  for (const s of ['l', 'r']) {
    const hand = h.b[`hand_${s}`].getWorldPosition(new THREE.Vector3());
    const gloves = box('Equipment_orange_leather');
    assert.ok(gloves.distanceToPoint(hand) < 0.02, `a glove on hand_${s}`);
  }
  // every vertex finite and on the character
  for (const m of h.outfitMeshes) {
    m.skeleton.update();
    for (let i = 0; i < m.geometry.attributes.position.count; i += 11) {
      const p = m.getVertexPosition(i, new THREE.Vector3());
      assert.ok(p.toArray().every(Number.isFinite) && p.length() < 2.6, m.name);
    }
  }
});

test('the outfit retargets, plants feet and reaches walls under rotated gravity', () => {
  for (const angle of [0, Math.PI / 2]) {
    const char = buildCharacter(), h = traveller(char);
    char.root.rotation.z = angle;
    const up = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), angle);
    const normal = new THREE.Vector3(0, 0, -1);
    for (let i = 0; i < 30; i++) {
      char.legs[0].rotation.x = Math.sin(i * .2) * .7;
      char.legs[1].rotation.x = -Math.sin(i * .2) * .7;
      char.arms[0].rotation.x = -.5; char.elbows[0].rotation.x = -1;
      h.update();
      h.plantFeet(1 / 60, { heightAbove: p => p.dot(up), groundNormal: (x, y, z, out) => out.copy(up) }, up, char.root.position, new THREE.Vector3(0, 0, 1));
      h.resetFeet();
    }
    const B = h.b;
    h.reach({ hands: ['r', 'l'].map(s => B[`hand_${s}`].getWorldPosition(new THREE.Vector3())), feet: ['r', 'l'].map(s => B[`foot_${s}`].getWorldPosition(new THREE.Vector3())), wallN: normal, up, wallContact: true });
    for (const s of ['r', 'l']) {
      const toe = B[`ball_${s}`].getWorldPosition(new THREE.Vector3()).sub(B[`foot_${s}`].getWorldPosition(new THREE.Vector3())).normalize();
      assert.ok(toe.dot(normal) < -.9);
      const finger = B[`middle_01_${s}`].getWorldPosition(new THREE.Vector3()).sub(B[`hand_${s}`].getWorldPosition(new THREE.Vector3())).normalize();
      assert.ok(finger.dot(up) > .99, 'fingers up the wall');
    }
    for (const m of h.outfitMeshes) {
      m.skeleton.update();
      for (let i = 0; i < m.geometry.attributes.position.count; i += 17) {
        const p = m.getVertexPosition(i, new THREE.Vector3());
        assert.ok(p.toArray().every(Number.isFinite));
        assert.ok(p.length() < 4, 'skin stays within character scale');
      }
    }
  }
});

test('rigid pieces stay rigid in any pose: the helmet, the gloves', () => {
  const char = buildCharacter(), h = traveller(char);
  const pairs = (name) => {
    const m = h.outfitMeshes.find((o) => o.name === name);
    m.skeleton.update();
    const P = m.geometry.attributes.position, n = P.count;
    return [0, 1, 2, 3].map((k) => m.getVertexPosition(Math.floor(k * n / 4), new THREE.Vector3()).distanceTo(m.getVertexPosition(Math.floor(k * n / 4 + n / 8), new THREE.Vector3())));
  };
  h.update();
  const before = { helmet: pairs('Bubble_helmet'), gloves: pairs('Equipment_orange_leather') };
  char.head.rotation.set(0.5, 0.8, 0.2); char.arms[0].rotation.set(-1.2, 0.3, 0); char.elbows[0].rotation.x = -1.4; char.torso.rotation.set(0.3, 0.4, 0);
  h.update();
  const after = { helmet: pairs('Bubble_helmet'), gloves: pairs('Equipment_orange_leather') };
  for (const k of ['helmet', 'gloves']) before[k].forEach((d, i) => assert.ok(Math.abs(d - after[k][i]) < 1e-4, `${k} keeps its shape`));
});

test('the outfit keeps the scout dock, the bracer frame and the handheld device', () => {
  const char = buildCharacter(), h = traveller(char);
  const g = new Gear(new THREE.Scene(), h, char);
  h.update(); g.update(1 / 60, new THREE.Vector3(), 0, 0, true);
  assert.ok(g.scoutDock.getWorldPosition(new THREE.Vector3()).toArray().every(Number.isFinite));
  assert.equal(g.noShadow.length, 1);
  assert.ok(g.noShadow[0].isSkinnedMesh);
  assert.equal(g.springs.length, 0);
  assert.ok(g.device.visible);
  // the bracer straps onto the forearm frame: +y runs from the elbow toward the hand
  const f = h.forearm.r;
  assert.equal(f.parent, h.b.lowerarm_r);
  h.update(true); h.model.updateMatrixWorld(true);
  const along = new THREE.Vector3(0, 1, 0).applyQuaternion(f.getWorldQuaternion(new THREE.Quaternion()));
  const arm = h.b.hand_r.getWorldPosition(new THREE.Vector3()).sub(h.b.lowerarm_r.getWorldPosition(new THREE.Vector3())).normalize();
  assert.ok(along.dot(arm) > 0.97, 'the forearm frame runs along the forearm');
  // the head anchor sits inside the helmet, scaled with the head
  assert.ok(h.headAnchor.getWorldPosition(new THREE.Vector3()).distanceTo(h.b.Head.getWorldPosition(new THREE.Vector3())) < 0.15);
});

test('vehicle animation reaches the skin on the first frame and releases foot locks', () => {
  const p = new Player(new Physics(new THREE.Scene()));
  p.ride = { speed: 0, pos: new THREE.Vector3(), update() {}, seatTransform(pos, q) { pos.set(0, 2, 0); q.identity(); } };
  p.humanoid = traveller(p.char);
  p.humanoid._feet = { l: { locked: true }, r: { locked: true } };
  p.gear = { device: { visible: true } };
  p.updateCloth = () => {};
  const before = p.humanoid.b.thigh_r.quaternion.clone();
  p.update(1 / 60, {}, 0);
  assert.ok(before.angleTo(p.humanoid.b.thigh_r.quaternion) > .5);
  assert.equal(p.humanoid._feet.r.locked, false);
  assert.equal(p.gear.device.visible, false);
});

// Sample the shipped motion library, including the seam at the end of each loop.
const motionBytes = await readFile(new URL('../public/anim/ual.glb', import.meta.url));
const motion = await new GLTFLoader().parseAsync(motionBytes.buffer.slice(motionBytes.byteOffset, motionBytes.byteOffset + motionBytes.byteLength), '');
const { Animator } = await import('../src/animator.js');
const gaitClips = Object.fromEntries([['walk', 'Walk_Loop'], ['jog', 'Jog_Fwd_Loop'], ['sprint', 'Sprint_Loop']].map(([key, name]) => [key, motion.animations.find(c => c.name === name)]));
const direction = (a, b) => b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3())).normalize();
for (const gait of ['walk', 'jog', 'sprint']) test(`${gait}: arms, legs and hands match all 120 phases of the source motion, as on the NPCs`, () => {
  const char = buildCharacter(), h = traveller(char);
  const a = new Animator({ scene: motion.scene, clips: gaitClips, native: { walk: 1, jog: 3, sprint: 6 } }, char);
  const rootQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, .7, -.4));
  char.root.quaternion.copy(rootQ);
  let first;
  for (let frame = 0; frame <= 120; frame++) {
    for (const [name, action] of Object.entries(a.actions)) { action.setEffectiveWeight(name === gait ? 1 : 0); action.time = (frame % 120) / 120 * gaitClips[name].duration; }
    a.mixer.update(0); a.src.updateMatrixWorld(true); a.apply(char.root); h.update(); h.poseHands(a);
    const B = h.b;
    for (const s of ['r', 'l']) {
      for (const [parent, child] of [['upperarm', 'lowerarm'], ['lowerarm', 'hand'], ['thigh', 'calf'], ['calf', 'foot']]) {
        const from = `${parent}_${s}`, to = `${child}_${s}`;
        const want = direction(a.bone(from), a.bone(to)).applyQuaternion(rootQ);
        assert.ok(direction(B[from], B[to]).dot(want) > .99999, `${gait} ${frame}: ${from} follows its own source limb`);
        const length = B[from].getWorldPosition(new THREE.Vector3()).distanceTo(B[to].getWorldPosition(new THREE.Vector3()));
        assert.ok(Math.abs(length - h.rest.get(B[from]).p.distanceTo(h.rest.get(B[to]).p)) < .0001, 'limb length stays fixed');
      }
      // the hand turns from its T-pose exactly as the source hand turns from the library's T-pose
      const ours = B[`hand_${s}`].getWorldQuaternion(new THREE.Quaternion()).premultiply(rootQ.clone().invert()).multiply(h.rest.get(B[`hand_${s}`]).q.clone().invert());
      const theirs = a.bone(`hand_${s}`).getWorldQuaternion(new THREE.Quaternion()).multiply(a.restHands[s].clone().invert());
      assert.ok(ours.angleTo(theirs) < 1e-3, `${gait} ${frame}: the wrist follows the source wrist`);
    }
    const pose = Object.values(h.b).map(b => b.quaternion.clone());
    if (!first) first = pose;
    if (frame === 120) pose.forEach((q, i) => assert.ok(q.angleTo(first[i]) < .001, `no jump at loop boundary (${Object.keys(h.b)[i]} ${q.angleTo(first[i])})`));
  }
});

test('glove thumbs point inward with fingers up and palms on a climbing wall', () => {
  // the thumb tip in the outfit's own (A-pose) coordinates: the glove vertex furthest out from the palm, thumb side
  const src = template.getObjectByName('Equipment_orange_leather');
  const tSk = src.skeleton, pos = (n) => new THREE.Vector3().setFromMatrixPosition(tSk.boneInverses[tSk.bones.findIndex((b) => b.name === n)].clone().invert());
  const P = src.geometry.attributes.position, thumb = {};
  for (const [s, S, sign] of [['l', 'L', 1], ['r', 'R', -1]]) {
    const wrist = pos(`hand${S}`);
    let max = -Infinity;
    for (let i = 0; i < P.count; i++) {
      if (P.getX(i) * sign < 0) continue;
      const d = (P.getX(i) - wrist.x) * sign;
      if (d > max) { max = d; thumb[s] = i; }
    }
  }
  for (const angle of [0, Math.PI / 2]) {
    const char = buildCharacter(), h = traveller(char);
    const glove = h.outfitMeshes.find((o) => o.name === 'Equipment_orange_leather');
    char.root.rotation.z = angle; h.update();
    const up = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), angle), wallN = new THREE.Vector3(0, 0, -1);
    const B = h.b;
    h.reach({ hands: ['r', 'l'].map(s => B[`hand_${s}`].getWorldPosition(new THREE.Vector3())), feet: ['r', 'l'].map(s => B[`foot_${s}`].getWorldPosition(new THREE.Vector3())), wallN, up, wallContact: true });
    glove.skeleton.update();
    const left = B.hand_l.getWorldPosition(new THREE.Vector3()), right = B.hand_r.getWorldPosition(new THREE.Vector3());
    const inward = { l: right.clone().sub(left).normalize(), r: left.clone().sub(right).normalize() };
    for (const s of ['l', 'r']) {
      const wrist = B[`hand_${s}`].getWorldPosition(new THREE.Vector3());
      const t = glove.localToWorld(glove.getVertexPosition(thumb[s], new THREE.Vector3())).sub(wrist);
      assert.ok(t.dot(inward[s]) > .03, `${s} thumb points toward the other hand on the wall`);
    }
  }
});

test('shader face replaces fixed ink, stays image-free and keeps live hero expressions', async () => {
  const { markHero } = await import('../src/materials.js');
  const a = traveller(), b = traveller();
  let portrait;
  a.model.traverse(o => { if (o.visible && o.material?.uniforms?.uPortrait.value) portrait = o; });
  assert.ok(portrait);
  assert.equal(portrait.material.uniforms.uHasMap.value, 0);
  markHero(a.model);
  a.face.update(.09, { smile: .6 });
  assert.ok(a.face.uniforms.uExpression.value.x > .99);
  assert.equal(portrait.material.uniforms.uExpression, a.face.uniforms.uExpression);
  assert.equal(b.face.uniforms.uExpression.value.y, 0);
  a.face.update(.2);
  assert.equal(a.face.uniforms.uExpression.value.x, 0);
  const ink = []; a.model.traverse(o => { if (/Traveller_(eye|mouth|nostril|temple_mark|brow_mark)/.test(o.name)) ink.push(o); });
  assert.ok(ink.length >= 5);
  assert.ok(ink.every(o => !o.visible));
});

test('flat suit draws shader folds at the outfit rig\'s joints; equipment prints in the reference palette', () => {
  const h = traveller();
  const suit = h.outfitMeshes.find((o) => o.material.uniforms.uCreases.value);
  assert.ok(suit?.material.vertexColors, 'suit colour comes from its zones, not an image');
  assert.equal(suit.material.uniforms.uHasMap.value, 0);
  assert.equal(suit.material.uniforms.uPaletteSize.value, Object.keys(TRAVELLER_PALETTE).length);
  const limbs = suit.material.uniforms.uLimbs.value;
  assert.equal(limbs.length, 16);
  // folds sit in the suit's own coordinates: the warp is undone, so they land on the outfit rig's joints
  assert.ok(limbs[0].distanceTo(new THREE.Vector3(0.255, 1.49, 0)) < 0.01, 'left shoulder');
  assert.ok(limbs[12].distanceTo(new THREE.Vector3(0.185, 0.51, 0.025)) < 0.01, 'left knee');
  assert.ok(limbs[0].y > limbs[1].y && limbs[1].y > limbs[5].y, 'arm segments run shoulder, elbow, wrist');
  const glove = h.outfitMeshes.find((o) => o.name === 'Equipment_orange_leather');
  assert.equal('#' + glove.material.uniforms.uColor.value.getHexString(), TRAVELLER_PALETTE.glove);
});
