// The MakeHuman bodies' hair (docs/makehuman.md, stage 1): MakeHuman's own CC0 hairstyles, made by
// scripts/makehuman/hair.py into closed shells of a few big locks (grooves between them: the ink's
// strand lines), and a beard from the skin of the jaw. Each shell vertex is bound to the low body (a
// triangle, its barycentric weights, an offset), so here it is fitted to whoever wears it: the point
// on their own triangle, the offset scaled with their head, and their skin's weights there (the head,
// the neck, the upper spine; never the arms).
//
// mhLookPieces(look, h) is the MakeHuman body's costumes.js lookPieces (humanoid.js costumeGeometry
// asks the profile for it): the game's hairstyles (HAIR_IDS) become the nearest MakeHuman style (and
// the game's own small pieces where MakeHuman has none: a topknot, buns, a crest); hats, masks,
// shoulder pieces and props stay the game's, fitted to the skull (profile.headScale); the beard mask
// is the jaw's own shell.
import * as THREE from 'three';
import { HEADS, MASKS, BODIES, PROPS, hairCap, hashSeed } from '../costumes.js';

/** MakeHuman's styles (scripts/makehuman/hair.py STYLES) and the beard. */
export const MH_STYLES = ['short01', 'short02', 'short03', 'short04', 'bob01', 'bob02', 'long01', 'ponytail01', 'braid01', 'afro01'];

/**
 * The game's hairstyles (costumes.js HAIR_IDS) on a MakeHuman head: the style (or a man's and a
 * woman's; a list: one is drawn per person), and `parts` when the game's own pieces go on top (the
 * knots and buns MakeHuman has none of). `game`: the game's own pieces alone (a shaved head, a crest,
 * a tonsure: hair too close to the skull to need a MakeHuman shape); none: bald.
 */
export const MH_HAIR = {
  short: { m: ['short02', 'short01'], f: ['short03'] },
  hair: { all: ['short04'], parts: true },
  tail: { all: ['ponytail01'] },
  long: { all: ['long01'] },
  bun: { all: ['short04'], parts: true },
  crop: { all: ['short04'] },
  shaved: { game: true },
  bald: {},
  curls: { all: ['afro01'] },
  braid: { all: ['braid01'] },
  flow: { all: ['long01'] },
  locks: { all: ['short04'], parts: true },
  crest: { game: true },
  bob: { all: ['bob02', 'bob01'] },
  twin: { all: ['short03'], parts: true },
  swept: { all: ['short01'] },
  tonsure: { game: true },
};

/** The MakeHuman style a look's hair is drawn in (null: none; `look.mhHair` forces one: the studio). */
export function mhStyleOf(look) {
  if (look?.mhHair && MH_STYLES.includes(look.mhHair)) return look.mhHair;
  const H = MH_HAIR[look?.head];
  if (!H) return null;
  const list = H.all ?? H[look.kind === 'f' ? 'f' : 'm'] ?? H.m;
  if (!list?.length) return null;
  return list[hashSeed(`${look.skin}|${look.hair}|${look.eyes}`) % list.length];
}

const FOLLOW = ['Head', 'neck_01', 'spine_03', 'spine_02'];
const AS = { clavicle_l: 'spine_03', clavicle_r: 'spine_03' };

/**
 * A style's shell fitted to a body: { geo (bind space: position, normal), joints(i) -> [bones, weights] }
 * (cached on the template). `prof` is the template's profile (src/makehuman/body.js makeBody).
 */
