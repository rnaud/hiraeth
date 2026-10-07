// Mixamo's downloads through the motion pipeline (scripts/mocap/): what broke when the first batch
// came in (docs/systems/animation.md, "Motion capture"), on made-up takes (the FBX files themselves
// are git-ignored), and what the shipped moves file must hold.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bvhTake } from '../scripts/mocap/bvh.js';
import { targetSkeleton, retarget, BONES } from '../scripts/mocap/retarget.js';
import { cleanClip, wholeLoop, footContacts } from '../scripts/mocap/process.js';
import { libraryFrom } from '../src/animator.js';
import { attachMotion } from '../src/motion-match.js';

const parse = async (name) => {
  const b = await readFile(new URL(`../public/anim/${name}`, import.meta.url));
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
};

/** A BVH with Mixamo's names (cm, a T-pose at rest); frames: [{ hips: [x, y, z] position (from the rest), pitch: the hips' x turn (deg), yaw (deg), thigh: the left thigh's x turn }]. */
function bvh(frames) {
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
  // (channels: Z X Y rotation order, as written above)
  const line = (f) => order.map((n) => (n === 'Hips' ? `${(f.hips ?? [0, 0, 0]).join(' ')} 0 ${f.pitch ?? 0} ${f.yaw ?? 0}` : n === 'LeftUpLeg' ? `0 ${f.thigh ?? 0} 0` : '0 0 0')).join(' ');
  text += `MOTION\nFrames: ${frames.length}\nFrame Time: 0.0333333333333\n${frames.map(line).join('\n')}\n`;
  return text;
}

let T = null;
const target = async () => (T ??= targetSkeleton((await parse('ual.glb')).scene));

test('a take ends on its own last frame, not on its first again (the clip held at its end, not wrapped round)', () => {
  const take = bvhTake(bvh([{ thigh: 0 }, { thigh: -20 }, { thigh: -40 }, { thigh: -60, hips: [0, 0, 30] }]), { fps: 30, name: 'end' });
  const dir = (i) => take.point('LeftLeg', i).sub(take.point('LeftUpLeg', i)).normalize();
  const raised = dir(take.n - 1).angleTo(new THREE.Vector3(0, -1, 0)) * 180 / Math.PI;
  assert.ok(Math.abs(raised - 60) < 2, `the last frame's thigh raised 60° (${raised.toFixed(1)}°: 0 was the first frame's, wrapped round)`);
  assert.ok(take.point("Hips", take.n - 1).z > take.point("Hips", 0).z + 25, 'and the hips where it ended, not back at the start');
});

test('the take is stood up by its rest pose, not by its first frame (a run leans into its stride, a get-up lies down)', () => {
  // a body lying on its back from the first frame: its hips pitched 90° back, 15 cm off the floor
  const take = bvhTake(bvh([{ pitch: -90, hips: [0, -80, 0] }, { pitch: -90, hips: [0, -80, 0] }]), { fps: 30, name: 'lying' });
  const up = take.point('Head', 0).sub(take.point('Hips', 0)).normalize();
  assert.ok(Math.abs(up.y) < 0.2, `it still lies down (the hips to the head ${(Math.asin(up.y) * 57.3).toFixed(0)}° up: stood up by its first frame it was 90°)`);
  assert.ok(take.point("Hips", 0).y < 30, "its hips on the floor (cm)");
});

test('a get-up keeps its root where it ends, a still clip its root still; a whole Mixamo cycle loops as it is', async () => {
  const frames = [];
  for (let i = 0; i < 40; i++) frames.push({ hips: [0, -80 + i * 2, i * 1.5], pitch: -90 * (1 - i / 39) });
  const take = bvhTake(bvh(frames), { fps: 30, name: 'rise' });
  const Tg = await target();
  const free = retarget(take, Tg), end = retarget(take, Tg, { root: 'end' }), fixed = retarget(take, Tg, { root: 'fixed' });
  const at = (r, i) => [r.root[i * 3], r.root[i * 3 + 1], r.root[i * 3 + 2]], L = free.n - 1;
  assert.ok(Math.abs(at(free, 0)[1] - at(free, L)[1]) > 0.3, 'a free root follows the hips (here 0.6 m)');
  for (let i = 0; i < L; i += 13) assert.deepEqual(at(end, i), at(end, L), `'end': the root at its last place on frame ${i}`);
  assert.ok(Math.abs(at(fixed, 0)[1] - (at(free, 0)[1] + at(free, L)[1]) / 2) < 0.1, "'fixed': about the middle of its travel");
  // the pelvis carries the travel instead: behind the root at first, over it at the end
  const d0 = Math.hypot(...[0, 1, 2].map((k) => end.pelvisPos[k] - free.pelvisPos[k]));
  assert.ok(d0 > 0.3, `the pelvis away from the held root at the start (${d0.toFixed(2)} m further than from a free one)`);
  // a turn on the spot is motion: not trimmed away as a still end (cleanClip turnMoves)
  const turn = [];
  for (let i = 0; i < 30; i++) turn.push({ yaw: i * 3 });
  const r = retarget(bvhTake(bvh(turn), { fps: 30, name: 'turn' }), Tg);
  r.contact = footContacts(r);
  assert.ok((cleanClip(r, { minLength: 0.5 })[0]?.n ?? 0) <= 21, 'without: trimmed as a still end, to its last 0.7 s');
  assert.equal(cleanClip(r, { minLength: 0.5, turnMoves: true })[0]?.n, 30, 'with: all of the turn kept');
  const loop = wholeLoop(r);
  assert.equal(loop.n, 29, 'a whole cycle less its last frame (the first again)');
});

test('the shipped moves: get-ups, jumps, the stumble, the idles, the kneel and the petting, each with the head\'s turn and its contacts', async () => {
  const lib = libraryFrom(await parse('ual.glb'));
  attachMotion(lib, await parse('moves.glb'));
  const names = lib.motion.clips.map((c) => c.name);
  for (const n of ['get_up_back', 'get_up_stomach', 'jump_up', 'forward_running_jump', 'jump_down_low', 'jump_from_wall', 'jogging_stumble', 'breathing_idle', 'looking_around', 'kneeling_inspecting', 'petting_animal']) {
    const c = lib.motion.clips.find((x) => x.name === `mixamo_${n}`);
    assert.ok(c, `${n} in moves.glb (${names.join(', ')})`);
    assert.ok(c.tracks.some((t) => t.name === 'Head.quaternion'), `${n}: the head's own turn`);
    assert.ok(!c.tracks.some((t) => t.name.startsWith('root_motion.')), `${n}: no ground track (the controller moves the body)`);
    assert.ok(c.userData.contact?.l, `${n}: its feet's contacts`);
    assert.ok(c.duration > 0.8, `${n}: ${c.duration.toFixed(2)} s`);
  }
  for (const b of BONES.filter((k) => !/clavicle/.test(k))) assert.ok(lib.motion.clips[0].tracks.some((t) => t.name === `${b}.quaternion`), `${b} animated`);
});
