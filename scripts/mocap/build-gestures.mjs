#!/usr/bin/env node
// The conversation gestures (issue #197): Mixamo's talking, waving, nodding, head shakes, the angry
// and the surprised ones (scripts/mocap/gesture-clips.json), retargeted onto the UAL skeleton as the
// other captured clips are (retarget.js), the body above the hips only, keyframe-reduced and packed
// into public/anim/gestures.glb, which src/talk-gesture.js plays over whoever speaks a line.
//
//   node scripts/mocap/build-gestures.mjs --from <folder of the single FBX downloads>
//   node scripts/mocap/build-gestures.mjs --stats      # what each clip became, nothing written
//
// The single downloads ("Y Bot@Talking.fbx", …) are read from --from (default data/mocap/mixamo/:
// git-ignored); the pack's clips from data/mocap/packs/gestures-basic.zip (kept, as the other packs).
// Same input, same bytes.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { targetSkeleton, retarget, BONES } from './retarget.js';
import { writeGLB } from './glb.js';
import { fbxTake } from './fbx.js';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../..');
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const FROM = resolve(opt('--from', resolve(ROOT, 'data/mocap/mixamo')));
const PACKS = resolve(ROOT, 'data/mocap/packs');
const OUT = resolve(ROOT, opt('--out', 'public/anim/gestures.glb'));
const STATS = args.includes('--stats');
const FPS = 30;

// What is shipped: the body above the hips. The legs, the hips' place and their own turn stay the
// idle's (a gesture's own steps and bounces would slide the planted feet); the hips' turn is folded
// into the spine's first joint instead, so a bow or a lean from the hips still shows. The shoulders
// (clavicles) are not stored: the retargeting holds them at rest, and the game reads only the arms' lines.
export const UPPER = ['spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r'];
// keyframe reduction: a frame is dropped when the slerp between the frames kept either side of it is
// within this of it (rad: 0.57°, a few millimetres at the end of an arm; 0.35° made the file 14 % bigger for nothing to see)
const TOL = 0.01;
// a loop's end is bent onto its start over its last this many seconds (Talking, Sad Idle, Thinking)
const CLOSE = 0.4;
// how far the hips' turn about the vertical may twist the chest on the legs (rad, approached softly: 23°)
const TWIST = 0.4;

const parseGLB = async (file) => { const b = await readFile(file); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
const T = targetSkeleton((await parseGLB(resolve(ROOT, 'public/anim/ual.glb'))).scene);
const table = JSON.parse(await readFile(resolve(HERE, 'gesture-clips.json'), 'utf8'));

async function bytesOf(row) {
  if (row.pack) {
    const zip = resolve(PACKS, `${row.pack}.zip`);
    if (!existsSync(zip)) throw new Error(`${row.pack}.zip is not in data/mocap/packs/`);
    return execFileSync('unzip', ['-p', zip, row.entry], { maxBuffer: 64 * 2 ** 20 });
  }
  const f = resolve(FROM, `${row.file}.fbx`);
  if (!existsSync(f)) throw new Error(`${row.file}.fbx is not in ${FROM}`);
  return readFile(f);
}

const _a = new THREE.Quaternion(), _b = new THREE.Quaternion(), _c = new THREE.Quaternion(), _d = new THREE.Quaternion();
const qAt = (arr, i, q) => q.fromArray(arr, i * 4);
const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));

