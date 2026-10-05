import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { parseASF, asfAmcTake } from '../scripts/mocap/asf-amc.js';
import { bvhTake } from '../scripts/mocap/bvh.js';
import { mirrorTake, resampleTake } from '../scripts/mocap/take.js';
import { otherSide, mapFor } from '../scripts/mocap/maps.js';
import { targetSkeleton, retarget, TRACKS, BONES } from '../scripts/mocap/retarget.js';
import { footContacts, findLoop } from '../scripts/mocap/process.js';
import { writeGLB } from '../scripts/mocap/glb.js';
import { loadAssets, course, traveller, drive, timeToFace } from './gait-sim.js';
import { MotionMatcher, MATCH } from '../src/motion-match.js';
import { walkFor } from '../src/locomotion.js';
import { mulberry32 } from '../src/noise.js';

// The motion capture (scripts/mocap/: CMU's ASF/AMC, BVH, Mixamo's FBX onto the clip library's
// skeleton, public/anim/locomotion.glb and walks.glb) and what the game does with it: motion
// matching for the traveller (src/motion-match.js, off by default) and the people's own captured
// walks (Animator.useWalk, locomotion.js walkFor). The raw downloads aren't in the repository, so
// the pipeline is tested on small made-up files and the shipped library is tested as built.

const parse = async (name) => {
  const b = await readFile(new URL(`../public/anim/${name}`, import.meta.url));
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
};

// a two-bone ASF: a femur hanging straight down, a tibia under it, in inches at length 0.45
const ASF = `:version 1.10
:name test
:units
  mass 1.0
  length 0.45
  angle deg
:root
   order TX TY TZ RX RY RZ
   axis XYZ
   position 0 0 0
   orientation 0 0 0
:bonedata
  begin
     id 1
     name lfemur
     direction 0 -1 0
     length 10
     axis 0 0 0  XYZ
    dof rx ry rz
  end
  begin
     id 2
     name ltibia
     direction 0 -1 0
     length 10
     axis 0 0 0  XYZ
    dof rx
  end
:hierarchy
  begin
    root lfemur
    lfemur ltibia
  end
`;
const AMC = `:FULLY-SPECIFIED
:DEGREES
1
root 0 20 0 0 0 0
lfemur 0 0 0
ltibia 0
2
root 0 20 0 0 0 0
lfemur -90 0 0
ltibia 0
3
root 0 20 0 0 0 0
lfemur 0 0 0
ltibia 90
`;

test('ASF/AMC: CMU units to metres, rotations about x then y then z, bones end where they should', () => {
  const S = parseASF(ASF);
  assert.ok(Math.abs(S.unit - 0.0254 / 0.45) < 1e-9, 'length 0.45: x (1 / 0.45) x 2.54 / 100 m (the database FAQ)');
  const t = asfAmcTake(ASF, AMC, { fps: 120 });
  assert.equal(t.n, 3);
  const L = 10 * S.unit, p = (k, i) => t.point(k, i);
  assert.ok(Math.abs(p('root', 0).y - 20 * S.unit) < 1e-6, 'the root at its height');
  assert.ok(p('lfemur', 0).distanceTo(new THREE.Vector3(0, 20 * S.unit - L, 0)) < 1e-6, 'standing: the knee straight below');
  // -90 about x swings the thigh forward (+z: the subject faces +z) and the shin with it
  const knee = p('lfemur', 1).sub(p('root', 1));
  assert.ok(knee.z > L * 0.99 && Math.abs(knee.y) < 1e-6, `thigh raised forward (${knee.toArray().map((x) => x.toFixed(3))})`);
  // the knee bent 90: the shin goes back (-z) under a vertical thigh
  const shin = p('ltibia', 2).sub(p('lfemur', 2));
  assert.ok(shin.z < -L * 0.99, 'shin bent back');
});

test('a take in a mirror: left and right swap, x flips, rotations mirror', () => {
  const t = asfAmcTake(ASF, AMC, { fps: 120 });
  t.points.rfemur = t.points.lfemur; t.rotations.rfemur = t.rotations.lfemur;   // (a stand-in right side)
  const m = mirrorTake(t, otherSide);
  assert.equal(otherSide('lfemur'), 'rfemur'); assert.equal(otherSide('lowerback'), 'lowerback'); assert.equal(otherSide('LeftArm'), 'RightArm');
  const a = t.point('lfemur', 1), b = m.point('rfemur', 1);
  assert.ok(Math.abs(a.x + b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.z - b.z) < 1e-6, 'the other side, x flipped');
  const q = t.rotation('lfemur', 1), r = m.rotation('rfemur', 1);
  assert.ok(Math.abs(q.x - r.x) < 1e-6 && Math.abs(q.y + r.y) < 1e-6 && Math.abs(q.z + r.z) < 1e-6, '(x, y, z, w) -> (x, -y, -z, w)');
  const half = resampleTake(t, 60);
  assert.equal(half.n, 2, 'resampled: 3 frames at 120 fps -> 2 at 60');
});

