import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TRAVELLER_PALETTE as PAL, TRAVELLER_TONES } from './traveller-style.js';
import { scalp, skullPoint } from './costumes.js';

// The traveller wears the reference sheets' coral overshirt, cream trousers,
// round satchel and an ordinary canvas rucksack (the fluid flask sits in its
// outer face, fluid-tool.js). Clothes follow the people's original skeleton and
// weights so locomotion, climbing and equipment anchors keep their existing
// behaviour. traveller.glb supplies only the soft boots; the coat, hair, scarf
// and bags are built here in bind space, then skinned onto that same rig.

/** Fit settings, in metres on the body's bind pose (the T-pose, feet at 0, facing +z). */
export const TRAVELLER = {
  // MODE_OUTFIT zones: cropped trouser hem, waist, neck, rolled sleeve end
  outfit: [0.27, 0.97, 1.47, 0.52],
  // the baggy suit: how far it stands off the body
  swell: { torso: 0.012, arm: 0.018, forearm: 0.012, clavicle: 0.015, leg: 0.05, hand: 0 },   // (loose, baggy trousers, as on the sheets)
  backGap: 0.025,        // the tank clears the loose jacket
  boot: { margin: 0.014, sole: -0.012 },   // room round the foot; the sole's bottom (the foot's own pokes 1 cm under 0)
  // his own face (morph.js FACE_MORPHS, Humanoid.setFace): about twenty-six, a lean young face after the
  // coral-jacket sheets: slim cheeks under the cheekbones, a narrow jaw and a small pointed chin, the
  // face a little long and narrow, a straight nose, a soft brow, bright eyes, hardly a line on it, a few
  // freckles (on the people's gentler modelled face, humanoid.js reshape; `young` keeps his ink a
  // little over half a child's: face-ink.js faceYouth)
  face: { cheeks: -0.3, faceLength: 1.02, headWidth: 0.95, noseLength: 0.86, noseWidth: 0.9, jaw: 0.9, chin: 0.25, browRidge: -0.4, eyeSize: 1.1, eyeHeight: 0.1,
    lines: 0.12, lidWeight: 0.95, mouthWidth: 0.94, freckles: 0.3, young: 0.55 },
  // and at rest the corners of his mouth a little up (src/expression.js; the conversations go from there)
  rest: { smile: 0.2 },
};

const BONE = (bones, name) => { const i = bones.findIndex((b) => b.name === name); if (i < 0) throw new Error(`no bone ${name}`); return i; };
const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);

/** Bind-pose position of a bone, in the body geometry's coordinates. */
function bindPos(body, name) {
  const i = BONE(body.skeleton.bones, name);
  return new THREE.Vector3().setFromMatrixPosition(body.skeleton.boneInverses[i].clone().invert()).applyMatrix4(body.bindMatrixInverse);
}

// ------------------------------------------------------------------ the suit
const suits = new WeakMap();
/**
 * The body made into the traveller's baggy suit (cached per body geometry): the same vertices,
 * weights and skeleton, each vertex moved out along its welded normal by its region's swell.
 */
export function suitGeometry(body) {
  const base = body.userData.baseGeometry ?? body.geometry;
  if (suits.has(base)) return suits.get(base);
  const bones = body.skeleton.bones;
  const group = bones.map((b) => (/^upperarm/.test(b.name) ? 'arm' : /^lowerarm/.test(b.name) ? 'forearm' : /^clavicle/.test(b.name) ? 'clavicle'
    : /^(thigh|calf)/.test(b.name) ? 'leg' : /^(pelvis|spine)/.test(b.name) ? 'torso' : /^(hand|index|middle|ring|pinky|thumb)/.test(b.name) ? 'hand' : null));   // head, neck, feet: none
  const g = base.clone();
  const P = g.attributes.position, N = base.attributes.normal, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
  // welded normals: the vertices split along the model's seams share one, so the suit doesn't crack open there
  const key = (i) => `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`;
  const sums = new Map(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    const k = key(i);
    sums.set(k, (sums.get(k) ?? new THREE.Vector3()).add(n.fromBufferAttribute(N, i)));
  }
  const [bootTop, , neckY, wristX] = TRAVELLER.outfit, S = TRAVELLER.swell;
  for (let i = 0; i < P.count; i++) {
    const w = { arm: 0, forearm: 0, clavicle: 0, leg: 0, torso: 0, hand: 0 };
    for (let k = 0; k < 4; k++) { const gr = group[J.getComponent(i, k)]; if (gr) w[gr] += W.getComponent(i, k); }
    const x = P.getX(i), y = P.getY(i), ax = Math.abs(x);
    n.copy(sums.get(key(i))).normalize();
    // the collar comes in to the neck (the scarf hides the edge)
    const collar = 1 - smooth(y, neckY - 0.07, neckY) * (1 - smooth(ax, 0.1, 0.17));
    // sleeves gather at their rolled ends; trousers narrow toward the cropped hems
    const sleeve = 1 - smooth(ax, wristX - 0.15, wristX - 0.025);
    const trouser = smooth(y, bootTop - 0.01, bootTop + 0.17);
    // the legs' inner sides stand off less, so the trousers don't fuse between the knees
    const inner = THREE.MathUtils.clamp(-n.x * Math.sign(x || 1), 0, 1) * (1 - smooth(y, 0.8, 0.95));
    const d = (S.torso * w.torso + S.clavicle * w.clavicle) * collar + (S.arm * w.arm + S.forearm * w.forearm) * sleeve + S.leg * w.leg * trouser * (1 - 0.65 * inner) + S.hand * w.hand;   // hands stay bare
    if (d > 0) P.setXYZ(i, x + n.x * d, y + n.y * d, P.getZ(i) + n.z * d);
  }
  P.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  suits.set(base, g);
  return g;
}

