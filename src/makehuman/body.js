// The MakeHuman bodies (docs/makehuman.md, stage 1): ONE parametric body, made into anyone on load.
//
// scripts/makehuman/build.py packs MakeHuman's base mesh (decimated to 12 000 triangles, the head
// whole), its 'game_engine' skeleton (the game's bone names), the low-poly eyes and two eyebrows,
// the shape of every corner of MakeHuman's macro space (compressed: their mean and principal
// components), a few targets as deltas (a belly, hips; the face's), the face's shape keys and the
// hair (MakeHuman's CC0 styles as shells bound to the body) into public/anim/mh/body.bin (its header
// and its arrays), about 1.7 MB (1.06 gzipped) for everyone. Here:
//
//   loadBody(base)              the data (cached)
//   shapeOf(data, params)       a person's points (src/makehuman/shape.js: sliders -> sample weights)
//   makeBody(data, params, o)   a Humanoid template: the skeleton (each bone where this person's is,
//                               turned as the reference's), the skinned body, eyes and brows, the
//                               face keys (one shared texture: keyTexture), and a profile the Humanoid reads instead
//                               of its per-kind tables (face, outfit, earZ, headFrame, headScale,
//                               faceKeys, the hair and the builds: humanoid.js)
//   measure(...)                the landmarks the game needs (the face ink's, the outfit's, the skull)
import * as THREE from 'three';
import { eyeballOf } from '../eyes.js';
import { skullPoint } from '../costumes.js';
import { taperBrows } from '../humanoid.js';
import { faceKeysFor } from './face-keys.js';
import { nodeWeights, paramsKey } from './shape.js';

/** The game's bone names a body must have (humanoid.js, feet.js, hands.js, costumes' frames). */
export const BONES = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l',
  'middle_01_l', 'index_01_l', 'pinky_01_l', 'thigh_l', 'calf_l', 'foot_l', 'ball_l',
  'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r', 'middle_01_r', 'index_01_r', 'pinky_01_r', 'thigh_r', 'calf_r', 'foot_r', 'ball_r'];

/** How much a costume's head pieces (fitted to the Quaternius skull of `kind`) scale to fit this skull: [x, y, z]. */
export function headScale(skull, kind = 'm') {
  const sx = skullPoint(kind, 90, 0)[0], sy = skullPoint(kind, 0, 90)[1];
  const front = skullPoint(kind, 0, 0)[2], back = -skullPoint(kind, 180, 0)[2];
  return [skull.x / sx, skull.y / sy, (skull.front + skull.back) / (front + back)];
}

const TYPES = { float32: Float32Array, int16: Int16Array, int8: Int8Array, uint16: Uint16Array, uint8: Uint8Array };

/**
 * body.bin (scripts/makehuman/pack.py: 'MHB1', the header's length, the JSON header, zeros to 8, the
 * arrays) as { meta, buffer, base }: the header and where its arrays start.
 */
export function unpackBody(buffer) {
  const u8 = new Uint8Array(buffer, 0, 8);
  if (String.fromCharCode(...u8.subarray(0, 4)) !== 'MHB1') throw new Error('MakeHuman body: not a body.bin');
  const n = new DataView(buffer).getUint32(4, true);
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, n)));
  return { meta, buffer, base: Math.ceil((8 + n) / 8) * 8 };
}