// a BVH with Mixamo's names, in centimetres, standing in a T-pose; frame 1 raises the left thigh
function mixamoBVH() {
  const J = [
    ['Hips', null, [0, 95, 0]], ['Spine', 'Hips', [0, 10, 0]], ['Spine1', 'Spine', [0, 12, 0]], ['Spine2', 'Spine1', [0, 12, 0]],
    ['Neck', 'Spine2', [0, 15, 0]], ['Head', 'Neck', [0, 10, 0]], ['HeadTop_End', 'Head', [0, 18, 0]],
    ...['Left', 'Right'].flatMap((S) => {
      const x = S === 'Left' ? 1 : -1;
      return [[`${S}Shoulder`, 'Spine2', [6 * x, 12, 0]], [`${S}Arm`, `${S}Shoulder`, [12 * x, 0, 0]], [`${S}ForeArm`, `${S}Arm`, [27 * x, 0, 0]],
        [`${S}Hand`, `${S}ForeArm`, [26 * x, 0, 0]], [`${S}HandMiddle1`, `${S}Hand`, [9 * x, 0, 0]],
        [`${S}UpLeg`, 'Hips', [9 * x, -5, 0]], [`${S}Leg`, `${S}UpLeg`, [0, -42, 0]], [`${S}Foot`, `${S}Leg`, [0, -40, 0]],
        [`${S}ToeBase`, `${S}Foot`, [0, -6, 13]], [`${S}Toe_End`, `${S}ToeBase`, [0, 0, 7]]];
    }),
  ];
  const kids = (n) => J.filter((j) => j[1] === n);
  let text = 'HIERARCHY\n';
  const order = [];
  const write = ([n, , o], depth, root) => {
    const pad = '  '.repeat(depth);
    text += `${pad}${root ? 'ROOT' : 'JOINT'} ${n}\n${pad}{\n${pad}  OFFSET ${o.join(' ')}\n`;
    text += `${pad}  CHANNELS ${root ? '6 Xposition Yposition Zposition ' : '3 '}Zrotation Xrotation Yrotation\n`;
    order.push(n);
    const k = kids(n);
    if (k.length) for (const c of k) write(c, depth + 1, false);
    else text += `${pad}  End Site\n${pad}  {\n${pad}    OFFSET 0 5 0\n${pad}  }\n`;
    text += `${pad}}\n`;
  };
  write(J[0], 0, true);
  const frame = (thigh) => order.map((n) => (n === 'Hips' ? '0 95 0 0 0 0' : n === 'LeftUpLeg' ? `0 ${thigh} 0` : '0 0 0')).join(' ');
  text += `MOTION\nFrames: 3\nFrame Time: 0.0333333\n${frame(0)}\n${frame(-40)}\n${frame(-40)}\n`;
  return text;
}

test('BVH (Mixamo names) onto the clip library\'s skeleton: the legs point where the source\'s do', async () => {
  const { lib } = await loadAssets();
  const take = bvhTake(mixamoBVH(), { fps: 30, name: 'test' });
  assert.ok(mapFor(Object.keys(take.points)), 'Mixamo\'s rig is recognised');
  const T = targetSkeleton(lib.scene);
  const r = retarget(take, T);
  // pose a copy of the library skeleton with frame 1 and compare the thigh's direction with the source's
  const sk = lib.scene.clone(true), by = (n) => sk.getObjectByName(n);
  for (const k of TRACKS) by(k).quaternion.fromArray(r.local[k], 4);
  by('pelvis').position.fromArray(r.pelvisPos, 3);
  sk.updateMatrixWorld(true);
  const dir = (a, b) => by(b).getWorldPosition(new THREE.Vector3()).sub(by(a).getWorldPosition(new THREE.Vector3())).normalize();
  const src = take.point('LeftLeg', 1).sub(take.point('LeftUpLeg', 1)).normalize();
  const yaw = r.root[3 + 2], want = src.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
  const got = dir('thigh_l', 'calf_l');
  assert.ok(got.angleTo(want) < 0.03, `the thigh as raised (${(got.angleTo(want) * 57.3).toFixed(1)}° off)`);
  assert.ok(Math.abs(got.angleTo(new THREE.Vector3(0, -1, 0)) - 40 * Math.PI / 180) < 0.05, 'raised 40°');
  assert.ok(dir('thigh_r', 'calf_r').y < -0.99, 'the other leg still hangs straight');
});