/** Douglas–Peucker on a quaternion track: the frames to keep (the first and last always). */
export function reduceTrack(arr, n, tol = TOL) {
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    qAt(arr, a, _a); qAt(arr, b, _b);
    let worst = -1, at = -1;
    for (let i = a + 1; i < b; i++) {
      const e = angle(_c.copy(_a).slerp(_b, (i - a) / (b - a)), qAt(arr, i, _d));
      if (e > worst) { worst = e; at = i; }
    }
    if (worst > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  const keys = [];
  for (let i = 0; i < n; i++) if (keep[i]) keys.push(i);
  return keys;
}

/** One row -> { name, n, loop, tracks: { bone: Float32Array(n*4) }, stats }. */
async function convert(row) {
  const b = await bytesOf(row);
  const take = fbxTake(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), { fps: FPS, name: row.id });
  // (standing: the root held at its mean, smoothed as the captured idles are; the head's own turn kept)
  const r = retarget(take, T, { posSigma: 0.8, yawSigma: 0.8, root: 'fixed', head: true });
  const a = Math.round((row.from ?? 0) * FPS), z = Math.min(r.n, row.until ? Math.round(row.until * FPS) + 1 : r.n), n = z - a;
  const tracks = {};
  // the hips' turn from their rest, in the world (W0: the pelvis at rest in the world; D = pelvis_world W0^-1)
  const W0 = T.rootQ.clone().multiply(T.bones.pelvis.lq), W0i = W0.clone().invert();
  let twistMost = 0;
  const hipTurn = (i, out) => {
    const D = _c.copy(T.rootQ).multiply(qAt(r.local.pelvis, a + i, _d)).multiply(W0i);
    // its twist about the vertical held within TWIST (a gesture that turns the whole body away, Disappointed's,
    // would otherwise twist the chest 120° round on the planted legs), its lean and its bow kept
    const tw = _d.set(0, D.y, 0, D.w).normalize(), swing = D.clone().multiply(tw.clone().invert());
    let yaw = 2 * Math.atan2(tw.y, tw.w); yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    twistMost = Math.max(twistMost, Math.abs(yaw));
    const held = TWIST * Math.tanh(yaw / TWIST);
    return out.copy(swing).multiply(_d.setFromAxisAngle(new THREE.Vector3(0, 1, 0), held));
  };
  for (const k of UPPER) {
    const src = r.local[k], out = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      qAt(src, a + i, _a);
      // (the hips' turn folded into the spine's first joint: spine' = W0^-1 D W0 spine, so with the idle's hips
      // about their rest the chest leans and bows in the world as captured)
      if (k === 'spine_01') { const D = hipTurn(i, new THREE.Quaternion()); _a.premultiply(W0i.clone().multiply(D).multiply(W0)); }
      out.set([_a.x, _a.y, _a.z, _a.w], i * 4);
    }
    tracks[k] = out;
  }
  // how far the chest and the head turn round in all (their world yaw, from the root's: what reads as turning away)
  const yawOf = (q) => { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q); return Math.atan2(f.x, f.z); };
  let chestMost = 0, headMost = 0;
  for (let i = 0; i < n; i++) {
    let w = T.rootQ.clone().multiply(T.bones.pelvis.lq);   // (the hips at rest, as the layer lies over them)
    for (const k of ['spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head']) {
      w = w.multiply(qAt(tracks[k], i, _a));
      if (k !== 'spine_03' && k !== 'Head') continue;
      const y = Math.abs(yawOf(w.clone().multiply(T.bones[k].wq.clone().invert())));
      if (k === 'spine_03') chestMost = Math.max(chestMost, y); else headMost = Math.max(headMost, y);
    }
  }
  // a loop: its last CLOSE s bent, more and more, onto the first frame, so it comes round seamlessly
  let mismatch = 0;
  for (const k of UPPER) mismatch = Math.max(mismatch, angle(qAt(tracks[k], 0, _a), qAt(tracks[k], n - 1, _b)));
  if (row.loop) {
    const m = Math.min(Math.round(CLOSE * FPS), Math.floor(n / 3));
    for (const k of UPPER) {
      const q = tracks[k];
      const delta = qAt(q, 0, _c).clone().multiply(qAt(q, n - 1, _d).clone().invert());
      for (let j = 0; j < m; j++) {
        const i = n - m + j, w = THREE.MathUtils.smoothstep((j + 1) / m, 0, 1);
        _a.identity().slerp(delta, w);
        qAt(q, i, _b).premultiply(_a);
        q.set([_b.x, _b.y, _b.z, _b.w], i * 4);
      }
    }
  }
  // continuous signs (interpolated)
  for (const k of UPPER) {
    const q = tracks[k];
    for (let i = 1; i < n; i++) if (q[i * 4] * q[i * 4 - 4] + q[i * 4 + 1] * q[i * 4 - 3] + q[i * 4 + 2] * q[i * 4 - 2] + q[i * 4 + 3] * q[i * 4 - 1] < 0) for (let j = 0; j < 4; j++) q[i * 4 + j] = -q[i * 4 + j];
  }
  // how much it moves (the arms' and head's mean turn rate, rad/s), for the table below
  let motion = 0;
  for (const k of ['upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r', 'Head']) for (let i = 1; i < n; i++) motion += angle(qAt(tracks[k], i, _a), qAt(tracks[k], i - 1, _b)) * FPS;
  motion /= 5 * Math.max(1, n - 1);
  return { id: row.id, name: `gesture_${row.id}`, n, loop: !!row.loop, tracks, source: row.pack ? `Mixamo "${row.name}" (${row.pack} pack: ${row.entry})` : `Mixamo "${row.name}" (${row.file}.fbx)`, mismatch, motion, twistMost, chestMost, headMost };
}