// ------------------------------------------------------------------ geometry helpers
/** A geometry reduced to position + normal + an index, its vertices moved by m. */
function plain(geo, m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.attributes.position.clone());
  g.setAttribute('normal', geo.attributes.normal ? geo.attributes.normal.clone() : geo.attributes.position.clone());
  g.setIndex(geo.index ? [...geo.index.array] : [...Array(geo.attributes.position.count).keys()]);
  if (!geo.attributes.normal) g.computeVertexNormals();
  if (m) g.applyMatrix4(m);
  return g;
}
/** The triangles of an indexed geometry that pass keep(a, b, c), with only the vertices they use. */
function pick(geo, keep) {
  const idx = geo.index.array, used = new Map(), out = [];
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [idx[t], idx[t + 1], idx[t + 2]];
    if (!keep(...tri)) continue;
    for (const v of tri) { if (!used.has(v)) used.set(v, used.size); out.push(used.get(v)); }
  }
  const g = new THREE.BufferGeometry(), order = [...used.keys()];
  for (const [k, a] of Object.entries(geo.attributes)) {
    const arr = k === 'skinIndex' ? new Uint16Array(order.length * a.itemSize) : new Float32Array(order.length * a.itemSize);
    order.forEach((v, i) => { for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(v, c); });
    g.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize));
  }
  g.setIndex(out);
  return g;
}
/** Skin every vertex of a piece to one bone. */
function rigid(g, bone) {
  const n = g.attributes.position.count, J = new Uint16Array(n * 4), W = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { J[i * 4] = bone; W[i * 4] = 1; }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(J, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(W, 4));
  return g;
}
/**
 * Skin a piece like the suit beneath it: each vertex takes the weights of the nearest suit vertex,
 * keeping only the bones `allow` names (renormalised; `fallback` if none is left). With `one`, the
 * whole piece takes the weights at that point (a rigid-ish pouch).
 */