/** The body's data as makeBody reads it: get(name) a typed array, scale(name) its quantisation step (from body.bin; or a header and its arrays apart). */
export function parseBody(meta, buffer, base = 0) {
  if (meta instanceof ArrayBuffer) ({ meta, buffer, base } = unpackBody(meta));
  const arrays = new Map();
  const get = (name) => {
    if (!arrays.has(name)) {
      const b = meta.buffers[name];
      if (!b) throw new Error(`MakeHuman body: no buffer ${name}`);
      arrays.set(name, new TYPES[b.type](buffer, base + b.offset, b.length));
    }
    return arrays.get(name);
  };
  const scale = (name) => meta.buffers[name]?.scale ?? 1;
  const data = { meta, get, scale, cache: new Map() };
  const P = meta.parts;
  // the head's vertices (the face's, the hair's frame): those skinned to the head over half
  const J = get('body_joints'), W = get('body_weights'), hi = meta.bones.findIndex((b) => b.name === 'Head');
  const head = [];
  for (let i = 0; i < P.body.count; i++) {
    let w = 0;
    for (let k = 0; k < 4; k++) if (J[i * 4 + k] === hi) w += W[i * 4 + k] / 255;
    if (w > 0.5) head.push(i);
  }
  data.head = Uint32Array.from(head);
  data.headBone = hi;
  return data;
}

const loads = new Map();
/**
 * The parametric body's data (public/anim/mh/body.bin: one file, one fetch; the browser's cache keeps it
 * between worlds, and its gzip is undone off the main thread), once a page. Its parse is a few ms (the
 * header's JSON and the head's vertices): the arrays are views on the file.
 */
export function loadBody(base = '/') {
  if (!loads.has(base)) {
    loads.set(base, fetch(`${base}anim/mh/body.bin`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`body.bin: ${r.status}`)))).then((b) => parseBody(b)));
  }
  return loads.get(base);
}

/** The head's extent (width, height, depth) of a body's points. */
function headBox(data, pos) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const i of data.head) for (let c = 0; c < 3; c++) { const v = pos[i * 3 + c]; if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v; }
  return [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
}

/** Add a sparse delta (a target, or a key) at weight w, scaled per axis by k, into points `out` (offset in points). */
function addSparse(data, prefix, w, k, out, from = 0, to = Infinity, at = 0) {
  if (!w) return;
  const idx = data.get(`${prefix}_i`), d = data.get(`${prefix}_d`), s = data.scale(`${prefix}_d`) * w;
  for (let j = 0; j < idx.length; j++) {
    const v = idx[j];
    if (v < from || v >= to) continue;
    const o = (v - from + at) * 3;
    out[o] += d[j * 3] * s * k[0]; out[o + 1] += d[j * 3 + 1] * s * k[1]; out[o + 2] += d[j * 3 + 2] * s * k[2];
  }
}

/**
 * A person's points (Float32Array, x y z each: the body, eyes, both brows, then each bone's head, as
 * meta.parts lays them out), their real size against the bind height (the root's scale for a
 * true-to-life height) and the head's size against the reference's (kHead, per axis: the face's
 * targets and keys, the hair's offsets scale with it).
 */
export function shapeOf(data, p) {
  const { meta } = data, K = meta.K;
  const w = nodeWeights(meta, p), coef = data.get('coef');
  const c = new Float64Array(K);
  let size = 0;
  for (let n = 0; n < w.length; n++) {
    if (!w[n]) continue;
    for (let k = 0; k < K; k++) c[k] += w[n] * coef[n * K + k];
    size += w[n] * meta.nodes[n].size;
  }
  const out = Float32Array.from(data.get('mean'));
  for (let k = 0; k < K; k++) {
    const pc = data.get(`pc${k}`), f = c[k] * data.scale(`pc${k}`);
    for (let i = 0; i < out.length; i++) out[i] += f * pc[i];
  }
  const T = p.targets ?? {}, one = [1, 1, 1], face = new Set(meta.faceTargets);
  for (const [name, v] of Object.entries(T)) if (!face.has(name) && meta.targets[name]) addSparse(data, `t_${name}`, v, one, out);
  const box = headBox(data, out), ref = meta.ref.headBox;
  const kHead = [box[0] / ref[0], box[1] / ref[1], box[2] / ref[2]];
  for (const [name, v] of Object.entries(T)) if (face.has(name) && meta.targets[name]) addSparse(data, `t_${name}`, v, kHead, out);
  return { pos: out, size, kHead };
}