test('the library file: normalised 16-bit rotations come back within a hair, tags in userData', async () => {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -1.1, 0.7));
  const data = new Float32Array(8);
  q.toArray(data, 0); q.toArray(data, 4);
  const glb = writeGLB({ nodes: [{ name: 'root_motion', parent: -1 }, { name: 'pelvis', parent: 0 }], clips: [{ name: 'c', fps: 30, n: 2, extras: { use: 'mm', segments: [{ name: 's', start: 0, n: 2 }] }, channels: [{ node: 1, path: 'rotation', data }, { node: 1, path: 'translation', data: new Float32Array([0, 1, 2, 3, 4, 5]) }] }] });
  const g = await new GLTFLoader().parseAsync(glb.buffer, '');
  const clip = g.animations[0], t = clip.tracks.find((x) => x.name === 'pelvis.quaternion');
  const err = Math.max(...q.toArray().map((x, i) => Math.abs(x - t.values[4 + i])));
  assert.ok(err < 1e-4, `each component within ${err.toExponential(1)} (1/32767 a step)`);
  assert.equal(clip.userData.use, 'mm');
  assert.equal(clip.duration.toFixed(4), (1 / 30).toFixed(4));
});

test('the shipped motion: the matching database (mirrored), the people\'s walks, the studio\'s list', async () => {
  const { lib } = await loadAssets();
  const M = lib.motion, db = M.db;
  assert.ok(db && db.n > 8000, `database frames, mirror included (${db.n})`);
  assert.equal(db.segments.filter((s) => s.mirrored).length, db.segments.length / 2, 'every clip and its mirror image');
  assert.ok(db.segments.some((s) => s.loop), 'steady walks and runs loop');
  for (let j = 0; j < db.n; j += 97) for (let d = 0; d < db.F; d++) assert.ok(Number.isFinite(db.feat[j * db.F + d]), 'features are numbers');
  // a frame's own features find that frame (or one as close)
  const j = db.segments[3].start + 5, q = db.feat.slice(j * db.F, (j + 1) * db.F);
  const best = db.search(q);
  assert.ok(best.cost <= db.bias[j] + 1e-6, `a frame matches itself (cost ${best.cost.toFixed(4)})`);
  // a mirrored frame turns the other way
  const turnL = db.segments.find((s) => !s.mirrored && s.turn > 1.2);
  const turnR = db.segments.find((s) => s.mirrored && s.name === turnL.name);
  assert.ok(db.root[(turnL.end - 1) * 3 + 2] > 1 && db.root[(turnR.end - 1) * 3 + 2] < -1, 'a left turn and its mirror, a right one');
  assert.ok(M.walks.length >= 8, `walks (${M.walks.length})`);
  for (const w of M.walks) { assert.ok(w.speed > 0.3 && w.speed < 2.5, `${w.name}: walks at ${w.speed} m/s`); assert.ok(w.contact.l.some((x) => x > 0.5) && w.contact.r.some((x) => x > 0.5), `${w.name}: both feet come down`); }
  assert.ok(M.all.length > db.segments.length / 2, 'every take listed for the studio');
});

