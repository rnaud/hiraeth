// A take: one recording, read from any format (asf-amc.js, bvh.js, fbx.js) into the same shape,
// so the retargeting doesn't care where it came from. In metres, y up, the subject facing +z at
// rest (left = +x):
//   points[name]    Float32Array(n * 3): a landmark's world position per frame
//   rotations[name] Float32Array(n * 4): a bone's world rotation relative to its rest pose
//   map             our bone -> { rot, from, to, aim } (see asf-amc.js CMU_MAP)
//   landmarks       { hipL, hipR, ankleL, ankleR, ballL, ballR, toeL, toeR, head } -> point names
import * as THREE from 'three';

export function newTake({ name, fps, n, points = [], rotations = [] }) {
  const t = {
    name, fps, n,
    points: Object.fromEntries(points.map((k) => [k, new Float32Array(n * 3)])),
    rotations: Object.fromEntries(rotations.map((k) => [k, new Float32Array(n * 4)])),
    map: null, landmarks: null,
    setPoint(k, i, v) { const a = this.points[k]; a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z; },
    setRotation(k, i, q) { const a = this.rotations[k]; a[i * 4] = q.x; a[i * 4 + 1] = q.y; a[i * 4 + 2] = q.z; a[i * 4 + 3] = q.w; },
    point(k, i, out = new THREE.Vector3()) { const a = this.points[k]; return out.set(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]); },
    rotation(k, i, out = new THREE.Quaternion()) { const a = this.rotations[k]; return out.set(a[i * 4], a[i * 4 + 1], a[i * 4 + 2], a[i * 4 + 3]); },
  };
  return t;
}

/** Frames `a` to `b` (exclusive) of a take, as a new take. */
export function sliceTake(t, a, b) {
  const n = Math.max(0, Math.min(b, t.n) - a);
  const s = newTake({ name: t.name, fps: t.fps, n, points: Object.keys(t.points), rotations: Object.keys(t.rotations) });
  for (const k in t.points) s.points[k].set(t.points[k].subarray(a * 3, (a + n) * 3));
  for (const k in t.rotations) s.rotations[k].set(t.rotations[k].subarray(a * 4, (a + n) * 4));
  Object.assign(s, { map: t.map, landmarks: t.landmarks, parents: t.parents, meta: t.meta });
  return s;
}

/** Resample to `fps` (positions lerped, rotations slerped). */
export function resampleTake(t, fps) {
  if (Math.abs(fps - t.fps) < 1e-6) return t;
  const n = Math.max(1, Math.floor((t.n - 1) * fps / t.fps) + 1);
  const s = newTake({ name: t.name, fps, n, points: Object.keys(t.points), rotations: Object.keys(t.rotations) });
  const a = new THREE.Vector3(), b = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const x = i * t.fps / fps, i0 = Math.min(Math.floor(x), t.n - 1), i1 = Math.min(i0 + 1, t.n - 1), k = x - i0;
    for (const p in t.points) s.setPoint(p, i, t.point(p, i0, a).lerp(t.point(p, i1, b), k));
    for (const r in t.rotations) {
      t.rotation(r, i0, qa); t.rotation(r, i1, qb);
      s.setRotation(r, i, qa.slerp(qb, k));
    }
  }
  Object.assign(s, { map: t.map, landmarks: t.landmarks, parents: t.parents, meta: t.meta });
  return s;
}

/**
 * The take seen in a mirror (x -> -x): left and right swap. A point's x flips; a rotation R
 * becomes S R S (S = diag(-1, 1, 1)), i.e. (x, y, z, w) -> (x, -y, -z, w). `swap` names the
 * source's left/right pairs (a function from a name to its other side's name).
 */
export function mirrorTake(t, swap) {
  const s = newTake({ name: `${t.name}_m`, fps: t.fps, n: t.n, points: Object.keys(t.points), rotations: Object.keys(t.rotations) });
  for (const k in t.points) {
    const src = t.points[swap(k)] ?? t.points[k], dst = s.points[k];
    for (let i = 0; i < t.n; i++) { dst[i * 3] = -src[i * 3]; dst[i * 3 + 1] = src[i * 3 + 1]; dst[i * 3 + 2] = src[i * 3 + 2]; }
  }
  for (const k in t.rotations) {
    const src = t.rotations[swap(k)] ?? t.rotations[k], dst = s.rotations[k];
    for (let i = 0; i < t.n; i++) { dst[i * 4] = src[i * 4]; dst[i * 4 + 1] = -src[i * 4 + 1]; dst[i * 4 + 2] = -src[i * 4 + 2]; dst[i * 4 + 3] = src[i * 4 + 3]; }
  }
  Object.assign(s, { map: t.map, landmarks: t.landmarks, parents: t.parents, meta: { ...(t.meta ?? {}), mirrored: !(t.meta?.mirrored) } });
  return s;
}