/** The points of one part ('body', 'eyes', 'brows0', 'bones') of a shape. */
export function part(data, pos, name) {
  const P = data.meta.parts[name];
  return pos.subarray(P.start * 3, (P.start + P.count) * 3);
}

/** A part's mesh attributes shared by every body (the triangles, the skin). */
function shared(data, name) {
  const key = `shared:${name}`;
  if (data.cache.has(key)) return data.cache.get(key);
  const n = data.meta.parts[name].count;
  const index = new THREE.BufferAttribute(Uint16Array.from(data.get(`${name}_tris`)), 1);
  let J, W;
  if (name === 'body') {
    J = Uint16Array.from(data.get('body_joints'));
    const w8 = data.get('body_weights');
    W = new Float32Array(w8.length);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += w8[i * 4 + k];
      for (let k = 0; k < 4; k++) W[i * 4 + k] = s ? w8[i * 4 + k] / s : k === 0 ? 1 : 0;
    }
  } else {
    // the eyes and the brows ride the head alone
    J = new Uint16Array(n * 4); W = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { J[i * 4] = data.headBone; W[i * 4] = 1; }
  }
  const out = { index, skinIndex: new THREE.BufferAttribute(J, 4), skinWeight: new THREE.BufferAttribute(W, 4) };
  data.cache.set(key, out);
  return out;
}

/** The face keys' texture: this many texels a row (WebGL 2 guarantees textures of 2048 at least). */
export const KEY_TEX_WIDTH = 2048;

/**
 * The face's shape keys on a part ('body', 'eyes', 'brows0', 'brows1') as ONE texture for every body:
 * each key a layer, each vertex a texel (its delta at the reference head, half floats), so every body,
 * build and face of the game shares it, each scaling the deltas by its own head (kHead, a uniform:
 * addSparse scales them per axis the same way). three.js made a morph texture per geometry (about 1 MB
 * each body that came close, and its CPU copy); materials.js FACE_KEYS reads this one instead.
 * Returns { texture, names, width, count } (texture null when the part has no keys).
 */
export function keyTexture(data, name) {
  const ck = `keytex:${name}`;
  if (data.cache.has(ck)) return data.cache.get(ck);
  const P = data.meta.parts[name], names = [], layers = [];
  for (const key of Object.keys(data.meta.keys)) {
    const arr = new Float32Array(P.count * 3);
    addSparse(data, `k_${key}`, 1, [1, 1, 1], arr, P.start, P.start + P.count, 0);
    if (!arr.some((v) => v !== 0)) continue;
    names.push(key); layers.push(arr);
  }
  const width = Math.min(P.count, KEY_TEX_WIDTH), height = Math.ceil(P.count / width);
  let texture = null;
  if (names.length) {
    const half = new Uint16Array(width * height * 4 * names.length), toHalf = THREE.DataUtils.toHalfFloat;
    layers.forEach((arr, k) => {
      const o = width * height * 4 * k;
      for (let i = 0; i < P.count; i++) for (let c = 0; c < 3; c++) half[o + i * 4 + c] = toHalf(arr[i * 3 + c]);
    });
    texture = new THREE.DataArrayTexture(half, width, height, names.length);
    texture.type = THREE.HalfFloatType;
    texture.format = THREE.RGBAFormat;
    texture.minFilter = texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.name = `MakeHuman face keys: ${name}`;
    texture.needsUpdate = true;
  }
  const out = { texture, names, width, count: names.length, part: name };
  data.cache.set(ck, out);
  return out;
}

/** A key's delta at a vertex of a part, as the shader reads it (the texture's half floats, scaled by kHead): tests and the CPU side. */
export function keyDelta(keys, kHead, key, i) {
  const k = keys.names.indexOf(key);
  if (k < 0 || !keys.texture) return [0, 0, 0];
  const { data, width, height } = keys.texture.image, o = width * height * 4 * k + i * 4, f = THREE.DataUtils.fromHalfFloat;
  return [f(data[o]) * kHead[0], f(data[o + 1]) * kHead[1], f(data[o + 2]) * kHead[2]];
}