export function hairFor(prof, style) {
  prof.hairCache ??= new Map();
  if (prof.hairCache.has(style)) return prof.hairCache.get(style);
  const data = prof.data, meta = data.meta;
  if (!meta.hair[style]) return null;
  const tris = data.get(`h_${style}_tris`), tri = data.get(`h_${style}_tri`), bary = data.get(`h_${style}_bary`);
  const off = data.get(`h_${style}_off`), os = data.scale(`h_${style}_off`);
  const bt = data.get('body_tris'), P = prof.body, k = prof.kHead;
  const J = data.get('body_joints'), W = data.get('body_weights');
  const names = meta.bones.map((b) => b.name);
  const follow = new Set(FOLLOW.map((n) => names.indexOf(n)));
  const remap = new Map(Object.entries(AS).map(([a, b]) => [names.indexOf(a), names.indexOf(b)]));
  const n = tri.length, pos = new Float32Array(n * 3), joints = new Uint16Array(n * 4), weights = new Float32Array(n * 4);
  const acc = new Map();
  // the skin's weights at a point of the body (body vertices and their shares), the head, neck and upper spine only: into out J, W at i
  const skin = (pairs, oj, ow, i) => {
    acc.clear();
    for (const [v, wv] of pairs) {
      for (let q = 0; q < 4; q++) {
        let j = J[v * 4 + q];
        const wj = (W[v * 4 + q] / 255) * wv;
        if (!wj) continue;
        j = remap.get(j) ?? j;
        if (!follow.has(j)) j = data.headBone;
        acc.set(j, (acc.get(j) ?? 0) + wj);
      }
    }
    const top = [...acc].sort((x, y) => y[1] - x[1]).slice(0, 4);
    const sum = top.reduce((s, x) => s + x[1], 0) || 1;
    top.forEach(([j, wj], q) => { oj[i * 4 + q] = j; ow[i * 4 + q] = wj / sum; });
    if (!top.length) { oj[i * 4] = data.headBone; ow[i * 4] = 1; }
  };
  for (let i = 0; i < n; i++) {
    const t = tri[i], w0 = bary[i * 2] / 65535, w1 = bary[i * 2 + 1] / 65535, w2 = 1 - w0 - w1;
    const a = bt[t * 3], b = bt[t * 3 + 1], c = bt[t * 3 + 2];
    for (let d = 0; d < 3; d++) pos[i * 3 + d] = P[a * 3 + d] * w0 + P[b * 3 + d] * w1 + P[c * 3 + d] * w2 + off[i * 3 + d] * os * k[d];
    skin([[a, w0], [b, w1], [c, w2]], joints, weights, i);
  }
  // each lock its own normals: where two locks meet (in their groove) the surface creases, and the ink
  // pass draws the crease: the strand lines
  const lock = meta.buffers[`h_${style}_lock`] ? data.get(`h_${style}_lock`) : null;
  const split = splitLocks(tris, lock, n);
  const m = split.from.length;
  // the scalp under it (scripts/makehuman/hair.py scalp_of): the head's own skin there, just off it, in
  // the hair's colour, so where the shell sank under the skin (the crown of short02 and short04) no skin shows
  const sc = meta.buffers[`h_${style}_scalp`] ? scalpOf(P, bt, data.get(`h_${style}_scalp`), skin) : null;
  const ms = sc ? sc.from.length : 0;
  const P2 = new Float32Array((m + ms) * 3), J2 = new Uint16Array((m + ms) * 4), W2 = new Float32Array((m + ms) * 4);
  split.from.forEach((v, i) => { P2.set(pos.subarray(v * 3, v * 3 + 3), i * 3); J2.set(joints.subarray(v * 4, v * 4 + 4), i * 4); W2.set(weights.subarray(v * 4, v * 4 + 4), i * 4); });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P2, 3));
  geo.setIndex(new THREE.BufferAttribute(split.index, 1));
  geo.computeVertexNormals();
  creaseNormals(geo, split.from);
  if (sc) {
    // (appended after the shell's own normals: its vertices are the skin's, lifted along the skin's normals)
    const N2 = new Float32Array((m + ms) * 3);
    N2.set(geo.attributes.normal.array);
    P2.set(sc.pos, m * 3); N2.set(sc.normal, m * 3); J2.set(sc.joints, m * 4); W2.set(sc.weights, m * 4);
    const I = new Uint16Array(split.index.length + sc.index.length);
    I.set(split.index); for (let i = 0; i < sc.index.length; i++) I[split.index.length + i] = sc.index[i] + m;
    geo.setAttribute('position', new THREE.BufferAttribute(P2, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(N2, 3));
    geo.setIndex(new THREE.BufferAttribute(I, 1));
  }
  // the lock borders (the split vertices: on two locks at once), for a lighter strand line (humanoid.js HAIR_EDGE)
  const copies = new Map();
  for (const v of split.from) copies.set(v, (copies.get(v) ?? 0) + 1);
  const edge = new Float32Array(m + ms);
  split.from.forEach((v, i) => { edge[i] = copies.get(v) > 1 ? 1 : 0; });
  const out = { geo, joints: J2, weights: W2, style, locks: split.locks, scalp: sc ? sc.index.length / 3 : 0, edge };
  prof.hairCache.set(style, out);
  return out;
}

