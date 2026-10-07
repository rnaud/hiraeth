import { store } from './platform.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Motion matching for locomotion (after Clavet's "Motion Matching" and Holden's write-ups:
// theorangeduck.com/page/code-vs-data-driven-displacement), on the clips of public/anim/
// locomotion.glb (CMU motion capture, retargeted onto the UAL skeleton: scripts/mocap/).
//
//  - The database: every frame of every clip, and its mirror image (left and right turns from
//    one take), with a feature vector: where the feet are and how fast they move, how fast the
//    hips move, and where the body will be and which way it will face 1/3, 2/3 and 1 s on.
//  - The query: the same features, the pose half from the frame now playing, the future half
//    predicted from the stick (the same spring the player's movement follows). Every 0.1 s, or at
//    once when the stick changes a lot, the closest frame of the database is found (a plain scan:
//    ~10k frames, a fraction of a millisecond) and playback jumps there.
//  - Jumps are inertialised: the difference between the pose shown and the new one (and between
//    their velocities) decays away over ~0.1 s, so nothing pops.
//  - It never moves the body: the controller does (input latency as before); the matcher only
//    picks the pose, and the feet (feet.js) plant it on the real ground as before.

export const MATCH = {
  interval: 0.1,          // s between searches
  halflife: 0.09,         // s: how fast a jump's difference decays
  horizon: [10, 20, 30],  // frames (30 fps) ahead: the trajectory's three samples
  weights: { feetPos: 0.75, feetVel: 1, hipVel: 1, trajPos: 1, trajDir: 1.5 },
  endMargin: 6,           // frames at a clip's end never jumped to
  stay: 3,                // a match within this many frames of the one playing: keep playing
  back: 15,               // or this many behind it in the same take (never back a step and again, round and round)
  keep: 0.35, keepAbs: 0.1, keepMax: 0.5,   // a jump must beat the frame playing by this much (relative, at least, at most)
  endBias: 0.5,           // extra cost of a frame in the last second of a clip that ends
  forceTurn: 0.6,         // rad the wanted direction turns (or speed changes by forceSpeed) to search at once
  forceSpeed: 1.5,        // m/s
  rate: [0.75, 1.6],      // the playback speed warp's range (Animator.match)
  lag: 1.2,               // the body faster than the clip at its fastest warp x this: the loops take over
  maxCost: 8,             // a best match costlier than this: the database has nothing like it (the Animator's loops)
};

const FPS_DEFAULT = 30;
const otherSide = (n) => (n.endsWith('_l') ? n.slice(0, -1) + 'r' : n.endsWith('_r') ? n.slice(0, -1) + 'l' : n);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const loading = {};
/**
 * Load the captured motion and attach it to the clip library (lib.motion): the people's walks
 * (public/anim/walks.glb) and the traveller's own moves (public/anim/moves.glb: the get-ups, the
 * jumps, the idles, the kneel and the petting), small: always; with `matching`, the matching
 * database (public/anim/locomotion.glb, ~1.4 MB: only when motion matching is on, or in the
 * character studio). Each file is fetched once; resolves to lib.motion.
 */
export function loadMotionLibrary(lib, { base = '', matching = false } = {}) {
  const files = ['anim/walks.glb', 'anim/moves.glb', ...(matching ? ['anim/locomotion.glb'] : [])];
  return Promise.all(files.map((f) => (loading[base + f] ??= new GLTFLoader().loadAsync(base + f).then((g) => attachMotion(lib, g)).catch((e) => { console.warn(`${f} failed to load`, e); return null; }))))
    .then(() => lib.motion ?? null);
}

/** Motion matching for the traveller: off unless asked for (the dev menu, or ?mm=1 in the address). */
export const matchingSetting = {
  key: 'memento.motionMatching',
  get() {
    try {
      const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('mm') : null;
      if (q !== null) return q === '1' || q === 'on';
      return store.get(this.key) === '1';
    } catch { return false; }
  },
  set(on) { store.set(this.key, on ? '1' : '0'); },   // (no storage: this session only)
};

/** A parsed walks.glb or locomotion.glb, attached to `lib` (lib.motion: what was there before stays). */
export function attachMotion(lib, gltf) {
  const sheets = Object.fromEntries(gltf.animations.map((a) => [a.name, a]));
  const motion = (lib.motion ??= { db: null, walks: [], clips: [], all: [] });
  if (sheets.mm_database) motion.db = new MotionDB(lib, sheets.mm_database);
  const walks = sheets.walk_loops ? segmentClips(sheets.walk_loops).map((c) => ({ ...c.userData, clip: c })) : [];
  motion.walks.push(...walks);
  const clips = gltf.animations.filter((a) => a.userData?.use === 'clip').map((c) => stripRoot(pathOf(c)));
  motion.clips.push(...clips);
  // the studio lists everything: the database's takes and the walks one by one
  motion.all.push(...(sheets.mm_database ? segmentClips(sheets.mm_database, 'mm') : []), ...walks.map((w) => w.clip), ...clips);
  return motion;
}

