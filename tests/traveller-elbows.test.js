// The v2 traveller's elbows and knees bend the right way (#548; the author: "in the outfits you are showing me why
// are the arms bent backwards?"). The cause was the previews' lowered pose (scripts/blender/traveller/poses.py,
// LOWERED, and its copy in previews.py): the forearms' turns about the armature's z had their signs the wrong way
// round for a rig facing -y, so in every posed picture the elbows bent backwards, the hands out behind, palms
// forward. Measured here: that pose read from poses.py on the v2 skeleton's rest (bent forward now, the knee back);
// and the game's own clips (idle, walk, run) on B3 with the v2 skin bound to its skeleton by bone name, as the
// outfits page binds it (src/characters/outfit-page.js): its forearms bend as B3's skeleton does, forward.
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
const manifest = JSON.parse(readFileSync(DIR + 'manifest.json', 'utf8'));

/** The lowered pose as poses.py writes it: { bone: [[axis, degrees], ...] } (a Python dict of tuples, read as JS). */
function lowered() {
  const src = readFileSync('scripts/blender/traveller/poses.py', 'utf8');
  const consts = Object.fromEntries([...src.matchAll(/^([A-Z_]+) = (-?[\d.]+)\b/gm)].map((m) => [m[1], Number(m[2])]));
  const text = /^LOWERED = (\{[\s\S]*?\})\n/m.exec(src)[1].replace(/\(/g, '[').replace(/\)/g, ']');
  const raw = new Function(...Object.keys(consts), `return ${text};`)(...Object.values(consts));
  // one turn [axis, deg] or a list of them
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v[1] === 'number' ? [v] : v]));
}
// Blender's frame (z up, facing -y) from the manifest's (the game's: y up, facing +z)
const blender = ([x, y, z]) => new T.Vector3(x, -z, y);
const head = (n) => blender(manifest.skeleton[n].head);
/** A bone's turns as one rotation in the armature's frame, made in order (poses.turn). */
const turned = (turns = []) => turns.reduce((q, [axis, deg]) => new T.Quaternion().setFromAxisAngle(new T.Vector3(...axis).normalize(), deg * Math.PI / 180).multiply(q), new T.Quaternion());
/** (degrees between the two bones, the lower one's lean toward the upper one's front) for a chain a → b → c. */
function bendOf(u, f, front) {
  const perp = f.clone().addScaledVector(u, -f.dot(u));
  return { deg: u.angleTo(f) * 180 / Math.PI, lean: perp.dot(front) };
}

test('the previews\' lowered pose bends the elbows forward and the knee back (poses.py)', () => {
  const P = lowered();
  for (const s of ['l', 'r']) {
    const qu = turned(P[`upperarm_${s}`]), qf = qu.clone().multiply(turned(P[`lowerarm_${s}`]));
    const u = head(`lowerarm_${s}`).sub(head(`upperarm_${s}`)).normalize().applyQuaternion(qu);
    const f = head(`hand_${s}`).sub(head(`lowerarm_${s}`)).normalize().applyQuaternion(qf);
    const b = bendOf(u, f, new T.Vector3(0, -1, 0).applyQuaternion(qu));
    assert.ok(b.deg > 20 && b.lean > 0.3, `elbow ${s}: bent ${b.deg.toFixed(0)}°, toward his front ${b.lean.toFixed(2)} (below 0: backwards)`);
  }
  const qt = turned(P.thigh_l), qc = qt.clone().multiply(turned(P.calf_l));
  const u = head('calf_l').sub(head('thigh_l')).normalize().applyQuaternion(qt);
  const f = head('foot_l').sub(head('calf_l')).normalize().applyQuaternion(qc);
  const b = bendOf(u, f, new T.Vector3(0, -1, 0).applyQuaternion(qt));
  assert.ok(b.deg > 20 && b.lean < -0.3, `knee l: bent ${b.deg.toFixed(0)}°, toward his front ${b.lean.toFixed(2)} (a knee bends back)`);
  // and the previews' own copy is that pose (previews.py once had its own, the same wrong signs)
  assert.match(readFileSync('scripts/blender/traveller/previews.py', 'utf8'), /\*\*PZ\.LOWERED/);
});

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