/** How far (m) the scalp under a hairstyle stands off the skin (hairFor). */
export const SCALP_LIFT = 0.0015;

/**
 * The scalp under a hairstyle: the body's triangles `faces` (indices into its triangles `bt`) as their
 * own small mesh on the body's points P, lifted SCALP_LIFT along the skin's normals, weighted by
 * `skin` (hairFor's): { pos, normal, joints, weights, index, from }.
 */
export function scalpOf(P, bt, faces, skin) {
  const at = new Map(), from = [];
  const index = new Uint16Array(faces.length * 3);
  faces.forEach((f, i) => {
    for (let k = 0; k < 3; k++) {
      const v = bt[f * 3 + k];
      if (!at.has(v)) { at.set(v, from.length); from.push(v); }
      index[i * 3 + k] = at.get(v);
    }
  });
  const n = from.length, pos = new Float32Array(n * 3), normal = new Float32Array(n * 3);
  from.forEach((v, i) => pos.set(P.subarray(v * 3, v * 3 + 3), i * 3));
  // the skin's normals there (from these triangles: the scalp is the skull's, smooth)
  for (let f = 0; f < index.length; f += 3) {
    const a = index[f] * 3, b = index[f + 1] * 3, c = index[f + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) { normal[o] += nx; normal[o + 1] += ny; normal[o + 2] += nz; }
  }
  const joints = new Uint16Array(n * 4), weights = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(normal[i * 3], normal[i * 3 + 1], normal[i * 3 + 2]) || 1;
    for (let d = 0; d < 3; d++) { normal[i * 3 + d] /= l; pos[i * 3 + d] += normal[i * 3 + d] * SCALP_LIFT; }
    skin([[from[i], 1]], joints, weights, i);
  }
  return { pos, normal, joints, weights, index, from };
}

/**
 * A shell's triangles with every vertex on a border between locks split, one copy per lock (so each
 * lock is smooth and the border a crease): { index, from (the source vertex of each new one), locks }.
 */
export function splitLocks(tris, lock, n) {
  if (!lock) return { index: Uint16Array.from(tris), from: Array.from({ length: n }, (_, i) => i), locks: 1 };
  const key = new Map(), from = [], index = new Uint16Array(tris.length);
  const locks = new Set();
  for (let f = 0; f < tris.length; f += 3) {
    const a = lock[tris[f]], b = lock[tris[f + 1]], c = lock[tris[f + 2]];
    const L = a === b || a === c ? a : b === c ? b : Math.min(a, b, c);
    locks.add(L);
    for (let k = 0; k < 3; k++) {
      const v = tris[f + k], id = v * 256 + L;
      let j = key.get(id);
      if (j === undefined) { j = from.length; key.set(id, j); from.push(v); }
      index[f + k] = j;
    }
  }
  return { index, from, locks: locks.size };
}

/** How far (rad) a lock's normals turn into the groove at its border: the two sides then differ by twice this, a crease the ink pass draws (post.js uNormalThresh). */
export const CREASE = 0.55;

/**
 * Each lock's normals at its border turned toward the groove (away from the lock's own middle), so
 * the border is a clean crease line whatever the groove's depth: Moebius' few strand lines.
 */