const stripRoot = (clip) => { clip.tracks = clip.tracks.filter((t) => !t.name.startsWith('root_motion.')); return clip; };

/**
 * A move's own path, from its ground track (before it is stripped: the controller moves the body),
 * per frame: `d` the distance it has walked, `yaw` how far it has turned (unwrapped, + left), `speed`
 * (m/s): what a start, a stop or a turn is matched by (src/loco-moves.js). None for a clip on the spot.
 */
function pathOf(clip) {
  const P = clip.tracks.find((t) => t.name === 'root_motion.position'), Q = clip.tracks.find((t) => t.name === 'root_motion.quaternion');
  if (!P || !Q) return clip;
  const n = P.times.length, fps = clip.userData?.fps ?? FPS_DEFAULT;
  const d = new Float32Array(n), yaw = new Float32Array(n), speed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let y = 2 * Math.atan2(Q.values[i * 4 + 1], Q.values[i * 4 + 3]);
    if (i) { while (y - yaw[i - 1] > Math.PI) y -= 2 * Math.PI; while (y - yaw[i - 1] < -Math.PI) y += 2 * Math.PI; }
    yaw[i] = y;
    if (i) d[i] = d[i - 1] + Math.hypot(P.values[i * 3] - P.values[i * 3 - 3], P.values[i * 3 + 2] - P.values[i * 3 - 1]);
  }
  for (let i = 0; i < n; i++) { const a = Math.max(i - 2, 0), b = Math.min(i + 2, n - 1); speed[i] = b > a ? (d[b] - d[a]) * fps / (b - a) : 0; }
  clip.userData = { ...(clip.userData ?? {}), path: { d, yaw, speed, fps } };
  return clip;
}

/**
 * A move seen in a mirror (a left turn for a right one; a stop on the other foot): left and right
 * bones swapped, rotations (x, -y, -z, w), the pelvis' x and the path's turn the other way round.
 * Named `<name>_m`; its userData its own (the feet's cache, the swapped contacts).
 */
export function mirrorClip(clip) {
  const tracks = clip.tracks.map((t) => {
    const dot = t.name.lastIndexOf('.'), bone = t.name.slice(0, dot), prop = t.name.slice(dot);
    const v = new Float32Array(t.values);
    if (prop === '.quaternion') for (let i = 0; i < v.length; i += 4) { v[i + 1] = -v[i + 1]; v[i + 2] = -v[i + 2]; }
    else if (prop === '.position') for (let i = 0; i < v.length; i += 3) v[i] = -v[i];
    return new t.constructor(otherSide(bone) + prop, t.times, v);
  });
  const m = new THREE.AnimationClip(`${clip.name}_m`, clip.duration, tracks);
  const ud = clip.userData ?? {};
  m.userData = { ...ud, feet: undefined, mirrored: true,
    contact: ud.contact ? { l: ud.contact.r, r: ud.contact.l } : ud.contact,
    path: ud.path ? { ...ud.path, yaw: ud.path.yaw.map((y) => -y) } : ud.path };
  return m;
}

/** The segments of a packed animation (extras.segments) as clips of their own (no ground track). */
export function segmentClips(sheet, prefix = 'walk') {
  const ud = sheet.userData ?? {}, fps = ud.fps ?? FPS_DEFAULT;
  return (ud.segments ?? []).map((s) => {
    // (a loop's last frame flows into its first: the clip ends on the first again, a cycle on)
    const wrap = s.loop || ud.use === 'npc', n = s.n + (wrap ? 1 : 0);
    const tracks = sheet.tracks.filter((t) => !t.name.startsWith('root_motion.')).map((t) => {
      const w = t.getValueSize(), times = new Float32Array(n), values = new Float32Array(n * w);
      for (let i = 0; i < n; i++) times[i] = i / fps;
      values.set(t.values.subarray(s.start * w, (s.start + s.n) * w));
      if (wrap) values.set(t.values.subarray(s.start * w, (s.start + 1) * w), s.n * w);
      return new t.constructor(t.name, times, values);
    });
    const c = new THREE.AnimationClip(`${prefix}:${s.name}`, (n - 1) / fps, tracks);
    c.userData = { ...s, contact: contactsOf(ud, s), fps };
    return c;
  });
}