test('the matcher picks standing, walking and jogging by the stick, and has nothing for a sprint', async () => {
  const { lib } = await loadAssets();
  const mm = new MotionMatcher(lib.motion.db);
  const run = (want, secs = 2) => {
    let v = 0;
    for (let i = 0; i < secs * 60; i++) { v += (want - v) * (1 - Math.exp(-8 / 60)); mm.update(1 / 60, { vel: { x: 0, z: v }, want: { x: 0, z: want }, k: 8 }, 1); }
  };
  run(0); assert.ok(mm.speed < 0.3, `standing: a standing frame (${mm.speed.toFixed(2)} m/s)`);
  run(1.2); assert.ok(mm.speed > 0.8 && mm.speed < 1.7, `walking 1.2 m/s: a walk (${mm.speed.toFixed(2)})`);
  run(3.5); assert.ok(mm.speed > 2.5 && mm.speed < 4.6, `jogging 3.5 m/s: a jog (${mm.speed.toFixed(2)})`);
  assert.ok(mm.cost < MATCH.maxCost, 'and a close one');
  run(7.2); assert.ok(mm.cost > MATCH.maxCost, `sprinting 7.2 m/s: nothing close (cost ${mm.cost.toFixed(1)}): the loops take it`);
  // jumps are inertialised: the pose never turns a bone more than a little in a frame
  mm.reset();
  const prev = new Float32Array(mm.outQ.length);
  let worst = 0, v = { x: 0, z: 0 };
  for (const [want, secs] of [[{ x: 0, z: 1.3 }, 1], [{ x: 1.3, z: 0 }, 0.6], [{ x: 0, z: 3.5 }, 1], [{ x: 0, z: 0 }, 1]]) {
    for (let i = 0; i < secs * 60; i++) {
      v.x += (want.x - v.x) * 0.125; v.z += (want.z - v.z) * 0.125;
      mm.update(1 / 60, { vel: v, want, k: 8 }, 1);
      if (i || secs < 1) for (let b = 0; b < mm.outQ.length / 4; b++) {
        const d = Math.abs(prev[b * 4] * mm.outQ[b * 4] + prev[b * 4 + 1] * mm.outQ[b * 4 + 1] + prev[b * 4 + 2] * mm.outQ[b * 4 + 2] + prev[b * 4 + 3] * mm.outQ[b * 4 + 3]);
        worst = Math.max(worst, 2 * Math.acos(Math.min(1, d)));
      }
      prev.set(mm.outQ);
    }
  }
  assert.ok(mm.jumps > 3, `it jumped (${mm.jumps})`);
  assert.ok(worst < 0.5, `no bone turns more than half a radian in a frame (${worst.toFixed(2)})`);
});

test('motion matching on the traveller: the feet stay planted, the turn answers as fast as before', async () => {
  const W = { KeyW: true }, R = { KeyW: true, ShiftLeft: true }, SR = { KeyS: true, ShiftLeft: true }, none = {};
  const p = await traveller(course(), new THREE.Vector3(0, 0, -60), { matching: true });
  const r = drive(p, [[1, none, 'idle'], [2, W, 'walk'], [2, R, 'run'], [1.5, SR, 'turn180'], [2.5, none, 'stop']]);
  console.log(`  matching: slide max ${r.maxSlide.toFixed(3)} mean ${r.meanSlide.toFixed(3)}, held ${r.heldSlide.toFixed(4)}, sink ${r.sink.toFixed(3)}, jerk ${r.jitterHead.toFixed(2)}`);
  const share = r.frames.filter((f) => f.mmW > 0.5).length / r.frames.length;
  assert.ok(share > 0.4, `the matcher leads much of the run (${(share * 100).toFixed(0)} %), the sprint is the loops'`);
  assert.ok(r.frames.some((f) => f.tag === 'run' && f.mmW < 0.1), 'the sprint falls back to the loops');
  // (the loops measure better on most of these: docs/systems/animation.md, "Motion capture"; these bound regressions)
  assert.ok(r.maxSlide < 0.5 && r.meanSlide < 0.12, 'feet slide no more than they did when this was measured');
  assert.ok(r.heldSlide < 0.02, `planted feet stay put (${r.heldSlide.toFixed(4)})`);
  assert.ok(r.sink < 0.03, `no sole in the ground (${r.sink.toFixed(3)})`);
  assert.ok(r.maxTurn < 1.0, `no bone turns a radian in a frame (${r.maxTurn.toFixed(2)})`);
  const t = timeToFace(r.frames, 5, Math.PI);
  assert.ok(t <= 0.35, `faces the new way in ${t.toFixed(2)} s, as with the loops (the matcher never moves the body)`);
});