/** A skinned part's geometry from its points (and its keys). */
function partGeometry(data, name, pts, kHead, tris = name) {
  const S = shared(data, tris);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pts), 3));
  g.setIndex(S.index);
  g.setAttribute('skinIndex', S.skinIndex);
  g.setAttribute('skinWeight', S.skinWeight);
  // (the face keys: the part's shared texture, this head's scale; materials.js FACE_KEYS, face-keys.js)
  const K = keyTexture(data, name);
  if (K.count) { g.userData.faceKeys = { texture: K.texture, names: K.names, width: K.width, kHead: [...kHead] }; g.userData.keys = K.names; }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * The landmarks the game needs, in bind space (the game's frame, metres), from a body's points:
 * face [eyeY, eyeX, noseY, noseZ, chinY] (the face ink), outfit [bootTop, beltY, neckY, wristX],
 * earZ, the head frame (the skull's centre over the head bone), the skull (an egg grown to hold the
 * whole crown: the hats' fit), the height.
 */
export function measure(data, body, eyes, bones) {
  const H = [];
  for (const i of data.head) H.push([body[i * 3], body[i * 3 + 1], body[i * 3 + 2]]);
  let ex0 = Infinity, ex1 = -Infinity, ey0 = Infinity, ey1 = -Infinity;
  for (let i = 0; i < eyes.length; i += 3) if (eyes[i] > 0) { ex0 = Math.min(ex0, eyes[i]); ex1 = Math.max(ex1, eyes[i]); ey0 = Math.min(ey0, eyes[i + 1]); ey1 = Math.max(ey1, eyes[i + 1]); }
  const eyeY = (ey0 + ey1) / 2, eyeX = (ex0 + ex1) / 2;
  const mid = H.filter((p) => Math.abs(p[0]) < 0.004);
  const tip = mid.reduce((a, p) => (p[2] > a[2] ? p : a), mid[0]);
  const [, noseY, noseZ] = tip;
  const front = mid.filter((p) => p[1] < noseY - 0.025 && p[1] > noseY - 0.14 && p[2] > noseZ - 0.075);
  const chinY = Math.min(...front.map((p) => p[1]));
  const half = Math.max(...H.map((p) => Math.abs(p[0])));
  const side = H.filter((p) => Math.abs(p[0]) > half - 0.012 && p[1] < eyeY + 0.01 && p[1] > eyeY - 0.05);
  const earZ = side.length ? side.reduce((a, p) => a + p[2], 0) / side.length : -0.02;
  const top = Math.max(...H.map((p) => p[1]));
  const up = H.filter((p) => p[1] > eyeY + 0.01);
  const zf = Math.max(...up.map((p) => p[2])), zb = Math.min(...up.map((p) => p[2])), zc = (zf + zb) / 2;
  let skull = { x: Math.max(...up.map((p) => Math.abs(p[0]))), y: top - eyeY, front: zf - zc, back: zc - zb };
  const crown = H.filter((p) => p[1] > eyeY + 0.03 && Math.abs(p[0]) < skull.x - 0.008);
  const r = crown.map((p) => Math.hypot(p[0] / skull.x, (p[1] - eyeY) / skull.y, (p[2] - zc) / (p[2] > zc ? skull.front : skull.back))).sort((a, b) => a - b);
  const k = Math.max(1, r[Math.floor(r.length * 0.99)] ?? 1);
  skull = Object.fromEntries(Object.entries(skull).map(([key, v]) => [key, v * k]));
  const hb = bones.Head, hand = bones.hand_l;
  let height = 0;
  for (let i = 1; i < body.length; i += 3) height = Math.max(height, body[i]);
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  return {
    face: [eyeY, eyeX, noseY, noseZ, chinY].map(r4),
    outfit: [bones.foot_l[1] + 0.045, bones.thigh_l[1], bones.neck_01[1] - 0.05, Math.abs(hand[0]) - 0.065].map(r4),
    earZ: r4(earZ), head: hb.map(r4), headFrame: [0, r4(eyeY - hb[1]), r4(zc - hb[2])],
    skull: Object.fromEntries(Object.entries(skull).map(([key, v]) => [key, r4(v)])), height: r4(height),
  };
}

/**
 * MakeHuman's eyes are realistically small and its upper lids rest low (half over the iris): at a
 * distance they close to slits. The upper lids are lifted (`lift`, m, most over the iris, none at the
 * corners) and the eyeballs grown a little about their centres (`grow`), on top of MakeHuman's own
 * eye-scale target (shape.js EYES).
 */
export const EYE_OPEN = { lift: 0.0012, grow: 1.05 };

/** Open a body's eyes (its points and the eyes', in place). */
export function openEyes(body, eyes, { lift = EYE_OPEN.lift, grow = EYE_OPEN.grow } = {}) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < eyes.length; i += 3) if (eyes[i] > 0) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], eyes[i + c]); hi[c] = Math.max(hi[c], eyes[i + c]); }
  const C = [0, 1, 2].map((c) => (lo[c] + hi[c]) / 2), R = [0, 1, 2].map((c) => (hi[c] - lo[c]) / 2);
  for (let i = 0; i < eyes.length; i += 3) {
    const s = Math.sign(eyes[i]) || 1;
    eyes[i] = s * (C[0] + (Math.abs(eyes[i]) - C[0]) * grow);
    eyes[i + 1] = C[1] + (eyes[i + 1] - C[1]) * grow;
    eyes[i + 2] = C[2] + (eyes[i + 2] - C[2]) * grow;
  }
  const sm = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < body.length; i += 3) {
    const ex = Math.abs(body[i]) - C[0], ey = body[i + 1] - C[1], ez = body[i + 2] - C[2];
    if (ey <= 0 || ez <= 0) continue;
    const rim = Math.hypot(ex / R[0], ey / R[1], ez / R[2]);
    if (rim > 1.7) continue;
    body[i + 1] += lift * sm(ey, 0, 0.002) * (1 - sm(rim, 1.15, 1.7)) * (1 - sm(Math.abs(ex) / R[0], 0.45, 0.9));
  }
  return { center: C, radii: R };
}

