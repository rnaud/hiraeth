// Kevin Iglesias's sprint (his Human Basic Motions FREE pack: HumanM@Sprint01_Forward, 0.533 s on the spot) onto the
// game's clip skeleton (the UAL library's, public/anim/ual.glb), as one looping clip the Animator plays in the sprint
// loop's place when the switch says so (src/animator.js sprintSetting, issue #704). Same pipeline as the Mixamo moves
// (fbx.js, maps.js KEVIN_MAP, retarget.js): the pose aimed bone by bone, the body scaled by the leg, the root held still
// (the clip is in place: the controller moves the body), the head's turn kept (the Animator's head nod reads it).
// Then the loop is closed: its last frame is its first again, a cycle on (the pelvis's drift and each bone's turn from
// the first frame to the last taken out evenly over the cycle, as motion-match.js loopInPlace does), so the mixer wraps
// it without a jolt.
import * as THREE from 'three';
import { fbxTake } from './fbx.js';
import { targetSkeleton, retarget, BONES, TRACKS } from './retarget.js';
import { writeGLB } from './glb.js';

export const SPRINT_CLIP = 'kevin_sprint';
export const SPRINT_FPS = 60;
// (the head's turn kept: the clip's own tracks, as build-library.mjs's TRACKS_CLIP)
export const SPRINT_TRACKS = [...TRACKS.slice(0, 4), 'Head', ...TRACKS.slice(4)];
export const SPRINT_SOURCE = 'Kevin Iglesias, Human Basic Motions FREE 2.4 (keviniglesias.com): HumanM@Sprint01_Forward';

/** Close a retargeted loop in place (frames 0..n-1, n-1 the same moment as 0): returns the largest turn taken out (rad) and the drift (m). */
export function closeLoop(r) {
  const n = r.n, P = r.pelvisPos, d = [0, 1, 2].map((k) => P[(n - 1) * 3 + k] - P[k]);
  for (let i = 0; i < n; i++) { const u = i / (n - 1); for (let k = 0; k < 3; k++) P[i * 3 + k] -= d[k] * u; }
  let closed = 0;
  const a = new THREE.Quaternion(), D = new THREE.Quaternion(), I = new THREE.Quaternion(), s = new THREE.Quaternion(), q = new THREE.Quaternion();
  for (const k of BONES) {
    const A = r.local[k];
    a.fromArray(A, 0); D.fromArray(A, (n - 1) * 4).multiply(a.clone().invert());
    if (D.w < 0) D.set(-D.x, -D.y, -D.z, -D.w);
    closed = Math.max(closed, 2 * Math.acos(Math.min(1, D.w)));
    for (let i = 0; i < n; i++) { s.slerpQuaternions(I, D, i / (n - 1)).invert(); q.fromArray(A, i * 4).premultiply(s).normalize().toArray(A, i * 4); }
    // (the last frame exactly the first: the 16-bit store then rounds both the same way)
    for (let j = 0; j < 4; j++) A[(n - 1) * 4 + j] = A[j];
  }
  for (let k = 0; k < 3; k++) P[(n - 1) * 3 + k] = P[k];
  return { closed, drift: Math.hypot(...d) };
}

/**
 * The FBX's bytes (ArrayBuffer) and the parsed ual.glb's scene -> { r (the retargeted loop), nodes, clip (writeGLB's), info }.
 */
export function convertSprint(buffer, ualScene, { fps = SPRINT_FPS } = {}) {
  const T = targetSkeleton(ualScene);
  const take = fbxTake(buffer, { fps, name: SPRINT_CLIP });
  const r = retarget(take, T, { root: 'fixed', head: true });
  const { closed, drift } = closeLoop(r);
  // the file's skeleton: build-library.mjs's (root_motion > root > pelvis > ...), so the clip binds onto the library's
  const B = T.bones, order = ['root', ...BONES];
  const nodes = [{ name: 'root_motion', parent: -1 }];
  for (const nm of order) nodes.push({ name: nm, parent: nm === 'root' ? 0 : 1 + order.indexOf(B[nm].parent), translation: B[nm].lp.toArray(), rotation: B[nm].lq.toArray() });
  const nodeOf = (nm) => 1 + order.indexOf(nm);
  const channels = SPRINT_TRACKS.map((k) => ({ node: nodeOf(k), path: 'rotation', data: r.local[k] }));
  channels.push({ node: nodeOf('pelvis'), path: 'translation', data: r.pelvisPos });
  // (no contact labels: on the spot, a planted ball sweeps back at the run's speed, which footContacts reads as a foot in
  // the air; the Animator measures an in-place loop's feet itself, gaitOf)
  const info = { use: 'sprint', loop: true, fps, source: SPRINT_SOURCE, scale: +r.scale.toFixed(4), closed: +closed.toFixed(4), drift: +drift.toFixed(4) };
  const clip = { name: SPRINT_CLIP, fps, n: r.n, channels, extras: info };
  return { r, nodes, clip, info };
}

/** The GLB's bytes for the converted sprint. */
export function sprintGLB(buffer, ualScene, o) {
  const { nodes, clip, info } = convertSprint(buffer, ualScene, o);
  const bytes = writeGLB({ nodes, clips: [clip], extras: { generator: 'scripts/mocap/build-sprint.mjs', fps: clip.fps, credits: `${SPRINT_SOURCE}. Royalty-free; see public/anim/LICENSE-KevinIglesias.txt and docs/motion-data.md.` } });
  return { bytes, info, n: clip.n };
}
