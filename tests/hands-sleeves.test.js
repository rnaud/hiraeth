// The traveller's hands at the ends of his arms. (The author, on the Motion page: "What is wrong with our
// character's hands?": a hand floating in front of the coat at hip height, twisted inward, the other
// dangling below its sleeve, neither joined to its forearm.) Humanoid.update swung each forearm from the
// T-pose on its own, not from where the upper arm had carried it, so with the arm hanging and the forearm
// raised (the idle's gestures, a walk's swing) it took a roll of its own, up to 75° off the upper arm's:
// the elbow, the forearm and the rolled sleeve wrung round like a sweet wrapper and the clip's wrist
// (Humanoid.poseHands) sat 60–90° off the forearm, the hand turned on a pinched wrist. Measured here on the
// game's body (B3, src/characters/traveller.js) over the idle (with its gestures), a walk, a run, the calm of a conversation and the
// title's stance: the hand stays where it is on the forearm, the sleeve's cuff round the forearm, the
// wrist as thick as it is, the forearm's roll on the upper arm small.
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
const { isShirtColor } = await import('../src/characters/tripo-garment-geometry.js');
const { course, CAM_PLUS_Z } = await import('../src/gait-course.js');
const { holdStance } = await import('../src/title-world.js');

const parse = (file) => { const b = readFileSync(file); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
const assets = await travellerB3(), lib = libraryFrom(await parse('public/anim/ual.glb'));
// (B3's body keeps only some of its source's vertices, the shirt's hem and his head cut away: each one's colour found by
// its place in the source, which the cut leaves as it was)
const colorOf = (() => {
  let source = null; assets.gltf.scene.traverse((o) => { if (o.isSkinnedMesh) source = o.geometry.attributes.position; });
  const key = (a, i) => `${a.getX(i).toFixed(5)},${a.getY(i).toFixed(5)},${a.getZ(i).toFixed(5)}`, at = new Map();
  for (let i = 0; i < source.count; i++) at.set(key(source, i), i);
  return (pos, i) => assets.colors[at.get(key(pos, i))];
})();

/** The game's traveller (B3, src/characters/traveller.js) on the course, standing at the origin facing +z. */
async function traveller() {
  const scene = course(), physics = new Physics(scene);
  const p = new Player(physics, { climb: false, health: false });
  p.animator = new Animator(lib, p.char);
  p.character = createTraveller(p.char, assets);
  p.humanoid = p.character.humanoid;
  p.gear = { update() {}, device: { visible: true } };
  p._lastVel = new T.Vector3();
  p.pos.set(0, physics.groundAt(0, 5, 0), 0); p.heading = 0; p.vel.set(0, 0, 0); p.onGround = true; p.lastSafe.copy(p.pos);
  scene.add(p.object);
  return p;
}

/**
 * What to watch on each arm, picked on the bind pose (the T-pose, arms along x): the sleeve's cuff (the
 * coat-coloured vertices furthest out along the arm, its last 6 mm), the bare forearm just past it and
 * the wrist's ring of skin (within 1.5 cm of the wrist joint along the arm, short of the palm).
 */
async function arms(p) {
  const H = p.humanoid, mesh = p.character.mesh, pos = mesh.geometry.attributes.position;
  p.char.root.updateMatrixWorld(true);
  H.update(true); mesh.skeleton.update();
  const at = (i) => mesh.applyBoneTransform(i, new T.Vector3().fromBufferAttribute(pos, i)).applyMatrix4(mesh.matrixWorld);
  const out = {};
  for (const s of ['l', 'r']) {
    const sign = s === 'l' ? 1 : -1;
    const elbow = H.b[`lowerarm_${s}`].getWorldPosition(new T.Vector3()), wrist = H.b[`hand_${s}`].getWorldPosition(new T.Vector3());
    const along = (v) => (v.x - elbow.x) * sign, reach = along(wrist);
    const near = [];
    for (let i = 0; i < pos.count; i++) {
      const c = colorOf(pos, i);
      if (!c) continue;
      const v = at(i), a = along(v);
      if (a < 0.02 || a > reach + 0.02 || Math.hypot(v.y - wrist.y, v.z - wrist.z) > 0.07) continue;
      near.push({ i, a, shirt: coat(c), v });
    }
    const cuffAt = Math.max(...near.filter((n) => n.shirt).map((n) => n.a));
    const cuff = near.filter((n) => n.shirt && n.a > cuffAt - 0.006).map((n) => n.i);
    const ring = near.filter((n) => !n.shirt && Math.abs(n.a - (reach - 0.008)) < 0.008).map((n) => n.i);
    assert.ok(cuff.length >= 8 && ring.length >= 8, `${s}: a cuff (${cuff.length}) and a wrist (${ring.length}) to watch`);
    out[s] = { cuff, ring, at, sign };
  }
  // the same measures at rest, to compare each pose's with
  const rest = measure(p, out);
  return { sides: out, rest };
}
// (the coat's coral against his bare forearm's brown: both pass the overshirt's own isShirtColor; the green against the red tells them apart)
const coat = ([r, g, b]) => isShirtColor([r, g, b]) && g < r * 0.6;
const centroid = (ids, at) => ids.reduce((c, i) => c.add(at(i)), new T.Vector3()).divideScalar(ids.length);
const spread = (ids, at) => { const c = centroid(ids, at); return ids.reduce((s, i) => s + at(i).distanceTo(c), 0) / ids.length; };
const axisOff = (p, a, b) => { const ab = b.clone().sub(a), t = T.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
/** The forearm's roll on the upper arm, or the hand's on the forearm (about the child's own bone), off the rest's, in degrees. */
function roll(H, parent, child, next) {
  const R = H.rest, root = H.char.root.getWorldQuaternion(new T.Quaternion()).invert();
  const cq = (b) => b.getWorldQuaternion(new T.Quaternion()).premultiply(root);
  const now = cq(parent).invert().multiply(cq(child)), was = R.get(parent).q.clone().invert().multiply(R.get(child).q);
  const d = was.invert().multiply(now);
  const axis = R.get(next).p.clone().sub(R.get(child).p).normalize().applyQuaternion(R.get(child).q.clone().invert());
  // (the shorter way round, as Humanoid.shareWristRoll takes it: q and -q are the same turn; B3's left wrist read 302° for 58°)
  const sg = d.w < 0 ? -1 : 1, k = (d.x * axis.x + d.y * axis.y + d.z * axis.z) * sg;
  return Math.abs(2 * Math.atan2(k, d.w * sg) * 180 / Math.PI);
}
function measure(p, sides) {
  const H = p.humanoid, mesh = p.character.mesh;
  mesh.skeleton.update();
  const out = {};
  for (const [s, A] of Object.entries(sides)) {
    const elbow = H.b[`lowerarm_${s}`].getWorldPosition(new T.Vector3()), wrist = H.b[`hand_${s}`].getWorldPosition(new T.Vector3());
    const cuff = centroid(A.cuff, A.at);
    out[s] = {
      handToCuff: wrist.distanceTo(cuff),            // the hand where it is on the forearm, the cuff where it is
      cuffOffArm: axisOff(cuff, elbow, wrist),        // the sleeve's opening round the forearm, not off to one side
      wrist: spread(A.ring, A.at),                    // the wrist's thickness (a wrung wrist thins)
      elbowRoll: roll(H, H.b[`upperarm_${s}`], H.b[`lowerarm_${s}`], H.b[`hand_${s}`]),
      wristRoll: roll(H, H.b[`lowerarm_${s}`], H.b[`hand_${s}`], H.b[`middle_01_${s}`]),
      // how far out to its own side of the hips the wrist is (in the body's frame): by the thigh, not across the front
      out: p.char.root.worldToLocal(wrist.clone()).sub(p.char.root.worldToLocal(H.b.pelvis.getWorldPosition(new T.Vector3()))).x * A.sign,
    };
  }
  return out;
}

/** Run `frames` steps of `drive` on a fresh traveller and gather the worst of each measure, by side. */
async function worst(name, frames, drive, { setup, legacy = false } = {}) {
  const p = await traveller(), dt = 1 / 60;
  setup?.(p);
  if (legacy) { const plan = p.humanoid._plan = p.humanoid.planBones(); for (const r of plan) r.hinge = null; p.humanoid.shareWristRoll = () => {}; p.character.beltHook = true; }
  const { sides, rest } = await arms(p);
  const W = {};
  for (let i = 0; i < frames; i++) {
    p.update(dt, drive(i * dt), CAM_PLUS_Z); p.object.updateMatrixWorld(true);
    p.character.updateHands();
    if (i % 6) continue;
    const m = measure(p, sides);
    for (const s of ['l', 'r']) {
      const w = W[s] ??= { handToCuff: 0, cuffOffArm: 0, wrist: Infinity, elbowRoll: 0, wristRoll: 0, out: Infinity };
      w.handToCuff = Math.max(w.handToCuff, Math.abs(m[s].handToCuff - rest[s].handToCuff));
      w.cuffOffArm = Math.max(w.cuffOffArm, m[s].cuffOffArm - rest[s].cuffOffArm);
      w.wrist = Math.min(w.wrist, m[s].wrist / rest[s].wrist);
      w.elbowRoll = Math.max(w.elbowRoll, m[s].elbowRoll);
      w.wristRoll = Math.max(w.wristRoll, m[s].wristRoll);
      w.out = Math.min(w.out, m[s].out);
    }
  }
  return { name, W };
}

const POSES = [
  ['standing (the idle and its gestures)', 12 * 60, () => ({})],
  ['walking', 3 * 60, () => ({ y: 1 })],
  ['running', 3 * 60, () => ({ y: 1, run: true })],
  ['in a conversation (held calm)', 4 * 60, () => ({}), { setup: (p) => { p.talking = true; } }],
  ['the title stance', 3 * 60, () => ({}), { setup: (p) => { p.talking = true; p.character.poseArms = (q) => { holdStance(q.char, q.time); return []; }; } }],
];
// (the hand to the cuff: the rolled sleeve slides up to 2 cm along the forearm as the elbow bends, the skin's
// own blend at the elbow, before and after; past 2.5 cm the hand has left the arm. The wrist out from the
// hips' middle: 21 cm or more by the thigh; standing, the old belt hook drew it across to 13)
// The rolls off the T-pose: v1's under 40° and 45°; B3's clip pronation, shared half and half by the forearm and the
// wrist (Humanoid.shareWristRoll), is 48–67° each, the sleeve's cuff and the wrist's skin unwrung by it (above))
const LIMIT = { handToCuff: 0.025, cuffOffArm: 0.015, wrist: 0.85, elbowRoll: 70, wristRoll: 70, out: 0.17 };
const ok = (w) => w.out > LIMIT.out && w.handToCuff < LIMIT.handToCuff && w.cuffOffArm < LIMIT.cuffOffArm && w.wrist > LIMIT.wrist && w.elbowRoll < LIMIT.elbowRoll && w.wristRoll < LIMIT.wristRoll;
const say = (w) => `hand to cuff ±${(w.handToCuff * 100).toFixed(1)} cm, cuff off the forearm +${(w.cuffOffArm * 100).toFixed(1)} cm, wrist ×${w.wrist.toFixed(2)}, forearm roll ${w.elbowRoll.toFixed(0)}°, wrist roll ${w.wristRoll.toFixed(0)}°, the wrist ${(w.out * 100).toFixed(0)} cm out from the hips' middle at the least`;

for (const [name, frames, drive, opts] of POSES) {
  test(`the hands stay at the ends of the sleeves: ${name}`, { timeout: 300000 }, async () => {
    const { W } = await worst(name, frames, drive, opts);
    if (process.env.SAY) console.log(name, say(W.l), "/", say(W.r));
    for (const s of ['l', 'r']) assert.ok(ok(W[s]), `${s === 'l' ? 'left' : 'right'} arm, ${name}: ${say(W[s])}`);
  });
}

test('the measure sees the old twist (each forearm swung from the T-pose on its own)', { timeout: 300000 }, async () => {
  const { W } = await worst('standing, the old way', 12 * 60, () => ({}), { legacy: true });
  if (process.env.SAY) console.log('legacy', say(W.l), '/', say(W.r));
  assert.ok(!ok(W.l) || !ok(W.r), `the old arms pass: ${say(W.l)} / ${say(W.r)}`);
});