const done = [];
for (const row of table.clips) {
  try { done.push(await convert(row)); } catch (e) { console.warn(`  ${row.id}: ${e.message}`); }
}

// the skeleton's nodes, as the other files' (the tracks bind by name onto the library's skeleton)
const B = T.bones, order = ['root', ...BONES];
const nodes = [{ name: 'root_motion', parent: -1 }];
for (const k of order) nodes.push({ name: k, parent: k === 'root' ? 0 : 1 + order.indexOf(B[k].parent), translation: B[k].lp.toArray(), rotation: B[k].lq.toArray() });
const nodeOf = (k) => 1 + order.indexOf(k);
let frames = 0, keys = 0;
const clips = done.map((c) => {
  const channels = UPPER.map((k) => {
    const ks = reduceTrack(c.tracks[k], c.n);
    frames += c.n; keys += ks.length;
    return { node: nodeOf(k), path: 'rotation', data: c.tracks[k], keys: ks };
  });
  c.kept = channels.reduce((s, ch) => s + ch.keys.length, 0) / (channels.length * c.n);
  return { name: c.name, fps: FPS, n: c.n, channels, extras: { use: 'clip', gesture: true, loop: c.loop, fps: FPS, source: c.source } };
});
for (const c of done) console.log(`${c.name.padEnd(30)} ${(c.n / FPS).toFixed(2).padStart(5)} s${c.loop ? ' loop' : '     '}  ends ${(c.mismatch * 180 / Math.PI).toFixed(1).padStart(5)}° apart  moves ${c.motion.toFixed(2)} rad/s  keys kept ${(c.kept * 100).toFixed(0)} %  hips turn ${(c.twistMost * 180 / Math.PI).toFixed(0)}°  chest ${(c.chestMost * 180 / Math.PI).toFixed(0)}° head ${(c.headMost * 180 / Math.PI).toFixed(0)}°`);
console.log(`${done.length} clips, ${(frames / UPPER.length / FPS).toFixed(1)} s, ${keys} keys of ${frames} frames (${(keys / frames * 100).toFixed(0)} %)`);
if (STATS) process.exit(0);
const extras = { generator: 'scripts/mocap/build-gestures.mjs', fps: FPS, tracks: UPPER, credits: 'Mixamo (Adobe). See docs/motion-data.md.' };
const glb = writeGLB({ nodes, clips, extras });
await writeFile(OUT, glb);
const full = writeGLB({ nodes, clips: clips.map((c) => ({ ...c, channels: c.channels.map(({ keys: _, ...ch }) => ch) })), extras });
console.log(`${OUT}: ${glb.length} bytes (${(glb.length / 1024).toFixed(0)} KB; every frame kept it would be ${(full.length / 1024).toFixed(0)} KB)`);
