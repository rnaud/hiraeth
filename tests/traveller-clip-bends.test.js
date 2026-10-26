// The game clips on B3 and the v2 skin; Blender-source pose checks live in traveller-elbows.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { Player } = await import('../src/player.js');
const { Physics } = await import('../src/physics.js');
const { Animator, libraryFrom } = await import('../src/animator.js');
const { createTraveller } = await import('../src/characters/traveller.js');
const { travellerB3 } = await import('./gait-sim.js');
const { course, CAM_PLUS_Z } = await import('../src/gait-course.js');

const DIR = 'data/characters/traveller-v2/';
/** (degrees between the two bones, the lower one's lean toward the upper one's front) for a chain a → b → c. */
function bendOf(u, f, front) {
  const perp = f.clone().addScaledVector(u, -f.dot(u));
  return { deg: u.angleTo(f) * 180 / Math.PI, lean: perp.dot(front) };
}

// ---- the game's clips on B3, the v2 skin on its skeleton
const parse = (file) => { const b = readFileSync(file); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
async function v2Skin() {
  const g = readFileSync(DIR + 'traveller.glb'), n = g.readUInt32LE(12), json = JSON.parse(g.toString('utf8', 20, 20 + n)), bin = g.subarray(28 + n);
  json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
  delete json.images; delete json.textures; delete json.samplers; delete json.materials;
  for (const m of json.meshes) for (const pr of m.primitives) delete pr.material;
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  let skin = null;
  gltf.scene.traverse((o) => { if (o.isSkinnedMesh && o.name === 'Skin') skin = o; });
  return skin;
}
const assets = await travellerB3(), lib = libraryFrom(await parse('public/anim/ual.glb')), skinSrc = await v2Skin();

/** The game's traveller (B3) standing at the origin facing +z, and the v2 skin piece bound to his skeleton by bone name. */
function traveller() {
  const scene = course(), physics = new Physics(scene);
  const p = new Player(physics, { climb: false, health: false });
  p.animator = new Animator(lib, p.char);
  p.character = createTraveller(p.char, assets);
  p.humanoid = p.character.humanoid;
  p.gear = { update() {}, device: { visible: true } };
  p._lastVel = new T.Vector3();
  p.pos.set(0, physics.groundAt(0, 5, 0), 0); p.heading = 0; p.vel.set(0, 0, 0); p.onGround = true; p.lastSafe.copy(p.pos);
  scene.add(p.object);
  // (as outfit-page.js loadParts and Wardrobe.make: skinIndex renumbered to his bones by name, bound with B3's bind matrix)
  const body = p.humanoid.body, bones = body.skeleton.bones, g = skinSrc.geometry.clone();
  const map = skinSrc.skeleton.bones.map((b) => bones.findIndex((t) => t.name === b.name));
  assert.ok(map.every((i) => i >= 0), 'every v2 bone on his skeleton');
  const si = g.attributes.skinIndex;
  for (let k = 0; k < si.array.length; k++) si.array[k] = map[si.array[k]];
  const v2 = new T.SkinnedMesh(g, new T.MeshBasicMaterial());
  body.parent.add(v2);
  v2.bind(body.skeleton, body.bindMatrix);
  return { p, v2 };
}

/** Each elbow's bend on B3's skeleton and on the v2 skin (its hand's verts' centroid off the elbow), in his own frame. */
function elbows(p, v2, hands) {
  const H = p.humanoid, root = p.char.root, inv = root.getWorldQuaternion(new T.Quaternion()).invert();
  root.updateMatrixWorld(true); H.body.skeleton.update();
  const at = (b) => root.worldToLocal(b.getWorldPosition(new T.Vector3()));
  const out = {};
  for (const s of ['l', 'r']) {
    const U = H.b[`upperarm_${s}`], L = H.b[`lowerarm_${s}`], W = H.b[`hand_${s}`];
    const front = new T.Vector3(0, 0, 1).applyQuaternion(U.getWorldQuaternion(new T.Quaternion()).premultiply(inv).multiply(H.rest.get(U).q.clone().invert()));
    const u = at(L).sub(at(U)).normalize(), elbow = at(L);
    const hand = hands[s].reduce((c, i) => c.add(root.worldToLocal(v2.applyBoneTransform(i, new T.Vector3().fromBufferAttribute(v2.geometry.attributes.position, i)).applyMatrix4(v2.matrixWorld))), new T.Vector3()).divideScalar(hands[s].length);
    out[s] = { b3: bendOf(u, at(W).sub(elbow).normalize(), front), v2: bendOf(u, hand.clone().sub(elbow).normalize(), front), handOff: hand.distanceTo(at(W)) };
  }
  return out;
}

const GAITS = [['standing (the idle)', 4 * 60, () => ({})], ['walking', 3 * 60, () => ({ y: 1 })], ['running', 3 * 60, () => ({ y: 1, run: true })]];
for (const [name, frames, drive] of GAITS) {
  test(`the game's clips bend the v2 elbows as B3's, forward: ${name}`, { timeout: 300000 }, async () => {
    const { p, v2 } = traveller(), dt = 1 / 60;
    // his hands on the v2 skin: the verts weighted mostly to each hand bone
    const bones = p.humanoid.body.skeleton.bones, w = v2.geometry.attributes.skinWeight, si = v2.geometry.attributes.skinIndex;
    const hands = Object.fromEntries(['l', 'r'].map((s) => {
      const h = bones.findIndex((b) => b.name === `hand_${s}`), ids = [];
      for (let i = 0; i < w.count; i++) for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === h && w.getComponent(i, k) > 0.6) ids.push(i);
      return [s, ids];
    }));
    assert.ok(hands.l.length > 20 && hands.r.length > 20, 'hand verts to follow');
    const rest = elbows(p, v2, hands);
    let bent = 0, worstOff = 0;
    for (let i = 0; i < frames; i++) {
      p.update(dt, drive(i * dt), CAM_PLUS_Z); p.object.updateMatrixWorld(true);
      p.character.updateHands();
      if (i < 30 || i % 6) continue;
      const m = elbows(p, v2, hands);
      for (const s of ['l', 'r']) {
        worstOff = Math.max(worstOff, Math.abs(m[s].handOff - rest[s].handOff));
        if (m[s].b3.deg < 15) continue;   // (near straight: no side to bend to)
        bent++;
        const say = `${s} elbow at ${i} (${name}): B3 bent ${m[s].b3.deg.toFixed(0)}° toward his front ${m[s].b3.lean.toFixed(2)}, v2 ${m[s].v2.deg.toFixed(0)}° ${m[s].v2.lean.toFixed(2)}`;
        assert.ok(m[s].b3.lean > 0, `B3 bends backwards: ${say}`);
        assert.ok(m[s].v2.lean > 0, `v2 bends backwards: ${say}`);
      }
    }
    assert.ok(bent > 0, `${name}: the elbows bent at some point`);
    assert.ok(worstOff < 0.03, `${name}: the v2 hand left B3's hand bone by ${(worstOff * 100).toFixed(1)} cm`);
  });
}