const _q = new THREE.Quaternion(), _v = new THREE.Vector3();

/** The skeleton for a shape: each bone at this person's head position, turned as the reference's (Blender's export frames). */
function skeletonOf(data, bonePts) {
  const meta = data.meta, bones = [], byName = {}, world = [];
  meta.bones.forEach((b, i) => {
    const o = new THREE.Bone();
    o.name = b.name;
    bones.push(o); byName[b.name] = o;
  });
  const heads = {};
  meta.bones.forEach((b, i) => { heads[b.name] = [bonePts[i * 3], bonePts[i * 3 + 1], bonePts[i * 3 + 2]]; });
  const roots = [];
  meta.bones.forEach((b, i) => {
    const o = bones[i], q = new THREE.Quaternion().fromArray(b.rotation);
    const parent = b.parent ? byName[b.parent] : null;
    const pi = parent ? meta.bones.findIndex((x) => x.name === b.parent) : -1;
    const pq = pi >= 0 ? world[pi] : new THREE.Quaternion();
    world[i] = pq.clone().multiply(q);
    o.quaternion.copy(q);
    const ph = parent ? heads[b.parent] : [0, 0, 0];
    _v.set(heads[b.name][0] - ph[0], heads[b.name][1] - ph[1], heads[b.name][2] - ph[2]).applyQuaternion(_q.copy(pq).invert());
    o.position.copy(_v);
    if (parent) parent.add(o); else roots.push(o);
  });
  return { bones, byName, roots, heads };
}