const fromBase64 = (s) => {
  if (typeof atob === 'function') { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  return new Uint8Array(Buffer.from(s, 'base64'));
};
function contactsOf(ud, s) {
  if (!ud.contact) return null;
  const l = fromBase64(ud.contact.l), r = fromBase64(ud.contact.r);
  const a = s ? s.start : 0, n = s ? s.n : l.length;
  return { l: Float32Array.from(l.subarray(a, a + n), (x) => x / 255), r: Float32Array.from(r.subarray(a, a + n), (x) => x / 255) };
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _q4 = new THREE.Quaternion();

/**
 * Every frame of the database's clips and of their mirror images: the pose (local rotations of
 * the tracked bones, the pelvis' place), the ground track, the feet's contacts, and the features.
 */
export class MotionDB {
  constructor(lib, sheet) {
    const ud = sheet.userData ?? {};
    this.fps = ud.fps ?? FPS_DEFAULT;
    const rotTracks = sheet.tracks.filter((t) => t.name.endsWith('.quaternion') && !t.name.startsWith('root_motion.'));
    this.bones = rotTracks.map((t) => t.name.slice(0, t.name.lastIndexOf('.')));
    const B = this.bones.length;
    const pelT = sheet.tracks.find((t) => t.name === 'pelvis.position');
    const rmT = sheet.tracks.find((t) => t.name === 'root_motion.position'), rmQ = sheet.tracks.find((t) => t.name === 'root_motion.quaternion');
    const segs = ud.segments ?? [{ name: 'all', start: 0, n: pelT.times.length }];
    const n0 = pelT.times.length, N = n0 * 2;
    this.n = N; this.B = B;
    this.rot = new Float32Array(N * B * 4);
    this.pel = new Float32Array(N * 3);
    this.root = new Float32Array(N * 3);   // x, z, yaw (from each segment's start)
    this.contact = new Float32Array(N * 2);
    this.segOf = new Int32Array(N);
    this.segments = [];
    const C = contactsOf(ud, null);
    const mirrorOf = this.bones.map((b) => this.bones.indexOf(otherSide(b)));
    for (let m = 0; m < 2; m++) {
      const off = m * n0;
      for (const [si, s] of segs.entries()) this.segments.push({ ...s, start: s.start + off, end: s.start + off + s.n, mirrored: !!m, index: this.segments.length, take: si });
      for (let i = 0; i < n0; i++) {
        const j = off + i;
        for (let b = 0; b < B; b++) {
          const src = rotTracks[m ? mirrorOf[b] : b].values, o = (j * B + b) * 4;
          let x = src[i * 4], y = src[i * 4 + 1], z = src[i * 4 + 2], w = src[i * 4 + 3];
          if (m) { y = -y; z = -z; }
          const len = Math.hypot(x, y, z, w) || 1;
          this.rot[o] = x / len; this.rot[o + 1] = y / len; this.rot[o + 2] = z / len; this.rot[o + 3] = w / len;
        }
        this.pel[j * 3] = (m ? -1 : 1) * pelT.values[i * 3]; this.pel[j * 3 + 1] = pelT.values[i * 3 + 1]; this.pel[j * 3 + 2] = pelT.values[i * 3 + 2];
        const rx = rmT ? rmT.values[i * 3] : 0, rz = rmT ? rmT.values[i * 3 + 2] : 0;
        const yaw = rmQ ? 2 * Math.atan2(rmQ.values[i * 4 + 1], rmQ.values[i * 4 + 3]) : 0;
        this.root[j * 3] = m ? -rx : rx; this.root[j * 3 + 1] = rz; this.root[j * 3 + 2] = m ? -yaw : yaw;
        const cl = C ? C.l[i] : 1, cr = C ? C.r[i] : 1;
        this.contact[j * 2] = m ? cr : cl; this.contact[j * 2 + 1] = m ? cl : cr;
      }
    }
    for (const s of this.segments) for (let j = s.start; j < s.end; j++) this.segOf[j] = s.index;
    // unwrap each segment's yaw (the quaternion's angle wraps at +-pi)
    for (const s of this.segments) for (let j = s.start + 1; j < s.end; j++) {
      let y = this.root[j * 3 + 2]; const p = this.root[(j - 1) * 3 + 2];
      while (y - p > Math.PI) y -= 2 * Math.PI; while (y - p < -Math.PI) y += 2 * Math.PI;
      this.root[j * 3 + 2] = y;
    }
    this.skeleton(lib);
    this.analyse();
    this.features();
  }

  /** The library skeleton's rest (local positions and the root's turn), for the feet's places. */
  skeleton(lib) {
    const by = (n) => lib.scene.getObjectByName(n);
    const rest = (n) => ({ p: by(n).position.clone(), q: by(n).quaternion.clone() });
    this.rest = { root: rest('root'), pelvis: rest('pelvis') };
    for (const s of ['l', 'r']) for (const n of [`thigh_${s}`, `calf_${s}`, `foot_${s}`, `ball_${s}`]) this.rest[n] = rest(n);
    this.bi = Object.fromEntries(this.bones.map((b, i) => [b, i]));
    lib.scene.updateMatrixWorld(true);
  }

  /** Per frame: the root's speed, frames to each foot's next touchdown, how much it walks. */
  analyse() {
    const N = this.n, fps = this.fps;
    this.speed = new Float32Array(N);
    this.lead = new Float32Array(N * 2);
    for (const s of this.segments) {
      for (let j = s.start; j < s.end; j++) {
        const a = Math.max(j - 1, s.start), b = Math.min(j + 1, s.end - 1);
        this.speed[j] = Math.hypot(this.root[b * 3] - this.root[a * 3], this.root[b * 3 + 1] - this.root[a * 3 + 1]) / Math.max(b - a, 1) * fps;
      }
      for (let f = 0; f < 2; f++) {
        // (a loop goes round twice: the touchdown after its end is its first one, a cycle on)
        let next = Infinity;
        const n = s.end - s.start, rounds = s.loop ? 2 : 1;
        for (let k = rounds * n - 1; k >= 0; k--) {
          const j = s.start + (k % n);
          const on = this.contact[j * 2 + f] > 0.5;
          if (on) next = k;
          if (k < n) this.lead[j * 2 + f] = on ? 0 : next - k;   // (Infinity: no touchdown before the clip ends)
        }
      }
    }
  }

  /** A frame's feet (ankles) in its root's frame (out: Float32Array(6)), pelvis place (out2: 3). */
  feetAt(j, out, o = 0, hips = null) {
    const R = this.rest, B = this.B, r = this.rot;
    const q = (bone, target) => { const b = this.bi[bone], k = (j * B + b) * 4; return target.set(r[k], r[k + 1], r[k + 2], r[k + 3]); };
    // root (rest) > pelvis (animated place and turn) > thigh > calf > foot
    const qr = _q.copy(R.root.q);
    const pel = _v.set(this.pel[j * 3], this.pel[j * 3 + 1], this.pel[j * 3 + 2]).applyQuaternion(qr);
    if (hips) { hips[0] = pel.x; hips[1] = pel.y; hips[2] = pel.z; }
    const qp = _q2.copy(qr).multiply(q('pelvis', _q3));
    for (const [s, k] of [['l', 0], ['r', 3]]) {
      const p = _v2.copy(pel), qq = new THREE.Quaternion().copy(qp);
      for (const bone of [`thigh_${s}`, `calf_${s}`, `foot_${s}`]) {
        p.add(new THREE.Vector3().copy(R[bone].p).applyQuaternion(qq));
        if (bone !== `foot_${s}`) qq.multiply(q(bone, new THREE.Quaternion()));
      }
      out[o + k] = p.x; out[o + k + 1] = p.y; out[o + k + 2] = p.z;
    }
    return out;
  }

  /** The feature vector of every frame (normalised per group: mean and spread, weighted). */
  features() {
    const N = this.n, fps = this.fps, H = MATCH.horizon;
    const F = 27;
    this.F = F;
    const raw = new Float32Array(N * F);
    const feet = new Float32Array(N * 6), hips = new Float32Array(N * 3), tmp = new Float32Array(6), h3 = new Float32Array(3);
    for (let j = 0; j < N; j++) { this.feetAt(j, tmp, 0, h3); feet.set(tmp, j * 6); hips.set(h3, j * 3); }
    // a point's world place: root + yaw-turned local
    const world = (j, x, y, z, out) => {
      const yaw = this.root[j * 3 + 2], c = Math.cos(yaw), s = Math.sin(yaw);
      out[0] = this.root[j * 3] + x * c + z * s; out[1] = y; out[2] = this.root[j * 3 + 1] - x * s + z * c;
      return out;
    };
    const toLocal = (j, dx, dz, out, k) => {   // a world xz vector into frame j's root frame
      const yaw = this.root[j * 3 + 2], c = Math.cos(yaw), s = Math.sin(yaw);
      out[k] = dx * c - dz * s; out[k + 1] = dx * s + dz * c;
    };
    const wa = [0, 0, 0], wb = [0, 0, 0], loc = [0, 0];
    for (const s of this.segments) {
      for (let j = s.start; j < s.end; j++) {
        const o = j * F, nx = Math.min(j + 1, s.end - 1), pv = nx === j ? Math.max(j - 1, s.start) : j, a = nx === j ? pv : j, b = nx === j ? j : nx;
        // feet places
        for (let k = 0; k < 6; k++) raw[o + k] = feet[j * 6 + k];
        // feet and hips velocities (world, into this frame's root frame)
        const vel = (arr, stride, off, at) => {
          world(a, arr[a * stride + off], arr[a * stride + off + 1], arr[a * stride + off + 2], wa);
          world(b, arr[b * stride + off], arr[b * stride + off + 1], arr[b * stride + off + 2], wb);
          const d = Math.max(b - a, 1) / fps;
          toLocal(j, (wb[0] - wa[0]) / d, (wb[2] - wa[2]) / d, loc, 0);
          raw[o + at] = loc[0]; raw[o + at + 1] = (wb[1] - wa[1]) / d; raw[o + at + 2] = loc[1];
        };
        vel(feet, 6, 0, 6); vel(feet, 6, 3, 9); vel(hips, 3, 0, 12);
        // the trajectory: places and facings ahead (past the clip's end: carried on at its last speed)
        const last = s.end - 1, back = Math.max(last - 4, s.start), span = Math.max(last - back, 1) / fps;
        const lvx = (this.root[last * 3] - this.root[back * 3]) / span, lvz = (this.root[last * 3 + 1] - this.root[back * 3 + 1]) / span;
        H.forEach((h, k) => {
          const t = j + h, f = Math.min(t, last), extra = (t - f) / fps;
          const px = this.root[f * 3] + lvx * extra, pz = this.root[f * 3 + 1] + lvz * extra;
          toLocal(j, px - this.root[j * 3], pz - this.root[j * 3 + 1], raw, o + 15 + k * 2);
          const dy = this.root[f * 3 + 2] - this.root[j * 3 + 2];
          raw[o + 21 + k * 2] = Math.sin(dy); raw[o + 21 + k * 2 + 1] = Math.cos(dy);
        });
      }
    }
    // normalise: per dimension mean, per group spread (the mean of its dimensions' deviations), weighted
    const W = MATCH.weights;
    const groups = [[0, 6, W.feetPos], [6, 12, W.feetVel], [12, 15, W.hipVel], [15, 21, W.trajPos], [21, 27, W.trajDir]];
    this.mean = new Float32Array(F); this.scale = new Float32Array(F);
    for (let d = 0; d < F; d++) { let s = 0; for (let j = 0; j < N; j++) s += raw[j * F + d]; this.mean[d] = s / N; }
    for (const [a, b, w] of groups) {
      let sd = 0;
      for (let d = a; d < b; d++) { let s = 0; for (let j = 0; j < N; j++) { const x = raw[j * F + d] - this.mean[d]; s += x * x; } sd += Math.sqrt(s / N); }
      sd = Math.max(sd / (b - a), 1e-4);
      for (let d = a; d < b; d++) this.scale[d] = sd / w;
    }
    this.feat = new Float32Array(N * F);
    for (let j = 0; j < N; j++) for (let d = 0; d < F; d++) this.feat[j * F + d] = (raw[j * F + d] - this.mean[d]) / this.scale[d];
    this.rawFeat = raw;
    // the frames one may jump to: not in the last few of a clip
    this.valid = new Uint8Array(N);
    for (const s of this.segments) for (let j = s.start; j < s.end - (s.loop ? 0 : MATCH.endMargin); j++) this.valid[j] = 1;
    // the last second of a clip that ends (not a loop) costs a little more to jump to: it ends soon,
    // and a match that keeps finding the same tail (the still end of a stop, say) never settles
    this.bias = new Float32Array(N);
    for (const s of this.segments) if (!s.loop) for (let j = s.start; j < s.end; j++) this.bias[j] = MATCH.endBias * (1 - THREE.MathUtils.smoothstep(s.end - j, MATCH.endMargin, fps));
    // a coarse index: each block of 16 frames' bounding box, for skipping whole blocks in the search
    this.blocks = [];
    for (const s of this.segments) for (let a = s.start; a < s.end; a += 16) {
      const b = Math.min(a + 16, s.end), lo = new Float32Array(F).fill(Infinity), hi = new Float32Array(F).fill(-Infinity);
      for (let j = a; j < b; j++) for (let d = 0; d < F; d++) { const x = this.feat[j * F + d]; if (x < lo[d]) lo[d] = x; if (x > hi[d]) hi[d] = x; }
      let bmin = Infinity;
      for (let j = a; j < b; j++) bmin = Math.min(bmin, this.bias[j]);
      this.blocks.push({ a, b, lo, hi, bmin });
    }
    // the fastest the database runs (its 95th percentile of moving frames): past that it has no match
    const sp = Array.from(this.speed).filter((x) => x > 0.3).sort((x, y) => x - y);
    this.maxSpeed = sp[Math.floor(sp.length * 0.95)] ?? 3;
  }

  /** Normalise a raw query (Float32Array(27)) in place. */
  normalise(q) { for (let d = 0; d < this.F; d++) q[d] = (q[d] - this.mean[d]) / this.scale[d]; return q; }

  /** The closest frame to a normalised query: { frame, cost }. */
  search(q, bestCost = Infinity, bestFrame = -1) {
    const F = this.F, f = this.feat, valid = this.valid;
    for (const blk of this.blocks) {
      // the box's nearest point: if even that is no better, skip the block
      let lb = blk.bmin;
      for (let d = 0; d < F && lb < bestCost; d++) { const x = q[d], e = x < blk.lo[d] ? blk.lo[d] - x : x > blk.hi[d] ? x - blk.hi[d] : 0; lb += e * e; }
      if (lb >= bestCost) continue;
      for (let j = blk.a; j < blk.b; j++) {
        if (!valid[j]) continue;
        let c = this.bias[j];
        const o = j * F;
        for (let d = 0; d < F && c < bestCost; d++) { const e = q[d] - f[o + d]; c += e * e; }
        if (c < bestCost) { bestCost = c; bestFrame = j; }
      }
    }
    return { frame: bestFrame, cost: bestCost };
  }
}

// ------------------------------------------------------------------ rotations as vectors
function quatLog(q, out, k) {   // the rotation vector (axis x angle) of a unit quaternion, shortest way
  let { x, y, z, w } = q;
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const s = Math.hypot(x, y, z);
  const a = s < 1e-8 ? 2 : 2 * Math.atan2(s, w) / s;
  out[k] = x * a; out[k + 1] = y * a; out[k + 2] = z * a;
}
function quatExp(v, k, out) {
  const x = v[k], y = v[k + 1], z = v[k + 2], a = Math.hypot(x, y, z);
  if (a < 1e-8) return out.set(x / 2, y / 2, z / 2, 1).normalize();
  const s = Math.sin(a / 2) / a;
  return out.set(x * s, y * s, z * s, Math.cos(a / 2));
}
/** A critically damped spring toward 0 (Holden's decay_spring_damper_implicit), in place. */
function decay(x, v, k, halflife, dt) {
  const y = (4 * Math.LN2) / (halflife + 1e-5) / 2, j1 = v[k] + x[k] * y, e = Math.exp(-y * dt);
  x[k] = e * (x[k] + j1 * dt);
  v[k] = e * (v[k] - j1 * y * dt);
}

/**
 * One character's matcher: what plays, the jump offsets, and the pose it hands the Animator.
 * The Animator calls update() every frame it is on the ground with a stick, then writes `out`.
 */
export class MotionMatcher {
  constructor(db) {
    this.db = db;
    const B = db.B;
    this.cur = -1;               // the frame playing (fractional)
    this.timer = 0;
    this.outQ = new Float32Array(B * 4); this.outP = new Float32Array(3);
    this.offQ = new Float32Array(B * 3); this.offW = new Float32Array(B * 3);
    this.offP = new Float32Array(3); this.offV = new Float32Array(3);
    this.dbW = new Float32Array(B * 3); this.dbV = new Float32Array(3);   // the playing clip's own velocities
    this.query = new Float32Array(db.F);
    this.traj = new Float32Array(12);
    this.cost = 0; this.searches = 0; this.jumps = 0;
    this.contact = { l: 1, r: 1 }; this.lead = { l: Infinity, r: Infinity };
    this.speed = 0;              // the database's ground speed where it plays (its m/s)
    this.lastWant = null;
    this.rate = 1;               // playback speed (the Animator warps it to the body's speed)
  }

  reset() { this.cur = -1; this.offQ.fill(0); this.offW.fill(0); this.offP.fill(0); this.offV.fill(0); this.lastWant = null; this.prev = null; }

  /**
   * Predict the trajectory (the controller's own spring) in the body's frame now (x left, z ahead),
   * in the database's metres (divided by the body's size): raw query entries 15..26.
   * @param s.vel  { x, z } velocity now (m/s, body frame)   s.want { x, z } the velocity steered to
   * @param s.k    the spring's rate (1/s)    s.face: null, or a fixed facing (rad, body frame)
   * @param size   the body's size against the database's (legs)
   */
  predict(s, size) {
    const H = MATCH.horizon, fps = this.db.fps, steps = H[H.length - 1] * 2, dt = 1 / (fps * 2);
    let vx = s.vel.x, vz = s.vel.z, px = 0, pz = 0, yaw = 0;
    const a = 1 - Math.exp(-(s.k ?? 8) * dt), turnA = 1 - Math.exp(-12 * dt), faceA = 1 - Math.exp(-14 * dt);
    let h = 0;
    for (let i = 1; i <= steps; i++) {
      vx += (s.want.x - vx) * a; vz += (s.want.z - vz) * a;
      px += vx * dt; pz += vz * dt;
      if (s.face !== null && s.face !== undefined) yaw += wrap(s.face - yaw) * faceA;
      else if (Math.hypot(vx, vz) > 0.5) yaw += wrap(Math.atan2(vx, vz) - yaw) * turnA;
      if (i === H[h] * 2) { this.traj[h * 2] = px / size; this.traj[h * 2 + 1] = pz / size; this.traj[6 + h * 2] = Math.sin(yaw); this.traj[6 + h * 2 + 1] = Math.cos(yaw); h++; }
    }
    return this.traj;
  }

  /**
   * Advance a frame. @param dt, @param s the stick (predict()), @param size the body's size.
   * Returns false when nothing in the database is close (cost over `maxCost`): the Animator
   * leaves the pose to the loops then.
   */
  update(dt, s, size, { maxCost = Infinity, force = false, rate = 1 } = {}) {
    this.rate = rate;
    const db = this.db;
    // the stick changed a lot: search now (the answer to a sharp turn shouldn't wait for the timer)
    const wantSpeed = Math.hypot(s.want.x, s.want.z), wantDir = Math.atan2(s.want.x, s.want.z);
    if (this.lastWant) {
      const turned = wantSpeed > 0.3 && this.lastWant.speed > 0.3 ? Math.abs(wrap(wantDir - this.lastWant.dir)) : 0;
      if (turned > MATCH.forceTurn || Math.abs(wantSpeed - this.lastWant.speed) > MATCH.forceSpeed) force = true;
    }
    if (force || !this.lastWant) this.lastWant = { speed: wantSpeed, dir: wantDir };
    this.timer -= dt;
    const fresh = this.cur < 0;
    if (!fresh) {
      const was = this.cur;
      this.cur += dt * db.fps * rate;
      const seg = db.segments[db.segOf[Math.floor(was)]];
      if (seg.loop) { if (this.cur >= seg.end) this.cur -= seg.end - seg.start; }   // (a loop: round again)
      else if (this.cur >= seg.end - 1.001) { this.cur = seg.end - 1.001; force = true; }
    }
    if (fresh || force || this.timer <= 0) {
      this.timer = MATCH.interval;
      this.lastWant = { speed: wantSpeed, dir: wantDir };
      const q = this.query, j = fresh ? -1 : Math.round(this.cur);
      if (j >= 0 && j < db.n) for (let d = 0; d < 15; d++) q[d] = db.rawFeat[j * db.F + d];
      else for (let d = 0; d < 15; d++) q[d] = db.mean[d];
      const t = this.predict(s, size);
      for (let d = 0; d < 12; d++) q[15 + d] = t[d];
      db.normalise(q);
      // the frame playing (a little on) is the one to beat
      let cur = -1, curCost = Infinity;
      if (!fresh) {
        cur = Math.min(Math.floor(this.cur) + 1, db.segments[db.segOf[Math.floor(this.cur)]].end - 1);
        if (db.valid[cur]) { curCost = db.bias[cur]; for (let d = 0; d < db.F; d++) { const e = q[d] - db.feat[cur * db.F + d]; curCost += e * e; } }
      }
      // (and it keeps playing unless something is clearly better: jumping at every search for a
      // hair's difference would never let a step finish)
      const bound = Number.isFinite(curCost) ? curCost - THREE.MathUtils.clamp(curCost * MATCH.keep, MATCH.keepAbs, MATCH.keepMax) : Infinity;
      const best = db.search(q, Math.max(bound, 0), cur);
      if (best.frame === cur) best.cost = curCost;
      this.searches++;
      this.cost = best.cost;
      // (the same take, or its mirror image, a few frames on or up to half a second back: keep
      // playing; flicking between a take and its mirror, or back a step and again, would never let a
      // step finish)
      let same = false;
      if (!fresh && best.frame >= 0) {
        const a = db.segments[db.segOf[best.frame]], b = db.segments[db.segOf[Math.floor(this.cur)]];
        const ahead = (best.frame - a.start) - (this.cur - b.start);
        same = a.take === b.take && ahead <= MATCH.stay * (a === b ? 1 : 2) && ahead >= -MATCH.back;
      }
      if (best.frame >= 0 && !same) this.jump(best.frame, fresh);
    }
    this.sample(dt);
    return this.cost <= maxCost;
  }

  /** Jump to frame `to`: the offsets carry the difference between the pose shown and the new one. */
  jump(to, fresh) {
    const db = this.db, B = db.B;
    if (!fresh) {
      // what is shown now (the clip plus the offsets) and how fast it moves
      const shownQ = new Float32Array(this.outQ), shownP = new Float32Array(this.outP);
      const shownW = new Float32Array(B * 3), shownV = new Float32Array(3);
      for (let i = 0; i < B * 3; i++) shownW[i] = this.dbW[i] + this.offW[i];
      for (let i = 0; i < 3; i++) shownV[i] = this.dbV[i] + this.offV[i];
      const from = this.cur;
      this.cur = to;
      this.poseAt(to, this.dbW, this.dbV);   // the new clip's pose (in outQ / outP) and velocities
      for (let b = 0; b < B; b++) {
        _q.fromArray(shownQ, b * 4); _q2.fromArray(this.outQ, b * 4).invert();
        quatLog(_q.multiply(_q2), this.offQ, b * 3);
        for (let k = 0; k < 3; k++) this.offW[b * 3 + k] = shownW[b * 3 + k] - this.dbW[b * 3 + k];
      }
      for (let k = 0; k < 3; k++) { this.offP[k] = shownP[k] - this.outP[k]; this.offV[k] = shownV[k] - this.dbV[k]; }
      // (the feet shown are still mostly the old clip's for a moment: its contacts fade out as the offsets do)
      this.prev = { cur: from, t: 0 };
      this.jumps++;
    } else {
      this.cur = to;
      this.offQ.fill(0); this.offW.fill(0); this.offP.fill(0); this.offV.fill(0);
    }
  }

  /** The clip's pose at fractional frame f (into outQ / outP), and its velocities (into w, v). */
  poseAt(f, w, v) {
    const db = this.db, B = db.B, seg = db.segments[db.segOf[Math.floor(f)]];
    const i0 = Math.max(seg.start, Math.min(Math.floor(f), seg.end - 1)), t = Math.min(Math.max(f - i0, 0), 1);
    const i1 = i0 + 1 < seg.end ? i0 + 1 : seg.loop ? seg.start : seg.end - 1;
    const r = db.rot, fps = db.fps;
    for (let b = 0; b < B; b++) {
      const a = (i0 * B + b) * 4, c = (i1 * B + b) * 4;
      _q.set(r[a], r[a + 1], r[a + 2], r[a + 3]); _q2.set(r[c], r[c + 1], r[c + 2], r[c + 3]);
      // (the angular velocity, in the parent's frame: q1 = exp(w dt) q0)
      if (w) { _q3.copy(_q2).multiply(_q4.copy(_q).invert()); quatLog(_q3, w, b * 3); for (let k = 0; k < 3; k++) w[b * 3 + k] *= fps * this.rate; }
      _q.slerp(_q2, t);
      this.outQ[b * 4] = _q.x; this.outQ[b * 4 + 1] = _q.y; this.outQ[b * 4 + 2] = _q.z; this.outQ[b * 4 + 3] = _q.w;
    }
    for (let k = 0; k < 3; k++) {
      this.outP[k] = db.pel[i0 * 3 + k] * (1 - t) + db.pel[i1 * 3 + k] * t;
      if (v) v[k] = (db.pel[i1 * 3 + k] - db.pel[i0 * 3 + k]) * fps * this.rate;
    }
    // what the feet and the stride need: contacts, frames to the next touchdowns, the ground speed
    for (const [f2, k] of [['l', 0], ['r', 1]]) {
      this.contact[f2] = db.contact[i0 * 2 + k] * (1 - t) + db.contact[i1 * 2 + k] * t;
      const ld = db.lead[i0 * 2 + k];
      this.lead[f2] = Number.isFinite(ld) ? Math.max(ld - t, 0) / (fps * this.rate) : Infinity;
    }
    this.speed = db.speed[i0] * (1 - t) + db.speed[i1] * t;
  }

  /** This frame's pose: the clip's at `cur`, with the decaying jump offsets laid on it. */
  sample(dt) {
    const db = this.db, B = db.B, h = MATCH.halflife;
    for (let i = 0; i < B * 3; i++) decay(this.offQ, this.offW, i, h, dt);
    for (let i = 0; i < 3; i++) decay(this.offP, this.offV, i, h, dt);
    this.poseAt(this.cur, this.dbW, this.dbV);
    for (let b = 0; b < B; b++) {
      quatExp(this.offQ, b * 3, _q);
      _q2.fromArray(this.outQ, b * 4);
      _q.multiply(_q2);
      this.outQ[b * 4] = _q.x; this.outQ[b * 4 + 1] = _q.y; this.outQ[b * 4 + 2] = _q.z; this.outQ[b * 4 + 3] = _q.w;
    }
    for (let k = 0; k < 3; k++) this.outP[k] += this.offP[k];
    // the contacts: the new clip's, and the old one's while its pose still shows (fading as the offsets do)
    const P = this.prev;
    if (P) {
      P.t += dt;
      const seg = db.segments[db.segOf[Math.floor(P.cur)]];
      P.cur += dt * db.fps * this.rate;
      P.cur = seg.loop && P.cur >= seg.end ? P.cur - (seg.end - seg.start) : Math.min(P.cur, seg.end - 1.001);
      const w = Math.exp(-P.t * Math.LN2 / h);
      if (w < 0.05) this.prev = null;
      else {
        const i0 = Math.floor(P.cur), i1 = i0 + 1 < seg.end ? i0 + 1 : seg.loop ? seg.start : seg.end - 1, t = P.cur - i0;
        for (const [f, k] of [['l', 0], ['r', 1]]) {
          const old = db.contact[i0 * 2 + k] * (1 - t) + db.contact[i1 * 2 + k] * t;
          this.contact[f] += (old - this.contact[f]) * w;
        }
      }
    }
  }
}
