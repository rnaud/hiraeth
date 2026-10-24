import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareHuman } from '../src/humanoid.js';
import { ensureNpcDom } from './helpers/npc-dom.js';
import { NPC } from '../src/npc.js';
import { HOSTS } from '../src/story/hosts-data.js';
import { bikeWager } from '../src/story/bike-wager.js';
import { MakeHumanPeople } from '../src/makehuman/people.js';
import { parseBody } from '../src/makehuman/body.js';
import { buildCharacter } from '../src/player.js';
import { buildKamalRider } from '../src/minigames/canyon-rider.js';
import { buildRivalSled } from '../src/minigames/canyon-sled.js';
import { COURSE, makeTrack, makeCourse, canyonHeight, start } from '../src/minigames/canyon.js';
import rivalGame from '../src/minigames/canyon-rival.js';
import { skinnedLods } from '../src/skinned-lod.js';
import { disposeTree } from '../src/minigames/kit/dispose.js';

ensureNpcDom();
// This is the same committed MakeHuman body used by the actual desert hosts,
// not a synthetic palette-only actor or the traveller's generated outfit.
const bin = readFileSync(new URL('../public/anim/mh/body.bin', import.meta.url));
const data = parseBody(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const people = new MakeHumanPeople(data, 'desert');
const humans = people.humans();
const arenaHumans = new MakeHumanPeople(data, 'arena').humans();
const noop = () => {};
function context() {
  const scene = new THREE.Scene(), added = [];
  return { scene, physics: {}, people: { humans: arenaHumans }, added,
    add(o) { added.push(o); scene.add(o); } };
}
function roadside(ctx, human = humans[0]) {
  const def = bikeWager({ race: noop, practice: noop, fuelled: () => true });
  const n = new NPC(ctx.scene, ctx.physics, { route: [new THREE.Vector3(120, 4, 70)],
    def, palette: def.palette, lines: def.lines, head: def.head, cape: def.cape,
    human, kind: 'm', world: 'desert', speed: 0 });
  n.char.pack.visible = false;
  return n;
}

test('Kamal’s race identity matches the real roadside NPC body, costume and proportions', () => {
  const ctx = context(), outside = roadside(ctx), rider = buildKamalRider(ctx);
  try {
    assert.equal(rider.npc.def, HOSTS.canyon);
    assert.deepEqual(rider.npc.look, outside.look);
    assert.equal(rider.npc.look.head, outside.look.head);
    assert.equal(rider.npc.look.mask, 'browgoggles');
    assert.equal(rider.npc.look.body, 'toolbelt');
    assert.ok(rider.npc.humanoid, 'actual skinned NPC is required');
    assert.equal(ctx.people.humans[0].userData.mhPeople.world, 'arena', 'actual standalone race host');
    assert.equal(rider.npc.humanoid.profile, outside.humanoid.profile, 'Desert body, not the Arena host body');
    assert.equal(rider.npc.humanoid.build, outside.humanoid.build);
    assert.equal(rider.npc.baseScale, outside.baseScale);
    assert.deepEqual(rider.root.scale.toArray(), outside.object.scale.toArray());
    assert.equal(rider.npc.humanoid.body.geometry.attributes.position.count,
      outside.humanoid.body.geometry.attributes.position.count);
    assert.deepEqual(rider.npc.humanoid.order.map(b => b.name), outside.humanoid.order.map(b => b.name));
    assert.equal(rider.char.pack.visible, false);
    assert.equal(rider.npc.animator, null, 'the race owns pose; no walking animator competes');
  } finally { rider.dispose(); outside.dispose(ctx.scene); disposeTree(...ctx.added, outside.object); }
});

test('the supported Quaternius body keeps the same roadside identity and shared template on retry', async () => {
  globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
  const b = readFileSync(new URL('../public/anim/human_m.glb', import.meta.url));
  const parsed = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  const template = prepareHuman(parsed.scene, 'm');
  const ctx = context(); ctx.people.humans = [template, null];
  const outside = roadside(ctx, template), rider = buildKamalRider(ctx);
  const sharedMaterials = new Set(), sharedSkeletons = new Set(), disposedShared = [];
  template.traverse(o => {
    if (o.isSkinnedMesh) sharedSkeletons.add(o.skeleton);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) sharedMaterials.add(m);
  });
  for (const m of sharedMaterials) m.addEventListener('dispose', () => disposedShared.push(m));
  const originalDispose = new Map([...sharedSkeletons].map(skeleton => [skeleton, skeleton.dispose]));
  for (const skeleton of sharedSkeletons) skeleton.dispose = () => disposedShared.push(skeleton);
  try {
    assert.deepEqual(rider.npc.look, outside.look);
    assert.equal(rider.npc.humanoid.profile, outside.humanoid.profile);
    assert.equal(rider.npc.baseScale, outside.baseScale);
    assert.ok(rider.npc.humanoid.body.isSkinnedMesh);
    rider.root.traverse(o => { if (o.isSkinnedMesh) assert.ok(!sharedSkeletons.has(o.skeleton), 'race owns cloned skeleton'); });
    rider.dispose();
    assert.deepEqual(disposedShared, [], 'dispose must leave loaded template resources alive');
    const retry = buildKamalRider(ctx);
    assert.deepEqual(retry.npc.look, outside.look);
    assert.equal(retry.npc.humanoid.body.geometry.attributes.position.count, outside.humanoid.body.geometry.attributes.position.count);
    retry.dispose();
    assert.deepEqual(disposedShared, []);
  } finally {
    rider.dispose(); outside.dispose(ctx.scene);
    for (const [skeleton, dispose] of originalDispose) skeleton.dispose = dispose;
    disposeTree(...ctx.added, outside.object);
  }
});