/**
 * A person as a Humanoid template (cached per person): params from shape.js personParams, o.brows
 * 0 (fine) or 1 (a man's), o.id (the profile's id: costumes are cached per body), o.label.
 */
export function makeBody(data, params, { brows = 0, id = null, label = '' } = {}) {
  const key = `body:${paramsKey(params)}|${brows}`;
  if (data.cache.has(key)) return data.cache.get(key);
  const S = shapeOf(data, params);
  const pos = S.pos, kHead = S.kHead;
  const bodyPts = part(data, pos, 'body'), eyePts = part(data, pos, 'eyes'), browName = `brows${brows}`;
  openEyes(bodyPts, eyePts);
  const sk = skeletonOf(data, part(data, pos, 'bones'));
  const scene = new THREE.Group();
  scene.name = 'MakeHuman';
  const arm = new THREE.Group();
  arm.name = 'Armature';
  scene.add(arm);
  for (const r of sk.roots) arm.add(r);
  const body = new THREE.SkinnedMesh(partGeometry(data, 'body', bodyPts, kHead), new THREE.MeshBasicMaterial());
  body.name = 'Body';
  const eyes = new THREE.SkinnedMesh(partGeometry(data, 'eyes', eyePts, kHead), new THREE.MeshBasicMaterial());
  eyes.name = 'Eyes';
  const browGeo = partGeometry(data, browName, part(data, pos, browName), kHead);
  taperBrows(browGeo);   // (a finer stroke: Warmer faces)
  browGeo.computeVertexNormals();
  const browMesh = new THREE.SkinnedMesh(browGeo, new THREE.MeshBasicMaterial());
  browMesh.name = 'Eyebrows';
  for (const m of [body, eyes, browMesh]) arm.add(m);
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(sk.bones);
  for (const m of [body, eyes, browMesh]) m.bind(skeleton, m.matrixWorld);
  const M = measure(data, bodyPts, eyePts, sk.heads);
  eyes.userData.eyeball = eyeballOf(eyes.geometry, M.face[0]);
  const years = params.years ?? null;
  scene.userData.profile = {
    id: `mh:${id ?? paramsKey(params)}`, source: 'makehuman', label, params, size: S.size, kHead, measured: M,
    face: M.face, outfit: M.outfit, earZ: M.earZ, headFrame: M.headFrame, skull: M.skull,
    headScale: (kind) => headScale(M.skull, kind),
    faceKeys: faceKeysFor,
    // how many face keys each mesh's material reads (materials.js FACE_KEYS)
    keyCounts: { body: body.geometry.userData.faceKeys?.names.length ?? 0, eyes: eyes.geometry.userData.faceKeys?.names.length ?? 0, brows: browGeo.userData.faceKeys?.names.length ?? 0 },
    // a child's face is drawn bare (face-ink.js faceYouth), unless the face says otherwise
    young: years === null ? undefined : Math.max(0, Math.min(1, (20 - years) / 12)),
    data, body: bodyPts, kind: params.gender > 0.5 ? 'm' : 'f',
  };
  data.cache.set(key, scene);
  return scene;
}

/** Another build of the same person's body, on its skeleton (a crowd body takes its person's build): the body's geometry. */
export function bodyGeometryFor(template, params) {
  const prof = template.userData.profile, data = prof.data;
  const key = `geo:${paramsKey(params)}`;
  if (data.cache.has(key)) return data.cache.get(key);
  const S = shapeOf(data, params);
  openEyes(part(data, S.pos, 'body'), part(data, S.pos, 'eyes'));
  const g = partGeometry(data, 'body', part(data, S.pos, 'body'), prof.kHead);
  g.userData.mhParams = params;
  data.cache.set(key, g);
  return g;
}