export function creaseNormals(geo, from, angle = CREASE) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, I = geo.index.array;
  const copies = new Map();
  for (const v of from) copies.set(v, (copies.get(v) ?? 0) + 1);
  const border = from.map((v) => copies.get(v) > 1);
  const c = new Float32Array(from.length * 3), cn = new Uint16Array(from.length);
  for (let f = 0; f < I.length; f += 3) {
    for (let k = 0; k < 3; k++) {
      const j = I[f + k];
      if (!border[j]) continue;
      for (let q = 1; q < 3; q++) { const o = I[f + (k + q) % 3]; c[j * 3] += P[o * 3]; c[j * 3 + 1] += P[o * 3 + 1]; c[j * 3 + 2] += P[o * 3 + 2]; cn[j] += 1; }
    }
  }
  const cs = Math.cos(angle), sn = Math.sin(angle);
  for (let j = 0; j < from.length; j++) {
    if (!border[j] || !cn[j]) continue;
    // into the lock: from the vertex toward its own triangles' middle, along the surface
    let tx = c[j * 3] / cn[j] - P[j * 3], ty = c[j * 3 + 1] / cn[j] - P[j * 3 + 1], tz = c[j * 3 + 2] / cn[j] - P[j * 3 + 2];
    const nx = N[j * 3], ny = N[j * 3 + 1], nz = N[j * 3 + 2], d = tx * nx + ty * ny + tz * nz;
    tx -= d * nx; ty -= d * ny; tz -= d * nz;
    const tl = Math.hypot(tx, ty, tz);
    if (tl < 1e-9) continue;
    const x = nx * cs - (tx / tl) * sn, y = ny * cs - (ty / tl) * sn, z = nz * cs - (tz / tl) * sn, l = Math.hypot(x, y, z);
    N[j * 3] = x / l; N[j * 3 + 1] = y / l; N[j * 3 + 2] = z / l;
  }
  geo.attributes.normal.needsUpdate = true;
}

/** A shell as a costume piece for humanoid.js costumeGeometry: { geo, role, joints(i) } on the template's skeleton (bone indices map onto the body's). */
function skinnedPiece(h, shell, role = 'hair') {
  const bones = h.body.skeleton.bones, names = h.profile.data.meta.bones.map((b) => b.name);
  const map = names.map((n) => Math.max(0, bones.indexOf(h.b[n])));
  return {
    geo: shell.geo.clone(), role, edge: shell.edge ?? null,
    joints: (i) => [[0, 1, 2, 3].map((q) => map[shell.joints[i * 4 + q]]), [0, 1, 2, 3].map((q) => shell.weights[i * 4 + q])],
  };
}

/** Every piece a look shows on a MakeHuman body, as costumes.js lookPieces, and `skinned`: the shells. */
export function mhLookPieces(look, h) {
  const H = HEADS[look.head] ?? HEADS.hood, M = MH_HAIR[look.head];
  const head = [], skinned = [];
  if (M) {
    // a hairstyle: MakeHuman's shape of it (or the game's own close ones), the game's knots and buns on top
    const st = mhStyleOf(look), shell = st && hairFor(h.profile, st);
    if (shell) skinned.push(skinnedPiece(h, shell));
    else if (M.game) head.push(...(H.base ? H.base(1, look) : H.cap ? [hairCap(1, look.kind === 'f' ? 'f' : 'm')] : []));
    if (M.parts || M.game) head.push(...H.parts(1, look));
  } else {
    // headwear: the game's, fitted to the skull, the short hair under it the game's cap
    if (H.cap) head.push(hairCap(1, look.kind === 'f' ? 'f' : 'm'));
    head.push(...H.parts(1, look));
  }
  if (look.mask === 'beard') {
    const b = hairFor(h.profile, 'beard');
    if (b) skinned.push(skinnedPiece(h, b));
  } else head.push(...(MASKS[look.mask] ?? MASKS.none)(1));
  return { head, chest: (BODIES[look.body] ?? BODIES.none)(1), hand: (PROPS[look.prop] ?? PROPS.none)(1), skinned };
}