test('people walk captured walks of their own: chosen by pace and who they are, seeded, and the library\'s again', async () => {
  const { lib } = await loadAssets();
  const walks = lib.motion.walks;
  const a = walkFor(walks, mulberry32(5), { speed: 1.0 }), b = walkFor(walks, mulberry32(5), { speed: 1.0 });
  assert.equal(a, b, 'seeded: the same person, the same walk');
  const picks = new Set(Array.from({ length: 60 }, (_, i) => walkFor(walks, mulberry32(i + 1), { speed: 1.0 })?.name ?? 'library'));
  assert.ok(picks.size >= 4, `different people, different walks (${[...picks].join(', ')})`);
  for (let i = 0; i < 40; i++) {
    const w = walkFor(walks, mulberry32(i + 100), { speed: 1.2 });
    if (w) assert.ok(1.2 / w.speed > 0.8 && 1.2 / w.speed < 1.25, `${w.name} at a pace near its own (${w.speed})`);
  }
  const old = Array.from({ length: 40 }, (_, i) => walkFor(walks, mulberry32(i + 300), { speed: 0.55, older: true })).filter(Boolean);
  assert.ok(old.some((w) => /old|elderly/.test(w.desc)), 'an older, slower walker may walk an old man\'s walk');
  // on a body: the walk swaps in and back out
  const { Animator } = await import('../src/animator.js');
  const { buildCharacter } = await import('../src/player.js');
  const an = new Animator(lib, buildCharacter());
  const w = walks.find((x) => /normal/.test(x.desc));
  an.useWalk(w);
  assert.equal(an.clips.walk, w.clip); assert.equal(an.walkName, w.name);
  assert.ok(an.gait.clips.walk.strideK === 1 && an.gait.clips.walk.contact.l.some((x) => x > 0.5), 'its stride as captured, its feet as labelled');
  an.useWalk(null);
  assert.equal(an.clips.walk, lib.clips.walk, 'and the library\'s walk again');
});

test('a person on a captured walk keeps their feet on the ground', async () => {
  const { walkPerson } = await import('../scripts/mocap/compare-people.mjs');
  const { lib } = await loadAssets();
  const w = lib.motion.walks.find((x) => x.name === 'cmu_91_29') ?? lib.motion.walks[0];
  const r = await walkPerson(w, { speed: 1.0 });
  console.log(`  ${w.name} (${w.desc}): slide ${r.maxSlide.toFixed(3)} / ${r.meanSlide.toFixed(3)}, held ${r.heldSlide.toFixed(4)}, sink ${r.sink.toFixed(3)}`);
  assert.ok(r.contacts >= 6, 'steps all along');
  assert.ok(r.maxSlide < 0.12, `no foot skids more than 12 cm over a contact (${r.maxSlide.toFixed(3)})`);
  assert.ok(r.heldSlide < 0.015, `planted feet stay put (${r.heldSlide.toFixed(4)})`);
  assert.ok(r.sink < 0.01, `no heel in the ground (${r.sink.toFixed(3)})`);
});

test('contacts and loops from a take: the ball low and still is down, a cycle found from touchdown to touchdown', () => {
  // a made-up retargeted walk: two feet alternating, 1 s cycle at 30 fps, the ball up 10 cm in swing
  const fps = 30, n = 120, feet = {};
  for (const k of ['ankleL', 'ankleR', 'ballL', 'ballR', 'toeL', 'toeR']) feet[k] = new Float32Array(n * 3);
  const local = Object.fromEntries(BONES.map((k) => [k, new Float32Array(n * 4)]));
  const root = new Float32Array(n * 3), pelvisPos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = i / fps;
    root[i * 3 + 1] = t;   // 1 m/s along +z
    for (const k of BONES) local[k].set([0, 0, 0, 1], i * 4);
    local.thigh_l.set([Math.sin(t * Math.PI) * 0.2, 0, 0, Math.cos(t * Math.PI) * 0.2 + 1].map((x, j, a) => x / Math.hypot(...a)), i * 4);
    for (const [f, ph] of [['L', 0], ['R', 0.5]]) {
      const c = ((t + ph) % 1) < 0.6;   // down 60 % of the cycle
      const z = c ? Math.floor(t + ph) + 0.3 : t + 0.3, y = c ? 0.015 : 0.1;
      feet[`ball${f}`].set([f === 'L' ? 0.1 : -0.1, y, z], i * 3);
      feet[`ankle${f}`].set([f === 'L' ? 0.1 : -0.1, y + 0.09, z - 0.15], i * 3);
    }
  }
  const r = { fps, n, local, pelvisPos, root, feet, scale: 1 };
  const c = footContacts(r);
  const on = (f) => Array.from(c[f]).filter((x) => x > 0.5).length / n;
  assert.ok(Math.abs(on('l') - 0.6) < 0.1 && Math.abs(on('r') - 0.6) < 0.1, `each foot down ~60 % of the time (${on('l').toFixed(2)}, ${on('r').toFixed(2)})`);
  r.contact = c;
  const loop = findLoop(r);
  assert.ok(loop && Math.abs(loop.n - fps) <= 1, `one cycle (${loop?.n} frames)`);
});