function conform(g, suit, body, allow, fallback, one = null) {
  const bones = body.skeleton.bones, ok = bones.map((b) => allow.test(b.name));
  const SP = suit.attributes.position, SJ = suit.attributes.skinIndex, SW = suit.attributes.skinWeight;
  const weightsAt = (p) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < SP.count; i++) {
      const dx = SP.getX(i) - p.x, dy = SP.getY(i) - p.y, dz = SP.getZ(i) - p.z, d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    const js = [], ws = [];
    for (let k = 0; k < 4; k++) { const j = SJ.getComponent(best, k), w = SW.getComponent(best, k); if (w > 0 && ok[j]) { js.push(j); ws.push(w); } }
    const sum = ws.reduce((a, b) => a + b, 0);
    if (sum < 1e-6) return [[fallback, 0, 0, 0], [1, 0, 0, 0]];
    while (js.length < 4) { js.push(0); ws.push(0); }
    return [js, ws.map((w) => w / sum)];
  };
  const P = g.attributes.position, n = P.count, J = new Uint16Array(n * 4), W = new Float32Array(n * 4);
  const fixed = one ? weightsAt(one) : null, v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const [js, ws] = fixed ?? weightsAt(v.fromBufferAttribute(P, i));
    J.set(js, i * 4); W.set(ws, i * 4);
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(J, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(W, 4));
  return g;
}
/** A flat strap (width × thickness) along points on a surface, each with its outward normal. */
function ribbon(points, normals, width, thick) {
  const curve = new THREE.CatmullRomCurve3(points), nc = new THREE.CatmullRomCurve3(normals);
  const steps = Math.max(8, points.length * 6), pos = [], idx = [];
  const p = new THREE.Vector3(), t = new THREE.Vector3(), nn = new THREE.Vector3(), b = new THREE.Vector3();
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    curve.getPoint(u, p); curve.getTangent(u, t); nc.getPoint(u, nn).normalize();
    b.crossVectors(t, nn).normalize();
    nn.crossVectors(b, t).normalize();
    for (const [cb, cn] of [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]]) pos.push(p.x + b.x * cb * width + nn.x * cn * thick, p.y + b.y * cb * width + nn.y * cn * thick, p.z + b.z * cb * width + nn.z * cn * thick);
  }
  for (let s = 0; s < steps; s++) for (let k = 0; k < 4; k++) {
    const a = s * 4 + k, c = s * 4 + ((k + 1) % 4), d = a + 4, e = c + 4;
    idx.push(a, d, c, c, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** A closed band through rings of points (rows of equal length): a belt, a cuff. */
function band(rows) {
  const cols = rows[0].length, pos = [], idx = [];
  for (const r of rows) for (const q of r) pos.push(q.x, q.y, q.z);
  for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < cols; c++) {
    const a = r * cols + c, b = r * cols + ((c + 1) % cols), d = a + cols, e = b + cols;
    idx.push(a, b, d, b, e, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A cloth panel with open side edges (rows run across the fabric). */
function openPanel(rows) {
  const cols = rows[0].length, pos = [], idx = [];
  for (const row of rows) for (const p of row) pos.push(...p.toArray());
  for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const a = r * cols + c, b = a + 1, d = a + cols;
    idx.push(a, b, d, b, d + 1, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ measuring the body
/** Vertices of a geometry (bind pose) that pass test(p): an array of Vector3. */
function points(geo, test) {
  const P = geo.attributes.position, out = [], v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); if (test(v, i)) out.push(v.clone()); }
  return out;
}
const boxOf = (pts) => new THREE.Box3().setFromPoints(pts);
/** Vertices mostly skinned to the bones `re` names. */
function onBones(geo, body, re, min = 0.5) {
  const ok = body.skeleton.bones.map((b) => re.test(b.name)), J = geo.attributes.skinIndex, W = geo.attributes.skinWeight;
  return (p, i) => { let w = 0; for (let k = 0; k < 4; k++) if (ok[J.getComponent(i, k)]) w += W.getComponent(i, k); return w >= min; };
}
/** The furthest a surface reaches from a point along a direction, among vertices near that ray (radius r). */
function reach(pts, from, dir, r = 0.03) {
  let best = 0;
  const d = dir.clone().normalize(), v = new THREE.Vector3();
  for (const p of pts) {
    v.subVectors(p, from);
    const t = v.dot(d);
    if (t <= 0) continue;
    if (v.addScaledVector(d, -t).lengthSq() < r * r) best = Math.max(best, t);
  }
  return best;
}

// ------------------------------------------------------------------ his hair
/** A deterministic 0..1 hash (the hair's locks are the same on every load, in the studio and the portraits). */
const hash = (k, s = 0) => { const x = Math.sin(k * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
/**
 * One lock of hair: a flat, tapering blade from `root` (head frame) leaving along `dir`, curling
 * toward `curl` as it goes (its end bends by `bend`, m), `w` wide at the root, `len` long.
 */
function lock(root, dir, curl, len, w, bend, flat = 0.32, tip = 0.3) {
  const g = new THREE.CylinderGeometry(w * tip, w, len, 6, 4, true).translate(0, len / 2, 0);   // the wide root at 0, the blunt tip at +len
  const Y = dir.clone().normalize(), C = curl.clone().addScaledVector(Y, -curl.dot(Y)).normalize();
  const X = new THREE.Vector3().crossVectors(Y, C), P = g.attributes.position, v = new THREE.Vector3();
  const tint = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    const t = v.y / len, r = w * (1 - (1 - tip) * t);
    // the lock's two edges print lighter (dark hair's strand lines would vanish in its own ink: humanoid.js HAIR_EDGE)
    tint.fill(1 + HAIR_EDGE_LIFT * Math.min(1, Math.abs(v.x) / r) ** 3, i * 3, i * 3 + 3);
    // flattened across (a lock is a blade, not a spike), bent along its length
    v.set(0, 0, 0).addScaledVector(X, P.getX(i)).addScaledVector(C, P.getZ(i) * flat).addScaledVector(Y, P.getY(i)).addScaledVector(C, bend * t * t).add(root);
    P.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g.setAttribute('color', new THREE.BufferAttribute(tint, 3));
  g.computeVertexNormals();
  return g;
}
/** How much lighter a lock's edges print than its middle (a multiple of the hair's colour). */
const HAIR_EDGE_LIFT = 0.9;
/**
 * Scruffy dark hair in the head frame, after the coral-jacket sheets: a ragged scalp under a
 * mop of broken, tousled locks: a fringe falling unevenly over the brow, curls lifting off the crown
 * at odd angles, a few strays standing up, shaggy over the ears and ragged at the nape.
 */
export function travellerHair() {
  const parts = [scalp(1, { kind: 'm', t: 0.018, front: 24, side: -20, back: -42, crown: 0.02, quiff: 0.012, jag: 7, bump: 0.007 })];
  const S = (az, el, t) => new THREE.Vector3(...skullPoint('m', az, el, t));
  const out = (az, el) => S(az, el, 0.05).sub(S(az, el, 0)).normalize();
  const down = new THREE.Vector3(0, -1, 0), fwd = new THREE.Vector3(0, 0, 1);
  // the fringe: uneven locks falling forward and down over the brow, swept a little to his right
  for (let k = 0; k < 10; k++) {
    const az = -54 + k * 12 + (hash(k, 1) - 0.5) * 6, el = 50 + hash(k, 2) * 10;
    const n = out(az, el);
    const dir = n.clone().multiplyScalar(0.3).addScaledVector(fwd, 0.5).addScaledVector(down, 0.85).add(new THREE.Vector3(-0.25 + (hash(k, 3) - 0.5) * 0.6, 0, 0));
    // (the ends curl back in toward the brow rather than poking out)
    parts.push(lock(S(az, el, 0.012), dir, n.clone().negate(), 0.042 + hash(k, 4) * 0.026 + (Math.abs(az) < 24 ? 0.02 : 0), 0.026 + hash(k, 5) * 0.008, 0.012 + hash(k, 6) * 0.01, 0.4));
  }
  // the mop: thick curls lifting off the skull every which way (golden-angle spread, jittered),
  // each arcing out and back over toward the head, so the outline is broken into round bumps
  for (let k = 0; k < 56; k++) {
    const az = k * 137.5 + (hash(k, 7) - 0.5) * 30, el = Math.max(16 + hash(k, 8) * 68, Math.cos(az * Math.PI / 180) > 0.4 ? 40 : 0);   // (behind the hairline over the brow)
    const n = out(az, el), side = new THREE.Vector3(-n.z, 0, n.x).normalize();
    // (over the face the locks lift up and back off the brow, so none falls in front of the eyes: the fringe does that)
    const front = Math.max(0, Math.cos(az * Math.PI / 180)) ** 2 * (el < 62 ? 1 : 0.3);
    const dir = n.clone().multiplyScalar(0.6 + hash(k, 9) * 0.4).addScaledVector(side, (hash(k, 10) - 0.5) * 2.2 * (1 - front * 0.6)).addScaledVector(down, 0.2 * (1 - front)).addScaledVector(fwd, -front * 0.5).add(new THREE.Vector3(0, front * 0.35, 0));
    const len = (0.038 + hash(k, 11) ** 2 * 0.045) * (el > 66 ? 0.7 : 1);   // (shorter on the crown: a mop, not a crest)
    parts.push(lock(S(az, el, 0.012), dir, n.clone().negate().addScaledVector(side, hash(k, 24) - 0.5), len, 0.028 + hash(k, 12) * 0.013, len * (0.45 + hash(k, 13) * 0.3), 0.5, 0.6));
  }
  // a few thin strays standing up and off the crown
  for (let k = 0; k < 4; k++) {
    const az = 160 + k * 55 + hash(k, 14) * 20, el = 62 + hash(k, 15) * 16;
    const n = out(az, el);
    parts.push(lock(S(az, el, 0.02), n.clone().add(new THREE.Vector3(0, 0.6, 0)), new THREE.Vector3(hash(k, 16) - 0.5, -0.3, hash(k, 17) - 0.5), 0.032 + hash(k, 18) * 0.02, 0.008, 0.018, 0.5, 0.2));
  }
  // shaggy over the tops of the ears and ragged down the nape
  for (let k = 0; k < 14; k++) {
    const nape = k >= 6, az = nape ? 140 + (k - 6) * 11 + hash(k, 19) * 5 : (k < 3 ? 1 : -1) * (88 + (k % 3) * 16), el = nape ? -18 - hash(k, 20) * 16 : 2 + hash(k, 21) * 10;
    const n = out(az, el);
    parts.push(lock(S(az, el, 0.012), n.clone().multiplyScalar(0.35).addScaledVector(down, 1), n.clone().negate(), 0.035 + hash(k, 22) * 0.025, 0.022, 0.01 + hash(k, 23) * 0.008, 0.4, 0.4));
  }
  return mergeGeometries(parts.map((g) => {
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    return g;
  }));
}

// ------------------------------------------------------------------ his rucksack
/**
 * The rucksack, in the chest anchor's frame (y 0 at the hips, the collar at 0.76, +z forward; the
 * fluid tank's frame, fluid-tool.js TANK): body, lid, buckled lid straps and a side pocket, plus an
 * outer pocket the flask hides when it sits there. Soft canvas, an ordinary traveller's bag.
 */
export const RUCKSACK = {
  back: -0.145,             // its back face, against the jacket
  depth: 0.105,             // front to back (the flask sinks into its outer face, TANK.at)
  width: 0.31, bottom: 0.25, top: 0.705,
};
function rucksack(chestY, chestZ) {
  const R = RUCKSACK, hw = R.width / 2, cz = R.back - R.depth / 2, out = R.back - R.depth, cy = (R.bottom + R.top) / 2, hh = (R.top - R.bottom) / 2;
  const toBind = new THREE.Matrix4().makeTranslation(0, chestY, chestZ);
  const soft = (w, h, d, r, x, y, z, shape = () => {}) => {
    const g = new RoundedBoxGeometry(w, h, d, 3, r), P = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); shape(v, w / 2, h / 2, d / 2); P.setXYZ(i, v.x + x, v.y + y, v.z + z); }
    g.computeVertexNormals();
    return plain(g, toBind);
  };
  // the body: soft canvas, a little narrower at the top, bellied on its outer face and sagging at the bottom
  const body = soft(R.width, hh * 2, R.depth, 0.04, 0, cy, cz, (v, a, b, c) => {
    const u = (v.y / b + 1) / 2;
    v.x *= 1 - 0.07 * u;
    if (v.z < 0) v.z -= 0.012 * (1 - (v.x / a) ** 2) * (1 - (v.y / b) ** 2);
    v.x += 0.004 * Math.sin(v.y * 40);
    if (u < 0.15) v.x *= 1 + 0.04 * (1 - u / 0.15);
  });
  // the lid: a soft flap over the top, overhanging all round, its front lip turned down
  const lid = soft(R.width + 0.01, 0.06, R.depth + 0.018, 0.026, 0, R.top - 0.012, cz - 0.004, (v, a, b, c) => {
    v.y -= 0.022 * (v.z / c < -0.4 ? (-v.z / c - 0.4) / 0.6 : 0) + 0.01 * (v.x / a) ** 2;
  });
  // two leather straps down the lid's front to buckles on the body (either side of the flask's neck)
  const straps = [], buckles = [];
  for (const sx of [-1, 1]) {
    const x = sx * 0.133;
    straps.push(plain(new THREE.BoxGeometry(0.026, 0.13, 0.006).translate(x, R.top - 0.06, out - 0.012), toBind));
    buckles.push(plain(new THREE.TorusGeometry(0.012, 0.0035, 4, 8).scale(1, 0.8, 1).translate(x, R.top - 0.12, out - 0.016), toBind));
  }
  // a bulging side pocket on his right, a rolled bedroll strapped under the bag
  const pocket = soft(0.04, 0.17, 0.08, 0.018, -hw - 0.012, R.bottom + 0.12, cz, (v) => { v.x -= 0.006 * (1 - (v.y / 0.085) ** 2); });
  const roll = plain(new THREE.CylinderGeometry(0.038, 0.038, R.width + 0.04, 12).rotateZ(Math.PI / 2).translate(0, R.bottom - 0.02, R.back - 0.043), toBind);
  const rollEnds = plain(mergeGeometries([-1, 1].map((s) => new THREE.TorusGeometry(0.037, 0.007, 4, 12).rotateY(Math.PI / 2).translate(s * (R.width / 2 - 0.03), R.bottom - 0.02, R.back - 0.043))), toBind);
  // the outer pocket (hidden while the flask sits over it)
  const front = soft(0.21, 0.2, 0.036, 0.016, 0, R.bottom + 0.17, out - 0.008, (v, a, b, c) => { if (v.z < 0) v.z -= 0.006 * (1 - (v.x / a) ** 2); });
  const frontFlap = soft(0.215, 0.06, 0.04, 0.014, 0, R.bottom + 0.255, out - 0.01);
  const P = PAL;
  return {
    top: R.top + 0.018, bottom: R.bottom - 0.062, dockX: -0.03, dockZ: cz - 0.04,
    parts: [
      ['Rucksack', body, P.canvas], ['Rucksack_lid', lid, P.canvasShade], ['Rucksack_lid_straps', mergeGeometries(straps), P.leather],
      ['Rucksack_buckles', mergeGeometries(buckles), P.dark], ['Rucksack_side_pocket', pocket, P.canvasShade],
      ['Bedroll', roll, P.lavender], ['Bedroll_ties', rollEnds, P.leather],
      ['Rucksack_pocket', front, P.canvasShade, { pack: true }], ['Rucksack_pocket_flap', frontFlap, P.canvas, { pack: true }],
    ],
  };
}

// ------------------------------------------------------------------ the kit
/** The traveller.glb meshes by name (the gear's art), with their bind-pose geometry. */
function glbParts(scene) {
  const out = new Map();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => { if (o.isMesh) out.set(o.name, o); });
  return out;
}
const toneOf = (mesh) => {
  const t = TRAVELLER_TONES[mesh.material.name];
  return t ? PAL[t] : '#' + mesh.material.color.getHexString();
};

/**
 * Everything the traveller wears on a body (pure data, cached per outfit scene and body geometry):
 * { pieces: [{ name, geometry (skinned to the body's bones, bind space), color, glass?, pack? }],
 *   chestZ (the chest anchor's offset), dock (where the scout's foot rests on the rucksack's lid,
 *   chest anchor frame), forearm: { r, l } (bracer frames: { position, quaternion, scale } in
 *   bind space), head: { centre, half } }.
 */
export function travellerKit(scene, body) {
  const base = body.userData.baseGeometry ?? body.geometry;
  const cache = (scene.userData.travellerKits ??= new Map());
  if (cache.has(base.uuid)) return cache.get(base.uuid);
  const suit = suitGeometry(body), bones = body.skeleton.bones, bi = (n) => BONE(bones, n);
  const glb = glbParts(scene), F = TRAVELLER;
  const [bootTop, beltY, neckY, wristX] = F.outfit;
  const pieces = [];
  const add = (name, geometry, color, o = {}) => pieces.push({ name, geometry, color, ...o });

  // ---- the head: centre and size of the human's, from its own vertices
  const headPts = points(base, onBones(base, body, /^Head$/));
  const headBox = boxOf(headPts), headC = headBox.getCenter(new THREE.Vector3()), headHalf = headBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const Head = bi('Head');
  const anchorHead = new THREE.Vector3(0, bindPos(body, 'Head').y + 0.1, bindPos(body, 'Head').z + 0.01);
  const anchorM = new THREE.Matrix4().makeTranslation(anchorHead.x, anchorHead.y, anchorHead.z);
  const hair = travellerHair(), hairGeo = plain(hair, anchorM);
  hairGeo.setAttribute('color', hair.attributes.color);   // (each lock's lighter edges: lock())
  add('Traveller_hair', rigid(hairGeo, Head), PAL.hair);

  // ---- the scarf round the neck, on the chest (the head turns inside it)
  const neck = bindPos(body, 'neck_01'), chest = bi('spine_03');
  const neckPts = points(suit, (p) => Math.abs(p.y - (neck.y + 0.02)) < 0.03 && Math.abs(p.x) < 0.13);
  const neckZ = neckPts.length ? (Math.min(...neckPts.map((p) => p.z)) + Math.max(...neckPts.map((p) => p.z))) / 2 : neck.z;
  // a loose cowl of soft cotton bunched round the neck (not stacked rings): rows of uneven folds, lying
  // wider on the shoulders, dipping a little at the front, its top edge turned in against the neck
  {
    const rows = [[-0.004, 0.071, 0], [-0.024, 0.086, 0.004], [-0.048, 0.097, 0.01], [-0.072, 0.104, 0.018], [-0.09, 0.1, 0.024], [-0.098, 0.084, 0.024]];
    const cols = 30;
    const ring = ([dy, r, dip], j) => Array.from({ length: cols }, (_, k) => {
      const a = (k / cols) * Math.PI * 2, front = Math.max(0, Math.cos(a));
      const fold = 0.008 * Math.sin(a * 7 + j * 1.9) + 0.005 * Math.sin(a * 12 - j * 2.7) + (j > 0 && j < rows.length - 1 ? 0.004 : 0);
      return new THREE.Vector3(Math.sin(a) * (r + fold) * 1.06, neck.y + dy - dip * front ** 2 + 0.006 * Math.sin(a * 5 + j), neckZ + 0.008 + Math.cos(a) * (r + fold) * 1.14);
    });
    add('Scarf_cowl', rigid(band(rows.map(ring)), chest), PAL.scarf);
  }
  // its loose end, tucked under the cowl and hanging a little down his left chest
  const scarfTail = [new THREE.Vector3(0.035, neck.y - 0.085, 0.108), new THREE.Vector3(0.045, neck.y - 0.13, 0.122), new THREE.Vector3(0.035, neck.y - 0.2, 0.14)];
  add('Scarf_tail', conform(ribbon(scarfTail, scarfTail.map(() => new THREE.Vector3(0, 0, 1)), 0.05, 0.004), suit, body, /^spine_0[123]$/, chest), PAL.scarf);
  // The translator remains a small earpiece from home, almost lost in his hair.
  add('Translator', rigid(plain(new THREE.SphereGeometry(1, 8, 6).scale(0.007, 0.012, 0.009).translate(-headHalf.x - 0.002, headC.y - 0.012, headC.z + 0.004)), Head), PAL.earpiece);

  // ---- the canvas rucksack on the back (the chest frame: the flask, the scout's dock and the lantern hang off it)
  const backPts = points(suit, (p) => p.y > neck.y - 0.24 && p.y < neck.y - 0.07 && Math.abs(p.x) < 0.1);
  const backZ = Math.min(...backPts.map((p) => p.z));
  // the chest frame's origin, 0.76 below the collar and as far behind the human's neck as the old radio
  // pack's front stood (traveller.glb's suit back at -0.14): the flask and every hook keep their places
  const glbBackZ = -0.14;
  const chestY = neck.y - 0.76, chestZ = backZ - F.backGap - glbBackZ;
  const sack = rucksack(chestY, chestZ);
  for (const [name, geo, color, o] of sack.parts) add(name, rigid(geo, chest), color, o);
  // the scout's place when there is no flask: the rucksack's lid, toward its outer side (clear of his hair) and a
  // little to his right (from there it glides over to the flask's upright when the flask is found, scout.js)
  const dock = new THREE.Vector3(sack.dockX, sack.top, sack.dockZ);

  // ---- the shoulder straps: from the rucksack's top over the shoulders, down the chest, then under
  // each arm back to its lower corners (a rucksack's, not a harness down to the belt)
  const torso = points(suit, onBones(suit, body, /^(pelvis|spine|clavicle|neck)/, 0.5));
  const strapPath = (sx) => {
    const x = sx * 0.1, pts = [], nrm = [];
    const at = (from, dir) => from.clone().addScaledVector(dir, reach(torso, from, dir, 0.025) + 0.004);
    pts.push(new THREE.Vector3(x, neck.y - 0.1, backZ - 0.012)); nrm.push(new THREE.Vector3(0, 0, -1));
    pts.push(at(new THREE.Vector3(x, neck.y - 0.25, -0.03), new THREE.Vector3(0, 1, -0.6))); nrm.push(new THREE.Vector3(0, 1, -0.6).normalize());
    pts.push(at(new THREE.Vector3(x, neck.y - 0.25, 0.0), new THREE.Vector3(0, 1, 0))); nrm.push(new THREE.Vector3(0, 1, 0));
    pts.push(at(new THREE.Vector3(x, neck.y - 0.25, 0.02), new THREE.Vector3(0, 1, 0.8))); nrm.push(new THREE.Vector3(0, 1, 0.8).normalize());
    for (const [y, k] of [[neck.y - 0.12, 1], [neck.y - 0.22, 1.04], [neck.y - 0.3, 1.18]]) {
      pts.push(at(new THREE.Vector3(x * k, y, 0), new THREE.Vector3(0, 0, 1))); nrm.push(new THREE.Vector3(0, 0, 1));
    }
    // round the ribs under the arm, to the rucksack's bottom corner
    for (const [y, d] of [[neck.y - 0.37, new THREE.Vector3(sx * 0.75, 0, 0.66)], [neck.y - 0.43, new THREE.Vector3(sx, 0, 0)], [neck.y - 0.47, new THREE.Vector3(sx * 0.7, 0, -0.71)]]) {
      pts.push(at(new THREE.Vector3(0, y, 0), d.normalize())); nrm.push(d);
    }
    pts.push(new THREE.Vector3(sx * 0.13, sack.bottom + chestY + 0.04, backZ - 0.03)); nrm.push(new THREE.Vector3(0, 0, -1));
    return [pts, nrm];
  };
  for (const sx of [-1, 1]) {
    const [pts, nrm] = strapPath(sx);
    add(`Strap_${sx}`, conform(ribbon(pts, nrm, 0.036, 0.008), suit, body, /^(pelvis|spine_0[123]|clavicle_[lr])$/, chest), PAL.strap);
  }

  // ---- the open overshirt: shoulder/sleeve shells and an open, thigh-length body.
  // The front opening grows toward the collar. Rows below the hips take each
  // thigh's weights, so the two skirts part when walking or kneeling.
  const coatRows = [
    [0.78, 0.21, 0.155, 0.36], [0.88, 0.205, 0.155, 0.32], [0.98, 0.19, 0.15, 0.3],
    [1.1, 0.185, 0.15, 0.32], [1.22, 0.20, 0.16, 0.36], [1.34, 0.22, 0.155, 0.43],
    [1.4, 0.19, 0.13, 0.6], [1.46, 0.105, 0.105, 0.68],
  ].map(([y, rx, rz, gap]) => Array.from({ length: 37 }, (_, k) => {
    const a = gap + (Math.PI * 2 - 2 * gap) * k / 36;
    const fold = 0.004 * Math.sin(a * 9 + y * 12);
    return new THREE.Vector3(Math.sin(a) * (rx + fold), y + (y < 0.8 ? 0.012 * Math.sin(a * 3) : 0), Math.cos(a) * (rz + fold) - 0.018);
  }));
  // Unlike a belt this is deliberately open: no triangle may bridge the shirt front.
  const coat = openPanel(coatRows);
  add('Coral_overshirt', conform(coat, suit, body, /^(pelvis|spine_0[123]|clavicle_[lr]|thigh_[lr])$/, chest), PAL.jacket);
  const sleeve = pick(suit, (a, b, c) => [a, b, c].every((i) => {
    const x = Math.abs(suit.attributes.position.getX(i));
    return x > 0.16 && x < wristX + 0.012 && suit.attributes.position.getY(i) > 1.15;
  }));
  for (const name of Object.keys(sleeve.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(name)) sleeve.deleteAttribute(name);
  const sp = sleeve.attributes.position, sn = sleeve.attributes.normal;
  for (let i = 0; i < sp.count; i++) sp.setXYZ(i, sp.getX(i) + sn.getX(i) * 0.008, sp.getY(i) + sn.getY(i) * 0.008, sp.getZ(i) + sn.getZ(i) * 0.008);
  sleeve.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sleeve.attributes.skinIndex.array, 4));
  add('Coral_sleeves', sleeve, PAL.jacket);
  // Turned-back lapels, a soft collar and a few small, dull buttons.
  for (const sign of [-1, 1]) {
    const lapel = openPanel([
      [new THREE.Vector3(sign * 0.06, 1.46, 0.07), new THREE.Vector3(sign * 0.13, 1.415, 0.1)],
      [new THREE.Vector3(sign * 0.058, 1.35, 0.13), new THREE.Vector3(sign * 0.117, 1.36, 0.135)],
      [new THREE.Vector3(sign * 0.067, 1.25, 0.145), new THREE.Vector3(sign * 0.076, 1.27, 0.153)],
    ]);
    add(`Lapel_${sign}`, conform(lapel, suit, body, /^(spine_0[123]|clavicle_[lr])$/, chest), PAL.jacketShade);
  }
  for (const y of [0.86, 1.0, 1.14]) add(`Shirt_button_${y}`, conform(plain(new THREE.SphereGeometry(0.005, 6, 4).scale(1, 1, 0.45).translate(-0.074, y, 0.138)), suit, body, /^(pelvis|spine_0[123])$/, chest), PAL.pouch);

  // One soft round satchel on a diagonal strap, rather than a utility belt.
  const bagAt = new THREE.Vector3(0.13, 0.985, 0.17);
  const bag = plain(new THREE.SphereGeometry(1, 16, 10).scale(0.105, 0.083, 0.044).translate(bagAt.x, bagAt.y, bagAt.z));
  add('Round_satchel', conform(bag, suit, body, /^(pelvis|spine_01)$/, bi('pelvis'), bagAt), PAL.pouch);
  const flap = plain(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.58).scale(0.109, 0.068, 0.044).translate(bagAt.x, bagAt.y + 0.025, bagAt.z + 0.016));
  add('Satchel_flap', conform(flap, suit, body, /^(pelvis|spine_01)$/, bi('pelvis'), bagAt), PAL.strap);
  const diagonal = [new THREE.Vector3(-0.14, 1.425, 0.11), new THREE.Vector3(-0.08, 1.32, 0.157), new THREE.Vector3(0.01, 1.19, 0.166), new THREE.Vector3(0.115, 1.04, 0.19)];
  add('Satchel_strap', conform(ribbon(diagonal, diagonal.map(() => new THREE.Vector3(0, 0, 1)), 0.028, 0.005), suit, body, /^(pelvis|spine_0[123]|clavicle_[lr])$/, chest), PAL.strap);

  // Faded cloth ties knotted to the rucksack's top corners, hanging down its sides.
  for (const [sx, color, length] of [[1, PAL.teal, 0.5], [-1, PAL.lavender, 0.43]]) {
    const z = chestZ + RUCKSACK.back - RUCKSACK.depth * 0.6, y = chestY + RUCKSACK.top - 0.02;
    const path = [new THREE.Vector3(sx * 0.145, y, z), new THREE.Vector3(sx * 0.168, y - 0.1, z - 0.005), new THREE.Vector3(sx * 0.172, y - 0.28, z + 0.01), new THREE.Vector3(sx * 0.18, y - length, z + 0.02)];
    add(`Pack_cloth_${sx}`, conform(ribbon(path, path.map(() => new THREE.Vector3(sx, 0, 0)), 0.04, 0.003), suit, body, /^(pelvis|spine_0[123])$/, chest), color);
  }

  // ---- the boots: the glb's soft desert boots on each foot (no suit seams or buckles), the soles just under the ground
  for (const [s, S, sign] of [['l', 'L', 1], ['r', 'R', -1]]) {
    const footPts = points(base, ((on) => (p, i) => p.x * sign > 0 && on(p, i))(onBones(base, body, new RegExp(`^(foot|ball)_${s}$`))));
    const fb = boxOf(footPts), fc = fb.getCenter(new THREE.Vector3()), fs = fb.getSize(new THREE.Vector3());
    const parts = ['Equipment_dusty_pink_boots', 'Equipment_rubber_soles'].map((n) => [n, glb.get(n)]).filter(([, m]) => m);
    const side = () => (geo) => (a, b, c) => [a, b, c].every((v) => geo.attributes.position.getX(v) * sign > 0);
    const bootBox = new THREE.Box3();
    for (const [, m] of parts.slice(0, 2)) bootBox.union(boxOf(points(pick(m.geometry, side(m)(m.geometry)), () => true)));
    const bc = bootBox.getCenter(new THREE.Vector3()), bs = bootBox.getSize(new THREE.Vector3());
    const sx = (fs.x + 2 * F.boot.margin) / bs.x, sz = Math.max(1, (fs.z + 2 * F.boot.margin) / bs.z);
    // (centred on the foot; the heel's end kept just behind the human's heel)
    const bootM = new THREE.Matrix4().makeTranslation(fc.x, F.boot.sole, fb.min.z - F.boot.margin + bs.z * sz / 2)
      .multiply(new THREE.Matrix4().makeScale(sx, 1, sz)).multiply(new THREE.Matrix4().makeTranslation(-bc.x, -bootBox.min.y, -bc.z));
    const footB = bi(`foot_${s}`), calfB = bi(`calf_${s}`);
    for (const [n, m] of parts) {
      const g = plain(pick(m.geometry, side(m)(m.geometry)), new THREE.Matrix4().multiplyMatrices(bootM, m.bindMatrix));
      // the glb's own weights: its foot follows the foot, the shaft above the ankle the shin
      const src = pick(m.geometry, side(m)(m.geometry)), J = src.attributes.skinIndex, W = src.attributes.skinWeight;
      const n4 = g.attributes.position.count, J2 = new Uint16Array(n4 * 4), W2 = new Float32Array(n4 * 4);
      for (let i = 0; i < n4; i++) {
        let shin = 0;
        for (let k = 0; k < 4; k++) if (/^shin/.test(m.skeleton.bones[J.getComponent(i, k)].name)) shin += W.getComponent(i, k);
        J2.set([footB, calfB, 0, 0], i * 4); W2.set([1 - shin, shin, 0, 0], i * 4);
      }
      g.setAttribute('skinIndex', new THREE.BufferAttribute(J2, 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(W2, 4));
      add(`${n}_${s}`, g, toneOf(m));
    }
    // The rolled trouser hem leaves an ankle-length gap above the boot.
    const legAxis = (y) => { const c = bindPos(body, `calf_${s}`), f = bindPos(body, `foot_${s}`); return f.clone().lerp(c, (y - f.y) / (c.y - f.y)); };
    const bootTopY = F.boot.sole + bs.y;
    const shaft = points(plain(pick(parts[0][1].geometry, side(parts[0][1])(parts[0][1].geometry)), bootM), () => true);
    const legPts = points(suit, ((on) => (p, i) => p.x * sign > 0 && on(p, i))(onBones(suit, body, new RegExp(`^(calf|thigh|foot)_${s}$`))));
    const cuff = (y, out) => { const c = legAxis(y); return Array.from({ length: 20 }, (_, k) => {
      const a = (k / 20) * Math.PI * 2, d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const r = Math.max(reach(legPts, c, d, 0.03), reach(shaft.filter((p) => Math.abs(p.y - bootTopY) < 0.05), c.clone().setY(bootTopY - 0.02), d, 0.04));
      return c.clone().addScaledVector(d, r + out + 0.012 * Math.sin(a * 7) ** 2);
    }); };
    const y0 = bootTop + 0.005, y1 = bootTop + 0.045;
    add(`Trouser_cuff_${s}`, rigid(mergeGeometries([band([cuff(y0, 0.006), cuff(y1, 0.004)]), band([cuff(y1, 0.004), cuff(y1, -0.01)])]), calfB), PAL.suit);
    // the soft boot's slouched, turned-down top
    const rim = (y, out) => { const c = legAxis(y); return Array.from({ length: 20 }, (_, k) => {
      const a = (k / 20) * Math.PI * 2, d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      return c.clone().addScaledVector(d, reach(shaft.filter((p) => Math.abs(p.y - bootTopY) < 0.04), c.clone().setY(bootTopY - 0.015), d, 0.04) + out + 0.004 * Math.sin(a * 5 + sign));
    }); };
    add(`Boot_cuff_${s}`, rigid(mergeGeometries([band([rim(bootTopY - 0.04, 0.004), rim(bootTopY - 0.002, 0.009)]), band([rim(bootTopY - 0.002, 0.009), rim(bootTopY - 0.004, -0.003)])]), calfB), PAL.boot);
    // The overshirt rolls up just below the elbow, leaving the forearm bare.
    const arm = bindPos(body, `lowerarm_${s}`), hand = bindPos(body, `hand_${s}`), along = hand.clone().sub(arm).normalize();
    const armPts = points(suit, ((on) => (p, i) => p.x * sign > 0 && on(p, i))(onBones(suit, body, new RegExp(`^lowerarm_${s}|^hand_${s}$`), 0.3)));
    const axisAt = (x) => arm.clone().lerp(hand, (x - arm.x) / (hand.x - arm.x));
    const gauntlet = (x, out) => { const c = axisAt(x); return Array.from({ length: 18 }, (_, k) => {
      const a = (k / 18) * Math.PI * 2, d = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
      return c.clone().addScaledVector(d, reach(armPts, c, d, 0.02) + out);
    }); };
    const g0 = sign * (wristX - 0.075), g1 = sign * (wristX + 0.008);
    add(`Rolled_sleeve_${s}`, rigid(mergeGeometries([band([gauntlet(g0, 0.016), gauntlet(g1, 0.006)]), band([gauntlet(g1, 0.006), gauntlet(g1, -0.004)]), band([gauntlet(g0, 0.0), gauntlet(g0, 0.016)])]), bi(`lowerarm_${s}`)), PAL.jacket);
  }

  // ---- the bracer's frame on each forearm (fluid-tool.js): +y toward the hand, -x the thumb's side,
  // scaled out so the bracer sits round the baggy sleeve, not in it
  const forearm = {};
  for (const [s, sign] of [['l', 1], ['r', -1]]) {
    const arm = bindPos(body, `lowerarm_${s}`), hand = bindPos(body, `hand_${s}`), thumb = bindPos(body, `thumb_01_${s}`);
    const y = hand.clone().sub(arm).normalize();
    const t = thumb.sub(hand), x = t.addScaledVector(y, -t.dot(y)).normalize().negate();
    const z = new THREE.Vector3().crossVectors(x, y);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    const sleevePts = points(suit, ((on) => (p, i) => p.x * sign > 0 && on(p, i))(onBones(suit, body, new RegExp(`^lowerarm_${s}`), 0.5)));
    const c = arm.clone().addScaledVector(y, 0.13);
    let r = 0;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; r = Math.max(r, reach(sleevePts, c, x.clone().multiplyScalar(Math.cos(a)).addScaledVector(z, Math.sin(a)), 0.02)); }
    const k = Math.max(1, (r + 0.006) / 0.05);
    forearm[s] = { position: arm, quaternion: q, scale: new THREE.Vector3(k, 1, k) };
  }

  const kit = { pieces, chestY, chestZ, dock, forearm, head: { centre: headC, half: headHalf }, backZ };
  cache.set(base.uuid, kit);
  return kit;
}