test('the loaded rider pelvis meets the posed saddle reference without changing roadside scale and releases owned lifecycle once', () => {
  const ctx = context(), sled = buildRivalSled(); ctx.scene.add(sled.root);
  const riderParent = new THREE.Group(); riderParent.position.set(17, -3, 41);
  riderParent.rotation.y = .7; ctx.scene.add(riderParent);
  const removed = [], originalRemove = skinnedLods.remove;
  skinnedLods.remove = function(lod) { removed.push(lod); return originalRemove.call(this, lod); };
  let rider;
  try {
    rider = buildKamalRider(ctx); riderParent.add(rider.root);
    const scale = rider.root.scale.clone(), h = rider.npc.humanoid;
    const bonesBefore = h.order.map(b => b.quaternion.clone());
    for (const [x, y, z, yaw, bank, pitch] of [[0, 3, 0, 0, 0, 0], [300, 24, -190, 2.4, .4, -.2], [-90, 8, 250, -2.6, -.35, .3]]) {
      sled.root.position.set(x, y, z); sled.root.rotation.y = yaw; sled.body.rotation.set(pitch, 0, bank);
      rider.update(sled.seatAnchor, 1 / 30, ({ char }) => {
        char.legs[0].rotation.set(-1.35, 0, .12); char.legs[1].rotation.set(-1.35, 0, -.12);
        char.knees[0].rotation.x = char.knees[1].rotation.x = 1.45;
        char.body.position.y = pitch < 0 ? .06 : 0;
        char.body.rotation.set(.26, 0, -bank * .4);
      });
      const position = sled.seatAnchor.getWorldPosition(new THREE.Vector3());
      const quaternion = sled.seatAnchor.getWorldQuaternion(new THREE.Quaternion());
      // Actual loaded skin bone, not root-to-anchor equality (which hid the sunk rider).
      const target = new THREE.Vector3(0, .99, 0).applyMatrix4(rider.char.body.matrix)
        .applyMatrix4(sled.seatAnchor.matrixWorld);
      const actual = h.b.pelvis.getWorldPosition(new THREE.Vector3());
      assert.ok(actual.distanceTo(target) < 1e-7, `pelvis misses saddle by ${actual.distanceTo(target)}`);
      assert.ok(rider.root.getWorldQuaternion(new THREE.Quaternion()).angleTo(quaternion) < 1e-7);
      assert.ok(actual.distanceTo(position) > .8, 'saddle reference is not the feet-origin anchor');
      assert.deepEqual(rider.root.scale.toArray(), scale.toArray());
      for (const b of h.order) assert.ok(b.matrixWorld.elements.every(Number.isFinite));
    }
    assert.ok(h.order.some((b, i) => b.quaternion.angleTo(bonesBefore[i]) > .1), 'controls must move actual skin bones');
    const own = new Set(); rider.root.traverse(o => { for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m?.userData?.own) own.add(m); });
    const disposed = new Set(); for (const m of own) m.addEventListener('dispose', () => disposed.add(m));
    rider.dispose(); rider.dispose();
    assert.deepEqual(removed, [h.lod], 'one LOD registration released once');
    assert.ok(rider.root.parent === null, 'disposed rider must detach from its actual parent');
    assert.equal(disposed.size, own.size);
    rider.update(sled.seatAnchor, 1 / 30, () => assert.fail('disposed actor must not be posed'));
    const again = buildKamalRider(ctx);
    assert.equal(again.npc.humanoid.profile, h.profile, 'the shared template is still usable on retry');
    again.dispose();
  } finally { rider?.dispose(); skinnedLods.remove = originalRemove; disposeTree(...ctx.added, sled.root); }
});

test('the real race starts with seated Kamal before its first update and creates none for ordinary practice', () => {
  const K = makeCourse(makeTrack(), { ...COURSE, laps: 1 });
  for (const duel of [true, false]) {
    const ctx = context(), char = buildCharacter();
    Object.assign(ctx, {
      def: { ...rivalGame, rival: duel }, state: { flag: () => null, set: () => assert.fail('appearance must not write rewards') },
      camera: new THREE.PerspectiveCamera(), player: { char, object: char.root, pos: new THREE.Vector3(), vel: new THREE.Vector3() },
      level: { canyon: { K, H: (x, z) => canyonHeight(K, x, z), gates: K.checks.map(() => ({ flags: [], colours: [] })), pads: K.pads.map(() => ({ glow: 0, chev: {} })), cloth: {} } },
      sfx: new Proxy({}, { get: () => noop }), sound: null, time: 0, finish: noop,
      setFov: noop, status: noop, flash: noop, kick: noop, speed: noop, addTime: noop,
    });
    const session = start(ctx);
    try {
      if (duel) {
        const rider = session.rivalRider;
        assert.ok(rider.npc.humanoid);
        assert.equal(rider.char.legs[0].rotation.x, -1.35);
        assert.equal(rider.char.knees[0].rotation.x, 1.45);
        assert.ok(rider.root.position.distanceTo(new THREE.Vector3(session.rival.bike.x, session.rival.bike.y, session.rival.bike.z)) < 3);
        assert.equal(session.rival.bike.prog, 6, 'initial posing must not advance the rival');
      } else assert.equal(session.rivalRider, null);
    } finally { session.end(); session.end(); disposeTree(...ctx.added, char.root); }
  }
});
