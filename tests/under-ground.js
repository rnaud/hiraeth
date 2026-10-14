// How far a model's lowest drawn point is under the ground (m): every vertex of every drawn part as three.js draws it
// (skinned on its bones, each instance of an instanced part), for tests/foe-slope.test.js and tests/foe-hit-defeat.test.js.
//
// Exact, and cheap: on a ground that is a plane (made by plane(): the most a plane rises over a box's footprint is at
// one of its corners) the vertices that cannot go deeper than what is measured already, or than `floor`, are not
// skinned. A part's vertices are kept in a tree of boxes, built once in the frame they are carried in: a plain part's
// own frame (not three's cached boundingBox), a skinned part's bones' (boneInverse · bindMatrix · v, by the set of bones
// a vertex hangs on); each frame a box is taken through the matrix it is drawn by now (world · instance, or world ·
// bindMatrixInverse · bone), and a box wholly above that depth is passed over with all it holds. A skinned vertex is a
// weighted sum of its bones' transforms of it, so it lies in the hull of its bones' boxes (weights not summing to 1
// widen it by how far off they are; a negative weight: those vertices always skinned). The vertices that are measured
// are measured exactly as before, so the worst depth, and the part it is on (the first to reach it, in the same order),
// are the same to the last bit; only depths at or under `floor` may come back lower (a caller keeping the worst over
// many frames passes the worst so far). On any other ground every vertex is measured.
import * as THREE from 'three';

const EPS = 1e-7;   // (m: the bound's own rounding, a few ulps of a few metres, many times over)
const LEAF = 24;    // (vertices in a box of the tree's last level)

/** The ground y = sx·x + sz·z + c, as a function of (x, z) that the cheap bound may trust. */
export function plane(sx, sz, c = 0) {
  const fn = sx === 0 && sz === 0 ? () => c : c === 0 ? (x, z) => sx * x + sz * z : (x, z) => sx * x + sz * z + c;
  fn.plane = { sx, sz, c };
  return fn;
}

/** An attribute's version (an interleaved one's is its buffer's): it goes up whenever its values are changed for drawing. */
const ver = (a) => (a.isInterleavedBufferAttribute ? a.data.version : a.version);

const _p = new THREE.Vector3(), _im = new THREE.Matrix4(), _b = new THREE.Box3(), _u = new THREE.Box3();

/**
 * A tree of boxes over the vertices `list`, their points in each of the frames `pts` (pts[f]: x, y, z per vertex index):
 * each node { list, boxes (one per frame), parts (two halves, or none at the last level) }, split at the middle of the
 * first frame's longest side (in half by count if all its points fall on one side).
 */
function tree(list, pts) {
  const boxes = pts.map((q) => {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (const i of list) {
      const x = q[i * 3], y = q[i * 3 + 1], z = q[i * 3 + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    return new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  });
  if (list.length <= LEAF) return { list: Uint32Array.from(list), boxes, parts: null };
  const { min, max } = boxes[0], s = [max.x - min.x, max.y - min.y, max.z - min.z];
  const ax = s[0] >= s[1] && s[0] >= s[2] ? 0 : s[1] >= s[2] ? 1 : 2, mid = (min.getComponent(ax) + max.getComponent(ax)) / 2, q = pts[0];
  let lo = list.filter((i) => q[i * 3 + ax] < mid), hi = list.filter((i) => !(q[i * 3 + ax] < mid));
  if (!lo.length || !hi.length) { lo = list.slice(0, list.length >> 1); hi = list.slice(list.length >> 1); }
  return { list: null, boxes, parts: [tree(lo, pts), tree(hi, pts)] };
}

/** A plain part's tree, in its own frame, kept while its positions stay as they are. */
const plains = new WeakMap();
function plainOf(P) {
  let c = plains.get(P);
  if (!c || c.version !== ver(P) || c.count !== P.count) {
    const q = new Float64Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { q[i * 3] = P.getX(i); q[i * 3 + 1] = P.getY(i); q[i * 3 + 2] = P.getZ(i); }
    plains.set(P, (c = { version: ver(P), count: P.count, root: P.count ? tree([...Array(P.count).keys()], [q]) : null }));
  }
  return c;
}

/**
 * A skinned part's vertices by the set of bones they hang on: each set's bones, a tree of its vertices in each bone's
 * frame, and how far its weights are from summing to 1; or `always`, measured whatever (a negative weight, none).
 */
const skins = new WeakMap();
function skinOf(o) {
  const g = o.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, S = o.skeleton;
  const sig = [P, ver(P), SI, ver(SI), SW, ver(SW), S, ...S.bones, ...o.bindMatrix.elements, ...S.boneInverses.flatMap((m) => m.elements)];
  let c = skins.get(o);
  if (c && c.sig.length === sig.length && c.sig.every((x, i) => x === sig[i])) return c;
  const q = S.bones.map(() => null), sets = new Map(), v = new THREE.Vector4(), base = new THREE.Vector4();
  for (let i = 0; i < P.count; i++) {
    base.set(P.getX(i), P.getY(i), P.getZ(i), 1).applyMatrix4(o.bindMatrix);
    const on = [];
    let sum = 0, negative = false;
    for (let k = 0; k < 4; k++) {
      const w = SW.getComponent(i, k);
      if (w === 0) continue;
      const j = SI.getComponent(i, k);
      if (w < 0) negative = true;
      sum += w; on.push(j);
      v.copy(base).applyMatrix4(S.boneInverses[j]);
      const Q = (q[j] ??= new Float64Array(P.count * 3));
      Q[i * 3] = v.x; Q[i * 3 + 1] = v.y; Q[i * 3 + 2] = v.z;
    }
    const key = negative || !on.length ? 'always' : [...new Set(on)].sort((a, b) => a - b).join(',');
    let s = sets.get(key);
    if (!s) sets.set(key, (s = { always: key === 'always', bones: key === 'always' ? [] : key.split(',').map(Number), off: 0, list: [] }));
    s.off = Math.max(s.off, Math.abs(1 - sum));
    s.list.push(i);
  }
  for (const s of sets.values()) {
    if (s.always) s.list = Uint32Array.from(s.list);
    else s.root = tree(s.list, s.bones.map((j) => q[j]));
  }
  c = { sig, sets: [...sets.values()], M: S.bones.map(() => new THREE.Matrix4()) };
  skins.set(o, c);
  return c;
}

/**
 * The worst depth under `ground` of any vertex of the drawn parts of `group` ({ worst, who: the part's parent's name }).
 * keep(mesh): only those meshes. floor: a depth the caller does not need beyond (the worst so far); a ground made by
 * plane() lets parts that cannot reach past it be passed over (on any other ground every vertex is measured).
 */
export function underGround(group, ground, { floor = -Infinity, keep = null } = {}) {
  group.updateMatrixWorld(true);
  let worst = -Infinity, who = '';
  const flat = !!ground.plane, A = new THREE.Matrix4(), W = new THREE.Matrix4(), b0 = new THREE.Vector3();
  const measure = (o, P, i, inst) => {
    _p.fromBufferAttribute(P, i);
    if (o.isSkinnedMesh) o.applyBoneTransform(i, _p);
    if (inst) _p.applyMatrix4(_im);
    _p.applyMatrix4(o.matrixWorld);
    const d = ground(_p.x, _p.z) - _p.y;
    if (d > worst) { worst = d; who = o.parent?.name || o.name || o.type; }
  };
  // a node of a tree, its boxes through the matrices Ms (pad: how far its points may lie outside their hull), passed
  // over when every vertex in it is at most as deep as what is measured already, or as the floor
  const visit = (node, Ms, pad, o, P, inst) => {
    _u.makeEmpty();
    for (let k = 0; k < Ms.length; k++) _u.union(_b.copy(node.boxes[k]).applyMatrix4(Ms[k]));
    if (pad) _u.expandByScalar(pad(_u));
    const top = Math.max(ground(_u.min.x, _u.min.z), ground(_u.max.x, _u.min.z), ground(_u.min.x, _u.max.z), ground(_u.max.x, _u.max.z));
    if (top - _u.min.y + EPS <= Math.max(worst, floor)) return;
    if (node.parts) { for (const n of node.parts) visit(n, Ms, pad, o, P, inst); return; }
    for (const i of node.list) measure(o, P, i, inst);
  };
  group.traverseVisible((o) => {
    const P = o.isMesh && o.geometry?.attributes?.position;
    if (!P || (keep && !keep(o))) return;
    if (!flat) {
      for (let k = 0; k < (o.isInstancedMesh ? o.count : 1); k++) {
        if (o.isInstancedMesh) o.getMatrixAt(k, _im);
        for (let i = 0; i < P.count; i++) measure(o, P, i, o.isInstancedMesh);
      }
      return;
    }
    if (o.isSkinnedMesh) {
      const S = skinOf(o), bones = o.skeleton.bones;
      // (each bone's frame to the world as it is drawn: world · bindMatrixInverse · bone)
      A.multiplyMatrices(o.matrixWorld, o.bindMatrixInverse);
      b0.setFromMatrixPosition(A);
      for (let j = 0; j < bones.length; j++) S.M[j].multiplyMatrices(A, bones[j].matrixWorld);
      for (const s of S.sets) {
        if (s.always) { for (const i of s.list) measure(o, P, i, false); continue; }
        // (weights summing to w: the vertex is c + (1 - w)(A·0 - c), c in the hull of its bones' boxes)
        const pad = s.off ? (u) => s.off * (Math.max(Math.abs(b0.x), Math.abs(b0.y), Math.abs(b0.z)) + Math.max(-u.min.x, -u.min.y, -u.min.z, u.max.x, u.max.y, u.max.z, 0)) : null;
        visit(s.root, s.bones.map((j) => S.M[j]), pad, o, P, false);
      }
      return;
    }
    const T = plainOf(P);
    if (!T.root) return;
    for (let k = 0; k < (o.isInstancedMesh ? o.count : 1); k++) {
      if (o.isInstancedMesh) o.getMatrixAt(k, _im);
      W.copy(o.matrixWorld);
      if (o.isInstancedMesh) W.multiply(_im);
      visit(T.root, [W], null, o, P, o.isInstancedMesh);
    }
  });
  return { worst, who };
}
